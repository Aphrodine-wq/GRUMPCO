#!/usr/bin/env node

/**
 * G-Rump Installer Staging Script
 * Builds backend Windows bundle, optional frontend and intent-compiler,
 * copies to installer/stage/ and creates the Start G-Rump launcher.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const STAGE = path.join(ROOT, 'installer', 'stage');

function log(msg) {
  console.log(msg);
}

function run(cmd, opts = {}) {
  log(`  $ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: opts.cwd || ROOT, ...opts });
}

function mkdir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    log(`  Created ${path.relative(ROOT, dir)}`);
  }
}

function copyDir(src, dest, filter) {
  if (!fs.existsSync(src)) return;
  mkdir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) {
      copyDir(s, d, filter);
    } else if (!filter || filter(e.name)) {
      fs.copyFileSync(s, d);
    }
  }
}

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  mkdir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) {
      copyRecursive(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

// Start G-Rump launcher: check node, run server.mjs, open browser after delay
const START_GRUMP_BAT = `@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo G-Rump requires Node.js 18 or higher. Please install Node.js and add it to PATH.
  echo See https://nodejs.org/
  pause
  exit /b 1
)
if not exist "node_modules" (
  echo First-time setup: installing backend dependencies...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:3000"
node server.mjs
pause
`;

function main() {
  log('\n--- G-Rump Installer Staging ---\n');

  mkdir(STAGE);

  // 1. Backend Windows bundle
  log('1. Building backend Windows bundle...');
  run('npm run bundle:windows', { cwd: path.join(ROOT, 'backend') });
  const backendBundle = path.join(ROOT, 'backend', 'dist-bundle');
  const stageBackend = path.join(STAGE, 'backend');
  if (fs.existsSync(stageBackend)) {
    fs.rmSync(stageBackend, { recursive: true });
  }
  copyRecursive(backendBundle, stageBackend);
  log('   Backend staged to installer/stage/backend/\n');

  // Start G-Rump launcher (better UX: check node, optional browser)
  fs.writeFileSync(path.join(stageBackend, 'Start G-Rump.bat'), START_GRUMP_BAT, 'utf8');
  log('   Created Start G-Rump.bat launcher in backend.\n');

  // 2. Optional: frontend build
  log('2. Building frontend...');
  try {
    run('npm run build', { cwd: path.join(ROOT, 'frontend') });
    const frontendDist = path.join(ROOT, 'frontend', 'dist');
    const stageFrontend = path.join(STAGE, 'frontend');
    if (fs.existsSync(stageFrontend)) {
      fs.rmSync(stageFrontend, { recursive: true });
    }
    if (fs.existsSync(frontendDist)) {
      copyRecursive(frontendDist, stageFrontend);
      log('   Frontend staged to installer/stage/frontend/\n');
    } else {
      log('   Frontend dist not found, skipping.\n');
    }
  } catch (err) {
    log('   Frontend build failed or skipped: ' + (err.message || err) + '\n');
  }

  // 3. Optional: intent-compiler release
  log('3. Building intent-compiler (release)...');
  const intentDir = path.join(ROOT, 'intent-compiler');
  const intentRelease = path.join(intentDir, 'target', 'release');
  try {
    run('cargo build --release', { cwd: intentDir });
    const stageIntent = path.join(STAGE, 'intent-compiler');
    if (fs.existsSync(stageIntent)) {
      fs.rmSync(stageIntent, { recursive: true });
    }
    mkdir(stageIntent);
    const exes = ['grump-intent.exe', 'grump_cli.exe', 'verdict_api.exe'];
    for (const exe of exes) {
      const src = path.join(intentRelease, exe);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(stageIntent, exe));
        log('   Staged ' + exe);
      }
    }
    log('   Intent-compiler staged to installer/stage/intent-compiler/\n');
  } catch (err) {
    log('   Intent-compiler build failed or skipped (Rust/cargo required): ' + (err.message || err) + '\n');
  }

  log('--- Staging complete. Run: npm run installer:exe (or makensis installer/Setup.nsi) ---\n');
}

main();
