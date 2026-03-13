import { BaseProvider } from "./base.js";
import { streamRequest, streamLines, validateServerUrl, fetchWithTimeout } from "./stream.js";

// Cache for detected context windows (model → token count)
const _contextWindowCache = new Map();

// Models known to support tool calling
// Patterns match after optional "namespace/" prefix (e.g. "Qwen/Qwen2.5-Coder")
const TOOL_CAPABLE_PATTERNS = [
  /(?:^|\/)llama3\.[1-9]/,
  /(?:^|\/)llama-3\.[1-9]/,
  /(?:^|\/)qwen[23]/,       // Qwen2, Qwen2.5, Qwen3, Qwen3.5, etc.
  /(?:^|\/)mistral-nemo/,
  /(?:^|\/)mistral-large/,
  /(?:^|\/)command-r/,
  /(?:^|\/)firefunction/,
  /(?:^|\/)nexusraven/,
];

export class OllamaProvider extends BaseProvider {
  constructor(config, options = {}) {
    super(config, options);
    this.baseUrl = options.baseUrl || config.ollamaUrl || "http://localhost:11434";
  }

  formatTools(tools) {
    return tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
  }

  contextWindow() {
    // Return cached detected value, or fall back to 32768
    const model = this.config.selectedModel;
    if (model && _contextWindowCache.has(model)) {
      return _contextWindowCache.get(model);
    }
    return 32768;
  }

  /**
   * Query Ollama's /api/show endpoint to detect the model's actual context window.
   * Caches the result per model so it's only fetched once per session.
   */
  async detectContextWindow(model) {
    if (!model) return;
    if (_contextWindowCache.has(model)) return _contextWindowCache.get(model);

    try {
      const base = this.baseUrl.replace(/\/$/, "");
      const res = await fetchWithTimeout(
        `${base}/api/show`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: model }),
        },
        10_000
      );
      if (!res.ok) return;

      const data = await res.json();

      // Try model_info first (newer Ollama versions)
      let ctxLen = data.model_info?.["general.context_length"];

      // Fall back to parameters.num_ctx
      if (!ctxLen && data.parameters) {
        const match = data.parameters.match(/num_ctx\s+(\d+)/);
        if (match) ctxLen = parseInt(match[1], 10);
      }

      if (ctxLen && ctxLen > 0) {
        _contextWindowCache.set(model, ctxLen);
        return ctxLen;
      }
    } catch { /* non-fatal — fall back to default */ }
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

    // Build messages with system prompt
    const msgs = [];
    if (systemPrompt) msgs.push({ role: "system", content: systemPrompt });

    for (const m of messages) {
      if (m.role === "tool_result") {
        // Ollama uses OpenAI-compatible format: role "tool" with tool_call_id
        // to correlate results with the tool call that produced them.
        msgs.push({
          role: "tool",
          tool_call_id: m.tool_use_id,
          content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
        });
      } else if (m.role === "assistant" && m.tool_calls) {
        // Preserve tool_calls on assistant messages so the model can see
        // its own prior tool usage in the conversation history.
        msgs.push({ role: m.role, content: m.content || "", tool_calls: m.tool_calls });
      } else {
        msgs.push({ role: m.role, content: m.content });
      }
    }

    // Apply local optimization settings if available
    const localOpts = this.config.localOptimizations?.enabled ? this.config.localOptimizations : null;

    const reqBody = {
      model,
      messages: msgs,
      stream: true,
      options: {
        temperature,
        ...(localOpts?.maxResponseTokens && { num_predict: localOpts.maxResponseTokens }),
      },
    };

    // Only include tools if model supports them
    if (tools && tools.length > 0 && this.supportsTools(model)) {
      reqBody.tools = this.formatTools(tools);
    }

    const res = await streamRequest(
      `${base}/api/chat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reqBody),
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

        // Tool calls from Ollama
        if (obj.message?.tool_calls) {
          for (const tc of obj.message.tool_calls) {
            yield {
              type: "tool_call",
              id: `ollama_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              name: tc.function?.name,
              arguments: tc.function?.arguments || {},
            };
          }
        }

        if (obj.done) {
          usage = {
            promptTokens: obj.prompt_eval_count || 0,
            outputTokens: obj.eval_count || 0,
            evalDurationNs: obj.eval_duration || null,
          };
          break;
        }
      } catch {
        // Fallback: llama.cpp may send SSE format even on /api/chat
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try {
            const obj = JSON.parse(data);
            const token = obj.choices?.[0]?.delta?.content || obj.message?.content;
            if (token) yield { type: "text", content: token };
          } catch { /* skip */ }
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
        function: { name: tc.name, arguments: tc.arguments },
      })),
    };
  }

  static formatToolResult(toolCallId, result) {
    return {
      role: "tool_result",
      tool_use_id: toolCallId,
      content: typeof result === "string" ? result : JSON.stringify(result),
    };
  }
}
