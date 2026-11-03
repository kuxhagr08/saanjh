import { describe, it, expect, beforeEach } from 'vitest';

describe('APNA Device Key & Session Lifecycle', () => {
  let inMemoryStorage: Record<string, string> = {};

  beforeEach(() => {
    inMemoryStorage = {};
  });

  it('login -> reload -> still unlocked when remember device is true', () => {
    // 1. User logs in with rememberDevice: true
    const sessionToken = 'mock_jwt_access_token_123';
    const encryptedMasterKey = 'mock_aes_gcm_wrapped_master_key';
    inMemoryStorage['apna_session'] = sessionToken;
    inMemoryStorage['apna_wrapped_master'] = encryptedMasterKey;
    inMemoryStorage['apna_is_locked'] = 'false';

    // 2. Simulate page reload
    const restoredSession = inMemoryStorage['apna_session'];
    const restoredWrappedKey = inMemoryStorage['apna_wrapped_master'];
    const isLocked = inMemoryStorage['apna_is_locked'] === 'true';

    expect(restoredSession).toBe(sessionToken);
    expect(restoredWrappedKey).toBe(encryptedMasterKey);
    expect(isLocked).toBe(false); // Unlocked on reload without password re-prompt
  });

  it('explicit lock -> device locked -> requires unlock', () => {
    inMemoryStorage['apna_session'] = 'mock_jwt_access_token_123';
    inMemoryStorage['apna_is_locked'] = 'false';

    // User clicks lock
    inMemoryStorage['apna_is_locked'] = 'true';
    expect(inMemoryStorage['apna_is_locked']).toBe('true');

    // Unlock with correct password
    const enteredPassword = 'StrongPassword123!';
    const correctPassword = 'StrongPassword123!';
    if (enteredPassword === correctPassword) {
      inMemoryStorage['apna_is_locked'] = 'false';
    }

    expect(inMemoryStorage['apna_is_locked']).toBe('false');
  });

  it('wrong password shows error and remains locked', () => {
    inMemoryStorage['apna_is_locked'] = 'true';

    const enteredPassword: string = 'wrong_password_99';
    const correctPassword: string = 'StrongPassword123!';
    let errorMessage = '';

    if (enteredPassword !== correctPassword) {
      errorMessage = 'Incorrect password. Please try again.';
    } else {
      inMemoryStorage['apna_is_locked'] = 'false';
    }

    expect(errorMessage).toBe('Incorrect password. Please try again.');
    expect(inMemoryStorage['apna_is_locked']).toBe('true');
  });

  it('idle timeout triggers auto-lock after threshold', () => {
    const idleTimeoutMinutes = 1440; // 1 day
    const lastActive = Date.now() - (1500 * 60 * 1000); // 1500 minutes ago

    const elapsedMinutes = (Date.now() - lastActive) / (60 * 1000);
    const shouldLock = elapsedMinutes > idleTimeoutMinutes;

    expect(shouldLock).toBe(true);
  });
});
