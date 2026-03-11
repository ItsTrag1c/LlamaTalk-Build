import { spawnSync } from "child_process";
import { SafetyLevel } from "./base.js";

const SAFE_SUBCOMMANDS = new Set(["status", "diff", "log", "branch", "show", "remote", "tag", "rev-parse", "shortlog", "blame"]);
const DANGEROUS_SUBCOMMANDS = new Set(["commit", "push", "merge", "rebase", "reset", "checkout", "stash", "clean", "cherry-pick", "revert"]);

function getSubcommand(args) {
  return (args.subcommand || "").split(/\s+/)[0].toLowerCase();
}

// Parse a subcommand + args string into an array, respecting quoted strings
function parseGitArgs(subcommand, extra) {
  const combined = extra ? `${subcommand} ${extra}` : subcommand;
  const args = [];
  // Match quoted strings or non-whitespace sequences
  const regex = /(?:"([^"]*)")|(?:'([^']*)')|(\S+)/g;
  let match;
  while ((match = regex.exec(combined)) !== null) {
    args.push(match[1] ?? match[2] ?? match[3]);
  }
  return args;
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
    if (SAFE_SUBCOMMANDS.has(sub)) return SafetyLevel.LOW;
    return SafetyLevel.HIGH;
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
    // Use spawnSync with argument array (shell: false) to prevent shell injection
    const gitArgs = parseGitArgs(args.subcommand, args.args);

    try {
      const result = spawnSync("git", gitArgs, {
        cwd: context.projectRoot,
        timeout: 30000,
        encoding: "utf8",
        maxBuffer: 5 * 1024 * 1024,
        stdio: ["pipe", "pipe", "pipe"],
      });

      if (result.status !== 0) {
        let output = "";
        if (result.stdout) output += result.stdout;
        if (result.stderr) output += (output ? "\n" : "") + result.stderr;
        return output || `Git error (exit code ${result.status})`;
      }

      let output = result.stdout || "(no output)";
      if (output.length > 30000) {
        output = output.slice(0, 30000) + `\n... [truncated]`;
      }
      return output;
    } catch (err) {
      return `Git error: ${err.message}`;
    }
  },

  formatConfirmation(args) {
    return `Run: git ${args.subcommand}${args.args ? " " + args.args : ""}?`;
  },
};
