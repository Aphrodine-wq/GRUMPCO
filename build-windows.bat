@echo off
setlocal enabledelayedexpansion

echo.
echo ========================================
echo   G-Rump Windows Build Script
echo ========================================
echo.

:: Check prerequisites
echo [1/5] Checking prerequisites...
where rustc >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Rust not found. Please install Rust from https://rustup.rs/
    pause
    exit /b 1
)

where cargo >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Cargo not found. Please install Rust from https://rustup.rs/
    pause
    exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found. Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo [OK] Prerequisites found
echo.

:: Build intent-compiler
echo [2/5] Building intent-compiler...
cd intent-compiler
cargo build --release --target x86_64-pc-windows-msvc
if errorlevel 1 (
    echo [ERROR] Intent compiler build failed
    cd ..
    pause
    exit /b 1
)
cd ..
echo [OK] Intent compiler built
echo.

:: Build backend bundle
echo [3/5] Building backend bundle...
cd backend
call npm install
if errorlevel 1 (
    echo [ERROR] Backend dependencies installation failed
    cd ..
    pause
    exit /b 1
)

call npm run bundle
if errorlevel 1 (
    echo [ERROR] Backend bundling failed
    cd ..
    pause
    exit /b 1
)
cd ..
echo [OK] Backend bundled
echo.

:: Build frontend
echo [4/5] Building frontend...
cd frontend
call npm install
if errorlevel 1 (
    echo [ERROR] Frontend dependencies installation failed
    cd ..
    pause
    exit /b 1
)

call npm run build
if errorlevel 1 (
    echo [ERROR] Frontend build failed
    cd ..
    pause
    exit /b 1
)
cd ..
echo [OK] Frontend built
echo.

:: Build Tauri app
echo [5/5] Building Tauri app...
cd frontend
call npm run tauri:build
if errorlevel 1 (
    echo [ERROR] Tauri build failed
    cd ..
    pause
    exit /b 1
)
cd ..
echo [OK] Tauri app built
echo.

echo ========================================
echo   Build Complete!
echo ========================================
echo.
echo Installer location:
echo   frontend\src-tauri\target\release\bundle\
echo.
pause
