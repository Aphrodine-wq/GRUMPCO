@echo off
setlocal
set "ROOT=%~dp0"
title G-Rump + AgentLightning

echo.
echo ============================================
echo   G-Rump + AgentLightning (Agent Overwatch)
echo ============================================
echo.

where python >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found! Install Python 3.10+ first.
    pause
    exit /b 1
)

if not exist "%ROOT%agentlightning\requirements.txt" (
    echo [ERROR] Missing agentlightning\requirements.txt
    pause
    exit /b 1
)

echo If dependencies are missing, run:
echo   python -m pip install -r "%ROOT%agentlightning\requirements.txt"
echo.

echo Starting AgentLightning store...
start "AgentLightning Store" cmd /k "cd /d "%ROOT%agentlightning" && python -m agentlightning.cli.store --host 0.0.0.0 --port 4747 --cors-origin http://localhost:3000 --cors-origin http://127.0.0.1:3000 --cors-origin http://localhost:5173 --cors-origin http://127.0.0.1:5173 --cors-origin http://localhost:5178 --cors-origin http://127.0.0.1:5178"

echo.
echo Starting G-Rump stack with OTLP tracing enabled...
set "OTLP_ENDPOINT=http://localhost:4747"
set "AGENTLIGHTNING_ENABLED=1"
call "%ROOT%start-app.bat"
