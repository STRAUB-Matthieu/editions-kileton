/* ============================================
   ÉDITIONS KILETON — Accueil
   1. Défilement natif ; les animations suivent en douceur (GSAP ScrollTrigger)
   2. Ouverture : le vitrail 3D, chargé seulement si WebGL est disponible
   3. Manifeste : les mots s'écrivent à mesure qu'on lit
   4. Atelier : les livres pivotent vers le pointeur, la table prend
      l'ambiance du livre survolé
   Sans JS ou en mouvement réduit, tout le contenu reste lisible.
   ============================================ */

const root = document.documentElement;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;
const hasMotion = !reducedMotion && !!gsap && !!ScrollTrigger;

if (hasMotion) {
    gsap.registerPlugin(ScrollTrigger);
    root.classList.add('has-motion');
}

/* --- 1. Défilement : natif, il suit le doigt et le pavé tactile sans retard.
   Les animations liées au défilement sont adoucies par GSAP (scrub),
   jamais le défilement lui-même. --- */
const SMOOTH = 0.9;   // secondes de rattrapage des animations sur le défilement

/* --- En-tête : clair dès qu'on quitte la pièce sombre --- */
const header = document.querySelector('.site-header');
const hero = document.querySelector('.hv');

function updateHeader() {
    // Avec animation, la nacre envahit l'écran avant la fin de la section :
    // l'en-tête passe en clair dès que la lumière l'a recouvert
    const edge = hasMotion
        ? window.innerHeight * 0.55
        : hero.offsetTop + hero.offsetHeight - 80;
    header.classList.toggle('on-light', window.scrollY > edge);
}
window.addEventListener('scroll', updateHeader, { passive: true });
window.addEventListener('resize', updateHeader);
window.addEventListener('pageshow', updateHeader);
document.addEventListener('visibilitychange', updateHeader);
updateHeader();

/* L'ouverture suit le défilement, mesurée à chaque mouvement et non une fois
   pour toutes : Safari peut charger la page dans une fenêtre sans hauteur,
   puis l'afficher sans signaler de redimensionnement. Des déclencheurs calculés
   à ce moment-là croyaient l'ouverture déjà jouée (page blanche à l'arrivée). */
let vitrail = null;
const intro = { p: 0 };   // 0 : la pièce sombre ; 1 : la lumière a tout recouvert
const introCopy = hero.querySelectorAll('.hv-copy, .hv-hint');
const flood = hero.querySelector('.hv-flood');
const floodEase = hasMotion ? gsap.parseEase('power1.inOut') : null;

function clamp01(x) { return Math.min(Math.max(x, 0), 1); }

function introTarget() {
    const h = window.innerHeight || document.documentElement.clientHeight;
    if (h < 100) return 0;
    return clamp01(window.scrollY / (h * 0.9));
}

function renderIntro() {
    if (!hasMotion) return;
    const p = intro.p;
    // Le texte d'ouverture s'efface, puis la lumière inonde la page
    const c = clamp01(p / 0.39);
    introCopy.forEach(function (el) {
        el.style.opacity = (1 - c).toFixed(3);
        el.style.transform = 'translateY(' + (-30 * c).toFixed(1) + 'px)';
    });
    const r = floodEase(clamp01((p - 0.22) / 0.78)) * 165;
    flood.style.setProperty('--r', r.toFixed(2) + '%');
    // Au rayon nul, Safari peint le dégradé tout en nacre : la couche reste cachée
    flood.classList.toggle('is-on', r > 0.5);
    if (vitrail) vitrail.setProgress(p);
}

if (hasMotion) {
    const followIntro = function () {
        gsap.to(intro, { p: introTarget(), duration: SMOOTH, ease: 'power3.out', overwrite: true, onUpdate: renderIntro });
    };
    intro.p = introTarget();
    renderIntro();
    window.addEventListener('scroll', followIntro, { passive: true });
    window.addEventListener('resize', followIntro);
    window.addEventListener('load', followIntro);
    window.addEventListener('pageshow', followIntro);
    document.addEventListener('visibilitychange', followIntro);
}

/* --- 2. Le vitrail --- */
function webglAvailable() {
    try {
        const c = document.createElement('canvas');
        return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch (e) {
        return false;
    }
}

const canvas = hero.querySelector('.hv-canvas');
if (webglAvailable()) {
    import('./vitrail.js?v=3').then(function (m) {
        vitrail = m.initVitrail(canvas, { reducedMotion: reducedMotion });
        hero.classList.add('is-live');
        renderIntro();
    }).catch(function () {
        hero.classList.add('no-webgl');
    });
} else {
    hero.classList.add('no-webgl');
}

/* Safari peut précharger la page en arrière-plan, fenêtre sans hauteur :
   les déclencheurs sont recalculés dès qu'elle s'affiche vraiment */
if (hasMotion) {
    window.addEventListener('pageshow', function () { ScrollTrigger.refresh(); });
    document.addEventListener('visibilitychange', function () {
        if (!document.hidden) ScrollTrigger.refresh();
    });
}

/* --- 3. Le manifeste --- */
function splitWords(el) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
        const frag = document.createDocumentFragment();
        node.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) {
                frag.appendChild(document.createTextNode(part));
            } else {
                const span = document.createElement('span');
                span.className = 'w';
                span.textContent = part;
                frag.appendChild(span);
            }
        });
        node.parentNode.replaceChild(frag, node);
    });
    return el.querySelectorAll('.w');
}

if (hasMotion) {
    document.querySelectorAll('.mf-text p').forEach(function (p) {
        const words = splitWords(p);
        gsap.fromTo(words, { opacity: 0.2 }, {
            opacity: 1,
            ease: 'none',
            stagger: 0.08,
            scrollTrigger: { trigger: p, start: 'top 90%', end: 'bottom 55%', scrub: SMOOTH }
        });
    });

    gsap.utils.toArray('.at-item').forEach(function (item, i) {
        gsap.from(item, {
            y: 36,
            opacity: 0,
            duration: 1.8,
            delay: i * 0.22,
            ease: 'power2.out',
            scrollTrigger: { trigger: '.at-books', start: 'top 85%', once: true }
        });
    });
}

/* --- 4. L'atelier --- */
const table = document.querySelector('.at-table');
document.querySelectorAll('.at-book').forEach(function (book) {
    const bk = book.querySelector('.bk');

    function enter() { table.dataset.ambiance = book.dataset.ambiance; }
    function leave() {
        table.dataset.ambiance = 'maison';
        bk.style.removeProperty('--rx');
        bk.style.removeProperty('--ry');
        book.classList.remove('is-held');
    }

    book.addEventListener('pointerenter', enter);
    book.addEventListener('focus', enter);
    book.addEventListener('pointerleave', leave);
    book.addEventListener('blur', leave);

    if (!reducedMotion) {
        book.addEventListener('pointermove', function (e) {
            if (e.pointerType !== 'mouse') return;
            const r = bk.getBoundingClientRect();
            const x = (e.clientX - r.left) / r.width - 0.5;
            const y = (e.clientY - r.top) / r.height - 0.5;
            book.classList.add('is-held');
            bk.style.setProperty('--ry', (x * 38).toFixed(1) + 'deg');
            bk.style.setProperty('--rx', (-y * 12).toFixed(1) + 'deg');
        });
    }
});
