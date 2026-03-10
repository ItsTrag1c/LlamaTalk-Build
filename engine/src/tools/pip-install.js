import { spawnSync } from "child_process";
import { SafetyLevel } from "./base.js";
import { validatePackageName } from "../safety.js";

export const pipInstallTool = {
  definition: {
    name: "pip_install",
    description: "Install a Python package. Verifies the package exists on pypi.org before installing.",
    parameters: {
      type: "object",
      properties: {
        package: { type: "string", description: "Package name (e.g., 'requests', 'flask')" },
      },
      required: ["package"],
    },
  },

  safetyLevel: SafetyLevel.MEDIUM,

  validate(args) {
    if (!args.package) return { ok: false, error: "package is required" };
    if (!validatePackageName(args.package)) {
      return { ok: false, error: `Invalid package name: ${args.package}` };
    }
    return { ok: true };
  },

  async execute(args, context) {
    // Verify package exists on PyPI
    try {
      const res = await fetch(`https://pypi.org/pypi/${encodeURIComponent(args.package)}/json`);
      if (!res.ok) {
        return `Package not found on pypi.org: ${args.package}`;
      }
      const data = await res.json();
      const version = data.info?.version || "unknown";
      const summary = data.info?.summary || "No description";

      // Install — uses argument array to prevent shell injection via package names
      const result = spawnSync("pip", ["install", args.package], {
        cwd: context.projectRoot,
        timeout: 120000,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
        shell: true,
      });
      if (result.status !== 0) throw new Error(result.stderr || "pip install failed");
      const output = result.stdout;

      return `Installed ${args.package}==${version}: ${summary}\n${output}`;
    } catch (err) {
      return `Error installing package: ${err.message}`;
    }
  },

  formatConfirmation(args) {
    return `Install pip package: ${args.package}?`;
  },
};
