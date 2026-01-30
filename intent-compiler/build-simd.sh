#!/bin/bash
# Build intent compiler with SIMD optimizations

set -e

echo "Building with SIMD optimizations..."

# Detect CPU features
if grep -q avx512 /proc/cpuinfo 2>/dev/null; then
    echo "AVX-512 detected, building with skylake-avx512 target"
    export RUSTFLAGS="-C target-cpu=skylake-avx512"
elif grep -q avx2 /proc/cpuinfo 2>/dev/null; then
    echo "AVX2 detected, building with haswell target"
    export RUSTFLAGS="-C target-cpu=haswell"
else
    echo "Building with native CPU features"
    export RUSTFLAGS="-C target-cpu=native"
fi

# Build release
cargo build --release

echo "Build complete!"
echo "Binary: target/release/grump-intent"

# Show binary size
ls -lh target/release/grump-intent

# Run quick test
echo ""
echo "Testing binary..."
echo "Build a todo app" | ./target/release/grump-intent
