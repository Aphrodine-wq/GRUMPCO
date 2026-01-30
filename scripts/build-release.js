
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function run(command, cwd = rootDir) {
    console.log(`> ${command} (in ${cwd})`);
    execSync(command, { stdio: 'inherit', cwd });
}

console.log('🚀 Starting G-Rump Release Build...');

try {
    // 1. Build Backend
    console.log('\n📦 Building Backend...');
    run('npm install', path.join(rootDir, 'backend'));
    run('npm run build', path.join(rootDir, 'backend'));

    // 2. Build Frontend
    console.log('\n📦 Building Frontend...');
    run('npm install', path.join(rootDir, 'frontend'));
    run('npm run build', path.join(rootDir, 'frontend'));

    // 3. Package Electron App (Unpacked)
    console.log('\n⚡ Packaging Electron App (Unpacked)...');
    // ensure electron-builder is available or run via npx
    run('npm run electron:pack', path.join(rootDir, 'frontend'));

    console.log('\n✅ Build Complete!');
    console.log('\nTo create the final Setup.exe, please run:');
    console.log('  build-installer.bat');
    console.log('\n(Ensure NSIS is installed on your system)');

} catch (error) {
    console.error('\n❌ Build Failed:', error.message);
    process.exit(1);
}
