import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { db } from '../db';

type IntentStats = { reels: number; likes: number; saves: number; posts: number; chats: number; focusMinutes: number };
type IntentContextValue = {
  stats: IntentStats;
  record: (kind: keyof IntentStats, amount?: number) => void;
  insight: string;
  nextStep: string;
  lastAction: string | null;
};

const initial: IntentStats = { reels: 0, likes: 0, saves: 0, posts: 0, chats: 0, focusMinutes: 0 };
const IntentContext = createContext<IntentContextValue | null>(null);

function makeInsight(stats: IntentStats) {
  if (stats.reels >= 500) return 'You have explored 500 reels. Your attention is valuable: turn one saved idea into a small action today.';
  if (stats.saves >= 5) return 'Your saved ideas are forming a theme. Give one of them a place in today’s plan.';
  if (stats.posts >= 1 && stats.likes >= 3) return 'You are contributing, not only consuming. Keep sharing thoughts that invite a useful conversation.';
  if (stats.chats >= 3) return 'Your conversations are active. A thoughtful check-in can make the next message meaningful.';
  return 'Collect less, carry more. Every interaction here can become a small step in your real life.';
}

export function IntentProvider({ children }: { children: React.ReactNode }) {
  const [stats, setStats] = useState<IntentStats>(initial);
  const [lastAction, setLastAction] = useState<string | null>(null);

  useEffect(() => {
    db.settings.get('apna_intent_stats').then((item) => {
      if (item?.value) setStats({ ...initial, ...item.value });
    }).catch(() => undefined);
  }, []);

  const record = (kind: keyof IntentStats, amount = 1) => {
    setStats((previous) => {
      const next = { ...previous, [kind]: previous[kind] + amount };
      db.settings.put({ key: 'apna_intent_stats', value: next }).catch(() => undefined);
      return next;
    });
    const messages: Partial<Record<keyof IntentStats, string>> = {
      likes: 'You liked an idea. Keep the feeling, then choose one thing to try.',
      saves: 'Saved for later. Saanjh will help you turn it into a small plan.',
      posts: 'Your thought is now part of a calmer conversation.',
      reels: 'A pause makes every scroll intentional.',
      chats: 'A real conversation is a meaningful use of attention.',
    };
    if (messages[kind]) {
      setLastAction(messages[kind]!);
      window.setTimeout(() => setLastAction(null), 3600);
    }
  };

  const value = useMemo(() => ({
    stats,
    record,
    insight: makeInsight(stats),
    nextStep: stats.saves > 0 ? 'Open Planner and create a 10 minute task from a saved idea.' : 'Save something that you want to practise, then bring it into your Planner.',
    lastAction,
  }), [stats, lastAction]);
  return <IntentContext.Provider value={value}>{children}</IntentContext.Provider>;
}

export function useIntent() {
  const value = useContext(IntentContext);
  if (!value) throw new Error('useIntent must be used inside IntentProvider');
  return value;
}
