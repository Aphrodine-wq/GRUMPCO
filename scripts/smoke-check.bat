@echo off
setlocal
:: Smoke-check: backend and frontend dev endpoints must respond.
:: Run from project root after start-app.bat (or with backend + frontend already running).

set BACKEND_URL=http://localhost:3000/health/quick
set FRONTEND_URL=http://localhost:5173/

echo Checking backend %BACKEND_URL% ...
curl -sf "%BACKEND_URL%" >nul 2>&1
if errorlevel 1 (
  echo FAIL: Backend not responding. Is npm run dev running in backend?
  exit /b 1
)
echo   Backend OK

echo Checking frontend %FRONTEND_URL% ...
curl -sf "%FRONTEND_URL%" >nul 2>&1
if errorlevel 1 (
  echo FAIL: Frontend not responding. Is npm run dev running in frontend?
  exit /b 1
)
echo   Frontend OK

echo.
echo Smoke check passed.
exit /b 0
