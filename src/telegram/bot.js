/**
 * LlamaTalk Build — Telegram Bot
 *
 * Connects the AgentEngine to Telegram as an I/O layer.
 * Each allowed user gets their own AgentEngine instance.
 * Agent runs locally; Telegram is just the transport.
 */
import { Bot, InlineKeyboard } from "grammy";
import { ThrottledEditor, toTelegramHtml, splitMessage, formatToolStart, formatToolResult } from "./renderer.js";

// Import from the engine package (linked via file: dependency)
import { AgentEngine, SessionManager, getAllLocalModels, CLOUD_MODELS } from "llamatalkbuild-engine";
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
  recall: "💭 Recall",
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
    console.error("Set one with: llamabuild /telegram token <token>");
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

  // Per-user engine instances
  const engines = new Map();
  // Pending confirmations — keyed by globally unique promptId
  const pendingConfirms = new Map();
  // Per-user throttled editors
  const editors = new Map();
  // Per-user busy lock — prevents concurrent messages from colliding
  const busyUsers = new Set();
  // Global prompt counter — never resets, so IDs are unique across all requests
  let globalPromptCounter = 0;

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
    const name = esc(config.profileName || "there");
    await ctx.reply(
      `👋 Hey ${name}! I'm your LlamaTalk Build agent.\n\n` +
      `<b>Commands:</b>\n` +
      `/new — Start a new session\n` +
      `/clear — Clear conversation history\n` +
      `/sessions — List recent sessions\n` +
      `/clearsessions — Delete all sessions\n` +
      `/mode — Switch mode (Build/Plan/Recall)\n` +
      `/model — Show or set model\n` +
      `/models — List all available models\n` +
      `/status — Show agent status\n` +
      `/cancel — Cancel current operation\n\n` +
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
      .text(current === "recall" ? "💭 Recall ✓" : "💭 Recall", "set_mode:recall");

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
    // Resolve all pending confirms with `false` (deny) so the engine's
    // await-on-Promise unblocks. Without this, cancel() only aborts the
    // HTTP stream but the agent loop stays stuck on the confirmation Promise.
    for (const [id, resolver] of pendingConfirms) {
      resolver(false);
      pendingConfirms.delete(id);
    }
    if (engines.has(userId)) {
      engines.get(userId).cancel();
      // Destroy the engine entirely — a new one will be created on the next
      // message, with a fresh AbortController and clean state. This ensures
      // no lingering tool execution or agent loop iteration can continue.
      engines.delete(userId);
    }
    busyUsers.delete(userId);
    await ctx.reply("⛔ Operation cancelled.");
  });

  // --- Callback queries (inline keyboard) ---

  bot.callbackQuery(/^set_mode:(.+)$/, async (ctx) => {
    const userId = ctx.from.id;
    const newMode = ctx.match[1];
    if (!["build", "plan", "recall"].includes(newMode)) return ctx.answerCallbackQuery("Invalid mode");
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

    // Intercept CLI slash commands so they don't get sent to the LLM.
    // grammy handles /start, /sessions, /mode, /model, /status, /cancel above.
    // Everything else starting with "/" is either handled here or rejected.
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

    // Prevent concurrent messages from the same user — the engine is stateful
    // and two simultaneous requests would collide on event handlers and promptIds
    if (busyUsers.has(userId)) {
      await ctx.reply("⏳ Still working on your previous request. Please wait.");
      return;
    }

    console.log(`   [${userId}] Message: ${text.slice(0, 80)}${text.length > 80 ? "..." : ""}`);

    busyUsers.add(userId);
    const engine = getEngine(userId);
    const editor = getEditor(chatId);
    editor.reset();

    // Send initial "thinking" message
    const thinkingMsg = await ctx.reply("🤔 Thinking...");
    editor.setMessageId(thinkingMsg.message_id);

    // Wire engine events for this request (uses global counter for unique promptIds)
    const cleanup = wireEngineEvents(engine, bot, chatId, editor, pendingConfirms, () => `p${++globalPromptCounter}`);

    try {
      await engine.sendMessage(text);
    } catch (err) {
      console.error(`   [${userId}] Engine error:`, err.message || err);
      try {
        await bot.api.sendMessage(chatId, `❌ Error: ${err.message || err}`);
      } catch { /* */ }
    }

    // Final flush
    await editor.flush();

    // If editor has content, do final split send
    const finalContent = editor.getContent();
    if (finalContent) {
      try {
        const html = toTelegramHtml(finalContent);
        const chunks = splitMessage(html);
        if (chunks.length > 1) {
          // The first chunk was already edited in, send the rest as new messages
          for (let i = 1; i < chunks.length; i++) {
            await bot.api.sendMessage(chatId, chunks[i], { parse_mode: "HTML" });
          }
        }
      } catch (err) {
        console.error(`   [${userId}] Final send error:`, err.message || err);
      }
    }

    cleanup();
    busyUsers.delete(userId);
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

  console.log("🤖 LlamaTalk Build Telegram bot starting...");
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
