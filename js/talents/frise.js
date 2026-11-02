/* ============================================
   LA FRANCE DES TALENTS — la frise gravée
   Une longue frise de pierre claire. Chaque parole y est taillée lettre
   après lettre, puis dorée à la feuille ; une lumière rasante en révèle
   le relief. En défilant, la frise glisse jusqu'à la plaque suivante.
   Les lettres sont dessinées sur un canevas (masque, relief adouci, ordre
   de taille), puis éclairées par un shader WebGL.
   initFrise(canvas, panels) renvoie { set(state) } ; l'état est piloté
   par le défilement depuis talents.js.
   ============================================ */

const isCoarse = window.matchMedia('(pointer: coarse)').matches;

const VERT = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }';

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform vec2 uTexel;
uniform sampler2D uA;
uniform sampler2D uB;
uniform float uShift;
uniform float uCarve;
uniform float uGold;
uniform vec2 uLight;
uniform vec2 uPool;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + 1.0), f.x), f.y);
}
float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.07; a *= 0.5; }
    return v;
}

// Plaque courante (A) puis plaque suivante (B), encore vierge
vec4 tap(vec2 q, out float carve) {
    if (q.x < 1.0) { carve = uCarve; return texture2D(uA, q); }
    carve = 0.0;
    return texture2D(uB, vec2(q.x - 1.0, q.y));
}

// Avancée du ciseau : chaque lettre a son rang (canal bleu) ; rang nul = déjà taillé
float reveal(float order, float carve) {
    if (order < 0.02) return 1.0;
    return clamp((carve * 1.12 - order) / 0.12, 0.0, 1.0);
}

// Taille en V : le creux part du bord de la lettre et s'approfondit vers son axe
float vcut(vec4 t) {
    return smoothstep(0.3, 0.7, t.r) * clamp((t.g - 0.48) / 0.32, 0.0, 1.0);
}

float depthAt(vec2 q) {
    float c;
    vec4 t = tap(q, c);
    return vcut(t) * reveal(t.b, c);
}

void main() {
    vec2 uv = gl_FragCoord.xy / uRes;
    float aspect = uRes.x / uRes.y;
    vec2 q = uv + vec2(uShift, 0.0);

    float c;
    vec4 t = tap(q, c);
    float r = reveal(t.b, c);
    float d = vcut(t) * r;
    float dx = depthAt(q + vec2(uTexel.x, 0.0)) - depthAt(q - vec2(uTexel.x, 0.0));
    float dy = depthAt(q + vec2(0.0, uTexel.y)) - depthAt(q - vec2(0.0, uTexel.y));
    vec3 n = normalize(vec3(dx * 5.0, dy * 5.0, 1.0));

    // La pierre : un calcaire clair, voilé, piqué de pores ; elle défile avec la frise
    vec2 sp = vec2(q.x * aspect, q.y) * 3.0;
    float g1 = fbm(sp * 1.6);
    float g2 = fbm(sp * 9.0 + 4.0);
    float vein = 1.0 - smoothstep(0.0, 0.035, abs(fbm(sp * 0.7 + vec2(3.1, 7.4)) - 0.52));
    float pore = step(0.93, hash(floor(sp * 140.0))) * step(0.5, g2);
    vec3 stone = mix(vec3(0.874, 0.854, 0.82), vec3(0.957, 0.945, 0.925), smoothstep(0.25, 0.75, g1));
    stone *= 0.97 + 0.06 * g2;
    stone -= vein * 0.035;
    stone -= pore * 0.05;

    // Joint entre deux blocs de la frise
    float seam = abs(q.x - 1.0) * uRes.x;
    stone *= 1.0 - 0.32 * (1.0 - smoothstep(0.6, 1.8, seam));
    stone += 0.05 * (1.0 - smoothstep(1.8, 3.2, seam)) * step(1.0, q.x);

    // Lumière rasante, venue d'en haut, hors champ
    vec3 L = normalize(vec3((uLight - uv) * vec2(aspect, 1.0), 0.32));
    float shade = clamp(dot(n, L) / L.z, 0.0, 2.2);

    // Taille fraîche un peu plus claire, fond des creux dans l'ombre
    vec3 col = stone * (0.5 + 0.5 * shade);
    col = mix(col, col * 1.05 + 0.02, smoothstep(0.0, 0.25, d));
    col *= 1.0 - 0.16 * smoothstep(0.35, 1.0, d);

    // La feuille d'or posée au fond des lettres
    // Les filets sont dorés d'avance ; les lettres le sont une fois taillées
    float gf = t.b < 0.02 ? 1.0 : (q.x < 1.0 ? uGold : 0.0);
    float gm = smoothstep(0.35, 0.65, t.r) * r * gf;
    vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
    float spec = pow(max(dot(n, H), 0.0), 36.0);
    vec3 gold = mix(vec3(0.5, 0.39, 0.16), vec3(0.93, 0.8, 0.5), clamp(shade * 0.55, 0.0, 1.0));
    gold += vec3(1.0, 0.95, 0.84) * spec * 0.8;
    col = mix(col, gold, gm);

    // Le front du ciseau : un éclat chaud là où la pierre est taillée
    float front = r * (1.0 - r) * 4.0 * smoothstep(0.3, 0.7, t.r);
    col += vec3(1.0, 0.88, 0.6) * front * 0.45;

    // Une flaque de lumière chaude sur la frise, le reste dans la pénombre
    vec2 pd = (uv - uPool) * vec2(aspect, 1.0);
    float pool = exp(-dot(pd, pd) * 0.9);
    col *= 0.8 + 0.26 * pool;
    col += vec3(0.05, 0.03, 0.0) * pool;
    vec2 vg = uv - 0.5;
    col *= 1.0 - 0.32 * dot(vg, vg);

    col += (hash(gl_FragCoord.xy) - 0.5) * 0.02;
    gl_FragColor = vec4(col, 1.0);
}`;

/* ---------- Le relief d'une plaque, dessiné sur canevas ---------- */
// Capitales romaines de la couverture : le Cormorant
const FAMILY = '"Cormorant Garamond", Georgia, serif';
const BLANK = { text: '', cite: '' };

function boxBlur(a, w, h, r) {
    const tmp = new Float32Array(w * h);
    const inv = 1 / (2 * r + 1);
    for (let pass = 0; pass < 3; pass++) {
        for (let y = 0; y < h; y++) {
            const o = y * w;
            let acc = 0;
            for (let x = -r; x <= r; x++) acc += a[o + Math.min(Math.max(x, 0), w - 1)];
            for (let x = 0; x < w; x++) {
                tmp[o + x] = acc * inv;
                acc += a[o + Math.min(x + r + 1, w - 1)] - a[o + Math.max(x - r, 0)];
            }
        }
        for (let x = 0; x < w; x++) {
            let acc = 0;
            for (let y = -r; y <= r; y++) acc += tmp[Math.min(Math.max(y, 0), h - 1) * w + x];
            for (let y = 0; y < h; y++) {
                a[y * w + x] = acc * inv;
                acc += tmp[Math.min(y + r + 1, h - 1) * w + x] - tmp[Math.max(y - r, 0) * w + x];
            }
        }
    }
}

function measureWith(g, ls) {
    return function (s) {
        let w = 0;
        for (const ch of s) w += g.measureText(ch).width + ls;
        return w - ls;
    };
}

function wrap(g, text, maxW, ls) {
    const width = measureWith(g, ls);
    const lines = [];
    text.split('|').forEach(function (par) {
        let line = '';
        par.split(' ').forEach(function (word) {
            const next = line ? line + ' ' + word : word;
            if (line && width(next) > maxW) {
                lines.push(line);
                line = word;
            } else {
                line = next;
            }
        });
        if (line) lines.push(line);
    });
    return { lines: lines, widths: lines.map(width) };
}

function panelPixels(panel, w, h) {
    const portrait = h > w;
    const mask = document.createElement('canvas');
    const ord = document.createElement('canvas');
    mask.width = ord.width = w;
    mask.height = ord.height = h;
    const m = mask.getContext('2d', { willReadFrequently: true });
    const o = ord.getContext('2d', { willReadFrequently: true });
    m.fillStyle = o.fillStyle = '#000';
    m.fillRect(0, 0, w, h);
    o.fillRect(0, 0, w, h);

    // Les filets de la frise, taillés depuis toujours
    const band = portrait ? 0.14 : 0.18;
    const fl = Math.max(3, Math.round(h * 0.005));
    m.fillStyle = '#fff';
    [h * band, h * band + fl * 3.2, h * (1 - band) - fl, h * (1 - band) - fl * 4.2].forEach(function (y) {
        m.fillRect(0, Math.round(y), w, fl);
    });

    let blur = Math.max(2, Math.round(h * 0.004));
    if (panel.text) {
        const isTitle = !!panel.title;
        const maxW = w * (portrait ? 0.84 : 0.74);
        const maxH = h * (isTitle ? 0.36 : (portrait ? 0.46 : 0.4));
        const lh = isTitle ? 1.08 : 1.34;
        let fs = isTitle ? Math.min(h * 0.2, w * 0.16) : (portrait ? w * 0.1 : h * 0.095);
        let ls, L;
        for (let k = 0; k < 40; k++) {
            ls = fs * (isTitle ? 0.08 : 0.1);
            m.font = '400 ' + fs.toFixed(1) + 'px ' + FAMILY;
            L = wrap(m, panel.text, maxW, ls);
            const tall = L.lines.length * fs * lh > maxH;
            const wide = L.widths.some(function (x) { return x > maxW; });
            if (!tall && !wide) break;
            fs *= 0.94;
        }
        blur = Math.max(1, Math.round(fs * 0.022));

        const cfs = Math.max(fs * 0.4, h * 0.018);
        const cls = cfs * 0.3;
        const gap = panel.cite ? fs * 0.75 : 0;
        const total = L.lines.length * fs * lh + (panel.cite ? gap + cfs : 0);
        const cy = h * (isTitle ? 0.43 : 0.5);
        let top = cy - total / 2;

        const glyphs = [];
        L.lines.forEach(function (line, li) {
            let x = (w - L.widths[li]) / 2;
            const y = top + fs * lh * (li + 0.5);
            for (const ch of line) {
                if (ch !== ' ' && ch !== ' ') glyphs.push({ ch: ch, x: x, y: y, font: m.font });
                x += m.measureText(ch).width + ls;
            }
        });
        if (panel.cite) {
            const cfont = '400 ' + cfs.toFixed(1) + 'px ' + FAMILY;
            m.font = cfont;
            const cw = measureWith(m, cls)(panel.cite);
            let x = (w - cw) / 2;
            const y = top + L.lines.length * fs * lh + gap + cfs / 2;
            for (const ch of panel.cite) {
                if (ch !== ' ') glyphs.push({ ch: ch, x: x, y: y, font: cfont });
                x += m.measureText(ch).width + cls;
            }
        }

        // Chaque lettre reçoit son rang de taille ; le halo du relief le partage
        m.textBaseline = o.textBaseline = 'middle';
        o.lineJoin = 'round';
        o.lineWidth = blur * 5;
        const n = Math.max(glyphs.length - 1, 1);
        glyphs.forEach(function (gl, i) {
            const b = Math.round(8 + 247 * (i / n));
            m.font = o.font = gl.font;
            m.fillStyle = '#fff';
            m.fillText(gl.ch, gl.x, gl.y);
            o.fillStyle = o.strokeStyle = 'rgb(0,0,' + b + ')';
            o.strokeText(gl.ch, gl.x, gl.y);
            o.fillText(gl.ch, gl.x, gl.y);
        });
    }

    const md = m.getImageData(0, 0, w, h).data;
    const od = o.getImageData(0, 0, w, h).data;
    const relief = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) relief[i] = md[i * 4] / 255;
    boxBlur(relief, w, h, blur);

    // Rangées inversées : la texture se lit de bas en haut
    const out = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) {
        const src = y * w;
        const dst = (h - 1 - y) * w;
        for (let x = 0; x < w; x++) {
            const s = src + x, d = (dst + x) * 4;
            out[d] = md[s * 4];
            out[d + 1] = Math.round(relief[s] * 255);
            out[d + 2] = od[s * 4 + 2];
            out[d + 3] = 255;
        }
    }
    return out;
}

/* ---------- La scène ---------- */
export function initFrise(canvas, panels) {
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('webgl');

    function shader(type, src) {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
        return s;
    }
    const prog = gl.createProgram();
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const u = {};
    ['uRes', 'uTexel', 'uA', 'uB', 'uShift', 'uCarve', 'uGold', 'uLight', 'uPool'].forEach(function (k) {
        u[k] = gl.getUniformLocation(prog, k);
    });
    gl.uniform1i(u.uA, 0);
    gl.uniform1i(u.uB, 1);

    function makeTexture() {
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return t;
    }

    const state = { panel: 0, shift: 0, carve: 0, gold: 0 };
    let W = 0, H = 0, TW = 1, TH = 1;
    let textures = [];
    let blank = null;
    let queue = [];
    let fontsReady = false;

    function upload(tex, panel) {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, TW, TH, 0, gl.RGBA, gl.UNSIGNED_BYTE, panelPixels(panel, TW, TH));
    }

    // Les plaques se taillent une à une, la plus proche d'abord, sans bloquer le défilement
    function pump() {
        if (!queue.length) return;
        const i = queue.shift();
        if (!textures[i].ready) {
            upload(textures[i].tex, panels[i]);
            textures[i].ready = true;
        }
        setTimeout(pump, 30);
    }

    function rebuild() {
        textures.forEach(function (t) { gl.deleteTexture(t.tex); });
        if (blank) gl.deleteTexture(blank);
        blank = makeTexture();
        upload(blank, BLANK);
        textures = panels.map(function () { return { tex: makeTexture(), ready: false }; });
        textures.forEach(function (t) { upload(t.tex, BLANK); });
        if (!fontsReady) return;
        const first = Math.min(state.panel, panels.length - 1);
        queue = [first];
        for (let k = 1; k < panels.length; k++) {
            if (first + k < panels.length) queue.push(first + k);
            if (first - k >= 0) queue.push(first - k);
        }
        // La plaque visible est taillée tout de suite
        upload(textures[first].tex, panels[first]);
        textures[first].ready = true;
        pump();
    }

    function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, isCoarse ? 1.75 : 1.5);
        const w = canvas.clientWidth || 1;
        const h = canvas.clientHeight || 1;
        if (w < 2 || h < 2) return;
        const scale = Math.min(dpr, 2048 / w, 2048 / h);
        const nw = Math.round(w * scale), nh = Math.round(h * scale);
        if (nw === W && nh === H) return;
        W = canvas.width = nw;
        H = canvas.height = nh;
        TW = W;
        TH = H;
        gl.viewport(0, 0, W, H);
        rebuild();
    }

    // La lumière suit le pointeur ; au doigt, elle oscille d'elle-même
    let lx = 0.32, tx = 0.32;
    if (!isCoarse) {
        window.addEventListener('pointermove', function (e) { tx = e.clientX / window.innerWidth; });
    }

    let visible = true;
    let raf = 0;
    function frame(now) {
        raf = 0;
        if (!visible) return;
        if (isCoarse) tx = 0.42 + 0.2 * Math.sin(now * 0.00035);
        lx += (tx - lx) * 0.05;
        const i = Math.min(state.panel, panels.length - 1);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, textures[i] ? textures[i].tex : blank);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, textures[i + 1] ? textures[i + 1].tex : blank);
        gl.uniform2f(u.uRes, W, H);
        gl.uniform2f(u.uTexel, 1 / TW, 1 / TH);
        gl.uniform1f(u.uShift, state.shift);
        gl.uniform1f(u.uCarve, state.carve);
        gl.uniform1f(u.uGold, state.gold);
        gl.uniform2f(u.uLight, -0.35 + lx * 1.7, 1.45);
        gl.uniform2f(u.uPool, 0.15 + lx * 0.7, 0.56);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        raf = requestAnimationFrame(frame);
    }

    new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible && !raf) raf = requestAnimationFrame(frame);
    }).observe(canvas);

    let rt = 0;
    window.addEventListener('resize', function () {
        clearTimeout(rt);
        rt = setTimeout(resize, 200);
    });
    resize();

    // Les lettres attendent la police de la maison
    const fonts = document.fonts
        ? Promise.all([document.fonts.load('400 100px "Cormorant Garamond"'), document.fonts.ready])
        : Promise.resolve();
    fonts.catch(function () {}).then(function () {
        fontsReady = true;
        W = 0;
        resize();
    });

    raf = requestAnimationFrame(frame);

    return {
        set: function (s) {
            state.panel = s.panel;
            state.shift = s.shift;
            state.carve = s.carve;
            state.gold = s.gold;
        },
        resize: resize
    };
}
