# Saanjh — Project Status & QA Gate Audit

**Last Updated:** November 3, 2026  
**Status:** Fix + Complete Round Finished • Zero-Storage Enforced • 13 Django Tests Passing • 37 Vitest Tests Passing • Production Build Verified

---

## 🟢 Summary of Milestone Deliverables

### PHASE 1: Zero-Storage & Data Sovereignty Architecture
* **PostgreSQL Schema Allowlist**: Enforced by `DATA_ALLOWLIST.md`. Zero chat messages, zero attachments, zero contact address books, zero vault files, zero AI prompts stored at rest on the server.
* **Ephemeral Mailbox Courier (`core/mailbox.py`)**: In-memory Redis mailbox with 64 KB cap and 14-day TTL. Messages are hard deleted immediately upon recipient delivery acknowledgment.
* **Privacy Ledger & Account Purge**: Transparent reporting via `GET /api/privacy/ledger/` and full erasure via `DELETE /api/privacy/purge/`.
* **Client-Side Encrypted Backup (`.apnabackup`)**: Argon2id + libsodium secretbox with checksum validation.
* **CI Allowlist Enforcement**: Automated Django test suite prevents database drift.

---

### PHASE 2: Fix + Complete Round (Observed Bugs A1–A11)

#### A1. Single App Name Standardisation ("Saanjh")
* Centralized in `frontend/src/constants.ts`: `APP_NAME = 'Saanjh'`.
* Standardized across UI, page titles, emails, `capacitor.config.ts`, `backend/config/settings.py`, and status messages (`Hey there! I am using Saanjh.`).
* Verified with unit test `frontend/src/__tests__/app_name.test.ts`.

#### A2. Samaj Create Flow (`SamajCreateModal.tsx`)
* Step 1 type picker supporting:
  - **Thought**: Text with gradient presets, font size toggle, and "Aaj ka Vichaar" prompt chips.
  - **Photo**: Multi-photo gallery pick (up to 10) and live camera capture; client-side WebP compression and canvas EXIF stripping.
  - **Reel / Video**: Client-side validation (max 50 MB, max 60s), preview player, trim slider, canvas cover frame picker.
  - **Poll**: Question, 2 to 4 options, duration selection, multiple-vote toggle, and animated percentage bars.
  - **24h Story**: Fleeting story creator.
* Drafts autosaved in `localStorage`.

#### A3. Samaj Stories & Circles Ecosystem
* **Stories Tab**: Full-screen 24h story browser with segment progress, pause-on-hold, left/right tap, author view count, and encrypted circle replies (`StoryViewerModal.tsx`).
* **Circles Tab**: Community browser with categories, rules preview, member rosters, zero-tracking guarantee card, and discussion initiation (`CircleDetailModal.tsx`).
* Rich empty states for both tabs (A11).

#### A4. Samaj Mobile Tab Bar
* Horizontally scrollable chip row with edge fade and auto-scroll to the active tab.

#### A5. Decrypted Chat Previews
* Replaced raw `[Encrypted message payload]` with decrypted text or media indicators (`📷 Photo`, `🎤 Voice message`, `🎥 Video`, `📄 Document`).
* Shows lock icon when locked; unread badges and delivery ticks (sent, delivered, read).

#### A6. Mobile Back Navigation & Visual Viewport
* Real router history (`window.history.pushState` / `popstate`).
* Header back button `<` closes conversation and updates router state.
* Left-edge swipe gesture to go back.
* Bottom navigation dock hides inside active mobile chat.
* Keyboard-aware composer positioning above virtual keyboard and safe areas.

#### A7. WhatsApp-Style Contact Info Screen (`ContactInfoScreen.tsx`)
* Replaces tiny low-contrast glass popup that leaked email.
* Mobile: Full screen pushed from header with back arrow. Desktop: Right-side panel (~360px), closes with `Esc`.
* @username-first display (never exposes email or phone unless user opted in).
* Action row: Message, Audio Call, Video Call, Search.
* E2E encryption block: Safety number verification with QR and 60-digit safety number.
* Unknown contact banner: Add Contact / Block / Report.
* Media, Docs & Links tabs with count and previews.
* Settings: Starred count, Mute (8h / 1w / always), Disappearing messages, Biometric Chat lock.
* Danger zone: Block/Unblock, Report, Clear chat, Delete chat and keys, Export chat (.apnabackup / JSON).

#### A8. Desktop Dropdown Mutual Exclusivity
* "More spaces" and profile dropdowns are mutually exclusive (opening one closes the other).
* Click-outside and `Esc` listeners with focus return to trigger elements. Proper ARIA attributes.

#### A9. Mobile "All Spaces" Bottom Sheet
* Converted from centered modal to true bottom sheet with drag handle.
* Added **Planner** (`/planner`) and **Settings** (`/settings`) to registry.

#### A10. WCAG AA Glass Contrast
* Upgraded `.liquid-glass` to 88–94% surface opacity in Light, Dark, and AMOLED modes.
* Fixed contrast of encryption status text to `text-emerald-800 dark:text-emerald-300`.

#### A11. Empty-State Quality
* Every empty view across Stories, Circles, Feeds, and Chats features an illustration, descriptive sentence, and primary action button.

---

## 🟢 Test Verification Results

### 1. Frontend Vitest Suite
```
 RUN  v5.0.5 /Users/kushagrashrivastava/Desktop/MAJOR PROJECTS/</frontend

 ✓ src/__tests__/device_auth.test.ts (4 tests)
 ✓ src/__tests__/app_name.test.ts (2 tests)
 ✓ src/__tests__/customization.test.ts (5 tests)
 ✓ src/__tests__/fix_round_regressions.test.ts (11 tests)
 ✓ src/__tests__/security.test.ts (9 tests)
 ✓ src/__tests__/backup.test.ts (6 tests)

 Test Files  6 passed (6)
      Tests  37 passed (37)
```

### 2. Backend Django Core & Zero-Storage Suite
```
Ran 13 tests in 1.324s

OK
test_argon2id_password_hashing ... ok
test_auth_login_flow ... ok
test_health_check ... ok
test_prekey_bundle_lifecycle ... ok
test_public_encryption_identity_publishing ... ok
test_1_data_allowlist_ci_drift ... ok
test_2_canary_zero_storage ... ok
test_3_delivery_immediate_ack_deletion ... ok
test_4_ttl_fake_clock_expiry ... ok
test_5_redis_persistence_disabled ... ok
test_6_quota_tests_size_and_relay_caps ... ok
test_7_log_sanitization_no_passphrases_or_tokens ... ok
test_8_privacy_ledger_and_purge_endpoint ... ok
```

### 3. Production Build
```
vite v6.4.5 building for production...
✓ 2170 modules transformed.
dist/index.html                            2.22 kB │ gzip:   1.03 kB
dist/assets/crypto.worker-euIrXRhd.js    539.14 kB
dist/assets/index-C-lS57nG.css            90.18 kB │ gzip:  15.80 kB
dist/assets/web-BtnEgX2I.js                0.84 kB │ gzip:   0.40 kB
dist/assets/index-7VjnG9Ui.js          1,400.97 kB │ gzip: 424.28 kB
✓ built in 3.65s
```
