// 中英文切换。
// 选哪种语言在 index.html <head> 里那段小脚本先定好（链接 ?lang=en|zh > 自己点选过的 > 浏览器语言：偏好里有中文就中文，否则英文），
// 写在 <html data-lang>，这样页面一出来就是对的语言，不闪。这里读它，并管切换。
// 静态文案：index.html 里中英两份并排，class="zh" / class="en"，CSS 按 data-lang 只显示一份；
// title / aria-label / placeholder / alt 这几个属性另写 data-en-title 之类，切换时换过去。
// 动态文案（提示、卡片、台词、时辰……）用 t(中文, 英文)；切换时 onLang 里登记的函数重画一遍。
import { PEOPLE as PEOPLE_EN } from './lang_en.js';

const KEY = 'yydt-lang';
const root = document.documentElement;
let cur = root.dataset.lang === 'en' ? 'en' : 'zh';
export const lang = () => cur;
export const isEn = () => cur === 'en';
export const t = (zh, en) => (cur === 'en' && en != null ? en : zh);

const TITLE = { zh: '玉阳洞天游园', en: 'Yuyang Dongtian Garden Walk' };
const ATTRS = ['title', 'aria-label', 'placeholder', 'alt'];
function applyAttrs() {
  for (const a of ATTRS) for (const el of document.querySelectorAll(`[data-en-${a}]`)) {
    if (!el.hasAttribute(`data-zh-${a}`)) el.setAttribute(`data-zh-${a}`, el.getAttribute(a) || '');
    el.setAttribute(a, el.getAttribute(`data-${cur}-${a}`));
  }
  for (const b of document.querySelectorAll('[data-set-lang]')) b.setAttribute('aria-pressed', String(b.dataset.setLang === cur));
}
function applyRoot() { root.dataset.lang = cur; root.lang = cur === 'en' ? 'en' : 'zh-Hans'; document.title = TITLE[cur]; }

const subs = [];
export const onLang = (fn) => subs.push(fn);
export function setLang(l) {
  l = l === 'en' ? 'en' : 'zh';
  try { localStorage.setItem(KEY, l); } catch (e) {}
  try { // 地址栏里带着 ?lang= 的话一起改，免得复制出去的链接和眼前的不一样
    const u = new URL(location.href);
    if (u.searchParams.has('lang')) { u.searchParams.set('lang', l); history.replaceState(history.state, '', u); }
  } catch (e) {}
  if (l === cur) return;
  cur = l; applyRoot(); applyAttrs();
  for (const f of subs) { try { f(l); } catch (e) { console.error(e); } }
}
// 页面上所有 data-set-lang 按钮：点了切到那种语言；data-set-lang="toggle" 在两种之间来回切
export function bindLangButtons() {
  for (const b of document.querySelectorAll('[data-set-lang]')) {
    b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); setLang(b.dataset.setLang === 'toggle' ? (cur === 'en' ? 'zh' : 'en') : b.dataset.setLang); b.blur(); });
  }
}
applyRoot(); applyAttrs();

// 人物的名字、卡片、台词：英文界面取 lang_en.js（或人物定义里自带的 def.en），没有就用中文
const enOf = (def) => def.en || PEOPLE_EN[def.id];
export const nameOf = (def) => (cur === 'en' && enOf(def)?.name) || def.name;
export const linesOf = (def) => (cur === 'en' && enOf(def)?.lines) || def.lines;
export const cardOf = (def) => (cur === 'en' && enOf(def)?.card ? { ...def.card, ...enOf(def).card } : def.card);
