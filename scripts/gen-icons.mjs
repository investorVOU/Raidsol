/**
 * Generates 192x192 and 512x512 PNG icons for PWA.
 * Pure Node.js — no external dependencies, only zlib (built-in).
 *
 * Design: black BG, Solana-green shield ring, diagonal sword blade, "SR" label.
 * Run: node scripts/gen-icons.mjs
 */

import { deflateSync } from 'zlib';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

// ── CRC32 ──────────────────────────────────────────────────────────────────
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : (c >>> 1);
  CRC_TABLE[n] = c;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return ((c ^ 0xffffffff) >>> 0);
}

function makeChunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crcInput = Buffer.concat([t, data]);
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(crcInput));
  return Buffer.concat([len, t, data, crcBuf]);
}

// ── Pixel painter ──────────────────────────────────────────────────────────
function blend(dst, r, g, b, a) {
  const alpha = a / 255;
  dst[0] = Math.round(dst[0] * (1 - alpha) + r * alpha);
  dst[1] = Math.round(dst[1] * (1 - alpha) + g * alpha);
  dst[2] = Math.round(dst[2] * (1 - alpha) + b * alpha);
}

function drawCircleRing(pixels, size, cx, cy, radius, thickness, r, g, b, aa = true) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      const d = Math.abs(dist - radius);
      if (d < thickness + (aa ? 1 : 0)) {
        const alpha = aa ? Math.max(0, 1 - (d - thickness + 1)) : 1;
        blend(pixels[y][x], r, g, b, Math.round(alpha * 255));
      }
    }
  }
}

function drawLine(pixels, size, x0, y0, x1, y1, r, g, b, width) {
  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.ceil(len * 2);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const px = x0 + dx * t;
    const py = y0 + dy * t;
    for (let oy = -width; oy <= width; oy++) {
      for (let ox = -width; ox <= width; ox++) {
        const nx = Math.round(px + ox), ny = Math.round(py + oy);
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        const dist = Math.sqrt(ox * ox + oy * oy);
        const alpha = Math.max(0, 1 - dist / (width + 0.5));
        blend(pixels[ny][nx], r, g, b, Math.round(alpha * 255));
      }
    }
  }
}

function addGlow(pixels, size, cx, cy, radius, r, g, b) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist < radius) {
        const strength = (1 - dist / radius) ** 2 * 0.45;
        blend(pixels[y][x], r, g, b, Math.round(strength * 255));
      }
    }
  }
}

// ── Pixel font for "SR" (7x9 bitmap, 2 chars) ──────────────────────────────
const LETTER_S = [
  '01110',
  '10001',
  '10000',
  '01110',
  '00001',
  '10001',
  '01110',
];
const LETTER_R = [
  '11100',
  '10010',
  '10010',
  '11100',
  '10100',
  '10010',
  '10001',
];

function drawLetter(pixels, size, bitmap, startX, startY, scale, r, g, b) {
  for (let row = 0; row < bitmap.length; row++) {
    for (let col = 0; col < bitmap[row].length; col++) {
      if (bitmap[row][col] === '1') {
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            const nx = startX + col * scale + dx;
            const ny = startY + row * scale + dy;
            if (nx >= 0 && ny >= 0 && nx < size && ny < size) {
              pixels[ny][nx] = [r, g, b];
            }
          }
        }
      }
    }
  }
}

// ── PNG generator ──────────────────────────────────────────────────────────
function generateIcon(size) {
  // Initialize pixel grid with black background
  const pixels = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => [2, 2, 2])
  );

  const cx = size / 2;
  const cy = size / 2;
  const s = size / 192; // scale factor

  // Radial background glow (dark purple/green center)
  addGlow(pixels, size, cx, cy, size * 0.45, 20, 241, 149);

  // Outer shield ring — Solana green
  drawCircleRing(pixels, size, cx, cy, size * 0.40, 2 * s, 20, 241, 149);

  // Corner brackets (tech aesthetic)
  const bSize = Math.round(20 * s);
  const bThick = Math.round(2 * s);
  const margin = Math.round(16 * s);
  // TL
  drawLine(pixels, size, margin, margin, margin + bSize, margin, 153, 69, 255, bThick);
  drawLine(pixels, size, margin, margin, margin, margin + bSize, 153, 69, 255, bThick);
  // TR
  drawLine(pixels, size, size - margin, margin, size - margin - bSize, margin, 153, 69, 255, bThick);
  drawLine(pixels, size, size - margin, margin, size - margin, margin + bSize, 153, 69, 255, bThick);
  // BL
  drawLine(pixels, size, margin, size - margin, margin + bSize, size - margin, 153, 69, 255, bThick);
  drawLine(pixels, size, margin, size - margin, margin, size - margin - bSize, 153, 69, 255, bThick);
  // BR
  drawLine(pixels, size, size - margin, size - margin, size - margin - bSize, size - margin, 153, 69, 255, bThick);
  drawLine(pixels, size, size - margin, size - margin, size - margin, size - margin - bSize, 153, 69, 255, bThick);

  // Diagonal sword blade — bright green
  const bladeW = Math.round(3 * s);
  drawLine(pixels, size,
    cx - size * 0.20, cy + size * 0.22,
    cx + size * 0.22, cy - size * 0.24,
    20, 241, 149, bladeW
  );

  // Cross guard — purple
  const guardW = Math.round(2 * s);
  drawLine(pixels, size,
    cx - size * 0.10, cy - size * 0.01,
    cx + size * 0.08, cy + size * 0.03,
    153, 69, 255, guardW
  );

  // "SR" label
  const textScale = Math.max(1, Math.round(3 * s));
  const charW = 5 * textScale + textScale; // char width + gap
  const charH = 7 * textScale;
  const textX = Math.round(cx - charW - textScale / 2);
  const textY = Math.round(cy + size * 0.16);
  drawLetter(pixels, size, LETTER_S, textX, textY, textScale, 255, 255, 255);
  drawLetter(pixels, size, LETTER_R, textX + charW, textY, textScale, 255, 255, 255);

  // ── Encode as PNG ──────────────────────────────────────────────────────
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3);
    row[0] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixels[y][x];
      row[1 + x * 3]     = Math.max(0, Math.min(255, r));
      row[1 + x * 3 + 1] = Math.max(0, Math.min(255, g));
      row[1 + x * 3 + 2] = Math.max(0, Math.min(255, b));
    }
    rows.push(row);
  }
  const raw = Buffer.concat(rows);
  const compressed = deflateSync(raw, { level: 9 });

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type: RGB
  // compression=0, filter=0, interlace=0

  const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    PNG_SIG,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = new URL('../public', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

console.log('Generating icon-192.png...');
writeFileSync(outDir + '/icon-192.png', generateIcon(192));
console.log('Generating icon-512.png...');
writeFileSync(outDir + '/icon-512.png', generateIcon(512));
console.log('Done! PWA icons written to public/.');
