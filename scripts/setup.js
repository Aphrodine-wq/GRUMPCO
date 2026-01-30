#!/usr/bin/env node

/**
 * G-Rump Development Setup Script
 * Sets up the local development environment
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ROOT_DIR = path.join(__dirname, '..');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(msg, color = colors.reset) {
  console.log(`${color}${msg}${colors.reset}`);
}

function logStep(step, msg) {
  console.log(`\n${colors.cyan}[${step}]${colors.reset} ${colors.bright}${msg}${colors.reset}`);
}

function logSuccess(msg) {
  console.log(`${colors.green}✓${colors.reset} ${msg}`);
}

function logWarning(msg) {
  console.log(`${colors.yellow}⚠${colors.reset} ${msg}`);
}

function logError(msg) {
  console.log(`${colors.red}✗${colors.reset} ${msg}`);
}

function exec(cmd, options = {}) {
  try {
    return execSync(cmd, { 
      stdio: 'inherit',
      cwd: ROOT_DIR,
      ...options 
    });
  } catch (error) {
    return null;
  }
}

function execQuiet(cmd, options = {}) {
  try {
    return execSync(cmd, { 
      encoding: 'utf8',
      cwd: ROOT_DIR,
      ...options 
    }).trim();
  } catch {
    return null;
  }
}

async function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  console.log(`
${colors.bright}╔═══════════════════════════════════════════════════════════╗
║             G-Rump Development Setup                       ║
╚═══════════════════════════════════════════════════════════╝${colors.reset}
`);

  // Step 1: Check prerequisites
  logStep('1/6', 'Checking prerequisites...');
  
  const nodeVersion = execQuiet('node --version');
  if (nodeVersion) {
    const major = parseInt(nodeVersion.replace('v', '').split('.')[0]);
    if (major >= 20) {
      logSuccess(`Node.js ${nodeVersion} installed`);
    } else {
      logError(`Node.js ${nodeVersion} is too old. Please install Node.js 20+`);
      process.exit(1);
    }
  } else {
    logError('Node.js is not installed. Please install Node.js 20+');
    process.exit(1);
  }
  
  const npmVersion = execQuiet('npm --version');
  if (npmVersion) {
    logSuccess(`npm ${npmVersion} installed`);
  }
  
  const dockerVersion = execQuiet('docker --version');
  if (dockerVersion) {
    logSuccess(`Docker installed: ${dockerVersion.split(',')[0]}`);
  } else {
    logWarning('Docker not found. Docker features will be limited.');
  }

  // Step 2: Install dependencies
  logStep('2/6', 'Installing dependencies...');
  
  log('Installing root dependencies...');
  exec('npm install');
  
  log('Installing backend dependencies...');
  exec('npm install', { cwd: path.join(ROOT_DIR, 'backend') });
  
  log('Installing frontend dependencies...');
  exec('npm install', { cwd: path.join(ROOT_DIR, 'frontend') });
  
  logSuccess('Dependencies installed');

  // Step 3: Setup environment files
  logStep('3/6', 'Setting up environment files...');
  
  const backendEnv = path.join(ROOT_DIR, 'backend', '.env');
  const backendEnvExample = path.join(ROOT_DIR, 'backend', '.env.example');
  
  if (!fs.existsSync(backendEnv)) {
    if (fs.existsSync(backendEnvExample)) {
      fs.copyFileSync(backendEnvExample, backendEnv);
      logSuccess('Created backend/.env from .env.example');
      logWarning('Please edit backend/.env and add your API keys');
    } else {
      logWarning('No .env.example found. You will need to create backend/.env manually');
    }
  } else {
    logSuccess('backend/.env already exists');
  }

  // Step 4: Create data directories
  logStep('4/6', 'Creating data directories...');
  
  const dataDir = path.join(ROOT_DIR, 'backend', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    logSuccess('Created backend/data directory');
  } else {
    logSuccess('backend/data directory exists');
  }

  // Step 5: Build check
  logStep('5/6', 'Running build checks...');
  
  log('Type-checking backend...');
  const backendCheck = exec('npm run type-check', { cwd: path.join(ROOT_DIR, 'backend'), stdio: 'pipe' });
  if (backendCheck !== null) {
    logSuccess('Backend type-check passed');
  } else {
    logWarning('Backend type-check had issues (non-critical)');
  }
  
  log('Building frontend...');
  const frontendBuild = exec('npm run build', { cwd: path.join(ROOT_DIR, 'frontend'), stdio: 'pipe' });
  if (frontendBuild !== null) {
    logSuccess('Frontend build passed');
  } else {
    logWarning('Frontend build had issues (non-critical)');
  }

  // Step 6: Summary
  logStep('6/6', 'Setup complete!');
  
  console.log(`
${colors.bright}═══════════════════════════════════════════════════════════${colors.reset}

${colors.green}Setup completed successfully!${colors.reset}

${colors.bright}Required API Keys:${colors.reset}
  Add at least one of these to ${colors.cyan}backend/.env${colors.reset}:
  • NVIDIA_NIM_API_KEY - Get from https://build.nvidia.com/
  • OPENROUTER_API_KEY - Get from https://openrouter.ai/

${colors.bright}Start development:${colors.reset}
  ${colors.cyan}npm run dev${colors.reset}              Start all services
  ${colors.cyan}npm run dev:backend${colors.reset}      Start backend only (port 3000)
  ${colors.cyan}npm run dev:frontend${colors.reset}     Start frontend only (port 5173)

${colors.bright}Run tests:${colors.reset}
  ${colors.cyan}cd backend && npm test${colors.reset}   Run backend tests
  ${colors.cyan}cd frontend && npm run test:run${colors.reset}  Run frontend tests

${colors.bright}Build Electron app:${colors.reset}
  ${colors.cyan}cd electron && npm install && npm run dev${colors.reset}

${colors.bright}Documentation:${colors.reset}
  See ${colors.cyan}TESTING.md${colors.reset} for full testing guide

${colors.bright}═══════════════════════════════════════════════════════════${colors.reset}
`);
}

main().catch(err => {
  logError(`Setup failed: ${err.message}`);
  process.exit(1);
});
