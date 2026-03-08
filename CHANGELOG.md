# Changelog — LlamaTalk Build Desktop

Last updated: 2026-03-08 (v0.1.1)

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

Last updated: 2026-03-08 (v0.1.1)
