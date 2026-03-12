import { useEffect, useRef, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import type { Message, ToolCall } from "../lib/types";
import { MessageBubble } from "./MessageBubble";
import { ToolCallBlock } from "./ToolCallBlock";

interface ChatAreaProps {
  messages: Message[];
  streamingContent: string;
  pendingToolCalls: ToolCall[];
  isThinking: boolean;
  isLoadingMemory?: boolean;
  profileName?: string;
  modelName?: string;
}

export function ChatArea({ messages, streamingContent, pendingToolCalls, isThinking, isLoadingMemory, profileName, modelName }: ChatAreaProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [appVersion, setAppVersion] = useState("");

  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent, pendingToolCalls]);

  const hasContent = messages.length > 0 || streamingContent || isThinking || isLoadingMemory;

  return (
    <div className="flex-1 overflow-y-auto flex flex-col">
      {/* Spacer pushes content to bottom when short */}
      {hasContent && <div className="flex-1 min-h-4" />}

      {!hasContent && (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <div className="text-7xl mb-6">🦙</div>
          <h2 className="text-2xl font-bold text-[var(--text)]">Clank{appVersion && <span className="text-[var(--text-dim)] font-normal text-lg ml-2">v{appVersion}</span>}</h2>
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

        {/* Memory loading indicator */}
        {isLoadingMemory && !streamingContent && !isThinking && (
          <div className="py-2">
            <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm">
              <span className="animate-pulse text-lg">🧠</span>
            </div>
          </div>
        )}

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
