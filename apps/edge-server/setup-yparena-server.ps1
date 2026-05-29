# ==============================================================================
# YP Arena OS: Local Café Master Server Setup & Configuration Automation
# ==============================================================================
# This script automates the installation and configuration of the local Edge Server.
# It checks for Admin rights, installs PostgreSQL, runs migrations, creates .env,
# configures local firewall rules, and sets up startup automation.
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
Write-Host "         YP ARENA OS - LOCAL CAFÉ MASTER SERVER AUTO-SETUP" -ForegroundColor Cyan
Write-Host "=======================================================================" -ForegroundColor Cyan
Write-Host ""

# ------------------------------------------------------------------------------
# 1. Interactive Configurations
# ------------------------------------------------------------------------------
Write-Host "[1/6] Configuration Parameters" -ForegroundColor Green

$licenseKey = Read-Host "Enter your YP Arena OS subscription License Key"
while (-not $licenseKey) {
    Write-Host "License Key is required to run the Edge Server!" -ForegroundColor Red
    $licenseKey = Read-Host "Enter your YP Arena OS subscription License Key"
}

$cafeName = Read-Host "Enter your Café / Gamezone Name (default: 'YP Arena Gaming Zone')"
if (-not $cafeName) { $cafeName = "YP Arena Gaming Zone" }

$dbHost = Read-Host "PostgreSQL Database Host (default: 'localhost')"
if (-not $dbHost) { $dbHost = "localhost" }

$dbPort = Read-Host "PostgreSQL Database Port (default: '5432')"
if (-not $dbPort) { $dbPort = "5432" }

$dbUser = Read-Host "PostgreSQL Database Username (default: 'postgres')"
if (-not $dbUser) { $dbUser = "postgres" }

$dbPassword = Read-Host "PostgreSQL Database Password (default: 'postgres')"
if (-not $dbPassword) { $dbPassword = "postgres" }

$dbName = Read-Host "PostgreSQL Database Name to create/use (default: 'yparenaos')"
if (-not $dbName) { $dbName = "yparenaos" }

$edgePort = Read-Host "Local Edge Server Port to run on (default: '4000')"
if (-not $edgePort) { $edgePort = "4000" }

$saasUrl = Read-Host "Cloud SaaS Server URL (default: 'https://api.yparenaos.com')"
if (-not $saasUrl) { $saasUrl = "https://api.yparenaos.com" }

Write-Host ""

# ------------------------------------------------------------------------------
# 2. Automated PostgreSQL Check & Silent Installation
# ------------------------------------------------------------------------------
Write-Host "[2/6] Checking local database dependencies..." -ForegroundColor Green
$pgService = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue

if (-not $pgService) {
    Write-Host "PostgreSQL not detected on this system. Launching silent installation via winget..." -ForegroundColor Yellow
    
    # Run winget installer
    & winget install --id PostgreSQL.PostgreSQL --silent --accept-package-agreements --accept-source-agreements
    
    Write-Host "Waiting for silent database installer to complete (this might take 20-30 seconds)..." -ForegroundColor Yellow
    Start-Sleep -Seconds 20

    # Recheck service
    $pgService = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue
    if (-not $pgService) {
        Write-Host "PostgreSQL installer started in background. Please wait for installation to finish." -ForegroundColor Cyan
    } else {
        Write-Host "✅ PostgreSQL installed and service started successfully." -ForegroundColor Clean
    }
} else {
    Write-Host "✅ PostgreSQL database service is already running." -ForegroundColor Clean
}

Write-Host ""

# ------------------------------------------------------------------------------
# 3. Database Initialization & Schema Import
# ------------------------------------------------------------------------------
Write-Host "[3/6] Initializing PostgreSQL database and schemas..." -ForegroundColor Green

# Locating psql.exe
$psqlPath = Get-ChildItem -Path "C:\Program Files\PostgreSQL" -Filter "psql.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName
if (-not $psqlPath) {
    $psqlPath = "psql" # Fallback to system environment path
}

Write-Host "Using database command client: $psqlPath" -ForegroundColor DarkGray

$env:PGPASSWORD = $dbPassword
$env:PGUSER = $dbUser

# Check if db exists, create if missing
Write-Host "Checking database existence..." -ForegroundColor DarkGray
$dbCheck = & $psqlPath -h $dbHost -p $dbPort -U $dbUser -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$dbName'" 2>$null

if ($dbCheck -ne "1") {
    Write-Host "Database '$dbName' does not exist. Creating database..." -ForegroundColor Yellow
    & $psqlPath -h $dbHost -p $dbPort -U $dbUser -d postgres -c "CREATE DATABASE $dbName;" 2>&1
} else {
    Write-Host "[OK] Database '$dbName' already exists." -ForegroundColor Clean
}

# Run Schema migrations
Write-Host "Running database migrations on '$dbName' from schema.sql..." -ForegroundColor Yellow
if (Test-Path "schema.sql") {
    & $psqlPath -h $dbHost -p $dbPort -U $dbUser -d $dbName -f "schema.sql" 2>&1
    Write-Host "[OK] Database schema loaded successfully." -ForegroundColor Clean
} else {
    Write-Host "WARNING: schema.sql was not found in the current directory. Skipping database schema import." -ForegroundColor Yellow
}

Write-Host ""

# ------------------------------------------------------------------------------
# 4. Generate Configurations
# ------------------------------------------------------------------------------
Write-Host "[4/6] Creating config files (.env and license.key)..." -ForegroundColor Green

# Generate .env configuration
$envContent = @"
DB_HOST=$dbHost
DB_PORT=$dbPort
DB_NAME=$dbName
DB_USER=$dbUser
DB_PASSWORD=$dbPassword
JWT_SECRET=yparenaos_super_secret_jwt_key_2024
PORT=$edgePort
SAAS_SERVER_URL=$saasUrl
"@

Set-Content -Path ".env" -Value $envContent -Encoding utf8
Write-Host "[OK] Generated local configuration file: apps/edge-server/.env" -ForegroundColor Clean

# Generate license.key
Set-Content -Path "license.key" -Value $licenseKey -Encoding utf8
Write-Host "[OK] Generated license file: apps/edge-server/license.key" -ForegroundColor Clean

Write-Host ""

# ------------------------------------------------------------------------------
# 5. Open Local Firewall Ports
# ------------------------------------------------------------------------------
Write-Host "[5/6] Auto-configuring Windows Defender Firewall rules..." -ForegroundColor Green

# Open Edge API TCP Port
$ruleTcpName = "YP Arena OS Edge Server (TCP)"
Remove-NetFirewallRule -DisplayName $ruleTcpName -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName $ruleTcpName -Direction Inbound -Action Allow -Protocol TCP -LocalPort $edgePort | Out-Null
Write-Host "[OK] Inbound TCP Rule added for Local Server communication (Port $edgePort)" -ForegroundColor Clean

# Open UDP Discovery Port
$ruleUdpName = "YP Arena OS Auto-Discovery (UDP)"
Remove-NetFirewallRule -DisplayName $ruleUdpName -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName $ruleUdpName -Direction Inbound -Action Allow -Protocol UDP -LocalPort 41234 | Out-Null
Write-Host "[OK] Inbound UDP Rule added for terminal auto-discovery beacon (Port 41234)" -ForegroundColor Clean

Write-Host ""

# ------------------------------------------------------------------------------
# 6. Windows Startup Automation Setup
# ------------------------------------------------------------------------------
Write-Host "[6/6] Establishing Windows boot/startup automation..." -ForegroundColor Green

# Create startup execution batch script
$batContent = @"
@echo off
cd /d "%~dp0"
title YP Arena OS Edge Server
echo Starting YP Arena OS Local Master Edge Server Daemon...
node index.js
pause
"@

Set-Content -Path "run-edge-server.bat" -Value $batContent -Encoding utf8
Write-Host "[OK] Created run-edge-server.bat launcher." -ForegroundColor Clean

# Create Windows Startup folder shortcut
$startupFolder = [System.IO.Path]::Combine($env:APPDATA, "Microsoft\Windows\Start Menu\Programs\Startup")
$shortcutPath = Join-Path $startupFolder "YPArenaOSEdgeServer.lnk"

try {
    $wshShell = New-Object -ComObject WScript.Shell
    $shortcut = $wshShell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = Join-Path (Get-Location).Path "run-edge-server.bat"
    $shortcut.WorkingDirectory = (Get-Location).Path
    $shortcut.Description = "Auto-launch YP Arena OS local Master Edge Server on startup"
    $shortcut.Save()
    Write-Host "[OK] Added Edge Server auto-launch shortcut to Windows Startup folder." -ForegroundColor Clean
} catch {
    Write-Host "WARNING: Failed to register Windows Startup shortcut. Please add run-edge-server.bat to startup manually." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=======================================================================" -ForegroundColor Green
Write-Host "               AUTO-SETUP COMPLETED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "=======================================================================" -ForegroundColor Green
Write-Host "Please start the server by running run-edge-server.bat, or reboot your PC."
Write-Host ""
Read-Host "Press Enter to exit..."
