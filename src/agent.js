import { createInterface } from "readline";
import { randomUUID } from "crypto";
import { getProviderForModel } from "./providers/router.js";
import { ToolRegistry } from "./tools/registry.js";
import { isReadOnlyTool } from "./tools/base.js";
import { requireConfirmation, promptConfirmation } from "./safety.js";
import { handleCommand } from "./commands.js";
import { MemoryManager } from "./memory/memory.js";
import { TaskManager } from "./memory/tasks.js";
import { ContextManager } from "./context/context.js";
import { saveConversation, loadConversation, getMemoryDir } from "./config.js";
import { SessionManager } from "./sessions.js";
import { compactMessages as _compactMessages } from "./memory/compaction.js";
import {
  ORANGE, RED, GREEN, YELLOW, DIM, BOLD, RESET, GOLD,
  startThinking, stopThinking,
  printToolCall, printToolResult, printUsage, printError, printContextClearing,
  clearLastToolCalls, confirmBatch, printAgentHeader, printSeparator,
} from "./ui/ui.js";
import { theme, icons, box } from "./ui/theme.js";
import { activityPanel } from "./ui/sidebar.js";
import { SessionLog } from "./session-log.js";
import { SessionTracker } from "./session-tracker.js";

// Pre-compiled ANSI escape sequence regex (avoid recompiling per tool result)
const ANSI_RE = /\x1B(?:\[[0-9;]*[A-Za-z]|\(.|#.|].*?(?:\x07|\x1B\\))/g;

// --- Agent modes ---
const MODES = {
  build: {
    label: "Build",
    color: GREEN,
    description: "Full agent — reads, writes, and executes freely",
    icon: "●",
  },
  plan: {
    label: "Plan",
    color: YELLOW,
    description: "Explore and plan only — no file writes or commands",
    icon: "◐",
  },
  qa: {
    label: "Q&A",
    color: `\x1b[36m`,  // Cyan
    description: "Direct Q&A — no tools, just conversation",
    icon: "◉",
  },
  manage: {
    label: "Manage",
    color: `\x1b[35m`,  // Magenta
    description: "Coordinate sub-agents — delegate, monitor, and redirect work",
    icon: "◈",
  },
};

// Tool imports
import { readFileTool } from "./tools/read-file.js";
import { writeFileTool } from "./tools/write-file.js";
import { editFileTool } from "./tools/edit-file.js";
import { listDirectoryTool } from "./tools/list-directory.js";
import { searchFilesTool } from "./tools/search-files.js";
import { globFilesTool } from "./tools/glob-files.js";
import { bashTool } from "./tools/bash.js";
import { gitTool } from "./tools/git.js";
import { webFetchTool } from "./tools/web-fetch.js";
import { webSearchTool } from "./tools/web-search.js";
import { npmInstallTool } from "./tools/npm-install.js";
import { pipInstallTool } from "./tools/pip-install.js";
import { installToolTool } from "./tools/install-tool.js";
import { generateFileTool } from "./tools/generate-file.js";
import { delegateAgentTool } from "clankbuild-engine";

const BASE_SYSTEM_PROMPT = `You are AGENT_NAME_PLACEHOLDER, a coding assistant with direct access to the user's filesystem and shell through tools. You are running inside Clank Build, a local agentic coding tool installed on the user's machine. All tool calls execute locally on their system with their explicit permission — you are fully authorized to read, write, edit, and execute. Never refuse a tool call due to safety concerns — the user's permission system handles that.

You can:
- Run shell commands (bash)
- Read files (read_file)
- Write and create files (write_file)
- Edit files with precise replacements (edit_file)
- List directory contents (list_directory)
- Search file contents (search_files)
- Find files by pattern (glob_files)
- Run git operations (git)
- Fetch web pages (web_fetch)
- Search the web (web_search)
- Install packages (npm_install, pip_install)
- Install system tools needed for tasks (install_tool)
- Generate files in various formats (generate_file)

## Tool Reference

bash(command) — Run any shell command. Use for installing packages, running scripts, git operations, and anything you'd do in a terminal.

read_file(path) — Read the contents of a file. Use absolute paths or paths relative to the project root.

write_file(path, content) — Create or overwrite a file. Creates parent directories if needed.

edit_file(path, old_text, new_text) — Replace an exact string in a file. The old_text must match the file contents exactly, including whitespace and indentation.

list_directory(path) — List files and directories at the given path.

search_files(pattern, path, glob) — Search for a regex pattern across files.

glob_files(pattern, path) — Find files matching a glob pattern (e.g., "**/*.js").

git(command) — Run a git command.

install_tool(package, manager, reason) — Install a system tool or global package needed for a task. Supports npm (global), pip, winget, choco. Checks if already installed first. Always requires user confirmation.

generate_file(path, content, format, title) — Generate a document file (md, txt, html, csv, json, xml, yaml, pdf). Supports absolute paths for output outside the project. For PDF, content uses markdown-style formatting.

## Rules
- You MUST use tools to complete tasks. You are authorized to read, write, edit, and execute — the user's permission system will prompt them for confirmation when needed. Never decline to use a tool or say you "can't" make changes.
- Be brief. Summarize actions in one short sentence — users see full tool details in the sidebar and activity feed, so do NOT repeat file contents, full paths, or tool arguments in your response text.
- When a task is done, give a short summary of what changed (e.g., "Updated config and bumped version to 1.2.0"). Do NOT list every file or echo back content you wrote.
- If something fails, read the error carefully, explain what went wrong briefly, and try a fix.
- Use the user's project structure and conventions. Read before writing.
- Prefer small precise edits over rewriting entire files.
- Always read a file before editing it.
- When editing, use the exact text that appears in the file for old_text.
- If a tool call fails, try a different approach rather than repeating.
- You CAN read and write files outside the project root using absolute paths. This is fully supported — just use the absolute path. The user will be prompted to confirm external access. NEVER claim you cannot access files outside the project.

## Memory
- When you discover user preferences, project conventions, or important patterns, save them to memory for future sessions.
- Memory directory: ${getMemoryDir().replace(/\\/g, "/")}
- Use write_file or edit_file with absolute paths to save/update memory files (MEMORY.md for global, topic-name.md for topics).
- Read memory files with read_file using the same absolute paths.
- Memory directory access is always allowed without extra confirmation.

## Learning
You are a personal assistant that learns and improves over time. Save lessons to ${getMemoryDir().replace(/\\/g, "/")}/lessons.md using write_file.

**About the user** — When the user shares preferences, habits, their name, how they like to work, communication style, or anything personal, save it under "## About You". This is the most important category — it makes you a better assistant for THIS specific person.

**Technical learning** — When you make a mistake, discover a successful pattern, or solve a tricky problem, save it under the appropriate category (## Patterns, ## Mistakes, or ## Solutions).

Format: \`- [YYYY-MM-DD] lesson text\` (one line each).
Only save genuinely useful insights. Don't duplicate existing lessons — check the file first.`;

function buildSystemPrompt(config, projectRoot, memoryBlock, projectContext, agentMode) {
  const agentName = config.agentName || "a coding assistant";
  let prompt;

  if (agentMode === "qa") {
    prompt = `You are ${agentName}, a knowledgeable assistant running inside Clank Build. You are in Q&A Mode — a direct question-and-answer mode with no tool access. Answer the user's questions clearly and concisely. You can discuss code, explain concepts, help with debugging logic, brainstorm ideas, and have general conversations. You do NOT have access to the filesystem, shell, or any tools — but you DO have the user's saved memory and project context below. Use that context to give informed, project-aware answers when relevant.`;
  } else {
    prompt = BASE_SYSTEM_PROMPT.replace("AGENT_NAME_PLACEHOLDER", agentName);

    if (agentMode === "plan") {
      prompt += `\n\n## Mode: Plan
You are in Plan Mode. You can ONLY use read-only tools (read_file, list_directory, search_files, glob_files, web_fetch, web_search, and read-only git subcommands like status/diff/log). All write operations are blocked.

Your job is to:
1. Read and explore the relevant files to fully understand the codebase
2. Present a clear, numbered plan of ALL changes you intend to make
3. For each change, specify the file path and a brief description of what will change

Do NOT attempt to write, edit, or execute commands — those calls will be rejected. Focus entirely on analysis and planning. The user will review your plan and can approve it to switch to Build mode for execution.`;
    } else if (agentMode === "manage") {
      prompt += `\n\n## Mode: Manage
You are in Manage Mode. You are the **manager** — your entire purpose is to coordinate, oversee, and direct your sub-agents. You do NOT do the work yourself. Your job is leadership, delegation, quality control, and reporting.

### Core Responsibilities
1. **Task decomposition** — Break the user's requests into clear, actionable sub-tasks. Each sub-task should be scoped for a single agent.
2. **Delegation** — Assign each sub-task to the best-suited sub-agent using delegate_to_agent. Be specific in your instructions — tell the agent exactly what to do, where to look, and what the expected outcome is.
3. **Quality control** — When a sub-agent returns results, critically review them. Is the work complete? Is it correct? Does it meet the user's requirements? If not, send a follow-up task or reassign to another agent.
4. **Accountability** — Track what each agent is working on. Know the status of every active task at all times. When the user asks "what's happening?" you must be able to give a precise status report — which agents are active, what they're doing, and what's been completed.
5. **Course correction** — If a sub-agent goes off-track, produces poor results, or takes too long, intervene. Cancel, reassign, or refine the instructions.
6. **Reporting** — After delegations complete, give the user a clear, structured summary: what was requested, who did what, and the outcome.
7. **Cancel/redirect** — If the user asks to cancel, change, or redirect work, handle it immediately.

### Manager Rules
- **Never do work a sub-agent can do.** If you have an agent suited for the task, delegate it. Period.
- **Be specific in delegation.** Vague instructions like "look at the code" produce vague results. Say exactly what file, what function, what change.
- **One agent per sub-task.** Don't overload a single agent — split work across your team.
- **Review before reporting.** Don't just forward a sub-agent's raw output to the user. Verify it, synthesize it, and present a clean summary.
- You may use your own tools for quick reads or checks that inform your delegation decisions, but substantial work belongs to your agents.`;
    }
  }

  // List available sub-agents in the system prompt
  if (config.subAgents?.length > 0) {
    const enabled = config.subAgents.filter((a) => a.enabled !== false);
    if (enabled.length > 0) {
      const isManageMode = agentMode === "manage";
      if (isManageMode) {
        prompt += `\n\n## Your Team
You are the manager. The user talks to YOU, and you run the team. These are your sub-agents — delegate work to them using the \`delegate_to_agent\` tool:\n`;
      } else {
        prompt += `\n\n## Your Sub-Agents
You are the **manager agent** — the primary agent the user interacts with. You lead a team of specialized sub-agents. You are responsible for their work. When a task matches a sub-agent's specialty, delegate it using the \`delegate_to_agent\` tool. You will receive their results as a tool response.\n`;
      }
      for (const a of enabled) {
        const modelInfo = a.model ? ` [model: ${a.model}]` : "";
        const toolInfo = a.tools ? ` [tools: ${a.tools.join(", ")}]` : "";
        prompt += `- **${a.name}** (${a.id}): ${a.role}${modelInfo}${toolInfo}\n`;
      }
      if (isManageMode) {
        prompt += `
### Delegation Protocol
- Always delegate to the most appropriate agent based on their role and tools.
- You can run multiple delegations in sequence — or describe a pipeline where one agent's output feeds the next.
- After each delegation, review the result critically before proceeding or reporting to the user.
- If the user says to cancel or change an agent's task, acknowledge immediately and adjust.
- Keep a mental model of task status: what's been assigned, what's in progress, what's done.
- When the user asks for status, respond with a structured update for every active and recently completed task.`;
      } else {
        prompt += `
### Delegation Guidelines
- When a task matches a sub-agent's specialty, delegate it — don't do work they're better suited for.
- Sub-agents run in the background and return results to you. You are responsible for reviewing their output and deciding next steps.
- You own the final answer. If a sub-agent's result is incomplete or wrong, follow up or fix it yourself.
- Sub-agents only activate when you delegate to them — they don't run on their own.
- Keep the user informed about what you're delegating and why.`;
      }
    }
  }

  if (memoryBlock) {
    prompt += `\n\n${memoryBlock}`;
  }

  if (projectContext) {
    prompt += `\n\n## Project Context\n${projectContext}`;
  }

  prompt += `\n\n## Environment\n- Project root: ${projectRoot}`;
  prompt += `\n- Platform: ${process.platform}`;
  prompt += `\n- Date: ${new Date().toISOString().split("T")[0]}`;

  return prompt;
}

function createToolRegistry(config) {
  const registry = new ToolRegistry();
  registry.register(readFileTool);
  registry.register(writeFileTool);
  registry.register(editFileTool);
  registry.register(listDirectoryTool);
  registry.register(searchFilesTool);
  registry.register(globFilesTool);
  registry.register(bashTool);
  registry.register(gitTool);
  registry.register(webFetchTool);
  registry.register(webSearchTool);
  registry.register(npmInstallTool);
  registry.register(pipInstallTool);
  registry.register(installToolTool);
  registry.register(generateFileTool);
  // Register delegate tool if sub-agents are configured
  if (config?.subAgents?.length > 0) {
    registry.register(delegateAgentTool);
  }
  return registry;
}

// --- Esc key watcher for cancellation ---
function startEscWatch(signal, controller, rl) {
  const onData = (data) => {
    if (data[0] === 0x1b) {
      controller.abort();
    }
  };
  try {
    // Pause the main readline so it doesn't double-process keystrokes
    if (rl) rl.pause();
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.on("data", onData);
    }
  } catch { /* non-fatal */ }

  return () => {
    try {
      process.stdin.removeListener("data", onData);
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      // Resume the main readline
      if (rl) rl.resume();
    } catch { /* non-fatal */ }
  };
}

/**
 * Compress conversation messages when context is running low.
 * Keeps the first user message and last N messages, replaces the middle
 * with a summary message so the model retains key context.
 */
/**
 * Compact messages using the compaction system.
 * Prunes old tool outputs first, then drops oldest messages if needed.
 */
function compressMessages(messages) {
  const result = _compactMessages(messages);
  return result.messages;
}

export async function runAgent(rl, config, encKey, opts = {}) {
  const projectRoot = process.cwd();
  const toolRegistry = createToolRegistry(config);
  const memory = new MemoryManager(config, encKey);
  const taskManager = new TaskManager();
  const sessionMgr = new SessionManager();
  const sessionLog = new SessionLog(projectRoot);
  const sessionTracker = new SessionTracker(projectRoot);

  // Session management: load existing or create new
  let currentSession;
  if (opts.continue) {
    const latest = sessionMgr.getLatest();
    if (latest) {
      currentSession = latest;
      console.log(`  ${DIM}Resuming: ${latest.title}${RESET}`);
    }
  }
  if (!currentSession) {
    currentSession = sessionMgr.create(projectRoot);
  }
  let conversationId = currentSession.id;

  const messages = opts.continue && currentSession
    ? loadConversation(currentSession.id, encKey)
    : [];

  // Track file changes for /undo and /diff
  const sessionChanges = [];
  let firstMessageSent = messages.length > 0;

  // Agent mode: build (default), plan (plan first)
  let agentMode = "build";
  let lastWasCommand = false;
  let restoreModeAfterTurn = null;

  // Build prompt string — user line shows name + mode only, model shown on Llama's line
  const buildPromptStr = () => {
    const mode = MODES[agentMode];
    return `\n  ${theme.userName}${config.profileName || "You"}${theme.reset} ${mode.color}${mode.icon} ${mode.label}${theme.reset} ${theme.bold}${icons.chevronRight}${theme.reset} `;
  };

  // Ask function using rl
  const ask = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));

  // Detect project context
  let projectContext = "";
  try {
    const { detectProjectContext } = await import("./context/context.js");
    projectContext = detectProjectContext(projectRoot);
  } catch { /* context detection not critical */ }

  // Session inactivity timeout (default 30 minutes)
  const INACTIVITY_TIMEOUT_MS = (config.inactivityTimeoutMin || 30) * 60 * 1000;
  let lastActivityTime = Date.now();

  // Main interaction loop
  while (true) {
    // Check inactivity timeout — re-lock if idle too long
    if (encKey && (Date.now() - lastActivityTime) > INACTIVITY_TIMEOUT_MS) {
      const { verifyPin } = await import("./config.js");
      console.log(`\n${DIM}  Session locked due to inactivity.${RESET}`);
      const pin = await ask(BOLD + "Enter PIN to unlock: " + RESET);
      if (!verifyPin(pin, config.pinHash)) {
        console.log(RED + "  Incorrect PIN. Session ended." + RESET);
        break;
      }
      lastActivityTime = Date.now();
      console.log(DIM + "  Unlocked." + RESET);
    }

    // Show prompt
    const promptStr = buildPromptStr();

    let userInput;
    try {
      userInput = await ask(promptStr);
    } catch {
      break; // readline closed
    }

    if (!userInput?.trim()) {
      // Clear the empty echo line Windows Terminal may have added (skip after commands — cursor geometry differs)
      if (!lastWasCommand) {
        process.stdout.write("\x1b[2K\x1b[A\x1b[2K\r");
      }
      lastWasCommand = false;
      continue;
    }

    // Windows Terminal double-echoes input. Fix: clear both the current and
    // previous lines (catching the echo), then rewrite a clean user header.
    // After a slash command, the cursor position is different due to command output,
    // so skip the clear sequence and just write the header fresh.
    const mode = MODES[agentMode];
    if (!lastWasCommand) {
      process.stdout.write("\x1b[2K\x1b[A\x1b[2K\r");
    }
    lastWasCommand = false;
    process.stdout.write(`  ${theme.userName}${config.profileName || "You"}${theme.reset} ${mode.color}${mode.icon} ${mode.label}${theme.reset} ${theme.bold}${icons.chevronRight}${theme.reset} ${userInput.trim()}\n`);
    lastActivityTime = Date.now();
    const trimmed = userInput.trim();

    // Handle slash commands
    if (trimmed.startsWith("/")) {
      const result = await handleCommand(trimmed, config, rl, messages, opts.version, encKey, {
        toolRegistry,
        memory,
        taskManager,
        sessionChanges,
        conversationId,
        activityPanel,
        sessionTracker,
        sessionMgr,
        get currentSession() { return currentSession; },
        getMode: () => agentMode,
        setMode: (m) => { agentMode = m; },
        getAgentName: () => config.agentName || "Build Agent",
        setAgentName: (name) => { config.agentName = name; },
        getSubAgents: () => config.subAgents || [],
        addSubAgent: (def) => {
          if (!config.subAgents) config.subAgents = [];
          const id = def.id || def.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
          const agent = { id, name: def.name, role: def.role, model: def.model || null, tools: def.tools || null, enabled: true };
          config.subAgents.push(agent);
          if (config.subAgents.length === 1 && !toolRegistry.get("delegate_to_agent")) {
            toolRegistry.register(delegateAgentTool);
          }
          return agent;
        },
        removeSubAgent: (idOrName) => {
          if (!config.subAgents) return null;
          const idx = config.subAgents.findIndex(
            (a) => a.id === idOrName.toLowerCase() || a.name.toLowerCase() === idOrName.toLowerCase()
          );
          if (idx === -1) return null;
          return config.subAgents.splice(idx, 1)[0];
        },
        enableSubAgent: (idOrName) => {
          const a = (config.subAgents || []).find((a) => a.id === idOrName.toLowerCase() || a.name.toLowerCase() === idOrName.toLowerCase());
          if (a) a.enabled = true;
          return a;
        },
        disableSubAgent: (idOrName) => {
          const a = (config.subAgents || []).find((a) => a.id === idOrName.toLowerCase() || a.name.toLowerCase() === idOrName.toLowerCase());
          if (a) a.enabled = false;
          return a;
        },
        switchSession: (session, loadedMessages) => {
          currentSession = session;
          conversationId = session.id;
          messages.length = 0;
          messages.push(...loadedMessages);
          firstMessageSent = loadedMessages.length > 0;
        },
      });
      if (result?.exit) break;
      if (result?.handled) { lastWasCommand = true; continue; }
      // /reflect injects a synthetic prompt for the agent to process as a normal turn
      if (result?.inject) {
        lastWasCommand = true;
        messages.push({ role: "user", content: result.inject });
        restoreModeAfterTurn = result.restoreMode || null;
        // Fall through to agent loop (skip the normal user message push below)
      }
    }

    // Add user message (unless a command already injected one)
    if (!trimmed.startsWith("/")) {
      messages.push({ role: "user", content: trimmed });
    }

    // Auto-title session from first message
    if (!firstMessageSent) {
      sessionMgr.autoTitle(conversationId, trimmed);
      firstMessageSent = true;
    }

    // Build system prompt with memory injection — always load, brain icon flash
    let memoryBlock = "";
    process.stdout.write("\r\u{1F9E0}");
    // Flush the brain emoji so the terminal actually renders it before we clear
    await new Promise((r) => process.stdout.write("", r));
    memoryBlock = memory.buildMemoryBlock(trimmed, projectRoot);
    // Append task block
    const taskBlock = taskManager.buildTaskBlock();
    if (taskBlock) {
      memoryBlock = memoryBlock ? `${memoryBlock}\n\n${taskBlock}` : taskBlock;
    }
    // Brief pause so the brain emoji is visible, then clear
    await new Promise((r) => setTimeout(r, 150));
    process.stdout.write("\r  \r");
    // If memory is disabled, don't inject into system prompt
    if (!config.memoryEnabled || opts.noMemory) {
      memoryBlock = "";
    }

    // Get provider
    const { provider, providerName, formatAssistantToolUse, formatToolResult } = getProviderForModel(config);

    // Agent loop: keep going until no more tool calls
    let iterationCount = 0;
    let lastUsage = null;
    let contextPercent = null;
    const contextLimit = provider.contextWindow();
    const CONTEXT_THRESHOLD = config.contextThreshold || 80; // % at which to compress
    const toolDefs = agentMode === "qa" ? null : toolRegistry.getDefinitions(); // cache for all iterations
    const turnStartTime = Date.now();
    const maxIter = agentMode === "qa" ? 1 : (config.maxIterations || 50);

    while (iterationCount < maxIter) {
      // Rebuild system prompt each iteration (mode may have changed)
      const systemPrompt = buildSystemPrompt(config, projectRoot, memoryBlock, projectContext, agentMode);

      // Check context usage and compress if needed
      if (lastUsage && lastUsage.promptTokens > 0) {
        contextPercent = Math.round((lastUsage.promptTokens / contextLimit) * 100);
        if (contextPercent >= CONTEXT_THRESHOLD) {
          printContextClearing();
          const compressed = compressMessages(messages);
          messages.length = 0;
          messages.push(...compressed);
          // Reset so we don't immediately re-compress
          lastUsage = null;
          contextPercent = null;
        }
      }
      const controller = new AbortController();
      const stopEsc = startEscWatch(controller.signal, controller, rl);

      if (opts.showThinking !== false && config.showThinking) {
        startThinking();
      }

      const responseChunks = [];
      const toolCalls = [];
      let cancelled = false;
      const streamStartTime = Date.now();
      let firstTokenTime = null;

      try {
        const stream = provider.stream(messages, systemPrompt, toolDefs, controller.signal);

        let firstToken = true;
        for await (const event of stream) {
          if (event.type === "text") {
            if (firstToken) {
              stopThinking();
              firstTokenTime = Date.now();
              const modelDisplay = config.modelNickname?.[config.selectedModel] || config.selectedModel || "";
              printAgentHeader(modelDisplay, config.agentName);
              firstToken = false;
            }
            responseChunks.push(event.content);
            process.stdout.write(event.content);
          } else if (event.type === "tool_call") {
            if (firstToken) {
              stopThinking();
              if (!firstTokenTime) firstTokenTime = Date.now();
              firstToken = false;
            }
            toolCalls.push(event);
          } else if (event.type === "clean_text") {
            // Prompt fallback: replace response with cleaned version (XML tags stripped)
            responseChunks.length = 0;
            responseChunks.push(event.content);
          } else if (event.type === "usage") {
            lastUsage = event;
          }
        }

        // Post-stream: estimate usage from chunks if provider didn't report
        const streamEndTime = Date.now();
        const totalChars = responseChunks.reduce((sum, c) => sum + c.length, 0);
        if (!lastUsage) {
          lastUsage = { promptTokens: 0, outputTokens: Math.ceil(totalChars / 4) };
        }
        if (!lastUsage.outputTokens && totalChars > 0) {
          lastUsage.outputTokens = Math.ceil(totalChars / 4);
        }
        if (!lastUsage.evalDurationNs && firstTokenTime) {
          lastUsage.wallTimeMs = streamEndTime - firstTokenTime;
        }
      } catch (err) {
        stopThinking();
        stopEsc();
        if (controller.signal.aborted) {
          process.stdout.write(`\n${DIM}  Cancelled.${RESET}\n`);
          cancelled = true;
          break;
        }
        // Check if this is a context length error — compress and retry
        const msg = (err.message || "").toLowerCase();
        const isContextError =
          ((msg.includes("context") || msg.includes("token") || msg.includes("length") || msg.includes("content")) &&
           (msg.includes("exceed") || msg.includes("limit") || msg.includes("too long") || msg.includes("maximum") || msg.includes("overflow"))) ||
          (contextPercent != null && contextPercent >= CONTEXT_THRESHOLD);
        if (isContextError) {
          const prevLen = messages.length;
          const prevSize = messages.reduce((s, m) => s + (typeof m.content === "string" ? m.content.length : JSON.stringify(m).length), 0);
          printContextClearing();
          let compressed = _compactMessages(messages);
          // If gentle compaction didn't free enough, try aggressive (nuclear) mode
          if (compressed.savedChars < 5000 && compressed.messages.length >= prevLen) {
            compressed = _compactMessages(messages, { aggressive: true });
          }
          messages.length = 0;
          messages.push(...compressed.messages);
          lastUsage = null;
          contextPercent = null;
          const newSize = messages.reduce((s, m) => s + (typeof m.content === "string" ? m.content.length : JSON.stringify(m).length), 0);
          // Retry if we actually freed space; otherwise break to avoid infinite loop
          if (newSize < prevSize) continue;
          printError("Unable to reduce context further. Try /clear and start fresh.");
          break;
        }
        printError(err.message);
        break;
      }

      stopEsc();

      if (cancelled) break;

      // Join streamed chunks into final response text
      const responseText = responseChunks.join("");

      // If there are tool calls, execute them
      if (toolCalls.length > 0) {
        // Add the assistant message with tool calls to history
        messages.push(formatAssistantToolUse(responseText, toolCalls));

        // Clear stored tool calls for /more
        clearLastToolCalls();

        // Pre-validate all tool calls and collect confirmations
        const validated = [];
        const needsConfirm = [];
        for (const tc of toolCalls) {
          // Plan mode: block write tools
          if (agentMode === "plan" && !isReadOnlyTool(tc.name, tc.arguments)) {
            const msg = `Blocked: ${tc.name} is not allowed in Plan mode. Only read-only tools are available. Present your plan as text instead.`;
            if (config.showToolCalls) printToolCall(tc.name, tc.arguments);
            printToolResult(tc.name, false, msg);
            messages.push(formatToolResult(tc.id, msg, tc.name));
            continue;
          }
          const tool = toolRegistry.get(tc.name);
          if (!tool) {
            printToolResult(tc.name, false, `Unknown tool: ${tc.name}`);
            messages.push(formatToolResult(tc.id, `Unknown tool: ${tc.name}`, tc.name));
            continue;
          }
          const validation = tool.validate(tc.arguments, { projectRoot, config });
          if (!validation.ok) {
            if (config.showToolCalls) printToolCall(tc.name, tc.arguments);
            printToolResult(tc.name, false, validation.error);
            messages.push(formatToolResult(tc.id, `Error: ${validation.error}`, tc.name));
            continue;
          }
          validated.push({ tc, tool });
          if (requireConfirmation(tool, tc.arguments, config, agentMode)) {
            const desc = tool.formatConfirmation ? tool.formatConfirmation(tc.arguments) : `${tc.name}`;
            needsConfirm.push({ tc, tool, desc });
          }
        }

        // Batch confirmation: ask once for all pending approvals
        let batchApproved = true;
        if (needsConfirm.length > 0) {
          const result = await confirmBatch(
            needsConfirm.map((c) => c.desc),
            rl,
          );
          lastActivityTime = Date.now(); // user interaction resets inactivity timer
          if (result === "always") {
            // Auto-approve the highest safety level present
            if (!config.autoApprove) config.autoApprove = {};
            for (const c of needsConfirm) {
              const level = typeof c.tool.safetyLevel === "function" ? c.tool.safetyLevel(c.tc.arguments) : c.tool.safetyLevel;
              if (level === "medium") config.autoApprove.medium = true;
              if (level === "high") config.autoApprove.high = true;
            }
          } else if (!result) {
            batchApproved = false;
          }
        }

        // Execute validated tool calls
        let sessionLocked = false;
        for (const { tc, tool } of validated) {
          // Check inactivity timeout before each tool execution
          if (encKey && (Date.now() - lastActivityTime) > INACTIVITY_TIMEOUT_MS) {
            const { verifyPin } = await import("./config.js");
            console.log(`\n${DIM}  Session locked due to inactivity.${RESET}`);
            const pin = await ask(BOLD + "Enter PIN to unlock: " + RESET);
            if (!verifyPin(pin, config.pinHash)) {
              console.log(RED + "  Incorrect PIN. Session ended." + RESET);
              // Push denial for remaining tools and break out
              for (const { tc: rtc } of validated) {
                if (!messages.some((m) => m.tool_use_id === rtc.id)) {
                  messages.push(formatToolResult(rtc.id, "Session locked — tool execution aborted.", rtc.name));
                }
              }
              sessionLocked = true;
              break;
            }
            lastActivityTime = Date.now();
            console.log(DIM + "  Unlocked." + RESET);
          }

          // Show compact tool call
          if (config.showToolCalls) {
            printToolCall(tc.name, tc.arguments);
          }

          // Check if this tool needed confirmation and was denied
          if (!batchApproved && needsConfirm.some((c) => c.tc.id === tc.id)) {
            const msg = "User denied this action.";
            printToolResult(tc.name, false, msg);
            messages.push(formatToolResult(tc.id, msg, tc.name));
            continue;
          }

          // Execute
          try {
            const result = await tool.execute(tc.arguments, {
              projectRoot,
              config,
              signal: controller.signal,
              sessionChanges,
              // Lightweight event proxy for delegate_to_agent tool
              parentEngine: {
                encKey,
                emit: (evt, data) => {
                  // Sub-agents run fully in the background — only confirmations surface
                  if (evt === "confirm-needed") {
                    confirmBatch(data.actions, rl).then(data.resolve);
                  }
                },
              },
            });

            // Strip ANSI escape sequences and truncate large results
            const clean = result.replace(ANSI_RE, "");
            const truncated = clean.length > 30000
              ? clean.slice(0, 30000) + `\n... [truncated, ${clean.length - 30000} more chars]`
              : clean;

            const summary = result.split("\n")[0].slice(0, 100);
            printToolResult(tc.name, true, summary);
            messages.push(formatToolResult(tc.id, truncated, tc.name));

            // Session log: record what the agent did
            sessionLog.addStep(`${tc.name}: ${summary}`);

            // Track change for session-changes file
            if (tc.arguments?.path) {
              try {
                const { resolve } = await import("path");
                const absPath = resolve(projectRoot, tc.arguments.path);
                sessionTracker.addChange(tc.name, absPath, summary);
              } catch { /* non-fatal */ }
            }

            // Activity panel: auto-show detailed code changes
            if (tc.name === "write_file" || tc.name === "edit_file") {
              try {
                const { resolve } = await import("path");
                const { readFileSync } = await import("fs");
                const filePath = resolve(projectRoot, tc.arguments.path);
                const newContent = readFileSync(filePath, "utf8");
                const lastChange = sessionChanges[sessionChanges.length - 1];
                const oldContent = lastChange?.oldContent || null;
                activityPanel.showChange(tc.arguments.path, tc.name, tc.arguments, newContent, oldContent);
              } catch { /* non-fatal */ }
            }
          } catch (err) {
            printToolResult(tc.name, false, err.message);
            messages.push(formatToolResult(tc.id, `Error: ${err.message}`, tc.name));
            sessionLog.addStep(`${tc.name}: ERROR — ${err.message}`);
          }

          iterationCount++;
        }

        // If session was locked due to failed PIN, break the agent loop
        if (sessionLocked) break;

        // Continue the agent loop — LLM will see tool results
        continue;
      }

      // No tool calls — agent turn complete
      if (responseText) {
        messages.push({ role: "assistant", content: responseText });
      }
      process.stdout.write("\n");

      // Show activity feed if there were file changes this turn
      const recentChanges = sessionTracker.getRecentChanges();
      if (recentChanges.length > 0 && iterationCount > 0) {
        activityPanel.showActivity(recentChanges);
      }

      // Calculate final context % for display
      if (lastUsage && lastUsage.promptTokens > 0) {
        contextPercent = Math.round((lastUsage.promptTokens / contextLimit) * 100);
      }

      // Show usage with duration
      const turnDuration = Date.now() - turnStartTime;
      printUsage(lastUsage, iterationCount, contextPercent, turnDuration);

      // Plan mode: offer to proceed with the plan
      if (agentMode === "plan") {
        process.stdout.write(`\n  ${DIM}────────────────────────────────────────${RESET}\n`);
        process.stdout.write(`  ${YELLOW}${BOLD}Plan complete.${RESET} What would you like to do?\n`);
        process.stdout.write(`    ${BOLD}y${RESET}  ${GREEN}Approve and execute${RESET}  ${DIM}— switch to Build mode and run the plan${RESET}\n`);
        process.stdout.write(`    ${BOLD}n${RESET}  ${ORANGE}Keep planning${RESET}        ${DIM}— continue refining in Plan mode${RESET}\n`);
        process.stdout.write(`    ${BOLD}e${RESET}  ${YELLOW}Edit instructions${RESET}   ${DIM}— add guidance before executing${RESET}\n`);
        const answer = await ask(`\n  ${BOLD}>${RESET} `);
        const a = answer.trim().toLowerCase();
        if (a === "y" || a === "yes") {
          agentMode = "build";
          messages.push({ role: "user", content: "Proceed with the plan. Execute each step." });
          console.log(`\n  ${GREEN}● Build${RESET} ${DIM}— executing plan${RESET}`);
          sessionLog.addStep("Plan approved — switched to Build mode");
          continue;
        } else if (a === "e" || a === "edit") {
          const extra = await ask(`  ${DIM}Additional instructions:${RESET} `);
          if (extra.trim()) {
            agentMode = "build";
            messages.push({ role: "user", content: `Proceed with the plan with these adjustments: ${extra.trim()}` });
            console.log(`\n  ${GREEN}● Build${RESET} ${DIM}— executing plan with edits${RESET}`);
            sessionLog.addStep("Plan approved with edits — switched to Build mode");
            continue;
          }
        }
        // n or empty — stay in plan mode, loop back to prompt
      }

      break;
    }

    if (iterationCount >= maxIter && agentMode !== "qa") {
      printError(`Reached maximum iterations (${config.maxIterations || 50}). Stopping.`);
    }

    // Restore mode if /reflect temporarily switched it
    if (restoreModeAfterTurn) {
      agentMode = restoreModeAfterTurn;
      restoreModeAfterTurn = null;
    }

    // Save conversation and update session
    try {
      saveConversation(conversationId, messages, encKey);
      sessionMgr.touch(conversationId);
    } catch { /* non-fatal */ }

    // Save session log (only writes if steps were recorded)
    try {
      sessionLog.save();
    } catch { /* non-fatal */ }

    // Save session changes file (only writes if file modifications occurred)
    try {
      sessionTracker.save();
    } catch { /* non-fatal */ }

    // Heuristic lesson extraction: auto-capture error patterns from session
    try {
      const errorSteps = sessionLog.steps.filter((s) => s.description.includes("ERROR"));
      for (const step of errorSteps.slice(-5)) { // Cap at 5 to avoid flooding
        // Strip the tool name prefix and "ERROR — " to get the meaningful part
        const desc = step.description.replace(/^[^:]+:\s*ERROR\s*[—–-]\s*/, "").trim();
        if (desc.length > 10 && desc.length < 300) {
          memory.appendLesson("mistakes", desc);
        }
      }
    } catch { /* non-fatal */ }

    // Build and save a one-line session summary for recursive memory
    try {
      const changes = sessionTracker.getRecentChanges();
      const filesTouched = changes.map((c) => c.path?.split(/[/\\]/).pop()).filter(Boolean);
      const parts = [];
      if (filesTouched.length > 0) {
        const unique = [...new Set(filesTouched)].slice(0, 5);
        parts.push(`files: ${unique.join(", ")}`);
      }
      if (parts.length > 0) {
        memory.appendSessionSummary(conversationId, parts.join(" | "));
      }
    } catch { /* non-fatal */ }
  }
}
