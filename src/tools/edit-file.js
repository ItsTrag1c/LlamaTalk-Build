import { readFileSync, writeFileSync, existsSync } from "fs";
import { SafetyLevel } from "./base.js";
import { validatePath } from "../safety.js";

export const editFileTool = {
  definition: {
    name: "edit_file",
    description: "Make targeted edits to a file using search-and-replace. Provide the exact text to find and the replacement text. The old_text must appear exactly once in the file.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path to edit" },
        old_text: { type: "string", description: "Exact text to find (must match uniquely)" },
        new_text: { type: "string", description: "Replacement text" },
      },
      required: ["path", "old_text", "new_text"],
    },
  },

  safetyLevel: SafetyLevel.MODERATE,

  validate(args, context) {
    if (!args.path) return { ok: false, error: "path is required" };
    if (!args.old_text) return { ok: false, error: "old_text is required" };
    if (args.new_text === undefined) return { ok: false, error: "new_text is required" };
    const { valid, error } = validatePath(args.path, context.projectRoot);
    if (!valid) return { ok: false, error };
    return { ok: true };
  },

  async execute(args, context) {
    const { resolved } = validatePath(args.path, context.projectRoot);

    if (!existsSync(resolved)) {
      return `Error: File not found: ${args.path}`;
    }

    const content = readFileSync(resolved, "utf8");

    // Count occurrences
    const occurrences = content.split(args.old_text).length - 1;
    if (occurrences === 0) {
      return `Error: old_text not found in ${args.path}. Make sure you're using the exact text from the file.`;
    }
    if (occurrences > 1) {
      return `Error: old_text found ${occurrences} times in ${args.path}. Provide more surrounding context to make the match unique.`;
    }

    // Backup for undo
    context.sessionChanges?.push({
      type: "edit",
      path: resolved,
      oldContent: content,
      timestamp: Date.now(),
    });

    const newContent = content.replace(args.old_text, args.new_text);
    writeFileSync(resolved, newContent, "utf8");

    // Generate a simple diff summary
    const oldLines = args.old_text.split("\n").length;
    const newLines = args.new_text.split("\n").length;
    return `Successfully edited ${args.path}: replaced ${oldLines} line(s) with ${newLines} line(s)`;
  },

  formatConfirmation(args) {
    const preview = args.old_text.split("\n")[0].slice(0, 60);
    return `Edit ${args.path}? (replacing "${preview}...")`;
  },
};
