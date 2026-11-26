// 地形：一张连续的高度场。游线、山体、玉女潭盆地与各景点平台都写在 height() 里，
// 碰撞、种树、人物落脚都查同一个函数，所以画面与行走永远对得上。
import { bakedArray } from './bake.js';
import { PATH, PATH_V29, PATH_V33 } from './data.js';
// 临时换回 v29 的游线算一次（只给芙蓉城柱顶用）
// 撒树时整段换回 v29 的游线和地形（第一章树形按序号分配，第二章随手撒的树又都置 0，这样第一章的树一棵不变）
export const V29 = { on: false };
let savedPath = null;
export function useOldPath(on) { if (on && !savedPath) { savedPath = PATH.splice(0, PATH.length, ...PATH_V29.map((P) => P.slice())); V29.on = true; } else if (!on && savedPath) { PATH.splice(0, PATH.length, ...savedPath); savedPath = null; V29.on = false; } }
export function withPath(P, fn) { const cur = PATH.splice(0, PATH.length, ...P.map((Q) => Q.slice())); try { return fn(); } finally { PATH.splice(0, PATH.length, ...cur); } }
// v34：按 v33 的游线、石阶、地形算（琪樹峡改动之前），用来让别处的随机摆放和 v33 一模一样
export const S6 = { old: false };
let v33Saved = null;
export function enterV33() { if (v33Saved) return; v33Saved = [PATH.splice(0, PATH.length, ...PATH_V33.map((Q) => Q.slice())), STAIRS2.splice(1, 2, ...STAIRS2_V33.slice(1))]; S6.old = true; }
export function exitV33() { if (!v33Saved) return; PATH.splice(0, PATH.length, ...v33Saved[0]); STAIRS2.splice(1, 2, ...v33Saved[1]); v33Saved = null; S6.old = false; }
export function withOldPath(fn) { const cur = PATH.splice(0, PATH.length, ...PATH_V29.map((P) => P.slice())); P3.off = true; try { return fn(); } finally { PATH.splice(0, PATH.length, ...cur); P3.off = false; } }

// ---------- 噪声 ----------
function hash2(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const fade = (t) => t * t * (3 - 2 * t);
export function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  const u = fade(xf), v = fade(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, o = 4) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= 0.5; }
  return s;
}
const ridged = (x, y) => { let s = 0, a = 0.55, f = 1; for (let i = 0; i < 4; i++) { s += a * (1 - Math.abs(vnoise(x * f, y * f) * 2 - 1)); f *= 2.1; a *= 0.5; } return s; };
export const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
export function rand(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------- 游线 ----------
// PATH 按 x 递减排列；用 Catmull-Rom 插值得到任意 x 处的游线 z 与地面高。
function cr(p0, p1, p2, p3, t) { const t2 = t * t, t3 = t2 * t; return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3); }
export function pathAt(x) { return x <= -202 && x >= -290 && !V29.on && !S6.old && !P3.off ? pathOn(PATH3, x) : pathOn(PATH, x); }
// v39 第三章（龍湫·禪窩）的游线：按原画另走（x −202..−290），两头接回原游线；撒树、v33 的石阵等仍按旧游线（V29 / S6 / withOldPath 时关掉）
export const P3 = { off: false };
const PATH3 = [[-197, -12, 21], [-202, -8.13, 18.96], [-207, -3.6, 17.2], [-215, 1.6, 14.7], [-223, 1.9, 13.4], [-231, 0.6, 13.0], [-240, 0, 12.6], [-248, -2.4, 11.1],
  [-256, -5.2, 8.6], [-264, -6.4, 6.6], [-272, -3.6, 5.7], [-280, 0.4, 5.4], [-290, 0.31, 7.36], [-296, 0, 8]];
// v34：琪樹峡游线往里拐了一道，但远山、近丘仍按 v33 的游线排（不跟着拐）
export function pathV33At(x) { return x < -86 && x > -136 && !V29.on ? pathOn(PATH_V33, x) : pathAt(x); }
export function pathOn(P, x) {
  let i = 0;
  while (i < P.length - 2 && x < P[i + 1][0]) i++;
  const b = P[i], c = P[i + 1], a = (b[3] && b[3].prev) || P[Math.max(0, i - 1)], d = (c[3] && c[3].next) || P[Math.min(P.length - 1, i + 2)];
  const t = Math.min(1, Math.max(0, (b[0] - x) / (b[0] - c[0])));
  return { z: cr(a[1], b[1], c[1], d[1], t), y: cr(a[2], b[2], c[2], d[2], t) };
}

// ---------- 地貌要素 ----------
// 平台：把地面压平到 y（不给 y 时取游线高）
// 觀音岩摩崖大龛：龛口地面中心、朝向；龛底压平
export const MOYA = { x: -236, z: -46, y: 20, ry: 0.25 };
export const PADS = [
  { x: MOYA.x - 8 * Math.sin(MOYA.ry), z: MOYA.z - 8 * Math.cos(MOYA.ry), r: 9, y: MOYA.y, b: 3, old3: 1 }, // 摩崖大龛的龛底（v39 摩崖挪到游线近侧，见 MOYA3；旧的只在撒树时用）
  { x: 9, z: -9.5, r: 6.2, y: 4.7, b: 3 },        // 玉光閣
  { x: 70, z: -28, r: 4.5, y: 21.0 },       // 靈應亭
  { x: -8, z: -50, r: 7, y: 29.5 },         // 左上红楼
  { x: 299, z: -5, r: 7, y: 6.4, b: 5 },       // 金晶巖洞前
  { x: 248, z: -20, r: 14, y: 8.4 },        // 大觀廊院落
  { x: 251, z: -46, r: 9, y: 14.2, b: 4 },  // 大觀廊后殿高台
  { x: 264, z: -41, r: 4.5, y: 14.2, b: 4 }, // 大觀廊右上读书楼
  { x: 306, z: -46, r: 7.5, y: 22.6, b: 5 }, // 龍王廟
  { x: 290, z: -84, r: 4.5, y: 41 },        // 金晶巖后山顶小院
  { x: 183, z: -10, r: 4.5, y: 4.4, b: 4 }, // 梅竹隩 六角亭
  { x: 208, z: -62, r: 4.5, y: 21 },        // 梅竹隩后山上的山房
  { x: 102, z: -16, r: 6, y: 3.6 },         // 凝玉亭
  { x: -62, z: -15, r: 5, y: 14.4, old2: 1 },        // 磐玉隈
  { x: -118, z: -34, r: 4, y: 36, old2: 1 },         // 縹緲亭
  { x: -162, z: -18, r: 5, y: 30.6, old2: 1 },       // 超然亭
  { x: -218, z: -26, r: 3.5, y: 22, old3: 1 },       // 观音龛
  { x: -204, z: -11, r: 5, y: 14.6, old3: 1 },       // 禪窩
  { x: -296, z: -21, r: 4, y: 12, old4: 1 },         // 水犀洞（v46 起按原画另搭，见 CH4）
  { x: -336, z: -12, r: 6, y: 6.2, old4: 1 },        // 四陽洞前
];
// 大觀廊（v25，Yang 2026-10-28）：正八边形“八合院”，八条边各一座长屋，正面门屋靠街；院后乱石高台上一座重檐大殿，台前一道宽石阶。
// x/cz 院子中心，rIn 边屋中线到中心，y 院子地面；高台正面在 tz，宽 tw、深 td、台顶 ty；sw 石阶宽，foot 石阶脚
// v26（Yang 2026-10-29）：院子半径加大，大殿加宽到和八合院直径一样；读书楼挪到台右边的平地上（SIDE）
export const DGL = { x: 249.5, cz: -22.5, rIn: 15.5, y: 8.4, tz: -49, tw: 37, td: 14, ty: 14.5, sw: 11, foot: -41.4, side: { x: 274.8, z: -53, hw: 5, hd: 5.5 } };
// 台两侧的粉墙：台旁高出台面一米，台前顺着石阶斜下来，到阶脚和院墙一样高（原画左边那道斜下来的白墙）
export function daguanWallTop(z) { const D = DGL; return D.ty + 1 + (D.y + 1.6 - D.ty - 1) * Math.min(1, Math.max(0, (z - D.tz) / (D.foot - D.tz))); }
// 地形只在布局之后改（和 LAYOUT_V21 一个道理，不打乱各处的树）：院子压平；台前到院子挖到院子高度；台身里压到台顶以下；台外削坎（两侧有墙挡）
function daguanGround(x, z, h) {
  const D = DGL, r = Math.hypot(x - D.x, z - D.cz), K = 1.3; // K：削坎的坡度
  if (r < 22.6) h += (D.y - h) * smooth(22.6, 18.6, r);
  const fz = z - D.tz, ax = Math.abs(x - D.x) - D.tw / 2, bz = D.tz - D.td - z;
  // 台身里：正面 1.8 米以内和院子一样高（地形网格粗，不能冒到台面前），再往里升到台顶下
  if (fz < 0 && ax < 0 && bz < 0) return Math.min(h, D.y + (D.ty - 0.3 - D.y) * smooth(-1.8, -3.4, fz));
  // 台两侧、后面削坎：两侧削到墙顶以下（台前那段墙顺着石阶斜下来），再往外按 K 的坡回到山坡
  if (z < D.foot + 5 && (ax >= 0 || bz >= 0)) h = Math.min(h, (z < D.tz ? D.ty + 0.5 : daguanWallTop(z) - 0.5) + K * Math.max(ax - 0.9, bz, 0));
  // 台前到八合院：挖到院子的高度，两边到墙脚为止
  h -= Math.max(0, h - D.y) * smooth(0.9, 0.3, ax) * smooth(-2, 0, fz) * smooth(14, 10, fz);
  // 台右边读书楼的平地，和台面一样高；外面同样削坎
  const S = D.side, sd = Math.max(Math.abs(x - S.x) - S.hw, Math.abs(z - S.z) - S.hd);
  return sd < 0 ? D.ty - 0.3 : Math.min(h, D.ty - 0.3 + K * sd);
}
// 金晶巖：拱形岩洞。原点在洞口地面中心，洞口朝 +z；hw 洞口半宽，hc 洞高，dc 洞深，T/TV 岩壳水平/竖直厚度，lip 洞檐外挑
export const CAVE = { x: 298, z: -15, ry: 0.14, y: 6.4, hw: 9.5, hc: 6.4, dc: 9, T: 4.5, TV: 5.5, lip: 1.6 };
export function caveLocal(x, z) { const C = CAVE, c = Math.cos(C.ry), s = Math.sin(C.ry), dx = x - C.x, dz = z - C.z; return [dx * c - dz * s, dx * s + dz * c]; }
// 布局时用 v21 的地形（没有金晶巖岩丘和洞檐台阶）：种树、撒散树和补树丛的随机数都跟着地形走，
// 金晶巖地形一改就会连带打乱别的景点；布局阶段把开关打开，其余景点的树就和 v21 一样
export const LAYOUT_V21 = { on: false };
// 洞檐（原画 IMG_1271）：洞口一圈圈石檐，像牌坊门洞的券面一样，外圈在前、里圈一道道往洞里收，
// 每道檐的下沿挂一排乳石，垂在里面那道檐的面上。rho 是从内拱（0）到岩壳外缘（1）的径向位置，
// 第 k 道檐（0 最里）的正面立在 caveBandZ(k)，管 rho[k]..rho[k+1]
export const CAVE_BAND = { rho: [0, 0.17, 0.36, 0.56, 0.77, 1], z0: CAVE.lip + 0.2, dz: 0.55 };
export function caveBandRho(k, lx) { const R = CAVE_BAND.rho; return k <= 0 || k >= R.length - 1 ? R[k] : R[k] + 0.15 * (vnoise(lx * 0.3 + k * 5.1, k * 1.7) - 0.5); }
export function caveBandZ(k, lx) { const B = CAVE_BAND; return B.z0 - (B.rho.length - 2 - k) * B.dz + 0.22 * (vnoise(lx * 0.25 + k * 3, 4 + k) - 0.5); }
// 岩壳外表面高度（洞顶），地形与岩壳网格共用，保证贴合；前沿就是最外一道檐
export function caveShell(lx, lz) {
  const C = CAVE, front = LAYOUT_V21.on ? C.lip : caveBandZ(CAVE_BAND.rho.length - 2, lx);
  if (lz > front) return -Infinity;
  const ex = lx / (C.hw + C.T), ez = Math.min(0, lz) / (C.dc + C.T), q = 1 - ex * ex - ez * ez;
  if (q <= 0) return -Infinity;
  return C.y + (C.hc + C.TV) * Math.sqrt(q) + 0.9 * (fbm(lx * 0.25 + 3, lz * 0.25) - 0.5) * (LAYOUT_V21.on ? 1 : smooth(front, front - 2.5, lz)); // 前沿不加起伏，和檐面对齐
}
// 地面最高处：一般就是地形；金晶巖洞顶上（地形在洞里压平了）取岩壳顶，洞顶的树种在这上面
export function surfaceTop(x, z) {
  const h = terrainHeight(x, z), [lx, lz] = caveLocal(x, z);
  if (!inCave(lx, lz)) return h;
  const r = caveRoof(lx, lz, terrainBase(x, z)); return r > -1e8 ? r - 0.3 : h;
}
// 金晶巖岩丘：洞开在一座山包里。洞后山包抬过洞顶，洞口两侧各一个坡包把檐脚埋住（原画洞左一丘长杂树，洞右一堆石青石）
export function caveHill(x, z) {
  const [lx, lz] = caveLocal(x, z);
  if (Math.abs(lx) > 36 || lz > 14 || lz < -36) return 0;
  const g = (dx, dz, rx, rz) => Math.exp(-((dx / rx) ** 2 + (dz / rz) ** 2) * 2.2);
  const H = 9 * g(lx, lz + 14, 26, 11) + 5.5 * g(lx + 15.5, lz - 1, 7, 7) + 4.5 * g(lx + 20, lz - 4, 7, 6) + 7 * g(lx - 15.5, lz - 1, 6.5, 7) + 3.5 * g(lx - 19.5, lz - 5, 6, 5);
  return H * (0.85 + 0.3 * fbm(x * 0.08, z * 0.08 + 5));
}
// 洞前一片赭黄平地，一条土路往前偏右下到游线（原画洞口前的土坪和土路）。0..1
export function caveApron(x, z) {
  const [lx, lz] = caveLocal(x, z);
  if (lz < CAVE.lip - 1 || lz > 25 || Math.abs(lx) > 16) return 0;
  const n = (fbm(x * 0.2, z * 0.2 + 7) - 0.5) * 0.5;
  const pad = 1 - Math.hypot(lx / 10.5, (lz - CAVE.lip - 2.5) / 5.5) + n;
  const cx = 1.5 + (lz - 8) * 0.25 + Math.sin(lz * 0.35) * 0.8;
  const lane = smooth(5, 7, lz) * (1 - Math.abs(lx - cx) / (1.4 + 0.07 * lz)) + n * 0.6;
  return smooth(0, 0.25, Math.max(pad, lane));
}
// 洞内：地面压平到洞底（比洞壁略大一圈，地形的陡坡藏在洞壁后面）
export function inCave(lx, lz, pad = 0.9) { const C = CAVE; if (lz > C.lip + 0.3 || lz < -C.dc - pad) return false; const ex = lx / (C.hw + pad), ez = Math.min(0, lz) / (C.dc + pad); return ex * ex + ez * ez < 1; }
// 隐春巖（IMG_1271 右半）：一整座层叠的石壁。几座多棱的岩峰取高者连成一片：峰身是削出来的几个斜平面，
// 一层层向里收的石坎（坎上长苔），峰顶尖；主峰在青牛峡右手，顶面向洞那边斜着抬起，后面一簇尖峰之间留一道石阶走的谷。
// H 是峰顶高出峰脚中心地面多少；n 是峰身棱面数；tilt 让峰顶朝 [x,z] 方向抬高
export const MASSIF = [
  { x: 323, z: -18, rx: 7.5, rz: 7, H: 20, k: 1, n: 5, tilt: [-0.35, 0.1] },  // 隐春巖主峰
  { x: 318, z: -10.5, rx: 3.6, rz: 3.2, H: 8, k: 2, n: 5 },                     // 主峰前肩
  { x: 327, z: -27, rx: 5, rz: 5.5, H: 24, k: 3, n: 6 },                          // 主峰后背
  { x: 333, z: -34, rx: 4.6, rz: 4.2, H: 26, k: 4, n: 5, tip: 1 },
  { x: 340, z: -25, rx: 4, rz: 4.2, H: 17, k: 5, n: 4, tip: 1 },
  { x: 329, z: -44, rx: 6, rz: 5, H: 30, k: 6, n: 6, tip: 1 },
  { x: 340, z: -42, rx: 5.5, rz: 5, H: 25, k: 7, n: 5, tip: 1 },
  { x: 343, z: -13, rx: 4, rz: 4, H: 12, k: 8, n: 4, tip: 1 },
  { x: 317, z: -31, rx: 4, rz: 4, H: 15, k: 9, n: 5 },                           // 青牛峡里侧的石壁
  { x: 336, z: -19, rx: 3, rz: 3, H: 13, k: 10, n: 4, tip: 1 },
  { x: 322, z: -39, rx: 3.5, rz: 3.2, H: 19, k: 11, n: 5, tip: 1 },
  { x: 347, z: -33, rx: 4, rz: 4, H: 21, k: 12, n: 5, tip: 1 },
];
// 石壁的底座：一整片平顶陡壁把各峰连起来，青牛峡石阶那道谷不填
export const MASSIF_BODY = { x: 331, z: -30, rx: 16, rz: 14.5, ry: -0.35, H: 12, n: 7 };
export const QN_STAIRS = [[332, -3], [331, -9], [333.5, -15], [331.5, -21], [334.5, -27], [336, -31]]; // 隐春巖与后面尖峰之间折上去的石阶（IMG_1271）
export function distToLine(x, z, L) {
  let best = 1e9;
  for (let i = 0; i < L.length - 1; i++) {
    const [ax, az] = L[i], [bx, bz] = L[i + 1], vx = bx - ax, vz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
    best = Math.min(best, Math.hypot(x - ax - vx * t, z - az - vz * t));
  }
  return best;
}
let massifG = null;
// 多棱岩峰：到多边形边的距离（边上为 1），和圆各取一点，棱线不至于太死；lean 让一侧坡缓一侧壁陡
function polyDist(dx, dz, n, rot, lean, phi, x, z, k) {
  const d0 = Math.hypot(dx, dz), th = Math.atan2(dz, dx), sec = (2 * Math.PI) / n;
  const psi = (((th - rot) % sec) + sec) % sec - sec / 2, poly = d0 * Math.cos(psi) / Math.cos(Math.PI / n);
  return (0.15 * d0 + 0.85 * poly) / (1 + lean * Math.cos(th - phi)) * (1 + 0.06 * Math.sin(th * 9 + k * 1.7 + 2.5 * vnoise(x * 0.12, z * 0.12)) + 0.08 * (vnoise(x * 0.2 + k, z * 0.2) - 0.5));
}
// 石坎：每层先平后陡；返回 [高, 层内相位]
function ledges(h, L) { const yy = h / L, f = yy - Math.floor(yy); return [(Math.floor(yy) + Math.pow(f, 2.4)) * L, f]; }
// 返回 { y: 石面高, a: 主导岩峰的相对高 0..1, ph: 石坎相位的 cos（坎沿处为 1） }；不在石壁上返回 y=-Infinity
// g 是该点原地形高（调用方已算好就传进来）
export function massifAt(x, z, g = null) {
  if (x < 306 || z > -2 || z < -54) return { y: -Infinity, a: 0, ph: 0 };
  if (!massifG) massifG = MASSIF.map((P) => terrainBase(P.x, P.z));
  if (g === null) g = terrainBase(x, z);
  const cut = smooth(1.2, 4.5, distToLine(x, z, QN_STAIRS)); // 青牛峡石阶走的那道谷
  let best = -Infinity, a = 0, ph = 0;
  MASSIF.forEach((P, i) => {
    const dx = (x - P.x) / (P.rx * 1.2), dz = (z - P.z) / (P.rz * 1.2);
    if (dx * dx + dz * dz > 2.6) return;
    const d = polyDist(dx, dz, P.n, P.k * 0.9, 0.3, P.k * 2.3, x, z, P.k);
    if (d >= 1) return;
    let prof = P.tip ? Math.pow(1 - Math.pow(d, 1.15), 0.85) : Math.pow(1 - Math.pow(d, 1.5), 0.6);
    if (P.tilt) prof *= 1 + 0.5 * (P.tilt[0] * dx + P.tilt[1] * dz) * (1 - d);
    const [st, f] = ledges(P.H * prof, P.H / (P.tip ? 4.5 : 3.5));
    // 峰脚贴着当地地面，往里才落到峰心地面上（坡上的峰不会在下坡一侧悬出一道直壁）
    const base = g + (massifG[i] - g) * smooth(0, 0.3, prof);
    const y = base + (P.H * prof * 0.3 + st * 0.7 + 0.5 * (vnoise(x * 0.5, z * 0.5) - 0.5) * prof) * cut;
    if (y > best) { best = y; a = prof; ph = Math.cos(f * 2 * Math.PI); }
  });
  { // 底座
    const B = MASSIF_BODY, c = Math.cos(B.ry), sn = Math.sin(B.ry), dx = ((x - B.x) * c - (z - B.z) * sn) / B.rx, dz = ((x - B.x) * sn + (z - B.z) * c) / B.rz;
    const d = polyDist(dx, dz, B.n, 0.4, 0.15, 1.2, x, z, 21);
    if (d < 1) {
      const H = B.H * cut, prof = Math.pow(1 - Math.pow(d, 5), 0.4) * (0.85 + 0.3 * vnoise(x * 0.08 + 3, z * 0.08));
      const [st, f] = ledges(H * prof, 3.2), y = g + H * prof * 0.3 + st * 0.7;
      if (H * prof > 0.3 && y > best) { best = y; a = 0.45 * prof; ph = Math.cos(f * 2 * Math.PI); }
    }
  }
  return { y: best, a, ph };
}
// 水面：潭与池
export const POND = { x: 34, z: -14, rx: 13.5, rz: 10, wl: 3.7 };
export const POOL = { x: -256, z: -14, rx: 10, rz: 8, wl: 2.2 };
// 曲溪：凝玉亭 → 流觴嶼 → 沸玉橋下穿过游线
export const STREAM = [[100, -8], [110, -6], [122, -12], [136, -14], [150, -10], [162, -16], [176, -8], [190, 0], [195, 6], [200, 14], [210, 26], [222, 40]];
// 隅九桥下的小溪（IMG_1270 左下）：从后山脚流出，正交穿过石拱桥，从两个坡包之间流到前面汇入曲溪。第三个数是该点水面高
export const STREAM2 = [[218, -19, 6.3], [220, -16, 5.9], [224, -10, 5.62], [228, -5.5, 5.5], [231.2, -2, 5.45], [232, 1.4, 5.4], [232.8, 5, 5.35], [233, 9, 5.3], [232, 14, 5.15], [230, 20, 5.0], [227, 27, 4.8], [223.5, 32, 4.6], [220.5, 36.5, 4.45]];
// 山石主峰（单独建模的石青巨岩，这里只给地面加底座）
// ---------- 第二章·云山仙境（IMG_1265–1263，v27）----------
// 三张照片能直接拼起来，照片宽约 78 米：原画上横向位置 u（0 左 1 右）落在 x = 景点中心 + (u - 0.5) * 78。
// 縹緲亭在 1265 左上、也在 1264 右上，所以它在磐玉隈与琪樹峡之间的山顶上。
// 这些地形只在布局之后生效（LAYOUT_V21.on 为 false），第一章的树和石按原地形布局，一棵不动。
export const CH2 = (x) => x > -202 && x < -36;
export const PIAO = { x: -85, z: -38.5, y: 41.5 };       // 縹緲亭
export const PANYU = { x: -65.5, z: -14.5, y: 15.6 };    // 磐玉隈凹岩里对弈的那片地
export const CHAORAN = { x: -160.5, z: -19.5, y: 31.2 , ry: -0.6 }; // 超然亭
// 三处石阶：磐玉隈凹岩左沿上縹緲亭；琪樹峡上縹緲亭；琪樹峡里折上去、绕到超然亭前的之字石阶
export const STAIRS2 = [
  [[-68.6, -15.6], [-70.6, -20.5], [-71.6, -25.5], [-75, -30.5], [-80, -34.5], [-84.2, -35.7]],
  // v34 按原画反投影：右边一道从峡口石阶分出来，贴着大方石右沿折上去，过琪樹再上縹緲亭
  [[-94.2, -6.9], [-96.4, -11], [-97.6, -15.4], [-96, -19.8], [-93.7, -22.4], [-95.2, -24.2], [-94.6, -27.6], [-91.5, -32.4], [-88.5, -34.2], [-85.8, -35.7]],
  // v34 左边一道：白衣人前面分出来，往里折，绕过大方石左沿，上左山，再落到超然亭右边的小路（末三点同 v30）
  [[-118.4, -12], [-120, -16.5], [-118.9, -21], [-115.4, -26.9], [-114.8, -30.3], [-115.6, -32.8], [-120.9, -32.6], [-125.6, -30.4], [-129.5, -28.6], [-133, -27], [-138.5, -22], [-140.5, -15.5]],
];
// v33 的石阶（琪樹峡石阵沿用 v33 的随机序列）
export const STAIRS2_V33 = [STAIRS2[0],
  [[-99, -7], [-101, -12.5], [-99.5, -18.5], [-95.5, -24.5], [-91.5, -30], [-88.5, -34], [-85.8, -35.7]],
  [[-112, -8], [-117, -12.5], [-110.5, -17], [-117.5, -21.5], [-125, -25.5], [-133, -27], [-138.5, -22], [-140.5, -15.5]]];
// ===== v39 第三章 龍湫·禪窩（IMG_1262 觀音岩·禪窩、IMG_1261 龍湫）=====
// 两张照片互相重叠三分之一（SIFT 拼接：1262 的中心在 1261 的 u=1.13），1262 右边和 1263 之间是云。按水犀洞（S02，x −296）不动，
// 每幅约 52 米宽：S04 中心 x −229，S03 中心 x −262。各景点位置用画境镜头（data.js S04/S03 的 view）把原画反投影回地面定的。
export const CH3 = (x) => x <= -202 && x > -290;
export const ZEN3 = { x: -232.6, z: -3.4, y: 13 };              // 禪窩前屋（敞口矮瓦屋，两僧对坐；台基前沿 z −1.45，紧挨游线）
export const ZEN3B = { x: -232.4, z: -7.5, y: 13.2 };           // 禪窩后屋（原画就在前屋正后方，屋脊略高）
export const GY3 = { x: -238.6, z: -17.4, y: 15, ry: 0.1 };      // 觀音龛（红柱尖顶龛罩着白衣观音）
export const POLE3 = { x: -235.1, z: -14.2, y: 13.6 };          // 幡杆
export const MOYA3 = { x: -224, z: 41, y: 15.5, ry: Math.PI - 0.1 }; // 摩崖大像挪到游线近侧（画面下缘以外），龛口朝游线；画境镜头里看不见，转身才见
export const POOL3 = { x: -269.4, z: -22.4, rx: 4.3, rz: 6.6, wl: 5.0 }; // 龍湫：岩洞里一潭水，伸出洞口
export const GROTTO3 = { x: -268.6, z: -25.4, hw: 4.4, top: 13.0, floor: 5.0, front: -20, back: -31.5 }; // 洞口宽 8.8 米、高 8 米
export const LONGQIU3 = { x: -263.6, z: -12.6, y: 6.0 };
// v40（Yang：原来的瀑布、深潭、撑船是自己加的一景，挪到龍湫对面路另一侧的空地）：一道石壁朝着游线，瀑布贴崖落进深潭，潭上一只小船来回
export const POOLW = { x: -264, z: 27.5, rx: 7.5, rz: 6, wl: 7.6 };
const HILLW = [{ x: -264, z: 49, r: 13, h: 13, n: 6, lobes: [[0, 0, 0.8, 1.0], [-8, 2, 0.55, 0.75], [8, 3, 0.55, 0.7]] }]; // 石壁后面靠着的山        // 题“龍湫”的大石
export const PADS3 = [
  { x: -231.5, z: -3.2, r: 7.2, y: 13, b: 4 },                   // 禪窩前的院子
  { x: ZEN3B.x, z: ZEN3B.z, r: 2.6, y: ZEN3B.y, b: 1.5 },
  { x: GY3.x, z: GY3.z, r: 2.6, y: GY3.y, b: 3 },
  { x: MOYA3.x - 8 * Math.sin(MOYA3.ry), z: MOYA3.z - 8 * Math.cos(MOYA3.ry), r: 9, y: MOYA3.y, b: 3 },
];
// 山：lobes [dx, dz, 半径倍数, 高度倍数]（加在缓缓抬起的底坡上）
export const LOBED3 = [
  { x: -238.5, z: -49, r: 10, h: 13, n: 6, lobes: [[0, 0, 0.8, 1.0], [5, 4, 0.55, 0.6], [-5, 3, 0.5, 0.55]] },              // 觀音岩：龛后一座圆浑的青绿山头
  { x: -224, z: -73, r: 17, h: 26, n: 9, lobes: [[0, 0, 0.62, 1.0], [-7, 8, 0.5, 0.6], [8, 7, 0.5, 0.62], [2, -10, 0.6, 0.9]] }, // 正中的大山，山脊一道道往下
  { x: -246, z: -46, r: 10, h: 14, n: 6, lobes: [[0, 0, 0.8, 1.0], [4, 5, 0.5, 0.6], [-4, 6, 0.55, 0.7]] },                // 觀音岩左边的青山（1261 右上的高峰，杉林长在它脚下）
  { x: -259, z: -69, r: 15, h: 22, n: 8, lobes: [[0, 0, 0.7, 1.0], [8, 6, 0.5, 0.6], [-8, 4, 0.55, 0.7]] },                 // 左边层层叠起的高山（1262 左、1261 右上）
  { x: -276, z: -74, r: 14, h: 20, n: 8, lobes: [[0, 0, 0.7, 1.0], [6, 7, 0.55, 0.6]] },
  { x: -208, z: -47, r: 12, h: 9, n: 6, lobes: [[0, 0, 0.8, 1.0], [-6, 6, 0.5, 0.5], [5, -5, 0.6, 0.8]] },                   // 右边长满杉树的坡
  { x: -215, z: -31, r: 6, h: 4, n: 5, lobes: [[0, 0, 0.8, 1.0]] },                                                         // 云里露出的石青石包
  { x: -256, z: -31, r: 9, h: 10, n: 6, lobes: [[0, 0, 0.8, 1.0], [-5, 3, 0.55, 0.7]] },                                    // 龍湫岩体底下垫起的山
  { x: -282, z: -30, r: 8, h: 5, n: 5, lobes: [[0, 0, 0.8, 1.0], [5, 4, 0.5, 0.6]] },                                       // 龍湫左边的山肩（老松长在上面）
];
// 游线后方近处的坡（离路 2.6 米外就抬起）
export const NEAR3 = [
  { x: -246, z: -10.5, r: 7, h: 7, n: 6, lobes: [[0, 0, 0.8, 1.0], [-3, -3, 0.6, 0.95], [3.5, -5, 0.55, 0.75]] },          // 禪窩左边的大绿坡包（原画 1262 左下，顶上站一排杉）
  { x: -252.5, z: -14, r: 6.5, h: 7.5, n: 6, lobes: [[0, 0, 0.8, 1.0], [-3, 3, 0.55, 0.8]] },                               // 往左连成一片（1261 右边杉林脚下）
  { x: -241.5, z: -13, r: 4.5, h: 3.2, n: 5, lobes: [[0, 0, 0.8, 1.0], [2, -3, 0.6, 0.8]] },                                // 往右低下去，接到觀音龛的台
];
// 游线前方的坡包（画面下缘）
export const FORE3 = [m(-271, 4.5, 9, 8.5, 301), m(-262.5, 5.5, 7.5, 5.5, 302), m(-255, 5, 7.5, 4.8, 303), m(-248, 6, 6.5, 4.2, 304), m(-214, 9, 6, 3, 305), m(-242, 7, 6, 2.2, 306), m(-279, 4.5, 6, 4.2, 307)];
export function ch3Ground(x, z, h0) {
  const p = pathAt(x), dz = z - p.z, ad = Math.abs(dz);
  let g = p.y + 1.1 * (fbm(x * 0.08, z * 0.08 + 3) - 0.5) * smooth(2.5, 7, ad);
  g += 0.12 * Math.max(0, -dz - 4) + 0.08 * Math.max(0, dz - 6);   // 路后缓缓抬起，路前也略起
  g += lobedHeight(x, z, LOBED3) * smooth(4, 12, -dz);
  g += lobedHeight(x, z, NEAR3) * smooth(2.6, 5, ad);
  g += lobedHeight(x, z, FORE3) * smooth(3.5, 8, ad);
  // 禪窩右边：原画右下一大片云，地面落成一道云谷（游线贴着前沿走）
  g -= 6 * smooth(-204, -209, x) * smooth(-227, -219, x) * smooth(-6.5, -12, z) * smooth(-36, -27, z);
  // v40 对岸：瀑布石壁后面的山、潭四周一圈平台（潭另由 POOLW 挖）
  g += lobedHeight(x, z, HILLW) * smooth(30, 38, z);
  { const r = pondShape(x, z, POOLW); if (r < 2.4) g += (POOLW.wl + 1.0 - g) * smooth(2.4, 1.3, r); }
  // 远处照旧（原来的远山）
  g += (Math.max(g, h0) - g) * smooth(-62, -95, z);
  // 龍湫岩洞里：洞底就是潭底（潭另由 POOL3 挖）
  const G = GROTTO3, gx = Math.abs(x - G.x) / G.hw;
  if (z < G.front + 1 && z > G.back - 1 && gx < 1.15) g = Math.min(g, G.floor + 0.6 + 3 * smooth(0.85, 1.15, gx) + 4 * smooth(G.back + 1, G.back - 1, z));
  return g;
}
export const ch3Blend = (x) => smooth(-202, -209, x) * smooth(-290, -283, x);

// ---------- v46 第四章 卷尾·洞壑（S02 水犀洞 IMG_1260、S01 四陽洞 IMG_1258）----------
// 照原画在画境镜头里反投影定位（data.js S02、S01 的 view）。1260 右边三分之一和 1261 左边重叠（龍湫左边那片杂树、老松已在第三章），
// 这里只搭 x < −289。1258 和 1260 不重叠，接缝在 x ≈ −323。
// 卷尾峡谷（v43 作者题刻、题名壁、画师，见 credit.js）位置一点不动：峡底 z 1.5–6.5 仍是游线高；北壁做成原画左下那面大绿坡，南壁在镜头脚下。
export const CH4 = (x) => x <= -289;
export const ch4Blend = (x) => smooth(-289, -296, x);
export const XI4 = { x: -299.9, z: -22.2, y: 11.8 };            // 水犀洞：尖峰半腰龛里的石台（两人对坐）；v47 龛在一整座双头峰正面（main.js 距离场）
export const PEAK4 = { x: -300.3, z: -24.8 };                    // 水犀洞尖峰的中心
export const SIYANG4 = { x: -381.4, z: -11.4, y: 7.0, hw: 3.6 }; // 四陽洞：洞口中心、洞口地面、半宽
export const QD4 = { x: -376.2, z: -8.4, y: 6.9 };              // 青島磯：洞右溪边一块平坡
// 四陽洞流出的溪：[x, z, 水面高]（出洞几级跌水，绕过北坡东头，在 x −371 横过游线往南去）
export const STREAM4 = [[-381.6, -12.4, 7.0], [-380.9, -10.2, 6.55], [-379.6, -8.0, 6.1], [-377.8, -5.6, 5.85], [-375.6, -3.2, 5.7], [-373.4, -0.6, 5.6], [-371.6, 2.4, 5.5], [-370.6, 5.6, 5.35], [-369.8, 9.5, 5.0], [-369.2, 14, 4.4], [-368.6, 20, 3.6], [-368.2, 24, 1.9], [-367.8, 28, -0.55], [-367.4, 32, -2.4], [-367, 36, -3.1]]; // v49 南坡落进云谷，溪顺坡跌下去，没进云里
export function distToStream4(x, z) {
  let best = 1e9, wl = 0; const S = STREAM4;
  for (let i = 0; i < S.length - 1; i++) {
    const [ax, az, aw] = S[i], [bx, bz, bw] = S[i + 1], vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz;
    const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / l2)), d = Math.hypot(x - ax - vx * t, z - az - vz * t);
    if (d < best) { best = d; wl = aw + (bw - aw) * t; }
  }
  return { d: best, wl };
}
// 圆浑的山头：[x, z, 半径, 高]，几个山头软最大接成一座山（同 v44 的 range8）
const HILLS4 = [
  // 水犀洞（1260）：左边一道青绿山梁从左上斜下来接到尖峰脚；尖峰右后一片赭坡（大杂树长在上面）
  // v47 左边那座尖顶青山另算（见 cone4），这里只留尖峰右后的赭坡（大杂树长在上面）
  { lobes: [[-292, -28.5, 7, 5], [-289, -22, 6, 3.5]] },
  // 水犀洞下缘：游线前一道圆浑的绿坡（原画下缘一层层坡包），坡沿在画境镜头里正好挡住游线（v47 加高到游线上 4 米多）
  { lobes: [[-303, 9.4, 6, 3.1], [-298, 9.4, 5.6, 3.0], [-293.6, 9.6, 5, 2.6], [-308.6, 9.2, 5.2, 2.8], [-313.5, 9, 5, 2.4]] },
  // v47 水犀洞和四陽洞之间（新加的 45 米）：北边一道起伏的青山，山后赭坡；南边几个低包
  { lobes: [[-338, -24, 8, 5.5], [-345.5, -27, 9, 7.5], [-353, -24, 8, 6.5], [-359, -27, 7, 6], [-348, -16, 5.5, 2.6], [-341, -15, 4.5, 2]] },
  { lobes: [[-336, 11, 7, 3.4], [-344, 12, 7, 4], [-352, 11, 6.5, 3.2]] },
  // 四陽洞（1258）：洞后一座圆浑的淡石绿大山，洞开在它的山脚；左边一座更高的山，再左是画外的高山
  // v47：洞顶那一大块淡石绿的石台改用距离场雕（main.js），这里只垫个底；洞后再一座圆山（原画 1258 洞顶石台后面露出的山头）
  { lobes: [[-382.5, -23, 10, 4.6], [-376.5, -21, 7, 3], [-388.5, -21, 7, 3.8]] },
  { lobes: [[-387, -35, 9, 6], [-380, -37.5, 8, 5], [-393, -37, 8, 5.5]] },
  // 洞左：一座青山（原画左半，坡上虬松、老树），再往左后一座大山（原画左上角那面大坡）
  { lobes: [[-398, -27, 9, 6], [-403, -18, 8, 6.5], [-406, -8, 7, 5.5]] },
  { lobes: [[-414, -40, 16, 12], [-404, -49, 14, 10], [-420, -26, 12, 10], [-410, -30, 9, 7]] },
  // 洞右上：一片缓缓升起的赭坡（大杂树后面，坡上几株高树）
  { lobes: [[-371, -30, 9, 1.5], [-366, -36, 9, 2]] },
];
// v50 南边合拢的一圈山：[x, z, 半径（东西向）, 比谷底高]，南北向扁 1.25 倍；水犀洞画境镜头（z 22）、四陽洞画境镜头（z 12.5）都在山前
const SOUTH4 = [
  [-307, 34, 8, 6], [-337, 33, 7, 4.5], [-367, 35, 8, 6], [-393, 35, 7, 4],                                          // 近处矮坡包
  [-307, 50, 11, 14], [-320, 56, 17, 26], [-334, 50, 10, 13], [-350, 51, 12, 11], [-363, 61, 16, 24], [-386, 56, 14, 19], [-399, 50, 8, 9], // 中间一道：水犀洞对面最高，两景之间低成鞍，四陽洞对面再起
  [-312, 80, 18, 30], [-342, 82, 20, 33], [-374, 82, 18, 29], [-402, 70, 12, 22]];                                     // 后面高的一道
// v56 超然亭对面（Yang：亭和雙仙石对面是一道比两旁都低的沟，一直通到画外，没有山石挡着，漏仙气）。
// 原因：v30 亭前陡坡往下压的那段没有南界，从崖脚一路压到地图边，x −196..−140 成了一条 10 米高的长沟，两边各剩一道又薄又高的老山脊。
// 原画亭前是一层层往下的绿坡，坡间是云，下缘有坡包和松收住（雙仙石那边）。改成：崖脚到 z 13 一点不动（画境镜头里的部分、亭前碎石、灌丛都按这里的地形撒），云谷一直留到 z 25 前后，
// 云谷南边起一圈圆浑的矮山合抱，山后一道、地图边上一道更高的，山头之间软连成鞍（同 SOUTH4），两头接上第三章和琪樹峡的坡，不起直墙。
// [x, z, 半径（东西向）, 比谷底高, 南北向扁几倍]：三道错开排，山头有大有小、有圆有扁，免得排成一溜一样的包
const SOUTH5 = [
  [-200, 15, 6, 10, 1.0], [-203, 22, 7, 10, 1.0], [-136, 15, 7, 13, 1.0],                                                                                     // 云谷两边那两道薄山脊收成圆山头（z 13 以北不动：亭前碎石、灌丛按地形撒，随机序列不能变）
  [-203, 31, 11, 10, 1.1], [-189, 36, 14, 13, 1.4], [-171, 34, 11, 16, 1.0], [-156, 40, 15, 11, 1.5], [-142, 31, 11, 14, 1.1], [-129, 27, 8, 9, 1.0], // 近处一圈矮山，围住云谷
  [-210, 57, 12, 11, 1.2], [-195, 64, 15, 20, 1.2], [-178, 57, 12, 15, 1.0], [-162, 67, 18, 25, 1.3], [-144, 58, 13, 17, 1.0], [-129, 62, 12, 20, 1.1], // 中间一道
  [-206, 84, 15, 15, 1.2], [-186, 86, 18, 27, 1.2], [-163, 90, 20, 31, 1.3], [-141, 84, 15, 26, 1.1], [-121, 83, 14, 26, 1.1]];                       // 地图边上更高的一道
export const S56 = { off: false }; // 撒草时暂时关掉（草按原来的地形撒，随机序列不变，撒完再落到新地形上）
export const south5Mask = (x, z) => smooth(28, 40, z) * smooth(-218, -208, x) * smooth(-120, -130, x); // 山体上色（不铺草坡色）的范围
function south5(x, z, h) {
  const k = smooth(-218, -208, x) * smooth(-120, -130, x) * smooth(13, 18, z);
  if (k <= 0) return h;
  let acc = 0, n = 0;
  for (const [cx, cz, R, Hh, sq] of SOUTH5) {
    const dx = x - cx, dz = (z - cz) * sq, th = Math.atan2(dz, dx);
    const d = Math.hypot(dx, dz) / R * (1 + 0.2 * (fbm(x * 0.05 + cz, z * 0.05 + cx * 0.01) - 0.5) + 0.1 * Math.sin(3 * th + cx));
    if (d >= 1) continue;
    // 顺坡几道脊（同 lobedHeight），山腰上才有
    const rib = Math.pow(1 - Math.abs(Math.sin(th * 6 + fbm(x * 0.05, z * 0.05) * 3)), 3) * Hh * 0.07 * smooth(0.25, 0.5, d) * smooth(1, 0.7, d);
    acc += Math.exp(0.3 * (Hh * dome4(d) + rib)); n++;
  }
  let T = 10.6 + 11 * smooth(26, 84, z) + 0.8 * (fbm(x * 0.09 + 5, z * 0.09) - 0.5);
  if (n) { const u = Math.log(acc - n + 1) / 0.3; T += u * (1 + 0.14 * (fbm(x * 0.11 + z * 0.04, z * 0.11) - 0.5)); }
  // 只在原来那两道薄山脊（x ≈ −200、−135）和沟里往下削；两头接第三章、琪樹峡的地方只往上垫，不把人家的坡削低
  return h + (T - h) * (T < h ? k * smooth(-211, -205, x) * smooth(-121, -127, x) : k);
}
// v57 第三章龍湫·禪窩南边（Yang：同超然亭对面一样，平地一直平到地图边）：瀑布潭、摩崖大像背后起三道圆山合抱，近低远高，
// 西头接 v50 水犀洞南山，东头接 v56 超然亭对面的山。只往上垫：瀑布潭和后面那座石壁山、摩崖大像龛前一点不动。
// [x, z, 半径（东西向）, 比原地面高, 南北向扁几倍]
const SOUTH3 = [
  [-290, 45, 8, 7, 1.1], [-283, 57, 10, 10, 1.2], [-245, 59, 10, 9, 1.2], [-229, 58, 11, 13, 1.1], [-213, 49, 7, 6, 1.0],      // 近处几座矮山：潭后石壁山两旁、摩崖大像背后
  [-293, 71, 13, 17, 1.2], [-272, 71, 15, 21, 1.3], [-251, 73, 14, 16, 1.2], [-232, 72, 13, 19, 1.2], [-214, 68, 10, 12, 1.1],  // 中间一道
  [-299, 88, 16, 28, 1.2], [-278, 90, 20, 32, 1.3], [-255, 88, 17, 26, 1.2], [-234, 90, 18, 30, 1.2], [-214, 86, 14, 22, 1.1]]; // 地图边上更高的一道
export const south3Mask = (x, z) => smooth(50, 62, z) * smooth(-300, -292, x) * smooth(-204, -212, x); // 山体上色（不铺草坡色）的范围
function south3(x, z, h) {
  const k = smooth(-302, -294, x) * smooth(-202, -210, x) * smooth(34, 42, z)
    * Math.max(smooth(13, 19, Math.hypot(x + 264, (z - 42) * 1.15)), smooth(56, 62, z))                 // 瀑布潭、石壁山不动
    * Math.max(smooth(-238, -242, x) + smooth(-210, -206, x), smooth(46, 52, z));                       // 摩崖大像龛前不动
  if (k <= 0) return h;
  let acc = 0, n = 0;
  for (const [cx, cz, R, Hh, sq] of SOUTH3) {
    const dx = x - cx, dz = (z - cz) * sq, th = Math.atan2(dz, dx);
    const d = Math.hypot(dx, dz) / R * (1 + 0.2 * (fbm(x * 0.05 + cz, z * 0.05 + cx * 0.01) - 0.5) + 0.1 * Math.sin(3 * th + cx));
    if (d >= 1) continue;
    const rib = Math.pow(1 - Math.abs(Math.sin(th * 6 + fbm(x * 0.05, z * 0.05) * 3)), 3) * Hh * 0.07 * smooth(0.25, 0.5, d) * smooth(1, 0.7, d);
    acc += Math.exp(0.3 * (Hh * dome4(d) + rib)); n++;
  }
  if (!n) return h;
  const u = Math.log(acc - n + 1) / 0.3;
  return h + u * (1 + 0.14 * (fbm(x * 0.11 + z * 0.04, z * 0.11) - 0.5)) * k;
}
// v47 水犀洞左边那座尖顶青山（原画 1260 左半，山尖在 u .2、v .25）和它右后一座矮些的石青色小山
function cone4(x, z) {
  let s = 0;
  for (const [cx, cz, R, H, k, sz] of [[-320.8, -36, 15, 9.4, 1.05, 0.7], [-310.5, -31, 7.5, 5.6, 1.2, 1], [-327, -31, 8, 3.5, 1.3, 1]]) {
    const d = Math.hypot(x - cx, (z - cz) * sz) / R * (1 + 0.12 * (vnoise(x * 0.25 + cz, z * 0.25) - 0.5));
    if (d < 1) s = Math.max(s, H * Math.pow(1 - d, k));
  }
  return s;
}
const dome4 = (d) => (d >= 1 ? 0 : Math.pow(1 - d * d, 1.4));
function hills4(x, z) {
  let s = 0;
  for (const L of HILLS4) {
    let acc = 0, n = 0;
    for (const [lx, lz, R, H] of L.lobes) { const d = Math.hypot(x - lx, z - lz) / R; if (d < 1) { acc += Math.exp(0.35 * H * dome4(d)); n++; } }
    if (n) s += Math.log(acc - n + 1) / 0.35;
  }
  return s;
}
export function ch4Ground(x, z, h0) {
  const p = pathAt(x), dz = z - p.z, ad = Math.abs(dz);
  let g = p.y + 0.9 * (fbm(x * 0.08 + 11, z * 0.08 + 5) - 0.5) * smooth(2.5, 7, ad);
  // 画面上半：一层层往后升高的赭坡（原画上缘都是淡赭的远坡，坡上松林、杂树）
  // v47 水犀洞一侧（x > −345）：坡脚压低到游线高（尖峰从谷底拔起），z −32 往后才一层层升成赭坡，画面左上角满是坡，不露天
  { const kA = smooth(-362, -342, x), b46 = 11 * smooth(-16, -46, z) + 24 * smooth(-42, -85, z), b47 = 2.5 * smooth(-14, -30, z) + 12 * smooth(-34, -52, z) + 24 * smooth(-46, -80, z) + 10 * smooth(-75, -110, z);
    g += b46 + (b47 - b46) * kA + 3 * (fbm(x * 0.04, z * 0.05 + 2) - 0.5) * smooth(-20, -40, z); }
  g += 0.05 * Math.max(0, dz - 6);
  g += hills4(x, z) * smooth(2.6, 6, ad);
  // 水犀洞尖峰脚下垫起一圈（石峰立在上面）
  g += cone4(x, z) * smooth(2.6, 6, ad);
  // 四陽洞前：洞口一片平地，青島磯一块平坡
  { const r = Math.hypot((x - SIYANG4.x) / 6, (z - SIYANG4.z - 1.6) / 3.6); if (r < 1.6) g += (SIYANG4.y - g) * smooth(1.6, 0.9, r); }
  { const r = Math.hypot(x - QD4.x, z - QD4.z); if (r < 5.5) g += (QD4.y - g) * smooth(5.5, 3, r); }
  // v49 卷尾不再是死胡同窄峡（Yang：卷尾拥挤、没有意境）：北边原画左下那面大绿坡收成一座圆包，东头在溪口落下去，
  // 从石桥上顺着溪望得见洞；南边只剩低低的坡沿，再往南缓缓落进云谷；游线尽头一片平台（望云台），台外一落千丈，云海、远山、留白收卷
  if (x < -364) {
    const fl = p.y, k = smooth(-364, -372, x);
    // 北：大绿坡圆包（顶在 z −4.5，离游线 8–9 米，坡脚缓，走得上去；x −388 最高，游线上 8 米）
    const Hm = 1 + 7 * Math.exp(-(((x + 388) / (x < -388 ? 8 : 4.8)) ** 2));
    const dm = Math.abs(z + 4.5) / 8, mound = fl + Hm * dome4(dm) * (1 + 0.08 * (fbm(x * 0.15, z * 0.3) - 0.5));
    if (dm < 1) g = Math.max(g, g + (mound - g) * k * smooth(2.4, 4.2, p.z - z));
    // 南：游线外一道低坡沿（游线上 1–2 米），过了坡沿往南缓缓落进云谷
    if (z > p.z) { const lip = fl + (1.2 + 0.8 * fbm(x * 0.1 + 7, 2.2)) * smooth(2.6, 6, dz) * smooth(16, 9, dz);
      g += (lip - g) * k * smooth(2.6, 4, dz); }
  }
  // 从两景之间那段路起，游线南边往南缓缓落进云谷（云在脚下，不压游线）
  if (x < -326 && z > p.z) g -= 11 * smooth(9, 34, dz) * smooth(-326, -340, x);
  // v50 南边一圈圆浑的山（Yang：水犀洞前那片平地一直通到画外，别处都有山阻隔，这里像是可以随便闯进来）：
  // 游线和山之间是云谷，山后再抬一道，地图边不露底
  if (z > 22) {
    // 三层：近处几个矮坡包，中间一道山，后面一道更高的；山头之间软连成鞍（同 hills4），山面顺坡几道褶
    let acc = 0, n = 0;
    for (const [cx, cz, R, Hh] of SOUTH4) {
      const d = Math.hypot(x - cx, (z - cz) * 1.25) / R * (1 + 0.18 * (fbm(x * 0.05 + cz, z * 0.05 + cx * 0.01) - 0.5));
      if (d < 1) { acc += Math.exp(0.3 * Hh * dome4(d)); n++; }
    }
    if (n) { const u = Math.log(acc - n + 1) / 0.3; g += u * (1 + 0.14 * (fbm(x * 0.11 + z * 0.04, z * 0.11) - 0.5)) - 0.9 * u / 20 * Math.abs(Math.sin(x * 0.21 + 2.2 * fbm(x * 0.05, z * 0.08))) ; }
    g += 22 * smooth(64, 86, z) * smooth(-292, -312, x); // 东头（第三章那边）缓缓落下，不起一道直墙
  }
  // v57 卷尾恢复峡谷（Yang：v49 望云台敞开了，还是峡谷更有意境——通向画境的入口只有这一条小路，外面的人顺路进来，山穷水尽疑无路）。
  // 四陽洞前照旧敞亮（北边圆包、溪口、石桥不动），过了峡口（x −396）两壁一下子夹拢，路在窄峡里左一拐右一拐通到画外；两壁犬牙交错，从峡口望不到头。
  // 峡口留一小片平地：北壁迎着来路刻作者题记，南边画师铺纸写生。峡壁的嶙峋石面另用距离场雕（main.js gorgeSdf4），这里只起地形的大样
  let slot = 1;
  if (x < -394) {
    const G = gorge4(x, z), fl = G.fl;
    slot = G.slot;
    { const r = Math.hypot((x + 399.5) / 5.5, (z - 5.2) / 5); if (r < 1.3) g += (fl + 0.2 * (fbm(x * 0.2, z * 0.2) - 0.5) - g) * smooth(1.3, 0.9, r); } // 峡口一小片平地
    g = g + (fl - g) * (1 - G.slot) * smooth(-394, -398, x); // 峡底就是路
    g = Math.max(g, G.wall);
  }
  g += (14 + 30 * fbm(z * 0.04 + 3, x * 0.03 + 7)) * smooth(-412, -428, x) * slot; // 地图尽头的山（峡里让开）
  // 溪：出洞往南，河床比水面低半米，两岸缓坡
  { const s = distToStream4(x, z); if (s.d < 3.2) { const bed = s.wl - 0.45; g = Math.min(g, bed + (g - bed) * smooth(0.7, 3.2, s.d)); } }
  // 远处照旧（地图尽头的高山）
  g += (Math.max(g, h0) - g) * smooth(-64, -100, z);
  return g;
}
// v57 卷尾峡谷的中线（峡底）：[x, z, 峡底高]。出了峡口往西，左右一摆；第一道拐弯往北（人走到这里为止），再往西拐出画外。
// 两壁照中线量真距离（不是按 x 一列列量），拐弯处壁也是一样厚；从峡口、拐弯处都望不到出口。
const GL4 = [[-394, 4.1, 5.95], [-404, 4.0, 6.0], [-408, 4.3, 6.05], [-411.5, 5.3, 6.3], [-415, 4.6, 6.6], [-418, 3.0, 6.9], [-420.2, 0.4, 7.2],
  [-421.2, -3.5, 7.6], [-421.4, -7.5, 8.0], [-422.4, -11, 8.4], [-425, -13.2, 8.8], [-429, -14.2, 9.2], [-436, -14.6, 9.8]];
const GS4 = (() => { // 中线每 0.25 米一个点：x, z, 峡底高, 弧长, 切向
  const P = []; let s = 0;
  for (let i = 0; i < GL4.length - 1; i++) {
    const A = GL4[Math.max(0, i - 1)], B = GL4[i], C = GL4[i + 1], D = GL4[Math.min(GL4.length - 1, i + 2)], L = Math.hypot(C[0] - B[0], C[1] - B[1]), n = Math.ceil(L / 0.25);
    for (let k = 0; k < n; k++) { const t = k / n, q = [0, 1, 2].map((m) => cr(A[m], B[m], C[m], D[m], t)); if (P.length) s += Math.hypot(q[0] - P[P.length - 1][0], q[1] - P[P.length - 1][1]); P.push([q[0], q[1], q[2], s]); }
  }
  for (let i = 0; i < P.length; i++) { const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; P[i].push((b[0] - a[0]) / l, (b[1] - a[1]) / l); }
  return P;
})();
// 离中线多远（a）、在哪一边（side：+1 右手，即峡口进去的北壁、拐弯后的东壁；−1 左手）、峡底高（fl）、走了多远（s）、两壁的壁脚宽和壁高
export function gorgeAt4(x, z) {
  let best = 1e18, bi = 0;
  for (let i = 0; i < GS4.length; i += 4) { const q = GS4[i], d = (x - q[0]) ** 2 + (z - q[1]) ** 2; if (d < best) { best = d; bi = i; } }
  for (let i = Math.max(0, bi - 4); i < Math.min(GS4.length, bi + 5); i++) { const q = GS4[i], d = (x - q[0]) ** 2 + (z - q[1]) ** 2; if (d < best) { best = d; bi = i; } }
  const q = GS4[bi], ox = x - q[0], oz = z - q[1], side = q[4] * oz - q[5] * ox >= 0 ? 1 : -1, sArc = q[3];
  // 壁脚离中线：峡口一段喇叭口，往里两边错开起伏（犬牙交错）
  const k = smooth(2, 11, sArc), ph = sArc * 0.55;
  const wR = 2.4 + 0.55 * Math.sin(ph) + 0.25 * Math.sin(ph * 2.3 + 1), wLf = 2.5 - 0.5 * Math.sin(ph + 0.5) + 0.25 * Math.sin(ph * 1.7 + 2);
  const w = side > 0 ? wR + (7.5 - wR) * (1 - k) : wLf + (8.5 - wLf) * (1 - k);
  const H = (13 * smooth(1, 12, sArc) + 4 * smooth(12, 24, sArc) + 4 * smooth(22, 36, sArc)) * (1 + 0.14 * (fbm(sArc * 0.13 + (side > 0 ? 3 : 9), 1.7) - 0.5)) * (side > 0 ? 1.08 : 0.94);
  return { a: Math.sqrt(best), side, fl: q[2], s: sArc, w, H, end: x < q[0] - 0.3 && bi === GS4.length - 1 };
}
// 峡谷的地形大样：slot（峡里 0、壁上 1）和 wall（壁的地形高度：壁顶往外缓缓圆下去，南边一道厚山梁再落进云谷）
export function gorge4(x, z) {
  const G = gorgeAt4(x, z), { a, w, H } = G;
  const rise = smooth(w + 2.0, w + 4.6, a), slot = smooth(w + 2.2, w + 6, a); // 地形壁藏在石面后面（石面在 w 到 w+1.4，皴的凹处也不露出地形；1.5 米网格从峡底到壁上要留一格平的，不然三角面从壁脚戳出来）
  let wall = G.fl + H * rise * (1 - 0.45 * smooth(w + 7, w + 20, a)) + H * 0.3 * (fbm(x * 0.09 + 21, z * 0.09) - 0.5) * smooth(w + 2, w + 7, a); // 壁顶起伏几个山头（不是一块平顶台）
  if (G.side < 0 && G.s < 22) wall -= (H + 9) * smooth(w + 10, w + 26, a) * smooth(2, 8, G.s); // 南边：山梁厚十来米，往外落进云谷
  wall -= 60 * smooth(w + 18, w + 32, a); // 离峡三十米外不管（北边、后山照旧）
  return { slot, fl: G.fl, wall: H > 0.05 ? wall : -1e9, G };
}
// v46 第四章的地面上色：近处石绿坡，往后渐成淡赭远坡
export function lawn4(x, z) {
  if (x > -289) return 0;
  const L = smooth(-289, -296, x) * Math.max(smooth(-40, -26, z), smooth(0.8, 3, cone4(x, z)) * smooth(-345, -335, x)) * (1 - 0.8 * smooth(28, 40, z)); // v47 左边尖顶青山整座是绿的，衬在山后的赭坡上；v50 南山不铺草坡色，按山体上色（同玉女潭后山）
  // v47 赭土（负值，同金晶巖洞前土坪的上色）：四陽洞流出的溪两岸、洞右上那面赭坡（原画 1258）
  let o = smooth(-23, -28, z) * smooth(-378, -373, x) * smooth(-350, -356, x);
  if (x < -364 && x > -390 && z < 2) {
    o = Math.max(o, smooth(5.5, 2.2, distToStream4(x, z).d) * smooth(2, -1, z));
    o = Math.max(o, smooth(1.5, 0.8, Math.hypot((x - SIYANG4.x) / 6, (z - SIYANG4.z - 1.6) / 3.6))); // 洞前的土坪
  }
  return L * (1 - o) - o;
}
export const PADS_NOW = PADS.filter((P) => !P.old2 && !P.old3 && !P.old4).concat(PADS3, [
  { x: PIAO.x, z: PIAO.z, r: 4.2, y: PIAO.y, b: 5 },
  { x: PANYU.x, z: PANYU.z, r: 4.2, y: PANYU.y, b: 3.5 },
  { x: CHAORAN.x, z: CHAORAN.z, r: 5.5, y: CHAORAN.y, b: 5 },
]);
// 山：lobes [dx, dz, 半径倍数, 高度倍数]
export const LOBED2 = [
  // 縹緲亭圆山（1265 左半）：圆浑的大山头，前坡一直伸到凹岩口，左肩落到琪樹峡
  { x: -84, z: -37, r: 19, h: 20, n: 7, lobes: [[0, 0, 0.8, 1.0], [8, 13, 0.55, 0.6], [-11, 9, 0.5, 0.5], [4, -10, 0.6, 0.85]] },
  // 磐玉隈右边的松林坡（1265 右缘）
  { x: -36, z: -36, r: 16, h: 11, n: 6, lobes: [[0, 0, 0.8, 1.0], [-6, 9, 0.55, 0.55], [8, -6, 0.6, 0.8]] },
  // 琪樹峡后面三座带脊的山（1264 上半）
  { x: -136, z: -55, r: 17, h: 20, n: 8, lobes: [[0, 0, 0.7, 1.0], [8, 8, 0.5, 0.55], [-8, 7, 0.5, 0.5]] },
  { x: -112, z: -57, r: 19, h: 25, n: 9, lobes: [[0, 0, 0.62, 1.0], [-9, 10, 0.5, 0.5], [9, 9, 0.5, 0.55]] },
  { x: -98, z: -50, r: 12, h: 13, n: 7, lobes: [[0, 0, 0.75, 1.0], [5, 7, 0.5, 0.6]] },
  // 琪樹峡左边、之字石阶绕过去的山肩
  { x: -144, z: -30, r: 12, h: 7, n: 6, lobes: [[0, 0, 0.8, 1.0], [6, -5, 0.6, 0.7]] },
  // 超然亭坐的山包，后面再起一层（1263 中间）
  { x: -160, z: -27, r: 13, h: 5, n: 6, lobes: [[0, 0, 0.8, 1.0], [-7, 4, 0.6, 0.7]] },
  // v29（Yang：超然亭要被高低不一的青山环抱）：亭后一座圆山从云谷里起来，右边一道高坡，左边峡谷外一座小山
  { x: -158, z: -40, r: 12, h: 15, n: 7, lobes: [[0, 0, 0.75, 1.0], [-8, 3, 0.55, 0.7], [8, 4, 0.5, 0.6]] },
  { x: -136, z: -24, r: 13, h: 13, n: 8, lobes: [[0, 0, 0.75, 1.0], [-5, 8, 0.5, 0.55], [4, -8, 0.6, 0.9]] },
  { x: -179, z: -31, r: 9, h: 9, n: 6, lobes: [[0, 0, 0.8, 1.0], [5, 5, 0.5, 0.6]] },
];
// 前景坡包（每幅下缘），离游线 4 米外才抬起
export const FORE2 = [
  m(-93, 10, 8, 4, 41), m(-80, 13, 7, 3, 42), m(-66, 9, 7, 3.5, 43), m(-50, 10, 8, 4, 44), m(-40, 14, 7, 3, 45),
  m(-118, 12, 8, 3, 46), m(-104, 15, 8, 4, 47), m(-132, 11, 7, 2.5, 48),
];
// v30 超然亭前陡坡的剖面：离崖线 t 米处的地面高（亭台 31.2，一层石坎、一道肩、再落进云谷）
const CLIFF = [[0, 31], [1.2, 29.6], [2.6, 25.5], [3.6, 23.6], [5.2, 22.6], [6.6, 19.5], [8.4, 16.8], [10.5, 14.8], [14, 12], [20, 10.5]];
function cliffProfile(t) { if (t <= 0) return CLIFF[0][1]; for (let i = 1; i < CLIFF.length; i++) if (t < CLIFF[i][0]) { const [a, ya] = CLIFF[i - 1], [b, yb] = CLIFF[i], k = (t - a) / (b - a); return ya + (yb - ya) * k * k * (3 - 2 * k); } return CLIFF[CLIFF.length - 1][1]; }
// v32 地面细部（Yang：地面太光滑，没有风化、错落和层次）。原画的坡是一片片圆浑的坡包一层压一层：
// ① 坡包——一百多个大小不一的扁圆台地撒在坡上，台面平、边沿陡，取最高的那个（层层叠压，边沿就是一道道坎）；
// ② 顺坡的冲沟（风化剥蚀，亭前的坡朝 +z，沟顺 z 走）；③ 碎小的起伏
export const R5 = { last: 0 }; // 最近一次算到的坡包边沿权重（细网格着色用：坎下露赭土、坎沿点苔）
const LOBES5 = (() => {
  const r = rand(5155), L = [], bins = new Map(), B = 8;
  for (let i = 0; i < 170; i++) {
    const o = { x: -201 + r() * 70, z: -46 + r() * 60, rx: 2.5 + r() * 4.5, a: 0.7 + r() * 1.6, ry: (r() - 0.5) * 0.8, w: r() * 6.28 };
    o.rz = o.rx * (0.45 + r() * 0.35); L.push(o);
    const R = o.rx * 1.2;
    for (let bx = Math.floor((o.x - R) / B); bx <= Math.floor((o.x + R) / B); bx++) for (let bz = Math.floor((o.z - R) / B); bz <= Math.floor((o.z + R) / B); bz++) { const k = bx + ',' + bz; if (!bins.has(k)) bins.set(k, []); bins.get(k).push(o); }
  }
  return { bins, B };
})();
function relief5(x, z) {
  let m = 0, rs = 0;
  for (const o of LOBES5.bins.get(Math.floor(x / LOBES5.B) + ',' + Math.floor(z / LOBES5.B)) || []) {
    const c = Math.cos(o.ry), sn = Math.sin(o.ry), u = (x - o.x) * c - (z - o.z) * sn, v = (x - o.x) * sn + (z - o.z) * c;
    const d = Math.hypot(u / o.rx, v / o.rz) * (1 + 0.14 * Math.sin(3 * Math.atan2(v, u) + o.w));
    if (d >= 1) continue;
    const sm = smooth(1, 0.55, d), val = o.a * sm;
    if (val > m) { m = val; rs = Math.sin(Math.PI * sm); }
  }
  const g = 1 - Math.abs(2 * vnoise(x * 0.55, z * 0.13 + 4) - 1), groove = -0.4 * g * g * g;
  R5.last = Math.max(rs, smooth(0.45, 0.8, g * g * g) * 0.4);
  return m + groove + 0.45 * (fbm(x * 0.32, z * 0.32 + 6, 3) - 0.5);
}
// 亭前陡坡上立石头的小平台 [x, z, 半径]（和 main.js 超然亭石簇一一对应）
export const ROCKPADS5 = [[-157.9, -11, 2.6], [-151.1, -9.8, 2], [-155.2, -12.6, 1.4], [-167.1, -10.5, 1.8], [-173.8, -14.6, 1.9], [-182.3, -13.8, 1.9], [-180.5, -14.5, 3.3], [-184.5, -14, 2.8], [-177, -13.6, 2.2], [-181.6, -16.9, 2.8], [-185, -17.2, 2.4], [-182.8, -19.3, 2]];
// 陡坡上凸起的石台：左下雙仙石站的小台、左前一道石坎、亭下偏左一块石台
export const LEDGE5 = [
  { x: -183.5, z: -5, r: 5, h: 6, n: 5, lobes: [[0, 0, 0.8, 1.0], [3, 2, 0.5, 0.6]] },
  { x: -176, z: -12.5, r: 5, h: 3, n: 5, lobes: [[0, 0, 0.8, 1.0]] },
  { x: -167.5, z: -10, r: 4, h: 4, n: 5, lobes: [[0, 0, 0.8, 1.0]] },
];
// v29 超然亭前：游线外地面落成云谷后，再起三道低一些的绿坡（原画亭前一层层往下的山坡，坡间是云）
export const FRONT5 = [
  { x: -185, z: 20, r: 10, h: 15, n: 6, lobes: [[0, 0, 0.8, 1.0], [6, -5, 0.55, 0.75]] },
  { x: -143, z: 19, r: 11, h: 15, n: 7, lobes: [[0, 0, 0.8, 1.0], [-6, -4, 0.55, 0.8], [5, 7, 0.5, 0.5]] },
  { x: -166, z: 34, r: 9, h: 11, n: 6, lobes: [[0, 0, 0.8, 1.0], [-5, -3, 0.5, 0.6]] },
];
export function ch2Hills(x, z, h0 = 0) {
  const pz = pathV33At(x).z; // 琪樹峡一段的山丘仍按 v33 游线定（v34 游线另拐，见末尾）
  // 超然亭后面：原画亭后是云海和芙蓉城，不是一整面山坡；亭后到芙蓉城脚下这一段的远山压低六成（芙蓉城柱脚不动）
  // v28（Yang：先精修超然亭）：亭后整片压成一道云谷，芙蓉城的石柱从谷底云海里拔起（柱子另行加长到谷底，柱顶不动）；
  // 谷再往后（z < -120）远山回升，做背景
  const sq = 0.82 * smooth(-24, -36, z) * smooth(-138, -116, z) * smooth(-200, -188, x) * smooth(-128, -140, x);
  const py = pathAt(x).y, low = -sq * Math.max(0, h0 - py - 1);
  const h = (z < 0 ? lobedHeight(x, z, LOBED2) : 0) * smooth(4, 12, pz - z) + lobedHeight(x, z, FORE2) * smooth(3.5, 8, Math.abs(z - pz));
  if (V29.on) { const fd = smooth(5, 22, z - pz) * smooth(-200, -192, x) * smooth(-130, -140, x); return h + low + (fd > 0 ? -0.9 * fd * Math.max(0, h0 - (py - 18)) + lobedHeight(x, z, FRONT5) * smooth(4, 9, z - pz) : 0); }
  // v30（Yang：尽量 1:1 复刻原画）：按画境镜头把原画反投影回地面。亭坐在崖头，亭前一道层层跌落的陡坡（原画亭下那片石坡），
  // 坡脚落进云谷；崖线和亭的正面平行（亭朝左前方斜着），游线在亭后，不受影响
  const fm = smooth(-202, -194, x) * smooth(-133, -141, x) * smooth(2.5, 6, z - pz);
  let front = 0;
  if (fm > 0) {
    const zc = Math.max(-19, Math.min(-12, -13.6 + (x + 158.3) * 0.686)) + 0.7 * Math.sin(x * 0.53);
    const t = z - zc;
    if (t > -0.5) {
      let yT = cliffProfile(t) + 1.2 * (fbm(x * 0.15, z * 0.15 + 5) - 0.5) + lobedHeight(x, z, LEDGE5);
      // 石头脚下各留一小块平台（原画的石头都立在坡上的小台上，坡一层层跌下去）
      for (const [px, pz2, pr] of ROCKPADS5) { const d = Math.hypot(x - px, z - pz2); if (d < pr + 2) { const zc2 = Math.max(-19, Math.min(-12, -13.6 + (px + 158.3) * 0.686)) + 0.7 * Math.sin(px * 0.53); const yc = cliffProfile(pz2 - zc2) + 1.2 * (fbm(px * 0.15, pz2 * 0.15 + 5) - 0.5) + lobedHeight(px, pz2, LEDGE5); yT += (yc - yT) * smooth(pr + 2, pr, d); } }
      front = fm * smooth(-0.5, 0.6, t) * Math.min(0, yT - (h0 + h + low));
    }
  }
  // v30 游线改到亭后，从小山包和芙蓉城山脚下穿过：游线两侧照样压平（只在超然亭一段）
  let tot = h0 + h + low + front;
  if (x < -138) tot = py + (tot - py) * (1 - smooth(-140, -146, x) * (1 - smooth(2.2, 6.5, Math.abs(z - pz))));
  // v32（Yang：地面太光滑，要有风化、错落和层次）：超然亭一带加细部（见 relief5），游线两旁和石头脚下的小台不加
  const rm = smooth(-202, -196, x) * smooth(-131, -137, x) * smooth(-47, -41, z) * smooth(15, 9, z) * smooth(2.5, 5.5, Math.abs(z - pz));
  R5.last = 0;
  if (rm > 0) { let pad = 0; for (const [px, pz2, pr] of ROCKPADS5) pad = Math.max(pad, smooth(pr + 1.5, pr, Math.hypot(x - px, z - pz2))); tot += rm * (1 - pad) * relief5(x, z); R5.last *= rm * (1 - pad); }
  // v34 琪樹峡（Yang：照着原画 1:1 雕琢下一个经典）
  if (x > -133.5 && x < -89 && !S6.old) tot = qishu6(x, z, tot);
  if (!S6.old && !V29.on && !D7.off) { if (x > -96 && x < -69) tot = dome7(x, z, tot); }
  else if (x > -92 && x < -72.5 && !S6.old) tot = bench7(x, z, tot);
  return tot - h0;
}
// v34 琪樹峡：按画境镜头（data.js S06）把 IMG_1264 反投影回地面。
// 游线就是原画峡底那道石阶；石阶以下峡底继续往镜头这边落，左下落成云谷（原画左下一大片云），右下是峡口乱石
export function qishu6(x, z, h0) {
  const p = pathAt(x), dz = z - p.z, mA = smooth(-133, -126, x) * smooth(-89, -95, x), mD = smooth(-133.5, -130, x) * smooth(-89, -96, x);
  let h = h0;
  // 游线前：一道陡坎直落下去（原画石阶下面左边是一大片云，中间是峡底乱石和大松）
  const fd = smooth(2.6, 11, dz), deep = 6 + 6.5 * smooth(-104, -114, x);
  h -= mD * fd * deep * (0.85 + 0.3 * fbm(x * 0.09 + 3, z * 0.09));
  // 游线两旁压平
  h = p.y + (h - p.y) * (1 - mA * (1 - smooth(2.0, 5.5, Math.abs(dz))));
  // 峡顶正中一座青山（原画峡后最高的那座，山尖在 (650, 95)），两旁和身后压成云谷，山的轮廓才立得出来
  const mB = smooth(-132, -124, x) * smooth(-92, -100, x) * smooth(-37, -46, z) * smooth(-98, -84, z);
  if (mB > 0) {
    const vy = 25 + 5 * fbm(x * 0.04 + 9, z * 0.04) + 0.25 * Math.max(0, -60 - z);
    h += mB * Math.min(0, vy - h);
  }
  const pdx = x - PEAK6.x, pdz = (z - PEAK6.z) / 0.85, pd = Math.hypot(pdx, pdz);
  if (pd < 22) {
    const a = Math.atan2(pdz, pdx), rib = 0.55 + 0.45 * Math.abs(Math.sin(a * 2.5 + 0.6)); // 几道山脊顺坡下来
    const py = PEAK6.y - pd * (0.75 + 0.25 * rib) - 0.018 * pd * pd + 1.2 * (fbm(x * 0.12, z * 0.12 + 4) - 0.5) * smooth(2, 8, pd);
    h = Math.max(h, py);
  }
  return h;
}
export const PEAK6 = { x: -116.5, z: -47, y: 40.5 };
// v36 磐玉隈右边（原画 IMG_1265 右半）：大石板后面一片往右后方升起的松坡，红衣人走在坡上的小路
function grove7(x, z, h) {
  const m = smooth(-46, -38, x) * smooth(2, -8, x) * smooth(-20, -26, z) * smooth(-64, -54, z); if (m <= 0) return h;
  const t = 13 + 20 * smooth(-23, -38, z) + 0.2 * (x + 40) + 3 * (fbm(x * 0.07 + 6, z * 0.07) - 0.5);
  return t > h ? h + (t - h) * m : h;
}
// v35 圆山前脚的土崖（原画 1264 右下、1265 左边）：崖下垫一道绿坡，崖只露出上面三米多，坡脚收在游线后面
const TOP7 = [[-90, 21.5], [-87, 23.1], [-84, 22.9], [-81, 24.6], [-78, 24.6], [-75, 26], [-72, 24]];
function bench7(x, z, h) {
  const m = smooth(-90.5, -86.5, x) * smooth(-73.5, -77.5, x);
  const pz = pathAt(x).z, e = 0.6 * (fbm(x * 0.15 + 2, z * 0.15) - 0.5);
  if (m > 0) h += m * 3.2 * smooth(pz - 2.9, pz - 7.6 + e, z) * smooth(-13.4, -12.6, z) * (0.9 + 0.2 * fbm(x * 0.2, z * 0.2 + 5));
  // 崖顶往后直接接上圆山的坡，不留一道洼（原画崖上就是满坡的绿）
  const mf = smooth(-91.5, -88, x) * smooth(-73, -76, x) * smooth(-16.6, -18.2, z) * smooth(-30, -26, z);
  if (mf > 0) {
    let i = 0; while (i < TOP7.length - 2 && x > TOP7[i + 1][0]) i++;
    const [x0, y0] = TOP7[i], [x1, y1] = TOP7[i + 1], t = Math.max(0, Math.min(1, (x - x0) / (x1 - x0)));
    const tgt = y0 + (y1 - y0) * t - 0.3 + 0.35 * Math.max(0, -17 - z) + 0.8 * (fbm(x * 0.12, z * 0.12 + 8) - 0.5);
    if (tgt > h) h += (tgt - h) * mf;
  }
  return h;
}
// v36 磐玉隈（IMG_1265 左半）：圆山前脸是一整个大绿圆包，包脚一道两三米的矮土崖，包顶在凹岩左上方，
// 往后落一道浅鞍再接縹緲亭的山；石阶贴着包的右沿从凹岩口上去（石阶两侧 1–3 米不抬）。
// 包顶高度按画境镜头反投影（c5/z7.mjs：原画包顶 v≈270、包脚土崖顶 v≈500）。取代 v35 的 bench7（旧布局里仍用 bench7）
const DOME7 = [[-95, 20], [-92, 22], [-90, 24.3], [-88.5, 27.2], [-86.5, 30.2], [-83, 31.9], [-80, 32.3], [-76.5, 31.9], [-73.5, 30.3], [-72, 28.6], [-70.5, 24.5]];
export const D7 = { off: false }; // rocks2G（石坎底座高度缓存）按没有圆包的地形算
function dome7At(x, z) {
  const pz = pathAt(x).z;
  let i = 0; while (i < DOME7.length - 2 && x > DOME7[i + 1][0]) i++;
  const [x0, c0] = DOME7[i], [x1, c1] = DOME7[i + 1], t = Math.max(0, Math.min(1, (x - x0) / (x1 - x0)));
  const crest = c0 + (c1 - c0) * t + 0.7 * (fbm(x * 0.1 + 3, z * 0.1) - 0.5);
  const zc = -21.5 + 0.8 * Math.sin(x * 0.21);
  const zT = pz - 6.6 + 0.7 * (fbm(x * 0.2, 7) - 0.5), zF = zT + 2.2;
  const yC = 20.2 - 0.12 * (x + 80) + 0.4 * (fbm(x * 0.3, 2) - 0.5);
  const m = smooth(-95.5, -91.5, x) * smooth(-69.3, -71.6, x) * smooth(0.9, 2.1, distToLine(x, z, STAIRS2[0]));
  return { crest, zc, zT, zF, yC, m };
}
function dome7(x, z, h) {
  if (x < -96 || x > -69 || z < -31) return h;
  const D = dome7At(x, z); if (D.m <= 0 || z > D.zF) return h;
  let y;
  if (z > D.zT) y = h + (D.yC - h) * smooth(D.zF, D.zT, z);
  else if (z > D.zc) { const s = (D.zT - z) / (D.zT - D.zc); y = D.yC + (D.crest - D.yC) * Math.pow(Math.sin(s * Math.PI / 2), 0.8); }
  else { const sb = (D.zc - z) / 7; y = D.crest - 3.2 * sb * sb; }
  const m = D.m * smooth(-31, -27.5, z);
  return y > h ? h + (y - h) * m : h;
}
// 圆包脚的土崖露赭土、包的右沿（贴着石阶）露土；包顶上半一片深绿的草（原画用细密的草笔）：地形着色用 aGorge（正：赭土，负：深草）
export function dome7Tint(x, z, y) {
  if (S6.old || V29.on || LAYOUT_V21.on || x < -96 || x > -58 || z < -32 || z > -6) return 0;
  const cave = smooth(6.5, 3.5, Math.hypot(x - PANYU.x, (z - PANYU.z - 1) * 1.3)) * smooth(-10.5, -12, z); // 凹岩里对弈的那片地是赭土
  if (x > -67) return cave;
  const D = dome7At(x, z), e = 0.6 * (fbm(x * 0.4, z * 0.4 + 3) - 0.5);
  const lat = smooth(-91, -87.5, x) * smooth(-69, -71, x);
  let earth = lat * smooth(D.zF + 1.0, D.zF - 0.1, z + e) * smooth(D.yC + 1.8, D.yC + 0.6, y + 2 * e) * smooth(-27, -20, z);
  earth = Math.max(earth, smooth(-73.5, -71.2, x + e) * smooth(-68.8, -70, x) * smooth(-10.5, -12, z) * smooth(-23, -20, z) * smooth(2.2, 0.6, distToLine(x, z, STAIRS2[0]) - 1));
  earth = Math.max(earth, cave);
  if (earth > 0.02) return earth;
  const grass = smooth(-90, -86, x) * smooth(-71.5, -74.5, x) * smooth(D.crest - 7.5, D.crest - 4, y + 2 * (fbm(x * 0.15, z * 0.15 + 9) - 0.5)) * smooth(-29, -26, z);
  const body = D.m * smooth(D.zT + 0.6, D.zT - 0.8, z) * smooth(-31, -27.5, z); // 圆包身子：石绿（-0.3），包顶深草（-1）
  return -Math.max(0.3 * body, 0.3 + 0.7 * grass) * (body > 0.02 || grass > 0.02 ? 1 : 0);
}
// 磐玉隈两块巨岩、凹岩后壁、圆山前脚的大石：和隐春巖同一种多棱石坎（见 massifAt），只是另一组
export const MASSIF2 = [
  { x: -53, z: -19, rx: 7, rz: 6, H: 17, k: 31, n: 5, tilt: [-0.3, 0.1], s7: 1 }, // 右巨岩前身：靠凹岩一侧是陡壁
  { x: -46, z: -27, rx: 7.5, rz: 6, H: 21, k: 32, n: 6, s7: 1 },
  { x: -56.5, z: -29, rx: 5, rz: 5, H: 25, k: 33, n: 5, tip: 1, s7: 1 },                // 右巨岩顶，原画上一株大杂树长在这里
  { x: -41.5, z: -15.5, rx: 4.5, rz: 4, H: 8, k: 34, n: 5, s7: 1 },
  { x: -65, z: -23, rx: 5, rz: 3.5, H: 16, k: 35, n: 6, s7: 1 },                      // 凹岩后壁：紧贴在对弈的人身后往上收
  { x: -60.5, z: -19.5, rx: 2.6, rz: 2.6, H: 9, k: 39, n: 5, s7: 1 },
  { x: -72.5, z: -16, rx: 4.5, rz: 4.5, H: 11, k: 37, n: 6, tilt: [0.3, 0], s7: 1 },   // 凹岩左壁：圆山前脚的大石，靠凹岩一侧高
  { x: -80, z: -16.5, rx: 4, rz: 3.5, H: 7, k: 36, n: 5, s7: 1 },
  { x: -87, z: -13.5, rx: 4.5, rz: 3.5, H: 5, k: 38, n: 5, s7: 1 },
];
// 底座：把几座峰连成一整块（右巨岩、凹岩后壁），平顶陡壁
export const ROCKS2_BODY = [
  { x: -50, z: -23, rx: 10.5, rz: 8.5, ry: 0.35, H: 14, n: 6, k: 41, s7: 1 },
  { x: -66, z: -25, rx: 6.5, rz: 3.8, ry: 0.1, H: 11, n: 6, k: 42, s7: 1 },
];
let rocks2G = null;
export function rocks2At(x, z, g = null) {
  if (x < -94 || x > -34 || z > -8 || z < -38) return { y: -Infinity, a: 0, ph: 0 };
  if (!rocks2G) { const o = LAYOUT_V21.on; LAYOUT_V21.on = false; D7.off = true; rocks2G = MASSIF2.map((P) => terrainBase(P.x, P.z)); D7.off = false; LAYOUT_V21.on = o; }
  if (g === null) g = terrainBase(x, z);
  const cut = smooth(1.2, 3.5, distToLine(x, z, STAIRS2[0])) * smooth(2.2, 4.5, Math.hypot(x - PANYU.x, z - PANYU.z) - 3);
  let best = -Infinity, a = 0, ph = 0;
  const s7 = !S6.old && !V29.on && !LAYOUT_V21.on; // v36 磐玉隈巨岩改成网格石（main.js PAN7），石坎网格只留圆山脚那几块
  MASSIF2.forEach((P, i) => {
    if (s7 && P.s7) return;
    const dx = (x - P.x) / (P.rx * 1.2), dz = (z - P.z) / (P.rz * 1.2);
    if (dx * dx + dz * dz > 2.6) return;
    const d = polyDist(dx, dz, P.n, P.k * 0.9, 0.3, P.k * 2.3, x, z, P.k);
    if (d >= 1) return;
    // 原画磐玉隈的石是一块块平顶陡壁的大方石，不是馒头：边上陡起，顶上略平
    let prof = P.tip ? Math.pow(1 - Math.pow(d, 2.2), 0.6) : Math.pow(1 - Math.pow(d, 4), 0.45);
    if (P.tilt) prof *= 1 + 0.5 * (P.tilt[0] * dx + P.tilt[1] * dz) * (1 - d);
    const [st, f] = ledges(P.H * prof, P.H / (P.tip ? 4.5 : 3.5));
    const base = g + (rocks2G[i] - g) * smooth(0, 0.3, prof);
    const y = base + (P.H * prof * 0.3 + st * 0.7 + 0.5 * (vnoise(x * 0.5, z * 0.5) - 0.5) * prof) * cut;
    if (y > best) { best = y; a = prof; ph = Math.cos(f * 2 * Math.PI); }
  });
  for (const B of ROCKS2_BODY) {
    if (s7 && B.s7) continue;
    const c = Math.cos(B.ry), sn = Math.sin(B.ry), dx = ((x - B.x) * c - (z - B.z) * sn) / B.rx, dz = ((x - B.x) * sn + (z - B.z) * c) / B.rz;
    if (dx * dx + dz * dz > 2.2) continue;
    const d = polyDist(dx, dz, B.n, 0.4, 0.15, 1.2, x, z, B.k);
    if (d >= 1) continue;
    const H = B.H * cut, prof = Math.pow(1 - Math.pow(d, 5), 0.4) * (0.85 + 0.3 * vnoise(x * 0.08 + B.k, z * 0.08));
    const [st, f] = ledges(H * prof, 3.2), y = g + H * prof * 0.3 + st * 0.7;
    if (H * prof > 0.3 && y > best) { best = y; a = 0.45 * prof; ph = Math.cos(f * 2 * Math.PI); }
  }
  return { y: best, a, ph };
}

export const MOUNDS = [
  { x: -170, z: -60, r: 40, h: 30 },   // 芙蓉城群峰基座
  { x: -218, z: -32, r: 18, h: 10 },   // 觀音岩
];

// 玉女潭一区的山：照原画做成几个圆浑的山头软接在一起（山头之间留出沟），坡上顺坡而下几道脊
// lobes: [dx, dz, 半径倍数, 高度倍数]
export const LOBED = [
  { x: 40, z: -60, r: 30, h: 21, n: 7, lobes: [[-12, 6, 0.62, 0.8], [8, -2, 0.7, 1.0], [-2, -16, 0.55, 0.85], [22, 10, 0.5, 0.62], [-26, -4, 0.5, 0.6]] }, // 玉女潭后山
  { x: 70, z: -28, r: 18, h: 15, n: 6, lobes: [[0, 0, 0.8, 1.0], [9, 7, 0.55, 0.7], [-7, -8, 0.6, 0.85], [12, -10, 0.5, 0.75]] },                       // 靈應亭小山
  { x: -8, z: -48, r: 26, h: 19, n: 7, lobes: [[0, 0, 0.75, 1.0], [-14, 8, 0.55, 0.72], [12, 9, 0.5, 0.66], [6, -14, 0.6, 0.9]] },                    // 左上红楼所在山
  // 东境·廊院（IMG_1271、1270）
  { x: 277, z: -34, r: 15, h: 12, n: 6, lobes: [[0, 0, 0.8, 1.0], [-8, 6, 0.55, 0.7], [7, -7, 0.6, 0.85]] },       // 金晶巖左后的石青圆山
  { x: 226, z: -38, r: 16, h: 13, n: 6, lobes: [[0, 0, 0.75, 1.0], [6, 9, 0.55, 0.65], [-8, -6, 0.6, 0.9]] },      // 大觀廊左山
  { x: 272, z: -18, r: 11, h: 8, n: 5, lobes: [[0, 0, 0.8, 1.0], [-3, 8, 0.5, 0.6], [5, -6, 0.6, 0.8]] },          // 大觀廊右坡
  // 林泉雅集（IMG_1269–1267）
  { x: 215, z: -20, r: 13, h: 15, n: 6, lobes: [[0, 0, 0.8, 1.0], [-4, 8, 0.55, 0.75], [5, -8, 0.6, 0.9]] },        // 梅竹隩右边的陡山
  { x: 171, z: -22, r: 9, h: 13, n: 5, lobes: [[0, 0, 0.8, 1.0], [3, 6, 0.5, 0.7], [-3, -6, 0.6, 0.9]] },          // 流觴嶼与梅竹隩之间的石山
];
// 游线前方（画面下缘）的坡包：原画每幅下缘都是一层层圆浑的青绿坡包，上面长灌丛矮松、脚下堆石青石。
// 只在离游线 4 米以外抬起，路面不动。m(x, z, 半径, 高, 种子) 自动生成两三个错开的包头
function m(x, z, r, h, k) {
  const R = rand(k * 97 + 13), lobes = [[0, 0, 0.8, 1.0]];
  for (let i = 0; i < 2 + (k % 2); i++) { const a = R() * 6.28, d = r * (0.3 + R() * 0.35); lobes.push([Math.cos(a) * d, Math.sin(a) * d, 0.45 + R() * 0.2, 0.55 + R() * 0.3]); }
  return { x, z, r, h, n: 5, lobes };
}
export const FORE = [
  // 金晶巖（IMG_1271）：左下大坡包长两株大松，正下方一低一高两个包，右下一面大坡往上抬
  m(283, 15, 9, 6, 1), m(272, 23, 10, 6, 2), m(295, 15, 6, 3, 23), m(307, 16, 6, 3.5, 24), m(300, 28, 10, 5, 3), m(291, 33, 8, 4, 4), m(311, 30, 9, 5, 5), m(319, 14, 10, 7, 6), m(331, 21, 12, 9, 7),
  // 大觀廊（IMG_1270）：右下坡包堆石青石，左下溪边两个包
  m(262, 16, 9, 6, 8), m(269, 8, 8, 5, 9), m(255, 21, 9, 4, 10), m(236, 14, 8, 4, 11), m(228, 19, 8, 5, 12),
  // 梅竹隩（IMG_1269）：左边一面陡坡，右边松树坡，下缘中间一个低包；溪水从中间切过
  m(173, 14, 12, 8, 13), m(212, 18, 10, 7, 14), m(190, 28, 9, 4, 15), m(181, 24, 7, 3, 16),
  // 流觴嶼（IMG_1268）：镜头脚下一个长矮松的低包，右边坡往石山上抬，左下溪湾边一个包
  m(153, 7, 5, 2, 17), m(166, 9, 8, 6, 18), m(140, 8, 6, 3, 19),
  // 凝玉亭·玉樹湍（IMG_1267）：左下大坡、鶴巢后一个缓包，右下溪边一个包
  m(97, 10, 8, 4, 20), m(104, 19, 9, 3, 21), m(124, 15, 8, 3, 22),
];
// v44 玉女潭后面的群山（Yang 2026-11-11：比原画单薄，原画潭后层层高山直到画顶，右边云海上还有山）。
// 照原画 IMG_1266 在画境镜头里反投影定位：左上一大团石青山、山间一块台地是初平林、正后一道中山、最后一道高山横过画顶，右上云海后面一组高山。
// 只加在 v21 布局以外（撒树、布局照旧按原地形算），x < −34 渐隐，第二章的地形不动。
// 原画远山是宽厚的圆山头一个挨一个（宽是高的三四倍），不是尖峰：每个山头是一只圆顶 [x, z, 半径, 高]，几个山头软最大接成一道山
export const BACK8 = [
  { lobes: [[-26, -80, 28, 28], [-18, -66, 16, 13], [-34, -97, 28, 27]] },                      // 左上石青大山（初平林左边）
  { lobes: [[12, -108, 30, 22], [38, -115, 32, 27], [62, -117, 28, 23], [84, -106, 24, 15]] },                    // 潭后中间一道山
  { lobes: [[0, -150, 40, 40], [30, -157, 44, 47], [62, -160, 40, 43], [94, -154, 40, 24]] },                     // 最后一道高山，横过画顶
  { lobes: [[118, -148, 36, 40], [146, -154, 40, 50], [172, -142, 30, 36]] },                                     // 右上云海后面的高山
  { lobes: [[114, -116, 20, 15], [130, -126, 18, 13]] },                                                          // 云海里冒出的山头
];
const dome8 = (d) => (d >= 1 ? 0 : Math.pow(1 - d * d, 1.4));
function range8(x, z, L, k = 0.16) {
  let acc = 0, n = 0;
  for (const [lx, lz, R, H] of L.lobes) { const d = Math.hypot(x - lx, z - lz) / R; if (d < 1) { acc += Math.exp(k * H * dome8(d)); n++; } }
  return n ? Math.log(acc - n + 1) / k : 0;
}
export const CHUPING = { x: -9, z: -101, r: 8, y: 63, b: 9 }; // 初平林台地（红楼院落在台地右后，松林在左）
PADS_NOW.push(CHUPING);
export function back8(x, z) {
  if (x < -50 || x > 200 || z > -48) return 0;
  let h = 0; for (const L of BACK8) h += range8(x, z, L);
  if (h <= 0) return 0;
  // 顺坡而下的褶（原画远山一道道的皴褶）：沿坡向的脊状噪声，山腰最明显
  h *= 0.9 + 0.22 * ridged(x * 0.045 + 3, z * 0.03 - 5);
  return h * smooth(-46, -32, x) * smooth(-48, -64, z);
}
export const lawnWeight = (x) => smooth(88, 100, x) + smooth(-34, -42, x) * smooth(-206, -196, x) + smooth(-200, -208, x) * smooth(-292, -284, x); // v39 第三章也是石绿坡 // 第一章（玉女潭以东）地面按原画铺石绿草坡
// 坡包高出地面多少（着色、种灌丛都用它）
export function foreMound(x, z) { if (x < 88 || z < 0) return 0; return lobedHeight(x, z, FORE) * smooth(3.5, 8, Math.abs(z - pathAt(x).z)); }
function lobedHeight(x, z, list = LOBED) {
  let sum = 0;
  for (const L of list) {
    const dx = x - L.x, dz = z - L.z, rho = Math.hypot(dx, dz) / L.r;
    if (rho > 1.9) continue;
    let acc = 0; const k = 0.4;
    for (const [ox, oz, rk, hk] of L.lobes) {
      const d2 = ((x - L.x - ox) ** 2 + (z - L.z - oz) ** 2) / (L.r * rk) ** 2;
      acc += Math.exp(k * L.h * hk * Math.exp(-d2 * 2.2));
    }
    let H = Math.log(acc / L.lobes.length * 0.999 + 0.001) / k; // 软最大：山头之间自然出沟
    H = Math.max(0, H);
    // 顺坡的脊：从山顶向下放射，带一点扭
    const th = Math.atan2(dz, dx);
    const rib = Math.pow(1 - Math.abs(Math.sin(th * L.n + fbm(x * 0.05, z * 0.05) * 3)), 3);
    H += rib * L.h * 0.06 * smooth(0.2, 0.45, rho) * smooth(1.35, 0.8, rho);
    sum += H;
  }
  return sum;
}

export function pondBackness(x, z) {
  const P = POND, dx = (x - P.x) / P.rx, dz = (z - P.z) / P.rz, l = Math.hypot(dx, dz) || 1;
  return smooth(0.05, 0.45, -dz / l);
}
export function pondShape(x, z, P) {
  const dx = (x - P.x) / P.rx, dz = (z - P.z) / P.rz; return Math.sqrt(dx * dx + dz * dz);
}
// 离最近一条溪的水平距离；x 是溪线上最近点的 x，wl 是那里的水面高，k 是第几条溪
export function distToStream(x, z) {
  let best = 1e9, by = 0, k = 0, wl = 0;
  [STREAM, STREAM2].forEach((S, si) => {
    for (let i = 0; i < S.length - 1; i++) {
      const [ax, az] = S[i], [bx, bz] = S[i + 1];
      const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz;
      let t = ((x - ax) * vx + (z - az) * vz) / l2; t = Math.max(0, Math.min(1, t));
      const px = ax + vx * t, pz = az + vz * t, d = Math.hypot(x - px, z - pz);
      if (d < best) { best = d; by = px; k = si; wl = si ? S[i][2] + (S[i + 1][2] - S[i][2]) * t : 0; }
    }
  });
  if (!k) wl = pathAt(by).y - 0.45;
  return { d: best, x: by, wl, k };
}
const mountAmp = (x) => 34 + 26 * smooth(-40, -110, x) * smooth(-235, -190, x) + 10 * smooth(230, 300, x) + 14 * smooth(-300, -340, x);

// 地形高度（不含建筑、桥面）
export function terrainHeight(x, z) {
  let h = terrainBase(x, z);
  if (FOLD.on && !FOLD.off) h += foldAt(x, z); // v57 山体褶皱
  const M = massifAt(x, z, h); if (M.y > h + 0.5) h = M.y - 0.4; // 隐春巖：地形垫在石壁网格下面
  if (!LAYOUT_V21.on && CH2(x)) { const R = rocks2At(x, z, h); if (R.y > h + 0.5) return R.y - 0.4; } // 磐玉隈的巨岩
  const [lx, lz] = caveLocal(x, z);
  if (Math.abs(lx) > CAVE.hw + CAVE.T + 1 || lz > CAVE.lip + 1 || lz < -CAVE.dc - CAVE.T - 1) return h;
  if (inCave(lx, lz)) return CAVE.y;
  const r = caveRoof(lx, lz > -3 && !LAYOUT_V21.on ? lz + 1.6 : lz, h); return r > -1e8 ? r - 0.6 : h; // 洞口一段往外错 1.6 米取值：地形网格粗，不能冒到檐面前
}
// 金晶巖岩壳顶面：椭球与原地形取高者再高出 0.6（岩壳盖在地形上）；不在岩壳范围返回 -Infinity
export function caveRoof(lx, lz, base) { const e = caveShell(lx, lz); return e > -1e8 ? Math.max(e, base + 0.6) : -Infinity; }
export function terrainBase(x, z) {
  const p = pathAt(x), base = p.y, p0 = pathV33At(x), d = z - p0.z;
  const ad = Math.abs(z - p.z);
  let h = p0.y;
  // 画面深处的山
  const back = Math.max(0, -d);
  const m = mountAmp(x);
  h += m * Math.pow(smooth(5, 95, back), 1.25) * (0.5 + 0.6 * ridged(x * 0.011, z * 0.013));
  h += 7 * smooth(4, 30, back) * (fbm(x * 0.035 + 7, z * 0.035) - 0.35);
  // 近景低丘（框住画面下缘）
  const fr = Math.max(0, d);
  h += smooth(9, 30, fr) * (3 + 9 * fbm(x * 0.03, z * 0.03 + 11)) - smooth(40, 70, fr) * 4;
  // 世界边缘抬高，挡住地图尽头
  h += 40 * (LAYOUT_V21.on || x > 0 ? smooth(320, 352, Math.abs(x)) : smooth(-392, -424, x)) + 30 * smooth(55, 85, d); // v47 卷尾往左加长到 −428
  // 游线附近细碎起伏
  h += (fbm(x * 0.12, z * 0.12) - 0.5) * 1.6 * smooth(2.5, 9, ad);
  // 游线压平
  h = base + (h - base) * smooth(2.2, 6.5, ad);
  // 小山
  // v34：r = 1.6 处原来截断，留下一道 0.1 米的坎（芙蓉城基座那一圈正好横过超然亭右边的游线，人走过去会被卡住）；补成连续的。
  // 旧布局（树、v33 石阵）照旧按截断算，免得随机序列变
  const seam = S6.old || V29.on || LAYOUT_V21.on ? 0 : Math.exp(-1.6 * 1.6 * 2.2);
  for (const M of MOUNDS) { const r = Math.hypot(x - M.x, z - M.z) / M.r; if (r < 1.6) h += M.h * (Math.exp(-r * r * 2.2) - seam * smooth(1.45, 1.6, r)); }
  if (z < 0) h += lobedHeight(x, z);
  if (!LAYOUT_V21.on) h += back8(x, z); // v44 玉女潭后面的群山
  h += foreMound(x, z);
  if (!LAYOUT_V21.on && CH2(x)) h += ch2Hills(x, z, h);
  const hPre = h; // v50 第三、四章接缝用
  if (!LAYOUT_V21.on && CH3(x)) {
    const w = ch3Blend(x); if (w > 0) h += (ch3Ground(x, z, h) - h) * w; // v39 第三章按原画重搭
    const f = smooth(-212, -206, x); if (f > 0) h = base + (h - base) * (1 - f * (1 - smooth(2.2, 6.5, ad))); // 和第二章接头处游线一样压平（第二章在 x > −202 压到游线高，不压会留一道 0.13 米的坎）
  }
  if (!LAYOUT_V21.on && CH4(x)) { const w = ch4Blend(x); if (w > 0) h += (ch4Ground(x, z, h) - h) * w; } // v46 卷尾按原画重搭
  // v50 第三、四章接缝（x −283..−296）的南边：原来缝里露出底下的老地形（地图边抬高 30 米），路南立起一道又薄又高的山脊。改成两边地形直接过渡
  if (!LAYOUT_V21.on && x < -283 && x > -296 && z > p.z + 4) {
    const k = smooth(-283, -296, x), hs = ch3Ground(x, z, hPre) * (1 - k) + ch4Ground(x, z, hPre) * k;
    h += (hs - h) * smooth(p.z + 4, p.z + 10, z);
  }
  if (!LAYOUT_V21.on && !V29.on && !S56.off && x > -302 && x < -202 && z > 34) h = south3(x, z, h); // v57 龍湫·禪窩南边合拢
  if (!LAYOUT_V21.on && !V29.on && !S56.off && x > -218 && x < -120 && z > 13) h = south5(x, z, h); // v56 超然亭对面合拢
  if (!LAYOUT_V21.on) h += caveHill(x, z);
  if (x > -46 && x < 2 && !S6.old && !V29.on && !LAYOUT_V21.on) h = grove7(x, z, h);
  // 玉女潭：前岸缓坡入水，后岸是陡崖（崖面另建网格），崖上是一片台地
  {
    const P = POND, r = pondShape(x, z, P);
    if (r < 2.6) {
      const back = pondBackness(x, z);
      if (r < 1) {
        const bed = P.wl - 2.4 * (1 - r * r) - 0.2;
        h = bed + (P.wl + 0.3 - bed) * smooth(0.86, 1.0, r);
      } else {
        const plateau = 18.5 + 3 * fbm(x * 0.06, z * 0.06);
        // 陡崖在 r≈0.97，台地从 r≥1.13 才抬起，保证地形的陡坡三角形整个藏在崖壁后面
        const backVal = r < 1.13 ? P.wl + 0.3 : Math.max(h, plateau + (h - plateau) * smooth(1.5, 2.5, r));
        const frontVal = P.wl + 0.3 + (h - P.wl - 0.3) * smooth(1.0, 1.8, r);
        h = frontVal + (backVal - frontVal) * back;
      }
    }
  }
  // 龍湫水池
  for (const P of LAYOUT_V21.on ? [POOL] : [POOL3, POOLW]) { const r = pondShape(x, z, P); if (r < 1.6) { const bed = P.wl - 2 * (1 - r * r); h = r < 1 ? Math.min(h, bed + (P.wl + 0.5 - bed) * smooth(0.8, 1, r)) : Math.min(h, P.wl + 0.5 + (r - 1) * 5 + (h - P.wl) * smooth(1, 1.6, r)); } }
  // 曲溪河道
  if (x > 92 && x < 250) {
    const s = distToStream(x, z);
    if (s.d < 6) { const bed = s.wl - 0.65; h = Math.min(h, bed + (h - bed) * (s.k ? smooth(0.6, 3.4, s.d) : smooth(1.2, 5.5, s.d))); }
  }
  // 平台
  for (const Pd of LAYOUT_V21.on ? PADS : PADS_NOW) {
    const r = Math.hypot(x - Pd.x, z - Pd.z);
    const bl = Pd.b ?? 7;
    if (r < Pd.r + bl) { const w = smooth(Pd.r + bl, Pd.r, r); h = h + (Pd.y - h) * w; }
  }
  if (!LAYOUT_V21.on && x > 212 && x < 292 && z > -92 && z < 5) h = daguanGround(x, z, h);
  return h;
}

// 水面高度（没有水返回 -Infinity）
export function waterLevel(x, z) {
  if (pondShape(x, z, POND) < 1.02) return POND.wl;
  for (const P of LAYOUT_V21.on ? [POOL] : [POOL3, POOLW]) if (pondShape(x, z, P) < 1.02) return P.wl;
  if (x > 92 && x < 250) { const s = distToStream(x, z); if (s.d < (s.k ? 1.5 : 1.6)) return s.wl; }
  return -Infinity;
}

// ---------- 可走的附加表面（桥、楼板）----------
export const SURFACES = [];
export function addSurface(fn, tall = false) { fn.tall = tall; SURFACES.push(fn); }
export function groundHeight(x, z) {
  let h = terrainHeight(x, z);
  for (const f of SURFACES) { const v = f(x, z); if (v !== null && v > h - 0.01 && (f.tall || v < h + 6)) h = Math.max(h, v); } // tall：高台台面，比地形高出 6 米以上也算
  return h;
}

// ---------- 碰撞体 ----------
export const COLLIDERS = []; // {x,z,r} 圆 / {x,z,hw,hd,rot} 盒
export function blocked(x, z, rad = 0.3) {
  for (const c of COLLIDERS) {
    if (c.r !== undefined) { if ((x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + rad) ** 2) return true; }
    else {
      const cs = Math.cos(c.rot), sn = Math.sin(c.rot), lx = (x - c.x) * cs - (z - c.z) * sn, lz = (x - c.x) * sn + (z - c.z) * cs;
      if (Math.abs(lx) < c.hw + rad && Math.abs(lz) < c.hd + rad && !(c.door && Math.abs(lx) < c.door && lz > 0)) return true;
    }
  }
  return false;
}

// ---------- v57 山体褶皱（Yang：投稿前把山再打磨精细些，更自然、有意境）----------
// 原画的山坡不是光溜溜的馒头：从山头往下一道道顺坡的褶（披麻皴），脊上受光、沟里透赭，坡脚给褶分成一瓣瓣。
// 做法：地形网格算好以后，按“大样”坡向（模糊过的高度场的梯度）在山坡上叠一层顺坡的褶——每 7 米一格撒一个点，
// 点四周起一组横着坡走的波（波峰圆、波谷尖，谷就是一道沟），相邻几格的波按距离加权并起来，沟就会分岔、汇合，像水冲出来的。
// 只在离游线远、比游线高、够陡的山坡上起褶；山头（坡缓）照旧圆浑；亭台、潭、洞、石阶、超然亭细网格、第二章核心、峡谷石壁四周不动。
// 褶的高度存成网格（FOLD.arr），terrainHeight 双线性取值叠上去，人、树落脚和网格一致。撒树、撒草时关掉（FOLD.off），随机序列不变，种下去时再落到褶上。
export const FOLD = { arr: null, on: false, off: false };
function foldAt(x, z) {
  const { x0, z0, step } = WORLD, A = FOLD.arr, nx = FOLD.nx, fi = (x - x0) / step, fj = (z - z0) / step;
  if (fi < 0 || fj < 0 || fi > nx - 1.001 || fj > FOLD.nz - 1.001) return 0;
  const i = Math.floor(fi), j = Math.floor(fj), u = fi - i, v = fj - j, k = j * nx + i;
  return (A[k] * (1 - u) + A[k + 1] * u) * (1 - v) + (A[k + nx] * (1 - u) + A[k + nx + 1] * u) * v;
}
const FOLD_STAIRS = [[[3, -15.5], [2, -22], [-1, -30], [-4, -38], [-7, -45.5]], [[-4.5, -53], [-1.5, -58.5], [-5, -64.5], [-1.5, -70.5], [-6, -77], [-3, -84], [-7, -90], [-6.8, -96.5]], QN_STAIRS];
function foldKeep(x, z) { // 1：可以起褶；0：不动
  let k = 1;
  if (x > -206 && x < -34 && z < 14) k *= smooth(14, 20, z) + smooth(-200, -212, x) + smooth(-40, -28, x); // 第二章核心（超然亭、琪樹峡、磐玉隈都已照原画 1:1，不动）
  if (k <= 0) return 0;
  for (const Pd of PADS_NOW) { const r = Math.hypot(x - Pd.x, z - Pd.z); if (r < Pd.r + (Pd.b ?? 7) + 6) k *= smooth(Pd.r + (Pd.b ?? 7) + 1, Pd.r + (Pd.b ?? 7) + 6, r); }
  for (const [P, R] of [[POND, 2.8], [POOL3, 2.4], [POOLW, 2.6]]) { const r = pondShape(x, z, P); if (r < R + 0.6) k *= smooth(R, R + 0.6, r); }
  for (const [cx, cz, r0, r1] of [[CAVE.x, CAVE.z, 16, 22], [MOYA3.x, MOYA3.z, 13, 18], [GROTTO3.x, GROTTO3.z, 10, 15], [PEAK4.x, PEAK4.z, 8, 12], [SIYANG4.x, SIYANG4.z - 8, 13, 18], [CHUPING.x, CHUPING.z, CHUPING.r + 8, CHUPING.r + 13], [CHAORAN.x, CHAORAN.z, 10, 14]]) {
    const r = Math.hypot(x - cx, z - cz); if (r < r1) k *= smooth(r0, r1, r);
  }
  k *= 1 - smooth(203, 210, x) * smooth(300, 293, x) * smooth(-100, -93, z) * smooth(12, 5, z); // 大觀廊整片（院落台地）不动
  if (x < -392) { const G = gorgeAt4(x, z); k *= smooth(G.w + 6, G.w + 10, G.a) + smooth(-394, -390, x); } // 卷尾峡谷石壁四周
  if (k <= 0) return 0;
  if (x > 92 && x < 250) { const d = distToStream(x, z).d; if (d < 8) k *= smooth(4, 8, d); }
  if (x < -360) { const d = distToStream4(x, z).d; if (d < 7) k *= smooth(3.5, 7, d); }
  for (const L of FOLD_STAIRS) { const d = distToLine(x, z, L); if (d < 7) k *= smooth(3, 7, d); }
  return k;
}
const fh = (i, j, s) => { let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(s, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
// 一组顺坡的褶：(tx, tz) 是等高线方向（横着坡），lam 是褶距
function foldWave(x, z, tx, tz, L, lam, seed) {
  const ci = Math.floor(x / L), cj = Math.floor(z / L); let acc = 0, ws = 0;
  for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    const I = ci + di, J = cj + dj, cx = (I + 0.15 + 0.7 * fh(I, J, seed)) * L, cz = (J + 0.15 + 0.7 * fh(I, J, seed + 7)) * L;
    const ox = x - cx, oz = z - cz, w = Math.exp(-(ox * ox + oz * oz) / (L * L * 0.55));
    const u = (ox * tx + oz * tz) / lam + fh(I, J, seed + 13);
    acc += w * (2 * Math.abs(Math.sin(Math.PI * u)) - 1); ws += w; // 波峰圆、波谷尖（尖的是沟）
  }
  return acc / ws;
}
export function buildFoldField(HG, nx, nz, x0, z0, step, rel) {
  const D = new Float32Array(nx * nz);
  const B = boxBlur(boxBlur(HG, nx, nz, 2), nx, nz, 2), B2 = boxBlur(boxBlur(HG, nx, nz, 5), nx, nz, 5); // 大样坡向：细的给小褶，粗的给大的支脉
  for (let j = 1; j < nz - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const k = j * nx + i, x = x0 + i * step, z = z0 + j * step;
    const gx = (B[k + 1] - B[k - 1]) / (2 * step), gz = (B[k + nx] - B[k - nx]) / (2 * step), s = Math.hypot(gx, gz);
    if (s < 0.18 || rel[k] < 2) continue;
    let m = smooth(0.18, 0.55, s) * smooth(2, 8, rel[k]) * smooth(5, 11, Math.abs(z - pathAt(x).z));
    if (m <= 0) continue;
    m *= foldKeep(x, z); if (m <= 0) continue;
    const Gx = (B2[k + 1] - B2[k - 1]) / (2 * step), Gz = (B2[k + nx] - B2[k - nx]) / (2 * step), S = Math.hypot(Gx, Gz) || 1e-6;
    const vary = 0.55 + 0.9 * vnoise(x * 0.025 + 3.1, z * 0.025 - 1.7);                               // 有的坡褶深，有的浅
    const big = foldWave(x, z, -Gz / S, Gx / S, 13, 11, 5701) * Math.min(1.9, 0.75 * s);                 // 支脉：坡脚分成一瓣瓣
    const fine = foldWave(x, z, -gz / s, gx / s, 6.5, 5.2, 5702) * Math.min(0.85, 0.38 * s);            // 披麻皴那样的细褶
    D[k] = (big * smooth(0.25, 0.6, S) + fine) * m * vary;
  }
  return D;
}

// ---------- 地形网格 ----------
export const WORLD = { x0: -428, x1: 356, z0: -178, z1: 88, step: 1.5 }; // v47 卷尾往左加长 72 米（原来 −356）：四陽洞左移 45 米，画境镜头左半还要看到 −420 的山。撒树、撒石、云的随机序列仍按 −356 算，见 main.js OLDX0
// v35 琪樹峡峡里的土（原画 IMG_1264 石缝间是赭褐的土）：画境镜头下原画石阵那一圈反投影到地上（c5/rc6.mjs），边上软 3 米
const G6 = [[-125.7, -25.1], [-124.8, -31.2], [-119, -33.7], [-108.9, -35], [-102.3, -33.7], [-96.9, -25.4], [-94.6, -23], [-93, -18.8], [-89.2, -12.7], [-88, -9.5], [-89.3, -5.6], [-104.1, -1.5], [-106.4, -4.2], [-111.1, -8.1], [-115.2, -9], [-118.4, -10], [-123.3, -16.8]];
export function gorge6(x, z) {
  if (x < -130 || x > -84 || z < -40 || z > 3) return 0;
  let inside = false, d = Infinity;
  for (let i = 0, j = G6.length - 1; i < G6.length; j = i++) {
    const [xi, zi] = G6[i], [xj, zj] = G6[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
    const vx = xj - xi, vz = zj - zi, t = Math.max(0, Math.min(1, ((x - xi) * vx + (z - zi) * vz) / (vx * vx + vz * vz)));
    d = Math.min(d, Math.hypot(x - xi - vx * t, z - zi - vz * t));
  }
  const sd = (inside ? d : -d) + 2.2 * (fbm(x * 0.13 + 4, z * 0.13) - 0.5);
  return smooth(-1.5, 2.5, sd);
}
export function buildTerrainGeometry(THREE) {
  const { x0, x1, z0, z1, step } = WORLD;
  const nx = Math.round((x1 - x0) / step) + 1, nz = Math.round((z1 - z0) / step) + 1;
  const pos = new Float32Array(nx * nz * 3), rel = new Float32Array(nx * nz), pathM = new Float32Array(nx * nz);
  // v42 网格高度可预存（见 bake.js）
  const HG = bakedArray(`terrain:${x0},${x1},${z0},${z1},${step}`, nx * nz, (A) => { for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) A[j * nx + i] = terrainHeight(x0 + i * step, z0 + j * step); });
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = x0 + i * step, z = z0 + j * step, k = j * nx + i;
    const h = HG[k], p = pathAt(x);
    pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
    rel[k] = h - p.y;
    pathM[k] = 1 - smooth(1.0, 2.4, Math.abs(z - p.z) + (fbm(x * 0.3, z * 0.3) - 0.5) * 1.2);
  }
  { // v57 山体褶皱（见 buildFoldField）
    const D = buildFoldField(HG, nx, nz, x0, z0, step, rel);
    for (let k = 0; k < D.length; k++) { pos[k * 3 + 1] += D[k]; rel[k] += D[k]; }
    Object.assign(FOLD, { arr: D, nx, nz, on: true });
  }
  // 山头起伏：高度减去周围的平均高度，凸起（山脊、山头上半）为正，凹处（山脚、沟谷）为负。
  // 着色器用它把每个山头画成上青下赭，苔点沿脊线成串，和原画一样。
  const blur = (src, R) => {
    const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
    for (let j = 0; j < nz; j++) { let acc = 0, cnt = 0; for (let i = -R; i < nx + R; i++) { if (i + R < nx) { acc += src[j * nx + i + R]; cnt++; } if (i - R - 1 >= 0) { acc -= src[j * nx + i - R - 1]; cnt--; } if (i >= 0 && i < nx) tmp[j * nx + i] = acc / cnt; } }
    for (let i = 0; i < nx; i++) { let acc = 0, cnt = 0; for (let j = -R; j < nz + R; j++) { if (j + R < nz) { acc += tmp[(j + R) * nx + i]; cnt++; } if (j - R - 1 >= 0) { acc -= tmp[(j - R - 1) * nx + i]; cnt--; } if (j >= 0 && j < nz) out[j * nx + i] = acc / cnt; } }
    return out;
  };
  const hs = new Float32Array(nx * nz); for (let k = 0; k < hs.length; k++) hs[k] = pos[k * 3 + 1];
  const b1 = blur(blur(hs, 4), 4), b2 = blur(blur(hs, 12), 12);
  const crest = new Float32Array(nx * nz), crestL = new Float32Array(nx * nz);
  for (let k = 0; k < hs.length; k++) {
    crest[k] = hs[k] - b1[k]; crestL[k] = hs[k] - b2[k];
    // 建筑平台上不算山头：亭台落在赭石地上，不罩石青
    const x = pos[k * 3], z = pos[k * 3 + 2];
    for (const Pd of PADS) { const r = Math.hypot(x - Pd.x, z - Pd.z); if (r < Pd.r + 6) { const w = smooth(Pd.r + 6, Pd.r + 1, r); crest[k] = crest[k] * (1 - w) - w * 0.3; crestL[k] = crestL[k] * (1 - w) - w * 0.6; } }
  }
  const idx = new Uint32Array((nx - 1) * (nz - 1) * 6); let n = 0;
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    const qx = x0 + i * step, qz = z0 + j * step; // v32 超然亭细网格那块挖空
    if (qx >= PATCH5.x0 - 1e-6 && qx + step <= PATCH5.x1 + 1e-6 && qz >= PATCH5.z0 - 1e-6 && qz + step <= PATCH5.z1 + 1e-6) continue;
    idx[n++] = a; idx[n++] = c; idx[n++] = b; idx[n++] = b; idx[n++] = c; idx[n++] = d;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aRel', new THREE.BufferAttribute(rel, 1));
  g.setAttribute('aPath', new THREE.BufferAttribute(pathM, 1));
  g.setAttribute('aCrest', new THREE.BufferAttribute(crest, 1));
  g.setAttribute('aCrestL', new THREE.BufferAttribute(crestL, 1));
  const mound = new Float32Array(nx * nz), lawn = new Float32Array(nx * nz);
  for (let k = 0; k < mound.length; k++) { const x = pos[k * 3], z = pos[k * 3 + 2]; mound[k] = Math.min(1, foreMound(x, z) / 3); lawn[k] = lawnWeight(x) * (1 - 0.8 * Math.max(south5Mask(x, z), south3Mask(x, z))) + lawn4(x, z) - 2 * caveApron(x, z); } // 负值：洞前土坪；v56 超然亭对面合拢的山不铺草坡色（同 v50 南山）
  g.setAttribute('aMound', new THREE.BufferAttribute(mound, 1));
  g.setAttribute('aLawn', new THREE.BufferAttribute(lawn, 1));
  const gor = new Float32Array(nx * nz); for (let k = 0; k < gor.length; k++) { const x = pos[k * 3], z = pos[k * 3 + 2], g6 = gorge6(x, z), d7 = dome7Tint(x, z, pos[k * 3 + 1]); gor[k] = g6 > 0 ? Math.max(g6, d7) : d7; } // v36 圆包：负值是深草
  g.setAttribute('aGorge', new THREE.BufferAttribute(gor, 1));
  g.setAttribute('aFold', new THREE.BufferAttribute(FOLD.arr, 1)); // v57 褶的起伏：着色器在褶沟里勾淡墨赭线
  g.setIndex(new THREE.BufferAttribute(idx.subarray(0, n), 1));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

// v32 超然亭一带另铺一块 0.5 米的细网格（大网格 1.5 米，台坎、冲沟铺不出来）。大网格在这块里挖空；
// 细网格四边的点按大网格的边线插值，接缝不裂
export const PATCH5 = { x0: -201.5, x1: -131, z0: -46, z1: 14, step: 0.5 };
function boxBlur(src, nx, nz, R) {
  const tmp = new Float32Array(src.length), out = new Float32Array(src.length);
  for (let j = 0; j < nz; j++) { let acc = 0, cnt = 0; for (let i = -R; i < nx + R; i++) { if (i + R < nx) { acc += src[j * nx + i + R]; cnt++; } if (i - R - 1 >= 0) { acc -= src[j * nx + i - R - 1]; cnt--; } if (i >= 0 && i < nx) tmp[j * nx + i] = acc / cnt; } }
  for (let i = 0; i < nx; i++) { let acc = 0, cnt = 0; for (let j = -R; j < nz + R; j++) { if (j + R < nz) { acc += tmp[(j + R) * nx + i]; cnt++; } if (j - R - 1 >= 0) { acc -= tmp[(j - R - 1) * nx + i]; cnt--; } if (j >= 0 && j < nz) out[j * nx + i] = acc / cnt; } }
  return out;
}
export function buildTerrainPatch(THREE) {
  const P = PATCH5, st = P.step, M = 20, C = WORLD.step;
  const mx = Math.round((P.x1 - P.x0 + 2 * M) / st) + 1, mz = Math.round((P.z1 - P.z0 + 2 * M) / st) + 1, off = Math.round(M / st);
  const H = bakedArray(`patch5:${P.x0},${P.x1},${P.z0},${P.z1},${st},${M}`, mx * mz, (A) => { for (let j = 0; j < mz; j++) for (let i = 0; i < mx; i++) A[j * mx + i] = terrainHeight(P.x0 - M + i * st, P.z0 - M + j * st); }); // v42 可预存
  const b1 = boxBlur(boxBlur(H, mx, mz, 12), mx, mz, 12), b2 = boxBlur(boxBlur(H, mx, mz, 36), mx, mz, 36);
  const nx = Math.round((P.x1 - P.x0) / st) + 1, nz = Math.round((P.z1 - P.z0) / st) + 1;
  const pos = new Float32Array(nx * nz * 3), rel = new Float32Array(nx * nz), pathM = new Float32Array(nx * nz), crest = new Float32Array(nx * nz), crestL = new Float32Array(nx * nz), mound = new Float32Array(nx * nz), lawn = new Float32Array(nx * nz), riser = new Float32Array(nx * nz);
  const edgeH = (x, z, alongX) => { const v = alongX ? x : z, o0 = alongX ? WORLD.x0 : WORLD.z0, a = o0 + Math.floor((v - o0) / C + 1e-6) * C, k = (v - a) / C; return alongX ? terrainHeight(a, z) * (1 - k) + terrainHeight(a + C, z) * k : terrainHeight(x, a) * (1 - k) + terrainHeight(x, a + C) * k; };
  const RS = bakedArray(`riser5:${P.x0},${P.z0},${st},${nx},${nz}`, nx * nz, (A) => { for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { R5.last = 0; terrainHeight(P.x0 + i * st, P.z0 + j * st); A[j * nx + i] = R5.last; } }); // v42 坡包边沿权重，可预存
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = P.x0 + i * st, z = P.z0 + j * st, k = j * nx + i, q = (j + off) * mx + i + off, p = pathAt(x);
    let h = H[q]; riser[k] = RS[k];
    if (j === 0 || j === nz - 1) h = edgeH(x, z, true); else if (i === 0 || i === nx - 1) h = edgeH(x, z, false);
    pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
    rel[k] = h - p.y;
    pathM[k] = 1 - smooth(1.0, 2.4, Math.abs(z - p.z) + (fbm(x * 0.3, z * 0.3) - 0.5) * 1.2);
    crest[k] = H[q] - b1[q]; crestL[k] = H[q] - b2[q];
    for (const Pd of PADS) { const r = Math.hypot(x - Pd.x, z - Pd.z); if (r < Pd.r + 6) { const w = smooth(Pd.r + 6, Pd.r + 1, r); crest[k] = crest[k] * (1 - w) - w * 0.3; crestL[k] = crestL[k] * (1 - w) - w * 0.6; } }
    mound[k] = Math.min(1, foreMound(x, z) / 3); lawn[k] = lawnWeight(x) - 2 * caveApron(x, z);
  }
  const idx = new Uint32Array((nx - 1) * (nz - 1) * 6); let n = 0;
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1; idx[n++] = a; idx[n++] = c; idx[n++] = b; idx[n++] = b; idx[n++] = c; idx[n++] = d; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const gor = new Float32Array(nx * nz); // 超然亭细网格不在琪樹峡里，全 0
  for (const [nm, arr] of [['aRel', rel], ['aPath', pathM], ['aCrest', crest], ['aCrestL', crestL], ['aMound', mound], ['aLawn', lawn], ['aRiser', riser], ['aGorge', gor], ['aFold', new Float32Array(nx * nz)]]) g.setAttribute(nm, new THREE.BufferAttribute(arr, 1)); // 超然亭一带不加褶（foldKeep）
  g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeVertexNormals(); g.computeBoundingSphere();
  return g;
}

export function slopeAt(x, z) {
  const e = 0.6; return Math.hypot(terrainHeight(x + e, z) - terrainHeight(x - e, z), terrainHeight(x, z + e) - terrainHeight(x, z - e)) / (2 * e);
}
