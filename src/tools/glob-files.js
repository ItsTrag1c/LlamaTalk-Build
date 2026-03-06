import { readdirSync, statSync } from "fs";
import { join, relative } from "path";
import { SafetyLevel } from "./base.js";
import { validatePath } from "../safety.js";

const IGNORED_DIRS = new Set(["node_modules", ".git", "dist", "build", "__pycache__", ".next", ".venv", "venv", "target", ".cache"]);

function globToRegex(pattern) {
  // Convert glob pattern to regex
  let regex = pattern
    .replace(/\\/g, "/")
    .replace(/\./g, "\\.")
    .replace(/\*\*/g, "<<<GLOBSTAR>>>")
    .replace(/\*/g, "[^/]*")
    .replace(/\?/g, "[^/]")
    .replace(/<<<GLOBSTAR>>>/g, ".*");
  return new RegExp("^" + regex + "$");
}

export const globFilesTool = {
  definition: {
    name: "glob_files",
    description: "Find files matching a glob pattern. Returns file paths sorted by modification time. Supports ** for recursive matching.",
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Glob pattern (e.g., '**/*.js', 'src/**/*.ts')" },
        path: { type: "string", description: "Base directory (default: project root)" },
      },
      required: ["pattern"],
    },
  },

  safetyLevel: SafetyLevel.SAFE,

  validate(args, context) {
    if (!args.pattern) return { ok: false, error: "pattern is required" };
    return { ok: true };
  },

  async execute(args, context) {
    const baseDir = args.path
      ? validatePath(args.path, context.projectRoot).resolved
      : context.projectRoot;

    const regex = globToRegex(args.pattern);
    const results = [];
    const maxResults = 200;

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
            const rel = relative(baseDir, fullPath).replace(/\\/g, "/");

            if (stat.isDirectory()) {
              walk(fullPath);
            } else if (stat.isFile()) {
              if (regex.test(rel)) {
                results.push({ path: rel, mtime: stat.mtimeMs });
              }
            }
          } catch { /* skip */ }
        }
      } catch { /* skip */ }
    }

    walk(baseDir);

    // Sort by modification time (most recent first)
    results.sort((a, b) => b.mtime - a.mtime);

    if (results.length === 0) {
      return `No files matching pattern: ${args.pattern}`;
    }

    let output = results.map((r) => r.path).join("\n");
    if (results.length >= maxResults) {
      output += `\n... [limited to ${maxResults} results]`;
    }
    return output;
  },

  formatConfirmation(args) {
    return `Find files matching: ${args.pattern}`;
  },
};
