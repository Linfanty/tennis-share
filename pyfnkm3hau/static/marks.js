export const NS = 'http://www.w3.org/2000/svg';
export const SIDE = { shoulder: [6, 5], elbow: [8, 7], wrist: [10, 9], hip: [12, 11], knee: [14, 13], ankle: [16, 15] };
export const COLOR = { dom: 'var(--dom, #ff9628)', off: 'var(--off, #46beff)' };
const TONE = { good: 'var(--good, #0ca30c)', warn: 'var(--warn, #fab219)', muted: 'var(--muted, #8a8a8e)' };
const PARENT = { wrist: 'elbow', elbow: 'shoulder', ankle: 'knee', knee: 'hip', shoulder: 'hip', hip: 'knee' };
const MID = '#ebebeb';
const INK = 'rgba(0,0,0,.5)';

export const el = (tag, attrs) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v);
  return e;
};
export const f = (x) => +x.toFixed(4);
export const ok = (p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]);
export const mid = (a, b) => (ok(a) && ok(b) ? [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] : null);
export const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

export function bones(dom = 'right') {
  const d = dom === 'left' ? 1 : 0;
  const j = (k, s) => SIDE[k][s === 'dom' ? d : 1 - d];
  return [
    [j('shoulder', 'off'), j('shoulder', 'dom'), 'mid', 'trunk'], [j('hip', 'off'), j('hip', 'dom'), 'mid', 'trunk'],
    ...['dom', 'off'].flatMap((s) => [
      [j('shoulder', s), j('hip', s), s, 'trunk'],
      [j('shoulder', s), j('elbow', s), s, `${s}_arm`], [j('elbow', s), j('wrist', s), s, `${s}_arm`],
      [j('hip', s), j('knee', s), s, `${s}_leg`], [j('knee', s), j('ankle', s), s, `${s}_leg`],
    ]),
  ];
}

export function lit(focus, front = 'off') {
  const on = new Set(focus || []);
  const back = front === 'dom' ? 'off' : 'dom';
  const out = new Set(['trunk', 'head', 'feet', 'racket'].filter((k) => on.has(k)));
  for (const s of ['dom', 'off']) {
    if (on.has(`${s}_arm`) || on.has('both_arms')) out.add(`${s}_arm`);
    if (on.has('legs') || (on.has('front_leg') && s === front) || (on.has('back_leg') && s === back)) out.add(`${s}_leg`);
  }
  return out;
}

export function anchor(kp, name, { dom = 'right', mode = 'figure', unit = 1 } = {}) {
  if (!kp) return null;
  if (name === 'ground') {
    if (mode !== 'photo') return [0, 0];
    const a = [kp[15], kp[16]].filter(ok);
    return a.length ? [a.reduce((s, q) => s + q[0], 0) / a.length, Math.max(...a.map((q) => q[1])) + 0.03 * unit] : null;
  }
  if (name === 'nose') return ok(kp[0]) ? kp[0] : null;
  if (name === 'hip_center') return mid(kp[11], kp[12]);
  if (name === 'shoulder_center') return mid(kp[5], kp[6]);
  const m = /^(dom|off)_([a-z]+)$/.exec(name || '');
  const ids = m && SIDE[m[2]];
  const p = ids && kp[ids[(m[1] === 'dom') === (dom !== 'left') ? 0 : 1]];
  return ok(p) ? p : null;
}

function resolve(marks, c) {
  const A = (n) => anchor(c.kp, n, c);
  const u = c.unit;
  const geom = (m) => {
    const a = A(m.type === 'ghost' ? m.joint : m.at);
    if (!a) return null;
    if (m.type === 'hband') {
      return Number.isFinite(m.lo) && Number.isFinite(m.hi) ? { a, top: a[1] - Math.max(m.lo, m.hi) * u, bot: a[1] - Math.min(m.lo, m.hi) * u } : null;
    }
    if (m.type === 'hline') return { a, y: a[1] - (m.dy || 0) * u };
    if (m.type === 'vline') return { a, x: a[0] };
    if (m.type === 'joint') return { a, r: 0.06 * u };
    if (m.type === 'seg') {
      const b = A(m.to);
      return b && { a, b };
    }
    if (m.type !== 'ghost') return null;
    const at = A(m.at);
    const pm = /^(dom|off)_([a-z]+)$/.exec(m.joint);
    const pn = m.joint === 'nose' ? 'shoulder_center' : pm && PARENT[pm[2]] && `${pm[1]}_${PARENT[pm[2]]}`;
    return at && { a, g: [a[0], at[1] - (m.dy || 0) * u], p: pn ? A(pn) : null, r: 0.022 * u };
  };
  return (marks || [])
    .filter((m) => m && (!m.on || m.on === 'both' || m.on === c.mode) && (m.type !== 'ghost' || (c.mode === 'figure' && c.ghosts !== false)))
    .map((m) => ({ m, g: geom(m) }))
    .filter((x) => x.g);
}

export function markPoints(marks, kp, { unit = 1, dom = 'right', mode = 'figure', ghosts = true, fs = 0.08 } = {}) {
  const pts = [];
  const room = fs * 1.6;
  for (const { m, g } of kp ? resolve(marks, { kp, unit, dom, mode, ghosts }) : []) {
    if (m.type === 'hband') pts.push([g.a[0], g.top - (m.labels?.hi ? room : 0)], [g.a[0], g.bot + (m.labels?.lo ? room : 0)]);
    else if (m.type === 'hline') pts.push([g.a[0], g.y - (m.label ? room : 0)], [g.a[0], g.y]);
    else if (m.type === 'vline') pts.push([g.x, g.a[1]]);
    else if (m.type === 'joint') pts.push([g.a[0] - g.r, g.a[1] - g.r], [g.a[0] + g.r, g.a[1] + g.r]);
    else if (m.type === 'seg') pts.push(g.a, g.b);
    else if (m.type === 'ghost') pts.push([g.g[0] - g.r * 2, g.g[1] - g.r * 2], [g.g[0] + g.r * 2, g.g[1] + g.r * 2]);
  }
  return pts;
}

export function drawMarks(svg, { marks, kp, unit = 1, dom = 'right', mode = 'figure', w, h, ghosts = true, avoid = [] } = {}) {
  const list = kp ? resolve(marks, { kp, unit, dom, mode, ghosts }) : [];
  if (!svg || !list.length) return svg;
  const vb = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
  const [x0, y0, bw, bh] = vb.length === 4 && vb.every(Number.isFinite) ? vb : [0, 0, w, h];
  const x1 = x0 + bw;
  const y1 = y0 + bh;
  const photo = mode === 'photo';
  const fs = 0.08 * Math.max(bw, 0.75 * bh);
  const lw = fs * 0.12;
  const dash = `${f(lw * 3.4)} ${f(lw * 2.6)}`;
  const back = el('g', { class: 'mk-back' });
  const front = el('g', { class: 'mk' });
  const text = el('g', { class: 'mk-text' });
  const line = (d, col, width, extra = {}) => {
    if (photo) front.append(el('path', { d, fill: 'none', stroke: 'rgba(0,0,0,.35)', 'stroke-width': f(width + lw * 1.2), 'stroke-linecap': 'round' }));
    front.append(el('path', { d, fill: 'none', style: `stroke:${col}`, 'stroke-width': f(width), 'stroke-linecap': 'round', ...extra }));
  };
  const band = list.find((x) => x.m.type === 'hband' && x.m.tone === 'good');
  const want = [];
  const H = fs * 1.25;
  const pad = fs * 0.25;
  const gap = fs * 0.3;
  const hc = (y, dir) => {
    const ya = y + dir * (H / 2 + lw * 1.5);
    const yb = y - dir * (H / 2 + lw * 1.5);
    return [[x0 + pad, ya, 0], [x1 - pad, ya, 1], [x0 + pad, yb, 0], [x1 - pad, yb, 1]];
  };
  const around = (p, o) => [[p[0] + o, p[1], 0], [p[0] - o, p[1], 1], [p[0], p[1] - o - H / 2, 0.5], [p[0], p[1] + o + H / 2, 0.5]];
  for (const { m, g } of list) {
    const col = TONE[m.tone] || TONE.muted;
    if (m.type === 'hband') {
      back.append(el('rect', { x: f(x0), y: f(g.top), width: f(bw), height: f(g.bot - g.top), style: `fill:${col}`, 'fill-opacity': photo ? 0.24 : 0.16 }));
      line(`M${f(x0)} ${f(g.top)}H${f(x1)}`, col, lw, { 'stroke-dasharray': dash });
      line(`M${f(x0)} ${f(g.bot)}H${f(x1)}`, col, lw, { 'stroke-dasharray': dash });
      if (m.labels?.hi) want.push([m.labels.hi, hc(g.top, -1)]);
      if (m.labels?.lo) want.push([m.labels.lo, hc(g.bot, 1)]);
      if (m.label) want.push([m.label, hc((g.top + g.bot) / 2, 0)]);
    } else if (m.type === 'hline') {
      line(`M${f(x0)} ${f(g.y)}H${f(x1)}`, col, lw, { 'stroke-dasharray': dash });
      if (m.label) want.push([m.label, hc(g.y, -1)]);
    } else if (m.type === 'vline') {
      line(`M${f(g.x)} ${f(y0)}V${f(y1)}`, col, lw, { 'stroke-dasharray': dash });
      const [ya, yb] = [y0 + pad + H / 2, y1 - pad - H / 2];
      if (m.label) want.push([m.label, [[g.x + gap, ya, 0], [g.x - gap, ya, 1], [g.x + gap, yb, 0], [g.x - gap, yb, 1]]]);
    } else if (m.type === 'joint') {
      if (photo) front.append(el('circle', { cx: f(g.a[0]), cy: f(g.a[1]), r: f(g.r), fill: 'none', stroke: INK, 'stroke-width': f(lw * 3) }));
      front.append(el('circle', { cx: f(g.a[0]), cy: f(g.a[1]), r: f(g.r), style: `stroke:${col};fill:${col}`, 'fill-opacity': 0.12, 'stroke-width': f(lw * 1.5) }));
      if (m.label) want.push([m.label, around(g.a, g.r + gap)]);
    } else if (m.type === 'seg') {
      line(`M${f(g.a[0])} ${f(g.a[1])}L${f(g.b[0])} ${f(g.b[1])}`, col, lw * 1.3, { 'stroke-dasharray': dash });
      for (const q of [g.a, g.b]) front.append(el('circle', { cx: f(q[0]), cy: f(q[1]), r: f(lw * 1.6), style: `fill:${col}` }));
      const n = Math.hypot(g.b[0] - g.a[0], g.b[1] - g.a[1]) || 1;
      const [nx, ny] = [-(g.b[1] - g.a[1]) / n, (g.b[0] - g.a[0]) / n];
      const [cx, cy] = mid(g.a, g.b);
      const o = gap + H / 2;
      if (m.label) want.push([m.label, [[cx + nx * o, cy + ny * o, 0.5], [cx - nx * o, cy - ny * o, 0.5]]]);
    } else {
      if (g.p) line(`M${f(g.p[0])} ${f(g.p[1])}L${f(g.g[0])} ${f(g.g[1])}`, col, lw * 1.4, { 'stroke-dasharray': dash });
      const e = band && (g.g[1] < band.g.top ? band.g.top : g.g[1] > band.g.bot ? band.g.bot : null);
      if (e != null) {
        const s = Math.sign(e - g.g[1]);
        const n = Math.abs(e - g.g[1]) - g.r * 1.4;
        const hl = Math.min(fs * 0.5, Math.max(n, 0) * 0.6);
        const [x, yb] = [g.g[0], e - s * hl];
        if (n > hl * 1.2) line(`M${f(x)} ${f(g.g[1] + s * g.r * 1.4)}V${f(yb)}`, col, lw * 1.3);
        if (hl > 0) front.append(el('path', { d: `M${f(x)} ${f(e)}L${f(x - hl * 0.55)} ${f(yb)}H${f(x + hl * 0.55)}Z`, style: `fill:${col}` }));
      }
      front.append(el('circle', { cx: f(g.g[0]), cy: f(g.g[1]), r: f(g.r), style: `fill:${col};stroke:var(--card, #fff)`, 'stroke-width': f(lw * 0.9) }));
      if (m.label) want.push([m.label, around(g.g, g.r + gap)]);
    }
  }
  const obst = [...avoid, ...kp.slice(0, 5).filter(ok)];
  for (const [a, b] of bones()) if (ok(kp[a]) && ok(kp[b])) for (let i = 0; i <= 6; i++) obst.push(lerp(kp[a], kp[b], i / 6));
  const placed = [];
  for (const [t, cands] of want) {
    const tw = ([...String(t)].reduce((n, ch) => n + (ch.charCodeAt(0) > 0x2e80 ? 1 : 0.6), 0) + 0.35) * fs;
    let best = null;
    cands.forEach(([cx, cy, ax], i) => {
      const bx = Math.max(x0 + pad, Math.min(cx - ax * tw, x1 - pad - tw));
      const by = Math.max(y0 + pad, Math.min(cy - H / 2, y1 - pad - H));
      const r = [bx, by, bx + tw, by + H];
      let s = i * 0.6 + (Math.abs(bx - (cx - ax * tw)) + Math.abs(by - (cy - H / 2))) / fs;
      for (const q of obst) if (q[0] > r[0] - gap / 2 && q[0] < r[2] + gap / 2 && q[1] > r[1] - gap / 2 && q[1] < r[3] + gap / 2) s += 1;
      for (const b of placed) if (r[0] < b[2] && b[0] < r[2] && r[1] < b[3] && b[1] < r[3]) s += 40;
      if (!best || s < best.s) best = { s, r };
    });
    placed.push(best.r);
    const e = el('text', {
      x: f((best.r[0] + best.r[2]) / 2), y: f((best.r[1] + best.r[3]) / 2), 'font-size': f(fs), 'font-weight': 600,
      'text-anchor': 'middle', 'dominant-baseline': 'central',
      style: `fill:${photo ? '#fff' : 'var(--text, #0b0b0b)'};stroke:${photo ? 'rgba(0,0,0,.72)' : 'var(--card, #fff)'};stroke-width:${f(fs * 0.3)}px;paint-order:stroke;stroke-linejoin:round`,
    });
    e.textContent = String(t);
    text.append(e);
  }
  svg.prepend(back);
  svg.append(front, text);
  return svg;
}

export function photoOverlay({ src, size, kp, unit, hand = 'right', focus = [], marks = [], alt = '' } = {}) {
  const [w, h] = size || [600, 800];
  const wrap = document.createElement('div');
  wrap.className = 'ov';
  wrap.style.cssText = 'position:relative;width:100%;height:100%';
  const img = document.createElement('img');
  img.src = src;
  img.alt = alt;
  img.style.cssText = 'display:block;width:100%;height:100%;object-fit:contain';
  const svg = el('svg', {
    xmlns: NS, viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: 'xMidYMid meet', 'aria-hidden': 'true',
    style: 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:hidden',
  });
  wrap.append(img, svg);
  const pts = Array.isArray(kp) && kp.length >= 17 ? kp.map((q) => (ok(q) ? [q[0], q[1]] : null)) : null;
  if (!pts) return wrap;
  const dom = hand === 'left' ? 'left' : 'right';
  const u = unit || h * 0.6;
  const S = Math.max(w, 0.75 * h);
  const on = lit(focus);
  const any = on.size > 0;
  const base = S * 0.0075;
  const big = S * 0.0165;
  const g = el('g', { class: 'sk', 'stroke-linecap': 'round' });
  const hot = new Set();
  const list = bones(dom).sort((a, b) => on.has(a[3]) - on.has(b[3]));
  for (const [a, b, s, part] of list) {
    if (!ok(pts[a]) || !ok(pts[b])) continue;
    const lit1 = on.has(part);
    if (lit1 && part !== 'trunk') hot.add(a).add(b);
    const d = `M${f(pts[a][0])} ${f(pts[a][1])}L${f(pts[b][0])} ${f(pts[b][1])}`;
    const width = lit1 ? big : base;
    g.append(el('path', { d, stroke: INK, 'stroke-width': f(width + base * 1.2), 'stroke-opacity': lit1 ? 1 : any ? 0.6 : 0.9 }));
    g.append(el('path', { d, style: `stroke:${s === 'mid' ? MID : COLOR[s]}`, 'stroke-width': f(width), 'stroke-opacity': lit1 ? 1 : any ? 0.55 : 0.9 }));
  }
  if (on.has('feet')) for (const i of SIDE.ankle) hot.add(i);
  const side = (i) => (Object.values(SIDE).some((x) => x[dom === 'left' ? 1 : 0] === i) ? 'dom' : 'off');
  for (let i = 5; i < 17; i++) {
    if (!ok(pts[i])) continue;
    const r = hot.has(i) ? big * (on.has('feet') && SIDE.ankle.includes(i) ? 1.2 : 0.8) : base * 1.15;
    g.append(el('circle', { cx: f(pts[i][0]), cy: f(pts[i][1]), r: f(r), style: `fill:${COLOR[side(i)]}`, stroke: 'rgba(20,20,20,.85)', 'stroke-width': f(base * 0.45), 'fill-opacity': hot.has(i) || !any ? 1 : 0.75 }));
  }
  if (ok(pts[0])) g.append(el('circle', { cx: f(pts[0][0]), cy: f(pts[0][1]), r: f(base * 1.15), fill: MID, stroke: 'rgba(20,20,20,.85)', 'stroke-width': f(base * 0.45) }));
  const face = pts.slice(0, 5).filter(ok);
  if (on.has('head') && face.length) {
    const c = face.reduce((s, q) => [s[0] + q[0] / face.length, s[1] + q[1] / face.length], [0, 0]);
    const r = Math.max(0.075 * u, ...face.map((q) => Math.hypot(q[0] - c[0], q[1] - c[1]) * 1.5));
    g.append(el('circle', { cx: f(c[0]), cy: f(c[1]), r: f(r), fill: 'none', stroke: INK, 'stroke-width': f(big + base * 1.2) }));
    g.append(el('circle', { cx: f(c[0]), cy: f(c[1]), r: f(r), fill: 'none', stroke: MID, 'stroke-width': f(big * 0.7) }));
  }
  svg.append(g);
  drawMarks(svg, { marks, kp: pts, unit: u, dom, mode: 'photo', w, h });
  return wrap;
}
