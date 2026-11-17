// La pluie de terre (scène 3) et les éclats (scène 8).
// Pluie : un seul THREE.Points ; chaque grain est une fonction de l'horloge (lancement, délai, vitesse) calculée dans le
// shader : en mode automatique, les neuf crans donnent une image identique pour un même T (aucune mémoire).
// En mode libre, les grains sont lancés au défilement (mémoire des grains en vol).
// Éclats : quelques particules simulées en JS (pinceau, terre qui tombe quand la pièce est libre).
import * as THREE from '../../vendor/three.module.min.js';
import { COULEURS, CRANS, DUREE_CRAN, q3Auto } from './recette.js';

// Tour 2 : des grains de terre, pas des étincelles. Grains ronds ou anguleux de 1,5 à 4 px (allongement ≤ 1,4),
// Ocre profond et Ambre profond ; Braise seulement à moins de 1,6 R de la pièce (10 % des grains au plus).
// Chaque pelletée part en paquet : bande de 0,25 de la largeur, centrée à ± 0,15 de l'axe, grains tombés en moins de 0,5 s.
// Les grains sont dans la nuit : la croix les éclaire comme elle éclaire la terre (uCL).
const vertPluie = /* glsl */`
attribute float aT0; attribute float aDelai; attribute float aX; attribute float aY0; attribute float aV;
attribute float aTaille; attribute float aSorte;
uniform float uHorloge, uDpr, uCroix, uTexteBas; uniform vec2 uRes; uniform vec2 uCam; uniform vec3 uSurf; uniform vec4 uPiece;
uniform vec4 uCL;
uniform vec3 cOcre, cAmbre, cBraise;
varying float vAlpha; varying vec3 vCouleur; varying float vGraine; varying float vAllonge;
void main() {
  float age = uHorloge - aT0 - aDelai;
  vAlpha = 0.0; vec2 s = vec2(-100.0);
  if (age > 0.0 && age < 1.2) {
    float yw = aY0 * uRes.y + (aV * age + 4.0 * age * age) * uRes.y;   // lancé, puis la pesanteur (8 h/s²)
    float xw = aX * uRes.x + 3.0 * sin(age * 5.0 + aV * 20.0);
    float surf = uSurf.x - uSurf.y * exp(-(xw / uSurf.z) * (xw / uSurf.z)) + 2.5 * sin(xw * 0.021 + 0.6) + 1.5 * sin(xw * 0.053 + 2.0);
    s = vec2(0.5 * uRes.x + xw * uCam.y, (yw - uCam.x) * uCam.y + 0.5 * uRes.y);
    if (yw < surf + 2.0) vAlpha = smoothstep(uTexteBas, uTexteBas + 24.0, s.y);
  }
  float dC = length(s - uPiece.xy);
  float pres = step(dC, 1.6 * max(uPiece.z, 1.0));
  vec3 c = aSorte < 0.5 ? cOcre : cAmbre;
  if (aSorte > 1.5) c = mix(cAmbre, cBraise, pres);
  float E = uCL.y * (1.0 - smoothstep(0.0, 2.0 * uCL.x, dC));
  vCouleur = c * (0.72 + 0.28 * min(1.0, E));
  vGraine = fract(aV * 37.1 + aTaille * 3.7);
  vAllonge = 1.0 + 0.4 * fract(aV * 11.3);
  gl_PointSize = aTaille * 1.45 * uDpr;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(s.x, uRes.y - s.y, 0.0, 1.0);
}`;
const fragPluie = /* glsl */`
varying float vAlpha; varying vec3 vCouleur; varying float vGraine; varying float vAllonge;
void main() {
  if (vAlpha <= 0.0) discard;
  vec2 p = gl_PointCoord - 0.5;
  p.y /= vAllonge;                                   // un peu allongé dans la chute (≤ 1,4 pour 1)
  float r = length(p) * (1.0 + 0.2 * sin(5.0 * atan(p.y, p.x) + vGraine * 6.2832)); // contour anguleux
  float a = 1.0 - smoothstep(0.30, 0.36, r);
  if (a <= 0.0) discard;
  gl_FragColor = vec4(vCouleur, vAlpha * a);
  #include <colorspace_fragment>
}`;

// générateur pseudo-aléatoire fixe (mêmes grains à chaque chargement)
function alea(graine) { let g = graine; return () => { g = (g * 16807) % 2147483647; return g / 2147483647; }; }

export class Pluie {
  constructor(max) {
    this.max = max; this.prochain = 0;
    const r = alea(7);
    const a = (n) => new Float32Array(n);
    this.t0 = a(max); this.delai = a(max); this.x = a(max); this.y0 = a(max); this.v = a(max); this.taille = a(max); this.sorte = a(max);
    const COTE = [1, -1, 1, -1, -1, 1, -1, 1, 1];      // côté de chaque pelletée (cran i mod 9)
    for (let i = 0; i < max; i++) {
      const k = i % CRANS.length;
      this.x[i] = COTE[k] * 0.15 + (r() + r() - 1) * 0.125; // bande de 0,25 de la largeur, centrée à ± 0,15
      this.delai[i] = r() * 0.12;                         // le paquet part en 0,12 s
      this.v[i] = 0.5 + 0.3 * r();
      this.taille[i] = 1.5 + 2.5 * r() * r();
      const s = r(); this.sorte[i] = s < 0.45 ? 0 : s < 0.9 ? 1 : 2;
    }
    const geo = new THREE.BufferGeometry();
    const att = (arr) => new THREE.BufferAttribute(arr, 1);
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(max * 3), 3));
    geo.setAttribute('aT0', att(this.t0).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aY0', att(this.y0).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aDelai', att(this.delai)); geo.setAttribute('aX', att(this.x)); geo.setAttribute('aV', att(this.v));
    geo.setAttribute('aTaille', att(this.taille)); geo.setAttribute('aSorte', att(this.sorte));
    this.geo = geo;
    const c = (h) => new THREE.Color(h);
    this.uniforms = {
      uHorloge: { value: 0 }, uDpr: { value: 1 }, uCroix: { value: 0 }, uTexteBas: { value: 0 },
      uRes: { value: new THREE.Vector2(1, 1) }, uCam: { value: new THREE.Vector2(0, 1) }, uSurf: { value: new THREE.Vector3(1e6, 0, 100) },
      uPiece: { value: new THREE.Vector4() }, uCL: { value: new THREE.Vector4(1, 0, 1, 0) },
      cOcre: { value: c(COULEURS.ocre) }, cAmbre: { value: c(COULEURS.ambre) }, cBraise: { value: c(COULEURS.braise) },
    };
    this.material = new THREE.ShaderMaterial({ vertexShader: vertPluie, fragmentShader: fragPluie, uniforms: this.uniforms, transparent: true, depthTest: false, depthWrite: false });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false; this.points.renderOrder = 2;
    this.mode = '';
  }

  // Combien de grains dessiner : 9 crans × 2 200 (haut) ou 9 × 550 (moyen) ; le cran d'un grain est i mod 9.
  compte(n) { this.geo.setDrawRange(0, Math.min(this.max, n)); }

  // Mode automatique : chaque grain part avec son cran, du haut du cadre de ce moment-là.
  auto() {
    if (this.mode === 'auto') return;
    this.mode = 'auto';
    for (let i = 0; i < this.max; i++) {
      const k = i % CRANS.length, t = CRANS[k];
      this.t0[i] = t;
      this.y0[i] = (0.50 + 0.30 * q3Auto(t)) - 0.5 - 0.02 - 0.03 * ((i * 0.618) % 1);
    }
    this.geo.attributes.aT0.needsUpdate = this.geo.attributes.aY0.needsUpdate = true;
  }

  // Mode libre : les grains en vol continuent ; les nouveaux partent à l'heure `maintenant` (horloge libre).
  libre() { this.mode = 'libre'; }

  // Lance n grains (mode libre) depuis le haut du cadre (yHaut en h, dans le monde).
  lancer(n, maintenant, yHaut, limite) {
    n = Math.min(n, limite);
    for (let j = 0; j < n; j++) {
      const i = this.prochain; this.prochain = (i + 1) % limite;
      this.t0[i] = maintenant; this.y0[i] = yHaut - 0.06 * ((i * 0.618) % 1);
    }
    if (n > 0) this.geo.attributes.aT0.needsUpdate = this.geo.attributes.aY0.needsUpdate = true;
  }

  dispose() { this.geo.dispose(); this.material.dispose(); }
}

// --- éclats (code de la v1, gardé) : particules simulées, tampons alloués une fois
const vert = /* glsl */`
attribute float aAlpha; attribute float aTaille; attribute vec3 aCouleur;
uniform float uDpr; varying float vAlpha; varying vec3 vCouleur;
void main() { vAlpha = aAlpha; vCouleur = aCouleur; gl_PointSize = aTaille * uDpr;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const frag = /* glsl */`
varying float vAlpha; varying vec3 vCouleur;
void main() { if (vAlpha <= 0.0) discard; gl_FragColor = vec4(vCouleur, vAlpha);
  #include <colorspace_fragment>
}`;

export class Eclats {
  constructor(max) {
    this.max = max; this.vivantes = 0; this.H = 1; this.g = 2200;
    this.pos = new Float32Array(max * 3); this.alpha = new Float32Array(max);
    this.taille = new Float32Array(max); this.couleur = new Float32Array(max * 3);
    this.vx = new Float32Array(max); this.vy = new Float32Array(max);
    this.age = new Float32Array(max); this.vie = new Float32Array(max);
    this.x = new Float32Array(max); this.y = new Float32Array(max);
    this.prochaine = 0;
    const geo = new THREE.BufferGeometry();
    const att = (a, n) => new THREE.BufferAttribute(a, n).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', att(this.pos, 3)); geo.setAttribute('aAlpha', att(this.alpha, 1));
    geo.setAttribute('aTaille', att(this.taille, 1)); geo.setAttribute('aCouleur', att(this.couleur, 3));
    this.geo = geo;
    this.uDpr = { value: 1 };
    this.material = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms: { uDpr: this.uDpr }, transparent: true, depthTest: false, depthWrite: false });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false; this.points.renderOrder = 3;
    const c = (h) => new THREE.Color(h);
    this.teintes = [c(COULEURS.ocre), c(COULEURS.ambre), c(COULEURS.braise), c(COULEURS.encre)];
  }

  // Lance une particule en (x, y) px depuis le haut, vitesse (vx, vy) px/s (vy positif = vers le bas).
  lancer(x, y, vx, vy, vie, teinte) {
    if (this.max === 0) return;
    const i = this.prochaine; this.prochaine = (i + 1) % this.max;
    this.x[i] = x; this.y[i] = y; this.vx[i] = vx; this.vy[i] = vy; this.age[i] = 0; this.vie[i] = vie;
    this.taille[i] = 2 + ((i * 7919) % 5) * 0.5;
    const t = this.teintes[teinte];
    this.couleur[i * 3] = t.r; this.couleur[i * 3 + 1] = t.g; this.couleur[i * 3 + 2] = t.b;
  }

  // Avance d'un pas ; rend vrai s'il reste des particules vivantes.
  avancer(dt) {
    let n = 0;
    for (let i = 0; i < this.max; i++) {
      if (this.vie[i] <= 0) { this.alpha[i] = 0; continue; }
      this.age[i] += dt;
      if (this.age[i] >= this.vie[i]) { this.vie[i] = 0; this.alpha[i] = 0; continue; }
      this.vy[i] += this.g * dt;
      this.x[i] += this.vx[i] * dt; this.y[i] += this.vy[i] * dt;
      this.alpha[i] = Math.min(1, (this.vie[i] - this.age[i]) / 0.3);
      this.pos[i * 3] = this.x[i]; this.pos[i * 3 + 1] = this.H - this.y[i];
      n++;
    }
    this.vivantes = n;
    const a = this.geo.attributes;
    a.position.needsUpdate = a.aAlpha.needsUpdate = a.aTaille.needsUpdate = a.aCouleur.needsUpdate = true;
    return n > 0;
  }

  vider() { this.vie.fill(0); this.alpha.fill(0); this.vivantes = 0; this.geo.attributes.aAlpha.needsUpdate = true; }
  dispose() { this.geo.dispose(); this.material.dispose(); }
}

// --- poussière : 200 points au plus, Or pâle à 30 %, 1 à 2 px, vitesse ≤ 6 px/s,
// dans le halo de la faille (60 %) et autour de la croix (40 %). Horloge réelle, arrêtée pendant le silence (index.js).
const vertPoussiere = /* glsl */`
attribute vec4 aG;
uniform float uTemps, uDpr, uRb; uniform vec2 uRes; uniform vec4 uFaille, uCroix;
varying float vA;
void main() {
  float span = 70.0;
  vec2 dir = normalize(vec2(aG.z - 0.5, aG.w - 0.5) + vec2(1e-3, 0.0));
  float v = 2.0 + 4.0 * fract(aG.x * 7.31 + aG.w * 3.1);         // 2 à 6 px/s
  float ph = fract(aG.y * 5.3 + aG.z * 1.7 + uTemps * v / span);
  vec2 off = dir * (ph - 0.5) * span;
  float bord = sin(3.14159 * ph);                                 // apparaît et s'efface aux bouts de sa course
  vec2 p; float A;
  if (aG.z < 0.6) {
    vec2 home = vec2(uFaille.x + (aG.x - 0.5) * 1.7 * uRb, mix(uFaille.y, uFaille.z, aG.y));
    p = home + off;
    A = uFaille.w * (1.0 - smoothstep(0.0, uRb, abs(p.x - uFaille.x))) * step(uFaille.y, p.y) * step(p.y, uFaille.z);
  } else {
    float an = 6.2832 * aG.x, rr = uCroix.z * (1.05 + 0.6 * aG.y);
    p = uCroix.xy + rr * vec2(cos(an), sin(an)) + off * 0.6;
    float q = length(p - uCroix.xy) / max(uCroix.z, 1.0);
    A = uCroix.w * (1.0 - smoothstep(1.15, 1.75, q)) * step(1.03, q);
  }
  vA = 0.3 * A * bord;
  gl_PointSize = (1.0 + aG.w) * uDpr + 1.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p.x, uRes.y - p.y, 0.0, 1.0);
}`;
const fragPoussiere = /* glsl */`
uniform vec3 cOrPale; varying float vA;
void main() {
  if (vA <= 0.002) discard;
  float r = length(gl_PointCoord - 0.5);
  gl_FragColor = vec4(cOrPale, vA * (1.0 - smoothstep(0.25, 0.5, r)));
  #include <colorspace_fragment>
}`;

export class Poussiere {
  constructor(n) {
    const r = alea(29), g = new Float32Array(Math.max(1, n) * 4);
    for (let i = 0; i < g.length; i++) g[i] = r();
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(Math.max(1, n) * 3), 3));
    geo.setAttribute('aG', new THREE.BufferAttribute(g, 4));
    geo.setDrawRange(0, n);
    this.geo = geo;
    this.uniforms = {
      uTemps: { value: 0 }, uDpr: { value: 1 }, uRb: { value: 64 }, uRes: { value: new THREE.Vector2(1, 1) },
      uFaille: { value: new THREE.Vector4() }, uCroix: { value: new THREE.Vector4() },
      cOrPale: { value: new THREE.Color(COULEURS.orPale) },
    };
    this.material = new THREE.ShaderMaterial({ vertexShader: vertPoussiere, fragmentShader: fragPoussiere, uniforms: this.uniforms, transparent: true, depthTest: false, depthWrite: false });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false; this.points.renderOrder = 4; this.points.visible = false;
  }
  dispose() { this.geo.dispose(); this.material.dispose(); }
}
