const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Create a raw 32x32 PNG buffer
function createPng32(r, g, b, a) {
  const width = 32;
  const height = 32;

  // Raw pixel data: each scanline starts with filter byte 0
  const rawData = Buffer.alloc((width * 4 + 1) * height);
  let pos = 0;
  for (let y = 0; y < height; y++) {
    rawData[pos++] = 0; // Filter byte: None
    for (let x = 0; x < width; x++) {
      rawData[pos++] = r;
      rawData[pos++] = g;
      rawData[pos++] = b;
      rawData[pos++] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData);

  // PNG Signature
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR Chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = makeChunk('IHDR', ihdrData);

  // IDAT Chunk
  const idat = makeChunk('IDAT', compressed);

  // IEND Chunk
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(4 + 4 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const typeAndData = chunk.subarray(4, 8 + len);
  const crcVal = crc32(typeAndData);
  chunk.writeUInt32BE(crcVal, 8 + len);
  return chunk;
}

// Create a standard Windows 3.00 format BMP-based ICO (32x32)
function createIco32() {
  const width = 32;
  const height = 32;
  const bmpHeaderSize = 40;
  const pixelArraySize = width * height * 4;
  const andMaskSize = (width * height) / 8; // 128 bytes
  const imageSize = bmpHeaderSize + pixelArraySize + andMaskSize;

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // ICO type
  header.writeUInt16LE(1, 4); // 1 image

  const dirEntry = Buffer.alloc(16);
  dirEntry.writeUInt8(width, 0);
  dirEntry.writeUInt8(height, 1);
  dirEntry.writeUInt8(0, 2); // color count
  dirEntry.writeUInt8(0, 3); // reserved
  dirEntry.writeUInt16LE(1, 4); // color planes
  dirEntry.writeUInt16LE(32, 6); // bpp
  dirEntry.writeUInt32LE(imageSize, 8);
  dirEntry.writeUInt32LE(22, 12); // offset (6 + 16 = 22)

  // BITMAPINFOHEADER (height is doubled for XOR + AND mask)
  const bmi = Buffer.alloc(bmpHeaderSize);
  bmi.writeUInt32LE(bmpHeaderSize, 0);
  bmi.writeInt32LE(width, 4);
  bmi.writeInt32LE(height * 2, 8); // XOR height + AND mask height
  bmi.writeUInt16LE(1, 12); // planes
  bmi.writeUInt16LE(32, 14); // bit count
  bmi.writeUInt32LE(0, 16); // BI_RGB (no compression)
  bmi.writeUInt32LE(pixelArraySize + andMaskSize, 20);

  // Pixel array in BGRA (bottom-to-top)
  const pixels = Buffer.alloc(pixelArraySize);
  for (let i = 0; i < width * height; i++) {
    pixels[i * 4 + 0] = 185; // B (Emerald green theme #10b981)
    pixels[i * 4 + 1] = 185; // G
    pixels[i * 4 + 2] = 16;  // R
    pixels[i * 4 + 3] = 255; // A
  }

  // AND mask (all 0 for opaque)
  const andMask = Buffer.alloc(andMaskSize, 0);

  return Buffer.concat([header, dirEntry, bmi, pixels, andMask]);
}

const iconsDir = path.join(__dirname, 'src-tauri', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

const pngData = createPng32(16, 185, 129, 255);
const icoData = createIco32();

fs.writeFileSync(path.join(iconsDir, '32x32.png'), pngData);
fs.writeFileSync(path.join(iconsDir, '128x128.png'), pngData);
fs.writeFileSync(path.join(iconsDir, '128x128@2x.png'), pngData);
fs.writeFileSync(path.join(iconsDir, 'icon.png'), pngData);
fs.writeFileSync(path.join(iconsDir, 'icon.ico'), icoData);
fs.writeFileSync(path.join(iconsDir, 'icon.icns'), pngData);

console.log('Valid icon assets generated successfully!');
