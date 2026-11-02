/* ============================================
   ÉDITIONS KILETON — La Verticale du Vide
   1. Ouverture : le puits de la couverture en WebGL ; on y tombe en défilant
   2. Le fil vertical : 88 étages jusqu'au Voile
   3. La tour se trace, la passerelle se fend et tombe
   4. Le cœur bat trois fois, puis plus rien
   5. Le Voile : des fils de lumière qui s'écartent
   6. La fissure par où la lumière entre
   Défilement natif ; les animations suivent en douceur (scrub).
   Sans JS ou en mouvement réduit, tout le contenu reste lisible.
   ============================================ */

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

/* --- 1. Le puits --- */
const VERT = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }';

// Coordonnées de tunnel : l'angle donne la façade, l'inverse du rayon la profondeur.
// Les façades se tordent en spirale vers le centre, où tourne la lumière.
const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uDepth;
uniform float uGlow;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
    float m = min(uRes.x, uRes.y);
    vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / m;
    uv.y += 0.06 * uRes.y / m;
    float r = length(uv);
    float a = atan(uv.y, uv.x);

    // Façades
    float z = 0.32 / max(r, 1e-3) + uDepth;
    float tw = a + 0.55 * log(1.0 + 1.0 / (r * 4.0 + 0.2)) + uTime * 0.035;
    float seg = 8.0;
    float u = tw / 6.2831853 * seg;
    float id = mod(floor(u), seg);
    float fu = fract(u);
    float h = hash(vec2(id, 7.0));
    float fz = z * (5.0 + floor(h * 3.0)) + h * 10.0;
    float row = floor(fz);
    float fr = fract(fz);
    float cl = floor(fu * 4.0);
    float fc = fract(fu * 4.0);
    float win = smoothstep(0.16, 0.26, fc) * smoothstep(0.84, 0.74, fc)
              * smoothstep(0.2, 0.32, fr) * smoothstep(0.86, 0.74, fr);
    float lit = step(0.86, hash(vec2(id * 13.0 + cl, row)));
    float gw = 0.03 + 0.05 * h;
    float gap = smoothstep(0.0, gw, fu) * smoothstep(1.0, 1.0 - gw, fu);

    float light = exp(-r * 2.6);
    vec3 nuit = vec3(0.039, 0.086, 0.157);
    vec3 vortex = vec3(0.243, 0.431, 0.62);
    vec3 pierre = vec3(0.6, 0.58, 0.54);
    vec3 gold = vec3(0.91, 0.83, 0.55);
    vec3 inc = vec3(1.0, 0.953, 0.84);

    // Pierre patinée : sombre près de nous, éclairée vers le fond du puits
    float grain = 0.82 + 0.18 * hash(vec2(floor(fz * 3.0), floor(fu * 23.0) + id));
    vec3 wall = mix(nuit * 0.7, mix(vortex * 0.42, pierre, light), smoothstep(0.0, 0.9, light * 1.5)) * grain;
    wall *= 0.68 + 0.32 * smoothstep(0.0, 0.12, fr);
    vec3 glass = mix(nuit * 0.9, vortex * 0.55, 0.35 + 0.35 * sin(row * 1.7 + id)) * (0.6 + 0.6 * light);
    vec3 warm = vec3(0.95, 0.72, 0.42) * (0.45 + 0.55 * light);
    float pane = win * (1.0 - 0.25 * step(0.5, fract(fc * 2.0 + 0.5)) * step(0.48, fr) * step(fr, 0.52));
    vec3 facade = mix(wall, mix(glass, warm, lit), pane);
    facade *= 0.08 + 0.92 * gap;
    // Brume froide sur les façades les plus proches
    facade = mix(facade, nuit * 0.6, smoothstep(0.55, 1.2, r) * 0.55);

    // Le tourbillon de lumière, large comme sur la couverture
    float lr = log(r + 1e-3);
    float rings = 0.5 + 0.5 * sin((lr * 5.0 - a) * 2.0 + uTime * 0.45);
    float streak = 0.5 + 0.5 * sin(a * 9.0 + lr * 14.0 - uTime * 0.6);
    float core = exp(-r * (4.4 - uGlow * 3.8));
    vec3 vort = mix(gold * 0.55, inc, rings * 0.55 + streak * 0.3) * (0.35 + core * 1.25);

    float detail = smoothstep(0.12, 0.48, r) * (1.0 - uGlow * 0.6);
    vec3 col = mix(vort, facade, detail);
    col += gold * core * 0.5;
    col *= mix(1.0, smoothstep(1.35, 0.3, r), 0.75);
    col += (hash(gl_FragCoord.xy + fract(uTime)) - 0.5) * 0.03;
    gl_FragColor = vec4(col, 1.0);
}`;

function initTunnel(canvas) {
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });
    if (!gl) return null;

    function compile(type, src) {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    }
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return null;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, 'uRes');
    const uTime = gl.getUniformLocation(prog, 'uTime');
    const uDepth = gl.getUniformLocation(prog, 'uDepth');
    const uGlow = gl.getUniformLocation(prog, 'uGlow');

    const state = { depth: 0, glow: 0 };
    const scale = Math.min(window.devicePixelRatio || 1, isCoarse ? 1.25 : 1.5) * (isCoarse ? 0.8 : 1);

    function resize() {
        const w = Math.round(canvas.clientWidth * scale);
        const h = Math.round(canvas.clientHeight * scale);
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
            gl.viewport(0, 0, w, h);
        }
    }

    let visible = true;
    let raf = 0;
    const t0 = performance.now();

    function frame(now) {
        raf = 0;
        if (!visible) return;
        resize();
        const t = reducedMotion ? 4 : (now - t0) / 1000;
        gl.uniform2f(uRes, canvas.width, canvas.height);
        gl.uniform1f(uTime, t);
        // On tombe toujours un peu, et davantage en défilant
        gl.uniform1f(uDepth, state.depth + (reducedMotion ? 0 : t * 0.045));
        gl.uniform1f(uGlow, state.glow);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        if (!reducedMotion) raf = requestAnimationFrame(frame);
    }

    new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible && !raf) raf = requestAnimationFrame(frame);
    }).observe(canvas);

    window.addEventListener('resize', function () {
        if (reducedMotion && visible) requestAnimationFrame(frame);
    });

    raf = requestAnimationFrame(frame);
    return state;
}

const open = document.querySelector('.lv-open');
const tunnel = initTunnel(open.querySelector('.lv-tunnel'));
if (tunnel) open.classList.add('is-live');

if (hasMotion) {
    const copy = open.querySelector('.lv-open-copy');
    const tl = gsap.timeline({
        scrollTrigger: { trigger: open, start: 'top top', end: 'bottom bottom', scrub: SMOOTH }
    });
    if (tunnel) {
        tl.to(tunnel, { depth: 7, ease: 'none', duration: 1 }, 0)
          .to(tunnel, { glow: 1, ease: 'power2.in', duration: 0.75 }, 0.25);
    }
    tl.to(copy, { y: -60, opacity: 0, ease: 'power1.in', duration: 0.3 }, 0)
      .to('.lv-hint', { opacity: 0, duration: 0.1 }, 0)
      .to('.lv-flood', { opacity: 1, ease: 'power2.in', duration: 0.3 }, 0.68);
}

/* --- 2. Le fil vertical --- */
if (hasMotion) {
    const gauge = document.querySelector('.lv-gauge');
    const num = gauge.querySelector('.lv-gauge-num');
    const unit = gauge.querySelector('.lv-gauge-unit');
    const fill = gauge.querySelector('.lv-gauge-fill');

    ScrollTrigger.create({
        trigger: '.lv-book',
        start: 'top 40%',
        endTrigger: '.site-footer',
        end: 'top bottom',
        toggleClass: { targets: gauge, className: 'is-on' }
    });

    ScrollTrigger.create({
        start: 0,
        end: 'max',
        onUpdate: function (self) { fill.style.transform = 'scaleY(' + self.progress.toFixed(4) + ')'; }
    });

    // 88 étages de la couverture du livre jusqu'au Voile
    ScrollTrigger.create({
        trigger: '.lv-book',
        start: 'top top',
        endTrigger: '.lv-veil',
        end: 'top 30%',
        onUpdate: function (self) {
            const floor = Math.round(88 * (1 - self.progress));
            if (self.progress >= 1) {
                num.textContent = '0';
                unit.textContent = 'Voile';
            } else {
                num.textContent = String(floor);
                unit.textContent = 'étage';
            }
        }
    });
}

/* --- 3. La tour, la brisure --- */
if (hasMotion) {
    const svg = document.querySelector('.lv-tower-svg');
    const lines = svg.querySelectorAll('.lv-tower-lines .bp');
    const bridge = svg.querySelectorAll('.lv-bridge .bp');

    gsap.timeline({
        scrollTrigger: { trigger: '[data-step="tower"]', start: 'top 85%', end: 'bottom 55%', scrub: SMOOTH }
    })
        .to(lines, { strokeDashoffset: 0, ease: 'none', duration: 0.8, stagger: { each: 0.02, from: 'end' } }, 0)
        .to(bridge, { strokeDashoffset: 0, ease: 'none', duration: 0.3 }, 0.6)
        .to(svg.querySelectorAll('.bp-dim:not(.lv-tower-lines .bp)'), { strokeDashoffset: 0, duration: 0.3 }, 0.7)
        .to(svg.querySelectorAll('.bp-label'), { opacity: 1, duration: 0.3 }, 0.75);

    gsap.timeline({
        scrollTrigger: { trigger: '[data-step="break"]', start: 'top 70%', end: 'bottom 50%', scrub: SMOOTH }
    })
        .to(svg.querySelectorAll('.crack'), { strokeDashoffset: 0, duration: 0.3, stagger: 0.05 }, 0)
        .to('.lv-span-a', { rotation: 38, y: 520, x: -30, opacity: 0, ease: 'power2.in', duration: 0.7 }, 0.4)
        .to('.lv-span-b', { rotation: -46, y: 560, x: 24, opacity: 0, ease: 'power2.in', duration: 0.7 }, 0.45)
        .to(svg.querySelectorAll('.crack'), { opacity: 0, duration: 0.2 }, 0.45)
        .to(svg.querySelectorAll('.bp-label'), { opacity: 0.25, duration: 0.3 }, 0.6);
}

/* --- 4. Le pouls --- */
if (hasMotion) {
    const pulse = document.querySelector('.lv-pulse');
    gsap.set('.lv-ecg-line', { strokeDasharray: 1, strokeDashoffset: 1 });
    gsap.set('.lv-flat', { opacity: 0, y: 20 });
    gsap.timeline({
        scrollTrigger: {
            trigger: pulse,
            start: 'top 80%',
            end: 'bottom 75%',
            scrub: SMOOTH,
            onUpdate: function (self) { pulse.classList.toggle('is-flat', self.progress > 0.62); }
        }
    })
        .to('.lv-ecg-line', { strokeDashoffset: 0, ease: 'none', duration: 0.65 }, 0)
        .to('.lv-flat', { opacity: 1, y: 0, duration: 0.25 }, 0.7);
}

/* --- 5. Le Voile --- */
function initThreads(canvas, state) {
    const ctx = canvas.getContext('2d');
    let w = 0;
    let h = 0;
    let dpr = 1;
    let visible = false;
    let raf = 0;

    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        w = canvas.clientWidth;
        h = canvas.clientHeight;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
    }

    function draw(now) {
        raf = 0;
        if (!visible) return;
        const t = reducedMotion ? 0 : now / 1000;
        const cx = w / 2;
        const gapX = isCoarse ? 11 : 8;
        const n = Math.min(220, Math.ceil(w / gapX));
        const open = state.open;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        ctx.lineWidth = 1;
        for (let i = 0; i <= n; i++) {
            const x0 = (i / n) * w;
            const d = x0 - cx;
            const near = Math.exp(-Math.abs(d) / (w * 0.22));
            const amp = 6 + 10 * near;
            // Le Voile s'écarte depuis le centre, plus au milieu qu'aux bords
            const push = open * Math.sign(d || 1) * w * 0.42 * Math.exp(-Math.abs(d) / (w * 0.3));
            ctx.strokeStyle = 'rgba(232, 212, 139, ' + (0.07 + 0.3 * near * (1 - open * 0.5)).toFixed(3) + ')';
            ctx.beginPath();
            for (let y = -20; y <= h + 20; y += 22) {
                const k = Math.sin(Math.PI * Math.min(Math.max(y / h, 0), 1));
                const x = x0 + Math.sin(y * 0.006 + t * 0.55 + i * 0.37) * amp + push * (0.35 + 0.65 * k);
                if (y === -20) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
        if (!reducedMotion) raf = requestAnimationFrame(draw);
    }

    function kick() {
        if (visible && !raf) raf = requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener('resize', function () { resize(); kick(); });
    new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        kick();
    }).observe(canvas);
    return kick;
}

const veil = document.querySelector('.lv-veil');
const veilState = { open: hasMotion ? 0 : 0.6 };
const redrawVeil = initThreads(veil.querySelector('.lv-threads'), veilState);

if (hasMotion) {
    gsap.set(['.lv-veil-text .lv-num', '.lv-veil-line'], { opacity: 0, y: 24 });
    gsap.set('.lv-question', { opacity: 0, y: 30 });
    gsap.timeline({
        scrollTrigger: { trigger: veil, start: 'top top', end: 'bottom bottom', scrub: SMOOTH }
    })
        .to(['.lv-veil-text .lv-num', '.lv-veil-line'], { opacity: 1, y: 0, duration: 0.15, stagger: 0.04 }, 0.05)
        .to(veilState, { open: 1, ease: 'power2.inOut', duration: 0.5, onUpdate: redrawVeil }, 0.3)
        .to('.lv-veil-glow', { opacity: 1, ease: 'power1.in', duration: 0.5 }, 0.3)
        .to('.lv-question', { opacity: 1, y: 0, duration: 0.15 }, 0.62)
        .to({}, { duration: 0.15 });
}

/* --- 6. La fissure --- */
if (hasMotion) {
    gsap.timeline({
        scrollTrigger: { trigger: '.lv-fissure', start: 'top 85%', end: 'bottom 45%', scrub: SMOOTH }
    })
        .fromTo('.lv-crack', { scaleX: 0.06, scaleY: 0.6, opacity: 0.4 }, { scaleX: 1, scaleY: 1, opacity: 1, ease: 'power2.out', duration: 1 }, 0)
        .fromTo('.lv-fissure-glow', { opacity: 0.1, scaleX: 0.3 }, { opacity: 1, scaleX: 1, ease: 'power1.in', duration: 1 }, 0);

    // Les mots apparaissent à mesure qu'on lit
    gsap.utils.toArray('.lv-reveal').forEach(function (el) {
        gsap.from(el, {
            opacity: 0,
            y: 34,
            duration: 1.6,
            ease: 'power2.out',
            scrollTrigger: { trigger: el, start: 'top 88%', once: true }
        });
    });

    gsap.from('.lv-choice-text', {
        opacity: 0,
        letterSpacing: '0.3em',
        duration: 2.2,
        ease: 'power2.out',
        scrollTrigger: { trigger: '.lv-choice-word', start: 'top 80%', once: true }
    });
    gsap.from('.lv-rule', {
        scaleX: 0,
        duration: 1.8,
        ease: 'power2.out',
        scrollTrigger: { trigger: '.lv-choice-word', start: 'top 80%', once: true }
    });
}

/* --- La couverture suit le pointeur --- */
const cover = document.querySelector('.lv-cover');
if (cover && !reducedMotion && !isCoarse) {
    const tilt = cover.querySelector('.lv-cover-tilt');
    cover.addEventListener('pointermove', function (e) {
        const r = cover.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        tilt.style.transform = 'rotateY(' + (-9 + x * 14).toFixed(2) + 'deg) rotateX(' + (2 - y * 10).toFixed(2) + 'deg)';
    });
    cover.addEventListener('pointerleave', function () { tilt.style.transform = ''; });
}

if (hasMotion) {
    window.addEventListener('load', function () { ScrollTrigger.refresh(); });
}
