import { theme, box, icons, stripAnsi, termWidth } from "./theme.js";

const T = theme;

const ART_LARGE = [
  "    __    __                     ______      ____   ____        _ __    __",
  "   / /   / /___ _____ ___  ____ /_  __/___ _/ / /__/ __ )__  __(_) /___/ /",
  "  / /   / / __ `/ __ `__ \\/ __ `// / / __ `/ / //_/ __  / / / / / / __  / ",
  " / /___/ / /_/ / / / / / / /_/ // / / /_/ / / ,< / /_/ / /_/ / / / /_/ /  ",
  "/_____/_/\\__,_/_/ /_/ /_/\\__,_//_/  \\__,_/_/_/|_/_____/\\__,_/_/_/\\__,_/   ",
];

const ART_SMALL = [
  "   __   __               ______     ____    ___       _ __   __",
  "  / /  / /__ ___ _  ___ /_  __/__ _/ / /__ / _ )__ __(_) /__/ /",
  " / /__/ / _ `/ ' \\/ _ `// / / _ `/ /  '_// _  / // / / / _  /  ",
  "/____/_/\\_,_/_/_/_/\\_,_//_/  \\_,_/_/_/\\_\\/____/\\_,_/_/_/\\_,_/  ",
];

export function printBanner(version = "", { model, mode, provider } = {}) {
  const w = termWidth();
  const ART = w >= 78 ? ART_LARGE : ART_SMALL;
  const artWidth = Math.max(...ART.map((l) => l.length));
  const padCount = Math.max(0, Math.floor((w - artWidth) / 2));
  const pad = " ".repeat(padCount);

  process.stdout.write("\n");
  for (const line of ART) {
    process.stdout.write(T.accent + pad + line + T.reset + "\n");
  }

  // Tagline + version
  const verStr = version ? `${T.textMuted}v${version}${T.reset}` : "";
  const tagline = "Agentic coding from the terminal";
  const tagPad = " ".repeat(Math.max(0, Math.floor((w - tagline.length - (version ? version.length + 4 : 0)) / 2)));
  process.stdout.write("\n" + tagPad + T.dim + tagline + T.reset + "  " + verStr + "\n");

  // Separator
  const lineW = Math.min(w - 4, 70);
  process.stdout.write("\n" + " ".repeat(Math.max(0, Math.floor((w - lineW) / 2))) + T.border + box.h.repeat(lineW) + T.reset + "\n");

  // Status line: model + mode + provider
  if (model || mode || provider) {
    const parts = [];
    if (model) parts.push(`${T.accent}${model}${T.reset}`);
    if (provider) parts.push(`${T.textMuted}via ${provider}${T.reset}`);
    if (mode) {
      const modeColor = mode === "plan" ? T.modePlan : T.modeBuild;
      const modeIcon = mode === "plan" ? icons.plan : icons.build;
      parts.push(`${modeColor}${modeIcon} ${mode.charAt(0).toUpperCase() + mode.slice(1)}${T.reset}`);
    }
    const sep = ` ${T.textMuted}${icons.dot}${T.reset} `;
    const statusLine = parts.join(sep);
    const plainLen = stripAnsi(statusLine).length;
    const statusPad = " ".repeat(Math.max(0, Math.floor((w - plainLen) / 2)));
    process.stdout.write(statusPad + statusLine + "\n");
  }

  process.stdout.write("\n");
}
