import { createInterface } from "readline";
import { randomUUID } from "crypto";
import { getProviderForModel } from "./providers/router.js";
import { ToolRegistry } from "./tools/registry.js";
import { requireConfirmation, promptConfirmation } from "./safety.js";
import { handleCommand } from "./commands.js";
import { MemoryManager } from "./memory/memory.js";
import { ContextManager } from "./context/context.js";
import { saveConversation, loadConversation, getMemoryDir } from "./config.js";
import { SessionManager } from "./sessions.js";
import {
  ORANGE, RED, GREEN, YELLOW, DIM, BOLD, RESET, GOLD,
  startThinking, stopThinking,
  printToolCall, printToolResult, printUsage, printError, printContextClearing,
  clearLastToolCalls, confirmBatch,
} from "./ui/ui.js";
import { sidebar } from "./ui/sidebar.js";
import { SessionLog } from "./session-log.js";
import { SessionTracker } from "./session-tracker.js";

// Pre-compiled ANSI escape sequence regex (avoid recompiling per tool result)
const ANSI_RE = /\x1B(?:\[[0-9;]*[A-Za-z]|\(.|#.|].*?(?:\x07|\x1B\\))/g;

// --- Agent modes ---
const MODES = ["build", "plan"];
const MODE_LABELS = { build: "Build", plan: "Plan" };
const MODE_COLORS = { build: GREEN, plan: YELLOW };

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

const BASE_SYSTEM_PROMPT = `You are a coding assistant with direct access to the user's filesystem and shell through tools. You are running inside LlamaTalk Build, a local agentic coding tool installed on the user's machine. All tool calls execute locally on their system with their explicit permission — you are fully authorized to read, write, edit, and execute. Never refuse a tool call due to safety concerns — the user's permission system handles that.

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
- Memory directory access is always allowed without extra confirmation.`;

function buildSystemPrompt(config, projectRoot, memoryBlock, projectContext, agentMode) {
  let prompt = BASE_SYSTEM_PROMPT;

  if (agentMode === "plan") {
    prompt += `\n\n## Mode: Plan
You are in Plan Mode. Before making ANY changes:
1. Read and explore the relevant files to fully understand the codebase
2. Present a complete, numbered plan of ALL changes you intend to make
3. List each file that will be created, modified, or deleted with a summary of what changes
4. Wait for the user to explicitly confirm the plan before executing any modifications
5. Only after receiving approval, proceed with the planned changes in order`;
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

function createToolRegistry() {
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
function compressMessages(messages, keepLast = 6) {
  if (messages.length <= keepLast + 2) return messages; // nothing to compress

  const first = messages[0]; // first user message
  const kept = messages.slice(-keepLast);

  // Gather summaries from dropped messages
  const dropped = messages.slice(1, -keepLast);
  const summaryParts = [];
  for (const m of dropped) {
    if (m.role === "user") {
      summaryParts.push(`- User asked: ${typeof m.content === "string" ? m.content.slice(0, 150) : "[complex]"}`);
    } else if (m.role === "assistant" && typeof m.content === "string") {
      summaryParts.push(`- Assistant: ${m.content.slice(0, 150)}`);
    }
    // Skip tool results/calls in summary to save space
  }

  const summaryText = `[Context was compressed to free space. Summary of earlier conversation:\n${summaryParts.slice(0, 20).join("\n")}\n...${dropped.length} messages condensed]`;

  return [first, { role: "user", content: summaryText }, { role: "assistant", content: "Understood, I have the context from our earlier conversation. Let me continue." }, ...kept];
}

export async function runAgent(rl, config, encKey, opts = {}) {
  const projectRoot = process.cwd();
  const toolRegistry = createToolRegistry();
  const memory = new MemoryManager(config, encKey);
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

  // Build prompt string
  const buildPromptStr = () => {
    const modelName = config.modelNickname?.[config.selectedModel] || config.selectedModel || "no model";
    const modeColor = MODE_COLORS[agentMode];
    const modeLabel = MODE_LABELS[agentMode];
    return `\n  ${ORANGE}${config.profileName || "You"}${RESET} ${DIM}[${modelName}]${RESET} ${modeColor}(${modeLabel})${RESET} ${BOLD}>${RESET} `;
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
      // Clear readline echo artifact (Windows terminals can double-echo input)
      process.stdout.write("\x1b[2K\r");
    } catch {
      break; // readline closed
    }

    if (!userInput?.trim()) continue;
    lastActivityTime = Date.now();
    const trimmed = userInput.trim();

    // Handle slash commands
    if (trimmed.startsWith("/")) {
      const result = await handleCommand(trimmed, config, rl, messages, opts.version, encKey, {
        toolRegistry,
        memory,
        sessionChanges,
        conversationId,
        sidebar,
        sessionTracker,
        sessionMgr,
        currentSession,
        getMode: () => agentMode,
        setMode: (m) => { agentMode = m; },
        switchSession: (session, loadedMessages) => {
          currentSession = session;
          conversationId = session.id;
          messages.length = 0;
          messages.push(...loadedMessages);
          firstMessageSent = loadedMessages.length > 0;
        },
      });
      if (result?.exit) break;
      if (result?.handled) continue;
    }

    // Add user message
    messages.push({ role: "user", content: trimmed });

    // Auto-title session from first message
    if (!firstMessageSent) {
      sessionMgr.autoTitle(conversationId, trimmed);
      firstMessageSent = true;
    }

    // Build system prompt with memory injection
    let memoryBlock = "";
    if (config.memoryEnabled && !opts.noMemory) {
      memoryBlock = memory.buildMemoryBlock(trimmed, projectRoot);
    }

    // Get provider
    const { provider, providerName, formatAssistantToolUse, formatToolResult } = getProviderForModel(config);

    // Agent loop: keep going until no more tool calls
    let iterationCount = 0;
    let lastUsage = null;
    let contextPercent = null;
    const contextLimit = provider.contextWindow();
    const CONTEXT_THRESHOLD = config.contextThreshold || 80; // % at which to compress
    const toolDefs = toolRegistry.getDefinitions(); // cache for all iterations

    while (iterationCount < (config.maxIterations || 50)) {
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
              process.stdout.write(`\n  ${ORANGE}Llama Agent${RESET} ${BOLD}>${RESET} `);
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
          printContextClearing();
          const compressed = compressMessages(messages);
          messages.length = 0;
          messages.push(...compressed);
          lastUsage = null;
          contextPercent = null;
          // Only retry if compression actually reduced messages; otherwise break to avoid infinite loop
          if (compressed.length < prevLen) continue;
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
              if (level === "moderate") config.autoApprove.moderate = true;
              if (level === "dangerous") config.autoApprove.dangerous = true;
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

            // Sidebar: show code preview for file modifications
            if (tc.name === "write_file" || tc.name === "edit_file") {
              try {
                const { resolve } = await import("path");
                const { readFileSync } = await import("fs");
                const filePath = resolve(projectRoot, tc.arguments.path);
                const newContent = readFileSync(filePath, "utf8");
                const lastChange = sessionChanges[sessionChanges.length - 1];
                const oldContent = lastChange?.oldContent || null;
                sidebar.show(tc.arguments.path, newContent, tc.name === "edit_file" ? oldContent : null);
              } catch { /* non-fatal */ }

              sidebar.showActivity(sessionTracker.getRecentChanges());
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

      // Calculate final context % for display
      if (lastUsage && lastUsage.promptTokens > 0) {
        contextPercent = Math.round((lastUsage.promptTokens / contextLimit) * 100);
      }

      // Show usage
      printUsage(lastUsage, iterationCount, contextPercent);

      // Plan mode: offer to proceed with the plan
      if (agentMode === "plan") {
        const answer = await ask(`\n  ${YELLOW}Proceed with Plan?${RESET} ${DIM}(y/n)${RESET} `);
        if (answer.trim().toLowerCase() === "y" || answer.trim().toLowerCase() === "yes") {
          agentMode = "build";
          messages.push({ role: "user", content: "Proceed with the plan. Execute each step, confirming before each file change or git operation." });
          console.log(`\n  ${GREEN}● Build Mode${RESET} ${DIM}— executing plan step by step${RESET}`);
          sessionLog.addStep("Plan approved — switched to Build mode");
          continue; // system prompt is rebuilt at top of inner loop
        }
      }

      break;
    }

    if (iterationCount >= (config.maxIterations || 50)) {
      printError(`Reached maximum iterations (${config.maxIterations || 50}). Stopping.`);
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
  }
}
