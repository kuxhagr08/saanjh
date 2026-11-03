import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCustomization } from '../context/CustomizationContext';
import { db } from '../db';
import { apiRequest } from '../api/client';
import {
  Shield,
  ShieldCheck,
  Lock,
  Key,
  Fingerprint,
  Download,
  Upload,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  LogOut,
  Eye,
  EyeOff,
  Copy,
  Check,
  RefreshCw,
  Info,
  Server,
  Smartphone,
  Globe,
  Phone,
  AtSign,
  Mail,
  UserCheck,
  Sliders,
} from 'lucide-react';
import { PrivacyLedgerModal } from '../components/PrivacyLedgerModal';
import {
  downloadEncryptedBackup,
  restoreEncryptedBackup,
  getLastBackupTimestamp,
  setLastBackupTimestamp,
} from '../utils/backup';

export const SecurityPage: React.FC = () => {
  const { user, identityKey, logout, initializeIdentityKeys, updatePrivacySettings, theme, setTheme, lockDeviceNow } = useAuth();
  const { setCustomizeModalOpen } = useCustomization();
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [backupDownloaded, setBackupDownloaded] = useState(false);
  const [copiedFingerprint, setCopiedFingerprint] = useState(false);
  const [isRegeneratingKeys, setIsRegeneratingKeys] = useState(false);
  const [regenError, setRegenError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [privacySaving, setPrivacySaving] = useState(false);
  const [privacySaved, setPrivacySaved] = useState(false);
  const [idleTimeout, setIdleTimeout] = useState<number>(10080);
  const [biometricEnabled, setBiometricEnabled] = useState<boolean>(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [lastBackupTime, setLastBackupTime] = useState<number | null>(null);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [backupPassphrase, setBackupPassphrase] = useState('');
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupError, setBackupError] = useState('');
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restorePassphrase, setRestorePassphrase] = useState('');
  const [pendingRestoreText, setPendingRestoreText] = useState('');
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreError, setRestoreError] = useState('');

  useEffect(() => {
    setLastBackupTime(getLastBackupTimestamp());
    (async () => {
      try {
        const { getDeviceConfig } = await import('../utils/deviceSecurity');
        const cfg = await getDeviceConfig();
        setIdleTimeout(cfg.idleTimeoutMinutes);
        setBiometricEnabled(!!cfg.biometricEnabled);
      } catch {}
    })();
  }, []);

  const handleTogglePrivacy = async (field: 'allow_phone_discovery' | 'allow_email_discovery' | 'allow_username_discovery', val: boolean) => {
    setPrivacySaving(true);
    try {
      await updatePrivacySettings({ [field]: val });
      setPrivacySaved(true);
      setTimeout(() => setPrivacySaved(false), 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setPrivacySaving(false);
    }
  };

  const handleSetMessagingPermission = async (perm: 'everyone' | 'contacts_only' | 'nobody') => {
    setPrivacySaving(true);
    try {
      await updatePrivacySettings({ messaging_permission: perm });
      setPrivacySaved(true);
      setTimeout(() => setPrivacySaved(false), 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setPrivacySaving(false);
    }
  };

  const handleUpdateIdleTimeout = async (mins: number) => {
    setIdleTimeout(mins);
    try {
      const { setIdleTimeoutPreference } = await import('../utils/deviceSecurity');
      await setIdleTimeoutPreference(mins);
      setPrivacySaved(true);
      setTimeout(() => setPrivacySaved(false), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleBiometrics = async (enabled: boolean) => {
    try {
      const { toggleBiometricQuickUnlock } = await import('../utils/deviceSecurity');
      const res = await toggleBiometricQuickUnlock(enabled);
      setBiometricEnabled(res);
      setPrivacySaved(true);
      setTimeout(() => setPrivacySaved(false), 2000);
    } catch (err: any) {
      alert(err.message || 'Biometric registration failed.');
    }
  };

  const securityScore = [
    !!identityKey,
    !!user?.email,
    true, // local encryption always on
    backupDownloaded,
  ].filter(Boolean).length;

  const scorePercent = (securityScore / 4) * 100;
  const scoreColor = scorePercent >= 75 ? '#1A9055' : scorePercent >= 50 ? '#CB8100' : '#D13B35';
  const scoreLabel = scorePercent >= 75 ? 'Strong' : scorePercent >= 50 ? 'Moderate' : 'Needs Work';

  const handleStartExport = () => {
    setBackupError('');
    setShowBackupModal(true);
  };

  const handleConfirmExport = async () => {
    if (!backupPassphrase || backupPassphrase.length < 8) {
      setBackupError('Passphrase must be at least 8 characters long.');
      return;
    }
    setBackupLoading(true);
    setBackupError('');
    try {
      await downloadEncryptedBackup(backupPassphrase);
      setBackupDownloaded(true);
      setLastBackupTime(Date.now());
      setShowBackupModal(false);
      setBackupPassphrase('');
    } catch (err: any) {
      setBackupError(err.message || 'Backup failed');
    } finally {
      setBackupLoading(false);
    }
  };

  const handleFileSelectedForRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setPendingRestoreText(text);
      setRestoreError('');
      setShowRestoreModal(true);
    } catch {
      setUploadStatus('error');
    }
  };

  const handleConfirmRestore = async () => {
    if (!pendingRestoreText || !restorePassphrase) {
      setRestoreError('Please enter your backup passphrase.');
      return;
    }
    setRestoreLoading(true);
    setRestoreError('');
    try {
      await restoreEncryptedBackup(pendingRestoreText, restorePassphrase);
      setUploadStatus('success');
      setLastBackupTime(Date.now());
      setShowRestoreModal(false);
      setRestorePassphrase('');
      setPendingRestoreText('');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      setRestoreError(err.message || 'Restoration failed.');
    } finally {
      setRestoreLoading(false);
    }
  };

  const handleCopyFingerprint = () => {
    if (!identityKey?.fingerprint) return;
    navigator.clipboard.writeText(identityKey.fingerprint).then(() => {
      setCopiedFingerprint(true);
      setTimeout(() => setCopiedFingerprint(false), 2000);
    });
  };

  const handleRegenerateKeys = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase.trim()) return;
    setIsRegeneratingKeys(true);
    setRegenError('');
    try {
      await initializeIdentityKeys(passphrase);
      setPassphrase('');
      setActiveSection(null);
    } catch (err: any) {
      setRegenError(err.message || 'Key regeneration failed');
    } finally {
      setIsRegeneratingKeys(false);
    }
  };

  const handleDeleteAllData = async () => {
    if (deleteConfirm !== 'DELETE') return;
    setIsDeleting(true);
    try {
      await db.delete();
      localStorage.clear();
      sessionStorage.clear();
      logout();
    } catch {
      setIsDeleting(false);
    }
  };

  const privacyItems = [
    { icon: Server, label: 'Server data', desc: 'Email, username, public key (no private keys, no content)' },
    { icon: Lock, label: 'Local data', desc: 'All messages, files, tasks, habits — encrypted in IndexedDB' },
    { icon: Globe, label: 'Network', desc: 'Only metadata: sender, recipient, timestamp. Zero plaintext' },
    { icon: Smartphone, label: 'Device', desc: 'Private keys never leave this browser' },
  ];

  const dangerZoneItems = [
    {
      id: 'regen',
      label: 'Regenerate Encryption Keys',
      desc: 'Creates new X25519/Ed25519 keypair. Old encrypted messages become unreadable.',
      variant: 'warn',
      icon: RefreshCw,
    },
    {
      id: 'delete',
      label: 'Delete All Local Data',
      desc: 'Permanently erases all local data including encrypted files, keys, and messages. Irreversible.',
      variant: 'danger',
      icon: Trash2,
    },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="font-semibold text-2xl text-apna-text tracking-tight">Settings & Privacy</h1>
        <p className="text-sm text-apna-muted mt-0.5">Appearance, device protection, and your cryptographic identity.</p>
      </div>

      <div className="liquid-glass rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2"><Sliders className="w-4 h-4 text-apna-accent" /><h3 className="text-sm font-semibold text-apna-text">Space settings</h3></div>
        <div className="flex flex-wrap items-center gap-2">
          {(['light', 'dark', 'amoled'] as const).map((option) => <button key={option} onClick={() => setTheme(option)} className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize border transition-colors ${theme === option ? 'bg-apna-accent text-white border-apna-accent' : 'bg-apna-surface/50 text-apna-muted border-apna-border'}`}>{option}</button>)}
          <button onClick={() => setCustomizeModalOpen(true)} className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-apna-surface/50 text-apna-text border border-apna-border">Choose modules</button>
          <button onClick={lockDeviceNow} className="ml-auto px-3 py-1.5 rounded-xl text-xs font-semibold text-apna-danger bg-rose-500/10 border border-rose-500/20">Lock now</button>
        </div>
      </div>

      {/* Security Score Card */}
      <div className="apna-card p-5">
        <div className="flex items-center gap-4">
          <div
            className="security-score-ring shrink-0"
            style={{ '--pct': `${scorePercent}%` } as any}
          >
            <span className="relative z-10 text-base font-bold" style={{ color: scoreColor }}>
              {securityScore}/4
            </span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="font-semibold text-apna-text">{scoreLabel} Security</p>
              <span
                className="badge text-[10px]"
                style={{ background: `${scoreColor}15`, color: scoreColor }}
              >
                {Math.round(scorePercent)}%
              </span>
            </div>
            <p className="text-xs text-apna-muted mt-0.5">
              {!backupDownloaded && 'Download a backup to improve your score.'}
              {!identityKey && 'Generate encryption keys to enable E2E chat.'}
              {scorePercent === 100 && 'All security checks passed. '}
            </p>
            <div className="mt-2 progress-bar">
              <div className="progress-fill" style={{ width: `${scorePercent}%`, background: `linear-gradient(90deg, ${scoreColor}, ${scoreColor}cc)` }} />
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {[
            { label: 'Identity Keys', done: !!identityKey },
            { label: 'Account Active', done: !!user?.email },
            { label: 'Local Encryption', done: true },
            { label: 'Backup Saved', done: backupDownloaded },
          ].map((check) => (
            <div key={check.label} className="flex items-center gap-2">
              {check.done ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-apna-success shrink-0" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 text-apna-warn shrink-0" />
              )}
              <span className="text-xs text-apna-muted">{check.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Identity Key Card */}
      <div className="apna-card p-5 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Fingerprint className="w-4 h-4 text-apna-accent" />
          <h3 className="text-sm font-semibold text-apna-text">Cryptographic Identity</h3>
        </div>

        {identityKey ? (
          <div className="space-y-3">
            <div className="p-3 bg-apna-surface-2 rounded-xl border border-apna-border">
              <p className="text-[10px] font-semibold text-apna-muted uppercase tracking-widest mb-1.5">Key Fingerprint</p>
              <div className="flex items-center gap-2">
                <p className="mono-text text-sm text-apna-accent font-medium flex-1 truncate">
                  {identityKey.fingerprint}
                </p>
                <button
                  onClick={handleCopyFingerprint}
                  className="p-1.5 rounded-lg hover:bg-apna-border text-apna-faint hover:text-apna-accent transition-colors shrink-0"
                >
                  {copiedFingerprint ? <Check className="w-3.5 h-3.5 text-apna-success" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 bg-apna-surface-2 rounded-xl border border-apna-border">
                <p className="text-[10px] font-semibold text-apna-muted mb-0.5">Encryption</p>
                <p className="text-xs font-medium text-apna-text">X25519</p>
              </div>
              <div className="p-2.5 bg-apna-surface-2 rounded-xl border border-apna-border">
                <p className="text-[10px] font-semibold text-apna-muted mb-0.5">Signing</p>
                <p className="text-xs font-medium text-apna-text">Ed25519</p>
              </div>
              <div className="p-2.5 bg-apna-surface-2 rounded-xl border border-apna-border">
                <p className="text-[10px] font-semibold text-apna-muted mb-0.5">KDF</p>
                <p className="text-xs font-medium text-apna-text">Argon2id</p>
              </div>
              <div className="p-2.5 bg-apna-surface-2 rounded-xl border border-apna-border">
                <p className="text-[10px] font-semibold text-apna-muted mb-0.5">Storage</p>
                <p className="text-xs font-medium text-apna-text">IndexedDB</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-amber-700">No keys found on this device</p>
              <p className="text-xs text-amber-600 mt-0.5">
                Sign out and sign back in to regenerate your encryption keypair.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Discoverability & Messaging Access Controls */}
      <div className="apna-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-apna-accent" />
            <h3 className="text-sm font-semibold text-apna-text">Discoverability & Messaging Access</h3>
          </div>
          {privacySaved && (
            <span className="text-xs text-emerald-600 font-medium flex items-center gap-1 animate-fade-in">
              <Check className="w-3.5 h-3.5" /> Saved
            </span>
          )}
        </div>

        <p className="text-xs text-apna-muted">
          Control how other people can discover you and who has permission to message you on Saanjh.
        </p>

        <div className="space-y-3 pt-1">
          {/* Phone Discovery Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-apna-surface-2 border border-apna-border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Phone className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-apna-text">Discover via Mobile Number</p>
                <p className="text-[11px] text-apna-faint">
                  {user?.phone_number ? `Current: ${user.phone_number}` : 'Allow people with your mobile number to start a chat'}
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={privacySaving}
              onClick={() => handleTogglePrivacy('allow_phone_discovery', !(user?.allow_phone_discovery ?? true))}
              className={`w-11 h-6 rounded-full transition-colors p-0.5 flex items-center shrink-0 ${
                (user?.allow_phone_discovery ?? true) ? 'bg-apna-accent justify-end' : 'bg-stone-300 justify-start'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-white shadow-xs" />
            </button>
          </div>

          {/* Username Discovery Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-apna-surface-2 border border-apna-border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-violet-50 text-apna-accent flex items-center justify-center shrink-0">
                <AtSign className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-apna-text">Discover via Username</p>
                <p className="text-[11px] text-apna-faint">
                  Allow contacts to find you using @{user?.username || 'username'}
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={privacySaving}
              onClick={() => handleTogglePrivacy('allow_username_discovery', !(user?.allow_username_discovery ?? true))}
              className={`w-11 h-6 rounded-full transition-colors p-0.5 flex items-center shrink-0 ${
                (user?.allow_username_discovery ?? true) ? 'bg-apna-accent justify-end' : 'bg-stone-300 justify-start'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-white shadow-xs" />
            </button>
          </div>

          {/* Email Discovery Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-apna-surface-2 border border-apna-border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                <Mail className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-apna-text">Discover via Email</p>
                <p className="text-[11px] text-apna-faint">
                  {user?.email || 'Allow searching by your registered email'}
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={privacySaving}
              onClick={() => handleTogglePrivacy('allow_email_discovery', !(user?.allow_email_discovery ?? true))}
              className={`w-11 h-6 rounded-full transition-colors p-0.5 flex items-center shrink-0 ${
                (user?.allow_email_discovery ?? true) ? 'bg-apna-accent justify-end' : 'bg-stone-300 justify-start'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-white shadow-xs" />
            </button>
          </div>

          {/* Who can message me */}
          <div className="p-3 rounded-xl bg-apna-surface-2 border border-apna-border space-y-2">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-apna-accent" />
              <p className="text-xs font-semibold text-apna-text">Who Can Send You Messages</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleSetMessagingPermission('everyone')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  (user?.messaging_permission || 'everyone') === 'everyone'
                    ? 'bg-white border-apna-accent text-apna-accent shadow-xs'
                    : 'bg-white/50 border-apna-border text-apna-muted hover:border-stone-400'
                }`}
              >
                <p className="text-xs font-bold">Everyone</p>
                <p className="text-[10px] text-apna-faint mt-0.5">Unknown senders arrive as Requests</p>
              </button>

              <button
                type="button"
                onClick={() => handleSetMessagingPermission('contacts_only')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  user?.messaging_permission === 'contacts_only'
                    ? 'bg-white border-apna-accent text-apna-accent shadow-xs'
                    : 'bg-white/50 border-apna-border text-apna-muted hover:border-stone-400'
                }`}
              >
                <p className="text-xs font-bold">People I've Added</p>
                <p className="text-[10px] text-apna-faint mt-0.5">Established contacts & family only</p>
              </button>

              <button
                type="button"
                onClick={() => handleSetMessagingPermission('nobody')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  user?.messaging_permission === 'nobody'
                    ? 'bg-white border-apna-accent text-apna-accent shadow-xs'
                    : 'bg-white/50 border-apna-border text-apna-muted hover:border-stone-400'
                }`}
              >
                <p className="text-xs font-bold">Nobody</p>
                <p className="text-[10px] text-apna-faint mt-0.5">Block all incoming message requests</p>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Device Auto-Lock & Biometrics */}
      <div className="apna-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-apna-accent" />
            <h3 className="text-sm font-semibold text-apna-text">Device Auto-Lock & Quick Unlock</h3>
          </div>
          {privacySaved && (
            <span className="text-xs text-emerald-600 font-medium flex items-center gap-1 animate-fade-in">
              <Check className="w-3.5 h-3.5" /> Saved
            </span>
          )}
        </div>

        <p className="text-xs text-apna-muted">
          Your Master Key is safely held in Web Worker memory and wrapped in IndexedDB using a non-extractable WebCrypto key.
        </p>

        <div className="space-y-3 pt-1">
          {/* Idle Auto-Lock dropdown */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-apna-surface-2 border border-apna-border">
            <div>
              <p className="text-xs font-semibold text-apna-text">Auto-Lock Inactivity Timeout</p>
              <p className="text-[11px] text-apna-faint">
                Automatically lock your vault when device is idle
              </p>
            </div>
            <select
              value={idleTimeout}
              onChange={(e) => handleUpdateIdleTimeout(Number(e.target.value))}
              className="bg-white border border-apna-border rounded-xl px-3 py-1.5 text-xs font-medium text-apna-text focus:outline-none focus:border-apna-accent"
            >
              <option value={0}>Never</option>
              <option value={1440}>1 Day</option>
              <option value={10080}>7 Days (Default)</option>
              <option value={43200}>30 Days</option>
              <option value={-1}>Lock on Close (Shared device)</option>
            </select>
          </div>

          {/* WebAuthn Biometric quick-unlock toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-apna-surface-2 border border-apna-border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-violet-50 text-apna-accent flex items-center justify-center shrink-0">
                <Fingerprint className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-apna-text">Biometric Quick-Unlock (WebAuthn)</p>
                <p className="text-[11px] text-apna-faint">
                  Unlock using Touch ID, Face ID, or Passkeys without typing your password
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleToggleBiometrics(!biometricEnabled)}
              className={`w-11 h-6 rounded-full transition-colors p-0.5 flex items-center shrink-0 ${
                biometricEnabled ? 'bg-apna-accent justify-end' : 'bg-stone-300 justify-start'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-white shadow-xs" />
            </button>
          </div>
        </div>
      </div>

      {/* Backup & Device Ownership (Section 6 & 12) */}
      <div className="apna-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-apna-accent" />
            <h3 className="text-sm font-semibold text-apna-text">Encrypted Device Backup (.apnabackup)</h3>
          </div>
          <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
            lastBackupTime
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
          }`}>
            Last backup: {lastBackupTime ? new Date(lastBackupTime).toLocaleString() : 'Never'}
          </span>
        </div>

        {/* Honest Warning Banner */}
        <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 flex gap-2.5 items-start">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 dark:text-amber-200 leading-relaxed font-medium">
            "Your data lives on your device. We cannot recover it if you lose it without a backup. We do not have it."
          </p>
        </div>

        <div className="p-3 bg-apna-surface-2 rounded-xl border border-apna-border flex gap-2 items-start">
          <Info className="w-3.5 h-3.5 text-apna-muted shrink-0 mt-0.5" />
          <p className="text-xs text-apna-muted leading-relaxed">
            Exports all chats, vault files, notes, tasks, and contacts encrypted with Argon2id and libsodium secretbox using your passphrase.
          </p>
        </div>

        <div className="flex gap-2">
          <button onClick={handleStartExport} className="btn-primary flex-1 text-xs py-2.5">
            <Download className="w-3.5 h-3.5" />
            {lastBackupTime ? 'Export Backup Again' : 'Export Encrypted Backup'}
          </button>
          <label className="btn-secondary flex-1 text-xs py-2.5 cursor-pointer flex items-center justify-center gap-2">
            <Upload className="w-3.5 h-3.5" />
            Restore Backup
            <input type="file" accept=".apnabackup,.json" className="hidden" onChange={handleFileSelectedForRestore} />
          </label>
        </div>

        {uploadStatus === 'success' && (
          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-apna-success flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Backup restored successfully! Reloading...
          </div>
        )}
        {uploadStatus === 'error' && (
          <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-apna-danger flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            Invalid backup file. Please check and try again.
          </div>
        )}
      </div>

      {/* Privacy Ledger (Section 10) */}
      <div className="apna-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-semibold text-apna-text">Privacy Ledger (गोपनीयता बहीखाता)</h3>
          </div>
          <button
            onClick={() => setLedgerOpen(true)}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors"
          >
            Open Live Ledger
          </button>
        </div>
        <p className="text-xs text-apna-muted">
          Inspect where each feature's data lives, exact retention times, and real-time server footprint.
        </p>
      </div>

      {/* Backup Export Modal */}
      {showBackupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-apna-text">Set Backup Passphrase</h3>
            <p className="text-xs text-apna-muted">
              Choose a strong passphrase to encrypt your `.apnabackup` file. Without this passphrase, your backup cannot be decrypted.
            </p>
            <input
              type="password"
              placeholder="Passphrase (minimum 8 characters)"
              value={backupPassphrase}
              onChange={(e) => setBackupPassphrase(e.target.value)}
              className="w-full bg-apna-surface-2 border border-apna-border rounded-xl px-3 py-2 text-xs"
            />
            {backupError && <p className="text-xs text-apna-danger">{backupError}</p>}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowBackupModal(false)}
                className="px-3 py-1.5 rounded-xl text-xs border border-apna-border"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmExport}
                disabled={backupLoading}
                className="btn-primary text-xs px-4 py-1.5"
              >
                {backupLoading ? 'Encrypting...' : 'Export & Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Backup Restore Modal */}
      {showRestoreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-apna-text">Enter Backup Passphrase</h3>
            <p className="text-xs text-apna-muted">
              Enter the passphrase you used when creating this `.apnabackup` archive to decrypt and restore your messages, files, and keys.
            </p>
            <input
              type="password"
              placeholder="Backup Passphrase"
              value={restorePassphrase}
              onChange={(e) => setRestorePassphrase(e.target.value)}
              className="w-full bg-apna-surface-2 border border-apna-border rounded-xl px-3 py-2 text-xs"
            />
            {restoreError && <p className="text-xs text-apna-danger">{restoreError}</p>}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowRestoreModal(false)}
                className="px-3 py-1.5 rounded-xl text-xs border border-apna-border"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRestore}
                disabled={restoreLoading}
                className="btn-primary text-xs px-4 py-1.5"
              >
                {restoreLoading ? 'Decrypting...' : 'Restore Everything'}
              </button>
            </div>
          </div>
        </div>
      )}

      <PrivacyLedgerModal isOpen={ledgerOpen} onClose={() => setLedgerOpen(false)} />

      {/* Privacy Transparency */}
      <div className="apna-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-apna-accent" />
          <h3 className="text-sm font-semibold text-apna-text">What We See (Transparency Log)</h3>
        </div>
        <div className="space-y-2">
          {privacyItems.map((item) => (
            <div key={item.label} className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-apna-surface-2 transition-colors">
              <item.icon className="w-4 h-4 text-apna-muted shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-apna-text">{item.label}</p>
                <p className="text-[11px] text-apna-faint mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="apna-card p-5 space-y-3 border-red-200">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-apna-danger" />
          <h3 className="text-sm font-semibold text-apna-danger">Danger Zone</h3>
        </div>

        {dangerZoneItems.map((item) => (
          <div key={item.id} className="space-y-2">
            <div
              className={`p-3 rounded-xl border cursor-pointer transition-colors ${
                activeSection === item.id
                  ? item.variant === 'danger'
                    ? 'bg-red-50 border-red-200'
                    : 'bg-amber-50 border-amber-200'
                  : 'border-apna-border hover:border-apna-faint'
              }`}
              onClick={() => setActiveSection(activeSection === item.id ? null : item.id)}
            >
              <div className="flex items-center gap-2">
                <item.icon className={`w-4 h-4 shrink-0 ${item.variant === 'danger' ? 'text-apna-danger' : 'text-apna-warn'}`} />
                <div>
                  <p className={`text-xs font-semibold ${item.variant === 'danger' ? 'text-apna-danger' : 'text-amber-700'}`}>
                    {item.label}
                  </p>
                  <p className="text-[11px] text-apna-faint mt-0.5">{item.desc}</p>
                </div>
              </div>
            </div>

            {/* Regen Keys Form */}
            {activeSection === 'regen' && item.id === 'regen' && (
              <form onSubmit={handleRegenerateKeys} className="space-y-2 p-3 bg-amber-50 border border-amber-200 rounded-xl animate-slide-up">
                {regenError && <p className="text-xs text-apna-danger">{regenError}</p>}
                <div className="relative">
                  <input
                    type={showPassphrase ? 'text' : 'password'}
                    placeholder="Confirm passphrase to regenerate"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    required
                    className="apna-input pr-10 text-sm"
                  />
                  <button type="button" onClick={() => setShowPassphrase(!showPassphrase)} className="absolute right-3 top-1/2 -translate-y-1/2 text-apna-faint">
                    {showPassphrase ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button type="submit" disabled={isRegeneratingKeys} className="w-full py-2 rounded-xl bg-amber-600 text-white text-xs font-semibold disabled:opacity-50">
                  {isRegeneratingKeys ? 'Regenerating...' : 'Confirm Regenerate Keys'}
                </button>
              </form>
            )}

            {/* Delete All Data Form */}
            {activeSection === 'delete' && item.id === 'delete' && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-2 animate-slide-up">
                <p className="text-xs font-semibold text-apna-danger">
                  Type <span className="mono-text bg-red-100 px-1 rounded">DELETE</span> to confirm
                </p>
                <input
                  type="text"
                  placeholder="DELETE"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  className="apna-input border-red-300 text-sm"
                />
                <button
                  onClick={handleDeleteAllData}
                  disabled={deleteConfirm !== 'DELETE' || isDeleting}
                  className="w-full py-2 rounded-xl bg-apna-danger text-white text-xs font-semibold disabled:opacity-40"
                >
                  {isDeleting ? 'Deleting...' : 'Permanently Delete Everything'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Sign Out */}
      <button
        onClick={logout}
        className="w-full btn-secondary text-apna-danger border-red-200 hover:bg-red-50"
      >
        <LogOut className="w-4 h-4" />
        Sign Out
      </button>
    </div>
  );
};
