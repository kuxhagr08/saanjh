import React, { useState, useEffect, useRef } from 'react';
import { db, type LocalTask, type LocalHabit } from '../db';
import {
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  Clock,
  Flame,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Zap,
  Target,
  Calendar,
  SlidersHorizontal,
  X,
  ChevronDown,
  CheckSquare,
} from 'lucide-react';

type PlannerTab = 'tasks' | 'pomodoro' | 'habits';

const POMODORO_DURATION = 25 * 60;
const BREAK_DURATION = 5 * 60;

export const PlannerPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<PlannerTab>('tasks');
  const [tasks, setTasks] = useState<LocalTask[]>([]);
  const [habits, setHabits] = useState<LocalHabit[]>([]);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showAddHabit, setShowAddHabit] = useState(false);

  // Task form
  const [taskTitle, setTaskTitle] = useState('');
  const [taskPriority, setTaskPriority] = useState<LocalTask['priority']>('medium');
  const [taskDue, setTaskDue] = useState('');

  // Habit form
  const [habitTitle, setHabitTitle] = useState('');
  const [habitCategory, setHabitCategory] = useState('General');

  // Pomodoro
  const [pomodoroTime, setPomodoroTime] = useState(POMODORO_DURATION);
  const [isRunning, setIsRunning] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [completedSessions, setCompletedSessions] = useState(0);
  const [ambientSound, setAmbientSound] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Brain dump
  const [brainDumpText, setBrainDumpText] = useState('');
  const [extractedItems, setExtractedItems] = useState<Array<{ title: string; priority: string; due?: string }>>([]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setPomodoroTime((t) => {
          if (t <= 1) {
            clearInterval(intervalRef.current!);
            setIsRunning(false);
            if (!isBreak) {
              setCompletedSessions((s) => s + 1);
              setIsBreak(true);
              return BREAK_DURATION;
            } else {
              setIsBreak(false);
              return POMODORO_DURATION;
            }
          }
          return t - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, isBreak]);

  const toggleAmbientSound = () => {
    if (ambientSound) {
      audioCtxRef.current?.close();
      audioCtxRef.current = null;
      setAmbientSound(false);
    } else {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = data[i];
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = 0.12;
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start();
      setAmbientSound(true);
    }
  };

  const loadData = async () => {
    const [t, h] = await Promise.all([db.tasks.toArray(), db.habits.toArray()]);
    setTasks(t.sort((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
    }));
    setHabits(h);
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;
    await db.tasks.add({
      title: taskTitle.trim(),
      status: 'todo',
      priority: taskPriority,
      dueDate: taskDue || undefined,
      tags: [],
      createdAt: Date.now(),
    });
    setTaskTitle('');
    setTaskPriority('medium');
    setTaskDue('');
    setShowAddTask(false);
    await loadData();
  };

  const handleToggleTask = async (task: LocalTask) => {
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    await db.tasks.update(task.id!, {
      status: newStatus,
      ...(newStatus === 'done' ? { completedAt: Date.now() } : {}),
    });
    await loadData();
  };

  const handleDeleteTask = async (id: number) => {
    await db.tasks.delete(id);
    await loadData();
  };

  const handleAddHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!habitTitle.trim()) return;
    await db.habits.add({
      title: habitTitle.trim(),
      category: habitCategory,
      targetPerWeek: 7,
      streak: 0,
      history: {},
      createdAt: Date.now(),
    });
    setHabitTitle('');
    setShowAddHabit(false);
    await loadData();
  };

  const handleToggleHabitToday = async (habit: LocalHabit) => {
    const today = new Date().toISOString().slice(0, 10);
    const done = !!habit.history[today];
    const updatedHistory = { ...habit.history };
    if (done) {
      delete updatedHistory[today];
    } else {
      updatedHistory[today] = true;
    }
    // Compute streak
    let streak = 0;
    const d = new Date();
    while (true) {
      const key = d.toISOString().slice(0, 10);
      if (updatedHistory[key]) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else break;
    }
    await db.habits.update(habit.id!, { history: updatedHistory, streak });
    await loadData();
  };

  const parseBrainDump = () => {
    const lines = brainDumpText.split(/[.!?\n]+/).filter((s) => s.trim().length > 3);
    const extracted = lines.map((line) => {
      const trimmed = line.trim();
      let priority = 'medium';
      let due: string | undefined;
      if (/urgent|asap|immediately|critical/i.test(trimmed)) priority = 'urgent';
      else if (/important|soon|need to/i.test(trimmed)) priority = 'high';
      else if (/maybe|sometime|later/i.test(trimmed)) priority = 'low';
      if (/today|tonight/i.test(trimmed)) due = 'Today';
      else if (/tomorrow/i.test(trimmed)) due = 'Tomorrow';
      else if (/monday/i.test(trimmed)) due = 'Monday';
      else if (/next week/i.test(trimmed)) due = 'Next week';
      return { title: trimmed.slice(0, 80), priority, due };
    });
    setExtractedItems(extracted);
  };

  const saveExtractedTasks = async () => {
    for (const item of extractedItems) {
      await db.tasks.add({
        title: item.title,
        status: 'todo',
        priority: item.priority as any,
        dueDate: item.due,
        tags: ['brain-dump'],
        createdAt: Date.now(),
      });
    }
    setBrainDumpText('');
    setExtractedItems([]);
    await loadData();
    setActiveTab('tasks');
  };

  const today = new Date().toISOString().slice(0, 10);
  const todayTasks = tasks.filter((t) => t.status !== 'done');
  const doneTasks = tasks.filter((t) => t.status === 'done');

  const priorityConfig = {
    urgent: { label: 'Urgent', dot: 'priority-dot-urgent', badge: 'badge-red' },
    high: { label: 'High', dot: 'priority-dot-high', badge: 'badge-amber' },
    medium: { label: 'Medium', dot: 'priority-dot-medium', badge: 'badge-violet' },
    low: { label: 'Low', dot: 'priority-dot-low', badge: 'badge-gray' },
  };

  const pomodoroProgress = isBreak
    ? 1 - pomodoroTime / BREAK_DURATION
    : 1 - pomodoroTime / POMODORO_DURATION;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="font-semibold text-2xl text-apna-text tracking-tight">Planner</h1>
        <p className="text-sm text-apna-muted mt-0.5">Tasks, focus sessions, and mindful habits.</p>
      </div>

      {/* Tab bar */}
      <div className="flex bg-apna-surface-2 border border-apna-border p-1 rounded-xl">
        {[
          { key: 'tasks', label: 'Tasks', icon: CheckSquare },
          { key: 'pomodoro', label: 'Focus', icon: Target },
          { key: 'habits', label: 'Habits', icon: Flame },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as PlannerTab)}
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

      {/* TASKS TAB */}
      {activeTab === 'tasks' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-apna-muted">
              <span className="font-semibold text-apna-text">{todayTasks.length}</span> active ·{' '}
              <span className="font-semibold text-apna-success">{doneTasks.length}</span> done
            </p>
            <button
              onClick={() => setShowAddTask(!showAddTask)}
              className="btn-primary py-2 px-3 text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Task
            </button>
          </div>

          {/* Add task form */}
          {showAddTask && (
            <form onSubmit={handleAddTask} className="apna-card p-4 space-y-3 animate-slide-up">
              <input
                type="text"
                required
                autoFocus
                placeholder="What needs to get done?"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                className="apna-input"
              />
              <div className="flex gap-2">
                <select
                  value={taskPriority}
                  onChange={(e) => setTaskPriority(e.target.value as any)}
                  className="apna-input flex-1 text-xs"
                >
                  <option value="urgent">🔴 Urgent</option>
                  <option value="high">🟠 High</option>
                  <option value="medium">🟣 Medium</option>
                  <option value="low">⚪ Low</option>
                </select>
                <input
                  type="text"
                  placeholder="Due (e.g. Today)"
                  value={taskDue}
                  onChange={(e) => setTaskDue(e.target.value)}
                  className="apna-input flex-1 text-xs"
                />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowAddTask(false)} className="btn-secondary flex-1 text-xs">Cancel</button>
                <button type="submit" className="btn-primary flex-1 text-xs">Add Task</button>
              </div>
            </form>
          )}

          {/* Brain dump CTA */}
          <details className="apna-card overflow-hidden">
            <summary className="p-4 flex items-center gap-2 cursor-pointer text-sm font-medium text-apna-text hover:bg-apna-surface-2 transition-colors">
              <Zap className="w-4 h-4 text-apna-accent" />
              Brain Dump
              <span className="text-xs text-apna-faint ml-auto">Extract tasks from free text</span>
            </summary>
            <div className="p-4 pt-0 space-y-3">
              <textarea
                rows={4}
                placeholder="Pour your thoughts here... e.g. 'Need to pay electricity bill urgent today. Book dentist appointment next Monday. Maybe plan trip sometime.'"
                value={brainDumpText}
                onChange={(e) => setBrainDumpText(e.target.value)}
                className="apna-input resize-none text-sm"
              />
              <button
                onClick={parseBrainDump}
                disabled={!brainDumpText.trim()}
                className="btn-primary text-xs py-2"
              >
                <Zap className="w-3.5 h-3.5" />
                Extract Tasks
              </button>
              {extractedItems.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-apna-success">{extractedItems.length} tasks extracted</p>
                    <button onClick={saveExtractedTasks} className="text-xs text-apna-accent font-medium hover:underline">
                      Save all to planner →
                    </button>
                  </div>
                  {extractedItems.map((item, i) => (
                    <div key={i} className="flex items-center justify-between px-3 py-2 bg-apna-surface-2 rounded-xl text-xs">
                      <span className="text-apna-text truncate flex-1">{item.title}</span>
                      <span className={`badge ${priorityConfig[item.priority as keyof typeof priorityConfig]?.badge || 'badge-gray'} ml-2`}>
                        {item.priority}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </details>

          {/* Active tasks */}
          {todayTasks.length === 0 && doneTasks.length === 0 ? (
            <div className="apna-card p-8 text-center">
              <CheckCircle2 className="w-8 h-8 text-apna-faint mx-auto mb-3" />
              <p className="text-sm font-medium text-apna-text">No tasks yet</p>
              <p className="text-xs text-apna-muted mt-1">Add your first task or use Brain Dump above</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {todayTasks.map((task) => {
                const pc = priorityConfig[task.priority] || priorityConfig.medium;
                return (
                  <div key={task.id} className="task-item group">
                    <button onClick={() => handleToggleTask(task)} className="shrink-0 mt-0.5">
                      <Circle className="w-4 h-4 text-apna-faint hover:text-apna-accent transition-colors" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-apna-text font-medium">{task.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${pc.dot}`} />
                        <span className="text-[10px] text-apna-faint">{pc.label}</span>
                        {task.dueDate && (
                          <span className="text-[10px] text-apna-faint flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            {task.dueDate}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteTask(task.id!)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 text-apna-faint hover:text-apna-danger transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Done tasks */}
          {doneTasks.length > 0 && (
            <details>
              <summary className="text-xs text-apna-faint cursor-pointer font-medium hover:text-apna-muted">
                {doneTasks.length} completed ↓
              </summary>
              <div className="mt-2 space-y-1.5">
                {doneTasks.map((task) => (
                  <div key={task.id} className="task-item task-done opacity-60">
                    <button onClick={() => handleToggleTask(task)} className="shrink-0 mt-0.5">
                      <CheckCircle2 className="w-4 h-4 text-apna-success" />
                    </button>
                    <p className="task-title text-sm text-apna-muted flex-1">{task.title}</p>
                    <button onClick={() => handleDeleteTask(task.id!)} className="p-1.5 text-apna-faint hover:text-apna-danger">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* POMODORO TAB */}
      {activeTab === 'pomodoro' && (
        <div className="space-y-4 max-w-sm mx-auto text-center">
          <div className="apna-card p-8 space-y-6">
            <div>
              <span className="badge badge-violet text-xs">
                {isBreak ? '☕ Break Time' : '🎯 Deep Work'}
              </span>
              {completedSessions > 0 && (
                <p className="text-xs text-apna-faint mt-1">{completedSessions} sessions today</p>
              )}
            </div>

            {/* Timer */}
            <div className="relative inline-flex items-center justify-center">
              <svg className="w-44 h-44 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="#F2F0EC" strokeWidth="4" />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke={isBreak ? '#1A9055' : '#6A4CFF'}
                  strokeWidth="4"
                  strokeDasharray={`${2 * Math.PI * 45}`}
                  strokeDashoffset={`${2 * Math.PI * 45 * (1 - pomodoroProgress)}`}
                  strokeLinecap="round"
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="mono-text text-4xl font-bold text-apna-text">
                  {String(Math.floor(pomodoroTime / 60)).padStart(2, '0')}:{String(pomodoroTime % 60).padStart(2, '0')}
                </span>
                <span className="text-xs text-apna-faint mt-1">
                  {isBreak ? 'break' : 'focus'}
                </span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => {
                  setIsRunning(false);
                  setPomodoroTime(isBreak ? BREAK_DURATION : POMODORO_DURATION);
                }}
                className="w-11 h-11 rounded-xl bg-apna-surface-2 border border-apna-border text-apna-muted hover:text-apna-text flex items-center justify-center transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsRunning(!isRunning)}
                className="w-14 h-14 rounded-2xl bg-apna-accent text-white flex items-center justify-center shadow-[0_4px_16px_rgba(106,76,255,0.4)] hover:bg-apna-accent-ink transition-all active:scale-95"
              >
                {isRunning ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
              </button>
              <button
                onClick={toggleAmbientSound}
                className={`w-11 h-11 rounded-xl border flex items-center justify-center transition-colors ${
                  ambientSound
                    ? 'bg-emerald-50 border-emerald-200 text-apna-success'
                    : 'bg-apna-surface-2 border-apna-border text-apna-muted hover:text-apna-text'
                }`}
                title="Brown noise soundscape"
              >
                {ambientSound ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <p className="text-xs text-apna-faint">
            25 min deep work → 5 min mindful break. Brown noise helps you focus.
          </p>
        </div>
      )}

      {/* HABITS TAB */}
      {activeTab === 'habits' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-apna-muted">
              <span className="font-semibold text-apna-text">{habits.length}</span> habits tracked
            </p>
            <button onClick={() => setShowAddHabit(!showAddHabit)} className="btn-primary py-2 px-3 text-xs">
              <Plus className="w-3.5 h-3.5" />
              Add Habit
            </button>
          </div>

          {showAddHabit && (
            <form onSubmit={handleAddHabit} className="apna-card p-4 space-y-3 animate-slide-up">
              <input
                type="text"
                required
                autoFocus
                placeholder="Habit name e.g. Morning meditation"
                value={habitTitle}
                onChange={(e) => setHabitTitle(e.target.value)}
                className="apna-input"
              />
              <select
                value={habitCategory}
                onChange={(e) => setHabitCategory(e.target.value)}
                className="apna-input text-sm"
              >
                {['Mindfulness', 'Health', 'Growth', 'Fitness', 'Work', 'Creative', 'General'].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowAddHabit(false)} className="btn-secondary flex-1 text-xs">Cancel</button>
                <button type="submit" className="btn-primary flex-1 text-xs">Add Habit</button>
              </div>
            </form>
          )}

          {habits.length === 0 ? (
            <div className="apna-card p-8 text-center">
              <Flame className="w-8 h-8 text-apna-faint mx-auto mb-3" />
              <p className="text-sm font-medium text-apna-text">No habits yet</p>
              <p className="text-xs text-apna-muted mt-1">Start building a mindful daily routine</p>
            </div>
          ) : (
            <div className="space-y-3">
              {habits.map((h) => {
                const doneToday = !!h.history[today];
                const last7 = Array.from({ length: 7 }, (_, i) => {
                  const d = new Date();
                  d.setDate(d.getDate() - (6 - i));
                  return d.toISOString().slice(0, 10);
                });
                return (
                  <div key={h.id} className="apna-card p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${doneToday ? 'bg-apna-success/10' : 'bg-apna-surface-2'}`}>
                          <Flame className={`w-4.5 h-4.5 ${doneToday ? 'text-apna-success' : 'text-apna-faint'}`} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-apna-text">{h.title}</p>
                          <p className="text-[10px] text-apna-faint">{h.category}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-amber-500">
                        <Flame className="w-3.5 h-3.5 fill-amber-500" />
                        <span className="text-xs font-bold">{h.streak}d</span>
                      </div>
                    </div>

                    {/* 7-day heatmap */}
                    <div className="flex items-center gap-1.5">
                      {last7.map((day) => (
                        <div
                          key={day}
                          className={`heatmap-cell flex-1 ${h.history[day] ? 'done' : ''}`}
                          title={day}
                        />
                      ))}
                    </div>

                    <button
                      onClick={() => handleToggleHabitToday(h)}
                      className={`w-full py-2 rounded-xl text-xs font-semibold border transition-all ${
                        doneToday
                          ? 'bg-emerald-50 border-emerald-200 text-apna-success'
                          : 'bg-apna-surface-2 border-apna-border text-apna-muted hover:text-apna-text hover:border-apna-accent'
                      }`}
                    >
                      {doneToday ? '✓ Done today' : 'Mark as done today'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
