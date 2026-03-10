# Changelog — LlamaTalk Build

Last updated: 2026-03-09 (v2.3.1)

---

## v2.3.1 — 2026-03-09

### Bug Fixes
- **Telegram bot crash on deny** — fixed unhandled Telegram API errors in callback query handlers (confirm, plan action, session load) that caused the bot to silently crash when denying actions. Added try-catch around all `answerCallbackQuery` / `editMessageText` calls and a global `bot.catch()` error handler.

---

## v2.3.0 — 2026-03-09

### New Features
- **Telegram bot** — chat with the Build agent from Telegram. Start with `llamabuild --telegram`. All 14 tools work, streaming via message edits, tool confirmations via inline keyboards. Supports Build, Plan, and Recall modes. Bot commands: `/start`, `/new`, `/sessions`, `/mode`, `/model`, `/cancel`, `/status`.
- **Access code authentication** — Telegram bot generates an 8-character access code. Send it to the bot on Telegram to authenticate. Brute-force protected (5 attempts, 5-minute lockout).
- **`/telegram` command** — manage Telegram settings: view status, set bot token, generate access codes, list authenticated users.
- **`/home` command** — redisplay the dashboard with tasks, sessions, agent status, and command tips.
- **Enhanced dashboard** — launch banner now shows active tasks with due date indicators, agent status (memory, lessons), and command tips in a two-panel layout.
- **Onboarding "Get to Know You"** — after initial setup, the agent asks about your preferred stack, explanation style, project types, and more. Answers saved to lessons for personalized responses from day one.
- **Telegram opt-in during onboarding** — set up a Telegram bot token during first-run setup with auto-generated access code.

### Security
- **HTML injection prevention** — all user-controlled values escaped in Telegram HTML messages.
- **Safe config saving** — Telegram bot reloads config from disk before saving to prevent writing decrypted API keys.
- **Input validation** — session IDs restricted to alphanumeric, mode callbacks validated against whitelist, error messages sanitized.

### Improvements
- **Force re-onboarding** — upgrading from v2.2.0 triggers the full onboarding flow including new features.
- **Clean install** — NSIS installer deletes previous installation directory before installing.

---

## v2.2.0 — 2026-03-09

### New Features
- **Self-learning agent** — the agent now learns over time. It saves personal preferences (name, habits, communication style) under "About You", successful patterns, mistakes, and problem-solution pairs to `lessons.md` in the memory directory. Lessons are injected into the system prompt each session, making the agent increasingly personalized.
- **`/reflect` command** — manually trigger the agent to review the current session and extract lessons. Works in any mode (temporarily switches to build if in recall). Costs one LLM turn but produces deeper, more contextual insights.
- **Heuristic error capture** — tool errors are automatically saved as "mistakes" lessons at session end (no LLM call, capped at 5 per session).

### Improvements
- **Aggressive context compaction** — when gentle compaction fails to free enough space, a nuclear fallback drops all but the most recent messages instead of giving up with "Unable to reduce context further". Memory and lessons are preserved in the system prompt.
- **Banner updates** — `/model` changed to `/models` in header tips, `/reflect` added to all three banner layouts (minimal, compact, full).

### Bug Fixes
- **Fix prompt doubling after mode switch** — after `/mode` commands, the ANSI echo-fix was clearing wrong lines due to changed cursor geometry. Added a `lastWasCommand` flag that skips the clear sequence after slash commands.

---

## v2.1.3 — 2026-03-08

### New Features
- **Recall mode** — new `/mode recall` for direct Q&A without any tool usage. The model answers from its knowledge plus your saved memory and project context. No file reads, writes, or shell commands — just conversation. Cycle through modes with `/mode` (build → plan → recall) or set directly with `/mode recall`.

---

## v2.1.2 — 2026-03-08

### Bug Fixes
- **Fix session delete blocking all sessions** — `/session delete` was treating every session as "active" because `currentSession` was captured by value at startup instead of being a live reference. Changed to a getter so it always reflects the actual current session.

---

## v2.1.1 — 2026-03-08

### Improvements
- **`/update` auto-restarts** — after updating, the new version launches automatically in the same terminal instead of requiring a manual relaunch.
- **`/clear` resets terminal** — `/clear` now wipes the terminal screen and reprints the full banner with model, mode, and recent sessions, like a fresh launch.
- **Model moved to Llama's response line** — the selected model name now appears on the `Llama` response header instead of the user's prompt line, keeping the user line clean.

### Bug Fixes
- **Fix double-echo prompt** — Windows Terminal was displaying the user's typed input twice. The prompt line is now rewritten cleanly after input, eliminating the duplicate.
- **Fix brain icon not visible** — the 🧠 memory-loading indicator was being written and cleared in the same event loop tick. Added a stdout flush and brief pause so it actually renders on screen.

---

## v2.1.0 — 2026-03-08 (patch 2026-03-08)

### Changed
- **Safety level rename** — tool risk labels renamed from safe/moderate/dangerous to low/medium/high for clearer, more intuitive labeling. Config auto-migrates existing `autoApprove` keys on load.
- Updated application icon

---

## v2.1.0 — 2026-03-08

### New Features
- **Always-on memory** — memory now loads silently before every interaction regardless of config. A brief 🧠 brain icon flashes during loading. The `memoryEnabled` setting now only controls whether memory is injected into the system prompt.
- **Recursive memory (session summaries)** — each session automatically saves a one-line summary (tools used, files touched) to `sessions.md`. The agent sees the last 15 session summaries in its context, giving it awareness of prior work across sessions.
- **Task scheduling** — persistent task list stored as markdown in memory. New `/task` command: `/task add <desc> [--due YYYY-MM-DD]`, `/task done <n>`, `/task remove <n>`, `/task due`. Active tasks and due dates are injected into the agent's system prompt each turn.
- **`/server` command** — manage multiple local model servers: `/server` lists all with live status, `/server add <url>` tests and adds, `/server remove <n>` removes, `/server test` checks all connections.

### Improvements
- **Faster memory cache** — memory cache TTL reduced from 60s to 5s, keeping memory fresh without redundant file reads on every agent loop iteration.

### Bug Fixes
- **Git stash safety** — removed `stash` from `SAFE_SUBCOMMANDS` (it was in both SAFE and DANGEROUS sets). `git stash` now correctly requires confirmation as a DANGEROUS operation.

---

## v2.0.1 — 2026-03-08

### Changed
- Updated application icons to reflect new suite-wide branding

---

## v2.0.0 — 2026-03-07

### Icon & Branding Redesign (post-release patch — 2026-03-08)
- **New app icon** — replaced flat geometric llama with the 🦙 emoji tinted orange on a dark rounded-rect background, with a "B" badge overlay for Build. Generated via `@napi-rs/canvas` + `sharp` HSL hue-shifting pipeline.
- **CLI EXE icon** — pkg now embeds the Build icon via `--icon icons/build-icon.ico`.
- **GitHub branch rename** — `main` renamed to `cli`, Desktop branch is `desktop`. Default branch is now `cli`.

### UI Redesign (post-release patch — 2026-03-08)
- **New startup banner** — Claude Code-style bordered two-panel box replaces the ASCII text logo. Left panel shows greeting, braille-dot llama art, model/provider/mode status, and working directory. Right panel shows orange-highlighted tips and recent session history.
- **Responsive breakpoints** — banner adapts to terminal width: full two-panel (≥62 cols), compact single-panel (40–61), minimal bordered title (<40). Box scales from 62 to 120 columns and centers in the viewport.
- **Recent sessions in banner** — up to 3 recent sessions displayed with relative timestamps ("2h ago", "yesterday", etc.).
- **`/mode` toggle** — `/mode` now instantly toggles between build and plan instead of prompting for text input. Direct `/mode build` or `/mode plan` still works.

### Security (post-release patch — 2026-03-07)
- **Shell injection prevention** — all `execSync()` calls with string interpolation replaced with `spawnSync()` using argument arrays in `read-file.js` (PDF extraction), `generate-file.js` (pandoc fallback), `npm-install.js`, and `pip-install.js`. File paths and package names are no longer interpolated into shell command strings.
- **Package name validation hardened** — `validatePackageName()` regex version segment restricted to semver-safe characters, blocking shell metacharacters like `$()`, backticks, and semicolons.
- **Prototype pollution guard** — `deepMerge()` in `config.js` now skips `__proto__`, `constructor`, and `prototype` keys, preventing prototype pollution via malicious config files.

### New Features
- **Theme system** — unified theming engine (`src/ui/theme.js`) with semantic color tokens, box-drawing helpers, icon sets, and terminal-width utilities. All UI components now use consistent styling.
- **Agent instructions** — new `/instructions` command and `instructions.js` module to discover and display project-level agent instructions from `.llamabuild/agent/*.md` and `AGENTS.md` files. Instructions are injected into the system prompt.
- **Context compaction** — smarter conversation compression (`compaction.js`) that prunes old tool outputs first, then drops oldest messages, preserving more useful context before hitting limits.
- **Activity panel** — redesigned file-change panel (`activityPanel`) replaces the old sidebar, showing inline code-change boxes with diffs on file writes/edits.
- **Plan mode enforcement** — plan mode now truly blocks all write tools. Read-only tool detection (`isReadOnlyTool`) allows only safe tools (file reads, directory listings, search, read-only git subcommands) while rejecting writes and commands.

### Improvements
- **Debounced thinking spinner** — spinner only appears after 400ms of model silence (avoids flicker on fast responses) and shows elapsed time.
- **Richer banner** — startup banner shows active model, provider, and mode (now superseded by the two-panel redesign in the 2026-03-08 patch).
- **Better `/tools` display** — tool list now shows per-tool icons and safety dots instead of plain text tags.
- **`/mode` accepts arguments** — `/mode build` or `/mode plan` sets mode directly (now also toggles without arguments, see 2026-03-08 patch).
- **Cleaner `/help`** — updated command reference with new commands and removed sidebar toggle.
- **Agent prompt header** — agent response header uses `printAgentHeader()` for consistent formatting.
- **Turn timing** — agent loop tracks turn start time for future performance metrics.

### Internal
- Agent modes refactored from parallel arrays to a single `MODES` object with label, color, description, and icon per mode.
- Legacy color constants re-exported from `theme.js` for backward compatibility.
- Memory manager caches instructions block and invalidates on project root change.
- Removed unused `spawn` import from commands.

---

## v0.9.19 — 2026-03-07

### Performance
- **Faster streaming output** — response text now accumulated via array chunks instead of repeated string concatenation, eliminating O(n²) overhead on long responses. Same fix applied to Anthropic tool-call JSON buffering.
- **Parallel server detection** — startup model discovery now queries all configured servers simultaneously instead of sequentially, significantly reducing launch time with multiple servers.
- **Memory read caching** — topic memory files are cached in-memory with a 60-second TTL, reducing disk I/O from 30+ file reads per message to near zero on repeat queries. Cache invalidates on writes.
- **Optimized stream parser** — `streamLines()` rewritten to avoid quadratic buffer slicing on high-throughput streams.
- **Pre-compiled ANSI regex** — the escape-sequence stripping regex is compiled once at module load instead of per tool result.
- **Cached tool definitions** — tool schemas computed once per user message instead of per agent iteration.
- **Reduced spinner CPU** — thinking animation interval slowed from 80ms to 200ms (still smooth, less overhead).
- **Removed startup delay** — eliminated a 500ms artificial delay after first-run onboarding.

### Bug Fixes
- **Fixed double input echo on Windows** — user input no longer appears twice (once on the prompt line and again on the next line) in Windows Terminal. The readline echo artifact is now cleared immediately after input is received.

---

## v0.9.18 — 2026-03-07

### Improvements
- **Token counter and tk/s for all providers** — total tokens and tokens-per-second now display reliably after every generation. Ollama uses native eval timing; cloud providers and fallback models use wall-clock measurement from first token to stream end. If a provider doesn't report token counts, output tokens are estimated from response length.
- **Fixed GGUF model tool support** — models with namespaced names (e.g., `Qwen/Qwen2.5-Coder-14B-Instruct-GGUF`) were not recognized as tool-capable because the pattern matching expected the model name to start at the beginning. Patterns now match after an optional `namespace/` prefix.

---

## v0.9.17 — 2026-03-07

### Bug Fixes
- **Fixed /update in Program Files** — self-update (`/update`) failed with EPERM when installed in `C:\Program Files\` because the directory requires admin privileges. Now automatically falls back to launching the built NSIS installer with UAC elevation when direct file replacement fails.

---

## v0.9.16 — 2026-03-07

### Improvements
- **New thinking animation** — replaced the typewriter-style "Thinking" animation with a smooth braille spinner for a cleaner look while waiting for model responses.

### Bug Fixes
- **Removed connection timeout for local models** — local server connections no longer time out after 10 seconds. Models that take longer to load into memory (e.g., large quantized models) previously triggered a "Connection timeout after 10s" error. Cloud API connections retain their 30-second timeout.

---

## v0.9.15 — 2026-03-07

### Improvements
- **Model selection persists across restarts** — the model you choose (via `/model` or onboarding) is now preserved between sessions. Previously, startup auto-detection would always override your selection with the first available local model. Cloud models are now recognized as always-available, and local models are only replaced if they're no longer present on any connected server.

---

## v0.9.14 — 2026-03-06

### Bug Fixes
- **Fixed cloud models stuck on write tasks** — multiple provider-level bugs prevented tool calls from working reliably with cloud APIs:
  - **OpenAI/OpenCode:** tool calls accumulated during streaming were only emitted on specific `finish_reason` values. APIs that used different values (e.g., `"function_call"`) or ended the stream without an explicit finish_reason caused tool calls to be silently lost — the model appeared to do nothing. Added fallback emission after stream ends and support for all known finish_reason values. Also generates fallback IDs when the API omits tool call IDs.
  - **Anthropic:** multiple tool results from the same turn created consecutive `user` messages, violating Anthropic's strict role alternation requirement. Consecutive same-role messages are now merged automatically.
  - **Google Gemini:** assistant messages with function calls were serialized as JSON text instead of proper Gemini `functionCall` parts, causing the model to lose tool call history on follow-up requests. Fixed to preserve native Gemini parts structure. Also merges consecutive same-role messages.
- **Fixed infinite context compression loop** — if an API returned a context-length error but messages were too few to compress, the agent would retry the same failing request indefinitely. Now breaks with a helpful message if compression cannot reduce the conversation further.
- **Added connection timeout for API calls** — streaming HTTP requests to cloud APIs now time out after 30 seconds if no connection is established (10 seconds for local servers), preventing indefinite hangs.

---

## v0.9.13 — 2026-03-06

### Security
- **Inactivity timeout enforced during tool execution** — the session inactivity timeout is now checked before each individual tool call, not just at the start of each user prompt. Previously, long-running tool chains (e.g., bash with a 10-minute timeout) could keep the session unlocked indefinitely. Failed PIN re-authentication aborts all remaining tool calls.
- **Improved ANSI escape stripping** — the regex for stripping ANSI escape sequences from tool output now covers OSC sequences (`\x1B]0;...BEL`), character set selection (`\x1B(B`), and DECDWL (`\x1B#8`) in addition to standard CSI sequences. Prevents non-standard escape codes from reaching the LLM.
- **Confirmation prompts reset inactivity timer** — user interaction during batch confirmation prompts (`confirmBatch`) now resets the inactivity timer, preventing false lockouts while the user is actively reviewing tool calls.

---

## v0.9.12 — 2026-03-06

### Agent Behavior
- **Cloud models now use tools properly** — updated the system prompt to explicitly authorize the agent to read, write, edit, and execute tools regardless of provider. Cloud API models (Claude, GPT, Gemini via OpenCode, etc.) previously refused to make file changes due to their built-in safety guardrails conflicting with the "local coding assistant" framing. The agent is now told it runs inside a local tool with user permission and must never decline a tool call.

### r1 — Silent Release
- **Fixed ASCII banner alignment** — both large (Slant) and small (Small Slant) banners regenerated from correct figlet output. Previous version had misaligned characters and inconsistent line lengths. All lines now uniform width.

---

## v0.9.11 — 2026-03-06

### Security Hardening
- **IP blocking expanded** — server URL validation now blocks `0.0.0.0`, IPv6 loopback (`::1`, `[::1]`), and link-local (`169.254.x.x`) addresses in addition to the existing checks.
- **HTTPS enforcement for web_fetch** — remote URLs must use HTTPS; HTTP is only permitted for `localhost` and `127.x.x.x`. Prevents accidental plaintext requests to external servers.
- **Cloud URL allowlist** — cloud API calls are now validated against a strict domain allowlist (`api.anthropic.com`, `api.openai.com`, `generativelanguage.googleapis.com`, `opencode.ai`). Prevents custom base URLs from sending API keys to arbitrary servers.
- **Memory file encryption** — topic memory files and global `MEMORY.md` are now encrypted at rest using AES-256-GCM when a PIN is set. Existing plaintext files are read transparently and encrypted on next save.
- **Progressive PIN lockout** — failed PIN attempts now trigger increasing delays (5s, 15s, 30s) after the 2nd failure, with 5 total attempts before exit. Mitigates brute-force attacks.
- **ANSI escape stripping** — tool output (especially from bash) is now stripped of ANSI escape sequences before being sent to the model, preventing color codes from consuming context tokens or confusing the LLM.
- **Session inactivity timeout** — sessions automatically lock after 30 minutes of inactivity (configurable via `inactivityTimeoutMin`). Re-entry requires PIN re-authentication.

---

## v0.9.10 — 2026-03-06

### Branding
- **Renamed banner to LlamaTalkBuild** — the ASCII art banner displayed on startup now reads "LlamaTalkBuild" instead of "LlamaBuild" in both large and small variants. Terminal width threshold adjusted for the wider art.

---

## v0.9.9 — 2026-03-06

### New Provider
- **OpenCode support** — added OpenCode as a cloud provider. Connects to OpenCode Zen API (`opencode.ai/zen/v1/`) using OpenAI-compatible format. Provides access to 12 models including GPT-5.x, Claude 4.6, Gemini 3.x, MiniMax, Kimi, and Big Pickle — all through a single API key. Configure via onboarding or `/set api-key opencode <key>`.

---

## v0.9.8 — 2026-03-06

### New Tools
- **install_tool** — install system tools and global packages needed for tasks. Supports npm (global), pip, winget, and choco. Checks if already installed before installing. Requires user confirmation (DANGEROUS safety level) and a reason for the install.
- **generate_file** — generate documents in 10 formats: md, txt, html, csv, json, xml, yaml, yml, log, and pdf. PDF generation uses pdfkit with markdown-style parsing (headings, bold, lists, horizontal rules) with a pandoc fallback. Supports absolute paths for output outside the project with the same permission rules as write_file.

### Improvements
- **Bash external cwd** — the bash tool now supports running commands in directories outside the project root via the `cwd` parameter. Uses the same external path permission system (user confirmation required).
- **Changelog PDF alignment fix** — fixed the `# ` title header in generated changelog PDFs being slightly misaligned by using explicit x-position anchoring for all text elements.

---

## v0.9.7 — 2026-03-06

### Agent Behavior
- **Fixed external file access hallucination** — the agent would sometimes claim it cannot read files outside the project root, even though all file tools fully support absolute paths. The system prompt now explicitly states this capability and instructs the agent to never deny it.
- **Concise tool output** — the agent now summarizes completed actions in short sentences instead of echoing back full file contents and paths. Users can see full tool details in the sidebar and activity feed.

---

## v0.9.6 — 2026-03-06

### Sessions
- **Multiple sessions** — conversations are now tracked as named sessions. Sessions are auto-titled from the first message you send. Use `/session list` to see all saved sessions, `/session load <n>` to switch, `/session new` to start fresh, and `/session delete <n>` to clean up. The `--continue` flag loads the most recent session.

### Compact Tool Display
- **Compact tool call output** — tool calls now show a single line with the tool name and key argument (e.g., `● read_file src/index.js`) instead of full parameter dumps. Use `/more` after a response to see the full details of all tool calls from the last turn.

### Batch Permissions
- **Batch approval for tool calls** — when the agent needs to run multiple tools that require confirmation in the same turn, they're now grouped into a single prompt (e.g., "3 actions need approval: ...Allow all?") instead of asking for each one individually. Approve with "always" to auto-approve that safety level for the session.

### Document Display
- **PDF text extraction** — `read_file` now supports `.pdf` files, extracting readable text via `pdftotext` (poppler) or PowerShell fallback. Shows file size and extracted content.
- **Binary file detection** — binary files (images, archives, executables, etc.) are identified and display a summary instead of garbled output.

---

## v0.9.5 — 2026-03-06

### System Prompt
- **Rewritten base system prompt** — the agent's system prompt now provides a clear tool reference with descriptions and parameter signatures, along with concise behavioral rules. Replaces the previous generic prompt with a more direct, tool-focused style.

### Memory
- **Auto-create memory on first run** — onboarding now creates the memory directory and a starter `MEMORY.md` file pre-filled with the user's name. Existing users who skipped onboarding also get memory bootstrapped automatically on next session start.

---

## v0.9.4 — 2026-03-06

### External File Access
- **File tools now support paths outside the project root** — read, write, edit, list, search, and glob tools can now operate on files anywhere on the system when given an absolute path. External read operations prompt for confirmation (MODERATE), and external write/edit operations require explicit approval (DANGEROUS). Users can approve with "always" to auto-approve that safety level for the session, matching the Claude Code workflow.

### Memory Fixes
- **Fixed memory writes being blocked** — the agent's persistent memory directory (`%APPDATA%\LlamaTalkBuild\memory\`) was treated as an external path and rejected by the path validation system. The memory directory is now recognized as a trusted location, allowing the agent to read and write memory files without extra confirmation prompts.
- **Memory directory path now included in system prompt** — the agent is told the exact absolute path to its memory directory, so it can reliably save and load memory files using `write_file` and `read_file`.

---

## v0.9.3 — 2026-03-06

### Bug Fixes
- **Fixed self-update build failure** — the build scripts (`build-installer.js`, `make-changelog-pdf.js`) were excluded from the git repository by `.gitignore`, causing the self-update to fail with `MODULE_NOT_FOUND` when running `npm run build` in the temp directory. Both scripts are now tracked in git.

---

## v0.9.2 — 2026-03-06

### Bug Fixes
- **Fixed agent not using tools** — resolved a backend detection issue where modern Ollama servers (which expose `/v1/models`) were misclassified as "openai-compatible." This bypassed the tool capability check and prompt fallback, causing models without native function calling to ignore tools entirely and respond as plain text instead of using the agent loop.
- **Fixed crash on "always" approval** — selecting "always" at a tool confirmation prompt would crash the session with a TypeError if auto-approve settings hadn't been initialized yet. The approval state is now properly initialized before use.

---

## v0.9.1 — 2026-03-06

### Agent Modes
- **Removed Auto-Accept mode** — only Build and Plan modes remain. Build mode is now the default, confirming moderate and dangerous tool calls while auto-approving safe ones. The "always" approval option is now available in both modes.

### Self-Update
- **Improved `/update` instructions** — after a successful update, `/update` now displays clear step-by-step instructions on what to do next (close and reopen) instead of silently exiting. Also shows which version the current session is still running so users understand the update takes effect on next launch.

---

## v0.9.0 — 2026-03-06

### Session Activity Sidebar
- **New `/activity` command** — toggles a scrolling activity feed panel that appears after each file modification. Shows a bordered timeline of all changes made in the current session with timestamps, change type icons (`+` write, `~` edit, `>` read), and file paths. Older entries scroll off the top with a summary count.

### Session Changes Tracker
- **Automatic session-changes file** — file modifications are now tracked to `session-changes-llamabuild-YYYY-MM-DD.md` in the project root. Each session appends a timestamped block listing every write and edit with file paths and summaries. The filename updates automatically when the date changes, and old date files are cleaned up. The file is only written when actual file modifications occur — read-only sessions produce no output.

---

## v0.8.0 — 2026-03-06

### Bug Fixes
- **Fixed Plan mode getting stuck after accepting** — pressing Y to proceed with a plan now properly switches to Build mode. Previously the system prompt wasn't rebuilt after the mode transition, causing the model to keep planning instead of executing.
- **Fixed doubled key inputs** — resolved an issue where keystrokes could be processed twice during streaming or confirmation prompts. The escape key watcher now properly pauses the main readline interface, and confirmation dialogs reuse the existing readline instead of creating a conflicting second instance.
- **Fixed generation appearing stuck (prompt fallback)** — models using XML tool-call fallback (non-native tool calling) now stream text progressively instead of buffering the entire response. Previously nothing appeared on screen until generation completed.

### Build Mode
- **Individual confirmation for every action** — Build mode no longer shows the "always" option in confirmation prompts. Each file write, edit, and git operation must be individually approved with `(y/n)`, ensuring full control over every change.

### Code Changes Sidebar
- **New `/sidebar` command** — toggles an inline code preview panel that appears after each file modification. Shows a bordered view of the changed file with line numbers (for writes) or a colored diff (for edits). Long files are truncated with a summary.

### Session Logging
- **Automatic session log** — every tool execution is now recorded in `.llamabuild-session.md` in the project root. Each session gets a timestamped section listing all actions taken. New sessions prepend at the top. The file is only written when changes actually occur.

---

## v0.7.0 — 2026-03-06

### Agent Modes
- **Renamed Accept mode to Auto-Accept mode** — the default mode is now labeled "Auto-Accept" in the prompt, `/mode` cycling, and help text to better describe its behavior.
- **Plan mode "Proceed with Plan" prompt** — when the agent finishes presenting a plan in Plan mode, you're now asked "Proceed with Plan? (y/n)". Answering yes automatically switches to Build mode and begins executing the plan step by step.
- **Build mode step-by-step confirmation** — Build mode now asks for permission before each write, edit, bash, or git operation instead of auto-approving everything. Safe read operations still auto-approve.

### Context Management
- **Improved context error handling** — when running out of context, the app now always displays "Clearing Context" and recovers automatically instead of showing an error. Broader error pattern matching ensures no provider-specific context errors slip through.

### Self-Update
- **Startup cleanup** — old `.old.exe` backups and previous versioned EXEs from prior `/update` runs are now cleaned up automatically on launch.
- **Reliable update flow** — `/update` now exits cleanly after updating and asks the user to restart, fixing issues where the new version wasn't displayed after an in-place update on Windows.

---

## v0.6.0 — 2026-03-06

### Context Management
- **Context usage indicator** — usage line now shows context window utilization percentage after each response (e.g. `42% context`). Color-coded: dim below 80%, yellow at 80%+, red at 95%+.
- **Automatic context compression** — when context usage exceeds 80% (configurable via `contextThreshold`), the conversation is automatically compressed: older messages are summarized and condensed so the agent can continue working without interruption.
- **Error recovery** — if the model returns a context-length error, messages are compressed and the request is retried automatically instead of crashing.
- **Clearing Context banner** — displays `⟳ Clearing Context` when compression is triggered so users know what's happening.

---

## v0.5.1 — 2026-03-06

### Self-Update Fixes
- **Auto-restart after update** — `/update` now automatically relaunches with the new EXE instead of asking the user to restart manually.
- **Old version cleanup** — after a successful update, old `.old.exe` backups and previous versioned setup/standalone EXEs are removed from the install directory.

---

## v0.5.0 — 2026-03-06

### Mode Switching
- **Removed Shift+Tab mode switching** — `/mode` is now the only way to cycle agent modes (Accept/Build/Plan). Simplifies input handling and avoids terminal compatibility issues with Shift+Tab.
- **Updated hints and help text** — shortcut hint bar and `--help` output now reference `/mode` instead of Shift+Tab.

---

## v0.4.0 — 2026-03-06

### Install
- **PowerShell one-liner install** — `install.ps1` added to repo root; queries GitHub API for latest release, downloads standalone EXE to `$HOME\LlamaTalkBuild\`, writes `llamabuild.cmd`, adds to user PATH; no admin rights needed. README updated with `irm .../install.ps1 | iex` as primary install method.

### Bug Fixes
- **Fixed Shift+Tab mode not updating prompt** — Shift+Tab cycled the internal mode variable but the displayed prompt still showed the old mode. Now calls `rl.setPrompt()` with the rebuilt prompt string so the mode label updates immediately in the input line.

---

## v0.3.0 — 2026-03-06

### Agent Modes
- **Shift+Tab mode switching** — cycle between three agent modes at any time during a session:
  - **Accept Mode** (default) — prompts to accept each change based on safety level.
  - **Build Mode** — auto-approves all tool calls for uninterrupted execution.
  - **Plan Mode** — agent presents a full numbered plan of all changes before executing; always confirms moderate/dangerous tools regardless of session auto-approve.
- **`/mode` slash command** — alternative to Shift+Tab for cycling agent modes.
- **Mode indicator in prompt** — current mode displayed inline: `You [model] (Accept) >`.

### Self-Update
- **Version-match guard on `/update`** — when the remote version matches the installed version, `/update` now reports "LlamaTalk Build vX.Y.Z is already up to date" and skips the build entirely.

---

## v0.2.0 — 2026-03-06

### Self-Update
- **`/update` command** — pulls latest source from the public GitHub repo (`ItsTrag1c/LlamaTalk-Build`), compares versions, runs `npm install` + `npm run build`, and replaces the installed EXE in-place. Prompts to restart after a successful update. When running from source, reports the path to the built artifacts instead.

### Repository
- **GitHub repo made public** — `ItsTrag1c/LlamaTalk-Build` is now a public repository, enabling `/update` to work without authentication on end-user machines.

---

## v0.1.1 — 2026-03-06

### Interface
- **"Llama Agent" response label** — agent responses now display "Llama Agent >" in orange before the streamed text, matching the user prompt style.
- **ASCII banner fix** — fixed missing character in the large "LlamaBuild" ASCII art (second `a` in "Llama" was incomplete).

---

## v0.1.0 — 2026-03-06

Initial release of LlamaTalk Build, the agentic coding assistant for the LlamaTalk Suite.

### Agent
- **ReAct-style agent loop** — iterative reason-and-act cycle: LLM reasons about the task, calls tools, observes results, and repeats until the task is complete or a text-only response is given.
- **12 built-in tools** — read_file, write_file, edit_file, list_directory, search_files, glob_files, bash, git, web_fetch, web_search, npm_install, pip_install.
- **3-tier safety system** — tools classified as Safe (auto-approved), Moderate (confirm unless auto-approve enabled), or Dangerous (always confirm unless `--trust` flag is set). Confirmations show exactly what will happen before executing.
- **Session change tracking** — all file modifications tracked in-session for `/undo` (restore last change) and `/diff` (list all changes).

### Providers
- **Multi-provider support** — Ollama, llama.cpp, LM Studio, vLLM, Anthropic Claude, Google Gemini, and OpenAI.
- **Native tool-calling** — each provider adapter handles its own streaming format and tool-call protocol (Anthropic SSE tool_use blocks, OpenAI SSE delta.tool_calls, Ollama NDJSON, Gemini SSE functionCall).
- **XML prompt fallback** — models without native tool support get tool descriptions injected into the system prompt as XML; tool calls parsed from `<tool_call>` blocks in text output.
- **Multi-server aggregation** — connect to multiple local model servers simultaneously; models auto-discovered and routed to the correct server.
- **Auto-detect running model** — on startup, queries backends for the currently loaded model and selects it automatically.

### Memory
- **Persistent memory system** — global `MEMORY.md` (always loaded), topic `.md` files (keyword-matched against user messages), and per-project `.llamabuild.md` (auto-loaded from working directory).
- **Keyword-based retrieval** — extracts keywords from user input, scores topic files by filename and header relevance, injects top 3 matches into system prompt.
- **Memory commands** — `/memory` shows status, `/memory list` shows all files, `/memory save <topic>` creates a new topic file.

### Security
- **PIN login** — optional PIN with PBKDF2 hashing (100k iterations, random salt).
- **AES-256-GCM encryption** — API keys encrypted at rest in config, decrypted in-memory after PIN entry.
- **Path traversal prevention** — all file tools validate paths don't escape the project root; symlinks checked.
- **Destructive command blocking** — bash tool blocks dangerous commands (`rm -rf /`, `format`, `shutdown`, etc.).
- **Link-local IP blocking** — server URLs validated against 169.254.x.x and other unsafe addresses.

### Interface
- **Interactive REPL** — readline-based prompt with conversation history.
- **Streaming responses** — token-by-token display from all providers.
- **Slash commands** — `/help`, `/model`, `/models`, `/settings`, `/tools`, `/context`, `/memory`, `/undo`, `/diff`, `/trust`, `/compact`, `/clear`, `/set`, `/quit`.
- **First-run onboarding** — interactive wizard for name, PIN, server URL, cloud API keys, and model selection.
- **ASCII banner** — auto-centered "LlamaBuild" banner with large/small variants based on terminal width.

### Build
- **Standalone Windows EXE** — esbuild bundles to CJS, pkg compiles to ~36 MB EXE (node18-win-x64). No runtime dependencies required.
- **CLI flags** — `--version`, `--help`, `--model`, `--continue`, `--compact`, `--no-memory`, `--no-banner`, `--trust`.

---

## Upcoming

- Conversation persistence across sessions
- Esc cancellation during generation
- Token counting and TK/S display
- Context window management and truncation
- macOS / Linux support

---

Last updated: 2026-03-08 (v2.1.0)
