/* ============================================
   ÉDITIONS KILETON — La France des talents, tome 1
   1. Le talent enfoui : on creuse, la lumière le dégage, il devient le lys
   2. Pierre après pierre : les sept paroles tombent en place
   3. L'appel : les mots apparaissent, la couverture suit le pointeur
   Défilement natif ; les animations suivent en douceur (scrub).
   Sans WebGL, sans JS ou en mouvement réduit, tout le contenu reste lisible.
   ============================================ */

import { initScene } from './scene.js';

const root = document.documentElement;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isCoarse = window.matchMedia('(pointer: coarse)').matches;
const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;
const hasMotion = !reducedMotion && !!gsap && !!ScrollTrigger;

if (hasMotion) {
    gsap.registerPlugin(ScrollTrigger);
    root.classList.add('has-motion');
}

const SMOOTH = 0.9;   // secondes de rattrapage des animations sur le défilement

function smooth(e0, e1, x) {
    const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
    return t * t * (3 - 2 * t);
}

/* --- 1. Le talent enfoui --- */
const hero = document.querySelector('.ta');
let scene = null;
if (hasMotion && hero) {
    try {
        scene = initScene(hero.querySelector('.ta-canvas'));
        hero.classList.add('ta-live');
    } catch (e) {
        scene = null;   // pas de WebGL : l'ouverture simple reste en place
    }
}

if (scene) {
    const S = scene.state;
    const portrait = function () { return window.innerWidth < window.innerHeight; };

    // Où pousse le lys : à gauche sur un écran large, en haut sur un téléphone
    function layout() {
        S.lysX = portrait() ? 0 : -0.42;
        S.lysY = portrait() ? 0.02 : -0.42;
        S.lysScale = 1;
        scene.resize();
    }
    layout();
    ScrollTrigger.addEventListener('refreshInit', layout);

    // Le talent dort à 1,9 sous la surface ; creuser fait remonter la terre et lui avec
    S.dig = -0.15;
    S.coinUvY = -2.05;

    const lines = Array.prototype.map.call(hero.querySelectorAll('.ta-line'), function (el) {
        return { el: el, a: parseFloat(el.dataset.in), b: parseFloat(el.dataset.out) };
    });
    const EDGE = 0.035;
    function paint(p) {
        lines.forEach(function (l) {
            const o = (l.a <= 0 ? 1 : smooth(l.a, l.a + EDGE, p)) * (1 - smooth(l.b - EDGE, l.b, p));
            const dy = (1 - o) * (p < l.a + EDGE ? 18 : -18);
            l.el.style.opacity = o.toFixed(3);
            l.el.style.visibility = o < 0.01 ? 'hidden' : 'visible';
            l.el.style.translate = '0 ' + dy.toFixed(1) + 'px';
        });
    }

    const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom bottom', scrub: SMOOTH, invalidateOnRefresh: true },
        onUpdate: function () { paint(tl.progress()); }
    });
    tl.to(S, { dig: 1.5, coinUvY: -0.4, duration: 0.28 }, 0)
        // Un temps d'arrêt : le talent est là, on peut le faire tourner
        .to(S, { open: 1, duration: 0.18, ease: 'power1.in' }, 0.37)
        .to(S, { coinUvY: 0.04, coinScale: 0.8, duration: 0.15, ease: 'power2.inOut' }, 0.4)
        .to(S, { fade: 1, duration: 0.08 }, 0.55)
        // Le talent devient la graine du lys
        .to(S, {
            coinX: function () { return S.lysX; },
            coinUvY: function () { return S.lysY; },
            coinScale: 0.22,
            duration: 0.07,
            ease: 'power2.inOut'
        }, 0.6)
        .to(S, { coinFade: 0, duration: 0.04 }, 0.66)
        .to(S, { grow: 1, duration: 0.26 }, 0.63)
        .to(S, { bloom: 1, duration: 0.08, ease: 'power2.out' }, 0.86)
        .set({}, {}, 1);
    paint(0);
}

/* --- 2. Pierre après pierre --- */
const stones = Array.prototype.slice.call(document.querySelectorAll('.ps-stone'));
const reading = document.getElementById('ps-reading');

stones.forEach(function (btn) {
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('click', function () {
        stones.forEach(function (b) { b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'); });
        const q = document.createElement('blockquote');
        const p = document.createElement('p');
        p.textContent = btn.dataset.full;
        const c = document.createElement('cite');
        c.textContent = btn.dataset.ref;
        q.append(p, c);
        const note = document.createElement('p');
        note.className = 'ps-comment';
        note.textContent = btn.dataset.comment;
        reading.replaceChildren(q, note);
        if (hasMotion) gsap.from(reading.children, { opacity: 0, y: 12, duration: 0.6, stagger: 0.08, ease: 'power2.out' });
    });
});

if (hasMotion && stones.length) {
    // Les pierres tombent l'une après l'autre, de la base à la clef de voûte
    gsap.timeline({
        scrollTrigger: { trigger: '.ps-wall', start: 'top 88%', end: 'top 30%', scrub: SMOOTH }
    }).fromTo(stones, {
        y: function (i) { return -window.innerHeight * (0.35 + i * 0.03); },
        rotation: function (i) { return (i % 2 ? 1 : -1) * (4 + i); },
        opacity: 0
    }, {
        y: 0,
        rotation: 0,
        opacity: 1,
        ease: 'power2.in',
        duration: 1,
        stagger: 0.35
    });
}

/* --- 3. L'appel --- */
if (hasMotion) {
    gsap.utils.toArray('.ft-reveal').forEach(function (el) {
        gsap.from(el, {
            opacity: 0,
            y: 34,
            duration: 1.4,
            ease: 'power2.out',
            scrollTrigger: { trigger: el, start: 'top 88%', once: true }
        });
    });
}

const cover = document.querySelector('.ap-cover');
if (cover && !reducedMotion && !isCoarse) {
    const tilt = cover.querySelector('.ap-cover-tilt');
    cover.addEventListener('pointermove', function (e) {
        const r = cover.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        tilt.style.transform = 'rotateY(' + (-7 + x * 14).toFixed(2) + 'deg) rotateX(' + (2 - y * 10).toFixed(2) + 'deg)';
    });
    cover.addEventListener('pointerleave', function () { tilt.style.transform = ''; });
}

// Safari peut précharger la page en arrière-plan, fenêtre sans hauteur :
// les déclencheurs sont recalculés dès qu'elle s'affiche vraiment
if (hasMotion) {
    window.addEventListener('load', function () { ScrollTrigger.refresh(); });
    window.addEventListener('pageshow', function () { ScrollTrigger.refresh(); });
    document.addEventListener('visibilitychange', function () {
        if (!document.hidden) ScrollTrigger.refresh();
    });
}
