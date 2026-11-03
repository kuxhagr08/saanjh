import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Bookmark,
  Link,
  Share2,
  VolumeX,
  UserMinus,
  EyeOff,
  AlertTriangle,
  Edit3,
  Trash2,
  Pin,
  MessageSquareOff,
  X,
  Check,
} from 'lucide-react';

interface PostActionMenuProps {
  isOpen: boolean;
  post: {
    id: string;
    author: {
      id: number | string;
      name: string;
      handle: string;
    };
    isSaved?: boolean;
    isPinned?: boolean;
    allowComments?: boolean;
  } | null;
  isAuthor: boolean;
  onClose: () => void;
  onSave: () => void;
  onCopyLink: () => void;
  onShareToCircle: () => void;
  onMuteAuthor: () => void;
  onUnfollow: () => void;
  onNotInterested: () => void;
  onReport: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onTogglePin?: () => void;
  onToggleComments?: () => void;
}

export const PostActionMenu: React.FC<PostActionMenuProps> = ({
  isOpen,
  post,
  isAuthor,
  onClose,
  onSave,
  onCopyLink,
  onShareToCircle,
  onMuteAuthor,
  onUnfollow,
  onNotInterested,
  onReport,
  onEdit,
  onDelete,
  onTogglePin,
  onToggleComments,
}) => {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !post) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="post-action-menu-title"
      className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        ref={sheetRef}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md bg-apna-surface rounded-t-3xl sm:rounded-2xl border border-apna-border shadow-2xl p-4 sm:p-5 space-y-3 animate-slide-up z-50"
      >
        {/* Drag handle on mobile */}
        <div className="w-10 h-1 bg-apna-faint/40 rounded-full mx-auto sm:hidden -mt-1 mb-2" />

        <div className="flex items-center justify-between pb-2 border-b border-apna-border">
          <div>
            <h3 id="post-action-menu-title" className="text-sm font-bold text-apna-text">
              Post Options
            </h3>
            <p className="text-[11px] text-apna-faint">
              Post by @{post.author.handle}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="p-1 rounded-lg text-apna-muted hover:text-apna-text hover:bg-apna-surface-2 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-1 max-h-[70vh] overflow-y-auto">
          {/* Common Actions */}
          <button
            onClick={() => {
              onSave();
              onClose();
            }}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium text-apna-text hover:bg-apna-surface-2 transition-colors text-left cursor-pointer"
          >
            <Bookmark className="w-4 h-4 text-apna-accent" />
            <span>{post.isSaved ? 'Remove from Saved' : 'Save Post'}</span>
          </button>

          <button
            onClick={() => {
              onCopyLink();
              onClose();
            }}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium text-apna-text hover:bg-apna-surface-2 transition-colors text-left cursor-pointer"
          >
            <Link className="w-4 h-4 text-sky-500" />
            <span>Copy Post Link</span>
          </button>

          <button
            onClick={() => {
              onShareToCircle();
              onClose();
            }}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium text-apna-text hover:bg-apna-surface-2 transition-colors text-left cursor-pointer"
          >
            <Share2 className="w-4 h-4 text-emerald-500" />
            <span>Share to Circle / Chat</span>
          </button>

          {/* Author-specific management */}
          {isAuthor ? (
            <>
              <div className="my-2 border-t border-apna-border pt-2" />
              {onEdit && (
                <button
                  onClick={() => {
                    onEdit();
                    onClose();
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium text-apna-text hover:bg-apna-surface-2 transition-colors text-left cursor-pointer"
                >
                  <Edit3 className="w-4 h-4 text-amber-500" />
                  <span>Edit Post Caption</span>
                </button>
              )}
              {onTogglePin && (
                <button
                  onClick={() => {
                    onTogglePin();
                    onClose();
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium text-apna-text hover:bg-apna-surface-2 transition-colors text-left cursor-pointer"
                >
                  <Pin className="w-4 h-4 text-indigo-500" />
                  <span>{post.isPinned ? 'Unpin from Profile' : 'Pin to Profile'}</span>
                </button>
              )}
              {onToggleComments && (
                <button
                  onClick={() => {
                    onToggleComments();
                    onClose();
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium text-apna-text hover:bg-apna-surface-2 transition-colors text-left cursor-pointer"
                >
                  <MessageSquareOff className="w-4 h-4 text-orange-500" />
                  <span>
                    {post.allowComments === false
                      ? 'Turn on commenting'
                      : 'Turn off commenting'}
                  </span>
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => {
                    onDelete();
                    onClose();
                  }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium text-rose-500 hover:bg-rose-500/10 transition-colors text-left cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Post</span>
                </button>
              )}
            </>
          ) : (
            /* Viewer-specific actions */
            <>
              <div className="my-2 border-t border-apna-border pt-2" />
              <button
                onClick={() => {
                  onMuteAuthor();
                  onClose();
                }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium text-apna-text hover:bg-apna-surface-2 transition-colors text-left cursor-pointer"
              >
                <VolumeX className="w-4 h-4 text-amber-500" />
                <span>Mute @{post.author.handle}</span>
              </button>
              <button
                onClick={() => {
                  onUnfollow();
                  onClose();
                }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium text-apna-text hover:bg-apna-surface-2 transition-colors text-left cursor-pointer"
              >
                <UserMinus className="w-4 h-4 text-orange-500" />
                <span>Unfollow @{post.author.handle}</span>
              </button>
              <button
                onClick={() => {
                  onNotInterested();
                  onClose();
                }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium text-apna-text hover:bg-apna-surface-2 transition-colors text-left cursor-pointer"
              >
                <EyeOff className="w-4 h-4 text-slate-400" />
                <span>Not interested in this post</span>
              </button>
              <button
                onClick={() => {
                  onReport();
                  onClose();
                }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium text-rose-500 hover:bg-rose-500/10 transition-colors text-left cursor-pointer"
              >
                <AlertTriangle className="w-4 h-4" />
                <span>Report post to community moderators</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

