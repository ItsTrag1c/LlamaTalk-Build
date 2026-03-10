import { createInterface } from "readline";
import { theme, box, icons, toolIcons, stripAnsi, fitWidth, termWidth } from "./theme.js";

const T = theme;

// Re-export legacy color constants for backward compat
export const ORANGE = T.accent;
export const RED = T.error;
export const GREEN = T.success;
export const YELLOW = T.warning;
export const BLUE = T.info;
export const DIM = T.dim;
export const BOLD = T.bold;
export const RESET = T.reset;
export const GOLD = T.accentAlt;

// ──────────────────────────────────────────────────────
// Thinking / Spinner
// ──────────────────────────────────────────────────────

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
let thinkingInterval = null;
let thinkingFrame = 0;
let thinkingStartMs = 0;

let thinkingDelay = null;
let thinkingVisible = false;

export function startThinking() {
  thinkingFrame = 0;
  thinkingStartMs = Date.now();
  thinkingVisible = false;

  // Debounce: only show spinner if model hasn't responded within 400ms
  thinkingDelay = setTimeout(() => {
    thinkingDelay = null;
    thinkingVisible = true;
    process.stdout.write("\n");
    _renderThinkingLine();
    thinkingInterval = setInterval(() => {
      thinkingFrame = (thinkingFrame + 1) % SPINNER_FRAMES.length;
      process.stdout.write("\x1b[1A\x1b[2K");
      _renderThinkingLine();
    }, 100);
  }, 400);
}

function _renderThinkingLine() {
  const elapsed = ((Date.now() - thinkingStartMs) / 1000).toFixed(0);
  const timer = elapsed > 0 ? `${T.textMuted} ${elapsed}s${T.reset}` : "";
  process.stdout.write(
    `  ${T.accent}${SPINNER_FRAMES[thinkingFrame]}${T.reset} ${T.dim}Thinking${T.reset}${timer}  ${T.textMuted}Esc to cancel${T.reset}\n`
  );
}

export function stopThinking() {
  // Cancel the debounce if spinner hasn't appeared yet
  if (thinkingDelay) {
    clearTimeout(thinkingDelay);
    thinkingDelay = null;
  }
  if (thinkingInterval) {
    clearInterval(thinkingInterval);
    thinkingInterval = null;
  }
  if (thinkingVisible) {
    process.stdout.write("\x1b[2A\x1b[2K\n\x1b[2K\x1b[1A");
    thinkingVisible = false;
  }
}

// ──────────────────────────────────────────────────────
// Tool call display (OpenCode-style cards)
// ──────────────────────────────────────────────────────

let _lastToolCalls = [];

export function getLastToolCalls() { return _lastToolCalls; }
export function clearLastToolCalls() { _lastToolCalls = []; }

/**
 * Format a brief subtitle for a tool call (shown beside tool name).
 */
function toolSubtitle(name, args) {
  switch (name) {
    case "read_file":
      return args?.path || "";
    case "write_file":
      return args?.path || "";
    case "edit_file":
      return args?.path || "";
    case "bash":
      return (args?.command || "").length > 80
        ? args.command.slice(0, 77) + "..."
        : (args?.command || "");
    case "git":
      return args?.subcommand || "";
    case "search_files":
      return `/${args?.pattern || ""}/${args?.glob ? ` ${args.glob}` : ""}`;
    case "glob_files":
      return args?.pattern || "";
    case "list_directory":
      return args?.path || ".";
    case "web_fetch":
      return args?.url || "";
    case "web_search":
      return args?.query || "";
    case "npm_install":
    case "pip_install":
      return args?.package || "";
    case "install_tool":
      return args?.package || "";
    case "generate_file":
      return args?.path || "";
    default:
      return args?.path || args?.command || args?.pattern || "";
  }
}

/**
 * Print a compact tool call line (OpenCode style).
 *
 *   ▸ read_file  src/agent.js
 */
export function printToolCall(toolName, args) {
  _lastToolCalls.push({ name: toolName, arguments: args });

  const icon = toolIcons[toolName] || icons.arrow;
  const subtitle = toolSubtitle(toolName, args);
  const subtitleColor = (toolName.includes("file") || toolName === "generate_file")
    ? T.filePath
    : (toolName === "bash" ? T.command : T.dim);

  process.stdout.write(
    `\n  ${T.toolIcon}${icon}${T.reset} ${T.toolName}${toolName}${T.reset}` +
    (subtitle ? `  ${subtitleColor}${subtitle}${T.reset}` : "") +
    "\n"
  );
}

/**
 * Print full tool call details (for /more command).
 */
export function printToolCallFull(tc) {
  const icon = toolIcons[tc.name] || icons.arrow;
  process.stdout.write(`\n  ${T.toolIcon}${icon}${T.reset} ${T.toolName}${T.bold}${tc.name}${T.reset}\n`);
  for (const [k, v] of Object.entries(tc.arguments || {})) {
    const val = typeof v === "string"
      ? (v.length > 200 ? v.slice(0, 197) + "..." : v)
      : JSON.stringify(v);
    process.stdout.write(`    ${T.textMuted}${k}:${T.reset} ${val}\n`);
  }
}

/**
 * Print a tool result line (success/failure).
 *
 *   ✓ Read 142 lines
 *   ✗ File not found: foo.js
 */
export function printToolResult(toolName, success, summary) {
  const icon = success ? `${T.success}${icons.success}${T.reset}` : `${T.error}${icons.error}${T.reset}`;
  const color = success ? T.dim : T.error;
  const trimmed = summary.length > 120 ? summary.slice(0, 117) + "..." : summary;
  process.stdout.write(`  ${icon} ${color}${trimmed}${T.reset}\n`);
}

// ──────────────────────────────────────────────────────
// Batch confirmation (OpenCode-style approval)
// ──────────────────────────────────────────────────────

export async function confirmBatch(actions, existingRl) {
  const w = termWidth();
  const lineW = Math.min(w - 4, 60);
  const line = `${T.border}${box.h.repeat(lineW)}${T.reset}`;
  process.stdout.write(`\n  ${line}\n`);
  process.stdout.write(`  ${T.warning}${T.bold}${actions.length} action${actions.length > 1 ? "s" : ""} need approval${T.reset}\n\n`);
  for (const a of actions) {
    process.stdout.write(`    ${T.toolIcon}${icons.arrow}${T.reset} ${a}\n`);
  }
  process.stdout.write(`\n  ${line}\n`);
  return confirm("Allow?", existingRl, { allowAlways: true });
}

// ──────────────────────────────────────────────────────
// Diff display
// ──────────────────────────────────────────────────────

export function printDiff(filePath, oldContent, newContent) {
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");

  process.stdout.write(`\n  ${T.border}${box.h}${box.h}${T.reset} ${T.filePath}${filePath}${T.reset}\n`);

  const maxLines = Math.max(oldLines.length, newLines.length);
  let inChange = false;
  for (let i = 0; i < maxLines; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];
    if (oldLine !== newLine) {
      if (!inChange) {
        process.stdout.write(`  ${T.textMuted}@@ line ${i + 1} @@${T.reset}\n`);
        inChange = true;
      }
      if (oldLine !== undefined) {
        process.stdout.write(`  ${T.error}- ${oldLine}${T.reset}\n`);
      }
      if (newLine !== undefined) {
        process.stdout.write(`  ${T.success}+ ${newLine}${T.reset}\n`);
      }
    } else {
      inChange = false;
    }
  }
  process.stdout.write("\n");
}

// ──────────────────────────────────────────────────────
// Confirmation prompt
// ──────────────────────────────────────────────────────

export async function confirm(message, existingRl, { allowAlways = true } = {}) {
  const options = allowAlways
    ? `${T.dim}(${T.reset}${T.bold}y${T.reset}${T.dim}/${T.reset}n${T.dim}/${T.reset}always${T.dim})${T.reset} `
    : `${T.dim}(${T.reset}${T.bold}y${T.reset}${T.dim}/${T.reset}n${T.dim})${T.reset} `;
  const prompt = `  ${T.warning}${message}${T.reset} ${options}`;

  if (existingRl) {
    return new Promise((resolve) => {
      existingRl.question(prompt, (answer) => {
        const a = answer.trim().toLowerCase();
        if (allowAlways && a === "always") resolve("always");
        else resolve(a === "y" || a === "yes");
      });
    });
  }

  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt, (answer) => {
      rl.close();
      const a = answer.trim().toLowerCase();
      if (allowAlways && a === "always") resolve("always");
      else resolve(a === "y" || a === "yes");
    });
  });
}

// ──────────────────────────────────────────────────────
// Usage / status line (shown after each response)
// ──────────────────────────────────────────────────────

export function printUsage(usage, iterationCount, contextPercent, durationMs) {
  if (!usage) return;
  const inTok = usage.promptTokens || 0;
  const outTok = usage.outputTokens || 0;
  const total = inTok + outTok;

  const parts = [];

  // Duration
  if (durationMs != null && durationMs > 0) {
    const secs = (durationMs / 1000).toFixed(1);
    parts.push(`${T.textMuted}${secs}s${T.reset}`);
  }

  // Input / output tokens
  if (inTok > 0 && outTok > 0) {
    parts.push(`${T.tokens}${inTok.toLocaleString()}${T.reset}${T.textMuted}in${T.reset} ${T.tokens}${outTok.toLocaleString()}${T.reset}${T.textMuted}out${T.reset}`);
  } else if (total > 0) {
    parts.push(`${T.tokens}${total.toLocaleString()}${T.reset} ${T.textMuted}tokens${T.reset}`);
  }

  // Speed
  let tks = "";
  if (usage.evalDurationNs) {
    const secs = usage.evalDurationNs / 1e9;
    tks = `${(outTok / secs).toFixed(1)} tk/s`;
  } else if (usage.wallTimeMs && outTok > 0) {
    const secs = usage.wallTimeMs / 1000;
    if (secs > 0.1) tks = `${(outTok / secs).toFixed(1)} tk/s`;
  } else if (durationMs && outTok > 0) {
    const secs = durationMs / 1000;
    if (secs > 0.1) tks = `${(outTok / secs).toFixed(1)} tk/s`;
  }
  if (tks) parts.push(`${T.speed}${tks}${T.reset}`);

  // Tool calls
  if (iterationCount > 0) {
    parts.push(`${T.textMuted}${iterationCount} tool call${iterationCount > 1 ? "s" : ""}${T.reset}`);
  }

  // Context usage bar
  if (contextPercent != null) {
    const barLen = 12;
    const filled = Math.round((contextPercent / 100) * barLen);
    const empty = barLen - filled;
    const barColor = contextPercent >= 95 ? T.error : contextPercent >= 80 ? T.warning : T.accent;
    const bar = `${barColor}${"█".repeat(filled)}${T.textMuted}${"░".repeat(empty)}${T.reset}`;
    parts.push(`${bar} ${T.textMuted}${contextPercent}%${T.reset}`);
  }

  // Cost
  if (usage.cost != null && usage.cost > 0) {
    parts.push(`${T.cost}$${usage.cost.toFixed(4)}${T.reset}`);
  }

  const separator = ` ${T.textMuted}${icons.dot}${T.reset} `;
  process.stdout.write(`\n  ${T.accentAlt}${icons.dot}${T.reset}  ${parts.join(separator)}\n`);
}

export function printContextClearing() {
  process.stdout.write(`\n  ${T.warning}${icons.running} Compacting context${T.reset} ${T.dim}${box.h} summarizing old messages to free space${T.reset}\n`);
}

// ──────────────────────────────────────────────────────
// Error display
// ──────────────────────────────────────────────────────

export function printError(message) {
  process.stdout.write(`\n  ${T.error}${icons.error} ${message}${T.reset}\n`);
}

// ──────────────────────────────────────────────────────
// Masked input (PIN entry)
// ──────────────────────────────────────────────────────

export async function askMasked(prompt) {
  return new Promise((resolve) => {
    process.stdout.write(prompt);
    let input = "";

    const onData = (char) => {
      const c = char.toString();
      if (c === "\r" || c === "\n") {
        process.stdin.setRawMode(false);
        process.stdin.removeListener("data", onData);
        process.stdout.write("\n");
        resolve(input);
      } else if (c === "\x7f" || c === "\b") {
        if (input.length > 0) {
          input = input.slice(0, -1);
          process.stdout.write("\b \b");
        }
      } else if (c === "\x03") {
        process.exit(0);
      } else {
        input += c;
        process.stdout.write("*");
      }
    };

    try {
      process.stdin.setRawMode(true);
    } catch {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      rl.question(prompt, (ans) => { rl.close(); resolve(ans); });
      return;
    }
    process.stdin.resume();
    process.stdin.on("data", onData);
  });
}

// ──────────────────────────────────────────────────────
// Shortcut hint (shown below banner)
// ──────────────────────────────────────────────────────

export function printShortcutHint() {
  const hint = `${T.textMuted}Enter to send ${icons.dot} /help ${icons.dot} /mode ${icons.dot} /session ${icons.dot} Esc cancel ${icons.dot} Ctrl+C exit${T.reset}`;
  const plain = stripAnsi(hint);
  const w = termWidth();
  const pad = " ".repeat(Math.max(0, Math.floor((w - plain.length) / 2)));
  process.stdout.write(pad + hint + "\n");
}

// ──────────────────────────────────────────────────────
// Separator lines
// ──────────────────────────────────────────────────────

export function printSeparator(label = "") {
  const w = Math.min(termWidth() - 4, 70);
  if (label) {
    const labelLen = stripAnsi(label).length;
    const remaining = Math.max(0, w - labelLen - 3);
    process.stdout.write(`\n  ${T.border}${box.h}${T.reset} ${label} ${T.border}${box.h.repeat(remaining)}${T.reset}\n`);
  } else {
    process.stdout.write(`\n  ${T.border}${box.h.repeat(w)}${T.reset}\n`);
  }
}

// ──────────────────────────────────────────────────────
// Agent response header
// ──────────────────────────────────────────────────────

export function printAgentHeader(modelName = "", agentName = "") {
  const name = agentName || "Llama";
  const model = modelName ? ` ${T.textMuted}${modelName}${T.reset}` : "";
  process.stdout.write(`\n  ${T.agentName}${name}${T.reset}${model} ${T.bold}${icons.chevronRight}${T.reset} `);
}
