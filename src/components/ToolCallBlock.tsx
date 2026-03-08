import type { ToolCall } from "../lib/types";

const TOOL_ICONS: Record<string, string> = {
  read_file: "📄",
  write_file: "✏️",
  edit_file: "✂️",
  list_directory: "📁",
  search_files: "🔍",
  glob_files: "🔍",
  bash: "⚡",
  git: "🌿",
  web_fetch: "🌐",
  web_search: "🌐",
  npm_install: "📦",
  pip_install: "📦",
  install_tool: "🔧",
  generate_file: "📝",
};

interface ToolCallBlockProps {
  tool: ToolCall;
}

export function ToolCallBlock({ tool }: ToolCallBlockProps) {
  const icon = TOOL_ICONS[tool.name] || "🔧";
  const statusColor =
    tool.status === "running"
      ? "border-[var(--accent)]"
      : tool.status === "success"
        ? "border-[var(--success)]"
        : "border-[var(--error)]";

  const statusIcon =
    tool.status === "running"
      ? "⏳"
      : tool.status === "success"
        ? "✓"
        : "✗";

  const argSummary = tool.arguments?.path
    ? String(tool.arguments.path)
    : tool.arguments?.command
      ? String(tool.arguments.command).slice(0, 80)
      : tool.arguments?.pattern
        ? String(tool.arguments.pattern)
        : "";

  return (
    <div className={`border-l-2 ${statusColor} pl-4 py-2.5 my-2`}>
      <div className="flex items-center gap-3 text-[15px]">
        <span className="text-lg">{icon}</span>
        <span className="font-semibold text-[var(--text)]">{tool.name}</span>
        {argSummary && (
          <span className="text-[var(--text-dim)] truncate max-w-[350px] font-mono text-sm">
            {argSummary}
          </span>
        )}
        <span className={`ml-auto text-sm ${
          tool.status === "success" ? "text-[var(--success)]" :
          tool.status === "error" ? "text-[var(--error)]" :
          "text-[var(--accent)]"
        }`}>
          {statusIcon}
        </span>
      </div>
      {tool.summary && tool.status !== "running" && (
        <div className="text-sm text-[var(--text-dim)] mt-1.5 truncate">
          {tool.summary}
        </div>
      )}
    </div>
  );
}
