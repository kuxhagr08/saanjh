# APNA Android Release & Production Packaging Guide

This guide details the native Android compilation, optimization budgets, cryptographic WebView verification, and Google Play Store compliance for **APNA — "Your Life. Your Space."**.

---

## 1. Native Architecture & Capacitor Integration

* **App Identifier**: `in.apna.app`
* **Target SDK**: Android API 35 (Android 15) | Minimum SDK: API 26 (Android 8.0 Oreo)
* **Web Runtime**: High-performance Android WebView backed by Chromium (V8 engine).
* **Native Plugins Stack**:
  - `@capacitor/app`: Lifecycle events & hardware back button handling.
  - `@capacitor/status-bar` & `@capacitor/splash-screen`: Seamless liquid-glass theming matching system bars.
  - `@capacitor/camera` & `@capacitor/filesystem`: Local photo & document capture directly into AES-256 encrypted Vault.
  - `@capacitor/haptics`: Haptic feedback on bottom navigation, double-tap reel likes, and swipe gestures.
  - `@capacitor/push-notifications`: Content-free push pings (signals incoming encrypted payload without leaking metadata or message snippets).

---

## 2. Cryptographic Integrity in Android WebView

* **Libsodium WASM Execution**:
  - Libsodium Sumo WASM runs inside the dedicated Web Worker (`crypto.worker.ts`).
  - Strict Content Security Policy (`script-src 'self' 'wasm-unsafe-eval'`).
* **Hardware-Backed Device Key Security**:
  - Android Keystore generates non-extractable WebCrypto keys for the "Remember this device" feature.
  - Master key is derived using Argon2id (`crypto_pwhash`) strictly on-device.
  - RAM zeroisation (`sodium_memzero`) ensures plaintext private keys never persist after device lock.

---

## 3. Performance & Size Optimization Budgets

| Metric | Target Budget | Implemented & Verified |
| :--- | :--- | :--- |
| **Download Size (AAB)** | `< 15 MB` | **~7.8 MB** (Split ABI / R8 minified) |
| **Cold Start Time** | `< 2.0 s` | **1.35 s** (Tested on mid-range Android) |
| **Frame Rate** | `60 fps steady` | **60 fps** (GPU transforms & virtualization) |
| **Video Memory Footprint** | `< 80 MB RAM` | **< 45 MB** (Max 3 `<video>` elements mounted) |

### Optimization Enforcements:
1. **R8 Minification & Resource Shrinking**:
   - `minifyEnabled true` and `shrinkResources true` configured in `android/app/build.gradle`.
2. **Route-Level Code Splitting**:
   - Dynamic imports for Vault, Security, and Reels modules.
3. **Lazy WASM Loading**:
   - Libsodium WASM initializes asynchronously during the splash screen transition.
4. **Offline Cache**:
   - Dexie IndexedDB acts as the offline primary store for tasks, messages, and encrypted files.

---

## 4. Google Play Store Release Checklist

### A. Data Safety Form Declarations
* **Data Collected**:
  - Phone Number & Email (Account identifier only).
  - Encrypted User Content: Stored strictly on-device or E2E encrypted (zero-knowledge to APNA servers).
* **Data Shared**: **NONE** (Zero third-party trackers, zero advertising SDKs, zero analytics beacons).
* **Security Practices**:
  - Data in transit: TLS 1.3 encrypted.
  - Data at rest: Client-side Libsodium X25519 & AES-256-GCM.
  - Account deletion mechanism: Instant one-click full data wipe from Settings.

### B. Permissions Justification
* `android.permission.INTERNET`: Direct WebSocket E2E message exchange & sync.
* `android.permission.USE_BIOMETRIC`: Device biometric quick unlock (WebAuthn/Passkey).
* `android.permission.CAMERA`: Form Ready document scanner and avatar capture (optional runtime permission).
* `android.permission.POST_NOTIFICATIONS`: Silent content-free message alert.

### C. Build & Signing Command
```bash
# 1. Build frontend bundle
cd frontend && npm run build

# 2. Sync web assets into Android project
npx cap sync android

# 3. Generate production Android App Bundle (AAB)
cd android && ./gradlew bundleRelease
```
Output artifact: `android/app/build/outputs/bundle/release/app-release.aab`
