import { BaseProvider } from "./base.js";
import { streamRequest, streamLines } from "./stream.js";

const CONTEXT_WINDOWS = {
  "claude-opus-4-5": 200000,
  "claude-sonnet-4-5": 200000,
  "claude-3-5-haiku-20241022": 200000,
};

export class AnthropicProvider extends BaseProvider {
  formatTools(tools) {
    return tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    }));
  }

  contextWindow() {
    return CONTEXT_WINDOWS[this.config.selectedModel] || 200000;
  }

  async *stream(messages, systemPrompt, tools, signal) {
    const apiKey = this.config.apiKey_anthropic;
    if (!apiKey) throw new Error("Anthropic API key not set. Use /set api-key anthropic <key>");

    const model = this.config.selectedModel;
    const temperature = this.config.temperature ?? 0.7;

    // Convert messages to Anthropic format
    const anthropicMessages = [];
    for (const m of messages) {
      if (m.role === "system") continue;
      if (m.role === "tool_result") {
        // Tool results go as user messages with tool_result content blocks
        anthropicMessages.push({
          role: "user",
          content: Array.isArray(m.content) ? m.content : [{ type: "tool_result", tool_use_id: m.tool_use_id, content: m.content }],
        });
      } else {
        anthropicMessages.push({ role: m.role, content: m.content });
      }
    }

    const reqBody = {
      model,
      max_tokens: 8192,
      messages: anthropicMessages,
      temperature,
      stream: true,
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
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(reqBody),
      },
      signal
    );

    let usage = { promptTokens: 0, outputTokens: 0 };
    let currentToolCall = null;
    let toolCallJsonBuf = "";

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
              name: obj.content_block.name,
            };
            toolCallJsonBuf = "";
          }
        }

        if (obj.type === "content_block_delta") {
          if (obj.delta?.type === "text_delta" && obj.delta.text) {
            yield { type: "text", content: obj.delta.text };
          }
          if (obj.delta?.type === "input_json_delta" && obj.delta.partial_json) {
            toolCallJsonBuf += obj.delta.partial_json;
          }
        }

        if (obj.type === "content_block_stop" && currentToolCall) {
          let args = {};
          try {
            args = JSON.parse(toolCallJsonBuf);
          } catch { /* empty or malformed */ }
          yield {
            type: "tool_call",
            id: currentToolCall.id,
            name: currentToolCall.name,
            arguments: args,
          };
          currentToolCall = null;
          toolCallJsonBuf = "";
        }

        if (obj.type === "message_delta" && obj.usage) {
          usage.outputTokens = obj.usage.output_tokens || 0;
        }

        if (obj.type === "message_stop") {
          yield { type: "usage", ...usage };
          yield { type: "done" };
          return;
        }
      } catch { /* skip unparseable lines */ }
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
        content: typeof result === "string" ? result : JSON.stringify(result),
      }],
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
        input: tc.arguments,
      });
    }
    return { role: "assistant", content };
  }
}
