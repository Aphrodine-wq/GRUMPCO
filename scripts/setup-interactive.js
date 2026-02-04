#!/usr/bin/env node

/**
 * G-Rump Interactive Setup Wizard
 * Friendly, step-by-step setup with explanations
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const https = require('https');

const ROOT_DIR = path.join(__dirname, '..');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  blue: '\x1b[34m',
};

let currentStep = 0;
const totalSteps = 8;

function printLogo() {
  console.log(`
${colors.cyan}${colors.bright}
   ╔═══════════════════════════════════════════════════════════════╗
   ║                                                               ║
   ║    ██████╗       ██████╗ ██╗   ██╗███╗   ███╗██████╗          ║
   ║   ██╔════╝       ██╔══██╗██║   ██║████╗ ████║██╔══██╗         ║
   ║   ██║  ███╗█████╗██████╔╝██║   ██║██╔████╔██║██████╔╝         ║
   ║   ██║   ██║╚════╝██╔══██╗██║   ██║██║╚██╔╝██║██╔═══╝          ║
   ║   ╚██████╔╝      ██║  ██║╚██████╔╝██║ ╚═╝ ██║██║              ║
   ║    ╚═════╝       ╚═╝  ╚═╝ ╚═════╝ ╚═╝     ╚═╝╚═╝              ║
   ║                                                               ║
   ║              AI Development Platform v2.1.0                   ║
   ║                                                               ║
   ╚═══════════════════════════════════════════════════════════════╝
${colors.reset}
`);
}

function printProgress() {
  const filled = '█'.repeat(currentStep);
  const empty = '░'.repeat(totalSteps - currentStep);
  console.log(`\n${colors.dim}[${filled}${empty}] Step ${currentStep}/${totalSteps}${colors.reset}\n`);
}

function log(msg, color = colors.reset) {
  console.log(`${color}${msg}${colors.reset}`);
}

function logStep(title, description) {
  currentStep++;
  printProgress();
  console.log(`${colors.bright}${colors.cyan}▸ ${title}${colors.reset}`);
  if (description) {
    console.log(`${colors.dim}  ${description}${colors.reset}\n`);
  }
}

function logSuccess(msg) {
  console.log(`${colors.green}  ✓ ${msg}${colors.reset}`);
}

function logWarning(msg) {
  console.log(`${colors.yellow}  ⚠ ${msg}${colors.reset}`);
}

function logError(msg) {
  console.log(`${colors.red}  ✗ ${msg}${colors.reset}`);
}

function logInfo(msg) {
  console.log(`${colors.dim}  ℹ ${msg}${colors.reset}`);
}

function execQuiet(cmd, options = {}) {
  try {
    return execSync(cmd, { 
      encoding: 'utf8',
      cwd: options.cwd || ROOT_DIR,
      ...options 
    }).trim();
  } catch {
    return null;
  }
  }

async function prompt(question, defaultValue = '') {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const defaultStr = defaultValue ? ` ${colors.dim}[${defaultValue}]${colors.reset}` : '';
  
  return new Promise((resolve) => {
    rl.question(`${colors.cyan}?${colors.reset} ${question}${defaultStr}: `, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue);
    });
  });
}

async function promptYesNo(question, defaultYes = true) {
  const defaultStr = defaultYes ? 'Y/n' : 'y/N';
  const answer = await prompt(question, defaultStr);
  if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') return true;
  if (answer.toLowerCase() === 'n' || answer.toLowerCase() === 'no') return false;
  return defaultYes;
}

async function checkPrerequisites() {
  logStep('Checking Your System', 'Making sure you have everything needed to run G-Rump');
  
  const checks = [];
  
  // Node.js
  const nodeVersion = execQuiet('node --version');
  if (nodeVersion) {
    const major = parseInt(nodeVersion.replace('v', '').split('.')[0]);
    if (major >= 20) {
      logSuccess(`Node.js ${nodeVersion} ✓`);
      checks.push({ name: 'Node.js', status: 'ok', version: nodeVersion });
    } else {
      logError(`Node.js ${nodeVersion} is too old (need 20+)`);
      checks.push({ name: 'Node.js', status: 'error', version: nodeVersion });
    }
  } else {
    logError('Node.js not found. Install from https://nodejs.org/');
    checks.push({ name: 'Node.js', status: 'missing' });
  }
  
  // npm
  const npmVersion = execQuiet('npm --version');
  if (npmVersion) {
    logSuccess(`npm ${npmVersion} ✓`);
    checks.push({ name: 'npm', status: 'ok', version: npmVersion });
  } else {
    logWarning('npm not found');
    checks.push({ name: 'npm', status: 'missing' });
  }
  
  // Git
  const gitVersion = execQuiet('git --version');
  if (gitVersion) {
    logSuccess(`Git ${gitVersion.replace('git version ', '')} ✓`);
    checks.push({ name: 'Git', status: 'ok' });
  } else {
    logWarning('Git not found (optional, for some features)');
    checks.push({ name: 'Git', status: 'optional' });
  }
  
  // Docker
  const dockerVersion = execQuiet('docker --version');
  if (dockerVersion) {
    logSuccess(`Docker available ✓`);
    checks.push({ name: 'Docker', status: 'ok' });
  } else {
    logInfo('Docker not found (optional, for containerized deployment)');
    checks.push({ name: 'Docker', status: 'optional' });
  }
  
  // Rust (for intent compiler)
  const rustVersion = execQuiet('rustc --version');
  if (rustVersion) {
    logSuccess(`Rust ${rustVersion.replace('rustc ', '').split(' ')[0]} ✓ (for intent compiler)`);
    checks.push({ name: 'Rust', status: 'ok' });
  } else {
    logInfo('Rust not found. Intent compiler uses LLM fallback (slower but works fine)');
    checks.push({ name: 'Rust', status: 'optional' });
  }
  
  const criticalErrors = checks.filter(c => c.status === 'error' || c.status === 'missing');
  if (criticalErrors.length > 0) {
    log('\n❌ Cannot continue without fixing the above issues.');
    process.exit(1);
  }
  
  return checks;
}

async function chooseSetupMode() {
  logStep('Choose Your Setup Mode', 'Pick what works best for you');
  
  log(`${colors.bright}Setup Options:${colors.reset}\n`);
  log(`  ${colors.cyan}1.${colors.reset} Quick Start (Recommended)`);
  log(`     → Mock AI mode, no API keys needed`);
  log(`     → Explore the UI immediately`);
  log(`     → Add real AI providers later\n`);
  
  log(`  ${colors.cyan}2.${colors.reset} Development Mode`);
  log(`     → Full setup with real AI providers`);
  log(`     → Choose which features to enable`);
  log(`     → Best for active development\n`);
  
  log(`  ${colors.cyan}3.${colors.reset} Production Mode`);
  log(`     → Full security & all features`);
  log(`     → Requires all API keys`);
  log(`     → For deploying to production\n`);
  
  const choice = await prompt('Which mode?', '1');
  
  const modes = {
    '1': 'quick',
    '2': 'development',
    '3': 'production'
  };
  
  return modes[choice] || 'quick';
}

async function setupEnvironment(mode) {
  logStep('Configuring Environment', 'Setting up your .env file with smart defaults');
  
  const backendEnvPath = path.join(ROOT_DIR, 'backend', '.env');
  const backendEnvExample = path.join(ROOT_DIR, 'backend', '.env.example');
  
  // Read example file
  let envContent = '';
  if (fs.existsSync(backendEnvExample)) {
    envContent = fs.readFileSync(backendEnvExample, 'utf8');
  }
  
  const envVars = {};
  
  // Mode-specific configuration
  if (mode === 'quick') {
    logInfo('Setting up for Quick Start mode...');
    envVars.NODE_ENV = 'development';
    envVars.MOCK_AI_MODE = 'true';
    envVars.DISABLE_RAG = 'true';
    envVars.FRONTEND_ONLY = 'false';
    envVars.LOG_LEVEL = 'info';
    envVars.BLOCK_SUSPICIOUS_PROMPTS = 'false';
    envVars.REQUIRE_AUTH_FOR_API = 'false';
    
    logSuccess('Mock AI enabled - no API keys needed!');
    logInfo('Responses will be realistic placeholder data');
    logInfo('You can add real AI providers anytime later');
  } else if (mode === 'development') {
    logInfo('Setting up for Development mode...');
    envVars.NODE_ENV = 'development';
    envVars.MOCK_AI_MODE = 'false';
    envVars.LOG_LEVEL = 'debug';
    envVars.BLOCK_SUSPICIOUS_PROMPTS = 'false';
    envVars.REQUIRE_AUTH_FOR_API = 'false';
    
    // Ask about features
    if (await promptYesNo('Enable RAG (document search)?', false)) {
      envVars.DISABLE_RAG = 'false';
      logInfo('RAG enabled - you\'ll need Pinecone API key later');
    } else {
      envVars.DISABLE_RAG = 'true';
      logInfo('RAG disabled for now');
    }
    
    if (await promptYesNo('Enable voice features?', false)) {
      envVars.DISABLE_VOICE = 'false';
    } else {
      envVars.DISABLE_VOICE = 'true';
    }
  } else {
    // Production
    logInfo('Setting up for Production mode...');
    envVars.NODE_ENV = 'production';
    envVars.MOCK_AI_MODE = 'false';
    envVars.BLOCK_SUSPICIOUS_PROMPTS = 'true';
    envVars.REQUIRE_AUTH_FOR_API = 'true';
    envVars.SECURITY_STRICT_PROD = 'true';
    envVars.DISABLE_RAG = 'false';
    envVars.DISABLE_VOICE = 'false';
  }
  
  // Common settings
  envVars.PORT = '3000';
  envVars.CORS_ORIGINS = mode === 'production' 
    ? await prompt('Production domain(s)?', 'https://yourdomain.com')
    : 'http://localhost:5173,http://127.0.0.1:5173';
  
  // Generate .env content
  let newEnvContent = `# G-Rump Environment Configuration
# Generated by setup:interactive on ${new Date().toISOString()}
# Mode: ${mode.toUpperCase()}

`;
  
  // Add mode section
  newEnvContent += `# ───────────────────────────────────────────
# 🚀 SETUP MODE
# ───────────────────────────────────────────
NODE_ENV=${envVars.NODE_ENV}
MOCK_AI_MODE=${envVars.MOCK_AI_MODE || 'false'}
FRONTEND_ONLY=${envVars.FRONTEND_ONLY || 'false'}

`;
  
  // Add feature toggles
  newEnvContent += `# ───────────────────────────────────────────
# 🎯 FEATURE TOGGLES (enable/disable components)
# ───────────────────────────────────────────
DISABLE_RAG=${envVars.DISABLE_RAG || 'false'}
DISABLE_VOICE=${envVars.DISABLE_VOICE || 'true'}

`;
  
  // Add server config
  newEnvContent += `# ───────────────────────────────────────────
# 🌐 SERVER CONFIGURATION
# ───────────────────────────────────────────
PORT=${envVars.PORT}
CORS_ORIGINS=${envVars.CORS_ORIGINS}
LOG_LEVEL=${envVars.LOG_LEVEL || 'info'}

`;
  
  // Add AI providers section (with helpful comments)
  if (mode !== 'quick') {
    newEnvContent += `# ───────────────────────────────────────────
# 🤖 AI PROVIDERS (at least one required)
# Get free API keys from these providers:
# ───────────────────────────────────────────

# NVIDIA NIM (Recommended - most reliable)
# Get key: https://build.nvidia.com/
NVIDIA_NIM_API_KEY=${envVars.NVIDIA_NIM_API_KEY || ''}

# OpenRouter (Multi-model access)
# Get key: https://openrouter.ai/
OPENROUTER_API_KEY=${envVars.OPENROUTER_API_KEY || ''}

# Groq (Fast inference)
# Get key: https://groq.com/
GROQ_API_KEY=${envVars.GROQ_API_KEY || ''}

# Together AI (Open models)
# Get key: https://together.ai/
TOGETHER_API_KEY=${envVars.TOGETHER_API_KEY || ''}

# Ollama (Local/Offline)
# Run locally: https://ollama.com/
OLLAMA_URL=${envVars.OLLAMA_URL || 'http://localhost:11434'}

`;
  } else {
    newEnvContent += `# ───────────────────────────────────────────
# 🤖 AI PROVIDERS (Mock mode enabled - optional)
# Uncomment and add keys when ready for real AI:
# ───────────────────────────────────────────

# NVIDIA NIM (Recommended): https://build.nvidia.com/
#NVIDIA_NIM_API_KEY=

# OpenRouter: https://openrouter.ai/
#OPENROUTER_API_KEY=

# Groq: https://groq.com/
#GROQ_API_KEY=

`;
  }
  
  // Add security section
  newEnvContent += `# ───────────────────────────────────────────
# 🔒 SECURITY (Production Required)
# ───────────────────────────────────────────
BLOCK_SUSPICIOUS_PROMPTS=${envVars.BLOCK_SUSPICIOUS_PROMPTS || 'false'}
REQUIRE_AUTH_FOR_API=${envVars.REQUIRE_AUTH_FOR_API || 'false'}
`;
  
  if (mode === 'production') {
    newEnvContent += `SECURITY_STRICT_PROD=${envVars.SECURITY_STRICT_PROD || 'true'}

# Webhook secrets (required for webhooks in production)
GRUMP_WEBHOOK_SECRET=${await prompt('Webhook secret?', 'change-me-in-production')}
`;
  }
  
  newEnvContent += `

# ───────────────────────────────────────────
# 📝 NOTES
# ───────────────────────────────────────────
# • Restart server after changing this file
# • Use 'npm run dev:backend' to start
# • See docs/SETUP.md for all options
`;
  
  // Write the file
  fs.writeFileSync(backendEnvPath, newEnvContent);
  logSuccess(`Created ${colors.cyan}backend/.env${colors.reset}`);
  
  return envVars;
}

async function configureAIProviders(mode) {
  if (mode === 'quick') {
    logStep('AI Configuration', 'Skipped - using Mock AI mode');
    logInfo('Add real AI providers later by editing backend/.env');
    return;
  }
  
  logStep('Configure AI Providers', 'Add at least one API key to get started');
  
  log(`${colors.bright}Quick Setup Links:${colors.reset}\n`);
  log(`  ${colors.cyan}1. NVIDIA NIM${colors.reset} (Recommended)`);
  log(`     Free tier available | Best reliability`);
  log(`     ${colors.dim}https://build.nvidia.com/${colors.reset}\n`);
  
  log(`  ${colors.cyan}2. OpenRouter${colors.reset}`);
  log(`     Access to 100+ models | Pay-as-you-go`);
  log(`     ${colors.dim}https://openrouter.ai/${colors.reset}\n`);
  
  log(`  ${colors.cyan}3. Groq${colors.reset}`);
  log(`     Blazing fast inference | Free tier`);
  log(`     ${colors.dim}https://groq.com/${colors.reset}\n`);
  
  log(`You can add API keys now or later in backend/.env\n`);
  
  const addNow = await promptYesNo('Add an API key now?', false);
  
  if (addNow) {
    const provider = await prompt('Which provider? (nvidia/openrouter/groq/skip)', 'skip');
    
    if (provider !== 'skip') {
      const key = await prompt(`Paste your ${provider} API key:`, '');
      
      if (key) {
        const envPath = path.join(ROOT_DIR, 'backend', '.env');
        let envContent = fs.readFileSync(envPath, 'utf8');
        
        const keyName = {
          'nvidia': 'NVIDIA_NIM_API_KEY',
          'openrouter': 'OPENROUTER_API_KEY',
          'groq': 'GROQ_API_KEY'
        }[provider];
        
        if (keyName) {
          // Replace or add the key
          const regex = new RegExp(`${keyName}=.*`, 'g');
          if (envContent.match(regex)) {
            envContent = envContent.replace(regex, `${keyName}=${key}`);
          } else {
            envContent += `\n${keyName}=${key}\n`;
          }
          fs.writeFileSync(envPath, envContent);
          logSuccess(`Added ${provider} API key`);
        }
      }
    }
  }
  
  logInfo('You can always add more providers later');
}

async function installDependencies() {
  logStep('Installing Dependencies', 'This may take a few minutes...');
  
  const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  
  const spin = setInterval(() => {
    process.stdout.write(`\r  ${colors.cyan}${spinner[i]}${colors.reset} Installing packages...`);
    i = (i + 1) % spinner.length;
  }, 100);
  
  try {
    execSync('npm install', { 
      cwd: ROOT_DIR,
      stdio: 'pipe',
      encoding: 'utf8'
    });
    
    clearInterval(spin);
    process.stdout.write('\r' + ' '.repeat(50) + '\r');
    logSuccess('Root dependencies installed');
    
    // Install backend
    process.stdout.write(`  ${colors.cyan}⠋${colors.reset} Backend packages...`);
    execSync('npm install', { 
      cwd: path.join(ROOT_DIR, 'backend'),
      stdio: 'pipe'
    });
    logSuccess('Backend dependencies installed');
    
    // Install frontend
    process.stdout.write(`  ${colors.cyan}⠋${colors.reset} Frontend packages...`);
    execSync('npm install', { 
      cwd: path.join(ROOT_DIR, 'frontend'),
      stdio: 'pipe'
    });
    logSuccess('Frontend dependencies installed');
    
    // Build packages
    process.stdout.write(`  ${colors.cyan}⠋${colors.reset} Building shared packages...`);
    execSync('npm run build:packages', { 
      cwd: ROOT_DIR,
      stdio: 'pipe'
    });
    logSuccess('Shared packages built');
    
  } catch (error) {
    clearInterval(spin);
    process.stdout.write('\r' + ' '.repeat(50) + '\r');
    logWarning('Some dependencies failed to install');
    logInfo('You can retry with: npm install');
  }
}

async function createDataDirectories() {
  logStep('Creating Data Directories', 'Where G-Rump stores its data');
  
  const dirs = [
    path.join(ROOT_DIR, 'backend', 'data'),
    path.join(ROOT_DIR, 'backend', 'data', 'cache'),
    path.join(ROOT_DIR, 'backend', 'data', 'uploads'),
    path.join(ROOT_DIR, 'backend', 'data', 'skills'),
  ];
  
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logSuccess(`Created ${path.relative(ROOT_DIR, dir)}`);
    } else {
      logInfo(`${path.relative(ROOT_DIR, dir)} already exists`);
    }
  }
}

async function runHealthCheck() {
  logStep('Health Check', 'Verifying everything is ready');
  
  // Check env file
  const envPath = path.join(ROOT_DIR, 'backend', '.env');
  if (fs.existsSync(envPath)) {
    logSuccess('.env file configured');
  } else {
    logError('.env file missing');
  }
  
  // Check node_modules
  if (fs.existsSync(path.join(ROOT_DIR, 'node_modules'))) {
    logSuccess('Dependencies installed');
  } else {
    logWarning('Dependencies not installed');
  }
  
  // Quick type check (optional, can be slow)
  logInfo('Skipping type check (run \'npm run check-all\' when ready)');
}

function printFinalInstructions(mode, envVars) {
  const isMock = envVars.MOCK_AI_MODE === 'true';
  
  console.log(`
${colors.bright}${colors.green}
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║                  🎉 Setup Complete! 🎉                        ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
${colors.reset}
`);
  
  log(`${colors.bright}You're ready to go!${colors.reset}\n`);
  
  if (isMock) {
    log(`${colors.yellow}⚡ Quick Start Mode Active${colors.reset}`);
    log('  → No API keys required');
    log('  → AI responses are simulated (realistic placeholders)');
    log('  → Perfect for exploring the UI\n');
  }
  
  log(`${colors.bright}Start G-Rump:${colors.reset}\n`);
  log(`  ${colors.cyan}npm run dev${colors.reset}              Start everything (frontend + backend)`);
  log(`  ${colors.cyan}npm run dev:backend${colors.reset}      Backend only (port 3000)`);
  log(`  ${colors.cyan}npm run dev:frontend${colors.reset}     Frontend only (port 5173)`);
  log(`  ${colors.cyan}cd frontend && npm run electron:dev${colors.reset}  Desktop app\n`);
  
  log(`${colors.bright}Then open:${colors.reset} ${colors.cyan}http://localhost:5173${colors.reset}\n`);
  
  log(`${colors.bright}Next Steps:${colors.reset}\n`);
  
  if (isMock) {
    log('  1. Explore the UI and try the demo projects');
    log('  2. Add real AI providers when ready:');
    log(`     Edit ${colors.cyan}backend/.env${colors.reset} and set NVIDIA_NIM_API_KEY`);
    log('  3. Switch off mock mode: MOCK_AI_MODE=false');
  } else {
    log('  1. Verify your API keys are working');
    log('  2. Run tests: npm test');
    log('  3. Check out the examples in docs/examples/');
  }
  
  log(`\n  ${colors.dim}📖 Documentation: docs/GETTING_STARTED.md${colors.reset}`);
  log(`  ${colors.dim}🆘 Need help? See docs/KNOWN_ISSUES.md${colors.reset}\n`);
  
  log(`${colors.bright}Useful Commands:${colors.reset}\n`);
  log(`  ${colors.cyan}npm run check-all${colors.reset}      Type check + lint everything`);
  log(`  ${colors.cyan}npm test${colors.reset}               Run all tests`);
  log(`  ${colors.cyan}npm run format${colors.reset}           Format code`);
  log(`  ${colors.cyan}npm run lint:fix${colors.reset}         Fix lint issues\n`);
}

async function main() {
  printLogo();
  
  log(`${colors.bright}Welcome to the G-Rump Interactive Setup!${colors.reset}\n`);
  log('This wizard will help you get running in minutes.');
  log('You can re-run it anytime: npm run setup:interactive\n');
  
  // Step 1: Check prerequisites
  const checks = await checkPrerequisites();
  
  // Step 2: Choose setup mode
  const mode = await chooseSetupMode();
  
  // Step 3: Configure environment
  const envVars = await setupEnvironment(mode);
  
  // Step 4: Configure AI providers
  await configureAIProviders(mode);
  
  // Step 5: Install dependencies
  await installDependencies();
  
  // Step 6: Create directories
  await createDataDirectories();
  
  // Step 7: Health check
  await runHealthCheck();
  
  // Step 8: Final instructions
  printFinalInstructions(mode, envVars);
}

main().catch(err => {
  console.error(`\n${colors.red}Setup failed: ${err.message}${colors.reset}`);
  console.error(err.stack);
  process.exit(1);
});
