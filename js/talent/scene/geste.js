// Le geste de creuser : doigt, souris, clavier.
// Aucun preventDefault, aucun écouteur touchmove : le défilement vertical reste natif (touch-action: pan-y).
const SEUIL = 8;                         // px avant de décider
const ANGLE_MAX = 35 * Math.PI / 180;    // brossage si l'angle avec l'horizontale ≤ 35°
const FILE = 128;                        // segments en attente, tampon circulaire

export class Geste {
  constructor(canvas, rappels) {
    this.canvas = canvas; this.r = rappels;
    this.seg = new Float32Array(FILE * 4); this.n = 0;
    this.actif = false; this.attente = false; this.id = -1;
    this.x = 0; this.y = 0; this.x0 = 0; this.y0 = 0;
    this.survol = { x: 0, y: 0, visible: false };
    const o = { passive: true };
    this.h = {
      down: (e) => this.down(e), move: (e) => this.move(e), up: (e) => this.up(e),
      leave: (e) => { if (e.pointerType === 'mouse') { this.survol.visible = false; this.r.survol(); } },
      key: (e) => this.key(e),
    };
    canvas.addEventListener('pointerdown', this.h.down, o);
    canvas.addEventListener('pointermove', this.h.move, o);
    canvas.addEventListener('pointerup', this.h.up, o);
    canvas.addEventListener('pointercancel', this.h.up, o);
    canvas.addEventListener('pointerleave', this.h.leave, o);
    canvas.addEventListener('keydown', this.h.key, o);
  }

  pt(e) { const b = this.canvas.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; }

  pousser(x0, y0, x1, y1) {
    if (this.n >= FILE) return;
    const k = this.n * 4; this.seg[k] = x0; this.seg[k + 1] = y0; this.seg[k + 2] = x1; this.seg[k + 3] = y1; this.n++;
    this.r.trait();
  }

  down(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const [x, y] = this.pt(e);
    this.id = e.pointerId; this.x = this.x0 = x; this.y = this.y0 = y;
    if (e.pointerType === 'mouse') { this.actif = true; this.pousser(x, y, x, y); }
    else { this.attente = true; this.actif = false; }
  }

  move(e) {
    const [x, y] = this.pt(e);
    if (e.pointerType === 'mouse') { this.survol.x = x; this.survol.y = y; this.survol.visible = true; this.r.survol(); }
    if (e.pointerId !== this.id) return;
    if (this.attente) {
      const dx = x - this.x0, dy = y - this.y0;
      if (Math.hypot(dx, dy) < SEUIL) return;
      this.attente = false;
      // geste horizontal : brossage ; sinon on laisse défiler (le navigateur enverra pointercancel)
      if (Math.atan2(Math.abs(dy), Math.abs(dx)) <= ANGLE_MAX) { this.actif = true; this.x = this.x0; this.y = this.y0; }
      else { this.id = -1; return; }
    }
    if (!this.actif) return;
    this.pousser(this.x, this.y, x, y);
    this.x = x; this.y = y;
  }

  up(e) { if (e.pointerId === this.id) { this.actif = false; this.attente = false; this.id = -1; } }

  key(e) {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') this.r.clavier(e.key === 'ArrowLeft' ? -1 : 1);
    else if (e.key === 'Enter') this.r.degager();
  }

  // Vide la file dans `f(x0, y0, x1, y1)`.
  vider(f) { for (let i = 0; i < this.n; i++) { const k = i * 4; f(this.seg[k], this.seg[k + 1], this.seg[k + 2], this.seg[k + 3]); } this.n = 0; }

  dispose() {
    const c = this.canvas, h = this.h;
    c.removeEventListener('pointerdown', h.down); c.removeEventListener('pointermove', h.move);
    c.removeEventListener('pointerup', h.up); c.removeEventListener('pointercancel', h.up);
    c.removeEventListener('pointerleave', h.leave); c.removeEventListener('keydown', h.key);
  }
}
