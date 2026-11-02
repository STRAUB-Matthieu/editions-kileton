/* ============================================
   ÉDITIONS KILETON — Accueil
   1. Défilement fluide (Lenis) synchronisé avec GSAP ScrollTrigger
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

/* --- 1. Défilement fluide --- */
let lenis = null;
if (hasMotion && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.11 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);

    // Le menu latéral verrouille la page : on suspend le défilement fluide
    new MutationObserver(function () {
        if (document.body.classList.contains('drawer-open')) lenis.stop(); else lenis.start();
    }).observe(document.body, { attributes: true, attributeFilter: ['class'] });

    // Ancres internes : défilement doux jusqu'à la section
    document.querySelectorAll('a[href^="#"]').forEach(function (link) {
        link.addEventListener('click', function (e) {
            const target = document.querySelector(link.getAttribute('href'));
            if (!target) return;
            e.preventDefault();
            lenis.scrollTo(target, { offset: -40, duration: 1.4 });
        });
    });
}

/* --- En-tête : clair dès qu'on quitte la pièce sombre --- */
const header = document.querySelector('.site-header');
const hero = document.querySelector('.hv');

function updateHeader() {
    // Avec animation, la nacre envahit l'écran avant la fin de la section :
    // l'en-tête passe en clair dès que la lumière l'a recouvert
    const edge = hasMotion
        ? window.innerHeight * 0.42
        : hero.offsetTop + hero.offsetHeight - 80;
    header.classList.toggle('on-light', window.scrollY > edge);
}
window.addEventListener('scroll', updateHeader, { passive: true });
window.addEventListener('resize', updateHeader);
updateHeader();

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
    import('./vitrail.js').then(function (m) {
        const vitrail = m.initVitrail(canvas, { reducedMotion: reducedMotion });
        hero.classList.add('is-live');
        if (hasMotion) {
            ScrollTrigger.create({
                start: 0,
                end: function () { return window.innerHeight * 0.52; },
                scrub: true,
                onUpdate: function (self) { vitrail.setProgress(self.progress); }
            });
        }
    }).catch(function () {
        hero.classList.add('no-webgl');
    });
} else {
    hero.classList.add('no-webgl');
}

if (hasMotion) {
    // Le texte d'ouverture s'efface, puis la lumière inonde la page
    gsap.to('.hv-copy, .hv-hint', {
        opacity: 0,
        y: -50,
        ease: 'none',
        scrollTrigger: { start: 0, end: function () { return window.innerHeight * 0.15; }, scrub: true }
    });
    gsap.fromTo('.hv-flood', { '--r': '0%' }, {
        '--r': '165%',
        ease: 'power2.in',
        scrollTrigger: {
            start: function () { return window.innerHeight * 0.14; },
            end: function () { return window.innerHeight * 0.52; },
            scrub: true
        }
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
            scrollTrigger: { trigger: p, start: 'top 85%', end: 'bottom 68%', scrub: true }
        });
    });

    gsap.utils.toArray('.at-item').forEach(function (item, i) {
        gsap.from(item, {
            y: 70,
            opacity: 0,
            duration: 1.1,
            delay: i * 0.12,
            ease: 'expo.out',
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
