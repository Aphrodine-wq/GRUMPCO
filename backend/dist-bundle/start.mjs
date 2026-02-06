#!/usr/bin/env node
/**
 * G-Rump Backend Launcher
 * 
 * This script starts the bundled G-Rump backend server.
 */

import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Start the server
const server = spawn('node', [join(__dirname, 'server.mjs')], {
  stdio: 'inherit',
  env: { ...process.env },
});

server.on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

server.on('exit', (code) => {
  process.exit(code || 0);
});

// Handle signals
process.on('SIGINT', () => server.kill('SIGINT'));
process.on('SIGTERM', () => server.kill('SIGTERM'));
