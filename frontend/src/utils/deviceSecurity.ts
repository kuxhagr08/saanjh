/**
 * Non-extractable WebCrypto Device Security & Auto-Lock Manager.
 *
 * Architecture:
 * - Generates an AES-GCM 256-bit CryptoKey with { extractable: false }.
 * - Non-extractable keys in IndexedDB CANNOT be inspected or exfiltrated by XSS/scripts.
 * - Wraps the Argon2id Master Key on-device so page reloads do NOT require entering passwords again.
 * - Enforces configurable idle auto-lock policies (never, 1d, 7d, 30d, lock-on-close).
 * - Supports WebAuthn biometric unlock (Face ID / Touch ID / Windows Hello).
 */

import { workerSetMasterKey, workerLock, workerDeriveLoginKeys } from './cryptoWorkerClient';

const DB_NAME = 'ApnaDeviceSecurityDB';
const DB_VERSION = 1;

export interface DeviceLockConfig {
  rememberDevice: boolean;
  idleTimeoutMinutes: number; // 0 = never, 1440 = 1 day, 10080 = 7 days, 43200 = 30 days, -1 = lock on close
  lastActiveTimestamp: number;
  isLocked: boolean;
  biometricEnabled: boolean;
  biometricCredentialId?: string;
}

export const DEFAULT_LOCK_CONFIG: DeviceLockConfig = {
  rememberDevice: true,
  idleTimeoutMinutes: 10080, // 7 days default
  lastActiveTimestamp: Date.now(),
  isLocked: false,
  biometricEnabled: false,
};

function openSecurityDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('device_keys')) {
        db.createObjectStore('device_keys', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('wrapped_session')) {
        db.createObjectStore('wrapped_session', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('config')) {
        db.createObjectStore('config', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Returns or generates a NON-EXTRACTABLE WebCrypto AES-GCM 256-bit Device Key.
 * Non-extractable means raw key bytes cannot be read via JavaScript/XSS.
 */
export async function getOrGenerateDeviceKey(): Promise<CryptoKey> {
  const db = await openSecurityDB();
  const tx = db.transaction('device_keys', 'readwrite');
  const store = tx.objectStore('device_keys');

  const existing = await new Promise<any>((resolve) => {
    const getReq = store.get('primary_device_key');
    getReq.onsuccess = () => resolve(getReq.result);
    getReq.onerror = () => resolve(null);
  });

  if (existing?.key instanceof CryptoKey) {
    return existing.key;
  }

  // Generate random 256-bit AES-GCM key with extractable: false
  const key = await window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false, // NON-EXTRACTABLE!
    ['encrypt', 'decrypt']
  );

  await new Promise<void>((resolve, reject) => {
    const putReq = store.put({ id: 'primary_device_key', key });
    putReq.onsuccess = () => resolve();
    putReq.onerror = () => reject(putReq.error);
  });

  return key;
}

export async function saveDeviceConfig(config: Partial<DeviceLockConfig>): Promise<DeviceLockConfig> {
  const db = await openSecurityDB();
  const current = await getDeviceConfig();
  const merged: DeviceLockConfig = { ...current, ...config };

  const tx = db.transaction('config', 'readwrite');
  const store = tx.objectStore('config');
  await new Promise<void>((resolve, reject) => {
    const putReq = store.put({ id: 'lock_config', ...merged });
    putReq.onsuccess = () => resolve();
    putReq.onerror = () => reject(putReq.error);
  });

  return merged;
}

export async function getDeviceConfig(): Promise<DeviceLockConfig> {
  try {
    const db = await openSecurityDB();
    const tx = db.transaction('config', 'readonly');
    const store = tx.objectStore('config');

    const res = await new Promise<any>((resolve) => {
      const getReq = store.get('lock_config');
      getReq.onsuccess = () => resolve(getReq.result);
      getReq.onerror = () => resolve(null);
    });

    if (res) {
      return {
        rememberDevice: res.rememberDevice ?? true,
        idleTimeoutMinutes: res.idleTimeoutMinutes ?? 10080,
        lastActiveTimestamp: res.lastActiveTimestamp ?? Date.now(),
        isLocked: res.isLocked ?? false,
        biometricEnabled: res.biometricEnabled ?? false,
        biometricCredentialId: res.biometricCredentialId,
      };
    }
  } catch (e) {
    console.warn('[APNA DeviceSecurity] DB read fallback:', e);
  }

  return { ...DEFAULT_LOCK_CONFIG };
}

/**
 * Encrypts and saves the Master Key using the Non-Extractable Device Key.
 * Called once at Login / Signup.
 */
export async function persistMasterKeyToDevice(
  masterKeyBase64: string,
  identityKeys?: any,
  rememberDevice: boolean = true
): Promise<void> {
  if (!rememberDevice) {
    await clearDeviceSession();
    return;
  }

  const deviceKey = await getOrGenerateDeviceKey();
  const encoder = new TextEncoder();

  const payload = JSON.stringify({
    masterKeyBase64,
    identityKeys,
    savedAt: Date.now(),
  });

  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    deviceKey,
    encoder.encode(payload)
  );

  const db = await openSecurityDB();
  const tx = db.transaction(['wrapped_session', 'config'], 'readwrite');

  tx.objectStore('wrapped_session').put({
    id: 'active_session',
    ciphertext,
    iv,
  });

  const currentCfg = await getDeviceConfig();
  tx.objectStore('config').put({
    id: 'lock_config',
    ...currentCfg,
    rememberDevice: true,
    lastActiveTimestamp: Date.now(),
    isLocked: false,
  });

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export type RestoreSessionResult =
  | { status: 'UNLOCKED'; masterKeyBase64: string; identityKeys?: any }
  | { status: 'LOCKED'; reason: 'EXPLICIT_LOCK' | 'IDLE_TIMEOUT' | 'LOCK_ON_CLOSE'; biometricAvailable: boolean }
  | { status: 'NO_SESSION' };

/**
 * Attempts to automatically unwrap the Master Key on reload/tab reopen.
 * Enforces idle auto-lock policies cleanly.
 */
export async function restoreDeviceSession(): Promise<RestoreSessionResult> {
  try {
    const config = await getDeviceConfig();
    const db = await openSecurityDB();

    const tx = db.transaction('wrapped_session', 'readonly');
    const store = tx.objectStore('wrapped_session');

    const record = await new Promise<any>((resolve) => {
      const getReq = store.get('active_session');
      getReq.onsuccess = () => resolve(getReq.result);
      getReq.onerror = () => resolve(null);
    });

    if (!record || !record.ciphertext) {
      return { status: 'NO_SESSION' };
    }

    // Check lock policies
    if (config.isLocked) {
      return {
        status: 'LOCKED',
        reason: 'EXPLICIT_LOCK',
        biometricAvailable: !!config.biometricEnabled,
      };
    }

    if (config.idleTimeoutMinutes === -1) {
      // Lock on close policy
      return {
        status: 'LOCKED',
        reason: 'LOCK_ON_CLOSE',
        biometricAvailable: !!config.biometricEnabled,
      };
    }

    if (config.idleTimeoutMinutes > 0) {
      const idleMs = Date.now() - config.lastActiveTimestamp;
      const maxMs = config.idleTimeoutMinutes * 60 * 1000;
      if (idleMs > maxMs) {
        await saveDeviceConfig({ isLocked: true });
        return {
          status: 'LOCKED',
          reason: 'IDLE_TIMEOUT',
          biometricAvailable: !!config.biometricEnabled,
        };
      }
    }

    // Unwrap with Non-Extractable Device Key
    const deviceKey = await getOrGenerateDeviceKey();
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: record.iv },
      deviceKey,
      record.ciphertext
    );

    const decoder = new TextDecoder();
    const data = JSON.parse(decoder.decode(decryptedBuffer));

    // Load into Worker memory immediately
    await workerSetMasterKey(data.masterKeyBase64, data.identityKeys);

    // Update active timestamp
    await saveDeviceConfig({ lastActiveTimestamp: Date.now() });

    return {
      status: 'UNLOCKED',
      masterKeyBase64: data.masterKeyBase64,
      identityKeys: data.identityKeys,
    };
  } catch (err) {
    console.warn('[APNA DeviceSecurity] Restore session error:', err);
    return { status: 'NO_SESSION' };
  }
}

/**
 * Explicitly locks the device vault without logging out.
 */
export async function lockDevice(): Promise<void> {
  await workerLock();
  await saveDeviceConfig({ isLocked: true });
}

/**
 * Unlocks the vault using the user's password.
 */
export async function unlockWithPassword(password: string, saltBase64?: string): Promise<boolean> {
  const derived = await workerDeriveLoginKeys(password, saltBase64);
  if (!derived?.masterKeyBase64) return false;

  await saveDeviceConfig({
    isLocked: false,
    lastActiveTimestamp: Date.now(),
  });

  return true;
}

/**
 * Clears wrapped keys upon logout.
 */
export async function clearDeviceSession(): Promise<void> {
  try {
    const db = await openSecurityDB();
    const tx = db.transaction(['wrapped_session', 'config'], 'readwrite');
    tx.objectStore('wrapped_session').delete('active_session');
    tx.objectStore('config').put({ id: 'lock_config', ...DEFAULT_LOCK_CONFIG });
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch (e) {
    // ignore
  }
}

/**
 * Touch activity updater (throttled).
 */
let lastUpdate = 0;
export function markDeviceActive(): void {
  const now = Date.now();
  if (now - lastUpdate > 30000) {
    // update every 30s max
    lastUpdate = now;
    saveDeviceConfig({ lastActiveTimestamp: now }).catch(() => {});
  }
}

/**
 * Configure idle auto-lock timeout.
 * Options:
 * - 0: Never
 * - 1440: 1 day
 * - 10080: 7 days
 * - 43200: 30 days
 * - -1: Lock on close (shared devices)
 */
export async function setIdleTimeoutPreference(minutes: number): Promise<void> {
  await saveDeviceConfig({ idleTimeoutMinutes: minutes });
}

export async function getIdleTimeoutPreference(): Promise<number> {
  const config = await getDeviceConfig();
  return config.idleTimeoutMinutes;
}

/**
 * Biometric enrollment via WebAuthn (Passkey / Touch ID / Face ID).
 */
export async function toggleBiometricQuickUnlock(enable: boolean): Promise<boolean> {
  if (!enable) {
    await saveDeviceConfig({ biometricEnabled: false, biometricCredentialId: undefined });
    return false;
  }

  if (!window.PublicKeyCredential) {
    throw new Error('WebAuthn biometrics is not supported on this browser or platform.');
  }

  try {
    const challenge = window.crypto.getRandomValues(new Uint8Array(32));
    const userId = window.crypto.getRandomValues(new Uint8Array(16));

    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'APNA Sovereign Platform', id: window.location.hostname },
        user: {
          id: userId,
          name: 'apna_device_user',
          displayName: 'APNA User',
        },
        pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
        },
        timeout: 60000,
      },
    })) as PublicKeyCredential;

    if (credential) {
      await saveDeviceConfig({
        biometricEnabled: true,
        biometricCredentialId: credential.id,
      });
      return true;
    }
    return false;
  } catch (err: any) {
    console.warn('[APNA WebAuthn] Biometric enrollment error:', err);
    throw new Error(err.message || 'Biometric authentication was cancelled or unavailable.');
  }
}

/**
 * Quick-unlock using WebAuthn biometrics.
 */
export async function quickUnlockWithBiometrics(): Promise<boolean> {
  if (!window.PublicKeyCredential) return false;
  const config = await getDeviceConfig();
  if (!config.biometricEnabled) return false;

  try {
    const challenge = window.crypto.getRandomValues(new Uint8Array(32));
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        timeout: 60000,
        userVerification: 'required',
      },
    });

    if (assertion) {
      await saveDeviceConfig({
        isLocked: false,
        lastActiveTimestamp: Date.now(),
      });
      return true;
    }
    return false;
  } catch (err) {
    console.warn('[APNA WebAuthn] Biometric assertion error:', err);
    return false;
  }
}
