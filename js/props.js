// 场景物件：建筑（明式构件程序化拼装）、山石主峰、玉女潭崖壁、树木、云、桥与石阶。
// 静态物件按材质合并成少量网格，树和石块用实例化，控制绘制调用数。
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { terrainHeight, groundHeight, pathAt, waterLevel, slopeAt, smooth, rand, fbm, vnoise,
  POND, POOL, PADS, STREAM, COLLIDERS, addSurface, pondShape } from './world.js';

const C = (h) => new THREE.Color(h);
export const COL = {
  zhu: C('#ad4c38'), tile: C('#67635a'), wall: C('#dcc8a4'), wood: C('#5a3e2c'), stone: C('#a39478'),
  lattice: C('#d6c29e'), thatch: C('#a8916a'), trunk: C('#c8a582'), trunkPine: C('#b48f6a'), bamboo: C('#6f8d5a'), vine: C('#3e4a36'),
};

// ---------- 几何拼装 ----------
class Kit {
  constructor() { this.parts = []; }
  add(geo, color, kind = 0, matrix = null) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (matrix) g.applyMatrix4(matrix);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    const n = g.attributes.position.count, col = new Float32Array(n * 3), k = new Float32Array(n).fill(kind);
    for (let i = 0; i < n; i++) { col[i * 3] = color.r; col[i * 3 + 1] = color.g; col[i * 3 + 2] = color.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aKind', new THREE.BufferAttribute(k, 1));
    for (const key of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color', 'aKind'].includes(key)) g.deleteAttribute(key);
    this.parts.push(g); return this;
  }
  box(w, h, d, x, y, z, color, kind = 0, ry = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (kind === 2) { // 格扇：uv 用米为单位
      const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.max(w, d) / 1.2, uv.getY(i) * h / 1.2);
    }
    const m = new THREE.Matrix4().makeRotationY(ry).setPosition(x, y + h / 2, z);
    return this.add(g, color, kind, m);
  }
  cyl(r0, r1, h, x, y, z, color, seg = 8) {
    return this.add(new THREE.CylinderGeometry(r1, r0, h, seg, 1), color, 0, new THREE.Matrix4().setPosition(x, y + h / 2, z));
  }
  geometry(matrix) {
    const g = mergeGeometries(this.parts, false);
    if (matrix) g.applyMatrix4(matrix);
    return g;
  }
}

// 曲面屋顶：从檐口到屋脊的凹曲面，翼角起翘。edges: [[E0,E1,R0,R1], ...]，tRange 用于腰檐只取下半截
function roofFaces(kit, faces, y0, rh, curl, color, tMax = 1, nu = 10, nt = 6) {
  for (const [E0, E1, R0, R1] of faces) {
    const pos = [], uv = [];
    const P = (u, t) => {
      const ex = E0[0] + (E1[0] - E0[0]) * u, ez = E0[1] + (E1[1] - E0[1]) * u;
      const rx = R0[0] + (R1[0] - R0[0]) * u, rz = R0[1] + (R1[1] - R0[1]) * u;
      const tt = t * tMax;
      const corner = Math.pow(Math.abs(2 * u - 1), 6) * (1 - tt) * (1 - tt);
      return [ex + (rx - ex) * tt, y0 + rh * Math.pow(tt, 1.7) + curl * corner, ez + (rz - ez) * tt];
    };
    const len = Math.hypot(E1[0] - E0[0], E1[1] - E0[1]);
    for (let j = 0; j < nt; j++) for (let i = 0; i < nu; i++) {
      const u0 = i / nu, u1 = (i + 1) / nu, t0 = j / nt, t1 = (j + 1) / nt;
      const a = P(u0, t0), b = P(u1, t0), c = P(u0, t1), d = P(u1, t1);
      pos.push(...a, ...b, ...c, ...b, ...d, ...c);
      uv.push(u0 * len, t0, u1 * len, t0, u0 * len, t1, u1 * len, t0, u1 * len, t1, u0 * len, t1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    kit.add(g, color, 1);
  }
}
function hipRoof(kit, W, D, L, y0, rh, curl, color, tMax = 1) {
  const e = [[-W, D], [W, D], [W, -D], [-W, -D]], r = [[-L, 0], [L, 0], [L, 0], [-L, 0]];
  roofFaces(kit, [
    [e[0], e[1], r[0], r[1]], [e[1], e[2], r[1], r[2]], [e[2], e[3], r[2], r[3]], [e[3], e[0], r[3], r[0]],
  ], y0, rh, curl, color, tMax);
  if (tMax >= 1 && L > 0) { kit.box(2 * L + 0.5, 0.35, 0.35, 0, y0 + rh - 0.1, 0, COL.tile.clone().multiplyScalar(0.7)); }
}
function hexRoof(kit, R, y0, rh, curl, color) {
  const faces = [];
  for (let k = 0; k < 6; k++) {
    const a0 = (k / 6) * Math.PI * 2 + Math.PI / 6, a1 = ((k + 1) / 6) * Math.PI * 2 + Math.PI / 6;
    faces.push([[Math.cos(a0) * R, Math.sin(a0) * R], [Math.cos(a1) * R, Math.sin(a1) * R], [0, 0], [0, 0]]);
  }
  roofFaces(kit, faces, y0, rh, curl, color);
  kit.add(new THREE.SphereGeometry(0.22, 8, 6), COL.tile, 0, new THREE.Matrix4().setPosition(0, y0 + rh + 0.15, 0));
  kit.add(new THREE.ConeGeometry(0.1, 0.6, 6), COL.tile, 0, new THREE.Matrix4().setPosition(0, y0 + rh + 0.55, 0));
}

// ---------- 建筑 ----------
// 玉光閣：两层楼阁，下层白墙格扇，腰檐，上层回廊凭栏，歇山顶
export function buildYuguangGe() {
  const k = new Kit();
  k.box(10.6, 0.6, 7.6, 0, 0, 0, COL.stone);
  k.box(8.2, 3.4, 5.4, 0, 0.6, 0, COL.wall);
  for (const x of [-2.9, -1.7, 1.7, 2.9]) k.box(1.0, 1.9, 0.08, x, 1.6, 2.72, COL.lattice, 2);
  k.box(1.6, 2.6, 0.1, 0, 0.6, 2.7, COL.wood);
  for (const x of [-4.2, -2.3, -0.9, 0.9, 2.3, 4.2]) for (const z of [-2.8, 2.8]) k.cyl(0.17, 0.15, 3.6, x, 0.6, z, COL.zhu);
  for (const z of [-0.9, 0.9]) for (const x of [-4.2, 4.2]) k.cyl(0.17, 0.15, 3.6, x, 0.6, z, COL.zhu);
  k.box(8.8, 0.35, 6.0, 0, 3.95, 0, COL.zhu);
  hipRoof(k, 5.4, 3.9, 0, 4.0, 2.2, 0.45, COL.tile, 0.42);
  // 上层：楼板、回廊、栏杆
  k.box(7.6, 0.22, 5.4, 0, 4.4, 0, COL.wood);
  k.box(5.4, 2.6, 3.2, 0, 4.62, -0.4, COL.wall);
  for (const x of [-1.9, -0.65, 0.65, 1.9]) k.box(1.0, 1.7, 0.08, x, 5.0, 1.22, COL.lattice, 2);
  for (const x of [-3.6, -1.2, 1.2, 3.6]) for (const z of [-2.5, 2.5]) k.cyl(0.14, 0.12, 2.9, x, 4.62, z, COL.zhu);
  // 栏杆（前、左、右）
  const railY = 4.62;
  k.box(7.3, 0.1, 0.1, 0, railY + 0.95, 2.55, COL.zhu); k.box(7.3, 0.08, 0.08, 0, railY + 0.45, 2.55, COL.zhu);
  for (const s of [-1, 1]) { k.box(0.1, 0.1, 5.0, s * 3.65, railY + 0.95, 0, COL.zhu); k.box(0.08, 0.08, 5.0, s * 3.65, railY + 0.45, 0, COL.zhu); }
  for (let i = 0; i <= 14; i++) k.box(0.07, 0.95, 0.07, -3.6 + i * (7.2 / 14), railY, 2.55, COL.zhu);
  for (const s of [-1, 1]) for (let i = 0; i <= 9; i++) k.box(0.07, 0.95, 0.07, s * 3.65, railY, -2.4 + i * (4.8 / 9), COL.zhu);
  k.box(7.9, 0.3, 5.6, 0, 7.5, 0, COL.zhu);
  hipRoof(k, 4.9, 3.6, 1.9, 7.75, 2.7, 0.65, COL.tile);
  return k.geometry();
}
export const YUGUANG = { x: 9, z: -9.5, ry: 0.22, floor2: 4.84 };

export function buildHexPavilion(R = 1.8, h = 2.6) {
  const k = new Kit();
  k.cyl(R + 0.5, R + 0.6, 0.4, 0, 0, 0, COL.stone, 6);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6, x = Math.cos(a) * R, z = Math.sin(a) * R;
    k.cyl(0.11, 0.1, h, x, 0.4, z, COL.zhu);
    const a1 = ((i + 1) / 6) * Math.PI * 2 + Math.PI / 6, x1 = Math.cos(a1) * R, z1 = Math.sin(a1) * R;
    const len = Math.hypot(x1 - x, z1 - z), ry = -Math.atan2(z1 - z, x1 - x);
    if (i !== 1) k.box(len, 0.45, 0.3, (x + x1) / 2, 0.4, (z + z1) / 2, COL.wood, 0, ry);
    k.box(len, 0.25, 0.18, (x + x1) / 2, 0.4 + h - 0.25, (z + z1) / 2, COL.zhu, 0, ry);
  }
  hexRoof(k, R * 1.5, 0.4 + h, 1.7, 0.5, COL.tile);
  return k.geometry();
}

export function buildHall(w, d, h, { wall = COL.wall, roof = COL.tile, roofKind = 1, front = 'lattice' } = {}) {
  const k = new Kit();
  k.box(w + 1, 0.4, d + 1, 0, 0, 0, COL.stone);
  k.box(w, h, d, 0, 0.4, 0, wall);
  if (front === 'lattice') for (let i = 0; i < 4; i++) k.box(w / 5, h * 0.55, 0.08, -w / 2 + w / 5 * (i + 0.5) + (i >= 2 ? w / 5 : 0), 0.4 + h * 0.25, d / 2 + 0.02, COL.lattice, 2);
  k.box(w / 5, h * 0.75, 0.1, 0, 0.4, d / 2 + 0.03, COL.wood);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.cyl(0.13, 0.12, h, sx * (w / 2 + 0.05), 0.4, sz * (d / 2 + 0.05), COL.zhu);
  const kit2 = k;
  hipRoof(kit2, w / 2 + 0.9, d / 2 + 0.8, w * 0.22, 0.4 + h, Math.min(w, d) * 0.42, 0.35, roof);
  if (roofKind === 3) kit2.parts.slice(-5).forEach((g) => g.attributes.aKind.array.fill(3));
  return k.geometry();
}

// 拱桥（沸玉橋）：桥面可走
export function buildArchBridge(len, width, rise) {
  const k = new Kit();
  const n = 12;
  for (let i = 0; i < n; i++) {
    const s0 = i / n, s1 = (i + 1) / n, x0 = -len / 2 + s0 * len, x1 = -len / 2 + s1 * len;
    const y0 = rise * Math.sin(Math.PI * s0), y1 = rise * Math.sin(Math.PI * s1);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, ang = Math.atan2(y1 - y0, x1 - x0), L = Math.hypot(x1 - x0, y1 - y0);
    const m = new THREE.Matrix4().makeRotationZ(ang).setPosition(cx, cy - 0.12, 0);
    k.add(new THREE.BoxGeometry(L + 0.05, 0.24, width), COL.wood, 0, m);
    for (const s of [-1, 1]) {
      const mr = new THREE.Matrix4().makeRotationZ(ang).setPosition(cx, cy + 0.75, s * (width / 2 - 0.05));
      k.add(new THREE.BoxGeometry(L + 0.05, 0.08, 0.08), COL.zhu, 0, mr);
      k.cyl(0.05, 0.05, 0.8, x0, y0 - 0.05, s * (width / 2 - 0.05), COL.zhu, 5);
    }
  }
  return k.geometry();
}

// 回廊（大觀廊，灰盒）：沿弧线排列的柱与连续屋顶
export function buildCorridor(R, a0, a1, n = 12) {
  const k = new Kit();
  for (let i = 0; i < n; i++) {
    const a = a0 + (a1 - a0) * (i + 0.5) / n, x = Math.cos(a) * R, z = Math.sin(a) * R;
    const seg = (2 * Math.PI * R * Math.abs(a1 - a0)) / (2 * Math.PI * n);
    const m = new THREE.Matrix4().makeRotationY(-a + Math.PI / 2).setPosition(x, 0, z);
    const kk = new Kit();
    kk.box(seg + 0.1, 0.3, 3, 0, 0, 0, COL.stone);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) kk.cyl(0.12, 0.11, 2.6, sx * seg / 2, 0.3, sz * 1.2, COL.zhu, 6);
    kk.box(seg, 0.25, 2.8, 0, 2.8, 0, COL.zhu);
    hipRoof(kk, seg / 2 + 0.25, 2.0, seg / 2, 3.0, 1.1, 0.05, COL.tile);
    k.parts.push(kk.geometry(m));
  }
  return k.geometry();
}

// ---------- 山石 ----------
// 主峰/巨岩：一圈圈收分的不规则柱体，aH 从脚到顶 0→1（顶部石青、脚部赭石）
export function spireGeometry(R, H, seed, { lean = 0, bulge = 0.25, rings = 34, seg = 32, top = 0.35 } = {}) {
  const r = rand(seed), pos = [], aH = [], idx = [];
  const ph = r() * 10;
  for (let j = 0; j <= rings; j++) {
    const t = j / rings, y = t * H;
    const rad = R * (1 - (1 - top) * Math.pow(t, 1.3)) * (1 + bulge * Math.sin(t * 7 + ph) * 0.5) * (t > 0.92 ? Math.sqrt(Math.max(0.02, (1 - t) / 0.08)) * 0.9 + 0.1 : 1);
    const ox = lean * t * t * H, oz = Math.sin(t * 3 + ph) * R * 0.1;
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      const n = 1 + 0.28 * (vnoise(Math.cos(a) * 2 + ph, t * 4 + Math.sin(a) * 2) - 0.5) + 0.12 * Math.sin(a * 3 + t * 9 + ph)
        + 0.1 * (vnoise(Math.cos(a) * 6 + ph, t * 14 + Math.sin(a) * 5) - 0.5) + 0.03 * Math.sin(t * H * 1.3 + Math.sin(a * 2 + ph) * 2); // 起伏的横向层理
      pos.push(ox + Math.cos(a) * rad * n, y, oz + Math.sin(a) * rad * n);
      aH.push(t);
    }
  }
  for (let j = 0; j < rings; j++) for (let i = 0; i < seg; i++) {
    const a = j * seg + i, b = j * seg + (i + 1) % seg, c = a + seg, d = b + seg;
    idx.push(a, c, b, b, c, d);
  }
  const topI = pos.length / 3; pos.push(lean * H, H * 1.01, 0); aH.push(1);
  for (let i = 0; i < seg; i++) idx.push(rings * seg + i, topI, rings * seg + (i + 1) % seg);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aH', new THREE.Float32BufferAttribute(aH, 1));
  g.setIndex(idx);
  g.computeVertexNormals(); // 先在共享顶点上算平滑法线，石面不再露出多边形棱角
  return g.toNonIndexed();
}
export function boulderGeometry(seed, detail = 3) {
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('uv'); g.deleteAttribute('normal');
  g = mergeVertices(g);
  const p = g.attributes.position, r = rand(seed), ph = r() * 9;
  const aH = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const s = 0.75 + 0.5 * vnoise(x * 1.7 + ph, z * 1.7 + y * 1.3) + 0.08 * (vnoise(x * 5 + ph, y * 5 + z * 4) - 0.5);
    p.setXYZ(i, x * s * 1.25, (y * 0.75 + 0.35) * s + Math.sin(y * 8 + x) * 0.02, z * s);
    aH[i] = (y + 1) / 2;
  }
  g.setAttribute('aH', new THREE.BufferAttribute(aH, 1));
  g.computeVertexNormals(); // 平滑法线
  return g.toNonIndexed();
}

// 精细巨石（玉女潭手摆）：细分二十面体 + 多层噪声起伏 + 横向层理，顶部隆起、底部压平
export function rockGeometry(seed, detail = 4) {
  let g = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('uv'); g.deleteAttribute('normal');
  g = mergeVertices(g);
  const p = g.attributes.position, r = rand(seed), ph = r() * 20, aH = new Float32Array(p.count);
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const big = fbm(v.x * 1.1 + ph, v.z * 1.1 + v.y * 0.9) - 0.5;
    const mid = vnoise(v.x * 3.1 + ph, v.y * 3.3 + v.z * 2.7) - 0.5;
    const fine = vnoise(v.x * 8 + ph, v.z * 8 + v.y * 7) - 0.5;
    let rad = 1 + big * 0.7 + mid * 0.22 + fine * 0.06;
    let y = v.y * rad;
    y += Math.sin(y * 9 + mid * 4) * 0.035;               // 层理：一道道横向石棱
    const lump = 1 + 0.25 * Math.max(0, v.y);              // 顶部馒头状隆起
    p.setXYZ(i, v.x * rad * 1.25 * lump, Math.max(-0.25, y * 0.82 + 0.25), v.z * rad * lump);
    aH[i] = (v.y + 1) / 2;
  }
  g.setAttribute('aH', new THREE.BufferAttribute(aH, 1));
  g.computeVertexNormals();
  return g;
}

// 玉女潭崖壁：沿潭后岸的弧形石壁，贴原画皴法
export function buildCliff() {
  const P = POND, segs = 56, rows = 10, pos = [], uv = [], idx = [];
  const th0 = 0.1, th1 = Math.PI - 0.1;
  let arc = 0, last = null; const cols = [];
  for (let i = 0; i <= segs; i++) {
    const th = th0 + (th1 - th0) * (i / segs);
    const x = P.x + P.rx * 0.985 * Math.cos(th), z = P.z - P.rz * 0.985 * Math.sin(th);
    if (last) arc += Math.hypot(x - last[0], z - last[1]); last = [x, z];
    const ox = P.x + P.rx * 1.25 * Math.cos(th), oz = P.z - P.rz * 1.25 * Math.sin(th);
    const top = terrainHeight(ox, oz) + 0.4 + (vnoise(i * 0.35, 3) - 0.5) * 2.4, bot = P.wl - 1.6;
    cols.push({ x, z, th, arc, top, bot });
  }
  for (let i = 0; i <= segs; i++) {
    const c = cols[i];
    for (let j = 0; j <= rows; j++) {
      const t = j / rows, y = c.bot + (c.top - c.bot) * t;
      const n = (vnoise(c.arc * 0.45, y * 0.25) - 0.5) * 1.8 + Math.sin(c.arc * 0.9) * 0.5;
      const lip = t > 0.86 ? (t - 0.86) / 0.14 : 0; // 崖顶向后折成一道檐，盖住崖后与台地之间的缝
      const rr = 0.972 + n * 0.012 * (1 - lip) + lip * lip * 0.2;
      pos.push(P.x + P.rx * rr * Math.cos(c.th), y, P.z - P.rz * rr * Math.sin(c.th));
      uv.push(c.arc / ((c.top - c.bot) * 2.4), t);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < rows; j++) {
    const a = i * (rows + 1) + j, b = a + rows + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// ---------- 树 ----------
function tube(points, r0, r1, radial = 5, { gnarl = 0, seg = 1.5, seed = 0 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points), n = Math.max(2, Math.round(points.length * seg)), pos = [], idx = [];
  const frames = curve.computeFrenetFrames(n, false);
  for (let i = 0; i <= n; i++) {
    const t = i / n, p = curve.getPointAt(t), N = frames.normals[i], B = frames.binormals[i];
    const r = (r0 + (r1 - r0) * Math.pow(t, 0.8)) * (1 + gnarl * (vnoise(t * 7 + seed, seed * 1.7) - 0.4) * 1.2);
    for (let k = 0; k < radial; k++) {
      const a = (k / radial) * Math.PI * 2;
      // 树皮的棱与瘤：沿圆周起伏，越近根部越明显
      const rr = r * (1 + gnarl * (0.22 * Math.sin(a * 3 + t * 6 + seed) * (1 - t * 0.6) + 0.18 * (vnoise(a * 1.6 + seed, t * 11) - 0.5)));
      pos.push(p.x + (N.x * Math.cos(a) + B.x * Math.sin(a)) * rr, p.y + (N.y * Math.cos(a) + B.y * Math.sin(a)) * rr, p.z + (N.z * Math.cos(a) + B.z * Math.sin(a)) * rr);
    }
  }
  for (let i = 0; i < n; i++) for (let k = 0; k < radial; k++) { const a = i * radial + k, b = i * radial + (k + 1) % radial, c = a + radial, d = b + radial; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
// 叶卡：记下所属叶团的中心与随机数（摇动时各团各自的相位）和卡面原法线（侧对镜头时淡出）
function card(w, h, m, c, rr) {
  const g = new THREE.PlaneGeometry(w, h); g.applyMatrix4(m);
  const cl = new Float32Array(16); for (let i = 0; i < 4; i++) cl.set([c.x, c.y, c.z, rr], i * 4);
  g.setAttribute('aCl', new THREE.BufferAttribute(cl, 4));
  g.setAttribute('aPN', g.attributes.normal.clone());
  return g;
}
// 返回 { trunk, leaves }，都在树的局部坐标，地面 y=0
export function treeVariant(type, seed) {
  const r = rand(seed), trunk = new Kit(), leaves = [];
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  // 叶团：不再是两三张大卡十字交叉，而是五六张半大的卡在团内错开、朝向打散，侧看也不露纸边
  const cluster = (c, s, flat = false) => {
    const rr = r();
    if (flat) { // 松针：几层平伸的扇面
      for (let i = 0; i < 3; i++) {
        const o = V((r() - 0.5) * s * 0.5, (r() - 0.3) * s * 0.25, (r() - 0.5) * s * 0.5).add(c);
        const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-Math.PI / 2 + (r() - 0.5) * 0.6, r() * Math.PI, (r() - 0.5) * 0.35)).setPosition(o);
        leaves.push(card(s * 1.45, s * 0.75, m, c, rr));
      }
      const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0, r() * Math.PI, 0)).setPosition(c.x, c.y + 0.1, c.z); leaves.push(card(s * 1.3, s * 0.5, m, c, rr));
      return;
    }
    const n = 5 + Math.floor(r() * 2), k = 0.62;
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * s * 0.38;
      const o = V(Math.cos(a) * d, (r() - 0.4) * s * 0.4, Math.sin(a) * d).add(c);
      const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler((r() - 0.5) * 1.0, r() * Math.PI * 2, (r() - 0.5) * 0.6)).setPosition(o);
      const sz = s * k * (0.85 + r() * 0.3);
      leaves.push(card(sz, sz, m, c, rr));
    }
  };
  const hcard = (c, sz) => { const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-Math.PI / 2 + (r() - 0.5) * 0.6, 0, r() * Math.PI)).setPosition(c.x, c.y + 0.2, c.z); leaves.push(card(sz, sz * 0.9, m, c, r())); };
  if (type === 'broad') {
    const H = 5 + r() * 3, lean = (r() - 0.5) * 1.6;
    const pts = [V(0, 0, 0), V(lean * 0.2, H * 0.35, 0.2), V(lean * 0.6, H * 0.7, -0.2), V(lean, H, 0)];
    trunk.add(tube(pts, 0.45, 0.13, 7, { gnarl: 0.45, seg: 2.5, seed: seed }), COL.trunk, 4);
    const nb = 3 + Math.floor(r() * 3);
    for (let i = 0; i < nb; i++) {
      const t = 0.45 + r() * 0.4, a = r() * Math.PI * 2, L = 1.8 + r() * 2.2;
      const b0 = V(lean * t, H * t, 0), b1 = V(b0.x + Math.cos(a) * L * 0.5, b0.y + L * 0.45, b0.z + Math.sin(a) * L * 0.5), b2 = V(b0.x + Math.cos(a) * L, b0.y + L * 0.7, b0.z + Math.sin(a) * L);
      trunk.add(tube([b0, b1, b2], 0.13, 0.05, 4), COL.trunk);
      cluster(b2, 2.4 + r() * 1.2);
    }
    cluster(V(lean, H + 0.5, 0), 3.2 + r());
    cluster(V(lean * 0.7, H * 0.75, 0), 2.6);
  } else if (type === 'old') {
    // 枯藤老树：粗短虬曲的主干、蟹爪般折曲的枝、枝头成团夹叶，挂几条老藤，留一两根枯枝
    const H = 4.8 + r() * 2.2, lean = (r() - 0.5) * 3.2, tw = r() * 6, sd = r() * 50;
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8, zig = Math.sin(t * 9 + tw) * 0.55 * t + Math.sin(t * 17 + tw * 2) * 0.18 * t;
      pts.push(V(lean * t * t + zig, H * (t + 0.08 * Math.sin(t * 5 + tw)), Math.cos(t * 7 + tw) * 0.5 * t));
    }
    pts[0].y = -0.3;
    trunk.add(tube(pts, 0.72, 0.24, 9, { gnarl: 0.6, seg: 2.5, seed: sd }), COL.trunk, 4);
    // 盘根
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + r(); const L = 1.4 + r() * 0.8;
      trunk.add(tube([V(0, 1.1, 0), V(Math.cos(a) * 0.8, 0.35, Math.sin(a) * 0.8), V(Math.cos(a) * L, -0.05, Math.sin(a) * L), V(Math.cos(a + 0.3) * (L + 0.5), -0.3, Math.sin(a + 0.3) * (L + 0.5))], 0.42, 0.08, 7, { gnarl: 0.5, seed: sd + i }), COL.trunk, 4); }
    // 蟹爪枝：每根三折，末端分叉
    const crab = (p0, a, L, rad, depth) => {
      const pp = [p0]; let x = p0.x, y = p0.y, z = p0.z, ang = a;
      for (let k = 1; k <= 3; k++) { ang += (k % 2 ? 0.6 : -0.7) * (r() + 0.3); const l = L / 3 * (1.1 - k * 0.1);
        x += Math.cos(ang) * l; z += Math.sin(ang) * l; y += l * (0.25 + r() * 0.5) * (depth ? 0.6 : 1) - (k === 2 ? l * 0.25 : 0); pp.push(V(x, y, z)); }
      trunk.add(tube(pp, rad, rad * 0.3, depth ? 5 : 7, { gnarl: 0.4, seg: 2.5, seed: sd + a }), COL.trunk, 4);
      return pp;
    };
    const nb = 4 + Math.floor(r() * 3);
    for (let i = 0; i < nb; i++) {
      const t = 0.45 + (i / nb) * 0.45 + r() * 0.05, c0 = pts[Math.min(8, Math.round(t * 8))];
      const a = (i / nb) * Math.PI * 2 + r() * 1.2, L = 3 + r() * 2.8;
      const pp = crab(V(c0.x, c0.y, c0.z), a, L, 0.34, 0);
      const dead = r() < 0.1;
      for (let k = 1; k <= 3; k++) {
        if (k < 3 && r() < 0.25) continue;
        const e = crab(pp[k], a + (r() - 0.5) * 2.4, 1.4 + r() * 1.4, 0.1, 1);
        if (!dead) { cluster(e[3], 2.9 + r() * 1.1); cluster(V(e[3].x, e[3].y + 1.1, e[3].z), 2.2 + r() * 0.6); cluster(e[2], 2.4 + r() * 0.8); }
      }
      // 叶团沿枝层层往上堆成穹顶，只在最上面压一张平卡，侧看不再是一把把伞
      if (!dead) { cluster(pp[3], 3.5 + r() * 1.1); cluster(V(pp[3].x * 0.7, pp[3].y + 1.4, pp[3].z * 0.7), 3 + r()); cluster(pp[2], 2.8); if (r() < 0.5) hcard(pp[3], 3.4 + r()); }
      // 老藤：从枝上垂下的几根细藤
      if (r() < 0.22) for (let v = 0; v < 2; v++) { const q = pp[2 + v % 2]; const len = 1.5 + r() * 2.2;
        trunk.add(tube([q, V(q.x + 0.15, q.y - len * 0.4, q.z + 0.1), V(q.x + 0.05 + (r() - 0.5) * 0.3, q.y - len * 0.8, q.z), V(q.x + (r() - 0.5) * 0.4, q.y - len, q.z + (r() - 0.5) * 0.4)], 0.035, 0.018, 4), COL.vine); }
    }
    // 绕干的藤
    { const vp = []; for (let i = 0; i <= 10; i++) { const t = i / 10, c0 = pts[Math.min(8, Math.round(t * 6))], a = t * 9 + tw; vp.push(V(c0.x + Math.cos(a) * 0.75 * (1 - t * 0.5), c0.y, c0.z + Math.sin(a) * 0.75 * (1 - t * 0.5))); }
      trunk.add(tube(vp, 0.06, 0.04, 4, { seg: 3 }), COL.vine); }
    const tp = pts[8];
    cluster(V(tp.x, tp.y + 0.6, tp.z), 3.6 + r()); hcard(V(tp.x, tp.y + 0.9, tp.z), 4.0);
  } else if (type === 'pine') {
    const H = 9 + r() * 5, lean = (r() - 0.5) * 2.2;
    const pts = [V(0, -0.2, 0), V(lean * 0.05 + (r() - 0.5) * 0.5, H * 0.18, (r() - 0.5) * 0.6), V(lean * 0.2, H * 0.38, (r() - 0.5) * 0.8), V(lean * 0.45 + (r() - 0.5) * 0.6, H * 0.6, (r() - 0.5) * 0.8), V(lean * 0.7, H * 0.8, (r() - 0.5) * 0.5), V(lean, H, 0)];
    trunk.add(tube(pts, 0.42, 0.1, 7, { gnarl: 0.35, seg: 3, seed: seed }), COL.trunkPine, 4);
    const tiers = 4 + Math.floor(r() * 3);
    for (let i = 0; i < tiers; i++) {
      const t = 0.5 + 0.5 * (i / tiers), a = r() * Math.PI * 2, L = (1.2 + r() * 2.2) * (1.15 - t * 0.6);
      const b0 = V(lean * t * t, H * t, 0), b2 = V(b0.x + Math.cos(a) * L, b0.y + 0.3 + r() * 0.5, b0.z + Math.sin(a) * L);
      trunk.add(tube([b0, V((b0.x + b2.x) / 2, b0.y + 0.4, (b0.z + b2.z) / 2), b2], 0.09, 0.04, 4), COL.trunkPine);
      cluster(b2, 1.6 + r() * 0.8, true);
    }
    cluster(V(lean, H + 0.3, 0), 1.8, true);
  } else if (type === 'tallpine') {
    // 初平林的高松：细直的干，只在梢头几层平伸的松针
    const H = 13 + r() * 5, sway = (r() - 0.5) * 1.2;
    const pts = []; for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push(V(sway * t * t + Math.sin(t * 7 + seed) * 0.15, H * t - (i ? 0 : 0.3), Math.cos(t * 5 + seed) * 0.12)); }
    trunk.add(tube(pts, 0.3, 0.08, 6, { gnarl: 0.25, seg: 3, seed }), COL.trunkPine, 4);
    const tiers = 3 + Math.floor(r() * 2);
    for (let i = 0; i < tiers; i++) {
      const t = 0.7 + 0.3 * (i / tiers), a = r() * Math.PI * 2, L = (1.0 + r() * 1.4) * (1.2 - t * 0.5);
      const b0 = V(sway * t * t, H * t, 0), b2 = V(b0.x + Math.cos(a) * L, b0.y + 0.2 + r() * 0.4, b0.z + Math.sin(a) * L);
      trunk.add(tube([b0, V((b0.x + b2.x) / 2, b0.y - 0.15, (b0.z + b2.z) / 2), b2], 0.07, 0.03, 4), COL.trunkPine);
      cluster(b2, 1.3 + r() * 0.6, true);
    }
    cluster(V(sway, H + 0.2, 0), 1.5, true);
  } else if (type === 'cypress') {
    // 杉柏：直干，墨点叶一团团从下往上收成窄塔
    const H = 9 + r() * 4;
    trunk.add(tube([V(0, -0.2, 0), V((r() - 0.5) * 0.3, H * 0.5, 0), V((r() - 0.5) * 0.3, H, 0)], 0.24, 0.05, 6, { gnarl: 0.2, seg: 3, seed }), COL.trunkPine, 4);
    const n = 5 + Math.floor(r() * 2);
    for (let i = 0; i < n; i++) {
      const t = 0.32 + 0.66 * (i / (n - 1)), sz = 2.3 * (1.12 - t * 0.75) + r() * 0.3;
      cluster(V((r() - 0.5) * 0.5, H * t, (r() - 0.5) * 0.5), sz);
    }
  } else if (type === 'fir') {
    // v39 杉（原画 IMG_1262、1261 的杉林）：直干；从四分之一高起一层层平伸的墨绿枝叶，越往上越短，收成窄塔
    const H = 11 + r() * 4;
    trunk.add(tube([V(0, -0.2, 0), V((r() - 0.5) * 0.3, H * 0.5, 0), V((r() - 0.5) * 0.2, H + 0.3, 0)], 0.26, 0.05, 6, { gnarl: 0.15, seg: 3, seed }), COL.trunkPine, 4);
    const n = 9 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const t = 0.24 + 0.76 * (i / (n - 1)), W = 2.0 * (1.08 - t) + 0.45, a0 = r() * Math.PI * 2;
      for (let j = 0; j < 2; j++) {
        const a = a0 + j * Math.PI + (r() - 0.5) * 0.8, L = W * (0.45 + r() * 0.3), b0 = V(0, H * t, 0), b2 = V(Math.cos(a) * L, H * t - 0.15 - r() * 0.2, Math.sin(a) * L);
        if (t < 0.85) trunk.add(tube([b0, V(b2.x / 2, b0.y - 0.05, b2.z / 2), b2], 0.06, 0.025, 4), COL.trunkPine);
        cluster(V(b2.x * 0.7, b2.y, b2.z * 0.7), W * 0.9 + 0.4, true);
      }
    }
    cluster(V(0, H + 0.2, 0), 0.9, true);
  } else if (type === 'shrub') {
    // 灌丛（原画坡包上、画面下缘一团团的矮树丛）：几根短枝从地里斜出，叶团挤成一个低矮的圆丘
    const n = 4 + Math.floor(r() * 3), W = 1.1 + r() * 0.5;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + r() * 0.8, d = W * (0.35 + r() * 0.55), h = 0.7 + r() * 0.8;
      const tip = V(Math.cos(a) * d, h, Math.sin(a) * d);
      trunk.add(tube([V(Math.cos(a) * 0.1, -0.1, Math.sin(a) * 0.1), V(tip.x * 0.5, h * 0.45, tip.z * 0.5), tip], 0.09, 0.035, 4, { gnarl: 0.4, seed: seed + i }), COL.trunk, 4);
      cluster(tip, 1.5 + r() * 0.6);
    }
    cluster(V(0, 1.35 + r() * 0.4, 0), 1.9 + r() * 0.5);
    hcard(V(0, 1.4, 0), 2.4 + r() * 0.6);
  } else if (type === 'dwarfpine') {
    // 矮松（原画流觴嶼、金晶巖下缘）：粗短虬曲的干斜出，几层平伸的松针盘
    const H = 2.2 + r() * 1.2, lean = 0.8 + r() * 1.2, a0 = r() * Math.PI * 2, cx = Math.cos(a0), cz = Math.sin(a0);
    const pts = []; for (let i = 0; i <= 5; i++) { const t = i / 5, zig = Math.sin(t * 7 + seed) * 0.3 * t; pts.push(V(cx * lean * t + zig * cz, H * t - (i ? 0 : 0.25), cz * lean * t - zig * cx)); }
    trunk.add(tube(pts, 0.24, 0.07, 6, { gnarl: 0.6, seg: 2.5, seed }), COL.trunkPine, 4);
    const tiers = 3 + Math.floor(r() * 2);
    for (let i = 0; i < tiers; i++) {
      const t = 0.45 + 0.55 * (i / tiers), a = a0 + (r() - 0.5) * 3.5, L = 0.9 + r() * 1.1;
      const b0 = pts[Math.min(5, Math.round(t * 5))], b2 = V(b0.x + Math.cos(a) * L, b0.y + 0.15 + r() * 0.3, b0.z + Math.sin(a) * L);
      trunk.add(tube([b0, V((b0.x + b2.x) / 2, b0.y + 0.25, (b0.z + b2.z) / 2), b2], 0.07, 0.03, 4), COL.trunkPine);
      cluster(b2, 1.25 + r() * 0.5, true);
    }
    cluster(V(pts[5].x, pts[5].y + 0.2, pts[5].z), 1.4, true);
  } else if (type === 'bamboo') {
    // 一丛竹：十来根竿挤在一起，竿直，往外微斜，上半截才生枝叶。成片种时一丛挨一丛，下面是透空的竿林，顶上叶子连成一片
    const n = 10 + Math.floor(r() * 5), CULM = new THREE.Color('#b3b588');
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 1.5, x = Math.cos(a) * d, z = Math.sin(a) * d;
      const H = 6.5 + r() * 3, lean = 0.1 + d * 0.3 + r() * 0.35, bx = Math.cos(a) * lean, bz = Math.sin(a) * lean;
      trunk.add(tube([V(x, 0, z), V(x + bx * 0.15, H * 0.5, z + bz * 0.15), V(x + bx, H, z + bz)], 0.085, 0.04, 5, { seg: 1 }), CULM.clone().multiplyScalar(0.9 + r() * 0.16), 8);
      for (let k = 0; k < 3; k++) { const t = 0.6 + k * 0.16 + r() * 0.06; cluster(V(x + bx * t * t, H * t, z + bz * t * t), (1.75 + r() * 0.5) * (1.1 - k * 0.15)); }
    }
  }
  const lg = mergeGeometries(leaves.map((g) => g.index ? g.toNonIndexed() : g));
  // 明暗法线换成树冠的体积法线：从树冠中心往外，再偏一点叶团自己的圆，整团叶子才有向光背光
  const P = lg.attributes.position, CL = lg.attributes.aCl, N = lg.attributes.normal, cen = V(0, 0, 0);
  for (let i = 0; i < CL.count; i++) cen.add(V(CL.getX(i), CL.getY(i), CL.getZ(i)));
  cen.multiplyScalar(1 / CL.count);
  const v = V(0, 0, 0), w = V(0, 0, 0);
  for (let i = 0; i < P.count; i++) {
    v.set(P.getX(i) - cen.x, (P.getY(i) - cen.y) * 0.8 + 0.6, P.getZ(i) - cen.z).normalize();
    w.set(P.getX(i) - CL.getX(i), P.getY(i) - CL.getY(i) + 0.3, P.getZ(i) - CL.getZ(i)).normalize();
    v.addScaledVector(w, 0.6).normalize(); N.setXYZ(i, v.x, v.y, v.z);
  }
  return { trunk: trunk.geometry(), leaves: lg };
}

// ---------- 云 ----------
export function cloudInstances(list) {
  const geo = new THREE.PlaneGeometry(1, 1);
  return { geo, matrices: list.map(([x, y, z, w]) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(w, w * 0.42, 1))) };
}

// ---------- 石阶 ----------
const LADDER = { base: new THREE.Color('#6a4b31'), rung: new THREE.Color('#b59a6b') };
export function buildStairs(points, o = {}) {
  const k = new Kit(); let prev = null;
  const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)));
  const L = curve.getLength(), n = Math.floor(L / 0.9);
  let py = null;
  for (let i = 0; i <= n; i++) {
    const p = curve.getPointAt(i / n), tg = curve.getTangentAt(i / n), y = terrainHeight(p.x, p.z);
    const ry = Math.atan2(tg.x, tg.z);
    // 陡处的台阶往下砌实，接到下一级，不像一块块悬着的木板
    const h = Math.max(0.28, py === null ? 0.28 : Math.abs(y - py) + 0.32);
    if (o.ladder) {
      // v35 第二章的石阶（原画 IMG_1263–1265）：画里是一道深褐的阶，一级级浅褐的阶沿横在上面，像一架梯子
      k.box(1.3, h, 0.86, p.x, y + 0.02 - h / 2, p.z, LADDER.base, 0, ry);
      k.box(1.42, 0.07, 0.22, p.x, y + 0.01 + h / 2, p.z, LADDER.rung, 0, ry); // Kit.box 的 y 是底；阶面在 y + 0.02 + h/2
    } else k.box(1.5, h, 0.8, p.x, y + 0.02 - h / 2, p.z, COL.stone, 0, ry);
    prev = p; py = y;
  }
  return k.geometry();
}

export { Kit, hipRoof, hexRoof };
