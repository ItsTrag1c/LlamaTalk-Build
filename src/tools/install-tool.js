import { execSync } from "child_process";
import { SafetyLevel } from "./base.js";

const ALLOWED_MANAGERS = ["npm", "pip", "winget", "choco"];

const MANAGER_INSTALL_CMD = {
  npm: (pkg) => `npm install -g ${pkg}`,
  pip: (pkg) => `pip install ${pkg}`,
  winget: (pkg) => `winget install --accept-package-agreements --accept-source-agreements -e --id ${pkg}`,
  choco: (pkg) => `choco install ${pkg} -y`,
};

const MANAGER_CHECK_CMD = {
  npm: (pkg) => `npm list -g ${pkg.split("@")[0]} --depth=0`,
  pip: (pkg) => `pip show ${pkg}`,
  winget: (pkg) => `winget list --id ${pkg}`,
  choco: (pkg) => `choco list --local-only ${pkg}`,
};

const BLOCKED_PACKAGES = [
  /^(sudo|su|doas)$/i,
  /^(rm|del|format|mkfs|dd|shutdown|reboot)$/i,
];

function isBlockedPackage(name) {
  return BLOCKED_PACKAGES.some((p) => p.test(name));
}

function sanitizeName(name) {
  // Allow alphanumeric, dots, hyphens, underscores, slashes (for scoped/winget), @
  return /^[@a-z0-9._\-\/]+$/i.test(name);
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

  safetyLevel: SafetyLevel.DANGEROUS,

  validate(args) {
    if (!args.package) return { ok: false, error: "package is required" };
    if (!args.manager) return { ok: false, error: "manager is required" };
    if (!args.reason) return { ok: false, error: "reason is required" };
    if (!ALLOWED_MANAGERS.includes(args.manager)) {
      return { ok: false, error: `Invalid manager: ${args.manager}. Use: ${ALLOWED_MANAGERS.join(", ")}` };
    }
    if (!sanitizeName(args.package)) {
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
    const checkCmd = MANAGER_CHECK_CMD[manager](pkg);
    try {
      const checkOutput = execSync(checkCmd, {
        timeout: 30000,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
        shell: true,
      });
      if (checkOutput && !checkOutput.includes("No installed package")) {
        return `Already installed: ${pkg}\n${checkOutput.trim()}`;
      }
    } catch {
      // Not installed — proceed
    }

    // Install
    const installCmd = MANAGER_INSTALL_CMD[manager](pkg);
    try {
      const output = execSync(installCmd, {
        timeout: 300000, // 5 min for large installs
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
        stdio: ["pipe", "pipe", "pipe"],
        shell: true,
      });

      let result = output || "(no output)";
      if (result.length > 30000) {
        result = result.slice(0, 30000) + "\n... [truncated]";
      }
      return `Installed ${pkg} via ${manager}\n${result}`;
    } catch (err) {
      let output = "";
      if (err.stdout) output += err.stdout;
      if (err.stderr) output += (output ? "\n" : "") + err.stderr;
      if (!output) output = err.message;
      return `Error installing ${pkg} via ${manager}:\n${output.slice(0, 10000)}`;
    }
  },

  formatConfirmation(args) {
    return `Install tool "${args.package}" via ${args.manager}? Reason: ${args.reason}`;
  },
};
