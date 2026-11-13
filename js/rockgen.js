import { rand, smooth } from './world.js';
// v42 从 zone2.js 挪出来：只算数组、不碰 THREE，主线程和 Web Worker（rockworker.js）都能用。算法与 v37 一字未改。
// v37 嶙峋石（Yang：石头不要近乎规整的形状，要原画那种嶙峋、风化的样子）。照原画 1265、1264 的石青石：
// 一块石头是两三团高矮不一的方块挤在一起——主块在后，一侧常耸起一截石笋似的高头，矮块探在前面、侧面；
// 主块腰上一道坎（上半往里收，下半挑出来），顶上一两道竖裂缝劈下来，脚下随石形一圈不齐的矮石台。
// 用距离场拼：各块是倒圆角的斜顶方块，平滑并起来（交接处留一道折，后处理勾得出线），再整体扭一扭、
// 面上起伏一点，用 surface nets 取面。法线取距离场梯度；aO 取距离场遮蔽（缝里、块与块的夹角里记得深，着色压墨、透赭）。
// 原点在底面中心，高约 1，半径约 1，本地 +z 朝镜头。res：每边的格数（大石 22，碎石 14）
const h3 = (x, y, z, s) => { let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177) + Math.imul(s, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
function vn3(x, y, z, s) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const L = (a, b, t) => a + (b - a) * t;
  return L(L(L(h3(xi, yi, zi, s), h3(xi + 1, yi, zi, s), u), L(h3(xi, yi + 1, zi, s), h3(xi + 1, yi + 1, zi, s), u), v),
    L(L(h3(xi, yi, zi + 1, s), h3(xi + 1, yi, zi + 1, s), u), L(h3(xi, yi + 1, zi + 1, s), h3(xi + 1, yi + 1, zi + 1, s), u), v), w);
}
export function craggyRockArrays(seed, { res = 22, squat = 0, smoothN = false } = {}) {
  const r = rand(seed * 7 + 13), t0n = r(), tone = t0n < 0.8 ? t0n * 0.7 : t0n < 0.93 ? 0.62 + (t0n - 0.8) * 0.4 : 0.88, ns = seed % 997 + 11; // 色调：八成石青、一成多青灰、少数灰赭
  const L = []; // 各块：中心 c[x,z]、半宽 e[x,z]、顶高 h、转角 ry、圆角 rr、顶面斜 t[x,z]、腰坎 [y, 收进]、往上收 tp
  const ry0 = (r() - 0.5) * 0.5, A = { c: [(r() - 0.5) * 0.12, -0.05 - r() * 0.08], e: [0.72 + r() * 0.16, 0.56 + r() * 0.14], h: (0.7 + r() * 0.2) * (1 - squat * 0.3), ry: ry0, rr: 0.05 + r() * 0.05, t: [(r() - 0.5) * 0.3, 0.05 + r() * 0.14], ledge: r() < 0.85 ? [0.3 + r() * 0.3, (r() < 0.6 ? 1 : -0.7) * (0.1 + r() * 0.08)] : null, tp: r() * 0.08 };
  L.push(A);
  if (r() < 0.7 - squat * 0.4) { const s = r() < 0.5 ? -1 : 1; L.push({ c: [A.c[0] + s * (0.15 + r() * 0.3), A.c[1] - 0.05 - r() * 0.1], e: [0.3 + r() * 0.16, 0.28 + r() * 0.14], h: 1, ry: ry0 + (r() - 0.5) * 0.7, rr: 0.05 + r() * 0.04, t: [(r() - 0.5) * 0.5, (r() - 0.5) * 0.3], ledge: r() < 0.35 ? [0.75 + r() * 0.1, 0.05] : null, tp: 0.04 + r() * 0.1 }); }
  const nl = 1 + (r() < 0.65 ? 1 : 0) + (r() < 0.3 ? 1 : 0);
  for (let k = 0; k < nl; k++) {
    const a = k === 0 ? (r() - 0.5) * 1.6 : (r() < 0.5 ? -1 : 1) * (1.1 + r() * 0.9), dist = 0.38 + r() * 0.22; // 挨着主块，不散 // 第一块在前，其余在两侧
    L.push({ c: [A.c[0] + Math.sin(a) * dist * 1.1, A.c[1] + Math.cos(a) * dist * 0.75], e: [0.3 + r() * 0.2, 0.26 + r() * 0.14], h: 0.32 + r() * 0.32, ry: (r() - 0.5) * 2, rr: 0.05 + r() * 0.05, t: [(r() - 0.5) * 0.5, (r() - 0.5) * 0.4], ledge: r() < 0.25 ? [0.5 + r() * 0.2, 0.05] : null, tp: r() * 0.12 });
  }
  // 主块正面下半鼓出两三团矮石包（原画大石的下半是几团挤在一起的圆包，包与包之间一道道勾线）
  for (let k = 0, n = 2 + (r() < 0.5 ? 1 : 0); k < n; k++) {
    const u = (k + 0.5) / n - 0.5 + (r() - 0.5) * 0.18;
    L.push({ c: [A.c[0] + u * A.e[0] * 1.7, A.c[1] + A.e[1] * (0.85 + r() * 0.25)], e: [A.e[0] / n * (0.7 + r() * 0.3), 0.15 + r() * 0.1], h: A.h * (0.22 + r() * 0.3), ry: (r() - 0.5) * 0.6, rr: 0.06 + r() * 0.05, t: [(r() - 0.5) * 0.6, 0.1 + r() * 0.3], ledge: null, tp: 0.1 + r() * 0.15 });
  }
  for (const b of L) {
    b.cs = Math.cos(b.ry); b.sn = Math.sin(b.ry);
    // 斧劈似的斜切面：在块的上角斜削一刀（本地坐标里的平面），面上出一块斜的平面和一道折
    b.cut = []; for (let k = 0, n = (b === A ? 1 : 0) + (r() < 0.7 ? 1 : 0) + (r() < 0.4 ? 1 : 0); k < n; k++) {
      const a = r() * 6.28, ny = 0.45 + r() * 0.4, nh = Math.sqrt(1 - ny * ny), nx = Math.cos(a) * nh, nz = Math.sin(a) * nh;
      const px = Math.cos(a) * b.e[0] * 0.85, pz = Math.sin(a) * b.e[1] * 0.85, py = b.h * (0.75 + r() * 0.2);
      b.cut.push([nx, ny, nz, -(nx * px + ny * py + nz * pz)]);
    }
  }
  const cracks = []; // 竖裂缝：过顶上一点的竖面，往下劈到 y0，缝口宽 w
  for (let k = 0, n = (r() < 0.85 ? 1 : 0) + (r() < 0.45 ? 1 : 0); k < n; k++) {
    const a = (r() - 0.5) * 1.1 + (r() < 0.2 ? Math.PI / 2 : 0); // 多半是前后走向的缝，正面看是一道竖线
    cracks.push({ p: [A.c[0] + (r() - 0.5) * A.e[0] * 0.7, A.c[1] + (r() - 0.5) * 0.3], n: [Math.cos(a), Math.sin(a)], y0: 0.25 + r() * 0.35, w: 0.035 + r() * 0.03 });
  }
  const footH = 0.07 + r() * 0.08, footX = 0.02 + r() * 0.05;
  const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
  const box2 = (b, x, z) => { // 块在 xz 上的圆角矩形距离（本地坐标）
    const dx = x - b.c[0], dz = z - b.c[1], lx = dx * b.cs + dz * b.sn, lz = -dx * b.sn + dz * b.cs;
    return [lx, lz];
  };
  const lobe = (b, x, y, z) => {
    const [lx, lz] = box2(b, x, z);
    const top = b.h + b.t[0] * lx + b.t[1] * lz, yy = Math.min(1, Math.max(0, y / b.h));
    let k = 1 - b.tp * yy; if (b.ledge) k -= b.ledge[1] * smooth(b.ledge[0] - 0.03, b.ledge[0] + 0.03, yy);
    const ex = b.e[0] * k, ez = b.e[1] * k, rr = b.rr;
    const qx = Math.abs(lx) - ex + rr, qz = Math.abs(lz) - ez + rr, qy = Math.max(y - top + rr, -0.3 - y);
    const mx = Math.max(qx, 0), my = Math.max(qy, 0), mz = Math.max(qz, 0);
    let d = Math.hypot(mx, my, mz) + Math.min(Math.max(qx, qy, qz), 0) - rr;
    for (const c of b.cut) d = Math.max(d, c[0] * lx + c[1] * y + c[2] * lz + c[3]);
    return d;
  };
  const sdf = (x0, y0, z0) => {
    let d0 = Infinity; for (const b of L) d0 = Math.min(d0, lobe(b, x0, y0, z0)); // 离石面远的格点不必算扭曲（省时）
    if (d0 > 0.3) return Math.max(d0 - 0.12, -0.12 - y0);
    // 整体扭一扭：轮廓不直、面上微起伏
    const x = x0 + 0.09 * (vn3(x0 * 2.1, y0 * 1.6, z0 * 2.1, ns) - 0.5), z = z0 + 0.09 * (vn3(x0 * 2.1 + 7, y0 * 1.6, z0 * 2.1, ns) - 0.5), y = y0 + 0.05 * (vn3(x0 * 1.8, y0 * 1.8 + 3, z0 * 1.8, ns) - 0.5);
    let d = Infinity, f2 = Infinity;
    for (const b of L) {
      let db = lobe(b, x, y, z);
      if (b === A) for (const c of cracks) { // 裂缝只劈主块（劈到石笋、矮块上会剩一片薄刺）；缝面也扭一点
        const s = Math.abs((x - c.p[0]) * c.n[0] + (z - c.p[1]) * c.n[1] + 0.05 * (vn3(x * 3, y * 3, z * 3, ns + 2) - 0.5)) - c.w * smooth(c.y0, c.y0 + 0.25, y);
        if (y > c.y0) db = Math.max(db, -s);
      }
      d = d === Infinity ? db : smin(d, db, 0.035);
      const [lx, lz] = box2(b, x, z); f2 = Math.min(f2, Math.hypot(Math.max(Math.abs(lx) - b.e[0], 0), Math.max(Math.abs(lz) - b.e[1], 0)));
    }
    // 脚下的矮石台：随石形外扩一圈，宽窄不齐
    if (y < footH * 1.3 + 0.1) { // 高处够不着石台，省掉
      const fx = footX * (2.2 * vn3(x0 * 2.6, 0, z0 * 2.6, ns + 5) - 0.4);
      d = smin(d, Math.max(f2 - fx, y - footH * (0.7 + 0.6 * vn3(x0 * 3, 1, z0 * 3, ns + 9)), -0.3 - y), 0.05);
    }
    d += 0.025 * (vn3(x0 * 4.3, y0 * 4.3, z0 * 4.3, ns + 4) - 0.5); // 风化起伏
    return Math.max(d, -0.12 - y0);
  };
  // —— surface nets ——
  const X0 = -1.45, X1 = 1.45, Y0 = -0.25, Y1 = 1.25, nx = res, nz = res, ny = Math.max(6, Math.round(res * (Y1 - Y0) / (X1 - X0)));
  const dx = (X1 - X0) / nx, dy = (Y1 - Y0) / ny, dz = dx, sx = nx + 1, sy = ny + 1;
  const F = new Float32Array(sx * sy * (nz + 1));
  for (let k = 0; k <= nz; k++) for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) F[(k * sy + j) * sx + i] = sdf(X0 + i * dx, Y0 + j * dy, X0 + k * dz);
  const V = [], G = [], cell = new Int32Array(nx * ny * nz).fill(-1);
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cv = new Float32Array(8);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    let neg = 0;
    for (let c = 0; c < 8; c++) { cv[c] = F[((k + (c >> 2)) * sy + j + ((c >> 1) & 1)) * sx + i + (c & 1)]; if (cv[c] < 0) neg++; }
    if (neg === 0 || neg === 8) continue;
    let px = 0, py = 0, pz = 0, m = 0;
    for (const [a, b] of E) {
      if ((cv[a] < 0) === (cv[b] < 0)) continue;
      const t = cv[a] / (cv[a] - cv[b]);
      px += (a & 1) + ((b & 1) - (a & 1)) * t; py += ((a >> 1) & 1) + (((b >> 1) & 1) - ((a >> 1) & 1)) * t; pz += (a >> 2) + ((b >> 2) - (a >> 2)) * t; m++;
    }
    cell[(k * ny + j) * nx + i] = V.length / 3;
    { // 梯度取本格八角的三线性导数（省掉每个顶点再算四次距离场）
      const u = px / m, w2 = py / m, t = pz / m;
      G.push(((1 - w2) * (1 - t) * (cv[1] - cv[0]) + w2 * (1 - t) * (cv[3] - cv[2]) + (1 - w2) * t * (cv[5] - cv[4]) + w2 * t * (cv[7] - cv[6])) / dx,
        ((1 - u) * (1 - t) * (cv[2] - cv[0]) + u * (1 - t) * (cv[3] - cv[1]) + (1 - u) * t * (cv[6] - cv[4]) + u * t * (cv[7] - cv[5])) / dy,
        ((1 - u) * (1 - w2) * (cv[4] - cv[0]) + u * (1 - w2) * (cv[5] - cv[1]) + (1 - u) * w2 * (cv[6] - cv[2]) + u * w2 * (cv[7] - cv[3])) / dz);
    }
    V.push(X0 + (i + px / m) * dx, Y0 + (j + py / m) * dy, X0 + (k + pz / m) * dz);
  }
  const Q = [];
  const C = (i, j, k) => (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz ? -1 : cell[(k * ny + j) * nx + i]);
  for (let k = 0; k <= nz; k++) for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const f0 = F[(k * sy + j) * sx + i];
    if (i < nx) { const f1 = F[(k * sy + j) * sx + i + 1]; if ((f0 < 0) !== (f1 < 0)) { const q = [C(i, j - 1, k - 1), C(i, j, k - 1), C(i, j, k), C(i, j - 1, k)]; if (q.every((v) => v >= 0)) Q.push(f0 < 0 ? q : q.slice().reverse()); } }
    if (j < ny) { const f1 = F[(k * sy + j + 1) * sx + i]; if ((f0 < 0) !== (f1 < 0)) { const q = [C(i - 1, j, k - 1), C(i - 1, j, k), C(i, j, k), C(i, j, k - 1)]; if (q.every((v) => v >= 0)) Q.push(f0 < 0 ? q : q.slice().reverse()); } }
    if (k < nz) { const f1 = F[((k + 1) * sy + j) * sx + i]; if ((f0 < 0) !== (f1 < 0)) { const q = [C(i - 1, j - 1, k), C(i, j - 1, k), C(i, j, k), C(i - 1, j, k)]; if (q.every((v) => v >= 0)) Q.push(f0 < 0 ? q : q.slice().reverse()); } }
  }
  // 每个顶点：梯度法线、距离场遮蔽
  const nv = V.length / 3, N = new Float32Array(nv * 3), O = new Float32Array(nv), e = dx * 0.5;
  for (let v = 0; v < nv; v++) {
    const x = V[v * 3], y = V[v * 3 + 1], z = V[v * 3 + 2];
    let gx = G[v * 3], gy = G[v * 3 + 1], gz = G[v * 3 + 2]; const gl = Math.hypot(gx, gy, gz) || 1; gx /= gl; gy /= gl; gz /= gl;
    N[v * 3] = gx; N[v * 3 + 1] = gy; N[v * 3 + 2] = gz;
    let occ = 0; for (let s = 1; s <= 3; s++) { const hh = 0.07 * s; occ += (hh - Math.max(sdf(x + gx * hh, y + gy * hh, z + gz * hh), 0)) / (1 << s); }
    O[v] = Math.min(1, Math.max(0, occ * 11 - 0.12));
  }
  // 遮蔽沿网格邻点抹两遍：缝里是一片晕开的深色，不是一块块斑
  { const nb = Array.from({ length: nv }, () => []);
    for (const q of Q) for (let i = 0; i < 4; i++) { nb[q[i]].push(q[(i + 1) % 4], q[(i + 3) % 4]); }
    for (let it = 0; it < 1; it++) { const O2 = O.slice(); for (let v = 0; v < nv; v++) { let a = O[v] * 2, n = 2; for (const u of nb[v]) { a += O[u]; n++; } O2[v] = a / n; } O.set(O2); }
    // 法线也和邻点平均一遍（格内导数是一格一个值，不抹会看出网格）
    const N2 = N.slice(); for (let v = 0; v < nv && smoothN; v++) { let ax = N[v * 3] * 2, ay = N[v * 3 + 1] * 2, az = N[v * 3 + 2] * 2; for (const u of nb[v]) { ax += N[u * 3]; ay += N[u * 3 + 1]; az += N[u * 3 + 2]; } const l = Math.hypot(ax, ay, az) || 1; N2[v * 3] = ax / l; N2[v * 3 + 1] = ay / l; N2[v * 3 + 2] = az / l; } N.set(N2); }
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, maxY = 0;
  for (let v = 0; v < nv; v++) { x0 = Math.min(x0, V[v * 3]); x1 = Math.max(x1, V[v * 3]); z0 = Math.min(z0, V[v * 3 + 2]); z1 = Math.max(z1, V[v * 3 + 2]); maxY = Math.max(maxY, V[v * 3 + 1]); }
  // 外框居中，x、z 各自撑满（宽 ±1.12、深 ±1，和旧圆角方块一样大），高 1.05
  const ox = (x0 + x1) / 2, oz = (z0 + z1) / 2, mxX = (x1 - x0) / 2 / 1.12, mxZ = (z1 - z0) / 2; maxY /= 1.05;
  const out = [], nrm = [], aH = [], aO = [];
  const put = (v) => { const ny2 = N[v * 3 + 1] * maxY, nx2 = N[v * 3] * mxX, nz2 = N[v * 3 + 2] * mxZ, l = Math.hypot(nx2, ny2, nz2) || 1; out.push((V[v * 3] - ox) / mxX, V[v * 3 + 1] / maxY, (V[v * 3 + 2] - oz) / mxZ); nrm.push(nx2 / l, ny2 / l, nz2 / l); aH.push(Math.max(0, V[v * 3 + 1] / maxY)); aO.push(Math.max(O[v], 0.55 * smooth(0.1, -0.06, V[v * 3 + 1]))); };
  for (const [a, b, c, d] of Q) {
    // 沿短对角线切成两个三角
    const d1 = Math.hypot(V[a * 3] - V[c * 3], V[a * 3 + 1] - V[c * 3 + 1], V[a * 3 + 2] - V[c * 3 + 2]), d2 = Math.hypot(V[b * 3] - V[d * 3], V[b * 3 + 1] - V[d * 3 + 1], V[b * 3 + 2] - V[d * 3 + 2]);
    const T2 = d1 <= d2 ? [[a, b, c], [a, c, d]] : [[a, b, d], [b, c, d]];
    for (const [p0, p1, p2] of T2) { // 绕向按梯度法线定：朝外
      const ux = V[p1 * 3] - V[p0 * 3], uy = V[p1 * 3 + 1] - V[p0 * 3 + 1], uz = V[p1 * 3 + 2] - V[p0 * 3 + 2], wx = V[p2 * 3] - V[p0 * 3], wy = V[p2 * 3 + 1] - V[p0 * 3 + 1], wz = V[p2 * 3 + 2] - V[p0 * 3 + 2];
      const fx = uy * wz - uz * wy, fy = uz * wx - ux * wz, fz = ux * wy - uy * wx;
      if (fx * (N[p0 * 3] + N[p1 * 3] + N[p2 * 3]) + fy * (N[p0 * 3 + 1] + N[p1 * 3 + 1] + N[p2 * 3 + 1]) + fz * (N[p0 * 3 + 2] + N[p1 * 3 + 2] + N[p2 * 3 + 2]) >= 0) { put(p0); put(p1); put(p2); } else { put(p0); put(p2); put(p1); }
    }
  }
  return { position: new Float32Array(out), normal: new Float32Array(nrm), aH: new Float32Array(aH), aM: new Float32Array(aH.length).fill(tone), aO: new Float32Array(aO) };
}

// v47 大块山石（水犀洞双头峰、四陽洞洞后的大石台等）：直接给世界坐标里的距离场 sdf(x, y, z)，在盒子 B=[x0,x1,y0,y1,z0,z1] 里
// 以 cell 米一格用 surface nets 取面（同嶙峋石）。aH 取 (y − hy[0]) / (hy[1] − hy[0])；aM 取 tone（数或 (x,y,z)=>数）；aO 取距离场遮蔽（occ 米一步）
// field(n, fill)：取格点距离场的数组（默认现场算；要预存可以换成 bakedArray）。遮蔽按格点场三线性取值，不再调 sdf
export function sdfArrays(sdf, B, cell, { hy = [B[2], B[3]], tone = 0.78, occ = 0.35, field = (n, fill) => { const a = new Float32Array(n); fill(a); return a; } } = {}) {
  const [X0, X1, Y0, Y1, Z0, Z1] = B, nx = Math.max(2, Math.round((X1 - X0) / cell)), ny = Math.max(2, Math.round((Y1 - Y0) / cell)), nz = Math.max(2, Math.round((Z1 - Z0) / cell));
  const dx = (X1 - X0) / nx, dy = (Y1 - Y0) / ny, dz = (Z1 - Z0) / nz, sx = nx + 1, sy = ny + 1;
  const F = field(sx * sy * (nz + 1), (F) => { for (let k = 0; k <= nz; k++) for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) F[(k * sy + j) * sx + i] = sdf(X0 + i * dx, Y0 + j * dy, Z0 + k * dz); });
  const at = (x, y, z) => { // 格点场三线性取值（盒外取边上的值）
    const fi = Math.min(nx - 1e-4, Math.max(0, (x - X0) / dx)), fj = Math.min(ny - 1e-4, Math.max(0, (y - Y0) / dy)), fk = Math.min(nz - 1e-4, Math.max(0, (z - Z0) / dz));
    const i = Math.floor(fi), j = Math.floor(fj), k = Math.floor(fk), u = fi - i, v = fj - j, w = fk - k, I = (a, b, c) => F[((k + c) * sy + j + b) * sx + i + a];
    const L = (a, b, t) => a + (b - a) * t;
    return L(L(L(I(0, 0, 0), I(1, 0, 0), u), L(I(0, 1, 0), I(1, 1, 0), u), v), L(L(I(0, 0, 1), I(1, 0, 1), u), L(I(0, 1, 1), I(1, 1, 1), u), v), w);
  };
  const V = [], G = [], cell2 = new Int32Array(nx * ny * nz).fill(-1);
  const E = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cv = new Float32Array(8);
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    let neg = 0;
    for (let c = 0; c < 8; c++) { cv[c] = F[((k + (c >> 2)) * sy + j + ((c >> 1) & 1)) * sx + i + (c & 1)]; if (cv[c] < 0) neg++; }
    if (neg === 0 || neg === 8) continue;
    let px = 0, py = 0, pz = 0, m = 0;
    for (const [a, b] of E) {
      if ((cv[a] < 0) === (cv[b] < 0)) continue;
      const t = cv[a] / (cv[a] - cv[b]);
      px += (a & 1) + ((b & 1) - (a & 1)) * t; py += ((a >> 1) & 1) + (((b >> 1) & 1) - ((a >> 1) & 1)) * t; pz += (a >> 2) + ((b >> 2) - (a >> 2)) * t; m++;
    }
    cell2[(k * ny + j) * nx + i] = V.length / 3;
    const u = px / m, w2 = py / m, t = pz / m;
    G.push(((1 - w2) * (1 - t) * (cv[1] - cv[0]) + w2 * (1 - t) * (cv[3] - cv[2]) + (1 - w2) * t * (cv[5] - cv[4]) + w2 * t * (cv[7] - cv[6])) / dx,
      ((1 - u) * (1 - t) * (cv[2] - cv[0]) + u * (1 - t) * (cv[3] - cv[1]) + (1 - u) * t * (cv[6] - cv[4]) + u * t * (cv[7] - cv[5])) / dy,
      ((1 - u) * (1 - w2) * (cv[4] - cv[0]) + u * (1 - w2) * (cv[5] - cv[1]) + (1 - u) * w2 * (cv[6] - cv[2]) + u * w2 * (cv[7] - cv[3])) / dz);
    V.push(X0 + (i + u) * dx, Y0 + (j + w2) * dy, Z0 + (k + t) * dz);
  }
  const Q = [], C = (i, j, k) => (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz ? -1 : cell2[(k * ny + j) * nx + i]);
  for (let k = 0; k <= nz; k++) for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const f0 = F[(k * sy + j) * sx + i];
    if (i < nx) { const f1 = F[(k * sy + j) * sx + i + 1]; if ((f0 < 0) !== (f1 < 0)) { const q = [C(i, j - 1, k - 1), C(i, j, k - 1), C(i, j, k), C(i, j - 1, k)]; if (q.every((v) => v >= 0)) Q.push(f0 < 0 ? q : q.slice().reverse()); } }
    if (j < ny) { const f1 = F[(k * sy + j + 1) * sx + i]; if ((f0 < 0) !== (f1 < 0)) { const q = [C(i - 1, j, k - 1), C(i - 1, j, k), C(i, j, k), C(i, j, k - 1)]; if (q.every((v) => v >= 0)) Q.push(f0 < 0 ? q : q.slice().reverse()); } }
    if (k < nz) { const f1 = F[((k + 1) * sy + j) * sx + i]; if ((f0 < 0) !== (f1 < 0)) { const q = [C(i - 1, j - 1, k), C(i, j - 1, k), C(i, j, k), C(i - 1, j, k)]; if (q.every((v) => v >= 0)) Q.push(f0 < 0 ? q : q.slice().reverse()); } }
  }
  const nv = V.length / 3, N = new Float32Array(nv * 3), O = new Float32Array(nv);
  for (let v = 0; v < nv; v++) {
    const x = V[v * 3], y = V[v * 3 + 1], z = V[v * 3 + 2];
    let gx = G[v * 3], gy = G[v * 3 + 1], gz = G[v * 3 + 2]; const gl = Math.hypot(gx, gy, gz) || 1; gx /= gl; gy /= gl; gz /= gl;
    N[v * 3] = gx; N[v * 3 + 1] = gy; N[v * 3 + 2] = gz;
    let o = 0; for (let s = 1; s <= 3; s++) { const hh = occ * s; o += (hh - Math.max(at(x + gx * hh, y + gy * hh, z + gz * hh), 0)) / hh / (1 << s); }
    O[v] = Math.min(1, Math.max(0, o * 1.6 - 0.1));
  }
  { const nb = Array.from({ length: nv }, () => []);
    for (const q of Q) for (let i = 0; i < 4; i++) nb[q[i]].push(q[(i + 1) % 4], q[(i + 3) % 4]);
    const O2 = O.slice(); for (let v = 0; v < nv; v++) { let a = O[v] * 2, n = 2; for (const u of nb[v]) { a += O[u]; n++; } O2[v] = a / n; } O.set(O2);
    const N2 = N.slice(); for (let v = 0; v < nv; v++) { let ax = N[v * 3] * 2, ay = N[v * 3 + 1] * 2, az = N[v * 3 + 2] * 2; for (const u of nb[v]) { ax += N[u * 3]; ay += N[u * 3 + 1]; az += N[u * 3 + 2]; } const l = Math.hypot(ax, ay, az) || 1; N2[v * 3] = ax / l; N2[v * 3 + 1] = ay / l; N2[v * 3 + 2] = az / l; } N.set(N2); }
  const out = [], nrm = [], aH = [], aM = [], aO = [], tf = typeof tone === 'function' ? tone : () => tone;
  const put = (v) => { const x = V[v * 3], y = V[v * 3 + 1], z = V[v * 3 + 2]; out.push(x, y, z); nrm.push(N[v * 3], N[v * 3 + 1], N[v * 3 + 2]); aH.push(Math.min(1, Math.max(0, (y - hy[0]) / (hy[1] - hy[0])))); aM.push(tf(x, y, z)); aO.push(O[v]); };
  for (const [a, b, c, d] of Q) {
    const d1 = Math.hypot(V[a * 3] - V[c * 3], V[a * 3 + 1] - V[c * 3 + 1], V[a * 3 + 2] - V[c * 3 + 2]), d2 = Math.hypot(V[b * 3] - V[d * 3], V[b * 3 + 1] - V[d * 3 + 1], V[b * 3 + 2] - V[d * 3 + 2]);
    const T2 = d1 <= d2 ? [[a, b, c], [a, c, d]] : [[a, b, d], [b, c, d]];
    for (const [p0, p1, p2] of T2) {
      const ux = V[p1 * 3] - V[p0 * 3], uy = V[p1 * 3 + 1] - V[p0 * 3 + 1], uz = V[p1 * 3 + 2] - V[p0 * 3 + 2], wx = V[p2 * 3] - V[p0 * 3], wy = V[p2 * 3 + 1] - V[p0 * 3 + 1], wz = V[p2 * 3 + 2] - V[p0 * 3 + 2];
      const fx = uy * wz - uz * wy, fy = uz * wx - ux * wz, fz = ux * wy - uy * wx;
      if (fx * (N[p0 * 3] + N[p1 * 3] + N[p2 * 3]) + fy * (N[p0 * 3 + 1] + N[p1 * 3 + 1] + N[p2 * 3 + 1]) + fz * (N[p0 * 3 + 2] + N[p1 * 3 + 2] + N[p2 * 3 + 2]) >= 0) { put(p0); put(p1); put(p2); } else { put(p0); put(p2); put(p1); }
    }
  }
  return { position: new Float32Array(out), normal: new Float32Array(nrm), aH: new Float32Array(aH), aM: new Float32Array(aM), aO: new Float32Array(aO) };
}
export { vn3 };
