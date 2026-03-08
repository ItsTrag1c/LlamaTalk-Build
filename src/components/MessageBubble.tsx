import type { Message } from "../lib/types";
import { ToolCallBlock } from "./ToolCallBlock";

interface MessageBubbleProps {
  message: Message;
  profileName?: string;
  modelName?: string;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const secs = (ms / 1000).toFixed(1);
  return `${secs}s`;
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function MessageBubble({ message, profileName, modelName }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const displayName = isUser ? (profileName || "You") : (modelName || "Assistant");

  // Calculate tokens per second
  const tks = message.usage && message.usage.durationMs > 0
    ? (message.usage.outputTokens / (message.usage.durationMs / 1000)).toFixed(1)
    : null;

  return (
    <div className="py-2">
      {/* Name header — CLI style */}
      <div className={`text-xs font-bold mb-1 tracking-wide uppercase ${
        isUser ? "text-[var(--text-muted)]" : "text-[var(--accent)]"
      }`}>
        {displayName}
      </div>

      {/* Tool calls (assistant only) */}
      {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
        <div className="mb-2">
          {message.toolCalls.map((tc) => (
            <ToolCallBlock key={tc.id} tool={tc} />
          ))}
        </div>
      )}

      {/* Message content */}
      {message.content && (
        <div className={`text-[15px] leading-relaxed whitespace-pre-wrap break-words ${
          isUser
            ? "text-[var(--text)] pl-3 border-l-2 border-[var(--text-dim)]"
            : "prose text-[var(--text)]"
        }`}>
          {message.content}
        </div>
      )}

      {/* Usage statistics — inline after response text */}
      {!isUser && message.usage && (
        <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2 text-sm">
          <span className="text-[var(--text-muted)]">
            {formatTokens(message.usage.outputTokens)} tokens
          </span>
          {tks && (
            <span className="text-[var(--success)]" title="Tokens per second">
              {tks} tk/s
            </span>
          )}
          <span className="text-[var(--text-muted)]">
            {formatDuration(message.usage.durationMs)}
          </span>
          {message.usage.iterationCount > 1 && (
            <span className="text-[var(--text-muted)]">
              {message.usage.iterationCount} iterations
            </span>
          )}
          {message.usage.contextPercent !== null && message.usage.contextPercent !== undefined && (
            <span className={
              message.usage.contextPercent > 80
                ? "text-[var(--warning)]"
                : "text-[var(--text-muted)]"
            }>
              ctx {message.usage.contextPercent}%
            </span>
          )}
        </div>
      )}
    </div>
  );
}
