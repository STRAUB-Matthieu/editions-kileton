// Valeurs des scènes 0 à 9.
// T en secondes (horloge de la page). Positions verticales en fraction de la hauteur d'écran h, tailles en px CSS.
// La table du temps fait foi dans js/talent/table.js (page) ; les valeurs sont recopiées ici.

// Couleurs de la marque, en hexadécimal sRGB (aucun #000, aucun #FFF, ni Nacre ni Bleu ni Rouge avant la scène 10).
export const COULEURS = {
  encre: 0x141218,        // Outrenoir
  abysse: 0x060912,       // Abysse
  ocre: 0x473100,         // Ocre profond
  ambre: 0x532800,        // Ambre profond
  braise: 0xC9772E,       // Braise
  orBruni: 0xA8842F,      // Or bruni
  or: 0xD4AF37,           // Or
  orPale: 0xE8D48B,       // Or pâle
  incandescence: 0xFFF3D6, // Incandescence
  cendre: 0x8A8580,       // Cendre
  perle: 0xECE8E2,        // Perle (la lumière des portes sur les flancs de la pièce)
};

// Table du temps (§ 1) : début de chaque scène.
export const SCENES = [0, 3.0, 11.0, 16.0, 29.0, 38.0, 44.0, 52.0, 57.0, 64.8, 74.0];
export const scene = (T) => { let i = 0; while (i < SCENES.length - 1 && T >= SCENES[i + 1]) i++; return i; };

// Scène 3 : les neuf crans du mode automatique (§ 4), puis 0,25 écran linéaire de 28,0 à 29,0.
export const CRANS = [16.6, 17.9, 19.1, 20.4, 21.8, 23.1, 24.5, 26.0, 27.6];
export const DUREE_CRAN = 0.45;
// Scène 4 : trois coups (§ 3).
export const COUPS = [31.0, 33.5, 36.0];

// Courbes (mêmes définitions que GSAP : power1 = quadratique, power2 = cubique).
export const ease = {
  expoOut: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  power2In: (t) => t * t * t,
  power2InOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  power1InOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  sineInOut: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
};
export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const lerp = (a, b, t) => a + (b - a) * t;
// progression entre deux instants, avec courbe
export const entre = (T, a, b, f = (x) => x) => f(clamp01((T - a) / (b - a)));

// q3 du mode automatique : 0,1 par cran (0,25 écran sur 2,5), puis 0,1 linéaire de 28,0 à 29,0.
export function q3Auto(T) {
  let q = 0;
  for (const t of CRANS) q += 0.1 * entre(T, t, t + DUREE_CRAN, ease.expoOut);
  return q + 0.1 * entre(T, 28.0, 29.0);
}
// État que donnerait la page en mode automatique sans geste (démo, essais).
export function etatAuto(T) {
  return { mode: 'auto', q3: q3Auto(T), vDefil: 0, t8: Math.min(6, Math.max(0, T - 57.0)), son: false };
}

// Formats de référence (390 / 768 / 1440), choisis par la largeur.
export function format(w, h) {
  const k = w < 600 ? 0 : w < 1100 ? 1 : 2;
  const v = (a) => a[k];
  return {
    k, nom: v(['390', '768', '1440']),
    pinceau: v([64, 88, 120]),
    d13: v([48, 60, 72]), d4: v([24, 30, 36]), d56: v([96, 128, 150]), d8: v([200, 280, 340]), d9: v([256, 370, 480]),
    // scène 9 : la pièce s'arrête plus bas, son quart inférieur derrière la lèvre avant
    y9: v([0.44, 0.44, 0.45]), surf9: v([0.58, 0.58, 0.69]),
    surf4: v([0.225, 0.225, 0.30]), coin4: v([0.87, 0.87, 0.86]),
    fuseau: v([40, 56, 68]),
    // lumière : la faille éclaire la terre sur rb px de part et d'autre ; son halo retombe sur halo px ;
    // les réserves de gravure sont fondues sur fondu px
    rb: v([64, 88, 120]), halo: v([24, 32, 40]), fondu: v([24, 32, 40]),
    // réserve sous le repère : bloc texte en bas à gauche, marge de 16 px comprise.
    // 390 : x = 16, étiquette à 0,915 h, valeur à 0,955 h ; 1440 : le bloc suit le point (0,86 h), à 16 px à droite du filet (x = 48).
    // Tour 3 : une ellipse fondue sur 48 px, de même forme que le voile de la page.
    // Valeurs estimées (centre x en px, centre y en h, largeur et hauteur en px) ; la page donne les vraies par setReserves().
    repere: v([{ cx: 88, cy: 0.93, l: 300, h: 130 }, { cx: 110, cy: 0.935, l: 340, h: 140 }, { cx: 170, cy: 0.865, l: 420, h: 150 }]),
    // bord de la cavité de la pièce (scènes 4 à 6), fondu
    cavF: v([10, 14, 18]),
    // réserves de gravure sous les textes posés sur la terre (px CSS ; ± demi-colonne autour du centre)
    reserve7: { demi: v([171, 280, 380]) + 16, y0: 0.12, y1: 0.33 },
    reserve8: { demi: v([115, 150, 190]), y0: 0.165, y1: 0.235 },
    reserve9: { demi: v([180, 280, 450]), y0: v([0.617, 0.63, 0.76]), y1: v([0.842, 0.87, 0.95]) },
    // --- scènes 10 à 12 ; x en fraction de la largeur
    d10: v([64, 64, 72]), x10: v([0.5, 0.5, 960 / 1440]), y10: v([0.125, 0.125, 0.155]),   // pièce en haut (scène 10)
    surf10: v([0.195, 0.185, 0.205]),                                                     // surface de la terre
    emp: v([{ d: 270, x: 0.5, y: 0.370 }, { d: 347, x: 0.5, y: 0.371 }, { d: 582, x: 960 / 1440, y: 0.560 }]), // le lit
    // bord du creux fondu sur 22 px à 390 (10 avant), 14 et 18 inchangés
    empF: v([22, 14, 18]), empB: v([10, 14, 18]), bande10: v([24, 32, 40]), arete10: v([4, 5, 7]),              // bord du creux, bande sous la surface, arêtes du lys
    d11: v([36, 44, 56]), x11: v([0.5, 0.5, 0.5]), y11: v([0.679, 0.719, 0.769]),         // pièce posée entre les portes (scène 11)
    d12: v([150, 220, 300]), x12: v([0.5, 0.5, 0.30]), y12: v([0.240, 0.250, 0.50]),      // pièce sur la Nacre (scène 12)
    // réserve de gravure sous T10.1 à T10.5 (x0, x1 en fraction de la largeur ; y en h)
    reserve10: v([{ x0: 0.06, x1: 0.94, y0: 0.555, y1: 0.80 }, { x0: 0.12, x1: 0.88, y0: 0.56, y1: 0.825 }, { x0: 200 / 1440, x1: 680 / 1440, y0: 0.37, y1: 0.69 }]),
  };
}

// Pas de la gravure de l'avers, mesuré sur assets/talent/scene/avers-couleur.webp :
// 14 px sur 1024, le disque occupant 1040/1080 de la carte → diamètre / 70,4. Phase : premier trait à 5/1024.
export const GRAVURE = { pas: 14 / 1024 / (1040 / 1080), phase: 5 / 1024, echelle: 1040 / 1080 };

// Inclinaison dans la terre (scènes 7 et 8) : rotX 14°, rotZ −9°.
export const ROT_X = 14 * Math.PI / 180;
export const ROT_Z = -9 * Math.PI / 180;

// Bord irrégulier de la fouille : même formule ici et dans le shader de la terre.
export const bordFouille = (ly) => 0.05 * Math.sin(5 * ly + 1.3) + 0.03 * Math.sin(11 * ly + 0.4);

// Part d'un disque unité comprise dans la bande |x| < w (0 ≤ w ≤ 1), et son inverse (dichotomie).
export function partBande(w) {
  const x = Math.min(1, Math.max(0, w));
  return (2 / Math.PI) * (x * Math.sqrt(1 - x * x) + Math.asin(x));
}
export function largeurBande(f) {
  if (f <= 0) return 0; if (f >= 1) return 1;
  let a = 0, b = 1;
  for (let i = 0; i < 30; i++) { const m = (a + b) / 2; if (partBande(m) < f) a = m; else b = m; }
  return (a + b) / 2;
}
