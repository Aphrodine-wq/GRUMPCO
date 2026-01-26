@echo off
setlocal enabledelayedexpansion

:: Enable ANSI escape sequences
for /F %%a in ('echo prompt $E ^| cmd') do set "ESC=%%a"

:menu
cls
echo.
echo    %ESC%[94m ___  ___                         _     _    %ESC%[0m
echo    %ESC%[94m ^|  \/  ^|                        (_)   ^| ^|   %ESC%[0m
echo    %ESC%[94m ^| .  . ^| ___ _ __ _ __ ___   __ _ _  __^| ^|  %ESC%[0m
echo    %ESC%[94m ^| ^|\/^| ^|/ _ \ '__^| '_ ` _ \ / _` ^| ^|/ _` ^|  %ESC%[0m
echo    %ESC%[94m ^| ^|  ^| ^|  __/ ^|  ^| ^| ^| ^| ^| ^| (_^| ^| ^| (_^| ^|  %ESC%[0m
echo    %ESC%[94m \_^|  ^|_/\___^|_^|  ^|_^| ^|_^| ^|_^|\__,_^|_^|\__,_^|  %ESC%[0m
echo.
echo    %ESC%[96m    ___  _____   ___  ___                     %ESC%[0m
echo    %ESC%[96m   / _ \^|_   _^| / _ \ ^|  \/  ^|                %ESC%[0m
echo    %ESC%[96m  / /_\ \ ^| ^|  / /_\ \^| .  . ^|                %ESC%[0m
echo    %ESC%[96m  ^|  _  ^| ^| ^|  ^|  _  ^|^| ^|\/^| ^|                %ESC%[0m
echo    %ESC%[96m  ^| ^| ^| ^|_^| ^|_ ^| ^| ^| ^|^| ^|  ^| ^|                %ESC%[0m
echo    %ESC%[96m  \_^| ^|_/\___/ \_^| ^|_/\_^|  ^|_/                %ESC%[0m
echo.
echo    %ESC%[90m========================================%ESC%[0m
echo    %ESC%[97m   AI-Powered Diagram Generator%ESC%[0m
echo    %ESC%[90m========================================%ESC%[0m
echo.
echo    %ESC%[93mChoose launch mode:%ESC%[0m
echo.
echo      %ESC%[92m1)%ESC%[0m %ESC%[97mWeb Mode%ESC%[0m      %ESC%[90m- Browser (localhost:5173)%ESC%[0m
echo      %ESC%[92m2)%ESC%[0m %ESC%[97mTauri Mode%ESC%[0m    %ESC%[90m- Desktop application%ESC%[0m
echo      %ESC%[92m3)%ESC%[0m %ESC%[97mBoth Modes%ESC%[0m    %ESC%[90m- Web + Desktop%ESC%[0m
echo      %ESC%[92m4)%ESC%[0m %ESC%[97mBackend Only%ESC%[0m  %ESC%[90m- API server only%ESC%[0m
echo      %ESC%[91m5)%ESC%[0m %ESC%[97mExit%ESC%[0m
echo.
echo    %ESC%[90m----------------------------------------%ESC%[0m
echo    %ESC%[90mBackend auto-starts with options 1-3.%ESC%[0m
echo.

choice /c 12345 /n /m "    Enter choice (1-5): "
set CHOICE=%errorlevel%

if %CHOICE%==5 goto :exit
if %CHOICE%==4 goto :backend_only
if %CHOICE%==3 goto :both_modes
if %CHOICE%==2 goto :tauri_mode
if %CHOICE%==1 goto :web_mode

:web_mode
echo.
echo    %ESC%[96m[%time%]%ESC%[0m %ESC%[97mStarting Web Mode...%ESC%[0m
echo.

echo    %ESC%[96m[%time%]%ESC%[0m Building backend...
cd /d "%~dp0backend"
call npm run build >nul 2>&1
if errorlevel 1 (
    echo    %ESC%[91m[ERROR]%ESC%[0m Backend build failed!
    pause
    goto :menu
)
echo    %ESC%[92m[OK]%ESC%[0m Backend built successfully
cd /d "%~dp0"

echo    %ESC%[96m[%time%]%ESC%[0m Starting backend server...
start "Backend Server" cmd /k "cd /d "%~dp0backend" && npm run dev"

echo    %ESC%[96m[%time%]%ESC%[0m Waiting for backend to initialize...
timeout /t 3 /nobreak > nul

echo    %ESC%[96m[%time%]%ESC%[0m Starting frontend dev server...
start "Frontend Server" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo    %ESC%[90m========================================%ESC%[0m
echo    %ESC%[92m   Services Started Successfully!%ESC%[0m
echo    %ESC%[90m========================================%ESC%[0m
echo.
echo      %ESC%[97mBackend:%ESC%[0m  %ESC%[96mhttp://localhost:3000%ESC%[0m
echo      %ESC%[97mFrontend:%ESC%[0m %ESC%[96mhttp://localhost:5173%ESC%[0m
echo.
echo    %ESC%[90mClose the server windows to stop services.%ESC%[0m
echo.
pause
goto :menu

:tauri_mode
echo.
echo    %ESC%[96m[%time%]%ESC%[0m %ESC%[97mStarting Tauri Mode...%ESC%[0m
echo.

echo    %ESC%[96m[%time%]%ESC%[0m Building backend...
cd /d "%~dp0backend"
call npm run build >nul 2>&1
if errorlevel 1 (
    echo    %ESC%[91m[ERROR]%ESC%[0m Backend build failed!
    pause
    goto :menu
)
echo    %ESC%[92m[OK]%ESC%[0m Backend built successfully
cd /d "%~dp0"

echo    %ESC%[96m[%time%]%ESC%[0m Starting backend server...
start "Backend Server" cmd /k "cd /d "%~dp0backend" && npm run dev"

echo    %ESC%[96m[%time%]%ESC%[0m Waiting for backend to initialize...
timeout /t 3 /nobreak > nul

echo    %ESC%[96m[%time%]%ESC%[0m Launching Tauri desktop app...
start "Tauri App" cmd /k "cd /d "%~dp0frontend" && npm run tauri:dev"

echo.
echo    %ESC%[90m========================================%ESC%[0m
echo    %ESC%[92m   Services Started Successfully!%ESC%[0m
echo    %ESC%[90m========================================%ESC%[0m
echo.
echo      %ESC%[97mBackend:%ESC%[0m %ESC%[96mhttp://localhost:3000%ESC%[0m
echo      %ESC%[97mDesktop:%ESC%[0m %ESC%[93mTauri window launching...%ESC%[0m
echo.
echo    %ESC%[90mClose the server windows to stop services.%ESC%[0m
echo.
pause
goto :menu

:both_modes
echo.
echo    %ESC%[96m[%time%]%ESC%[0m %ESC%[97mStarting Both Modes...%ESC%[0m
echo.

echo    %ESC%[96m[%time%]%ESC%[0m Building backend...
cd /d "%~dp0backend"
call npm run build >nul 2>&1
if errorlevel 1 (
    echo    %ESC%[91m[ERROR]%ESC%[0m Backend build failed!
    pause
    goto :menu
)
echo    %ESC%[92m[OK]%ESC%[0m Backend built successfully
cd /d "%~dp0"

echo    %ESC%[96m[%time%]%ESC%[0m Starting backend server...
start "Backend Server" cmd /k "cd /d "%~dp0backend" && npm run dev"

echo    %ESC%[96m[%time%]%ESC%[0m Waiting for backend to initialize...
timeout /t 3 /nobreak > nul

echo    %ESC%[96m[%time%]%ESC%[0m Starting frontend dev server...
start "Frontend Server" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo    %ESC%[96m[%time%]%ESC%[0m Waiting for frontend to initialize...
timeout /t 2 /nobreak > nul

echo    %ESC%[96m[%time%]%ESC%[0m Launching Tauri desktop app...
start "Tauri App" cmd /k "cd /d "%~dp0frontend" && npm run tauri:dev"

echo.
echo    %ESC%[90m========================================%ESC%[0m
echo    %ESC%[92m   All Services Started Successfully!%ESC%[0m
echo    %ESC%[90m========================================%ESC%[0m
echo.
echo      %ESC%[97mBackend:%ESC%[0m  %ESC%[96mhttp://localhost:3000%ESC%[0m
echo      %ESC%[97mFrontend:%ESC%[0m %ESC%[96mhttp://localhost:5173%ESC%[0m
echo      %ESC%[97mDesktop:%ESC%[0m  %ESC%[93mTauri window launching...%ESC%[0m
echo.
echo    %ESC%[90mClose the server windows to stop services.%ESC%[0m
echo.
pause
goto :menu

:backend_only
echo.
echo    %ESC%[96m[%time%]%ESC%[0m %ESC%[97mStarting Backend Only...%ESC%[0m
echo.

echo    %ESC%[96m[%time%]%ESC%[0m Building backend...
cd /d "%~dp0backend"
call npm run build >nul 2>&1
if errorlevel 1 (
    echo    %ESC%[91m[ERROR]%ESC%[0m Backend build failed!
    pause
    goto :menu
)
echo    %ESC%[92m[OK]%ESC%[0m Backend built successfully

echo.
echo    %ESC%[97mBackend server starting on %ESC%[96mhttp://localhost:3000%ESC%[0m
echo    %ESC%[90mPress Ctrl+C to stop the server.%ESC%[0m
echo.
npm run dev
goto :menu

:exit
echo.
echo    %ESC%[93mGoodbye!%ESC%[0m %ESC%[90mThanks for using Mermaid AI.%ESC%[0m
echo.
exit /b 0
