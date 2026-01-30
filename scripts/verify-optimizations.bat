@echo off
REM Verification script for NVIDIA-level optimizations (Windows)

echo =========================================
echo G-Rump Optimization Verification
echo =========================================
echo.

set PASSED=0
set FAILED=0

REM 1. Check SWC configuration
echo Checking SWC configuration...
if exist backend\.swcrc (
    echo [OK] Backend .swcrc exists
    set /a PASSED+=1
) else (
    echo [FAIL] Backend .swcrc missing
    set /a FAILED+=1
)

if exist frontend\.swcrc (
    echo [OK] Frontend .swcrc exists
    set /a PASSED+=1
) else (
    echo [FAIL] Frontend .swcrc missing
    set /a FAILED+=1
)

if exist packages\cli\.swcrc (
    echo [OK] CLI .swcrc exists
    set /a PASSED+=1
) else (
    echo [FAIL] CLI .swcrc missing
    set /a FAILED+=1
)

REM 2. Check Rust files
echo.
echo Checking Rust optimizations...
if exist intent-compiler\Cargo.toml (
    echo [OK] Cargo.toml exists
    set /a PASSED+=1
) else (
    echo [FAIL] Cargo.toml missing
    set /a FAILED+=1
)

if exist intent-compiler\src\lib.rs (
    echo [OK] Library file exists
    set /a PASSED+=1
) else (
    echo [FAIL] Library file missing
    set /a FAILED+=1
)

REM 3. Check services
echo.
echo Checking services...
if exist backend\src\services\workerPool.ts (
    echo [OK] Worker pool exists
    set /a PASSED+=1
) else (
    echo [FAIL] Worker pool missing
    set /a FAILED+=1
)

if exist backend\src\services\tieredCache.ts (
    echo [OK] Tiered cache exists
    set /a PASSED+=1
) else (
    echo [FAIL] Tiered cache missing
    set /a FAILED+=1
)

if exist backend\src\services\costOptimizer.ts (
    echo [OK] Cost optimizer exists
    set /a PASSED+=1
) else (
    echo [FAIL] Cost optimizer missing
    set /a FAILED+=1
)

if exist backend\src\services\nimAccelerator.ts (
    echo [OK] NIM accelerator exists
    set /a PASSED+=1
) else (
    echo [FAIL] NIM accelerator missing
    set /a FAILED+=1
)

REM 4. Check documentation
echo.
echo Checking documentation...
if exist docs\PERFORMANCE_GUIDE.md (
    echo [OK] Performance guide exists
    set /a PASSED+=1
) else (
    echo [FAIL] Performance guide missing
    set /a FAILED+=1
)

if exist docs\LINUX_SETUP.md (
    echo [OK] Linux setup guide exists
    set /a PASSED+=1
) else (
    echo [FAIL] Linux setup guide missing
    set /a FAILED+=1
)

if exist docs\OPTIMIZATION_SUMMARY.md (
    echo [OK] Optimization summary exists
    set /a PASSED+=1
) else (
    echo [FAIL] Optimization summary missing
    set /a FAILED+=1
)

REM Summary
echo.
echo =========================================
echo Verification Complete
echo =========================================
echo Passed: %PASSED%
echo Failed: %FAILED%
echo.

if %FAILED% EQU 0 (
    echo All optimizations verified successfully!
    echo.
    echo Next steps:
    echo 1. Run 'npm install' in backend, frontend, and packages/cli
    echo 2. Run 'npm run build' to test SWC compilation
    echo 3. Run 'cargo build --release' in intent-compiler
    echo 4. Run benchmarks to verify performance improvements
    exit /b 0
) else (
    echo Some optimizations are missing or incomplete.
    echo Please review the failed checks above.
    exit /b 1
)
