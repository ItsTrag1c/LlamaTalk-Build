import { useState, useRef, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { Session } from "../lib/types";

type SidebarTab = "sessions" | "tools" | "tasks" | "activity" | "settings";

interface SidebarProps {
  sessions: Session[];
  currentSessionId: string | null;
  model: string;
  config: Record<string, any>;
  availableModels: string[];
  onNewSession: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, title: string) => void;
  onSelectModel: (model: string) => void;
  onRefreshModels: () => void;
  onAction: (action: string, payload?: any) => void;
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
  return `${days}d ago`;
}

const TAB_ICONS: Record<SidebarTab, string> = {
  sessions: "💬",
  tools: "🔧",
  tasks: "✅",
  activity: "📋",
  settings: "⚙️",
};

const TAB_LABELS: Record<SidebarTab, string> = {
  sessions: "Sessions",
  tools: "Tools",
  tasks: "Tasks",
  activity: "Activity",
  settings: "Settings",
};

export function Sidebar({
  sessions,
  currentSessionId,
  model,
  config,
  availableModels,
  onNewSession,
  onSelectSession,
  onDeleteSession,
  onRenameSession,
  onSelectModel,
  onRefreshModels,
  onAction,
}: SidebarProps) {
  const [tab, setTab] = useState<SidebarTab>("sessions");

  return (
    <div className="w-80 h-full flex flex-col bg-[var(--bg-surface)] border-r border-[var(--border)] shrink-0">
      {/* Model selector */}
      <ModelSelector
        model={model}
        availableModels={availableModels}
        onSelectModel={onSelectModel}
        onRefresh={onRefreshModels}
      />

      {/* Tab bar */}
      <div className="flex px-3 gap-1 py-2.5">
        {(["sessions", "tools", "tasks", "activity", "settings"] as SidebarTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-center rounded-lg text-base transition-colors ${
              tab === t
                ? "bg-[var(--bg-hover)] text-[var(--text)]"
                : "text-[var(--text-dim)] hover:text-[var(--text-muted)] hover:bg-[var(--bg)]/50"
            }`}
            title={TAB_LABELS[t]}
          >
            {TAB_ICONS[t]}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-4">
        {tab === "sessions" && (
          <SessionsTab
            sessions={sessions}
            currentSessionId={currentSessionId}
            onNewSession={onNewSession}
            onSelectSession={onSelectSession}
            onDeleteSession={onDeleteSession}
            onRenameSession={onRenameSession}
          />
        )}
        {tab === "tools" && <ToolsTab />}
        {tab === "tasks" && <TasksTab />}
        {tab === "activity" && <ActivityTab onAction={onAction} />}
        {tab === "settings" && <SettingsTab config={config} onAction={onAction} />}
      </div>
    </div>
  );
}

// --- Model Selector ---

function ModelSelector({
  model,
  availableModels,
  onSelectModel,
  onRefresh,
}: {
  model: string;
  availableModels: string[];
  onSelectModel: (model: string) => void;
  onRefresh: () => void;
}) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      // Race against a 10s timeout so the button never gets stuck
      await Promise.race([
        Promise.resolve(onRefresh()),
        new Promise((r) => setTimeout(r, 10000)),
      ]);
    } catch { /* */ }
    setIsRefreshing(false);
  };

  return (
    <div className="px-4 pt-4 pb-1">
      <div className="flex items-center gap-2 overflow-hidden">
        <select
          value={model}
          onChange={(e) => onSelectModel(e.target.value)}
          className="min-w-0 flex-1 px-3 py-2 text-sm text-[var(--text)] bg-[var(--bg)] border border-[var(--border)] rounded-lg focus:outline-none focus:border-[var(--accent)] truncate appearance-none cursor-pointer"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23666' d='M3 5l3 3 3-3'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center" }}
        >
          {!model && <option value="">Select a model...</option>}
          {availableModels.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
          {model && !availableModels.includes(model) && (
            <option value={model}>{model}</option>
          )}
        </select>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          style={{ width: 32, height: 32, minWidth: 32 }}
          className="shrink-0 flex items-center justify-center rounded-lg border border-[var(--border)] hover:bg-[var(--bg-hover)] text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
          title="Refresh models"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className={isRefreshing ? "animate-spin" : ""}>
            <path d="M2 8a6 6 0 0 1 10.3-4.2M14 2v4h-4" />
            <path d="M14 8a6 6 0 0 1-10.3 4.2M2 14v-4h4" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// --- Sessions Tab ---

function SessionsTab({
  sessions,
  currentSessionId,
  onNewSession,
  onSelectSession,
  onDeleteSession,
  onRenameSession,
}: {
  sessions: Session[];
  currentSessionId: string | null;
  onNewSession: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, title: string) => void;
}) {
  return (
    <>
      <button
        onClick={onNewSession}
        className="w-full px-5 py-3.5 mb-4 text-base font-semibold rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white transition-colors"
      >
        + New Session
      </button>

      <div className="text-base font-bold text-[var(--text)] px-3 py-2.5 mb-1 border-b border-[var(--border)]">
        Projects / Sessions
      </div>

      {sessions.map((s) => (
        <SessionItem
          key={s.id}
          session={s}
          isActive={s.id === currentSessionId}
          onSelect={() => onSelectSession(s.id)}
          onDelete={() => onDeleteSession(s.id)}
          onRename={(title) => onRenameSession(s.id, title)}
        />
      ))}
      {sessions.length === 0 && (
        <div className="text-base text-[var(--text-dim)] px-4 py-10 text-center">
          No sessions yet
        </div>
      )}
    </>
  );
}

// --- Session Item with three-dot menu ---

function SessionItem({
  session,
  isActive,
  onSelect,
  onDelete,
  onRename,
}: {
  session: Session;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const handleRenameSubmit = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== session.title) {
      onRename(trimmed);
    }
    setIsRenaming(false);
  };

  if (isRenaming) {
    return (
      <div className="px-4 py-3 mb-1.5">
        <input
          ref={inputRef}
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleRenameSubmit();
            if (e.key === "Escape") setIsRenaming(false);
          }}
          onBlur={handleRenameSubmit}
          className="w-full px-3 py-1.5 text-[15px] rounded-lg bg-[var(--bg)] border border-[var(--accent)] text-[var(--text)] focus:outline-none"
        />
      </div>
    );
  }

  return (
    <div
      className={`group flex items-start justify-between px-4 py-3 rounded-xl text-base mb-1.5 transition-colors cursor-pointer relative ${
        isActive
          ? "bg-[var(--bg-hover)] text-[var(--text)]"
          : "text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text)]"
      }`}
      onClick={onSelect}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium text-[15px]">{session.title || "Untitled"}</div>
        <div className="text-sm text-[var(--text-dim)] mt-1">
          {(session.lastUsed || session.updated) ? timeAgo((session.lastUsed || session.updated)!) : ""}
        </div>
      </div>

      <div ref={menuRef} className="relative">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(!menuOpen);
          }}
          className="opacity-0 group-hover:opacity-100 ml-2 mt-0.5 w-7 h-7 flex items-center justify-center rounded-lg text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--bg-elevated)] transition-all"
          title="Session options"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="8" cy="3" r="1.5" />
            <circle cx="8" cy="8" r="1.5" />
            <circle cx="8" cy="13" r="1.5" />
          </svg>
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-8 z-50 w-36 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl shadow-xl overflow-hidden">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                setRenameValue(session.title || "");
                setIsRenaming(true);
              }}
              className="w-full px-4 py-2.5 text-left text-sm text-[var(--text)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              Rename
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(false);
                onDelete();
              }}
              className="w-full px-4 py-2.5 text-left text-sm text-[var(--error)] hover:bg-[var(--error)]/10 transition-colors"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Tools Tab ---

const TOOLS = [
  { name: "read_file", icon: "📄", level: "low", desc: "Read file contents" },
  { name: "write_file", icon: "✏️", level: "medium", desc: "Create or overwrite a file" },
  { name: "edit_file", icon: "✂️", level: "medium", desc: "Replace text in a file" },
  { name: "list_directory", icon: "📁", level: "low", desc: "List directory contents" },
  { name: "search_files", icon: "🔍", level: "low", desc: "Search file contents with regex" },
  { name: "glob_files", icon: "🔍", level: "low", desc: "Find files by pattern" },
  { name: "bash", icon: "⚡", level: "high", desc: "Run a shell command" },
  { name: "git", icon: "🌿", level: "medium", desc: "Run a git command" },
  { name: "web_fetch", icon: "🌐", level: "medium", desc: "Fetch a web page" },
  { name: "web_search", icon: "🌐", level: "medium", desc: "Search the web" },
  { name: "npm_install", icon: "📦", level: "medium", desc: "Install npm packages" },
  { name: "pip_install", icon: "📦", level: "medium", desc: "Install pip packages" },
  { name: "install_tool", icon: "🔧", level: "high", desc: "Install a system tool" },
  { name: "generate_file", icon: "📝", level: "medium", desc: "Generate a document file" },
];

function ToolsTab() {
  return (
    <div className="space-y-1.5">
      <div className="text-sm uppercase tracking-wider text-[var(--text-dim)] px-3 py-2 font-semibold">
        14 Tools Available
      </div>
      <div className="text-sm text-[var(--text-dim)] px-3 pb-2">
        Also accessible via <span className="text-[var(--accent)] font-mono">/tools</span> in chat
      </div>
      {TOOLS.map((t) => (
        <div key={t.name} className="flex items-center gap-3 px-4 py-2.5 rounded-xl hover:bg-[var(--bg-hover)] transition-colors">
          <span className="text-xl">{t.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-medium text-[var(--text)] truncate">{t.name}</div>
            <div className="text-sm text-[var(--text-dim)] truncate">{t.desc}</div>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            t.level === "low" ? "bg-[var(--success)]/15 text-[var(--success)]" :
            t.level === "medium" ? "bg-[var(--warning)]/15 text-[var(--warning)]" :
            "bg-[var(--error)]/15 text-[var(--error)]"
          }`}>
            {t.level}
          </span>
        </div>
      ))}
    </div>
  );
}

// --- Activity Tab ---

function ActivityTab({ onAction }: { onAction: (action: string, payload?: any) => void }) {
  return (
    <div className="space-y-2 pb-4">
      <div className="text-sm text-[var(--text-dim)] px-3 py-1">
        Also accessible as <span className="text-[var(--accent)] font-mono">/commands</span> in chat
      </div>

      <ActivityButton icon="↩️" title="Undo" desc="Revert the last file change" cmd="/undo" onClick={() => onAction("undo")} />
      <ActivityButton icon="📊" title="Diff" desc="Show all file changes this session" cmd="/diff" onClick={() => onAction("diff")} />
      <ActivityButton icon="📐" title="Context" desc="Show context window usage" cmd="/context" onClick={() => onAction("compact")} />
      <ActivityButton icon="🧠" title="Memory" desc="View loaded memory files" cmd="/memory" onClick={() => onAction("memory")} />
      <ActivityButton icon="📜" title="Instructions" desc="View agent instruction files" cmd="/instructions" onClick={() => onAction("instructions")} />
    </div>
  );
}

function ActivityButton({ icon, title, desc, cmd, onClick }: { icon: string; title: string; desc: string; cmd: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border border-[var(--border)] hover:border-[var(--border-hover)] hover:bg-[var(--bg-hover)] transition-colors text-left"
    >
      <span className="text-xl">{icon}</span>
      <div className="flex-1">
        <div className="text-[15px] font-medium text-[var(--text)]">{title}</div>
        <div className="text-sm text-[var(--text-dim)]">{desc}</div>
      </div>
      <span className="text-xs text-[var(--accent)] font-mono">{cmd}</span>
    </button>
  );
}

// --- Tasks Section ---

import { engine, engineCall } from "../lib/engine";
import type { Task, TaskList } from "../lib/types";

function TasksTab() {
  const [tasks, setTasks] = useState<TaskList>({ active: [], completed: [] });
  const [newTask, setNewTask] = useState("");
  const [newDue, setNewDue] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const refresh = async () => {
    try {
      const data = await engine.listTasks() as unknown as TaskList;
      setTasks(data || { active: [], completed: [] });
    } catch { /* */ }
  };

  useEffect(() => {
    if (!loaded) { refresh(); setLoaded(true); }
  }, [loaded]);

  const handleAdd = async () => {
    const desc = newTask.trim();
    if (!desc) return;
    try {
      await engine.addTask(desc, newDue || undefined);
      setNewTask("");
      setNewDue("");
      await refresh();
    } catch { /* */ }
  };

  const handleComplete = async (index: number) => {
    try {
      await engine.completeTask(index);
      await refresh();
    } catch { /* */ }
  };

  const handleRemove = async (index: number) => {
    try {
      await engine.removeTask(index);
      await refresh();
    } catch { /* */ }
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="pb-4">
      {/* Active tasks */}
      {tasks.active.length === 0 && (
        <div className="text-sm text-[var(--text-dim)] px-3 py-3">No active tasks. Add one below.</div>
      )}
      {tasks.active.map((t: Task, i: number) => {
        const overdue = t.dueDate && t.dueDate < today;
        const dueToday = t.dueDate && t.dueDate === today;
        return (
          <div key={i} className="flex items-start gap-2 px-4 py-1.5 group">
            <button
              onClick={() => handleComplete(i + 1)}
              className="mt-0.5 w-4 h-4 rounded border border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--accent)]/20 transition-colors shrink-0"
              title="Mark complete"
            />
            <div className="flex-1 min-w-0">
              <div className="text-[14px] text-[var(--text)] truncate">{t.description}</div>
              {t.dueDate && (
                <div className={`text-xs ${overdue ? "text-[var(--error)]" : dueToday ? "text-[var(--warning)]" : "text-[var(--text-dim)]"}`}>
                  {overdue ? "Overdue: " : dueToday ? "Due today: " : "Due: "}{t.dueDate}
                </div>
              )}
            </div>
            <button
              onClick={() => handleRemove(i + 1)}
              className="opacity-0 group-hover:opacity-100 text-[var(--text-dim)] hover:text-[var(--error)] text-xs transition-opacity"
              title="Remove"
            >
              ✕
            </button>
          </div>
        );
      })}

      {/* Add task input */}
      <div className="px-4 pt-2">
        <div className="flex gap-1.5">
          <input
            type="text"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            placeholder="+ Add task..."
            className="flex-1 px-2.5 py-1.5 text-sm rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)]"
          />
        </div>
        <div className="flex gap-1.5 mt-1.5">
          <input
            type="date"
            value={newDue}
            onChange={(e) => setNewDue(e.target.value)}
            className="flex-1 px-2.5 py-1 text-xs rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)]"
          />
          <button
            onClick={handleAdd}
            disabled={!newTask.trim()}
            className="px-3 py-1 text-xs font-medium rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white transition-colors disabled:opacity-40"
          >
            Add
          </button>
        </div>
      </div>

      {/* Completed (collapsible) */}
      {tasks.completed.length > 0 && (
        <div className="px-4 pt-2">
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="text-xs text-[var(--text-dim)] hover:text-[var(--text-muted)] transition-colors"
          >
            {showCompleted ? "▼" : "▶"} Completed ({tasks.completed.length})
          </button>
          {showCompleted && (
            <div className="mt-1 space-y-0.5">
              {tasks.completed.slice(-10).map((t: Task, i: number) => (
                <div key={i} className="text-xs text-[var(--text-dim)] line-through truncate px-1">
                  {t.description}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Settings Tab ---

const PROVIDERS = [
  { key: "anthropic", label: "Anthropic (Claude)", emoji: "🟣" },
  { key: "google", label: "Google (Gemini)", emoji: "🔵" },
  { key: "openai", label: "OpenAI (GPT)", emoji: "🟢" },
  { key: "opencode", label: "Opencode", emoji: "🟠" },
] as const;

function SettingsTab({
  config,
  onAction,
}: {
  config: Record<string, any>;
  onAction: (action: string, payload?: any) => void;
}) {
  const temperature = config.temperature ?? 0.7;
  const maxIterations = config.maxIterations ?? 50;

  return (
    <div className="space-y-5 pb-4">
      <div className="text-sm text-[var(--text-dim)] px-3 pb-1">
        Also accessible via <span className="text-[var(--accent)] font-mono">/settings</span>, <span className="text-[var(--accent)] font-mono">/set</span>, <span className="text-[var(--accent)] font-mono">/help</span> in chat
      </div>

      <SettingsSection title="General">
        <SettingToggle
          label="Show tool calls"
          checked={config.showToolCalls !== false}
          onChange={(v) => onAction("setSetting", { key: "showToolCalls", value: v })}
        />
        <SettingToggle
          label="Show thinking indicator"
          checked={config.showThinking !== false}
          onChange={(v) => onAction("setSetting", { key: "showThinking", value: v })}
        />
        <SettingToggle
          label="Memory in prompt"
          checked={config.memoryEnabled !== false}
          onChange={(v) => onAction("setSetting", { key: "memoryEnabled", value: v })}
        />
        <SettingSlider
          label="Temperature"
          value={temperature}
          min={0.1}
          max={1.0}
          step={0.1}
          onChange={(v) => onAction("setSetting", { key: "temperature", value: v })}
        />
        <SettingNumber
          label="Max iterations"
          value={maxIterations}
          min={1}
          max={200}
          step={1}
          onChange={(v) => onAction("setSetting", { key: "maxIterations", value: v })}
        />
      </SettingsSection>

      <SettingsSection title="Server">
        <MultiServerSettings
          primaryUrl={config.ollamaUrl || "http://localhost:11434"}
          localServers={config.localServers || []}
          onAction={onAction}
        />
      </SettingsSection>

      <SettingsSection title="Cloud Providers">
        <div className="text-xs text-[var(--text-dim)] px-4 pb-1">
          API keys are stored locally and never shared.
        </div>
        {PROVIDERS.map(({ key, label, emoji }) => (
          <ProviderBlock
            key={key}
            providerKey={key}
            label={label}
            emoji={emoji}
            enabled={!!config.enabledProviders?.[key]}
            hasKey={!!config.hasApiKey?.[key]}
            onAction={onAction}
          />
        ))}
      </SettingsSection>

      <SettingsSection title="Safety">
        <SettingRow label="PIN" value={config.pinHash ? "Set" : "Not set"} />
        <SettingToggle
          label="Auto-approve medium"
          checked={!!config.autoApprove?.medium}
          onChange={(v) => onAction("setSetting", { key: "autoApprove.medium", value: v })}
        />
        <SettingToggle
          label="Auto-approve high"
          checked={!!config.autoApprove?.high}
          onChange={(v) => onAction("setSetting", { key: "autoApprove.high", value: v })}
        />
      </SettingsSection>

      <SettingsSection title="Telegram">
        <TelegramSettings config={config} onAction={onAction} />
      </SettingsSection>

      <SettingsSection title="Actions">
        <UpdateButton />
        <button
          onClick={() => onAction("clearMessages")}
          style={{ height: 46 }}
          className="w-full px-5 text-[15px] font-medium text-[var(--error)] rounded-xl border border-[var(--error)]/20 hover:bg-[var(--error)]/10 transition-colors"
        >
          Clear conversation
        </button>
      </SettingsSection>
    </div>
  );
}

// --- Provider Block with API key input and connection status ---

interface UpdateInfo {
  available: boolean;
  version: string;
  download_url?: string;
  asset_name?: string;
}

function UpdateButton() {
  const [label, setLabel] = useState("Check for updates");
  const [color, setColor] = useState("var(--accent)");
  const [busy, setBusy] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  const handleClick = async () => {
    if (busy) return;

    // If update is available, download and install
    if (updateInfo?.available && updateInfo.download_url && updateInfo.asset_name) {
      setBusy(true);
      setLabel("Downloading...");
      setColor("var(--text-muted)");

      const unlisten = await listen("update:download-progress", (event: any) => {
        const { downloaded, total } = event.payload;
        if (total > 0) {
          const pct = Math.round((downloaded / total) * 100);
          setLabel(`Downloading... ${pct}%`);
        }
      });

      try {
        await invoke("download_and_install_update", {
          downloadUrl: updateInfo.download_url,
          assetName: updateInfo.asset_name,
        });
      } catch (err) {
        unlisten();
        setLabel("Update failed");
        setColor("var(--error)");
        setBusy(false);
        setTimeout(() => { setLabel("Check for updates"); setColor("var(--accent)"); setUpdateInfo(null); }, 4000);
      }
      return;
    }

    // Otherwise, check for updates
    setBusy(true);
    setLabel("Checking...");
    setColor("var(--text-muted)");
    try {
      const result = await invoke<UpdateInfo>("check_for_desktop_update");
      if (result.available) {
        setUpdateInfo(result);
        setLabel(`Install v${result.version}`);
        setColor("var(--warning)");
      } else {
        setLabel("Up to date");
        setColor("var(--success)");
        setTimeout(() => { setLabel("Check for updates"); setColor("var(--accent)"); }, 4000);
      }
    } catch {
      setLabel("Check failed");
      setColor("var(--error)");
      setTimeout(() => { setLabel("Check for updates"); setColor("var(--accent)"); }, 4000);
    }
    setBusy(false);
  };

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      style={{ color, borderColor: color, minHeight: 46 }}
      className="w-full px-5 text-[15px] font-medium rounded-xl border hover:brightness-125 transition-colors"
    >
      {label}
    </button>
  );
}

function ProviderBlock({
  providerKey,
  label,
  emoji,
  enabled,
  hasKey,
  onAction,
}: {
  providerKey: string;
  label: string;
  emoji: string;
  enabled: boolean;
  hasKey: boolean;
  onAction: (action: string, payload?: any) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  // "checking" and "error" are transient states from user actions;
  // otherwise derive status from props so it always reflects config
  const [actionStatus, setActionStatus] = useState<"checking" | "error" | null>(null);
  const status = actionStatus || (enabled && hasKey ? "ok" : "idle");

  // Clear transient action status when props catch up
  useEffect(() => {
    if (actionStatus === "error" || actionStatus === "checking") return;
    setActionStatus(null);
  }, [enabled, hasKey, actionStatus]);

  const handleToggle = () => {
    const newVal = !enabled;
    onAction("setSetting", { key: `enabledProviders.${providerKey}`, value: newVal });
    if (newVal && !hasKey) {
      setExpanded(true);
    }
  };

  const handleSaveKey = async () => {
    if (!apiKeyDraft.trim()) return;
    setActionStatus("checking");
    try {
      await engineCall("saveApiKey", { provider: providerKey, key: apiKeyDraft.trim() });
      const result = await engineCall<{ ok: boolean }>("testProvider", { provider: providerKey });
      setActionStatus(result.ok ? null : "error");
      if (result.ok) {
        setApiKeyDraft("");
        setExpanded(false);
        // Enable the provider
        onAction("setSetting", { key: `enabledProviders.${providerKey}`, value: true });
      }
    } catch {
      setActionStatus("error");
    }
  };

  const handleTestConnection = async () => {
    setActionStatus("checking");
    try {
      const result = await engineCall<{ ok: boolean }>("testProvider", { provider: providerKey });
      setActionStatus(result.ok ? null : "error");
    } catch {
      setActionStatus("error");
    }
  };

  const statusDot = status === "ok"
    ? "bg-[var(--success)]"
    : status === "error"
      ? "bg-[var(--error)]"
      : status === "checking"
        ? "bg-[var(--warning)] animate-pulse"
        : "bg-[var(--text-dim)]";

  return (
    <div className="rounded-xl border border-[var(--border)] mb-2 overflow-hidden">
      {/* Header row */}
      <div
        className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
        onClick={handleToggle}
      >
        <div className="flex items-center gap-2">
          <span>{emoji}</span>
          <span className="text-[15px] text-[var(--text-muted)]">{label}</span>
          {/* Status light */}
          <span className={`w-2 h-2 rounded-full ${statusDot}`} title={status} />
        </div>
        <div className="flex items-center gap-2">
          {enabled && hasKey && (
            <button
              onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
              className="text-xs text-[var(--text-dim)] hover:text-[var(--text)] px-1.5"
            >
              {expanded ? "▲" : "▼"}
            </button>
          )}
          <div
            className={`w-10 h-[22px] rounded-full transition-colors relative ${
              enabled ? "bg-[var(--accent)]" : "bg-[var(--border)]"
            }`}
          >
            <span
              className={`absolute top-[3px] w-4 h-4 rounded-full bg-white transition-transform ${
                enabled ? "left-[21px]" : "left-[3px]"
              }`}
            />
          </div>
        </div>
      </div>

      {/* Expanded: API key input */}
      {(expanded || (enabled && !hasKey)) && (
        <div className="px-4 pb-3 pt-1 border-t border-[var(--border)]/50">
          <input
            type="password"
            placeholder="Paste API key..."
            value={apiKeyDraft}
            onChange={(e) => setApiKeyDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSaveKey(); }}
            className="w-full px-3 py-2 text-sm rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)] mb-2"
            autoComplete="off"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSaveKey}
              disabled={!apiKeyDraft.trim()}
              className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white transition-colors disabled:opacity-40"
            >
              Save & Test
            </button>
            {hasKey && (
              <button
                onClick={handleTestConnection}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border)] hover:bg-[var(--bg-hover)] text-[var(--text-muted)] transition-colors"
              >
                Test
              </button>
            )}
          </div>
          {status === "error" && (
            <div className="text-xs text-[var(--error)] mt-1.5 px-1">
              Connection failed. Check your API key.
            </div>
          )}
          {status === "ok" && hasKey && (
            <div className="text-xs text-[var(--success)] mt-1.5 px-1">
              Connected successfully.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// --- Multi-Server Settings ---

function MultiServerSettings({
  primaryUrl,
  localServers,
  onAction,
}: {
  primaryUrl: string;
  localServers: string[];
  onAction: (action: string, payload?: any) => void;
}) {
  const [newUrl, setNewUrl] = useState("");
  const [statuses, setStatuses] = useState<Record<string, "idle" | "checking" | "ok" | "error">>({});

  const testServer = async (url: string) => {
    setStatuses((s) => ({ ...s, [url]: "checking" }));
    try {
      const result = await engineCall<{ ok: boolean }>("testServer", { url });
      setStatuses((s) => ({ ...s, [url]: result.ok ? "ok" : "error" }));
    } catch {
      setStatuses((s) => ({ ...s, [url]: "error" }));
    }
  };

  const handleAddServer = async () => {
    const url = newUrl.trim().replace(/\/$/, "");
    if (!url) return;
    await testServer(url);
    const updated = [...localServers, url];
    onAction("setSetting", { key: "localServers", value: updated });
    setNewUrl("");
  };

  const handleRemoveServer = (index: number) => {
    const updated = localServers.filter((_: string, i: number) => i !== index);
    onAction("setSetting", { key: "localServers", value: updated });
  };

  const statusDot = (url: string) => {
    const s = statuses[url] || "idle";
    return s === "ok"
      ? "bg-[var(--success)]"
      : s === "error"
        ? "bg-[var(--error)]"
        : s === "checking"
          ? "bg-[var(--warning)] animate-pulse"
          : "bg-[var(--text-dim)]";
  };

  return (
    <div className="px-4 py-2.5 space-y-2.5">
      {/* Primary server */}
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot(primaryUrl)}`} />
        <span className="text-[14px] text-[var(--text)] flex-1 truncate">{primaryUrl}</span>
        <span className="text-xs text-[var(--text-dim)]">primary</span>
        <button
          onClick={() => testServer(primaryUrl)}
          className="text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
        >
          Test
        </button>
      </div>

      {/* Additional servers */}
      {localServers.map((url: string, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full shrink-0 ${statusDot(url)}`} />
          <span className="text-[14px] text-[var(--text)] flex-1 truncate">{url}</span>
          <button
            onClick={() => testServer(url)}
            className="text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors"
          >
            Test
          </button>
          <button
            onClick={() => handleRemoveServer(i)}
            className="text-xs text-[var(--error)] hover:text-[var(--error)]/80 transition-colors"
          >
            ✕
          </button>
        </div>
      ))}

      {/* Add server row */}
      <div className="flex gap-1.5 pt-1">
        <input
          type="text"
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAddServer(); }}
          placeholder="http://localhost:11434"
          className="flex-1 px-2.5 py-1.5 text-sm rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)]"
        />
        <button
          onClick={handleAddServer}
          disabled={!newUrl.trim()}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white transition-colors disabled:opacity-40"
        >
          + Add
        </button>
      </div>
    </div>
  );
}

// --- Server URL Setting with connection test (legacy, kept for reference) ---

function ServerUrlSetting({
  url,
  onSave,
}: {
  url: string;
  onSave: (url: string) => void;
}) {
  const [draft, setDraft] = useState(url);
  const [status, setStatus] = useState<"idle" | "checking" | "ok" | "error">("idle");

  const handleTest = async () => {
    setStatus("checking");
    try {
      const result = await engineCall<{ ok: boolean; backend?: string }>("testServer", { url: draft });
      setStatus(result.ok ? "ok" : "error");
      if (result.ok) onSave(draft);
    } catch {
      setStatus("error");
    }
  };

  const statusDot = status === "ok"
    ? "bg-[var(--success)]"
    : status === "error"
      ? "bg-[var(--error)]"
      : status === "checking"
        ? "bg-[var(--warning)] animate-pulse"
        : "bg-[var(--text-dim)]";

  return (
    <div className="px-4 py-2.5">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[15px] text-[var(--text-muted)]">Server URL</span>
        <span className={`w-2 h-2 rounded-full ${statusDot}`} />
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setStatus("idle"); }}
          onKeyDown={(e) => { if (e.key === "Enter") handleTest(); }}
          className="flex-1 px-3 py-1.5 text-sm rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]"
        />
        <button
          onClick={handleTest}
          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white transition-colors"
        >
          Connect
        </button>
      </div>
    </div>
  );
}

// --- Telegram Settings ---

function TelegramSettings({
  config,
  onAction,
}: {
  config: Record<string, any>;
  onAction: (action: string, payload?: any) => void;
}) {
  const [tokenDraft, setTokenDraft] = useState("");
  const [showToken, setShowToken] = useState(false);
  const isConfigured = config.telegramBotToken && config.telegramBotToken.length > 0;
  const accessCode = config.telegramAccessCode || "";
  const userCount = (config.telegramAllowedUsers || []).length;

  const handleSaveToken = async () => {
    if (!tokenDraft.trim()) return;
    await engineCall("saveSetting", { key: "telegramBotToken", value: tokenDraft.trim() });
    onAction("setSetting", { key: "telegramBotToken", value: tokenDraft.trim() });
    setTokenDraft("");
    // Auto-generate access code if none exists
    if (!accessCode) {
      const code = Array.from(crypto.getRandomValues(new Uint8Array(4)))
        .map((b) => b.toString(16).padStart(2, "0")).join("");
      await engineCall("saveSetting", { key: "telegramAccessCode", value: code });
      onAction("setSetting", { key: "telegramAccessCode", value: code });
    }
  };

  const handleGenerateCode = async () => {
    const code = Array.from(crypto.getRandomValues(new Uint8Array(4)))
      .map((b) => b.toString(16).padStart(2, "0")).join("");
    await engineCall("saveSetting", { key: "telegramAccessCode", value: code });
    onAction("setSetting", { key: "telegramAccessCode", value: code });
  };

  return (
    <div className="px-4 py-2.5 space-y-3">
      {/* Status */}
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${isConfigured ? "bg-[var(--success)]" : "bg-[var(--text-dim)]"}`} />
        <span className="text-sm text-[var(--text-muted)]">
          {isConfigured ? `Configured (${userCount} user${userCount !== 1 ? "s" : ""})` : "Not configured"}
        </span>
      </div>

      {/* Bot token */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm text-[var(--text-muted)]">Bot Token</span>
          {isConfigured && (
            <button
              onClick={() => setShowToken(!showToken)}
              className="text-xs text-[var(--text-dim)] hover:text-[var(--text)]"
            >
              {showToken ? "Hide" : "Show"}
            </button>
          )}
        </div>
        {isConfigured && !showToken && (
          <div className="text-sm text-[var(--text-dim)] font-mono">••••••••</div>
        )}
        {isConfigured && showToken && (
          <div className="text-sm text-[var(--text-dim)] font-mono break-all">{config.telegramBotToken}</div>
        )}
        <div className="flex gap-1.5 mt-1">
          <input
            type="text"
            value={tokenDraft}
            onChange={(e) => setTokenDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSaveToken(); }}
            placeholder="Paste bot token..."
            className="flex-1 px-2.5 py-1.5 text-sm rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)]"
          />
          <button
            onClick={handleSaveToken}
            disabled={!tokenDraft.trim()}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white transition-colors disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>

      {/* Access code */}
      {isConfigured && (
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm text-[var(--text-muted)]">Access Code</span>
          </div>
          {accessCode ? (
            <div className="flex items-center gap-2">
              <code className="text-sm text-[var(--accent)] font-mono bg-[var(--bg)] px-2.5 py-1 rounded-lg border border-[var(--border)]">
                {accessCode}
              </code>
              <button
                onClick={handleGenerateCode}
                className="text-xs text-[var(--text-dim)] hover:text-[var(--text)]"
              >
                Regenerate
              </button>
            </div>
          ) : (
            <button
              onClick={handleGenerateCode}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white transition-colors"
            >
              Generate Code
            </button>
          )}
          <p className="text-xs text-[var(--text-dim)] mt-1.5">
            Send this code to the bot on Telegram to authenticate.
          </p>
        </div>
      )}

      {/* Help */}
      <div className="text-xs text-[var(--text-dim)] leading-relaxed">
        Get a token from <b>@BotFather</b> on Telegram, then run <code className="text-[var(--accent)]">llamabuild --telegram</code> to start.
      </div>
    </div>
  );
}

// --- Setting components ---

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-sm uppercase tracking-wider text-[var(--text-dim)] px-3 py-2 font-semibold">
        {title}
      </div>
      <div className="space-y-1.5">
        {children}
      </div>
    </div>
  );
}

function SettingToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div
      className="flex items-center justify-between px-4 py-2.5 rounded-xl hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
      onClick={() => onChange(!checked)}
    >
      <span className="text-[15px] text-[var(--text-muted)]">{label}</span>
      <div
        className={`w-10 h-[22px] rounded-full transition-colors relative ${
          checked ? "bg-[var(--accent)]" : "bg-[var(--border)]"
        }`}
      >
        <span
          className={`absolute top-[3px] w-4 h-4 rounded-full bg-white transition-transform ${
            checked ? "left-[21px]" : "left-[3px]"
          }`}
        />
      </div>
    </div>
  );
}

function SettingRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 rounded-xl">
      <span className="text-[15px] text-[var(--text-muted)]">{label}</span>
      <span className={`text-[15px] truncate max-w-[160px] ${highlight ? "text-[var(--accent)] font-medium" : "text-[var(--text-dim)]"}`}>
        {value}
      </span>
    </div>
  );
}

function SettingSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="px-4 py-2.5 rounded-xl">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[15px] text-[var(--text-muted)]">{label}</span>
        <span className="text-[15px] text-[var(--accent)] font-medium tabular-nums">{value.toFixed(1)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
      />
    </div>
  );
}

function SettingNumber({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 rounded-xl">
      <span className="text-[15px] text-[var(--text-muted)]">{label}</span>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onChange(Math.max(min, value - step))}
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-[var(--border)] hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors text-sm font-bold"
        >
          −
        </button>
        <span className="text-[15px] text-[var(--accent)] font-medium w-8 text-center tabular-nums">{value}</span>
        <button
          onClick={() => onChange(Math.min(max, value + step))}
          className="w-7 h-7 flex items-center justify-center rounded-lg border border-[var(--border)] hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors text-sm font-bold"
        >
          +
        </button>
      </div>
    </div>
  );
}
