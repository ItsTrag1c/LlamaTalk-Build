import { writeFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { execSync } from "child_process";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

const { version } = JSON.parse(readFileSync(join(projectRoot, "package.json"), "utf8"));

// Resolve paths
const exeSrc  = join(projectRoot, `dist/Clank_${version}.exe`);
const nsiFile = join(projectRoot, `dist/installer.nsi`);
const outFile = join(projectRoot, `dist/Clank_${version}_setup.exe`);

// Find makensis — prefer Tauri's cached copy, fall back to system PATH
function findMakensis() {
  const tauriPath = join(
    process.env.LOCALAPPDATA || "",
    "tauri", "NSIS", "makensis.exe"
  );
  if (existsSync(tauriPath)) return tauriPath;

  try {
    execSync("makensis /VERSION", { stdio: "pipe" });
    return "makensis";
  } catch {
    return null;
  }
}

const makensis = findMakensis();
if (!makensis) {
  console.error("Error: makensis not found. Run a Tauri Desktop build first to cache NSIS.");
  process.exit(1);
}

if (!existsSync(exeSrc)) {
  console.error(`Error: EXE not found at ${exeSrc} — run npm run build:exe first.`);
  process.exit(1);
}

// Escape backslashes for NSIS string literals
const exeSrcNsi  = exeSrc.replaceAll("\\", "\\\\");
const outFileNsi = outFile.replaceAll("\\", "\\\\");
const nsisDir    = dirname(makensis).replaceAll("\\", "\\\\");

// NOTE on NSIS string escaping used below:
//   $$varname  → literal $varname  (prevents NSIS from treating PS variables as NSIS variables)
//   $\\"       → literal "         ($\" escape in NSIS double-quoted strings)
//   $\\r$\\n   → CR+LF             (NSIS newline escape sequences)
//   $INSTDIR, $TEMP, etc. → expanded by NSIS at install time (correct behaviour)
//   \\\\       → \\  in NSIS       (JS template \\→\ then NSIS \\→\\ in path; Windows accepts both)

const nsiScript = `
Unicode true

!define PRODUCT_NAME    "Clank"
!define PRODUCT_VERSION "${version}"
!define PRODUCT_EXE     "Clank.exe"
!define UNINSTALL_KEY   "Software\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\Uninstall\\\\Clank"
!define LEGACY_UNINSTALL_KEY "Software\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\Uninstall\\\\ClankBuild"

Name "\${PRODUCT_NAME} \${PRODUCT_VERSION}"
OutFile "${outFileNsi}"

; Install to 64-bit Program Files — requires admin elevation
InstallDir "$PROGRAMFILES64\\\\Clank"
InstallDirRegKey HKLM "Software\\\\Clank" ""
RequestExecutionLevel admin
SetCompressor lzma

!addincludedir "${nsisDir}\\\\..\\\\Include"
!include "LogicLib.nsh"
!include "MUI2.nsh"

!define MUI_WELCOMEPAGE_TITLE "Install Clank \${PRODUCT_VERSION}"
!define MUI_WELCOMEPAGE_TEXT "Clank is an agentic coding assistant for the Clank Suite.$\\r$\\n$\\r$\\nThis will install Clank to Program Files and add it to the system PATH."
!define MUI_FINISHPAGE_TITLE "Clank Installed"
!define MUI_FINISHPAGE_TEXT "Clank \${PRODUCT_VERSION} is ready.$\\r$\\n$\\r$\\nOpen a new CMD or PowerShell window and type:$\\r$\\n  clank$\\r$\\n$\\r$\\nto start using it in any project directory."
!define MUI_FINISHPAGE_NOAUTOCLOSE

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"

; ── Install ────────────────────────────────────────────────────────────────────
Section "Install"
  ; Detect and clean up legacy "Clank Build" installation
  ReadRegStr $R1 HKLM "\${LEGACY_UNINSTALL_KEY}" "InstallLocation"
  \${If} $R1 != ""
    ; Remove legacy files
    Delete "$R1\\\\ClankBuild.exe"
    Delete "$R1\\\\clankbuild.cmd"
    RMDir "$R1"
    ; Remove legacy registry keys
    DeleteRegKey HKLM "\${LEGACY_UNINSTALL_KEY}"
    DeleteRegKey HKLM "Software\\\\Clank Build"
    ; Remove legacy install dir from PATH
    FileOpen $R0 "$TEMP\\\\clank-legacy-cleanup.ps1" w
    FileWrite $R0 "$$target = '$R1'$\\r$\\n"
    FileWrite $R0 "$$p = [Environment]::GetEnvironmentVariable('Path', 'Machine')$\\r$\\n"
    FileWrite $R0 "$$dirs = ($$p -split ';') | Where-Object { $$_ -ne '' -and $$_ -ne $$target }$\\r$\\n"
    FileWrite $R0 "[Environment]::SetEnvironmentVariable('Path', ($$dirs -join ';'), 'Machine')$\\r$\\n"
    FileClose $R0
    nsExec::ExecToLog 'powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$TEMP\\\\clank-legacy-cleanup.ps1"'
    Delete "$TEMP\\\\clank-legacy-cleanup.ps1"
  \${EndIf}

  ; Clean previous installation files (preserves %APPDATA% config/memory)
  RMDir /r "$INSTDIR"
  SetOutPath "$INSTDIR"
  File "${exeSrcNsi}"
  Rename "$INSTDIR\\\\Clank_${version}.exe" "$INSTDIR\\\\Clank.exe"

  ; Remove any leftover versioned EXEs from previous updates (all naming generations)
  FileOpen $R0 "$TEMP\\\\clank-cleanup.ps1" w
  FileWrite $R0 "Get-ChildItem -LiteralPath '$INSTDIR' -Filter 'Clank_*.exe' | Remove-Item -Force -ErrorAction SilentlyContinue$\\r$\\n"
  FileWrite $R0 "Get-ChildItem -LiteralPath '$INSTDIR' -Filter 'ClankBuild_*.exe' | Remove-Item -Force -ErrorAction SilentlyContinue$\\r$\\n"
  FileWrite $R0 "Get-ChildItem -LiteralPath '$INSTDIR' -Filter 'LlamaTalkBuild_*.exe' | Remove-Item -Force -ErrorAction SilentlyContinue$\\r$\\n"
  FileClose $R0
  nsExec::ExecToLog 'powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$TEMP\\\\clank-cleanup.ps1"'
  Delete "$TEMP\\\\clank-cleanup.ps1"

  ; Copy the running installer into Program Files with its original versioned name
  CopyFiles /SILENT "$EXEPATH" "$INSTDIR\\\\Clank_${version}_setup.exe"

  ; Remove old versioned setup and uninstall files from previous version installs (all naming generations)
  FileOpen $R0 "$TEMP\\\\clank-ver-cleanup.ps1" w
  FileWrite $R0 "$$d = '$INSTDIR'$\\r$\\n"
  FileWrite $R0 "Get-ChildItem -LiteralPath $$d -Filter 'Clank_*_setup.exe' | Where-Object { $$_.Name -ne 'Clank_${version}_setup.exe' } | Remove-Item -Force -ErrorAction SilentlyContinue$\\r$\\n"
  FileWrite $R0 "Get-ChildItem -LiteralPath $$d -Filter 'Clank_*_uninstall.exe' | Where-Object { $$_.Name -ne 'Clank_${version}_uninstall.exe' } | Remove-Item -Force -ErrorAction SilentlyContinue$\\r$\\n"
  FileWrite $R0 "Get-ChildItem -LiteralPath $$d -Filter 'Clank Build_*_setup.exe' | Remove-Item -Force -ErrorAction SilentlyContinue$\\r$\\n"
  FileWrite $R0 "Get-ChildItem -LiteralPath $$d -Filter 'Clank Build_*_uninstall.exe' | Remove-Item -Force -ErrorAction SilentlyContinue$\\r$\\n"
  FileWrite $R0 "Get-ChildItem -LiteralPath $$d -Filter 'LlamaTalk Build_*_setup.exe' | Remove-Item -Force -ErrorAction SilentlyContinue$\\r$\\n"
  FileWrite $R0 "Get-ChildItem -LiteralPath $$d -Filter 'LlamaTalk Build_*_uninstall.exe' | Remove-Item -Force -ErrorAction SilentlyContinue$\\r$\\n"
  FileClose $R0
  nsExec::ExecToLog 'powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$TEMP\\\\clank-ver-cleanup.ps1"'
  Delete "$TEMP\\\\clank-ver-cleanup.ps1"

  ; Write clank.cmd shorthand (uses %~dp0 so it works from any PATH lookup)
  FileOpen $R0 "$INSTDIR\\\\clank.cmd" w
  FileWrite $R0 "@echo off$\\r$\\n"
  FileWrite $R0 "$\\"%~dp0Clank.exe$\\" %*$\\r$\\n"
  FileClose $R0

  ; Add install dir to system PATH if not already present
  FileOpen $R0 "$TEMP\\\\clank-path-add.ps1" w
  FileWrite $R0 "$$instdir = '$INSTDIR'$\\r$\\n"
  FileWrite $R0 "$$p = [Environment]::GetEnvironmentVariable('Path', 'Machine')$\\r$\\n"
  FileWrite $R0 "$$dirs = ($$p -split ';') | Where-Object { $$_ -ne '' }$\\r$\\n"
  FileWrite $R0 "if ($$dirs -notcontains $$instdir) { [Environment]::SetEnvironmentVariable('Path', ($$dirs + $$instdir) -join ';', 'Machine') }$\\r$\\n"
  FileClose $R0
  nsExec::ExecToLog 'powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$TEMP\\\\clank-path-add.ps1"'
  Delete "$TEMP\\\\clank-path-add.ps1"
  ; Broadcast PATH change to running processes
  SendMessage 65535 26 0 "STR:Environment" /TIMEOUT=5000

  ; Register in Add/Remove Programs (HKLM — machine-wide)
  WriteRegStr  HKLM "\${UNINSTALL_KEY}" "DisplayName"     "Clank"
  WriteRegStr  HKLM "\${UNINSTALL_KEY}" "DisplayVersion"  "\${PRODUCT_VERSION}"
  WriteRegStr  HKLM "\${UNINSTALL_KEY}" "Publisher"       "Clank"
  WriteRegStr  HKLM "\${UNINSTALL_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr  HKLM "\${UNINSTALL_KEY}" "UninstallString" '"$INSTDIR\\\\Clank_${version}_uninstall.exe"'
  WriteRegDWORD HKLM "\${UNINSTALL_KEY}" "NoModify" 1
  WriteRegDWORD HKLM "\${UNINSTALL_KEY}" "NoRepair"  1

  ; Store install location so uninstaller can find it
  WriteRegStr HKLM "Software\\\\Clank" "" "$INSTDIR"
  WriteUninstaller "$INSTDIR\\\\Clank_${version}_uninstall.exe"
SectionEnd

; ── Uninstall ──────────────────────────────────────────────────────────────────
Section "Uninstall"
  ; Remove install dir from system PATH
  FileOpen $R0 "$TEMP\\\\clank-path-rm.ps1" w
  FileWrite $R0 "$$target = '$INSTDIR'$\\r$\\n"
  FileWrite $R0 "$$p = [Environment]::GetEnvironmentVariable('Path', 'Machine')$\\r$\\n"
  FileWrite $R0 "$$dirs = ($$p -split ';') | Where-Object { $$_ -ne '' -and $$_ -ne $$target }$\\r$\\n"
  FileWrite $R0 "[Environment]::SetEnvironmentVariable('Path', ($$dirs -join ';'), 'Machine')$\\r$\\n"
  FileClose $R0
  nsExec::ExecToLog 'powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "$TEMP\\\\clank-path-rm.ps1"'
  Delete "$TEMP\\\\clank-path-rm.ps1"
  SendMessage 65535 26 0 "STR:Environment" /TIMEOUT=5000

  Delete "$INSTDIR\\\\Clank.exe"
  Delete "$INSTDIR\\\\Clank.old.exe"
  Delete "$INSTDIR\\\\clank.cmd"
  Delete "$INSTDIR\\\\ClankBuild.exe"
  Delete "$INSTDIR\\\\ClankBuild.old.exe"
  Delete "$INSTDIR\\\\clankbuild.cmd"
  Delete "$INSTDIR\\\\Clank_${version}_setup.exe"
  Delete "$INSTDIR\\\\Clank_${version}_uninstall.exe"
  RMDir  "$INSTDIR"

  DeleteRegKey HKLM "\${UNINSTALL_KEY}"
  DeleteRegKey HKLM "Software\\\\Clank"
  ; Clean up legacy registry keys if they exist
  DeleteRegKey HKLM "\${LEGACY_UNINSTALL_KEY}"
  DeleteRegKey HKLM "Software\\\\Clank Build"
SectionEnd
`;

mkdirSync(join(projectRoot, "dist"), { recursive: true });
writeFileSync(nsiFile, nsiScript, "utf8");

console.log(`Building installer for Clank v${version}...`);
execSync(`"${makensis}" "${nsiFile}"`, { stdio: "inherit" });
console.log(`Built: ${outFile}`);
