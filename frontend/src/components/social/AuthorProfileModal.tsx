import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ShieldCheck,
  UserPlus,
  UserCheck,
  MessageSquare,
  Share2,
  Grid,
  Video,
  Bookmark,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { APP_NAME } from '../../constants';

interface AuthorProfileModalProps {
  isOpen: boolean;
  author: {
    id: number | string;
    name: string;
    handle: string;
    avatarColor?: string;
    avatarUrl?: string;
    verified?: boolean;
    bio?: string;
    joinedDate?: string;
    followersCount?: number;
    followingCount?: number;
    postsCount?: number;
    isFollowing?: boolean;
  } | null;
  posts: any[];
  onClose: () => void;
  onToggleFollow: (authorId: number | string) => void;
  onOpenDirectChat?: (authorHandle: string) => void;
}

export const AuthorProfileModal: React.FC<AuthorProfileModalProps> = ({
  isOpen,
  author,
  posts,
  onClose,
  onToggleFollow,
  onOpenDirectChat,
}) => {
  const [activeTab, setActiveTab] = useState<'posts' | 'reels' | 'saved'>('posts');
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (isOpen && author) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [isOpen, author]);

  if (!isOpen || !author) return null;

  const authorPosts = posts.filter(
    (p) => String(p.author?.handle || p.author?.id) === String(author.handle || author.id)
  );
  const authorReels = authorPosts.filter((p) => p.type === 'reel');

  const handleShareProfile = () => {
    navigator.clipboard?.writeText?.(window.location.origin + `/#/samaj/@${author.handle}`);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="author-profile-title"
      className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[90vh] bg-apna-surface rounded-3xl border border-apna-border shadow-2xl overflow-hidden flex flex-col animate-slide-up z-50"
      >
        {/* Header Banner */}
        <div className="h-28 bg-gradient-to-r from-violet-600 via-indigo-700 to-purple-800 relative flex items-start justify-end p-3">
          <button
            onClick={onClose}
            aria-label="Close profile"
            className="w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center hover:bg-black/60 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Profile Info */}
        <div className="px-5 pt-0 pb-4 border-b border-apna-border relative">
          <div className="flex justify-between items-end -mt-12 mb-3">
            <div
              className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${
                author.avatarColor || 'from-violet-500 to-indigo-600'
              } border-4 border-apna-surface flex items-center justify-center text-white text-xl font-bold shadow-lg overflow-hidden`}
            >
              {author.avatarUrl ? (
                <img src={author.avatarUrl} alt={author.name} className="w-full h-full object-cover" />
              ) : (
                author.name.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase()
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => onToggleFollow(author.id)}
                className={`px-4 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  author.isFollowing
                    ? 'bg-apna-surface-2 text-apna-text border border-apna-border hover:border-rose-400 hover:text-rose-400'
                    : 'bg-apna-accent text-white shadow-xs hover:bg-apna-accent-ink'
                }`}
              >
                {author.isFollowing ? (
                  <>
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Following</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Follow</span>
                  </>
                )}
              </button>

              {onOpenDirectChat && (
                <button
                  onClick={() => {
                    onOpenDirectChat(author.handle);
                    onClose();
                  }}
                  className="p-2 rounded-xl bg-apna-surface-2 text-apna-text border border-apna-border hover:bg-apna-surface transition-colors cursor-pointer"
                  title="Send Encrypted Message"
                >
                  <MessageSquare className="w-4 h-4" />
                </button>
              )}

              <button
                onClick={handleShareProfile}
                className="p-2 rounded-xl bg-apna-surface-2 text-apna-text border border-apna-border hover:bg-apna-surface transition-colors cursor-pointer"
                title="Share Profile"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <h2 id="author-profile-title" className="text-base font-bold text-apna-text">
                {author.name}
              </h2>
              {author.verified && <ShieldCheck className="w-4 h-4 text-sky-500" />}
            </div>
            <p className="text-xs text-apna-faint font-medium">@{author.handle}</p>
          </div>

          <p className="text-xs text-apna-text mt-2.5 leading-relaxed">
            {author.bio ||
              `Mindful creator and community member on ${APP_NAME} Samaj. Zero-tracking, device-first social space.`}
          </p>

          <div className="flex items-center gap-4 mt-3 text-xs text-apna-faint">
            <div className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>Joined {author.joinedDate || '2024'}</span>
            </div>
          </div>

          <div className="flex items-center gap-6 mt-3.5 text-xs">
            <div>
              <span className="font-bold text-apna-text">{author.followersCount || authorPosts.length * 12 + 42}</span>{' '}
              <span className="text-apna-faint">followers</span>
            </div>
            <div>
              <span className="font-bold text-apna-text">{author.followingCount || 28}</span>{' '}
              <span className="text-apna-faint">following</span>
            </div>
            <div>
              <span className="font-bold text-apna-text">{authorPosts.length}</span>{' '}
              <span className="text-apna-faint">posts</span>
            </div>
          </div>

          {copiedLink && (
            <p className="text-[11px] text-emerald-500 font-semibold mt-2">
              Profile link copied to clipboard!
            </p>
          )}
        </div>

        {/* Profile Tabs */}
        <div className="flex border-b border-apna-border bg-apna-surface-2">
          <button
            onClick={() => setActiveTab('posts')}
            className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 cursor-pointer transition-colors ${
              activeTab === 'posts'
                ? 'border-apna-accent text-apna-accent bg-apna-surface'
                : 'border-transparent text-apna-muted hover:text-apna-text'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Posts ({authorPosts.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('reels')}
            className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 border-b-2 cursor-pointer transition-colors ${
              activeTab === 'reels'
                ? 'border-apna-accent text-apna-accent bg-apna-surface'
                : 'border-transparent text-apna-muted hover:text-apna-text'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>Reels ({authorReels.length})</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 max-h-64">
          {activeTab === 'posts' && (
            authorPosts.length > 0 ? (
              <div className="space-y-3">
                {authorPosts.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 rounded-xl bg-apna-surface-2 border border-apna-border space-y-1.5 text-xs"
                  >
                    <p className="text-apna-text leading-relaxed line-clamp-3">
                      {p.content || p.caption}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-apna-faint pt-1">
                      <span>{new Date(p.timestamp || Date.now()).toLocaleDateString()}</span>
                      <span>❤️ {p.likes || 0} · 💬 {p.commentsCount || 0}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-apna-faint text-xs">
                No posts shared yet by @{author.handle}.
              </div>
            )
          )}

          {activeTab === 'reels' && (
            authorReels.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {authorReels.map((r) => (
                  <div
                    key={r.id}
                    className="aspect-[9/16] rounded-xl overflow-hidden bg-stone-900 relative group cursor-pointer"
                  >
                    {r.coverUrl ? (
                      <img src={r.coverUrl} alt="Reel cover" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/50">
                        <Video className="w-8 h-8" />
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent text-white text-[11px] truncate">
                      {r.caption || 'Reel'}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-apna-faint text-xs">
                No reels created yet by @{author.handle}.
              </div>
            )
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

