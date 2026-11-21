// Night Courier — all drawing. Canvas 2D primitives only: no image assets,
// so the game renders identically offline. Colours are a night archive:
// cold blue-grey floor, warm lamp pools, amber cones, teal player.

import { TILE, COLS, ROWS } from './levels.js';
import { VIEW_RANGE, VIEW_HALF_ANGLE } from './engine.js';

const W = COLS * TILE, H = ROWS * TILE;

// Deterministic per-tile variation from a hash — stable across frames.
function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) ^ 0x5bf03635;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

function coneColor(g) {
  if (g.state === 'chase') return 'rgba(235,64,52,';
  if (g.suspicion >= 50) return 'rgba(245,130,32,';
  return 'rgba(250,204,80,';
}

export function drawGame(ctx, game, now) {
  const grid = game.grid;
  // Floor.
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const t = grid[y][x];
      const px = x * TILE, py = y * TILE;
      const v = hash(x, y);
      if (t === '#') continue; // walls drawn last, on top
      let base;
      if (t === 'D') base = [16, 20, 34];
      else if (t === 'L') base = [52, 44, 30];
      else base = [30, 36, 52];
      const j = (v - 0.5) * 7;
      ctx.fillStyle = `rgb(${base[0] + j | 0},${base[1] + j | 0},${base[2] + j | 0})`;
      ctx.fillRect(px, py, TILE, TILE);
      // Grout lines + a faint checker so the floor reads as tiles.
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py + 0.5, TILE, TILE);
      if ((x + y) % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.02)';
        ctx.fillRect(px, py, TILE, TILE);
      }
      if (t === 'D') {
        ctx.fillStyle = 'rgba(8,10,22,0.35)';
        ctx.fillRect(px, py, TILE, TILE);
      }
    }
  }

  // Lamp pools: soft warm radial glow on L tiles.
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (grid[y][x] !== 'L') continue;
      const cx = (x + 0.5) * TILE, cy = (y + 0.5) * TILE;
      const g = ctx.createRadialGradient(cx, cy, 6, cx, cy, 95);
      g.addColorStop(0, 'rgba(255,196,110,0.34)');
      g.addColorStop(1, 'rgba(255,196,110,0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - 95, cy - 95, 190, 190);
      ctx.fillStyle = '#ffd98a';
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Crates and shelves.
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const t = grid[y][x];
      const px = x * TILE, py = y * TILE;
      if (t === 'C') {
        ctx.fillStyle = '#7a5a34';
        ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
        ctx.fillStyle = '#8d6b40';
        ctx.fillRect(px + 3, py + 3, TILE - 6, 8);
        ctx.strokeStyle = '#5b4125';
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 3.5, py + 3.5, TILE - 7, TILE - 7);
        ctx.beginPath();
        ctx.moveTo(px + 3, py + 3);
        ctx.lineTo(px + TILE - 3, py + TILE - 3);
        ctx.moveTo(px + TILE - 3, py + 3);
        ctx.lineTo(px + 3, py + TILE - 3);
        ctx.stroke();
      } else if (t === 'S') {
        ctx.fillStyle = '#4a3220';
        ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
        const cols = ['#a34d3f', '#3f6d8e', '#5d7a45', '#8e6f3f', '#6d4a7a'];
        for (let i = 0; i < 5; i++) {
          ctx.fillStyle = cols[(hash(x, y) * 5 + i) % 5 | 0];
          ctx.fillRect(px + 6 + i * 6, py + 7, 4, 26);
        }
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(px + 2, py + 2, TILE - 4, 4);
      }
    }
  }

  // Exit door.
  const ex = game.exit;
  const exTileX = Math.floor(ex.x / TILE), exTileY = Math.floor(ex.y / TILE);
  ctx.fillStyle = ex.open ? '#1f9d55' : '#5c3a3a';
  ctx.fillRect(exTileX * TILE + 2, exTileY * TILE + 2, TILE - 4, TILE - 4);
  ctx.fillStyle = ex.open ? '#34d399' : '#8a5a5a';
  ctx.fillRect(exTileX * TILE + 8, exTileY * TILE + 6, TILE - 16, TILE - 12);
  // Label sits on a pill above the door so it is never clipped by the floor edge.
  const label = ex.open ? 'EXIT' : 'LOCKED';
  ctx.font = 'bold 11px sans-serif';
  const lw = ctx.measureText(label).width + 12;
  ctx.fillStyle = 'rgba(4,7,17,0.85)';
  ctx.beginPath();
  ctx.roundRect(ex.x - lw / 2, ex.y - 34, lw, 17, 8);
  ctx.fill();
  ctx.fillStyle = ex.open ? '#34d399' : '#f87171';
  ctx.textAlign = 'center';
  ctx.fillText(label, ex.x, ex.y - 22);
  if (ex.open) {
    const pulse = 0.25 + 0.1 * Math.sin(now * 3);
    const g = ctx.createRadialGradient(ex.x, ex.y, 4, ex.x, ex.y, 70);
    g.addColorStop(0, `rgba(52,211,153,${pulse})`);
    g.addColorStop(1, 'rgba(52,211,153,0)');
    ctx.fillStyle = g;
    ctx.fillRect(ex.x - 70, ex.y - 70, 140, 140);
  }

  // Secret files: glowing folders.
  for (const f of game.files) {
    if (f.taken) continue;
    const bob = Math.sin(now * 2.4 + f.x) * 2;
    ctx.save();
    ctx.translate(f.x, f.y + bob);
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 34);
    g.addColorStop(0, 'rgba(96,165,250,0.5)');
    g.addColorStop(1, 'rgba(96,165,250,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-34, -34, 68, 68);
    ctx.fillStyle = '#dbeafe';
    ctx.fillRect(-11, -8, 22, 16);
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(-11, -8, 22, 5);
    ctx.fillStyle = '#1e3a5f';
    ctx.fillRect(-7, 1, 14, 2);
    ctx.fillRect(-7, 5, 9, 2);
    ctx.restore();
  }

  // Coin pings.
  for (const p of game.pings) {
    ctx.strokeStyle = `rgba(250,204,80,${Math.max(0, p.ttl)})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#facc50';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Vision cones (under the guards, above the floor).
  for (const g of game.guards) {
    const col = coneColor(g);
    ctx.fillStyle = col + '0.20)';
    ctx.beginPath();
    ctx.moveTo(g.x, g.y);
    ctx.arc(g.x, g.y, VIEW_RANGE, g.dir - VIEW_HALF_ANGLE, g.dir + VIEW_HALF_ANGLE);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = col + '0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(g.x, g.y);
    ctx.arc(g.x, g.y, VIEW_RANGE, g.dir - VIEW_HALF_ANGLE, g.dir + VIEW_HALF_ANGLE);
    ctx.closePath();
    ctx.stroke();
  }

  // Guards: dark uniform, cap, torch dot, suspicion arc.
  for (const g of game.guards) {
    const bob = Math.sin(g.walkPhase) * 1.5;
    ctx.save();
    ctx.translate(g.x, g.y + bob * 0.4);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 12, 13, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = g.state === 'chase' ? '#7f1d1d' : '#1f2937';
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.stroke();
    // Cap brim points where he looks.
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(Math.cos(g.dir) * 9, Math.sin(g.dir) * 9, 5, 0, Math.PI * 2);
    ctx.fill();
    // Torch dot ahead.
    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.arc(Math.cos(g.dir) * 17, Math.sin(g.dir) * 17, 2.5, 0, Math.PI * 2);
    ctx.fill();
    // Suspicion arc over his head.
    if (g.suspicion > 1) {
      const col = g.suspicion >= 100 ? '#ef4444' : g.suspicion >= 50 ? '#f97316' : '#facc15';
      ctx.strokeStyle = col;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 20, -Math.PI / 2, -Math.PI / 2 + (g.suspicion / 100) * Math.PI * 2);
      ctx.stroke();
      if (g.suspicion >= 50) {
        ctx.fillStyle = col;
        ctx.font = 'bold 15px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(g.state === 'chase' ? '!' : '?', 0, -24);
      }
    }
    ctx.restore();
  }

  // Player: teal hooded courier with a small lantern glow.
  const pl = game.player;
  const pg = ctx.createRadialGradient(pl.x, pl.y, 4, pl.x, pl.y, 46);
  pg.addColorStop(0, 'rgba(45,212,191,0.20)');
  pg.addColorStop(1, 'rgba(45,212,191,0)');
  ctx.fillStyle = pg;
  ctx.fillRect(pl.x - 46, pl.y - 46, 92, 92);
  ctx.save();
  ctx.translate(pl.x, pl.y + Math.sin(pl.walkPhase) * 1.2 * (pl.moving ? 1 : 0));
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(0, 11, 12, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = pl.sneak ? '#0f766e' : '#14b8a6';
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#5eead4';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 13, 0, Math.PI * 2);
  ctx.stroke();
  // Hood point + eyes face the movement direction.
  ctx.fillStyle = '#0f766e';
  ctx.beginPath();
  ctx.moveTo(Math.cos(pl.dir) * 13, Math.sin(pl.dir) * 13);
  ctx.lineTo(Math.cos(pl.dir + 2.4) * 9, Math.sin(pl.dir + 2.4) * 9);
  ctx.lineTo(Math.cos(pl.dir - 2.4) * 9, Math.sin(pl.dir - 2.4) * 9);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fef3c7';
  ctx.beginPath();
  ctx.arc(Math.cos(pl.dir + 0.45) * 6, Math.sin(pl.dir + 0.45) * 6, 1.8, 0, Math.PI * 2);
  ctx.arc(Math.cos(pl.dir - 0.45) * 6, Math.sin(pl.dir - 0.45) * 6, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Walls on top, with a lit top edge so rooms read as rooms.
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (grid[y][x] !== '#') continue;
      const px = x * TILE, py = y * TILE;
      const v = hash(x, y);
      const j = (v - 0.5) * 8;
      ctx.fillStyle = `rgb(${52 + j | 0},${58 + j | 0},${78 + j | 0})`;
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.fillRect(px, py, TILE, 4);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(px, py + TILE - 4, TILE, 4);
    }
  }

  // Night vignette: the archive is dark at the edges.
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.42, W / 2, H / 2, H * 0.95);
  vg.addColorStop(0, 'rgba(4,6,16,0)');
  vg.addColorStop(1, 'rgba(4,6,16,0.5)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}
