import { BaseProvider } from "./base.js";
import { streamRequest, streamLines, validateCloudUrl } from "./stream.js";

const CONTEXT_WINDOWS = {
  "gpt-4o": 128000,
  "gpt-4o-mini": 128000,
  "o1": 200000,
  "o3-mini": 200000,
};

export class OpenAIProvider extends BaseProvider {
  constructor(config, options = {}) {
    super(config, options);
    // options: { baseUrl, apiKey, isCloud }
    this.baseUrl = options.baseUrl || "https://api.openai.com";
    this.apiKey = options.apiKey || config.apiKey_openai;
    this.isCloud = options.isCloud ?? true;
    // Validate cloud URLs against domain allowlist
    if (this.isCloud) validateCloudUrl(this.baseUrl);
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
    if (!this.isCloud) return 32768; // conservative for local servers
    return CONTEXT_WINDOWS[this.config.selectedModel] || 128000;
  }

  async *stream(messages, systemPrompt, tools, signal) {
    const model = this.config.selectedModel;
    const temperature = this.config.temperature ?? 0.7;

    // Build messages array with system prompt
    const msgs = [];
    if (systemPrompt) msgs.push({ role: "system", content: systemPrompt });

    for (const m of messages) {
      if (m.role === "tool_result") {
        // OpenAI uses role: "tool"
        msgs.push({
          role: "tool",
          tool_call_id: m.tool_use_id,
          content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
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
      stream_options: { include_usage: true },
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
      body: JSON.stringify(reqBody),
    }, signal);

    let usage = null;
    // Accumulate tool calls across chunks
    const toolCallAccum = {}; // index -> { id, name, arguments }
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

        // Accumulate tool calls
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

        // Emit accumulated tool calls on finish_reason (handle all known values)
        const fr = choice?.finish_reason;
        if (fr === "tool_calls" || fr === "function_call" || fr === "stop") {
          for (const [, tc] of Object.entries(toolCallAccum)) {
            if (tc.name) {
              let args = {};
              try { args = JSON.parse(tc.arguments); } catch { /* empty */ }
              yield { type: "tool_call", id: tc.id || `openai_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, name: tc.name, arguments: args };
            }
          }
          toolCallsEmitted = true;
        }

        if (obj.usage) {
          usage = {
            promptTokens: obj.usage.prompt_tokens || 0,
            outputTokens: obj.usage.completion_tokens || 0,
          };
        }
      } catch { /* skip */ }
    }

    // Safety net: emit any remaining unemitted tool calls (some APIs end stream without finish_reason)
    if (!toolCallsEmitted) {
      for (const [, tc] of Object.entries(toolCallAccum)) {
        if (tc.name) {
          let args = {};
          try { args = JSON.parse(tc.arguments); } catch { /* empty */ }
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
          arguments: JSON.stringify(tc.arguments),
        },
      })),
    };
  }

  /** Format tool result for OpenAI */
  static formatToolResult(toolCallId, result) {
    return {
      role: "tool_result",
      tool_use_id: toolCallId,
      content: typeof result === "string" ? result : JSON.stringify(result),
    };
  }
}
