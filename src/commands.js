import { saveConfig, saveConfigWithKey, getMemoryDir } from "./config.js";
import { detectBackend, getAllLocalModels, getOllamaModels, getOpenAICompatModels, CLOUD_MODELS } from "./providers/router.js";
import { writeFileSync, readFileSync, existsSync, unlinkSync, mkdtempSync, rmSync, copyFileSync, renameSync, readdirSync } from "fs";
import { join, relative, dirname } from "path";
import { execSync, spawn } from "child_process";
import { tmpdir } from "os";
import {
  ORANGE, RED, GREEN, YELLOW, DIM, BOLD, RESET,
  printError, askMasked,
} from "./ui/ui.js";
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
${ORANGE}/memory${RESET}                  Show loaded memory files
${ORANGE}/memory list${RESET}             List all topic memories
${ORANGE}/memory save <topic>${RESET}     Save a memory topic
${ORANGE}/undo${RESET}                    Undo the last file change
${ORANGE}/diff${RESET}                    Show all file changes this session
${ORANGE}/set server-url <url>${RESET}    Change server URL
${ORANGE}/set api-key <provider> <key>${RESET}  Set API key
${ORANGE}/set provider enable|disable <p>${RESET}  Toggle provider
${ORANGE}/set temp <0.0-1.0>${RESET}      Set temperature
${ORANGE}/set pin${RESET}                 Set or change PIN
${ORANGE}/mode${RESET}                    Cycle agent mode (Auto-Accept/Build/Plan)
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
  Auto-approve: safe=${config.autoApprove?.safe}, moderate=${config.autoApprove?.moderate}, dangerous=${config.autoApprove?.dangerous}
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
      console.log(BOLD + "\n  Available tools:" + RESET);
      for (const tool of agent.toolRegistry.getAll()) {
        const level = typeof tool.safetyLevel === "function" ? "dynamic" : tool.safetyLevel;
        const color = level === "safe" ? GREEN : level === "moderate" ? YELLOW : RED;
        console.log(`  ${ORANGE}${tool.definition.name}${RESET} ${color}[${level}]${RESET} — ${tool.definition.description.split(".")[0]}`);
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
      const MODES = ["accept", "build", "plan"];
      const MODE_LABELS = { accept: "Auto-Accept", build: "Build", plan: "Plan" };
      const MODE_COLORS = { accept: ORANGE, build: GREEN, plan: YELLOW };
      const current = agent.getMode();
      const idx = MODES.indexOf(current);
      const next = MODES[(idx + 1) % MODES.length];
      agent.setMode(next);
      const color = MODE_COLORS[next];
      console.log(`  ${color}● ${MODE_LABELS[next]} Mode${RESET}`);
      return { handled: true };
    }

    case "/trust": {
      config.autoApprove = { safe: true, moderate: true, dangerous: true };
      console.log(YELLOW + "  Auto-approve enabled for all tool safety levels this session." + RESET);
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

      try {
        // Remove previous .old if it exists
        if (existsSync(oldExe)) unlinkSync(oldExe);
        // Rename running EXE (Windows allows renaming a running EXE)
        renameSync(currentExe, oldExe);
        // Copy new EXE
        copyFileSync(builtExe, currentExe);
        console.log(GREEN + `  Updated EXE in ${installDir}` + RESET);
      } catch (err) {
        console.log(RED + `  Could not replace EXE: ${err.message}` + RESET);
        console.log(DIM + `  Built EXE available at: ${builtExe}` + RESET);
        return { handled: true };
      }

      // Copy installer too if it exists
      if (existsSync(builtSetup)) {
        const destSetup = join(installDir, `LlamaTalk Build_${remoteVersion}_setup.exe`);
        try {
          copyFileSync(builtSetup, destSetup);
        } catch { /* non-critical */ }
      }

      // Clean up old versions (skip files that are locked/in use)
      try {
        // Remove old setup/standalone EXEs (not current version)
        for (const f of readdirSync(installDir)) {
          const isOldExe = f === "LlamaTalkBuild.old.exe";
          const isOldSetup = f.startsWith("LlamaTalk Build_") && f.endsWith("_setup.exe") && !f.includes(remoteVersion);
          const isOldStandalone = f.startsWith("LlamaTalkBuild_") && f.endsWith(".exe") && f !== "LlamaTalkBuild.exe" && !f.includes(remoteVersion);
          if (isOldExe || isOldSetup || isOldStandalone) {
            try { unlinkSync(join(installDir, f)); } catch { /* in use or locked — cleaned on next launch */ }
          }
        }
      } catch { /* non-critical cleanup */ }

      console.log(GREEN + BOLD + `\n  Updated to v${remoteVersion}!` + RESET);
      console.log(DIM + "  Please restart LlamaTalk Build to use the new version." + RESET);
      process.exit(0);
    } else {
      // Running from source — just report that the build is ready
      console.log(GREEN + BOLD + `\n  Built v${remoteVersion} successfully.` + RESET);
      console.log(DIM + `  Standalone EXE: ${builtExe}` + RESET);
      if (existsSync(builtSetup)) {
        console.log(DIM + `  Installer:      ${builtSetup}` + RESET);
      }
    }

    console.log("");
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
        console.log(DIM + "  Usage: /set api-key <anthropic|google|openai> <key>" + RESET);
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
