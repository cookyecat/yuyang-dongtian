// v43 署名与题名壁：作者的跋（常驻朱印点开）、卷尾峡谷尽头的摩崖题刻、峡谷北壁的「题名壁」（游人到此一游）、峡口写生的画师。
// v49 卷尾峡谷撤掉：游线尽头是一片临崖的望云台，台外云海。作者的题刻刻在台北一面立崖上迎着来路，画师坐在崖沿对着云海写生。
// v50 游人的题名壁挪到玉女潭（开场就在这里，人人路过）：玉光閣西边游线南侧一道低石屏。题名的数据存在 Cloudflare Worker（见 guestbook/），地址写在 index.html 的 <meta name="yy-guestbook">。
import * as THREE from 'three';
import { t, isEn, onLang } from './i18n.js';

export const AUTHOR = {
  cn: '李揚', en: 'YANG LI', partner: 'Claude',
  github: 'https://github.com/cookyecat', ghName: 'cookyecat',
  x: 'https://x.com/myannli', xName: '@myannli',
  date: '丙午初冬',
};
// 卷尾望云台：题刻、题名壁、画师的位置
export const END = {
  // v49 卷尾峡谷撤掉，改成游线尽头的望云台：题刻是台北一面立崖，迎着来路；题名壁是台南一道低石屏；画师坐在崖沿对着云海写生
  moya: { x: -404.6, z: -1.6, w: 5.6, h: 6.4, ry: 0.75 },
  // v50 题名壁挪到玉女潭（Yang：放在卷尾，进来的人看不见）：玉光閣西边游线南侧一道石屏，朝着游线和东来的人；开场画境镜头里看不到
  wall: { x: -4.5, z: 12, w: 8.6, h: 3.9, ry: 2.78 },
  wallView: { pos: [3.5, 9.2, 2.5], at: [-4.5, 7.6, 12], fov: 50 },
  painter: { x: -408.6, z: 5.2, face: -Math.PI / 2 + 0.15 },
  view: { pos: [-386, 11.5, 10], at: [-406, 6.5, 3], fov: 50 },
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

// ---------- 题名字数 ----------
// v54 按字宽算，不按字数：汉字、假名、谚文、全角符号、表情算 2，西文字母、数字、空格、半角标点算 1。
// 中文上限照旧（名字 12、来自 10、留一句 20 个汉字），英文可写到 24、20、40 个字母（Sarah Campbell、University of Galway 都放得下）。
// 后端 guestbook/src/worker.js 用同一套算法（那边是单独部署的，代码抄了一份），两边改要一起改。
export const TB_MAX = { name: 24, place: 20, msg: 40 };
const wideCp = (c) => (c >= 0x1100 && c <= 0x115f) || (c >= 0x2e80 && c <= 0xa4cf) || (c >= 0xac00 && c <= 0xd7a3) || (c >= 0xf900 && c <= 0xfaff)
  || (c >= 0xfe30 && c <= 0xfe4f) || (c >= 0xff00 && c <= 0xff60) || (c >= 0xffe0 && c <= 0xffe6) || c >= 0x1f000;
export function textWidth(s) { let n = 0; for (const ch of String(s)) n += wideCp(ch.codePointAt(0)) ? 2 : 1; return n; }
function clipWidth(s, max) { let n = 0, out = ''; for (const ch of s) { n += wideCp(ch.codePointAt(0)) ? 2 : 1; if (n > max) break; out += ch; } return out; }
// 跟后端一样清洗后再量：全角半角统一、去掉控制字符和零宽字符、合并空白
const tidy = (s) => String(s ?? '').normalize('NFKC').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, '').replace(/\s+/g, ' ').trim();
// 一段西文（拉丁字母连同中间的空格、半角标点）：竖排时整段侧过来写，不拆成单个字母
const LAT = '[\\p{Script=Latin}\\x21-\\x7e\\u2018\\u2019\\u201c\\u201d]+(?: +[\\p{Script=Latin}\\x21-\\x7e\\u2018\\u2019\\u201c\\u201d]+)*';
const LAT_SPLIT = new RegExp(`${LAT}|.`, 'gsu'), LAT_ONE = new RegExp(`^${LAT}$`, 'u');

// ---------- 社交账号（v55） ----------
// 游人只选平台、填用户名，主页链接由这里按平台的固定格式拼出来，不收网址，所以点开只会去这五家的主页。
// 带账号的题名先审后上（后端 hidden = 2，Yang 在 /admin 里点「通过」）。石屏上照旧只刻名字，题名框里点开名字才看到账号。
// 后端 guestbook/src/worker.js 有同一张表（平台、格式），两边改要一起改。
const XHS_ID = /^[0-9a-f]{24}$/; // 小红书主页链接里那串 ID；小红书号没有对应的网址，卡片上只给号码和「复制」
export const SNS = {
  weibo: { zh: '微博', en: 'Weibo', at: true, ph: ['微博昵称，或数字 ID', 'Weibo nickname or numeric ID'],
    rule: ['昵称 2–15 个汉字（或 4–30 个字母），或纯数字 ID', 'a nickname of 4–30 letters, or the numeric ID'],
    ok: (h) => /^\d{5,12}$/.test(h) || (/^[\p{Script=Han}A-Za-z0-9_-]+$/u.test(h) && textWidth(h) >= 4 && textWidth(h) <= 30),
    url: (h) => (/^\d+$/.test(h) ? `https://weibo.com/u/${h}` : `https://weibo.com/n/${encodeURIComponent(h)}`) },
  xhs: { zh: '小红书', en: 'Xiaohongshu', ph: ['小红书号，或主页链接', 'RED ID, or your profile link'],
    rule: ['小红书号（字母、数字、下划线），或 xiaohongshu.com/user/profile/… 主页链接', 'your RED ID, or a xiaohongshu.com/user/profile/… link'],
    ok: (h) => XHS_ID.test(h) || /^[A-Za-z0-9_]{5,20}$/.test(h), url: (h) => (XHS_ID.test(h) ? `https://www.xiaohongshu.com/user/profile/${h}` : '') },
  x: { zh: 'X', en: 'X', at: true, ph: ['用户名（@ 后面那段）', 'Username (the part after @)'],
    rule: ['1–15 位字母、数字或下划线', '1–15 letters, digits or underscores'],
    ok: (h) => /^[A-Za-z0-9_]{1,15}$/.test(h), url: (h) => `https://x.com/${h}` },
  instagram: { zh: 'Instagram', en: 'Instagram', at: true, ph: ['用户名', 'Username'],
    rule: ['最多 30 位字母、数字、下划线和点', 'up to 30 letters, digits, underscores and dots'],
    ok: (h) => /^[A-Za-z0-9._]{1,30}$/.test(h) && !/^\.|\.$|\.\./.test(h), url: (h) => `https://www.instagram.com/${h}/` },
  github: { zh: 'GitHub', en: 'GitHub', ph: ['用户名', 'Username'],
    rule: ['最多 39 位字母、数字和连字符', 'up to 39 letters, digits and hyphens'],
    ok: (h) => h.length <= 39 && /^[A-Za-z0-9](?:-?[A-Za-z0-9])*$/.test(h), url: (h) => `https://github.com/${h}` },
};
const snsOf = (it) => (it && Object.hasOwn(SNS, it.sns || '') && it.handle && SNS[it.sns].ok(it.handle) ? SNS[it.sns] : null);
const cleanHandle = (s) => tidy(s).replace(/\s+/g, '').replace(/^@+/, '');
// 贴进来的是主页链接：认出平台和用户名（只认这五家的主页格式，别的链接一律不收）
function fromLink(s) {
  if (!/[/]|\.(com|cn)\b/i.test(s)) return null;
  let u; try { u = new URL(/^[a-z]+:\/\//i.test(s) ? s : 'https://' + s); } catch (e) { return { err: 1 }; }
  const host = u.hostname.toLowerCase().replace(/^(www|m|mobile)\./, ''), seg = u.pathname.split('/').filter(Boolean).map((p) => { try { return decodeURIComponent(p); } catch (e) { return p; } });
  if (host === 'x.com' || host === 'twitter.com') return seg[0] ? { sns: 'x', handle: seg[0].replace(/^@/, '') } : { err: 1 };
  if (host === 'github.com') return seg[0] ? { sns: 'github', handle: seg[0] } : { err: 1 };
  if (host === 'instagram.com') return seg[0] ? { sns: 'instagram', handle: seg[0] } : { err: 1 };
  if (host === 'weibo.com' || host === 'weibo.cn') {
    if ((seg[0] === 'u' || seg[0] === 'profile') && /^\d+$/.test(seg[1] || '')) return { sns: 'weibo', handle: seg[1] };
    if (seg[0] === 'n' && seg[1]) return { sns: 'weibo', handle: seg[1] };
    if (/^\d{5,12}$/.test(seg[0] || '')) return { sns: 'weibo', handle: seg[0] };
    return { err: 1 };
  }
  if (host === 'xiaohongshu.com' && seg[0] === 'user' && seg[1] === 'profile' && XHS_ID.test(seg[2] || '')) return { sns: 'xhs', handle: seg[2] };
  if (host === 'xhslink.com') return { err: 'xhs' };
  return { err: 1 };
}
// 卡片上怎么写这个账号
function handleShown(it) {
  const s = SNS[it.sns], h = it.handle;
  if (it.sns === 'xhs') return XHS_ID.test(h) ? t('主页', 'Profile') : t('小红书号 ', 'RED ID ') + h;
  if (it.sns === 'weibo' && /^\d+$/.test(h)) return 'ID ' + h;
  return (s.at ? '@' : '') + h;
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
  if (!r.ok) throw new Error(errEn(j.error || '题壁没有成功，稍后再试'));
  return j;
}
// v52 后端（guestbook/src/worker.js）回的错误是中文；英文界面按原句换成英文，对不上的给一句通用的
const ERR_EN = {
  只能在游园页面里题名: 'Names can only be signed from within the garden walk.',
  石壁一时刻不上稍后再试: 'The stone will not take the chisel just now. Please try again later.',
  写得太长了: 'That is too long for the stone.',
  看不懂这条题名: 'That inscription could not be read.',
  慢一点从容落笔: 'Not so fast. Take your time with the brush.',
  先写下名字: 'Write your name first.',
  石壁上不留网址电话和账号: 'No web addresses, phone numbers or account names on the wall, please.',
  '名字和留言里不留网址电话；想让人找到你请填社交账号一栏': 'No web addresses or phone numbers in your name or line, please. To let people find you, use the social account field.',
  账号太长了: 'That account name is too long.',
  先选是哪个平台的账号: 'Pick which platform the account is on.',
  这个平台还不支持: 'That platform is not supported.',
  这几个字不宜刻上石壁换个说法吧: 'Those words are not fit for the stone. Try saying it another way.',
  刚题过了歇一会儿再来: 'You have only just signed. Rest a moment before signing again.',
  今天题得够多了明天再来: 'You have signed enough for one day. Come back tomorrow.',
  今天石壁已经题满了明天再来: 'The wall is full for today. Come back tomorrow.',
  这一条已经刻在壁上了: 'That one is already carved on the wall.',
};
function errEn(m) {
  if (!isEn()) return m;
  const k = String(m).replace(/[\s，。、,.!！]/g, '');
  if (ERR_EN[k]) return ERR_EN[k];
  const bad = /^(.+)账号的格式不对$/.exec(k), s = bad && Object.values(SNS).find((v) => v.zh === bad[1]);
  if (s) return `That does not look like a ${s.en} account: ${s.rule[1]}.`;
  if (/^名字最多/.test(k)) return `Too long for the stone: a name may be up to ${TB_MAX.name} letters, a place up to ${TB_MAX.place}, and a line up to ${TB_MAX.msg} (Chinese characters count double).`;
  return 'The inscription did not go through. Please try again later.';
}
const dateEn = (ts) => new Date(ts).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });

// ---------- 刻字画布 ----------
// 阴刻：先在右下方压一道浅色（刀口受光），再填墨
function carve(g, ch, x, y, size, ink = 'rgba(38,33,26,.9)') {
  g.fillStyle = 'rgba(250,244,226,.32)'; g.fillText(ch, x + size * 0.035, y + size * 0.035);
  g.fillStyle = ink; g.fillText(ch, x, y);
}
// 竖排一列，西文旋转 90°：v54 起一整段西文（连同词间空格、带重音的字母）一起侧过来，不再一个词一转、重音字母竖着插在中间。
// ink 为空时只量不画，返回这一列排到哪里
function vline(g, text, x, y, size, font, ink, gap = 1.04) {
  const parts = text.match(LAT_SPLIT) || [];
  let yy = y; g.textAlign = 'center'; g.textBaseline = 'top';
  for (const p of parts) {
    if (p === ' ') { yy += size * 0.45; continue; }
    if (LAT_ONE.test(p)) {
      g.font = `${size * 0.82}px ${font}`; const w = g.measureText(p).width;
      if (ink) {
        g.save(); g.translate(x, yy + w / 2 + size * 0.08); g.rotate(Math.PI / 2); g.textBaseline = 'middle';
        carve(g, p, 0, 0, size * 0.82, ink); g.restore(); g.textBaseline = 'top';
      }
      yy += w + size * 0.22; continue;
    }
    g.font = `${size}px ${font}`; if (ink) carve(g, p, x, yy, size, ink); yy += size * gap;
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

function inscriptionTexture() { // 望云台立崖上的摩崖：作者题记
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
  const spans = []; // v55 每人占画布上哪一段（横向像素），石屏上点名字时用来认出是谁
  if (!items || !items.length) {
    vline(g, API ? '尚无人题名 候君落笔' : '题名壁不日开放', x, 120, 64, BRUSH, 'rgba(34,30,24,.55)');
  } else {
    // v54 每条先量再排：名字和「自某地来游 某年某月」一列放得下就照旧（小字接在名字下面）；
    // 放不下（名字长、地名长，英文尤其）就把这行小字挪到名字左边另起一列，留言再往左一列。哪一列单独也放不下，就缩字
    const TOP = 70, BOT = H - 46;
    const len = (text, size) => vline(g, text, 0, 0, size, KAI, null);
    const fit = (text, size, y0) => { const L = len(text, size); return y0 + L <= BOT ? size : size * Math.max(0.5, (BOT - y0) / L); };
    for (const it of items) {
      if (x < 70) break;
      const nameSize = fit(it.name, [...it.name].length > 6 ? 54 : 70, TOP);
      const yy = vline(g, it.name, x, TOP, nameSize, KAI, 'rgba(30,26,20,.9)');
      const sub = (it.place ? `自${it.place}来游 ` : '到此一游 ') + ganzhiDate(it.ts);
      const subY = Math.max(yy + 20, TOP + nameSize * 2), small = TOP + nameSize * 0.6;
      let cx = x - nameSize * 0.5 - 22, last = x; // 小字列离名字半个大字再空一点，大字（70）也不会压到
      if (subY + len(sub, 32) <= BOT) vline(g, sub, x + (it.msg ? 22 : 0), subY, 32, KAI, 'rgba(30,26,20,.7)');
      else { vline(g, sub, cx, small, fit(sub, 32, small), KAI, 'rgba(30,26,20,.7)'); last = cx; cx -= 38; }
      if (it.msg) { vline(g, it.msg, cx, small, fit(it.msg, 34, small), KAI, 'rgba(30,26,20,.72)'); last = cx; }
      spans.push({ id: it.id, x0: last - 44, x1: x + Math.max(44, nameSize * 0.6) });
      x = last === x ? x - 96 : last - 88;
    }
  }
  const t = new THREE.CanvasTexture(c); t.anisotropy = 8; t.userData.spans = spans; return t;
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

  // 画师：望云台崖沿铺纸写生（v49，原来在峡口），面前一张矮几（纸、笔、砚），身后一只书箱
  const P = END.painter;
  const def = {
    id: 'huashi', name: '画师', pos: [P.x, 0, P.z], face: P.face, robe: '#efe9da', trim: '#3f6f8c', hat: 'scarf', seat: 'cushion', routine: 'sit', control: false,
    card: { eye: '卷尾 · 望云台', title: '崖头的画师',
      body: ['路的尽头是一片临崖的平台，台外云海茫茫。一位画师坐在崖沿铺纸写生，画的正是这一卷。原画里没有他：他是这座游园的作者留在画里的影子。',
        `<span class="cr">${AUTHOR.en} 与 ${AUTHOR.partner} 同制 · <a href="${AUTHOR.github}" target="_blank" rel="noopener">GitHub</a> · <a href="${AUTHOR.x}" target="_blank" rel="noopener">X ${AUTHOR.xName}</a></span>`],
      tip: '接管一位游人走到他身边，可以和他聊几句；题名壁在玉女潭玉光閣西边的路旁。', extra: [['看跋', 'ba'], ['题名', 'wall']] },
    lines: ['有客到了！这一卷从金晶巖一路走到四陽洞，你都看过了吗？',
      '我照着展厅里拍下的十三帧，和 Claude 一起，一山一石、一屋一人地把它搭成了能走进去的山水。',
      '原画接缝处看不清的地方，是我们按画意补的。哪里不像，尽管告诉我。',
      '玉女潭玉光閣西边路旁有一道石屏，是题名壁。留个名字吧，也算到此一游。'],
    after: 'ba',
    en: { name: 'Painter', // v52 英文界面
      card: { eye: 'Scroll’s End · Cloud-Viewing Terrace', title: 'The Painter on the Cliff',
        body: ['The path ends at a terrace on the cliff edge, with a boundless sea of clouds beyond. A painter sits at the brink with paper spread before him, sketching, and what he paints is this very scroll. He is not in the original: he is the shadow that the makers of this garden walk have left inside the painting.',
          `<span class="cr">Made by Yang Li with ${AUTHOR.partner} · <a href="${AUTHOR.github}" target="_blank" rel="noopener">GitHub</a> · <a href="${AUTHOR.x}" target="_blank" rel="noopener">X ${AUTHOR.xName}</a></span>`],
        tip: 'Walk a figure over to him for a few words. The inscription wall stands beside the path west of the Jade Light Tower, at the Jade Maiden Pool.', extra: [['Colophon', 'ba'], ['Sign the wall', 'wall']] },
      lines: ['A visitor! Have you seen the whole scroll, all the way from Golden Crystal Cliff to Siyang Cave?',
        'From thirteen photographs taken in the gallery, Claude and I built it, mountain by mountain and stone by stone, house by house and figure by figure, into a landscape you can walk into.',
        'Where the seams hid the painting, we filled in what its brush suggested. If anything looks wrong, do tell me.',
        'Beside the path west of the Jade Light Tower, at the Jade Maiden Pool, stands a stone screen: the inscription wall. Leave your name there, and the world will know you were here.'] },
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
    wallItemAt(p) { // v55 石屏上点中的那一点（世界坐标）落在谁的名字上，返回题名的 id
      if (!p) return null;
      const S = END.wall, pw = S.w - 2 * 0.45, l = wall.rock.worldToLocal(p.clone());
      const cx = ((l.x + pw / 2) / pw) * 2048, spans = wall.plane.material.uniforms.map.value.userData.spans || [];
      const hit = spans.find((s) => cx >= s.x0 && cx <= s.x1);
      return hit ? hit.id : null;
    },
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
export function initCreditUI({ onFlyEnd, onFlyWall, onWallItems }) {
  const ba = $('ba'), tb = $('tibi');
  let items = null, loaded = false;
  const open = (el) => { el.hidden = false; el.classList.remove('in'); void el.offsetWidth; el.classList.add('in'); };
  const openBa = () => { tb.hidden = true; open(ba); };
  let openedAt = 0;
  // v55 openWall(id)：从石屏上点某人的名字进来时，打开题名框后顺手翻开这个人的小卡片
  const openWall = (id) => {
    ba.hidden = true; hideCard(); open(tb); openedAt = Date.now();
    refresh().then(() => { if (id != null && !tb.hidden) showCard(id); });
    setTimeout(() => { if (id == null && matchMedia('(pointer:fine)').matches) $('tbName').focus(); }, 60);
  };
  const close = () => { const was = !ba.hidden || !tb.hidden; ba.hidden = true; tb.hidden = true; hideCard(); return was; };
  $('aseal').onclick = openBa;
  $('baClose').onclick = () => (ba.hidden = true);
  $('tbClose').onclick = () => { tb.hidden = true; hideCard(); };
  $('baWall').onclick = () => openWall();
  $('baGo').onclick = () => { close(); onFlyEnd(); };
  $('tbGo').onclick = () => { close(); (onFlyWall || onFlyEnd)(); };
  $('tbBa').onclick = openBa;
  for (const el of document.querySelectorAll('[data-open-ba]')) el.addEventListener('click', (e) => { e.preventDefault(); openBa(); });
  ba.addEventListener('pointerdown', (e) => { if (e.target === ba) ba.hidden = true; });
  addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || (ba.hidden && tb.hidden)) return;
    e.stopPropagation();
    if (!card.hidden) { hideCard(); return; } // 先合上小卡片，再按一次才关题名框
    ba.hidden = true; tb.hidden = true;
  }, true);
  tb.addEventListener('pointerdown', (e) => {
    if (e.target === tb) { tb.hidden = true; hideCard(); return; }
    if (!card.hidden && !card.contains(e.target) && !e.target.closest('.tb-col')) hideCard();
  });

  const list = $('tbList'), msg = $('tbMsg'), form = $('tbForm'), card = $('tbCard');
  const sub = (it) => (isEn() ? `${it.place ? 'from ' + it.place : 'was here'} · ${dateEn(it.ts)}` : `${it.place ? '自' + it.place + '来游' : '到此一游'} · ${ganzhiDate(it.ts)}`);
  function render() {
    if (!API) { list.innerHTML = `<p class="tb-empty">${t('题名壁不日开放。', 'The inscription wall opens soon.')}</p>`; form.classList.add('off'); return; }
    if (!items) { list.innerHTML = `<p class="tb-empty">${t('正在拓印石壁上的题名…', 'Taking rubbings of the names on the stone…')}</p>`; return; }
    if (!items.length) { list.innerHTML = `<p class="tb-empty">${t('还没有人题名，候君落笔。', 'No one has signed yet. The first stroke is yours.')}</p>`; return; }
    // 纯西文整段侧过来（class="lat"）；中西混排时汉字一个一行，夹在中间的西文整段侧过来（<em class="lr">），不拆成单个字母
    const vt = (tag, s) => (LAT_ONE.test(s) ? `<${tag} class="lat">${esc(s)}</${tag}>`
      : `<${tag}>${(s.match(LAT_SPLIT) || []).map((p) => (LAT_ONE.test(p) ? `<em class="lr">${esc(p)}</em>` : esc(p))).join('')}</${tag}>`);
    // v55 每一列都能点开看小卡片；留了社交账号的，落款小字后面盖一枚小朱印作记号（账号本身只在卡片上）
    list.innerHTML = items.map((it) => {
      const s = snsOf(it), tip = s ? t(`点开看 ${it.name} 的${s.zh}`, `Open to see ${it.name}’s ${s.en}`) : t('点开看', 'Open');
      const tail = vt('span', sub(it)).replace(/<\/span>$/, s ? '<u class="tb-seal" aria-hidden="true"></u></span>' : '</span>');
      return `<div class="tb-col${s ? ' sns' : ''}" role="button" tabindex="0" data-id="${esc(it.id)}" title="${esc(tip)}">${vt('b', it.name)}${it.msg ? vt('i', it.msg) : ''}${tail}</div>`;
    }).join('');
    if (cardId != null) list.querySelector(`.tb-col[data-id="${CSS.escape(String(cardId))}"]`)?.classList.add('on'); // 重画时卡片还开着，这一列照旧高亮
  }

  // ---------- v55 题名小卡片：名字、来处、留言，和题名者留下的社交账号 ----------
  let cardId = null, cardAt = 0;
  function hideCard() { if (!card) return; card.hidden = true; cardId = null; list.querySelectorAll('.tb-col.on').forEach((c) => c.classList.remove('on')); }
  function showCard(id) {
    const it = (items || []).find((x) => String(x.id) === String(id)), col = list.querySelector(`.tb-col[data-id="${CSS.escape(String(id))}"]`);
    if (!it || !col) { hideCard(); return; }
    hideCard(); cardId = it.id; col.classList.add('on');
    const s = snsOf(it);
    let acct = '';
    if (s) {
      const url = s.url(it.handle), label = `<em>${esc(t(s.zh, s.en))}</em>`;
      acct = url
        ? `<a class="tbc-acct" href="${esc(url)}" target="_blank" rel="noopener nofollow ugc">${label}<span>${esc(handleShown(it))}</span><i>↗</i></a><small>${t('在新窗口打开外部网站', 'Opens an outside site in a new tab')}</small>`
        : `<div class="tbc-acct">${label}<span>${esc(handleShown(it))}</span><button type="button" class="tbc-copy">${t('复制', 'Copy')}</button></div><small>${t('在小红书里搜这个号就能找到', 'Search for this ID in the Xiaohongshu app')}</small>`;
    }
    card.innerHTML = `<button type="button" class="close" aria-label="${t('合上', 'Close')}">×</button><div class="tbc-name">${esc(it.name)}</div>`
      + `<div class="tbc-sub">${esc(sub(it))}</div>${it.msg ? `<div class="tbc-msg">${t('「', '“')}${esc(it.msg)}${t('」', '”')}</div>` : ''}${acct}`;
    card.querySelector('.close').onclick = hideCard;
    const cp = card.querySelector('.tbc-copy');
    if (cp) cp.onclick = async () => { try { await navigator.clipboard.writeText(it.handle); cp.textContent = t('已复制', 'Copied'); } catch (e) { cp.textContent = it.handle; } };
    card.hidden = false; cardAt = performance.now();
    // 摆在这一列旁边：题名从右往左排，卡片先放左边，放不下放右边；手机上居中
    col.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const box = tb.firstElementChild, B = box.getBoundingClientRect(), C = col.getBoundingClientRect(), L = list.getBoundingClientRect(), w = card.offsetWidth;
    let left = C.left - B.left - w - 6;
    if (left < 8) left = C.right - B.left + 6;
    if (left + w > B.width - 8) left = (B.width - w) / 2;
    card.style.left = `${Math.max(8, left)}px`;
    card.style.top = `${L.top - B.top + box.scrollTop + 10}px`;
  }
  list.addEventListener('click', (e) => { const c = e.target.closest('.tb-col'); if (!c) return; if (String(cardId) === c.dataset.id) hideCard(); else showCard(c.dataset.id); });
  list.addEventListener('keydown', (e) => { const c = e.target.closest('.tb-col'); if (c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); showCard(c.dataset.id); } });
  list.addEventListener('scroll', () => { if (!card.hidden && performance.now() - cardAt > 400) hideCard(); }, { passive: true }); // 翻开时为了露出这一列滚的那一下不算

  let offline = false;
  const showOffline = () => { list.innerHTML = `<p class="tb-empty">${t('石壁一时看不清（网络不通），稍后再来。', 'The wall cannot be read just now (no connection). Please come back later.')}</p>`; };
  async function refresh(force) {
    if (!API) { render(); return; }
    if (loaded && !force) { render(); return; }
    render();
    try { const j = await fetchNames(); items = j.items || []; loaded = true; offline = false; render(); onWallItems(items); }
    catch (e) { offline = true; showOffline(); }
  }
  // v54 字数按字宽卡：写满了就不再往下收，并提示一句（拼音输入法选字的过程中不截，选完再看）
  const FIELDS = [['tbName', 'name', '名字'], ['tbPlace', 'place', '来自'], ['tbText', 'msg', '留一句']];
  const fullNote = (k, zh) => t(`${zh}最多 ${TB_MAX[k] / 2} 个汉字（或 ${TB_MAX[k]} 个字母）。`, `That is as long as it goes: up to ${TB_MAX[k]} letters (Chinese characters count double).`);
  for (const [id, k, zh] of FIELDS) {
    const el = $(id);
    const clamp = () => { if (textWidth(el.value) > TB_MAX[k]) { el.value = clipWidth(el.value, TB_MAX[k]); msg.textContent = fullNote(k, zh); } };
    el.addEventListener('input', (e) => { if (!e.isComposing) clamp(); });
    el.addEventListener('compositionend', clamp);
  }

  // ---------- v55 社交账号一栏：先选平台再填用户名；贴进主页链接也认得出来 ----------
  const selSns = $('tbSns'), inHandle = $('tbHandle');
  function langSns() { // 下拉框的选项和输入框的提示跟着语言、平台变
    for (const o of selSns.options) o.textContent = o.value ? t(SNS[o.value].zh, SNS[o.value].en) : t('选平台', 'Platform');
    const s = SNS[selSns.value];
    inHandle.placeholder = s ? t(...s.ph) : t('用户名，或贴上主页链接', 'Username, or paste your profile link');
  }
  const linkErr = (r) => (r.err === 'xhs' ? t('小红书的短链接认不出来：请填小红书号，或在浏览器里打开主页，复制 xiaohongshu.com/user/profile/… 那条链接。', 'Short xhslink.com links cannot be read: enter your RED ID, or open your profile in a browser and copy the xiaohongshu.com/user/profile/… link.')
    : t('这条链接认不出来：只填用户名就好（支持微博、小红书、X、Instagram、GitHub）。', 'That link is not one we can read: just enter the username (Weibo, Xiaohongshu, X, Instagram or GitHub).'));
  function readLink() { // 输入框里是链接：换成平台 + 用户名
    const r = fromLink(cleanHandle(inHandle.value));
    if (!r) return true;
    if (r.err) { msg.textContent = linkErr(r); return false; }
    selSns.value = r.sns; inHandle.value = r.handle; langSns();
    msg.textContent = t(`已从链接里认出账号：${SNS[r.sns].zh} ${handleShown(r)}`, `Account read from the link: ${SNS[r.sns].en} ${handleShown(r)}`);
    return true;
  }
  selSns.addEventListener('change', () => { langSns(); if (selSns.value && !inHandle.value) inHandle.focus(); });
  inHandle.addEventListener('change', readLink);
  inHandle.addEventListener('paste', () => setTimeout(readLink, 0));
  langSns();

  onLang(() => { msg.textContent = ''; hideCard(); langSns(); if (offline) showOffline(); else render(); }); // v52 切换语言时重画列表

  form.addEventListener('submit', async (e) => {
    e.preventDefault(); if (!API) return;
    const name = tidy($('tbName').value), place = tidy($('tbPlace').value), m = tidy($('tbText').value);
    if (!name) { msg.textContent = t('先写下名字。', 'Write your name first.'); return; }
    for (const [, k, zh] of FIELDS) if (textWidth({ name, place, msg: m }[k]) > TB_MAX[k]) { msg.textContent = fullNote(k, zh); return; }
    if (!readLink()) return;
    const handle = cleanHandle(inHandle.value), sns = handle ? selSns.value : '';
    if (handle && !sns) { msg.textContent = t('先选是哪个平台的账号。', 'Pick which platform the account is on.'); selSns.focus(); return; }
    if (handle && !SNS[sns].ok(handle)) { msg.textContent = t(`${SNS[sns].zh}账号的格式不对：${SNS[sns].rule[0]}。`, `That does not look like a ${SNS[sns].en} account: ${SNS[sns].rule[1]}.`); inHandle.focus(); return; }
    let last = 0; try { last = +localStorage.getItem('yydt-tibi') || 0; } catch (err) {}
    if (Date.now() - last < 60000) { msg.textContent = t('刚题过了，歇一会儿再来。', 'You have only just signed. Rest a moment before signing again.'); return; }
    msg.textContent = t('正在刻…', 'Carving…'); form.querySelector('button').disabled = true;
    try {
      const j = await postName({ name, place, msg: m, sns, handle, hp: $('tbHp').value, t: Date.now() - openedAt });
      try { localStorage.setItem('yydt-tibi', String(Date.now())); } catch (err) {}
      msg.textContent = j.pending
        ? (handle ? t('题名已收到。带账号的题名要等主人过目，通过后就刻上石壁。', 'Received. Entries with an account are carved once the host has looked them over.')
          : t('题名已收到，主人过目后就刻上石壁。', 'Received. Your name will be carved once the host has looked it over.'))
        : t(`已刻在玉女潭边的石屏上：${name}${place ? ' 自' + place + '来游' : ' 到此一游'}。`, `Carved on the stone screen by the Jade Maiden Pool: “${name}${place ? ', from ' + place : ' was here'}”.`);
      form.reset(); langSns();
      if (j.item) { items = [j.item, ...(items || [])]; render(); onWallItems(items); } else refresh(true);
    } catch (err) { msg.textContent = err.message; }
    finally { form.querySelector('button').disabled = false; }
  });
  // 一开场就把题名取回来，刻到 3D 石壁上（取不到就算了）
  if (API) setTimeout(() => refresh(), 4000);
  else render();
  return { openBa, openWall, close, isOpen: () => !ba.hidden || !tb.hidden };
}
