/* ============================================
   LA FRANCE DES TALENTS — la scène du talent enfoui
   Une coupe de terre gravée (shader plein écran), un talent d'or en 3D,
   puis trois faisceaux de fibres bleu, blanc, rouge qui se tressent
   et s'ouvrent en fleur de lys.
   initScene(canvas) renvoie { state, resize } ;
   l'état est piloté par le défilement depuis talents.js.
   ============================================ */

import * as THREE from '../vendor/three.module.min.js';

const isCoarse = window.matchMedia('(pointer: coarse)').matches;

/* ---------- La terre : coupe stratigraphique gravée ---------- */
const EARTH_VERT = 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }';

const EARTH_FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uDig;
uniform float uOpen;
uniform float uFade;
uniform vec2 uCav;
uniform float uCavR;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + 1.0), f.x), f.y);
}
float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
    return v;
}

void main() {
    float m = min(uRes.x, uRes.y);
    vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / m;
    float px = 1.0 / m;

    vec3 nacre = vec3(0.969, 0.961, 0.945);
    vec3 encre = vec3(0.227, 0.22, 0.259);
    vec3 incand = vec3(1.0, 0.953, 0.84);
    vec3 gold = vec3(0.83, 0.686, 0.216);

    // On creuse : la terre remonte à l'écran
    float y = uv.y - uDig;
    float surf = 0.3 + 0.012 * sin(uv.x * 3.0) + 0.02 * (fbm(vec2(uv.x * 3.0, 1.7)) - 0.5);
    float d = surf - y;

    vec3 col = nacre;
    if (d > 0.0) {
        float f = d * 4.2 + (fbm(vec2(uv.x * 1.1, d * 1.6)) - 0.5) * 1.1;
        float band = floor(f);
        float t = fract(f);
        float hb = hash(vec2(band, 3.1));

        vec3 c1 = vec3(0.925, 0.91, 0.886);
        vec3 c2 = vec3(0.89, 0.824, 0.702);
        vec3 c3 = vec3(0.76, 0.67, 0.52);
        vec3 c4 = vec3(0.5, 0.42, 0.33);
        vec3 c5 = vec3(0.27, 0.23, 0.2);
        float deep = clamp(d / 3.0, 0.0, 1.0);
        vec3 base = mix(c1, c2, smoothstep(0.0, 0.25, deep));
        base = mix(base, c3, smoothstep(0.2, 0.5, deep));
        base = mix(base, c4, smoothstep(0.45, 0.8, deep));
        base = mix(base, c5, smoothstep(0.8, 1.0, deep));
        base *= 0.9 + 0.18 * hb;

        // Gravure : hachures dont l'épaisseur suit la valeur
        float dark = 1.0 - dot(base, vec3(0.333));
        float dir = hb > 0.5 ? 1.0 : -1.0;
        float freq = 55.0 + 45.0 * hash(vec2(band, 9.0));
        float hl = abs(fract((uv.x * dir * 0.7 + d) * freq) - 0.5);
        float w = 0.06 + dark * 0.32;
        float aa = px * freq * 1.5;
        float line = 1.0 - smoothstep(w, w + aa, hl);
        base = mix(base, base * 0.62, line * (0.35 + 0.4 * dark));

        // Cailloux dans certaines couches
        if (hb > 0.7) {
            vec2 g = vec2(uv.x, d) * 7.0;
            vec2 gi = floor(g), gf = fract(g);
            float md = 1.0, mr = 0.0, mk = 0.0;
            for (int j = -1; j <= 1; j++)
            for (int i = -1; i <= 1; i++) {
                vec2 n = vec2(float(i), float(j));
                float k = hash(gi + n + 13.0);
                if (k < 0.55) continue;
                vec2 o = vec2(hash(gi + n), hash(gi + n + 7.0));
                vec2 q = (n + o - gf) * vec2(1.0, 1.35 + 0.5 * k);
                float rr = 0.1 + 0.16 * hash(gi + n + 3.0);
                float dd = length(q) - rr * (0.9 + 0.12 * sin(atan(q.y, q.x) * 3.0 + k * 9.0));
                if (dd < md) { md = dd; mk = k; }
            }
            float stone = 1.0 - smoothstep(-0.01, 0.01, md);
            float rim = 1.0 - smoothstep(0.0, 0.025, abs(md));
            base = mix(base, base * (1.04 + 0.12 * mk), stone * 0.85);
            base = mix(base, encre, rim * 0.4);
        }

        // Limite des couches, d'un trait d'encre
        base = mix(base, encre, (1.0 - smoothstep(0.0, 0.035, t)) * 0.45);
        // La surface du sol
        base = mix(base, encre, (1.0 - smoothstep(0.0, 0.012, d)) * 0.8);

        // La cavité où dort le talent
        vec2 cv = (uv - uCav) / vec2(uCavR * 1.35, uCavR * 0.85);
        float cav = length(cv);
        vec3 hollow = mix(c5 * 0.55, c4 * 0.7, smoothstep(0.2, 1.0, cv.y * 0.5 + 0.5));
        base = mix(base, hollow, 1.0 - smoothstep(0.96, 1.02, cav));
        base = mix(base, encre, (1.0 - smoothstep(0.0, 0.05, abs(cav - 1.0))) * 0.6);

        col = base;
    }

    // La fissure : la lumière descend jusqu'au talent
    if (uOpen > 0.0 && uv.y > uCav.y) {
        float h = uv.y - uCav.y;
        float cx = uCav.x + (fbm(vec2(uv.y * 5.0, 2.3)) - 0.5) * 0.12 + (noise(vec2(uv.y * 30.0, 4.0)) - 0.5) * 0.015;
        float wd = uOpen * (0.025 + h * 0.05);
        float dx = abs(uv.x - cx);
        float light = 1.0 - smoothstep(wd * 0.6, wd + px * 2.0, dx);
        col = mix(col, incand, light);
        col += gold * exp(-dx / (wd + 0.03)) * uOpen * 0.35;
    }

    // La clarté envahit tout, depuis le talent
    float r = length(uv - uCav);
    col = mix(col, nacre, 1.0 - smoothstep(uFade * 2.4 - 0.35, uFade * 2.4, r));

    col += (hash(gl_FragCoord.xy) - 0.5) * 0.035;
    gl_FragColor = vec4(col, 1.0);
}`;

/* ---------- Le talent : relief gravé dessiné sur un canevas ---------- */
function coinFaceTexture() {
    const S = 1024;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    const C = S / 2;
    // Hauteur : clair = relief, sombre = creux
    g.fillStyle = '#7a7a7a';
    g.fillRect(0, 0, S, S);
    g.strokeStyle = '#d8d8d8';
    g.lineWidth = 14;
    g.beginPath(); g.arc(C, C, S * 0.47, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 4;
    g.beginPath(); g.arc(C, C, S * 0.4, 0, Math.PI * 2); g.stroke();
    // Grènetis
    g.fillStyle = '#d0d0d0';
    for (let i = 0; i < 96; i++) {
        const a = (i / 96) * Math.PI * 2;
        g.beginPath();
        g.arc(C + Math.cos(a) * S * 0.44, C + Math.sin(a) * S * 0.44, 5, 0, Math.PI * 2);
        g.fill();
    }
    // Légende circulaire
    g.fillStyle = '#e4e4e4';
    g.font = '600 46px Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const legend = '· LA FRANCE DES TALENTS · MATTHIEU XXV ';
    const step = (Math.PI * 2) / legend.length;
    for (let i = 0; i < legend.length; i++) {
        const a = -Math.PI / 2 + i * step;
        g.save();
        g.translate(C + Math.cos(a) * S * 0.355, C + Math.sin(a) * S * 0.355);
        g.rotate(a + Math.PI / 2);
        g.fillText(legend[i], 0, 0);
        g.restore();
    }
    // La croix, comme sur la couverture
    g.fillStyle = '#f2f2f2';
    g.fillRect(C - 22, C - 190, 44, 360);
    g.fillRect(C - 120, C - 92, 240, 44);
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 4;
    return tex;
}

/* Lumière d'atelier pour les reflets de l'or : ciel nacré, fenêtre chaude */
function studioEnvironment(renderer) {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#fbf8f1');
    grad.addColorStop(0.45, '#cfc6b6');
    grad.addColorStop(0.55, '#4a4036');
    grad.addColorStop(1, '#1d1915');
    g.fillStyle = grad;
    g.fillRect(0, 0, 512, 256);
    const spot = g.createRadialGradient(150, 70, 0, 150, 70, 70);
    spot.addColorStop(0, 'rgba(255,246,220,1)');
    spot.addColorStop(1, 'rgba(255,246,220,0)');
    g.fillStyle = spot;
    g.fillRect(0, 0, 512, 256);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.fillRect(360, 40, 60, 90);
    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromEquirectangular(tex).texture;
    tex.dispose();
    pmrem.dispose();
    return env;
}

/* ---------- Le lys : trois faisceaux de fibres ---------- */
const BAND_Y = 2.0;      // hauteur de l'anneau au-dessus du talent

function strandPath(i) {
    const pts = [];
    const phase = (i * Math.PI * 2) / 3;
    // Tresse : les trois brins s'enroulent en montant
    for (let k = 0; k <= 24; k++) {
        const t = k / 24;
        const a = t * Math.PI * 4 + phase;
        const r = 0.2 * (1 - 0.25 * t);
        pts.push(new THREE.Vector3(Math.sin(a) * r, t * BAND_Y, Math.cos(a) * r));
    }
    // Puis chacun prend sa direction : le bleu à gauche, le blanc au ciel, le rouge à droite
    if (i === 1) {
        pts.push(new THREE.Vector3(0, BAND_Y + 0.6, 0.05));
        pts.push(new THREE.Vector3(0, BAND_Y + 1.4, 0.03));
        pts.push(new THREE.Vector3(0, BAND_Y + 2.15, 0));
    } else {
        const s = i === 0 ? -1 : 1;
        [[0.25, 0.45], [0.68, 0.95], [1.18, 1.12], [1.55, 0.88], [1.66, 0.42], [1.55, -0.05], [1.32, -0.38]]
            .forEach(function (p) { pts.push(new THREE.Vector3(s * p[0], BAND_Y + p[1], 0.04 * s)); });
    }
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    // Part de la longueur prise par la tresse : au-delà commence le pétale
    curve.userData = { braid: new THREE.CatmullRomCurve3(pts.slice(0, 25)).getLength() / curve.getLength() };
    return curve;
}

function buildLys(group) {
    const colors = [0x2E4FA8, 0xF3F0EA, 0xC8102E];
    const fibers = [];
    const fibersPer = isCoarse ? 7 : 11;
    const tubular = isCoarse ? 160 : 240;
    for (let i = 0; i < 3; i++) {
        const base = strandPath(i);
        const pts = base.getSpacedPoints(tubular);
        const mat = new THREE.MeshStandardMaterial({
            color: colors[i],
            roughness: i === 1 ? 0.5 : 0.55,
            metalness: 0.0,
            emissive: colors[i],
            emissiveIntensity: i === 1 ? 0.08 : 0.04
        });
        const tb = base.userData.braid;
        const maxSpread = i === 1 ? 0.3 : 0.17;
        for (let f = 0; f < fibersPer; f++) {
            const ang = (f / fibersPer) * Math.PI * 2 + Math.random() * 0.4;
            const mag = 0.35 + Math.random() * 0.65;
            const ox = Math.cos(ang) * mag;
            const oz = Math.sin(ang) * mag;
            const wob = Math.random() * 10;
            const fp = pts.map(function (p, k) {
                const t = k / tubular;
                // Les fibres s'écartent dans les pétales, comme sur la couverture
                // en fuseau : serrées au nœud, ouvertes au milieu du pétale, rejointes à la pointe
                const u = Math.max((t - tb) / (1 - tb), 0);
                const spread = 0.035 + maxSpread * Math.pow(Math.sin(Math.PI * Math.min(u * 1.1, 1)), 0.8);
                const w = 0.015 * Math.sin(t * 40 + wob);
                return new THREE.Vector3(p.x + ox * spread + w, p.y + oz * spread * 0.6, p.z + oz * spread);
            });
            const curve = new THREE.CatmullRomCurve3(fp);
            const geo = new THREE.TubeGeometry(curve, tubular, 0.018 + Math.random() * 0.01, 5, false);
            const mesh = new THREE.Mesh(geo, mat);
            mesh.userData.count = geo.index.count;
            mesh.userData.delay = Math.random() * 0.08;
            geo.setDrawRange(0, 0);
            group.add(mesh);
            fibers.push(mesh);
        }
    }

    // L'anneau blanc qui noue le lys
    const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.34, 0.11, 18, 64),
        new THREE.MeshStandardMaterial({ color: 0xF7F5F1, roughness: 0.45, emissive: 0xF7F5F1, emissiveIntensity: 0.08 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = BAND_Y - 0.05;
    ring.scale.setScalar(0.0001);
    group.add(ring);

    // La croix d'or, sur le pétale blanc
    const gold = new THREE.MeshStandardMaterial({ color: 0xD4AF37, metalness: 1, roughness: 0.3 });
    const cross = new THREE.Group();
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.5, 0.04), gold);
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 0.04), gold);
    h.position.y = 0.09;
    cross.add(v, h);
    cross.position.set(0, BAND_Y + 1.15, 0.22);
    cross.scale.setScalar(0.0001);
    group.add(cross);

    return { fibers: fibers, ring: ring, cross: cross };
}

export function initScene(canvas) {
    const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    const dprCap = isCoarse ? 1.5 : 1.75;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.autoClear = false;

    // Fond : la terre
    const earthMat = new THREE.ShaderMaterial({
        vertexShader: EARTH_VERT,
        fragmentShader: EARTH_FRAG,
        uniforms: {
            uRes: { value: new THREE.Vector2(1, 1) },
            uDig: { value: 0 },
            uOpen: { value: 0 },
            uFade: { value: 0 },
            uCav: { value: new THREE.Vector2(0, -3) },
            uCavR: { value: 0.1 }
        },
        depthTest: false,
        depthWrite: false
    });
    const bgScene = new THREE.Scene();
    bgScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), earthMat));
    const bgCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // Avant-plan : le talent et le lys
    const scene = new THREE.Scene();
    scene.environment = studioEnvironment(renderer);
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 0, 12);

    scene.add(new THREE.HemisphereLight(0xfffaf0, 0x8a7a66, 1.1));
    const key = new THREE.DirectionalLight(0xfff1d6, 2.2);
    key.position.set(3, 5, 6);
    scene.add(key);

    const faceTex = coinFaceTexture();
    const coinGold = new THREE.MeshStandardMaterial({
        color: 0xD4AF37,
        metalness: 1,
        roughness: 0.3,
        bumpMap: faceTex,
        bumpScale: 2.2
    });
    const rimGold = new THREE.MeshStandardMaterial({ color: 0xC9A233, metalness: 1, roughness: 0.38 });
    const coin = new THREE.Mesh(
        new THREE.CylinderGeometry(1, 1, 0.14, 128, 1),
        [rimGold, coinGold, coinGold]
    );
    coin.rotation.x = Math.PI / 2;
    const coinPivot = new THREE.Group();
    coinPivot.add(coin);
    scene.add(coinPivot);

    const lysGroup = new THREE.Group();
    scene.add(lysGroup);
    const lys = buildLys(lysGroup);

    const state = {
        dig: 0, coinX: 0, coinUvY: -3, coinScale: 0.62, open: 0, fade: 0,
        grow: 0, bloom: 0, lysX: 0, lysY: -1.6, lysScale: 1, coinFade: 1, spin: 0
    };
    let W = 1, H = 1, worldPerUv = 1;
    const cav = new THREE.Vector2(0, -3);
    let cavFrozen = false;

    function resize() {
        W = canvas.clientWidth || 1;
        H = canvas.clientHeight || 1;
        renderer.setSize(W, H, false);
        camera.aspect = W / H;
        camera.updateProjectionMatrix();
        const halfH = camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        worldPerUv = (2 * halfH) * (Math.min(W, H) / H);
        // Sur un écran étroit, tout se resserre un peu
        const narrow = W < H;
        lysGroup.userData.fit = narrow ? 0.62 : 1;
        coinPivot.userData.fit = narrow ? 0.8 : 1;
        const db = renderer.getDrawingBufferSize(new THREE.Vector2());
        earthMat.uniforms.uRes.value.set(db.x, db.y);
    }

    // Faire tourner le talent du doigt ou à la souris
    let drag = null;
    let vel = 0;
    canvas.addEventListener('pointerdown', function (e) {
        drag = { x: e.clientX };
    });
    window.addEventListener('pointermove', function (e) {
        if (!drag) return;
        const dx = e.clientX - drag.x;
        drag.x = e.clientX;
        vel = dx * 0.012;
        state.spin += vel;
    });
    window.addEventListener('pointerup', function () { drag = null; });
    window.addEventListener('pointercancel', function () { drag = null; });

    let visible = true;
    let raf = 0;

    function frame(now) {
        raf = 0;
        if (!visible) return;
        // Inertie de la rotation, et une lente révolution d'elle-même
        if (!drag) {
            state.spin += vel;
            vel *= 0.94;
        }
        coinPivot.rotation.y = state.spin + now * 0.00025;
        coinPivot.rotation.x = Math.sin(now * 0.0006) * 0.12;

        const fitC = coinPivot.userData.fit || 1;
        coinPivot.position.set(state.coinX * worldPerUv, state.coinUvY * worldPerUv, 0);
        coinPivot.scale.setScalar(state.coinScale * fitC * Math.max(state.coinFade, 0.0001));

        // Où est le talent à l'écran : la cavité et la fissure s'y accrochent
        if (!cavFrozen) {
            const p = coinPivot.position.clone().project(camera);
            const m = Math.min(W, H);
            cav.set(p.x * 0.5 * W / m, p.y * 0.5 * H / m);
            earthMat.uniforms.uCavR.value = (state.coinScale * fitC / worldPerUv) * 1.08;
        }
        cavFrozen = state.open > 0.001;
        earthMat.uniforms.uCav.value.copy(cav);
        earthMat.uniforms.uDig.value = state.dig;
        earthMat.uniforms.uOpen.value = state.open;
        earthMat.uniforms.uFade.value = state.fade;

        // Le lys pousse fibre après fibre
        const fit = lysGroup.userData.fit || 1;
        lysGroup.position.set(state.lysX * worldPerUv, state.lysY * worldPerUv, 0);
        lysGroup.scale.setScalar(state.lysScale * fit);
        lysGroup.rotation.y = Math.sin(now * 0.0004) * 0.18;
        lys.fibers.forEach(function (f) {
            const g = THREE.MathUtils.clamp((state.grow - f.userData.delay) / (1 - 0.08), 0, 1);
            const n = Math.floor(f.userData.count * g / 3) * 3;
            f.geometry.setDrawRange(0, n);
            f.visible = n > 0;
        });
        const b = THREE.MathUtils.clamp(state.bloom, 0, 1);
        lys.ring.scale.set(b, b, b * 1.6);
        lys.ring.visible = b > 0.001;
        const c = THREE.MathUtils.clamp(state.bloom * 1.6 - 0.6, 0, 1);
        lys.cross.scale.setScalar(Math.max(c, 0.0001));
        lys.cross.visible = c > 0.001;

        renderer.clear();
        renderer.render(bgScene, bgCam);
        renderer.clearDepth();
        renderer.render(scene, camera);

        raf = requestAnimationFrame(frame);
    }

    new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible && !raf) {
            raf = requestAnimationFrame(frame);
        }
    }).observe(canvas);

    window.addEventListener('resize', resize);
    resize();
    raf = requestAnimationFrame(frame);

    return {
        state: state,
        resize: resize
    };
}
