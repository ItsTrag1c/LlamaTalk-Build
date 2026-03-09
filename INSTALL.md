# Installing LlamaTalk

All apps are available for **Windows** and **macOS**. Pick the app you need and follow the instructions for your preferred install method.

---

## LlamaTalk Chat — Desktop

A desktop GUI for AI conversations with a floating assistant overlay.

### Windows

**Installer (recommended)**
Download `LlamaTalk Chat_x64-setup.exe` from [GitHub Releases](https://github.com/ItsTrag1c/LlamaTalk-Chat/releases/latest) and run it. Installs to `C:\Program Files\LlamaTalk Chat\`.

### macOS

Download `LlamaTalk Chat_aarch64.dmg` from [GitHub Releases](https://github.com/ItsTrag1c/LlamaTalk-Chat/releases/latest) and drag to Applications.

---

## LlamaTalk Chat — CLI

A lightweight terminal REPL and one-shot mode for quick answers.

### Windows

**One-liner install**
```powershell
irm https://raw.githubusercontent.com/ItsTrag1c/LlamaTalk-Chat/cli/install.ps1 | iex
```
Downloads the latest release to `%USERPROFILE%\LlamaTalkCLI\` and adds it to your PATH. Run with `llama`.

**Installer**
Download `LlamaTalk CLI_setup.exe` from [GitHub Releases](https://github.com/ItsTrag1c/LlamaTalk-Chat/releases/latest). Installs to `C:\Program Files\LlamaTalk CLI\` and adds `llama` to your system PATH.

**Standalone EXE**
Download `LlamaTalkCLI.exe` from [GitHub Releases](https://github.com/ItsTrag1c/LlamaTalk-Chat/releases/latest). Run from anywhere — no install needed.

### Usage

```
llama                # start interactive chat
llama "question"     # one-shot mode
llama --version      # check version
```

---

## LlamaTalk Build — CLI

An agentic coding assistant with 14 tools, project memory, and plan/build modes.

### Windows

**One-liner install**
```powershell
irm https://raw.githubusercontent.com/ItsTrag1c/LlamaTalk-Build/cli/install.ps1 | iex
```
Downloads the latest release to `%USERPROFILE%\LlamaTalkBuild\` and adds it to your PATH. Run with `llamabuild`.

**Installer**
Download `LlamaTalk Build_setup.exe` from [GitHub Releases](https://github.com/ItsTrag1c/LlamaTalk-Build/releases/latest). Installs to `C:\Program Files\LlamaTalk Build\` and adds `llamabuild` to your system PATH.

**Standalone EXE**
Download `LlamaTalkBuild.exe` from [GitHub Releases](https://github.com/ItsTrag1c/LlamaTalk-Build/releases/latest). Run from anywhere — no install needed.

### Usage

```
llamabuild           # start agent in current directory
llamabuild -c        # continue last session
llamabuild --version # check version
```

---

## LlamaTalk Build — Desktop

The Build agent wrapped in a desktop GUI.

### Windows

**Installer (recommended)**
Download `LlamaTalk Build Desktop_x64-setup.exe` from [GitHub Releases](https://github.com/ItsTrag1c/LlamaTalk-Build/releases/latest). Installs to `C:\Program Files\LlamaTalk Build Desktop\`.

**MSI**
Download `LlamaTalk Build Desktop_x64_en-US.msi` from [GitHub Releases](https://github.com/ItsTrag1c/LlamaTalk-Build/releases/latest) for MSI-based deployment.

### macOS

Download `LlamaTalk Build Desktop_aarch64.dmg` from [GitHub Releases](https://github.com/ItsTrag1c/LlamaTalk-Build/releases/latest) and drag to Applications.

---

## Verify Installation

All downloads include a `SHA256SUMS.txt` file on the release page. To verify:

```powershell
Get-FileHash .\downloaded-file.exe | Format-List
```

Compare the hash with the one in `SHA256SUMS.txt`.

---

## Uninstall

- **Installer/MSI apps:** Use Windows Settings > Apps > Installed apps, or run the uninstaller from the install directory.
- **One-liner installs:** Delete the install folder (`%USERPROFILE%\LlamaTalkCLI\` or `%USERPROFILE%\LlamaTalkBuild\`) and remove it from your PATH.
- **Standalone EXE:** Just delete the file.

---

For more info, visit [llamatalksuite.dev](https://llamatalksuite.dev).
