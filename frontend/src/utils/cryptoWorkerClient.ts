/**
 * Type-safe RPC Bridge for Cryptographic Web Worker.
 * Ensures all heavy key derivations and private key holds remain isolated in Worker memory.
 */

interface WorkerRequest {
  id: string;
  type: string;
  payload?: any;
}

interface WorkerResponse {
  id: string;
  success: boolean;
  data?: any;
  error?: string;
}

let workerInstance: Worker | null = null;
const pendingRequests = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void }>();

export function getCryptoWorker(): Worker {
  if (!workerInstance && typeof window !== 'undefined') {
    workerInstance = new Worker(
      new URL('../workers/crypto.worker.ts', import.meta.url),
      { type: 'module' }
    );

    workerInstance.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const { id, success, data, error } = e.data;
      const resolver = pendingRequests.get(id);
      if (resolver) {
        pendingRequests.delete(id);
        if (success) {
          resolver.resolve(data);
        } else {
          resolver.reject(new Error(error || 'Worker operation failed'));
        }
      }
    };

    workerInstance.onerror = (err) => {
      console.error('[APNA CryptoWorker Error]:', err);
    };
  }

  return workerInstance!;
}

export async function sendWorkerMessage<T = any>(type: string, payload?: any): Promise<T> {
  const worker = getCryptoWorker();
  const id = Math.random().toString(36).slice(2) + Date.now().toString(36);

  return new Promise<T>((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject });
    worker.postMessage({ id, type, payload });
  });
}

export interface DerivedLoginKeys {
  authSecretHex: string;
  masterKeyBase64: string;
  kekBase64: string;
  salt: string;
}

export async function workerDeriveLoginKeys(password: string, saltBase64?: string): Promise<DerivedLoginKeys> {
  return sendWorkerMessage<DerivedLoginKeys>('DERIVE_LOGIN_KEYS', { password, saltBase64 });
}

export async function workerSetMasterKey(
  masterKeyBase64: string,
  identityKeys?: {
    publicKeyBase64: string;
    privateKeyBase64: string;
    signingPublicKeyBase64: string;
    signingPrivateKeyBase64: string;
    fingerprint: string;
  }
): Promise<void> {
  await sendWorkerMessage('SET_MASTER_KEY', { masterKeyBase64, identityKeys });
}

export async function workerGenerateIdentityBundle() {
  return sendWorkerMessage('GENERATE_IDENTITY_BUNDLE');
}

export async function workerEncryptField(plaintext: string): Promise<{ ciphertext: string; nonce: string }> {
  return sendWorkerMessage('ENCRYPT_FIELD', { plaintext });
}

export async function workerDecryptField(ciphertext: string, nonce: string): Promise<string> {
  return sendWorkerMessage('DECRYPT_FIELD', { ciphertext, nonce });
}

export async function workerEncryptMessageBox(messagePlaintext: string, recipientPublicKeyBase64: string) {
  return sendWorkerMessage('ENCRYPT_MESSAGE_BOX', { messagePlaintext, recipientPublicKeyBase64 });
}

export async function workerDecryptMessageBox(
  ciphertextBase64: string,
  nonceBase64: string,
  senderPublicKeyBase64: string
) {
  return sendWorkerMessage('DECRYPT_MESSAGE_BOX', {
    ciphertextBase64,
    nonceBase64,
    senderPublicKeyBase64,
  });
}

export async function workerGetStatus(): Promise<{ isUnlocked: boolean; hasIdentity: boolean; fingerprint: string | null }> {
  return sendWorkerMessage('GET_STATUS');
}

export async function workerLock(): Promise<void> {
  await sendWorkerMessage('LOCK');
}
