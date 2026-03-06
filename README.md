# LlamaTalk Build

> Agentic coding assistant from the terminal — part of the LlamaTalk Suite.

LlamaTalk Build is a standalone Windows terminal app that uses a ReAct-style agent loop to help you with coding tasks. It reasons about what to do, uses tools to read/edit files, run commands, and search code, then explains what it did. Works with local models via Ollama and cloud providers.

---

## Features

- **ReAct agent loop** — iterative reason-and-act cycle with streaming + tool calling
- **12 built-in tools** — read_file, write_file, edit_file, list_directory, search_files, glob_files, bash, git, web_fetch, web_search, npm_install, pip_install
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
| `/model` | Show or switch model |
| `/models` | List available models |
| `/memory` | Manage memories |
| `/tools` | List available tools |
| `/context` | Show context usage |
| `/settings` | Show current config |
| `/clear` | Clear conversation |
| `/undo` | Undo last file change |
| `/diff` | Show all session changes |
| `/quit` | Exit |

---

## License

[MIT](LICENSE)

Created by [ItsTrag1c](https://github.com/ItsTrag1c).
