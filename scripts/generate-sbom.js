#!/usr/bin/env node
/**
 * @fileoverview SBOM (Software Bill of Materials) Generator
 * 
 * Generates CycloneDX SBOM for the G-Rump project.
 * Supports multiple package managers and output formats.
 * 
 * @module scripts/generate-sbom
 * @example
 * ```bash
 * # Generate SBOM for all workspaces
 * node scripts/generate-sbom.js
 * 
 * # Generate with specific format
 * node scripts/generate-sbom.js --format json
 * ```
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

/** SBOM output directory */
const SBOM_DIR = join(rootDir, 'sbom');

/** Workspaces to generate SBOMs for */
const WORKSPACES = [
  { name: 'root', path: rootDir },
  { name: 'backend', path: join(rootDir, 'backend') },
  { name: 'frontend', path: join(rootDir, 'frontend') },
];

/**
 * Ensures the SBOM directory exists
 */
function ensureSbomDir() {
  if (!existsSync(SBOM_DIR)) {
    mkdirSync(SBOM_DIR, { recursive: true });
    console.log(`📁 Created SBOM directory: ${SBOM_DIR}`);
  }
}

/**
 * Checks if a command is available
 * @param {string} cmd - Command to check
 * @returns {boolean}
 */
function commandExists(cmd) {
  try {
    execSync(`${cmd} --version`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Generates SBOM using npm sbom (Node.js 20+)
 * @param {string} workspacePath - Path to workspace
 * @param {string} outputPath - Output file path
 */
function generateNpmSbom(workspacePath, outputPath) {
  try {
    const result = execSync('npm sbom --sbom-format cyclonedx', {
      cwd: workspacePath,
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer
    });
    writeFileSync(outputPath, result);
    return true;
  } catch (error) {
    console.warn(`⚠️  npm sbom failed: ${error.message}`);
    return false;
  }
}

/**
 * Generates SBOM using @cyclonedx/cyclonedx-npm
 * @param {string} workspacePath - Path to workspace
 * @param {string} outputPath - Output file path
 */
function generateCycloneDxSbom(workspacePath, outputPath) {
  try {
    execSync(
      `npx @cyclonedx/cyclonedx-npm --output-file "${outputPath}" --spec-version 1.5`,
      {
        cwd: workspacePath,
        stdio: 'inherit',
      }
    );
    return true;
  } catch (error) {
    console.warn(`⚠️  cyclonedx-npm failed: ${error.message}`);
    return false;
  }
}

/**
 * Generates a simple SBOM from package.json
 * @param {string} workspacePath - Path to workspace
 * @param {string} outputPath - Output file path
 */
function generateSimpleSbom(workspacePath, outputPath) {
  const packageJsonPath = join(workspacePath, 'package.json');
  
  if (!existsSync(packageJsonPath)) {
    console.warn(`⚠️  No package.json found at ${workspacePath}`);
    return false;
  }

  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  
  const sbom = {
    bomFormat: 'CycloneDX',
    specVersion: '1.5',
    serialNumber: `urn:uuid:${crypto.randomUUID()}`,
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      tools: [
        {
          vendor: 'G-Rump',
          name: 'generate-sbom',
          version: '1.0.0',
        },
      ],
      component: {
        type: 'application',
        name: packageJson.name,
        version: packageJson.version,
        description: packageJson.description,
        licenses: packageJson.license ? [{ license: { id: packageJson.license } }] : [],
      },
    },
    components: [],
  };

  // Add dependencies
  const addDeps = (deps, scope) => {
    if (!deps) return;
    for (const [name, version] of Object.entries(deps)) {
      sbom.components.push({
        type: 'library',
        name,
        version: version.replace(/^[\^~]/, ''),
        scope,
        purl: `pkg:npm/${name}@${version.replace(/^[\^~]/, '')}`,
      });
    }
  };

  addDeps(packageJson.dependencies, 'required');
  addDeps(packageJson.devDependencies, 'optional');

  writeFileSync(outputPath, JSON.stringify(sbom, null, 2));
  return true;
}

/**
 * Main SBOM generation function
 */
async function main() {
  console.log('🔐 G-Rump SBOM Generator\n');
  
  ensureSbomDir();

  const timestamp = new Date().toISOString().split('T')[0];
  const results = [];

  for (const workspace of WORKSPACES) {
    const outputPath = join(SBOM_DIR, `${workspace.name}-sbom-${timestamp}.json`);
    console.log(`\n📦 Generating SBOM for ${workspace.name}...`);

    let success = false;

    // Try npm sbom first (Node.js 20+)
    if (!success) {
      success = generateNpmSbom(workspace.path, outputPath);
    }

    // Fallback to cyclonedx-npm
    if (!success) {
      success = generateCycloneDxSbom(workspace.path, outputPath);
    }

    // Last resort: simple SBOM from package.json
    if (!success) {
      success = generateSimpleSbom(workspace.path, outputPath);
    }

    if (success) {
      console.log(`✅ Generated: ${outputPath}`);
      results.push({ workspace: workspace.name, path: outputPath, success: true });
    } else {
      console.error(`❌ Failed to generate SBOM for ${workspace.name}`);
      results.push({ workspace: workspace.name, success: false });
    }
  }

  // Generate combined manifest
  const manifestPath = join(SBOM_DIR, 'manifest.json');
  writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        generated: new Date().toISOString(),
        project: 'G-Rump',
        version: JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf-8')).version,
        sboms: results.filter((r) => r.success).map((r) => r.path.replace(rootDir, '')),
      },
      null,
      2
    )
  );

  console.log(`\n📋 Manifest: ${manifestPath}`);
  console.log('\n✨ SBOM generation complete!');
}

main().catch((err) => {
  console.error('❌ SBOM generation failed:', err);
  process.exit(1);
});
