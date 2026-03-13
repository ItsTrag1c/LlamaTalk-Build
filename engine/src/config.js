import { readFileSync, writeFileSync, mkdirSync, existsSync, chmodSync, cpSync } from "fs";
import { dirname, join } from "path";
import { createHash, timingSafeEqual, pbkdf2Sync, randomBytes, createCipheriv, createDecipheriv } from "crypto";
import { homedir } from "os";
import { execSync, execFileSync } from "child_process";

const DEFAULTS = {
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
    high: false,
  },
  showThinking: true,
  showToolCalls: true,
  contextStrategy: "truncate",
  memoryEnabled: true,

  // Local model optimizations (Ollama / OpenAI-compatible)
  localOptimizations: {
    enabled: true,
    compactPrompt: true,
    toolTier: "auto",          // "full" | "core" | "auto"
    memoryBudgetPercent: 15,   // % of context reserved for memory
    contextThreshold: 60,      // compaction trigger (vs 80 for cloud)
    maxResponseTokens: 4096,
  },

  // Telegram
  telegramBotToken: "",
  telegramAllowedUsers: [],
  telegramAccessCode: "",

  // Onboarding / versioning
  onboardingComplete: false,
  appVersion: "",
};

export function getConfigDir() {
  const appData = process.env.APPDATA;
  if (appData) {
    const newDir = join(appData, "Clank");
    if (!existsSync(newDir)) {
      // Migrate from ClankBuild → Clank, or LlamaTalkBuild → Clank
      const clankBuildDir = join(appData, "ClankBuild");
      const llamaDir = join(appData, "LlamaTalkBuild");
      if (existsSync(clankBuildDir)) {
        cpSync(clankBuildDir, newDir, { recursive: true });
      } else if (existsSync(llamaDir)) {
        cpSync(llamaDir, newDir, { recursive: true });
      }
    }
    return newDir;
  }
  // Non-Windows
  const newDir = join(homedir(), ".clank");
  if (!existsSync(newDir)) {
    // Migrate from .clankbuild → .clank, or .llamabuild → .clank
    const clankBuildDir = join(homedir(), ".clankbuild");
    const llamaDir = join(homedir(), ".llamabuild");
    if (existsSync(clankBuildDir)) {
      cpSync(clankBuildDir, newDir, { recursive: true });
    } else if (existsSync(llamaDir)) {
      cpSync(llamaDir, newDir, { recursive: true });
    }
  }
  return newDir;
}

export function getConfigPath() {
  return join(getConfigDir(), "config.json");
}

export function getMemoryDir() {
  return join(getConfigDir(), "memory");
}

export function getConversationDir() {
  return join(getConfigDir(), "conversations");
}

export function loadConfig() {
  const configPath = getConfigPath();
  const dir = dirname(configPath);

  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  if (!existsSync(configPath)) {
    writeFileSync(configPath, JSON.stringify(DEFAULTS, null, 2), "utf8");
    return { ...DEFAULTS };
  }

  try {
    const raw = readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw);
    const config = deepMerge({ ...DEFAULTS }, parsed);
    // Migrate old safety level keys (safe/moderate/dangerous → low/medium/high)
    if (config.autoApprove && ("safe" in config.autoApprove || "moderate" in config.autoApprove || "dangerous" in config.autoApprove)) {
      const old = config.autoApprove;
      config.autoApprove = {
        low: old.low ?? old.safe ?? true,
        medium: old.medium ?? old.moderate ?? false,
        high: old.high ?? old.dangerous ?? false,
      };
      writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
    }
    return config;
  } catch {
    return { ...DEFAULTS };
  }
}

function applyFilePermissions(filePath) {
  if (process.platform === "win32") {
    try {
      execFileSync("icacls", [
        filePath, "/inheritance:r", "/grant:r", `${process.env.USERNAME}:F`
      ], { stdio: "ignore" });
    } catch { /* non-fatal */ }
  } else {
    // Unix/macOS: owner read/write only (0600)
    try { chmodSync(filePath, 0o600); } catch { /* non-fatal */ }
  }
}

export function saveConfig(config) {
  const configPath = getConfigPath();
  const dir = dirname(configPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
  applyFilePermissions(configPath);
}

// --- Encryption utilities ---

export function generateEncKeySalt() {
  return randomBytes(16).toString("hex");
}

export function deriveEncKey(pin, saltHex) {
  return pbkdf2Sync(pin, Buffer.from(saltHex, "hex"), 100000, 32, "sha256");
}

export function encryptValue(plaintext, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { v: 1, iv: iv.toString("hex"), tag: tag.toString("hex"), data: data.toString("hex") };
}

export function decryptValue(payload, key) {
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(payload.iv, "hex"));
  decipher.setAuthTag(Buffer.from(payload.tag, "hex"));
  return decipher.update(Buffer.from(payload.data, "hex")) + decipher.final("utf8");
}

export function isEncryptedPayload(v) {
  return v && typeof v === "object" && v.v === 1 && v.iv && v.tag && v.data;
}

export function saveConfigWithKey(config, encKey) {
  const configPath = getConfigPath();
  const dir = dirname(configPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const toWrite = { ...config };
  if (encKey) {
    for (const field of ["apiKey_anthropic", "apiKey_google", "apiKey_openai", "apiKey_opencode", "telegramBotToken", "telegramAccessCode"]) {
      if (toWrite[field] && typeof toWrite[field] === "string" && toWrite[field].length > 0) {
        toWrite[field] = encryptValue(toWrite[field], encKey);
      }
    }
  }
  writeFileSync(configPath, JSON.stringify(toWrite, null, 2), "utf8");
  applyFilePermissions(configPath);
}

export function decryptApiKeys(config, encKey) {
  const out = { ...config };
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

// --- Conversation persistence ---

export function saveConversation(id, messages, encKey) {
  const dir = getConversationDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const filePath = join(dir, `${id}.json`);
  const json = JSON.stringify(messages);
  const payload = encKey ? JSON.stringify(encryptValue(json, encKey)) : json;
  writeFileSync(filePath, payload, "utf8");
  applyFilePermissions(filePath);
}

export function loadConversation(id, encKey) {
  const filePath = join(getConversationDir(), `${id}.json`);
  if (!existsSync(filePath)) return [];
  try {
    const raw = readFileSync(filePath, "utf8");
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

export function isFirstRun(config) {
  return !config.onboardingDone;
}

// --- PIN management ---

export function hashPin(pin) {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(pin, salt, 100000, 32, "sha256");
  return `pbkdf2v1:${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function needsPinMigration(hash) {
  return !!hash && !hash.startsWith("pbkdf2v1:");
}

function legacyHashPin(pin, salt = "clank-pin-salt") {
  return createHash("sha256").update(salt + pin).digest("hex");
}

export function verifyPin(pin, hash) {
  if (!hash) return false;
  if (hash.startsWith("pbkdf2v1:")) {
    const parts = hash.split(":");
    if (parts.length !== 3) return false;
    const salt = Buffer.from(parts[1], "hex");
    const stored = Buffer.from(parts[2], "hex");
    const computed = pbkdf2Sync(pin, salt, 100000, 32, "sha256");
    if (computed.length !== stored.length) return false;
    return timingSafeEqual(computed, stored);
  }
  // Try current salt first, then legacy salts for backward compat
  const stored = Buffer.from(hash, "hex");
  const computedCurrent = Buffer.from(legacyHashPin(pin, "clank-pin-salt"), "hex");
  if (computedCurrent.length === stored.length && timingSafeEqual(computedCurrent, stored)) return true;
  const computedClankBuild = Buffer.from(legacyHashPin(pin, "clankbuild-pin-salt"), "hex");
  if (computedClankBuild.length === stored.length && timingSafeEqual(computedClankBuild, stored)) return true;
  const computedLlama = Buffer.from(legacyHashPin(pin, "llamatalkbuild-pin-salt"), "hex");
  if (computedLlama.length === stored.length && timingSafeEqual(computedLlama, stored)) return true;
  return false;
}

export function pinRequired(config) {
  if (!config.pinHash) return false;
  if (config.pinFrequency === "never") return false;
  if (config.pinFrequency === "always") return true;
  if (config.pinFrequency === "30days") {
    if (!config.lastUnlockTime) return true;
    const last = new Date(config.lastUnlockTime).getTime();
    const now = Date.now();
    return now - last > 30 * 24 * 60 * 60 * 1000;
  }
  return true;
}

function deepMerge(target, source) {
  const out = { ...target };
  for (const key of Object.keys(source)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
    if (source[key] === null) continue;
    if (
      source[key] !== null &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      typeof target[key] === "object" &&
      target[key] !== null &&
      !Array.isArray(target[key])
    ) {
      out[key] = deepMerge(target[key], source[key]);
    } else {
      out[key] = source[key];
    }
  }
  return out;
}
