@echo off
cd /d "%~dp0.."
echo Installing dependencies...
call npm install
echo Building backend...
cd backend
call npm run build
cd ..
echo Starting backend and frontend...
call npm run dev
