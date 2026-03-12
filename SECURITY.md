# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| CLI 2.5.x (latest) | Yes |
| Desktop 2.4.x (latest) | Yes |
| Older versions | No |

Only the latest release of each app receives security updates. We recommend always running the most recent version.

---

## Reporting a Vulnerability

If you discover a security vulnerability in Clank, **please report it privately** rather than opening a public issue.

### How to Report

1. **GitHub Security Advisories (preferred):** Use [GitHub's private vulnerability reporting](https://github.com/ItsTrag1c/Clank/security/advisories/new) to submit a confidential report directly on the repository.
2. **Email:** Contact the maintainer at the email listed on the [ItsTrag1c GitHub profile](https://github.com/ItsTrag1c).

### What to Include

- A clear description of the vulnerability
- Steps to reproduce (or a proof of concept)
- The affected version(s) and component (CLI, Desktop, engine, sidecar)
- The potential impact (e.g., code execution, data exposure, privilege escalation)

### What to Expect

- **Acknowledgment** within 48 hours of your report
- **Assessment** — we'll confirm the issue and determine severity
- **Fix timeline** — critical vulnerabilities are patched and released as soon as possible; lower-severity issues are bundled into the next scheduled release
- **Credit** — reporters are credited in the changelog and release notes unless they prefer to remain anonymous

---

## Security Model

Clank is a local-first agentic coding assistant. Its security model assumes:

- **The user is the operator.** Clank runs with the user's file system and shell permissions. All destructive or sensitive tool calls require explicit confirmation.
- **The LLM is untrusted input.** Model outputs drive tool calls, but every tool call passes through validation, path traversal checks, and the safety confirmation system before executing.
- **Network access is minimal.** The only automatic network activity is a version check against the GitHub Releases API on startup. All other network calls (AI provider APIs, web_fetch, web_search) are user-initiated.

### Key Security Controls

| Control | Description |
|---------|-------------|
| **3-tier tool safety** | Every tool is classified Low / Medium / High risk with appropriate confirmation prompts |
| **Path traversal protection** | All file operations validate and resolve paths before read/write |
| **Destructive command detection** | Shell commands are checked against patterns (`rm -rf`, `format`, `del /s`, pipe-to-shell, etc.) and elevated to high-risk |
| **Shell injection prevention** | All shell calls use `spawnSync`/`execFileSync` with argument arrays — no string interpolation |
| **HTML sanitization** | Loop-based tag stripping, safe entity decoding, event handler removal |
| **PIN + encryption** | Optional PIN enables AES-256-GCM encryption of API keys and memory at rest |
| **SSRF protection** | web_fetch blocks private, loopback, and link-local addresses; re-validates on redirects |
| **Regex safety** | Search patterns capped at 500 chars with error handling to prevent ReDoS |
| **HTTPS enforcement** | Cloud API calls use HTTPS only; endpoints are hardcoded |

### Automated Scanning

This repository uses **GitHub CodeQL** for continuous static analysis on every push. All code scanning alerts are triaged and resolved before release.

---

## Privacy

All data stays on your machine. See our [Privacy Policy](PRIVACY_POLICY.md) for full details.

---

## Dependency Policy

- **CLI:** Zero runtime dependencies — built entirely on Node.js built-in modules
- **Desktop:** React, Tauri, Vite, Tailwind CSS — all reviewed periodically for security

We do not use packages that phone home, collect telemetry, or introduce unnecessary network activity.
