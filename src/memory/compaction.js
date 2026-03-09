/**
 * Context compaction (inspired by OpenCode's compaction system).
 *
 * When the conversation approaches the context limit, old tool call outputs
 * are pruned to free space while preserving the conversation flow.
 *
 * Strategy:
 * 1. Scan backwards through messages
 * 2. Identify tool results beyond a "protected" threshold
 * 3. Replace their content with a compact summary
 * 4. Preserve the last N turns and all user/assistant text
 */

const PROTECTED_RECENT_TURNS = 6;  // Always keep the last 6 messages untouched
const MIN_SAVINGS_CHARS = 5000;     // Only compact if we'd save >5K chars
const TOOL_RESULT_ROLE = "tool";

/**
 * Estimate the character cost of a message.
 */
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

/**
 * Create a compact summary of a tool result.
 */
function summarizeToolResult(msg) {
  const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
  const lines = content.split("\n").length;
  const chars = content.length;

  // Keep first and last few lines as context
  const allLines = content.split("\n");
  if (allLines.length <= 10) return content; // Already small

  const head = allLines.slice(0, 3).join("\n");
  const tail = allLines.slice(-2).join("\n");
  return `${head}\n\n[... ${lines - 5} lines / ${chars} chars compacted ...]\n\n${tail}`;
}

/**
 * Compact messages to reduce context usage.
 * Returns a new array of messages with old tool results pruned.
 *
 * @param {Array} messages - The full message array
 * @param {Object} options
 * @param {number} options.targetReduction - Desired character reduction
 * @returns {{ messages: Array, savedChars: number }}
 */
export function compactMessages(messages, { targetReduction = 50000, aggressive = false } = {}) {
  if (messages.length <= PROTECTED_RECENT_TURNS) {
    return { messages: [...messages], savedChars: 0 };
  }

  const result = [...messages];
  let savedChars = 0;

  // Aggressive mode: nuclear option — keep only first user message + last N turns
  // Used when gentle compaction already failed to free enough space
  if (aggressive) {
    const keepRecent = Math.min(PROTECTED_RECENT_TURNS + 2, result.length);
    if (result.length > keepRecent + 1) {
      const removed = result.splice(1, result.length - keepRecent - 1);
      const removedSize = removed.reduce((sum, m) => sum + messageSize(m), 0);
      savedChars += removedSize;
      result.splice(1, 0, {
        role: "assistant",
        content: `[Conversation heavily compacted — ${removed.length} messages dropped to fit context window. Memory and lessons are preserved in the system prompt.]`,
        _compacted: true,
      });
    }
    return { messages: result, savedChars };
  }

  // Protected zone: last N messages
  const compactableEnd = result.length - PROTECTED_RECENT_TURNS;

  // Scan backwards from the compactable zone
  for (let i = compactableEnd - 1; i >= 0; i--) {
    const msg = result[i];

    // Only compact tool results
    if (msg.role === TOOL_RESULT_ROLE || (msg.role === "assistant" && msg.tool_call_id)) {
      const originalSize = messageSize(msg);
      if (originalSize < 500) continue; // Already small, not worth compacting

      const summary = summarizeToolResult(msg);
      const newSize = summary.length;
      const savings = originalSize - newSize;

      if (savings > 100) {
        result[i] = { ...msg, content: summary, _compacted: true };
        savedChars += savings;
      }
    }

    // Also compact large assistant messages (not the most recent ones)
    if (msg.role === "assistant" && typeof msg.content === "string" && msg.content.length > 3000) {
      // Truncate long assistant messages to first 1000 chars + note
      const truncated = msg.content.slice(0, 1000) + `\n\n[... response truncated during compaction, ${msg.content.length - 1000} chars removed ...]`;
      const savings = msg.content.length - truncated.length;
      if (savings > 500) {
        result[i] = { ...msg, content: truncated, _compacted: true };
        savedChars += savings;
      }
    }

    if (savedChars >= targetReduction) break;
  }

  // If we didn't save enough, also drop oldest messages entirely (keep system + first user)
  if (savedChars < MIN_SAVINGS_CHARS && result.length > PROTECTED_RECENT_TURNS + 2) {
    // Remove messages from index 2 to compactableEnd, keeping a compaction notice
    const removed = result.splice(2, compactableEnd - 2);
    const removedSize = removed.reduce((sum, m) => sum + messageSize(m), 0);
    savedChars += removedSize;

    // Insert a summary message
    result.splice(2, 0, {
      role: "assistant",
      content: `[Earlier conversation compacted — ${removed.length} messages removed to free context space. Key context has been preserved in the system prompt and memory.]`,
      _compacted: true,
    });
  }

  return { messages: result, savedChars };
}

/**
 * Check if compaction is needed based on estimated token usage.
 */
export function needsCompaction(promptTokens, contextLimit, threshold = 0.80) {
  if (!promptTokens || !contextLimit) return false;
  return (promptTokens / contextLimit) >= threshold;
}
