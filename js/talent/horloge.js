// L'horloge de « Le troisième serviteur » (v2, scènes 0 à 13).
// Scènes 10 à 13 : couverture, portes, calque du jour, frappes, vol vers la pastille.
// Elle possède T, les deux modes (automatique : l'horloge mène et la page défile seule ; libre : T vient du défilement),
// yDe(T) et tDe(y), les crans de la scène 3, la fenêtre t8 de la scène 8, le paramètre ?t= (T figé, pour les captures)
// et l'arrêt à T = 92,0 (au-delà, l'image suit etat.y, etat.frappes, etat.tFrappe). À chaque image : scene.setTime(T, etat), puis conduite.setTime(T, etat), puis les textes, la porte,
// le repère. Scène et son sont facultatifs (doublures) : sans eux, la porte, les textes, le repère et l'horloge marchent seuls.
// Aucun preventDefault : la page reste défilable à tout moment.
import { SCENES, FIN, ECRANS, CRANS3, CRAN3, IMMOBILES, GESTE8, RETOUR_SEUIL, REPRENDRE, TEXTES, ENTREE, SORTIE, PORTE, REPERE, LOTS, COUVERTURE,
  COUV, PORTES, JOUR, FRAPPES, VOL, EPINGLE } from './table.js';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
// Courbes : mêmes définitions que js/talent/scene/recette.js (GSAP : power1 = quadratique, power2 = cubique).
export const ease = {
  expoOut: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  power2In: (t) => t * t * t,
  power2InOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  power1InOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  sineInOut: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
};

/* ================= Correspondance T ↔ défilement (en écrans) ================= */

// Mode libre : dans chaque scène, T = T_début + (y − y_début) / (y_fin − y_début) × durée.
export function yLibre(T) {
  if (T <= 0) return 0;
  if (T >= FIN) return ECRANS;
  const s = SCENES.find((c) => T < c.t[1]) || SCENES[SCENES.length - 1];
  return lerp(s.y[0], s.y[1], (T - s.t[0]) / (s.t[1] - s.t[0]));
}
export function tDe(y) {
  if (y <= 0) return 0;
  if (y >= ECRANS) return FIN;
  const s = SCENES.find((c) => y < c.y[1]) || SCENES[SCENES.length - 1];
  return lerp(s.t[0], s.t[1], (y - s.y[0]) / (s.y[1] - s.y[0]));
}
// Temps « vu » par le défilement automatique : figé pendant les immobilités voulues, puis rattrapage en douceur.
function tDefile(T) {
  for (const im of IMMOBILES) {
    if (T >= im.debut && T < im.fin) return im.debut;
    if (T >= im.fin && T < im.fin + im.rattrapage) return lerp(im.debut, im.fin + im.rattrapage, ease.power2InOut((T - im.fin) / im.rattrapage));
  }
  return T;
}
// Scène 3 en automatique : neuf pelletées (0,25 écran chacune en 0,45 s, expoOut), puis 0,25 écran linéaire de 28 à 29.
function yScene3(T) {
  let y = SCENES[3].y[0];
  for (const c of CRANS3) y += CRAN3.pas * ease.expoOut(clamp((T - c) / CRAN3.duree));
  return y + CRAN3.pasFinal * clamp((T - CRAN3.finLineaire[0]) / (CRAN3.finLineaire[1] - CRAN3.finLineaire[0]));
}
// Mode automatique : la position de la page à l'instant T (continue et croissante).
export function yDe(T) {
  if (T <= 0) return 0;
  if (T >= FIN) return ECRANS;
  const w = tDefile(T);
  if (w >= SCENES[3].t[0] && w < SCENES[3].t[1]) return yScene3(w);
  return yLibre(w);
}
/* ================= Textes : découpe en lignes (chaque ligne monte derrière son masque) ================= */

function decouper(el) {
  if (el.children.length && el.dataset.brut === undefined) return [];   // étiquette à variantes (T3.i) : un seul bloc, en fondu
  if (el.dataset.brut === undefined) el.dataset.brut = el.textContent;
  const brut = el.dataset.brut;
  el.textContent = '';
  const mots = brut.split(' ');
  const spans = mots.map((m, i) => {
    const s = document.createElement('span');
    s.textContent = m;
    el.appendChild(s);
    if (i < mots.length - 1) el.appendChild(document.createTextNode(' '));
    return s;
  });
  const lignes = [];
  let haut = null;
  spans.forEach((s, i) => {
    const t = s.offsetTop;
    if (haut === null || Math.abs(t - haut) > 2) { lignes.push([]); haut = t; }
    lignes[lignes.length - 1].push(mots[i]);
  });
  el.textContent = '';
  return lignes.map((l, i) => {
    const o = document.createElement('span'); o.className = 'l';
    const n = document.createElement('span'); n.className = 'li';
    n.textContent = l.join(' ') + (i < lignes.length - 1 ? ' ' : '');
    o.appendChild(n); el.appendChild(o);
    return n;
  });
}
function restaurer(el) { if (el.dataset.brut !== undefined) el.textContent = el.dataset.brut; }

/* ================= L'horloge ================= */

export class Horloge {
  constructor({ tFige = null, yFige = null } = {}) {
    this.html = document.documentElement;
    this.talent = document.getElementById('talent');
    this.scene3d = null;
    this.conduite = null;
    this.son = false;
    this.mode = tFige === null ? 'attente' : 'fige';
    this.tFige = tFige === null ? null : clamp(tFige, 0, FIN);
    this.T = this.tFige ?? 0;
    this.autoLance = false;         // le mode automatique a-t-il été lancé une fois ?
    this.fini = false;              // l'horloge a atteint 74,0 en automatique
    this.t8 = 0;
    this.libere = null;             // { T, p } : instant où le geste a libéré la pièce
    this.gesteVu = false;
    this.pause = null;              // onglet caché : { T } ; reprise différée
    this.yPrec = null; this.pPrec = null; this.v = 0;
    this.derniereY = null;          // dernière position posée par l'horloge (px)
    this.rejoint = null;
    this.sorties = [];
    this.visible = true;
    this.couvDemandee = false; this.suiteDemandee = false;
    // scènes 10 à 13
    this.kT = 0; this.kAff = 0; this.derniereFrappe = -1e9; this.tFrappeP = null;
    this.vol = { u: 0, cible: 0, P0: null, D0: 150, arrivee: null };
    this.finP = null; this.bougeApresFin = false; this.couv10 = null;

    const $ = (s) => document.querySelector(s);
    this.el = {
      scene: $('.scene-fixe'),
      seuil: $('.seuil'),
      sol: $('.porte-sol'), haloG: $('.porte-halo-g'), haloD: $('.porte-halo-d'), anneau: $('.anneau-geste'), couv: $('.livre-couverture'),
      fente: $('.porte-fente'), chantG: $('.porte-chant-g'), chantD: $('.porte-chant-d'), filet: $('.porte-filet'), porte: $('.porte'),
      strates: $('.strates'), s2025: $('.strate-2025'), s2002: $('.strate-2002'),
      repere: $('.repere'), rFilet: $('.repere-filet'), rPoint: $('.repere-point'), rT1: $('.repere-tiret-1'), rT2: $('.repere-tiret-2'),
      rTexte: $('.repere-texte'), rV: $('.repere-v'),
      indice: $('.indice-geste'), indicePoint: $('.indice-geste i'),
      reprendre: $('.reprendre'),
      // scènes 10 à 13
      decor: $('.decor-fin'), svg: $('.portes11'), vignette: $('.nuit-vignette'), flaques: [...document.querySelectorAll('.flaque')],
      ombre: $('.ombre-couv'), jour: $('.jour'), jourOr: $('.jour-or'), jourInc: $('.jour-inc'), jourNacre: $('.jour-nacre'),
      cadre11: $('.planche-11 .cadre'), frapper: $('.frapper'), t122: $('.t12-2'), pv13: $('.pv13'),
      groupes: [...document.querySelectorAll('.g12')], repere12: $('.repere12'), faites: $('#frappes-faites'), annonce: $('.annonce'),
      volImg: $('.vol-img'), pastille: $('.pastille'), icone: $('.pastille-icone'), entete: $('.site-header'), indiceSuite: $('.indice-suite'),
    };
    this.liens12 = this.el.groupes.map((g) => [...g.querySelectorAll('a')]);
    this.liensPortes = [...document.querySelectorAll('.porte-bouton a')];   // scène 11 : hors de la tabulation tant qu'ils ne sont pas visibles
    // textes animés (ordre du HTML), avec leurs temps (table.js)
    this.textes = [...document.querySelectorAll('[data-texte]')]
      .filter((e) => !['titre', 'strates', 'T9.1'].includes(e.dataset.texte) && TEXTES[e.dataset.texte])
      .map((e) => ({ el: e, cle: e.dataset.texte, ...TEXTES[e.dataset.texte], lignes: [], cache: {} }));
    if (this.el.rV) { this.el.rV.textContent = ''; this.valeurVoulue = ''; }
    this.mesurer();
    this.decouperTout();
    this.ecouter();
    this.el.frapper?.addEventListener('click', () => this.frapper());
    if (yFige !== null && Number.isFinite(yFige) && this.mode !== 'fige') { this.mode = 'libre'; this.allerA(yFige); }
    if (document.fonts) {
      document.fonts.ready.then(() => this.decouperTout());
      document.fonts.addEventListener?.('loadingdone', () => this.decouperTout());
    }
    if (this.mode === 'fige') this.placer();
    this.boucle = this.boucle.bind(this);
    this.raf = requestAnimationFrame(this.boucle);
  }

  /* ---------- mesures ---------- */
  mesurer() {
    this.H = this.el.scene.clientHeight || innerHeight;
    this.base = this.talent.getBoundingClientRect().top + scrollY;
    this.large = innerWidth >= 1100;
    this.moyen = innerWidth >= 600;
    this.largeur = innerWidth;
    this.mesurerFin();
  }
  yEcrans() { return (scrollY - this.base) / this.H; }
  allerA(yEcr) {
    const px = Math.round(this.base + yEcr * this.H);
    if (this.derniereY === null || Math.abs(px - scrollY) >= 1) window.scrollTo({ top: px, left: 0, behavior: 'instant' });   // jamais le défilement doux de style.css
    this.derniereY = px;
  }
  placer() { this.mesurer(); this.allerA(yDe(this.tFige)); }
  decouperTout() {
    for (const t of this.textes) { t.lignes = t.el.dataset.ligne !== undefined ? [t.el.querySelector('.li')].filter(Boolean) : decouper(t.el); t.cache = {}; }
    // scène 12 : les lignes de chaque groupe montent l'une après l'autre (transition CSS, temps réel) ; --i = rang de la ligne
    for (const g of [this.el.t122, ...this.el.groupes]) {
      if (!g) continue;
      const blocs = g.matches('[data-l], .t12-2') ? [g] : [...g.querySelectorAll('[data-l]')];
      if (g === this.el.t122 && g.dataset.l === undefined) g.dataset.l = '';
      let i = 0;
      for (const b of blocs) for (const li of decouper(b)) li.style.setProperty('--i', i++);
      for (const li of g.querySelectorAll('.g-lien .li')) li.style.setProperty('--i', i++);
    }
  }

  /* ---------- modules (facultatifs) ---------- */
  // anneau de focus du geste : affiché tant que le canevas a le focus clavier
  anneau(actif) {
    this.anneauActif = !!actif;
    this.el.scene.classList.toggle('anneau-actif', !!actif);
  }
  attacherScene(s) {
    this.scene3d = s;
    this.donnerReserves();
    s.on?.('pelletee', (d) => this.conduite?.evenement('pelletee', d));
    s.on?.('fouille', (d) => { this.gesteVu = true; this.conduite?.evenement('fouille', d); });
    s.on?.('premierpixel', (d) => this.conduite?.evenement('premierpixel', d));
    s.on?.('piecelibre', (d) => { this.libererPiece(); this.conduite?.evenement('piecelibre', d); });
  }
  // place réelle du voile du repère, donnée à la scène (px CSS) si elle sait la recevoir (scene.setReserves)
  donnerReserves() {
    const s = this.scene3d, t = this.el.rTexte;
    if (!s || typeof s.setReserves !== 'function' || !t) return;
    const r = t.getBoundingClientRect();
    if (!r.width) return;
    const mx = 110, my = 72;   // mêmes marges que le voile (talent.css, .repere-texte::before)
    try { s.setReserves({ repere: { xEcran: r.left + r.width / 2, yEcran: r.top + r.height / 2, largeur: r.width + 2 * mx, hauteur: r.height + 2 * my } }); } catch (e) { /* la scène n'en veut pas */ }
  }
  attacherSon(c) { this.conduite = c; }

  /* ---------- modes ---------- */
  commencer() {
    if (this.mode === 'fige') return;
    this.mesurer();
    const y = scrollY - this.base;
    if (y > RETOUR_SEUIL.seuilPx) {
      this.rejoint = { y0: this.yEcrans(), p0: performance.now() };
      this.mode = 'rejoint';
    } else this.lancerAuto(0);
  }
  // decalage : écart (en écrans) entre la page et yDe(T) à la reprise ; il se résorbe en 1,2 s (aucun saut de défilement)
  lancerAuto(T, decalage = 0) {
    this.mode = 'auto';
    this.decalage = decalage ? { d: decalage, p0: performance.now() } : null;
    this.autoLance = true;
    this.fini = false; this.finP = null; this.bougeApresFin = false;
    this.autoT0 = T; this.autoP0 = performance.now(); this.depart = this.autoP0;
    this.derniereY = null;
    this.html.classList.add('mode-auto');
    this.cacherReprendre();
  }
  rendreLaMain() {
    if (this.mode !== 'auto' && this.mode !== 'rejoint') return;
    // pendant une immobilité voulue, la page est en retard sur le défilement libre : on la pose à la place de T
    // (la scène est fixe, ce saut ne se voit pas) pour que T ne recule pas
    const T = this.T;
    if (this.mode === 'auto' && IMMOBILES.some((im) => T > im.debut && T < im.fin + im.rattrapage)) this.allerA(yLibre(T));
    this.mode = 'libre';
    this.rejoint = null;
    this.html.classList.remove('mode-auto');
    clearTimeout(this.minuteur);
    if (this.autoLance && !this.fini) this.minuteur = setTimeout(() => this.montrerReprendre(), REPRENDRE.apparition * 1000);
  }
  // « Reprendre » : l'automatique repart du T de la position courante (tDe(scrollY)), sans saut ni retour en arrière
  reprendre() {
    this.mesurer();
    const y = this.yEcrans(), T = tDe(y);
    this.lancerAuto(T, y - yDe(T));
  }
  montrerReprendre() {
    const b = this.el.reprendre;
    if (!b || this.mode === 'auto' || this.fini) return;
    b.classList.remove('sort'); b.hidden = false;
  }
  cacherReprendre() {
    const b = this.el.reprendre;
    clearTimeout(this.minuteur);
    if (!b || b.hidden) return;
    b.classList.add('sort');
    this.minuteur = setTimeout(() => { b.hidden = true; b.classList.remove('sort'); }, REPRENDRE.effacement * 1000);
  }
  libererPiece() {
    const T = this.T;
    if (this.libere || T < GESTE8.debut || T >= GESTE8.silence[1]) return;
    this.libere = { T, p: performance.now() };
    if (this.mode === 'auto' && T < GESTE8.fin) { this.autoT0 = GESTE8.fin; this.autoP0 = performance.now(); }   // saut au début du silence
  }

  /* ---------- écouteurs : rendre la main, onglet caché, taille ---------- */
  ecouter() {
    const opt = { passive: true };
    this.ecouteurs = [];
    const on = (cible, nom, fn, o = opt) => { cible.addEventListener(nom, fn, o); this.ecouteurs.push(() => cible.removeEventListener(nom, fn, o)); };
    on(window, 'wheel', (e) => { if (Math.abs(e.deltaY) >= 3) this.rendreLaMain(); });
    on(window, 'keydown', (e) => {
      const t = e.target, tag = t && t.tagName;
      if (e.key === ' ' && (tag === 'BUTTON' || tag === 'SUMMARY' || tag === 'A' || tag === 'INPUT')) return;
      if ([' ', 'Tab', 'PageDown', 'PageUp', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) this.rendreLaMain();   // Tab aussi : le focus ne doit pas être emporté par le défilement
    });
    let toucher = null;
    on(window, 'touchstart', (e) => { const p = e.touches[0]; toucher = p ? { x: p.clientX, y: p.clientY, fait: false } : null; });
    on(window, 'touchmove', (e) => {
      const p = e.touches[0];
      if (!toucher || !p || toucher.fait) return;
      const dx = p.clientX - toucher.x, dy = p.clientY - toucher.y;
      if (Math.hypot(dx, dy) > 8) { toucher.fait = true; if (Math.atan2(Math.abs(dy), Math.abs(dx)) > 35 * Math.PI / 180) this.rendreLaMain(); }
    });
    // barre de défilement ou tout autre défilement qui ne vient pas de l'horloge
    on(window, 'scroll', () => {
      if (this.mode === 'auto' && this.derniereY !== null && Math.abs(scrollY - this.derniereY) > 6 && performance.now() - this.depart > 600) this.rendreLaMain();
    });
    if (this.el.reprendre) on(this.el.reprendre, 'click', () => this.reprendre(), {});
    on(document, 'visibilitychange', () => this.visibilite(), {});
    let tm = null;
    on(window, 'resize', () => {
      clearTimeout(tm);
      tm = setTimeout(() => {
        const w = innerWidth;
        this.mesurer();
        if (w !== this.largeurDecoupe) { this.largeurDecoupe = w; this.decouperTout(); }
        this.scene3d?.resize?.();
        this.donnerReserves();
        if (this.mode === 'fige') this.placer();
      }, 150);
    });
    this.largeurDecoupe = innerWidth;
    // le menu latéral ouvert pendant le mode automatique : on rend la main
    const mo = new MutationObserver(() => { if (document.body.classList.contains('drawer-open')) this.rendreLaMain(); });
    mo.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    this.ecouteurs.push(() => mo.disconnect());
    // scène hors de l'écran (le bloc du livre) : la 3D se met en pause
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((e) => { this.visible = e[e.length - 1].isIntersecting; this.scene3d?.setPaused?.(!this.visible); });
      io.observe(this.el.scene);
      this.ecouteurs.push(() => io.disconnect());
    }
  }
  visibilite() {
    if (document.hidden) {
      if (this.mode === 'auto') this.pause = { T: this.T, reprise: null };
      this.conduite?.suspendre?.();
    } else {
      this.conduite?.reprendre?.();
      if (this.pause) this.pause.reprise = performance.now() + 500;   // l'horloge repart 0,5 s après, du même T
    }
  }

  /* ---------- l'image ---------- */
  boucle(now) {
    this.raf = requestAnimationFrame(this.boucle);
    now = performance.now();
    const dt = this.pPrec === null ? 0 : Math.min(0.1, (now - this.pPrec) / 1000);
    let T, y;
    if (this.mode === 'fige') { T = this.tFige; y = yDe(T); }
    else if (this.mode === 'auto') {
      if (this.pause) {
        T = this.pause.T;
        if (this.pause.reprise !== null && now >= this.pause.reprise) { this.autoT0 = T; this.autoP0 = now; this.pause = null; }
      } else T = this.autoT0 + (now - this.autoP0) / 1000;
      if (T >= FIN) { T = FIN; this.fini = true; }
      y = yDe(T);
      if (this.decalage) {
        const k = clamp((now - this.decalage.p0) / 1200);
        y += this.decalage.d * (1 - ease.power2InOut(k));
        if (k >= 1) this.decalage = null;
      }
      this.allerA(y);
      if (this.fini) { this.mode = 'libre'; this.html.classList.remove('mode-auto'); this.cacherReprendre(); }
    } else if (this.mode === 'rejoint') {
      const k = clamp((now - this.rejoint.p0) / (RETOUR_SEUIL.duree * 1000));
      y = lerp(this.rejoint.y0, 0, ease.power2InOut(k));
      this.allerA(y);
      T = tDe(y);
      if (k >= 1) { this.rejoint = null; this.lancerAuto(0); T = 0; y = 0; }
    } else { y = this.yEcrans(); T = tDe(y); }
    this.T = T;

    // vitesse de défilement (écrans par seconde) ; en automatique, seulement les crans de la scène 3
    if (this.mode === 'auto' || this.mode === 'fige') {
      this.v = (T >= SCENES[3].t[0] && T < SCENES[3].t[1] && dt > 0) ? (yDe(T) - yDe(T - dt)) / dt : 0;
    } else if (dt > 0 && this.yPrec !== null) {
      this.v = lerp(this.v, (y - this.yPrec) / dt, 0.35);
    }
    this.yPrec = y; this.pPrec = now;

    // scène 8 : fenêtre du geste (temps réel en mode libre ; T − 57 en automatique) ; mémorisée tant que T ≥ 57
    if (T < GESTE8.debut) { this.t8 = 0; this.libere = null; this.gesteVu = false; }
    else if (T >= GESTE8.silence[1]) this.t8 = GESTE8.retraitSeul;
    else if (this.mode === 'auto' || this.mode === 'fige') this.t8 = Math.max(this.mode === 'fige' ? 0 : this.t8, clamp(T - GESTE8.debut, 0, GESTE8.retraitSeul));
    else this.t8 = Math.min(GESTE8.retraitSeul, this.t8 + dt);
    if (this.mode === 'fige') this.t8 = clamp(T - GESTE8.debut, 0, GESTE8.retraitSeul);

    // scènes 12 et 13 : frappes (k = max(k au toucher, k au défilement)) et vol vers la pastille, avant l'état
    this.y = y;
    this.frappesImage(y, now);
    this.volImage(y, now, dt);

    const etat = {
      mode: this.mode === 'auto' || this.mode === 'fige' ? 'auto' : 'libre',
      q3: clamp((y - SCENES[3].y[0]) / (SCENES[3].y[1] - SCENES[3].y[0])),
      vDefil: this.v,
      t8: this.t8,
      son: this.son,
      y,                                   // position en écrans
      frappes: this.kAff,                  // 0 à 3
      tFrappe: this.tFrappeP === null ? 1e6 : (now - this.tFrappeP) / 1000,
      vol: this.vol.u * VOL.duree >= VOL.depart,   // la scène cache sa pièce : la page la dessine en vol
    };
    this.etat = etat;
    // au-delà de 19,62 écrans, le canevas est mis en pause et masqué
    const horsScene = y > EPINGLE.canevas;
    if (horsScene !== this.horsScene) {
      this.horsScene = horsScene;
      this.scene3d?.setPaused?.(horsScene || !this.visible);
      const c = this.el.scene.querySelector('.talent-canvas');
      if (c) c.style.visibility = horsScene ? 'hidden' : '';
    }
    if (this.scene3d && this.visible && !horsScene) { try { this.scene3d.setTime(T, etat); } catch (e) { console.warn('scène :', e); this.scene3d = null; } }
    if (this.conduite) { try { this.conduite.setTime(T, etat); } catch (e) { console.warn('son :', e); this.conduite = null; } }
    this.rendu(T, now, y);
  }

  rendu(T, now, y = this.y ?? 0) {
    const H = this.H;
    this.html.classList.toggle('lot-terre', T >= LOTS.terre.t || this.yEcrans() >= LOTS.terre.ecrans);
    this.html.classList.toggle('lot-livre', T >= LOTS.livre.t || this.yEcrans() >= LOTS.livre.ecrans);   // la couverture n'est demandée qu'au lot 3

    /* la porte (scènes 0 à 2) */
    const ouverte = PORTE.fente.ouverte[this.large ? 2 : this.moyen ? 1 : 0];
    let w = PORTE.fente.avant;
    if (T >= PORTE.claque.t) w = lerp(ouverte, 0, ease.power2In(clamp((T - PORTE.claque.t) / PORTE.claque.duree)));
    else if (T > PORTE.fente.ouverture[0]) w = lerp(PORTE.fente.avant, ouverte, ease.power2InOut(clamp((T - PORTE.fente.ouverture[0]) / (PORTE.fente.ouverture[1] - PORTE.fente.ouverture[0]))));
    w = Math.round(w * 10) / 10;
    const halo = this.large ? 40 : this.moyen ? 32 : 24;   // retombée de la fente de chaque côté (24 / 32 / 40 px)
    if (w !== this.wFente || halo !== this.haloPx) {
      this.wFente = w; this.haloPx = halo;
      const f = this.el.fente;
      f.setAttribute('width', w); f.setAttribute('transform', `translate(${-w / 2} 0)`);
      const c = w / 2 + 1;   // chants : 2 px, collés à la fente
      this.el.chantG.setAttribute('transform', `translate(${-c} 0)`);
      this.el.chantD.setAttribute('transform', `translate(${c} 0)`);
      this.el.haloG.setAttribute('width', halo); this.el.haloD.setAttribute('width', halo);
      this.el.haloG.setAttribute('transform', `translate(${-(w / 2 + halo)} 0)`);
      this.el.haloD.setAttribute('transform', `translate(${w / 2} 0)`);
      const ferme = w < 0.5;
      const vif = ferme ? 0 : clamp(w / PORTE.fente.avant);   // chants et retombée s'éteignent avec la fente
      this.el.chantG.style.opacity = this.el.chantD.style.opacity = vif;
      this.el.haloG.style.opacity = this.el.haloD.style.opacity = vif;
      this.el.filet.style.opacity = ferme ? 1 : 0;
      // la flaque de lumière au sol : large comme la fente en haut, 0,55 de l'écran en bas (à pleine ouverture) ; s'éteint avec elle
      const k = 0.4 + 0.6 * clamp((w - PORTE.fente.avant) / (ouverte - PORTE.fente.avant));
      this.style(this.el.sol, '--fw', `${(w / 2).toFixed(2)}px`);
      this.style(this.el.sol, '--fb', `${(27.5 * k).toFixed(2)}%`);
    }
    // le cadre de la porte passe à 35 % en 1,2 s après la rupture (la porte fermée se devine)
    this.style(this.el.porte, '--cadre', Math.round((1 - 0.65 * clamp((T - PORTE.claque.t) / 1.2)) * 1000) / 1000);
    const oPorte = 1 - clamp((T - PORTE.effacement[0]) / (PORTE.effacement[1] - PORTE.effacement[0]));
    this.style(this.el.porte, 'opacity', oPorte);
    this.style(this.el.sol, 'opacity', Math.round(oPorte * clamp(w / PORTE.fente.avant) * 1000) / 1000);
    this.style(this.el.porte, 'visibility', oPorte <= 0 ? 'hidden' : 'visible');

    /* couverture du livre : demandée au repos dès T ≥ 30 ou 6 écrans (jamais pendant la scène 8) */
    if (!this.couvDemandee && (T >= COUVERTURE.t || this.yEcrans() >= COUVERTURE.ecrans)) {
      this.couvDemandee = true;
      const c = this.el.couv;
      if (c) (window.requestIdleCallback || ((f) => setTimeout(f, 200)))(() => { c.loading = 'eager'; const i = new Image(); i.decoding = 'async'; i.src = c.currentSrc || c.src; });
    }

    /* lot 4 (la suite) : l'image du vol (revers, puis avers) demandée au repos dès T ≥ 84 ou 15 écrans */
    if (!this.suiteDemandee && (T >= LOTS.suite.t || y >= LOTS.suite.ecrans)) {
      this.suiteDemandee = true;
      (window.requestIdleCallback || ((f) => setTimeout(f, 200)))(() => { for (const n of ['revers', 'avers']) { const i = new Image(); i.src = this.embleme(n); } });
    }

    /* anneau de focus du geste : un cercle de 2 px Or pâle autour de la pièce (diamètre + 16 px) */
    if (this.el.anneau && this.anneauActif) {
      const W = innerWidth, st = this.scene3d?.getState ? this.scene3d.getState() : null, p = st?.piece;
      const px = (v, ref) => (v <= 1.5 ? v * ref : v);
      const d = p && Number.isFinite(p.diametreEcran) ? px(p.diametreEcran, H) : (this.large ? 340 : this.moyen ? 280 : 200);
      const x = p && Number.isFinite(p.xEcran) ? px(p.xEcran, W) : W / 2;
      const y = p && Number.isFinite(p.yEcran) ? px(p.yEcran, H) : 0.63 * H;
      const D = Math.round(d + 16);
      const a = this.el.anneau;
      a.style.width = a.style.height = `${D}px`;
      a.style.left = `${Math.round(x - D / 2)}px`; a.style.top = `${Math.round(y - D / 2)}px`;
    }

    /* le bloc du seuil : présent avant le clic, sort de 0,4 à 1,0 */
    const ks = ease.power1InOut(clamp((T - TEXTES.titre.sortie) / SORTIE.duree));
    this.style(this.el.seuil, 'opacity', 1 - ks);
    this.style(this.el.seuil, 'transform', ks > 0 ? `translateY(${-SORTIE.montee * ks}px)` : '');
    this.el.seuil.classList.toggle('parti', ks >= 1);

    /* les phrases : une à la fois */
    for (const t of this.textes) {
      let sortie = t.sortie;
      let kReel = 0;
      if (t.cle === 'T8.1' && this.libere) {
        sortie = Math.min(sortie, this.libere.T);
        kReel = clamp((now - this.libere.p) / (SORTIE.duree * 1000));
      }
      const entre = T >= t.entree;
      let kSortie = Math.max(kReel, ease.power1InOut(clamp((T - sortie) / SORTIE.duree)));
      if (t.sortieY) kSortie = Math.max(kSortie, ease.power1InOut(clamp((y - t.sortieY[0]) / (t.sortieY[1] - t.sortieY[0]))));   // scène 12 a : menée par le défilement
      const o = entre ? (1 - kSortie) * (t.lignes.length ? 1 : ease.power1InOut(clamp((T - t.entree) / SORTIE.duree))) : 0;
      this.style(t.el, 'opacity', Math.round(o * 1000) / 1000);
      this.style(t.el, 'transform', kSortie > 0 && entre && !t.sansMontee ? `translateY(${(-SORTIE.montee * kSortie).toFixed(2)}px)` : '');
      t.lignes.forEach((li, i) => {
        const q = ease.expoOut(clamp((T - t.entree - i * ENTREE.ecartLignes) / ENTREE.duree));
        const v = q >= 1 ? 'none' : `translateY(${((1 - q) * 125).toFixed(2)}%)`;   // 125 % : la ligne attend hors du masque (marge de coupe comprise), aucune miette visible
        if (t.cache[i] !== v) { t.cache[i] = v; li.style.transform = v; }
        // PV8 : la ligne ne paraît qu'une fois entière dans son masque (q ≥ 0,75 : décalage ≤ 31 %, jambages compris), puis se fond jusqu'à q = 1
        if (t.fonduLignes) { const op = q >= 1 ? '' : clamp((q - 0.75) / 0.25).toFixed(3); if (li.style.opacity !== op) li.style.opacity = op; }
      });
    }

    /* couches datées : visibles pendant le fond, placées à la hauteur que donne la scène */
    const st = TEXTES.strates;
    const oSt = clamp((T - st.entree) / 0.3) * (1 - clamp((T - st.sortie) / SORTIE.duree));
    const etatScene = this.scene3d?.getState ? this.scene3d.getState() : null;
    const yStrate = (id, defaut) => {
      const s = etatScene?.strates?.find?.((x) => String(x.id) === id);
      if (!s || !Number.isFinite(s.yEcran)) return defaut * H;
      return s.yEcran <= 1.5 ? s.yEcran * H : s.yEcran;
    };
    const y25 = yStrate('2025', 0.33), y02 = yStrate('2002', 0.58);
    this.style(this.el.strates, 'opacity', oSt);
    this.el.strates.classList.toggle('cachees', oSt <= 0 && !this.el.strates.contains(document.activeElement));
    this.style(this.el.s2025, 'top', `${Math.round(y25 - 22)}px`);
    this.style(this.el.s2002, 'top', `${Math.round(y02 - 22)}px`);

    /* le repère de profondeur */
    this.repere(T, H, etatScene, y25, y02);

    /* scène 8 : l'indice (un point qui va et vient) si aucun geste à 59,0 ; la zone du geste */
    const indice = T >= GESTE8.indice && T < GESTE8.fin && !this.gesteVu && !this.libere;
    this.style(this.el.indice, 'opacity', indice ? 1 : 0);
    if (indice) {
      const ph = ((now / 1000) % 1.2) / 1.2;
      this.el.indicePoint.style.transform = `translateX(${(32 * ease.sineInOut(ph < 0.5 ? ph * 2 : 2 - ph * 2)).toFixed(1)}px)`;
    }
    const geste = T >= GESTE8.debut && T < GESTE8.silence[1];
    if (geste !== this.geste) {
      this.geste = geste;
      this.el.scene.classList.toggle('geste-actif', geste);
      const c = this.el.scene.querySelector('.talent-canvas');
      if (c) { c.tabIndex = geste ? 0 : -1; c.setAttribute('role', geste ? 'application' : 'img'); }   // « application » seulement pendant le geste (← → Entrée)
    }

    /* scènes 10 à 13 */
    this.finImage(T, y, now);
  }

  repere(T, H, etatScene, y25, y02) {
    const R = REPERE;
    let o = 0;
    if (T >= R.entree[0] && T < R.fin) {
      o = clamp((T - R.entree[0]) / (R.entree[1] - R.entree[0]));
      if (T >= R.attenue[0]) o = R.attenue[1];
      if (T >= R.remontee[0]) o = R.attenue[1] * (1 - clamp((T - R.remontee[0]) / (R.remontee[1] - R.remontee[0])));
    }
    this.style(this.el.repere, 'opacity', Math.round(o * 1000) / 1000);
    if (o <= 0) return;
    const bas = (this.large ? 0.86 : 0.87) * H;
    let haut;
    if (T < 38.0) {
      const surf = etatScene && Number.isFinite(etatScene.surfaceYEcran) ? (etatScene.surfaceYEcran <= 1.5 ? etatScene.surfaceYEcran * H : etatScene.surfaceYEcran) : null;
      haut = surf ?? (this.large ? 0.30 : 0.225) * H;
    } else if (T < 52.0) haut = 0.40 * H;
    else haut = 0.09 * H;
    // profondeur de la pièce : un tiers du trajet à chaque coup (0,5 s, power2In) ; au fond pendant les scènes 5 à 8
    let p = 0.08;
    R.coups.forEach((c) => { p += (1 - 0.08) / 3 * ease.power2In(clamp((T - c) / 0.5)); });
    if (T >= 38.0) p = 1;
    if (T >= R.remontee[0]) p = 1 - ease.power2InOut(clamp((T - R.remontee[0]) / (R.remontee[1] - R.remontee[0])));
    const yPoint = lerp(haut, bas, p);
    this.style(this.el.rFilet, 'top', `${Math.round(haut)}px`);
    this.style(this.el.rFilet, 'height', `${Math.round(bas - haut)}px`);
    this.style(this.el.rPoint, 'top', `${Math.round(yPoint)}px`);
    const tirets = T < 38.0;
    this.style(this.el.rT1, 'top', `${Math.round(y25)}px`); this.style(this.el.rT1, 'opacity', tirets ? 1 : 0);
    this.style(this.el.rT2, 'top', `${Math.round(y02)}px`); this.style(this.el.rT2, 'opacity', tirets ? 1 : 0);
    if (this.large) this.style(this.el.rTexte, '--repere-y', `${Math.round(yPoint)}px`);
    // la valeur : étiquette seule, puis 2025, 2002, quarante ans ; fondu enchaîné de 0,3 s ; effacée à 65,4
    let v = '';
    for (const x of R.valeurs) if (T >= x.t) v = x.v;
    if (T >= R.effaceValeur) v = '';
    if (v !== this.valeurVoulue) {
      this.valeurVoulue = v;
      const el = this.el.rV;
      el.classList.add('change');
      clearTimeout(this.minuteurValeur);
      this.minuteurValeur = setTimeout(() => { el.textContent = this.valeurVoulue; el.classList.remove('change'); }, R.fondu * 500);
    }
  }

  /* ================= Scènes 10 à 13 ================= */

  embleme(n) { return new URL(`../../assets/talent/embleme/talent-${n}.svg`, import.meta.url).href; }
  classe(el, nom, oui) {
    if (!el) return;
    const c = el.__classes || (el.__classes = {});
    if (c[nom] === oui) return;
    c[nom] = oui;
    el.classList.toggle(nom, oui);
  }
  // valeur de la scène : px si > 1,5, sinon fraction de ref (même convention que le repère et l'anneau)
  px(v, ref) { return v <= 1.5 ? v * ref : v; }
  etatScene() { try { return this.scene3d?.getState ? this.scene3d.getState() : null; } catch (e) { return null; } }

  // géométrie des portes (§ 2, tableau des places) ; posée en variables CSS sur le décor et sur la planche 11, et dans le SVG
  mesurerFin() {
    const W = innerWidth, H = this.H, c = this.large ? 2 : this.moyen ? 1 : 0;
    const g = PORTES.geo[c];
    let w, x1, x2;
    if (c === 0) { w = Math.min(220, (W - 2 * g.marge - g.ecart) / 2); x1 = (W - g.ecart) / 2 - w; x2 = (W + g.ecart) / 2; }
    else if (c === 1) { w = Math.min(g.l, (W - 88 - g.ecart) / 2); x1 = W / 2 - g.ecart / 2 - w; x2 = W / 2 + g.ecart / 2; }
    else { w = Math.min(g.l * H / 900, (W - g.ecart) / 2 - 40); x1 = W / 2 - g.ecart / 2 - w; x2 = W / 2 + g.ecart / 2; }
    const geo = { c, W, H, w, x1, x2, haut: g.haut * H, seuil: g.seuil * H, battant: PORTES.battant[c], bande: PORTES.bande[c], echelle: w / g.l };
    this.geo = geo;
    for (const e of [this.el.decor, this.el.cadre11]) {
      if (!e) continue;
      e.style.setProperty('--d1x', `${x1.toFixed(1)}px`); e.style.setProperty('--d2x', `${x2.toFixed(1)}px`); e.style.setProperty('--dw', `${w.toFixed(1)}px`);
      e.style.setProperty('--seuil', `${geo.seuil.toFixed(1)}px`); e.style.setProperty('--flou', `${(PORTES.flaque.fondu[c] / 3).toFixed(1)}px`);
    }
    // largeur de base de la couverture : celle de la scène 10 (repli du tableau) ; l'échelle uniforme fait le reste
    const E = this.empreinteRepli();
    this.couvBase = Math.round(E.d * COUV.lysEmpreinte.h / COUV.lys.h * 2 / 3);
    if (this.el.couv) this.el.couv.style.setProperty('--couv-l', `${this.couvBase}px`);
    this.construirePortes();
  }
  empreinteRepli() {
    const c = this.large ? 2 : this.moyen ? 1 : 0, r = COUV.empreinte[c];
    return { x: r.x * innerWidth, y: r.y * this.H, d: r.d * this.H / r.href };
  }
  // le lit de la pièce (getState().empreinte de la scène, sinon le tableau de la recette)
  empreinte(st) {
    const e = st?.empreinte;
    if (e && Number.isFinite(e.xEcran) && Number.isFinite(e.yEcran) && Number.isFinite(e.diametre) && e.diametre > 0) {
      return { x: this.px(e.xEcran, innerWidth), y: this.px(e.yEcran, this.H), d: this.px(e.diametre, this.H) };
    }
    return this.empreinteRepli();
  }
  // place de la couverture à la scène 10 : le centre du lys de la couverture sur le centre du lys de l'empreinte, même hauteur de lys
  rectScene10(E) {
    const h = E.d * COUV.lysEmpreinte.h / COUV.lys.h, w = h * 2 / 3;
    const yLys = E.y - E.d / 2 + COUV.lysEmpreinte.centre * E.d;
    return { x: E.x - COUV.lys.x * w, y: yLys - COUV.lys.y * h, w, h };
  }
  rectScene11() {
    const g = this.geo, r = COUV.porte[g.c], w = r.l * g.echelle, h = w * 1.5;
    return { x: g.x1 + g.w / 2 - w / 2, y: r.haut * this.H, w, h };
  }

  construirePortes() {
    const svg = this.el.svg, g = this.geo;
    if (!svg || !g) return;
    const h = g.seuil - g.haut, W = g.W, H = g.H;
    const m = PORTES.cadre.montant[g.c], L = PORTES.cadre.linteau[g.c];
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    // I1 c : linteau et montants Ardoise hors de l'ouverture (l'intérieur ne bouge pas), chant côté jour ;
    // battants en trapèze (perspective), hachures verticales Ardoise, chant libre. Le tracé part du seuil et monte (84,6 → 85,4).
    const porte = (x) => {
      const xd = x + g.w, xm = x + g.w / 2;
      return `<g class="p11-porte">
<g class="p11-int">
<rect x="${x}" y="${g.haut}" width="${g.w}" height="${h}" fill="url(#p11-rad)"/>
<rect x="${x}" y="${g.haut}" width="${g.w}" height="${h}" fill="url(#p11-haut)"/>
<rect x="${x}" y="${g.haut}" width="${g.w}" height="${h}" fill="url(#p11-or)"/>
<rect x="${x}" y="${g.seuil - g.bande}" width="${g.w}" height="${g.bande}" fill="url(#p11-bande)"/>
</g>
<polygon class="p11-b1" fill="url(#p11-bg)"/><polygon class="p11-b1" fill="url(#p11-hach)"/>
<polygon class="p11-b2" fill="url(#p11-bd)"/><polygon class="p11-b2" fill="url(#p11-hach)"/>
<rect class="p11-fente" x="${xm - 1.5}" y="${g.haut}" width="3" height="${h}" fill="#FFF3D6"/>
<line class="p11-c1" x1="0" x2="0" y1="${g.haut}" y2="${g.seuil}" stroke="#A8842F" stroke-opacity=".5"/>
<line class="p11-c2" x1="0" x2="0" y1="${g.haut}" y2="${g.seuil}" stroke="#A8842F" stroke-opacity=".5"/>
<line class="p11-o1" x1="0" x2="0" y1="${g.haut}" y2="${g.seuil}" stroke="#E8D48B" stroke-opacity=".5"/>
<line class="p11-o2" x1="0" x2="0" y1="${g.haut}" y2="${g.seuil}" stroke="#E8D48B" stroke-opacity=".5"/>
<path class="p11-mont" d="M${x - m / 2} ${g.seuil}V${g.haut - L}" pathLength="1" fill="none" stroke="#3A3842" stroke-width="${m}"/>
<path class="p11-mont" d="M${xd + m / 2} ${g.seuil}V${g.haut - L}" pathLength="1" fill="none" stroke="#3A3842" stroke-width="${m}"/>
<path class="p11-lint" d="M${x - m} ${g.haut - L / 2}H${xm}" pathLength="1" fill="none" stroke="#3A3842" stroke-width="${L}"/>
<path class="p11-lint" d="M${xd + m} ${g.haut - L / 2}H${xm}" pathLength="1" fill="none" stroke="#3A3842" stroke-width="${L}"/>
<path class="p11-chb" d="M${x - 0.5} ${g.seuil}V${g.haut - 0.5}H${xm}" pathLength="1" fill="none" stroke="#A8842F" stroke-opacity=".5"/>
<path class="p11-chb" d="M${xd + 0.5} ${g.seuil}V${g.haut - 0.5}H${xm}" pathLength="1" fill="none" stroke="#A8842F" stroke-opacity=".5"/>
<path class="p11-chp" d="M${x - 0.5} ${g.seuil}V${g.haut - 0.5}H${xm}" pathLength="1" fill="none" stroke="#E8D48B" stroke-opacity=".7"/>
<path class="p11-chp" d="M${xd + 0.5} ${g.seuil}V${g.haut - 0.5}H${xm}" pathLength="1" fill="none" stroke="#E8D48B" stroke-opacity=".7"/>
</g>`;
    };
    // I1 b : le sol gravé qui reçoit la lumière (lignes de 1 px Or bruni sous la ligne des seuils, pas de 5 px au seuil à 9 px à 0,16 h) ;
    // masque = les flaques (même trapèze, même décroissance en (1 − d/r)^1,5) à 60 %, 8 % hors des flaques
    const S = PORTES.sol, prof = PORTES.flaque.prof * H, ev = PORTES.flaque.evase;
    let lignes = '';
    for (let yl = g.seuil + S.pas[0]; yl < H; ) {
      const yy = Math.round(yl) + 0.5;
      lignes += `M0 ${yy}H${W}`;
      yl += S.pas[0] + (S.pas[1] - S.pas[0]) * clamp((yl - g.seuil) / prof);
    }
    const flaqueSol = (x) => {
      const e = (ev - 1) / 2 * g.w;
      return `<polygon points="${x},${g.seuil} ${x + g.w},${g.seuil} ${x + g.w + e},${g.seuil + prof} ${x - e},${g.seuil + prof}" fill="url(#p11-solg)"/>`;
    };
    const arret = (d) => `<stop offset="${d}" stop-color="#FFF3D6" stop-opacity="${(S.visible * Math.pow(1 - d, 1.5)).toFixed(3)}"/>`;
    // dégradés (§ 2, lumière de la scène 11) : Perle au cœur du seuil → Brume aux coins hauts ; Ardoise 30 % en haut ;
    // Or pâle 30 % au milieu du seuil (→ 0 à 0,75 de la largeur) ; bande Incandescence 70 % au ras du seuil ; battants Outrenoir, Ardoise côté gond
    const k = g.w / h;
    svg.innerHTML = `<defs>
<radialGradient id="p11-rad" cx=".5" cy="1" r="1.29"><stop offset="0" stop-color="#ECE8E2"/><stop offset=".87" stop-color="#D6D1CA"/><stop offset="1" stop-color="#D6D1CA"/></radialGradient>
<linearGradient id="p11-haut" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3A3842" stop-opacity=".3"/><stop offset=".5" stop-color="#3A3842" stop-opacity="0"/></linearGradient>
<radialGradient id="p11-or" cx=".5" cy="1" r=".75" gradientTransform="translate(.5 1) scale(1 ${k.toFixed(4)}) translate(-.5 -1)"><stop offset="0" stop-color="#E8D48B" stop-opacity=".3"/><stop offset=".5" stop-color="#E8D48B" stop-opacity=".1"/><stop offset="1" stop-color="#E8D48B" stop-opacity="0"/></radialGradient>
<linearGradient id="p11-bande" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#FFF3D6" stop-opacity=".7"/><stop offset=".5" stop-color="#FFF3D6" stop-opacity=".25"/><stop offset="1" stop-color="#FFF3D6" stop-opacity="0"/></linearGradient>
<linearGradient id="p11-bg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3A3842"/><stop offset="1" stop-color="#141218"/></linearGradient>
<linearGradient id="p11-bd" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#3A3842"/><stop offset="1" stop-color="#141218"/></linearGradient>
<pattern id="p11-hach" patternUnits="userSpaceOnUse" width="3" height="8"><rect x="1" width="1" height="8" fill="#3A3842" fill-opacity=".9"/></pattern>
<linearGradient id="p11-solg" x1="0" y1="0" x2="0" y2="1">${[0, 0.25, 0.5, 0.75, 1].map(arret).join('')}</linearGradient>
<filter id="p11-solf" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${(PORTES.flaque.fondu[g.c] / 3).toFixed(1)}"/></filter>
<mask id="p11-solm" mask-type="alpha" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#FFF3D6" fill-opacity="${S.hors}"/><g filter="url(#p11-solf)">${flaqueSol(g.x1)}${flaqueSol(g.x2)}</g></mask>
</defs><path class="p11-sol" d="${lignes}" stroke="#A8842F" stroke-width="1" fill="none" mask="url(#p11-solm)" opacity="0"/>${porte(g.x1)}${porte(g.x2)}`;
    this.p11 = [...svg.querySelectorAll('.p11-porte')].map((p) => ({
      g: p, int: p.querySelector('.p11-int'), b1: [...p.querySelectorAll('.p11-b1')], b2: [...p.querySelectorAll('.p11-b2')], fente: p.querySelector('.p11-fente'),
      c1: p.querySelector('.p11-c1'), c2: p.querySelector('.p11-c2'), o1: p.querySelector('.p11-o1'), o2: p.querySelector('.p11-o2'),
      monts: [...p.querySelectorAll('.p11-mont')], lints: [...p.querySelectorAll('.p11-lint')],
      chb: [...p.querySelectorAll('.p11-chb')], chp: [...p.querySelectorAll('.p11-chp')],
    }));
    this.p11Sol = svg.querySelector('.p11-sol');
    this.p11Cache = null;
  }

  // une image des scènes 10 à 13 (fonction de T, de y et des états de la page)
  finImage(T, y, now) {
    const g = this.geo, H = this.H, W = innerWidth;
    if (!g) return;
    const st = (T >= 73 || y >= 13.5) ? this.etatScene() : null;
    const pJour = clamp((y - JOUR.y[0]) / (JOUR.y[1] - JOUR.y[0]));
    const p = ease.power1InOut(pJour);

    /* la couverture : un seul <img>, translation + échelle uniforme + opacité (§ 2, § 7) */
    const c = this.el.couv;
    if (c) {
      let o = 0, r = null, dy = 0, kG = 0;
      if (T >= COUV.entree[0]) {
        const q = ease.expoOut(clamp((T - COUV.entree[0]) / (COUV.entree[1] - COUV.entree[0])));
        o = q; dy = (1 - q) * COUV.montee[g.c];
        let r10;
        if (T < SCENES[11].t[0]) { r10 = this.rectScene10(this.empreinte(st)); this.couv10 = r10; }
        else r10 = this.couv10 || this.rectScene10(this.empreinteRepli());
        kG = ease.power2InOut(clamp((T - COUV.glisse[0]) / (COUV.glisse[1] - COUV.glisse[0])));
        const r11 = this.rectScene11();
        r = kG > 0 ? { x: lerp(r10.x, r11.x, kG), y: lerp(r10.y, r11.y, kG), w: lerp(r10.w, r11.w, kG) } : r10;
        r.h = r.w * 1.5;
        o *= 1 - clamp((y - COUV.sortieY[0]) / (COUV.sortieY[1] - COUV.sortieY[0]));
      }
      o = Math.round(o * 1000) / 1000;
      this.style(c, 'opacity', o);
      this.style(c, 'visibility', o > 0 ? 'visible' : 'hidden');
      if (r && o > 0) this.style(c, 'transform', `translate(${r.x.toFixed(2)}px, ${(r.y + dy).toFixed(2)}px) scale(${(r.w / this.couvBase).toFixed(5)})`);
      // ombre de contact, sous le bord bas, sur le sol de la porte (jamais sur l'image)
      const om = this.el.ombre;
      if (om) {
        const oo = r ? Math.round(kG * kG * o * 1000) / 1000 : 0;
        this.style(om, 'opacity', oo);
        if (oo > 0) {
          const hh = COUV.ombre[g.c];
          this.style(om, 'width', `${(1.1 * r.w).toFixed(1)}px`); this.style(om, 'height', `${hh}px`);
          this.style(om, 'transform', `translate(${(r.x - 0.05 * r.w).toFixed(1)}px, ${(r.y + r.h - hh / 2).toFixed(1)}px)`);
        }
      }
    }

    /* la nuit, les portes, les flaques (scène 11) */
    const kTrace = ease.power2InOut(clamp((T - PORTES.trace[0]) / (PORTES.trace[1] - PORTES.trace[0])));
    const kOuv = ease.power2InOut(clamp((T - PORTES.ouverture[0]) / (PORTES.ouverture[1] - PORTES.ouverture[0])));
    const partJour = 1 - clamp(pJour / JOUR.cadres);   // cadres et battants : 1 → 0 entre p = 0 et 0,4
    this.style(this.el.vignette, 'opacity', Math.round(clamp((T - PORTES.nuit[0]) / (PORTES.nuit[1] - PORTES.nuit[0])) * (1 - p) * 1000) / 1000);
    const cle = `${kTrace.toFixed(3)}|${kOuv.toFixed(3)}|${partJour.toFixed(3)}`;
    if (this.p11 && cle !== this.p11Cache) {
      this.p11Cache = cle;
      const lw = lerp(g.w / 2 - 1.5, g.battant, kOuv);
      const fu = kOuv * PORTES.cadre.fuite * (g.seuil - g.haut);   // le chant libre s'éloigne : raccourci en haut et en bas (perspective)
      const m = PORTES.cadre.montant[g.c], L = PORTES.cadre.linteau[g.c], h = g.seuil - g.haut;
      const a = (h + L) / (h + L + g.w / 2 + m);                    // part du tracé prise par le montant, puis le linteau jusqu'au milieu
      const kM = clamp(kTrace / a), kL = clamp((kTrace - a) / (1 - a));
      const dash = (f, k) => { f.style.strokeDasharray = '1 1'; f.style.strokeDashoffset = (1 - k).toFixed(4); };
      [g.x1, g.x2].forEach((x, i) => {
        const d = this.p11[i];
        if (!d) return;
        d.g.style.opacity = kTrace > 0 ? partJour : 0;
        d.g.style.visibility = kTrace > 0 && partJour > 0 ? 'visible' : 'hidden';
        const xa = x + lw, xb = x + g.w - lw;
        const pts1 = `${x},${g.haut} ${xa.toFixed(2)},${(g.haut + fu).toFixed(2)} ${xa.toFixed(2)},${(g.seuil - fu).toFixed(2)} ${x},${g.seuil}`;
        const pts2 = `${x + g.w},${g.haut} ${xb.toFixed(2)},${(g.haut + fu).toFixed(2)} ${xb.toFixed(2)},${(g.seuil - fu).toFixed(2)} ${x + g.w},${g.seuil}`;
        d.b1.forEach((e) => { e.setAttribute('points', pts1); e.style.opacity = kTrace; });
        d.b2.forEach((e) => { e.setAttribute('points', pts2); e.style.opacity = kTrace; });
        d.fente.style.opacity = kTrace * (1 - kOuv);
        d.int.style.opacity = kTrace >= 1 ? 1 : 0;   // le jour n'est derrière les battants qu'une fois les portes tracées : il ne transparaît pas pendant le fondu des battants
        for (const [e, xx] of [[d.c1, xa], [d.o1, xa], [d.c2, xb], [d.o2, xb]]) {
          e.setAttribute('x1', xx.toFixed(2)); e.setAttribute('x2', xx.toFixed(2));
          e.setAttribute('y1', (g.haut + fu).toFixed(2)); e.setAttribute('y2', (g.seuil - fu).toFixed(2));
        }
        d.c1.style.opacity = d.c2.style.opacity = kTrace * (1 - kOuv);
        d.o1.style.opacity = d.o2.style.opacity = kOuv;
        d.monts.forEach((f) => dash(f, kM));
        d.lints.forEach((f) => dash(f, kL));
        d.chb.forEach((f) => { dash(f, kTrace); f.style.opacity = 1 - kOuv; });
        d.chp.forEach((f) => { dash(f, kTrace); f.style.opacity = kOuv; });
      });
    }
    const oFlaque = Math.round(kOuv * (1 - p) * 1000) / 1000;
    this.el.flaques.forEach((f) => this.style(f, 'opacity', oFlaque));
    if (this.p11Sol) this.style(this.p11Sol, 'opacity', Math.round(oFlaque * partJour * 1000) / 1000);   // le sol gravé ne se voit que dans la lumière

    /* le calque du jour (§ 3) : deux ellipses au milieu des seuils, bord chaud, puis la Nacre partout */
    const j = this.el.jour;
    if (j) {
      const oj = Math.round(clamp(pJour / 0.08) * 1000) / 1000;
      this.style(j, 'opacity', oj);
      this.style(j, 'visibility', oj > 0 ? 'visible' : 'hidden');
      this.classe(j, 'plein', pJour >= 1);
      if (oj > 0 && pJour < 1) {
        const a = (JOUR.demiAxe[0] + JOUR.demiAxe[1] * p) * g.w;
        const cx1 = g.x1 + g.w / 2, cx2 = g.x2 + g.w / 2, cy = g.seuil;
        const masque = (R, interieur) => [cx1, cx2].map((cx) => `radial-gradient(${R.toFixed(1)}px ${(JOUR.rapport * R).toFixed(1)}px at ${cx.toFixed(1)}px ${cy.toFixed(1)}px, black 0, black ${(interieur / R * 100).toFixed(2)}%, transparent 100%)`).join(', ');
        const poser = (el, m) => { this.style(el, 'maskImage', m); this.style(el, 'webkitMaskImage', m); };
        poser(this.el.jourNacre, masque(a + 0.03 * W, a));
        poser(this.el.jourInc, masque(a + JOUR.bande * W, a + 0.05 * W));
        poser(this.el.jourOr, masque(a + (JOUR.bande + JOUR.retombee) * W, a + JOUR.bande * W));
      }
    }
    // en-tête clair à p = 0,5 (fondu de 0,3 s, talent.css)
    this.classe(this.el.entete, 'on-light', p >= JOUR.entete);

    /* pastille (§ 6.1) : contour tant que « Acheter le tome 1 » des portes est visible ; logement vide sur la Nacre */
    const pa = this.el.pastille;
    this.classe(pa, 'contour', T >= PORTES.contour.t && y < PORTES.contour.y);
    this.classe(pa, 'vide', y >= FRAPPES.logement && this.vol.u < 1);

    /* scène 12 : invitation, groupes, repère, bouton de la pièce */
    const zone = y >= FRAPPES.invitation;
    const k = this.kAff;
    this.classe(this.el.t122, 'vu', zone && k === 0 && y >= FRAPPES.t122);
    this.classe(this.el.pv13, 'vu', zone && k === 0 && y >= FRAPPES.pv13);
    this.el.groupes.forEach((gr, i) => {
      const vu = zone && k === i + 1;
      this.classe(gr, 'vu', vu);
      const tab = vu && y < EPINGLE.fin;   // plus focalisables quand la scène quitte l'écran par le haut (liens cachés sous l'en-tête)
      if (gr.__lienVu !== tab) { gr.__lienVu = tab; this.liens12[i].forEach((a) => { if (tab) a.removeAttribute('tabindex'); else { a.setAttribute('tabindex', '-1'); if (document.activeElement === a) a.blur(); } }); }
    });
    // liens des portes (scène 11) : focalisables seulement une fois entièrement visibles, jusqu'à la sortie du texte (scène 12)
    const portesVues = T >= TEXTES['B11.2'].entree + 0.6 && y < TEXTES['B11.1'].sortieY[0];
    if (this.portesVues !== portesVues) {
      this.portesVues = portesVues;
      this.liensPortes.forEach((a) => {
        if (portesVues) a.removeAttribute('tabindex'); else { a.setAttribute('tabindex', '-1'); if (document.activeElement === a) a.blur(); }
      });
    }
    this.classe(this.el.repere12, 'vu', zone);
    this.classe(this.el.repere12, 'fin', y >= VOL.y);
    if (this.el.repere12 && this.repereK !== k) {
      this.repereK = k;
      [...this.el.repere12.children].forEach((s, i) => s.classList.toggle('faite', i < k));
      if (this.el.faites) this.el.faites.textContent = ['', 'I', 'I · II', 'I · II · III'][k];
    }
    const b = this.el.frapper;
    if (b) {
      const actif = zone && y < VOL.y;
      this.classe(b, 'actif', actif);
      if (b.__actif !== actif) { b.__actif = actif; b.tabIndex = actif ? 0 : -1; }
      if (y >= JOUR.y[0]) {
        const P = this.piece12(st);
        const D = Math.max(FRAPPES.minimum, P.d + FRAPPES.marge);
        this.style(b, 'width', `${Math.round(D)}px`); this.style(b, 'height', `${Math.round(D)}px`);
        this.style(b, 'transform', `translate(${Math.round(P.x - D / 2)}px, ${Math.round(P.y - D / 2)}px)`);
      }
    }

    /* indice de suite : la page n'a pas bougé 2 s après la fin de l'horloge */
    if (this.fini && this.finP === null) this.finP = now;
    if (this.finP !== null && Math.abs(y - ECRANS) > 0.005) this.bougeApresFin = true;
    this.classe(this.el.indiceSuite, 'montre', this.finP !== null && !this.bougeApresFin && now - this.finP >= (PORTES.indice.t - FIN) * 1000);
  }

  // la pièce de la scène 12 (getState().piece, sinon le tableau de la recette)
  piece12(st) {
    const p = st?.piece, c = this.large ? 2 : this.moyen ? 1 : 0, r = FRAPPES.piece[c];
    if (p && Number.isFinite(p.xEcran) && Number.isFinite(p.yEcran)) {
      const d = Number.isFinite(p.diametreEcran) ? p.diametreEcran : p.diametre;
      if (Number.isFinite(d) && d > 0) return { x: this.px(p.xEcran, innerWidth), y: this.px(p.yEcran, this.H), d: this.px(d, this.H) };
    }
    return { x: r.x * innerWidth, y: r.y * this.H, d: r.d * (this.large ? this.H / 900 : 1) };
  }

  // k = max(k au toucher, k au défilement) ; franchir un seuil vers le bas déclenche la frappe (son, lumière) ; remonter : sans son
  frappesImage(y, now) {
    if (y < JOUR.y[0]) this.kT = 0;   // au-dessus de 16,50, les frappes au toucher s'effacent : la pièce revient à l'avers
    const s = FRAPPES.seuils;
    const kD = y >= s[2] ? 3 : y >= s[1] ? 2 : y >= s[0] ? 1 : 0;
    const k = Math.max(this.kT, kD);
    if (k > this.kAff) { this.kAff = k; this.coup(k, now); }
    else this.kAff = k;
  }
  coup(k, now) {
    this.tFrappeP = now; this.derniereFrappe = now;
    if (this.son) { try { this.conduite?.evenement?.('frappe', { k }); } catch (e) { /* son absent */ } }
    if (k >= 1 && k <= 3) this.annoncer(this.el.annonce?.dataset[`k${k}`]);
  }
  // activation du bouton de la pièce (clic, toucher relâché, Entrée, Espace) : la frappe suivante, 1,2 s au moins entre deux
  frapper() {
    const now = performance.now();
    if (!(this.y >= FRAPPES.invitation && this.y < VOL.y)) return;
    if (now - this.derniereFrappe < FRAPPES.ecart * 1000) return;
    if (this.kAff < 3) { this.kT = this.kAff + 1; this.frappesImage(this.y, now); }
    else this.coup(4, now);   // une activation de plus : le recul et un tintement très doux, sans changer de face
  }
  annoncer(texte) {
    const a = this.el.annonce;
    if (!a || !texte) return;
    a.textContent = '';
    setTimeout(() => { a.textContent = texte; }, 60);
  }

  // le vol de la pièce vers la pastille (§ 6.3), en temps réel, 0,9 s ; remonter le rejoue à l'envers
  volImage(y, now, dt) {
    const v = this.vol, img = this.el.volImg;
    const cible = y >= VOL.y ? 1 : 0;
    if (cible === 1 && v.u === 0 && v.cible === 0) {
      const st = this.etatScene(), P = this.piece12(st);
      v.P0 = { x: P.x, y: P.y }; v.D0 = P.d;
    }
    v.cible = cible;
    const u0 = v.u;
    v.u = clamp(v.u + (cible ? 1 : -1) * dt / VOL.duree);
    const pa = this.el.pastille;
    if (v.u >= 1 && u0 < 1) {   // arrivée : fondu enchaîné 0,12 s, battement, tintement, annonce PV31
      v.arrivee = now;
      this.classe(pa, 'arrivee', true);
      if (pa) { pa.classList.remove('bat'); void pa.offsetWidth; pa.classList.add('bat'); clearTimeout(this.minuteurBat); this.minuteurBat = setTimeout(() => pa.classList.remove('bat'), VOL.battement * 1000 + 50); }
      if (this.son) { try { this.conduite?.evenement?.('pastille'); } catch (e) { /* son absent */ } }
      this.annoncer(this.el.annonce?.dataset.pastille);
    }
    if (v.u < 1) { v.arrivee = null; this.classe(pa, 'arrivee', false); }
    if (!img) return;
    if (v.u <= 0 || !v.P0) { this.style(img, 'visibility', 'hidden'); this.style(img, 'opacity', 0); return; }
    const r = pa ? (this.el.icone || pa).getBoundingClientRect() : { left: innerWidth - 60, top: 30, width: 28, height: 28 };
    const P2 = { x: r.left + r.width / 2, y: r.top + r.height / 2 }, P0 = v.P0;
    const P1 = { x: P0.x + 0.6 * (P2.x - P0.x), y: Math.min(P0.y, P2.y) - VOL.montee * this.H };
    const e = ease.power2InOut(v.u), m = 1 - e;
    const x = m * m * P0.x + 2 * m * e * P1.x + e * e * P2.x;
    const yy = m * m * P0.y + 2 * m * e * P1.y + e * e * P2.y;
    const D = v.D0 * Math.pow(28 / v.D0, e);
    const sx = clamp(Math.abs(v.u - 0.5) / ((VOL.flip[1] - VOL.flip[0]) / 2));   // retournement en largeur entre u = 0,42 et 0,58
    const face = v.u < 0.5 ? 'revers' : 'avers';
    if (img.__face !== face) { img.__face = face; img.src = this.embleme(face); }
    let o = clamp(v.u * VOL.duree / VOL.depart);
    if (v.arrivee !== null) o = 1 - clamp((now - v.arrivee) / (VOL.fondu * 1000));
    const s = D / 150;
    this.style(img, 'visibility', o > 0 ? 'visible' : 'hidden');
    this.style(img, 'opacity', Math.round(o * 1000) / 1000);
    this.style(img, 'transform', `translate(${x.toFixed(1)}px, ${yy.toFixed(1)}px) scale(${(s * Math.max(0.001, sx)).toFixed(4)}, ${s.toFixed(4)}) translate(-75px, -75px)`);
  }

  style(el, prop, val) {
    if (!el) return;
    const c = el.__cache || (el.__cache = {});
    if (c[prop] === val) return;
    c[prop] = val;
    if (prop.startsWith('--')) el.style.setProperty(prop, val); else el.style[prop] = val;
  }

  detruire() {
    cancelAnimationFrame(this.raf);
    clearTimeout(this.minuteur); clearTimeout(this.minuteurValeur);
    this.ecouteurs.forEach((f) => f());
    this.html.classList.remove('mode-auto', 'lot-terre', 'lot-livre');
    for (const t of this.textes) { restaurer(t.el); t.el.removeAttribute('style'); }
    for (const e of Object.values(this.el)) if (e && e.removeAttribute) { e.removeAttribute('style'); e.__cache = null; }
    if (this.el.reprendre) this.el.reprendre.hidden = true;
    this.el.seuil?.classList.remove('parti');
    this.el.strates?.classList.remove('cachees');
    this.el.scene.classList.remove('geste-actif', 'anneau-actif');
    if (this.el.rV) this.el.rV.textContent = 'quarante ans';
    this.el.fente.setAttribute('width', 3); this.el.fente.setAttribute('transform', 'translate(-1.5 0)');
    this.el.chantG.setAttribute('transform', 'translate(-2.5 0)'); this.el.chantD.setAttribute('transform', 'translate(2.5 0)');
    this.el.haloG.setAttribute('transform', 'translate(-25.5 0)'); this.el.haloD.setAttribute('transform', 'translate(1.5 0)');
    this.el.haloG.setAttribute('width', 24); this.el.haloD.setAttribute('width', 24);
    this.el.haloG.removeAttribute('style'); this.el.haloD.removeAttribute('style');
    this.el.chantG.removeAttribute('style'); this.el.chantD.removeAttribute('style'); this.el.filet.removeAttribute('style');
    // scènes 10 à 13 : retour à l'état des planches
    for (const e of [this.el.t122, this.el.pv13, ...this.el.groupes, this.el.repere12]) e?.classList.remove('vu');
    this.el.frapper?.classList.remove('actif');
    this.el.jour?.classList.remove('plein');
    this.el.entete?.classList.remove('on-light');
    this.el.pastille?.classList.remove('vide', 'contour', 'arrivee', 'bat');
    this.el.indiceSuite?.classList.remove('montre');
    this.liens12.flat().forEach((a) => a.removeAttribute('tabindex'));
    this.liensPortes.forEach((a) => a.removeAttribute('tabindex'));
    this.portesVues = undefined;
    for (const e of [this.el.couv, this.el.ombre, this.el.volImg, this.el.cadre11, this.el.decor]) if (e) { e.removeAttribute('style'); e.__cache = null; }
    if (this.el.svg) this.el.svg.innerHTML = '';
  }
}
