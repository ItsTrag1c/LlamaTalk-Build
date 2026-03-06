# Changelog — LlamaTalk Build

Last updated: 2026-03-06 (v0.4.0)

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

Last updated: 2026-03-06 (v0.4.0)
