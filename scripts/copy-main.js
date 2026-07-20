/**
 * Copy main process files to dist/ for electron-builder
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

const filesToCopy = [
  { src: 'main.js', dest: 'main.js' },
  { src: 'preload.js', dest: 'preload.js' }
];

console.log('Copying main process files to dist/...');

filesToCopy.forEach(({ src, dest }) => {
  const srcPath = path.join(rootDir, src);
  const destPath = path.join(distDir, dest);
  
  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
    console.log(`  ✓ ${src} → dist/${dest}`);
  } else {
    console.warn(`  ✗ ${src} not found`);
  }
});

console.log('Done.');