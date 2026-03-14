<p align="center">
  <img src="docs/banner.png" alt="Clank Suite" width="100%" />
</p>

# Clank Desktop

> Agentic assistant with a desktop GUI — powered by local models and cloud providers.

Clank Desktop wraps the Clank engine in a desktop interface. Same 14 tools, same ReAct agent loop, same memory and session system — with a visual experience built on React, Tailwind CSS, and Tauri.

> **Warning:** Clank can read, write, and delete files, execute shell commands, and modify your system. Review agent actions carefully. We recommend using MEDIUM or HIGH safety levels.

---

## Download

**[→ Latest Release](https://github.com/ItsTrag1c/Clank/releases/latest)**

| File | Description |
|------|-------------|
| `Clank.Desktop_2.4.18_x64-setup.exe` | Windows NSIS installer |
| `Clank.Desktop_2.4.18_x64_en-US.msi` | Windows MSI installer |
| `Clank.Desktop_2.4.18_aarch64.dmg` | macOS Apple Silicon |
| `SHA256SUMS.txt` | SHA-256 checksums for verification |

**macOS Apple Silicon (M1-M4):** Direct download — [Clank.Desktop_2.4.18_aarch64.dmg](https://github.com/ItsTrag1c/Clank/releases/download/v2.5.21/Clank.Desktop_2.4.18_aarch64.dmg)

---

## Features

- **ReAct agent loop** — iterative reason-and-act cycle with streaming + tool calling
- **3 agent modes** — Build (full agent), Plan (read-only exploration), Q&A (web search + conversation)
- **14 built-in tools** — read_file, write_file, edit_file, list_directory, search_files, glob_files, bash, git, web_fetch, web_search, npm_install, pip_install, install_tool, generate_file
- **Local models & cloud providers** — Ollama, llama.cpp, LM Studio, vLLM, Claude, Gemini, OpenAI, and any OpenAI-compatible backend
- **Local model optimizations** — auto-detects context window size, adaptive result truncation, compact system prompts, tiered tool sets, memory budgeting, and earlier compaction — reducing context overhead by 50-80% for local LLMs. Configurable via `localOptimizations` in config; cloud models unaffected.
- **Multi-server support** — connect to multiple local servers simultaneously; models auto-discovered and routed
- **Persistent memory** — global + topic-based memory files, plus per-project `.clank.md`
- **3-tier safety system** — tools classified as Low, Medium, or High risk with confirmation prompts
- **Task management** — add tasks with due dates, mark complete, see overdue warnings
- **Session management** — browse, rename, resume, and delete past sessions
- **Home page dashboard** — landing page with recent sessions, active tasks, and quick actions
- **Telegram bot support** — configure and manage Telegram bot settings from the Settings tab
- **PIN protection** — optional, PBKDF2-hashed; API keys encrypted at rest (AES-256-GCM)
- **Zero telemetry** — no analytics, no tracking, no cloud sync of any kind

---

## Install

### macOS

1. Download [Clank.Desktop_2.4.18_aarch64.dmg](https://github.com/ItsTrag1c/Clank/releases/download/v2.5.21/Clank.Desktop_2.4.18_aarch64.dmg)
2. Open the `.dmg` file and drag **Clank Desktop** to your Applications folder
3. Launch from **Applications** or Spotlight

**Requirements:** macOS 12.0+ (Apple Silicon M1-M4). [Ollama](https://ollama.com/) is required for local models — cloud models work without it.

### Windows

1. Download the latest installer from [Releases](https://github.com/ItsTrag1c/Clank/releases/latest)
2. Run the installer — a UAC prompt will appear (installs to `C:\Program Files\Clank Desktop\`)
3. Launch from the **Start Menu**

**Requirements:** Windows 10 or later (x64). [Ollama](https://ollama.com/) is required for local models — cloud models work without it.

---

## CLI Version

Prefer the terminal? **Clank CLI** provides the same agent engine from the command line. Available on Windows and macOS. Both versions share the same config, memory, sessions, and API keys.

**macOS (Homebrew):**
```bash
brew install clankai/clank/clank
```

**Windows (PowerShell):**
```powershell
irm https://raw.githubusercontent.com/ItsTrag1c/Clank/cli/install.ps1 | iex
```

**macOS (manual)** — download the `Clank` binary from [Releases](https://github.com/ItsTrag1c/Clank/releases/latest), then:
```bash
chmod +x Clank && sudo mv Clank /usr/local/bin/clank
```

**Current CLI Version:** v2.5.21

---

## Privacy

All data is stored locally on your device (`%APPDATA%\Clank\` on Windows, `~/.clank/` on macOS). When a PIN is set, API keys are encrypted at rest using AES-256-GCM. Nothing is collected, tracked, or synced to any server.

See our [Privacy Policy](https://clanksuite.dev/privacy) for full details.

---

## Community

- [X (@ClankSuite)](https://x.com/ClankSuite)
- [Reddit (r/ClankSuite)](https://reddit.com/r/ClankSuite)
- [GitHub](https://github.com/ItsTrag1c/Clank)

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

---

*Part of the [Clank Suite](https://clanksuite.dev) — Created by [ItsTrag1c](https://github.com/ItsTrag1c) — [MIT License](LICENSE)*
