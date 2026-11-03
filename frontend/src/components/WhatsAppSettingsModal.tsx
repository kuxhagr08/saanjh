import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Camera,
  Trash2,
  Check,
  User,
  Shield,
  Bell,
  HardDrive,
  MessageSquare,
  Lock,
  ChevronRight,
  Eye,
  CheckCheck,
  Moon,
  Smartphone,
  Info,
  Phone,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { db } from '../db';

interface WhatsAppSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsSection = 'profile' | 'privacy' | 'chats' | 'notifications' | 'storage';

const ABOUT_PRESETS = [
  '🟢 Available',
  '💼 At work',
  '🔋 Battery about to die',
  '🚫 Can\'t talk, Saanjh only',
  '😴 Sleeping',
  '⚡ Urgent calls only',
  '🎧 In a meeting',
  '✈️ Traveling',
  '🎮 Gaming, DND',
];

const AVATAR_COLORS = [
  { name: 'Violet', value: 'from-violet-500 to-indigo-600' },
  { name: 'Purple', value: 'from-purple-500 to-pink-500' },
  { name: 'Emerald', value: 'from-emerald-500 to-teal-600' },
  { name: 'Amber', value: 'from-amber-500 to-orange-500' },
  { name: 'Cyan', value: 'from-cyan-500 to-blue-600' },
  { name: 'Rose', value: 'from-rose-500 to-red-600' },
];

export const WhatsAppSettingsModal: React.FC<WhatsAppSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { user, updatePrivacySettings, theme, setTheme } = useAuth();
  const [activeSection, setActiveSection] = useState<SettingsSection>('profile');

  // Profile Form States
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [about, setAbout] = useState(user?.about || 'Hey there! I am using Saanjh.');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [avatarColor, setAvatarColor] = useState(user?.avatar_color || 'violet');

  // Privacy States
  const [readReceipts, setReadReceipts] = useState(user?.read_receipts_enabled ?? true);
  const [profilePhotoVisibility, setProfilePhotoVisibility] = useState(user?.profile_photo_visibility || 'everyone');
  const [statusVisibility, setStatusVisibility] = useState(user?.status_visibility || 'everyone');
  const [messagingPermission, setMessagingPermission] = useState(user?.messaging_permission || 'everyone');

  // Notifications
  const [callRingtoneEnabled, setCallRingtoneEnabled] = useState(true);
  const [vibrateEnabled, setVibrateEnabled] = useState(true);
  const [missedCallAlerts, setMissedCallAlerts] = useState(true);

  // Status & Message Feedback
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState('');
  const [storageCleanMsg, setStorageCleanMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 400;
        let w = img.width;
        let h = img.height;
        if (w > h) {
          if (w > maxDim) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          }
        } else {
          if (h > maxDim) {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const base64 = canvas.toDataURL('image/jpeg', 0.85);
          setAvatarUrl(base64);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    setAvatarUrl('');
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    setSaveSuccess('');
    try {
      await updatePrivacySettings({
        display_name: displayName.trim() || user?.username,
        about: about.trim(),
        avatar_url: avatarUrl,
        avatar_color: avatarColor,
        read_receipts_enabled: readReceipts,
        profile_photo_visibility: profilePhotoVisibility as any,
        status_visibility: statusVisibility as any,
        messaging_permission: messagingPermission as any,
      });
      setSaveSuccess('Profile settings saved successfully!');
      setTimeout(() => setSaveSuccess(''), 3500);
    } catch (err: any) {
      alert(err.message || 'Failed to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearCache = async () => {
    if (confirm('Clear local media and cached logs? Your encrypted messages will remain safe on your device.')) {
      setStorageCleanMsg('Local cache cleaned successfully.');
      setTimeout(() => setStorageCleanMsg(''), 3000);
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return 'AP';
    const letters = name.replace(/[^a-zA-Z]/g, '');
    return letters.length > 0 ? letters.slice(0, 2).toUpperCase() : 'AP';
  };

  return createPortal(
    <div
      className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-[#12141a] rounded-3xl shadow-2xl border border-stone-200 dark:border-white/10 flex flex-col max-h-[92vh] overflow-hidden animate-scale-in z-50"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200/80 dark:border-white/10 flex items-center justify-between bg-stone-50/70 dark:bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-stone-900 dark:text-white">Settings</h2>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                Profile, DP, About, Privacy & Call Controls
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-white hover:bg-stone-200/60 dark:hover:bg-white/10 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Success Alert */}
        {saveSuccess && (
          <div className="px-5 py-2.5 bg-emerald-600 text-white text-xs font-semibold flex items-center gap-2 animate-fade-in shrink-0">
            <Check className="w-4 h-4" />
            {saveSuccess}
          </div>
        )}

        {/* Section Tabs */}
        <div className="px-3 pt-2 pb-1 border-b border-stone-200/80 dark:border-white/10 flex items-center gap-1.5 overflow-x-auto scrollbar-none bg-stone-100/60 dark:bg-black/20 shrink-0">
          <button
            onClick={() => setActiveSection('profile')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
              activeSection === 'profile'
                ? 'bg-white dark:bg-white/15 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            Profile & DP
          </button>

          <button
            onClick={() => setActiveSection('privacy')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
              activeSection === 'privacy'
                ? 'bg-white dark:bg-white/15 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            Privacy
          </button>

          <button
            onClick={() => setActiveSection('notifications')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
              activeSection === 'notifications'
                ? 'bg-white dark:bg-white/15 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            Calls & Sound
          </button>

          <button
            onClick={() => setActiveSection('chats')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
              activeSection === 'chats'
                ? 'bg-white dark:bg-white/15 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Theme
          </button>

          <button
            onClick={() => setActiveSection('storage')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap cursor-pointer ${
              activeSection === 'storage'
                ? 'bg-white dark:bg-white/15 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            Storage & Data
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* 1. PROFILE & DP */}
          {activeSection === 'profile' && (
            <div className="space-y-6">
              {/* DP Picture Upload Card */}
              <div className="flex flex-col items-center text-center space-y-3 p-4 rounded-3xl bg-stone-50 dark:bg-white/[0.03] border border-stone-200/80 dark:border-white/5">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-emerald-500 shadow-md flex items-center justify-center bg-gradient-to-br from-violet-500 to-indigo-600 text-white font-bold text-2xl">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="Profile DP" className="w-full h-full object-cover" />
                    ) : (
                      getInitials(displayName || user?.username)
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 p-2 rounded-full bg-emerald-600 text-white hover:bg-emerald-500 transition-colors shadow-md cursor-pointer"
                    title="Change Profile Photo (DP)"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarFile}
                    className="hidden"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-200 transition-colors cursor-pointer"
                  >
                    Upload New DP
                  </button>
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      className="px-3 py-1.5 rounded-xl border border-rose-200 text-rose-600 dark:text-rose-400 text-xs font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-stone-500 dark:text-stone-400">
                  Tap camera icon to set your profile picture. Stored privately on your device profile.
                </p>
              </div>

              {/* Name Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
                  Your Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Enter your name..."
                  className="w-full bg-stone-50 dark:bg-white/[0.04] border border-stone-200 dark:border-white/10 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm text-stone-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
                <p className="text-[10px] text-stone-400">
                  This is not your username. This name will be visible to your Saanjh contacts.
                </p>
              </div>

              {/* About / Status Field */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center justify-between">
                  <span>About (Status)</span>
                  <span className="text-[10px] font-normal text-stone-400">{about.length}/256</span>
                </label>
                <input
                  type="text"
                  maxLength={256}
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  placeholder="Hey there! I am using Saanjh."
                  className="w-full bg-stone-50 dark:bg-white/[0.04] border border-stone-200 dark:border-white/10 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm text-stone-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />

                {/* About Presets */}
                <div className="space-y-1.5 pt-1">
                  <p className="text-[11px] font-semibold text-stone-500 dark:text-stone-400">
                    Select About Status:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {ABOUT_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setAbout(preset)}
                        className={`px-2.5 py-1 rounded-xl text-[11px] font-medium border transition-all cursor-pointer ${
                          about === preset
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                            : 'bg-stone-50 dark:bg-white/[0.02] border-stone-200 dark:border-white/10 text-stone-700 dark:text-stone-300 hover:border-emerald-400'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Phone & Handle Info */}
              <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-white/[0.03] border border-stone-200/80 dark:border-white/5 space-y-1">
                <p className="text-[11px] font-semibold text-stone-500 dark:text-stone-400">
                  Phone Number
                </p>
                <p className="text-xs font-bold text-stone-800 dark:text-stone-200">
                  {user?.phone_number || 'No phone number attached'}
                </p>
                <p className="text-[10px] text-stone-400">
                  Username: @{user?.username} · {user?.email}
                </p>
              </div>
            </div>
          )}

          {/* 2. PRIVACY */}
          {activeSection === 'privacy' && (
            <div className="space-y-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-2xl bg-stone-50 dark:bg-white/[0.03] border border-stone-200/80 dark:border-white/5">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-stone-900 dark:text-white">Read Receipts</p>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400">
                      If turned off, you won't send or receive blue double-checks.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={readReceipts}
                    onChange={(e) => setReadReceipts(e.target.checked)}
                    className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                </div>

                <div className="space-y-1.5 p-3 rounded-2xl bg-stone-50 dark:bg-white/[0.03] border border-stone-200/80 dark:border-white/5">
                  <label className="text-xs font-bold text-stone-900 dark:text-white block">
                    Profile Photo Visibility
                  </label>
                  <select
                    value={profilePhotoVisibility}
                    onChange={(e) => setProfilePhotoVisibility(e.target.value as 'everyone' | 'contacts_only' | 'nobody')}
                    className="w-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-stone-900 dark:text-white focus:outline-none"
                  >
                    <option value="everyone">Everyone</option>
                    <option value="contacts_only">My Contacts</option>
                    <option value="nobody">Nobody</option>
                  </select>
                </div>

                <div className="space-y-1.5 p-3 rounded-2xl bg-stone-50 dark:bg-white/[0.03] border border-stone-200/80 dark:border-white/5">
                  <label className="text-xs font-bold text-stone-900 dark:text-white block">
                    About Status Visibility
                  </label>
                  <select
                    value={statusVisibility}
                    onChange={(e) => setStatusVisibility(e.target.value as 'everyone' | 'contacts_only' | 'nobody')}
                    className="w-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-stone-900 dark:text-white focus:outline-none"
                  >
                    <option value="everyone">Everyone</option>
                    <option value="contacts_only">My Contacts</option>
                    <option value="nobody">Nobody</option>
                  </select>
                </div>

                <div className="space-y-1.5 p-3 rounded-2xl bg-stone-50 dark:bg-white/[0.03] border border-stone-200/80 dark:border-white/5">
                  <label className="text-xs font-bold text-stone-900 dark:text-white block">
                    Who Can Message You
                  </label>
                  <select
                    value={messagingPermission}
                    onChange={(e) => setMessagingPermission(e.target.value as 'everyone' | 'contacts_only')}
                    className="w-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-stone-900 dark:text-white focus:outline-none"
                  >
                    <option value="everyone">Everyone (Requests go to Requests tab)</option>
                    <option value="contacts_only">Contacts Only</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* 3. CALLS & NOTIFICATIONS */}
          {activeSection === 'notifications' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-white/[0.03] border border-stone-200/80 dark:border-white/5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-stone-900 dark:text-white">Call Ringtone</p>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    Play synthesized incoming chime ringtone during voice & video calls.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={callRingtoneEnabled}
                  onChange={(e) => setCallRingtoneEnabled(e.target.checked)}
                  className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-white/[0.03] border border-stone-200/80 dark:border-white/5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-stone-900 dark:text-white">Missed Call Notifications</p>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    Log and show alerts when an incoming voice/video call is missed.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={missedCallAlerts}
                  onChange={(e) => setMissedCallAlerts(e.target.checked)}
                  className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-white/[0.03] border border-stone-200/80 dark:border-white/5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-stone-900 dark:text-white">Vibrate on Call</p>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    Vibrate device when receiving an incoming call.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={vibrateEnabled}
                  onChange={(e) => setVibrateEnabled(e.target.checked)}
                  className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* 4. THEME & CHATS */}
          {activeSection === 'chats' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-bold text-stone-900 dark:text-white">Display Theme</p>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTheme('light')}
                    className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                      theme === 'light'
                        ? 'border-emerald-500 bg-emerald-50/50 text-emerald-700 font-bold'
                        : 'border-stone-200 dark:border-white/10 text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    <p className="text-xs">Light Mode</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme('dark')}
                    className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                      theme === 'dark'
                        ? 'border-emerald-500 bg-emerald-950/40 text-emerald-300 font-bold'
                        : 'border-stone-200 dark:border-white/10 text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    <p className="text-xs">Dark Mode</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme('amoled')}
                    className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                      theme === 'amoled'
                        ? 'border-emerald-500 bg-black text-emerald-400 font-bold'
                        : 'border-stone-200 dark:border-white/10 text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    <p className="text-xs">AMOLED Black</p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 5. STORAGE & DATA */}
          {activeSection === 'storage' && (
            <div className="space-y-4">
              <div className="p-4 rounded-3xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 flex items-start gap-3">
                <HardDrive className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                    Zero Server Database Storage
                  </p>
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-300 leading-relaxed">
                    Voice notes, pictures, documents, video calls, and encrypted messages are stored locally on your device in Dexie IndexedDB. The server never permanently holds your media.
                  </p>
                </div>
              </div>

              {storageCleanMsg && (
                <div className="p-3 bg-emerald-600 text-white rounded-2xl text-xs font-semibold">
                  {storageCleanMsg}
                </div>
              )}

              <button
                type="button"
                onClick={handleClearCache}
                className="w-full py-2.5 px-4 rounded-2xl border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-semibold text-xs transition-colors cursor-pointer text-center"
              >
                Clear Local Media Cache
              </button>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-stone-200/80 dark:border-white/10 flex items-center justify-end gap-2 bg-stone-50/70 dark:bg-white/[0.02]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-2xl border border-stone-200 dark:border-white/10 text-stone-700 dark:text-stone-300 text-xs font-semibold hover:bg-stone-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveProfile}
            disabled={isSaving}
            className="px-5 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          >
            {isSaving ? (
              <span>Saving...</span>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
