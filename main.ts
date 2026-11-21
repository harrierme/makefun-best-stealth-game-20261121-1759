// Night Courier — the entrypoint (Node 22, standard library only).
//
// It hands the game in: copies this directory's game/ and screenshots/
// beside it into the output directory and writes dossier.json there, the
// summary the judge reads, using the vendored make.fun library.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function treeSize(dir) {
  let files = 0, bytes = 0;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      const sub = treeSize(p);
      files += sub.files;
      bytes += sub.bytes;
    } else {
      files += 1;
      bytes += st.size;
    }
  }
  return { files, bytes };
}

// Caps from the competition's gate: game/ at most 993 entries / 48 MiB,
// index.html at most 1 MiB, 3-4 screenshots at most 256 KiB each.
const gameDir = join(repoRoot, 'game');
const gameStats = treeSize(gameDir);
if (gameStats.files > 993) throw new Error(`game/ holds ${gameStats.files} entries, over the 993 cap`);
if (gameStats.bytes > 48 * 1024 * 1024) throw new Error(`game/ is ${gameStats.bytes} bytes, over the 48 MiB cap`);
if (statSync(join(gameDir, 'index.html')).size > 1024 * 1024) {
  throw new Error('game/index.html is over the 1 MiB cap');
}

mkdirSync(outDir, { recursive: true });
cpSync(gameDir, join(outDir, 'game'), { recursive: true });

const shotsDir = join(repoRoot, 'screenshots');
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(shotsDir)) {
  const shots = readdirSync(shotsDir)
    .filter((n) => /\.(png|jpe?g)$/i.test(n))
    .sort();
  if (shots.length < 3 || shots.length > 4) {
    throw new Error(`screenshots/ holds ${shots.length} images, want 3 or 4`);
  }
  for (const s of shots) {
    if (statSync(join(shotsDir, s)).size > 256 * 1024) {
      throw new Error(`screenshots/${s} is over the 256 KiB cap`);
    }
  }
  cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });
}

writeFileSync(
  join(outDir, 'dossier.json'),
  buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

console.log(`Night Courier handed in: ${gameStats.files} game files, ${gameStats.bytes} bytes -> ${outDir}`);
