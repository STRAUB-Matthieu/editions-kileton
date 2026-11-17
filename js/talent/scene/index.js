// Scène du talent déterré — « Le troisième serviteur », scènes 1 à 12.
//
// Interface :
//   isSupported()                                         → WebGL2 disponible ?
//   createTalentScene(canvas, { tier, assetsBase, reducedMotion }) → promesse de :
//     setTime(T, etat)   dessine l'image de T (secondes, 0 à 92) ; etat = { mode, q3, vDefil, t8, son }
//                        et, dès la scène 10 : y (position en écrans), frappes (0 à 3 ; 4 = une frappe de plus,
//                        le recul seul), tFrappe (secondes réelles depuis la dernière frappe), vol (true : la page fait voler la
//                        pièce en 2D, la scène la cache). Au-delà de T = 92 (la page continue d'appeler setTime(92, etat)),
//                        l'image suit etat.y : scène 12 dès 16,50 écrans.
//                        Même T et même état → même image ; T peut reculer ou sauter. Seules mémoires : la fouille de la
//                        scène 8 (gardée tant que T ≥ 57,0) et les grains en vol.
//     getState()         { tier, fouille: 0..1, pieceLibre, strates: [{ id: '2025', yEcran }, { id: '2002', yEcran }], surfaceYEcran,
//                          piece: { xEcran, yEcran, diametreEcran },   (pièce : anneau de focus, bouton de frappe, départ du vol)
//                          empreinte: { xEcran, yEcran, diametre } | null }   (scènes 10 et 11 : le lit, pour poser la couverture)
//     on(nom, fn)        'pelletee' { index } · 'fouille' { v, ratio } · 'premierpixel' · 'piecelibre' · 'tierchange' { tier }
//     resize(), setPaused(bool), destroy()
//     setReserves({ repere: { xEcran, yEcran, largeur, hauteur } })   (facultatif) place réelle du voile du repère
// Le canevas est plein écran, fixe, transparent : jusqu'à T = 16 il ne montre que la pièce, sa croix et son ombre de contact
// (la porte est un SVG de la page, dessous) ; de 16 à 17 son fond devient Outrenoir. Il redevient transparent dès T = 86,0
// (la page dessine la nuit, les portes, le sol, puis la Nacre) : il ne montre plus que la pièce, sa lumière et son reflet.
// Aucun texte n'est dessiné ici.
// Geste de la scène 8 : pointeur et clavier (← → Entrée) sur le canevas ; touch-action: pan-y ; aucun preventDefault ;
// aucun écouteur touchmove. Le canevas doit être focalisable (tabindex="0", posé par la page) pour le clavier.
import * as THREE from '../../vendor/three.module.min.js';
import { RoomEnvironment } from '../../vendor/three-addons/environments/RoomEnvironment.js';
import { COULEURS, CRANS, GRAVURE, ROT_X, ROT_Z, format, clamp01, entre } from './recette.js';
import { cadrage, DATEES } from './cadrage.js';
import { Terre } from './terre.js';
import { Piece } from './piece.js';
import { Pluie, Eclats, Poussiere } from './particules.js';
import { Fouille, frontRetrait } from './fouille.js';
import { Geste } from './geste.js';

const PALIERS = {
  haut:  { grille: 256, grains: 19800, eclats: 1200, eclat: 12, dpr: 2,   bloom: true,  segments: 96, antialias: true,  parPelletee: 2200, poussiere: 200 },
  moyen: { grille: 160, grains: 4950,  eclats: 400,  eclat: 6,  dpr: 1.5, bloom: false, segments: 64, antialias: false, parPelletee: 550,  poussiere: 0 },
};
// Bloom du palier haut, à partir de 64,8 seulement : seuil 0,85, force 0,6, rayon 0,45. Seule la croix dépasse
// le seuil : le reste de la pièce est plafonné à 0,8 de luminance (piece.js), la terre n'y monte jamais.
const BLOOM = { force: 0.6, rayon: 0.45, seuil: 0.85 };

export function isSupported() {
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch (e) { return false; }
}

// Objet inerte : sans WebGL ou en mouvement réduit, le module ne fait rien (la page montre ses planches).
function inerte() {
  return {
    setTime() {}, getState: () => ({ tier: 'aucun', fouille: 0, pieceLibre: false, strates: [{ id: '2025', yEcran: null }, { id: '2002', yEcran: null }], surfaceYEcran: null, piece: null, empreinte: null }),
    on: () => () => {}, resize() {}, setReserves() {}, setPaused() {}, destroy() {},
  };
}

const vertPlein = /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
// Fondu en grain (scène 5, palier haut) : seuil de bruit animé entre l'image de la coupe et le nouveau cadrage.
const fragFondu = /* glsl */`
precision highp float; varying vec2 vUv;
uniform sampler2D tA, tB; uniform float uP, uT, uGrain;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec2 cel = floor(gl_FragCoord.xy / uGrain);
  float n = mix(hash(cel), hash(cel + floor(uT * 14.0) * 7.3), 0.3);
  float m = smoothstep(n - 0.04, n + 0.04, uP * 1.08 - 0.04);
  gl_FragColor = mix(texture2D(tA, vUv), texture2D(tB, vUv), m);
  #include <colorspace_fragment>
}`;
// Fond Outrenoir ; à la révélation, un dégradé radial très faible centré sur la croix (Ambre profond à 25 %, Outrenoir à 2,2 R).
const vertFond = /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const fragFond = /* glsl */`
precision highp float; varying vec2 vUv;
uniform vec2 uRes; uniform vec4 uGlow; uniform float uOp; uniform vec3 cEncre, cAmbre, cOrBruni, cAbysse;
uniform vec4 uGlow2; uniform float uVig;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec2 P = vec2(vUv.x * uRes.x, (1.0 - vUv.y) * uRes.y);
  float k = uGlow.w * 0.25 * (1.0 - smoothstep(0.0, uGlow.z, length(P - uGlow.xy)));
  vec3 c = mix(cEncre, cAmbre, k);
  // scène 10 : la nuit au-dessus de la surface, Or bruni 18 % au contact de la pièce, 0 à 1,6 R, en (1 − d/r)²
  float g2 = 0.0;
  if (uGlow2.w > 0.0) { float t = clamp(1.0 - (length(P - uGlow2.xy) - uGlow2.z) / (0.6 * uGlow2.z), 0.0, 1.0); g2 = 0.18 * uGlow2.w * t * t; }
  // scène 11 : vignette Abysse, 0 au centre, 40 % aux bords, sur 0,30 W, sans bord
  if (uVig > 0.0) { float b = min(min(P.x, uRes.x - P.x), min(P.y, uRes.y - P.y)); float t = 1.0 - smoothstep(0.0, 0.30 * uRes.x, b); c = mix(c, cAbysse, 0.40 * uVig * t); }
  c += (hash(gl_FragCoord.xy) - 0.5) * 0.0015;
  if (g2 <= 0.0 || uOp >= 1.0) gl_FragColor = vec4(mix(c, cOrBruni, g2), uOp);
  else {
    // la nuit du canevas s'efface (uOp → 0) ; la retombée Or bruni autour de la pièce reste, posée sur la nuit de la page
    float A = g2 + uOp * (1.0 - g2);
    gl_FragColor = vec4((cOrBruni * g2 + c * uOp * (1.0 - g2)) / max(A, 1e-4), A);
  }
  #include <colorspace_fragment>
}`;
const fragVoile = /* glsl */`precision highp float; uniform vec3 uC; uniform float uA; void main() { gl_FragColor = vec4(uC, uA);
  #include <colorspace_fragment>
}`;

export async function createTalentScene(canvas, options = {}) {
  // tempsReel : la respiration de la faille et la poussière suivent l'horloge réelle (false : elles suivent T, pour les captures)
  // bloom : false coupe le bloom (mesure de sa retombée)
  const opt = { tier: 'haut', assetsBase: 'assets/talent/', reducedMotion: false, mesureFrequence: true, tempsReel: true, bloom: true, ...options };
  if (opt.reducedMotion || !isSupported()) return inerte();
  let tier = opt.tier === 'moyen' ? 'moyen' : 'haut';
  let P = PALIERS[tier];

  canvas.style.touchAction = 'pan-y';

  // --- rendu
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: P.antialias, alpha: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(COULEURS.encre, 0);
  renderer.toneMapping = THREE.NoToneMapping;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(0, 1, 1, 0, -2000, 2000);
  camera.position.z = 1000;

  const base = opt.assetsBase.endsWith('/') ? opt.assetsBase : opt.assetsBase + '/';
  const chargeur = new THREE.TextureLoader();
  const [texH, texN, texC] = await Promise.all([
    chargeur.loadAsync(base + 'scene/avers-hauteur.webp'),
    chargeur.loadAsync(base + 'scene/avers-normale.webp'),
    chargeur.loadAsync(base + 'scene/avers-couleur.webp'),
  ]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(renderer), 0.04);
  scene.environment = envRT.texture;
  pmrem.dispose();

  const terre = new Terre();
  const piece = new Piece(texH, texN, P.segments, texC, Math.min(8, renderer.capabilities.getMaxAnisotropy()));
  piece.ordre(0);
  let fouille = new Fouille(P.grille);
  const pluie = new Pluie(PALIERS.haut.grains);
  pluie.compte(P.grains); pluie.auto();
  let eclats = new Eclats(P.eclats);
  const poussiere = new Poussiere(PALIERS.haut.poussiere);
  // fond Outrenoir dessiné par un plan (opacité 0 → 1 de T = 16 à 17) ; le canevas est toujours effacé en transparent
  const uFond = { uRes: { value: new THREE.Vector2(1, 1) }, uGlow: { value: new THREE.Vector4() }, uOp: { value: 0 },
    cEncre: { value: new THREE.Color(COULEURS.encre) }, cAmbre: { value: new THREE.Color(COULEURS.ambre) },
    cOrBruni: { value: new THREE.Color(COULEURS.orBruni) }, cAbysse: { value: new THREE.Color(COULEURS.abysse) },
    uGlow2: { value: new THREE.Vector4() }, uVig: { value: 0 } };
  const fond = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({ vertexShader: vertFond, fragmentShader: fragFond, uniforms: uFond, transparent: true, depthTest: false, depthWrite: false }));
  fond.renderOrder = -1; fond.frustumCulled = false;
  scene.add(fond, piece.groupe, terre.mesh, pluie.points, eclats.points, poussiere.points);
  terre.uniforms.uDig.value = fouille.tex;
  // lumières directionnelles de la pièce (éteintes avant la scène 11) : le jour d'en haut à gauche (scène 12),
  // et les deux ouvertures des portes, de côté (scène 11, Perle)
  const lumJour = new THREE.DirectionalLight(COULEURS.perle, 0), lumG = new THREE.DirectionalLight(COULEURS.perle, 0), lumD = new THREE.DirectionalLight(COULEURS.perle, 0);
  for (const l of [lumJour, lumG, lumD]) scene.add(l, l.target);
  // textures du revers (lot 3 : chargées à T ≥ 50 ou au-delà de 9 écrans) : face du revers, lys de l'empreinte
  let reversDemande = false;
  function chargerRevers() {
    reversDemande = true;
    // le lys de l'empreinte est sa propre carte, lissée de 0,025 D (empreinte-lys.webp, 4,5 ko)
    Promise.all(['revers-hauteur', 'revers-normale', 'revers-couleur', 'empreinte-lys'].map((n) => chargeur.loadAsync(base + 'scene/' + n + '.webp')))
      .then(([h, n, c, lys]) => {
        if (detruit) { h.dispose(); n.dispose(); c.dispose(); lys.dispose(); return; }
        piece.revers(h, n, c);
        terre.uniforms.uLys.value = lys; terre.uniforms.uEmpL.value.z = 1;
        if (L) dessiner();
      }).catch((e) => console.error(e));
  }

  // plein écran : fondu en grain et voile d'Abysse
  const camPlein = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const matFondu = new THREE.ShaderMaterial({ vertexShader: vertPlein, fragmentShader: fragFondu, depthTest: false, depthWrite: false,
    uniforms: { tA: { value: null }, tB: { value: null }, uP: { value: 0 }, uT: { value: 0 }, uGrain: { value: 2 } } });
  const matVoile = new THREE.ShaderMaterial({ vertexShader: vertPlein, fragmentShader: fragVoile, transparent: true, depthTest: false, depthWrite: false,
    uniforms: { uC: { value: new THREE.Color(COULEURS.abysse) }, uA: { value: 0 } } });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), matFondu); quad.frustumCulled = false;
  const scenePlein = new THREE.Scene(); scenePlein.add(quad);
  let rtA = null, rtB = null;

  // bloom (palier haut, scènes 8 et 9), chargé à la demande
  let composer = null, bloomPass = null, bloomDemande = false;
  async function preparerBloom() {
    bloomDemande = true;
    const [{ EffectComposer }, { RenderPass }, { UnrealBloomPass }, { OutputPass }] = await Promise.all([
      import('../../vendor/three-addons/postprocessing/EffectComposer.js'),
      import('../../vendor/three-addons/postprocessing/RenderPass.js'),
      import('../../vendor/three-addons/postprocessing/UnrealBloomPass.js'),
      import('../../vendor/three-addons/postprocessing/OutputPass.js'),
    ]);
    if (detruit || tier !== 'haut') return;
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloomPass = new UnrealBloomPass(new THREE.Vector2(W, H), BLOOM.force, BLOOM.rayon, BLOOM.seuil);
    composer.addPass(bloomPass);
    // le halo s'ajoute à la couleur sans toucher l'alpha. Sans cela, son mélange additif portait l'alpha à 1 partout :
    // de 84,6 à 86,0 (canevas transparent au-dessus de la surface) la nuit de la page devenait un noir opaque. Là où l'image
    // est opaque (scènes 8 à 10), la couleur est la même qu'avant (mêmes facteurs de couleur).
    const bm = bloomPass.blendMaterial;
    bm.blending = THREE.CustomBlending; bm.blendEquation = THREE.AddEquation;
    bm.blendSrc = THREE.SrcAlphaFactor; bm.blendDst = THREE.OneFactor;
    bm.blendSrcAlpha = THREE.ZeroFactor; bm.blendDstAlpha = THREE.OneFactor;
    composer.addPass(new OutputPass());
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(W, H);
  }

  // --- état
  let W = 1, H = 1, F = format(390, 844), dpr = 1;
  let T = 0, etat = { mode: 'auto', q3: 0, vDefil: 0, t8: 0, son: false }, Tprec = -1, image = 1;
  let pause = false, detruit = false, L = null;
  // horloges de la lumière vivante : respiration (s) et poussière (s, arrêtée pendant le silence de 44,0 à 46,5)
  let horlogePoussiere = 0;
  // places données par la page (facultatif) : { repere: { xEcran, yEcran, largeur, hauteur } }, px CSS
  const reservesPage = { repere: null };
  // dernière frappe vue (pour reconnaître une frappe de plus quand la page laisse frappes à 3)
  const frappe = { k: 0, tf: NaN, plus: false };
  const ecoute = new Map();
  const emettre = (nom, v) => { const s = ecoute.get(nom); if (s) for (const f of s) { try { f(v); } catch (e) { setTimeout(() => { throw e; }); } } };

  // fouille mémorisée
  const fo = { ratio: 0, ratioFente: 0, r0: 0.2, premier: false, libre: false, depuisLibre: 0, geste: false, tLibre: 0, anim: 0, emis: false, brosse: false };
  const mesure = { ratio: 0, ratioFente: 0, premier: false };
  let wfPrec = -1, foSale = true, vitesse = 0, tFouilleEvt = 0;
  // pluie en mode libre
  let horlogeLibre = 0, horlogeLibreBase = 0, mursLibre = 0, q3Prec = 0, paquets = 0;
  // toucher de la scène 1
  const tact = { actif: false, x: 0, y: 0, ox: 0, oy: 0, retour: 0, rx: 0, ry: 0 };

  // mesure de fréquence (2 s d'activité), descente de palier si la médiane < 40 images/s
  const ech = new Float32Array(240); let nEch = 0, tActif = 0, mesureFaite = !opt.mesureFrequence, dernier = 0;

  // --- geste de la scène 8 (code de geste.js, gardé)
  const enScene8 = () => T >= 57.0 && T < 64.8 && !fo.libre;
  const zone = (y) => y >= 0.36 * H && y <= 0.92 * H;
  const enf = { cx: 0, cy: 0, r: 1 };
  let clavierX = 0;
  const geste = new Geste(canvas, {
    trait: () => {},
    survol: () => {},
    clavier: (dir) => {
      if (!enScene8()) return;
      const pas = F.d8 / 6, x0 = clavierX || enf.cx;
      clavierX = Math.min(enf.cx + enf.r, Math.max(enf.cx - enf.r, x0 + dir * pas));
      geste.pousser(x0, enf.cy, clavierX, enf.cy);
    },
    degager: () => { if (enScene8()) { fo.geste = true; liberer(true); } },
  });
  // toucher de la scène 1 : la pièce suit le doigt de 6 px au plus et revient en 0,4 s (écouteurs passifs, sans touchmove)
  const passif = { passive: true };
  const pt = (e) => { const b = canvas.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
  const hDown = (e) => { if (T >= 3.0 && T < 16.0) { tact.actif = true; [tact.x, tact.y] = pt(e); } };
  const hMove = (e) => { if (tact.actif) [tact.x, tact.y] = pt(e); };
  const hUp = () => { if (tact.actif) { tact.actif = false; tact.retour = performance.now(); tact.rx = tact.ox; tact.ry = tact.oy; } };
  canvas.addEventListener('pointerdown', hDown, passif);
  canvas.addEventListener('pointermove', hMove, passif);
  canvas.addEventListener('pointerup', hUp, passif);
  canvas.addEventListener('pointercancel', hUp, passif);

  function brosser(x0, y0, x1, y1) {
    if (!enScene8() || !zone(y1)) return;
    fo.geste = true;
    if (fouille.brosser(x0, y0, x1, y1, F.pinceau, image)) { foSale = true; fo.brosse = true; }
    vitesse = Math.max(vitesse, Math.hypot(x1 - x0, y1 - y0));
    for (let i = 0; i < P.eclat / 6; i++) { // quelques grains sautent au passage (12 par passage au palier haut, 6 au moyen)
      const a = Math.random() * Math.PI * 2, h = 20 + Math.random() * 40, v = Math.sqrt(2 * eclats.g * h);
      eclats.lancer(x1 + Math.cos(a) * F.pinceau * 0.3, y1 + Math.sin(a) * F.pinceau * 0.2, (x1 - x0) * 3 + (Math.random() - 0.5) * 80, -v, 0.6 + Math.random() * 0.3, Math.random() < 0.5 ? 0 : 1);
    }
  }

  // la pièce est libre : la terre qui reste sur le disque tombe (0,6 s)
  function liberer(parGeste) {
    if (fo.libre) return;
    fo.libre = true; fo.tLibre = performance.now();
    const tard = T >= 63.6;
    fo.anim = tard ? 1 : 0;
    if (!tard) {
      const nb = Math.min(eclats.max, tier === 'haut' ? 700 : 240);
      for (let i = 0; i < nb; i++) {
        const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random());
        const lx = Math.cos(a) * rr, ly = Math.sin(a) * rr * Math.cos(ROT_X);
        const c = Math.cos(ROT_Z), s = Math.sin(ROT_Z);
        const x = enf.cx + (c * lx - s * ly) * enf.r, y = enf.cy - (s * lx + c * ly) * enf.r;
        if (Math.random() < 0.45) continue;
        const vie = Math.min(1.2, Math.max(0.6, Math.sqrt(2 * (H - y) / eclats.g)));
        eclats.lancer(x, y, (Math.random() - 0.5) * 60, Math.random() * 40, vie, i % 3 === 0 ? 3 : i % 2);
      }
    }
    if (parGeste && !fo.emis) { fo.emis = true; emettre('piecelibre'); }
  }

  // fente du fuseau à la scène 8 (pour la mesure) : demi-largeur à l'ordonnée écran y
  function dansFente(x, y) {
    const z8 = F.d8 / F.d56, cc8 = 0.78 * H - (0.13 * H) / z8;
    const yTop = 0.34 * H, yc = 0.63 * H, half = F.fuseau / 2;
    let hw = 0;
    if (y >= yTop && y <= yc) hw = half * Math.pow((y - yTop) / (yc - yTop), 0.9);
    else if (y > yc) hw = half * (1 - 0.8 * Math.pow(Math.min(1, (y - yc) / (H - yc)), 0.8));
    const yw = cc8 + (y - H / 2) / z8;
    const xf = W / 2 + terre.failleX(yw) * z8;
    return Math.abs(x - xf) < hw;
  }

  // --- taille
  function resize() {
    const w = canvas.clientWidth || canvas.width, h = canvas.clientHeight || canvas.height;
    if (!w || !h) return;
    const change = Math.abs(w - W) > 0.5 || Math.abs(h - H) > 0.5;
    W = w; H = h; F = format(W, H);
    dpr = Math.min(window.devicePixelRatio || 1, Math.max(1, P.dpr * (W < 768 ? 0.8 : 1)));
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);
    if (composer) { composer.setPixelRatio(dpr); composer.setSize(W, H); }
    if (rtA) { rtA.dispose(); rtB.dispose(); rtA = rtB = null; }
    fond.scale.set(W, H, 1); fond.position.set(W / 2, H / 2, -1); uFond.uRes.value.set(W, H);
    poussiere.uniforms.uRes.value.set(W, H); poussiere.uniforms.uDpr.value = dpr;
    camera.left = 0; camera.right = W; camera.top = H; camera.bottom = 0; camera.updateProjectionMatrix();
    terre.taille(W, H);
    fouille.taille(W, H); if (change) { fouille.vider(); foSale = true; }
    eclats.H = H; eclats.g = 2200 * (W / 390); eclats.uDpr.value = dpr;
    pluie.uniforms.uDpr.value = dpr; pluie.uniforms.uRes.value.set(W, H);
    enf.cx = W / 2; enf.cy = 0.63 * H; enf.r = F.d8 / 2;
    if (L) dessiner();
  }
  const ro = new ResizeObserver(() => resize());
  ro.observe(canvas);

  // --- uniformes à partir du cadrage
  function poser(L) {
    const u = terre.uniforms, pc = L.piece;
    let ox = 0, oy = 0;
    if (L.scene >= 1 && L.scene <= 2) { ox = tact.ox; oy = tact.oy; }
    const x = pc.x + ox, y = pc.y + oy, r = pc.d / 2;
    const p2 = L.piece2;
    piece.poser(x, y + p2.dy, r * p2.recul, H, pc.rotX, pc.rotZ, p2.rotY);
    piece.eclairer(L.croix, L.arete, L.jour, L.parois, r);
    piece.frappe(p2.listel, p2.flancs, p2.balai, p2.anneau, p2.pleine);
    piece.groupe.visible = pc.op > 0.001;
    piece.matFace.opacity = piece.matTranche.opacity = pc.op;
    if (piece.matRevers) piece.matRevers.opacity = pc.op;
    uFond.uOp.value = L.fond; fond.visible = L.fond > 0 || L.glow2 > 0;   // la retombée de la pièce survit à la nuit du canevas
    uFond.uGlow.value.set(x, y, 2.2 * r, L.fondGlow);
    uFond.uGlow2.value.set(x, y, r, L.glow2); uFond.uVig.value = L.vig;
    piece.eclat(L.eclair, L.braise);
    // lumières directionnelles : jour d'en haut à gauche ; flancs depuis les deux portes
    const yg = H - y;
    lumJour.intensity = 1.2 * L.lumJour; lumJour.position.set(x - 600, yg + 700, 900); lumJour.target.position.set(x, yg, 0);
    lumG.intensity = lumD.intensity = 1.2 * p2.flancs;
    lumG.position.set(x - 900, yg + 150, 350); lumG.target.position.set(x, yg, 0);
    lumD.position.set(x + 900, yg + 150, 350); lumD.target.position.set(x, yg, 0);
    for (const l of [lumJour, lumG, lumD]) l.target.updateMatrixWorld();

    u.uMonde.value = L.transparent ? 0 : L.monde;
    u.uCamX.value = L.camX;
    if (L.emp) u.uEmp.value.set(L.emp.x, L.emp.y, L.emp.d, L.emp.vis); else u.uEmp.value.set(0, 0, 1, 0);
    u.uEmpL.value.x = L.empL; u.uEmpL.value.y = F.empF; u.uEmpL.value.w = F.arete10;
    // relief du lys, gravure dans le creux à 50 %, plongée de 0,05 D au plus profond (px du monde), paroi haute à 40 % d'Outrenoir
    u.uEmpG.value.set(L.lysK, 0.5, L.emp ? 0.05 * L.emp.d / L.z : 0, 0.40); u.uEmpB.value = F.empB;
    u.uS10.value.set(L.s10[0], L.s10[1] || 24, L.s10[2], L.s10[3] || 1);
    u.uReflet.value.set(x, y, pc.d, L.reflet);
    u.uCam.value.set(L.cc, L.z);
    if (L.monde === 1) {
      u.uSurf.value.set(L.surfW, L.mont, L.montSig);
      const z4 = (F.coin4 - F.surf4) / (2.09 - 0.80);
      u.uEsp.value.set(1.0 * H, 1.6 * H, 32, 37 / z4);
    } else {
      u.uSurf.value.set(0.40 * H, 0, 100);
      u.uEsp.value.set(0, 1, 32, 32);
    }
    u.uNuit.value = L.nuitAbysse;
    u.uPiece.value.set(x, y, r, 0);
    u.uCav.value.set(L.cav[0], L.cav[1], L.cav[2], pc.voile);
    u.uSillon.value = L.sillon;
    u.uDatees.value.set(DATEES[0] * H, DATEES[1] * H, DATEES[2] * H, DATEES[3] * H); u.uDateesA.value = L.datees;
    u.uFLim.value = L.failleLim; u.uCoeur.value = L.coeur; u.uFI.value = L.failleI;
    u.uFus.value.set(L.fus[0], L.fus[1], L.fus[2], L.fus[3]); u.uFiletHaut.value = L.filetHaut;
    u.uFouille.value = L.fouille; u.uWf.value = L.fouille ? fo.wf : 0; u.uLibre.value = fo.libre ? fo.anim : 0; u.uFouilleFade.value = L.fouilleFade;
    u.uEnf.value.set(enf.cx, enf.cy, enf.r, 0);
    u.uS9.value.set(L.s9[0], L.s9[1], L.s9[2], L.s9[3]);
    u.uS9b.value.set(L.s9b[0], L.s9b[1], L.s9b[2], L.s9b[3]);
    u.uGrav.value.set(y + (GRAVURE.phase - 0.5) / GRAVURE.echelle * pc.d, GRAVURE.pas * pc.d);
    for (let i = 0; i < u.uResA.value.length; i++) {
      let r = L.reserves[i];
      // place réelle du repère donnée par la page (setReserves) : ellipse centrée en (xEcran, yEcran), largeur × hauteur
      if (r && r.repere && reservesPage.repere) { const q = reservesPage.repere; r = [q.xEcran, q.yEcran, q.largeur / 2, q.hauteur / 2, r[4], 1]; }
      if (r) { u.uResv.value[i].set(r[0], r[1], r[2], r[3]); u.uResA.value[i] = r[4]; u.uResE.value[i] = r[5] || 0; } else u.uResA.value[i] = 0;
    }
    u.uFondu.value = F.fondu; u.uCavF.value = F.cavF; u.uAureole.value = L.aureole;
    // lumière : nuit, faille (rayon, retombée, souffle), croix, lueur de surface, densité des hachures, lèvre avant
    const tb = opt.tempsReel ? performance.now() / 1000 : T;
    const souffle = 1 + 0.08 * L.souffleA * Math.sin(2 * Math.PI * tb / 4);
    u.uLum.value.set(L.lum[0], L.lum[1], L.lum[2], souffle);
    u.uCL.value.set(L.cl[0], L.cl[1], L.cl[2], L.cl[3]);
    u.uRim.value = L.rim;
    u.uDens.value.set(L.dens[0], L.dens[1], L.dens[2]);
    u.uLevre.value = L.levre;
    if (L.indice) u.uIndice.value.set(L.indice[0], L.indice[1], 1); else u.uIndice.value.set(0, 0, 0);
    const s = geste.survol;
    const anneau = L.scene === 8 && !fo.libre && s.visible && zone(s.y);
    u.uAnneau.value.set(s.x, s.y, F.pinceau / 2, anneau ? 1 : 0);
    canvas.style.cursor = anneau ? 'none' : '';
    u.uParois.value = L.parois; u.uOmbre.value = L.ombre; u.uTrou.value = L.scene >= 9 ? 1 : 0;

    const p = pluie.uniforms;
    pluie.points.visible = !!L.pluie;
    p.uHorloge.value = etat.mode === 'libre' ? horlogeLibre : T;
    p.uCam.value.set(L.cc, L.z); p.uSurf.value.copy(u.uSurf.value);
    p.uPiece.value.set(x, y, r, 0); p.uCroix.value = L.croix; p.uCL.value.copy(u.uCL.value); p.uTexteBas.value = 0.33 * H + 16;

    // poussière lente dans les halos (palier haut seulement)
    const d = poussiere.uniforms;
    poussiere.points.visible = P.poussiere > 0 && L.poussiere > 0;
    if (poussiere.points.visible) {
      const yTop = Math.max(0, (0.40 * H - L.cc) * L.z + H / 2), yBot = Math.min(H, (L.failleLim - L.cc) * L.z + H / 2);
      d.uTemps.value = horlogePoussiere;
      d.uFaille.value.set(W / 2, yTop, Math.max(yTop, yBot - (L.scene >= 7 ? 0 : r * 1.2)), L.failleI * L.poussiere * souffle);
      d.uRb.value = F.rb;
      d.uCroix.value.set(x, y, r, Math.min(1, L.croix / 0.9) * L.poussiere);
    }
  }

  function rendreScene(L) {
    poser(L);
    const b = L.bloom > 0 && tier === 'haut' && opt.bloom;
    if (b && P.bloom && !bloomDemande) preparerBloom().catch((e) => console.error(e));
    if (b && L.bloom >= 1 && composer && L.bloomForce > 0) { bloomPass.strength = L.bloomForce; composer.render(); }
    else renderer.render(scene, camera);
  }

  function dessiner() {
    if (!L) return;
    if (L.fondu) {
      const p = L.fondu.p;
      if (tier === 'haut') {
        if (!rtA) {
          const o = { type: THREE.HalfFloatType };
          rtA = new THREE.WebGLRenderTarget(Math.round(W * dpr), Math.round(H * dpr), o);
          rtB = new THREE.WebGLRenderTarget(Math.round(W * dpr), Math.round(H * dpr), o);
        }
        poser(L.fondu.A); renderer.setRenderTarget(rtA); renderer.render(scene, camera);
        poser(L); renderer.setRenderTarget(rtB); renderer.render(scene, camera);
        renderer.setRenderTarget(null);
        quad.material = matFondu;
        matFondu.uniforms.tA.value = rtA.texture; matFondu.uniforms.tB.value = rtB.texture;
        matFondu.uniforms.uP.value = p; matFondu.uniforms.uT.value = T; matFondu.uniforms.uGrain.value = Math.max(1, Math.round(2 * dpr));
        renderer.render(scenePlein, camPlein);
      } else { // palier moyen : fondu par l'Abysse
        rendreScene(p < 0.5 ? L.fondu.A : L);
        quad.material = matVoile; matVoile.uniforms.uA.value = 1 - Math.abs(2 * p - 1);
        renderer.autoClear = false; renderer.render(scenePlein, camPlein); renderer.autoClear = true;
      }
      return;
    }
    rendreScene(L);
  }

  // --- une image de T
  function setTime(t, e) {
    if (detruit) return;
    const maintenant = performance.now();
    T = Number(t) || 0;
    etat = { ...etat, ...(e || {}) };
    const dt = dernier ? Math.min(0.1, (maintenant - dernier) / 1000) : 1 / 60;
    image++;
    // poussière : temps réel, arrêtée pendant le silence total (44,0 → 46,5) ; sans temps réel, fonction de T
    if (opt.tempsReel) { if (!(T >= 44.0 && T < 46.5)) horlogePoussiere += dt; }
    else horlogePoussiere = T - Math.min(2.5, Math.max(0, T - 44.0));

    // mesure de fréquence pendant l'activité
    if (!mesureFaite && dernier) {
      const d = maintenant - dernier;
      if (d < 200) { ech[nEch++] = 1000 / d; tActif += d; }
      if (tActif >= 2000 || nEch >= ech.length) juger();
    }
    dernier = maintenant;

    // toucher de la scène 1
    if (tact.actif && L) {
      const dx = tact.x - L.piece.x, dy = tact.y - L.piece.y, d = Math.hypot(dx, dy) || 1, k = Math.min(6, d * 0.08) / d;
      tact.ox = dx * k; tact.oy = dy * k;
    } else if (tact.retour) {
      const k = clamp01((maintenant - tact.retour) / 400);
      tact.ox = tact.rx * (1 - k); tact.oy = tact.ry * (1 - k);
      if (k >= 1) tact.retour = 0;
    }

    // pluie : crans (automatique) ou défilement (libre)
    if (etat.mode === 'libre') {
      if (pluie.mode !== 'libre') { pluie.libre(); horlogeLibreBase = T; mursLibre = maintenant; }
      horlogeLibre = horlogeLibreBase + (maintenant - mursLibre) / 1000;
      const dq = (etat.q3 || 0) - q3Prec;
      if (T >= 16.0 && T < 29.0 && dq > 0) {
        const plafond = Math.max(1, Math.round(P.parPelletee * dt / 0.1)); // 1 grain par 0,0001 écran, plafond 2 200 par 0,1 s
        const n = Math.min(plafond, Math.round(dq * 2.5 / 0.0001 * (P.parPelletee / 2200)));
        const L0 = L || cadrage(T, etat, F, W, H, fo);
        pluie.lancer(n, horlogeLibre, (L0.cc - H / 2) / H - 0.02, P.grains);
        paquets += dq;
        if (paquets >= 0.02) { paquets = 0; emettre('pelletee', { index: Math.min(8, Math.floor((etat.q3 || 0) * 9)) }); }
      }
    } else {
      if (pluie.mode !== 'auto') pluie.auto();
      if (Tprec >= 0 && T > Tprec) CRANS.forEach((c, i) => { if (Tprec < c && T >= c && T - c < 0.5) emettre('pelletee', { index: i }); });
    }
    q3Prec = etat.q3 || 0;

    // fouille : mémoire tant que T ≥ 57,0
    if (T < 57.0) {
      if (!fouille.vierge || fo.libre || fo.geste) {
        fouille.vider(); eclats.vider();
        Object.assign(fo, { ratio: 0, premier: false, libre: false, geste: false, emis: false, brosse: false, anim: 0 });
      }
      geste.vider(() => {}); wfPrec = -1;
    } else {
      geste.vider(brosser);
      fo.wf = frontRetrait(etat.t8, (F.fuseau / 2) / enf.r);
      if (foSale || fo.wf !== wfPrec) {
        Tmesure();
        foSale = false; wfPrec = fo.wf;
        // premier pixel de pièce découvert par la fouille (pinceau, ou front du retrait seul passé au-delà de la fente)
        if (!fo.premier && mesure.premier && (fo.brosse || fo.wf > (F.fuseau / 2) / enf.r + 0.1)) { fo.premier = true; emettre('premierpixel'); }
      }
      if (vitesse > 0 && enScene8()) {
        if (maintenant - tFouilleEvt > 50) { emettre('fouille', { v: clamp01(vitesse / Math.max(dt, 1 / 120) / 1200), ratio: fo.ratio }); tFouilleEvt = maintenant; }
      }
      vitesse = 0;
      if (!fo.libre) {
        // 55 % du disque découverts : la terre qui reste tombe ; l'événement n'est émis que si le geste y a pris part
        if (fo.ratio >= 0.55) liberer(fo.brosse);
        else if ((etat.t8 || 0) >= 6 || T >= 63.0) liberer(false);
      }
      if (fo.libre) { fo.anim = Math.max(fo.anim, clamp01((maintenant - fo.tLibre) / 600)); fo.depuisLibre = T >= 63.6 ? 9 : (maintenant - fo.tLibre) / 1000; }
    }

    // lot 3 : textures du revers
    if (!reversDemande && (T >= 50 || Number(etat.y) >= 9)) chargerRevers();
    // une frappe de plus (k reste 3, tFrappe repart de 0) : le recul seul, sans changer de face
    const kf = Number(etat.frappes) || 0, tf = Number(etat.tFrappe);
    if (kf !== frappe.k) frappe.plus = false;
    else if (kf >= 3 && Number.isFinite(tf) && Number.isFinite(frappe.tf) && tf + 0.05 < frappe.tf) frappe.plus = true;
    frappe.k = kf; frappe.tf = tf;
    etat.frappeDePlus = frappe.plus && tf < 1.5;

    L = cadrage(T, etat, F, W, H, fo);
    if (eclats.vivantes || L.scene === 8) eclats.avancer(dt);
    Tprec = T;
    if (pause || document.hidden) return;
    dessiner();
  }
  function Tmesure() {
    fouille.mesurer(enf, fo.wf, dansFente, mesure);
    fo.ratio = mesure.ratio; fo.r0 = mesure.ratioFente;
  }

  function juger() {
    mesureFaite = true;
    const a = Array.from(ech.subarray(0, nEch)).sort((u, v) => u - v);
    const med = a.length ? a[a.length >> 1] : 60;
    if (med >= 40) return;
    if (tier === 'haut') changerPalier('moyen');
    else emettre('tierchange', { tier: 'bas', medianeImagesParSeconde: Math.round(med) });
  }

  // descente haut → moyen : grille rééchantillonnée, moins de grains, plus de bloom, densité 1,5
  function changerPalier(nouveau) {
    tier = nouveau; P = PALIERS[tier];
    const f2 = new Fouille(P.grille); f2.taille(W, H);
    fouille.copierDans(f2); fouille.dispose(); fouille = f2; terre.uniforms.uDig.value = fouille.tex;
    pluie.compte(P.grains);
    scene.remove(eclats.points); eclats.dispose(); eclats = new Eclats(P.eclats); scene.add(eclats.points);
    if (composer) { composer.dispose(); composer = null; bloomPass = null; }
    mesureFaite = !opt.mesureFrequence; nEch = 0; tActif = 0;
    resize();
    emettre('tierchange', { tier });
  }

  const visibilite = () => { if (!document.hidden) { dernier = 0; dessiner(); } };
  document.addEventListener('visibilitychange', visibilite);
  resize();

  return {
    setTime,
    getState() {
      const ok = L && L.monde === 1;
      const ys = (yw) => (ok ? (yw - L.cc) * L.z + H / 2 : null);
      let surf = null;
      if (L && L.monde === 1) surf = (L.surfW - L.cc) * L.z + H / 2;
      else if (L && L.monde === 2) surf = L.scene >= 9 ? L.s9[1] : (0.40 * H - L.cc) * L.z + H / 2;
      return {
        tier, fouille: fo.ratio, pieceLibre: fo.libre,
        strates: [
          { id: '2025', yEcran: ys((DATEES[0] + DATEES[1]) / 2 * H), yHaut: ys(DATEES[0] * H), yBas: ys(DATEES[1] * H), opacite: L ? L.datees : 0 },
          { id: '2002', yEcran: ys((DATEES[2] + DATEES[3]) / 2 * H), yHaut: ys(DATEES[2] * H), yBas: ys(DATEES[3] * H), opacite: L ? L.datees : 0 },
        ],
        surfaceYEcran: surf,
        piece: L ? { xEcran: L.piece.x + (L.scene <= 2 ? tact.ox : 0), yEcran: L.piece.y + (L.scene <= 2 ? tact.oy : 0), diametreEcran: L.piece.d } : null,
        // le lit de la pièce (scènes 10 et 11), pour poser la couverture : centre et diamètre à l'écran (px CSS)
        empreinte: L && L.emp ? { xEcran: L.emp.x, yEcran: L.emp.y, diametre: L.emp.d } : null,
      };
    },
    on(nom, fn) {
      if (!ecoute.has(nom)) ecoute.set(nom, new Set());
      ecoute.get(nom).add(fn);
      return () => ecoute.get(nom)?.delete(fn);
    },
    resize,
    // la page peut donner la place réelle du voile du repère (ellipse : centre, largeur, hauteur, px CSS).
    // Sans appel, la scène garde ses valeurs estimées.repere). null : revient aux valeurs estimées.
    setReserves(o = {}) {
      if ('repere' in o) {
        const q = o.repere;
        reservesPage.repere = q && [q.xEcran, q.yEcran, q.largeur, q.hauteur].every(Number.isFinite) ? { ...q } : null;
      }
      if (L) dessiner();
    },
    setPaused(b) { pause = !!b; if (!pause) { dernier = 0; dessiner(); } },
    destroy() {
      detruit = true;
      ro.disconnect(); geste.dispose();
      canvas.removeEventListener('pointerdown', hDown); canvas.removeEventListener('pointermove', hMove);
      canvas.removeEventListener('pointerup', hUp); canvas.removeEventListener('pointercancel', hUp);
      document.removeEventListener('visibilitychange', visibilite);
      terre.dispose(); piece.dispose(); pluie.dispose(); eclats.dispose(); poussiere.dispose(); fouille.dispose(); envRT.dispose();
      fond.geometry.dispose(); fond.material.dispose(); matFondu.dispose(); matVoile.dispose(); quad.geometry.dispose();
      if (rtA) { rtA.dispose(); rtB.dispose(); }
      if (composer) composer.dispose();
      renderer.dispose(); ecoute.clear();
      canvas.style.cursor = '';
    },
  };
}
