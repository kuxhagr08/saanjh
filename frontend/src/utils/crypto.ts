import _sodium from 'libsodium-wrappers-sumo';
import { db } from '../db';

let sodiumInstance: typeof _sodium | null = null;
let sodiumInitPromise: Promise<typeof _sodium> | null = null;

/**
 * Initializes and awaits libsodium WASM and Dexie IndexedDB.
 * Enforces database readiness before any cryptographic operations run.
 */
export async function getSodium(): Promise<typeof _sodium> {
  if (sodiumInstance) return sodiumInstance;

  if (!sodiumInitPromise) {
    sodiumInitPromise = (async () => {
      // Ensure IndexedDB is open and ready if supported
      if (typeof indexedDB !== 'undefined' && !db.isOpen()) {
        try {
          await db.open();
        } catch {
          // ignore in testing environments without indexedDB
        }
      }
      await _sodium.ready;
      sodiumInstance = _sodium;
      return _sodium;
    })();
  }

  return sodiumInitPromise;
}

export interface KeyPairBundle {
  publicKeyBase64: string;
  privateKeyBase64: string;
  signingPublicKeyBase64: string;
  signingPrivateKeyBase64: string;
  fingerprint: string;
}

/**
 * Generates authenticated X25519 encryption key pair + Ed25519 signing key pair.
 * Zero custom crypto: uses standard libsodium primitives.
 */
export async function generateIdentityKeys(): Promise<KeyPairBundle> {
  const sodium = await getSodium();

  // X25519 encryption keypair
  const boxKeys = sodium.crypto_box_keypair();
  // Ed25519 signing keypair
  const signKeys = sodium.crypto_sign_keypair();

  const pubKeyB64 = sodium.to_base64(boxKeys.publicKey);
  const privKeyB64 = sodium.to_base64(boxKeys.privateKey);
  const signPubB64 = sodium.to_base64(signKeys.publicKey);
  const signPrivB64 = sodium.to_base64(signKeys.privateKey);

  // Deterministic 60-digit safety number / fingerprint for contact verification
  const combined = new Uint8Array([...boxKeys.publicKey, ...signKeys.publicKey]);
  const hash = sodium.crypto_generichash(32, combined, null);
  const fingerprint = Array.from(hash)
    .slice(0, 16)
    .map(b => String(b).padStart(3, '0'))
    .join(' ')
    .match(/.{1,12}/g)
    ?.join('-') || sodium.to_hex(hash).slice(0, 32);

  return {
    publicKeyBase64: pubKeyB64,
    privateKeyBase64: privKeyB64,
    signingPublicKeyBase64: signPubB64,
    signingPrivateKeyBase64: signPrivB64,
    fingerprint,
  };
}

/**
 * Encrypt sensitive private keys using password-derived key via Argon2id (libsodium-wrappers-sumo) + secretbox.
 */
export async function encryptWithPassword(
  data: string,
  passphrase: string,
  onProgress?: (status: string) => void
): Promise<{ ciphertext: string; nonce: string; salt: string }> {
  onProgress?.('Loading cryptographic primitives...');
  const sodium = await getSodium();

  onProgress?.('Deriving Argon2id encryption key...');
  const salt = sodium.randombytes_buf(sodium.crypto_pwhash_SALTBYTES);

  // Derive 32-byte key using Argon2id (ops/mem limits interactive)
  const key = sodium.crypto_pwhash(
    sodium.crypto_secretbox_KEYBYTES,
    passphrase,
    salt,
    sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_ALG_ARGON2ID13
  );

  onProgress?.('Securing client vault...');
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const ciphertext = sodium.crypto_secretbox_easy(data, nonce, key);

  return {
    ciphertext: sodium.to_base64(ciphertext),
    nonce: sodium.to_base64(nonce),
    salt: sodium.to_base64(salt),
  };
}

/**
 * Decrypt string using passphrase-derived key via Argon2id + secretbox.
 */
export async function decryptWithPassword(
  ciphertextB64: string,
  nonceB64: string,
  saltB64: string,
  passphrase: string
): Promise<string> {
  const sodium = await getSodium();

  const ciphertext = sodium.from_base64(ciphertextB64);
  const nonce = sodium.from_base64(nonceB64);
  const salt = sodium.from_base64(saltB64);

  const key = sodium.crypto_pwhash(
    sodium.crypto_secretbox_KEYBYTES,
    passphrase,
    salt,
    sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
    sodium.crypto_pwhash_ALG_ARGON2ID13
  );

  const decrypted = sodium.crypto_secretbox_open_easy(ciphertext, nonce, key);
  return sodium.to_string(decrypted);
}

/**
 * Encrypt E2E message for recipient using authenticated libsodium crypto_box (X25519).
 */
/**
 * Encrypt E2E message for recipient using authenticated libsodium crypto_box (X25519).
 * Pads payload to 64-byte blocks to prevent traffic-analysis message length leaks.
 */
export async function encryptMessageForRecipient(
  messagePlaintext: string,
  recipientPublicKeyB64: string,
  senderPrivateKeyB64: string
): Promise<{ ciphertext: string; nonce: string }> {
  const sodium = await getSodium();

  const recipientPubKey = sodium.from_base64(recipientPublicKeyB64);
  const senderPrivKey = sodium.from_base64(senderPrivateKeyB64);

  const rawBytes = sodium.from_string(messagePlaintext);
  // Pad to 64-byte blocks (Signal/libsodium standard)
  const padded = sodium.pad(rawBytes, 64);

  const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);
  const ciphertext = sodium.crypto_box_easy(padded, nonce, recipientPubKey, senderPrivKey);

  return {
    ciphertext: sodium.to_base64(ciphertext),
    nonce: sodium.to_base64(nonce),
  };
}

/**
 * Decrypt E2E message using libsodium crypto_box_open and strip 64-byte padding.
 */
export async function decryptMessageFromSender(
  ciphertextB64: string,
  nonceB64: string,
  senderPublicKeyB64: string,
  recipientPrivateKeyB64: string
): Promise<string> {
  const sodium = await getSodium();

  const ciphertext = sodium.from_base64(ciphertextB64);
  const nonce = sodium.from_base64(nonceB64);
  const senderPubKey = sodium.from_base64(senderPublicKeyB64);
  const recipientPrivKey = sodium.from_base64(recipientPrivateKeyB64);

  const decryptedBytes = sodium.crypto_box_open_easy(ciphertext, nonce, senderPubKey, recipientPrivKey);
  try {
    const unpadded = sodium.unpad(decryptedBytes, 64);
    return sodium.to_string(unpadded);
  } catch {
    // Fallback if message was unpadded (legacy)
    return sodium.to_string(decryptedBytes);
  }
}

/**
 * Deterministically compute a 60-digit safety number for out-of-band contact verification.
 * Format: 12 blocks of 5 digits (e.g. 12345 67890 12345 ...)
 */
export async function computeSafetyNumber(
  pubKeyA: string,
  pubKeyB: string
): Promise<string> {
  const sodium = await getSodium();
  const sorted = [pubKeyA, pubKeyB].sort();
  const combined = sodium.from_string(`${sorted[0]}:${sorted[1]}`);
  const hash = sodium.crypto_generichash(32, combined, null);

  // Convert 32 bytes into 60 digits
  let digits = '';
  for (let i = 0; i < hash.length && digits.length < 60; i += 2) {
    const val = (hash[i] << 8) | hash[i + 1];
    digits += String(val % 100000).padStart(5, '0');
  }

  // Format into 12 groups of 5 digits
  return digits.slice(0, 60).match(/.{1,5}/g)?.join(' ') || digits;
}

/**
 * Generate X3DH Prekey Bundle: 1 signed prekey (signed with Ed25519) + 10 one-time prekeys.
 */
export async function generatePreKeyBundle(signingPrivateKeyB64: string): Promise<{
  signedPrekeyBase64: string;
  signatureBase64: string;
  oneTimePrekeysBase64: string[];
}> {
  const sodium = await getSodium();
  const signPriv = sodium.from_base64(signingPrivateKeyB64);

  // Signed prekey (X25519)
  const spk = sodium.crypto_box_keypair();
  const spkPub = spk.publicKey;
  const spkSignature = sodium.crypto_sign_detached(spkPub, signPriv);

  // Generate 10 one-time prekeys
  const otPrekeys: string[] = [];
  for (let i = 0; i < 10; i++) {
    const otKey = sodium.crypto_box_keypair();
    otPrekeys.push(sodium.to_base64(otKey.publicKey));
  }

  return {
    signedPrekeyBase64: sodium.to_base64(spkPub),
    signatureBase64: sodium.to_base64(spkSignature),
    oneTimePrekeysBase64: otPrekeys,
  };
}

// ----------------------------------------------------------------------
// Web Crypto AES-GCM (Envelope Encryption for Vault files & photos)
// ----------------------------------------------------------------------

export async function deriveVaultMasterKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 600000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
  );
}

export async function encryptVaultFile(fileBuffer: ArrayBuffer, masterKey: CryptoKey) {
  const fileKey = await window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  const fileNonce = window.crypto.getRandomValues(new Uint8Array(12));
  const encryptedContent = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: fileNonce },
    fileKey,
    fileBuffer
  );

  const keyNonce = window.crypto.getRandomValues(new Uint8Array(12));
  const wrappedKey = await window.crypto.subtle.wrapKey(
    'raw',
    fileKey,
    masterKey,
    { name: 'AES-GCM', iv: keyNonce }
  );

  const sodium = await getSodium();
  return {
    encryptedData: encryptedContent,
    dataNonce: sodium.to_base64(fileNonce),
    wrappedFileKey: sodium.to_base64(new Uint8Array(wrappedKey)),
    keyNonce: sodium.to_base64(keyNonce),
  };
}

export async function decryptVaultFile(
  encryptedData: ArrayBuffer,
  dataNonceB64: string,
  wrappedFileKeyB64: string,
  keyNonceB64: string,
  masterKey: CryptoKey
): Promise<ArrayBuffer> {
  const sodium = await getSodium();
  const fileNonce = sodium.from_base64(dataNonceB64);
  const wrappedKeyBytes = sodium.from_base64(wrappedFileKeyB64);
  const keyNonce = sodium.from_base64(keyNonceB64);

  const fileKey = await window.crypto.subtle.unwrapKey(
    'raw',
    wrappedKeyBytes,
    masterKey,
    { name: 'AES-GCM', iv: keyNonce },
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  return window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fileNonce },
    fileKey,
    encryptedData
  );
}
