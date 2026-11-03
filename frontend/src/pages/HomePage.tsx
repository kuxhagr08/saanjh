import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, type LocalTask, type LocalHabit, type LocalNote } from '../db';
import {
  CheckCircle2,
  Clock,
  Sparkles,
  Flame,
  ArrowRight,
  Shield,
  MessageSquare,
  Lock,
  Plus,
  FileText,
  BarChart2,
  Zap,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { IntentCard } from '../components/IntentCard';

export const HomePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<LocalTask[]>([]);
  const [habits, setHabits] = useState<LocalHabit[]>([]);
  const [notes, setNotes] = useState<LocalNote[]>([]);
  const [askAiText, setAskAiText] = useState('');

  useEffect(() => {
    async function loadData() {
      const [allTasks, allHabits, allNotes] = await Promise.all([
        db.tasks.toArray(),
        db.habits.toArray(),
        db.notes.orderBy('updatedAt').reverse().limit(3).toArray(),
      ]);
      setTasks(allTasks.filter((t) => t.status !== 'done').slice(0, 4));
      setHabits(allHabits.slice(0, 4));
      setNotes(allNotes);
    }
    loadData();
  }, []);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 5) return 'Late night,';
    if (hour < 12) return 'Good morning,';
    if (hour < 17) return 'Good afternoon,';
    if (hour < 21) return 'Good evening,';
    return 'Good night,';
  };

  const todayFormatted = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === 'done').length;

  const today = new Date().toISOString().slice(0, 10);
  const habitsCompletedToday = habits.filter((h) => !!h.history[today]).length;

  const priorityConfig: Record<string, { label: string; dot: string }> = {
    urgent: { label: 'Urgent', dot: 'priority-dot-urgent' },
    high: { label: 'High', dot: 'priority-dot-high' },
    medium: { label: 'Medium', dot: 'priority-dot-medium' },
    low: { label: 'Low', dot: 'priority-dot-low' },
  };

  const handleAskAi = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/ai');
  };

  const modules = [
    { to: '/messages', icon: MessageSquare, label: 'Chats', desc: 'E2E encrypted', color: 'text-indigo-500', bg: 'bg-indigo-50 border-indigo-100' },
    { to: '/vault', icon: Lock, label: 'Vault', desc: 'Private files', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
    { to: '/planner', icon: CheckCircle2, label: 'Planner', desc: 'Tasks & focus', color: 'text-apna-success', bg: 'bg-emerald-50 border-emerald-100' },
    { to: '/growth', icon: BarChart2, label: 'Growth', desc: 'Habit streaks', color: 'text-rose-500', bg: 'bg-rose-50 border-rose-100' },
    { to: '/ai', icon: Sparkles, label: 'AI', desc: 'Private, BYOK', color: 'text-apna-accent', bg: 'bg-apna-accent-soft border-purple-100' },
    { to: '/security', icon: Shield, label: 'Security', desc: 'Keys & privacy', color: 'text-sky-500', bg: 'bg-sky-50 border-sky-100' },
  ];

  return (
    <div className="space-y-5 px-4 pb-4 animate-fade-in w-full max-w-full overflow-hidden">
      {/* Greeting Header */}
      <div className="pb-4 border-b border-apna-border w-full overflow-hidden">
        <p className="text-xs text-zinc-600 dark:text-zinc-400 font-semibold mb-1">{todayFormatted}</p>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 break-words leading-tight">
          {getGreeting()}{' '}
          <span className="text-apna-accent italic">{user?.display_name || user?.username || 'friend'}</span>
        </h1>

        {/* Quick stats row */}
        <div className="flex flex-wrap gap-2 mt-4">
          <div className="flex items-center gap-2 bg-white dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 rounded-xl px-3 py-2 text-xs shadow-xs">
            <CheckCircle2 className="w-3.5 h-3.5 text-apna-success" />
            <span className="text-zinc-900 dark:text-zinc-100 font-semibold">{doneTasks}/{totalTasks} tasks</span>
          </div>
          <div className="flex items-center gap-2 bg-white dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 rounded-xl px-3 py-2 text-xs shadow-xs">
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-zinc-900 dark:text-zinc-100 font-semibold">{habitsCompletedToday}/{habits.length} habits today</span>
          </div>
          <div className="flex items-center gap-2 bg-white dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 rounded-xl px-3 py-2 text-xs shadow-xs">
            <Shield className="w-3.5 h-3.5 text-apna-success" />
            <span className="text-emerald-700 dark:text-emerald-400 font-bold">Vault encrypted</span>
          </div>
        </div>
      </div>

      <IntentCard />

      {/* AI Ask Box */}
      <form onSubmit={handleAskAi} className="apna-card p-4 flex items-center gap-3 apna-card-hover cursor-text w-full overflow-hidden" onClick={() => navigate('/ai')}>
        <div className="w-8 h-8 rounded-lg bg-apna-accent-soft flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4 text-apna-accent" />
        </div>
        <input
          type="text"
          value={askAiText}
          onChange={(e) => setAskAiText(e.target.value)}
          placeholder="Ask your private AI anything..."
          className="flex-1 bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 dark:placeholder:text-zinc-400 font-medium outline-none"
          readOnly
          onClick={(e) => { e.stopPropagation(); navigate('/ai'); }}
        />
        <ArrowRight className="w-4 h-4 text-zinc-500 dark:text-zinc-400 shrink-0" />
      </form>

      {/* Module Grid */}
      <div className="w-full overflow-hidden">
        <h2 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-widest mb-3">Your Modules</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {modules.map((m) => (
            <Link
              key={m.to}
              to={m.to}
              className={`apna-card apna-card-hover p-3.5 flex flex-col gap-2 border ${m.bg} overflow-hidden`}
            >
              <m.icon className={`w-5 h-5 ${m.color}`} />
              <div className="min-w-0">
                <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">{m.label}</p>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 font-medium truncate">{m.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Today's Tasks */}
      {tasks.length > 0 && (
        <div className="w-full overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-widest">Today's Focus</h2>
            <Link to="/planner" className="text-xs text-apna-accent font-semibold flex items-center gap-1 hover:underline">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {tasks.map((task) => {
              const pc = priorityConfig[task.priority] || priorityConfig.medium;
              return (
                <div key={task.id} className="task-item">
                  <div className={`w-2 h-2 rounded-full mt-1 shrink-0 ${pc.dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-zinc-900 dark:text-zinc-100 font-semibold truncate">{task.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {task.dueDate && (
                        <span className="text-[11px] text-zinc-600 dark:text-zinc-400 font-medium flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          {task.dueDate}
                        </span>
                      )}
                      {task.status === 'in_progress' && (
                        <span className="badge badge-violet">In progress</span>
                      )}
                    </div>
                  </div>
                  <Zap className="w-4 h-4 text-zinc-400 dark:text-zinc-500 shrink-0" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Habits */}
      {habits.length > 0 && (
        <div className="w-full overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-widest">Habit Streaks</h2>
            <Link to="/growth" className="text-xs text-apna-accent font-semibold flex items-center gap-1 hover:underline">
              All habits <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {habits.map((h) => {
              const doneToday = !!h.history[today];
              return (
                <div key={h.id} className={`apna-card p-3.5 flex items-center gap-3 overflow-hidden ${doneToday ? 'border-apna-success/30 bg-emerald-50 dark:bg-emerald-950/20' : ''}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${doneToday ? 'bg-apna-success/10' : 'bg-apna-surface-2'}`}>
                    <Flame className={`w-4.5 h-4.5 ${doneToday ? 'text-apna-success' : 'text-zinc-400 dark:text-zinc-500'}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">{h.title}</p>
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400 font-semibold">{h.streak}d streak</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Notes */}
      {notes.length > 0 && (
        <div className="w-full overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-widest">Recent Notes</h2>
            <Link to="/vault" className="text-xs text-apna-accent font-semibold flex items-center gap-1 hover:underline">
              All notes <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {notes.map((note) => (
              <div key={note.id} className="apna-card apna-card-hover p-3.5 cursor-pointer overflow-hidden" onClick={() => navigate('/vault')}>
                <div className="flex items-start gap-3">
                  <FileText className="w-4 h-4 text-apna-warn shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">{note.title}</p>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5 truncate">{note.content}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {tasks.length === 0 && habits.length === 0 && notes.length === 0 && (
        <div className="apna-card p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-apna-accent-soft mx-auto flex items-center justify-center mb-4">
            <Sparkles className="w-7 h-7 text-apna-accent" />
          </div>
          <h3 className="font-semibold text-apna-text mb-1">Your space is ready</h3>
          <p className="text-sm text-apna-muted mb-5 max-w-xs mx-auto">
            Add your first task, habit, or note to get started. Everything stays private on your device.
          </p>
          <Link to="/planner" className="btn-primary inline-flex">
            <Plus className="w-4 h-4" />
            Add First Task
          </Link>
        </div>
      )}
    </div>
  );
};
