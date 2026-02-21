/**
 * generate-screenshots.js
 * Creates 8 placeholder screenshots (1080×1920 PNG) for Seeker dApp Store submission.
 * Each is dark-themed (matching SolRaid) with screen label rendered in a pixel font.
 * Replace with real device screenshots before final submission.
 *
 * Usage:  node scripts/generate-screenshots.js
 */

const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

const W = 1080;
const H = 1920;
const OUT_DIR = path.join(__dirname, '../.dapp-store/release/screenshots');
fs.mkdirSync(OUT_DIR, { recursive: true });

// ── 4×6 pixel font (uppercase A–Z, 0–9, space, colon, dash) ─────────────────
const FONT = {
  A: [0b0110,0b1001,0b1111,0b1001,0b1001],
  B: [0b1110,0b1001,0b1110,0b1001,0b1110],
  C: [0b0111,0b1000,0b1000,0b1000,0b0111],
  D: [0b1110,0b1001,0b1001,0b1001,0b1110],
  E: [0b1111,0b1000,0b1110,0b1000,0b1111],
  F: [0b1111,0b1000,0b1110,0b1000,0b1000],
  G: [0b0111,0b1000,0b1011,0b1001,0b0111],
  H: [0b1001,0b1001,0b1111,0b1001,0b1001],
  I: [0b1110,0b0100,0b0100,0b0100,0b1110],
  J: [0b0011,0b0001,0b0001,0b1001,0b0110],
  K: [0b1001,0b1010,0b1100,0b1010,0b1001],
  L: [0b1000,0b1000,0b1000,0b1000,0b1111],
  M: [0b1001,0b1111,0b1111,0b1001,0b1001],
  N: [0b1001,0b1101,0b1011,0b1001,0b1001],
  O: [0b0110,0b1001,0b1001,0b1001,0b0110],
  P: [0b1110,0b1001,0b1110,0b1000,0b1000],
  Q: [0b0110,0b1001,0b1001,0b1011,0b0111],
  R: [0b1110,0b1001,0b1110,0b1010,0b1001],
  S: [0b0111,0b1000,0b0110,0b0001,0b1110],
  T: [0b1111,0b0100,0b0100,0b0100,0b0100],
  U: [0b1001,0b1001,0b1001,0b1001,0b0110],
  V: [0b1001,0b1001,0b1001,0b0110,0b0110],
  W: [0b1001,0b1001,0b1111,0b1111,0b1001],
  X: [0b1001,0b0110,0b0110,0b0110,0b1001],
  Y: [0b1001,0b1001,0b0110,0b0100,0b0100],
  Z: [0b1111,0b0001,0b0110,0b1000,0b1111],
  '0': [0b0110,0b1001,0b1001,0b1001,0b0110],
  '1': [0b0110,0b0100,0b0100,0b0100,0b1110],
  '2': [0b0110,0b0001,0b0110,0b1000,0b1111],
  '3': [0b1110,0b0001,0b0110,0b0001,0b1110],
  '4': [0b1001,0b1001,0b1111,0b0001,0b0001],
  '5': [0b1111,0b1000,0b1110,0b0001,0b1110],
  '6': [0b0111,0b1000,0b1110,0b1001,0b0110],
  '7': [0b1111,0b0001,0b0010,0b0100,0b0100],
  '8': [0b0110,0b1001,0b0110,0b1001,0b0110],
  '9': [0b0110,0b1001,0b0111,0b0001,0b1110],
  ' ': [0,0,0,0,0],
  '-': [0,0b1110,0,0,0],
  ':': [0b0100,0,0b0100,0,0],
  '/': [0b0001,0b0010,0b0100,0b1000,0b1000],
};

/**
 * Draw a single character at pixel (px, py) with given scale and color.
 */
function drawChar(data, char, px, py, scale, r, g, b) {
  const rows = FONT[char.toUpperCase()] || FONT[' '];
  for (let row = 0; row < rows.length; row++) {
    for (let col = 0; col < 4; col++) {
      if (rows[row] & (1 << (3 - col))) {
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            const x = px + col * scale + sx;
            const y = py + row * scale + sy;
            if (x >= 0 && x < W && y >= 0 && y < H) {
              const idx = (W * y + x) << 2;
              data[idx] = r; data[idx+1] = g; data[idx+2] = b; data[idx+3] = 255;
            }
          }
        }
      }
    }
  }
}

/**
 * Draw a string centered at (cx, cy) with given char scale.
 */
function drawString(data, text, cx, cy, scale, r, g, b) {
  const CHAR_W = (4 + 1) * scale; // 4 pixels + 1 gap
  const totalW = text.length * CHAR_W - scale;
  let x = cx - Math.floor(totalW / 2);
  for (const ch of text) {
    drawChar(data, ch, x, cy - Math.floor(5 * scale / 2), scale, r, g, b);
    x += CHAR_W;
  }
}

/**
 * Generate one screenshot PNG.
 */
function generateScreenshot(filename, label, subLabel, accent) {
  const [ar, ag, ab] = accent;
  const png = new PNG({ width: W, height: H });
  const buf = png.data;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (W * y + x) << 2;

      // Base background
      let r = 2, g = 2, b = 2;

      // Subtle grid
      if (x % 60 === 0 || y % 60 === 0) { r = 16; g = 16; b = 16; }

      // Top gradient banner (240px)
      if (y < 240) {
        const t = (240 - y) / 240;
        r = Math.min(255, Math.round(r + ar * t * 0.28));
        g = Math.min(255, Math.round(g + ag * t * 0.28));
        b = Math.min(255, Math.round(b + ab * t * 0.28));
      }

      // Bottom nav bar (100px)
      if (y > H - 100) { r = 12; g = 12; b = 12; }

      // Scan line every 4px (subtle)
      if (y % 4 === 0) { r = Math.max(0, r - 2); g = Math.max(0, g - 2); b = Math.max(0, b - 2); }

      // Accent horizontal rule under banner
      if (y >= 238 && y <= 241) { r = ar; g = ag; b = ab; }

      // Center card background (40% width, 30% height region)
      const cardX1 = Math.floor(W * 0.3);
      const cardX2 = Math.floor(W * 0.7);
      const cardY1 = Math.floor(H * 0.38);
      const cardY2 = Math.floor(H * 0.62);
      if (x >= cardX1 && x <= cardX2 && y >= cardY1 && y <= cardY2) {
        r = Math.min(255, r + 14); g = Math.min(255, g + 14); b = Math.min(255, b + 14);
        // Card border
        if (x === cardX1 || x === cardX2 || y === cardY1 || y === cardY2) {
          r = ar; g = ag; b = ab;
        }
      }

      buf[idx] = r; buf[idx+1] = g; buf[idx+2] = b; buf[idx+3] = 255;
    }
  }

  // Draw "SOLANA RAID" in top banner (scale 6 → ~144px wide)
  drawString(buf, 'SOLANA RAID', W / 2, 120, 8, ar, ag, ab);

  // Draw main label centered on card
  const scale = label.length > 8 ? 9 : 12;
  drawString(buf, label, W / 2, H / 2 - 40, scale, ar, ag, ab);

  // Draw sub-label
  if (subLabel) {
    drawString(buf, subLabel, W / 2, H / 2 + 80, 5, 100, 100, 100);
  }

  const buffer = PNG.sync.write(png);
  fs.writeFileSync(filename, buffer);
  console.log(`  ✓ ${path.basename(filename)} (${(buffer.length / 1024).toFixed(0)} KB)`);
}

// ── Screen definitions ────────────────────────────────────────────────────────
const SCREENS = [
  { file: '01-lobby.png',       label: 'LOBBY',      sub: 'DEPLOY YOUR RAID',  accent: [239, 68, 68] },
  { file: '02-raid.png',        label: 'RAID',        sub: 'EXTRACT OR BUST',   accent: [239, 68, 68] },
  { file: '03-result.png',      label: 'RESULT',      sub: 'ON-CHAIN VERIFIED', accent: [74, 222, 128] },
  { file: '04-store.png',       label: 'STORE',       sub: 'GEAR UP',           accent: [234, 179, 8] },
  { file: '05-profile.png',     label: 'PROFILE',     sub: 'YOUR STATS',        accent: [99, 102, 241] },
  { file: '06-leaderboard.png', label: 'LEADERBOARD', sub: 'TOP RAIDERS',       accent: [239, 68, 68] },
  { file: '07-pvp-setup.png',   label: 'PVP',         sub: 'RAID TOGETHER',     accent: [249, 115, 22] },
  { file: '08-treasury.png',    label: 'TREASURY',    sub: 'CLAIM REWARDS',     accent: [20, 241, 149] },
];

console.log('\nGenerating screenshots...\n');
for (const { file, label, sub, accent } of SCREENS) {
  generateScreenshot(path.join(OUT_DIR, file), label, sub, accent);
}
console.log('\nDone! Replace with real screenshots before final submission.\n');
console.log('Output:', OUT_DIR);
