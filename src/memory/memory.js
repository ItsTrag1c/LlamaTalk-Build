import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "fs";
import { join, basename, extname } from "path";
import { getMemoryDir, encryptValue, decryptValue, isEncryptedPayload } from "../config.js";
import { buildInstructionsBlock } from "./instructions.js";

const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "can", "shall", "to", "of", "in", "for",
  "on", "with", "at", "by", "from", "as", "into", "through", "during",
  "before", "after", "above", "below", "between", "and", "but", "or",
  "not", "no", "all", "each", "every", "both", "few", "more", "most",
  "other", "some", "such", "than", "too", "very", "just", "about",
  "if", "then", "so", "because", "while", "although", "this", "that",
  "these", "those", "it", "its", "my", "your", "our", "their", "his",
  "her", "i", "me", "we", "you", "he", "she", "they", "them", "what",
  "which", "who", "how", "when", "where", "why", "please", "help",
  "want", "need", "make", "get", "use", "let", "also",
]);

export class MemoryManager {
  constructor(config, encKey = null) {
    this.globalDir = getMemoryDir();
    this.encKey = encKey;
    this._cache = new Map();
    this._cacheTTL = 5_000;
    this._instructionsCache = null;
    this._instructionsCacheRoot = null;
    this.ensureDir();
  }

  /** Read a file, decrypting if needed. Cached with TTL. */
  _read(path) {
    const now = Date.now();
    const cached = this._cache.get(path);
    if (cached && (now - cached.ts) < this._cacheTTL) return cached.content;

    if (!existsSync(path)) { this._cache.set(path, { content: null, ts: now }); return null; }
    try {
      const raw = readFileSync(path, "utf8");
      let content = raw;
      if (this.encKey) {
        try {
          const parsed = JSON.parse(raw);
          if (isEncryptedPayload(parsed)) content = decryptValue(parsed, this.encKey);
        } catch { /* not encrypted JSON, return raw */ }
      }
      this._cache.set(path, { content, ts: now });
      return content;
    } catch { this._cache.set(path, { content: null, ts: now }); return null; }
  }

  /** Write a file, encrypting if key is available. Invalidates cache. */
  _write(path, content) {
    if (this.encKey) {
      const payload = encryptValue(content, this.encKey);
      writeFileSync(path, JSON.stringify(payload), "utf8");
    } else {
      writeFileSync(path, content, "utf8");
    }
    this._cache.set(path, { content, ts: Date.now() });
  }

  ensureDir() {
    if (!existsSync(this.globalDir)) {
      mkdirSync(this.globalDir, { recursive: true });
    }
    const memFile = join(this.globalDir, "MEMORY.md");
    if (!existsSync(memFile)) {
      writeFileSync(memFile, "# Memory\n\n## Preferences\n(The agent will save your preferences here as it learns them.)\n\n## Projects\n(Project-specific notes will be saved here.)\n", "utf8");
    }
  }

  /** Load the global MEMORY.md file */
  loadGlobal() {
    return this._read(join(this.globalDir, "MEMORY.md"));
  }

  /** Load project-local .llamabuild.md */
  loadProject(projectRoot) {
    return this._read(join(projectRoot, ".llamabuild.md"));
  }

  /** List all topic memory files (excluding MEMORY.md) */
  listTopics() {
    try {
      return readdirSync(this.globalDir)
        .filter((f) => f.endsWith(".md") && f !== "MEMORY.md")
        .map((f) => f.replace(/\.md$/, ""));
    } catch {
      return [];
    }
  }

  /** Load a specific topic memory */
  loadTopic(topicName) {
    return this._read(join(this.globalDir, `${topicName}.md`));
  }

  /** Find relevant topic memories by keyword matching */
  findRelevant(userMessage) {
    const keywords = this.extractKeywords(userMessage);
    if (keywords.length === 0) return [];

    const topics = this.listTopics();
    const scored = [];

    for (const topic of topics) {
      let score = 0;
      const topicLower = topic.toLowerCase();
      for (const kw of keywords) {
        if (topicLower.includes(kw)) score += 3;
      }
      const content = this.loadTopic(topic);
      if (content) {
        const header = content.split("\n").slice(0, 10).join(" ").toLowerCase();
        for (const kw of keywords) {
          if (header.includes(kw)) score += 1;
        }
      }
      if (score > 0) scored.push({ topic, score, content });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 3).map((s) => ({ topic: s.topic, content: s.content }));
  }

  /** Extract keywords from a message */
  extractKeywords(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w));
  }

  /** Save global memory */
  saveGlobal(content) {
    this.ensureDir();
    this._write(join(this.globalDir, "MEMORY.md"), content);
  }

  /** Save a topic memory */
  saveTopic(topicName, content) {
    this.ensureDir();
    this._write(join(this.globalDir, `${topicName}.md`), content);
  }

  // --- Lessons (self-learning) ---

  static LESSON_CATEGORIES = {
    about_you: "About You",
    patterns: "Patterns",
    mistakes: "Mistakes",
    solutions: "Solutions",
  };

  static LESSON_MAX = 50;

  /** Append a dated lesson to lessons.md under the given category.
   *  Categories: "about_you", "patterns", "mistakes", "solutions".
   *  Trims to 50 per category (oldest first). */
  appendLesson(category, lesson) {
    const heading = MemoryManager.LESSON_CATEGORIES[category];
    if (!heading) return;

    const lessonsFile = join(this.globalDir, "lessons.md");
    const dateStr = new Date().toISOString().split("T")[0];
    const entry = `- [${dateStr}] ${lesson.trim()}`;

    let content = this._read(lessonsFile);
    if (!content) {
      // Bootstrap the file with all four headings
      const sections = Object.values(MemoryManager.LESSON_CATEGORIES)
        .map((h) => `## ${h}\n`)
        .join("\n");
      content = `# Lessons Learned\n\n${sections}`;
    }

    // Find the target heading and the next heading (or EOF)
    const headingLine = `## ${heading}`;
    const headIdx = content.indexOf(headingLine);
    if (headIdx === -1) {
      // Heading missing — append it
      content += `\n${headingLine}\n${entry}\n`;
    } else {
      // Find end of this section (next ## or EOF)
      const afterHeading = headIdx + headingLine.length;
      const nextHeading = content.indexOf("\n## ", afterHeading);
      const sectionEnd = nextHeading === -1 ? content.length : nextHeading;
      const sectionBody = content.slice(afterHeading, sectionEnd);

      // Parse existing entries, check for duplicates
      const existing = sectionBody.split("\n").filter((l) => l.startsWith("- "));
      const lessonLower = lesson.trim().toLowerCase();
      // Skip if a very similar lesson already exists (substring match on the content after date)
      const isDuplicate = existing.some((e) => {
        const afterDate = e.replace(/^- \[\d{4}-\d{2}-\d{2}\]\s*/, "").toLowerCase();
        return afterDate === lessonLower || lessonLower.includes(afterDate) || afterDate.includes(lessonLower);
      });
      if (isDuplicate) return;

      existing.push(entry);
      // Trim to max per category (oldest first)
      const trimmed = existing.slice(-MemoryManager.LESSON_MAX);
      const newSection = `${headingLine}\n${trimmed.join("\n")}\n`;
      content = content.slice(0, headIdx) + newSection + content.slice(sectionEnd);
    }

    this._write(lessonsFile, content);
  }

  /** Load the most recent lessons for system prompt injection.
   *  "About You" always loaded in full; technical categories load last N. */
  _loadLessons(count = 15) {
    const lessonsFile = join(this.globalDir, "lessons.md");
    const content = this._read(lessonsFile);
    if (!content) return null;

    const sections = [];
    for (const [key, heading] of Object.entries(MemoryManager.LESSON_CATEGORIES)) {
      const headingLine = `## ${heading}`;
      const headIdx = content.indexOf(headingLine);
      if (headIdx === -1) continue;

      const afterHeading = headIdx + headingLine.length;
      const nextHeading = content.indexOf("\n## ", afterHeading);
      const sectionEnd = nextHeading === -1 ? content.length : nextHeading;
      const entries = content.slice(afterHeading, sectionEnd).split("\n").filter((l) => l.startsWith("- "));
      if (entries.length === 0) continue;

      // "About You" is always loaded in full (high-value personal context)
      const selected = key === "about_you" ? entries : entries.slice(-count);
      sections.push(`### ${heading}\n${selected.join("\n")}`);
    }

    return sections.length > 0 ? sections.join("\n\n") : null;
  }

  /** Append a one-line session summary to sessions.md in memory dir. */
  appendSessionSummary(sessionId, summary, date = new Date()) {
    const sessFile = join(this.globalDir, "sessions.md");
    const dateStr = date.toISOString().split("T")[0];
    const entry = `- ${dateStr} | ${summary}`;

    let content = "";
    if (existsSync(sessFile)) {
      try { content = readFileSync(sessFile, "utf8"); } catch { /* */ }
    }

    if (!content.includes("## Recent Sessions")) {
      content = "# Session History\n\n## Recent Sessions\n";
    }

    // Parse existing entries, append new one, trim to last 30
    const lines = content.split("\n");
    const headerIdx = lines.findIndex((l) => l.startsWith("## Recent Sessions"));
    const entries = lines.slice(headerIdx + 1).filter((l) => l.startsWith("- "));
    entries.push(entry);
    const trimmed = entries.slice(-30);

    const newContent = `# Session History\n\n## Recent Sessions\n${trimmed.join("\n")}\n`;
    try { writeFileSync(sessFile, newContent, "utf8"); } catch { /* */ }
    this._cache.delete(sessFile);
  }

  /** Load the last N session summaries for system prompt injection. */
  _loadSessionSummaries(count = 15) {
    const sessFile = join(this.globalDir, "sessions.md");
    if (!existsSync(sessFile)) return null;
    try {
      const content = readFileSync(sessFile, "utf8");
      const entries = content.split("\n").filter((l) => l.startsWith("- "));
      if (entries.length === 0) return null;
      return entries.slice(-count).join("\n");
    } catch { return null; }
  }

  /**
   * Build the full memory block for system prompt injection.
   * Now includes agent instructions (OpenCode-style).
   */
  buildMemoryBlock(userMessage, projectRoot) {
    const sections = [];

    // Agent instructions (AGENTS.md, .llamabuild/agent/*.md)
    const instructions = this._getInstructions(projectRoot);
    if (instructions) {
      sections.push(instructions);
    }

    // Global memory
    const global = this.loadGlobal();
    if (global) {
      sections.push(`## Global Memory\n${global}`);
    }

    // Project memory
    const project = this.loadProject(projectRoot);
    if (project) {
      sections.push(`## Project Memory\n${project}`);
    }

    // Relevant topic memories
    const relevant = this.findRelevant(userMessage);
    if (relevant.length > 0) {
      const topicBlock = relevant.map((r) => `### ${r.topic}\n${r.content}`).join("\n\n");
      sections.push(`## Relevant Context\n${topicBlock}`);
    }

    // Lessons learned (self-learning) — "About You" first for personalization
    const lessons = this._loadLessons();
    if (lessons) {
      sections.push(`## Lessons Learned\n${lessons}`);
    }

    // Recent session history
    const sessionSummaries = this._loadSessionSummaries();
    if (sessionSummaries) {
      sections.push(`## Recent Session History\n${sessionSummaries}`);
    }

    if (sections.length === 0) return "";
    return `# Memory & Instructions\n\n${sections.join("\n\n")}`;
  }

  /** Get cached instructions block */
  _getInstructions(projectRoot) {
    if (this._instructionsCacheRoot === projectRoot && this._instructionsCache !== null) {
      return this._instructionsCache;
    }
    const block = buildInstructionsBlock(projectRoot);
    this._instructionsCache = block || null;
    this._instructionsCacheRoot = projectRoot;
    return this._instructionsCache;
  }
}
