// 玉阳洞天 · 3D 游戏场景（P0 灰盒世界 + P1 玉女潭切片）
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PATH, PATH_V29, ZONES, STAGES, PEOPLE, ACTIONS } from './data.js';
import { MOYA, CAVE, caveLocal, inCave, buildTerrainGeometry, buildTerrainPatch, terrainHeight, surfaceTop, groundHeight, waterLevel, pathAt, slopeAt, blocked, smooth, rand, fbm,
  POND, POOL, STREAM, STREAM2, PADS, COLLIDERS, addSurface, WORLD, distToStream, pondShape, LOBED, FORE, foreMound, MASSIF, QN_STAIRS, massifAt, distToLine, LAYOUT_V21, DGL, daguanWallTop, CH2, PIAO, PANYU, CHAORAN, STAIRS2, MASSIF2, rocks2At, withOldPath, useOldPath, enterV33, exitV33, pathOn, pathV33At, gorge6,
  CH3, ZEN3, ZEN3B, GY3, POLE3, MOYA3, POOL3, GROTTO3, LONGQIU3, PADS_NOW, POOLW } from './world.js';
import { PAL, loadTex, terrainMaterial, rockMaterial, cliffMaterial, foliageMaterial, flatMaterial,
  cloudMaterial, leafClumpTexture, tuftTexture, pineTexture, bambooTexture, cloudTexture, createPost } from './art.js';
import { Kit, COL, buildYuguangGe, YUGUANG, buildHexPavilion, buildHall, buildArchBridge, buildCorridor,
  spireGeometry, boulderGeometry, rockGeometry, buildCliff, treeVariant, cloudInstances, buildStairs } from './props.js';
import { Figure } from './figures.js';
import { BAKE, initBake, bakedFn, bakeOutput, bakedList, bakeList } from './bake.js';
import { Crane } from './crane.js';
import { buildYuguangGeHD, buildHexPavilionHD, buildHallHD, buildRetreatHD, buildBareTree } from './buildings.js';
import { statueMaterial, buildGuanyinStatue, loadGuanyinHead, buildGuanyinCanopy, buildBannerPole, buildBanner, buildMoyaCliff } from './guanyin.js';
import { createPond, streamMaterial, createWaterfall } from './water.js';
import { Birds } from './birds.js';
import { createFarTrees } from './fartrees.js';
import { buildRocks2, placeBlock, stoneFigureGeometry, craggyRockGeometry, primeRock, ROCK_KEYS } from './zone2.js';
import { createDayNight, shichen, phaseName } from './daynight.js';
import { buildCave, buildRedCompound, buildOpenPavilion, buildSlab, buildPalaceTerrace, buildPalaceStair, buildSlopeWall, buildStrawHut, buildMassif, buildStoneBridge, stoneBridgeDeck } from './zone1.js';

const $ = (id) => document.getElementById(id);
// v41 载入：世界是在这一个模块里同步搭起来的（约几秒 CPU）。分段让出主线程，开场画面能先画出来，进度字也能更新
const step = (t) => { $('loading').textContent = '正在铺绢 · ' + t + '…';
  return new Promise((r) => { const done = () => setTimeout(r, 0); requestAnimationFrame(done); setTimeout(done, 60); }); };
const MOBILE = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 560;
const DEBUG = /debug/.test(location.search) || location.hash === '#debug';
const START = /^S\d\d$/.test(location.hash.slice(1)) ? location.hash.slice(1) : null; // 例：链接加 #S13 从金晶巖开场

// ---------- 渲染器 ----------
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: /fixedres/.test(location.search) });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
const PR = MOBILE ? Math.min(devicePixelRatio, 1.5) * 0.8 : Math.min(devicePixelRatio, 1.5);
renderer.setPixelRatio(PR);
renderer.setSize(innerWidth, innerHeight);
renderer.info.autoReset = false;
$('stage').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.3, 1500);
const post = createPost(renderer, { samples: MOBILE ? 0 : 2, mistSteps: MOBILE ? 6 : 11, clouds: MOBILE ? 8 : 12, cloudSteps: MOBILE ? 6 : 8, lights: MOBILE ? 8 : 16 });
// v38 昼夜：开场是辰时（上午）。链接加 ?h=20 之类可直接从某个时辰开始（测试用）
const H0 = +(new URLSearchParams(location.search).get('h') ?? 8.5);
const DN = createDayNight({ post, scene, camera, groundHeight: (x, z) => groundHeight(x, z), MOBILE, hour: isNaN(H0) ? 8.5 : H0 });
camera.layers.enable(1); // 第 1 层：草丛、飞鸟，只进主画面，不进水面倒影
if (MOBILE) post.mat.uniforms.grain.value = 0.6;
function resize() {
  renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  const s = renderer.getDrawingBufferSize(new THREE.Vector2()); post.setSize(s.x, s.y);
}
addEventListener('resize', resize);
// 自适应分辨率：帧率掉到 45 以下逐级降低渲染分辨率，回升后再慢慢提回去
const adapt = { scale: 1, acc: 0, n: 0, hold: 0 };
const DEBUG_FIXED = /fixedres/.test(location.search); // 截图测试时关掉自适应
function adaptRes(dt) {
  adapt.acc += dt; adapt.n++;
  if (adapt.acc < 1.5) return;
  const fps = adapt.n / adapt.acc; adapt.acc = 0; adapt.n = 0;
  if (adapt.hold-- > 0) return;
  let s = adapt.scale;
  if (fps < 45 && s > 0.55) s = Math.max(0.55, s - (fps < 30 ? 0.15 : 0.08));
  else if (fps > 58 && s < 1) s = Math.min(1, s + 0.05);
  if (s !== adapt.scale) { adapt.scale = s; renderer.setPixelRatio(PR * s); resize(); adapt.hold = 1; }
}

// ---------- 贴图 ----------
const A = 'assets/';
const tex = {
  slope: loadTex(A + 'slope.jpg'), rock: loadTex(A + 'rock.jpg'), cliff: loadTex(A + 'cliff.jpg'),
  leaf: [0, 1, 2].map((i) => loadTex(A + `leaf${i}.png`, false)),
  pine: pineTexture(), bamboo: bambooTexture(), cloud: cloudTexture(),
  clump: [leafClumpTexture('round', 1), leafClumpTexture('point', 2), leafClumpTexture('feather', 3), leafClumpTexture('dot', 4), leafClumpTexture('feather', 5)],
};
tex.cliff.wrapS = THREE.MirroredRepeatWrapping; tex.cliff.wrapT = THREE.ClampToEdgeWrapping;
const timed = []; // 需要 time uniform 的材质

// ---------- 地形与水 ----------
await step('起地形');
await initBake(); // v42 读预存（见 bake.js）
// v42 嶙峋石交给后台线程先算（主线程这时去铺地形、盖房子）；到「叠山石」再等它。Worker 起不来、超时都不要紧，没算到的照旧现场算
function startRockWorker(list) {
  if (!list || !list.length || typeof Worker === 'undefined') { try { window.__rockWorker?.terminate(); } catch (e) {} return Promise.resolve(0); }
  return new Promise((done) => {
    let w, n = 0; const end = () => { try { w && w.terminate(); } catch (e) {} done(n); };
    try { w = window.__rockWorker || new Worker(new URL('./rockworker.js', import.meta.url), { type: 'module' }); } catch (e) { return done(0); } // index.html 开头就先建好（Worker 要主线程空下来才起得来）
    w.onmessage = (e) => { if (!e.data) return end(); const { seed, res, squat, A } = e.data; primeRock(seed, res, squat, A); n++; };
    w.onerror = end; w.postMessage(list);
    ROCKWAIT.cancel = end;
  });
}
const ROCKWAIT = { cancel: null };
const ROCKS_READY = startRockWorker(bakedList(MOBILE ? 'rocks-m' : 'rocks-d')); // 手机、电脑用的石头精度不同，各记一份
const terrain = new THREE.Mesh(buildTerrainGeometry(THREE), terrainMaterial(tex.slope, tex.rock, LOBED));
const TGP = terrain.geometry.attributes.position.array, TNX = Math.round((WORLD.x1 - WORLD.x0) / WORLD.step) + 1, TNZ = TGP.length / 3 / TNX;
const gridH = (x, z) => { const i = (x - WORLD.x0) / WORLD.step, j = (z - WORLD.z0) / WORLD.step; return Number.isInteger(i) && Number.isInteger(j) && i < TNX && j < TNZ ? TGP[(j * TNX + i) * 3 + 1] : terrainHeight(x, z); }; // v42 网格点直接取地形网格的高
post.setHeightmap(gridH, WORLD.x0, WORLD.z0, WORLD.x1 - WORLD.x0, WORLD.z1 - WORLD.z0, 3);
scene.add(terrain);
const terrain5 = new THREE.Mesh(buildTerrainPatch(THREE), terrain.material); scene.add(terrain5); // v32 超然亭一带的细网格（见 world.js PATCH5）

const pondMesh = createPond(POND, { mobile: MOBILE }); scene.add(pondMesh); timed.push(pondMesh.material);
const poolMesh = createPond(POOL3, { mobile: true }); scene.add(poolMesh); timed.push(poolMesh.material); // v39 龍湫潭在岩洞里（洞里暗，不做实时倒影）
const wfPool = createPond(POOLW, { mobile: MOBILE, reflK: 0.45 }); scene.add(wfPool); timed.push(wfPool.material); // v40 对岸瀑布下的深潭
// 曲溪、隅九桥溪：沿溪线铺水带。pts 的 y 是水面高（null 时按游线高减 0.45）
function streamBand(pts, hw, wlOf) {
  const curve = new THREE.CatmullRomCurve3(pts), L = curve.getLength(), n = Math.ceil(L / 1.2), pos = [], idx = [], uvs = [];
  for (let i = 0; i <= n; i++) {
    const p = curve.getPointAt(i / n), t = curve.getTangentAt(i / n), l = Math.hypot(t.x, t.z), nx = -t.z / l, nz = t.x / l, y = wlOf(p);
    pos.push(p.x + nx * hw, y, p.z + nz * hw, p.x - nx * hw, y, p.z - nz * hw); uvs.push(i / n * L / 160, 0, i / n * L / 160, 1);
    if (i < n) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  const m = streamMaterial(); timed.push(m);
  scene.add(new THREE.Mesh(g, m));
}
streamBand(STREAM.map(([x, z]) => new THREE.Vector3(x, 0, z)), 1.9, (p) => pathAt(p.x).y - 0.45);
streamBand(STREAM2.map(([x, z, w]) => new THREE.Vector3(x, w, z)), 1.8, (p) => p.y);

// ---------- 玉女潭崖壁 ----------
scene.add(new THREE.Mesh(buildCliff(), cliffMaterial(tex.cliff)));

// ---------- 建筑 ----------
await step('筑屋宇');
const flat = flatMaterial(); flat.side = THREE.DoubleSide;
const staticParts = [];
function place(geo, x, z, ry = 0, y = null, sc = 1) {
  const yy = y ?? terrainHeight(x, z);
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, yy, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(sc, sc, sc));
  staticParts.push(geo.clone().applyMatrix4(m));
  if (geo.userData.lamps) for (const [lx, ly, lz, kind] of geo.userData.lamps) DN.addLamp(new THREE.Vector3(lx * sc, ly * sc, lz * sc).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry).add(new THREE.Vector3(x, yy, z)), kind); // v38 殿亭的夜灯
  return yy;
}
const onMassif = (x, z) => x > 304 && (massifAt(x, z).y > -1e8 || distToLine(x, z, QN_STAIRS) < 3); // 隐春巖石壁（含底座）和青牛峡石阶上
const boxCol = (x, z, hw, hd, rot = 0) => COLLIDERS.push({ x, z, hw, hd, rot });
const circleCol = (x, z, r) => COLLIDERS.push({ x, z, r });
function hexCols(x, z, R) { for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + Math.PI / 6; if (i !== 1) circleCol(x + Math.cos(a) * R, z + Math.sin(a) * R, 0.25); } }

// 玉光閣：先放程序生成版，Blender 导出的 glb 到了再替换
const yg = { y: terrainHeight(YUGUANG.x, YUGUANG.z), floor2: YUGUANG.floor2 };
const ygMesh = new THREE.Mesh(buildYuguangGeHD(), flat);
ygMesh.position.set(YUGUANG.x, yg.y, YUGUANG.z); ygMesh.rotation.y = YUGUANG.ry; scene.add(ygMesh);
for (const [lx, ly, lz, kind] of ygMesh.geometry.userData.lamps || []) DN.addLamp(new THREE.Vector3(lx, ly, lz).applyAxisAngle(new THREE.Vector3(0, 1, 0), YUGUANG.ry).add(ygMesh.position), kind);
boxCol(YUGUANG.x, YUGUANG.z, 4.8, 3.3, YUGUANG.ry);
const lingying = { x: 70, z: -28 };
const lyMesh = new THREE.Mesh(buildHexPavilionHD(1.6, 2.6), flat);
lyMesh.position.set(lingying.x, terrainHeight(lingying.x, lingying.z), lingying.z); lyMesh.rotation.y = 0.5; scene.add(lyMesh);
for (const [lx, ly, lz, kind] of lyMesh.geometry.userData.lamps || []) DN.addLamp(new THREE.Vector3(lx, ly, lz).applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.5).add(lyMesh.position), kind); // v38 靈應亭的灯
hexCols(lingying.x, lingying.z, 1.6);

const MATCOL = { zhu_red: COL.zhu, tile_gray: COL.tile, wall_white: COL.wall, wood_dark: COL.wood, stone: COL.stone, lattice_red: new THREE.Color('#a8553f') };
async function tryGLB(url, mesh, onLoad) {
  try {
    const head = await fetch(url, { method: 'HEAD' }); if (!head.ok) return;
    const gltf = await new GLTFLoader().loadAsync(url);
    const parts = [];
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const g0 = o.geometry.clone().applyMatrix4(o.matrixWorld);
      const groups = g0.groups.length ? g0.groups : [{ start: 0, count: (g0.index ? g0.index.count : g0.attributes.position.count), materialIndex: 0 }];
      for (const gr of groups) {
        const mat = mats[gr.materialIndex] || mats[0];
        const key = Object.keys(MATCOL).find((k) => (mat.name || '').startsWith(k));
        const col = key ? MATCOL[key] : (mat.color ? mat.color.clone().convertLinearToSRGB() : COL.wall);
        const sub = new THREE.BufferGeometry();
        const src = g0.index ? g0.toNonIndexed() : g0;
        const st = g0.index ? gr.start : gr.start, ct = gr.count;
        sub.setAttribute('position', new THREE.BufferAttribute(src.attributes.position.array.slice(st * 3, (st + ct) * 3), 3));
        const k = new Kit(); k.add(sub, col, mat.name && mat.name.startsWith('tile') ? 0 : 0); parts.push(k.parts[0]);
      }
    });
    if (!parts.length) return;
    const g = mergeGeometries(parts); g.computeVertexNormals();
    mesh.geometry.dispose(); mesh.geometry = g; onLoad && onLoad();
    console.info('已载入 Blender 模型', url);
  } catch (e) { console.warn('glb 未载入，使用程序生成版', url, e); }
}

// 左上山中红楼与石阶
place(buildHallHD(6, 4, 3, { wall: new THREE.Color('#c25a42') }), -8, -50, 0.35); boxCol(-8, -50, 3.6, 2.6, 0.35);
place(buildHallHD(3.4, 2.6, 2.4, { wall: new THREE.Color('#d6cbb0') }), -15, -46, 0.6, terrainHeight(-15, -46));
const STAIRS = [
  [[3, -15.5], [2, -22], [-1, -30], [-4, -38], [-7, -45.5]],
  ...STAIRS2, // 第二章：磐玉隈、琪樹峡上縹緲亭的两道石阶，琪樹峡里的之字石阶
  QN_STAIRS,
];
// v35 琪樹峡里那段游线在原画上就是白衣人走的那道石阶：沿游线铺一道梯级（只是样子，走法和游线一样）
const LADDER6 = []; for (let x = -94.5; x >= -120.5; x -= 1.3) LADDER6.push([x, pathAt(x).z]);
STAIRS.forEach((s) => staticParts.push(buildStairs(s, { ladder: STAIRS2.includes(s) })));
staticParts.push(buildStairs(LADDER6, { ladder: true })); // 不进 STAIRS：游线这里本来就不陡，也不动别处种树的判断
export function onStairs(x, z) {
  for (const s of STAIRS) for (let i = 0; i < s.length - 1; i++) {
    const [ax, az] = s[i], [bx, bz] = s[i + 1], vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz;
    const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / l2));
    if (Math.hypot(x - ax - vx * t, z - az - vz * t) < 1.4) return true;
  }
  return false;
}

// 其余各区（灰盒：体量、位置、可走性到位，造型按原画简化）
// 东境·廊院（IMG_1271、1270）：龍王廟红墙院、大觀廊院落
{
  const TY = 22.6; // 龍王廟院子
  place(buildRedCompound(13, 9, 2.3), 306, -46, 0.08, TY);
  place(buildHallHD(3.6, 2.4, 2.3, { wall: new THREE.Color('#bd5b45') }), 306.4, -42.2, 0.08, TY); boxCol(306.4, -42.2, 2.2, 1.6, 0.08); // 山门
  place(buildHallHD(6.4, 3.8, 2.8, { wall: new THREE.Color('#bd5b45') }), 305.8, -48.6, 0.08, TY); boxCol(305.8, -48.6, 3.6, 2.3, 0.08); // 正殿
  for (const [x, z, hw, hd] of [[306, -50.5, 6.5, 0.3], [312.5, -46, 0.3, 4.5], [299.5, -46, 0.3, 4.5]]) boxCol(x, z, hw, hd, 0.08);
  place(buildHallHD(5, 3, 2.4), 290, -84, 0.1, 41); place(buildHallHD(3, 2.2, 2), 296, -82, -0.2, 41); // 后山顶上的小院
  // 大觀廊（Yang 2026-10-28 看原画：正八边形的“八合院”）：八条边各一座长屋，窗朝院里开；正面一座门屋靠街，朱红大门；
  // 院中一座比边屋稍大的供案殿，殿前石台，台边有人扫地；院后乱石高台上一座宫殿式重檐大殿，台前一道比殿门宽得多的石阶
  const D = DGL, Y = D.y, DG = { wall: new THREE.Color('#e6dcc3'), front: 'window' }; // 原画：粉白墙，每间上半截一溜朱红窗格
  const loc = (x, z, ry, lx, lz) => [x + lx * Math.cos(ry) + lz * Math.sin(ry), z - lx * Math.sin(ry) + lz * Math.cos(ry)];
  // 穿堂（门屋、后屋）：当中一间前后敞开，台基前后各两级踏步，人从当中穿过去
  const passHall = (w, d, h, x, z, ry, opt) => {
    place(buildHallHD(w, d, h, { ...DG, ...opt, pass: true }), x, z, ry, Y);
    const nb = opt.bays || Math.max(3, Math.round(w / 1.6)) | 1, pw = w / nb / 2 - 0.1, hw = (w / 2 + 0.6 - pw) / 2, B = d / 2 + 0.6, sw = Math.min(2.4, w * 0.4) / 2;
    for (const s of [-1, 1]) boxCol(...loc(x, z, ry, s * (pw + hw), 0), hw, B, ry);
    const c = Math.cos(ry), sn = Math.sin(ry);
    addSurface((px, pz) => {
      const lx = (px - x) * c - (pz - z) * sn, az = Math.abs((px - x) * sn + (pz - z) * c);
      return Math.abs(lx) > (az < B ? pw + 0.3 : sw) || az > B + 0.84 ? null : Y + 0.53 * (az < B ? 1 : 1 - (az - B) / 0.84);
    });
  };
  for (let i = 0; i < 8; i++) {
    const th = i * Math.PI / 4, nx = Math.sin(th), nz = Math.cos(th);
    if (i === 0) { const r = D.rIn + 0.4; passHall(8.8, 3.6, 3.1, D.x + nx * r, D.cz + nz * r, 0, { gate: true, bays: 3 }); continue; } // 门屋：正面朝街
    const x = D.x + nx * D.rIn, z = D.cz + nz * D.rIn, ry = th + Math.PI; // 边屋都朝院里
    if (i === 4) { passHall(8.6, 3.6, 2.9, x, z, ry, {}); continue; } // 后屋：穿过去就是高台石阶
    place(buildHallHD(8.6, 3.6, 2.8, DG), x, z, ry, Y); boxCol(x, z, 4.9, 2.4, ry);
  }
  // 供案殿：比边屋大一圈，前面敞开，殿里朱红供案和香炉
  place(buildHallHD(10, 5.2, 3.3, { ...DG, front: 'open' }), D.x, D.cz - 3.5, 0, Y); boxCol(D.x, D.cz - 3.5, 5.6, 3.2);
  { const k = new Kit(); k.box(1.5, 0.08, 0.7, 0, 1.25, 0, COL.zhu); for (const sx of [-0.65, 0.65]) for (const sz of [-0.28, 0.28]) k.box(0.08, 0.72, 0.08, sx, 0.53, sz, COL.zhu); k.box(0.3, 0.25, 0.3, 0, 1.33, 0, new THREE.Color('#5c5a52')); place(k.geometry(), D.x, D.cz - 4.1, 0, Y); }
  place(buildSlab(), D.x - 2, D.cz + 5.6, 0.05, Y);
  // 后面的乱石高台、台前石阶、台上重檐大殿
  const H = D.ty - Y, run = D.foot - D.tz;
  place(buildPalaceTerrace(D.tw, D.td, H, D.sw), D.x, D.tz, 0, Y);
  place(buildPalaceStair(D.sw, H, run), D.x, D.tz, 0, Y);
  addSurface((x, z) => (Math.abs(x - D.x) < D.tw / 2 && z < D.tz && z > D.tz - D.td ? D.ty : null), true);
  addSurface((x, z) => (Math.abs(x - D.x) < D.sw / 2 - 0.5 && z >= D.tz && z < D.foot ? Y + H * (D.foot - z) / run : null), true);
  for (const s of [-1, 1]) { boxCol(D.x + s * (D.sw / 2 - 0.25), D.tz + run / 2, 0.3, run / 2); boxCol(D.x + s * (D.sw / 4 + D.tw / 4), D.tz - 0.15, D.tw / 4 - D.sw / 4, 0.15); }
  // 大殿面阔和八合院的直径一样（Yang 2026-10-29：这样气势就出来了）
  const PW = 2 * D.rIn / Math.cos(Math.PI / 8), PZ = D.tz - 7.7;
  place(buildHallHD(PW, 9, 5, { ...DG, front: 'palace' }), D.x, PZ, 0, D.ty); boxCol(D.x, PZ, PW / 2 + 0.6, 5.1);
  place(buildHallHD(PW - 6.5, 5.4, 3.1, { ...DG, base: false }), D.x, PZ - 0.15, 0, D.ty + 7.3); // 上层檐：从下层屋顶里升起来
  // 台两侧的粉墙：台旁高出台面，台前顺着石阶斜下来（原画左边那道斜白墙），墙外山坡比墙高处跟着山坡
  for (const s of [-1, 1]) {
    const x = D.x + s * (D.tw / 2 + 0.45), pts = [];
    for (let z = D.tz - D.td; z <= D.foot + 0.81; z += 0.6) pts.push([x, z, Math.max(daguanWallTop(z), terrainHeight(x + s * 0.75, z) + 0.5)]);
    place(buildSlopeWall(pts, Y - 0.3), 0, 0, 0, 0);
    boxCol(x, (pts[0][1] + pts.at(-1)[1]) / 2, 0.45, (pts.at(-1)[1] - pts[0][1]) / 2);
  }
  // 读书楼（原画后殿右边，和大殿一样高）
  place(buildHallHD(6.4, 3.8, 2.7, DG), D.side.x, D.side.z, -0.1, D.ty - 0.3); boxCol(D.side.x, D.side.z, 3.8, 2.5, -0.1);
}
{ // 隅九桥：石拱桥横跨隅九桥溪，桥面顺着游线的坡
  const x = 232, z = pathAt(x).z, y = pathAt(x).y, len = 7.6, w = 2.2, rise = 1.0, ry = Math.atan2(pathAt(x - 1).z - pathAt(x + 1).z, 2), c = Math.cos(ry), sn = Math.sin(ry);
  const slope = (pathAt(x + 3).y - pathAt(x - 3).y) / 6 * c, deck = stoneBridgeDeck(len, rise, slope);
  place(buildStoneBridge(len, w, rise, slope), x, z, ry, y);
  addSurface((px, pz) => { const lx = (px - x) * c - (pz - z) * sn, lz = (px - x) * sn + (pz - z) * c; return Math.abs(lz) < w / 2 && Math.abs(lx) < len / 2 ? y + deck(lx) : null; });
}
place(buildHexPavilionHD(1.6, 2.4, { thatch: true }), 183, -10, 0.2); hexCols(183, -10, 1.6);                              // 梅竹隩 六角草亭
place(buildHallHD(5.4, 3.2, 2.5), 208, -62, -0.1, 21); place(buildHallHD(3, 2.2, 2.1, { wall: new THREE.Color('#e0d3b4') }), 213.5, -60.5, -0.3, 21); // 梅竹隩后山的山房
const BR = { x: 195, z: pathAt(195).z, y: pathAt(195).y, len: 9, w: 1.9, rise: 1.1 };
place(buildArchBridge(BR.len, BR.w, BR.rise), BR.x, BR.z, 0, BR.y);                                                       // 沸玉橋
addSurface((x, z) => (Math.abs(z - BR.z) < BR.w / 2 && Math.abs(x - BR.x) < BR.len / 2 ? BR.y + BR.rise * Math.sin(Math.PI * ((x - BR.x) / BR.len + 0.5)) : null));
place(buildOpenPavilion(6.4, 4, 2.7), 102, -17, 0.15); boxCol(102, -17, 3.4, 2.2, 0.15);                                           // 凝玉亭
place(buildStrawHut(2.2, 1.6, 1.2), 112, 4, -0.4);        // 鶴巢
place(buildHexPavilionHD(1.6, 2.5), PIAO.x, PIAO.z, 0.3); hexCols(PIAO.x, PIAO.z, 1.6);                                    // 縹緲亭（v27 按拼接挪到磐玉隈左上的圆山顶）
{ // 磐玉隈二人中间的棋盘（原画两人对坐，中间一张棋枰）
  const k = new Kit(), y = terrainHeight(PANYU.x, -14.3), W = new THREE.Color('#ece6d6'), B = new THREE.Color('#2a2622');
  k.box(0.52, 0.12, 0.52, PANYU.x, y + 0.06, -14.3, new THREE.Color('#b58a52'));
  const r = rand(19); for (let i = 0; i < 14; i++) k.box(0.035, 0.02, 0.035, PANYU.x + (r() - 0.5) * 0.42, y + 0.13, -14.3 + (r() - 0.5) * 0.42, i % 2 ? W : B);
  staticParts.push(k.geometry());
}
{ const ry = CHAORAN.ry; place(buildRetreatHD(8.4, 4.6, 2.9), CHAORAN.x, CHAORAN.z, ry); for (const [lx, hw, hd, lz] of [[0, 4.4, 0.2, -2.3], [-4.2, 0.2, 2.3, 0], [4.2, 0.2, 2.3, 0], [-2.8, 1.4, 0.15, 2.3], [2.8, 1.4, 0.15, 2.3]]) boxCol(CHAORAN.x + lx * Math.cos(ry) + lz * Math.sin(ry), CHAORAN.z - lx * Math.sin(ry) + lz * Math.cos(ry), hw, hd, ry); } // v30 原画里亭子斜着，看得见右山墙：朝左前方转 0.6 // 超然亭：原画（题“超然宇”）是一座山居瓦屋，前面敞着，里面一人打坐
for (const [x, z, h, sd] of [[-173.3, -18.3, 6.4, 3], [-175, -19.6, 5.6, 7], [-171.8, -19.9, 5, 11], [-176.4, -18.4, 4.6, 5], [-174.2, -21, 5.8, 13]]) place(buildBareTree(sd, h), x, z, sd); // 亭左一小片光枝瘦树（原画亭左，枝梢像蟹爪）
// v39 禪窩（IMG_1262 下中）：前面一座敞口瓦屋，两僧对坐；右后方一座大些的后屋，屋脊更高
// 原画的屋子矮小：前屋宽约 4 米、屋顶起坡平缓（按画境镜头量檐口、屋脊、台基前沿定的尺寸）
place(buildRetreatHD(4.0, 3.0, 2.0, 1.0), ZEN3.x, ZEN3.z, 0, ZEN3.y);
for (const [lx, hw, hd, lz] of [[0, 2.1, 0.2, -1.5], [-2, 0.2, 1.5, 0], [2, 0.2, 1.5, 0], [-1.33, 0.67, 0.15, 1.5], [1.33, 0.67, 0.15, 1.5]]) boxCol(ZEN3.x + lx, ZEN3.z + lz, hw, hd); // 中间一间敞着，能走进去
addSurface((x, z) => { const lz = z - ZEN3.z; return Math.abs(x - ZEN3.x) < 2.3 && lz > -1.9 && lz < 2.3 ? ZEN3.y + 0.38 * Math.min(1, (2.3 - lz) / 0.8) : null; }); // 屋里地坪（两僧坐在上面），门前踏步一段做成缓坡好走上去
place(buildRetreatHD(3.8, 3.0, 1.9, 1.0), ZEN3B.x, ZEN3B.z, 0, ZEN3B.y); boxCol(ZEN3B.x, ZEN3B.z, 2.1, 1.7);
{ const k = new Kit(), x = ZEN3.x - 2.4, z = ZEN3.z + 1.8, y = ZEN3.y; // 屋前左边侍者煮茶：一只方炉、一把壶、一只水桶（原画左下）
  k.box(0.7, 0.62, 0.55, x, y, z, new THREE.Color('#8a7a60')); k.box(0.62, 0.06, 0.48, x, y + 0.62, z, new THREE.Color('#5a4d3c'));
  k.cyl(0.13, 0.16, 0.22, x, y + 0.68, z, new THREE.Color('#3b3a36'), 8); k.cyl(0.17, 0.15, 0.36, x + 0.75, y, z + 0.3, new THREE.Color('#7a5a3a'), 8);
  staticParts.push(k.geometry()); boxCol(x, z, 0.45, 0.35); }

// ---------- 山石主峰 ----------
await step('叠山石');
{ const t = performance.now(), n = await Promise.race([ROCKS_READY, new Promise((r) => setTimeout(() => r(-1), 6000))]); ROCKWAIT.cancel && ROCKWAIT.cancel(); console.info(`[bake] rocks from worker ${n}, waited ${(performance.now() - t).toFixed(0)}ms`); } // v42 等后台线程的石头（最多 6 秒）
const rockMat = rockMaterial(tex.rock, tex.cliff), crestMat = rockMaterial(tex.rock, tex.cliff, { crest: true });
const spires = [];
function spire(x, z, R, H, seed, o = {}) { let y = o.y0 ?? terrainHeight(x, z) - 1.5; if (o.minGround) for (let a = 0; a < 6.28; a += 0.8) y = Math.min(y, terrainHeight(x + Math.cos(a) * R, z + Math.sin(a) * R) - 1.5); const g = spireGeometry(R, H, seed, o); g.applyMatrix4(new THREE.Matrix4().makeRotationY(seed).setPosition(x, y, z)); spires.push(g); if (H > 3) circleCol(x, z, R * 0.85); return g; }
// 金晶巖：圆浑岩丘开拱形大洞（见 zone1.js），洞右青牛峡外一道层叠的石青石壁（隐春巖）
{
  const m = new THREE.Mesh(buildCave(), rockMaterial(tex.rock, tex.cliff, { cave: true }));
  m.position.set(CAVE.x, CAVE.y, CAVE.z); m.rotation.y = CAVE.ry; scene.add(m);
  const c = Math.cos(CAVE.ry), s = Math.sin(CAVE.ry), toW = (lx, lz) => [CAVE.x + lx * c + lz * s, CAVE.z - lx * s + lz * c];
  for (let a = 0.05; a < Math.PI; a += 0.16) { const [wx, wz] = toW(CAVE.hw * Math.cos(a) * 1.02, -CAVE.dc * Math.sin(a) * 1.02); circleCol(wx, wz, 0.6); }
  for (const sx of [-1, 1]) for (let t = 0; t <= 1; t += 0.25) { const [wx, wz] = toW(sx * (CAVE.hw + CAVE.T * t), CAVE.lip); circleCol(wx, wz, 0.9); }
}
{
  const m = new THREE.Mesh(buildMassif(), rockMaterial(tex.rock, tex.cliff, { jade: true })); scene.add(m);
  for (const P of MASSIF) circleCol(P.x, P.z, Math.min(P.rx, P.rz) * 0.85);
}
// 磐玉隈：两块巨岩夹出凹岩（v27 起是 rocks2At 的石坎网格，见下）
// 梅竹隩右侧陡山的石青崖、流觴嶼右手的石山崖面
spire(211, -10, 4, 9, 120, { top: 0.75, bulge: 0.06, minGround: true }); spire(216, -15, 5, 12, 121, { top: 0.7, bulge: 0.06, minGround: true });
spire(168, -15, 3.2, 8, 123, { top: 0.72, bulge: 0.06, minGround: true });
{
  const m = new THREE.Mesh(buildRocks2(), rockMaterial(tex.rock, tex.cliff, { jade: true })); scene.add(m);
  // 不另加碰撞：石壁的陡坡本身就走不上去，凹岩口和石阶脚下要留得出路
}
// 琪樹峡（IMG_1264）：满坡大大小小的石青方石，石阶在石缝里折上去；1265、1263 下缘也有几组
// v34：琪樹峡一段（ZONE6）按原画逐块另摆（见下）。v33 的石阵照旧算一遍：随机数、碰撞、地形都和 v33 一样，
// 所以超然亭的碎石、磐玉隈下缘的石头一块不动；落在 ZONE6 里的只先占着碰撞（超然亭碎石要避开它们）、不摆，算完超然亭再撤
const ZONE6 = (x) => x > -131 && x < -93.5, TEMPCOL = [], ROCK6 = [], GREY6 = [], BLUE6 = [];
const P_NEW = PATH.map((P) => P.slice()), ST_NEW = STAIRS2.map((S) => S);
const freeNew = (x, z, rad) => Math.abs(z - pathOn(P_NEW, x).z) > 2.6 + rad && ST_NEW.every((S) => distToLine(x, z, S) > 1.3 + rad);
enterV33();
{
  const r = rand(4040), H = (x, z) => terrainHeight(x, z), free = (x, z, rad) => Math.abs(z - pathAt(x).z) > 2.6 + rad
    && STAIRS2.every((S) => distToLine(x, z, S) > 1.3 + rad) && Math.hypot(x - PIAO.x, z - PIAO.z) > 6 + rad && Math.hypot(x - CHAORAN.x, z - CHAORAN.z) > 7 + rad;
  const put = (x, z, w, d, h) => {
    if (!free(x, z, Math.max(w, d) * 0.9)) return false;
    const ry = r() * 6.28, show = !ZONE6(x) && freeNew(x, z, Math.max(w, d) * 0.9);
    if (show) placeBlock(spires, H, x, z, w, d, h, ry, Math.round(x * 31 + z * 17));
    if (Math.max(w, d) > 0.8) { circleCol(x, z, Math.max(w, d) * 0.85); if (!show) TEMPCOL.push(COLLIDERS[COLLIDERS.length - 1]); }
    return true;
  };
  // 主石群：前面小、后面大，一块挨一块，石阶两旁最密
  for (let i = 0, n = 0; i < 1400 && n < (MOBILE ? 80 : 125); i++) {
    const x = -138 + r() * 50, z = -42 + r() * 40, back = smooth(-2, -38, z), near = Math.max(0, 1 - Math.min(...STAIRS2.slice(1).map((S) => distToLine(x, z, S))) / 7);
    if (fbm(x * 0.07 + 5, z * 0.07) < 0.36 - 0.16 * near || Math.hypot(x - PIAO.x, z - PIAO.z) < 12) continue; // 一片片成群，石阶两旁最密
    const s = (1.1 + Math.pow(r(), 1.6) * 2.6) * (0.75 + back * 0.7);
    if (put(x, z, s * (0.9 + r() * 0.5), s * (0.8 + r() * 0.4), s * (0.9 + r() * 0.8))) n++;
  }
  // 两块灰白的大平石（原画琪樹峡中间）
  put(-113.5, -27, 4.6, 3.6, 5.2); put(-104.5, -28.5, 4, 3.4, 4.4);
  // 磐玉隈下缘、凹岩口两边的石青石
  for (const [x, z, s] of [[-92, 7, 2.2], [-89, 5, 1.4], [-84, 9, 1.8], [-70, 5, 1.6], [-59, 6, 1.4], [-73, -9, 1.6], [-58, -10, 1.8], [-44, 6, 2.2], [-40, 9, 1.4], [-50, -7.5, 1.2]]) put(x, z, s * 1.2, s, s * 1.1);
  // 超然亭四周（v29 起用圆头石柱，见下）
  // 天成碑：芙蓉城前一块平顶方石，像立着的碑（1263 右上、1264 左上）
  placeBlock(spires, H, -142, -48, 6, 4, 9, 0.15, 77, { taper: 0.95, slant: 0.05 }); circleCol(-142, -48, 4.6); // v30 按原画右上角的位置
}
// 芙蓉城群峰 + 雙仙石 + 天成碑 + 云海中的青峰
// v28：亭后压成云谷，柱脚跟着落到谷底，柱身加长同样的高度，柱顶（和柱腰上的云带）不动
const keepTop = (x, z, R, H, seed, o) => { LAYOUT_V21.on = true; const y1 = withOldPath(() => terrainHeight(x, z)) - 1.5; LAYOUT_V21.on = false; let y0 = terrainHeight(x, z) - 1.5; for (let a = 0; a < 6.28; a += 0.8) y0 = Math.min(y0, terrainHeight(x + Math.cos(a) * R, z + Math.sin(a) * R) - 1.5); spire(x, z, R, H + Math.max(0, y1 - y0), seed, { ...o, y0: Math.min(y0, y1) }); };
for (let i = 0; i < 9; i++) { const r = rand(60 + i); keepTop(-150 - r() * 50, -48 - r() * 40, (4 + r() * 5) * 0.68, 30 + r() * 30, 60 + i, { lean: (r() - 0.5) * 0.3, top: 0.25, bulge: 0.32 }); } // 原画芙蓉城是一簇细高的石柱，v28 收细
// 雙仙石（1263 左下）：两块像人一样立着的石头，有头有肩，一高一矮相对
for (const [x, z, h, ry, sd] of [[-184.4, -8.4, 3.6, 0.5, 70], [-182.3, -8, 3.9, -0.4, 71]]) { const g = stoneFigureGeometry(sd, h); g.applyMatrix4(new THREE.Matrix4().makeRotationY(ry).setPosition(x, terrainHeight(x, z) - 0.3, z)); spires.push(g); circleCol(x, z, 0.8); }
function lowAt(x, z, R) { let y = terrainHeight(x, z); for (let a = 0; a < 6.28; a += 0.9) y = Math.min(y, terrainHeight(x + Math.cos(a) * R * 0.8, z + Math.sin(a) * R * 0.8)); return y; }
// 超然亭四周（v30，Yang：尽量 1:1 复刻原画）：按画境镜头把原画里每一簇石头的脚和顶反投影到地形上（c5/rc.mjs），
// 一簇是一块主石加几块矮的靠着。石头多半立在陡坡上：按坡下最低处落脚，顶对齐原画（top 是顶的绝对高度）
{
  const r = rand(4100);
  const low = lowAt;
  const cluster = (x, z, R, H, n, sd, o = { lump: true }) => { // v31 原画的石头是圆浑的石块，竖着几道褶
    const yc = terrainHeight(x, z), top = yc + H, a0 = r() * 6.28;
    placeBlock(spires, terrainHeight, x, z, R, R * 0.8, (top - low(x, z, R)) / 0.88, a0, 4100 + sd * 5, o); circleCol(x, z, R * 0.8);
    for (let k = 1; k < n; k++) {
      const a = a0 + k * 2.4 + (r() - 0.5) * 0.8, d = R * (0.95 + r() * 0.35), s = 0.5 + r() * 0.25, cx = x + Math.cos(a) * d, cz = z + Math.sin(a) * d, rr = R * s;
      const t = terrainHeight(cx, cz) + H * (0.35 + r() * 0.35);
      placeBlock(spires, terrainHeight, cx, cz, rr, rr * 0.85, Math.max(0.6, (t - low(cx, cz, rr)) / 0.88), r() * 6.28, 4100 + sd * 5 + k, { lump: true, taper: 0.75 });
    }
  };
  // 亭下那片石坡（原画亭正下方两大块石青石、右下一块、左下几小块）
  cluster(-157.9, -11, 1.7, 5.9, 3, 1); cluster(-151.1, -9.8, 1.3, 4.4, 3, 2); cluster(-155.2, -12.6, 0.9, 1.8, 1, 3); cluster(-167.1, -10.5, 1.1, 3.6, 2, 4); cluster(-173.8, -14.6, 1.2, 4, 2, 5); cluster(-182.3, -13.8, 1.2, 3.8, 2, 6);
  // 左边那一大片石青山（原画左半从二姑峰脚下一直落到云里）
  // v31：叠成一整座——前面一排矮而宽的圆石，后面一层高些，最上面一块收顶
  cluster(-180.5, -14.5, 3, 5.5, 2, 7); cluster(-184.5, -14, 2.5, 4.6, 2, 19); cluster(-177, -13.6, 1.9, 3.8, 2, 9);
  cluster(-181.6, -16.9, 2.5, 9.5, 2, 8, { lump: true, taper: 0.72 }); cluster(-185, -17.2, 2.1, 8.2, 2, 20, { lump: true, taper: 0.72 });
  cluster(-182.8, -19.3, 1.8, 11.5, 1, 21, { lump: true, taper: 0.65 });
  // 亭左后一簇、亭后山头两簇
  cluster(-169.2, -23.2, 1.6, 4.4, 3, 10); cluster(-161.6, -32.8, 2, 6, 3, 11); cluster(-158.1, -31.4, 1.5, 4.3, 2, 12);
  // 右边小路：路后几簇，亭右后两根细高的石柱
  cluster(-142.6, -17.6, 1.2, 3.1, 1, 13); cluster(-135.8, -20.5, 1.1, 2.2, 1, 14); cluster(-136.1, -15.4, 1.4, 3, 2, 15); cluster(-144.5, -24.6, 1.8, 3.6, 3, 16);
  cluster(-151.9, -27.6, 1.4, 8, 1, 17, { lump: true, taper: 0.6, bulge: 0.08 }); cluster(-153.9, -28.8, 1.3, 6.7, 1, 18, { lump: true, taper: 0.6, bulge: 0.08 });
  // v32（Yang：地面要有错落和层次）：坡上半埋的碎石，大多露在台坎上，一两块挨着
  { const q = rand(5205); let got = 0;
    for (let i = 0; i < 900 && got < (MOBILE ? 40 : 70); i++) {
      const x = -199 + q() * 66, z = -44 + q() * 56, p = pathAt(x), R = 0.35 + q() * q() * 0.9, Hv = R * (0.6 + q() * 0.8);
      if (Math.abs(z - p.z) < 3.5 || Math.hypot(x - CHAORAN.x, z - CHAORAN.z) < 7.5 || blocked(x, z, R + 0.3)) continue;
      if (STAIRS2.some((S) => distToLine(x, z, S) < 2) || slopeAt(x, z) < 0.25 || slopeAt(x, z) > 2.2) continue;
      const y = terrainHeight(x, z) + Hv;
      placeBlock(spires, terrainHeight, x, z, R, R * (0.7 + q() * 0.3), Math.max(0.4, (y - lowAt(x, z, R)) / 0.88), q() * 6.28, 5205 + i, { lump: true, taper: 0.85 }); if (R > 0.6) circleCol(x, z, R * 0.7);
      got++;
    }
  }
}
exitV33();
for (const c of TEMPCOL) COLLIDERS.splice(COLLIDERS.indexOf(c), 1);
// v34 琪樹峡（Yang：照着原画 1:1 雕琢）：按画境镜头把 IMG_1264 里一块块石头的脚、顶、左右沿反投影到地形上摆（paintHit），
// 原画石头紧贴石阶两边，碰到游线、石阶的往外让一点；大石之间再填满峡的碎石
const PAINT6 = (() => { // S06 画境镜头：原画像素 (u, v)（1280×720）→ 地形上的点 / 某个 z 平面上的点
  const V = STAGES.find((S) => S.id === 'S06').view, cam = new THREE.PerspectiveCamera(V.fov, 16 / 9, 0.1, 1000);
  cam.position.set(...V.pos); cam.lookAt(...V.at); cam.updateMatrixWorld();
  const rayOf = (u, v) => new THREE.Vector3(u / 640 - 1, 1 - v / 360, 0.5).unproject(cam).sub(cam.position).normalize();
  const hitAt = bakedFn('S06', (u, v) => { const d = rayOf(u, v), o = cam.position; for (let t = 5; t < 300; t += 0.1) { const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t; if (y < terrainHeight(x, z)) return [x, y, z]; } return null; }); // v42 落点可预存
  const onZ = (u, v, z) => { const d = rayOf(u, v), o = cam.position, t = (z - o.z) / d.z; return [o.x + d.x * t, o.y + d.y * t, z]; };
  return { hitAt, onZ, V };
})();
const V6 = PAINT6.V;
const PINE6PX = [[300, 112, 0.6], [215, 160, 0.55], [380, 250, 0.5], [470, 205, 0.5], [760, 205, 0.55], [690, 160, 0.5]]; // 琪樹峡几株小松在原画上的位置
{
  const { hitAt, onZ } = PAINT6;
  const nearPt = (x, z, S) => { let best = null; for (let i = 0; i < S.length - 1; i++) { const [ax, az] = S[i], [bx, bz] = S[i + 1], vx = bx - ax, vz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz))), px = ax + vx * t, pz = az + vz * t, d = Math.hypot(x - px, z - pz); if (!best || d < best[0]) best = [d, px, pz]; } return best; };
  const clear = (x, z, rad) => { // 让开游线和石阶
    for (let k = 0; k < 6; k++) {
      const pz = pathAt(x).z, gp = 2.4 + rad; if (Math.abs(z - pz) < gp) z = pz + Math.sign(z - pz || 1) * gp;
      for (const S of STAIRS2) { const [d, px, qz] = nearPt(x, z, S), gs = 1.3 + rad; if (d < gs) { const k2 = gs / Math.max(d, 0.01); x = px + (x - px) * k2; z = qz + (z - qz) * k2; } }
    }
    return [x, z];
  };
  const r = rand(4060), H = (x, z) => terrainHeight(x, z);
  const FH = [V6.at[0] - V6.pos[0], V6.at[2] - V6.pos[2]], fl = Math.hypot(...FH); FH[0] /= fl; FH[1] /= fl; // 镜头水平朝向
  const FACE6 = Math.atan2(-FH[0], -FH[1]); // 石头本地 x 轴（宽面）对着镜头右方
  const putP = (u, vb, vt, ul, ur, o = {}) => {
    const p = hitAt(u, vb); if (!p) return;
    // 原画上石头的底沿是石头朝镜头的前脚：石心往里退半个进深，前脚落在反投影点上，顶对齐原画的顶
    const W = onZ(ur, vb, p[2])[0] - onZ(ul, vb, p[2])[0], w = (o.w || 1) * W / 2.3 * 1.2, dd = w * (o.d || 0.75), back = dd * 0.8 + (o.back || 0);
    const [x, z] = o.fix ? [p[0], p[2]] : clear(p[0] + FH[0] * back, p[2] + FH[1] * back, w * 0.9);
    const low = Math.min(H(x, z), H(x - FH[0] * dd * 0.8, z - FH[1] * dd * 0.8)); // 石心和朝镜头的前脚取低的（侧坡不往坡下拖长）
    const top = onZ(u, vt, z)[1], h = Math.max(1, (top - low) / 0.98) * (o.h || 0.92);
    placeBlock(o.grey ? GREY6 : BLUE6, H, x, z, w, dd, h, o.ry ?? FACE6 + (r() - 0.5) * 0.6, 6000 + Math.round(u * 3 + vb), o.grey ? { pillow: true, taper: 0.86, slant: 0.12, front: 0.16, ...o.blk } : { craggy: true, res: MOBILE ? 15 : 20, aO: true }); // v35 圆角方块；v37 石青石改嶙峋石（距离场雕），灰方石仍是圆角方块 // 宽面朝镜头（原画的石头都是正面看过去的一堵堵方块）
    if (w > 0.7) circleCol(x, z, w * 0.85);
    ROCK6.push([x, z, w]);
  };
  // [底中心 u, 底 v, 顶 v, 左 u, 右 u]（1280×720 的原画坐标）
  for (const [u, vb, vt, ul, ur, o] of [
    [645, 395, 272, 600, 693, { grey: 1, blk: { taper: 0.92, slant: 0.1 } }], [697, 400, 320, 667, 727], [745, 545, 362, 700, 795, { grey: 1, blk: { taper: 0.92, slant: 0.08 } }], [828, 530, 350, 785, 868, { grey: 1, blk: { taper: 0.9, slant: 0.1 } }], // 峡心：左上灰方石、石青石，右边一大堵灰白石壁
    [637, 500, 418, 590, 683, { grey: 1 }], [578, 625, 495, 538, 618], [482, 432, 365, 455, 510], [408, 430, 350, 380, 435], // 白衣人前后
    [445, 310, 250, 410, 480], [520, 350, 300, 495, 545], [527, 280, 205, 500, 555], [520, 322, 270, 470, 570], [715, 285, 255, 690, 740], [805, 355, 310, 775, 835], // 上段石阶两边、峡顶
    [405, 200, 125, 360, 450], [800, 270, 215, 755, 845], [885, 245, 200, 845, 930], // 左山头、峡顶右边
    [270, 340, 275, 230, 320], [360, 380, 300, 320, 420], [165, 345, 283, 135, 200], [145, 420, 340, 110, 180], [30, 430, 340, 0, 60], // 左山坡
    [410, 440, 400, 390, 430], [460, 440, 400, 440, 480], [520, 450, 400, 490, 560], [660, 560, 520, 640, 680], [785, 545, 505, 760, 810], [460, 530, 470, 440, 480],
    [810, 645, 545, 740, 880], [870, 460, 400, 850, 890], [785, 700, 655, 750, 820], [900, 705, 670, 875, 925], // 峡底、琪樹右
    [960, 560, 500, 930, 990], [1025, 510, 420, 990, 1065], [1003, 360, 300, 970, 1035], [970, 420, 380, 950, 990], [1005, 640, 545, 935, 1080], // 右坡
    [1030, 225, 150, 995, 1065, { h: 0.6 }], [1140, 170, 125, 1105, 1180, { h: 0.6 }], // 縹緲亭两边（半藏在松下）
  ]) putP(u, vb, vt, ul, ur, o);
  // 满峡的碎石：在原画石阵的范围里（像素多边形）随机取点，反投影到地上；越近越小
  const GORGE = [[400, 300], [445, 205], [520, 165], [600, 195], [700, 255], [790, 300], [860, 340], [890, 430], [910, 520], [990, 560], [1010, 660], [980, 715], [620, 715], [600, 650], [540, 610], [470, 530], [420, 460], [400, 380]]; // v35 往左上石阶一带扩
  const inPoly = (u, v, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [ui, vi] = P[i], [uj, vj] = P[j]; if ((vi > v) !== (vj > v) && u < (uj - ui) * (v - vi) / (vj - vi) + ui) c = !c; } return c; };
  // v35（Yang：峡里填满）：碎石更多、更小的也有，可以贴着石阶和游线边，彼此挨得更紧
  const PINES = PINE6PX.map(([u, v]) => hitAt(u, v)).filter(Boolean); // 原画左山脊上那几株小松的位置先留出来
  const near6 = (x, z, w) => Math.abs(z - pathAt(x).z) > 1.9 + w * 0.75 && STAIRS2.every((S) => distToLine(x, z, S) > 1.0 + w * 0.75) && PINES.every((P) => Math.hypot(P[0] - x, P[2] - z) > 1.2 + w);
  for (let i = 0, n = 0; i < 4000 && n < (MOBILE ? 120 : 230); i++) {
    const u = 380 + r() * 640, v = 150 + r() * 570; if (!inPoly(u, v, GORGE)) continue;
    const p = hitAt(u, v); if (!p) continue;
    const w = 0.6 + Math.pow(r(), 1.4) * 2.5, x = p[0] + FH[0] * w * 0.6, z = p[2] + FH[1] * w * 0.6;
    if (!near6(x, z, w) || ROCK6.some(([qx, qz, qw]) => Math.hypot(qx - x, qz - z) < (qw + w) * 0.42)) continue;
    placeBlock(BLUE6, H, x, z, w, w * (0.65 + r() * 0.25), w * (0.85 + r() * 0.7), FACE6 + (r() - 0.5) * 0.8, 6500 + i % 24, { craggy: true, res: MOBILE ? 12 : 14, aO: true }); // v37 碎石取 24 块嶙峋石轮着用（尺寸、朝向各不同）
    if (w > 0.8) circleCol(x, z, w * 0.85);
    ROCK6.push([x, z, w]); n++;
  }
}
// v36 磐玉隈（Yang：照原画 1:1 过稿，IMG_1265）：巨岩不再用石坎网格（world.js rocks2At 里 s7 那几块在新布局里不算），
// 改成几块网格石拼起来，位置由画境镜头反投影（c5/rc7.mjs、z7.mjs）：凹岩左上一大块裂成一层层的灰赭石，往前探着罩住下棋的人；
// 凹岩右边一堵青灰石壁；再往右一块往左上翘起的大斜石板，板头上长一株大杂树
const PAN7 = [];
{
  const H = (x, z) => terrainHeight(x, z);
  const big = (x, z, w, d, top, o = {}) => {
    let lo = H(x, z); for (let a = 0; a < 6.28; a += 0.5) lo = Math.min(lo, H(x + Math.cos(a) * w * 0.9, z + Math.sin(a) * d * 0.9));
    const y0 = o.y0 ?? lo - 1, h = o.h ?? top - y0;
    placeBlock(PAN7, H, x, z, w, d, h, o.ry ?? 0, o.seed ?? Math.round(x * 13 - z * 7), { ...o, y0, aO: true });
    if (o.col !== 0) circleCol(x, z, o.col ?? Math.min(w, d) * 0.85);
  };
  const GO = 0.95, BG = 0.66, SL = 0.72; // 灰赭、青灰、石板的灰青（rockMaterial paint 里按 aM 取色）
  // 凹岩左上的大石（原画 u 485–715、v 180–480）：后面三块从地上起（左上一块顶上偏青、往左探到石阶上方），
  // 前面两层叠在凹岩口上：上层一大片裂开的石坎，下层是罩住下棋人的石檐（檐口离地三米多）
  // 注意 w、d 是半宽半深（几何体半径约 1）。石层按原画往右下斜（shear kx<0），一块块错落着往凹岩口跌下来
  big(-68.6, -28.8, 3.2, 3, 34.5, { lump: true, taper: 0.85, tone: GO, ry: 0.3, seed: 7006, lean: [-0.13, 0], col: 2.2 });
  big(-69.2, -28.4, 3.4, 2.8, 36.2, { lump: true, taper: 0.75, tone: 0.64, ry: 0.9, seed: 7016, y0: 29, lean: [-0.1, 0], col: 0 });          // 左上角顶上一块偏青的石头
  big(-64.2, -26, 5.8, 4.5, 36.6, { lump: true, taper: 0.82, tone: GO, ry: 0.1, seed: 7001, shear: [-0.3, 0], col: 4.5 });
  big(-59.5, -23.5, 4, 3.6, 33.5, { lump: true, taper: 0.85, tone: GO, ry: -0.3, seed: 7003, shear: [-0.4, 0], col: 2.5 });
  big(-67.4, -24, 2.4, 2.4, 31, { lump: true, taper: 0.85, tone: GO, ry: 0.7, seed: 7009, shear: [-0.4, 0], col: 1.6 });       // 左脸，贴着石阶
  big(-64, -22.3, 5.5, 2.6, 24, { lump: true, taper: 0.9, tone: GO, ry: 0.05, seed: 7008, col: 2.4 });                       // 凹岩后壁
  big(-63.8, -21.6, 6, 2.8, 29, { lump: true, taper: 0.9, tone: GO, ry: 0.05, seed: 7007, y0: 21.5, shear: [-0.45, 0], col: 0 }); // 上层石坎
  big(-61, -20.6, 2.4, 2, 27.5, { lump: true, taper: 0.88, tone: GO, ry: -0.4, seed: 7010, y0: 20, shear: [-0.5, 0], col: 0 });
  big(-66, -18.9, 2.6, 2, 0, { lump: true, taper: 0.9, tone: GO, ry: 0.2, seed: 7005, y0: 19.6, h: 4, shear: [-0.35, 0], lean: [0, 0.1], col: 0 });   // 石檐（两块）
  big(-61.6, -18.7, 2.8, 2.1, 0, { lump: true, taper: 0.9, tone: GO, ry: -0.15, seed: 7015, y0: 18.3, h: 4.5, shear: [-0.35, 0], lean: [0, 0.1], col: 0 });
  big(-67.6, -19.8, 2, 2.2, 23, { lump: true, taper: 0.8, tone: GO, ry: 1.1, seed: 7004, col: 1.4 });                    // 左门柱
  // 凹岩右边的青灰石壁（u 715–800），壁右一道赭灰石坎托着石板头
  big(-55.2, -19.5, 3, 2.1, 29.6, { craggy: true, res: MOBILE ? 16 : 22, tone: BG, ry: 0.15, seed: 7011, col: 2 }); // v37 石壁也改嶙峋石（原画是一堵起伏的石青壁）
  big(-51.2, -22.5, 1.9, 1.9, 27, { craggy: true, res: MOBILE ? 14 : 18, tone: 0.9, ry: -0.2, seed: 7012, col: 1.6 });
  // 大斜石板（原画板头在 u 940、v 185，往右一路斜下到 u 1190、v 470）：左段往上翘到板头，右段从板头斜落下去，顶面往前低
  big(-44.5, -24.5, 5, 3, 0, { pillow: true, taper: 0.97, tone: SL, seed: 7014, y0: 9, h: 22.8, shear: [0.8, -0.3], shoulder: 0.06, n: 30, m: 16, col: 0 });
  big(-29, -24, 11, 3.25, 0, { pillow: true, taper: 0.97, tone: SL, seed: 7013, y0: 2, h: 22.5, shear: [-1.0, -0.3], shoulder: 0.06, n: 40, m: 18, col: 0 });
  for (let x = -48; x <= -20; x += 4) circleCol(x, -24, x > -26 ? 3.5 : 4.5);
  // 前景（原画下缘）：凹岩口前、右下、左下几堆圆浑的石青石；凹岩口前中间留出进洞的路
  for (const [x, z, w, s] of [[-67.8, -8.5, 2, 7031], [-61.3, -8.6, 2.2, 7032], [-60, -5.8, 1.1, 7033], [-69.6, -7, 1.2, 7034],
    [-38.5, -5, 2.4, 7035], [-35.4, -6.8, 1.2, 7036], [-33, -8.6, 2, 7037], [-28, -5.2, 1.5, 7038],
    [-86, -9, 1.8, 7039], [-89, -9.2, 2.2, 7040], [-88, -1.2, 1.4, 7041], [-90.3, -1.8, 0.9, 7042]])
    big(x, z, w, w * 0.8, 0, { craggy: true, res: MOBILE ? 16 : 22, tone: 0.45, ry: x * 0.7, seed: s, h: w * 0.95 + 1, col: w > 0.8 ? w * 0.85 : 0 });
}
// 二姑峰：亭左后方一根高高的石青柱（原画左上，脚藏在左边那片石山后面）
{ const x = -190, z = -38, g0 = terrainHeight(x, z); spire(x, z, 3.2, 38.5 - g0, 72, { top: 0.32, bulge: 0.12, lean: 0.06, minGround: true }); }
for (let i = 0; i < 6; i++) { const r = rand(80 + i); keepTop(-195 - r() * 10, -40 - r() * 50, 3 + r() * 3, 18 + r() * 18, 80 + i, {}); }
// 觀音岩（v39 起是 world.js LOBED3 里的一座青绿圆山，不再立石柱）
// 觀音岩：白衣观音石像，红柱尖顶龛罩着，右下方立幡杆挂黄幡（IMG_1262）
const GY = { x: GY3.x, z: GY3.z, ry: GY3.ry }; // v39 按原画挪到禪窩左后方的坡上
const GYB = MOYA3; // v39 摩崖大像挪到游线近侧（画面下缘以外） // 摩崖大龛（龛口地面中心）
// 岩体本身和龛前不种树，免得树从岩里穿出来；龛前留一条到游线的视线廊
function inMoya(x, z) { const c = Math.cos(MOYA.ry), s = Math.sin(MOYA.ry), lx = (x - MOYA.x) * c - (z - MOYA.z) * s, lz = (x - MOYA.x) * s + (z - MOYA.z) * c; return lz > -31 && (Math.abs(lx) < 26 && lz < 14 || Math.abs(lx) < 15 && lz < 44); }
const gyGeo = buildGuanyinStatue({ sculpted: true }); // 两尊像共用一份几何；头另载（Blender 雕的水月观音头），载不到就退回程序头
const gyHeads = [], gyBodies = [];
function addGyHead(body) { const h = new THREE.Mesh(new THREE.BufferGeometry(), body.material); h.visible = false; body.add(h); gyHeads.push(h); gyBodies.push(body); }
loadGuanyinHead(A + 'guanyin_head.txt?v=7').then((g) => { for (const h of gyHeads) { h.geometry = g; h.visible = true; } })
  .catch((e) => { console.warn('观音头像未载入，用程序头', e); const g = buildGuanyinStatue(); for (const b of gyBodies) b.geometry = g; });
let moyaCliff = null;
{
  // 石像立在一块突起的岩台上（顶面比平台高约 2.4 米），龛的四根红柱从岩台外侧一直撑到下面的平台
  const RH = 2.6, rk = spire(GY.x, GY.z, 1.3, RH, 89, { top: 0.86, bulge: 0.1 }), ah = rk.attributes.aH;
  for (let i = 0; i < ah.count; i++) ah.setX(i, ah.getX(i) * 0.3); // 岩台用崖脚的赭色，不上石青
  const y = terrainHeight(GY.x, GY.z) - 1.5 + RH * 0.975, c = Math.cos(GY.ry), s = Math.sin(GY.ry);
  const toW = (lx, lz) => [GY.x + lx * c + lz * s, GY.z - lx * s + lz * c];
  const statue = new THREE.Mesh(gyGeo, statueMaterial());
  statue.position.set(GY.x, y, GY.z); statue.rotation.y = GY.ry; statue.scale.setScalar(0.9); scene.add(statue); addGyHead(statue);
  const cn = buildGuanyinCanopy((lx, lz) => { const [wx, wz] = toW(lx, lz); return terrainHeight(wx, wz) - y; }, { TOP: 5.75, S: 0.85 });
  place(cn.geometry, GY.x, GY.z, GY.ry, y);
  for (const f of cn.feet) { const [wx, wz] = toW(f.x, f.z); circleCol(wx, wz, 0.2); }
  const PX = POLE3.x, PZ = POLE3.z, pole = buildBannerPole(7.4), py = place(pole.geometry, PX, PZ, GY.ry);
  circleCol(PX, PZ, 0.45);
  const ban = buildBanner(3.1, 0.36); ban.position.set(PX + pole.hang.x * c, py + pole.hang.y, PZ - pole.hang.x * s); ban.rotation.y = GY.ry;
  scene.add(ban); timed.push(ban.material);
}
  // 摩崖大像：同一尊像放大 8 倍（约 35 米），土黄石色，立在左后方崖面凿出的圆拱大龛里，龛前一片平台
  {
    const B = GYB, cb = Math.cos(B.ry), sb = Math.sin(B.ry), toW = (lx, lz) => [B.x + lx * cb + lz * sb, B.z - lx * sb + lz * cb];
    moyaCliff = new THREE.Mesh(buildMoyaCliff(), rockMaterial(tex.rock, tex.cliff, { niche: true }));
    moyaCliff.position.set(B.x, B.y - 0.3, B.z); moyaCliff.rotation.y = B.ry; scene.add(moyaCliff);
    const [sx, sz] = toW(0, -9.6);
    const big = new THREE.Mesh(gyGeo, statueMaterial({ tint: [0.82, 0.7, 0.52], weather: 1 }));
    big.position.set(sx, B.y, sz); big.rotation.y = B.ry; big.scale.setScalar(10.4); scene.add(big); addGyHead(big);
    circleCol(sx, sz, 9.6);
    for (const [lx, lz, hw, hd] of [[0, -21, 23, 7.5], [-18, -7, 5, 7], [18, -7, 5, 7]]) { const [wx, wz] = toW(lx, lz); boxCol(wx, wz, hw, hd, B.ry); }
  }
// 龍湫（v39 起按原画做成岩洞，见下面 GROTTO3 一段）
// 水犀洞尖峨岩峰
spire(-299, -30, 5, 30, 96, { top: 0.12, lean: 0.1 }); spire(-288, -28, 3, 16, 97);
// 四陽洞
spire(-342, -24, 5, 18, 98, { top: 0.6 }); spire(-330, -26, 4.5, 16, 99, { top: 0.6 });
{ const g = boulderGeometry(13); g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(-336, 14, -25), new THREE.Quaternion(), new THREE.Vector3(9, 3.5, 5))); spires.push(g); }
// 玉女潭：崖顶石青巨石与潭边、坡上的石块（细分精模）
{
  const ROCKS = [[22, -27, 3.2], [30, -29, 2.4], [44, -27, 3.6], [52, -22, 2.6], [17, -23, 2.2], [40, -31, 2], [35, -26.5, 1.6], [9, -24, 1.8], [57, -26, 2.2],
    [24, -3, 1.3], [44, -3.5, 1.1], [20, -9, 0.9], [50, -11, 1.0], [32, 28, 1.6], [52, 32, 1.9], [6, 24, 1.4], [70, 16, 1.5], [-2, 2, 1.0], [62, -6, 1.2], [26, 20, 0.8],
    // 金晶巖洞口两侧、前景山包上的石青石
    [286, -15, 2.6], [289, -20, 2.0], [311, -16, 2.4], [309, -22, 1.8], [292, -9, 1.2], [306, -8, 1.0], [280, 11, 2.2], [287, 18, 1.8], [316, 10, 2.4], [323, 16, 2.0],
    [276, -8, 1.6], [326, -2, 1.5], [260, 12, 1.8], [266, 18, 1.4],
    // 大觀廊右下角的石青石（IMG_1270 右下）
    [266, 7, 2.4], [271, -6, 1.9], [272, 10, 2.6],
    // 林泉雅集：溪边石青石
    [140, -11, 1.3], [145, -7.5, 1.0], [158, -12.5, 1.2], [163, -13, 1.6], [186, -3, 1.4], [190, -0.5, 1.1], [200, 10, 1.3], [205, 18, 1.6], [126, -15, 1.2],
    [96, -12, 1.4], [125, -3, 1.3], [108, 8, 1.0],
    // 隅九桥溪：源头压一块大石，上游岸边和桥下游两侧几块
    [217.4, -20.2, 1.7], [215.6, -17.6, 1.1], [220.6, -19.8, 0.9], [221.5, -8.5, 0.9], [228.6, 6.2, 0.9], [235.8, 4.6, 1.0]];
  // 坡包脚下成簇的石青石：一大两小挤在一起（原画下缘的石组）
  { const r = rand(6061);
    for (const F of FORE) for (let g = 0; g < (F.r > 8 ? 2 : 1); g++) {
      for (let t = 0; t < 8; t++) {
        const a = r() * 6.28, d = F.r * (0.65 + r() * 0.35), x = F.x + Math.cos(a) * d, z = F.z + Math.sin(a) * d, md = foreMound(x, z);
        if (md < 0.3 || md > 2.2 || Math.abs(z - pathAt(x).z) < 5 || waterLevel(x, z) > -1e8 || distToStream(x, z).d < 3) continue;
        const big = 1.1 + r() * 0.9; ROCKS.push([x, z, big]);
        for (let k = 0; k < 2; k++) { const b = r() * 6.28; ROCKS.push([x + Math.cos(b) * big * 1.3, z + Math.sin(b) * big * 1.3, big * (0.4 + r() * 0.25)]); }
        break;
      }
    } }
  for (const [x, z, s] of ROCKS) {
    if (onMassif(x, z)) continue; // 隐春巖石壁里不再放散石
    const g = rockGeometry(Math.round(x * 7 + z * 3), s > 1.5 ? 4 : 3).toNonIndexed();
    g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, terrainHeight(x, z) - 0.35 * s, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, x, 0)), new THREE.Vector3(s, s, s)));
    spires.push(g);
    if (s > 0.7 && z > -20) circleCol(x, z, s * 1.1);
  }
}
// v39 龍湫（IMG_1261）：层层赭灰巨岩里一个深洞，洞里一潭水、几根石柱；洞口上方几层石青石檐往外探，檐上几丛红叶；洞右前一块大青石题“龍湫”。
// 原画里没有白瀑布，旧的瀑布撤掉。位置按 S03 画境镜头反投影（ch3/cam.py）
{
  const G = GROTTO3, H = (x, z) => terrainHeight(x, z), RES = MOBILE ? 14 : 20;
  const blk = (x, z, w, d, y0, top, o = {}) => {
    if (o.col !== 0) for (const a of [-0.5, 0, 0.5]) for (const b of [-0.5, 0, 0.5]) y0 = Math.min(y0, H(x + a * w, z + b * d) - 0.5); // 落地的石头脚埋进地里，不悬空
    placeBlock(PAN7, H, x, z, w, d, top - y0, o.ry ?? 0, o.seed ?? Math.round(x * 11 - z * 5), { res: RES, ...o, y0, aO: true }); if (o.col !== 0) circleCol(x, z, o.col ?? Math.min(w, d) * 0.8); };
  const GO = 0.95, BG = 0.66, BL = 0.45;
  // 洞右边和后上方：一层层赭灰巨岩（原画 u .45–.75，方硬的大石一块块叠上去）
  blk(-260.6, -27.2, 4.2, 4.4, 5.5, 17, { craggy: true, tone: GO, ry: 0.15 });
  blk(-255, -29.5, 4.6, 5, 6.5, 20.5, { craggy: true, tone: GO, ry: -0.2 });
  blk(-262.4, -31, 4.5, 4, 14, 24, { craggy: true, tone: 0.9, ry: 0.4, col: 0 });
  blk(-256.4, -33.5, 5, 4.5, 16, 25.2, { craggy: true, tone: GO, ry: 0.1, col: 0 });
  // 洞左边的石壁和山肩（老松长在上头）
  blk(-275.6, -25.2, 3.4, 4.2, 4, 11.2, { craggy: true, tone: GO, ry: -0.2 });
  blk(-278.6, -28.8, 3.6, 4, 5.5, 12.4, { craggy: true, tone: 0.9, ry: 0.3 });
  blk(-274.4, -31, 3.4, 3.4, 9, 16.5, { craggy: true, tone: GO, ry: 0.6, col: 0 });
  // 洞顶：后半一整块压着；前沿几层石青石檐往外探、往右低下去
  blk(-268.6, -28.6, 5.8, 4.8, 12.2, 21.5, { craggy: true, tone: GO, ry: 0, col: 0 });
  blk(-269.5, -22.8, 4.2, 2.6, 12.0, 14.1, { pillow: true, tone: BL, ry: 0.1, col: 0 });
  blk(-265.6, -21.8, 3.8, 2.4, 11.2, 12.9, { pillow: true, tone: BL, ry: -0.05, col: 0 });
  blk(-271.3, -24, 3.2, 2.6, 13.7, 16.0, { pillow: true, tone: 0.52, ry: 0.25, col: 0 });
  blk(-267.1, -24.6, 3.6, 2.4, 13.9, 15.7, { pillow: true, tone: BL, ry: -0.1, col: 0 });
  // v39 第二轮：岩体再加厚加高（原画 u .45–.72 一整片方硬大石一直顶到画面上缘）
  blk(-252, -27, 5.5, 5, 9, 21, { craggy: true, tone: 0.9, ry: 0.25 });
  blk(-258, -22, 4.5, 4, 7, 15, { craggy: true, tone: GO, ry: -0.35 });
  blk(-253, -36, 6, 5, 19, 29, { craggy: true, tone: 0.9, ry: -0.15, col: 0 });
  blk(-260, -36.5, 5, 4.5, 20, 27.5, { craggy: true, tone: GO, ry: 0.35, col: 0 });
  // 题“龍湫”的大青石（洞口右前，原画 u .45–.6、v .38–.66）
  blk(LONGQIU3.x, LONGQIU3.z, 5.0, 3.4, LONGQIU3.y - 1.2, LONGQIU3.y + 7.2, { craggy: true, tone: 0.74, ry: -0.25, seed: 7391, col: 3.4 }); // 原画这块是灰里带青
  // 洞里的石柱：从洞顶垂到水边，赭色
  for (const [x, z, r] of [[-271.2, -25.6, 0.55], [-268.4, -26.6, 0.7], [-265.8, -25.2, 0.5]]) spire(x, z, r, G.top - G.floor + 1.2, Math.round(-x * 3), { y0: G.floor - 0.8, top: 0.55, bulge: 0.15 });
  // 洞里：暗下去的洞壁（半个椭球，开口朝外）
  { const k = new Kit(), g = new THREE.SphereGeometry(1, 18, 12, 0, Math.PI); g.scale(G.hw * 1.15, 9, G.front - G.back + 1); g.rotateY(Math.PI);
    k.add(g, new THREE.Color('#2f271e'), 0, new THREE.Matrix4().makeTranslation(G.x, G.floor - 1, G.front + 0.4)); staticParts.push(k.geometry()); }
  // 石檐上的几丛红叶（原画洞口上方的红树）
  { const k = new Kit(), red = [new THREE.Color('#b0473a'), new THREE.Color('#c25a44'), new THREE.Color('#9a3c33')], rr = rand(3911);
    for (const [cx, cy, cz, n] of [[-270.1, 15.3, -21.6, 9], [-272.7, 16.7, -24.4, 7], [-264.7, 13.7, -20.8, 6]]) for (let i = 0; i < n; i++) {
      const g = new THREE.IcosahedronGeometry(0.45 + rr() * 0.35, 0); k.add(g, red[i % 3], 0, new THREE.Matrix4().makeTranslation(cx + (rr() - 0.5) * 2.4, cy + (rr() - 0.5) * 1.2, cz + (rr() - 0.5) * 1.6)); }
    staticParts.push(k.geometry()); }
  // 第三章其余的石青石：禪窩右边云里露出的一堆、左边绿坡脚下几块、觀音龛旁两块
  blk(-216, -30.5, 3.4, 3, 10.5, 20.5, { craggy: true, tone: BL, ry: 0.3 });
  blk(-212.6, -28.4, 2.6, 2.4, 10.5, 16.8, { craggy: true, tone: 0.5, ry: -0.4 });
  blk(-219.4, -33, 2.4, 2.2, 12, 18.6, { craggy: true, tone: BL, ry: 0.8 });
  blk(-250.6, -9.4, 2.2, 1.8, 10.2, 13.4, { craggy: true, tone: BL, ry: 0.4 });
  blk(-246.8, -12.6, 1.6, 1.4, 12.6, 15, { craggy: true, tone: 0.5, ry: -0.6 });
  blk(-243.4, -21.5, 1.8, 1.6, 14.4, 17.2, { craggy: true, tone: BL, ry: 0.2 });
  blk(-241.6, -24.6, 1.4, 1.3, 15.2, 17.2, { craggy: true, tone: 0.55, ry: 1.1 });
}
// v40 龍湫对岸（Yang 加的一景，原画没有；v38 时在龍湫，v39 起龍湫按原画做成岩洞，这一景挪到路另一侧的空地）：
// 一道朝着游线的石壁，瀑布从两块夹石之间的崖口出来，贴崖滑落，撞上半腰石台翻白，再落进深潭
const WF = (() => {
  const P = POOLW, X = P.x, H = (x, z) => terrainHeight(x, z), RES = MOBILE ? 14 : 20, i0 = PAN7.length;
  const blk = (x, z, w, d, y0, top, o = {}) => {
    if (o.col !== 0) for (const a of [-0.5, 0, 0.5]) for (const b of [-0.5, 0, 0.5]) y0 = Math.min(y0, H(x + a * w, z + b * d) - 0.5);
    placeBlock(PAN7, H, x, z, w, d, top - y0, o.ry ?? 0, o.seed ?? Math.round(x * 13 - z * 7), { res: RES, ...o, y0, aO: true }); if (o.col !== 0) circleCol(x, z, o.col ?? Math.min(w, d) * 0.8); };
  const GO = 0.95;
  blk(X, 37.2, 7, 5, 8, 27, { craggy: true, tone: GO, ry: 0.05 });                       // 正中出水的一块
  blk(X - 7, 38.4, 6, 5.5, 8, 24.5, { craggy: true, tone: 0.9, ry: -0.2 });
  blk(X - 12.5, 36.2, 4.5, 4.5, 8, 18, { craggy: true, tone: GO, ry: 0.4 });
  blk(X + 7, 38, 6, 5, 8, 25.5, { craggy: true, tone: 0.9, ry: 0.25 });
  blk(X + 12.4, 35.6, 4.5, 4, 8, 19, { craggy: true, tone: GO, ry: -0.35 });
  blk(X - 1, 42.2, 8, 5, 18, 31, { craggy: true, tone: 0.9, ry: 0.1, col: 0 });           // 崖顶再压一层
  blk(X - 7.5, 43.2, 6, 5, 18, 28, { craggy: true, tone: GO, ry: -0.3, col: 0 });
  blk(X + 6.5, 42.8, 6, 5, 18, 28.5, { craggy: true, tone: GO, ry: 0.3, col: 0 });
  blk(X - 2.3, 34.4, 2.2, 2, 23.6, 26.2, { pillow: true, tone: 0.5, ry: 0.2, col: 0 });    // 崖口两侧夹石（石青）
  blk(X + 2.2, 34.4, 2.2, 2, 23.4, 25.9, { pillow: true, tone: 0.45, ry: -0.15, col: 0 });
  blk(X + 0.2, 33.6, 3.4, 2.4, P.wl + 4.2, P.wl + 7.4, { craggy: true, tone: GO, col: 0 });  // 半腰石台：水撞上去翻白
  blk(X - 0.5, 32.8, 2.4, 1.8, P.wl - 1.2, P.wl + 2.6, { craggy: true, tone: 0.9, ry: 0.3, col: 0 }); // 潭边一级小石
  // 顺着崖面找水路：从潭心往崖上打水平射线；w 是往游线一侧的距离（= −z），瀑布在本地坐标里朝 +w 做好，再整体转 180°
  const meshes = PAN7.slice(i0).map((g) => new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })));
  const rc = new THREE.Raycaster(), o = new THREE.Vector3(), dir = new THREE.Vector3(0, 0, 1);
  const surf = (y) => { o.set(X, y, P.z); rc.set(o, dir); const h = rc.intersectObjects(meshes)[0]; return h ? -h.point.z : -1e9; };
  let y = 24.6;
  const path = [], impacts = [];
  let cy = y, cw = surf(y) + 0.3, airborne = false;
  for (; y > P.wl - 0.3; y -= 0.3) {
    const s = surf(y) + 0.35, wf = cw + 0.75 * Math.sqrt(Math.max(0, cy - y));
    let foam = 0;
    if (s >= wf) { if (airborne && cy - y > 1.5) { impacts.push(new THREE.Vector3(0, y, s)); foam = 1; } cy = y; cw = s; airborne = false; }
    else airborne = wf - s > 0.4;
    path.push({ p: new THREE.Vector3(0, y, Math.max(s, wf)), foam, fall: airborne ? Math.min(1, (cy - y) / 6) : 0 });
  }
  const last = path[path.length - 1].p; impacts.push(new THREE.Vector3(0, P.wl, last.z));
  for (let i = 0; i < path.length; i++) if (path[i].foam === 1) for (let k = -6; k <= 6; k++) { const q = path[i + k]; if (q) q.foam = Math.max(q.foam, 1 - Math.abs(k) / 6.5); }
  for (let k = 1; k <= 8; k++) { const q = path[path.length - k]; q.foam = Math.max(q.foam, 1 - k / 9); }
  path.forEach((q, i) => { q.w = (1.5 + 1.4 * Math.pow(i / path.length, 0.7)) * (q.fall > 0 ? 1 : 1.15); });
  const fall = createWaterfall(path, impacts, { mobile: MOBILE }); fall.position.x = X; fall.rotation.y = Math.PI; scene.add(fall);
  const W = (v) => new THREE.Vector3(X, v.y, -v.z);
  return { fall, top: W(path[0].p), bottom: W(last) };
})();
const rockIMs = [];
const spireMesh = new THREE.Mesh(mergeGeometries(spires), rockMat); scene.add(spireMesh);
const grey6Mesh = GREY6.length ? new THREE.Mesh(mergeGeometries(GREY6), rockMaterial(tex.rock, tex.cliff, { grey: true })) : null; if (grey6Mesh) scene.add(grey6Mesh); // v34 琪樹峡灰白大方石
const pan7Mesh = new THREE.Mesh(mergeGeometries(PAN7), rockMaterial(tex.rock, tex.cliff, { paint: true })); scene.add(pan7Mesh); // v36 磐玉隈巨岩
const blue6Mesh = BLUE6.length ? new THREE.Mesh(mergeGeometries(BLUE6), rockMaterial(tex.rock, tex.cliff, { paint: true })) : null; if (blue6Mesh) scene.add(blue6Mesh); // v35 琪樹峡石青石
// 洞口：暗色凹面
{
  const k = new Kit(), dark = new THREE.Color('#3b3328');
  const cave = (x, y, z, w, h, ry) => { const g = new THREE.SphereGeometry(1, 16, 10, 0, Math.PI); g.scale(w, h, 1.2); k.add(g, dark, 0, new THREE.Matrix4().makeRotationY(ry).setPosition(x, y, z)); };
  cave(-336, terrainHeight(-336, -21) + 0.2, -21.8, 2.6, 3, Math.PI); cave(-296.5, 12.2, -23.6, 2.2, 2.4, Math.PI);
  staticParts.push(k.geometry());
}

const staticMesh = new THREE.Mesh(mergeGeometries(staticParts), flat); scene.add(staticMesh);

// ---------- 石块（实例化）----------
await step('布散石');
{
  const geos = [0, 1, 2, 3].map((i) => boulderGeometry(100 + i, MOBILE ? 1 : 2));
  const lists = [[], [], [], []], sliceL = [[], [], [], []], crestL = [[], [], [], []], r = rand(5);
  for (let i = 0; i < 1400; i++) {
    const x = WORLD.x0 + 10 + r() * (WORLD.x1 - WORLD.x0 - 20), z = -90 + r() * 140;
    const p = CH3(x) ? pathOn(PATH, x) : pathV33At(x); const d = Math.abs(z - p.z); if (d < 3.5) continue; // v34：按 v33 游线判（随机数序列不变）；v39 第三章按旧游线判
    if (CH3(x) ? pondShape(x, z, POOL) < 1.02 : waterLevel(x, z) > -1e8) continue;
    const s = 0.3 + Math.pow(r(), 2.6) * (z < p.z - 15 ? 3.2 : 1.0);
    const y = terrainHeight(x, z) - s * 0.25;
    if (x > -40 && x < 95) { if (i % 5 === 0 && s < 1.1 && z > p.z - 40) sliceL[i % 4].push(new THREE.Matrix4().compose(new THREE.Vector3(x, y - s * 0.1, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r() * 6, 0)), new THREE.Vector3(s * 0.8, s * 0.7, s * 0.8))); if (s > 0.8 && d < 30) circleCol(x, z, s * 0.8); continue; }
    const M = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r() * 6, 0)), new THREE.Vector3(s * (1 + r() * 0.4), s, s));
    if (onMassif(x, z)) continue; // 隐春巖石壁上不撒（随机数照常取，别处的石头不变）
    if (CH2(x) || CH3(x)) continue; // 第二章（v27）、第三章（v39）石头按原画另摆
    if (x > 205 && x < 266 && z > -62 && z < -2) continue; // 大觀廊院子和左坡不撒石青石（原画只在右边山上和右下角有）
    if (x > 212 && x < 292 && z > -92 && z < 5) { LAYOUT_V21.on = true; const h0 = terrainHeight(x, z); LAYOUT_V21.on = false; if (Math.abs(h0 - y - s * 0.25) > 0.4) continue; } // 大觀廊 v25 起削过、填过的地上不放（会悬空）
    lists[i % 4].push(M);
    if (s > 0.8 && d < 30) circleCol(x, z, s * 0.9);
  }
  lists.forEach((L, i) => { const im = new THREE.InstancedMesh(geos[i], rockMat, L.length); L.forEach((m, j) => im.setMatrixAt(j, m)); im.computeBoundingSphere(); scene.add(im); rockIMs.push(im); });
  // 玉女潭一区：石青圆石成簇压在山脊、山头上（原画后山与靈應亭山头那样），不再满坡撒
  {
    const cand = [], rr = rand(77);
    for (let x = -30; x <= 95; x += 3) for (let z = -95; z <= -20; z += 3) {
      const h = terrainHeight(x, z); let avg = 0;
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; avg += terrainHeight(x + Math.cos(a) * 7, z + Math.sin(a) * 7); }
      const c = h - avg / 8;
      if (c > 0.7 && h - pathAt(x).y > 7 && !inMoya(x, z) && !PADS.some((P) => Math.hypot(x - P.x, z - P.z) < P.r + 3) && pondShape(x, z, POND) > 1.8) cand.push({ x, z, c });
    }
    cand.sort((a, b) => b.c - a.c);
    const picked = [];
    for (const c of cand) { if (picked.length >= 14) break; if (picked.every((p) => Math.hypot(p.x - c.x, p.z - c.z) > 11)) picked.push(c); }
    // 原画山头上的石青团块是圆的、半埋在山里，不是摆在坡上的扁石
    picked.forEach((c, ci) => {
      const n = 1 + Math.floor(rr() * 3), s0 = 1.9 + rr() * 1.4 + Math.min(c.c, 3) * 0.3;
      for (let k = 0; k < n; k++) {
        const s = k === 0 ? s0 : s0 * (0.4 + rr() * 0.3), a = rr() * 6.28, d = k === 0 ? 0 : s0 * (0.7 + rr() * 0.5);
        const x = c.x + Math.cos(a) * d, z = c.z + Math.sin(a) * d;
        crestL[(ci + k) % 4].push(new THREE.Matrix4().compose(new THREE.Vector3(x, terrainHeight(x, z) - s * 0.5, z), new THREE.Quaternion().setFromEuler(new THREE.Euler((rr() - 0.5) * 0.25, rr() * 6, (rr() - 0.5) * 0.25)), new THREE.Vector3(s * (1.0 + rr() * 0.3), s * (0.85 + rr() * 0.2), s)));
      }
    });
  }
  // 玉女潭一区用细分石块
  const hd = [0, 1, 2, 3].map((i) => rockGeometry(200 + i, 2));
  sliceL.forEach((L, i) => { const im = new THREE.InstancedMesh(hd[i], rockMat, L.length); L.forEach((m, j) => im.setMatrixAt(j, m)); im.computeBoundingSphere(); scene.add(im); rockIMs.push(im); });
  crestL.forEach((L, i) => { const im = new THREE.InstancedMesh(hd[i], crestMat, L.length); L.forEach((m, j) => im.setMatrixAt(j, m)); im.computeBoundingSphere(); scene.add(im); rockIMs.push(im); });
}

// ---------- 树（实例化）----------
await step('种林木');
LAYOUT_V21.on = true; // 布局按 v21 的地形算（见 world.js），种下去时再落到新地形上
useOldPath(true); // 见 world.js useOldPath
const TREES = { broad: [], pine: [], bamboo: [], old: [], tallpine: [], cypress: [], shrub: [], dwarfpine: [], fir: [] }; // fir：v39 第三章的杉
// 原画里一团团圆冠杂树的地方（金晶巖洞周、大觀廊右坡），随机种下的松在这里换成杂树（只换种类，不动随机数）
const roundCrownZone = (x, z) => { const [lx, lz] = caveLocal(x, z); return (Math.abs(lx) < 26 && lz > -26 && lz < 8) || (x > 258 && x < 292 && z > -45 && z < 12); };
// 玉女潭按原画手摆
const HAND = [
  // 古树：阁前、潭右岸老树、崖顶，按原画位置加密
  ['old', 3, 11, 1.25], ['old', -5, 9.5, 1.05], ['old', -2, 16, 1.1], ['old', 8, 19, 0.9], ['old', 52, -7, 1.3], ['old', 47, -13, 0.95],
  ['old', 24, -31, 1.0], ['old', 35, -35, 1.0], ['old', 46, -33, 1.1], ['old', 0, -19, 0.95], ['old', 60, -15, 0.95], ['old', 18, 14, 0.95],
  ['old', 28, 10, 0.85], ['old', 14, -27, 0.85], ['old', 56, -30, 0.9], ['old', 30, -40, 0.9], ['old', -9, -8, 1.0], ['old', 64, 22, 1.0],
  ['old', 12, 30, 1.15], ['old', 74, 28, 1.05], ['old', -6, 27, 1.0], ['old', 40, 24, 0.7],
  ['broad', 20, -36, 1.0], ['broad', 41, -38, 1.0], ['broad', 8, -33, 0.9], ['broad', 61, -21, 0.9],
  ['pine', 62, 6, 1.2], ['pine', 66, 11, 1.3], ['pine', 70, 3, 1.1], ['pine', 74, 9, 1.25], ['pine', 78, 2, 1.0], ['pine', 82, 8, 1.2], ['pine', 58, 13, 1.1], ['pine', 86, 13, 1.3],
  ['pine', 5, -43, 1.2], ['pine', 64, -31, 1.1], ['pine', 75, -23, 1.2],
  // 梅竹隩·沸玉橋（IMG_1269）：桥边一高松一古树，右下大松，左前杂树，右山坡上几株
  ['pine', 190, -5, 1.4], ['old', 193, -9, 1.2], ['broad', 200, -7, 1.3], ['tallpine', 197, -14, 1.2], ['broad', 204, -2, 1.1], ['cypress', 201, 3, 1.0],
  ['pine', 213, 12, 1.5], ['old', 219, 11, 1.3], ['broad', 176, 11, 1.2], ['old', 171, 15, 1.1], ['broad', 212, -26, 1.1], ['tallpine', 218, -31, 1.1], ['broad', 186, -21, 1.0],
  // 流觴嶼（IMG_1268）：左上一株大杂树，右边石山上松树，脚下几株矮松
  ['broad', 135, -20, 1.4], ['pine', 168, -21, 1.3], ['tallpine', 172, -27, 1.2], ['pine', 166, -7, 1.3], ['tallpine', 169, -11, 1.1], ['tallpine', 175, -20, 1.1],
  ['old', 117, -14, 2.5], ['old', 121, -18, 1.4], // 玉樹湍：一株极大的古树，树下众人；旁边一株小些的
  ['broad', 96, -24, 1.2], ['broad', 92, -18, 1.3], ['broad', 99, -28, 1.1], ['old', 90, -10, 1.1], ['tallpine', 95, -7, 1.2], ['cypress', 98, -31, 1.2], ['broad', 106, -26, 1.0], // 凝玉亭左后的一丛树
  // 金晶巖（IMG_1271）：左下两株大松，洞顶一株大古树，洞两侧古树，左山上一排高松，右下前景古树
  ['pine', 274, 7, 1.75], ['pine', 267, 3, 1.4], ['old', 280, 11, 1.25], ['old', 271, 14, 1.1], ['broad', 262, 9, 1.1],
  ['old', 299.5, -19.5, 1.9, 5], ['shrub', 291, -14.8, 1.1, 1], ['shrub', 294.6, -15.6, 0.9, 1], ['shrub', 302, -16.3, 1.0, 1], ['shrub', 305.8, -17.2, 1.2, 1], ['dwarfpine', 289.5, -15.5, 0.9, 1], ['pine', 280, -3, 1.85, 1], ['broad', 286.5, -9, 1.25, 1], ['broad', 291, -24, 1.1, 1], ['broad', 307.5, -25, 1.05, 1], ['old', 311, -10, 1.0, 1], ['broad', 309.5, -3, 0.9], ['broad', 304, -30, 1.2],
  ['tallpine', 283, -24, 1.25], ['tallpine', 286, -29, 1.15], ['tallpine', 289, -34, 1.2], ['tallpine', 280, -30, 1.1], ['pine', 279, -20, 1.3],
  ['old', 337, 13, 1.25], ['broad', 329, 13, 1.1], ['broad', 281, 16, 1.2], ['old', 318, 15, 1.15], ['broad', 312, 22, 1.0], ['broad', 287, 24, 1.0], ['old', 284, 20, 1.1], ['broad', 320, 18, 1.0], ['broad', 319, 9, 1.0],
  // 大觀廊（IMG_1270）：左坡一片高松，院里几株小树，右坡古树杂木，后殿后一排高松
  ['tallpine', 226, -27, 1.2], ['pine', 226.5, -22, 1.4, 1], ['pine', 224, -15, 1.5], ['pine', 225, -3.5, 1.4], ['tallpine', 229.5, -35.5, 1.2, 1], ['tallpine', 221, -34, 1.1],
  ['tallpine', 219, -24, 1.2], ['pine', 227, 6.5, 1.3],
  ['broad', 240.9, -17.7, 0.8, 1], ['broad', 243.2, -14.6, 0.66, 1], ['old', 221, -5, 0.95], ['broad', 257, 9, 1.0], ['pine', 244, 13, 1.15],
  ['broad', 272.5, -13.5, 1.3, 1], ['broad', 271.5, -24.5, 1.2, 1], ['old', 268.5, -7, 1.05], ['broad', 272, -12, 1.25], ['broad', 277, -5, 1.3], ['broad', 281, 1.5, 1.15], ['broad', 272, -34, 1.1, 1], ['broad', 263, 5.5, 1.2],
  ['tallpine', 241, -71, 1.3, 1], ['tallpine', 250, -72.5, 1.25, 1], ['tallpine', 259, -71, 1.2, 1], ['tallpine', 227, -58, 1.2, 1], ['tallpine', 283, -60, 1.1, 1],
];
for (const [t, x, z, s, keep] of HAND) TREES[t].push([x, z, s, x * 13.1, keep]); // keep：照原画点名的树，布局时不因挡景拿掉；大于 1 时把树往下埋 keep-1 米
// 初平林（原画左上，红楼左下）：一片高松，松林下方一丛杉柏；避开石阶和红楼平台
{
  const r = rand(311), STAIR = [[3, -20], [0, -28], [-3, -36], [-6, -44]];
  const nearStair = (x, z) => STAIR.some(([sx, sz], i) => i && (() => { const [ax, az] = STAIR[i - 1], vx = sx - ax, vz = sz - az, t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz))); return Math.hypot(x - ax - vx * t, z - az - vz * t) < 3.2; })());
  const ok = (x, z, P) => !nearStair(x, z) && !PADS.some((Pd) => Math.hypot(x - Pd.x, z - Pd.z) < Pd.r + 2.5) && P.every(([px, pz]) => Math.hypot(px - x, pz - z) > 3.2);
  const put = (type, n, x0, x1, z0, z1, s0, s1) => { const P = []; for (let i = 0; i < 400 && P.length < n; i++) { const x = x0 + r() * (x1 - x0), z = z0 + r() * (z1 - z0); if (ok(x, z, P)) { P.push([x, z]); TREES[type].push([x, z, s0 + r() * (s1 - s0), r() * 100]); } } };
  put('tallpine', 12, -34, -14, -62, -42, 0.85, 1.15);
  put('cypress', 10, -18, -2, -44, -31, 0.8, 1.1);
  // 龍王廟后的松杉林（IMG_1271 庙后一片深色针叶林）
  put('tallpine', 16, 298, 320, -66, -53, 0.9, 1.2);
  put('cypress', 8, 312, 322, -52, -40, 0.85, 1.1);
  put('cypress', 8, 212, 224, -68, -56, 0.85, 1.1); // 梅竹隩后山房旁的杉林
}
// 竹林：竹子成片长。梅竹隩六角亭后一大片（原画 IMG_1269 亭后整片竹林），溪两岸再六小片；片里只有竹，别的树让开
const GROVES = [
  { x: 172, z: -44, rx: 40, rz: 17, ry: 0.08 },  // 梅竹隩亭后、流觴嶼雅集身后的大竹林（IMG_1269、1268）
  { x: 141, z: -24, rx: 10, rz: 7, ry: 0.3 },    // 流觴嶼左手边伸到溪旁的一片
  { x: 131, z: -6, rx: 5, rz: 6, ry: 0 },        // 玉樹湍右边（IMG_1267 右缘）
  { x: 189, z: -20, rx: 8, rz: 6, ry: -0.2 },    // 草亭后小径两旁
];
const groveIn = (G, x, z, pad = 0) => { const c = Math.cos(G.ry), s = Math.sin(G.ry), dx = x - G.x, dz = z - G.z, u = (dx * c - dz * s) / (G.rx + pad), v = (dx * s + dz * c) / (G.rz + pad); return u * u + v * v + (fbm(x * 0.07, z * 0.07 + 9) - 0.5) * 0.9; };
const inGrove = (x, z, pad = 0) => GROVES.some((G) => groveIn(G, x, z, pad) < 1);
{
  const r = rand(919), st = MOBILE ? 3.6 : 2.6;
  GROVES.forEach((G, gi) => { for (let gx = G.x - G.rx - 4; gx <= G.x + G.rx + 4; gx += st) for (let gz = G.z - G.rx - 4; gz <= G.z + G.rx + 4; gz += st) {
    const x = gx + (r() - 0.5) * st * 0.8, z = gz + (r() - 0.5) * st * 0.8, e = groveIn(G, x, z);
    if (e >= 1 || GROVES.some((H, j) => j < gi && groveIn(H, x, z) < 1)) continue; // 两片重叠处只种一次
    if (Math.abs(z - pathAt(x).z) < 3.0 || waterLevel(x, z) > -1e8 || distToStream(x, z).d < 2.2 || slopeAt(x, z) > 1.6) continue;
    if (PADS.some((P) => Math.hypot(x - P.x, z - P.z) < P.r + 1)) continue;
    // 片中间的竹高，边上的矮，整片竹林顶上是个缓坡
    TREES.bamboo.push([x, z, (0.85 + r() * 0.3) * (0.7 + 0.3 * smooth(0, 0.5, 1 - e)), r() * 100]);
  } });
}
{
  const r = rand(77); const zoneOf = (x) => ZONES.find((Z) => x <= Z.x0 && x > Z.x1) || ZONES[0];
  const N = MOBILE ? 1500 : 2600;
  for (let i = 0; i < N; i++) {
    const x = WORLD.x0 + 6 + r() * (WORLD.x1 - WORLD.x0 - 12), z = -120 + r() * 190;
    const p = pathAt(x), d = Math.abs(z - p.z);
    if (d < 3.2) continue;
    if (x > -5 && x < 88 && z > -28 && z < 16) continue; // 玉女潭核心区由手摆
    if (x > -36 && x < 92 && z < -28 && fbm(x * 0.03, z * 0.03 + 4) < 0.6) continue; // 后山只留几片树丛，山坡露出来
    if (waterLevel(x, z) > -1e8 || pondShape(x, z, POND) < 1.15 || pondShape(x, z, POOL) < 1.2) continue;
    if (PADS.some((P) => Math.hypot(x - P.x, z - P.z) < P.r + 1.5)) continue;
    if (inMoya(x, z) || inGrove(x, z, 3)) continue;
    if (inCave(...caveLocal(x, z), 2.5)) continue;
    if (x > 92 && x < 345 && z > -130 && z < 40 && fbm(x * 0.03, z * 0.03 + 4) < 0.7) continue; // 东境两处景点手摆，散树只留几簇
    if (x > 236 && x < 266 && z > -46 && z < -3) continue; // 大觀廊院内
    if (x > 282 && x < 316 && z > -16 && z < 34) continue; // 金晶巖洞前留出看洞的视线
    if (x > 92 && x < 250 && distToStream(x, z).d < 2.5) continue;
    if (slopeAt(x, z) > 1.5) continue;
    const Z = zoneOf(x), rr = r();
    const dens = fbm(x * 0.03, z * 0.03 + 4);
    if (dens < 0.42) continue;
    let type = rr < 0.5 ? 'pine' : 'broad';
    if (Z.id === 4 && rr < 0.75) type = 'pine';
    if (type === 'pine' && roundCrownZone(x, z)) type = 'broad';
    TREES[type].push([x, z, 0.75 + r() * 0.6, r() * 100]);
  }
}
// 第一章前景：坡包上一丛丛灌木和矮松（原画每幅下缘的样子），坡包之间的草坡上零星几丛
{
  const r = rand(5150), free = (x, z, rad) => Math.abs(z - pathAt(x).z) > 3.2 + rad && waterLevel(x, z) < -1e8 && distToStream(x, z).d > 2 + rad
    && !PADS.some((P) => Math.hypot(x - P.x, z - P.z) < P.r + 1.5) && !inCave(...caveLocal(x, z), 2) && slopeAt(x, z) < 1.4 && !inGrove(x, z, 1);
  for (const F of FORE) {
    // 包顶和包坡上成团的灌丛：先撒几个团心，每团两三丛挤在一起
    const nc = Math.max(2, Math.round(F.r / 2));
    for (let c = 0; c < nc; c++) {
      const a = r() * 6.28, d = F.r * (0.1 + r() * 0.65), cx = F.x + Math.cos(a) * d, cz = F.z + Math.sin(a) * d;
      const k = 3 + Math.floor(r() * 3);
      for (let i = 0; i < k; i++) { const x = cx + (r() - 0.5) * 3.6, z = cz + (r() - 0.5) * 3.6; if (foreMound(x, z) > 0.4 && free(x, z, 0.8)) TREES.shrub.push([x, z, 0.9 + r() * 0.6, r() * 100]); }
    }
    // 大一些的包上再长一两株小杂树（原画坡包上常见的小树，有干有冠）
    if (F.r >= 8) for (let t = 0, got = 0; t < 8 && got < 2; t++) { const a = r() * 6.28, d = F.r * r() * 0.6, x = F.x + Math.cos(a) * d, z = F.z + Math.sin(a) * d; if (foreMound(x, z) > 1 && free(x, z, 1)) { TREES.broad.push([x, z, 0.5 + r() * 0.25, r() * 100]); got++; } }
    if (F.r >= 7 && r() < 0.8) { for (let t = 0; t < 6; t++) { const a = r() * 6.28, d = F.r * r() * 0.5, x = F.x + Math.cos(a) * d, z = F.z + Math.sin(a) * d; if (foreMound(x, z) > 1 && free(x, z, 1.2)) { TREES.dwarfpine.push([x, z, 0.85 + r() * 0.45, r() * 100]); break; } } }
  }
  // 草坡上零散的矮丛（不上坡包，沿游线两旁、溪边）
  for (let i = 0; i < (MOBILE ? 260 : 480); i++) {
    const x = 94 + r() * 250, z = pathAt(x).z + (r() < 0.65 ? 1 : -1) * (4 + r() * 22);
    if (fbm(x * 0.06, z * 0.06 + 3) < 0.48 || !free(x, z, 0.6)) continue;
    if (x > 236 && x < 266 && z > -46 && z < -3) continue; // 大觀廊院内
    TREES.shrub.push([x, z, 0.55 + r() * 0.45, r() * 100]);
  }
  // 原画里点名的几株矮松：流觴嶼镜头脚下两株、金晶巖洞前左右、凝玉亭前坡
  for (const [x, z, s] of [[150, 6, 1.0], [156, 7.5, 0.85], [289, 4, 0.9], [308, 6, 0.85], [99, 6, 0.9]]) if (free(x, z, 0)) TREES.dwarfpine.push([x, z, s, x * 7.3]);
}
// 第一章布局（Yang 2026-10-28：路边太挤、挡视线，路两侧高处反而空）：
// ① 大树的冠不压到游线上；② 画境镜头和画面中心之间不放挡景的大树，前景只留在画面两角；③ 路两侧的山脊、山肩上成丛补树
{
  const SZ = { broad: [6.1, 9], pine: [5.2, 12.6], tallpine: [3.4, 15], cypress: [2.2, 12], old: [11.3, 10], dwarfpine: [3.4, 4.4], shrub: [3.3, 2.75] };
  const CH1 = (x) => x > 90 && x < 348;
  // ① 游线走廊：杂树、古树冠低，离路要远一些；松柏冠高，干离路 3 米即可
  const minD = (t, s) => (t === 'old' ? 0.5 * SZ.old[0] * s + 1 : t === 'broad' ? 0.5 * SZ.broad[0] * s + 0.8 : t === 'shrub' || t === 'bamboo' ? 0 : 4);
  for (const t of Object.keys(TREES)) for (const T of TREES[t]) {
    const [x, z, s] = T; if (!CH1(x)) continue;
    const pz = pathAt(x).z, d = z - pz, m = minD(t, s);
    if (Math.abs(d) < m) T[1] = pz + (d === 0 ? -1 : Math.sign(d)) * m;
  }
  // ② 画境视角：投到各景镜头上，落在画面中间 56% 宽、又比目标近、冠又大的树拿掉
  const views = STAGES.filter((S) => S.fine && S.x > 90).map((S) => {
    const { pos, at, fov = 46 } = S.layoutView || S.view, f = new THREE.Vector3(...at).sub(new THREE.Vector3(...pos)), dist = f.length(); f.normalize();
    const R = new THREE.Vector3(-f.z, 0, f.x).normalize(), U = new THREE.Vector3().crossVectors(R, f);
    return { P: new THREE.Vector3(...pos), f, R, U, dist, th: Math.tan(fov / 2 * Math.PI / 180), asp: 16 / 9 };
  });
  const blocksView = (t, x, z, s) => {
    const sz = SZ[t]; if (!sz) return false;
    const c = new THREE.Vector3(x, terrainHeight(x, z) + sz[1] * s * 0.6, z);
    for (const V of views) {
      const v = c.clone().sub(V.P), dz = v.dot(V.f); if (dz < 1 || dz > V.dist * 0.85) continue;
      const sx = v.dot(V.R) / (dz * V.th * V.asp), sy = v.dot(V.U) / (dz * V.th), rad = (sz[0] * s / 2) / (dz * V.th);
      if (Math.abs(sx) < 0.56 && sy - rad < -0.2 && sy > -1.9 && rad > 0.16) return true; // 冠挡到画面中下部
    }
    return false;
  };
  for (const t of ['broad', 'old', 'pine', 'tallpine', 'cypress', 'dwarfpine', 'shrub']) TREES[t] = TREES[t].filter(([x, z, s, , keep]) => !CH1(x) || keep || !blocksView(t, x, z, s));
  // ③ 两侧高处成丛补树：山脊上一丛松，山肩上一丛杂树，丛与丛隔开
  const r = rand(2810), cand = [];
  for (let x = 94; x <= 344; x += 3) for (let dz = 16; dz <= 110; dz += 3) {
    const p = pathAt(x), z = p.z - dz, h = terrainHeight(x, z);
    if (h - p.y < 5 || slopeAt(x, z) > 1.3) continue;
    if (PADS.some((P) => Math.hypot(x - P.x, z - P.z) < P.r + 4) || onMassif(x, z) || inGrove(x, z, 2) || inCave(...caveLocal(x, z), 4) || onStairs(x, z)) continue;
    let avg = 0; for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; avg += terrainHeight(x + Math.cos(a) * 7, z + Math.sin(a) * 7); }
    const c = h - avg / 8; if (c > 0.35) cand.push({ x, z, c, sc: c + 0.015 * (h - p.y) });
  }
  cand.sort((a, b) => b.sc - a.sc);
  const picked = [];
  for (const C of cand) { if (picked.length >= (MOBILE ? 34 : 52)) break; if (picked.every((P) => Math.hypot(P.x - C.x, P.z - C.z) > 13)) picked.push(C); }
  for (const C of picked) {
    const ridge = C.c > 1.1, n = 3 + Math.floor(r() * 3);
    for (let i = 0, got = 0; i < 14 && got < n; i++) {
      const a = r() * 6.283, d = got ? 1.8 + r() * 3.2 : 0, x = C.x + Math.cos(a) * d, z = C.z + Math.sin(a) * d;
      if (slopeAt(x, z) > 1.4 || PADS.some((P) => Math.hypot(x - P.x, z - P.z) < P.r + 2)) continue;
      const t = ridge ? (r() < 0.3 ? 'tallpine' : r() < 0.7 ? 'pine' : 'broad') : (r() < 0.6 ? 'broad' : r() < 0.5 ? 'pine' : 'old');
      const s = (t === 'old' ? 0.7 : 0.85) + r() * 0.35;
      if (blocksView(t, x, z, s)) continue;
      const round = roundCrownZone(x, z) && (t === 'tallpine' || t === 'pine'); // 圆冠杂树区不种细高松
      TREES[round ? 'broad' : t].push([x, z, s, r() * 100]); got++;
    }
  }
}
LAYOUT_V21.on = false;
// 金晶巖新镜头（v22 放低了）：再拿掉挡这个镜头的树，只拿不加，不动随机数
{
  const S = STAGES.find((S) => S.id === 'S13'), { pos, at, fov = 46 } = S.view;
  const P = new THREE.Vector3(...pos), f = new THREE.Vector3(...at).sub(P), dist = f.length(); f.normalize();
  const R = new THREE.Vector3(-f.z, 0, f.x).normalize(), U = new THREE.Vector3().crossVectors(R, f), th = Math.tan(fov / 2 * Math.PI / 180);
  const SZ = { broad: [6.1, 9], pine: [5.2, 12.6], tallpine: [3.4, 15], cypress: [2.2, 12], old: [11.3, 10], dwarfpine: [3.4, 4.4], shrub: [3.3, 2.75] };
  for (const t of Object.keys(SZ)) TREES[t] = TREES[t].filter(([x, z, s, , keep]) => {
    if (keep || x < 262 || x > 340) return true;
    const c = new THREE.Vector3(x, surfaceTop(x, z) + SZ[t][1] * s * 0.6, z).sub(P), dz = c.dot(f); if (dz < 1 || dz > dist * 0.85) return true;
    const sx = c.dot(R) / (dz * th * 16 / 9), sy = c.dot(U) / (dz * th), rad = (SZ[t][0] * s / 2) / (dz * th);
    return !(Math.abs(sx) < 0.5 && sy - rad < -0.15 && sy > -1.9 && rad > 0.16);
  });
}
// 大觀廊 v25（八合院、高台、台前院子）里的树拿掉：只把大小置 0 不删，后面的树按序号分到的树形就不变
for (const t of Object.keys(TREES)) for (const T of TREES[t]) {
  const [x, z, , , keep] = T, D = DGL; if (keep) continue;
  if (Math.hypot(x - D.x, z - D.cz) < 21 || (Math.abs(x - D.x) < D.tw / 2 + 1.5 && z < D.foot + 2 && z > D.tz - D.td - 6) || (Math.abs(x - D.side.x) < D.side.hw + 3 && Math.abs(z - D.side.z) < D.side.hd + 3)) T[2] = 0;
}
useOldPath(false);
// 第二章（v27）：原来随手撒的树大小置 0（不删，序号不变），再照原画补在列表末尾
enterV33(); // v34：照 v33 算一遍（第二章别处的树一棵不动），琪樹峡一段的再置 0、按原画另补
{
  for (const t of Object.keys(TREES)) for (const T of TREES[t]) if (CH2(T[0]) && !T[4]) T[2] = 0;
  const r = rand(2727), add = (t, x, z, s) => {
    if (Math.abs(z - pathAt(x).z) < 3 || STAIRS2.some((S) => distToLine(x, z, S) < 1.6) || PADS.some((P) => P.old2 ? false : Math.hypot(x - P.x, z - P.z) < P.r + 0.6)) return false;
    if (Math.hypot(x - PIAO.x, z - PIAO.z) < 4.6 || Math.hypot(x - PANYU.x, z - PANYU.z) < 5 || Math.hypot(x - CHAORAN.x, z - CHAORAN.z) < 6.5) return false;
    TREES[t].push([x, z, s, r() * 100, 1]); return true;
  };
  // 磐玉隈（1265）：縹緲亭两旁一丛细高松，圆山右肩上一丛松，右巨岩顶一株大杂树，右边一片松林
  for (const [x, z, s] of [[-91.5, -40, 1.15], [-89.5, -35.5, 1.0], [-88.5, -43.5, 1.2], [-92.5, -36, 0.9], [-80.5, -42, 1.05], [-79.5, -37.5, 1.15], [-82, -34, 0.9]]) add('tallpine', x, z, s);
  for (const [x, z, s] of [[-78, -27.5, 1.0], [-74.5, -34, 0.9], [-79.5, -31, 1.1], [-68, -31, 0.85], [-76.5, -23, 0.8]]) add('pine', x, z, s);
  add('old', -55, -27.5, 1.25);
  for (let i = 0, n = 0; i < 300 && n < 18; i++) { const x = -47 + r() * 15, z = -46 + r() * 34; if (rocks2At(x, z).y > -1e8 || TREES.tallpine.some((T) => T[2] > 0 && Math.hypot(T[0] - x, T[1] - z) < 3.2)) continue; if (add(r() < 0.75 ? 'tallpine' : 'pine', x, z, 0.85 + r() * 0.35)) n++; }
  // 琪樹峡（1264）：峡口一株琪樹，山头几株小松，镜头脚下一株大松
  add('old', -97, -16.5, 0.72); add('dwarfpine', -115, 11, 1.25); add('dwarfpine', -109.5, 12, 1.0); add('dwarfpine', -121, 10, 0.9);
  for (const [x, z, s] of [[-128, -42, 0.8], [-121, -46, 0.7], [-104, -40, 0.75], [-139, -38, 0.7], [-96, -36, 0.8]]) add('pine', x, z, s);
  // 超然亭（1263）：亭左几株清瘦的树，左下角一株松
  // 亭左几株光枝瘦树（v31 起不用带叶的古树，另建光枝，见下） // 亭左峡谷里几株清瘦的树
  add('pine', -199, 7, 1.0); add('dwarfpine', -194, 10, 0.9);
  // 前景坡包上的灌丛，山坡上成串的苔点（原画满坡的墨点小丛）
  for (const [x, z] of [[-80, 9], [-76, 11], [-71, 12], [-64, 11], [-47, 10], [-43, 13], [-90, 12], [-104, 14], [-118, 13], [-150, 13], [-178, 12], [-186, 11]])
    for (let k = 0; k < 3; k++) add('shrub', x + (r() - 0.5) * 4, z + (r() - 0.5) * 3, 0.8 + r() * 0.5);
  for (let i = 0, n = 0; i < 2000 && n < (MOBILE ? 90 : 170); i++) {
    const x = -198 + r() * 158, z = -60 + r() * 70, p = pathAt(x);
    if (terrainHeight(x, z) - p.y < 3 || slopeAt(x, z) > 1.3 || rocks2At(x, z).y > -1e8 || fbm(x * 0.09, z * 0.09 + 2) < 0.52) continue;
    if (add('shrub', x, z, 0.45 + r() * 0.35)) n++;
  }
}
exitV33();
{ // v34 琪樹峡的树（IMG_1264）：峡口右边一株琪樹（细干、疏枝），左下角一株大松探进画里，左山脊上几丛墨点小树
  for (const t of Object.keys(TREES)) for (const T of TREES[t]) if (T[4] === 1 && T[2] > 0 && CH2(T[0]) && (ZONE6(T[0]) || !freeNew(T[0], T[1], 0.2))) T[2] = 0;
  const r = rand(2760), { hitAt } = PAINT6, add = (t, x, z, s, force) => {
    if (!ZONE6(x) || !force && (!freeNew(x, z, 0.3) || ROCK6.some(([qx, qz, qw]) => Math.hypot(qx - x, qz - z) < qw * 0.9))) return false; // 只种在琪樹峡这一段
    TREES[t].push([x, z, s, force > 1 ? force : r() * 100, 1]); return true;
  };
  const at = (u, v) => { const p = hitAt(u, v); return p ? [p[0], p[2]] : null; };
  { const p = at(852, 402); if (p) add('old', p[0], p[1], 0.62, true); }          // 琪樹（就长在石阶边上）
  add('dwarfpine', -105.6, 3.2, 3.2, 2.2); TREES.dwarfpine[TREES.dwarfpine.length - 1][5] = 0.66; // 左下大松：树顶对着原画（530, 585），树脚在石阶下的峡底；v35 墨色压重
  // v35 圆山前脚土崖下那道绿坡上几株矮松（原画 1264 右下角、1265 左边崖脚都有一丛墨绿的松）
  for (const [x, z, s, rot] of [[-80.5, -7.2, 1.5, 0.7], [-77.2, -7, 1.25, 2.9], [-83.2, -7.6, 1.05, 4.1], [-74.8, -6.6, 0.9, 5.3], [-72.3, -6.9, 1.0, 1.9], [-85.6, -8.1, 0.9, 3.3]]) TREES.dwarfpine.push([x, z, s, rot, 1, 0.7]); // v36 挪到崖脚（原画 1265 崖下一丛墨绿松）
  for (const [u, v, s] of PINE6PX) { const p = at(u, v); if (p) add('pine', p[0], p[1], s); }
  for (let i = 0, n = 0; i < 600 && n < (MOBILE ? 18 : 34); i++) {
    const x = -131 + r() * 37.5, z = -48 + r() * 60, p = pathAt(x);
    if (terrainHeight(x, z) - p.y < 2 || slopeAt(x, z) > 1.3 || fbm(x * 0.09, z * 0.09 + 2) < 0.5) continue;
    if (add('shrub', x, z, 0.45 + r() * 0.35)) n++;
  }
}
{ // v36 磐玉隈的树（IMG_1265）：巨岩、斜石板占的地方原来的树撤掉；板头一株大杂树，石板后面往右升起的松坡上一片松林，板脚几丛墨绿灌木
  for (const t of Object.keys(TREES)) for (const T of TREES[t]) if (T[2] > 0 && T[0] > -72 && T[0] < -20 && T[1] < -10 && (T[4] === 1 || T[1] < -15 && T[1] > -32)) T[2] = 0;
  TREES.old.push([-47.5, -24.5, 1.35, 0.7, 1, 1, 28.9]);
  for (const [x, z, s, t] of [[-31, -33, 1.05, 'pine'], [-25.8, -35, 1.1, 'tallpine'], [-25.5, -31.5, 1.0, 'pine'], [-25.5, -27, 0.95, 'pine'], [-19, -29.5, 1.05, 'pine'], [-16.5, -27, 1.0, 'pine'],
    [-12.5, -29, 1.1, 'tallpine'], [-10, -26.5, 1.0, 'pine'], [-20, -33.5, 1.0, 'pine'], [-11, -33, 1.0, 'pine'], [-14, -36.5, 1.05, 'tallpine'], [-24, -37.5, 1.0, 'pine'], [-34, -36, 0.95, 'pine'],
    [-33, -41, 1.15, 'pine'], [-27, -40.5, 1.2, 'pine'], [-21, -39, 1.15, 'pine'], [-16, -41, 1.2, 'pine'], [-30, -45.5, 1.2, 'pine'], [-23.5, -45, 1.25, 'pine'], [-18, -46, 1.2, 'tallpine'],
    [-36.5, -44, 1.15, 'tallpine'], [-12, -38.5, 1.15, 'pine'], [-26, -49.5, 1.2, 'tallpine'], [-20.5, -51, 1.2, 'pine'], [-28.5, -30.5, 0.9, 'pine'], [-15, -31.5, 0.95, 'pine']]) TREES[t].push([x, z, s, x * 3.7, 1, 0.78]);
  for (const [x, z, s] of [[-22.5, -21, 1.5], [-18.5, -20.5, 1.3], [-20.5, -23.5, 1.2], [-15.5, -22, 1.1]]) TREES.shrub.push([x, z, s, x * 5.1, 1, 0.7]);
  for (const [x, z, s] of [[-81.5, -22.5, 1.05], [-78.8, -23.2, 1.1], [-76, -23.6, 1.0], [-84.2, -22.2, 0.95]]) TREES.pine.push([x, z, s, x * 2.3, 1, 0.8]); // 圆包顶上一排松（原画包顶后面几株高松）
}
// v39 第三章（龍湫·禪窩，IMG_1262、1261）：原来随手撒的树置 0，按原画补在列表末尾（别处的树一棵不动）
{
  for (const t of Object.keys(TREES)) for (const T of TREES[t]) if (CH3(T[0]) && T[0] < -203 && !T[4]) T[2] = 0;
  const r = rand(3939), add = (t, x, z, s, tint, y, force) => {
    if (!force && (Math.abs(z - pathAt(x).z) < 3 || PADS_NOW.some((P) => Math.hypot(x - P.x, z - P.z) < P.r + 0.6))) return false;
    if (Math.abs(x - GROTTO3.x) < GROTTO3.hw + 1 && z > GROTTO3.back - 1 && z < GROTTO3.front + 4) return false; // 洞里、洞口
    if (pondShape(x, z, POOLW) < 1.3) return false;
    const T = [x, z, s, r() * 100, 1]; if (tint || y != null) T.push(tint || 1); if (y != null) T.push(y); TREES[t].push(T); return true;
  };
  // 禪窩右前：一株赭干高松、一株墨绿大叶杂树；屋后一丛松
  // （原画这两株在屋右、游线外侧，树干一直伸出画面下缘）
  add('pine', -229.9, 3.5, 1.2, 0.8, null, true); add('broad', -228.9, 4.6, 0.85, 0.72, null, true);
  for (const [x, z, s] of [[-231.4, -14, 1.0], [-228.6, -15.2, 1.1], [-225.8, -14, 0.95], [-233.6, -16.6, 0.9], [-229.8, -18.4, 1.05], [-226.8, -18, 0.9], [-224, -16.6, 1.0], [-231.8, -20.6, 0.95], [-227.6, -21.4, 1.0]]) add('pine', x, z, s, 0.78);
  // 左坡一片杉林（原画 1262 左、1261 右）：细高、成排
  for (let i = 0, n = 0; i < 500 && n < (MOBILE ? 16 : 26); i++) {
    const x = -259 + r() * 15, z = -34 + r() * 22;
    if (Math.hypot(x - GY3.x, z - GY3.z) < 5 || ['tallpine', 'fir'].some((t) => TREES[t].some((T) => T[2] > 0 && CH3(T[0]) && Math.hypot(T[0] - x, T[1] - z) < 2.4))) continue;
    if (add(r() < 0.15 ? 'tallpine' : 'fir', x, z, 0.9 + r() * 0.35, 0.78)) n++;
  }
  // 右坡一片杉林（禪窩右后、云上）
  for (let i = 0, n = 0; i < 500 && n < (MOBILE ? 14 : 22); i++) {
    const x = -219 + r() * 15, z = -50 + r() * 18;
    if (x > -207.5 + 0.85 * (z + 32)) continue; // 超然亭画境镜头的左上角看得见这一带（原画 1263 那里是云），那里不种
    if (['tallpine', 'fir'].some((t) => TREES[t].some((T) => T[2] > 0 && CH3(T[0]) && T[0] > -220 && Math.hypot(T[0] - x, T[1] - z) < 2.4))) continue;
    if (add(r() < 0.15 ? 'tallpine' : 'fir', x, z, 0.9 + r() * 0.35, 0.78)) n++;
  }
  // 右下角近景几株墨绿松
  add('pine', -222.4, 7.6, 0.95, 0.66); add('pine', -217.6, 8.8, 1.05, 0.66); add('dwarfpine', -220, 9.6, 1.2, 0.68); add('dwarfpine', -213.6, 10.2, 1.1, 0.68);
  // 龍湫：左边山肩上一株大老松，左边一片密密的杂树，洞右前小山包上几株杉，洞口前两株杂树
  add('old', -276.6, -24.8, 1.8, 0.85, 10.8);
  for (const [x, z, s, t] of [[-284, -12, 1.2, 'broad'], [-287, -18, 1.3, 'broad'], [-282, -21, 1.1, 'old'], [-288, -25, 1.2, 'broad'], [-281.5, -14.5, 1.0, 'broad'], [-285.5, -29, 1.1, 'old'], [-279.5, -33, 1.0, 'broad'], [-289, -10, 1.0, 'broad']]) add(t, x, z, s, 0.8);
  for (const [x, z, s] of [[-253.5, -12.5, 1.0], [-255.6, -15.2, 1.1], [-251.8, -16, 0.9], [-254.2, -18.5, 1.05], [-257.2, -12.2, 0.85], [-249.6, -13.8, 1.0], [-256.8, -18.6, 0.95]]) add('fir', x, z, s, 0.78);
  // 洞前、龍湫石前两丛矮的墨绿杂树（只遮到洞口下沿）
  add('broad', -268.2, 2.4, 0.6, 0.7); add('broad', -262.6, 1.6, 0.55, 0.7); add('dwarfpine', -265.4, 2.8, 1.0, 0.7);
  // v40 对岸瀑布：崖顶山上几株松，潭两边各一丛杂树
  for (const [x, z, s, t] of [[-262, 48, 1.1, 'pine'], [-268.5, 49.5, 1.0, 'pine'], [-256.5, 47, 0.95, 'pine'], [-273, 46, 1.0, 'fir'], [-253, 45.5, 1.05, 'fir'], [-275.5, 30.5, 0.9, 'broad'], [-252.5, 31.5, 0.85, 'broad'], [-277, 34, 0.8, 'shrub'], [-251, 35, 0.8, 'shrub']]) add(t, x, z, s, 0.8);
  add('dwarfpine', -266.5, 42.6, 1.1, 0.72, 30.4); add('dwarfpine', -258.6, 42.6, 0.9, 0.72, 27.9);
  // 前景坡包上的灌丛
  for (const [x, z] of [[-273, 1.5], [-266, 4], [-257, 5], [-248, 7], [-242, 8.5], [-214, 10]]) for (let k = 0; k < 3; k++) add('shrub', x + (r() - 0.5) * 4, z + (r() - 0.5) * 3, 0.8 + r() * 0.5);
}
const foliageMats = [], treeSets = [];
function plantTrees(type, variants, maps) {
  const list = TREES[type];
  variants.forEach((seed, vi) => {
    const v = treeVariant(type, seed);
    const sub = list.filter((_, i) => i % variants.length === vi);
    const tm = new THREE.InstancedMesh(v.trunk, flat, sub.length);
    const fm = foliageMaterial(maps[vi % maps.length], { a2c: false, cl: true }); foliageMats.push(fm);
    const lm = new THREE.InstancedMesh(v.leaves, fm, sub.length);
    tm.frustumCulled = lm.frustumCulled = false;
    const items = sub.map(([x, z, s, rot, keep, tint, yAbs], j) => { // yAbs：长在网格石顶上的树
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x, yAbs ?? surfaceTop(x, z) - 0.2 - (keep > 1 ? keep - 1 : 0), z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rot, 0)), new THREE.Vector3(s, s, s));
      const k = (tint || 1) * (0.88 + ((j * 37) % 23) / 100); // tint：个别树（原画里墨色重的松）压暗
      if (s > 0 && Math.abs(z - pathAt(x).z) < 40 && !inCave(...caveLocal(x, z))) circleCol(x, z, (type === 'bamboo' ? 1.0 : 0.4) * s); // 洞顶的树不挡洞里的路
      return { x, z, s, m, c: new THREE.Color(k, k * (0.98 + ((j * 13) % 7) / 100), k * 0.97) };
    });
    lm.setColorAt(0, new THREE.Color(1, 1, 1));
    v.leaves.computeBoundingBox(); const bb = v.leaves.boundingBox;
    treeSets.push({ tm, lm, items, type, h: bb.max.y, w: Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) * 0.85 });
    scene.add(tm, lm);
  });
}
// 只把镜头附近、前方的树放进实例缓冲，远处交给绢色雾
const TREE_R = MOBILE ? 120 : 190;
let treeAt = new THREE.Vector3(1e9, 0, 0);
function cullTrees(force) {
  const cp = camera.position;
  if (!force && cp.distanceTo(treeAt) < 6) return;
  treeAt.copy(cp);
  for (const T of treeSets) {
    let n = 0; const R2 = (T.r || TREE_R) ** 2;
    for (const it of T.items) {
      const dx = it.x - cp.x, dz = it.z - cp.z, d2 = dx * dx + dz * dz;
      if (d2 > R2) continue;
      if (T.tm) T.tm.setMatrixAt(n, it.m);
      T.lm.setMatrixAt(n, it.m); T.lm.setColorAt(n, it.c); n++;
    }
    T.lm.count = n; T.lm.instanceMatrix.needsUpdate = true; if (T.lm.instanceColor) T.lm.instanceColor.needsUpdate = true;
    if (T.tm) { T.tm.count = n; T.tm.instanceMatrix.needsUpdate = true; }
  }
}
plantTrees('broad', [11, 12, 13], [tex.clump[0], tex.clump[1], tex.clump[3]]);
plantTrees('pine', [21, 22, 23], [tex.pine]);
plantTrees('bamboo', [31, 32], [tex.bamboo]);
plantTrees('tallpine', [51, 52, 53], [tex.pine]);
plantTrees('cypress', [61, 62], [tex.clump[3]]);
plantTrees('old', [41, 42, 43, 44, 45], [tex.clump[2], tex.clump[1], tex.clump[4], tex.clump[0], tex.clump[2]]);
plantTrees('shrub', [71, 72, 73, 74], [tex.clump[0], tex.clump[3], tex.clump[1], tex.clump[2]]);
plantTrees('dwarfpine', [81, 82, 83], [tex.pine]);
plantTrees('fir', [91, 92, 93], [tex.pine]);
// 远树：近树画到 TREE_R 为止，再远的换成原画式的远树画片（见 fartrees.js）
{
  const far = [];
  for (const T of treeSets) if (T.type) for (const it of T.items) if (it.s > 0) far.push({ x: it.x, y: it.m.elements[13], z: it.z, w: T.w * it.s, h: T.h * it.s, type: T.type });
  scene.add(createFarTrees(far, TREE_R - 30, TREE_R - 6));
}
// 草丛：玉女潭一区密，其余沿游线稀疏
{
  const g1 = new THREE.PlaneGeometry(0.9, 0.6); g1.translate(0, 0.28, 0);
  const g2 = g1.clone().rotateY(Math.PI / 2), g3 = g1.clone().rotateY(Math.PI / 4);
  const geo = mergeGeometries([g1, g2, g3]);
  const fm = foliageMaterial(tuftTexture(), { a2c: false }); foliageMats.push(fm);
  const N = MOBILE ? 3800 : 7000;
  const lm = new THREE.InstancedMesh(geo, fm, N); lm.frustumCulled = false; lm.layers.set(1);
  const r = rand(123), items = [];
  for (let i = 0; i < N * 2 && items.length < N; i++) {
    const cat = i % 9, inSlice = cat < 5, ch1 = cat === 5 || cat === 6; // 玉女潭密，第一章草坡次之，其余沿游线稀疏
    const x = inSlice ? -12 + r() * 104 : ch1 ? 94 + r() * 250 : WORLD.x0 + r() * (WORLD.x1 - WORLD.x0);
    const z = inSlice ? -46 + r() * 74 : ch1 ? pathAt(x).z + (r() < 0.7 ? 1 : -1) * (2 + r() * 30) : pathAt(x).z + (r() - 0.5) * 50;
    const p = pathAt(x); if (Math.abs(z - p.z) < 1.6) continue;
    if (waterLevel(x, z) > -1e8 || pondShape(x, z, POND) < 1.05) continue;
    if (slopeAt(x, z) > 1.1 || fbm(x * 0.08, z * 0.08) < 0.5) continue;
    const s = 0.35 + r() * 0.55;
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, terrainHeight(x, z) - 0.05, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r() * 3, 0)), new THREE.Vector3(s, s * (0.7 + r() * 0.6), s));
    const k = 0.85 + r() * 0.3; items.push({ x, z, m, c: new THREE.Color(k, k, k * 0.95) });
  }
  lm.setColorAt(0, new THREE.Color(1, 1, 1));
  treeSets.push({ tm: null, lm, items, r: MOBILE ? 50 : 85 }); scene.add(lm);
}
// v35 琪樹峡石脚、石阶边一簇簇墨绿的小草（原画峡里的苔草；不用圆苔点）
{
  const g1 = new THREE.PlaneGeometry(0.9, 0.6); g1.translate(0, 0.28, 0);
  const geo = mergeGeometries([g1, g1.clone().rotateY(Math.PI / 2), g1.clone().rotateY(Math.PI / 4)]);
  const fm = foliageMaterial(tuftTexture(), { a2c: false }); foliageMats.push(fm);
  const r = rand(6600), items = [], N = MOBILE ? 450 : 1000;
  for (let i = 0; i < N * 12 && items.length < N; i++) {
    const x = -128 + r() * 42, z = -38 + r() * 41, gz = gorge6(x, z);
    if (gz < 0.25 || r() > gz) continue;
    if (Math.abs(z - pathAt(x).z) < 1.4 || STAIRS2.some((S) => distToLine(x, z, S) < 0.75)) continue;
    let edge = Infinity; for (const [qx, qz, qw] of ROCK6) edge = Math.min(edge, Math.hypot(qx - x, qz - z) - qw * 1.05);
    if (edge < -0.1 || edge > 1.3 && r() > 0.2) continue; // 多半贴着石脚
    const s = 0.35 + r() * 0.45, y = terrainHeight(x, z) - 0.05;
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r() * 3, 0)), new THREE.Vector3(s * 1.2, s * (0.6 + r() * 0.5), s * 1.2));
    const k = 0.62 + r() * 0.25; items.push({ x, z, m, c: new THREE.Color(k * 0.92, k, k * 0.8) });
  }
  const lm = new THREE.InstancedMesh(geo, fm, Math.max(1, items.length)); lm.frustumCulled = false; lm.layers.set(1);
  lm.setColorAt(0, new THREE.Color(1, 1, 1));
  treeSets.push({ tm: null, lm, items, r: MOBILE ? 50 : 85 }); scene.add(lm);
}
// ---------- 云 ----------
const CLOUD_L = [];
{
  const L = [];
  // 靈應亭四周
  for (const [x, y, z, w] of [[60, 15, -22, 16], [80, 18, -30, 20], [72, 12, -14, 14], [90, 20, -40, 24], [55, 22, -42, 18]]) L.push([x, y, z, w]);
  // v39 第三章（IMG_1262、1261）：禪窩右下一大片云（和超然亭左边的云海连起来）；左边、后山原画没有云
  for (const [x, y, z, w] of [[-212, 11, -17, 24], [-206, 11.5, -24, 26], [-219, 10, -21, 18], [-209, 11.5, -10, 18], [-215, 11, -32, 18]]) L.push([x, y, z, w]);
  // v40 对岸瀑布：潭后、崖腰两团低云（同 v38 龍湫瀑布）
  L.push([WF.bottom.x - 6, WF.bottom.y + 3, WF.bottom.z + 2, 11], [WF.bottom.x + 7, WF.top.y - 4, WF.top.z + 3, 13]);
  // 各区接缝处的云带 + 远景云海
  const r = rand(9);
  // 接缝处的云团往山里推、贴着山坡，不再压在景点上空挡视线
  for (const sx of [222, 92, -36, -200, -272]) for (let k = 0; k < 6; k++) { const x = sx + (r() - 0.5) * 30, h = r(), z = -45 - r() * 55; L.push([x, terrainHeight(x, z) + 3 + h * 10, z, 18 + r() * 22, 0, sx === -36]); }
  for (let k = 0; k < 40; k++) { const x = WORLD.x0 + r() * (WORLD.x1 - WORLD.x0); L.push([x, 30 + r() * 30, -90 - r() * 70, 30 + r() * 40]); }
  for (let k = 0; k < 16; k++) { const x = -200 + r() * 160, y = 22 + r() * 16, z = -30 - r() * 60, w = 20 + r() * 20; if (y > terrainHeight(x, z) + 6) L.push([x, y, z, w]); } // 云山仙境的云海（v27 山抬高了，埋进山里的不要）
  // 第二章（v27）：超然亭左边和脚下的云海、琪樹峡左下的一片云（原画 IMG_1263、1264）
  for (const [x, y, z, w] of [[-203, 25, -24, 34], [-200, 31, -40, 36], [-196, 17, -2, 30], [-201, 34, -50, 50], [-184, 33, -46, 40], [-178, 30, -36, 34], [-196, 40, -30, 36],
    [-198, 21, 16, 40], [-132, 18, 26, 40], [-148, 30, -34, 26], [-204, 50, -36, 42], [-199, 62, -48, 40], [-146, 25, -4, 30], [-134, 24, -2, 30], [-152, 23, 2, 26], [-197, 27, -20, 28], [-200, 22, -10, 30], [-162, 20, 13, 28], [-171, 16, 31, 24], [-147, 18, 27, 26]]) L.push([x, y, z, w]); // 末两团：亭左峡谷里的云
  // v34 琪樹峡左下：石阶下面一大片云（原画左下四分之一都是云），云顶比游线低几米
  for (const [x, y, z, w] of [[-131, 19, 2, 28], [-120, 18, 4, 26], [-111, 16, 8, 18], [-127, 21, -2, 18], [-138, 21, -1, 20], [-117, 20, -3, 14]]) L.push([x, y, z, w]);
  // v34 琪樹峡峡顶主峰身后压成的云谷里一层薄云（原画峰后是淡淡的远山和云）
  for (const [x, z, w] of [[-121, -62, 26], [-106, -60, 24], [-114, -74, 30]]) L.push([x, terrainHeight(x, z) + 4, z, w]);
  // 亭后到芙蓉城脚下的山坡上贴一层云（原画亭后是云，不是一整面山），按地面高度放
  // v28：亭后云谷里铺一层云海，芙蓉城的柱脚埋在里面
  for (const [x, z, w, dy] of [[-168, -44, 46, 5], [-150, -48, 40, 6], [-184, -44, 42, 5], [-160, -58, 50, 7], [-176, -66, 50, 6], [-146, -66, 44, 7], [-162, -80, 54, 8], [-186, -84, 46, 7], [-142, -86, 42, 8], [-170, -100, 56, 9]]) L.push([x, terrainHeight(x, z) + dy, z, w]);
  // 芙蓉城高山柱腰上的两道云（和后处理里柱面上的云带同高）：成团的大云，柱与柱之间也填满（Yang：云带再宽些、成团）
  for (const [x, y, z, w] of [[-156, 100, -55, 50], [-179, 98, -63, 58], [-201, 101, -75, 48], [-143, 96, -49, 38], [-213, 97, -62, 38],
    [-166, 121, -68, 46], [-191, 119, -80, 42], [-150, 124, -62, 32]]) L.push([x, y, z, w]);
  // 体积云在后处理里步进，这里只记下每团云的位置、大小和噪声种子
  L.forEach((c, i) => { c[4] = i * 3.7; });
  CLOUD_L.push(...L.filter((c) => !c[5]).map((c) => c.slice(0, 5))); // v36：磐玉隈右边那道接缝云撤掉（原画大石板后面是满坡的松林，直到画顶）
}

// ---------- 人物 ----------
await step('点人物');
const figs = new Map();
for (const d of PEOPLE) {
  const f = new Figure(d); figs.set(d.id, f);
  f.root.position.set(d.pos[0], groundHeight(d.pos[0], d.pos[2]), d.pos[2]);
  f.home = f.root.position.clone(); f.pathI = 0; f.pathDir = 1; f.wait = Math.random() * 2;
  scene.add(f.root);
}
function placeLan() { // 凭栏者站在玉光閣二楼平座前沿
  const f = figs.get('lan'), ry = YUGUANG.ry, lx = -1.6, lz = 2.05;
  f.root.position.set(YUGUANG.x + lx * Math.cos(ry) + lz * Math.sin(ry), yg.y + yg.floor2, YUGUANG.z - lx * Math.sin(ry) + lz * Math.cos(ry));
  f.heading = f.root.rotation.y = ry + 0.35;
}
placeLan();
// 小船：两头上翘的船身、舷板、竹篾篷。v40 两只：对岸瀑布潭里来回撑的一只（Yang 加的一景，两个童子坐着、一人撑篙），
// 龍湫岩洞里原画的一只（IMG_1261：三人坐在船头，一人站在船尾撑篙，泊在洞口水里）
const mkHull = (canopy) => { // v40 船篷改成拱在船头上（v38 起是倒扣在船底下的半筒，从船舷两边露出来）；甲板、舷条收进船身里
  const k = new Kit(), L = 3.6, B = 0.62, hullC = new THREE.Color('#6b4c34'), deckC = new THREE.Color('#8a6a48');
  const hull = [], nS = 16, nA = 7;
  for (let i = 0; i <= nS; i++) {
    const u = i / nS, x = (u - 0.5) * L, taper = Math.pow(Math.sin(u * Math.PI), 0.55), rise = Math.pow(Math.abs(u - 0.5) * 2, 3) * 0.45;
    for (let j = 0; j <= nA; j++) { const a = Math.PI * (j / nA); hull.push([x, rise - Math.sin(a) * 0.32 * taper + 0.32, Math.cos(a) * B * taper]); }
  }
  { const pos = [], idx = []; hull.forEach((q) => pos.push(...q));
    for (let i = 0; i < nS; i++) for (let j = 0; j < nA; j++) { const a = i * (nA + 1) + j, b2 = a + nA + 1; idx.push(a, b2, a + 1, b2, b2 + 1, a + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); k.add(g, hullC); }
  k.box(L * 0.7, 0.05, B * 1.1, 0, 0.26, 0, deckC);
  for (const z of [-1, 1]) k.box(L * 0.56, 0.07, 0.07, 0, 0.33, z * B * 0.72, hullC);
  if (canopy) { const g = new THREE.CylinderGeometry(0.42, 0.42, 0.8, 14, 1, true, -Math.PI / 2, Math.PI); g.rotateZ(Math.PI / 2); g.rotateX(-Math.PI / 2); g.scale(1, 1.1, 1);
    k.add(g, COL.thatch, 3, new THREE.Matrix4().makeTranslation(-0.9, 0.32, 0)); }
  return k.geometry();
};
const addPole = (f) => { const k3 = new Kit(); k3.cyl(0.03, 0.03, 4, 0, -1.5, 0, COL.wood, 4); const pole = new THREE.Mesh(k3.geometry(), flat); pole.rotation.z = 0.35; pole.position.set(0.05, 0.4, 0.15); f.arms[1].add(pole); };
const seat = (b, kids, xs, zs) => { kids.forEach((k2, i) => { k2.root.position.set(xs[i], 0.3, zs[i]); k2.root.rotation.y = 1.57; k2.heading = 1.57; k2.proxy.removeFromParent(); b.add(k2.root); }); b.userData.kids = kids; };
const boat = new THREE.Group();
{
  boat.add(new THREE.Mesh(mkHull(true), flat)); scene.add(boat);
  seat(boat, [new Figure({ robe: '#c9a45a', hat: 'kid', routine: 'sit', scale: 0.7 }), new Figure({ robe: '#6f8fb0', hat: 'kid', routine: 'sit', scale: 0.7 })], [-0.1, 0.65], [-0.12, 0.12]);
  const poler = figs.get('chuan'); poler.root.removeFromParent(); poler.root.position.set(1.25, 0.32, 0); boat.add(poler.root); poler.inBoat = true; addPole(poler);
}
const boat2 = new THREE.Group();
{
  boat2.add(new THREE.Mesh(mkHull(false), flat)); scene.add(boat2); // 原画这只船没有篷
  seat(boat2, [new Figure({ robe: '#e8e2d2', hat: 'cap', routine: 'sit', scale: 0.82 }), new Figure({ robe: '#ddd3bc', hat: 'kid', routine: 'sit', scale: 0.75 }), new Figure({ robe: '#8f8f88', hat: 'cap', routine: 'sit', scale: 0.8 })], [-0.85, -0.3, 0.25], [-0.14, 0.16, -0.06]);
  const p2 = new Figure({ robe: '#a9c0d4', hat: 'bald', routine: 'idle', scale: 0.85 }); p2.proxy.removeFromParent(); p2.root.position.set(1.2, 0.32, 0); p2.root.rotation.y = 1.57; p2.heading = 1.57; boat2.add(p2.root); addPole(p2); boat2.userData.poler = p2;
  boat2.rotation.y = -0.12;
}
// 仙鹤
const cranes = [new Crane(108, -2, { seed: 1 }), new Crane(113, 1, { seed: 2 })];
cranes.forEach((c) => scene.add(c.root));
const birds = new Birds(scene, terrainHeight, { mobile: MOBILE });

// ---------- 状态 ----------
const state = {
  mode: 'free', // free | focus | control | fly | borrow
  cam: { pos: new THREE.Vector3(), yaw: 0, pitch: 0, speed: 14 },
  orbit: { yaw: 0, pitch: 0.35, dist: 5.5 },
  focus: null, ctrl: null, walkTo: null, prev: null, fly: null, near: null, menu: false,
  dialog: null, visited: new Set(), zone: null, stage: null, overlay: 0, view: null,
};
const keys = new Set();
const tmpV = new THREE.Vector3();

function setCam(pos, at) {
  state.cam.pos.copy(pos);
  const d = tmpV.copy(at).sub(pos).normalize();
  state.cam.yaw = Math.atan2(d.x, -d.z); state.cam.pitch = Math.asin(THREE.MathUtils.clamp(d.y, -1, 1));
}
function applyFreeCam() {
  const c = state.cam;
  camera.position.copy(c.pos);
  camera.quaternion.setFromEuler(new THREE.Euler(c.pitch, -c.yaw, 0, 'YXZ'));
}
function flyTo(pos, at, fov, then, dur = 1.8) {
  const fromQ = camera.quaternion.clone(), fromP = camera.position.clone();
  const toQ = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(pos, at, new THREE.Vector3(0, 1, 0)));
  state.fly = { fromP, fromQ, toP: pos.clone(), toQ, at: at.clone(), t: 0, dur, fromFov: camera.fov, toFov: fov ?? camera.fov, then };
  state.mode = 'fly';
}

// ---------- 界面 ----------
const ui = {
  zone: $('zoneName'), stage: $('stageName'), hint: $('hint'), card: $('card'), cEye: $('cEye'), cTitle: $('cTitle'), cBody: $('cBody'), cTip: $('cTip'),
  bTake: $('bTake'), bBorrow: $('bBorrow'), bClose: $('cardClose'), prompt: $('prompt'), menu: $('menu'), dialog: $('dialog'), dName: $('dName'), dLine: $('dLine'),
  banner: $('banner'), labels: $('labels'), tag: $('tag'), map: $('map'), mapCv: $('mapCanvas'), journal: $('journalCount'), overlay: $('overlay'), ovImg: $('ovImg'), ovRange: $('ovRange'), ovBar: $('ovBar'),
};
const HINTS = {
  free: MOBILE ? '左下摇杆移动 · 右侧拖动转向 · 双指上下拖动升降 · 点人物看介绍' : 'WASD 移动 · 拖动鼠标转向 · Q/E 降升 · Shift 加速 · 滚轮调速 · 点人物看介绍 · Tab 地图 · V 画境',
  focus: MOBILE ? '点“接管”操控他 · 点 × 返回' : 'F 接管这个人物 · Esc 返回',
  control: MOBILE ? '摇杆行走 · 拖动绕看 · 走近他人点“互动” · 点“退出”回到自由镜头' : 'WASD 行走 · 拖动绕看 · 滚轮远近 · 点地面自动走过去 · 走近他人按 E 互动 · Esc 退出',
  borrow: MOBILE ? '拖动环顾 · 点 × 返回' : '拖动环顾 · Esc 返回',
  fly: '',
};
function setHint() { ui.hint.textContent = HINTS[state.mode] ?? ''; document.body.dataset.mode = state.mode; }

// 题名标签（DOM，竖排）
const labelEls = [];
for (const S of STAGES) for (const [txt, x, y, z] of S.labels) {
  const el = document.createElement('div'); el.className = 'label'; el.textContent = txt; ui.labels.appendChild(el);
  labelEls.push({ el, v: new THREE.Vector3(x, y, z), stage: S });
}

function openCard(f) {
  const c = f.def.card;
  ui.cEye.textContent = c.eye; ui.cTitle.textContent = c.title;
  ui.cBody.innerHTML = c.body.map((p) => `<p>${p}</p>`).join('');
  ui.cTip.textContent = c.tip || ''; ui.cTip.hidden = !c.tip;
  ui.bTake.hidden = !f.def.control; ui.bBorrow.hidden = !f.def.borrow;
  const photo = STAGES.find((S) => S.id === f.def.stage)?.photo;
  const img = c.img ? A + c.img : photo ? `${A}painting_${photo}.jpg` : '';
  $('cImg').src = img; $('cImg').hidden = !img; $('cImg').classList.toggle('cut', !!c.img);
  ui.card.hidden = false;
}
function closeCard() { ui.card.hidden = true; }

function focusFigure(f) {
  if (state.mode === 'control' && state.ctrl === f) return;
  if (state.mode !== 'focus') state.prev = { pos: camera.position.clone(), q: camera.quaternion.clone(), mode: state.mode === 'control' ? 'control' : 'free' };
  if (state.mode === 'control') releaseControl(false);
  state.focus = f; f.hl = 1; f.speed = 0; f.paused = true;
  const p = f.root.position, head = p.clone().add(new THREE.Vector3(0, 1.35 * f.root.scale.y, 0));
  // 从人物正面偏向观者一侧（+z）看过去，避免镜头躲到他身后的山里
  const fd = new THREE.Vector3(Math.sin(f.root.rotation.y), 0, Math.cos(f.root.rotation.y)).add(new THREE.Vector3(0.25, 0, 1.1)).normalize();
  const dist = f.def.id === 'lan' ? 5.5 : 3.4;
  // 选一个不被山石、建筑挡住的角度：先试正面，再左右各转
  const occ = [spireMesh, moyaCliff, staticMesh, ygMesh, lyMesh, ...rockIMs, ...[grey6Mesh, blue6Mesh, pan7Mesh].filter(Boolean)], rc = new THREE.Raycaster();
  let cp = null, best = null;
  for (const da of [0, 0.5, -0.5, 1.0, -1.0, 1.6, -1.6, 2.4, -2.4]) {
    const d2 = fd.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), da);
    const c = head.clone().addScaledVector(d2, dist).add(new THREE.Vector3(0, 0.5, 0));
    c.y = Math.max(c.y, groundHeight(c.x, c.z) + 0.8);
    const dir = c.clone().sub(head), L = dir.length(); rc.set(head, dir.normalize()); rc.far = L + 0.3;
    const hit = rc.intersectObjects(occ, false)[0];
    if (!hit) { cp = c; break; }
    if (!best || hit.distance > best.d) best = { d: hit.distance, c: head.clone().addScaledVector(dir, Math.max(1.2, hit.distance - 0.4)) };
  }
  if (!cp) cp = best.c;
  openCard(f);
  flyTo(cp, head, 40, () => { state.mode = 'focus'; setHint(); }, 1.3);
}
function exitFocus() {
  if (!state.focus) return;
  state.focus.hl = 0; state.focus.paused = false; state.focus = null; closeCard();
  const P = state.prev;
  if (P) {
    const at = P.pos.clone().add(new THREE.Vector3(0, 0, -1).applyQuaternion(P.q));
    flyTo(P.pos, at, 50, () => { setCam(P.pos, at); state.mode = 'free'; setHint(); }, 1.1);
  } else { state.mode = 'free'; setHint(); }
}

function takeControl(f) {
  if (!f.def.control) return;
  closeCard(); if (state.focus) { state.focus.hl = 0; state.focus.paused = false; } state.focus = null;
  state.ctrl = f; f.controlled = true; f.pose = 'idle'; f.look = null;
  state.orbit.yaw = f.root.rotation.y + Math.PI; state.orbit.pitch = 0.32; state.orbit.dist = 5.5;
  const tgt = f.root.position.clone().add(new THREE.Vector3(0, 1.4, 0));
  flyTo(orbitPos(tgt), tgt, 52, () => { state.mode = 'control'; setHint(); }, 1.0);
  $('who').textContent = f.def.name; $('who').hidden = false;
}
function releaseControl(toFree = true) {
  const f = state.ctrl; if (!f) return;
  f.controlled = false; f.speed = 0; state.ctrl = null; state.walkTo = null; closeMenu(); closeDialog();
  for (const o of figs.values()) if (o.followPlayer) o.followPlayer = false;
  $('who').hidden = true;
  if (toFree) { setCam(camera.position.clone(), camera.position.clone().add(new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion))); state.mode = 'free'; camera.fov = 50; camera.updateProjectionMatrix(); setHint(); }
}
function orbitPos(tgt) {
  const o = state.orbit;
  const p = new THREE.Vector3(tgt.x + Math.sin(o.yaw) * Math.cos(o.pitch) * o.dist, tgt.y + Math.sin(o.pitch) * o.dist, tgt.z + Math.cos(o.yaw) * Math.cos(o.pitch) * o.dist);
  // 镜头不钻进地面：沿视线检查，必要时拉近
  for (let t = 0.3; t <= 1.0001; t += 0.1) {
    const q = tgt.clone().lerp(p, t);
    if (t > 0.35 && q.y < groundHeight(q.x, q.z) + 7 && blocked(q.x, q.z, 0.25)) return tgt.clone().lerp(p, Math.max(0.3, t - 0.12));
    if (q.y < groundHeight(q.x, q.z) + 0.35) { const k = Math.max(0.25, t - 0.1); return tgt.clone().lerp(p, k).setY(Math.max(tgt.clone().lerp(p, k).y, groundHeight(q.x, q.z) + 0.6)); }
  }
  return p;
}

function borrowEyes(f) {
  closeCard(); state.mode = 'borrow'; setHint();
  const eye = f.root.position.clone().add(new THREE.Vector3(0, 1.55, 0));
  const at = new THREE.Vector3(...f.def.borrow.at);
  state.borrowFrom = f;
  flyTo(eye, at, 55, () => { setCam(eye, at); state.mode = 'borrow'; setHint(); }, 1.4);
  $('backBtn').hidden = false;
}
function exitBorrow() { $('backBtn').hidden = true; const f = state.borrowFrom; state.mode = 'free'; state.focus = null; focusFigure(f); }

// —— 互动 ——
function nearestNPC() {
  const f = state.ctrl; if (!f) return null;
  let best = null, bd = 2.8;
  for (const o of figs.values()) {
    if (o === f || o.inBoat || o.def.id === 'lan') continue;
    const d = o.root.position.distanceTo(f.root.position); if (d < bd) { bd = d; best = o; }
  }
  return best;
}
function openMenu() {
  const t = state.near; if (!t) return;
  state.menu = true; ui.menu.hidden = false;
  ui.menu.innerHTML = `<div class="mh">与 <b>${t.def.name}</b></div>` + ACTIONS.map((a, i) => `<button data-a="${a.id}"><kbd>${i + 1}</kbd>${a.id === 'walk' && t.followPlayer ? '别跟了' : a.label}</button>`).join('');
  ui.menu.querySelectorAll('button').forEach((b) => (b.onclick = () => doAction(b.dataset.a)));
}
function closeMenu() { state.menu = false; ui.menu.hidden = true; }
function faceEach(a, b) {
  const pa = a.root.position, pb = b.root.position;
  a.heading = Math.atan2(pb.x - pa.x, pb.z - pa.z); b.heading = Math.atan2(pa.x - pb.x, pa.z - pb.z);
  a.look = pb; b.look = pa;
}
function doAction(id) {
  const me = state.ctrl, t = state.near; closeMenu(); if (!me || !t) return;
  faceEach(me, t); t.wait = 6; t.speed = 0;
  if (id === 'bow') { me.play('bow', 2.2); setTimeout(() => t.play('bow', 2.2), 250); say(t, t.def.lines[0] ? '（还礼）' + '幸会。' : '幸会。'); }
  if (id === 'talk') { t.play('talk', 3); openDialog(t); }
  if (id === 'walk') { t.followPlayer = !t.followPlayer; if (t.followPlayer) { t.pose = 'idle'; say(t, '好，同去走走。'); } else say(t, '那我在这里歇歇。'); }
  if (id === 'sit') { me.pose = 'sit'; t.pose = 'sit'; t.followPlayer = false; say(t, '请坐。此处风景正好。'); }
}
let sayTimer = 0;
function say(f, line) { ui.dName.textContent = f.def.name; ui.dLine.textContent = line; ui.dialog.hidden = false; $('dNext').hidden = true; sayTimer = 3; state.dialog = null; }
function openDialog(f) { state.dialog = { f, i: 0 }; showLine(); }
function showLine() {
  const D = state.dialog; ui.dName.textContent = D.f.def.name; ui.dLine.textContent = D.f.def.lines[D.i]; ui.dialog.hidden = false; $('dNext').hidden = false;
  $('dNext').textContent = D.i < D.f.def.lines.length - 1 ? (MOBILE ? '点此继续' : 'E / 点击 继续') : (MOBILE ? '点此结束' : 'E / 点击 结束');
  D.f.play('talk', 2.4); sayTimer = 0;
}
function nextLine() { const D = state.dialog; if (!D) { closeDialog(); return; } D.i++; if (D.i >= D.f.def.lines.length) closeDialog(); else showLine(); }
function closeDialog() { state.dialog = null; ui.dialog.hidden = true; }

function interactKey() {
  if (state.dialog) { nextLine(); return; }
  if (state.menu) { closeMenu(); return; }
  if (state.near) openMenu();
}

// —— 发现景点 ——
function checkStage(p) {
  const Z = ZONES.find((Z) => p.x <= Z.x0 && p.x > Z.x1);
  if (Z && Z !== state.zone) { state.zone = Z; ui.zone.textContent = Z.name; ui.zone.classList.toggle('grey', Z.stage === 'grey'); $('zoneTag').textContent = { grey: '灰盒', slice: 'P1 切片', ch1: '第一章', ch2: '第二章', ch3: '第三章' }[Z.stage]; }
  let S = null, bd = 1e9;
  for (const s of STAGES) { const d = Math.hypot(p.x - s.x, p.z - s.z); if (d < s.r && d < bd) { bd = d; S = s; } }
  if (S !== state.stage) {
    state.stage = S; ui.stage.textContent = S ? S.name : '';
    if (S && !state.visited.has(S.id)) {
      state.visited.add(S.id); ui.journal.textContent = `${state.visited.size}/13`;
      ui.banner.innerHTML = `<span>${S.name.replace('·', '</span><span>')}</span>`; ui.banner.classList.remove('show'); void ui.banner.offsetWidth; ui.banner.classList.add('show');
      try { localStorage.setItem('yydt-visited', JSON.stringify([...state.visited])); } catch (e) {}
    }
  }
}
try { (JSON.parse(localStorage.getItem('yydt-visited') || '[]')).forEach((id) => state.visited.add(id)); } catch (e) {}
ui.journal.textContent = `${state.visited.size}/13`;

// —— 画境视角 ——
function nearestStage(p) { let S = STAGES[0], bd = 1e9; for (const s of STAGES) { const d = Math.hypot(p.x - s.x, p.z - s.z); if (d < bd) { bd = d; S = s; } } return S; }
function paintView(S) {
  if (state.mode === 'control') releaseControl(false);
  if (state.focus) { state.focus.hl = 0; state.focus.paused = false; state.focus = null; closeCard(); }
  const v = S.view, pos = new THREE.Vector3(...v.pos), at = new THREE.Vector3(...v.at);
  state.view = S;
  flyTo(pos, at, v.fov, () => { setCam(pos, at); state.mode = 'free'; setHint(); showOverlayBar(S); }, 2.2);
}
function showOverlayBar(S) { ui.ovImg.src = `${A}painting_${S.photo}.jpg`; ui.ovBar.hidden = false; $('ovName').textContent = `${S.name} · IMG_${S.photo}${S.slice || S.fine ? '' : '（灰盒，未对齐）'}`; }
function hideOverlay() { ui.ovBar.hidden = true; ui.overlay.style.opacity = 0; ui.ovRange.value = 0; state.view = null; }
ui.ovRange.oninput = () => (ui.overlay.style.opacity = ui.ovRange.value / 100);
$('ovClose').onclick = hideOverlay;

// —— 地图 ——
let mapOpen = false;
function drawMap() {
  const cv = ui.mapCv, W = cv.clientWidth * devicePixelRatio, H = cv.clientHeight * devicePixelRatio; cv.width = W; cv.height = H;
  const g = cv.getContext('2d');

  const X = (x) => ((x - (-352)) / 704) * W, Y = (z) => ((z - -110) / 150) * H;
  g.fillStyle = '#e6d3ad'; g.fillRect(0, 0, W, H);
  // 地形缩略
  const step = 4;
  for (let x = -352; x < 352; x += step) for (let z = -110; z < 40; z += step) {
    const h = terrainHeight(x, z), rel = h - pathAt(x).y;
    const b = Math.min(1, Math.max(0, rel / 40));
    g.fillStyle = waterLevel(x, z) > -1e8 ? '#6f7f74' : `rgb(${200 - b * 110},${190 - b * 60},${150 - b * 10 + b * 40})`;
    g.fillRect(X(x), Y(z), (step / 704) * W + 1, (step / 150) * H + 1);
  }
  // 游线
  g.strokeStyle = '#8a5a3a'; g.lineWidth = 2 * devicePixelRatio; g.setLineDash([6, 5]); g.beginPath();
  for (let x = 352; x >= -352; x -= 4) { const p = pathAt(x); x === 352 ? g.moveTo(X(x), Y(p.z)) : g.lineTo(X(x), Y(p.z)); } g.stroke(); g.setLineDash([]);
  // 区界
  g.fillStyle = 'rgba(42,38,32,.75)'; g.font = `${13 * devicePixelRatio}px "Ma Shan Zheng", serif`; g.textAlign = 'center';
  for (const Z of ZONES) { g.fillText(Z.name + (Z.stage === 'slice' ? '（切片）' : ''), X((Z.x0 + Z.x1) / 2), 18 * devicePixelRatio); g.strokeStyle = 'rgba(42,38,32,.2)'; g.beginPath(); g.moveTo(X(Z.x1), 0); g.lineTo(X(Z.x1), H); g.stroke(); }
  // 景点
  mapHits = [];
  for (const S of STAGES) {
    const x = X(S.x), y = Y(S.z), v = state.visited.has(S.id);
    g.fillStyle = v ? '#b5432f' : 'rgba(42,38,32,.45)'; g.beginPath(); g.arc(x, y, 6 * devicePixelRatio, 0, 7); g.fill();
    g.fillStyle = '#2a2620'; g.font = `${12 * devicePixelRatio}px "Noto Serif SC", serif`; g.fillText(S.name.split('·')[0], x, y + 20 * devicePixelRatio);
    mapHits.push({ x: x / devicePixelRatio, y: y / devicePixelRatio, S });
  }
  // 我在哪
  const me = state.ctrl ? state.ctrl.root.position : camera.position;
  g.fillStyle = '#2f6f9a'; g.beginPath(); g.arc(X(me.x), Y(me.z), 7 * devicePixelRatio, 0, 7); g.fill();
  g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke();
}
let mapHits = [];
function toggleMap(v = !mapOpen) { mapOpen = v; ui.map.hidden = !v; if (v) drawMap(); }
ui.mapCv.addEventListener('click', (e) => {
  const r = ui.mapCv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  const h = mapHits.find((m) => Math.hypot(m.x - x, m.y - y) < 18);
  if (h) { toggleMap(false); paintView(h.S); }
});
$('mapClose').onclick = () => toggleMap(false);

// ---------- 输入 ----------
addEventListener('keydown', (e) => {
  if (e.target.closest && e.target.closest('input')) return;
  const k = e.key.toLowerCase();
  if (k === 'tab') { e.preventDefault(); toggleMap(); return; }
  if (state.menu && /^[1-4]$/.test(k)) { doAction(ACTIONS[+k - 1].id); return; }
  keys.add(k);
  if (k === 'escape') {
    if (mapOpen) return toggleMap(false);
    if (state.menu) return closeMenu();
    if (state.dialog || !ui.dialog.hidden) return closeDialog();
    if (state.mode === 'borrow') return exitBorrow();
    if (state.mode === 'focus') return exitFocus();
    if (state.mode === 'control') return releaseControl(true);
    if (!ui.ovBar.hidden) return hideOverlay();
  }
  if (k === 'f' && state.mode === 'focus' && state.focus) takeControl(state.focus);
  if (k === 'e' && state.mode === 'control') interactKey();
  if (k === 'v') paintView(nearestStage(state.ctrl ? state.ctrl.root.position : camera.position));
  if (k === 'h') $('help').hidden = !$('help').hidden;
  if (k === 'p') toggleFps();
  if (k === 't') { const P = [6, 12, 18.4, 22], h = DN.S.hour, i = P.findIndex((q) => q > h + 0.3); DN.setHour(P[i < 0 ? 0 : i]); updateClockUI(); } // v38 T：拨到下一个时辰（晨、午、昏、夜）
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());

const cv = renderer.domElement;
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const pointers = new Map();
let drag = null;
function pick(cx, cy) {
  ndc.set((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const proxies = []; for (const f of figs.values()) if (f.root.parent && f.root.position.distanceTo(camera.position) < 160) proxies.push(f.proxy);
  const hit = ray.intersectObjects(proxies, false)[0];
  return hit ? hit.object.userData.fig : null;
}
function groundPick(cx, cy) {
  ndc.set((cx / innerWidth) * 2 - 1, -(cy / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const o = ray.ray.origin, d = ray.ray.direction; let prev = 0;
  for (let t = 0.5; t < 250; t *= 1.04, t += 0.15) {
    const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t;
    const w = waterLevel(x, z), gh = Math.max(groundHeight(x, z), w);
    if (y < gh) return { p: new THREE.Vector3(x, gh, z), water: w >= groundHeight(x, z) - 0.05 };
    prev = t;
  }
  return null;
}
function onClick(cx, cy) {
  if (state.mode === 'fly') return;
  const f = pick(cx, cy);
  if (f) { if (state.mode === 'control' && state.ctrl === f) return; focusFigure(f); return; }
  const g = groundPick(cx, cy);
  // 投石：点水面出涟漪；点鹤：惊飞
  if (g && g.water) { ripple(g.p.x, g.p.z); if (Math.hypot(g.p.x - 108, g.p.z) < 12) cranes.forEach((c) => c.startle()); return; }
  if (g && cranes.some((c) => c.root.position.distanceTo(g.p) < 2.5)) { cranes.forEach((c) => c.startle()); return; }
  if (state.mode === 'control' && g) { state.walkTo = g.p; marker.position.copy(g.p); marker.visible = true; }
  if (state.mode === 'focus') exitFocus();
}
let rippleI = 0;
function ripple(x, z, speed = 0) {
  for (const m of [pondMesh.material, poolMesh.material, wfPool.material]) { m.uniforms.ripples.value[rippleI % 4].set(x, z, clock.elapsedTime, speed); }
  rippleI++;
}
const marker = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.38, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xb5432f, depthTest: true }));
marker.visible = false; scene.add(marker);

// 摇杆（手机）
const joy = { id: null, x: 0, y: 0, ox: 0, oy: 0 };
cv.addEventListener('pointerdown', (e) => {
  cv.setPointerCapture(e.pointerId);
  if (e.pointerType === 'touch' && e.clientX < innerWidth * 0.42 && e.clientY > innerHeight * 0.45 && joy.id === null) {
    joy.id = e.pointerId; joy.ox = e.clientX; joy.oy = e.clientY; joy.x = joy.y = 0;
    $('joy').style.left = e.clientX + 'px'; $('joy').style.top = e.clientY + 'px'; $('joy').hidden = false; return;
  }
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false, btn: e.button });
});
cv.addEventListener('pointermove', (e) => {
  if (e.pointerId === joy.id) {
    const dx = e.clientX - joy.ox, dy = e.clientY - joy.oy, l = Math.min(1, Math.hypot(dx, dy) / 55), a = Math.atan2(dy, dx);
    joy.x = Math.cos(a) * l; joy.y = Math.sin(a) * l;
    $('joyKnob').style.transform = `translate(${joy.x * 34}px,${joy.y * 34}px)`; return;
  }
  const p = pointers.get(e.pointerId);
  if (!p) { if (e.pointerType === 'mouse') hover(e.clientX, e.clientY); return; }
  const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 6) p.moved = true;
  if (!p.moved) return;
  if (pointers.size >= 2) { // 双指：自由镜头升降 / 操控时拉远拉近
    const arr = [...pointers.values()];
    const dist = Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y);
    if (state.pinch !== undefined) {
      if (state.mode === 'control') state.orbit.dist = THREE.MathUtils.clamp(state.orbit.dist * (state.pinch / dist), 2.2, 16);
      else if (state.mode === 'free') state.cam.pos.y -= dy * 0.05;
    }
    state.pinch = dist; return;
  }
  look(dx, dy);
});
function endPointer(e) {
  if (e.pointerId === joy.id) { joy.id = null; joy.x = joy.y = 0; $('joy').hidden = true; $('joyKnob').style.transform = ''; return; }
  const p = pointers.get(e.pointerId); pointers.delete(e.pointerId); if (pointers.size < 2) state.pinch = undefined;
  if (p && !p.moved && e.type === 'pointerup' && p.btn === 0) onClick(e.clientX, e.clientY);
}
cv.addEventListener('pointerup', endPointer); cv.addEventListener('pointercancel', endPointer);
cv.addEventListener('contextmenu', (e) => e.preventDefault());
cv.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (state.mode === 'control') state.orbit.dist = THREE.MathUtils.clamp(state.orbit.dist * (1 + Math.sign(e.deltaY) * 0.1), 2.2, 16);
  else if (state.mode === 'free') { state.cam.speed = THREE.MathUtils.clamp(state.cam.speed * (1 - Math.sign(e.deltaY) * 0.15), 3, 80); flashSpeed(); }
}, { passive: false });
let speedT = 0; function flashSpeed() { $('speed').textContent = `速度 ${state.cam.speed.toFixed(0)} 米/秒`; $('speed').hidden = false; speedT = 1.2; }
function look(dx, dy) {
  const k = MOBILE ? 0.0055 : 0.0035;
  if (state.mode === 'free' || state.mode === 'borrow') { state.cam.yaw += dx * k; state.cam.pitch = THREE.MathUtils.clamp(state.cam.pitch - dy * k, -1.35, 1.35); if (state.mode === 'free' && !ui.ovBar.hidden) hideOverlay(); }
  else if (state.mode === 'control') { state.orbit.yaw -= dx * k; state.orbit.pitch = THREE.MathUtils.clamp(state.orbit.pitch + dy * k, -0.15, 1.3); }
  else if (state.mode === 'focus') { /* 特写时拖动不转镜头 */ }
}
let hoverT = 0, hovered = null;
function hover(x, y) {
  if (performance.now() - hoverT < 60 || state.mode === 'fly') return; hoverT = performance.now();
  const f = pick(x, y);
  if (hovered && hovered !== f && hovered !== state.focus) hovered.hl = 0;
  hovered = f; cv.style.cursor = f ? 'pointer' : '';
  if (f && f !== state.ctrl) { f.hl = 0.7; ui.tag.textContent = f.def.name; ui.tag.hidden = false; ui.tag.style.left = x + 'px'; ui.tag.style.top = y - 18 + 'px'; }
  else ui.tag.hidden = true;
}

// 按钮
ui.bTake.onclick = () => state.focus && takeControl(state.focus);
ui.bBorrow.onclick = () => state.focus && borrowEyes(state.focus);
ui.bClose.onclick = exitFocus;
$('backBtn').onclick = () => (state.mode === 'borrow' ? exitBorrow() : null);
$('btnMap').onclick = () => toggleMap();
$('btnView').onclick = () => paintView(nearestStage(state.ctrl ? state.ctrl.root.position : camera.position));
$('btnHelp').onclick = () => ($('help').hidden = !$('help').hidden);
// v38 时辰：按钮显示当前时辰，点开一个小面板拨时辰、停住或让它流转
function updateClockUI() { const h = DN.S.hour; $('btnClock').innerHTML = `${shichen(h)}<span class="t">${phaseName(h)}</span>`; $('dnRange').value = h.toFixed(2); $('dnAuto').checked = DN.S.auto; }
$('btnClock').onclick = () => { $('dnPanel').hidden = !$('dnPanel').hidden; updateClockUI(); };
$('dnRange').oninput = (e) => { DN.setHour(+e.target.value); updateClockUI(); };
$('dnAuto').onchange = (e) => { DN.S.auto = e.target.checked; };
for (const b of document.querySelectorAll('#dnPanel [data-h]')) b.onclick = () => { DN.setHour(+b.dataset.h); updateClockUI(); };
$('dnClose').onclick = () => ($('dnPanel').hidden = true);
$('helpClose').onclick = () => ($('help').hidden = true);
$('mAct').onclick = () => interactKey();
$('mExit').onclick = () => (state.mode === 'control' ? releaseControl(true) : state.mode === 'focus' ? exitFocus() : null);
ui.dialog.onclick = () => (state.dialog ? nextLine() : closeDialog());
$('btnUp').addEventListener('pointerdown', () => keys.add('e')); $('btnUp').addEventListener('pointerup', () => keys.delete('e'));
$('btnDown').addEventListener('pointerdown', () => keys.add('q')); $('btnDown').addEventListener('pointerup', () => keys.delete('q'));

// ---------- 每帧 ----------
const clock = new THREE.Clock();
const fwd = new THREE.Vector3(), right = new THREE.Vector3();

function moveFigure(f, dx, dz) {
  const p = f.root.position, step = Math.hypot(dx, dz); if (step < 1e-5) return false;
  const ok = (x, z) => {
    if (Math.abs(x) > 345 || z < -170 || z > 70) return false;
    if (blocked(x, z, 0.28 * f.root.scale.x)) return false;
    const gh = groundHeight(x, z), w = waterLevel(x, z);
    if (w > gh - 0.05 && w > terrainHeight(x, z) + 0.25) return false; // 水深，过不去
    const rise = (gh - groundHeight(p.x, p.z)) / step;
    if (rise > 1.35 && !onStairs(x, z)) return false;
    return true;
  };
  let nx = p.x + dx, nz = p.z + dz;
  if (!ok(nx, nz)) { if (ok(p.x + dx, p.z)) nz = p.z; else if (ok(p.x, p.z + dz)) nx = p.x; else return false; }
  p.x = nx; p.z = nz; p.y = groundHeight(nx, nz);
  return true;
}

function updateNPC(f, dt) {
  if (f.controlled || f.inBoat || f.def.id === 'lan') { if (f.def.id === 'lan' && state.ctrl) f.look = state.ctrl.root.position.distanceTo(f.root.position) < 14 ? state.ctrl.root.position : null; return; }
  const d = f.def;
  if (f.paused) { f.speed = 0; return; }
  if (f.wait > 0) { f.wait -= dt; f.speed = 0; return; }
  if (f.followPlayer && state.ctrl) {
    const L = state.ctrl.root.position, p = f.root.position;
    const back = new THREE.Vector3(Math.sin(state.ctrl.root.rotation.y), 0, Math.cos(state.ctrl.root.rotation.y));
    const tx = L.x - back.x * 1.3 + back.z * 0.7, tz = L.z - back.z * 1.3 - back.x * 0.7;
    const dx = tx - p.x, dz = tz - p.z, dist = Math.hypot(dx, dz);
    if (dist > 0.4) { const sp = Math.min(dist * 1.8, 3.2); f.pose = 'idle'; f.speed = sp; f.heading = Math.atan2(dx, dz); if (!moveFigure(f, (dx / dist) * sp * dt, (dz / dist) * sp * dt)) { p.x = tx; p.z = tz; p.y = groundHeight(tx, tz); } }
    else { f.speed = 0; f.look = L; }
    return;
  }
  if (d.routine === 'follow') {
    const L = figs.get(d.leader); const p = f.root.position, lp = L.root.position;
    const back = new THREE.Vector3(Math.sin(L.root.rotation.y), 0, Math.cos(L.root.rotation.y));
    const tx = lp.x - back.x * 1.2 + back.z * 0.6, tz = lp.z - back.z * 1.2 - back.x * 0.6;
    const dx = tx - p.x, dz = tz - p.z, dist = Math.hypot(dx, dz);
    if (dist > 0.35) { const sp = Math.min(dist * 1.6, 2.6); f.speed = sp; f.heading = Math.atan2(dx, dz); p.x += (dx / dist) * sp * dt; p.z += (dz / dist) * sp * dt; p.y = groundHeight(p.x, p.z); }
    else { f.speed = Math.max(0, f.speed - dt * 4); f.look = lp; }
    return;
  }
  if (d.routine === 'patrol' && d.path) {
    const tgt = d.path[f.pathI], p = f.root.position;
    const dx = tgt[0] - p.x, dz = tgt[1] - p.z, dist = Math.hypot(dx, dz);
    if (dist < 0.3) {
      f.pathI += f.pathDir;
      if (f.pathI >= d.path.length || f.pathI < 0) { f.pathDir *= -1; f.pathI += 2 * f.pathDir; f.wait = 2.5 + Math.random() * 3; }
      return;
    }
    const sp = 0.95; f.speed = sp; f.heading = Math.atan2(dx, dz); f.look = null;
    p.x += (dx / dist) * sp * dt; p.z += (dz / dist) * sp * dt; p.y = groundHeight(p.x, p.z);
    return;
  }
  f.speed = 0;
  // 有人走近就转头看
  if (state.ctrl && state.ctrl.root.position.distanceTo(f.root.position) < 5) f.look = state.ctrl.root.position; else if (!f.action) f.look = null;
}

let boatT = 0, fallRip = 0, fallI = 0, cloudN = 0;
function frame() {
  window.__frames = (window.__frames || 0) + 1;
  const rawDt = clock.getDelta(), dt = Math.min(0.05, rawDt), t = clock.elapsedTime;
  if (!DEBUG_FIXED) adaptRes(rawDt);
  // —— 相机 ——
  if (state.mode === 'fly' && state.fly) {
    const F = state.fly; F.t += dt; const k = Math.min(1, F.t / F.dur), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    camera.position.lerpVectors(F.fromP, F.toP, e);
    // 飞行途中抬高，避免穿山
    camera.position.y += Math.sin(Math.PI * k) * Math.min(20, F.fromP.distanceTo(F.toP) * 0.08);
    camera.position.y = Math.max(camera.position.y, groundHeight(camera.position.x, camera.position.z) + 0.6);
    camera.quaternion.slerpQuaternions(F.fromQ, F.toQ, e);
    camera.fov = F.fromFov + (F.toFov - F.fromFov) * e; camera.updateProjectionMatrix();
    if (k >= 1) { state.fly = null; state.mode = 'free'; F.then && F.then(); if (state.mode === 'free') setCam(camera.position.clone(), F.at); }
  } else if (state.mode === 'free') {
    const c = state.cam, sp = c.speed * (keys.has('shift') ? 3 : 1) * dt;
    fwd.set(Math.sin(c.yaw), 0, -Math.cos(c.yaw)); right.set(Math.cos(c.yaw), 0, Math.sin(c.yaw));
    let mx = 0, mz = 0, my = 0;
    if (keys.has('w') || keys.has('arrowup')) mz += 1; if (keys.has('s') || keys.has('arrowdown')) mz -= 1;
    if (keys.has('d') || keys.has('arrowright')) mx += 1; if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
    if (keys.has('e') || keys.has(' ')) my += 1; if (keys.has('q') || keys.has('c')) my -= 1;
    mx += joy.x; mz -= joy.y;
    if (mx || mz || my) { if (!ui.ovBar.hidden) hideOverlay(); }
    c.pos.addScaledVector(fwd, mz * sp).addScaledVector(right, mx * sp); c.pos.y += my * sp * 0.7;
    c.pos.x = THREE.MathUtils.clamp(c.pos.x, -345, 345); c.pos.z = THREE.MathUtils.clamp(c.pos.z, -160, 80);
    c.pos.y = THREE.MathUtils.clamp(c.pos.y, groundHeight(c.pos.x, c.pos.z) + 1.2, 140);
    if (camera.fov !== 50 && !state.view) { camera.fov += (50 - camera.fov) * Math.min(1, dt * 3); camera.updateProjectionMatrix(); }
    applyFreeCam();
  } else if (state.mode === 'borrow') {
    camera.quaternion.setFromEuler(new THREE.Euler(state.cam.pitch, -state.cam.yaw, 0, 'YXZ'));
  } else if (state.mode === 'control' && state.ctrl) {
    const f = state.ctrl, o = state.orbit;
    let mx = 0, mz = 0;
    if (keys.has('w') || keys.has('arrowup')) mz += 1; if (keys.has('s') || keys.has('arrowdown')) mz -= 1;
    if (keys.has('d') || keys.has('arrowright')) mx += 1; if (keys.has('a') || keys.has('arrowleft')) mx -= 1;
    mx += joy.x; mz -= joy.y;
    const run = keys.has('shift') ? 2.0 : 1;
    let vx = 0, vz = 0;
    if (mx || mz) {
      state.walkTo = null; marker.visible = false;
      const fx = -Math.sin(o.yaw), fz = -Math.cos(o.yaw), rx = -fz, rz = fx;
      vx = fx * mz + rx * mx; vz = fz * mz + rz * mx;
      const l = Math.hypot(vx, vz); vx /= Math.max(1, l); vz /= Math.max(1, l);
    } else if (state.walkTo) {
      const dx = state.walkTo.x - f.root.position.x, dz = state.walkTo.z - f.root.position.z, d = Math.hypot(dx, dz);
      if (d < 0.3) { state.walkTo = null; marker.visible = false; } else { vx = dx / d; vz = dz / d; }
    }
    const l = Math.hypot(vx, vz);
    if (l > 0.01) {
      if (f.pose === 'sit') f.pose = 'idle';
      const sp = 1.6 * run * l;
      f.heading = Math.atan2(vx, vz);
      if (!moveFigure(f, vx * sp * dt / l * l, vz * sp * dt / l * l)) { state.walkTo = null; marker.visible = false; }
      f.speed = sp;
    } else f.speed = Math.max(0, f.speed - dt * 6);
    // 走近他人
    const n = nearestNPC();
    if (n !== state.near) { state.near = n; if (!n) closeMenu(); }
    ui.prompt.hidden = !n || state.menu || !!state.dialog;
    if (n) ui.prompt.innerHTML = MOBILE ? `点“互动”与${n.def.name}` : `<kbd>E</kbd> 与${n.def.name}互动`;
    $('mAct').disabled = !n && !state.dialog;
    // 惊鹤
    for (const c of cranes) if (c.root.position.distanceTo(f.root.position) < 3.5) c.startle();
    const tgt = f.root.position.clone().add(new THREE.Vector3(0, 1.35 * f.root.scale.y, 0));
    const want = orbitPos(tgt);
    camera.position.lerp(want, Math.min(1, dt * 10));
    camera.lookAt(tgt);
    if (Math.abs(camera.fov - 52) > 0.1) { camera.fov += (52 - camera.fov) * Math.min(1, dt * 3); camera.updateProjectionMatrix(); }
  }
  if (state.mode !== 'control') { ui.prompt.hidden = true; }
  // 竖屏时放宽视场角，让横向看到的范围和 16:10 屏幕差不多
  { const f = camera.fov; if (camera.aspect < 1.3) { const h = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(f) / 2) * 1.6); camera.fov = Math.min(95, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(h / 2) / camera.aspect))); } camera.updateProjectionMatrix(); camera.fov = f; }
  // —— NPC、动画 ——
  for (const f of figs.values()) {
    updateNPC(f, dt);
    if (f.root.position.distanceTo(camera.position) < 140 || f.inBoat) { f.root.visible = true; f.update(dt, t); } else f.root.visible = false;
  }
  for (const c of cranes) c.update(dt, terrainHeight);
  birds.update(t, camera);
  if (cloudN++ % 8 === 0) post.setClouds(CLOUD_L, camera);
  boatT += dt * 0.12;
  boat.position.set(POOLW.x + Math.sin(boatT) * 4.2, POOLW.wl + 0.05 + Math.sin(t * 1.3) * 0.04, POOLW.z - 0.7 + Math.cos(boatT) * 2.2); boat.rotation.y = Math.atan2(Math.sin(boatT) * 2.2, Math.cos(boatT) * 4.2) + Math.PI; boat.rotation.z = Math.sin(t * 1.1) * 0.03; // v40 在对岸瀑布潭里绕圈，船头朝前；圈往前收，离瀑布落水处留出两米多
  { // 岩洞里原画的船：泊在洞口水里轻轻晃，船尾的人慢慢撑篙
    boat2.position.set(-269.6 + Math.sin(t * 0.13) * 0.5, POOL3.wl + 0.05 + Math.sin(t * 1.1) * 0.03, -21.2); boat2.rotation.z = Math.sin(t * 0.9) * 0.025;
    boat2.userData.kids.forEach((k) => { k.update(dt, t); if (Math.random() < dt * 0.05) k.play('talk', 2.5); });
    const c = boat2.userData.poler, ph = (t * 0.22) % 1, push = ph < 0.6 ? ph / 0.6 : 1 - (ph - 0.6) / 0.4; c.update(dt, t);
    c.arms[1].rotation.x = -2.2 + push * 1.1; c.arms[0].rotation.x = -1.6 + push * 0.9; c.arms[0].rotation.z = -0.5; c.torso.rotation.x = 0.1 + push * 0.3; c.torso.rotation.y = -0.4; }
  boat.userData.kids.forEach((k, i) => { k.look = Math.sin(t * 0.3 + i * 2) > 0.2 ? boat.localToWorld(tmpV.set(1.25, 1, 0)).clone() : null; k.update(dt, t); if (Math.random() < dt * 0.06) k.play('talk', 2.5); });
  { const c = figs.get('chuan'); c.update(dt, t); if (!c.controlled) { // 撑篙：举篙、插水、推船，一下一下
    const ph = (t * 0.55) % 1, push = ph < 0.6 ? ph / 0.6 : 1 - (ph - 0.6) / 0.4;
    c.arms[1].rotation.x = -2.2 + push * 1.1; c.arms[0].rotation.x = -1.6 + push * 0.9; c.arms[0].rotation.z = -0.5; c.hands.forEach((h) => { h.rotation.x = -0.15; h.rotation.y = 0; });
    c.torso.rotation.x = 0.1 + push * 0.35; c.torso.rotation.y = -0.4; boatT += dt * 0.06 * (ph < 0.6 ? 1.6 : 0.3); } }
  for (const m of timed) m.uniforms.time.value = t;
  // 落水处不断外扩的涟漪（占用后两个槽位）；两面潭水只让近的那面实时倒影
  WF.fall.userData.update(t);
  if (t - fallRip > 0.9) { fallRip = t; const R = wfPool.material.uniforms.ripples.value; R[4].set(WF.bottom.x + (Math.random() - 0.5), WF.bottom.z - 0.4, t, 1.6); boat.localToWorld(tmpV.set(1.6, 0, 0)); R[5].set(tmpV.x, tmpV.z, t, 1.0); } // v40 落水处、撑篙处的涟漪
  pondMesh.visible = camera.position.distanceTo(pondMesh.position) < 260;
  poolMesh.visible = camera.position.distanceTo(poolMesh.position) < 260;
  wfPool.visible = camera.position.distanceTo(wfPool.position) < 260;
  for (const m of foliageMats) m.uniforms.time.value = t;
  if (sayTimer > 0) { sayTimer -= dt; if (sayTimer <= 0 && !state.dialog) ui.dialog.hidden = true; }
  if (speedT > 0) { speedT -= dt; if (speedT <= 0) $('speed').hidden = true; }
  // —— 景点、标签 ——
  const focusP = state.ctrl ? state.ctrl.root.position : camera.position;
  checkStage(focusP);
  for (const L of labelEls) {
    const d = L.v.distanceTo(camera.position);
    if (d > 110 || state.mode === 'borrow') { L.el.style.opacity = 0; continue; }
    tmpV.copy(L.v).project(camera);
    if (tmpV.z > 1 || Math.abs(tmpV.x) > 1.1 || Math.abs(tmpV.y) > 1.1) { L.el.style.opacity = 0; continue; }
    L.el.style.opacity = Math.min(1, (110 - d) / 30) * 0.95;
    L.el.style.transform = `translate(${(tmpV.x * 0.5 + 0.5) * innerWidth}px, ${(-tmpV.y * 0.5 + 0.5) * innerHeight}px) translate(-50%,-100%)`;
  }
  cullTrees();
  DN.update(dt, t, { ctrl: state.mode === 'control' ? state.ctrl : null });
  if (frameN % 15 === 0) updateClockUI();
  renderer.info.reset();
  post.render(scene, camera, t);
  DN.overlay(renderer);
  fpsAcc += rawDt; fpsN++;
  if (showFps && (frameN++ % 30 === 0)) { const fps = fpsN / Math.max(1e-3, fpsAcc); fpsAcc = 0; fpsN = 0; $('dbg').textContent = `${fps.toFixed(0)} fps · 分辨率 ${Math.round(adapt.scale * 100)}% · ${renderer.info.render.calls} draws · ${(renderer.info.render.triangles / 1000).toFixed(0)}k tris · ${camera.position.toArray().map((v) => v.toFixed(1)).join(', ')}`; }
  requestAnimationFrame(frame);
}
let frameN = 0;
// 帧率显示：P 键切换；手机上连点左上角印章三下
let showFps = DEBUG, fpsAcc = 0, fpsN = 0;
function toggleFps() { showFps = !showFps; $('dbg').hidden = !showFps; }
$('dbg').hidden = !showFps;
{ let taps = []; document.querySelector('#title .seal').addEventListener('pointerdown', () => { const n = performance.now(); taps = taps.filter((t) => n - t < 800); taps.push(n); if (taps.length >= 3) { taps = []; toggleFps(); } }); }

// ---------- 开场 ----------
const S08 = STAGES.find((s) => s.id === 'S08');
const startStage = START ? STAGES.find((s) => s.id === START) || S08 : S08;
setCam(new THREE.Vector3(...startStage.view.pos), new THREE.Vector3(...startStage.view.at));
camera.fov = startStage.view.fov; camera.updateProjectionMatrix(); applyFreeCam();
setHint();
$('go').onclick = () => { $('intro').hidden = true; };
$('goHead').onclick = () => { $('intro').hidden = true; const S = STAGES[0]; paintView(S); };
document.fonts && document.fonts.ready.then(() => {});
DN.finalize({ pond: POND });
await step('上颜色');
try { await renderer.compileAsync(scene, camera); } catch (e) { renderer.compile(scene, camera); } // 着色器并行编译，不卡页面
$('loading').textContent = '';
requestAnimationFrame(frame);
requestAnimationFrame(() => requestAnimationFrame(() => document.body.classList.add('ready'))); // 第一帧画出后，揭开开场的原画底
console.info(`[bake] used ${BAKE.used}, computed ${BAKE.missed}, ready ${performance.now().toFixed(0)}ms`);
if (BAKE.mode === 'record') { bakeList(MOBILE ? 'rocks-m' : 'rocks-d', ROCK_KEYS); window.__bakeText = bakeOutput(); }
window.__game = { DN, setHour: (h) => { DN.setHour(h); updateClockUI(); }, post, birds, doAction: (a) => doAction(a), borrowEyes, exitBorrow, keys, joy, terrain, scene, treeSets, state, camera, figs, STAGES, setCam, applyFreeCam, paintView, focusFigure, takeControl, groundHeight };
