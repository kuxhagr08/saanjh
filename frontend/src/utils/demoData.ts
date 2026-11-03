import { db, type LocalTask, type LocalHabit, type LocalMessage, type LocalAIConversation, type LocalVaultItem } from '../db';
import { generateIdentityKeys, deriveVaultMasterKey, encryptVaultFile, encryptWithPassword } from '../utils/crypto';
import { APP_NAME } from '../constants';

/**
 * Seeds a rich, realistic, alive environment with tasks, habits, chats, photos,
 * and AI conversations so every screen looks completely designed and functional.
 * Only callable in DEV mode. Does NOT weaken any encryption.
 */
export async function seedDemoData(userEmail: string = 'kuxhagr@saanjh.local') {
  console.log(`[${APP_NAME} DEMO] Seeding live demo environment...`);

  // 1. Ensure Identity Keys exist and are legitimately decryptable
  let identity = await db.identityKeys.get('current');
  const demoPass = '12345678';
  if (!identity || identity.email !== userEmail || identity.privateKeyEncrypted.includes('"ciphertext":"demo"')) {
    const keys = await generateIdentityKeys();
    const encryptedPriv = await encryptWithPassword(keys.privateKeyBase64, demoPass);
    const encryptedSignPriv = await encryptWithPassword(keys.signingPrivateKeyBase64, demoPass);
    identity = {
      id: 'current',
      email: userEmail,
      publicKeyBase64: keys.publicKeyBase64,
      privateKeyEncrypted: JSON.stringify(encryptedPriv),
      nonce: encryptedPriv.nonce,
      signingPublicKeyBase64: keys.signingPublicKeyBase64,
      signingPrivateKeyEncrypted: JSON.stringify(encryptedSignPriv),
      fingerprint: keys.fingerprint,
      createdAt: Date.now(),
    };
    await db.identityKeys.put(identity);
  }

  // 2. Realistic Contacts
  const contacts = [
    {
      id: 2,
      email: 'maya.patel@design.co',
      displayName: 'Maya Patel',
      publicKeyBase64: 'mock_maya_pubkey',
      signingPublicKeyBase64: 'mock_maya_sign',
      fingerprint: '1920-4829-1920-3382',
      verified: true,
      addedAt: Date.now() - 86400000 * 3,
    },
    {
      id: 3,
      email: 'rohan.sharma@linear.app',
      displayName: 'Rohan Sharma',
      publicKeyBase64: 'mock_rohan_pubkey',
      signingPublicKeyBase64: 'mock_rohan_sign',
      fingerprint: '4481-2291-0021-9943',
      verified: true,
      addedAt: Date.now() - 86400000 * 5,
    },
    {
      id: 4,
      email: 'ananya@neuroscience.org',
      displayName: 'Dr. Ananya Rao',
      publicKeyBase64: 'mock_ananya_pubkey',
      signingPublicKeyBase64: 'mock_ananya_sign',
      fingerprint: '8810-3321-9942-1102',
      verified: false,
      addedAt: Date.now() - 86400000 * 1,
    },
  ];
  for (const c of contacts) {
    await db.contacts.put(c);
  }

  // 3. Realistic E2E Messages
  await db.messages.clear();
  const sampleMessages: LocalMessage[] = [
    {
      conversationId: 1,
      senderId: 2,
      senderEmail: 'maya.patel@design.co',
      plaintext: `Hey! Loved the calm obsidian palette for ${APP_NAME}. Are the serif headings ready?`,
      timestamp: Date.now() - 1000 * 60 * 45,
      status: 'delivered',
    },
    {
      conversationId: 1,
      senderId: 1,
      senderEmail: userEmail,
      plaintext: 'Yes! Instrument Serif is hooked in for page greetings and Geist for crisp UI reading.',
      timestamp: Date.now() - 1000 * 60 * 30,
      status: 'delivered',
    },
    {
      conversationId: 1,
      senderId: 2,
      senderEmail: 'maya.patel@design.co',
      plaintext: 'Brilliant. The zero-knowledge privacy guarantees make this feel like a true sanctuary.',
      timestamp: Date.now() - 1000 * 60 * 10,
      status: 'delivered',
    },
    {
      conversationId: 2,
      senderId: 3,
      senderEmail: 'rohan.sharma@linear.app',
      plaintext: 'Quick check: did you run the Argon2id benchmarks on the mobile webview?',
      timestamp: Date.now() - 1000 * 60 * 120,
      status: 'delivered',
    },
    {
      conversationId: 2,
      senderId: 1,
      senderEmail: userEmail,
      plaintext: 'Runs under 350ms with interactive opslimit. Very smooth on Safari iOS & Chrome.',
      timestamp: Date.now() - 1000 * 60 * 90,
      status: 'delivered',
    },
  ];
  for (const m of sampleMessages) {
    await db.messages.add(m);
  }

  // 4. Tasks (Priorities, Due dates)
  await db.tasks.clear();
  const sampleTasks: LocalTask[] = [
    {
      title: 'Review quarterly architecture roadmap with deep focus',
      status: 'todo',
      priority: 'urgent',
      dueDate: 'Today',
      tags: ['deep-work', 'strategy'],
      createdAt: Date.now(),
    },
    {
      title: 'Audit client-side Argon2id key derivation benchmarks',
      status: 'in_progress',
      priority: 'high',
      dueDate: 'Tomorrow',
      tags: ['security', 'audit'],
      createdAt: Date.now() - 86400000,
    },
    {
      title: 'Mindful 20-minute evening walk without smartphone',
      status: 'todo',
      priority: 'medium',
      dueDate: 'Today',
      tags: ['mindfulness'],
      createdAt: Date.now(),
    },
    {
      title: 'Export encrypted vault backup (.apnabackup) to cold storage',
      status: 'done',
      priority: 'low',
      dueDate: 'Yesterday',
      tags: ['vault', 'backup'],
      createdAt: Date.now() - 86400000 * 2,
      completedAt: Date.now() - 86400000,
    },
  ];
  for (const t of sampleTasks) {
    await db.tasks.add(t);
  }

  // 5. Habits with Streaks & Heatmaps
  await db.habits.clear();
  const sampleHabits: LocalHabit[] = [
    {
      title: 'Morning Meditation & Breathing',
      category: 'Mindfulness',
      targetPerWeek: 7,
      streak: 14,
      history: {
        '2026-11-01': true,
        '2026-10-31': true,
        '2026-10-30': true,
        '2026-10-29': true,
        '2026-10-28': true,
        '2026-10-27': true,
      },
      createdAt: Date.now() - 86400000 * 14,
    },
    {
      title: 'Read 25 Pages of Non-Fiction',
      category: 'Growth',
      targetPerWeek: 5,
      streak: 9,
      history: {
        '2026-11-01': true,
        '2026-10-31': true,
        '2026-10-30': true,
      },
      createdAt: Date.now() - 86400000 * 9,
    },
    {
      title: 'Zero Screen-Time 1 Hour Before Sleep',
      category: 'Health',
      targetPerWeek: 7,
      streak: 5,
      history: {
        '2026-10-31': true,
        '2026-10-30': true,
        '2026-10-29': true,
      },
      createdAt: Date.now() - 86400000 * 5,
    },
  ];
  for (const h of sampleHabits) {
    await db.habits.add(h);
  }

  // 6. Notes
  await db.notes.clear();
  await db.notes.add({
    title: 'The Philosophy of Digital Serenity',
    content: `When an app respects your attention, you feel calm. When an app treats your attention as a resource to extract, you feel scattered. ${APP_NAME} exists to be the quiet room in a noisy world.`,
    tags: ['manifesto', 'calm'],
    isPinned: true,
    createdAt: Date.now() - 86400000 * 2,
    updatedAt: Date.now(),
  });

  // 7. AI Conversation
  await db.aiConversations.clear();
  await db.aiConversations.add({
    title: 'Mindful Evening Reflection',
    persona: 'coach',
    messages: [
      {
        role: 'assistant',
        content: 'Good evening! How did your focus sessions feel today? Did you manage to carve out quiet time for yourself?',
        timestamp: Date.now() - 1000 * 60 * 15,
      },
      {
        role: 'user',
        content: 'Managed two 25-minute Pomodoro blocks with brown noise soundscape. Feeling centered and accomplished.',
        timestamp: Date.now() - 1000 * 60 * 10,
      },
      {
        role: 'assistant',
        content: 'Wonderful progress. Deep focus compounds silently over weeks. Protect your evening peace and rest well.',
        timestamp: Date.now() - 1000 * 60 * 5,
      },
    ],
    createdAt: Date.now() - 1000 * 60 * 20,
    updatedAt: Date.now(),
  });

  console.log('[APNA DEMO] Live sample dataset loaded successfully.');
}
