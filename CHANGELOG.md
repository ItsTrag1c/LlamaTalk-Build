# Changelog — LlamaTalk Build Desktop

Last updated: 2026-03-08 (v0.2.0)

---

## v0.2.0 — 2026-03-08

### New Features
- **Always-on memory with brain icon** — memory loads silently before every interaction. An animated 🧠 icon appears in the chat area during loading, before the thinking indicator.
- **Recursive memory (session summaries)** — each session automatically saves a summary. The agent sees recent session history, giving it context from prior work.
- **Tasks panel** — new Tasks section at the top of the Activity tab. Add tasks with optional due dates, mark complete with checkboxes, see overdue/due-today warnings in amber/red. Collapsible completed section.
- **Multi-server settings** — replaced single server URL input with a full multi-server UI in Settings. Shows primary server with status dot, additional servers from `localServers[]` with test/remove buttons, and an "Add Server" row.
- **Task RPC methods** — sidecar exposes `listTasks`, `addTask`, `completeTask`, `removeTask` for frontend task management.

### Improvements
- **Faster memory cache** — memory cache TTL reduced from 60s to 5s.
- **Memory prompt toggle renamed** — "Memory enabled" setting renamed to "Memory in prompt" to reflect that memory always loads but the toggle controls prompt injection.

### Bug Fixes
- **Git stash safety** — `git stash` now correctly requires confirmation as a DANGEROUS operation.

---

## v0.1.1 — 2026-03-08

### Changed
- Updated application icons to reflect new suite-wide branding

---

## v0.1.0 — 2026-03-08

Initial release of LlamaTalk Build Desktop, the desktop GUI for LlamaTalk Build.

### Core Features
- **Sidecar architecture** — Node.js process wrapping `llamatalkbuild-engine` via JSON-RPC over stdin/stdout
- **Frameless window** — custom titlebar with minimize, maximize, and close buttons (1200x800)
- **Single-instance enforcement** — prevents duplicate app launches
- **React 19 + Vite 7 + Tailwind CSS 4 + Tauri 2** frontend stack
- **NSIS + MSI installers** via Tauri bundler

---

Last updated: 2026-03-08 (v0.2.0)
