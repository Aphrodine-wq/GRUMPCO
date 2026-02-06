#!/usr/bin/env node
/**
 * Build G-Rump frowny face icon for Electron
 * Converts grump-frowny.svg → icon.png (256x256) and favicon.ico
 */
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const svgPath = join(root, 'public', 'grump-frowny.svg');
const buildDir = join(root, 'build');
const publicDir = join(root, 'public');

async function build() {
  const sharp = (await import('sharp')).default;
  const pngToIco = (await import('png-to-ico')).default;

  const svg = readFileSync(svgPath);
  mkdirSync(buildDir, { recursive: true });

  // 256x256 PNG for electron-builder (embeds in grump.exe)
  const png256 = await sharp(svg).resize(256, 256).png().toBuffer();
  writeFileSync(join(buildDir, 'icon.png'), png256);
  console.log('Created build/icon.png (256x256)');

  // favicon.ico for tray/window (main.cjs) - multi-size for Windows
  const png32 = await sharp(svg).resize(32, 32).png().toBuffer();
  const png16 = await sharp(svg).resize(16, 16).png().toBuffer();
  const ico = await pngToIco([png16, png32, png256]);
  writeFileSync(join(publicDir, 'favicon.ico'), ico);
  console.log('Created public/favicon.ico');
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
