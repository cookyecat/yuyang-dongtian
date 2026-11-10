// v43 署名与题名壁：作者的跋（常驻朱印点开）、卷尾峡谷尽头的摩崖题刻、峡谷北壁的「题名壁」（游人到此一游）、峡口写生的画师。
// 卷尾四陽洞左边是一道死胡同似的窄峡（z 1.5–6.5 平地，x 到 -347 为止，两侧陡崖），作者的题刻刻在峡底正对来路的崖面上，
// 游人题名刻在北壁上，画师坐在南侧铺纸写生。题名的数据存在 Cloudflare Worker（见 guestbook/），地址写在 index.html 的 <meta name="yy-guestbook">。
import * as THREE from 'three';

export const AUTHOR = {
  cn: '李揚', en: 'YANG LI', partner: 'Claude',
  github: 'https://github.com/cookyecat', ghName: 'cookyecat',
  x: 'https://x.com/myannli', xName: '@myannli',
  date: '丙午初冬',
};
// 卷尾峡谷：题刻、题名壁、画师的位置
export const END = {
  moya: { x: -346.7, z: 4.0, w: 5.6, h: 6.4, ry: Math.PI / 2 },   // 峡底正对来路
  wall: { x: -337.6, z: 1.35, w: 8.6, h: 3.9, ry: 0.04 },         // 北壁，朝南（略朝东，迎着走来的人）
  painter: { x: -338.6, z: 5.55, face: -Math.PI / 2 - 0.25 },     // 南侧，面朝峡底的题刻
  view: { pos: [-325.5, 9.6, 5.2], at: [-344, 8.2, 3.2], fov: 50 },
};
const BRUSH = '"Ma Shan Zheng","STKaiti","KaiTi","Kaiti SC",serif';
const SIG = '"YY Sig","Kaiti TC","BiauKai","KaiTi",serif'; // 落款、印章（繁体「李揚」，马善政体没有这个字）
const KAI = '"STKaiti","KaiTi","Kaiti SC","Ma Shan Zheng",serif'; // 游人的名字什么字都有，先用系统楷体
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- 干支纪年 ----------
const GAN = '甲乙丙丁戊己庚辛壬癸', ZHI = '子丑寅卯辰巳午未申酉戌亥', NUM = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
export function ganzhiDate(ts) {
  const d = new Date(ts), y = d.getFullYear();
  return GAN[(y - 4) % 10] + ZHI[(y - 4) % 12] + '年' + NUM[d.getMonth() + 1] + '月';
}

// ---------- 题名壁后端 ----------
function apiBase() {
  const q = new URLSearchParams(location.search).get('gb');
  if (q) return q.replace(/\/$/, '');
  const m = document.querySelector('meta[name="yy-guestbook"]');
  return (m && m.content.trim().replace(/\/$/, '')) || '';
}
const API = apiBase();
async function fetchNames(limit = 80) {
  if (!API) return null;
  const r = await fetch(`${API}/api/names?limit=${limit}`, { mode: 'cors' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
async function postName(body) {
  const r = await fetch(`${API}/api/names`, { method: 'POST', mode: 'cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  let j = {}; try { j = await r.json(); } catch (e) {}
  if (!r.ok) throw new Error(j.error || '题壁没有成功，稍后再试');
  return j;
}

// ---------- 刻字画布 ----------
// 阴刻：先在右下方压一道浅色（刀口受光），再填墨
function carve(g, ch, x, y, size, ink = 'rgba(38,33,26,.9)') {
  g.fillStyle = 'rgba(250,244,226,.32)'; g.fillText(ch, x + size * 0.035, y + size * 0.035);
  g.fillStyle = ink; g.fillText(ch, x, y);
}
// 竖排一列，西文词旋转 90°
function vline(g, text, x, y, size, font, ink, gap = 1.04) {
  const parts = text.match(/[A-Za-z0-9@._-]+|./gu) || [];
  let yy = y; g.textAlign = 'center'; g.textBaseline = 'top';
  for (const p of parts) {
    if (p === ' ') { yy += size * 0.45; continue; }
    if (/^[A-Za-z0-9@._-]+$/.test(p)) {
      g.font = `${size * 0.82}px ${font}`; const w = g.measureText(p).width;
      g.save(); g.translate(x, yy + w / 2 + size * 0.08); g.rotate(Math.PI / 2); g.textBaseline = 'middle';
      carve(g, p, 0, 0, size * 0.82, ink); g.restore(); g.textBaseline = 'top';
      yy += w + size * 0.22; continue;
    }
    g.font = `${size}px ${font}`; carve(g, p, x, yy, size, ink); yy += size * gap;
  }
  return yy;
}
function sealOn(g, x, y, s, text, { white = true } = {}) { // 方印：白文（红底镂字）或朱文
  const c = document.createElement('canvas'); c.width = c.height = Math.ceil(s);
  const q = c.getContext('2d');
  q.fillStyle = '#b23a26';
  if (white) { q.fillRect(0, 0, s, s); q.globalCompositeOperation = 'destination-out'; }
  else { q.lineWidth = s * 0.07; q.strokeStyle = '#b23a26'; q.strokeRect(s * 0.05, s * 0.05, s * 0.9, s * 0.9); }
  const chars = [...text], n = chars.length, fs = n <= 2 ? s * 0.62 : s * 0.42;
  q.font = `${fs}px ${SIG}`; q.textAlign = 'center'; q.textBaseline = 'middle';
  const pos = n <= 2 ? [[0.5, 0.29], [0.5, 0.72]] : [[0.73, 0.28], [0.73, 0.72], [0.27, 0.28], [0.27, 0.72]]; // 两字上下，四字右起竖读
  chars.forEach((ch, i) => q.fillText(ch, pos[i][0] * s, pos[i][1] * s));
  if (white) { // 印边磨损：随手啃掉几处
    q.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 14; i++) { q.beginPath(); const a = Math.random() * 4, t = Math.random(); const px = a < 1 ? t * s : a < 2 ? s : a < 3 ? t * s : 0, py = a < 1 ? 0 : a < 2 ? t * s : a < 3 ? s : t * s; q.arc(px, py, s * (0.01 + Math.random() * 0.03), 0, 7); q.fill(); }
  }
  g.globalAlpha = 0.88; g.drawImage(c, x, y); g.globalAlpha = 1;
}

function inscriptionTexture() { // 峡底摩崖：作者题记
  const W = 1024, H = 1170, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  // 题刻范围略微磨平：一块浅一点的方框
  g.fillStyle = 'rgba(232,224,200,.18)'; g.fillRect(60, 50, W - 120, H - 100);
  g.strokeStyle = 'rgba(40,34,26,.35)'; g.lineWidth = 3; g.strokeRect(74, 64, W - 148, H - 128);
  // 右起：大字题名，再小字题记，最后落款和印
  let x = W - 190;
  vline(g, '玉阳洞天', x, 110, 168, BRUSH, 'rgba(34,30,24,.92)', 1.08);
  const body = ['旧传仇英玉阳洞天图卷', '据展厅所摄十三帧起稿', '一山一石一屋一人', '皆依原画筑于三维', '画外未尽处以意补之', '可行可望可游可居'];
  x -= 160;
  for (const t of body) { vline(g, t, x, 130, 64, BRUSH, 'rgba(34,30,24,.88)'); x -= 92; }
  x -= 18;
  const yEnd = vline(g, `${AUTHOR.date} ${AUTHOR.cn}與${AUTHOR.partner}同製`, x, 260, 56, SIG, 'rgba(34,30,24,.88)');
  sealOn(g, x - 46, Math.min(yEnd + 14, H - 190), 92, AUTHOR.cn);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 8; return t;
}

function wallTexture(items) { // 北壁题名：右起，大字「题名壁」，之后每人一列
  const W = 2048, H = 960, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(232,224,200,.14)'; g.fillRect(30, 30, W - 60, H - 60);
  let x = W - 110;
  vline(g, '题名壁', x, 70, 150, BRUSH, 'rgba(34,30,24,.92)', 1.1);
  x -= 120;
  vline(g, '游人至此 各留其名', x, 90, 52, BRUSH, 'rgba(34,30,24,.75)');
  x -= 100;
  if (!items || !items.length) {
    vline(g, API ? '尚无人题名 候君落笔' : '题名壁不日开放', x, 120, 64, BRUSH, 'rgba(34,30,24,.55)');
  } else {
    for (const it of items) {
      if (x < 70) break;
      const nameSize = [...it.name].length > 6 ? 54 : 70;
      let yy = vline(g, it.name, x, 70, nameSize, KAI, 'rgba(30,26,20,.9)');
      const sub = (it.place ? `自${it.place}来游 ` : '到此一游 ') + ganzhiDate(it.ts);
      if (it.msg) { vline(g, it.msg, x - 40, 70 + nameSize * 0.6, 34, KAI, 'rgba(30,26,20,.72)'); }
      vline(g, sub, x + (it.msg ? 22 : 0), Math.max(yy + 20, 70 + nameSize * 2), 32, KAI, 'rgba(30,26,20,.7)');
      x -= it.msg ? 128 : 96;
    }
  }
  const t = new THREE.CanvasTexture(c); t.anisotropy = 8; return t;
}

// ---------- 石壁 ----------
function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// 一块平面朝前的崖面石：外轮廓不规则（顶上起伏、两侧凹凸），倒角，前面是平的（刻字面在 z=0）
function slabGeometry(w, h, d, seed) {
  const r = mulberry(seed), pts = [], N = 40;
  const rough = (u) => 0.5 * Math.sin(u * 13 + seed) + 0.3 * Math.sin(u * 29 + seed * 2) + 0.2 * (r() - 0.5) * 2;
  for (let i = 0; i < N; i++) {
    const u = i / N; let x, y;
    if (u < 0.25) { const t = u / 0.25; x = -w / 2 + w * t; y = -0.6; }                                   // 底边（埋进土里）
    else if (u < 0.5) { const t = (u - 0.25) / 0.25; x = w / 2 + rough(t) * 0.18 * w * 0.3; y = -0.6 + (h + 0.6) * t; } // 右边
    else if (u < 0.75) { const t = (u - 0.5) / 0.25; x = w / 2 - w * t; y = h + rough(t + 3) * 0.09 * h - Math.pow(Math.abs(t - 0.5) * 2, 3) * 0.12 * h; } // 顶
    else { const t = (u - 0.75) / 0.25; x = -w / 2 + rough(t + 7) * 0.18 * w * 0.3; y = h - (h + 0.6) * t; } // 左边
    pts.push(new THREE.Vector2(x, y));
  }
  const bt = Math.min(0.35, d * 0.25);
  const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: d, bevelEnabled: true, bevelThickness: bt, bevelSize: 0.28, bevelSegments: 3, curveSegments: 1, steps: 1 });
  geo.translate(0, 0, -(d + bt));
  // 前面稍稍鼓一点、四边往后收，不像一块木板
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (z < -0.02) { const k = 1 + 0.15 * Math.sin(x * 1.3 + seed) * Math.sin(y * 0.9); p.setZ(i, z * k - 0.25 * (r() * 0.4)); }
  }
  geo.computeVertexNormals();
  const aH = new Float32Array(p.count); for (let i = 0; i < p.count; i++) aH[i] = THREE.MathUtils.clamp(p.getY(i) / h, 0, 1);
  geo.setAttribute('aH', new THREE.BufferAttribute(aH, 1));
  return geo;
}
function inscriptionMaterial(map) {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: map } }, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'uniform sampler2D map; varying vec2 vUv; void main(){ vec4 c=texture2D(map,vUv); if(c.a<.01) discard; gl_FragColor=c; }',
  });
}

// ---------- 搭到场景里 ----------
export function buildCreditSite({ scene, groundHeight, rockMat, flat, Kit, COL, Figure, figs, boxCol, addLamp }) {
  const group = new THREE.Group(); group.name = 'credit'; scene.add(group);
  const pickables = [];
  const place = (S, seed, tex, kind) => {
    const y0 = groundHeight(S.x, S.z) - 0.05;
    const rock = new THREE.Mesh(slabGeometry(S.w, S.h, 2.2, seed), rockMat);
    rock.position.set(S.x, y0, S.z); rock.rotation.y = S.ry; group.add(rock);
    const m = 0.45, plane = new THREE.Mesh(new THREE.PlaneGeometry(S.w - 2 * m, S.h - 0.6 - m), inscriptionMaterial(tex));
    plane.position.set(0, (S.h - 0.6 - m) / 2 + 0.35, 0.03); rock.add(plane);
    rock.userData.credit = kind; plane.userData.credit = kind; pickables.push(rock);
    // 碰撞：石块本身
    const c = Math.cos(S.ry), s = Math.sin(S.ry);
    boxCol(S.x - s * 1.1, S.z - c * 1.1, S.w / 2, 1.2, S.ry);
    return { rock, plane };
  };
  const moya = place(END.moya, 11, inscriptionTexture(), 'ba');
  const wall = place(END.wall, 23, wallTexture(null), 'wall');
  let wallItems = null;
  const swap = (pl, tex) => { const u = pl.material.uniforms.map, old = u.value; u.value = tex; old.dispose(); };
  // 画布上的字要等字体到了再刻一遍（落款用的霞鹜文楷、题字用的马善政体）
  if (document.fonts) Promise.all([document.fonts.load('60px "YY Sig"', '李揚與製'), document.fonts.load('60px "Ma Shan Zheng"', '玉阳洞天题名壁')])
    .then(() => { swap(moya.plane, inscriptionTexture()); swap(wall.plane, wallTexture(wallItems)); }).catch(() => {});

  // 画师：南侧铺纸写生，面前一张矮几（纸、笔、砚），身后一只书箱
  const P = END.painter;
  const def = {
    id: 'huashi', name: '画师', pos: [P.x, 0, P.z], face: P.face, robe: '#efe9da', trim: '#3f6f8c', hat: 'scarf', seat: 'cushion', routine: 'sit', control: false,
    card: { eye: '卷尾 · 四陽洞外', title: '峡口的画师',
      body: ['峡谷尽头有位画师铺纸写生，对着崖上的题刻一笔一笔地描。原画里没有他：他是这座游园的作者留在画里的影子。',
        `<span class="cr">${AUTHOR.en} 与 ${AUTHOR.partner} 同制 · <a href="${AUTHOR.github}" target="_blank" rel="noopener">GitHub</a> · <a href="${AUTHOR.x}" target="_blank" rel="noopener">X ${AUTHOR.xName}</a></span>`],
      tip: '接管一位游人走到他身边，可以和他聊几句；北边石壁上可以题名。', extra: [['看跋', 'ba'], ['题名', 'wall']] },
    lines: ['有客到了！这一卷从金晶巖一路走到四陽洞，你都看过了吗？',
      '我照着展厅里拍下的十三帧，和 Claude 一起，一山一石、一屋一人地把它搭成了能走进去的山水。',
      '原画接缝处看不清的地方，是我们按画意补的。哪里不像，尽管告诉我。',
      '北边那面石壁是题名壁。留个名字吧，也算到此一游。'],
    after: 'ba',
  };
  const f = new Figure(def); figs.set(def.id, f);
  f.root.position.set(P.x, groundHeight(P.x, P.z), P.z); f.root.rotation.y = f.heading = P.face;
  f.home = f.root.position.clone(); f.pathI = 0; f.pathDir = 1; f.wait = 0;
  scene.add(f.root);
  { // 矮几、纸、笔、砚、书箱
    const k = new Kit(), fx = Math.sin(P.face), fz = Math.cos(P.face);
    const tx = P.x + fx * 0.72, tz = P.z + fz * 0.72, y = groundHeight(tx, tz);
    const wood = COL.wood || new THREE.Color('#6b4c34'), paper = new THREE.Color('#f2ecdc'), ink = new THREE.Color('#2a2620');
    const R = new THREE.Matrix4().makeRotationY(P.face);
    const at = (lx, ly, lz) => new THREE.Vector3(lx, ly, lz).applyMatrix4(R).add(new THREE.Vector3(tx, y, tz));
    const box = (w, h, d, lx, ly, lz, col) => { const v = at(lx, ly, lz); k.box(w, h, d, v.x, v.y, v.z, col, 0, P.face); };
    box(0.62, 0.04, 1.05, 0, 0.28, 0, wood);                          // 几面（横着放，长边朝左右）
    for (const [a, b] of [[-0.26, -0.46], [0.26, -0.46], [-0.26, 0.46], [0.26, 0.46]]) box(0.05, 0.28, 0.05, a, 0, b, wood);
    box(0.44, 0.006, 0.8, 0.02, 0.32, 0, paper);                      // 铺开的纸
    box(0.1, 0.03, 0.14, -0.2, 0.32, -0.42, ink);                     // 砚
    box(0.012, 0.012, 0.22, -0.12, 0.33, -0.34, wood);                // 笔
    const bx = at(-0.4, 0, -1.5); k.box(0.42, 0.5, 0.32, bx.x, groundHeight(bx.x, bx.z), bx.z, new THREE.Color('#5a3f2c'), 0, P.face + 0.3); // 书箱
    // 夜里照着题刻的一盏灯：画师身旁插一根竹竿，横杆上挑着灯笼
    const sx = Math.cos(P.face), sz = -Math.sin(P.face); // 画师的右手边
    const px = P.x + fx * 0.9 + sx * 0.75, pz = P.z + fz * 0.9 + sz * 0.75, py = groundHeight(px, pz);
    const bamboo = new THREE.Color('#7d7448');
    k.cyl(0.025, 0.02, 2.3, px, py - 0.1, pz, bamboo, 5);
    { const g = new THREE.CylinderGeometry(0.014, 0.014, 0.75, 4); g.rotateX(Math.PI / 2); g.rotateY(P.face);
      k.add(g, bamboo, 0, new THREE.Matrix4().makeTranslation(px + fx * 0.32, py + 2.12, pz + fz * 0.32)); }
    if (addLamp) addLamp(new THREE.Vector3(px + fx * 0.62, py + 1.62, pz + fz * 0.62), 'lantern');
    const m = new THREE.Mesh(k.geometry(), flat); group.add(m);
    boxCol(P.x + fx * 0.3, P.z + fz * 0.3, 0.55, 0.8, P.face);
  }

  return {
    pickables, painter: f, moya, wall,
    setWall(items) { wallItems = items; swap(wall.plane, wallTexture(items)); },
    nearSite(p) { // 控制人物走到题刻或题名壁跟前
      for (const [S, kind] of [[END.moya, 'ba'], [END.wall, 'wall']]) {
        const c = Math.cos(S.ry), s = Math.sin(S.ry), dx = p.x - S.x, dz = p.z - S.z;
        const along = dx * c - dz * s, out = dx * s + dz * c; // 沿壁方向、离壁距离（前方为正）
        if (out > -0.2 && out < 3.2 && Math.abs(along) < S.w / 2 + 0.3) return kind;
      }
      return null;
    },
  };
}

// ---------- 界面：跋、题名壁 ----------
export function initCreditUI({ onFlyEnd, onWallItems }) {
  const ba = $('ba'), tb = $('tibi');
  let items = null, loaded = false;
  const open = (el) => { el.hidden = false; el.classList.remove('in'); void el.offsetWidth; el.classList.add('in'); };
  const openBa = () => { tb.hidden = true; open(ba); };
  let openedAt = 0;
  const openWall = () => { ba.hidden = true; open(tb); openedAt = Date.now(); refresh(); setTimeout(() => { if (matchMedia('(pointer:fine)').matches) $('tbName').focus(); }, 60); };
  const close = () => { const was = !ba.hidden || !tb.hidden; ba.hidden = true; tb.hidden = true; return was; };
  $('aseal').onclick = openBa;
  $('baClose').onclick = () => (ba.hidden = true);
  $('tbClose').onclick = () => (tb.hidden = true);
  $('baWall').onclick = openWall;
  $('baGo').onclick = () => { close(); onFlyEnd(); };
  $('tbGo').onclick = () => { close(); onFlyEnd(); };
  $('tbBa').onclick = openBa;
  for (const el of document.querySelectorAll('[data-open-ba]')) el.addEventListener('click', (e) => { e.preventDefault(); openBa(); });
  ba.addEventListener('pointerdown', (e) => { if (e.target === ba) ba.hidden = true; });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && (!ba.hidden || !tb.hidden)) { ba.hidden = true; tb.hidden = true; e.stopPropagation(); } }, true);
  tb.addEventListener('pointerdown', (e) => { if (e.target === tb) tb.hidden = true; });

  const list = $('tbList'), msg = $('tbMsg'), form = $('tbForm');
  function render() {
    if (!API) { list.innerHTML = '<p class="tb-empty">题名壁不日开放。</p>'; form.classList.add('off'); return; }
    if (!items) { list.innerHTML = '<p class="tb-empty">正在拓印石壁上的题名…</p>'; return; }
    if (!items.length) { list.innerHTML = '<p class="tb-empty">还没有人题名，候君落笔。</p>'; return; }
    const lat = (t) => (/^[\x20-\x7e]+$/.test(t) ? ' class="lat"' : '');
    list.innerHTML = items.map((it) => `<div class="tb-col"><b${lat(it.name)}>${esc(it.name)}</b>${it.msg ? `<i${lat(it.msg)}>${esc(it.msg)}</i>` : ''}<span>${it.place ? '自' + esc(it.place) + '来游' : '到此一游'} · ${ganzhiDate(it.ts)}</span></div>`).join('');
  }
  async function refresh(force) {
    if (!API) { render(); return; }
    if (loaded && !force) { render(); return; }
    render();
    try { const j = await fetchNames(); items = j.items || []; loaded = true; render(); onWallItems(items); }
    catch (e) { list.innerHTML = '<p class="tb-empty">石壁一时看不清（网络不通），稍后再来。</p>'; }
  }
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); if (!API) return;
    const name = $('tbName').value.trim(), place = $('tbPlace').value.trim(), m = $('tbText').value.trim();
    if (!name) { msg.textContent = '先写下名字。'; return; }
    let last = 0; try { last = +localStorage.getItem('yydt-tibi') || 0; } catch (err) {}
    if (Date.now() - last < 60000) { msg.textContent = '刚题过了，歇一会儿再来。'; return; }
    msg.textContent = '正在刻…'; form.querySelector('button').disabled = true;
    try {
      const j = await postName({ name, place, msg: m, hp: $('tbHp').value, t: Date.now() - openedAt });
      try { localStorage.setItem('yydt-tibi', String(Date.now())); } catch (err) {}
      msg.textContent = j.pending ? '题名已收到，主人过目后就刻上石壁。' : `已刻在卷尾的石壁上：${name}${place ? ' 自' + place + '来游' : ' 到此一游'}。`;
      form.reset();
      if (j.item) { items = [j.item, ...(items || [])]; render(); onWallItems(items); } else refresh(true);
    } catch (err) { msg.textContent = err.message; }
    finally { form.querySelector('button').disabled = false; }
  });
  // 一开场就把题名取回来，刻到 3D 石壁上（取不到就算了）
  if (API) setTimeout(() => refresh(), 4000);
  else render();
  return { openBa, openWall, close, isOpen: () => !ba.hidden || !tb.hidden };
}
