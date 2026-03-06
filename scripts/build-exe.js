import { execSync } from "child_process";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const { version } = JSON.parse(readFileSync("./package.json", "utf8"));

console.log(`Building LlamaTalk Build v${version}...`);

// Step 1: Bundle with esbuild (same params as CLI)
console.log("  Bundling with esbuild...");
execSync("npx esbuild index.js --bundle --platform=node --format=cjs --outfile=dist/bundle.cjs", {
  stdio: "inherit",
});

// Step 2: Package with pkg (same target as CLI: node18-win-x64)
const out = `dist/LlamaTalkBuild_${version}.exe`;
console.log("  Packaging with pkg...");
execSync(`pkg dist/bundle.cjs --target node18-win-x64 --output "${out}"`, {
  stdio: "inherit",
});

console.log(`Built: ${out}`);

// Step 3: Build NSIS installer
console.log("  Building NSIS installer...");
execSync(`node "${join(__dirname, "build-installer.js")}"`, {
  stdio: "inherit",
});
