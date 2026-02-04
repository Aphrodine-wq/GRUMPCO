/**
 * Configuration profiles (work, personal, project-specific).
 * Usage: grump profile create|list|use|export|import [name]
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { config } from '../config.js';
import { branding } from '../branding.js';
import { GrumpError } from '../utils/errors.js';

const PROFILES_DIR = join(process.env.HOME || process.env.USERPROFILE || '', '.config', 'grump', 'profiles');
const CURRENT_PROFILE_FILE = join(process.env.HOME || process.env.USERPROFILE || '', '.config', 'grump', 'current-profile');

function ensureProfilesDir(): void {
  if (!existsSync(PROFILES_DIR)) {
    mkdirSync(PROFILES_DIR, { recursive: true });
  }
}

function getProfilePath(name: string): string {
  return join(PROFILES_DIR, `${name}.json`);
}

export async function execute(action: string, name: string | undefined): Promise<void> {
  ensureProfilesDir();
  switch (action.toLowerCase()) {
    case 'create':
      if (!name) throw new GrumpError('Profile name required', 'MISSING_NAME', undefined, ['Usage: grump profile create <name>']);
      createProfile(name);
      break;
    case 'list':
      listProfiles();
      break;
    case 'use':
      if (!name) throw new GrumpError('Profile name required', 'MISSING_NAME', undefined, ['Usage: grump profile use <name>']);
      useProfile(name);
      break;
    case 'export':
      if (!name) throw new GrumpError('Profile name required', 'MISSING_NAME', undefined, ['Usage: grump profile export <name>']);
      exportProfile(name);
      break;
    case 'import':
      if (!name) throw new GrumpError('Profile name required', 'MISSING_NAME', undefined, ['Usage: grump profile import <name>']);
      importProfile(name);
      break;
    default:
      throw new GrumpError(`Unknown profile action: ${action}`, 'UNKNOWN_ACTION', undefined, ['Valid: create, list, use, export, import']);
  }
}

function createProfile(name: string): void {
  const path = getProfilePath(name);
  if (existsSync(path)) {
    console.log(chalk.yellow(`Profile "${name}" already exists. Overwriting.`));
  }
  const current = config.getAll();
  writeFileSync(path, JSON.stringify(current, null, 2));
  console.log(branding.status(`Profile "${name}" created at ${path}`, 'success'));
}

function listProfiles(): void {
  const files = existsSync(PROFILES_DIR) ? readdirSync(PROFILES_DIR).filter((f: string) => f.endsWith('.json')) : [];
  const names = files.map((f: string) => f.replace('.json', ''));
  let current = '';
  try {
    if (existsSync(CURRENT_PROFILE_FILE)) {
      current = readFileSync(CURRENT_PROFILE_FILE, 'utf-8').trim();
    }
  } catch {
    // ignore
  }
  console.log(branding.format('Profiles', 'subtitle'));
  if (names.length === 0) {
    console.log(chalk.dim('  No profiles. Run: grump profile create <name>'));
    return;
  }
  for (const n of names) {
    console.log('  ' + (n === current ? chalk.green('* ' + n) : '  ' + n));
  }
}

function useProfile(name: string): void {
  const path = getProfilePath(name);
  if (!existsSync(path)) {
    throw new GrumpError(`Profile "${name}" not found`, 'NOT_FOUND', undefined, ['Run: grump profile list']);
  }
  writeFileSync(CURRENT_PROFILE_FILE, name);
  console.log(branding.status(`Switched to profile "${name}"`, 'success'));
  console.log(chalk.dim('Load profile values into config manually or restart CLI.'));
}

function exportProfile(name: string): void {
  const path = getProfilePath(name);
  if (!existsSync(path)) {
    throw new GrumpError(`Profile "${name}" not found`, 'NOT_FOUND', undefined, ['Run: grump profile list']);
  }
  console.log(readFileSync(path, 'utf-8'));
}

function importProfile(name: string): void {
  const path = getProfilePath(name);
  if (!existsSync(path)) {
    throw new GrumpError(`Profile file not found: ${path}`, 'NOT_FOUND');
  }
  const data = JSON.parse(readFileSync(path, 'utf-8'));
  const configPath = config.getConfigPath() || join(process.cwd(), '.grumprc');
  writeFileSync(configPath, JSON.stringify(data, null, 2));
  console.log(branding.status(`Imported profile "${name}" to ${configPath}`, 'success'));
}

export const profileCommand = { execute };
