/**
 * schedule_task — Schedule autonomous jobs for sub-agents.
 *
 * The manager agent uses this tool to create, list, remove, and toggle
 * scheduled tasks. Schedules run on a cron-like timer and delegate work
 * to sub-agents automatically.
 */

export const scheduleTaskTool = {
  definition: {
    name: "schedule_task",
    description: `Manage scheduled autonomous jobs for sub-agents. Actions:
- "add": Schedule a recurring or one-shot job for a sub-agent (requires agent, task, cron)
- "list": Show all scheduled jobs
- "remove": Remove a scheduled job by index (1-based)
- "enable": Enable a paused schedule by index
- "disable": Pause a schedule by index

Cron format: "minute hour day-of-month month day-of-week" (e.g., "0 */6 * * *" = every 6 hours).
Shorthands: @hourly, @daily, @weekly, @monthly, @every_30m, @every_2h.`,
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          description: "Action to perform: add, list, remove, enable, disable",
          enum: ["add", "list", "remove", "enable", "disable"],
        },
        agent: {
          type: "string",
          description: "Name or ID of the sub-agent (required for 'add')",
        },
        task: {
          type: "string",
          description: "Task description to run on schedule (required for 'add')",
        },
        cron: {
          type: "string",
          description: "Cron expression or shorthand (required for 'add'). E.g., '*/30 * * * *', '@hourly', '@every_2h'",
        },
        index: {
          type: "integer",
          description: "Schedule index (1-based) for remove/enable/disable actions",
        },
        one_shot: {
          type: "boolean",
          description: "If true, the schedule runs once then auto-disables (default: false)",
        },
      },
      required: ["action"],
    },
  },

  safetyLevel: "medium",

  validate(args) {
    if (!args?.action) return { ok: false, error: "Missing action" };
    const action = args.action.toLowerCase();

    if (action === "add") {
      if (!args.agent) return { ok: false, error: "Missing agent name for 'add'" };
      if (!args.task) return { ok: false, error: "Missing task description for 'add'" };
      if (!args.cron) return { ok: false, error: "Missing cron expression for 'add'" };
    }

    if (["remove", "enable", "disable"].includes(action)) {
      if (!args.index && args.index !== 0) return { ok: false, error: `Missing index for '${action}'` };
    }

    return { ok: true };
  },

  formatConfirmation(args) {
    const action = (args.action || "").toLowerCase();
    if (action === "add") {
      return `schedule_task → add: ${args.agent} "${(args.task || "").slice(0, 60)}" [${args.cron}]`;
    }
    if (action === "remove") return `schedule_task → remove schedule #${args.index}`;
    if (action === "enable") return `schedule_task → enable schedule #${args.index}`;
    if (action === "disable") return `schedule_task → disable schedule #${args.index}`;
    return `schedule_task → ${action}`;
  },

  async execute(args, context) {
    const { parentEngine } = context;
    const scheduler = parentEngine?.scheduler;

    if (!scheduler) {
      return "Error: Scheduler is not available. The scheduler must be started before scheduling tasks.";
    }

    const action = (args.action || "").toLowerCase();

    if (action === "list") {
      const schedules = scheduler.list();
      if (schedules.length === 0) return "No scheduled jobs.";

      const lines = ["Scheduled jobs:\n"];
      for (let i = 0; i < schedules.length; i++) {
        const s = schedules[i];
        const status = s.enabled ? "✓ enabled" : "✗ disabled";
        const lastInfo = s.lastRun
          ? `last run: ${new Date(s.lastRun).toLocaleString()} (${s.lastResult || "unknown"})`
          : "never run";
        const shotInfo = s.oneShot ? " [one-shot]" : "";
        lines.push(`${i + 1}. [${status}] ${s.agentName}: "${s.task}"`);
        lines.push(`   Cron: ${s.cron}${shotInfo} | Runs: ${s.runCount || 0} | ${lastInfo}`);
      }
      return lines.join("\n");
    }

    if (action === "add") {
      const result = scheduler.add({
        agentId: args.agent,
        task: args.task,
        cron: args.cron,
        oneShot: args.one_shot || false,
      });

      if (result.error) return `Error: ${result.error}`;

      return `Scheduled job created:\n- Agent: ${result.agentName}\n- Task: "${result.task}"\n- Cron: ${result.cron}${result.oneShot ? " (one-shot)" : ""}\n- ID: ${result.id}\n\nThe scheduler will run this automatically. Use schedule_task with action "list" to see all jobs.`;
    }

    if (action === "remove") {
      const removed = scheduler.remove(args.index);
      if (!removed) return `Error: No schedule at index ${args.index}.`;
      return `Removed schedule: ${removed.agentName} — "${removed.task}" [${removed.cron}]`;
    }

    if (action === "enable") {
      const toggled = scheduler.toggle(args.index, true);
      if (!toggled) return `Error: No schedule at index ${args.index}.`;
      return `Enabled schedule: ${toggled.agentName} — "${toggled.task}"`;
    }

    if (action === "disable") {
      const toggled = scheduler.toggle(args.index, false);
      if (!toggled) return `Error: No schedule at index ${args.index}.`;
      return `Disabled schedule: ${toggled.agentName} — "${toggled.task}"`;
    }

    return `Unknown action: "${action}". Use: add, list, remove, enable, disable.`;
  },
};
