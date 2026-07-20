/**
 * Generate app icons from SVG
 * Run with: node scripts/generate-icons.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const assetsDir = path.join(__dirname, '../assets');
const svgPath = path.join(assetsDir, 'icon.svg');

// Base SVG icon
const svgContent = `
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="100" fill="#7C3AED"/>
  <path d="M128 192L256 272L384 192" stroke="white" stroke-width="32" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <path d="M256 272L256 384" stroke="white" stroke-width="32" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>
`;

// Ensure assets directory exists
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Write base SVG
fs.writeFileSync(svgPath, svgContent.trim());
console.log('Created:', svgPath);

// Generate PNG icons using sips (macOS built-in)
const sizes = [16, 32, 64, 128, 256, 512, 1024];

if (process.platform === 'darwin') {
  sizes.forEach(size => {
    const pngPath = path.join(assetsDir, `icon-${size}.png`);
    try {
      execSync(`sips -s format png -z ${size} ${size} "${svgPath}" --out "${pngPath}"`, { stdio: 'ignore' });
      console.log(`Created: ${pngPath} (${size}x${size})`);
    } catch (e) {
      console.warn(`Failed to generate ${size}x${size}:`, e.message);
    }
  });

  // Create ICNS file using iconutil
  const iconsetDir = path.join(assetsDir, 'icon.iconset');
  if (!fs.existsSync(iconsetDir)) fs.mkdirSync(iconsetDir);

  const iconMap = [
    ['16', 16], ['16@2x', 32],
    ['32', 32], ['32@2x', 64],
    ['128', 128], ['128@2x', 256],
    ['256', 256], ['256@2x', 512],
    ['512', 512], ['512@2x', 1024]
  ];

  iconMap.forEach(([name, size]) => {
    const src = path.join(assetsDir, `icon-${size}.png`);
    const dest = path.join(iconsetDir, `icon_${name}.png`);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
    }
  });

  try {
    execSync(`iconutil -c icns "${iconsetDir}" -o "${path.join(assetsDir, 'icon.icns')}"`, { stdio: 'ignore' });
    console.log('Created: icon.icns');
  } catch (e) {
    console.warn('Failed to create .icns:', e.message);
  }

  // Clean up iconset
  if (fs.existsSync(iconsetDir)) {
    fs.rmSync(iconsetDir, { recursive: true });
  }
} else {
  console.log('Run on macOS to generate PNG/ICNS icons automatically.');
  console.log('Or manually create icons from:', svgPath);
}

console.log('\nDone! Icons ready in:', assetsDir);