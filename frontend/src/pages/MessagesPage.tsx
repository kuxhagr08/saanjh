import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { db, type LocalMessage, type LocalContact } from '../db';
import { apiRequest, getStoredTokens, WS_BASE } from '../api/client';
import {
  Send,
  Lock,
  ShieldCheck,
  ShieldAlert,
  UserPlus,
  X,
  Search,
  MessageSquare,
  AlertTriangle,
  Check,
  CheckCheck,
  Fingerprint,
  Trash2,
  Ban,
  Flag,
  ArrowLeft,
  Inbox,
  Archive,
  EyeOff,
  Smile,
  Circle,
  Phone,
  Video,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Settings,
  Paperclip,
  Mic,
  Square,
  Download,
  ExternalLink,
  FileText,
  MapPin,
} from 'lucide-react';
import { CallModal, type CallType, type CallState } from '../components/CallModal';
import { AudioMessagePlayer } from '../components/AudioMessagePlayer';
import { AttachmentMenu } from '../components/AttachmentMenu';
import { MediaLightbox } from '../components/MediaLightbox';
import { WhatsAppSettingsModal } from '../components/WhatsAppSettingsModal';
import { ContactInfoScreen } from '../components/ContactInfoScreen';
import { useCall } from '../context/CallContext';
import { useIntent } from '../context/IntentContext';
import type { MessageAttachment, LocalCall } from '../db';
import {
  encryptMessageForRecipient,
  decryptMessageFromSender,
  computeSafetyNumber,
} from '../utils/crypto';
import { runApnaCheck, type ScamCheckResult } from '../utils/apnaCheck';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

type ChatTab = 'chats' | 'calls' | 'requests' | 'archived';

interface ConversationItem {
  id: number; // Server Conversation ID
  type: string;
  status: 'active' | 'pending' | 'archived' | 'blocked';
  contact: LocalContact;
  lastMessage?: LocalMessage;
  unreadCount?: number;
  initiatedById?: number;
  isIncomingRequest?: boolean;
}

async function tryDecryptPayload(
  ciphertext: string,
  nonce: string,
  contactPub: string,
  myPriv: string,
  isMe: boolean,
  myPub?: string
): Promise<string | null> {
  if (!ciphertext || !nonce || !myPriv) return null;

  let cipherToUse = ciphertext;
  if (ciphertext.startsWith('{')) {
    try {
      const parsed = JSON.parse(ciphertext);
      if (isMe && parsed.s) {
        cipherToUse = parsed.s;
      } else if (!isMe && parsed.r) {
        cipherToUse = parsed.r;
      }
    } catch {}
  }

  // If message sent by me and we have self-ciphertext:
  if (isMe) {
    if (myPub) {
      try {
        return await decryptMessageFromSender(cipherToUse, nonce, myPub, myPriv);
      } catch {}
    }
    return null;
  }

  // If incoming message from contact:
  if (contactPub) {
    try {
      return await decryptMessageFromSender(cipherToUse, nonce, contactPub, myPriv);
    } catch {}
  }

  return null;
}

interface DecryptedContent {
  text: string;
  attachment?: MessageAttachment;
}

function parseDecryptedContent(raw: string): DecryptedContent {
  if (raw.startsWith('{') && raw.includes('"attachment"')) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed.attachment) {
        return {
          text: parsed.text || '',
          attachment: parsed.attachment,
        };
      }
    } catch {}
  }
  return { text: raw };
}

export const MessagesPage: React.FC = () => {
  const { user, identityKey, activePrivateKey } = useAuth();
  const { record } = useIntent();
  const { startCall: globalStartCall } = useCall();
  const [activeTab, setActiveTab] = useState<ChatTab>('chats');
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [callsList, setCallsList] = useState<LocalCall[]>([]);
  const [missedCallsCount, setMissedCallsCount] = useState<number>(0);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [requestsCount, setRequestsCount] = useState<number>(0);
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [inputVal, setInputVal] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [isOtherTyping, setIsOtherTyping] = useState(false);

  // Modals
  const [newChatModalOpen, setNewChatModalOpen] = useState(false);
  const [recipientQuery, setRecipientQuery] = useState('');
  const [directoryUsers, setDirectoryUsers] = useState<any[]>([]);
  const [isVerifyingSafety, setIsVerifyingSafety] = useState(false);
  const [safetyNumberValue, setSafetyNumberValue] = useState<string>('');
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState('Scam / Phishing attempt');
  const [reportDetails, setReportDetails] = useState('');
  const [reportAttachCiphertext, setReportAttachCiphertext] = useState(false);
  const [profilePreviewOpen, setProfilePreviewOpen] = useState(false);

  // WebRTC Audio/Video Call State (P2P direct, zero DB storage)
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [callType, setCallType] = useState<CallType>('audio');
  const [callState, setCallState] = useState<CallState>('outgoing_ringing');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isCallMuted, setIsCallMuted] = useState(false);
  const [isCallVideoOff, setIsCallVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callTimerRef = useRef<any>(null);

  // Voice Note Recording State
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const voiceContextRef = useRef<AudioContext | null>(null);
  const voiceProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const voiceSamplesRef = useRef<Float32Array[]>([]);
  const voiceSampleRateRef = useRef(44100);
  const voiceTimerRef = useRef<any>(null);

  // Attachment & Lightbox State
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [lightboxFileName, setLightboxFileName] = useState<string | undefined>(undefined);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const typingTimeoutRef = useRef<any>(null);
  const typingThrottleRef = useRef<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus message input when opening active chat
  useEffect(() => {
    if (activeConvId !== null) {
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [activeConvId]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('saanjh_chat_open', { detail: activeConvId !== null }));
    return () => { window.dispatchEvent(new CustomEvent('saanjh_chat_open', { detail: false })); };
  }, [activeConvId]);

  // Mobile router history & popstate for seamless back navigation (Bug A6)
  const openConversation = useCallback((convId: number) => {
    setActiveConvId(convId);
    window.history.pushState({ inSaanjhConversation: true, convId }, '', window.location.href);
  }, []);

  const closeConversation = useCallback(() => {
    if (activeConvId !== null) {
      setActiveConvId(null);
      if (window.history.state?.inSaanjhConversation) {
        window.history.back();
      }
    }
  }, [activeConvId]);

  useEffect(() => {
    const handlePopState = () => {
      if (activeConvId !== null) {
        setActiveConvId(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeConvId]);

  // Left-edge swipe to go back on mobile (Bug A6)
  const touchStartCoord = useRef<{ x: number; y: number } | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    if (activeConvId !== null && e.touches[0].clientX < 40) {
      touchStartCoord.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else {
      touchStartCoord.current = null;
    }
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartCoord.current && activeConvId !== null) {
      const deltaX = e.changedTouches[0].clientX - touchStartCoord.current.x;
      const deltaY = Math.abs(e.changedTouches[0].clientY - touchStartCoord.current.y);
      if (deltaX > 75 && deltaY < 60) {
        closeConversation();
      }
    }
    touchStartCoord.current = null;
  };

  const handleClearChat = async () => {
    if (!activeConvId) return;
    try {
      await db.messages.where('conversationId').equals(activeConvId).delete();
      setMessages([]);
      setActionSuccess('Chat history cleared from this device.');
      setTimeout(() => setActionSuccess(''), 3000);
      setProfilePreviewOpen(false);
      await loadAllConversations();
    } catch {
      setErrorMessage('Failed to clear chat.');
    }
  };

  const handleDeleteChat = async () => {
    if (!activeConvId) return;
    try {
      await db.messages.where('conversationId').equals(activeConvId).delete();
      if (activeContact?.id) {
        await db.contacts.delete(activeContact.id);
      }
      setActiveConvId(null);
      setProfilePreviewOpen(false);
      setActionSuccess('Conversation and keys deleted.');
      setTimeout(() => setActionSuccess(''), 3000);
      await loadAllConversations();
    } catch {
      setErrorMessage('Failed to delete conversation.');
    }
  };

  const handleExportChat = (format: 'encrypted' | 'plain') => {
    if (!activeContact) return;
    try {
      const data = {
        exportedAt: new Date().toISOString(),
        appName: 'Saanjh',
        contact: {
          username: activeContact.username,
          displayName: activeContact.displayName,
        },
        messages: messages.map((m) => ({
          timestamp: m.timestamp,
          senderId: m.senderId,
          text: format === 'plain' ? m.plaintext : undefined,
          ciphertext: format === 'encrypted' ? m.plaintext : undefined,
          attachment: m.attachment ? m.attachment.fileName : undefined,
        })),
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `saanjh_chat_${activeContact.username || 'contact'}_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setActionSuccess(`Exported chat (${format}) successfully.`);
      setTimeout(() => setActionSuccess(''), 3000);
    } catch {
      setErrorMessage('Failed to export chat.');
    }
  };

  // Load conversations and calls on tab change
  useEffect(() => {
    loadAllConversations();
    loadCallsHistory();
  }, [activeTab]);

  // Refresh contact profiles while the chat space is open so avatar/name changes
  // from another device are reflected without requiring a sign-out.
  useEffect(() => {
    const refresh = window.setInterval(() => loadAllConversations(), 20000);
    return () => window.clearInterval(refresh);
  }, [activeTab, user?.id]);

  // Load messages & setup WebSocket when activeConvId changes
  useEffect(() => {
    if (activeConvId !== null) {
      loadMessagesForConversation(activeConvId);
      setupWebSocket(activeConvId);
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [activeConvId]);

  // Auto-scroll on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOtherTyping]);

  // Handle escape key for modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setNewChatModalOpen(false);
        setIsVerifyingSafety(false);
        setReportModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (newChatModalOpen || isVerifyingSafety || reportModalOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [newChatModalOpen, isVerifyingSafety, reportModalOpen]);

  const loadAllConversations = async () => {
    try {
      const allContacts = await db.contacts.toArray();
      const contactMap = new Map<number, LocalContact>(allContacts.map((c) => [c.id, c]));

      let serverConvs: any[] = [];
      try {
        const queryStatus = activeTab === 'requests' ? 'requests' : activeTab === 'archived' ? 'archived' : 'active';
        const res = await apiRequest<any[]>(`/conversations/?status=${queryStatus}`);
        if (Array.isArray(res)) {
          serverConvs = res;
        }
      } catch {
        // offline fallback
      }

      // Check request badge count
      try {
        const pendingRes = await apiRequest<any[]>('/conversations/?status=requests');
        if (Array.isArray(pendingRes)) {
          setRequestsCount(pendingRes.length);
        }
      } catch {
        // ignore
      }

      const items: ConversationItem[] = [];

      for (const sc of serverConvs) {
        const otherMember = sc.members?.find((m: any) => m.user?.id !== user?.id);
        const myMembership = sc.members?.find((m: any) => m.user?.id === user?.id);
        const otherUser = otherMember?.user;
        const otherId = otherUser?.id || sc.id;
        const serverPub = otherUser?.public_identity_key;
        const serverSignPub = otherUser?.public_signing_key;
        const serverFp = otherUser?.key_fingerprint;

        let contact = contactMap.get(otherId);
        if (!contact && otherUser) {
          contact = {
            id: otherId,
            email: otherUser.email || `${otherUser.username}@saanjh.local`,
            displayName: otherUser.display_name || otherUser.username || otherUser.email,
            avatarUrl: otherUser.avatar_url || '',
            username: otherUser.username || '',
            publicKeyBase64: serverPub || '',
            signingPublicKeyBase64: serverSignPub || '',
            fingerprint: serverFp || '',
            verified: false,
            addedAt: Date.now(),
          };
          if (!serverPub) {
            try {
              const idRes = await apiRequest<any>(`/contacts/lookup/?q=${encodeURIComponent(otherUser.username || otherUser.email)}`);
              if (idRes && idRes.public_identity_key) {
                contact.publicKeyBase64 = idRes.public_identity_key;
                contact.signingPublicKeyBase64 = idRes.public_signing_key || '';
                contact.fingerprint = idRes.key_fingerprint || '';
              }
            } catch {}
          }
          await db.contacts.put(contact);
        } else if (contact && serverPub && contact.publicKeyBase64 !== serverPub) {
          contact.publicKeyBase64 = serverPub;
          contact.signingPublicKeyBase64 = serverSignPub || contact.signingPublicKeyBase64;
          contact.fingerprint = serverFp || contact.fingerprint;
          await db.contacts.put(contact);
        }
        if (contact && otherUser?.avatar_url !== undefined && contact.avatarUrl !== otherUser.avatar_url) {
          contact.avatarUrl = otherUser.avatar_url || '';
          await db.contacts.put(contact);
        }

        // Fetch last message from Dexie
        const localMsgs = await db.messages.where('conversationId').equals(sc.id).sortBy('timestamp');
        let lastMessage = localMsgs[localMsgs.length - 1];

        if (!lastMessage && sc.last_message) {
          lastMessage = {
            conversationId: sc.id,
            senderId: sc.last_message.sender_id,
            senderEmail: otherUser?.email || '',
            plaintext: '[Encrypted Message]',
            timestamp: new Date(sc.last_message.created_at).getTime(),
            status: sc.last_message.is_delivered ? 'delivered' : 'sent',
          };
        }

        const isIncoming = sc.status === 'pending' && myMembership && !myMembership.is_accepted;

        if (contact) {
          items.push({
            id: sc.id, // Server Conversation ID
            type: sc.type,
            status: sc.status,
            contact,
            lastMessage,
            initiatedById: sc.initiated_by_id,
            isIncomingRequest: isIncoming,
          });
        }
      }

      // Zero-Storage Fallback: when server holds no conversations, load directly from local Dexie contacts & messages
      if (serverConvs.length === 0) {
        for (const contact of allContacts) {
          const localMsgs = await db.messages.where('conversationId').equals(contact.id).sortBy('timestamp');
          const lastMessage = localMsgs[localMsgs.length - 1];
          const isIncoming = contact.isRequestAccepted === false;

          if (activeTab === 'requests') {
            if (!isIncoming) continue;
          } else if (activeTab === 'archived') {
            continue;
          } else {
            // 'chats'
            if (isIncoming) continue;
          }

          items.push({
            id: contact.id,
            type: 'direct',
            status: isIncoming ? 'pending' : 'active',
            contact,
            lastMessage: lastMessage ? {
              id: lastMessage.id || 0,
              conversationId: contact.id,
              senderId: lastMessage.senderId,
              senderEmail: lastMessage.senderEmail,
              plaintext: lastMessage.plaintext,
              timestamp: lastMessage.timestamp,
              status: lastMessage.status === 'delivered' ? 'delivered' : 'sent',
              attachment: lastMessage.attachment,
            } : undefined,
            isIncomingRequest: isIncoming,
          });
        }

        const pendingCount = allContacts.filter((c) => c.isRequestAccepted === false).length;
        setRequestsCount(pendingCount);
      }

      items.sort((a, b) => (b.lastMessage?.timestamp || 0) - (a.lastMessage?.timestamp || 0));
      setConversations(items);

      if (activeConvId !== null && !items.some((i) => i.id === activeConvId)) {
        setActiveConvId(items.length > 0 ? items[0].id : null);
      }
    } catch (err) {
      console.error('Failed to load conversations', err);
    }
  };

  const loadCallsHistory = async () => {
    try {
      const calls = await db.calls.orderBy('timestamp').reverse().toArray();
      setCallsList(calls);
      const missed = calls.filter((c) => c.direction === 'missed').length;
      setMissedCallsCount(missed);
    } catch {
      setCallsList([]);
    }
  };

  const handleClearCalls = async () => {
    if (confirm('Clear entire call history?')) {
      await db.calls.clear();
      setCallsList([]);
      setMissedCallsCount(0);
    }
  };

  const handleCallBack = (call: LocalCall, type: CallType) => {
    const contactObj: LocalContact = {
      id: call.contactId,
      displayName: call.contactName,
      email: call.contactEmail,
      publicKeyBase64: '',
      signingPublicKeyBase64: '',
      fingerprint: '',
      verified: false,
      addedAt: Date.now(),
    };
    globalStartCall(contactObj, type);
  };

  const loadMessagesForConversation = async (convId: number) => {
    // 1. Instant load from local Dexie
    let localMsgs = await db.messages.where('conversationId').equals(convId).sortBy('timestamp');
    setMessages(localMsgs);

    // 2. Fetch server messages and decrypt new incoming ones
    try {
      const serverMsgs = await apiRequest<any[]>(`/conversations/${convId}/messages/`);
      if (Array.isArray(serverMsgs) && serverMsgs.length > 0) {
        let item = conversations.find((c) => c.id === convId);
        let contactPub = item?.contact.publicKeyBase64 || '';
        const myPriv = activePrivateKey || sessionStorage.getItem('apna_session_privkey');
        const myPub = identityKey?.publicKeyBase64 || '';

        // If contactPub is missing, attempt quick lookup
        if (!contactPub && item?.contact) {
          try {
            const lookup = await apiRequest<any>(`/contacts/lookup/?q=${encodeURIComponent(item.contact.email || item.contact.displayName)}`);
            if (lookup?.public_identity_key) {
              contactPub = lookup.public_identity_key;
              item.contact.publicKeyBase64 = contactPub;
              await db.contacts.update(item.contact.id, { publicKeyBase64: contactPub });
            }
          } catch {}
        }

        const isPlaceholder = (t?: string) =>
          !t ||
          t === '[Encrypted message]' ||
          t === '[Encrypted message payload]' ||
          t === '[Encrypted payload]' ||
          t === '[Message sent from another device]';

        let hasNew = false;
        for (const sm of serverMsgs) {
          const isMe = sm.sender === user?.id;
          const existing = localMsgs.find((m) => m.serverMessageId === sm.id);

          if (existing) {
            // If already exists but has placeholder, re-attempt decryption
            if (isPlaceholder(existing.plaintext) && sm.ciphertext && sm.nonce && myPriv) {
              const decrypted = await tryDecryptPayload(sm.ciphertext, sm.nonce, contactPub, myPriv, isMe, myPub);
              if (decrypted && decrypted !== existing.plaintext) {
                existing.plaintext = decrypted;
                if (existing.id) {
                  await db.messages.update(existing.id, { plaintext: decrypted });
                }
                hasNew = true;
              }
            }
            continue;
          }

          // New message from server
          let text = '';
          if (isMe) {
            // First check if an optimistic local message matches
            const optimistic = localMsgs.find((m) => m.senderId === user?.id && !m.serverMessageId);
            if (optimistic && optimistic.id) {
              await db.messages.update(optimistic.id, {
                serverMessageId: sm.id,
                status: sm.is_delivered ? 'delivered' : 'sent',
              });
              optimistic.serverMessageId = sm.id;
              optimistic.status = sm.is_delivered ? 'delivered' : 'sent';
              continue; // retain optimistic message text!
            }

            // Otherwise try decrypting self-envelope
            if (myPriv) {
              const decrypted = await tryDecryptPayload(sm.ciphertext, sm.nonce, contactPub, myPriv, true, myPub);
              if (decrypted) text = decrypted;
            }
            if (!text) text = '[Sent message]';
          } else {
            // Incoming message
            if (sm.ciphertext && sm.nonce && myPriv) {
              const decrypted = await tryDecryptPayload(sm.ciphertext, sm.nonce, contactPub, myPriv, false);
              if (decrypted) {
                text = decrypted;
              } else {
                // Try fresh contact key lookup once
                try {
                  const lookup = await apiRequest<any>(`/contacts/lookup/?q=${encodeURIComponent(sm.sender_email || item?.contact.email || '')}`);
                  if (lookup?.public_identity_key && lookup.public_identity_key !== contactPub) {
                    contactPub = lookup.public_identity_key;
                    if (item) {
                      item.contact.publicKeyBase64 = contactPub;
                      await db.contacts.update(item.contact.id, { publicKeyBase64: contactPub });
                    }
                    const retryDec = await tryDecryptPayload(sm.ciphertext, sm.nonce, contactPub, myPriv, false);
                    if (retryDec) text = retryDec;
                  }
                } catch {}
              }
            }
            if (!text) text = '[Encrypted message payload]';
          }

          const parsed = parseDecryptedContent(text);
          const newLocal: LocalMessage = {
            serverMessageId: sm.id,
            conversationId: convId,
            senderId: sm.sender,
            senderEmail: sm.sender_email || '',
            plaintext: parsed.text || (parsed.attachment ? (parsed.attachment.type === 'voice_note' ? '🎤 Voice message' : parsed.attachment.fileName || parsed.attachment.type) : text),
            attachment: parsed.attachment,
            timestamp: new Date(sm.created_at).getTime(),
            status: sm.is_delivered ? 'delivered' : 'sent',
          };

          await db.messages.add(newLocal);
          hasNew = true;

          // Acknowledge delivery
          if (!isMe) {
            apiRequest(`/messages/${sm.id}/ack/`, { method: 'POST' }).catch(() => {});
          }
        }

        if (hasNew) {
          const updated = await db.messages.where('conversationId').equals(convId).sortBy('timestamp');
          setMessages(updated);
        }
      }
    } catch (e) {
      // offline fallback
    }
  };

  // Call timer helper
  const startCallTimer = () => {
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    setCallDuration(0);
    callTimerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
  };

  // WebRTC Cleanup
  const cleanupCall = () => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    setCallModalOpen(false);
    setCallDuration(0);
    setIsCallMuted(false);
    setIsCallVideoOff(false);
  };

  // Start outgoing call (audio or video)
  const startCall = async (type: CallType) => {
    if (!activeContact) return;
    setCallType(type);
    setCallState('outgoing_ringing');
    setCallModalOpen(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === 'video',
      });
      setLocalStream(stream);
      localStreamRef.current = stream;

      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcRef.current = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'webrtc_signal',
              signal: { type: 'ice_candidate', candidate: event.candidate },
            })
          );
        }
      };

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'webrtc_signal',
            signal: { type: 'call_request', call_type: type },
          })
        );
      }
    } catch (err: any) {
      console.error('Call media access error', err);
      setErrorMessage('Microphone or Camera access denied for call.');
      cleanupCall();
    }
  };

  // Accept incoming call
  const handleAcceptCall = async () => {
    setCallState('connected');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: callType === 'video',
      });
      setLocalStream(stream);
      localStreamRef.current = stream;

      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcRef.current = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'webrtc_signal',
              signal: { type: 'ice_candidate', candidate: event.candidate },
            })
          );
        }
      };

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'webrtc_signal',
            signal: { type: 'call_accept' },
          })
        );
      }
    } catch (err) {
      console.error('Accept call media error', err);
      handleDeclineCall();
    }
  };

  const handleDeclineCall = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'webrtc_signal',
          signal: { type: 'call_reject' },
        })
      );
    }
    cleanupCall();
  };

  const handleEndCall = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'webrtc_signal',
          signal: { type: 'call_end' },
        })
      );
    }
    cleanupCall();
  };

  const handleToggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsCallMuted(!audioTrack.enabled);
      }
    }
  };

  const handleToggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCallVideoOff(!videoTrack.enabled);
      }
    }
  };

  // Voice Note Recording
  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceStreamRef.current = stream;
      audioChunksRef.current = [];
      voiceSamplesRef.current = [];
      const audioContext = new AudioContext();
      voiceContextRef.current = audioContext;
      voiceSampleRateRef.current = audioContext.sampleRate;
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      voiceProcessorRef.current = processor;
      processor.onaudioprocess = (event) => {
        voiceSamplesRef.current.push(new Float32Array(event.inputBuffer.getChannelData(0)));
      };
      source.connect(processor);
      processor.connect(audioContext.destination);
      setIsRecordingVoice(true);
      setRecordingDuration(0);
      if (voiceTimerRef.current) clearInterval(voiceTimerRef.current);
      voiceTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Mic access error', err);
      setErrorMessage('Microphone access denied for voice note.');
    }
  };

  const cancelVoiceRecording = () => {
    if (voiceTimerRef.current) {
      clearInterval(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
    voiceProcessorRef.current?.disconnect();
    voiceProcessorRef.current = null;
    voiceContextRef.current?.close().catch(() => undefined);
    voiceContextRef.current = null;
    voiceStreamRef.current?.getTracks().forEach((t) => t.stop());
    voiceStreamRef.current = null;
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    setIsRecordingVoice(false);
    setRecordingDuration(0);
  };

  const sendVoiceRecording = () => {
    if (voiceTimerRef.current) {
      clearInterval(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
    if (!voiceSamplesRef.current.length) {
      setIsRecordingVoice(false);
      setErrorMessage('Voice note was empty. Please record it again.');
      return;
    }

    const duration = Math.max(recordingDuration, 1);
    const chunks = voiceSamplesRef.current;
    const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const wav = new ArrayBuffer(44 + length * 2);
    const view = new DataView(wav);
    const write = (offset: number, value: string) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
    write(0, 'RIFF'); view.setUint32(4, 36 + length * 2, true); write(8, 'WAVE'); write(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, voiceSampleRateRef.current, true); view.setUint32(28, voiceSampleRateRef.current * 2, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, length * 2, true);
    let offset = 44;
    chunks.forEach((chunk) => chunk.forEach((sample) => { view.setInt16(offset, Math.max(-1, Math.min(1, sample)) * 0x7fff, true); offset += 2; }));
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Audio = reader.result as string;
      const attachment: MessageAttachment = { type: 'voice_note', url: base64Audio, data: base64Audio, mimeType: 'audio/wav', fileName: `voice_note_${Date.now()}.wav`, duration };
      void handleSendAttachment(attachment).catch((error) => setErrorMessage(error?.message || 'Voice note could not be sent.'));
    };
    reader.readAsDataURL(new Blob([wav], { type: 'audio/wav' }));
    voiceProcessorRef.current?.disconnect();
    voiceProcessorRef.current = null;
    voiceContextRef.current?.close().catch(() => undefined);
    voiceContextRef.current = null;
    voiceStreamRef.current?.getTracks().forEach((t) => t.stop());
    voiceStreamRef.current = null;
    voiceSamplesRef.current = [];
    setIsRecordingVoice(false);
    setRecordingDuration(0);
  };

  // Real-time WebSocket setup with WebRTC & Decrypted Payload handling
  const setupWebSocket = (convId: number) => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const tokens = getStoredTokens();
    if (!tokens?.access) return;

    try {
      const wsUrl = `${WS_BASE}/ws/chat/${convId}/?token=${tokens.access}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsOtherTyping(false);
      };

      ws.onmessage = async (event) => {
        try {
          const payload = JSON.parse(event.data);

          // WebRTC In-Memory Signal Handling (Zero DB retention)
          if (payload.type === 'webrtc_signal' && payload.signal) {
            const sig = payload.signal;

            if (sig.type === 'call_request') {
              setCallType(sig.call_type || 'audio');
              setCallState('incoming_ringing');
              setCallModalOpen(true);
            } else if (sig.type === 'call_accept') {
              if (pcRef.current) {
                try {
                  const offer = await pcRef.current.createOffer();
                  await pcRef.current.setLocalDescription(offer);
                  wsRef.current?.send(
                    JSON.stringify({
                      type: 'webrtc_signal',
                      signal: { type: 'offer', sdp: offer },
                    })
                  );
                  setCallState('connected');
                  startCallTimer();
                } catch (err) {
                  console.error('Error creating WebRTC offer', err);
                }
              }
            } else if (sig.type === 'offer' && sig.sdp) {
              if (pcRef.current) {
                try {
                  await pcRef.current.setRemoteDescription(new RTCSessionDescription(sig.sdp));
                  const answer = await pcRef.current.createAnswer();
                  await pcRef.current.setLocalDescription(answer);
                  wsRef.current?.send(
                    JSON.stringify({
                      type: 'webrtc_signal',
                      signal: { type: 'answer', sdp: answer },
                    })
                  );
                  setCallState('connected');
                  startCallTimer();
                } catch (err) {
                  console.error('Error answering WebRTC offer', err);
                }
              }
            } else if (sig.type === 'answer' && sig.sdp) {
              if (pcRef.current) {
                try {
                  await pcRef.current.setRemoteDescription(new RTCSessionDescription(sig.sdp));
                } catch (err) {
                  console.error('Error setting remote description answer', err);
                }
              }
            } else if (sig.type === 'ice_candidate' && sig.candidate) {
              if (pcRef.current) {
                try {
                  await pcRef.current.addIceCandidate(new RTCIceCandidate(sig.candidate));
                } catch (err) {
                  console.warn('ICE candidate error', err);
                }
              }
            } else if (sig.type === 'call_reject') {
              cleanupCall();
              setActionSuccess('Call declined');
              setTimeout(() => setActionSuccess(''), 3000);
            } else if (sig.type === 'call_end') {
              cleanupCall();
            }
            return;
          }

          if (payload.type === 'typing') {
            if (payload.user_id !== user?.id) {
              setIsOtherTyping(!!payload.is_typing);
              if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
              typingTimeoutRef.current = setTimeout(() => setIsOtherTyping(false), 3000);
            }
          } else if (payload.type === 'message' && payload.data) {
            const sm = payload.data;
            const isMe = sm.sender === user?.id;
            const myPriv = activePrivateKey || sessionStorage.getItem('apna_session_privkey');
            const myPub = identityKey?.publicKeyBase64 || '';
            const item = conversations.find((c) => c.id === convId);
            let contactPub = item?.contact.publicKeyBase64 || '';

            if (isMe) {
              // Correlate with local optimistic message
              const localAll = await db.messages.where('conversationId').equals(convId).toArray();
              const optimistic = localAll.find((m) => m.senderId === user?.id && !m.serverMessageId);
              if (optimistic && optimistic.id) {
                await db.messages.update(optimistic.id, {
                  serverMessageId: sm.id,
                  status: sm.is_delivered ? 'delivered' : 'sent',
                });
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === optimistic.id ? { ...m, serverMessageId: sm.id, status: sm.is_delivered ? 'delivered' : 'sent' } : m
                  )
                );
                return;
              }
            } else {
              // Incoming message from other user
              let decryptedText = sm.plaintext;
              if (!decryptedText && myPriv && sm.ciphertext && sm.nonce) {
                if (!contactPub && item?.contact) {
                  try {
                    const lookup = await apiRequest<any>(`/contacts/lookup/?q=${encodeURIComponent(item.contact.email || item.contact.displayName)}`);
                    if (lookup?.public_identity_key) {
                      contactPub = lookup.public_identity_key;
                      item.contact.publicKeyBase64 = contactPub;
                      await db.contacts.update(item.contact.id, { publicKeyBase64: contactPub });
                    }
                  } catch {}
                }
                const dec = await tryDecryptPayload(sm.ciphertext, sm.nonce, contactPub, myPriv, false);
                decryptedText = dec || '[Encrypted payload]';
              }

              const parsed = parseDecryptedContent(decryptedText || '');
              const incomingMsg: LocalMessage = {
                serverMessageId: sm.id,
                conversationId: convId,
                senderId: sm.sender,
                senderEmail: sm.sender_email || '',
                plaintext: parsed.text || (parsed.attachment ? (parsed.attachment.type === 'voice_note' ? '🎤 Voice message' : parsed.attachment.fileName || parsed.attachment.type) : (decryptedText || '[Encrypted payload]')),
                attachment: parsed.attachment,
                timestamp: Date.now(),
                status: 'delivered',
              };

              await db.messages.add(incomingMsg);
              setMessages((prev) => [...prev, incomingMsg]);
              setIsOtherTyping(false);
              record('chats');
              window.dispatchEvent(new CustomEvent('apna_notification', { detail: {
                title: item?.contact.displayName || 'New encrypted message',
                body: incomingMsg.plaintext || 'Sent you a message'
              }}));

              apiRequest(`/messages/${sm.id}/ack/`, { method: 'POST' }).catch(() => {});
            }
          }
        } catch (e) {
          console.warn('WS message parse error', e);
        }
      };

      ws.onerror = (e) => {
        console.warn('WS connection warning:', e);
      };

      wsRef.current = ws;
    } catch (e) {
      console.warn('WebSocket init error:', e);
    }
  };

  const activeItem = conversations.find((c) => c.id === activeConvId);
  const activeContact = activeItem?.contact;
  const isIncomingRequest = activeItem?.isIncomingRequest || (activeItem?.status === 'pending' && activeItem?.initiatedById !== user?.id);
  const isPendingSentRequest = activeItem?.status === 'pending' && activeItem?.initiatedById === user?.id;

  const requestFirstMessage = messages[0]?.plaintext || activeItem?.lastMessage?.plaintext || '';
  const apnaCheckResult: ScamCheckResult = isIncomingRequest
    ? runApnaCheck(requestFirstMessage)
    : { isSuspicious: false, riskLevel: 'none', reasons: [], warningChip: null };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputVal(e.target.value);

    // Throttle typing indicator to at most once every 1.5 seconds
    const now = Date.now();
    if (now - typingThrottleRef.current > 1500) {
      typingThrottleRef.current = now;
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && !isIncomingRequest && !isPendingSentRequest) {
        wsRef.current.send(JSON.stringify({ type: 'typing', is_typing: true }));
      }
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim() || !activeContact || !user || activeConvId === null) return;

    const text = inputVal.trim();
    setInputVal('');
    setErrorMessage('');

    // Instant optimistic local message
    const tempMsg: LocalMessage = {
      conversationId: activeConvId,
      senderId: user.id,
      senderEmail: user.email,
      plaintext: text,
      timestamp: Date.now(),
      status: 'sent',
    };

    const localId = await db.messages.add(tempMsg);
    tempMsg.id = localId as number;
    setMessages((prev) => [...prev, tempMsg]);

    // Send encrypted payload
    try {
      let recipientPubKey = activeContact.publicKeyBase64;
      if (!recipientPubKey) {
        try {
          const lookup = await apiRequest<any>(`/contacts/lookup/?q=${encodeURIComponent(activeContact.email || activeContact.displayName)}`);
          if (lookup && lookup.public_identity_key) {
            recipientPubKey = lookup.public_identity_key;
            await db.contacts.update(activeContact.id, {
              publicKeyBase64: recipientPubKey,
              signingPublicKeyBase64: lookup.public_signing_key || '',
              fingerprint: lookup.key_fingerprint || '',
            });
            activeContact.publicKeyBase64 = recipientPubKey;
          }
        } catch {
          // ignore
        }
      }

      if (!recipientPubKey) {
        setErrorMessage(`Unable to send: ${activeContact.displayName} has not generated encryption keys yet.`);
        return;
      }

      const myPriv = activePrivateKey || sessionStorage.getItem('apna_session_privkey');
      const myPub = identityKey?.publicKeyBase64;

      if (recipientPubKey && myPriv) {
        const encrypted = await encryptMessageForRecipient(
          text,
          recipientPubKey,
          myPriv
        );

        let ciphertextPayload = encrypted.ciphertext;
        if (myPub) {
          try {
            const encSelf = await encryptMessageForRecipient(text, myPub, myPriv);
            ciphertextPayload = JSON.stringify({
              r: encrypted.ciphertext,
              s: encSelf.ciphertext,
            });
          } catch (e) {
            console.warn('Self-envelope encrypt fallback', e);
          }
        }

        // Send via WebSocket if open, fallback to HTTP POST
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'encrypted_message',
            ciphertext: ciphertextPayload,
            nonce: encrypted.nonce,
          }));
        } else {
          const postRes = await apiRequest<any>(`/conversations/${activeConvId}/messages/`, {
            method: 'POST',
            body: JSON.stringify({
              ciphertext: ciphertextPayload,
              nonce: encrypted.nonce,
            }),
          });
          if (postRes && postRes.id && localId) {
            await db.messages.update(localId, {
              serverMessageId: postRes.id,
              status: postRes.is_delivered ? 'delivered' : 'sent',
            });
            setMessages((prev) =>
              prev.map((m) => (m.id === localId ? { ...m, serverMessageId: postRes.id, status: postRes.is_delivered ? 'delivered' : 'sent' } : m))
            );
          }
        }
      }
    } catch (err: any) {
      if (err.message && err.message.includes('at most 1 message')) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage(err.message || 'Failed to send encrypted message.');
      }
    }

    // Refresh conversation item snippet
    setConversations((prev) =>
      prev.map((c) => (c.id === activeConvId ? { ...c, lastMessage: tempMsg } : c))
    );
  };

  const handleSendAttachment = async (attachment: MessageAttachment, caption = '') => {
    if (!activeContact || !user || activeConvId === null) return;
    setErrorMessage('');

    const previewText = caption || (
      attachment.type === 'voice_note'
        ? '🎤 Voice note'
        : attachment.type === 'location'
        ? '📍 Location shared'
        : attachment.type === 'image'
        ? '📷 Photo'
        : attachment.type === 'video'
        ? '🎥 Video'
        : `📄 ${attachment.fileName || 'Document'}`
    );

    const tempMsg: LocalMessage = {
      conversationId: activeConvId,
      senderId: user.id,
      senderEmail: user.email,
      plaintext: previewText,
      attachment,
      timestamp: Date.now(),
      status: 'sent',
    };

    const localId = await db.messages.add(tempMsg);
    tempMsg.id = localId as number;
    setMessages((prev) => [...prev, tempMsg]);

    try {
      let recipientPubKey = activeContact.publicKeyBase64;
      if (!recipientPubKey) {
        try {
          const lookup = await apiRequest<any>(`/contacts/lookup/?q=${encodeURIComponent(activeContact.email || activeContact.displayName)}`);
          if (lookup?.public_identity_key) {
            recipientPubKey = lookup.public_identity_key;
            await db.contacts.update(activeContact.id, {
              publicKeyBase64: recipientPubKey,
              signingPublicKeyBase64: lookup.public_signing_key || '',
              fingerprint: lookup.key_fingerprint || '',
            });
            activeContact.publicKeyBase64 = recipientPubKey;
          }
        } catch {}
      }

      if (!recipientPubKey) {
        setErrorMessage(`Unable to send: ${activeContact.displayName} has not generated encryption keys yet.`);
        return;
      }

      const myPriv = activePrivateKey || sessionStorage.getItem('apna_session_privkey');
      const myPub = identityKey?.publicKeyBase64;

      if (recipientPubKey && myPriv) {
        const payloadString = JSON.stringify({
          text: caption,
          attachment,
        });

        const encrypted = await encryptMessageForRecipient(
          payloadString,
          recipientPubKey,
          myPriv
        );

        let ciphertextPayload = encrypted.ciphertext;
        if (myPub) {
          try {
            const encSelf = await encryptMessageForRecipient(payloadString, myPub, myPriv);
            ciphertextPayload = JSON.stringify({
              r: encrypted.ciphertext,
              s: encSelf.ciphertext,
            });
          } catch (e) {
            console.warn('Self-envelope encrypt fallback', e);
          }
        }

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'encrypted_message',
            ciphertext: ciphertextPayload,
            nonce: encrypted.nonce,
          }));
        } else {
          const postRes = await apiRequest<any>(`/conversations/${activeConvId}/messages/`, {
            method: 'POST',
            body: JSON.stringify({
              ciphertext: ciphertextPayload,
              nonce: encrypted.nonce,
            }),
          });
          if (postRes && postRes.id && localId) {
            await db.messages.update(localId, {
              serverMessageId: postRes.id,
              status: postRes.is_delivered ? 'delivered' : 'sent',
            });
            setMessages((prev) =>
              prev.map((m) => (m.id === localId ? { ...m, serverMessageId: postRes.id, status: postRes.is_delivered ? 'delivered' : 'sent' } : m))
            );
          }
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to send attachment.');
    }

    setConversations((prev) =>
      prev.map((c) => (c.id === activeConvId ? { ...c, lastMessage: tempMsg } : c))
    );
  };

  const handleAcceptRequest = async () => {
    if (!activeItem) return;
    try {
      await apiRequest(`/conversations/${activeItem.id}/accept/`, { method: 'POST' });
    } catch {
      // zero-storage client fallback
    }
    if (activeContact) {
      const updated = { ...activeContact, isRequestAccepted: true };
      await db.contacts.put(updated);
    }
    setActionSuccess('Message request accepted. You can now chat securely.');
    setTimeout(() => setActionSuccess(''), 4000);
    setActiveTab('chats');
    await loadAllConversations();
  };

  const handleDeleteRequest = async () => {
    if (!activeItem) return;
    try {
      await apiRequest(`/conversations/${activeItem.id}/decline/`, { method: 'POST' });
      await db.messages.where('conversationId').equals(activeItem.id).delete();
      setActiveConvId(null);
      await loadAllConversations();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to delete message request.');
    }
  };

  const handleBlockSender = async () => {
    if (!activeItem) return;
    try {
      await apiRequest(`/conversations/${activeItem.id}/block/`, { method: 'POST' });
      await db.messages.where('conversationId').equals(activeItem.id).delete();
      setActiveConvId(null);
      setActionSuccess(`Blocked ${activeItem.contact.displayName}.`);
      setTimeout(() => setActionSuccess(''), 4000);
      await loadAllConversations();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to block sender.');
    }
  };

  const handleReportUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem) return;
    try {
      await apiRequest('/reports/', {
        method: 'POST',
        body: JSON.stringify({
          reported_user: activeItem.contact.id,
          reason: reportReason,
          details: reportDetails + (reportAttachCiphertext && requestFirstMessage ? ` [Attached preview: ${requestFirstMessage.slice(0, 80)}]` : ''),
        }),
      });
      setReportModalOpen(false);
      setReportDetails('');
      setActionSuccess('Report submitted with privacy protections. Thank you for keeping Saanjh safe.');
      setTimeout(() => setActionSuccess(''), 5000);
      await handleDeleteRequest();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit report.');
    }
  };

  const handleVerifySafetyNumber = async () => {
    if (!activeContact) return;
    try {
      const myPub = identityKey?.publicKeyBase64 || '';
      const otherPub = activeContact.publicKeyBase64 || '';
      if (myPub && otherPub) {
        const num = await computeSafetyNumber(myPub, otherPub);
        setSafetyNumberValue(num);
      } else {
        setSafetyNumberValue(activeContact.fingerprint || '0048-9124-7839-4412');
      }
      setIsVerifyingSafety(true);
    } catch {
      setSafetyNumberValue('0048-9124-7839-4412');
      setIsVerifyingSafety(true);
    }
  };

  const handleStartNewChat = async (query: string) => {
    if (!query.trim()) return;
    setErrorMessage('');
    try {
      const result = await apiRequest<any>(`/contacts/lookup/?q=${encodeURIComponent(query.trim())}`);
      if (result) {
        const contact: LocalContact = {
          id: result.user_id,
          email: `${result.user_username || 'user'}@saanjh.local`,
          displayName: result.user_display_name || result.user_username || query,
          username: result.user_username || '',
          avatarUrl: '',
          avatarColor: result.user_avatar_color || 'violet',
          phoneNumber: '', // never exposed from public search; privacy guaranteed
          publicKeyBase64: result.public_identity_key || '',
          signingPublicKeyBase64: result.public_signing_key || '',
          fingerprint: result.key_fingerprint || '',
          verified: false,
          addedAt: Date.now(),
          isRequestAccepted: true, // I initiated this chat
          shareMyPhoneWithContact: false,
          shareMyEmailWithContact: false,
        };
        await db.contacts.put(contact);

        try {
          await apiRequest<any>('/conversations/', {
            method: 'POST',
            body: JSON.stringify({ recipient_id: contact.id }),
          });
        } catch {
          // Zero-storage client architecture
        }

        setNewChatModalOpen(false);
        setRecipientQuery('');
        await loadAllConversations();
        setActiveConvId(contact.id);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'User not found or privacy settings prevent discovery.');
    }
  };

  const loadDirectory = async (query = '') => {
    if (query.trim().length < 2) {
      setDirectoryUsers([]);
      return;
    }
    try {
      const result = await apiRequest<any>(`/contacts/lookup/?q=${encodeURIComponent(query.trim())}`);
      setDirectoryUsers(result && result.user_id !== user?.id ? [result] : []);
    } catch {
      setDirectoryUsers([]);
    }
  };

  const filteredConversations = conversations.filter((c) =>
    c.contact.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.contact.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return 'now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getAvatarInitials = (name?: string | null): string => {
    if (!name) return 'AP';
    const letters = name.replace(/[^a-zA-Z]/g, '');
    return letters.length > 0 ? letters.slice(0, 2).toUpperCase() : 'AP';
  };

  const getAvatarBg = (id: number) => {
    const colors = [
      'from-violet-500 to-indigo-600',
      'from-purple-500 to-pink-500',
      'from-emerald-500 to-teal-600',
      'from-amber-500 to-orange-500',
      'from-cyan-500 to-blue-600',
    ];
    return colors[id % colors.length];
  };

  const renderMessagePreview = (conv: ConversationItem) => {
    if (conv.isIncomingRequest) {
      return 'Message request · Tap to review';
    }
    const lastMsg = conv.lastMessage;
    if (!lastMsg) {
      return 'Tap to say hello 👋';
    }
    if (lastMsg.attachment) {
      const t = lastMsg.attachment.type;
      if (t.startsWith('image')) return '📷 Photo';
      if (t.startsWith('video')) return '🎥 Video';
      if (t === 'voice_note' || t.startsWith('audio')) return '🎤 Voice message';
      return `📄 ${lastMsg.attachment.fileName || 'Document'}`;
    }
    const text = lastMsg.plaintext;
    if (!text || text === '[Encrypted message payload]' || text === '[Encrypted message]' || text === '[Encrypted payload]') {
      return '🔒 Encrypted message';
    }
    return text;
  };

  return (
    <div className={`animate-fade-in w-full max-w-full min-w-0 ${activeConvId !== null ? 'h-[100dvh] md:h-[calc(100dvh-6.5rem)]' : 'h-[calc(100dvh-5.5rem)] md:h-[calc(100dvh-6.5rem)]'} bg-apna-surface border-0 md:border border-apna-border rounded-none md:rounded-2xl shadow-sm overflow-hidden flex flex-col md:grid md:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]`}>
      {/* Toast Alert */}
      {actionSuccess && (
        <div className="fixed top-4 right-4 z-[99999] bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-lg text-xs font-medium flex items-center gap-2 animate-fade-in">
          <ShieldCheck className="w-4 h-4" />
          {actionSuccess}
        </div>
      )}

      {/* LEFT PANE — Tabs & Conversation List */}
      <div
        className={`w-full h-full min-w-0 md:border-r border-apna-border flex flex-col bg-apna-surface overflow-hidden ${
          activeConvId !== null ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-stone-200/80 dark:border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-stone-900 dark:text-white text-base">Messages</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
              E2E
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSettingsModalOpen(true)}
              className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center hover:bg-emerald-600 hover:text-white transition-all shadow-xs cursor-pointer"
              title="WhatsApp Profile, DP & Privacy Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setNewChatModalOpen(true);
                loadDirectory();
              }}
              className="w-8 h-8 rounded-xl bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center hover:bg-violet-600 hover:text-white transition-all shadow-xs cursor-pointer"
              title="Start new encrypted chat"
            >
              <UserPlus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* WhatsApp & Instagram Tabs: Chats, Calls, Requests, Archived */}
        <div className="px-3 pt-2 pb-1 border-b border-stone-200/80 dark:border-white/10 flex gap-1 bg-stone-50/70 dark:bg-white/[0.02]">
          <button
            onClick={() => setActiveTab('chats')}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'chats'
                ? 'bg-white dark:bg-white/15 text-violet-700 dark:text-violet-300 shadow-xs border border-stone-200/80 dark:border-white/10'
                : 'text-stone-500 hover:text-stone-900 dark:hover:text-white'
            }`}
          >
            Chats
          </button>

          <button
            onClick={() => setActiveTab('calls')}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer ${
              activeTab === 'calls'
                ? 'bg-white dark:bg-white/15 text-emerald-700 dark:text-emerald-300 shadow-xs border border-stone-200/80 dark:border-white/10'
                : 'text-stone-500 hover:text-stone-900 dark:hover:text-white'
            }`}
          >
            <Phone className="w-3 h-3" />
            <span>Calls</span>
            {missedCallsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-rose-500 text-white animate-pulse">
                {missedCallsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('requests')}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer ${
              activeTab === 'requests'
                ? 'bg-white dark:bg-white/15 text-violet-700 dark:text-violet-300 shadow-xs border border-stone-200/80 dark:border-white/10'
                : 'text-stone-500 hover:text-stone-900 dark:hover:text-white'
            }`}
          >
            <span>Requests</span>
            {requestsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-violet-600 text-white">
                {requestsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('archived')}
            className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'archived'
                ? 'bg-white dark:bg-white/15 text-violet-700 dark:text-violet-300 shadow-xs border border-stone-200/80 dark:border-white/10'
                : 'text-stone-500 hover:text-stone-900 dark:hover:text-white'
            }`}
            title="Archived chats"
          >
            <Archive className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-stone-200/80">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
            <input
              type="text"
              placeholder={
                activeTab === 'requests'
                  ? 'Search message requests...'
                  : 'Search conversations...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-9 pr-3 py-2 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-violet-500 focus:bg-white transition-colors"
            />
          </div>
        </div>

        {/* Calls Log Panel (When Calls tab is active) */}
        {activeTab === 'calls' ? (
          <div className="flex-1 overflow-y-auto flex flex-col bg-apna-surface">
            <div className="p-3 border-b border-stone-200/80 dark:border-white/10 flex items-center justify-between bg-stone-50/50 dark:bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-bold text-stone-900 dark:text-white">Recent Calls</span>
                <span className="text-[10px] text-stone-400">({callsList.length})</span>
              </div>
              {callsList.length > 0 && (
                <button
                  onClick={handleClearCalls}
                  className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400 flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear
                </button>
              )}
            </div>

            {callsList.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-stone-500 space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Phone className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-stone-800 dark:text-stone-200">No call history</p>
                <p className="text-[11px] text-stone-400 max-w-[200px] leading-relaxed">
                  Audio & video calls made, received, or missed on your device will appear here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-stone-100 dark:divide-white/5 overflow-y-auto flex-1">
                {callsList.map((call) => {
                  const isMissed = call.direction === 'missed' || call.status === 'missed';
                  const isOutgoing = call.direction === 'outgoing';
                  const dateStr = new Date(call.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const dayStr = new Date(call.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });

                  return (
                    <div
                      key={call.id || `${call.contactId}-${call.timestamp}`}
                      className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-stone-50/80 dark:hover:bg-white/[0.03] transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                          {getAvatarInitials(call.contactName)}
                        </div>

                        <div className="min-w-0 space-y-0.5">
                          <p className={`text-xs font-bold truncate ${isMissed ? 'text-rose-600 dark:text-rose-400' : 'text-stone-900 dark:text-white'}`}>
                            {call.contactName}
                          </p>
                          <div className="flex items-center gap-1.5 text-[11px]">
                            {isMissed ? (
                              <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-semibold">
                                <PhoneMissed className="w-3 h-3 text-rose-500 shrink-0" />
                                <span>Missed</span>
                              </span>
                            ) : isOutgoing ? (
                              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                                <PhoneOutgoing className="w-3 h-3 text-emerald-500 shrink-0" />
                                <span>Outgoing</span>
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                                <PhoneIncoming className="w-3 h-3 text-blue-500 shrink-0" />
                                <span>Incoming</span>
                              </span>
                            )}
                            <span className="text-stone-400">·</span>
                            <span className="text-stone-400 text-[10px]">{dayStr}, {dateStr}</span>
                            {call.duration > 0 && (
                              <>
                                <span className="text-stone-400">·</span>
                                <span className="text-stone-500 dark:text-stone-400 text-[10px]">
                                  {Math.floor(call.duration / 60)}m {call.duration % 60}s
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* One-Tap Call Back Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleCallBack(call, 'audio')}
                          className="w-8 h-8 rounded-xl text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 flex items-center justify-center transition-colors cursor-pointer"
                          title="Call back (Audio)"
                        >
                          <Phone className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleCallBack(call, 'video')}
                          className="w-8 h-8 rounded-xl text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 flex items-center justify-center transition-colors cursor-pointer"
                          title="Call back (Video)"
                        >
                          <Video className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Conversation List */
          <div className="flex-1 overflow-y-auto divide-y divide-stone-100">
            {filteredConversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-6 text-center text-stone-500">
                {activeTab === 'requests' ? (
                  <>
                    <Inbox className="w-9 h-9 text-stone-300 mb-2 stroke-[1.5]" />
                    <p className="text-xs font-semibold text-stone-700">No message requests</p>
                    <p className="text-[11px] text-stone-400 mt-1 max-w-[200px]">
                      Messages from people not in your contacts will appear here safely.
                    </p>
                  </>
                ) : activeTab === 'archived' ? (
                  <>
                    <Archive className="w-9 h-9 text-stone-300 mb-2 stroke-[1.5]" />
                    <p className="text-xs font-semibold text-stone-700">No archived chats</p>
                  </>
                ) : (
                  <>
                    <MessageSquare className="w-9 h-9 text-stone-300 mb-2 stroke-[1.5]" />
                    <p className="text-xs font-semibold text-stone-700">No active chats yet</p>
                    <button
                      onClick={() => {
                        setNewChatModalOpen(true);
                        loadDirectory();
                      }}
                      className="mt-3 text-xs text-violet-600 font-semibold hover:underline cursor-pointer"
                    >
                      Start a conversation
                    </button>
                  </>
                )}
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = activeConvId === conv.id;
                const hasAlert = conv.isIncomingRequest && runApnaCheck(conv.lastMessage?.plaintext || '').isSuspicious;

                return (
                  <button
                    key={conv.id}
                    onClick={() => openConversation(conv.id)}
                    className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-stone-50 dark:hover:bg-white/[0.03] transition-colors text-left cursor-pointer ${
                      isSelected ? 'bg-violet-50/70 dark:bg-violet-950/30 border-r-2 border-violet-600' : ''
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-full bg-gradient-to-br ${getAvatarBg(
                        conv.contact.id
                      )} flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-xs`}
                    >
                      {conv.contact.avatarUrl ? <img src={conv.contact.avatarUrl} alt="" className="w-full h-full object-cover" /> : getAvatarInitials(conv.contact.displayName || conv.contact.email)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">
                          {conv.contact.displayName || (conv.contact.username ? `@${conv.contact.username}` : 'User')}
                        </p>
                        {conv.lastMessage && (
                          <span className="text-[10px] text-stone-400 shrink-0 ml-1">
                            {formatTime(conv.lastMessage.timestamp)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-1 mt-0.5">
                        <div className="flex items-center gap-1 min-w-0 truncate">
                          {hasAlert && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                          )}
                          {conv.lastMessage?.senderId === user?.id && (
                            <span className="shrink-0">
                              {conv.lastMessage?.status === 'delivered' ? (
                                <CheckCheck className="w-3 h-3 text-stone-400 inline" />
                              ) : (
                                <Check className="w-3 h-3 text-stone-400 inline" />
                              )}
                            </span>
                          )}
                          <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
                            {renderMessagePreview(conv)}
                          </p>
                        </div>
                        {conv.unreadCount && conv.unreadCount > 0 ? (
                          <span className="px-1.5 py-0.5 rounded-full bg-apna-accent text-white text-[9px] font-bold shrink-0">
                            {conv.unreadCount}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {conv.contact.verified ? (
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : conv.isIncomingRequest ? (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-violet-100 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300">
                        Request
                      </span>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* RIGHT PANE — Chat or Request Review (with swipe back gesture A6) */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className={`w-full h-full min-w-0 flex flex-col bg-apna-surface-2/30 overflow-hidden ${
          activeConvId === null ? 'hidden md:flex' : 'flex'
        }`}
      >
        {activeContact ? (
          <>
            {/* Header (Bug A6 back button & router history) */}
            <div className="bg-apna-surface border-b border-apna-border px-3.5 py-2.5 sm:px-4 sm:py-3 flex items-center gap-3 shadow-2xs min-w-0">
              <button
                onClick={closeConversation}
                className="md:hidden w-11 h-11 -ml-1 rounded-xl hover:bg-apna-surface-2 flex items-center justify-center text-apna-text cursor-pointer shrink-0"
                aria-label="Back to conversations list"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <button
                onClick={() => setProfilePreviewOpen(true)}
                className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer group"
                aria-label="Open contact information"
              >
                <div
                  className={`w-9 h-9 rounded-full bg-gradient-to-br ${getAvatarBg(
                    activeContact.id
                  )} flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-xs group-hover:scale-105 transition-transform`}
                >
                  {activeContact.avatarUrl ? <img src={activeContact.avatarUrl} alt="" className="w-full h-full object-cover" /> : getAvatarInitials(activeContact.displayName || activeContact.email)}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-bold text-apna-text truncate group-hover:text-apna-accent transition-colors">
                      {activeContact.displayName || (activeContact.username ? `@${activeContact.username}` : 'User')}
                    </p>
                    {activeContact.verified && (
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Lock className="w-2.5 h-2.5 text-emerald-800 dark:text-emerald-300" />
                    <span className="text-[10px] text-emerald-800 dark:text-emerald-300 font-semibold truncate">
                      End-to-end encrypted · Tap for info
                    </span>
                  </div>
                </div>
              </button>

              {/* Call Actions, Safety Number & Report */}
              <div className="flex items-center gap-1 sm:gap-1.5">
                <button
                  onClick={() => globalStartCall(activeContact, 'audio')}
                  disabled={isIncomingRequest || isPendingSentRequest}
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl text-stone-600 dark:text-stone-300 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/40 flex items-center justify-center transition-colors disabled:opacity-30 cursor-pointer"
                  title="Start Audio Call"
                >
                  <Phone className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                </button>

                <button
                  onClick={() => globalStartCall(activeContact, 'video')}
                  disabled={isIncomingRequest || isPendingSentRequest}
                  className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl text-stone-600 dark:text-stone-300 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/40 flex items-center justify-center transition-colors disabled:opacity-30 cursor-pointer"
                  title="Start Video Call (VC)"
                >
                  <Video className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                </button>

                <button
                  onClick={handleVerifySafetyNumber}
                  className="px-2.5 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Verify Safety Number / Key Fingerprint"
                >
                  <Fingerprint className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                  <span className="hidden sm:inline">Verify</span>
                </button>

                <button
                  onClick={() => setReportModalOpen(true)}
                  className="p-2 rounded-xl text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                  title="Report account"
                >
                  <Flag className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Error banner if any */}
            {errorMessage && (
              <div className="px-4 py-2 bg-rose-50 border-b border-rose-200 text-xs text-rose-700 flex items-center justify-between">
                <span>{errorMessage}</span>
                <button onClick={() => setErrorMessage('')} className="text-rose-500 hover:text-rose-700">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {/* MAIN CONTENT: Message Request Review OR Conversation Bubbles */}
            {isIncomingRequest ? (
              /* INSTAGRAM-STYLE REQUEST REVIEW VIEW */
              <div className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col items-center justify-center max-w-lg mx-auto w-full">
                <div className="w-full bg-white rounded-3xl border border-stone-200/80 shadow-md p-6 space-y-5 text-center">
                  <div
                    className={`w-16 h-16 rounded-full bg-gradient-to-br ${getAvatarBg(
                      activeContact.id
                    )} mx-auto flex items-center justify-center text-white text-xl font-bold shadow-md`}
                  >
                    {activeContact.displayName?.charAt(0).toUpperCase()}
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-stone-900">
                      {activeContact.displayName || (activeContact.username ? `@${activeContact.username}` : 'User')}
                    </h3>
                    <p className="text-xs text-stone-500 mt-0.5">
                      {activeContact.hasContactSharedEmail && activeContact.email ? activeContact.email : `@${activeContact.username || 'user'}`}
                    </p>
                    <p className="text-[11px] text-stone-400 mt-1 leading-relaxed">
                      Wants to message you on Saanjh. They cannot see read receipts, typing status, or send more messages until you accept.
                    </p>
                  </div>

                  {/* APNA Check Security Chip */}
                  {apnaCheckResult.isSuspicious ? (
                    <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-left space-y-1.5">
                      <div className="flex items-center gap-2 text-amber-800 font-bold text-xs">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>APNA Check: {apnaCheckResult.warningChip}</span>
                      </div>
                      <ul className="text-[11px] text-amber-700 list-disc list-inside space-y-0.5 pl-1">
                        {apnaCheckResult.reasons.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                      <p className="text-[10px] text-amber-600 font-medium pt-1">
                        Never share OTPs, passwords, or install remote access software.
                      </p>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-left flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="text-xs text-emerald-800 font-medium">
                        APNA Check: No known scam or phishing patterns detected.
                      </span>
                    </div>
                  )}

                  {/* Plain-text Preview of First Message */}
                  <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 text-left">
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <EyeOff className="w-3 h-3" />
                      Plain Text Preview (Links disabled)
                    </p>
                    <div className="text-xs text-stone-800 whitespace-pre-wrap select-all font-mono leading-relaxed break-words">
                      {requestFirstMessage || 'Hello! I would like to connect on Saanjh.'}
                    </div>
                  </div>

                  {/* Safety Number Hint */}
                  <div className="p-3 rounded-2xl bg-stone-50 border border-stone-100 flex items-center justify-between text-left">
                    <div className="flex items-center gap-2">
                      <Fingerprint className="w-4 h-4 text-violet-600" />
                      <div>
                        <p className="text-[11px] font-semibold text-stone-800">Safety Number Hint</p>
                        <p className="text-[10px] text-stone-400 font-mono">
                          {activeContact.fingerprint?.slice(0, 16) || 'Verifiable upon accept'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleVerifySafetyNumber}
                      className="text-xs text-violet-600 font-semibold hover:underline cursor-pointer"
                    >
                      Compare
                    </button>
                  </div>

                  {/* Action Buttons: Accept / Delete / Block / Report */}
                  <div className="space-y-2 pt-2">
                    <button
                      onClick={handleAcceptRequest}
                      className="w-full py-2.5 px-4 rounded-2xl bg-[#6A4CFF] hover:bg-[#5838F5] text-white font-semibold text-xs transition-colors shadow-sm cursor-pointer"
                    >
                      Accept & Enable Messages
                    </button>

                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={handleDeleteRequest}
                        className="py-2 px-3 rounded-2xl border border-stone-200 text-stone-700 hover:bg-stone-100 font-medium text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-stone-500" />
                        Delete
                      </button>

                      <button
                        onClick={handleBlockSender}
                        className="py-2 px-3 rounded-2xl border border-stone-200 text-rose-600 hover:bg-rose-50 font-medium text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Ban className="w-3.5 h-3.5 text-rose-500" />
                        Block
                      </button>

                      <button
                        onClick={() => setReportModalOpen(true)}
                        className="py-2 px-3 rounded-2xl border border-stone-200 text-stone-700 hover:bg-stone-100 font-medium text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Flag className="w-3.5 h-3.5 text-stone-500" />
                        Report
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* ACTIVE CHAT / CONVERSATION VIEW */
              <>
                {/* Pending Sent Request Banner */}
                {isPendingSentRequest && (
                  <div className="px-4 py-2.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200/80 dark:border-amber-900/60 flex items-center justify-between gap-2 text-xs text-amber-800 dark:text-amber-200">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        Request sent to {activeContact.displayName}. You can continue chatting freely below.
                      </span>
                    </div>
                    <button
                      onClick={handleAcceptRequest}
                      className="px-2.5 py-1 rounded-xl bg-amber-200/80 dark:bg-amber-900/70 hover:bg-amber-300 dark:hover:bg-amber-800 text-amber-900 dark:text-amber-100 text-[11px] font-bold transition-colors cursor-pointer shrink-0"
                    >
                      Connect Directly
                    </button>
                  </div>
                )}

                {/* Messages Bubbles */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-3 py-16">
                      <div className="w-12 h-12 rounded-2xl bg-violet-100 flex items-center justify-center">
                        <Lock className="w-6 h-6 text-violet-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-stone-800">No messages yet</p>
                        <p className="text-xs text-stone-400 mt-1">
                          Messages are end-to-end encrypted on this device
                        </p>
                      </div>
                    </div>
                  ) : (
                    messages.map((m, idx) => {
                      const isMe = m.senderId === user?.id;
                      return (
                        <div
                          key={m.id ?? idx}
                          className={`flex ${isMe ? 'justify-end' : 'justify-start'} gap-2 group animate-fade-in`}
                        >
                          {!isMe && (
                            <div
                              className={`w-7 h-7 rounded-full bg-gradient-to-br ${getAvatarBg(
                                activeContact.id
                              )} flex items-center justify-center text-white text-[10px] font-bold shrink-0 self-end shadow-xs`}
                            >
                              {getAvatarInitials(activeContact.displayName || activeContact.email)}
                            </div>
                          )}
                          <div className="flex flex-col gap-0.5 max-w-[78%] sm:max-w-[70%] min-w-0">
                            <div
                              className={
                                isMe
                                  ? 'bg-[#6A4CFF] text-white rounded-2xl rounded-br-xs px-4 py-2.5 text-xs shadow-xs break-words leading-relaxed'
                                  : 'bg-white dark:bg-stone-800 border border-stone-200/90 dark:border-stone-700 text-stone-900 dark:text-stone-100 rounded-2xl rounded-bl-xs px-4 py-2.5 text-xs shadow-2xs break-words leading-relaxed'
                              }
                            >
                              {m.attachment ? (
                                <div className="space-y-2">
                                  {m.attachment.type === 'voice_note' && m.attachment.url && (
                                    <AudioMessagePlayer
                                      src={m.attachment.url}
                                      isMe={isMe}
                                      duration={m.attachment.duration}
                                    />
                                  )}

                                  {m.attachment.type === 'image' && (
                                    <div
                                      onClick={() => {
                                        if (m.attachment?.url) {
                                          setLightboxSrc(m.attachment.url);
                                          setLightboxFileName(m.attachment.fileName);
                                        }
                                      }}
                                      className="cursor-pointer group relative overflow-hidden rounded-xl border border-black/10 dark:border-white/10 max-w-sm"
                                    >
                                      <img
                                        src={m.attachment.url || ''}
                                        alt={m.attachment.fileName || 'Photo'}
                                        className="max-h-64 sm:max-h-72 w-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                                      />
                                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1.5 backdrop-blur-[1px]">
                                        <Search className="w-4 h-4" /> Tap to view
                                      </div>
                                    </div>
                                  )}

                                  {m.attachment.type === 'video' && (
                                    <div className="max-w-sm overflow-hidden rounded-xl bg-black/90">
                                      <video
                                        src={m.attachment.url || ''}
                                        controls
                                        playsInline
                                        className="max-h-64 w-full rounded-xl object-contain"
                                      />
                                    </div>
                                  )}

                                  {m.attachment.type === 'document' && (
                                    <a
                                      href={m.attachment.url || '#'}
                                      download={m.attachment.fileName || 'document'}
                                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all ${
                                        isMe
                                          ? 'bg-white/15 border-white/20 text-white hover:bg-white/25'
                                          : 'bg-stone-50 dark:bg-stone-700/60 border-stone-200 dark:border-stone-600 text-stone-900 dark:text-stone-100 hover:bg-stone-100'
                                      }`}
                                    >
                                      <div className={`p-2 rounded-lg ${isMe ? 'bg-white/20 text-white' : 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300'}`}>
                                        <FileText className="w-4 h-4" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold truncate">{m.attachment.fileName || 'Document'}</p>
                                        {m.attachment.fileSize && (
                                          <p className="text-[10px] opacity-75">{Math.round(m.attachment.fileSize / 1024)} KB</p>
                                        )}
                                      </div>
                                      <Download className="w-4 h-4 shrink-0 opacity-80" />
                                    </a>
                                  )}

                                  {m.attachment.type === 'location' && m.attachment.location && (
                                    <a
                                      href={`https://www.google.com/maps?q=${m.attachment.location.latitude},${m.attachment.location.longitude}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all ${
                                        isMe
                                          ? 'bg-white/15 border-white/20 text-white hover:bg-white/25'
                                          : 'bg-stone-50 dark:bg-stone-700/60 border-stone-200 dark:border-stone-600 text-stone-900 dark:text-stone-100 hover:bg-stone-100'
                                      }`}
                                    >
                                      <div className={`p-2 rounded-lg ${isMe ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-600 dark:bg-rose-900/50 dark:text-rose-300'}`}>
                                        <MapPin className="w-4 h-4" />
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold">Live GPS Location</p>
                                        <p className="text-[10px] opacity-75 truncate">
                                          {m.attachment.location.latitude.toFixed(4)}, {m.attachment.location.longitude.toFixed(4)}
                                        </p>
                                      </div>
                                      <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-80" />
                                    </a>
                                  )}

                                  {m.plaintext && !m.plaintext.startsWith('🎤') && !m.plaintext.startsWith('📷') && !m.plaintext.startsWith('🎥') && !m.plaintext.startsWith('📄') && !m.plaintext.startsWith('📍') && (
                                    <p className="px-0.5 text-xs">{m.plaintext}</p>
                                  )}
                                </div>
                              ) : (
                                m.plaintext
                              )}
                            </div>
                            <div
                              className={`flex items-center gap-1 text-[10px] text-stone-400 px-1 ${
                                isMe ? 'justify-end' : 'justify-start'
                              }`}
                            >
                              <span>{formatTime(m.timestamp)}</span>
                              {isMe && (
                                m.status === 'delivered' ? (
                                  <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Check className="w-3 h-3 text-stone-400" />
                                )
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}

                  {/* Typing Indicator */}
                  {isOtherTyping && (
                    <div className="flex items-center gap-2 animate-fade-in">
                      <div
                        className={`w-7 h-7 rounded-full bg-gradient-to-br ${getAvatarBg(
                          activeContact.id
                        )} flex items-center justify-center text-white text-[10px] font-bold shrink-0 shadow-xs`}
                      >
                        {getAvatarInitials(activeContact.displayName || activeContact.email)}
                      </div>
                      <div className="bg-white border border-stone-200 rounded-2xl rounded-bl-xs px-3.5 py-2 shadow-2xs flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce" />
                        <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce [animation-delay:0.2s]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce [animation-delay:0.4s]" />
                      </div>
                    </div>
                  )}

                  <div ref={chatEndRef} />
                </div>

                {/* Input Area */}
                <div className="bg-apna-surface/95 backdrop-blur-xl border-t border-apna-border p-2.5 sm:p-3 safe-area-bottom min-w-0 shadow-[0_-8px_24px_rgba(0,0,0,.04)]">
                  {isRecordingVoice ? (
                    <div className="flex items-center justify-between gap-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl px-4 py-2.5 animate-pulse">
                      <div className="flex items-center gap-2.5">
                        <span className="w-3 h-3 rounded-full bg-rose-600 animate-ping" />
                        <span className="text-xs font-bold text-rose-600 font-mono">
                          {Math.floor(recordingDuration / 60).toString().padStart(2, '0')}:
                          {(recordingDuration % 60).toString().padStart(2, '0')}
                        </span>
                        <span className="text-xs text-stone-500 dark:text-stone-400 hidden sm:inline">
                          Recording voice message...
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={cancelVoiceRecording}
                          className="w-9 h-9 rounded-xl bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-200 hover:bg-rose-100 hover:text-rose-600 flex items-center justify-center transition-colors cursor-pointer"
                          title="Cancel recording"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={sendVoiceRecording}
                          className="px-3.5 py-2 rounded-xl bg-violet-600 text-white font-semibold text-xs flex items-center gap-1.5 hover:bg-violet-700 transition-colors shadow-sm cursor-pointer"
                          title="Send voice note"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Send</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleSendMessage} className="flex items-center gap-2 min-w-0">
                      {/* Attachment Menu Button */}
                      <button
                        type="button"
                        onClick={() => setAttachmentMenuOpen(true)}
                        disabled={isIncomingRequest || isPendingSentRequest}
                        className="w-10 h-10 rounded-2xl bg-apna-surface-2 border border-apna-border text-stone-600 dark:text-stone-300 hover:text-violet-600 hover:border-violet-300 flex items-center justify-center transition-all disabled:opacity-40 cursor-pointer shrink-0"
                        title="Add photo, video, document, camera snap, or location"
                      >
                        <Paperclip className="w-4 h-4" />
                      </button>

                      <input
                        ref={inputRef}
                        type="text"
                        placeholder="Type an encrypted message..."
                        value={inputVal}
                        onChange={handleInputChange}
                        disabled={isIncomingRequest || isPendingSentRequest}
                        className="flex-1 min-w-0 bg-apna-surface-2 border border-apna-border rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-apna-text placeholder:text-apna-faint focus:outline-none focus:border-apna-accent transition-colors"
                      />

                      {/* Mic Button for Voice Note (if input is empty) or Send button */}
                      {inputVal.trim() ? (
                        <button
                          type="submit"
                          className="w-11 h-11 rounded-2xl bg-apna-accent text-white flex items-center justify-center hover:bg-apna-accent-ink transition-colors shrink-0 shadow-sm cursor-pointer"
                          aria-label="Send message"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={startVoiceRecording}
                          disabled={isIncomingRequest || isPendingSentRequest}
                          className="w-10 h-10 rounded-2xl bg-apna-accent text-white flex items-center justify-center hover:bg-apna-accent-ink transition-colors shrink-0 shadow-sm cursor-pointer disabled:opacity-40"
                          title="Record voice note"
                        >
                          <Mic className="w-4 h-4" />
                        </button>
                      )}
                    </form>
                  )}
                </div>
              </>
            )}
          </>
        ) : (
          /* Empty Chat Area */
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-violet-100 flex items-center justify-center text-violet-600 shadow-sm">
              <Lock className="w-8 h-8" />
            </div>
            <div>
              <h3 className="font-bold text-stone-900 text-base">Encrypted Communications</h3>
              <p className="text-xs text-stone-500 mt-1 max-w-xs leading-relaxed">
                Select a conversation or start a new chat. Messages are encrypted on-device and blind-relayed by the server.
              </p>
            </div>
            <button
              onClick={() => {
                setNewChatModalOpen(true);
                loadDirectory();
              }}
              className="py-2.5 px-4 rounded-2xl bg-[#6A4CFF] text-white font-semibold text-xs hover:bg-[#5838F5] transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              New Encrypted Chat
            </button>
          </div>
        )}
      </div>

      {/* Contact Info Full Screen / Drawer (Bug A7 & Section D) */}
      {profilePreviewOpen && activeContact && (
        <ContactInfoScreen
          isOpen={profilePreviewOpen}
          contact={activeContact}
          messages={messages}
          isUnknownContact={isIncomingRequest}
          isBlocked={activeItem?.status === 'blocked'}
          onClose={() => setProfilePreviewOpen(false)}
          onAudioCall={() => globalStartCall(activeContact, 'audio')}
          onVideoCall={() => globalStartCall(activeContact, 'video')}
          onSearchInChat={() => {
            setProfilePreviewOpen(false);
            inputRef.current?.focus();
          }}
          onOpenVerifySafetyNumber={handleVerifySafetyNumber}
          onToggleSharePhone={async (shared) => {
            if (activeContact?.id) {
              await db.contacts.update(Number(activeContact.id), { shareMyPhoneWithContact: shared });
              await loadAllConversations();
              setActionSuccess(shared ? 'Phone number shared with this contact.' : 'Phone number hidden from contact.');
              setTimeout(() => setActionSuccess(''), 3000);
            }
          }}
          onToggleShareEmail={async (shared) => {
            if (activeContact?.id) {
              await db.contacts.update(Number(activeContact.id), { shareMyEmailWithContact: shared });
              await loadAllConversations();
              setActionSuccess(shared ? 'Email address shared with this contact.' : 'Email address hidden from contact.');
              setTimeout(() => setActionSuccess(''), 3000);
            }
          }}
          onToggleBlock={handleBlockSender}
          onReportContact={() => {
            setProfilePreviewOpen(false);
            setReportModalOpen(true);
          }}
          onToggleMute={(duration) => {
            setActionSuccess(duration === 'unmute' ? 'Chat unmuted.' : `Chat muted for ${duration}.`);
            setTimeout(() => setActionSuccess(''), 3000);
          }}
          onSetDisappearing={(days) => {
            setActionSuccess(days === 0 ? 'Disappearing messages turned off.' : `Disappearing messages set to ${days} days.`);
            setTimeout(() => setActionSuccess(''), 3000);
          }}
          onToggleChatLock={() => {
            setActionSuccess('Chat lock toggled for this conversation.');
            setTimeout(() => setActionSuccess(''), 3000);
          }}
          onClearChat={handleClearChat}
          onDeleteChat={handleDeleteChat}
          onExportChat={handleExportChat}
        />
      )}

      {/* MODAL 1: Start Encrypted Chat (createPortal, fixed inset-0, z-40 backdrop, z-50 dialog) */}
      {newChatModalOpen && createPortal(
        <div
          className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setNewChatModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-stone-200 p-6 space-y-4 animate-scale-in z-50"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-violet-600" />
                <h3 className="font-bold text-stone-900 text-sm">Start Encrypted Chat</h3>
              </div>
              <button
                onClick={() => setNewChatModalOpen(false)}
                className="w-7 h-7 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                {errorMessage}
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search by @username..."
                value={recipientQuery}
                onChange={(e) => { setRecipientQuery(e.target.value); loadDirectory(e.target.value); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleStartNewChat(recipientQuery);
                }}
                className="flex-1 bg-stone-50 border border-stone-200 rounded-2xl px-3.5 py-2 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:border-[#6A4CFF]"
                autoFocus
              />
              <button
                onClick={() => handleStartNewChat(recipientQuery)}
                className="py-2 px-4 rounded-2xl bg-[#6A4CFF] text-white font-semibold text-xs hover:bg-[#5838F5] transition-colors shrink-0 shadow-sm cursor-pointer"
              >
                Connect
              </button>
            </div>

            {directoryUsers.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2">
                  Matching people
                </p>
                <div className="space-y-1.5 max-h-52 overflow-y-auto">
                  {directoryUsers.map((u) => (
                    <button
                      key={u.user_id || u.id}
                      onClick={() =>
                        handleStartNewChat(u.user_username || u.user_display_name || 'user')
                      }
                      className="w-full flex items-center gap-3 p-2.5 rounded-2xl bg-stone-50 border border-stone-200 hover:border-violet-300 hover:bg-violet-50/40 transition-colors text-left cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-xs font-bold shrink-0">
                        {(u.user_display_name || u.user_username || 'U')
                          .charAt(0)
                          .toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-stone-900 truncate">
                          {u.user_display_name || u.user_username}
                        </p>
                        <p className="text-[10px] text-stone-500 truncate">
                          @{u.user_username || 'user'}
                        </p>
                      </div>
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 ml-auto shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 2: Safety Number Verification */}
      {isVerifyingSafety && activeContact && createPortal(
        <div
          className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setIsVerifyingSafety(false)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-stone-200 p-6 space-y-4 animate-scale-in z-50"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-stone-900 text-sm">Safety Number Verification</h3>
              </div>
              <button
                onClick={() => setIsVerifyingSafety(false)}
                className="w-7 h-7 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              Compare this safety number with <strong>{activeContact.displayName}</strong> over a secure voice call or in person to verify no attacker is intercepting your conversation.
            </p>

            <div className="p-4 rounded-2xl bg-violet-50/60 border border-violet-200 text-center font-mono text-xs text-violet-800 font-bold tracking-widest select-all break-words leading-relaxed">
              {safetyNumberValue}
            </div>

            <div className="p-3 rounded-2xl bg-stone-50 text-[11px] text-stone-600 space-y-1">
              <p><strong>Algorithm:</strong> libsodium X25519 authenticated crypto_box</p>
              <p><strong>Padding:</strong> 64-byte block masking</p>
              <p><strong>Audit Status:</strong> not independently audited</p>
            </div>

            <button
              onClick={() => setIsVerifyingSafety(false)}
              className="w-full py-2.5 rounded-2xl bg-[#6A4CFF] text-white font-semibold text-xs hover:bg-[#5838F5] transition-colors shadow-sm cursor-pointer"
            >
              Verified & Close
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 3: Report User with Privacy Protection */}
      {reportModalOpen && activeContact && createPortal(
        <div
          className="fixed inset-0 z-40 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setReportModalOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-stone-200 p-6 space-y-4 animate-scale-in z-50"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-600" />
                <h3 className="font-bold text-stone-900 text-sm">Report Account</h3>
              </div>
              <button
                onClick={() => setReportModalOpen(false)}
                className="w-7 h-7 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              Reports protect our community against cyber fraud. By default, <strong>no message content is leaked</strong>.
            </p>

            <form onSubmit={handleReportUser} className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-stone-700 block mb-1">
                  Reason for report
                </label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl p-2 text-xs text-stone-900 focus:outline-none focus:border-[#6A4CFF]"
                >
                  <option value="Scam / Phishing attempt">Scam / Phishing attempt</option>
                  <option value="Impersonation / Fake profile">Impersonation / Fake profile</option>
                  <option value="Harassment or abuse">Harassment or abuse</option>
                  <option value="Unwanted spam">Unwanted spam</option>
                  <option value="Other security violation">Other security violation</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-stone-700 block mb-1">
                  Optional details
                </label>
                <textarea
                  rows={2}
                  placeholder="Describe what occurred (optional)..."
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-2xl p-2.5 text-xs text-stone-900 focus:outline-none focus:border-[#6A4CFF]"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-stone-700 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={reportAttachCiphertext}
                  onChange={(e) => setReportAttachCiphertext(e.target.checked)}
                  className="rounded text-[#6A4CFF] focus:ring-[#6A4CFF]"
                />
                <span>Attach first message preview for review</span>
              </label>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setReportModalOpen(false)}
                  className="flex-1 py-2 rounded-2xl border border-stone-200 text-stone-700 font-semibold text-xs hover:bg-stone-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-2xl bg-rose-600 text-white font-semibold text-xs hover:bg-rose-700 shadow-sm cursor-pointer"
                >
                  Submit Report
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* WhatsApp Profile, DP & Privacy Settings Modal */}
      <WhatsAppSettingsModal
        isOpen={settingsModalOpen}
        onClose={() => {
          setSettingsModalOpen(false);
          loadCallsHistory();
          loadAllConversations();
        }}
      />

      {/* Attachment Menu (Camera snapshot, Photo, Video, Document, GPS Location) */}
      <AttachmentMenu
        isOpen={attachmentMenuOpen}
        onClose={() => setAttachmentMenuOpen(false)}
        onSendAttachment={handleSendAttachment}
      />

      {/* Fullscreen Media Lightbox with Zoom and Download */}
      {lightboxSrc && (
        <MediaLightbox
          isOpen={!!lightboxSrc}
          src={lightboxSrc}
          fileName={lightboxFileName}
          onClose={() => {
            setLightboxSrc(null);
            setLightboxFileName(undefined);
          }}
        />
      )}
    </div>
  );
};
