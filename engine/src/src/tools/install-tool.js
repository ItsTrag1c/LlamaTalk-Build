import { spawnSync } from "child_process";
import { SafetyLevel } from "./base.js";

const ALLOWED_MANAGERS = ["npm", "pip", "winget", "choco"];

// Argument arrays — prevents shell injection by avoiding string interpolation
const MANAGER_INSTALL_ARGS = {
  npm: (pkg) => ({ cmd: "npm", args: ["install", "-g", pkg] }),
  pip: (pkg) => ({ cmd: "pip", args: ["install", pkg] }),
  winget: (pkg) => ({ cmd: "winget", args: ["install", "--accept-package-agreements", "--accept-source-agreements", "-e", "--id", pkg] }),
  choco: (pkg) => ({ cmd: "choco", args: ["install", pkg, "-y"] }),
};

const MANAGER_CHECK_ARGS = {
  npm: (pkg) => ({ cmd: "npm", args: ["list", "-g", pkg.split("@")[0], "--depth=0"] }),
  pip: (pkg) => ({ cmd: "pip", args: ["show", pkg] }),
  winget: (pkg) => ({ cmd: "winget", args: ["list", "--id", pkg] }),
  choco: (pkg) => ({ cmd: "choco", args: ["list", "--local-only", pkg] }),
};

const BLOCKED_PACKAGES = [
  /^(sudo|su|doas)$/i,
  /^(rm|del|format|mkfs|dd|shutdown|reboot)$/i,
];

function isBlockedPackage(name) {
  return BLOCKED_PACKAGES.some((p) => p.test(name));
}

function sanitizeName(name, manager) {
  // Base: alphanumeric, dots, hyphens, underscores, @
  // Slashes only allowed for scoped npm packages (@scope/pkg) and winget IDs (Publisher.Package)
  if (manager === "npm") return /^(@[a-z0-9._-]+\/)?[a-z0-9._-]+$/i.test(name);
  if (manager === "winget") return /^[a-z0-9._-]+$/i.test(name);
  return /^[a-z0-9._-]+$/i.test(name);
}

export const installToolTool = {
  definition: {
    name: "install_tool",
    description:
      "Install a system tool or global package needed to complete a task. Supports npm (global), pip, winget, and choco package managers. Use this when a task requires a CLI tool that isn't currently installed (e.g., pandoc, imagemagick, ffmpeg). Checks if already installed first.",
    parameters: {
      type: "object",
      properties: {
        package: {
          type: "string",
          description: "Package/tool name (e.g., 'pandoc', 'ffmpeg', 'imagemagick')",
        },
        manager: {
          type: "string",
          enum: ALLOWED_MANAGERS,
          description: "Package manager to use: npm (global), pip, winget, or choco",
        },
        reason: {
          type: "string",
          description: "Brief reason why this tool is needed for the current task",
        },
      },
      required: ["package", "manager", "reason"],
    },
  },

  safetyLevel: SafetyLevel.HIGH,

  validate(args) {
    if (!args.package) return { ok: false, error: "package is required" };
    if (!args.manager) return { ok: false, error: "manager is required" };
    if (!args.reason) return { ok: false, error: "reason is required" };
    if (!ALLOWED_MANAGERS.includes(args.manager)) {
      return { ok: false, error: `Invalid manager: ${args.manager}. Use: ${ALLOWED_MANAGERS.join(", ")}` };
    }
    if (!sanitizeName(args.package, args.manager)) {
      return { ok: false, error: `Invalid package name: ${args.package}` };
    }
    if (isBlockedPackage(args.package)) {
      return { ok: false, error: `Blocked package: ${args.package}` };
    }
    return { ok: true };
  },

  async execute(args) {
    const { package: pkg, manager } = args;

    // Check if already installed
    const check = MANAGER_CHECK_ARGS[manager](pkg);
    try {
      const result = spawnSync(check.cmd, check.args, {
        timeout: 30000,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      if (result.status === 0 && result.stdout && !result.stdout.includes("No installed package")) {
        return `Already installed: ${pkg}\n${result.stdout.trim()}`;
      }
    } catch {
      // Not installed — proceed
    }

    // Install
    const install = MANAGER_INSTALL_ARGS[manager](pkg);
    try {
      const result = spawnSync(install.cmd, install.args, {
        timeout: 300000, // 5 min for large installs
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
        stdio: ["pipe", "pipe", "pipe"],
      });

      if (result.status !== 0) {
        const errOut = (result.stderr || result.stdout || "Unknown error").slice(0, 10000);
        return `Error installing ${pkg} via ${manager}:\n${errOut}`;
      }

      let output = result.stdout || "(no output)";
      if (output.length > 30000) {
        output = output.slice(0, 30000) + "\n... [truncated]";
      }
      return `Installed ${pkg} via ${manager}\n${output}`;
    } catch (err) {
      return `Error installing ${pkg} via ${manager}:\n${err.message.slice(0, 10000)}`;
    }
  },

  formatConfirmation(args) {
    return `Install tool "${args.package}" via ${args.manager}? Reason: ${args.reason}`;
  },
};
