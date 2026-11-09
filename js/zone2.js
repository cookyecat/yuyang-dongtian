// 云山仙境（IMG_1265–1263）：磐玉隈巨岩、琪樹峡满坡的石青方石、天成碑一类的平顶巨石。
import * as THREE from 'three';
import { terrainBase, rocks2At, rand, vnoise, smooth } from './world.js';
import { craggyRockArrays } from './rockgen.js';

// 磐玉隈巨岩：和隐春巖一样，按 rocks2At 的石坎高度铺一张高度网格，盖在地形上
export function buildRocks2() {
  const x0 = -94, x1 = -34, z0 = -38, z1 = -8, st = 0.5;
  const nx = Math.round((x1 - x0) / st) + 1, nz = Math.round((z1 - z0) / st) + 1;
  const pos = new Float32Array(nx * nz * 3), aH = new Float32Array(nx * nz), aM = new Float32Array(nx * nz), idx = [];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = x0 + i * st, z = z0 + j * st, k = j * nx + i, g = terrainBase(x, z), M = rocks2At(x, z, g);
    pos[k * 3] = x; pos[k * 3 + 2] = z;
    pos[k * 3 + 1] = M.y > g + 0.02 ? M.y : g - 1.5;
    aH[k] = Math.max(0, M.a); aM[k] = M.ph || 0;
  }
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    if ([a, b, c, d].every((q) => aH[q] === 0)) continue;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aH', new THREE.BufferAttribute(aH, 1));
  g.setAttribute('aM', new THREE.BufferAttribute(aM, 1));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// 方石（原画琪樹峡满坡的石青石）：五到七条棱的石柱，腰上折一道，顶面斜切、微微隆起，面是平的。
// 原点在底面中心，高 1、半径约 1；aH 从底 0 到顶 1（石青罩在上半，脚下赭石）
export function blockRockGeometry(seed, { taper = 0.72, slant = 0.22 } = {}) {
  const r = rand(seed), n = 5 + Math.floor(r() * 3), ph = r() * 6.28;
  const ring = (y, k, jit) => {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = ph + (i + (r() - 0.5) * 0.5) / n * Math.PI * 2, rad = k * (0.8 + r() * 0.35) * (1 + jit * (r() - 0.5));
      pts.push([Math.cos(a) * rad * 1.15, y, Math.sin(a) * rad]);
    }
    return pts;
  };
  const tx = (r() - 0.5) * slant, tz = (r() - 0.5) * slant; // 顶面斜切的方向
  const lean = [(r() - 0.5) * 0.18, (r() - 0.5) * 0.12];
  const R0 = ring(0, 1, 0.1), R1 = ring(0.5 + r() * 0.18, 0.92 + r() * 0.12, 0.2), R2 = ring(1, taper * (0.85 + r() * 0.3), 0.25);
  for (const [R, t] of [[R1, 0.5], [R2, 1]]) for (const p of R) { p[0] += lean[0] * t; p[2] += lean[1] * t; p[1] += (p[0] * tx + p[2] * tz) * t; }
  const top = [lean[0], 1.06 + r() * 0.08, lean[1]];
  const pos = [], aH = [];
  const tri = (a, b, c) => { for (const p of [a, b, c]) { pos.push(p[0], p[1], p[2]); aH.push(Math.max(0, Math.min(1, p[1]))); } };
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    tri(R0[i], R1[i], R0[j]); tri(R0[j], R1[i], R1[j]);
    tri(R1[i], R2[i], R1[j]); tri(R1[j], R2[i], R2[j]);
    tri(R2[i], top, R2[j]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aH', new THREE.Float32BufferAttribute(aH, 1));
  g.computeVertexNormals(); // 不共享顶点：每个面是平的，石头有棱有角
  return g;
}
// v35 琪樹峡的石（原画 IMG_1264）：圆角的大方块。截面是圆角方（超椭圆），四壁直、微鼓，肩头圆，顶面略拱、斜一点；
// 壁上一两道浅竖槽，有的腰上错一道台。顶点共享、法线平滑，石面像原画那样是一片晕染，不是一块块平面。原点在底面中心，高 1、半径约 1
export function pillowRockGeometry(seed, { taper = 0.88, slant = 0.16, n = 26, m = 15, sq = 4.6, shoulder = 0.15, step = 0.35, front = 0 } = {}) {
  const r = rand(seed), ph = (r() - 0.5) * 0.5, p = sq * (0.85 + r() * 0.3);
  const tx = (r() - 0.5) * slant * 2, tz = (r() - 0.5) * slant * 2, lean = [(r() - 0.5) * 0.14, (r() - 0.5) * 0.1];
  const sh = shoulder * (0.7 + r() * 0.6), dome = 0.02 + r() * 0.05, bul = 0.015 + r() * 0.035, tone = r();
  const grooves = Array.from({ length: 1 + Math.floor(r() * 2.2) }, () => [r() * 6.28, 0.1 + r() * 0.12, 0.05 + r() * 0.07, r() * 0.3]);
  const ledge = r() < step ? [0.35 + r() * 0.3, 0.05 + r() * 0.05, r() * 6.28] : null; // 腰上一道台：上半往里收
  const amp = Array.from({ length: 4 }, () => r() * 6.28);
  // 轮廓：s 从 0（底）走到 1（顶心）。前一段是壁，再绕过肩头，最后是顶面
  const prof = (s) => {
    const sA = 0.62, sB = 0.84;
    if (s <= sA) { const y = (s / sA) * (1 - sh); return [1 + bul * Math.sin(Math.PI * y / (1 - sh)), y]; }
    if (s <= sB) { const t = (s - sA) / (sB - sA) * Math.PI / 2; return [1 - sh + sh * Math.cos(t), 1 - sh + sh * Math.sin(t)]; }
    const t = (s - sB) / (1 - sB); return [(1 - sh) * (1 - t), 1 + dome * Math.sin(Math.PI / 2 * t)];
  };
  const pos = [], aH = [], idx = [];
  for (let j = 0; j <= m; j++) {
    const s = j / m * 0.995, [rr0, y0] = prof(s);
    for (let i = 0; i < n; i++) {
      const a = ph + i / n * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
      const se = Math.pow(Math.pow(Math.abs(c), p) + Math.pow(Math.abs(sn), p), -1 / p); // 圆角方
      let k = 1 + 0.07 * (vnoise(c * 1.4 + seed * 0.31, y0 * 2.2 + sn * 1.1) - 0.5) * 2 + 0.03 * Math.sin(a * 3 + amp[0]) * y0;
      for (const [ga, gw, gd, g0] of grooves) { const da = Math.abs(((a - ga) % 6.2832 + 9.4248) % 6.2832 - 3.1416); k -= gd * Math.exp(-((da / gw) ** 2)) * smooth(g0, g0 + 0.15, y0) * smooth(1.02, 0.8, y0); }
      if (ledge && y0 > ledge[0]) k -= ledge[1] * smooth(ledge[0], ledge[0] + 0.04, y0) * (0.6 + 0.4 * Math.cos(a - ledge[2]));
      const rr = rr0 * se * k * (1 - (1 - taper) * y0);
      let x = c * rr * 1.12, z = sn * rr, y = y0;
      y += (x * tx + z * tz + z * front) * smooth(0.5, 1, y0) + 0.025 * (vnoise(x * 2 + seed, z * 2) - 0.5) * smooth(0.7, 1, y0); // front：顶面前高后低（本地 +z 朝镜头），画境镜头里少露顶面、多露正面，像原画
      x += lean[0] * y0 * y0; z += lean[1] * y0 * y0;
      pos.push(x, y, z); aH.push(Math.min(1, y));
    }
  }
  const top = pos.length / 3; pos.push(lean[0], 1 + dome, lean[1]); aH.push(1);
  for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) { const a0 = j * n + i, b0 = j * n + (i + 1) % n; idx.push(a0, a0 + n, b0, b0, a0 + n, b0 + n); }
  for (let i = 0; i < n; i++) idx.push(m * n + i, top, m * n + (i + 1) % n);
  // 底面：一圈往下伸出去埋进土里
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aH', new THREE.Float32BufferAttribute(aH, 1));
  g.setAttribute('aM', new THREE.Float32BufferAttribute(new Float32Array(aH.length).fill(tone), 1)); // 每块石头的色调（石青 / 青灰 / 灰赭）
  g.setIndex(idx); g.computeVertexNormals();
  return g.toNonIndexed();
}
// v37 嶙峋石：算法在 rockgen.js（v42 挪出去给 Worker 用）
const ROCK_CACHE = new Map();
export const ROCK_KEYS = []; // v42 本次现场算过的嶙峋石参数（预存里记下，下次开页面先交给 Worker 并行算）
export function primeRock(seed, res, squat, A) { // v42 Worker 算好的数组放进缓存
  const g = new THREE.BufferGeometry();
  for (const [k, n] of [['position', 3], ['normal', 3], ['aH', 1], ['aM', 1], ['aO', 1]]) g.setAttribute(k, new THREE.BufferAttribute(A[k], n));
  ROCK_CACHE.set(seed + ':' + res + ':' + squat, g);
}
export function craggyRockGeometry(seed, { res = 22, squat = 0, smoothN = false } = {}) {
  const key = seed + ':' + res + ':' + squat;
  if (ROCK_CACHE.has(key)) return ROCK_CACHE.get(key).clone();
  ROCK_KEYS.push([seed, res, squat]);
  primeRock(seed, res, squat, craggyRockArrays(seed, { res, squat, smoothN }));
  return ROCK_CACHE.get(key).clone();
}
// 放一块方石：底面落到脚下地形的最低处再埋进去一点；w 宽、d 深、h 高，ry 朝向
export function placeBlock(list, height, x, z, w, d, h, ry, seed, o) {
  const g = o && o.craggy ? craggyRockGeometry(seed, o) : o && o.pillow ? pillowRockGeometry(seed, o) : o && o.lump ? lumpRockGeometry(seed, o) : blockRockGeometry(seed, o);
  if (o && o.aO && !g.attributes.aO) g.setAttribute('aO', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count), 1)); // o.aO：和嶙峋石合并的那几堆，各块属性要一致
  let y = Infinity; for (let a = 0; a < 6.28; a += 0.9) y = Math.min(y, height(x + Math.cos(a) * w * 0.8, z + Math.sin(a) * d * 0.8));
  y = Math.min(y, height(x, z));
  const y0 = o && o.y0 != null ? o.y0 : y - h * 0.12; // v36 o.y0：底面的绝对高度（巨岩悬在凹岩上、斜石板要埋得深）
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(w, h, d)));
  // v36 o.shear [kx, kz]：顶面、底面一起错成斜面（y += kx·dx + kz·dz），四壁仍竖直——磐玉隈那块斜着的大石板
  if (o && o.shear) { const [kx, kz] = o.shear; g.applyMatrix4(new THREE.Matrix4().set(1, 0, 0, 0, kx, 1, kz, -kx * x - kz * z, 0, 0, 1, 0, 0, 0, 0, 1)); }
  // v36 o.lean [lx, lz]：越往上越往一侧探（凹岩顶上那块往前探的巨石）
  if (o && o.lean) { const [lx, lz] = o.lean; g.applyMatrix4(new THREE.Matrix4().set(1, lx, 0, -lx * y0, 0, 1, 0, 0, 0, lz, 1, -lz * y0, 0, 0, 0, 1)); }
  if (o && o.tone != null) g.setAttribute('aM', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(o.tone), 1));
  list.push(g); return y0 + h;
}
export { vnoise };

// 雙仙石（原画 IMG_1263 左下）：像两个披衣站着的人，脚下宽、腰身微收、肩头一侧耸起、上面一个圆头。高 h，原点在脚下
export function stoneFigureGeometry(seed, h = 4) {
  const r = rand(seed), P = [[0.01, 0], [0.5, 0], [0.52, 0.12], [0.42, 0.55], [0.36, 1.1], [0.4, 1.6], [0.44, 2.05], [0.36, 2.3], [0.17, 2.42], [0.2, 2.55], [0.25, 2.75], [0.22, 2.95], [0.12, 3.08], [0.01, 3.12]];
  const g = new THREE.LatheGeometry(P.map(([x, y]) => new THREE.Vector2(x, y)), 14);
  const p = g.attributes.position, sh = r() < 0.5 ? 1 : -1, aH = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const t = y / 3.12, a = Math.atan2(z, x);
    const k = 1 + 0.12 * (vnoise(Math.cos(a) * 2 + seed, y * 1.4) - 0.5) + 0.25 * Math.max(0, Math.cos(a)) * sh * Math.exp(-((t - 0.68) ** 2) / 0.006); // 一侧肩头（像抱着东西）
    x *= k; z *= k * 0.78;
    x += 0.12 * Math.pow(t, 2) * sh; // 上身微微侧倾
    p.setXYZ(i, x * h / 3.12 * 1.15, y * h / 3.12, z * h / 3.12 * 1.15);
    aH[i] = 0.55 + 0.45 * t;
  }
  g.deleteAttribute('uv'); g.setAttribute('aH', new THREE.BufferAttribute(aH, 1));
  g.computeVertexNormals();
  return g.toNonIndexed();
}

// v31 圆浑的石块（原画超然亭四周的石青石）；v32（Yang：石头太光滑，像胶囊）改得嶙峋：
// 一层层叠起的石板（每层下宽上收，层与层之间是一道外挑的石檐），两三道深竖缝，顶面高低不平。原点在底面中心，高 1、半径约 1
export function lumpRockGeometry(seed, { taper = 0.92, bulge = 0.12 } = {}) {
  const r = rand(seed), n = 18, m = 18, ph = r() * 6.28, fold = 2 + Math.floor(r() * 3), fph = r() * 6.28;
  const lean = [(r() - 0.5) * 0.22, (r() - 0.5) * 0.16], jit = Array.from({ length: n }, () => 0.88 + r() * 0.24);
  const L = 3 + Math.floor(r() * 3), lph = r(), cuts = Array.from({ length: 2 + Math.floor(r() * 2) }, () => [r() * 6.28, 0.12 + r() * 0.12, 0.2 + r() * 0.25, r() * 0.4]);
  const topN = Array.from({ length: n }, (_, i) => 0.5 + 0.5 * Math.sin(i / n * 6.28 * (1 + Math.floor(r() * 2)) + r() * 6.28));
  const pos = [], aH = [], idx = [];
  for (let j = 0; j <= m; j++) {
    const t = j / m * 0.985, prof = Math.pow(Math.max(0, 1 - Math.pow(t, 5)), 0.32) * (1 + bulge * Math.sin(Math.PI * Math.min(1, t * 1.5))) * (1 - (1 - taper) * t);
    for (let i = 0; i < n; i++) {
      const a = ph + i / n * Math.PI * 2;
      let k = jit[i] * (1 - 0.22 * Math.pow(Math.abs(Math.sin(fold * a / 2 + fph)), 3)) * (0.82 + 0.34 * vnoise(Math.cos(a) * 1.6 + seed * 0.37, t * 3.2 + Math.sin(a) * 1.3));
      // 石板层：层内往上收 12%，下一层底又挑出来；层线随方位起伏，不是一圈平线
      const lt = t * L + lph + 0.35 * (vnoise(Math.cos(a) * 2 + seed, Math.sin(a) * 2) - 0.5), lf = lt - Math.floor(lt);
      k *= 1 - 0.12 * lf - 0.05 * Math.pow(lf, 6);
      // 竖缝
      for (const [ca, cw, cd, c0] of cuts) { let da = Math.abs(((a - ca) % 6.2832 + 9.4248) % 6.2832 - 3.1416); k *= 1 - cd * Math.exp(-((da / cw) ** 2)) * smooth(c0, c0 + 0.2, t); }
      const y = t * (1 - 0.07 * smooth(0.6, 1, t) * topN[i]); // 顶面微有高低
      pos.push(Math.cos(a) * prof * k * 1.1 + lean[0] * t * t, y, Math.sin(a) * prof * k + lean[1] * t * t); aH.push(y);
    }
  }
  const top = pos.length / 3; pos.push(lean[0], 0.94, lean[1]); aH.push(0.94);
  for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) { const b = j * n + (i + 1) % n; idx.push(j * n + i, j * n + i + n, b, b, j * n + i + n, b + n); }
  for (let i = 0; i < n; i++) idx.push(m * n + i, top, m * n + (i + 1) % n);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aH', new THREE.Float32BufferAttribute(aH, 1));
  g.setIndex(idx);
  const ng = g.toNonIndexed(); ng.computeVertexNormals(); // 面各自平：层檐、竖缝的棱角出得来，后处理勾得出线
  return ng;
}
