/**
 * Base provider interface. All provider adapters extend this.
 *
 * stream() returns an AsyncGenerator yielding events:
 *   { type: "text", content: string }
 *   { type: "tool_call", id: string, name: string, arguments: object }
 *   { type: "usage", promptTokens: number, outputTokens: number, evalDurationNs?: number }
 *   { type: "done" }
 */
export class BaseProvider {
  constructor(config, options = {}) {
    this.config = config;
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
    // Rough fallback: ~4 chars per token
    let total = 0;
    for (const m of messages) {
      const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
      total += Math.ceil(content.length / 4) + 4; // 4 tokens overhead per message
    }
    return total;
  }

  /** Maximum context window for the current model */
  contextWindow() {
    return 8192; // conservative default
  }
}
