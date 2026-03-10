import { useState, useEffect, useCallback } from "react";
import { engine, engineCall } from "../lib/engine";
import type { Session, Task, TaskList, SubAgent } from "../lib/types";

interface HomePageProps {
  sessions: Session[];
  config: Record<string, any>;
  onNewSession: () => void;
  onSelectSession: (id: string) => void;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function HomePage({
  sessions,
  config,
  onNewSession,
  onSelectSession,
}: HomePageProps) {
  return (
    <div className="flex-1 overflow-y-auto bg-[var(--bg)]">
      <div className="max-w-4xl mx-auto px-8 py-10 space-y-8">
        {/* Welcome + New Session */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[var(--text)]">
              {config.profileName ? `Hey, ${config.profileName}` : "Welcome back"}
            </h1>
            <p className="text-sm text-[var(--text-dim)] mt-1">
              {sessions.length > 0
                ? `${sessions.length} session${sessions.length !== 1 ? "s" : ""}`
                : "Start your first session"}
            </p>
          </div>
          <button
            onClick={onNewSession}
            className="px-5 py-2.5 text-sm font-semibold rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white transition-colors"
          >
            New Session
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Sessions — wider column */}
          <div className="lg:col-span-3">
            <RecentSessions
              sessions={sessions}
              onSelectSession={onSelectSession}
              onNewSession={onNewSession}
            />
          </div>

          {/* Right column — Agents + Tasks */}
          <div className="lg:col-span-2 space-y-6">
            <AgentsPanel />
            <TasksPanel />
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Recent Sessions ---

function RecentSessions({
  sessions,
  onSelectSession,
  onNewSession,
}: {
  sessions: Session[];
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
}) {
  const display = sessions.slice(0, 10);

  return (
    <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] overflow-hidden">
      <div className="px-5 py-3.5 border-b border-[var(--border)]">
        <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wide">Recent Sessions</h2>
      </div>

      {display.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="text-sm text-[var(--text-dim)] mb-4">No sessions yet</p>
          <button
            onClick={onNewSession}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white transition-colors"
          >
            Start a session
          </button>
        </div>
      ) : (
        <div>
          {display.map((s, i) => (
            <button
              key={s.id}
              onClick={() => onSelectSession(s.id)}
              className={`w-full px-5 py-3 text-left hover:bg-[var(--bg-hover)] transition-colors flex items-center justify-between gap-3 ${
                i < display.length - 1 ? "border-b border-[var(--border)]/40" : ""
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-[var(--text)] truncate">
                  {s.title || "Untitled"}
                </div>
                {s.projectRoot && (
                  <div className="text-xs text-[var(--text-dim)] truncate mt-0.5">
                    {s.projectRoot}
                  </div>
                )}
              </div>
              <span className="text-xs text-[var(--text-dim)] shrink-0">
                {timeAgo((s.lastUsed || s.updated || s.created)!)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Agents Panel ---

function AgentsPanel() {
  const [agents, setAgents] = useState<SubAgent[]>([]);

  const refresh = useCallback(async () => {
    try {
      const data = await engine.listAgents() as unknown as SubAgent[];
      setAgents(data || []);
    } catch { /* */ }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleToggle = async (agent: SubAgent) => {
    try {
      if (agent.enabled) {
        await engine.disableAgent(agent.name);
      } else {
        await engine.enableAgent(agent.name);
      }
      await refresh();
    } catch { /* */ }
  };

  return (
    <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] overflow-hidden">
      <div className="px-5 py-3.5 border-b border-[var(--border)]">
        <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wide">Agents</h2>
      </div>

      <div className="px-5 py-3">
        {agents.length === 0 ? (
          <p className="text-sm text-[var(--text-dim)] py-1">
            No sub-agents configured
          </p>
        ) : (
          <div className="space-y-2">
            {agents.map((a) => (
              <div
                key={a.id}
                className={`flex items-center gap-3 py-2 px-3 rounded-lg border transition-colors ${
                  a.enabled
                    ? "border-[var(--border)] bg-[var(--bg)]/50"
                    : "border-[var(--border)]/50 bg-[var(--bg)]/20 opacity-50"
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    a.enabled ? "bg-[var(--success)]" : "bg-[var(--text-dim)]"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-[var(--text)] truncate">
                    {a.name}
                  </div>
                  <div className="text-xs text-[var(--text-dim)] truncate">
                    {a.role}
                  </div>
                  {a.model && (
                    <div className="text-xs text-[var(--accent)] truncate mt-0.5">
                      {a.model}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleToggle(a)}
                  className={`text-xs px-2 py-1 rounded transition-colors ${
                    a.enabled
                      ? "text-[var(--text-dim)] hover:text-[var(--warning)]"
                      : "text-[var(--text-dim)] hover:text-[var(--success)]"
                  }`}
                  title={a.enabled ? "Disable" : "Enable"}
                >
                  {a.enabled ? "Disable" : "Enable"}
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-[var(--text-dim)] mt-3">
          Manage agents in the Agents tab
        </p>
      </div>
    </div>
  );
}

// --- Tasks Panel ---

function TasksPanel() {
  const [tasks, setTasks] = useState<TaskList>({ active: [], completed: [] });
  const [newTask, setNewTask] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const data = await engine.listTasks() as unknown as TaskList;
      setTasks(data || { active: [], completed: [] });
    } catch { /* */ }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleAdd = async () => {
    const desc = newTask.trim();
    if (!desc) return;
    try {
      await engine.addTask(desc);
      setNewTask("");
      await refresh();
    } catch { /* */ }
  };

  const handleComplete = async (index: number) => {
    try { await engine.completeTask(index); await refresh(); } catch { /* */ }
  };

  const handleRemove = async (index: number) => {
    try { await engine.removeTask(index); await refresh(); } catch { /* */ }
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] overflow-hidden">
      <div className="px-5 py-3.5 border-b border-[var(--border)]">
        <h2 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wide">Tasks</h2>
      </div>

      <div className="px-5 py-3">
        {tasks.active.length === 0 && (
          <p className="text-sm text-[var(--text-dim)] py-1">No active tasks</p>
        )}

        {tasks.active.map((t: Task, i: number) => {
          const overdue = t.dueDate && t.dueDate < today;
          const dueToday = t.dueDate && t.dueDate === today;
          return (
            <div key={i} className="flex items-start gap-2.5 py-2 group">
              <button
                onClick={() => handleComplete(i + 1)}
                className="mt-0.5 w-4 h-4 rounded border border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--accent)]/20 transition-colors shrink-0"
                title="Complete"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-[var(--text)] leading-snug">{t.description}</div>
                {t.dueDate && (
                  <div className={`text-xs mt-0.5 ${overdue ? "text-[var(--error)]" : dueToday ? "text-[var(--warning)]" : "text-[var(--text-dim)]"}`}>
                    {overdue ? "Overdue" : dueToday ? "Due today" : `Due ${t.dueDate}`}
                  </div>
                )}
              </div>
              <button
                onClick={() => handleRemove(i + 1)}
                className="opacity-0 group-hover:opacity-100 text-[var(--text-dim)] hover:text-[var(--error)] text-xs transition-opacity mt-0.5"
                title="Remove"
              >
                x
              </button>
            </div>
          );
        })}

        {/* Add task */}
        <div className="flex gap-2 pt-2">
          <input
            type="text"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            placeholder="Add task..."
            className="flex-1 px-3 py-1.5 text-sm rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)]"
          />
          <button
            onClick={handleAdd}
            disabled={!newTask.trim()}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white transition-colors disabled:opacity-30"
          >
            Add
          </button>
        </div>

        {/* Completed */}
        {tasks.completed.length > 0 && (
          <div className="pt-3">
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className="text-xs text-[var(--text-dim)] hover:text-[var(--text-muted)] transition-colors"
            >
              {showCompleted ? "\u25BC" : "\u25B6"} {tasks.completed.length} completed
            </button>
            {showCompleted && (
              <div className="mt-1.5 space-y-0.5">
                {tasks.completed.slice(-8).map((t: Task, i: number) => (
                  <div key={i} className="text-xs text-[var(--text-dim)] line-through truncate py-0.5">
                    {t.description}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
