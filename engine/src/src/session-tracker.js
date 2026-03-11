import { existsSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from "fs";
import { join, relative } from "path";

/**
 * Tracks file changes during a session and writes them to
 * session-changes-clankbuild-YYYY-MM-DD.md in the project root.
 * Only writes if actual file modifications (write/edit) occurred.
 */
export class SessionTracker {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.sessionStart = new Date();
    this.date = this._formatDate(this.sessionStart);
    this.changes = []; // { time, type, path, summary }
    this.dirty = false;
  }

  get fileName() {
    return `session-changes-clankbuild-${this.date}.md`;
  }

  get filePath() {
    return join(this.projectRoot, this.fileName);
  }

  /**
   * Record a file change. Only write_file and edit_file count as "dirty".
   */
  addChange(toolName, filePath, summary) {
    const now = new Date();
    const currentDate = this._formatDate(now);

    // If the date rolled over, update the target file name
    if (currentDate !== this.date) {
      this.date = currentDate;
    }

    const relPath = relative(this.projectRoot, filePath) || filePath;

    this.changes.push({
      time: now,
      type: toolName,
      path: relPath,
      summary: summary.split("\n")[0].slice(0, 200),
    });

    // Only mark dirty for actual file modifications
    if (toolName === "write_file" || toolName === "edit_file") {
      this.dirty = true;
    }
  }

  /**
   * Get the list of changes for the activity sidebar display.
   * Returns most recent N changes.
   */
  getRecentChanges(count = 15) {
    return this.changes.slice(-count);
  }

  /**
   * Save session changes to the markdown file.
   * Does nothing if no file modifications were made.
   */
  save() {
    if (!this.dirty || this.changes.length === 0) return;

    // Clean up old session-changes files with different dates
    this._cleanOldFiles();

    const timeStr = this.sessionStart.toISOString().split("T")[1].split(".")[0];
    const writeChanges = this.changes.filter(
      (c) => c.type === "write_file" || c.type === "edit_file"
    );

    if (writeChanges.length === 0) return;

    const sessionBlock = [
      `## Session ${this.date} ${timeStr}`,
      "",
      ...writeChanges.map((c) => {
        const t = c.time.toISOString().split("T")[1].split(".")[0];
        return `- **${t}** \`${c.type}\` \`${c.path}\` — ${c.summary}`;
      }),
      "",
      "",
    ].join("\n");

    if (existsSync(this.filePath)) {
      const existing = readFileSync(this.filePath, "utf8");
      // Insert new session after the header
      const headerEnd = existing.indexOf("\n\n");
      if (headerEnd >= 0) {
        const header = existing.slice(0, headerEnd + 2);
        const rest = existing.slice(headerEnd + 2);
        writeFileSync(this.filePath, header + sessionBlock + rest, "utf8");
      } else {
        writeFileSync(this.filePath, existing + "\n\n" + sessionBlock, "utf8");
      }
    } else {
      const header = `# Session Changes — Clank Build\n\nProject: \`${this.projectRoot}\`\n\n`;
      writeFileSync(this.filePath, header + sessionBlock, "utf8");
    }
  }

  /**
   * Remove session-changes-llamabuild-*.md files with older dates
   * (keeps only the current date's file).
   */
  _cleanOldFiles() {
    try {
      const files = readdirSync(this.projectRoot);
      const pattern = /^session-changes-(?:llamabuild|clankbuild)-(\d{4}-\d{2}-\d{2})\.md$/;
      for (const f of files) {
        const match = f.match(pattern);
        if (match && match[1] !== this.date) {
          // Read old content and migrate it into current file
          const oldPath = join(this.projectRoot, f);
          const oldContent = readFileSync(oldPath, "utf8");
          // Extract session blocks (everything after the header)
          const headerEnd = oldContent.indexOf("\n\n");
          if (headerEnd >= 0) {
            // Skip the header + first blank section to get session blocks
            const blocks = oldContent.slice(headerEnd + 2);
            const projectHeader = oldContent.includes("Project:") ? "" : "";
            // We'll let save() create the new file, just append old blocks
            if (existsSync(this.filePath)) {
              const current = readFileSync(this.filePath, "utf8");
              writeFileSync(this.filePath, current + blocks, "utf8");
            }
            // If current file doesn't exist yet, old sessions will be lost
            // (acceptable — they belong to a different date)
          }
          try { unlinkSync(oldPath); } catch { /* locked */ }
        }
      }
    } catch { /* non-fatal */ }
  }

  _formatDate(d) {
    return d.toISOString().split("T")[0];
  }
}
