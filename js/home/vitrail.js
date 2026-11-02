/* ============================================
   ÉDITIONS KILETON — Ouverture « Le Vitrail »
   Un vitrail en arc brisé dont les plombs dessinent le K du sceau.
   La lumière, derrière le verre, suit le pointeur : elle colore le
   verre, se projette sur le sol et traverse la poussière de l'air.
   Le verre, la projection au sol et les rayons partagent la même
   fonction GLSL : ce que l'on voit au sol est exactement le vitrail.
   ============================================ */

import * as THREE from '../vendor/three.module.min.js';

/* Géométrie du sceau (viewBox 100 × 140), ramenée à l'échelle de la scène :
   largeur de la fenêtre = 2 unités, base à y = 0. */
const SPRING = 1.875;       // naissance de l'arc
const ARC_R = 1.3;          // rayon des deux arcs (arc brisé)
const APEX = SPRING + Math.sqrt(ARC_R * ARC_R - 0.3 * 0.3);
const GLASS_Z = -0.3;       // le verre est en retrait, dans l'ébrasement
const FLOOR_Y = -0.6;
const WALL_DEPTH = 0.45;

const GLSL_COMMON = /* glsl */ `
    uniform vec3 uLight;
    uniform float uIntensity;
    uniform float uTime;
    uniform vec3 uCellA;
    uniform vec3 uCellB;
    uniform vec3 uCellC;
    uniform vec3 uCellD;

    const float SPRING = ${SPRING.toFixed(4)};
    const float ARC_R = ${ARC_R.toFixed(4)};
    const float GLASS_Z = ${GLASS_Z.toFixed(4)};
    const float FLOOR_Y = ${FLOOR_Y.toFixed(4)};
    const vec2 J = vec2(-0.3, 1.175);
    const vec2 UPD = vec2(0.4997, 0.8662);
    const vec2 DND = vec2(0.7419, -0.6706);

    float hash12(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
        p3 += dot(p3, p3.yzx + 33.33);
        return fract((p3.x + p3.y) * p3.z);
    }

    float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
                   mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
    }

    float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 4; i++) {
            v += a * noise(p);
            p *= 2.03;
            a *= 0.5;
        }
        return v;
    }

    float insideArch(vec2 p) {
        if (p.y < 0.0 || abs(p.x) > 1.0) return 0.0;
        if (p.y > SPRING) {
            if (distance(p, vec2(0.3, SPRING)) > ARC_R) return 0.0;
            if (distance(p, vec2(-0.3, SPRING)) > ARC_R) return 0.0;
        }
        return 1.0;
    }

    float rayDist(vec2 p, vec2 a, vec2 dir) {
        vec2 d = p - a;
        float t = max(dot(d, dir), 0.0);
        return length(d - dir * t);
    }

    /* Plombs : le fût, le bras et la jambe du K */
    float leadMask(vec2 p) {
        float d = min(abs(p.x - J.x), min(rayDist(p, J, UPD), rayDist(p, J, DND)));
        // Cerne de plomb le long de l'arc et des montants
        float edge = min(1.0 - abs(p.x), p.y);
        if (p.y > SPRING) edge = min(edge, min(ARC_R - distance(p, vec2(0.3, SPRING)), ARC_R - distance(p, vec2(-0.3, SPRING))));
        d = min(d, edge - 0.012);
        return 1.0 - smoothstep(0.022, 0.034, d);
    }

    /* Les quatre verres : A à gauche du fût, B le tympan (la lumière),
       C le cœur du K, D le socle */
    vec3 cellColor(vec2 p) {
        if (p.x < J.x) return uCellA;
        vec2 d = p - J;
        if (UPD.x * d.y - UPD.y * d.x > 0.0) return uCellB;
        if (DND.x * d.y - DND.y * d.x > 0.0) return uCellC;
        return uCellD;
    }

    /* Verre « cathédrale » : épaisseur irrégulière, bulles, légères variations de teinte */
    vec3 glassAt(vec2 p) {
        vec3 c = cellColor(p);
        float ripple = fbm(p * 5.0 + vec2(0.0, 1.7));
        float streak = noise(vec2(p.x * 2.0, p.y * 14.0));
        return c * (0.62 + 0.62 * ripple + 0.16 * streak);
    }

    /* Couleur transmise par le vitrail le long du segment X -> lumière */
    vec3 transmitted(vec3 X) {
        float t = (GLASS_Z - X.z) / (uLight.z - X.z);
        if (t <= 0.0 || t >= 1.0) return vec3(0.0);
        vec2 q = (X + t * (uLight - X)).xy;
        if (insideArch(q) < 0.5) return vec3(0.0);
        return glassAt(q) * (1.0 - leadMask(q));
    }
`;

const VERT_WORLD = /* glsl */ `
    varying vec3 vWorld;
    varying vec2 vLocal;
    void main() {
        vLocal = position.xy;
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
    }
`;

function archPath(target) {
    target.moveTo(-1, 0);
    target.lineTo(-1, SPRING);
    target.absarc(0.3, SPRING, ARC_R, Math.PI, Math.atan2(APEX - SPRING, -0.3), true);
    target.absarc(-0.3, SPRING, ARC_R, Math.atan2(APEX - SPRING, 0.3), 0, true);
    target.lineTo(1, 0);
    target.closePath();
    return target;
}

function stoneTexture(size) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const x = c.getContext('2d');
    x.fillStyle = '#7d7871';
    x.fillRect(0, 0, size, size);
    for (let i = 0; i < size * 14; i++) {
        const v = 95 + Math.random() * 70 | 0;
        x.fillStyle = 'rgba(' + v + ',' + (v - 3) + ',' + (v - 8) + ',0.28)';
        x.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 3, 1 + Math.random() * 3);
    }
    // Assises de pierre
    x.strokeStyle = 'rgba(30,27,30,0.35)';
    x.lineWidth = 2;
    const course = size / 6;
    for (let r = 0; r < 6; r++) {
        x.beginPath();
        x.moveTo(0, r * course);
        x.lineTo(size, r * course);
        x.stroke();
        for (let k = 0; k < 3; k++) {
            const sx = ((k + (r % 2) * 0.5) / 3) * size;
            x.beginPath();
            x.moveTo(sx, r * course);
            x.lineTo(sx, (r + 1) * course);
            x.stroke();
        }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

export function initVitrail(canvas, options) {
    const opts = Object.assign({ reducedMotion: false }, options);
    const isCoarse = window.matchMedia('(pointer: coarse)').matches;

    const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    let pixelRatio = Math.min(window.devicePixelRatio || 1, isCoarse ? 1.25 : 1.5);
    let marchSteps = isCoarse ? 16 : 28;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0B0A0F');

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 60);

    const uniforms = {
        uLight: { value: new THREE.Vector3(0.6, 4.2, -4.0) },
        uIntensity: { value: 1.0 },
        uTime: { value: 0 },
        uSteps: { value: marchSteps },
        uCellA: { value: new THREE.Color('#3155A8') },   // Lapis plein
        uCellB: { value: new THREE.Color('#E8C66A') },   // la Lumière, au tympan
        uCellC: { value: new THREE.Color('#B05138') },   // Vermillon, le cœur du K
        uCellD: { value: new THREE.Color('#1A3268') }    // Lapis profond, le socle
    };

    /* --- Le mur et son ébrasement --- */
    const wallShape = new THREE.Shape();
    wallShape.moveTo(-12, FLOOR_Y);
    wallShape.lineTo(12, FLOOR_Y);
    wallShape.lineTo(12, 12);
    wallShape.lineTo(-12, 12);
    wallShape.closePath();
    wallShape.holes.push(archPath(new THREE.Path()));
    const wallGeo = new THREE.ExtrudeGeometry(wallShape, { depth: WALL_DEPTH, bevelEnabled: false, curveSegments: 48 });
    const stone = stoneTexture(512);
    stone.repeat.set(0.35, 0.35);
    const wallMat = new THREE.MeshStandardMaterial({ color: '#6a6470', map: stone, roughness: 0.94, metalness: 0 });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.z = -WALL_DEPTH;
    scene.add(wall);

    /* --- Le verre --- */
    const glassGeo = new THREE.PlaneGeometry(2, APEX, 1, 1);
    glassGeo.translate(0, APEX / 2, 0);
    const glassMat = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: VERT_WORLD,
        fragmentShader: GLSL_COMMON + /* glsl */ `
            varying vec3 vWorld;
            varying vec2 vLocal;
            void main() {
                vec2 p = vLocal;
                if (insideArch(p) < 0.5) discard;
                vec3 V = normalize(vWorld - cameraPosition);
                vec3 Ld = normalize(uLight - vWorld);
                float align = max(dot(V, Ld), 0.0);
                float soft = pow(align, 5.0);
                float hot = pow(align, 60.0);
                vec3 glass = glassAt(p);
                vec3 lit = glass * (0.18 + 2.6 * soft) * uIntensity + vec3(1.0, 0.93, 0.78) * hot * 1.8 * uIntensity;
                float lead = leadMask(p);
                // Plomb : sombre, avec un liseré de lumière sur l'arête
                float edge = smoothstep(0.034, 0.026, min(abs(p.x - J.x), min(rayDist(p, J, UPD), rayDist(p, J, DND))))
                           - smoothstep(0.026, 0.016, min(abs(p.x - J.x), min(rayDist(p, J, UPD), rayDist(p, J, DND))));
                vec3 leadCol = vec3(0.035, 0.032, 0.04) + vec3(0.5, 0.4, 0.22) * edge * soft * 0.6;
                gl_FragColor = vec4(mix(lit, leadCol, lead), 1.0);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }
        `
    });
    const glass = new THREE.Mesh(glassGeo, glassMat);
    glass.position.z = GLASS_Z;
    scene.add(glass);

    /* Le joyau, au croisement des plombs */
    const jewel = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.075, 0),
        new THREE.MeshStandardMaterial({ color: '#D4AF37', emissive: '#7a5a14', emissiveIntensity: 0.9, roughness: 0.35, metalness: 0.4 })
    );
    jewel.position.set(-0.3, 1.175, GLASS_Z + 0.03);
    jewel.scale.z = 0.45;
    scene.add(jewel);

    /* --- Le sol : la lumière du vitrail s'y projette --- */
    const floorGeo = new THREE.PlaneGeometry(30, 14, 1, 1);
    floorGeo.rotateX(-Math.PI / 2);
    floorGeo.translate(0, FLOOR_Y, 7 - WALL_DEPTH);
    const floorMat = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: VERT_WORLD,
        fragmentShader: GLSL_COMMON + /* glsl */ `
            varying vec3 vWorld;
            void main() {
                vec3 P = vWorld;
                float slab = noise(P.xz * vec2(1.4, 1.4));
                float grain = noise(P.xz * 18.0);
                vec3 base = vec3(0.06, 0.05, 0.046) * (0.75 + 0.35 * slab + 0.15 * grain);
                vec3 light = transmitted(P);
                float fall = exp(-max(P.z, 0.0) * 0.16);
                vec3 warm = mix(light, light * vec3(1.15, 1.0, 0.82), 0.4);
                vec3 col = base + warm * (0.55 + 0.25 * grain) * fall * uIntensity * 1.35;
                // Fondu vers le noir en profondeur de champ
                col *= smoothstep(13.0, 4.0, P.z) * smoothstep(-9.0, -3.5, P.x) * smoothstep(9.0, 3.5, P.x);
                col *= 0.55 + 0.45 * smoothstep(-0.45, 0.6, P.z);
                gl_FragColor = vec4(col, 1.0);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }
        `
    });
    scene.add(new THREE.Mesh(floorGeo, floorMat));

    /* --- Les rayons : marche dans le volume de la pièce --- */
    const volGeo = new THREE.BoxGeometry(16, 9, 10);
    volGeo.translate(0, FLOOR_Y + 4.5, 5 + GLASS_Z);
    const volMat = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: VERT_WORLD,
        fragmentShader: GLSL_COMMON + /* glsl */ `
            uniform float uSteps;
            varying vec3 vWorld;
            float dust(vec3 X) {
                return 0.55 + 0.45 * noise(X.xy * 1.3 + vec2(X.z * 0.7, uTime * 0.04))
                            * noise(X.zy * 2.1 - vec2(uTime * 0.03, 0.0));
            }
            void main() {
                vec3 ro = cameraPosition;
                vec3 seg = vWorld - ro;
                float tEnd = length(seg);
                vec3 rd = seg / tEnd;
                float tStart = 0.0;
                if (rd.z < 0.0) tStart = max((9.5 - ro.z) / rd.z, 0.0);
                float dt = (tEnd - tStart) / uSteps;
                float jitter = hash12(gl_FragCoord.xy + fract(uTime) * 61.0);
                vec3 acc = vec3(0.0);
                for (int i = 0; i < 48; i++) {
                    if (float(i) >= uSteps) break;
                    vec3 X = ro + rd * (tStart + (float(i) + jitter) * dt);
                    if (X.y < FLOOR_Y || X.z < GLASS_Z) continue;
                    float h = smoothstep(FLOOR_Y, FLOOR_Y + 1.6, X.y);
                    acc += transmitted(X) * dust(X) * exp(-X.z * 0.22) * (0.08 + 0.92 * h);
                }
                acc *= dt * 0.085 * uIntensity;
                gl_FragColor = vec4(acc, 1.0);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }
        `,
        side: THREE.BackSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    const volume = new THREE.Mesh(volGeo, volMat);
    volume.renderOrder = 2;
    scene.add(volume);

    /* --- La poussière qui s'allume dans les faisceaux --- */
    const DUST = isCoarse ? 700 : 1600;
    const dustPos = new Float32Array(DUST * 3);
    const dustSeed = new Float32Array(DUST);
    for (let i = 0; i < DUST; i++) {
        dustPos[i * 3] = (Math.random() - 0.5) * 7;
        dustPos[i * 3 + 1] = FLOOR_Y + Math.random() * 5.5;
        dustPos[i * 3 + 2] = GLASS_Z + 0.1 + Math.random() * 6;
        dustSeed[i] = Math.random();
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    dustGeo.setAttribute('aSeed', new THREE.BufferAttribute(dustSeed, 1));
    const dustMat = new THREE.ShaderMaterial({
        uniforms: Object.assign({ uScale: { value: 1 } }, uniforms),
        vertexShader: GLSL_COMMON + /* glsl */ `
            attribute float aSeed;
            uniform float uScale;
            varying vec3 vCol;
            void main() {
                vec3 p = position;
                float s = aSeed * 6.283;
                p += vec3(sin(uTime * 0.13 + s) * 0.18, -mod(uTime * 0.02 + aSeed * 5.5, 5.5) + 2.75 + sin(uTime * 0.21 + s * 2.0) * 0.08, cos(uTime * 0.11 + s) * 0.15);
                p.y = FLOOR_Y + mod(p.y - FLOOR_Y + 5.5, 5.5);
                vec3 t = transmitted(p);
                float twinkle = 0.6 + 0.4 * sin(uTime * (1.0 + aSeed * 2.0) + s);
                vCol = t * twinkle * uIntensity * 1.4;
                vec4 mv = viewMatrix * modelMatrix * vec4(p, 1.0);
                gl_PointSize = (2.0 + aSeed * 2.5) * uScale * (6.0 / -mv.z);
                gl_Position = projectionMatrix * mv;
            }
        `,
        fragmentShader: /* glsl */ `
            varying vec3 vCol;
            void main() {
                float d = length(gl_PointCoord - 0.5);
                float a = smoothstep(0.5, 0.0, d);
                gl_FragColor = vec4(vCol * a, 1.0);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    const dust = new THREE.Points(dustGeo, dustMat);
    dust.renderOrder = 3;
    scene.add(dust);

    /* Lumière renvoyée dans la pièce : éclaire l'ébrasement et le joyau */
    const bounce = new THREE.PointLight('#f2c27a', 30, 9, 2);
    bounce.position.set(0, 1.2, 1.1);
    scene.add(bounce);
    scene.add(new THREE.HemisphereLight('#3a4466', '#120f14', 0.9));
    // Lumière rasante venue de la gauche : révèle les assises de pierre
    const raking = new THREE.DirectionalLight('#f0d6a8', 0.45);
    raking.position.set(-7, 5, 2.2);
    raking.target.position.set(0, 1.5, 0);
    scene.add(raking, raking.target);

    /* --- Cadrage --- */
    let width = 1;
    let height = 1;
    let baseZ = 8;
    let progress = 0;
    const camTarget = new THREE.Vector3(0, 1.35, 0);

    function frameCamera() {
        const aspect = width / height;
        camera.aspect = aspect;
        // Recul suffisant pour que la fenêtre et son halo tiennent dans le cadre
        const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        baseZ = Math.max(8.2, 4.4 / (2 * tanHalf * aspect));
        if (aspect >= 1.05) {
            // Écran large : le vitrail se place à droite, le texte à gauche
            camera.setViewOffset(width * 1.42, height, 0, 0, width, height);
        } else {
            // Écran étroit : le vitrail monte dans le tiers haut, le texte reste dessous
            camera.setViewOffset(width, height * 1.3, 0, height * 0.3, width, height);
        }
        camera.updateProjectionMatrix();
        dustMat.uniforms.uScale.value = pixelRatio * height / 900;
    }

    function resize() {
        const rect = canvas.parentElement.getBoundingClientRect();
        width = Math.max(1, rect.width);
        height = Math.max(1, rect.height);
        renderer.setPixelRatio(pixelRatio);
        renderer.setSize(width, height, false);
        frameCamera();
        render();
    }

    /* --- La lumière suit le pointeur --- */
    const pointer = { x: 0.62, y: 0.32, active: false, last: 0 };
    const lightNow = new THREE.Vector3().copy(uniforms.uLight.value);
    const lightGoal = new THREE.Vector3().copy(lightNow);

    function onPointer(e) {
        const rect = canvas.getBoundingClientRect();
        pointer.x = (e.clientX - rect.left) / rect.width;
        pointer.y = (e.clientY - rect.top) / rect.height;
        pointer.active = true;
        pointer.last = performance.now();
        if (opts.reducedMotion) {
            setGoalFromPointer();
            lightNow.copy(lightGoal);
            render();
        }
    }

    function setGoalFromPointer() {
        const wide = width / height >= 1.05;
        const cx = wide ? 0.68 : 0.5;          // position du vitrail à l'écran
        lightGoal.set((cx - pointer.x) * 7.5, 2.4 + (pointer.y) * 3.6, -4.2);
    }

    window.addEventListener('pointermove', onPointer, { passive: true });

    /* --- Boucle --- */
    let running = false;
    let raf = 0;
    const clock = new THREE.Clock();
    let frames = 0;
    let slowFrames = 0;

    function render() {
        const p = progress;
        uniforms.uIntensity.value = 1.0 + p * 1.6;
        camera.position.set(0, 2.3, baseZ);
        camera.lookAt(camTarget);
        uniforms.uLight.value.copy(lightNow);
        uniforms.uLight.value.y += p * 2.2;
        bounce.intensity = 30 + 45 * p;
        renderer.render(scene, camera);
    }

    function tick() {
        if (!running) return;
        raf = requestAnimationFrame(tick);
        if (progress >= 0.999) return;   // la pièce est recouverte par la lumière
        const dt = Math.min(clock.getDelta(), 0.1);
        uniforms.uTime.value += dt;
        const now = performance.now();
        if (!pointer.active || now - pointer.last > 4000) {
            // Au repos, la lumière décrit une lente orbite, comme un soleil qui passe
            const t = uniforms.uTime.value * 0.22;
            lightGoal.set(Math.sin(t) * 2.4, 3.6 + Math.sin(t * 1.7) * 0.9, -4.2);
        } else {
            setGoalFromPointer();
        }
        lightNow.lerp(lightGoal, 1 - Math.pow(0.02, dt));
        jewel.rotation.y += dt * 0.25;
        render();

        // Garde-fou : si la machine peine, on allège le rendu une fois
        frames++;
        if (frames > 30 && dt > 0.028) slowFrames++;
        if (slowFrames === 40) {
            pixelRatio = 1;
            marchSteps = Math.max(12, Math.round(marchSteps * 0.55));
            uniforms.uSteps.value = marchSteps;
            resize();
        }
    }

    function start() {
        if (running || opts.reducedMotion) return;
        running = true;
        clock.getDelta();
        tick();
    }

    function stop() {
        running = false;
        cancelAnimationFrame(raf);
    }

    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement);

    const io = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting && !document.hidden) start(); else stop();
    });
    io.observe(canvas);

    document.addEventListener('visibilitychange', function () {
        if (document.hidden) stop(); else start();
    });

    resize();
    if (opts.reducedMotion) render(); else start();

    return {
        setProgress: function (p) {
            progress = Math.max(0, Math.min(1, p));
            if (!running) render();
        },
        dispose: function () {
            stop();
            ro.disconnect();
            io.disconnect();
            window.removeEventListener('pointermove', onPointer);
            renderer.dispose();
        }
    };
}
