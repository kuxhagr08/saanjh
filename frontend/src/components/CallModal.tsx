import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Minimize2,
  Maximize2,
  ShieldCheck,
  User,
} from 'lucide-react';
import type { LocalContact } from '../db';

export type CallType = 'audio' | 'video';
export type CallState = 'outgoing_ringing' | 'incoming_ringing' | 'connected' | 'ended';

interface CallModalProps {
  isOpen: boolean;
  callType: CallType;
  callState: CallState;
  contact: LocalContact;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isVideoOff: boolean;
  callDuration: number;
  onAccept: () => void;
  onDecline: () => void;
  onEndCall: () => void;
  onToggleMute: () => void;
  onToggleVideo: () => void;
}

export const CallModal: React.FC<CallModalProps> = ({
  isOpen,
  callType,
  callState,
  contact,
  localStream,
  remoteStream,
  isMuted,
  isVideoOff,
  callDuration,
  onAccept,
  onDecline,
  onEndCall,
  onToggleMute,
  onToggleVideo,
}) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const ringtoneTimerRef = useRef<any>(null);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);

  // Attach media streams to video elements
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, isOpen, isVideoOff]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, isOpen]);

  // Dedicated remote audio playback for flawless 2-way voice in both voice & video calls
  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.muted = !isSpeakerOn;
      const playPromise = remoteAudioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('Audio autoPlay blocked, waiting for user gesture:', err);
        });
      }
    }
  }, [remoteStream, isOpen, isSpeakerOn]);

  const toggleSpeaker = () => {
    setIsSpeakerOn((prev) => {
      const next = !prev;
      if (remoteAudioRef.current) {
        remoteAudioRef.current.muted = !next;
      }
      return next;
    });
  };

  // Audio synthesizer for pleasant zero-asset ringtone / ringback
  useEffect(() => {
    if (!isOpen) {
      stopRingtone();
      return;
    }

    if (callState === 'incoming_ringing') {
      playIncomingRingtone();
    } else if (callState === 'outgoing_ringing') {
      playOutgoingRingback();
    } else {
      stopRingtone();
    }

    return () => stopRingtone();
  }, [callState, isOpen]);

  const stopRingtone = () => {
    if (ringtoneTimerRef.current) {
      clearInterval(ringtoneTimerRef.current);
      ringtoneTimerRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }
  };

  const playIncomingRingtone = () => {
    stopRingtone();
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = ctx;

      const ring = () => {
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') return;
        const now = ctx.currentTime;
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + i * 0.12);
          gain.gain.setValueAtTime(0.08, now + i * 0.12);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.12);
          osc.stop(now + i * 0.12 + 0.35);
        });
      };

      ring();
      ringtoneTimerRef.current = setInterval(ring, 2200);
    } catch {}
  };

  const playOutgoingRingback = () => {
    stopRingtone();
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = ctx;

      const tone = () => {
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') return;
        const now = ctx.currentTime;
        [440, 480].forEach((freq) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now);
          gain.gain.setValueAtTime(0.04, now);
          gain.gain.setValueAtTime(0.04, now + 1.2);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 1.3);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 1.3);
        });
      };

      tone();
      ringtoneTimerRef.current = setInterval(tone, 3500);
    } catch {}
  };

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md transition-all duration-300">
      <div className="relative w-full max-w-2xl h-[85vh] max-h-[720px] rounded-3xl overflow-hidden shadow-2xl border border-white/10 bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-950 flex flex-col justify-between text-white z-50">
        
        {/* Top Header */}
        <div className="relative z-20 flex items-center justify-between p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-violet-600/30 border border-violet-500/30 flex items-center justify-center text-violet-400">
              {callType === 'video' ? <Video size={20} /> : <Phone size={20} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-lg">{contact.displayName}</h3>
                <span className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <ShieldCheck size={12} /> P2P E2EE
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {callState === 'outgoing_ringing' && 'Calling...'}
                {callState === 'incoming_ringing' && `Incoming ${callType === 'video' ? 'Video' : 'Voice'} Call`}
                {callState === 'connected' && `Call in progress • ${formatDuration(callDuration)}`}
                {callState === 'ended' && 'Call ended'}
              </p>
            </div>
          </div>

          <div className="px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md text-xs font-mono text-slate-300 border border-white/10">
            {callState === 'connected' ? formatDuration(callDuration) : 'Private Direct Stream'}
          </div>
        </div>

        {/* Center Media Area */}
        <div className="relative flex-1 flex items-center justify-center overflow-hidden">
          {callType === 'video' && callState === 'connected' ? (
            <div className="relative w-full h-full">
              {/* Remote Video Stream */}
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
              {/* Local Video Thumbnail (PIP) */}
              <div className="absolute bottom-4 right-4 w-36 h-48 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-slate-800">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : ''}`}
                />
                {isVideoOff && (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-slate-400 text-xs">
                    <VideoOff size={24} className="mb-1" />
                    Camera off
                  </div>
                )}
              </div>
            </div>
          ) : (
            // Audio Call / Ringing Screen
            <div className="flex flex-col items-center justify-center text-center p-8">
              {/* Pulsing Avatar */}
              <div className="relative mb-6">
                <div
                  className={`absolute -inset-4 rounded-full bg-violet-500/20 animate-ping opacity-75 ${
                    callState === 'connected' ? 'hidden' : ''
                  }`}
                />
                <div className="relative w-32 h-32 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-500 border-4 border-white/20 shadow-2xl flex items-center justify-center text-4xl font-bold text-white uppercase">
                  {contact.displayName.slice(0, 2)}
                </div>
              </div>

              <h2 className="text-2xl font-bold mb-1">{contact.displayName}</h2>
              <p className="text-sm text-slate-400 mb-6 font-mono">{contact.email}</p>

              {callState === 'connected' && (
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                    <div className="flex items-center gap-1 h-4">
                      <span className="w-1 bg-emerald-400 rounded-full animate-[pulse_1s_infinite_100ms] h-3" />
                      <span className="w-1 bg-emerald-400 rounded-full animate-[pulse_1.2s_infinite_300ms] h-5" />
                      <span className="w-1 bg-emerald-400 rounded-full animate-[pulse_0.8s_infinite_200ms] h-2.5" />
                      <span className="w-1 bg-emerald-400 rounded-full animate-[pulse_1.1s_infinite_400ms] h-4" />
                      <span className="w-1 bg-emerald-400 rounded-full animate-[pulse_0.9s_infinite_150ms] h-3" />
                    </div>
                    <span className="text-xs font-semibold tracking-wide">HD Two-Way Voice Live</span>
                  </div>
                  {isMuted ? (
                    <span className="text-[11px] text-amber-300 font-medium bg-amber-500/15 px-3 py-0.5 rounded-full border border-amber-500/30">
                      Your microphone is muted
                    </span>
                  ) : (
                    <span className="text-[10px] text-emerald-300/80 font-mono">
                      Microphone Active • Direct P2P Audio
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Dedicated Hidden Audio Element to ensure incoming voice plays through speakers/headphones */}
        <audio
          ref={remoteAudioRef}
          autoPlay
          playsInline
          controls={false}
          className="hidden"
        />

        {/* Bottom Call Controls */}
        <div className="relative z-20 p-6 flex items-center justify-center gap-4 bg-gradient-to-t from-slate-950/90 to-transparent">
          {callState === 'incoming_ringing' ? (
            // Incoming Call: Accept / Decline
            <div className="flex items-center gap-8">
              <button
                onClick={onDecline}
                className="flex flex-col items-center gap-2 group focus:outline-none"
              >
                <div className="w-16 h-16 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center text-white shadow-lg shadow-rose-500/30 transition-all transform group-hover:scale-105 active:scale-95">
                  <PhoneOff size={28} />
                </div>
                <span className="text-xs text-rose-300 font-medium">Decline</span>
              </button>

              <button
                onClick={onAccept}
                className="flex flex-col items-center gap-2 group focus:outline-none"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30 transition-all transform group-hover:scale-105 active:scale-95 animate-bounce">
                  <Phone size={28} />
                </div>
                <span className="text-xs text-emerald-300 font-medium">Accept</span>
              </button>
            </div>
          ) : (
            // In-Call Controls
            <div className="flex items-center gap-3 sm:gap-4 p-2 rounded-full bg-white/10 backdrop-blur-xl border border-white/10 shadow-2xl">
              {/* Mute Mic */}
              <button
                onClick={onToggleMute}
                className={`p-3.5 rounded-full transition-all ${
                  isMuted ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30' : 'bg-white/10 text-white hover:bg-white/20'
                }`}
                title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
              >
                {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
              </button>

              {/* Speaker / Volume Toggle */}
              <button
                onClick={toggleSpeaker}
                className={`p-3.5 rounded-full transition-all ${
                  !isSpeakerOn
                    ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
                title={isSpeakerOn ? 'Mute speaker' : 'Unmute speaker'}
              >
                {!isSpeakerOn ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>

              {/* Video Toggle (if video call) */}
              {callType === 'video' && (
                <button
                  onClick={onToggleVideo}
                  className={`p-3.5 rounded-full transition-all ${
                    isVideoOff ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30' : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                  title={isVideoOff ? 'Turn camera on' : 'Turn camera off'}
                >
                  {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
                </button>
              )}

              {/* Hangup / End Call */}
              <button
                onClick={onEndCall}
                className="p-3.5 px-6 rounded-full bg-rose-500 hover:bg-rose-600 text-white font-medium flex items-center gap-2 shadow-lg shadow-rose-500/40 transition-all transform active:scale-95"
                title="End call"
              >
                <PhoneOff size={20} />
                <span className="text-sm font-semibold">End</span>
              </button>
            </div>
          )}
        </div>

      </div>
    </div>,
    document.body
  );
};
