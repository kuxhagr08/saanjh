# Saanjh — Feature Matrix & Implementation Guide

> **Your Life. Your Space.**  
> A privacy-first, zero-server-storage personal platform built for real-world everyday use in India and beyond.

---

## 0. Zero-Storage Server Courier Architecture (Verified & Enforced)

* **Principle**: User data lives ONLY on:
  1. The user's device (IndexedDB with AES-GCM / libsodium secretbox).
  2. Peer devices over direct WebRTC data channels.
  3. User-owned storage exports (`.apnabackup`).
* **Postgres Strict Allowlist (`DATA_ALLOWLIST.md`)**:
  - Contains strictly: accounts, username/handle, argon2id auth verifier, device IDs, public identity prekeys, push token, billing IDs, Samaj public posts/comments, Safe Share temp links.
  - Zero private chat messages, zero attachments, zero contact address books, zero vault files, zero AI prompts stored on server.
  - Enforced by automated CI migration test (`test_1_data_allowlist_ci_drift`).
* **Ephemeral Mailbox Courier (`core/mailbox.py`)**:
  - Offline messages buffered in Redis/volatile memory with strict 64 KB cap and 14-day TTL.
  - Hard deleted immediately upon recipient delivery acknowledgment (`DELETE /api/mailbox/<msg_id>/ack/`).
  - Automated canary test (`test_2_canary_zero_storage`) confirms 0 database records created during full message exchange.
* **Privacy Ledger & Account Purge**:
  - `GET /api/privacy/ledger/` discloses exact server-held metadata.
  - `DELETE /api/privacy/purge/` permanently erases all account records, public keys, and mailbox envelopes.
* **Client-Side Encrypted Backup (`.apnabackup`)**:
  - Client-side Argon2id key derivation + libsodium secretbox encryption.
  - SHA-256 header checksum and integrity verification.

---

## 1. Authentication & Key Architecture (Step 1)

* **Single Password Field**: Consistent terminology everywhere; all confusing "login password / passphrase" distinctions eliminated.
* **Web Worker Key Derivation**:
  - `crypto.worker.ts` runs Libsodium Argon2id WASM in background thread.
  - Derives `authSecret`, `kek`, and `masterKey` in ONE step.
  - Keeps active master keys in worker memory with buffer zeroisation on lock.
* **Remember This Device**:
  - Checkbox on login/signup (default ON).
  - Persists Master Key re-wrapped by a random **non-extractable WebCrypto AES-GCM 256-bit key** in IndexedDB (`ApnaDeviceSecurityDB`).
  - Page reloads and reopened tabs unwrap automatically without re-prompting.
* **Configurable Auto-Lock**:
  - Idle timeouts: `Never`, `1 Day`, `7 Days` (default), `30 Days`, and `Lock on Close` (for shared computers).
* **WebAuthn Biometric Quick-Unlock**:
  - Touch ID, Face ID, Windows Hello, and Passkeys support via W3C WebAuthn.
* **Inline Unlock Screen (`InlineUnlockScreen.tsx`)**:
  - Replaces intrusive popups with a clean inline unlock view when device locks or times out.
* **Full-Viewport Modal Backdrop**:
  - Overlays use `fixed inset-0 z-[9999] backdrop-blur-sm` covering the entire viewport including headers, with focus trap and `Esc` key handling.

---

## 2. Encrypted Messaging, Contact Info & Navigation (A5, A6, A7, Section D)

* **WhatsApp-Style Contact Info Screen (`ContactInfoScreen.tsx`)**:
  - Pushed as a full-screen view on mobile with back arrow; opens as an accessible right-side panel (~360px) on desktop (closes with `Esc`).
  - **Privacy Guarantee**: Renders `@username` prominently; never exposes phone number or email address unless explicitly opted in.
  - **Action Row**: Instant Message, P2P Audio Call, P2P Video Call, Search in Conversation.
  - **E2E Security Block**: "Messages are end-to-end encrypted. Tap to verify." Opens Safety Number modal with QR and 60-digit fingerprint.
  - **Unknown Contact Shield**: Warning banner with Add Contact, Block, and Report actions.
  - **Media, Docs & Links**: Tabbed browser with counts and previews (photo/video thumbnails, doc names/sizes, URLs).
  - **Chat Controls**: Starred messages count, Mute notifications (8h / 1w / Always), Disappearing messages (Off / 24h / 7d / 90d), Biometric Chat Lock toggle.
  - **Danger Zone**: Block / Unblock contact, Report to community moderators, Clear chat history, Delete chat and purge keys, Export chat (.apnabackup or plaintext JSON).
* **Decrypted Chat Previews (A5)**:
  - Clean decrypted last-message text in conversation list after device unlock.
  - Media indicators: `📷 Photo`, `🎤 Voice message`, `🎥 Video`, `📄 Document`.
  - Locked state displays lock icon; raw `[Encrypted message payload]` is completely eliminated.
  - Delivery ticks: single check (sent), double check (delivered), colored double check (read). Unread badges and status icons.
* **Seamless Mobile Back Navigation (A6)**:
  - Real browser router history (`window.history.pushState` / `popstate`).
  - Mobile back `<` button in conversation header resets active conversation and navigates back.
  - Left-edge touch swipe gesture to go back.
  - Bottom navigation dock automatically hides inside active mobile chat.
  - Keyboard-aware composer positioning above visual viewport and safe areas.

---

## 3. Samaj Social Ecosystem (A2, A3, A4, Section B & C)

* **Horizontally Scrollable Tab Bar (A4)**:
  - Chip row with edge-fade gradient and automatic scroll-to-active tab on mobile.
  - Five distinct tabs: Feed, Reels, Stories, Circles, Create.
* **Full Samaj Create Flow (`SamajCreateModal.tsx`)**:
  - Accessible from the Create tab and floating "+" FAB.
  - **Thought**: Text with gradient background presets, font sizes, and "Aaj ka Vichaar" mindful prompt chips.
  - **Photo**: Multi-photo upload (up to 10), gallery and live camera capture, automatic client-side canvas WebP compression and EXIF stripping.
  - **Reel / Video**: Client-side validation enforcing max 50 MB and max 60s duration, preview player, trim slider, canvas cover frame generator, and upload progress.
  - **Poll**: Question, 2 to 4 options, duration (24h / 3d / 7d), multiple-vote toggle, animated percentage results.
  - **24h Story**: Fleeting story creator with 24-hour auto-expiration.
  - Drafts autosaved in `localStorage`.
* **Full-Screen 24h Story Viewer (`StoryViewerModal.tsx`)**:
  - Multi-segment animated progress bars.
  - Tap left/right to skip segments, hold to pause playback.
  - Direct encrypted quick-reply into sender's Circle chat.
* **Community Circles Browser & Detail (`CircleDetailModal.tsx`)**:
  - Search and filter circles by name, category, and rules.
  - Join / leave toggle, member roster, zero-tracking guarantee card.
* **Post Action Context Menu (`PostActionMenu.tsx`)**:
  - Save to bookmarks, copy link, share to circle, mute user, unfollow, not interested, and report. Author actions: edit caption, pin to profile, toggle comments, delete.
* **Author Profile Modal (`AuthorProfileModal.tsx`)**:
  - View posts, reels, followers/following count, follow/unfollow toggle, direct encrypted chat trigger.
* **Comments Bottom Sheet (`CommentsBottomSheet.tsx`)**:
  - Slide-up bottom sheet with threaded comments, timestamps, and deletion.

---

## 4. UI Shell, Layout & Accessibility (A8, A9, A10, A11)

* **Mutually Exclusive Desktop Dropdowns (A8)**:
  - Opening "More spaces" automatically closes the profile menu, and vice versa.
  - Click-outside and `Esc` key listeners with focus return to trigger elements. Proper ARIA attributes (`aria-haspopup="menu"`, `aria-expanded`).
* **Mobile "All Spaces" Bottom Sheet (A9)**:
  - Converted from centered modal to a bottom sheet with drag detent.
  - Includes **Planner** (`/planner`) and **Settings** (`/settings`) alongside Samaj, Vault, AI, Growth, and Security.
* **WCAG AA Glass Contrast (A10)**:
  - `.liquid-glass` upgraded to 88–94% surface opacity, achieving > 4.5:1 text contrast in Light, Dark, and AMOLED modes.
  - High-contrast encryption badge text (`text-emerald-800 dark:text-emerald-300`).
* **Rich Empty States (A11)**:
  - Dedicated illustration, concise explanation, and primary action button for all empty views across Stories, Circles, and Feeds.

---

## 5. Verification & QA Status

* **Frontend Unit & Regression Tests**: 6 test files, 37 tests passing (`npm test`).
* **Backend Security & Core Tests**: 13 tests passing (`python manage.py test core`).
* **Production Build**: Verified with Vite production bundling (`npm run build`).
