import { createInterface } from "readline";
import { randomUUID } from "crypto";
import { getProviderForModel } from "./providers/router.js";
import { ToolRegistry } from "./tools/registry.js";
import { requireConfirmation, promptConfirmation } from "./safety.js";
import { handleCommand } from "./commands.js";
import { MemoryManager } from "./memory/memory.js";
import { ContextManager } from "./context/context.js";
import { saveConversation } from "./config.js";
import {
  ORANGE, RED, GREEN, YELLOW, DIM, BOLD, RESET, GOLD,
  startThinking, stopThinking,
  printToolCall, printToolResult, printUsage, printError, printContextClearing,
} from "./ui/ui.js";

// --- Agent modes ---
const MODES = ["accept", "build", "plan"];
const MODE_LABELS = { accept: "Accept", build: "Build", plan: "Plan" };
const MODE_COLORS = { accept: ORANGE, build: GREEN, plan: YELLOW };

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

const BASE_SYSTEM_PROMPT = `You are LlamaTalk Build, an agentic coding assistant. You help users accomplish coding tasks by planning and executing multi-step operations using tools.

## Behavior
- Think step-by-step about the task before acting
- Use tools to explore the codebase before making changes
- Read relevant files first to understand context
- Make targeted, minimal edits rather than rewriting entire files
- After making changes, verify they work (run tests if available)
- Explain what you did and why

## Tool Usage
- Use read_file to understand code before modifying it
- Use search_files and glob_files to find relevant code
- Use edit_file for targeted changes (preferred over write_file for existing files)
- Use write_file only for new files or complete rewrites
- Use bash for running tests, builds, and other commands
- Use git for version control operations

## Memory
- When you discover user preferences, project conventions, or important patterns, consider saving them to memory for future sessions
- You can write memory files to the memory directory using write_file

## Rules
- Never modify files outside the project root unless explicitly asked
- Always read a file before editing it
- When editing, use the exact text that appears in the file for old_text
- If a tool call fails, try a different approach rather than repeating
- Keep the user informed of what you're doing and why
- Be concise — lead with actions, not explanations`;

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
  return registry;
}

// --- Esc key watcher for cancellation ---
function startEscWatch(signal, controller) {
  const onData = (data) => {
    if (data[0] === 0x1b) {
      controller.abort();
    }
  };
  try {
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
  const memory = new MemoryManager(config);
  const conversationId = randomUUID();
  const messages = []; // conversation history (internal format)

  // Track file changes for /undo and /diff
  const sessionChanges = [];

  // Agent mode: accept (default), build (auto-approve), plan (plan first)
  let agentMode = "accept";

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

  // Main interaction loop
  while (true) {
    // Show prompt
    const promptStr = buildPromptStr();

    let userInput;
    try {
      userInput = await ask(promptStr);
    } catch {
      break; // readline closed
    }

    if (!userInput?.trim()) continue;
    const trimmed = userInput.trim();

    // Handle slash commands
    if (trimmed.startsWith("/")) {
      const result = await handleCommand(trimmed, config, rl, messages, opts.version, encKey, {
        toolRegistry,
        memory,
        sessionChanges,
        conversationId,
        getMode: () => agentMode,
        setMode: (m) => { agentMode = m; },
      });
      if (result?.exit) break;
      if (result?.handled) continue;
    }

    // Add user message
    messages.push({ role: "user", content: trimmed });

    // Build system prompt with memory injection
    let memoryBlock = "";
    if (config.memoryEnabled && !opts.noMemory) {
      memoryBlock = memory.buildMemoryBlock(trimmed, projectRoot);
    }
    const systemPrompt = buildSystemPrompt(config, projectRoot, memoryBlock, projectContext, agentMode);

    // Get provider
    const { provider, providerName, formatAssistantToolUse, formatToolResult } = getProviderForModel(config);

    // Agent loop: keep going until no more tool calls
    let iterationCount = 0;
    let lastUsage = null;
    let contextPercent = null;
    const contextLimit = provider.contextWindow();
    const CONTEXT_THRESHOLD = config.contextThreshold || 80; // % at which to compress

    while (iterationCount < (config.maxIterations || 50)) {
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
      const stopEsc = startEscWatch(controller.signal, controller);

      if (opts.showThinking !== false && config.showThinking) {
        startThinking();
      }

      let responseText = "";
      const toolCalls = [];
      let cancelled = false;

      try {
        const toolDefs = toolRegistry.getDefinitions();
        const stream = provider.stream(messages, systemPrompt, toolDefs, controller.signal);

        let firstToken = true;
        for await (const event of stream) {
          if (event.type === "text") {
            if (firstToken) {
              stopThinking();
              process.stdout.write(`\n  ${ORANGE}Llama Agent${RESET} ${BOLD}>${RESET} `);
              firstToken = false;
            }
            responseText += event.content;
            process.stdout.write(event.content);
          } else if (event.type === "tool_call") {
            if (firstToken) {
              stopThinking();
              firstToken = false;
            }
            toolCalls.push(event);
          } else if (event.type === "usage") {
            lastUsage = event;
          }
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
        if ((msg.includes("context") || msg.includes("token") || msg.includes("length")) &&
            (msg.includes("exceed") || msg.includes("limit") || msg.includes("too long") || msg.includes("maximum"))) {
          printContextClearing();
          const compressed = compressMessages(messages);
          messages.length = 0;
          messages.push(...compressed);
          continue; // retry this iteration with compressed messages
        }
        printError(err.message);
        break;
      }

      stopEsc();

      if (cancelled) break;

      // If there are tool calls, execute them
      if (toolCalls.length > 0) {
        // Add the assistant message with tool calls to history
        messages.push(formatAssistantToolUse(responseText, toolCalls));

        let allToolsExecuted = true;

        for (const tc of toolCalls) {
          const tool = toolRegistry.get(tc.name);
          if (!tool) {
            const errMsg = `Unknown tool: ${tc.name}`;
            printToolResult(tc.name, false, errMsg);
            messages.push(formatToolResult(tc.id, errMsg, tc.name));
            continue;
          }

          // Show tool call
          if (config.showToolCalls) {
            printToolCall(tc.name, tc.arguments);
          }

          // Validate
          const validation = tool.validate(tc.arguments, { projectRoot, config });
          if (!validation.ok) {
            printToolResult(tc.name, false, validation.error);
            messages.push(formatToolResult(tc.id, `Error: ${validation.error}`, tc.name));
            continue;
          }

          // Check confirmation
          if (requireConfirmation(tool, tc.arguments, config, agentMode)) {
            const approved = await promptConfirmation(tool, tc.arguments, config);
            if (!approved) {
              const msg = "User denied this action.";
              printToolResult(tc.name, false, msg);
              messages.push(formatToolResult(tc.id, msg, tc.name));
              allToolsExecuted = false;
              continue;
            }
          }

          // Execute
          try {
            const result = await tool.execute(tc.arguments, {
              projectRoot,
              config,
              signal: controller.signal,
              sessionChanges,
            });

            // Truncate large results
            const truncated = result.length > 30000
              ? result.slice(0, 30000) + `\n... [truncated, ${result.length - 30000} more chars]`
              : result;

            const summary = result.split("\n")[0].slice(0, 100);
            printToolResult(tc.name, true, summary);
            messages.push(formatToolResult(tc.id, truncated, tc.name));
          } catch (err) {
            printToolResult(tc.name, false, err.message);
            messages.push(formatToolResult(tc.id, `Error: ${err.message}`, tc.name));
          }

          iterationCount++;
        }

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

      break;
    }

    if (iterationCount >= (config.maxIterations || 50)) {
      printError(`Reached maximum iterations (${config.maxIterations || 50}). Stopping.`);
    }

    // Save conversation
    try {
      saveConversation(conversationId, messages, encKey);
    } catch { /* non-fatal */ }
  }
}
