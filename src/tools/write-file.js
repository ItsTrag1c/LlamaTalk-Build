import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { dirname } from "path";
import { SafetyLevel } from "./base.js";
import { validatePath } from "../safety.js";

export const writeFileTool = {
  definition: {
    name: "write_file",
    description: "Write content to a file. Creates parent directories if needed. Overwrites existing files entirely.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path to write to" },
        content: { type: "string", description: "The full content to write" },
      },
      required: ["path", "content"],
    },
  },

  safetyLevel: SafetyLevel.MODERATE,

  validate(args, context) {
    if (!args.path) return { ok: false, error: "path is required" };
    if (args.content === undefined) return { ok: false, error: "content is required" };
    const { valid, error } = validatePath(args.path, context.projectRoot);
    if (!valid) return { ok: false, error };
    return { ok: true };
  },

  async execute(args, context) {
    const { resolved } = validatePath(args.path, context.projectRoot);

    // Backup existing file for undo
    if (existsSync(resolved)) {
      try {
        const oldContent = readFileSync(resolved, "utf8");
        context.sessionChanges?.push({
          type: "write",
          path: resolved,
          oldContent,
          timestamp: Date.now(),
        });
      } catch { /* binary or unreadable */ }
    } else {
      context.sessionChanges?.push({
        type: "create",
        path: resolved,
        timestamp: Date.now(),
      });
    }

    const dir = dirname(resolved);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(resolved, args.content, "utf8");
    const bytes = Buffer.byteLength(args.content, "utf8");
    return `Successfully wrote ${bytes} bytes to ${args.path}`;
  },

  formatConfirmation(args) {
    const bytes = Buffer.byteLength(args.content || "", "utf8");
    return `Write ${bytes} bytes to ${args.path}?`;
  },
};
