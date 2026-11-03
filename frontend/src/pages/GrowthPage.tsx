import React, { useState, useEffect } from 'react';
import { db, type LocalHabit, type LocalTask, type LocalAIConversation } from '../db';
import {
  BarChart2,
  Flame,
  CheckCircle2,
  TrendingUp,
  BookOpen,
  Plus,
  Trash2,
  Link as LinkIcon,
  Star,
  Target,
  Brain,
  Award,
} from 'lucide-react';

type GrowthTab = 'overview' | 'habits' | 'learning';

interface LearningItem {
  id?: number;
  title: string;
  category: string;
  url?: string;
  summary: string;
  keyTakeaways: string[];
  isCompleted: boolean;
  savedAt: number;
}

export const GrowthPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<GrowthTab>('overview');
  const [habits, setHabits] = useState<LocalHabit[]>([]);
  const [tasks, setTasks] = useState<LocalTask[]>([]);
  const [learningItems, setLearningItems] = useState<LearningItem[]>([]);
  const [showAddLearning, setShowAddLearning] = useState(false);
  const [learnTitle, setLearnTitle] = useState('');
  const [learnCategory, setLearnCategory] = useState('Tech');
  const [learnUrl, setLearnUrl] = useState('');
  const [learnSummary, setLearnSummary] = useState('');
  const [learnTakeaways, setLearnTakeaways] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [h, t, l] = await Promise.all([
      db.habits.toArray(),
      db.tasks.toArray(),
      db.learningItems.toArray(),
    ]);
    setHabits(h);
    setTasks(t);
    setLearningItems(l as LearningItem[]);
  };

  const handleAddLearning = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!learnTitle.trim()) return;
    await db.learningItems.add({
      title: learnTitle.trim(),
      category: learnCategory,
      url: learnUrl.trim() || undefined,
      summary: learnSummary.trim(),
      keyTakeaways: learnTakeaways.split('\n').filter((t) => t.trim()).map((t) => t.trim()),
      isCompleted: false,
      savedAt: Date.now(),
    });
    setLearnTitle('');
    setLearnUrl('');
    setLearnSummary('');
    setLearnTakeaways('');
    setShowAddLearning(false);
    await loadData();
  };

  const handleToggleLearning = async (id: number, isCompleted: boolean) => {
    await db.learningItems.update(id, { isCompleted: !isCompleted });
    await loadData();
  };

  const handleDeleteLearning = async (id: number) => {
    await db.learningItems.delete(id);
    await loadData();
  };

  // Stats
  const today = new Date().toISOString().slice(0, 10);
  const totalHabits = habits.length;
  const habitsDoneToday = habits.filter((h) => !!h.history[today]).length;
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === 'done').length;
  const avgStreak = habits.length
    ? Math.round(habits.reduce((a, h) => a + h.streak, 0) / habits.length)
    : 0;
  const bestStreak = habits.length ? Math.max(...habits.map((h) => h.streak)) : 0;

  // Weekly completion data (last 7 days)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return {
      date: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString('en-IN', { weekday: 'short' }),
    };
  });

  const getHabitCompletionForDay = (day: string) => {
    if (!habits.length) return 0;
    const done = habits.filter((h) => !!h.history[day]).length;
    return Math.round((done / habits.length) * 100);
  };

  const learnCategories = ['Tech', 'Business', 'Science', 'Health', 'Philosophy', 'History', 'Art'];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="font-semibold text-2xl text-apna-text tracking-tight">Growth</h1>
        <p className="text-sm text-apna-muted mt-0.5">Track your progress and build meaningful habits.</p>
      </div>

      {/* Tab bar */}
      <div className="flex bg-apna-surface-2 border border-apna-border p-1 rounded-xl">
        {[
          { key: 'overview', label: 'Overview', icon: BarChart2 },
          { key: 'habits', label: 'Habits', icon: Flame },
          { key: 'learning', label: 'Learning', icon: BookOpen },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as GrowthTab)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
              activeTab === tab.key
                ? 'bg-white text-apna-text shadow-sm border border-apna-border'
                : 'text-apna-muted hover:text-apna-text'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Habits Today', value: `${habitsDoneToday}/${totalHabits}`, icon: Flame, color: 'text-amber-500', bg: 'bg-amber-50' },
              { label: 'Tasks Done', value: `${doneTasks}/${totalTasks}`, icon: CheckCircle2, color: 'text-apna-success', bg: 'bg-emerald-50' },
              { label: 'Avg Streak', value: `${avgStreak}d`, icon: TrendingUp, color: 'text-apna-accent', bg: 'bg-apna-accent-soft' },
              { label: 'Best Streak', value: `${bestStreak}d`, icon: Award, color: 'text-purple-600', bg: 'bg-purple-50' },
            ].map((stat) => (
              <div key={stat.label} className="apna-card p-4">
                <div className={`w-8 h-8 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                </div>
                <p className="text-2xl font-bold text-apna-text">{stat.value}</p>
                <p className="text-xs text-apna-muted mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Weekly habit chart */}
          <div className="apna-card p-5">
            <h3 className="text-xs font-semibold text-apna-muted uppercase tracking-widest mb-4">
              7-Day Habit Completion
            </h3>
            {habits.length === 0 ? (
              <p className="text-sm text-apna-faint text-center py-4">Add habits to see your progress chart</p>
            ) : (
              <div className="flex items-end gap-2 h-24">
                {last7Days.map(({ date, label }) => {
                  const pct = getHabitCompletionForDay(date);
                  return (
                    <div key={date} className="flex-1 flex flex-col items-center gap-1.5">
                      <div className="w-full bg-apna-surface-2 rounded-lg overflow-hidden flex flex-col justify-end" style={{ height: 72 }}>
                        <div
                          className="w-full bg-gradient-to-t from-apna-accent to-purple-400 rounded-lg transition-all duration-700"
                          style={{ height: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-apna-faint font-medium">{label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Top habits */}
          {habits.length > 0 && (
            <div className="apna-card p-5">
              <h3 className="text-xs font-semibold text-apna-muted uppercase tracking-widest mb-3">Top Streaks</h3>
              <div className="space-y-3">
                {habits
                  .sort((a, b) => b.streak - a.streak)
                  .slice(0, 4)
                  .map((h, idx) => (
                    <div key={h.id} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-apna-faint w-4">#{idx + 1}</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-medium text-apna-text truncate">{h.title}</p>
                          <span className="text-xs text-amber-500 font-bold flex items-center gap-0.5">
                            <Flame className="w-3 h-3 fill-amber-500" />
                            {h.streak}d
                          </span>
                        </div>
                        <div className="progress-bar">
                          <div
                            className="progress-fill"
                            style={{ width: `${Math.min((h.streak / 30) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* HABITS TAB */}
      {activeTab === 'habits' && (
        <div className="space-y-4">
          {habits.length === 0 ? (
            <div className="apna-card p-8 text-center">
              <Flame className="w-8 h-8 text-apna-faint mx-auto mb-3" />
              <p className="text-sm font-medium text-apna-text">No habits yet</p>
              <p className="text-xs text-apna-muted mt-1">Go to Planner → Habits to add your first habit</p>
            </div>
          ) : (
            <div className="space-y-3">
              {habits.map((h) => {
                const doneToday = !!h.history[today];
                const last14 = Array.from({ length: 14 }, (_, i) => {
                  const d = new Date();
                  d.setDate(d.getDate() - (13 - i));
                  return d.toISOString().slice(0, 10);
                });
                const weeklyDone = last7Days.filter(({ date }) => h.history[date]).length;
                return (
                  <div key={h.id} className="apna-card p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-apna-text">{h.title}</h3>
                        <p className="text-[10px] text-apna-faint mt-0.5">{h.category} · {weeklyDone}/7 this week</p>
                      </div>
                      <div className="flex items-center gap-1 text-amber-500">
                        <Flame className="w-4 h-4 fill-amber-500" />
                        <span className="text-sm font-bold">{h.streak}</span>
                      </div>
                    </div>

                    {/* 14-day heatmap grid */}
                    <div>
                      <p className="text-[10px] text-apna-faint mb-1.5">14-day history</p>
                      <div className="flex gap-1">
                        {last14.map((day) => (
                          <div
                            key={day}
                            className={`heatmap-cell flex-1 ${h.history[day] ? 'done' : ''}`}
                            title={day}
                          />
                        ))}
                      </div>
                    </div>

                    <div className={`text-[11px] font-medium text-center py-1 rounded-lg border ${
                      doneToday
                        ? 'bg-emerald-50 border-emerald-200 text-apna-success'
                        : 'bg-apna-surface-2 border-apna-border text-apna-muted'
                    }`}>
                      {doneToday ? '✓ Completed today' : 'Not done today'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* LEARNING TAB */}
      {activeTab === 'learning' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-apna-muted">
              <span className="font-semibold text-apna-text">{learningItems.filter((l) => l.isCompleted).length}</span> completed ·{' '}
              <span className="font-semibold text-apna-text">{learningItems.filter((l) => !l.isCompleted).length}</span> to explore
            </p>
            <button onClick={() => setShowAddLearning(!showAddLearning)} className="btn-primary py-2 px-3 text-xs">
              <Plus className="w-3.5 h-3.5" />
              Save Resource
            </button>
          </div>

          {showAddLearning && (
            <form onSubmit={handleAddLearning} className="apna-card p-4 space-y-3 animate-slide-up">
              <input type="text" required autoFocus placeholder="Resource title" value={learnTitle} onChange={(e) => setLearnTitle(e.target.value)} className="apna-input" />
              <div className="flex gap-2">
                <select value={learnCategory} onChange={(e) => setLearnCategory(e.target.value)} className="apna-input flex-1 text-sm">
                  {learnCategories.map((c) => <option key={c}>{c}</option>)}
                </select>
                <input type="url" placeholder="URL (optional)" value={learnUrl} onChange={(e) => setLearnUrl(e.target.value)} className="apna-input flex-1 text-sm" />
              </div>
              <textarea rows={2} placeholder="Brief summary..." value={learnSummary} onChange={(e) => setLearnSummary(e.target.value)} className="apna-input resize-none text-sm" />
              <textarea rows={3} placeholder="Key takeaways (one per line)" value={learnTakeaways} onChange={(e) => setLearnTakeaways(e.target.value)} className="apna-input resize-none text-sm" />
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowAddLearning(false)} className="btn-secondary flex-1 text-xs">Cancel</button>
                <button type="submit" className="btn-primary flex-1 text-xs">Save</button>
              </div>
            </form>
          )}

          {learningItems.length === 0 ? (
            <div className="apna-card p-8 text-center">
              <BookOpen className="w-8 h-8 text-apna-faint mx-auto mb-3" />
              <p className="text-sm font-medium text-apna-text">No learning resources saved</p>
              <p className="text-xs text-apna-muted mt-1">Save articles, books, courses, and key insights here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {learningItems.map((item) => (
                <div key={item.id} className={`apna-card p-4 group ${item.isCompleted ? 'opacity-70' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="badge badge-gray text-[10px]">{item.category}</span>
                        {item.isCompleted && <span className="badge badge-green text-[10px]">✓ Done</span>}
                      </div>
                      <h3 className={`text-sm font-semibold text-apna-text ${item.isCompleted ? 'line-through' : ''}`}>
                        {item.title}
                      </h3>
                      {item.summary && (
                        <p className="text-xs text-apna-muted mt-1 leading-relaxed line-clamp-2">{item.summary}</p>
                      )}
                      {item.keyTakeaways.length > 0 && (
                        <ul className="mt-2 space-y-0.5">
                          {item.keyTakeaways.slice(0, 2).map((t, i) => (
                            <li key={i} className="text-[11px] text-apna-muted flex items-start gap-1.5">
                              <span className="text-apna-accent mt-0.5">→</span>
                              {t}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      {item.url && (
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-apna-surface-2 text-apna-faint hover:text-apna-accent transition-colors">
                          <LinkIcon className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        onClick={() => handleToggleLearning(item.id!, item.isCompleted)}
                        className={`p-1.5 rounded-lg transition-colors ${item.isCompleted ? 'text-apna-success hover:bg-emerald-50' : 'text-apna-faint hover:text-apna-success hover:bg-emerald-50'}`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteLearning(item.id!)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-apna-faint hover:text-apna-danger transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
