import { BaseProvider } from "./base.js";
import { streamRequest, streamLines } from "./stream.js";

const CONTEXT_WINDOWS = {
  "gemini-2.0-flash": 1048576,
  "gemini-2.0-flash-lite": 1048576,
  "gemini-1.5-pro": 2097152,
  "gemini-1.5-flash": 1048576,
};

// Gemini uses uppercase type names
function toGeminiType(jsonSchemaType) {
  const map = {
    string: "STRING",
    number: "NUMBER",
    integer: "INTEGER",
    boolean: "BOOLEAN",
    array: "ARRAY",
    object: "OBJECT",
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

export class GoogleProvider extends BaseProvider {
  formatTools(tools) {
    return [{
      functionDeclarations: tools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: {
          type: "OBJECT",
          properties: convertProperties(t.parameters.properties),
          required: t.parameters.required || [],
        },
      })),
    }];
  }

  contextWindow() {
    return CONTEXT_WINDOWS[this.config.selectedModel] || 1048576;
  }

  async *stream(messages, systemPrompt, tools, signal) {
    const apiKey = this.config.apiKey_google;
    if (!apiKey) throw new Error("Google API key not set. Use /set api-key google <key>");

    const model = this.config.selectedModel;
    const temperature = this.config.temperature ?? 0.7;

    // Convert messages to Gemini format
    // Gemini requires role alternation (user/model). Multiple tool results must be merged.
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
              response: { result: typeof m.content === "string" ? m.content : JSON.stringify(m.content) },
            },
          }],
        };
      } else if (m.role === "assistant" && m._geminiParts) {
        // Reconstruct model message with proper function call parts
        converted = { role: "model", parts: m._geminiParts };
      } else {
        converted = {
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }],
        };
      }

      // Merge consecutive same-role messages (required by Gemini API)
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
      body: JSON.stringify(reqBody),
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
              arguments: part.functionCall.args || {},
            };
          }
        }

        if (obj.usageMetadata) {
          usage = {
            promptTokens: obj.usageMetadata.promptTokenCount || 0,
            outputTokens: obj.usageMetadata.candidatesTokenCount || 0,
          };
        }
      } catch { /* skip */ }
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
    // Store parts array for proper reconstruction in stream() via _geminiParts
    return { role: "assistant", content: text || "", _geminiParts: parts };
  }

  static formatToolResult(toolCallId, result, toolName) {
    return {
      role: "tool_result",
      tool_use_id: toolCallId,
      tool_name: toolName,
      content: typeof result === "string" ? result : JSON.stringify(result),
    };
  }
}
