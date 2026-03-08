import { theme, box, icons, stripAnsi, fitWidth, termWidth } from "./theme.js";

const T = theme;

// Braille-dot llama art (rendered in orange)
// Head, neck, and upper body — trimmed for banner height
const LLAMA_ART = [
  "    ⢀⣀⣤⣄",
  "   ⢀⡴⡃⢔⣮⠯⡄",
  "  ⢀⡔⡁⠞⣠⡞⣁⠌",
  " ⡴⠉⡔⠁⡔⢁⡜⠁",
  "⢀⡏⠁⠐⠁⣎⡡⡃",
  "⢀⡃⠀⠀⠀⠉⠉⠚⢯⡦⣆⣄⣀⡀",
  "⡏⠀⠀⠀⠄⣶⡄⠀⠀⠀⠀⠉⣳⣶⣒⡄",
  "⢠⠅⠂⠀⠀⠀⠀⠀⠀⠀⠀⠀⠟⠛⠓⡇",
  "⠪⡡⠤⢤⣀⣀⣀⡀⡀⡀⠀⠀⣀⣀⣰⠇",
  "⢈⡅⠀⠀⠀⠈⠁⠉⠉⠛⠓⠚⠐⠓⠲⠞⠃",
  "⠈⠄⡔⠀⠀⡀⡀⠀⢠⠀⡄",
  " ⡃⣷⠇⢄⠀⢀⣀⠁⠘⢢⢣",
];

function timeAgo(dateStr) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function buildStatusLine(model, provider, mode) {
  const parts = [];
  if (model) parts.push(`${T.accent}${model}${T.reset}`);
  if (provider) parts.push(`${T.textMuted}via ${provider}${T.reset}`);
  if (mode) {
    const modeColor = mode === "plan" ? T.modePlan : T.modeBuild;
    const modeIcon = mode === "plan" ? icons.plan : icons.build;
    parts.push(`${modeColor}${modeIcon} ${mode.charAt(0).toUpperCase() + mode.slice(1)}${T.reset}`);
  }
  if (parts.length === 0) return "";
  const sep = ` ${T.textMuted}${icons.dot}${T.reset} `;
  return parts.join(sep);
}

// Center a string within terminal width
function centerLine(str, w) {
  const plain = stripAnsi(str);
  const pad = Math.max(0, Math.floor((w - plain.length) / 2));
  return " ".repeat(pad) + str;
}

export function printBanner(version = "", { model, mode, provider, cwd, sessions } = {}) {
  const w = termWidth();
  const hasSessions = sessions && sessions.length > 0;
  const greeting = hasSessions ? "Welcome back!" : "Welcome!";

  if (w < 40) {
    printMinimal(version, model, provider, mode, w);
    return;
  }

  if (w < 62) {
    printCompact(version, greeting, model, provider, mode, cwd, hasSessions, sessions, w);
    return;
  }

  printFull(version, greeting, model, provider, mode, cwd, hasSessions, sessions, w);
}

function printMinimal(version, model, provider, mode, w) {
  const titleText = `LlamaTalk Build${version ? ` v${version}` : ""}`;
  // Box fills available width minus 2 for margin
  const boxW = Math.max(titleText.length + 5, Math.min(w - 2, 38));
  const inner = boxW - 4;

  const topFill = Math.max(0, boxW - titleText.length - 5);
  const top = `${T.border}${box.tl}${box.h} ${T.accent}${titleText}${T.reset} ${T.border}${box.h.repeat(topFill)}${box.tr}${T.reset}`;
  const bot = `${T.border}${box.bl}${box.h.repeat(boxW - 2)}${box.br}${T.reset}`;

  const rows = [];
  rows.push(top);

  const status = buildStatusLine(model, provider, mode);
  if (status) {
    rows.push(makeRow(`  ${fitWidth(status, inner - 2)}`, boxW));
  }

  rows.push(makeRow(`  ${T.textMuted}/help for commands${T.reset}`, boxW));
  rows.push(bot);

  process.stdout.write("\n" + rows.map((r) => centerLine(r, w)).join("\n") + "\n\n");
}

function printCompact(version, greeting, model, provider, mode, cwd, hasSessions, sessions, w) {
  // Scale between 40 and 61 — use most of the available width
  const boxW = Math.min(w - 2, 60);
  const inner = boxW - 4;

  const titleText = `LlamaTalk Build${version ? ` v${version}` : ""}`;
  const topFill = Math.max(0, boxW - titleText.length - 5);
  const top = `${T.border}${box.tl}${box.h} ${T.accent}${titleText}${T.reset} ${T.border}${box.h.repeat(topFill)}${box.tr}${T.reset}`;
  const bot = `${T.border}${box.bl}${box.h.repeat(boxW - 2)}${box.br}${T.reset}`;
  const emptyRow = makeRow("", boxW);

  const rows = [];
  rows.push(top);
  rows.push(emptyRow);
  rows.push(makeRow(`  ${T.textStrong}${greeting}${T.reset}`, boxW));
  rows.push(emptyRow);

  const status = buildStatusLine(model, provider, mode);
  if (status) rows.push(makeRow(`  ${status}`, boxW));
  if (cwd) rows.push(makeRow(`  ${T.textMuted}${fitWidth(cwd, inner - 2)}${T.reset}`, boxW));

  rows.push(emptyRow);
  rows.push(makeRow(`  ${T.accent}/help${T.reset} ${T.dim}commands${T.reset}  ${T.accent}/mode${T.reset} ${T.dim}switch${T.reset}  ${T.accent}/model${T.reset} ${T.dim}select${T.reset}  ${T.accent}/session${T.reset} ${T.dim}history${T.reset}`, boxW));

  if (hasSessions) {
    rows.push(emptyRow);
    rows.push(makeRow(`  ${T.textMuted}Recent activity${T.reset}`, boxW));
    for (const s of sessions.slice(0, 3)) {
      const ago = timeAgo(s.lastUsed);
      const title = fitWidth(s.title || "Untitled", inner - ago.length - 6);
      rows.push(makeRow(`  ${T.dim}${title} ${T.textMuted}(${ago})${T.reset}`, boxW));
    }
  }

  rows.push(emptyRow);
  rows.push(bot);

  process.stdout.write("\n" + rows.map((r) => centerLine(r, w)).join("\n") + "\n\n");
}

function printFull(version, greeting, model, provider, mode, cwd, hasSessions, sessions, w) {
  // Scale box: min 62, max 120, always fits terminal
  const boxW = Math.min(Math.max(62, w - 4), 120);
  const dividerCol = Math.floor(boxW * 0.50);
  const leftInner = dividerCol - 3;
  const rightInner = boxW - dividerCol - 4;

  const titleText = `LlamaTalk Build${version ? ` v${version}` : ""}`;
  const topFill = Math.max(0, boxW - titleText.length - 5);
  const top = `${T.border}${box.tl}${box.h} ${T.accent}${titleText}${T.reset} ${T.border}${box.h.repeat(topFill)}${box.tr}${T.reset}`;
  const bot = `${T.border}${box.bl}${box.h.repeat(boxW - 2)}${box.br}${T.reset}`;

  function dualRow(left, right) {
    const lFit = fitWidth(left || "", leftInner);
    const rFit = fitWidth(right || "", rightInner);
    return `${T.border}${box.v}${T.reset} ${lFit} ${T.border}${box.v}${T.reset} ${rFit} ${T.border}${box.v}${T.reset}`;
  }

  const emptyRow = dualRow("", "");

  // Left panel
  const leftLines = [];
  leftLines.push("");
  leftLines.push(`${T.textStrong}${greeting}${T.reset}`);
  leftLines.push("");

  for (const line of LLAMA_ART) {
    leftLines.push(`${T.accent}${line}${T.reset}`);
  }

  leftLines.push("");

  const status = buildStatusLine(model, provider, mode);
  if (status) leftLines.push(status);
  if (cwd) leftLines.push(`${T.textMuted}${cwd}${T.reset}`);
  leftLines.push("");

  // Right panel
  const rightLines = [];
  rightLines.push("");
  rightLines.push(`${T.textMuted}Tips for getting started${T.reset}`);
  rightLines.push(`${T.accent}/help${T.reset}${T.dim}    full command list${T.reset}`);
  rightLines.push(`${T.accent}/mode${T.reset}${T.dim}    toggle build/plan${T.reset}`);
  rightLines.push(`${T.accent}/model${T.reset}${T.dim}   select a model${T.reset}`);
  rightLines.push(`${T.accent}/session${T.reset}${T.dim} browse past sessions${T.reset}`);
  rightLines.push("");

  if (hasSessions) {
    rightLines.push(`${T.textMuted}Recent activity${T.reset}`);
    for (const s of sessions.slice(0, 3)) {
      const ago = timeAgo(s.lastUsed);
      const maxTitleLen = rightInner - ago.length - 4;
      const title = fitWidth(s.title || "Untitled", maxTitleLen);
      rightLines.push(`${T.dim}${title} ${T.textMuted}(${ago})${T.reset}`);
    }
    rightLines.push("");
  } else {
    rightLines.push("");
    rightLines.push("");
  }

  // Pad to same length
  const maxRows = Math.max(leftLines.length, rightLines.length);
  while (leftLines.length < maxRows) leftLines.push("");
  while (rightLines.length < maxRows) rightLines.push("");

  // Center the box in terminal
  const padLeft = " ".repeat(Math.max(0, Math.floor((w - boxW) / 2)));

  const rows = [];
  rows.push(padLeft + top);
  for (let i = 0; i < maxRows; i++) {
    rows.push(padLeft + dualRow(leftLines[i], rightLines[i]));
  }
  rows.push(padLeft + bot);

  process.stdout.write("\n" + rows.join("\n") + "\n\n");
}

function makeRow(content, boxW) {
  const plain = stripAnsi(content);
  const padding = Math.max(0, boxW - 2 - plain.length);
  return `${T.border}${box.v}${T.reset}${content}${" ".repeat(padding)}${T.border}${box.v}${T.reset}`;
}
