@echo off
REM Build WASM module for intent parser (Windows)

echo Building WASM module...

REM Check for wasm-pack
where wasm-pack >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo Installing wasm-pack...
    cargo install wasm-pack
)

REM Build for Node.js
echo Building for Node.js...
wasm-pack build --target nodejs --features wasm --out-dir pkg-node

REM Build for browser
echo Building for browser...
wasm-pack build --target web --features wasm --out-dir pkg-web

REM Build for bundler
echo Building for bundlers...
wasm-pack build --target bundler --features wasm --out-dir pkg-bundler

echo WASM build complete!
echo   - Node.js: pkg-node/
echo   - Browser: pkg-web/
echo   - Bundler: pkg-bundler/
