import { readdirSync, statSync } from "fs";
import { join, relative } from "path";
import { SafetyLevel } from "./base.js";
import { validatePath } from "../safety.js";

const IGNORED = new Set(["node_modules", ".git", "dist", "build", "__pycache__", ".next", ".venv", "venv", "target"]);

export const listDirectoryTool = {
  definition: {
    name: "list_directory",
    description: "List the contents of a directory. Returns file/directory names with types. Filters out common build/dependency directories by default.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Directory path (default: project root)" },
        recursive: { type: "boolean", description: "List recursively (max depth 3)" },
      },
      required: [],
    },
  },

  safetyLevel: SafetyLevel.SAFE,

  validate(args, context) {
    if (args.path) {
      const { valid, error } = validatePath(args.path, context.projectRoot);
      if (!valid) return { ok: false, error };
    }
    return { ok: true };
  },

  async execute(args, context) {
    const targetPath = args.path
      ? validatePath(args.path, context.projectRoot).resolved
      : context.projectRoot;

    const entries = [];
    const maxEntries = 500;

    function walk(dir, depth) {
      if (entries.length >= maxEntries) return;
      try {
        const items = readdirSync(dir);
        for (const item of items) {
          if (entries.length >= maxEntries) break;
          if (IGNORED.has(item)) continue;
          if (item.startsWith(".") && item !== ".env" && item !== ".gitignore") continue;

          const fullPath = join(dir, item);
          try {
            const stat = statSync(fullPath);
            const rel = relative(context.projectRoot, fullPath);
            const prefix = "  ".repeat(depth);

            if (stat.isDirectory()) {
              entries.push(`${prefix}${item}/`);
              if (args.recursive && depth < 3) {
                walk(fullPath, depth + 1);
              }
            } else {
              const size = stat.size;
              const sizeStr = size < 1024 ? `${size}B` : size < 1048576 ? `${(size / 1024).toFixed(1)}KB` : `${(size / 1048576).toFixed(1)}MB`;
              entries.push(`${prefix}${item}  (${sizeStr})`);
            }
          } catch { /* skip unreadable */ }
        }
      } catch (err) {
        entries.push(`Error reading directory: ${err.message}`);
      }
    }

    walk(targetPath, 0);

    if (entries.length >= maxEntries) {
      entries.push(`... [limited to ${maxEntries} entries]`);
    }

    return entries.join("\n") || "Empty directory";
  },

  formatConfirmation(args) {
    return `List directory: ${args.path || "."}`;
  },
};
