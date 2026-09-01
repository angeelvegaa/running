// Genera icons/icon-192.png, icons/icon-512.png e icons/icon.svg sin
// dependencias externas, con solo el zlib que trae Node.
// Ejecutar una vez: node tools/make-icons.mjs

import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'icons');

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idatData = deflateSync(raw);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idatData), chunk('IEND', Buffer.alloc(0))]);
}

function setPixel(rgba, width, x, y, [r, g, b, a]) {
  if (x < 0 || y < 0 || x >= width) return;
  const i = (y * width + x) * 4;
  rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = a;
}

// Diana de 3 anillos: evoca tanto el objetivo de ritmo como las zonas de FC.
// Blanco sobre naranja sólido, centrada y dentro de zona segura maskable (~80%).
function drawTarget(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const bg = [220, 75, 31, 255]; // naranja, coherente con --primary
  const fg = [255, 255, 255, 255];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) setPixel(rgba, size, x, y, bg);
  }

  const cx = size / 2, cy = size / 2;
  const rings = [
    [0.40, 0.47],
    [0.26, 0.32],
    [0.00, 0.09]
  ];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dist = Math.hypot(x - cx, y - cy) / size;
      const inRing = rings.some(([lo, hi]) => dist >= lo && dist <= hi);
      if (inRing) setPixel(rgba, size, x, y, fg);
    }
  }
  return rgba;
}

function writeIcon(size, filename) {
  const rgba = drawTarget(size);
  const png = encodePNG(size, size, rgba);
  writeFileSync(path.join(outDir, filename), png);
  console.log(`Generado ${filename} (${size}x${size})`);
}

function writeSvg() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="20" fill="#dc4b1f"/>
  <circle cx="50" cy="50" r="43.5" fill="none" stroke="#fff" stroke-width="7"/>
  <circle cx="50" cy="50" r="29" fill="none" stroke="#fff" stroke-width="6"/>
  <circle cx="50" cy="50" r="9" fill="#fff"/>
</svg>`;
  writeFileSync(path.join(outDir, 'icon.svg'), svg);
  console.log('Generado icon.svg');
}

writeIcon(192, 'icon-192.png');
writeIcon(512, 'icon-512.png');
writeSvg();
