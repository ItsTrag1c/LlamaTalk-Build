import { getCurrentWindow } from "@tauri-apps/api/window";

const appWindow = getCurrentWindow();

export function TitleBar() {
  return (
    <div
      data-tauri-drag-region
      className="flex items-center justify-between h-12 px-5 bg-[var(--bg-surface)] border-b border-[var(--border)] select-none shrink-0"
    >
      {/* Left: app title */}
      <div className="flex items-center gap-3 text-base" data-tauri-drag-region>
        <span className="text-[var(--accent)] font-bold text-lg">LlamaTalk Build</span>
        <span className="text-[var(--text-dim)] text-sm">v0.1.0</span>
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
