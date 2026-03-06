import { ORANGE, DIM, BOLD, RESET, GREEN, RED, YELLOW } from "./ui.js";

const BOX = { tl: "\u256D", tr: "\u256E", bl: "\u2570", br: "\u256F", h: "\u2500", v: "\u2502" };

class Sidebar {
  constructor() {
    this.enabled = false;
    this.maxLines = 25;
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  /**
   * Render a bordered code panel inline showing the changed file content.
   * For edits, oldContent/newContent show a diff. For writes, just newContent.
   */
  show(filePath, newContent, oldContent = null) {
    if (!this.enabled) return;

    const termWidth = process.stdout.columns || 100;
    const panelWidth = Math.min(termWidth - 4, 90);
    const innerWidth = panelWidth - 4; // 2 for border + 2 for padding

    // Build lines to display
    let lines;
    if (oldContent != null) {
      lines = this._buildDiffLines(oldContent, newContent, innerWidth);
    } else {
      lines = this._buildContentLines(newContent, innerWidth);
    }

    // Truncate if too long
    const maxDisplay = this.maxLines;
    let truncated = false;
    if (lines.length > maxDisplay) {
      const headCount = maxDisplay - 3;
      const tailCount = 2;
      const head = lines.slice(0, headCount);
      const tail = lines.slice(-tailCount);
      const omitted = lines.length - headCount - tailCount;
      lines = [...head, `${DIM}  ... ${omitted} more lines ...${RESET}`, ...tail];
      truncated = true;
    }

    // Render panel
    const title = filePath.length > innerWidth - 2
      ? "..." + filePath.slice(-(innerWidth - 5))
      : filePath;

    process.stdout.write(`\n  ${DIM}${BOX.tl}${BOX.h}${RESET} ${ORANGE}${title}${RESET} ${DIM}${BOX.h.repeat(Math.max(0, panelWidth - title.length - 5))}${BOX.tr}${RESET}\n`);

    for (const line of lines) {
      // Strip ANSI for length calculation
      const plain = line.replace(/\x1b\[[0-9;]*m/g, "");
      const pad = Math.max(0, innerWidth - plain.length);
      process.stdout.write(`  ${DIM}${BOX.v}${RESET} ${line}${" ".repeat(pad)} ${DIM}${BOX.v}${RESET}\n`);
    }

    process.stdout.write(`  ${DIM}${BOX.bl}${BOX.h.repeat(panelWidth - 2)}${BOX.br}${RESET}\n`);
  }

  _buildContentLines(content, maxWidth) {
    const raw = content.split("\n");
    const lines = [];
    const numWidth = String(raw.length).length;

    for (let i = 0; i < raw.length; i++) {
      const num = String(i + 1).padStart(numWidth);
      const text = raw[i].slice(0, maxWidth - numWidth - 3);
      lines.push(`${DIM}${num}${RESET} ${text}`);
    }
    return lines;
  }

  _buildDiffLines(oldContent, newContent, maxWidth) {
    const oldLines = oldContent.split("\n");
    const newLines = newContent.split("\n");
    const lines = [];

    // Simple diff: find changed regions
    const maxLen = Math.max(oldLines.length, newLines.length);
    let inChange = false;

    for (let i = 0; i < maxLen; i++) {
      const oldLine = oldLines[i];
      const newLine = newLines[i];

      if (oldLine !== newLine) {
        if (!inChange) {
          lines.push(`${DIM}@@ line ${i + 1} @@${RESET}`);
          inChange = true;
        }
        if (oldLine !== undefined) {
          lines.push(`${RED}- ${oldLine.slice(0, maxWidth - 2)}${RESET}`);
        }
        if (newLine !== undefined) {
          lines.push(`${GREEN}+ ${newLine.slice(0, maxWidth - 2)}${RESET}`);
        }
      } else {
        if (inChange) {
          // Show one context line after change
          if (oldLine !== undefined) {
            lines.push(`${DIM}  ${oldLine.slice(0, maxWidth - 2)}${RESET}`);
          }
          inChange = false;
        }
      }
    }
    return lines;
  }
}

export const sidebar = new Sidebar();
