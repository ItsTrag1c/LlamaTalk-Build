/**
 * Scheduler — cron-based job scheduler for sub-agent tasks.
 *
 * Runs a background timer that checks every 60 seconds for due schedules.
 * When a schedule fires, it creates/reuses a sub-agent engine and runs the
 * task via the same delegation pattern used by delegate_to_agent.
 *
 * Persists schedule definitions to schedules.json in the memory directory.
 * Emits events so consumers (Telegram bot, Desktop) can display results.
 */

import { EventEmitter } from "events";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { getMemoryDir, saveConversation } from "./config.js";

const CHECK_INTERVAL_MS = 60_000; // Check every 60 seconds

// ─── Simple cron parser ─────────────────────────────────────────────
// Supports: *, */N, N, N-M, comma-separated lists
// Fields: minute hour day-of-month month day-of-week
// Also supports shorthand: @hourly, @daily, @weekly, @every_Nm, @every_Nh

function parseCronField(field, min, max) {
  if (field === "*") return null; // matches everything

  const values = new Set();

  for (const part of field.split(",")) {
    const trimmed = part.trim();

    // */N — every N
    const stepMatch = trimmed.match(/^\*\/(\d+)$/);
    if (stepMatch) {
      const step = parseInt(stepMatch[1], 10);
      for (let i = min; i <= max; i += step) values.add(i);
      continue;
    }

    // N-M — range
    const rangeMatch = trimmed.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      const from = parseInt(rangeMatch[1], 10);
      const to = parseInt(rangeMatch[2], 10);
      for (let i = from; i <= to; i++) values.add(i);
      continue;
    }

    // N — exact value
    const num = parseInt(trimmed, 10);
    if (!isNaN(num) && num >= min && num <= max) {
      values.add(num);
    }
  }

  return values.size > 0 ? values : null;
}

function expandShorthand(expr) {
  if (expr === "@hourly")  return "0 * * * *";
  if (expr === "@daily")   return "0 0 * * *";
  if (expr === "@weekly")  return "0 0 * * 0";
  if (expr === "@monthly") return "0 0 1 * *";

  // @every_Nm or @every_Nh (e.g., @every_30m, @every_2h)
  const everyMatch = expr.match(/^@every_(\d+)([mh])$/);
  if (everyMatch) {
    const n = parseInt(everyMatch[1], 10);
    if (everyMatch[2] === "m") return `*/${n} * * * *`;
    if (everyMatch[2] === "h") return `0 */${n} * * *`;
  }

  return expr;
}

function parseCron(expression) {
  const expanded = expandShorthand(expression.trim());
  const parts = expanded.split(/\s+/);
  if (parts.length !== 5) return null;

  return {
    minute:     parseCronField(parts[0], 0, 59),
    hour:       parseCronField(parts[1], 0, 23),
    dayOfMonth: parseCronField(parts[2], 1, 31),
    month:      parseCronField(parts[3], 1, 12),
    dayOfWeek:  parseCronField(parts[4], 0, 6),
  };
}

function cronMatches(parsed, date) {
  const m = date.getMinutes();
  const h = date.getHours();
  const dom = date.getDate();
  const mon = date.getMonth() + 1;
  const dow = date.getDay();

  if (parsed.minute     && !parsed.minute.has(m))     return false;
  if (parsed.hour       && !parsed.hour.has(h))       return false;
  if (parsed.dayOfMonth && !parsed.dayOfMonth.has(dom)) return false;
  if (parsed.month      && !parsed.month.has(mon))     return false;
  if (parsed.dayOfWeek  && !parsed.dayOfWeek.has(dow)) return false;
  return true;
}

// ─── Scheduler class ─────────────────────────────────────────────────

export class Scheduler extends EventEmitter {
  constructor(config, options = {}) {
    super();
    this.config = config;
    this.projectRoot = options.projectRoot || process.cwd();
    this.encKey = options.encKey || null;
    this.memoryDir = getMemoryDir();
    this.schedulesFile = join(this.memoryDir, "schedules.json");

    this._timer = null;
    this._running = new Set(); // schedule IDs currently executing
    this._subEngineCache = new Map();

    // Ensure memory dir exists
    if (!existsSync(this.memoryDir)) {
      mkdirSync(this.memoryDir, { recursive: true });
    }
  }

  // ─── Persistence ───────────────────────────────────────────────────

  _load() {
    if (!existsSync(this.schedulesFile)) return [];
    try {
      return JSON.parse(readFileSync(this.schedulesFile, "utf8"));
    } catch {
      return [];
    }
  }

  _save(schedules) {
    writeFileSync(this.schedulesFile, JSON.stringify(schedules, null, 2), "utf8");
  }

  // ─── Public API ────────────────────────────────────────────────────

  /** Start the scheduler timer. */
  start() {
    if (this._timer) return;
    this._timer = setInterval(() => this._tick(), CHECK_INTERVAL_MS);
    // Don't keep the process alive just for the scheduler
    if (this._timer.unref) this._timer.unref();
    // Run an initial tick after a short delay so newly-added schedules
    // don't have to wait up to 60s for the first check.
    setTimeout(() => this._tick(), 5000);
    this.emit("started");
  }

  /** Stop the scheduler timer. */
  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this.emit("stopped");
  }

  /** Add a new scheduled job. Returns the created schedule. */
  add({ agentId, task, cron, enabled = true, oneShot = false }) {
    const parsed = parseCron(cron);
    if (!parsed) return { error: `Invalid cron expression: "${cron}"` };

    // Validate agent exists
    const agents = this.config.subAgents || [];
    const agent = agents.find(
      (a) => a.id === agentId || a.name.toLowerCase() === agentId.toLowerCase()
    );
    if (!agent) {
      const available = agents.filter((a) => a.enabled !== false).map((a) => a.name).join(", ");
      return { error: `No sub-agent "${agentId}". Available: ${available || "none"}` };
    }

    const schedules = this._load();
    const schedule = {
      id: `sched_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      agentId: agent.id,
      agentName: agent.name,
      task,
      cron,
      enabled,
      oneShot,
      lastRun: null,
      lastResult: null, // "success" | "error" | "no_tools"
      runCount: 0,
      createdAt: new Date().toISOString(),
    };

    schedules.push(schedule);
    this._save(schedules);
    this.emit("schedule-added", schedule);

    // Trigger a check soon so the schedule doesn't wait up to 60s
    if (this._timer) {
      setTimeout(() => this._tick(), 3000);
    }

    return schedule;
  }

  /** List all schedules. */
  list() {
    return this._load();
  }

  /** Remove a schedule by ID or index (1-based). */
  remove(idOrIndex) {
    const schedules = this._load();
    let removed = null;

    if (typeof idOrIndex === "number") {
      if (idOrIndex < 1 || idOrIndex > schedules.length) return null;
      [removed] = schedules.splice(idOrIndex - 1, 1);
    } else {
      const idx = schedules.findIndex((s) => s.id === idOrIndex);
      if (idx < 0) return null;
      [removed] = schedules.splice(idx, 1);
    }

    this._save(schedules);
    this.emit("schedule-removed", removed);
    return removed;
  }

  /** Enable/disable a schedule by ID or index (1-based). */
  toggle(idOrIndex, enabled) {
    const schedules = this._load();
    let schedule = null;

    if (typeof idOrIndex === "number") {
      if (idOrIndex < 1 || idOrIndex > schedules.length) return null;
      schedule = schedules[idOrIndex - 1];
    } else {
      schedule = schedules.find((s) => s.id === idOrIndex);
    }

    if (!schedule) return null;
    schedule.enabled = enabled;
    this._save(schedules);
    this.emit("schedule-toggled", schedule);
    return schedule;
  }

  /** Build a summary block for system prompt injection. */
  buildScheduleBlock() {
    const schedules = this._load().filter((s) => s.enabled);
    if (schedules.length === 0) return "";

    const lines = ["## Scheduled Jobs"];
    for (const s of schedules) {
      const lastInfo = s.lastRun
        ? ` (last run: ${new Date(s.lastRun).toLocaleString()}, result: ${s.lastResult || "unknown"})`
        : " (never run)";
      lines.push(`- **${s.agentName}**: "${s.task}" — \`${s.cron}\`${s.oneShot ? " [one-shot]" : ""}${lastInfo}`);
    }
    return lines.join("\n");
  }

  // ─── Tick: check and execute due schedules ─────────────────────────

  async _tick() {
    const now = new Date();
    const schedules = this._load();
    let dirty = false;

    for (const schedule of schedules) {
      if (!schedule.enabled) continue;
      if (this._running.has(schedule.id)) continue; // already executing

      const parsed = parseCron(schedule.cron);
      if (!parsed) continue;

      if (!cronMatches(parsed, now)) continue;

      // Prevent re-triggering within the same minute
      if (schedule.lastRun) {
        const lastRun = new Date(schedule.lastRun);
        const diffMs = now.getTime() - lastRun.getTime();
        if (diffMs < CHECK_INTERVAL_MS) continue;
      }

      // Mark as running and update lastRun
      this._running.add(schedule.id);
      schedule.lastRun = now.toISOString();
      schedule.runCount = (schedule.runCount || 0) + 1;
      dirty = true;

      // Execute in background — don't block the tick loop.
      // Always clean up _running on completion/error so the schedule isn't
      // permanently stuck if _executeSchedule throws outside its try-catch.
      this._executeSchedule(schedule)
        .catch((err) => {
          this._finishSchedule(schedule.id, "error", err.message || String(err));
          this.emit("schedule-error", {
            scheduleId: schedule.id,
            agentName: schedule.agentName,
            error: err.message || String(err),
          });
        });
    }

    if (dirty) this._save(schedules);
  }

  async _executeSchedule(schedule) {
    const { AgentEngine } = await import("./agent.js");

    // Find the agent definition
    const agents = this.config.subAgents || [];
    const def = agents.find((a) => a.id === schedule.agentId);
    if (!def) {
      this._finishSchedule(schedule.id, "error", `Agent "${schedule.agentId}" not found`);
      return;
    }

    this.emit("schedule-triggered", {
      scheduleId: schedule.id,
      agentName: schedule.agentName,
      task: schedule.task,
      cron: schedule.cron,
    });

    // Reuse or create sub-agent engine
    let subEngine = this._subEngineCache.get(schedule.agentId);

    if (!subEngine) {
      const subConfig = { ...this.config };
      if (def.model) subConfig.selectedModel = def.model;

      subEngine = new AgentEngine(subConfig, {
        projectRoot: this.projectRoot,
        encKey: this.encKey,
        noMemory: false,
        subAgentDef: def,
      });

      subEngine.conversationId = `sched-${def.id}-${Date.now()}`;
      subEngine.messages = [];
      subEngine.firstMessageSent = true;

      try {
        saveConversation(subEngine.conversationId, subEngine.messages, this.encKey);
      } catch { /* non-fatal */ }

      this._subEngineCache.set(schedule.agentId, subEngine);
    } else {
      // Clear conversation for fresh execution
      subEngine.messages = [];
      try {
        saveConversation(subEngine.conversationId, subEngine.messages, this.encKey);
      } catch { /* non-fatal */ }
    }

    // Capture results
    let finalResponse = "";
    let iterCount = 0;
    const onEnd = ({ text }) => { finalResponse = text || ""; };
    const onUsage = ({ iterationCount }) => { iterCount = iterationCount || 0; };
    subEngine.removeAllListeners("response-end");
    subEngine.removeAllListeners("usage");
    subEngine.on("response-end", onEnd);
    subEngine.on("usage", onUsage);

    const wrappedTask = `SCHEDULED TASK: ${schedule.task}\n\nExecute this task NOW using your tools. Start with a tool call — do not reply with text first. Complete ALL steps before responding with text.`;

    try {
      await subEngine.sendMessage(wrappedTask);

      // Retry if no tools used
      if (iterCount === 0) {
        finalResponse = "";
        iterCount = 0;
        await subEngine.sendMessage(
          "You did not execute any tools. You MUST respond with a tool call right now. Do NOT reply with text — reply with a tool call."
        );
      }
    } catch (err) {
      this._finishSchedule(schedule.id, "error", err.message);
      this.emit("schedule-error", {
        scheduleId: schedule.id,
        agentName: schedule.agentName,
        error: err.message,
      });
      return;
    }

    const result = iterCount > 0 ? "success" : "no_tools";
    this._finishSchedule(schedule.id, result, null);

    // Truncate response for the event
    const maxLen = 4000;
    const response = finalResponse.length > maxLen
      ? finalResponse.slice(0, maxLen) + `\n\n[Truncated — ${finalResponse.length - maxLen} chars omitted]`
      : finalResponse;

    this.emit("schedule-completed", {
      scheduleId: schedule.id,
      agentName: schedule.agentName,
      task: schedule.task,
      result,
      response,
      iterationCount: iterCount,
    });

    // Handle one-shot: disable after first successful run
    if (schedule.oneShot && result === "success") {
      const schedules = this._load();
      const s = schedules.find((sc) => sc.id === schedule.id);
      if (s) {
        s.enabled = false;
        this._save(schedules);
        this.emit("schedule-toggled", s);
      }
    }
  }

  _finishSchedule(scheduleId, result, errorMsg) {
    this._running.delete(scheduleId);

    const schedules = this._load();
    const s = schedules.find((sc) => sc.id === scheduleId);
    if (s) {
      s.lastResult = result;
      if (errorMsg) s.lastError = errorMsg;
      this._save(schedules);
    }
  }
}

// Export the cron helpers for testing
export { parseCron, cronMatches, expandShorthand };
