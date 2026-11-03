import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Send,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  Heart,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { APP_NAME } from '../../constants';

export interface StorySegment {
  id: string;
  mediaUrl: string;
  caption: string;
  durationSeconds: number;
}

export interface StoryGroup {
  id: string;
  userName: string;
  userHandle: string;
  avatarColor: string;
  avatarUrl?: string;
  hasUnread: boolean;
  segments: StorySegment[];
  isOwn?: boolean;
  viewsCount?: number;
}

interface StoryViewerModalProps {
  isOpen: boolean;
  stories: StoryGroup[];
  initialStoryIdx: number;
  onClose: () => void;
  onSendReply?: (storyId: string, replyText: string) => void;
}

export const StoryViewerModal: React.FC<StoryViewerModalProps> = ({
  isOpen,
  stories,
  initialStoryIdx,
  onClose,
  onSendReply,
}) => {
  const [currentStoryIdx, setCurrentStoryIdx] = useState(initialStoryIdx);
  const [currentSegmentIdx, setCurrentSegmentIdx] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showReplySent, setShowReplySent] = useState(false);
  const [progress, setProgress] = useState(0);

  const currentStory = stories[currentStoryIdx];
  const currentSegment = currentStory?.segments?.[currentSegmentIdx];

  // Lock background scroll on mount and dispatch story open event
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.dispatchEvent(new CustomEvent('saanjh_story_open', { detail: true }));

    return () => {
      document.body.style.overflow = previousOverflow || 'unset';
      window.dispatchEvent(new CustomEvent('saanjh_story_open', { detail: false }));
    };
  }, [isOpen]);

  useEffect(() => {
    setCurrentStoryIdx(initialStoryIdx);
    setCurrentSegmentIdx(0);
    setProgress(0);
  }, [initialStoryIdx]);

  // Timer logic for multi-segment progression
  useEffect(() => {
    if (!isOpen || isPaused || !currentSegment) return;

    const segmentDurationMs = (currentSegment.durationSeconds || 5) * 1000;
    const intervalStepMs = 50;
    const progressIncrement = (intervalStepMs / segmentDurationMs) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          // Advance segment or story
          if (currentStory && currentSegmentIdx < currentStory.segments.length - 1) {
            setCurrentSegmentIdx((s) => s + 1);
            return 0;
          } else if (currentStoryIdx < stories.length - 1) {
            setCurrentStoryIdx((st) => st + 1);
            setCurrentSegmentIdx(0);
            return 0;
          } else {
            onClose();
            return 100;
          }
        }
        return prev + progressIncrement;
      });
    }, intervalStepMs);

    return () => clearInterval(timer);
  }, [isOpen, isPaused, currentSegment, currentSegmentIdx, currentStoryIdx, stories.length, onClose]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === ' ') setIsPaused((p) => !p);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, currentSegmentIdx, currentStoryIdx]);

  // Completely unmount when closed or missing data
  if (!isOpen || !currentStory || !currentSegment) return null;

  const handlePrev = () => {
    if (currentSegmentIdx > 0) {
      setCurrentSegmentIdx((s) => s - 1);
      setProgress(0);
    } else if (currentStoryIdx > 0) {
      setCurrentStoryIdx((st) => st - 1);
      const prevStory = stories[currentStoryIdx - 1];
      setCurrentSegmentIdx(prevStory.segments.length - 1);
      setProgress(0);
    }
  };

  const handleNext = () => {
    if (currentStory && currentSegmentIdx < currentStory.segments.length - 1) {
      setCurrentSegmentIdx((s) => s + 1);
      setProgress(0);
    } else if (currentStoryIdx < stories.length - 1) {
      setCurrentStoryIdx((st) => st + 1);
      setCurrentSegmentIdx(0);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const handleSubmitReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    if (onSendReply) {
      onSendReply(currentStory.id, replyText.trim());
    }
    setShowReplySent(true);
    setReplyText('');
    setTimeout(() => {
      setShowReplySent(false);
      handleNext();
    }, 1200);
  };

  const content = (
    <>
      {/* Explicit Z-Index: Backdrop is z-40 */}
      <div
        className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Explicit Z-Index: Story Dialog is z-50 */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Story by ${currentStory.userName}`}
        className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 select-none pointer-events-auto animate-fade-in"
      >
        <div className="relative w-full max-w-sm h-full sm:h-[86vh] bg-stone-900 sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between">
          {/* Segment Progress Bars */}
          <div className="absolute top-3 inset-x-3 z-40 flex gap-1">
            {currentStory.segments.map((seg, sIdx) => {
              let widthPct = 0;
              if (sIdx < currentSegmentIdx) widthPct = 100;
              else if (sIdx === currentSegmentIdx) widthPct = progress;

              return (
                <div key={seg.id} className="flex-1 h-1 rounded-full bg-white/25 overflow-hidden">
                  <div
                    className="h-full bg-white transition-all duration-75"
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              );
            })}
          </div>

          {/* Story Header */}
          <div className="absolute top-7 inset-x-3 z-40 flex items-center justify-between text-white drop-shadow-md">
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full bg-gradient-to-br ${currentStory.avatarColor} border border-white/40 flex items-center justify-center text-white font-bold text-xs`}
              >
                {currentStory.userName.replace(/[^a-zA-Z]/g, '').slice(0, 1).toUpperCase()}
              </div>
              <div>
                <p className="text-xs font-bold leading-tight">{currentStory.userName}</p>
                <p className="text-[10px] text-white/80">24h Story · Ephemeral</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsMuted((m) => !m)}
                className="w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white cursor-pointer transition-colors"
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white cursor-pointer transition-colors"
                aria-label="Close story"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Media Player / Image Area */}
          <div
            className="relative flex-1 w-full h-full flex items-center justify-center overflow-hidden bg-black"
            onMouseDown={() => setIsPaused(true)}
            onMouseUp={() => setIsPaused(false)}
            onTouchStart={() => setIsPaused(true)}
            onTouchEnd={() => setIsPaused(false)}
          >
            <img
              src={currentSegment.mediaUrl}
              alt="Story content"
              className="w-full h-full object-cover"
            />

            {/* Left / Right Click Nav */}
            <div
              className="absolute inset-y-0 left-0 w-1/3 z-20 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              aria-label="Previous story segment"
            />
            <div
              className="absolute inset-y-0 right-0 w-2/3 z-20 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              aria-label="Next story segment"
            />

            {/* Caption Overlay */}
            {currentSegment.caption && (
              <div className="absolute bottom-16 inset-x-4 z-30 p-3 rounded-2xl bg-black/60 backdrop-blur-md text-white text-xs leading-relaxed text-center">
                {currentSegment.caption}
              </div>
            )}
          </div>

          {/* Footer / Reply or Views */}
          <div className="relative z-40 p-3 bg-black/90 border-t border-white/10">
            {currentStory.isOwn ? (
              <div className="flex items-center justify-between text-white text-xs px-2 py-1">
                <div className="flex items-center gap-1.5 text-white/80">
                  <Eye className="w-4 h-4" />
                  <span>{currentStory.viewsCount || 18} device views</span>
                </div>
                <span className="text-[11px] text-emerald-400 font-medium">Expires in 19h</span>
              </div>
            ) : (
              <form onSubmit={handleSubmitReply} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder={`Reply to ${currentStory.userName.split(' ')[0]}...`}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-white/50 focus:outline-none focus:border-white/40"
                />
                <button
                  type="submit"
                  disabled={!replyText.trim()}
                  className="w-9 h-9 rounded-xl bg-apna-accent text-white flex items-center justify-center cursor-pointer shadow-sm disabled:opacity-40"
                  aria-label="Send reply"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            )}

            {showReplySent && (
              <div className="absolute inset-0 z-50 bg-black/85 flex items-center justify-center text-white text-xs font-semibold animate-fade-in">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 mr-2" />
                Reply sent via E2E channel!
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
};
