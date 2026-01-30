@echo off
REM Vercel Deployment Setup Script for Windows
REM This script helps set up the required environment for Vercel deployment

echo ================================================
echo G-Rump Vercel Deployment Setup (Windows)
echo ================================================
echo.

REM Check prerequisites
echo Checking prerequisites...

where vercel >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [X] Vercel CLI not found. Install with: npm i -g vercel
    exit /b 1
)
echo [OK] Vercel CLI found

REM Check if logged in
vercel whoami >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [!] Not logged in to Vercel. Please run: vercel login
    exit /b 1
)
echo [OK] Logged in to Vercel

echo.
echo ================================================
echo Required Environment Variables
echo ================================================
echo.
echo You'll need the following:
echo.
echo 1. NVIDIA_NIM_API_KEY or OPENROUTER_API_KEY
echo    NVIDIA NIM: https://build.nvidia.com
echo    OpenRouter: https://openrouter.ai
echo.
echo 2. Supabase Credentials
echo    - Create project at: https://supabase.com
echo    - Run backend/supabase-schema.sql in SQL Editor
echo    - Get URL and Service Role Key from Settings ^> API
echo.
echo 3. QStash Credentials
echo    - Create at: https://upstash.com/qstash
echo    - Get Token and URL
echo.
echo 4. Generate a JOB_WORKER_SECRET
echo    - Any random string
echo.

pause

echo.
echo ================================================
echo Setting Environment Variables
echo ================================================
echo.
echo You'll now be prompted to enter each environment variable.
echo For each prompt, enter the value and press Enter.
echo To skip an optional variable, just press Enter.
echo.

echo --- NVIDIA_NIM_API_KEY (REQUIRED) ---
echo Get from: https://build.nvidia.com
echo Or use OPENROUTER_API_KEY from https://openrouter.ai
call vercel env add NVIDIA_NIM_API_KEY production

echo.
echo --- SUPABASE_URL (REQUIRED) ---
echo Example: https://xxxxx.supabase.co
call vercel env add SUPABASE_URL production

echo.
echo --- SUPABASE_SERVICE_KEY (REQUIRED) ---
echo From Supabase Settings ^> API ^> service_role key
call vercel env add SUPABASE_SERVICE_KEY production

echo.
echo --- QSTASH_TOKEN (REQUIRED) ---
echo From Upstash QStash dashboard
call vercel env add QSTASH_TOKEN production

echo.
echo --- QSTASH_URL (REQUIRED) ---
echo Default: https://qstash.upstash.io/v2/publish/
call vercel env add QSTASH_URL production

echo.
echo --- JOB_WORKER_SECRET (REQUIRED) ---
echo Generate a random secret string
call vercel env add JOB_WORKER_SECRET production

echo.
echo --- PUBLIC_BASE_URL (REQUIRED) ---
echo Your backend URL (e.g., https://your-app.vercel.app)
echo Note: Set this after your first deployment, or update later
call vercel env add PUBLIC_BASE_URL production

echo.
echo Setting default values...
set /p DUMMY="Setting NODE_ENV=production..."
echo production | call vercel env add NODE_ENV production

echo production | call vercel env add SERVERLESS_MODE production

echo poll | call vercel env add EVENTS_MODE production

echo true | call vercel env add BLOCK_SUSPICIOUS_PROMPTS production

echo true | call vercel env add REQUIRE_AUTH_FOR_API production

echo.
echo [OK] Set NODE_ENV=production
echo [OK] Set SERVERLESS_MODE=vercel
echo [OK] Set EVENTS_MODE=poll
echo [OK] Set BLOCK_SUSPICIOUS_PROMPTS=true
echo [OK] Set REQUIRE_AUTH_FOR_API=true

echo.
echo ================================================
echo Setup Complete!
echo ================================================
echo.
echo [OK] Environment variables configured
echo.
echo Next steps:
echo   1. Deploy the backend:
echo      vercel --prod
echo.
echo   2. If you need to update PUBLIC_BASE_URL after deploy:
echo      vercel env add PUBLIC_BASE_URL production
echo.
echo   3. Deploy the frontend (see docs/THINGS_TO_DO.md)
echo.
echo For troubleshooting, see:
echo   - backend/DEPLOY_VERCEL.md
echo   - docs/PRODUCTION_CHECKLIST.md
echo.

pause
