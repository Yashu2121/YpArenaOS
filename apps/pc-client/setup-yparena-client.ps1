# ==============================================================================
# YP Arena OS: Gaming PC Client Setup & Configuration Automation
# ==============================================================================
# This script automates the terminal client configuration: opens UDP ports for auto-discovery
# and registers the client launcher script to execute on Windows boot.
# ==============================================================================

# Ensure script is running with Admin privileges
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Error "ERROR: This script must be run as Administrator!"
    Write-Host "Please close this shell, right-click PowerShell, and select 'Run as Administrator'." -ForegroundColor Yellow
    Read-Host "Press Enter to exit..."
    Exit
}

Clear-Host
Write-Host "=======================================================================" -ForegroundColor Cyan
Write-Host "         YP ARENA OS - GAMING TERMINAL CLIENT AUTO-SETUP" -ForegroundColor Cyan
Write-Host "=======================================================================" -ForegroundColor Cyan
Write-Host ""

# ------------------------------------------------------------------------------
# 1. Configure Windows Firewall
# ------------------------------------------------------------------------------
Write-Host "[1/2] Opening UDP Port 41234 in Windows Firewall..." -ForegroundColor Green

$ruleUdpName = "YP Arena OS Client Auto-Discovery (UDP)"
Remove-NetFirewallRule -DisplayName $ruleUdpName -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName $ruleUdpName -Direction Inbound -Action Allow -Protocol UDP -LocalPort 41234 | Out-Null

Write-Host "[OK] Inbound firewall rule added to allow UDP broadcast listeners on Port 41234." -ForegroundColor Clean
Write-Host ""

# ------------------------------------------------------------------------------
# 2. Windows Startup Automation Setup
# ------------------------------------------------------------------------------
Write-Host "[2/2] Establishing Windows boot/startup launcher automation..." -ForegroundColor Green

# Create startup execution batch script
$batContent = @"
@echo off
cd /d "%~dp0"
title YP Arena OS Client Kiosk
echo Booting YP Arena OS Secure Client Kiosk...

REM 1. Look for client in standard production installation path
if exist "%ProgramFiles64%\YP Arena OS\Client\YP Arena OS Client.exe" (
    start "" "%ProgramFiles64%\YP Arena OS\Client\YP Arena OS Client.exe"
    exit
)

REM 2. Look for unpacked development build
if exist "release-builds\win-unpacked\YP Arena OS Client.exe" (
    start "" "release-builds\win-unpacked\YP Arena OS Client.exe"
    exit
)

REM 3. Fallback to npm dev environment
echo Dev build detected, launching via Electron npm client...
npm start
"@

Set-Content -Path "run-pc-client.bat" -Value $batContent -Encoding utf8
Write-Host "[OK] Created run-pc-client.bat launcher." -ForegroundColor Clean

# Create Windows Startup folder shortcut
$startupFolder = [System.IO.Path]::Combine($env:APPDATA, "Microsoft\Windows\Start Menu\Programs\Startup")
$shortcutPath = Join-Path $startupFolder "YPArenaOSClient.lnk"

try {
    $wshShell = New-Object -ComObject WScript.Shell
    $shortcut = $wshShell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = Join-Path (Get-Location).Path "run-pc-client.bat"
    $shortcut.WorkingDirectory = (Get-Location).Path
    $shortcut.Description = "Auto-launch YP Arena OS Secure Kiosk Client on boot"
    $shortcut.Save()
    Write-Host "[OK] Registered Kiosk auto-launch shortcut in Windows Startup folder." -ForegroundColor Clean
} catch {
    Write-Host "WARNING: Failed to register Windows Startup shortcut. Please copy run-pc-client.bat to shell:startup manually." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=======================================================================" -ForegroundColor Green
Write-Host "               CLIENT AUTO-SETUP COMPLETED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "=======================================================================" -ForegroundColor Green
Write-Host "The Client is fully configured to discover your Master Server over UDP."
Write-Host ""
Read-Host "Press Enter to exit..."
