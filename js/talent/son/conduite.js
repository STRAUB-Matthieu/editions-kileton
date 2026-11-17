// Conduite sonore des scènes 0 à 9. Une fonction du temps T de l'horloge .
// Tout est fabriqué en Web Audio (sons.js), aucun fichier, aucune bibliothèque. Aucun AudioContext avant demarrer().
import * as S from './sons.js';

// =====================================================================================
// LA TABLE , en données. T en secondes. La tranche s'arrête à T = 74,0 :
// la nappe y reste à son niveau ; l'accord de 74 à 84 et le fondu final ne sont pas programmés.
// =====================================================================================
export const TABLE = {
  // Silences totaux : le gain maître vaut 0 exactement de `debut` à `fin`. Fondu en cosinus de `fond` à `debut`
  // (0,30 s) ; reprise en 0,01 s à `fin`. NB : silence 1, fondu décalé de 0,05 s par rapport à la recette
  // (11,10 -> 11,40 au lieu de 11,05 -> 11,35) pour que les échantillons nuls commencent à 11,40.
  silences: [
    { id: 1, fond: 11.10, debut: 11.40, fin: 14.40 },
    { id: 2, fond: 43.70, debut: 44.00, fin: 46.50 },
    { id: 3, fond: 62.70, debut: 63.00, fin: 64.80 },
    { id: 4, fond: 89.60, debut: 89.90, fin: 92.00 }     // la fin de l'horloge ; le silence continue au-delà de 92,0 jusqu'au premier son de la partie libre
  ],
  reprise: 0.01,
  // Sons ponctuels : jouent quand T franchit `t` en avançant, d'un pas de moins de `pasMax`.
  pasMax: 0.5,
  ponctuels: [
    { id: 'tintement-don',        t: 7.0,  son: 'tintement', f0: 1180, vel: 0.8, reverb: 0.30 },
    { id: 'coup-porte',           t: 11.0, son: 'coup',      vel: 1.0,  reverb: 0 },
    { id: 'coup-fond-1',          t: 31.0, son: 'coup',      vel: 0.7,  reverb: 0.35 },
    { id: 'coup-fond-2',          t: 33.5, son: 'coup',      vel: 0.7,  reverb: 0.35 },
    { id: 'coup-fond-3',          t: 36.0, son: 'coup',      vel: 0.7,  reverb: 0.35 },
    { id: 'tintement-revelation', t: 64.8, son: 'tintement', f0: 1180, vel: 1.0, reverb: 0.40, rattrapage: [64.8, 66.0] },
    // scènes 10 à 13
    { id: 'coup-empreinte',       t: 76.0, son: 'coup',      vel: 0.35, reverb: 0.50 },
    { id: 'tintement-livre',      t: 78.6, son: 'tintement', f0: 587,  vel: 0.5, reverb: 0.40 },
    { id: 'tintement-pose',       t: 87.0, son: 'tintement', f0: 1180, vel: 0.8, reverb: 0.40 }
  ],
  // Les neuf crans de la scène 3 en mode automatique : chacun jette une pelletée (+0,1 de q3), puis 0,25 écran linéaire de 28 à 29.
  crans: [16.6, 17.9, 19.1, 20.4, 21.8, 23.1, 24.5, 26.0, 27.6],
  pelletee: { niveau: 0.55, duree: 0.30 },        // frottement bref : vitesse(0,55) puis retombée (≈ 0,45 s audibles)
  // Nappe : p (progression de sons.js) de `de` à `a`, interpolée ; tc = constante de temps ; `off` = gain 0 ; `quad` = power1InOut.
  nappe: [
    { de: -1,   a: 0.2,  off: true, tc: 0.05 },
    { de: 0.2,  a: 7.0,  p: [0.06, 0.06], tc: 0.6 },
    { de: 7.0,  a: 11.0, p: [0.06, 0.12], tc: 0.6 },
    { de: 11.0, a: 11.05, p: [0.12, 0.12], tc: 0.6 },
    { de: 11.05, a: 38.4, off: true, tc: 0.05 },
    { de: 38.4, a: 46.5, p: [0.30, 0.30], tc: 0.6 },      // note tenue
    { de: 46.5, a: 52.0, p: [0.30, 0.30], tc: 0.8 },
    { de: 52.0, a: 55.0, off: true, tc: 0.3 },
    { de: 55.0, a: 57.0, p: [0.30, 0.35], tc: 0.8 },
    { de: 57.0, a: 64.8, p: [0.35, 0.35], tc: 0.8 },
    { de: 64.8, a: 74.0, p: [0.35, 1.0], tc: 0.15, quad: true },   // la nappe s'ouvre
    { de: 74.0, a: 75.4, p: [1.0, 0.80], tc: 0.3, quad: true },    // la nappe s'assombrit pendant la descente vers l'empreinte
    { de: 75.4, a: 77.4, p: [0.80, 0.80], tc: 0.3 },
    { de: 77.4, a: 78.6, p: [0.80, 1.0], tc: 0.3 },                 // elle se rouvre sur le livre
    { de: 78.6, a: 86.8, p: [1.0, 1.0], tc: 0.3 },                  // accord tenu (sort en cosinus de 84,0 à 86,8 : voir `nappeSort`)
    { de: 86.8, a: 1e9,  off: true, tc: 0.05 }                      // ensuite la nappe ne joue plus : seul l'accord de la frappe III la rappelle
  ],
  // Grondement : v fixe, ou base + k × q3. tc = constante de temps.
  grondement: [
    { de: -1,   a: 14.4, v: 0, tc: 0.05 },
    { de: 14.4, a: 16.0, v: 0.08, tc: 0.8 },
    { de: 16.0, a: 29.0, base: 0.25, k: 0.35, tc: 0.8 },
    { de: 29.0, a: 38.0, v: 0.35, tc: 1.5 },
    { de: 38.0, a: 52.0, v: 0, tc: 0.5 },
    { de: 52.0, a: 53.2, v: 0.8, tc: 0.05 },
    { de: 53.2, a: 1e9,  v: 0, tc: 0.05 }
  ],
  // gain de la nappe (multiplicateur) pour porter le souffle (scène 0) et la note tenue (scènes 5, 6) entre −30 et −24 dBFS.
  // Il change à 64,0, dans le silence 3 (caché), pour que la révélation reste telle que la table la donne.
  gainNappe: [
    { de: -1, a: 38.4, g: 29 },      // souffle de la porte (0,2 -> 11,05)
    { de: 38.4, a: 64.0, g: 2.2 },   // note tenue (38,4 -> 52) et nappe de 55 à 64
    { de: 64.0, a: 1e9, g: 1 }       // la nappe s'ouvre : valeurs de la table
  ],
  nappeSort: { a: 84.0, b: 86.8 },               // fondreAuSilence(nappe, 84,0, 2,8) ; le gain maître reste à 1
  // Scène 12, au toucher ou au défilement (événements 'frappe' {k}, 'pastille'). Tout passe par le gain maître (T = 92 : à 1).
  frappes: {
    reverb: 0.45, coupVel: 1.0,
    notes: { 1: { f0: 146.83, vel: 0.9 }, 2: { f0: 220, vel: 0.9 }, 3: { f0: 293.66, vel: 0.9 } },   // Ré 2, La 2, Ré 3
    accord: { p: 0.6, debut: 0.4, tc: 0.5, fondu: 7.9, dureeFondu: 3.0 },                       // après la frappe III : nappe 0 -> 0,6 dès t + 0,4, fondu final de t + 7,9 à t + 10,9
    plus: { f0: 1180, vel: 0.15 },                                                                // 4e activation et suivantes
    pastille: { f0: 1180, vel: 0.25 }                                                             // arrivée de la pièce dans la pastille (scène 13)
  },
  coupeNet: { a: 53.2, b: 53.22 },                // le grondement bref est coupé net : rampe linéaire à 0 en 0,02 s
  geste: { de: 57.0, a: 63.0, retrait: { base: 0.20, amp: 0.15, periode: 1.7 } },   // frottement du geste (v ; retrait seul sans geste)
  scene3: { de: 16.0, a: 29.0, vMax: 1.5 },       // mode libre : frottement = vitesse(min(1, |vDefil| / 1,5))
  premierPixel: { f0: 1180, vel: 0.20 },
  fondPieceLibre: 0.30
};

export const DEFAUTS = {
  niveau: 0.715,                                    // gain de sortie après le gain maître (réglage de crête)
  graine: null,                                    // graine du hasard (null : tirée au hasard ; fixe pour les rendus)
  // Emplacements réservés (INACTIFS, aucun fichier, aucune lecture codée) .
  reserve: {
    bande: { actif: false, ogg: 'assets/talent/son/bande.ogg', mp3: 'assets/talent/son/bande.mp3', bandeAvecTintements: false },
    voix: [
      { id: 'voix-1', actif: false, ogg: 'assets/talent/son/voix-1.ogg', mp3: 'assets/talent/son/voix-1.mp3', t: 39.0, dureeMax: 3.5 },
      { id: 'voix-2', actif: false, ogg: 'assets/talent/son/voix-2.ogg', mp3: 'assets/talent/son/voix-2.mp3', t: 46.5, dureeMax: 5.0 }
    ],
    baisseBandeDb: 9, attaqueS: 0.2, relacheS: 0.6
  }
};

// ---- fonctions de T ------------------------------------------------------------------
const bornes = (x, a, b) => Math.max(a, Math.min(b, x));
const quad = u => (u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u));
const lisse = u => { u = bornes(u, 0, 1); return u * u * (3 - 2 * u); };
export function q3Auto(T) {                         // quantité de terre en mode automatique (cran de 0,1, montée de 0,35 s)
  if (T < 16) return 0;
  let q = 0; for (const c of TABLE.crans) q += 0.1 * lisse((T - c) / 0.35);
  return Math.min(1, q + 0.1 * bornes(T - 28, 0, 1));
}
function zone(rows, T) { let r = rows[0]; for (const x of rows) if (T >= x.de) r = x; return r; }
export function nappeDe(T) {                        // { off } ou { p, tc }
  const r = zone(TABLE.nappe, T); if (r.off) return { off: true, tc: r.tc };
  const u = r.a >= 1e8 ? 0 : bornes((T - r.de) / (r.a - r.de), 0, 1), w = r.quad ? quad(u) : u;
  return { p: r.p[0] + (r.p[1] - r.p[0]) * w, tc: r.tc };
}
export function grondementDe(T, q3) {
  const r = zone(TABLE.grondement, T); return { v: r.k != null ? r.base + r.k * q3 : r.v, tc: r.tc };
}
export function gestuelDe(T) {                      // vitesse du retrait seul, scène 8
  const g = TABLE.geste; if (T < g.de || T >= g.a) return 0;
  return g.retrait.base + g.retrait.amp * Math.sin(2 * Math.PI * (T - g.de) / g.retrait.periode);
}

// ---- un gain « porte » : valeur exacte en fonction de T, planifiée sur l'horloge audio --------
function creerPorte(hl, param, segs) {
  const dur = s => s.b - s.a;
  const val = T => { for (const s of segs) if (T >= s.a && T < s.b) { const u = (T - s.a) / dur(s);
    return s.type === 'fondu' ? 0.5 * (1 + Math.cos(Math.PI * u)) : s.type === 'zero' ? 0 : s.type === 'montee' ? u : 1 - u; } return 1; };
  const planifier = (s, ts, u0) => { const r = Math.max(0.001, (1 - u0) * dur(s));
    if (s.type === 'fondu') param.setValueCurveAtTime(S.courbeFondu(1, u0), ts, r);
    else if (s.type === 'montee') { param.setValueAtTime(u0, ts); param.linearRampToValueAtTime(1, ts + r); }
    else if (s.type === 'descente') { param.setValueAtTime(1 - u0, ts); param.linearRampToValueAtTime(0, ts + r); } };
  return {
    val,
    pas(T, prev, ctx) {                              // pas normal en avant : planifie les segments franchis (à l'instant exact hors ligne)
      for (const s of segs) if (prev < s.a && s.a <= T) {
        if (s.type === 'zero') { if (!hl) { const now = ctx.currentTime, v = param.value; param.cancelScheduledValues(now); param.setValueAtTime(v, now); param.linearRampToValueAtTime(0, now + 0.02); } }
        else if (hl) planifier(s, s.a, 0); else planifier(s, ctx.currentTime, (T - s.a) / dur(s));
      }
    },
    saut(T, ctx) {                                   // saut, retour en arrière ou première image : on rejoint la valeur de T en 0,03 s
      const now = ctx.currentTime, v0 = param.value, d = 0.03, T2 = T + d;
      param.cancelScheduledValues(now); param.setValueAtTime(v0, now); param.linearRampToValueAtTime(val(T2), now + d);
      for (const s of segs) if (T2 >= s.a && T2 < s.b && s.type !== 'zero') planifier(s, now + d + 0.001, (T2 - s.a) / dur(s));
    },
    fixer(v, ctx) { const now = ctx.currentTime; param.cancelScheduledValues(now); param.setValueAtTime(v, now); }
  };
}

// ---- le moteur : construit le graphe dans ctx (direct ou hors ligne) -------------------------
function construire(ctx, hl, R, opts = {}) {
  const dest = ctx.destination;
  const trim = ctx.createGain(); trim.gain.value = R.niveau; trim.connect(dest);
  const susp = ctx.createGain(); susp.gain.value = hl ? 1 : 0; susp.connect(trim);
  const coupe = ctx.createGain(); coupe.connect(susp);
  const master = ctx.createGain(); master.gain.value = 1; master.connect(coupe);
  const bus = ctx.createGain(); bus.connect(master);
  const gate = ctx.createGain(); gate.connect(bus);     // porte du grondement bref (coupé net à 53,20)
  const boost = ctx.createGain();
  const nf = ctx.createGain(); nf.connect(bus); boost.connect(nf);       // porte de la nappe (sortie en cosinus 84,0 -> 86,8)
  const G = S.grondement(ctx, gate), N = S.nappe(ctx, boost), F1 = S.frottement(ctx, bus), F2 = S.frottement(ctx, bus);
  const salles = {}, ajouter = r => { if (r && !salles[r]) salles[r] = S.salle(ctx, bus, { reverb: r }); };
  for (const p of TABLE.ponctuels) if (p.t < 74) ajouter(p.reverb);
  const g0 = S.etatGraine();                                              // les salles neuves tirent leur hasard à part : rien ne change avant 74,0
  for (const p of TABLE.ponctuels) if (p.t >= 74) ajouter(p.reverb);
  ajouter(TABLE.frappes.reverb); S.fixerGraine(g0);
  const segsM = [], segsG = [];
  for (const s of TABLE.silences) segsM.push({ a: s.fond, b: s.debut, type: 'fondu' }, { a: s.debut, b: s.fin, type: 'zero' }, { a: s.fin, b: s.fin + TABLE.reprise, type: 'montee' });
  segsG.push({ a: TABLE.coupeNet.a, b: TABLE.coupeNet.b, type: 'descente' }, { a: TABLE.coupeNet.b, b: 1e9, type: 'zero' });
  const segsN = [{ a: TABLE.nappeSort.a, b: TABLE.nappeSort.b, type: 'fondu' }, { a: TABLE.nappeSort.b, b: 1e9, type: 'zero' }];
  const porteM = creerPorte(hl, master.gain, segsM), porteG = creerPorte(hl, gate.gain, segsG), porteN = creerPorte(hl, nf.gain, segsN);
  const m = { T: null, prev: null, coupe: false, forceZero: false, last: {}, fouille: 0, tFouille: -9, pixel: false, demarre: 0 };
  const quand = Te => (hl ? Te : ctx.currentTime);
  const poser = (cle, v, tc, fn, force) => { const l = m.last[cle]; if (!force && l && Math.abs(l.v - v) < 0.003 * Math.max(1, Math.abs(v)) && l.tc === tc) return; m.last[cle] = { v, tc }; fn(); };

  function jouer(p, t) {
    if (opts.sansPonctuels === true || (opts.sansPonctuels || []).includes(p.id)) return;
    const d = p.reverb ? salles[p.reverb] : bus;
    if (p.son === 'coup') S.coup(ctx, d, t, p.vel); else S.tintement(ctx, d, t, p.f0, p.vel);
  }
  function setTime(T, etat) {
    etat = etat || {}; const prev = m.prev, now = ctx.currentTime;
    const dT = prev == null ? NaN : T - prev, normal = dT > 0 && dT <= TABLE.pasMax;
    const saut = !normal && !(dT === 0);               // première image, saut ou retour en arrière
    if (hl && prev == null) { m.prev = T; m.T = T; }
    else {
      // gain maître : fonction de T (silences exacts)
      if (m.forceZero) { if (T >= 63.0 || T < TABLE.geste.de) { m.forceZero = false; if (T < TABLE.geste.de) porteM.saut(T, ctx); } }
      else if (normal) { porteM.pas(T, prev, ctx); porteG.pas(T, prev, ctx); porteN.pas(T, prev, ctx); }
      else if (saut) { porteM.saut(T, ctx); porteG.saut(T, ctx); porteN.saut(T, ctx); }
      // sons ponctuels : en avançant seulement
      if (normal) { for (const p of TABLE.ponctuels) if (prev < p.t && p.t <= T) jouer(p, hl ? p.t : now); }
      else if (saut && prev != null) { for (const p of TABLE.ponctuels) if (p.rattrapage && prev < p.rattrapage[0] && T >= p.rattrapage[0] && T < p.rattrapage[1]) jouer(p, now); }
      m.prev = T; m.T = T;
    }
    const f = saut, tcs = f ? 0.1 : null;               // après un saut, les sons continus rejoignent T plus vite
    const np = nappeDe(T);
    if (np.off) poser('n', -1, np.tc, () => N.eteindre(quand(T), tcs || np.tc), f);
    else poser('n', np.p, np.tc, () => N.progression(np.p, quand(T), tcs || np.tc), f);
    const gn = zone(TABLE.gainNappe, T).g; poser('nb', gn, 0, () => boost.gain.setTargetAtTime(gn, quand(T), f ? 0.05 : 0.05), f);
    const q3 = typeof etat.q3 === 'number' ? etat.q3 : q3Auto(T), g = grondementDe(T, q3);
    poser('g', g.v, g.tc, () => G.regler(g.v, quand(T), tcs || g.tc), f);
    // frottement du geste : défilement (scène 3 libre) ou fouille / retrait seul (scène 8)
    let v = 0;
    if (etat.mode === 'libre' && T >= TABLE.scene3.de && T < TABLE.scene3.a) v = Math.min(1, Math.abs(etat.vDefil || 0) / TABLE.scene3.vMax);
    if (T >= TABLE.geste.de && T < TABLE.geste.a) { if (!hl && now - m.tFouille > 0.15) m.fouille = 0; v = Math.max(gestuelDe(T), m.fouille); }
    if (v > 0 || m.last.f && m.last.f.v > 0) { const l = m.last.f; if (!l || Math.abs(l.v - v) > 0.01 || (v === 0 && l.v !== 0) || f) { m.last.f = { v }; F2.vitesse(v, quand(T)); } }
    if (T < TABLE.geste.de || T >= TABLE.geste.a) m.pixel = false;
  }
  function evenement(nom, d = {}) {
    const t = hl && d.t != null ? d.t : ctx.currentTime;
    if (nom === 'pelletee') { F1.vitesse(TABLE.pelletee.niveau, t); F1.vitesse(0, t + TABLE.pelletee.duree); }
    else if (nom === 'fouille') { m.fouille = bornes(d.v || 0, 0, 1); m.tFouille = ctx.currentTime; }
    else if (nom === 'premierpixel') { if (!m.pixel && m.T >= TABLE.geste.de && m.T < TABLE.geste.a) { m.pixel = true; if (opts.sansPonctuels !== true) S.tintement(ctx, bus, t, TABLE.premierPixel.f0, TABLE.premierPixel.vel); } }
    else if (nom === 'frappe') {
      const F = TABLE.frappes, k = d.k | 0;
      if (k >= 1 && k <= 3) {
        const n = F.notes[k], sal = salles[F.reverb];
        S.coup(ctx, sal, t, F.coupVel); S.tintement(ctx, sal, t, n.f0, n.vel);
        if (k === 3) {                                  // accord tenu (nappe 0 -> 0,6) puis fondu final en cosinus
          const a = F.accord; nf.gain.cancelScheduledValues(t); nf.gain.setValueAtTime(1, t);
          N.progression(a.p, t + a.debut, a.tc); N.sortie.gain.setValueAtTime(0, t);
          const tf = t + a.fondu, niv = 0.05 + 0.13 * a.p; N.sortie.gain.cancelScheduledValues(tf); N.sortie.gain.setValueCurveAtTime(S.courbeFondu(niv), tf, a.dureeFondu);
        }
      } else if (k >= 4) S.tintement(ctx, bus, t, F.plus.f0, F.plus.vel);
    }
    else if (nom === 'pastille') S.tintement(ctx, bus, t, TABLE.frappes.pastille.f0, TABLE.frappes.pastille.vel);
    else if (nom === 'piecelibre' && !hl) {              // la pièce est libre : fondu de 0,30 s tout de suite, puis zéro jusqu'à 63,0
      const now = ctx.currentTime, v0 = master.gain.value; master.gain.cancelScheduledValues(now);
      master.gain.setValueCurveAtTime(S.courbeFondu(v0), now, TABLE.fondPieceLibre); m.forceZero = true;
    }
  }
  function couper(b, t = ctx.currentTime) {
    m.coupe = !!b; const g = coupe.gain, v0 = hl ? (b ? 1 : 0) : g.value;
    g.cancelScheduledValues(t); g.setValueAtTime(v0, t); g.linearRampToValueAtTime(b ? 0 : 1, t + 0.25);
  }
  return { ctx, m, master, coupe, susp, setTime, evenement, couper, porteM, bus, nappe: N, grondement: G };
}

// ---- l'interface ----------------------------------------------------------
export function creerConduite(reglages = {}) {
  const R = { ...DEFAUTS, ...reglages, reserve: { ...DEFAUTS.reserve, ...(reglages.reserve || {}) } };
  let moteur = null, ctx = null, dernier = null, coupeVoulu = false, demandeSusp = 0;
  return {
    async demarrer() {                                 // à appeler dans un clic
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        ctx = new AC({ latencyHint: 'playback' });
        if (navigator.audioSession) try { navigator.audioSession.type = 'playback'; } catch (e) { /* iOS : rien */ }
        S.fixerGraine(R.graine != null ? R.graine : (Math.random() * 4294967296) >>> 0);
        moteur = construire(ctx, false, R);
        const now = ctx.currentTime; moteur.susp.gain.setValueAtTime(0, now); moteur.susp.gain.linearRampToValueAtTime(1, now + 0.15);
        if (coupeVoulu) moteur.couper(true);
      }
      await ctx.resume();
      if (dernier) moteur.setTime(dernier.T, dernier.etat);
    },
    setTime(T, etat) { dernier = { T, etat }; if (moteur) moteur.setTime(T, etat); },
    evenement(nom, donnees) { if (moteur) moteur.evenement(nom, donnees); },
    couper(b) { coupeVoulu = !!b; if (moteur) moteur.couper(b); },
    suspendre() {                                      // onglet caché : descend à 0 en 0,3 s puis suspend le contexte
      if (!moteur) return; const id = ++demandeSusp, g = moteur.susp.gain, now = ctx.currentTime, v0 = g.value;
      g.cancelScheduledValues(now); g.setValueAtTime(v0, now); g.linearRampToValueAtTime(0, now + 0.3);
      setTimeout(() => { if (id === demandeSusp) ctx.suspend(); }, 340);
    },
    async reprendre() {                                // retour : resume(), son rétabli en 0,6 s
      if (!moteur) return; demandeSusp++; await ctx.resume();
      const g = moteur.susp.gain, now = ctx.currentTime, v0 = g.value;
      g.cancelScheduledValues(now); g.setValueAtTime(v0, now); g.linearRampToValueAtTime(1, now + 0.6);
    },
    actif() { return !!moteur && !coupeVoulu; },
    inspecter() {                                      // pour la page d'essai et les tests
      if (!moteur) return { ctx: null, demarre: false };
      const T = moteur.m.T; return { ctx: ctx.state, T, gainMaitre: moteur.master.gain.value, gainCible: T == null ? null : moteur.porteM.val(T),
        gainCoupure: moteur.coupe.gain.value, coupe: coupeVoulu };
    }
  };
}

// Rend la conduite de 0 à dureeS (mode automatique, sans geste, pelletées aux crans) dans un OfflineAudioContext.
// options : { evenements: [{t, nom, donnees}] (instants du rendu), figerT (T gardé fixe, ex. 92), sansPonctuels (true ou liste d'identifiants), couperA (s), graine, reglages }
export async function rendreHorsLigne(dureeS = 74, pasS = 1 / 60, options = {}) {
  const R = { ...DEFAUTS, ...(options.reglages || {}) }, sr = 44100;
  S.fixerGraine(options.graine != null ? options.graine : 20261115);
  const ctx = new OfflineAudioContext(2, Math.ceil(sr * dureeS), sr);
  const mo = construire(ctx, true, R, { sansPonctuels: options.sansPonctuels || false });
  let prev = null;
  for (let i = 0; i * pasS <= dureeS + 1e-9; i++) {
    const T = i * pasS;
    if (prev != null) {
      for (const c of TABLE.crans) if (prev < c && c <= T) mo.evenement('pelletee', { t: c });
      if (options.couperA != null && prev < options.couperA && options.couperA <= T) mo.couper(true, options.couperA);
    }
    const Tm = options.figerT != null ? options.figerT : Math.min(T, 92);     // au-delà de 92 s la page garde T = 92
    for (const e of options.evenements || []) if (prev != null && prev < e.t && e.t <= T) mo.evenement(e.nom, { ...(e.donnees || {}), t: e.t });
    mo.setTime(Tm, { mode: 'auto', q3: q3Auto(Tm), vDefil: 0, t8: 0, son: true });
    prev = T;
  }
  return ctx.startRendering();
}
