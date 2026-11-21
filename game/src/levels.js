// Night Courier — level data.
//
// Three hand-built night-archive floors. Maps are ASCII grids, one char per
// tile (tile = 40 px, 32 x 20 tiles = 1280 x 800, the whole floor fits the
// screen, no camera). Layout: a 14-wide west room, a 1-wide dividing wall
// with door gaps, a 15-wide east room, border walls all round. Legend:
//   # wall        . floor       D shadow floor (dark, harder to be spotted)
//   C crate       S shelf       L lamp floor (warm light, easier to be seen)
//   P player start  F secret file  E exit door  G guard spawn (floor under it)
// Guard patrol waypoints live beside each map as tile coordinates.

export const TILE = 40;
export const COLS = 32;
export const ROWS = 20;

export const LEVELS = [
  {
    name: 'Lantai 1 — Ruang Arsip',
    brief: 'Ambil 3 berkas rahasia, lalu capai pintu keluar tanpa terlihat. Jongkok (Shift) di bayangan, lempar koin (klik) untuk mengalihkan penjaga.',
    par: 150,
    map: [
      '################################',
      '#P....C........#.......F.......#',
      '#..............#...............#',
      '#..C......#.......C.....#......#',
      '#..............#...............#',
      '####...####....#...#######.....#',
      '#..............#...............#',
      '#..F.....C.....#......C...#....#',
      '#..............#...............#',
      '#..C.......#......G......#..C..#',
      '#..............#...............#',
      '####...#####...#...#######..####',
      '#..............#...............#',
      '#..C.....C.....#......C...#....#',
      '#..............#...............#',
      '#..G.....#........C......#..F..#',
      '#..............#...............#',
      '#..C.......#...#.........#.....#',
      '#..............#...............#',
      '#....E.........#.........#.....#',
    ],
    guards: [
      { path: [[18, 9], [24, 9], [24, 8], [18, 8]], speed: 62, pause: 1.2 },
      { path: [[3, 15], [8, 15], [8, 16], [3, 16]], speed: 62, pause: 1.2 },
    ],
  },
  {
    name: 'Lantai 2 — Galeri Peta',
    brief: 'Galeri lebih ramai: 3 penjaga, lorong sempit, dan lampu di mana-mana. Bayangan adalah temanmu.',
    par: 180,
    map: [
      '################################',
      '#P...C.........#.....C......F..#',
      '#...DDD........#...............#',
      '#..S...#.........#...#....#....#',
      '#..............#...............#',
      '###..####......#...#####....####',
      '#..............#......L........#',
      '#..F...C.......#.....C..#..#.G.#',
      '#..............#...............#',
      '#..C....#.........S...#....#...#',
      '#..............#...............#',
      '####..###......#....####...#...#',
      '#..............#...............#',
      '#..C....C......#.....C.....#.F.#',
      '#......DDD.....#...............#',
      '#..G....#.........G...#....#...#',
      '#..............#...............#',
      '#..C...#.......#.....C..#..#...#',
      '#..............#...............#',
      '#....E.........#.....C......#..#',
    ],
    guards: [
      { path: [[29, 7], [25, 7], [25, 8], [29, 8]], speed: 72, pause: 1.0 },
      { path: [[3, 15], [7, 15], [7, 16], [3, 16]], speed: 72, pause: 1.0 },
      { path: [[18, 15], [21, 15], [21, 14], [18, 14]], speed: 72, pause: 0.8 },
    ],
  },
  {
    name: 'Lantai 3 — Brankas Senja',
    brief: 'Lantai terakhir. 4 penjaga, brankas dijaga ketat. Satu langkah salah dan alarm berbunyi — tapi hantu tak pernah tertangkap.',
    par: 210,
    map: [
      '################################',
      '#P....C........#....C......F...#',
      '#...DDD........#...............#',
      '#..S...#.........#...#...#...C.#',
      '#..............#...............#',
      '###..###.......#...####....#...#',
      '#..............#.......L.......#',
      '#..F...C.......#....C..#..#..G.#',
      '#..............#...............#',
      '#..C...#..........S...#...#...C#',
      '#..............#...............#',
      '####..##.......#...#####...#...#',
      '#..............#...............#',
      '#..C...C.......#....C.....#..F.#',
      '#......DDD.....#...............#',
      '#..G...#..........G...#...#...C#',
      '#..............#...............#',
      '#..C..#........#....C..#..#..G.#',
      '#..............#...............#',
      '#...E..........#....C.....#..C.#',
    ],
    guards: [
      { path: [[29, 7], [27, 7], [27, 8], [29, 8]], speed: 82, pause: 0.8 },
      { path: [[3, 15], [6, 15], [6, 16], [3, 16]], speed: 82, pause: 0.8 },
      { path: [[18, 15], [21, 15], [21, 14], [18, 14]], speed: 82, pause: 0.7 },
      { path: [[29, 17], [27, 17], [27, 18], [29, 18]], speed: 82, pause: 0.7 },
    ],
  },
];

// Parse a level map into grid + entities. Throws on malformed maps so a bad
// level fails loudly at load instead of silently at play.
export function parseLevel(def) {
  if (def.map.length !== ROWS) throw new Error(`level ${def.name}: ${def.map.length} rows, want ${ROWS}`);
  const grid = [];
  let player = null;
  const files = [];
  let exit = null;
  const spawns = [];
  for (let y = 0; y < ROWS; y++) {
    const row = def.map[y];
    if (row.length !== COLS) throw new Error(`level ${def.name} row ${y}: ${row.length} cols, want ${COLS}`);
    const out = [];
    for (let x = 0; x < COLS; x++) {
      const ch = row[x];
      if (!'# .DCSLPFEG'.includes(ch)) throw new Error(`level ${def.name}: bad char ${ch} at ${x},${y}`);
      let t = ch;
      if (ch === 'P') { player = { x, y }; t = '.'; }
      if (ch === 'F') { files.push({ x, y, taken: false }); t = '.'; }
      if (ch === 'E') { exit = { x, y }; t = '.'; }
      if (ch === 'G') { spawns.push({ x, y }); t = '.'; }
      out.push(t);
    }
    grid.push(out);
  }
  if (!player) throw new Error(`level ${def.name}: no player start`);
  if (files.length !== 3) throw new Error(`level ${def.name}: ${files.length} files, want 3`);
  if (!exit) throw new Error(`level ${def.name}: no exit`);
  if (spawns.length !== def.guards.length) {
    throw new Error(`level ${def.name}: ${spawns.length} guard spawns, ${def.guards.length} patrols`);
  }
  for (const g of def.guards) {
    for (const [wx, wy] of g.path) {
      if (grid[wy][wx] !== '.' && grid[wy][wx] !== 'D' && grid[wy][wx] !== 'L') {
        throw new Error(`level ${def.name}: patrol waypoint ${wx},${wy} is not walkable (${grid[wy][wx]})`);
      }
    }
  }
  return { grid, player, files, exit, spawns };
}

export function isSolid(tile) {
  return tile === '#' || tile === 'C' || tile === 'S';
}

// Breadth-first reachability over walkable tiles (for the load-time check).
export function reachable(grid, from, targets) {
  const seen = new Set([from.x + ',' + from.y]);
  const q = [{ x: from.x, y: from.y }];
  const want = new Set(targets.map((t) => t.x + ',' + t.y));
  const found = new Set();
  while (q.length) {
    const c = q.shift();
    const k = c.x + ',' + c.y;
    if (want.has(k)) found.add(k);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = c.x + dx, ny = c.y + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      if (isSolid(grid[ny][nx])) continue;
      const nk = nx + ',' + ny;
      if (!seen.has(nk)) { seen.add(nk); q.push({ x: nx, y: ny }); }
    }
  }
  return found.size === want.size;
}
