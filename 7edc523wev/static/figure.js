const NS = 'http://www.w3.org/2000/svg';
const SIDE = { shoulder: [6, 5], elbow: [8, 7], wrist: [10, 9], hip: [12, 11], knee: [14, 13], ankle: [16, 15] };
const ARM = { dom: [[6, 8], [8, 10]], off: [[5, 7], [7, 9]] };
const LEG = { dom: [[12, 14], [14, 16]], off: [[11, 13], [13, 15]] };
const TRUNK = [[5, 6], [5, 11], [6, 12], [11, 12]];
const HEAD_R = 0.065;
const BALL_R = 0.022;
const GUIDE_R = 0.075;
const RK = { butt: 0.04 / 0.35, throat: 0.18 / 0.35, hoop: 0.09 / 0.35 };

const el = (tag, attrs) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v);
  return e;
};
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const f = (x) => +x.toFixed(4);
const path = (segs, kp) => segs.map(([a, b]) => `M${f(kp[a][0])} ${f(kp[a][1])}L${f(kp[b][0])} ${f(kp[b][1])}`).join('');

function joint(kp, name) {
  if (name === 'ground') return [0, 0];
  if (name === 'nose') return kp[0];
  if (name === 'hip_center') return mid(kp[11], kp[12]);
  if (name === 'shoulder_center') return mid(kp[5], kp[6]);
  const m = /^(dom|off)_([a-z]+)$/.exec(name || '');
  const ids = m && SIDE[m[2]];
  return ids ? kp[ids[m[1] === 'dom' ? 0 : 1]] : null;
}

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

export function figure({ catalog, check, strokeKeys, view, hand, size }) {
  const spec = figureSpec(catalog, check, strokeKeys);
  if (!spec) return null;
  const svg = poseFigure({ catalog, pose: spec.pose, view: spec.view || view, hand, focus: spec.focus, guides: spec.guides, size });
  if (svg && spec.caption) svg.setAttribute('aria-label', spec.caption);
  return svg;
}

export function poseFigure({ catalog, pose, view, hand, focus = [], guides = [], size = 160 }) {
  const p = typeof pose === 'string' ? catalog?.poses?.[pose] : pose;
  const v = p?.views?.[view] || p?.views?.back_high;
  if (!v?.kp || v.kp.length < 17) return null;
  const sx = hand === 'left' ? -1 : 1;
  const P = (q) => [q[0] * sx, q[1]];
  const kp = v.kp.map(P);
  const rk = v.racket?.length === 2 ? v.racket.map(P) : null;
  const on = new Set(focus);

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

  const gs = guides.map((g) => ({ ...g, p: joint(kp, g.at), q: g.to ? joint(kp, g.to) : null })).filter((g) => g.p && (g.type !== 'arrow' || g.q));

  const pts = kp.filter((_, i) => i === 0 || i > 4).concat([[hc[0] - HEAD_R, hc[1] - HEAD_R], [hc[0] + HEAD_R, hc[1] + HEAD_R]]);
  if (racket) pts.push(racket.butt, [racket.c[0] - racket.a, racket.c[1] - racket.a], [racket.c[0] + racket.a, racket.c[1] + racket.a]);
  const top = Math.min(...pts.map((q) => q[1]));
  const ball = v.ball && (v.ball[1] > top - 0.3 || on.has('off_arm')) ? P(v.ball) : null;
  if (ball) pts.push([ball[0] - BALL_R, ball[1] - BALL_R], [ball[0] + BALL_R, ball[1] + BALL_R]);
  for (const g of gs) {
    if (g.type === 'circle') pts.push([g.p[0] - GUIDE_R, g.p[1] - GUIDE_R], [g.p[0] + GUIDE_R, g.p[1] + GUIDE_R]);
    if (g.type === 'arrow') pts.push(g.p, g.q);
  }
  let x0 = Math.min(...pts.map((q) => q[0]));
  let x1 = Math.max(...pts.map((q) => q[0]));
  let y0 = Math.min(...pts.map((q) => q[1]));
  let y1 = Math.max(...pts.map((q) => q[1]));
  const pad = 0.08;
  let w = x1 - x0 + 2 * pad;
  let h = y1 - y0 + 2 * pad;
  if (w < h * 0.6) w = h * 0.6;
  if (h < w * 0.6) h = w * 0.6;
  x0 = (x0 + x1) / 2 - w / 2;
  y0 = (y0 + y1) / 2 - h / 2;
  x1 = x0 + w;
  y1 = y0 + h;

  const long = Math.max(w, h);
  const u = long / size;
  const lw = Math.max(1.6, size / 48) * u;
  const fw = lw * 1.8;
  const gw = Math.max(1, size / 110) * u;
  const svg = el('svg', {
    xmlns: NS, viewBox: `${f(x0)} ${f(y0)} ${f(w)} ${f(h)}`, width: Math.round((size * w) / long), height: Math.round((size * h) / long),
    role: 'img', 'aria-label': p.name || '', class: 'pose-fig',
  });
  const line = (d, color, width, extra = {}) => svg.append(el('path', {
    d, fill: 'none', style: `stroke:var(${color})`, 'stroke-width': f(width), 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...extra,
  }));
  const dash = `${f(gw * 3)} ${f(gw * 2.5)}`;

  for (const g of gs) {
    if (g.type === 'hline') line(`M${f(x0)} ${f(g.p[1])}H${f(x1)}`, '--muted', gw, { 'stroke-dasharray': dash });
    else if (g.type === 'vline') line(`M${f(g.p[0])} ${f(y0)}V${f(y1)}`, '--muted', gw, { 'stroke-dasharray': dash });
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
      line(`M${f(g.p[0])} ${f(g.p[1])}L${f(bx)} ${f(by)}`, '--muted', gw, { 'stroke-dasharray': dash });
      svg.append(el('path', {
        d: `M${f(g.q[0])} ${f(g.q[1])}L${f(bx - uy * hl * 0.6)} ${f(by + ux * hl * 0.6)}L${f(bx + uy * hl * 0.6)} ${f(by - ux * hl * 0.6)}Z`,
        style: 'fill:var(--muted)',
      }));
    }
  }

  const front = p.front === 'dom' ? 'dom' : 'off';
  const back = front === 'dom' ? 'off' : 'dom';
  line(path([...TRUNK, ...ARM.dom, ...ARM.off, ...LEG.dom, ...LEG.off], kp) + `M${f(sc[0])} ${f(sc[1])}L${f(neckEnd[0])} ${f(neckEnd[1])}`, '--text2', lw, { 'stroke-opacity': 0.72 });
  const headOn = on.has('head');
  const hcol = headOn ? '--good' : '--text2';
  svg.append(el('circle', { cx: f(hc[0]), cy: f(hc[1]), r: HEAD_R, style: `stroke:var(${hcol});fill:var(${hcol})`, 'fill-opacity': 0.22, 'stroke-width': f(headOn ? fw : lw), 'stroke-opacity': headOn ? null : 0.72 }));
  if (racket) {
    const rOn = on.has('racket');
    const color = rOn ? '--good' : '--text2';
    const op = rOn ? null : 0.72;
    line(`M${f(racket.butt[0])} ${f(racket.butt[1])}L${f(racket.throat[0])} ${f(racket.throat[1])}`, color, rOn ? fw : lw * 0.9, { 'stroke-opacity': op });
    svg.append(el('ellipse', {
      cx: f(racket.c[0]), cy: f(racket.c[1]), rx: f(racket.a), ry: f(racket.b), fill: 'none', transform: `rotate(${f(racket.ang)} ${f(racket.c[0])} ${f(racket.c[1])})`,
      style: `stroke:var(${color})`, 'stroke-width': f(rOn ? fw * 0.8 : lw * 0.8), 'stroke-opacity': op,
    }));
  }

  const segs = [];
  if (on.has('trunk')) segs.push(...TRUNK);
  if (on.has('dom_arm') || on.has('both_arms')) segs.push(...ARM.dom);
  if (on.has('off_arm') || on.has('both_arms')) segs.push(...ARM.off);
  if (on.has('legs') || on.has('front_leg')) segs.push(...LEG[front]);
  if (on.has('legs') || on.has('back_leg')) segs.push(...LEG[back]);
  if (segs.length) line(path(segs, kp) + (on.has('trunk') ? `M${f(sc[0])} ${f(sc[1])}L${f(neckEnd[0])} ${f(neckEnd[1])}` : ''), '--good', fw);
  if (on.has('feet')) for (const i of [15, 16]) svg.append(el('circle', { cx: f(kp[i][0]), cy: f(kp[i][1]), r: f(fw * 0.9), style: 'fill:var(--good)' }));
  if (ball) svg.append(el('circle', { cx: f(ball[0]), cy: f(ball[1]), r: f(Math.max(BALL_R, lw * 0.9)), style: 'fill:var(--warn)' }));
  return svg;
}
