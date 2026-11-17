// Générateurs sonores Web Audio du « talent déterré », sans fichier ni bibliothèque.
// Générateurs sonores, plus le « coup ».
// Chaque fonction construit un petit graphe dans `ctx` (AudioContext ou OfflineAudioContext) vers `dest`.
// Le hasard vient d'un générateur à graine : deux rendus hors ligne donnent les mêmes échantillons.

let graine = 1;
export function fixerGraine(n) { graine = (n >>> 0) || 1; }
export function etatGraine() { return graine; }
export function alea() {                                   // mulberry32
  graine = (graine + 0x6D2B79F5) >>> 0; let t = graine;
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// ---- utilitaires -------------------------------------------------------------
const cache = new WeakMap();                               // un tampon de bruit par contexte
function tampon(ctx, nom, fabrique) {
  let m = cache.get(ctx); if (!m) cache.set(ctx, m = {});
  return m[nom] || (m[nom] = fabrique());
}
export function bruitBrun(ctx, secondes = 8) {             // bruit brun (1/f²) bouclable sans clic
  return tampon(ctx, 'brun' + secondes, () => {
    const n = Math.floor(ctx.sampleRate * secondes), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    let x = 0; for (let i = 0; i < n; i++) { x = (x + 0.02 * (alea() * 2 - 1)) / 1.02; d[i] = x * 3.5; }
    const f = Math.floor(n * 0.1);                         // raccord : fondu enchaîné fin -> début
    for (let i = 0; i < f; i++) { const k = i / f; d[i] = d[i] * k + d[n - f + i] * (1 - k); }
    const o = ctx.createBuffer(1, n - f, ctx.sampleRate); o.copyToChannel(d.subarray(0, n - f), 0); return o;
  });
}
export function bruitBlanc(ctx, secondes = 2) {
  return tampon(ctx, 'blanc' + secondes, () => {
    const n = Math.floor(ctx.sampleRate * secondes), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = alea() * 2 - 1; return b;
  });
}
export function reponseImpulsionnelle(ctx, secondes = 2.4, brillance = 0.6) { // réverbération « salle de pierre »
  const n = Math.floor(ctx.sampleRate * secondes), b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); let lp = 0;
    for (let i = 0; i < n; i++) { const t = i / n; const w = alea() * 2 - 1; lp += (w - lp) * (brillance * (1 - t) + 0.05);
      d[i] = lp * Math.pow(1 - t, 3.2) * (i < 200 ? i / 200 : 1); } }
  return b;
}

export const GRONDEMENT_MEDIUM = 1.7, GRONDEMENT_COMP = 0.905;                      // gain de la couche 150-400 Hz
// ---- 1. grondement de terre grave et continu --------------------------------
export function grondement(ctx, dest) {
  const g = ctx.createGain(); g.gain.value = 0; g.connect(dest);
  const s = ctx.createBufferSource(); s.buffer = bruitBrun(ctx); s.loop = true;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 110; lp.Q.value = 0.7;
  s.connect(lp).connect(g);
  const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();     // deux sinus presque identiques : battement lent
  o1.frequency.value = 36; o2.frequency.value = 37.3; const gs = ctx.createGain(); gs.gain.value = 0.35;
  o1.connect(gs); o2.connect(gs); gs.connect(g);
  const sm = ctx.createBufferSource(); sm.buffer = bruitBlanc(ctx); sm.loop = true;      // couche médium : bruit 150-400 Hz, même niveau
  const mh = ctx.createBiquadFilter(); mh.type = 'highpass'; mh.frequency.value = 150; const ml = ctx.createBiquadFilter(); ml.type = 'lowpass'; ml.frequency.value = 400;
  const mg = ctx.createGain(); mg.gain.value = GRONDEMENT_MEDIUM; sm.connect(mh).connect(ml).connect(mg).connect(g);
  const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.13; lg.gain.value = 40; lfo.connect(lg).connect(lp.frequency);
  [s, sm, o1, o2, lfo].forEach(n => n.start());
  return { sortie: g, regler(v, t = ctx.currentTime, tc = 0.8) { g.gain.setTargetAtTime(v * GRONDEMENT_COMP, t, tc); }, arreter() { [s, sm, o1, o2, lfo].forEach(n => n.stop()); } };
}

// ---- 2. frottement de terre qui suit la vitesse du geste --------------------
export function frottement(ctx, dest) {
  const g = ctx.createGain(); g.gain.value = 0; g.connect(dest);
  const s = ctx.createBufferSource(); s.buffer = bruitBlanc(ctx); s.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 0.9;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 180;
  s.connect(bp).connect(hp).connect(g); s.start();
  return {
    sortie: g,
    vitesse(v, t = ctx.currentTime) {                      // v entre 0 (immobile) et 1 (geste vif)
      v = Math.max(0, Math.min(1, v));
      g.gain.setTargetAtTime(0.9 * v * v, t, 0.04);        // attaque rapide : le son colle au geste
      bp.frequency.setTargetAtTime(350 + 2200 * v, t, 0.06);
    },
    arreter() { s.stop(); }
  };
}

// ---- 3. tintement d'une pièce d'or (partiels inharmoniques, longue résonance)
export function tintement(ctx, dest, t = ctx.currentTime, f0 = 1180, vel = 1) {
  const partiels = [[1, 1, 3.2], [2.76, 0.55, 2.4], [5.4, 0.32, 1.5], [8.93, 0.2, 0.9], [13.34, 0.1, 0.5], [18.64, 0.05, 0.3]];
  const out = ctx.createGain(); out.gain.value = 0.28 * vel; out.connect(dest);
  for (const [r, a, dur] of partiels) {
    const o = ctx.createOscillator(); o.frequency.value = f0 * r * (1 + (alea() - 0.5) * 0.004);
    const e = ctx.createGain(); e.gain.setValueAtTime(0, t); e.gain.linearRampToValueAtTime(a, t + 0.002); e.gain.setTargetAtTime(0, t + 0.002, dur / 4.5);
    o.connect(e).connect(out); o.start(t); o.stop(t + dur * 2.2);
  }
  const c = ctx.createBufferSource(); c.buffer = bruitBlanc(ctx, 0.05);   // claquement d'attaque : métal sur métal
  const cf = ctx.createBiquadFilter(); cf.type = 'highpass'; cf.frequency.value = 4000;
  const ce = ctx.createGain(); ce.gain.setValueAtTime(0, t); ce.gain.linearRampToValueAtTime(0.5, t + 0.0006); ce.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
  c.connect(cf).connect(ce).connect(out); c.start(t);
}

// ---- 4. nappe tenue qui s'ouvre (progression 0 -> 1) -------------------------
export function nappe(ctx, dest) {
  const g = ctx.createGain(); g.gain.value = 0; g.connect(dest);
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 220; f.Q.value = 0.5; f.connect(g);
  // Ré mineur ouvert : fondamentale, quinte, octave, tierce, neuvième ; chaque voix entre à son seuil
  const voix = [[73.42, 0], [110, 0.05], [146.83, 0.25], [174.61, 0.45], [220, 0.6], [329.63, 0.8]].map(([fr, seuil]) => {
    const vg = ctx.createGain(); vg.gain.value = 0; vg.connect(f);
    const os = [-7, 0, 7].map(det => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.detune.value = det; o.connect(vg); o.start(); return o; });
    return { fr, seuil, vg, os };
  });
  return {
    sortie: g,
    progression(p, t = ctx.currentTime, tc = 0.15) {
      p = Math.max(0, Math.min(1, p));
      g.gain.setTargetAtTime(0.05 + 0.13 * p, t, tc);
      f.frequency.setTargetAtTime(220 + 3600 * p * p, t, tc);
      for (const v of voix) {
        const k = Math.max(0, Math.min(1, (p - v.seuil) / 0.2));
        v.vg.gain.setTargetAtTime(0.22 * k, t, tc);
        v.os.forEach(o => o.frequency.setTargetAtTime(v.fr * (1 + 0.02 * p * (v.seuil > 0.4 ? 1 : 0)), t, tc * 2));
      }
    },
    eteindre(t = ctx.currentTime, tc = 0.3) { g.gain.setTargetAtTime(0, t, tc); },   // nouveau : la nappe sort (gain 0)
    arreter() { voix.forEach(v => v.os.forEach(o => o.stop())); }
  };
}

// ---- 5. silence amené par un fondu (courbe en cosinus qui finit à 0 exact) ---
export function courbeFondu(depart = 1, u0 = 0, n = 64) {
  const c = new Float32Array(n); for (let i = 0; i < n; i++) c[i] = depart * 0.5 * (1 + Math.cos(Math.PI * (u0 + (1 - u0) * i / (n - 1)))); c[n - 1] = 0; return c;
}
export function fondreAuSilence(param, t, duree = 3, depart = param.value) {
  param.cancelScheduledValues(t); param.setValueCurveAtTime(courbeFondu(depart), t, duree); return t + duree;
}

// ---- 6. coup sourd (porte, pièce au fond) — NEUF, jamais rendu auparavant -----
// Bruit brun -> passe-bas 140 Hz Q 1 ; + sinus 48 Hz x0,6 ; + passe-bande 260 Hz Q 1,2 x0,25 (haut-parleurs de téléphone).
// Enveloppe : 5 ms de montée, décroissance de constante 0,12 s, fin ramenée à 0 entre 0,35 et 0,40 s. Sec (la salle est en aval).
export const COUP = { corps: 1.9, sinus: 0.5, clic: 0.5, niveau: 0.5 };   // corps médium (180-450 Hz) et clic de bois (1-2,5 kHz, 8 ms)
export function coup(ctx, dest, t = ctx.currentTime, vel = 1) {
  const fin = ctx.createGain(); fin.gain.setValueAtTime(COUP.niveau, t); fin.gain.setValueAtTime(COUP.niveau, t + 0.35); fin.gain.linearRampToValueAtTime(0, t + 0.40); fin.connect(dest);
  const env = ctx.createGain(); env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(0.9 * vel, t + 0.005); env.gain.setTargetAtTime(0, t + 0.005, 0.12); env.connect(fin);
  const s = ctx.createBufferSource(); s.buffer = bruitBrun(ctx);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 140; lp.Q.value = 1;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 260; bp.Q.value = 1.2;
  const gb = ctx.createGain(); gb.gain.value = 0.25;
  const o = ctx.createOscillator(); o.frequency.value = 48; const go = ctx.createGain(); go.gain.value = 0.6;
  s.connect(lp).connect(env); s.connect(bp).connect(gb).connect(env); o.connect(go).connect(env);
  // corps médium : bruit blanc en passe-bande 260 Hz + sinus amorti 220 Hz (décroissance 0,07 s), rendent le coup audible sur un téléphone
  const em = ctx.createGain(); em.gain.setValueAtTime(0, t); em.gain.linearRampToValueAtTime(vel, t + 0.004); em.gain.setTargetAtTime(0, t + 0.004, 0.07); em.connect(fin);
  const w = ctx.createBufferSource(); w.buffer = bruitBlanc(ctx); const wb = ctx.createBiquadFilter(); wb.type = 'bandpass'; wb.frequency.value = 260; wb.Q.value = 1.2;
  const wg = ctx.createGain(); wg.gain.value = COUP.corps; w.connect(wb).connect(wg).connect(em);
  const o2 = ctx.createOscillator(); o2.frequency.value = 220; const g2 = ctx.createGain(); g2.gain.value = COUP.sinus; o2.connect(g2).connect(em);
  // attaque : clic de bois, bruit passe-bande 1,8 kHz, 8 ms
  const ec = ctx.createGain(); ec.gain.setValueAtTime(0, t); ec.gain.linearRampToValueAtTime(vel * COUP.clic, t + 0.001); ec.gain.linearRampToValueAtTime(0, t + 0.008); ec.connect(fin);
  const c = ctx.createBufferSource(); c.buffer = bruitBlanc(ctx); const cb = ctx.createBiquadFilter(); cb.type = 'bandpass'; cb.frequency.value = 1800; cb.Q.value = 0.8; c.connect(cb).connect(ec);
  s.start(t, alea() * 3); o.start(t); o2.start(t); w.start(t, alea()); c.start(t, alea());
  for (const n of [s, o, o2, w, c]) n.stop(t + 0.41);
}

// ---- chaîne commune : réverbération par convolution --------------------------
export function salle(ctx, dest, { reverb = 0.3, secondes = 2.4 } = {}) {
  const entree = ctx.createGain(), sec = ctx.createGain(), hum = ctx.createGain(), conv = ctx.createConvolver();
  conv.buffer = reponseImpulsionnelle(ctx, secondes); sec.gain.value = 1 - reverb * 0.5; hum.gain.value = reverb;
  entree.connect(sec).connect(dest); entree.connect(conv).connect(hum).connect(dest);
  return entree;
}

// ---- WAV 16 bits ---------------------------------------------------------------
export function versWav(buf) {
  const nc = buf.numberOfChannels, n = buf.length, a = new ArrayBuffer(44 + n * nc * 2), v = new DataView(a);
  const s = (o, t) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  s(0, 'RIFF'); v.setUint32(4, 36 + n * nc * 2, true); s(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, nc, true);
  v.setUint32(24, buf.sampleRate, true); v.setUint32(28, buf.sampleRate * nc * 2, true); v.setUint16(32, nc * 2, true); v.setUint16(34, 16, true); s(36, 'data'); v.setUint32(40, n * nc * 2, true);
  const ch = [...Array(nc)].map((_, i) => buf.getChannelData(i)); let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < nc; c++) { const x = Math.max(-1, Math.min(1, ch[c][i])); v.setInt16(o, x < 0 ? x * 32768 : x * 32767, true); o += 2; }
  return a;
}
