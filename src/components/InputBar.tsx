import { useState, useRef, useEffect } from "react";
import type { AgentMode } from "../lib/types";

interface InputBarProps {
  onSend: (text: string) => void;
  onCancel: () => void;
  onToggleMode: () => void;
  disabled: boolean;
  isStreaming: boolean;
  mode: AgentMode;
}

export function InputBar({ onSend, onCancel, onToggleMode, disabled, isStreaming, mode }: InputBarProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!disabled && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [disabled]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 200) + "px";
    }
  }, [input]);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === "Escape" && isStreaming) {
      onCancel();
    }
  };

  return (
    <div className="shrink-0 border-t border-[var(--border)] bg-[var(--bg-surface)] px-6 py-4">
      <div className="flex items-end gap-3">
        {/* Mode toggle button */}
        <button
          onClick={onToggleMode}
          className={`shrink-0 px-4 py-3 rounded-xl text-[15px] font-semibold border transition-colors ${
            mode === "build"
              ? "border-[var(--success)]/30 text-[var(--success)] hover:bg-[var(--success)]/10"
              : mode === "plan"
                ? "border-[var(--warning)]/30 text-[var(--warning)] hover:bg-[var(--warning)]/10"
                : mode === "manage"
                  ? "border-purple-400/30 text-purple-400 hover:bg-purple-400/10"
                  : "border-cyan-400/30 text-cyan-400 hover:bg-cyan-400/10"
          }`}
          title={`Switch to ${mode === "build" ? "Plan" : mode === "plan" ? "Q&A" : mode === "qa" ? "Manage" : "Build"} mode`}
        >
          {mode === "build" ? "● Build" : mode === "plan" ? "◐ Plan" : mode === "qa" ? "◉ Q&A" : "◈ Manage"}
        </button>

        {/* Text input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isStreaming
                ? "Press Escape to cancel..."
                : mode === "plan"
                  ? "Describe what to plan..."
                  : mode === "qa"
                    ? "Ask anything..."
                    : mode === "manage"
                      ? "Tell your agents what to do..."
                      : "Start your project, recall memory... BUILD!"
            }
            disabled={disabled && !isStreaming}
            rows={1}
            className="w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--bg)] px-5 py-3 text-base text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)] transition-colors disabled:opacity-50"
          />
        </div>

        {/* Send / Stop button */}
        {isStreaming ? (
          <button
            onClick={onCancel}
            className="shrink-0 w-11 h-11 flex items-center justify-center rounded-xl bg-[var(--error)] hover:bg-red-600 text-white transition-colors"
            title="Stop"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <rect width="14" height="14" rx="2" />
            </svg>
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || disabled}
            className="shrink-0 w-11 h-11 flex items-center justify-center rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Send"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13" />
              <path d="M22 2L15 22L11 13L2 9L22 2Z" />
            </svg>
          </button>
        )}
      </div>
      <div className="flex items-center justify-center gap-5 mt-2.5 text-sm text-[var(--text-dim)]">
        <span>Enter to send</span>
        <span>Shift+Enter for newline</span>
        {isStreaming && <span>Esc to cancel</span>}
      </div>
    </div>
  );
}
