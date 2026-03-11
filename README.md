# Clank Build Desktop

> Agentic coding assistant with a desktop GUI — part of the Clank Suite.

Clank Build Desktop wraps the Clank Build engine in a desktop interface. Same 14 tools, same ReAct agent loop, same memory and session system — with a visual experience. Built with React, Tailwind CSS, and Tauri (Rust backend).

> **Warning:** Clank Build can read, write, and delete files, execute shell commands, and modify your system. Review agent actions carefully. We recommend using MEDIUM or HIGH safety levels.

---

## Download

**[→ Latest Release](https://github.com/ItsTrag1c/Clank-Build/releases/latest)**

| File | Description |
|------|-------------|
| `Clank Build Desktop_x.y.z_x64-setup.exe` | Windows NSIS installer |
| `Clank Build Desktop_x.y.z_x64_en-US.msi` | Windows MSI installer |
| `Clank Build Desktop_x.y.z_aarch64.dmg` | macOS Apple Silicon |
| `SHA256SUMS.txt` | SHA-256 checksums for verification |

---

## Features

- **ReAct agent loop** — iterative reason-and-act cycle with streaming + tool calling
- **Manager/sub-agent architecture** — create specialized sub-agents with their own models and tool access. The main agent delegates, monitors, and reviews. Agents managed via the Agents sidebar tab.
- **4 agent modes** — Build (full agent), Plan (read-only exploration), Q&A (no tools, conversation only), Manage (agent coordination and delegation)
- **14 built-in tools** — read_file, write_file, edit_file, list_directory, search_files, glob_files, bash, git, web_fetch, web_search, npm_install, pip_install, install_tool, generate_file
- **Local models** — connects to [Ollama](https://ollama.com/), llama.cpp, LM Studio, vLLM, and other OpenAI-compatible backends
- **Cloud models** — Anthropic Claude, Google Gemini, OpenAI GPT, OpenCode (API key required)
- **Multi-server support** — connect to multiple local servers simultaneously; models auto-discovered and routed
- **Persistent memory** — global + topic-based memory files, plus per-project `.clankbuild.md`
- **3-tier safety system** — tools classified as Low, Medium, or High risk with confirmation prompts
- **Task management** — add tasks with due dates, mark complete, see overdue warnings
- **Session management** — browse, rename, resume, and delete past sessions
- **Home page dashboard** — landing page with recent sessions, active tasks, agents panel, and quick actions
- **Telegram bot support** — configure and manage Telegram bot settings from the Settings tab
- **PIN protection** — optional, PBKDF2-hashed; API keys encrypted at rest (AES-256-GCM)
- **Zero telemetry** — no analytics, no tracking, no cloud sync of any kind

---

## Install

1. Download the latest installer from [Releases](https://github.com/ItsTrag1c/Clank-Build/releases/latest)
2. Run the installer — a UAC prompt will appear (installs to `C:\Program Files\Clank Build Desktop\`)
3. Launch from the **Start Menu**

**Requirements:** Windows 10 or later (x64). [Ollama](https://ollama.com/) is required for local models — cloud models work without it.

---

## CLI Version

Prefer the terminal? **Clank Build CLI** provides the same agent engine from the command line. Both versions share the same config, memory, sessions, and API keys.

Install with PowerShell:
```powershell
irm https://raw.githubusercontent.com/ItsTrag1c/Clank-Build/cli/install.ps1 | iex
```

---

## Privacy

All data is stored locally on your device at `%APPDATA%\ClankBuild\`. When a PIN is set, API keys are encrypted at rest using AES-256-GCM. Nothing is collected, tracked, or synced to any server.

See our [Privacy Policy](https://clanksuite.dev/privacy) for full details.

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

---

*Part of the [Clank Suite](https://clanksuite.dev) — Created by [ItsTrag1c](https://github.com/ItsTrag1c) — [MIT License](LICENSE)*
