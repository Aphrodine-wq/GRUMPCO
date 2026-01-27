@echo off
setlocal
set "ROOT=%~dp0"
set "DASH=%ROOT%systems-dashboard.html"

:: Start G-Rump (backend + frontend + Tauri) in a separate window
:: Use full path so the new cmd finds start-app.bat regardless of working dir
start "G-Rump Services" cmd /k call "%~dp0start-app.bat"

:: Wait for services to come up before opening dashboard
echo.
echo   Waiting for services to start...
timeout /t 12 /nobreak >nul

:: Open systems dashboard in default browser
start "" "%DASH%"
echo.
echo   Systems dashboard opened in your browser.
echo   Backend, frontend, and Tauri run in the "G-Rump Services" window.
echo.
pause
