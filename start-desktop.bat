@echo off
REM Quick launcher — starts Backend + Electron Desktop app
REM For more options, use launch.bat instead
title G-Rump Desktop
cd /d "%~dp0"

REM Check dependencies
if not exist "node_modules" call npm install
if not exist "backend\node_modules" ( cd backend && call npm install && cd .. )
if not exist "frontend\node_modules" ( cd frontend && call npm install && cd .. )

REM Build backend if needed
if not exist "backend\dist" ( cd backend && call npm run build && cd .. )

echo Starting G-Rump Desktop...
echo.

REM Start backend in background
start /B "G-Rump Backend" cmd /c "cd /d "%~dp0backend" && npm run dev"

REM Wait for backend to be ready
timeout /t 3 /nobreak >nul

REM Start Electron
cd frontend
call npm run electron:dev
cd ..

pause