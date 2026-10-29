import { h, media, typeZh, catalogEntry, checkName } from '../util.js';
import { refBar } from '../charts.js';
import { figure, figureSpec } from '../figure.js';

export const STATUS_ZH = { good: '达标', warn: '待改进', na: '看不清', info: '' };

export const strokeKeys = (k) => (k?.type === 'backhand' && (k.hands === 'one' || k.hands === 'two') ? ['backhand', k.hands === 'one' ? 'backhand1' : 'backhand2'] : [k?.type]);

export const isLeft = (s) => s?.settings?.handedness === 'left';

export const swap = (t, left) => (left && typeof t === 'string' ? t.replace(/[左右]/g, (x) => (x === '左' ? '右' : '左')) : t);

export const nb = (t) => (typeof t === 'string' ? t.replace(/(\d) (?=[a-zA-Z°%])/g, '$1\u00a0') : t);

export function stdOf(cat, id, keys, left) {
  const def = catalogEntry(cat, id);
  if (!def?.std) return null;
  const alt = [...keys].reverse().map((x) => def.std_alt?.[x]).find(Boolean);
  const st = { ...def.std, ...alt };
  const t = (x) => nb(swap(x, left));
  return {
    ...st,
    standard: t(st.standard),
    why: t(st.why),
    self_check: t(st.self_check),
    steps: (st.steps || []).map(t),
    drills: (st.drills || []).map((d) => ({ name: t(d.name), how: t(d.how), dose: t(d.dose) })),
  };
}

export const fixOf = (k, id) => k?.media?.fix?.[id] || k?.media?.thumb;

function bestOther(s, k, id) {
  const key = strokeKeys(k).slice(-1)[0];
  let best = null;
  for (const x of s.strokes || []) {
    if (x.id === k.id || strokeKeys(x).slice(-1)[0] !== key) continue;
    const c = (x.checks || []).find((y) => y.id === id);
    if (c?.status !== 'good' || !x.media?.thumb) continue;
    const [lo, hi] = Array.isArray(c.ref) && typeof c.value === 'number' ? c.ref : [null, null];
    const d = lo == null && hi == null ? -1 : Math.min(lo == null ? Infinity : c.value - lo, hi == null ? Infinity : hi - c.value);
    if (!best || d > best.d || (d === best.d && c.confidence > best.c.confidence)) best = { x, c, d };
  }
  return best?.x || null;
}

export function openCheck({ s, k, id, cat, onClose }) {
  const c = (k.checks || []).find((x) => x.id === id) || { id, status: 'na' };
  const def = catalogEntry(cat, id) || {};
  const left = isLeft(s);
  const keys = strokeKeys(k);
  const st = stdOf(cat, id, keys, left);
  const cue = swap([...keys].reverse().map((x) => def.cue_alt?.[x]).find(Boolean) || def.cue, left);
  const sid = s.id;
  const view = s.summary?.view && s.summary.view !== 'unknown' ? s.summary.view : 'back_high';
  const block = (title, ...kids) => (kids.flat().some(Boolean) ? h('div', { class: 'ck-sec' }, h('h3', {}, title), kids) : null);

  const you = nb(c.status === 'na' ? c.reason || '看不清' : c.display || '');
  const cmp = you || st?.standard ? h('div', { class: 'ck-cmp' },
    you ? h('div', { class: 'r' }, h('span', { class: 'k' }, '你'), h('span', { class: 'v' }, you)) : null,
    st?.standard ? h('div', { class: 'r' }, h('span', { class: 'k' }, '标准'), h('span', { class: 'v std' }, st.standard)) : null) : null;

  const sec = def.unit === 'ms' && !/ms/.test(`${c.display || ''}${st?.standard || ''}`);
  const bar = typeof c.value === 'number' && Array.isArray(c.ref) && c.ref.some((x) => typeof x === 'number')
    ? refBar(sec ? { value: c.value / 1000, ref: c.ref.map((x) => (x == null ? x : x / 1000)), unit: 's', status: c.status } : { value: c.value, ref: c.ref, unit: def.unit || '', status: c.status }) : null;

  const shot = media(sid, fixOf(k, id));
  const svg = figure({ catalog: cat, check: id, strokeKeys: keys, view, hand: left ? 'left' : 'right', size: 320 });
  const cap = swap(figureSpec(cat, id, keys)?.caption, left);
  const zoom = () => document.body.append(zoomed = h('div', { class: 'ck-zoom', onclick: () => zoomed.remove() }, h('img', { src: shot, alt: '' })));
  const pics = shot || svg ? h('div', { class: 'ck-pics' },
    shot ? h('figure', {}, h('figcaption', {}, '你'), h('button', { class: 'ck-pic', 'aria-label': '放大', onclick: zoom }, h('img', { src: shot, alt: '' }))) : null,
    svg ? h('figure', {}, h('figcaption', {}, '标准'), h('div', { class: 'ck-pic fig' }, h('div', { class: 'sv' }, svg), cap ? h('div', { class: 'cap' }, cap.replace(/[，、]/g, '$&\n').split('\n').map((x) => h('span', {}, x))) : null)) : null) : null;

  const other = bestOther(s, k, id);
  const go = other ? `#/s/${encodeURIComponent(sid)}/k/${other.id}?c=${encodeURIComponent(id)}` : null;
  const sources = [...new Set([...(st?.sources || []), ...(def.sources || [])])];

  const body = h('div', { class: 'ck-body' },
    cmp, bar, pics,
    block('怎么改', cue ? h('div', { class: 'ck-cue' }, cue) : null, st?.steps?.length ? h('ol', { class: 'ck-steps' }, st.steps.map((x) => h('li', {}, x))) : null),
    block('练习', (st?.drills || []).map((d) => h('div', { class: 'ck-drill' }, h('div', {}, h('b', {}, d.name), d.dose ? h('span', { class: 'dose' }, d.dose) : null), d.how ? h('div', { class: 'how' }, d.how) : null))),
    block('自查', st?.self_check ? h('p', {}, st.self_check) : null),
    block('为什么', st?.why ? h('p', {}, st.why) : null),
    block('对照', other ? h('a', { class: 'ck-good chev', href: go },
      h('img', { src: media(sid, other.media.thumb), alt: '', loading: 'lazy' }),
      h('span', { class: 'grow' }, `做得好的一拍 #${other.id}`)) : null),
    sources.length ? h('details', { class: 'ck-src' }, h('summary', {}, '依据'), h('ul', {}, sources.map((x) => h('li', {}, x)))) : null);

  let zoomed = null;
  let done = false;
  const close = (nav) => {
    if (done) return;
    done = true;
    zoomed?.remove();
    removeEventListener('keydown', onKey);
    removeEventListener('hashchange', onNav);
    document.documentElement.classList.remove('ck-lock');
    wrap.classList.remove('on');
    setTimeout(() => wrap.remove(), 260);
    if (!nav) onClose?.();
  };
  const onNav = () => close(true);
  const onKey = (e) => {
    if (e.key !== 'Escape') return;
    if (zoomed?.isConnected) zoomed.remove();
    else close();
  };
  const pill = STATUS_ZH[c.status] ? h('span', { class: 'pill ck-st' }, h('i', { class: `dot s-${c.status}` }), STATUS_ZH[c.status]) : null;
  const head = h('div', { class: 'ck-head' },
    h('div', { class: 'ck-grab' }),
    h('div', { class: 'ck-title' },
      h('div', { class: 'grow' }, h('div', { class: 'nm' }, checkName(cat, id), pill), h('div', { class: 'sub' }, `#${k.id} ${typeZh(k.type)}`)),
      h('button', { class: 'ck-x', 'aria-label': '关闭', onclick: () => close() })));
  const sheet = h('div', { class: 'ck-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': checkName(cat, id) }, head, body);
  const wrap = h('div', { class: 'ck-wrap', onclick: (e) => e.target === wrap && close() }, sheet);

  let y0 = null;
  let dy = 0;
  head.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button') || matchMedia('(min-width: 900px)').matches) return;
    y0 = e.clientY;
    dy = 0;
    head.setPointerCapture(e.pointerId);
    sheet.style.transition = 'none';
  });
  head.addEventListener('pointermove', (e) => {
    if (y0 == null) return;
    dy = Math.max(0, e.clientY - y0);
    sheet.style.transform = `translateY(${dy}px)`;
  });
  const up = () => {
    if (y0 == null) return;
    y0 = null;
    sheet.style.transition = '';
    sheet.style.transform = dy > 90 ? 'translateY(100%)' : '';
    if (dy > 90) close();
  };
  head.addEventListener('pointerup', up);
  head.addEventListener('pointercancel', up);

  document.body.append(wrap);
  document.documentElement.classList.add('ck-lock');
  requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('on')));
  addEventListener('keydown', onKey);
  addEventListener('hashchange', onNav);
  return { close: () => close(true) };
}
