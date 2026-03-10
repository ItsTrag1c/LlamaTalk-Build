/**
 * llamatalkbuild-engine — Headless agent engine for LlamaTalk Build
 *
 * This package provides the core agent loop, tools, providers, and session
 * management as an EventEmitter-based engine. It contains NO terminal UI,
 * NO readline, NO chalk — just pure logic that emits events.
 *
 * Consumers (CLI shell, Desktop app) listen to events and render their own UI.
 */

// Core engine
export { AgentEngine } from "./agent.js";

// Configuration & persistence
export {
  loadConfig,
  saveConfig,
  saveConfigWithKey,
  getConfigDir,
  getMemoryDir,
  saveConversation,
  loadConversation,
  verifyPin,
  deriveEncKey,
  hashPin,
  generateEncKeySalt,
  decryptApiKeys,
  isFirstRun,
  pinRequired,
  needsPinMigration,
} from "./config.js";

// Sessions
export { SessionManager } from "./sessions.js";
export { SessionLog } from "./session-log.js";
export { SessionTracker } from "./session-tracker.js";

// Providers
export {
  getProviderForModel,
  getProviderName,
  getAllLocalModels,
  getOllamaModels,
  getRunningOllamaModels,
  getOpenAICompatModels,
  detectBackend,
  CLOUD_MODELS,
} from "./providers/router.js";

// Tools
export { ToolRegistry } from "./tools/registry.js";
export { isReadOnlyTool } from "./tools/base.js";
export { delegateAgentTool } from "./tools/delegate-agent.js";

// Safety
export { validatePath, isDestructiveCommand, requireConfirmation, validatePackageName } from "./safety.js";

// Memory
export { MemoryManager } from "./memory/memory.js";
export { TaskManager } from "./memory/tasks.js";
export { discoverInstructions } from "./memory/instructions.js";

// Context
export { ContextManager, detectProjectContext } from "./context/context.js";
