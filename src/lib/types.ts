// Engine event types matching the sidecar protocol

export interface TokenEvent {
  content: string;
}

export interface ToolStartEvent {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResultEvent {
  id: string;
  name: string;
  success: boolean;
  summary: string;
  fullResult?: string;
}

export interface UsageEvent {
  promptTokens: number;
  outputTokens: number;
  iterationCount: number;
  contextPercent: number | null;
  durationMs: number;
}

export interface ErrorEvent {
  message: string;
  recoverable: boolean;
}

export interface ModeChangeEvent {
  from: string;
  to: string;
}

export interface ConfirmPrompt {
  id: string;
  event: "confirm-needed";
  data: { actions: string[] };
}

export interface FileChangedEvent {
  path: string;
  toolName: string;
  newContent: string;
  oldContent: string | null;
}

// UI state types

export interface MessageUsage {
  promptTokens: number;
  outputTokens: number;
  iterationCount: number;
  contextPercent: number | null;
  durationMs: number;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCall[];
  timestamp: number;
  usage?: MessageUsage;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  status: "running" | "success" | "error";
  summary?: string;
}

export interface Session {
  id: string;
  title: string;
  created: string;
  updated?: string;
  lastUsed?: string;
  projectRoot?: string;
}

export type AgentMode = "build" | "plan" | "recall";

export interface MemoryLoadingEvent {
  status: "start" | "done";
}

export interface Task {
  description: string;
  dueDate: string | null;
  created: string;
}

export interface TaskList {
  active: Task[];
  completed: Task[];
}
