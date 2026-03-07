import { theme, box, icons, stripAnsi, termWidth } from "./theme.js";

const T = theme;

/**
 * Activity panel — auto-shows during file modifications.
 * Renders an inline box with live diff/change detail.
 */
class ActivityPanel {
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

    // Title
    const label = filePath.length > inner - 2
      ? "..." + filePath.slice(-(inner - 5))
      : filePath;
    const typeTag = toolName === "write_file"
      ? `${T.success}+new${T.reset}`
      : `${T.warning}~edit${T.reset}`;
    const titleText = `${T.filePath}${label}${T.reset} ${typeTag}`;
    const titlePlain = stripAnsi(titleText);
    const titlePad = Math.max(0, w - titlePlain.length - 5);

    process.stdout.write(
      `\n  ${T.border}${box.tl}${box.h}${T.reset} ${titleText} ${T.border}${box.h.repeat(titlePad)}${box.tr}${T.reset}\n`
    );

    // Build content lines
    let lines;
    if (toolName === "edit_file" && oldContent != null) {
      lines = this._diffLines(args.old_text, args.new_text, inner);
    } else if (toolName === "edit_file" && args.old_text && args.new_text) {
      lines = this._diffLines(args.old_text, args.new_text, inner);
    } else {
      // write_file — show preview of written content
      lines = this._previewLines(newContent, inner);
    }

    // Truncate if too many lines
    if (lines.length > this.maxPreviewLines) {
      const head = lines.slice(0, this.maxPreviewLines - 2);
      const omitted = lines.length - (this.maxPreviewLines - 2);
      lines = [...head, `${T.textMuted}  ${icons.ellipsis} ${omitted} more lines${T.reset}`];
    }

    // Render lines inside box
    for (const line of lines) {
      const plain = stripAnsi(line);
      const pad = Math.max(0, inner - plain.length);
      process.stdout.write(
        `  ${T.border}${box.v}${T.reset} ${line}${" ".repeat(pad)} ${T.border}${box.v}${T.reset}\n`
      );
    }

    process.stdout.write(`  ${T.border}${box.bl}${box.h.repeat(w - 2)}${box.br}${T.reset}\n`);
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
    const title = `${T.info}Activity${T.reset}`;
    const titlePlain = "Activity";
    const titlePad = Math.max(0, w - titlePlain.length - 5);

    process.stdout.write(
      `\n  ${T.border}${box.tl}${box.h}${T.reset} ${title} ${T.border}${box.h.repeat(titlePad)}${box.tr}${T.reset}\n`
    );

    const visible = changes.slice(-this.maxActivityEntries);

    if (changes.length > this.maxActivityEntries) {
      const omitted = changes.length - this.maxActivityEntries;
      const line = `${T.textMuted}${icons.ellipsis} ${omitted} earlier${T.reset}`;
      const plain = stripAnsi(line);
      const pad = Math.max(0, inner - plain.length);
      process.stdout.write(`  ${T.border}${box.v}${T.reset} ${line}${" ".repeat(pad)} ${T.border}${box.v}${T.reset}\n`);
    }

    for (const change of visible) {
      const timeStr = change.time.toISOString().split("T")[1].split(".")[0];
      const isWrite = change.type === "write_file" || change.type === "generate_file";
      const isEdit = change.type === "edit_file";
      const isBash = change.type === "bash";
      const typeIcon = isWrite ? `${T.success}+${T.reset}` : isEdit ? `${T.warning}~${T.reset}` : isBash ? `${T.command}>${T.reset}` : `${T.textMuted}${icons.arrow}${T.reset}`;
      const pathStr = change.path.length > (inner - 14)
        ? "..." + change.path.slice(-(inner - 17))
        : change.path;

      const line = `${T.textMuted}${timeStr}${T.reset}  ${typeIcon}  ${T.filePath}${pathStr}${T.reset}`;
      const plain = stripAnsi(line);
      const pad = Math.max(0, inner - plain.length);
      process.stdout.write(`  ${T.border}${box.v}${T.reset} ${line}${" ".repeat(pad)} ${T.border}${box.v}${T.reset}\n`);
    }

    process.stdout.write(`  ${T.border}${box.bl}${box.h.repeat(w - 2)}${box.br}${T.reset}\n`);
  }

  // ── Internal ────────────────────────────────────────────

  _diffLines(oldText, newText, maxWidth) {
    if (!oldText || !newText) return [];
    const oldLines = oldText.split("\n");
    const newLines = newText.split("\n");
    const lines = [];
    const maxLen = Math.max(oldLines.length, newLines.length);
    const clip = maxWidth - 3;

    // Show a contextual diff
    let contextBefore = null;
    for (let i = 0; i < maxLen; i++) {
      const ol = oldLines[i];
      const nl = newLines[i];
      if (ol !== nl) {
        // One context line before the first change
        if (contextBefore != null && lines.length === 0) {
          lines.push(`${T.textMuted}  ${contextBefore.slice(0, clip)}${T.reset}`);
        }
        if (ol !== undefined) {
          lines.push(`${T.error}- ${ol.slice(0, clip)}${T.reset}`);
        }
        if (nl !== undefined) {
          lines.push(`${T.success}+ ${nl.slice(0, clip)}${T.reset}`);
        }
      } else {
        // Track context, show one line after a change block
        if (lines.length > 0 && (i > 0 && oldLines[i - 1] !== newLines[i - 1])) {
          lines.push(`${T.textMuted}  ${(ol || "").slice(0, clip)}${T.reset}`);
        }
        contextBefore = ol;
      }
    }
    return lines;
  }

  _previewLines(content, maxWidth) {
    if (!content) return [`${T.textMuted}(empty file)${T.reset}`];
    const raw = content.split("\n");
    const lines = [];
    const numW = String(Math.min(raw.length, this.maxPreviewLines)).length + 1;
    const clip = maxWidth - numW - 2;
    const count = Math.min(raw.length, this.maxPreviewLines);

    for (let i = 0; i < count; i++) {
      const num = String(i + 1).padStart(numW);
      lines.push(`${T.lineNumber}${num}${T.reset} ${raw[i].slice(0, clip)}`);
    }
    if (raw.length > count) {
      lines.push(`${T.textMuted}  ${icons.ellipsis} ${raw.length - count} more lines${T.reset}`);
    }
    return lines;
  }
}

export const activityPanel = new ActivityPanel();
