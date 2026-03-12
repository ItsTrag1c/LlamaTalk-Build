/**
 * Build the sidecar Node.js process into a standalone binary.
 *
 * 1. esbuild bundles sidecar/main.js + clankbuild-engine into a single CJS file
 * 2. pkg compiles that bundle into a standalone binary (no Node.js required)
 * 3. The binary is placed in src-tauri/binaries/ with Tauri's naming convention
 *
 * The naming convention for Tauri externalBin is:
 *   {name}-{target-triple}
 * For macOS arm64: clank-sidecar-aarch64-apple-darwin
 * For macOS x64: clank-sidecar-x86_64-apple-darwin
 * For Windows x64: clank-sidecar-x86_64-pc-windows-msvc.exe
 */
import { execSync } from "child_process";
import { mkdirSync, existsSync } from "fs";
import { cpus } from "os";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const sidecarDir = join(root, "sidecar");
const binDir = join(root, "src-tauri", "binaries");

const platform = process.platform;
const arch = process.arch;

let triple, outName, pkgTarget;

if (platform === "win32") {
  triple = "x86_64-pc-windows-msvc";
  outName = `clank-sidecar-${triple}.exe`;
  pkgTarget = "node18-win-x64";
} else if (platform === "darwin") {
  if (arch === "arm64") {
    triple = "aarch64-apple-darwin";
  } else {
    triple = "x86_64-apple-darwin";
  }
  outName = `clank-sidecar-${triple}`;
  pkgTarget = `node18-macos-${arch === "arm64" ? "arm64" : "x64"}`;
} else {
  triple = `${arch}-unknown-linux-gnu`;
  outName = `clank-sidecar-${triple}`;
  pkgTarget = `node18-linux-${arch === "arm64" ? "arm64" : "x64"}`;
}

console.log(`Building sidecar for ${platform} (${arch})...`);

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

// Step 2: Compile to standalone binary with pkg
console.log(`  Packaging with pkg (target: ${pkgTarget})...`);
execSync(
  `npx pkg "${join(binDir, "sidecar-bundle.cjs")}" --target ${pkgTarget} --output "${join(binDir, outName)}"`,
  { stdio: "inherit", cwd: root }
);

console.log(`  Built: src-tauri/binaries/${outName}`);
