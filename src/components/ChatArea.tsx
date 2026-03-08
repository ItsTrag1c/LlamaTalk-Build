import { useEffect, useRef } from "react";
import type { Message, ToolCall } from "../lib/types";
import { MessageBubble } from "./MessageBubble";
import { ToolCallBlock } from "./ToolCallBlock";

interface ChatAreaProps {
  messages: Message[];
  streamingContent: string;
  pendingToolCalls: ToolCall[];
  isThinking: boolean;
  profileName?: string;
  modelName?: string;
}

export function ChatArea({ messages, streamingContent, pendingToolCalls, isThinking, profileName, modelName }: ChatAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent, pendingToolCalls]);

  const hasContent = messages.length > 0 || streamingContent || isThinking;

  return (
    <div className="flex-1 overflow-y-auto flex flex-col">
      {/* Spacer pushes content to bottom when short */}
      {hasContent && <div className="flex-1 min-h-4" />}

      {!hasContent && (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className="w-24 h-24 mb-6">
            <rect width="512" height="512" rx="108" fill="#1e1e2e"/>
            <path d="M102,252 Q76,220 94,196" stroke="#f97316" strokeWidth="18" fill="none" strokeLinecap="round"/>
            <rect x="125" y="340" width="30" height="74" rx="12" fill="#e5690e"/>
            <rect x="167" y="340" width="30" height="74" rx="12" fill="#e5690e"/>
            <ellipse cx="230" cy="284" rx="130" ry="76" fill="#f97316"/>
            <rect x="282" y="340" width="30" height="74" rx="12" fill="#f97316"/>
            <rect x="322" y="340" width="30" height="74" rx="12" fill="#f97316"/>
            <path d="M290,232 C298,180 312,142 320,112 L356,112 C348,142 336,180 330,232 Z" fill="#f97316"/>
            <ellipse cx="343" cy="100" rx="44" ry="34" fill="#f97316"/>
            <ellipse cx="382" cy="112" rx="22" ry="16" fill="#f97316"/>
            <polygon points="318,78 304,26 336,68" fill="#f97316"/>
            <polygon points="320,75 310,38 332,68" fill="#e06510"/>
            <polygon points="352,72 356,18 370,64" fill="#f97316"/>
            <polygon points="354,70 356,30 366,64" fill="#e06510"/>
            <circle cx="360" cy="94" r="8" fill="#1e1e2e"/>
            <circle cx="362" cy="92" r="3" fill="rgba(255,255,255,0.5)"/>
            <circle cx="396" cy="112" r="3.5" fill="#d05a08"/>
            <path d="M388,122 Q395,128 391,126" stroke="#d05a08" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
          </svg>
          <h2 className="text-2xl font-bold text-[var(--text)]">LlamaTalk Build</h2>
          <p className="text-lg text-[var(--text-muted)] mt-3 max-w-lg leading-relaxed">
            Agentic coding assistant. Ask me to read, write, edit files, run commands, or explore your project.
          </p>
          <p className="text-base text-[var(--text-dim)] mt-4">
            Type <span className="text-[var(--accent)] font-mono">/help</span> for all available commands
          </p>
        </div>
      )}

      {/* Messages */}
      <div className="px-6 py-4 space-y-1">
        {messages.map((msg, i) => (
          <MessageBubble
            key={i}
            message={msg}
            profileName={profileName}
            modelName={modelName}
          />
        ))}

        {/* Streaming / thinking state */}
        {(streamingContent || isThinking || pendingToolCalls.length > 0) && (
          <div className="py-2">
            {/* Model name header */}
            <div className="text-xs font-bold text-[var(--accent)] mb-1 tracking-wide uppercase">
              {modelName || "Assistant"}
            </div>

            {/* Pending tool calls */}
            {pendingToolCalls.length > 0 && (
              <div className="mb-2">
                {pendingToolCalls.map((tc) => (
                  <ToolCallBlock key={tc.id} tool={tc} />
                ))}
              </div>
            )}

            {/* Thinking indicator */}
            {isThinking && !streamingContent && (
              <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm">
                <span className="animate-pulse">●</span>
                <span>Thinking...</span>
              </div>
            )}

            {/* Streaming text */}
            {streamingContent && (
              <div className="prose whitespace-pre-wrap break-words text-[var(--text)]">
                {streamingContent}
                <span className="animate-pulse text-[var(--accent)]">▊</span>
              </div>
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
