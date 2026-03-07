const ORANGE = "\x1b[38;5;208m";
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";

const ART_LARGE = [
  "    __    __                   ______      ____    ____        _ __    __",
  "   / /   / /___ _____ ___  __/_  __/___ _/ / /__ / __ )__  __(_) /___/ /",
  "  / /   / / __ `/ __ `__ \\/ __ `/ / __ `/ / //_// __  / / / / / / __  / ",
  " / /___/ / /_/ / / / / / / /_/ / / /_/ / / ,<  / /_/ / /_/ / / / /_/ /  ",
  "/_____/_/\\__,_/_/ /_/ /_/\\__,_/_/\\__,_/_/_/|_|/_____/\\__,_/_/_/\\__,_/   ",
];

const ART_SMALL = [
  " _    _                 _____     _ _   ___       _ _    _ ",
  "| |  | |               |_   _|_ _| | | | _ )_  _ (_) |__| |",
  "| |  | | __ _ _ __ ___ _ | |/ _` | | |_| _ \\ || | | / _` |",
  "|____|_|\\__,_|_| |_| |_| |_|\\__,_|_|_(_)___/\\_,_|_|_\\__,_|",
];

export function printBanner(version = "") {
  const termWidth = process.stdout.columns || 80;
  const ART = termWidth >= 76 ? ART_LARGE : ART_SMALL;
  const artWidth = Math.max(...ART.map((l) => l.length));
  const padCount = Math.max(0, Math.floor((termWidth - artWidth) / 2));
  const pad = " ".repeat(padCount);

  const verStr = version ? `  ${DIM}v${version}${RESET}` : "";
  const tagline = "Agentic coding from the terminal";
  const tagPad = " ".repeat(Math.max(0, Math.floor((termWidth - tagline.length - (version ? version.length + 4 : 0)) / 2)));

  process.stdout.write("\n");
  for (const line of ART) {
    process.stdout.write(ORANGE + pad + line + RESET + "\n");
  }
  process.stdout.write(
    "\n" + tagPad + DIM + tagline + RESET + verStr + "\n\n"
  );
}
