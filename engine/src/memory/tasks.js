import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { getMemoryDir } from "../config.js";

export class TaskManager {
  constructor(memoryDir = null) {
    this.memoryDir = memoryDir || getMemoryDir();
    this.tasksFile = join(this.memoryDir, "tasks.md");
  }

  /** Parse the tasks.md file into structured data. */
  _parse() {
    if (!existsSync(this.tasksFile)) return { active: [], completed: [] };
    try {
      const content = readFileSync(this.tasksFile, "utf8");
      const lines = content.split("\n");
      const active = [];
      const completed = [];
      let section = null;

      for (const line of lines) {
        if (line.startsWith("## Active")) { section = "active"; continue; }
        if (line.startsWith("## Completed")) { section = "completed"; continue; }
        if (!line.startsWith("- ")) continue;

        const isDone = line.startsWith("- [x]");
        const text = line.replace(/^- \[[ x]\]\s*/, "");

        // Parse: description | Due: YYYY-MM-DD | Created: YYYY-MM-DD
        const parts = text.split(" | ");
        const description = parts[0]?.trim() || "";
        let dueDate = null;
        let created = null;
        for (const p of parts.slice(1)) {
          const t = p.trim();
          if (t.startsWith("Due: ")) dueDate = t.slice(5).trim();
          if (t.startsWith("Created: ")) created = t.slice(9).trim();
        }

        const task = { description, dueDate, created: created || new Date().toISOString().split("T")[0] };
        if (isDone || section === "completed") {
          completed.push(task);
        } else {
          active.push(task);
        }
      }

      return { active, completed };
    } catch {
      return { active: [], completed: [] };
    }
  }

  /** Serialize tasks back to markdown. */
  _save(data) {
    const lines = ["# Tasks", ""];
    lines.push("## Active");
    for (const t of data.active) {
      let entry = `- [ ] ${t.description}`;
      if (t.dueDate) entry += ` | Due: ${t.dueDate}`;
      entry += ` | Created: ${t.created}`;
      lines.push(entry);
    }
    lines.push("");
    lines.push("## Completed");
    // Keep only last 20 completed tasks
    const recent = data.completed.slice(-20);
    for (const t of recent) {
      let entry = `- [x] ${t.description}`;
      if (t.dueDate) entry += ` | Due: ${t.dueDate}`;
      entry += ` | Created: ${t.created}`;
      lines.push(entry);
    }
    lines.push("");
    writeFileSync(this.tasksFile, lines.join("\n"), "utf8");
  }

  /** List all tasks. */
  list() {
    return this._parse();
  }

  /** Add a new task. Returns the created task. */
  add(description, dueDate = null) {
    const data = this._parse();
    const task = {
      description,
      dueDate: dueDate || null,
      created: new Date().toISOString().split("T")[0],
    };
    data.active.push(task);
    this._save(data);
    return task;
  }

  /** Mark task #index (1-based) as complete. */
  complete(index) {
    const data = this._parse();
    if (index < 1 || index > data.active.length) return null;
    const [task] = data.active.splice(index - 1, 1);
    data.completed.push(task);
    this._save(data);
    return task;
  }

  /** Remove task #index (1-based) entirely. */
  remove(index) {
    const data = this._parse();
    if (index < 1 || index > data.active.length) return null;
    const [task] = data.active.splice(index - 1, 1);
    this._save(data);
    return task;
  }

  /** Get tasks that are due today or overdue. */
  getDueTasks() {
    const data = this._parse();
    const today = new Date().toISOString().split("T")[0];
    return data.active.filter((t) => t.dueDate && t.dueDate <= today);
  }

  /** Build markdown block for system prompt injection. */
  buildTaskBlock() {
    const data = this._parse();
    if (data.active.length === 0) return "";

    const lines = ["## Tasks"];
    const today = new Date().toISOString().split("T")[0];
    for (let i = 0; i < data.active.length; i++) {
      const t = data.active[i];
      const overdue = t.dueDate && t.dueDate < today;
      const dueToday = t.dueDate && t.dueDate === today;
      let marker = "";
      if (overdue) marker = " **[OVERDUE]**";
      else if (dueToday) marker = " **[DUE TODAY]**";
      let entry = `${i + 1}. ${t.description}`;
      if (t.dueDate) entry += ` (due: ${t.dueDate})`;
      entry += marker;
      lines.push(entry);
    }
    return lines.join("\n");
  }
}
