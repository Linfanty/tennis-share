import { h, api, fmtShortDate, typeZh, pct, VIEW_ZH, MAIN_TYPES, esc, quantile } from '../util.js';
import { lineChart, rangeChart, dataTable, typeColor } from '../charts.js';

let viewSel = null;

export async function trendsView() {
  const data = await api('/api/trends');
  const all = data.sessions || [];
  const node = h('div', {}, h('h1', { class: 'h1' }, '趋势'));
  if (!all.length) {
    node.append(h('div', { class: 'empty' }, '还没有完成的训练'));
    return { node };
  }
  const views = [...new Set(all.map((x) => x.view))];
  if (!views.includes(viewSel)) viewSel = all[all.length - 1].view;
  const body = h('div', {});
  const plans = {};
  let alive = true;
  const draw = () => {
    const need = new Set();
    body.replaceChildren(...charts(all.filter((x) => x.view === viewSel), data.trends?.checks || null, plans, need));
    if (!need.size) return;
    Promise.all([...need].map((id) => api(`/api/sessions/${encodeURIComponent(id)}`).then((x) => x.summary?.plan || [], () => []).then((p) => (plans[id] = p))))
      .then(() => alive && draw());
  };
  if (views.length > 1) {
    const seg = h('div', { class: 'seg', style: { marginTop: '12px' } });
    const drawSeg = () => seg.replaceChildren(...views.map((v) => h('button', { class: v === viewSel ? 'on' : '', onclick: () => { viewSel = v; drawSeg(); draw(); } }, VIEW_ZH[v] || v)));
    drawSeg();
    node.append(seg);
  } else {
    node.append(h('div', { class: 'meta' }, `${VIEW_ZH[viewSel] || ''} · ${all.length} 次训练`));
  }
  draw();
  node.append(body);
  return { node, leave: () => (alive = false) };
}

function charts(list, ctr, plans, need) {
  const out = [];
  const dup = (x) => list.filter((y) => fmtShortDate(y.date) === fmtShortDate(x.date)).length > 1;
  const label = (x) => {
    const d = new Date(x.date);
    return dup(x) ? `${fmtShortDate(x.date)} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}` : fmtShortDate(x.date);
  };
  const keyOf = (i) => `${i.check_id}|${i.stroke_type}`;
  const latest = list[list.length - 1];
  const keys = [];
  for (const x of [latest, ...[...list].reverse()]) for (const i of x.issues || []) if (!keys.includes(keyOf(i))) keys.push(keyOf(i));
  const fromC = (key) => {
    const [cid, tp] = key.split('|');
    return ctr?.[cid]?.series?.[tp] || null;
  };
  if (ctr) {
    const lastRatio = (key) => fromC(key)?.find((e) => e.session_id === latest.id)?.ratio ?? -1;
    const extra = Object.entries(ctr).flatMap(([cid, c]) => Object.keys(c.series || {}).map((tp) => `${cid}|${tp}`)).filter((k) => !keys.includes(k));
    extra.sort((a, b) => lastRatio(b) - lastRatio(a));
    keys.push(...extra.filter((k) => lastRatio(k) > 0));
  }
  const issueCards = keys.slice(0, 4).map((key) => {
    const [cid, tp] = key.split('|');
    const snip = list.flatMap((x) => x.issues || []).find((i) => keyOf(i) === key);
    const ser = fromC(key);
    const points = list.map((x) => {
      if (ser) {
        const e = ser.find((q) => q.session_id === x.id);
        return { label: label(x), date: x.date, v: e ? e.ratio : null, lo: e?.ci?.[0], hi: e?.ci?.[1], n: e ? `${e.warn}/${e.evaluable}` : '' };
      }
      const i = (x.issues || []).find((j) => keyOf(j) === key);
      return { label: label(x), date: x.date, v: i ? i.ratio : null, lo: i?.ci?.[0], hi: i?.ci?.[1], n: i ? `${i.occurrences}/${i.evaluable}` : '' };
    });
    const last = [...list].reverse().find((x, i) => points[list.length - 1 - i].v != null);
    if (last && !plans[last.id]) need.add(last.id);
    const goal = last && plans[last.id]?.find((q) => q.check_id === cid && q.stroke_type === tp)?.goal;
    return h('div', { class: 'card' },
      h('h3', {}, ctr?.[cid]?.name || snip?.name || cid), h('div', { class: 'sub' }, `${typeZh(tp)} · 出现比例`),
      lineChart({ points, goal, tipFmt: (p) => `${esc(p.label)} <b>${pct(p.v)}</b> ${esc(p.n)}${p.lo != null ? ` · ${pct(p.lo)}–${pct(p.hi)}` : ''}` }),
      dataTable(['日期', '拍数', '比例'], points.map((p) => [p.label, p.n || '—', p.v == null ? '—' : pct(p.v)])));
  });
  if (issueCards.length) out.push(h('section', { class: 'sec' }, h('h2', { class: 'sec-h' }, '问题'), h('div', { class: 'mult' }, issueCards)));

  const speedCards = [];
  for (const t of MAIN_TYPES) {
    if (!list.some((x) => (x.speeds?.[t] || []).length)) continue;
    const points = list.map((x) => ({ label: label(x), date: x.date, values: x.speeds?.[t] || [] }));
    speedCards.push(h('div', { class: 'card' },
      h('h3', {}, h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '8px' } }, h('i', { class: 'dot', style: { background: typeColor(t) } }), typeZh(t))),
      h('div', { class: 'sub' }, 'km/h · 中位与四分位'),
      rangeChart({ points, color: typeColor(t) }),
      dataTable(['日期', '拍数', '中位'], points.map((p) => [p.label, p.values.length, p.values.length ? Math.round(quantile([...p.values].sort((a, b) => a - b), 0.5)) : '—']))));
  }
  if (speedCards.length) out.push(h('section', { class: 'sec' }, h('h2', { class: 'sec-h' }, '球速'), h('div', { class: 'mult' }, speedCards)));

  const pr = list.map((x) => ({ label: label(x), date: x.date, v: x.evaluable ? x.passed / x.evaluable : null, n: `${x.passed}/${x.evaluable}` }));
  if (pr.some((p) => p.v != null)) {
    out.push(h('section', { class: 'sec' }, h('h2', { class: 'sec-h' }, '达标率'),
      h('div', { class: 'mult' }, h('div', { class: 'card' },
        h('div', { class: 'sub' }, '可评估检查点'),
        lineChart({ points: pr, tipFmt: (p) => `${esc(p.label)} <b>${pct(p.v)}</b> ${esc(p.n)}` }),
        dataTable(['日期', '达标', '比例'], pr.map((p) => [p.label, p.n, p.v == null ? '—' : pct(p.v)]))))));
  }
  if (!out.length) out.push(h('div', { class: 'empty' }, '暂无数据'));
  return out;
}
