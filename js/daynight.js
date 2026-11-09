// v38 昼夜（Yang：像旷野之息那样有昼夜，夜里的光源自己设计、要有氛围）
// 一天 24 分钟（一个时辰两分钟）。天色、日月星在后处理里画（art.js createPost 的“昼夜”一段），这里只算参数、管灯：
// 殿亭檐下的红灯笼（天黑才点亮，白天收起来）、屋里透出的暖光、接管人物时手提的灯笼、玉女潭上漂的河灯、路边的萤火。
// 灯照亮周围：后处理按像素的世界坐标逐灯算（挑离镜头最近的几盏）；灯本身的光晕和萤火：后处理之后叠一层，按场景深度自己做遮挡。
import * as THREE from 'three';

const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const SC = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
export const shichen = (h) => SC[Math.floor(((h + 1) % 24) / 2)] + '时';
export function phaseName(h) {
  if (h < 4.5 || h >= 20) return '夜'; if (h < 6.5) return '黎明'; if (h < 9) return '清晨'; if (h < 11) return '上午';
  if (h < 13.5) return '正午'; if (h < 16.5) return '午后'; if (h < 19) return '黄昏'; return '入夜';
}

// 时辰 → 天色参数。e：太阳高度（正午 1、日出日落 0、子夜 -1）
export function skyState(h) {
  const th = (h - 6) / 12 * Math.PI, e = Math.sin(th);
  const sun = new THREE.Vector3(Math.cos(th) * 0.62, Math.sin(th) * 0.8, -0.8).normalize(); // 日出在卷首（右，+x），日落在卷尾（左），都偏在前方远处
  const tm = (h - 19) / 11 * Math.PI;
  const moon = new THREE.Vector3(Math.cos(tm) * 0.55, Math.sin(tm) * 0.42 + 0.04, -0.85).normalize(); // 月亮不高，夜里常在画面里
  const night = 1 - sm(-0.32, -0.04, e);
  const warm = sm(-0.26, -0.02, e) * (1 - sm(0.05, 0.36, e));
  const dawn = h < 12 ? 1 : 0;
  const lamp = 1 - sm(-0.12, 0.1, e);
  const W = dawn ? [0.98, 0.92, 0.92] : [0.98, 0.9, 0.86], N = [0.27, 0.33, 0.47]; // 黄昏整体只略暖略暗，暖光主要落在朝日的那一面（后处理里按面朝向分）
  const gMul = W.map((w, i) => { const v = 1 + (w - 1) * warm; return v + (N[i] - v) * night; });
  return { h, e, sun, moon, night, warm, dawn, lamp, gMul, gSat: 1 - 0.42 * night, gAdd: [0.012 * night, 0.017 * night, 0.032 * night] };
}

// 红纸灯笼：高约 0.38 米，顶底黑漆盖，下垂一缕金穗，上面一根吊绳
function lanternGeometry() {
  const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(new THREE.Vector2(0.045 + 0.115 * Math.pow(Math.sin(Math.PI * t), 0.7), -0.17 + t * 0.34)); }
  const parts = [[new THREE.LatheGeometry(pts, 10), [0.82, 0.24, 0.13]],
    [new THREE.CylinderGeometry(0.055, 0.06, 0.04, 8).translate(0, 0.19, 0), [0.14, 0.11, 0.09]],
    [new THREE.CylinderGeometry(0.06, 0.055, 0.04, 8).translate(0, -0.19, 0), [0.14, 0.11, 0.09]],
    [new THREE.CylinderGeometry(0.006, 0.006, 0.3, 4).translate(0, 0.36, 0), [0.12, 0.1, 0.08]],
    [new THREE.CylinderGeometry(0.008, 0.028, 0.13, 5).translate(0, -0.275, 0), [0.88, 0.62, 0.22]]];
  return parts.map(([g, c]) => { g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv'); const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set(c, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; });
}
// 河灯：一朵浅粉的纸莲花托着一点烛火
function lotusGeometry() {
  const parts = [];
  for (let k = 0; k < 8; k++) {
    const g = new THREE.SphereGeometry(0.11, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.55, 1.1, 1).translate(0, 0, 0.1).rotateX(-0.5).rotateY(k / 8 * Math.PI * 2);
    parts.push([g, k % 2 ? [0.93, 0.78, 0.74] : [0.96, 0.86, 0.8]]);
  }
  parts.push([new THREE.CylinderGeometry(0.17, 0.12, 0.05, 10), [0.36, 0.5, 0.32]]);
  parts.push([new THREE.CylinderGeometry(0.025, 0.025, 0.1, 6).translate(0, 0.07, 0), [0.95, 0.88, 0.7]]);
  return parts.map(([g, c]) => { g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv'); const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set(c, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; });
}

// 光晕 / 萤火：一张张朝向镜头的方片，加法混合，自己读场景深度做遮挡
function glowMaterial(post, fly) {
  return new THREE.ShaderMaterial({
    uniforms: { tDepth: { value: post.rt.depthTexture }, res: post.mat.uniforms.res, time: { value: 0 }, k: { value: 0 }, minPx: { value: fly ? 2.2 : 4.5 } },
    defines: fly ? { FLY: 1 } : {},
    transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute vec3 iPos; attribute float iSize; attribute vec3 iCol; attribute float iPh;
      uniform float time, k, minPx; uniform vec2 res; varying vec2 vUv; varying vec3 vCol;
      void main(){
        vec3 p = iPos; float b;
        #ifdef FLY
          p += vec3(sin(time*.7+iPh*6.3)*.45, sin(time*1.13+iPh*9.1)*.35, cos(time*.61+iPh*4.7)*.45);
          b = pow(.5+.5*sin(time*(1.3+iPh*.8)+iPh*20.), 3.);
        #else
          b = .9 + .1*sin(time*8.7+iPh*30.)*sin(time*5.3+iPh*11.); // 烛火微微跳
        #endif
        vec4 mv = viewMatrix*vec4(p,1.);
        mv.z += .3; // 往镜头挪一点，不被灯笼自己挡住
        float ppm = projectionMatrix[1][1]*res.y*.5/max(-mv.z,.1), s = max(iSize, minPx/ppm);
        mv.xy += position.xy*s;
        vUv = position.xy; vCol = iCol*b*k*mix(1., .55, smoothstep(1.,3.,s/iSize));
        gl_Position = projectionMatrix*mv;
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D tDepth; uniform vec2 res; varying vec2 vUv; varying vec3 vCol;
      void main(){
        float r = length(vUv); if (r > 1.) discard;
        if (gl_FragCoord.z > texture2D(tDepth, gl_FragCoord.xy/res).x) discard; // 被山、树、墙挡住
        #ifdef FLY
          float a = exp(-r*r*9.)*.8 + exp(-r*r*60.);
        #else
          float a = exp(-r*r*4.5)*.42 + exp(-r*r*26.)*.6 + exp(-r*r*140.)*.9;
        #endif
        gl_FragColor = vec4(vCol*a, 1.);
      }`,
  });
}
function glowMesh(n, mat) {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3)); g.setIndex([0, 1, 2, 0, 2, 3]);
  for (const [k, s] of [['iPos', 3], ['iSize', 1], ['iCol', 3], ['iPh', 1]]) g.setAttribute(k, new THREE.InstancedBufferAttribute(new Float32Array(n * s), s));
  g.instanceCount = 0;
  const m = new THREE.Mesh(g, mat); m.frustumCulled = false; return m;
}

const KIND = { // r 照亮半径、col 光色、halo 光晕半径（米）
  lantern: { r: 7.5, col: [1.0, 0.56, 0.26], i: 1.8, halo: 1.05 },
  inner: { r: 6, col: [1.0, 0.64, 0.32], i: 1.25, halo: 0 },
  hand: { r: 8, col: [1.0, 0.6, 0.3], i: 1.9, halo: 0.8 },
  float: { r: 4.5, col: [1.0, 0.66, 0.34], i: 1.35, halo: 0.7 },
};

export function createDayNight({ post, scene, camera, groundHeight, MOBILE, hour = 8.5 }) {
  const LIGHTS = post.mat.uniforms.lp.value.length;
  const S = { hour, speed: 1 / 60, auto: true, sky: skyState(hour), lamps: [], meshes: [] };
  const addLamp = (p, kind = 'lantern') => { const K = KIND[kind]; const L = { p: p.clone(), kind, ...K, ph: Math.random(), on: 0 }; S.lamps.push(L); return L; };
  // —— 灯笼网格（场景结束后一次合并）——
  let lanternMesh = null, lotusMesh = null, glow = null, flies = null, handLamp = null, handMesh = null;
  const floats = [];
  function finalize({ pond, figsRoot } = {}) {
    const LG = lanternGeometry(), list = [];
    for (const L of S.lamps) if (L.kind === 'lantern') for (const g of LG) list.push(g.clone().translate(L.p.x, L.p.y, L.p.z));
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true });
    if (list.length) { lanternMesh = new THREE.Mesh(mergeAll(list), mat); lanternMesh.visible = false; scene.add(lanternMesh); }
    // 玉女潭的河灯：几盏在潭心慢慢绕着漂
    if (pond) {
      const LO = mergeAll(lotusGeometry()), n = MOBILE ? 5 : 8;
      lotusMesh = new THREE.InstancedMesh(LO, mat, n); lotusMesh.visible = false; scene.add(lotusMesh);
      for (let i = 0; i < n; i++) floats.push({ a: i / n * 6.28 + Math.random() * 0.5, rr: 0.25 + Math.random() * 0.45, w: 0.012 + Math.random() * 0.02, L: addLamp(new THREE.Vector3(), 'float') });
      S.pond = pond;
    }
    // 手提灯笼：接管人物时挂在他右手边
    handMesh = new THREE.Mesh(mergeAll(LG.map((g) => g.clone())), mat); handMesh.visible = false; scene.add(handMesh);
    handLamp = addLamp(new THREE.Vector3(), 'hand'); handLamp.off = true;
    glow = glowMesh(S.lamps.length, glowMaterial(post, false)); scene.add(glow); glow.visible = false;
    flies = glowMesh(MOBILE ? 50 : 120, glowMaterial(post, true)); flies.visible = false;
    S.flyN = MOBILE ? 50 : 120; S.flySeed = Array.from({ length: S.flyN }, () => [Math.random(), Math.random(), 0.4 + Math.random() * 2.2, Math.random()]);
    // 光晕和萤火不进主画面（主画面先渲到后处理的缓冲里），后处理之后单独叠一层
    S.overlay = new THREE.Scene(); S.overlay.add(glow); S.overlay.add(flies);
  }
  function mergeAll(gs) {
    let n = 0; for (const g of gs) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0;
    for (const g of gs) { pos.set(g.attributes.position.array, o * 3); col.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
  }
  let pick = 0, flyT = 0;
  function update(dt, t, { ctrl } = {}) {
    if (S.auto) S.hour = (S.hour + dt * S.speed) % 24;
    const sky = S.sky = skyState(S.hour), u = post.mat.uniforms, cp = camera.position;
    u.gMul.value.set(...sky.gMul); u.gAdd.value.set(...sky.gAdd); u.gSat.value = sky.gSat;
    u.nightK.value = sky.night; u.warmK.value = sky.warm; u.dawnK.value = sky.dawn; u.lampK.value = sky.lamp;
    u.sunD2.value.copy(sky.sun); u.moonD.value.copy(sky.moon);
    const lit = sky.lamp > 0.005;
    if (lanternMesh) lanternMesh.visible = sky.lamp > 0.02;
    // 河灯漂
    if (lotusMesh) {
      lotusMesh.visible = lit; const P = S.pond, M = new THREE.Matrix4();
      floats.forEach((f, i) => {
        f.a += dt * f.w; const x = P.x + Math.cos(f.a) * P.rx * f.rr * 0.8, z = P.z + Math.sin(f.a * 1.3 + i) * P.rz * f.rr * 0.7, y = P.wl + 0.03 + Math.sin(t * 0.8 + i) * 0.015;
        M.makeRotationY(f.a * 2 + i).setPosition(x, y, z); lotusMesh.setMatrixAt(i, M); f.L.p.set(x, y + 0.14, z);
      });
      lotusMesh.instanceMatrix.needsUpdate = true;
    }
    // 手提灯笼
    handLamp.off = !ctrl;
    handMesh.visible = !!ctrl && lit;
    if (ctrl) {
      const r = ctrl.root, s = r.scale.x, a = ctrl.heading ?? r.rotation.y, sw = Math.sin(t * 2.2) * 0.05 * Math.min(1, (ctrl.speed || 0) / 1.5);
      const x = r.position.x + (Math.cos(a) * 0.34 + Math.sin(a) * 0.32) * s, z = r.position.z + (-Math.sin(a) * 0.34 + Math.cos(a) * 0.32) * s, y = r.position.y + 0.82 * s;
      handMesh.position.set(x + sw, y, z); handMesh.rotation.z = sw * 2; handLamp.p.set(x + sw, y, z);
    }
    // 照亮周围的灯：每 0.2 秒挑离镜头（和手里那盏）最近的几盏
    if ((pick += dt) > 0.2 || pick === dt) {
      pick = 0;
      const act = S.lamps.filter((L) => !L.off).map((L) => ({ L, d: L.kind === 'hand' ? -1 : L.p.distanceTo(cp) - L.r })).filter((o) => o.d < 150).sort((a, b) => a.d - b.d).slice(0, LIGHTS);
      S.act = act.map((o) => o.L);
    }
    const n = lit ? S.act.length : 0;
    for (let i = 0; i < n; i++) {
      const L = S.act[i], f = 0.93 + 0.07 * Math.sin(t * 8.1 + L.ph * 40) * Math.sin(t * 4.7 + L.ph * 13);
      u.lp.value[i].set(L.p.x, L.p.y, L.p.z, L.r); u.lc.value[i].set(L.col[0] * L.i * f, L.col[1] * L.i * f, L.col[2] * L.i * f, 0);
    }
    u.nL.value = n;
    // 光晕
    glow.visible = lit;
    if (lit) {
      const g = glow.geometry, P = g.attributes.iPos.array, Z = g.attributes.iSize.array, C = g.attributes.iCol.array, H = g.attributes.iPh.array; let k = 0;
      for (const L of S.lamps) { if (!L.halo || L.off) continue; P[k * 3] = L.p.x; P[k * 3 + 1] = L.p.y; P[k * 3 + 2] = L.p.z; Z[k] = L.halo; C[k * 3] = L.col[0] * 1.1; C[k * 3 + 1] = L.col[1]; C[k * 3 + 2] = L.col[2] * 0.85; H[k] = L.ph; k++; }
      g.instanceCount = k; for (const a of ['iPos', 'iSize', 'iCol', 'iPh']) g.attributes[a].needsUpdate = true;
      glow.material.uniforms.time.value = t; glow.material.uniforms.k.value = sky.lamp;
    }
    // 萤火：在镜头（或接管的人）周围 44 米见方里，离地半米到两米多，跟着人走
    const fk = sky.night * sky.night; flies.visible = fk > 0.05;
    if (flies.visible && (flyT++ % 4 === 0)) {
      const c = ctrl ? ctrl.root.position : cp, B = 44, g = flies.geometry, P = g.attributes.iPos.array, Z = g.attributes.iSize.array, C = g.attributes.iCol.array, H = g.attributes.iPh.array;
      S.flySeed.forEach(([a, b, hh, ph], i) => {
        const x = c.x + ((((a * B - c.x) % B) + B * 1.5) % B) - B / 2, z = c.z + ((((b * B - c.z) % B) + B * 1.5) % B) - B / 2;
        P[i * 3] = x; P[i * 3 + 1] = groundHeight(x, z) + hh; P[i * 3 + 2] = z; Z[i] = 0.06; C[i * 3] = 0.72; C[i * 3 + 1] = 1.0; C[i * 3 + 2] = 0.42; H[i] = ph;
      });
      g.instanceCount = S.flyN; for (const a of ['iPos', 'iSize', 'iCol', 'iPh']) g.attributes[a].needsUpdate = true;
    }
    flies.material.uniforms.time.value = t; flies.material.uniforms.k.value = fk * 1.3;
  }
  // 后处理画完之后叠光晕、萤火
  function overlay(renderer) {
    if (!S.overlay || (!glow.visible && !flies.visible)) return;
    const ac = renderer.autoClear; renderer.autoClear = false; renderer.render(S.overlay, camera); renderer.autoClear = ac;
  }
  const setHour = (h) => { S.hour = ((h % 24) + 24) % 24; pick = 0; };
  return { S, addLamp, finalize, update, overlay, setHour };
}
