/**
 * Claude Code OAuth credential reader.
 *
 * Reads the OAuth access token from Claude Code's local credential store
 * (~/.claude/.credentials.json) and provides it for use as an Anthropic API key.
 *
 * The token is refreshed automatically when expired by re-reading the file
 * (Claude Code manages its own token lifecycle).
 *
 * INTERNAL — this module is not documented or exposed in public help.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const CREDENTIALS_PATH = join(homedir(), ".claude", ".credentials.json");

/** Cached credential to avoid re-reading on every call. */
let _cached = null;

/**
 * Read Claude Code's OAuth credentials from disk.
 * Returns null if not found or invalid.
 */
function readCredentials() {
  try {
    if (!existsSync(CREDENTIALS_PATH)) return null;
    const raw = readFileSync(CREDENTIALS_PATH, "utf8");
    const data = JSON.parse(raw);
    const creds = data?.claudeAiOauth;
    if (!creds?.accessToken) return null;
    return creds;
  } catch {
    return null;
  }
}

/**
 * Check if Claude Code is installed and authenticated.
 */
export function isClaudeCodeAvailable() {
  const creds = readCredentials();
  return !!creds?.accessToken;
}

/**
 * Get the Claude Code OAuth access token.
 * Re-reads from disk if expired or not cached.
 * Returns { token, expiresAt, subscriptionType } or null.
 */
export function getClaudeCodeToken() {
  // Check cache first
  if (_cached && _cached.expiresAt > Date.now() + 60000) {
    return _cached;
  }

  const creds = readCredentials();
  if (!creds) return null;

  _cached = {
    token: creds.accessToken,
    refreshToken: creds.refreshToken || null,
    expiresAt: creds.expiresAt || 0,
    subscriptionType: creds.subscriptionType || "unknown",
    rateLimitTier: creds.rateLimitTier || "unknown",
  };

  // Check if expired
  if (_cached.expiresAt && _cached.expiresAt < Date.now()) {
    // Token expired — Claude Code should refresh it on its next run.
    // We still return it; the API will reject it and the user can re-auth.
    _cached._expired = true;
  }

  return _cached;
}

/**
 * Get a status summary of Claude Code auth.
 */
export function getClaudeCodeStatus() {
  const creds = readCredentials();
  if (!creds) {
    return { available: false, reason: "Claude Code credentials not found" };
  }
  if (!creds.accessToken) {
    return { available: false, reason: "No access token in credentials" };
  }

  const expired = creds.expiresAt && creds.expiresAt < Date.now();
  const expiresIn = creds.expiresAt ? Math.max(0, creds.expiresAt - Date.now()) : null;

  return {
    available: true,
    expired,
    expiresIn,
    subscriptionType: creds.subscriptionType || "unknown",
    rateLimitTier: creds.rateLimitTier || "unknown",
    scopes: creds.scopes || [],
  };
}

/**
 * Clear the cached token (forces re-read on next call).
 */
export function clearClaudeCodeCache() {
  _cached = null;
}
