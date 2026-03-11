import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { getConversationDir } from "./config.js";

const MAX_SESSIONS = 50;

function getIndexPath() {
  const dir = getConversationDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, "sessions.json");
}

function loadIndex() {
  const path = getIndexPath();
  if (!existsSync(path)) return [];
  try {
    const raw = readFileSync(path, "utf8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveIndex(sessions) {
  writeFileSync(getIndexPath(), JSON.stringify(sessions, null, 2), "utf8");
}

/**
 * Generate a short title from the first user message.
 */
function generateTitle(message) {
  const clean = message.replace(/[\r\n]+/g, " ").trim();
  if (clean.length <= 60) return clean;
  // Cut at word boundary
  const cut = clean.slice(0, 57);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 30 ? cut.slice(0, lastSpace) : cut) + "...";
}

export class SessionManager {
  constructor() {
    this.sessions = loadIndex();
  }

  /** List all sessions, most recent first */
  list() {
    return [...this.sessions].sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed));
  }

  /** Create a new session, returns its ID */
  create(projectRoot, title) {
    const id = randomUUID();
    const session = {
      id,
      title: title || "New session",
      projectRoot,
      created: new Date().toISOString(),
      lastUsed: new Date().toISOString(),
    };
    this.sessions.push(session);
    this._prune();
    saveIndex(this.sessions);
    return session;
  }

  /** Update session title and lastUsed */
  touch(id, title) {
    const session = this.sessions.find((s) => s.id === id);
    if (session) {
      if (title) session.title = title;
      session.lastUsed = new Date().toISOString();
      saveIndex(this.sessions);
    }
  }

  /** Set title from first message if still default */
  autoTitle(id, firstMessage) {
    const session = this.sessions.find((s) => s.id === id);
    if (session && session.title === "New session") {
      session.title = generateTitle(firstMessage);
      saveIndex(this.sessions);
    }
  }

  /** Get a session by ID */
  get(id) {
    return this.sessions.find((s) => s.id === id) || null;
  }

  /** Get the most recent session */
  getLatest() {
    if (this.sessions.length === 0) return null;
    return [...this.sessions].sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed))[0];
  }

  /** Delete a session and its conversation file */
  delete(id) {
    this.sessions = this.sessions.filter((s) => s.id !== id);
    saveIndex(this.sessions);
    const convPath = join(getConversationDir(), `${id}.json`);
    try { if (existsSync(convPath)) unlinkSync(convPath); } catch { /* non-fatal */ }
  }

  /** Delete all sessions and their conversation files */
  deleteAll() {
    const convDir = getConversationDir();
    for (const s of this.sessions) {
      const convPath = join(convDir, `${s.id}.json`);
      try { if (existsSync(convPath)) unlinkSync(convPath); } catch { /* non-fatal */ }
    }
    this.sessions = [];
    saveIndex(this.sessions);
  }

  /** Remove oldest sessions beyond MAX_SESSIONS */
  _prune() {
    if (this.sessions.length <= MAX_SESSIONS) return;
    const sorted = [...this.sessions].sort((a, b) => new Date(a.lastUsed) - new Date(b.lastUsed));
    while (this.sessions.length > MAX_SESSIONS) {
      const oldest = sorted.shift();
      this.delete(oldest.id);
    }
  }
}
