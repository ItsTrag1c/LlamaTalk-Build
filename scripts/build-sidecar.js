/**
 * Build the sidecar Node.js process into a standalone EXE.
 *
 * 1. esbuild bundles sidecar/main.js + llamatalkbuild-engine into a single CJS file
 * 2. pkg compiles that bundle into a standalone Windows EXE (no Node.js required)
 * 3. The EXE is placed in src-tauri/binaries/ with Tauri's naming convention
 *
 * The naming convention for Tauri externalBin is:
 *   {name}-{target-triple}.exe
 * For Windows x64: llamabuild-sidecar-x86_64-pc-windows-msvc.exe
 */
import { execSync } from "child_process";
import { mkdirSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const sidecarDir = join(root, "sidecar");
const binDir = join(root, "src-tauri", "binaries");

const triple = "x86_64-pc-windows-msvc";
const outName = `llamabuild-sidecar-${triple}.exe`;

console.log("Building sidecar...");

// Ensure output directory exists
if (!existsSync(binDir)) {
  mkdirSync(binDir, { recursive: true });
}

// Step 1: Bundle sidecar + engine into a single CJS file
console.log("  Bundling with esbuild...");
execSync(
  `npx esbuild "${join(sidecarDir, "main.js")}" --bundle --platform=node --format=cjs --outfile="${join(binDir, "sidecar-bundle.cjs")}"`,
  { stdio: "inherit", cwd: sidecarDir }
);

// Step 2: Compile to standalone EXE with pkg
console.log("  Packaging with pkg...");
execSync(
  `npx pkg "${join(binDir, "sidecar-bundle.cjs")}" --target node18-win-x64 --output "${join(binDir, outName)}"`,
  { stdio: "inherit", cwd: root }
);

console.log(`  Built: src-tauri/binaries/${outName}`);
