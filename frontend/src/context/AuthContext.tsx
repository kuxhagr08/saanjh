import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { apiRequest, getStoredTokens, setStoredTokens, type UserProfile, type AuthTokens } from '../api/client';
import { db, type LocalIdentityKey } from '../db';
import { generateIdentityKeys, encryptWithPassword, decryptWithPassword } from '../utils/crypto';
import { seedDemoData } from '../utils/demoData';
import {
  workerDeriveLoginKeys,
  workerSetMasterKey,
  workerLock,
  workerGetStatus,
  type DerivedLoginKeys,
} from '../utils/cryptoWorkerClient';
import {
  restoreDeviceSession,
  persistMasterKeyToDevice,
  lockDevice,
  unlockWithPassword,
  clearDeviceSession,
  getDeviceConfig,
  saveDeviceConfig,
  markDeviceActive,
  type DeviceLockConfig,
  DEFAULT_LOCK_CONFIG,
} from '../utils/deviceSecurity';

export interface RegisterData {
  email: string;
  password: string;
  username: string;
  phoneNumber?: string;
  displayName?: string;
  rememberDevice?: boolean;
}

interface AuthContextType {
  user: UserProfile | null;
  isLoading: boolean;
  loginStage: string;
  loginError: string | null;
  login: (identifier: string, password: string, rememberDevice?: boolean) => Promise<void>;
  register: (data: RegisterData | string, password?: string, displayName?: string) => Promise<UserProfile>;
  confirmUserRegistration: (overrideUser?: UserProfile) => void;
  updatePrivacySettings: (settings: Partial<UserProfile>) => Promise<UserProfile>;
  startDemoSession: () => Promise<void>;
  logout: () => void;
  identityKey: LocalIdentityKey | null;
  activePrivateKey: string | null;
  setSessionPrivateKey: (k: string | null) => void;
  unlockVaultKeys: (password: string) => Promise<{ privateKey: string; signingPrivateKey: string }>;
  initializeIdentityKeys: (password: string, onProgress?: (msg: string) => void) => Promise<any>;

  // Device Security & Auto-Lock
  isDeviceLocked: boolean;
  lockReason?: 'EXPLICIT_LOCK' | 'IDLE_TIMEOUT' | 'LOCK_ON_CLOSE';
  lockDeviceNow: () => Promise<void>;
  unlockDevice: (password: string) => Promise<boolean>;
  deviceConfig: DeviceLockConfig;
  updateDeviceConfig: (cfg: Partial<DeviceLockConfig>) => Promise<void>;

  theme: 'light' | 'dark' | 'system' | 'amoled';
  setTheme: (theme: 'light' | 'dark' | 'system' | 'amoled') => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [pendingUser, setPendingUser] = useState<UserProfile | null>(null);
  const [identityKey, setIdentityKey] = useState<LocalIdentityKey | null>(null);
  const [activePrivateKey, setSessionPrivateKeyState] = useState<string | null>(null);

  const setSessionPrivateKey = useCallback((k: string | null) => {
    setSessionPrivateKeyState(k);
    if (k) {
      try { sessionStorage.setItem('apna_session_privkey', k); } catch {}
    } else {
      try { sessionStorage.removeItem('apna_session_privkey'); } catch {}
    }
  }, []);
  const [isLoading, setIsLoading] = useState(true);
  const [loginStage, setLoginStage] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [theme, setThemeState] = useState<'light' | 'dark' | 'system' | 'amoled'>('light');

  // Device Auto-Lock & Security State
  const [isDeviceLocked, setIsDeviceLocked] = useState(false);
  const [lockReason, setLockReason] = useState<'EXPLICIT_LOCK' | 'IDLE_TIMEOUT' | 'LOCK_ON_CLOSE' | undefined>();
  const [deviceConfig, setDeviceConfigState] = useState<DeviceLockConfig>(DEFAULT_LOCK_CONFIG);

  // Theme synchronization (Default is Light)
  const setTheme = (t: 'light' | 'dark' | 'system' | 'amoled') => {
    setThemeState(t as any);
    localStorage.setItem('apna_theme', t);
    applyTheme(t);
  };

  const applyTheme = (t: string) => {
    const root = document.documentElement;
    const isDark = t === 'dark' || t === 'amoled' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    const activeTheme = t === 'system' ? (isDark ? 'dark' : 'light') : t;
    root.setAttribute('data-theme', activeTheme);
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // Update meta theme-color for browser chrome
    let metaTheme = document.querySelector('meta[name="theme-color"]');
    if (!metaTheme) {
      metaTheme = document.createElement('meta');
      metaTheme.setAttribute('name', 'theme-color');
      document.head.appendChild(metaTheme);
    }
    metaTheme.setAttribute('content', t === 'amoled' ? '#000000' : isDark ? '#0C0C0F' : '#F8F7F5');
  };

  // Restore session on mount
  useEffect(() => {
    const savedTheme = (localStorage.getItem('apna_theme') as any) || 'light';
    setTheme(savedTheme);

    async function init() {
      if (!db.isOpen()) {
        await db.open();
      }

      // Load device lock config
      const cfg = await getDeviceConfig();
      setDeviceConfigState(cfg);

      // Check for local demo user
      const isDemo = localStorage.getItem('apna_is_demo') === '1';
      if (isDemo) {
        setUser({
          id: 1,
          email: 'kuxhagr@saanjh.local',
          username: 'kuxhagr',
          display_name: 'Kushagr (Demo)',
          avatar_color: 'violet',
          created_at: new Date().toISOString(),
          has_keys: true,
        });

        const currentKeys = await db.identityKeys.get('current');
        if (currentKeys) {
          setIdentityKey(currentKeys);
          try {
            const privEnc = JSON.parse(currentKeys.privateKeyEncrypted);
            const privKey = await decryptWithPassword(privEnc.ciphertext, privEnc.nonce, privEnc.salt, '12345678');
            setSessionPrivateKey(privKey);
            await workerSetMasterKey(privKey, {
              publicKeyBase64: currentKeys.publicKeyBase64,
              privateKeyBase64: privKey,
              signingPublicKeyBase64: currentKeys.signingPublicKeyBase64,
              signingPrivateKeyBase64: currentKeys.signingPublicKeyBase64,
              fingerprint: currentKeys.fingerprint,
            });
          } catch (e) {
            console.warn('Demo session key decrypt fallback:', e);
          }
        }
        setIsLoading(false);
        return;
      }

      const tokens = getStoredTokens();
      if (!tokens?.access) {
        setIsLoading(false);
        return;
      }

      try {
        const profile = await apiRequest<UserProfile>('/auth/me/');
        setUser(profile);

        const userKey = `user_${profile.email}`;
        const localKeys = (await db.identityKeys.get(userKey)) || (await db.identityKeys.get('current'));
        if (localKeys && (localKeys.email === profile.email || !localKeys.email)) {
          setIdentityKey(localKeys);
        }

        // Restore Device Security Session (Unwraps Master Key via non-extractable WebCrypto key)
        const deviceRes = await restoreDeviceSession();
        if (deviceRes.status === 'UNLOCKED') {
          setIsDeviceLocked(false);
          setLockReason(undefined);
          if (deviceRes.identityKeys?.privateKeyBase64) {
            setSessionPrivateKey(deviceRes.identityKeys.privateKeyBase64);
          }
        } else if (deviceRes.status === 'LOCKED') {
          setIsDeviceLocked(true);
          setLockReason(deviceRes.reason);
        }

        // Check sessionStorage cache fallback if not locked
        if (!deviceRes || deviceRes.status !== 'LOCKED') {
          const cachedPriv = sessionStorage.getItem('apna_session_privkey');
          if (cachedPriv) {
            setSessionPrivateKey(cachedPriv);
          }
        }
      } catch (err) {
        console.warn('[APNA] Session restoration failed:', err);
        setStoredTokens(null);
      } finally {
        setIsLoading(false);
      }
    }

    init();

    // User activity listeners to track idle time
    const handleActivity = () => markDeviceActive();
    window.addEventListener('mousemove', handleActivity, { passive: true });
    window.addEventListener('keydown', handleActivity, { passive: true });
    window.addEventListener('touchstart', handleActivity, { passive: true });

    const handleExpired = () => {
      setUser(null);
      setIdentityKey(null);
      setSessionPrivateKey(null);
      setIsDeviceLocked(false);
    };
    window.addEventListener('apna_auth_expired', handleExpired);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('apna_auth_expired', handleExpired);
    };
  }, []);

  const login = async (identifier: string, password: string, rememberDevice: boolean = true) => {
    setLoginError(null);
    setIsLoading(true);
    setLoginStage('Deriving keys in Web Worker (Argon2id)...');

    const timeoutId = setTimeout(() => {
      setLoginError('Key initialization timed out after 20s. Please check network and retry.');
      setIsLoading(false);
    }, 20000);

    try {
      // 1. Run Argon2id once in worker to derive auth secret & master key
      const derived: DerivedLoginKeys = await workerDeriveLoginKeys(password);

      setLoginStage('Authenticating credentials with server...');
      const res = await apiRequest<{ user: UserProfile; tokens: AuthTokens }>('/auth/login/', {
        method: 'POST',
        body: JSON.stringify({ identifier, password }),
      });

      setStoredTokens(res.tokens);
      setUser(res.user);

      if (!db.isOpen()) await db.open();

      setLoginStage('Checking device encryption keys...');
      const userKey = `user_${res.user.email}`;
      const existing = (await db.identityKeys.get(userKey)) || (await db.identityKeys.get('current'));
      let activePrivKey = '';
      let bundleKeys: any = null;

      if (!existing || existing.email !== res.user.email) {
        setLoginStage('Generating cryptographic identity in worker...');
        bundleKeys = await initializeIdentityKeys(password, (stage) => setLoginStage(stage), res.user);
        activePrivKey = bundleKeys.privateKeyBase64;
      } else {
        try {
          const privEnc = JSON.parse(existing.privateKeyEncrypted);
          activePrivKey = await decryptWithPassword(privEnc.ciphertext, privEnc.nonce, privEnc.salt, password);
          setSessionPrivateKey(activePrivKey);
          setIdentityKey(existing);

          let activeSignPrivKey = '';
          if (existing.signingPrivateKeyEncrypted) {
            try {
              const signEnc = JSON.parse(existing.signingPrivateKeyEncrypted);
              activeSignPrivKey = await decryptWithPassword(signEnc.ciphertext, signEnc.nonce, signEnc.salt, password);
            } catch {
              activeSignPrivKey = '';
            }
          }

          bundleKeys = {
            publicKeyBase64: existing.publicKeyBase64,
            privateKeyBase64: activePrivKey,
            signingPublicKeyBase64: existing.signingPublicKeyBase64,
            signingPrivateKeyBase64: activeSignPrivKey || existing.signingPublicKeyBase64,
            fingerprint: existing.fingerprint,
          };
          await workerSetMasterKey(derived.masterKeyBase64, bundleKeys);
        } catch {
          // Re-initialize if password changed
          bundleKeys = await initializeIdentityKeys(password, (stage) => setLoginStage(stage), res.user);
          activePrivKey = bundleKeys.privateKeyBase64;
        }
      }

      // 2. Wrap Master Key with Non-Extractable WebCrypto device key for "Remember this device"
      await persistMasterKeyToDevice(derived.masterKeyBase64, bundleKeys, rememberDevice);
      setIsDeviceLocked(false);
      setLockReason(undefined);

      clearTimeout(timeoutId);
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error('[APNA Login Error]:', err);
      setLoginError(err.message || 'Login failed. Please verify credentials.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: RegisterData | string, passwordParam?: string, displayNameParam?: string): Promise<UserProfile> => {
    setLoginError(null);
    setIsLoading(true);
    setLoginStage('Deriving keys in Web Worker (Argon2id)...');

    const timeoutId = setTimeout(() => {
      setLoginError('Key initialization timed out. Please retry.');
      setIsLoading(false);
    }, 20000);

    const isObj = typeof data === 'object';
    const email = isObj ? data.email : data;
    const password = isObj ? data.password : (passwordParam || '');
    const username = isObj ? data.username : (displayNameParam?.toLowerCase().replace(/\s+/g, '_') || data.split('@')[0]);
    const displayName = isObj ? data.displayName : displayNameParam;
    const phoneNumber = isObj ? data.phoneNumber : undefined;
    const rememberDevice = isObj ? (data.rememberDevice ?? true) : true;

    try {
      const derived: DerivedLoginKeys = await workerDeriveLoginKeys(password);

      setLoginStage('Creating user account on server...');
      const res = await apiRequest<{ user: UserProfile; tokens: AuthTokens }>('/auth/register/', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          username,
          display_name: displayName,
          phone_number: phoneNumber,
        }),
      });

      setStoredTokens(res.tokens);
      setPendingUser(res.user);

      if (!db.isOpen()) await db.open();

      setLoginStage('Deriving on-device encryption identity...');
      const regKeys = await initializeIdentityKeys(password, (stage) => setLoginStage(stage), res.user);

      // Wrap Master Key with Non-Extractable WebCrypto device key
      await persistMasterKeyToDevice(derived.masterKeyBase64, regKeys, rememberDevice);
      setIsDeviceLocked(false);
      setLockReason(undefined);

      clearTimeout(timeoutId);
      return res.user;
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error('[APNA Register Error]:', err);
      setLoginError(err.message || 'Registration failed.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const confirmUserRegistration = (overrideUser?: UserProfile) => {
    const target = overrideUser || pendingUser;
    if (target) {
      setUser(target);
      setPendingUser(null);
    }
  };

  const updatePrivacySettings = async (settings: Partial<UserProfile>): Promise<UserProfile> => {
    const updated = await apiRequest<UserProfile>('/auth/me/', {
      method: 'PATCH',
      body: JSON.stringify(settings),
    });
    setUser(updated);
    return updated;
  };

  const startDemoSession = async () => {
    setIsLoading(true);
    setLoginStage('Generating live demo cryptographic keys...');
    localStorage.setItem('apna_is_demo', '1');

    await seedDemoData('kuxhagr@saanjh.local');

    const demoUser: UserProfile = {
      id: 1,
      email: 'kuxhagr@saanjh.local',
      username: 'kuxhagr',
      display_name: 'Kushagr',
      avatar_color: 'violet',
      created_at: new Date().toISOString(),
      has_keys: true,
    };
    setUser(demoUser);

    const keys = await db.identityKeys.get('current');
    if (keys) {
      setIdentityKey(keys);
      try {
        const privEnc = JSON.parse(keys.privateKeyEncrypted);
        const privKey = await decryptWithPassword(privEnc.ciphertext, privEnc.nonce, privEnc.salt, '12345678');
        setSessionPrivateKey(privKey);
        await workerSetMasterKey(privKey, {
          publicKeyBase64: keys.publicKeyBase64,
          privateKeyBase64: privKey,
          signingPublicKeyBase64: keys.signingPublicKeyBase64,
          signingPrivateKeyBase64: keys.signingPublicKeyBase64,
          fingerprint: keys.fingerprint,
        });
      } catch (e) {
        console.warn('Demo session key decrypt fallback:', e);
      }
    }
    setIsDeviceLocked(false);
    setIsLoading(false);
  };

  const initializeIdentityKeys = async (
    password: string,
    onProgress?: (msg: string) => void,
    userOverride?: UserProfile
  ) => {
    onProgress?.('Generating X25519 authenticated keypair in worker...');
    const keys = await generateIdentityKeys();

    onProgress?.('Encrypting private keys with Argon2id...');
    const encryptedPriv = await encryptWithPassword(keys.privateKeyBase64, password, onProgress);
    const encryptedSignPriv = await encryptWithPassword(keys.signingPrivateKeyBase64, password, onProgress);

    onProgress?.('Saving keys to encrypted local storage...');
    const activeEmail = userOverride?.email || user?.email || 'kuxhagr@saanjh.local';
    const userKey = `user_${activeEmail}`;
    const record: LocalIdentityKey = {
      id: userKey,
      email: activeEmail,
      publicKeyBase64: keys.publicKeyBase64,
      privateKeyEncrypted: JSON.stringify(encryptedPriv),
      nonce: encryptedPriv.nonce,
      signingPublicKeyBase64: keys.signingPublicKeyBase64,
      signingPrivateKeyEncrypted: JSON.stringify(encryptedSignPriv),
      fingerprint: keys.fingerprint,
      createdAt: Date.now(),
    };

    await db.identityKeys.put(record);
    await db.identityKeys.put({ ...record, id: 'current' });
    setIdentityKey(record);
    setSessionPrivateKey(keys.privateKeyBase64);

    await workerSetMasterKey(keys.privateKeyBase64, {
      publicKeyBase64: keys.publicKeyBase64,
      privateKeyBase64: keys.privateKeyBase64,
      signingPublicKeyBase64: keys.signingPublicKeyBase64,
      signingPrivateKeyBase64: keys.signingPrivateKeyBase64,
      fingerprint: keys.fingerprint,
    });

    onProgress?.('Publishing public identity to directory...');
    try {
      await apiRequest('/identity/keys/', {
        method: 'POST',
        body: JSON.stringify({
          public_identity_key: keys.publicKeyBase64,
          public_signing_key: keys.signingPublicKeyBase64,
          key_fingerprint: keys.fingerprint,
        }),
      });
    } catch (e) {
      console.warn('[APNA] Public key publish warning (offline fallback allowed):', e);
    }

    return keys;
  };

  const unlockVaultKeys = async (password: string) => {
    if (activePrivateKey) {
      return { privateKey: activePrivateKey, signingPrivateKey: '' };
    }

    const current = identityKey || (await db.identityKeys.get('current'));
    if (!current) throw new Error('No identity keys found on this device');

    const privEnc = JSON.parse(current.privateKeyEncrypted);
    const signEnc = JSON.parse(current.signingPrivateKeyEncrypted);

    const privKey = await decryptWithPassword(privEnc.ciphertext, privEnc.nonce, privEnc.salt, password);
    const signPrivKey = await decryptWithPassword(signEnc.ciphertext, signEnc.nonce, signEnc.salt, password);

    setSessionPrivateKey(privKey);
    await workerSetMasterKey(privKey);

    return { privateKey: privKey, signingPrivateKey: signPrivKey };
  };

  const lockDeviceNow = async () => {
    await lockDevice();
    setIsDeviceLocked(true);
    setLockReason('EXPLICIT_LOCK');
    setSessionPrivateKey(null);
  };

  const unlockDevice = async (password: string): Promise<boolean> => {
    const ok = await unlockWithPassword(password);
    if (!ok) return false;

    setIsDeviceLocked(false);
    setLockReason(undefined);

    const localKeys = await db.identityKeys.get('current');
    if (localKeys) {
      try {
        const privEnc = JSON.parse(localKeys.privateKeyEncrypted);
        const privKey = await decryptWithPassword(privEnc.ciphertext, privEnc.nonce, privEnc.salt, password);
        setSessionPrivateKey(privKey);
      } catch {
        // fallback
      }
    }
    return true;
  };

  const updateDeviceConfig = async (cfg: Partial<DeviceLockConfig>) => {
    const updated = await saveDeviceConfig(cfg);
    setDeviceConfigState(updated);
  };

  const logout = async () => {
    setStoredTokens(null);
    localStorage.removeItem('apna_is_demo');
    setSessionPrivateKey(null);
    setUser(null);
    setIdentityKey(null);
    setIsDeviceLocked(false);
    await workerLock();
    await clearDeviceSession();
    try {
      await db.identityKeys.delete('current');
    } catch {}
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        loginStage,
        loginError,
        login,
        register,
        confirmUserRegistration,
        updatePrivacySettings,
        startDemoSession,
        logout,
        identityKey,
        activePrivateKey,
        setSessionPrivateKey,
        unlockVaultKeys,
        initializeIdentityKeys,
        isDeviceLocked,
        lockReason,
        lockDeviceNow,
        unlockDevice,
        deviceConfig,
        updateDeviceConfig,
        theme,
        setTheme,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
