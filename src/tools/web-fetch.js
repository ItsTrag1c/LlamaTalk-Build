import { SafetyLevel } from "./base.js";
import { validateServerUrl } from "../providers/stream.js";

export const webFetchTool = {
  definition: {
    name: "web_fetch",
    description: "Fetch the content of a URL and return it as text. HTML pages are converted to readable text by stripping tags.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL to fetch (http or https)" },
      },
      required: ["url"],
    },
  },

  safetyLevel: SafetyLevel.LOW,

  validate(args) {
    if (!args.url) return { ok: false, error: "url is required" };
    try {
      const parsed = new URL(args.url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { ok: false, error: "URL must use http or https" };
      }
      const h = parsed.hostname;
      if (/^(169\.254\.|0\.0\.0\.0$|\[::1?\]$|::1?$)/i.test(h)) {
        return { ok: false, error: "Link-local, null-bind, and loopback addresses are not permitted" };
      }
      // HTTPS required except for localhost / 127.x.x.x
      if (parsed.protocol === "http:" && h !== "localhost" && !h.startsWith("127.")) {
        return { ok: false, error: "HTTP is only allowed for localhost. Use HTTPS for remote URLs." };
      }
    } catch {
      return { ok: false, error: "Invalid URL" };
    }
    return { ok: true };
  },

  async execute(args) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);

      const res = await fetch(args.url, {
        signal: controller.signal,
        headers: { "User-Agent": "Clank-Build/0.1.0" },
      });
      clearTimeout(timer);

      if (!res.ok) {
        return `HTTP ${res.status}: ${res.statusText}`;
      }

      const contentType = res.headers.get("content-type") || "";
      let text = await res.text();

      // Strip HTML tags for HTML content
      if (contentType.includes("html")) {
        text = text
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/\s+/g, " ")
          .trim();
      }

      if (text.length > 30000) {
        text = text.slice(0, 30000) + `\n... [truncated, ${text.length - 30000} more chars]`;
      }

      return `URL: ${args.url}\nStatus: ${res.status}\nContent-Type: ${contentType}\n\n${text}`;
    } catch (err) {
      return `Error fetching URL: ${err.message}`;
    }
  },

  formatConfirmation(args) {
    return `Fetch URL: ${args.url}`;
  },
};
