/**
 * Generate minimal valid PNG files (purple squares)
 * Pure JS, no dependencies
 */

const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '../assets');
const sizes = [16, 32, 64, 128, 256, 512, 1024];

// Purple color: #7C3AED = RGB(124, 58, 237)
const PURPLE = [124, 58, 237, 255];

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  const table = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function writeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function createPNG(width, height) {
  // PNG signature
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  
  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 2;   // color type: truecolor
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace
  
  // IDAT chunk - simple solid color
  const rowSize = width * 3 + 1; // 3 bytes per pixel + filter byte
  const imageData = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    imageData[y * rowSize] = 0; // filter type: none
    for (let x = 0; x < width; x++) {
      const offset = y * rowSize + 1 + x * 3;
      imageData[offset] = PURPLE[0];     // R
      imageData[offset + 1] = PURPLE[1]; // G
      imageData[offset + 2] = PURPLE[2]; // B
    }
  }
  const zlib = require('zlib');
  const compressed = zlib.deflateSync(imageData);
  
  // IEND chunk
  const iend = Buffer.alloc(0);
  
  return Buffer.concat([
    sig,
    writeChunk('IHDR', ihdr),
    writeChunk('IDAT', compressed),
    writeChunk('IEND', iend)
  ]);
}

if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

console.log('Generating minimal PNG icons...');
sizes.forEach(size => {
  const png = createPNG(size, size);
  const outPath = path.join(assetsDir, `icon-${size}.png`);
  fs.writeFileSync(outPath, png);
  console.log(`Created: icon-${size}.png (${size}x${size})`);
});

console.log('\nDone! Note: These are solid purple placeholders.');
console.log('On macOS, run: node scripts/generate-icons.js to create proper icons with the logo.');