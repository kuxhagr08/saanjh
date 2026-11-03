import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  X,
  Phone,
  Video,
  Search,
  Lock,
  ShieldCheck,
  ShieldAlert,
  Bell,
  BellOff,
  Clock,
  KeyRound,
  Trash2,
  Slash,
  AlertTriangle,
  Download,
  FileText,
  Image as ImageIcon,
  Link2,
  Star,
  Check,
  ChevronRight,
  UserPlus,
  Shield,
} from 'lucide-react';
import { APP_NAME } from '../constants';

export interface ContactInfoProps {
  isOpen: boolean;
  contact: {
    id: number | string;
    displayName?: string;
    username?: string;
    email?: string;
    phone?: string;
    allowEmailDiscovery?: boolean;
    avatarUrl?: string;
    avatarColor?: string;
    verified?: boolean;
    safetyNumber?: string;
    isRequestAccepted?: boolean;
    shareMyPhoneWithContact?: boolean;
    shareMyEmailWithContact?: boolean;
    hasContactSharedPhone?: boolean;
    hasContactSharedEmail?: boolean;
  } | null;
  messages: Array<{
    id?: number;
    plaintext?: string;
    attachment?: {
      type: string;
      fileName?: string;
      fileSize?: number;
      dataUrl?: string;
      url?: string;
    };
    timestamp: number;
    isStarred?: boolean;
  }>;
  isUnknownContact?: boolean;
  isBlocked?: boolean;
  isMuted?: boolean;
  isChatLocked?: boolean;
  disappearingDays?: number;
  onClose: () => void;
  onAudioCall?: () => void;
  onVideoCall?: () => void;
  onSearchInChat?: () => void;
  onOpenVerifySafetyNumber: () => void;
  onAddContact?: () => void;
  onToggleSharePhone?: (shared: boolean) => void;
  onToggleShareEmail?: (shared: boolean) => void;
  onToggleBlock: () => void;
  onReportContact: () => void;
  onToggleMute: (duration: '8h' | '1w' | 'always' | 'unmute') => void;
  onSetDisappearing: (days: number) => void;
  onToggleChatLock: () => void;
  onClearChat: () => void;
  onDeleteChat: () => void;
  onExportChat: (format: 'encrypted' | 'plain') => void;
}

export const ContactInfoScreen: React.FC<ContactInfoProps> = ({
  isOpen,
  contact,
  messages,
  isUnknownContact = false,
  isBlocked = false,
  isMuted = false,
  isChatLocked = false,
  disappearingDays = 0,
  onClose,
  onAudioCall,
  onVideoCall,
  onSearchInChat,
  onOpenVerifySafetyNumber,
  onAddContact,
  onToggleSharePhone,
  onToggleShareEmail,
  onToggleBlock,
  onReportContact,
  onToggleMute,
  onSetDisappearing,
  onToggleChatLock,
  onClearChat,
  onDeleteChat,
  onExportChat,
}) => {
  const [activeTab, setActiveTab] = useState<'media' | 'docs' | 'links'>('media');
  const [muteSheetOpen, setMuteSheetOpen] = useState(false);
  const [disappearingSheetOpen, setDisappearingSheetOpen] = useState(false);
  const [exportSheetOpen, setExportSheetOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow || 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKey);
    }
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen || !contact) return null;

  // Filter attachments
  const mediaItems = messages.filter(
    (m) =>
      m.attachment &&
      (m.attachment.type.startsWith('image') || m.attachment.type.startsWith('video'))
  );
  const docItems = messages.filter(
    (m) =>
      m.attachment &&
      !m.attachment.type.startsWith('image') &&
      !m.attachment.type.startsWith('video')
  );
  const linkItems = messages.filter((m) =>
    m.plaintext?.match(/https?:\/\/[^\s]+/i)
  );

  const starredCount = messages.filter((m) => m.isStarred).length;

  const content = (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-info-title"
        className="fixed inset-0 z-50 flex justify-end pointer-events-auto"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="w-full sm:max-w-md h-full bg-apna-surface border-l border-apna-border shadow-2xl flex flex-col overflow-y-auto animate-slide-left text-apna-text"
        >
        {/* Navigation Top Bar */}
        <div className="sticky top-0 z-20 bg-apna-surface/90 backdrop-blur-md px-4 py-3 border-b border-apna-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 -ml-2 rounded-xl text-apna-muted hover:text-apna-text hover:bg-apna-surface-2 transition-colors cursor-pointer"
              aria-label="Back to chat"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 id="contact-info-title" className="text-sm font-bold text-apna-text">
              Contact Info
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-apna-muted hover:text-apna-text hover:bg-apna-surface-2 transition-colors cursor-pointer hidden sm:block"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Contact Header Block */}
        <div className="p-6 flex flex-col items-center text-center border-b border-apna-border bg-apna-surface">
          <div
            className={`w-24 h-24 rounded-full bg-gradient-to-br ${
              contact.avatarColor || 'from-violet-500 to-indigo-600'
            } border-4 border-apna-surface shadow-xl flex items-center justify-center text-white text-3xl font-bold overflow-hidden mb-3`}
          >
            {contact.avatarUrl ? (
              <img src={contact.avatarUrl} alt={contact.displayName} className="w-full h-full object-cover" />
            ) : (
              (contact.displayName || contact.username || 'U').slice(0, 2).toUpperCase()
            )}
          </div>

          <div className="flex items-center gap-1.5 justify-center">
            <h3 className="text-lg font-bold text-apna-text leading-tight">
              {contact.displayName || `@${contact.username || 'user'}`}
            </h3>
            {contact.verified && <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />}
          </div>

          {/* Privacy Rule: Username is public to all. Phone and email remain hidden by default. */}
          <p className="text-xs text-apna-faint font-semibold mt-1">
            @{contact.username || 'saanjh_user'}
          </p>

          <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5">
            <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              Public @username
            </span>
            {!contact.hasContactSharedPhone && !contact.hasContactSharedEmail && (
              <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-stone-700 flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" />
                Phone & Email Private
              </span>
            )}
          </div>

          {/* Show contact's phone ONLY if contact explicitly shared it */}
          {contact.hasContactSharedPhone && contact.phone && (
            <p className="text-xs text-stone-700 dark:text-stone-200 mt-2 font-mono bg-stone-100 dark:bg-stone-800 px-2.5 py-1 rounded-lg select-all">
              📞 {contact.phone}
            </p>
          )}

          {/* Show contact's email ONLY if contact explicitly shared it */}
          {contact.hasContactSharedEmail && contact.email && (
            <p className="text-xs text-stone-700 dark:text-stone-200 mt-1 font-mono bg-stone-100 dark:bg-stone-800 px-2.5 py-1 rounded-lg select-all">
              ✉️ {contact.email}
            </p>
          )}

          {/* Action Row: Message, Audio, Video, Search */}
          <div className="grid grid-cols-4 gap-2 w-full mt-5">
            <button
              onClick={onClose}
              className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-apna-surface-2 hover:bg-apna-surface border border-apna-border transition-all cursor-pointer group"
            >
              <div className="w-9 h-9 rounded-xl bg-apna-accent text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                <Lock className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-semibold text-apna-text">Message</span>
            </button>

            <button
              onClick={onAudioCall}
              className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-apna-surface-2 hover:bg-apna-surface border border-apna-border transition-all cursor-pointer group"
            >
              <div className="w-9 h-9 rounded-xl bg-violet-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                <Phone className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-semibold text-apna-text">Audio</span>
            </button>

            <button
              onClick={onVideoCall}
              className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-apna-surface-2 hover:bg-apna-surface border border-apna-border transition-all cursor-pointer group"
            >
              <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                <Video className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-semibold text-apna-text">Video</span>
            </button>

            <button
              onClick={onSearchInChat}
              className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl bg-apna-surface-2 hover:bg-apna-surface border border-apna-border transition-all cursor-pointer group"
            >
              <div className="w-9 h-9 rounded-xl bg-stone-700 dark:bg-stone-600 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                <Search className="w-4 h-4" />
              </div>
              <span className="text-[11px] font-semibold text-apna-text">Search</span>
            </button>
          </div>
        </div>

        {/* Unknown Contact Banner */}
        {isUnknownContact && (
          <div className="p-4 bg-amber-500/10 border-b border-amber-500/20 flex flex-col gap-2.5">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>This sender is not in your contacts</span>
            </div>
            <p className="text-[11px] text-apna-faint leading-relaxed">
              Verify their identity before sharing sensitive personal details or files.
            </p>
            <div className="flex items-center gap-2 pt-1">
              {onAddContact && (
                <button
                  onClick={onAddContact}
                  className="flex-1 py-1.5 rounded-xl bg-apna-accent text-white text-xs font-semibold shadow-xs hover:bg-apna-accent-ink cursor-pointer"
                >
                  Add Contact
                </button>
              )}
              <button
                onClick={onToggleBlock}
                className="flex-1 py-1.5 rounded-xl bg-apna-surface-2 border border-apna-border text-xs font-semibold text-apna-text hover:bg-rose-500/10 hover:text-rose-500 cursor-pointer"
              >
                Block
              </button>
              <button
                onClick={onReportContact}
                className="py-1.5 px-3 rounded-xl bg-apna-surface-2 border border-apna-border text-xs font-semibold text-rose-500 hover:bg-rose-500/10 cursor-pointer"
              >
                Report
              </button>
            </div>
          </div>
        )}

        {/* Contact Privacy Controls & Mutual Sharing */}
        <div className="p-4 border-b border-apna-border space-y-3 bg-stone-50/70 dark:bg-white/[0.02]">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="text-xs font-bold text-apna-text flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-apna-accent" />
                <span>Contact Sharing Privacy</span>
              </h4>
              <p className="text-[11px] text-apna-faint mt-0.5 leading-relaxed">
                Your @username is public. Your phone number and email are hidden by default until you choose to reveal them to this contact.
              </p>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            {/* Share Phone Toggle */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-apna-surface border border-apna-border shadow-2xs">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-apna-text">Share my phone number</p>
                <p className="text-[10px] text-apna-faint">
                  {contact.shareMyPhoneWithContact ? 'Visible to this contact' : 'Hidden (Private)'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onToggleSharePhone?.(!contact.shareMyPhoneWithContact)}
                className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${
                  contact.shareMyPhoneWithContact ? 'bg-emerald-600' : 'bg-stone-300 dark:bg-stone-700'
                }`}
                title="Toggle sharing your phone number with this contact"
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white shadow-xs transition-transform absolute top-0.5 ${
                    contact.shareMyPhoneWithContact ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            {/* Share Email Toggle */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-apna-surface border border-apna-border shadow-2xs">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-apna-text">Share my email address</p>
                <p className="text-[10px] text-apna-faint">
                  {contact.shareMyEmailWithContact ? 'Visible to this contact' : 'Hidden (Private)'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onToggleShareEmail?.(!contact.shareMyEmailWithContact)}
                className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${
                  contact.shareMyEmailWithContact ? 'bg-emerald-600' : 'bg-stone-300 dark:bg-stone-700'
                }`}
                title="Toggle sharing your email address with this contact"
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white shadow-xs transition-transform absolute top-0.5 ${
                    contact.shareMyEmailWithContact ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Encryption Block (Section D) */}
        <div className="p-4 border-b border-apna-border">
          <button
            onClick={onOpenVerifySafetyNumber}
            className="w-full p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between text-left hover:bg-emerald-500/15 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-apna-text">
                  Encryption: Verified E2E
                </p>
                <p className="text-[11px] text-apna-faint mt-0.5">
                  Messages and calls are end-to-end encrypted. Tap to verify safety number.
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-emerald-600 group-hover:translate-x-0.5 transition-transform shrink-0" />
          </button>
        </div>

        {/* Media, Docs & Links Segmented Tabs */}
        <div className="p-4 border-b border-apna-border space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-apna-text">Media, Docs & Links</span>
            <span className="text-xs text-apna-faint font-semibold">
              {mediaItems.length + docItems.length + linkItems.length}
            </span>
          </div>

          <div className="flex p-1 rounded-xl bg-apna-surface-2 border border-apna-border text-xs">
            <button
              onClick={() => setActiveTab('media')}
              className={`flex-1 py-1.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'media'
                  ? 'bg-apna-surface text-apna-accent shadow-xs'
                  : 'text-apna-muted hover:text-apna-text'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Media ({mediaItems.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('docs')}
              className={`flex-1 py-1.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'docs'
                  ? 'bg-apna-surface text-apna-accent shadow-xs'
                  : 'text-apna-muted hover:text-apna-text'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Docs ({docItems.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('links')}
              className={`flex-1 py-1.5 rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'links'
                  ? 'bg-apna-surface text-apna-accent shadow-xs'
                  : 'text-apna-muted hover:text-apna-text'
              }`}
            >
              <Link2 className="w-3.5 h-3.5" />
              <span>Links ({linkItems.length})</span>
            </button>
          </div>

          {/* Tab Panes */}
          <div className="min-h-[100px] max-h-48 overflow-y-auto">
            {activeTab === 'media' && (
              mediaItems.length > 0 ? (
                <div className="grid grid-cols-3 gap-1.5">
                  {mediaItems.map((m, idx) => (
                    <div
                      key={idx}
                      className="aspect-square rounded-xl overflow-hidden bg-stone-900 border border-apna-border"
                    >
                      <img
                        src={m.attachment?.dataUrl || m.attachment?.url}
                        alt="Media"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center py-6 text-xs text-apna-faint">No media shared yet</p>
              )
            )}

            {activeTab === 'docs' && (
              docItems.length > 0 ? (
                <div className="space-y-1.5">
                  {docItems.map((d, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-apna-surface-2 border border-apna-border flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FileText className="w-4 h-4 text-apna-accent shrink-0" />
                        <span className="truncate text-apna-text font-medium">
                          {d.attachment?.fileName || 'Document'}
                        </span>
                      </div>
                      <span className="text-[10px] text-apna-faint shrink-0 ml-2">
                        {Math.round((d.attachment?.fileSize || 1024) / 1024)} KB
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center py-6 text-xs text-apna-faint">No documents shared yet</p>
              )
            )}

            {activeTab === 'links' && (
              linkItems.length > 0 ? (
                <div className="space-y-1.5">
                  {linkItems.map((l, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-apna-surface-2 border border-apna-border text-xs space-y-1"
                    >
                      <div className="flex items-center gap-1.5 text-apna-accent font-semibold">
                        <Link2 className="w-3.5 h-3.5" />
                        <span className="truncate">{l.plaintext}</span>
                      </div>
                      <span className="text-[10px] text-apna-faint block">
                        {new Date(l.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center py-6 text-xs text-apna-faint">No links shared yet</p>
              )
            )}
          </div>
        </div>

        {/* Settings & Controls Block */}
        <div className="p-4 border-b border-apna-border space-y-1">
          <button
            onClick={() => {}}
            className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-apna-surface-2 transition-colors text-left cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <Star className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-semibold text-apna-text">Starred Messages</span>
            </div>
            <span className="text-xs text-apna-faint font-bold">{starredCount}</span>
          </button>

          <button
            onClick={() => setMuteSheetOpen(!muteSheetOpen)}
            className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-apna-surface-2 transition-colors text-left cursor-pointer"
          >
            <div className="flex items-center gap-3">
              {isMuted ? <BellOff className="w-4 h-4 text-rose-500" /> : <Bell className="w-4 h-4 text-apna-muted" />}
              <div>
                <span className="text-xs font-semibold text-apna-text">Mute Notifications</span>
                <p className="text-[10px] text-apna-faint">
                  {isMuted ? 'Muted' : 'Sound & vibration on'}
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-apna-faint" />
          </button>

          {muteSheetOpen && (
            <div className="p-2 bg-apna-surface-2 rounded-xl space-y-1 my-1 text-xs font-medium">
              {(['8h', '1w', 'always', 'unmute'] as const).map((dur) => (
                <button
                  key={dur}
                  onClick={() => {
                    onToggleMute(dur);
                    setMuteSheetOpen(false);
                  }}
                  className="w-full px-3 py-2 rounded-lg text-left hover:bg-apna-surface flex items-center justify-between cursor-pointer"
                >
                  <span className="capitalize">{dur === 'unmute' ? 'Unmute' : dur}</span>
                  {((dur === 'always' && isMuted) || (dur === 'unmute' && !isMuted)) && (
                    <Check className="w-3.5 h-3.5 text-apna-accent" />
                  )}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => setDisappearingSheetOpen(!disappearingSheetOpen)}
            className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-apna-surface-2 transition-colors text-left cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <Clock className="w-4 h-4 text-sky-500" />
              <div>
                <span className="text-xs font-semibold text-apna-text">Disappearing Messages</span>
                <p className="text-[10px] text-apna-faint">
                  {disappearingDays === 0 ? 'Off' : `${disappearingDays} day${disappearingDays > 1 ? 's' : ''}`}
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-apna-faint" />
          </button>

          {disappearingSheetOpen && (
            <div className="p-2 bg-apna-surface-2 rounded-xl space-y-1 my-1 text-xs font-medium">
              {[
                { days: 0, label: 'Off' },
                { days: 1, label: '24 Hours' },
                { days: 7, label: '7 Days' },
                { days: 90, label: '90 Days' },
              ].map((opt) => (
                <button
                  key={opt.days}
                  onClick={() => {
                    onSetDisappearing(opt.days);
                    setDisappearingSheetOpen(false);
                  }}
                  className="w-full px-3 py-2 rounded-lg text-left hover:bg-apna-surface flex items-center justify-between cursor-pointer"
                >
                  <span>{opt.label}</span>
                  {disappearingDays === opt.days && <Check className="w-3.5 h-3.5 text-apna-accent" />}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between p-3 rounded-xl hover:bg-apna-surface-2 transition-colors">
            <div className="flex items-center gap-3">
              <KeyRound className="w-4 h-4 text-indigo-500" />
              <div>
                <span className="text-xs font-semibold text-apna-text">Chat Lock</span>
                <p className="text-[10px] text-apna-faint">
                  Requires device biometric/passphrase to view
                </p>
              </div>
            </div>
            <button
              onClick={onToggleChatLock}
              className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer ${
                isChatLocked ? 'bg-apna-accent' : 'bg-apna-border'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform absolute top-0.5 ${
                  isChatLocked ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="p-4 space-y-1 mt-auto">
          <button
            onClick={() => setExportSheetOpen(!exportSheetOpen)}
            className="w-full flex items-center gap-3 p-3 rounded-xl text-xs font-medium text-apna-text hover:bg-apna-surface-2 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-apna-muted" />
            <span>Export Chat</span>
          </button>

          {exportSheetOpen && (
            <div className="p-2 bg-apna-surface-2 rounded-xl space-y-1 mb-2 text-xs">
              <button
                onClick={() => {
                  onExportChat('encrypted');
                  setExportSheetOpen(false);
                }}
                className="w-full px-3 py-2 rounded-lg text-left hover:bg-apna-surface cursor-pointer"
              >
                Export Encrypted Backup (.apnabackup)
              </button>
              <button
                onClick={() => {
                  onExportChat('plain');
                  setExportSheetOpen(false);
                }}
                className="w-full px-3 py-2 rounded-lg text-left hover:bg-apna-surface cursor-pointer"
              >
                Export Plaintext Archive (.json)
              </button>
            </div>
          )}

          <button
            onClick={onClearChat}
            className="w-full flex items-center gap-3 p-3 rounded-xl text-xs font-medium text-amber-600 hover:bg-amber-500/10 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Clear Chat History</span>
          </button>

          <button
            onClick={onToggleBlock}
            className="w-full flex items-center gap-3 p-3 rounded-xl text-xs font-medium text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
          >
            <Slash className="w-4 h-4" />
            <span>{isBlocked ? 'Unblock Contact' : 'Block Contact'}</span>
          </button>

          <button
            onClick={onReportContact}
            className="w-full flex items-center gap-3 p-3 rounded-xl text-xs font-medium text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Report Contact</span>
          </button>

          <button
            onClick={onDeleteChat}
            className="w-full flex items-center gap-3 p-3 rounded-xl text-xs font-medium text-rose-700 hover:bg-rose-500/15 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete Chat and Purge Keys</span>
          </button>
        </div>
      </div>
      </div>
    </>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
};

