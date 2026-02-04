@echo off
REM G-Rump Windows 7 Setup Script
REM This script helps set up G-Rump on Windows 7 with necessary compatibility fixes

echo ========================================
echo G-Rump Windows 7 Setup
echo ========================================
echo.

REM Check if running as administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script must be run as Administrator
    echo Right-click and select "Run as administrator"
    pause
    exit /b 1
)

echo [1/6] Checking Node.js version...
node --version >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: Node.js is not installed
    echo Please install Node.js 18.x from https://nodejs.org/
    pause
    exit /b 1
)

REM Check Node.js version (must be 18.x for Windows 7)
for /f "tokens=1,2 delims=." %%a in ('node --version') do (
    set NODE_MAJOR=%%a
    set NODE_MAJOR=!NODE_MAJOR:v=!
)

if %NODE_MAJOR% GTR 18 (
    echo WARNING: Node.js 20+ is not officially supported on Windows 7
    echo Please install Node.js 18.x for best compatibility
    pause
)

echo [2/6] Checking npm...
call npm --version >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: npm is not available
    pause
    exit /b 1
)

echo [3/6] Installing dependencies...
call npm install
if %errorLevel% neq 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)

echo [4/6] Building packages...
call npm run build:packages
if %errorLevel% neq 0 (
    echo ERROR: Failed to build packages
    pause
    exit /b 1
)

echo [5/6] Setting up environment...
if not exist "backend\.env" (
    copy "backend\.env.example" "backend\.env"
    echo Created backend\.env from example
    echo Please edit backend\.env and add your API keys
)

echo [6/6] Windows 7 Compatibility Notes...
echo.
echo IMPORTANT NOTES FOR WINDOWS 7:
echo - The Electron desktop app has limited support on Windows 7
echo - Consider using the CLI or web interface instead
echo - Ensure TLS 1.2 is enabled for API connectivity
echo - Visual C++ 2015-2022 Redistributable is required
echo.

echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo To start G-Rump:
echo   1. Backend:  cd backend ^&^& npm run dev
echo   2. CLI:      npm install -g @g-rump/cli
echo.
echo For Docker (recommended on Windows 7):
echo   docker-compose -f deploy\docker-compose.yml up -d
echo.

pause
