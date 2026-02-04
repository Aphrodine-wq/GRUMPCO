#!/usr/bin/env node
/**
 * ship-ready-check.js
 *
 * Automated pre-release checks for G-Rump. Runs type-check, lint, and tests.
 * Use before cutting a release. See docs/PRODUCTION.md for full checklist.
 *
 * Usage:
 *   node scripts/ship-ready-check.js          # Core checks (check-all, test)
 *   node scripts/ship-ready-check.js --env    # Also run check-release-env (when NODE_ENV=production)
 *   node scripts/ship-ready-check.js --full   # Core + env + electron build (slower)
 */

const { spawnSync } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const runEnvCheck = args.includes('--env');
const runFull = args.includes('--full');

function run(cmd, cwd = rootDir, description) {
  const [program, ...rest] = cmd.split(/\s+/);
  const result = spawnSync(program, rest, {
    cwd,
    stdio: 'inherit',
    shell: true,
  });
  return { ok: result.status === 0, description: description || cmd };
}

const results = [];

console.log('\n=== G-Rump Ship-Ready Check ===\n');

// 1. Type-check + lint
console.log('1. Running check-all (type-check + lint)...');
const checkAll = run('npm run check-all', rootDir, 'check-all');
results.push(checkAll);
if (!checkAll.ok) {
  console.error('\n[FAIL] check-all failed. Fix errors before release.\n');
  process.exit(1);
}
console.log('[PASS] check-all\n');

// 2. Tests
console.log('2. Running tests (frontend + backend)...');
const tests = run('npm test', rootDir, 'npm test');
results.push(tests);
if (!tests.ok) {
  console.error('\n[FAIL] Tests failed. Fix failures before release.\n');
  process.exit(1);
}
console.log('[PASS] Tests\n');

// 3. Optional: release env check
if (runEnvCheck || runFull) {
  if (process.env.NODE_ENV === 'production') {
    console.log('3. Running check-release-env...');
    const envCheck = run('node scripts/check-release-env.js', rootDir, 'check-release-env');
    results.push(envCheck);
    if (!envCheck.ok) {
      console.error('\n[FAIL] Release env check failed.\n');
      process.exit(1);
    }
    console.log('[PASS] Release env\n');
  } else {
    console.log('3. Skipping check-release-env (NODE_ENV is not production)\n');
  }
}

// 4. Optional: electron build
if (runFull) {
  console.log('4. Running electron:build (this may take a few minutes)...');
  const electronBuild = run('npm run electron:build', path.join(rootDir, 'frontend'), 'electron:build');
  results.push(electronBuild);
  if (!electronBuild.ok) {
    console.error('\n[FAIL] Electron build failed.\n');
    process.exit(1);
  }
  console.log('[PASS] Electron build\n');
}

console.log('=== All checks passed ===\n');
console.log('Next steps (see docs/PRODUCTION.md):');
console.log('  - Set NODE_ENV=production, CORS_ORIGINS, BLOCK_SUSPICIOUS_PROMPTS=true');
console.log('  - Verify legal links (Settings → Legal)');
console.log('  - Run: node scripts/check-release-env.js (when NODE_ENV=production)');
console.log('');

process.exit(0);
