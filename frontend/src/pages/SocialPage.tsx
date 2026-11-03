import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { ReelsPlayer } from '../components/social/ReelsPlayer';
import { useIntent } from '../context/IntentContext';
import { SamajCreateModal, PostType } from '../components/social/SamajCreateModal';
import { CommentsBottomSheet, CommentItem } from '../components/social/CommentsBottomSheet';
import { PostActionMenu } from '../components/social/PostActionMenu';
import { AuthorProfileModal } from '../components/social/AuthorProfileModal';
import { CircleDetailModal, CircleItem } from '../components/social/CircleDetailModal';
import { StoryViewerModal, StoryGroup } from '../components/social/StoryViewerModal';
import { APP_NAME } from '../constants';
import {
  Video,
  LayoutGrid,
  Users,
  PlusCircle,
  Plus,
  Sparkles,
  Heart,
  MessageSquare,
  Share2,
  Bookmark,
  Send,
  Image as ImageIcon,
  CheckCircle2,
  Lock,
  Globe,
  Flame,
  Check,
  ShieldCheck,
  X,
  Camera,
  ChevronLeft,
  ChevronRight,
  Sliders,
  MoreHorizontal,
  Compass,
  ArrowRight,
  Clock,
  Search,
  Filter,
} from 'lucide-react';

type SamajTab = 'feed' | 'reels' | 'stories' | 'communities' | 'create';

const SAMPLE_STORIES: StoryGroup[] = [
  {
    id: 'story-1',
    userName: 'Aarav Mehta',
    userHandle: 'aarav_mindful',
    avatarColor: 'from-violet-500 to-indigo-600',
    hasUnread: true,
    viewsCount: 34,
    segments: [
      {
        id: 'seg-1',
        mediaUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80',
        caption: 'Morning meditation in Dharamshala. Pure silence before sunrise.',
        durationSeconds: 5,
      },
      {
        id: 'seg-2',
        mediaUrl: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&auto=format&fit=crop&q=80',
        caption: 'Chai after early walk. Remember to step outside today!',
        durationSeconds: 5,
      },
    ],
  },
  {
    id: 'story-2',
    userName: 'Dr. Ananya Rao',
    userHandle: 'ananya_neuro',
    avatarColor: 'from-emerald-500 to-teal-600',
    hasUnread: true,
    viewsCount: 62,
    segments: [
      {
        id: 'seg-3',
        mediaUrl: 'https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?w=800&auto=format&fit=crop&q=80',
        caption: 'Deep work and circadian rhythm notes. Disconnect 1 hour before bed!',
        durationSeconds: 5,
      },
    ],
  },
  {
    id: 'story-3',
    userName: 'Priya Sharma',
    userHandle: 'priya_creative',
    avatarColor: 'from-amber-500 to-orange-500',
    hasUnread: false,
    viewsCount: 28,
    segments: [
      {
        id: 'seg-4',
        mediaUrl: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&auto=format&fit=crop&q=80',
        caption: `Zero tracking social space on ${APP_NAME}. Built for mindful connection.`,
        durationSeconds: 5,
      },
    ],
  },
];

const SAMPLE_COMMUNITIES: CircleItem[] = [
  {
    id: 'comm-1',
    name: 'Bangalore Tech & Chai',
    tagline: 'Founders, devs & designers building calm, mindful products in India.',
    category: 'Technology & Startups',
    membersCount: 1420,
    isMember: true,
    rules: ['No unsolicited marketing', 'Respect everyone', 'Keep technical debates constructive'],
    bannerGradient: 'from-indigo-600 to-purple-800',
    description: 'A sanctuary for Indian tech founders and makers who prefer high signal over noise.',
  },
  {
    id: 'comm-2',
    name: 'Hindi Sahitya & Vichaar',
    tagline: 'Kavita, gazal aur vicharon ka ek shant kona.',
    category: 'Literature & Culture',
    membersCount: 890,
    isMember: false,
    rules: ['Bhasha ki maryada', 'Original lekhak ka naam zaroor dein', 'Samvedansheelta'],
    bannerGradient: 'from-amber-600 to-rose-700',
    description: 'Hindi sahitya ke premiyon ke liye ek surakshit aur shant sthan.',
  },
  {
    id: 'comm-3',
    name: 'Mindful Living India',
    tagline: 'Pranayama, digital detox, mental wellness and mindful routines.',
    category: 'Health & Wellness',
    membersCount: 2310,
    isMember: true,
    rules: ['Evidence-backed wellness only', 'No medical prescriptions', 'Encourage peer support'],
    bannerGradient: 'from-emerald-600 to-teal-800',
    description: 'Evidence-based mindful habits, morning routines, and digital decluttering.',
  },
  {
    id: 'comm-4',
    name: 'UPSC & State PSC Aspirants',
    tagline: 'Dedicated study circle, peer answer writing review, zero gossip.',
    category: 'Education & Career',
    membersCount: 3120,
    isMember: false,
    rules: ['Strictly study-related queries', 'Share authentic sources', 'No spam links'],
    bannerGradient: 'from-blue-600 to-cyan-800',
    description: 'Focus-first environment for aspirants preparing for civil services.',
  },
];

export const SocialPage: React.FC = () => {
  const { user } = useAuth();
  const { record } = useIntent();
  const [activeTab, setActiveTab] = useState<SamajTab>('feed');

  // Stories & Circles State
  const [stories, setStories] = useState<StoryGroup[]>(SAMPLE_STORIES);
  const [activeStoryIdx, setActiveStoryIdx] = useState<number | null>(null);
  const [communities, setCommunities] = useState<CircleItem[]>(SAMPLE_COMMUNITIES);
  const [searchCircleQuery, setSearchCircleQuery] = useState('');

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createInitialType, setCreateInitialType] = useState<PostType>('thought');
  const [actionMenuPost, setActionMenuPost] = useState<any | null>(null);
  const [commentsPost, setCommentsPost] = useState<any | null>(null);
  const [profileModalAuthor, setProfileModalAuthor] = useState<any | null>(null);
  const [selectedCircle, setSelectedCircle] = useState<CircleItem | null>(null);

  // Comments map per post
  const [commentsByPost, setCommentsByPost] = useState<Record<string, CommentItem[]>>({
    'post-1': [
      {
        id: 'c-1',
        authorId: 102,
        authorName: 'Priya Sharma',
        authorHandle: 'priya_creative',
        authorAvatarColor: 'from-emerald-500 to-teal-600',
        text: 'Needed this reflection today. Thank you Aarav!',
        timestamp: Date.now() - 1000 * 60 * 15,
        likes: 3,
        isLiked: false,
      },
    ],
    'post-2': [
      {
        id: 'c-2',
        authorId: 101,
        authorName: 'Aarav Mehta',
        authorHandle: 'aarav_mindful',
        authorAvatarColor: 'from-violet-500 to-indigo-600',
        text: 'Stunning light. Pure calm.',
        timestamp: Date.now() - 1000 * 60 * 45,
        likes: 5,
        isLiked: true,
      },
    ],
  });

  const handleAddComment = (text: string, _replyToId?: string) => {
    if (!commentsPost) return;
    const newComment: CommentItem = {
      id: `c-${Date.now()}`,
      authorId: user?.id || 1,
      authorName: user?.display_name || user?.username || 'You',
      authorHandle: user?.username || 'you',
      authorAvatarColor: 'from-violet-500 to-indigo-600',
      text,
      timestamp: Date.now(),
      likes: 0,
      isLiked: false,
    };
    setCommentsByPost((prev) => ({
      ...prev,
      [commentsPost.id]: [...(prev[commentsPost.id] || []), newComment],
    }));
    setPosts((prev) =>
      prev.map((p) =>
        p.id === commentsPost.id ? { ...p, commentsCount: (p.commentsCount || 0) + 1 } : p
      )
    );
  };

  const handleDeleteComment = (commentId: string) => {
    if (!commentsPost) return;
    setCommentsByPost((prev) => ({
      ...prev,
      [commentsPost.id]: (prev[commentsPost.id] || []).filter((c) => c.id !== commentId),
    }));
    setPosts((prev) =>
      prev.map((p) =>
        p.id === commentsPost.id ? { ...p, commentsCount: Math.max(0, (p.commentsCount || 1) - 1) } : p
      )
    );
  };

  // Toast / feedback state
  const [toastMessage, setToastMessage] = useState('');

  // Feed Posts State
  const [posts, setPosts] = useState<any[]>([
    {
      id: 'post-1',
      author: {
        id: 101,
        name: 'Aarav Mehta',
        handle: 'aarav_mindful',
        avatarColor: 'from-violet-500 to-indigo-600',
        verified: true,
      },
      content: '“A sanctuary isn’t a place where noise doesn’t exist — it is a space where your peace is louder than the noise.” — Aaj ka Vichaar 🌿',
      type: 'thought',
      gradient: 'from-purple-900 via-indigo-950 to-stone-900',
      audience: 'followers',
      timestamp: Date.now() - 1000 * 60 * 25,
      likes: 42,
      isLiked: false,
      commentsCount: 6,
      isSaved: false,
    },
    {
      id: 'post-2',
      author: {
        id: 102,
        name: 'Priya Sharma',
        handle: 'priya_creative',
        avatarColor: 'from-emerald-500 to-teal-600',
        verified: true,
      },
      content: 'Morning light in Himachal. Shot on device, zero cloud tracking. Breathing in the calm before deep work sessions begin.',
      type: 'photo',
      mediaUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80',
      mediaAspect: 'aspect-video',
      audience: 'public',
      timestamp: Date.now() - 1000 * 60 * 90,
      likes: 89,
      isLiked: true,
      commentsCount: 14,
      isSaved: true,
    },
    {
      id: 'post-3',
      author: {
        id: 103,
        name: 'Vikram Joshi',
        handle: 'vikram_code',
        avatarColor: 'from-amber-500 to-orange-500',
        verified: false,
      },
      content: 'Quick poll for student folks: How much time do you spend preparing for government exams per day?',
      type: 'poll',
      pollOptions: [
        { text: 'Less than 3 hours', votes: 12 },
        { text: '4 to 6 hours', votes: 48 },
        { text: '6 to 8 hours', votes: 31 },
        { text: '8+ hours (Monk mode)', votes: 19 },
      ],
      audience: 'public',
      timestamp: Date.now() - 1000 * 60 * 180,
      likes: 34,
      isLiked: false,
      commentsCount: 22,
      isSaved: false,
    },
  ]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2500);
  };

  const tabsRef = useRef<HTMLDivElement>(null);
  const activeTabBtnRef = useRef<HTMLButtonElement>(null);

  // Auto-scroll active tab into view on mobile
  useEffect(() => {
    if (activeTabBtnRef.current && tabsRef.current) {
      activeTabBtnRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [activeTab]);

  const handleVotePoll = (postId: string, optIndex: number) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId && p.pollVotedIndex === undefined) {
          const nextOpts = [...p.pollOptions];
          nextOpts[optIndex].votes += 1;
          return {
            ...p,
            pollOptions: nextOpts,
            pollVotedIndex: optIndex,
          };
        }
        return p;
      })
    );
    showToast('Vote recorded!');
  };

  const handleToggleLike = (postId: string) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId) {
          const next = !p.isLiked;
          if (next) record('likes');
          return { ...p, isLiked: next, likes: next ? p.likes + 1 : p.likes - 1 };
        }
        return p;
      })
    );
  };

  const handleToggleSave = (postId: string) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId) {
          const nextSaved = !p.isSaved;
          showToast(nextSaved ? 'Saved to bookmarks' : 'Removed from bookmarks');
          return { ...p, isSaved: nextSaved };
        }
        return p;
      })
    );
  };

  const handleToggleJoinCircle = (circleId: string) => {
    setCommunities((prev) =>
      prev.map((c) => {
        if (c.id === circleId) {
          const nextStatus = !c.isMember;
          showToast(nextStatus ? `Joined ${c.name}` : `Left ${c.name}`);
          return {
            ...c,
            isMember: nextStatus,
            membersCount: nextStatus ? c.membersCount + 1 : c.membersCount - 1,
          };
        }
        return c;
      })
    );
    if (selectedCircle && selectedCircle.id === circleId) {
      setSelectedCircle((prev) =>
        prev
          ? {
              ...prev,
              isMember: !prev.isMember,
              membersCount: !prev.isMember ? prev.membersCount + 1 : prev.membersCount - 1,
            }
          : null
      );
    }
  };

  const handlePostCreated = (newPost: any) => {
    if (newPost.type === 'story') {
      // Add to user's stories
      const userStory: StoryGroup = {
        id: `story-${Date.now()}`,
        userName: user?.display_name || user?.username || 'You',
        userHandle: user?.username || 'you',
        avatarColor: 'from-violet-500 to-indigo-600',
        hasUnread: true,
        isOwn: true,
        viewsCount: 1,
        segments: [
          {
            id: `seg-${Date.now()}`,
            mediaUrl: newPost.mediaUrl || 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800',
            caption: newPost.content || '',
            durationSeconds: 5,
          },
        ],
      };
      setStories([userStory, ...stories]);
      showToast('24h Story published to Samaj!');
      setActiveTab('stories');
    } else {
      setPosts([newPost, ...posts]);
      record('posts');
      showToast('Post shared mindfully to Samaj!');
      setActiveTab('feed');
    }
  };

  const filteredCommunities = communities.filter(
    (c) =>
      c.name.toLowerCase().includes(searchCircleQuery.toLowerCase()) ||
      c.category.toLowerCase().includes(searchCircleQuery.toLowerCase()) ||
      c.tagline.toLowerCase().includes(searchCircleQuery.toLowerCase())
  );

  return (
    <div className="w-full max-w-full min-w-0 space-y-4 animate-fade-in pb-16 sm:pb-8">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-[99999] bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-medium flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Samaj Header & Navigation Tabs (Bug A4 Fix: Scrollable chip row with edge fade) */}
      <div className="bg-apna-surface border border-apna-border rounded-2xl p-2.5 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              🌸
            </div>
            <div>
              <h1 className="text-sm font-bold text-apna-text leading-tight">{APP_NAME} Samaj</h1>
              <p className="text-[11px] text-apna-faint hidden sm:block">Mindful, zero-storage social space</p>
            </div>
          </div>

          {/* Quick Create Button */}
          <button
            onClick={() => {
              setCreateInitialType('thought');
              setIsCreateOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-apna-accent text-white text-xs font-semibold hover:bg-apna-accent-ink transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Create</span>
          </button>
        </div>

        {/* Tab row: horizontally scrollable with edge fade container */}
        <div className="relative">
          <div
            ref={tabsRef}
            className="flex items-center gap-1.5 overflow-x-auto scroll-smooth hide-scrollbar p-1 bg-apna-surface-2 rounded-xl border border-apna-border"
          >
            {[
              { id: 'feed' as SamajTab, label: 'Feed', icon: LayoutGrid },
              { id: 'reels' as SamajTab, label: 'Reels', icon: Video },
              { id: 'stories' as SamajTab, label: 'Stories', icon: Camera },
              { id: 'communities' as SamajTab, label: 'Circles', icon: Users },
              { id: 'create' as SamajTab, label: 'Create', icon: PlusCircle },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  ref={isActive ? activeTabBtnRef : null}
                  onClick={() => {
                    if (tab.id === 'create') {
                      setCreateInitialType('thought');
                      setIsCreateOpen(true);
                    } else {
                      setActiveTab(tab.id);
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                    isActive
                      ? 'bg-apna-surface text-apna-accent shadow-xs border border-apna-border'
                      : 'text-apna-muted hover:text-apna-text'
                  }`}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* TAB 1: FEED EXPERIENCE */}
      {activeTab === 'feed' && (
        <div className="space-y-4 max-w-2xl mx-auto w-full overflow-hidden animate-fade-in">
          {/* Stories Horizontal Tray */}
          <div className="bg-apna-surface border border-apna-border rounded-2xl p-3 shadow-xs w-full overflow-hidden">
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="text-[11px] font-bold text-apna-faint uppercase tracking-wider">
                24h Ephemeral Stories
              </p>
              <button
                onClick={() => setActiveTab('stories')}
                className="text-[11px] text-apna-accent font-semibold hover:underline cursor-pointer"
              >
                View all
              </button>
            </div>
            <div className="flex items-center gap-3 overflow-x-auto hide-scrollbar py-1 w-full min-w-0">
              {/* Add Story Button */}
              <button
                onClick={() => {
                  setCreateInitialType('story');
                  setIsCreateOpen(true);
                }}
                className="flex flex-col items-center gap-1.5 group cursor-pointer shrink-0 text-center"
              >
                <div className="w-14 h-14 rounded-full border-2 border-dashed border-apna-accent/60 hover:border-apna-accent flex items-center justify-center bg-apna-surface-2 transition-transform group-hover:scale-105">
                  <Plus className="w-5 h-5 text-apna-accent" />
                </div>
                <span className="text-[11px] font-medium text-apna-text">Your Story</span>
              </button>

              {stories.map((story, idx) => (
                <button
                  key={story.id}
                  onClick={() => {
                    setActiveStoryIdx(idx);
                  }}
                  className="flex flex-col items-center gap-1.5 group cursor-pointer shrink-0 text-center"
                >
                  <div
                    className={`w-14 h-14 rounded-full p-0.5 flex items-center justify-center transition-transform group-hover:scale-105 ${
                      story.hasUnread
                        ? 'bg-gradient-to-tr from-amber-500 via-rose-500 to-violet-600 shadow-sm'
                        : 'bg-stone-300 dark:bg-stone-700'
                    }`}
                  >
                    <div
                      className={`w-full h-full rounded-full bg-gradient-to-br ${story.avatarColor} border-2 border-apna-surface flex items-center justify-center text-white text-xs font-bold`}
                    >
                      {story.userName.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase()}
                    </div>
                  </div>
                  <span className="text-[11px] font-medium text-apna-text truncate max-w-[70px]">
                    {story.userName.split(' ')[0]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Feed Posts */}
          <div className="space-y-4 max-w-2xl mx-auto">
            {posts.map((post) => (
              <article
                key={post.id}
                className="bg-apna-surface border border-apna-border rounded-2xl overflow-hidden shadow-xs space-y-3 p-4"
              >
                {/* Author Header */}
                <div className="flex items-center justify-between">
                  <div
                    onClick={() => setProfileModalAuthor(post.author)}
                    className="flex items-center gap-2.5 cursor-pointer group"
                  >
                    <div
                      className={`w-9 h-9 rounded-full bg-gradient-to-br ${post.author.avatarColor} flex items-center justify-center text-white text-xs font-bold shadow-xs group-hover:scale-105 transition-transform`}
                    >
                      {post.author.name.replace(/[^a-zA-Z]/g, '').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-1">
                        <p className="text-xs font-bold text-apna-text group-hover:text-apna-accent transition-colors">
                          {post.author.name}
                        </p>
                        {post.author.verified && <ShieldCheck className="w-3.5 h-3.5 text-sky-500" />}
                      </div>
                      <p className="text-[10px] text-apna-faint">
                        @{post.author.handle} · {post.audience}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActionMenuPost(post)}
                    aria-label="Post actions"
                    className="text-apna-faint hover:text-apna-text p-1.5 rounded-lg hover:bg-apna-surface-2 transition-colors cursor-pointer"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>

                {/* Content: Thought Card OR Photo OR Poll */}
                {post.type === 'thought' ? (
                  <div
                    className={`p-6 rounded-xl bg-gradient-to-br ${
                      post.gradient || 'from-violet-900 to-indigo-950'
                    } text-white shadow-inner leading-relaxed text-sm font-medium`}
                  >
                    {post.content}
                  </div>
                ) : post.type === 'photo' ? (
                  <div className="space-y-2">
                    <p className="text-xs text-apna-text leading-relaxed">{post.content}</p>
                    {post.mediaUrl && (
                      <div className="rounded-xl overflow-hidden border border-apna-border bg-black/5">
                        <img
                          src={post.mediaUrl}
                          alt="Post media"
                          className="w-full h-auto object-cover max-h-96"
                          loading="lazy"
                        />
                      </div>
                    )}
                  </div>
                ) : post.type === 'poll' ? (
                  <div className="space-y-3">
                    <p className="text-xs text-apna-text font-medium leading-relaxed">{post.content}</p>
                    <div className="space-y-2">
                      {post.pollOptions?.map((opt: any, optIdx: number) => {
                        const totalVotes = post.pollOptions.reduce(
                          (a: number, b: any) => a + (b.votes || 0),
                          0
                        );
                        const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
                        const isVoted = post.pollVotedIndex === optIdx;

                        return (
                          <button
                            key={opt.text}
                            onClick={() => handleVotePoll(post.id, optIdx)}
                            className={`w-full p-2.5 rounded-xl border text-left text-xs font-medium relative overflow-hidden transition-all cursor-pointer ${
                              isVoted
                                ? 'border-apna-accent text-apna-accent bg-apna-accent-soft font-semibold'
                                : 'border-apna-border hover:bg-apna-surface-2 text-apna-text'
                            }`}
                          >
                            <div
                              className="absolute inset-y-0 left-0 bg-apna-accent/15 transition-all duration-500"
                              style={{ width: `${pct}%` }}
                            />
                            <div className="relative flex justify-between items-center z-10">
                              <span>{opt.text}</span>
                              <span className="font-bold text-[11px]">{pct}%</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {/* Action Bar */}
                <div className="flex items-center justify-between pt-1 border-t border-apna-border text-apna-muted text-xs">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleToggleLike(post.id)}
                      className={`flex items-center gap-1.5 cursor-pointer transition-colors ${
                        post.isLiked ? 'text-rose-500 font-semibold' : 'hover:text-apna-text'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${post.isLiked ? 'fill-rose-500' : ''}`} />
                      <span>{post.likes}</span>
                    </button>
                    <button
                      onClick={() => setCommentsPost(post)}
                      className="flex items-center gap-1.5 hover:text-apna-text cursor-pointer transition-colors"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>{post.commentsCount || 0}</span>
                    </button>
                    <button
                      onClick={() => {
                        navigator.clipboard?.writeText?.(window.location.origin + `/#/samaj/post/${post.id}`);
                        showToast('Post link copied!');
                      }}
                      className="flex items-center gap-1.5 hover:text-apna-text cursor-pointer transition-colors"
                      title="Share Post"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => handleToggleSave(post.id)}
                    className={`cursor-pointer transition-colors ${
                      post.isSaved ? 'text-apna-accent' : 'hover:text-apna-text'
                    }`}
                    title="Bookmark Post"
                  >
                    <Bookmark className={`w-4 h-4 ${post.isSaved ? 'fill-apna-accent' : ''}`} />
                  </button>
                </div>
              </article>
            ))}

            {/* Mindful End of Feed Card (A11 compliant) */}
            <div className="p-6 rounded-2xl bg-apna-surface border border-apna-border text-center space-y-2">
              <Check className="w-6 h-6 text-emerald-500 mx-auto" />
              <p className="text-xs font-bold text-apna-text">You're All Caught Up for Today</p>
              <p className="text-[11px] text-apna-faint">
                No infinite doomscrolling. Your time and peace are respected in {APP_NAME}.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: REELS EXPERIENCE */}
      {activeTab === 'reels' && (
        <div className="animate-fade-in">
          <ReelsPlayer />
        </div>
      )}

      {/* TAB 3: STORIES TAB (Bug A3 Fix: Rich stories browser with empty state) */}
      {activeTab === 'stories' && (
        <div className="max-w-2xl mx-auto w-full space-y-4 animate-fade-in overflow-hidden">
          <div className="bg-apna-surface border border-apna-border rounded-2xl p-4 shadow-xs flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-apna-text">Daily 24h Stories</h2>
              <p className="text-xs text-apna-faint mt-0.5">
                Share fleeting moments with friends. Encrypted and auto-deleted in 24 hours.
              </p>
            </div>
            <button
              onClick={() => {
                setCreateInitialType('story');
                setIsCreateOpen(true);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-apna-accent text-white text-xs font-semibold hover:bg-apna-accent-ink transition-colors cursor-pointer shadow-xs flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Story</span>
            </button>
          </div>

          {stories.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full overflow-hidden">
              {stories.map((story, idx) => (
                <div
                  key={story.id}
                  onClick={() => setActiveStoryIdx(idx)}
                  className="aspect-[3/4] rounded-2xl overflow-hidden bg-stone-900 relative group cursor-pointer border border-apna-border shadow-xs hover:shadow-md transition-all"
                >
                  <img
                    src={story.segments[0]?.mediaUrl}
                    alt={story.userName}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 p-3 flex flex-col justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-7 h-7 rounded-full bg-gradient-to-br ${story.avatarColor} border border-white/50 flex items-center justify-center text-white text-[10px] font-bold`}
                      >
                        {story.userName.slice(0, 1)}
                      </div>
                      <span className="text-white text-xs font-bold truncate">
                        {story.userName}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <p className="text-white/90 text-[11px] line-clamp-2 leading-tight">
                        {story.segments[0]?.caption}
                      </p>
                      <div className="flex items-center gap-1 text-[10px] text-white/70">
                        <Clock className="w-3 h-3" />
                        <span>Expires in 24h</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Rich Empty State (A11) */
            <div className="bg-apna-surface border border-apna-border rounded-2xl p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-apna-accent/15 text-apna-accent flex items-center justify-center mx-auto">
                <Camera className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-apna-text">No active stories right now</h3>
              <p className="text-xs text-apna-faint max-w-sm mx-auto">
                Stories disappear after 24 hours. Be the first to share your mindful moment today!
              </p>
              <button
                onClick={() => {
                  setCreateInitialType('story');
                  setIsCreateOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-apna-accent text-white text-xs font-semibold shadow-xs cursor-pointer hover:bg-apna-accent-ink"
              >
                Post Your Story
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: CIRCLES / COMMUNITIES (Bug A3 Fix: Rich community browser with empty states) */}
      {activeTab === 'communities' && (
        <div className="space-y-4 max-w-2xl mx-auto w-full animate-fade-in overflow-hidden">
          <div className="bg-apna-surface border border-apna-border rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-apna-text">Explore Samaj Circles</h2>
                <p className="text-xs text-apna-faint mt-0.5">
                  Safe, interest-based communities without tracking algorithms.
                </p>
              </div>
              <button
                onClick={() => {
                  setCreateInitialType('thought');
                  setIsCreateOpen(true);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-apna-accent text-white text-xs font-semibold hover:bg-apna-accent-ink transition-colors cursor-pointer shadow-xs shrink-0"
              >
                Create Circle
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-apna-faint absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search circles by name, category or topic..."
                value={searchCircleQuery}
                onChange={(e) => setSearchCircleQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-apna-surface-2 border border-apna-border text-xs text-apna-text placeholder:text-apna-faint focus:outline-none focus:border-apna-accent"
              />
            </div>
          </div>

          {filteredCommunities.length > 0 ? (
            <div className="grid grid-cols-1 gap-3">
              {filteredCommunities.map((comm) => (
                <div
                  key={comm.id}
                  onClick={() => setSelectedCircle(comm)}
                  className="bg-apna-surface border border-apna-border rounded-2xl overflow-hidden shadow-xs hover:border-apna-accent/40 transition-colors cursor-pointer group"
                >
                  <div
                    className={`h-16 bg-gradient-to-r ${comm.bannerGradient} p-4 flex items-end justify-between text-white font-bold text-sm`}
                  >
                    <span>{comm.name}</span>
                    <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-black/30 backdrop-blur-xs">
                      {comm.category}
                    </span>
                  </div>
                  <div className="p-4 space-y-3">
                    <p className="text-xs text-apna-text leading-relaxed">{comm.tagline}</p>
                    <div className="flex flex-wrap gap-1.5 text-[10px] text-apna-faint">
                      {comm.rules.map((r, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md bg-apna-surface-2 border border-apna-border"
                        >
                          ✓ {r}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-apna-muted font-medium">
                        {comm.membersCount} members
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleJoinCircle(comm.id);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                          comm.isMember
                            ? 'bg-apna-surface-2 text-apna-text border border-apna-border'
                            : 'bg-apna-accent text-white shadow-xs'
                        }`}
                      >
                        {comm.isMember ? 'Joined' : 'Join Circle'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Rich Empty State (A11) */
            <div className="bg-apna-surface border border-apna-border rounded-2xl p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-apna-surface-2 text-apna-faint flex items-center justify-center mx-auto">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-apna-text">No matching circles found</h3>
              <p className="text-xs text-apna-faint max-w-sm mx-auto">
                Try searching with different keywords or start your own community circle.
              </p>
              <button
                onClick={() => setSearchCircleQuery('')}
                className="px-4 py-2 rounded-xl bg-apna-surface-2 border border-apna-border text-xs font-semibold text-apna-text hover:bg-apna-surface cursor-pointer"
              >
                Clear Search
              </button>
            </div>
          )}
        </div>
      )}

      {/* Floating "+" Action Button on Mobile */}
      <button
        onClick={() => {
          setCreateInitialType('thought');
          setIsCreateOpen(true);
        }}
        aria-label="Create new post"
        className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-40 w-12 h-12 rounded-full bg-apna-accent text-white shadow-xl flex items-center justify-center hover:bg-apna-accent-ink transition-transform hover:scale-105 active:scale-95 cursor-pointer"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* MODALS */}
      {/* 1. Full Samaj Create Modal (Bug A2) */}
      <SamajCreateModal
        isOpen={isCreateOpen}
        initialType={createInitialType}
        onClose={() => setIsCreateOpen(false)}
        onPostCreated={handlePostCreated}
      />

      {/* 2. Full-Screen Story Viewer Modal */}
      {activeStoryIdx !== null && (
        <StoryViewerModal
          isOpen={activeStoryIdx !== null}
          stories={stories}
          initialStoryIdx={activeStoryIdx}
          onClose={() => setActiveStoryIdx(null)}
          onSendReply={(storyId, replyText) => {
            showToast('Reply sent via encrypted channel!');
          }}
        />
      )}

      {/* 3. Post Action Menu */}
      <PostActionMenu
        isOpen={actionMenuPost !== null}
        post={actionMenuPost}
        isAuthor={actionMenuPost?.author?.id === (user?.id || 1)}
        onClose={() => setActionMenuPost(null)}
        onSave={() => {
          if (actionMenuPost) handleToggleSave(actionMenuPost.id);
        }}
        onCopyLink={() => {
          if (actionMenuPost) {
            navigator.clipboard?.writeText?.(window.location.origin + `/#/samaj/post/${actionMenuPost.id}`);
            showToast('Link copied to clipboard');
          }
        }}
        onShareToCircle={() => {
          showToast('Shared to your active circles!');
        }}
        onMuteAuthor={() => {
          showToast(`Muted @${actionMenuPost?.author?.handle}`);
        }}
        onUnfollow={() => {
          showToast(`Unfollowed @${actionMenuPost?.author?.handle}`);
        }}
        onNotInterested={() => {
          setPosts((prev) => prev.filter((p) => p.id !== actionMenuPost?.id));
          showToast('We will show less posts like this');
        }}
        onReport={() => {
          showToast('Report submitted to moderation queue');
        }}
        onDelete={() => {
          setPosts((prev) => prev.filter((p) => p.id !== actionMenuPost?.id));
          showToast('Post deleted');
        }}
      />

      {/* 4. Comments Bottom Sheet */}
      <CommentsBottomSheet
        isOpen={commentsPost !== null}
        postId={commentsPost?.id || ''}
        postAuthorName={commentsPost?.author?.name || ''}
        comments={commentsPost ? commentsByPost[commentsPost.id] || [] : []}
        onClose={() => setCommentsPost(null)}
        onAddComment={handleAddComment}
        onDeleteComment={handleDeleteComment}
      />

      {/* 5. Author Profile Modal */}
      <AuthorProfileModal
        isOpen={profileModalAuthor !== null}
        author={profileModalAuthor}
        posts={posts}
        onClose={() => setProfileModalAuthor(null)}
        onToggleFollow={(authorId) => {
          showToast('Follow status updated');
        }}
        onOpenDirectChat={(handle) => {
          window.location.hash = `#/chat?user=${handle}`;
        }}
      />

      {/* 6. Circle Detail Modal */}
      <CircleDetailModal
        isOpen={selectedCircle !== null}
        circle={selectedCircle}
        onClose={() => setSelectedCircle(null)}
        onToggleJoin={handleToggleJoinCircle}
        onPostToCircle={(circleId) => {
          setCreateInitialType('thought');
          setIsCreateOpen(true);
        }}
      />
    </div>
  );
};
