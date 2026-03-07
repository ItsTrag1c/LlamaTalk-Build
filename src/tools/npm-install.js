import { spawnSync } from "child_process";
import { SafetyLevel } from "./base.js";
import { validatePackageName } from "../safety.js";

export const npmInstallTool = {
  definition: {
    name: "npm_install",
    description: "Install an npm package. Verifies the package exists on npmjs.org before installing.",
    parameters: {
      type: "object",
      properties: {
        package: { type: "string", description: "Package name (e.g., 'lodash', 'express@4')" },
        dev: { type: "boolean", description: "Install as devDependency" },
      },
      required: ["package"],
    },
  },

  safetyLevel: SafetyLevel.MODERATE,

  validate(args) {
    if (!args.package) return { ok: false, error: "package is required" };
    const name = args.package.split("@")[0] || args.package;
    if (!validatePackageName(name)) {
      return { ok: false, error: `Invalid package name: ${args.package}` };
    }
    return { ok: true };
  },

  async execute(args, context) {
    const pkgName = args.package.split("@")[0] || args.package;

    // Verify package exists on npm registry
    try {
      const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkgName)}`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        return `Package not found on npmjs.org: ${pkgName}`;
      }
      const data = await res.json();
      const latestVersion = data["dist-tags"]?.latest || "unknown";
      const description = data.description || "No description";

      // Now install — uses argument array to prevent shell injection via package names
      const npmArgs = ["install", args.package];
      if (args.dev) npmArgs.push("--save-dev");
      const result = spawnSync("npm", npmArgs, {
        cwd: context.projectRoot,
        timeout: 120000,
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
        shell: true,
      });
      if (result.status !== 0) throw new Error(result.stderr || "npm install failed");
      const output = result.stdout;

      return `Installed ${pkgName}@${latestVersion}: ${description}\n${output}`;
    } catch (err) {
      return `Error installing package: ${err.message}`;
    }
  },

  formatConfirmation(args) {
    return `Install npm package: ${args.package}${args.dev ? " (dev)" : ""}?`;
  },
};
