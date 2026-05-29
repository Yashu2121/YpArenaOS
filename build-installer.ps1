# ==============================================================================
# YP Arena OS: Unified Web Installer Compilation Automation
# ==============================================================================
# This script compiles the three sub-applications (Server Engine, Admin Dashboard,
# and PC Client Kiosk), compresses them into ZIP archives for cloud hosting,
# and runs the NSIS compiler to create the lightweight Web Installer stub.
# ==============================================================================

# Set fast mirrors for Electron and electron-builder binaries to prevent GitHub download timeouts
$env:ELECTRON_BUILDER_BINARIES_MIRROR = "https://registry.npmmirror.com/-/binary/electron-builder-binaries/"
$env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"

Clear-Host
Write-Host "=======================================================================" -ForegroundColor Cyan
Write-Host "          YP ARENA OS - UNIFIED WEB INSTALLER COMPILATION" -ForegroundColor Cyan
Write-Host "=======================================================================" -ForegroundColor Cyan
Write-Host ""

# ------------------------------------------------------------------------------
# 1. Detect NSIS (Nullsoft Scriptable Install System)
# ------------------------------------------------------------------------------
Write-Host "[1/3] Searching for NSIS Compiler (makensis.exe)..." -ForegroundColor Green
$nsisPath = Get-Command "makensis" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source

if (-not $nsisPath) {
    # Check default installation paths
    $commonPaths = @(
        "C:\Program Files (x86)\NSIS\makensis.exe",
        "C:\Program Files\NSIS\makensis.exe"
    )
    foreach ($path in $commonPaths) {
        if (Test-Path $path) {
            $nsisPath = $path
            break
        }
    }
}

if (-not $nsisPath) {
    Write-Host "makensis.exe was not found in your Path or standard program folders." -ForegroundColor Yellow
    Write-Host "Would you like to install NSIS silently via winget? (y/n)" -ForegroundColor Yellow
    $installChoice = Read-Host
    if ($installChoice -eq "y" -or $installChoice -eq "Y") {
        Write-Host "Updating winget package database..." -ForegroundColor Yellow
        & winget source update
        Write-Host "Installing NSIS..." -ForegroundColor Yellow
        & winget install --id NSIS.NSIS --silent --accept-package-agreements --accept-source-agreements
        Start-Sleep -Seconds 10
        # Recheck common paths
        foreach ($path in $commonPaths) {
            if (Test-Path $path) {
                $nsisPath = $path
                break
            }
        }
    }
}

if (-not $nsisPath) {
    Write-Error "ERROR: NSIS compiler is required to compile the installer. Please install NSIS (https://nsis.sourceforge.io) and run this script again."
    Read-Host "Press Enter to exit..."
    Exit
}

Write-Host "[OK] NSIS compiler detected at: $nsisPath" -ForegroundColor Green
Write-Host ""

# ------------------------------------------------------------------------------
# 2. Build and Compress Sub-Applications
# ------------------------------------------------------------------------------
Write-Host "[2/3] Compiling, packaging, and compressing sub-applications..." -ForegroundColor Green

# Stop any running instances to release file locks
Write-Host "Releasing file locks by stopping running YP Arena OS and Electron processes..." -ForegroundColor Yellow
$processNames = @("YP Arena OS*", "YpArenaos*", "electron", "backend-gui", "yp-arena-os*")
foreach ($name in $processNames) {
    Stop-Process -Name $name -Force -ErrorAction SilentlyContinue
}

# Also stop processes running from this workspace path to release locks
$workspacePath = (Get-Item -Path ".").FullName
Get-Process | Where-Object {
    try {
        $_.Path -and $_.Path.StartsWith($workspacePath, [System.StringComparison]::OrdinalIgnoreCase) -and $_.Name -ne "powershell" -and $_.Name -ne "cmd" -and $_.Name -ne "node"
    } catch {
        $false
    }
} | ForEach-Object {
    Write-Host "Stopping locking process: $($_.Name) (PID: $($_.Id)) running from workspace" -ForegroundColor Yellow
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 3

# Ensure target folder exists
if (-not (Test-Path "apps\installer")) {
    New-Item -ItemType Directory -Path "apps\installer" | Out-Null
}

# A. Build & Compress Server Engine
Write-Host "[BUILD] Building Server Engine..." -ForegroundColor Yellow
npm run electron:build --workspace=apps/server-engine
Write-Host "[ZIP] Compressing Server Engine package..." -ForegroundColor Yellow
if (Test-Path "apps\server-engine\release-builds\win-unpacked") {
    Write-Host "[COPY] Bundling Edge Server executable into GUI folder..." -ForegroundColor Yellow
    Copy-Item -Path "apps\edge-server\edge-server.exe" -Destination "apps\server-engine\release-builds\win-unpacked\edge-server.exe" -Force
    if (Test-Path "apps\edge-server\schema.sql") {
        Copy-Item -Path "apps\edge-server\schema.sql" -Destination "apps\server-engine\release-builds\win-unpacked\schema.sql" -Force
    }
    Remove-Item -Path "apps\installer\YP-Arena-OS-Edge-Server.zip" -ErrorAction SilentlyContinue
    Compress-Archive -Path "apps\server-engine\release-builds\win-unpacked\*" -DestinationPath "apps\installer\YP-Arena-OS-Edge-Server.zip" -Force
    Write-Host "[OK] Created YP-Arena-OS-Edge-Server.zip" -ForegroundColor Green
} else {
    Write-Error "Failed to locate built files for Server Engine."
}

# B. Build & Compress Admin Dashboard
Write-Host "[BUILD] Building Admin Dashboard..." -ForegroundColor Yellow
npm run build:electron --workspace=apps/admin-dashboard
Write-Host "[ZIP] Compressing Admin Dashboard package..." -ForegroundColor Yellow
if (Test-Path "apps\admin-dashboard\release-builds\win-unpacked") {
    Remove-Item -Path "apps\installer\YP-Arena-OS-Admin-Dashboard.zip" -ErrorAction SilentlyContinue
    Compress-Archive -Path "apps\admin-dashboard\release-builds\win-unpacked\*" -DestinationPath "apps\installer\YP-Arena-OS-Admin-Dashboard.zip" -Force
    Write-Host "[OK] Created YP-Arena-OS-Admin-Dashboard.zip" -ForegroundColor Green
} else {
    Write-Error "Failed to locate built files for Admin Dashboard."
}

# C. Build & Compress PC Client
Write-Host "[BUILD] Building PC Client Kiosk..." -ForegroundColor Yellow
npm run pack --workspace=apps/pc-client
Write-Host "[ZIP] Compressing PC Client package..." -ForegroundColor Yellow
if (Test-Path "apps\pc-client\release-builds\win-unpacked") {
    Remove-Item -Path "apps\installer\YP-Arena-OS-Kiosk-Client.zip" -ErrorAction SilentlyContinue
    Compress-Archive -Path "apps\pc-client\release-builds\win-unpacked\*" -DestinationPath "apps\installer\YP-Arena-OS-Kiosk-Client.zip" -Force
    Write-Host "[OK] Created YP-Arena-OS-Kiosk-Client.zip" -ForegroundColor Green
} else {
    Write-Error "Failed to locate built files for PC Client."
}

Write-Host "[OK] All applications successfully compiled and zipped." -ForegroundColor Green
Write-Host ""

# ------------------------------------------------------------------------------
# 3. Compile Unified Web Installer Stub
# ------------------------------------------------------------------------------
Write-Host "[3/3] Compiling NSIS script into Unified Web Installer..." -ForegroundColor Green

# Navigate to installer directory and run compiler
Push-Location apps/installer
& $nsisPath setup.nsi
Pop-Location

$installerFile = "apps/installer/YP-Arena-OS-Unified-Installer-Release.exe"
if (Test-Path $installerFile) {
    Write-Host "=======================================================================" -ForegroundColor Green
    Write-Host "             COMPILATION SUCCESSFUL!" -ForegroundColor Green
    Write-Host "=======================================================================" -ForegroundColor Green
    Write-Host "Unified Web Installer generated at:" -ForegroundColor Gray
    Write-Host "Path: $(Resolve-Path $installerFile)" -ForegroundColor Green
    Write-Host ""
    Write-Host "What to upload to S3:" -ForegroundColor Yellow
    Write-Host "  1. YP-Arena-OS-Unified-Installer-Release.exe  (Upload and link in Vercel)" -ForegroundColor Gray
    Write-Host "  2. YP-Arena-OS-Edge-Server.zip        (Upload to S3)" -ForegroundColor Gray
    Write-Host "  3. YP-Arena-OS-Admin-Dashboard.zip    (Upload to S3)" -ForegroundColor Gray
    Write-Host "  4. YP-Arena-OS-Kiosk-Client.zip       (Upload to S3)" -ForegroundColor Gray
} else {
    Write-Error "ERROR: Compilation finished but the installer executable was not found."
}

Write-Host ""
Read-Host "Press Enter to exit..."
