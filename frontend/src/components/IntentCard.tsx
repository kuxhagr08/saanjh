import { ArrowRight, Compass, Heart, Play, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useIntent } from '../context/IntentContext';

export function IntentCard() {
  const { stats, insight, nextStep } = useIntent();
  const navigate = useNavigate();
  return (
    <section className="home-intent intent-card liquid-glass rounded-3xl p-4 sm:p-5 overflow-hidden relative w-full max-w-full">
      <div className="absolute -right-10 -top-14 w-40 h-40 rounded-full bg-violet-400/25 blur-3xl" />
      <div className="relative">
        <div className="flex items-center gap-2 text-apna-accent mb-2">
          <Compass className="w-4 h-4" /><span className="text-[11px] font-bold uppercase tracking-[0.14em]">Saanjh Motive</span>
        </div>
        <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-50">A social space that gives something back.</h2>
        <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-1.5 leading-relaxed max-w-2xl font-medium">{insight}</p>
        <div className="grid grid-cols-3 gap-2 mt-4 max-w-md w-full">
          <div className="intent-stat"><Play className="w-3.5 h-3.5" />{stats.reels}<span>reels</span></div>
          <div className="intent-stat"><Heart className="w-3.5 h-3.5" />{stats.likes}<span>liked</span></div>
          <div className="intent-stat"><Send className="w-3.5 h-3.5" />{stats.posts}<span>shared</span></div>
        </div>
        <button onClick={() => navigate('/planner')} className="mt-4 text-xs font-semibold text-apna-accent flex items-center gap-1 hover:gap-2 transition-all">{nextStep}<ArrowRight className="w-3.5 h-3.5" /></button>
      </div>
    </section>
  );
}
