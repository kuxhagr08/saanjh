# APNA — ZERO-STORAGE / DEVICE-OWNED DATA SPEC

Addendum to `APNA_MASTER_PROMPT.md` and `APNA_FEATURES_V2.md`. If anything conflicts, THIS FILE WINS.

## 0. PRINCIPLE

User data lives ONLY on (a) the user's own device, (b) the sender's and receiver's devices, or (c) storage the USER owns (their own Google Drive/Dropbox/S3/file export). The APNA server is a **dumb, short-lived courier**: it may hold encrypted bytes in transit for a short time, then deletes them. It must be technically impossible for the operator to read user content, and the operator must not accumulate user data at rest.

Goals: (1) users' privacy, (2) near-zero server storage cost, (3) less legal exposure. Every feature must declare in `DATA_MAP.md` where its data lives. A feature that needs server-side storage must be justified there.

## 1. WHERE EVERYTHING LIVES

| Data | Lives on | Server involvement |
|---|---|---|
| Chats, contacts, groups membership lists | Sender + receiver devices | Ephemeral encrypted mailbox only (section 3) |
| Photos, videos, documents, notes (Vault) | User's device (encrypted) | None |
| Inbox, tasks, habits, expenses, journal, calendar, wellness, learning | User's device (encrypted) | None |
| AI chats, AI memory, API keys | User's device (encrypted) | None (device talks to the AI provider directly) |
| APNA Check, Kaam ke Tools (resize, PDF, masking) | On-device processing | None, files never uploaded |
| Safe Share files | Sender's device, or temp ciphertext blob | Temp, auto-deleted (section 5) |
| Backups | User's own storage or exported file | None |
| Samaj public/follower posts | Server (unavoidable, others must see them) | Minimised, see section 7 |
| Account + public keys | Server | Minimal allow-list (section 2) |

## 2. SERVER DATA: ALLOW-LIST AND BLOCK-LIST

**Postgres may contain ONLY:** account id, username/handle, auth verifier (OPAQUE record, never the passphrase), device ids, PUBLIC identity/prekeys, push token, billing ids (Razorpay customer/subscription ids, plan), Samaj records (profile, follow graph, public post metadata + blob reference, comments, reports, moderation actions), Safe Share link records (id, expiry, blob ref, revoke flag, no key), feature-flag list. Nothing else.

**Server must NEVER store:** message text, attachments in readable form, contact lists, address books, Vault files or metadata (names, tags, EXIF), notes, tasks, habits, expenses, journal, AI prompts/answers/keys, search queries, precise location, device fingerprints, request bodies in logs, full IP addresses beyond short-lived rate-limit counters.

**CI guard:** keep `DATA_ALLOWLIST.md` listing every table/column. A test inspects the Django models/migrations and FAILS if a table or column exists that is not on the list.

## 3. MESSAGING: PEER-TO-PEER FIRST, THEN EPHEMERAL MAILBOX

1. **Direct path (both online):** WebRTC data channel between devices. Server only does signalling (transient WebSocket messages, never stored). STUN + TURN for NAT traversal; TURN relays only encrypted traffic; no logging of payloads.
2. **Mailbox path (recipient offline):** sender's client encrypts (end-to-end) and posts a ciphertext envelope to the recipient's mailbox. Mailbox lives in **Redis with persistence disabled (no RDB/AOF)**, with a per-item TTL (default 14 days, max 30). Max 64 KB per envelope. Delete on delivery ack. Verify the Render/Redis plan's persistence setting and document it.
3. **Sender outbox:** the sender's device keeps the message until it gets a delivery ack. If the TTL expires undelivered, the sender sees "Not delivered, retry" and the message stays on the sender's device. The server never becomes the archive.
4. Delivery/read receipts, typing, presence are ephemeral events (memory/Redis TTL seconds), never in Postgres.
5. Push notifications are content-free wake-ups.
6. No server-side chat history. New device: transfer history device-to-device by QR-linked encrypted transfer, or restore from the user's own encrypted backup (section 6). Say this plainly in the UI.

## 4. FILES AND MEDIA IN CHAT

- **Default: peer-to-peer transfer** over WebRTC data channels with chunking, backpressure, resume, progress, and per-file encryption keys sent inside the encrypted message. No size limit when both are online.
- **Fallback when the receiver is offline:** upload an encrypted blob (random id, random per-file key) to object storage with an expiry. Free caps: 25 MB per file, 200 MB per user per day; TTL 72 hours (user can choose 24 h to 7 d); delete immediately after the receiver's ack; lifecycle rule/cron deletes the rest. Larger files: "Wait until X is online" (sender's device serves it via P2P).
- Strip EXIF on send by default. Compress images/videos on the sender's device before sending.
- Receiver's device stores the file locally (encrypted). Nothing remains on the server.

## 5. SAFE SHARE

P2P-first ("send directly" link that works while the sender's device is online) with a temp ciphertext blob fallback (max 7 days, deleted on expiry or revoke). Key stays in the URL `#fragment`. No plaintext, no key, no filename stored server-side (filename travels encrypted inside the blob).

## 6. BACKUP, RESTORE, NEW DEVICE (user-owned storage)

Because the server keeps nothing, losing a phone means losing data unless a backup exists. Make backup easy and impossible to miss:
- **Encrypted backup file** (`.apnabackup`) export/import (P0).
- **Bring Your Own Storage** (P1): user connects their own Google Drive (app-data folder scope), Dropbox app folder, WebDAV or S3-compatible bucket; APNA uploads client-side-encrypted backups there. APNA's server never sees the data or the storage credentials (tokens stored in the encrypted device vault).
- **Device-to-device transfer** (QR + WebRTC) for new phones.
- Onboarding and Security Center must show a backup status ("Last backup: never") with persistent but non-annoying nudges, and a clear warning: "If you lose this phone without a backup, we cannot recover your data. We do not have it."

## 7. SAMAJ (SOCIAL) — THE HONEST EXCEPTION

Public and follower posts must be visible when the author is offline, so some content must live on a server. Minimise it:
- Server stores only what others must see; everything else on devices.
- **Close Friends / Circle posts:** end-to-end encrypted and delivered like chat (P2P + ephemeral mailbox), not stored.
- Stories: 24-hour expiry then hard delete.
- Photos: compress on device (WebP/AVIF, max ~1600 px). Video: 60 s, 720p, 50 MB cap, transcode once, HLS on object storage behind a CDN (egress-free storage preferred).
- Per-user quotas (free: e.g., 500 MB total); older posts can be **auto-archived to the author's device** after N days (default off; offered to the user), with the server copy deleted unless pinned.
- Author can delete anytime; deletion removes blobs and CDN copies. Comments, reactions, follows are small rows.
- Moderation records are the only user-content-related data the operator must keep (reports, actions). Keep them minimal and time-limited.

## 8. ACCOUNTS, PRESENCE, METADATA, LOGS

- Auth: OPAQUE or equivalent so the server never sees passphrases. Email/phone optional where possible; if used for OTP/alerts, store only what is needed.
- Contacts are device-local; the server does not learn who is in anyone's contact list. Username lookup is by exact match only.
- Metadata is the remaining leak (who messaged whom, when, IP). Minimise: no access-log request bodies, IPs only in short-lived rate-limit counters (hashed, TTL <= 1 h), no analytics SDKs, no third-party trackers, sealed-sender-style delivery as a P2 item. State what remains visible in `SECURITY.md`.
- Legal note: Indian rules may require retaining some system logs for a period. Keep any such logs separate, minimal, free of content, and have a lawyer confirm the exact requirement before launch.

## 9. COST GUARDRAILS

P2P-first keeps server cost near zero. Main costs: TURN relay bandwidth, Samaj media storage/CDN, the small Postgres. Provide: per-user and per-day relay quotas, higher caps for Pro, admin cost dashboard, alerts when storage or TURN bandwidth crosses thresholds, and automatic cleanup jobs with monitoring.

## 10. UI: PRIVACY LEDGER

Settings > Privacy Ledger shows, per feature, in simple Hindi/English: "Stored on: this device / in transit (auto-deleted in X) / our server", the exact retention time, and a live view of what the server currently holds for this user (e.g., "3 messages waiting for Riya, expire in 12 days"). Each row links to export/delete.

## 11. ENFORCEMENT (must be implemented and tested)

1. `DATA_MAP.md` (every feature -> where data lives -> retention) and `DATA_ALLOWLIST.md` (every table/column). CI fails on drift.
2. **Canary test:** send unique canary strings and files through EVERY feature (chat text, attachments, notes, vault, inbox, tasks, AI, Safe Share, search), then dump Postgres, Redis, object storage and application logs and assert the canaries appear NOWHERE (ciphertext containing no plaintext is acceptable only while within the TTL window).
3. **Delivery test:** A sends to B, B acks, assert the mailbox key and the blob are gone immediately.
4. **TTL test (fake clock):** undelivered envelope and blob vanish at expiry; sender is notified; message stays on sender device.
5. **Redis persistence test:** config check proves RDB/AOF disabled for the mailbox instance.
6. **Quota tests:** size and daily relay caps enforced server-side.
7. **Log test:** no request bodies, no full IPs, no tokens in logs.
8. **Backup tests:** export/import restores everything; BYO-storage upload contains only ciphertext.
9. **Offline/new-device test:** history transfer device-to-device works.
10. Report results using three lists: IMPLEMENTED+TESTED, IMPLEMENTED BUT UNTESTED, DOCUMENTED ONLY. Paste raw command output as proof.

## 12. WHAT THE UI AND DOCS MUST SAY HONESTLY

- "Your data lives on your device. We cannot recover it if you lose it without a backup."
- "Messages are held encrypted for at most N days if the other person is offline, then deleted."
- "Public and follower posts on Samaj are stored on our servers so others can see them."
- "We can still see limited metadata (account, when you are online, delivery timing). See Privacy Ledger."
- Never claim "we store nothing" without these qualifiers.

**Phase placement:** implement sections 2, 3, 6 (file export), 11 in Phase 1-3 BEFORE building chat or Samaj features further; sections 4, 5, 7, 10 with their modules; BYO-storage in P1.

