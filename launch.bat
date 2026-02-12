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

REM --- pnpm available check ---
where pnpm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] pnpm is not available!
    echo         Install: npm install -g pnpm
    pause
    exit /b 1
)
for /f "tokens=*" %%V in ('pnpm --version') do echo [OK] pnpm version: %%V

REM --- Check for .env file ---
if not exist "backend\.env" (
    if exist "backend\.env.example" (
        echo [INFO] Creating backend\.env from backend\.env.example...
        copy "backend\.env.example" "backend\.env" >nul
        echo [WARN] Edit backend\.env with your API keys before usage!
    ) else (
        echo [WARN] No backend\.env file found. Some features may not work.
    )
) else (
    echo [OK] backend\.env found
)

REM --- Install / sync dependencies if needed ---
echo.
echo [1/4] Checking dependencies...
if not exist "node_modules" (
    echo [INFO] Installing root dependencies...
    call pnpm install
) else (
    echo [OK] Root node_modules exists
)

if not exist "backend\node_modules" (
    echo [INFO] Installing backend dependencies...
    cd backend
    call pnpm install
    cd ..
) else (
    echo [OK] Backend node_modules exists
)

if not exist "frontend\node_modules" (
    echo [INFO] Installing frontend dependencies...
    cd frontend
    call pnpm install
    cd ..
) else (
    echo [OK] Frontend node_modules exists
)

REM --- Build shared packages if needed ---
echo.
echo [2/4] Checking shared packages build...
if not exist "packages\shared-types\dist" (
    echo [INFO] Building shared packages...
    call pnpm run build:packages
) else (
    echo [OK] Shared packages built
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

if "%MODE%"=="1" goto MODE_FULL
if "%MODE%"=="2" goto MODE_DESKTOP
if "%MODE%"=="3" goto MODE_BACKEND
if "%MODE%"=="4" goto MODE_FRONTEND
goto MODE_INVALID

:MODE_FULL
echo Starting FULL DEV mode (Backend + Frontend)...
echo Press Ctrl+C to stop.
echo.
call pnpm run dev
goto END

:MODE_DESKTOP
echo Starting DESKTOP mode (Backend + Electron)...
echo Press Ctrl+C to stop.
echo.
start /B "G-Rump Backend" cmd /c "cd /d "%~dp0backend" && pnpm run dev"
timeout /t 3 /nobreak >nul
cd frontend
call pnpm run electron:dev
cd ..
goto END

:MODE_BACKEND
echo Starting BACKEND only...
echo Press Ctrl+C to stop.
echo.
cd backend
call pnpm run dev
cd ..
goto END

:MODE_FRONTEND
echo Starting FRONTEND only (browser)...
echo Press Ctrl+C to stop.
echo.
cd frontend
call pnpm run dev
cd ..
goto END

:MODE_INVALID
echo [ERROR] Invalid choice. Exiting.
pause
exit /b 1

:END
pause
