export const TYPE_ZH = { forehand: '正手', backhand: '反手', backhand1: '单反', backhand2: '双反', serve: '发球', volley: '截击', overhead: '高压', feed: '喂球', groundstroke: '底线球', unknown: '未知' };
export const SPIN_ZH = { topspin: '上旋', slice: '切削', flat: '平击', kick: '上旋', '': '' };
export const PHASE_ZH = {
  ready: '准备', split_step: '分腿垫步', unit_turn: '转体', backswing_end: '引拍', contact: '击球', finish: '随挥', recovery: '还原',
  start: '起始', release: '抛球', trophy: '奖杯姿势', racket_drop: '落拍', landing: '落地', prep: '准备', footwork: '步法',
};
export const PHASE_ORDER = ['ready', 'split_step', 'unit_turn', 'backswing_end', 'start', 'release', 'trophy', 'racket_drop', 'prep', 'contact', 'finish', 'recovery', 'landing', 'footwork'];
export const VIEW_ZH = { back_high: '背面高位', side: '侧面', front: '正面', unknown: '机位未知' };
export const STAGE_ZH = {
  probe: '读取', proxy: '转码', overlay: '识别界面', segments: '切分片段', labels: '读标签', audio: '击球声',
  court: '球场标定', pose: '识别动作', clean: '清洗', hits: '找击球', strokes: '分拍', rackets: '球拍', footwork: '步法',
  evaluate: '评估', render: '生成片段', summary: '总结', ai: 'AI 点评',
};
export const MAIN_TYPES = ['forehand', 'backhand', 'serve'];

export const typeKey = (t) => (MAIN_TYPES.includes(t) ? t : 'other');
export const typeZh = (t) => TYPE_ZH[t] || (t ? '其他' : '');

export function h(tag, attrs, ...kids) {
  const ns = tag.startsWith('svg:') ? 'http://www.w3.org/2000/svg' : null;
  const el = ns ? document.createElementNS(ns, tag.slice(4)) : document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class' && !ns) el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && !ns && k !== 'list' && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
  return el;
}

export const s = (tag, attrs, ...kids) => h('svg:' + tag, attrs, ...kids);

export const SHARE = window.TC_SHARE || null;

function shareUrl(path) {
  const v = SHARE.v ? `?v=${encodeURIComponent(SHARE.v)}` : '';
  if (path === '/api/catalog') return `data/catalog.json${v}`;
  if (path === `/api/sessions/${encodeURIComponent(SHARE.sid)}`) return `data/session.json${v}`;
  return null;
}

export async function api(path, opts = {}) {
  if (SHARE) {
    const u = (opts.method || 'GET') === 'GET' ? shareUrl(path) : null;
    if (!u) throw Object.assign(new Error('404'), { status: 404 });
    path = u;
  }
  const init = { ...opts, headers: { ...(opts.headers || {}) } };
  if (opts.json !== undefined) {
    init.body = JSON.stringify(opts.json);
    init.headers['content-type'] = 'application/json';
    delete init.json;
  }
  const r = await fetch(path, init);
  if (!r.ok) {
    const e = new Error(`${r.status}`);
    e.status = r.status;
    throw e;
  }
  return r.json();
}

export const media = (sid, p) => {
  if (!p) return null;
  const rel = p.split('/').map(encodeURIComponent).join('/');
  return SHARE ? `media/${rel}${SHARE.v ? `?v=${encodeURIComponent(SHARE.v)}` : ''}` : `/media/${encodeURIComponent(sid)}/${rel}`;
};

export function fmtDur(sec) {
  if (sec == null || isNaN(sec)) return '';
  const t = Math.floor(sec);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

export function fmtT(sec) {
  if (sec == null || isNaN(sec)) return '';
  const d = Math.round(sec * 10);
  return `${Math.floor(d / 600)}:${String(Math.floor((d % 600) / 10)).padStart(2, '0')}.${d % 10}`;
}

const WD = '日一二三四五六';
export function fmtDate(iso, withTime = false) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  const base = `${d.getMonth() + 1}月${d.getDate()}日 周${WD[d.getDay()]}`;
  return withTime ? `${base} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : base;
}

export const fmtShortDate = (iso) => {
  const d = new Date(iso);
  return isNaN(d) ? '' : `${d.getMonth() + 1}/${d.getDate()}`;
};

export function quantile(sorted, f) {
  const i = f * (sorted.length - 1);
  const lo = Math.floor(i);
  return sorted[lo] + (sorted[Math.min(lo + 1, sorted.length - 1)] - sorted[lo]) * (i - lo);
}

export const pct = (x) => `${Math.round((x || 0) * 100)}%`;

export function countsLine(counts) {
  const order = ['forehand', 'backhand', 'serve', 'volley', 'overhead', 'feed', 'unknown'];
  return Object.entries(counts || {})
    .filter(([, n]) => n > 0)
    .sort((a, b) => order.indexOf(a[0]) - order.indexOf(b[0]))
    .map(([t, n]) => `${typeZh(t)} ${n}`)
    .join(' · ');
}

export function progressOf(p) {
  if (!p) return { frac: 0, label: '' };
  const frac = p.overall ?? (p.pct != null ? p.pct / 100 : 0);
  return { frac: Math.max(0, Math.min(1, frac)), label: p.stage_zh || STAGE_ZH[p.stage] || '' };
}

let toastTimer;
export function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), 2200);
}

export function tip(e, html) {
  const el = document.getElementById('tip');
  if (!html) {
    el.classList.remove('on');
    return;
  }
  el.innerHTML = html;
  el.classList.add('on');
  const r = el.getBoundingClientRect();
  const x = Math.min(Math.max(8, e.clientX - r.width / 2), innerWidth - r.width - 8);
  const y = e.clientY - r.height - 14 < 8 ? e.clientY + 18 : e.clientY - r.height - 14;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
}

export const esc = (x) => String(x ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function svLine(sv) {
  if (!sv) return '';
  return [SPIN_ZH[sv.spin] ?? sv.spin, sv.volley ? '截击' : '', sv.speed_kmh ? `${Math.round(sv.speed_kmh)} km/h` : '']
    .filter(Boolean)
    .join(' · ');
}

export function checkName(cat, id) {
  const c = catalogEntry(cat, id);
  return c?.name_zh || c?.name || id;
}

export function catalogEntry(cat, id) {
  if (!cat) return null;
  const pool = cat.checks || cat.CHECKS || cat;
  if (Array.isArray(pool)) return pool.find((c) => c.id === id) || null;
  return pool[id] || null;
}

let catalogP = null;
export const catalog = () => (catalogP ||= api('/api/catalog').catch(() => ({})));
