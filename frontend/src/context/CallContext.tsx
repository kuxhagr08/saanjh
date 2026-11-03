import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { db, type LocalContact, type LocalCall } from '../db';
import { WS_BASE, getStoredTokens } from '../api/client';
import { CallModal, type CallType, type CallState } from '../components/CallModal';
import { PhoneMissed, Phone, Video } from 'lucide-react';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

interface CallContextType {
  activeCallContact: LocalContact | null;
  callModalOpen: boolean;
  callType: CallType;
  callState: CallState;
  callDuration: number;
  isCallMuted: boolean;
  isCallVideoOff: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  missedCallNotice: { name: string; type: CallType; time: string } | null;
  clearMissedCallNotice: () => void;
  startCall: (contact: LocalContact, type: CallType) => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  const [activeCallContact, setActiveCallContact] = useState<LocalContact | null>(null);
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [callType, setCallType] = useState<CallType>('audio');
  const [callState, setCallState] = useState<CallState>('outgoing_ringing');
  const [callDuration, setCallDuration] = useState(0);
  const [isCallMuted, setIsCallMuted] = useState(false);
  const [isCallVideoOff, setIsCallVideoOff] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [missedCallNotice, setMissedCallNotice] = useState<{ name: string; type: CallType; time: string } | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const userWsRef = useRef<WebSocket | null>(null);
  const callTimerRef = useRef<any>(null);
  const ringTimeoutRef = useRef<any>(null);
  const activeCallContactRef = useRef<LocalContact | null>(null);
  const callDurationRef = useRef<number>(0);
  const isIncomingCallRef = useRef<boolean>(false);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);

  activeCallContactRef.current = activeCallContact;
  callDurationRef.current = callDuration;

  const startCallTimer = () => {
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    setCallDuration(0);
    callTimerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
  };

  const addOrQueueCandidate = async (candidate: RTCIceCandidateInit) => {
    if (pcRef.current && pcRef.current.remoteDescription && pcRef.current.remoteDescription.type) {
      try {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn('ICE candidate warning', err);
      }
    } else {
      pendingIceCandidatesRef.current.push(candidate);
    }
  };

  const drainPendingIceCandidates = async () => {
    if (!pcRef.current || !pcRef.current.remoteDescription) return;
    while (pendingIceCandidatesRef.current.length > 0) {
      const cand = pendingIceCandidatesRef.current.shift();
      if (cand) {
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(cand));
        } catch (err) {
          console.warn('Drain ICE candidate warning', err);
        }
      }
    }
  };

  const cleanupCall = useCallback(() => {
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    if (ringTimeoutRef.current) {
      clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    pendingIceCandidatesRef.current = [];
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
  }, []);

  // Global user WebSocket for notifications & incoming call signals
  useEffect(() => {
    if (!user) {
      if (userWsRef.current) {
        userWsRef.current.close();
        userWsRef.current = null;
      }
      return;
    }

    const tokens = getStoredTokens();
    if (!tokens?.access) return;

    let ws: WebSocket | null = null;
    try {
      const url = `${WS_BASE}/ws/user/?token=${tokens.access}`;
      ws = new WebSocket(url);

      ws.onmessage = async (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === 'webrtc_signal') {
            const sig = payload.signal;
            const senderId = payload.sender_id;
            const senderName = payload.sender_name || 'Contact';
            const senderEmail = payload.sender_email || '';
            const cType: CallType = payload.call_type || 'audio';

            if (sig.type === 'call_request') {
              // INCOMING CALL RINGING!
              isIncomingCallRef.current = true;
              const contactObj: LocalContact = {
                id: senderId,
                displayName: senderName,
                email: senderEmail,
                publicKeyBase64: '',
                signingPublicKeyBase64: '',
                fingerprint: '',
                verified: false,
                addedAt: Date.now(),
              };

              setActiveCallContact(contactObj);
              activeCallContactRef.current = contactObj;
              setCallType(cType);
              setCallState('incoming_ringing');
              setCallModalOpen(true);

              // Auto-timeout after 30s as missed call if not answered
              if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
              ringTimeoutRef.current = setTimeout(async () => {
                // Log missed call
                await db.calls.add({
                  contactId: senderId,
                  contactName: senderName,
                  contactEmail: senderEmail,
                  type: cType,
                  direction: 'missed',
                  status: 'missed',
                  duration: 0,
                  timestamp: Date.now(),
                });

                setMissedCallNotice({
                  name: senderName,
                  type: cType,
                  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                });

                if (userWsRef.current && userWsRef.current.readyState === WebSocket.OPEN) {
                  userWsRef.current.send(
                    JSON.stringify({
                      type: 'webrtc_signal',
                      recipient_id: senderId,
                      signal: { type: 'call_reject' },
                    })
                  );
                }
                cleanupCall();
              }, 30000);
            } else if (sig.type === 'call_accept') {
              // Remote peer accepted our call!
              if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
              if (pcRef.current) {
                try {
                  const offer = await pcRef.current.createOffer();
                  await pcRef.current.setLocalDescription(offer);
                  userWsRef.current?.send(
                    JSON.stringify({
                      type: 'webrtc_signal',
                      recipient_id: activeCallContactRef.current?.id || senderId,
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
                  await drainPendingIceCandidates();
                  const answer = await pcRef.current.createAnswer();
                  await pcRef.current.setLocalDescription(answer);
                  userWsRef.current?.send(
                    JSON.stringify({
                      type: 'webrtc_signal',
                      recipient_id: activeCallContactRef.current?.id || senderId,
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
                  await drainPendingIceCandidates();
                } catch (err) {
                  console.error('Error setting remote answer', err);
                }
              }
            } else if (sig.type === 'ice_candidate' && sig.candidate) {
              await addOrQueueCandidate(sig.candidate);
            } else if (sig.type === 'call_reject') {
              // Log as missed or cancelled
              const c = activeCallContactRef.current;
              if (c) {
                await db.calls.add({
                  contactId: c.id,
                  contactName: c.displayName,
                  contactEmail: c.email,
                  type: callType,
                  direction: isIncomingCallRef.current ? 'missed' : 'outgoing',
                  status: 'declined',
                  duration: 0,
                  timestamp: Date.now(),
                });
              }
              cleanupCall();
            } else if (sig.type === 'call_end') {
              // Remote party hung up
              const c = activeCallContactRef.current;
              const dur = callDurationRef.current;
              if (c) {
                await db.calls.add({
                  contactId: c.id,
                  contactName: c.displayName,
                  contactEmail: c.email,
                  type: callType,
                  direction: isIncomingCallRef.current ? 'incoming' : 'outgoing',
                  status: dur > 0 ? 'completed' : 'missed',
                  duration: dur,
                  timestamp: Date.now(),
                });
              }
              cleanupCall();
            }
          }
        } catch (e) {
          console.warn('User WS parse warning', e);
        }
      };

      userWsRef.current = ws;
    } catch (e) {
      console.warn('User WS connect error', e);
    }

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [user, cleanupCall, callType]);

  const startCall = async (contact: LocalContact, type: CallType) => {
    isIncomingCallRef.current = false;
    setActiveCallContact(contact);
    activeCallContactRef.current = contact;
    setCallType(type);
    setCallState('outgoing_ringing');
    setCallModalOpen(true);
    pendingIceCandidatesRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: type === 'video' ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        } : false,
      });
      setLocalStream(stream);
      localStreamRef.current = stream;

      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcRef.current = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        console.log('Call: incoming track', event.track.kind, event.streams);
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        } else if (event.track) {
          const stream = new MediaStream([event.track]);
          setRemoteStream(stream);
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', pc.iceConnectionState);
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          setCallState('connected');
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && userWsRef.current?.readyState === WebSocket.OPEN) {
          userWsRef.current.send(
            JSON.stringify({
              type: 'webrtc_signal',
              recipient_id: contact.id,
              signal: { type: 'ice_candidate', candidate: event.candidate },
            })
          );
        }
      };

      // Send call request to recipient's global user queue
      if (userWsRef.current && userWsRef.current.readyState === WebSocket.OPEN) {
        userWsRef.current.send(
          JSON.stringify({
            type: 'webrtc_signal',
            recipient_id: contact.id,
            signal: { type: 'call_request', call_type: type },
            call_type: type,
          })
        );
      }

      // Auto cancel after 35s if no answer
      if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = setTimeout(async () => {
        await db.calls.add({
          contactId: contact.id,
          contactName: contact.displayName,
          contactEmail: contact.email,
          type,
          direction: 'outgoing',
          status: 'cancelled',
          duration: 0,
          timestamp: Date.now(),
        });
        endCall();
      }, 35000);
    } catch (err) {
      console.error('Call media error', err);
      alert('Camera or Microphone access was denied.');
      cleanupCall();
    }
  };

  const acceptCall = async () => {
    if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
    setCallState('connected');
    const recipientId = activeCallContactRef.current?.id;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: callType === 'video' ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        } : false,
      });
      setLocalStream(stream);
      localStreamRef.current = stream;

      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcRef.current = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        console.log('Call: callee incoming track', event.track.kind, event.streams);
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        } else if (event.track) {
          const stream = new MediaStream([event.track]);
          setRemoteStream(stream);
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log('Callee ICE connection state:', pc.iceConnectionState);
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          setCallState('connected');
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && userWsRef.current?.readyState === WebSocket.OPEN && recipientId) {
          userWsRef.current.send(
            JSON.stringify({
              type: 'webrtc_signal',
              recipient_id: recipientId,
              signal: { type: 'ice_candidate', candidate: event.candidate },
            })
          );
        }
      };

      if (userWsRef.current && userWsRef.current.readyState === WebSocket.OPEN && recipientId) {
        userWsRef.current.send(
          JSON.stringify({
            type: 'webrtc_signal',
            recipient_id: recipientId,
            signal: { type: 'call_accept' },
          })
        );
      }
    } catch (err) {
      console.error('Accept media error', err);
      declineCall();
    }
  };

  const declineCall = async () => {
    if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
    const c = activeCallContactRef.current;
    if (c) {
      await db.calls.add({
        contactId: c.id,
        contactName: c.displayName,
        contactEmail: c.email,
        type: callType,
        direction: 'missed',
        status: 'declined',
        duration: 0,
        timestamp: Date.now(),
      });
    }

    if (userWsRef.current && userWsRef.current.readyState === WebSocket.OPEN && c) {
      userWsRef.current.send(
        JSON.stringify({
          type: 'webrtc_signal',
          recipient_id: c.id,
          signal: { type: 'call_reject' },
        })
      );
    }
    cleanupCall();
  };

  const endCall = async () => {
    if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
    const c = activeCallContactRef.current;
    const dur = callDurationRef.current;
    if (c) {
      await db.calls.add({
        contactId: c.id,
        contactName: c.displayName,
        contactEmail: c.email,
        type: callType,
        direction: isIncomingCallRef.current ? 'incoming' : 'outgoing',
        status: dur > 0 ? 'completed' : 'missed',
        duration: dur,
        timestamp: Date.now(),
      });
    }

    if (userWsRef.current && userWsRef.current.readyState === WebSocket.OPEN && c) {
      userWsRef.current.send(
        JSON.stringify({
          type: 'webrtc_signal',
          recipient_id: c.id,
          signal: { type: 'call_end' },
        })
      );
    }
    cleanupCall();
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsCallMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsCallVideoOff(!videoTrack.enabled);
      }
    }
  };

  const clearMissedCallNotice = () => setMissedCallNotice(null);

  return (
    <CallContext.Provider
      value={{
        activeCallContact,
        callModalOpen,
        callType,
        callState,
        callDuration,
        isCallMuted,
        isCallVideoOff,
        localStream,
        remoteStream,
        missedCallNotice,
        clearMissedCallNotice,
        startCall,
        acceptCall,
        declineCall,
        endCall,
        toggleMute,
        toggleVideo,
      }}
    >
      {children}

      {/* Global Missed Call Banner Toast */}
      {missedCallNotice && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[99999] bg-rose-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-fade-in border border-rose-400">
          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <PhoneMissed className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-xs font-bold">
              Missed {missedCallNotice.type === 'video' ? 'Video Call' : 'Voice Call'}
            </p>
            <p className="text-[11px] text-white/90">
              From {missedCallNotice.name} at {missedCallNotice.time}
            </p>
          </div>
          <button
            onClick={clearMissedCallNotice}
            className="ml-2 text-white/80 hover:text-white text-xs font-bold px-2 py-1 rounded-lg hover:bg-white/10"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Global Call Modal */}
      {callModalOpen && activeCallContact && (
        <CallModal
          isOpen={callModalOpen}
          callType={callType}
          callState={callState}
          contact={activeCallContact}
          callDuration={callDuration}
          isMuted={isCallMuted}
          isVideoOff={isCallVideoOff}
          localStream={localStream}
          remoteStream={remoteStream}
          onAccept={acceptCall}
          onDecline={declineCall}
          onEndCall={endCall}
          onToggleMute={toggleMute}
          onToggleVideo={toggleVideo}
        />
      )}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
};
