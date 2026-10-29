import { h, api, media, fmtT, typeZh, catalog, catalogEntry, checkName, PHASE_ZH, PHASE_ORDER, SPIN_ZH } from '../util.js';
import { aiBlock } from './ai.js';
import { openCheck, stdOf, strokeKeys, isLeft, nb, STATUS_ZH } from './check.js';

function checksSection(s, k, cat, open) {
  const keys = strokeKeys(k);
  const left = isLeft(s);
  const groups = {};
  for (const c of k.checks || []) {
    const def = catalogEntry(cat, c.id);
    const ph = def?.phase || 'other';
    (groups[ph] ||= []).push([c, def]);
  }
  const phases = Object.keys(groups).sort((a, b) => {
    const ia = PHASE_ORDER.indexOf(a);
    const ib = PHASE_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  if (!phases.length) return null;
  return h('section', { class: 'sec' },
    h('h2', { class: 'sec-h' }, '检查点', k.evaluable ? h('small', {}, h('span', { class: 'score' }, h('b', {}, k.passed), ` / ${k.evaluable} 达标`)) : null),
    phases.map((ph) => [
      h('div', { class: 'phase' }, cat?.phases?.[ph] || PHASE_ZH[ph] || (ph === 'other' ? '其他' : ph)),
      h('div', { class: 'list' }, groups[ph].map(([c]) => {
        const na = c.status === 'na';
        const std = na ? null : stdOf(cat, c.id, keys, left)?.standard;
        const you = na ? null : nb(c.display);
        return h('div', { class: 'row chk chev', role: 'button', tabindex: 0, onclick: () => open(c.id), onkeydown: (e) => e.key === 'Enter' && open(c.id) },
          h('i', { class: `dot s-${c.status}`, role: 'img', 'aria-label': STATUS_ZH[c.status] || c.status }),
          h('div', { class: 'grow' },
            h('div', { class: 'name' }, checkName(cat, c.id)),
            na && c.reason ? h('div', { class: 'why' }, c.reason) : null,
            you || std ? h('div', { class: 'kv' },
              you ? [h('span', { class: 'k' }, '你'), h('span', { class: 'v' }, you)] : null,
              std ? [h('span', { class: 'k' }, '标准'), h('span', { class: 's' }, std)] : null) : null));
      })),
    ]));
}

function player(k, sid, fps) {
  const base = k.media?.clip_speed || 1;
  const video = h('video', { src: media(sid, k.media.clip), playsinline: '', muted: '', loop: true, preload: 'auto', autoplay: '', poster: media(sid, k.media.thumb) });
  video.muted = true;
  let rate = 0.5;
  const rates = h('div', { class: 'seg' });
  const drawRates = () => rates.replaceChildren(...[0.25, 0.5, 1].map((r) => h('button', { class: r === rate ? 'on' : '', onclick: () => { rate = r; video.playbackRate = r / base; video.play().catch(() => {}); drawRates(); } }, `${r}×`)));
  drawRates();
  video.addEventListener('loadedmetadata', () => { video.playbackRate = rate / base; });
  video.addEventListener('play', () => { video.playbackRate = rate / base; });
  const step = (d) => {
    video.pause();
    video.currentTime = Math.max(0, Math.min(video.duration || 0, video.currentTime + d / fps));
  };
  const playBtn = h('button', { class: 'btn', 'aria-label': '播放', onclick: () => (video.paused ? video.play().catch(() => {}) : video.pause()) }, '❚❚');
  video.addEventListener('play', () => (playBtn.textContent = '❚❚'));
  video.addEventListener('pause', () => (playBtn.textContent = '▶'));
  return h('div', {},
    h('div', { class: 'player tall' }, video),
    h('div', { class: 'ctrl' }, rates,
      h('div', { class: 'steps' },
        h('button', { class: 'btn', 'aria-label': '上一帧', onclick: () => step(-1) }, '‹'),
        playBtn,
        h('button', { class: 'btn', 'aria-label': '下一帧', onclick: () => step(1) }, '›'))));
}

export async function strokeView(sid, id) {
  const [s, cat] = await Promise.all([api(`/api/sessions/${encodeURIComponent(sid)}`), catalog()]);
  const strokes = s.strokes || [];
  const i = strokes.findIndex((k) => k.id === id);
  if (i < 0) throw Object.assign(new Error('404'), { status: 404 });
  const k = strokes[i];
  const prev = strokes[i - 1];
  const next = strokes[i + 1];
  const href = (x) => `#/s/${encodeURIComponent(sid)}/k/${x.id}`;
  const sv = k.sv;
  const tags = [];
  if (sv) {
    tags.push(h('span', { class: 'pill' }, typeZh(sv.volley ? 'volley' : sv.stroke) || '标签'));
    if (sv.spin) tags.push(h('span', { class: 'pill' }, SPIN_ZH[sv.spin] ?? sv.spin));
    if (sv.speed_kmh) tags.push(h('span', { class: 'pill' }, `${Math.round(sv.speed_kmh)} km/h`));
  }
  const ai = aiBlock({ sid, stroke: k.id, data: k.ai, running: s.ai_running, error: s.ai_error });
  const setC = (c) => {
    const [base, qs] = location.hash.split('?');
    const q = new URLSearchParams(qs || '');
    if (c) q.set('c', c);
    else q.delete('c');
    history.replaceState(history.state, '', `${base}${`${q}` ? `?${q}` : ''}`);
  };
  let sheet = null;
  const open = (c) => {
    sheet?.close();
    setC(c);
    sheet = openCheck({ s, k, id: c, cat, onClose: () => { sheet = null; setC(null); } });
  };
  const fps = k.media?.clip_fps || s.video?.fps || 30;
  const node = h('div', {},
    h('div', { class: 'top' }, h('a', { class: 'back', href: `#/s/${encodeURIComponent(sid)}` }, s.title || '训练'),
      h('span', { class: 'sub', style: { color: 'var(--muted)', fontSize: '15px' } }, `${i + 1} / ${strokes.length}`)),
    h('h1', { class: 'h1' }, `#${k.id} ${typeZh(k.type)}`),
    h('div', { class: 'meta svtag' }, fmtT(k.t_contact), tags),
    h('div', { class: 'cols', style: { marginTop: '16px' } },
      h('div', { class: 'left' },
        k.media?.clip ? h('section', { class: 'sec', style: { order: 1 } }, player(k, sid, fps)) : null,
        k.media?.keys ? h('section', { class: 'sec', style: { order: 2 } }, h('h2', { class: 'sec-h' }, '关键帧'), h('div', { class: 'strip-img' }, h('img', { src: media(sid, k.media.keys), alt: '关键帧', loading: 'lazy' }))) : null,
        k.media?.onion ? h('section', { class: 'sec onion', style: { order: 4 } }, h('h2', { class: 'sec-h' }, '残影'), h('img', { src: media(sid, k.media.onion), alt: '残影', loading: 'lazy' })) : null),
      h('div', { class: 'right' },
        Object.assign(checksSection(s, k, cat, open) || h('div'), { style: 'order:3' }),
        Object.assign(ai.node, { style: 'order:5' }),
        h('div', { class: 'nav2', style: { order: 6 } },
          prev ? h('a', { class: 'btn', href: href(prev) }, '上一拍') : h('button', { class: 'btn', disabled: true }, '上一拍'),
          next ? h('a', { class: 'btn', href: href(next) }, '下一拍') : h('button', { class: 'btn', disabled: true }, '下一拍')))));
  if (s.ai_running) ai.poll();
  const want = new URLSearchParams(location.hash.split('?')[1] || '').get('c');
  if (want && (k.checks || []).some((c) => c.id === want)) open(want);
  return { node, leave: () => { ai.stop(); sheet?.close(); } };
}
