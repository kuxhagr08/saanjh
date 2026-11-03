import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Mic } from 'lucide-react';

interface AudioMessagePlayerProps {
  src: string; // base64 or blob URL
  duration?: number; // duration in seconds
  isMe: boolean;
}

export const AudioMessagePlayer: React.FC<AudioMessagePlayerProps> = ({ src, duration, isMe }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration || 0);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 1.5 | 2>(1);
  const [playError, setPlayError] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio(src);
    audio.preload = 'metadata';
    audioRef.current = audio;

    audio.onloadedmetadata = () => {
      if (!duration && audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setTotalDuration(Math.round(audio.duration));
      }
    };

    audio.ontimeupdate = () => {
      setCurrentTime(audio.currentTime);
    };

    audio.onended = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    audio.onerror = () => setPlayError(true);

    return () => {
      audio.pause();
      audio.src = '';
    };
  }, [src]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      setPlayError(false);
      audioRef.current.playbackRate = playbackSpeed;
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setPlayError(true));
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const time = parseFloat(e.target.value);
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const cycleSpeed = () => {
    const nextSpeed = playbackSpeed === 1 ? 1.5 : playbackSpeed === 1.5 ? 2 : 1;
    setPlaybackSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <div className={`flex items-center gap-3 py-1.5 w-full max-w-[min(18rem,70vw)] ${isMe ? 'text-white' : 'text-slate-900 dark:text-slate-100'}`}>
      {/* Play/Pause Button */}
      <button
        onClick={togglePlay}
        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-md transition-transform transform active:scale-95 ${
          isMe
            ? 'bg-white text-violet-600 hover:bg-slate-100'
            : 'bg-violet-600 text-white hover:bg-violet-700 dark:bg-violet-500'
        }`}
        title={isPlaying ? 'Pause' : 'Play voice note'}
      >
        {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
      </button>

      {/* Progress & Waveform Slider */}
      <div className="flex-1 flex flex-col justify-center gap-1">
        <div className="relative w-full flex items-center">
          <input
            type="range"
            min={0}
            max={totalDuration || 1}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-current"
            style={{
              accentColor: isMe ? '#ffffff' : '#7c3aed',
            }}
          />
        </div>

        {/* Timestamp & Speed Indicator */}
        <div className="flex items-center justify-between text-[11px] font-mono opacity-80">
          <span>{formatTime(isPlaying ? currentTime : totalDuration)}</span>
          <button
            onClick={cycleSpeed}
            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
              isMe ? 'border-white/30 bg-white/10 hover:bg-white/20' : 'border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800'
            }`}
            title="Playback speed"
          >
            {playbackSpeed}x
          </button>
        </div>
        {playError && <span className="text-[10px] text-rose-300">This audio format could not play on this device.</span>}
      </div>

      {/* Mic icon */}
      <div className="shrink-0 opacity-70">
        <Mic size={16} />
      </div>
    </div>
  );
};
