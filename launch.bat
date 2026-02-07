@echo off
REM ========================================================
REM  G-Rump Launch Script — All-in-One Development Launcher
REM  Auto-detects changes and starts full dev environment
REM ========================================================
title G-Rump Developer Launcher
color 0B
cd /d "%~dp0"

echo.
echo  =============================================
echo   G-RUMP DEVELOPMENT LAUNCHER v2.1
echo  =============================================
echo.

REM --- Node Version Check ---
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH!
    echo         Download: https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%V in ('node -v') do echo [OK] Node.js version: %%V

REM --- NPM available check ---
where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] npm is not available!
    pause
    exit /b 1
)

REM --- Check for .env file ---
if not exist ".env" (
    if exist ".env.example" (
        echo [INFO] Creating .env from .env.example...
        copy ".env.example" ".env" >nul
        echo [WARN] Edit .env with your API keys before usage!
    ) else (
        echo [WARN] No .env file found. Some features may not work.
    )
) else (
    echo [OK] .env found
)

REM --- Install / sync dependencies if needed ---
echo.
echo [1/4] Checking dependencies...
if not exist "node_modules" (
    echo [INFO] Installing root dependencies...
    call npm install
) else (
    echo [OK] Root node_modules exists
)

if not exist "backend\node_modules" (
    echo [INFO] Installing backend dependencies...
    cd backend
    call npm install
    cd ..
) else (
    echo [OK] Backend node_modules exists
)

if not exist "frontend\node_modules" (
    echo [INFO] Installing frontend dependencies...
    cd frontend
    call npm install
    cd ..
) else (
    echo [OK] Frontend node_modules exists
)

REM --- Build backend if no dist ---
echo.
echo [2/4] Checking backend build...
if not exist "backend\dist" (
    echo [INFO] Building backend...
    cd backend
    call npm run build
    cd ..
) else (
    echo [OK] Backend build exists
)

REM --- Select launch mode ---
echo.
echo [3/4] Select launch mode:
echo.
echo   1. Full Dev  (Backend + Frontend browser)
echo   2. Desktop   (Backend + Electron app)
echo   3. Backend   (Backend only)
echo   4. Frontend  (Frontend browser only)
echo.
set /p MODE="Enter choice [1-4, default=1]: "
if "%MODE%"=="" set MODE=1

echo.
echo [4/4] Launching...
echo.

if "%MODE%"=="1" (
    echo Starting FULL DEV mode (Backend + Frontend)...
    echo Press Ctrl+C to stop.
    echo.
    call npm run dev
) else if "%MODE%"=="2" (
    echo Starting DESKTOP mode (Backend + Electron)...
    echo Press Ctrl+C to stop.
    echo.
    start /B "G-Rump Backend" cmd /c "cd /d "%~dp0backend" && npm run dev"
    timeout /t 3 /nobreak >nul
    cd frontend
    call npm run electron:dev
    cd ..
) else if "%MODE%"=="3" (
    echo Starting BACKEND only...
    echo Press Ctrl+C to stop.
    echo.
    cd backend
    call npm run dev
    cd ..
) else if "%MODE%"=="4" (
    echo Starting FRONTEND only (browser)...
    echo Press Ctrl+C to stop.
    echo.
    cd frontend
    call npm run dev
    cd ..
) else (
    echo [ERROR] Invalid choice. Exiting.
    pause
    exit /b 1
)

pause
