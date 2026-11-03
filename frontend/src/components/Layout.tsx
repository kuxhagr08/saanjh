import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Home,
  MessageSquare,
  Lock,
  Sparkles,
  Compass,
  BarChart2,
  Shield,
  Plus,
  X,
  CheckCircle2,
  FileText,
  LogOut,
  Search,
  Command,
  Sun,
  Moon,
  Flame,
  Bell,
  ChevronDown,
  LayoutGrid,
  Users,
  Sliders,
  Smartphone,
  Settings,
} from 'lucide-react';
import { db } from '../db';
import { InlineUnlockScreen } from './InlineUnlockScreen';
import { useCustomization } from '../context/CustomizationContext';
import { CustomizeModal } from './CustomizeModal';
import { WhatsAppSettingsModal } from './WhatsAppSettingsModal';
import { AppContainer } from './AppContainer';
import { MotivePulse } from './MotivePulse';

interface Props {
  children: React.ReactNode;
}

const allNavItems = [
  { id: 'home', to: '/', icon: Home, label: 'Home' },
  { id: 'messages', to: '/messages', icon: MessageSquare, label: 'Chat' },
  { id: 'social', to: '/social', icon: Users, label: 'Samaj' },
  { id: 'planner', to: '/planner', icon: Compass, label: 'Planner' },
  { id: 'vault', to: '/vault', icon: Lock, label: 'Vault' },
  { id: 'ai', to: '/ai', icon: Sparkles, label: 'AI' },
  { id: 'growth', to: '/growth', icon: BarChart2, label: 'Growth' },
  { id: 'security', to: '/security', icon: Shield, label: 'Security' },
];

export const Layout: React.FC<Props> = ({ children }) => {
  const { user, logout, theme, setTheme, isDeviceLocked, lockReason, lockDeviceNow } = useAuth();
  const { isModuleEnabled, mobileTabs, customizeModalOpen, setCustomizeModalOpen } = useCustomization();
  const navigate = useNavigate();
  const location = useLocation();
  const isChatRoute = location.pathname === '/messages';
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddType, setQuickAddType] = useState<'task' | 'note' | 'habit' | null>(null);
  const [quickTitle, setQuickTitle] = useState('');
  const [quickDetail, setQuickDetail] = useState('');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [headerMoreOpen, setHeaderMoreOpen] = useState(false);
  const [notification, setNotification] = useState<{ title: string; body: string } | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isStoryOpen, setIsStoryOpen] = useState(false);
  const paletteRef = useRef<HTMLDivElement>(null);
  const headerMoreRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const headerMoreBtnRef = useRef<HTMLButtonElement>(null);
  const profileBtnRef = useRef<HTMLButtonElement>(null);

  const toggleHeaderMore = () => {
    setHeaderMoreOpen((prev) => {
      if (!prev) setProfileOpen(false);
      return !prev;
    });
  };

  const toggleProfile = () => {
    setProfileOpen((prev) => {
      if (!prev) setHeaderMoreOpen(false);
      return !prev;
    });
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (headerMoreRef.current && !headerMoreRef.current.contains(target)) {
        setHeaderMoreOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(target)) {
        setProfileOpen(false);
      }
    };
    if (headerMoreOpen || profileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [headerMoreOpen, profileOpen]);

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('amoled');
    else setTheme('light');
  };

  const enabledNavItems = allNavItems.filter((item) => isModuleEnabled(item.id));

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen((p) => !p);
      }
      if (e.key === 'Escape') {
        setPaletteOpen(false);
        setQuickAddOpen(false);
        if (headerMoreOpen) {
          setHeaderMoreOpen(false);
          headerMoreBtnRef.current?.focus();
        }
        if (profileOpen) {
          setProfileOpen(false);
          profileBtnRef.current?.focus();
        }
        setMoreMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => setIsChatOpen(!!(event as CustomEvent<boolean>).detail);
    window.addEventListener('saanjh_chat_open', handler);
    return () => window.removeEventListener('saanjh_chat_open', handler);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => setIsStoryOpen(!!(event as CustomEvent<boolean>).detail);
    window.addEventListener('saanjh_story_open', handler);
    return () => window.removeEventListener('saanjh_story_open', handler);
  }, []);

  useEffect(() => {
    if (quickAddOpen || paletteOpen || moreMenuOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [quickAddOpen, paletteOpen, moreMenuOpen]);

  useEffect(() => {
    const showNotification = (event: Event) => {
      const detail = (event as CustomEvent<{ title?: string; body?: string }>).detail;
      setNotification({ title: detail?.title || 'New message', body: detail?.body || 'You have a new encrypted message.' });
      window.setTimeout(() => setNotification(null), 5500);
    };
    window.addEventListener('apna_notification', showNotification);
    return () => window.removeEventListener('apna_notification', showNotification);
  }, []);

  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;

    try {
      if (quickAddType === 'task') {
        await db.tasks.add({
          title: quickTitle,
          status: 'todo',
          priority: 'medium',
          tags: [],
          createdAt: Date.now(),
        });
      } else if (quickAddType === 'note') {
        await db.notes.add({
          title: quickTitle,
          content: quickDetail,
          tags: [],
          isPinned: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      } else if (quickAddType === 'habit') {
        await db.habits.add({
          title: quickTitle,
          category: 'General',
          targetPerWeek: 7,
          streak: 0,
          history: {},
          createdAt: Date.now(),
        });
      }
      setQuickTitle('');
      setQuickDetail('');
      setQuickAddType(null);
      setQuickAddOpen(false);
    } catch (err) {
      console.error('Quick add failed:', err);
    }
  };

  const filteredNav = enabledNavItems.filter((n) =>
    n.label.toLowerCase().includes(paletteQuery.toLowerCase())
  );

  const getInitials = (text?: string | null): string => {
    if (!text) return 'AP';
    const letters = text.replace(/[^a-zA-Z]/g, '');
    return letters.length > 0 ? letters.slice(0, 2).toUpperCase() : 'AP';
  };
  const initials = getInitials(user?.display_name || user?.username || user?.email);

  const avatarColors: Record<string, string> = {
    violet: 'bg-apna-accent',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
    sky: 'bg-sky-500',
  };
  const avatarBg = avatarColors[user?.avatar_color || 'violet'] || 'bg-apna-accent';

  return (
    <div className="min-h-screen bg-apna-bg text-apna-text flex flex-col relative transition-colors duration-250">
      {/* Subtle Mesh Background Blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 opacity-40 dark:opacity-20">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-violet-400/20 blur-3xl" />
        <div className="absolute top-1/3 -right-32 w-96 h-96 rounded-full bg-emerald-400/15 blur-3xl" />
      </div>

      {/* Top Header with Liquid-Glass & Safe Area Support */}
      <header className={`sticky top-0 z-30 bg-apna-surface/95 backdrop-blur-md border-b border-apna-border transition-colors pt-[env(safe-area-inset-top,0px)] ${isStoryOpen ? '!hidden' : (isChatRoute ? 'hidden md:block' : 'block')}`}>
        <AppContainer className="h-14 flex items-center justify-between gap-2 md:gap-4 min-w-0">
          {/* Logo */}
          <NavLink to="/" className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-lg bg-apna-accent flex items-center justify-center shadow-xs">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-apna-text text-sm block">Saanjh</span>
          </NavLink>

          {/* Collapsible Responsive Header Nav */}
          <nav className="hidden md:flex items-center gap-0.5 bg-apna-surface-2/80 border border-apna-border rounded-xl p-1 min-w-0">
            {/* Primary items: show text only on xl, icon on md/lg */}
            {enabledNavItems.slice(0, 4).map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                title={item.label}
                className={({ isActive }) =>
                  `px-2.5 xl:px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
                    isActive
                      ? 'bg-apna-surface text-apna-accent shadow-xs border border-apna-border'
                      : 'text-apna-muted hover:text-apna-text'
                  }`
                }
              >
                <item.icon className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden xl:inline">{item.label}</span>
              </NavLink>
            ))}

            {/* Overflow "More" dropdown for remaining items */}
            {enabledNavItems.length > 4 && (
              <div className="relative" ref={headerMoreRef}>
                <button
                  ref={headerMoreBtnRef}
                  onClick={toggleHeaderMore}
                  aria-haspopup="menu"
                  aria-expanded={headerMoreOpen}
                  aria-label="More spaces navigation menu"
                  className="px-2 xl:px-2.5 py-1.5 rounded-lg text-xs font-semibold text-apna-muted hover:text-apna-text flex items-center gap-1 shrink-0 cursor-pointer"
                  title="More spaces"
                >
                  <span className="hidden xl:inline text-xs">More</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${headerMoreOpen ? 'rotate-180' : ''}`} />
                </button>

                {headerMoreOpen && (
                  <div
                    role="menu"
                    aria-label="More spaces"
                    className="absolute top-full left-0 mt-1 w-44 bg-apna-surface border border-apna-border rounded-xl shadow-lg p-1.5 z-50 animate-fade-in"
                    onClick={() => setHeaderMoreOpen(false)}
                  >
                    {enabledNavItems.slice(4).map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        role="menuitem"
                        className={({ isActive }) =>
                          `flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                            isActive
                              ? 'bg-apna-accent-soft text-apna-accent font-semibold'
                              : 'text-apna-text hover:bg-apna-surface-2'
                          }`
                        }
                      >
                        <item.icon className="w-3.5 h-3.5 text-apna-accent" />
                        <span>{item.label}</span>
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Search/Palette */}
            <button
              onClick={() => setPaletteOpen(true)}
              className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-apna-surface-2 border border-apna-border rounded-xl text-xs text-apna-faint hover:text-apna-muted transition-colors cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search...</span>
              <kbd className="ml-1 font-mono text-[10px] bg-apna-surface border border-apna-border px-1 rounded">
                ⌘K
              </kbd>
            </button>

            {/* Profile Dropdown */}
            <div className="relative" ref={profileRef}>
              <button
                ref={profileBtnRef}
                onClick={toggleProfile}
                aria-haspopup="menu"
                aria-expanded={profileOpen}
                aria-label="User account menu"
                className="flex items-center gap-1.5 cursor-pointer ml-1"
              >
                <div className={`w-8 h-8 rounded-full ${avatarBg} flex items-center justify-center text-white text-xs font-bold shadow-xs overflow-hidden`}>
                  {user?.avatar_url ? (
                    <img src={user.avatar_url} alt="DP" className="w-full h-full object-cover" />
                  ) : (
                    initials
                  )}
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-apna-faint hidden sm:block" />
              </button>

              {profileOpen && (
                <div
                  role="menu"
                  aria-label="Profile options"
                  className="absolute right-0 top-10 w-56 bg-apna-surface border border-apna-border rounded-2xl shadow-xl animate-fade-in z-50"
                >
                  <div className="p-3.5 border-b border-apna-border">
                    <p className="text-sm font-semibold text-apna-text truncate">
                      {user?.display_name || user?.username}
                    </p>
                    <p className="text-xs text-apna-faint truncate mt-0.5">{user?.email}</p>
                    {user?.about && (
                      <p className="text-[10px] text-emerald-800 dark:text-emerald-300 font-semibold truncate mt-1">
                        {user.about}
                      </p>
                    )}
                  </div>
                  <div className="p-1.5 space-y-0.5">
                    <button
                      role="menuitem"
                      onClick={() => { setSettingsModalOpen(true); setProfileOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-apna-text hover:bg-apna-surface-2 transition-colors cursor-pointer text-left"
                    >
                      <Smartphone className="w-3.5 h-3.5 text-emerald-800 dark:text-emerald-300" />
                      Profile & avatar
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => { setCustomizeModalOpen(true); setProfileOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-apna-text hover:bg-apna-surface-2 transition-colors cursor-pointer text-left"
                    >
                      <Sliders className="w-3.5 h-3.5 text-apna-accent" />
                      Space settings
                    </button>
                    <NavLink
                      to="/security"
                      role="menuitem"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-apna-text hover:bg-apna-surface-2 transition-colors"
                    >
                      <Shield className="w-3.5 h-3.5 text-apna-muted" />
                      Security & Privacy
                    </NavLink>
                    <button
                      role="menuitem"
                      onClick={() => { lockDeviceNow(); setProfileOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-apna-text hover:bg-apna-surface-2 transition-colors cursor-pointer text-left"
                    >
                      <Lock className="w-3.5 h-3.5 text-apna-muted" />
                      Lock Space Now
                    </button>
                    <button
                      role="menuitem"
                      onClick={() => { logout(); setProfileOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-apna-danger hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer text-left"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </AppContainer>
      </header>


      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        <AppContainer noPadding={isChatOpen} className={`${isChatRoute ? `py-0 md:py-6 ${isChatOpen ? 'pb-0' : 'pb-24'} md:pb-8` : 'py-4 md:py-6 pb-28 md:pb-8'} flex-1 flex flex-col min-w-0`}>
          {isDeviceLocked ? (
            <InlineUnlockScreen reason={lockReason} />
          ) : (
            <div key={location.pathname} className="page-route">{children}</div>
          )}
        </AppContainer>
      </main>

      {notification && (
        <button onClick={() => { navigate('/messages'); setNotification(null); }} className="notification-toast liquid-glass fixed top-16 right-3 sm:right-6 z-[60] w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl p-3.5 text-left animate-slide-up cursor-pointer">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-apna-accent text-white flex items-center justify-center shrink-0"><Bell className="w-4 h-4" /></div>
            <div className="min-w-0"><p className="text-xs font-bold text-apna-text">{notification.title}</p><p className="text-xs text-apna-muted mt-0.5 truncate">{notification.body}</p><p className="text-[10px] text-apna-accent font-semibold mt-1">Tap to open secure chat</p></div>
          </div>
        </button>
      )}
      <MotivePulse className="fixed z-[80] bottom-24 left-3 right-3 md:left-auto md:right-6 md:bottom-6 md:w-80" />

      {/* Mobile Floating Liquid-Glass Bottom Nav */}
      <nav className={`md:hidden fixed bottom-0 inset-x-0 z-30 pointer-events-none ${(isChatOpen || isStoryOpen) ? 'hidden' : ''}`}>
        <div className="mobile-dock liquid-glass max-w-none mx-auto px-4 py-2 grid grid-cols-5 items-center pointer-events-auto">
          {mobileTabs
            .filter((id) => isModuleEnabled(id))
            .slice(0, 4)
            .map((id) => allNavItems.find((item) => item.id === id))
            .filter((item): item is (typeof allNavItems)[number] => Boolean(item))
            .map((item) => (
              <NavLink
                key={item.id}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all relative ${
                    isActive
                      ? 'text-apna-accent font-semibold'
                      : 'text-apna-muted hover:text-apna-text'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon className={`w-5 h-5 stroke-[1.75] transition-transform ${isActive ? 'scale-110' : ''}`} />
                    <span className="text-[10px] mt-0.5 tracking-tight">{item.label}</span>
                    {isActive && (
                      <span className="absolute -bottom-0.5 w-1.5 h-1.5 rounded-full bg-apna-accent animate-pulse" />
                    )}
                  </>
                )}
              </NavLink>
            ))}

          {/* More trigger */}
          <button
            onClick={() => setMoreMenuOpen(true)}
            className="flex flex-col items-center justify-self-center py-1 px-2.5 rounded-xl text-apna-muted hover:text-apna-text transition-colors cursor-pointer"
          >
            <LayoutGrid className="w-5 h-5 stroke-[1.75]" />
            <span className="text-[10px] mt-0.5 tracking-tight">More</span>
          </button>
        </div>
      </nav>

      {/* Quick Add Sheet */}
      {quickAddOpen && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4 animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) { setQuickAddOpen(false); setQuickAddType(null); } }}
        >
          <div className="w-full max-w-md bg-apna-surface rounded-t-3xl md:rounded-3xl border border-apna-border shadow-2xl p-5 animate-slide-up z-50">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold text-apna-text">Quick Add to Your Space</h3>
              <button
                onClick={() => { setQuickAddOpen(false); setQuickAddType(null); }}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-apna-surface-2 text-apna-muted cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drag handle for mobile */}
            <div className="w-8 h-1 bg-apna-border rounded-full mx-auto mb-4 md:hidden" />

            {!quickAddType ? (
              <div className="grid grid-cols-3 gap-3 py-1">
                {[
                  { type: 'task' as const, icon: CheckCircle2, label: 'New Task', color: 'text-apna-accent' },
                  { type: 'note' as const, icon: FileText, label: 'New Note', color: 'text-apna-warn' },
                  { type: 'habit' as const, icon: Sparkles, label: 'New Habit', color: 'text-apna-success' },
                ].map((opt) => (
                  <button
                    key={opt.type}
                    onClick={() => setQuickAddType(opt.type)}
                    className="p-4 rounded-xl bg-apna-surface-2 border border-apna-border hover:border-apna-accent/30 hover:bg-apna-accent-soft flex flex-col items-center gap-2 transition-all cursor-pointer"
                  >
                    <opt.icon className={`w-5 h-5 ${opt.color}`} />
                    <span className="text-xs font-medium text-apna-text">{opt.label}</span>
                  </button>
                ))}
              </div>
            ) : (
              <form onSubmit={handleQuickAddSubmit} className="space-y-3">
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder={
                    quickAddType === 'task'
                      ? 'Task name...'
                      : quickAddType === 'note'
                      ? 'Note title...'
                      : 'Habit to build...'
                  }
                  value={quickTitle}
                  onChange={(e) => setQuickTitle(e.target.value)}
                  className="apna-input"
                />
                {quickAddType === 'note' && (
                  <textarea
                    rows={3}
                    placeholder="Add details..."
                    value={quickDetail}
                    onChange={(e) => setQuickDetail(e.target.value)}
                    className="apna-input resize-none"
                  />
                )}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setQuickAddType(null)}
                    className="btn-secondary flex-1"
                  >
                    Back
                  </button>
                  <button type="submit" className="btn-primary flex-1">
                    Save
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Command Palette */}
      {paletteOpen && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm flex items-start justify-center pt-20 px-4 animate-fade-in"
          onClick={(e) => { if (e.target === e.currentTarget) setPaletteOpen(false); }}
        >
          <div className="w-full max-w-lg bg-apna-surface rounded-2xl border border-apna-border shadow-2xl p-0 overflow-hidden animate-slide-up z-50" ref={paletteRef}>
            <div className="flex items-center gap-3 px-4 py-3 border-b border-apna-border">
              <Search className="w-4 h-4 text-apna-faint shrink-0" />
              <input
                type="text"
                autoFocus
                placeholder="Go to... or type a command"
                value={paletteQuery}
                onChange={(e) => setPaletteQuery(e.target.value)}
                className="flex-1 text-sm outline-none bg-transparent text-apna-text placeholder:text-apna-faint"
              />
              <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-apna-surface-2 border border-apna-border text-apna-faint">
                ESC
              </kbd>
            </div>
            <div className="max-h-64 overflow-y-auto p-1.5 space-y-0.5">
              {filteredNav.map((n) => (
                <button
                  key={n.to}
                  onClick={() => { navigate(n.to); setPaletteOpen(false); setPaletteQuery(''); }}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-apna-surface-2 transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <n.icon className="w-4 h-4 text-apna-accent" />
                    <span className="text-sm text-apna-text">Go to {n.label}</span>
                  </div>
                  <span className="text-xs text-apna-faint font-mono">{n.to}</span>
                </button>
              ))}
              {filteredNav.length === 0 && (
                <p className="text-center text-sm text-apna-faint py-6">No results</p>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Mobile More Drawer / Bottom Sheet (Bug A9 & A10) */}
      {moreMenuOpen && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="All Spaces bottom sheet"
          className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm flex items-end justify-center p-0 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMoreMenuOpen(false);
          }}
        >
          <div
            className="w-full max-w-lg bg-apna-surface rounded-t-3xl border-t border-apna-border shadow-2xl p-5 max-h-[85vh] overflow-y-auto animate-slide-up z-50"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag Handle Detent */}
            <div className="w-10 h-1.5 bg-apna-faint/50 rounded-full mx-auto mb-4" />

            <div className="flex justify-between items-center mb-3">
              <div>
                <h3 className="text-sm font-bold text-apna-text">All Spaces</h3>
                <p className="text-[11px] text-apna-faint">Access all apps and settings</p>
              </div>
              <button
                onClick={() => setMoreMenuOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-apna-surface-2 text-apna-muted cursor-pointer"
                aria-label="Close All Spaces"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 mb-4">
              {[
                { to: '/social', icon: Users, label: 'Samaj (Social)', desc: 'Thoughts, reels & circles' },
                { to: '/planner', icon: Compass, label: 'Planner', desc: 'Tasks & mindful routine' },
                { to: '/vault', icon: Lock, label: 'Encrypted Vault', desc: 'Secure files & notes' },
                { to: '/ai', icon: Sparkles, label: 'Private AI', desc: 'Local BYOK assistant' },
                { to: '/growth', icon: BarChart2, label: 'Habits & Growth', desc: 'Streaks & insights' },
                { to: '/security', icon: Shield, label: 'Security & Keys', desc: 'Safety score & backup' },
              ]
                .filter((item) => item.to === '/security' || item.to === '/planner' || isModuleEnabled(item.to.replace('/', '')))
                .map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMoreMenuOpen(false)}
                  className={({ isActive }) =>
                    `p-3.5 rounded-2xl border transition-all text-left flex flex-col gap-1.5 ${
                      isActive
                        ? 'bg-apna-accent-soft border-apna-accent text-apna-accent'
                        : 'bg-apna-surface-2 border-apna-border hover:bg-apna-surface text-apna-text'
                    }`
                  }
                >
                  <item.icon className="w-5 h-5 text-apna-accent" />
                  <div>
                    <p className="text-xs font-semibold leading-tight">{item.label}</p>
                    <p className="text-[11px] text-apna-faint">{item.desc}</p>
                  </div>
                </NavLink>
              ))}
            </div>

            <button
              onClick={() => {
                setMoreMenuOpen(false);
                setSettingsModalOpen(true);
              }}
              className="w-full mb-2 flex items-center justify-between p-3 rounded-xl bg-apna-surface-2 border border-apna-border text-apna-text hover:bg-apna-surface transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Settings className="w-4 h-4 text-emerald-800 dark:text-emerald-300" />
                <span className="text-xs font-semibold">Settings & Preferences</span>
              </div>
              <span className="text-[10px] font-medium text-apna-faint">Open</span>
            </button>

            <button
              onClick={() => {
                setMoreMenuOpen(false);
                setCustomizeModalOpen(true);
              }}
              className="w-full mb-3 flex items-center justify-between p-3 rounded-xl bg-apna-surface-2 border border-apna-accent/30 text-apna-text hover:bg-apna-accent-soft transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <Sliders className="w-4 h-4 text-apna-accent" />
                <span className="text-xs font-semibold">Customize Space (Show/Hide Features)</span>
              </div>
              <span className="text-[10px] font-medium text-apna-accent">Manage</span>
            </button>

            <div className="pt-3 border-t border-apna-border flex items-center justify-between">
              <button
                onClick={() => {
                  setTheme(theme === 'dark' ? 'light' : 'dark');
                  setMoreMenuOpen(false);
                }}
                className="flex items-center gap-2 text-xs font-medium text-apna-muted hover:text-apna-text py-1.5 px-2 rounded-lg cursor-pointer"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4" />}
                <span>{theme === 'dark' ? 'Light Theme' : 'Dark Theme'}</span>
              </button>
              <button
                onClick={() => {
                  setMoreMenuOpen(false);
                  logout();
                }}
                className="flex items-center gap-1.5 text-xs font-medium text-apna-danger hover:bg-red-50 py-1.5 px-2.5 rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Global Customize Space Modal */}
      <CustomizeModal />

      {/* WhatsApp Profile, DP & Privacy Settings Modal */}
      <WhatsAppSettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
      />
    </div>
  );
};
