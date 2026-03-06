import { saveConfig, saveConfigWithKey, getMemoryDir } from "./config.js";
import { detectBackend, getAllLocalModels, getOllamaModels, getOpenAICompatModels, CLOUD_MODELS } from "./providers/router.js";
import { writeFileSync, readFileSync, existsSync, unlinkSync } from "fs";
import { join, relative } from "path";
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
${ORANGE}/trust${RESET}                   Toggle auto-approve for session
${ORANGE}/compact${RESET}                 Toggle compact output
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

    case "/set": {
      return await handleSet(args, config, rl, encKey);
    }

    default: {
      console.log(RED + `  Unknown command: ${cmd}. Type /help for available commands.` + RESET);
      return { handled: true };
    }
  }
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
