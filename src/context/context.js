import { readdirSync, existsSync, statSync } from "fs";
import { join } from "path";

export class ContextManager {
  constructor(provider) {
    this.provider = provider;
  }

  estimateTokens(messages) {
    return this.provider.estimateTokens(messages);
  }

  getLimit() {
    return this.provider.contextWindow();
  }

  isNearLimit(messages, threshold = 0.9) {
    const tokens = this.estimateTokens(messages);
    return tokens >= this.getLimit() * threshold;
  }

  /**
   * Truncate messages to fit within context window.
   * Keeps system prompt + first user message + last N messages.
   */
  truncate(messages, reserveTokens = 4096) {
    const limit = this.getLimit() - reserveTokens;
    let tokens = this.estimateTokens(messages);

    if (tokens <= limit) return messages;

    // Keep first 2 messages (system + first user) and last 4
    const keep = [...messages];
    while (this.estimateTokens(keep) > limit && keep.length > 6) {
      // Remove the 3rd message (oldest non-essential)
      keep.splice(2, 1);
    }

    return keep;
  }

  /** Summarize a tool result that's too large */
  summarizeToolResult(result, maxChars = 30000) {
    if (result.length <= maxChars) return result;
    const half = Math.floor(maxChars / 2);
    return result.slice(0, half) + `\n\n... [${result.length - maxChars} chars truncated] ...\n\n` + result.slice(-half);
  }
}

/**
 * Detect project context from the project root directory.
 * Returns a brief string describing the project.
 */
export function detectProjectContext(projectRoot) {
  const context = [];

  // Check for package.json (Node.js)
  if (existsSync(join(projectRoot, "package.json"))) {
    try {
      const pkg = JSON.parse(require("fs").readFileSync(join(projectRoot, "package.json"), "utf8"));
      context.push(`Node.js project: ${pkg.name || "unnamed"} v${pkg.version || "?"}`);
      if (pkg.dependencies) {
        const deps = Object.keys(pkg.dependencies).slice(0, 10);
        context.push(`Dependencies: ${deps.join(", ")}`);
      }
    } catch { /* skip */ }
  }

  // Check for pyproject.toml or setup.py (Python)
  if (existsSync(join(projectRoot, "pyproject.toml")) || existsSync(join(projectRoot, "setup.py"))) {
    context.push("Python project");
  }

  // Check for Cargo.toml (Rust)
  if (existsSync(join(projectRoot, "Cargo.toml"))) {
    context.push("Rust project");
  }

  // Check for go.mod (Go)
  if (existsSync(join(projectRoot, "go.mod"))) {
    context.push("Go project");
  }

  // Check for .git
  if (existsSync(join(projectRoot, ".git"))) {
    context.push("Git repository");
  }

  // List top-level files/dirs
  try {
    const items = readdirSync(projectRoot)
      .filter((f) => !f.startsWith(".") && f !== "node_modules" && f !== "dist" && f !== "build")
      .slice(0, 20);
    context.push(`Top-level: ${items.join(", ")}`);
  } catch { /* skip */ }

  return context.join("\n") || "Unknown project type";
}
