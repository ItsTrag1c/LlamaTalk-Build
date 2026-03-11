import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative, extname } from "path";
import { SafetyLevel } from "./base.js";
import { validatePath } from "../safety.js";

const IGNORED_DIRS = new Set(["node_modules", ".git", "dist", "build", "__pycache__", ".next", ".venv", "venv", "target", ".cache"]);
const BINARY_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".svg", ".woff", ".woff2", ".ttf", ".eot", ".mp3", ".mp4", ".avi", ".zip", ".tar", ".gz", ".exe", ".dll", ".so", ".dylib", ".pdf", ".lock"]);

export const searchFilesTool = {
  definition: {
    name: "search_files",
    description: "Search for a regex pattern across files in the project. Returns matching lines with file paths and line numbers.",
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Regex pattern to search for" },
        path: { type: "string", description: "Directory to search in (default: project root)" },
        glob: { type: "string", description: "File glob pattern to filter (e.g., '*.js', '*.ts')" },
        max_results: { type: "integer", description: "Maximum results to return (default: 50)" },
      },
      required: ["pattern"],
    },
  },

  safetyLevel(args) {
    if (!args?.path) return SafetyLevel.LOW;
    const result = validatePath(args.path, process.cwd(), { allowExternal: true });
    if (result.external && result.trusted) return SafetyLevel.LOW;
    if (result.external) return SafetyLevel.MEDIUM;
    return SafetyLevel.LOW;
  },

  validate(args, context) {
    if (!args.pattern) return { ok: false, error: "pattern is required" };
    // Reject excessively long patterns that could cause ReDoS
    if (args.pattern.length > 500) {
      return { ok: false, error: "Pattern too long (max 500 characters)" };
    }
    try {
      new RegExp(args.pattern);
    } catch (e) {
      return { ok: false, error: `Invalid regex: ${e.message}` };
    }
    return { ok: true };
  },

  async execute(args, context) {
    const searchRoot = args.path
      ? validatePath(args.path, context.projectRoot, { allowExternal: true }).resolved
      : context.projectRoot;

    let regex;
    try {
      regex = new RegExp(args.pattern, "i");
    } catch (e) {
      return `Invalid regex pattern: ${e.message}`;
    }
    const maxResults = args.max_results || 50;
    const results = [];

    // Simple glob matching
    const globPattern = args.glob ? new RegExp(
      "^" + args.glob.replace(/\./g, "\\.").replace(/\*/g, ".*").replace(/\?/g, ".") + "$"
    ) : null;

    function walk(dir) {
      if (results.length >= maxResults) return;
      try {
        const items = readdirSync(dir);
        for (const item of items) {
          if (results.length >= maxResults) break;
          if (IGNORED_DIRS.has(item)) continue;

          const fullPath = join(dir, item);
          try {
            const stat = statSync(fullPath);
            if (stat.isDirectory()) {
              walk(fullPath);
            } else if (stat.isFile()) {
              const ext = extname(item).toLowerCase();
              if (BINARY_EXTENSIONS.has(ext)) continue;
              if (stat.size > 1048576) continue; // skip files > 1MB

              if (globPattern && !globPattern.test(item)) continue;

              try {
                const content = readFileSync(fullPath, "utf8");
                const lines = content.split("\n");
                for (let i = 0; i < lines.length; i++) {
                  if (results.length >= maxResults) break;
                  if (regex.test(lines[i])) {
                    const rel = relative(context.projectRoot, fullPath);
                    const trimmedLine = lines[i].length > 200 ? lines[i].slice(0, 200) + "..." : lines[i];
                    results.push(`${rel}:${i + 1}: ${trimmedLine}`);
                  }
                }
              } catch { /* skip unreadable */ }
            }
          } catch { /* skip */ }
        }
      } catch { /* skip */ }
    }

    walk(searchRoot);

    if (results.length === 0) {
      return `No matches found for pattern: ${args.pattern}`;
    }

    let output = results.join("\n");
    if (results.length >= maxResults) {
      output += `\n... [limited to ${maxResults} results]`;
    }
    return output;
  },

  formatConfirmation(args) {
    return `Search for: ${args.pattern}`;
  },
};
