import { readFileSync, existsSync } from "fs";
import { SafetyLevel } from "./base.js";
import { validatePath } from "../safety.js";

export const readFileTool = {
  definition: {
    name: "read_file",
    description: "Read the contents of a file at the given path. Returns the file content with line numbers. For large files, use offset and limit to read specific ranges.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path (absolute or relative to project root)" },
        offset: { type: "number", description: "Line number to start reading from (1-based)" },
        limit: { type: "number", description: "Maximum number of lines to read" },
      },
      required: ["path"],
    },
  },

  safetyLevel: SafetyLevel.SAFE,

  validate(args, context) {
    if (!args.path) return { ok: false, error: "path is required" };
    const { valid, error } = validatePath(args.path, context.projectRoot);
    if (!valid) return { ok: false, error };
    return { ok: true };
  },

  async execute(args, context) {
    const { valid, resolved, error } = validatePath(args.path, context.projectRoot);
    if (!valid) return `Error: ${error}`;

    if (!existsSync(resolved)) {
      return `Error: File not found: ${args.path}`;
    }

    try {
      const content = readFileSync(resolved, "utf8");
      const lines = content.split("\n");

      const offset = Math.max(1, args.offset || 1);
      const limit = args.limit || lines.length;
      const sliced = lines.slice(offset - 1, offset - 1 + limit);

      // Format with line numbers (cat -n style)
      const numbered = sliced.map((line, i) => {
        const lineNum = (offset + i).toString().padStart(6, " ");
        return `${lineNum}\t${line}`;
      });

      let result = numbered.join("\n");

      // Truncate if too large
      if (result.length > 30000) {
        result = result.slice(0, 30000) + `\n... [truncated, ${result.length - 30000} more chars]`;
      }

      return result;
    } catch (err) {
      return `Error reading file: ${err.message}`;
    }
  },

  formatConfirmation(args) {
    return `Read file: ${args.path}`;
  },
};
