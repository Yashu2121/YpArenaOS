# ==============================================================================
# YP Arena OS: Unified Installer Compilation Automation
# ==============================================================================
# This script compiles the three sub-applications (Server Engine, Admin Dashboard,
# and PC Client Kiosk) and runs the NSIS compiler to create the final installer.
# ==============================================================================

Clear-Host
Write-Host "=======================================================================" -ForegroundColor Cyan
Write-Host "             YP ARENA OS - UNIFIED INSTALLER COMPILATION" -ForegroundColor Cyan
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
        Write-Host "Installing NSIS..." -ForegroundColor Yellow
        & winget install --id Nullsoft.NSIS --silent --accept-package-agreements --accept-source-agreements
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
# 2. Build Sub-Applications
# ------------------------------------------------------------------------------
Write-Host "[2/3] Compiling and packaging sub-applications..." -ForegroundColor Green

# A. Build Server Engine
Write-Host "[BUILD] Building Server Engine..." -ForegroundColor Yellow
npm run electron:build --workspace=apps/server-engine

# B. Build Admin Dashboard
Write-Host "[BUILD] Building Admin Dashboard..." -ForegroundColor Yellow
npm run build:electron --workspace=apps/admin-dashboard

# C. Build PC Client
Write-Host "[BUILD] Building PC Client Kiosk..." -ForegroundColor Yellow
npm run pack --workspace=apps/pc-client

Write-Host "[OK] All applications successfully compiled into unpacked directories." -ForegroundColor Green
Write-Host ""

# ------------------------------------------------------------------------------
# 3. Compile Unified Installer
# ------------------------------------------------------------------------------
Write-Host "[3/3] Compiling NSIS script into Unified Installer..." -ForegroundColor Green

# Navigate to installer directory and run compiler
Push-Location apps/installer
& $nsisPath setup.nsi
Pop-Location

$installerFile = "apps/installer/YP-Arena-OS-Unified-Installer.exe"
if (Test-Path $installerFile) {
    Write-Host "=======================================================================" -ForegroundColor Green
    Write-Host "             COMPILATION SUCCESSFUL!" -ForegroundColor Green
    Write-Host "=======================================================================" -ForegroundColor Green
    Write-Host "Unified Installer generated at:" -ForegroundColor Gray
    Write-Host "Path: $(Resolve-Path $installerFile)" -ForegroundColor Green
} else {
    Write-Error "ERROR: Compilation finished but the installer executable was not found."
}

Write-Host ""
Read-Host "Press Enter to exit..."
