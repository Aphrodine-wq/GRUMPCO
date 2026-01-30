#!/bin/bash
# Verification script for NVIDIA-level optimizations

set -e

echo "========================================="
echo "G-Rump Optimization Verification"
echo "========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASSED=0
FAILED=0

check() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $1"
        ((PASSED++))
    else
        echo -e "${RED}✗${NC} $1"
        ((FAILED++))
    fi
}

# 1. Check SWC configuration
echo "Checking SWC configuration..."
test -f backend/.swcrc && check "Backend .swcrc exists"
test -f frontend/.swcrc && check "Frontend .swcrc exists"
test -f packages/cli/.swcrc && check "CLI .swcrc exists"

# 2. Check Rust optimizations
echo ""
echo "Checking Rust optimizations..."
test -f intent-compiler/Cargo.toml && check "Cargo.toml exists"
grep -q "opt-level = 3" intent-compiler/Cargo.toml && check "Optimization level 3 enabled"
grep -q "lto = \"fat\"" intent-compiler/Cargo.toml && check "LTO enabled"
grep -q "rayon" intent-compiler/Cargo.toml && check "Rayon dependency added"
grep -q "mimalloc" intent-compiler/Cargo.toml && check "mimalloc dependency added"

# 3. Check WASM support
echo ""
echo "Checking WASM support..."
test -f intent-compiler/src/lib.rs && check "Library file exists"
grep -q "wasm-bindgen" intent-compiler/Cargo.toml && check "wasm-bindgen dependency added"
test -f intent-compiler/build-wasm.sh && check "WASM build script exists"
test -f backend/src/services/intentParserWasm.ts && check "WASM integration exists"

# 4. Check worker threads
echo ""
echo "Checking worker thread pool..."
test -f backend/src/services/workerPool.ts && check "Worker pool service exists"
test -f backend/src/workers/cpuBoundWorker.ts && check "CPU-bound worker exists"
test -f backend/src/workers/cpuBoundWorker.js && check "Compiled worker exists"

# 5. Check tiered cache
echo ""
echo "Checking tiered cache..."
test -f backend/src/services/tieredCache.ts && check "Tiered cache service exists"
grep -q "LRUCache" backend/src/services/tieredCache.ts && check "L1 cache implemented"
grep -q "Redis" backend/src/services/tieredCache.ts && check "L2 cache implemented"
grep -q "fs.readFile" backend/src/services/tieredCache.ts && check "L3 cache implemented"

# 6. Check cost optimization
echo ""
echo "Checking cost optimization..."
test -f backend/src/services/costOptimizer.ts && check "Cost optimizer exists"
test -f backend/src/services/costAnalytics.ts && check "Cost analytics exists"
test -f backend/src/services/batchProcessor.ts && check "Batch processor exists"

# 7. Check NIM integration
echo ""
echo "Checking NVIDIA NIM integration..."
test -f backend/src/services/nimAccelerator.ts && check "NIM accelerator exists"
grep -q "GPU" backend/src/services/nimAccelerator.ts && check "GPU support implemented"

# 8. Check SIMD
echo ""
echo "Checking SIMD optimizations..."
test -f intent-compiler/src/simd_parser.rs && check "SIMD parser exists"
grep -q "avx2" intent-compiler/src/simd_parser.rs && check "AVX2 support implemented"
test -f intent-compiler/build-simd.sh && check "SIMD build script exists"

# 9. Check Docker optimizations
echo ""
echo "Checking Docker optimizations..."
test -f backend/Dockerfile && check "Backend Dockerfile exists"
grep -q "BuildKit" backend/Dockerfile && check "BuildKit syntax enabled"
grep -q "cache" backend/Dockerfile && check "Cache mounts configured"
test -f backend/.dockerignore && check ".dockerignore exists"
test -f docker-compose.yml && check "docker-compose.yml exists"

# 10. Check Linux setup
echo ""
echo "Checking Linux setup..."
test -f docs/LINUX_SETUP.md && check "Linux setup guide exists"
test -f scripts/setup-wsl2.sh && check "WSL2 setup script exists"

# 11. Check metrics
echo ""
echo "Checking metrics..."
grep -q "llm_cost_usd_total" backend/src/middleware/metrics.ts && check "Cost metrics added"
grep -q "compilation_duration" backend/src/middleware/metrics.ts && check "Compilation metrics added"
grep -q "worker_queue_depth" backend/src/middleware/metrics.ts && check "Worker metrics added"
grep -q "gpu_utilization" backend/src/middleware/metrics.ts && check "GPU metrics added"

# 12. Check cost dashboard
echo ""
echo "Checking cost dashboard..."
test -f backend/src/routes/costDashboard.ts && check "Cost dashboard routes exist"
test -f frontend/src/components/CostDashboard.svelte && check "Cost dashboard UI exists"

# 13. Check CI optimization
echo ""
echo "Checking CI/CD optimization..."
test -f .github/workflows/ci.yml && check "CI workflow exists"
grep -q "cache@v4" .github/workflows/ci.yml && check "GitHub Actions cache enabled"
grep -q "parallel" .github/workflows/ci.yml || grep -q "needs:" .github/workflows/ci.yml && check "Parallel jobs configured"
test -f .github/workflows/benchmark.yml && check "Benchmark workflow exists"

# 14. Check documentation
echo ""
echo "Checking documentation..."
test -f docs/PERFORMANCE_GUIDE.md && check "Performance guide exists"
test -f docs/OPTIMIZATION_SUMMARY.md && check "Optimization summary exists"
test -f docs/QUICK_REFERENCE.md && check "Quick reference exists"
test -f README.md && check "README exists"

# Summary
echo ""
echo "========================================="
echo "Verification Complete"
echo "========================================="
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All optimizations verified successfully!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Run 'npm install' in backend, frontend, and packages/cli"
    echo "2. Run 'npm run build' to test SWC compilation"
    echo "3. Run 'cargo build --release' in intent-compiler"
    echo "4. Run benchmarks to verify performance improvements"
    exit 0
else
    echo -e "${RED}Some optimizations are missing or incomplete.${NC}"
    echo "Please review the failed checks above."
    exit 1
fi
