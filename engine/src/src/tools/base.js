import { resolve } from "path";
import { getMemoryDir as _getMemoryDir } from "../config.js";

export const SafetyLevel = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
};

/**
 * Tool interface:
 * {
 *   definition: {
 *     name: string,
 *     description: string,
 *     parameters: { type: "object", properties: {...}, required: string[] }
 *   },
 *   safetyLevel: SafetyLevel,
 *   readOnly: boolean,          // true = tool only reads/observes, false = tool modifies state
 *   validate(args, context) -> { ok: boolean, error?: string },
 *   execute(args, context) -> Promise<string>,
 *   formatConfirmation(args) -> string,
 * }
 *
 * context: {
 *   projectRoot: string,
 *   config: object,
 *   ui: UIHelper,
 *   signal: AbortSignal,
 * }
 */

// Read-only tools are allowed in Plan mode; write tools are blocked.
export const READ_ONLY_TOOLS = new Set([
  "read_file", "list_directory", "search_files", "glob_files",
  "web_fetch", "web_search",
]);

export function isReadOnlyTool(toolName, args) {
  if (READ_ONLY_TOOLS.has(toolName)) return true;
  // git: read-only subcommands are allowed in plan mode
  if (toolName === "git") {
    const sub = (args?.subcommand || "").split(/\s+/)[0].toLowerCase();
    const safeGit = new Set(["status", "diff", "log", "branch", "show", "remote", "tag", "rev-parse", "shortlog", "blame"]);
    return safeGit.has(sub);
  }
  // Memory writes are allowed in all modes (write_file/edit_file targeting memory dir)
  if ((toolName === "write_file" || toolName === "edit_file") && args?.path) {
    const memDir = _getMemoryDir();
    if (memDir && resolve(args.path).replace(/\\/g, "/").startsWith(memDir.replace(/\\/g, "/"))) return true;
  }
  return false;
}
