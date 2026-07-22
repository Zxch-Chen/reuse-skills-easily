/**
 * Create a simple DMG background image
 */

const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

const assetsDir = path.join(__dirname, '../assets');
const width = 540;
const height = 380;

if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

try {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#0b0c10');
  gradient.addColorStop(1, '#13151b');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  
  // Subtle pattern
  ctx.fillStyle = 'rgba(124, 58, 237, 0.03)';
  for (let x = 0; x < width; x += 40) {
    for (let y = 0; y < height; y += 40) {
      ctx.fillRect(x, y, 1, 1);
    }
  }
  
  // App icon area (left)
  const iconSize = 128;
  const iconX = 180 - iconSize / 2;
  const iconY = 170 - iconSize / 2;
  
  // Icon background
  const iconGrad = ctx.createLinearGradient(iconX, iconY, iconX + iconSize, iconY + iconSize);
  iconGrad.addColorStop(0, '#c4b5fd');
  iconGrad.addColorStop(1, '#7c3aed');
  ctx.fillStyle = iconGrad;
  roundRect(ctx, iconX, iconY, iconSize, iconSize, 24);
  ctx.fill();
  
  // Key symbol
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  const cx = iconX + iconSize / 2;
  const cy = iconY + iconSize / 2;
  
  ctx.beginPath();
  ctx.moveTo(cx - 36, cy - 18);
  ctx.lineTo(cx, cy - 48);
  ctx.lineTo(cx + 36, cy - 18);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(cx, cy - 18);
  ctx.lineTo(cx, cy + 36);
  ctx.stroke();
  
  // Arrow pointing right
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(270, 170);
  ctx.lineTo(330, 170);
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(320, 160);
  ctx.lineTo(330, 170);
  ctx.lineTo(320, 180);
  ctx.stroke();
  
  // Applications folder (right)
  const folderX = 360 - 48;
  const folderY = 170 - 48;
  
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  roundRect(ctx, folderX, folderY, 96, 96, 16);
  ctx.fill();
  
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 2;
  roundRect(ctx, folderX, folderY, 96, 96, 16);
  ctx.stroke();
  
  // Folder icon
  ctx.fillStyle = '#7c3aed';
  ctx.beginPath();
  ctx.moveTo(folderX + 16, folderY + 56);
  ctx.lineTo(folderX + 24, folderY + 40);
  ctx.lineTo(folderX + 72, folderY + 40);
  ctx.lineTo(folderX + 80, folderY + 56);
  ctx.closePath();
  ctx.fill();
  
  // Text labels
  ctx.fillStyle = '#f4f5f7';
  ctx.font = '14px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Keystone', 180, 310);
  ctx.fillStyle = '#9297a5';
  ctx.font = '12px -apple-system, sans-serif';
  ctx.fillText('Drag to Applications', 180, 330);
  
  ctx.fillStyle = '#f4f5f7';
  ctx.font = '14px -apple-system, sans-serif';
  ctx.fillText('Applications', 360, 310);
  
  const buffer = canvas.toBuffer('image/png');
  const outPath = path.join(assetsDir, 'dmg-background.png');
  fs.writeFileSync(outPath, buffer);
  console.log('Created: dmg-background.png');
  
} catch (e) {
  console.warn('Canvas not available, creating placeholder...');
  // Create a minimal placeholder
  const { createPNG } = require('./simple-png.js');
  // Just copy one of the icons as placeholder
  fs.copyFileSync(path.join(assetsDir, 'icon-512.png'), path.join(assetsDir, 'dmg-background.png'));
  console.log('Created placeholder dmg-background.png');
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}