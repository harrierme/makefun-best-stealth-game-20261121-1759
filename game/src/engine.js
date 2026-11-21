// Night Courier — simulation: movement, collision, guard AI, vision cones,
// line of sight, suspicion, noise and objectives. Pure logic, no drawing;
// render.js owns all pixels.

import { TILE, COLS, ROWS, isSolid } from './levels.js';

export const VIEW_RANGE = 175;
export const VIEW_HALF_ANGLE = 0.62; // ~35 degrees each side
export const PLAYER_RADIUS = 13;
export const GUARD_RADIUS = 14;

const WALK_SPEED = 150;
const SNEAK_SPEED = 78;
const CHASE_SPEED = 168;
const INVESTIGATE_SPEED = 105;

function tileAt(grid, px, py) {
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
  if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return '#';
  return grid[ty][tx];
}

function blocksSight(grid, px, py) {
  return isSolid(tileAt(grid, px, py));
}

// Bresenham over tile centres: true when no sight-blocking tile lies between.
export function hasLineOfSight(grid, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / (TILE * 0.5)));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (blocksSight(grid, x0 + dx * t, y0 + dy * t)) return false;
  }
  return true;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Can this guard see the player right now? Returns 0..1 visibility, 0 = unseen.
export function visibility(grid, guard, player) {
  const dx = player.x - guard.x, dy = player.y - guard.y;
  const dist = Math.hypot(dx, dy);
  if (dist > VIEW_RANGE) return 0;
  const ang = Math.atan2(dy, dx);
  if (Math.abs(angleDiff(ang, guard.dir)) > VIEW_HALF_ANGLE) return 0;
  if (!hasLineOfSight(grid, guard.x, guard.y, player.x, player.y)) return 0;
  let v = 1 - (dist / VIEW_RANGE) * 0.55;
  if (player.sneak) v *= 0.45;
  const tile = tileAt(grid, player.x, player.y);
  if (tile === 'D') v *= 0.5; // shadow floor hides you
  if (tile === 'L') v *= 1.25; // lamp light exposes you
  if (player.moving && !player.sneak) v *= 1.15;
  return Math.min(1, v);
}

function moveCircle(grid, e, dx, dy, radius) {
  // Axis-separated so the circle slides along walls instead of sticking.
  let nx = e.x + dx;
  if (!circleHits(grid, nx, e.y, radius)) e.x = nx;
  let ny = e.y + dy;
  if (!circleHits(grid, e.x, ny, radius)) e.y = ny;
}

function circleHits(grid, x, y, r) {
  for (const [ox, oy] of [[-r, -r], [r, -r], [-r, r], [r, r], [0, -r], [0, r], [-r, 0], [r, 0]]) {
    if (isSolid(tileAt(grid, x + ox, y + oy))) return true;
  }
  return false;
}

export function createGame(levelDef, parsed, attempts = 3) {
  const p = parsed.player;
  const game = {
    levelDef,
    grid: parsed.grid,
    player: {
      x: (p.x + 0.5) * TILE, y: (p.y + 0.5) * TILE,
      dir: 0, sneak: false, moving: false, noise: 0,
      stepTimer: 0, walkPhase: 0,
    },
    guards: parsed.spawns.map((s, i) => {
      const def = levelDef.guards[i];
      const wp = def.path[0];
      return {
        x: (s.x + 0.5) * TILE, y: (s.y + 0.5) * TILE,
        dir: 0, path: def.path, wpIndex: 1, pause: 0,
        pauseTime: def.pause, speed: def.speed,
        suspicion: 0, state: 'patrol', // patrol | suspicious | investigate | chase
        lastSeen: null, loseTimer: 0, investigate: null, walkPhase: Math.random() * 6,
      };
    }),
    files: parsed.files.map((f) => ({ ...f, x: (f.x + 0.5) * TILE, y: (f.y + 0.5) * TILE })),
    exit: { x: (parsed.exit.x + 0.5) * TILE, y: (parsed.exit.y + 0.5) * TILE, open: false },
    coins: 3,
    pings: [], // {x, y, r, ttl} expanding coin rings
    attempts,
    time: 0,
    score: 0,
    everAlerted: false,
    caught: false,
    won: false,
    events: [], // one-frame strings main.js turns into sounds/toasts
  };
  return game;
}

function guardTarget(g) {
  const [tx, ty] = g.path[g.wpIndex % g.path.length];
  return { x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE };
}

function stepToward(game, g, tx, ty, speed, dt) {
  const dx = tx - g.x, dy = ty - g.y;
  const d = Math.hypot(dx, dy);
  if (d < 2) return true;
  const vx = (dx / d) * speed * dt, vy = (dy / d) * speed * dt;
  moveCircle(game.grid, g, vx, vy, GUARD_RADIUS);
  g.dir = Math.atan2(dy, dx);
  g.walkPhase += dt * 9;
  return Math.hypot(tx - g.x, ty - g.y) < 6;
}

export function updateGame(game, input, dt, sfx) {
  game.time += dt;
  const pl = game.player;
  const mv = input.moveVector();
  pl.sneak = input.sneak;
  pl.moving = mv.x !== 0 || mv.y !== 0;
  const speed = pl.sneak ? SNEAK_SPEED : WALK_SPEED;
  if (pl.moving) {
    pl.dir = Math.atan2(mv.y, mv.x);
    pl.walkPhase += dt * (pl.sneak ? 6 : 11);
    moveCircle(game.grid, pl, mv.x * speed * dt, mv.y * speed * dt, PLAYER_RADIUS);
    pl.stepTimer -= dt;
    if (pl.stepTimer <= 0) {
      pl.stepTimer = pl.sneak ? 0.55 : 0.38;
      sfx.step(pl.sneak);
      pl.noise = pl.sneak ? 0 : 55; // running feet are heard nearby
    }
  }
  pl.noise = Math.max(0, pl.noise - dt * 90);

  // Coin throws: click anywhere, the coin lands there (clamped to range).
  for (const c of input.takeClicks()) {
    if (game.coins <= 0) { game.events.push('no-coins'); continue; }
    const dx = c.x - pl.x, dy = c.y - pl.y;
    const d = Math.hypot(dx, dy);
    const maxThrow = 280;
    const k = d > maxThrow ? maxThrow / d : 1;
    const lx = pl.x + dx * k, ly = pl.y + dy * k;
    game.coins -= 1;
    game.pings.push({ x: lx, y: ly, r: 8, ttl: 1.1 });
    for (const g of game.guards) {
      if (Math.hypot(g.x - lx, g.y - ly) < 340 && g.state !== 'chase') {
        g.investigate = { x: lx, y: ly };
        g.state = 'investigate';
        g.suspicion = Math.max(g.suspicion, 30);
      }
    }
    sfx.coin();
    game.events.push('coin');
  }
  for (const p of game.pings) { p.r += dt * 260; p.ttl -= dt; }
  game.pings = game.pings.filter((p) => p.ttl > 0);

  // Pick up files with E (or by walking over them).
  for (const f of game.files) {
    if (!f.taken && Math.hypot(f.x - pl.x, f.y - pl.y) < 30) {
      f.taken = true;
      game.score += 100;
      sfx.pickup();
      game.events.push('file');
      if (game.files.every((x) => x.taken)) {
        game.exit.open = true;
        sfx.unlock();
        game.events.push('exit-open');
      }
    }
  }

  // Guards.
  for (const g of game.guards) {
    const vis = visibility(game.grid, g, pl);
    if (vis > 0) {
      const rate = 55 * vis;
      const before = g.suspicion;
      g.suspicion = Math.min(100, g.suspicion + rate * dt);
      g.lastSeen = { x: pl.x, y: pl.y };
      if (before < 50 && g.suspicion >= 50 && g.state === 'patrol') {
        g.state = 'suspicious';
        sfx.suspicious();
        game.events.push('suspicious');
      }
      if (g.suspicion >= 100 && g.state !== 'chase') {
        g.state = 'chase';
        g.loseTimer = 4;
        game.everAlerted = true;
        sfx.alert();
        game.events.push('alert');
      }
    } else {
      g.suspicion = Math.max(0, g.suspicion - 22 * dt);
      if (g.state === 'suspicious' && g.suspicion < 25) g.state = 'patrol';
    }

    if (g.state === 'patrol') {
      if (g.pause > 0) {
        g.pause -= dt;
      } else {
        const t = guardTarget(g);
        if (stepToward(game, g, t.x, t.y, g.speed, dt)) {
          g.wpIndex = (g.wpIndex + 1) % g.path.length;
          g.pause = g.pauseTime;
        }
      }
    } else if (g.state === 'suspicious') {
      if (g.lastSeen) g.dir = Math.atan2(g.lastSeen.y - g.y, g.lastSeen.x - g.x);
      // Stare a beat, then go look where you thought you saw something.
      g.pause -= dt;
      if (g.pause <= 0 && g.lastSeen) {
        g.investigate = { ...g.lastSeen };
        g.state = 'investigate';
      }
    } else if (g.state === 'investigate') {
      const t = g.investigate;
      if (t && stepToward(game, g, t.x, t.y, INVESTIGATE_SPEED, dt)) {
        g.investigate = null;
        g.pause = 1.4;
        g.state = 'patrol';
        g.suspicion = Math.max(g.suspicion, 20);
      }
    } else if (g.state === 'chase') {
      stepToward(game, g, pl.x, pl.y, CHASE_SPEED, dt);
      if (vis > 0) g.loseTimer = 4;
      else {
        g.loseTimer -= dt;
        if (g.loseTimer <= 0) {
          g.state = 'investigate';
          g.investigate = g.lastSeen ? { ...g.lastSeen } : { x: pl.x, y: pl.y };
          g.suspicion = 65;
        }
      }
      // Caught: a chasing guard touches you.
      if (Math.hypot(g.x - pl.x, g.y - pl.y) < GUARD_RADIUS + PLAYER_RADIUS - 2) {
        game.caught = true;
        sfx.caught();
        return;
      }
    }

    // A merely suspicious guard that bumps into you also catches you.
    if (g.state !== 'chase' && g.suspicion >= 50 &&
        Math.hypot(g.x - pl.x, g.y - pl.y) < GUARD_RADIUS + PLAYER_RADIUS - 2) {
      game.caught = true;
      sfx.caught();
      return;
    }

    // Footsteps are heard: a running player near a patrolling guard draws a look.
    if (pl.noise > 0 && g.state === 'patrol' &&
        Math.hypot(g.x - pl.x, g.y - pl.y) < 130) {
      g.investigate = { x: pl.x, y: pl.y };
      g.state = 'investigate';
      g.suspicion = Math.max(g.suspicion, 35);
    }
  }

  // Exit.
  if (game.exit.open && Math.hypot(game.exit.x - pl.x, game.exit.y - pl.y) < 34) {
    game.won = true;
  }
}

export function levelScore(game) {
  const timeBonus = Math.max(0, Math.round((game.levelDef.par - game.time) * 2));
  const ghost = game.everAlerted ? 0 : 250;
  return { timeBonus, ghost, total: game.score + timeBonus + ghost };
}
