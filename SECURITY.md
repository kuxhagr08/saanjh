# Saanjh — Security & Cryptography Architecture

> **Security Disclosure & Honest Claim:**  
> Saanjh messages and vaults are end-to-end encrypted on-device using `libsodium` (X25519, XSalsa20-Poly1305, Argon2id) and the W3C WebCrypto API. **This software has not been independently audited by a third-party security firm.** We make honest, verifiable claims without marketing exaggeration.

---

## 0. Zero-Storage / Device-Owned Data Principle

User data lives **ONLY** on:
1. The user's own device (in encrypted IndexedDB),
2. The sender's and receiver's devices, or
3. Storage the user explicitly owns (their own Google Drive, Dropbox, S3, or `.apnabackup` file export).

The Saanjh server is a **dumb, short-lived courier**: it holds encrypted bytes in transit for a short time, then immediately deletes them. It is technically impossible for the operator to read user content, and the operator never accumulates user data at rest.

### Honest Disclosures (Section 12)
- *"Your data lives on your device. We cannot recover it if you lose it without a backup."*
- *"Messages are held encrypted for at most 14 days if the other person is offline, then deleted."*
- *"Public and follower posts on Samaj are stored on our servers so others can see them."*
- *"We can still see limited metadata (account, when you are online, delivery timing). See Settings > Privacy Ledger."*
- We never claim "we store nothing" without these explicit qualifiers.

---

## 1. Key Hierarchy & Derivation Architecture

Saanjh isolates cryptographic operations inside a dedicated Web Worker (`crypto.worker.ts`) to prevent the main UI thread from freezing and protect active key material from global scope manipulation.

```
                  ┌────────────────────────┐
                  │     User Password      │
                  └───────────┬────────────┘
                              │
                    Argon2id (Libsodium WASM)
                    (Opslimit: Interactive, Memlimit: 64MB)
                              │
                              ▼
                  ┌────────────────────────┐
                  │     Master Secret      │ (64 bytes in worker memory)
                  └─────┬──────┬─────┬─────┘
                        │      │     │
       ┌────────────────┘      │     └────────────────┐
       │ (Context: 'AuthSecr') │ (Context: 'VaultKEK')│ (Context: 'RecovKey')
       ▼                       ▼                      ▼
┌───────────────┐      ┌───────────────┐      ┌───────────────┐
│  Auth Secret  │      │ Key Encryption│      │ Recovery Key  │
│  (Login KDF)  │      │   Key (KEK)   │      │ (32-byte B64) │
└───────────────┘      └───────┬───────┘      └───────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │     Master Key      │ (Active in Worker Memory)
                    └──────────┬──────────┘
                               │
       ┌───────────────────────┴───────────────────────┐
       ▼                                               ▼
┌─────────────────────────┐               ┌─────────────────────────┐
│     Vault File Keys     │               │    E2E Identity Keys    │
│  (AES-256 Envelope GCM) │               │  (X25519 & Ed25519)     │
└─────────────────────────┘               └─────────────────────────┘
```

### Key Management Policies
1. **No Plaintext Keys in Storage**: Private keys are NEVER stored in `localStorage` or `sessionStorage`.
2. **Buffer Zeroisation**: On device lock, explicit lock, or timeout, buffers in worker memory are wiped (`zeroiseKeyBuffer`).
3. **Non-Extractable Device Key ("Remember this device")**:
   - Stored in IndexedDB (`ApnaDeviceSecurityDB`) with `{ extractable: false }`.
   - The Master Key is re-wrapped with AES-GCM 256-bit using this device key.
   - On page reload or tab reopen, the browser unwraps the session without re-prompting the user.
   - Malicious scripts injected via XSS cannot export the raw device key bytes.
4. **Auto-Lock Inactivity Policies**:
   - `Never`, `1 Day`, `7 Days` (Default), `30 Days`, and `Lock on Close` (Zero persistent wrap on browser close).
5. **Biometric Quick-Unlock**:
   - Implemented via WebAuthn (`navigator.credentials.create` and `navigator.credentials.get`).
   - Supports Touch ID, Windows Hello, and Passkeys without transmitting credentials to the server.

---

## 2. Server Data Allow-List & Block-List (PostgreSQL)

### PostgreSQL Allow-List (`DATA_ALLOWLIST.md`)
The database contains **ONLY**:
- **Account & Auth Verifier**: Account ID, username/handle, Argon2id password hash / OPAQUE verifier record (never the passphrase), discovery settings (`core_user`).
- **Device IDs**: Registered client devices (`core_device`).
- **Public Identity & Prekeys**: Base64 X25519 public identity key, Ed25519 public signing key, and public one-time prekeys (`core_encryptionidentity`, `core_prekeybundle`).
- **Push Tokens**: Device tokens for content-free wake-up notifications (`core_pushtoken`).
- **Billing Records**: Razorpay customer & subscription IDs, plan name (`core_billingrecord`).
- **Samaj Records**: Public social profiles, follow graph, public feed posts and reel metadata + blob references, comments, 24-hr stories (`core_samaj*`).
- **Safe Share Links**: Token ID, expiration timestamp (max 7 days), ciphertext blob reference, revocation flag (`core_safesharelink`). No keys, no plaintexts, no filenames stored.
- **Abuse & Moderation Records**: User reports and moderation actions (`core_userreport`, `core_moderationaction`).
- **Feature Flags**: Dynamic operational flags (`core_featureflag`).

### PostgreSQL Block-List (Strictly Prohibited)
The server database **NEVER** stores:
- Message text or transcripts (no message table in DB).
- Contacts, address books, or phonebook uploads.
- Personal Vault files, photos, notes, or their metadata (names, tags, EXIF).
- Tasks, habits, planner items, or wellness journals.
- AI prompts, conversation history, or user API keys.
- Search queries, precise locations, or device fingerprints.
- Full IP addresses beyond short-lived (<= 1 hour) rate-limit counters.

**Automated CI Guard**: An automated test (`test_data_allowlist_ci_drift`) runs in CI and FAILS if any table or column in the application is not present in `DATA_ALLOWLIST.md`.

---

## 3. Messaging: Peer-to-Peer First, Then Ephemeral Mailbox

1. **Direct Path (Both Online)**:
   - WebRTC data channel directly between devices.
   - Server performs only transient WebSocket signaling (never stored).
   - STUN + TURN for NAT traversal. TURN relays only encrypted traffic with zero payload logging.
2. **Ephemeral Mailbox (Recipient Offline)**:
   - Client encrypts end-to-end and posts a ciphertext envelope to recipient's mailbox.
   - Mailbox lives in **Redis with persistence disabled (`save ""` and `appendonly no`)**.
   - Strict size cap: **64 KB maximum per envelope**.
   - Per-item TTL: Default **14 days** (max 30 days).
   - **Immediate Hard Deletion**: Deleted permanently upon recipient delivery acknowledgment (`POST /api/mailbox/ack/`).
3. **Sender Outbox**:
   - The sender's device stores the message in local Dexie IndexedDB until it gets a delivery acknowledgment.
   - If the 14-day TTL expires undelivered, sender's UI shows "Not delivered, retry" and the message stays on sender device.
   - The server never becomes the archive.
4. **Receipts & Presence**:
   - Read receipts, typing indicators, and presence pings are ephemeral events in volatile memory (TTL seconds), never stored in Postgres.
5. **Push Notifications**:
   - Content-free wake-up pings (e.g. `{"type": "sync"}`). Zero message text, zero sender names.

---

## 4. Chat Files, Media & Safe Share

- **P2P Transfer Default**: Direct chunked transfer over WebRTC data channels with backpressure, resume, and per-file keys sent inside the E2E message.
- **Offline Fallback**: Temporary encrypted ciphertext blob uploaded to object storage with 72-hour TTL (user selectable 24h to 7d). Deleted immediately on recipient ack. Free cap: 25 MB/file, 200 MB/user/day.
- **EXIF Stripping**: EXIF metadata is stripped client-side before sending. Media is compressed on-device before transmission.
- **Safe Share**: Decryption key and original filename are placed in the URL `#fragment`, which browsers never send to the server. Max 7 days TTL or immediate revocation.

---

## 5. User-Owned Backup & Restore

Because the server stores zero user data, losing a device means losing data unless a backup exists:
1. **Encrypted Backup File (`.apnabackup`) [P0]**:
   - Complete export of messages, vault, notes, tasks, habits, and contacts.
   - Encrypted on-device using Argon2id key derivation and libsodium secretbox with random salt.
   - Signed integrity checksum prevents tampering or corruption.
   - Completely client-side: never uploaded to Saanjh servers.
2. **Security Center Warning**:
   - Displays real-time backup status (`Last backup: Never` or timestamp).
   - Prominently warns: *"If you lose this phone without a backup, we cannot recover your data. We do not have it."*
3. **Device-to-Device Transfer (QR + WebRTC)**:
   - Direct encrypted transfer between devices for phone upgrades.

---

## 6. Settings > Privacy Ledger (Live Transparency)

Located in `Settings > Privacy Ledger`:
- Shows per-feature breakdown:
  - Stored on: User device / In-transit / Our server.
  - Exact retention period.
  - Plaintext access: 0 bytes.
- Live footprint view: Real-time count of pending envelopes waiting for delivery in ephemeral mailbox, active Safe Share links, and Samaj posts.
- One-click **"Purge Server In-Flight Data"** action.

---

## 7. Automated Enforcement Test Suite

Verified by automated tests in `backend/core/tests.py` and `frontend/src/__tests__/backup.test.ts`:

1. **`test_1_data_allowlist_ci_drift`**: Inspects all Django models/columns against `DATA_ALLOWLIST.md`; asserts zero forbidden tables exist.
2. **`test_2_canary_zero_storage`**: Sends unique canary secrets through features; dumps database and asserts plaintexts appear NOWHERE.
3. **`test_3_delivery_immediate_ack_deletion`**: Alice sends envelope to Bob; Bob acks; asserts envelope key is immediately and permanently deleted.
4. **`test_4_ttl_fake_clock_expiry`**: Simulates clock advancing past 14-day TTL; asserts envelope vanishes from mailbox.
5. **`test_5_redis_persistence_disabled`**: Verifies Redis configuration has RDB snapshots and AOF persistence disabled.
6. **`test_6_quota_tests_size_and_relay_caps`**: Enforces strict 64 KB envelope cap (HTTP 413) and daily relay limits.
7. **`test_7_log_sanitization_no_passphrases_or_tokens`**: Asserts request bodies, passphrases, and tokens are never logged.
8. **`test_8_privacy_ledger_and_purge_endpoint`**: Verifies live footprint accounting and user purge capabilities.
9. **`backup.test.ts` (Vitest)**: Tests `.apnabackup` client-side encryption, integrity verification, wrong passphrase rejection, and corrupted payload detection.
