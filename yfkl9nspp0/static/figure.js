import { NS, SIDE, COLOR, el, f, mid, lerp, bones, lit, anchor, drawMarks, markPoints } from './marks.js';

export { drawMarks, photoOverlay } from './marks.js';

const HEAD_R = 0.065;
const BALL_R = 0.022;
const GUIDE_R = 0.075;
const RK = { butt: 0.04 / 0.35, throat: 0.18 / 0.35, hoop: 0.09 / 0.35 };
const INK = 'var(--text2, #52514e)';
const MIR = Object.fromEntries(Object.values(SIDE).flatMap(([r, l]) => [[r, l], [l, r]]));

export function figureSpec(catalog, check, strokeKeys) {
  const c = typeof check === 'string' ? catalog?.checks?.[check] : check;
  const fig = c?.figure;
  if (!fig?.pose) return null;
  const keys = [].concat(strokeKeys || []).reverse();
  const pick = (m) => (m ? keys.map((k) => m[k]).find((x) => x != null) : null);
  const alt = pick(fig.alt) || {};
  return {
    pose: pick(fig.pose) || Object.values(fig.pose)[0],
    focus: alt.focus || fig.focus || [],
    guides: alt.guides || fig.guides || [],
    caption: alt.caption || fig.caption || '',
    view: fig.view || null,
  };
}

export function figure({ catalog, check, strokeKeys, view, hand, size, marks, ghosts }) {
  const spec = figureSpec(catalog, check, strokeKeys);
  if (!spec) return null;
  const svg = poseFigure({ catalog, pose: spec.pose, view: spec.view || view, hand, focus: spec.focus, guides: spec.guides, size, marks, ghosts });
  if (svg && spec.caption) svg.setAttribute('aria-label', spec.caption);
  return svg;
}

export function poseFigure({ catalog, pose, view, hand, focus = [], guides = [], size = 160, marks = [], ghosts = true }) {
  const p = typeof pose === 'string' ? catalog?.poses?.[pose] : pose;
  const v = p?.views?.[view] || p?.views?.back_high;
  if (!v?.kp || v.kp.length < 17) return null;
  const sx = hand === 'left' ? -1 : 1;
  const P = (q) => [q[0] * sx, q[1]];
  const kp = v.kp.map(P);
  const z = (i) => (Number.isFinite(v.z?.[i]) ? v.z[i] : 0);
  const rk = v.racket?.length === 2 ? v.racket.map(P) : null;
  const on = lit(focus, p.front === 'dom' ? 'dom' : 'off');
  const any = on.size > 0;

  const em = mid(kp[3], kp[4]);
  const hc = lerp(em, kp[0], 0.14);
  const sc = mid(kp[5], kp[6]);
  const nd = Math.hypot(hc[0] - sc[0], hc[1] - sc[1]) || 1;
  const neckEnd = lerp(sc, hc, Math.max(0, 1 - HEAD_R / nd));

  let racket = null;
  if (rk) {
    const [g, t] = rk;
    const d = [t[0] - g[0], t[1] - g[1]];
    const L = Math.hypot(d[0], d[1]);
    const a = Math.max(RK.hoop * L, 0.045);
    racket = {
      butt: lerp(g, t, -RK.butt), throat: lerp(g, t, 1 - RK.throat), c: lerp(g, t, 1 - RK.hoop),
      a, b: a * 0.72, ang: L > 1e-6 ? (Math.atan2(d[1], d[0]) * 180) / Math.PI : -90,
    };
  }

  const gs = guides.filter((g) => !marks.some((m) => m.type === g.type && m.at === g.at && !m.dy))
    .map((g) => ({ ...g, p: anchor(kp, g.at), q: g.to ? anchor(kp, g.to) : null })).filter((g) => g.p && (g.type !== 'arrow' || g.q));

  const pts = kp.filter((_, i) => i === 0 || i > 4).concat([[hc[0] - HEAD_R, hc[1] - HEAD_R], [hc[0] + HEAD_R, hc[1] + HEAD_R]]);
  if (racket) pts.push(racket.butt, [racket.c[0] - racket.a, racket.c[1] - racket.a], [racket.c[0] + racket.a, racket.c[1] + racket.a]);
  const top = Math.min(...pts.map((q) => q[1]));
  const ball = v.ball && (v.ball[1] > top - 0.3 || on.has('off_arm')) ? P(v.ball) : null;
  if (ball) pts.push([ball[0] - BALL_R, ball[1] - BALL_R], [ball[0] + BALL_R, ball[1] + BALL_R]);
  for (const g of gs) {
    if (g.type === 'circle') pts.push([g.p[0] - GUIDE_R, g.p[1] - GUIDE_R], [g.p[0] + GUIDE_R, g.p[1] + GUIDE_R]);
    if (g.type === 'arrow') pts.push(g.p, g.q);
  }
  const span = (i) => [Math.min(...pts.map((q) => q[i])), Math.max(...pts.map((q) => q[i]))];
  const [bx, by] = [span(0), span(1)];
  const est = 0.08 * Math.max(bx[1] - bx[0] + 0.16, 0.9 * (by[1] - by[0] + 0.16)) * 1.15;
  pts.push(...markPoints(marks, kp, { ghosts, fs: est }));
  let [x0, x1] = span(0);
  let [y0, y1] = span(1);
  const pad = 0.08;
  let w = x1 - x0 + 2 * pad;
  let h = y1 - y0 + 2 * pad;
  const narrow = (marks || []).some((m) => m && m.on !== 'photo' && (m.type !== 'ghost' || ghosts !== false) && (m.label || m.labels)) ? 0.9 : 0.6;
  if (w < h * narrow) w = h * narrow;
  if (h < w * 0.6) h = w * 0.6;
  x0 = (x0 + x1) / 2 - w / 2;
  y0 = (y0 + y1) / 2 - h / 2;
  x1 = x0 + w;
  y1 = y0 + h;

  const long = Math.max(w, h);
  const u = long / size;
  const lw = Math.max(1.6, size / 70) * u;
  const fw = lw * 2;
  const gw = Math.max(1, size / 110) * u;
  const svg = el('svg', {
    xmlns: NS, viewBox: `${f(x0)} ${f(y0)} ${f(w)} ${f(h)}`, width: Math.round((size * w) / long), height: Math.round((size * h) / long),
    role: 'img', 'aria-label': p.name || '', class: 'pose-fig',
  });
  const line = (d, color, width, extra = {}) => svg.append(el('path', {
    d, fill: 'none', style: `stroke:${color}`, 'stroke-width': f(width), 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...extra,
  }));
  const dash = `${f(gw * 3)} ${f(gw * 2.5)}`;

  for (const g of gs) {
    if (g.type === 'hline') line(`M${f(x0)} ${f(g.p[1])}H${f(x1)}`, 'var(--muted)', gw, { 'stroke-dasharray': dash });
    else if (g.type === 'vline') line(`M${f(g.p[0])} ${f(y0)}V${f(y1)}`, 'var(--muted)', gw, { 'stroke-dasharray': dash });
    else if (g.type === 'circle') svg.append(el('circle', { cx: f(g.p[0]), cy: f(g.p[1]), r: GUIDE_R, fill: 'none', style: 'stroke:var(--muted)', 'stroke-width': f(gw), 'stroke-dasharray': dash }));
    else if (g.type === 'arrow') {
      const dx = g.q[0] - g.p[0];
      const dy = g.q[1] - g.p[1];
      const n = Math.hypot(dx, dy) || 1;
      const hl = Math.min(gw * 5, n * 0.4);
      const ux = dx / n;
      const uy = dy / n;
      const bx = g.q[0] - ux * hl;
      const by = g.q[1] - uy * hl;
      line(`M${f(g.p[0])} ${f(g.p[1])}L${f(bx)} ${f(by)}`, 'var(--muted)', gw, { 'stroke-dasharray': dash });
      svg.append(el('path', {
        d: `M${f(g.q[0])} ${f(g.q[1])}L${f(bx - uy * hl * 0.6)} ${f(by + ux * hl * 0.6)}L${f(bx + uy * hl * 0.6)} ${f(by - ux * hl * 0.6)}Z`,
        style: 'fill:var(--muted)',
      }));
    }
  }

  const soft = (fade) => ({ 'stroke-opacity': f((any ? 0.62 : 0.85) * (1 - 0.45 * fade)) });
  const items = bones().map(([a, b, s, part]) => {
    const fade = s === 'mid' ? 0 : Math.min(Math.max((z(a) + z(b) - z(MIR[a]) - z(MIR[b])) / 0.6, 0), 1);
    const hot = on.has(part);
    const d = `M${f(kp[a][0])} ${f(kp[a][1])}L${f(kp[b][0])} ${f(kp[b][1])}`;
    return [(z(a) + z(b)) / 2, () => line(d, s === 'mid' ? INK : COLOR[s], (hot ? fw : lw) * (1 - 0.28 * fade), hot ? {} : soft(fade))];
  });
  items.push([(z(5) + z(6)) / 2, () => line(`M${f(sc[0])} ${f(sc[1])}L${f(neckEnd[0])} ${f(neckEnd[1])}`, INK, on.has('trunk') ? fw : lw, on.has('trunk') ? {} : soft(0))]);
  items.push([(z(0) + z(3) + z(4)) / 3, () => {
    const hot = on.has('head');
    const r = HEAD_R;
    const sw = hot ? fw * 0.7 : lw;
    const op = hot ? 1 : any ? 0.75 : 0.9;
    const vx = kp[0][0] - em[0];
    const vy = kp[0][1] - em[1];
    const vz = z(0) - (z(3) + z(4)) / 2;
    const n2 = Math.hypot(vx, vy);
    const n3 = Math.hypot(n2, vz) || 1;
    const [ux, uy] = n2 > 1e-6 ? [vx / n2, vy / n2] : [0, -1];
    const e = (-r * vz) / n3;
    const at = (a, b) => `${f(hc[0] - a * uy + b * ux)} ${f(hc[1] + a * ux + b * uy)}`;
    let d = '';
    for (let i = 0; i <= 16; i++) d += (i ? 'L' : 'M') + at(r * Math.cos((Math.PI * i) / 16), -r * Math.sin((Math.PI * i) / 16));
    for (let i = 1; i <= 16; i++) d += `L${at(-r * Math.cos((Math.PI * i) / 16), -e * Math.sin((Math.PI * i) / 16))}`;
    svg.append(el('circle', { cx: f(hc[0]), cy: f(hc[1]), r, style: 'fill:var(--card, #fff)' }));
    svg.append(el('path', { d: `${d}Z`, style: `fill:${INK}`, 'fill-opacity': hot ? 0.95 : 0.85 }));
    for (const i of [1, 2]) {
      if (z(i) < (z(3) + z(4)) / 2 - 0.01) svg.append(el('circle', { cx: f(kp[i][0]), cy: f(kp[i][1]), r: f(Math.max(lw * 0.6, 0.009)), style: `fill:${INK}`, 'fill-opacity': f(op) }));
    }
    svg.append(el('circle', { cx: f(hc[0]), cy: f(hc[1]), r, fill: 'none', style: `stroke:${INK}`, 'stroke-width': f(sw), 'stroke-opacity': f(op) }));
    if (-vz / n3 > -0.3 && n2 / n3 > 0.35) line(`M${at(0, r * 0.9)}L${at(0, r * 1.5)}`, INK, sw, { 'stroke-opacity': f(op) });
  }]);
  if (racket) {
    items.push([z(10) - 1e-3, () => {
      const hot = on.has('racket');
      const extra = hot ? {} : soft(0);
      line(`M${f(racket.butt[0])} ${f(racket.butt[1])}L${f(racket.throat[0])} ${f(racket.throat[1])}`, INK, hot ? fw : lw * 0.9, extra);
      svg.append(el('ellipse', {
        cx: f(racket.c[0]), cy: f(racket.c[1]), rx: f(racket.a), ry: f(racket.b), fill: 'none', transform: `rotate(${f(racket.ang)} ${f(racket.c[0])} ${f(racket.c[1])})`,
        style: `stroke:${INK}`, 'stroke-width': f(hot ? fw * 0.8 : lw * 0.8), ...extra,
      }));
    }]);
  }
  items.sort((a, b) => b[0] - a[0]).forEach(([, draw]) => draw());
  if (on.has('feet')) for (const [i, s] of [[15, 'off'], [16, 'dom']]) svg.append(el('circle', { cx: f(kp[i][0]), cy: f(kp[i][1]), r: f(fw * 0.9), style: `fill:${COLOR[s]}` }));
  if (ball) svg.append(el('circle', { cx: f(ball[0]), cy: f(ball[1]), r: f(Math.max(BALL_R, lw * 0.9)), style: 'fill:var(--warn)' }));
  const avoid = [hc];
  for (let i = 0; i < 12; i++) for (const k of [1, 0.55]) avoid.push([hc[0] + HEAD_R * k * Math.cos(i * Math.PI / 6), hc[1] + HEAD_R * k * Math.sin(i * Math.PI / 6)]);
  if (racket) for (let i = 0; i <= 6; i++) avoid.push(lerp(racket.butt, rk[1], i / 6));
  if (ball) avoid.push(ball);
  drawMarks(svg, { marks, kp, mode: 'figure', ghosts, avoid });
  return svg;
}
