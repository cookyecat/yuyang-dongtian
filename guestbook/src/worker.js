// 玉阳洞天 · 题名壁后端（Cloudflare Worker + D1）
//   GET  /api/names?limit=80          最近的题名（不含隐藏的）
//   POST /api/names                   题名 {name, place, msg, sns, handle, hp, t}
//   GET  /admin                       管理页（要 ADMIN_TOKEN）：审核带账号的题名、隐藏、删除
//   GET  /api/admin/list              全部题名（待审的排在最前），要 Authorization: Bearer <ADMIN_TOKEN>
//   POST /api/admin/approve {id}      通过（连账号一起上墙）
//   POST /api/admin/dropsns {id}      去掉账号：待审的就只把名字刻上墙，已上墙的把账号撤掉
//   POST /api/admin/hide {id, hidden} 隐藏 / 显示
//   POST /api/admin/delete {id}       删除
//
// hidden：0 = 在墙上，1 = 被你隐藏，2 = 待审（v55 起：带社交账号的题名，或 MODERATE=1 时的全部新题名）
import { BANNED } from './words.js';

// 字数按字宽算（v54）：汉字、假名、谚文、全角符号、表情算 2，西文字母、数字、空格、半角标点算 1。
// 中文上限照旧（名字 12、来自 10、留言 20 个汉字），英文可写 24、20、40 个字母。前端 js/credit.js 是同一套算法，两边改要一起改
const MAX = { name: 24, place: 20, msg: 40 };
const MIN_FILL_MS = 2500;            // 打开题名框不到 2.5 秒就提交的，多半是脚本
const PER_IP_GAP_MS = 60 * 1000;     // 同一人两次题名至少隔 1 分钟
const PER_IP_DAY = 5;                // 同一人一天最多 5 条
const DAY = 24 * 3600 * 1000;
const PENDING = 2;

// v55 社交账号：只收白名单里的平台和用户名，主页链接由程序按平台的固定格式拼出来，不收网址，所以跳不到陌生网站。
// 带账号的题名先审后上（hidden = 2），你在 /admin 里点「通过」才上墙。前端 js/credit.js 有同一张表（SNS），两边改要一起改。
//   weibo      昵称（汉字、字母、数字、_、-，按字宽 4–30）→ weibo.com/n/昵称；或纯数字 ID → weibo.com/u/ID
//   xhs        小红书主页链接里那串 24 位 ID → xiaohongshu.com/user/profile/ID；或小红书号（没有对应网址，卡片上给号码和「复制」）
//   x          1–15 位字母、数字、_
//   instagram  1–30 位字母、数字、_、.（不以 . 开头结尾，不连写两个 .）
//   github     1–39 位字母、数字、-（不以 - 开头结尾，不连写两个 -）
const XHS_ID = /^[0-9a-f]{24}$/;
const SNS = {
  weibo: { zh: '微博', ok: (h) => /^\d{5,12}$/.test(h) || (/^[\p{Script=Han}A-Za-z0-9_-]+$/u.test(h) && textWidth(h) >= 4 && textWidth(h) <= 30),
    url: (h) => (/^\d+$/.test(h) ? `https://weibo.com/u/${h}` : `https://weibo.com/n/${encodeURIComponent(h)}`) },
  xhs: { zh: '小红书', ok: (h) => XHS_ID.test(h) || /^[A-Za-z0-9_]{5,20}$/.test(h), url: (h) => (XHS_ID.test(h) ? `https://www.xiaohongshu.com/user/profile/${h}` : '') },
  x: { zh: 'X', ok: (h) => /^[A-Za-z0-9_]{1,15}$/.test(h), url: (h) => `https://x.com/${h}` },
  instagram: { zh: 'Instagram', ok: (h) => /^[A-Za-z0-9._]{1,30}$/.test(h) && !/^\.|\.$|\.\./.test(h), url: (h) => `https://www.instagram.com/${h}/` },
  github: { zh: 'GitHub', ok: (h) => h.length <= 39 && /^[A-Za-z0-9](?:-?[A-Za-z0-9])*$/.test(h), url: (h) => `https://github.com/${h}` },
};
const snsUrl = (sns, h) => (SNS[sns] && h && SNS[sns].ok(h) ? SNS[sns].url(h) : '');
// 账号清洗：全角半角统一、去掉控制字符和零宽字符、去掉开头的 @
function handleClean(s) {
  s = String(s ?? '').normalize('NFKC').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, '').trim().replace(/^@+/, '');
  return s.length > 60 ? null : s;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url), origin = req.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
    const okOrigin = allowed.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
    const cors = {
      'Access-Control-Allow-Origin': okOrigin ? origin : allowed[0] || '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    };
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    try {
      if (url.pathname === '/api/names' && req.method === 'GET') return await list(url, env, cors);
      if (url.pathname === '/api/names' && req.method === 'POST') {
        if (!okOrigin) return json({ error: '只能在游园页面里题名' }, 403, cors);
        return await create(req, env, cors);
      }
      if (url.pathname === '/admin') return new Response(ADMIN_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
      if (url.pathname.startsWith('/api/admin/')) return await admin(req, url, env);
      if (url.pathname === '/') return new Response('yuyang-guestbook ok', { headers: cors });
      return json({ error: 'not found' }, 404, cors);
    } catch (e) {
      console.error(e);
      return json({ error: '石壁一时刻不上，稍后再试' }, 500, cors);
    }
  },
};

function json(obj, status = 200, headers = {}, extra = {}) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers, ...extra } });
}

async function list(url, env, cors) {
  const limit = Math.max(1, Math.min(200, parseInt(url.searchParams.get('limit') || '80', 10) || 80));
  const { results } = await env.DB.prepare('SELECT id, name, place, msg, sns, handle, ts FROM names WHERE hidden = 0 ORDER BY id DESC LIMIT ?').bind(limit).all();
  const total = (await env.DB.prepare('SELECT COUNT(*) AS n FROM names WHERE hidden = 0').first()).n;
  return json({ items: results, total }, 200, cors, { 'Cache-Control': 'public, max-age=20' });
}

// 清洗：统一全角半角、去掉控制字符和零宽字符、合并空白
function clean(s, max) {
  s = String(s ?? '').normalize('NFKC').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, '').replace(/\s+/g, ' ').trim();
  return textWidth(s) > max ? null : s;
}
const wideCp = (c) => (c >= 0x1100 && c <= 0x115f) || (c >= 0x2e80 && c <= 0xa4cf) || (c >= 0xac00 && c <= 0xd7a3) || (c >= 0xf900 && c <= 0xfaff)
  || (c >= 0xfe30 && c <= 0xfe4f) || (c >= 0xff00 && c <= 0xff60) || (c >= 0xffe0 && c <= 0xffe6) || c >= 0x1f000;
function textWidth(s) { let n = 0; for (const ch of s) n += wideCp(ch.codePointAt(0)) ? 2 : 1; return n; }
// 比对用：小写、去掉一切空白、标点和符号
const squash = (s) => s.toLowerCase().replace(/[\s\p{P}\p{S}_]/gu, '');
const ASCII_WORD = /^[a-z0-9]+$/;
function badWord(text) {
  const sq = squash(text), lower = ' ' + text.toLowerCase().replace(/[^a-z0-9]+/g, ' ') + ' ';
  for (const w of BANNED) {
    const k = squash(w); if (!k) continue;
    if (ASCII_WORD.test(k) ? lower.includes(' ' + k + ' ') : sq.includes(k)) return true; // 西文按整词比，免得误伤 Elizabeth 之类
  }
  return false;
}
// 联系方式、网址
function looksLikeContact(text) {
  return /(https?:|www\.|\.(com|cn|net|org|io|xyz|top|me|cc)\b|@[a-z0-9_]{2,}|\d{5,}|微信|wechat|whatsapp|\bline\s*id\b)/i.test(text);
}
async function sha(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

async function create(req, env, cors) {
  const raw = await req.text();
  if (raw.length > 2000) return json({ error: '写得太长了' }, 413, cors);
  let b; try { b = JSON.parse(raw); } catch { return json({ error: '看不懂这条题名' }, 400, cors); }
  if (b.hp) return json({ ok: true }, 200, cors); // 蜜罐：人看不见的那一栏被填了，是脚本，假装成功
  if (typeof b.t === 'number' && b.t < MIN_FILL_MS) return json({ error: '慢一点，从容落笔' }, 429, cors);
  const name = clean(b.name, MAX.name), place = clean(b.place, MAX.place), msg = clean(b.msg, MAX.msg);
  if (name === null || place === null || msg === null) return json({ error: `名字最多 ${MAX.name / 2} 个汉字（或 ${MAX.name} 个字母），来自最多 ${MAX.place / 2} 个汉字（或 ${MAX.place} 个字母），留言最多 ${MAX.msg / 2} 个汉字（或 ${MAX.msg} 个字母）` }, 400, cors);
  if (!name) return json({ error: '先写下名字' }, 400, cors);
  const all = `${name} ${place} ${msg}`;
  if (looksLikeContact(all)) return json({ error: '名字和留言里不留网址、电话；想让人找到你，请填社交账号一栏' }, 400, cors);
  if (badWord(all)) return json({ error: '这几个字不宜刻上石壁，换个说法吧' }, 400, cors);
  // 社交账号（可不填）：平台必须在白名单里，用户名必须合平台的格式
  const handle = handleClean(b.handle);
  let sns = typeof b.sns === 'string' ? b.sns : '';
  if (handle === null) return json({ error: '账号太长了' }, 400, cors);
  if (!handle) sns = '';
  else if (!sns) return json({ error: '先选是哪个平台的账号' }, 400, cors);
  else if (!Object.hasOwn(SNS, sns)) return json({ error: '这个平台还不支持' }, 400, cors);
  else if (!SNS[sns].ok(handle)) return json({ error: `${SNS[sns].zh}账号的格式不对` }, 400, cors);
  else if (badWord(handle)) return json({ error: '这几个字不宜刻上石壁，换个说法吧' }, 400, cors);

  const now = Date.now();
  const ip = req.headers.get('CF-Connecting-IP') || 'local';
  const iphash = await sha((env.IP_SALT || 'yuyang') + '|' + ip);
  const mine = await env.DB.prepare('SELECT MAX(ts) AS last, COUNT(*) AS n FROM names WHERE iphash = ? AND ts > ?').bind(iphash, now - DAY).first();
  if (mine.last && now - mine.last < PER_IP_GAP_MS) return json({ error: '刚题过了，歇一会儿再来' }, 429, cors);
  if (mine.n >= PER_IP_DAY) return json({ error: '今天题得够多了，明天再来' }, 429, cors);
  const day = await env.DB.prepare('SELECT COUNT(*) AS n FROM names WHERE ts > ?').bind(now - DAY).first();
  if (day.n >= (parseInt(env.DAILY_CAP || '500', 10) || 500)) return json({ error: '今天石壁已经题满了，明天再来' }, 429, cors);
  const dup = await env.DB.prepare('SELECT id FROM names WHERE name = ? AND place = ? AND msg = ? AND ts > ? LIMIT 1').bind(name, place, msg, now - 7 * DAY).first();
  if (dup) return json({ error: '这一条已经刻在壁上了' }, 409, cors);

  // 带账号的先审后上；MODERATE=1 时全部先审
  const hidden = handle || env.MODERATE === '1' ? PENDING : 0;
  const r = await env.DB.prepare('INSERT INTO names (name, place, msg, sns, handle, ts, iphash, hidden) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').bind(name, place, msg, sns, handle, now, iphash, hidden).run();
  const item = { id: r.meta.last_row_id, name, place, msg, sns, handle, ts: now };
  return json(hidden ? { ok: true, pending: true, review: handle ? 'sns' : 'all' } : { ok: true, item }, 200, cors);
}

function authed(req, env) {
  const got = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, ''), want = env.ADMIN_TOKEN || '';
  if (!want || got.length !== want.length) return false;
  let d = 0; for (let i = 0; i < want.length; i++) d |= got.charCodeAt(i) ^ want.charCodeAt(i);
  return d === 0;
}
async function admin(req, url, env) {
  const h = { 'Cache-Control': 'no-store' };
  if (!authed(req, env)) return json({ error: '口令不对' }, 401, h);
  if (url.pathname === '/api/admin/list') {
    const { results } = await env.DB.prepare('SELECT id, name, place, msg, sns, handle, ts, iphash, hidden FROM names ORDER BY hidden = 2 DESC, id DESC LIMIT 500').all();
    for (const it of results) it.url = snsUrl(it.sns, it.handle);
    const pending = (await env.DB.prepare('SELECT COUNT(*) AS n FROM names WHERE hidden = 2').first()).n;
    return json({ items: results, pending }, 200, h);
  }
  if (req.method !== 'POST') return json({ error: 'POST?' }, 405, h);
  const b = await req.json().catch(() => ({}));
  const id = parseInt(b.id, 10); if (!id) return json({ error: 'id?' }, 400, h);
  if (url.pathname === '/api/admin/approve') { await env.DB.prepare('UPDATE names SET hidden = 0 WHERE id = ?').bind(id).run(); return json({ ok: true }, 200, h); }
  if (url.pathname === '/api/admin/dropsns') { await env.DB.prepare("UPDATE names SET sns = '', handle = '', hidden = CASE WHEN hidden = 2 THEN 0 ELSE hidden END WHERE id = ?").bind(id).run(); return json({ ok: true }, 200, h); }
  if (url.pathname === '/api/admin/hide') { await env.DB.prepare('UPDATE names SET hidden = ? WHERE id = ?').bind(b.hidden ? 1 : 0, id).run(); return json({ ok: true }, 200, h); }
  if (url.pathname === '/api/admin/delete') { await env.DB.prepare('DELETE FROM names WHERE id = ?').bind(id).run(); return json({ ok: true }, 200, h); }
  return json({ error: 'not found' }, 404, h);
}

const ADMIN_HTML = `<!doctype html><html lang="zh-Hans"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>题名壁 · 管理</title>
<style>body{font:15px/1.6 system-ui,sans-serif;max-width:900px;margin:24px auto;padding:0 16px;background:#f4efe2;color:#2a2620}
input,button{font:inherit;padding:6px 10px}button{cursor:pointer;margin:2px 0}table{width:100%;border-collapse:collapse;margin-top:12px}
td,th{border-bottom:1px solid #d8cfb8;padding:7px 4px;text-align:left;vertical-align:top}tr.h td{opacity:.45}tr.p td{background:#fbe9c6}
small{color:#7a6f5c}a{color:#8f2f1f}.tag{display:inline-block;font-size:12px;padding:0 6px;border-radius:3px;background:#b23a26;color:#fff}
.ok{background:#2f5e45;color:#fff;border:0;border-radius:3px}.sum{margin:10px 0 0}.sum b{color:#b23a26}</style>
<h1>题名壁 · 管理</h1>
<p><input id="tk" type="password" placeholder="ADMIN_TOKEN" size="34"> <button id="go">读取</button> <small>口令只存在这台电脑的浏览器里</small></p>
<p><small>带社交账号的题名先放在「待审」（淡黄底，排在最前）。点账号链接看一眼对方主页：没问题就「通过」，名字连账号一起上墙；账号不妥但名字可以，点「只刻名字」；都不行就「删除」。</small></p>
<div id="out"></div>
<script>
const tk=document.getElementById('tk');tk.value=localStorage.getItem('gbtk')||'';
const api=(p,b)=>fetch(p,{method:b?'POST':'GET',headers:{Authorization:'Bearer '+tk.value,'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined}).then(r=>r.json());
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const SNS={weibo:'微博',xhs:'小红书',x:'X',instagram:'Instagram',github:'GitHub'};
const btn=(a,id,label,extra)=>'<button data-a="'+a+'" data-id="'+id+'"'+(extra||'')+'>'+label+'</button> ';
function acct(it){if(!it.handle)return '<small>—</small>';const t=esc((SNS[it.sns]||it.sns)+' '+(it.sns==='weibo'||it.sns==='xhs'?'':'@')+it.handle);
return it.url?'<a href="'+esc(it.url)+'" target="_blank" rel="noopener noreferrer">'+t+' ↗</a>':t+'<br><small>小红书号，没有网址，到小红书里搜</small>';}
function acts(it){if(it.hidden===2)return btn('approve',it.id,'通过',' class="ok"')+(it.handle?btn('dropsns',it.id,'只刻名字'):'')+btn('delete',it.id,'删除');
return btn('hide',it.id,it.hidden?'显示':'隐藏',' data-h="'+(it.hidden?0:1)+'"')+(it.handle&&!it.hidden?btn('dropsns',it.id,'去掉账号'):'')+btn('delete',it.id,'删除');}
async function load(){localStorage.setItem('gbtk',tk.value);const j=await api('/api/admin/list');const o=document.getElementById('out');
if(j.error){o.textContent=j.error;return;}
const shown=j.items.filter(it=>it.hidden===0).length,hid=j.items.filter(it=>it.hidden===1).length;
o.innerHTML='<p class="sum">'+(j.pending?'<b>待审 '+j.pending+' 条</b> · ':'没有待审的 · ')+'墙上 '+shown+' 条 · 隐藏 '+hid+' 条</p><table><tr><th>#</th><th>名字 / 来自 / 留言</th><th>账号</th><th>时间</th><th></th></tr>'+j.items.map(it=>'<tr class="'+(it.hidden===2?'p':it.hidden?'h':'')+'"><td>'+it.id+(it.hidden===2?'<br><span class="tag">待审</span>':'')+'</td><td><b>'+esc(it.name)+'</b>'+(it.place?'<br>自 '+esc(it.place):'')+(it.msg?'<br><small>'+esc(it.msg)+'</small>':'')+'</td><td>'+acct(it)+'</td><td><small>'+new Date(it.ts).toLocaleString()+'<br>'+esc(it.iphash.slice(0,8))+'</small></td><td>'+acts(it)+'</td></tr>').join('')+'</table>';
o.querySelectorAll('button').forEach(b=>b.onclick=async()=>{if(b.dataset.a==='delete'&&!confirm('删除 #'+b.dataset.id+'？删了就找不回来'))return;const r=await api('/api/admin/'+b.dataset.a,{id:+b.dataset.id,hidden:+b.dataset.h});if(r.error)alert(r.error);load();});}
document.getElementById('go').onclick=load;if(tk.value)load();
</script></html>`;
