import { h, api, media, fmtDate, fmtDur, fmtT, typeZh, typeKey, svLine, progressOf, toast, catalog, VIEW_ZH, MAIN_TYPES, pct, quantile, SHARE } from '../util.js';
import { timeline, court, legend, typeColor } from '../charts.js';
import { aiBlock } from './ai.js';
import { openShare } from './share.js';
import { openCheck, stdOf, strokeKeys, isLeft, fixOf } from './check.js';

const filterBySession = {};

const QUALITY_ZH = {
  player_px: ['人物高度', (v) => `${Math.round(v)} px`],
  person_px: ['人物高度', (v) => `${Math.round(v)} px`],
  det_rate: ['检出率', (v) => pct(v)],
  pose_ok: ['姿态可用', (v) => pct(v)],
  calibrated: ['球场标定', (v) => (v ? '已标定' : '未标定')],
};

const go = (sid, k) => (location.hash = `#/s/${encodeURIComponent(sid)}/k/${k.id}`);

function header(s) {
  const meta = [fmtDate(s.recorded_at || s.created_at, true), fmtDur(s.video?.duration), s.summary?.view && s.summary.view !== 'unknown' ? VIEW_ZH[s.summary.view] : null].filter(Boolean).join(' · ');
  return h('div', {},
    h('div', { class: 'top' }, h('a', { class: 'back', href: '#/' }, '训练'),
      !SHARE && s.status === 'done' ? h('button', { class: 'btn ghost', onclick: () => openShare(s) }, '分享') : null),
    h('h1', { class: 'h1' }, s.title || '训练'),
    h('div', { class: 'meta' }, meta));
}

function progressCard(s) {
  if (s.status === 'error') {
    return h('div', { class: 'card sec' }, h('div', { class: 'prog' },
      h('i', { class: 'dot s-warn' }), h('div', { class: 'grow' }, '分析失败'),
      h('button', { class: 'btn', onclick: () => reanalyze(s) }, '重试'),
      h('button', { class: 'btn', onclick: () => remove(s) }, '删除')));
  }
  const p = progressOf(s.progress);
  return h('div', { class: 'card sec' }, h('div', { class: 'prog' }, h('div', { class: 'spin' }),
    h('div', { class: 'grow' }, h('div', {}, s.status === 'queued' ? '排队中' : p.label || '分析中'),
      h('div', { class: 'bar' }, h('i', { style: { width: `${Math.round(p.frac * 100)}%` } }))),
    s.status === 'queued' ? h('button', { class: 'btn', onclick: () => remove(s) }, '删除') : null));
}

async function remove(s) {
  if (!confirm('删除这次训练？')) return;
  try {
    await api(`/api/sessions/${encodeURIComponent(s.id)}`, { method: 'DELETE' });
    location.hash = '#/';
  } catch (e) {
    toast(e.status === 409 ? '分析中' : '稍后再试');
  }
}

async function reanalyze(s) {
  try {
    await api(`/api/sessions/${encodeURIComponent(s.id)}/reanalyze`, { method: 'POST' });
    dispatchEvent(new HashChangeEvent('hashchange'));
  } catch {
    toast('稍后再试');
  }
}

function cueSection(s, byId) {
  const sm = s.summary || {};
  const mc = sm.main_cue || {};
  const top = sm.issues?.[0];
  const cue = mc.cue || mc.text || top?.cue;
  const drill = mc.drill || top?.drill || {};
  const kids = [];
  if (sm.highlight) kids.push(h('div', { class: 'hl', style: { marginBottom: '12px' } }, h('i', { class: 'dot s-good' }), sm.highlight));
  if (cue) {
    const st = mc.stroke_type || top?.stroke_type;
    kids.push(h('div', { class: 'card cue' },
      h('div', { class: 'lab' }, st ? `本次口令 · ${typeZh(st)}` : '本次口令'),
      h('div', { class: 'big' }, cue),
      drill.name || drill.how ? h('div', { class: 'drill' }, drill.name ? h('b', {}, drill.name) : null, drill.name && drill.how ? '　' : null, drill.how || '') : null));
  }
  return kids.length ? h('section', { class: 'sec', style: { order: 1 } }, kids) : null;
}

const keysOf = (it, byId) => {
  const k = byId[it.evidence?.[0]];
  return k ? strokeKeys(k) : [it.stroke_type];
};

const peek = (s, it, byId, cat) => {
  const k = byId[it.evidence?.[0]];
  if (!k) return {};
  const fn = () => openCheck({ s, k, id: it.check_id, cat });
  return { role: 'button', tabindex: 0, onclick: fn, onkeydown: (e) => e.key === 'Enter' && fn() };
};

function issueCard(s, it, i, byId, names, cat) {
  const ci = it.ci?.length === 2 ? it.ci : null;
  const ev = (it.evidence || []).map((id) => byId[id]).filter(Boolean);
  const good = it.good_example != null ? byId[it.good_example] : null;
  const std = stdOf(cat, it.check_id, keysOf(it, byId), isLeft(s))?.standard;
  const tap = peek(s, it, byId, cat);
  const thumb = (k, ok) => h('a', { href: `#/s/${encodeURIComponent(s.id)}/k/${k.id}?c=${encodeURIComponent(it.check_id)}`, class: ok ? 'okx' : '' },
    h('img', { src: media(s.id, ok ? k.media?.thumb : fixOf(k, it.check_id)), alt: '', loading: 'lazy' }), h('span', { class: 'tag' }, ok ? '对照' : `#${k.id}`));
  return h('div', { class: 'card issue' },
    h('div', { class: `head${tap.role ? ' chev' : ''}`, ...tap }, h('div', { class: 'n' }, i + 1),
      h('div', { class: 'grow' },
        h('div', { class: 'name' }, it.name || it.check_id, ' ', h('span', { class: 'pill' }, typeZh(it.stroke_type))),
        h('div', { class: 'stat' }, `${it.occurrences}/${it.evaluable} 拍 · ${pct(it.ratio)}`, ci ? h('span', { class: 'ci' }, `（${pct(ci[0])}–${pct(ci[1])}）`) : null),
        std ? h('div', { class: 'std' }, `标准 ${std}`) : null,
        it.explained_by ? h('div', { class: 'by' }, `可能源于「${names[it.explained_by] || it.explained_by}」`) : null)),
    h('div', { class: 'ratio' },
      ci ? h('div', { class: 'ciband', style: { left: pct(ci[0]), width: pct(ci[1] - ci[0]) } }) : null,
      h('div', { class: 'pt', style: { left: pct(it.ratio) } })),
    ev.length || good ? h('div', { class: 'thumbs' }, ev.map((k) => thumb(k, false)), good ? thumb(good, true) : null) : null);
}

function issuesSection(s, byId, cat) {
  const sm = s.summary || {};
  const issues = sm.issues || [];
  const other = sm.other_findings || [];
  if (!issues.length && !other.length) return null;
  const names = Object.fromEntries([...issues, ...other].map((x) => [x.check_id, x.name]));
  return h('section', { class: 'sec', style: { order: 2 } },
    h('h2', { class: 'sec-h' }, '问题'),
    issues.length ? issues.slice(0, 3).map((it, i) => issueCard(s, it, i, byId, names, cat)) : h('div', { class: 'card' }, '没有明显问题'),
    other.length ? h('div', { class: 'list', style: { marginTop: '12px' } }, other.map((it) => {
      const tap = peek(s, it, byId, cat);
      return h('div', { class: `row${tap.role ? ' chev' : ''}`, ...tap }, h('i', { class: 'dot s-warn' }), h('div', { class: 'grow' }, it.name || it.check_id, ' ', h('span', { class: 'pill' }, typeZh(it.stroke_type))),
        h('span', { class: 'sub' }, `${it.occurrences}/${it.evaluable}`));
    })) : null);
}

function planSection(s, byId, cat) {
  const sm = s.summary || {};
  const plan = sm.plan || [];
  const review = sm.review || [];
  if (!plan.length && !review.length) return null;
  const left = isLeft(s);
  const keyOf = (p) => keysOf((sm.issues || []).find((i) => i.check_id === p.check_id && i.stroke_type === p.stroke_type) || p, byId);
  const from = review[0]?.from_session;
  return h('section', { class: 'sec plan', style: { order: 2 } },
    plan.length ? [
      h('h2', { class: 'sec-h' }, '练习计划'),
      h('div', { class: 'list' }, plan.map((p) => {
        const drills = (stdOf(cat, p.check_id, keyOf(p), left)?.drills || []).slice(0, 2);
        return h('div', { class: 'pl' },
          h('div', { class: 'name' }, p.name || p.check_id, ' ', h('span', { class: 'pill' }, typeZh(p.stroke_type))),
          h('div', { class: 'goal' }, `这次 ${pct(p.now)}（${Math.round(p.now * p.n)}/${p.n} 拍）→ 下次 ≤ ${pct(p.goal)}`),
          drills.length ? h('ol', { class: 'drills' }, drills.map((d) => h('li', {},
            h('div', {}, h('b', {}, d.name), d.dose ? h('span', { class: 'dose' }, d.dose) : null),
            d.how ? h('div', { class: 'how' }, d.how) : null))) : null);
      }))] : null,
    review.length ? [
      h('h2', { class: 'sec-h', style: plan.length ? { marginTop: '20px' } : null }, '上次目标',
        from && !SHARE ? h('a', { class: 'more', href: `#/s/${encodeURIComponent(from)}` }, '上次训练') : null),
      h('div', { class: 'list' }, review.map((r) => {
        const [m, mk, now] = !r.n ? ['na', '–', '这次没打'] : r.now == null ? ['na', '–', '拍数不够'] : [r.met ? 'good' : 'warn', r.met ? '✓' : '✗', `这次 ${pct(r.now)}`];
        return h('div', { class: 'row rv' },
          h('span', { class: `mk m-${m}`, 'aria-label': { good: '达成', warn: '未达成' }[m] || now }, mk),
          h('div', { class: 'grow' },
            h('div', {}, r.name || r.check_id, ' ', h('span', { class: 'pill' }, typeZh(r.stroke_type))),
            h('div', { class: 'sub' }, `目标 ≤ ${pct(r.goal)}，${now}`)));
      }))] : null);
}

function videoSection(s) {
  const src = media(s.id, s.media?.proxy);
  if (!src) return { node: null };
  const video = h('video', { src, poster: media(s.id, s.media?.poster), controls: true, playsinline: '', preload: 'metadata' });
  const strokes = s.strokes || [];
  const tl = timeline({
    duration: s.video?.duration || 1,
    segments: s.segments,
    strokes,
    video,
    onPick: (k) => {
      tl.select(k.id);
      video.currentTime = Math.max(0, (k.t_start ?? k.t_contact - 1) - 0.2);
      video.play().catch(() => {});
    },
  });
  const node = h('section', { class: 'sec', style: { order: 3 } },
    h('div', { class: 'player' }, video), tl.node, strokes.length ? legend(strokes.map((k) => k.type)) : null);
  return { node, video };
}

function strokesSection(s) {
  const strokes = s.strokes || [];
  if (!strokes.length) return h('section', { class: 'sec', style: { order: 5 } }, h('div', { class: 'card empty' }, '没有找到击球'));
  const groups = [['all', '全部']];
  for (const t of MAIN_TYPES) if (strokes.some((k) => k.type === t)) groups.push([t, typeZh(t)]);
  if (strokes.some((k) => typeKey(k.type) === 'other')) groups.push(['other', '其他']);
  let cur = filterBySession[s.id] || 'all';
  if (!groups.some(([g]) => g === cur)) cur = 'all';
  const listBox = h('div', { class: 'list' });
  const seg = h('div', { class: 'seg filters' });
  let expanded = false;
  const more = h('button', { class: 'btn ghost', style: { width: '100%', marginTop: '6px' }, onclick: () => { expanded = true; draw(); } }, '展开');
  const draw = () => {
    filterBySession[s.id] = cur;
    seg.replaceChildren(...groups.map(([g, label]) => {
      const n = g === 'all' ? strokes.length : strokes.filter((k) => typeKey(k.type) === g).length;
      return h('button', { class: g === cur ? 'on' : '', onclick: () => { cur = g; draw(); } }, `${label} ${n}`);
    }));
    const matched = strokes.filter((k) => cur === 'all' || typeKey(k.type) === cur);
    const shown = expanded ? matched : matched.slice(0, 10);
    more.hidden = shown.length === matched.length;
    listBox.replaceChildren(...shown.map((k) => h('a', { class: 'row srow chev', href: `#/s/${encodeURIComponent(s.id)}/k/${k.id}` },
      k.media?.thumb ? h('img', { src: media(s.id, k.media.thumb), alt: '', loading: 'lazy' }) : h('div', { class: 'thumb' }),
      h('div', { class: 'grow' },
        h('div', { class: 'tt' }, h('i', { class: 'dot', style: { background: typeColor(k.type) } }), `#${k.id} ${typeZh(k.type)}`),
        h('div', { class: 'sub' }, [fmtT(k.t_contact), svLine(k.sv)].filter(Boolean).join(' · '))),
      k.evaluable ? h('span', { class: 'pr' }, `${k.passed}/${k.evaluable}`) : null)));
  };
  draw();
  return h('section', { class: 'sec', style: { order: 5 } }, h('h2', { class: 'sec-h' }, '击球', h('small', {}, `${strokes.length} 拍`)), seg, listBox, more);
}

function courtSection(s) {
  const pts = (s.strokes || []).filter((k) => k.court_xy);
  if (!pts.length) return null;
  return h('section', { class: 'sec', style: { order: 6 } }, h('h2', { class: 'sec-h' }, '击球位置'),
    h('div', { class: 'card' }, court(pts, (k) => go(s.id, k)), legend(pts.map((k) => k.type))));
}

function speedSection(s) {
  const by = {};
  for (const k of s.strokes || []) if (k.sv?.speed_kmh) (by[k.type] ||= []).push(k.sv.speed_kmh);
  const types = Object.keys(by).sort((a, b) => by[b].length - by[a].length);
  if (!types.length) return null;
  const max = Math.ceil((Math.max(...types.flatMap((t) => by[t])) + 10) / 20) * 20;
  return h('section', { class: 'sec speeds', style: { order: 7 } }, h('h2', { class: 'sec-h' }, '球速', h('small', {}, 'km/h')),
    h('div', { class: 'list' }, types.map((t) => {
      const v = [...by[t]].sort((a, b) => a - b);
      return h('div', { class: 'row' },
        h('div', { class: 'grow' },
          h('div', { class: 'tt' }, typeZh(t), h('span', { class: 'sub' }, ` ${v.length} 拍 · ${Math.round(quantile(v, 0.25))}–${Math.round(quantile(v, 0.75))}`)),
          h('div', { class: 'strip' },
            h('div', { class: 'iqr', style: { left: `${(100 * quantile(v, 0.25)) / max}%`, width: `${(100 * (quantile(v, 0.75) - quantile(v, 0.25))) / max}%` } }),
            v.map((x) => h('i', { style: { left: `${(100 * x) / max}%`, background: typeColor(t) } })))),
        h('div', { class: 'v' }, Math.round(quantile(v, 0.5)), h('small', {}, '中位')));
    })));
}

function qualitySection(s) {
  const sm = s.summary || {};
  const rows = [];
  for (const n of sm.notes || []) rows.push(h('div', { class: 'row' }, h('i', { class: 'dot s-na' }), h('span', { class: 'k' }, typeof n === 'string' ? n : n.text || JSON.stringify(n))));
  for (const w of sm.quality?.warnings || []) rows.push(h('div', { class: 'row' }, h('i', { class: 'dot s-warn' }), h('span', { class: 'k' }, w)));
  for (const [k, v] of Object.entries(sm.quality || {})) {
    if (v == null || !QUALITY_ZH[k]) continue;
    rows.push(h('div', { class: 'row' }, h('span', { class: 'k' }, QUALITY_ZH[k][0]), h('span', { class: 'sub' }, QUALITY_ZH[k][1](v))));
  }
  if (!rows.length) return null;
  return h('section', { class: 'sec quality', style: { order: 8 } }, h('h2', { class: 'sec-h' }, '数据质量'), h('div', { class: 'list' }, rows));
}

function actions(s) {
  if (SHARE) return null;
  return h('section', { class: 'sec', style: { order: 10, display: 'flex', gap: '12px' } },
    h('button', { class: 'btn', style: { flex: 1 }, onclick: () => reanalyze(s) }, '重新分析'),
    h('button', { class: 'btn', style: { flex: 1 }, onclick: () => remove(s) }, '删除'));
}

export async function detailView(sid) {
  const [s, cat] = await Promise.all([api(`/api/sessions/${encodeURIComponent(sid)}`), catalog()]);
  const byId = Object.fromEntries((s.strokes || []).map((k) => [k.id, k]));
  const busy = s.status === 'queued' || s.status === 'processing';
  let timer;
  let alive = true;
  const node = h('div', {}, header(s));
  if (busy || s.status === 'error') node.append(progressCard(s));
  if (!busy && s.status !== 'error') {
    const v = videoSection(s);
    const ai = aiBlock({ sid: s.id, data: s.ai, running: s.ai_running, error: s.ai_error, body: null });
    ai.node.style.order = 4;
    node.append(h('div', { class: 'cols' },
      h('div', { class: 'left' }, v.node, courtSection(s), speedSection(s)),
      h('div', { class: 'right' }, cueSection(s, byId), issuesSection(s, byId, cat), planSection(s, byId, cat), ai.node, strokesSection(s), qualitySection(s), actions(s))));
    if (s.ai_running) ai.poll();
    return { node, leave: () => { ai.stop(); v.video?.pause(); } };
  }
  const poll = () => {
    timer = setTimeout(async () => {
      try {
        const n = await api(`/api/sessions/${encodeURIComponent(sid)}`);
        if (!alive) return;
        if (n.status !== s.status && !(n.status === 'processing' && s.status === 'queued')) {
          dispatchEvent(new HashChangeEvent('hashchange'));
          return;
        }
        node.replaceChildren(header(n), progressCard(n));
        s.status = n.status;
      } catch {}
      if (alive) poll();
    }, 1500);
  };
  if (busy) poll();
  return { node, leave: () => { alive = false; clearTimeout(timer); } };
}
