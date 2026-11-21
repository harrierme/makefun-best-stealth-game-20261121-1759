// Night Courier — bootstrap, state machine, HUD and the main loop.
//
// States: title -> brief -> playing -> (paused) -> caught -> playing ...
//        -> levelclear -> brief (next) -> victory | gameover.
// ?shot=title|play|alert|win poses a fixed scene for screenshots: real
// renders of this same code, frozen before the first painted frame.

import { LEVELS, parseLevel, reachable } from './levels.js';
import { createGame, updateGame, levelScore } from './engine.js';
import { drawGame } from './render.js';
import { SoundBank } from './audio.js';
import { Input } from './input.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const input = new Input(canvas);
const sfx = new SoundBank();

const $ = (id) => document.getElementById(id);
const hud = {
  level: $('hud-level'), files: $('hud-files'), coins: $('hud-coins'),
  attempts: $('hud-attempts'), timer: $('hud-timer'), score: $('hud-score'),
  banner: $('banner'), toast: $('toast'),
  overlay: $('overlay'), overlayTitle: $('overlay-title'),
  overlayBody: $('overlay-body'), overlayHint: $('overlay-hint'),
};

const params = new URLSearchParams(location.search);
const shotMode = params.get('shot');

const run = {
  state: 'title',
  levelIndex: 0,
  game: null,
  totalScore: 0,
  ghostLevels: 0,
  attempts: 3,
  frozen: false,
  toastTimer: 0,
  bannerTimer: 0,
};

function loadLevel(i) {
  const def = LEVELS[i];
  const parsed = parseLevel(def);
  if (!reachable(parsed.grid, parsed.player, [...parsed.files, parsed.exit])) {
    throw new Error(`level ${def.name}: a file or the exit is unreachable`);
  }
  run.game = createGame(def, parsed, run.attempts);
  run.levelIndex = i;
}

function showOverlay(title, body, hint) {
  hud.overlayTitle.textContent = title;
  hud.overlayBody.innerHTML = body;
  hud.overlayHint.textContent = hint;
  hud.overlay.classList.remove('hidden');
}

function hideOverlay() {
  hud.overlay.classList.add('hidden');
}

function showBanner(text, ms = 1800) {
  hud.banner.textContent = text;
  hud.banner.classList.remove('hidden');
  run.bannerTimer = ms / 1000;
}

function showToast(text, ms = 2600) {
  hud.toast.textContent = text;
  hud.toast.classList.remove('hidden');
  run.toastTimer = ms / 1000;
}

function fmtTime(t) {
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function refreshHud() {
  const g = run.game;
  if (!g) return;
  hud.level.textContent = g.levelDef.name;
  hud.files.textContent = `Berkas ${g.files.filter((f) => f.taken).length}/3`;
  hud.coins.textContent = `Koin ${g.coins}`;
  hud.attempts.textContent = `Nyawa ${g.attempts}`;
  hud.timer.textContent = fmtTime(g.time);
  hud.score.textContent = `Skor ${run.totalScore + g.score}`;
}

function startRun() {
  run.totalScore = 0;
  run.ghostLevels = 0;
  run.attempts = 3;
  loadLevel(0);
  run.state = 'brief';
  showOverlay(
    run.game.levelDef.name,
    `<p>${run.game.levelDef.brief}</p>
     <p class="keys">Gerak: WASD / panah &nbsp;·&nbsp; Jongkok: Shift &nbsp;·&nbsp; Lempar koin: klik mouse<br>
     Ambil berkas: jalan ke atasnya &nbsp;·&nbsp; Jeda: P &nbsp;·&nbsp; Ulangi level: R &nbsp;·&nbsp; Suara: M</p>`,
    'Tekan Enter untuk mulai menyelinap',
  );
}

function beginLevel() {
  hideOverlay();
  run.state = 'playing';
  showBanner(run.game.levelDef.name, 2200);
}

function onCaught() {
  const g = run.game;
  run.attempts -= 1;
  g.attempts = run.attempts;
  refreshHud();
  if (g.attempts <= 0) {
    run.state = 'gameover';
    showOverlay(
      'TERTANGKAP — MISI GAGAL',
      `<p>Penjaga memergokimu di ${g.levelDef.name}. Arsip tetap terkunci dan jejakmu terhapus dari catatan malam itu.</p>
       <p>Skor akhir: <b>${run.totalScore + g.score}</b></p>`,
      'Tekan Enter untuk mencoba lagi dari Lantai 1',
    );
  } else {
    run.state = 'caught';
    showOverlay(
      'TERTANGKAP!',
      `<p>Seorang penjaga menangkapmu. Kurir lain mengambil alih — tapi arsip masih menunggumu.</p>
       <p>Sisa nyawa: <b>${g.attempts}</b></p>`,
      'Tekan Enter untuk mencoba level ini lagi',
    );
  }
}

function onLevelWon() {
  const g = run.game;
  const s = levelScore(g);
  run.totalScore += s.total;
  if (!g.everAlerted) run.ghostLevels += 1;
  sfx.win();
  if (run.levelIndex + 1 >= LEVELS.length) {
    run.state = 'victory';
    showOverlay(
      'MISI SELESAI — HANTU ARSIP',
      `<p>Ketiga berkas sudah di tangan. Kau keluar dari Arsip Senja tanpa satu pun penjaga tahu kau pernah ada.</p>
       <p>Skor akhir: <b>${run.totalScore}</b> &nbsp;·&nbsp; Level tanpa alarm: <b>${run.ghostLevels}/3</b></p>`,
      'Tekan Enter untuk bermain lagi',
    );
  } else {
    run.state = 'levelclear';
    showOverlay(
      'LANTAI BERHASIL DILEWATI',
      `<p>${g.levelDef.name} selesai dalam ${fmtTime(g.time)}.</p>
       <p>Berkas 300 &nbsp;·&nbsp; Bonus waktu ${s.timeBonus} &nbsp;·&nbsp; Bonus hantu ${s.ghost}<br>
       Skor level: <b>${s.total}</b> &nbsp;·&nbsp; Skor total: <b>${run.totalScore}</b></p>`,
      'Tekan Enter untuk naik ke lantai berikutnya',
    );
  }
}

function handleEvents() {
  const g = run.game;
  for (const e of g.events) {
    if (e === 'file') showToast('Berkas rahasia didapat (+100)');
    if (e === 'coin') showToast('Koin dilempar — penjaga mendekat ke suara itu');
    if (e === 'no-coins') showToast('Koinmu habis!');
    if (e === 'exit-open') { showBanner('PINTU KELUAR TERBUKA — CEPAT!', 2600); }
    if (e === 'suspicious') showToast('Penjaga itu curiga — menghilanglah dari pandangannya');
    if (e === 'alert') { showBanner('ALARM! LARI DAN SEMBUNYI!', 2600); }
  }
  g.events.length = 0;
}

function update(dt) {
  if (run.state !== 'playing' || run.frozen) return;
  const g = run.game;
  if (input.pressed('p') || input.pressed('escape')) {
    run.state = 'paused';
    showOverlay('JEDA', '<p>Arsip menunggumu. Tarik napas.</p>', 'Tekan P atau Enter untuk lanjut');
    return;
  }
  if (input.pressed('r')) { loadLevel(run.levelIndex); showToast('Level diulang'); return; }
  updateGame(g, input, dt, sfx);
  handleEvents();
  if (g.caught) { onCaught(); return; }
  if (g.won) { onLevelWon(); return; }
  // Live alert banner while any guard chases.
  if (g.guards.some((x) => x.state === 'chase')) showBanner('ALARM! LARI DAN SEMBUNYI!', 500);
  refreshHud();
  if (run.bannerTimer > 0) {
    run.bannerTimer -= dt;
    if (run.bannerTimer <= 0) hud.banner.classList.add('hidden');
  }
  if (run.toastTimer > 0) {
    run.toastTimer -= dt;
    if (run.toastTimer <= 0) hud.toast.classList.add('hidden');
  }
}

function advance() {
  // Enter / click advances menus.
  if (run.state === 'title') { sfx.ensure(); startRun(); }
  else if (run.state === 'brief') beginLevel();
  else if (run.state === 'caught') { loadLevel(run.levelIndex); beginLevel(); }
  else if (run.state === 'levelclear') { loadLevel(run.levelIndex + 1); run.state = 'brief'; showOverlay(run.game.levelDef.name, `<p>${run.game.levelDef.brief}</p>`, 'Tekan Enter untuk mulai menyelinap'); }
  else if (run.state === 'gameover' || run.state === 'victory') startRun();
  else if (run.state === 'paused') { hideOverlay(); run.state = 'playing'; }
}

function draw(now) {
  if (run.game) drawGame(ctx, run.game, now);
}

// ---- Screenshot poses: real frames of this code, staged, then frozen. ----
function poseShot(kind) {
  if (kind === 'title') {
    loadLevel(0);
    run.state = 'title';
    showOverlay(
      'NIGHT COURIER',
      `<p class="tagline">Seorang kurir. Tiga berkas rahasia. Satu arsip yang tak pernah tidur.</p>
       <p>Masuk tanpa terlihat. Keluar tanpa jejak.</p>
       <p class="keys">WASD bergerak &nbsp;·&nbsp; Shift jongkok &nbsp;·&nbsp; Klik lempar koin &nbsp;·&nbsp; P jeda</p>`,
      'Tekan Enter untuk mulai',
    );
    return;
  }
  if (kind === 'win') {
    loadLevel(2);
    run.totalScore = 1540;
    run.ghostLevels = 2;
    run.game.files.forEach((f) => { f.taken = true; });
    run.game.score = 300;
    run.game.exit.open = true;
    run.game.time = 132.5;
    run.state = 'victory';
    showOverlay(
      'MISI SELESAI — HANTU ARSIP',
      `<p>Ketiga berkas sudah di tangan. Kau keluar dari Arsip Senja tanpa satu pun penjaga tahu kau pernah ada.</p>
       <p>Skor akhir: <b>1840</b> &nbsp;·&nbsp; Level tanpa alarm: <b>2/3</b></p>`,
      'Tekan Enter untuk bermain lagi',
    );
    return;
  }
  // play / alert: Lantai 2, mid-action, frozen.
  loadLevel(1);
  const g = run.game;
  run.state = 'playing';
  hideOverlay();
  // Player sneaking along the middle corridor, one file already taken.
  g.player.x = 20.5 * 40; g.player.y = 10.5 * 40;
  g.player.dir = 0; g.player.sneak = true;
  g.files[0].taken = true;
  g.score = 100;
  g.coins = 2; // one coin already thrown — the ping still ringing below
  // A coin ping still ringing near the left corridor.
  g.pings.push({ x: 10.5 * 40, y: 10.5 * 40, r: 46, ttl: 1.0 });
  // Guard 0 mid-patrol, cone sweeping toward the player.
  const g0 = g.guards[0];
  g0.x = 24.5 * 40; g0.y = 10.5 * 40; g0.dir = Math.PI; g0.suspicion = 62;
  g0.state = 'suspicious';
  g0.lastSeen = { x: g.player.x, y: g.player.y };
  // Guard 1 patrolling the lower corridor, calm cone.
  const g1 = g.guards[1];
  g1.x = 7.5 * 40; g1.y = 16.5 * 40; g1.dir = 0;
  if (kind === 'alert') {
    g0.state = 'chase';
    g0.suspicion = 100;
    g0.x = 22.5 * 40; g0.y = 10.5 * 40;
    g.everAlerted = true;
    showBanner('ALARM! LARI DAN SEMBUNYI!', 60000);
  } else {
    showToast('Penjaga itu curiga — menghilanglah dari pandangannya');
  }
  refreshHud();
  run.frozen = true;
}

// ---- Boot ----
loadLevel(0);
if (shotMode) {
  poseShot(shotMode);
} else {
  run.state = 'title';
  showOverlay(
    'NIGHT COURIER',
    `<p class="tagline">Seorang kurir. Tiga berkas rahasia. Satu arsip yang tak pernah tidur.</p>
     <p>Masuk tanpa terlihat. Keluar tanpa jejak.</p>
     <p class="keys">WASD bergerak &nbsp;·&nbsp; Shift jongkok &nbsp;·&nbsp; Klik lempar koin &nbsp;·&nbsp; P jeda</p>`,
    'Tekan Enter untuk mulai',
  );
}
refreshHud();

window.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') advance();
  if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && run.state === 'paused') advance();
  if (e.key === 'm' || e.key === 'M') { sfx.setMuted(!sfx.muted); if (run.state === 'playing') showToast(sfx.muted ? 'Suara mati' : 'Suara hidup'); }
  sfx.ensure();
});
canvas.addEventListener('mousedown', () => sfx.ensure());

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  draw(now / 1000);
  input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
