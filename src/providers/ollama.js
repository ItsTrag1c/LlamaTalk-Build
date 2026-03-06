import { BaseProvider } from "./base.js";
import { streamRequest, streamLines, validateServerUrl } from "./stream.js";

// Models known to support tool calling
const TOOL_CAPABLE_PATTERNS = [
  /^llama3\.[1-9]/,
  /^llama-3\.[1-9]/,
  /^qwen2\.5/,
  /^qwen2/,
  /^mistral-nemo/,
  /^mistral-large/,
  /^command-r/,
  /^firefunction/,
  /^nexusraven/,
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
    return 32768; // most Ollama models
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
        msgs.push({ role: "tool", content: typeof m.content === "string" ? m.content : JSON.stringify(m.content) });
      } else {
        msgs.push({ role: m.role, content: m.content });
      }
    }

    const reqBody = {
      model,
      messages: msgs,
      stream: true,
      options: { temperature },
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
