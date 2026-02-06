#!/usr/bin/env node
/**
 * G-Rump root executable
 * Runs the G-Rump CLI from the monorepo.
 */
const path = require('path');
const { spawnSync } = require('child_process');

const cliDist = path.join(__dirname, '..', 'packages', 'cli', 'dist', 'index.js');
const cliSrc = path.join(__dirname, '..', 'packages', 'cli', 'src', 'index.ts');

const fs = require('fs');
const entry = fs.existsSync(cliDist) ? cliDist : cliSrc;

const args = process.argv.slice(2);
const useTsx = entry.endsWith('.ts');

const result = spawnSync(
  useTsx ? 'npx' : process.execPath,
  useTsx ? ['tsx', entry, ...args] : [entry, ...args],
  { stdio: 'inherit', cwd: process.cwd(), shell: true }
);

process.exit(result.status ?? (result.signal ? 128 : 1));
