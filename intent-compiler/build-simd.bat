@echo off
REM Build intent compiler with SIMD optimizations (Windows).
REM No /proc/cpuinfo; use native target. For explicit AVX2/AVX-512, set
REM RUSTFLAGS="-C target-cpu=haswell" or skylake-avx512 before running.

setlocal
echo Building with SIMD optimizations...

if not defined RUSTFLAGS (
    echo Using target-cpu=native
    set "RUSTFLAGS=-C target-cpu=native"
)

cd /d "%~dp0"
cargo build --release
if errorlevel 1 exit /b 1

echo Build complete!
echo Binary: target\release\grump-intent.exe
dir target\release\grump-intent.exe

echo.
echo Testing binary...
echo Build a todo app| target\release\grump-intent.exe
exit /b 0
