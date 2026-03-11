export class ToolRegistry {
  constructor() {
    this.tools = new Map();
  }

  register(tool) {
    if (!tool.definition?.name) {
      throw new Error("Tool must have a definition.name");
    }
    this.tools.set(tool.definition.name, tool);
  }

  get(name) {
    return this.tools.get(name);
  }

  getAll() {
    return [...this.tools.values()];
  }

  getDefinitions() {
    return this.getAll().map((t) => t.definition);
  }

  list() {
    return [...this.tools.keys()];
  }
}

export function createDefaultRegistry() {
  // Lazy imports to avoid circular deps
  const registry = new ToolRegistry();

  // Tools are registered in agent.js after all imports are resolved
  return registry;
}
