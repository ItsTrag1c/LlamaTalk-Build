import { AnthropicProvider } from "./anthropic.js";
import { OpenAIProvider } from "./openai.js";
import { OllamaProvider } from "./ollama.js";
import { GoogleProvider } from "./google.js";
import { PromptFallbackProvider } from "./prompt-fallback.js";
import { validateServerUrl, fetchWithTimeout } from "./stream.js";

export const CLOUD_MODELS = {
  anthropic: ["claude-opus-4-5", "claude-sonnet-4-5", "claude-3-5-haiku-20241022"],
  google:    ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-pro", "gemini-1.5-flash"],
  openai:    ["gpt-4o", "gpt-4o-mini", "o1", "o3-mini"],
};

export function getProviderName(model, config) {
  for (const [provider, models] of Object.entries(CLOUD_MODELS)) {
    if (models.includes(model)) {
      if (config.enabledProviders?.[provider]) return provider;
    }
  }
  return "ollama";
}

/**
 * Get the provider adapter instance + formatting helpers for the current model.
 * Returns { provider: BaseProvider, providerName: string, formatAssistantToolUse, formatToolResult }
 */
export function getProviderForModel(config) {
  const model = config.selectedModel;
  const providerName = getProviderName(model, config);

  if (providerName === "anthropic") {
    return {
      provider: new AnthropicProvider(config),
      providerName: "anthropic",
      formatAssistantToolUse: AnthropicProvider.formatAssistantToolUse,
      formatToolResult: AnthropicProvider.formatToolResult,
    };
  }

  if (providerName === "google") {
    return {
      provider: new GoogleProvider(config),
      providerName: "google",
      formatAssistantToolUse: GoogleProvider.formatAssistantToolUse,
      formatToolResult: GoogleProvider.formatToolResult,
    };
  }

  if (providerName === "openai") {
    return {
      provider: new OpenAIProvider(config, {
        baseUrl: "https://api.openai.com",
        apiKey: config.apiKey_openai,
        isCloud: true,
      }),
      providerName: "openai",
      formatAssistantToolUse: OpenAIProvider.formatAssistantToolUse,
      formatToolResult: OpenAIProvider.formatToolResult,
    };
  }

  // Local model (Ollama or OpenAI-compatible)
  const serverUrl = config.modelServerMap?.[model] || config.ollamaUrl;
  let bt = config.backendType || "ollama";
  if (config.serverBackendMap?.[serverUrl]) {
    bt = config.serverBackendMap[serverUrl];
  }

  if (bt === "openai-compatible") {
    const provider = new OpenAIProvider(config, {
      baseUrl: serverUrl,
      apiKey: null,
      isCloud: false,
    });
    // Check if the model supports native tools; if not, use fallback
    // For OpenAI-compatible servers, most support function calling
    return {
      provider,
      providerName: "openai-compatible",
      formatAssistantToolUse: OpenAIProvider.formatAssistantToolUse,
      formatToolResult: OpenAIProvider.formatToolResult,
    };
  }

  // Ollama native
  const ollamaProvider = new OllamaProvider(config, { baseUrl: serverUrl });
  if (!ollamaProvider.supportsTools(model)) {
    // Wrap in prompt fallback for models without native tool support
    const fallback = new PromptFallbackProvider(ollamaProvider);
    return {
      provider: fallback,
      providerName: "ollama-fallback",
      formatAssistantToolUse: PromptFallbackProvider.formatAssistantToolUse,
      formatToolResult: PromptFallbackProvider.formatToolResult,
    };
  }

  return {
    provider: ollamaProvider,
    providerName: "ollama",
    formatAssistantToolUse: OllamaProvider.formatAssistantToolUse,
    formatToolResult: OllamaProvider.formatToolResult,
  };
}

// --- Server detection (from CLI api.js) ---

export async function detectBackend(url) {
  validateServerUrl(url);
  const base = url.replace(/\/$/, "");

  let looksOllama = false;
  try {
    const res = await fetchWithTimeout(`${base}/api/tags`, {}, 10_000);
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data && Array.isArray(data.models)) looksOllama = true;
    }
  } catch { /* try next */ }

  if (looksOllama) {
    try {
      const res = await fetchWithTimeout(`${base}/v1/models`, {}, 10_000);
      if (res.ok) return "openai-compatible";
    } catch { /* fall through to ollama */ }
    return "ollama";
  }

  try {
    const res = await fetchWithTimeout(`${base}/v1/models`, {}, 10_000);
    if (res.ok) return "openai-compatible";
  } catch { /* neither responded */ }

  return "unknown";
}

export async function getOllamaModels(url) {
  validateServerUrl(url);
  const base = url.replace(/\/$/, "");
  const res = await fetchWithTimeout(`${base}/api/tags`, {}, 10_000);
  if (!res.ok) throw new Error(`Ollama returned ${res.status}`);
  const data = await res.json();
  return (data.models || []).map((m) => m.name);
}

export async function getRunningOllamaModels(url) {
  validateServerUrl(url);
  const base = url.replace(/\/$/, "");
  const res = await fetchWithTimeout(`${base}/api/ps`, {}, 5_000);
  if (!res.ok) throw new Error(`Ollama returned ${res.status}`);
  const data = await res.json();
  return (data.models || []).map((m) => m.name);
}

export async function getOpenAICompatModels(url) {
  const base = url.replace(/\/$/, "");
  const res = await fetchWithTimeout(`${base}/v1/models`, {}, 10_000);
  if (!res.ok) throw new Error(`Server returned ${res.status}`);
  const data = await res.json();
  return (data.data || []).map((m) => m.id);
}

export async function getAllLocalModels(config) {
  const servers = [config.ollamaUrl, ...(config.localServers || [])];
  const allModels = [];
  const runningModels = new Set();
  const modelServerMap = {};
  const serverBackendMap = {};
  const seen = new Set();

  for (const serverUrl of servers) {
    const base = serverUrl.replace(/\/$/, "");
    let bt;
    try {
      bt = await detectBackend(base);
    } catch {
      continue;
    }
    if (bt === "unknown") continue;
    serverBackendMap[base] = bt;

    let models = [];
    try {
      if (bt === "openai-compatible") {
        models = await getOpenAICompatModels(base);
      } else {
        models = await getOllamaModels(base);
      }
    } catch {
      continue;
    }

    for (const m of models) {
      if (!seen.has(m)) {
        seen.add(m);
        allModels.push(m);
        modelServerMap[m] = base;
      }
    }

    if (bt === "ollama") {
      try {
        const running = await getRunningOllamaModels(base);
        for (const m of running) runningModels.add(m);
      } catch { /* ignore */ }
    }
  }

  return { allModels, runningModels, modelServerMap, serverBackendMap };
}
