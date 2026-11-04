import { h, api, countsLine, playerSeg } from '../util.js';
import { card } from './list.js';
import { trendBlock } from './trends.js';

export async function summaryView() {
  const data = await api('/api/summary');
  const players = data.players || [];
  const node = h('div', {}, h('h1', { class: 'h1' }, '训练汇总'));
  if (!players.length) {
    node.append(h('div', { class: 'empty' }, '还没有分享的训练'));
    return { node };
  }
  let want = '';
  try {
    want = decodeURIComponent(location.hash.replace(/^#\/?/, '').split('?')[0]);
  } catch {}
  const p = players.find((x) => x.name === want) || players[0];
  if (players.length > 1) node.append(h('div', { class: 'who' }, playerSeg(players.map((x) => x.name), p.name, (v) => (location.hash = `#/${encodeURIComponent(v)}`))));
  const total = {};
  for (const x of p.sessions) for (const [t, n] of Object.entries(x.counts || {})) total[t] = (total[t] || 0) + n;
  node.append(h('div', { class: 'meta' }, [`${p.sessions.length} 次训练`, countsLine(total)].filter(Boolean).join(' · ')),
    h('section', { class: 'sec' }, h('h2', { class: 'sec-h' }, '训练'), h('div', { class: 'sessions' }, p.sessions.map((it) => card({ ...it, status: 'done' })))));
  if (!p.trend?.length) return { node };
  const t = trendBlock(p.trend, p.checks || null, { ...p.plans }, null);
  node.append(h('section', { class: 'sec' }, h('h2', { class: 'sec-h' }, '趋势'), t.nodes[0]), t.nodes[1]);
  return { node, leave: t.leave };
}
