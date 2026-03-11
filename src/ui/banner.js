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

function formatDueTag(due) {
  if (!due) return "";
  const now = new Date();
  const dueDate = new Date(due);
  // Compare dates only (ignore time)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const diffDays = Math.floor((dueStart - todayStart) / 86400000);

  if (diffDays < 0) return `${T.error}overdue${T.reset}`;
  if (diffDays === 0) return `${T.warning}due today${T.reset}`;
  if (diffDays === 1) return `${T.dim}tomorrow${T.reset}`;
  return `${T.dim}in ${diffDays}d${T.reset}`;
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

export function printBanner(version = "", { model, mode, provider, cwd, sessions, tasks, activity, memoryStats } = {}) {
  const w = termWidth();
  const hasSessions = sessions && sessions.length > 0;
  const greeting = hasSessions ? "Welcome back!" : "Welcome!";

  if (w < 40) {
    printMinimal(version, model, provider, mode, w, tasks);
    return;
  }

  if (w < 62) {
    printCompact(version, greeting, model, provider, mode, cwd, hasSessions, sessions, w, tasks);
    return;
  }

  printFull(version, greeting, model, provider, mode, cwd, hasSessions, sessions, w, tasks, memoryStats);
}

function printMinimal(version, model, provider, mode, w, tasks) {
  const titleText = `Clank Build${version ? ` v${version}` : ""}`;
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

  const activeCount = tasks?.active?.length || 0;
  if (activeCount > 0) {
    rows.push(makeRow(`  ${T.accent}${activeCount}${T.reset} ${T.dim}task(s) active${T.reset}`, boxW));
  }

  rows.push(makeRow(`  ${T.textMuted}/help${T.reset} ${T.dim}commands${T.reset}  ${T.textMuted}/reflect${T.reset} ${T.dim}learn${T.reset}`, boxW));
  rows.push(bot);

  process.stdout.write("\n" + rows.map((r) => centerLine(r, w)).join("\n") + "\n\n");
}

function printCompact(version, greeting, model, provider, mode, cwd, hasSessions, sessions, w, tasks) {
  // Scale between 40 and 61 — use most of the available width
  const boxW = Math.min(w - 2, 60);
  const inner = boxW - 4;

  const titleText = `Clank Build${version ? ` v${version}` : ""}`;
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
  rows.push(makeRow(`  ${T.accent}/help${T.reset} ${T.dim}commands${T.reset}  ${T.accent}/mode${T.reset} ${T.dim}switch${T.reset}  ${T.accent}/models${T.reset} ${T.dim}list models${T.reset}  ${T.accent}/reflect${T.reset} ${T.dim}learn${T.reset}`, boxW));

  if (hasSessions) {
    rows.push(emptyRow);
    rows.push(makeRow(`  ${T.textMuted}Recent activity${T.reset}`, boxW));
    for (const s of sessions.slice(0, 3)) {
      const ago = timeAgo(s.lastUsed);
      const title = fitWidth(s.title || "Untitled", inner - ago.length - 6);
      rows.push(makeRow(`  ${T.dim}${title} ${T.textMuted}(${ago})${T.reset}`, boxW));
    }
  }

  if (tasks?.active?.length > 0) {
    rows.push(emptyRow);
    rows.push(makeRow(`  ${T.textMuted}Active Tasks${T.reset}`, boxW));
    for (const task of tasks.active.slice(0, 3)) {
      const dueTag = formatDueTag(task.dueDate);
      const maxLen = inner - stripAnsi(dueTag).length - 6;
      const title = fitWidth(task.description || "Untitled", maxLen);
      rows.push(makeRow(`  ${T.dim}${icons.arrow} ${title}${T.reset}${dueTag ? ` ${dueTag}` : ""}`, boxW));
    }
  }

  rows.push(emptyRow);
  rows.push(bot);

  process.stdout.write("\n" + rows.map((r) => centerLine(r, w)).join("\n") + "\n\n");
}

function printFull(version, greeting, model, provider, mode, cwd, hasSessions, sessions, w, tasks, memoryStats) {
  // Scale box: min 62, max 120, always fits terminal
  const boxW = Math.min(Math.max(62, w - 4), 120);
  const dividerCol = Math.floor(boxW * 0.50);
  const leftInner = dividerCol - 3;
  const rightInner = boxW - dividerCol - 4;

  const titleText = `Clank Build${version ? ` v${version}` : ""}`;
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

  // Recent Sessions section
  if (hasSessions) {
    rightLines.push(`${T.textMuted}Recent Sessions${T.reset}`);
    for (const s of sessions.slice(0, 3)) {
      const ago = timeAgo(s.lastUsed);
      const maxTitleLen = rightInner - ago.length - 4;
      const title = fitWidth(s.title || "Untitled", maxTitleLen);
      rightLines.push(`${T.dim}${title} ${T.textMuted}(${ago})${T.reset}`);
    }
    rightLines.push("");
  }

  // Active Tasks section
  if (tasks?.active?.length > 0) {
    rightLines.push(`${T.textMuted}Active Tasks${T.reset}`);
    for (const task of tasks.active.slice(0, 5)) {
      const dueTag = formatDueTag(task.dueDate);
      const maxLen = rightInner - stripAnsi(dueTag).length - 4;
      const title = fitWidth(task.description || "Untitled", maxLen);
      rightLines.push(`${icons.arrow} ${title}${dueTag ? ` ${dueTag}` : ""}`);
    }
    rightLines.push("");
  }

  // Agent Status section
  rightLines.push(`${T.textMuted}Agent Status${T.reset}`);
  const memEnabled = memoryStats?.enabled !== false;
  const topicCount = memoryStats?.topicCount || 0;
  const lessonsCount = memoryStats?.lessonsCount || 0;
  rightLines.push(`${memEnabled ? `${T.success}${icons.success}${T.reset}` : `${T.error}${icons.error}${T.reset}`} ${T.dim}Memory ${memEnabled ? "enabled" : "disabled"}${T.reset}${memEnabled ? ` ${T.textMuted}(${topicCount} topic${topicCount !== 1 ? "s" : ""})${T.reset}` : ""}`);
  if (lessonsCount > 0) {
    rightLines.push(`${T.dim}${icons.dot} ${lessonsCount} lesson${lessonsCount !== 1 ? "s" : ""} learned${T.reset}`);
  }
  rightLines.push("");

  // Command tips
  rightLines.push(`${T.textMuted}Commands${T.reset}`);
  rightLines.push(`${T.accent}/help${T.reset} ${T.dim}commands${T.reset}  ${T.accent}/mode${T.reset} ${T.dim}switch${T.reset}`);
  rightLines.push(`${T.accent}/models${T.reset} ${T.dim}list${T.reset}  ${T.accent}/reflect${T.reset} ${T.dim}learn${T.reset}`);
  rightLines.push(`${T.accent}/home${T.reset} ${T.dim}dashboard${T.reset}  ${T.accent}/telegram${T.reset} ${T.dim}bot${T.reset}`);
  rightLines.push("");

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
