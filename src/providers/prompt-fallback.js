/**
 * Prompt-based fallback for models without native tool/function calling support.
 * Wraps any BaseProvider: injects tool descriptions into the system prompt as XML
 * and parses <tool_call> blocks from the LLM's text output.
 */

export class PromptFallbackProvider {
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

    let block = `\nYou have access to the following tools. To use a tool, respond with a <tool_call> block:\n\n`;
    block += `<tool_call>\n{"name": "tool_name", "arguments": {"param1": "value1"}}\n</tool_call>\n\n`;
    block += `You may use multiple tool calls in a single response. Each must be in its own <tool_call> block.\n\n`;
    block += `Available tools:\n`;

    for (const t of tools) {
      block += `\n- ${t.name}: ${t.description}\n`;
      if (t.parameters?.properties) {
        const params = Object.entries(t.parameters.properties).map(([k, v]) => {
          const req = (t.parameters.required || []).includes(k) ? " (required)" : "";
          return `    ${k}: ${v.type} — ${v.description || ""}${req}`;
        });
        block += `  Parameters:\n${params.join("\n")}\n`;
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
            arguments: parsed.arguments || {},
          });
        }
      } catch { /* skip malformed */ }
      cleanText = cleanText.replace(match[0], "");
    }

    return { cleanText: cleanText.trim(), toolCalls };
  }

  async *stream(messages, systemPrompt, tools, signal) {
    // Append tool descriptions to system prompt
    const toolBlock = this.formatToolsAsPrompt(tools);
    const augmentedPrompt = (systemPrompt || "") + toolBlock;

    // Stream text progressively. Buffer only when we might be inside a <tool_call> tag
    // so the user sees output immediately instead of waiting for the full response.
    let fullText = "";
    let buffer = "";
    const otherEvents = [];

    for await (const event of this.inner.stream(messages, augmentedPrompt, null, signal)) {
      if (event.type === "text") {
        buffer += event.content;

        // Check if buffer contains a complete or partial <tool_call> opening
        const tagIdx = buffer.indexOf("<tool_call>");
        if (tagIdx >= 0) {
          // Flush everything before the tag
          if (tagIdx > 0) {
            const before = buffer.slice(0, tagIdx);
            fullText += before;
            yield { type: "text", content: before };
          }
          // Hold back from <tool_call> onwards (will be parsed at the end)
          buffer = buffer.slice(tagIdx);
        } else {
          // Check for a partial '<' that might be start of <tool_call>
          const lastLt = buffer.lastIndexOf("<");
          if (lastLt >= 0 && buffer.length - lastLt < "<tool_call>".length) {
            // Might be a partial tag — flush before it, hold the rest
            if (lastLt > 0) {
              const safe = buffer.slice(0, lastLt);
              fullText += safe;
              yield { type: "text", content: safe };
              buffer = buffer.slice(lastLt);
            }
          } else {
            // No potential tag — flush all
            fullText += buffer;
            yield { type: "text", content: buffer };
            buffer = "";
          }
        }
      } else {
        otherEvents.push(event);
      }
    }

    // Flush any remaining buffer
    fullText += buffer;

    // Parse tool calls from full text
    const { cleanText, toolCalls } = this.parseToolCalls(fullText);

    // If tool calls were found, yield a clean_text event so the caller
    // can replace the displayed text in conversation history
    if (toolCalls.length > 0) {
      yield { type: "clean_text", content: cleanText, rawText: fullText };
    } else if (buffer) {
      // Remaining buffer had no tool calls — yield it as text
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
    // Reconstruct the text with tool_call blocks for conversation history
    let content = text || "";
    for (const tc of toolCalls) {
      content += `\n<tool_call>\n${JSON.stringify({ name: tc.name, arguments: tc.arguments })}\n</tool_call>`;
    }
    return { role: "assistant", content };
  }

  static formatToolResult(toolCallId, result) {
    return {
      role: "user",
      content: `Tool result for ${toolCallId}:\n${typeof result === "string" ? result : JSON.stringify(result)}`,
    };
  }
}
