# LlamaTalk Build — CLI & Desktop

> Agentic coding assistant — terminal and GUI — part of the LlamaTalk Suite.

LlamaTalk Build is an agentic coding assistant — available as a standalone terminal app (CLI) and a desktop GUI. Both versions share the same engine, config, memory, and sessions. It uses a ReAct-style agent loop to help you with coding tasks: it reasons about what to do, uses tools to read/edit files, run commands, and search code, then explains what it did. Works with local models via Ollama and cloud providers.

---

## Install

```powershell
irm https://raw.githubusercontent.com/ItsTrag1c/LlamaTalk-Build/cli/install.ps1 | iex
```

Run this in PowerShell to download and install the latest release. Open a new terminal and type `llamabuild`.

---

## Download

**[→ Latest Release](https://github.com/ItsTrag1c/LlamaTalk-Build/releases/latest)**

| File | Description |
|------|-------------|
| `LlamaTalk Build_x.y.z_setup.exe` | Windows installer — installs to Program Files, adds `llamabuild` to PATH |
| `LlamaTalkBuild_x.y.z.exe` | Standalone EXE — run anywhere, no admin rights needed |
| `checksums.txt` | SHA-256 checksums for verification |

---

## Desktop App

The desktop version provides the same agentic engine in a windowed interface. Available on Windows and macOS.

**[→ Latest Desktop Release](https://github.com/ItsTrag1c/LlamaTalk-Build/releases/latest)**

| File | Description |
|------|-------------|
| `LlamaTalk Build Desktop_x.y.z_x64-setup.exe` | Windows installer |
| `LlamaTalk Build Desktop_x.y.z_aarch64.dmg` | macOS Apple Silicon |
| `LlamaTalk Build Desktop_x.y.z_x64_en-US.msi` | Windows MSI |

---

## Features

- **ReAct agent loop** — iterative reason-and-act cycle with streaming + tool calling
- **14 built-in tools** — read_file, write_file, edit_file, list_directory, search_files, glob_files, bash, git, web_fetch, web_search, npm_install, pip_install, install_tool, generate_file
- **Local models** — connects to [Ollama](https://ollama.com/), llama.cpp, LM Studio, vLLM, and other OpenAI-compatible backends
- **Cloud models** — Anthropic Claude, Google Gemini, OpenAI GPT (API key required)
- **Native tool-calling** — each provider uses its own tool-call protocol; XML fallback for models without native support
- **Multi-server support** — connect to multiple local servers simultaneously; models auto-discovered and routed
- **Persistent memory** — global + topic-based memory files, plus per-project `.llamabuild.md`
- **3-tier safety system** — tools classified as Safe, Moderate, or Dangerous with confirmation prompts
- **PIN protection** — optional, PBKDF2-hashed; API keys encrypted at rest (AES-256-GCM)
- **Session tracking** — `/undo` to restore last file change, `/diff` to see all changes

---

## Usage

```
llamabuild [options]
```

| Flag | Description |
|------|-------------|
| `-v, --version` | Print version and exit |
| `-h, --help` | Print help and exit |
| `-m, --model <name>` | Use a specific model for this session |
| `-c, --continue` | Resume last conversation |
| `--compact` | Reduced output (no thinking indicators) |
| `--no-memory` | Disable memory injection for this session |
| `--no-banner` | Skip the banner |
| `--trust` | Auto-approve all tool confirmations |

---

## Slash Commands

| Command | Description |
|---------|-------------|
| `/help` | Full command reference |
| `/model [name]` | Show or switch model |
| `/models` | List available models |
| `/mode [build\|plan]` | Toggle or set agent mode |
| `/session` | Browse and resume past sessions |
| `/memory` | Manage memories |
| `/instructions` | Show project agent instructions |
| `/tools` | List available tools |
| `/context` | Show context usage |
| `/activity` | Show session file changes |
| `/settings` | Show current config |
| `/clear` | Clear conversation |
| `/undo` | Undo last file change |
| `/diff` | Show all session changes |
| `/compact` | Toggle compact output |
| `/trust` | Toggle auto-approve for session |
| `/update` | Pull latest & rebuild from GitHub |
| `/quit` | Exit |

---

## License

[MIT](LICENSE)

Part of the [LlamaTalk Suite](https://llamatalksuite.dev) — CLI & Desktop — Created by [ItsTrag1c](https://github.com/ItsTrag1c).
