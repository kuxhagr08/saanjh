import _sodium from 'libsodium-wrappers-sumo';

let isReady = false;
let activeMasterKey: Uint8Array | null = null;
let activeIdentityKeys: {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
  signingPublicKey: Uint8Array;
  signingPrivateKey: Uint8Array;
  fingerprint: string;
} | null = null;

async function ensureSodium() {
  if (!isReady) {
    await _sodium.ready;
    isReady = true;
  }
  return _sodium;
}

self.onmessage = async (e: MessageEvent) => {
  const { id, type, payload } = e.data;
  try {
    const sodium = await ensureSodium();

    switch (type) {
      case 'INIT': {
        self.postMessage({ id, success: true });
        break;
      }

      case 'DERIVE_LOGIN_KEYS': {
        const { password, saltBase64 } = payload;
        const salt = saltBase64
          ? sodium.from_base64(saltBase64)
          : sodium.crypto_generichash(sodium.crypto_pwhash_SALTBYTES, password, null);

        const t0 = performance.now();
        // Run Argon2id once to derive 32-byte master secret (crypto_kdf_KEYBYTES) in worker
        const masterSecret = sodium.crypto_pwhash(
          sodium.crypto_kdf_KEYBYTES,
          password,
          salt,
          sodium.crypto_pwhash_OPSLIMIT_INTERACTIVE,
          sodium.crypto_pwhash_MEMLIMIT_INTERACTIVE,
          sodium.crypto_pwhash_ALG_ARGON2ID13
        );
        const elapsed = (performance.now() - t0).toFixed(1);
        console.log(`[APNA Libsodium/Argon2 WASM] Master key derived in ${elapsed}ms inside WebView`);

        // Derive 3 independent keys with different 8-byte contexts
        // 1. Auth Secret (for server credential verification / OPAQUE context)
        const authKey = sodium.crypto_kdf_derive_from_key(32, 1, 'AuthSecr', masterSecret);
        // 2. Key-Encryption Key (KEK) for wrapping recovery keys
        const kek = sodium.crypto_kdf_derive_from_key(32, 2, 'KEKeyCtx', masterSecret);
        // 3. Master Key for device encryption & IndexedDB protection
        const masterKey = sodium.crypto_kdf_derive_from_key(32, 3, 'MstrKeyC', masterSecret);

        // Cache Master Key in worker memory for the session
        if (activeMasterKey) {
          sodium.memzero(activeMasterKey);
        }
        activeMasterKey = new Uint8Array(masterKey);

        const authSecretHex = sodium.to_hex(authKey);
        const masterKeyBase64 = sodium.to_base64(masterKey);
        const kekBase64 = sodium.to_base64(kek);
        const saltOut = sodium.to_base64(salt);

        // Zeroise temporary secrets
        sodium.memzero(masterSecret);
        sodium.memzero(authKey);
        sodium.memzero(kek);

        self.postMessage({
          id,
          success: true,
          data: {
            authSecretHex,
            masterKeyBase64,
            kekBase64,
            salt: saltOut,
          },
        });
        break;
      }

      case 'SET_MASTER_KEY': {
        const { masterKeyBase64, identityKeys } = payload;
        if (activeMasterKey) {
          sodium.memzero(activeMasterKey);
        }
        activeMasterKey = sodium.from_base64(masterKeyBase64);

        if (identityKeys) {
          activeIdentityKeys = {
            publicKey: identityKeys.publicKeyBase64 ? sodium.from_base64(identityKeys.publicKeyBase64) : new Uint8Array(0),
            privateKey: identityKeys.privateKeyBase64 ? sodium.from_base64(identityKeys.privateKeyBase64) : new Uint8Array(0),
            signingPublicKey: identityKeys.signingPublicKeyBase64 ? sodium.from_base64(identityKeys.signingPublicKeyBase64) : new Uint8Array(0),
            signingPrivateKey: identityKeys.signingPrivateKeyBase64 ? sodium.from_base64(identityKeys.signingPrivateKeyBase64) : new Uint8Array(0),
            fingerprint: identityKeys.fingerprint || '',
          };
        }
        self.postMessage({ id, success: true });
        break;
      }

      case 'GENERATE_IDENTITY_BUNDLE': {
        const boxKeys = sodium.crypto_box_keypair();
        const signKeys = sodium.crypto_sign_keypair();

        const combined = new Uint8Array([...boxKeys.publicKey, ...signKeys.publicKey]);
        const hash = sodium.crypto_generichash(32, combined, null);
        const fingerprint = Array.from(hash)
          .slice(0, 16)
          .map((b) => String(b).padStart(3, '0'))
          .join(' ')
          .match(/.{1,12}/g)
          ?.join('-') || sodium.to_hex(hash).slice(0, 32);

        activeIdentityKeys = {
          publicKey: boxKeys.publicKey,
          privateKey: boxKeys.privateKey,
          signingPublicKey: signKeys.publicKey,
          signingPrivateKey: signKeys.privateKey,
          fingerprint,
        };

        self.postMessage({
          id,
          success: true,
          data: {
            publicKeyBase64: sodium.to_base64(boxKeys.publicKey),
            privateKeyBase64: sodium.to_base64(boxKeys.privateKey),
            signingPublicKeyBase64: sodium.to_base64(signKeys.publicKey),
            signingPrivateKeyBase64: sodium.to_base64(signKeys.privateKey),
            fingerprint,
          },
        });
        break;
      }

      case 'ENCRYPT_FIELD': {
        if (!activeMasterKey) throw new Error('Worker is locked: no active master key');
        const { plaintext } = payload;
        const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
        const ciphertext = sodium.crypto_secretbox_easy(plaintext, nonce, activeMasterKey);
        self.postMessage({
          id,
          success: true,
          data: {
            ciphertext: sodium.to_base64(ciphertext),
            nonce: sodium.to_base64(nonce),
          },
        });
        break;
      }

      case 'DECRYPT_FIELD': {
        if (!activeMasterKey) throw new Error('Worker is locked: no active master key');
        const { ciphertext, nonce } = payload;
        const decrypted = sodium.crypto_secretbox_open_easy(
          sodium.from_base64(ciphertext),
          sodium.from_base64(nonce),
          activeMasterKey
        );
        self.postMessage({
          id,
          success: true,
          data: sodium.to_string(decrypted),
        });
        break;
      }

      case 'ENCRYPT_MESSAGE_BOX': {
        if (!activeIdentityKeys) throw new Error('No identity keys in worker');
        const { messagePlaintext, recipientPublicKeyBase64 } = payload;
        const recipientPubKey = sodium.from_base64(recipientPublicKeyBase64);
        const nonce = sodium.randombytes_buf(sodium.crypto_box_NONCEBYTES);

        // Pad message to nearest 64 bytes for traffic analysis defense
        const unpadded = sodium.from_string(messagePlaintext);
        const padded = sodium.pad(unpadded, 64);

        const ciphertext = sodium.crypto_box_easy(
          padded,
          nonce,
          recipientPubKey,
          activeIdentityKeys.privateKey
        );

        self.postMessage({
          id,
          success: true,
          data: {
            ciphertext: sodium.to_base64(ciphertext),
            nonce: sodium.to_base64(nonce),
          },
        });
        break;
      }

      case 'DECRYPT_MESSAGE_BOX': {
        if (!activeIdentityKeys) throw new Error('No identity keys in worker');
        const { ciphertextBase64, nonceBase64, senderPublicKeyBase64 } = payload;
        const senderPubKey = sodium.from_base64(senderPublicKeyBase64);
        const ciphertext = sodium.from_base64(ciphertextBase64);
        const nonce = sodium.from_base64(nonceBase64);

        const decryptedPadded = sodium.crypto_box_open_easy(
          ciphertext,
          nonce,
          senderPubKey,
          activeIdentityKeys.privateKey
        );

        const unpadded = sodium.unpad(decryptedPadded, 64);
        self.postMessage({
          id,
          success: true,
          data: sodium.to_string(unpadded),
        });
        break;
      }

      case 'GET_STATUS': {
        self.postMessage({
          id,
          success: true,
          data: {
            isUnlocked: activeMasterKey !== null,
            hasIdentity: activeIdentityKeys !== null,
            fingerprint: activeIdentityKeys?.fingerprint || null,
          },
        });
        break;
      }

      case 'LOCK': {
        if (activeMasterKey) {
          sodium.memzero(activeMasterKey);
          activeMasterKey = null;
        }
        if (activeIdentityKeys) {
          sodium.memzero(activeIdentityKeys.privateKey);
          sodium.memzero(activeIdentityKeys.signingPrivateKey);
          activeIdentityKeys = null;
        }
        self.postMessage({ id, success: true });
        break;
      }

      default:
        throw new Error(`Unknown worker action: ${type}`);
    }
  } catch (err: any) {
    self.postMessage({ id, success: false, error: err.message || 'Worker crypto error' });
  }
};
