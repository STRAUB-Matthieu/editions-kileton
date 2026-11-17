// La terre : un plan plein écran dessiné par un shader. Monde A (scènes 3-4 : tas strié, coupe, strates datées, sillon)
// et monde B (scènes 5-9 : nuit d'Abysse, faille, fuseau, fouille, révélation).
// Tour 2 : « l'obscurité d'abord ; la lumière révèle la gravure ».
//   - La terre est dans la nuit : loin des sources, elle n'est éclairée qu'à uLum.x (≈ 26 %) de sa valeur du .
//   - Chaque source (faille, croix) éclaire la terre dans un rayon donné ; dans ce rayon, filets et hachures passent à l'Or bruni
//     (100 % au bord de la source, 0 % à la limite), et la lumière retombe sans bord jusqu'à deux fois ce rayon.
//   - La faille est un émetteur : cœur Incandescence de 2 à 4 px, puis une retombée continue Incandescence → Or pâle → Braise
//     → transparent sur 24 / 32 / 40 px.
//   - Hachures fixées dans le monde (pas de 7 px au zoom 1), parallèles aux strates, et une famille croisée à ± 30° dans l'Ambre.
//   - Grain de matière fixé dans le monde (± 4 % de luminance).
//   - Réserves de gravure à bord irrégulier et fondu (24 / 32 / 40 px).
// Tout est fonction des uniformes posés par index.js à partir du cadrage ; la seule mémoire est la grille de la fouille.
import * as THREE from '../../vendor/three.module.min.js';
import { COULEURS, ROT_X } from './recette.js';

export const MAX_FAILLE = 64;
export const MAX_RESERVES = 4;

const vert = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const frag = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform vec2 uRes;
uniform int uMonde;            // 0 : rien (scènes 1-2) ; 1 : monde A ; 2 : monde B
uniform vec2 uCam;             // centre de la caméra (y du monde, px), zoom
uniform vec3 uSurf;            // surface du monde (y px), hauteur du monticule (px), largeur du monticule (px)
uniform vec4 uEsp;             // écart des strates : de y = a à y = b, il passe de s1 à s2 (px du monde)
uniform vec3 uDens;            // hachures : de y = a à y = b (monde), le pas passe de 7 px à 7 × k px
uniform float uNuit;           // 1 : nuit d'Abysse au-dessus de la surface (monde B)
uniform vec4 uPiece;           // pièce à l'écran : cx, cy, rayon, 0
uniform vec4 uCav;             // cavité : rx, ry (en rayons), opacité ; voile sur la pièce
uniform float uSillon;
uniform vec4 uDatees; uniform float uDateesA;
uniform vec2 uFP[${MAX_FAILLE}]; uniform int uFN; uniform float uFLim; uniform float uCoeur; uniform float uFI;
uniform vec4 uFus;             // fuseau : ouverture 0-1, demi-largeur max (px), haut (px), hauteur de la pièce (px)
uniform float uFiletHaut;
uniform sampler2D uDig; uniform float uFouille; uniform float uWf; uniform float uLibre; uniform float uFouilleFade;
uniform vec4 uEnf;             // pièce de la scène 8 : cx, cy, rayon
uniform vec4 uS9;              // ouverture (px), haut de la terre basse sur les côtés (y px), croissant (0-1), raccord (0-1)
uniform vec4 uS9b;             // pièce finale : cx, cy, diamètre ; lignes d'or (0-1)
uniform float uLevre;          // lèvre avant devant le quart bas de la pièce (0-1, fondu en grain)
uniform vec2 uGrav;            // gravure de la pièce : y du trait de référence, pas (px)
uniform vec4 uResv[${MAX_RESERVES}]; uniform float uResA[${MAX_RESERVES}]; uniform float uResE[${MAX_RESERVES}]; uniform float uFondu;
uniform float uCavF;           // bord fondu de la cavité (px)
uniform float uAureole;        // retombée Or pâle autour de la pièce pendant sa sortie (scène 9)
uniform vec3 uIndice; uniform vec4 uAnneau;
uniform float uParois; uniform float uOmbre; uniform float uTrou;
uniform vec4 uLum;             // nuit (éclairage ambiant), rayon de la faille (px), retombée du halo (px), souffle (facteur)
uniform vec4 uCL;              // lumière de la croix : rayon éclairé (px, depuis le centre), intensité, rayon des lignes d'or, crête de l'onde
uniform float uRim;            // reste de lueur à la surface (monde A)
// scènes 10 à 12 : valeurs neutres pour 0 à 9
uniform float uCamX;           // décalage horizontal de la caméra (px du monde)
uniform vec4 uEmp;             // l'empreinte du revers : centre (px écran), diamètre (px), visibilité
uniform vec4 uEmpL;            // lumière rasante (0-1), bord fondu (px), lys prêt (0/1), arêtes du lys (px)
uniform sampler2D uLys;        // empreinte-lys.webp : le lys lissé de 0,025 D (vert)
uniform float uEmpB;           // largeur du profil de la lumière de la paroi basse (px ; 10 / 14 / 18, inchangée)
uniform vec4 uEmpG;            // relief du lys (0-1), contraste de la gravure dans le creux, plongée de la gravure (px du monde), ombre de la paroi haute
uniform vec4 uS10;             // lumière de la scène 10 : poids, bande sous la surface (px), x de la pièce, demi-largeur (px)
uniform vec4 uReflet;          // reflet de l'or sur le papier (scène 12) : centre de la pièce (px), diamètre, opacité au cœur
uniform vec3 cEncre, cAbysse, cOcre, cAmbre, cBraise, cOrBruni, cOrPale, cIncand, cCendre;

const vec3 LUM = vec3(0.2126, 0.7152, 0.0722);
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float bordF(float a) { return 0.05 * sin(5.0 * a + 1.3) + 0.03 * sin(11.0 * a + 0.4); }
float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
  return length(pa - ba * h);
}
// coordonnée dont le pas passe de s1 (y ≤ a) à s2 (y ≥ b), linéairement entre les deux (intégrale exacte)
float warpG(float y, float a, float b, float s1, float s2) {
  if (abs(s2 - s1) < 0.01 || y <= a) return y / s1;
  float k = (s2 - s1) / (b - a);
  if (y < b) return a / s1 + log((s1 + k * (y - a)) / s1) / k;
  return a / s1 + log(s2 / s1) / k + (y - b) / s2;
}
vec2 locale(vec2 P, vec4 e, vec2 rot) {
  vec2 d = vec2(P.x - e.x, e.y - P.y);
  float c = cos(-rot.y), s = sin(-rot.y);
  vec2 l = vec2(c * d.x - s * d.y, s * d.x + c * d.y);
  l.y /= cos(rot.x);
  return l / e.z;
}
// retombée d'une source de rayon R : pleine près de la source, nulle à 2 R, sans bord
float retombee(float d, float R) { return 1.0 - smoothstep(0.0, 2.0 * R, d); }
// trait antialiasé de largeur w px sur une coordonnée périodique u (une ligne par unité)
float trait(float u, float w) {
  float f = fract(u); float dpx = min(f, 1.0 - f) / max(fwidth(u), 1e-5);
  return 1.0 - smoothstep(0.5 * w - 0.5, 0.5 * w + 0.5, dpx);
}
// halo de la faille : couleur et opacité à la distance t (0 au bord du cœur, 1 à la fin de la retombée)
vec3 rampe(float t) {
  vec3 c = mix(cIncand, cOrPale, smoothstep(0.0, 0.2, t));
  return mix(c, cBraise, smoothstep(0.14, 0.6, t));
}
float haloA(float t) { return exp(-3.0 * t) * (1.0 - smoothstep(0.5, 1.0, t)); }
// réserve de gravure : rectangle à bord irrégulier, fondu sur uFondu px (1 dedans, 0 dehors)
float reserve(vec2 P, vec4 r) {
  vec2 q = max(vec2(r.x - P.x, r.y - P.y), vec2(P.x - r.z, P.y - r.w));
  float d = max(q.x, q.y);
  d += (vnoise(P / 30.0) - 0.5) * 28.0 + (vnoise(P / 11.0 + 7.3) - 0.5) * 9.0;   // bord irrégulier : aucun segment droit
  return 1.0 - smoothstep(0.0, uFondu, d);
}

// réserve en ellipse (repère) : centre, demi-axes ; 1 dedans, 0 au bord, fondu sur 48 px vers l'intérieur
float reserveE(vec2 P, vec4 r) {
  vec2 q = (P - r.xy) / max(r.zw, vec2(1.0));
  float k = length(q);
  vec2 gr = q / (max(r.zw, vec2(1.0)) * max(k, 1e-4));
  float d = (k - 1.0) / max(length(gr), 1e-4);               // distance au bord (px), négative dedans
  return 1.0 - smoothstep(-48.0, 0.0, d);
}

void main() {
  vec2 P = vec2(vUv.x * uRes.x, (1.0 - vUv.y) * uRes.y);
  float W = uRes.x, H = uRes.y;
  vec3 col = cEncre; float a = 0.0;

  // ombre de contact de la pièce (ellipse Outrenoir à 60 %)
  float ombre = 0.0;
  if (uOmbre > 0.0) {
    vec2 o = (P - vec2(uPiece.x, uPiece.y + uPiece.z * 1.08)) / vec2(uPiece.z * 1.1, uPiece.z * 0.2);
    ombre = 0.6 * uOmbre * (1.0 - smoothstep(0.55, 1.0, length(o)));
  }
  if (uMonde == 0) {
    // reflet de l'or sur le papier (scène 12) : ellipse 1,4 D × 0,35 D, 0,62 D sous le centre, Or pâle, en (1 − d/r)², sans contour
    float kr = 0.0;
    if (uReflet.w > 0.0) {
      vec2 e = (P - vec2(uReflet.x, uReflet.y + 0.62 * uReflet.z)) / vec2(0.7 * uReflet.z, 0.175 * uReflet.z);
      float t = clamp(1.0 - length(e), 0.0, 1.0); kr = uReflet.w * t * t;
    }
    float A0 = 1.0 - (1.0 - ombre) * (1.0 - kr);
    vec3 C0 = kr > 0.0 ? (cEncre * ombre * (1.0 - kr) + cOrPale * kr) / max(A0, 1e-4) : cEncre;
    gl_FragColor = vec4(C0, A0);
    #include <colorspace_fragment>
    return; }

  // --- scène 9 : la terre haute s'ouvre en deux et glisse sur les côtés ; la terre basse s'arrête à uS9.y sur les côtés
  vec2 Q = P;
  bool s9 = uS9.y > 0.0;
  float dx9 = P.x - uS9b.x;
  float hautBas = uS9.y + 2.0 * sin(P.x * 0.031 + 0.8) + 1.2 * sin(P.x * 0.083 + 2.1);
  if (s9 && P.y < hautBas) {
    if (abs(dx9) < uS9.x) { gl_FragColor = vec4(cEncre, 0.0);
      #include <colorspace_fragment>
      return; }
    Q.x = P.x - sign(dx9) * uS9.x;
  }

  // --- monde
  float z = uCam.y;
  float yw = uCam.x + (Q.y - 0.5 * H) / z;
  float xw = (Q.x - 0.5 * W) / z + uCamX;
  float bosse = uSurf.y * exp(-(xw / uSurf.z) * (xw / uSurf.z));
  float surf = uSurf.x - bosse + 2.5 * sin(xw * 0.021 + 0.6) + 1.5 * sin(xw * 0.053 + 2.0);
  float sousSurf = smoothstep(-0.5, 0.5, (yw - surf) * z);   // 1 dans la terre
  float prof = max(0.0, (yw - surf) * z);                     // profondeur sous la surface (px écran)
  float yS = yw + bosse;                                       // les strates du tas suivent sa surface

  // --- réserves de gravure (textes posés sur la terre, repère)
  float res = 0.0, coupeFilet = 0.0;
  for (int i = 0; i < ${MAX_RESERVES}; i++) {
    if (uResA[i] <= 0.0) continue;
    if (uResE[i] > 0.5) { res = max(res, uResA[i] * reserveE(P, uResv[i])); continue; }
    res = max(res, uResA[i] * reserve(P, uResv[i]));
    // le filet de la faille ne reprend que 16 px sous le bloc (extrémité fondue sur 12 px) : plus de bout sous l'en-tête
    vec4 r = uResv[i];
    float dy = P.y - r.w - 16.0, dxr = max(r.x - P.x, P.x - r.z);
    coupeFilet = max(coupeFilet, uResA[i] * (1.0 - smoothstep(0.0, 12.0, dy)) * step(dxr, 0.0));
  }

  // --- géométrie de la faille (monde B)
  bool faille = uMonde == 2 && (uFI > 0.0 || uFus.x > 0.0);
  float dm = 1e5, ouvert = 0.0, dessus = 0.0, o = uFus.x, hw = 0.0;
  if (faille) {
    float marge = 8.0 * z + uFus.y + 2.0 * uLum.y + 24.0;   // la faille s'écarte de ± 6 px (monde) de l'axe
    if (abs(P.x - 0.5 * W) < marge) {
      float limEcran = (uFLim - uCam.x) * z + 0.5 * H;
      for (int i = 0; i < ${MAX_FAILLE - 1}; i++) {
        if (i >= uFN - 1) break;
        vec2 A = vec2(0.5 * W + uFP[i].x * z, (uFP[i].y - uCam.x) * z + 0.5 * H);
        vec2 B = vec2(0.5 * W + uFP[i + 1].x * z, (uFP[i + 1].y - uCam.x) * z + 0.5 * H);
        if (A.y > limEcran || A.y - P.y > dm) break;             // segments rangés de haut en bas : plus rien de proche
        if (P.y - B.y > dm) continue;
        if (B.y > limEcran) B = mix(A, B, (limEcran - A.y) / max(B.y - A.y, 1e-3));
        dm = min(dm, segDist(P, A, B));
      }
    }
    if (o > 0.0) {
      if (P.y >= uFus.z && P.y <= uFus.w) hw = uFus.y * pow((P.y - uFus.z) / max(uFus.w - uFus.z, 1.0), 0.9);
      else if (P.y > uFus.w) hw = uFus.y * (1.0 - 0.8 * pow(clamp((P.y - uFus.w) / max(H - uFus.w, 1.0), 0.0, 1.0), 0.8));
    }
    float c = uCoeur * 0.5;
    dessus = (1.0 - smoothstep(uFus.z - 36.0, uFus.z + 6.0, P.y)) * smoothstep(0.0, 0.3, o); // au-dessus du fuseau : un filet Braise
    ouvert = max(c * (1.0 - dessus), hw);
  }
  float Ifaille = uFI * uLum.w * (1.0 - dessus);
  float dF = max(dm - ouvert, 0.0);

  // --- lumière reçue par la terre
  float Rb = uLum.y;
  // fuseau ouvert : pas de point chaud sur les lèvres (la lumière vient de la pièce)
  float chaud = mix(1.0, 0.15, smoothstep(0.05, 0.35, o));
  float Ef = faille ? Ifaille * (retombee(dF, Rb) + 0.5 * chaud * exp(-dF / 10.0)) : 0.0;
  if (faille && dessus > 0.0) Ef += 0.25 * uFiletHaut * retombee(dm, 14.0) * (1.0 - coupeFilet);
  float gF = faille ? Ifaille * clamp(1.0 - dF / Rb, 0.0, 1.0) : 0.0;
  float dC = length(P - uPiece.xy);
  float Ec = uCL.y * retombee(max(dC - uPiece.z * 0.6, 0.0), uCL.x - uPiece.z * 0.6);
  Ec += uCL.w * exp(-pow((dC - uCL.x) / (0.08 * uCL.x + 24.0), 2.0));      // crête de l'onde (scène 9)
  float gC = min(1.0, uCL.y) * clamp(1.0 - (dC - uPiece.z) / max(uCL.z - uPiece.z, 1.0), 0.0, 1.0);
  float Er = uRim * exp(-prof / 36.0);
  float E = Ef + Ec + Er;
  gC = mix(gC, gC * gC, uS10.x);                               // scène 10 : lignes d'or en (1 − d/r)²
  float g = clamp(max(gF, gC), 0.0, 1.0);                     // part d'Or bruni des filets et des hachures

  // --- la terre gravée (albédo)
  // strates : bandes Ocre / Ambre ondulées (amplitude 6 px, longueur d'onde 0,6 de la largeur), filets Outrenoir 1,5 px
  float lam = 0.6 * W;
  float o1 = 6.0 * sin(6.2832 * xw / lam + 0.7) + 2.0 * sin(xw * 0.031 + 1.9);
  float o2 = 6.0 * sin(6.2832 * xw / lam + 2.6) + 2.0 * sin(xw * 0.023 + 0.4);
  float u1 = warpG(yS + o1, uEsp.x, uEsp.y, uEsp.z, uEsp.w);
  float bande = floor(u1);
  bool ambre = mod(bande, 2.0) >= 1.0;
  float pb = fract(u1 * 0.5) * 2.0, wb = max(fwidth(u1), 1e-4);  // limite des bandes antialiasée
  float kA = smoothstep(1.0 - wb, 1.0 + wb, pb) * (1.0 - smoothstep(2.0 - wb, 2.0, pb)) + 0.5 * (1.0 - smoothstep(0.0, wb, pb));
  vec3 alb = mix(cOcre, cAmbre, kA);
  float u2 = warpG(yS + o2, uEsp.x, uEsp.y, uEsp.z, uEsp.w) + 0.5;
  float fu = fract(u2);
  float filet = 1.0 - smoothstep(0.25, 1.25, min(fu, 1.0 - fu) / max(fwidth(u2), 1e-5));
  // lignes de la gravure de la pièce (scène 9), un trait sur trois, raccordées au bord du disque
  float gL = 0.0, ligne = 0.0;
  if (s9) {
    float R9 = uPiece.z;
    gL = uS9b.w * clamp(1.0 - (dC - R9) / max(uCL.z - R9, 1.0), 0.0, 1.0);
    if (gL > 0.0) {
      float p1 = uGrav.y;
      float ond = 0.6 * sin(P.x * 0.045) * smoothstep(R9 * 1.05, R9 * 1.6, dC);
      float v = (P.y - uGrav.x - (1.0 - uS9.w) * 1.5 * p1 + ond) / (3.0 * p1);
      ligne = trait(v, 1.4) * smoothstep(0.0, 0.25, gL);
    }
  }
  float grav = (1.0 - res) * (1.0 - 0.85 * smoothstep(0.0, 0.3, gL));
  alb = mix(alb, mix(cEncre, cOrBruni, g), filet * grav);
  // hachures dans le monde, parallèles aux strates (pas 7 px au zoom 1, × uDens.z dans le bas de la coupe)
  float hp = warpG(yS + o1, uDens.x, uDens.y, 7.0, 7.0 * uDens.z);
  float hz = clamp(0.9 * sqrt(z), 0.8, 1.4);
  alb = mix(alb, cOrBruni, mix(0.2, 0.65, g) * trait(hp, hz) * grav);
  // famille croisée : dans l'Ambre et dans l'ombre seulement, à 35 % de la famille parallèle ;
  // pas (± 12 %) et angle (30° ± 5°) propres à chaque strate ; traits interrompus (30 à 90 px, coupures de 4 à 12 px, monde)
  float ombreC = (1.0 - smoothstep(0.0, 0.15, g)) * (1.0 - smoothstep(0.15, 0.5, E));
  if (ambre && ombreC > 0.0) {
    float hb = hash(vec2(bande, 3.7)), hb2 = hash(vec2(bande, 9.1));
    float sg = mod(floor(bande * 0.5), 2.0) < 1.0 ? 1.0 : -1.0;
    float an = radians(30.0 + 5.0 * (2.0 * hb2 - 1.0));
    float pc = 7.0 * (1.0 + 0.12 * (2.0 * hb - 1.0));
    float yy = yS + o1;
    float hc = warpG(yy * cos(an) + sg * xw * sin(an), uDens.x, uDens.y, pc, pc * uDens.z);
    float n = floor(hc);
    float seg = 30.0 + 60.0 * hash(vec2(n, bande)), coupe = 4.0 + 8.0 * hash(vec2(n + 7.1, bande));
    float cellule = seg + coupe;
    float ph = mod(xw * cos(an) - sg * yy * sin(an) + 97.0 * hash(vec2(n, bande + 3.3)), cellule);
    float plein = smoothstep(coupe, coupe + 1.5, ph) * (1.0 - smoothstep(cellule - 1.5, cellule, ph));
    alb = mix(alb, cOrBruni, 0.35 * 0.2 * trait(hc, hz) * plein * ombreC * grav);
  }

  // --- la fouille (scène 8) : pinceau, retrait seul, la terre qui reste tombe
  float rho = dC / max(uPiece.z, 1.0);
  bool trouFouille = false;
  float trou9 = 0.0;
  if (uFouille > 0.5) {
    float br = texture2D(uDig, vec2(Q.x / W, 1.0 - Q.y / H)).r * 4.0;
    vec2 l = locale(Q, uEnf, vec2(${ROT_X.toFixed(6)}, ${(-9 * Math.PI / 180).toFixed(6)}));
    float r = length(l);
    float au = 0.0;
    float wy = uWf * sqrt(max(0.0, 1.0 - (l.y / 1.18) * (l.y / 1.18)));
    if (wy > 0.0) au = 4.0 * clamp(1.0 - (abs(l.x) - wy - bordF(l.y)) / 0.10, 0.0, 1.0);
    float d = max(br, au);
    if (r <= 1.0 && hash(floor(l * 14.0)) < uLibre) d = 4.0;
    if (s9) {
      // scène 9 : la fouille se referme sans contour ni couches ; le trou s'efface en fondu
      // la teinte des parois ne suit plus le tracé du pinceau (bord de 14 px) : retombée radiale de R à 1,55 R
      float paroi = (1.0 - smoothstep(0.95, 1.55, rho)) * uFouilleFade;
      float portee = clamp(1.0 - (rho - 1.0) / 0.6, 0.0, 1.0);
      alb = mix(alb, mix(cAmbre, cBraise, min(1.0, uParois * portee * portee)), paroi);
      // pas de trou : la terre se referme d'un fondu continu (plus de contour autour de la pièce)
      d = 0.0;
    }
    d *= uFouilleFade;
    if (d > 0.02) {
      float pr = clamp(d / 4.0, 0.0, 1.0);
      vec3 couche = d < 1.0 ? alb : (d < 2.0 ? cAmbre : (d < 3.0 ? cOcre : cEncre));
      float portee = clamp(1.0 - (rho - 1.0) / 0.6, 0.0, 1.0); portee *= portee;
      float lum = uParois * portee;
      couche = mix(couche, cBraise, min(1.0, lum * (0.45 + 0.8 * pr)));
      if (d > 0.5 && d < 3.9) couche = mix(couche, cEncre, (1.0 - smoothstep(0.04, 0.09, abs(d - floor(d + 0.5)))) * 0.9);
      alb = couche;
      float fw = fwidth(d);
      float px = fw > 1e-5 ? (d - 0.15) / fw : -10.0;
      alb = mix(alb, cOrBruni, (smoothstep(-0.5, 0.5, px) * (1.0 - smoothstep(1.5, 2.5, px))) * clamp(0.15 + 0.35 * lum, 0.0, 0.5));
      if (d >= 3.99) trouFouille = true;
    }
  }

  // --- éclairage : la nuit, puis la lumière des sources (teinte chaude près d'elles)
  float lit = uLum.x + (1.0 - uLum.x) * min(E, 1.0) + 0.3 * max(E - 1.0, 0.0);
  col = alb * lit + cBraise * 0.06 * min(E, 1.2) * min(E, 1.2);
  // grain de matière fixé dans le monde (papier, taille-douce) : ± 4 % de luminance
  float gr = 0.62 * vnoise(vec2(xw, yw) / 1.3) + 0.38 * vnoise(vec2(xw, yw) / 5.0 + 3.1);
  col *= 1.0 + clamp((gr - 0.5) * 0.16, -0.04, 0.04);

  a = sousSurf;
  if (uNuit > 0.5) { col = mix(cAbysse, col, sousSurf); a = 1.0; }
  if (trouFouille) a = 0.0;
  a *= 1.0 - trou9;

  // strates datées (monde A) : filets Or bruni à 50 %, lisibles dans la nuit
  if (uDateesA > 0.0) {
    for (int i = 0; i < 4; i++) {
      float yd = (uDatees[i] - uCam.x) * z + 0.5 * H;
      col = mix(col, cOrBruni, 0.5 * uDateesA * (1.0 - smoothstep(0.0, 1.0, abs(P.y - yd))));
    }
  }

  // --- scène 10 : sous la surface, à la verticale de la pièce, la terre passe de l'Or bruni à l'Or pâle sur uS10.y px
  if (uS10.x > 0.0 && s9) {
    float fb = clamp(1.0 - (P.y - hautBas) / uS10.y, 0.0, 1.0);
    float fh = clamp(1.0 - abs(P.x - uS10.z) / uS10.w, 0.0, 1.0);
    col = mix(col, cOrPale, 0.35 * uS10.x * fb * fb * fh * fh);
  }

  // --- scène 9 : parois éclairées au contact de la pièce (croissant en dégradé), lignes d'or, lèvre avant
  float lip = 1e5;
  if (s9 && P.y >= hautBas) {
    float R9 = uS9b.z * 0.5;
    // lèvre avant : arc de la surface (à ± 1,4 R) jusqu'à 0,285 D sous le centre ; elle cache le quart bas de la pièce
    float lx = dx9 / (1.4 * R9);
    lip = mix(uS9.y, uS9b.y + 0.285 * uS9b.z, sqrt(max(0.0, 1.0 - lx * lx)));
    lip += (1.0 - uLevre) * 0.4 * uS9b.z;                         // la lèvre monte en place (65,8 → 66,6)
    float derriere = 1.0 - step(0.001, uLevre) * smoothstep(lip - 1.0, lip + 3.0, P.y);
    float t = (rho - 1.0) / 0.32;                                 // retombée sur 0,16 diamètre
    if (t >= 0.0 && t < 1.0 && uS9.z > 0.0) {
      vec3 cr = mix(cOrPale, cBraise, smoothstep(0.0, 0.5, t));
      cr = mix(cr, cAmbre, smoothstep(0.45, 0.95, t));
      float k = uS9.z * pow(1.0 - t, 1.6) * 0.7 * derriere * smoothstep(0.0, 6.0, P.y - hautBas) * (1.0 - uAureole);
      col = mix(col, cr * (0.55 + 0.45 * min(1.0, uCL.y)), k);
    }
    // lignes : sombres sur le métal éclairé, Or bruni sur la terre sombre (toujours visibles jusqu'au bord du disque)
    if (ligne > 0.0) {
      float lb = dot(col, LUM);
      vec3 lc = lb > 0.11 ? mix(cAmbre, cEncre, 0.35) : cOrBruni;
      col = mix(col, lc, ligne * 0.9 * (1.0 - res));
    }
    // arête de la lèvre avant, éclairée par la pièce derrière elle
    if (uLevre > 0.0) {
      float e = 1.0 - smoothstep(0.6, 1.6, abs(P.y - lip - 0.8));
      col = mix(col, mix(cOrBruni, cOrPale, 0.35), 0.8 * uLevre * e * (1.0 - smoothstep(0.75, 1.0, abs(lx))) * (1.0 - smoothstep(0.0, 0.05, uS10.x)));   // s'efface au début de la scène 10, sans bouger
    }
  }

  // auréole de la sortie (64,8 → 67,4) : retombée continue de l'Or pâle à transparent sur uLum.z px, sans contour
  if (uAureole > 0.0 && rho > 1.0) {
    float ta = clamp((dC - uPiece.z) / uLum.z, 0.0, 1.0);
    // sous la lèvre avant, la pièce est derrière la terre : l'auréole s'y éteint en fondu (pas de cercle fantôme)
    if (s9 && uLevre > 0.0) ta = max(ta, smoothstep(lip - 4.0, lip + 20.0, P.y));
    col = mix(col, cOrPale, 0.3 * uAureole * (1.0 - ta) * (1.0 - ta * ta * ta));   // pente presque constante, fin sans marche
  }

  // --- la cavité de la pièce (scènes 4 à 6) : Outrenoir, bord fondu sur uCavF px ; la faille y entre (dessinée après)
  if (uCav.z > 0.0) {
    vec2 e = (P - uPiece.xy) / (uPiece.z * uCav.xy);
    float f = uCavF / (uPiece.z * min(uCav.x, uCav.y));
    float dans = (1.0 - smoothstep(1.0 - f, 1.0, length(e))) * uCav.z;
    col = mix(col, cEncre, dans); a = mix(a, 1.0, dans);
  }

  // --- la faille : cœur Incandescence, retombée continue sans bord ; le fuseau laisse voir la pièce
  if (faille && dm < 1e4) {
    float Fw = uLum.z;
    float t = dF / Fw;
    float Ih = (o > 0.0) ? uFI * uLum.w * (1.0 - dessus) * mix(1.0, 0.7, smoothstep(0.0, 0.5, o)) : Ifaille;
    float sombre = smoothstep(0.05, 0.35, o);
    // fuseau : plus de néon sur le contour ; la retombée part de Braise, plus faible, et le bord s'ouvre
    // sur toute sa demi-largeur vers un intérieur en dégradé (Braise à 35 % aux lèvres → transparent au centre), éclairé par la croix
    float tH = mix(t, 0.3 + 0.7 * t, sombre);
    col = mix(col, rampe(tH), haloA(tH) * min(1.0, Ih) * mix(1.0, 0.3, sombre) * mix(0.3, 1.0, sousSurf));
    float coeurNet = 1.0 - smoothstep(ouvert - 0.6, ouvert + 0.6, dm);
    // fuseau : ouverture en dégradé sur toute la demi-largeur, prolongé de 14 px dans la terre (lèvres sans marche)
    float lf = ouvert + 14.0;
    float coeur = (o > 0.0) ? mix(coeurNet, 1.0 - smoothstep(0.0, lf, dm), sombre) : coeurNet;
    float interieur = coeur * (o > 0.0 ? 1.0 : min(1.0, Ih)) * (1.0 - dessus);
    if (o > 0.0) {
      // paroi : la terre elle-même, teintée de Braise à 35 % (jamais plus claire qu'elle), opaque aux lèvres → transparente au centre
      float u = clamp(dm / lf, 0.0, 1.0);
      float kb = smoothstep(0.0, 1.0, u);
      vec3 braL = cBraise * min(1.0, dot(col, LUM) / max(dot(cBraise, LUM), 1e-4));
      vec3 Cw = mix(col, braL, 0.35);
      float kc = 0.25 * min(1.0, uCL.y) * (1.0 - smoothstep(0.0, uPiece.z, dC));
      float A = 1.0 - (1.0 - kb) * (1.0 - kc);
      vec3 C = (Cw * kb * (1.0 - kc) + cOrPale * kc) / max(A, 1e-4);
      col = mix(col, mix(cIncand, C, sombre), interieur);
      a = mix(a, mix(a, A, sombre), interieur);
    } else {
      col = mix(col, cIncand, interieur);
    }
    // filet Braise au-dessus (sous la phrase), 1 px à 80 %, interrompu dans la réserve du texte
    if (dessus > 0.0) {
      float f = uFiletHaut * dessus * (1.0 - coupeFilet) * step(0.07 * H, P.y);
      col = mix(col, cBraise, 0.8 * f * (1.0 - smoothstep(0.0, 1.0, dm)));
      col = mix(col, cBraise, 0.18 * f * exp(-dm / 3.0));
    }
  }

  // --- l'empreinte du revers (scène 10) : le disque en creux, et dans ce creux la trace du lys, comme un sceau dans la cire.
  // Lumière rasante venue de la pièce, en haut : la paroi basse (qui la regarde) prend l'Or pâle (28 % au plus bas, 0 à ± 70°),
  // la paroi haute est dans l'ombre (Outrenoir uEmpG.w) ; fond Ambre profond, 20 % d'Or bruni au centre ; bord fondu sur uEmpL.y px.
  // le lys n'est plus un objet d'or. Il est fait de la matière de la terre :
  //   - sa carte est lissée de 0,025 D (empreinte-lys.webp) : ni pointes ni traverse, la silhouette seule ;
  //   - la gravure de la terre (filets et hachures) entre dans le creux à 50 % de son contraste, décalée vers le bas par la
  //     profondeur : les lignes plongent dans le creux et remontent sur le lys (uEmpG.z px du monde au plus profond) ;
  //   - le lys se lit par l'ombre : pentes basses assombries de 30 %, pentes hautes au plus 1,45 fois le fond, teintées d'Or pâle à 25 %
  //     au plus ; jamais plus clair que la paroi basse, qui reste la zone la plus claire de la terre.
  // uEmpG.x (relief du lys) et uEmpL.x (lumière rasante) vont à 0 de 83,6 à 84,4 : le creux est vide avant que la
  // couverture ne bouge.
  if (uEmp.w > 0.0) {
    float Re = 0.5 * uEmp.z;
    vec2 q = (P - uEmp.xy) / Re;
    float r = length(q);
    float dB = (r - 1.0) * Re;
    float dans = 1.0 - smoothstep(-uEmpL.y, uEmpL.y, dB);
    float k = uEmpL.x;
    // la trace du lys (hors de la branche « dans » : les dérivées des traits restent définies)
    float h0 = 0.0, pente = 0.0;
    if (uEmpL.z > 0.5) {
      vec2 uvL = 0.5 + vec2(q.x, -q.y) * (0.5 * 1040.0 / 1080.0);
      float de = 0.03 * (1040.0 / 1080.0);                     // pentes lues sur 0,03 D : une ombre large, sans détail
      float hN = texture2D(uLys, uvL + vec2(0.0, de)).g, hS = texture2D(uLys, uvL - vec2(0.0, de)).g;
      float bordL = 1.0 - smoothstep(0.86, 0.97, r);
      h0 = texture2D(uLys, uvL).g * bordL * uEmpG.x;
      pente = (hS - hN) * bordL * uEmpG.x;                       // > 0 : pente haute, tournée vers la lumière
    }
    float profE = dans * (1.0 - 0.85 * h0);                      // profondeur relative : 1 au fond du creux, ≈ 0 sur la surface
    float yd = yS - uEmpG.z * profE * profE;                             // la gravure plonge dans le creux
    float hpE = warpG(yd + o1, uDens.x, uDens.y, 7.0, 7.0 * uDens.z);
    float u2E = warpG(yd + o2, uEsp.x, uEsp.y, uEsp.z, uEsp.w) + 0.5;
    float fuE = fract(u2E);
    float filE = 1.0 - smoothstep(0.25, 1.25, min(fuE, 1.0 - fuE) / max(fwidth(u2E), 1e-5));
    float trE = trait(hpE, hz);
    if (dans > 0.0) {
      float c = q.y / max(r, 1e-4);
      float Lin = uLum.x + (1.0 - uLum.x) * (0.1 + 0.15 * k);
      vec3 e = mix(cAmbre, cOrBruni, 0.2 * k * (1.0 - r * r)) * Lin;
      if (uEmpG.y > 0.0) {
        // la gravure au contraste extérieur (couleur de la ligne moins l'albédo, sous la lumière du lieu), × uEmpG.y
        float aH = mix(0.2, 0.65, g) * (1.0 - res);
        e += uEmpG.y * (cOrBruni - cAmbre) * aH * trE * lit;
        e += uEmpG.y * (mix(cEncre, cOrBruni, g) - cAmbre) * filE * (1.0 - res) * lit;
        e = max(e, cAmbre * Lin * 0.35);
        // le lys, lu par l'ombre
        float sH = smoothstep(0.03, 0.4, pente), sB = smoothstep(0.03, 0.4, -pente);
        e *= 1.0 + 0.45 * k * sH;
        e = mix(e, cOrPale * dot(e, LUM) / dot(cOrPale, LUM), 0.25 * k * sH);
        e *= 1.0 - 0.30 * sB * min(1.0, uEmpG.x + k);
      }
      // la paroi : sa lumière culmine à 0,8 × le bord fondu à l'intérieur, monte et retombe sans marche
      // (écart : Or pâle à 28 % au plus bas, pas 60 % : à 60 %, la mesure à 14 px et le critère des 0,04 sur 2 px ne tiennent pas)
      // la lumière de la paroi basse garde son profil (uEmpB) ; le bord et l'ombre de la paroi haute s'élargissent (uEmpL.y)
      float dP = -dB - 0.8 * uEmpB;
      float paroi = dP < 0.0 ? exp(-dP * dP / (1.28 * uEmpB * uEmpB)) : exp(-dP / (1.2 * uEmpB));
      float dH = -dB - 0.8 * uEmpL.y;
      float paroiH = dH < 0.0 ? exp(-dH * dH / (1.28 * uEmpL.y * uEmpL.y)) : exp(-dH / (1.2 * uEmpL.y));
      float bas = pow(smoothstep(0.342, 1.0, c), 2.5);
      float haut = 1.0 - smoothstep(-0.9, -0.2, c);
      e = mix(e, cOrPale, 0.28 * k * bas * paroi);
      e = mix(e, cEncre, uEmpG.w * haut * paroiH);
      col = mix(col, e, dans * uEmp.w);
    }
  }

  // --- la pièce : voile (pièce éteinte), trou quand elle est libre
  float rp = rho;
  float disque = 1.0 - smoothstep(0.985, 1.015, rp);
  if (disque > 0.0) {
    float ouvertD = max(1.0 - a, uCav.z * disque);
    col = mix(col, cEncre, ouvertD * disque);
    a = mix(a, uCav.w, ouvertD * disque);
    // la lumière de la faille entre dans la cavité : Or pâle à 30 % sur le quart haut du disque, puis 0
    if (uCav.z > 0.0 && uFI > 0.0 && uFus.x <= 0.0) {
      float hq = 0.3 * min(1.0, uFI * uLum.w) * (1.0 - smoothstep(-1.0, -0.5, (P.y - uPiece.y) / uPiece.z)) * disque;
      float A = 1.0 - (1.0 - a) * (1.0 - hq);
      col = (col * a * (1.0 - hq) + cOrPale * hq) / max(A, 1e-4); a = A;
    }
    if (uTrou > 0.5) {
      // la lèvre avant passe devant le quart bas de la pièce (fondu en grain : la terre se pose)
      float devant = 0.0;
      if (s9 && uLevre > 0.0) devant = smoothstep(lip - 0.6, lip + 0.6, P.y);
      a *= 1.0 - disque * (1.0 - devant);
    }
  }

  // sillon de la chute (scène 4) : Outrenoir à 50 %, 2 px, pointillés 6 / 4, de la surface au haut de la pièce
  if (uSillon > 0.0) {
    float sTop = (uSurf.x - uCam.x) * z + 0.5 * H, sBas = uPiece.y - uPiece.z * 1.3;
    float m = mod(P.y - sTop, 10.0);
    float tiret = smoothstep(0.0, 1.0, m) * (1.0 - smoothstep(5.0, 6.0, m)) * step(sTop + 2.0, P.y) * (1.0 - smoothstep(sBas - 8.0, sBas, P.y));
    col = mix(col, cEncre, 0.5 * uSillon * tiret * (1.0 - smoothstep(0.4, 1.3, abs(P.x - 0.5 * W))));   // plus discret
  }

  // indice (scène 8, sans geste à 59,0) : un point Or pâle de 8 px qui va et vient sur 40 px
  if (uIndice.z > 0.0) {
    if (abs(P.y - uIndice.y) < 0.5 && abs(P.x - 0.5 * W) < 20.0) col = mix(col, cCendre, 0.5);
    col = mix(col, cOrPale, 1.0 - smoothstep(3.5, 4.5, length(P - uIndice.xy)));
  }
  // anneau du pinceau (souris au survol)
  if (uAnneau.w > 0.5) col = mix(col, cOrPale, 1.0 - smoothstep(0.5, 1.2, abs(length(P - uAnneau.xy) - uAnneau.z)));

  // tramage très faible (évite les marches dans les dégradés sombres)
  col += (hash(gl_FragCoord.xy * 0.73) - 0.5) * 0.0015;
  a = max(a, ombre);
  if (ombre > 0.0 && a <= ombre + 1e-3) col = cEncre;
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}`;

export class Terre {
  constructor() {
    const c = (h) => new THREE.Color(h);
    const pts = []; for (let i = 0; i < MAX_FAILLE; i++) pts.push(new THREE.Vector2());
    const resv = []; for (let i = 0; i < MAX_RESERVES; i++) resv.push(new THREE.Vector4(-1, -1, -1, -1));
    this.uniforms = {
      uRes: { value: new THREE.Vector2(1, 1) }, uMonde: { value: 0 }, uCam: { value: new THREE.Vector2(0, 1) },
      uSurf: { value: new THREE.Vector3(1e6, 0, 100) }, uEsp: { value: new THREE.Vector4(0, 1, 32, 32) },
      uDens: { value: new THREE.Vector3(0, 1, 1) }, uNuit: { value: 0 },
      uPiece: { value: new THREE.Vector4() }, uCav: { value: new THREE.Vector4() },
      uSillon: { value: 0 }, uDatees: { value: new THREE.Vector4() }, uDateesA: { value: 0 },
      uFP: { value: pts }, uFN: { value: 0 }, uFLim: { value: -1e6 }, uCoeur: { value: 2 }, uFI: { value: 0 },
      uFus: { value: new THREE.Vector4() }, uFiletHaut: { value: 0 },
      uDig: { value: null }, uFouille: { value: 0 }, uWf: { value: 0 }, uLibre: { value: 0 }, uFouilleFade: { value: 1 },
      uEnf: { value: new THREE.Vector4(0, 0, 1, 0) },
      uS9: { value: new THREE.Vector4() }, uS9b: { value: new THREE.Vector4() }, uLevre: { value: 0 },
      uGrav: { value: new THREE.Vector2(0, 4) },
      uResv: { value: resv }, uResA: { value: new Array(MAX_RESERVES).fill(0) }, uResE: { value: new Array(MAX_RESERVES).fill(0) }, uFondu: { value: 24 },
      uCavF: { value: 10 }, uAureole: { value: 0 },
      uIndice: { value: new THREE.Vector3() }, uAnneau: { value: new THREE.Vector4() },
      uParois: { value: 0 }, uOmbre: { value: 0 }, uTrou: { value: 0 },
      uLum: { value: new THREE.Vector4(0.26, 64, 24, 1) }, uCL: { value: new THREE.Vector4(1, 0, 1, 0) }, uRim: { value: 0 },
      uCamX: { value: 0 }, uEmp: { value: new THREE.Vector4() }, uEmpL: { value: new THREE.Vector4(0, 10, 0, 4) }, uLys: { value: null },
      uEmpG: { value: new THREE.Vector4(1, 0.5, 0, 0.40) }, uEmpB: { value: 10 },
      uS10: { value: new THREE.Vector4(0, 24, 0, 1) }, uReflet: { value: new THREE.Vector4() },
      cEncre: { value: c(COULEURS.encre) }, cAbysse: { value: c(COULEURS.abysse) }, cOcre: { value: c(COULEURS.ocre) },
      cAmbre: { value: c(COULEURS.ambre) }, cBraise: { value: c(COULEURS.braise) }, cOrBruni: { value: c(COULEURS.orBruni) },
      cOrPale: { value: c(COULEURS.orPale) }, cIncand: { value: c(COULEURS.incandescence) }, cCendre: { value: c(COULEURS.cendre) },
    };
    this.material = new THREE.ShaderMaterial({
      vertexShader: vert, fragmentShader: frag, uniforms: this.uniforms,
      transparent: true, depthTest: false, depthWrite: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    this.faille = [];
  }

  // Taille de l'écran ; la faille du monde B est tirée une fois : ligne brisée (segments de 18 à 40 px, écart ± 6 px),
  // de la surface (0,40 h) jusqu'au bas du monde, sur l'axe de l'ancienne porte.
  taille(W, H) {
    this.mesh.scale.set(W, H, 1); this.mesh.position.set(W / 2, H / 2, 0);
    this.uniforms.uRes.value.set(W, H);
    let graine = 11;
    const alea = () => { graine = (graine * 16807) % 2147483647; return graine / 2147483647; };
    const pts = this.uniforms.uFP.value;
    let y = 0.40 * H - 6, i = 0;
    this.faille.length = 0;
    while (i < MAX_FAILLE && y < 1.7 * H) {
      const x = i === 0 ? 0 : (alea() * 2 - 1) * 6;
      pts[i].set(x, y); this.faille.push(x, y);
      i++; y += 18 + alea() * 22;
    }
    this.uniforms.uFN.value = i;
  }

  // x du monde de la faille à l'ordonnée yw du monde (pour la mesure de la fouille)
  failleX(yw) {
    const f = this.faille;
    for (let i = 0; i + 3 < f.length; i += 2) {
      if (yw <= f[i + 3]) { const t = Math.min(1, Math.max(0, (yw - f[i + 1]) / (f[i + 3] - f[i + 1]))); return f[i] + (f[i + 2] - f[i]) * t; }
    }
    return 0;
  }

  dispose() { this.material.dispose(); this.mesh.geometry.dispose(); }
}
