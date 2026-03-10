import { saveConfig, saveConfigWithKey, getMemoryDir, loadConversation } from "./config.js";
import { detectBackend, getAllLocalModels, getOllamaModels, getOpenAICompatModels, CLOUD_MODELS } from "./providers/router.js";
import { writeFileSync, readFileSync, existsSync, unlinkSync, mkdtempSync, rmSync, copyFileSync, renameSync, readdirSync } from "fs";
import { join, relative, dirname } from "path";
import { execSync } from "child_process";
import { randomBytes } from "crypto";
import { tmpdir } from "os";
import {
  ORANGE, RED, GREEN, YELLOW, DIM, BOLD, RESET,
  printError, askMasked, getLastToolCalls, printToolCallFull,
  printSeparator,
} from "./ui/ui.js";
import { theme, icons, box } from "./ui/theme.js";
import { printBanner } from "./ui/banner.js";

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

export async function handleCommand(line, config, rl, messages, version, encKey, agent) {
  const parts = line.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1);

  switch (cmd) {
    case "/help": {
      console.log(`
${BOLD}Commands${RESET}

${ORANGE}/help${RESET}                    Show this help
${ORANGE}/model [name]${RESET}            Show or switch model
${ORANGE}/models${RESET}                  List available models
${ORANGE}/settings${RESET}                Show current config
${ORANGE}/clear${RESET}                   Clear conversation history
${ORANGE}/tools${RESET}                   List available tools
${ORANGE}/context${RESET}                 Show context window usage
${ORANGE}/more${RESET}                    Show full details of last tool call(s)
${ORANGE}/memory${RESET}                  Show loaded memory files
${ORANGE}/memory list${RESET}             List all topic memories
${ORANGE}/memory save <topic>${RESET}     Save a memory topic
${ORANGE}/instructions${RESET}            Show loaded agent instructions
${ORANGE}/session${RESET}                 Show current session info
${ORANGE}/session list${RESET}            List all saved sessions
${ORANGE}/session new${RESET}             Start a new session
${ORANGE}/session load <n>${RESET}        Load session by number
${ORANGE}/session delete <n>${RESET}      Delete a session
${ORANGE}/undo${RESET}                    Undo the last file change
${ORANGE}/diff${RESET}                    Show all file changes this session
${ORANGE}/set server-url <url>${RESET}    Change server URL
${ORANGE}/set api-key <provider> <key>${RESET}  Set API key
${ORANGE}/set provider enable|disable <p>${RESET}  Toggle provider
${ORANGE}/set temp <0.0-1.0>${RESET}      Set temperature
${ORANGE}/set pin${RESET}                 Set or change PIN
${ORANGE}/mode [build|plan|qa|manage]${RESET} Show or switch agent mode
${ORANGE}/activity${RESET}                Show session file changes
${ORANGE}/task${RESET}                    List active tasks
${ORANGE}/task add <desc>${RESET}         Add a task (--due YYYY-MM-DD)
${ORANGE}/task done <n>${RESET}           Mark task #n complete
${ORANGE}/task remove <n>${RESET}         Remove task #n
${ORANGE}/task due${RESET}                Show only due/overdue tasks
${ORANGE}/server${RESET}                  List all servers with status
${ORANGE}/server add <url>${RESET}        Add & test a new server
${ORANGE}/server remove <n>${RESET}       Remove server #n
${ORANGE}/server test${RESET}             Test all server connections
${ORANGE}/agent${RESET}                   List all agents (manager + sub-agents)
${ORANGE}/agent create <name>${RESET}     Create a new sub-agent (interactive)
${ORANGE}/agent remove <name>${RESET}     Remove a sub-agent
${ORANGE}/agent enable <name>${RESET}     Enable a sub-agent
${ORANGE}/agent disable <name>${RESET}    Disable a sub-agent
${ORANGE}/agent rename <name>${RESET}     Rename the manager agent
${ORANGE}/reflect${RESET}                 Agent reviews session and saves lessons
${ORANGE}/trust${RESET}                   Toggle auto-approve for session
${ORANGE}/compact${RESET}                 Toggle compact output
${ORANGE}/home${RESET}                    Show dashboard
${ORANGE}/telegram${RESET}                Manage Telegram bot config
${ORANGE}/telegram code${RESET}           Generate access code for bot auth
${ORANGE}/update${RESET}                   Pull latest & rebuild from GitHub
${ORANGE}/quit${RESET} ${ORANGE}/exit${RESET}              Exit
`);
      return { handled: true };
    }

    case "/quit": case "/exit": {
      return { exit: true };
    }

    case "/clear": {
      messages.length = 0;
      // Clear terminal like a fresh start, then reprint banner with full context
      process.stdout.write("\x1b[2J\x1b[H");
      const sm = await import("./sessions.js").then((m) => new m.SessionManager());
      printBanner(version, {
        model: config.selectedModel,
        mode: agent?.getMode?.() || "build",
        provider: config.backendType,
        cwd: process.cwd(),
        sessions: sm.list().slice(0, 3),
      });
      console.log(GREEN + "  Conversation cleared." + RESET);
      return { handled: true };
    }

    case "/model": {
      if (args.length === 0) {
        console.log(`  Current model: ${ORANGE}${config.selectedModel || "none"}${RESET}`);
      } else {
        config.selectedModel = args.join(" ");
        saveConfig(config);
        console.log(GREEN + `  Model set to: ${config.selectedModel}` + RESET);
      }
      return { handled: true };
    }

    case "/models": {
      console.log(BOLD + "\n  Available models:" + RESET);
      try {
        const result = await getAllLocalModels(config);
        config.modelServerMap = result.modelServerMap;
        config.serverBackendMap = result.serverBackendMap;

        const visible = result.allModels.filter((m) => !(config.hiddenModels || []).includes(m));
        for (const m of visible) {
          const running = result.runningModels.has(m);
          const current = m === config.selectedModel;
          const badge = running ? ` ${GREEN}●${RESET}` : "";
          const marker = current ? ` ${ORANGE}◀${RESET}` : "";
          console.log(`  ${m}${badge}${marker}`);
        }
      } catch {
        console.log(DIM + "  Could not fetch local models." + RESET);
      }

      // Show cloud models
      for (const [provider, models] of Object.entries(CLOUD_MODELS)) {
        if (config.enabledProviders?.[provider]) {
          for (const m of models) {
            const current = m === config.selectedModel;
            const marker = current ? ` ${ORANGE}◀${RESET}` : "";
            console.log(`  ${m} ${DIM}(${provider})${RESET}${marker}`);
          }
        }
      }
      console.log("");
      return { handled: true };
    }

    case "/settings": {
      console.log(`
${BOLD}Settings${RESET}
  Profile:      ${config.profileName || "Not set"}
  PIN:          ${config.pinHash ? "Set" : "Not set"}
  Server:       ${config.ollamaUrl}
  Model:        ${config.selectedModel || "Not set"}
  Temperature:  ${config.temperature}
  Max iters:    ${config.maxIterations}
  Memory:       ${config.memoryEnabled ? "Enabled" : "Disabled"}
  Thinking:     ${config.showThinking ? "Shown" : "Hidden"}
  Tool calls:   ${config.showToolCalls ? "Shown" : "Hidden"}
  Auto-approve: low=${config.autoApprove?.low}, medium=${config.autoApprove?.medium}, high=${config.autoApprove?.high}
  Anthropic:    ${config.enabledProviders?.anthropic ? GREEN + "Enabled" + RESET : DIM + "Disabled" + RESET}
  Google:       ${config.enabledProviders?.google ? GREEN + "Enabled" + RESET : DIM + "Disabled" + RESET}
  OpenAI:       ${config.enabledProviders?.openai ? GREEN + "Enabled" + RESET : DIM + "Disabled" + RESET}
`);
      return { handled: true };
    }

    case "/tools": {
      if (!agent?.toolRegistry) {
        console.log(DIM + "  No tools loaded." + RESET);
        return { handled: true };
      }
      const { toolIcons } = await import("./ui/theme.js");
      console.log(BOLD + "\n  Available tools:" + RESET);
      for (const tool of agent.toolRegistry.getAll()) {
        const level = typeof tool.safetyLevel === "function" ? "dynamic" : tool.safetyLevel;
        const color = level === "low" ? GREEN : level === "medium" ? YELLOW : RED;
        const icon = toolIcons[tool.definition.name] || icons.arrow;
        const dot = level === "low" ? `${GREEN}${icons.success}${RESET}` : level === "medium" ? `${YELLOW}${icons.warning}${RESET}` : `${RED}${icons.error}${RESET}`;
        console.log(`  ${theme.toolIcon}${icon}${theme.reset} ${theme.toolName}${tool.definition.name}${theme.reset} ${dot} ${theme.dim}${tool.definition.description.split(".")[0]}${theme.reset}`);
      }
      console.log("");
      return { handled: true };
    }

    case "/context": {
      const totalChars = messages.reduce((sum, m) => {
        const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
        return sum + content.length;
      }, 0);
      const estTokens = Math.ceil(totalChars / 4);
      console.log(`\n  ${BOLD}Context usage:${RESET}`);
      console.log(`  Messages: ${messages.length}`);
      console.log(`  Est. tokens: ~${estTokens.toLocaleString()}`);
      console.log(`  Model: ${config.selectedModel}\n`);
      return { handled: true };
    }

    case "/memory": {
      if (!agent?.memory) {
        console.log(DIM + "  Memory system not available." + RESET);
        return { handled: true };
      }

      const subCmd = args[0];

      if (subCmd === "list") {
        const topics = agent.memory.listTopics();
        console.log(BOLD + "\n  Memory files:" + RESET);
        const global = agent.memory.loadGlobal();
        console.log(`  ${ORANGE}MEMORY.md${RESET} ${global ? GREEN + "(loaded)" + RESET : DIM + "(empty)" + RESET}`);
        for (const t of topics) {
          console.log(`  ${ORANGE}${t}.md${RESET}`);
        }
        console.log("");
        return { handled: true };
      }

      if (subCmd === "save" && args[1]) {
        const topic = args.slice(1).join("-");
        const content = await ask(rl, `  Enter memory content for "${topic}" (or press Enter to cancel): `);
        if (content.trim()) {
          agent.memory.saveTopic(topic, content.trim());
          console.log(GREEN + `  Saved memory: ${topic}.md` + RESET);
        }
        return { handled: true };
      }

      // Default: show memory status
      const global = agent.memory.loadGlobal();
      const project = agent.memory.loadProject(process.cwd());
      const topics = agent.memory.listTopics();
      console.log(BOLD + "\n  Memory status:" + RESET);
      console.log(`  Global:  ${global ? `${global.split("\n").length} lines` : "Not set"}`);
      console.log(`  Project: ${project ? `${project.split("\n").length} lines` : "Not set"}`);
      console.log(`  Topics:  ${topics.length} file(s)`);
      console.log(DIM + `  Dir: ${getMemoryDir()}` + RESET);
      console.log("");
      return { handled: true };
    }

    case "/instructions": {
      const { discoverInstructions } = await import("./memory/instructions.js");
      const instructions = discoverInstructions(process.cwd());
      if (instructions.length === 0) {
        console.log(`\n  ${theme.dim}No agent instructions found.${theme.reset}`);
        console.log(`  ${theme.dim}Create .llamabuild/agent/*.md or AGENTS.md to add instructions.${theme.reset}\n`);
        return { handled: true };
      }
      console.log(`\n${BOLD}  Agent Instructions${RESET} ${theme.textMuted}(${instructions.length} file${instructions.length > 1 ? "s" : ""})${theme.reset}\n`);
      for (const inst of instructions) {
        const sourceColor = inst.source === "global" ? theme.hint : inst.source === "project" ? theme.success : theme.dim;
        const sourceLabel = inst.source === "global" ? "global" : inst.source === "project" ? "project" : "inherited";
        const desc = inst.meta.description ? ` ${theme.dim}${icons.dash} ${inst.meta.description}${theme.reset}` : "";
        console.log(`  ${theme.accent}${icons.arrow}${theme.reset} ${BOLD}${inst.name}${RESET} ${sourceColor}[${sourceLabel}]${theme.reset}${desc}`);
        console.log(`    ${theme.textMuted}${inst.path}${theme.reset}`);
      }
      console.log("");
      return { handled: true };
    }

    case "/undo": {
      if (!agent?.sessionChanges || agent.sessionChanges.length === 0) {
        console.log(DIM + "  No changes to undo." + RESET);
        return { handled: true };
      }

      const last = agent.sessionChanges.pop();
      if (last.type === "create") {
        try {
          unlinkSync(last.path);
          console.log(GREEN + `  Undone: removed created file ${last.path}` + RESET);
        } catch (err) {
          console.log(RED + `  Error undoing: ${err.message}` + RESET);
        }
      } else if (last.oldContent !== undefined) {
        try {
          writeFileSync(last.path, last.oldContent, "utf8");
          console.log(GREEN + `  Undone: restored ${last.path}` + RESET);
        } catch (err) {
          console.log(RED + `  Error undoing: ${err.message}` + RESET);
        }
      }
      return { handled: true };
    }

    case "/diff": {
      if (!agent?.sessionChanges || agent.sessionChanges.length === 0) {
        console.log(DIM + "  No changes this session." + RESET);
        return { handled: true };
      }
      console.log(BOLD + "\n  Session changes:" + RESET);
      for (const change of agent.sessionChanges) {
        const rel = relative(process.cwd(), change.path);
        console.log(`  ${ORANGE}${change.type}${RESET} ${rel}`);
      }
      console.log("");
      return { handled: true };
    }

    case "/mode": {
      if (!agent?.getMode || !agent?.setMode) {
        console.log(DIM + "  Mode switching not available." + RESET);
        return { handled: true };
      }
      const MODES = {
        build:  { label: "Build",  color: theme.modeBuild,  icon: icons.build,  description: "Full agent — reads, writes, and executes freely" },
        plan:   { label: "Plan",   color: theme.modePlan,   icon: icons.plan,   description: "Explore and plan only — no file writes or commands" },
        qa: { label: "Q&A", color: theme.modeQA, icon: icons.qa, description: "Direct Q&A — no tools, just conversation" },
        manage: { label: "Manage", color: theme.modeManage, icon: icons.manage, description: "Coordinate sub-agents — delegate, monitor, and redirect work" },
      };
      const MODE_CYCLE = ["build", "plan", "qa", "manage"];
      const current = agent.getMode();

      // /mode <name> — set directly
      if (args.length > 0) {
        const target = args[0].toLowerCase();
        if (!(target in MODES)) {
          console.log(RED + `  Unknown mode: ${target}` + RESET);
          console.log(DIM + `  Available: ${Object.keys(MODES).join(", ")}` + RESET);
          return { handled: true };
        }
        if (target === current) {
          console.log(DIM + `  Already in ${MODES[target].label} mode.` + RESET);
          return { handled: true };
        }
        agent.setMode(target);
        const m = MODES[target];
        console.log(`\n  ${m.color}${m.icon} ${m.label}${RESET} ${DIM}${m.description}${RESET}`);
        return { handled: true };
      }

      // /mode — cycle to the next mode (build → plan → qa → manage → build)
      const currentIdx = MODE_CYCLE.indexOf(current);
      const target = MODE_CYCLE[(currentIdx + 1) % MODE_CYCLE.length];
      agent.setMode(target);
      const prev = MODES[current];
      const next = MODES[target];
      console.log(`\n  ${prev.color}${prev.icon} ${prev.label}${RESET} ${DIM}→${RESET} ${next.color}${next.icon} ${next.label}${RESET}  ${DIM}${next.description}${RESET}\n`);
      return { handled: true };
    }

    case "/activity": {
      if (!agent?.sessionTracker) {
        console.log(DIM + "  Activity feed not available." + RESET);
        return { handled: true };
      }
      const { activityPanel } = await import("./ui/sidebar.js");
      const changes = agent.sessionTracker.getRecentChanges();
      if (changes.length === 0) {
        console.log(DIM + "  No file changes in this session yet." + RESET);
      } else {
        activityPanel.showActivity(changes);
      }
      return { handled: true };
    }

    case "/trust": {
      config.autoApprove = { low: true, medium: true, high: true };
      console.log(YELLOW + "  Auto-approve enabled for all tool safety levels this session." + RESET);
      return { handled: true };
    }

    case "/more": {
      const calls = getLastToolCalls();
      if (calls.length === 0) {
        console.log(DIM + "  No recent tool calls to show." + RESET);
      } else {
        console.log(BOLD + `\n  Last ${calls.length} tool call(s):` + RESET);
        for (const tc of calls) {
          printToolCallFull(tc);
        }
        console.log("");
      }
      return { handled: true };
    }

    case "/session": {
      if (!agent?.sessionMgr) {
        console.log(DIM + "  Session management not available." + RESET);
        return { handled: true };
      }

      const subCmd = args[0];

      if (subCmd === "list") {
        const sessions = agent.sessionMgr.list();
        if (sessions.length === 0) {
          console.log(DIM + "  No saved sessions." + RESET);
          return { handled: true };
        }
        console.log(BOLD + "\n  Sessions:" + RESET);
        sessions.forEach((s, i) => {
          const current = s.id === agent.currentSession?.id ? ` ${ORANGE}◀${RESET}` : "";
          const date = new Date(s.lastUsed).toLocaleDateString();
          console.log(`  ${ORANGE}${i + 1}.${RESET} ${s.title} ${DIM}(${date})${RESET}${current}`);
        });
        console.log("");
        return { handled: true };
      }

      if (subCmd === "new") {
        const title = args.slice(1).join(" ") || undefined;
        const session = agent.sessionMgr.create(process.cwd(), title);
        agent.switchSession(session, []);
        console.log(GREEN + `  New session started.` + RESET);
        return { handled: true };
      }

      if (subCmd === "load") {
        const n = parseInt(args[1], 10);
        const sessions = agent.sessionMgr.list();
        if (isNaN(n) || n < 1 || n > sessions.length) {
          console.log(RED + `  Invalid session number. Use /session list to see available sessions.` + RESET);
          return { handled: true };
        }
        const session = sessions[n - 1];
        const loaded = loadConversation(session.id, encKey);
        agent.switchSession(session, loaded);
        agent.sessionMgr.touch(session.id);
        console.log(GREEN + `  Loaded: ${session.title}` + RESET + DIM + ` (${loaded.length} messages)` + RESET);
        return { handled: true };
      }

      if (subCmd === "delete") {
        const n = parseInt(args[1], 10);
        const sessions = agent.sessionMgr.list();
        if (isNaN(n) || n < 1 || n > sessions.length) {
          console.log(RED + `  Invalid session number.` + RESET);
          return { handled: true };
        }
        const session = sessions[n - 1];
        if (session.id === agent.currentSession?.id) {
          console.log(RED + `  Cannot delete the active session.` + RESET);
          return { handled: true };
        }
        agent.sessionMgr.delete(session.id);
        console.log(GREEN + `  Deleted: ${session.title}` + RESET);
        return { handled: true };
      }

      // Default: show current session info
      const s = agent.currentSession;
      if (s) {
        console.log(`\n  ${BOLD}Current session:${RESET}`);
        console.log(`  Title:   ${s.title}`);
        console.log(`  Created: ${new Date(s.created).toLocaleString()}`);
        console.log(`  Messages: ${messages.length}`);
        console.log("");
      }
      return { handled: true };
    }

    case "/compact": {
      config.showThinking = !config.showThinking;
      config.showToolCalls = !config.showToolCalls;
      console.log(DIM + `  Compact mode: ${!config.showThinking ? "on" : "off"}` + RESET);
      return { handled: true };
    }

    case "/update": {
      return await handleUpdate(version);
    }

    case "/set": {
      return await handleSet(args, config, rl, encKey);
    }

    case "/task": {
      if (!agent?.taskManager) {
        console.log(DIM + "  Task system not available." + RESET);
        return { handled: true };
      }
      const tm = agent.taskManager;
      const subCmd = args[0];

      if (!subCmd || subCmd === "list") {
        const data = tm.list();
        if (data.active.length === 0) {
          console.log(DIM + "  No active tasks." + RESET);
          return { handled: true };
        }
        const today = new Date().toISOString().split("T")[0];
        console.log(BOLD + "\n  Active Tasks:" + RESET);
        data.active.forEach((t, i) => {
          const overdue = t.dueDate && t.dueDate < today;
          const dueToday = t.dueDate && t.dueDate === today;
          const due = t.dueDate ? ` ${DIM}(due: ${t.dueDate})${RESET}` : "";
          const tag = overdue ? ` ${RED}[OVERDUE]${RESET}` : dueToday ? ` ${YELLOW}[DUE TODAY]${RESET}` : "";
          console.log(`  ${ORANGE}${i + 1}.${RESET} ${t.description}${due}${tag}`);
        });
        console.log("");
        return { handled: true };
      }

      if (subCmd === "add") {
        // Parse --due flag
        let dueDate = null;
        const dueIdx = args.indexOf("--due");
        let descParts = args.slice(1);
        if (dueIdx > 0) {
          dueDate = args[dueIdx + 1] || null;
          descParts = [...args.slice(1, dueIdx), ...args.slice(dueIdx + 2)];
        }
        const desc = descParts.join(" ").trim();
        if (!desc) {
          console.log(DIM + "  Usage: /task add <description> [--due YYYY-MM-DD]" + RESET);
          return { handled: true };
        }
        const task = tm.add(desc, dueDate);
        console.log(GREEN + `  Added: ${task.description}${task.dueDate ? ` (due: ${task.dueDate})` : ""}` + RESET);
        return { handled: true };
      }

      if (subCmd === "done") {
        const n = parseInt(args[1], 10);
        const task = tm.complete(n);
        if (!task) {
          console.log(RED + "  Invalid task number." + RESET);
        } else {
          console.log(GREEN + `  Completed: ${task.description}` + RESET);
        }
        return { handled: true };
      }

      if (subCmd === "remove") {
        const n = parseInt(args[1], 10);
        const task = tm.remove(n);
        if (!task) {
          console.log(RED + "  Invalid task number." + RESET);
        } else {
          console.log(GREEN + `  Removed: ${task.description}` + RESET);
        }
        return { handled: true };
      }

      if (subCmd === "due") {
        const dueTasks = tm.getDueTasks();
        if (dueTasks.length === 0) {
          console.log(DIM + "  No tasks due today or overdue." + RESET);
        } else {
          console.log(BOLD + "\n  Due/Overdue Tasks:" + RESET);
          for (const t of dueTasks) {
            console.log(`  ${RED}●${RESET} ${t.description} ${DIM}(due: ${t.dueDate})${RESET}`);
          }
          console.log("");
        }
        return { handled: true };
      }

      console.log(DIM + "  Usage: /task [add|done|remove|due]" + RESET);
      return { handled: true };
    }

    case "/server": {
      const subCmd = args[0];

      if (!subCmd || subCmd === "list") {
        console.log(BOLD + "\n  Servers:" + RESET);
        // Primary
        const primaryUrl = config.ollamaUrl || "http://localhost:11434";
        let primaryStatus = DIM + "untested" + RESET;
        try {
          const bt = await detectBackend(primaryUrl);
          primaryStatus = bt !== "unknown" ? `${GREEN}${bt}${RESET}` : `${RED}unreachable${RESET}`;
        } catch { primaryStatus = `${RED}unreachable${RESET}`; }
        console.log(`  ${ORANGE}1.${RESET} ${primaryUrl} ${primaryStatus} ${DIM}(primary)${RESET}`);

        // Additional servers
        const servers = config.localServers || [];
        for (let i = 0; i < servers.length; i++) {
          let status = DIM + "untested" + RESET;
          try {
            const bt = await detectBackend(servers[i]);
            status = bt !== "unknown" ? `${GREEN}${bt}${RESET}` : `${RED}unreachable${RESET}`;
          } catch { status = `${RED}unreachable${RESET}`; }
          console.log(`  ${ORANGE}${i + 2}.${RESET} ${servers[i]} ${status}`);
        }
        console.log("");
        return { handled: true };
      }

      if (subCmd === "add") {
        const url = args[1];
        if (!url) {
          console.log(DIM + "  Usage: /server add <url>" + RESET);
          return { handled: true };
        }
        const cleanUrl = url.replace(/\/$/, "");
        console.log(DIM + `  Testing ${cleanUrl}...` + RESET);
        try {
          const bt = await detectBackend(cleanUrl);
          if (bt === "unknown") {
            console.log(YELLOW + `  Server reachable but backend unknown. Added anyway.` + RESET);
          } else {
            console.log(GREEN + `  Connected: ${bt}` + RESET);
          }
        } catch {
          console.log(YELLOW + "  Could not reach server. Added anyway." + RESET);
        }
        if (!config.localServers) config.localServers = [];
        config.localServers.push(cleanUrl);
        saveConfig(config);
        console.log(GREEN + `  Server added: ${cleanUrl}` + RESET);
        return { handled: true };
      }

      if (subCmd === "remove") {
        const n = parseInt(args[1], 10);
        if (n === 1) {
          console.log(RED + "  Cannot remove the primary server. Use /set server-url to change it." + RESET);
          return { handled: true };
        }
        const servers = config.localServers || [];
        const idx = n - 2;
        if (idx < 0 || idx >= servers.length) {
          console.log(RED + "  Invalid server number." + RESET);
          return { handled: true };
        }
        const removed = servers.splice(idx, 1)[0];
        saveConfig(config);
        console.log(GREEN + `  Removed: ${removed}` + RESET);
        return { handled: true };
      }

      if (subCmd === "test") {
        console.log(DIM + "  Testing all servers..." + RESET);
        const all = [config.ollamaUrl || "http://localhost:11434", ...(config.localServers || [])];
        for (const url of all) {
          try {
            const bt = await detectBackend(url);
            const status = bt !== "unknown" ? `${GREEN}${bt}${RESET}` : `${RED}unreachable${RESET}`;
            console.log(`  ${url} ${status}`);
          } catch {
            console.log(`  ${url} ${RED}unreachable${RESET}`);
          }
        }
        return { handled: true };
      }

      console.log(DIM + "  Usage: /server [add|remove|test]" + RESET);
      return { handled: true };
    }

    case "/home": {
      // Clear terminal, re-fetch data, reprint dashboard
      process.stdout.write("\x1b[2J\x1b[H");
      const smHome = await import("./sessions.js").then((m) => new m.SessionManager());
      const { TaskManager: TM } = await import("./memory/tasks.js");

      let dashTasks = null;
      try { dashTasks = new TM().list(); } catch { /* */ }

      let dashMemStats = null;
      try {
        const mDir = getMemoryDir();
        if (existsSync(mDir)) {
          const files = readdirSync(mDir).filter((f) => f.endsWith(".md"));
          const hasLessons = files.includes("lessons.md");
          let lessonsCount = 0;
          if (hasLessons) {
            try {
              const content = readFileSync(join(mDir, "lessons.md"), "utf8");
              lessonsCount = (content.match(/^- /gm) || []).length;
            } catch { /* */ }
          }
          dashMemStats = {
            enabled: config.memoryEnabled !== false,
            topicCount: files.filter((f) => f !== "MEMORY.md" && f !== "sessions.md").length,
            hasLessons,
            lessonsCount,
          };
        }
      } catch { /* */ }

      printBanner(version, {
        model: config.selectedModel,
        mode: agent?.getMode?.() || "build",
        provider: config.backendType,
        cwd: process.cwd(),
        sessions: smHome.list().slice(0, 3),
        tasks: dashTasks,
        memoryStats: dashMemStats,
      });
      return { handled: true };
    }

    case "/telegram": {
      const subCmd = args[0];

      if (!subCmd) {
        // Show current Telegram config
        const token = config.telegramBotToken;
        const users = config.telegramAllowedUsers || [];
        const code = config.telegramAccessCode || "";
        const masked = token && typeof token === "string" && token.length > 10
          ? token.slice(0, 6) + "****" + token.slice(-4)
          : token ? "(encrypted)" : "Not set";
        console.log(`\n${BOLD}  Telegram Bot${RESET}`);
        console.log(`  Token:       ${masked}`);
        console.log(`  Access code: ${code || DIM + "None (use /telegram code to generate)" + RESET}`);
        console.log(`  Users:       ${users.length > 0 ? users.join(", ") : "None"}`);
        console.log(`  Status:      ${token ? GREEN + "Configured" + RESET : DIM + "Not configured" + RESET}`);
        console.log(DIM + `\n  Start with: llamabuild --telegram${config.pinHash ? " --pin <pin>" : ""}` + RESET);
        console.log("");
        return { handled: true };
      }

      if (subCmd === "token") {
        const token = args[1];
        if (!token) {
          console.log(DIM + "  Usage: /telegram token <bot-token>" + RESET);
          return { handled: true };
        }
        config.telegramBotToken = token;
        if (encKey) {
          const { saveConfigWithKey } = await import("./config.js");
          saveConfigWithKey(config, encKey);
        } else {
          saveConfig(config);
        }
        console.log(GREEN + "  Telegram bot token saved." + RESET);
        // Auto-generate access code if none exists
        if (!config.telegramAccessCode) {
          const code = randomBytes(4).toString("hex");
          config.telegramAccessCode = code;
          saveConfig(config);
          console.log(`  Access code generated: ${ORANGE}${code}${RESET}`);
          console.log(DIM + "  Send this code to the bot on Telegram to authenticate." + RESET);
        }
        return { handled: true };
      }

      if (subCmd === "code") {
        // Generate a new access code
        const code = randomBytes(4).toString("hex");
        config.telegramAccessCode = code;
        saveConfig(config);
        console.log(`\n  ${BOLD}Access code:${RESET} ${ORANGE}${code}${RESET}`);
        console.log(DIM + "  Send this to the Telegram bot to authenticate new users." + RESET);
        console.log(DIM + "  Each user sends the code once, then they're permanently authorized." + RESET);
        console.log("");
        return { handled: true };
      }

      if (subCmd === "users") {
        const users = config.telegramAllowedUsers || [];
        if (users.length === 0) {
          console.log(DIM + "  No authorized users." + RESET);
        } else {
          console.log(`\n  ${BOLD}Authorized Users${RESET}`);
          users.forEach((u, i) => console.log(`  ${i + 1}. ${u}`));
          console.log("");
        }
        return { handled: true };
      }

      if (subCmd === "clear") {
        config.telegramBotToken = "";
        config.telegramAllowedUsers = [];
        config.telegramAccessCode = "";
        saveConfig(config);
        console.log(GREEN + "  Telegram config cleared." + RESET);
        return { handled: true };
      }

      console.log(DIM + "  Usage: /telegram [token <t> | code | users | clear]" + RESET);
      return { handled: true };
    }

    case "/agent": case "/agents": {
      if (!agent) {
        console.log(DIM + "  Agent not available." + RESET);
        return { handled: true };
      }
      const subCmd = args[0];
      const subAgents = agent.getSubAgents();

      // /agent or /agents — list all agents
      if (!subCmd || cmd === "/agents") {
        const name = agent.getAgentName();
        console.log(`\n${BOLD}  Agents${RESET}`);
        console.log(`  ${ORANGE}●${RESET} ${BOLD}${name}${RESET} ${DIM}(manager)${RESET} — model: ${config.selectedModel || "auto"}`);
        if (subAgents.length === 0) {
          console.log(DIM + "\n  No sub-agents configured. Use /agent create <name> to add one." + RESET);
        } else {
          for (const a of subAgents) {
            const status = a.enabled !== false ? `${GREEN}enabled${RESET}` : `${RED}disabled${RESET}`;
            const model = a.model ? a.model : DIM + "inherit" + RESET;
            const tools = a.tools ? `${a.tools.length} tools` : "all tools";
            console.log(`  ${a.enabled !== false ? GREEN + "●" + RESET : RED + "○" + RESET} ${BOLD}${a.name}${RESET} ${DIM}(${a.id})${RESET} — ${status}, model: ${model}, ${tools}`);
            console.log(`    ${DIM}${a.role}${RESET}`);
          }
        }
        console.log(DIM + "\n  Commands: /agent create|remove|enable|disable|rename" + RESET);
        console.log("");
        return { handled: true };
      }

      if (subCmd === "create") {
        const name = args.slice(1).join(" ").trim();
        if (!name) {
          console.log(DIM + "  Usage: /agent create <name>" + RESET);
          return { handled: true };
        }
        // Check for name collision
        if (subAgents.find((a) => a.name.toLowerCase() === name.toLowerCase())) {
          console.log(RED + `  An agent named "${name}" already exists.` + RESET);
          return { handled: true };
        }

        // Interactive creation
        const role = await ask(rl, `  ${BOLD}Role description:${RESET} `);
        if (!role.trim()) {
          console.log(DIM + "  Cancelled — role is required." + RESET);
          return { handled: true };
        }

        const modelInput = await ask(rl, `  ${BOLD}Model${RESET} ${DIM}(Enter to inherit from manager):${RESET} `);

        const toolInput = await ask(rl, `  ${BOLD}Allowed tools${RESET} ${DIM}(comma-separated, Enter for all):${RESET} `);
        let tools = null;
        if (toolInput.trim()) {
          tools = toolInput.split(",").map((t) => t.trim()).filter(Boolean);
        }

        const newAgent = agent.addSubAgent({
          name,
          role: role.trim(),
          model: modelInput.trim() || null,
          tools,
        });
        saveConfig(config);
        console.log(GREEN + `  Created sub-agent "${newAgent.name}" (${newAgent.id})` + RESET);
        return { handled: true };
      }

      if (subCmd === "remove") {
        const name = args.slice(1).join(" ").trim();
        if (!name) {
          console.log(DIM + "  Usage: /agent remove <name>" + RESET);
          return { handled: true };
        }
        const removed = agent.removeSubAgent(name);
        if (!removed) {
          console.log(RED + `  No agent named "${name}" found.` + RESET);
        } else {
          saveConfig(config);
          console.log(GREEN + `  Removed sub-agent "${removed.name}".` + RESET);
        }
        return { handled: true };
      }

      if (subCmd === "enable") {
        const name = args.slice(1).join(" ").trim();
        if (!name) {
          console.log(DIM + "  Usage: /agent enable <name>" + RESET);
          return { handled: true };
        }
        const found = agent.enableSubAgent(name);
        if (!found) {
          console.log(RED + `  No agent named "${name}" found.` + RESET);
        } else {
          saveConfig(config);
          console.log(GREEN + `  "${found.name}" enabled.` + RESET);
        }
        return { handled: true };
      }

      if (subCmd === "disable") {
        const name = args.slice(1).join(" ").trim();
        if (!name) {
          console.log(DIM + "  Usage: /agent disable <name>" + RESET);
          return { handled: true };
        }
        const found = agent.disableSubAgent(name);
        if (!found) {
          console.log(RED + `  No agent named "${name}" found.` + RESET);
        } else {
          saveConfig(config);
          console.log(YELLOW + `  "${found.name}" disabled.` + RESET);
        }
        return { handled: true };
      }

      if (subCmd === "rename") {
        const newName = args.slice(1).join(" ").trim();
        if (!newName) {
          console.log(DIM + "  Usage: /agent rename <new name>" + RESET);
          console.log(DIM + `  Current name: ${agent.getAgentName()}` + RESET);
          return { handled: true };
        }
        agent.setAgentName(newName);
        saveConfig(config);
        console.log(GREEN + `  Agent renamed to "${newName}".` + RESET);
        return { handled: true };
      }

      console.log(DIM + "  Usage: /agent [create|remove|enable|disable|rename]" + RESET);
      return { handled: true };
    }

    case "/reflect": {
      // Temporarily switch to build mode if in Q&A (needs write_file tool access)
      const wasQA = agent?.getMode?.() === "qa";
      if (wasQA) {
        agent.setMode("build");
        console.log(`  ${DIM}Switching to Build mode for reflection...${RESET}`);
      }
      // Inject a synthetic user message that triggers the agent to review the session
      // and save lessons. Return handled=false so agent.js processes it as a normal turn.
      return {
        handled: false,
        inject: "Review this session. What did you learn — about me (preferences, habits, communication style), about patterns that worked well, mistakes made, or problems solved? Save any useful lessons to lessons.md under the appropriate headings (## About You, ## Patterns, ## Mistakes, ## Solutions). Check existing lessons first to avoid duplicates.",
        restoreMode: wasQA ? "qa" : null,
      };
    }

    default: {
      console.log(RED + `  Unknown command: ${cmd}. Type /help for available commands.` + RESET);
      return { handled: true };
    }
  }
}

const REPO_URL = "https://github.com/ItsTrag1c/LlamaTalk-Build.git";

async function handleUpdate(currentVersion) {
  const isPackaged = process.execPath.endsWith(".exe") && !process.execPath.includes("node");
  const installDir = isPackaged ? dirname(process.execPath) : null;

  console.log(`\n  ${BOLD}Checking for updates...${RESET}`);

  // Create temp working directory
  const tmpDir = mkdtempSync(join(tmpdir(), "llamabuild-update-"));

  try {
    // Clone the repo
    console.log(DIM + "  Cloning repository..." + RESET);
    execSync(`git clone --depth 1 "${REPO_URL}" "${tmpDir}/repo"`, {
      stdio: "pipe",
    });

    // Read remote version
    const remotePkg = JSON.parse(readFileSync(join(tmpDir, "repo", "package.json"), "utf8"));
    const remoteVersion = remotePkg.version;

    console.log(`  Local:  v${currentVersion}`);
    console.log(`  Remote: v${remoteVersion}`);

    if (remoteVersion === currentVersion) {
      console.log(GREEN + `\n  LlamaTalk Build v${currentVersion} is already up to date.` + RESET);
      rmSync(tmpDir, { recursive: true, force: true });
      return { handled: true };
    }

    console.log(ORANGE + `\n  New version available: v${remoteVersion}` + RESET);

    // Install dependencies
    console.log(DIM + "  Installing dependencies..." + RESET);
    execSync("npm install", {
      cwd: join(tmpDir, "repo"),
      stdio: "pipe",
    });

    // Build
    console.log(DIM + "  Building..." + RESET);
    execSync("npm run build", {
      cwd: join(tmpDir, "repo"),
      stdio: "pipe",
      timeout: 300000,
    });

    const builtExe = join(tmpDir, "repo", "dist", `LlamaTalkBuild_${remoteVersion}.exe`);
    const builtSetup = join(tmpDir, "repo", "dist", `LlamaTalk Build_${remoteVersion}_setup.exe`);

    if (!existsSync(builtExe)) {
      console.log(RED + "  Build failed: output EXE not found." + RESET);
      rmSync(tmpDir, { recursive: true, force: true });
      return { handled: true };
    }

    if (isPackaged && installDir) {
      // Replace the running EXE (rename old, copy new)
      const currentExe = join(installDir, "LlamaTalkBuild.exe");
      const oldExe = join(installDir, "LlamaTalkBuild.old.exe");

      let replaced = false;
      try {
        // Remove previous .old if it exists
        if (existsSync(oldExe)) unlinkSync(oldExe);
        // Rename running EXE (Windows allows renaming a running EXE)
        renameSync(currentExe, oldExe);
        // Copy new EXE
        copyFileSync(builtExe, currentExe);
        console.log(GREEN + `  Updated EXE in ${installDir}` + RESET);
        replaced = true;
      } catch (err) {
        // If direct replace fails (e.g. Program Files needs admin), run the installer with UAC
        if (existsSync(builtSetup)) {
          console.log(DIM + `  Elevated permissions required — launching installer...` + RESET);
          try {
            execSync(
              `powershell -Command "Start-Process -FilePath '${builtSetup.replace(/'/g, "''")}' -Verb RunAs -Wait"`,
              { stdio: "pipe", timeout: 120000 },
            );
            replaced = true;
            console.log(GREEN + `  Installer completed.` + RESET);
          } catch (uacErr) {
            console.log(RED + `  Installer failed or was cancelled: ${uacErr.message}` + RESET);
            console.log(DIM + `  Built EXE available at: ${builtExe}` + RESET);
            return { handled: true };
          }
        } else {
          console.log(RED + `  Could not replace EXE: ${err.message}` + RESET);
          console.log(DIM + `  Built EXE available at: ${builtExe}` + RESET);
          return { handled: true };
        }
      }

      if (replaced) {
        // Copy installer too if it exists and we did a direct replace
        if (existsSync(builtSetup)) {
          const destSetup = join(installDir, `LlamaTalk Build_${remoteVersion}_setup.exe`);
          try {
            copyFileSync(builtSetup, destSetup);
          } catch { /* non-critical */ }
        }

        // Clean up old versions (skip files that are locked/in use)
        try {
          for (const f of readdirSync(installDir)) {
            const isOldExe = f === "LlamaTalkBuild.old.exe";
            const isOldSetup = f.startsWith("LlamaTalk Build_") && f.endsWith("_setup.exe") && !f.includes(remoteVersion);
            const isOldStandalone = f.startsWith("LlamaTalkBuild_") && f.endsWith(".exe") && f !== "LlamaTalkBuild.exe" && !f.includes(remoteVersion);
            if (isOldExe || isOldSetup || isOldStandalone) {
              try { unlinkSync(join(installDir, f)); } catch { /* in use or locked — cleaned on next launch */ }
            }
          }
        } catch { /* non-critical cleanup */ }
      }

      console.log(GREEN + BOLD + `\n  ✔ Updated to v${remoteVersion}!` + RESET);
      console.log(DIM + "  Restarting..." + RESET);

      // Clean up temp files before restart
      try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* */ }

      // Replace this process with the updated EXE (stays in same terminal)
      try {
        execSync(`"${currentExe}"`, { stdio: "inherit" });
      } catch { /* user exited the new process */ }
      process.exit(0);
    } else {
      // Running from source — pull the latest changes instead
      console.log(GREEN + BOLD + `\n  ✔ Built v${remoteVersion} successfully.` + RESET);
      console.log(DIM + `  Standalone EXE: ${builtExe}` + RESET);
      if (existsSync(builtSetup)) {
        console.log(DIM + `  Installer:      ${builtSetup}` + RESET);
      }
      console.log("");
      console.log(YELLOW + BOLD + "  What to do now:" + RESET);
      console.log(`  ${BOLD}1.${RESET} Close this session (type ${ORANGE}/quit${RESET} or press Ctrl+C)`);
      console.log(`  ${BOLD}2.${RESET} Run ${ORANGE}git pull${RESET} in the project directory to update source`);
      console.log(`  ${BOLD}3.${RESET} Restart LlamaTalk Build`);
      console.log("");
      console.log(DIM + `  The current session is still running v${currentVersion}.` + RESET);
      console.log("");
    }
  } catch (err) {
    console.log(RED + `  Update failed: ${err.message}` + RESET);
  } finally {
    // Clean up temp dir (best-effort)
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }

  return { handled: true };
}

async function handleSet(args, config, rl, encKey) {
  const sub = args[0];

  switch (sub) {
    case "server-url": {
      const url = args[1];
      if (!url) {
        console.log(`  Current server: ${config.ollamaUrl}`);
        return { handled: true };
      }
      config.ollamaUrl = url.replace(/\/$/, "");
      try {
        const bt = await detectBackend(config.ollamaUrl);
        if (bt !== "unknown") config.backendType = bt;
        console.log(GREEN + `  Server set to: ${config.ollamaUrl} (${bt})` + RESET);
      } catch {
        console.log(YELLOW + `  Server set to: ${config.ollamaUrl} (not reachable)` + RESET);
      }
      saveConfig(config);
      return { handled: true };
    }

    case "api-key": {
      const provider = args[1];
      const key = args[2];
      if (!provider || !key) {
        console.log(DIM + "  Usage: /set api-key <anthropic|google|openai|opencode> <key>" + RESET);
        return { handled: true };
      }
      const field = `apiKey_${provider}`;
      if (!(field in config)) {
        console.log(RED + `  Unknown provider: ${provider}` + RESET);
        return { handled: true };
      }
      config[field] = key;
      config.enabledProviders[provider] = true;
      if (encKey) {
        const { saveConfigWithKey } = await import("./config.js");
        saveConfigWithKey(config, encKey);
      } else {
        saveConfig(config);
      }
      console.log(GREEN + `  ${provider} API key set and enabled.` + RESET);
      return { handled: true };
    }

    case "provider": {
      const action = args[1];
      const provider = args[2];
      if (!action || !provider) {
        console.log(DIM + "  Usage: /set provider enable|disable <anthropic|google|openai>" + RESET);
        return { handled: true };
      }
      if (!config.enabledProviders || !(provider in config.enabledProviders)) {
        console.log(RED + `  Unknown provider: ${provider}` + RESET);
        return { handled: true };
      }
      config.enabledProviders[provider] = action === "enable";
      saveConfig(config);
      console.log(GREEN + `  ${provider} ${action}d.` + RESET);
      return { handled: true };
    }

    case "temp": {
      const val = parseFloat(args[1]);
      if (isNaN(val) || val < 0 || val > 1) {
        console.log(DIM + `  Current temperature: ${config.temperature}` + RESET);
        console.log(DIM + "  Usage: /set temp <0.0-1.0>" + RESET);
        return { handled: true };
      }
      config.temperature = val;
      saveConfig(config);
      console.log(GREEN + `  Temperature set to ${val}` + RESET);
      return { handled: true };
    }

    case "pin": {
      const { hashPin, generateEncKeySalt, deriveEncKey } = await import("./config.js");
      const pin1 = await askMasked(BOLD + "  Enter new PIN: " + RESET);
      const pin2 = await askMasked(BOLD + "  Confirm PIN: " + RESET);
      if (pin1.length < 4) {
        console.log(RED + "  PIN must be at least 4 characters." + RESET);
      } else if (pin1 !== pin2) {
        console.log(RED + "  PINs don't match." + RESET);
      } else {
        config.pinHash = hashPin(pin1);
        if (!config.encKeySalt) config.encKeySalt = generateEncKeySalt();
        const newEncKey = deriveEncKey(pin1, config.encKeySalt);
        const { saveConfigWithKey } = await import("./config.js");
        saveConfigWithKey(config, newEncKey);
        console.log(GREEN + "  PIN set!" + RESET);
      }
      return { handled: true };
    }

    default: {
      console.log(DIM + "  Available: server-url, api-key, provider, temp, pin" + RESET);
      return { handled: true };
    }
  }
}
