import Dexie, { type Table } from 'dexie';

export interface LocalIdentityKey {
  id: string; // 'current'
  email: string;
  publicKeyBase64: string; // X25519 public
  privateKeyEncrypted: string; // Ciphertext of private key encrypted by user password/passphrase
  nonce: string;
  signingPublicKeyBase64: string; // Ed25519 public
  signingPrivateKeyEncrypted: string;
  fingerprint: string;
  createdAt: number;
}

export interface LocalContact {
  id: number; // server user id
  email: string;
  displayName: string;
  username?: string;
  avatarUrl?: string;
  avatarColor?: string;
  phoneNumber?: string;
  publicKeyBase64: string;
  signingPublicKeyBase64: string;
  fingerprint: string;
  verified: boolean;
  notes?: string;
  addedAt: number;
  isRequestAccepted?: boolean;
  shareMyPhoneWithContact?: boolean;
  shareMyEmailWithContact?: boolean;
  hasContactSharedPhone?: boolean;
  hasContactSharedEmail?: boolean;
}

export interface MessageAttachment {
  type: 'image' | 'video' | 'audio' | 'voice_note' | 'document' | 'location';
  url?: string; // base64 data URL or local object URL
  data?: string; // base64 encoded media stored locally on user device
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  duration?: number; // seconds for voice note / audio / video
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
  };
}

export interface LocalMessage {
  id?: number;
  serverMessageId?: number;
  conversationId: number;
  senderId: number;
  senderEmail: string;
  plaintext: string; // Decrypted strictly in browser
  timestamp: number;
  status: 'pending' | 'sent' | 'delivered' | 'failed';
  isDisappearing?: boolean;
  expiresAt?: number;
  replyToId?: number;
  reactions?: Record<string, string[]>; // emoji -> array of userEmails
  attachment?: MessageAttachment;
}

export interface LocalVaultItem {
  id?: number;
  name: string;
  type: 'image' | 'video' | 'document' | 'note';
  mimeType: string;
  sizeBytes: number;
  folder: string;
  tags: string[];
  isFavorite: boolean;
  isDeleted: boolean;
  deletedAt?: number;
  // Envelope encryption: file data is encrypted with a random fileKey,
  // and fileKey is wrapped with the user masterKey.
  encryptedData: ArrayBuffer;
  dataNonce: string; // Base64
  wrappedFileKey: string; // Base64
  keyNonce: string; // Base64
  thumbnailUrl?: string; // transient or decrypted preview
  createdAt: number;
  updatedAt: number;
}

export interface LocalTask {
  id?: number;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: string;
  tags: string[];
  isRecurring?: boolean;
  recurrenceRule?: string;
  createdAt: number;
  completedAt?: number;
}

export interface LocalHabit {
  id?: number;
  title: string;
  category: string;
  targetPerWeek: number;
  streak: number;
  history: Record<string, boolean>; // 'YYYY-MM-DD' -> true
  createdAt: number;
}

export interface LocalNote {
  id?: number;
  title: string;
  content: string;
  tags: string[];
  isPinned: boolean;
  updatedAt: number;
  createdAt: number;
}

export interface LocalAIConversation {
  id?: number;
  title: string;
  persona: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    tokens?: number;
  }>;
  createdAt: number;
  updatedAt: number;
}

export interface LocalLearningItem {
  id?: number;
  title: string;
  category: string;
  url?: string;
  summary: string;
  keyTakeaways: string[];
  isCompleted: boolean;
  savedAt: number;
}

export interface LocalCall {
  id?: number;
  contactId: number;
  contactName: string;
  contactEmail: string;
  contactAvatarColor?: string;
  contactAvatarUrl?: string;
  type: 'audio' | 'video';
  direction: 'incoming' | 'outgoing' | 'missed';
  status: 'completed' | 'missed' | 'declined' | 'busy' | 'cancelled';
  duration: number; // in seconds
  timestamp: number;
}

export interface LocalSetting {
  key: string;
  value: any;
}

class ApnaDatabase extends Dexie {
  identityKeys!: Table<LocalIdentityKey, string>;
  contacts!: Table<LocalContact, number>;
  messages!: Table<LocalMessage, number>;
  calls!: Table<LocalCall, number>;
  vaultItems!: Table<LocalVaultItem, number>;
  tasks!: Table<LocalTask, number>;
  habits!: Table<LocalHabit, number>;
  notes!: Table<LocalNote, number>;
  aiConversations!: Table<LocalAIConversation, number>;
  learningItems!: Table<LocalLearningItem, number>;
  settings!: Table<LocalSetting, string>;

  constructor() {
    super('ApnaPrivacyEcosystem');
    this.version(1).stores({
      identityKeys: 'id, email',
      contacts: 'id, email, fingerprint',
      messages: '++id, serverMessageId, conversationId, senderId, timestamp, status',
      vaultItems: '++id, name, type, folder, isFavorite, isDeleted, createdAt',
      tasks: '++id, status, priority, dueDate, createdAt',
      habits: '++id, title, streak',
      notes: '++id, title, isPinned, updatedAt',
      aiConversations: '++id, persona, updatedAt',
      learningItems: '++id, category, isCompleted, savedAt',
      settings: 'key'
    });

    this.version(2).stores({
      calls: '++id, contactId, type, direction, status, timestamp'
    });
  }
}

export const db = new ApnaDatabase();

// Request persistent storage so browser does not purge without user notice
if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().then((persistent) => {
    if (persistent) {
      console.log('[APNA] Persistent IndexedDB storage granted.');
    } else {
      console.warn('[APNA] Storage persistence not guaranteed by browser. Encrypted backups recommended.');
    }
  });
}
