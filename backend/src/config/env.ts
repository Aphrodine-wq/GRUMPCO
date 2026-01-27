import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try multiple paths for .env file
const possiblePaths = [
  resolve(__dirname, '../../.env'), // From src/config/env.ts -> backend/.env
  resolve(process.cwd(), '.env'),   // From current working directory
  resolve(process.cwd(), 'backend/.env'), // From project root
];

let envPath: string | null = null;
for (const path of possiblePaths) {
  if (existsSync(path)) {
    envPath = path;
    break;
  }
}

if (envPath) {
  console.log(`[env] Loading .env from: ${envPath}`);
  const result = dotenv.config({ path: envPath });
  if (result.error) {
    console.error(`[env] Error loading .env: ${result.error.message}`);
  }
} else {
  console.warn('[env] .env file not found in any of these locations:');
  possiblePaths.forEach(p => console.warn(`  - ${p}`));
  // Try loading from default location (current directory)
  console.log('[env] Attempting to load from current directory...');
  const result = dotenv.config();
  if (result.error) {
    console.error(`[env] Error loading .env: ${result.error.message}`);
  }
}

// Validate critical environment variables
const requiredVars = ['ANTHROPIC_API_KEY'];
const missing = requiredVars.filter(v => !process.env[v]);

if (missing.length > 0) {
  console.error('\n' + '='.repeat(60));
  console.error('  G-RUMP CONFIGURATION ERROR');
  console.error('='.repeat(60));
  console.error(`\nMissing required environment variables: ${missing.join(', ')}`);
  console.error('\nTo fix this:');
  console.error('  1. Copy backend/.env.example to backend/.env');
  console.error('  2. Add your Anthropic API key from https://console.anthropic.com');
  console.error('  3. Restart the server');
  console.error(`\nCurrent directory: ${process.cwd()}`);
  console.error(`Searched in: ${envPath || 'default location'}`);
  console.error('='.repeat(60) + '\n');
} else {
  const keyPreview = process.env.ANTHROPIC_API_KEY?.substring(0, 12) + '...' +
                     process.env.ANTHROPIC_API_KEY?.slice(-4);
  console.log(`[env] ANTHROPIC_API_KEY loaded: ${keyPreview}`);
}

export default process.env;
