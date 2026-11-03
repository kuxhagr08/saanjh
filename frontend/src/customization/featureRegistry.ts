export interface SubFeature {
  id: string;
  name: string;
  description: string;
  defaultEnabled: boolean;
  priority: 'P0' | 'P1' | 'P2';
}

export interface AppModuleConfig {
  id: string;
  name: string;
  tagline: string;
  category: 'core' | 'communication' | 'productivity' | 'vault' | 'social' | 'utilities';
  icon: string;
  route: string;
  defaultEnabled: boolean;
  canBeDisabled: boolean;
  whatTurningOffDoes: string;
  subFeatures: SubFeature[];
}

export const APNA_MODULES: AppModuleConfig[] = [
  {
    id: 'home',
    name: 'Home Dashboard',
    tagline: 'Your calm daily sanctuary & mindful briefing',
    category: 'core',
    icon: 'Home',
    route: '/',
    defaultEnabled: true,
    canBeDisabled: false, // Home stays as base anchor
    whatTurningOffDoes: 'Home dashboard is the core launchpad for Saanjh.',
    subFeatures: [
      { id: 'Z01', name: 'Customization Engine', description: 'Central registry & modular on/off controls', defaultEnabled: true, priority: 'P0' },
      { id: 'Z10', name: 'Personality Presets', description: 'One-click profiles for students, parents, pros', defaultEnabled: true, priority: 'P0' },
      { id: 'Z15', name: 'Home Widget Customizer', description: 'Toggle, resize, and reorder home widgets', defaultEnabled: true, priority: 'P0' },
      { id: 'U03', name: 'Liquid Theme System', description: 'Light, Dark, AMOLED, and Liquid Glass aesthetics', defaultEnabled: true, priority: 'P0' },
    ],
  },
  {
    id: 'messages',
    name: 'Circle & Chat',
    tagline: 'End-to-end encrypted private messaging',
    category: 'communication',
    icon: 'MessageSquare',
    route: '/messages',
    defaultEnabled: true,
    canBeDisabled: true,
    whatTurningOffDoes: 'Hides chat navigation, closes real-time WebSockets, and suspends incoming message requests.',
    subFeatures: [
      { id: 'M01', name: '1-to-1 E2E Encrypted Chat', description: 'X25519 + ChaCha20-Poly1305 zero-knowledge chats', defaultEnabled: true, priority: 'P0' },
      { id: 'M04', name: 'Message Requests Control', description: 'Instagram-style review without read-receipt leaks', defaultEnabled: true, priority: 'P0' },
      { id: 'M05', name: 'Who Can Message Me', description: 'Direct, requests, or contacts-only permissioning', defaultEnabled: true, priority: 'P0' },
      { id: 'M18', name: 'Voice Notes', description: 'Encrypted voice recording with playback speeds', defaultEnabled: true, priority: 'P1' },
      { id: 'M26', name: 'Chat Polls', description: 'Private in-chat polls with anonymous voting option', defaultEnabled: true, priority: 'P1' },
      { id: 'M53', name: 'Safety Numbers', description: 'Cryptographic fingerprint verification', defaultEnabled: true, priority: 'P0' },
    ],
  },
  {
    id: 'social',
    name: 'Saanjh Samaj',
    tagline: 'Calm, mindful community & thought sharing',
    category: 'social',
    icon: 'Users',
    route: '/social',
    defaultEnabled: true,
    canBeDisabled: true,
    whatTurningOffDoes: 'Completely disables social feeds, posting composer, story cards, and stops all social activity background polling.',
    subFeatures: [
      { id: 'S01', name: 'Thoughts & Quotes', description: 'Daily "Aaj ka Vichaar" mindful thought posts', defaultEnabled: true, priority: 'P1' },
      { id: 'S02', name: 'Photo & Carousel Posts', description: 'High-res photos with audience privacy controls', defaultEnabled: true, priority: 'P1' },
      { id: 'S04', name: 'Short Video Clips', description: '60s client-compressed mindful videos', defaultEnabled: true, priority: 'P1' },
      { id: 'S08', name: 'Community Polls', description: 'Interactive community polls with instant tally', defaultEnabled: true, priority: 'P1' },
      { id: 'S25', name: 'Audience Selector', description: 'Public, Followers-only, or Close Friends per post', defaultEnabled: true, priority: 'P1' },
      { id: 'S33', name: 'Chronological Feed', description: 'Zero addictive algorithms; calm time-ordered feed', defaultEnabled: true, priority: 'P1' },
      { id: 'S80', name: 'End-of-Feed Card', description: '"You are all caught up" card preventing doomscrolling', defaultEnabled: true, priority: 'P1' },
    ],
  },
  {
    id: 'vault',
    name: 'Encrypted Vault',
    tagline: 'Zero-knowledge AES-256 protected documents & media',
    category: 'vault',
    icon: 'Lock',
    route: '/vault',
    defaultEnabled: true,
    canBeDisabled: true,
    whatTurningOffDoes: 'Locks and hides encrypted files, document templates, and disables local biometric vault unlocking.',
    subFeatures: [
      { id: 'V01', name: 'Encrypted Photos & Media', description: 'Client-side AES-GCM encrypted media gallery', defaultEnabled: true, priority: 'P0' },
      { id: 'V03', name: 'Document Vault', description: 'Store Aadhaar, PAN, certificates with zero cloud leak', defaultEnabled: true, priority: 'P0' },
      { id: 'V04', name: 'Encrypted Private Notes', description: 'Secure notes encrypted before IndexedDB save', defaultEnabled: true, priority: 'P0' },
      { id: 'V29', name: 'Encrypted Backup File', description: 'Export portable encrypted vault snapshot', defaultEnabled: true, priority: 'P0' },
      { id: 'V36', name: 'Strip EXIF Metadata', description: 'Auto-scrubs GPS and device tags before sharing', defaultEnabled: true, priority: 'P1' },
    ],
  },
  {
    id: 'ai',
    name: 'BYOK AI Studio',
    tagline: 'Private AI assistant using your own API keys',
    category: 'productivity',
    icon: 'Sparkles',
    route: '/ai',
    defaultEnabled: true,
    canBeDisabled: true,
    whatTurningOffDoes: 'Hides AI chat, stops background streaming, and secures stored API keys in encrypted storage.',
    subFeatures: [
      { id: 'AI01', name: 'BYOK Key Manager', description: 'Encrypted API keys for Gemini, OpenAI, Claude', defaultEnabled: true, priority: 'P0' },
      { id: 'AI03', name: 'Streaming Response', description: 'Low-latency token streaming with stop/resume', defaultEnabled: true, priority: 'P0' },
      { id: 'AI21', name: 'Samjhao (Letter Explainer)', description: 'Simplifies legal, govt notices & bank statements', defaultEnabled: true, priority: 'P1' },
      { id: 'AI22', name: 'Letter & RTI Drafter', description: 'Draft formal leave letters, complaints, and RTIs', defaultEnabled: true, priority: 'P1' },
      { id: 'AI34', name: 'Data Sent Preview', description: 'Audit exact payload sent to AI providers', defaultEnabled: true, priority: 'P0' },
    ],
  },
  {
    id: 'planner',
    name: 'Planner & Habits',
    tagline: 'Calm task boards, habit streaks & focus timer',
    category: 'productivity',
    icon: 'CheckSquare',
    route: '/planner',
    defaultEnabled: true,
    canBeDisabled: true,
    whatTurningOffDoes: 'Hides task planner, stops habit reminder timers, and removes calendar agendas.',
    subFeatures: [
      { id: 'P01', name: 'Task Management', description: 'Priorities, due dates, subtasks, and checklists', defaultEnabled: true, priority: 'P0' },
      { id: 'P17', name: 'Pomodoro Focus Timer', description: '25/5 min focus blocks with ambient chimes', defaultEnabled: true, priority: 'P0' },
      { id: 'P22', name: 'Habit Tracker & Streaks', description: 'Visual streak heatmaps and daily check-ins', defaultEnabled: true, priority: 'P0' },
      { id: 'P30', name: 'Smart Brain-Dump', description: 'Hinglish natural language parser (e.g. "kal 5pm bill")', defaultEnabled: true, priority: 'P0' },
      { id: 'P35', name: 'Mindful Journal', description: 'Morning/evening gratitude and reflection log', defaultEnabled: true, priority: 'P0' },
    ],
  },
  {
    id: 'growth',
    name: 'Growth & Wellness',
    tagline: 'Holistic wellness, water log & Indian utilities',
    category: 'utilities',
    icon: 'TrendingUp',
    route: '/growth',
    defaultEnabled: true,
    canBeDisabled: true,
    whatTurningOffDoes: 'Hides wellness logs, form utilities, and Indian document tools.',
    subFeatures: [
      { id: 'W01', name: 'Water & Wellness Log', description: 'Quick water intake logger and eye-break timer', defaultEnabled: true, priority: 'P1' },
      { id: 'I01', name: 'Form Ready Image Resizer', description: 'Resize photos & signatures to exact KB for govt portals', defaultEnabled: true, priority: 'P0' },
      { id: 'I08', name: 'Aadhaar / PAN Masking', description: 'Black out first 8 digits locally on device', defaultEnabled: true, priority: 'P0' },
      { id: 'I03', name: 'PDF Compress & Merge', description: 'Client-side PDF tool suite with zero cloud upload', defaultEnabled: true, priority: 'P0' },
      { id: 'I18', name: 'Safe UPI Scanner', description: 'Scans QR codes and warns on deceptive collect requests', defaultEnabled: true, priority: 'P0' },
    ],
  },
  {
    id: 'security',
    name: 'Security Center',
    tagline: 'Cryptographic vault control & device lock',
    category: 'core',
    icon: 'Shield',
    route: '/security',
    defaultEnabled: true,
    canBeDisabled: false, // Security stays available
    whatTurningOffDoes: 'Security center manages device cryptographic keys and auto-lock preferences.',
    subFeatures: [
      { id: 'X01', name: 'Argon2id Worker KDF', description: 'Memory-hard client-side password derivation', defaultEnabled: true, priority: 'P0' },
      { id: 'X03', name: 'Non-Extractable Device Key', description: 'WebCrypto AES-GCM envelope prevents reload re-prompts', defaultEnabled: true, priority: 'P0' },
      { id: 'X05', name: 'WebAuthn Biometric Unlock', description: 'Fingerprint / Face ID hardware quick-unlock', defaultEnabled: true, priority: 'P0' },
      { id: 'X19', name: 'Zero-Knowledge Privacy Audit', description: 'Inspect exactly what server can and cannot see', defaultEnabled: true, priority: 'P0' },
    ],
  },
];

export interface CustomizationPreset {
  id: string;
  name: string;
  description: string;
  badge: string;
  enabledModules: string[];
  mobileTabs: string[];
}

export const CUSTOMIZATION_PRESETS: CustomizationPreset[] = [
  {
    id: 'standard',
    name: 'Balanced Space (Default)',
    description: 'All essential Saanjh modules enabled with social, chat, planner, and vault.',
    badge: 'Popular',
    enabledModules: ['home', 'messages', 'social', 'vault', 'ai', 'planner', 'growth', 'security'],
    mobileTabs: ['home', 'messages', 'social', 'planner', 'vault'],
  },
  {
    id: 'minimal',
    name: 'Minimal Sanctuary',
    description: 'Distraction-free: just home, vault notes, and essential planner.',
    badge: 'Calm',
    enabledModules: ['home', 'vault', 'planner', 'security'],
    mobileTabs: ['home', 'planner', 'vault', 'security'],
  },
  {
    id: 'student',
    name: 'Student & Exams',
    description: 'Study Pomodoro, habit streaks, AI explainer, and form photo tools.',
    badge: 'Focused',
    enabledModules: ['home', 'planner', 'ai', 'growth', 'vault', 'security'],
    mobileTabs: ['home', 'planner', 'ai', 'growth', 'vault'],
  },
  {
    id: 'privacy_max',
    name: 'Privacy Fortress',
    description: 'Zero social, strict E2E encrypted chat, client-only vault, and security controls.',
    badge: 'Hardened',
    enabledModules: ['home', 'messages', 'vault', 'security'],
    mobileTabs: ['home', 'messages', 'vault', 'security'],
  },
  {
    id: 'creator',
    name: 'Creator & Social',
    description: 'Saanjh Samaj community, AI drafter, photo vault, and task management.',
    badge: 'Expressive',
    enabledModules: ['home', 'social', 'messages', 'ai', 'vault', 'planner', 'security'],
    mobileTabs: ['home', 'social', 'messages', 'ai', 'vault'],
  },
];

export const getModuleConfig = (id: string): AppModuleConfig | undefined => {
  return APNA_MODULES.find((m) => m.id === id);
};
