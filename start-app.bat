@echo off
setlocal
set "ROOT=%~dp0"

:: Start backend in its own window
start "G-Rump Backend" cmd /k "cd /d "%ROOT%backend" && npm run dev"

:: Start frontend in its own window
start "G-Rump Frontend" cmd /k "cd /d "%ROOT%frontend" && npm run dev"

:: Optional: start Tauri desktop app in its own window (uncomment to use)
:: start "G-Rump Tauri" cmd /k "cd /d "%ROOT%frontend" && npm run tauri:dev"

echo.
echo   Backend and frontend started in separate windows.
echo   Backend: http://localhost:3000
echo   Frontend: http://localhost:5173
echo   To run the Tauri desktop app, open a new terminal and run: cd frontend ^&^& npm run tauri:dev
echo.
