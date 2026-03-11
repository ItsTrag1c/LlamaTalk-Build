/**
 * Clank Build — Telegram Bot
 *
 * Connects the AgentEngine to Telegram as an I/O layer.
 * Each allowed user gets their own AgentEngine instance.
 * Agent runs locally; Telegram is just the transport.
 */
import { Bot, InlineKeyboard } from "grammy";
import { ThrottledEditor, toTelegramHtml, splitMessage, formatToolStart, formatToolResult } from "./renderer.js";

// Import from the engine package (linked via file: dependency)
import { AgentEngine, SessionManager, getAllLocalModels, CLOUD_MODELS } from "clankbuild-engine";
import { loadConfig, saveConfig as _saveConfig } from "../config.js";

// Escape HTML entities to prevent injection in Telegram HTML messages
function esc(str) {
  if (!str) return str || "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Safe save: reload config from disk first, then merge only the telegram fields.
// This prevents writing decrypted API keys (which live in the in-memory config) back to disk.
function saveTelegramConfig(allowedUsers, accessCode) {
  const diskConfig = loadConfig();
  diskConfig.telegramAllowedUsers = [...allowedUsers];
  if (accessCode !== undefined) diskConfig.telegramAccessCode = accessCode;
  _saveConfig(diskConfig);
}

const MODE_LABELS = {
  build: "🔨 Build",
  plan: "📋 Plan",
  qa: "💭 Q&A",
  manage: "◈ Manage",
};

/**
 * Start the Telegram bot.
 * @param {object} config — decrypted config
 * @param {Buffer|null} encKey — encryption key for conversations
 */
export async function startTelegramBot(config, encKey) {
  const token = config.telegramBotToken;
  if (!token) {
    console.error("Error: No Telegram bot token configured.");
    console.error("Set one with: clankbuild /telegram token <token>");
    process.exit(1);
  }

  const allowedUsers = new Set((config.telegramAllowedUsers || []).map(Number));

  const bot = new Bot(token);

  // Patch grammy's handleUpdates to prevent non-BotError crashes from stopping polling.
  // grammy's default behavior: if handleUpdate throws a non-BotError, it rethrows and
  // kills the polling loop. We override to catch ALL errors and route them through errorHandler.
  const _origHandleUpdates = bot.handleUpdates.bind(bot);
  bot.handleUpdates = async function(updates) {
    try {
      await _origHandleUpdates(updates);
    } catch (err) {
      console.error("   [Telegram] Caught fatal polling error (prevented disconnect):", err?.message || err);
    }
  };

  // Per-user main engine instances
  const engines = new Map();
  // Per-user sub-agent engine instances: Map<userId, Map<agentId, AgentEngine>>
  const subEngines = new Map();
  // Pending confirmations — keyed by globally unique promptId
  const pendingConfirms = new Map();
  // Per-user throttled editors
  const editors = new Map();
  // Per-user-per-agent busy lock: Map<userId, Set<agentId>>
  // "main" is the key for the manager agent
  const busyAgents = new Map();
  // Global prompt counter — never resets, so IDs are unique across all requests
  let globalPromptCounter = 0;

  function isAgentBusy(userId, agentId = "main") {
    return busyAgents.get(userId)?.has(agentId) || false;
  }

  function setAgentBusy(userId, agentId = "main") {
    if (!busyAgents.has(userId)) busyAgents.set(userId, new Set());
    busyAgents.get(userId).add(agentId);
  }

  function clearAgentBusy(userId, agentId = "main") {
    busyAgents.get(userId)?.delete(agentId);
  }

  function getEngine(userId) {
    if (engines.has(userId)) return engines.get(userId);

    const engine = new AgentEngine(config, {
      encKey,
      projectRoot: process.cwd(),
    });

    // Create initial session
    engine.createSession(process.cwd());
    engines.set(userId, engine);
    return engine;
  }

  /** Get or create a dedicated engine instance for a sub-agent. */
  function getSubEngine(userId, subAgentDef) {
    if (!subEngines.has(userId)) subEngines.set(userId, new Map());
    const userSubs = subEngines.get(userId);

    if (userSubs.has(subAgentDef.id)) return userSubs.get(subAgentDef.id);

    // Build config with model override if specified
    const subConfig = { ...config };
    if (subAgentDef.model) {
      subConfig.selectedModel = subAgentDef.model;
    }

    const engine = new AgentEngine(subConfig, {
      encKey,
      projectRoot: process.cwd(),
      subAgentDef,
    });

    engine.createSession(process.cwd());
    userSubs.set(subAgentDef.id, engine);
    return engine;
  }

  function getEditor(chatId) {
    if (editors.has(chatId)) return editors.get(chatId);
    const editor = new ThrottledEditor(bot, chatId);
    editors.set(chatId, editor);
    return editor;
  }

  // Access code for authenticating new users
  const accessCode = config.telegramAccessCode || "";

  // Brute-force protection: track failed access code attempts per user
  const authAttempts = new Map(); // userId -> { count, lastAttempt }
  const MAX_AUTH_ATTEMPTS = 5;
  const AUTH_LOCKOUT_MS = 5 * 60 * 1000; // 5 minute lockout

  // --- Auth middleware ---
  bot.use(async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    // Already authorized
    if (allowedUsers.has(userId)) {
      return next();
    }

    // No allowed users yet and no access code — first user auto-registers
    if (allowedUsers.size === 0 && !accessCode) {
      allowedUsers.add(userId);
      try { saveTelegramConfig(allowedUsers); } catch (e) { console.error("   Failed to save config:", e.message); }
      console.log(`   Auto-registered first user: ${userId}`);
      return next();
    }

    // Check brute-force lockout
    const attempts = authAttempts.get(userId);
    if (attempts && attempts.count >= MAX_AUTH_ATTEMPTS) {
      const elapsed = Date.now() - attempts.lastAttempt;
      if (elapsed < AUTH_LOCKOUT_MS) {
        // Silently ignore — don't reveal lockout timing to attacker
        return;
      }
      // Lockout expired, reset
      authAttempts.delete(userId);
    }

    // Check if the message is an access code attempt
    const text = ctx.message?.text?.trim();
    if (text && accessCode && text === accessCode) {
      authAttempts.delete(userId);
      allowedUsers.add(userId);
      try { saveTelegramConfig(allowedUsers); } catch (e) { console.error("   Failed to save config:", e.message); }
      console.log(`   User ${userId} authenticated via access code.`);
      await ctx.reply(
        "Access code accepted! You're now authorized.\n\n" +
        "Send me a message to get started, or type /start for help.",
      );
      return;
    }

    // Track failed attempt
    if (text && accessCode) {
      const prev = authAttempts.get(userId) || { count: 0, lastAttempt: 0 };
      prev.count++;
      prev.lastAttempt = Date.now();
      authAttempts.set(userId, prev);
      console.log(`   Failed auth attempt from ${userId} (${prev.count}/${MAX_AUTH_ATTEMPTS})`);
    }

    // Unauthorized — prompt for access code
    if (accessCode) {
      await ctx.reply(
        "This bot requires an access code.\n\n" +
        "Send the access code to authenticate.",
      );
    } else {
      await ctx.reply(
        "Sorry, this bot is not accepting new users.\n" +
        "Ask the bot owner to generate an access code.",
      );
    }
  });

  // --- Commands ---

  bot.command("start", async (ctx) => {
    const agentName = esc(config.agentName || "Clank Build");
    const name = esc(config.profileName || "there");
    await ctx.reply(
      `👋 Hey ${name}! I'm <b>${agentName}</b>, your coding agent.\n\n` +
      `<b>Commands:</b>\n` +
      `/new — Start a new session\n` +
      `/clear — Clear conversation history\n` +
      `/sessions — List recent sessions\n` +
      `/clearsessions — Delete all sessions\n` +
      `/mode — Switch mode (Build/Plan/Q&A/Manage)\n` +
      `/model — Show or set model\n` +
      `/models — List all available models\n` +
      `/agents — List & manage sub-agents\n` +
      `/agent create|remove|rename — Manage agents\n` +
      `/status — Show agent status\n` +
      `/cancel — Stop all agents\n` +
      `/cancel &lt;name&gt; — Stop a specific agent\n\n` +
      `Mention a sub-agent: <code>@AgentName task</code>\n` +
      `Just send me a message and I'll start working!`,
      { parse_mode: "HTML" }
    );
  });

  bot.command("new", async (ctx) => {
    const userId = ctx.from.id;
    const engine = getEngine(userId);
    engine.createSession(process.cwd());
    await ctx.reply("✨ New session started.");
  });

  bot.command("sessions", async (ctx) => {
    const sm = new SessionManager();
    const sessions = sm.list().slice(0, 8);
    if (sessions.length === 0) {
      await ctx.reply("No sessions yet. Send a message to start one!");
      return;
    }

    let text = "<b>Recent Sessions:</b>\n\n";
    sessions.forEach((s, i) => {
      const date = new Date(s.lastUsed || s.created).toLocaleDateString();
      text += `${i + 1}. ${esc(s.title || "Untitled")} <i>(${esc(date)})</i>\n`;
    });

    const keyboard = new InlineKeyboard();
    sessions.forEach((s, i) => {
      keyboard
        .text(`📂 ${i + 1}`, `load_session:${s.id}`)
        .text(`🗑️`, `delete_session:${s.id}`)
        .row();
    });
    keyboard.text("🗑️ Delete All", "delete_all_sessions");

    await ctx.reply(text, { parse_mode: "HTML", reply_markup: keyboard });
  });

  bot.command("clearsessions", async (ctx) => {
    const keyboard = new InlineKeyboard()
      .text("✅ Yes, delete all", "confirm_clear_sessions")
      .text("❌ Cancel", "cancel_clear_sessions");
    await ctx.reply("⚠️ <b>Delete all sessions?</b> This cannot be undone.", { parse_mode: "HTML", reply_markup: keyboard });
  });

  bot.command("mode", async (ctx) => {
    const userId = ctx.from.id;
    const engine = getEngine(userId);
    const current = engine.getMode();

    const keyboard = new InlineKeyboard()
      .text(current === "build" ? "🔨 Build ✓" : "🔨 Build", "set_mode:build")
      .text(current === "plan" ? "📋 Plan ✓" : "📋 Plan", "set_mode:plan")
      .row()
      .text(current === "qa" ? "💭 Q&A ✓" : "💭 Q&A", "set_mode:qa")
      .text(current === "manage" ? "◈ Manage ✓" : "◈ Manage", "set_mode:manage");

    await ctx.reply(`Current mode: ${MODE_LABELS[current]}`, { reply_markup: keyboard });
  });

  bot.command("model", async (ctx) => {
    const userId = ctx.from.id;
    const engine = getEngine(userId);
    const args = (ctx.match || "").trim();

    if (!args) {
      // /model — show current
      await ctx.reply(`Current model: <code>${esc(engine.getModel() || "none")}</code>`, { parse_mode: "HTML" });
    } else {
      // /model <name> — switch model
      const cfg = engine.getConfig();
      cfg.selectedModel = args;
      engine.setModel(args);
      await ctx.reply(`Model set to: <code>${esc(args)}</code>`, { parse_mode: "HTML" });
    }
  });

  bot.command("models", async (ctx) => {
    const userId = ctx.from.id;
    const engine = getEngine(userId);
    const cfg = engine.getConfig();
    const current = engine.getModel();

    let text = "<b>Available models:</b>\n\n";

    // Local models
    try {
      const result = await getAllLocalModels(cfg);
      cfg.modelServerMap = result.modelServerMap;
      cfg.serverBackendMap = result.serverBackendMap;
      const visible = result.allModels.filter((m) => !(cfg.hiddenModels || []).includes(m));
      for (const m of visible) {
        const running = result.runningModels.has(m);
        const isCurrent = m === current;
        text += `<code>${esc(m)}</code>${running ? " 🟢" : ""}${isCurrent ? " ◀" : ""}\n`;
      }
    } catch {
      text += "<i>Could not fetch local models.</i>\n";
    }

    // Cloud models
    for (const [provider, models] of Object.entries(CLOUD_MODELS)) {
      if (cfg.enabledProviders?.[provider]) {
        for (const m of models) {
          const isCurrent = m === current;
          text += `<code>${esc(m)}</code> <i>(${esc(provider)})</i>${isCurrent ? " ◀" : ""}\n`;
        }
      }
    }

    text += "\nUse <code>/model name</code> to switch.";
    await ctx.reply(text, { parse_mode: "HTML" });
  });

  bot.command("status", async (ctx) => {
    const userId = ctx.from.id;
    const engine = getEngine(userId);
    const mode = engine.getMode();
    const model = engine.getModel();
    const session = engine.currentSession;

    let text = `<b>Agent Status</b>\n\n`;
    text += `Model: <code>${esc(model || "none")}</code>\n`;
    text += `Mode: ${esc(MODE_LABELS[mode] || mode)}\n`;
    text += `Session: ${esc(session?.title || "none")}\n`;
    text += `CWD: <code>${esc(process.cwd())}</code>`;

    await ctx.reply(text, { parse_mode: "HTML" });
  });

  bot.command("cancel", async (ctx) => {
    const userId = ctx.from.id;
    const targetName = (ctx.match || "").trim();

    // /cancel <agent name> — cancel a specific agent only
    if (targetName) {
      const mainEngine = engines.get(userId) || getEngine(userId);
      const agentDef = mainEngine._findSubAgent(targetName);

      if (agentDef && subEngines.has(userId) && subEngines.get(userId).has(agentDef.id)) {
        const subEngine = subEngines.get(userId).get(agentDef.id);
        subEngine.cancel();
        const reverted = subEngine.revertCurrentTurn?.() || [];
        clearAgentBusy(userId, agentDef.id);
        subEngines.get(userId).delete(agentDef.id);

        let msg = `⛔ <b>${esc(agentDef.name)}</b> cancelled.`;
        if (reverted.length > 0) {
          msg += `\n\n🔄 Reverted ${reverted.length} file(s):\n` +
            reverted.map(f => `• <code>${esc(f.replace(/\\/g, "/").split("/").pop())}</code>`).join("\n");
        }
        await ctx.reply(msg, { parse_mode: "HTML" });
        return;
      }

      // Check if they meant the main agent by name
      const managerName = mainEngine.getAgentName?.() || "";
      if (managerName.toLowerCase() === targetName.toLowerCase()) {
        // Cancel main agent only (fall through to main cancel below, but not sub-agents)
        for (const [id, resolver] of pendingConfirms) { resolver(false); pendingConfirms.delete(id); }
        let revertedFiles = [];
        if (engines.has(userId)) {
          const engine = engines.get(userId);
          engine.cancel();
          revertedFiles = engine.revertCurrentTurn();
          engines.delete(userId);
        }
        clearAgentBusy(userId, "main");
        let msg = `⛔ <b>${esc(managerName)}</b> cancelled.`;
        if (revertedFiles.length > 0) {
          msg += `\n\n🔄 Reverted ${revertedFiles.length} file(s):\n` +
            revertedFiles.map(f => `• <code>${esc(f.replace(/\\/g, "/").split("/").pop())}</code>`).join("\n");
        }
        await ctx.reply(msg, { parse_mode: "HTML" });
        return;
      }

      await ctx.reply(`❌ No running agent named "${esc(targetName)}" found.`);
      return;
    }

    // /cancel (no args) — full stop: cancel ALL agents
    // Resolve all pending confirms/plan actions with false so engines unblock
    for (const [id, resolver] of pendingConfirms) {
      resolver(false);
      pendingConfirms.delete(id);
    }

    let revertedFiles = [];
    let cancelledAgents = [];

    // Cancel main agent
    if (engines.has(userId)) {
      const engine = engines.get(userId);
      const name = engine.getAgentName?.() || "Main";
      engine.cancel();
      revertedFiles.push(...engine.revertCurrentTurn());
      engines.delete(userId);
      if (isAgentBusy(userId, "main")) cancelledAgents.push(name);
    }
    clearAgentBusy(userId, "main");

    // Cancel all sub-agents
    if (subEngines.has(userId)) {
      for (const [agentId, subEngine] of subEngines.get(userId)) {
        const def = subEngine.subAgentDef;
        const name = def?.name || agentId;
        subEngine.cancel();
        revertedFiles.push(...(subEngine.revertCurrentTurn?.() || []));
        if (isAgentBusy(userId, agentId)) cancelledAgents.push(name);
        clearAgentBusy(userId, agentId);
      }
      subEngines.delete(userId);
    }

    // Cancel any pending agent creation flow
    if (pendingAgentCreate.has(userId)) {
      pendingAgentCreate.delete(userId);
    }

    let msg = "⛔ <b>All operations cancelled.</b>";
    if (cancelledAgents.length > 0) {
      msg += `\n\nStopped: ${cancelledAgents.map(n => `<b>${esc(n)}</b>`).join(", ")}`;
    }
    if (revertedFiles.length > 0) {
      msg += `\n\n🔄 Reverted ${revertedFiles.length} file(s):\n` +
        revertedFiles.map(f => `• <code>${esc(f.replace(/\\/g, "/").split("/").pop())}</code>`).join("\n");
    }
    await ctx.reply(msg, { parse_mode: "HTML" });
  });

  // --- Agent creation conversation state ---
  // Multi-step flow: user sends /agent create <name>, then replies with role, model, tools
  const pendingAgentCreate = new Map(); // Map<userId, { step, name, role, model }>

  function buildAgentsMessage(engine) {
    const name = engine.getAgentName();
    const subs = engine.getSubAgents();
    let msg = `<b>Agents</b>\n\n🤖 <b>${esc(name)}</b> <i>(manager)</i>`;
    const keyboard = new InlineKeyboard();
    if (subs.length === 0) {
      msg += "\n\nNo sub-agents. Use <code>/agent create &lt;name&gt;</code> to add one.";
    } else {
      for (const a of subs) {
        const status = a.enabled !== false ? "✅" : "❌";
        const model = a.model ? ` <code>${esc(a.model)}</code>` : " <i>inherit</i>";
        const tools = a.tools ? ` (${a.tools.length} tools)` : " (all tools)";
        msg += `\n${status} <b>${esc(a.name)}</b> —${model}${tools}\n    <i>${esc(a.role)}</i>`;
      }
      msg += "\n\nMention a sub-agent: <code>@Name task</code>";
      for (const a of subs) {
        const label = a.enabled !== false ? `❌ ${a.name}` : `✅ ${a.name}`;
        keyboard.text(label, `agent_toggle:${a.id}`);
        keyboard.text(`🗑 ${a.name}`, `agent_remove:${a.id}`);
        keyboard.row();
      }
    }
    keyboard.text("➕ Create Agent", "agent_create_start");
    keyboard.text("✏️ Rename Manager", "agent_rename_start");
    return { msg, keyboard };
  }

  bot.command("agents", async (ctx) => {
    const engine = getEngine(ctx.from.id);
    const { msg, keyboard } = buildAgentsMessage(engine);
    await ctx.reply(msg, { parse_mode: "HTML", reply_markup: keyboard });
  });

  bot.command("agent", async (ctx) => {
    const userId = ctx.from.id;
    const engine = getEngine(userId);
    const argsText = (ctx.match || "").trim();
    const parts = argsText.split(/\s+/);
    const subCmd = parts[0]?.toLowerCase();
    const nameArg = parts.slice(1).join(" ").trim();

    if (!subCmd || subCmd === "list") {
      const { msg, keyboard } = buildAgentsMessage(engine);
      await ctx.reply(msg, { parse_mode: "HTML", reply_markup: keyboard });
      return;
    }

    if (subCmd === "create") {
      if (!nameArg) {
        await ctx.reply("Usage: <code>/agent create &lt;name&gt;</code>", { parse_mode: "HTML" });
        return;
      }
      const subs = engine.getSubAgents();
      if (subs.find((a) => a.name.toLowerCase() === nameArg.toLowerCase())) {
        await ctx.reply(`❌ An agent named "<b>${esc(nameArg)}</b>" already exists.`, { parse_mode: "HTML" });
        return;
      }
      pendingAgentCreate.set(userId, { step: "role", name: nameArg });
      await ctx.reply(
        `Creating sub-agent "<b>${esc(nameArg)}</b>".\n\n` +
        `<b>Step 1/3:</b> What is this agent's role?\n` +
        `<i>Describe what it specializes in (e.g., "Search and explore codebases")</i>`,
        { parse_mode: "HTML" }
      );
      return;
    }

    if (subCmd === "remove") {
      if (!nameArg) {
        await ctx.reply("Usage: <code>/agent remove &lt;name&gt;</code>", { parse_mode: "HTML" });
        return;
      }
      const removed = engine.removeSubAgent(nameArg);
      if (!removed) {
        await ctx.reply(`❌ No agent named "${esc(nameArg)}" found.`);
      } else {
        const diskConfig = loadConfig();
        diskConfig.subAgents = engine.getSubAgents();
        _saveConfig(diskConfig);
        await ctx.reply(`🗑 Removed sub-agent "<b>${esc(removed.name)}</b>".`, { parse_mode: "HTML" });
      }
      return;
    }

    if (subCmd === "rename") {
      if (!nameArg) {
        await ctx.reply(`Current name: <b>${esc(engine.getAgentName())}</b>\n\nUsage: <code>/agent rename &lt;new name&gt;</code>`, { parse_mode: "HTML" });
        return;
      }
      engine.setAgentName(nameArg);
      const diskConfig = loadConfig();
      diskConfig.agentName = nameArg;
      _saveConfig(diskConfig);
      await ctx.reply(`✅ Manager agent renamed to "<b>${esc(nameArg)}</b>".`, { parse_mode: "HTML" });
      return;
    }

    if (subCmd === "enable") {
      if (!nameArg) { await ctx.reply("Usage: <code>/agent enable &lt;name&gt;</code>", { parse_mode: "HTML" }); return; }
      const found = engine.enableSubAgent(nameArg);
      if (!found) { await ctx.reply(`❌ No agent named "${esc(nameArg)}" found.`); return; }
      const diskConfig = loadConfig(); diskConfig.subAgents = engine.getSubAgents(); _saveConfig(diskConfig);
      await ctx.reply(`✅ "${esc(found.name)}" enabled.`);
      return;
    }

    if (subCmd === "disable") {
      if (!nameArg) { await ctx.reply("Usage: <code>/agent disable &lt;name&gt;</code>", { parse_mode: "HTML" }); return; }
      const found = engine.disableSubAgent(nameArg);
      if (!found) { await ctx.reply(`❌ No agent named "${esc(nameArg)}" found.`); return; }
      const diskConfig = loadConfig(); diskConfig.subAgents = engine.getSubAgents(); _saveConfig(diskConfig);
      await ctx.reply(`❌ "${esc(found.name)}" disabled.`);
      return;
    }

    await ctx.reply(
      `<b>Agent commands:</b>\n` +
      `/agent create &lt;name&gt;\n` +
      `/agent remove &lt;name&gt;\n` +
      `/agent enable &lt;name&gt;\n` +
      `/agent disable &lt;name&gt;\n` +
      `/agent rename &lt;new name&gt;\n` +
      `/agents — List all with buttons`,
      { parse_mode: "HTML" }
    );
  });

  // --- Callback queries (inline keyboard) ---

  bot.callbackQuery(/^agent_toggle:(.+)$/, async (ctx) => {
    const userId = ctx.from.id;
    const agentId = ctx.match[1];
    const engine = getEngine(userId);
    const agent = engine._findSubAgent(agentId);
    if (!agent) return ctx.answerCallbackQuery("Agent not found");
    if (agent.enabled !== false) {
      engine.disableSubAgent(agentId);
      await ctx.answerCallbackQuery(`${agent.name} disabled`);
    } else {
      engine.enableSubAgent(agentId);
      await ctx.answerCallbackQuery(`${agent.name} enabled`);
    }
    const diskConfig = loadConfig();
    diskConfig.subAgents = engine.getSubAgents();
    _saveConfig(diskConfig);
    // Refresh the agents list inline
    try {
      const { msg, keyboard } = buildAgentsMessage(engine);
      await ctx.editMessageText(msg, { parse_mode: "HTML", reply_markup: keyboard });
    } catch { /* edit may fail if message is too old */ }
  });

  bot.callbackQuery(/^agent_remove:(.+)$/, async (ctx) => {
    const userId = ctx.from.id;
    const agentId = ctx.match[1];
    const engine = getEngine(userId);
    const agent = engine._findSubAgent(agentId);
    if (!agent) return ctx.answerCallbackQuery("Agent not found");
    // Show confirmation
    const keyboard = new InlineKeyboard()
      .text(`✅ Yes, remove ${agent.name}`, `agent_remove_confirm:${agentId}`)
      .text("❌ Cancel", `agent_remove_cancel`);
    try {
      await ctx.answerCallbackQuery();
      await ctx.editMessageText(`⚠️ Remove sub-agent "<b>${esc(agent.name)}</b>"?\n\n<i>${esc(agent.role)}</i>`, { parse_mode: "HTML", reply_markup: keyboard });
    } catch { /* */ }
  });

  bot.callbackQuery(/^agent_remove_confirm:(.+)$/, async (ctx) => {
    const userId = ctx.from.id;
    const agentId = ctx.match[1];
    const engine = getEngine(userId);
    const removed = engine.removeSubAgent(agentId);
    if (!removed) return ctx.answerCallbackQuery("Agent not found");
    const diskConfig = loadConfig();
    diskConfig.subAgents = engine.getSubAgents();
    _saveConfig(diskConfig);
    // Also clean up any cached sub-engine
    if (subEngines.has(userId)) subEngines.get(userId).delete(agentId);
    await ctx.answerCallbackQuery(`${removed.name} removed`);
    try {
      const { msg, keyboard } = buildAgentsMessage(engine);
      await ctx.editMessageText(msg, { parse_mode: "HTML", reply_markup: keyboard });
    } catch { /* */ }
  });

  bot.callbackQuery("agent_remove_cancel", async (ctx) => {
    const engine = getEngine(ctx.from.id);
    try {
      await ctx.answerCallbackQuery("Cancelled");
      const { msg, keyboard } = buildAgentsMessage(engine);
      await ctx.editMessageText(msg, { parse_mode: "HTML", reply_markup: keyboard });
    } catch { /* */ }
  });

  bot.callbackQuery("agent_create_start", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply(
      `To create a sub-agent, use:\n<code>/agent create &lt;name&gt;</code>\n\n` +
      `Example: <code>/agent create Scout</code>`,
      { parse_mode: "HTML" }
    );
  });

  bot.callbackQuery("agent_rename_start", async (ctx) => {
    const engine = getEngine(ctx.from.id);
    await ctx.answerCallbackQuery();
    await ctx.reply(
      `Current name: <b>${esc(engine.getAgentName())}</b>\n\n` +
      `To rename: <code>/agent rename &lt;new name&gt;</code>`,
      { parse_mode: "HTML" }
    );
  });

  bot.callbackQuery(/^set_mode:(.+)$/, async (ctx) => {
    const userId = ctx.from.id;
    const newMode = ctx.match[1];
    if (!["build", "plan", "qa", "manage"].includes(newMode)) return ctx.answerCallbackQuery("Invalid mode");
    const engine = getEngine(userId);
    engine.setMode(newMode);
    await ctx.answerCallbackQuery(`Switched to ${MODE_LABELS[newMode]}`);
    await ctx.editMessageText(`Mode: ${MODE_LABELS[newMode]}`, { reply_markup: undefined });
  });

  bot.callbackQuery(/^load_session:([a-zA-Z0-9_-]+)$/, async (ctx) => {
    const userId = ctx.from.id;
    const sessionId = ctx.match[1];
    const engine = getEngine(userId);
    const result = engine.loadSession(sessionId);
    try {
      if (result) {
        await ctx.answerCallbackQuery("Session loaded");
        await ctx.editMessageText(`Loaded: ${esc(result.title || "Untitled")}`, { reply_markup: undefined });
      } else {
        await ctx.answerCallbackQuery("Session not found");
      }
    } catch { /* Telegram API error — non-fatal */ }
  });

  bot.callbackQuery("delete_all_sessions", async (ctx) => {
    const keyboard = new InlineKeyboard()
      .text("✅ Yes, delete all", "confirm_clear_sessions")
      .text("❌ Cancel", "cancel_clear_sessions");
    try {
      await ctx.answerCallbackQuery();
      await ctx.editMessageText("⚠️ <b>Delete all sessions?</b> This cannot be undone.", { parse_mode: "HTML", reply_markup: keyboard });
    } catch { /* non-fatal */ }
  });

  bot.callbackQuery("confirm_clear_sessions", async (ctx) => {
    const userId = ctx.from.id;
    const sm = new SessionManager();
    const count = sm.list().length;
    sm.deleteAll();
    // Reset the engine so it starts a fresh session
    if (engines.has(userId)) {
      engines.get(userId).createSession(process.cwd());
    }
    try {
      await ctx.answerCallbackQuery(`Deleted ${count} sessions`);
      await ctx.editMessageText(`🗑️ Deleted ${count} session${count !== 1 ? "s" : ""}. A new session has been started.`, { reply_markup: undefined });
    } catch { /* non-fatal */ }
  });

  bot.callbackQuery("cancel_clear_sessions", async (ctx) => {
    try {
      await ctx.answerCallbackQuery("Cancelled");
      await ctx.editMessageText("Session deletion cancelled.", { reply_markup: undefined });
    } catch { /* non-fatal */ }
  });

  bot.callbackQuery(/^delete_session:([a-zA-Z0-9_-]+)$/, async (ctx) => {
    const userId = ctx.from.id;
    const sessionId = ctx.match[1];
    const sm = new SessionManager();
    const session = sm.get(sessionId);
    if (session) {
      sm.delete(sessionId);
      // If deleting the current session, start a new one
      const engine = getEngine(userId);
      if (engine.conversationId === sessionId) {
        engine.createSession(process.cwd());
      }
      try {
        await ctx.answerCallbackQuery("Session deleted");
        await ctx.editMessageText(`🗑️ Deleted: ${esc(session.title || "Untitled")}`, { parse_mode: "HTML", reply_markup: undefined });
      } catch { /* non-fatal */ }
    } else {
      try { await ctx.answerCallbackQuery("Session not found"); } catch { /* */ }
    }
  });

  bot.callbackQuery(/^confirm:(.+):(.+)$/, async (ctx) => {
    const promptId = ctx.match[1];
    const action = ctx.match[2]; // approve, deny, always

    const resolver = pendingConfirms.get(promptId);
    if (resolver) {
      pendingConfirms.delete(promptId);
      const value = action === "approve" ? true : action === "always" ? "always" : false;
      try {
        resolver(value);
      } catch (err) {
        console.error("   [Telegram] Error resolving confirmation:", err.message || err);
      }
      const label = action === "approve" ? "✅ Approved" : action === "always" ? "✅ Always approve" : "❌ Denied";
      try {
        await ctx.answerCallbackQuery(label);
        await ctx.editMessageText(label, { reply_markup: undefined });
      } catch { /* Telegram API error — non-fatal */ }
    } else {
      try { await ctx.answerCallbackQuery("Expired"); } catch { /* */ }
    }
  });

  bot.callbackQuery(/^plan_action:(.+):(.+)$/, async (ctx) => {
    const promptId = ctx.match[1];
    const action = ctx.match[2]; // execute, keep_planning, edit

    const resolver = pendingConfirms.get(promptId);
    if (resolver) {
      pendingConfirms.delete(promptId);
      try {
        resolver(action === "execute" ? "yes" : action === "keep_planning" ? "keep_planning" : "edit");
      } catch (err) {
        console.error("   [Telegram] Error resolving plan action:", err.message || err);
      }
      const label = action === "execute" ? "▶️ Executing" : action === "keep_planning" ? "📋 Continue planning" : "✏️ Edit plan";
      try {
        await ctx.answerCallbackQuery(label);
        await ctx.editMessageText(label, { reply_markup: undefined });
      } catch { /* Telegram API error — non-fatal */ }
    } else {
      try { await ctx.answerCallbackQuery("Expired"); } catch { /* */ }
    }
  });

  // --- Message handling ---

  // Commands that have a meaningful Telegram equivalent we can handle directly
  const TELEGRAM_COMMANDS = {
    "/clear": async (ctx) => {
      const engine = getEngine(ctx.from.id);
      engine.clearMessages();
      await ctx.reply("✨ Conversation cleared.");
    },
    "/new": async (ctx) => {
      const engine = getEngine(ctx.from.id);
      engine.createSession(process.cwd());
      await ctx.reply("✨ New session started.");
    },
    "/trust": async (ctx) => {
      const engine = getEngine(ctx.from.id);
      const cfg = engine.getConfig();
      if (!cfg.autoApprove) cfg.autoApprove = {};
      cfg.autoApprove.medium = !cfg.autoApprove.medium;
      cfg.autoApprove.high = cfg.autoApprove.medium;
      await ctx.reply(cfg.autoApprove.medium ? "✅ Auto-approve enabled for this session." : "🔒 Auto-approve disabled.");
    },
  };

  bot.on("message:text", async (ctx) => {
    const userId = ctx.from.id;
    const chatId = ctx.chat.id;
    const text = ctx.message.text;

    // --- Multi-step agent creation flow ---
    if (pendingAgentCreate.has(userId)) {
      const state = pendingAgentCreate.get(userId);
      const input = text.trim();

      if (input.toLowerCase() === "/cancel") {
        pendingAgentCreate.delete(userId);
        await ctx.reply("❌ Agent creation cancelled.");
        return;
      }

      if (state.step === "role") {
        if (!input) { await ctx.reply("Role is required. Try again or /cancel."); return; }
        state.role = input;
        state.step = "model";
        await ctx.reply(
          `<b>Step 2/3:</b> Which model should <b>${esc(state.name)}</b> use?\n\n` +
          `Send a model name, or <b>skip</b> to inherit the manager's model.`,
          { parse_mode: "HTML" }
        );
        return;
      }

      if (state.step === "model") {
        state.model = (input.toLowerCase() === "skip" || !input) ? null : input;
        state.step = "tools";
        await ctx.reply(
          `<b>Step 3/3:</b> Which tools can <b>${esc(state.name)}</b> use?\n\n` +
          `Send a comma-separated list (e.g., <code>read_file,search_files,bash</code>), or <b>skip</b> for all tools.`,
          { parse_mode: "HTML" }
        );
        return;
      }

      if (state.step === "tools") {
        let tools = null;
        if (input.toLowerCase() !== "skip" && input) {
          tools = input.split(",").map((t) => t.trim()).filter(Boolean);
        }
        const engine = getEngine(userId);
        const newAgent = engine.addSubAgent({
          name: state.name,
          role: state.role,
          model: state.model,
          tools,
        });
        const diskConfig = loadConfig();
        diskConfig.subAgents = engine.getSubAgents();
        _saveConfig(diskConfig);
        pendingAgentCreate.delete(userId);

        const modelDisplay = newAgent.model || "inherit";
        const toolsDisplay = newAgent.tools ? newAgent.tools.join(", ") : "all";
        await ctx.reply(
          `✅ Created sub-agent "<b>${esc(newAgent.name)}</b>"\n\n` +
          `Role: <i>${esc(newAgent.role)}</i>\n` +
          `Model: <code>${esc(modelDisplay)}</code>\n` +
          `Tools: <code>${esc(toolsDisplay)}</code>\n\n` +
          `Mention with <code>@${esc(newAgent.name)} task</code> or use Manage mode to delegate.`,
          { parse_mode: "HTML" }
        );
        return;
      }
    }

    // Intercept CLI slash commands so they don't get sent to the LLM.
    const cmd = text.trim().split(/\s+/)[0].toLowerCase();
    if (cmd.startsWith("/")) {
      const handler = TELEGRAM_COMMANDS[cmd];
      if (handler) {
        await handler(ctx);
      } else {
        await ctx.reply(`The <code>${esc(cmd)}</code> command isn't available on Telegram.\n\nUse /start to see available commands.`, { parse_mode: "HTML" });
      }
      return;
    }

    // Check for @SubAgent mention — route to a dedicated sub-agent engine
    const atMatch = text.match(/^@(\S+)\s+([\s\S]+)/);
    if (atMatch) {
      const mainEngine = getEngine(userId);
      const subAgentDef = mainEngine._findSubAgent(atMatch[1]);
      if (subAgentDef && subAgentDef.enabled !== false) {
        const agentId = subAgentDef.id;

        // Per-agent busy check — allows concurrent agents
        if (isAgentBusy(userId, agentId)) {
          await ctx.reply(`⏳ <b>${esc(subAgentDef.name)}</b> is still working. Please wait.`, { parse_mode: "HTML" });
          return;
        }

        const subTask = atMatch[2].trim();
        console.log(`   [${userId}] → ${subAgentDef.name}: ${subTask.slice(0, 60)}${subTask.length > 60 ? "..." : ""}`);

        setAgentBusy(userId, agentId);
        const subEngine = getSubEngine(userId, subAgentDef);
        const modelLabel = subAgentDef.model ? ` (${subAgentDef.model})` : "";
        await ctx.reply(`🤖 <b>${esc(subAgentDef.name)}</b>${esc(modelLabel)} is working in the background...`, { parse_mode: "HTML" });

        // Sub-agents run silently — no streaming. Wire only confirmations and milestones.
        const ownedPromptIds = [];
        const subHandlers = {
          "confirm-needed": async ({ actions, resolve }) => {
            const promptId = `p${++globalPromptCounter}`;
            ownedPromptIds.push(promptId);
            pendingConfirms.set(promptId, resolve);
            const actionText = actions.map((a) => `• ${a}`).join("\n");
            const keyboard = new InlineKeyboard()
              .text("✅ Approve", `confirm:${promptId}:approve`)
              .text("❌ Deny", `confirm:${promptId}:deny`)
              .text("✅ Always", `confirm:${promptId}:always`);
            try {
              await bot.api.sendMessage(chatId,
                `⚠️ <b>${esc(subAgentDef.name)}</b> needs approval:\n\n${toTelegramHtml(actionText)}`,
                { parse_mode: "HTML", reply_markup: keyboard });
            } catch { /* */ }
          },
          // Sub-agents run fully in the background — no tool-by-tool updates.
          // Only confirmations surface. Final result sent on completion.
        };
        for (const [evt, handler] of Object.entries(subHandlers)) {
          subEngine.on(evt, handler);
        }

        // Run silently in the background, send final result on completion
        runSubAgentDetached(subEngine, subTask, userId, chatId, subAgentDef.name, bot, () => {
          for (const [evt, handler] of Object.entries(subHandlers)) {
            subEngine.removeListener(evt, handler);
          }
          for (const id of ownedPromptIds) pendingConfirms.delete(id);
          clearAgentBusy(userId, agentId);
        });
        return;
      }
    }

    // Main agent busy check
    if (isAgentBusy(userId, "main")) {
      await ctx.reply("⏳ Still working on your previous request. Please wait.");
      return;
    }

    console.log(`   [${userId}] Message: ${text.slice(0, 80)}${text.length > 80 ? "..." : ""}`);

    setAgentBusy(userId, "main");
    const engine = getEngine(userId);
    const editor = getEditor(chatId);
    editor.reset();

    const modeLabel = MODE_LABELS[engine.getMode()] || "🔨 Build";
    const thinkingMsg = await ctx.reply(`${modeLabel} — Thinking...`);
    editor.setMessageId(thinkingMsg.message_id);

    const cleanup = wireEngineEvents(engine, bot, chatId, editor, pendingConfirms, () => `p${++globalPromptCounter}`);

    // Run the engine in a detached async context so grammy's polling loop
    // stays free to process callback queries (confirmations, plan actions).
    runEngineDetached(engine, text, userId, chatId, editor, cleanup, bot, null, () => clearAgentBusy(userId, "main"));
  });

  // --- Global error handler (prevents unhandled errors from crashing the process) ---
  // CRITICAL: this handler must NEVER throw, or grammy will stop polling.
  bot.catch((err) => {
    try {
      const actual = err?.error || err;
      console.error("   [Telegram] Bot error:", actual?.message || String(actual));
      if (actual?.stack) console.error(actual.stack);
    } catch {
      console.error("   [Telegram] Bot error (could not format)");
    }
  });

  // --- Start bot ---

  console.log("🤖 Clank Build Telegram bot starting...");
  console.log(`   Allowed users: ${allowedUsers.size > 0 ? [...allowedUsers].join(", ") : "none yet"}`);
  console.log(`   Access code: ${accessCode || "none (first user auto-registers)"}`);
  console.log(`   Model: ${config.selectedModel || "none"}`);
  console.log(`   Mode: build`);
  console.log(`   CWD: ${process.cwd()}`);
  console.log("");
  console.log("   Press Ctrl+C to stop.");

  // Drop stale updates from before this boot so old messages (like a /clear
  // that crashed the previous run) don't replay and crash again in a loop.
  await bot.api.deleteWebhook({ drop_pending_updates: true });

  // Keep the bot alive — if bot.start() resolves unexpectedly, restart it
  while (true) {
    try {
      await bot.start({
        onStart: () => console.log("   ✅ Bot connected to Telegram."),
      });
      console.error("   ⚠️ bot.start() resolved unexpectedly — restarting polling...");
    } catch (err) {
      console.error("   ⚠️ bot.start() threw:", err.message || err);
      console.error("   Restarting polling in 3s...");
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

/**
 * Run the engine in a detached async context.
 * This allows grammy's polling loop to continue processing callback queries
 * (confirmations, plan actions) while the engine is running.
 */
async function runEngineDetached(engine, text, userId, chatId, editor, cleanup, bot, _unused, onComplete) {
  try {
    await engine.sendMessage(text);
  } catch (err) {
    console.error(`   [${userId}] Engine error:`, err.message || err);
    try {
      await bot.api.sendMessage(chatId, `❌ Error: ${err.message || err}`);
    } catch { /* */ }
  }

  await editor.flush();

  const finalContent = editor.getContent();
  if (finalContent) {
    try {
      const html = toTelegramHtml(finalContent);
      const chunks = splitMessage(html);
      if (chunks.length > 1) {
        for (let i = 1; i < chunks.length; i++) {
          await bot.api.sendMessage(chatId, chunks[i], { parse_mode: "HTML" });
        }
      }
    } catch (err) {
      console.error(`   [${userId}] Final send error:`, err.message || err);
    }
  }

  cleanup();
  if (onComplete) onComplete();
}

/**
 * Run a sub-agent silently in the background.
 * No live streaming — only sends the final result when done.
 */
async function runSubAgentDetached(engine, text, userId, chatId, agentName, bot, onComplete) {
  let finalResponse = "";

  // Capture the final response
  const onEnd = ({ text: t }) => { finalResponse = t || ""; };
  engine.on("response-end", onEnd);

  try {
    await engine.sendMessage(text);
  } catch (err) {
    console.error(`   [${userId}] Sub-agent error:`, err.message || err);
    try {
      await bot.api.sendMessage(chatId, `❌ <b>${esc(agentName)}</b> error: ${esc(err.message || String(err))}`, { parse_mode: "HTML" });
    } catch { /* */ }
  }

  engine.removeListener("response-end", onEnd);

  // Send the final result as a single message
  if (finalResponse) {
    try {
      const header = `✅ <b>${esc(agentName)}</b> finished:\n\n`;
      const html = header + toTelegramHtml(finalResponse);
      const chunks = splitMessage(html);
      for (const chunk of chunks) {
        await bot.api.sendMessage(chatId, chunk, { parse_mode: "HTML" });
      }
    } catch (err) {
      console.error(`   [${userId}] Sub-agent send error:`, err.message || err);
    }
  } else {
    try {
      await bot.api.sendMessage(chatId, `✅ <b>${esc(agentName)}</b> completed the task.`, { parse_mode: "HTML" });
    } catch { /* */ }
  }

  if (onComplete) onComplete();
}

/**
 * Wire engine events to Telegram message updates for a single request.
 * Returns a cleanup function to remove listeners.
 */
function wireEngineEvents(engine, bot, chatId, editor, pendingConfirms, getPromptId) {
  // Track promptIds created during this request so cleanup can remove orphans
  const ownedPromptIds = [];

  const handlers = {
    "thinking-start": () => {
      // Already showing "Thinking..." message
    },

    "thinking-stop": () => {
      // Will be replaced by actual content
    },

    "memory-loading": async ({ status }) => {
      if (status === "start") {
        editor.setContent("🧠");
      } else {
        editor.setContent("🤔 Thinking...");
      }
    },

    "response-start": () => {
      editor.setContent("");
    },

    "token": (data) => {
      editor.append(data.content);
    },

    "tool-start": async (data) => {
      const text = formatToolStart(data.name, data.arguments);
      try {
        await bot.api.sendMessage(chatId, text, { parse_mode: "HTML" });
      } catch { /* rate limit */ }
    },

    "tool-result": async (data) => {
      const text = formatToolResult(data.name, data.success, data.summary);
      try {
        await bot.api.sendMessage(chatId, text, { parse_mode: "HTML" });
      } catch { /* rate limit */ }
    },

    "confirm-needed": async ({ actions, resolve }) => {
      const promptId = getPromptId();
      ownedPromptIds.push(promptId);
      pendingConfirms.set(promptId, resolve);

      const actionText = actions.map((a) => `• ${a}`).join("\n");
      const keyboard = new InlineKeyboard()
        .text("✅ Approve", `confirm:${promptId}:approve`)
        .text("❌ Deny", `confirm:${promptId}:deny`)
        .text("✅ Always", `confirm:${promptId}:always`);

      try {
        await bot.api.sendMessage(
          chatId,
          `⚠️ <b>Confirmation needed:</b>\n\n${toTelegramHtml(actionText)}`,
          { parse_mode: "HTML", reply_markup: keyboard }
        );
      } catch { /* */ }
    },

    "response-end": async ({ text }) => {
      // In plan mode, send the final plan as a clean standalone message
      if (engine.getMode() === "plan" && text) {
        await editor.flush();
        try {
          const html = toTelegramHtml(text);
          const chunks = splitMessage(html);
          for (const chunk of chunks) {
            await bot.api.sendMessage(chatId, chunk, { parse_mode: "HTML" });
          }
        } catch { /* rate limit or send error */ }
        // Clear the editor so the final flush doesn't re-send
        editor.setContent("");
      }
    },

    "plan-complete": async ({ resolve }) => {
      const promptId = getPromptId();
      ownedPromptIds.push(promptId);
      pendingConfirms.set(promptId, resolve);

      const keyboard = new InlineKeyboard()
        .text("▶️ Execute", `plan_action:${promptId}:execute`)
        .text("📋 Keep Planning", `plan_action:${promptId}:keep_planning`)
        .text("✏️ Edit", `plan_action:${promptId}:edit`);

      try {
        await bot.api.sendMessage(
          chatId,
          "📋 <b>Plan complete!</b> What would you like to do?",
          { parse_mode: "HTML", reply_markup: keyboard }
        );
      } catch { /* */ }
    },

    "error": async (data) => {
      try {
        await bot.api.sendMessage(chatId, `Error: something went wrong. Check the terminal for details.`);
        console.error(`   Engine error:`, data.message || data);
      } catch { /* */ }
    },

    "mode-change": async (data) => {
      const label = MODE_LABELS[data.to];
      if (!label) return; // ignore unknown modes
      try {
        await bot.api.sendMessage(chatId, `Mode: ${label}`);
      } catch { /* */ }
    },
  };

  // Register all handlers
  for (const [event, handler] of Object.entries(handlers)) {
    engine.on(event, handler);
  }

  // Return cleanup function
  return () => {
    for (const [event, handler] of Object.entries(handlers)) {
      engine.removeListener(event, handler);
    }
    // Remove any orphaned pending confirms from this request
    // (e.g. engine errored while waiting for user to click a button)
    for (const id of ownedPromptIds) {
      pendingConfirms.delete(id);
    }
  };
}
