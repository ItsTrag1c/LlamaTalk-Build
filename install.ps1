# LlamaTalk Build — PowerShell installer
# Usage: irm https://raw.githubusercontent.com/ItsTrag1c/LlamaTalk-Build/master/install.ps1 | iex

$ErrorActionPreference = "Stop"

$repo = "ItsTrag1c/LlamaTalk-Build"
$installDir = Join-Path $HOME "LlamaTalkBuild"

Write-Host ""
Write-Host "  LlamaTalk Build Installer" -ForegroundColor DarkYellow
Write-Host ""

# 1. Query GitHub API for latest release
Write-Host "  Fetching latest release..." -ForegroundColor Gray
$release = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/latest" -Headers @{ "User-Agent" = "LlamaTalkBuild-Installer" }
$tag = $release.tag_name -replace "^v", ""
Write-Host "  Found v$tag" -ForegroundColor Gray

# 2. Find the standalone EXE asset (LlamaTalkBuild_X.Y.Z.exe)
$asset = $release.assets | Where-Object { $_.name -match "^LlamaTalkBuild_[\d.]+\.exe$" } | Select-Object -First 1
if (-not $asset) {
    Write-Host "  Error: Could not find standalone EXE in release assets." -ForegroundColor Red
    exit 1
}

# 3. Create install directory
if (-not (Test-Path $installDir)) {
    New-Item -ItemType Directory -Path $installDir -Force | Out-Null
}

# 4. Download the EXE
$exePath = Join-Path $installDir "LlamaTalkBuild.exe"
Write-Host "  Downloading $($asset.name) ($([math]::Round($asset.size / 1MB, 1)) MB)..." -ForegroundColor Gray
Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $exePath -UseBasicParsing

# 5. Write llamabuild.cmd
$cmdPath = Join-Path $installDir "llamabuild.cmd"
$cmdContent = "@echo off`r`n`"%~dp0LlamaTalkBuild.exe`" %*"
Set-Content -Path $cmdPath -Value $cmdContent -Encoding ASCII

# 6. Add to user PATH if not already present
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$installDir*") {
    $newPath = if ($userPath) { "$userPath;$installDir" } else { $installDir }
    [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    Write-Host "  Added to user PATH." -ForegroundColor Gray
}

Write-Host ""
Write-Host "  LlamaTalk Build v$tag installed to $installDir" -ForegroundColor Green
Write-Host ""
Write-Host "  Open a new terminal and type: llamabuild" -ForegroundColor DarkYellow
Write-Host ""
