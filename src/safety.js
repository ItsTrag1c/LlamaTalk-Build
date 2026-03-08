import { resolve, relative, sep } from "path";
import { realpathSync, lstatSync } from "fs";
import { confirm } from "./ui/ui.js";
import { getMemoryDir } from "./config.js";

/**
 * Validate that a file path is safe to access.
 * By default, paths outside the project root are blocked.
 * With allowExternal: true, external paths are allowed but flagged.
 * Returns { valid: boolean, resolved: string, external: boolean, trusted: boolean, error?: string }
 */
export function validatePath(inputPath, projectRoot, { allowExternal = false } = {}) {
  try {
    const resolved = resolve(projectRoot, inputPath);
    const rel = relative(projectRoot, resolved);

    const external = rel.startsWith("..") || rel.startsWith(`.${sep}..`);

    if (external && !allowExternal) {
      return { valid: false, resolved, external: true, trusted: false, error: `Path escapes project root: ${inputPath}` };
    }

    // Check symlinks don't escape (only for in-project paths)
    if (!external) {
      try {
        const real = realpathSync(resolved);
        const realRel = relative(projectRoot, real);
        if (realRel.startsWith("..") && !allowExternal) {
          return { valid: false, resolved, external: true, trusted: false, error: `Symlink target escapes project root: ${inputPath}` };
        }
      } catch {
        // File doesn't exist yet — that's fine for write operations
      }
    }

    // Check if path is in a trusted location (e.g., memory dir)
    const trusted = external && isTrustedPath(resolved);

    return { valid: true, resolved, external, trusted };
  } catch (err) {
    return { valid: false, resolved: inputPath, external: false, trusted: false, error: err.message };
  }
}

/**
 * Check if a resolved path is in a trusted location (auto-approved for external access).
 * Currently: the app's own memory directory.
 */
export function isTrustedPath(resolvedPath) {
  const memDir = getMemoryDir();
  const normalizedPath = resolvedPath.replace(/\\/g, "/").toLowerCase();
  const normalizedMem = memDir.replace(/\\/g, "/").toLowerCase();
  return normalizedPath.startsWith(normalizedMem);
}

// Commands that are considered destructive
const DESTRUCTIVE_PATTERNS = [
  /\brm\s+(-rf?|--recursive)\s+[\/\\]/i,
  /\brmdir\s+\/s/i,
  /\bdel\s+\/[sfq]/i,
  /\bformat\s+[a-z]:/i,
  /\bshutdown/i,
  /\breboot/i,
  /\bmkfs\b/i,
  /\bdd\s+if=/i,
  /\b>\s*\/dev\/sda/i,
  /\brm\s+-rf?\s+\//,
  /\bgit\s+push\s+.*--force/i,
  /\bgit\s+reset\s+--hard/i,
  /\bgit\s+clean\s+-[fd]/i,
];

export function isDestructiveCommand(command) {
  return DESTRUCTIVE_PATTERNS.some((p) => p.test(command));
}

/**
 * Check if a tool invocation requires user confirmation.
 * Plan mode enforcement is handled separately in agent.js (write tools are blocked).
 * /trust overrides via config.autoApprove for the session.
 */
export function requireConfirmation(tool, args, config, agentMode = "build") {
  const level = typeof tool.safetyLevel === "function" ? tool.safetyLevel(args) : tool.safetyLevel;

  if (level === "high") {
    return !config.autoApprove?.high;
  }
  if (level === "medium") {
    return !config.autoApprove?.medium;
  }
  return false; // low
}

/**
 * Prompt user for confirmation. Returns true if approved.
 * "always" option remembers approval for this safety level for the session.
 */
export async function promptConfirmation(tool, args, config, rl, agentMode) {
  const message = tool.formatConfirmation
    ? tool.formatConfirmation(args)
    : `Allow ${tool.definition.name}?`;

  const allowAlways = true;
  const result = await confirm(message, rl, { allowAlways });

  if (result === "always") {
    // Remember approval for this safety level for the session
    if (!config.autoApprove) config.autoApprove = {};
    const level = typeof tool.safetyLevel === "function" ? tool.safetyLevel(args) : tool.safetyLevel;
    if (level === "medium") config.autoApprove.medium = true;
    if (level === "high") config.autoApprove.high = true;
    return true;
  }

  return !!result;
}

/**
 * Validate a package name (npm/pip) against shell injection.
 */
export function validatePackageName(name) {
  return /^(@[a-z0-9\-~][a-z0-9\-._~]*\/)?[a-z0-9\-~][a-z0-9\-._~]*(@[a-z0-9._\-+~^<>=*]+)?$/i.test(name);
}
