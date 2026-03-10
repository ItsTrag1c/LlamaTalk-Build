import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";
import { hashPin, generateEncKeySalt, deriveEncKey, getMemoryDir, saveConfig } from "./config.js";
import { detectBackend, getOllamaModels, getOpenAICompatModels, CLOUD_MODELS } from "./providers/router.js";
import { MemoryManager } from "./memory/memory.js";
import { printBanner } from "./ui/banner.js";
import { ORANGE, GREEN, YELLOW, RED, RESET, BOLD, DIM } from "./ui/ui.js";
import { askMasked } from "./ui/ui.js";

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

export async function runOnboarding(rl, config) {
  printBanner();

  console.log(ORANGE + BOLD + "Welcome to LlamaTalk Build!" + RESET);
  console.log(DIM + "Let's get you set up. This only takes a moment.\n" + RESET);

  // Step 1: Name
  const name = await ask(rl, BOLD + "What's your name? " + RESET);
  config.profileName = name.trim() || "User";
  console.log(GREEN + `  Nice to meet you, ${config.profileName}!` + RESET + "\n");

  // Step 2: Name the agent
  const agentNameInput = await ask(rl, BOLD + "Name your agent " + RESET + DIM + "(e.g., Atlas, Nova, Sage — Enter for default): " + RESET);
  const agentName = agentNameInput.trim() || "Build Agent";
  config.agentName = agentName;
  console.log(GREEN + `  Your agent is now "${agentName}".` + RESET + "\n");

  // Step 3: PIN
  let encKey = null;
  const wantPin = await ask(rl, BOLD + "Set a PIN to protect your config? (y/n): " + RESET);
  if (wantPin.trim().toLowerCase() === "y") {
    let pinOk = false;
    while (!pinOk) {
      const pin1 = await askMasked(BOLD + "  Enter PIN: " + RESET);
      const pin2 = await askMasked(BOLD + "  Confirm PIN: " + RESET);
      if (pin1.length < 4) {
        console.log(RED + "  PIN must be at least 4 characters." + RESET);
      } else if (pin1 !== pin2) {
        console.log(RED + "  PINs don't match, try again." + RESET);
      } else {
        config.pinHash = hashPin(pin1);
        config.encKeySalt = generateEncKeySalt();
        encKey = deriveEncKey(pin1, config.encKeySalt);
        pinOk = true;
        console.log(GREEN + "  PIN set!" + RESET + "\n");
      }
    }
  } else {
    console.log(DIM + "  Skipped — you can set a PIN later with /set pin\n" + RESET);
  }

  // Step 3: Local server URL
  const urlInput = await ask(
    rl,
    BOLD + `Local server URL [${config.ollamaUrl}]: ` + RESET
  );
  if (urlInput.trim()) {
    config.ollamaUrl = urlInput.trim().replace(/\/$/, "");
  }

  // Step 4: Test server connection
  process.stdout.write(DIM + "  Testing server connection..." + RESET);
  let ollamaModels = [];
  try {
    const bt = await detectBackend(config.ollamaUrl);
    if (bt === "openai-compatible") {
      ollamaModels = await getOpenAICompatModels(config.ollamaUrl);
    } else {
      ollamaModels = await getOllamaModels(config.ollamaUrl);
    }
    if (bt !== "unknown") config.backendType = bt;
    process.stdout.write("\r" + GREEN + "  Server connected! " + ollamaModels.length + " model(s) found." + RESET + "\n\n");
  } catch (err) {
    process.stdout.write("\r" + YELLOW + "  Could not connect to server: " + err.message + RESET + "\n");
    console.log(DIM + "  You can update the URL later with /set server-url <url>\n" + RESET);
  }

  // Step 5: Cloud API keys
  const wantCloud = await ask(rl, BOLD + "Add cloud API keys? (y/n): " + RESET);
  if (wantCloud.trim().toLowerCase() === "y") {
    console.log(DIM + "  Press Enter to skip a provider.\n" + RESET);

    const anthropicKey = await ask(rl, "  Anthropic API key: ");
    if (anthropicKey.trim()) {
      config.apiKey_anthropic = anthropicKey.trim();
      config.enabledProviders.anthropic = true;
      console.log(GREEN + "  Anthropic enabled." + RESET);
    }

    const googleKey = await ask(rl, "  Google API key: ");
    if (googleKey.trim()) {
      config.apiKey_google = googleKey.trim();
      config.enabledProviders.google = true;
      console.log(GREEN + "  Google enabled." + RESET);
    }

    const openaiKey = await ask(rl, "  OpenAI API key: ");
    if (openaiKey.trim()) {
      config.apiKey_openai = openaiKey.trim();
      config.enabledProviders.openai = true;
      console.log(GREEN + "  OpenAI enabled." + RESET);
    }

    const opencodeKey = await ask(rl, "  OpenCode API key: ");
    if (opencodeKey.trim()) {
      config.apiKey_opencode = opencodeKey.trim();
      config.enabledProviders.opencode = true;
      console.log(GREEN + "  OpenCode enabled." + RESET);
    }

    console.log("");
  } else {
    console.log(DIM + "  Skipped — add keys later with /set api-key <provider> <key>\n" + RESET);
  }

  // Step 6: Select default model
  const allModels = buildModelList(ollamaModels, config);

  if (allModels.length === 0) {
    console.log(YELLOW + "  No models available. Set a model later with /model <name>" + RESET + "\n");
  } else {
    console.log(BOLD + "Available models:" + RESET);
    allModels.forEach((m, i) => {
      console.log(`  ${ORANGE}${i + 1}.${RESET} ${m}`);
    });
    console.log("");

    let selectedIdx = -1;
    while (selectedIdx < 0) {
      const choice = await ask(rl, BOLD + "Select default model (number): " + RESET);
      const n = parseInt(choice.trim(), 10);
      if (n >= 1 && n <= allModels.length) {
        selectedIdx = n - 1;
      } else {
        console.log(RED + "  Invalid choice." + RESET);
      }
    }
    config.selectedModel = allModels[selectedIdx];
    console.log(GREEN + `\n  Default model set to: ${config.selectedModel}` + RESET + "\n");
  }

  // Step 7: Set up memory system
  console.log(BOLD + "Memory system:" + RESET);
  const memDir = getMemoryDir();
  if (!existsSync(memDir)) {
    mkdirSync(memDir, { recursive: true });
  }
  const memFile = join(memDir, "MEMORY.md");
  if (!existsSync(memFile)) {
    const defaultMemory = `# Memory\n\n## User\n- Name: ${config.profileName}\n\n## Preferences\n(The agent will save your preferences here as it learns them.)\n\n## Projects\n(Project-specific notes will be saved here.)\n`;
    writeFileSync(memFile, defaultMemory, "utf8");
    console.log(GREEN + "  Memory initialized!" + RESET);
  } else {
    console.log(GREEN + "  Memory already set up." + RESET);
  }
  console.log(DIM + "  LlamaTalk Build remembers your preferences and patterns across sessions." + RESET);
  console.log(DIM + "  Use /memory to manage memories.\n" + RESET);

  // Step 8: Get to Know You
  console.log(BOLD + "\nOne last thing" + RESET + DIM + " — I'd like to get to know you a bit so I can be more helpful." + RESET);
  console.log(DIM + "Press Enter to skip any question.\n" + RESET);

  // Liability notice (condensed)
  console.log(YELLOW + "  ⚠ LlamaTalk Build can read, write, delete files and execute commands." + RESET);
  console.log(DIM + "  Review agent actions carefully. Use MEDIUM/HIGH safety levels.\n" + RESET);

  const memory = new MemoryManager(config, encKey);

  const q1 = await ask(rl, BOLD + "What's your go-to programming language or stack? " + RESET);
  if (q1.trim()) {
    memory.appendLesson("about_you", `Preferred language/stack: ${q1.trim()}`);
  } else {
    console.log(DIM + "  No worries, we can do this later with /reflect!\n" + RESET);
    config.onboardingDone = true;
    config.onboardingComplete = true;
    config.appVersion = "2.3.0";
    console.log(ORANGE + BOLD + "All set! Starting LlamaTalk Build...\n" + RESET);
    return encKey;
  }

  const q2 = await ask(rl, BOLD + "How do you prefer explanations — brief or detailed? " + RESET);
  if (q2.trim()) {
    memory.appendLesson("about_you", `Explanation preference: ${q2.trim()}`);
  }

  const q3 = await ask(rl, BOLD + "What kind of projects do you usually work on? " + RESET);
  if (q3.trim()) {
    memory.appendLesson("about_you", `Typical projects: ${q3.trim()}`);
  }

  const q4 = await ask(rl, BOLD + "Anything else you'd like me to know? " + RESET + DIM + "(optional) " + RESET);
  if (q4.trim()) {
    memory.appendLesson("about_you", `Additional: ${q4.trim()}`);
  }

  console.log(GREEN + "\n  Got it! I'll keep these in mind. You can update anytime with /reflect." + RESET);

  // Step 9: Telegram opt-in
  console.log("");
  const wantTelegram = await ask(rl, BOLD + "Connect LlamaTalk Build to Telegram? " + RESET + DIM + "(y/N) " + RESET);
  if (wantTelegram.trim().toLowerCase() === "y") {
    console.log(DIM + "  Messages will route through Telegram's servers.\n" + RESET);
    const botToken = await ask(rl, "  Bot token from @BotFather: ");
    if (botToken.trim()) {
      config.telegramBotToken = botToken.trim();
      // Generate access code for bot authentication
      const code = randomBytes(4).toString("hex");
      config.telegramAccessCode = code;
      console.log(GREEN + "  Token saved." + RESET);
      console.log(`  Access code: ${ORANGE}${code}${RESET}`);
      console.log(DIM + "  Send this code to the bot on Telegram to authenticate." + RESET);
      console.log(DIM + `\n  Start the bot with: llamabuild --telegram${config.pinHash ? " --pin <pin>" : ""}` + RESET);
    } else {
      console.log(DIM + "  Skipped — set up later with /telegram token <token>" + RESET);
    }
  } else {
    console.log(DIM + "  Skipped — set up later with /telegram" + RESET);
  }

  // Done
  config.onboardingDone = true;
  config.onboardingComplete = true;
  config.appVersion = "2.3.0";
  console.log(ORANGE + BOLD + "\nAll set! Starting LlamaTalk Build...\n" + RESET);
  return encKey;
}

function buildModelList(ollamaModels, config) {
  const models = [...ollamaModels.filter((m) => !config.hiddenModels.includes(m))];
  for (const [provider, list] of Object.entries(CLOUD_MODELS)) {
    if (config.enabledProviders[provider]) {
      models.push(...list);
    }
  }
  return models;
}
