# Changelog — Clank Desktop

Last updated: 2026-03-11 (v2.4.15)

---

## v2.4.15 (2026-03-11)

### Changes
- **Removed sub-agent system** — temporarily rolling back manage mode, agents tab, delegation tools, scheduler, and all sub-agent management while the feature is being stabilized.

---

## v2.4.14 (2026-03-11)

### Bug Fixes
- **Scheduled tasks now actually trigger** — engine update: fixed `_running` cleanup in error handler so schedules don't get permanently stuck.
- **Multi-step scheduled tasks now complete** — engine update: scheduled execution now has continuation logic matching `delegate_to_agent`, re-prompting up to 3 times when responses suggest incomplete work.

---

## v2.4.13 (2026-03-11)

### Bug Fixes
- **Scheduler now triggers agents** — engine update: immediate tick on start, tick after schedule add, `_running` cleanup on errors, and proper error event emission.

---

## v2.4.12 (2026-03-11)

### Bug Fixes
- **Delegation tasks no longer auto-completed** — engine update: tasks created by `delegate_to_agent` were prematurely marked "completed" when any tool was used. Now removed as transient tracking entries — the manager decides actual completion.

---

## v2.4.11 (2026-03-11)

### New Features
- **Autonomous job scheduler** — sub-agents can now be assigned recurring or one-shot scheduled tasks via the manager agent. Uses cron-style expressions with shorthands like `@hourly`, `@daily`, `@every_30m`. Schedules persist across restarts. Scheduler events forwarded to frontend via RPC.

### Improvements
- **Multi-step sub-agent completion** — engine update: sub-agents now reliably complete multi-step tasks instead of stopping after the first tool call. Continuation mechanism re-prompts up to 3 times when incomplete work is detected.
- **Provider tool compatibility** — engine update: Ollama preserves `tool_calls` and `tool_call_id` in conversation history, Google/Gemini preserves `enum` in tool schemas, integer types corrected across all tool definitions.

---

## v2.4.10 (2026-03-11)

### Bug Fixes
- **Ollama provider preserves tool_calls in conversation history** — engine update: assistant messages were stripped of `tool_calls` when sent to the Ollama API, breaking the tool-use cycle after one round. Sub-agents now correctly continue multi-step tool sequences.

---

## v2.4.9 (2026-03-11)

### Improvements
- **Sub-agent execution directive** — engine update: sub-agents receive a stronger system prompt that forces immediate tool usage, and delegated tasks are wrapped with execution instructions.

---

## v2.4.8 (2026-03-11)

### Improvements
- **Fuzzy tool name matching for sub-agents** — engine update: tool names resolve via aliases, partial matches, and common shortcuts when creating or loading sub-agents.
- **Sub-agents auto-approve all tool calls** — engine update: delegation approval covers all sub-agent tool usage, removing individual confirmation prompts that blocked the cycle.

---

## v2.4.7 (2026-03-11)

### Bug Fixes
- **Sub-agent conversation file now created on delegation** — engine update: conversation file is written to disk immediately when the sub-agent is initialized, preventing tasks from failing due to a missing backing file.
- **Sub-agent engine reused across consecutive delegations** — engine update: engines are cached per session so repeated delegations to the same agent don't orphan conversation files.

---

## v2.4.6 (2026-03-11)

### Bug Fixes
- **Sub-agent tasks no longer marked complete without actual work** — engine update: the delegation tool now tracks whether the sub-agent actually used tools. If it didn't, it retries once with explicit instructions, and reports failure to the manager if the sub-agent still won't act. Tasks are only marked complete when real work was performed.

---

## v2.4.5 (2026-03-11)

### Bug Fixes
- **Qwen3.x models now recognized as tool-capable** — engine update: the Ollama provider only matched Qwen2/2.5 in its tool-capable patterns. Qwen3.5 and all Qwen3 variants were silently excluded, so sub-agents using these models couldn't execute tools.
- **File-writing tools reject null/non-string content** — engine update: `write_file`, `edit_file`, and `generate_file` now require content to be a non-null string, preventing files from being blanked by malformed tool arguments.

---

## v2.4.4 (2026-03-11)

### Bug Fixes
- **Sub-agents with non-tool-name entries in tools config no longer get empty registries** — engine update: if a sub-agent's `tools` array contained documentation strings instead of actual tool names, the tool registry was empty. The filter now validates entries against real tool names and falls back to all tools if none match.

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
