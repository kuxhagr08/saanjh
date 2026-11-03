import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Sparkles,
  Camera,
  Image as ImageIcon,
  Video,
  BarChart2,
  Clock,
  Globe,
  Users,
  Lock,
  Plus,
  Trash2,
  RotateCw,
  Check,
  AlertCircle,
  HelpCircle,
  Film,
  Smile,
  Send,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { APP_NAME } from '../../constants';

export type PostType = 'thought' | 'photo' | 'reel' | 'poll' | 'story';
export type AudienceType = 'followers' | 'public' | 'close_friends';

interface SamajCreateModalProps {
  isOpen: boolean;
  initialType?: PostType;
  onClose: () => void;
  onPostCreated: (post: any) => void;
}

const THOUGHT_GRADIENTS = [
  { id: 'purple', label: 'Deep Lavender', class: 'from-purple-900 via-indigo-950 to-stone-900' },
  { id: 'emerald', label: 'Calm Sage', class: 'from-emerald-950 via-teal-900 to-stone-900' },
  { id: 'sunset', label: 'Sunset Glow', class: 'from-rose-950 via-orange-950 to-stone-900' },
  { id: 'ocean', label: 'Midnight Ocean', class: 'from-blue-950 via-slate-900 to-stone-950' },
  { id: 'obsidian', label: 'Obsidian Noir', class: 'from-stone-900 via-stone-950 to-black' },
];

const AAJ_KA_VICHAAR_PROMPTS = [
  'What brought you a moment of genuine stillness today?',
  'One small thing I am profoundly grateful for...',
  'A truth I learned the hard way this week:',
  'Today’s mindful reminder to yourself:',
  'Offline moment that gave me peace:',
];

export const SamajCreateModal: React.FC<SamajCreateModalProps> = ({
  isOpen,
  initialType = 'thought',
  onClose,
  onPostCreated,
}) => {
  const { user } = useAuth();
  const [activeType, setActiveType] = useState<PostType>(initialType);

  // Common Form States
  const [caption, setCaption] = useState('');
  const [audience, setAudience] = useState<AudienceType>('followers');
  const [allowComments, setAllowComments] = useState(true);
  const [hideLikeCount, setHideLikeCount] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  // Thought States
  const [thoughtGradient, setThoughtGradient] = useState(THOUGHT_GRADIENTS[0].class);
  const [thoughtFontSize, setThoughtFontSize] = useState<'normal' | 'large'>('large');

  // Photo States
  const [selectedPhotos, setSelectedPhotos] = useState<Array<{ id: string; url: string; altText: string }>>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Reel States
  const [videoFile, setVideoFile] = useState<{ url: string; name: string; sizeBytes: number; durationSeconds: number } | null>(null);
  const [videoTrimStart, setVideoTrimStart] = useState(0);
  const [videoTrimEnd, setVideoTrimEnd] = useState(60);
  const [videoCoverUrl, setVideoCoverUrl] = useState<string | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Poll States
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [pollDuration, setPollDuration] = useState<'24h' | '3d' | '7d'>('24h');
  const [allowMultiple, setAllowMultiple] = useState(false);

  // Lock background scroll on mount
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev || 'unset';
    };
  }, [isOpen]);

  // Autosave Draft in LocalStorage
  useEffect(() => {
    if (isOpen) {
      try {
        const savedDraft = localStorage.getItem('saanjh_samaj_draft');
        if (savedDraft) {
          const parsed = JSON.parse(savedDraft);
          if (parsed.caption && !caption) setCaption(parsed.caption);
        }
      } catch {}
    }
  }, [isOpen]);

  useEffect(() => {
    if (caption) {
      try {
        localStorage.setItem('saanjh_samaj_draft', JSON.stringify({ caption, type: activeType }));
      } catch {}
    }
  }, [caption, activeType]);

  if (!isOpen) return null;

  // Compress & Strip EXIF from images locally
  const processImageFile = async (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 1600;
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            // Draw image on canvas to automatically strip EXIF metadata
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/webp', 0.85));
          } else {
            resolve(e.target?.result as string);
          }
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setErrorMsg('');

    if (selectedPhotos.length + files.length > 10) {
      setErrorMsg('You can upload up to 10 photos per post.');
      return;
    }

    const processed = await Promise.all(
      files.map(async (file, idx) => ({
        id: `img-${Date.now()}-${idx}`,
        url: await processImageFile(file),
        altText: '',
      }))
    );

    setSelectedPhotos((prev) => [...prev, ...processed]);
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg('');

    // Client-side validation: Max 50 MB
    if (file.size > 50 * 1024 * 1024) {
      setErrorMsg('Video file size exceeds the 50 MB cap. Please pick a shorter clip.');
      return;
    }

    const validTypes = ['video/mp4', 'video/quicktime', 'video/webm'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(mp4|mov|webm)$/i)) {
      setErrorMsg('Invalid video format. Supported formats: MP4, MOV, WebM.');
      return;
    }

    const videoUrl = URL.createObjectURL(file);
    const tempVideo = document.createElement('video');
    tempVideo.preload = 'metadata';
    tempVideo.src = videoUrl;
    tempVideo.onloadedmetadata = () => {
      const dur = Math.round(tempVideo.duration);
      if (dur > 60) {
        setErrorMsg('Reels must be 60 seconds or less.');
        URL.revokeObjectURL(videoUrl);
        return;
      }
      setVideoFile({
        url: videoUrl,
        name: file.name,
        sizeBytes: file.size,
        durationSeconds: dur,
      });
      setVideoTrimEnd(Math.min(dur, 60));

      // Generate cover frame
      tempVideo.currentTime = Math.min(1, dur / 2);
      tempVideo.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = tempVideo.videoWidth || 720;
        canvas.height = tempVideo.videoHeight || 1280;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
          setVideoCoverUrl(canvas.toDataURL('image/jpeg', 0.8));
        }
      };
    };
  };

  const handleAddPollOption = () => {
    if (pollOptions.length < 4) {
      setPollOptions([...pollOptions, '']);
    }
  };

  const handleRemovePollOption = (idx: number) => {
    if (pollOptions.length > 2) {
      setPollOptions(pollOptions.filter((_, i) => i !== idx));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (activeType === 'thought' && !caption.trim()) {
      setErrorMsg('Please write your thought before sharing.');
      return;
    }
    if (activeType === 'photo' && selectedPhotos.length === 0) {
      setErrorMsg('Please select at least one photo.');
      return;
    }
    if (activeType === 'reel' && !videoFile) {
      setErrorMsg('Please select or record a video.');
      return;
    }
    if (activeType === 'poll') {
      if (!pollQuestion.trim()) {
        setErrorMsg('Please enter a poll question.');
        return;
      }
      const validOpts = pollOptions.filter((o) => o.trim().length > 0);
      if (validOpts.length < 2) {
        setErrorMsg('Please provide at least 2 non-empty poll options.');
        return;
      }
    }

    setIsSubmitting(true);
    setUploadProgress(25);

    // Simulate client-side compression & progressive upload
    setTimeout(() => setUploadProgress(65), 250);
    setTimeout(() => {
      setUploadProgress(100);
      setIsSubmitting(false);

      const newPostId = `post-${Date.now()}`;
      const basePost = {
        id: newPostId,
        author: {
          id: user?.id || 1,
          name: user?.display_name || user?.username || 'You',
          handle: user?.username || 'you',
          avatarColor: user?.avatar_color ? `from-${user.avatar_color}-500 to-${user.avatar_color}-700` : 'from-violet-500 to-indigo-600',
          avatarUrl: user?.avatar_url || '',
          verified: true,
        },
        caption: caption.trim(),
        content: caption.trim() || pollQuestion.trim(),
        type: activeType,
        audience,
        allowComments,
        hideLikeCount,
        likes: 0,
        isLiked: false,
        commentsCount: 0,
        isSaved: false,
        timestamp: Date.now(),
      };

      let finalPost: any = basePost;

      if (activeType === 'thought') {
        finalPost = {
          ...basePost,
          gradient: thoughtGradient,
          fontSize: thoughtFontSize,
        };
      } else if (activeType === 'photo') {
        finalPost = {
          ...basePost,
          mediaUrl: selectedPhotos[0]?.url,
          photos: selectedPhotos,
        };
      } else if (activeType === 'reel') {
        finalPost = {
          ...basePost,
          mediaUrl: videoFile?.url,
          videoCoverUrl,
          durationSeconds: videoTrimEnd - videoTrimStart,
        };
      } else if (activeType === 'poll') {
        finalPost = {
          ...basePost,
          content: pollQuestion.trim(),
          pollQuestion: pollQuestion.trim(),
          pollOptions: pollOptions.filter((o) => o.trim()).map((text) => ({ text, votes: 0 })),
          pollDuration,
          allowMultiple,
          pollVotedIndex: null,
          totalVotes: 0,
        };
      } else if (activeType === 'story') {
        finalPost = {
          ...basePost,
          isStory: true,
          expiresAt: Date.now() + 24 * 3600 * 1000,
          mediaUrl: selectedPhotos[0]?.url || videoFile?.url || '',
        };
      }

      try {
        localStorage.removeItem('saanjh_samaj_draft');
      } catch {}

      onPostCreated(finalPost);
      onClose();
    }, 600);
  };

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
        aria-label="Create for Samaj"
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 pointer-events-auto animate-fade-in"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl max-w-xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-scale-in"
        >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-stone-100 dark:border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-violet-600/10 text-violet-600 flex items-center justify-center font-bold text-xs">
              🌸
            </div>
            <div>
              <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">Create for {APP_NAME} Samaj</h2>
              <p className="text-[11px] text-stone-500">Mindful sharing without vanity metrics</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Post Type Selector Tabs */}
        <div className="px-4 sm:px-5 pt-3 pb-1 border-b border-stone-100 dark:border-stone-800 flex items-center gap-1.5 overflow-x-auto hide-scrollbar">
          {[
            { id: 'thought' as PostType, label: 'Thought', icon: Sparkles },
            { id: 'photo' as PostType, label: 'Photo', icon: ImageIcon },
            { id: 'reel' as PostType, label: 'Reel', icon: Film },
            { id: 'poll' as PostType, label: 'Poll', icon: BarChart2 },
            { id: 'story' as PostType, label: '24h Story', icon: Clock },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveType(tab.id);
                setErrorMsg('');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all cursor-pointer ${
                activeType === tab.id
                  ? 'bg-violet-600 text-white shadow-xs'
                  : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. THOUGHT EXPERIENCE */}
          {activeType === 'thought' && (
            <div className="space-y-3">
              {/* Prompt Chips */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Aaj Ka Vichaar Prompts:</span>
                <div className="flex gap-1.5 overflow-x-auto hide-scrollbar py-0.5">
                  {AAJ_KA_VICHAAR_PROMPTS.map((prompt, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setCaption(prompt + ' ')}
                      className="px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 text-[11px] shrink-0 transition-colors"
                    >
                      {prompt.slice(0, 32)}...
                    </button>
                  ))}
                </div>
              </div>

              {/* Thought Preview Box */}
              <div className={`p-6 rounded-2xl bg-gradient-to-br ${thoughtGradient} text-white shadow-lg space-y-3 transition-all`}>
                <textarea
                  rows={4}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Share a calm reflection, a piece of poetry, or a mindful lesson..."
                  className={`w-full bg-transparent border-0 text-white placeholder:text-white/60 focus:outline-none resize-none leading-relaxed ${
                    thoughtFontSize === 'large' ? 'text-base font-semibold' : 'text-sm font-medium'
                  }`}
                />
              </div>

              {/* Color Presets */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-stone-500 font-medium">Card Aesthetic:</span>
                <div className="flex gap-1.5">
                  {THOUGHT_GRADIENTS.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setThoughtGradient(g.class)}
                      className={`w-7 h-7 rounded-full bg-gradient-to-br ${g.class} border-2 transition-transform ${
                        thoughtGradient === g.class ? 'scale-110 border-white ring-2 ring-violet-500' : 'border-transparent'
                      }`}
                      title={g.label}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 2. PHOTO EXPERIENCE */}
          {activeType === 'photo' && (
            <div className="space-y-3">
              <textarea
                rows={2}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Write a caption with #hashtags or @mentions..."
                className="w-full p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:border-violet-500 resize-none"
              />

              {/* Photos Grid */}
              <div className="grid grid-cols-3 gap-2">
                {selectedPhotos.map((photo, idx) => (
                  <div key={photo.id} className="relative aspect-square rounded-2xl overflow-hidden border border-stone-200 dark:border-stone-800 group">
                    <img src={photo.url} alt="Upload preview" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setSelectedPhotos(selectedPhotos.filter((p) => p.id !== photo.id))}
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center opacity-80 hover:opacity-100"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                    <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 text-[10px] text-white">
                      #{idx + 1}
                    </span>
                  </div>
                ))}

                {selectedPhotos.length < 10 && (
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="flex-1 aspect-square rounded-2xl border-2 border-dashed border-stone-200 dark:border-stone-800 hover:border-violet-500 flex flex-col items-center justify-center text-stone-400 hover:text-violet-600 transition-colors p-2 text-center"
                    >
                      <ImageIcon className="w-5 h-5 mb-1" />
                      <span className="text-[10px] font-semibold">Gallery</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="px-3 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 flex items-center gap-2 hover:bg-stone-200"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Take Live Photo</span>
                </button>
                <span className="text-[11px] text-stone-400 self-center ml-auto">
                  Auto-compressed (WebP, EXIF stripped)
                </span>
              </div>

              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handlePhotoUpload}
              />
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePhotoUpload}
              />
            </div>
          )}

          {/* 3. REEL / VIDEO EXPERIENCE */}
          {activeType === 'reel' && (
            <div className="space-y-3">
              <textarea
                rows={2}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Caption and hashtags for your reel (#mindful, #daily)..."
                className="w-full p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:border-violet-500 resize-none"
              />

              {!videoFile ? (
                <div
                  onClick={() => videoInputRef.current?.click()}
                  className="p-8 rounded-3xl border-2 border-dashed border-stone-200 dark:border-stone-800 hover:border-violet-500 flex flex-col items-center justify-center text-center cursor-pointer transition-colors"
                >
                  <div className="w-12 h-12 rounded-2xl bg-violet-600/10 text-violet-600 flex items-center justify-center mb-3">
                    <Video className="w-6 h-6" />
                  </div>
                  <p className="font-bold text-stone-900 dark:text-stone-100 text-xs">Choose or Record Video</p>
                  <p className="text-[11px] text-stone-400 mt-0.5">MP4, MOV, WebM • Max 60 seconds • Max 50 MB</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative aspect-[9/14] max-h-72 rounded-2xl overflow-hidden bg-black mx-auto border border-stone-200 dark:border-stone-800">
                    <video src={videoFile.url} controls className="w-full h-full object-contain" />
                    <button
                      type="button"
                      onClick={() => setVideoFile(null)}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Trim & Details Bar */}
                  <div className="p-3 bg-stone-50 dark:bg-stone-800/50 rounded-2xl border border-stone-200 dark:border-stone-800 space-y-2">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-stone-500 font-medium">Duration: {videoFile.durationSeconds}s</span>
                      <span className="text-emerald-600 font-semibold">
                        Size: {(videoFile.sizeBytes / (1024 * 1024)).toFixed(1)} MB
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-stone-400 shrink-0">Trim:</span>
                      <input
                        type="range"
                        min={0}
                        max={videoFile.durationSeconds}
                        value={videoTrimEnd}
                        onChange={(e) => setVideoTrimEnd(Number(e.target.value))}
                        className="flex-1 accent-violet-600"
                      />
                      <span className="text-[11px] font-bold text-stone-700 dark:text-stone-200">
                        {videoTrimEnd}s
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <input
                ref={videoInputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/webm"
                className="hidden"
                onChange={handleVideoUpload}
              />
            </div>
          )}

          {/* 4. POLL EXPERIENCE */}
          {activeType === 'poll' && (
            <div className="space-y-3">
              <input
                type="text"
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                placeholder="Ask your mindful question..."
                className="w-full p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100 font-semibold focus:outline-none focus:border-violet-500"
              />

              <div className="space-y-2">
                <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">Poll Options:</span>
                {pollOptions.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const newOpts = [...pollOptions];
                        newOpts[idx] = e.target.value;
                        setPollOptions(newOpts);
                      }}
                      placeholder={`Option ${idx + 1}`}
                      className="flex-1 p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:border-violet-500"
                    />
                    {pollOptions.length > 2 && (
                      <button
                        type="button"
                        onClick={() => handleRemovePollOption(idx)}
                        className="p-2 text-stone-400 hover:text-rose-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}

                {pollOptions.length < 4 && (
                  <button
                    type="button"
                    onClick={handleAddPollOption}
                    className="flex items-center gap-1.5 text-violet-600 font-semibold px-2 py-1 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-950/20"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Option</span>
                  </button>
                )}
              </div>

              {/* Poll Settings */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-800">
                  <span className="text-stone-500 block mb-1">Duration:</span>
                  <select
                    value={pollDuration}
                    onChange={(e) => setPollDuration(e.target.value as any)}
                    className="bg-transparent font-semibold text-stone-800 dark:text-stone-200 focus:outline-none w-full"
                  >
                    <option value="24h">24 Hours</option>
                    <option value="3d">3 Days</option>
                    <option value="7d">7 Days</option>
                  </select>
                </div>
                <div className="p-2.5 rounded-xl bg-stone-50 dark:bg-stone-800/50 border border-stone-200 dark:border-stone-800 flex items-center justify-between">
                  <span className="text-stone-500">Multiple Votes:</span>
                  <input
                    type="checkbox"
                    checked={allowMultiple}
                    onChange={(e) => setAllowMultiple(e.target.checked)}
                    className="accent-violet-600 w-4 h-4"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 5. 24h STORY EXPERIENCE */}
          {activeType === 'story' && (
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200 text-xs leading-relaxed">
                <Clock className="w-4 h-4 inline mr-1 text-amber-600" />
                <strong>24-Hour Ephemeral Guarantee:</strong> Stories vanish completely after 24 hours. No permanent trace on server or feed.
              </div>

              <textarea
                rows={2}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Story caption or quote..."
                className="w-full p-3 rounded-2xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:border-violet-500 resize-none"
              />

              {selectedPhotos.length > 0 ? (
                <div className="relative aspect-[9/16] max-h-60 rounded-2xl overflow-hidden mx-auto border border-stone-200 dark:border-stone-800">
                  <img src={selectedPhotos[0].url} alt="Story" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setSelectedPhotos([])}
                    className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="w-full p-6 rounded-2xl border-2 border-dashed border-stone-200 dark:border-stone-800 hover:border-violet-500 flex flex-col items-center justify-center text-stone-400 hover:text-violet-600 transition-colors"
                >
                  <Camera className="w-6 h-6 mb-1" />
                  <span className="font-semibold">Pick Photo for Story</span>
                </button>
              )}
            </div>
          )}

          {/* Common Audience & Controls */}
          <div className="pt-2 border-t border-stone-100 dark:border-stone-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-stone-500 font-medium">Audience:</span>
              <div className="flex gap-1">
                {[
                  { id: 'followers' as AudienceType, label: 'Followers', icon: Users },
                  { id: 'public' as AudienceType, label: 'Public', icon: Globe },
                  { id: 'close_friends' as AudienceType, label: 'Circle (E2E)', icon: Lock },
                ].map((aud) => (
                  <button
                    key={aud.id}
                    type="button"
                    onClick={() => setAudience(aud.id)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-all ${
                      audience === aud.id
                        ? 'bg-violet-600 text-white'
                        : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300'
                    }`}
                  >
                    <aud.icon className="w-3 h-3" />
                    <span>{aud.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-stone-500">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowComments}
                  onChange={(e) => setAllowComments(e.target.checked)}
                  className="accent-violet-600 rounded"
                />
                <span>Allow comments</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hideLikeCount}
                  onChange={(e) => setHideLikeCount(e.target.checked)}
                  className="accent-violet-600 rounded"
                />
                <span>Hide like count</span>
              </label>
            </div>
          </div>

          {/* Upload Progress Bar */}
          {isSubmitting && (
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-semibold text-violet-600">
                <span>Optimizing & publishing to Samaj...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
                <div
                  className="h-full bg-violet-600 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Submit Action Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white font-semibold text-xs transition-colors shadow-md shadow-violet-600/20 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{isSubmitting ? 'Publishing...' : 'Share Mindfully to Samaj'}</span>
          </button>
        </form>
      </div>
      </div>
    </>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
};

