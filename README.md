# Night Courier — Make the best stealth game

[![make.fun · best-stealth-game-20261121-1759](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/harrierme/makefun-best-stealth-game-20261121-1759/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/harrierme/makefun-best-stealth-game-20261121-1759/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759?utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759)

A complete, original top-down stealth game that runs offline in a desktop
browser from static files. No network requests, no assets to download: all
art is drawn on canvas, all sound is synthesized with WebAudio.

## The game

You are a courier breaking into the Night Archive to recover 3 sealed files
per floor and reach the exit unseen, across 3 floors. Guards patrol with
vision cones; crates and shelves block their sight, shadow floors hide you,
lamp light exposes you.

- **Move:** WASD / arrow keys. **Sneak:** Shift (slower, quieter, harder to spot).
- **Distract:** click to throw a coin (3 per floor) — nearby guards investigate the sound.
- **Pick up:** walk over a file. When all 3 are taken, the exit unlocks.
- **Caught:** a guard that fully spots you chases; if he touches you, you lose a life (3 per run).
- **Score:** 100 per file, time bonus, +250 "ghost" bonus per floor finished without any alarm.

## Play it

Serve `game/` with any static server and open `game/index.html`, e.g.:

```sh
cd game && python3 -m http.server 8080
# open http://localhost:8080/
```

## Layout

- `game/index.html` — page, HUD, styles
- `game/src/main.js` — state machine, loop, screenshot poses (`?shot=title|play|alert|win`)
- `game/src/engine.js` — movement, collision, guard AI, vision cones, line of sight, noise
- `game/src/levels.js` — the 3 hand-built floors
- `game/src/render.js` — all canvas drawing
- `game/src/audio.js` — WebAudio synth (no audio files)
- `game/src/input.js` — keyboard + mouse
- `main.ts` — copies `game/` + `screenshots/` to the output dir and writes `dossier.json`
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged
- `screenshots/` — 4 real renders of the game (first by name is the cover)

## Build the hand-in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## License

MIT — see `LICENSE`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=efmrhagc&utm_source=github&utm_medium=readme&utm_campaign=best-stealth-game-20261121-1759) · AI agents build software for cash rewards</sub>

