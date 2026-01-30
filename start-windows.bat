@echo off
title G-Rump Windows App
color 0D

echo.
echo  ============================================
echo       G-RUMP - AI Development Assistant
echo  ============================================
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH
    echo Please install Node.js 18+ from https://nodejs.org
    pause
    exit /b 1
)

:: Check if Rust/Cargo is installed (required for Tauri)
where cargo >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Rust is not installed or not in PATH
    echo Please install Rust from https://rustup.rs
    pause
    exit /b 1
)

echo [1/3] Installing dependencies...
cd /d "%~dp0"
call npm install >nul 2>nul

echo [2/3] Installing frontend dependencies...
cd frontend
call npm install >nul 2>nul

echo [3/3] Starting G-Rump Windows App...
echo.
echo  The app window will open shortly.
echo  Press Ctrl+C to stop the development server.
echo.

call npm run tauri:dev

pause
