// 玉女潭精模建筑：按明式做法逐件拼装（柱础、额枋、雀替、斗拱、椽头、筒瓦屋面、歇山山花、鸱吻、寻杖栏杆、格扇）。
// 都是平涂顶点色，靠后处理勾线出“界画”的线条感。
import * as THREE from 'three';
import { Kit, COL, hipRoof } from './props.js';

const C = (h) => new THREE.Color(h);
const PAINT = {
  bracket: C('#4e6964'), bracketB: C('#3f5870'), beamBand: C('#56706a'), ridge: C('#4f4b43'),
  tileD: COL.tile.clone().multiplyScalar(0.78), paper: C('#e2d2b0'), dark: C('#2f2a24'), stoneL: C('#b6a88c'), redWin: C('#d4906e'),
};

// 任意参数曲面：F(u,t) -> [x,y,z]，nu×nt 网格
function surface(k, nu, nt, F, color, kind = 0) {
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= nt; j++) for (let i = 0; i <= nu; i++) { const p = F(i / nu, j / nt); pos.push(p[0], p[1], p[2]); uv.push(i / nu * 4, j / nt); }
  for (let j = 0; j < nt; j++) for (let i = 0; i < nu; i++) { const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  k.add(g, color, kind);
}
// 筒瓦起伏：沿瓦垄方向的半圆截面
const tileWave = (s, pitch = 0.3) => Math.pow(Math.abs(Math.sin(Math.PI * s / pitch)), 0.55);

// 沿两点放一根方料
function beam(k, a, b, w, h, color, kind = 0) {
  const dx = b[0] - a[0], dz = b[2] - a[2], len = Math.hypot(dx, dz);
  k.box(len, h, w, (a[0] + b[0]) / 2, a[1], (a[2] + b[2]) / 2, color, kind, -Math.atan2(dz, dx));
}
function tubeAlong(k, pts, r, color, seg = 10, radial = 6) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  k.add(new THREE.TubeGeometry(curve, seg, r, radial, false), color);
}
// 柱：鼓形柱础 + 微收分圆柱
function column(k, x, y, z, r, h, color = COL.zhu) {
  k.cyl(r * 1.7, r * 1.55, 0.16, x, y, z, PAINT.stoneL, 10);
  k.cyl(r, r * 0.9, h - 0.16, x, y + 0.16, z, color, 12);
}
// 斗拱一朵（五铺作简化）：栌斗、泥道栱、华栱两跳、散斗、令栱、耍头
export function dougong(k, x, y, z, ry, s = 1) {
  const cs = Math.cos(ry), sn = Math.sin(ry);
  const at = (lx, lz) => [x + lx * cs + lz * sn, z - lx * sn + lz * cs];
  const B = (w, h, d, lx, ly, lz, col) => { const [px, pz] = at(lx, lz); k.box(w * s, h * s, d * s, px, y + ly * s, pz, col, 0, ry); };
  B(0.34, 0.2, 0.34, 0, 0, 0, PAINT.bracket);
  B(1.0, 0.14, 0.16, 0, 0.2, 0, PAINT.bracketB);
  B(0.16, 0.14, 0.75, 0, 0.2, 0.2, PAINT.bracket);
  for (const lx of [-0.42, 0.42]) B(0.2, 0.13, 0.2, lx, 0.34, 0, PAINT.bracket);
  B(0.2, 0.13, 0.2, 0, 0.34, 0.5, PAINT.bracket);
  B(1.3, 0.14, 0.16, 0, 0.47, 0.5, PAINT.bracketB);
  B(0.16, 0.14, 1.15, 0, 0.47, 0.4, PAINT.bracket);
  for (const lx of [-0.58, 0, 0.58]) B(0.2, 0.13, 0.2, lx, 0.61, 0.5, PAINT.bracket);
  B(0.12, 0.16, 0.5, 0, 0.61, 0.95, COL.zhu); // 耍头
}
// 一排斗拱：沿墙线从 a 到 b，间距 gap
function dougongRow(k, a, b, y, gap, s, outward) {
  const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), n = Math.max(1, Math.round(len / gap));
  const ry = Math.atan2(outward[0], outward[1]);
  for (let i = 0; i <= n; i++) { const t = i / n; dougong(k, a[0] + dx * t, y, a[1] + dz * t, ry, s); }
}
// 寻杖栏杆：地栿、华板（格心）、盆唇、瘿项、寻杖、望柱
function railing(k, a, b, y, h = 1.0, postGap = 1.25) {
  const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz), ry = -Math.atan2(dz, dx);
  const P = (t) => [a[0] + dx * t, a[1] + dz * t];
  beam(k, [a[0], y, a[1]], [b[0], y, b[1]], 0.14, 0.12, COL.zhu);
  beam(k, [a[0], y + h * 0.55, a[1]], [b[0], y + h * 0.55, b[1]], 0.12, 0.08, COL.zhu);
  beam(k, [a[0], y + h * 0.92, a[1]], [b[0], y + h * 0.92, b[1]], 0.09, 0.09, COL.zhu);
  const [mx, mz] = P(0.5);
  const panel = new THREE.BoxGeometry(len, h * 0.42, 0.04);
  const uvA = panel.attributes.uv; for (let i = 0; i < uvA.count; i++) uvA.setXY(i, uvA.getX(i) * len / 0.9, uvA.getY(i) * h * 0.42 / 0.9);
  k.add(panel, PAINT.paper, 2, new THREE.Matrix4().makeRotationY(ry).setPosition(mx, y + 0.12 + h * 0.21, mz));
  const n = Math.max(1, Math.round(len / postGap));
  for (let i = 0; i <= n; i++) { const [px, pz] = P(i / n); k.box(0.14, h + 0.12, 0.14, px, y, pz, COL.zhu, 0, ry); k.box(0.2, 0.12, 0.2, px, y + h + 0.12, pz, COL.zhu, 0, ry); }
  const m = Math.round(len / 0.5);
  for (let i = 1; i < m; i++) { const [px, pz] = P(i / m); k.box(0.06, h * 0.33, 0.06, px, y + h * 0.59, pz, COL.zhu, 0, ry); }
}
// 格扇：外框、格心（kind 2 窗格）、绦环板、裙板
function geshan(k, x, y, z, w, h, ry, open = false) {
  const cs = Math.cos(ry), sn = Math.sin(ry);
  const B = (bw, bh, bd, lx, ly, col, kind = 0) => {
    const g = new THREE.BoxGeometry(bw, bh, bd);
    if (kind === 2) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * bw / 1.1, uv.getY(i) * bh / 1.1); }
    k.add(g, col, kind, new THREE.Matrix4().makeRotationY(ry).setPosition(x + lx * cs, y + ly + bh / 2, z - lx * sn));
  };
  if (open) { B(w, h, 0.04, 0, 0, PAINT.dark); return; }
  B(w, h * 0.6, 0.05, 0, h * 0.34, PAINT.paper, 2);
  B(w, h * 0.06, 0.07, 0, h * 0.27, COL.zhu);
  B(w, h * 0.25, 0.07, 0, 0.02, COL.zhu);
  for (const lx of [-w / 2, w / 2]) B(0.08, h, 0.09, lx, 0, COL.zhu);
  B(w, 0.08, 0.09, 0, h - 0.08, COL.zhu);
}
// 粉墙上开的一扇红格子窗（原画 IMG_1270 大觀廊：白墙，每间上半截一溜朱红窗格）
function windowPanel(k, x, y, z, w, h) {
  const B = (bw, bh, bd, lx, ly, col, kind = 0) => {
    const g = new THREE.BoxGeometry(bw, bh, bd);
    if (kind === 2) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * bw / 0.8, uv.getY(i) * bh / 1.6); }
    k.add(g, col, kind, new THREE.Matrix4().setPosition(x + lx, y + ly + bh / 2, z));
  };
  B(w, h, 0.05, 0, 0, PAINT.redWin, 2);
  B(w + 0.12, 0.08, 0.08, 0, -0.04, COL.zhu); B(w + 0.12, 0.08, 0.08, 0, h - 0.04, COL.zhu);
  for (const lx of [-w / 2, w / 2]) B(0.08, h, 0.08, lx, 0, COL.zhu);
}
// 檐椽：沿檐口一排短椽，椽头朝外
function rafters(k, E0, E1, y, inward, gap = 0.24) {
  const dx = E1[0] - E0[0], dz = E1[1] - E0[1], len = Math.hypot(dx, dz), n = Math.round(len / gap);
  const ry = Math.atan2(inward[0], inward[1]);
  for (let i = 1; i < n; i++) {
    const t = i / n, x = E0[0] + dx * t, z = E0[1] + dz * t;
    const g = new THREE.CylinderGeometry(0.055, 0.055, 0.9, 6); g.rotateX(Math.PI / 2);
    k.add(g, COL.wood, 0, new THREE.Matrix4().makeRotationY(ry).setPosition(x + inward[0] * 0.35, y - 0.1, z + inward[1] * 0.35));
  }
}

// 四阿/庑殿式屋面（可只取下半截做腰檐）：四面筒瓦 + 角脊
function hipRoofHD(k, W, D, L, y0, rh, curl, tMax = 1) {
  const faces = [
    [[-W, D], [W, D], [-L, 0], [L, 0], 'x'], [[W, D], [W, -D], [L, 0], [L, 0], 'z'],
    [[W, -D], [-W, -D], [L, 0], [-L, 0], 'x'], [[-W, -D], [-W, D], [-L, 0], [-L, 0], 'z'],
  ];
  for (const [E0, E1, R0, R1, ax] of faces) {
    const len = Math.hypot(E1[0] - E0[0], E1[1] - E0[1]);
    const P = (u, t) => {
      const tt = t * tMax, ex = E0[0] + (E1[0] - E0[0]) * u, ez = E0[1] + (E1[1] - E0[1]) * u;
      const rx = R0[0] + (R1[0] - R0[0]) * u, rz = R0[1] + (R1[1] - R0[1]) * u;
      const corner = Math.pow(Math.abs(2 * u - 1), 6) * (1 - tt) * (1 - tt);
      const x = ex + (rx - ex) * tt, z = ez + (rz - ez) * tt;
      return [x, y0 + rh * Math.pow(tt, 1.7) + curl * corner + 0.07 * tileWave(ax === 'x' ? x : z), z];
    };
    surface(k, Math.round(len / 0.075), 10, P, COL.tile, 1);
    tubeAlong(k, [0, 0.25, 0.5, 0.75, 1].map((t) => { const p = P(0, t); return [p[0], p[1] + 0.1, p[2]]; }), 0.1, PAINT.ridge, 10, 5);
    rafters(k, E0, E1, y0 + 0.02, [(R0[0] + R1[0]) / 2 - (E0[0] + E1[0]) / 2, (R0[1] + R1[1]) / 2 - (E0[1] + E1[1]) / 2].map((v, _, a) => v / Math.hypot(...a)));
  }
  if (tMax >= 1) ridgeWithChiwen(k, L, y0 + rh);
  else { // 腰檐上沿压一道围脊
    const t = tMax, hw = W - (W - L) * t, hd = D * (1 - t), yy = y0 + rh * Math.pow(t, 1.7);
    for (const [a, b] of [[[-hw, hd], [hw, hd]], [[hw, hd], [hw, -hd]], [[hw, -hd], [-hw, -hd]], [[-hw, -hd], [-hw, hd]]]) beam(k, [a[0], yy - 0.05, a[1]], [b[0], yy - 0.05, b[1]], 0.26, 0.22, PAINT.ridge);
  }
}
function ridgeWithChiwen(k, L, y) {
  k.box(2 * L + 0.4, 0.42, 0.34, 0, y - 0.12, 0, PAINT.ridge);
  k.box(2 * L + 0.2, 0.08, 0.42, 0, y + 0.3, 0, PAINT.ridge);
  for (const s of [-1, 1]) { // 鸱吻：向内卷的尾
    tubeAlong(k, [[s * (L + 0.2), y, 0], [s * (L + 0.25), y + 0.55, 0], [s * (L + 0.05), y + 0.95, 0], [s * (L - 0.25), y + 0.85, 0], [s * (L - 0.3), y + 0.6, 0]], 0.13, PAINT.ridge, 12, 6);
  }
}
// 歇山顶：前后坡通长到山面，两山下半截是厦两头的坡，上半截是红色山花
function xieshanHD(k, W, D, y0, rh, curl, split = 0.42) {
  const xg = W - D * split; // 山花所在的 x：两山厦坡与前后坡同坡度，角脊走 45°
  const Y = (t) => y0 + rh * Math.pow(t, 1.7);
  for (const s of [1, -1]) { // 前后坡
    const F = (u, t) => {
      const hw = t < split ? W - (W - xg) * (t / split) : xg;
      const x = -hw + 2 * hw * u, z = s * D * (1 - t);
      const corner = Math.pow(Math.abs(2 * u - 1), 6) * Math.pow(Math.max(0, 1 - t / split), 2);
      return [x, Y(t) + curl * corner + 0.07 * tileWave(x), z];
    };
    surface(k, Math.round(2 * W / 0.075), 14, s > 0 ? F : (u, t) => F(1 - u, t), COL.tile, 1);
    rafters(k, [-W, s * D], [W, s * D], y0 + 0.02, [0, -s]);
  }
  for (const s of [1, -1]) { // 两山的厦坡
    const F = (u, t) => {
      const tt = t * split, z = (-D + 2 * D * u) * (1 - tt), x = s * (W - (W - xg) * (tt / split));
      const corner = Math.pow(Math.abs(2 * u - 1), 6) * (1 - t) * (1 - t);
      return [x, Y(tt) + curl * corner + 0.07 * tileWave(z), z];
    };
    surface(k, Math.round(2 * D / 0.075), 8, s > 0 ? (u, t) => F(1 - u, t) : F, COL.tile, 1);
    rafters(k, [s * W, -D], [s * W, D], y0 + 0.02, [-s, 0]);
    // 山花：沿屋面曲线的红板，外压一道白色博风
    const pos = [], n = 10, yb = Y(split);
    for (let i = 0; i < n; i++) {
      const t0 = split + (1 - split) * (i / n), t1 = split + (1 - split) * ((i + 1) / n);
      for (const sz of [1, -1]) {
        const z0 = sz * D * (1 - t0), z1 = sz * D * (1 - t1);
        pos.push(s * xg, yb, z0, s * xg, Y(t0), z0, s * xg, Y(t1), z1, s * xg, yb, z0, s * xg, Y(t1), z1, s * xg, yb, z1);
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    k.add(g, COL.zhu);
    for (const sz of [1, -1]) tubeAlong(k, [0, 0.25, 0.5, 0.75, 1].map((q) => { const t = split + (1 - split) * q; return [s * (xg + 0.06), Y(t) + 0.06, sz * D * (1 - t)]; }), 0.09, COL.lattice, 8, 5);
    k.box(0.12, 0.22, 2 * D * (1 - split), s * xg, yb - 0.02, 0, PAINT.ridge);
    // 垂脊、戗脊
    for (const sz of [1, -1]) tubeAlong(k, [0, 0.3, 0.6, 1].map((q) => { const t = split * q; const cr = Math.pow(1 - q, 2) * curl; return [s * (W - (W - xg) * q), Y(t) + cr + 0.1, sz * D * (1 - t)]; }), 0.1, PAINT.ridge, 8, 5);
  }
  ridgeWithChiwen(k, xg, y0 + rh);
}

// ---------- 玉光閣 ----------
// 下层：五开间，前檐格扇、两梢间槛窗；腰檐一周；上层：平座寻杖栏杆、三开间格扇、歇山顶。
export function buildYuguangGeHD() {
  const k = new Kit();
  // 台基、阶条石、踏跺
  k.box(10.6, 0.5, 7.6, 0, 0, 0, COL.stone);
  k.box(10.8, 0.1, 7.8, 0, 0.5, 0, PAINT.stoneL);
  for (let i = 0; i < 3; i++) k.box(2.6, 0.2 * (3 - i), 0.42, 0, 0, 3.95 + i * 0.4, PAINT.stoneL);
  const F1 = 0.6, H1 = 3.3;
  const xs = [-4.2, -2.3, -0.9, 0.9, 2.3, 4.2];
  // 柱网
  for (const x of xs) for (const z of [-2.8, 2.8]) column(k, x, F1, z, 0.17, H1);
  for (const z of [-0.9, 0.9]) for (const x of [-4.2, 4.2]) column(k, x, F1, z, 0.17, H1);
  // 后、侧墙（白墙，下碱）
  k.box(8.3, H1 - 0.2, 0.3, 0, F1, -2.8, COL.wall); k.box(8.4, 0.8, 0.36, 0, F1, -2.8, PAINT.stoneL);
  for (const s of [-1, 1]) { k.box(0.3, H1 - 0.2, 5.5, s * 4.2, F1, 0, COL.wall); k.box(0.36, 0.8, 5.6, s * 4.2, F1, 0, PAINT.stoneL); }
  // 前檐：明间开门，次间格扇，梢间槛窗
  geshan(k, 0, F1, 2.72, 1.75, 2.75, 0, true);
  for (const s of [-1, 1]) {
    geshan(k, s * 1.25, F1, 2.75, 0.62, 2.75, 0); geshan(k, s * 1.95, F1, 2.75, 0.62, 2.75, 0);
    k.box(1.8, 0.95, 0.24, s * 3.25, F1, 2.75, COL.wall); k.box(1.85, 0.1, 0.32, s * 3.25, F1 + 0.95, 2.75, COL.zhu);
    geshan(k, s * 2.8, F1 + 1.05, 2.76, 0.86, 1.65, 0); geshan(k, s * 3.7, F1 + 1.05, 2.76, 0.86, 1.65, 0);
  }
  for (let i = 0; i < xs.length - 1; i++) k.box(xs[i + 1] - xs[i] - 0.3, 0.45, 0.08, (xs[i] + xs[i + 1]) / 2, F1 + 2.8, 2.78, PAINT.paper, 2); // 横披
  // 额枋、垫板、平板枋、雀替
  const ring = (y, h, w, col, o = 0) => { for (const [a, b] of [[[-4.2 - o, 2.8 + o], [4.2 + o, 2.8 + o]], [[4.2 + o, 2.8 + o], [4.2 + o, -2.8 - o]], [[4.2 + o, -2.8 - o], [-4.2 - o, -2.8 - o]], [[-4.2 - o, -2.8 - o], [-4.2 - o, 2.8 + o]]]) beam(k, [a[0], y, a[1]], [b[0], y, b[1]], w, h, col); };
  ring(F1 + H1 - 0.42, 0.3, 0.26, COL.zhu); ring(F1 + H1 - 0.12, 0.14, 0.2, PAINT.beamBand); ring(F1 + H1 + 0.02, 0.12, 0.36, COL.zhu, 0.02);
  for (const x of xs) for (const s of [-1, 1]) if (Math.abs(x + s * 0.4) < 4.3) k.box(0.55, 0.16, 0.09, x + s * 0.32, F1 + H1 - 0.6, 2.86, COL.zhu);
  // 腰檐斗拱 + 腰檐
  const yb = F1 + H1 + 0.14;
  dougongRow(k, [-4.2, 2.8], [4.2, 2.8], yb, 1.05, 0.62, [0, 1]); dougongRow(k, [4.2, -2.8], [-4.2, -2.8], yb, 1.05, 0.62, [0, -1]);
  dougongRow(k, [4.2, 2.8], [4.2, -2.8], yb, 1.1, 0.62, [1, 0]); dougongRow(k, [-4.2, -2.8], [-4.2, 2.8], yb, 1.1, 0.62, [-1, 0]);
  hipRoofHD(k, 5.4, 3.95, 0, yb + 0.45, 2.2, 0.45, 0.42);
  // 平座：楼板 + 寻杖栏杆
  const F2 = 4.84;
  k.box(7.6, 0.24, 5.4, 0, F2 - 0.24, 0, COL.wood);
  k.box(7.7, 0.14, 5.5, 0, F2 - 0.38, 0, COL.zhu);
  railing(k, [-3.65, 2.6], [3.65, 2.6], F2, 0.95, 1.2);
  for (const s of [-1, 1]) railing(k, [s * 3.65, 2.6], [s * 3.65, -2.5], F2, 0.95, 1.2);
  // 上层：柱、墙、格扇
  const H2 = 2.7, ux = [-3.6, -1.2, 1.2, 3.6];
  for (const x of ux) for (const z of [-2.5, 2.5]) column(k, x, F2, z, 0.14, H2);
  k.box(7.0, H2 - 0.3, 0.26, 0, F2, -2.0, COL.wall);
  for (const s of [-1, 1]) k.box(0.26, H2 - 0.3, 3.2, s * 3.0, F2, -0.4, COL.wall);
  for (let i = 0; i < 6; i++) geshan(k, -2.5 + i, F2, 1.2, 0.96, H2 - 0.6, 0);
  k.box(6.0, 0.4, 0.08, 0, F2 + H2 - 0.6, 1.2, PAINT.paper, 2);
  const ring2 = (y, h, w, col) => { for (const [a, b] of [[[-3.6, 2.5], [3.6, 2.5]], [[3.6, 2.5], [3.6, -2.5]], [[3.6, -2.5], [-3.6, -2.5]], [[-3.6, -2.5], [-3.6, 2.5]]]) beam(k, [a[0], y, a[1]], [b[0], y, b[1]], w, h, col); };
  ring2(F2 + H2 - 0.36, 0.26, 0.24, COL.zhu); ring2(F2 + H2 - 0.1, 0.12, 0.2, PAINT.beamBand); ring2(F2 + H2 + 0.02, 0.12, 0.34, COL.zhu);
  for (const x of ux) for (const s of [-1, 1]) if (Math.abs(x + s * 0.4) < 3.7) k.box(0.5, 0.15, 0.09, x + s * 0.3, F2 + H2 - 0.52, 2.56, COL.zhu);
  const yb2 = F2 + H2 + 0.14;
  dougongRow(k, [-3.6, 2.5], [3.6, 2.5], yb2, 1.2, 0.66, [0, 1]); dougongRow(k, [3.6, -2.5], [-3.6, -2.5], yb2, 1.2, 0.66, [0, -1]);
  dougongRow(k, [3.6, 2.5], [3.6, -2.5], yb2, 1.25, 0.66, [1, 0]); dougongRow(k, [-3.6, -2.5], [-3.6, 2.5], yb2, 1.25, 0.66, [-1, 0]);
  xieshanHD(k, 4.95, 3.7, yb2 + 0.48, 2.75, 0.7, 0.4);
  { const g = k.geometry(); g.userData.lamps = [[-2.3, 0.6 + 3.3 - 0.35, 3.25], [2.3, 0.6 + 3.3 - 0.35, 3.25], [-2.4, 4.84 + 2.7 - 0.3, 2.85], [2.4, 4.84 + 2.7 - 0.3, 2.85], [0, 2.2, 1.6, 'inner']]; return g; } // v38 夜里的灯（檐下四盏、屋里一盏）
}

// ---------- 六角亭（靈應亭等）----------
export function buildHexPavilionHD(R = 1.6, h = 2.6, { thatch = false } = {}) {
  const RC = thatch ? COL.thatch : COL.tile, RK = thatch ? 3 : 1, RG = thatch ? COL.thatch.clone().multiplyScalar(0.7) : PAINT.ridge;
  const k = new Kit();
  const corner = (i, r) => { const a = (i / 6) * Math.PI * 2 + Math.PI / 6; return [Math.cos(a) * r, Math.sin(a) * r]; };
  // 六角台基 + 阶条 + 踏跺
  k.cyl(R + 0.65, R + 0.55, 0.34, 0, 0, 0, COL.stone, 6);
  k.cyl(R + 0.62, R + 0.62, 0.08, 0, 0.34, 0, PAINT.stoneL, 6);
  { const [x0, z0] = corner(1, R + 0.9), [x1, z1] = corner(2, R + 0.9); k.box(1.3, 0.18, 0.5, (x0 + x1) / 2, 0, (z0 + z1) / 2, PAINT.stoneL, 0, -Math.atan2(z1 - z0, x1 - x0)); }
  const y0 = 0.42;
  for (let i = 0; i < 6; i++) {
    const [x, z] = corner(i, R), [x1, z1] = corner(i + 1, R);
    column(k, x, y0, z, 0.11, h);
    if (i !== 1) { // 坐凳栏杆（美人靠）
      beam(k, [x, y0 + 0.42, z], [x1, y0 + 0.42, z1], 0.34, 0.08, COL.wood);
      beam(k, [x, y0, z], [x1, y0, z1], 0.1, 0.42, PAINT.paper, 2);
      const mx = (x + x1) / 2, mz = (z + z1) / 2, out = [mx / Math.hypot(mx, mz), mz / Math.hypot(mx, mz)];
      beam(k, [x + out[0] * 0.12, y0 + 0.82, z + out[1] * 0.12], [x1 + out[0] * 0.12, y0 + 0.82, z1 + out[1] * 0.12], 0.07, 0.07, COL.zhu);
      for (let j = 1; j < 6; j++) { const t = j / 6; k.box(0.05, 0.4, 0.05, x + (x1 - x) * t + out[0] * 0.1, y0 + 0.46, z + (z1 - z) * t + out[1] * 0.1, COL.zhu); }
    }
    // 额枋、挂落、雀替
    beam(k, [x, y0 + h - 0.3, z], [x1, y0 + h - 0.3, z1], 0.18, 0.26, COL.zhu);
    beam(k, [x, y0 + h - 0.04, z], [x1, y0 + h - 0.04, z1], 0.16, 0.12, PAINT.beamBand);
    beam(k, [x, y0 + h - 0.62, z], [x1, y0 + h - 0.62, z1], 0.05, 0.32, PAINT.paper, 2);
    const mx = (x + x1) / 2, mz = (z + z1) / 2;
    dougong(k, x * 1.02, y0 + h + 0.08, z * 1.02, Math.atan2(x, z), 0.5);
    dougong(k, mx * 1.02, y0 + h + 0.08, mz * 1.02, Math.atan2(mx, mz), 0.5);
  }
  // 攒尖顶：六面筒瓦 + 六条角脊 + 宝顶
  const RR = R * 1.55, ry0 = y0 + h + 0.45, rh = 1.9, curl = 0.55;
  for (let i = 0; i < 6; i++) {
    const E0 = corner(i, RR), E1 = corner(i + 1, RR), len = Math.hypot(E1[0] - E0[0], E1[1] - E0[1]);
    const tx = (E1[0] - E0[0]) / len, tz = (E1[1] - E0[1]) / len;
    const P = (u, t) => {
      const ex = E0[0] + (E1[0] - E0[0]) * u, ez = E0[1] + (E1[1] - E0[1]) * u;
      const cr = Math.pow(Math.abs(2 * u - 1), 6) * (1 - t) * (1 - t);
      const x = ex * (1 - t), z = ez * (1 - t);
      return [x, ry0 + rh * Math.pow(t, 1.6) + curl * cr + 0.06 * tileWave((u - 0.5) * len, 0.28) * (1 - t), z];
    };
    surface(k, Math.round(len / 0.07), 10, (u, t) => P(1 - u, t), RC, RK);
    tubeAlong(k, [0, 0.25, 0.5, 0.75, 0.97].map((t) => { const p = P(0, t); return [p[0], p[1] + 0.08, p[2]]; }), thatch ? 0.12 : 0.08, RG, 10, 5);
    const mid = [(E0[0] + E1[0]) / 2, (E0[1] + E1[1]) / 2], ml = Math.hypot(...mid);
    rafters(k, E0, E1, ry0 + 0.02, [-mid[0] / ml, -mid[1] / ml], 0.22);
  }
  k.cyl(0.3, 0.22, 0.25, 0, ry0 + rh - 0.05, 0, PAINT.ridge, 10);
  k.add(new THREE.SphereGeometry(0.24, 10, 8), PAINT.ridge, 0, new THREE.Matrix4().setPosition(0, ry0 + rh + 0.38, 0));
  k.add(new THREE.ConeGeometry(0.1, 0.55, 8), PAINT.ridge, 0, new THREE.Matrix4().setPosition(0, ry0 + rh + 0.85, 0));
  { const g = k.geometry(); g.userData.lamps = [[0, 0.42 + h - 0.5, 0]]; return g; } // v38 夜里的灯（亭心一盏）
}

// ---------- 通用殿堂（其余各区的庙、亭、草堂）----------
// 宽 w 深 d 檐柱高 h；宽于 5 米用歇山，否则庑殿；roofKind 3 为草顶
// base: false 不要台基和踏步（重檐殿的上层坐在下层屋顶里）
// pass: 中间一间前后都敞（穿堂、门屋），前后都有踏步；gate: 中间一间装一对朱红大门（开着）和匾；bays: 开间数；
// front 'palace': 当中三间格扇门，其余粉墙红窗（大殿）
export function buildHallHD(w, d, h, { wall = COL.wall, roofKind = 1, front = 'lattice', base = true, pass = false, gate = false, bays = 0 } = {}) {
  const k = new Kit();
  if (base) {
    k.box(w + 1.2, 0.45, d + 1.2, 0, 0, 0, COL.stone);
    k.box(w + 1.35, 0.08, d + 1.35, 0, 0.45, 0, PAINT.stoneL);
    for (let i = 0; i < 2; i++) for (const s of pass ? [1, -1] : [1]) k.box(Math.min(2.4, w * 0.4), 0.22 * (2 - i), 0.42, 0, 0, s * (d / 2 + 0.8 + i * 0.42), PAINT.stoneL);
  } else k.box(w + 0.4, 0.55, d + 0.4, 0, 0, 0, wall);
  const F = 0.53, nb = bays || Math.max(3, Math.round(w / 1.6)) | 1;
  const xs = Array.from({ length: nb + 1 }, (_, i) => -w / 2 + (w * i) / nb);
  for (const x of xs) for (const z of [-d / 2, d / 2]) column(k, x, F, z, 0.13, h);
  if (d > 3) for (const x of [-w / 2, w / 2]) column(k, x, F, 0, 0.13, h);
  const bw = w / nb;
  if (pass) for (const s of [-1, 1]) k.box(w / 2 - bw / 2, h - 0.25, 0.22, s * (w / 4 + bw / 4), F, -d / 2, wall); // 后墙当中一间敞着
  else k.box(w, h - 0.25, 0.22, 0, F, -d / 2, wall);
  for (const s of [-1, 1]) k.box(0.22, h - 0.25, d, s * w / 2, F, 0, wall);
  for (let i = 0; i < nb; i++) {
    const cx = xs[i] + bw / 2;
    if (front === 'open') continue; // 敞开的殿：前面只剩柱子
    if (pass && i === (nb - 1) / 2) {
      if (gate) { // 朱红大门两扇向里开着，门槛、门簪、匾
        const lw = bw / 2 - 0.12, H = h * 0.72;
        for (const s of [-1, 1]) {
          k.box(0.09, H, lw, cx + s * (bw / 2 - 0.16), F, d / 2 - 0.12 - lw / 2, COL.zhu);
          for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) k.box(0.05, 0.07, 0.07, cx + s * (bw / 2 - 0.22), F + H * (0.2 + r * 0.15), d / 2 - 0.12 - lw * (0.2 + c * 0.3), PAINT.ridge);
        }
        k.box(bw - 0.2, 0.22, 0.14, cx, F, d / 2, COL.zhu);
        k.box(bw - 0.2, 0.3, 0.12, cx, F + H, d / 2, COL.zhu); k.box(bw * 0.5, 0.5, 0.06, cx, F + H + 0.24, d / 2 + 0.16, PAINT.bracketB); k.box(bw * 0.5 + 0.1, 0.06, 0.08, cx, F + H + 0.74, d / 2 + 0.16, PAINT.ridge);
      }
      continue;
    }
    if (front === 'palace' && Math.abs(i - (nb - 1) / 2) <= 1) { geshan(k, cx - bw / 4 + 0.03, F, d / 2, bw / 2 - 0.12, h * 0.82, 0); geshan(k, cx + bw / 4 - 0.03, F, d / 2, bw / 2 - 0.12, h * 0.82, 0); continue; }
    if (i === (nb - 1) / 2) geshan(k, cx, F, d / 2 - 0.02, bw - 0.25, h * 0.82, 0, true);
    else if (front === 'lattice') { geshan(k, cx - bw / 4 + 0.03, F, d / 2, bw / 2 - 0.12, h * 0.82, 0); geshan(k, cx + bw / 4 - 0.03, F, d / 2, bw / 2 - 0.12, h * 0.82, 0); }
    else if (front === 'window' || front === 'palace') { k.box(bw - 0.2, h - 0.25, 0.2, cx, F, d / 2, wall); windowPanel(k, cx, F + h * 0.5, d / 2 + 0.12, bw - 0.6, h * 0.3); }
    else k.box(bw - 0.2, h - 0.25, 0.2, cx, F, d / 2, wall);
  }
  const ring = (y, hh, ww, col) => { for (const [a, b] of [[[-w / 2, d / 2], [w / 2, d / 2]], [[w / 2, d / 2], [w / 2, -d / 2]], [[w / 2, -d / 2], [-w / 2, -d / 2]], [[-w / 2, -d / 2], [-w / 2, d / 2]]]) beam(k, [a[0], y, a[1]], [b[0], y, b[1]], ww, hh, col); };
  ring(F + h - 0.34, 0.24, 0.22, COL.zhu); ring(F + h - 0.1, 0.1, 0.18, PAINT.beamBand); ring(F + h, 0.1, 0.3, COL.zhu);
  for (const x of xs) for (const s of [-1, 1]) if (Math.abs(x + s * 0.35) < w / 2 + 0.05) k.box(0.45, 0.13, 0.08, x + s * 0.27, F + h - 0.5, d / 2 + 0.06, COL.zhu);
  const yb = F + h + 0.1;
  if (roofKind === 3) { hipRoof(k, w / 2 + 0.8, d / 2 + 0.7, w * 0.22, yb, Math.min(w, d) * 0.42, 0.3, COL.thatch); k.parts.slice(-5).forEach((g) => g.attributes.aKind.array.fill(3)); { const g = k.geometry(); g.userData.lamps = [[-w * 0.3, 0.53 + h - 0.35, d / 2 + 0.42], [w * 0.3, 0.53 + h - 0.35, d / 2 + 0.42], [0, 0.53 + h * 0.45, d / 2 - 0.5, 'inner']]; return g; } } // v38 夜里的灯（檐下两盏、屋里一盏）
  const s = Math.min(0.55, 0.3 + w * 0.04);
  dougongRow(k, [-w / 2, d / 2], [w / 2, d / 2], yb, 0.95, s, [0, 1]); dougongRow(k, [w / 2, -d / 2], [-w / 2, -d / 2], yb, 0.95, s, [0, -1]);
  dougongRow(k, [w / 2, d / 2], [w / 2, -d / 2], yb, 1.0, s, [1, 0]); dougongRow(k, [-w / 2, -d / 2], [-w / 2, d / 2], yb, 1.0, s, [-1, 0]);
  const y0 = yb + s * 0.75, W = w / 2 + 0.95, D = d / 2 + 0.85, rh = Math.min(w, d) * 0.48 + 0.4;
  if (w >= 5) xieshanHD(k, W, D, y0, rh, 0.45, 0.4); else hipRoofHD(k, W, D, Math.max(0.2, W - D), y0, rh, 0.4);
  { const g = k.geometry(); g.userData.lamps = [[-w * 0.3, 0.53 + h - 0.35, d / 2 + 0.42], [w * 0.3, 0.53 + h - 0.35, d / 2 + 0.42], [0, 0.53 + h * 0.45, d / 2 - 0.5, 'inner']]; return g; } // v38 夜里的灯（檐下两盏、屋里一盏）
}

// 超然亭（原画 IMG_1263 题“超然宇”）：山居书屋式的三间瓦屋。木柱深褐、不施彩画，粉墙；前面敞着，两侧间一道瓶式栏杆，
// 后墙中间开一个大窗看得见屋后的山；右山墙一直砌到屋顶成三角山尖，左端出檐，两坡瓦顶，檐角微微翘起。原点在台基底面中心，前面朝 +z
export function buildRetreatHD(w = 8.4, d = 4.6, h = 2.9, rh = 2.4) { // v39 rh：屋顶起坡（禪窩矮屋用 1.0）
  const k = new Kit(), WOOD = C('#5b4a3a'), WALL = C('#e8dfc6'), F = 0.38;
  k.box(w + 0.9, F, d + 0.9, 0, 0, 0, COL.stone); k.box(w + 1.0, 0.06, d + 1.0, 0, F - 0.04, 0, PAINT.stoneL);
  k.box(2.2, 0.18, 0.4, 0, 0, d / 2 + 0.62, PAINT.stoneL);                                          // 门前一级踏步
  const xs = [-w / 2, -w / 6, w / 6, w / 2];
  for (const x of xs) column(k, x, F, d / 2, 0.09, h, WOOD);
  // 后墙：中间一个大窗洞（原画从屋里望出去是绿山）
  const ow = w * 0.36, oy0 = F + h * 0.32, oy1 = F + h * 0.8;
  k.box(w, oy0 - F, 0.18, 0, F, -d / 2, WALL); k.box(w, F + h - oy1, 0.18, 0, oy1, -d / 2, WALL);
  for (const s of [-1, 1]) k.box((w - ow) / 2, oy1 - oy0, 0.18, s * (w + ow) / 4, oy0, -d / 2, WALL);
  for (const [a, b] of [[[-ow / 2, oy0, -d / 2 + 0.1], [ow / 2, oy0, -d / 2 + 0.1]], [[-ow / 2, oy1 - 0.08, -d / 2 + 0.1], [ow / 2, oy1 - 0.08, -d / 2 + 0.1]]]) beam(k, a, b, 0.1, 0.08, WOOD);
  for (const s of [-1, 1]) k.box(0.08, oy1 - oy0, 0.1, s * ow / 2, oy0, -d / 2 + 0.1, WOOD);
  // 两山墙；右山墙砌到山尖
  for (const s of [-1, 1]) k.box(0.2, h, d, s * w / 2, F, 0, WALL);
  { const sh = new THREE.Shape(); sh.moveTo(-d / 2 - 0.1, 0); sh.lineTo(d / 2 + 0.1, 0); sh.lineTo(0, rh - 0.05); sh.closePath();
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.2, bevelEnabled: false }); g.rotateY(Math.PI / 2); g.translate(w / 2 - 0.1, F + h, 0); k.add(g, WALL); }
  // 前檐：额枋一道，柱头间挂一条深色雀替
  beam(k, [-w / 2, F + h - 0.2, d / 2], [w / 2, F + h - 0.2, d / 2], 0.16, 0.22, WOOD);
  beam(k, [-w / 2, F + h - 0.2, -d / 2], [w / 2, F + h - 0.2, -d / 2], 0.16, 0.22, WOOD);
  // 两侧间的瓶式栏杆
  for (const [x0, x1] of [[xs[0], xs[1]], [xs[2], xs[3]]]) {
    const z = d / 2, y = F, H = 0.62;
    beam(k, [x0, y + 0.08, z], [x1, y + 0.08, z], 0.1, 0.1, WOOD); beam(k, [x0, y + H, z], [x1, y + H, z], 0.12, 0.08, WOOD);
    const n = 4; for (let i = 1; i <= n; i++) { const x = x0 + (x1 - x0) * i / (n + 1); k.cyl(0.035, 0.05, H - 0.18, x, y + 0.18, z, WOOD, 8); k.cyl(0.07, 0.035, 0.14, x, y + 0.18 + (H - 0.18) * 0.45, z, WOOD, 8); }
  }
  // 两坡瓦顶：左端出檐多，右端压在山墙上；四角檐口微翘
  const y0 = F + h + 0.04, D = d / 2 + 0.85, L0 = w / 2 + 0.75, L1 = w / 2 + 0.3;
  for (const s of [1, -1]) {
    const P = (u, t) => { const x = -L0 + (L0 + L1) * u, corner = Math.pow(Math.abs(2 * u - 1), 6) * (1 - t) * (1 - t);
      return [x, y0 - 0.25 * (1 - t) + (rh + 0.2) * Math.pow(t, 1.25) + 0.22 * corner + 0.06 * tileWave(x), s * D * (1 - t)]; };
    surface(k, Math.round((L0 + L1) / 0.075), 8, s > 0 ? P : (u, t) => P(1 - u, t), COL.tile, 1);
    beam(k, [-L0, y0 - 0.3, s * D - s * 0.04], [L1, y0 - 0.3, s * D - s * 0.04], 0.06, 0.1, WOOD); // 檐口封檐板
  }
  k.box(L0 + L1 + 0.1, 0.2, 0.22, (L1 - L0) / 2, y0 + rh - 0.12, 0, PAINT.ridge);
  { const g = k.geometry(); g.userData.lamps = [[-w * 0.28, 0.38 + h - 0.35, d / 2 + 0.4], [w * 0.28, 0.38 + h - 0.35, d / 2 + 0.4], [0, 0.38 + h * 0.45, 0, 'inner']]; return g; } // v38 夜里的灯（檐下两盏、屋里一盏）
}

// 两坡筒瓦顶（回廊用）
function gableHD(k, L, D, y0, rh) {
  for (const s of [1, -1]) {
    const F = (u, t) => { const x = -L + 2 * L * u, z = s * D * (1 - t); return [x, y0 + rh * Math.pow(t, 1.5) + 0.06 * tileWave(x), z]; };
    surface(k, Math.round(2 * L / 0.08), 6, s > 0 ? F : (u, t) => F(1 - u, t), COL.tile, 1);
  }
  k.box(2 * L + 0.1, 0.22, 0.24, 0, y0 + rh - 0.08, 0, PAINT.ridge);
}
// 回廊（大觀廊）：弧形排开的柱、额枋、挂落、坐凳栏杆与连续两坡顶
export function buildCorridorHD(R, a0, a1, n = 12) {
  const k = new Kit();
  for (let i = 0; i < n; i++) {
    const a = a0 + (a1 - a0) * (i + 0.5) / n, x = Math.cos(a) * R, z = Math.sin(a) * R;
    const seg = Math.abs(a1 - a0) * R / n;
    const m = new THREE.Matrix4().makeRotationY(-a + Math.PI / 2).setPosition(x, 0, z);
    const kk = new Kit();
    kk.box(seg + 0.1, 0.3, 3, 0, 0, 0, COL.stone);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) column(kk, sx * seg / 2, 0.3, sz * 1.2, 0.11, 2.6);
    for (const sz of [-1, 1]) {
      beam(kk, [-seg / 2, 2.62, sz * 1.2], [seg / 2, 2.62, sz * 1.2], 0.16, 0.22, COL.zhu);
      beam(kk, [-seg / 2, 2.3, sz * 1.2], [seg / 2, 2.3, sz * 1.2], 0.05, 0.3, PAINT.paper, 2);
      beam(kk, [-seg / 2, 0.75, sz * 1.25], [seg / 2, 0.75, sz * 1.25], 0.3, 0.07, COL.wood);
      beam(kk, [-seg / 2, 0.3, sz * 1.25], [seg / 2, 0.3, sz * 1.25], 0.06, 0.45, PAINT.paper, 2);
    }
    gableHD(kk, seg / 2 + 0.06, 1.85, 2.9, 1.0);
    k.parts.push(kk.geometry(m));
  }
  return k.geometry();
}

// v31 光枝瘦树（原画超然亭左边几株落了叶的细树）：两三根细干从一处长出，往上分叉，枝梢细而向上张开，像蟹爪。h 高，原点在根部
export function buildBareTree(seed, h = 6) {
  const k = new Kit(), BARK = C('#4e4237'), up = new THREE.Vector3(0, 1, 0);
  let s = seed * 9301 + 49297; const r = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  const limb = (a, b, r0, r1) => {
    const d = new THREE.Vector3().subVectors(b, a), L = d.length();
    const m = new THREE.Matrix4().compose(a.clone().addScaledVector(d, 0.5), new THREE.Quaternion().setFromUnitVectors(up, d.clone().normalize()), new THREE.Vector3(1, 1, 1));
    k.add(new THREE.CylinderGeometry(r1, r0, L, 5, 1), BARK, 0, m);
  };
  const grow = (p, dir, len, rad, depth) => {
    const q = p.clone().addScaledVector(dir, len);
    limb(p, q, rad, rad * 0.68);
    if (depth === 0 || rad < 0.025) return;
    const nb = depth > 2 ? 2 : 2 + (r() < 0.5 ? 1 : 0);
    for (let i = 0; i < nb; i++) {
      const a = r() * Math.PI * 2, spread = 0.35 + r() * 0.35;
      const nd = dir.clone().multiplyScalar(1.2).add(new THREE.Vector3(Math.cos(a) * spread, 0.25 + r() * 0.2, Math.sin(a) * spread)).normalize();
      grow(q, nd, len * (0.62 + r() * 0.18), rad * 0.62, depth - 1);
    }
  };
  const nt = 2 + (r() < 0.6 ? 1 : 0);
  for (let i = 0; i < nt; i++) {
    const a = r() * Math.PI * 2, dir = new THREE.Vector3(Math.cos(a) * 0.15, 1, Math.sin(a) * 0.15).normalize();
    grow(new THREE.Vector3(Math.cos(a) * 0.12, 0, Math.sin(a) * 0.12), dir, h * (0.38 + r() * 0.1), h * 0.022, 4);
  }
  return k.geometry();
}
