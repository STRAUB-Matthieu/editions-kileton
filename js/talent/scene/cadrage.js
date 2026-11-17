// Le cadrage : ce que montre l'image à l'instant T. Fonction pure de (T, état, fouille mémorisée).
// Deux mondes : A (scènes 3 et 4 : la pluie, le tas, la coupe) et B (scènes 5 à 9 : la faille, la fouille, la révélation).
// Coordonnées du monde : x en px depuis l'axe de l'écran, y en px depuis le haut (unité : h = hauteur d'écran).
// Caméra orthographique : yÉcran = (yMonde − cc) × z + H / 2 ; xÉcran = W / 2 + xMonde × z.
import { COUPS, ROT_X, ROT_Z, ease, clamp01, lerp, entre } from './recette.js';

const deg = Math.PI / 180;
// Strates datées (monde A), en h : « 2025 » de 0,95 à 1,15 et « 2002 » de 1,45 à 1,65
// (donnent 0,30 → 0,40 h et 0,55 → 0,65 h à l'écran à la fin de la scène 4, à 390 et 768).
export const DATEES = [0.95, 1.15, 1.45, 1.65];

function base(W, H, F) {
  return {
    scene: 0, fond: 0, monde: 0, nuitAbysse: 0, cc: H / 2, z: 1,
    piece: { x: W / 2, y: 0.62 * H, d: F.d13, rotX: 0, rotZ: 0, op: 1, voile: 0 },
    croix: 0.6, jour: 0.22, arete: 0, parois: 0, ombre: 0,
    surfW: 1e6, mont: 0, montSig: Math.max(70, 0.12 * W),
    cav: [0, 0, 0], sillon: 0, datees: 0,
    failleLim: -1e6, coeur: 2, failleI: 0, fus: [0, 0, 0.34 * H, 0.63 * H], filetHaut: 0,
    fouille: 0, fouilleFade: 1,
    s9: [0, 0, 0, 0], s9b: [W / 2, 0, F.d9, 0],
    reserve: null, reserveA: 0, indice: null, bloom: 0, pluie: 0, fondu: null,
    // lumière et matière
    lum: [0.16, F.rb, F.halo, 1],   // nuit (éclairage ambiant), rayon de la faille, retombée du halo, souffle (posé par index.js)
    souffleA: 0,                      // amplitude de la respiration de la faille (0-1), × 8 %
    cl: [1, 0, 1, 0],                 // lumière de la croix : rayon éclairé (px, depuis le centre), intensité, rayon des lignes d'or, crête
    rim: 0,                           // reste de lueur à la surface (scène 4)
    dens: [0, 1, 1],                  // hachures plus serrées dans le bas de la coupe (monde, px) : de a à b, pas × k
    reserves: [],                     // [x0, y0, x1, y1, opacité, 0] (rectangle) ou [cx, cy, demi-largeur, demi-hauteur, opacité, 1] (ellipse), px
    braise: 0,                        // 1 : la croix n'est plus qu'une braise (Or bruni), après la rupture de 11,0
    aureole: 0,                       // retombée Or pâle autour de la pièce pendant sa sortie (64,8 → 67,4)
    eclair: 1,                        // éclairage de toute la pièce (0,45 pendant le souffle retenu)
    fondGlow: 0,                      // dégradé radial du fond centré sur la croix (scène 9)
    levre: 0,                         // lèvre avant devant le quart bas de la pièce (scène 9)
    poussiere: 0,                     // poussière dans les halos (palier haut, scènes 5 à 9)
    // scènes 10 à 12 ; valeurs neutres pour 0 à 9
    camX: 0,                          // décalage horizontal de la caméra (px du monde)
    emp: null,                        // l'empreinte du revers : { x, y, d (px écran), vis (0-1) }
    empL: 0,                          // intensité de la lumière rasante sur l'empreinte (0 à 74,6, 1 à 76,0)
    lysK: 1,                          // relief du lys de l'empreinte (1 ; 0 à 84,4, avant que la couverture ne bouge)
    s10: [0, 0, 0, 0],                // lumière de la scène 10 : poids, bande sous la surface (px), x de la pièce, demi-largeur (px)
    glow2: 0,                         // retombée Or bruni dans la nuit, au contact de la pièce (18 % → 0 à 1,6 R)
    vig: 0,                           // vignette Abysse de la nuit (scène 11) : 0 → 40 % aux bords sur 0,30 W
    bloomForce: 0.6,                  // force du bloom (0,6 ; 0,40 après 77,0)
    reflet: 0,                        // reflet de l'or sur le papier (scène 12) : opacité au cœur
    piece2: { rotY: 0, recul: 1, dy: 0, listel: [0, 0, 0], balai: [-1, 0], flancs: 0, revers: 0, anneau: 0, pleine: 0 },
    lumJour: 0,                       // lumière directionnelle du jour, d'en haut à gauche (scène 12)
    transparent: false,               // canevas transparent (dès 86,0) : seules la pièce et sa lumière
  };
}

// réserves de gravure : un bloc centré ou le repère (bas à gauche)
const resCentre = (r, W, H, a) => [W / 2 - r.demi, r.y0 * H, W / 2 + r.demi, r.y1 * H, a, 0];
// la réserve du repère est une ellipse ; index.js la remplace par la place donnée par la page (setReserves), s'il y en a une
const resRepere = (F, H, T) => Object.assign([F.repere.cx, F.repere.cy * H, F.repere.l / 2, F.repere.h / 2, entre(T, 29.0, 29.6) * (1 - entre(T, 65.4, 66.0)), 1], { repere: true });
// lumière de la croix, scènes 5 à 8 : rayon 1,6 R, intensité selon la croix
function lumCroix(L) { const R = L.piece.d / 2; L.cl = [1.6 * R, L.croix / 0.9, 1.6 * R, 0]; }

// --- scènes 1 et 2 : la pièce seule sur le canevas transparent (la porte est un SVG de la page)
function scenes12(T, L, H, F) {
  const p = entre(T, 3.4, 7.0, ease.power2InOut);
  L.piece.y = lerp(0.30, 0.62, p) * H;
  L.piece.op = entre(T, 3.4, 3.75);
  const s = Math.max(0, T - 3.4);
  L.piece.rotZ = T < 3.4 ? 0 : 4 * deg * Math.sin(2 * Math.PI * s / 1.3) * Math.exp(-s / 1.2);
  L.croix = T < 7.0 ? 0.35 : lerp(0.35, 0.60, entre(T, 7.0, 7.4));
  L.jour = T < 11.0 ? 0.7 : lerp(0.7, 0.45, entre(T, 11.0, 11.12, ease.power2In)); // la porte éclaire, puis claque
  L.ombre = entre(T, 6.6, 7.0);
  // la rupture : à 11,0, avec la fente, la pièce s'éteint (≤ 35 %) en 0,12 s ; la croix reste une braise
  const k = entre(T, 11.0, 11.12);
  L.eclair = lerp(1, 0.28, k);
  L.braise = k;
}

// --- scène 3 : la pluie de terre, le tas monte, la caméra suit la pièce
function scene3(T, etat, L, W, H, F) {
  const q = clamp01(etat.q3 || 0);
  L.monde = 1; L.fond = entre(T, 16.0, 17.0); L.pluie = 1;
  L.cc = (0.50 + 0.30 * q) * H; L.z = 1;
  L.piece.y = 0.62 * H; L.piece.d = F.d13;
  const s = 1.10 - 0.60 * (1 - Math.pow(1 - q, 1.4)); // surface à l'écran, de 1,10 h à 0,50 h
  L.surfW = L.cc + (s - 0.5) * H;
  L.mont = 0.055 * H * clamp01((q - 0.05) / 0.45);
  const dessus = 0.62 * H - (s * H - L.mont);        // terre au-dessus du centre de la pièce (px)
  const r = F.d13 / 2;
  const c = clamp01((dessus + r) / (0.12 * H + r));
  L.croix = 0.60 - 0.45 * c;
  L.piece.voile = 0.25 * c;
  L.ombre = 1 - c;
  L.jour = 0.22;
  // la croix redevient la source dès 16,0
  L.braise = 1 - entre(T, 16.0, 16.3);
  L.eclair = lerp(0.28, 1, entre(T, 16.0, 16.6));
  // la croix est la seule source ; quand elle s'étouffe, la terre s'éteint avec elle
  const k = L.croix / 0.6;
  L.cl = [Math.max(1.6 * r, F.rb) * Math.sqrt(k), k, 1.6 * r, 0];
}

// --- scène 4 : le recul, la coupe, trois coups
function scene4(T, L, W, H, F) {
  const z4 = (F.coin4 - F.surf4) / (2.09 - 0.80);
  const c4 = 0.80 + (0.5 - F.surf4) / z4;
  const zp = entre(T, 29.0, 32.0, ease.sineInOut);
  L.monde = 1; L.fond = 1; L.pluie = T < 30.5 ? 1 : 0;
  L.z = lerp(1, z4, zp); L.cc = lerp(0.80, c4, zp) * H;
  let yw = 0.92;
  for (const t of COUPS) yw += 0.39 * entre(T, t, t + 0.5, ease.power2In);
  L.piece.y = (yw * H - L.cc) * L.z + H / 2;
  L.piece.d = lerp(F.d13, F.d4, zp);
  L.surfW = 0.80 * H;
  L.mont = 0.055 * H * (1 - zp);
  L.croix = lerp(0.15, 0.10, zp);
  L.piece.voile = lerp(0.25, 0.55, zp);
  L.cav = [1.83, 1.42, entre(T, 29.0, 30.0)];
  L.sillon = entre(T, 29.0, 30.0);
  L.datees = entre(T, 29.6, 32.0);
  L.jour = 0.12; L.ombre = 0;
  // la coupe se lit par la lueur faible de la pièce au fond et par un reste de lueur à la surface
  const R = L.piece.d / 2;
  L.cl = [Math.max(1.6 * R, F.rb), L.croix / 0.2, 1.6 * R, 0];
  L.rim = lerp(0.2, 0.7, zp);
  L.dens = [1.3 * H, 1.75 * H, 0.8];
  L.reserves = [resRepere(F, H, T)];
}

// --- scènes 5 et 6 : nouveau cadrage fixe ; la faille descend sur l'axe de la porte
function scenes56(T, L, W, H, F) {
  L.monde = 2; L.fond = 1; L.nuitAbysse = 1;
  L.cc = H / 2; L.z = 1;
  L.piece.y = 0.78 * H; L.piece.d = F.d56;
  L.cav = [1.46, 1.25, 1];
  const prog = entre(T, 38.9, 40.7, ease.expoOut);
  const haut = 0.40 * H, bas = 0.78 * H - F.d56 / 2;
  L.failleLim = prog > 0 ? haut + prog * (bas - haut) : -1e6;
  L.failleI = prog > 0 ? 1 : 0;
  L.coeur = 2 + 2 * entre(T, 44.0, 46.0, ease.power1InOut);
  L.croix = lerp(0.10, 0.25, entre(T, 40.0, 41.5));
  L.piece.voile = T < 44 ? 0.45 : lerp(0.45, 0.35, entre(T, 44, 46));
  L.jour = 0.18;
  lumCroix(L);
  // la faille respire (± 8 %, période 4 s), jamais pendant le silence : stable de 44,0 à 46,5
  L.souffleA = entre(T, 39.6, 40.7) * (T < 45 ? 1 - entre(T, 43.6, 44.0) : entre(T, 46.5, 47.0));
  L.reserves = [resRepere(F, H, T)];
  L.poussiere = entre(T, 39.0, 40.0);
}

// --- scène 7 : la terre se fend ; poussée jusqu'à la pièce
function scene7(T, L, W, H, F) {
  scenes56(52, L, W, H, F);
  const p = entre(T, 52.0, 57.0, ease.power2InOut);
  const z7 = F.d8 / F.d56;
  L.z = lerp(1, z7, p);
  L.piece.y = lerp(0.78, 0.63, p) * H;
  L.piece.d = F.d56 * L.z;
  L.cc = 0.78 * H - (L.piece.y - H / 2) / L.z;
  L.piece.rotX = ROT_X * p; L.piece.rotZ = ROT_Z * p;
  L.piece.voile = lerp(0.35, 0, p);
  L.cav = [1.46, 1.25, 1 - entre(T, 52.0, 54.0)];
  L.failleLim = 1e6;
  L.coeur = lerp(4, 16, entre(T, 52.0, 57.0));
  L.fus = [p, (F.fuseau / 2) * p, 0.34 * H, L.piece.y];
  L.filetHaut = 0.8 * entre(T, 52.0, 53.0);
  L.croix = lerp(0.25, 0.45, entre(T, 52.0, 57.0));
  L.jour = lerp(0.18, 0.35, p); L.parois = L.croix;
  L.reserve = F.reserve7; L.reserveA = entre(T, 52.0, 52.6) * (1 - entre(T, 56.8, 57.4));
  lumCroix(L);
  L.souffleA = 1 - entre(T, 52.0, 52.5);
  // T7.1 reste jusqu'à 58,2 : sa réserve aussi
  L.reserves = [resCentre(F.reserve7, W, H, entre(T, 52.0, 52.6) * (1 - entre(T, 57.6, 58.2))), resRepere(F, H, T)];
}

// --- scène 8 : creuser (fouille mémorisée, retrait seul selon t8)
function scene8(T, etat, L, W, H, F, fo) {
  scene7(57, L, W, H, F);
  L.reserve = F.reserve8; L.reserveA = entre(T, 57.2, 57.6) * (fo.libre ? 1 - clamp01(fo.depuisLibre / 0.6) : 1);
  L.fouille = 1;
  const k = clamp01((fo.ratio - fo.r0) / Math.max(0.01, 0.55 - fo.r0));
  if (fo.libre) L.croix = 0.90;
  else L.croix = Math.min(0.90, 0.45 + 0.45 * k + (fo.premier ? 0.1 : 0));
  if (T >= 63.0) L.croix = lerp(0.90, 0.30, entre(T, 63.0, 63.3)); // le souffle retenu
  L.failleI = fo.libre ? 0 : 0.7 * (1 - k);
  L.parois = L.croix; L.jour = fo.libre ? 0.45 : 0.35;
  L.bloom = 0.5; // préparé ici, rendu à partir de 64,8
  if (!fo.geste && !fo.libre && T >= 59.0) L.indice = [W / 2 + 20 * Math.sin(2 * Math.PI * (T - 59.0) / 1.2), 0.84 * H];
  // le souffle retenu : toute la pièce descend à 0,45
  L.eclair = lerp(1, 0.45, entre(T, 63.0, 63.3));
  lumCroix(L);
  const libreA = fo.libre ? 1 - clamp01(fo.depuisLibre / 0.6) : 1;
  L.reserves = [resCentre(F.reserve7, W, H, 1 - entre(T, 57.6, 58.2)), resCentre(F.reserve8, W, H, entre(T, 58.0, 58.4) * libreA), resRepere(F, H, T)];
}

// --- scène 9 : la révélation
function scene9(T, etat, L, W, H, F, fo) {
  scene8(64.79, etat, L, W, H, F, { ...fo, libre: true, depuisLibre: 1 });
  L.indice = null; L.reserve = null; L.reserveA = 0;
  L.croix = lerp(0.30, 1.0, entre(T, 64.8, 65.05, ease.expoOut));
  const p = entre(T, 64.8, 67.2, ease.power2InOut);
  const S9 = F.y9 * H - 0.14 * F.d9;  // haut de la terre basse sur les côtés : elle tient la pièce de chaque côté
  // la caméra recule, ancrée sur la ligne des lèvres (0,58 h) : la terre reprend son grain de la scène 5
  const z8 = L.z, yS9 = L.cc + (S9 - H / 2) / z8;
  L.z = lerp(z8, 1.06, p);
  L.cc = yS9 - (S9 - H / 2) / L.z;
  let y = lerp(0.63, F.y9, p) * H, d = lerp(F.d8, F.d9, p);
  // après 73,0 la pièce commence à se lever (scène 10) : jusqu'à sa place du haut, 64 / 64 / 72 px, en 3 s
  const m = entre(T, 73.0, 76.0, ease.power2InOut);
  y = lerp(y, F.y10 * H, m); d = lerp(d, F.d10, m);
  L.piece.y = y; L.piece.d = d;   // en x, la pièce reste à la verticale du lit (scene10 la décale avec la caméra, à 1440)
  L.piece.rotX = ROT_X * (1 - p); L.piece.rotZ = ROT_Z * (1 - p);
  const ouv = entre(T, 64.8, 66.0, ease.expoOut);
  L.s9 = [ouv * 0.62 * W, S9, entre(T, 64.8, 66.0), entre(T, 66.0, 67.2, ease.power1InOut)];
  L.s9b = [W / 2, F.y9 * H, F.d9, entre(T, 65.4, 66.6)];
  L.fouilleFade = 1 - entre(T, 64.8, 66.0);
  const ferme = 1 - entre(T, 64.8, 66.0);
  L.fus = [L.fus[0] * ferme, L.fus[1] * ferme, L.fus[2], L.fus[3]];
  L.failleI = 0;
  L.jour = lerp(0.45, 0.9, p); L.arete = 0.6 * p; L.parois = L.croix;
  L.reserve = F.reserve9; L.reserveA = entre(T, 66.4, 67.0);
  L.bloom = 1;
  // la révélation est un lever de lumière : l'onde part de la croix et parcourt la terre en 1,2 s, puis retombe à 3 R en 2 s
  L.eclair = lerp(0.45, 1, entre(T, 64.8, 65.05, ease.expoOut));
  const R = d / 2;
  const Rmax = 1.05 * Math.hypot(Math.max(W / 2, W / 2), Math.max(y, H - y));
  const w1 = entre(T, 64.8, 66.0, (t) => 1 - (1 - t) * (1 - t));
  const w2 = entre(T, 66.0, 68.0, ease.sineInOut);
  // rayon de la retombée : la lumière s'éteint à 2 × ce rayon (1,6 R → 3,2 R avant ; toute la terre à 66,0 ; 3 R après 68,0)
  const Rw = lerp(1.6 * R, Rmax, w1);
  L.cl = [lerp(Rw, 1.5 * R, w2), L.croix / 0.9, lerp(Rw, 1.6 * R, w2), 0.45 * Math.sin(Math.PI * entre(T, 64.8, 66.0))];
  L.fondGlow = entre(T, 64.8, 65.3);
  L.aureole = entre(T, 64.8, 65.0) * (1 - entre(T, 66.6, 67.4));
  L.levre = entre(T, 65.8, 66.6);
  L.reserves = [resCentre(F.reserve9, W, H, L.reserveA), resRepere(F, H, T)];
  L.poussiere = 1;
}

// --- scène 10 : le livre (74,0 → 84,0). La pièce monte (73,0 → 76,0, scene9) ; la caméra descend vers son lit (74,0 → 76,4) :
// le lit (là où la pièce reposait) vient au centre et au diamètre du tableau ; la surface monte jusqu'à surf10 ;
// l'empreinte du revers s'y lit en lumière rasante venue de la pièce, en haut.
function scene10(T, etat, L, W, H, F, fo) {
  scene9(T, etat, L, W, H, F, fo);
  const z9 = L.z, cc9 = L.cc, E = F.emp;
  const litW = cc9 + (F.y9 * H - H / 2) / z9;                 // le lit, dans le monde (centre de la pièce de la scène 9)
  const z10 = z9 * E.d / F.d9;
  const pc = entre(T, 74.0, 76.4, ease.power2InOut);
  const z = lerp(z9, z10, pc);
  const bx = lerp(W / 2, E.x * W, pc), by = lerp(F.y9 * H, E.y * H, pc);
  L.z = z; L.cc = litW - (by - H / 2) / z; L.camX = -(bx - W / 2) / z;
  L.emp = { x: bx, y: by, d: F.d9 * z / z9, vis: entre(T, 73.8, 75.2) };
  L.empL = entre(T, 74.6, 76.0);
  // l'empreinte s'aplatit avant que la couverture ne glisse : relief du lys 0,05 D → 0 et lumière rasante 1 → 0,
  // de 83,6 à 84,4 (power1InOut). À 84,4, le creux est vide : aucun lys ne réapparaît sous la couverture qui s'en va.
  const plat = entre(T, 83.6, 84.4, ease.power1InOut);
  L.empL *= 1 - plat; L.lysK = 1 - plat;
  // la terre basse monte jusqu'à la surface du tableau ; croissant, lignes de la pièce et lèvre avant s'effacent
  const S9 = L.s9[1];
  L.s9 = [2 * W, lerp(S9, F.surf10 * H, pc), L.s9[2] * (1 - entre(T, 74.0, 74.6)), L.s9[3]];
  L.s9b = [bx, by, L.emp.d, L.s9b[3] * (1 - entre(T, 74.0, 75.0))];
  // la lèvre avant reste en place (elle cache encore le bas de la pièce qui monte) ; son arête s'efface dans terre.js
  L.aureole = 0; L.fondGlow *= 1 - entre(T, 74.0, 75.0);
  L.piece.x = bx;                                               // la pièce monte à la verticale du lit
  L.croix = 1.0;
  // lumière : la croix, en haut. Lignes d'or dans 0,30 h autour de la pièce, en (1 − d/r)² ; la terre éclairée jusqu'à 0,55 h ;
  // la bande sous la surface, à la verticale de la pièce ; la nuit au-dessus (Or bruni 18 % → 0 à 1,6 R, dans le fond)
  const m = entre(T, 74.0, 76.0, ease.power2InOut);
  const R = L.piece.d / 2;
  const cl10 = [0.6 * R + Math.max(0.275 * H - 0.3 * R, 1), 1 / 0.9, R + 0.30 * H, 0];
  L.cl = L.cl.map((v, i) => lerp(v, cl10[i], m));
  L.s10 = [m, F.bande10, bx, 0.30 * H];
  L.glow2 = m;
  L.poussiere = 1 - entre(T, 74.0, 75.0);
  L.bloomForce = lerp(0.6, 0.40, entre(T, 76.0, 77.0));
  // réserves : T9.1 sort (74,0 → 74,6) ; T10.1 à T10.5 entrent à 78,2 et sortent de 84,0 à 84,6
  const r = F.reserve10;
  L.reserves = [resCentre(F.reserve9, W, H, 1 - entre(T, 74.0, 74.6)),
    [r.x0 * W, r.y0 * H, r.x1 * W, r.y1 * H, entre(T, 78.0, 78.6) * (1 - entre(T, 84.0, 84.6)), 0]];
}

// --- scène 11 : les deux portes (84,0 → 92,0). La terre descend hors du cadre (84,0 → 86,0) ; dès 86,0 le canevas est transparent
// (la page dessine la nuit, les portes et le sol) ; la pièce redescend et se pose entre les portes (84,6 → 87,0), avec le
// balancement de la scène 1 ; les ouvertures éclairent ses flancs.
function scene11(T, etat, L, W, H, F, fo) {
  scene10(T, etat, L, W, H, F, fo);
  const q = entre(T, 84.0, 86.0, ease.power2InOut);
  const dy = (1.10 - F.surf10) * H * q;
  L.cc -= dy / L.z; L.emp.y += dy; L.s9[1] += dy; L.s9b[1] += dy;
  L.vig = entre(T, 84.0, 85.0);
  // dès 84,6, le canevas efface sa nuit au-dessus de la surface (la terre, dessous, reste) : la nuit est celle de la
  // page, et les portes qu'elle trace dès 84,6 se voient. La nuit de la page est la même (Outrenoir et vignette Abysse) : le
  // fondu de 84,45 à 84,6 ne se voit pas. La retombée Or bruni autour de la pièce reste, posée sur la page (fond, glow2).
  L.fond = 1 - entre(T, 84.45, 84.6);
  L.transparent = T >= 86.0;
  const pd = entre(T, 84.6, 87.0, ease.power2InOut);
  L.piece.x = lerp(L.piece.x, F.x11 * W, pd);
  L.piece.y = lerp(F.y10 * H, F.y11 * H, pd);
  L.piece.d = lerp(F.d10, F.d11, pd);
  const s = Math.max(0, T - 84.6);
  L.piece.rotZ = T < 84.6 ? 0 : 4 * deg * Math.sin(2 * Math.PI * s / 1.3) * Math.exp(-s / 1.2);
  L.croix = lerp(1.0, 0.60, entre(T, 84.6, 85.4));
  L.jour = lerp(L.jour, 0.45, pd);
  L.piece2.flancs = 0.6 * entre(T, 85.4, 87.0, ease.power2InOut);
  L.bloomForce = 0.40 * (1 - entre(T, 85.6, 86.0));
  L.glow2 *= 1 - q;
  L.cl[1] *= 1 - q;
}

// --- scène 12 : trois frappes (16,50 → 19,50 écrans, sans horloge). Fonction de etat.y, etat.frappes, etat.tFrappe.
const FACES = [0, 0, 62, 180];
const ANNEAU = 1.7, ANNEAU_REPOS = 0.40;   // gain de l'anneau au coup (+ 35 % en moyenne) et au repos après la frappe I (+ 10 %)  // rotation Y (degrés) après 0, 1, 2, 3 frappes
function scene12(etat, L, W, H, F, fo, extra) {
  scene11(92, etat, L, W, H, F, fo);
  const y = etat.y, P2 = L.piece2;
  L.scene = 12; L.transparent = true; L.fond = 0; L.bloom = 0; L.bloomForce = 0;
  L.emp = null;                                        // le lit est loin sous l'écran : getState().empreinte = null
  // 12 a : le jour entre ; la pièce quitte le seuil et monte au centre (16,60 → 17,10)
  const p = entre(y, 16.60, 17.10, ease.power2InOut);
  const j = entre(y, 16.50, 17.10, ease.power1InOut);
  L.piece.x = lerp(F.x11 * W, F.x12 * W, p);
  L.piece.y = lerp(F.y11 * H, F.y12 * H, p);
  L.piece.d = lerp(F.d11, F.d12, p);
  L.piece.rotZ = 0;
  P2.flancs = 0.6 * (1 - j);
  L.jour = lerp(0.45, 0.9, j); L.lumJour = j;
  L.croix = lerp(0.60, 0.45, p);
  const voile = p;                                     // le reflet naît avec la Nacre
  // 12 b à e : les frappes ; k = 4 (ou une frappe de plus) : le recul seul
  const k = Math.max(0, Math.min(3, Math.round(etat.frappes || 0)));
  const tf = Number.isFinite(etat.tFrappe) ? Math.max(0, etat.tFrappe) : 1e9;
  let croix = L.croix, refl = 0.30;
  if (k > 0 && tf < 0.30) {                            // impact : recul (1 → 0,965, + 3 px) puis retour en 0,24 s
    const s = tf < 0.06 ? lerp(1, 0.965, tf / 0.06) : lerp(0.965, 1, ease.expoOut((tf - 0.06) / 0.24));
    P2.recul = s; P2.dy = 3 * (1 - s) / 0.035;
  }
  let rot = FACES[k];
  if (!extra && k >= 2 && tf < 0.76) rot = lerp(FACES[k - 1], FACES[k], ease.power2InOut(clamp01((tf - 0.06) / 0.70)));
  P2.rotY = rot * deg;
  const pic = (a, b, c) => (tf < 0.08 ? lerp(a, b, tf / 0.08) : lerp(b, c, entre(tf, 0.08, 1.28)));
  // la croix éclaire la face autour d'elle (anneau de 0,12 à 0,40 D) : + 35 % de luminance moyenne à 0,1 s,
  // + 10 % à 1,2 s et ensuite ; elle prend l'Incandescence pleine au coup. ANNEAU = gain au bord intérieur de l'anneau.
  if (k === 1) { P2.anneau = ANNEAU_REPOS; }
  if (k >= 1) { croix = 0.70; refl = 0.36; }
  if (k === 1 && !extra) { croix = pic(0.45, 1.0, 0.70); refl = pic(0.30, 0.55, 0.36); P2.anneau = pic(0, ANNEAU, ANNEAU_REPOS); }
  if (k === 2 && !extra) P2.anneau = ANNEAU_REPOS * (1 - entre(tf, 0.06, 0.76));
  if (k >= 2) { croix = 0.45; P2.listel = [0, 0, 0.4]; }
  if (k === 2 && !extra) {
    croix = lerp(0.70, 0.45, entre(tf, 0.06, 0.76));
    refl = pic(0.36, 0.50, 0.36);
    // un éclat Incandescence (90 %) fait le tour du listel en 0,9 s ; ensuite la moitié haute reste à 40 % d'Or pâle
    P2.listel = [Math.PI / 2 - 2 * Math.PI * clamp01(tf / 0.9), tf < 0.9 ? 0.9 * (1 - entre(tf, 0.8, 0.9)) : 0, 0.4 * entre(tf, 0.5, 0.9)];
  }
  if (k >= 3) { refl = 0.40; P2.balai = [2, 0.45]; P2.revers = 1; }
  if (k === 3 && !extra) {
    // la lumière rasante balaie le revers de gauche à droite en 0,9 s (dès que le revers est de face)
    const b = entre(tf, 0.55, 1.45);
    P2.balai = [lerp(-0.2, 1.2, b), 0.45 * entre(tf, 0.55, 1.45)];
    refl = pic(0.36, 0.55, 0.40);
  }
  L.croix = k === 0 ? L.croix : croix;
  P2.pleine = k === 1 ? clamp01((croix - 0.70) / 0.30) : 0;
  L.reflet = refl * voile;
  if (etat.vol) { L.piece.op = 0; L.reflet = 0; }   // la page fait voler la pièce en 2D
}

// T, état de la page, format, taille ; fo = fouille mémorisée { ratio, r0, libre, depuisLibre, premier, geste }.
export function cadrage(T, etat, F, W, H, fo) {
  const L = base(W, H, F);
  if (T < 16.0) { L.scene = T < 3 ? 0 : T < 11 ? 1 : 2; scenes12(T, L, H, F); return L; }
  if (T < 29.0) { L.scene = 3; scene3(T, etat, L, W, H, F); return L; }
  if (T < 38.0) { L.scene = 4; scene4(T, L, W, H, F); return L; }
  if (T < 52.0) {
    L.scene = T < 44 ? 5 : 6;
    scenes56(T, L, W, H, F);
    if (T < 38.9) { // fondu en grain de la coupe vers le nouveau cadrage
      const A = base(W, H, F); A.scene = 4; scene4(T, A, W, H, F);
      L.fondu = { p: entre(T, 38.0, 38.9), A };
    }
    return L;
  }
  if (T < 57.0) { L.scene = 7; scene7(T, L, W, H, F); return L; }
  if (T < 64.8) { L.scene = 8; scene8(T, etat, L, W, H, F, fo); return L; }
  if (T < 74.0) { L.scene = 9; scene9(T, etat, L, W, H, F, fo); return L; }
  if (T < 84.0) { L.scene = 10; scene10(T, etat, L, W, H, F, fo); return L; }
  // au-delà de 92,0 l'image suit la position (etat.y, en écrans) : scène 12 dès 16,50
  if (T < 92.0 || !(Number(etat.y) >= 16.5)) { L.scene = 11; scene11(Math.min(T, 92.0), etat, L, W, H, F, fo); return L; }
  scene12(etat, L, W, H, F, fo, Number(etat.frappes) >= 4 || !!etat.frappeDePlus); return L;
}

// Hauteur à l'écran d'une ordonnée du monde.
export const versEcran = (L, yw, H) => (yw - L.cc) * L.z + H / 2;
