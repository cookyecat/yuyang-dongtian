// 仙鹤（丹顶鹤），照原画：白身，黑颈，丹顶，长喙，细长黑腿，尾上覆一簇下垂的黑羽（三级飞羽）。
// 身、颈、头、腿、翅分开做。颈是一根沿关节链每帧重算的管子，能站立、低头啄食、走动、受惊飞起。
// 局部坐标：鹤头朝 +x，脚底 y=0。
import * as THREE from 'three';
import { Kit } from './props.js';
import { flatMaterial } from './art.js';

const C = (h) => new THREE.Color(h);
const M = () => new THREE.Matrix4();
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const W = C('#f4f0e6'), W2 = C('#e2ddd0'), K = C('#2a2825'), RED = C('#c3392a'), BEAK = C('#8e8b6c'), LEG = C('#3b3732');
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// 参数曲面：F(u, v) 返回 [x, y, z, Color]
function sheet(k, nu, nv, F) {
  const pos = [], cols = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const p = F(i / nu, j / nv); pos.push(p[0], p[1], p[2]); cols.push(p[3]); }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  const n = k.parts.length; k.add(g, W);
  const col = k.parts[n].attributes.color;
  for (let t = 0; t < idx.length; t++) { const c = cols[idx[t]]; col.setXYZ(t, c.r, c.g, c.b); }
}
const mix = (a, b, t) => a.clone().lerp(b, Math.min(1, Math.max(0, t)));

// 身：从尾 (u=0) 到胸 (u=1) 的纺锤体，胸圆、背平、尾收尖
const BODY_X0 = -0.44, BODY_X1 = 0.3;
function bodyAt(u, a, off = 0) {
  const x = lerp(BODY_X0, BODY_X1, u);
  const r = 0.165 * Math.pow(Math.sin(Math.PI * Math.min(1, 0.06 + u * 0.97)), 0.62) * (0.55 + 0.45 * sm(0, 0.5, u)) + off;
  const yc = 0.99 + 0.07 * u - 0.03 * (1 - u) * (1 - u);
  const ca = Math.cos(a), sa = Math.sin(a);
  const ry = r * (sa > 0 ? 0.92 : 1.05), rz = r * 0.86;
  return [x, yc + sa * ry, ca * rz];
}
function buildBody() {
  const k = new Kit();
  sheet(k, 28, 20, (u, v) => { const p = bodyAt(u, v * Math.PI * 2); return [p[0], p[1], p[2], W]; });
  // 尾：一小撮白尾羽，压在黑羽下面
  sheet(k, 6, 4, (u, v) => { const s = (u - 0.5) * 2; return [BODY_X0 - 0.1 * v, 0.97 - 0.02 * v - 0.015 * s * s, s * (0.06 + 0.03 * v), W2]; });
  return k.geometry();
}
// 收拢的双翅：贴在身侧上半，下缘一排羽尖；尾上覆一簇下垂的黑羽
function buildFolded() {
  const k = new Kit();
  for (const s of [1, -1]) {
    sheet(k, 24, 8, (u, v) => {
      const uu = lerp(0.12, 0.92, u);
      const tip = 0.09 * Math.abs(Math.sin(u * Math.PI * 9)) * sm(0.0, 0.3, 1 - u);
      const a = lerp(1.45, 0.05 + tip + 0.25 * (1 - u), v);
      const p = bodyAt(uu, a, 0.012 + 0.01 * v);
      return [p[0], p[1], s * p[2], mix(W, W2, v * 0.8)];
    });
  }
  // 尾上的黑羽：两层宽羽片从背后往后、往下垂，彼此交叠成一簇，羽片微微内卷，羽尖参差
  const r = mulberry(7), GR = C('#4d4842');
  k.add(new THREE.SphereGeometry(0.12, 14, 10), K, 0, M().makeScale(1.25, 0.95, 1.05).setPosition(-0.3, 1.02, 0));
  for (let layer = 0; layer < 2; layer++) {
    const n = layer ? 9 : 13;
    for (let i = 0; i < n; i++) {
      const f = (i + 0.5 * layer) / (n - 1 + 0.5 * layer), sf = (f - 0.5) * 2;
      const L = (layer ? 0.5 : 0.6) * (0.8 + 0.2 * Math.cos(sf * 1.4)) + r() * 0.08;
      const W0 = (layer ? 0.085 : 0.075) * (0.9 + r() * 0.25);
      const bx = -0.1 - 0.1 * (1 - sf * sf) - 0.06 * layer + r() * 0.02, by = 1.13 + 0.02 * (1 - sf * sf) + 0.02 * layer, bz = sf * 0.11;
      const spread = sf * (0.5 + 0.15 * layer), droop = 1.45 + 0.3 * r() + 0.2 * layer, tw = sf * 0.5;
      sheet(k, 4, 14, (u, v) => {
        // 沿羽轴积分：起初往后平伸，渐渐垂下
        let x = bx, y = by, z = bz; const steps = 8;
        for (let q = 1; q <= steps; q++) { const tt = (q - 0.5) / steps * v, th = 0.15 + droop * tt * tt + 0.2 * tt; x -= Math.cos(th) * L * v / steps; y -= Math.sin(th) * L * v / steps; z += spread * 0.4 * L * v / steps; }
        const s2 = (u - 0.5) * 2, w = W0 * (1 - Math.pow(v, 3)) * (1 - 0.3 * v) + 0.006;
        const cup = (s2 * s2 - 0.5) * w * 0.35;
        const ox = Math.sin(tw) * s2 * w * 0.4;
        const c = mix(K, GR, Math.pow(Math.abs(s2), 3) * 0.8 + 0.15 * v);
        return [x + ox, y + cup, z + s2 * w * Math.cos(tw * 0.5), c];
      });
    }
  }
  return k.geometry();
}
function mulberry(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// 头：白头，黑脸黑喉，头顶一块朱红，长喙
function buildHead() {
  const k = new Kit();
  k.add(new THREE.SphereGeometry(0.048, 16, 12), W, 0, M().makeScale(1.35, 0.95, 0.85).setPosition(0.015, 0.008, 0));
  k.add(new THREE.SphereGeometry(0.05, 16, 12, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.58), K, 0, M().makeRotationZ(-0.5).premultiply(M().makeScale(1.3, 0.95, 0.88)).setPosition(0.022, 0.004, 0));
  k.add(new THREE.SphereGeometry(0.052, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.3), RED, 0, M().makeScale(1.1, 1, 0.82).setPosition(0.018, 0.006, 0));
  for (const s of [1, -1]) k.add(new THREE.SphereGeometry(0.0075, 8, 6), C('#141210'), 0, M().setPosition(0.052, 0.016, s * 0.034));
  k.add(new THREE.ConeGeometry(0.013, 0.17, 8), BEAK, 0, M().makeRotationZ(-Math.PI / 2).multiply(M().makeScale(1, 1, 0.75)).setPosition(0.155, -0.004, 0));
  return k.geometry();
}

// 腿：胫（髋到踝，往后斜）、跗（踝到脚，往前斜）、四趾
function buildLegParts() {
  const tib = new Kit(); tib.add(new THREE.CylinderGeometry(0.014, 0.024, 0.42, 7), LEG, 0, M().setPosition(0, -0.21, 0));
  tib.add(new THREE.SphereGeometry(0.019, 8, 6), LEG, 0, M().setPosition(0, -0.42, 0));
  const tar = new Kit(); tar.add(new THREE.CylinderGeometry(0.011, 0.014, 0.47, 6), LEG, 0, M().setPosition(0, -0.235, 0));
  for (const a of [-0.45, 0, 0.45]) tar.add(new THREE.CylinderGeometry(0.004, 0.007, 0.1, 4), LEG, 0, M().makeRotationZ(-Math.PI / 2).premultiply(M().makeRotationY(a)).setPosition(0.045 * Math.cos(a), -0.47, -0.045 * Math.sin(a)));
  tar.add(new THREE.CylinderGeometry(0.003, 0.005, 0.035, 4), LEG, 0, M().makeRotationZ(Math.PI / 2).setPosition(-0.017, -0.468, 0));
  return { tib: tib.geometry(), tar: tar.geometry() };
}

// 飞翅：内段（肩到腕）白羽带一道黑色次级飞羽，外段（腕到翅尖）白色初级飞羽分成指状
function buildWing(outer) {
  const k = new Kit(), span = outer ? 0.6 : 0.46;
  sheet(k, outer ? 24 : 12, 8, (u, v) => {
    const z = u * span;
    let chord = outer ? lerp(0.27, 0.06, Math.pow(u, 1.4)) : lerp(0.33, 0.28, u);
    let te = -chord;
    if (outer) te -= 0.07 * Math.pow(Math.abs(Math.sin(u * Math.PI * 4.5)), 0.7) * sm(0.2, 0.5, u);   // 初级飞羽分指
    else te -= 0.035 * Math.abs(Math.sin(u * Math.PI * 7));                                           // 次级飞羽羽尖
    const x = lerp(0.07 - (outer ? 0.06 * u * u : 0), te, v);
    const y = 0.025 * Math.sin(Math.PI * v) * (1 - (outer ? u : 0) * 0.6);
    const c = outer ? mix(W, W2, v * 0.6 + u * 0.3) : (v > 0.52 ? K : mix(W, W2, v));
    return [x, y, z, c];
  });
  return k.geometry();
}

// 颈的姿势：每节相对 +x 轴的方向角（弧度），从颈根到颈顶；head 是头的俯仰
const POSES = {
  stand: { neck: [1.2, 1.42, 1.64, 1.76, 1.7, 1.5, 1.22, 0.98], head: -0.12, body: 0.12 },
  alert: { neck: [1.4, 1.52, 1.6, 1.62, 1.6, 1.52, 1.4, 1.25], head: 0.05, body: 0.2 },
  feed: { neck: [0.85, 0.35, -0.15, -0.55, -0.8, -0.95, -0.95, -0.85], head: -0.65, body: -0.75 },
  fly: { neck: [0.32, 0.2, 0.12, 0.06, 0.03, 0.0, -0.02, -0.03], head: -0.05, body: 0.05 },
};
const NSEG = 8, SEGL = 0.09, NR = 10;

export class Crane {
  constructor(x, z, { seed = 1 } = {}) {
    this.mat = flatMaterial(); this.mat.side = THREE.DoubleSide;
    this.root = new THREE.Group();
    // 身子绕髋转（低头啄食时整个身子前倾，腿不动）
    this.pivot = new THREE.Group(); this.pivot.position.set(-0.02, 0.96, 0); this.root.add(this.pivot);
    this.body = new THREE.Group(); this.body.position.set(0.02, -0.96, 0); this.pivot.add(this.body);
    this.body.add(new THREE.Mesh(buildBody(), this.mat));
    this.folded = new THREE.Mesh(buildFolded(), this.mat); this.body.add(this.folded);
    // 颈：动态管子
    const rings = NSEG * 2 + 1, ng = new THREE.BufferGeometry();
    const pos = new Float32Array(rings * (NR + 1) * 3), col = new Float32Array(rings * (NR + 1) * 3), idx = [];
    for (let j = 0; j < rings; j++) {
      const t = j / (rings - 1), c = mix(W, K, sm(0.18, 0.34, t));
      for (let i = 0; i <= NR; i++) { const q = (j * (NR + 1) + i) * 3; col[q] = c.r; col[q + 1] = c.g; col[q + 2] = c.b; }
    }
    for (let j = 0; j < rings - 1; j++) for (let i = 0; i < NR; i++) { const a = j * (NR + 1) + i, b = a + 1, c2 = a + NR + 1, d = c2 + 1; idx.push(a, b, c2, b, d, c2); }
    ng.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    ng.setAttribute('color', new THREE.BufferAttribute(col, 3));
    ng.setAttribute('aKind', new THREE.BufferAttribute(new Float32Array(rings * (NR + 1)), 1));
    ng.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(rings * (NR + 1) * 2), 2));
    ng.setIndex(idx);
    this.neckGeo = ng; this.neck = new THREE.Mesh(ng, this.mat); this.neck.frustumCulled = false; this.body.add(this.neck);
    this.head = new THREE.Mesh(buildHead(), this.mat); this.body.add(this.head);
    // 腿
    const lp = buildLegParts();
    this.legs = [1, -1].map((s) => {
      const hip = new THREE.Group(); hip.position.set(-0.02, 0.93, s * 0.065); this.root.add(hip);
      hip.add(new THREE.Mesh(lp.tib, this.mat));
      const ankle = new THREE.Group(); ankle.position.set(0, -0.42, 0); hip.add(ankle);
      ankle.add(new THREE.Mesh(lp.tar, this.mat));
      return { hip, ankle };
    });
    // 飞翅
    const gi = buildWing(false), go = buildWing(true);
    this.wings = [1, -1].map((s) => {
      const mount = new THREE.Group(); mount.position.set(0.1, 1.1, s * 0.09); mount.scale.z = s; this.body.add(mount);
      const sh = new THREE.Group(); mount.add(sh); sh.add(new THREE.Mesh(gi, this.mat));
      const wr = new THREE.Group(); wr.position.z = 0.46; sh.add(wr); wr.add(new THREE.Mesh(go, this.mat));
      mount.visible = false;
      return { mount, sh, wr };
    });
    this.cur = { neck: POSES.stand.neck.slice(), head: POSES.stand.head, body: POSES.stand.body };
    this.root.scale.setScalar(0.9); // 头顶约 1.55 米，与真丹顶鹤相当，比人略矮
    this.home = new THREE.Vector3(x, 0, z); this.root.position.set(x, 0, z);
    this.rnd = mulberry(seed * 977 + 13);
    this.t = this.rnd() * 10; this.fly = -1; this.heading = this.rnd() * 6.28; this.root.rotation.y = this.heading;
    this.state = 'stand'; this.stateT = 1 + this.rnd() * 2; this.walkPh = 0; this.target = null;
    this.applyNeck(0);
  }
  startle() { if (this.fly < 0) { this.fly = 0; this.state = 'fly'; } }
  // 按当前角度沿关节链重算颈管和头的位置
  applyNeck(bob) {
    const P = this.neckGeo.attributes.position.array, a = this.cur.neck;
    const pts = [V(0.27, 1.07, 0)], dirs = [];
    for (let i = 0; i < NSEG; i++) { const d = V(Math.cos(a[i]), Math.sin(a[i]), 0); dirs.push(d); pts.push(pts[i].clone().addScaledVector(d, SEGL)); }
    pts[NSEG].y += bob;
    const rings = NSEG * 2 + 1, cen = V(0, 0, 0), tan = V(0, 0, 0);
    for (let j = 0; j < rings; j++) {
      const s = j / 2, i0 = Math.min(NSEG - 1, Math.floor(s)), f = s - i0;
      cen.copy(pts[i0]).lerp(pts[i0 + 1], f);
      // 切线在相邻两节之间过渡，管子不起折角
      const ai = i0 > 0 && f < 0.5 ? lerp(a[i0 - 1], a[i0], 0.5 + f) : i0 < NSEG - 1 && f > 0.5 ? lerp(a[i0], a[i0 + 1], f - 0.5) : a[i0];
      tan.set(Math.cos(ai), Math.sin(ai), 0);
      const t = j / (rings - 1), r = lerp(0.052, 0.022, Math.pow(t, 0.8)) * (1 + 0.25 * sm(0.85, 1, t));
      for (let i = 0; i <= NR; i++) {
        const ph = (i / NR) * Math.PI * 2, q = (j * (NR + 1) + i) * 3;
        const nx = -tan.y, ny = tan.x;
        P[q] = cen.x + r * Math.cos(ph) * nx; P[q + 1] = cen.y + r * Math.cos(ph) * ny; P[q + 2] = cen.z + r * Math.sin(ph) * 1.0;
      }
    }
    this.neckGeo.attributes.position.needsUpdate = true; this.neckGeo.computeVertexNormals();
    const end = pts[NSEG];
    this.head.position.set(end.x, end.y, end.z); this.head.rotation.z = this.cur.head;
  }
  blendTo(pose, k) {
    const p = POSES[pose];
    for (let i = 0; i < NSEG; i++) this.cur.neck[i] = lerp(this.cur.neck[i], p.neck[i], k);
    this.cur.head = lerp(this.cur.head, p.head, k); this.cur.body = lerp(this.cur.body, p.body, k);
  }
  setLegs(swing) { // swing: [-1, 1] 每条腿一个相位
    this.legs.forEach((L, i) => {
      const ph = swing + i * Math.PI, s = Math.sin(ph), lift = Math.max(0, Math.cos(ph));
      L.hip.rotation.z = -0.12 + 0.32 * s;
      L.ankle.rotation.z = 0.24 - 0.85 * lift * (this.state === 'walk' ? 1 : 0);
    });
  }
  update(dt, ground) {
    this.t += dt; const R = this.rnd;
    if (this.fly >= 0) {
      this.fly += dt; const T = 11, f = this.fly / T;
      const a = f * Math.PI * 2, RR = 10, h = Math.sin(f * Math.PI) * 11 * sm(0, 0.12, f) + (1 - sm(0, 0.12, f)) * f * 8;
      const x = this.home.x + Math.sin(a) * RR, z = this.home.z - RR + Math.cos(a) * RR;
      this.root.position.set(x, ground(this.home.x, this.home.z) + Math.max(0, h), z);
      this.heading = -a + Math.PI / 2 + Math.PI; this.root.rotation.y = this.heading;
      this.blendTo('fly', Math.min(1, dt * 4));
      this.pivot.rotation.z = this.cur.body;
      const flap = Math.sin(this.t * 7.5);
      this.wings.forEach((w) => { w.mount.visible = true; w.sh.rotation.x = -0.15 - 0.75 * flap; w.wr.rotation.x = -0.35 * Math.sin(this.t * 7.5 - 0.7); });
      this.folded.visible = false;
      this.legs.forEach((L) => { L.hip.rotation.z = lerp(L.hip.rotation.z, -1.45, Math.min(1, dt * 3)); L.ankle.rotation.z = lerp(L.ankle.rotation.z, 0, Math.min(1, dt * 3)); });
      this.applyNeck(0);
      if (this.fly > T) { this.fly = -1; this.state = 'stand'; this.stateT = 2; this.root.position.copy(this.home).setY(ground(this.home.x, this.home.z)); this.wings.forEach((w) => (w.mount.visible = false)); this.folded.visible = true; }
      return;
    }
    // 地面上：站一会儿、走几步、低头啄食，轮流来
    this.stateT -= dt;
    if (this.stateT <= 0) {
      const r = R();
      if (this.state !== 'walk' && r < 0.45) {
        const a = R() * Math.PI * 2, d = 1 + R() * 2.5;
        this.target = V(this.home.x + Math.cos(a) * d, 0, this.home.z + Math.sin(a) * d);
        this.state = 'walk'; this.stateT = 12;
      } else if (r < 0.8) { this.state = 'feed'; this.stateT = 3 + R() * 4; }
      else { this.state = R() < 0.5 ? 'stand' : 'alert'; this.stateT = 2 + R() * 3; }
    }
    const p = this.root.position;
    let bob = 0;
    if (this.state === 'walk' && this.target) {
      const dx = this.target.x - p.x, dz = this.target.z - p.z, d = Math.hypot(dx, dz);
      const want = Math.atan2(-dz, dx); let dh = want - this.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      this.heading += dh * Math.min(1, dt * 2.5); this.root.rotation.y = this.heading;
      const sp = 0.38 * sm(0.05, 0.4, d) * (Math.abs(dh) < 0.8 ? 1 : 0.2);
      p.x += Math.cos(this.heading) * sp * dt; p.z -= Math.sin(this.heading) * sp * dt;
      this.walkPh += dt * 4.2;
      bob = 0.02 * Math.sin(this.walkPh * 2);
      if (d < 0.08) { this.state = 'stand'; this.stateT = 1 + R() * 2; }
      this.blendTo('stand', Math.min(1, dt * 3));
    } else if (this.state === 'feed') {
      this.blendTo('feed', Math.min(1, dt * 2.2));
      bob = -0.06 * Math.max(0, Math.sin(this.t * 6)) * (Math.sin(this.t * 0.9) > 0.2 ? 1 : 0); // 一下下啄
      this.walkPh = lerp(this.walkPh, Math.round(this.walkPh / Math.PI) * Math.PI, Math.min(1, dt * 3));
    } else {
      this.blendTo(this.state, Math.min(1, dt * 2.2));
      this.walkPh = lerp(this.walkPh, Math.round(this.walkPh / Math.PI) * Math.PI, Math.min(1, dt * 3));
    }
    p.y = ground(p.x, p.z);
    this.pivot.rotation.z = this.cur.body;
    this.setLegs(this.walkPh);
    this.applyNeck(bob);
  }
}

// 天上鹤群用的实例化几何：就是上面这只鹤摆成飞行姿势（颈前伸、腿后拖、双翅平展）后合成一个网格。
// 坐标换成鸟群的约定：+z 朝前、翼展沿 x、身体中心在原点。aWing：0 身体，1 内翅（肩到腕），2 外翅（腕到翅尖），
// 振翅在顶点着色器里绕肩、绕腕转。WING_SHOULDER 是肩的位置（x 半宽、y 高）
export const WING_SHOULDER = { x: 0.09, y: 0.11, wrist: 0.46 };
export function flyingCraneGeometry() {
  const c = new Crane(0, 0, { seed: 3 });
  c.root.scale.setScalar(1);
  c.blendTo('fly', 1); c.pivot.rotation.z = c.cur.body;
  c.folded.visible = false;
  c.legs.forEach((L) => { L.hip.rotation.z = -1.45; L.ankle.rotation.z = 0; });
  c.wings.forEach((w) => { w.mount.visible = true; w.sh.rotation.x = 0; w.wr.rotation.x = 0; });
  c.applyNeck(0);
  c.root.updateMatrixWorld(true);
  // 鹤局部：头朝 +x，身体中心约在 (-0.07, 1.0)；转成 +z 朝前
  const toBird = new THREE.Matrix4().makeRotationY(-Math.PI / 2).multiply(new THREE.Matrix4().makeTranslation(0.07, -0.99, 0));
  const parts = [];
  c.root.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    let vis = true; for (let q = o; q; q = q.parent) if (!q.visible) vis = false;
    if (!vis) return;
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toBird, o.matrixWorld));
    const n = g.attributes.position.count, kind = c.wings.some((w) => w.wr.children.includes(o)) ? 2 : c.wings.some((w) => w.sh.children.includes(o)) ? 1 : 0;
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', g.attributes.position);
    out.setAttribute('color', g.attributes.color);
    out.setAttribute('aWing', new THREE.BufferAttribute(new Float32Array(n).fill(kind), 1));
    parts.push(out);
  });
  let n = 0; for (const g of parts) n += g.attributes.position.count;
  const merged = new THREE.BufferGeometry();
  for (const [key, size] of [['position', 3], ['color', 3], ['aWing', 1]]) {
    const arr = new Float32Array(n * size); let o = 0;
    for (const g of parts) { arr.set(g.attributes[key].array, o); o += g.attributes[key].array.length; }
    merged.setAttribute(key, new THREE.BufferAttribute(arr, size));
  }
  merged.computeVertexNormals();
  return merged;
}
