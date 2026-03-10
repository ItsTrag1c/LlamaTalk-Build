import { EventEmitter } from "events";
import { resolve } from "path";
import { readFileSync } from "fs";
import { getProviderForModel } from "./providers/router.js";
import { ToolRegistry } from "./tools/registry.js";
import { isReadOnlyTool } from "./tools/base.js";
import { requireConfirmation } from "./safety.js";
import { MemoryManager } from "./memory/memory.js";
import { TaskManager } from "./memory/tasks.js";
import { saveConversation, loadConversation, getMemoryDir } from "./config.js";
import { SessionManager } from "./sessions.js";
import { compactMessages as _compactMessages } from "./memory/compaction.js";
import { SessionLog } from "./session-log.js";
import { SessionTracker } from "./session-tracker.js";
import { detectProjectContext } from "./context/context.js";

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

// Pre-compiled ANSI escape sequence regex
const ANSI_RE = /\x1B(?:\[[0-9;]*[A-Za-z]|\(.|#.|].*?(?:\x07|\x1B\\))/g;

// Agent modes
const MODES = {
  build: {
    label: "Build",
    description: "Full agent — reads, writes, and executes freely",
    icon: "●",
  },
  plan: {
    label: "Plan",
    description: "Explore and plan only — no file writes or commands",
    icon: "◐",
  },
  recall: {
    label: "Recall",
    description: "Direct Q&A — no tools, just conversation",
    icon: "◉",
  },
};

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
- Memory directory: MEMORY_DIR_PLACEHOLDER
- Use write_file or edit_file with absolute paths to save/update memory files (MEMORY.md for global, topic-name.md for topics).
- Read memory files with read_file using the same absolute paths.
- Memory directory access is always allowed without extra confirmation.`;

function buildSystemPrompt(config, projectRoot, memoryBlock, projectContext, agentMode) {
  let prompt;

  if (agentMode === "recall") {
    // Recall mode: pure Q&A, no tools — lightweight system prompt
    prompt = `You are a knowledgeable assistant running inside LlamaTalk Build. You are in Recall Mode — a direct Q&A mode with no tool access. Answer the user's questions clearly and concisely. You can discuss code, explain concepts, help with debugging logic, brainstorm ideas, and have general conversations. You do NOT have access to the filesystem, shell, or any tools — but you DO have the user's saved memory and project context below. Use that context to give informed, project-aware answers when relevant.`;
  } else {
    prompt = BASE_SYSTEM_PROMPT.replace("MEMORY_DIR_PLACEHOLDER", getMemoryDir().replace(/\\/g, "/"));

    if (agentMode === "plan") {
      prompt += `\n\n## Mode: Plan
You are in Plan Mode. You can ONLY use read-only tools (read_file, list_directory, search_files, glob_files, web_fetch, web_search, and read-only git subcommands like status/diff/log). All write operations are blocked, EXCEPT memory — you may read and write to the memory directory at any time.

Your job is to:
1. Read and explore the relevant files to fully understand the codebase
2. Present a clear, numbered plan of ALL changes you intend to make
3. For each change, specify the file path and a brief description of what will change

Do NOT attempt to write, edit, or execute commands — those calls will be rejected. Focus entirely on analysis and planning. The user will review your plan and can approve it to switch to Build mode for execution.`;
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

function compressMessages(messages) {
  const result = _compactMessages(messages);
  return result.messages;
}

/**
 * AgentEngine — headless agent that emits events instead of printing to stdout.
 *
 * Events:
 *   thinking-start         {}
 *   thinking-stop          {}
 *   response-start         {}
 *   token                  { content }
 *   tool-start             { id, name, arguments }
 *   tool-result            { id, name, success, summary, fullResult? }
 *   confirm-needed         { actions, resolve(boolean|"always") }
 *   error                  { message, recoverable }
 *   usage                  { promptTokens, outputTokens, iterationCount, contextPercent, durationMs }
 *   context-compacting     {}
 *   file-changed           { path, toolName, args, newContent, oldContent }
 *   turn-complete          { changes }
 *   plan-complete          { resolve(action) }
 *   session-locked         { resolve(pin) }
 *   mode-change            { from, to }
 *   response-end           { text }
 *   cancelled              {}
 */
export class AgentEngine extends EventEmitter {
  constructor(config, options = {}) {
    super();
    this.config = config;
    this.encKey = options.encKey || null;
    this.projectRoot = options.projectRoot || process.cwd();
    this.noMemory = options.noMemory || false;
    this.showThinking = options.showThinking !== false && config.showThinking;

    this.toolRegistry = createToolRegistry();
    this.memory = new MemoryManager(config, this.encKey);
    this.taskManager = new TaskManager();
    this.sessionMgr = new SessionManager();
    this.sessionLog = new SessionLog(this.projectRoot);
    this.sessionTracker = new SessionTracker(this.projectRoot);

    this.messages = [];
    this.sessionChanges = [];
    this.currentSession = null;
    this.conversationId = null;
    this.firstMessageSent = false;
    this.agentMode = "build";
    this.lastActivityTime = Date.now();
    this.controller = null;
    this.projectContext = "";
    this._lastToolCalls = [];

    // Detect project context
    try {
      this.projectContext = detectProjectContext(this.projectRoot);
    } catch { /* non-fatal */ }
  }

  // --- Session management ---

  createSession(projectRoot) {
    if (projectRoot) this.projectRoot = projectRoot;
    this.currentSession = this.sessionMgr.create(this.projectRoot);
    this.conversationId = this.currentSession.id;
    this.messages = [];
    this.firstMessageSent = false;
    this.sessionChanges = [];
    this.sessionLog = new SessionLog(this.projectRoot);
    this.sessionTracker = new SessionTracker(this.projectRoot);
    return this.currentSession;
  }

  loadSession(sessionId) {
    if (sessionId) {
      this.currentSession = this.sessionMgr.get(sessionId);
    } else {
      this.currentSession = this.sessionMgr.getLatest();
    }
    if (!this.currentSession) return null;
    this.conversationId = this.currentSession.id;
    this.messages = loadConversation(this.currentSession.id, this.encKey);
    this.firstMessageSent = this.messages.length > 0;
    return this.currentSession;
  }

  listSessions() {
    return this.sessionMgr.list();
  }

  deleteSession(id) {
    return this.sessionMgr.delete(id);
  }

  switchSession(session, loadedMessages) {
    this.currentSession = session;
    this.conversationId = session.id;
    this.messages = loadedMessages || [];
    this.firstMessageSent = this.messages.length > 0;
  }

  // --- Mode management ---

  getMode() { return this.agentMode; }

  setMode(mode) {
    if (mode in MODES && mode !== this.agentMode) {
      const from = this.agentMode;
      this.agentMode = mode;
      this.emit("mode-change", { from, to: mode });
    }
  }

  // --- Model management ---

  getModel() { return this.config.selectedModel; }

  setModel(name) {
    this.config.selectedModel = name;
  }

  // --- Cancellation ---

  cancel() {
    if (this.controller) {
      this.controller.abort();
    }
  }

  // --- Accessors ---

  getMessages() { return this.messages; }
  getSessionChanges() { return this.sessionChanges; }
  getLastToolCalls() { return this._lastToolCalls; }
  getConfig() { return this.config; }
  getToolDefinitions() { return this.toolRegistry.getDefinitions(); }
  getToolRegistry() { return this.toolRegistry; }
  getMemoryStatus() { return this.memory.buildMemoryBlock("", this.projectRoot); }
  getTaskManager() { return this.taskManager; }
  getSessionTracker() { return this.sessionTracker; }
  getSessionLog() { return this.sessionLog; }

  clearMessages() {
    this.messages.length = 0;
    this.firstMessageSent = false;
  }

  // --- Core: send a message and run the agent loop ---

  async sendMessage(text) {
    this.lastActivityTime = Date.now();

    // Check inactivity lock
    const locked = await this._checkInactivityLock();
    if (locked === false) return; // session ended

    // Add user message
    this.messages.push({ role: "user", content: text });

    // Auto-title session from first message
    if (!this.firstMessageSent) {
      this.sessionMgr.autoTitle(this.conversationId, text);
      this.firstMessageSent = true;
    }

    // Build memory block — always load, but only inject into prompt if enabled
    let memoryBlock = "";
    this.emit("memory-loading", { status: "start" });
    memoryBlock = this.memory.buildMemoryBlock(text, this.projectRoot);
    // Append task block
    const taskBlock = this.taskManager.buildTaskBlock();
    if (taskBlock) {
      memoryBlock = memoryBlock ? `${memoryBlock}\n\n${taskBlock}` : taskBlock;
    }
    // Brief pause so the UI can render the brain icon before we clear it
    await new Promise((r) => setTimeout(r, 150));
    this.emit("memory-loading", { status: "done" });
    // If memory is disabled, don't inject into system prompt (but we still loaded it for tasks/sessions)
    if (!this.config.memoryEnabled || this.noMemory) {
      memoryBlock = "";
    }

    // Get provider
    const { provider, providerName, formatAssistantToolUse, formatToolResult } = getProviderForModel(this.config);

    // Agent loop
    let iterationCount = 0;
    let lastUsage = null;
    let contextPercent = null;
    const contextLimit = provider.contextWindow();
    const CONTEXT_THRESHOLD = this.config.contextThreshold || 80;
    const toolDefs = this.agentMode === "recall" ? null : this.toolRegistry.getDefinitions();
    const turnStartTime = Date.now();
    const maxIter = this.agentMode === "recall" ? 1 : (this.config.maxIterations || 50);

    while (iterationCount < maxIter) {
      const systemPrompt = buildSystemPrompt(this.config, this.projectRoot, memoryBlock, this.projectContext, this.agentMode);

      // Context compression check
      if (lastUsage && lastUsage.promptTokens > 0) {
        contextPercent = Math.round((lastUsage.promptTokens / contextLimit) * 100);
        if (contextPercent >= CONTEXT_THRESHOLD) {
          this.emit("context-compacting", {});
          const compressed = compressMessages(this.messages);
          this.messages.length = 0;
          this.messages.push(...compressed);
          lastUsage = null;
          contextPercent = null;
        }
      }

      this.controller = new AbortController();

      if (this.showThinking) {
        this.emit("thinking-start", {});
      }

      const responseChunks = [];
      const toolCalls = [];
      let cancelled = false;
      const streamStartTime = Date.now();
      let firstTokenTime = null;

      try {
        const stream = provider.stream(this.messages, systemPrompt, toolDefs, this.controller.signal);

        let firstToken = true;
        for await (const event of stream) {
          if (event.type === "text") {
            if (firstToken) {
              this.emit("thinking-stop", {});
              firstTokenTime = Date.now();
              this.emit("response-start", {});
              firstToken = false;
            }
            responseChunks.push(event.content);
            this.emit("token", { content: event.content });
          } else if (event.type === "tool_call") {
            if (firstToken) {
              this.emit("thinking-stop", {});
              if (!firstTokenTime) firstTokenTime = Date.now();
              firstToken = false;
            }
            toolCalls.push(event);
          } else if (event.type === "clean_text") {
            responseChunks.length = 0;
            responseChunks.push(event.content);
          } else if (event.type === "usage") {
            lastUsage = event;
          }
        }

        // Estimate usage if provider didn't report
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
        this.emit("thinking-stop", {});
        if (this.controller.signal.aborted) {
          this.emit("cancelled", {});
          cancelled = true;
          break;
        }
        // Context length error — compress and retry
        const msg = (err.message || "").toLowerCase();
        const isContextError =
          ((msg.includes("context") || msg.includes("token") || msg.includes("length") || msg.includes("content")) &&
           (msg.includes("exceed") || msg.includes("limit") || msg.includes("too long") || msg.includes("maximum") || msg.includes("overflow"))) ||
          (contextPercent != null && contextPercent >= CONTEXT_THRESHOLD);
        if (isContextError) {
          const prevLen = this.messages.length;
          this.emit("context-compacting", {});
          const compressed = compressMessages(this.messages);
          this.messages.length = 0;
          this.messages.push(...compressed);
          lastUsage = null;
          contextPercent = null;
          if (compressed.length < prevLen) continue;
          this.emit("error", { message: "Unable to reduce context further. Try clearing and starting fresh.", recoverable: false });
          break;
        }
        this.emit("error", { message: err.message, recoverable: false });
        break;
      }

      if (cancelled) break;

      const responseText = responseChunks.join("");

      // Handle tool calls
      if (toolCalls.length > 0) {
        this.messages.push(formatAssistantToolUse(responseText, toolCalls));
        this._lastToolCalls = toolCalls.slice();

        // Pre-validate and collect confirmations
        const validated = [];
        const needsConfirm = [];
        for (const tc of toolCalls) {
          // Plan mode: block write tools
          if (this.agentMode === "plan" && !isReadOnlyTool(tc.name, tc.arguments)) {
            const msg = `Blocked: ${tc.name} is not allowed in Plan mode. Only read-only tools are available.`;
            this.emit("tool-start", { id: tc.id, name: tc.name, arguments: tc.arguments });
            this.emit("tool-result", { id: tc.id, name: tc.name, success: false, summary: msg });
            this.messages.push(formatToolResult(tc.id, msg, tc.name));
            continue;
          }
          const tool = this.toolRegistry.get(tc.name);
          if (!tool) {
            this.emit("tool-result", { id: tc.id, name: tc.name, success: false, summary: `Unknown tool: ${tc.name}` });
            this.messages.push(formatToolResult(tc.id, `Unknown tool: ${tc.name}`, tc.name));
            continue;
          }
          const validation = tool.validate(tc.arguments, { projectRoot: this.projectRoot, config: this.config });
          if (!validation.ok) {
            this.emit("tool-start", { id: tc.id, name: tc.name, arguments: tc.arguments });
            this.emit("tool-result", { id: tc.id, name: tc.name, success: false, summary: validation.error });
            this.messages.push(formatToolResult(tc.id, `Error: ${validation.error}`, tc.name));
            continue;
          }
          validated.push({ tc, tool });
          if (requireConfirmation(tool, tc.arguments, this.config, this.agentMode)) {
            const desc = tool.formatConfirmation ? tool.formatConfirmation(tc.arguments) : `${tc.name}`;
            needsConfirm.push({ tc, tool, desc });
          }
        }

        // Batch confirmation — pause and wait for consumer to resolve
        let batchApproved = true;
        if (needsConfirm.length > 0) {
          const result = await new Promise((res) => {
            this.emit("confirm-needed", {
              actions: needsConfirm.map((c) => c.desc),
              resolve: res,
            });
          });
          this.lastActivityTime = Date.now();
          if (result === "always") {
            if (!this.config.autoApprove) this.config.autoApprove = {};
            for (const c of needsConfirm) {
              const level = typeof c.tool.safetyLevel === "function" ? c.tool.safetyLevel(c.tc.arguments) : c.tool.safetyLevel;
              if (level === "medium") this.config.autoApprove.medium = true;
              if (level === "high") this.config.autoApprove.high = true;
            }
          } else if (!result) {
            batchApproved = false;
          }
        }

        // Execute validated tool calls
        let sessionLocked = false;
        for (const { tc, tool } of validated) {
          // Check cancellation before each tool — without this, cancel() only
          // stops the HTTP stream but the loop keeps executing queued tools
          if (this.controller.signal.aborted) {
            cancelled = true;
            for (const { tc: rtc } of validated) {
              if (!this.messages.some((m) => m.tool_use_id === rtc.id)) {
                this.messages.push(formatToolResult(rtc.id, "Cancelled.", rtc.name));
              }
            }
            break;
          }

          // Check inactivity lock before each tool
          const lockResult = await this._checkInactivityLock();
          if (lockResult === false) {
            for (const { tc: rtc } of validated) {
              if (!this.messages.some((m) => m.tool_use_id === rtc.id)) {
                this.messages.push(formatToolResult(rtc.id, "Session locked — tool execution aborted.", rtc.name));
              }
            }
            sessionLocked = true;
            break;
          }

          this.emit("tool-start", { id: tc.id, name: tc.name, arguments: tc.arguments });

          // Check if denied
          if (!batchApproved && needsConfirm.some((c) => c.tc.id === tc.id)) {
            const msg = "User denied this action.";
            this.emit("tool-result", { id: tc.id, name: tc.name, success: false, summary: msg });
            this.messages.push(formatToolResult(tc.id, msg, tc.name));
            continue;
          }

          // Execute
          try {
            const result = await tool.execute(tc.arguments, {
              projectRoot: this.projectRoot,
              config: this.config,
              signal: this.controller.signal,
              sessionChanges: this.sessionChanges,
            });

            // Check cancellation after tool finishes — the tool may have
            // completed but cancel was called while it was running
            if (this.controller.signal.aborted) {
              this.messages.push(formatToolResult(tc.id, "Cancelled.", tc.name));
              cancelled = true;
              break;
            }

            const clean = result.replace(ANSI_RE, "");
            const truncated = clean.length > 30000
              ? clean.slice(0, 30000) + `\n... [truncated, ${clean.length - 30000} more chars]`
              : clean;

            const summary = result.split("\n")[0].slice(0, 100);
            this.emit("tool-result", { id: tc.id, name: tc.name, success: true, summary, fullResult: truncated });
            this.messages.push(formatToolResult(tc.id, truncated, tc.name));

            this.sessionLog.addStep(`${tc.name}: ${summary}`);

            if (tc.arguments?.path) {
              try {
                const absPath = resolve(this.projectRoot, tc.arguments.path);
                this.sessionTracker.addChange(tc.name, absPath, summary);
              } catch { /* non-fatal */ }
            }

            // Emit file-changed for write/edit tools
            if (tc.name === "write_file" || tc.name === "edit_file") {
              try {
                const filePath = resolve(this.projectRoot, tc.arguments.path);
                const newContent = readFileSync(filePath, "utf8");
                const lastChange = this.sessionChanges[this.sessionChanges.length - 1];
                const oldContent = lastChange?.oldContent || null;
                this.emit("file-changed", { path: tc.arguments.path, toolName: tc.name, args: tc.arguments, newContent, oldContent });
              } catch { /* non-fatal */ }
            }
          } catch (err) {
            // Abort errors from cancelled tools are not real errors
            if (this.controller.signal.aborted) {
              this.messages.push(formatToolResult(tc.id, "Cancelled.", tc.name));
              cancelled = true;
              break;
            }
            this.emit("tool-result", { id: tc.id, name: tc.name, success: false, summary: err.message });
            this.messages.push(formatToolResult(tc.id, `Error: ${err.message}`, tc.name));
            this.sessionLog.addStep(`${tc.name}: ERROR — ${err.message}`);
          }

          iterationCount++;
        }

        if (cancelled) {
          this.emit("cancelled", {});
          break;
        }
        if (sessionLocked) break;
        continue; // LLM will see tool results
      }

      // No tool calls — agent turn complete
      if (responseText) {
        this.messages.push({ role: "assistant", content: responseText });
      }

      this.emit("response-end", { text: responseText });

      // Activity feed
      const recentChanges = this.sessionTracker.getRecentChanges();
      if (recentChanges.length > 0 && iterationCount > 0) {
        this.emit("turn-complete", { changes: recentChanges });
      }

      // Context %
      if (lastUsage && lastUsage.promptTokens > 0) {
        contextPercent = Math.round((lastUsage.promptTokens / contextLimit) * 100);
      }

      // Usage
      const turnDuration = Date.now() - turnStartTime;
      this.emit("usage", {
        promptTokens: lastUsage?.promptTokens || 0,
        outputTokens: lastUsage?.outputTokens || 0,
        evalDurationNs: lastUsage?.evalDurationNs,
        wallTimeMs: lastUsage?.wallTimeMs,
        iterationCount,
        contextPercent,
        durationMs: turnDuration,
      });

      // Plan mode: offer to proceed
      if (this.agentMode === "plan") {
        // If cancelled while awaiting plan action, exit cleanly
        if (this.controller.signal.aborted) break;
        console.log("   [Engine] Plan complete — awaiting user action...");
        const action = await new Promise((res) => {
          this.emit("plan-complete", { resolve: res });
        });
        console.log(`   [Engine] Plan action received: ${JSON.stringify(action)}`);
        // Cancel may have resolved the promise with false — exit cleanly
        if (action === false || this.controller.signal.aborted) {
          console.log("   [Engine] Plan cancelled — breaking loop");
          break;
        }
        if (action === "y" || action === "yes") {
          this.agentMode = "build";
          this.messages.push({ role: "user", content: "Proceed with the plan. Execute each step." });
          this.emit("mode-change", { from: "plan", to: "build" });
          this.sessionLog.addStep("Plan approved — switched to Build mode");
          continue;
        } else if (action === "e" || action === "edit" || (typeof action === "string" && action.startsWith("edit:"))) {
          const editText = (typeof action === "string" && action.startsWith("edit:")) ? action.slice(5) : "";
          if (editText) {
            this.agentMode = "build";
            this.messages.push({ role: "user", content: `Proceed with the plan with these adjustments: ${editText}` });
            this.emit("mode-change", { from: "plan", to: "build" });
            this.sessionLog.addStep("Plan approved with edits — switched to Build mode");
            continue;
          }
          // "edit" or "e" without text — stay in plan mode, consumer should re-prompt for edit text
        } else if (action === "keep_planning" || action === "n") {
          // Stay in plan mode and continue the loop for another iteration
          console.log("   [Engine] Keep planning — continuing loop");
          this.messages.push({ role: "user", content: "Continue refining the plan. Add more detail or consider edge cases." });
          this.sessionLog.addStep("User requested further planning");
          continue;
        }
        // empty or unrecognized — stay in plan mode, return to caller
        console.log(`   [Engine] Unhandled plan action: ${JSON.stringify(action)} — falling through to break`);
      }

      console.log("   [Engine] Agent loop exiting (break)");
      break;
    }

    if (iterationCount >= maxIter && this.agentMode !== "recall") {
      this.emit("error", { message: `Reached maximum iterations (${this.config.maxIterations || 50}). Stopping.`, recoverable: true });
    }

    // Persist
    try {
      saveConversation(this.conversationId, this.messages, this.encKey);
      this.sessionMgr.touch(this.conversationId);
    } catch { /* non-fatal */ }

    try { this.sessionLog.save(); } catch { /* non-fatal */ }
    try { this.sessionTracker.save(); } catch { /* non-fatal */ }

    // Build and save a one-line session summary for recursive memory
    try {
      const changes = this.sessionTracker.getRecentChanges();
      const toolNames = this._lastToolCalls.map((tc) => tc.name);
      const filesTouched = changes.map((c) => c.path?.split(/[/\\]/).pop()).filter(Boolean);
      const parts = [];
      if (toolNames.length > 0) {
        const counts = {};
        for (const n of toolNames) counts[n] = (counts[n] || 0) + 1;
        const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3);
        parts.push(top.map(([n, c]) => `${n}×${c}`).join(", "));
      }
      if (filesTouched.length > 0) {
        const unique = [...new Set(filesTouched)].slice(0, 5);
        parts.push(`files: ${unique.join(", ")}`);
      }
      if (parts.length > 0) {
        this.memory.appendSessionSummary(this.conversationId, parts.join(" | "));
      }
    } catch { /* non-fatal */ }
  }

  // --- Internal helpers ---

  async _checkInactivityLock() {
    const INACTIVITY_TIMEOUT_MS = (this.config.inactivityTimeoutMin || 30) * 60 * 1000;
    if (!this.encKey || (Date.now() - this.lastActivityTime) <= INACTIVITY_TIMEOUT_MS) {
      return true; // not locked
    }

    const pin = await new Promise((res) => {
      this.emit("session-locked", { resolve: res });
    });

    const { verifyPin } = await import("./config.js");
    if (!verifyPin(pin, this.config.pinHash)) {
      this.emit("error", { message: "Incorrect PIN. Session ended.", recoverable: false });
      return false; // session ended
    }

    this.lastActivityTime = Date.now();
    return true; // unlocked
  }
}

