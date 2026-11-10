// 天上的鸟：仙鹤成人字形结队盘旋（和地上的鹤是同一个模型），燕子贴着山坡掠飞。全部实例化，振翅在顶点着色器里做。
import * as THREE from 'three';
import { flyingCraneGeometry, WING_SHOULDER } from './crane.js';

function part(geo, color, wing, m) {
  const g = (geo.index ? geo.toNonIndexed() : geo); if (m) g.applyMatrix4(m);
  const n = g.attributes.position.count, c = new Float32Array(n * 3), w = new Float32Array(n);
  for (let i = 0; i < n; i++) { c[i * 3] = color.r; c[i * 3 + 1] = color.g; c[i * 3 + 2] = color.b; w[i] = wing ? 1 : 0; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.setAttribute('aWing', new THREE.BufferAttribute(w, 1));
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color', 'aWing'].includes(k)) g.deleteAttribute(k);
  if (!g.attributes.normal) g.computeVertexNormals();
  return g;
}
function merge(parts) {
  const n = parts.reduce((s, g) => s + g.attributes.position.count, 0), out = new THREE.BufferGeometry();
  for (const [k, size] of [['position', 3], ['normal', 3], ['color', 3], ['aWing', 1]]) {
    const arr = new Float32Array(n * size); let o = 0;
    for (const g of parts) { arr.set(g.attributes[k].array, o); o += g.attributes[k].array.length; }
    out.setAttribute(k, new THREE.BufferAttribute(arr, size));
  }
  return out;
}
// 翅膀：从肩到翼尖的一片，外段黑色飞羽；x 正方向为右翼
function wing(side, span, chord, body, tip) {
  const pos = [], cols = [], segs = 6;
  for (let i = 0; i < segs; i++) {
    const a = i / segs, b = (i + 1) / segs;
    const ch = (t) => chord * (1 - t * 0.45), sw = (t) => -t * 0.35 * span; // 后掠
    const x0 = side * (0.12 + a * span), x1 = side * (0.12 + b * span);
    const q = [[x0, 0, sw(a) + ch(a) * 0.5], [x1, 0, sw(b) + ch(b) * 0.5], [x1, 0, sw(b) - ch(b) * 0.5], [x0, 0, sw(a) - ch(a) * 0.5]];
    const col = b > 0.62 ? tip : body;
    pos.push(...q[0], ...q[1], ...q[2], ...q[0], ...q[2], ...q[3]);
    for (let k = 0; k < 6; k++) cols.push(col);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  const n = pos.length / 3, c = new Float32Array(n * 3), w = new Float32Array(n);
  for (let i = 0; i < n; i++) { c.set([cols[i].r, cols[i].g, cols[i].b], i * 3); w[i] = 1; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.setAttribute('aWing', new THREE.BufferAttribute(w, 1));
  return g;
}

function swallowGeometry() {
  const K = new THREE.Color('#2b2a2c'), Wb = new THREE.Color('#ddd4c4');
  return merge([
    part(new THREE.SphereGeometry(0.08, 6, 5), K, 0, new THREE.Matrix4().makeScale(1, 0.8, 2.4)),
    part(new THREE.SphereGeometry(0.05, 6, 4), Wb, 0, new THREE.Matrix4().makeScale(1, 0.6, 2).setPosition(0, -0.03, 0.02)),
    part(new THREE.ConeGeometry(0.06, 0.3, 4), K, 0, new THREE.Matrix4().makeRotationX(-Math.PI / 2).setPosition(0, 0, -0.28).multiply(new THREE.Matrix4().makeScale(1, 1, 0.3))),
    wing(1, 0.42, 0.14, K, K), wing(-1, 0.42, 0.14, K, K),
  ]);
}

function birdMaterial(freq, amp) {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, freq: { value: freq }, amp: { value: amp } }, vertexColors: true, side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      uniform float time, freq, amp; attribute float aWing; attribute float aPhase; attribute float aGlide; varying vec3 vC; varying vec3 vN;
      void main(){ vec3 p=position; vC=color;
        float glide=aGlide; float f=sin(time*freq+aPhase)*amp*(1.-glide) + .12*glide;
        float ax=abs(p.x)-.12;
        if(aWing>.5){ p.y += sin(f)*ax*1.1 - .04*ax*ax; p.x *= 1.-.12*abs(sin(f)); }
        p.y -= aWing*0.;
        vec4 w=modelMatrix*instanceMatrix*vec4(p,1.); vN=normalize(mat3(modelMatrix*instanceMatrix)*normal);
        gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: /* glsl */`varying vec3 vC; varying vec3 vN;
      void main(){ float d=abs(dot(normalize(vN), normalize(vec3(-.45,.8,.4)))); gl_FragColor=vec4(vC*(.86+.14*d),1.); }`,
  });
}

// 鹤的振翅：整只翅膀绕肩上下转，外段绕腕再晚半拍转，和地上那只鹤飞起来时一样
function craneFlyMaterial(freq, amp) {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, freq: { value: freq }, amp: { value: amp } }, vertexColors: true, side: THREE.DoubleSide,
    vertexShader: /* glsl */`
      uniform float time, freq, amp; attribute float aWing; attribute float aPhase; attribute float aGlide; varying vec3 vC; varying vec3 vN;
      mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c, s, -s, c); }
      void main(){ vec3 p=position; vec3 nn=normal; vC=color;
        float ph=time*freq+aPhase, gl=aGlide;
        float f=sin(ph)*amp*(1.-gl) + .06*gl, lag=.4*sin(ph-.9)*(1.-gl) - .05*gl;
        if(aWing>.5){
          float sx=sign(p.x); vec2 q=vec2(abs(p.x)-${WING_SHOULDER.x.toFixed(3)}, p.y-${WING_SHOULDER.y.toFixed(3)});
          vec2 qn=vec2(abs(nn.x)*1., nn.y);
          if(aWing>1.5){ vec2 w=vec2(${WING_SHOULDER.wrist.toFixed(3)}, 0.); q=w+rot(lag)*(q-w); qn=rot(lag)*qn; }
          q=rot(f)*q; qn=rot(f)*qn;
          p.x=sx*(q.x+${WING_SHOULDER.x.toFixed(3)}); p.y=q.y+${WING_SHOULDER.y.toFixed(3)}; nn.x=sign(nn.x)*qn.x; nn.y=qn.y;
        }
        vec4 w=modelMatrix*instanceMatrix*vec4(p,1.); vN=normalize(mat3(modelMatrix*instanceMatrix)*nn);
        gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: /* glsl */`varying vec3 vC; varying vec3 vN;
      void main(){ float d=abs(dot(normalize(vN), normalize(vec3(-.45,.8,.4)))); gl_FragColor=vec4(vC*(d>.2?1.:.86),1.); }`,
  });
}

// 飞行高度场。先在 step 米的粗网格上取地形最高（每个节点取周围 ±step 内地形网格顶点的最大值，
// 所以双线性插值出来的值一定不低于渲染出来的地面），再做锥形膨胀 H(p)=max_q(g(q)−k·|p−q|)
// （八邻域正反两遍扫描），最后模糊几遍抹平折角；返回双线性插值的查询函数。
// grid = 地形网格 { y(i,j), nx, nz, x0, z0, step }；没有时退回逐点取 ground。
function heightField(ground, grid, B, step, k, blur) {
  const nx = Math.ceil((B.x1 - B.x0) / step) + 1, nz = Math.ceil((B.z1 - B.z0) / step) + 1;
  let H = new Float32Array(nx * nz);
  if (grid) {
    const r = Math.ceil(step / grid.step);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const ci = Math.round((B.x0 + i * step - grid.x0) / grid.step), cj = Math.round((B.z0 + j * step - grid.z0) / grid.step);
      let m = -1e9;
      for (let b = Math.max(0, cj - r); b <= Math.min(grid.nz - 1, cj + r); b++) for (let a = Math.max(0, ci - r); a <= Math.min(grid.nx - 1, ci + r); a++) m = Math.max(m, grid.y(a, b));
      H[j * nx + i] = m;
    }
  } else {
    const h = step * 0.5;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const x = B.x0 + i * step, z = B.z0 + j * step; let m = -1e9;
      for (let b = -2; b <= 2; b++) for (let a = -2; a <= 2; a++) m = Math.max(m, ground(x + a * h, z + b * h));
      H[j * nx + i] = m;
    }
  }
  const d1 = k * step, d2 = k * step * Math.SQRT2;
  for (let pass = 0; pass < 2; pass++) {
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const c = j * nx + i; let v = H[c];
      if (i > 0) v = Math.max(v, H[c - 1] - d1);
      if (j > 0) { v = Math.max(v, H[c - nx] - d1); if (i > 0) v = Math.max(v, H[c - nx - 1] - d2); if (i < nx - 1) v = Math.max(v, H[c - nx + 1] - d2); }
      H[c] = v;
    }
    for (let j = nz - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) {
      const c = j * nx + i; let v = H[c];
      if (i < nx - 1) v = Math.max(v, H[c + 1] - d1);
      if (j < nz - 1) { v = Math.max(v, H[c + nx] - d1); if (i < nx - 1) v = Math.max(v, H[c + nx + 1] - d2); if (i > 0) v = Math.max(v, H[c + nx - 1] - d2); }
      H[c] = v;
    }
  }
  // 3×3 模糊抹平折角。斜率不超过 k，所以每遍最多低下 k·step·√2，逐遍补回，保证不低于地面
  for (let it = 0; it < blur; it++) {
    const S = new Float32Array(nx * nz);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      let s = 0, n = 0;
      for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const ii = i + a, jj = j + b; if (ii >= 0 && jj >= 0 && ii < nx && jj < nz) { s += H[jj * nx + ii]; n++; } }
      S[j * nx + i] = s / n + d2;
    }
    H = S;
  }
  return (x, z) => {
    const fx = Math.min(nx - 1.001, Math.max(0, (x - B.x0) / step)), fz = Math.min(nz - 1.001, Math.max(0, (z - B.z0) / step));
    const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, w = fz - j, c = j * nx + i;
    return (H[c] * (1 - u) + H[c + 1] * u) * (1 - w) + (H[c + nx] * (1 - u) + H[c + nx + 1] * u) * w;
  };
}

export class Birds {
  constructor(scene, ground, { mobile = false, bounds = null, grid = null } = {}) {
    this.ground = ground;
    // 飞行高度：原先是“脚下地面 + 固定高度”，鸟群飞过超然亭、二姑峰时会齐刷刷陡降陡升。
    // 现在先把地形做成一张“护身高度场”（脚下几米内的最高处，永不低于地面），
    // 再沿每只鸟/每队自己的航线往前后各看若干秒：y = max_τ(护身高(τ) + 离地 − 升降速度×|τ|)，
    // 于是飞向山头时提前缓缓爬升，飞过后缓缓落下，升降速度有上限，也不会穿山。
    const tH = performance.now(), B = bounds || { x0: -356, x1: 356, z0: -178, z1: 88 };
    this.guard = heightField(ground, grid, B, 3, 1.5, 1);
    console.info(`[birds] height fields ${(performance.now() - tH).toFixed(0)}ms`);
    // 仙鹤：两队，每队五只，人字形
    this.nC = mobile ? 6 : 10;
    const cg = flyingCraneGeometry();
    cg.setAttribute('aPhase', new THREE.InstancedBufferAttribute(new Float32Array(this.nC).map((_, i) => i * 0.7), 1));
    this.cGlide = new THREE.InstancedBufferAttribute(new Float32Array(this.nC), 1); cg.setAttribute('aGlide', this.cGlide);
    this.cMat = craneFlyMaterial(3.2, 0.7);
    this.cranes = new THREE.InstancedMesh(cg, this.cMat, this.nC); this.cranes.frustumCulled = false; this.cranes.layers.set(1); scene.add(this.cranes);
    this.flocks = [{ c: new THREE.Vector3(0, 0, -30), R: 75, w: 0.045, ph: 0 }, { c: new THREE.Vector3(0, 0, -60), R: 95, w: -0.035, ph: 2.5 }];
    // 燕子
    this.nS = mobile ? 8 : 16;
    const sg = swallowGeometry();
    sg.setAttribute('aPhase', new THREE.InstancedBufferAttribute(new Float32Array(this.nS).map((_, i) => i * 1.9), 1));
    this.sGlide = new THREE.InstancedBufferAttribute(new Float32Array(this.nS), 1); sg.setAttribute('aGlide', this.sGlide);
    this.sMat = birdMaterial(16, 0.75);
    this.swallows = new THREE.InstancedMesh(sg, this.sMat, this.nS); this.swallows.frustumCulled = false; this.swallows.layers.set(1); scene.add(this.swallows);
    this.sw = Array.from({ length: this.nS }, (_, i) => ({ a: Math.random() * 6, b: Math.random() * 6, fx: 0.25 + Math.random() * 0.25, fz: 0.2 + Math.random() * 0.3, R: 14 + Math.random() * 16, h: 6 + Math.random() * 8 }));
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.v = new THREE.Vector3(); this.s = new THREE.Vector3(1, 1, 1);
    this.prev = new Map();
  }
  // 沿航线 pos(τ) 前后看 ±T 秒，取“护身高 + 离地 − rate·|τ|”的最大值
  aheadY(pos, clear, T, dt, rate) {
    let y = -1e9;
    for (let tau = -T; tau <= T + 1e-6; tau += dt) { const [x, z] = pos(tau); y = Math.max(y, this.guard(x, z) + clear - rate * Math.abs(tau)); }
    return y;
  }
  // 再做一点时间上的缓动（镜头跳景时鹤群中心会快速挪动），但不许低于脚下的护身高
  ease(o, key, target, floor, dt) {
    const v = o[key] === undefined ? target : o[key] + (target - o[key]) * Math.min(1, dt / 1.5);
    o[key] = Math.max(v, floor); return o[key];
  }
  update(t, cam) {
    const dt = Math.min(0.2, Math.max(0, t - (this.lastT ?? t))); this.lastT = t;
    this.cMat.uniforms.time.value = t; this.sMat.uniforms.time.value = t;
    const up = new THREE.Vector3(0, 1, 0);
    // 鹤群中心慢慢跟着游人走
    let k = 0;
    const per = Math.ceil(this.nC / this.flocks.length);
    for (const F of this.flocks) {
      F.c.x += (cam.position.x - 20 + F.ph * 10 - F.c.x) * (F.init ? 0.004 : 1); F.init = true;
      const a = t * F.w + F.ph, cx = F.c.x + Math.cos(a) * F.R, cz = F.c.z + Math.sin(a) * F.R * 0.5;
      const dir = new THREE.Vector3(-Math.sin(a) * F.R, 0, Math.cos(a) * F.R * 0.5).multiplyScalar(Math.sign(F.w)).normalize();
      const side = new THREE.Vector3().crossVectors(up, dir).normalize();
      const at = (tau) => { const b = (t + tau) * F.w + F.ph; return [F.c.x + Math.cos(b) * F.R, F.c.z + Math.sin(b) * F.R * 0.5]; };
      const want = Math.max(this.aheadY(at, 24, 14, 0.5, 1.6), 36);
      const baseY = this.ease(F, 'y', want, this.guard(cx, cz) + 16, dt) + Math.sin(t * 0.2 + F.ph) * 4;
      for (let i = 0; i < per && k < this.nC; i++, k++) {
        const row = Math.ceil(i / 2), sgn = i % 2 ? 1 : -1;
        const p = new THREE.Vector3(cx, baseY - row * 0.4, cz).addScaledVector(dir, -row * 2.6).addScaledVector(side, row ? sgn * row * 2.4 : 0);
        p.y += Math.sin(t * 0.9 + k) * 0.25;
        this.q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
        const bank = new THREE.Quaternion().setFromAxisAngle(dir, -Math.sign(F.w) * 0.18); this.q.premultiply(bank);
        this.m.compose(p, this.q, this.s.set(1.5, 1.5, 1.5)); this.cranes.setMatrixAt(k, this.m);
        this.cGlide.array[k] = Math.sin(t * 0.35 + k * 0.3 + F.ph) > 0.35 ? 1 : 0; // 时而振翅，时而滑翔
      }
    }
    this.cranes.instanceMatrix.needsUpdate = true; this.cGlide.needsUpdate = true;
    // 燕子：围着镜头前方的一片坡地穿梭
    const fwd = new THREE.Vector3(); cam.getWorldDirection ? cam.getWorldDirection(fwd) : fwd.set(0, 0, -1);
    const ox = cam.position.x + fwd.x * 30, oz = cam.position.z + fwd.z * 30;
    this.sw.forEach((B, i) => {
      if (!B.o) B.o = new THREE.Vector2(ox, oz);
      B.o.x += (ox - B.o.x) * 0.01; B.o.y += (oz - B.o.y) * 0.01;
      const at = (tau) => [B.o.x + Math.sin((t + tau) * B.fx + B.a) * B.R, B.o.y + Math.sin((t + tau) * B.fz + B.b) * B.R * 0.7];
      const [x, z] = at(0);
      const y = this.ease(B, 'y', this.aheadY(at, B.h, 4, 0.5, 3), this.guard(x, z) + 3, dt) + Math.sin(t * 0.7 + i) * 2;
      const p = this.v.set(x, y, z), last = this.prev.get(i) || p.clone();
      const d = p.clone().sub(last); if (d.lengthSq() > 1e-6) this.q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.normalize());
      this.prev.set(i, p.clone());
      this.m.compose(p, this.q, this.s.set(1, 1, 1)); this.swallows.setMatrixAt(i, this.m);
      this.sGlide.array[i] = Math.sin(t * 1.3 + i) > 0.5 ? 1 : 0;
    });
    this.swallows.instanceMatrix.needsUpdate = true; this.sGlide.needsUpdate = true;
  }
}
