// 玉阳洞天 · 题名壁后端（Cloudflare Worker + D1）
//   GET  /api/names?limit=80          最近的题名（不含隐藏的）
//   POST /api/names                   题名 {name, place, msg, hp, t}
//   GET  /admin                       管理页（要 ADMIN_TOKEN）
//   GET  /api/admin/list              全部题名（含隐藏），要 Authorization: Bearer <ADMIN_TOKEN>
//   POST /api/admin/hide {id, hidden} 隐藏 / 显示
//   POST /api/admin/delete {id}       删除
import { BANNED } from './words.js';

const MAX = { name: 12, place: 10, msg: 20 };
const MIN_FILL_MS = 2500;            // 打开题名框不到 2.5 秒就提交的，多半是脚本
const PER_IP_GAP_MS = 60 * 1000;     // 同一人两次题名至少隔 1 分钟
const PER_IP_DAY = 5;                // 同一人一天最多 5 条
const DAY = 24 * 3600 * 1000;

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
  const { results } = await env.DB.prepare('SELECT id, name, place, msg, ts FROM names WHERE hidden = 0 ORDER BY id DESC LIMIT ?').bind(limit).all();
  const total = (await env.DB.prepare('SELECT COUNT(*) AS n FROM names WHERE hidden = 0').first()).n;
  return json({ items: results, total }, 200, cors, { 'Cache-Control': 'public, max-age=20' });
}

// 清洗：统一全角半角、去掉控制字符和零宽字符、合并空白
function clean(s, max) {
  s = String(s ?? '').normalize('NFKC').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, '').replace(/\s+/g, ' ').trim();
  return [...s].length > max ? null : s;
}
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
  return /(https?:|www\.|\.(com|cn|net|org|io|xyz|top|me|cc)\b|@[a-z0-9_]{2,}|\d{5,}|微信|wechat|whatsapp|line\s*id)/i.test(text);
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
  if (name === null || place === null || msg === null) return json({ error: `名字最多 ${MAX.name} 字，来自最多 ${MAX.place} 字，留言最多 ${MAX.msg} 字` }, 400, cors);
  if (!name) return json({ error: '先写下名字' }, 400, cors);
  const all = `${name} ${place} ${msg}`;
  if (looksLikeContact(all)) return json({ error: '石壁上不留网址、电话和账号' }, 400, cors);
  if (badWord(all)) return json({ error: '这几个字不宜刻上石壁，换个说法吧' }, 400, cors);

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

  const hidden = env.MODERATE === '1' ? 1 : 0;
  const r = await env.DB.prepare('INSERT INTO names (name, place, msg, ts, iphash, hidden) VALUES (?, ?, ?, ?, ?, ?)').bind(name, place, msg, now, iphash, hidden).run();
  const item = { id: r.meta.last_row_id, name, place, msg, ts: now };
  return json(hidden ? { ok: true, pending: true } : { ok: true, item }, 200, cors);
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
    const { results } = await env.DB.prepare('SELECT id, name, place, msg, ts, iphash, hidden FROM names ORDER BY id DESC LIMIT 500').all();
    return json({ items: results }, 200, h);
  }
  const b = await req.json().catch(() => ({}));
  const id = parseInt(b.id, 10); if (!id) return json({ error: 'id?' }, 400, h);
  if (url.pathname === '/api/admin/hide') { await env.DB.prepare('UPDATE names SET hidden = ? WHERE id = ?').bind(b.hidden ? 1 : 0, id).run(); return json({ ok: true }, 200, h); }
  if (url.pathname === '/api/admin/delete') { await env.DB.prepare('DELETE FROM names WHERE id = ?').bind(id).run(); return json({ ok: true }, 200, h); }
  return json({ error: 'not found' }, 404, h);
}

const ADMIN_HTML = `<!doctype html><html lang="zh-Hans"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>题名壁 · 管理</title>
<style>body{font:15px/1.6 system-ui,sans-serif;max-width:860px;margin:24px auto;padding:0 16px;background:#f4efe2;color:#2a2620}
input,button{font:inherit;padding:6px 10px}button{cursor:pointer}table{width:100%;border-collapse:collapse;margin-top:16px}
td,th{border-bottom:1px solid #d8cfb8;padding:6px 4px;text-align:left;vertical-align:top}tr.h td{opacity:.45}small{color:#7a6f5c}</style>
<h1>题名壁 · 管理</h1>
<p><input id="tk" type="password" placeholder="ADMIN_TOKEN" size="34"> <button id="go">读取</button> <small>口令只存在这台电脑的浏览器里</small></p>
<div id="out"></div>
<script>
const tk=document.getElementById('tk');tk.value=localStorage.getItem('gbtk')||'';
const api=(p,b)=>fetch(p,{method:b?'POST':'GET',headers:{Authorization:'Bearer '+tk.value,'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined}).then(r=>r.json());
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
async function load(){localStorage.setItem('gbtk',tk.value);const j=await api('/api/admin/list');const o=document.getElementById('out');
if(j.error){o.textContent=j.error;return;}
o.innerHTML='<p>共 '+j.items.length+' 条（灰色是隐藏的）</p><table><tr><th>#</th><th>名字</th><th>来自</th><th>留言</th><th>时间</th><th></th></tr>'+j.items.map(it=>'<tr class="'+(it.hidden?'h':'')+'"><td>'+it.id+'</td><td>'+esc(it.name)+'</td><td>'+esc(it.place)+'</td><td>'+esc(it.msg)+'</td><td><small>'+new Date(it.ts).toLocaleString()+'<br>'+it.iphash.slice(0,8)+'</small></td><td><button data-a="hide" data-id="'+it.id+'" data-h="'+(it.hidden?0:1)+'">'+(it.hidden?'显示':'隐藏')+'</button> <button data-a="delete" data-id="'+it.id+'">删除</button></td></tr>').join('')+'</table>';
o.querySelectorAll('button').forEach(b=>b.onclick=async()=>{if(b.dataset.a==='delete'&&!confirm('删除 #'+b.dataset.id+'？删了就找不回来'))return;await api('/api/admin/'+b.dataset.a,{id:+b.dataset.id,hidden:+b.dataset.h});load();});}
document.getElementById('go').onclick=load;if(tk.value)load();
</script></html>`;
