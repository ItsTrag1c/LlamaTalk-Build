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
      const h = parsed.hostname.replace(/^\[|\]$/g, ""); // strip brackets from IPv6
      // Block link-local, null-bind, loopback (all IPv4 & IPv6 forms)
      if (
        /^169\.254\./i.test(h) ||                         // link-local IPv4
        h === "0.0.0.0" ||                                 // null-bind
        /^(::1?|0{0,4}(:0{0,4}){0,6}:0{0,4}1)$/i.test(h) || // IPv6 loopback (::1, 0:0:0:0:0:0:0:1, etc.)
        /^(::ffff:)?127\./i.test(h) ||                     // IPv4 loopback (127.x.x.x, IPv4-mapped)
        /^(::ffff:)?0\.0\.0\.0$/i.test(h) ||               // IPv4-mapped null-bind
        /^(::ffff:)?169\.254\./i.test(h) ||                 // IPv4-mapped link-local
        /^(fe80|fc00|fd00)::/i.test(h) ||                   // IPv6 link-local & private
        /^10\./i.test(h) ||                                 // RFC1918 10.x
        /^172\.(1[6-9]|2\d|3[01])\./i.test(h) ||           // RFC1918 172.16-31.x
        /^192\.168\./i.test(h)                              // RFC1918 192.168.x
      ) {
        return { ok: false, error: "Private, link-local, and loopback addresses are not permitted" };
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

      // Follow redirects manually to re-validate each hop against SSRF rules
      let currentUrl = args.url;
      let res;
      const MAX_REDIRECTS = 5;
      for (let i = 0; i <= MAX_REDIRECTS; i++) {
        res = await fetch(currentUrl, {
          signal: controller.signal,
          headers: { "User-Agent": "Clank-Build/0.1.0" },
          redirect: "manual",
        });

        if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
          const location = new URL(res.headers.get("location"), currentUrl);
          // Re-validate redirect target against SSRF rules
          const rh = location.hostname.replace(/^\[|\]$/g, "");
          if (
            /^169\.254\./i.test(rh) || rh === "0.0.0.0" ||
            /^(::1?|0{0,4}(:0{0,4}){0,6}:0{0,4}1)$/i.test(rh) ||
            /^(::ffff:)?127\./i.test(rh) || /^(::ffff:)?0\.0\.0\.0$/i.test(rh) ||
            /^(::ffff:)?169\.254\./i.test(rh) || /^(fe80|fc00|fd00)::/i.test(rh) ||
            /^10\./i.test(rh) || /^172\.(1[6-9]|2\d|3[01])\./i.test(rh) || /^192\.168\./i.test(rh)
          ) {
            return "Error: Redirect to a private/loopback address was blocked (SSRF protection).";
          }
          if (location.protocol === "http:" && rh !== "localhost" && !rh.startsWith("127.")) {
            return "Error: Redirect to insecure HTTP URL was blocked. Only HTTPS is allowed for remote URLs.";
          }
          currentUrl = location.href;
          continue;
        }
        break;
      }
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
