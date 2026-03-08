import { execSync } from "child_process";
import { SafetyLevel } from "./base.js";

const SAFE_SUBCOMMANDS = new Set(["status", "diff", "log", "branch", "show", "remote", "tag", "rev-parse", "shortlog", "blame"]);
const DANGEROUS_SUBCOMMANDS = new Set(["commit", "push", "merge", "rebase", "reset", "checkout", "stash", "clean", "cherry-pick", "revert"]);

function getSubcommand(args) {
  return (args.subcommand || "").split(/\s+/)[0].toLowerCase();
}

export const gitTool = {
  definition: {
    name: "git",
    description: "Execute git operations. Safe operations (status, diff, log, branch, show) run automatically. Mutations (commit, push, checkout, reset) need confirmation.",
    parameters: {
      type: "object",
      properties: {
        subcommand: { type: "string", description: "Git subcommand (e.g., 'status', 'diff', 'log --oneline -10', 'commit -m \"message\"')" },
        args: { type: "string", description: "Additional arguments (appended to subcommand)" },
      },
      required: ["subcommand"],
    },
  },

  // Dynamic safety level
  safetyLevel(args) {
    const sub = getSubcommand(args);
    if (SAFE_SUBCOMMANDS.has(sub)) return SafetyLevel.SAFE;
    return SafetyLevel.DANGEROUS;
  },

  validate(args, context) {
    if (!args.subcommand) return { ok: false, error: "subcommand is required" };

    const fullCmd = `git ${args.subcommand}${args.args ? " " + args.args : ""}`;

    // Block force pushes to main/master
    if (/push\s+.*--force/.test(fullCmd) && /(main|master)/.test(fullCmd)) {
      return { ok: false, error: "Force push to main/master is blocked" };
    }

    // Block destructive resets
    if (/reset\s+--hard/.test(fullCmd)) {
      return { ok: false, error: "git reset --hard is blocked. Use a safer alternative." };
    }

    return { ok: true };
  },

  async execute(args, context) {
    const fullCmd = `git ${args.subcommand}${args.args ? " " + args.args : ""}`;

    try {
      const output = execSync(fullCmd, {
        cwd: context.projectRoot,
        timeout: 30000,
        encoding: "utf8",
        maxBuffer: 5 * 1024 * 1024,
        stdio: ["pipe", "pipe", "pipe"],
      });

      let result = output || "(no output)";
      if (result.length > 30000) {
        result = result.slice(0, 30000) + `\n... [truncated]`;
      }
      return result;
    } catch (err) {
      let output = "";
      if (err.stdout) output += err.stdout;
      if (err.stderr) output += (output ? "\n" : "") + err.stderr;
      return output || `Git error: ${err.message}`;
    }
  },

  formatConfirmation(args) {
    return `Run: git ${args.subcommand}${args.args ? " " + args.args : ""}?`;
  },
};
