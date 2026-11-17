// Page « La France des talents » : « Le troisième serviteur », scènes 0 à 13 (v2). Script d'entrée (lot 0).
// Trois modes (animé, libre, planches), planches gravées, lots de chargement.
// Avant tout geste, rien de lourd : ni Three.js, ni son, ni GSAP. Le lot 1 (palier, horloge, son, scène) part au clic
// « Commencer », au premier défilement de 0,3 écran, ou au repos après « load » (1,5 s au plus).
// Version animée seulement aux paliers « haut » et « moyen » ; sinon (et en mouvement réduit, sans WebGL) : les planches,
// où « Commencer, avec le son » joue les sons de la planche visible. ?t=<s> fige l'horloge (captures, jusqu'à 92) ;
// ?y=<écrans> place la page en mode libre (partie libre, scènes 12 et 13) ; ?palier=haut|moyen|bas force le palier (essais).
window.__talentPret = true;

const html = document.documentElement;
const $ = (s) => document.querySelector(s);
const url = (c) => new URL(c, import.meta.url).href;
const params = new URLSearchParams(location.search);
const tFige = params.has('t') ? parseFloat(params.get('t').replace(',', '.')) : null;
const yFige = params.has('y') ? parseFloat(params.get('y').replace(',', '.')) : null;
const palierForce = params.get('palier');
const PLANCHES_T = [0, 9.0, 13.0, 24.0, 37.0, 41.0, 47.0, 56.0, 62.0, 70.0, 82.0, 90.0, 92.0];   // table.js, PLANCHES (sans l'importer au lot 0)

let horloge = null, scene = null, canvas = null, conduite = null, lot1 = null, sonP = null;
let sonActif = false, coupe = false, planchesSon = null;
window.__talent = { get horloge() { return horloge; }, get scene() { return scene; }, get conduite() { return conduite; } };   // pour les essais

/* ---------- en-tête : clair sur la Nacre (planche 12, chapitres, scène 13, pied de page) ----------
   Version animée : c'est l'horloge qui le décide (p = 0,5 du passage au jour). Planches : quand le haut de l'écran est sur la Nacre. */
(function enteteSurJour() {
  const entete = $('.site-header');
  const zones = ['.planche-12', '.chapitres', '.suite', '.site-footer'].map((q) => $(q)).filter(Boolean);
  if (!entete || !zones.length || !('IntersectionObserver' in window)) return;
  let io = null;
  const dedans = new Set();
  const observer = () => {
    io?.disconnect(); dedans.clear();
    io = new IntersectionObserver((e) => {
      e.forEach((x) => (x.isIntersecting ? dedans.add(x.target) : dedans.delete(x.target)));
      if (!html.classList.contains('talent-anime')) entete.classList.toggle('on-light', dedans.size > 0);
    }, { rootMargin: `0px 0px -${Math.max(0, innerHeight - 72)}px 0px` });
    zones.forEach((z) => io.observe(z));
  };
  observer();
  addEventListener('resize', observer, { passive: true });
})();

/* ---------- « Partager » (scène 13, P18a) : navigator.share avec le texte P19, sinon copie du lien ---------- */
// Sans JavaScript le bouton ne ferait rien : il reste caché (hidden) jusqu'ici.
$('.suite-partage')?.removeAttribute('hidden');
const LIBELLE_PARTAGE = 'Lien copié';   // libellé du bouton pendant 2 s, et annonce (aria-live)
let minuteurPartage = null;
function lienCopie(bouton) {
  const etat = $('.partage-etat');
  if (bouton.dataset.libelle === undefined) bouton.dataset.libelle = bouton.textContent;
  bouton.style.minWidth = `${bouton.offsetWidth}px`;
  bouton.textContent = LIBELLE_PARTAGE;
  if (etat) etat.textContent = LIBELLE_PARTAGE;
  clearTimeout(minuteurPartage);
  minuteurPartage = setTimeout(() => {
    bouton.textContent = bouton.dataset.libelle; bouton.style.minWidth = '';
    if (etat) etat.textContent = '';
  }, 2000);
}
$('.partager')?.addEventListener('click', async (e) => {
  const bouton = e.currentTarget;
  const texte = bouton.dataset.partage || '';
  const lien = 'https://editions-kileton.fr/france-des-talents.html';
  try {
    if (navigator.share) { await navigator.share({ text: texte, url: lien }); return; }
  } catch (err) { if (err && err.name === 'AbortError') return; }
  try { await navigator.clipboard?.writeText(`${texte} ${lien}`); lienCopie(bouton); } catch (err) { /* copie refusée : rien */ }
});

/* ---------- le son (conduite sonore) : chargé au lot 1, démarré dans un clic ---------- */
function chargerSon() {
  sonP ??= import(url('./son/conduite.js'))
    .then((m) => { conduite = m.creerConduite(); horloge?.attacherSon(conduite); return conduite; })
    .catch((e) => { console.info('Son absent (doublure) :', e.message); return null; });
  return sonP;
}
const boutonSon = $('.son');
function majBoutonSon() {
  const on = sonActif && !coupe;
  boutonSon?.setAttribute('aria-pressed', on ? 'true' : 'false');
  if (horloge) horloge.son = on;
}
// À appeler dans un clic : si la conduite est déjà là, demarrer() part dans le geste même (AudioContext autorisé).
function demarrerSon() {
  const go = (c) => { if (!c) return; if (!c.actif?.()) c.demarrer?.()?.catch?.(() => {}); c.couper?.(false); };
  if (conduite) go(conduite); else chargerSon().then(go);
  sonActif = true; coupe = false; majBoutonSon();
}
boutonSon?.addEventListener('click', () => {
  if (!sonActif) {                       // avant tout départ : le son, à la position courante, sans lancer l'horloge
    demarrerSon();
    if (!html.classList.contains('talent-anime')) jouerPlanches();
    return;
  }
  coupe = !coupe;
  conduite?.couper?.(coupe);
  majBoutonSon();
});

/* ---------- version animée ---------- */
function lancerLot1() {
  lot1 ??= (async () => {
    chargerSon();
    let palier = palierForce;
    if (!palier) {
      try { palier = await (await import(url('./scene/palier.js'))).choisirPalier(); } catch (e) { palier = 'bas'; }
    }
    if (palier !== 'haut' && palier !== 'moyen') { revenirPlanches(); return null; }
    const { Horloge } = await import(url('./horloge.js'));
    horloge = new Horloge({ tFige, yFige });
    horloge.son = sonActif && !coupe;
    if (conduite) horloge.attacherSon(conduite);
    chargerScene(palier);
    return horloge;
  })().catch((e) => { console.warn('Version animée abandonnée :', e); revenirPlanches(); return null; });
  return lot1;
}

async function chargerScene(palier) {
  try {
    const m = await import(url('./scene/index.js'));
    canvas = document.createElement('canvas');
    canvas.className = 'talent-canvas';
    canvas.tabIndex = -1;
    canvas.setAttribute('role', 'img');   // devient « application » pendant le geste (horloge.js)
    canvas.setAttribute('aria-label', 'Frottez la terre pour dégager la pièce, ou appuyez sur Entrée. Sans geste, elle se retire seule.');
    $('.scene-fixe').insertBefore(canvas, $('.planche-8'));
    const s = await m.createTalentScene(canvas, { tier: palier, assetsBase: url('../../assets/talent/'), reducedMotion: false });
    if (!s || typeof s.setTime !== 'function') {     // module d'une autre version de l'interface : on continue sans la scène
      try { s?.destroy?.(); } catch (e) { /* rien */ }
      canvas.remove(); canvas = null;
      console.info('Scène 3D absente ou sans setTime : la page continue sans elle (doublure).');
      return;
    }
    scene = s;
    // anneau de focus du geste : cercle autour de la pièce, dessiné par l'horloge, tant que le canevas a le focus clavier
    canvas.addEventListener('focus', () => horloge?.anneau(canvas.matches(':focus-visible')));
    canvas.addEventListener('blur', () => horloge?.anneau(false));
    // la chaîne du bloom (palier haut) est chargée tout de suite, pas pendant la scène 8
    if (palier === 'haut') ['EffectComposer', 'RenderPass', 'UnrealBloomPass', 'OutputPass'].forEach((n) => import(url(`../vendor/three-addons/postprocessing/${n}.js`)).catch(() => {}));
    scene.on?.('tierchange', (e) => { if (e && (e.tier === 'bas' || e.vers === 'bas')) revenirPlanches(); });
    horloge?.attacherScene(scene);
  } catch (e) {
    canvas?.remove(); canvas = null;
    console.info('Scène 3D absente (doublure) :', e.message);
  }
}

function revenirPlanches() {
  try { horloge?.detruire(); } catch (e) { /* déjà détruite */ }
  try { scene?.destroy?.(); } catch (e) { /* idem */ }
  canvas?.remove();
  horloge = scene = canvas = null;
  html.classList.remove('talent-anime', 'mode-auto', 'lot-terre', 'lot-livre');
  if (sonActif) jouerPlanches();
}

const commencer = $('.commencer');
commencer?.addEventListener('click', () => {
  demarrerSon();
  if (!html.classList.contains('talent-anime')) { jouerPlanches(); return; }
  lancerLot1().then((h) => h?.commencer());
});

if (html.classList.contains('talent-anime')) {
  if ((tFige !== null && Number.isFinite(tFige)) || (yFige !== null && Number.isFinite(yFige))) lancerLot1();
  else {
    const apresLoad = () => setTimeout(() => ('requestIdleCallback' in window ? requestIdleCallback(lancerLot1, { timeout: 1500 }) : lancerLot1()), 0);
    document.readyState === 'complete' ? apresLoad() : addEventListener('load', apresLoad, { once: true });
    const defile = () => { if (scrollY >= 0.3 * innerHeight) { removeEventListener('scroll', defile); lancerLot1(); } };
    addEventListener('scroll', defile, { passive: true });
  }
}

/* ---------- planches (mouvement réduit, sans WebGL, palier bas) : les sons de la planche visible ---------- */
function jouerPlanches() {
  if (planchesSon) return;
  const planches = [...document.querySelectorAll('.planche')];
  const parts = new Map();
  planchesSon = { n: 0 };
  const io = new IntersectionObserver((e) => {
    e.forEach((x) => parts.set(x.target, x.intersectionRatio));
    let best = 0, n = 0;
    planches.forEach((p, i) => { const r = parts.get(p) || 0; if (r > best) { best = r; n = i; } });
    planchesSon.n = n;
  }, { threshold: [0, 0.25, 0.5, 0.75, 1] });
  planches.forEach((p) => io.observe(p));
  const tic = () => {
    const n = planchesSon.n, T = PLANCHES_T[n];
    conduite?.setTime?.(T, { mode: 'libre', q3: n > 3 ? 1 : n === 3 ? 0.5 : 0, vDefil: 0, t8: n >= 8 ? 6 : 0, son: sonActif && !coupe });
    requestAnimationFrame(tic);
  };
  requestAnimationFrame(tic);
}

// en version planches, Cormorant (versets, paroles, chapitres : jamais au premier écran) n'est demandée qu'après « load »
if (document.readyState === 'complete') html.classList.add('polices-tardives');
else addEventListener('load', () => html.classList.add('polices-tardives'), { once: true });
