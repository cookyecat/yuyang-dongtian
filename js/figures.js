// 人物：照 Yang 从原卷里抠出的三十多个人物重做。
// 文士：长袍拖地、宽袖垂袋、交领黑缘、腰带垂绦，戴东坡巾、小冠或幅巾，静立时拱手藏袖；
// 童仆：短衣束腰、白裤黑鞋、齐眉短发，捧盒、提篮、挑担。
// 五官用画布画成墨线贴在头上（aKind 7），衣纹墨线由着色器沿袍身画出（aKind 5/6），轮廓靠后处理勾线。
// 动作全部程序化（走、拱手、作揖、坐、凭栏、扫地、打坐、交谈）。
import * as THREE from 'three';
import { Kit, COL } from './props.js';
import { flatMaterial } from './art.js';

const C = (h) => new THREE.Color(h);
const M = () => new THREE.Matrix4();
const SKIN = C('#efdfc3'), INK = C('#24221f'), HAIR = C('#25221e'), WHITE = C('#ebe7da'), SHOE = C('#22201d');
const FACE = 7, FOLD = 5, FOLD_S = 6;
const _q = new THREE.Quaternion(), _v = new THREE.Vector3();
const _T = new THREE.Vector3(), _G = new THREE.Vector3(), _D = new THREE.Vector3(), _X = new THREE.Vector3(), _Y = new THREE.Vector3(), _Z = new THREE.Vector3(), _H = new THREE.Vector3(), _m = new THREE.Matrix4();
const BROOM_L = 1.46; // 扫帚全长（竿顶到帚梢）
// 两节手臂的解析 IK：肩组只绕 x、z 转，肘只往前弯；p 是躯干空间里的目标点（手心），k 是混合权重
function reachArm(A, p, uL, fL, k) {
  const v = _v.copy(p).sub(A.position); let d = v.length();
  const dMax = uL + fL - 0.005, dMin = Math.abs(uL - fL) + 0.06;
  if (d > dMax) { v.multiplyScalar(dMax / d); d = dMax; } else if (d < dMin) { v.multiplyScalar(dMin / d); d = dMin; }
  const re = -Math.acos(Math.max(-1, Math.min(1, (d * d - uL * uL - fL * fL) / (2 * uL * fL))));
  const wy = -uL - fL * Math.cos(re), wz = -fL * Math.sin(re), rz = Math.asin(Math.max(-1, Math.min(1, -v.x / wy)));
  const ru = Math.atan2(v.z, v.y) - Math.atan2(wz, wy * Math.cos(rz)), fa = A.userData.fa;
  A.rotation.x += (ru - A.rotation.x) * k; A.rotation.z += (rz - A.rotation.z) * k; fa.rotation.x += (re - fa.rotation.x) * k; fa.rotation.y *= 1 - k;
}

function lathe(profile, seg = 10, squash = 0.82) {
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg);
  g.scale(1, 1, squash); return g;
}
// 带衣褶的袍身：沿圆周做起伏，越往下摆褶越深；trail 让底摆向后拖
function robeLathe(profile, { seg = 28, folds = 9, amp = 0.06, squash = 0.84, ph = 0, trail = 0, tFix = -1 } = {}) {
  const g = lathe(profile, seg, 1), p = g.attributes.position;
  const y0 = profile[0][1], y1 = profile[profile.length - 1][1];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(x, z);
    const t = tFix >= 0 ? tFix : Math.abs(y - y1) / (Math.abs(y1 - y0) || 1);
    const f = 1 + amp * t * t * (Math.sin(a * folds + ph) * 0.7 + Math.sin(a * folds * 2.3 + ph * 2) * 0.3);
    const tr = Math.max(0, 1 - y / 0.35);
    p.setXYZ(i, x * f, y, z * f * squash - trail * tr * tr);
  }
  g.computeVertexNormals(); return g;
}
function profR(prof, y) {
  for (let i = 0; i < prof.length - 1; i++) {
    const [r0, y0] = prof[i], [r1, y1] = prof[i + 1];
    if ((y - y0) * (y - y1) <= 0 && y1 !== y0) return r0 + (r1 - r0) * (y - y0) / (y1 - y0);
  }
  return prof[prof.length - 1][0];
}
// 袍面上的点：a 为从正前方（+z）往左手（+x）量的角度
function onSurf(prof, squash, aDeg, y, off = 0.012, trail = 0) {
  const a = aDeg * Math.PI / 180, r = profR(prof, y) + off, tr = Math.max(0, 1 - y / 0.35);
  return [r * Math.sin(a), y, r * Math.cos(a) * squash - trail * tr * tr];
}
// 贴在袍面上的扁平衣缘：沿曲线取点，横向沿袍面展开成一条带子（双面）
function strip(prof, squash, pts, width, off = 0.008, n = 24) {
  const curve = new THREE.CatmullRomCurve3(pts.map(([a, y]) => new THREE.Vector3(...onSurf(prof, squash, a, y, off))));
  const P = curve.getSpacedPoints(n), pos = [], idx = [];
  for (let i = 0; i <= n; i++) {
    const p = P[i], t = curve.getTangentAt(i / n), nr = new THREE.Vector3(p.x, 0, p.z / squash).normalize();
    const ac = new THREE.Vector3().crossVectors(t, nr).normalize().multiplyScalar(width / 2);
    pos.push(p.x - ac.x, p.y - ac.y, p.z - ac.z, p.x + ac.x, p.y + ac.y, p.z + ac.z);
    if (i < n) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2, a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3 * 2), 2));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}
const tube = (pts, r, radial = 6, seg = 10) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((q) => new THREE.Vector3(...q))), seg, r, radial, false);
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
}

// ---------- 墨线五官 ----------
// 头是一个球：贴图横向 512 对应一周，脸正中在 u=0.25（x=128），纵向 256 对应从头顶到下巴底。
// 五官按角度摆：横向从脸中线往两侧量，纵向从头顶往下量（90° 是赤道）。
// 人眼中心约在 ±25°、外眼角约 ±38°，鼻底约 113°，口约 123°，下巴约 145°。
const faceCache = new Map();
function faceTexture(kind, v = 0) {
  const key = kind + v;
  if (faceCache.has(key)) return faceCache.get(key);
  const K = 512 / 360, cx = 128, kid = kind === 'kid';
  const X = (d) => cx + d * K, Y = (d) => d * K;
  const t = canvasTex(512, 256, (g) => {
    g.fillStyle = '#efdfc3'; g.fillRect(0, 0, 512, 256);
    // 两颊淡淡的胭脂；鼻下、眼窝一层很淡的赭，让脸有起伏
    const blob = (dx, dy, r, col) => { const rg = g.createRadialGradient(X(dx), Y(dy), 1, X(dx), Y(dy), r * K); rg.addColorStop(0, col); rg.addColorStop(1, col.replace(/[\d.]+\)$/, '0)')); g.fillStyle = rg; g.fillRect(X(dx) - r * K, Y(dy) - r * K, r * 2 * K, r * 2 * K); };
    for (const sx of [-1, 1]) { blob(sx * 30, kid ? 112 : 110, kid ? 16 : 14, kid ? 'rgba(222,140,110,.38)' : 'rgba(212,150,120,.2)'); blob(sx * 22, 86, 9, 'rgba(170,130,95,.12)'); }
    g.lineCap = 'round'; g.lineJoin = 'round';
    const ink = 'rgba(30,26,22,.92)';
    g.strokeStyle = ink; g.fillStyle = ink;
    // 折线笔：点用角度给，二次曲线串起来
    const ln = (w, pts, sx = 1) => { g.lineWidth = w; g.beginPath(); g.moveTo(X(pts[0] * sx), Y(pts[1])); for (let i = 2; i < pts.length; i += 4) g.quadraticCurveTo(X(pts[i] * sx), Y(pts[i + 1]), X(pts[i + 2] * sx), Y(pts[i + 3])); g.stroke(); };
    const dot = (dx, dy, r) => { g.beginPath(); g.ellipse(X(dx), Y(dy), r * K, r * K * 1.1, 0, 0, 7); g.fill(); };
    for (const sx of [-1, 1]) {
      if (kid) {
        ln(3.4, [11, 84, 22, 79, 32, 82], sx);                         // 短圆眉
        ln(3.6, [11, 95, 22, 89, 33, 94], sx); dot(sx * 22, 94, 3.2);  // 圆眼、大瞳
      } else {
        ln(3.6, [8, 82, 24, 74, 43, 77], sx);                          // 长眉，眉梢上挑
        ln(3.8, [10, 93, 24, 87, 39, 90], sx);                         // 细长上眼线，外眼角上扬
        ln(2.2, [36, 90, 40, 89, 43, 86], sx);                         // 眼尾一挑
        dot(sx * 23, 92, 2.6);
        if (kind === 'elder') { g.globalAlpha = 0.45; ln(2, [13, 98, 24, 101, 36, 97], sx); ln(1.6, [30, 103, 36, 108, 42, 106], sx); g.globalAlpha = 1; }
      }
    }
    // 鼻：一笔鼻梁顺下，鼻底一勾，另一侧一点鼻翼
    if (kid) { ln(2.6, [3, 108, 6, 113, 0, 114]); dot(-5, 113, 1.1); }
    else { ln(2.6, [5, 94, 9, 108, 8, 113]); ln(2.8, [8, 113, 2, 118, -7, 114]); dot(-9, 112, 1.2); }
    // 口：一道短线，下唇一抹淡朱
    const my = kid ? 124 : 124, mw = kid ? 9 : 13;
    g.strokeStyle = 'rgba(176,84,64,.55)'; ln(5, [-mw * 0.6, my + 3, 0, my + 5, mw * 0.6, my + 3]);
    g.strokeStyle = ink; ln(kid ? 2.8 : 3, [-mw, my, 0, my + 2.5, mw, my]);
    if (kind === 'elder') {
      // 八字须垂过嘴角、下巴一撮（长髯另有立体的一绺）
      ln(3, [-3, 119, -15, 120, -22, 136]); ln(3, [3, 119, 15, 120, 22, 136]);
      g.globalAlpha = 0.85; for (let k = -2; k <= 2; k++) ln(2, [k * 3, 130, k * 3.6, 140, k * 4.4, 152]); g.globalAlpha = 1;
    } else if (kind === 'scholar') {
      g.globalAlpha = 0.7; ln(2.2, [-3, 119, -12, 120, -17, 129]); ln(2.2, [3, 119, 12, 120, 17, 129]); g.globalAlpha = 1;
    }
  });
  faceCache.set(key, t);
  return t;
}

// ---------- 坐具：豹皮、草席、蒲团 ----------
const matCache = new Map();
function seatMesh(kind) {
  if (kind === 'cushion') {
    const k = new Kit(); k.add(new THREE.CylinderGeometry(0.42, 0.45, 0.12, 20), COL.thatch, 3, M().setPosition(0, 0.06, 0.02));
    return k.geometry();
  }
  return null;
}
function seatTexture(kind) {
  if (matCache.has(kind)) return matCache.get(kind);
  const t = canvasTex(256, 192, (g, w, h) => {
    let s = kind === 'leopard' ? 31 : 17; const R = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    g.save(); g.beginPath();
    if (kind === 'leopard') { // 豹皮：不规则的兽皮外形，橘黄地，墨色环斑
      for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 2, r = 1 + 0.08 * Math.sin(a * 5) + 0.05 * Math.sin(a * 9 + 1); const x = w / 2 + Math.cos(a) * w * 0.46 * r, y = h / 2 + Math.sin(a) * h * 0.44 * r; i ? g.lineTo(x, y) : g.moveTo(x, y); }
      g.closePath(); g.fillStyle = '#c98a3b'; g.fill(); g.clip();
      const rg = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.5); rg.addColorStop(0, 'rgba(240,190,110,.35)'); rg.addColorStop(1, 'rgba(120,70,20,.35)'); g.fillStyle = rg; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 70; i++) { const x = R() * w, y = R() * h, r = 4 + R() * 5; g.strokeStyle = 'rgba(52,34,18,.85)'; g.lineWidth = 2.2; g.beginPath(); g.arc(x, y, r, R() * 2, R() * 2 + 4.6); g.stroke(); g.fillStyle = 'rgba(150,90,30,.6)'; g.beginPath(); g.arc(x, y, r * 0.45, 0, 7); g.fill(); }
      g.restore(); g.strokeStyle = 'rgba(60,40,20,.9)'; g.lineWidth = 2; g.stroke();
    } else { // 草席：浅草黄，横纹，深色包边
      g.rect(8, 8, w - 16, h - 16); g.fillStyle = '#cdb47e'; g.fill(); g.clip();
      for (let y = 10; y < h; y += 5) { g.strokeStyle = `rgba(120,95,50,${0.25 + R() * 0.2})`; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + (R() - 0.5) * 2); g.stroke(); }
      g.restore(); g.strokeStyle = '#6b5232'; g.lineWidth = 8; g.strokeRect(8, 8, w - 16, h - 16);
    }
  });
  matCache.set(kind, t); return t;
}

export class Figure {
  constructor(def) {
    this.def = def;
    const hat = def.hat || 'cap';
    const kid = hat === 'kid';
    const dress = def.dress || (kid ? 'short' : 'robe');
    this.dress = dress; this.hold = def.hold || null;
    const robe = C(def.robe), trim = C(def.trim || '#e9e0c8');
    const sash = C(def.sash || (dress === 'robe' ? '#33302c' : '#4a3d30'));
    const shade = robe.clone().multiplyScalar(0.94);
    const lining = robe.clone().multiplyScalar(0.72);
    const elder = def.beard ?? ((hat === 'cap' || hat === 'bun') && !kid && dress === 'robe');
    this.mat = flatMaterial();
    this.mat.uniforms.faceMap.value = faceTexture(kid ? 'kid' : elder ? 'elder' : dress === 'robe' ? 'scholar' : 'plain');
    this.root = new THREE.Group();
    this.body = new THREE.Group(); this.root.add(this.body);
    const ph = (def.id || '').length * 1.3 + (def.robe || '').charCodeAt(2) * 0.07;
    const W = 0.95; this.waistY = W;

    // —— 下身（站姿）——
    const lo = new Kit();
    if (dress === 'robe') {
      const prof = [[0.001, 0.012], [0.32, 0.012], [0.326, 0.05], [0.292, 0.22], [0.258, 0.45], [0.226, 0.7], [0.2, W]];
      lo.add(robeLathe(prof, { ph, trail: 0.07 }), shade, FOLD);
      // 右衽前襟：衣缘自腰直下到底摆
      // 前襟腰下只剩一道墨线（原画衣缘到腰为止）
      lo.add(tube([onSurf(prof, 0.84, -38, W - 0.03, 0.016, 0.07), onSurf(prof, 0.84, -34, 0.6, 0.02, 0.07), onSurf(prof, 0.84, -31, 0.25, 0.024, 0.07), onSurf(prof, 0.84, -30, 0.04, 0.024, 0.07)], 0.0055, 3, 12), INK);
      for (const sx of [-1, 1]) lo.add(new THREE.SphereGeometry(0.055, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), SHOE, 0, M().makeScale(0.85, 0.7, 1.6).setPosition(sx * 0.085, 0.0, 0.25));
    } else {
      const prof = [[0.001, 0.46], [0.245, 0.46], [0.252, 0.5], [0.226, 0.7], [0.2, W]];
      lo.add(robeLathe(prof, { ph, folds: 7, amp: 0.05 }), shade, FOLD_S);
      lo.add(tube([onSurf(prof, 0.84, -36, W - 0.03, 0.02), onSurf(prof, 0.84, -32, 0.6, 0.024), onSurf(prof, 0.84, -30, 0.48, 0.024)], 0.011, 4, 6), trim);
    }
    // 腰带与垂绦
    lo.add(new THREE.CylinderGeometry(0.207, 0.207, 0.055, 20, 1, true), sash, 0, M().makeScale(1, 1, 0.84).setPosition(0, W - 0.025, 0));
    const tl = dress === 'robe' ? 0.58 : 0.3;
    lo.add(tube([[0.05, W - 0.045, 0.175], [0.06, W - tl * 0.5, 0.205], [0.075, W - tl, 0.235]], 0.013, 4, 6), sash);
    lo.add(tube([[0.085, W - 0.045, 0.17], [0.1, W - tl * 0.45, 0.2], [0.118, W - tl * 0.85, 0.226]], 0.011, 4, 6), sash);
    if (def.routine === 'sweep') { // 干活的人（原画大觀廊扫地人）：腰下系一块粗布围裙；后腰垫一团，弯腰时上下身之间不露缝
      const ap = new THREE.CylinderGeometry(0.218, 0.278, 0.44, 16, 3, true, -0.95, 1.9), pa = ap.attributes.position;
      for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), y = pa.getY(i), f = 1 + 0.05 * Math.sin(Math.atan2(x, pa.getZ(i)) * 9) * (0.22 - y); pa.setX(i, x * f); pa.setZ(i, pa.getZ(i) * f); }
      ap.scale(1, 1, 0.86); ap.computeVertexNormals();
      lo.add(ap, C('#cfcbbb'), FOLD_S, M().setPosition(0, W - 0.25, 0));
      lo.add(new THREE.SphereGeometry(0.2, 16, 10), robe, 0, M().makeScale(1, 0.78, 0.84).setPosition(0, W + 0.02, -0.02));
    }
    this.lower = new THREE.Mesh(lo.geometry(), this.mat); this.body.add(this.lower);
    // 短衣的两条裤腿：白裤松垮，脚踝收口，黑鞋
    this.legs = [];
    if (dress === 'short') for (const sx of [-1, 1]) {
      const g = new THREE.Group(); g.position.set(sx * 0.085, 0.84, 0); this.body.add(g);
      const k = new Kit();
      k.add(robeLathe([[0.055, -0.78], [0.075, -0.7], [0.09, -0.45], [0.095, -0.15], [0.09, 0.02], [0.001, 0.03]], { seg: 10, folds: 3, amp: 0.08, squash: 1, ph: sx }), WHITE, FOLD_S);
      k.add(new THREE.SphereGeometry(0.055, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), SHOE, 0, M().makeScale(0.9, 0.75, 1.55).setPosition(0, -0.835, 0.04));
      g.add(new THREE.Mesh(k.geometry(), this.mat)); this.legs.push(g);
    }
    // —— 坐姿：袍摊在地上，盘腿成一团，膝头两处隆起 ——
    const lp = new Kit();
    {
      const g = robeLathe([[0.001, 0.012], [0.46, 0.012], [0.47, 0.05], [0.4, 0.15], [0.29, 0.25], [0.2, 0.31], [0.001, 0.32]], { seg: 32, folds: 11, amp: 0.08, squash: 1, ph });
      g.scale(1.28, 1, 0.92); g.translate(0, 0, 0.06);
      lp.add(g, dress === 'robe' ? shade : robe.clone().multiplyScalar(0.9), FOLD);
      for (const sx of [-1, 1]) lp.add(new THREE.SphereGeometry(0.15, 12, 8), dress === 'robe' ? shade : WHITE, 0, M().makeScale(1.3, 0.55, 1).setPosition(sx * 0.29, 0.16, 0.17));
      lp.add(new THREE.SphereGeometry(0.05, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), SHOE, 0, M().makeRotationY(-0.6).multiply(M().makeScale(0.85, 0.7, 1.5)).setPosition(0.14, 0.02, 0.42));
    }
    this.lap = new THREE.Mesh(lp.geometry(), this.mat); this.lap.visible = false; this.body.add(this.lap);
    // 坐具
    if (def.seat) {
      const sg = seatMesh(def.seat);
      if (sg) this.seat = new THREE.Mesh(sg, this.mat);
      else {
        const pg = new THREE.PlaneGeometry(1.75, 1.3); pg.rotateX(-Math.PI / 2);
        this.seat = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ map: seatTexture(def.seat), alphaTest: 0.5, transparent: false }));
        this.seat.position.set(0, 0.018, 0.05);
      }
      this.seat.visible = false; this.root.add(this.seat);
      this.seatH = def.seat === 'cushion' ? 0.11 : 0.006;
    }

    // —— 上身：溜肩、交领黑缘 ——
    this.torso = new THREE.Group(); this.torso.position.y = W; this.body.add(this.torso);
    const up = new Kit();
    const tprof = [[0.2, 0], [0.214, 0.14], [0.216, 0.27], [0.188, 0.36], [0.12, 0.42], [0.062, 0.448], [0.001, 0.455]];
    const SQ = 0.8;
    up.add(robeLathe(tprof, { seg: 24, folds: 6, amp: 0.02, squash: SQ, ph }), robe, FOLD_S);
    const band = (pts, w, off = 0.016) => up.add(strip(tprof, SQ, pts, w, off), trim);
    band([[64, 0.43], [110, 0.418], [150, 0.425], [180, 0.43], [-150, 0.425], [-110, 0.418], [-64, 0.43]], 0.05); // 后领
    band([[64, 0.43], [40, 0.39], [14, 0.335], [-16, 0.272], [-46, 0.215], [-76, 0.17]], dress === 'robe' ? 0.062 : 0.05); // 外襟
    band([[-64, 0.43], [-40, 0.395], [-16, 0.355]], 0.045, 0.011); // 内襟
    up.add(new THREE.CylinderGeometry(0.042, 0.047, 0.1, 10), SKIN, 0, M().setPosition(0, 0.48, 0.005));
    this.upper = new THREE.Mesh(up.geometry(), this.mat); this.torso.add(this.upper);

    // —— 头：脸贴墨线五官，头发、冠巾、胡须 ——
    this.head = new THREE.Group(); this.head.position.set(0, 0.515, 0.012); this.torso.add(this.head);
    if (kid) this.head.scale.setScalar(1.32);
    this.headTilt = dress === 'robe' && !kid ? 0.08 : 0; this.head.rotation.x = this.headTilt;
    const hk = new Kit();
    const face = new THREE.SphereGeometry(0.112, 32, 22), fp = face.attributes.position;
    for (let i = 0; i < fp.count; i++) { // 鹅蛋脸：下半收窄成下巴，后脑略平
      const yn = fp.getY(i) / 0.112, lo = Math.pow(Math.max(0, -yn), 1.6);
      fp.setX(i, fp.getX(i) * (1 - 0.3 * lo)); fp.setZ(i, fp.getZ(i) * (fp.getZ(i) < 0 ? 0.9 : 1 - 0.08 * lo));
    }
    face.computeVertexNormals();
    hk.add(face, SKIN, FACE, M().makeScale(0.9, 1.1, 0.98).setPosition(0, 0.115, 0));
    for (const sx of [-1, 1]) hk.add(new THREE.SphereGeometry(0.024, 6, 5), SKIN, 0, M().makeScale(0.55, 1.35, 1).setPosition(sx * 0.098, 0.11, -0.008));
    // 头发：头顶一整片，脑后与两鬓再往下包到耳际，前额留出脸
    const hairTop = (r, th, col = HAIR) => hk.add(new THREE.SphereGeometry(r, 18, 8, 0, Math.PI * 2, 0, th), col, 0, M().makeScale(0.92, 1.1, 1).setPosition(0, 0.118, -0.004));
    const hairBack = (r, th0, th1, open, col = HAIR) => hk.add(new THREE.SphereGeometry(r, 18, 6, Math.PI / 2 + open, Math.PI * 2 - open * 2, th0, th1 - th0), col, 0, M().makeScale(0.92, 1.1, 1).setPosition(0, 0.118, -0.004));
    if (hat !== 'bald') { hairTop(0.115, kid ? 1.12 : 0.95); hairBack(0.115, kid ? 1.12 : 0.95, kid ? 1.8 : 1.5, kid ? 1.15 : 1.3); }
    else hairTop(0.114, 0.9, SKIN.clone().multiplyScalar(0.93));
    if (elder && dress === 'robe') { // 三绺长髯垂到胸前
      const beard = new THREE.ConeGeometry(0.022, 0.17, 7, 3); beard.rotateX(Math.PI); beard.scale(1, 1, 0.3);
      hk.add(beard, HAIR, 0, M().makeRotationX(-0.38).setPosition(0, -0.06, 0.1));
      for (const sx of [-1, 1]) { const w = new THREE.ConeGeometry(0.011, 0.12, 5, 2); w.rotateX(Math.PI); w.scale(1, 1, 0.4); hk.add(w, HAIR, 0, M().makeRotationFromEuler(new THREE.Euler(-0.3, 0, sx * 0.12)).setPosition(sx * 0.032, -0.03, 0.085)); }
    }
    if (hat === 'cap') { // 东坡巾：内为方筒高巾，外罩一圈转了 45° 的矮巾，脑后垂两条巾带
      const inner = new THREE.CylinderGeometry(0.118, 0.112, 0.17, 4, 1); inner.rotateY(Math.PI / 4);
      hk.add(inner, INK, 0, M().setPosition(0, 0.25, -0.008));
      hk.add(new THREE.CylinderGeometry(0.13, 0.126, 0.09, 4, 1), INK, 0, M().setPosition(0, 0.208, -0.008));
      for (const sx of [-1, 1]) hk.add(tube([[sx * 0.03, 0.2, -0.105], [sx * 0.05, 0.08, -0.14], [sx * 0.06, -0.06, -0.15]], 0.011, 4, 6), INK);
    } else if (hat === 'scarf') { // 幅巾：软巾裹头，脑后打结垂尾
      const sc = C('#3b4447');
      hk.add(new THREE.SphereGeometry(0.128, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.33), sc, 0, M().makeScale(0.94, 1.12, 1.03).setPosition(0, 0.125, -0.008));
      hk.add(new THREE.SphereGeometry(0.128, 16, 6, Math.PI / 2 + 1.2, Math.PI * 2 - 2.4, Math.PI * 0.33, Math.PI * 0.22), sc, 0, M().makeScale(0.94, 1.12, 1.03).setPosition(0, 0.125, -0.008));
      hk.add(new THREE.SphereGeometry(0.045, 8, 6), sc, 0, M().setPosition(0, 0.2, -0.11));
      hk.add(tube([[0, 0.19, -0.13], [0.01, 0.06, -0.16], [0.03, -0.08, -0.17]], 0.026, 5, 6), sc);
    } else if (hat === 'bun') { // 小冠束髻，横插一簪
      hk.add(new THREE.SphereGeometry(0.046, 10, 8), HAIR, 0, M().makeScale(1, 0.9, 1).setPosition(0, 0.258, -0.012));
      hk.add(new THREE.CylinderGeometry(0.036, 0.042, 0.05, 10, 1), C('#3a3530'), 0, M().setPosition(0, 0.27, -0.012));
      hk.add(new THREE.CylinderGeometry(0.005, 0.005, 0.17, 4), C('#c8b27a'), 0, M().makeRotationZ(Math.PI / 2).setPosition(0, 0.272, -0.012));
    } else if (kid) { // 齐眉短发：额前一排刘海
      hk.add(new THREE.CylinderGeometry(0.104, 0.108, 0.035, 18, 1, true, -1.1, 2.2), HAIR, 0, M().setPosition(0, 0.183, 0.012));
    }
    this.headMesh = new THREE.Mesh(hk.geometry(), this.mat); this.head.add(this.headMesh);

    // —— 宽袖：上臂、小臂两段（肘只往前弯），袖口最宽，一圈衣缘；文士袖下再坠一只袖袋 ——
    this.arms = []; this.hands = [];
    const sR = dress === 'robe' ? 0.15 : 0.105, sL = dress === 'robe' ? 0.6 : 0.52;
    const uL = dress === 'robe' ? 0.27 : 0.25, fL = sL - uL;
    this.armLen = sL;
    for (const s of [-1, 1]) {
      const g = new THREE.Group(); g.position.set(s * 0.172, 0.335, 0); this.torso.add(g);
      const k = new Kit();
      const upProf = dress === 'robe' ? [[0.104, -uL - 0.03], [0.094, -0.2], [0.072, -0.07], [0.055, 0.03]] : [[0.08, -uL - 0.03], [0.074, -0.12], [0.06, 0.03]];
      k.add(robeLathe(upProf, { seg: 14, folds: 3, amp: 0.06, squash: 0.86, ph: s + ph }), robe, FOLD_S);
      k.add(new THREE.SphereGeometry(dress === 'robe' ? 0.098 : 0.076, 12, 8), robe, 0, M().makeScale(1, 1, 0.86).setPosition(0, -uL, 0)); // 肘：两段袖子在这里接上
      g.add(new THREE.Mesh(k.geometry(), this.mat));
      const fa = new THREE.Group(); fa.position.y = -uL; fa.rotation.order = 'YXZ'; g.add(fa); g.userData.fa = fa;
      const kf = new Kit();
      const foProf = dress === 'robe'
        ? [[sR, -fL], [sR * 0.97, -fL * 0.72], [sR * 0.85, -fL * 0.42], [0.11, -0.05], [0.1, 0.03]] // 广袖：越往下越宽，袖口最宽
        : [[sR, -fL], [sR * 0.95, -fL * 0.6], [0.078, 0.03]];
      kf.add(robeLathe(foProf, { seg: 16, folds: 4, amp: 0.1, squash: 0.86, ph: s + ph }), robe, FOLD_S);
      const cw = dress === 'robe' ? 0.05 : 0.035; // 袖口扁平衣缘，跟着袖褶起伏
      kf.add(robeLathe([[sR * 1.02, -fL - 0.002], [sR * 1.015, -fL + cw]], { seg: 16, folds: 4, amp: 0.1, squash: 0.86, ph: s + ph, tFix: 0.97 }), trim);
      const hole = new THREE.CircleGeometry(sR * 0.94, 16); hole.rotateX(Math.PI / 2); hole.scale(1, 1, 0.86);
      kf.add(hole, lining, 0, M().setPosition(0, -fL + 0.012, 0));
      kf.add(new THREE.SphereGeometry(0.034, 8, 6), SKIN, 0, M().makeScale(0.75, 1.2, 0.95).setPosition(0, -fL - 0.008, 0.012));
      fa.add(new THREE.Mesh(kf.geometry(), this.mat));
      if (dress === 'robe') { // 袂：广袖下垂的袖袋，始终朝下坠；拱手时挂在小臂下面，是原画文士最醒目的轮廓
        const pk = new THREE.Group(); pk.position.set(0, -fL * 0.32, -0.005); fa.add(pk);
        const bag = robeLathe([[0.001, -0.25], [0.05, -0.245], [0.1, -0.2], [0.125, -0.125], [0.12, -0.04], [0.09, 0.04], [0.001, 0.06]], { seg: 14, folds: 3, amp: 0.12, squash: 1, ph: s * 2 + ph });
        bag.scale(0.42, 1, 1.12);
        const pkk = new Kit(); pkk.add(bag, robe, FOLD_S);
        pk.add(new THREE.Mesh(pkk.geometry(), this.mat)); g.userData.pocket = pk;
      }
      this.arms.push(g); this.hands.push(fa);
    }
    this.handY = -fL;
    // —— 手中物 ——
    if (this.hold === 'staff') { // 藤杖，握在右手
      const k = new Kit(); k.add(tube([[0, 0.2, 0], [0.02, -0.3, 0.02], [-0.01, -0.8, 0.03], [0.01, -1.15, 0.05]], 0.016, 5, 10), C('#5b4330'));
      k.add(new THREE.SphereGeometry(0.03, 6, 5), C('#5b4330'), 0, M().setPosition(0, 0.21, 0));
      this.staff = new THREE.Mesh(k.geometry(), this.mat); this.staff.position.set(0, -fL - 0.03, 0.03); this.hands[0].add(this.staff);
    } else if (this.hold === 'box') { // 朱漆食盒
      const k = new Kit(); k.box(0.28, 0.2, 0.2, 0, -0.1, 0, C('#b5432f')); k.box(0.29, 0.02, 0.21, 0, -0.03, 0, C('#3a2a22')); k.box(0.29, 0.02, 0.21, 0, 0.06, 0, C('#3a2a22'));
      this.prop = new THREE.Mesh(k.geometry(), this.mat); this.prop.position.set(0, 0.16, 0.3); this.torso.add(this.prop);
    } else if (this.hold === 'scroll') { // 手卷
      const k = new Kit(); k.add(new THREE.CylinderGeometry(0.03, 0.03, 0.34, 10), C('#e8dcc0'), 0, M().makeRotationZ(Math.PI / 2));
      for (const sx of [-1, 1]) k.add(new THREE.CylinderGeometry(0.018, 0.018, 0.04, 8), C('#5a3e2c'), 0, M().makeRotationZ(Math.PI / 2).setPosition(sx * 0.19, 0, 0));
      this.prop = new THREE.Mesh(k.geometry(), this.mat); this.prop.position.set(0, 0.2, 0.3); this.torso.add(this.prop);
    } else if (this.hold === 'basket') { // 竹提篮，挂在左手
      const k = new Kit(); k.add(new THREE.CylinderGeometry(0.1, 0.075, 0.12, 12, 1), COL.thatch, 3, M().setPosition(0, -0.2, 0));
      k.add(new THREE.TorusGeometry(0.08, 0.008, 4, 12, Math.PI), C('#6b5232'), 0, M().setPosition(0, -0.14, 0));
      this.prop = new THREE.Mesh(k.geometry(), this.mat); this.prop.position.set(0, -fL, 0.02); this.hands[1].add(this.prop);
    }
    if (def.carry) { // 扁担两头挑着竹篓
      const k = new Kit();
      k.box(0.04, 0.04, 1.7, 0, 0, 0, COL.wood);
      for (const z of [-0.8, 0.8]) { k.cyl(0.005, 0.005, 0.5, 0, -0.5, z, COL.wood, 3); k.cyl(0.15, 0.2, 0.3, 0, -0.75, z, COL.thatch, 8); }
      const pole = new THREE.Mesh(k.geometry(), this.mat); pole.position.set(0.1, 0.44, 0); this.torso.add(pole);
      this.pole = pole;
    }
    if (def.routine === 'sweep') { // 竹扫帚：带节的竹竿，两道绑绳，一大把散开的细竹枝；原点在竿顶，竿往 -y
      const k = new Kit(), BAM = C('#b39a5f'), TW = [C('#8d7647'), C('#a08a55'), C('#7a663f')], L0 = 1.0;
      let sd = 11; const R = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
      k.add(new THREE.CylinderGeometry(0.016, 0.019, L0 + 0.06, 8), BAM, 0, M().setPosition(0, -(L0 + 0.06) / 2, 0));
      for (let y = 0.2; y < L0; y += 0.27) k.add(new THREE.CylinderGeometry(0.021, 0.021, 0.014, 8), BAM.clone().multiplyScalar(0.78), 0, M().setPosition(0, -y, 0));
      for (const y of [L0 - 0.03, L0 + 0.08]) k.add(new THREE.CylinderGeometry(0.036, 0.036, 0.045, 8), C('#4a3a28'), 0, M().setPosition(0, -y, 0));
      const core = new THREE.ConeGeometry(0.17, 0.34, 12, 1, true); core.scale(1, 1, 0.22); k.add(core, TW[0], 0, M().setPosition(0, -L0 - 0.23, 0));
      for (let i = 0; i < 28; i++) {
        const u = (i + 0.5) / 28 - 0.5, tz = (R() - 0.5) * 0.07 + 0.035;
        k.add(tube([[u * 0.05, -L0 - 0.07, 0], [u * 0.24 + (R() - 0.5) * 0.03, -L0 - 0.26, tz * 0.4], [u * 0.52 + (R() - 0.5) * 0.04, -BROOM_L + R() * 0.06, tz]], 0.0045, 3, 5), TW[i % 3]);
      }
      const g = k.geometry();
      this.broomS = new THREE.Mesh(g, this.mat); this.broomS.matrixAutoUpdate = false; this.root.add(this.broomS); // 扫地时：竿顶在右胸前，帚头贴着身前左下方的地来回扫
      this.broom = new THREE.Mesh(g, this.mat); this.broom.position.set(0, -fL - 0.03, 0.03); this.broom.rotation.x = 2.75; this.hands[1].add(this.broom); // 走动时扛在手里
    }
    this.uL = uL; this.fL = fL;
    // 点选用的代理体
    this.proxy = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 2, 6), new THREE.MeshBasicMaterial({ visible: false }));
    this.proxy.position.y = 1; this.proxy.userData.fig = this; this.root.add(this.proxy);
    const sc = def.scale || 1; this.root.scale.setScalar(sc);
    this.root.rotation.y = def.face || 0;
    this.heading = this.root.rotation.y;
    this.phase = Math.random() * 10;
    this.pose = def.routine === 'sit' || def.routine === 'meditate' ? 'sit' : def.routine === 'lean' ? 'lean' : 'idle';
    this.action = null; // {type, t, dur}
    this.speed = 0; this.look = null; this.hl = 0;
    this.blend = { sit: this.pose === 'sit' ? 1 : 0, bow: 0, lean: this.pose === 'lean' ? 1 : 0, talk: 0, sweep: def.routine === 'sweep' ? 1 : 0, still: 1 };
  }

  play(type, dur = 2.2) { this.action = { type, t: 0, dur }; }

  update(dt, time) {
    const B = this.blend, a = this.action;
    if (a) { a.t += dt; if (a.t > a.dur) this.action = null; }
    const act = (type) => (this.action && this.action.type === type ? Math.min(1, this.action.t / 0.4, (this.action.dur - this.action.t) / 0.4) : 0);
    const ease = (cur, tgt, k) => cur + (tgt - cur) * Math.min(1, dt * k);
    B.sit = ease(B.sit, this.pose === 'sit' ? 1 : 0, 4);
    B.lean = ease(B.lean, this.pose === 'lean' ? 1 : 0, 4);
    B.bow = ease(B.bow, act('bow'), 10);
    B.talk = ease(B.talk, act('talk') + (this.pose === 'talking' ? 1 : 0), 6);
    const walking = this.speed > 0.05;
    if (walking) this.phase += dt * (3 + this.speed * 2.6);
    const w = walking ? Math.min(1, this.speed / 1.2) : 0;
    B.still = ease(B.still, walking ? 0 : 1, 5);
    const sw = Math.sin(this.phase);
    // 站 / 坐：坐下时换成摊在地上的袍子，上身落到袍上
    const seated = B.sit > 0.5;
    this.lower.visible = !seated; this.lap.visible = seated;
    for (const l of this.legs) l.visible = !seated;
    if (this.seat) this.seat.visible = seated;
    this.body.position.y = Math.abs(sw) * 0.025 * w + (this.seatH || 0) * B.sit;
    this.lower.rotation.z = sw * 0.04 * w;
    const swp = B.sweep; // 扫地：两脚一前一后叉开，身子压低
    const sweepK = this.def.routine === 'sweep' && !walking && this.pose === 'idle' && !this.controlled ? 1 : 0;
    B.sweep = ease(B.sweep, sweepK, 3);
    this.legs.forEach((l, i) => { l.rotation.x = (i ? -1 : 1) * sw * 0.5 * w + swp * (i ? -0.22 : 0.26); l.rotation.z = swp * (i ? 0.07 : -0.07); });
    this.body.position.y -= 0.03 * swp;
    this.torso.position.y = this.waistY + (0.3 - this.waistY) * B.sit;

    const stoop = this.dress === 'robe' ? 0.05 : 0.02;
    const s2 = Math.sin(time * 2.2 + this.phase); // 扫地的节拍
    this.torso.rotation.x = stoop + 0.5 * B.bow + 0.22 * B.lean + (1.08 + 0.05 * s2) * swp + Math.sin(time * 1.3 + this.phase) * 0.01; // 原画：腰弯得几乎平，头往前探
    this.torso.rotation.y = 0.12 * s2 * swp;
    // 手臂：每只手臂一个前举角 x 和一个向内收的角 inward
    const [Rt, Lt] = this.arms; // arms[0] 在身体右侧（-x），arms[1] 在左侧（+x）
    const swing = sw * 0.3 * w;
    const breathe = Math.sin(time * 1.6 + this.phase) * 0.02;
    // 文士静立时拱手藏袖于腹前；童仆垂手
    const clasp = (this.dress === 'robe' && !this.hold ? 1 : 0.15) * B.still * (1 - B.sit);
    let rx = -swing + breathe, lx = swing + breathe, ri = -0.08, li = -0.08;
    rx += (-0.7 - rx) * clasp; lx += (-0.7 - lx) * clasp; ri += (0.62 - ri) * clasp; li += (0.62 - li) * clasp;
    if (this.hold === 'box' || this.hold === 'scroll') { const k = 1 - B.bow; rx += (-0.95 - rx) * k; lx += (-0.95 - lx) * k; ri += (0.42 - ri) * k; li += (0.42 - li) * k; }
    if (this.hold === 'staff') { rx += (-0.32 - rx) * (1 - B.sit); ri += (-0.02 - ri) * (1 - B.sit); }
    // 坐：手搭在膝上；打坐：两手合于腹前
    const med = this.def.routine === 'meditate' ? 1 : 0;
    rx += (-0.42 - 0.1 * med - rx) * B.sit; lx += (-0.42 - 0.1 * med - lx) * B.sit;
    ri += (0.2 + 0.32 * med - ri) * B.sit; li += (0.2 + 0.32 * med - li) * B.sit;
    // 凭栏
    rx += (-0.95 - rx) * B.lean; lx += (-0.95 - lx) * B.lean;
    // 作揖：两袖举到胸前合拢
    rx += (-1.0 - rx) * B.bow; lx += (-1.0 - lx) * B.bow; ri += (0.68 - ri) * B.bow; li += (0.68 - li) * B.bow;
    // 交谈：右手抬起比划
    rx += (-0.95 + Math.sin(time * 4 + this.phase) * 0.25 - rx) * B.talk; ri += (0.15 - ri) * B.talk;
    if (this.pole) { lx = -2.6 * (1 - B.bow) + lx * B.bow; this.pole.visible = B.bow < 0.5; }
    if (this.prop) this.prop.visible = B.bow < 0.5 || this.hold === 'basket';
    // 整臂前举角换算成上臂 + 小臂：上臂只跟一点，主要靠肘往前弯；向内收靠小臂横摆，双手才能在腹前合拢
    const setArm = (A, x, inw, s) => {
      const fa = A.userData.fa, ru = x >= 0 ? x : x * 0.35, re = (x >= 0 ? 0 : x * 0.85) - 0.12;
      A.rotation.x = ru; A.rotation.z = -s * (inw * 0.12 - 0.05); fa.rotation.x = re; fa.rotation.y = -s * inw;
      return ru + re;
    };
    const rT = setArm(Rt, rx, ri, -1), lT = setArm(Lt, lx, li, 1);
    if (this.broomS) { // 双手握帚：竿顶在右胸前，帚头在身前偏左的地上左右扫；两只手按竿上的两点解 IK
      const on = swp > 0.5; this.broomS.visible = on; this.broom.visible = !on;
      if (swp > 0.01) {
        _T.set(-0.12 - 0.06 * s2, 0.97, 0.32); _G.set(0.3 + 0.3 * s2, 0.03, 1.02 - 0.08 * s2 * s2);
        const L = _D.subVectors(_G, _T).length(); _D.multiplyScalar(1 / L);
        _Y.copy(_D).negate().multiplyScalar(L / BROOM_L); _X.set(_D.z, 0, -_D.x).normalize(); _Z.crossVectors(_X, _D.clone().negate());
        this.broomS.matrix.makeBasis(_X, _Y, _Z).setPosition(_T);
        this.body.updateMatrix(); this.torso.updateMatrix(); _m.multiplyMatrices(this.body.matrix, this.torso.matrix).invert();
        reachArm(Rt, _H.copy(_T).addScaledVector(_D, 0.1).applyMatrix4(_m), this.uL, this.fL + 0.01, swp);
        reachArm(Lt, _H.copy(_T).addScaledVector(_D, 0.4).applyMatrix4(_m), this.uL, this.fL + 0.01, swp);
      }
    }
    this.head.rotation.x = this.headTilt - 0.5 * swp; // 弯着腰，眼睛看着帚头
    if (this.pole && B.bow < 0.5) { Lt.rotation.x = -0.6; Lt.userData.fa.rotation.x = -2.1; Lt.userData.fa.rotation.y = 0; } // 一手扶肩上的扁担
    // 袖袋抵消肩、身的转角，保持下坠
    for (const A of this.arms) { // 袖袋抵消身、肩、肘的转角，始终下坠；小臂抬得越平，坠得越长
      const pk = A.userData.pocket; if (!pk) continue;
      _q.copy(this.torso.quaternion).multiply(A.quaternion).multiply(A.userData.fa.quaternion);
      _v.set(0, -1, 0).applyQuaternion(_q); const lift = Math.acos(Math.min(1, Math.max(-1, -_v.y)));
      pk.quaternion.copy(_q).invert(); pk.scale.y = 0.7 + 0.9 * Math.min(1, Math.max(0, (lift - 0.3) / 0.9));
    }
    // 手杖、提篮保持竖直
    if (this.staff) this.staff.rotation.x = -(rT + this.torso.rotation.x) + 0.06;
    if (this.prop && this.hold === 'basket') this.prop.rotation.x = -(lT + this.torso.rotation.x);
    // 转头看人
    let yaw = 0;
    if (this.look) {
      const p = this.root.position, ang = Math.atan2(this.look.x - p.x, this.look.z - p.z) - this.root.rotation.y;
      yaw = Math.atan2(Math.sin(ang), Math.cos(ang)); yaw = Math.max(-1.0, Math.min(1.0, yaw));
    }
    this.head.rotation.y = ease(this.head.rotation.y, yaw * 0.8, 5);
    this.upper.rotation.y = ease(this.upper.rotation.y, yaw * 0.15, 5);
    // 朝向
    let d = this.heading - this.root.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
    this.root.rotation.y += d * Math.min(1, dt * 8);
    // 高亮
    this.mat.uniforms.highlight.value = ease(this.mat.uniforms.highlight.value, this.hl, 10);
    this.mat.uniforms.time.value = time;
  }
}

// 仙鹤
export class Crane {
  constructor(x, z) {
    this.mat = flatMaterial();
    const k = new Kit(), W = new THREE.Color('#f1ece0'), K = new THREE.Color('#2a2826');
    k.add(new THREE.SphereGeometry(0.28, 10, 8), W, 0, new THREE.Matrix4().makeScale(1.6, 0.9, 0.9).setPosition(0, 1.0, 0));
    k.add(new THREE.ConeGeometry(0.16, 0.45, 6), K, 0, new THREE.Matrix4().makeRotationZ(1.9).setPosition(-0.5, 1.02, 0));
    k.add(new THREE.CylinderGeometry(0.04, 0.06, 0.7, 6), K, 0, new THREE.Matrix4().makeRotationZ(-0.35).setPosition(0.48, 1.38, 0));
    k.add(new THREE.SphereGeometry(0.07, 8, 6), W, 0, new THREE.Matrix4().setPosition(0.6, 1.72, 0));
    k.add(new THREE.SphereGeometry(0.035, 6, 5), new THREE.Color('#c23b2a'), 0, new THREE.Matrix4().setPosition(0.6, 1.79, 0));
    k.add(new THREE.ConeGeometry(0.025, 0.24, 5), new THREE.Color('#7a6a4a'), 0, new THREE.Matrix4().makeRotationZ(-1.57).setPosition(0.75, 1.7, 0));
    for (const z of [-0.08, 0.08]) k.add(new THREE.CylinderGeometry(0.015, 0.015, 0.8, 4), K, 0, new THREE.Matrix4().setPosition(0, 0.4, z));
    this.root = new THREE.Group();
    this.bird = new THREE.Mesh(k.geometry(), this.mat); this.root.add(this.bird);
    const wk = new Kit(); wk.add(new THREE.BoxGeometry(1.1, 0.02, 0.45), W, 0, new THREE.Matrix4().setPosition(0, 0, 0.3));
    wk.add(new THREE.BoxGeometry(0.4, 0.025, 0.46), K, 0, new THREE.Matrix4().setPosition(-0.4, 0.005, 0.3));
    this.wings = [1, -1].map((s) => { const m = new THREE.Mesh(wk.geometry(), this.mat); m.position.set(0, 1.1, 0); m.scale.z = s; m.visible = false; this.root.add(m); return m; });
    this.home = new THREE.Vector3(x, 0, z); this.root.position.set(x, 0, z);
    this.t = Math.random() * 10; this.fly = -1;
  }
  startle() { if (this.fly < 0) this.fly = 0; }
  update(dt, ground) {
    this.t += dt;
    if (this.fly >= 0) {
      this.fly += dt; const T = 9, f = this.fly / T;
      const a = f * Math.PI * 2, R = 9, h = Math.sin(f * Math.PI) * 10;
      this.root.position.set(this.home.x + Math.sin(a) * R, ground(this.home.x, this.home.z) + h, this.home.z - R + Math.cos(a) * R);
      this.root.rotation.y = -a + Math.PI;
      this.wings.forEach((m, i) => { m.visible = true; m.rotation.x = (i ? -1 : 1) * Math.sin(this.t * 9) * 0.6; });
      if (this.fly > T) { this.fly = -1; this.wings.forEach((m) => (m.visible = false)); }
    } else {
      const x = this.home.x + Math.sin(this.t * 0.13) * 2.5, z = this.home.z + Math.cos(this.t * 0.11) * 1.8;
      this.root.position.set(x, ground(x, z), z);
      this.root.rotation.y = Math.atan2(Math.cos(this.t * 0.13) * 0.33, -Math.sin(this.t * 0.11) * 0.2) - Math.PI / 2;
      this.bird.rotation.z = Math.max(0, Math.sin(this.t * 0.7)) * -0.5;
    }
  }
}
