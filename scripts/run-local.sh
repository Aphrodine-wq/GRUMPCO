#!/usr/bin/env bash
# Run G-Rump locally (backend + frontend dev servers)
set -e
cd "$(dirname "$0")/.."
echo "Installing dependencies..."
npm install
echo "Building backend..."
cd backend && npm run build
echo "Starting backend and frontend..."
cd ..
npm run dev
