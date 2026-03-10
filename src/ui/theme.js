// Theme system — semantic color tokens for the TUI
// Inspired by OpenCode's theme architecture, adapted for terminal ANSI

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  italic: "\x1b[3m",
  underline: "\x1b[4m",
  inverse: "\x1b[7m",
  strikethrough: "\x1b[9m",

  // Foreground
  black: "\x1b[30m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",

  // Bright foreground
  brightBlack: "\x1b[90m",
  brightRed: "\x1b[91m",
  brightGreen: "\x1b[92m",
  brightYellow: "\x1b[93m",
  brightBlue: "\x1b[94m",
  brightMagenta: "\x1b[95m",
  brightCyan: "\x1b[96m",
  brightWhite: "\x1b[97m",

  // Background
  bgBlack: "\x1b[40m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
  bgMagenta: "\x1b[45m",
  bgCyan: "\x1b[46m",
  bgWhite: "\x1b[47m",

  // 256-color
  fg256: (n) => `\x1b[38;5;${n}m`,
  bg256: (n) => `\x1b[48;5;${n}m`,

  // RGB
  fgRGB: (r, g, b) => `\x1b[38;2;${r};${g};${b}m`,
  bgRGB: (r, g, b) => `\x1b[48;2;${r};${g};${b}m`,
};

// Semantic tokens
export const theme = {
  // Core
  reset: ANSI.reset,
  bold: ANSI.bold,
  dim: ANSI.dim,
  italic: ANSI.italic,

  // Brand
  accent: ANSI.fg256(208),        // Orange — LlamaTalk brand
  accentAlt: ANSI.fg256(220),     // Gold — secondary accent

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
  toolName: ANSI.fg256(75),       // Soft blue for tool names
  toolIcon: ANSI.fg256(208),      // Orange dot
  filePath: ANSI.fg256(183),      // Soft purple for file paths
  command: ANSI.fg256(114),       // Soft green for shell commands
  lineNumber: ANSI.brightBlack,
  border: ANSI.brightBlack,
  separator: ANSI.brightBlack,

  // Agent identity
  agentName: ANSI.fg256(208),
  userName: ANSI.fg256(75),

  // Mode colors
  modeBuild: ANSI.green,
  modePlan: ANSI.yellow,
  modeQA: ANSI.cyan,
  modeManage: ANSI.magenta,

  // Special
  cost: ANSI.fg256(220),
  tokens: ANSI.brightBlack,
  speed: ANSI.brightBlack,
};

// Box drawing characters
export const box = {
  tl: "\u256D", tr: "\u256E",
  bl: "\u2570", br: "\u256F",
  h: "\u2500", v: "\u2502",
  t: "\u252C", b: "\u2534",
  l: "\u251C", r: "\u2524",
  cross: "\u253C",
  hBold: "\u2501", vBold: "\u2503",
  hDash: "\u2504", vDash: "\u2506",
  hDot: "\u2508",
};

// Tool-specific icons (Unicode)
export const icons = {
  // Tools
  read: "\u{1F4D6}",      // Keeping simple for terminal compat
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
  build: "\u25CF",      // ●
  plan: "\u25D0",        // ◐
  qa: "\u25C9",          // ◉
  manage: "\u25C8",      // ◈

  // UI
  arrow: "\u25B8",       // ▸
  arrowDown: "\u25BE",   // ▾
  dot: "\u2022",         // •
  ellipsis: "\u2026",    // …
  bar: "\u2502",         // │
  dash: "\u2500",        // ─
  check: "\u2713",       // ✓
  cross: "\u2717",       // ✗
  star: "\u2605",        // ★
  sparkle: "\u2728",
  chevronRight: "\u203A", // ›
  chevronDown: "\u2023",  // ‣
};

// Tool name → icon mapping
export const toolIcons = {
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
  list_directory: icons.list,
};

// Strip all ANSI escape sequences from a string
export function stripAnsi(str) {
  return str.replace(/\x1B(?:\[[0-9;]*[A-Za-z]|\(.|#.|].*?(?:\x07|\x1B\\))/g, "");
}

// Pad or truncate a string to a visual width (respecting ANSI codes)
export function fitWidth(str, width, { align = "left", pad = " ", ellipsis = true } = {}) {
  const plain = stripAnsi(str);
  if (plain.length > width) {
    if (ellipsis && width > 3) {
      // Truncate — need to handle ANSI carefully
      // Simple approach: strip, truncate, reapply reset
      return plain.slice(0, width - 1) + "\u2026" + theme.reset;
    }
    return plain.slice(0, width) + theme.reset;
  }
  const padding = pad.repeat(Math.max(0, width - plain.length));
  if (align === "right") return padding + str;
  if (align === "center") {
    const left = pad.repeat(Math.floor((width - plain.length) / 2));
    const right = pad.repeat(Math.ceil((width - plain.length) / 2));
    return left + str + right;
  }
  return str + padding;
}

// Get terminal width
export function termWidth() {
  return process.stdout.columns || 80;
}
