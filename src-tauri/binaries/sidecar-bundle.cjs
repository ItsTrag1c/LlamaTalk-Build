#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// ../../llamatalkbuild-engine/src/config.js
var config_exports = {};
__export(config_exports, {
  decryptApiKeys: () => decryptApiKeys,
  decryptValue: () => decryptValue,
  deriveEncKey: () => deriveEncKey,
  encryptValue: () => encryptValue,
  generateEncKeySalt: () => generateEncKeySalt,
  getConfigDir: () => getConfigDir,
  getConfigPath: () => getConfigPath,
  getConversationDir: () => getConversationDir,
  getMemoryDir: () => getMemoryDir,
  hashPin: () => hashPin,
  isEncryptedPayload: () => isEncryptedPayload,
  isFirstRun: () => isFirstRun,
  loadConfig: () => loadConfig,
  loadConversation: () => loadConversation,
  needsPinMigration: () => needsPinMigration,
  pinRequired: () => pinRequired,
  saveConfig: () => saveConfig,
  saveConfigWithKey: () => saveConfigWithKey,
  saveConversation: () => saveConversation,
  verifyPin: () => verifyPin
});
function getConfigDir() {
  const appData = process.env.APPDATA;
  if (appData) {
    const newDir2 = (0, import_path.join)(appData, "Clank");
    if (!(0, import_fs.existsSync)(newDir2)) {
      const clankBuildDir = (0, import_path.join)(appData, "ClankBuild");
      const llamaDir = (0, import_path.join)(appData, "LlamaTalkBuild");
      if ((0, import_fs.existsSync)(clankBuildDir)) {
        (0, import_fs.cpSync)(clankBuildDir, newDir2, { recursive: true });
      } else if ((0, import_fs.existsSync)(llamaDir)) {
        (0, import_fs.cpSync)(llamaDir, newDir2, { recursive: true });
      }
    }
    return newDir2;
  }
  const newDir = (0, import_path.join)((0, import_os.homedir)(), ".clank");
  if (!(0, import_fs.existsSync)(newDir)) {
    const clankBuildDir = (0, import_path.join)((0, import_os.homedir)(), ".clankbuild");
    const llamaDir = (0, import_path.join)((0, import_os.homedir)(), ".llamabuild");
    if ((0, import_fs.existsSync)(clankBuildDir)) {
      (0, import_fs.cpSync)(clankBuildDir, newDir, { recursive: true });
    } else if ((0, import_fs.existsSync)(llamaDir)) {
      (0, import_fs.cpSync)(llamaDir, newDir, { recursive: true });
    }
  }
  return newDir;
}
function getConfigPath() {
  return (0, import_path.join)(getConfigDir(), "config.json");
}
function getMemoryDir() {
  return (0, import_path.join)(getConfigDir(), "memory");
}
function getConversationDir() {
  return (0, import_path.join)(getConfigDir(), "conversations");
}
function loadConfig() {
  const configPath = getConfigPath();
  const dir = (0, import_path.dirname)(configPath);
  if (!(0, import_fs.existsSync)(dir)) {
    (0, import_fs.mkdirSync)(dir, { recursive: true });
  }
  if (!(0, import_fs.existsSync)(configPath)) {
    (0, import_fs.writeFileSync)(configPath, JSON.stringify(DEFAULTS, null, 2), "utf8");
    return { ...DEFAULTS };
  }
  try {
    const raw = (0, import_fs.readFileSync)(configPath, "utf8");
    const parsed = JSON.parse(raw);
    const config2 = deepMerge({ ...DEFAULTS }, parsed);
    if (config2.autoApprove && ("safe" in config2.autoApprove || "moderate" in config2.autoApprove || "dangerous" in config2.autoApprove)) {
      const old = config2.autoApprove;
      config2.autoApprove = {
        low: old.low ?? old.safe ?? true,
        medium: old.medium ?? old.moderate ?? false,
        high: old.high ?? old.dangerous ?? false
      };
      (0, import_fs.writeFileSync)(configPath, JSON.stringify(config2, null, 2), "utf8");
    }
    return config2;
  } catch {
    return { ...DEFAULTS };
  }
}
function applyFilePermissions(filePath) {
  if (process.platform === "win32") {
    try {
      (0, import_child_process.execFileSync)("icacls", [
        filePath,
        "/inheritance:r",
        "/grant:r",
        `${process.env.USERNAME}:F`
      ], { stdio: "ignore" });
    } catch {
    }
  } else {
    try {
      (0, import_fs.chmodSync)(filePath, 384);
    } catch {
    }
  }
}
function saveConfig(config2) {
  const configPath = getConfigPath();
  const dir = (0, import_path.dirname)(configPath);
  if (!(0, import_fs.existsSync)(dir)) {
    (0, import_fs.mkdirSync)(dir, { recursive: true });
  }
  (0, import_fs.writeFileSync)(configPath, JSON.stringify(config2, null, 2), "utf8");
  applyFilePermissions(configPath);
}
function generateEncKeySalt() {
  return (0, import_crypto.randomBytes)(16).toString("hex");
}
function deriveEncKey(pin, saltHex) {
  return (0, import_crypto.pbkdf2Sync)(pin, Buffer.from(saltHex, "hex"), 1e5, 32, "sha256");
}
function encryptValue(plaintext, key) {
  const iv = (0, import_crypto.randomBytes)(12);
  const cipher = (0, import_crypto.createCipheriv)("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { v: 1, iv: iv.toString("hex"), tag: tag.toString("hex"), data: data.toString("hex") };
}
function decryptValue(payload, key) {
  const decipher = (0, import_crypto.createDecipheriv)("aes-256-gcm", key, Buffer.from(payload.iv, "hex"));
  decipher.setAuthTag(Buffer.from(payload.tag, "hex"));
  return decipher.update(Buffer.from(payload.data, "hex")) + decipher.final("utf8");
}
function isEncryptedPayload(v) {
  return v && typeof v === "object" && v.v === 1 && v.iv && v.tag && v.data;
}
function saveConfigWithKey(config2, encKey) {
  const configPath = getConfigPath();
  const dir = (0, import_path.dirname)(configPath);
  if (!(0, import_fs.existsSync)(dir)) (0, import_fs.mkdirSync)(dir, { recursive: true });
  const toWrite = { ...config2 };
  if (encKey) {
    for (const field of ["apiKey_anthropic", "apiKey_google", "apiKey_openai", "apiKey_opencode", "telegramBotToken", "telegramAccessCode"]) {
      if (toWrite[field] && typeof toWrite[field] === "string" && toWrite[field].length > 0) {
        toWrite[field] = encryptValue(toWrite[field], encKey);
      }
    }
  }
  (0, import_fs.writeFileSync)(configPath, JSON.stringify(toWrite, null, 2), "utf8");
  applyFilePermissions(configPath);
}
function decryptApiKeys(config2, encKey) {
  const out = { ...config2 };
  if (!encKey) return out;
  for (const field of ["apiKey_anthropic", "apiKey_google", "apiKey_openai", "apiKey_opencode", "telegramBotToken", "telegramAccessCode"]) {
    if (isEncryptedPayload(out[field])) {
      try {
        out[field] = decryptValue(out[field], encKey);
      } catch {
        out[field] = "";
      }
    }
  }
  return out;
}
function saveConversation(id, messages, encKey) {
  const dir = getConversationDir();
  if (!(0, import_fs.existsSync)(dir)) (0, import_fs.mkdirSync)(dir, { recursive: true });
  const filePath = (0, import_path.join)(dir, `${id}.json`);
  const json = JSON.stringify(messages);
  const payload = encKey ? JSON.stringify(encryptValue(json, encKey)) : json;
  (0, import_fs.writeFileSync)(filePath, payload, "utf8");
  applyFilePermissions(filePath);
}
function loadConversation(id, encKey) {
  const filePath = (0, import_path.join)(getConversationDir(), `${id}.json`);
  if (!(0, import_fs.existsSync)(filePath)) return [];
  try {
    const raw = (0, import_fs.readFileSync)(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (isEncryptedPayload(parsed)) {
      if (!encKey) return [];
      try {
        return JSON.parse(decryptValue(parsed, encKey));
      } catch {
        return [];
      }
    }
    if (Array.isArray(parsed)) return parsed;
    return [];
  } catch {
    return [];
  }
}
function isFirstRun(config2) {
  return !config2.onboardingDone;
}
function hashPin(pin) {
  const salt = (0, import_crypto.randomBytes)(16);
  const hash = (0, import_crypto.pbkdf2Sync)(pin, salt, 1e5, 32, "sha256");
  return `pbkdf2v1:${salt.toString("hex")}:${hash.toString("hex")}`;
}
function needsPinMigration(hash) {
  return !!hash && !hash.startsWith("pbkdf2v1:");
}
function legacyHashPin(pin, salt = "clank-pin-salt") {
  return (0, import_crypto.createHash)("sha256").update(salt + pin).digest("hex");
}
function verifyPin(pin, hash) {
  if (!hash) return false;
  if (hash.startsWith("pbkdf2v1:")) {
    const parts = hash.split(":");
    if (parts.length !== 3) return false;
    const salt = Buffer.from(parts[1], "hex");
    const stored2 = Buffer.from(parts[2], "hex");
    const computed = (0, import_crypto.pbkdf2Sync)(pin, salt, 1e5, 32, "sha256");
    if (computed.length !== stored2.length) return false;
    return (0, import_crypto.timingSafeEqual)(computed, stored2);
  }
  const stored = Buffer.from(hash, "hex");
  const computedCurrent = Buffer.from(legacyHashPin(pin, "clank-pin-salt"), "hex");
  if (computedCurrent.length === stored.length && (0, import_crypto.timingSafeEqual)(computedCurrent, stored)) return true;
  const computedClankBuild = Buffer.from(legacyHashPin(pin, "clankbuild-pin-salt"), "hex");
  if (computedClankBuild.length === stored.length && (0, import_crypto.timingSafeEqual)(computedClankBuild, stored)) return true;
  const computedLlama = Buffer.from(legacyHashPin(pin, "llamatalkbuild-pin-salt"), "hex");
  if (computedLlama.length === stored.length && (0, import_crypto.timingSafeEqual)(computedLlama, stored)) return true;
  return false;
}
function pinRequired(config2) {
  if (!config2.pinHash) return false;
  if (config2.pinFrequency === "never") return false;
  if (config2.pinFrequency === "always") return true;
  if (config2.pinFrequency === "30days") {
    if (!config2.lastUnlockTime) return true;
    const last = new Date(config2.lastUnlockTime).getTime();
    const now = Date.now();
    return now - last > 30 * 24 * 60 * 60 * 1e3;
  }
  return true;
}
function deepMerge(target, source) {
  const out = { ...target };
  for (const key of Object.keys(source)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
    if (source[key] === null) continue;
    if (source[key] !== null && typeof source[key] === "object" && !Array.isArray(source[key]) && typeof target[key] === "object" && target[key] !== null && !Array.isArray(target[key])) {
      out[key] = deepMerge(target[key], source[key]);
    } else {
      out[key] = source[key];
    }
  }
  return out;
}
var import_fs, import_path, import_crypto, import_os, import_child_process, DEFAULTS;
var init_config = __esm({
  "../../llamatalkbuild-engine/src/config.js"() {
    import_fs = require("fs");
    import_path = require("path");
    import_crypto = require("crypto");
    import_os = require("os");
    import_child_process = require("child_process");
    DEFAULTS = {
      profileName: "",
      pinHash: null,
      pinFrequency: "always",
      lastUnlockTime: null,
      encKeySalt: null,
      onboardingDone: false,
      // Server settings
      ollamaUrl: "http://localhost:11434",
      localServers: [],
      selectedModel: "",
      modelNickname: {},
      temperature: 0.7,
      hiddenModels: [],
      // API keys (encrypted at rest)
      apiKey_anthropic: "",
      apiKey_google: "",
      apiKey_openai: "",
      apiKey_opencode: "",
      enabledProviders: { anthropic: false, google: false, openai: false, opencode: false },
      // Agent naming
      agentName: "",
      // Agent-specific settings
      maxIterations: 50,
      autoApprove: {
        low: true,
        medium: false,
        high: false
      },
      showThinking: true,
      showToolCalls: true,
      contextStrategy: "truncate",
      memoryEnabled: true,
      // Telegram
      telegramBotToken: "",
      telegramAllowedUsers: [],
      telegramAccessCode: "",
      // Onboarding / versioning
      onboardingComplete: false,
      appVersion: ""
    };
  }
});

// main.js
var import_readline = require("readline");

// ../../llamatalkbuild-engine/src/agent.js
var import_events = require("events");
var import_path17 = require("path");
var import_fs17 = require("fs");

// ../../llamatalkbuild-engine/src/providers/base.js
var BaseProvider = class {
  constructor(config2, options = {}) {
    this.config = config2;
    this.options = options;
  }
  /** Format internal tool definitions to this provider's API schema */
  formatTools(tools) {
    throw new Error("formatTools() not implemented");
  }
  /**
   * Stream a completion with tool support.
   * @param {Array} messages - Conversation messages
   * @param {string} systemPrompt - System prompt text
   * @param {Array} tools - Tool definitions (internal format)
   * @param {AbortSignal} signal - Cancellation signal
   * @returns {AsyncGenerator<StreamEvent>}
   */
  async *stream(messages, systemPrompt, tools, signal) {
    throw new Error("stream() not implemented");
  }
  /** Estimate token count for a message array */
  estimateTokens(messages) {
    let total = 0;
    for (const m of messages) {
      const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
      total += Math.ceil(content.length / 4) + 4;
    }
    return total;
  }
  /** Maximum context window for the current model */
  contextWindow() {
    return 8192;
  }
};

// ../../llamatalkbuild-engine/src/providers/stream.js
var import_http = require("http");
var import_https = require("https");
var BLOCKED_HOSTS = /^(169\.254\.|0\.0\.0\.0$|\[::1?\]$|\[0*:0*:0*:0*:0*:0*:0*:[01]\]$|::1?$)/i;
function validateServerUrl(urlStr) {
  let parsed;
  try {
    parsed = new URL(urlStr);
  } catch {
    throw new Error(`Invalid server URL: ${urlStr}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Server URL must use http or https");
  }
  if (BLOCKED_HOSTS.test(parsed.hostname)) {
    throw new Error("Link-local, null-bind, and IPv6 loopback addresses are not permitted");
  }
}
var ALLOWED_CLOUD_DOMAINS = [
  "api.anthropic.com",
  "generativelanguage.googleapis.com",
  "api.openai.com",
  "opencode.ai"
];
function validateCloudUrl(urlStr) {
  let parsed;
  try {
    parsed = new URL(urlStr);
  } catch {
    throw new Error(`Invalid cloud URL: ${urlStr}`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error("Cloud API calls must use HTTPS");
  }
  if (!ALLOWED_CLOUD_DOMAINS.some((d) => parsed.hostname === d || parsed.hostname.endsWith("." + d))) {
    throw new Error(`Cloud URL domain '${parsed.hostname}' is not in the allowed list`);
  }
}
function fetchWithTimeout(url, options, timeoutMs, cancelSignal = null) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let cancelListener;
  if (cancelSignal) {
    if (cancelSignal.aborted) {
      controller.abort();
    } else {
      cancelListener = () => controller.abort();
      cancelSignal.addEventListener("abort", cancelListener);
    }
  }
  return fetch(url, { ...options, signal: controller.signal }).finally(() => {
    clearTimeout(timer);
    if (cancelSignal && cancelListener) {
      cancelSignal.removeEventListener("abort", cancelListener);
    }
  });
}
function streamRequest(url, options, signal = null) {
  return new Promise((resolve5, reject) => {
    const parsed = new URL(url);
    const reqFn = parsed.protocol === "https:" ? import_https.request : import_http.request;
    const isCloud = parsed.protocol === "https:" && !parsed.hostname.match(/^(localhost|127\.)/);
    const connectTimeout = isCloud ? 3e4 : 0;
    const timer = connectTimeout ? setTimeout(() => {
      req.destroy(new Error(`Connection timeout after ${connectTimeout / 1e3}s`));
    }, connectTimeout) : null;
    const req = reqFn(url, {
      method: options.method || "GET",
      headers: options.headers || {},
      signal
    }, (res) => {
      if (timer) clearTimeout(timer);
      if (res.statusCode >= 200 && res.statusCode < 300) {
        resolve5(res);
      } else {
        let body = "";
        res.on("data", (c) => body += c);
        res.on("end", () => reject(new Error(`HTTP ${res.statusCode}: ${body}`)));
        res.on("error", reject);
      }
    });
    req.on("error", (err) => {
      if (timer) clearTimeout(timer);
      reject(err);
    });
    if (options.body) req.write(options.body);
    req.end();
  });
}
async function* streamLines(nodeStream) {
  const chunks = [];
  let searchFrom = 0;
  for await (const chunk of nodeStream) {
    const str = chunk.toString();
    chunks.push(str);
    let buf = chunks.length === 1 ? chunks[0] : chunks.join("");
    chunks.length = 0;
    let start = 0;
    while (true) {
      const nl = buf.indexOf("\n", start);
      if (nl === -1) break;
      const line = buf.slice(start, nl).trim();
      start = nl + 1;
      if (line) yield line;
    }
    if (start < buf.length) {
      chunks.push(buf.slice(start));
    }
  }
  const remainder = chunks.join("").trim();
  if (remainder) yield remainder;
}

// ../../llamatalkbuild-engine/src/providers/anthropic.js
var CONTEXT_WINDOWS = {
  "claude-opus-4-5": 2e5,
  "claude-sonnet-4-5": 2e5,
  "claude-3-5-haiku-20241022": 2e5
};
var AnthropicProvider = class extends BaseProvider {
  formatTools(tools) {
    return tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters
    }));
  }
  contextWindow() {
    return CONTEXT_WINDOWS[this.config.selectedModel] || 2e5;
  }
  async *stream(messages, systemPrompt, tools, signal) {
    const apiKey = this.config.apiKey_anthropic;
    if (!apiKey) throw new Error("Anthropic API key not set. Use /set api-key anthropic <key>");
    const model = this.config.selectedModel;
    const temperature = this.config.temperature ?? 0.7;
    const anthropicMessages = [];
    for (const m of messages) {
      if (m.role === "system") continue;
      let converted;
      if (m.role === "tool_result") {
        converted = {
          role: "user",
          content: Array.isArray(m.content) ? m.content : [{ type: "tool_result", tool_use_id: m.tool_use_id, content: m.content }]
        };
      } else if (m.role === "user" && Array.isArray(m.content) && m.content[0]?.type === "tool_result") {
        converted = m;
      } else {
        converted = { role: m.role, content: m.content };
      }
      const last = anthropicMessages[anthropicMessages.length - 1];
      if (last && last.role === converted.role) {
        const lastContent = Array.isArray(last.content) ? last.content : [{ type: "text", text: last.content }];
        const newContent = Array.isArray(converted.content) ? converted.content : [{ type: "text", text: converted.content }];
        last.content = [...lastContent, ...newContent];
      } else {
        anthropicMessages.push(converted);
      }
    }
    const reqBody = {
      model,
      max_tokens: 8192,
      messages: anthropicMessages,
      temperature,
      stream: true
    };
    if (systemPrompt) reqBody.system = systemPrompt;
    if (tools && tools.length > 0) {
      reqBody.tools = this.formatTools(tools);
    }
    const res = await streamRequest(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify(reqBody)
      },
      signal
    );
    let usage = { promptTokens: 0, outputTokens: 0 };
    let currentToolCall = null;
    let toolCallJsonChunks = [];
    for await (const line of streamLines(res)) {
      if (signal?.aborted) break;
      if (!line.startsWith("data: ")) continue;
      try {
        const obj = JSON.parse(line.slice(6));
        if (obj.type === "message_start" && obj.message?.usage) {
          usage.promptTokens = obj.message.usage.input_tokens || 0;
        }
        if (obj.type === "content_block_start") {
          if (obj.content_block?.type === "tool_use") {
            currentToolCall = {
              id: obj.content_block.id,
              name: obj.content_block.name
            };
            toolCallJsonChunks = [];
          }
        }
        if (obj.type === "content_block_delta") {
          if (obj.delta?.type === "text_delta" && obj.delta.text) {
            yield { type: "text", content: obj.delta.text };
          }
          if (obj.delta?.type === "input_json_delta" && obj.delta.partial_json) {
            toolCallJsonChunks.push(obj.delta.partial_json);
          }
        }
        if (obj.type === "content_block_stop" && currentToolCall) {
          let args = {};
          try {
            args = JSON.parse(toolCallJsonChunks.join(""));
          } catch {
          }
          yield {
            type: "tool_call",
            id: currentToolCall.id,
            name: currentToolCall.name,
            arguments: args
          };
          currentToolCall = null;
          toolCallJsonChunks = [];
        }
        if (obj.type === "message_delta" && obj.usage) {
          usage.outputTokens = obj.usage.output_tokens || 0;
        }
        if (obj.type === "message_stop") {
          yield { type: "usage", ...usage };
          yield { type: "done" };
          return;
        }
      } catch {
      }
    }
    yield { type: "usage", ...usage };
    yield { type: "done" };
  }
  /** Format tool results for Anthropic's message format */
  static formatToolResult(toolCallId, result) {
    return {
      role: "user",
      content: [{
        type: "tool_result",
        tool_use_id: toolCallId,
        content: typeof result === "string" ? result : JSON.stringify(result)
      }]
    };
  }
  /** Format assistant message with tool_use blocks */
  static formatAssistantToolUse(text, toolCalls) {
    const content = [];
    if (text) content.push({ type: "text", text });
    for (const tc of toolCalls) {
      content.push({
        type: "tool_use",
        id: tc.id,
        name: tc.name,
        input: tc.arguments
      });
    }
    return { role: "assistant", content };
  }
};

// ../../llamatalkbuild-engine/src/providers/openai.js
var CONTEXT_WINDOWS2 = {
  "gpt-4o": 128e3,
  "gpt-4o-mini": 128e3,
  "o1": 2e5,
  "o3-mini": 2e5
};
var OpenAIProvider = class extends BaseProvider {
  constructor(config2, options = {}) {
    super(config2, options);
    this.baseUrl = options.baseUrl || "https://api.openai.com";
    this.apiKey = options.apiKey || config2.apiKey_openai;
    this.isCloud = options.isCloud ?? true;
    if (this.isCloud) validateCloudUrl(this.baseUrl);
  }
  formatTools(tools) {
    return tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters
      }
    }));
  }
  contextWindow() {
    if (!this.isCloud) return 32768;
    return CONTEXT_WINDOWS2[this.config.selectedModel] || 128e3;
  }
  async *stream(messages, systemPrompt, tools, signal) {
    const model = this.config.selectedModel;
    const temperature = this.config.temperature ?? 0.7;
    const msgs = [];
    if (systemPrompt) msgs.push({ role: "system", content: systemPrompt });
    for (const m of messages) {
      if (m.role === "tool_result") {
        msgs.push({
          role: "tool",
          tool_call_id: m.tool_use_id,
          content: typeof m.content === "string" ? m.content : JSON.stringify(m.content)
        });
      } else if (m.role === "assistant" && m.tool_calls) {
        msgs.push(m);
      } else {
        msgs.push({ role: m.role, content: m.content });
      }
    }
    const reqBody = {
      model,
      messages: msgs,
      temperature,
      stream: true,
      stream_options: { include_usage: true }
    };
    if (tools && tools.length > 0) {
      reqBody.tools = this.formatTools(tools);
      reqBody.tool_choice = "auto";
    }
    const headers = { "Content-Type": "application/json" };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }
    const url = `${this.baseUrl.replace(/\/$/, "")}/v1/chat/completions`;
    const res = await streamRequest(url, {
      method: "POST",
      headers,
      body: JSON.stringify(reqBody)
    }, signal);
    let usage = null;
    const toolCallAccum = {};
    let toolCallsEmitted = false;
    for await (const line of streamLines(res)) {
      if (signal?.aborted) break;
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6);
      if (data === "[DONE]") break;
      try {
        const obj = JSON.parse(data);
        const choice = obj.choices?.[0];
        if (choice?.delta?.content) {
          yield { type: "text", content: choice.delta.content };
        }
        if (choice?.delta?.tool_calls) {
          for (const tc of choice.delta.tool_calls) {
            const idx = tc.index ?? 0;
            if (!toolCallAccum[idx]) {
              toolCallAccum[idx] = { id: "", name: "", arguments: "" };
            }
            if (tc.id) toolCallAccum[idx].id = tc.id;
            if (tc.function?.name) toolCallAccum[idx].name = tc.function.name;
            if (tc.function?.arguments) toolCallAccum[idx].arguments += tc.function.arguments;
          }
        }
        const fr = choice?.finish_reason;
        if (fr === "tool_calls" || fr === "function_call" || fr === "stop") {
          for (const [, tc] of Object.entries(toolCallAccum)) {
            if (tc.name) {
              let args = {};
              try {
                args = JSON.parse(tc.arguments);
              } catch {
              }
              yield { type: "tool_call", id: tc.id || `openai_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, name: tc.name, arguments: args };
            }
          }
          toolCallsEmitted = true;
        }
        if (obj.usage) {
          usage = {
            promptTokens: obj.usage.prompt_tokens || 0,
            outputTokens: obj.usage.completion_tokens || 0
          };
        }
      } catch {
      }
    }
    if (!toolCallsEmitted) {
      for (const [, tc] of Object.entries(toolCallAccum)) {
        if (tc.name) {
          let args = {};
          try {
            args = JSON.parse(tc.arguments);
          } catch {
          }
          yield { type: "tool_call", id: tc.id || `openai_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, name: tc.name, arguments: args };
        }
      }
    }
    if (usage) yield { type: "usage", ...usage };
    yield { type: "done" };
  }
  /** Format assistant message with tool_calls for OpenAI conversation history */
  static formatAssistantToolUse(text, toolCalls) {
    return {
      role: "assistant",
      content: text || null,
      tool_calls: toolCalls.map((tc) => ({
        id: tc.id,
        type: "function",
        function: {
          name: tc.name,
          arguments: JSON.stringify(tc.arguments)
        }
      }))
    };
  }
  /** Format tool result for OpenAI */
  static formatToolResult(toolCallId, result) {
    return {
      role: "tool_result",
      tool_use_id: toolCallId,
      content: typeof result === "string" ? result : JSON.stringify(result)
    };
  }
};

// ../../llamatalkbuild-engine/src/providers/ollama.js
var TOOL_CAPABLE_PATTERNS = [
  /(?:^|\/)llama3\.[1-9]/,
  /(?:^|\/)llama-3\.[1-9]/,
  /(?:^|\/)qwen[23]/,
  // Qwen2, Qwen2.5, Qwen3, Qwen3.5, etc.
  /(?:^|\/)mistral-nemo/,
  /(?:^|\/)mistral-large/,
  /(?:^|\/)command-r/,
  /(?:^|\/)firefunction/,
  /(?:^|\/)nexusraven/
];
var OllamaProvider = class extends BaseProvider {
  constructor(config2, options = {}) {
    super(config2, options);
    this.baseUrl = options.baseUrl || config2.ollamaUrl || "http://localhost:11434";
  }
  formatTools(tools) {
    return tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters
      }
    }));
  }
  contextWindow() {
    return 32768;
  }
  supportsTools(model) {
    const name = (model || "").toLowerCase();
    return TOOL_CAPABLE_PATTERNS.some((p) => p.test(name));
  }
  async *stream(messages, systemPrompt, tools, signal) {
    validateServerUrl(this.baseUrl);
    const base = this.baseUrl.replace(/\/$/, "");
    const model = this.config.selectedModel;
    const temperature = this.config.temperature ?? 0.7;
    const msgs = [];
    if (systemPrompt) msgs.push({ role: "system", content: systemPrompt });
    for (const m of messages) {
      if (m.role === "tool_result") {
        msgs.push({
          role: "tool",
          tool_call_id: m.tool_use_id,
          content: typeof m.content === "string" ? m.content : JSON.stringify(m.content)
        });
      } else if (m.role === "assistant" && m.tool_calls) {
        msgs.push({ role: m.role, content: m.content || "", tool_calls: m.tool_calls });
      } else {
        msgs.push({ role: m.role, content: m.content });
      }
    }
    const reqBody = {
      model,
      messages: msgs,
      stream: true,
      options: { temperature }
    };
    if (tools && tools.length > 0 && this.supportsTools(model)) {
      reqBody.tools = this.formatTools(tools);
    }
    const res = await streamRequest(
      `${base}/api/chat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reqBody)
      },
      signal
    );
    let usage = null;
    for await (const line of streamLines(res)) {
      if (signal?.aborted) break;
      try {
        const obj = JSON.parse(line);
        if (obj.message?.content) {
          yield { type: "text", content: obj.message.content };
        }
        if (obj.message?.tool_calls) {
          for (const tc of obj.message.tool_calls) {
            yield {
              type: "tool_call",
              id: `ollama_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              name: tc.function?.name,
              arguments: tc.function?.arguments || {}
            };
          }
        }
        if (obj.done) {
          usage = {
            promptTokens: obj.prompt_eval_count || 0,
            outputTokens: obj.eval_count || 0,
            evalDurationNs: obj.eval_duration || null
          };
          break;
        }
      } catch {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try {
            const obj = JSON.parse(data);
            const token = obj.choices?.[0]?.delta?.content || obj.message?.content;
            if (token) yield { type: "text", content: token };
          } catch {
          }
        }
      }
    }
    if (usage) yield { type: "usage", ...usage };
    yield { type: "done" };
  }
  static formatAssistantToolUse(text, toolCalls) {
    return {
      role: "assistant",
      content: text || "",
      tool_calls: toolCalls.map((tc) => ({
        id: tc.id,
        type: "function",
        function: { name: tc.name, arguments: tc.arguments }
      }))
    };
  }
  static formatToolResult(toolCallId, result) {
    return {
      role: "tool_result",
      tool_use_id: toolCallId,
      content: typeof result === "string" ? result : JSON.stringify(result)
    };
  }
};

// ../../llamatalkbuild-engine/src/providers/google.js
var CONTEXT_WINDOWS3 = {
  "gemini-2.0-flash": 1048576,
  "gemini-2.0-flash-lite": 1048576,
  "gemini-1.5-pro": 2097152,
  "gemini-1.5-flash": 1048576
};
function toGeminiType(jsonSchemaType) {
  const map = {
    string: "STRING",
    number: "NUMBER",
    integer: "INTEGER",
    boolean: "BOOLEAN",
    array: "ARRAY",
    object: "OBJECT"
  };
  return map[jsonSchemaType] || "STRING";
}
function convertProperties(props) {
  if (!props) return {};
  const out = {};
  for (const [key, val] of Object.entries(props)) {
    out[key] = { type: toGeminiType(val.type), description: val.description || "" };
    if (val.items) out[key].items = { type: toGeminiType(val.items.type) };
    if (val.enum) out[key].enum = val.enum;
  }
  return out;
}
var GoogleProvider = class extends BaseProvider {
  formatTools(tools) {
    return [{
      functionDeclarations: tools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: {
          type: "OBJECT",
          properties: convertProperties(t.parameters.properties),
          required: t.parameters.required || []
        }
      }))
    }];
  }
  contextWindow() {
    return CONTEXT_WINDOWS3[this.config.selectedModel] || 1048576;
  }
  async *stream(messages, systemPrompt, tools, signal) {
    const apiKey = this.config.apiKey_google;
    if (!apiKey) throw new Error("Google API key not set. Use /set api-key google <key>");
    const model = this.config.selectedModel;
    const temperature = this.config.temperature ?? 0.7;
    const contents = [];
    for (const m of messages) {
      if (m.role === "system") continue;
      let converted;
      if (m.role === "tool_result") {
        converted = {
          role: "user",
          parts: [{
            functionResponse: {
              name: m.tool_name || "tool",
              response: { result: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }
            }
          }]
        };
      } else if (m.role === "assistant" && m._geminiParts) {
        converted = { role: "model", parts: m._geminiParts };
      } else {
        converted = {
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }]
        };
      }
      const last = contents[contents.length - 1];
      if (last && last.role === converted.role) {
        last.parts = [...last.parts, ...converted.parts];
      } else {
        contents.push(converted);
      }
    }
    const reqBody = { contents, generationConfig: { temperature } };
    if (systemPrompt) reqBody.systemInstruction = { parts: [{ text: systemPrompt }] };
    if (tools && tools.length > 0) {
      reqBody.tools = this.formatTools(tools);
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`;
    const res = await streamRequest(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(reqBody)
    }, signal);
    let usage = null;
    for await (const line of streamLines(res)) {
      if (signal?.aborted) break;
      if (!line.startsWith("data: ")) continue;
      try {
        const obj = JSON.parse(line.slice(6));
        const parts = obj.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
          if (part.text) {
            yield { type: "text", content: part.text };
          }
          if (part.functionCall) {
            yield {
              type: "tool_call",
              id: `gemini_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              name: part.functionCall.name,
              arguments: part.functionCall.args || {}
            };
          }
        }
        if (obj.usageMetadata) {
          usage = {
            promptTokens: obj.usageMetadata.promptTokenCount || 0,
            outputTokens: obj.usageMetadata.candidatesTokenCount || 0
          };
        }
      } catch {
      }
    }
    if (usage) yield { type: "usage", ...usage };
    yield { type: "done" };
  }
  static formatAssistantToolUse(text, toolCalls) {
    const parts = [];
    if (text) parts.push({ text });
    for (const tc of toolCalls) {
      parts.push({ functionCall: { name: tc.name, args: tc.arguments } });
    }
    return { role: "assistant", content: text || "", _geminiParts: parts };
  }
  static formatToolResult(toolCallId, result, toolName) {
    return {
      role: "tool_result",
      tool_use_id: toolCallId,
      tool_name: toolName,
      content: typeof result === "string" ? result : JSON.stringify(result)
    };
  }
};

// ../../llamatalkbuild-engine/src/providers/prompt-fallback.js
var PromptFallbackProvider = class {
  constructor(innerProvider) {
    this.inner = innerProvider;
    this.config = innerProvider.config;
  }
  contextWindow() {
    return this.inner.contextWindow();
  }
  estimateTokens(messages) {
    return this.inner.estimateTokens(messages);
  }
  formatToolsAsPrompt(tools) {
    if (!tools || tools.length === 0) return "";
    let block = `
You have access to the following tools. To use a tool, respond with a <tool_call> block:

`;
    block += `<tool_call>
{"name": "tool_name", "arguments": {"param1": "value1"}}
</tool_call>

`;
    block += `You may use multiple tool calls in a single response. Each must be in its own <tool_call> block.

`;
    block += `Available tools:
`;
    for (const t of tools) {
      block += `
- ${t.name}: ${t.description}
`;
      if (t.parameters?.properties) {
        const params = Object.entries(t.parameters.properties).map(([k, v]) => {
          const req = (t.parameters.required || []).includes(k) ? " (required)" : "";
          return `    ${k}: ${v.type} \u2014 ${v.description || ""}${req}`;
        });
        block += `  Parameters:
${params.join("\n")}
`;
      }
    }
    return block;
  }
  parseToolCalls(text) {
    const toolCalls = [];
    const regex = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g;
    let match;
    let cleanText = text;
    while ((match = regex.exec(text)) !== null) {
      try {
        const parsed = JSON.parse(match[1].trim());
        if (parsed.name) {
          toolCalls.push({
            id: `fallback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            name: parsed.name,
            arguments: parsed.arguments || {}
          });
        }
      } catch {
      }
      cleanText = cleanText.replace(match[0], "");
    }
    return { cleanText: cleanText.trim(), toolCalls };
  }
  async *stream(messages, systemPrompt, tools, signal) {
    const toolBlock = this.formatToolsAsPrompt(tools);
    const augmentedPrompt = (systemPrompt || "") + toolBlock;
    let fullText = "";
    let buffer = "";
    const otherEvents = [];
    for await (const event of this.inner.stream(messages, augmentedPrompt, null, signal)) {
      if (event.type === "text") {
        buffer += event.content;
        const tagIdx = buffer.indexOf("<tool_call>");
        if (tagIdx >= 0) {
          if (tagIdx > 0) {
            const before = buffer.slice(0, tagIdx);
            fullText += before;
            yield { type: "text", content: before };
          }
          buffer = buffer.slice(tagIdx);
        } else {
          const lastLt = buffer.lastIndexOf("<");
          if (lastLt >= 0 && buffer.length - lastLt < "<tool_call>".length) {
            if (lastLt > 0) {
              const safe = buffer.slice(0, lastLt);
              fullText += safe;
              yield { type: "text", content: safe };
              buffer = buffer.slice(lastLt);
            }
          } else {
            fullText += buffer;
            yield { type: "text", content: buffer };
            buffer = "";
          }
        }
      } else {
        otherEvents.push(event);
      }
    }
    fullText += buffer;
    const { cleanText, toolCalls } = this.parseToolCalls(fullText);
    if (toolCalls.length > 0) {
      yield { type: "clean_text", content: cleanText, rawText: fullText };
    } else if (buffer) {
      yield { type: "text", content: buffer };
    }
    for (const tc of toolCalls) {
      yield { type: "tool_call", ...tc };
    }
    for (const event of otherEvents) {
      yield event;
    }
  }
  static formatAssistantToolUse(text, toolCalls) {
    let content = text || "";
    for (const tc of toolCalls) {
      content += `
<tool_call>
${JSON.stringify({ name: tc.name, arguments: tc.arguments })}
</tool_call>`;
    }
    return { role: "assistant", content };
  }
  static formatToolResult(toolCallId, result) {
    return {
      role: "user",
      content: `Tool result for ${toolCallId}:
${typeof result === "string" ? result : JSON.stringify(result)}`
    };
  }
};

// ../../llamatalkbuild-engine/src/providers/router.js
var CLOUD_MODELS = {
  anthropic: ["claude-opus-4-5", "claude-sonnet-4-5", "claude-3-5-haiku-20241022"],
  google: ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-pro", "gemini-1.5-flash"],
  openai: ["gpt-4o", "gpt-4o-mini", "o1", "o3-mini"],
  opencode: ["claude-opus-4-6", "claude-sonnet-4-6", "gpt-5.4-pro", "gpt-5.4", "gpt-5.3-codex", "gpt-5.3-codex-spark", "gemini-3.1-pro", "gemini-3-pro", "gemini-3-flash", "minimax-m2.5", "kimi-k2.5", "big-pickle"]
};
function getProviderName(model, config2) {
  for (const [provider, models] of Object.entries(CLOUD_MODELS)) {
    if (models.includes(model)) {
      if (config2.enabledProviders?.[provider]) return provider;
    }
  }
  return "ollama";
}
function getProviderForModel(config2) {
  const model = config2.selectedModel;
  const providerName = getProviderName(model, config2);
  if (providerName === "anthropic") {
    return {
      provider: new AnthropicProvider(config2),
      providerName: "anthropic",
      formatAssistantToolUse: AnthropicProvider.formatAssistantToolUse,
      formatToolResult: AnthropicProvider.formatToolResult
    };
  }
  if (providerName === "google") {
    return {
      provider: new GoogleProvider(config2),
      providerName: "google",
      formatAssistantToolUse: GoogleProvider.formatAssistantToolUse,
      formatToolResult: GoogleProvider.formatToolResult
    };
  }
  if (providerName === "openai") {
    return {
      provider: new OpenAIProvider(config2, {
        baseUrl: "https://api.openai.com",
        apiKey: config2.apiKey_openai,
        isCloud: true
      }),
      providerName: "openai",
      formatAssistantToolUse: OpenAIProvider.formatAssistantToolUse,
      formatToolResult: OpenAIProvider.formatToolResult
    };
  }
  if (providerName === "opencode") {
    return {
      provider: new OpenAIProvider(config2, {
        baseUrl: "https://opencode.ai/zen",
        apiKey: config2.apiKey_opencode,
        isCloud: true
      }),
      providerName: "opencode",
      formatAssistantToolUse: OpenAIProvider.formatAssistantToolUse,
      formatToolResult: OpenAIProvider.formatToolResult
    };
  }
  const serverUrl = config2.modelServerMap?.[model] || config2.ollamaUrl;
  let bt = config2.backendType || "ollama";
  if (config2.serverBackendMap?.[serverUrl]) {
    bt = config2.serverBackendMap[serverUrl];
  }
  if (bt === "openai-compatible") {
    const provider = new OpenAIProvider(config2, {
      baseUrl: serverUrl,
      apiKey: null,
      isCloud: false
    });
    return {
      provider,
      providerName: "openai-compatible",
      formatAssistantToolUse: OpenAIProvider.formatAssistantToolUse,
      formatToolResult: OpenAIProvider.formatToolResult
    };
  }
  const ollamaProvider = new OllamaProvider(config2, { baseUrl: serverUrl });
  if (!ollamaProvider.supportsTools(model)) {
    const fallback = new PromptFallbackProvider(ollamaProvider);
    return {
      provider: fallback,
      providerName: "ollama-fallback",
      formatAssistantToolUse: PromptFallbackProvider.formatAssistantToolUse,
      formatToolResult: PromptFallbackProvider.formatToolResult
    };
  }
  return {
    provider: ollamaProvider,
    providerName: "ollama",
    formatAssistantToolUse: OllamaProvider.formatAssistantToolUse,
    formatToolResult: OllamaProvider.formatToolResult
  };
}
async function detectBackend(url) {
  validateServerUrl(url);
  const base = url.replace(/\/$/, "");
  let looksOllama = false;
  try {
    const res = await fetchWithTimeout(`${base}/api/tags`, {}, 1e4);
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data && Array.isArray(data.models)) looksOllama = true;
    }
  } catch {
  }
  if (looksOllama) {
    return "ollama";
  }
  try {
    const res = await fetchWithTimeout(`${base}/v1/models`, {}, 1e4);
    if (res.ok) return "openai-compatible";
  } catch {
  }
  return "unknown";
}
async function getOllamaModels(url) {
  validateServerUrl(url);
  const base = url.replace(/\/$/, "");
  const res = await fetchWithTimeout(`${base}/api/tags`, {}, 1e4);
  if (!res.ok) throw new Error(`Ollama returned ${res.status}`);
  const data = await res.json();
  return (data.models || []).map((m) => m.name);
}
async function getRunningOllamaModels(url) {
  validateServerUrl(url);
  const base = url.replace(/\/$/, "");
  const res = await fetchWithTimeout(`${base}/api/ps`, {}, 5e3);
  if (!res.ok) throw new Error(`Ollama returned ${res.status}`);
  const data = await res.json();
  return (data.models || []).map((m) => m.name);
}
async function getOpenAICompatModels(url) {
  const base = url.replace(/\/$/, "");
  const res = await fetchWithTimeout(`${base}/v1/models`, {}, 1e4);
  if (!res.ok) throw new Error(`Server returned ${res.status}`);
  const data = await res.json();
  return (data.data || []).map((m) => m.id);
}
async function getAllLocalModels(config2) {
  const servers = [config2.ollamaUrl, ...config2.localServers || []];
  const allModels = [];
  const runningModels = /* @__PURE__ */ new Set();
  const modelServerMap = {};
  const serverBackendMap = {};
  const seen = /* @__PURE__ */ new Set();
  const results = await Promise.allSettled(servers.map(async (serverUrl) => {
    const base = serverUrl.replace(/\/$/, "");
    const bt = await detectBackend(base);
    if (bt === "unknown") return null;
    let models = [];
    if (bt === "openai-compatible") {
      models = await getOpenAICompatModels(base);
    } else {
      models = await getOllamaModels(base);
    }
    let running = [];
    if (bt === "ollama") {
      try {
        running = await getRunningOllamaModels(base);
      } catch {
      }
    }
    return { base, bt, models, running };
  }));
  for (const r of results) {
    if (r.status !== "fulfilled" || !r.value) continue;
    const { base, bt, models, running } = r.value;
    serverBackendMap[base] = bt;
    for (const m of models) {
      if (!seen.has(m)) {
        seen.add(m);
        allModels.push(m);
        modelServerMap[m] = base;
      }
    }
    for (const m of running) runningModels.add(m);
  }
  return { allModels, runningModels, modelServerMap, serverBackendMap };
}

// ../../llamatalkbuild-engine/src/tools/registry.js
var ToolRegistry = class {
  constructor() {
    this.tools = /* @__PURE__ */ new Map();
  }
  register(tool) {
    if (!tool.definition?.name) {
      throw new Error("Tool must have a definition.name");
    }
    this.tools.set(tool.definition.name, tool);
  }
  get(name) {
    return this.tools.get(name);
  }
  getAll() {
    return [...this.tools.values()];
  }
  getDefinitions() {
    return this.getAll().map((t) => t.definition);
  }
  list() {
    return [...this.tools.keys()];
  }
};

// ../../llamatalkbuild-engine/src/tools/base.js
var import_path2 = require("path");
init_config();
var SafetyLevel = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high"
};
var READ_ONLY_TOOLS = /* @__PURE__ */ new Set([
  "read_file",
  "list_directory",
  "search_files",
  "glob_files",
  "web_fetch",
  "web_search"
]);
function isReadOnlyTool(toolName, args) {
  if (READ_ONLY_TOOLS.has(toolName)) return true;
  if (toolName === "git") {
    const sub = (args?.subcommand || "").split(/\s+/)[0].toLowerCase();
    const safeGit = /* @__PURE__ */ new Set(["status", "diff", "log", "branch", "show", "remote", "tag", "rev-parse", "shortlog", "blame"]);
    return safeGit.has(sub);
  }
  if ((toolName === "write_file" || toolName === "edit_file") && args?.path) {
    const memDir = getMemoryDir();
    if (memDir && (0, import_path2.resolve)(args.path).replace(/\\/g, "/").startsWith(memDir.replace(/\\/g, "/"))) return true;
  }
  return false;
}

// ../../llamatalkbuild-engine/src/safety.js
var import_path3 = require("path");
var import_fs2 = require("fs");
init_config();
function validatePath(inputPath, projectRoot, { allowExternal = false } = {}) {
  try {
    const resolved = (0, import_path3.resolve)(projectRoot, inputPath);
    const rel = (0, import_path3.relative)(projectRoot, resolved);
    const external = rel.startsWith("..") || rel.startsWith(`.${import_path3.sep}..`);
    if (external && !allowExternal) {
      return { valid: false, resolved, external: true, trusted: false, error: `Path escapes project root: ${inputPath}` };
    }
    if (!external) {
      try {
        const real = (0, import_fs2.realpathSync)(resolved);
        const realRel = (0, import_path3.relative)(projectRoot, real);
        if (realRel.startsWith("..") && !allowExternal) {
          return { valid: false, resolved, external: true, trusted: false, error: `Symlink target escapes project root: ${inputPath}` };
        }
      } catch {
      }
    }
    const trusted = external && isTrustedPath(resolved);
    return { valid: true, resolved, external, trusted };
  } catch (err) {
    return { valid: false, resolved: inputPath, external: false, trusted: false, error: err.message };
  }
}
function isTrustedPath(resolvedPath) {
  const memDir = getMemoryDir();
  const normalizedPath = resolvedPath.replace(/\\/g, "/").toLowerCase();
  const normalizedMem = memDir.replace(/\\/g, "/").toLowerCase();
  return normalizedPath.startsWith(normalizedMem);
}
var DESTRUCTIVE_PATTERNS = [
  /\brm\s+(-rf?|--recursive)\s+[\/\\]/i,
  /\brmdir\s+\/s/i,
  /\bdel\s+\/[sfq]/i,
  /\bformat\s+[a-z]:/i,
  /\bshutdown/i,
  /\breboot/i,
  /\bmkfs\b/i,
  /\bdd\s+if=/i,
  /\b>\s*\/dev\/sda/i,
  /\brm\s+-rf?\s+\//,
  /\bgit\s+push\s+.*--force/i,
  /\bgit\s+reset\s+--hard/i,
  /\bgit\s+clean\s+-[fd]/i,
  /\b(curl|wget|invoke-webrequest).*\|\s*(bash|sh|powershell|cmd)/i,
  // pipe-to-shell
  /\bchmod\s+777\b/i,
  // world-writable
  /\breg\s+(delete|add).*\\\\HKLM/i,
  // Windows registry modification
  /\bnet\s+user\b/i,
  // Windows user management
  /\bdiskpart/i
  // disk management
];
function isDestructiveCommand(command) {
  return DESTRUCTIVE_PATTERNS.some((p) => p.test(command));
}
function requireConfirmation(tool, args, config2, agentMode = "build") {
  const level = typeof tool.safetyLevel === "function" ? tool.safetyLevel(args) : tool.safetyLevel;
  if (level === "high") {
    return !config2.autoApprove?.high;
  }
  if (level === "medium") {
    return !config2.autoApprove?.medium;
  }
  return false;
}
function validatePackageName(name) {
  return /^(@[a-z0-9\-~][a-z0-9\-._~]*\/)?[a-z0-9\-~][a-z0-9\-._~]*(@[a-z0-9._\-+~^<>=*]+)?$/i.test(name);
}

// ../../llamatalkbuild-engine/src/memory/memory.js
var import_fs4 = require("fs");
var import_path5 = require("path");
init_config();

// ../../llamatalkbuild-engine/src/memory/instructions.js
var import_fs3 = require("fs");
var import_path4 = require("path");
var import_os2 = require("os");
var INSTRUCTION_FILENAMES = [".clank.md", ".clankbuild.md", "AGENTS.md"];
var LEGACY_INSTRUCTION_FILENAMES = [".llamabuild.md"];
function parseFrontmatter(raw) {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!match) return { meta: {}, content: raw.trim() };
  const meta = {};
  for (const line of match[1].split("\n")) {
    const m = line.match(/^(\w+)\s*:\s*"?(.+?)"?\s*$/);
    if (m) meta[m[1]] = m[2];
  }
  return { meta, content: match[2].trim() };
}
function discoverInstructions(projectRoot) {
  const instructions = [];
  const seen = /* @__PURE__ */ new Set();
  let globalAgentDir = (0, import_path4.join)((0, import_os2.homedir)(), ".clank", "agent");
  if (!(0, import_fs3.existsSync)(globalAgentDir)) {
    const clankBuildDir = (0, import_path4.join)((0, import_os2.homedir)(), ".clankbuild", "agent");
    if ((0, import_fs3.existsSync)(clankBuildDir)) {
      globalAgentDir = clankBuildDir;
    } else {
      const legacyDir = (0, import_path4.join)((0, import_os2.homedir)(), ".llamabuild", "agent");
      if ((0, import_fs3.existsSync)(legacyDir)) globalAgentDir = legacyDir;
    }
  }
  if ((0, import_fs3.existsSync)(globalAgentDir)) {
    try {
      for (const f of (0, import_fs3.readdirSync)(globalAgentDir)) {
        if (!f.endsWith(".md")) continue;
        const fullPath = (0, import_path4.join)(globalAgentDir, f);
        if (seen.has(fullPath)) continue;
        seen.add(fullPath);
        try {
          const raw = (0, import_fs3.readFileSync)(fullPath, "utf8");
          const { meta, content } = parseFrontmatter(raw);
          if (content) {
            instructions.push({
              source: "global",
              path: fullPath,
              name: f.replace(/\.md$/, ""),
              meta,
              content
            });
          }
        } catch {
        }
      }
    } catch {
    }
  }
  let globalAgentsMd = (0, import_path4.join)((0, import_os2.homedir)(), ".clank", "AGENTS.md");
  if (!(0, import_fs3.existsSync)(globalAgentsMd)) {
    const clankBuildPath = (0, import_path4.join)((0, import_os2.homedir)(), ".clankbuild", "AGENTS.md");
    if ((0, import_fs3.existsSync)(clankBuildPath)) {
      globalAgentsMd = clankBuildPath;
    } else {
      const legacyPath = (0, import_path4.join)((0, import_os2.homedir)(), ".llamabuild", "AGENTS.md");
      if ((0, import_fs3.existsSync)(legacyPath)) globalAgentsMd = legacyPath;
    }
  }
  if ((0, import_fs3.existsSync)(globalAgentsMd) && !seen.has(globalAgentsMd)) {
    seen.add(globalAgentsMd);
    try {
      const raw = (0, import_fs3.readFileSync)(globalAgentsMd, "utf8");
      const { meta, content } = parseFrontmatter(raw);
      if (content) {
        instructions.push({ source: "global", path: globalAgentsMd, name: "AGENTS", meta, content });
      }
    } catch {
    }
  }
  let projectAgentDir = (0, import_path4.join)(projectRoot, ".clank", "agent");
  if (!(0, import_fs3.existsSync)(projectAgentDir)) {
    const clankBuildDir = (0, import_path4.join)(projectRoot, ".clankbuild", "agent");
    if ((0, import_fs3.existsSync)(clankBuildDir)) {
      projectAgentDir = clankBuildDir;
    } else {
      const legacyDir = (0, import_path4.join)(projectRoot, ".llamabuild", "agent");
      if ((0, import_fs3.existsSync)(legacyDir)) projectAgentDir = legacyDir;
    }
  }
  if ((0, import_fs3.existsSync)(projectAgentDir)) {
    try {
      for (const f of (0, import_fs3.readdirSync)(projectAgentDir)) {
        if (!f.endsWith(".md")) continue;
        const fullPath = (0, import_path4.join)(projectAgentDir, f);
        if (seen.has(fullPath)) continue;
        seen.add(fullPath);
        try {
          const raw = (0, import_fs3.readFileSync)(fullPath, "utf8");
          const { meta, content } = parseFrontmatter(raw);
          if (content) {
            instructions.push({
              source: "project",
              path: fullPath,
              name: f.replace(/\.md$/, ""),
              meta,
              content
            });
          }
        } catch {
        }
      }
    } catch {
    }
  }
  for (const name of INSTRUCTION_FILENAMES) {
    const fullPath = (0, import_path4.join)(projectRoot, name);
    if ((0, import_fs3.existsSync)(fullPath) && !seen.has(fullPath)) {
      seen.add(fullPath);
      try {
        const raw = (0, import_fs3.readFileSync)(fullPath, "utf8");
        const { meta, content } = parseFrontmatter(raw);
        if (content) {
          instructions.push({
            source: "project",
            path: fullPath,
            name: name.replace(/\.md$/, ""),
            meta,
            content
          });
        }
      } catch {
      }
    }
  }
  for (const name of LEGACY_INSTRUCTION_FILENAMES) {
    const fullPath = (0, import_path4.join)(projectRoot, name);
    if ((0, import_fs3.existsSync)(fullPath) && !seen.has(fullPath)) {
      seen.add(fullPath);
      try {
        const raw = (0, import_fs3.readFileSync)(fullPath, "utf8");
        const { meta, content } = parseFrontmatter(raw);
        if (content) {
          instructions.push({
            source: "project",
            path: fullPath,
            name: name.replace(/\.md$/, ""),
            meta,
            content
          });
        }
      } catch {
      }
    }
  }
  let dir = (0, import_path4.dirname)(projectRoot);
  const root = (0, import_path4.resolve)("/");
  while (dir !== root && dir !== (0, import_path4.dirname)(dir)) {
    for (const name of INSTRUCTION_FILENAMES) {
      const fullPath = (0, import_path4.join)(dir, name);
      if ((0, import_fs3.existsSync)(fullPath) && !seen.has(fullPath)) {
        seen.add(fullPath);
        try {
          const raw = (0, import_fs3.readFileSync)(fullPath, "utf8");
          const { meta, content } = parseFrontmatter(raw);
          if (content) {
            instructions.push({
              source: "parent",
              path: fullPath,
              name: `${(0, import_path4.basename)(dir)}/${name.replace(/\.md$/, "")}`,
              meta,
              content
            });
          }
        } catch {
        }
      }
    }
    dir = (0, import_path4.dirname)(dir);
  }
  return instructions;
}
function buildInstructionsBlock(projectRoot) {
  const instructions = discoverInstructions(projectRoot);
  if (instructions.length === 0) return "";
  const sections = instructions.map((inst) => {
    const sourceTag = inst.source === "global" ? " (global)" : inst.source === "parent" ? " (inherited)" : "";
    const desc = inst.meta.description ? ` \u2014 ${inst.meta.description}` : "";
    return `### ${inst.name}${sourceTag}${desc}
${inst.content}`;
  });
  return `## Agent Instructions

${sections.join("\n\n")}`;
}

// ../../llamatalkbuild-engine/src/memory/memory.js
var STOPWORDS = /* @__PURE__ */ new Set([
  "the",
  "a",
  "an",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "can",
  "shall",
  "to",
  "of",
  "in",
  "for",
  "on",
  "with",
  "at",
  "by",
  "from",
  "as",
  "into",
  "through",
  "during",
  "before",
  "after",
  "above",
  "below",
  "between",
  "and",
  "but",
  "or",
  "not",
  "no",
  "all",
  "each",
  "every",
  "both",
  "few",
  "more",
  "most",
  "other",
  "some",
  "such",
  "than",
  "too",
  "very",
  "just",
  "about",
  "if",
  "then",
  "so",
  "because",
  "while",
  "although",
  "this",
  "that",
  "these",
  "those",
  "it",
  "its",
  "my",
  "your",
  "our",
  "their",
  "his",
  "her",
  "i",
  "me",
  "we",
  "you",
  "he",
  "she",
  "they",
  "them",
  "what",
  "which",
  "who",
  "how",
  "when",
  "where",
  "why",
  "please",
  "help",
  "want",
  "need",
  "make",
  "get",
  "use",
  "let",
  "also"
]);
var MemoryManager = class {
  constructor(config2, encKey = null) {
    this.globalDir = getMemoryDir();
    this.encKey = encKey;
    this._cache = /* @__PURE__ */ new Map();
    this._cacheTTL = 5e3;
    this._instructionsCache = null;
    this._instructionsCacheRoot = null;
    this.ensureDir();
  }
  /** Read a file, decrypting if needed. Cached with TTL. */
  _read(path) {
    const now = Date.now();
    const cached = this._cache.get(path);
    if (cached && now - cached.ts < this._cacheTTL) return cached.content;
    if (!(0, import_fs4.existsSync)(path)) {
      this._cache.set(path, { content: null, ts: now });
      return null;
    }
    try {
      const raw = (0, import_fs4.readFileSync)(path, "utf8");
      let content = raw;
      if (this.encKey) {
        try {
          const parsed = JSON.parse(raw);
          if (isEncryptedPayload(parsed)) content = decryptValue(parsed, this.encKey);
        } catch {
        }
      }
      this._cache.set(path, { content, ts: now });
      return content;
    } catch {
      this._cache.set(path, { content: null, ts: now });
      return null;
    }
  }
  /** Write a file, encrypting if key is available. Invalidates cache. */
  _write(path, content) {
    if (this.encKey) {
      const payload = encryptValue(content, this.encKey);
      (0, import_fs4.writeFileSync)(path, JSON.stringify(payload), "utf8");
    } else {
      (0, import_fs4.writeFileSync)(path, content, "utf8");
    }
    this._cache.set(path, { content, ts: Date.now() });
  }
  ensureDir() {
    if (!(0, import_fs4.existsSync)(this.globalDir)) {
      (0, import_fs4.mkdirSync)(this.globalDir, { recursive: true });
    }
    const memFile = (0, import_path5.join)(this.globalDir, "MEMORY.md");
    if (!(0, import_fs4.existsSync)(memFile)) {
      (0, import_fs4.writeFileSync)(memFile, "# Memory\n\n## Preferences\n(The agent will save your preferences here as it learns them.)\n\n## Projects\n(Project-specific notes will be saved here.)\n", "utf8");
    }
  }
  /** Load the global MEMORY.md file */
  loadGlobal() {
    return this._read((0, import_path5.join)(this.globalDir, "MEMORY.md"));
  }
  /** Load project-local .clank.md (falls back to .clankbuild.md, then .llamabuild.md) */
  loadProject(projectRoot) {
    const clankPath = (0, import_path5.join)(projectRoot, ".clank.md");
    if ((0, import_fs4.existsSync)(clankPath)) return this._read(clankPath);
    const clankBuildPath = (0, import_path5.join)(projectRoot, ".clankbuild.md");
    if ((0, import_fs4.existsSync)(clankBuildPath)) return this._read(clankBuildPath);
    const llamaPath = (0, import_path5.join)(projectRoot, ".llamabuild.md");
    if ((0, import_fs4.existsSync)(llamaPath)) return this._read(llamaPath);
    return null;
  }
  /** List all topic memory files (excluding MEMORY.md) */
  listTopics() {
    try {
      return (0, import_fs4.readdirSync)(this.globalDir).filter((f) => f.endsWith(".md") && f !== "MEMORY.md").map((f) => f.replace(/\.md$/, ""));
    } catch {
      return [];
    }
  }
  /** Load a specific topic memory */
  loadTopic(topicName) {
    return this._read((0, import_path5.join)(this.globalDir, `${topicName}.md`));
  }
  /** Find relevant topic memories by keyword matching */
  findRelevant(userMessage) {
    const keywords = this.extractKeywords(userMessage);
    if (keywords.length === 0) return [];
    const topics = this.listTopics();
    const scored = [];
    for (const topic of topics) {
      let score = 0;
      const topicLower = topic.toLowerCase();
      for (const kw of keywords) {
        if (topicLower.includes(kw)) score += 3;
      }
      const content = this.loadTopic(topic);
      if (content) {
        const header = content.split("\n").slice(0, 10).join(" ").toLowerCase();
        for (const kw of keywords) {
          if (header.includes(kw)) score += 1;
        }
      }
      if (score > 0) scored.push({ topic, score, content });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 3).map((s) => ({ topic: s.topic, content: s.content }));
  }
  /** Extract keywords from a message */
  extractKeywords(text) {
    return text.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOPWORDS.has(w));
  }
  /** Save global memory */
  saveGlobal(content) {
    this.ensureDir();
    this._write((0, import_path5.join)(this.globalDir, "MEMORY.md"), content);
  }
  /** Save a topic memory */
  saveTopic(topicName, content) {
    this.ensureDir();
    this._write((0, import_path5.join)(this.globalDir, `${topicName}.md`), content);
  }
  /** Append a one-line session summary to sessions.md in memory dir. */
  appendSessionSummary(sessionId, summary, date = /* @__PURE__ */ new Date()) {
    const sessFile = (0, import_path5.join)(this.globalDir, "sessions.md");
    const dateStr = date.toISOString().split("T")[0];
    const entry = `- ${dateStr} | ${summary}`;
    let content = "";
    if ((0, import_fs4.existsSync)(sessFile)) {
      try {
        content = (0, import_fs4.readFileSync)(sessFile, "utf8");
      } catch {
      }
    }
    if (!content.includes("## Recent Sessions")) {
      content = "# Session History\n\n## Recent Sessions\n";
    }
    const lines = content.split("\n");
    const headerIdx = lines.findIndex((l) => l.startsWith("## Recent Sessions"));
    const entries = lines.slice(headerIdx + 1).filter((l) => l.startsWith("- "));
    entries.push(entry);
    const trimmed = entries.slice(-30);
    const newContent = `# Session History

## Recent Sessions
${trimmed.join("\n")}
`;
    try {
      (0, import_fs4.writeFileSync)(sessFile, newContent, "utf8");
    } catch {
    }
    this._cache.delete(sessFile);
  }
  /** Load the last N session summaries for system prompt injection. */
  _loadSessionSummaries(count = 15) {
    const sessFile = (0, import_path5.join)(this.globalDir, "sessions.md");
    if (!(0, import_fs4.existsSync)(sessFile)) return null;
    try {
      const content = (0, import_fs4.readFileSync)(sessFile, "utf8");
      const entries = content.split("\n").filter((l) => l.startsWith("- "));
      if (entries.length === 0) return null;
      return entries.slice(-count).join("\n");
    } catch {
      return null;
    }
  }
  /**
   * Build the full memory block for system prompt injection.
   * Now includes agent instructions (OpenCode-style).
   */
  buildMemoryBlock(userMessage, projectRoot) {
    const sections = [];
    const instructions = this._getInstructions(projectRoot);
    if (instructions) {
      sections.push(instructions);
    }
    const global = this.loadGlobal();
    if (global) {
      sections.push(`## Global Memory
${global}`);
    }
    const project = this.loadProject(projectRoot);
    if (project) {
      sections.push(`## Project Memory
${project}`);
    }
    const relevant = this.findRelevant(userMessage);
    if (relevant.length > 0) {
      const topicBlock = relevant.map((r) => `### ${r.topic}
${r.content}`).join("\n\n");
      sections.push(`## Relevant Context
${topicBlock}`);
    }
    const sessionSummaries = this._loadSessionSummaries();
    if (sessionSummaries) {
      sections.push(`## Recent Session History
${sessionSummaries}`);
    }
    if (sections.length === 0) return "";
    return `# Memory & Instructions

${sections.join("\n\n")}`;
  }
  /**
   * Append a lesson entry to lessons.md under a category heading.
   * Categories: about_you, patterns, mistakes, solutions
   * Creates the heading if it doesn't exist, appends entry as a bullet point.
   */
  appendLesson(category, entry) {
    const lessonsPath = (0, import_path5.join)(this.globalDir, "lessons.md");
    const heading = `## ${category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`;
    let content = "";
    if ((0, import_fs4.existsSync)(lessonsPath)) {
      try {
        content = (0, import_fs4.readFileSync)(lessonsPath, "utf8");
      } catch {
      }
    }
    if (!content.includes("# Lessons")) {
      content = "# Lessons\n\n";
    }
    const bullet = `- ${entry}`;
    if (content.includes(bullet)) return;
    if (content.includes(heading)) {
      const lines = content.split("\n");
      const headIdx = lines.findIndex((l) => l.trim() === heading);
      let insertIdx = lines.length;
      for (let i = headIdx + 1; i < lines.length; i++) {
        if (lines[i].startsWith("## ")) {
          insertIdx = i;
          break;
        }
      }
      lines.splice(insertIdx, 0, bullet);
      content = lines.join("\n");
    } else {
      content = content.trimEnd() + `

${heading}
${bullet}
`;
    }
    try {
      (0, import_fs4.writeFileSync)(lessonsPath, content, "utf8");
    } catch {
    }
    this._cache.delete(lessonsPath);
  }
  /** Get cached instructions block */
  _getInstructions(projectRoot) {
    if (this._instructionsCacheRoot === projectRoot && this._instructionsCache !== null) {
      return this._instructionsCache;
    }
    const block = buildInstructionsBlock(projectRoot);
    this._instructionsCache = block || null;
    this._instructionsCacheRoot = projectRoot;
    return this._instructionsCache;
  }
};

// ../../llamatalkbuild-engine/src/memory/tasks.js
var import_fs5 = require("fs");
var import_path6 = require("path");
init_config();
var TaskManager = class {
  constructor(memoryDir = null) {
    this.memoryDir = memoryDir || getMemoryDir();
    this.tasksFile = (0, import_path6.join)(this.memoryDir, "tasks.md");
  }
  /** Parse the tasks.md file into structured data. */
  _parse() {
    if (!(0, import_fs5.existsSync)(this.tasksFile)) return { active: [], completed: [] };
    try {
      const content = (0, import_fs5.readFileSync)(this.tasksFile, "utf8");
      const lines = content.split("\n");
      const active = [];
      const completed = [];
      let section = null;
      for (const line of lines) {
        if (line.startsWith("## Active")) {
          section = "active";
          continue;
        }
        if (line.startsWith("## Completed")) {
          section = "completed";
          continue;
        }
        if (!line.startsWith("- ")) continue;
        const isDone = line.startsWith("- [x]");
        const text = line.replace(/^- \[[ x]\]\s*/, "");
        const parts = text.split(" | ");
        const description = parts[0]?.trim() || "";
        let dueDate = null;
        let created = null;
        for (const p of parts.slice(1)) {
          const t = p.trim();
          if (t.startsWith("Due: ")) dueDate = t.slice(5).trim();
          if (t.startsWith("Created: ")) created = t.slice(9).trim();
        }
        const task = { description, dueDate, created: created || (/* @__PURE__ */ new Date()).toISOString().split("T")[0] };
        if (isDone || section === "completed") {
          completed.push(task);
        } else {
          active.push(task);
        }
      }
      return { active, completed };
    } catch {
      return { active: [], completed: [] };
    }
  }
  /** Serialize tasks back to markdown. */
  _save(data) {
    const lines = ["# Tasks", ""];
    lines.push("## Active");
    for (const t of data.active) {
      let entry = `- [ ] ${t.description}`;
      if (t.dueDate) entry += ` | Due: ${t.dueDate}`;
      entry += ` | Created: ${t.created}`;
      lines.push(entry);
    }
    lines.push("");
    lines.push("## Completed");
    const recent = data.completed.slice(-20);
    for (const t of recent) {
      let entry = `- [x] ${t.description}`;
      if (t.dueDate) entry += ` | Due: ${t.dueDate}`;
      entry += ` | Created: ${t.created}`;
      lines.push(entry);
    }
    lines.push("");
    (0, import_fs5.writeFileSync)(this.tasksFile, lines.join("\n"), "utf8");
  }
  /** List all tasks. */
  list() {
    return this._parse();
  }
  /** Add a new task. Returns the created task. */
  add(description, dueDate = null) {
    const data = this._parse();
    const task = {
      description,
      dueDate: dueDate || null,
      created: (/* @__PURE__ */ new Date()).toISOString().split("T")[0]
    };
    data.active.push(task);
    this._save(data);
    return task;
  }
  /** Mark task #index (1-based) as complete. */
  complete(index) {
    const data = this._parse();
    if (index < 1 || index > data.active.length) return null;
    const [task] = data.active.splice(index - 1, 1);
    data.completed.push(task);
    this._save(data);
    return task;
  }
  /** Remove task #index (1-based) entirely. */
  remove(index) {
    const data = this._parse();
    if (index < 1 || index > data.active.length) return null;
    const [task] = data.active.splice(index - 1, 1);
    this._save(data);
    return task;
  }
  /** Get tasks that are due today or overdue. */
  getDueTasks() {
    const data = this._parse();
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    return data.active.filter((t) => t.dueDate && t.dueDate <= today);
  }
  /** Build markdown block for system prompt injection. */
  buildTaskBlock() {
    const data = this._parse();
    if (data.active.length === 0) return "";
    const lines = ["## Tasks"];
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    for (let i = 0; i < data.active.length; i++) {
      const t = data.active[i];
      const overdue = t.dueDate && t.dueDate < today;
      const dueToday = t.dueDate && t.dueDate === today;
      let marker = "";
      if (overdue) marker = " **[OVERDUE]**";
      else if (dueToday) marker = " **[DUE TODAY]**";
      let entry = `${i + 1}. ${t.description}`;
      if (t.dueDate) entry += ` (due: ${t.dueDate})`;
      entry += marker;
      lines.push(entry);
    }
    return lines.join("\n");
  }
};

// ../../llamatalkbuild-engine/src/agent.js
init_config();

// ../../llamatalkbuild-engine/src/sessions.js
var import_fs6 = require("fs");
var import_path7 = require("path");
var import_crypto2 = require("crypto");
init_config();
var MAX_SESSIONS = 50;
function getIndexPath() {
  const dir = getConversationDir();
  if (!(0, import_fs6.existsSync)(dir)) (0, import_fs6.mkdirSync)(dir, { recursive: true });
  return (0, import_path7.join)(dir, "sessions.json");
}
function loadIndex() {
  const path = getIndexPath();
  if (!(0, import_fs6.existsSync)(path)) return [];
  try {
    const raw = (0, import_fs6.readFileSync)(path, "utf8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
function saveIndex(sessions) {
  (0, import_fs6.writeFileSync)(getIndexPath(), JSON.stringify(sessions, null, 2), "utf8");
}
function generateTitle(message) {
  const clean = message.replace(/[\r\n]+/g, " ").trim();
  if (clean.length <= 60) return clean;
  const cut = clean.slice(0, 57);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 30 ? cut.slice(0, lastSpace) : cut) + "...";
}
var SessionManager = class {
  constructor() {
    this.sessions = loadIndex();
  }
  /** List all sessions, most recent first */
  list() {
    return [...this.sessions].sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed));
  }
  /** Create a new session, returns its ID */
  create(projectRoot, title) {
    const id = (0, import_crypto2.randomUUID)();
    const session = {
      id,
      title: title || "New session",
      projectRoot,
      created: (/* @__PURE__ */ new Date()).toISOString(),
      lastUsed: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.sessions.push(session);
    this._prune();
    saveIndex(this.sessions);
    return session;
  }
  /** Update session title and lastUsed */
  touch(id, title) {
    const session = this.sessions.find((s) => s.id === id);
    if (session) {
      if (title) session.title = title;
      session.lastUsed = (/* @__PURE__ */ new Date()).toISOString();
      saveIndex(this.sessions);
    }
  }
  /** Set title from first message if still default */
  autoTitle(id, firstMessage) {
    const session = this.sessions.find((s) => s.id === id);
    if (session && session.title === "New session") {
      session.title = generateTitle(firstMessage);
      saveIndex(this.sessions);
    }
  }
  /** Get a session by ID */
  get(id) {
    return this.sessions.find((s) => s.id === id) || null;
  }
  /** Get the most recent session */
  getLatest() {
    if (this.sessions.length === 0) return null;
    return [...this.sessions].sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed))[0];
  }
  /** Delete a session and its conversation file */
  delete(id) {
    this.sessions = this.sessions.filter((s) => s.id !== id);
    saveIndex(this.sessions);
    const convPath = (0, import_path7.join)(getConversationDir(), `${id}.json`);
    try {
      if ((0, import_fs6.existsSync)(convPath)) (0, import_fs6.unlinkSync)(convPath);
    } catch {
    }
  }
  /** Delete all sessions and their conversation files */
  deleteAll() {
    const convDir = getConversationDir();
    for (const s of this.sessions) {
      const convPath = (0, import_path7.join)(convDir, `${s.id}.json`);
      try {
        if ((0, import_fs6.existsSync)(convPath)) (0, import_fs6.unlinkSync)(convPath);
      } catch {
      }
    }
    this.sessions = [];
    saveIndex(this.sessions);
  }
  /** Remove oldest sessions beyond MAX_SESSIONS */
  _prune() {
    if (this.sessions.length <= MAX_SESSIONS) return;
    const sorted = [...this.sessions].sort((a, b) => new Date(a.lastUsed) - new Date(b.lastUsed));
    while (this.sessions.length > MAX_SESSIONS) {
      const oldest = sorted.shift();
      this.delete(oldest.id);
    }
  }
};

// ../../llamatalkbuild-engine/src/memory/compaction.js
var PROTECTED_RECENT_TURNS = 6;
var MIN_SAVINGS_CHARS = 5e3;
var TOOL_RESULT_ROLE = "tool";
function messageSize(msg) {
  if (typeof msg.content === "string") return msg.content.length;
  if (Array.isArray(msg.content)) {
    return msg.content.reduce((sum, part) => {
      if (typeof part === "string") return sum + part.length;
      if (part.text) return sum + part.text.length;
      return sum + JSON.stringify(part).length;
    }, 0);
  }
  return JSON.stringify(msg).length;
}
function summarizeToolResult(msg) {
  const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
  const lines = content.split("\n").length;
  const chars = content.length;
  const allLines = content.split("\n");
  if (allLines.length <= 10) return content;
  const head = allLines.slice(0, 3).join("\n");
  const tail = allLines.slice(-2).join("\n");
  return `${head}

[... ${lines - 5} lines / ${chars} chars compacted ...]

${tail}`;
}
function compactMessages(messages, { targetReduction = 5e4 } = {}) {
  if (messages.length <= PROTECTED_RECENT_TURNS) {
    return { messages: [...messages], savedChars: 0 };
  }
  const result = [...messages];
  let savedChars = 0;
  const compactableEnd = result.length - PROTECTED_RECENT_TURNS;
  for (let i = compactableEnd - 1; i >= 0; i--) {
    const msg = result[i];
    if (msg.role === TOOL_RESULT_ROLE || msg.role === "assistant" && msg.tool_call_id) {
      const originalSize = messageSize(msg);
      if (originalSize < 500) continue;
      const summary = summarizeToolResult(msg);
      const newSize = summary.length;
      const savings = originalSize - newSize;
      if (savings > 100) {
        result[i] = { ...msg, content: summary, _compacted: true };
        savedChars += savings;
      }
    }
    if (msg.role === "assistant" && typeof msg.content === "string" && msg.content.length > 3e3) {
      const truncated = msg.content.slice(0, 1e3) + `

[... response truncated during compaction, ${msg.content.length - 1e3} chars removed ...]`;
      const savings = msg.content.length - truncated.length;
      if (savings > 500) {
        result[i] = { ...msg, content: truncated, _compacted: true };
        savedChars += savings;
      }
    }
    if (savedChars >= targetReduction) break;
  }
  if (savedChars < MIN_SAVINGS_CHARS && result.length > PROTECTED_RECENT_TURNS + 2) {
    const removed = result.splice(2, compactableEnd - 2);
    const removedSize = removed.reduce((sum, m) => sum + messageSize(m), 0);
    savedChars += removedSize;
    result.splice(2, 0, {
      role: "assistant",
      content: `[Earlier conversation compacted \u2014 ${removed.length} messages removed to free context space. Key context has been preserved in the system prompt and memory.]`,
      _compacted: true
    });
  }
  return { messages: result, savedChars };
}

// ../../llamatalkbuild-engine/src/session-log.js
var import_fs7 = require("fs");
var import_path8 = require("path");
var SessionLog = class {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.filePath = (0, import_path8.join)(projectRoot, ".clank-session.md");
    this.steps = [];
    this.sessionStart = /* @__PURE__ */ new Date();
    if (!(0, import_fs7.existsSync)(this.filePath)) {
      const legacyPath = (0, import_path8.join)(projectRoot, ".clankbuild-session.md");
      if ((0, import_fs7.existsSync)(legacyPath)) {
        try {
          (0, import_fs7.renameSync)(legacyPath, this.filePath);
        } catch {
        }
      }
    }
  }
  addStep(description) {
    this.steps.push({
      time: /* @__PURE__ */ new Date(),
      description
    });
  }
  /**
   * Save the session log to disk.
   * Only writes if steps were recorded. Prepends the new session
   * after the header so most recent is on top.
   */
  save() {
    if (this.steps.length === 0) return;
    const dateStr = this.sessionStart.toISOString().split("T")[0];
    const timeStr = this.sessionStart.toISOString().split("T")[1].split(".")[0];
    const sessionBlock = [
      `## Session ${dateStr} ${timeStr}`,
      ...this.steps.map((s) => `- ${s.description}`),
      "",
      ""
    ].join("\n");
    if ((0, import_fs7.existsSync)(this.filePath)) {
      const existing = (0, import_fs7.readFileSync)(this.filePath, "utf8");
      const headerEnd = existing.indexOf("\n\n");
      if (headerEnd >= 0) {
        const header = existing.slice(0, headerEnd + 2);
        const rest = existing.slice(headerEnd + 2);
        (0, import_fs7.writeFileSync)(this.filePath, header + sessionBlock + rest, "utf8");
      } else {
        (0, import_fs7.writeFileSync)(this.filePath, existing + "\n\n" + sessionBlock, "utf8");
      }
    } else {
      const header = "# Clank Session Log\n\n";
      (0, import_fs7.writeFileSync)(this.filePath, header + sessionBlock, "utf8");
    }
  }
};

// ../../llamatalkbuild-engine/src/session-tracker.js
var import_fs8 = require("fs");
var import_path9 = require("path");
var SessionTracker = class {
  constructor(projectRoot) {
    this.projectRoot = projectRoot;
    this.sessionStart = /* @__PURE__ */ new Date();
    this.date = this._formatDate(this.sessionStart);
    this.changes = [];
    this.dirty = false;
  }
  get fileName() {
    return `session-changes-clank-${this.date}.md`;
  }
  get filePath() {
    return (0, import_path9.join)(this.projectRoot, this.fileName);
  }
  /**
   * Record a file change. Only write_file and edit_file count as "dirty".
   */
  addChange(toolName, filePath, summary) {
    const now = /* @__PURE__ */ new Date();
    const currentDate = this._formatDate(now);
    if (currentDate !== this.date) {
      this.date = currentDate;
    }
    const relPath = (0, import_path9.relative)(this.projectRoot, filePath) || filePath;
    this.changes.push({
      time: now,
      type: toolName,
      path: relPath,
      summary: summary.split("\n")[0].slice(0, 200)
    });
    if (toolName === "write_file" || toolName === "edit_file") {
      this.dirty = true;
    }
  }
  /**
   * Get the list of changes for the activity sidebar display.
   * Returns most recent N changes.
   */
  getRecentChanges(count = 15) {
    return this.changes.slice(-count);
  }
  /**
   * Save session changes to the markdown file.
   * Does nothing if no file modifications were made.
   */
  save() {
    if (!this.dirty || this.changes.length === 0) return;
    this._cleanOldFiles();
    const timeStr = this.sessionStart.toISOString().split("T")[1].split(".")[0];
    const writeChanges = this.changes.filter(
      (c) => c.type === "write_file" || c.type === "edit_file"
    );
    if (writeChanges.length === 0) return;
    const sessionBlock = [
      `## Session ${this.date} ${timeStr}`,
      "",
      ...writeChanges.map((c) => {
        const t = c.time.toISOString().split("T")[1].split(".")[0];
        return `- **${t}** \`${c.type}\` \`${c.path}\` \u2014 ${c.summary}`;
      }),
      "",
      ""
    ].join("\n");
    if ((0, import_fs8.existsSync)(this.filePath)) {
      const existing = (0, import_fs8.readFileSync)(this.filePath, "utf8");
      const headerEnd = existing.indexOf("\n\n");
      if (headerEnd >= 0) {
        const header = existing.slice(0, headerEnd + 2);
        const rest = existing.slice(headerEnd + 2);
        (0, import_fs8.writeFileSync)(this.filePath, header + sessionBlock + rest, "utf8");
      } else {
        (0, import_fs8.writeFileSync)(this.filePath, existing + "\n\n" + sessionBlock, "utf8");
      }
    } else {
      const header = `# Session Changes \u2014 Clank

Project: \`${this.projectRoot}\`

`;
      (0, import_fs8.writeFileSync)(this.filePath, header + sessionBlock, "utf8");
    }
  }
  /**
   * Remove session-changes-llamabuild-*.md files with older dates
   * (keeps only the current date's file).
   */
  _cleanOldFiles() {
    try {
      const files = (0, import_fs8.readdirSync)(this.projectRoot);
      const pattern = /^session-changes-(?:llamabuild|clankbuild|clank)-(\d{4}-\d{2}-\d{2})\.md$/;
      for (const f of files) {
        const match = f.match(pattern);
        if (match && match[1] !== this.date) {
          const oldPath = (0, import_path9.join)(this.projectRoot, f);
          const oldContent = (0, import_fs8.readFileSync)(oldPath, "utf8");
          const headerEnd = oldContent.indexOf("\n\n");
          if (headerEnd >= 0) {
            const blocks = oldContent.slice(headerEnd + 2);
            const projectHeader = oldContent.includes("Project:") ? "" : "";
            if ((0, import_fs8.existsSync)(this.filePath)) {
              const current = (0, import_fs8.readFileSync)(this.filePath, "utf8");
              (0, import_fs8.writeFileSync)(this.filePath, current + blocks, "utf8");
            }
          }
          try {
            (0, import_fs8.unlinkSync)(oldPath);
          } catch {
          }
        }
      }
    } catch {
    }
  }
  _formatDate(d) {
    return d.toISOString().split("T")[0];
  }
};

// ../../llamatalkbuild-engine/src/context/context.js
var import_fs9 = require("fs");
var import_path10 = require("path");
function detectProjectContext(projectRoot) {
  const context = [];
  if ((0, import_fs9.existsSync)((0, import_path10.join)(projectRoot, "package.json"))) {
    try {
      const pkg = JSON.parse((0, import_fs9.readFileSync)((0, import_path10.join)(projectRoot, "package.json"), "utf8"));
      context.push(`Node.js project: ${pkg.name || "unnamed"} v${pkg.version || "?"}`);
      if (pkg.dependencies) {
        const deps = Object.keys(pkg.dependencies).slice(0, 10);
        context.push(`Dependencies: ${deps.join(", ")}`);
      }
    } catch {
    }
  }
  if ((0, import_fs9.existsSync)((0, import_path10.join)(projectRoot, "pyproject.toml")) || (0, import_fs9.existsSync)((0, import_path10.join)(projectRoot, "setup.py"))) {
    context.push("Python project");
  }
  if ((0, import_fs9.existsSync)((0, import_path10.join)(projectRoot, "Cargo.toml"))) {
    context.push("Rust project");
  }
  if ((0, import_fs9.existsSync)((0, import_path10.join)(projectRoot, "go.mod"))) {
    context.push("Go project");
  }
  if ((0, import_fs9.existsSync)((0, import_path10.join)(projectRoot, ".git"))) {
    context.push("Git repository");
  }
  try {
    const items = (0, import_fs9.readdirSync)(projectRoot).filter((f) => !f.startsWith(".") && f !== "node_modules" && f !== "dist" && f !== "build").slice(0, 20);
    context.push(`Top-level: ${items.join(", ")}`);
  } catch {
  }
  return context.join("\n") || "Unknown project type";
}

// ../../llamatalkbuild-engine/src/tools/read-file.js
var import_fs10 = require("fs");
var import_path11 = require("path");
var import_child_process2 = require("child_process");
var BINARY_EXTENSIONS = /* @__PURE__ */ new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".bmp",
  ".ico",
  ".webp",
  ".svg",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".otf",
  ".mp3",
  ".mp4",
  ".avi",
  ".mov",
  ".mkv",
  ".wav",
  ".flac",
  ".zip",
  ".tar",
  ".gz",
  ".7z",
  ".rar",
  ".bz2",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".bin",
  ".db",
  ".sqlite",
  ".lock"
]);
function isBinaryFile(filePath) {
  const ext = (0, import_path11.extname)(filePath).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) return true;
  try {
    const buf = (0, import_fs10.readFileSync)(filePath, { encoding: null, flag: "r" });
    const sample = buf.subarray(0, Math.min(512, buf.length));
    for (let i = 0; i < sample.length; i++) {
      if (sample[i] === 0) return true;
    }
  } catch {
  }
  return false;
}
function extractPdfText(filePath) {
  try {
    const result = (0, import_child_process2.spawnSync)("pdftotext", [filePath, "-"], { maxBuffer: 1024 * 1024, timeout: 1e4 });
    if (result.status === 0) return result.stdout.toString("utf8");
  } catch {
  }
  try {
    const ps = `$pdf = [System.IO.File]::ReadAllBytes('${filePath.replace(/'/g, "''")}'); $text = [System.Text.Encoding]::UTF8.GetString($pdf); $matches = [regex]::Matches($text, '\\(([^)]+)\\)'); $result = ($matches | ForEach-Object { $_.Groups[1].Value }) -join ' '; if ($result.Length -gt 0) { $result } else { '[Could not extract text]' }`;
    const encoded = Buffer.from(ps, "utf16le").toString("base64");
    const result = (0, import_child_process2.spawnSync)("powershell", ["-NoProfile", "-EncodedCommand", encoded], {
      maxBuffer: 1024 * 1024,
      timeout: 1e4
    });
    if (result.status === 0) return result.stdout.toString("utf8").trim();
  } catch {
  }
  return "[PDF text extraction not available. Install pdftotext (poppler-utils) for PDF support.]";
}
var readFileTool = {
  definition: {
    name: "read_file",
    description: "Read the contents of a file at the given path. Returns the file content with line numbers. Supports txt, md, json, csv, pdf, and other text formats. For large files, use offset and limit to read specific ranges. Supports absolute paths for files outside the project (requires confirmation).",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path (absolute or relative to project root)" },
        offset: { type: "integer", description: "Line number to start reading from (1-based)" },
        limit: { type: "integer", description: "Maximum number of lines to read" }
      },
      required: ["path"]
    }
  },
  safetyLevel(args) {
    const result = validatePath(args?.path || "", process.cwd(), { allowExternal: true });
    if (result.external && result.trusted) return SafetyLevel.LOW;
    if (result.external) return SafetyLevel.MEDIUM;
    return SafetyLevel.LOW;
  },
  validate(args, context) {
    if (!args.path) return { ok: false, error: "path is required" };
    const { valid, error } = validatePath(args.path, context.projectRoot, { allowExternal: true });
    if (!valid) return { ok: false, error };
    return { ok: true };
  },
  async execute(args, context) {
    const { valid, resolved, error } = validatePath(args.path, context.projectRoot, { allowExternal: true });
    if (!valid) return `Error: ${error}`;
    if (!(0, import_fs10.existsSync)(resolved)) {
      return `Error: File not found: ${args.path}`;
    }
    const ext = (0, import_path11.extname)(resolved).toLowerCase();
    if (ext === ".pdf") {
      try {
        const stat = (0, import_fs10.statSync)(resolved);
        const sizeMB = (stat.size / 1048576).toFixed(1);
        const text = extractPdfText(resolved);
        const lines = text.split("\n");
        const offset = Math.max(1, args.offset || 1);
        const limit = args.limit || lines.length;
        const sliced = lines.slice(offset - 1, offset - 1 + limit);
        let result = `[PDF: ${args.path} (${sizeMB} MB)]

` + sliced.join("\n");
        if (result.length > 3e4) {
          result = result.slice(0, 3e4) + `
... [truncated]`;
        }
        return result;
      } catch (err) {
        return `Error reading PDF: ${err.message}`;
      }
    }
    if (isBinaryFile(resolved)) {
      const stat = (0, import_fs10.statSync)(resolved);
      const sizeMB = (stat.size / 1048576).toFixed(2);
      return `[Binary file: ${args.path} (${ext || "unknown"}, ${sizeMB} MB) \u2014 cannot display contents]`;
    }
    try {
      const content = (0, import_fs10.readFileSync)(resolved, "utf8");
      const lines = content.split("\n");
      const offset = Math.max(1, args.offset || 1);
      const limit = args.limit || lines.length;
      const sliced = lines.slice(offset - 1, offset - 1 + limit);
      const numbered = sliced.map((line, i) => {
        const lineNum = (offset + i).toString().padStart(6, " ");
        return `${lineNum}	${line}`;
      });
      let result = numbered.join("\n");
      if (result.length > 3e4) {
        result = result.slice(0, 3e4) + `
... [truncated, ${result.length - 3e4} more chars]`;
      }
      return result;
    } catch (err) {
      return `Error reading file: ${err.message}`;
    }
  },
  formatConfirmation(args) {
    const result = validatePath(args.path, process.cwd(), { allowExternal: true });
    if (result.external) return `Read file outside project: ${args.path}`;
    return `Read file: ${args.path}`;
  }
};

// ../../llamatalkbuild-engine/src/tools/write-file.js
var import_fs11 = require("fs");
var import_path12 = require("path");
var writeFileTool = {
  definition: {
    name: "write_file",
    description: "Write content to a file. Creates parent directories if needed. Overwrites existing files entirely. Supports absolute paths for files outside the project (requires confirmation).",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path to write to" },
        content: { type: "string", description: "The full content to write" }
      },
      required: ["path", "content"]
    }
  },
  safetyLevel(args) {
    const result = validatePath(args?.path || "", process.cwd(), { allowExternal: true });
    if (result.external && result.trusted) return SafetyLevel.MEDIUM;
    if (result.external) return SafetyLevel.HIGH;
    return SafetyLevel.MEDIUM;
  },
  validate(args, context) {
    if (!args.path) return { ok: false, error: "path is required" };
    if (args.content == null || typeof args.content !== "string") return { ok: false, error: "content is required and must be a string" };
    const { valid, error } = validatePath(args.path, context.projectRoot, { allowExternal: true });
    if (!valid) return { ok: false, error };
    return { ok: true };
  },
  async execute(args, context) {
    const { resolved } = validatePath(args.path, context.projectRoot, { allowExternal: true });
    if ((0, import_fs11.existsSync)(resolved)) {
      try {
        const oldContent = (0, import_fs11.readFileSync)(resolved, "utf8");
        context.sessionChanges?.push({
          type: "write",
          path: resolved,
          oldContent,
          timestamp: Date.now()
        });
      } catch {
      }
    } else {
      context.sessionChanges?.push({
        type: "create",
        path: resolved,
        timestamp: Date.now()
      });
    }
    const dir = (0, import_path12.dirname)(resolved);
    if (!(0, import_fs11.existsSync)(dir)) {
      (0, import_fs11.mkdirSync)(dir, { recursive: true });
    }
    (0, import_fs11.writeFileSync)(resolved, args.content, "utf8");
    const bytes = Buffer.byteLength(args.content, "utf8");
    return `Successfully wrote ${bytes} bytes to ${args.path}`;
  },
  formatConfirmation(args) {
    const bytes = Buffer.byteLength(args.content || "", "utf8");
    const result = validatePath(args.path, process.cwd(), { allowExternal: true });
    if (result.external) return `Write ${bytes} bytes outside project to ${args.path}?`;
    return `Write ${bytes} bytes to ${args.path}?`;
  }
};

// ../../llamatalkbuild-engine/src/tools/edit-file.js
var import_fs12 = require("fs");
var editFileTool = {
  definition: {
    name: "edit_file",
    description: "Make targeted edits to a file using search-and-replace. Provide the exact text to find and the replacement text. The old_text must appear exactly once in the file.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path to edit" },
        old_text: { type: "string", description: "Exact text to find (must match uniquely)" },
        new_text: { type: "string", description: "Replacement text" }
      },
      required: ["path", "old_text", "new_text"]
    }
  },
  safetyLevel(args) {
    const result = validatePath(args?.path || "", process.cwd(), { allowExternal: true });
    if (result.external && result.trusted) return SafetyLevel.MEDIUM;
    if (result.external) return SafetyLevel.HIGH;
    return SafetyLevel.MEDIUM;
  },
  validate(args, context) {
    if (!args.path) return { ok: false, error: "path is required" };
    if (!args.old_text) return { ok: false, error: "old_text is required" };
    if (args.new_text == null || typeof args.new_text !== "string") return { ok: false, error: "new_text is required and must be a string" };
    const { valid, error } = validatePath(args.path, context.projectRoot, { allowExternal: true });
    if (!valid) return { ok: false, error };
    return { ok: true };
  },
  async execute(args, context) {
    const { resolved } = validatePath(args.path, context.projectRoot, { allowExternal: true });
    if (!(0, import_fs12.existsSync)(resolved)) {
      return `Error: File not found: ${args.path}`;
    }
    const content = (0, import_fs12.readFileSync)(resolved, "utf8");
    const occurrences = content.split(args.old_text).length - 1;
    if (occurrences === 0) {
      return `Error: old_text not found in ${args.path}. Make sure you're using the exact text from the file.`;
    }
    if (occurrences > 1) {
      return `Error: old_text found ${occurrences} times in ${args.path}. Provide more surrounding context to make the match unique.`;
    }
    context.sessionChanges?.push({
      type: "edit",
      path: resolved,
      oldContent: content,
      timestamp: Date.now()
    });
    const newContent = content.replace(args.old_text, args.new_text);
    (0, import_fs12.writeFileSync)(resolved, newContent, "utf8");
    const oldLines = args.old_text.split("\n").length;
    const newLines = args.new_text.split("\n").length;
    return `Successfully edited ${args.path}: replaced ${oldLines} line(s) with ${newLines} line(s)`;
  },
  formatConfirmation(args) {
    const preview = args.old_text.split("\n")[0].slice(0, 60);
    const result = validatePath(args.path, process.cwd(), { allowExternal: true });
    if (result.external) return `Edit file outside project: ${args.path}? (replacing "${preview}...")`;
    return `Edit ${args.path}? (replacing "${preview}...")`;
  }
};

// ../../llamatalkbuild-engine/src/tools/list-directory.js
var import_fs13 = require("fs");
var import_path13 = require("path");
var IGNORED = /* @__PURE__ */ new Set(["node_modules", ".git", "dist", "build", "__pycache__", ".next", ".venv", "venv", "target"]);
var listDirectoryTool = {
  definition: {
    name: "list_directory",
    description: "List the contents of a directory. Returns file/directory names with types. Filters out common build/dependency directories by default.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Directory path (default: project root)" },
        recursive: { type: "boolean", description: "List recursively (max depth 3)" }
      },
      required: []
    }
  },
  safetyLevel(args) {
    if (!args?.path) return SafetyLevel.LOW;
    const result = validatePath(args.path, process.cwd(), { allowExternal: true });
    if (result.external && result.trusted) return SafetyLevel.LOW;
    if (result.external) return SafetyLevel.MEDIUM;
    return SafetyLevel.LOW;
  },
  validate(args, context) {
    if (args.path) {
      const { valid, error } = validatePath(args.path, context.projectRoot, { allowExternal: true });
      if (!valid) return { ok: false, error };
    }
    return { ok: true };
  },
  async execute(args, context) {
    const targetPath = args.path ? validatePath(args.path, context.projectRoot, { allowExternal: true }).resolved : context.projectRoot;
    const entries = [];
    const maxEntries = 500;
    function walk(dir, depth) {
      if (entries.length >= maxEntries) return;
      try {
        const items = (0, import_fs13.readdirSync)(dir);
        for (const item of items) {
          if (entries.length >= maxEntries) break;
          if (IGNORED.has(item)) continue;
          if (item.startsWith(".") && item !== ".env" && item !== ".gitignore") continue;
          const fullPath = (0, import_path13.join)(dir, item);
          try {
            const stat = (0, import_fs13.statSync)(fullPath);
            const rel = (0, import_path13.relative)(context.projectRoot, fullPath);
            const prefix = "  ".repeat(depth);
            if (stat.isDirectory()) {
              entries.push(`${prefix}${item}/`);
              if (args.recursive && depth < 3) {
                walk(fullPath, depth + 1);
              }
            } else {
              const size = stat.size;
              const sizeStr = size < 1024 ? `${size}B` : size < 1048576 ? `${(size / 1024).toFixed(1)}KB` : `${(size / 1048576).toFixed(1)}MB`;
              entries.push(`${prefix}${item}  (${sizeStr})`);
            }
          } catch {
          }
        }
      } catch (err) {
        entries.push(`Error reading directory: ${err.message}`);
      }
    }
    walk(targetPath, 0);
    if (entries.length >= maxEntries) {
      entries.push(`... [limited to ${maxEntries} entries]`);
    }
    return entries.join("\n") || "Empty directory";
  },
  formatConfirmation(args) {
    return `List directory: ${args.path || "."}`;
  }
};

// ../../llamatalkbuild-engine/src/tools/search-files.js
var import_fs14 = require("fs");
var import_path14 = require("path");
var IGNORED_DIRS = /* @__PURE__ */ new Set(["node_modules", ".git", "dist", "build", "__pycache__", ".next", ".venv", "venv", "target", ".cache"]);
var BINARY_EXTENSIONS2 = /* @__PURE__ */ new Set([".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".svg", ".woff", ".woff2", ".ttf", ".eot", ".mp3", ".mp4", ".avi", ".zip", ".tar", ".gz", ".exe", ".dll", ".so", ".dylib", ".pdf", ".lock"]);
var searchFilesTool = {
  definition: {
    name: "search_files",
    description: "Search for a regex pattern across files in the project. Returns matching lines with file paths and line numbers.",
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Regex pattern to search for" },
        path: { type: "string", description: "Directory to search in (default: project root)" },
        glob: { type: "string", description: "File glob pattern to filter (e.g., '*.js', '*.ts')" },
        max_results: { type: "integer", description: "Maximum results to return (default: 50)" }
      },
      required: ["pattern"]
    }
  },
  safetyLevel(args) {
    if (!args?.path) return SafetyLevel.LOW;
    const result = validatePath(args.path, process.cwd(), { allowExternal: true });
    if (result.external && result.trusted) return SafetyLevel.LOW;
    if (result.external) return SafetyLevel.MEDIUM;
    return SafetyLevel.LOW;
  },
  validate(args, context) {
    if (!args.pattern) return { ok: false, error: "pattern is required" };
    if (args.pattern.length > 500) {
      return { ok: false, error: "Pattern too long (max 500 characters)" };
    }
    try {
      new RegExp(args.pattern);
    } catch (e) {
      return { ok: false, error: `Invalid regex: ${e.message}` };
    }
    return { ok: true };
  },
  async execute(args, context) {
    const searchRoot = args.path ? validatePath(args.path, context.projectRoot, { allowExternal: true }).resolved : context.projectRoot;
    let regex;
    try {
      regex = new RegExp(args.pattern, "i");
    } catch (e) {
      return `Invalid regex pattern: ${e.message}`;
    }
    const maxResults = args.max_results || 50;
    const results = [];
    let globPattern = null;
    if (args.glob) {
      let gRe = "";
      for (let i = 0; i < args.glob.length; i++) {
        const ch = args.glob[i];
        if (ch === "*") {
          gRe += ".*";
        } else if (ch === "?") {
          gRe += ".";
        } else if (".+^${}()|[]\\".includes(ch)) {
          gRe += "\\" + ch;
        } else {
          gRe += ch;
        }
      }
      globPattern = new RegExp("^" + gRe + "$");
    }
    function walk(dir) {
      if (results.length >= maxResults) return;
      try {
        const items = (0, import_fs14.readdirSync)(dir);
        for (const item of items) {
          if (results.length >= maxResults) break;
          if (IGNORED_DIRS.has(item)) continue;
          const fullPath = (0, import_path14.join)(dir, item);
          try {
            const stat = (0, import_fs14.statSync)(fullPath);
            if (stat.isDirectory()) {
              walk(fullPath);
            } else if (stat.isFile()) {
              const ext = (0, import_path14.extname)(item).toLowerCase();
              if (BINARY_EXTENSIONS2.has(ext)) continue;
              if (stat.size > 1048576) continue;
              if (globPattern && !globPattern.test(item)) continue;
              try {
                const content = (0, import_fs14.readFileSync)(fullPath, "utf8");
                const lines = content.split("\n");
                for (let i = 0; i < lines.length; i++) {
                  if (results.length >= maxResults) break;
                  if (regex.test(lines[i])) {
                    const rel = (0, import_path14.relative)(context.projectRoot, fullPath);
                    const trimmedLine = lines[i].length > 200 ? lines[i].slice(0, 200) + "..." : lines[i];
                    results.push(`${rel}:${i + 1}: ${trimmedLine}`);
                  }
                }
              } catch {
              }
            }
          } catch {
          }
        }
      } catch {
      }
    }
    walk(searchRoot);
    if (results.length === 0) {
      return `No matches found for pattern: ${args.pattern}`;
    }
    let output = results.join("\n");
    if (results.length >= maxResults) {
      output += `
... [limited to ${maxResults} results]`;
    }
    return output;
  },
  formatConfirmation(args) {
    return `Search for: ${args.pattern}`;
  }
};

// ../../llamatalkbuild-engine/src/tools/glob-files.js
var import_fs15 = require("fs");
var import_path15 = require("path");
var IGNORED_DIRS2 = /* @__PURE__ */ new Set(["node_modules", ".git", "dist", "build", "__pycache__", ".next", ".venv", "venv", "target", ".cache"]);
function globToRegex(pattern) {
  const normalized = pattern.replace(/\\/g, "/");
  let regex = "";
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (ch === "*" && normalized[i + 1] === "*") {
      regex += ".*";
      i++;
      if (normalized[i + 1] === "/") i++;
    } else if (ch === "*") {
      regex += "[^/]*";
    } else if (ch === "?") {
      regex += "[^/]";
    } else if (".+^${}()|[]".includes(ch)) {
      regex += "\\" + ch;
    } else {
      regex += ch;
    }
  }
  return new RegExp("^" + regex + "$");
}
var globFilesTool = {
  definition: {
    name: "glob_files",
    description: "Find files matching a glob pattern. Returns file paths sorted by modification time. Supports ** for recursive matching.",
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Glob pattern (e.g., '**/*.js', 'src/**/*.ts')" },
        path: { type: "string", description: "Base directory (default: project root)" }
      },
      required: ["pattern"]
    }
  },
  safetyLevel(args) {
    if (!args?.path) return SafetyLevel.LOW;
    const result = validatePath(args.path, process.cwd(), { allowExternal: true });
    if (result.external && result.trusted) return SafetyLevel.LOW;
    if (result.external) return SafetyLevel.MEDIUM;
    return SafetyLevel.LOW;
  },
  validate(args, context) {
    if (!args.pattern) return { ok: false, error: "pattern is required" };
    return { ok: true };
  },
  async execute(args, context) {
    const baseDir = args.path ? validatePath(args.path, context.projectRoot, { allowExternal: true }).resolved : context.projectRoot;
    const regex = globToRegex(args.pattern);
    const results = [];
    const maxResults = 200;
    function walk(dir) {
      if (results.length >= maxResults) return;
      try {
        const items = (0, import_fs15.readdirSync)(dir);
        for (const item of items) {
          if (results.length >= maxResults) break;
          if (IGNORED_DIRS2.has(item)) continue;
          const fullPath = (0, import_path15.join)(dir, item);
          try {
            const stat = (0, import_fs15.statSync)(fullPath);
            const rel = (0, import_path15.relative)(baseDir, fullPath).replace(/\\/g, "/");
            if (stat.isDirectory()) {
              walk(fullPath);
            } else if (stat.isFile()) {
              if (regex.test(rel)) {
                results.push({ path: rel, mtime: stat.mtimeMs });
              }
            }
          } catch {
          }
        }
      } catch {
      }
    }
    walk(baseDir);
    results.sort((a, b) => b.mtime - a.mtime);
    if (results.length === 0) {
      return `No files matching pattern: ${args.pattern}`;
    }
    let output = results.map((r) => r.path).join("\n");
    if (results.length >= maxResults) {
      output += `
... [limited to ${maxResults} results]`;
    }
    return output;
  },
  formatConfirmation(args) {
    return `Find files matching: ${args.pattern}`;
  }
};

// ../../llamatalkbuild-engine/src/tools/bash.js
var import_child_process3 = require("child_process");
var bashTool = {
  definition: {
    name: "bash",
    description: "Execute a shell command. Use for build commands, running tests, installing dependencies, or any CLI operations. Commands run in the project root by default.",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "The shell command to execute" },
        timeout: { type: "integer", description: "Timeout in milliseconds (default: 120000, max: 600000)" },
        cwd: { type: "string", description: "Working directory (default: project root)" }
      },
      required: ["command"]
    }
  },
  safetyLevel: SafetyLevel.HIGH,
  validate(args, context) {
    if (!args.command) return { ok: false, error: "command is required" };
    if (isDestructiveCommand(args.command)) {
      return { ok: false, error: `Blocked destructive command: ${args.command}` };
    }
    if (args.cwd) {
      const { valid, error } = validatePath(args.cwd, context.projectRoot, { allowExternal: true });
      if (!valid) return { ok: false, error };
    }
    return { ok: true };
  },
  async execute(args, context) {
    const timeout = Math.min(args.timeout || 12e4, 6e5);
    const cwd = args.cwd ? validatePath(args.cwd, context.projectRoot, { allowExternal: true }).resolved : context.projectRoot;
    try {
      const output = (0, import_child_process3.execSync)(args.command, {
        cwd,
        timeout,
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
        // 10MB
        stdio: ["pipe", "pipe", "pipe"],
        shell: true
      });
      let result = output || "(no output)";
      if (result.length > 3e4) {
        result = result.slice(0, 3e4) + `
... [truncated, ${result.length - 3e4} more chars]`;
      }
      return `Exit code: 0
${result}`;
    } catch (err) {
      let output = "";
      if (err.stdout) output += err.stdout;
      if (err.stderr) output += (output ? "\n" : "") + err.stderr;
      if (!output) output = err.message;
      if (output.length > 3e4) {
        output = output.slice(0, 3e4) + `
... [truncated]`;
      }
      return `Exit code: ${err.status ?? 1}
${output}`;
    }
  },
  formatConfirmation(args) {
    return `Execute: ${args.command}`;
  }
};

// ../../llamatalkbuild-engine/src/tools/git.js
var import_child_process4 = require("child_process");
var SAFE_SUBCOMMANDS = /* @__PURE__ */ new Set(["status", "diff", "log", "branch", "show", "remote", "tag", "rev-parse", "shortlog", "blame"]);
function getSubcommand(args) {
  return (args.subcommand || "").split(/\s+/)[0].toLowerCase();
}
function parseGitArgs(subcommand, extra) {
  const combined = extra ? `${subcommand} ${extra}` : subcommand;
  const args = [];
  const regex = /(?:"([^"]*)")|(?:'([^']*)')|(\S+)/g;
  let match;
  while ((match = regex.exec(combined)) !== null) {
    args.push(match[1] ?? match[2] ?? match[3]);
  }
  return args;
}
var gitTool = {
  definition: {
    name: "git",
    description: "Execute git operations. Safe operations (status, diff, log, branch, show) run automatically. Mutations (commit, push, checkout, reset) need confirmation.",
    parameters: {
      type: "object",
      properties: {
        subcommand: { type: "string", description: `Git subcommand (e.g., 'status', 'diff', 'log --oneline -10', 'commit -m "message"')` },
        args: { type: "string", description: "Additional arguments (appended to subcommand)" }
      },
      required: ["subcommand"]
    }
  },
  // Dynamic safety level
  safetyLevel(args) {
    const sub = getSubcommand(args);
    if (SAFE_SUBCOMMANDS.has(sub)) return SafetyLevel.LOW;
    return SafetyLevel.HIGH;
  },
  validate(args, context) {
    if (!args.subcommand) return { ok: false, error: "subcommand is required" };
    const fullCmd = `git ${args.subcommand}${args.args ? " " + args.args : ""}`;
    if (/push\s+.*--force/.test(fullCmd) && /(main|master)/.test(fullCmd)) {
      return { ok: false, error: "Force push to main/master is blocked" };
    }
    if (/reset\s+--hard/.test(fullCmd)) {
      return { ok: false, error: "git reset --hard is blocked. Use a safer alternative." };
    }
    return { ok: true };
  },
  async execute(args, context) {
    const gitArgs = parseGitArgs(args.subcommand, args.args);
    try {
      const result = (0, import_child_process4.spawnSync)("git", gitArgs, {
        cwd: context.projectRoot,
        timeout: 3e4,
        encoding: "utf8",
        maxBuffer: 5 * 1024 * 1024,
        stdio: ["pipe", "pipe", "pipe"]
      });
      if (result.status !== 0) {
        let output2 = "";
        if (result.stdout) output2 += result.stdout;
        if (result.stderr) output2 += (output2 ? "\n" : "") + result.stderr;
        return output2 || `Git error (exit code ${result.status})`;
      }
      let output = result.stdout || "(no output)";
      if (output.length > 3e4) {
        output = output.slice(0, 3e4) + `
... [truncated]`;
      }
      return output;
    } catch (err) {
      return `Git error: ${err.message}`;
    }
  },
  formatConfirmation(args) {
    return `Run: git ${args.subcommand}${args.args ? " " + args.args : ""}?`;
  }
};

// ../../llamatalkbuild-engine/src/tools/web-fetch.js
function stripHtml(html) {
  let text = html;
  let prev;
  do {
    prev = text;
    text = text.replace(/<script[\s\S]*?<\/script[^>]*>/gi, "");
  } while (text !== prev);
  do {
    prev = text;
    text = text.replace(/<style[\s\S]*?<\/style[^>]*>/gi, "");
  } while (text !== prev);
  do {
    prev = text;
    text = text.replace(/<[^>]+>/g, " ");
  } while (text !== prev);
  text = text.replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
  return text;
}
var webFetchTool = {
  definition: {
    name: "web_fetch",
    description: "Fetch the content of a URL and return it as text. HTML pages are converted to readable text by stripping tags.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to fetch (http or https)" }
      },
      required: ["url"]
    }
  },
  safetyLevel: SafetyLevel.LOW,
  validate(args) {
    if (!args.url) return { ok: false, error: "url is required" };
    try {
      const parsed = new URL(args.url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { ok: false, error: "URL must use http or https" };
      }
      const h = parsed.hostname.replace(/^\[|\]$/g, "");
      if (/^169\.254\./i.test(h) || // link-local IPv4
      h === "0.0.0.0" || // null-bind
      /^(::1?|0{0,4}(:0{0,4}){0,6}:0{0,4}1)$/i.test(h) || // IPv6 loopback (::1, 0:0:0:0:0:0:0:1, etc.)
      /^(::ffff:)?127\./i.test(h) || // IPv4 loopback (127.x.x.x, IPv4-mapped)
      /^(::ffff:)?0\.0\.0\.0$/i.test(h) || // IPv4-mapped null-bind
      /^(::ffff:)?169\.254\./i.test(h) || // IPv4-mapped link-local
      /^(fe80|fc00|fd00)::/i.test(h) || // IPv6 link-local & private
      /^10\./i.test(h) || // RFC1918 10.x
      /^172\.(1[6-9]|2\d|3[01])\./i.test(h) || // RFC1918 172.16-31.x
      /^192\.168\./i.test(h)) {
        return { ok: false, error: "Private, link-local, and loopback addresses are not permitted" };
      }
      if (parsed.protocol === "http:" && h !== "localhost" && !h.startsWith("127.")) {
        return { ok: false, error: "HTTP is only allowed for localhost. Use HTTPS for remote URLs." };
      }
    } catch {
      return { ok: false, error: "Invalid URL" };
    }
    return { ok: true };
  },
  async execute(args) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3e4);
      let currentUrl = args.url;
      let res;
      const MAX_REDIRECTS = 5;
      for (let i = 0; i <= MAX_REDIRECTS; i++) {
        res = await fetch(currentUrl, {
          signal: controller.signal,
          headers: { "User-Agent": "Clank-Build/0.1.0" },
          redirect: "manual"
        });
        if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
          const location = new URL(res.headers.get("location"), currentUrl);
          const rh = location.hostname.replace(/^\[|\]$/g, "");
          if (/^169\.254\./i.test(rh) || rh === "0.0.0.0" || /^(::1?|0{0,4}(:0{0,4}){0,6}:0{0,4}1)$/i.test(rh) || /^(::ffff:)?127\./i.test(rh) || /^(::ffff:)?0\.0\.0\.0$/i.test(rh) || /^(::ffff:)?169\.254\./i.test(rh) || /^(fe80|fc00|fd00)::/i.test(rh) || /^10\./i.test(rh) || /^172\.(1[6-9]|2\d|3[01])\./i.test(rh) || /^192\.168\./i.test(rh)) {
            return "Error: Redirect to a private/loopback address was blocked (SSRF protection).";
          }
          if (location.protocol === "http:" && rh !== "localhost" && !rh.startsWith("127.")) {
            return "Error: Redirect to insecure HTTP URL was blocked. Only HTTPS is allowed for remote URLs.";
          }
          currentUrl = location.href;
          continue;
        }
        break;
      }
      clearTimeout(timer);
      if (!res.ok) {
        return `HTTP ${res.status}: ${res.statusText}`;
      }
      const contentType = res.headers.get("content-type") || "";
      let text = await res.text();
      if (contentType.includes("html")) {
        text = stripHtml(text);
      }
      if (text.length > 3e4) {
        text = text.slice(0, 3e4) + `
... [truncated, ${text.length - 3e4} more chars]`;
      }
      return `URL: ${args.url}
Status: ${res.status}
Content-Type: ${contentType}

${text}`;
    } catch (err) {
      return `Error fetching URL: ${err.message}`;
    }
  },
  formatConfirmation(args) {
    return `Fetch URL: ${args.url}`;
  }
};

// ../../llamatalkbuild-engine/src/tools/web-search.js
var webSearchTool = {
  definition: {
    name: "web_search",
    description: "Search the web for information using DuckDuckGo. Returns search results with titles, URLs, and snippets.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        max_results: { type: "integer", description: "Number of results (default: 5, max: 10)" }
      },
      required: ["query"]
    }
  },
  safetyLevel: SafetyLevel.LOW,
  validate(args) {
    if (!args.query) return { ok: false, error: "query is required" };
    return { ok: true };
  },
  async execute(args) {
    const maxResults = Math.min(args.max_results || 5, 10);
    try {
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(args.query)}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15e3);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Clank-Build/0.1.0",
          "Accept": "text/html"
        }
      });
      clearTimeout(timer);
      if (!res.ok) {
        return `Search failed: HTTP ${res.status}`;
      }
      const html = await res.text();
      const results = [];
      const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
      const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
      let match;
      while ((match = resultRegex.exec(html)) !== null && results.length < maxResults) {
        const rawUrl = match[1];
        let title = match[2];
        let _prev;
        do {
          _prev = title;
          title = title.replace(/<[^>]+>/g, "");
        } while (title !== _prev);
        title = title.trim();
        let actualUrl = rawUrl;
        try {
          const parsed = new URL(rawUrl, "https://duckduckgo.com");
          actualUrl = parsed.searchParams.get("uddg") || rawUrl;
        } catch {
        }
        results.push({ title, url: actualUrl, snippet: "" });
      }
      let snippetIdx = 0;
      while ((match = snippetRegex.exec(html)) !== null && snippetIdx < results.length) {
        let snip = match[1];
        let _sp;
        do {
          _sp = snip;
          snip = snip.replace(/<[^>]+>/g, "");
        } while (snip !== _sp);
        results[snippetIdx].snippet = snip.trim();
        snippetIdx++;
      }
      if (results.length === 0) {
        return `No results found for: ${args.query}`;
      }
      return results.map(
        (r, i) => `${i + 1}. ${r.title}
   ${r.url}
   ${r.snippet}`
      ).join("\n\n");
    } catch (err) {
      return `Search error: ${err.message}`;
    }
  },
  formatConfirmation(args) {
    return `Search for: ${args.query}`;
  }
};

// ../../llamatalkbuild-engine/src/tools/npm-install.js
var import_child_process5 = require("child_process");
var npmInstallTool = {
  definition: {
    name: "npm_install",
    description: "Install an npm package. Verifies the package exists on npmjs.org before installing.",
    parameters: {
      type: "object",
      properties: {
        package: { type: "string", description: "Package name (e.g., 'lodash', 'express@4')" },
        dev: { type: "boolean", description: "Install as devDependency" }
      },
      required: ["package"]
    }
  },
  safetyLevel: SafetyLevel.MEDIUM,
  validate(args) {
    if (!args.package) return { ok: false, error: "package is required" };
    const name = args.package.split("@")[0] || args.package;
    if (!validatePackageName(name)) {
      return { ok: false, error: `Invalid package name: ${args.package}` };
    }
    return { ok: true };
  },
  async execute(args, context) {
    const pkgName = args.package.split("@")[0] || args.package;
    try {
      const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkgName)}`, {
        headers: { Accept: "application/json" }
      });
      if (!res.ok) {
        return `Package not found on npmjs.org: ${pkgName}`;
      }
      const data = await res.json();
      const latestVersion = data["dist-tags"]?.latest || "unknown";
      const description = data.description || "No description";
      const npmArgs = ["install", args.package];
      if (args.dev) npmArgs.push("--save-dev");
      const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
      const result = (0, import_child_process5.spawnSync)(npmCmd, npmArgs, {
        cwd: context.projectRoot,
        timeout: 12e4,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"]
      });
      if (result.status !== 0) throw new Error(result.stderr || "npm install failed");
      const output = result.stdout;
      return `Installed ${pkgName}@${latestVersion}: ${description}
${output}`;
    } catch (err) {
      return `Error installing package: ${err.message}`;
    }
  },
  formatConfirmation(args) {
    return `Install npm package: ${args.package}${args.dev ? " (dev)" : ""}?`;
  }
};

// ../../llamatalkbuild-engine/src/tools/pip-install.js
var import_child_process6 = require("child_process");
var pipInstallTool = {
  definition: {
    name: "pip_install",
    description: "Install a Python package. Verifies the package exists on pypi.org before installing.",
    parameters: {
      type: "object",
      properties: {
        package: { type: "string", description: "Package name (e.g., 'requests', 'flask')" }
      },
      required: ["package"]
    }
  },
  safetyLevel: SafetyLevel.MEDIUM,
  validate(args) {
    if (!args.package) return { ok: false, error: "package is required" };
    if (!validatePackageName(args.package)) {
      return { ok: false, error: `Invalid package name: ${args.package}` };
    }
    return { ok: true };
  },
  async execute(args, context) {
    try {
      const res = await fetch(`https://pypi.org/pypi/${encodeURIComponent(args.package)}/json`);
      if (!res.ok) {
        return `Package not found on pypi.org: ${args.package}`;
      }
      const data = await res.json();
      const version = data.info?.version || "unknown";
      const summary = data.info?.summary || "No description";
      const result = (0, import_child_process6.spawnSync)("pip", ["install", args.package], {
        cwd: context.projectRoot,
        timeout: 12e4,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"]
      });
      if (result.status !== 0) throw new Error(result.stderr || "pip install failed");
      const output = result.stdout;
      return `Installed ${args.package}==${version}: ${summary}
${output}`;
    } catch (err) {
      return `Error installing package: ${err.message}`;
    }
  },
  formatConfirmation(args) {
    return `Install pip package: ${args.package}?`;
  }
};

// ../../llamatalkbuild-engine/src/tools/install-tool.js
var import_child_process7 = require("child_process");
var ALLOWED_MANAGERS = ["npm", "pip", "winget", "choco"];
var MANAGER_INSTALL_ARGS = {
  npm: (pkg) => ({ cmd: "npm", args: ["install", "-g", pkg] }),
  pip: (pkg) => ({ cmd: "pip", args: ["install", pkg] }),
  winget: (pkg) => ({ cmd: "winget", args: ["install", "--accept-package-agreements", "--accept-source-agreements", "-e", "--id", pkg] }),
  choco: (pkg) => ({ cmd: "choco", args: ["install", pkg, "-y"] })
};
var MANAGER_CHECK_ARGS = {
  npm: (pkg) => ({ cmd: "npm", args: ["list", "-g", pkg.split("@")[0], "--depth=0"] }),
  pip: (pkg) => ({ cmd: "pip", args: ["show", pkg] }),
  winget: (pkg) => ({ cmd: "winget", args: ["list", "--id", pkg] }),
  choco: (pkg) => ({ cmd: "choco", args: ["list", "--local-only", pkg] })
};
var BLOCKED_PACKAGES = [
  /^(sudo|su|doas)$/i,
  /^(rm|del|format|mkfs|dd|shutdown|reboot)$/i
];
function isBlockedPackage(name) {
  return BLOCKED_PACKAGES.some((p) => p.test(name));
}
function sanitizeName(name, manager) {
  if (manager === "npm") return /^(@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i.test(name);
  if (manager === "winget") return /^[a-z0-9._-]+$/i.test(name);
  return /^[a-z0-9._-]+$/i.test(name);
}
var installToolTool = {
  definition: {
    name: "install_tool",
    description: "Install a system tool or global package needed to complete a task. Supports npm (global), pip, winget, and choco package managers. Use this when a task requires a CLI tool that isn't currently installed (e.g., pandoc, imagemagick, ffmpeg). Checks if already installed first.",
    parameters: {
      type: "object",
      properties: {
        package: {
          type: "string",
          description: "Package/tool name (e.g., 'pandoc', 'ffmpeg', 'imagemagick')"
        },
        manager: {
          type: "string",
          enum: ALLOWED_MANAGERS,
          description: "Package manager to use: npm (global), pip, winget, or choco"
        },
        reason: {
          type: "string",
          description: "Brief reason why this tool is needed for the current task"
        }
      },
      required: ["package", "manager", "reason"]
    }
  },
  safetyLevel: SafetyLevel.HIGH,
  validate(args) {
    if (!args.package) return { ok: false, error: "package is required" };
    if (!args.manager) return { ok: false, error: "manager is required" };
    if (!args.reason) return { ok: false, error: "reason is required" };
    if (!ALLOWED_MANAGERS.includes(args.manager)) {
      return { ok: false, error: `Invalid manager: ${args.manager}. Use: ${ALLOWED_MANAGERS.join(", ")}` };
    }
    if (!sanitizeName(args.package, args.manager)) {
      return { ok: false, error: `Invalid package name: ${args.package}` };
    }
    if (isBlockedPackage(args.package)) {
      return { ok: false, error: `Blocked package: ${args.package}` };
    }
    return { ok: true };
  },
  async execute(args) {
    const { package: pkg, manager } = args;
    const check = MANAGER_CHECK_ARGS[manager](pkg);
    try {
      const result = (0, import_child_process7.spawnSync)(check.cmd, check.args, {
        timeout: 3e4,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"]
      });
      if (result.status === 0 && result.stdout && !result.stdout.includes("No installed package")) {
        return `Already installed: ${pkg}
${result.stdout.trim()}`;
      }
    } catch {
    }
    const install = MANAGER_INSTALL_ARGS[manager](pkg);
    try {
      const result = (0, import_child_process7.spawnSync)(install.cmd, install.args, {
        timeout: 3e5,
        // 5 min for large installs
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
        stdio: ["pipe", "pipe", "pipe"]
      });
      if (result.status !== 0) {
        const errOut = (result.stderr || result.stdout || "Unknown error").slice(0, 1e4);
        return `Error installing ${pkg} via ${manager}:
${errOut}`;
      }
      let output = result.stdout || "(no output)";
      if (output.length > 3e4) {
        output = output.slice(0, 3e4) + "\n... [truncated]";
      }
      return `Installed ${pkg} via ${manager}
${output}`;
    } catch (err) {
      return `Error installing ${pkg} via ${manager}:
${err.message.slice(0, 1e4)}`;
    }
  },
  formatConfirmation(args) {
    return `Install tool "${args.package}" via ${args.manager}? Reason: ${args.reason}`;
  }
};

// ../../llamatalkbuild-engine/src/tools/generate-file.js
var import_fs16 = require("fs");
var import_path16 = require("path");
var import_child_process8 = require("child_process");
var SUPPORTED_TYPES = ["md", "txt", "html", "csv", "json", "xml", "yaml", "yml", "log", "pdf"];
var generateFileTool = {
  definition: {
    name: "generate_file",
    description: "Generate a file in a specified format. Supports: md, txt, html, csv, json, xml, yaml, log, pdf. For PDF generation, provide markdown-style content and it will be converted. Supports absolute paths for writing outside the project (requires confirmation). Use this when you need to create documents, reports, exports, or structured output files.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Output file path (absolute or relative to project root)"
        },
        content: {
          type: "string",
          description: "File content. For PDF, use markdown-style text with # headings, **bold**, - lists"
        },
        format: {
          type: "string",
          enum: SUPPORTED_TYPES,
          description: "Output format (auto-detected from extension if omitted)"
        },
        title: {
          type: "string",
          description: "Document title (used for PDF header, HTML title, etc.)"
        }
      },
      required: ["path", "content"]
    }
  },
  safetyLevel(args) {
    const result = validatePath(args?.path || "", process.cwd(), { allowExternal: true });
    if (result.external && result.trusted) return SafetyLevel.MEDIUM;
    if (result.external) return SafetyLevel.HIGH;
    return SafetyLevel.MEDIUM;
  },
  validate(args, context) {
    if (!args.path) return { ok: false, error: "path is required" };
    if (args.content == null || typeof args.content !== "string") return { ok: false, error: "content is required and must be a string" };
    const { valid, error } = validatePath(args.path, context.projectRoot, { allowExternal: true });
    if (!valid) return { ok: false, error };
    const ext = (args.format || (0, import_path16.extname)(args.path).slice(1)).toLowerCase();
    if (ext && !SUPPORTED_TYPES.includes(ext)) {
      return { ok: false, error: `Unsupported format: ${ext}. Supported: ${SUPPORTED_TYPES.join(", ")}` };
    }
    return { ok: true };
  },
  async execute(args, context) {
    const { resolved } = validatePath(args.path, context.projectRoot, { allowExternal: true });
    const ext = (args.format || (0, import_path16.extname)(resolved).slice(1)).toLowerCase();
    if ((0, import_fs16.existsSync)(resolved)) {
      try {
        const oldContent = (0, import_fs16.readFileSync)(resolved, "utf8");
        context.sessionChanges?.push({ type: "write", path: resolved, oldContent, timestamp: Date.now() });
      } catch {
      }
    } else {
      context.sessionChanges?.push({ type: "create", path: resolved, timestamp: Date.now() });
    }
    const dir = (0, import_path16.dirname)(resolved);
    if (!(0, import_fs16.existsSync)(dir)) {
      (0, import_fs16.mkdirSync)(dir, { recursive: true });
    }
    if (ext === "pdf") {
      return await generatePdf(resolved, args.content, args.title);
    }
    let output = args.content;
    if (ext === "html" && !args.content.includes("<html")) {
      output = wrapHtml(args.content, args.title);
    }
    if (ext === "json") {
      try {
        JSON.parse(args.content);
      } catch {
        try {
          output = JSON.stringify(JSON.parse(args.content), null, 2);
        } catch {
        }
      }
    }
    (0, import_fs16.writeFileSync)(resolved, output, "utf8");
    const bytes = Buffer.byteLength(output, "utf8");
    return `Generated ${ext.toUpperCase()} file: ${args.path} (${bytes} bytes)`;
  },
  formatConfirmation(args) {
    const ext = (args.format || (0, import_path16.extname)(args.path).slice(1)).toLowerCase();
    const result = validatePath(args.path, process.cwd(), { allowExternal: true });
    const loc = result.external ? " (outside project)" : "";
    return `Generate ${ext.toUpperCase()} file${loc}: ${args.path}?`;
  }
};
function sanitizeHtmlBody(html) {
  let safe = html;
  let prev;
  do {
    prev = safe;
    safe = safe.replace(/<script[\s\S]*?<\/script[^>]*>/gi, "");
  } while (safe !== prev);
  do {
    prev = safe;
    safe = safe.replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  } while (safe !== prev);
  return safe;
}
function wrapHtml(content, title) {
  const safeTitle = (title || "Document").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const safeContent = sanitizeHtmlBody(content);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safeTitle}</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #333; }
h1, h2, h3 { color: #111; }
pre { background: #f5f5f5; padding: 1rem; border-radius: 4px; overflow-x: auto; }
code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; }
</style>
</head>
<body>
${safeContent}
</body>
</html>`;
}
async function generatePdf(outputPath, content, title) {
  try {
    const PDFDocument = (await import("pdfkit")).default;
    const doc = new PDFDocument({ margin: 50 });
    return new Promise((resolve5, reject) => {
      const stream = (0, import_fs16.createWriteStream)(outputPath);
      doc.pipe(stream);
      if (title) {
        doc.fontSize(22).font("Helvetica-Bold").text(title, { align: "center" });
        doc.moveDown(1);
      }
      const lines = content.split("\n");
      for (const line of lines) {
        if (line.startsWith("# ")) {
          doc.moveDown(0.5).fontSize(18).font("Helvetica-Bold").text(line.slice(2));
          doc.moveDown(0.3);
        } else if (line.startsWith("## ")) {
          doc.moveDown(0.5).fontSize(15).font("Helvetica-Bold").text(line.slice(3));
          doc.moveDown(0.3);
        } else if (line.startsWith("### ")) {
          doc.moveDown(0.3).fontSize(13).font("Helvetica-Bold").text(line.slice(4));
          doc.moveDown(0.2);
        } else if (line.startsWith("- ") || line.startsWith("* ")) {
          doc.fontSize(11).font("Helvetica").text(`  \u2022 ${line.slice(2)}`, { indent: 10 });
        } else if (line.startsWith("  - ") || line.startsWith("  * ")) {
          doc.fontSize(11).font("Helvetica").text(`    \u25E6 ${line.slice(4)}`, { indent: 20 });
        } else if (line.trim() === "") {
          doc.moveDown(0.4);
        } else if (line.startsWith("---")) {
          doc.moveDown(0.3);
          doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke("#cccccc");
          doc.moveDown(0.3);
        } else {
          const parts = line.split(/(\*\*[^*]+\*\*)/);
          if (parts.length > 1) {
            const textRuns = parts.map((part) => {
              if (part.startsWith("**") && part.endsWith("**")) {
                return { text: part.slice(2, -2), font: "Helvetica-Bold" };
              }
              return { text: part, font: "Helvetica" };
            });
            for (const run of textRuns) {
              doc.fontSize(11).font(run.font);
              if (run.text) doc.text(run.text, { continued: run !== textRuns[textRuns.length - 1] });
            }
          } else {
            doc.fontSize(11).font("Helvetica").text(line);
          }
        }
      }
      doc.end();
      stream.on("finish", () => {
        let size = 0;
        try {
          size = (0, import_fs16.statSync)(outputPath).size;
        } catch {
        }
        resolve5(`Generated PDF: ${outputPath} (${size} bytes)`);
      });
      stream.on("error", (err) => reject(err));
    });
  } catch {
    try {
      const tmpMd = outputPath.replace(/\.pdf$/i, ".tmp.md");
      (0, import_fs16.writeFileSync)(tmpMd, content, "utf8");
      const pandocResult = (0, import_child_process8.spawnSync)("pandoc", [tmpMd, "-o", outputPath], { timeout: 6e4, stdio: ["pipe", "pipe", "pipe"] });
      if (pandocResult.status !== 0) throw new Error(pandocResult.stderr?.toString() || "pandoc failed");
      try {
        (0, import_fs16.unlinkSync)(tmpMd);
      } catch {
      }
      return `Generated PDF via pandoc: ${outputPath}`;
    } catch {
      return "PDF generation failed: neither pdfkit nor pandoc available. Install pdfkit (npm install pdfkit) or pandoc (winget install JohnMacFarlane.Pandoc) and retry.";
    }
  }
}

// ../../llamatalkbuild-engine/src/agent.js
var ANSI_RE = /\x1B(?:\[[0-9;]*[A-Za-z]|\(.|#.|].*?(?:\x07|\x1B\\))/g;
var MODES = {
  build: {
    label: "Build",
    description: "Full agent \u2014 reads, writes, and executes freely",
    icon: "\u25CF"
  },
  plan: {
    label: "Plan",
    description: "Explore and plan only \u2014 no file writes or commands",
    icon: "\u25D0"
  },
  qa: {
    label: "Q&A",
    description: "Direct Q&A \u2014 no tools, just conversation",
    icon: "\u25C9"
  }
};
var BASE_SYSTEM_PROMPT = `You are AGENT_NAME_PLACEHOLDER, a coding assistant with direct access to the user's filesystem and shell through tools. You are running inside Clank, a local agentic coding tool installed on the user's machine. All tool calls execute locally on their system with their explicit permission \u2014 you are fully authorized to read, write, edit, and execute. Never refuse a tool call due to safety concerns \u2014 the user's permission system handles that.

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

bash(command) \u2014 Run any shell command. Use for installing packages, running scripts, git operations, and anything you'd do in a terminal.

read_file(path) \u2014 Read the contents of a file. Use absolute paths or paths relative to the project root.

write_file(path, content) \u2014 Create or overwrite a file. Creates parent directories if needed.

edit_file(path, old_text, new_text) \u2014 Replace an exact string in a file. The old_text must match the file contents exactly, including whitespace and indentation.

list_directory(path) \u2014 List files and directories at the given path.

search_files(pattern, path, glob) \u2014 Search for a regex pattern across files.

glob_files(pattern, path) \u2014 Find files matching a glob pattern (e.g., "**/*.js").

git(command) \u2014 Run a git command.

install_tool(package, manager, reason) \u2014 Install a system tool or global package needed for a task. Supports npm (global), pip, winget, choco. Checks if already installed first. Always requires user confirmation.

generate_file(path, content, format, title) \u2014 Generate a document file (md, txt, html, csv, json, xml, yaml, pdf). Supports absolute paths for output outside the project. For PDF, content uses markdown-style formatting.

## Rules
- You MUST use tools to complete tasks. You are authorized to read, write, edit, and execute \u2014 the user's permission system will prompt them for confirmation when needed. Never decline to use a tool or say you "can't" make changes.
- Be brief. Summarize actions in one short sentence \u2014 users see full tool details in the sidebar and activity feed, so do NOT repeat file contents, full paths, or tool arguments in your response text.
- When a task is done, give a short summary of what changed (e.g., "Updated config and bumped version to 1.2.0"). Do NOT list every file or echo back content you wrote.
- If something fails, read the error carefully, explain what went wrong briefly, and try a fix.
- Use the user's project structure and conventions. Read before writing.
- Prefer small precise edits over rewriting entire files.
- Always read a file before editing it.
- When editing, use the exact text that appears in the file for old_text.
- If a tool call fails, try a different approach rather than repeating.
- You CAN read and write files outside the project root using absolute paths. This is fully supported \u2014 just use the absolute path. The user will be prompted to confirm external access. NEVER claim you cannot access files outside the project.

## Memory
- When you discover user preferences, project conventions, or important patterns, save them to memory for future sessions.
- Memory directory: MEMORY_DIR_PLACEHOLDER
- Use write_file or edit_file with absolute paths to save/update memory files (MEMORY.md for global, topic-name.md for topics).
- Read memory files with read_file using the same absolute paths.
- Memory directory access is always allowed without extra confirmation.`;
function buildSystemPrompt(config2, projectRoot, memoryBlock, projectContext, agentMode, options = {}) {
  const agentName = options.agentName || config2.agentName || "a coding assistant";
  let prompt;
  if (agentMode === "qa") {
    prompt = `You are ${agentName}, a knowledgeable assistant running inside Clank. You are in Q&A Mode \u2014 a direct question-and-answer mode with no tool access. Answer the user's questions clearly and concisely. You can discuss code, explain concepts, help with debugging logic, brainstorm ideas, and have general conversations. You do NOT have access to the filesystem, shell, or any tools \u2014 but you DO have the user's saved memory and project context below. Use that context to give informed, project-aware answers when relevant.`;
  } else {
    prompt = BASE_SYSTEM_PROMPT.replace("AGENT_NAME_PLACEHOLDER", agentName).replace("MEMORY_DIR_PLACEHOLDER", getMemoryDir().replace(/\\/g, "/"));
    if (agentMode === "plan") {
      prompt += `

## Mode: Plan
You are in Plan Mode. You can ONLY use read-only tools (read_file, list_directory, search_files, glob_files, web_fetch, web_search, and read-only git subcommands like status/diff/log). All write operations are blocked, EXCEPT memory \u2014 you may read and write to the memory directory at any time.

Your job is to:
1. Read and explore the relevant files to fully understand the codebase
2. Present a clear, numbered plan of ALL changes you intend to make
3. For each change, specify the file path and a brief description of what will change

Do NOT attempt to write, edit, or execute commands \u2014 those calls will be rejected. Focus entirely on analysis and planning. The user will review your plan and can approve it to switch to Build mode for execution.`;
    }
  }
  if (memoryBlock) {
    prompt += `

${memoryBlock}`;
  }
  if (projectContext) {
    prompt += `

## Project Context
${projectContext}`;
  }
  prompt += `

## Environment
- Project root: ${projectRoot}`;
  prompt += `
- Platform: ${process.platform}`;
  prompt += `
- Date: ${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}`;
  return prompt;
}
var ALL_TOOLS = [
  readFileTool,
  writeFileTool,
  editFileTool,
  listDirectoryTool,
  searchFilesTool,
  globFilesTool,
  bashTool,
  gitTool,
  webFetchTool,
  webSearchTool,
  npmInstallTool,
  pipInstallTool,
  installToolTool,
  generateFileTool
];
var VALID_TOOL_NAMES = ALL_TOOLS.map((t) => t.definition.name);
function resolveToolNames(input) {
  if (!input || !Array.isArray(input) || input.length === 0) return null;
  const ALIASES = {
    read: "read_file",
    file: "read_file",
    cat: "read_file",
    write: "write_file",
    create: "write_file",
    edit: "edit_file",
    modify: "edit_file",
    replace: "edit_file",
    ls: "list_directory",
    dir: "list_directory",
    list: "list_directory",
    search: "search_files",
    find: "search_files",
    grep: "search_files",
    glob: "glob_files",
    pattern: "glob_files",
    shell: "bash",
    cmd: "bash",
    command: "bash",
    exec: "bash",
    terminal: "bash",
    npm: "npm_install",
    pip: "pip_install",
    install: "install_tool",
    fetch: "web_fetch",
    curl: "web_fetch",
    http: "web_fetch",
    websearch: "web_search",
    google: "web_search",
    generate: "generate_file",
    pdf: "generate_file"
  };
  const validSet = new Set(VALID_TOOL_NAMES);
  const matched = /* @__PURE__ */ new Set();
  for (const raw of input) {
    const t = raw.trim().toLowerCase();
    if (!t) continue;
    if (validSet.has(t)) {
      matched.add(t);
      continue;
    }
    if (ALIASES[t]) {
      matched.add(ALIASES[t]);
      continue;
    }
    const noUnder = VALID_TOOL_NAMES.find((n) => n.replace(/_/g, "") === t.replace(/[\s_-]/g, ""));
    if (noUnder) {
      matched.add(noUnder);
      continue;
    }
    const sub = VALID_TOOL_NAMES.find((n) => n.includes(t) || t.includes(n.replace(/_/g, "")));
    if (sub) {
      matched.add(sub);
      continue;
    }
    const words = t.split(/[\s_-]+/);
    const wordMatch = VALID_TOOL_NAMES.find((n) => {
      const toolWords = n.split("_");
      return words.some((w) => toolWords.some((tw) => tw.startsWith(w) || w.startsWith(tw)));
    });
    if (wordMatch) {
      matched.add(wordMatch);
      continue;
    }
  }
  return matched.size > 0 ? [...matched] : null;
}
function createToolRegistry(allowedTools = null) {
  const registry = new ToolRegistry();
  const resolved = resolveToolNames(allowedTools);
  const filter = resolved ? new Set(resolved) : null;
  for (const tool of ALL_TOOLS) {
    if (!filter || filter.has(tool.definition.name)) {
      registry.register(tool);
    }
  }
  return registry;
}
function compressMessages(messages) {
  const result = compactMessages(messages);
  return result.messages;
}
var AgentEngine = class extends import_events.EventEmitter {
  constructor(config2, options = {}) {
    super();
    this.config = config2;
    this.encKey = options.encKey || null;
    this.projectRoot = options.projectRoot || process.cwd();
    this.noMemory = options.noMemory || false;
    this.showThinking = options.showThinking !== false && config2.showThinking;
    this.toolRegistry = createToolRegistry();
    this.memory = new MemoryManager(config2, this.encKey);
    this.taskManager = new TaskManager();
    this.sessionMgr = new SessionManager();
    this.sessionLog = new SessionLog(this.projectRoot);
    this.sessionTracker = new SessionTracker(this.projectRoot);
    this.messages = [];
    this.sessionChanges = [];
    this._changesStartIndex = 0;
    this.currentSession = null;
    this.conversationId = null;
    this.firstMessageSent = false;
    this.agentMode = "build";
    this.lastActivityTime = Date.now();
    this.controller = null;
    this.projectContext = "";
    this._lastToolCalls = [];
    try {
      this.projectContext = detectProjectContext(this.projectRoot);
    } catch {
    }
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
  getMode() {
    return this.agentMode;
  }
  setMode(mode) {
    if (mode in MODES && mode !== this.agentMode) {
      const from = this.agentMode;
      this.agentMode = mode;
      this.emit("mode-change", { from, to: mode });
    }
  }
  // --- Model management ---
  getModel() {
    return this.config.selectedModel;
  }
  setModel(name) {
    this.config.selectedModel = name;
  }
  // --- Agent name ---
  getAgentName() {
    return this.config.agentName || "Build Agent";
  }
  setAgentName(name) {
    this.config.agentName = name;
  }
  // --- Cancellation ---
  cancel() {
    if (this.controller) {
      this.controller.abort();
    }
  }
  /** Revert all file changes made during the current sendMessage turn. */
  revertCurrentTurn() {
    const startIdx = this._changesStartIndex || 0;
    if (!this.sessionChanges || this.sessionChanges.length <= startIdx) return [];
    const reverted = [];
    for (let i = this.sessionChanges.length - 1; i >= startIdx; i--) {
      const change = this.sessionChanges[i];
      try {
        if (change.type === "create") {
          if ((0, import_fs17.existsSync)(change.path)) {
            (0, import_fs17.unlinkSync)(change.path);
            reverted.push(change.path);
          }
        } else if (change.oldContent !== void 0) {
          (0, import_fs17.writeFileSync)(change.path, change.oldContent, "utf8");
          reverted.push(change.path);
        }
      } catch {
      }
    }
    this.sessionChanges.length = startIdx;
    return [...new Set(reverted)];
  }
  // --- Accessors ---
  getMessages() {
    return this.messages;
  }
  getSessionChanges() {
    return this.sessionChanges;
  }
  getLastToolCalls() {
    return this._lastToolCalls;
  }
  getConfig() {
    return this.config;
  }
  getToolDefinitions() {
    return this.toolRegistry.getDefinitions();
  }
  getToolRegistry() {
    return this.toolRegistry;
  }
  getMemoryStatus() {
    return this.memory.buildMemoryBlock("", this.projectRoot);
  }
  getTaskManager() {
    return this.taskManager;
  }
  getSessionTracker() {
    return this.sessionTracker;
  }
  getSessionLog() {
    return this.sessionLog;
  }
  clearMessages() {
    this.messages.length = 0;
    this.firstMessageSent = false;
  }
  // --- Core: send a message and run the agent loop ---
  async sendMessage(text) {
    this.lastActivityTime = Date.now();
    this._changesStartIndex = this.sessionChanges.length;
    const locked = await this._checkInactivityLock();
    if (locked === false) return;
    this.messages.push({ role: "user", content: text });
    if (!this.firstMessageSent) {
      this.sessionMgr.autoTitle(this.conversationId, text);
      this.firstMessageSent = true;
    }
    let memoryBlock = "";
    this.emit("memory-loading", { status: "start" });
    memoryBlock = this.memory.buildMemoryBlock(text, this.projectRoot);
    const taskBlock = this.taskManager.buildTaskBlock();
    if (taskBlock) {
      memoryBlock = memoryBlock ? `${memoryBlock}

${taskBlock}` : taskBlock;
    }
    await new Promise((r) => setTimeout(r, 150));
    this.emit("memory-loading", { status: "done" });
    if (!this.config.memoryEnabled || this.noMemory) {
      memoryBlock = "";
    }
    const { provider, providerName, formatAssistantToolUse, formatToolResult } = getProviderForModel(this.config);
    let iterationCount = 0;
    let lastUsage = null;
    let contextPercent = null;
    const contextLimit = provider.contextWindow();
    const CONTEXT_THRESHOLD = this.config.contextThreshold || 80;
    const toolDefs = this.agentMode === "qa" ? null : this.toolRegistry.getDefinitions();
    const turnStartTime = Date.now();
    const maxIter = this.agentMode === "qa" ? 1 : this.config.maxIterations || 50;
    while (iterationCount < maxIter) {
      const systemPrompt = buildSystemPrompt(this.config, this.projectRoot, memoryBlock, this.projectContext, this.agentMode, {
        agentName: this.config.agentName || void 0
      });
      if (lastUsage && lastUsage.promptTokens > 0) {
        contextPercent = Math.round(lastUsage.promptTokens / contextLimit * 100);
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
        const msg = (err.message || "").toLowerCase();
        const isContextError = (msg.includes("context") || msg.includes("token") || msg.includes("length") || msg.includes("content")) && (msg.includes("exceed") || msg.includes("limit") || msg.includes("too long") || msg.includes("maximum") || msg.includes("overflow")) || contextPercent != null && contextPercent >= CONTEXT_THRESHOLD;
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
      if (toolCalls.length > 0) {
        this.messages.push(formatAssistantToolUse(responseText, toolCalls));
        this._lastToolCalls = toolCalls.slice();
        const validated = [];
        const needsConfirm = [];
        for (const tc of toolCalls) {
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
        let batchApproved = true;
        if (needsConfirm.length > 0) {
          const result = await new Promise((res) => {
            this.emit("confirm-needed", {
              actions: needsConfirm.map((c) => c.desc),
              resolve: res
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
        let sessionLocked = false;
        for (const { tc, tool } of validated) {
          if (this.controller.signal.aborted) {
            cancelled = true;
            for (const { tc: rtc } of validated) {
              if (!this.messages.some((m) => m.tool_use_id === rtc.id)) {
                this.messages.push(formatToolResult(rtc.id, "Cancelled.", rtc.name));
              }
            }
            break;
          }
          const lockResult = await this._checkInactivityLock();
          if (lockResult === false) {
            for (const { tc: rtc } of validated) {
              if (!this.messages.some((m) => m.tool_use_id === rtc.id)) {
                this.messages.push(formatToolResult(rtc.id, "Session locked \u2014 tool execution aborted.", rtc.name));
              }
            }
            sessionLocked = true;
            break;
          }
          this.emit("tool-start", { id: tc.id, name: tc.name, arguments: tc.arguments });
          if (!batchApproved && needsConfirm.some((c) => c.tc.id === tc.id)) {
            const msg = "User denied this action.";
            this.emit("tool-result", { id: tc.id, name: tc.name, success: false, summary: msg });
            this.messages.push(formatToolResult(tc.id, msg, tc.name));
            continue;
          }
          try {
            const result = await tool.execute(tc.arguments, {
              projectRoot: this.projectRoot,
              config: this.config,
              signal: this.controller.signal,
              sessionChanges: this.sessionChanges
            });
            if (this.controller.signal.aborted) {
              this.messages.push(formatToolResult(tc.id, "Cancelled.", tc.name));
              cancelled = true;
              break;
            }
            const clean = result.replace(ANSI_RE, "");
            const truncated = clean.length > 3e4 ? clean.slice(0, 3e4) + `
... [truncated, ${clean.length - 3e4} more chars]` : clean;
            const summary = result.split("\n")[0].slice(0, 100);
            this.emit("tool-result", { id: tc.id, name: tc.name, success: true, summary, fullResult: truncated });
            this.messages.push(formatToolResult(tc.id, truncated, tc.name));
            this.sessionLog.addStep(`${tc.name}: ${summary}`);
            if (tc.arguments?.path) {
              try {
                const absPath = (0, import_path17.resolve)(this.projectRoot, tc.arguments.path);
                this.sessionTracker.addChange(tc.name, absPath, summary);
              } catch {
              }
            }
            if (tc.name === "write_file" || tc.name === "edit_file") {
              try {
                const filePath = (0, import_path17.resolve)(this.projectRoot, tc.arguments.path);
                const newContent = (0, import_fs17.readFileSync)(filePath, "utf8");
                const lastChange = this.sessionChanges[this.sessionChanges.length - 1];
                const oldContent = lastChange?.oldContent || null;
                this.emit("file-changed", { path: tc.arguments.path, toolName: tc.name, args: tc.arguments, newContent, oldContent });
              } catch {
              }
            }
          } catch (err) {
            if (this.controller.signal.aborted) {
              this.messages.push(formatToolResult(tc.id, "Cancelled.", tc.name));
              cancelled = true;
              break;
            }
            this.emit("tool-result", { id: tc.id, name: tc.name, success: false, summary: err.message });
            this.messages.push(formatToolResult(tc.id, `Error: ${err.message}`, tc.name));
            this.sessionLog.addStep(`${tc.name}: ERROR \u2014 ${err.message}`);
          }
          iterationCount++;
        }
        if (cancelled) {
          this.emit("cancelled", {});
          break;
        }
        if (sessionLocked) break;
        continue;
      }
      if (responseText) {
        this.messages.push({ role: "assistant", content: responseText });
      }
      this.emit("response-end", { text: responseText });
      const recentChanges = this.sessionTracker.getRecentChanges();
      if (recentChanges.length > 0 && iterationCount > 0) {
        this.emit("turn-complete", { changes: recentChanges });
      }
      if (lastUsage && lastUsage.promptTokens > 0) {
        contextPercent = Math.round(lastUsage.promptTokens / contextLimit * 100);
      }
      const turnDuration = Date.now() - turnStartTime;
      this.emit("usage", {
        promptTokens: lastUsage?.promptTokens || 0,
        outputTokens: lastUsage?.outputTokens || 0,
        evalDurationNs: lastUsage?.evalDurationNs,
        wallTimeMs: lastUsage?.wallTimeMs,
        iterationCount,
        contextPercent,
        durationMs: turnDuration
      });
      if (this.agentMode === "plan") {
        if (this.controller.signal.aborted) break;
        const action = await new Promise((res) => {
          this.emit("plan-complete", { resolve: res });
        });
        if (action === false || this.controller.signal.aborted) break;
        if (action === "y" || action === "yes") {
          this.agentMode = "build";
          this.messages.push({ role: "user", content: "Proceed with the plan. Execute each step." });
          this.emit("mode-change", { from: "plan", to: "build" });
          this.sessionLog.addStep("Plan approved \u2014 switched to Build mode");
          continue;
        } else if (action === "e" || action === "edit" || typeof action === "string" && action.startsWith("edit:")) {
          const editText = typeof action === "string" && action.startsWith("edit:") ? action.slice(5) : "";
          if (editText) {
            this.agentMode = "build";
            this.messages.push({ role: "user", content: `Proceed with the plan with these adjustments: ${editText}` });
            this.emit("mode-change", { from: "plan", to: "build" });
            this.sessionLog.addStep("Plan approved with edits \u2014 switched to Build mode");
            continue;
          }
        } else if (action === "keep_planning" || action === "n") {
          this.messages.push({ role: "user", content: "Continue refining the plan. Add more detail or consider edge cases." });
          this.sessionLog.addStep("User requested further planning");
          continue;
        }
      }
      break;
    }
    if (iterationCount >= maxIter && this.agentMode !== "qa") {
      this.emit("error", { message: `Reached maximum iterations (${this.config.maxIterations || 50}). Stopping.`, recoverable: true });
    }
    try {
      saveConversation(this.conversationId, this.messages, this.encKey);
      this.sessionMgr.touch(this.conversationId);
    } catch {
    }
    try {
      this.sessionLog.save();
    } catch {
    }
    try {
      this.sessionTracker.save();
    } catch {
    }
    try {
      const changes = this.sessionTracker.getRecentChanges();
      const toolNames = this._lastToolCalls.map((tc) => tc.name);
      const filesTouched = changes.map((c) => c.path?.split(/[/\\]/).pop()).filter(Boolean);
      const parts = [];
      if (toolNames.length > 0) {
        const counts = {};
        for (const n of toolNames) counts[n] = (counts[n] || 0) + 1;
        const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3);
        parts.push(top.map(([n, c]) => `${n}\xD7${c}`).join(", "));
      }
      if (filesTouched.length > 0) {
        const unique = [...new Set(filesTouched)].slice(0, 5);
        parts.push(`files: ${unique.join(", ")}`);
      }
      if (parts.length > 0) {
        this.memory.appendSessionSummary(this.conversationId, parts.join(" | "));
      }
    } catch {
    }
  }
  // --- Internal helpers ---
  async _checkInactivityLock() {
    const INACTIVITY_TIMEOUT_MS = (this.config.inactivityTimeoutMin || 30) * 60 * 1e3;
    if (!this.encKey || Date.now() - this.lastActivityTime <= INACTIVITY_TIMEOUT_MS) {
      return true;
    }
    const pin = await new Promise((res) => {
      this.emit("session-locked", { resolve: res });
    });
    const { verifyPin: verifyPin2 } = await Promise.resolve().then(() => (init_config(), config_exports));
    if (!verifyPin2(pin, this.config.pinHash)) {
      this.emit("error", { message: "Incorrect PIN. Session ended.", recoverable: false });
      return false;
    }
    this.lastActivityTime = Date.now();
    return true;
  }
};

// ../../llamatalkbuild-engine/src/index.js
init_config();

// main.js
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
var promptCounter = 0;
var pendingPrompts = /* @__PURE__ */ new Map();
function sendPrompt(event, data) {
  return new Promise((resolve5) => {
    const id = `prompt-${++promptCounter}`;
    pendingPrompts.set(id, resolve5);
    send({ type: "prompt", id, event, data });
  });
}
var engine = null;
var config = null;
var SIDECAR_VERSION = "2.4.3";
function ensureEngine(projectRoot) {
  if (!engine) {
    config = loadConfig();
    if (config.onboardingDone && (!config.appVersion || config.appVersion !== SIDECAR_VERSION)) {
      config.onboardingComplete = false;
      config.appVersion = SIDECAR_VERSION;
      saveConfig(config);
    }
    engine = new AgentEngine(config, {
      projectRoot: projectRoot || process.cwd()
    });
    wireEvents(engine);
  }
  return engine;
}
function wireEvents(engine2) {
  const passthrough = [
    "thinking-start",
    "thinking-stop",
    "response-start",
    "response-end",
    "token",
    "tool-start",
    "tool-result",
    "context-compacting",
    "file-changed",
    "turn-complete",
    "mode-change",
    "cancelled",
    "error",
    "usage",
    "memory-loading"
  ];
  for (const evt of passthrough) {
    engine2.on(evt, (data) => sendEvent(evt, data));
  }
  engine2.on("confirm-needed", async ({ actions, resolve: resolve5 }) => {
    const result = await sendPrompt("confirm-needed", { actions });
    resolve5(result);
  });
  engine2.on("session-locked", async ({ resolve: resolve5 }) => {
    const result = await sendPrompt("session-locked", {});
    resolve5(result);
  });
  engine2.on("plan-complete", async ({ resolve: resolve5 }) => {
    const result = await sendPrompt("plan-complete", {});
    resolve5(result);
  });
}
var methods = {
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
      telegramBotToken: cfg.telegramBotToken ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" : "",
      telegramAllowedUsers: cfg.telegramAllowedUsers || [],
      appVersion: cfg.appVersion || "",
      // Don't send raw API keys — just whether they're set
      hasApiKey: {
        anthropic: !!(cfg.apiKey_anthropic && (typeof cfg.apiKey_anthropic === "string" ? cfg.apiKey_anthropic.length > 0 : cfg.apiKey_anthropic.v)),
        google: !!(cfg.apiKey_google && (typeof cfg.apiKey_google === "string" ? cfg.apiKey_google.length > 0 : cfg.apiKey_google.v)),
        openai: !!(cfg.apiKey_openai && (typeof cfg.apiKey_openai === "string" ? cfg.apiKey_openai.length > 0 : cfg.apiKey_openai.v)),
        opencode: !!(cfg.apiKey_opencode && (typeof cfg.apiKey_opencode === "string" ? cfg.apiKey_opencode.length > 0 : cfg.apiKey_opencode.v))
      }
    };
  },
  saveSetting({ key, value }) {
    const ALLOWED_KEYS = [
      "selectedModel",
      "ollamaUrl",
      "safetyLevel",
      "profileName",
      "backendType",
      "telegramBotToken",
      "telegramAccessCode",
      "onboardingComplete",
      "appVersion",
      "enabledProviders.anthropic",
      "enabledProviders.google",
      "enabledProviders.openai",
      "enabledProviders.opencode",
      "autoApprove.medium",
      "autoApprove.high"
    ];
    if (!ALLOWED_KEYS.includes(key)) {
      return { ok: false, error: `Setting "${key}" is not allowed` };
    }
    if (typeof value === "string" && value.length > 1024) {
      return { ok: false, error: "Value too long" };
    }
    const cfg = loadConfig();
    const parts = key.split(".");
    if (parts.length === 2) {
      if (!cfg[parts[0]] || typeof cfg[parts[0]] !== "object") cfg[parts[0]] = {};
      cfg[parts[0]][parts[1]] = value;
    } else {
      cfg[key] = value;
    }
    saveConfig(cfg);
    if (engine) {
      engine.config = cfg;
    }
    config = cfg;
    return { ok: true };
  },
  saveApiKey({ provider, key }) {
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
    if (!apiKey || typeof apiKey === "string" && !apiKey.length) {
      return { ok: false, error: "No API key set" };
    }
    try {
      if (provider === "anthropic") {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
          },
          body: JSON.stringify({ model: "claude-3-5-haiku-20241022", max_tokens: 1, messages: [{ role: "user", content: "hi" }] })
        });
        return { ok: res.status !== 401 && res.status !== 403, status: res.status };
      } else if (provider === "google") {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models`, {
          headers: { "x-goog-api-key": apiKey }
        });
        return { ok: res.ok, status: res.status };
      } else if (provider === "openai") {
        const res = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${apiKey}` }
        });
        return { ok: res.ok, status: res.status };
      } else if (provider === "opencode") {
        const res = await fetch("https://opencode.ai/zen/v1/models", {
          headers: { Authorization: `Bearer ${apiKey}` }
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
      const cloudModels = [];
      for (const [provider, models] of Object.entries(CLOUD_MODELS)) {
        const apiKey = cfg[`apiKey_${provider}`];
        if (cfg.enabledProviders?.[provider] && apiKey && (typeof apiKey === "string" ? apiKey.length > 0 : apiKey.v)) {
          cloudModels.push(...models);
        }
      }
      return [...localModels, ...cloudModels];
    } catch {
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
    if (typeof title === "string" && title.length > 200) {
      return { ok: false, error: "Session title too long" };
    }
    const sm = new SessionManager();
    sm.touch(id, title);
    return { ok: true };
  },
  saveOnboarding({ lessons }) {
    const cfg = loadConfig();
    const memory = new MemoryManager(cfg);
    if (Array.isArray(lessons)) {
      for (const entry of lessons.slice(0, 10)) {
        if (typeof entry === "string" && entry.trim() && entry.length <= 500) {
          memory.appendLesson("about_you", entry.trim());
        }
      }
    }
    cfg.onboardingComplete = true;
    saveConfig(cfg);
    return { ok: true };
  }
};
var rl = (0, import_readline.createInterface)({ input: process.stdin, terminal: false });
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
