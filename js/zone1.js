// 东境·廊院（IMG_1271、1270）：金晶巖岩洞、龍王廟红墙院、大觀廊院落用的专门构件。
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CAVE, CAVE_BAND, caveBandRho, caveBandZ, caveRoof, terrainBase, massifAt, vnoise, rand } from './world.js';
import { Kit, COL, hipRoof } from './props.js';

// 参数网格 F(i/nu, j/nv) -> [x,y,z,aH,aM]；flip 翻转朝向
function grid(nu, nv, F, flip = false) {
  const pos = [], aH = [], aM = [], idx = [];
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) { const p = F(i / nu, j / nv); pos.push(p[0], p[1], p[2]); aH.push(p[3]); aM.push(p[4]); }
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
    if (flip) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aH', new THREE.Float32BufferAttribute(aH, 1));
  g.setAttribute('aM', new THREE.Float32BufferAttribute(aM, 1));
  g.setIndex(idx); g.computeVertexNormals();
  return g.toNonIndexed();
}
// 让网格法线朝向 want(点) 给出的方向（岩石材质单面）
function orient(g, want) {
  const p = g.attributes.position, n = g.attributes.normal;
  let s = 0; for (let i = 0; i < p.count; i += 7) { const w = want(p.getX(i), p.getY(i), p.getZ(i)); s += n.getX(i) * w[0] + n.getY(i) * w[1] + n.getZ(i) * w[2]; }
  if (s < 0) { for (let i = 0; i < p.count; i += 3) for (const a of [p, n, g.attributes.aH, g.attributes.aM]) { const k = a.itemSize; for (let c = 0; c < k; c++) { const t = a.array[(i + 1) * k + c]; a.array[(i + 1) * k + c] = a.array[(i + 2) * k + c]; a.array[(i + 2) * k + c] = t; } } g.computeVertexNormals(); }
  return g;
}

// ---------- 金晶巖：一座圆浑的岩丘，正面开拱形大洞；洞檐一圈圈层叠的石棱，檐下垂钟乳 ----------
// 局部坐标：原点在洞口地面中心，洞口朝 +z
export function buildCave() {
  const { hw, hc, dc, T, TV, lip, y: Y } = CAVE;
  const parts = [];
  const lumpy = (a, z, k) => k * (vnoise(a * 3.1 + 7, z * 0.45) - 0.5) + k * 0.5 * (vnoise(a * 9, z * 1.3 + 2) - 0.5);
  // 洞壁：半椭球穹顶，从最里一道檐往里
  const vault = grid(60, 30, (u, v) => {
    const z0 = CAVE_BAND.z0 - (CAVE_BAND.rho.length - 2) * CAVE_BAND.dz + 0.12, a = -0.12 + (Math.PI + 0.24) * u, z = z0 - (z0 + dc) * v, f = z > 0 ? 1 : Math.sqrt(Math.max(0, 1 - (z / dc) ** 2));
    const r = 1 + lumpy(a, z, 0.12) * Math.min(1, -z / 1.5);
    return [hw * Math.cos(a) * f * r, hc * Math.sin(a) * f * r, z, 0.08, 1 + Math.min(1, Math.max(0, -z / dc) * 1.3)];
  });
  orient(vault, (x, y, z) => [-x, -(y - 0.0), -(z + dc * 0.3)]);
  parts.push(vault);
  // 洞底：压暗的平地
  const floor = grid(16, 16, (u, v) => { const z = lip - (lip + dc) * v, f = z > 0 ? 1 : Math.sqrt(Math.max(0, 1 - (z / dc) ** 2)); return [(u * 2 - 1) * hw * f * 0.98, 0.05, z, 0.02, 1 + Math.min(1, Math.max(0, -z / dc) * 1.2)]; });
  orient(floor, () => [0, 1, 0]); parts.push(floor);
  // 洞檐：五道石檐（原画 IMG_1271），外圈在前，里圈一道道往洞里收。每道做朝外的檐面，加上檐下沿往里收的那一窄条底面。
  // aH = (第几道 + 从下沿到上沿)/5；aM = 0.02 檐面，0.03 檐底
  const NB = CAVE_BAND.rho.length - 1;
  const rhoAt = (k, a) => { let r = CAVE_BAND.rho[k]; for (let i = 0; i < 3; i++) r = caveBandRho(k, (hw + r * T) * Math.cos(a)); return r; };
  const ring = (rho, a) => [(hw + rho * T) * Math.cos(a), Math.max(-1.6, (hc + rho * TV) * Math.sin(a))];
  for (let k = 0; k < NB; k++) {
    const riser = grid(110, 5, (u, v) => {
      const a = -0.25 + (Math.PI + 0.5) * u, r0 = rhoAt(k, a), r1 = rhoAt(k + 1, a), [lx, y] = ring(r0 + (r1 - r0) * v, a);
      return [lx, y, caveBandZ(k, lx) + 0.16 * (1 - v) * (1 - v), (k + v) / NB, 0.02];
    });
    orient(riser, () => [0, 0, 1]);
    parts.push(riser);
    if (k === 0) continue;
    const soffit = grid(110, 3, (u, w) => {
      const a = -0.25 + (Math.PI + 0.5) * u, [lx, y] = ring(rhoAt(k, a), a);
      return [lx, y, caveBandZ(k - 1, lx) - 0.05 + (caveBandZ(k, lx) + 0.16 - caveBandZ(k - 1, lx) + 0.05) * w, k / NB, 0.03];
    });
    orient(soffit, (x, y) => [-x, -y, 0]);
    parts.push(soffit);
  }
  // 岩壳外表：与地形共用 caveShell，盖住洞顶；前沿贴着最外一道檐
  const c = Math.cos(CAVE.ry), sn = Math.sin(CAVE.ry);
  const shellPt = (lx, lz) => {
    const base = terrainBase(CAVE.x + lx * c + lz * sn, CAVE.z - lx * sn + lz * c);
    let y = caveRoof(lx, lz, base);
    if (!(y > -1e8)) y = Math.min(base, Y) - 1.5;
    return [lx, y - Y, lz, Math.min(1, 0.4 + 0.6 * (y - Y) / (hc + TV)), 0];
  };
  const shell = grid(130, 70, (u, v) => { const lx = (u * 2 - 1) * (hw + T) * 0.999, f = caveBandZ(NB - 1, lx) - 0.01; return shellPt(lx, f - (f + dc + T) * Math.pow(v, 1.4)); });
  orient(shell, () => [0, 1, 0]);
  parts.push(shell);
  // 钟乳：沿内拱垂下，顶上长、两边短
  const r = rand(1271), drips = [];
  for (let s = 0.32; s < Math.PI - 0.32; s += 0.07 + r() * 0.06) {
    const top = Math.sin(s), L = (0.35 + 1.3 * top * top) * (0.6 + r() * 0.7), R = 0.12 + 0.2 * r();
    const g = new THREE.ConeGeometry(R, L, 6, 1); g.rotateX(Math.PI);
    const x = hw * Math.cos(s) * 0.97, zz = caveBandZ(0, x) - 0.1 - r() * 1.0, y = hc * Math.sin(s) * 0.97 - L / 2 + 0.15;
    g.translate(x, y, zz);
    const n = g.attributes.position.count;
    g.setAttribute('aH', new THREE.Float32BufferAttribute(new Float32Array(n).fill(0.18), 1));
    g.setAttribute('aM', new THREE.Float32BufferAttribute(new Float32Array(n).fill(0.35), 1));
    drips.push(g.toNonIndexed());
  }
  // 每道檐的下沿也挂一排短乳石（原画每道檐下一排浅土黄的尖）
  for (let k = 1; k < NB; k++) for (let s = 0.28 + r() * 0.1; s < Math.PI - 0.28; s += 0.1 + r() * 0.2) {
    if (r() < 0.3 + k * 0.06) continue; // 成簇、有空当，外圈稀
    const rho = rhoAt(k, s), top = Math.sin(s), L = (0.3 + 0.7 * top) * (0.35 + Math.pow(r(), 1.8) * 1.5), R = 0.15 + 0.3 * r();
    const g = new THREE.ConeGeometry(R, L, 6, 1); g.rotateX(Math.PI); g.scale(1, 1, 0.4); g.rotateZ(-Math.cos(s) * 0.25); // 扁的尖牙，略朝外撇
    const x = (hw + rho * T) * Math.cos(s), y = (hc + rho * TV) * Math.sin(s) - L / 2 + 0.06;
    g.translate(x, y, caveBandZ(k, x) + 0.1 - R * 0.25);
    const n = g.attributes.position.count;
    g.setAttribute('aH', new THREE.Float32BufferAttribute(new Float32Array(n).fill(0.18), 1));
    g.setAttribute('aM', new THREE.Float32BufferAttribute(new Float32Array(n).fill(0.35), 1));
    drips.push(g.toNonIndexed());
  }
  for (const d of drips) { d.deleteAttribute('uv'); }
  for (const p of parts) { if (p.attributes.uv) p.deleteAttribute('uv'); }
  const g = mergeGeometries([...parts, ...drips]);
  return g;
}

// ---------- 红墙院落（龍王廟）：四面红墙、墙顶筒瓦压顶，正面开门 ----------
const RED = new THREE.Color('#bd5b45'), REDD = new THREE.Color('#a24a37'), TILE = COL.tile;
export function wallLine(k, ax, az, bx, bz, h, color = RED, gap = null) {
  const L = Math.hypot(bx - ax, bz - az), ry = -Math.atan2(bz - az, bx - ax);
  const seg = (t0, t1) => {
    const x0 = ax + (bx - ax) * t0, z0 = az + (bz - az) * t0, x1 = ax + (bx - ax) * t1, z1 = az + (bz - az) * t1, l = L * (t1 - t0);
    if (l < 0.05) return;
    k.box(l, 0.5, 0.62, (x0 + x1) / 2, -0.3, (z0 + z1) / 2, COL.stone, 0, ry);
    k.box(l, h, 0.5, (x0 + x1) / 2, 0.2, (z0 + z1) / 2, color, 0, ry);
    k.box(l + 0.2, 0.16, 0.86, (x0 + x1) / 2, h + 0.2, (z0 + z1) / 2, TILE.clone().multiplyScalar(0.9), 1, ry);
    k.box(l + 0.1, 0.18, 0.36, (x0 + x1) / 2, h + 0.36, (z0 + z1) / 2, TILE.clone().multiplyScalar(0.7), 0, ry);
  };
  if (gap) { const g0 = 0.5 - gap / L / 2, g1 = 0.5 + gap / L / 2; seg(0, g0); seg(g1, 1); } else seg(0, 1);
}
export function buildRedCompound(w, d, h = 2.4) {
  const k = new Kit();
  wallLine(k, -w / 2, d / 2, w / 2, d / 2, h, RED, 2.6);
  wallLine(k, w / 2, d / 2, w / 2, -d / 2, h, REDD);
  wallLine(k, w / 2, -d / 2, -w / 2, -d / 2, h, REDD);
  wallLine(k, -w / 2, -d / 2, -w / 2, d / 2, h, REDD);
  // 院里铺地
  k.box(w - 0.6, 0.12, d - 0.6, 0, -0.05, 0, new THREE.Color('#bcae8e'));
  return k.geometry();
}

// ---------- 石砌高台：大觀廊主殿底下的条石台，正面中间一道踏跺 ----------
export function buildTerrace(w, d, h) {
  const k = new Kit(), r = rand(1270), S = new THREE.Color('#b4a586'), S2 = new THREE.Color('#9d8f72');
  k.box(w, h, d, 0, -0.3, 0, S);
  // 条石砌缝：错缝的浅深条
  for (let row = 0; row < Math.floor(h / 0.55); row++) {
    let x = -w / 2 + (row % 2) * 0.6;
    while (x < w / 2 - 0.2) { const l = 0.9 + r() * 1.1, l2 = Math.min(l, w / 2 - x); k.box(l2 - 0.08, 0.47, 0.06, x + l2 / 2, -0.3 + row * 0.55 + 0.04, d / 2 + 0.01, r() < 0.5 ? S2 : S); x += l; }
  }
  k.box(w + 0.3, 0.14, d + 0.3, 0, h - 0.3, 0, new THREE.Color('#c8bb9c'));
  const n = Math.ceil(h / 0.28), sw = Math.min(4, w * 0.3);
  for (let i = 0; i < n; i++) k.box(sw, h - i * 0.28, 0.4, 0, -0.3, d / 2 + 0.2 + i * 0.4, S);
  for (const s of [-1, 1]) k.box(0.4, h, n * 0.4, s * (sw / 2 + 0.2), -0.3, d / 2 + n * 0.2, S2);
  return k.geometry();
}

// ---------- 半圆院墙（白墙筒瓦顶，墙上开月洞门）----------
export function buildArcWall(R, a0, a1, h = 2.6, n = 24) {
  const k = new Kit(), W = new THREE.Color('#e2d4b6');
  for (let i = 0; i < n; i++) {
    const t0 = a0 + (a1 - a0) * i / n, t1 = a0 + (a1 - a0) * (i + 1) / n;
    wallLine(k, Math.cos(t0) * R, Math.sin(t0) * R, Math.cos(t1) * R, Math.sin(t1) * R, h, W);
  }
  return k.geometry();
}

// ---------- 敞亭：四角柱、坐凳栏杆、庑殿顶（大觀廊前台上的亭子）----------
export function buildOpenPavilion(w, d, h) {
  const k = new Kit(), W = w / 2, D = d / 2;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { k.cyl(0.24, 0.22, 0.14, sx * W, 0, sz * D, COL.stone, 8); k.cyl(0.13, 0.12, h, sx * W, 0.14, sz * D, COL.zhu, 10); }
  for (const [ax, az, bx, bz] of [[-W, D, W, D], [W, D, W, -D], [W, -D, -W, -D], [-W, -D, -W, D]]) {
    const L = Math.hypot(bx - ax, bz - az), ry = -Math.atan2(bz - az, bx - ax), mx = (ax + bx) / 2, mz = (az + bz) / 2;
    k.box(L, 0.26, 0.2, mx, h - 0.2, mz, COL.zhu, 0, ry);
    k.box(L - 0.3, 0.3, 0.06, mx, h - 0.52, mz, COL.lattice, 2, ry);
    if (az !== D || bz !== D) { k.box(L, 0.08, 0.32, mx, 0.5, mz, COL.wood, 0, ry); k.box(L, 0.42, 0.06, mx, 0.08, mz, COL.lattice, 2, ry); }
  }
  hipRoof(k, W + 0.9, D + 0.8, Math.max(0.2, W - D), h + 0.1, Math.min(w, d) * 0.42 + 0.3, 0.38, COL.tile);
  { const g = k.geometry(); g.userData.lamps = [[-W * 0.55, h - 0.55, D + 0.05], [W * 0.55, h - 0.55, D + 0.05]]; return g; } // v38 夜里前檐两盏灯笼
}
// 前院石台：两层条石平台
export function buildSlab() {
  const k = new Kit(), S = new THREE.Color('#b9ab8c'), S2 = new THREE.Color('#a8997b');
  k.box(6, 0.3, 3.4, 0, 0, 0, S2); k.box(5.6, 0.06, 3.0, 0, 0.3, 0, S);
  k.box(4, 0.3, 2.2, -0.3, 0.3, -0.2, S2); k.box(3.7, 0.06, 1.9, -0.3, 0.6, -0.2, S);
  return k.geometry();
}

// ---------- 大觀廊后殿（v25）：乱石高台、台前石阶、台两侧顺坡斜下来的粉墙 ----------
const MARBLE = new THREE.Color('#e3ddcc'), MARBLE2 = new THREE.Color('#cdc6b2');
// 汉白玉栏杆：望柱（柱头一颗石珠）、寻杖、华板、地栿；y0→y1 可以是斜的（石阶垂带上）
function balustrade(k, ax, az, bx, bz, y0, y1 = y0, gap = 1.35) {
  const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / gap)), ry = -Math.atan2(bz - az, bx - ax), sl = Math.atan2(y1 - y0, L);
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t, y = y0 + (y1 - y0) * t;
    k.box(0.2, 1.05, 0.2, x, y, z, MARBLE, 0, ry); k.box(0.25, 0.12, 0.25, x, y + 1.0, z, MARBLE2, 0, ry);
    k.add(new THREE.SphereGeometry(0.12, 8, 6), MARBLE, 0, new THREE.Matrix4().setPosition(x, y + 1.24, z));
  }
  const rail = (yo, hh, th, col) => { const m = new THREE.Matrix4().makeRotationY(ry).multiply(new THREE.Matrix4().makeRotationZ(sl)); m.setPosition((ax + bx) / 2, (y0 + y1) / 2 + yo, (az + bz) / 2); k.add(new THREE.BoxGeometry(L / Math.cos(sl), hh, th), col, 0, m); };
  rail(0.84, 0.09, 0.12, MARBLE); rail(0.5, 0.46, 0.07, MARBLE2); rail(0.1, 0.14, 0.18, MARBLE);
}
// 高台：原点在台正面中线的地面，台身往 -z 伸 d，台高 h；正面乱石砌（高矮长短不一、略歪的石块），台沿压面石，栏杆当中留 sw 宽的石阶口
export function buildPalaceTerrace(w, d, h, sw) {
  const k = new Kit(), r = rand(1271), M = new THREE.Color('#857a66');
  const S = ['#b6a788', '#a4967a', '#c2b495', '#978a70', '#ad9f82'].map((c) => new THREE.Color(c));
  k.box(w, h + 0.3, d, 0, -0.3, -d / 2, M);
  for (let y = -0.3; y < h - 0.4;) {
    const ch = Math.min(0.38 + r() * 0.42, h - 0.4 - y); let x = -w / 2;
    while (x < w / 2 - 0.05) {
      const l = Math.min(0.45 + r() * 1.25, w / 2 - x), bh = ch * (0.84 + r() * 0.1);
      const m = new THREE.Matrix4().makeRotationZ((r() - 0.5) * 0.16).setPosition(x + l / 2, y + ch / 2, 0.02);
      k.add(new THREE.BoxGeometry(l - 0.08, bh, 0.1), S[Math.floor(r() * S.length)], 0, m); x += l;
    }
    y += ch;
  }
  k.box(w + 0.24, 0.22, d + 0.14, 0, h - 0.22, -d / 2 + 0.07, new THREE.Color('#cdc1a2'));
  const g = sw / 2 - 0.25;
  balustrade(k, -w / 2 + 0.2, -0.15, -g, -0.15, h); balustrade(k, g, -0.15, w / 2 - 0.2, -0.15, h);
  return k.geometry();
}
// 台前石阶：原点同上（台正面中线地面），从台沿 z=0（高 h）往 +z 下到 run 处地面。
// 两边通长踏跺，当中一道斜铺的御路石（浮雕云纹），两侧垂带上斜栏杆，阶脚一对抱鼓石
export function buildPalaceStair(sw, h, run) {
  const k = new Kit(), S = new THREE.Color("#bdaf90"), S2 = new THREE.Color("#ad9f82"), n = Math.round(h / 0.26), rs = h / n, tr = run / n, yl = Math.max(2.4, sw * 0.26);
  // 斜构件都顺着踏步棱线走：t=0 最下一级的棱（z=run, y=rs），t=1 最上一级的棱（z=tr, y=h）
  const ang = Math.atan2(rs, tr), L = Math.hypot(h - rs, run - tr), at = (t, up) => [run - t * (run - tr), rs + t * (h - rs) + up];
  for (let i = 0; i < n; i++) k.box(sw - 1, (i + 1) * rs + 0.3, tr + 0.02, 0, -0.3, run - (i + 0.5) * tr, i % 2 ? S : S2);
  const slab = (x, wd, th, top, col) => { const [z, y] = at(0.5, top - th / 2 / Math.cos(ang)); k.add(new THREE.BoxGeometry(wd, th, L), col, 0, new THREE.Matrix4().makeRotationX(ang).setPosition(x, y, z)); };
  slab(0, yl, 0.3, 0.05, MARBLE2); // 御路
  for (const s of [-1, 1]) slab(s * (yl / 2 - 0.08), 0.16, 0.3, 0.12, MARBLE); // 御路两边的边框
  for (let j = 0; j < 7; j++) { // 云纹浮雕：一左一右盘上去
    const [z, y] = at((j + 0.5) / 7, 0.05), g = new THREE.SphereGeometry(0.42, 10, 6); g.scale(1, 0.22, 1.25);
    k.add(g, MARBLE, 0, new THREE.Matrix4().makeRotationX(ang).setPosition(j % 2 ? 0.42 : -0.42, y, z));
  }
  for (const s of [-1, 1]) {
    const x = s * (sw / 2 - 0.25);
    for (let i = 0; i < n; i++) k.box(0.5, (i + 1) * rs + 0.5, tr + 0.02, x, -0.3, run - (i + 0.5) * tr, S2); // 垂带
    k.box(0.56, h + 0.62, tr + 0.4, x, -0.3, tr / 2 - 0.2, new THREE.Color("#c9bd9e"));
    slab(x, 0.56, 0.26, 0.32, new THREE.Color('#c9bd9e'));
    const [z0, y0] = at(0.04, 0.32), [z1, y1] = at(1, 0.32);
    balustrade(k, x, z0, x, z1, y0, y1, 1.3); balustrade(k, x, z1, x, -0.15, y1, y1, 1);
    // 抱鼓石
    k.box(0.36, 0.5, 0.9, x, 0, run + 0.15, MARBLE2);
    const dr = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 14); dr.rotateZ(Math.PI / 2); k.add(dr, MARBLE, 0, new THREE.Matrix4().setPosition(x, 0.9, run + 0.2));
  }
  k.box(sw + 0.8, 0.12, 1.4, 0, -0.06, run + 0.6, S2); // 阶前铺石
  return k.geometry();
}
// 一道墙（粉墙筒瓦顶），沿折线 pts=[[x,z,顶高],…]，墙底 bottom，厚 t；墙顶跟着 pts 的高度斜（顺坡的斜墙）
export function buildSlopeWall(pts, bottom, t = 0.8, col = new THREE.Color('#e6dcc3')) {
  const k = new Kit();
  const strip = (P, yb, yt, th, c) => {
    const pos = [], quad = (a, b, cc, d) => pos.push(...a, ...b, ...cc, ...a, ...cc, ...d);
    for (let i = 0; i < P.length - 1; i++) {
      const [x0, z0] = P[i], [x1, z1] = P[i + 1], l = Math.hypot(x1 - x0, z1 - z0), nx = -(z1 - z0) / l * th / 2, nz = (x1 - x0) / l * th / 2;
      const b0 = yb(i), b1 = yb(i + 1), t0 = yt(i), t1 = yt(i + 1);
      const A = [x0 + nx, b0, z0 + nz], B = [x1 + nx, b1, z1 + nz], C = [x1 + nx, t1, z1 + nz], D = [x0 + nx, t0, z0 + nz];
      const A2 = [x0 - nx, b0, z0 - nz], B2 = [x1 - nx, b1, z1 - nz], C2 = [x1 - nx, t1, z1 - nz], D2 = [x0 - nx, t0, z0 - nz];
      quad(A, B, C, D); quad(B2, A2, D2, C2); quad(D, C, C2, D2);
      if (i === 0) quad(A2, A, D, D2);
      if (i === P.length - 2) quad(B, B2, C2, C);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); k.add(g, c);
  };
  strip(pts, () => bottom, (i) => pts[i][2], t, col);
  strip(pts, (i) => pts[i][2] - 0.06, (i) => pts[i][2] + 0.2, t + 0.34, COL.tile); // 筒瓦墙帽
  strip(pts, (i) => pts[i][2] + 0.2, (i) => pts[i][2] + 0.34, 0.24, new THREE.Color('#4f4b43')); // 脊
  return k.geometry();
}

// ---------- 鶴巢：编草小棚，草顶 ----------
export function buildStrawHut(w, d, h) {
  const k = new Kit(), TH = COL.thatch, TD = COL.thatch.clone().multiplyScalar(0.8);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.1, h, 0.1, sx * w / 2, 0, sz * d / 2, COL.wood);
  k.box(w, h * 0.8, 0.06, 0, 0, -d / 2, TD, 2); for (const sx of [-1, 1]) k.box(0.06, h * 0.8, d, sx * w / 2, 0, 0, TD, 2);
  k.box(w * 0.5, h * 0.8, 0.06, -w / 4, 0, d / 2, TD, 2);
  const n0 = k.parts.length;
  hipRoof(k, w / 2 + 0.35, d / 2 + 0.3, w * 0.2, h, Math.min(w, d) * 0.45, 0.08, TH);
  k.parts.slice(n0).forEach((g) => g.attributes.aKind.array.fill(3));
  return k.geometry();
}

// ---------- 隐春巖石壁：按 massifAt 生成的一张高度网格，岩峰之外的顶点压到地下 ----------
export function buildMassif() {
  const x0 = 306, x1 = 352, z0 = -54, z1 = -2, st = 0.5;
  const nx = Math.round((x1 - x0) / st) + 1, nz = Math.round((z1 - z0) / st) + 1;
  const pos = new Float32Array(nx * nz * 3), aH = new Float32Array(nx * nz), aM = new Float32Array(nx * nz), idx = [];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = x0 + i * st, z = z0 + j * st, k = j * nx + i, g = terrainBase(x, z), M = massifAt(x, z, g);
    pos[k * 3] = x; pos[k * 3 + 2] = z;
    pos[k * 3 + 1] = M.y > g + 0.02 ? M.y : g - 1.5;
    aH[k] = Math.max(0, M.a); aM[k] = M.ph || 0;
  }
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    // 四个角都埋在地下的格子不要
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

// ---------- 隅九桥：条石砌的单孔半圆拱桥（IMG_1270 左下）----------
// 局部 x 沿桥，桥面两端 y=0；slope 让桥面顺着游线的坡度；deckY(x) 给桥面高度（行走表面用同一个式子）
export function stoneBridgeDeck(len, rise, slope) { return (x) => slope * x + rise * (1 + Math.cos(2 * Math.PI * x / len)) / 2; }
export function buildStoneBridge(len, w, rise, slope = 0, R = 1.6, yc = -1.25) {
  const k = new Kit(), r = rand(232), S = new THREE.Color('#b5a688'), S2 = new THREE.Color('#a69a7d'), S3 = new THREE.Color('#c0b394');
  const deck = stoneBridgeDeck(len, rise, slope), n = 28, foot = yc - 0.8;
  // 桥身侧面：上缘是桥面，下面掏一个半圆孔，挤出成桥宽
  const sh = new THREE.Shape();
  sh.moveTo(-len / 2 - 0.3, foot); sh.lineTo(-R, foot); sh.lineTo(-R, yc);
  sh.absarc(0, yc, R, Math.PI, 0, true);
  sh.lineTo(R, foot); sh.lineTo(len / 2 + 0.3, foot);
  for (let i = n; i >= 0; i--) { const x = -len / 2 - 0.3 + (len + 0.6) * i / n; sh.lineTo(x, deck(Math.max(-len / 2, Math.min(len / 2, x))) - 0.18); }
  const body = new THREE.ExtrudeGeometry(sh, { depth: w, bevelEnabled: false, curveSegments: 20 });
  body.translate(0, 0, -w / 2);
  k.add(body, S);
  // 拱券：一圈放射状券石，两面各一圈，深浅相间
  const nv = 15;
  for (const s of [-1, 1]) for (let i = 0; i < nv; i++) {
    const a = Math.PI * (i + 0.5) / nv, m = new THREE.Matrix4().makeRotationZ(a - Math.PI / 2).setPosition(Math.cos(a) * (R + 0.22), yc + Math.sin(a) * (R + 0.22), s * (w / 2 + 0.02));
    k.add(new THREE.BoxGeometry(0.3, 0.44, 0.06), i % 2 ? S2 : S3, 0, m);
  }
  // 桥面：一块块横铺的条石；两侧矮栏板
  for (let i = 0; i < n; i++) {
    const x0 = -len / 2 + len * i / n, x1 = -len / 2 + len * (i + 1) / n, y0 = deck(x0), y1 = deck(x1);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, ang = Math.atan2(y1 - y0, x1 - x0), L = Math.hypot(x1 - x0, y1 - y0);
    k.add(new THREE.BoxGeometry(L + 0.02, 0.18, w + 0.1), i % 3 === 1 ? S2 : S3, 0, new THREE.Matrix4().makeRotationZ(ang).setPosition(cx, cy - 0.09, 0));
    for (const s of [-1, 1]) k.add(new THREE.BoxGeometry(L + 0.02, 0.36, 0.16), r() < 0.3 ? S2 : S, 0, new THREE.Matrix4().makeRotationZ(ang).setPosition(cx, cy + 0.18, s * (w / 2 - 0.02)));
  }
  // 桥头：栏板两端各收一根方石望柱
  for (const e of [-1, 1]) for (const s of [-1, 1]) k.box(0.26, 0.62, 0.26, e * (len / 2 - 0.1), deck(e * (len / 2 - 0.1)) - 0.1, s * (w / 2 - 0.02), S2);
  return k.geometry();
}
