/**
 * Generate PNG icons using pure Node.js (no external dependencies)
 * Creates simple colored squares with the Keystone logo
 */

const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

const assetsDir = path.join(__dirname, '../assets');
const sizes = [16, 32, 64, 128, 256, 512, 1024];

// Ensure assets directory exists
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

function drawIcon(ctx, size) {
  const padding = size * 0.15;
  const iconSize = size - padding * 2;
  const centerX = size / 2;
  const centerY = size / 2;
  
  // Background
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#c4b5fd');
  gradient.addColorStop(1, '#7c3aed');
  
  ctx.fillStyle = gradient;
  roundRect(ctx, padding, padding, iconSize, iconSize, size * 0.18);
  ctx.fill();
  
  // Shadow
  ctx.shadowColor = 'rgba(124, 58, 237, 0.4)';
  ctx.shadowBlur = size * 0.08;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = size * 0.04;
  
  // Key shape (simplified keystone logo)
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(2, size * 0.04);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  const keyScale = size / 512;
  const keyX = centerX;
  const keyY = centerY + size * 0.02;
  
  // Top arc
  ctx.beginPath();
  ctx.moveTo(keyX - 48 * keyScale, keyY - 24 * keyScale);
  ctx.lineTo(keyX, keyY - 64 * keyScale);
  ctx.lineTo(keyX + 48 * keyScale, keyY - 24 * keyScale);
  ctx.stroke();
  
  // Stem
  ctx.beginPath();
  ctx.moveTo(keyX, keyY - 24 * keyScale);
  ctx.lineTo(keyX, keyY + 48 * keyScale);
  ctx.stroke();
  
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
}

function roundRect(ctx, x, y, width, height, radius) {
  if (typeof radius === 'number') {
    radius = { tl: radius, tr: radius, br: radius, bl: radius };
  } else {
    const defaultRadius = { tl: 0, tr: 0, br: 0, bl: 0 };
    for (const side in defaultRadius) {
      radius[side] = radius[side] || defaultRadius[side];
    }
  }
  ctx.beginPath();
  ctx.moveTo(x + radius.tl, y);
  ctx.lineTo(x + width - radius.tr, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
  ctx.lineTo(x + width, y + height - radius.br);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
  ctx.lineTo(x + radius.bl, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
  ctx.lineTo(x, y + radius.tl);
  ctx.quadraticCurveTo(x, y, x + radius.tl, y);
  ctx.closePath();
}

console.log('Generating PNG icons...');

sizes.forEach(size => {
  try {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    
    drawIcon(ctx, size);
    
    const buffer = canvas.toBuffer('image/png');
    const outPath = path.join(assetsDir, `icon-${size}.png`);
    fs.writeFileSync(outPath, buffer);
    console.log(`Created: icon-${size}.png (${size}x${size})`);
  } catch (e) {
    console.warn(`Failed to generate ${size}x${size}:`, e.message);
  }
});

console.log('\nDone!');