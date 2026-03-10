#!/usr/bin/env node
/**
 * LlamaTalk Build Desktop — Sidecar Process
 *
 * Wraps AgentEngine with a newline-delimited JSON protocol over stdin/stdout.
 * The Tauri Rust backend spawns this process and communicates via stdio.
 *
 * Protocol:
 *   Client → Sidecar:  {"type":"call","id":1,"method":"...","params":{}}
 *   Sidecar → Client:  {"type":"event","event":"...","data":{}}
 *   Sidecar → Client:  {"type":"result","id":1,"data":{}}
 *   Sidecar → Client:  {"type":"prompt","id":"c1","event":"confirm-needed","data":{}}
 *   Client → Sidecar:  {"type":"resolve","id":"c1","data":true}
 */
import { createInterface } from "readline";
import {
  AgentEngine, loadConfig, saveConfig, SessionManager, getAllLocalModels,
  CLOUD_MODELS, detectBackend, TaskManager, MemoryManager,
} from "llamatalkbuild-engine";

// --- Protocol helpers ---

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

function sendEvent(event, data) {
  send({ type: "event", event, data });
}

function sendResult(id, data) {
  send({ type: "result", id, data });
}

function sendError(id, message) {
  send({ type: "error", id, message });
}

// --- Pending prompts (for confirmation, session-locked, plan-complete) ---

let promptCounter = 0;
const pendingPrompts = new Map();

function sendPrompt(event, data) {
  return new Promise((resolve) => {
    const id = `prompt-${++promptCounter}`;
    pendingPrompts.set(id, resolve);
    send({ type: "prompt", id, event, data });
  });
}

// --- Engine setup ---

let engine = null;
let config = null;

const SIDECAR_VERSION = "2.4.0";

function ensureEngine(projectRoot) {
  if (!engine) {
    config = loadConfig();
    // Version check for re-onboarding
    if (config.onboardingDone && (!config.appVersion || config.appVersion !== SIDECAR_VERSION)) {
      config.onboardingComplete = false;
      config.appVersion = SIDECAR_VERSION;
      saveConfig(config);
    }
    engine = new AgentEngine(config, {
      projectRoot: projectRoot || process.cwd(),
    });
    wireEvents(engine);
  }
  return engine;
}

function wireEvents(engine) {
  const passthrough = [
    "thinking-start", "thinking-stop", "response-start", "response-end",
    "token", "tool-start", "tool-result", "context-compacting",
    "file-changed", "turn-complete", "mode-change", "cancelled", "error", "usage",
    "memory-loading",
  ];

  for (const evt of passthrough) {
    engine.on(evt, (data) => sendEvent(evt, data));
  }

  engine.on("confirm-needed", async ({ actions, resolve }) => {
    const result = await sendPrompt("confirm-needed", { actions });
    resolve(result);
  });

  engine.on("session-locked", async ({ resolve }) => {
    const result = await sendPrompt("session-locked", {});
    resolve(result);
  });

  engine.on("plan-complete", async ({ resolve }) => {
    const result = await sendPrompt("plan-complete", {});
    resolve(result);
  });
}

// --- RPC method handlers ---

const methods = {
  ping() {
    return { ok: true, version: "0.1.0" };
  },

  getConfig() {
    const cfg = loadConfig();
    return {
      selectedModel: cfg.selectedModel,
      profileName: cfg.profileName,
      backendType: cfg.backendType,
      memoryEnabled: cfg.memoryEnabled,
      showToolCalls: cfg.showToolCalls,
      showThinking: cfg.showThinking,
      temperature: cfg.temperature,
      maxIterations: cfg.maxIterations,
      ollamaUrl: cfg.ollamaUrl,
      localServers: cfg.localServers || [],
      enabledProviders: cfg.enabledProviders || {},
      autoApprove: cfg.autoApprove || {},
      pinHash: cfg.pinHash || null,
      onboardingDone: cfg.onboardingDone || false,
      onboardingComplete: cfg.onboardingComplete || false,
      telegramBotToken: cfg.telegramBotToken ? "••••••••" : "",
      telegramAllowedUsers: cfg.telegramAllowedUsers || [],
      appVersion: cfg.appVersion || "",
      // Don't send raw API keys — just whether they're set
      hasApiKey: {
        anthropic: !!(cfg.apiKey_anthropic && (typeof cfg.apiKey_anthropic === "string" ? cfg.apiKey_anthropic.length > 0 : cfg.apiKey_anthropic.v)),
        google: !!(cfg.apiKey_google && (typeof cfg.apiKey_google === "string" ? cfg.apiKey_google.length > 0 : cfg.apiKey_google.v)),
        openai: !!(cfg.apiKey_openai && (typeof cfg.apiKey_openai === "string" ? cfg.apiKey_openai.length > 0 : cfg.apiKey_openai.v)),
        opencode: !!(cfg.apiKey_opencode && (typeof cfg.apiKey_opencode === "string" ? cfg.apiKey_opencode.length > 0 : cfg.apiKey_opencode.v)),
      },
    };
  },

  saveSetting({ key, value }) {
    // Security: Whitelist allowed config keys to prevent arbitrary config manipulation
    const ALLOWED_KEYS = [
      "selectedModel", "ollamaUrl", "safetyLevel", "profileName", "backendType",
      "telegramBotToken", "telegramAccessCode", "onboardingComplete", "appVersion",
      "enabledProviders.anthropic", "enabledProviders.google", "enabledProviders.openai", "enabledProviders.opencode",
      "autoApprove.medium", "autoApprove.high",
    ];
    if (!ALLOWED_KEYS.includes(key)) {
      return { ok: false, error: `Setting "${key}" is not allowed` };
    }
    // Validate string values aren't excessively long
    if (typeof value === "string" && value.length > 1024) {
      return { ok: false, error: "Value too long" };
    }
    const cfg = loadConfig();
    // Handle nested keys like "enabledProviders.anthropic" or "autoApprove.medium"
    const parts = key.split(".");
    if (parts.length === 2) {
      if (!cfg[parts[0]] || typeof cfg[parts[0]] !== "object") cfg[parts[0]] = {};
      cfg[parts[0]][parts[1]] = value;
    } else {
      cfg[key] = value;
    }
    saveConfig(cfg);
    // Update the live engine config if running
    if (engine) {
      engine.config = cfg;
    }
    config = cfg;
    return { ok: true };
  },

  saveApiKey({ provider, key }) {
    // Security: Validate provider against allowed list
    const ALLOWED_PROVIDERS = ["anthropic", "google", "openai", "opencode"];
    if (!ALLOWED_PROVIDERS.includes(provider)) {
      return { ok: false, error: `Unknown provider: ${provider}` };
    }
    if (typeof key !== "string" || key.length > 512) {
      return { ok: false, error: "Invalid API key" };
    }
    const cfg = loadConfig();
    const field = `apiKey_${provider}`;
    cfg[field] = key;
    if (!cfg.enabledProviders) cfg.enabledProviders = {};
    cfg.enabledProviders[provider] = key.length > 0;
    saveConfig(cfg);
    if (engine) engine.config = cfg;
    config = cfg;
    return { ok: true };
  },

  async testProvider({ provider }) {
    const cfg = loadConfig();
    const apiKey = cfg[`apiKey_${provider}`];
    if (!apiKey || (typeof apiKey === "string" && !apiKey.length)) {
      return { ok: false, error: "No API key set" };
    }
    try {
      // Quick validation by checking if a known model can be used
      if (provider === "anthropic") {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({ model: "claude-3-5-haiku-20241022", max_tokens: 1, messages: [{ role: "user", content: "hi" }] }),
        });
        return { ok: res.status !== 401 && res.status !== 403, status: res.status };
      } else if (provider === "google") {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models`, {
          headers: { "x-goog-api-key": apiKey },
        });
        return { ok: res.ok, status: res.status };
      } else if (provider === "openai") {
        const res = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        return { ok: res.ok, status: res.status };
      } else if (provider === "opencode") {
        const res = await fetch("https://opencode.ai/zen/v1/models", {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        return { ok: res.ok || res.status !== 401, status: res.status };
      }
      return { ok: false, error: "Unknown provider" };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },

  async testServer({ url }) {
    try {
      const backend = await detectBackend(url);
      return { ok: backend !== "unknown", backend };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  },

  createSession({ projectRoot } = {}) {
    const e = ensureEngine(projectRoot);
    const session = e.createSession(projectRoot);
    return { id: session.id, title: session.title, projectRoot: e.projectRoot };
  },

  loadSession({ sessionId } = {}) {
    const e = ensureEngine();
    const session = e.loadSession(sessionId);
    if (!session) return { ok: false, error: "No session found" };
    return { ok: true, id: session.id, title: session.title, messages: e.getMessages() };
  },

  listSessions() {
    const sm = new SessionManager();
    return sm.list();
  },

  deleteSession({ id }) {
    const sm = new SessionManager();
    sm.delete(id);
    // If the deleted session is the one currently loaded, clear engine state
    if (engine && engine.currentSession && engine.currentSession.id === id) {
      engine.clearMessages();
      engine.currentSession = null;
    }
    return { ok: true };
  },

  async sendMessage({ text }) {
    const e = ensureEngine();
    await e.sendMessage(text);
    return { ok: true };
  },

  cancel() {
    if (engine) engine.cancel();
    return { ok: true };
  },

  getMode() {
    return { mode: engine?.getMode() || "build" };
  },

  setMode({ mode }) {
    if (engine) engine.setMode(mode);
    return { ok: true, mode: engine?.getMode() };
  },

  getModel() {
    return { model: engine?.getModel() || "" };
  },

  setModel({ model }) {
    if (engine) engine.setModel(model);
    // Also persist to config
    const cfg = loadConfig();
    cfg.selectedModel = model;
    saveConfig(cfg);
    if (engine) engine.config = cfg;
    return { ok: true };
  },

  clearMessages() {
    if (engine) engine.clearMessages();
    return { ok: true };
  },

  getMessages() {
    return engine?.getMessages() || [];
  },

  async listModels() {
    const cfg = loadConfig();
    try {
      const result = await getAllLocalModels(cfg);
      const localModels = result.allModels || [];

      // Also include cloud models from enabled providers with API keys
      const cloudModels = [];
      for (const [provider, models] of Object.entries(CLOUD_MODELS)) {
        const apiKey = cfg[`apiKey_${provider}`];
        if (cfg.enabledProviders?.[provider] && apiKey && (typeof apiKey === "string" ? apiKey.length > 0 : apiKey.v)) {
          cloudModels.push(...models);
        }
      }

      return [...localModels, ...cloudModels];
    } catch {
      // If server is unreachable, still return cloud models
      const cloudModels = [];
      for (const [provider, models] of Object.entries(CLOUD_MODELS)) {
        const apiKey = cfg[`apiKey_${provider}`];
        if (cfg.enabledProviders?.[provider] && apiKey && (typeof apiKey === "string" ? apiKey.length > 0 : apiKey.v)) {
          cloudModels.push(...models);
        }
      }
      return cloudModels;
    }
  },

  listTasks() {
    const tm = engine ? engine.getTaskManager() : new TaskManager();
    return tm.list();
  },

  addTask({ description, dueDate }) {
    // Security: Validate task input length
    if (typeof description !== "string" || description.length === 0 || description.length > 500) {
      return { error: "Task description must be 1-500 characters" };
    }
    const tm = engine ? engine.getTaskManager() : new TaskManager();
    return tm.add(description, dueDate || null);
  },

  completeTask({ index }) {
    const tm = engine ? engine.getTaskManager() : new TaskManager();
    return tm.complete(index);
  },

  removeTask({ index }) {
    const tm = engine ? engine.getTaskManager() : new TaskManager();
    return tm.remove(index);
  },

  renameSession({ id, title }) {
    // Security: Validate session title length
    if (typeof title === "string" && title.length > 200) {
      return { ok: false, error: "Session title too long" };
    }
    const sm = new SessionManager();
    sm.touch(id, title);
    return { ok: true };
  },

  // --- Agent management ---

  listAgents() {
    const e = ensureEngine();
    return e.getSubAgents();
  },

  createAgent({ name, role, model, tools }) {
    if (!name || typeof name !== "string" || name.length > 50) {
      return { error: "Agent name must be 1-50 characters" };
    }
    if (!role || typeof role !== "string" || role.length > 500) {
      return { error: "Agent role must be 1-500 characters" };
    }
    const e = ensureEngine();
    // Check for duplicate names
    const existing = e.getSubAgents().find(
      (a) => a.name.toLowerCase() === name.toLowerCase()
    );
    if (existing) return { error: `Agent "${name}" already exists` };

    const agent = e.addSubAgent({
      name,
      role,
      model: model || null,
      tools: tools || null,
    });
    // Persist to config
    saveConfig(e.config);
    return agent;
  },

  removeAgent({ name }) {
    if (!name) return { error: "Agent name required" };
    const e = ensureEngine();
    const removed = e.removeSubAgent(name);
    if (!removed) return { error: `No agent named "${name}"` };
    saveConfig(e.config);
    return { ok: true, removed };
  },

  enableAgent({ name }) {
    if (!name) return { error: "Agent name required" };
    const e = ensureEngine();
    const agent = e.enableSubAgent(name);
    if (!agent) return { error: `No agent named "${name}"` };
    saveConfig(e.config);
    return { ok: true, agent };
  },

  disableAgent({ name }) {
    if (!name) return { error: "Agent name required" };
    const e = ensureEngine();
    const agent = e.disableSubAgent(name);
    if (!agent) return { error: `No agent named "${name}"` };
    saveConfig(e.config);
    return { ok: true, agent };
  },

  saveOnboarding({ lessons }) {
    const cfg = loadConfig();
    const memory = new MemoryManager(cfg);
    if (Array.isArray(lessons)) {
      // Security: Limit lesson count and length
      for (const entry of lessons.slice(0, 10)) {
        if (typeof entry === "string" && entry.trim() && entry.length <= 500) {
          memory.appendLesson("about_you", entry.trim());
        }
      }
    }
    cfg.onboardingComplete = true;
    saveConfig(cfg);
    return { ok: true };
  },
};

// --- stdin reader ---

const rl = createInterface({ input: process.stdin, terminal: false });

rl.on("line", async (line) => {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    sendError(null, "Invalid JSON");
    return;
  }

  if (msg.type === "resolve" && msg.id) {
    const resolver = pendingPrompts.get(msg.id);
    if (resolver) {
      pendingPrompts.delete(msg.id);
      resolver(msg.data);
    }
    return;
  }

  if (msg.type === "call" && msg.method) {
    const handler = methods[msg.method];
    if (!handler) {
      sendError(msg.id, `Unknown method: ${msg.method}`);
      return;
    }
    try {
      const result = await handler(msg.params || {});
      sendResult(msg.id, result);
    } catch (err) {
      sendError(msg.id, err.message);
    }
    return;
  }

  sendError(msg.id, "Unknown message type");
});

rl.on("close", () => {
  process.exit(0);
});

sendEvent("ready", { version: "0.1.0" });
