# Installing Clank

All apps are available for **Windows** and **macOS**. Pick the app you need and follow the instructions for your preferred install method.

---

## Clank Chat — Desktop

A desktop GUI for AI conversations with a floating assistant overlay.

### Windows

**Installer (recommended)**
Download `Clank Chat_x64-setup.exe` from [GitHub Releases](https://github.com/ItsTrag1c/Clank-Chat/releases/latest) and run it. Installs to `C:\Program Files\Clank Chat\`.

### macOS

Download `Clank Chat_aarch64.dmg` from [GitHub Releases](https://github.com/ItsTrag1c/Clank-Chat/releases/latest) and drag to Applications.

---

## Clank Chat — CLI

A lightweight terminal REPL and one-shot mode for quick answers.

### Windows

**One-liner install**
```powershell
irm https://raw.githubusercontent.com/ItsTrag1c/Clank-Chat/cli/install.ps1 | iex
```
Downloads the latest release to `%USERPROFILE%\ClankCLI\` and adds it to your PATH. Run with `llama`.

**Installer**
Download `Clank CLI_setup.exe` from [GitHub Releases](https://github.com/ItsTrag1c/Clank-Chat/releases/latest). Installs to `C:\Program Files\Clank CLI\` and adds `llama` to your system PATH.

**Standalone EXE**
Download `ClankCLI.exe` from [GitHub Releases](https://github.com/ItsTrag1c/Clank-Chat/releases/latest). Run from anywhere — no install needed.

### Usage

```
llama                # start interactive chat
llama "question"     # one-shot mode
llama --version      # check version
```

---

## Clank Build — CLI

An agentic coding assistant with 14 tools, project memory, and plan/build modes.

### Windows

**One-liner install**
```powershell
irm https://raw.githubusercontent.com/ItsTrag1c/Clank-Build/cli/install.ps1 | iex
```
Downloads the latest release to `%USERPROFILE%\ClankBuild\` and adds it to your PATH. Run with `clankbuild`.

**Installer**
Download `Clank Build_setup.exe` from [GitHub Releases](https://github.com/ItsTrag1c/Clank-Build/releases/latest). Installs to `C:\Program Files\Clank Build\` and adds `clankbuild` to your system PATH.

**Standalone EXE**
Download `ClankBuild.exe` from [GitHub Releases](https://github.com/ItsTrag1c/Clank-Build/releases/latest). Run from anywhere — no install needed.

### Usage

```
clankbuild           # start agent in current directory
clankbuild -c        # continue last session
clankbuild --version # check version
```

---

## Clank Build — Desktop

The Build agent wrapped in a desktop GUI.

### Windows

**Installer (recommended)**
Download `Clank Build Desktop_x64-setup.exe` from [GitHub Releases](https://github.com/ItsTrag1c/Clank-Build/releases/latest). Installs to `C:\Program Files\Clank Build Desktop\`.

**MSI**
Download `Clank Build Desktop_x64_en-US.msi` from [GitHub Releases](https://github.com/ItsTrag1c/Clank-Build/releases/latest) for MSI-based deployment.

### macOS

Download `Clank Build Desktop_aarch64.dmg` from [GitHub Releases](https://github.com/ItsTrag1c/Clank-Build/releases/latest) and drag to Applications.

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
- **One-liner installs:** Delete the install folder (`%USERPROFILE%\ClankCLI\` or `%USERPROFILE%\ClankBuild\`) and remove it from your PATH.
- **Standalone EXE:** Just delete the file.

---

For more info, visit [clanksuite.dev](https://clanksuite.dev).
