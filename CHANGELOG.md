# Changelog — Clank Build Desktop

Last updated: 2026-03-10 (v2.4.3)

---

## v2.4.3 (2026-03-10)

### Security
- Auto-updater: frontend now passes checksum_url to Rust backend, activating SHA-256 verification on downloads
- Sidecar version bumped to 2.4.2 (fixes onboarding re-trigger logic)
- Rebuilt sidecar bundle: removed all internal claude-auth code permanently

---

## v2.4.0 — 2026-03-10

### New Features
- **Agents tab** — new sidebar tab for managing sub-agents. Create agents with name, role, model, and tool restrictions via an interactive form. Toggle enable/disable, delete with confirmation, and see tool badges at a glance.
- **Agents dashboard panel** — the home page now shows an Agents panel alongside Tasks. Displays all sub-agents with their status, role, and model. Quick enable/disable toggles right from the dashboard.
- **Agent management RPC** — new sidecar methods: `listAgents`, `createAgent`, `removeAgent`, `enableAgent`, `disableAgent`. All changes persist to config.
- **4-mode system** — Build, Plan, Q&A, and Manage modes. Mode toggle button shows all 4 with distinct colors (green, orange, cyan, purple).
- **Enhanced manager prompts** — deeply emphasizes the manager's role with detailed delegation protocol, quality control, accountability, and structured reporting.

### Security
- **SSRF redirect protection** — inherited from engine: manual redirect following with private IP re-validation per hop
- **Expanded private IP blocklist** — all RFC1918, IPv6 loopback, link-local, IPv4-mapped IPv6
- **Encrypted Telegram secrets** — bot token and access code encrypted at rest

### Engine Updates
All engine improvements from CLI v2.5.0 are included: sub-agent auto-approve, task tracking for delegations, silent background agents, and expanded destructive command blocklist.

---

## v2.3.0 — 2026-03-09

### New Features
- **Home page dashboard** — new landing page when no session is active. Shows recent sessions, active tasks with due dates, and a welcome greeting. Two-column layout with quick actions.
- **Onboarding page** — first-launch setup asks about your preferred stack, explanation style, and project types. Answers saved to lessons for personalized responses. Includes optional Telegram bot setup.
- **Telegram settings** — new settings section for managing Telegram bot token, access codes, and authenticated users. Access codes generated in-app for easy bot authentication.
- **Home button** — persistent home icon in the title bar to return to the dashboard from any view.

### Security
- **Update URL whitelist** — download URLs validated against official GitHub releases only.
- **Path traversal prevention** — installer asset names validated against directory traversal attacks.
- **File type restriction** — only `.exe` and `.msi` files accepted for updates.
- **Google API key protection** — API key moved from URL query string to `x-goog-api-key` header.
- **Config key whitelist** — `saveSetting` RPC only allows known config keys, preventing arbitrary config writes.
- **Provider whitelist** — `saveApiKey` validates against known providers.
- **Input length limits** — task descriptions, session titles, API keys, and onboarding lessons all length-validated.

### Improvements
- **Clean install** — NSIS installer hooks delete previous installation directory before installing.
- **Force re-onboarding** — upgrading from v2.2.0 triggers the onboarding flow for new features.

---

## v2.2.0 — 2026-03-09

### New Features
- **Self-learning agent** — the agent now learns over time. It saves personal preferences, successful patterns, mistakes, and problem-solution pairs to `lessons.md`. Lessons are injected into the system prompt each session for increasingly personalized responses.
- **`/reflect` command** — manually trigger session review and lesson extraction. Works in any mode.
- **Heuristic error capture** — tool errors are automatically saved as lessons at session end.
- **Tasks tab** — tasks moved from the Activity tab to their own dedicated sidebar tab with a checkmark icon, keeping the UI clean and organized.

### Improvements
- **Title bar version** — version number now pulled dynamically from Tauri API instead of being hard-coded. Always matches the build version.
- **Sidebar tab bar** — tightened spacing to accommodate 5 tabs (Sessions, Tools, Tasks, Activity, Settings).
- **Activity tab cleanup** — removed tasks section, now shows only session action buttons with cleaner layout.
- **Aggressive context compaction** — nuclear fallback when gentle compaction fails, instead of giving up.

### Bug Fixes
- **Fix prompt doubling after mode switch** — ANSI echo-fix now skips after slash commands where cursor geometry differs.

---

## v2.1.3 — 2026-03-08

### New Features
- **Recall mode** — new Q&A mode with no tool access. The model answers from its knowledge plus your saved memory and project context. Toggle through modes with the mode button (build → plan → recall) — shown in cyan with ◉ icon.

---

## v2.1.2 — 2026-03-08

### Improvements
- **Show version on home screen** — the welcome screen now displays the app version (e.g. "v2.1.2") pulled dynamically from Tauri's app config, so it always stays in sync with the build.

---

## v2.1.1 — 2026-03-08

### New Features
- **Working update button** — the Settings update button now checks GitHub releases for the latest `desktop-v*` tag, downloads the NSIS installer with a live progress percentage, and launches it automatically. No more manual downloads.

### Bug Fixes
- **Fix session restore** — clicking a past session in the sidebar now correctly loads its messages into the chat. Previously the messages were fetched but discarded.
- **Fix brain icon not visible** — the 🧠 memory-loading indicator was emitting start/done events synchronously, so React never rendered it. Added a brief pause between events.

---

## v2.1.0 — 2026-03-08

### Changed
- Versioned to match CLI at v2.1.0
- **Safety level rename** — tool risk labels renamed from safe/moderate/dangerous to low/medium/high across tools tab, settings toggles, and engine. Config auto-migrates existing keys on load.
- Updated application icon

---

## v0.2.0 — 2026-03-08 (patch 2026-03-08)

### Changed
- **Safety level rename** — tool risk labels renamed from safe/moderate/dangerous to low/medium/high across tools tab, settings toggles, and engine. Config auto-migrates existing keys on load.
- Updated application icon

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

Initial release of Clank Build Desktop, the desktop GUI for Clank Build.

### Core Features
- **Sidecar architecture** — Node.js process wrapping `clankbuild-engine` via JSON-RPC over stdin/stdout
- **Frameless window** — custom titlebar with minimize, maximize, and close buttons (1200x800)
- **Single-instance enforcement** — prevents duplicate app launches
- **React 19 + Vite 7 + Tailwind CSS 4 + Tauri 2** frontend stack
- **NSIS + MSI installers** via Tauri bundler

---

Last updated: 2026-03-08 (v0.2.0)
