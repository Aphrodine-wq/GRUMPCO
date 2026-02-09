# G-Rump Development Makefile
# Common commands for development workflow

.PHONY: help install dev build test lint format clean setup

# Default target
help:
	@echo "G-Rump Development Commands"
	@echo "==========================="
	@echo ""
	@echo "Setup:"
	@echo "  make install       - Install all dependencies"
	@echo "  make setup         - Run interactive setup"
	@echo ""
	@echo "Development:"
	@echo "  make dev           - Start development servers (frontend + backend)"
	@echo "  make dev-frontend  - Start frontend only"
	@echo "  make dev-backend   - Start backend only"
	@echo ""
	@echo "Building:"
	@echo "  make build         - Build frontend for production"
	@echo "  make build:packages - Build shared packages"
	@echo ""
	@echo "Testing:"
	@echo "  make test          - Run all tests"
	@echo "  make test-frontend - Run frontend tests"
	@echo "  make test-backend  - Run backend tests"
	@echo "  make test-rust     - Run Rust tests"
	@echo "  make test-e2e      - Run E2E tests"
	@echo "  make test:coverage - Run tests with coverage"
	@echo ""
	@echo "Quality:"
	@echo "  make lint          - Run linting"
	@echo "  make lint:fix      - Fix linting issues"
	@echo "  make format        - Format code"
	@echo "  make type-check    - Run TypeScript type checking"
	@echo "  make check-all     - Run all checks (lint, type-check, format)"
	@echo ""
	@echo "Maintenance:"
	@echo "  make clean         - Clean build artifacts"
	@echo "  make benchmark     - Run performance benchmarks"
	@echo ""

# Setup
install:
	pnpm install

setup:
	npm run setup

# Development
dev:
	npm run dev

dev-frontend:
	npm run dev:frontend

dev-backend:
	npm run dev:backend

# Building
build:
	npm run build

build-packages:
	npm run build:packages

# Testing
test:
	npm test

test-frontend:
	npm run test:run --prefix frontend

test-backend:
	npm test --prefix backend

test-rust:
	cd intent-compiler && cargo test --lib

test-e2e:
	cd frontend && npx playwright test

test-coverage:
	npm run test:coverage

# Quality
lint:
	npm run lint

lint-fix:
	npm run lint:fix

format:
	npm run format

type-check:
	npm run type-check

check-all:
	npm run check-all

# Maintenance
clean:
	rm -rf frontend/dist backend/dist frontend/.svelte-kit
	rm -rf intent-compiler/target
	rm -rf node_modules frontend/node_modules backend/node_modules
	rm -rf packages/*/node_modules packages/*/dist

benchmark:
	npx tsx scripts/benchmark.ts
