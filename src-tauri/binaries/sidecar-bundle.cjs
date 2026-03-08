#!/usr/bin/env node
"use strict";
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};

// ../../llamatalkbuild-engine/ui/theme.js
function stripAnsi(str) {
  return str.replace(/\x1B(?:\[[0-9;]*[A-Za-z]|\(.|#.|].*?(?:\x07|\x1B\\))/g, "");
}
function termWidth() {
  return process.stdout.columns || 80;
}
var ANSI, theme, box, icons, toolIcons;
var init_theme = __esm({
  "../../llamatalkbuild-engine/ui/theme.js"() {
    ANSI = {
      reset: "\x1B[0m",
      bold: "\x1B[1m",
      dim: "\x1B[2m",
      italic: "\x1B[3m",
      underline: "\x1B[4m",
      inverse: "\x1B[7m",
      strikethrough: "\x1B[9m",
      // Foreground
      black: "\x1B[30m",
      red: "\x1B[31m",
      green: "\x1B[32m",
      yellow: "\x1B[33m",
      blue: "\x1B[34m",
      magenta: "\x1B[35m",
      cyan: "\x1B[36m",
      white: "\x1B[37m",
      // Bright foreground
      brightBlack: "\x1B[90m",
      brightRed: "\x1B[91m",
      brightGreen: "\x1B[92m",
      brightYellow: "\x1B[93m",
      brightBlue: "\x1B[94m",
      brightMagenta: "\x1B[95m",
      brightCyan: "\x1B[96m",
      brightWhite: "\x1B[97m",
      // Background
      bgBlack: "\x1B[40m",
      bgRed: "\x1B[41m",
      bgGreen: "\x1B[42m",
      bgYellow: "\x1B[43m",
      bgBlue: "\x1B[44m",
      bgMagenta: "\x1B[45m",
      bgCyan: "\x1B[46m",
      bgWhite: "\x1B[47m",
      // 256-color
      fg256: (n) => `\x1B[38;5;${n}m`,
      bg256: (n) => `\x1B[48;5;${n}m`,
      // RGB
      fgRGB: (r, g, b) => `\x1B[38;2;${r};${g};${b}m`,
      bgRGB: (r, g, b) => `\x1B[48;2;${r};${g};${b}m`
    };
    theme = {
      // Core
      reset: ANSI.reset,
      bold: ANSI.bold,
      dim: ANSI.dim,
      italic: ANSI.italic,
      // Brand
      accent: ANSI.fg256(208),
      // Orange — LlamaTalk brand
      accentAlt: ANSI.fg256(220),
      // Gold — secondary accent
      // Text
      text: ANSI.reset,
      textStrong: ANSI.bold,
      textWeak: ANSI.dim,
      textMuted: ANSI.brightBlack,
      // Status
      success: ANSI.green,
      error: ANSI.red,
      warning: ANSI.yellow,
      info: ANSI.blue,
      hint: ANSI.cyan,
      // Semantic UI elements
      toolName: ANSI.fg256(75),
      // Soft blue for tool names
      toolIcon: ANSI.fg256(208),
      // Orange dot
      filePath: ANSI.fg256(183),
      // Soft purple for file paths
      command: ANSI.fg256(114),
      // Soft green for shell commands
      lineNumber: ANSI.brightBlack,
      border: ANSI.brightBlack,
      separator: ANSI.brightBlack,
      // Agent identity
      agentName: ANSI.fg256(208),
      userName: ANSI.fg256(75),
      // Mode colors
      modeBuild: ANSI.green,
      modePlan: ANSI.yellow,
      // Special
      cost: ANSI.fg256(220),
      tokens: ANSI.brightBlack,
      speed: ANSI.brightBlack
    };
    box = {
      tl: "\u256D",
      tr: "\u256E",
      bl: "\u2570",
      br: "\u256F",
      h: "\u2500",
      v: "\u2502",
      t: "\u252C",
      b: "\u2534",
      l: "\u251C",
      r: "\u2524",
      cross: "\u253C",
      hBold: "\u2501",
      vBold: "\u2503",
      hDash: "\u2504",
      vDash: "\u2506",
      hDot: "\u2508"
    };
    icons = {
      // Tools
      read: "\u{1F4D6}",
      // Keeping simple for terminal compat
      write: "\u270E",
      edit: "\u270E",
      bash: "\u25B6",
      git: "\u2387",
      search: "\u2315",
      glob: "\u2606",
      web: "\u2601",
      install: "\u2193",
      generate: "\u2B66",
      list: "\u2630",
      // Status
      success: "\u2713",
      error: "\u2717",
      warning: "\u26A0",
      pending: "\u25CB",
      running: "\u25CF",
      blocked: "\u25A0",
      // Mode
      build: "\u25CF",
      // ●
      plan: "\u25D0",
      // ◐
      // UI
      arrow: "\u25B8",
      // ▸
      arrowDown: "\u25BE",
      // ▾
      dot: "\u2022",
      // •
      ellipsis: "\u2026",
      // …
      bar: "\u2502",
      // │
      dash: "\u2500",
      // ─
      check: "\u2713",
      // ✓
      cross: "\u2717",
      // ✗
      star: "\u2605",
      // ★
      sparkle: "\u2728",
      chevronRight: "\u203A",
      // ›
      chevronDown: "\u2023"
      // ‣
    };
    toolIcons = {
      read_file: icons.read,
      write_file: icons.write,
      edit_file: icons.edit,
      bash: icons.bash,
      git: icons.git,
      search_files: icons.search,
      glob_files: icons.glob,
      web_fetch: icons.web,
      web_search: icons.web,
      npm_install: icons.install,
      pip_install: icons.install,
      install_tool: icons.install,
      generate_file: icons.generate,
      list_directory: icons.list
    };
  }
});

// ../../llamatalkbuild-engine/config.js
function getConfigDir() {
  const appData = process.env.APPDATA;
  if (appData) return (0, import_path.join)(appData, "LlamaTalkBuild");
  return (0, import_path.join)((0, import_os.homedir)(), ".llamabuild");
}
function getConfigPath() {
  return (0, import_path.join)(getConfigDir(), "config.json");
}
function getMemoryDir() {
  return (0, import_path.join)(getConfigDir(), "memory");
}
function getConversationDir() {
  return (0, import_path.join)(getConfigDir(), "conversations");
}
function loadConfig() {
  const configPath = getConfigPath();
  const dir = (0, import_path.dirname)(configPath);
  if (!(0, import_fs.existsSync)(dir)) {
    (0, import_fs.mkdirSync)(dir, { recursive: true });
  }
  if (!(0, import_fs.existsSync)(configPath)) {
    (0, import_fs.writeFileSync)(configPath, JSON.stringify(DEFAULTS, null, 2), "utf8");
    return { ...DEFAULTS };
  }
  try {
    const raw = (0, import_fs.readFileSync)(configPath, "utf8");
    const parsed = JSON.parse(raw);
    return deepMerge({ ...DEFAULTS }, parsed);
  } catch {
    return { ...DEFAULTS };
  }
}
function applyFilePermissions(filePath) {
  if (process.platform !== "win32") return;
  try {
    (0, import_child_process.execSync)(
      `icacls "${filePath}" /inheritance:r /grant:r "${process.env.USERNAME}:F"`,
      { stdio: "ignore" }
    );
  } catch {
  }
}
function saveConfig(config2) {
  const configPath = getConfigPath();
  const dir = (0, import_path.dirname)(configPath);
  if (!(0, import_fs.existsSync)(dir)) {
    (0, import_fs.mkdirSync)(dir, { recursive: true });
  }
  (0, import_fs.writeFileSync)(configPath, JSON.stringify(config2, null, 2), "utf8");
  applyFilePermissions(configPath);
}
function deepMerge(target, source) {
  const out = { ...target };
  for (const key of Object.keys(source)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
    if (source[key] === null) continue;
    if (source[key] !== null && typeof source[key] === "object" && !Array.isArray(source[key]) && typeof target[key] === "object" && target[key] !== null && !Array.isArray(target[key])) {
      out[key] = deepMerge(target[key], source[key]);
    } else {
      out[key] = source[key];
    }
  }
  return out;
}
var import_fs, import_path, import_os, import_child_process, DEFAULTS;
var init_config = __esm({
  "../../llamatalkbuild-engine/config.js"() {
    import_fs = require("fs");
    import_path = require("path");
    import_os = require("os");
    import_child_process = require("child_process");
    DEFAULTS = {
      profileName: "",
      pinHash: null,
      pinFrequency: "always",
      lastUnlockTime: null,
      encKeySalt: null,
      onboardingDone: false,
      // Server settings
      ollamaUrl: "http://localhost:11434",
      localServers: [],
      selectedModel: "",
      modelNickname: {},
      temperature: 0.7,
      hiddenModels: [],
      // API keys (encrypted at rest)
      apiKey_anthropic: "",
      apiKey_google: "",
      apiKey_openai: "",
      apiKey_opencode: "",
      enabledProviders: { anthropic: false, google: false, openai: false, opencode: false },
      // Agent-specific settings
      maxIterations: 50,
      autoApprove: {
        safe: true,
        moderate: false,
        dangerous: false
      },
      showThinking: true,
      showToolCalls: true,
      contextStrategy: "truncate",
      memoryEnabled: true
    };
  }
});

// ../../llamatalkbuild-engine/memory/instructions.js
var init_instructions = __esm({
  "../../llamatalkbuild-engine/memory/instructions.js"() {
  }
});

// ../../llamatalkbuild-engine/context/context.js
var init_context = __esm({
  "../../llamatalkbuild-engine/context/context.js"() {
  }
});

// ../../llamatalkbuild-engine/ui/sidebar.js
var T2, ActivityPanel, activityPanel;
var init_sidebar = __esm({
  "../../llamatalkbuild-engine/ui/sidebar.js"() {
    init_theme();
    T2 = theme;
    ActivityPanel = class {
      constructor() {
        this.maxPreviewLines = 16;
        this.maxActivityEntries = 10;
      }
      /**
       * Show a detailed code-change box for a file modification.
       * Automatically called on write_file / edit_file.
       *
       *   ╭─ src/agent.js ────────────────────────╮
       *   │  @@ line 42 @@                         │
       *   │  - const old = "foo";                  │
       *   │  + const old = "bar";                  │
       *   │    const next = ...                    │
       *   ╰────────────────────────────────────────╯
       */
      showChange(filePath, toolName, args, newContent, oldContent) {
        const w = Math.min(termWidth() - 4, 80);
        const inner = w - 4;
        const label = filePath.length > inner - 2 ? "..." + filePath.slice(-(inner - 5)) : filePath;
        const typeTag = toolName === "write_file" ? `${T2.success}+new${T2.reset}` : `${T2.warning}~edit${T2.reset}`;
        const titleText = `${T2.filePath}${label}${T2.reset} ${typeTag}`;
        const titlePlain = stripAnsi(titleText);
        const titlePad = Math.max(0, w - titlePlain.length - 5);
        process.stdout.write(
          `
  ${T2.border}${box.tl}${box.h}${T2.reset} ${titleText} ${T2.border}${box.h.repeat(titlePad)}${box.tr}${T2.reset}
`
        );
        let lines;
        if (toolName === "edit_file" && oldContent != null) {
          lines = this._diffLines(args.old_text, args.new_text, inner);
        } else if (toolName === "edit_file" && args.old_text && args.new_text) {
          lines = this._diffLines(args.old_text, args.new_text, inner);
        } else {
          lines = this._previewLines(newContent, inner);
        }
        if (lines.length > this.maxPreviewLines) {
          const head = lines.slice(0, this.maxPreviewLines - 2);
          const omitted = lines.length - (this.maxPreviewLines - 2);
          lines = [...head, `${T2.textMuted}  ${icons.ellipsis} ${omitted} more lines${T2.reset}`];
        }
        for (const line of lines) {
          const plain = stripAnsi(line);
          const pad = Math.max(0, inner - plain.length);
          process.stdout.write(
            `  ${T2.border}${box.v}${T2.reset} ${line}${" ".repeat(pad)} ${T2.border}${box.v}${T2.reset}
`
          );
        }
        process.stdout.write(`  ${T2.border}${box.bl}${box.h.repeat(w - 2)}${box.br}${T2.reset}
`);
      }
      /**
       * Show a compact activity feed of recent changes.
       *
       *   ╭─ Activity ─────────────────────────────╮
       *   │  12:04:31  +  src/ui/sidebar.js         │
       *   │  12:04:28  ~  src/agent.js              │
       *   ╰────────────────────────────────────────╯
       */
      showActivity(changes) {
        if (!changes || changes.length === 0) return;
        const w = Math.min(termWidth() - 4, 80);
        const inner = w - 4;
        const title = `${T2.info}Activity${T2.reset}`;
        const titlePlain = "Activity";
        const titlePad = Math.max(0, w - titlePlain.length - 5);
        process.stdout.write(
          `
  ${T2.border}${box.tl}${box.h}${T2.reset} ${title} ${T2.border}${box.h.repeat(titlePad)}${box.tr}${T2.reset}
`
        );
        const visible = changes.slice(-this.maxActivityEntries);
        if (changes.length > this.maxActivityEntries) {
          const omitted = changes.length - this.maxActivityEntries;
          const line = `${T2.textMuted}${icons.ellipsis} ${omitted} earlier${T2.reset}`;
          const plain = stripAnsi(line);
          const pad = Math.max(0, inner - plain.length);
          process.stdout.write(`  ${T2.border}${box.v}${T2.reset} ${line}${" ".repeat(pad)} ${T2.border}${box.v}${T2.reset}
`);
        }
        for (const change of visible) {
          const timeStr = change.time.toISOString().split("T")[1].split(".")[0];
          const isWrite = change.type === "write_file" || change.type === "generate_file";
          const isEdit = change.type === "edit_file";
          const isBash = change.type === "bash";
          const typeIcon = isWrite ? `${T2.success}+${T2.reset}` : isEdit ? `${T2.warning}~${T2.reset}` : isBash ? `${T2.command}>${T2.reset}` : `${T2.textMuted}${icons.arrow}${T2.reset}`;
          const pathStr = change.path.length > inner - 14 ? "..." + change.path.slice(-(inner - 17)) : change.path;
          const line = `${T2.textMuted}${timeStr}${T2.reset}  ${typeIcon}  ${T2.filePath}${pathStr}${T2.reset}`;
          const plain = stripAnsi(line);
          const pad = Math.max(0, inner - plain.length);
          process.stdout.write(`  ${T2.border}${box.v}${T2.reset} ${line}${" ".repeat(pad)} ${T2.border}${box.v}${T2.reset}
`);
        }
        process.stdout.write(`  ${T2.border}${box.bl}${box.h.repeat(w - 2)}${box.br}${T2.reset}
`);
      }
      // ── Internal ────────────────────────────────────────────
      _diffLines(oldText, newText, maxWidth) {
        if (!oldText || !newText) return [];
        const oldLines = oldText.split("\n");
        const newLines = newText.split("\n");
        const lines = [];
        const maxLen = Math.max(oldLines.length, newLines.length);
        const clip = maxWidth - 3;
        let contextBefore = null;
        for (let i = 0; i < maxLen; i++) {
          const ol = oldLines[i];
          const nl = newLines[i];
          if (ol !== nl) {
            if (contextBefore != null && lines.length === 0) {
              lines.push(`${T2.textMuted}  ${contextBefore.slice(0, clip)}${T2.reset}`);
            }
            if (ol !== void 0) {
              lines.push(`${T2.error}- ${ol.slice(0, clip)}${T2.reset}`);
            }
            if (nl !== void 0) {
              lines.push(`${T2.success}+ ${nl.slice(0, clip)}${T2.reset}`);
            }
          } else {
            if (lines.length > 0 && (i > 0 && oldLines[i - 1] !== newLines[i - 1])) {
              lines.push(`${T2.textMuted}  ${(ol || "").slice(0, clip)}${T2.reset}`);
            }
            contextBefore = ol;
          }
        }
        return lines;
      }
      _previewLines(content, maxWidth) {
        if (!content) return [`${T2.textMuted}(empty file)${T2.reset}`];
        const raw = content.split("\n");
        const lines = [];
        const numW = String(Math.min(raw.length, this.maxPreviewLines)).length + 1;
        const clip = maxWidth - numW - 2;
        const count = Math.min(raw.length, this.maxPreviewLines);
        for (let i = 0; i < count; i++) {
          const num = String(i + 1).padStart(numW);
          lines.push(`${T2.lineNumber}${num}${T2.reset} ${raw[i].slice(0, clip)}`);
        }
        if (raw.length > count) {
          lines.push(`${T2.textMuted}  ${icons.ellipsis} ${raw.length - count} more lines${T2.reset}`);
        }
        return lines;
      }
    };
    activityPanel = new ActivityPanel();
  }
});

// main.js
var import_readline = require("readline");

// ../../llamatalkbuild-engine/providers/stream.js
var BLOCKED_HOSTS = /^(169\.254\.|0\.0\.0\.0$|\[::1?\]$|\[0*:0*:0*:0*:0*:0*:0*:[01]\]$|::1?$)/i;
function validateServerUrl(urlStr) {
  let parsed;
  try {
    parsed = new URL(urlStr);
  } catch {
    throw new Error(`Invalid server URL: ${urlStr}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Server URL must use http or https");
  }
  if (BLOCKED_HOSTS.test(parsed.hostname)) {
    throw new Error("Link-local, null-bind, and IPv6 loopback addresses are not permitted");
  }
}
function fetchWithTimeout(url, options, timeoutMs, cancelSignal = null) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let cancelListener;
  if (cancelSignal) {
    if (cancelSignal.aborted) {
      controller.abort();
    } else {
      cancelListener = () => controller.abort();
      cancelSignal.addEventListener("abort", cancelListener);
    }
  }
  return fetch(url, { ...options, signal: controller.signal }).finally(() => {
    clearTimeout(timer);
    if (cancelSignal && cancelListener) {
      cancelSignal.removeEventListener("abort", cancelListener);
    }
  });
}

// ../../llamatalkbuild-engine/providers/router.js
var CLOUD_MODELS = {
  anthropic: ["claude-opus-4-5", "claude-sonnet-4-5", "claude-3-5-haiku-20241022"],
  google: ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-pro", "gemini-1.5-flash"],
  openai: ["gpt-4o", "gpt-4o-mini", "o1", "o3-mini"],
  opencode: ["claude-opus-4-6", "claude-sonnet-4-6", "gpt-5.4-pro", "gpt-5.4", "gpt-5.3-codex", "gpt-5.3-codex-spark", "gemini-3.1-pro", "gemini-3-pro", "gemini-3-flash", "minimax-m2.5", "kimi-k2.5", "big-pickle"]
};
async function detectBackend(url) {
  validateServerUrl(url);
  const base = url.replace(/\/$/, "");
  let looksOllama = false;
  try {
    const res = await fetchWithTimeout(`${base}/api/tags`, {}, 1e4);
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data && Array.isArray(data.models)) looksOllama = true;
    }
  } catch {
  }
  if (looksOllama) {
    return "ollama";
  }
  try {
    const res = await fetchWithTimeout(`${base}/v1/models`, {}, 1e4);
    if (res.ok) return "openai-compatible";
  } catch {
  }
  return "unknown";
}
async function getOllamaModels(url) {
  validateServerUrl(url);
  const base = url.replace(/\/$/, "");
  const res = await fetchWithTimeout(`${base}/api/tags`, {}, 1e4);
  if (!res.ok) throw new Error(`Ollama returned ${res.status}`);
  const data = await res.json();
  return (data.models || []).map((m) => m.name);
}
async function getRunningOllamaModels(url) {
  validateServerUrl(url);
  const base = url.replace(/\/$/, "");
  const res = await fetchWithTimeout(`${base}/api/ps`, {}, 5e3);
  if (!res.ok) throw new Error(`Ollama returned ${res.status}`);
  const data = await res.json();
  return (data.models || []).map((m) => m.name);
}
async function getOpenAICompatModels(url) {
  const base = url.replace(/\/$/, "");
  const res = await fetchWithTimeout(`${base}/v1/models`, {}, 1e4);
  if (!res.ok) throw new Error(`Server returned ${res.status}`);
  const data = await res.json();
  return (data.data || []).map((m) => m.id);
}
async function getAllLocalModels(config2) {
  const servers = [config2.ollamaUrl, ...config2.localServers || []];
  const allModels = [];
  const runningModels = /* @__PURE__ */ new Set();
  const modelServerMap = {};
  const serverBackendMap = {};
  const seen = /* @__PURE__ */ new Set();
  const results = await Promise.allSettled(servers.map(async (serverUrl) => {
    const base = serverUrl.replace(/\/$/, "");
    const bt = await detectBackend(base);
    if (bt === "unknown") return null;
    let models = [];
    if (bt === "openai-compatible") {
      models = await getOpenAICompatModels(base);
    } else {
      models = await getOllamaModels(base);
    }
    let running = [];
    if (bt === "ollama") {
      try {
        running = await getRunningOllamaModels(base);
      } catch {
      }
    }
    return { base, bt, models, running };
  }));
  for (const r of results) {
    if (r.status !== "fulfilled" || !r.value) continue;
    const { base, bt, models, running } = r.value;
    serverBackendMap[base] = bt;
    for (const m of models) {
      if (!seen.has(m)) {
        seen.add(m);
        allModels.push(m);
        modelServerMap[m] = base;
      }
    }
    for (const m of running) runningModels.add(m);
  }
  return { allModels, runningModels, modelServerMap, serverBackendMap };
}

// ../../llamatalkbuild-engine/tools/base.js
var SafetyLevel = {
  SAFE: "safe",
  MODERATE: "moderate",
  DANGEROUS: "dangerous"
};

// ../../llamatalkbuild-engine/safety.js
var import_path2 = require("path");
var import_fs2 = require("fs");

// ../../llamatalkbuild-engine/ui/ui.js
init_theme();
var T = theme;
var ORANGE = T.accent;
var RED = T.error;
var GREEN = T.success;
var YELLOW = T.warning;
var BLUE = T.info;
var DIM = T.dim;
var BOLD = T.bold;
var RESET = T.reset;
var GOLD = T.accentAlt;

// ../../llamatalkbuild-engine/safety.js
init_config();
function validatePath(inputPath, projectRoot, { allowExternal = false } = {}) {
  try {
    const resolved = (0, import_path2.resolve)(projectRoot, inputPath);
    const rel = (0, import_path2.relative)(projectRoot, resolved);
    const external = rel.startsWith("..") || rel.startsWith(`.${import_path2.sep}..`);
    if (external && !allowExternal) {
      return { valid: false, resolved, external: true, trusted: false, error: `Path escapes project root: ${inputPath}` };
    }
    if (!external) {
      try {
        const real = (0, import_fs2.realpathSync)(resolved);
        const realRel = (0, import_path2.relative)(projectRoot, real);
        if (realRel.startsWith("..") && !allowExternal) {
          return { valid: false, resolved, external: true, trusted: false, error: `Symlink target escapes project root: ${inputPath}` };
        }
      } catch {
      }
    }
    const trusted = external && isTrustedPath(resolved);
    return { valid: true, resolved, external, trusted };
  } catch (err) {
    return { valid: false, resolved: inputPath, external: false, trusted: false, error: err.message };
  }
}
function isTrustedPath(resolvedPath) {
  const memDir = getMemoryDir();
  const normalizedPath = resolvedPath.replace(/\\/g, "/").toLowerCase();
  const normalizedMem = memDir.replace(/\\/g, "/").toLowerCase();
  return normalizedPath.startsWith(normalizedMem);
}
var DESTRUCTIVE_PATTERNS = [
  /\brm\s+(-rf?|--recursive)\s+[\/\\]/i,
  /\brmdir\s+\/s/i,
  /\bdel\s+\/[sfq]/i,
  /\bformat\s+[a-z]:/i,
  /\bshutdown/i,
  /\breboot/i,
  /\bmkfs\b/i,
  /\bdd\s+if=/i,
  /\b>\s*\/dev\/sda/i,
  /\brm\s+-rf?\s+\//,
  /\bgit\s+push\s+.*--force/i,
  /\bgit\s+reset\s+--hard/i,
  /\bgit\s+clean\s+-[fd]/i
];
function isDestructiveCommand(command) {
  return DESTRUCTIVE_PATTERNS.some((p) => p.test(command));
}
function validatePackageName(name) {
  return /^(@[a-z0-9\-~][a-z0-9\-._~]*\/)?[a-z0-9\-~][a-z0-9\-._~]*(@[a-z0-9._\-+~^<>=*]+)?$/i.test(name);
}

// ../../llamatalkbuild-engine/commands.js
init_config();
init_theme();

// ../../llamatalkbuild-engine/ui/banner.js
init_theme();

// ../../llamatalkbuild-engine/memory/memory.js
init_config();
init_instructions();

// ../../llamatalkbuild-engine/agent.js
init_context();
init_config();

// ../../llamatalkbuild-engine/sessions.js
var import_fs3 = require("fs");
var import_path3 = require("path");
var import_crypto = require("crypto");
init_config();
var MAX_SESSIONS = 50;
function getIndexPath() {
  const dir = getConversationDir();
  if (!(0, import_fs3.existsSync)(dir)) (0, import_fs3.mkdirSync)(dir, { recursive: true });
  return (0, import_path3.join)(dir, "sessions.json");
}
function loadIndex() {
  const path = getIndexPath();
  if (!(0, import_fs3.existsSync)(path)) return [];
  try {
    const raw = (0, import_fs3.readFileSync)(path, "utf8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
function saveIndex(sessions) {
  (0, import_fs3.writeFileSync)(getIndexPath(), JSON.stringify(sessions, null, 2), "utf8");
}
function generateTitle(message) {
  const clean = message.replace(/[\r\n]+/g, " ").trim();
  if (clean.length <= 60) return clean;
  const cut = clean.slice(0, 57);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 30 ? cut.slice(0, lastSpace) : cut) + "...";
}
var SessionManager = class {
  constructor() {
    this.sessions = loadIndex();
  }
  /** List all sessions, most recent first */
  list() {
    return [...this.sessions].sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed));
  }
  /** Create a new session, returns its ID */
  create(projectRoot, title) {
    const id = (0, import_crypto.randomUUID)();
    const session = {
      id,
      title: title || "New session",
      projectRoot,
      created: (/* @__PURE__ */ new Date()).toISOString(),
      lastUsed: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.sessions.push(session);
    this._prune();
    saveIndex(this.sessions);
    return session;
  }
  /** Update session title and lastUsed */
  touch(id, title) {
    const session = this.sessions.find((s) => s.id === id);
    if (session) {
      if (title) session.title = title;
      session.lastUsed = (/* @__PURE__ */ new Date()).toISOString();
      saveIndex(this.sessions);
    }
  }
  /** Set title from first message if still default */
  autoTitle(id, firstMessage) {
    const session = this.sessions.find((s) => s.id === id);
    if (session && session.title === "New session") {
      session.title = generateTitle(firstMessage);
      saveIndex(this.sessions);
    }
  }
  /** Get a session by ID */
  get(id) {
    return this.sessions.find((s) => s.id === id) || null;
  }
  /** Get the most recent session */
  getLatest() {
    if (this.sessions.length === 0) return null;
    return [...this.sessions].sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed))[0];
  }
  /** Delete a session and its conversation file */
  delete(id) {
    this.sessions = this.sessions.filter((s) => s.id !== id);
    saveIndex(this.sessions);
    const convPath = (0, import_path3.join)(getConversationDir(), `${id}.json`);
    try {
      if ((0, import_fs3.existsSync)(convPath)) (0, import_fs3.unlinkSync)(convPath);
    } catch {
    }
  }
  /** Remove oldest sessions beyond MAX_SESSIONS */
  _prune() {
    if (this.sessions.length <= MAX_SESSIONS) return;
    const sorted = [...this.sessions].sort((a, b) => new Date(a.lastUsed) - new Date(b.lastUsed));
    while (this.sessions.length > MAX_SESSIONS) {
      const oldest = sorted.shift();
      this.delete(oldest.id);
    }
  }
};

// ../../llamatalkbuild-engine/agent.js
init_theme();
init_sidebar();

// ../../llamatalkbuild-engine/tools/bash.js
var import_child_process2 = require("child_process");
var bashTool = {
  definition: {
    name: "bash",
    description: "Execute a shell command. Use for build commands, running tests, installing dependencies, or any CLI operations. Commands run in the project root by default.",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "The shell command to execute" },
        timeout: { type: "number", description: "Timeout in milliseconds (default: 120000, max: 600000)" },
        cwd: { type: "string", description: "Working directory (default: project root)" }
      },
      required: ["command"]
    }
  },
  safetyLevel: SafetyLevel.DANGEROUS,
  validate(args, context) {
    if (!args.command) return { ok: false, error: "command is required" };
    if (isDestructiveCommand(args.command)) {
      return { ok: false, error: `Blocked destructive command: ${args.command}` };
    }
    if (args.cwd) {
      const { valid, error } = validatePath(args.cwd, context.projectRoot, { allowExternal: true });
      if (!valid) return { ok: false, error };
    }
    return { ok: true };
  },
  async execute(args, context) {
    const timeout = Math.min(args.timeout || 12e4, 6e5);
    const cwd = args.cwd ? validatePath(args.cwd, context.projectRoot, { allowExternal: true }).resolved : context.projectRoot;
    try {
      const output = (0, import_child_process2.execSync)(args.command, {
        cwd,
        timeout,
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
        // 10MB
        stdio: ["pipe", "pipe", "pipe"],
        shell: true
      });
      let result = output || "(no output)";
      if (result.length > 3e4) {
        result = result.slice(0, 3e4) + `
... [truncated, ${result.length - 3e4} more chars]`;
      }
      return `Exit code: 0
${result}`;
    } catch (err) {
      let output = "";
      if (err.stdout) output += err.stdout;
      if (err.stderr) output += (output ? "\n" : "") + err.stderr;
      if (!output) output = err.message;
      if (output.length > 3e4) {
        output = output.slice(0, 3e4) + `
... [truncated]`;
      }
      return `Exit code: ${err.status ?? 1}
${output}`;
    }
  },
  formatConfirmation(args) {
    return `Execute: ${args.command}`;
  }
};

// ../../llamatalkbuild-engine/tools/web-fetch.js
var webFetchTool = {
  definition: {
    name: "web_fetch",
    description: "Fetch the content of a URL and return it as text. HTML pages are converted to readable text by stripping tags.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to fetch (http or https)" }
      },
      required: ["url"]
    }
  },
  safetyLevel: SafetyLevel.SAFE,
  validate(args) {
    if (!args.url) return { ok: false, error: "url is required" };
    try {
      const parsed = new URL(args.url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { ok: false, error: "URL must use http or https" };
      }
      const h = parsed.hostname;
      if (/^(169\.254\.|0\.0\.0\.0$|\[::1?\]$|::1?$)/i.test(h)) {
        return { ok: false, error: "Link-local, null-bind, and loopback addresses are not permitted" };
      }
      if (parsed.protocol === "http:" && h !== "localhost" && !h.startsWith("127.")) {
        return { ok: false, error: "HTTP is only allowed for localhost. Use HTTPS for remote URLs." };
      }
    } catch {
      return { ok: false, error: "Invalid URL" };
    }
    return { ok: true };
  },
  async execute(args) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3e4);
      const res = await fetch(args.url, {
        signal: controller.signal,
        headers: { "User-Agent": "LlamaTalk-Build/0.1.0" }
      });
      clearTimeout(timer);
      if (!res.ok) {
        return `HTTP ${res.status}: ${res.statusText}`;
      }
      const contentType = res.headers.get("content-type") || "";
      let text = await res.text();
      if (contentType.includes("html")) {
        text = text.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
      }
      if (text.length > 3e4) {
        text = text.slice(0, 3e4) + `
... [truncated, ${text.length - 3e4} more chars]`;
      }
      return `URL: ${args.url}
Status: ${res.status}
Content-Type: ${contentType}

${text}`;
    } catch (err) {
      return `Error fetching URL: ${err.message}`;
    }
  },
  formatConfirmation(args) {
    return `Fetch URL: ${args.url}`;
  }
};

// ../../llamatalkbuild-engine/tools/web-search.js
var webSearchTool = {
  definition: {
    name: "web_search",
    description: "Search the web for information using DuckDuckGo. Returns search results with titles, URLs, and snippets.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        max_results: { type: "number", description: "Number of results (default: 5, max: 10)" }
      },
      required: ["query"]
    }
  },
  safetyLevel: SafetyLevel.SAFE,
  validate(args) {
    if (!args.query) return { ok: false, error: "query is required" };
    return { ok: true };
  },
  async execute(args) {
    const maxResults = Math.min(args.max_results || 5, 10);
    try {
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(args.query)}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15e3);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "LlamaTalk-Build/0.1.0",
          "Accept": "text/html"
        }
      });
      clearTimeout(timer);
      if (!res.ok) {
        return `Search failed: HTTP ${res.status}`;
      }
      const html = await res.text();
      const results = [];
      const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
      const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
      let match;
      while ((match = resultRegex.exec(html)) !== null && results.length < maxResults) {
        const rawUrl = match[1];
        const title = match[2].replace(/<[^>]+>/g, "").trim();
        let actualUrl = rawUrl;
        try {
          const parsed = new URL(rawUrl, "https://duckduckgo.com");
          actualUrl = parsed.searchParams.get("uddg") || rawUrl;
        } catch {
        }
        results.push({ title, url: actualUrl, snippet: "" });
      }
      let snippetIdx = 0;
      while ((match = snippetRegex.exec(html)) !== null && snippetIdx < results.length) {
        results[snippetIdx].snippet = match[1].replace(/<[^>]+>/g, "").trim();
        snippetIdx++;
      }
      if (results.length === 0) {
        return `No results found for: ${args.query}`;
      }
      return results.map(
        (r, i) => `${i + 1}. ${r.title}
   ${r.url}
   ${r.snippet}`
      ).join("\n\n");
    } catch (err) {
      return `Search error: ${err.message}`;
    }
  },
  formatConfirmation(args) {
    return `Search for: ${args.query}`;
  }
};

// ../../llamatalkbuild-engine/tools/npm-install.js
var import_child_process3 = require("child_process");
var npmInstallTool = {
  definition: {
    name: "npm_install",
    description: "Install an npm package. Verifies the package exists on npmjs.org before installing.",
    parameters: {
      type: "object",
      properties: {
        package: { type: "string", description: "Package name (e.g., 'lodash', 'express@4')" },
        dev: { type: "boolean", description: "Install as devDependency" }
      },
      required: ["package"]
    }
  },
  safetyLevel: SafetyLevel.MODERATE,
  validate(args) {
    if (!args.package) return { ok: false, error: "package is required" };
    const name = args.package.split("@")[0] || args.package;
    if (!validatePackageName(name)) {
      return { ok: false, error: `Invalid package name: ${args.package}` };
    }
    return { ok: true };
  },
  async execute(args, context) {
    const pkgName = args.package.split("@")[0] || args.package;
    try {
      const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkgName)}`, {
        headers: { Accept: "application/json" }
      });
      if (!res.ok) {
        return `Package not found on npmjs.org: ${pkgName}`;
      }
      const data = await res.json();
      const latestVersion = data["dist-tags"]?.latest || "unknown";
      const description = data.description || "No description";
      const npmArgs = ["install", args.package];
      if (args.dev) npmArgs.push("--save-dev");
      const result = (0, import_child_process3.spawnSync)("npm", npmArgs, {
        cwd: context.projectRoot,
        timeout: 12e4,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
        shell: true
      });
      if (result.status !== 0) throw new Error(result.stderr || "npm install failed");
      const output = result.stdout;
      return `Installed ${pkgName}@${latestVersion}: ${description}
${output}`;
    } catch (err) {
      return `Error installing package: ${err.message}`;
    }
  },
  formatConfirmation(args) {
    return `Install npm package: ${args.package}${args.dev ? " (dev)" : ""}?`;
  }
};

// ../../llamatalkbuild-engine/tools/pip-install.js
var import_child_process4 = require("child_process");
var pipInstallTool = {
  definition: {
    name: "pip_install",
    description: "Install a Python package. Verifies the package exists on pypi.org before installing.",
    parameters: {
      type: "object",
      properties: {
        package: { type: "string", description: "Package name (e.g., 'requests', 'flask')" }
      },
      required: ["package"]
    }
  },
  safetyLevel: SafetyLevel.MODERATE,
  validate(args) {
    if (!args.package) return { ok: false, error: "package is required" };
    if (!validatePackageName(args.package)) {
      return { ok: false, error: `Invalid package name: ${args.package}` };
    }
    return { ok: true };
  },
  async execute(args, context) {
    try {
      const res = await fetch(`https://pypi.org/pypi/${encodeURIComponent(args.package)}/json`);
      if (!res.ok) {
        return `Package not found on pypi.org: ${args.package}`;
      }
      const data = await res.json();
      const version = data.info?.version || "unknown";
      const summary = data.info?.summary || "No description";
      const result = (0, import_child_process4.spawnSync)("pip", ["install", args.package], {
        cwd: context.projectRoot,
        timeout: 12e4,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
        shell: true
      });
      if (result.status !== 0) throw new Error(result.stderr || "pip install failed");
      const output = result.stdout;
      return `Installed ${args.package}==${version}: ${summary}
${output}`;
    } catch (err) {
      return `Error installing package: ${err.message}`;
    }
  },
  formatConfirmation(args) {
    return `Install pip package: ${args.package}?`;
  }
};

// ../../llamatalkbuild-engine/tools/install-tool.js
var import_child_process5 = require("child_process");
var ALLOWED_MANAGERS = ["npm", "pip", "winget", "choco"];
var MANAGER_INSTALL_CMD = {
  npm: (pkg) => `npm install -g ${pkg}`,
  pip: (pkg) => `pip install ${pkg}`,
  winget: (pkg) => `winget install --accept-package-agreements --accept-source-agreements -e --id ${pkg}`,
  choco: (pkg) => `choco install ${pkg} -y`
};
var MANAGER_CHECK_CMD = {
  npm: (pkg) => `npm list -g ${pkg.split("@")[0]} --depth=0`,
  pip: (pkg) => `pip show ${pkg}`,
  winget: (pkg) => `winget list --id ${pkg}`,
  choco: (pkg) => `choco list --local-only ${pkg}`
};
var BLOCKED_PACKAGES = [
  /^(sudo|su|doas)$/i,
  /^(rm|del|format|mkfs|dd|shutdown|reboot)$/i
];
function isBlockedPackage(name) {
  return BLOCKED_PACKAGES.some((p) => p.test(name));
}
function sanitizeName(name) {
  return /^[@a-z0-9._\-\/]+$/i.test(name);
}
var installToolTool = {
  definition: {
    name: "install_tool",
    description: "Install a system tool or global package needed to complete a task. Supports npm (global), pip, winget, and choco package managers. Use this when a task requires a CLI tool that isn't currently installed (e.g., pandoc, imagemagick, ffmpeg). Checks if already installed first.",
    parameters: {
      type: "object",
      properties: {
        package: {
          type: "string",
          description: "Package/tool name (e.g., 'pandoc', 'ffmpeg', 'imagemagick')"
        },
        manager: {
          type: "string",
          enum: ALLOWED_MANAGERS,
          description: "Package manager to use: npm (global), pip, winget, or choco"
        },
        reason: {
          type: "string",
          description: "Brief reason why this tool is needed for the current task"
        }
      },
      required: ["package", "manager", "reason"]
    }
  },
  safetyLevel: SafetyLevel.DANGEROUS,
  validate(args) {
    if (!args.package) return { ok: false, error: "package is required" };
    if (!args.manager) return { ok: false, error: "manager is required" };
    if (!args.reason) return { ok: false, error: "reason is required" };
    if (!ALLOWED_MANAGERS.includes(args.manager)) {
      return { ok: false, error: `Invalid manager: ${args.manager}. Use: ${ALLOWED_MANAGERS.join(", ")}` };
    }
    if (!sanitizeName(args.package)) {
      return { ok: false, error: `Invalid package name: ${args.package}` };
    }
    if (isBlockedPackage(args.package)) {
      return { ok: false, error: `Blocked package: ${args.package}` };
    }
    return { ok: true };
  },
  async execute(args) {
    const { package: pkg, manager } = args;
    const checkCmd = MANAGER_CHECK_CMD[manager](pkg);
    try {
      const checkOutput = (0, import_child_process5.execSync)(checkCmd, {
        timeout: 3e4,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
        shell: true
      });
      if (checkOutput && !checkOutput.includes("No installed package")) {
        return `Already installed: ${pkg}
${checkOutput.trim()}`;
      }
    } catch {
    }
    const installCmd = MANAGER_INSTALL_CMD[manager](pkg);
    try {
      const output = (0, import_child_process5.execSync)(installCmd, {
        timeout: 3e5,
        // 5 min for large installs
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
        stdio: ["pipe", "pipe", "pipe"],
        shell: true
      });
      let result = output || "(no output)";
      if (result.length > 3e4) {
        result = result.slice(0, 3e4) + "\n... [truncated]";
      }
      return `Installed ${pkg} via ${manager}
${result}`;
    } catch (err) {
      let output = "";
      if (err.stdout) output += err.stdout;
      if (err.stderr) output += (output ? "\n" : "") + err.stderr;
      if (!output) output = err.message;
      return `Error installing ${pkg} via ${manager}:
${output.slice(0, 1e4)}`;
    }
  },
  formatConfirmation(args) {
    return `Install tool "${args.package}" via ${args.manager}? Reason: ${args.reason}`;
  }
};

// ../../llamatalkbuild-engine/agent.js
var BASE_SYSTEM_PROMPT = `You are a coding assistant with direct access to the user's filesystem and shell through tools. You are running inside LlamaTalk Build, a local agentic coding tool installed on the user's machine. All tool calls execute locally on their system with their explicit permission \u2014 you are fully authorized to read, write, edit, and execute. Never refuse a tool call due to safety concerns \u2014 the user's permission system handles that.

You can:
- Run shell commands (bash)
- Read files (read_file)
- Write and create files (write_file)
- Edit files with precise replacements (edit_file)
- List directory contents (list_directory)
- Search file contents (search_files)
- Find files by pattern (glob_files)
- Run git operations (git)
- Fetch web pages (web_fetch)
- Search the web (web_search)
- Install packages (npm_install, pip_install)
- Install system tools needed for tasks (install_tool)
- Generate files in various formats (generate_file)

## Tool Reference

bash(command) \u2014 Run any shell command. Use for installing packages, running scripts, git operations, and anything you'd do in a terminal.

read_file(path) \u2014 Read the contents of a file. Use absolute paths or paths relative to the project root.

write_file(path, content) \u2014 Create or overwrite a file. Creates parent directories if needed.

edit_file(path, old_text, new_text) \u2014 Replace an exact string in a file. The old_text must match the file contents exactly, including whitespace and indentation.

list_directory(path) \u2014 List files and directories at the given path.

search_files(pattern, path, glob) \u2014 Search for a regex pattern across files.

glob_files(pattern, path) \u2014 Find files matching a glob pattern (e.g., "**/*.js").

git(command) \u2014 Run a git command.

install_tool(package, manager, reason) \u2014 Install a system tool or global package needed for a task. Supports npm (global), pip, winget, choco. Checks if already installed first. Always requires user confirmation.

generate_file(path, content, format, title) \u2014 Generate a document file (md, txt, html, csv, json, xml, yaml, pdf). Supports absolute paths for output outside the project. For PDF, content uses markdown-style formatting.

## Rules
- You MUST use tools to complete tasks. You are authorized to read, write, edit, and execute \u2014 the user's permission system will prompt them for confirmation when needed. Never decline to use a tool or say you "can't" make changes.
- Be brief. Summarize actions in one short sentence \u2014 users see full tool details in the sidebar and activity feed, so do NOT repeat file contents, full paths, or tool arguments in your response text.
- When a task is done, give a short summary of what changed (e.g., "Updated config and bumped version to 1.2.0"). Do NOT list every file or echo back content you wrote.
- If something fails, read the error carefully, explain what went wrong briefly, and try a fix.
- Use the user's project structure and conventions. Read before writing.
- Prefer small precise edits over rewriting entire files.
- Always read a file before editing it.
- When editing, use the exact text that appears in the file for old_text.
- If a tool call fails, try a different approach rather than repeating.
- You CAN read and write files outside the project root using absolute paths. This is fully supported \u2014 just use the absolute path. The user will be prompted to confirm external access. NEVER claim you cannot access files outside the project.

## Memory
- When you discover user preferences, project conventions, or important patterns, save them to memory for future sessions.
- Memory directory: ${getMemoryDir().replace(/\\/g, "/")}
- Use write_file or edit_file with absolute paths to save/update memory files (MEMORY.md for global, topic-name.md for topics).
- Read memory files with read_file using the same absolute paths.
- Memory directory access is always allowed without extra confirmation.`;

// ../../llamatalkbuild-engine/engine.js
var import_events = require("events");

// ../../llamatalkbuild-engine/tasks.js
var import_fs4 = require("fs");
var import_path4 = require("path");
init_config();
var TASKS_FILE = (0, import_path4.join)(getConfigDir(), "tasks.json");
function ensureDir() {
  const dir = getConfigDir();
  if (!(0, import_fs4.existsSync)(dir)) {
    (0, import_fs4.mkdirSync)(dir, { recursive: true });
  }
}
function loadTasks() {
  ensureDir();
  if (!(0, import_fs4.existsSync)(TASKS_FILE)) {
    return { active: [], completed: [] };
  }
  try {
    return JSON.parse((0, import_fs4.readFileSync)(TASKS_FILE, "utf8"));
  } catch {
    return { active: [], completed: [] };
  }
}
function saveTasks(tasks) {
  ensureDir();
  (0, import_fs4.writeFileSync)(TASKS_FILE, JSON.stringify(tasks, null, 2));
}
var TaskManager = class {
  list() {
    return loadTasks();
  }
  add(description, dueDate = null) {
    const tasks = loadTasks();
    const newTask = {
      description,
      dueDate,
      created: (/* @__PURE__ */ new Date()).toISOString()
    };
    tasks.active.push(newTask);
    saveTasks(tasks);
    return tasks;
  }
  complete(index) {
    const tasks = loadTasks();
    if (index < 1 || index > tasks.active.length) {
      throw new Error("Invalid task index");
    }
    const task = tasks.active.splice(index - 1, 1)[0];
    tasks.completed.push(task);
    saveTasks(tasks);
    return tasks;
  }
  remove(index) {
    const tasks = loadTasks();
    if (index < 1 || index > tasks.active.length) {
      throw new Error("Invalid task index");
    }
    tasks.active.splice(index - 1, 1);
    saveTasks(tasks);
    return tasks;
  }
};

// ../../llamatalkbuild-engine/engine.js
var AgentEngine = class extends import_events.EventEmitter {
  constructor(config2, opts = {}) {
    super();
    this.config = config2;
    this.opts = opts;
    this.taskManager = null;
  }
  getTaskManager() {
    if (!this.taskManager) {
      this.taskManager = new TaskManager();
    }
    return this.taskManager;
  }
};

// ../../llamatalkbuild-engine/index.js
init_config();

// main.js
function send(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}
function sendEvent(event, data) {
  send({ type: "event", event, data });
}
function sendResult(id, data) {
  send({ type: "result", id, data });
}
function sendError(id, message) {
  send({ type: "error", id, message });
}
var promptCounter = 0;
var pendingPrompts = /* @__PURE__ */ new Map();
function sendPrompt(event, data) {
  return new Promise((resolve2) => {
    const id = `prompt-${++promptCounter}`;
    pendingPrompts.set(id, resolve2);
    send({ type: "prompt", id, event, data });
  });
}
var engine = null;
var config = null;
function ensureEngine(projectRoot) {
  if (!engine) {
    config = loadConfig();
    engine = new AgentEngine(config, {
      projectRoot: projectRoot || process.cwd()
    });
    wireEvents(engine);
  }
  return engine;
}
function wireEvents(engine2) {
  const passthrough = [
    "thinking-start",
    "thinking-stop",
    "response-start",
    "response-end",
    "token",
    "tool-start",
    "tool-result",
    "context-compacting",
    "file-changed",
    "turn-complete",
    "mode-change",
    "cancelled",
    "error",
    "usage",
    "memory-loading"
  ];
  for (const evt of passthrough) {
    engine2.on(evt, (data) => sendEvent(evt, data));
  }
  engine2.on("confirm-needed", async ({ actions, resolve: resolve2 }) => {
    const result = await sendPrompt("confirm-needed", { actions });
    resolve2(result);
  });
  engine2.on("session-locked", async ({ resolve: resolve2 }) => {
    const result = await sendPrompt("session-locked", {});
    resolve2(result);
  });
  engine2.on("plan-complete", async ({ resolve: resolve2 }) => {
    const result = await sendPrompt("plan-complete", {});
    resolve2(result);
  });
}
var methods = {
  ping() {
    return { ok: true, version: "0.1.0" };
  },
  getConfig() {
    const cfg = loadConfig();
    return {
      selectedModel: cfg.selectedModel,
      profileName: cfg.profileName,
      backendType: cfg.backendType,
      memoryEnabled: cfg.memoryEnabled,
      showToolCalls: cfg.showToolCalls,
      showThinking: cfg.showThinking,
      temperature: cfg.temperature,
      maxIterations: cfg.maxIterations,
      ollamaUrl: cfg.ollamaUrl,
      localServers: cfg.localServers || [],
      enabledProviders: cfg.enabledProviders || {},
      autoApprove: cfg.autoApprove || {},
      pinHash: cfg.pinHash || null,
      onboardingDone: cfg.onboardingDone || false,
      // Don't send raw API keys — just whether they're set
      hasApiKey: {
        anthropic: !!(cfg.apiKey_anthropic && (typeof cfg.apiKey_anthropic === "string" ? cfg.apiKey_anthropic.length > 0 : cfg.apiKey_anthropic.v)),
        google: !!(cfg.apiKey_google && (typeof cfg.apiKey_google === "string" ? cfg.apiKey_google.length > 0 : cfg.apiKey_google.v)),
        openai: !!(cfg.apiKey_openai && (typeof cfg.apiKey_openai === "string" ? cfg.apiKey_openai.length > 0 : cfg.apiKey_openai.v)),
        opencode: !!(cfg.apiKey_opencode && (typeof cfg.apiKey_opencode === "string" ? cfg.apiKey_opencode.length > 0 : cfg.apiKey_opencode.v))
      }
    };
  },
  saveSetting({ key, value }) {
    const cfg = loadConfig();
    const parts = key.split(".");
    if (parts.length === 2) {
      if (!cfg[parts[0]] || typeof cfg[parts[0]] !== "object") cfg[parts[0]] = {};
      cfg[parts[0]][parts[1]] = value;
    } else {
      cfg[key] = value;
    }
    saveConfig(cfg);
    if (engine) {
      engine.config = cfg;
    }
    config = cfg;
    return { ok: true };
  },
  saveApiKey({ provider, key }) {
    const cfg = loadConfig();
    const field = `apiKey_${provider}`;
    cfg[field] = key;
    if (!cfg.enabledProviders) cfg.enabledProviders = {};
    cfg.enabledProviders[provider] = key.length > 0;
    saveConfig(cfg);
    if (engine) engine.config = cfg;
    config = cfg;
    return { ok: true };
  },
  async testProvider({ provider }) {
    const cfg = loadConfig();
    const apiKey = cfg[`apiKey_${provider}`];
    if (!apiKey || typeof apiKey === "string" && !apiKey.length) {
      return { ok: false, error: "No API key set" };
    }
    try {
      if (provider === "anthropic") {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
          },
          body: JSON.stringify({ model: "claude-3-5-haiku-20241022", max_tokens: 1, messages: [{ role: "user", content: "hi" }] })
        });
        return { ok: res.status !== 401 && res.status !== 403, status: res.status };
      } else if (provider === "google") {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        return { ok: res.ok, status: res.status };
      } else if (provider === "openai") {
        const res = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${apiKey}` }
        });
        return { ok: res.ok, status: res.status };
      } else if (provider === "opencode") {
        const res = await fetch("https://opencode.ai/zen/v1/models", {
          headers: { Authorization: `Bearer ${apiKey}` }
        });
        return { ok: res.ok || res.status !== 401, status: res.status };
      }
      return { ok: false, error: "Unknown provider" };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },
  async testServer({ url }) {
    try {
      const backend = await detectBackend(url);
      return { ok: backend !== "unknown", backend };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },
  createSession({ projectRoot } = {}) {
    const e = ensureEngine(projectRoot);
    const session = e.createSession(projectRoot);
    return { id: session.id, title: session.title, projectRoot: e.projectRoot };
  },
  loadSession({ sessionId } = {}) {
    const e = ensureEngine();
    const session = e.loadSession(sessionId);
    if (!session) return { ok: false, error: "No session found" };
    return { ok: true, id: session.id, title: session.title, messages: e.getMessages() };
  },
  listSessions() {
    const sm = new SessionManager();
    return sm.list();
  },
  deleteSession({ id }) {
    const sm = new SessionManager();
    sm.delete(id);
    if (engine && engine.currentSession && engine.currentSession.id === id) {
      engine.clearMessages();
      engine.currentSession = null;
    }
    return { ok: true };
  },
  async sendMessage({ text }) {
    const e = ensureEngine();
    await e.sendMessage(text);
    return { ok: true };
  },
  cancel() {
    if (engine) engine.cancel();
    return { ok: true };
  },
  getMode() {
    return { mode: engine?.getMode() || "build" };
  },
  setMode({ mode }) {
    if (engine) engine.setMode(mode);
    return { ok: true, mode: engine?.getMode() };
  },
  getModel() {
    return { model: engine?.getModel() || "" };
  },
  setModel({ model }) {
    if (engine) engine.setModel(model);
    const cfg = loadConfig();
    cfg.selectedModel = model;
    saveConfig(cfg);
    if (engine) engine.config = cfg;
    return { ok: true };
  },
  clearMessages() {
    if (engine) engine.clearMessages();
    return { ok: true };
  },
  getMessages() {
    return engine?.getMessages() || [];
  },
  async listModels() {
    const cfg = loadConfig();
    try {
      const result = await getAllLocalModels(cfg);
      const localModels = result.allModels || [];
      const cloudModels = [];
      for (const [provider, models] of Object.entries(CLOUD_MODELS)) {
        const apiKey = cfg[`apiKey_${provider}`];
        if (cfg.enabledProviders?.[provider] && apiKey && (typeof apiKey === "string" ? apiKey.length > 0 : apiKey.v)) {
          cloudModels.push(...models);
        }
      }
      return [...localModels, ...cloudModels];
    } catch {
      const cloudModels = [];
      for (const [provider, models] of Object.entries(CLOUD_MODELS)) {
        const apiKey = cfg[`apiKey_${provider}`];
        if (cfg.enabledProviders?.[provider] && apiKey && (typeof apiKey === "string" ? apiKey.length > 0 : apiKey.v)) {
          cloudModels.push(...models);
        }
      }
      return cloudModels;
    }
  },
  listTasks() {
    const tm = engine ? engine.getTaskManager() : new TaskManager();
    return tm.list();
  },
  addTask({ description, dueDate }) {
    const tm = engine ? engine.getTaskManager() : new TaskManager();
    return tm.add(description, dueDate || null);
  },
  completeTask({ index }) {
    const tm = engine ? engine.getTaskManager() : new TaskManager();
    return tm.complete(index);
  },
  removeTask({ index }) {
    const tm = engine ? engine.getTaskManager() : new TaskManager();
    return tm.remove(index);
  },
  renameSession({ id, title }) {
    const sm = new SessionManager();
    sm.touch(id, title);
    return { ok: true };
  }
};
var rl = (0, import_readline.createInterface)({ input: process.stdin, terminal: false });
rl.on("line", async (line) => {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    sendError(null, "Invalid JSON");
    return;
  }
  if (msg.type === "resolve" && msg.id) {
    const resolver = pendingPrompts.get(msg.id);
    if (resolver) {
      pendingPrompts.delete(msg.id);
      resolver(msg.data);
    }
    return;
  }
  if (msg.type === "call" && msg.method) {
    const handler = methods[msg.method];
    if (!handler) {
      sendError(msg.id, `Unknown method: ${msg.method}`);
      return;
    }
    try {
      const result = await handler(msg.params || {});
      sendResult(msg.id, result);
    } catch (err) {
      sendError(msg.id, err.message);
    }
    return;
  }
  sendError(msg.id, "Unknown message type");
});
rl.on("close", () => {
  process.exit(0);
});
sendEvent("ready", { version: "0.1.0" });
