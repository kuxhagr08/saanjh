import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const AUTH_FILE = path.join(process.cwd(), 'tests', '.auth', 'state.json');

// Helper to log in or restore demo auth state
async function ensureAuthenticated(page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Check if we are on the login/landing screen
  const tryDemoButton = page.locator('button:has-text("Instant Local Demo"), button:has-text("Try Demo"), button:has-text("Try demo"), button:has-text("Demo")').first();
  if (await tryDemoButton.isVisible()) {
    await tryDemoButton.click();
    // Wait for key derivation and navigation to home
    await page.waitForSelector('header', { timeout: 20000 });
    // Save storage state for persistence
    const state = await page.context().storageState();
    fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });
    fs.writeFileSync(AUTH_FILE, JSON.stringify(state, null, 2));
  }
}

test.describe('Layout & Overflow Gate Tests (All Browsers & Mobile Viewports)', () => {
  test.beforeEach(async ({ page }) => {
    // If auth state exists, restore cookies / storage
    if (fs.existsSync(AUTH_FILE)) {
      try {
        const state = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
        await page.context().addCookies(state.cookies || []);
      } catch {
        // ignore
      }
    }
    await ensureAuthenticated(page);
  });

  test('STEP 1 Verification: Messages page is not clipped on left or right at 1190px or mobile', async ({ page }) => {
    await page.goto('/messages');
    await page.waitForLoadState('networkidle');

    // 1. Verify document does NOT scroll horizontally
    const docOverflow = await page.evaluate(() => {
      const doc = document.documentElement;
      return {
        scrollWidth: doc.scrollWidth,
        clientWidth: doc.clientWidth,
        hasHorizontalScroll: doc.scrollWidth > doc.clientWidth + 1,
      };
    });
    expect(docOverflow.hasHorizontalScroll, `Page has horizontal overflow: scrollWidth=${docOverflow.scrollWidth}, clientWidth=${docOverflow.clientWidth}`).toBe(false);

    // 2. Check "Messages" heading is not clipped on the left
    const messagesTitle = page.locator('h2:has-text("Messages")').first();
    await expect(messagesTitle).toBeVisible();
    const titleBox = await messagesTitle.boundingBox();
    expect(titleBox).not.toBeNull();
    if (titleBox) {
      expect(titleBox.x, 'Messages title clipped on the left (x < 0)').toBeGreaterThanOrEqual(0);
    }

    // 3. Check "Chats" tab button is not clipped to "ats"
    const chatsTab = page.locator('button:has-text("Chats")').first();
    await expect(chatsTab).toBeVisible();
    const chatsBox = await chatsTab.boundingBox();
    expect(chatsBox).not.toBeNull();
    if (chatsBox) {
      expect(chatsBox.x, 'Chats tab button clipped on the left').toBeGreaterThanOrEqual(0);
    }

    // 4. Verify right pane / message input if a conversation is open or on desktop
    const viewport = page.viewportSize();
    const isMobile = viewport && viewport.width < 768;

    if (!isMobile) {
      // On desktop (including 1190px Safari), verify right pane does not overflow
      const rightPane = page.locator('div:has-text("End-to-end encrypted"), div:has-text("Select a conversation"), div:has-text("No messages yet")').first();
      if (await rightPane.isVisible()) {
        const rightBox = await rightPane.boundingBox();
        if (rightBox && viewport) {
          expect(rightBox.x + rightBox.width, 'Right pane clipped on right edge').toBeLessThanOrEqual(viewport.width + 2);
        }
      }

      // Check message input form if present
      const sendInput = page.locator('input[placeholder*="message"]');
      if (await sendInput.isVisible()) {
        const sendBtn = page.locator('button[type="submit"], button[aria-label="Send message"]');
        await expect(sendBtn).toBeVisible();
        const btnBox = await sendBtn.boundingBox();
        if (btnBox && viewport) {
          expect(btnBox.x + btnBox.width, 'Send button cut off on the right').toBeLessThanOrEqual(viewport.width + 2);
        }
      }
    }
  });

  test('Header and Content alignment: shared AppContainer bounds', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify header exists and does not cause horizontal scroll
    const header = page.locator('header');
    await expect(header).toBeVisible();

    const headerOverflow = await page.evaluate(() => {
      const headerEl = document.querySelector('header');
      if (!headerEl) return false;
      const rect = headerEl.getBoundingClientRect();
      return rect.right > window.innerWidth + 1 || rect.left < -1;
    });
    expect(headerOverflow, 'Header overflows viewport boundaries').toBe(false);
  });

  test('Global route overflow scan: no horizontal overflow across main screens', async ({ page }) => {
    const routes = ['/', '/social', '/planner', '/vault', '/security'];
    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');

      const isOverflowing = await page.evaluate(() => {
        const doc = document.documentElement;
        return doc.scrollWidth > doc.clientWidth + 1;
      });

      expect(isOverflowing, `Route ${route} has horizontal overflow`).toBe(false);
    }
  });
});
