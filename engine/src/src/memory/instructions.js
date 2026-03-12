import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { join, dirname, basename, extname, resolve } from "path";
import { homedir } from "os";

/**
 * Instruction discovery system (inspired by OpenCode's AGENTS.md).
 *
 * Discovers and loads instruction files from multiple levels:
 *   1. Global: ~/.clank/agent/*.md (falls back to ~/.clankbuild/agent/, ~/.llamabuild/agent/)
 *   2. Project: .clank/agent/*.md, .clank.md, AGENTS.md (falls back to .clankbuild, .llamabuild variants)
 *   3. Directory walk: AGENTS.md files up the directory tree
 *
 * Instruction files can have YAML-style frontmatter:
 *   ---
 *   description: "Always use when working on docs"
 *   ---
 *   [instruction body]
 */

const INSTRUCTION_FILENAMES = [".clank.md", ".clankbuild.md", "AGENTS.md"];
const LEGACY_INSTRUCTION_FILENAMES = [".llamabuild.md"];

/**
 * Parse frontmatter from a markdown file.
 * Returns { meta: {}, content: string }
 */
function parseFrontmatter(raw) {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!match) return { meta: {}, content: raw.trim() };

  const meta = {};
  for (const line of match[1].split("\n")) {
    const m = line.match(/^(\w+)\s*:\s*"?(.+?)"?\s*$/);
    if (m) meta[m[1]] = m[2];
  }
  return { meta, content: match[2].trim() };
}

/**
 * Discover all instruction files for a project.
 * Returns an array of { source, path, meta, content }
 */
export function discoverInstructions(projectRoot) {
  const instructions = [];
  const seen = new Set();

  // 1. Global instructions: ~/.clank/agent/*.md (fallback: ~/.clankbuild/agent/, ~/.llamabuild/agent/)
  let globalAgentDir = join(homedir(), ".clank", "agent");
  if (!existsSync(globalAgentDir)) {
    const clankBuildDir = join(homedir(), ".clankbuild", "agent");
    if (existsSync(clankBuildDir)) {
      globalAgentDir = clankBuildDir;
    } else {
      const legacyDir = join(homedir(), ".llamabuild", "agent");
      if (existsSync(legacyDir)) globalAgentDir = legacyDir;
    }
  }
  if (existsSync(globalAgentDir)) {
    try {
      for (const f of readdirSync(globalAgentDir)) {
        if (!f.endsWith(".md")) continue;
        const fullPath = join(globalAgentDir, f);
        if (seen.has(fullPath)) continue;
        seen.add(fullPath);
        try {
          const raw = readFileSync(fullPath, "utf8");
          const { meta, content } = parseFrontmatter(raw);
          if (content) {
            instructions.push({
              source: "global",
              path: fullPath,
              name: f.replace(/\.md$/, ""),
              meta,
              content,
            });
          }
        } catch { /* skip unreadable */ }
      }
    } catch { /* dir not readable */ }
  }

  // Global AGENTS.md (new path first, then legacy fallbacks)
  let globalAgentsMd = join(homedir(), ".clank", "AGENTS.md");
  if (!existsSync(globalAgentsMd)) {
    const clankBuildPath = join(homedir(), ".clankbuild", "AGENTS.md");
    if (existsSync(clankBuildPath)) {
      globalAgentsMd = clankBuildPath;
    } else {
      const legacyPath = join(homedir(), ".llamabuild", "AGENTS.md");
      if (existsSync(legacyPath)) globalAgentsMd = legacyPath;
    }
  }
  if (existsSync(globalAgentsMd) && !seen.has(globalAgentsMd)) {
    seen.add(globalAgentsMd);
    try {
      const raw = readFileSync(globalAgentsMd, "utf8");
      const { meta, content } = parseFrontmatter(raw);
      if (content) {
        instructions.push({ source: "global", path: globalAgentsMd, name: "AGENTS", meta, content });
      }
    } catch { /* skip */ }
  }

  // 2. Project-level: .clank/agent/*.md (fallback: .clankbuild/agent/, .llamabuild/agent/)
  let projectAgentDir = join(projectRoot, ".clank", "agent");
  if (!existsSync(projectAgentDir)) {
    const clankBuildDir = join(projectRoot, ".clankbuild", "agent");
    if (existsSync(clankBuildDir)) {
      projectAgentDir = clankBuildDir;
    } else {
      const legacyDir = join(projectRoot, ".llamabuild", "agent");
      if (existsSync(legacyDir)) projectAgentDir = legacyDir;
    }
  }
  if (existsSync(projectAgentDir)) {
    try {
      for (const f of readdirSync(projectAgentDir)) {
        if (!f.endsWith(".md")) continue;
        const fullPath = join(projectAgentDir, f);
        if (seen.has(fullPath)) continue;
        seen.add(fullPath);
        try {
          const raw = readFileSync(fullPath, "utf8");
          const { meta, content } = parseFrontmatter(raw);
          if (content) {
            instructions.push({
              source: "project",
              path: fullPath,
              name: f.replace(/\.md$/, ""),
              meta,
              content,
            });
          }
        } catch { /* skip */ }
      }
    } catch { /* dir not readable */ }
  }

  // 3. Project root instruction files: .clank.md, .clankbuild.md, AGENTS.md (+ legacy .llamabuild.md fallback)
  for (const name of INSTRUCTION_FILENAMES) {
    const fullPath = join(projectRoot, name);
    if (existsSync(fullPath) && !seen.has(fullPath)) {
      seen.add(fullPath);
      try {
        const raw = readFileSync(fullPath, "utf8");
        const { meta, content } = parseFrontmatter(raw);
        if (content) {
          instructions.push({
            source: "project",
            path: fullPath,
            name: name.replace(/\.md$/, ""),
            meta,
            content,
          });
        }
      } catch { /* skip */ }
    }
  }
  // Legacy fallback: check .llamabuild.md if .clankbuild.md wasn't found
  for (const name of LEGACY_INSTRUCTION_FILENAMES) {
    const fullPath = join(projectRoot, name);
    if (existsSync(fullPath) && !seen.has(fullPath)) {
      seen.add(fullPath);
      try {
        const raw = readFileSync(fullPath, "utf8");
        const { meta, content } = parseFrontmatter(raw);
        if (content) {
          instructions.push({
            source: "project",
            path: fullPath,
            name: name.replace(/\.md$/, ""),
            meta,
            content,
          });
        }
      } catch { /* skip */ }
    }
  }

  // 4. Walk up directory tree from project root for AGENTS.md
  let dir = dirname(projectRoot);
  const root = resolve("/");
  while (dir !== root && dir !== dirname(dir)) {
    for (const name of INSTRUCTION_FILENAMES) {
      const fullPath = join(dir, name);
      if (existsSync(fullPath) && !seen.has(fullPath)) {
        seen.add(fullPath);
        try {
          const raw = readFileSync(fullPath, "utf8");
          const { meta, content } = parseFrontmatter(raw);
          if (content) {
            instructions.push({
              source: "parent",
              path: fullPath,
              name: `${basename(dir)}/${name.replace(/\.md$/, "")}`,
              meta,
              content,
            });
          }
        } catch { /* skip */ }
      }
    }
    dir = dirname(dir);
  }

  return instructions;
}

/**
 * Build the instructions block for system prompt injection.
 * Combines all discovered instructions into a single block.
 */
export function buildInstructionsBlock(projectRoot) {
  const instructions = discoverInstructions(projectRoot);
  if (instructions.length === 0) return "";

  const sections = instructions.map((inst) => {
    const sourceTag = inst.source === "global" ? " (global)" : inst.source === "parent" ? " (inherited)" : "";
    const desc = inst.meta.description ? ` — ${inst.meta.description}` : "";
    return `### ${inst.name}${sourceTag}${desc}\n${inst.content}`;
  });

  return `## Agent Instructions\n\n${sections.join("\n\n")}`;
}
