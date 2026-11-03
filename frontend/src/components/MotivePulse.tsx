import { Sparkles } from 'lucide-react';
import { useIntent } from '../context/IntentContext';

export function MotivePulse({ className = '' }: { className?: string }) {
  const { lastAction } = useIntent();
  if (!lastAction) return null;
  return <div className={`motive-pulse liquid-glass ${className}`} role="status"><Sparkles className="w-4 h-4 text-violet-500 shrink-0" /><p>{lastAction}</p></div>;
}
