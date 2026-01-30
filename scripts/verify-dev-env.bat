@echo off
setlocal enabledelayedexpansion

:: Ensure Node.js 20+ is installed
for /f "delims=v tokens=2" %%A in ('node -v 2^>nul') do set "NODE_VERSION=%%A"
if not defined NODE_VERSION (
  echo ERROR: Node.js is required but not installed or not on PATH.
  exit /b 1
)
for /f "delims=. tokens=1" %%A in ("%NODE_VERSION%") do set "NODE_MAJOR=%%A"
if %NODE_MAJOR% LSS 20 (
  echo ERROR: Node.js 20+ is required; detected version %NODE_VERSION%.
  exit /b 1
)
echo Node.js %NODE_VERSION% detected ✅

:: Ensure npm is available
where npm >nul 2>&1
if errorlevel 1 (
  echo ERROR: npm is missing from PATH.
  exit /b 1
)

:: Ensure Rust toolchain is installed
rustc --version >nul 2>&1
if errorlevel 1 (
  echo ERROR: rustc is not installed or not on PATH. Run rustup install and add the MSVC target if needed.
  exit /b 1
)
cargo --version >nul 2>&1
if errorlevel 1 (
  echo ERROR: cargo is missing from PATH.
  exit /b 1
)
echo Rust toolchain detected ✅

:: Backend env validation
if not exist backend\.env (
  echo WARNING: backend\.env is missing; copy backend\.env.example and add your ANTHROPIC_API_KEY.
else (
  set "FOUND_KEY=false"
  for /f "usebackq tokens=*" %%A in ("backend\.env") do (
    echo %%A | findstr /i "ANTHROPIC_API_KEY" >nul 2>&1 && set "FOUND_KEY=true"
  )
  if /i "%FOUND_KEY%"=="true" (
    echo backend\.env configured ✅
  ) else (
    echo WARNING: backend\.env exists but ANTHROPIC_API_KEY is missing.
  )
)

echo Environment check complete.
exit /b 0
