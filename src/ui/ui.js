import { createInterface } from "readline";

// Color constants (matching LlamaTalk Suite convention)
export const ORANGE = "\x1b[38;5;208m";
export const RED = "\x1b[31m";
export const GREEN = "\x1b[32m";
export const YELLOW = "\x1b[33m";
export const BLUE = "\x1b[34m";
export const DIM = "\x1b[2m";
export const BOLD = "\x1b[1m";
export const RESET = "\x1b[0m";
export const GOLD = "\x1b[38;5;220m";

// --- Thinking animation ---
const THINKING_FRAMES = (() => {
  const word = "Thinking";
  const frames = [];
  for (let i = 1; i <= word.length; i++) frames.push(word.slice(0, i));
  for (let i = 1; i <= 6; i++) frames.push(word + " " + "*".repeat(i));
  return frames;
})();

let thinkingInterval = null;
let thinkingFrame = 0;

export function startThinking() {
  thinkingFrame = 0;
  process.stdout.write("\n");
  process.stdout.write(ORANGE + THINKING_FRAMES[0] + RESET + DIM + "  Esc to cancel" + RESET + "\n");
  thinkingInterval = setInterval(() => {
    thinkingFrame = (thinkingFrame + 1) % THINKING_FRAMES.length;
    process.stdout.write("\x1b[1A\x1b[2K");
    process.stdout.write(ORANGE + THINKING_FRAMES[thinkingFrame] + RESET + DIM + "  Esc to cancel" + RESET + "\n");
  }, 80);
}

export function stopThinking() {
  if (thinkingInterval) {
    clearInterval(thinkingInterval);
    thinkingInterval = null;
    process.stdout.write("\x1b[2A\x1b[2K\n\x1b[2K\x1b[1A");
  }
}

// --- Tool call display ---

export function printToolCall(toolName, args) {
  const summary = Object.entries(args || {})
    .filter(([, v]) => typeof v === "string" && v.length < 80)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .slice(0, 3)
    .join(", ");
  process.stdout.write(`\n  ${ORANGE}●${RESET} ${BOLD}${toolName}${RESET}${summary ? `(${DIM}${summary}${RESET})` : ""}\n`);
}

export function printToolResult(toolName, success, summary) {
  const icon = success ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
  const color = success ? DIM : RED;
  const trimmed = summary.length > 120 ? summary.slice(0, 117) + "..." : summary;
  process.stdout.write(`  ${icon} ${color}${trimmed}${RESET}\n`);
}

// --- Diff display ---

export function printDiff(filePath, oldContent, newContent) {
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");

  process.stdout.write(`\n  ${DIM}--- ${filePath}${RESET}\n`);
  process.stdout.write(`  ${DIM}+++ ${filePath}${RESET}\n`);

  // Simple unified diff — show changed lines
  const maxLines = Math.max(oldLines.length, newLines.length);
  let inChange = false;
  for (let i = 0; i < maxLines; i++) {
    const oldLine = oldLines[i];
    const newLine = newLines[i];
    if (oldLine !== newLine) {
      if (!inChange) {
        process.stdout.write(`  ${DIM}@@ line ${i + 1} @@${RESET}\n`);
        inChange = true;
      }
      if (oldLine !== undefined) {
        process.stdout.write(`  ${RED}- ${oldLine}${RESET}\n`);
      }
      if (newLine !== undefined) {
        process.stdout.write(`  ${GREEN}+ ${newLine}${RESET}\n`);
      }
    } else {
      inChange = false;
    }
  }
  process.stdout.write("\n");
}

// --- Confirmation prompt ---

export async function confirm(message) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`  ${YELLOW}${message}${RESET} ${DIM}(y/n/always)${RESET} `, (answer) => {
      rl.close();
      const a = answer.trim().toLowerCase();
      if (a === "always") resolve("always");
      else resolve(a === "y" || a === "yes");
    });
  });
}

// --- Usage display ---

export function printUsage(usage, iterationCount, contextPercent) {
  if (!usage) return;
  const tokens = (usage.promptTokens || 0) + (usage.outputTokens || 0);
  let tks = "";
  if (usage.evalDurationNs) {
    const secs = usage.evalDurationNs / 1e9;
    tks = ` · ${(usage.outputTokens / secs).toFixed(1)} tk/s`;
  }
  const iters = iterationCount > 0 ? ` · ${iterationCount} tool call${iterationCount > 1 ? "s" : ""}` : "";
  let ctx = "";
  if (contextPercent != null) {
    const color = contextPercent >= 95 ? RED : contextPercent >= 80 ? YELLOW : DIM;
    ctx = ` · ${color}${contextPercent}% context${RESET}${DIM}`;
  }
  process.stdout.write(`\n  ${GOLD}●${RESET}  ${DIM}${tokens.toLocaleString()} tokens${tks}${iters}${ctx}${RESET}\n`);
}

export function printContextClearing() {
  process.stdout.write(`\n  ${YELLOW}⟳ Clearing Context${RESET} ${DIM}— summarizing conversation to free space${RESET}\n`);
}

// --- Error display ---

export function printError(message) {
  process.stdout.write(`\n  ${RED}Error: ${message}${RESET}\n`);
}

// --- Masked input ---

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

// --- Shortcut hint ---

export function printShortcutHint() {
  const hint = "Enter to send  ·  /mode to switch  ·  Esc cancel  ·  Ctrl+C exit  ·  /help";
  const termWidth = process.stdout.columns || 80;
  const pad = " ".repeat(Math.max(0, Math.floor((termWidth - hint.length) / 2)));
  process.stdout.write(pad + DIM + hint + RESET + "\n");
}
