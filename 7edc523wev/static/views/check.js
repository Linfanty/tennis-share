import { h, media, typeZh, catalogEntry, checkName, PHASE_ZH } from '../util.js';
import { refBar } from '../charts.js';
import * as F from '../figure.js';

export const STATUS_ZH = { good: '达标', warn: '待改进', na: '看不清', info: '' };

export const strokeKeys = (k) => (k?.type === 'backhand' && (k.hands === 'one' || k.hands === 'two') ? ['backhand', k.hands === 'one' ? 'backhand1' : 'backhand2'] : [k?.type]);

export const isLeft = (s) => s?.settings?.handedness === 'left';

export const swap = (t, left) => (left && typeof t === 'string' ? t.replace(/[左右]/g, (x) => (x === '左' ? '右' : '左')) : t);

export const nb = (t) => (typeof t === 'string' ? t.replace(/(\d) (?=[a-zA-Z°%厘秒度米倍拍个次])/g, '$1 ') : t);

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

export const dropped = (k) => k?.quality?.ok === false;

const PART_ZH = { head: '头', torso: '肩膀和胯', dom_arm: '拿拍的手臂', off_arm: '另一只手臂', legs: '腿和脚' };

export function whyOf(k, short) {
  const q = k?.quality || {};
  const parts = (q.parts || []).map((p) => PART_ZH[p]).filter(Boolean).join('、') || '身体';
  const text = {
    parts: short ? `${parts}没认准` : `击球前后，${parts}上的点跳到了别处，电脑没认准。`,
    lost: short ? '有一段没认出人' : '击球前后有一段画面没认出人。',
    cut_off: short ? '脚出了画面' : '脚在画面外，电脑算不准你的身高和站的位置。',
    small: short ? '人太小' : '人在画面里太小，动作细节看不清。',
    shaky: short ? '骨架不稳' : '认出来的骨架前后对不上，整体不稳。',
  };
  return ['cut_off', 'small', 'lost', 'parts', 'shaky'].filter((w) => (q.why || []).includes(w)).map((w) => text[w]);
}

export function tipOf(k) {
  const why = k?.quality?.why || [];
  if (why.includes('cut_off')) return '下次把手机往后放一点，让脚也拍进画面。';
  if (why.includes('small')) return '下次把手机放近一点，让人在画面里大一些。';
  return '';
}

export const fixOf = (k, id) => k?.media?.fix?.[id] || momentOf(k, id)?.img || k?.media?.thumb;

export const momentOf = (k, id) => {
  const f = k?.media?.moment?.[id];
  return f != null ? k.media.at?.[f] || null : null;
};

const UNIT = { m: [100, '厘米'], ms: [0.001, '秒'], s: [1, '秒'] };

const CLEAR = 85;

function bestOther(s, k, id) {
  const key = strokeKeys(k).slice(-1)[0];
  let best = null;
  for (const x of s.strokes || []) {
    if (x.id === k.id || strokeKeys(x).slice(-1)[0] !== key || dropped(x)) continue;
    const c = (x.checks || []).find((y) => y.id === id);
    if (c?.status !== 'good' || !x.media?.thumb) continue;
    const [lo, hi] = Array.isArray(c.ref) && typeof c.value === 'number' ? c.ref : [null, null];
    const d = lo == null && hi == null ? -1 : Math.min(lo == null ? Infinity : c.value - lo, hi == null ? Infinity : hi - c.value);
    const q = (x.quality?.score ?? 100) >= CLEAR;
    if (!best || q > best.q || (q === best.q && (d > best.d || (d === best.d && c.confidence > best.c.confidence)))) best = { x, c, d, q };
  }
  return best?.x || null;
}

export function openCheck({ s, k, id, cat, onClose }) {
  const c = (k.checks || []).find((x) => x.id === id) || { id, status: 'na' };
  const def = catalogEntry(cat, id) || {};
  const left = isLeft(s);
  const hand = left ? 'left' : 'right';
  const keys = strokeKeys(k);
  const st = stdOf(cat, id, keys, left);
  const cue = swap([...keys].reverse().map((x) => def.cue_alt?.[x]).find(Boolean) || def.cue, left);
  const sid = s.id;
  const view = s.summary?.view && s.summary.view !== 'unknown' ? s.summary.view : 'back_high';
  const block = (title, ...kids) => (kids.flat().some(Boolean) ? h('div', { class: 'ck-sec' }, h('h3', {}, title), kids) : null);

  const rows = c.now || c.std
    ? [['现状', c.now, 'now'], ['标准', c.std, 'std'], ['差多少', c.gap, 'gap']]
    : [['你', c.status === 'na' ? c.reason || '看不清' : c.display, 'now'], ['标准', st?.standard, 'std']];
  const cmp = rows.some(([, v]) => v) ? h('div', { class: 'ck-cmp' },
    rows.filter(([, v]) => v).map(([key, v, cls]) => h('div', { class: `r r-${cls}` }, h('span', { class: 'k' }, key), h('span', { class: 'v' }, nb(v))))) : null;

  const [mul, unit] = id === 'gs_recovery' ? [1, '米'] : UNIT[def.unit] || [1, def.unit || ''];
  const ref = Array.isArray(c.ref) && c.ref.some((x) => typeof x === 'number') ? c.ref : null;
  const inside = ref && typeof c.value === 'number' && (ref[0] == null || c.value >= ref[0]) && (ref[1] == null || c.value <= ref[1]);
  const bar = ref && typeof c.value === 'number' && inside === (c.status === 'good')
    ? refBar({ value: c.value * mul, ref: ref.map((x) => (x == null ? x : x * mul)), unit, status: c.status }) : null;

  const spec = F.figureSpec(cat, id, keys);
  const marks = Array.isArray(c.marks) ? c.marks : [];
  const at = momentOf(k, id);
  const shot = media(sid, at ? at.img : k.media?.thumb);
  const photo = () => (at && F.photoOverlay
    ? F.photoOverlay({ src: shot, size: at.size, kp: at.kp, unit: at.unit, hand, focus: spec?.focus || [], marks, alt: '' })
    : h('img', { src: shot, alt: '' }));
  const fig = (ghosts) => F.figure({ catalog: cat, check: id, strokeKeys: keys, view, hand, size: 320, marks, ghosts });
  const when = () => {
    if (!at) return '';
    const dt = at.t - k.t_contact;
    const near = Math.abs(dt) < 0.03;
    const ph = at.phase && at.phase !== 'contact' ? PHASE_ZH[at.phase] : near ? PHASE_ZH.contact : '';
    return [ph, near ? '' : `击球${dt < 0 ? '前' : '后'} ${Math.abs(dt).toFixed(2)} 秒`].filter(Boolean).join(' · ');
  };
  const stdWhen = PHASE_ZH[String(spec?.pose || '').split('.').pop()] || '';
  const label = (who, t) => h('figcaption', {}, who, t ? h('span', { class: 'when' }, ` · ${t}`) : null);
  let zoomed = null;
  const zoom = (node) => document.body.append(zoomed = h('div', { class: 'ck-zoom', onclick: () => zoomed.remove() }, node));
  const svg = fig(false);
  const cap = swap(spec?.caption, left);
  const pics = shot || svg ? h('div', { class: 'ck-pics' },
    shot ? h('figure', {}, label('你', when()), h('button', { class: 'ck-pic', 'aria-label': '放大', onclick: () => zoom(photo()) }, photo())) : null,
    svg ? h('figure', {}, label('标准', stdWhen), h('div', { class: 'ck-pic fig' }, h('div', { class: 'sv' }, svg), cap ? h('div', { class: 'cap' }, cap.replace(/[，、]/g, '$&\n').split('\n').map((x) => h('span', {}, x))) : null)) : null) : null;

  const fixSrc = c.status === 'warn' && k.media?.fix?.[id] ? media(sid, k.media.fix[id]) : null;
  const ghost = !fixSrc && c.status === 'warn' && marks.some((m) => m.type === 'ghost') ? fig(true) : null;
  const howPic = fixSrc
    ? h('figure', {}, h('button', { class: 'ck-pic', 'aria-label': '放大', onclick: () => zoom(h('img', { src: fixSrc, alt: '' })) }, h('img', { src: fixSrc, alt: '' })))
    : ghost ? h('figure', {}, h('div', { class: 'ck-pic fig' }, h('div', { class: 'sv' }, ghost), h('div', { class: 'cap' }, h('span', {}, '「你」是你现在的位置，'), h('span', {}, '箭头指到该到的地方')))) : null;
  const howText = [cue ? h('div', { class: 'ck-cue' }, cue) : null, st?.steps?.length ? h('ol', { class: 'ck-steps' }, st.steps.map((x) => h('li', {}, x))) : null];

  const other = bestOther(s, k, id);
  const go = other ? `#/s/${encodeURIComponent(sid)}/k/${other.id}?c=${encodeURIComponent(id)}` : null;
  const sources = [...new Set([...(st?.sources || []), ...(def.sources || [])])];

  const body = h('div', { class: 'ck-body' },
    cmp, bar, pics,
    block('怎么改', howPic ? h('div', { class: 'ck-how' }, howPic, h('div', {}, howText)) : howText),
    block('练习', (st?.drills || []).map((d) => h('div', { class: 'ck-drill' }, h('div', {}, h('b', {}, d.name), d.dose ? h('span', { class: 'dose' }, d.dose) : null), d.how ? h('div', { class: 'how' }, d.how) : null))),
    block('自查', st?.self_check ? h('p', {}, st.self_check) : null),
    block('为什么', st?.why ? h('p', {}, st.why) : null),
    block('对照', other ? h('a', { class: 'ck-good chev', href: go },
      h('img', { src: media(sid, other.media.thumb), alt: '', loading: 'lazy' }),
      h('span', { class: 'grow' }, `做得好的一拍 #${other.id}`)) : null),
    sources.length ? h('details', { class: 'ck-src' }, h('summary', {}, '依据'), h('ul', {}, sources.map((x) => h('li', {}, x)))) : null);

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
