// La fouille de la scène 8 : grille de profondeur creusée au pinceau, retrait seul selon t8,
// part du disque découverte. Seule mémoire de la scène avec les grains en vol : gardée tant que T ≥ 57,0.
import * as THREE from '../../vendor/three.module.min.js';
import { ROT_X, ROT_Z, bordFouille, largeurBande, ease, clamp01 } from './recette.js';

const COS_X = Math.cos(ROT_X), CZ = Math.cos(-ROT_Z), SZ = Math.sin(-ROT_Z);

// Retrait seul : demi-largeur du front (en rayons), de la fente vers les bords, en 6 s (power2In : 4 % à 2 s, 30 % à 4 s).
export function frontRetrait(t8, w0) {
  if (!(t8 > 0)) return 0;
  return w0 + (1.02 - w0) * largeurBande(ease.power2In(clamp01(t8 / 6)));
}
// Profondeur (0 à 4 couches) du retrait seul, en coordonnées locales de la pièce (rayons). Même formule dans le shader.
export function profRetrait(lx, ly, wf) {
  if (wf <= 0) return 0;
  const wy = wf * Math.sqrt(Math.max(0, 1 - (ly / 1.18) * (ly / 1.18)));
  if (wy <= 0) return 0;
  return 4 * clamp01(1 - (Math.abs(lx) - wy - bordFouille(ly)) / 0.10);
}

export class Fouille {
  constructor(n) {
    this.n = n;
    this.prof = new Float32Array(n * n);
    this.texData = new Uint8Array(n * n);
    this.ajout = new Float32Array(n * n);
    this.marque = new Uint32Array(n * n);
    this.tex = new THREE.DataTexture(this.texData, n, n, THREE.RedFormat, THREE.UnsignedByteType);
    this.tex.magFilter = this.tex.minFilter = THREE.LinearFilter;
    this.tex.needsUpdate = true;
    this.vierge = true; this.W = 1; this.H = 1;
  }

  taille(W, H) { this.W = W; this.H = H; }

  // La terre se referme (T < 57,0) ou la taille change.
  vider() {
    if (this.vierge) return;
    this.prof.fill(0); this.texData.fill(0); this.ajout.fill(0); this.marque.fill(0);
    this.tex.needsUpdate = true; this.vierge = true;
  }

  // Coordonnées locales (rayons) d'un point écran, pièce inclinée (14° / −9°) vue de face.
  locale(x, y, e, s) {
    const dx = x - e.cx, dy = e.cy - y;
    s.x = (CZ * dx - SZ * dy) / e.r;
    s.y = (SZ * dx + CZ * dy) / COS_X / e.r;
    return s;
  }

  // Un passage de pinceau : 0,5 couche par longueur de pinceau, profil (1 − (r/R)²)², plafond 0,5 couche par image.
  brosser(x0, y0, x1, y1, D, image) {
    const n = this.n, W = this.W, H = this.H, R = D / 2;
    const L = Math.hypot(x1 - x0, y1 - y0);
    const quantite = 0.5 * Math.max(L, D * 0.08) / D;
    const i0 = Math.max(0, Math.floor((Math.min(x0, x1) - R) / W * n)), i1 = Math.min(n - 1, Math.ceil((Math.max(x0, x1) + R) / W * n));
    const j0 = Math.max(0, Math.floor((H - Math.max(y0, y1) - R) / H * n)), j1 = Math.min(n - 1, Math.ceil((H - Math.min(y0, y1) + R) / H * n));
    const bx = x1 - x0, by = y1 - y0, bb = bx * bx + by * by || 1;
    let change = false;
    for (let j = j0; j <= j1; j++) {
      const y = H - (j + 0.5) / n * H;
      for (let i = i0; i <= i1; i++) {
        const x = (i + 0.5) / n * W;
        const t = Math.min(1, Math.max(0, ((x - x0) * bx + (y - y0) * by) / bb));
        const ddx = x - x0 - bx * t, ddy = y - y0 - by * t;
        const q = (ddx * ddx + ddy * ddy) / (R * R);
        if (q >= 1) continue;
        const k = j * n + i;
        if (this.prof[k] >= 4) continue;
        if (this.marque[k] !== image) { this.marque[k] = image; this.ajout[k] = 0; }
        const add = Math.min(quantite * (1 - q) * (1 - q), 0.5 - this.ajout[k]);
        if (add <= 0) continue;
        this.ajout[k] += add;
        this.prof[k] = Math.min(4, this.prof[k] + add);
        this.texData[k] = Math.round(this.prof[k] * 63.75);
        change = true;
      }
    }
    if (change) { this.tex.needsUpdate = true; this.vierge = false; }
    return change;
  }

  // Part du disque découverte : pinceau, retrait seul (front wf) ou intérieur de la fente (dansFente(x, y)).
  // Rend { ratio, ratioFente, premier : un point découvert par la fouille hors de la fente }.
  mesurer(e, wf, dansFente, sortie) {
    const n = this.n, W = this.W, H = this.H, l = { x: 0, y: 0 };
    const ext = e.r * 1.05;
    const i0 = Math.max(0, Math.floor((e.cx - ext) / W * n)), i1 = Math.min(n - 1, Math.ceil((e.cx + ext) / W * n));
    const j0 = Math.max(0, Math.floor((H - e.cy - ext) / H * n)), j1 = Math.min(n - 1, Math.ceil((H - e.cy + ext) / H * n));
    let total = 0, dec = 0, fente = 0, premier = false;
    for (let j = j0; j <= j1; j++) {
      const y = H - (j + 0.5) / n * H;
      for (let i = i0; i <= i1; i++) {
        const x = (i + 0.5) / n * W;
        this.locale(x, y, e, l);
        if (l.x * l.x + l.y * l.y > 1) continue;
        total++;
        const f = dansFente(x, y);
        const d = Math.max(this.prof[j * n + i], profRetrait(l.x, l.y, wf));
        if (f) fente++;
        if (f || d >= 3.99) dec++;
        if (!f && d >= 3.99) premier = true;
      }
    }
    sortie.ratio = total ? dec / total : 0;
    sortie.ratioFente = total ? fente / total : 0;
    sortie.premier = premier;
    return sortie;
  }

  // Profondeur creusée au pinceau en un point écran (couleur des éclats).
  profondeurEn(x, y) {
    const n = this.n;
    const i = Math.min(n - 1, Math.max(0, Math.floor(x / this.W * n)));
    const j = Math.min(n - 1, Math.max(0, Math.floor((this.H - y) / this.H * n)));
    return this.prof[j * n + i];
  }

  // Rééchantillonnage vers une autre grille (descente de palier).
  copierDans(autre) {
    const a = this.n, b = autre.n;
    for (let j = 0; j < b; j++) for (let i = 0; i < b; i++) {
      const v = this.prof[Math.min(a - 1, Math.floor((j + 0.5) / b * a)) * a + Math.min(a - 1, Math.floor((i + 0.5) / b * a))];
      autre.prof[j * b + i] = v; autre.texData[j * b + i] = Math.round(v * 63.75);
    }
    autre.tex.needsUpdate = true; autre.vierge = this.vierge;
  }

  dispose() { this.tex.dispose(); }
}
