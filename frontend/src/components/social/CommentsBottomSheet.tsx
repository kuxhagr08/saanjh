import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Heart, MessageSquare, Send, Trash2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export interface CommentItem {
  id: string;
  authorId: number;
  authorName: string;
  authorHandle: string;
  authorAvatarColor: string;
  text: string;
  timestamp: number;
  likes: number;
  isLiked: boolean;
  replies?: CommentItem[];
}

interface CommentsBottomSheetProps {
  isOpen: boolean;
  postId: string;
  postAuthorName: string;
  comments: CommentItem[];
  onClose: () => void;
  onAddComment: (text: string, replyToId?: string) => void;
  onDeleteComment: (commentId: string) => void;
}

export const CommentsBottomSheet: React.FC<CommentsBottomSheetProps> = ({
  isOpen,
  postId,
  postAuthorName,
  comments,
  onClose,
  onAddComment,
  onDeleteComment,
}) => {
  const { user } = useAuth();
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState<CommentItem | null>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onAddComment(inputText.trim(), replyingTo?.id);
    setInputText('');
    setReplyingTo(null);
  };

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div className="w-full sm:max-w-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-t-3xl sm:rounded-3xl max-h-[85vh] h-[75vh] flex flex-col shadow-2xl overflow-hidden animate-slide-up z-50" onClick={(e) => e.stopPropagation()}>
        {/* Drag handle on mobile */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1 rounded-full bg-stone-300 dark:bg-stone-700" />
        </div>

        {/* Header */}
        <div className="p-4 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">Comments</h3>
            <p className="text-[11px] text-stone-500">Post by {postAuthorName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Comment List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {comments.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
              <MessageSquare className="w-8 h-8 text-stone-300 dark:text-stone-700" />
              <p className="font-semibold text-stone-700 dark:text-stone-300">No comments yet</p>
              <p className="text-[11px] text-stone-400">Be the first to share a thoughtful reflection.</p>
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="space-y-2">
                <div className="flex items-start gap-2.5">
                  <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${comment.authorAvatarColor} flex items-center justify-center text-white font-bold text-[10px] shrink-0`}>
                    {comment.authorName.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="p-2.5 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-800 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-stone-900 dark:text-stone-100">{comment.authorName}</span>
                        <span className="text-[10px] text-stone-400">
                          {new Date(comment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-stone-700 dark:text-stone-300 leading-relaxed break-words">{comment.text}</p>
                    </div>

                    <div className="flex items-center gap-3 px-2 pt-1 text-[11px] text-stone-400">
                      <button
                        onClick={() => setReplyingTo(comment)}
                        className="hover:text-stone-600 dark:hover:text-stone-200 font-medium"
                      >
                        Reply
                      </button>
                      {comment.authorId === user?.id && (
                        <button
                          onClick={() => onDeleteComment(comment.id)}
                          className="hover:text-rose-500 font-medium"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Threaded Replies */}
                {comment.replies && comment.replies.length > 0 && (
                  <div className="pl-9 space-y-2">
                    {comment.replies.map((reply) => (
                      <div key={reply.id} className="flex items-start gap-2">
                        <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${reply.authorAvatarColor} flex items-center justify-center text-white font-bold text-[9px] shrink-0`}>
                          {reply.authorName.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0 p-2 rounded-xl bg-stone-100/70 dark:bg-stone-800/40">
                          <p className="font-semibold text-[11px] text-stone-900 dark:text-stone-100">{reply.authorName}</p>
                          <p className="text-stone-700 dark:text-stone-300 text-[11px] mt-0.5">{reply.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSubmit} className="p-3 border-t border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-900">
          {replyingTo && (
            <div className="flex items-center justify-between px-3 py-1 text-[11px] text-stone-500 bg-stone-200/50 dark:bg-stone-800 rounded-lg mb-2">
              <span>Replying to <strong>@{replyingTo.authorHandle}</strong></span>
              <button onClick={() => setReplyingTo(null)} className="text-stone-400 hover:text-stone-600">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder={replyingTo ? `Reply to ${replyingTo.authorName}...` : 'Write a mindful comment...'}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="flex-1 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-2xl px-3.5 py-2 text-xs focus:outline-none focus:border-violet-500 text-stone-900 dark:text-stone-100"
            />
            <button
              type="submit"
              disabled={!inputText.trim()}
              className="w-8 h-8 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white flex items-center justify-center transition-colors shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

