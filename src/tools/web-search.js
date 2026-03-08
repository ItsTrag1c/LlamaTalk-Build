import { SafetyLevel } from "./base.js";

export const webSearchTool = {
  definition: {
    name: "web_search",
    description: "Search the web for information using DuckDuckGo. Returns search results with titles, URLs, and snippets.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        max_results: { type: "number", description: "Number of results (default: 5, max: 10)" },
      },
      required: ["query"],
    },
  },

  safetyLevel: SafetyLevel.LOW,

  validate(args) {
    if (!args.query) return { ok: false, error: "query is required" };
    return { ok: true };
  },

  async execute(args) {
    const maxResults = Math.min(args.max_results || 5, 10);

    try {
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(args.query)}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "LlamaTalk-Build/0.1.0",
          "Accept": "text/html",
        },
      });
      clearTimeout(timer);

      if (!res.ok) {
        return `Search failed: HTTP ${res.status}`;
      }

      const html = await res.text();

      // Parse results from DuckDuckGo HTML
      const results = [];
      const resultRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
      const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

      let match;
      while ((match = resultRegex.exec(html)) !== null && results.length < maxResults) {
        const rawUrl = match[1];
        const title = match[2].replace(/<[^>]+>/g, "").trim();

        // Extract actual URL from DuckDuckGo redirect
        let actualUrl = rawUrl;
        try {
          const parsed = new URL(rawUrl, "https://duckduckgo.com");
          actualUrl = parsed.searchParams.get("uddg") || rawUrl;
        } catch { /* use raw */ }

        results.push({ title, url: actualUrl, snippet: "" });
      }

      // Try to get snippets
      let snippetIdx = 0;
      while ((match = snippetRegex.exec(html)) !== null && snippetIdx < results.length) {
        results[snippetIdx].snippet = match[1].replace(/<[^>]+>/g, "").trim();
        snippetIdx++;
      }

      if (results.length === 0) {
        return `No results found for: ${args.query}`;
      }

      return results.map((r, i) =>
        `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`
      ).join("\n\n");
    } catch (err) {
      return `Search error: ${err.message}`;
    }
  },

  formatConfirmation(args) {
    return `Search for: ${args.query}`;
  },
};
