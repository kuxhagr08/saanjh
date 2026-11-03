import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, Eye, EyeOff, ArrowRight, Shield, Fingerprint, LogOut, KeyRound } from 'lucide-react';

interface Props {
  reason?: 'EXPLICIT_LOCK' | 'IDLE_TIMEOUT' | 'LOCK_ON_CLOSE';
  onUnlocked?: () => void;
}

export const InlineUnlockScreen: React.FC<Props> = ({ reason, onUnlocked }) => {
  const { user, unlockDevice, logout } = useAuth();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [useRecovery, setUseRecovery] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState('');

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsUnlocking(true);

    try {
      const ok = await unlockDevice(useRecovery ? recoveryKey : password);
      if (ok) {
        onUnlocked?.();
      } else {
        setError(useRecovery ? 'Invalid recovery key.' : 'Incorrect password. Please try again.');
      }
    } catch (err: any) {
      setError(err.message || 'Unlock failed. Please check credentials.');
    } finally {
      setIsUnlocking(false);
    }
  };

  const getReasonText = () => {
    switch (reason) {
      case 'IDLE_TIMEOUT':
        return 'Locked automatically after inactivity to protect your private space.';
      case 'LOCK_ON_CLOSE':
        return 'Locked on browser close as configured for shared device safety.';
      case 'EXPLICIT_LOCK':
      default:
        return 'Your private space is locked. Enter your password to continue.';
    }
  };

  const initials = user?.display_name
    ? user.display_name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : user?.username?.slice(0, 2).toUpperCase() || 'AP';

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl p-8 border border-stone-200/80 shadow-xl shadow-stone-200/50 text-center animate-slide-up">
        {/* User Avatar with Shield lock */}
        <div className="relative inline-block mb-4">
          <div className="w-16 h-16 rounded-full bg-apna-accent text-white flex items-center justify-center text-xl font-bold shadow-md shadow-apna-accent/25 mx-auto">
            {initials}
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-stone-900 text-white flex items-center justify-center border-2 border-white">
            <Lock className="w-3 h-3 text-amber-400" />
          </div>
        </div>

        <h2 className="text-xl font-bold text-stone-900 tracking-tight">
          Welcome back, {user?.display_name || user?.username}
        </h2>
        <p className="text-xs text-stone-500 mt-1.5 leading-relaxed">
          {getReasonText()}
        </p>

        {error && (
          <div className="mt-4 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 animate-fade-in text-left">
            {error}
          </div>
        )}

        <form onSubmit={handleUnlock} className="mt-5 space-y-3.5 text-left">
          <button
            type="button"
            onClick={async () => {
              try {
                const { quickUnlockWithBiometrics } = await import('../utils/deviceSecurity');
                const ok = await quickUnlockWithBiometrics();
                if (ok) {
                  onUnlocked?.();
                  window.location.reload();
                } else {
                  setError('Biometric authentication could not be verified. Please enter your password.');
                }
              } catch {
                setError('Biometric sensor unavailable.');
              }
            }}
            className="w-full py-2.5 px-3 rounded-xl bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200 text-xs font-semibold transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
          >
            <Fingerprint className="w-4 h-4 text-violet-600" />
            Quick Unlock with Biometrics
          </button>

          {!useRecovery ? (
            <div>
              <label className="block text-[11px] font-semibold text-stone-700 mb-1 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoFocus
                  placeholder="Enter your password..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#6A4CFF]/20 focus:border-[#6A4CFF] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-[11px] font-semibold text-stone-700 mb-1 uppercase tracking-wider">
                Master Recovery Key
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="APNA-REC-XXXX-XXXX"
                  value={recoveryKey}
                  onChange={(e) => setRecoveryKey(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-stone-900 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#6A4CFF]/20 focus:border-[#6A4CFF] transition-all"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isUnlocking}
            className="w-full py-3 px-4 rounded-xl bg-[#6A4CFF] hover:bg-[#5838F5] text-white text-xs font-semibold shadow-md shadow-[#6A4CFF]/20 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {isUnlocking ? 'Unwrapping Keys...' : 'Unlock Space'}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        <div className="mt-4 pt-4 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
          <button
            type="button"
            onClick={() => {
              setUseRecovery(!useRecovery);
              setError('');
            }}
            className="hover:text-stone-900 transition-colors text-[11px] flex items-center gap-1"
          >
            <KeyRound className="w-3 h-3 text-[#6A4CFF]" />
            {useRecovery ? 'Use password instead' : 'Use recovery key'}
          </button>

          <button
            type="button"
            onClick={logout}
            className="hover:text-rose-600 transition-colors text-[11px] flex items-center gap-1"
          >
            <LogOut className="w-3 h-3" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};
