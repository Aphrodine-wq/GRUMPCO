@echo off
set NODE_ENV=development
cd /d "%~dp0frontend"
npm run electron:dev
pause