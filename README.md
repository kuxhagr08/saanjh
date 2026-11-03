# APNA — Your Life. Your Space.

> **Privacy-first, local-first personal digital ecosystem for ordinary people tired of juggling fragmented, surveillance-driven apps.**

---

## 💎 Core Philosophy & Guarantees

1. **User Data Belongs to the User**: By default, data lives on the user's device in IndexedDB, encrypted.
2. **Blind Relay Architecture**: The backend server never sees plaintext messages, files, API keys, or notes.
3. **Bring Your Own Key (BYOK) AI**: API keys for AI models (Gemini, OpenAI) are saved client-side and sent directly from the browser to the model provider, never stored or logged on our servers.
4. **Anti-Doomscroll Design**: Mindful, calm, and deliberate. No psychological gambling loops, autoplay sound, or addictive metrics.

---

## 🛠️ Technology Stack

- **Frontend**:
  - React 19 + TypeScript + Vite
  - Tailwind CSS + Framer Motion
  - Dexie.js (IndexedDB local-first storage)
  - `libsodium-wrappers` (X25519 authenticated public-key messaging, Argon2id derivation)
  - Web Cryptography API (`crypto.subtle` AES-256-GCM envelope encryption for Vault files)
  - Installable Progressive Web App (PWA) manifest & icons
- **Backend**:
  - Python 3.12 / 3.14 + Django 5.2 LTS
  - Django REST Framework + SimpleJWT
  - Django Channels + Daphne ASGI (WebSockets)
  - Argon2id password hashing
  - WhiteNoise static assets handling
  - PostgreSQL ready (`dj-database-url` support)
- **Deployment**:
  - Render blueprint (`render.yaml`) with migration build step and `/api/health/` probe.

---

## 🚀 Getting Started

### 1. Prerequisites
- Python 3.12+ (or 3.14)
- Node.js 18+ and npm

### 2. Backend Setup
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python -m daphne -b 127.0.0.1 -p 8000 config.asgi:application
```

The API and WebSockets will be live at `http://127.0.0.1:8000/`. Health check is at `http://127.0.0.1:8000/api/health/`.

### 3. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5173/` in your browser.

---

## 🧪 Automated Testing

Run the automated backend test suite:
```bash
cd backend
./venv/bin/python manage.py test core
```

Tests verify:
- Argon2id default password hashing
- Session authentication & JWT generation
- Client-side public identity key publishing
- Strict cross-user message isolation
- Message delivery receipts & recipient acknowledgments

---

## 🛡️ Security & Cryptography Disclosure

- **E2E Cryptography**: Built on `libsodium` using X25519 key exchange, Ed25519 signing, and `crypto_box` authenticated encryption. It is not independently audited by a third party.
- **Envelope Encryption**: Vault files use AES-256-GCM with unique random 96-bit nonces per file, with file keys wrapped by a master key derived using PBKDF2 (600,000 rounds) or Argon2id.
- **Server Visibility**: The server can only observe delivery timestamps, conversation participants, and encrypted payload byte sizes.
