import { useState, useEffect, useCallback, useRef } from "react";
import { TitleBar } from "./components/TitleBar";
import { Sidebar } from "./components/Sidebar";
import { ChatArea } from "./components/ChatArea";
import { InputBar } from "./components/InputBar";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { HomePage } from "./components/HomePage";
import { OnboardingPage } from "./components/OnboardingPage";
import { engine, engineCall, onEngineEvent, onPrompt, resolvePrompt } from "./lib/engine";
import type { Message, ToolCall, Session, AgentMode, MessageUsage } from "./lib/types";

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [mode, setMode] = useState<AgentMode>("build");
  const [model, setModel] = useState("");
  const [config, setConfig] = useState<Record<string, any>>({});
  const [isThinking, setIsThinking] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [pendingToolCalls, setPendingToolCalls] = useState<ToolCall[]>([]);
  const [confirmPrompt, setConfirmPrompt] = useState<{
    id: string;
    actions: string[];
  } | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isLoadingMemory, setIsLoadingMemory] = useState(false);
  const [currentView, setCurrentView] = useState<"onboarding" | "home" | "chat">("home");

  const streamRef = useRef("");
  const turnToolsRef = useRef<ToolCall[]>([]);
  // Fix React StrictMode double-mount: use ref for cleanup so async setup
  // can register listeners that the synchronous cleanup can later remove
  const unlistenersRef = useRef<(() => void)[]>([]);

  // --- Initialize ---
  useEffect(() => {
    const init = async () => {
      try {
        const sessionList = await engine.listSessions();
        setSessions(sessionList || []);
      } catch { /* sidecar may not be ready yet */ }

      try {
        const cfg = await engine.getConfig();
        setModel(cfg.selectedModel || "");
        setConfig(cfg);
        // Show onboarding if not completed and initial setup is done
        if (cfg.onboardingComplete === false && cfg.onboardingDone !== false) {
          setCurrentView("onboarding");
        }
      } catch { /* */ }

      try {
        const models = await engineCall<string[]>("listModels");
        setAvailableModels(models || []);
      } catch { /* */ }
    };

    // Try init with retry — sidecar may need time to start
    const attempt = async (retries: number) => {
      try {
        await init();
      } catch {
        if (retries > 0) {
          setTimeout(() => attempt(retries - 1), 1000);
        }
      }
    };
    const timer = setTimeout(() => attempt(3), 500);
    return () => clearTimeout(timer);
  }, []);

  const refreshModels = useCallback(async () => {
    try {
      const models = await engineCall<string[]>("listModels");
      setAvailableModels(models || []);
    } catch { /* */ }
  }, []);

  // --- Engine event listeners ---
  // Uses a closure variable (not a ref) to prevent StrictMode double-mount
  // from leaving orphaned listeners. Each effect invocation gets its own
  // `active` flag, so stale async register() calls from a previous mount
  // correctly see active=false and clean themselves up.
  useEffect(() => {
    // Clean up any previous listeners
    unlistenersRef.current.forEach((fn) => fn());
    unlistenersRef.current = [];
    let active = true;

    const setup = async () => {
      const register = async (
        event: Parameters<typeof onEngineEvent>[0],
        handler: Parameters<typeof onEngineEvent>[1],
      ) => {
        const unlisten = await onEngineEvent(event, handler);
        if (active) {
          unlistenersRef.current.push(unlisten);
        } else {
          unlisten();
        }
      };

      await register("thinking-start", () => {
        setIsThinking(true);
        setIsStreaming(true);
      });

      await register("thinking-stop", () => {
        setIsThinking(false);
      });

      await register("response-start", () => {
        streamRef.current = "";
        setStreamingContent("");
      });

      await register("token", (data: { content: string }) => {
        streamRef.current += data.content;
        setStreamingContent(streamRef.current);
      });

      await register("tool-start", (data: { id: string; name: string; arguments: Record<string, unknown> }) => {
        const tc: ToolCall = {
          id: data.id,
          name: data.name,
          arguments: data.arguments || {},
          status: "running",
        };
        setPendingToolCalls((prev) => [...prev, tc]);
        turnToolsRef.current = [...turnToolsRef.current, tc];
      });

      await register("tool-result", (data: { id: string; name: string; success: boolean; summary: string }) => {
        const updater = (tc: ToolCall) =>
          tc.id === data.id
            ? { ...tc, status: (data.success ? "success" : "error") as ToolCall["status"], summary: data.summary }
            : tc;
        setPendingToolCalls((prev) => prev.map(updater));
        turnToolsRef.current = turnToolsRef.current.map(updater);
      });

      await register("response-end", () => {
        const content = streamRef.current;
        streamRef.current = "";
        setStreamingContent("");
        setIsStreaming(false);
        setIsThinking(false);

        const tools = turnToolsRef.current;
        turnToolsRef.current = [];
        setPendingToolCalls([]);

        if (content || tools.length > 0) {
          const msg: Message = {
            role: "assistant",
            content,
            toolCalls: tools.length > 0 ? tools : undefined,
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, msg]);
        }
      });

      // usage fires after response-end — patch onto the last assistant message
      await register("usage", (data: MessageUsage) => {
        setMessages((prev) => {
          if (prev.length === 0) return prev;
          const last = prev[prev.length - 1];
          if (last.role !== "assistant") return prev;
          return [...prev.slice(0, -1), { ...last, usage: data }];
        });
      });

      await register("turn-complete", () => {
        setIsStreaming(false);
        setIsThinking(false);
      });

      await register("context-compacting", () => {
        setMessages([]);
        setPendingToolCalls([]);
        turnToolsRef.current = [];
        const compactMsg: Message = {
          role: "assistant",
          content: "Context window compacted. Continuing with compressed history...",
          timestamp: Date.now(),
        };
        setMessages([compactMsg]);
      });

      await register("cancelled", () => {
        const content = streamRef.current;
        const tools = turnToolsRef.current;

        streamRef.current = "";
        turnToolsRef.current = [];

        setIsStreaming(false);
        setIsThinking(false);
        setStreamingContent("");
        setPendingToolCalls([]);

        if (content || tools.length > 0) {
          const msg: Message = {
            role: "assistant",
            content: content || "(cancelled)",
            toolCalls: tools.length > 0 ? tools : undefined,
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, msg]);
        }
      });

      await register("error", (data: { message: string }) => {
        setIsStreaming(false);
        setIsThinking(false);
        streamRef.current = "";
        turnToolsRef.current = [];
        setPendingToolCalls([]);
        const msg: Message = {
          role: "assistant",
          content: `Error: ${data.message}`,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, msg]);
      });

      await register("memory-loading", (data: { status: string }) => {
        setIsLoadingMemory(data.status === "start");
      });

      await register("mode-change", (data: { from: string; to: string }) => {
        setMode(data.to as AgentMode);
      });

      // Prompts use the raw listen API, handle similarly
      const promptUnlisten = await onPrompt((prompt) => {
        if (prompt.event === "confirm-needed") {
          setConfirmPrompt({
            id: prompt.id,
            actions: prompt.data.actions || [],
          });
        }
      });
      if (active) {
        unlistenersRef.current.push(promptUnlisten);
      } else {
        promptUnlisten();
      }
    };

    setup();

    return () => {
      active = false;
      unlistenersRef.current.forEach((fn) => fn());
      unlistenersRef.current = [];
    };
  }, []);

  // --- Actions ---

  const handleSend = useCallback(async (text: string) => {
    const userMsg: Message = { role: "user", content: text, timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setPendingToolCalls([]);
    turnToolsRef.current = [];

    try {
      await engine.sendMessage(text);
    } catch (err: any) {
      setIsStreaming(false);
      setIsThinking(false);
      const errMsg: Message = {
        role: "assistant",
        content: `Error: ${err?.message || err}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errMsg]);
    }
  }, []);

  const handleCancel = useCallback(async () => {
    try { await engine.cancel(); } catch { /* */ }
  }, []);

  const handleNewSession = useCallback(async () => {
    try {
      const result = await engine.createSession();
      setCurrentSessionId(result.id);
      setMessages([]);
      setPendingToolCalls([]);
      setCurrentView("chat");
      const sessionList = await engine.listSessions();
      setSessions(sessionList || []);
    } catch { /* */ }
  }, []);

  const handleSelectSession = useCallback(async (id: string) => {
    try {
      const result = await engine.loadSession(id);
      if (result.ok) {
        setCurrentSessionId(result.id);
        // Engine messages are { role, content } — map to Message type
        const mapped = (result.messages || [])
          .filter((m: any) => m.role === "user" || m.role === "assistant")
          .map((m: any) => ({
            role: m.role,
            content: typeof m.content === "string" ? m.content : "",
            timestamp: m.timestamp || Date.now(),
          }));
        setMessages(mapped);
        setCurrentView("chat");
      }
    } catch { /* */ }
  }, []);

  const handleDeleteSession = useCallback(async (id: string) => {
    try {
      await engine.deleteSession(id);
      if (id === currentSessionId) {
        setCurrentSessionId(null);
        setMessages([]);
        setPendingToolCalls([]);
        turnToolsRef.current = [];
        streamRef.current = "";
        setStreamingContent("");
        setCurrentView("home");
      }
      const sessionList = await engine.listSessions();
      setSessions(sessionList || []);
    } catch { /* */ }
  }, [currentSessionId]);

  const handleRenameSession = useCallback(async (id: string, title: string) => {
    try {
      await engineCall("renameSession", { id, title });
      const sessionList = await engine.listSessions();
      setSessions(sessionList || []);
    } catch { /* */ }
  }, []);

  const handleToggleMode = useCallback(async () => {
    const cycle: AgentMode[] = ["build", "plan", "recall"];
    const newMode = cycle[(cycle.indexOf(mode) + 1) % cycle.length];
    try {
      await engine.setMode(newMode);
      setMode(newMode);
    } catch { /* */ }
  }, [mode]);

  const handleConfirmResolve = useCallback(async (result: boolean | "always") => {
    if (confirmPrompt) {
      await resolvePrompt(confirmPrompt.id, result);
      setConfirmPrompt(null);
    }
  }, [confirmPrompt]);

  const handleSelectModel = useCallback(async (newModel: string) => {
    try {
      await engine.setModel(newModel);
      setModel(newModel);
    } catch { /* */ }
  }, []);

  const handleAction = useCallback(async (action: string, payload?: any) => {
    switch (action) {
      case "clearMessages":
        try {
          await engine.clearMessages();
          setMessages([]);
          setPendingToolCalls([]);
        } catch { /* */ }
        break;
      case "setSetting":
        if (payload?.key && payload?.value !== undefined) {
          setConfig((prev) => {
            const next = { ...prev };
            const parts = payload.key.split(".");
            if (parts.length === 2) {
              // Handle nested keys like "enabledProviders.anthropic"
              next[parts[0]] = { ...(next[parts[0]] || {}), [parts[1]]: payload.value };
            } else {
              next[payload.key] = payload.value;
            }
            return next;
          });
          // Persist to engine config file
          try { await engineCall("saveSetting", { key: payload.key, value: payload.value }); } catch { /* */ }
        }
        break;
      case "undo":
        handleSend("/undo");
        break;
      case "diff":
        handleSend("/diff");
        break;
      case "compact":
        handleSend("/context");
        break;
      case "memory":
        handleSend("/memory");
        break;
      case "instructions":
        handleSend("/instructions");
        break;
    }
  }, [handleSend]);

  const handleNavigateHome = useCallback(() => {
    setCurrentView("home");
  }, []);

  // Onboarding is a full-screen page — no sidebar, no titlebar controls
  if (currentView === "onboarding") {
    return (
      <div className="h-screen flex flex-col">
        <TitleBar />
        <OnboardingPage
          config={config}
          onComplete={() => {
            setConfig((prev) => ({ ...prev, onboardingComplete: true }));
            setCurrentView("home");
          }}
        />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <TitleBar onNavigateHome={handleNavigateHome} showHomeButton={currentView === "chat"} />

      <div className="flex flex-1 min-h-0">
        <Sidebar
          sessions={sessions}
          currentSessionId={currentSessionId}
          model={model}
          config={config}
          availableModels={availableModels}
          onNewSession={handleNewSession}
          onSelectSession={handleSelectSession}
          onDeleteSession={handleDeleteSession}
          onRenameSession={handleRenameSession}
          onSelectModel={handleSelectModel}
          onRefreshModels={refreshModels}
          onAction={handleAction}
        />

        <div className="flex-1 flex flex-col min-w-0">
          {currentView === "home" ? (
            <HomePage
              sessions={sessions}
              config={config}
              onNewSession={handleNewSession}
              onSelectSession={handleSelectSession}
            />
          ) : (
            <>
              <ChatArea
                messages={messages}
                streamingContent={streamingContent}
                pendingToolCalls={pendingToolCalls}
                isThinking={isThinking}
                isLoadingMemory={isLoadingMemory}
                profileName={config.profileName}
                modelName={model}
              />
              <InputBar
                onSend={handleSend}
                onCancel={handleCancel}
                onToggleMode={handleToggleMode}
                disabled={isStreaming}
                isStreaming={isStreaming}
                mode={mode}
              />
            </>
          )}
        </div>
      </div>

      {confirmPrompt && (
        <ConfirmDialog
          actions={confirmPrompt.actions}
          onResolve={handleConfirmResolve}
        />
      )}
    </div>
  );
}
