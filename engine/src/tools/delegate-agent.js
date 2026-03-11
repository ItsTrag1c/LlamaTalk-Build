/**
 * delegate_to_agent — Delegate a task to a named sub-agent.
 *
 * The main (manager) agent uses this tool to dispatch work to specialized
 * sub-agents. Each sub-agent is a separate AgentEngine instance with its
 * own tool set, system prompt, and optionally a different model.
 *
 * The sub-agent runs to completion and its final response is returned as
 * the tool result. Confirmations bubble up through the parent engine.
 *
 * Delegated tasks are automatically tracked in the task system so the user
 * can see what each agent is working on.
 */

import { TaskManager } from "../memory/tasks.js";

let _taskManager = null;
function getTaskManager() {
  if (!_taskManager) {
    try { _taskManager = new TaskManager(); } catch { /* no memory dir */ }
  }
  return _taskManager;
}

export const delegateAgentTool = {
  definition: {
    name: "delegate_to_agent",
    description: "Delegate a task to a specialized sub-agent. The sub-agent will work on the task and return its findings/results.",
    parameters: {
      type: "object",
      properties: {
        agent: {
          type: "string",
          description: "Name or ID of the sub-agent to delegate to",
        },
        task: {
          type: "string",
          description: "The task description to give the sub-agent",
        },
      },
      required: ["agent", "task"],
    },
  },

  safetyLevel: "medium",

  validate(args) {
    if (!args?.agent) return { ok: false, error: "Missing agent name" };
    if (!args?.task) return { ok: false, error: "Missing task description" };
    return { ok: true };
  },

  formatConfirmation(args) {
    return `delegate_to_agent → ${args.agent}: "${args.task.slice(0, 80)}${args.task.length > 80 ? "..." : ""}"`;
  },

  async execute(args, context) {
    const { config, projectRoot, signal, sessionChanges, parentEngine, onDelegation } = context;

    if (!parentEngine) {
      return "Error: delegate_to_agent can only be used by the manager agent.";
    }

    // Find the sub-agent config
    const agents = config.subAgents || [];
    const def = agents.find(
      (a) => a.name.toLowerCase() === args.agent.toLowerCase() || a.id === args.agent.toLowerCase()
    );

    if (!def) {
      const available = agents.filter((a) => a.enabled !== false).map((a) => a.name).join(", ");
      return `Error: No sub-agent named "${args.agent}". Available: ${available || "none"}`;
    }

    if (def.enabled === false) {
      return `Error: Sub-agent "${def.name}" is currently disabled. Enable it with /agent enable ${def.name}`;
    }

    // Dynamically import AgentEngine to avoid circular deps
    const { AgentEngine } = await import("../agent.js");

    // Build sub-agent config — inherit main config, override model if specified
    const subConfig = { ...config };
    if (def.model) {
      subConfig.selectedModel = def.model;
    }

    // Create sub-agent engine with filtered tools
    const subEngine = new AgentEngine(subConfig, {
      projectRoot,
      encKey: parentEngine.encKey,
      noMemory: false,
      subAgentDef: def,
    });

    // Share session changes so sub-agent writes are tracked by the parent
    subEngine.sessionChanges = sessionChanges;

    // Create a session for the sub-agent (transient — not persisted to index)
    subEngine.conversationId = `sub-${def.id}-${Date.now()}`;
    subEngine.messages = [];
    subEngine.firstMessageSent = true; // skip auto-title

    // Forward confirmation events to the parent engine so the user can approve.
    // Skip this in async mode — the caller handles confirmations directly.
    if (!onDelegation) {
      subEngine.on("confirm-needed", (data) => {
        parentEngine.emit("confirm-needed", data);
      });
    }

    // Sub-agents run fully in the background — no events forwarded to chat.
    // The manager receives the final result as a tool return value.

    // Collect the final response and iteration count (tool executions)
    let finalResponse = "";
    let lastIterationCount = 0;
    subEngine.on("response-end", ({ text }) => {
      finalResponse = text || "";
    });
    subEngine.on("usage", ({ iterationCount }) => {
      lastIterationCount = iterationCount || 0;
    });

    // Handle cancellation
    if (signal) {
      signal.addEventListener("abort", () => subEngine.cancel(), { once: true });
    }

    // Track the delegation as a task
    const tm = getTaskManager();
    const taskDesc = `[${def.name}] ${args.task.length > 100 ? args.task.slice(0, 97) + "..." : args.task}`;
    try { if (tm) tm.add(taskDesc); } catch { /* non-critical */ }

    // Helper to find and complete the task by description (index-safe across concurrent ops)
    const completeTask = () => {
      try {
        if (!tm) return;
        const tasks = tm.list();
        const idx = tasks.active.findIndex((t) => t.description === taskDesc);
        if (idx >= 0) tm.complete(idx + 1); // complete() uses 1-based index
      } catch { /* non-critical */ }
    };

    // Async delegation mode — hand off to the caller (e.g. Telegram bot) and
    // return immediately so the main agent isn't blocked while the sub-agent works.
    if (onDelegation) {
      onDelegation({ subEngine, task: args.task, agentDef: def, completeTask });
      return `Delegated task to ${def.name}. They're working on it in the background — you'll receive their results when they finish. You can continue handling other requests in the meantime.`;
    }

    // Synchronous mode (CLI / Desktop) — block until the sub-agent finishes.
    // If the sub-agent responds without using any tools (iterationCount === 0),
    // it likely just acknowledged the task without acting. Re-prompt once with
    // an explicit instruction to use tools, so small models don't just say
    // "Sure, I'll do that" and stop.
    const MAX_RETRIES = 1;
    let retries = 0;

    try {
      await subEngine.sendMessage(args.task);

      while (lastIterationCount === 0 && retries < MAX_RETRIES) {
        retries++;
        finalResponse = "";
        lastIterationCount = 0;
        await subEngine.sendMessage(
          "You did not execute any tools. You MUST use your tools (read_file, write_file, edit_file, search_files, web_search, bash, etc.) to complete this task. Do not just describe what you would do — actually do it now."
        );
      }
    } catch (err) {
      completeTask();
      return `Sub-agent "${def.name}" encountered an error: ${err.message}`;
    }

    // Only mark the task complete if the agent actually did work
    if (lastIterationCount > 0) {
      completeTask();
    } else {
      // Remove the task from active (it wasn't completed, just abandoned)
      try {
        if (tm) {
          const tasks = tm.list();
          const idx = tasks.active.findIndex((t) => t.description === taskDesc);
          if (idx >= 0) tm.remove(idx + 1);
        }
      } catch { /* non-critical */ }
    }

    // Truncate very long responses to avoid bloating the parent's context
    const MAX_RESPONSE = 8000;
    if (finalResponse.length > MAX_RESPONSE) {
      finalResponse = finalResponse.slice(0, MAX_RESPONSE) + `\n\n[Response truncated — ${finalResponse.length - MAX_RESPONSE} chars omitted]`;
    }

    // Tell the manager if the sub-agent failed to act
    if (lastIterationCount === 0) {
      return `Sub-agent "${def.name}" acknowledged the task but did not use any tools to complete it. The task was NOT completed. You may need to re-delegate with more specific instructions, or handle it yourself.`;
    }

    return finalResponse || `Sub-agent "${def.name}" completed the task but produced no text response.`;
  },
};
