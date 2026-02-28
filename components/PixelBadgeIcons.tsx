import React from 'react';

// ── Pixel art renderer ───────────────────────────────────────────────────────
// Each icon is an 8×8 grid string. '.' = transparent, 'X' = primary color.
// Rendered as a crisp SVG — no anti-aliasing, pure pixel aesthetic.

interface PixelIconProps {
  pixels: string;
  color: string;
  size?: number;
  dimmed?: boolean;
}

const PixelIcon: React.FC<PixelIconProps> = ({ pixels, color, size = 28, dimmed = false }) => {
  const rows = pixels.split('\n');
  const h = rows.length;
  const w = Math.max(...rows.map(r => r.length));
  const fill = dimmed ? 'rgba(255,255,255,0.12)' : color;

  const rects: React.ReactNode[] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === 'X') {
        rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill} />);
      }
    }
  });

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={size}
      height={size}
      style={{ imageRendering: 'pixelated' } as React.CSSProperties}
      shapeRendering="crispEdges"
    >
      {rects}
    </svg>
  );
};

// ── Icon definitions ─────────────────────────────────────────────────────────

const ICONS: Record<string, { pixels: string; color: string }> = {

  // Crosshair — red
  FIRST_RAID: {
    color: '#FF2929',
    pixels: [
      '..XXXX..',
      '.X....X.',
      'X.X..X.X',
      'X..XX..X',
      'X..XX..X',
      'X.X..X.X',
      '.X....X.',
      '..XXXX..',
    ].join('\n'),
  },

  // Coin with hollow centre — gold
  FIRST_EXTRACT: {
    color: '#FFB800',
    pixels: [
      '..XXXX..',
      '.XXXXXX.',
      'XXXXXXXX',
      'XXX..XXX',
      'XXX..XXX',
      'XXXXXXXX',
      '.XXXXXX.',
      '..XXXX..',
    ].join('\n'),
  },

  // Diagonal sword — silver
  RAIDS_10: {
    color: '#94a3b8',
    pixels: [
      '.......X',
      '......XX',
      '.....XX.',
      '....XX..',
      '...XX...',
      '..XX....',
      '.XX.....',
      'XX......',
    ].join('\n'),
  },

  // Trophy cup — gold
  RAIDS_50: {
    color: '#FFB800',
    pixels: [
      'X......X',
      'X.XXXX.X',
      'XXXXXXXX',
      '.XXXXXX.',
      '..XXXX..',
      '...XX...',
      '.XXXXXX.',
      '.XXXXXX.',
    ].join('\n'),
  },

  // Crown with 3 peaks — gold
  RAIDS_100: {
    color: '#FFB800',
    pixels: [
      'X..X..X.',
      'X..X..X.',
      'XXXXXXXX',
      'X......X',
      'X......X',
      'XXXXXXXX',
      '........',
      '........',
    ].join('\n'),
  },

  // Diamond suit — blue
  WINS_10: {
    color: '#60a5fa',
    pixels: [
      '...XX...',
      '..XXXX..',
      '.XXXXXX.',
      'XXXXXXXX',
      'XXXXXXXX',
      '.XXXXXX.',
      '..XXXX..',
      '...XX...',
    ].join('\n'),
  },

  // Padlock — lavender
  WINS_50: {
    color: '#c4b5fd',
    pixels: [
      '..XXXX..',
      '.X....X.',
      '.X....X.',
      'XXXXXXXX',
      'X......X',
      'X..XX..X',
      'X..XX..X',
      'XXXXXXXX',
    ].join('\n'),
  },

  // Flame — orange
  DEGEN_SURVIVE: {
    color: '#f97316',
    pixels: [
      '...X....',
      '..XXX...',
      '.XXXXX..',
      'XXXXXXX.',
      'XXXXXXXX',
      'XXXXXXXX',
      '.XXXXXX.',
      '..XXXX..',
    ].join('\n'),
  },

  // Lightning bolt zigzag — yellow
  STREAK_3: {
    color: '#FFB800',
    pixels: [
      '..XXXX..',
      '.XX.....',
      'XX......',
      '.XXXXXX.',
      '......XX',
      '.....XX.',
      '..XXXX..',
      '........',
    ].join('\n'),
  },

  // 4-pointed star diamond — gold
  STREAK_7: {
    color: '#FFB800',
    pixels: [
      '...XX...',
      '..XXXX..',
      '.XXXXXX.',
      'XXXXXXXX',
      '.XXXXXX.',
      '..XXXX..',
      '...XX...',
      '........',
    ].join('\n'),
  },

  // Ascending bar chart — green
  HIGH_SCORE: {
    color: '#4ade80',
    pixels: [
      '......XX',
      '......XX',
      '....XXXX',
      '....XXXX',
      '..XXXXXX',
      '..XXXXXX',
      'XXXXXXXX',
      'XXXXXXXX',
    ].join('\n'),
  },

  // Shield — red
  PVP_WIN: {
    color: '#FF2929',
    pixels: [
      '.XXXXXX.',
      'XXXXXXXX',
      'XXXXXXXX',
      'XXXXXXXX',
      '.XXXXXX.',
      '..XXXX..',
      '...XX...',
      '....X...',
    ].join('\n'),
  },
};

// ── Public export ─────────────────────────────────────────────────────────────

interface BadgePixelIconProps {
  id: string;
  isEarned: boolean;
  size?: number;
}

const BadgePixelIcon: React.FC<BadgePixelIconProps> = ({ id, isEarned, size = 28 }) => {
  const def = ICONS[id];
  if (!def) return <span style={{ fontSize: '20px', filter: isEarned ? 'none' : 'grayscale(1)' }}>🎯</span>;

  return <PixelIcon pixels={def.pixels} color={def.color} size={size} dimmed={!isEarned} />;
};

export default BadgePixelIcon;
