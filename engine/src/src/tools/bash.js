import { execSync } from "child_process";
import { SafetyLevel } from "./base.js";
import { isDestructiveCommand, validatePath } from "../safety.js";

export const bashTool = {
  definition: {
    name: "bash",
    description: "Execute a shell command. Use for build commands, running tests, installing dependencies, or any CLI operations. Commands run in the project root by default.",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "The shell command to execute" },
        timeout: { type: "integer", description: "Timeout in milliseconds (default: 120000, max: 600000)" },
        cwd: { type: "string", description: "Working directory (default: project root)" },
      },
      required: ["command"],
    },
  },

  safetyLevel: SafetyLevel.HIGH,

  validate(args, context) {
    if (!args.command) return { ok: false, error: "command is required" };
    if (isDestructiveCommand(args.command)) {
      return { ok: false, error: `Blocked destructive command: ${args.command}` };
    }
    if (args.cwd) {
      const { valid, error } = validatePath(args.cwd, context.projectRoot, { allowExternal: true });
      if (!valid) return { ok: false, error };
    }
    return { ok: true };
  },

  async execute(args, context) {
    const timeout = Math.min(args.timeout || 120000, 600000);
    const cwd = args.cwd
      ? validatePath(args.cwd, context.projectRoot, { allowExternal: true }).resolved
      : context.projectRoot;

    try {
      const output = execSync(args.command, {
        cwd,
        timeout,
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024, // 10MB
        stdio: ["pipe", "pipe", "pipe"],
        shell: true,
      });

      let result = output || "(no output)";
      if (result.length > 30000) {
        result = result.slice(0, 30000) + `\n... [truncated, ${result.length - 30000} more chars]`;
      }
      return `Exit code: 0\n${result}`;
    } catch (err) {
      let output = "";
      if (err.stdout) output += err.stdout;
      if (err.stderr) output += (output ? "\n" : "") + err.stderr;
      if (!output) output = err.message;

      if (output.length > 30000) {
        output = output.slice(0, 30000) + `\n... [truncated]`;
      }
      return `Exit code: ${err.status ?? 1}\n${output}`;
    }
  },

  formatConfirmation(args) {
    return `Execute: ${args.command}`;
  },
};
