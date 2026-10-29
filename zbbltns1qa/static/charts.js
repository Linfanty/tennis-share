import { h, s, typeKey, typeZh, svLine, fmtT, fmtDur, tip, esc, quantile, TYPE_ZH } from './util.js';

const COLOR = { forehand: 'var(--fh)', backhand: 'var(--bh)', serve: 'var(--sv)', other: 'var(--other)' };
export const typeColor = (t) => COLOR[typeKey(t)];

export function legend(types) {
  const keys = [...new Set(types.map(typeKey))].sort((a, b) => Object.keys(COLOR).indexOf(a) - Object.keys(COLOR).indexOf(b));
  return h('div', { class: 'legend' }, keys.map((k) => h('span', {}, h('i', { class: `dot t-${k}` }), k === 'other' ? '其他' : TYPE_ZH[k])));
}

export function timeline({ duration, segments, strokes, video, onPick }) {
  const box = h('div', { class: 'tl', role: 'slider', 'aria-label': '击球时间轴' });
  const x = (t) => `${(100 * t) / duration}%`;
  const gap = 0.35;
  const segs = segments?.length ? segments : [{ start_t: 0, end_t: duration }];
  for (const sg of segs) {
    const a = sg.start_t + (sg.start_t > 0 ? gap : 0);
    const b = sg.end_t - (sg.end_t < duration - 0.01 ? gap : 0);
    box.append(h('div', { class: 'segb', style: { left: x(a), width: `calc(${x(Math.max(0, b - a))})` } }));
  }
  const ticks = strokes.map((k) => {
    const el = h('div', { class: 'tick', style: { left: x(k.t_contact), background: typeColor(k.type) } });
    el.addEventListener('pointerenter', (e) => tip(e, `<b>#${k.id}</b> ${esc(typeZh(k.type))} ${esc(svLine(k.sv))} · ${fmtT(k.t_contact)}`));
    el.addEventListener('pointerleave', () => tip());
    box.append(el);
    return el;
  });
  const head = h('div', { class: 'head', style: { left: '0%' } });
  box.append(head);
  box.addEventListener('click', (e) => {
    const r = box.getBoundingClientRect();
    const t = ((e.clientX - r.left) / r.width) * duration;
    let best = null;
    for (const k of strokes) if (!best || Math.abs(k.t_contact - t) < Math.abs(best.t_contact - t)) best = k;
    if (best && Math.abs(best.t_contact - t) < duration * 0.025) onPick(best);
    else if (video) video.currentTime = Math.max(0, t);
  });
  const select = (id) => strokes.forEach((k, i) => ticks[i].classList.toggle('sel', k.id === id));
  if (video) {
    video.addEventListener('timeupdate', () => {
      head.style.left = x(video.currentTime);
    });
  }
  const axis = h('div', { class: 'tlx' }, h('span', {}, '0:00'), h('span', {}, fmtDur(duration)));
  return { node: h('div', {}, box, axis), select };
}

const HW = 10.97 / 2;
const SW = 8.23 / 2;
const NET = 23.77 / 2;
const SVC = NET - 6.4;

export function court(strokes, onPick) {
  const y0 = -3.5;
  const y1 = NET + 1.2;
  const pad = 1.4;
  const W = HW * 2 + pad * 2;
  const H = y1 - y0;
  const X = (x) => x + HW + pad;
  const Y = (y) => y1 - y;
  const line = (x1, ya, x2, yb, cls = 'ln') => s('line', { class: cls, x1: X(x1), y1: Y(ya), x2: X(x2), y2: Y(yb) });
  const svg = s('svg', { class: 'court', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': '击球位置' },
    s('rect', { class: 'bg', x: 0, y: 0, width: W, height: H, rx: 0.6 }),
    line(-HW, 0, HW, 0), line(-HW, 0, -HW, NET), line(HW, 0, HW, NET), line(-SW, 0, -SW, NET), line(SW, 0, SW, NET),
    line(-SW, SVC, SW, SVC), line(0, SVC, 0, NET), line(0, 0, 0, 0.25), line(-HW - 0.4, NET, HW + 0.4, NET, 'net'));
  for (const k of strokes) {
    if (!k.court_xy) continue;
    const [cx, cy] = k.court_xy;
    const c = s('circle', { cx: X(Math.max(-HW - pad + 0.3, Math.min(HW + pad - 0.3, cx))), cy: Y(Math.max(y0 + 0.3, Math.min(y1 - 0.3, cy))), r: 0.32, fill: typeColor(k.type), style: 'cursor:pointer' });
    c.addEventListener('pointerenter', (e) => tip(e, `<b>#${k.id}</b> ${esc(typeZh(k.type))} · ${cx.toFixed(1)}, ${cy.toFixed(1)} m`));
    c.addEventListener('pointerleave', () => tip());
    c.addEventListener('click', () => onPick(k));
    svg.append(c);
  }
  return svg;
}

const chartW = () => (matchMedia('(min-width: 900px)').matches ? 520 : 320);

function scaleLinear(d0, d1, r0, r1) {
  return (v) => r0 + ((v - d0) / (d1 - d0 || 1)) * (r1 - r0);
}

export function lineChart({ points, yMax = 1, yFmt = (v) => `${Math.round(v * 100)}%`, height = 150, tipFmt, goal = null }) {
  const W = chartW();
  const H = height;
  const m = { l: 34, r: 12, t: 10, b: 22 };
  const x = scaleLinear(0, Math.max(1, points.length - 1), m.l, W - m.r);
  const y = scaleLinear(0, yMax, H - m.b, m.t);
  const svg = s('svg', { class: 'chart', viewBox: `0 0 ${W} ${H}`, role: 'img' });
  for (const v of [0, yMax / 2, yMax]) {
    svg.append(s('line', { class: v === 0 ? 'axis' : 'grid', x1: m.l, x2: W - m.r, y1: y(v), y2: y(v) }));
    svg.append(s('text', { x: m.l - 6, y: y(v) + 4, 'text-anchor': 'end' }, yFmt(v)));
  }
  const step = Math.ceil(points.length / 6);
  points.forEach((p, i) => {
    if (i % step === 0 || i === points.length - 1) svg.append(s('text', { x: x(i), y: H - 6, 'text-anchor': 'middle' }, p.label));
  });
  if (goal != null) {
    svg.append(s('line', { class: 'goal', x1: m.l, x2: W - m.r, y1: y(goal), y2: y(goal) }));
    svg.append(s('text', { x: W - m.r, y: y(goal) - 5, 'text-anchor': 'end' }, `目标 ≤ ${yFmt(goal)}`));
  }
  const withBand = points.filter((p) => p.lo != null && p.hi != null);
  if (withBand.length === points.length && points.length > 1) {
    const up = points.map((p, i) => `${x(i)},${y(p.hi)}`).join(' ');
    const dn = points.map((p, i) => `${x(i)},${y(p.lo)}`).reverse().join(' ');
    svg.append(s('polygon', { class: 'band', points: `${up} ${dn}` }));
  }
  const valid = points.map((p, i) => [p, i]).filter(([p]) => p.v != null);
  if (valid.length > 1) svg.append(s('polyline', { class: 'ln', points: valid.map(([p, i]) => `${x(i)},${y(p.v)}`).join(' ') }));
  for (const [p, i] of valid) {
    svg.append(s('circle', { class: 'pt', cx: x(i), cy: y(p.v), r: 4 }));
    const hit = s('circle', { class: 'hit', cx: x(i), cy: y(p.v), r: 14 });
    hit.addEventListener('pointerenter', (e) => tip(e, tipFmt ? tipFmt(p) : `${esc(p.label)} <b>${yFmt(p.v)}</b>`));
    hit.addEventListener('pointerleave', () => tip());
    svg.append(hit);
  }
  return svg;
}

export function rangeChart({ points, color, height = 160 }) {
  const W = chartW();
  const H = height;
  const m = { l: 34, r: 12, t: 10, b: 22 };
  const all = points.flatMap((p) => p.values);
  const hi = Math.ceil((Math.max(...all, 10) + 5) / 20) * 20;
  const lo = Math.max(0, Math.floor((Math.min(...all, hi) - 5) / 20) * 20);
  const x = scaleLinear(-0.5, Math.max(0.5, points.length - 0.5), m.l, W - m.r);
  const y = scaleLinear(lo, hi, H - m.b, m.t);
  const svg = s('svg', { class: 'chart', viewBox: `0 0 ${W} ${H}`, role: 'img' });
  for (const v of [lo, (lo + hi) / 2, hi]) {
    svg.append(s('line', { class: v === lo ? 'axis' : 'grid', x1: m.l, x2: W - m.r, y1: y(v), y2: y(v) }));
    svg.append(s('text', { x: m.l - 6, y: y(v) + 4, 'text-anchor': 'end' }, Math.round(v)));
  }
  const step = Math.ceil(points.length / 6);
  points.forEach((p, i) => {
    if (i % step === 0 || i === points.length - 1) svg.append(s('text', { x: x(i), y: H - 6, 'text-anchor': 'middle' }, p.label));
    if (!p.values.length) return;
    const v = [...p.values].sort((a, b) => a - b);
    const q = (f) => quantile(v, f);
    const bw = Math.min(14, ((W - m.l - m.r) / points.length) * 0.5);
    svg.append(s('rect', { x: x(i) - bw / 2, y: y(q(0.75)), width: bw, height: Math.max(2, y(q(0.25)) - y(q(0.75))), rx: 4, fill: color, opacity: 0.35 }));
    for (const val of v) svg.append(s('circle', { cx: x(i), cy: y(val), r: 1.6, fill: color, opacity: 0.6 }));
    svg.append(s('circle', { class: 'med', cx: x(i), cy: y(q(0.5)), r: 4.5, fill: color }));
    const hit = s('rect', { class: 'hit', x: x(i) - 16, y: m.t, width: 32, height: H - m.t - m.b });
    hit.addEventListener('pointerenter', (e) => tip(e, `${esc(p.label)} 中位 <b>${Math.round(q(0.5))}</b> km/h · ${Math.round(q(0.25))}–${Math.round(q(0.75))} · ${v.length} 拍`));
    hit.addEventListener('pointerleave', () => tip());
    svg.append(hit);
  });
  return svg;
}

export function dataTable(head, rows) {
  return h('details', { class: 'tbl' }, h('summary', {}, '数据'),
    h('table', {}, h('tr', {}, head.map((c) => h('th', {}, c))), rows.map((r) => h('tr', {}, r.map((c) => h('td', {}, c))))));
}

const REF_UNIT = { '°': [0, 20, 1], '°/s': [0, 200, 1], ms: [0, 200], '%': [1, 4, 1], s: [2, 0.2, 1], m: [2, 0.2] };

export function refBar({ value, ref, unit, status }) {
  const [lo, hi] = ref;
  const [dec, minSpan, pos] = REF_UNIT[unit] || [2, 0.2];
  const xs = [value, lo, hi].filter((x) => typeof x === 'number');
  const grow = Math.max(0, minSpan - (Math.max(...xs) - Math.min(...xs))) / 2;
  const a0 = Math.min(...xs) - grow;
  const b0 = Math.max(...xs) + grow;
  const a = pos && Math.min(...xs) >= 0 ? Math.max(0, a0 - (b0 - a0) * 0.15) : a0 - (b0 - a0) * 0.15;
  const b = b0 + (b0 - a0) * 0.15;
  const sp = !unit || /^[°%]/.test(unit) ? '' : ' ';
  const fmt = (v) => {
    const t = +Math.abs(v).toFixed(dec);
    return `${v < 0 && t ? '−' : ''}${t}${sp}${unit}`;
  };
  const X = (v) => ((v - a) / (b - a)) * 100;
  const zl = lo == null ? 0 : X(lo);
  const zr = hi == null ? 100 : X(hi);
  const lab = (cls, v) => h('span', { class: cls }, fmt(v));
  const top = lab('rb-v', value);
  const ends = [lab('rb-t end', a), lab('rb-t end', b)];
  const bds = [lo, hi].filter((x) => x != null).map((v) => [lab('rb-t', v), v]);
  const node = h('div', { class: 'rbar', role: 'img', 'aria-label': `${fmt(value)}；${[lo != null ? `≥ ${fmt(lo)}` : '', hi != null ? `≤ ${fmt(hi)}` : ''].filter(Boolean).join('，')}` },
    h('div', { class: 'rb-top' }, top),
    h('div', { class: 'rb-track' },
      h('div', { class: 'rb-zone', style: { left: `${zl}%`, width: `${zr - zl}%` } }),
      h('i', { class: `rb-dot s-${status}`, style: { left: `${X(value)}%` } })),
    h('div', { class: 'rb-ticks' }, ends, bds.map(([el]) => el)));
  new ResizeObserver(() => {
    const W = node.clientWidth;
    if (!W) return;
    const put = (el, v, align) => {
      const w = el.offsetWidth;
      const x = align === 'l' ? 0 : align === 'r' ? W - w : Math.max(0, Math.min(W - w, (X(v) / 100) * W - w / 2));
      el.style.left = `${x}px`;
      return [x, x + w];
    };
    const spans = bds.map(([el, v]) => put(el, v));
    const e0 = put(ends[0], a, 'l');
    const e1 = put(ends[1], b, 'r');
    ends[0].style.visibility = spans.some(([x0]) => x0 < e0[1] + 20) ? 'hidden' : '';
    ends[1].style.visibility = spans.some(([, x1]) => x1 > e1[0] - 20) ? 'hidden' : '';
    put(top, value);
  }).observe(node);
  return node;
}
