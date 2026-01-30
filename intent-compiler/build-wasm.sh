#!/bin/bash
# Build WASM module for intent parser

set -e

echo "Building WASM module..."

# Install wasm-pack if not available
if ! command -v wasm-pack &> /dev/null; then
    echo "Installing wasm-pack..."
    curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
fi

# Build for Node.js
echo "Building for Node.js..."
wasm-pack build --target nodejs --features wasm --out-dir pkg-node

# Build for browser
echo "Building for browser..."
wasm-pack build --target web --features wasm --out-dir pkg-web

# Build for bundler (webpack, rollup, etc.)
echo "Building for bundlers..."
wasm-pack build --target bundler --features wasm --out-dir pkg-bundler

echo "WASM build complete!"
echo "  - Node.js: pkg-node/"
echo "  - Browser: pkg-web/"
echo "  - Bundler: pkg-bundler/"
