import { describe, it, expect } from 'vitest';
import {
  createEncryptedBackup,
  restoreEncryptedBackup,
  getLastBackupTimestamp,
  setLastBackupTimestamp,
} from '../utils/backup';

describe('Zero-Storage Device Backup (.apnabackup)', () => {
  const passphrase = 'MySuperSecretBackupPassword123!';

  it('records and retrieves backup timestamps', () => {
    const now = Date.now();
    setLastBackupTimestamp(now);
    expect(getLastBackupTimestamp()).toBe(now);
  });

  it('rejects short passphrase < 8 chars', async () => {
    await expect(createEncryptedBackup('short')).rejects.toThrow(/at least 8 characters/);
  });

  it('creates valid encrypted backup envelope with Argon2id and libsodium', async () => {
    const { envelope, rawJson } = await createEncryptedBackup(passphrase);
    expect(envelope.app).toBe('APNA');
    expect(envelope.type).toBe('zero_storage_device_backup');
    expect(envelope.version).toBe(1);
    expect(envelope.salt).toBeDefined();
    expect(envelope.nonce).toBeDefined();
    expect(envelope.ciphertext).toBeDefined();
    expect(envelope.checksum).toBeDefined();

    // Plaintext or secret strings should NEVER appear in the raw exported JSON
    expect(rawJson).not.toContain('MySuperSecretBackupPassword123!');
  });

  it('restores encrypted backup cleanly using the same passphrase', async () => {
    const { rawJson } = await createEncryptedBackup(passphrase);
    const result = await restoreEncryptedBackup(rawJson, passphrase);
    expect(result.restoredCounts).toBeDefined();
  });

  it('fails decryption with incorrect passphrase', async () => {
    const { rawJson } = await createEncryptedBackup(passphrase);
    await expect(
      restoreEncryptedBackup(rawJson, 'WrongIncorrectPassword123!')
    ).rejects.toThrow(/Incorrect passphrase/);
  });

  it('fails verification if ciphertext or checksum is corrupted', async () => {
    const { envelope } = await createEncryptedBackup(passphrase);
    const corrupted = {
      ...envelope,
      ciphertext: 'corrupted_ciphertext_abc123',
    };
    await expect(
      restoreEncryptedBackup(JSON.stringify(corrupted), passphrase)
    ).rejects.toThrow(/integrity verification failed/);
  });
});

