/* ============================================
   ÉDITIONS KILETON — La France des talents, tome 1
   1. La frise gravée : chaque parole est taillée lettre après lettre,
      dorée, puis la frise glisse jusqu'à la suivante ; le titre clôt la frise
   2. L'appel : les mots apparaissent, la couverture suit le pointeur
   La frise suit la position de défilement mesurée à chaque mouvement :
   Safari peut charger une page dans une fenêtre sans hauteur.
   Sans WebGL, sans JS ou en mouvement réduit, tout le contenu reste lisible.
   ============================================ */

import { initFrise } from './frise.js';

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

function clamp01(x) { return Math.min(Math.max(x, 0), 1); }
function smooth(e0, e1, x) {
    const t = clamp01((x - e0) / (e1 - e0));
    return t * t * (3 - 2 * t);
}

/* --- 1. La frise gravée --- */
const section = document.querySelector('.fr');
let frise = null;
const panels = section ? Array.prototype.map.call(section.querySelectorAll('[data-engrave]'), function (el) {
    return { text: el.dataset.engrave, cite: el.dataset.cite || '', title: el.hasAttribute('data-title') };
}) : [];

if (hasMotion && section) {
    try {
        frise = initFrise(section.querySelector('.fr-canvas'), panels);
        section.classList.add('fr-live');
    } catch (e) {
        frise = null;   // pas de WebGL : les paroles restent en colonne
    }
}
if (!frise) root.classList.remove('fr-wait');

if (frise) {
    const last = panels.length - 1;
    const title = section.querySelector('.fr-title');
    const hint = section.querySelector('.fr-hint');
    const prog = { p: 0 };

    function target() {
        const h = window.innerHeight || document.documentElement.clientHeight;
        const r = section.getBoundingClientRect();
        const run = r.height - h;
        if (h < 100 || run <= 0) return 0;
        return clamp01(-r.top / run);
    }

    // Chaque plaque : le ciseau, puis l'or, un temps de lecture, et la frise glisse
    function render() {
        const u = prog.p * panels.length;
        const i = Math.min(Math.floor(u), last);
        const t = clamp01(u - i);
        frise.set({
            panel: i,
            carve: smooth(0.03, 0.5, t),
            gold: smooth(0.5, 0.66, t),
            shift: i < last ? smooth(0.8, 1, t) : 0
        });
        const o = i === last ? smooth(0.58, 0.78, t) : 0;
        title.style.opacity = o.toFixed(3);
        title.style.visibility = o < 0.01 ? 'hidden' : 'visible';
        hint.style.opacity = (1 - smooth(0.0, 0.04, prog.p)).toFixed(3);
    }

    const follow = function () {
        gsap.to(prog, { p: target(), duration: SMOOTH, ease: 'power3.out', overwrite: true, onUpdate: render });
    };
    prog.p = target();
    render();
    window.addEventListener('scroll', follow, { passive: true });
    window.addEventListener('resize', follow);
    window.addEventListener('load', follow);
    window.addEventListener('pageshow', follow);
    document.addEventListener('visibilitychange', follow);
}

/* --- 2. L'appel --- */
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
// les déclencheurs de l'appel sont recalculés dès qu'elle s'affiche vraiment
if (hasMotion) {
    window.addEventListener('load', function () { ScrollTrigger.refresh(); });
    window.addEventListener('pageshow', function () { ScrollTrigger.refresh(); });
    document.addEventListener('visibilitychange', function () {
        if (!document.hidden) ScrollTrigger.refresh();
    });
}
