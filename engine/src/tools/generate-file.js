import { writeFileSync, mkdirSync, existsSync, readFileSync, statSync, createWriteStream, unlinkSync } from "fs";
import { dirname, extname } from "path";
import { spawnSync } from "child_process";
import { SafetyLevel } from "./base.js";
import { validatePath } from "../safety.js";

const SUPPORTED_TYPES = ["md", "txt", "html", "csv", "json", "xml", "yaml", "yml", "log", "pdf"];

export const generateFileTool = {
  definition: {
    name: "generate_file",
    description:
      "Generate a file in a specified format. Supports: md, txt, html, csv, json, xml, yaml, log, pdf. " +
      "For PDF generation, provide markdown-style content and it will be converted. " +
      "Supports absolute paths for writing outside the project (requires confirmation). " +
      "Use this when you need to create documents, reports, exports, or structured output files.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Output file path (absolute or relative to project root)",
        },
        content: {
          type: "string",
          description: "File content. For PDF, use markdown-style text with # headings, **bold**, - lists",
        },
        format: {
          type: "string",
          enum: SUPPORTED_TYPES,
          description: "Output format (auto-detected from extension if omitted)",
        },
        title: {
          type: "string",
          description: "Document title (used for PDF header, HTML title, etc.)",
        },
      },
      required: ["path", "content"],
    },
  },

  safetyLevel(args) {
    const result = validatePath(args?.path || "", process.cwd(), { allowExternal: true });
    if (result.external && result.trusted) return SafetyLevel.MEDIUM;
    if (result.external) return SafetyLevel.HIGH;
    return SafetyLevel.MEDIUM;
  },

  validate(args, context) {
    if (!args.path) return { ok: false, error: "path is required" };
    if (args.content === undefined) return { ok: false, error: "content is required" };
    const { valid, error } = validatePath(args.path, context.projectRoot, { allowExternal: true });
    if (!valid) return { ok: false, error };

    const ext = (args.format || extname(args.path).slice(1)).toLowerCase();
    if (ext && !SUPPORTED_TYPES.includes(ext)) {
      return { ok: false, error: `Unsupported format: ${ext}. Supported: ${SUPPORTED_TYPES.join(", ")}` };
    }
    return { ok: true };
  },

  async execute(args, context) {
    const { resolved } = validatePath(args.path, context.projectRoot, { allowExternal: true });
    const ext = (args.format || extname(resolved).slice(1)).toLowerCase();

    // Backup existing file for undo
    if (existsSync(resolved)) {
      try {
        const oldContent = readFileSync(resolved, "utf8");
        context.sessionChanges?.push({ type: "write", path: resolved, oldContent, timestamp: Date.now() });
      } catch { /* binary or unreadable */ }
    } else {
      context.sessionChanges?.push({ type: "create", path: resolved, timestamp: Date.now() });
    }

    const dir = dirname(resolved);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    if (ext === "pdf") {
      return await generatePdf(resolved, args.content, args.title);
    }

    // For text-based formats, write content directly
    let output = args.content;

    if (ext === "html" && !args.content.includes("<html")) {
      output = wrapHtml(args.content, args.title);
    }

    if (ext === "json") {
      // Validate JSON
      try {
        JSON.parse(args.content);
      } catch {
        // Try to prettify if it's a JS-like object
        try {
          output = JSON.stringify(JSON.parse(args.content), null, 2);
        } catch { /* write as-is */ }
      }
    }

    writeFileSync(resolved, output, "utf8");
    const bytes = Buffer.byteLength(output, "utf8");
    return `Generated ${ext.toUpperCase()} file: ${args.path} (${bytes} bytes)`;
  },

  formatConfirmation(args) {
    const ext = (args.format || extname(args.path).slice(1)).toLowerCase();
    const result = validatePath(args.path, process.cwd(), { allowExternal: true });
    const loc = result.external ? " (outside project)" : "";
    return `Generate ${ext.toUpperCase()} file${loc}: ${args.path}?`;
  },
};

function sanitizeHtmlBody(html) {
  // Strip <script> tags and their contents
  let safe = html.replace(/<script[\s\S]*?<\/script>/gi, "<!-- script removed for safety -->");
  // Strip on* event handler attributes (e.g., onclick=, onerror=, onload=)
  safe = safe.replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  return safe;
}

function wrapHtml(content, title) {
  const safeTitle = (title || "Document").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const safeContent = sanitizeHtmlBody(content);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safeTitle}</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #333; }
h1, h2, h3 { color: #111; }
pre { background: #f5f5f5; padding: 1rem; border-radius: 4px; overflow-x: auto; }
code { background: #f0f0f0; padding: 2px 6px; border-radius: 3px; }
</style>
</head>
<body>
${safeContent}
</body>
</html>`;
}

async function generatePdf(outputPath, content, title) {
  // Try using pdfkit if available
  try {
    const PDFDocument = (await import("pdfkit")).default;
    const doc = new PDFDocument({ margin: 50 });

    return new Promise((resolve, reject) => {
      const stream = createWriteStream(outputPath);
      doc.pipe(stream);

      // Title
      if (title) {
        doc.fontSize(22).font("Helvetica-Bold").text(title, { align: "center" });
        doc.moveDown(1);
      }

      // Parse markdown-like content into PDF
      const lines = content.split("\n");
      for (const line of lines) {
        if (line.startsWith("# ")) {
          doc.moveDown(0.5).fontSize(18).font("Helvetica-Bold").text(line.slice(2));
          doc.moveDown(0.3);
        } else if (line.startsWith("## ")) {
          doc.moveDown(0.5).fontSize(15).font("Helvetica-Bold").text(line.slice(3));
          doc.moveDown(0.3);
        } else if (line.startsWith("### ")) {
          doc.moveDown(0.3).fontSize(13).font("Helvetica-Bold").text(line.slice(4));
          doc.moveDown(0.2);
        } else if (line.startsWith("- ") || line.startsWith("* ")) {
          doc.fontSize(11).font("Helvetica").text(`  \u2022 ${line.slice(2)}`, { indent: 10 });
        } else if (line.startsWith("  - ") || line.startsWith("  * ")) {
          doc.fontSize(11).font("Helvetica").text(`    \u25E6 ${line.slice(4)}`, { indent: 20 });
        } else if (line.trim() === "") {
          doc.moveDown(0.4);
        } else if (line.startsWith("---")) {
          doc.moveDown(0.3);
          doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke("#cccccc");
          doc.moveDown(0.3);
        } else {
          // Handle inline bold
          const parts = line.split(/(\*\*[^*]+\*\*)/);
          if (parts.length > 1) {
            const textRuns = parts.map((part) => {
              if (part.startsWith("**") && part.endsWith("**")) {
                return { text: part.slice(2, -2), font: "Helvetica-Bold" };
              }
              return { text: part, font: "Helvetica" };
            });
            for (const run of textRuns) {
              doc.fontSize(11).font(run.font);
              if (run.text) doc.text(run.text, { continued: run !== textRuns[textRuns.length - 1] });
            }
          } else {
            doc.fontSize(11).font("Helvetica").text(line);
          }
        }
      }

      doc.end();
      stream.on("finish", () => {
        let size = 0;
        try { size = statSync(outputPath).size; } catch {}
        resolve(`Generated PDF: ${outputPath} (${size} bytes)`);
      });
      stream.on("error", (err) => reject(err));
    });
  } catch {
    // Fallback: try pandoc or just inform user
    try {
      const tmpMd = outputPath.replace(/\.pdf$/i, ".tmp.md");
      writeFileSync(tmpMd, content, "utf8");
      const pandocResult = spawnSync("pandoc", [tmpMd, "-o", outputPath], { timeout: 60000, stdio: ["pipe", "pipe", "pipe"] });
      if (pandocResult.status !== 0) throw new Error(pandocResult.stderr?.toString() || "pandoc failed");
      try { unlinkSync(tmpMd); } catch {}
      return `Generated PDF via pandoc: ${outputPath}`;
    } catch {
      return "PDF generation failed: neither pdfkit nor pandoc available. Install pdfkit (npm install pdfkit) or pandoc (winget install JohnMacFarlane.Pandoc) and retry.";
    }
  }
}
