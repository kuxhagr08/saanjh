# APNA — Complete Data Map (`DATA_MAP.md`)

> **Governing Principle:** User data lives strictly on the user's device, between communicating peers, or on storage the user explicitly owns. The APNA server is a blind, ephemeral relay with zero data accumulation at rest.

---

## 1. Feature-by-Feature Data Map

| # | Feature / Data Domain | Primary Storage Location | Server Involvement | Retention Period | Cryptographic Protection | Server Storage Justification |
|---|---|---|---|---|---|---|
| **1** | **Direct Chats (1-to-1)** | Sender & Receiver Devices (IndexedDB) | Ephemeral Mailbox (Redis, no persistence) when offline | Max 14 days (deleted immediately upon delivery ack) | End-to-end authenticated encryption (`libsodium` X25519 + XSalsa20-Poly1305) | Transmit in-flight messages when recipient is offline. Never archived on server. |
| **2** | **Group Chats & Memberships** | Member Devices (IndexedDB) | Ephemeral Fanout Mailbox | Max 14 days (deleted immediately on recipient delivery ack) | Pairwise/Sender-Key E2E encrypted envelopes | Transient relay only. Membership state maintained on-device. |
| **3** | **Chat Media & Attachments** | Sender & Receiver Devices (Encrypted local storage) | P2P direct WebRTC data channels; temporary encrypted blob if offline | 72 hours max (deleted immediately upon recipient delivery ack) | AES-256-GCM / libsodium per-file key exchanged inside E2E envelope | Offline delivery buffer. Zero plaintext or metadata stored. |
| **4** | **Voice Notes & Audio** | Sender & Receiver Devices (Encrypted local storage) | P2P direct; temporary ciphertext blob if offline | 72 hours max (deleted on delivery ack) | E2E encrypted payload | Offline delivery buffer only. |
| **5** | **Audio & Video Calls** | Device volatile memory only | WebSocket transient signaling only; WebRTC STUN/TURN | 0 seconds (in-memory relay, no logs, no storage) | DTLS-SRTP end-to-end encrypted media streams | Real-time peer-to-peer connection establishment. |
| **6** | **Contacts & Address Book** | User Device only (IndexedDB) | None (zero contact book uploads) | Permanent on device until user deletes | Client-side IndexedDB | Server never learns user's social graph. Exact username lookup only. |
| **7** | **Personal Vault (Files, Photos, Docs)** | User Device only (IndexedDB) | None (never uploaded to server) | Permanent on device | Envelope encryption: AES-256-GCM + PBKDF2/Argon2id wrapped master key | **Zero server involvement.** Completely device-owned. |
| **8** | **Personal Notes** | User Device only (IndexedDB) | None | Permanent on device | Client-side encrypted in IndexedDB | **Zero server involvement.** Completely device-owned. |
| **9** | **Planner, Tasks & Habits** | User Device only (IndexedDB) | None | Permanent on device | Client-side IndexedDB | **Zero server involvement.** Completely device-owned. |
| **10** | **Wellness, Mood & Growth** | User Device only (IndexedDB) | None | Permanent on device | Client-side IndexedDB | **Zero server involvement.** Completely device-owned. |
| **11** | **AI Assistant (Chats & Memory)** | User Device only (IndexedDB) | None (Device talks to AI model provider directly with user's BYOK key) | Permanent on device | Keys stored in non-extractable device keystore | **Zero server involvement.** Model requests bypass APNA servers entirely. |
| **12** | **APNA Check (Anti-Scam AI)** | User Device only (WebAssembly / Regex) | None (analyzed purely on-device) | Transient during scan | Local execution | **Zero server involvement.** Files and texts never leave device. |
| **13** | **Kaam ke Tools (PDF/Image Resizer)** | User Device only (Browser Canvas / WASM) | None | 0 seconds (processed in memory) | Sandboxed in browser memory | **Zero server involvement.** Zero file uploads. |
| **14** | **Safe Share** | Sender Device (P2P direct) or Temp Ciphertext Blob | Temp ciphertext blob storage (no keys, no filenames) | Chosen by sender: 1h to 7 days max, or deleted immediately on revoke | Ciphertext only; decryption key remains in URL `#fragment` | Allows asynchronous recipient downloads without sender staying online. |
| **15** | **User Backups (`.apnabackup`)** | User's local file download or user's BYO cloud (Google Drive, Dropbox, S3) | None (APNA server never receives or stores backups) | Managed by user | Client-side Argon2id + AES-256-GCM encrypted backup archive | **Zero server involvement.** Eliminates operator data accumulation. |
| **16** | **Samaj Public & Follower Posts** | Server Object Storage + CDN | Server stores public post metadata and media blob | Author-controlled; optional auto-archive to author's device after N days | Public / follower content; signed author identity | **Honest Exception:** Public and follower content must be viewable when creator is offline. |
| **17** | **Samaj Circle / Close Friends** | Author & Friend Devices (IndexedDB) | Ephemeral Mailbox (Redis, no persistence) | 24 hours max (deleted on delivery) | End-to-end encrypted to Circle members | Ephemeral private sharing. Zero long-term server storage. |
| **18** | **Samaj Stories** | Server Object Storage + CDN | Temporary storage for 24 hours | 24 hours strict TTL (hard-deleted upon expiry) | Compressed WebP/video | Stories are ephemeral social updates viewable across time zones. |
| **19** | **Account Credentials & Keys** | Server Database (Postgres) | Minimal allowlisted tables (`core_user`, `core_encryptionidentity`, `core_prekeybundle`) | Active account lifetime | Argon2id verifier (never passphrase); public keys only | Necessary for authentication, routing, and asynchronous X3DH key exchange. |
| **20** | **Push Tokens** | Server Database (Postgres) | Content-free wake-up dispatch | Until device deregistered | Tokens only; push notifications contain zero content | Background wake-up for device-to-device synchronization. |
| **21** | **Billing & Subscriptions** | Server Database (Postgres) | Minimal billing ids (Razorpay customer ID, subscription ID, plan name) | Active subscription lifetime | Handled via PCI-compliant payment provider | Necessary to grant Pro tier rate limits and features. |
| **22** | **Abuse Reports & Moderation** | Server Database (Postgres) | Stores report reasons, reported user IDs, and moderation actions | Maximum 90 days audit window | Minimal metadata, zero message transcript dumps | Required for legal compliance and combating spam/abuse. |

---

## 2. Server Block-List (Strictly Prohibited Server-Side Artifacts)

The APNA backend server, its databases, Redis instances, object stores, and logs are **strictly prohibited** from ever storing:
1. **Plaintext message content** or transcripts.
2. **Contact lists**, address books, or phonebook uploads.
3. **Vault files, notes, documents, or their plaintext filenames and tags**.
4. **AI prompts, conversations, summaries, or third-party AI API keys**.
5. **Private encryption or signing keys** (X25519 private keys, Ed25519 seed keys, master vault keys).
6. **Task lists, habits, journals, or personal health/wellness data**.
7. **User location history** or GPS coordinates.
8. **Request bodies in application access logs**.
9. **Full IP addresses** beyond short-lived (<= 1 hr) rate-limit buckets.
10. **Device fingerprints** or intrusive telemetry.

