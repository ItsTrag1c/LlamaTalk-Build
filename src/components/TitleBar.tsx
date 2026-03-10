import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getVersion } from "@tauri-apps/api/app";

const appWindow = getCurrentWindow();

interface TitleBarProps {
  onNavigateHome?: () => void;
  showHomeButton?: boolean;
}

export function TitleBar({ onNavigateHome, showHomeButton }: TitleBarProps) {
  const [version, setVersion] = useState("");
  useEffect(() => { getVersion().then(setVersion).catch(() => {}); }, []);

  return (
    <div
      data-tauri-drag-region
      className="flex items-center justify-between h-12 px-5 bg-[var(--bg-surface)] border-b border-[var(--border)] select-none shrink-0"
    >
      {/* Left: home button + app title */}
      <div className="flex items-center gap-3 text-base" data-tauri-drag-region>
        {showHomeButton && onNavigateHome && (
          <button
            onClick={onNavigateHome}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors"
            title="Home"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 8l6-6 6 6" />
              <path d="M4 7v6a1 1 0 001 1h2v-3h2v3h2a1 1 0 001-1V7" />
            </svg>
          </button>
        )}
        <span className="text-[var(--accent)] font-bold text-lg">LlamaTalk Build</span>
        {version && <span className="text-[var(--text-dim)] text-sm">v{version}</span>}
      </div>

      {/* Right: window controls */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => appWindow.minimize()}
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
        >
          <svg width="12" height="1" viewBox="0 0 12 1"><rect fill="currentColor" width="12" height="1"/></svg>
        </button>
        <button
          onClick={() => appWindow.toggleMaximize()}
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 12 12"><rect stroke="currentColor" strokeWidth="1.2" fill="none" x="0.5" y="0.5" width="11" height="11" rx="1.5"/></svg>
        </button>
        <button
          onClick={() => appWindow.close()}
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#ef4444] text-[var(--text-muted)] hover:text-white transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 12 12"><path stroke="currentColor" strokeWidth="1.4" d="M1 1l10 10M11 1l-10 10"/></svg>
        </button>
      </div>
    </div>
  );
}
