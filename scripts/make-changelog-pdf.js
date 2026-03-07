#!/usr/bin/env node
// Generates a PDF from the LlamaTalk Build changelog markdown file.
// Uses local date to determine the filename.
// Run: node scripts/make-changelog-pdf.js

import PDFDocument from "pdfkit";
import { createWriteStream, readFileSync, existsSync } from "fs";
import { join } from "path";

const OUTPUT_DIR = "E:\\LlamaTalk Files\\External Documents";

function getLocalDateString() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const dateStr = getLocalDateString();
const mdPath = join(OUTPUT_DIR, `Changelog LlamaTalk Build ${dateStr}.md`);
const pdfPath = join(OUTPUT_DIR, `Changelog LlamaTalk Build ${dateStr}.pdf`);

if (!existsSync(mdPath)) {
  console.error(`Markdown file not found: ${mdPath}`);
  process.exit(1);
}

const markdown = readFileSync(mdPath, "utf8");
const lines = markdown.split("\n");

const doc = new PDFDocument({ margin: 50, size: "A4" });
const stream = createWriteStream(pdfPath);
doc.pipe(stream);

const ORANGE = [255, 140, 0];
const BLACK = [0, 0, 0];
const GRAY = [80, 80, 80];

const L = 50; // left margin (matches doc margin)
const PW = doc.page.width - L - 50; // usable width

for (const line of lines) {
  if (line.startsWith("# ")) {
    doc.fontSize(22).fillColor(ORANGE).font("Helvetica-Bold").text(line.slice(2), L, doc.y, { width: PW, paragraphGap: 8 });
  } else if (line.startsWith("## ")) {
    doc.moveDown(0.5).fontSize(16).fillColor(ORANGE).font("Helvetica-Bold").text(line.slice(3), L, doc.y, { width: PW, paragraphGap: 4 });
  } else if (line.startsWith("### ")) {
    doc.moveDown(0.3).fontSize(13).fillColor(BLACK).font("Helvetica-Bold").text(line.slice(4), L, doc.y, { width: PW, paragraphGap: 2 });
  } else if (line.startsWith("- ")) {
    doc.fontSize(11).fillColor(BLACK).font("Helvetica").text("• " + line.slice(2), L + 16, doc.y, {
      width: PW - 16,
      paragraphGap: 1,
    });
  } else if (line.trim() === "") {
    doc.moveDown(0.4);
  } else {
    doc.fontSize(11).fillColor(GRAY).font("Helvetica").text(line, L, doc.y, { width: PW, paragraphGap: 2 });
  }
}

doc.end();
stream.on("finish", () => {
  console.log(`PDF written: ${pdfPath}`);
});
stream.on("error", (err) => {
  console.error("PDF write error:", err);
  process.exit(1);
});
