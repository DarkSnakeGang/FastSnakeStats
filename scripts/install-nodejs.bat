@echo off
setlocal enabledelayedexpansion

echo ========================================
echo Node.js Unattended Installer for Windows
echo ========================================
echo.

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

:: Download Node.js installer
echo Downloading Node.js installer...
powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%DOWNLOAD_URL%' -OutFile '%INSTALLER_PATH%' -UseBasicParsing}"

if not exist "%INSTALLER_PATH%" (
    echo ERROR: Failed to download Node.js installer.
    echo Please check your internet connection and try again.
    pause
    exit /b 1
)

echo Download completed: %INSTALLER_PATH%
echo.

:: Install Node.js silently
echo Installing Node.js (this may take a few minutes)...
msiexec /i "%INSTALLER_PATH%" /quiet /norestart /log "%TEMP%\nodejs-install.log"

:: Wait for installation to complete
echo Waiting for installation to complete...
timeout /t 30 /nobreak >nul

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
    echo You may need to:
    echo 1. Restart your computer
    echo 2. Run this script as Administrator
    echo 3. Check your antivirus software
    echo.
)

:: Clean up installer
if exist "%INSTALLER_PATH%" (
    echo Cleaning up installer file...
    del "%INSTALLER_PATH%"
)

echo.
echo Press any key to exit...
pause >nul
