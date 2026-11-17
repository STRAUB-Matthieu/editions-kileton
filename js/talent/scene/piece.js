// La pièce : disque d'or frappé (avers), tranche cannelée, relief tiré de la carte de hauteur,
// croix émissive, arête haut-gauche du listel qui reçoit le jour, lumière ponctuelle posée sur la pièce.
import * as THREE from '../../vendor/three.module.min.js';
import { COULEURS } from './recette.js';

const EPAISSEUR = 0.12;          // en rayons (6 % du diamètre)
const ECHELLE_UV = 1040 / 1080;  // le disque occupe 1040 px sur 1080 dans la carte
const HAUTEUR = 0.024;           // 1,2 % du diamètre, en rayons
// Plafond de sortie : aucune composante au-delà de l'Incandescence #FFF3D6, avant le bloom.
// cIncand est en linéaire ; la conversion vers le sRGB est croissante par composante, le plafond vaut donc en sRGB.
// Tour 2 : hors de la croix, la luminance est plafonnée à 0,8 (seule la croix passe le seuil 0,85 du bloom) ;
// uEclair règle l'éclairage de toute la pièce hors de la croix (0,45 pendant le souffle retenu).
// Tour 3 : après la rupture de 11,0, uBraise fait de la croix une braise Or bruni (luminance ≤ 0,25).
const plafond = (croix, croixTout = '0.0') => `gl_FragColor.rgb = min(gl_FragColor.rgb, cIncand);
{ float lpx = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  gl_FragColor.rgb *= mix(min(1.0, 0.8 / max(lpx, 1e-4)) * uEclair, 1.0, ${croix});
  gl_FragColor.rgb = mix(gl_FragColor.rgb, min(gl_FragColor.rgb, cOrBruniL * 0.95), uBraise * ${croixTout}); }
#include <tonemapping_fragment>`;

// à la frappe I, la croix éclaire la face qui l'entoure. Dans un anneau de 0,12 à 0,40 D autour du centre, la face
// monte en luminance (× 1 + uAnneau · w, w = (1 − t)², t de 0 à 0,12 D à 1 à 0,40 D) et passe vers l'Or pâle ; la croix prend
// l'Incandescence pleine (uPleine). Rien n'est ajouté hors de la frappe (uAnneau = 0 : la branche n'est pas prise).
const ANNEAU = `if (uAnneau > 0.0) {
  float dA = length(vNormalMapUv - 0.5) / ${(1040 / 1080).toFixed(6)};
  float tA = clamp((dA - 0.12) / 0.28, 0.0, 1.0);
  float wA = (1.0 - tA) * (1.0 - tA);
  vec3 cA = gl_FragColor.rgb * (1.0 + uAnneau * wA);
  float lA = dot(cA, vec3(0.2126, 0.7152, 0.0722));
  cA = mix(cA, cOrPale * lA / dot(cOrPale, vec3(0.2126, 0.7152, 0.0722)), min(1.0, 0.5 * uAnneau * wA));
  gl_FragColor.rgb = min(mix(cA, cIncand, croix * uPleine), cIncand);
}
`;

export class Piece {
  constructor(texHauteur, texNormale, segments, texCouleur, anisotropie = 8) {
    this.groupe = new THREE.Group();
    this.groupe.rotation.order = 'ZYX'; // d'abord l'inclinaison X, puis la rotation dans le plan de l'écran

    // mipmaps (filtre trilinéaire) et anisotropie 8 : la gravure ne doit pas faire de moiré à 152 px
    for (const t of [texHauteur, texNormale, texCouleur]) {
      t.repeat.set(ECHELLE_UV, ECHELLE_UV);
      t.offset.set((1 - ECHELLE_UV) / 2, (1 - ECHELLE_UV) / 2);
      t.generateMipmaps = true;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.anisotropy = anisotropie;
    }
    texCouleur.colorSpace = THREE.SRGBColorSpace; // carte de couleur de l'avers (strates Ambre profond sur Or)
    texNormale.colorSpace = THREE.NoColorSpace;
    texHauteur.colorSpace = THREE.NoColorSpace;

    this.u = {
      uHauteur: { value: texHauteur }, uCroix: { value: 0.15 }, uArete: { value: 0 }, uChamp: { value: 0.05 },
      cAmbre: { value: new THREE.Color(COULEURS.ambre) }, cIncand: { value: new THREE.Color(COULEURS.incandescence) },
      cOrPale: { value: new THREE.Color(COULEURS.orPale) }, cOr: { value: new THREE.Color(COULEURS.or) },
      cBraise: { value: new THREE.Color(COULEURS.braise) }, uJour: { value: 0 }, uEclair: { value: 1 }, uBraise: { value: 0 },
      cOrBruniL: { value: new THREE.Color(COULEURS.orBruni) },
      // éclat du listel (angle, intensité, moitié haute), flancs éclairés par les portes, balayage du revers (x, reste)
      uListel: { value: new THREE.Vector3() }, uFlancs: { value: 0 }, cPerle: { value: new THREE.Color(COULEURS.perle) },
      uBalai: { value: new THREE.Vector2(-1, 0) }, uHauteurR: { value: null },
      // frappe I, la croix éclaire la face qui l'entoure (gain de l'anneau) et prend l'Incandescence pleine
      uAnneau: { value: 0 }, uPleine: { value: 0 },
    };
    const u = this.u;

    // Face (avers)
    // « transparent » (opacité 1) : la pièce est triée avec la terre par renderOrder (dessous, puis dessus une fois libre)
    this.matFace = new THREE.MeshPhysicalMaterial({
      transparent: true,
      color: 0xffffff, map: texCouleur, metalness: 1, roughness: 0.35, toneMapped: true,
      normalMap: texNormale, normalScale: new THREE.Vector2(1, 1),
      displacementMap: texHauteur, displacementScale: HAUTEUR * 255 / 112, displacementBias: -HAUTEUR * 128 / 112,
      envMapIntensity: 0,
    });
    this.matFace.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
uniform sampler2D uHauteur; uniform float uCroix, uArete, uChamp;
uniform vec3 cAmbre, cIncand, cOrPale, cOr, cBraise, cOrBruniL, cPerle; uniform float uJour, uEclair, uBraise;
uniform vec3 uListel; uniform float uFlancs; uniform float uAnneau, uPleine;`)
        .replace('#include <map_fragment>', `#include <map_fragment>
float hh = texture2D(uHauteur, vNormalMapUv).r;
vec3 couleurAvers = diffuseColor.rgb; // la gravure du champ est dans la carte de couleur (relief 0)`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.2, smoothstep(0.55, 0.7, hh)); // relief et listel polis`)
        .replace('#include <emissivemap_fragment>', `
vec2 cuv = vNormalMapUv - 0.5;
float rr = length(cuv);
float croix = smoothstep(0.915, 0.935, hh);
// cœur de la croix (à 0,01 du bord du relief) : seul il garde l'Incandescence pleine et passe le seuil du bloom ;
// le liseré du relief est plafonné à 0,8 (biseau de lumière, et une lueur qui retombe vite)
float coeurCroix = croix;
for (int k = 0; k < 4; k++) {
  vec2 o = 0.010 * vec2(k == 0 ? 1.0 : (k == 1 ? -1.0 : 0.0), k == 2 ? 1.0 : (k == 3 ? -1.0 : 0.0));
  coeurCroix = min(coeurCroix, smoothstep(0.915, 0.935, texture2D(uHauteur, vNormalMapUv + o).r));
}
float listel = smoothstep(0.442, 0.450, rr) * (1.0 - smoothstep(0.466, 0.474, rr));
float hg = pow(clamp(dot(cuv / max(rr, 1e-4), vec2(-0.7071, 0.7071)), 0.0, 1.0), 2.0);
// croix : Incandescence #FFF3D6, intensité ≤ 1 (atteinte à 34 %), jamais de blanc pur
totalEmissiveRadiance = mix(cIncand, cOrBruniL, uBraise) * croix * min(1.0, uCroix * 1.25)
  + mix(cOrPale, cIncand, uArete) * listel * hg * uArete * 0.9
  + couleurAvers * mix(vec3(1.0), cBraise / cOr, 0.4 * (1.0 - uJour)) * uChamp * (1.0 - croix);
// frappe II : un éclat Incandescence (arc de 40°, bouts fondus sur 15°) fait le tour du listel ; puis la moitié haute à 40 %
float dAng = abs(mod(atan(cuv.y, cuv.x) - uListel.x + 3.14159265, 6.2831853) - 3.14159265);
totalEmissiveRadiance += cIncand * 0.9 * uListel.y * listel * (1.0 - smoothstep(0.0873, 0.349, dAng))
  + cOrPale * 0.4 * uListel.z * listel * smoothstep(-0.06, 0.06, cuv.y);
// scène 11 : chaque ouverture éclaire le flanc de la pièce qui la regarde (Perle) ; le sommet reste dans la nuit
totalEmissiveRadiance += cPerle * uFlancs * smoothstep(0.12, 0.42, abs(cuv.x)) * smoothstep(0.26, 0.44, rr) * (1.0 - 0.6 * smoothstep(0.1, 0.45, cuv.y));`)
        .replace('#include <tonemapping_fragment>', plafond('coeurCroix', 'croix').replace('#include <tonemapping_fragment>', ANNEAU + '#include <tonemapping_fragment>'));
    };
    const face = new THREE.Mesh(new THREE.RingGeometry(0.0001, 1, segments, segments / 2), this.matFace);
    face.position.z = EPAISSEUR / 2;

    // Tranche cannelée
    this.matTranche = new THREE.MeshStandardMaterial({ transparent: true, color: COULEURS.orBruni, metalness: 1, roughness: 0.3, envMapIntensity: 0, emissive: COULEURS.orBruni, emissiveIntensity: 0 });
    const tg = new THREE.CylinderGeometry(1, 1, EPAISSEUR, segments * 2, 1, true);
    tg.rotateX(Math.PI / 2);
    const pos = tg.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      const a = Math.atan2(y, x);
      const k = 1 - 0.008 * (0.5 + 0.5 * Math.cos(a * segments)); // cannelures
      pos.setXY(i, x * k, y * k);
    }
    tg.computeVertexNormals();
    this.matTranche.onBeforeCompile = (sh) => {
      sh.uniforms.cIncand = u.cIncand; sh.uniforms.uEclair = u.uEclair; sh.uniforms.uBraise = u.uBraise; sh.uniforms.cOrBruniL = u.cOrBruniL;
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 cIncand, cOrBruniL; uniform float uEclair, uBraise;')
        .replace('#include <tonemapping_fragment>', plafond('0.0'));
    };
    const tranche = new THREE.Mesh(tg, this.matTranche);

    // Revers : simple disque tant que ses textures ne sont pas chargées (revers()), puis la face gravée du revers
    const dos = new THREE.Mesh(new THREE.RingGeometry(0.0001, 1, segments, 2), this.matTranche);
    dos.rotation.y = Math.PI; dos.position.z = -EPAISSEUR / 2;
    this.dos = dos; this.segments = segments; this.anisotropie = anisotropie;

    // Lumière ponctuelle de la fouille : sous le plan du champ (z = −0,05 × diamètre), elle ne touche pas la pièce
    //. La terre a son propre éclairage dans son shader.
    this.lumiere = new THREE.PointLight(COULEURS.incandescence, 0, 0, 2);
    this.lumiere.position.set(0, 0, EPAISSEUR / 2 - 0.05 * 2);

    this.groupe.add(face, tranche, dos, this.lumiere);
    for (const m of [face, tranche, dos]) m.renderOrder = 1;
    this.meshes = [face, tranche, dos];
  }

  // Face du revers : le lys en creux, la légende, le listel ; la lumière rasante de la frappe III balaie ses parois.
  revers(texH, texN, texC) {
    for (const t of [texH, texN, texC]) {
      t.repeat.set(ECHELLE_UV, ECHELLE_UV); t.offset.set((1 - ECHELLE_UV) / 2, (1 - ECHELLE_UV) / 2);
      t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = this.anisotropie;
    }
    texC.colorSpace = THREE.SRGBColorSpace; texN.colorSpace = THREE.NoColorSpace; texH.colorSpace = THREE.NoColorSpace;
    const u = this.u;
    u.uHauteurR.value = texH;
    this.matRevers = new THREE.MeshPhysicalMaterial({ transparent: true, color: 0xffffff, map: texC, metalness: 1, roughness: 0.35,
      normalMap: texN, normalScale: new THREE.Vector2(1, 1), envMapIntensity: 0 });
    this.matRevers.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
uniform sampler2D uHauteurR; uniform vec2 uBalai; uniform vec3 cIncand, cOrPale, cOrBruniL, cAmbre; uniform float uEclair, uBraise;`)
        .replace('#include <emissivemap_fragment>', `
// parois du lys en creux : là où le relief change vite, dans la zone du lys (canal vert)
vec2 tr = vNormalMapUv; float e = 0.006;
float gx = texture2D(uHauteurR, tr + vec2(e, 0.0)).r - texture2D(uHauteurR, tr - vec2(e, 0.0)).r;
float gy = texture2D(uHauteurR, tr + vec2(0.0, e)).r - texture2D(uHauteurR, tr - vec2(0.0, e)).r;
vec4 hR = texture2D(uHauteurR, tr);
float zoneLys = smoothstep(0.15, 0.5, hR.g);
float parois = smoothstep(0.04, 0.16, length(vec2(gx, gy))) * zoneLys;
float bande = exp(-pow((tr.x - uBalai.x) / 0.07, 2.0));
float passe = 1.0 - smoothstep(uBalai.x - 0.05, uBalai.x + 0.05, tr.x);
// le balayage de la frappe III passe sur toutes les parois
totalEmissiveRadiance = cOrPale * parois * 0.7 * bande;
// après lui, seules restent claires les parois qui regardent la lumière (venue d'en haut à gauche) : dans un creux,
// ce sont celles où le relief remonte vers le bas à droite. Bande étroite (2 / 3 / 4 px à 150 / 220 / 300 px).
float e2 = 0.004;
float dx2 = texture2D(uHauteurR, tr + vec2(e2, 0.0)).r - texture2D(uHauteurR, tr - vec2(e2, 0.0)).r;
float dy2 = texture2D(uHauteurR, tr + vec2(0.0, e2)).r - texture2D(uHauteurR, tr - vec2(0.0, e2)).r;
float eclairee = smoothstep(0.02, 0.09, 0.7071 * (dx2 - dy2)) * zoneLys;
// le fond du lys en creux : dégradé de l'Ambre profond (en haut à gauche, à l'ombre de la paroi) à l'Or bruni (en bas à droite)
float fondLys = (1.0 - smoothstep(0.20, 0.27, hR.r)) * smoothstep(0.75, 0.95, hR.g);
float sL = clamp(0.5 + ((tr.x - 0.5) - (tr.y - 0.5356)) / 0.58, 0.0, 1.0);
vec3 cFond = mix(cAmbre, cOrBruniL, smoothstep(0.0, 1.0, sL));`)
        .replace('#include <tonemapping_fragment>', `gl_FragColor.rgb = mix(gl_FragColor.rgb, cFond, fondLys);
gl_FragColor.rgb = mix(gl_FragColor.rgb, cOrPale, 0.45 * eclairee * passe * clamp(uBalai.y / 0.45, 0.0, 1.0));
` + plafond('0.0'));
    };
    this.dos.geometry.dispose();
    this.dos.geometry = new THREE.RingGeometry(0.0001, 1, this.segments, this.segments / 2);
    this.dos.material = this.matRevers;
  }

  // Pose et lumières. x, y en px depuis le haut ; H hauteur de l'écran ; r rayon px ; rotY : la face tourne (scène 12).
  poser(x, y, r, H, rotX, rotZ, rotY = 0) {
    this.groupe.position.set(x, H - y, 0);
    this.groupe.scale.setScalar(r);
    this.groupe.rotation.set(rotX, rotY, rotZ);
  }

  // éclat du listel, flancs, balayage du revers
  frappe(listel, flancs, balai, anneau = 0, pleine = 0) {
    this.u.uAnneau.value = anneau; this.u.uPleine.value = pleine;
    this.u.uListel.value.set(listel[0], listel[1], listel[2]);
    this.u.uFlancs.value = flancs;
    this.u.uBalai.value.set(balai[0], balai[1]);
  }

  eclairer(croix, arete, jour, parois, r) {
    this.u.uCroix.value = croix;
    this.u.uArete.value = arete;
    this.u.uJour.value = jour;
    this.u.uChamp.value = (0.08 + 0.14 * croix) * (1 - jour);
    this.matFace.envMapIntensity = jour;
    this.matTranche.envMapIntensity = jour;
    if (this.matRevers) this.matRevers.envMapIntensity = jour;
    this.matTranche.emissiveIntensity = 0.05 * croix * (1 - jour);
    // la lumière née de la croix éclaire le champ de près (intensité en candela, distances en px)
    this.lumiere.intensity = (0.25 + 0.75 * Math.max(croix, parois)) * r * r * 0.7 * (1 - 0.7 * jour);
  }

  eclat(k, braise = 0) { this.u.uEclair.value = k; this.u.uBraise.value = braise; }

  ordre(n) { for (const m of this.meshes) m.renderOrder = n; }

  dispose() {
    for (const m of this.meshes) m.geometry.dispose();
    this.matFace.dispose(); this.matTranche.dispose();
    if (this.matRevers) { this.matRevers.dispose(); this.matRevers.map.dispose(); this.matRevers.normalMap.dispose(); this.u.uHauteurR.value.dispose(); }
    this.u.uHauteur.value.dispose(); this.matFace.normalMap.dispose(); this.matFace.map.dispose();
  }
}
