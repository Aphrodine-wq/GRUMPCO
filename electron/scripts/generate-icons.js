const sharp = require('sharp');
const toIco = require('to-ico');
const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, '..', 'public');
const svgPath = path.join(publicDir, 'icon.svg');
const pngPath = path.join(publicDir, 'icon.png');
const icoPath = path.join(publicDir, 'icon.ico');

async function generateIcons() {
  console.log('Reading SVG from:', svgPath);
  
  // Read SVG
  const svgBuffer = fs.readFileSync(svgPath);
  
  // Generate high-res PNG (512x512 for best quality)
  console.log('Generating PNG...');
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(pngPath);
  console.log('Created:', pngPath);
  
  // Generate ICO (Windows) - needs multiple sizes
  console.log('Generating ICO...');
  const sizes = [16, 32, 48, 64, 128, 256];
  const pngBuffers = await Promise.all(
    sizes.map(size => 
      sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toBuffer()
    )
  );
  
  const icoBuffer = await toIco(pngBuffers);
  fs.writeFileSync(icoPath, icoBuffer);
  console.log('Created:', icoPath);
  
  // For macOS, we just need the PNG - electron-builder can convert to icns
  // Or create icon.icns manually if needed
  console.log('\nIcons generated successfully!');
  console.log('Note: For macOS .icns, electron-builder will auto-convert from PNG');
}

generateIcons().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
