// v42 预存：载入时最费 CPU、结果又很小的几样计算，事先算好存进 assets/world_bake.txt，打开页面时直接读。
// - 地形大网格、超然亭细网格的高度（原来每次现场算十几万次 terrainHeight）
// - S06 画境反投影射线落点（每条射线按 0.1 米步进，最多三千次 terrainHeight）
// - 用到哪些嶙峋石（只记参数；开页面时交给 rockworker.js 在后台线程并行算，见 main.js startRockWorker）
// 文件里记着生成时 js/*.js 全部源码的指纹；任何一个 js 改过，指纹对不上，整份预存作废，照旧现场算（只是慢，结果不会错）。
// 重新生成：链接加 ?bake 打开，载入完后 window.__bakeText 就是新文件内容（tools/bake.mjs 自动做这一步）。
const FILES = ['art', 'bake', 'birds', 'buildings', 'crane', 'data', 'daynight', 'fartrees', 'figures', 'guanyin', 'main', 'props', 'rockgen', 'rockworker', 'water', 'world', 'zone1', 'zone2'];
const URL_ = 'assets/world_bake.txt';
export const BAKE = { mode: 'off', hash: '', data: null, rec: null, used: 0, missed: 0 };

function cyrb53(str, seed = 0) { // 53 位字符串哈希（不依赖 crypto.subtle，http 页面也能用）
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) { ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
const b64 = { // Float32Array <-> base64
  enc(a) { const u = new Uint8Array(a.buffer, a.byteOffset, a.byteLength); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); },
  dec(s) { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Float32Array(u.buffer); },
};

export async function initBake() {
  const t0 = performance.now();
  const rec = /[?&]bake\b/.test(location.search), off = /[?&]nobake\b/.test(location.search);
  try {
    const [srcs, file] = await Promise.all([
      Promise.all(FILES.map((f) => fetch(`js/${f}.js`).then((r) => (r.ok ? r.text() : '')))),
      rec || off ? null : fetch(URL_).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    BAKE.hash = cyrb53(srcs.map((s) => s.replace(/\r\n/g, '\n')).join('\u0000'));
    if (rec) { BAKE.mode = 'record'; BAKE.rec = { hash: BAKE.hash, arrays: {}, hits: {}, lists: {} }; }
    else if (file && file.hash === BAKE.hash) { BAKE.mode = 'use'; BAKE.data = file; }
    else BAKE.mode = file ? 'stale' : 'none';
  } catch (e) { BAKE.mode = 'error'; }
  console.info(`[bake] ${BAKE.mode} ${BAKE.hash} ${(performance.now() - t0).toFixed(0)}ms`);
}

// 一整块 Float32 数组：有预存且长度对得上就直接用，否则 fill(arr) 现场算（录制模式下顺手记下）
export function bakedArray(key, n, fill) {
  const s = BAKE.data?.arrays?.[key];
  if (s) { const a = b64.dec(s); if (a.length === n) { BAKE.used++; return a; } }
  const a = new Float32Array(n); fill(a); BAKE.missed++;
  if (BAKE.rec) BAKE.rec.arrays[key] = b64.enc(a);
  return a;
}
// 记忆一个以短 key 为参数的函数（射线落点之类）。fn 的结果须是数字数组或 null
export function bakedFn(group, fn) {
  const D = BAKE.data?.hits?.[group];
  const R = BAKE.rec ? (BAKE.rec.hits[group] = {}) : null;
  return (...args) => {
    const k = args.join(',');
    if (D && k in D) { BAKE.used++; return D[k] && D[k].slice(); }
    const v = fn(...args); BAKE.missed++;
    if (R) R[k] = v && Array.from(v);
    return v;
  };
}
// 一张小清单（比如要预先交给 Worker 算的石头参数）：读预存的；录制模式下 put 记下
export const bakedList = (name) => BAKE.data?.lists?.[name] || null;
export function bakeList(name, arr) { if (BAKE.rec) BAKE.rec.lists[name] = arr; }
export function bakeOutput() { return BAKE.rec ? JSON.stringify(BAKE.rec) : null; }
