@echo off
setlocal enabledelayedexpansion

echo ========================================
echo Node.js Unattended Installer for Windows
echo ========================================
echo.

:: Check if running as Administrator
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo WARNING: This script is not running as Administrator.
    echo Some installations may require elevated privileges.
    echo.
    echo To run as Administrator:
    echo 1. Right-click this file
    echo 2. Select "Run as administrator"
    echo.
    pause
)

:: Check if Node.js is already installed
node --version >nul 2>&1
if %errorlevel% equ 0 (
    echo Node.js is already installed:
    node --version
    npm --version
    echo.
    echo Installation skipped.
    pause
    exit /b 0
)

:: Set variables
set "NODE_VERSION=20.11.1"
set "NODE_ARCH=x64"
set "DOWNLOAD_URL=https://nodejs.org/dist/v%NODE_VERSION%/node-v%NODE_VERSION%-win-%NODE_ARCH%.msi"
set "INSTALLER_PATH=%TEMP%\nodejs-installer.msi"

echo Installing Node.js v%NODE_VERSION% (%NODE_ARCH%)...
echo Download URL: %DOWNLOAD_URL%
echo.

:: Create temp directory if it doesn't exist
if not exist "%TEMP%" mkdir "%TEMP%"

:: Check if PowerShell is available
powershell -Command "Get-Host" >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: PowerShell is not available on this system.
    echo Please install PowerShell or use a different download method.
    pause
    exit /b 1
)

:: Download Node.js installer using PowerShell with bypass execution policy
echo Downloading Node.js installer...
powershell -ExecutionPolicy Bypass -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; try { Invoke-WebRequest -Uri '%DOWNLOAD_URL%' -OutFile '%INSTALLER_PATH%' -UseBasicParsing -TimeoutSec 300; Write-Host 'Download completed successfully' } catch { Write-Host 'Download failed: ' + $_.Exception.Message; exit 1 }}"

if not exist "%INSTALLER_PATH%" (
    echo ERROR: Failed to download Node.js installer.
    echo.
    echo Possible solutions:
    echo 1. Check your internet connection
    echo 2. Try running as Administrator
    echo 3. Disable antivirus temporarily
    echo 4. Use a different network
    echo.
    echo You can also download manually from: %DOWNLOAD_URL%
    pause
    exit /b 1
)

echo Download completed: %INSTALLER_PATH%
echo File size: 
dir "%INSTALLER_PATH%" | find "nodejs-installer.msi"
echo.

:: Check if msiexec is available
msiexec /? >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: msiexec is not available on this system.
    echo This may indicate a Windows installation issue.
    pause
    exit /b 1
)

:: Install Node.js silently
echo Installing Node.js (this may take a few minutes)...
echo Please wait and do not close this window...
msiexec /i "%INSTALLER_PATH%" /quiet /norestart /log "%TEMP%\nodejs-install.log" ADDLOCAL=ALL

:: Wait for installation to complete
echo Waiting for installation to complete...
timeout /t 45 /nobreak >nul

:: Refresh environment variables
echo Refreshing environment variables...
call refreshenv >nul 2>&1

:: Check if installation was successful
node --version >nul 2>&1
if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo Node.js installation completed successfully!
    echo ========================================
    echo.
    echo Installed versions:
    node --version
    npm --version
    echo.
    echo Installation log: %TEMP%\nodejs-install.log
    echo.
    echo You can now run Node.js scripts.
    echo.
) else (
    echo.
    echo ========================================
    echo Node.js installation may have failed.
    echo ========================================
    echo.
    echo Please check the installation log: %TEMP%\nodejs-install.log
    echo.
    echo Troubleshooting steps:
    echo 1. Restart your computer and try again
    echo 2. Run this script as Administrator
    echo 3. Temporarily disable antivirus software
    echo 4. Check Windows Event Viewer for errors
    echo 5. Try downloading Node.js manually from nodejs.org
    echo.
    echo Manual installation:
    echo 1. Go to https://nodejs.org/
    echo 2. Download the LTS version
    echo 3. Run the installer manually
    echo.
)

:: Clean up installer
if exist "%INSTALLER_PATH%" (
    echo Cleaning up installer file...
    del "%INSTALLER_PATH%"
    echo Cleanup completed.
)

echo.
echo Press any key to exit...
pause >nul
