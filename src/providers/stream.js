import { request as httpRequest } from "http";
import { request as httpsRequest } from "https";

export function validateServerUrl(urlStr) {
  let parsed;
  try {
    parsed = new URL(urlStr);
  } catch {
    throw new Error(`Invalid server URL: ${urlStr}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Server URL must use http or https");
  }
  if (/^169\.254\./i.test(parsed.hostname)) {
    throw new Error("Link-local addresses are not permitted");
  }
}

export function fetchWithTimeout(url, options, timeoutMs, cancelSignal = null) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let cancelListener;
  if (cancelSignal) {
    if (cancelSignal.aborted) {
      controller.abort();
    } else {
      cancelListener = () => controller.abort();
      cancelSignal.addEventListener("abort", cancelListener);
    }
  }

  return fetch(url, { ...options, signal: controller.signal }).finally(() => {
    clearTimeout(timer);
    if (cancelSignal && cancelListener) {
      cancelSignal.removeEventListener("abort", cancelListener);
    }
  });
}

export function streamRequest(url, options, signal = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const reqFn = parsed.protocol === "https:" ? httpsRequest : httpRequest;
    const req = reqFn(url, {
      method: options.method || "GET",
      headers: options.headers || {},
      signal,
    }, (res) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        resolve(res);
      } else {
        let body = "";
        res.on("data", (c) => body += c);
        res.on("end", () => reject(new Error(`HTTP ${res.statusCode}: ${body}`)));
        res.on("error", reject);
      }
    });
    req.on("error", reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

export async function* streamLines(nodeStream) {
  let buf = "";
  for await (const chunk of nodeStream) {
    buf += chunk.toString();
    while (true) {
      const nl = buf.indexOf("\n");
      if (nl === -1) break;
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) yield line;
    }
  }
  if (buf.trim()) yield buf.trim();
}
