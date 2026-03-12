import { existsSync, readFileSync, writeFileSync, renameSync } from "fs";
import { join } from "path";

export class SessionLog {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.filePath = join(projectRoot, ".clank-session.md");
    this.steps = [];
    this.sessionStart = new Date();

    // Backward compat: migrate .clankbuild-session.md → .clank-session.md
    if (!existsSync(this.filePath)) {
      const legacyPath = join(projectRoot, ".clankbuild-session.md");
      if (existsSync(legacyPath)) {
        try { renameSync(legacyPath, this.filePath); } catch { /* non-fatal */ }
      }
    }
  }

  addStep(description) {
    this.steps.push({
      time: new Date(),
      description,
    });
  }

  /**
   * Save the session log to disk.
   * Only writes if steps were recorded. Prepends the new session
   * after the header so most recent is on top.
   */
  save() {
    if (this.steps.length === 0) return;

    const dateStr = this.sessionStart.toISOString().split("T")[0];
    const timeStr = this.sessionStart.toISOString().split("T")[1].split(".")[0];

    const sessionBlock = [
      `## Session ${dateStr} ${timeStr}`,
      ...this.steps.map((s) => `- ${s.description}`),
      "",
      "",
    ].join("\n");

    if (existsSync(this.filePath)) {
      const existing = readFileSync(this.filePath, "utf8");
      // Insert new session after the header line
      const headerEnd = existing.indexOf("\n\n");
      if (headerEnd >= 0) {
        const header = existing.slice(0, headerEnd + 2);
        const rest = existing.slice(headerEnd + 2);
        writeFileSync(this.filePath, header + sessionBlock + rest, "utf8");
      } else {
        writeFileSync(this.filePath, existing + "\n\n" + sessionBlock, "utf8");
      }
    } else {
      const header = "# Clank Session Log\n\n";
      writeFileSync(this.filePath, header + sessionBlock, "utf8");
    }
  }
}
