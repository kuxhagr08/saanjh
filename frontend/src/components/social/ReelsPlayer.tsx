import React, { useState, useEffect, useRef, useCallback } from 'react';
import Hls from 'hls.js';
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Volume2,
  VolumeX,
  Play,
  Pause,
  MoreVertical,
  Check,
  ShieldCheck,
  Flag,
  Volume1,
  Sparkles,
  Coffee,
  Clock,
  WifiOff,
  Subtitles,
  Send,
  X,
} from 'lucide-react';
import { useIntent } from '../../context/IntentContext';

export interface ReelItem {
  id: string;
  author: {
    id: number;
    name: string;
    handle: string;
    avatarColor: string;
    verified: boolean;
    isFollowing?: boolean;
  };
  videoUrl: string;
  posterUrl: string;
  caption: string;
  hashtags: string[];
  likes: number;
  isLiked: boolean;
  commentsCount: number;
  isSaved: boolean;
  audioTrack: string;
}

const SAMPLE_REELS: ReelItem[] = [
  {
    id: 'reel-1',
    author: {
      id: 101,
      name: 'Dr. Ananya Rao',
      handle: 'ananya_neuro',
      avatarColor: 'from-violet-500 to-indigo-600',
      verified: true,
      isFollowing: false,
    },
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    posterUrl: 'https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?w=800&auto=format&fit=crop&q=80',
    caption: 'Why digital boundaries protect your nervous system. 3 rules I share with every high-performer in Bengaluru.',
    hashtags: ['#DigitalDetox', '#MindfulLiving', '#Focus'],
    likes: 1240,
    isLiked: false,
    commentsCount: 86,
    isSaved: false,
    audioTrack: 'Original Audio · Dr. Ananya Rao',
  },
  {
    id: 'reel-2',
    author: {
      id: 102,
      name: 'Rohan Sharma',
      handle: 'rohan_code',
      avatarColor: 'from-emerald-500 to-teal-600',
      verified: true,
      isFollowing: true,
    },
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    posterUrl: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&auto=format&fit=crop&q=80',
    caption: 'Zero-knowledge encryption in 60 seconds. Why your private keys should NEVER touch any server. 🔒',
    hashtags: ['#Cryptography', '#Security', '#PrivacyFirst'],
    likes: 3820,
    isLiked: true,
    commentsCount: 142,
    isSaved: true,
    audioTrack: 'Ambient Binaural Waves 432Hz',
  },
  {
    id: 'reel-3',
    author: {
      id: 103,
      name: 'Pooja Verma',
      handle: 'pooja_yoga',
      avatarColor: 'from-amber-500 to-orange-500',
      verified: false,
      isFollowing: false,
    },
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
    posterUrl: 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=800&auto=format&fit=crop&q=80',
    caption: 'Simple 3-minute evening breathwork (Pranayama) before sleep. Calm the mind after a long workday.',
    hashtags: ['#Pranayama', '#Wellness', '#EveningRoutine'],
    likes: 890,
    isLiked: false,
    commentsCount: 34,
    isSaved: false,
    audioTrack: 'Evening Raga · Bansuri Solo',
  },
];

export const ReelsPlayer: React.FC = () => {
  const { record } = useIntent();
  const [reels, setReels] = useState<ReelItem[]>(SAMPLE_REELS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    return localStorage.getItem('apna_reels_muted') !== '0';
  });
  const [isPlaying, setIsPlaying] = useState(true);
  const [isHoldingToPause, setIsHoldingToPause] = useState(false);
  const [heartAnimId, setHeartAnimId] = useState<string | null>(null);
  const [dataSaver, setDataSaver] = useState<boolean>(() => {
    return localStorage.getItem('apna_data_saver') === '1';
  });
  const [captionsOn, setCaptionsOn] = useState(false);
  const [expandedCaption, setExpandedCaption] = useState(false);
  const [watchTimeSeconds, setWatchTimeSeconds] = useState(0);
  const [mindfulPauseOpen, setMindfulPauseOpen] = useState(false);
  const [commentSheetOpen, setCommentSheetOpen] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [commentsList, setCommentsList] = useState<{ id: string; user: string; text: string; time: string }[]>([
    { id: 'c1', user: 'Vikram Singh', text: 'This changed my entire evening routine. So grateful! 🙏', time: '10m ago' },
    { id: 'c2', user: 'Neha Gupta', text: 'Clean, mindful, zero clutter. Love this space.', time: '2h ago' },
  ]);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [reportSuccess, setReportSuccess] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Map<number, HTMLVideoElement>>(new Map());
  const hlsInstances = useRef<Map<number, Hls>>(new Map());
  const longPressTimer = useRef<any>(null);

  // Sound preference persistence
  const toggleSound = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      localStorage.setItem('apna_reels_muted', next ? '1' : '0');
      // Apply to all mounted video elements
      videoRefs.current.forEach((vid) => {
        if (vid) vid.muted = next;
      });
      return next;
    });
  }, []);

  // Mindful watch-time tracker (triggers 20-min pause nudge)
  useEffect(() => {
    const interval = setInterval(() => {
      setWatchTimeSeconds((s) => {
        const next = s + 1;
        if (next === 1200) {
          // 20 minutes (1200s)
          setMindfulPauseOpen(true);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Keyboard navigation & playback controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (commentSheetOpen || mindfulPauseOpen) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        scrollToIndex(Math.min(currentIndex + 1, reels.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        scrollToIndex(Math.max(currentIndex - 1, 0));
      } else if (e.key === ' ' || e.key === 'k') {
        e.preventDefault();
        togglePlayPause();
      } else if (e.key === 'm') {
        e.preventDefault();
        toggleSound();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, reels.length, commentSheetOpen, mindfulPauseOpen, toggleSound]);

  // Scroll snap intersection observer
  const scrollToIndex = (index: number) => {
    if (!containerRef.current) return;
    const target = containerRef.current.children[index] as HTMLElement;
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleScroll = () => {
    if (!containerRef.current) return;
    const scrollY = containerRef.current.scrollTop;
    const height = containerRef.current.clientHeight;
    const index = Math.round(scrollY / height);
    if (index !== currentIndex && index >= 0 && index <= reels.length) {
      setCurrentIndex(index);
      record('reels');
      setIsPlaying(true);
      setExpandedCaption(false);
    }
  };

  // Play only active video, pause others, preload next video
  useEffect(() => {
    videoRefs.current.forEach((vid, idx) => {
      if (!vid) return;
      if (idx === currentIndex) {
        vid.muted = isMuted;
        vid.play().catch(() => {});
      } else {
        vid.pause();
        vid.currentTime = 0;
      }
    });

    // Virtualized preload next reel
    const nextIdx = currentIndex + 1;
    if (!dataSaver && nextIdx < reels.length) {
      const nextVid = videoRefs.current.get(nextIdx);
      if (nextVid && nextVid.preload !== 'auto') {
        nextVid.preload = 'auto';
      }
    }
  }, [currentIndex, isMuted, dataSaver, reels.length]);

  const togglePlayPause = () => {
    const vid = videoRefs.current.get(currentIndex);
    if (!vid) return;
    if (vid.paused) {
      vid.play();
      setIsPlaying(true);
    } else {
      vid.pause();
      setIsPlaying(false);
    }
  };

  // Double tap to like with animated heart
  const handleDoubleTap = (reelId: string) => {
    const reel = reels.find((item) => item.id === reelId);
    if (reel && !reel.isLiked) record('likes');
    setReels((prev) =>
      prev.map((r) => {
        if (r.id === reelId) {
          const nextLiked = !r.isLiked;
          return {
            ...r,
            isLiked: nextLiked,
            likes: nextLiked ? r.likes + 1 : r.likes - 1,
          };
        }
        return r;
      })
    );
    setHeartAnimId(reelId);
    setTimeout(() => setHeartAnimId(null), 900);
  };

  // Long press to pause and hide UI
  const handleTouchStart = () => {
    longPressTimer.current = setTimeout(() => {
      setIsHoldingToPause(true);
      const vid = videoRefs.current.get(currentIndex);
      if (vid) vid.pause();
    }, 400);
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    if (isHoldingToPause) {
      setIsHoldingToPause(false);
      const vid = videoRefs.current.get(currentIndex);
      if (vid) vid.play();
    }
  };

  const handleFollowToggle = (authorId: number) => {
    setReels((prev) =>
      prev.map((r) =>
        r.author.id === authorId
          ? { ...r, author: { ...r.author, isFollowing: !r.author.isFollowing } }
          : r
      )
    );
  };

  const handleSaveToggle = (reelId: string) => {
    const reel = reels.find((item) => item.id === reelId);
    if (reel && !reel.isSaved) record('saves');
    setReels((prev) =>
      prev.map((r) =>
        r.id === reelId ? { ...r, isSaved: !r.isSaved } : r
      )
    );
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim()) return;
    const newComment = {
      id: `c-${Date.now()}`,
      user: 'You',
      text: commentInput.trim(),
      time: 'Just now',
    };
    setCommentsList([newComment, ...commentsList]);
    setCommentInput('');
    setReels((prev) =>
      prev.map((r, i) =>
        i === currentIndex ? { ...r, commentsCount: r.commentsCount + 1 } : r
      )
    );
  };

  const handleShare = (reel: ReelItem) => {
    if (navigator.share) {
      navigator.share({
        title: `Saanjh Circle Reel by ${reel.author.name}`,
        text: reel.caption,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      setReportSuccess('Reel link copied to clipboard!');
      setTimeout(() => setReportSuccess(''), 2500);
    }
  };

  return (
    <div className="relative w-full h-[calc(100dvh-5.5rem)] md:h-[calc(100dvh-6.5rem)] max-w-full flex justify-center bg-black/95 rounded-2xl overflow-hidden select-none">
      {/* Toast Alert */}
      {reportSuccess && (
        <div className="absolute top-4 z-50 bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-lg flex items-center gap-2 animate-fade-in">
          <ShieldCheck className="w-4 h-4" />
          {reportSuccess}
        </div>
      )}

      {/* Top Header Floating Controls */}
      <div className={`absolute top-3 inset-x-3 z-30 flex items-center justify-between pointer-events-auto transition-opacity duration-300 ${isHoldingToPause ? 'opacity-0' : 'opacity-100'}`}>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full liquid-glass text-white text-xs font-semibold shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-apna-accent" />
          <span>Mindful Reels</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Data Saver Toggle */}
          <button
            onClick={() => {
              const next = !dataSaver;
              setDataSaver(next);
              localStorage.setItem('apna_data_saver', next ? '1' : '0');
            }}
            className={`px-2.5 py-1.5 rounded-full text-[11px] font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
              dataSaver
                ? 'bg-amber-500/80 text-white shadow-xs'
                : 'liquid-glass text-white/90 hover:text-white'
            }`}
            title="Data Saver (Lower resolution, no preloading)"
          >
            <WifiOff className="w-3 h-3" />
            <span className="hidden sm:inline">Data Saver {dataSaver ? 'On' : 'Off'}</span>
          </button>

          {/* Sound Toggle Button */}
          <button
            onClick={toggleSound}
            className="w-8 h-8 rounded-full liquid-glass flex items-center justify-center text-white hover:scale-105 transition-all cursor-pointer"
            aria-label={isMuted ? 'Unmute' : 'Mute'}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 9:16 Centered Scroll-Snap Container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="w-full md:max-w-[420px] h-full overflow-y-scroll snap-y snap-mandatory scroll-smooth hide-scrollbar bg-black"
        style={{ scrollSnapType: 'y mandatory' }}
      >
        {reels.map((reel, idx) => {
          // Virtualization: mount at most 3 video elements around current index
          const shouldMount = Math.abs(idx - currentIndex) <= 1;
          const isActive = idx === currentIndex;

          return (
            <div
              key={reel.id}
              className="relative w-full h-full snap-start snap-always shrink-0 flex items-center justify-center overflow-hidden bg-stone-900"
              style={{ scrollSnapStop: 'always' }}
              onDoubleClick={() => handleDoubleTap(reel.id)}
              onMouseDown={handleTouchStart}
              onMouseUp={handleTouchEnd}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              {shouldMount ? (
                <video
                  ref={(el) => {
                    if (el) videoRefs.current.set(idx, el);
                    else videoRefs.current.delete(idx);
                  }}
                  src={reel.videoUrl}
                  poster={reel.posterUrl}
                  playsInline
                  loop
                  muted={isMuted}
                  preload={isActive ? 'auto' : dataSaver ? 'none' : 'metadata'}
                  className="w-full h-full object-cover cursor-pointer"
                  onClick={togglePlayPause}
                />
              ) : (
                <img
                  src={reel.posterUrl}
                  alt={reel.caption}
                  className="w-full h-full object-cover"
                />
              )}

              {/* Central Play/Pause Flash Overlay */}
              {!isPlaying && isActive && !isHoldingToPause && (
                <div
                  onClick={togglePlayPause}
                  className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-auto cursor-pointer animate-fade-in"
                >
                  <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white shadow-xl">
                    <Play className="w-8 h-8 fill-white ml-1" />
                  </div>
                </div>
              )}

              {/* Double-tap Bursting Heart Animation */}
              {heartAnimId === reel.id && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30 animate-scale-in">
                  <Heart className="w-24 h-24 text-rose-500 fill-rose-500 filter drop-shadow-[0_8px_24px_rgba(244,63,94,0.6)]" />
                </div>
              )}

              {/* Bottom & Side Overlays (Hidden while holding to pause) */}
              <div
                className={`absolute inset-x-0 bottom-0 p-4 pb-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-end justify-between gap-4 transition-opacity duration-200 pointer-events-none z-20 ${
                  isHoldingToPause ? 'opacity-0' : 'opacity-100'
                }`}
              >
                {/* Bottom Left: Creator & Caption info */}
                <div className="flex-1 min-w-0 pointer-events-auto space-y-2">
                  {/* Creator row */}
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-9 h-9 rounded-full bg-gradient-to-br ${reel.author.avatarColor} flex items-center justify-center text-white text-xs font-bold shrink-0 border border-white/30 shadow-md`}
                    >
                      {reel.author.name.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <p className="text-sm font-bold text-white drop-shadow-sm truncate">
                          {reel.author.name}
                        </p>
                        {reel.author.verified && (
                          <ShieldCheck className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-white/70">@{reel.author.handle}</p>
                    </div>

                    <button
                      onClick={() => handleFollowToggle(reel.author.id)}
                      className={`ml-2 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                        reel.author.isFollowing
                          ? 'bg-white/20 text-white/90 border border-white/20'
                          : 'bg-apna-accent text-white shadow-sm hover:bg-apna-accent-ink'
                      }`}
                    >
                      {reel.author.isFollowing ? 'Following' : 'Follow'}
                    </button>
                  </div>

                  {/* Caption */}
                  <div className="text-xs text-white/95 leading-relaxed drop-shadow-sm">
                    <p className={expandedCaption ? '' : 'line-clamp-2'}>
                      {reel.caption}
                    </p>
                    {reel.caption.length > 70 && (
                      <button
                        onClick={() => setExpandedCaption(!expandedCaption)}
                        className="text-[11px] text-white/70 hover:text-white font-medium cursor-pointer"
                      >
                        {expandedCaption ? 'less' : 'more'}
                      </button>
                    )}
                  </div>

                  {/* Hashtags */}
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {reel.hashtags.map((tag) => (
                      <span
                        key={tag}
                        className="text-[11px] font-medium text-white/80 hover:text-white cursor-pointer"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Audio track chip */}
                  <div className="flex items-center gap-1.5 text-[11px] text-white/70 pt-0.5">
                    <Volume1 className="w-3.5 h-3.5 shrink-0 animate-pulse" />
                    <span className="truncate max-w-[200px]">{reel.audioTrack}</span>
                  </div>
                </div>

                {/* Right Action Rail */}
                <div className="flex flex-col items-center gap-4 shrink-0 pointer-events-auto">
                  {/* Like */}
                  <button
                    onClick={() => handleDoubleTap(reel.id)}
                    className="flex flex-col items-center gap-1 text-white group cursor-pointer"
                    aria-label="Like reel"
                  >
                    <div className={`w-11 h-11 rounded-full liquid-glass flex items-center justify-center transition-transform group-hover:scale-110 ${reel.isLiked ? 'text-rose-500' : 'text-white'}`}>
                      <Heart className={`w-5 h-5 ${reel.isLiked ? 'fill-rose-500' : ''}`} />
                    </div>
                    <span className="text-[10px] font-bold text-white/90 drop-shadow-sm">
                      {reel.likes}
                    </span>
                  </button>

                  {/* Comment */}
                  <button
                    onClick={() => setCommentSheetOpen(true)}
                    className="flex flex-col items-center gap-1 text-white group cursor-pointer"
                    aria-label="Comments"
                  >
                    <div className="w-11 h-11 rounded-full liquid-glass flex items-center justify-center transition-transform group-hover:scale-110 text-white">
                      <MessageCircle className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-bold text-white/90 drop-shadow-sm">
                      {reel.commentsCount}
                    </span>
                  </button>

                  {/* Share to Circle / Externally */}
                  <button
                    onClick={() => handleShare(reel)}
                    className="flex flex-col items-center gap-1 text-white group cursor-pointer"
                    aria-label="Share reel"
                  >
                    <div className="w-11 h-11 rounded-full liquid-glass flex items-center justify-center transition-transform group-hover:scale-110 text-white">
                      <Share2 className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-bold text-white/90 drop-shadow-sm">
                      Share
                    </span>
                  </button>

                  {/* Save Bookmark */}
                  <button
                    onClick={() => handleSaveToggle(reel.id)}
                    className="flex flex-col items-center gap-1 text-white group cursor-pointer"
                    aria-label="Save reel"
                  >
                    <div className={`w-11 h-11 rounded-full liquid-glass flex items-center justify-center transition-transform group-hover:scale-110 ${reel.isSaved ? 'text-amber-400' : 'text-white'}`}>
                      <Bookmark className={`w-5 h-5 ${reel.isSaved ? 'fill-amber-400' : ''}`} />
                    </div>
                    <span className="text-[10px] font-bold text-white/90 drop-shadow-sm">
                      Save
                    </span>
                  </button>

                  {/* More Menu */}
                  <button
                    onClick={() => setMoreMenuOpen(true)}
                    className="w-11 h-11 rounded-full liquid-glass flex items-center justify-center text-white/90 hover:text-white cursor-pointer"
                    aria-label="More options"
                  >
                    <MoreVertical className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* End-of-Feed Mindful Card */}
        <div
          className="relative w-full h-full snap-start snap-always shrink-0 flex flex-col items-center justify-center p-6 text-center bg-gradient-to-b from-stone-900 to-black text-white space-y-4"
          style={{ scrollSnapStop: 'always' }}
        >
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-xl">
            <Check className="w-8 h-8 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">You're All Caught Up</h3>
            <p className="text-xs text-white/70 max-w-xs mt-1.5 leading-relaxed">
              You have explored all fresh mindful reels for today. Step back, breathe, and return to your offline day.
            </p>
          </div>
          <button
            onClick={() => scrollToIndex(0)}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-semibold text-white transition-all cursor-pointer"
          >
            Back to Top
          </button>
        </div>
      </div>

      {/* Mindful 20-Minute Pause Nudge Modal */}
      {mindfulPauseOpen && (
        <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-apna-surface rounded-3xl p-6 border border-apna-border shadow-2xl text-center space-y-4 animate-scale-in">
            <div className="w-14 h-14 rounded-2xl bg-violet-100 dark:bg-violet-950/40 text-apna-accent flex items-center justify-center mx-auto shadow-sm">
              <Coffee className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-apna-text">Mindful 20-Minute Pause</h3>
              <p className="text-xs text-apna-muted mt-1 leading-relaxed">
                You've been watching reels for 20 minutes. Saanjh encourages mindful digital consumption. Would you like to take a break or continue?
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => {
                  setMindfulPauseOpen(false);
                  window.history.back();
                }}
                className="flex-1 py-2.5 rounded-xl bg-apna-surface-2 text-apna-text font-semibold text-xs hover:bg-apna-border transition-colors cursor-pointer"
              >
                Take a Break
              </button>
              <button
                onClick={() => setMindfulPauseOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-apna-accent text-white font-semibold text-xs hover:bg-apna-accent-ink transition-colors cursor-pointer shadow-sm"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comments Bottom Sheet */}
      {commentSheetOpen && (
        <div
          className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center animate-fade-in"
          onClick={() => setCommentSheetOpen(false)}
        >
          <div
            className="w-full sm:max-w-md h-[60vh] bg-apna-surface rounded-t-3xl sm:rounded-3xl border border-apna-border shadow-2xl flex flex-col overflow-hidden animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sheet Header */}
            <div className="p-4 border-b border-apna-border flex items-center justify-between">
              <h3 className="text-sm font-bold text-apna-text">Comments</h3>
              <button
                onClick={() => setCommentSheetOpen(false)}
                className="w-8 h-8 rounded-lg hover:bg-apna-surface-2 flex items-center justify-center text-apna-muted cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {commentsList.map((c) => (
                <div key={c.id} className="flex gap-2.5 text-xs">
                  <div className="w-7 h-7 rounded-full bg-apna-accent/20 text-apna-accent flex items-center justify-center font-bold text-[10px] shrink-0">
                    {c.user.slice(0, 1)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-apna-text">{c.user} <span className="font-normal text-[10px] text-apna-faint ml-1">{c.time}</span></p>
                    <p className="text-apna-muted mt-0.5 leading-relaxed">{c.text}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Comment Composer */}
            <form onSubmit={handleAddComment} className="p-3 border-t border-apna-border flex items-center gap-2 bg-apna-surface-2/40">
              <input
                type="text"
                placeholder="Add a mindful comment..."
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                className="flex-1 min-w-0 bg-apna-surface border border-apna-border rounded-xl px-3.5 py-2 text-xs text-apna-text placeholder:text-apna-faint focus:outline-none focus:border-apna-accent"
              />
              <button
                type="submit"
                disabled={!commentInput.trim()}
                className="w-9 h-9 rounded-xl bg-apna-accent text-white flex items-center justify-center disabled:opacity-40 hover:bg-apna-accent-ink transition-colors shrink-0 shadow-sm cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* More Options Modal */}
      {moreMenuOpen && (
        <div
          className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center animate-fade-in"
          onClick={() => setMoreMenuOpen(false)}
        >
          <div
            className="w-full sm:max-w-xs bg-apna-surface rounded-t-3xl sm:rounded-2xl border border-apna-border p-2 shadow-2xl space-y-1 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                setMoreMenuOpen(false);
                setReportSuccess('We will show fewer reels like this.');
                setTimeout(() => setReportSuccess(''), 2500);
              }}
              className="w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold text-apna-text hover:bg-apna-surface-2 transition-colors cursor-pointer"
            >
              Not Interested
            </button>
            <button
              onClick={() => {
                setMoreMenuOpen(false);
                setReportSuccess('Creator muted from your feed.');
                setTimeout(() => setReportSuccess(''), 2500);
              }}
              className="w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold text-apna-text hover:bg-apna-surface-2 transition-colors cursor-pointer"
            >
              Mute Creator
            </button>
            <button
              onClick={() => {
                setMoreMenuOpen(false);
                setReportSuccess('Report submitted for moderation review.');
                setTimeout(() => setReportSuccess(''), 2500);
              }}
              className="w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
            >
              Report Content
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
