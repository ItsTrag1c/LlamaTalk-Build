import { resolve, relative, sep } from "path";
import { realpathSync, lstatSync } from "fs";
import { confirm } from "./ui/ui.js";

/**
 * Validate that a file path doesn't escape the project root.
 * Returns { valid: boolean, resolved: string, error?: string }
 */
export function validatePath(inputPath, projectRoot) {
  try {
    const resolved = resolve(projectRoot, inputPath);
    const rel = relative(projectRoot, resolved);

    // Check for path traversal
    if (rel.startsWith("..") || rel.startsWith(`.${sep}..`)) {
      return { valid: false, resolved, error: `Path escapes project root: ${inputPath}` };
    }

    // Check symlinks don't escape
    try {
      const real = realpathSync(resolved);
      const realRel = relative(projectRoot, real);
      if (realRel.startsWith("..")) {
        return { valid: false, resolved, error: `Symlink target escapes project root: ${inputPath}` };
      }
    } catch {
      // File doesn't exist yet — that's fine for write operations
    }

    return { valid: true, resolved };
  } catch (err) {
    return { valid: false, resolved: inputPath, error: err.message };
  }
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
 * agentMode: "accept" (auto-accept based on config), "build" (confirm each step), "plan" (plan first, confirm writes)
 */
export function requireConfirmation(tool, args, config, agentMode = "accept") {
  const level = typeof tool.safetyLevel === "function" ? tool.safetyLevel(args) : tool.safetyLevel;

  if (agentMode === "build") {
    // Build mode: confirm each plan step (moderate and dangerous operations)
    return level === "moderate" || level === "dangerous";
  }

  if (agentMode === "plan") {
    // Plan mode: always confirm moderate and dangerous, ignore session auto-approve
    return level === "moderate" || level === "dangerous";
  }

  // Auto-Accept mode (default)
  if (level === "dangerous") {
    return !config.autoApprove?.dangerous;
  }
  if (level === "moderate") {
    return !config.autoApprove?.moderate;
  }
  return false; // safe
}

/**
 * Prompt user for confirmation. Returns true if approved.
 * "always" option remembers approval for the session (disabled in Build mode).
 */
export async function promptConfirmation(tool, args, config, rl, agentMode) {
  const message = tool.formatConfirmation
    ? tool.formatConfirmation(args)
    : `Allow ${tool.definition.name}?`;

  // Build mode: always prompt individually, no "always" shortcut
  const allowAlways = agentMode !== "build";
  const result = await confirm(message, rl, { allowAlways });

  if (result === "always") {
    // Remember approval for this safety level for the session
    const level = typeof tool.safetyLevel === "function" ? tool.safetyLevel(args) : tool.safetyLevel;
    if (level === "moderate") config.autoApprove.moderate = true;
    if (level === "dangerous") config.autoApprove.dangerous = true;
    return true;
  }

  return !!result;
}

/**
 * Validate a package name (npm/pip) against shell injection.
 */
export function validatePackageName(name) {
  return /^(@[a-z0-9\-~][a-z0-9\-._~]*\/)?[a-z0-9\-~][a-z0-9\-._~]*(@[^@\s]+)?$/i.test(name);
}
