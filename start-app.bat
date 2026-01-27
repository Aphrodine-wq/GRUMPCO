@echo off
setlocal enabledelayedexpansion
set "ROOT=%~dp0"
title G-Rump Startup

echo.
echo ============================================
echo        G-RUMP Development Server
echo ============================================
echo.

:: Check prerequisites
echo [1/6] Checking prerequisites...

where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found! Please install Node.js 20+ from https://nodejs.org
    pause
    exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] npm not found! Please install Node.js 20+ from https://nodejs.org
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('node -v') do set NODE_VERSION=%%i
echo        Node.js: %NODE_VERSION%

:: Check .env file
echo.
echo [2/6] Checking configuration...

if not exist "%ROOT%backend\.env" (
    echo.
    echo [WARNING] backend\.env not found!
    echo.
    echo To fix this:
    echo   1. Copy backend\.env.example to backend\.env
    echo   2. Add your Anthropic API key
    echo.
    if exist "%ROOT%backend\.env.example" (
        echo Press any key to create .env from template...
        pause >nul
        copy "%ROOT%backend\.env.example" "%ROOT%backend\.env" >nul
        echo Created backend\.env - Please edit it and add your API key!
        echo.
        start notepad "%ROOT%backend\.env"
        echo After adding your API key, run this script again.
        pause
        exit /b 1
    ) else (
        echo No .env.example found either. Please create backend\.env manually.
        pause
        exit /b 1
    )
) else (
    echo        Configuration: OK
)

:: Install backend dependencies if needed
echo.
echo [3/6] Checking backend dependencies...

if not exist "%ROOT%backend\node_modules" (
    echo        Installing backend dependencies...
    cd /d "%ROOT%backend"
    call npm install
    if errorlevel 1 (
        echo [ERROR] Failed to install backend dependencies
        pause
        exit /b 1
    )
) else (
    echo        Backend dependencies: OK
)

:: Install frontend dependencies if needed
echo.
echo [4/6] Checking frontend dependencies...

if not exist "%ROOT%frontend\node_modules" (
    echo        Installing frontend dependencies...
    cd /d "%ROOT%frontend"
    call npm install
    if errorlevel 1 (
        echo [ERROR] Failed to install frontend dependencies
        pause
        exit /b 1
    )
) else (
    echo        Frontend dependencies: OK
)

:: Start backend
echo.
echo [5/6] Starting backend server...
start "G-Rump Backend" cmd /k "cd /d "%ROOT%backend" && npm run dev"

:: Wait for backend health
echo        Waiting for backend to be ready...
set ATTEMPTS=0
:waitbackend
set /a ATTEMPTS+=1
if %ATTEMPTS% gtr 30 (
    echo [ERROR] Backend failed to start within 60 seconds
    echo Check the backend window for errors
    pause
    exit /b 1
)
timeout /t 2 /nobreak >nul
curl -s http://localhost:3000/health >nul 2>&1
if errorlevel 1 (
    echo        Attempt %ATTEMPTS%/30...
    goto waitbackend
)
echo        Backend is ready!

:: Start frontend
echo.
echo [6/6] Starting frontend server...
start "G-Rump Frontend" cmd /k "cd /d "%ROOT%frontend" && npm run dev"

:: Wait for frontend
echo        Waiting for frontend to be ready...
set ATTEMPTS=0
:waitfrontend
set /a ATTEMPTS+=1
if %ATTEMPTS% gtr 30 (
    echo [WARNING] Frontend taking longer than expected...
    echo Opening browser anyway...
    goto openbrowser
)
timeout /t 2 /nobreak >nul
curl -s http://localhost:5173 >nul 2>&1
if errorlevel 1 (
    echo        Attempt %ATTEMPTS%/30...
    goto waitfrontend
)
echo        Frontend is ready!

:openbrowser
echo.
echo ============================================
echo        G-RUMP IS RUNNING!
echo ============================================
echo.
echo   Backend API:    http://localhost:3000
echo   Frontend UI:    http://localhost:5173
echo   Health Check:   http://localhost:3000/health/detailed
echo.
echo   To run Tauri desktop app:
echo     cd frontend ^&^& npm run tauri:dev
echo.
echo ============================================

:: Open browser
start "" http://localhost:5173

echo.
echo Press any key to exit (servers will keep running)...
pause >nul
