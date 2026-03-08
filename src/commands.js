import { saveConfig, saveConfigWithKey, getMemoryDir, loadConversation } from "./config.js";
import { detectBackend, getAllLocalModels, getOllamaModels, getOpenAICompatModels, CLOUD_MODELS } from "./providers/router.js";
import { writeFileSync, readFileSync, existsSync, unlinkSync, mkdtempSync, rmSync, copyFileSync, renameSync, readdirSync } from "fs";
import { join, relative, dirname } from "path";
import { execSync } from "child_process";
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
${ORANGE}/mode [build|plan]${RESET}       Show or switch agent mode
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
${ORANGE}/trust${RESET}                   Toggle auto-approve for session
${ORANGE}/compact${RESET}                 Toggle compact output
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
      printBanner(version);
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
        build: { label: "Build", color: theme.modeBuild, icon: icons.build, description: "Full agent — reads, writes, and executes freely" },
        plan:  { label: "Plan",  color: theme.modePlan, icon: icons.plan, description: "Explore and plan only — no file writes or commands" },
      };
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

      // /mode — toggle to the other mode
      const target = current === "build" ? "plan" : "build";
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
      console.log("");
      console.log(YELLOW + BOLD + "  What to do now:" + RESET);
      console.log(`  ${BOLD}1.${RESET} Close this window (type ${ORANGE}/quit${RESET} or press Ctrl+C)`);
      console.log(`  ${BOLD}2.${RESET} Reopen LlamaTalk Build`);
      console.log("");
      console.log(DIM + "  The new version will take effect on the next launch." + RESET);
      console.log(DIM + `  The current session is still running v${currentVersion}.` + RESET);
      console.log("");
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
