/**
 * Engine bridge — communicates with the sidecar via Tauri commands/events.
 * Provides a React-friendly API for the frontend.
 *
 * Key design note: the sidecar can respond to RPC calls faster than the JS
 * event loop can register the pending promise. To handle this, we buffer
 * "early" results/errors that arrive before their promise is created, and
 * check for them when the promise is about to be registered.
 */
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

// --- RPC call helper ---

const pendingResults = new Map<number, { resolve: (data: any) => void; reject: (err: string) => void }>();
// Buffer for results that arrive before the promise is registered
const earlyResults = new Map<number, any>();
const earlyErrors = new Map<number, string>();
let resultListenerSetup = false;

async function setupResultListener() {
  if (resultListenerSetup) return;
  resultListenerSetup = true;
  await listen<{ id: number; data: any }>("engine:result", (event) => {
    const pending = pendingResults.get(event.payload.id);
    if (pending) {
      pendingResults.delete(event.payload.id);
      pending.resolve(event.payload.data);
    } else {
      // Result arrived before promise was registered — buffer it
      earlyResults.set(event.payload.id, event.payload.data);
    }
  });
  await listen<{ id: number; message: string }>("engine:error", (event) => {
    const pending = pendingResults.get(event.payload.id);
    if (pending) {
      pendingResults.delete(event.payload.id);
      pending.reject(event.payload.message);
    } else {
      earlyErrors.set(event.payload.id, event.payload.message);
    }
  });
}

export async function engineCall<T = any>(method: string, params: Record<string, unknown> = {}): Promise<T> {
  await setupResultListener();
  const id: number = await invoke("engine_call", { method, params });

  // Check if the result already arrived while we were awaiting invoke
  if (earlyResults.has(id)) {
    const data = earlyResults.get(id);
    earlyResults.delete(id);
    return data as T;
  }
  if (earlyErrors.has(id)) {
    const msg = earlyErrors.get(id)!;
    earlyErrors.delete(id);
    throw new Error(msg);
  }

  return new Promise((resolve, reject) => {
    pendingResults.set(id, { resolve, reject });
    // Timeout after 5 minutes (agent loops can be long)
    setTimeout(() => {
      if (pendingResults.has(id)) {
        pendingResults.delete(id);
        reject("Request timed out");
      }
    }, 300_000);
  });
}

// --- Resolve a prompt (confirmation, etc.) ---

export async function resolvePrompt(promptId: string, data: any): Promise<void> {
  await invoke("engine_resolve", { promptId, data });
}

// --- Event listeners ---

export type EngineEventName =
  | "thinking-start" | "thinking-stop"
  | "response-start" | "response-end"
  | "token" | "tool-start" | "tool-result"
  | "context-compacting" | "file-changed"
  | "turn-complete" | "mode-change"
  | "cancelled" | "error" | "usage" | "ready";

export async function onEngineEvent(event: EngineEventName, handler: (data: any) => void): Promise<UnlistenFn> {
  return listen(`engine:${event}`, (e) => handler(e.payload));
}

export async function onPrompt(handler: (prompt: { id: string; event: string; data: any }) => void): Promise<UnlistenFn> {
  return listen("engine:prompt", (e) => handler(e.payload as any));
}

// --- High-level API ---

export const engine = {
  ping: () => engineCall("ping"),
  getConfig: () => engineCall("getConfig"),
  createSession: (projectRoot?: string) => engineCall("createSession", { projectRoot }),
  loadSession: (sessionId?: string) => engineCall("loadSession", { sessionId }),
  listSessions: () => engineCall("listSessions"),
  deleteSession: (id: string) => engineCall("deleteSession", { id }),
  sendMessage: (text: string) => engineCall("sendMessage", { text }),
  cancel: () => engineCall("cancel"),
  getMode: () => engineCall<{ mode: string }>("getMode"),
  setMode: (mode: string) => engineCall("setMode", { mode }),
  getModel: () => engineCall<{ model: string }>("getModel"),
  setModel: (model: string) => engineCall("setModel", { model }),
  clearMessages: () => engineCall("clearMessages"),
  getMessages: () => engineCall("getMessages"),
};
