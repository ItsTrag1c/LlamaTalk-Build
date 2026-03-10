/**
 * Telegram message renderer — formats agent output for Telegram.
 * Uses HTML parse mode (safer than MarkdownV2 for code blocks).
 * Throttles message edits to stay within Telegram rate limits.
 */

const MAX_MSG_LENGTH = 4096;
const EDIT_INTERVAL_MS = 1500;

// HTML-escape for Telegram HTML parse mode
function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Convert markdown-ish agent output to Telegram HTML.
 * Handles: code blocks, inline code, bold, italic, links.
 */
export function toTelegramHtml(text) {
  if (!text) return "";

  const lines = text.split("\n");
  const result = [];
  let inCodeBlock = false;
  let codeBlockLang = "";
  let codeBuffer = [];

  for (const line of lines) {
    if (!inCodeBlock && line.startsWith("```")) {
      inCodeBlock = true;
      codeBlockLang = line.slice(3).trim();
      codeBuffer = [];
      continue;
    }
    if (inCodeBlock && line.startsWith("```")) {
      inCodeBlock = false;
      const langLabel = codeBlockLang ? `<b>${escapeHtml(codeBlockLang)}</b>\n` : "";
      result.push(`<pre>${langLabel}${escapeHtml(codeBuffer.join("\n"))}</pre>`);
      codeBuffer = [];
      continue;
    }
    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    let processed = escapeHtml(line);
    // Inline code
    processed = processed.replace(/`([^`]+)`/g, "<code>$1</code>");
    // Bold
    processed = processed.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
    // Italic
    processed = processed.replace(/\*(.+?)\*/g, "<i>$1</i>");

    result.push(processed);
  }

  // Unclosed code block
  if (inCodeBlock && codeBuffer.length > 0) {
    result.push(`<pre>${escapeHtml(codeBuffer.join("\n"))}</pre>`);
  }

  return result.join("\n");
}

/**
 * Split a long message into chunks ≤4096 chars, preserving code blocks.
 */
export function splitMessage(html) {
  if (html.length <= MAX_MSG_LENGTH) return [html];

  const chunks = [];
  let remaining = html;

  while (remaining.length > 0) {
    if (remaining.length <= MAX_MSG_LENGTH) {
      chunks.push(remaining);
      break;
    }

    let splitAt = MAX_MSG_LENGTH;
    // Try to split at a newline
    const lastNewline = remaining.lastIndexOf("\n", MAX_MSG_LENGTH);
    if (lastNewline > MAX_MSG_LENGTH * 0.5) {
      splitAt = lastNewline;
    }

    // Check if we're inside a <pre> block
    const chunk = remaining.slice(0, splitAt);
    const preOpens = (chunk.match(/<pre>/g) || []).length;
    const preCloses = (chunk.match(/<\/pre>/g) || []).length;
    if (preOpens > preCloses) {
      // Close the pre tag in this chunk, reopen in next
      chunks.push(chunk + "</pre>");
      remaining = "<pre>" + remaining.slice(splitAt);
    } else {
      chunks.push(chunk);
      remaining = remaining.slice(splitAt);
    }
  }

  return chunks;
}

// Tool call icons
const TOOL_ICONS = {
  read_file: "📄",
  write_file: "✏️",
  edit_file: "✂️",
  list_directory: "📁",
  search_files: "🔍",
  glob_files: "🔎",
  bash: "⚡",
  git: "🌿",
  web_fetch: "🌐",
  web_search: "🔍",
  npm_install: "📦",
  pip_install: "📦",
  install_tool: "🔧",
  generate_file: "📝",
};

export function toolIcon(name) {
  return TOOL_ICONS[name] || "🔧";
}

export function formatToolStart(name, args) {
  const icon = toolIcon(name);
  const summary = formatToolArgs(name, args);
  return `${icon} <i>${escapeHtml(name)}</i>${summary ? " " + escapeHtml(summary) : ""}...`;
}

export function formatToolResult(name, success, summary) {
  const icon = success ? "✅" : "❌";
  return `${icon} <i>${escapeHtml(name)}</i> ${escapeHtml(summary || (success ? "done" : "failed"))}`;
}

function formatToolArgs(name, args) {
  if (!args) return "";
  switch (name) {
    case "read_file":
    case "write_file":
    case "edit_file":
      return args.path || args.file_path || "";
    case "list_directory":
      return args.path || ".";
    case "search_files":
      return args.pattern ? `"${args.pattern}"` : "";
    case "glob_files":
      return args.pattern || "";
    case "bash":
      return args.command ? args.command.slice(0, 60) : "";
    case "git":
      return args.command || args.args || "";
    case "web_fetch":
      return args.url ? args.url.slice(0, 60) : "";
    case "web_search":
      return args.query ? `"${args.query}"` : "";
    default:
      return "";
  }
}

/**
 * ThrottledEditor — accumulates content and edits messages at a throttled rate.
 */
export class ThrottledEditor {
  constructor(bot, chatId) {
    this.bot = bot;
    this.chatId = chatId;
    this.messageId = null;
    this.buffer = "";
    this.lastEditTime = 0;
    this.timer = null;
    this.finished = false;
  }

  /** Set the message ID to edit */
  setMessageId(id) {
    this.messageId = id;
  }

  /** Append content to the buffer */
  append(text) {
    this.buffer += text;
    this._scheduleEdit();
  }

  /** Set the full buffer content */
  setContent(text) {
    this.buffer = text;
    this._scheduleEdit();
  }

  _scheduleEdit() {
    if (this.finished || !this.messageId) return;
    if (this.timer) return; // Already scheduled

    const elapsed = Date.now() - this.lastEditTime;
    const delay = Math.max(0, EDIT_INTERVAL_MS - elapsed);

    this.timer = setTimeout(() => {
      this.timer = null;
      this._doEdit();
    }, delay);
  }

  async _doEdit() {
    if (!this.messageId || !this.buffer) return;

    const html = toTelegramHtml(this.buffer);
    if (!html) return;

    // If too long, just show the last portion with an indicator
    const display = html.length > MAX_MSG_LENGTH
      ? "...\n\n" + html.slice(-(MAX_MSG_LENGTH - 10))
      : html;

    try {
      await this.bot.api.editMessageText(this.chatId, this.messageId, display, {
        parse_mode: "HTML",
      });
      this.lastEditTime = Date.now();
    } catch (err) {
      // "message is not modified" is expected if content hasn't changed
      if (!err.message?.includes("message is not modified")) {
        // Rate limited or other error — ignore, will retry on next schedule
      }
    }
  }

  /** Flush any pending content and do a final edit */
  async flush() {
    this.finished = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    await this._doEdit();
  }

  /** Get the current buffer content */
  getContent() {
    return this.buffer;
  }

  /** Reset for a new message */
  reset() {
    this.messageId = null;
    this.buffer = "";
    this.lastEditTime = 0;
    this.finished = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
