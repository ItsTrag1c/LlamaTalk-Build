interface ConfirmDialogProps {
  actions: string[];
  onResolve: (result: boolean | "always") => void;
}

export function ConfirmDialog({ actions, onResolve }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-2xl max-w-lg w-full mx-4 p-7">
        <h3 className="text-lg font-bold text-[var(--accent)] mb-4">
          Confirm Actions
        </h3>
        <div className="space-y-2.5 mb-6">
          {actions.map((action, i) => (
            <div
              key={i}
              className="text-[15px] text-[var(--text)] bg-[var(--bg)] rounded-xl px-5 py-3 font-mono"
            >
              {action}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onResolve(true)}
            className="flex-1 px-5 py-3 text-base font-semibold rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white transition-colors"
          >
            Approve
          </button>
          <button
            onClick={() => onResolve("always")}
            className="flex-1 px-5 py-3 text-base font-semibold rounded-xl border border-[var(--border)] hover:bg-[var(--bg-hover)] text-[var(--text-muted)] transition-colors"
          >
            Always
          </button>
          <button
            onClick={() => onResolve(false)}
            className="flex-1 px-5 py-3 text-base font-semibold rounded-xl border border-[var(--error)]/30 hover:bg-[var(--error)]/10 text-[var(--error)] transition-colors"
          >
            Deny
          </button>
        </div>
      </div>
    </div>
  );
}
