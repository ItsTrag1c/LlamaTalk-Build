import { readFileSync, existsSync, statSync } from "fs";
import { extname } from "path";
import { spawnSync } from "child_process";
import { SafetyLevel } from "./base.js";
import { validatePath } from "../safety.js";

const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".ico", ".webp", ".svg",
  ".woff", ".woff2", ".ttf", ".eot", ".otf",
  ".mp3", ".mp4", ".avi", ".mov", ".mkv", ".wav", ".flac",
  ".zip", ".tar", ".gz", ".7z", ".rar", ".bz2",
  ".exe", ".dll", ".so", ".dylib", ".bin",
  ".db", ".sqlite", ".lock",
]);

function isBinaryFile(filePath) {
  const ext = extname(filePath).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) return true;
  // Check first 512 bytes for null bytes
  try {
    const buf = readFileSync(filePath, { encoding: null, flag: "r" });
    const sample = buf.subarray(0, Math.min(512, buf.length));
    for (let i = 0; i < sample.length; i++) {
      if (sample[i] === 0) return true;
    }
  } catch { /* fallback to text */ }
  return false;
}

function extractPdfText(filePath) {
  // Try pdftotext (poppler) first — uses argument array to prevent shell injection via filenames
  try {
    const result = spawnSync("pdftotext", [filePath, "-"], { maxBuffer: 1024 * 1024, timeout: 10000 });
    if (result.status === 0) return result.stdout.toString("utf8");
  } catch { /* not available */ }

  // Fallback: PowerShell with basic extraction — file path passed via encoded command to avoid injection
  try {
    const ps = `$pdf = [System.IO.File]::ReadAllBytes('${filePath.replace(/'/g, "''")}'); $text = [System.Text.Encoding]::UTF8.GetString($pdf); $matches = [regex]::Matches($text, '\\(([^)]+)\\)'); $result = ($matches | ForEach-Object { $_.Groups[1].Value }) -join ' '; if ($result.Length -gt 0) { $result } else { '[Could not extract text]' }`;
    const encoded = Buffer.from(ps, "utf16le").toString("base64");
    const result = spawnSync("powershell", ["-NoProfile", "-EncodedCommand", encoded], {
      maxBuffer: 1024 * 1024,
      timeout: 10000,
    });
    if (result.status === 0) return result.stdout.toString("utf8").trim();
  } catch { /* not available */ }

  return "[PDF text extraction not available. Install pdftotext (poppler-utils) for PDF support.]";
}

export const readFileTool = {
  definition: {
    name: "read_file",
    description: "Read the contents of a file at the given path. Returns the file content with line numbers. Supports txt, md, json, csv, pdf, and other text formats. For large files, use offset and limit to read specific ranges. Supports absolute paths for files outside the project (requires confirmation).",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path (absolute or relative to project root)" },
        offset: { type: "integer", description: "Line number to start reading from (1-based)" },
        limit: { type: "integer", description: "Maximum number of lines to read" },
      },
      required: ["path"],
    },
  },

  safetyLevel(args) {
    const result = validatePath(args?.path || "", process.cwd(), { allowExternal: true });
    if (result.external && result.trusted) return SafetyLevel.LOW;
    if (result.external) return SafetyLevel.MEDIUM;
    return SafetyLevel.LOW;
  },

  validate(args, context) {
    if (!args.path) return { ok: false, error: "path is required" };
    const { valid, error } = validatePath(args.path, context.projectRoot, { allowExternal: true });
    if (!valid) return { ok: false, error };
    return { ok: true };
  },

  async execute(args, context) {
    const { valid, resolved, error } = validatePath(args.path, context.projectRoot, { allowExternal: true });
    if (!valid) return `Error: ${error}`;

    if (!existsSync(resolved)) {
      return `Error: File not found: ${args.path}`;
    }

    const ext = extname(resolved).toLowerCase();

    // Handle PDF files
    if (ext === ".pdf") {
      try {
        const stat = statSync(resolved);
        const sizeMB = (stat.size / 1048576).toFixed(1);
        const text = extractPdfText(resolved);
        const lines = text.split("\n");

        const offset = Math.max(1, args.offset || 1);
        const limit = args.limit || lines.length;
        const sliced = lines.slice(offset - 1, offset - 1 + limit);

        let result = `[PDF: ${args.path} (${sizeMB} MB)]\n\n` + sliced.join("\n");
        if (result.length > 30000) {
          result = result.slice(0, 30000) + `\n... [truncated]`;
        }
        return result;
      } catch (err) {
        return `Error reading PDF: ${err.message}`;
      }
    }

    // Handle binary files
    if (isBinaryFile(resolved)) {
      const stat = statSync(resolved);
      const sizeMB = (stat.size / 1048576).toFixed(2);
      return `[Binary file: ${args.path} (${ext || "unknown"}, ${sizeMB} MB) — cannot display contents]`;
    }

    // Text files (txt, md, json, csv, xml, yaml, etc.)
    try {
      const content = readFileSync(resolved, "utf8");
      const lines = content.split("\n");

      const offset = Math.max(1, args.offset || 1);
      const limit = args.limit || lines.length;
      const sliced = lines.slice(offset - 1, offset - 1 + limit);

      // Format with line numbers (cat -n style)
      const numbered = sliced.map((line, i) => {
        const lineNum = (offset + i).toString().padStart(6, " ");
        return `${lineNum}\t${line}`;
      });

      let result = numbered.join("\n");

      // Truncate if too large
      if (result.length > 30000) {
        result = result.slice(0, 30000) + `\n... [truncated, ${result.length - 30000} more chars]`;
      }

      return result;
    } catch (err) {
      return `Error reading file: ${err.message}`;
    }
  },

  formatConfirmation(args) {
    const result = validatePath(args.path, process.cwd(), { allowExternal: true });
    if (result.external) return `Read file outside project: ${args.path}`;
    return `Read file: ${args.path}`;
  },
};
