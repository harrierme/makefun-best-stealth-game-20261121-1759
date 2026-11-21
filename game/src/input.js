// Night Courier — keyboard + mouse input. Movement is WASD or arrows,
// Shift sneaks, click throws a coin, E picks up / interacts, P pauses,
// R restarts the level, M mutes, Enter confirms on menus.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.mouse = { x: 0, y: 0, down: false };
    this._clicks = [];
    this._pressed = new Set();
    this._canvas = canvas;

    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      if (!e.repeat) this._pressed.add(e.key.toLowerCase());
      this.keys.add(e.key.toLowerCase());
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => { this.keys.clear(); });

    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
      this.mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const r = canvas.getBoundingClientRect();
      const x = (e.clientX - r.left) * (canvas.width / r.width);
      const y = (e.clientY - r.top) * (canvas.height / r.height);
      this._clicks.push({ x, y });
      this.mouse.down = true;
    });
    window.addEventListener('mouseup', () => { this.mouse.down = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // True only on the frame the key went down.
  pressed(key) {
    return this._pressed.has(key.toLowerCase());
  }

  // Drain one-shot events at the end of each frame.
  endFrame() {
    this._pressed.clear();
    this._clicks.length = 0;
  }

  takeClicks() {
    const c = this._clicks.slice();
    this._clicks.length = 0;
    return c;
  }

  moveVector() {
    let x = 0, y = 0;
    if (this.keys.has('a') || this.keys.has('arrowleft')) x -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) x += 1;
    if (this.keys.has('w') || this.keys.has('arrowup')) y -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) y += 1;
    if (x && y) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
    return { x, y };
  }

  get sneak() {
    return this.keys.has('shift');
  }
}
