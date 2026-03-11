#!/usr/bin/env node
process.removeAllListeners("warning");

// Prevent unhandled rejections from crashing the process (especially in Telegram bot mode)
process.on("unhandledRejection", (err) => {
  console.error("   [Unhandled rejection]", err?.message || err);
});

import { createInterface } from "readline";
import { loadConfig, saveConfig, isFirstRun, pinRequired, verifyPin, needsPinMigration, hashPin, generateEncKeySalt, deriveEncKey, decryptApiKeys, saveConfigWithKey, getMemoryDir } from "./src/config.js";
import { runOnboarding } from "./src/onboarding.js";
import { runAgent } from "./src/agent.js";
import { detectBackend, getAllLocalModels, CLOUD_MODELS } from "./src/providers/router.js";
import { printBanner } from "./src/ui/banner.js";
import { askMasked, ORANGE, RED, RESET, BOLD, DIM, YELLOW } from "./src/ui/ui.js";
import { SessionManager } from "./src/sessions.js";
import { TaskManager } from "./src/memory/tasks.js";
import { existsSync, readdirSync, unlinkSync, readFileSync } from "fs";
import { dirname, join } from "path";

const VERSION = "2.5.3";

// Clean up leftover files from previous /update (old EXEs that couldn't be deleted while running)
function startupCleanup() {
  try {
    const isPackaged = process.execPath.endsWith(".exe") && !process.execPath.includes("node");
    if (!isPackaged) return;
    const installDir = dirname(process.execPath);
    for (const f of readdirSync(installDir)) {
      const isOldExe = f === "ClankBuild.old.exe" || f === "LlamaTalkBuild.old.exe";
      const isOldStandalone = (f.startsWith("ClankBuild_") || f.startsWith("LlamaTalkBuild_")) && f.endsWith(".exe") && !f.includes(VERSION);
      const isOldSetup = (f.startsWith("Clank Build_") || f.startsWith("LlamaTalk Build_")) && f.endsWith("_setup.exe") && !f.includes(VERSION);
      if (isOldExe || isOldStandalone || isOldSetup) {
        try { unlinkSync(join(installDir, f)); } catch { /* still locked */ }
      }
    }
  } catch { /* non-critical */ }
}

// ---------------------------------------------------------------------------
// CLI argument parser
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const opts = {
    version: false,
    help: false,
    noBanner: false,
    noMemory: false,
    model: null,
    trust: false,
    continue: false,
    compact: false,
    telegram: false,
    pin: null,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--version": case "-v":
        opts.version = true; break;
      case "--help": case "-h":
        opts.help = true; break;
      case "--no-banner":
        opts.noBanner = true; break;
      case "--no-memory":
        opts.noMemory = true; break;
      case "--model": case "-m":
        opts.model = argv[++i] ?? null; break;
      case "--trust":
        opts.trust = true; break;
      case "--continue": case "-c":
        opts.continue = true; break;
      case "--compact":
        opts.compact = true; break;
      case "--telegram":
        opts.telegram = true; break;
      case "--pin":
        opts.pin = argv[++i] ?? null; break;
    }
  }
  return opts;
}

function printHelp() {
  console.log(`
${ORANGE}${BOLD}Clank Build${RESET} v${VERSION}  —  Agentic coding from the terminal

${BOLD}Usage${RESET}
  clankbuild [options]

${BOLD}Options${RESET}
  ${ORANGE}-v, --version${RESET}             Print version and exit
  ${ORANGE}-h, --help${RESET}                Print this help and exit
  ${ORANGE}-m, --model <name>${RESET}        Use a specific model for this session
  ${ORANGE}-c, --continue${RESET}            Resume last conversation
  ${ORANGE}    --compact${RESET}             Reduced output (no thinking indicators)
  ${ORANGE}    --no-memory${RESET}           Disable memory injection for this session
  ${ORANGE}    --no-banner${RESET}           Skip the banner
  ${ORANGE}    --trust${RESET}               Auto-approve all tool confirmations
  ${ORANGE}    --telegram${RESET}            Start as Telegram bot (long-running)
  ${ORANGE}    --pin <pin>${RESET}           Provide PIN non-interactively (for --telegram)

${BOLD}Slash commands${RESET}
  /help       Full command reference
  /home       Show dashboard
  /mode       Show/switch agent mode (Build/Plan/Q&A/Manage)
  /instructions  Show loaded agent instructions
  /model      Show/switch model
  /models     List available models
  /agent      Manage agents (list, create, enable, disable)
  /session    Manage sessions (list, new, load, delete)
  /telegram   Manage Telegram bot settings
  /more       Show full details of last tool call(s)
  /memory     Manage memories
  /tools      List available tools
  /context    Show context usage
  /settings   Show current config
  /clear      Clear conversation
  /undo       Undo last file change
  /diff       Show all session changes
  /update     Pull latest & rebuild from GitHub
  /quit       Exit
`);
}

// ---------------------------------------------------------------------------
// Dashboard data helpers
// ---------------------------------------------------------------------------
function loadDashboardData(config) {
  const data = { tasks: null, activity: null, memoryStats: null };

  // Tasks
  try {
    const tm = new TaskManager();
    data.tasks = tm.list();
  } catch { /* */ }

  // Memory stats
  try {
    const memDir = getMemoryDir();
    if (existsSync(memDir)) {
      const files = readdirSync(memDir).filter((f) => f.endsWith(".md"));
      const topicCount = files.filter((f) => f !== "MEMORY.md" && f !== "sessions.md").length;
      const hasLessons = files.includes("lessons.md");
      let lessonsCount = 0;
      if (hasLessons) {
        try {
          const content = readFileSync(join(memDir, "lessons.md"), "utf8");
          lessonsCount = (content.match(/^- /gm) || []).length;
        } catch { /* */ }
      }
      data.memoryStats = {
        enabled: config.memoryEnabled !== false,
        topicCount,
        hasLessons,
        lessonsCount,
      };
    }
  } catch { /* */ }

  return data;
}

// ---------------------------------------------------------------------------
// PIN authentication
// ---------------------------------------------------------------------------
async function authenticate(config) {
  if (!pinRequired(config)) return null;

  console.log(ORANGE + "\nClank Build" + DIM + `  v${VERSION}` + RESET);

  let attempts = 0;
  const maxAttempts = 5;
  const LOCKOUT_DELAYS = [0, 0, 5000, 15000, 30000]; // progressive delays

  while (attempts < maxAttempts) {
    // Apply progressive lockout delay after repeated failures
    if (attempts > 0 && LOCKOUT_DELAYS[attempts]) {
      const secs = LOCKOUT_DELAYS[attempts] / 1000;
      console.log(DIM + `  Locked out for ${secs}s...` + RESET);
      await new Promise((r) => setTimeout(r, LOCKOUT_DELAYS[attempts]));
    }

    const pin = await askMasked(BOLD + "Enter PIN: " + RESET);
    if (verifyPin(pin, config.pinHash)) {
      if (needsPinMigration(config.pinHash)) {
        config.pinHash = hashPin(pin);
      }
      config.lastUnlockTime = new Date().toISOString();
      saveConfig(config);
      return pin;
    }
    attempts++;
    if (attempts < maxAttempts) {
      console.log(RED + `  Incorrect PIN. ${maxAttempts - attempts} attempt(s) remaining.` + RESET);
    }
  }

  console.log(RED + "  Too many incorrect attempts. Exiting." + RESET);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  startupCleanup();
  const args = parseArgs(process.argv.slice(2));

  if (args.version) {
    console.log(`v${VERSION}`);
    process.exit(0);
  }

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  let config = loadConfig();

  // Version check for re-onboarding
  if (config.onboardingDone && (!config.appVersion || config.appVersion !== VERSION)) {
    config.onboardingComplete = false;
    config.appVersion = VERSION;
    saveConfig(config);
  }

  // Apply CLI overrides
  if (args.model) config.selectedModel = args.model;
  if (args.trust) {
    config.autoApprove = { low: true, medium: true, high: true };
  }

  // Detect backend type in background
  const backendCheckPromise = detectBackend(config.ollamaUrl).catch(() => "ollama");

  // --- Telegram bot mode ---
  if (args.telegram) {
    // PIN handling for bot mode (non-interactive)
    let encKey = null;
    if (pinRequired(config)) {
      if (!args.pin) {
        console.error("Error: PIN is required. Use --pin <pin> with --telegram.");
        process.exit(1);
      }
      if (!verifyPin(args.pin, config.pinHash)) {
        console.error("Error: Incorrect PIN.");
        process.exit(1);
      }
      if (!config.encKeySalt) {
        config.encKeySalt = generateEncKeySalt();
        saveConfig(config);
      }
      encKey = deriveEncKey(args.pin, config.encKeySalt);
      config = decryptApiKeys(config, encKey);
    }

    const { startTelegramBot } = await import("./src/telegram/bot.js");
    await startTelegramBot(config, encKey);
    return;
  }

  // Interactive mode
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  rl.on("close", () => process.exit(0));

  if (isFirstRun(config)) {
    const encKey = await runOnboarding(rl, config);
    saveConfigWithKey(config, encKey);
    await runAgent(rl, config, encKey, { version: VERSION, ...args });
    return;
  }

  const pin = await authenticate(config);

  // Derive encryption key from PIN if available
  let encKey = null;
  if (pin && config.pinHash) {
    if (!config.encKeySalt) {
      config.encKeySalt = generateEncKeySalt();
      saveConfig(config);
    }
    encKey = deriveEncKey(pin, config.encKeySalt);
    config = decryptApiKeys(config, encKey);
  }

  // Collect backend detection
  const detectedBackend = await Promise.race([
    backendCheckPromise,
    new Promise((r) => setTimeout(() => r("ollama"), 3000)),
  ]);
  if (detectedBackend && detectedBackend !== "unknown") {
    config.backendType = detectedBackend;
  }

  // Auto-detect model on startup — but preserve the user's saved choice
  const userExplicitModel = !!args.model;
  if (!userExplicitModel) {
    try {
      const result = await getAllLocalModels(config);
      config.modelServerMap = result.modelServerMap;
      config.serverBackendMap = result.serverBackendMap;

      const visible = result.allModels.filter((m) => !(config.hiddenModels || []).includes(m));
      const visibleRunning = visible.filter((m) => result.runningModels.has(m));

      // Check if the saved model is a cloud model (always available) or still present locally
      const allCloudModels = Object.values(CLOUD_MODELS).flat();
      const savedIsCloud = allCloudModels.includes(config.selectedModel);
      const savedIsAvailable = visible.includes(config.selectedModel);

      // Only auto-detect if there's no saved model, or if saved model is a local model that's gone
      if (!config.selectedModel || (!savedIsCloud && !savedIsAvailable)) {
        let autoDetected = null;
        if (visibleRunning.length > 0) {
          autoDetected = visibleRunning[0];
        } else if (visible.length > 0) {
          autoDetected = visible[0];
        }

        if (autoDetected) {
          config.selectedModel = autoDetected;
          saveConfig(config);
        }
      }
    } catch { /* server not running */ }
  }

  if (!args.noBanner) {
    const sm = new SessionManager();
    const recentSessions = sm.list().slice(0, 3);
    const dashData = loadDashboardData(config);

    // First launch liability notice (condensed)
    if (config.onboardingComplete === false) {
      console.log(YELLOW + "\n  ⚠ Clank Build can read, write, delete files and execute commands." + RESET);
      console.log(DIM + "  Review agent actions carefully. Use MEDIUM/HIGH safety levels.\n" + RESET);
    }

    printBanner(VERSION, {
      model: config.selectedModel,
      mode: "build",
      provider: config.backendType,
      cwd: process.cwd(),
      sessions: recentSessions,
      tasks: dashData.tasks,
      memoryStats: dashData.memoryStats,
    });
  }

  await runAgent(rl, config, encKey, { version: VERSION, ...args });
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
