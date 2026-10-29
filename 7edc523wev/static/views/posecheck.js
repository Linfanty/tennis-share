import { h, api, catalog } from '../util.js';
import { poseFigure, figureSpec } from '../figure.js';

const VIEWS = [['back_high', '背面'], ['side', '侧面'], ['front', '正面']];
const EDGES = [[5, 6], [5, 7], [7, 9], [6, 8], [8, 10], [5, 11], [6, 12], [11, 12], [11, 13], [13, 15], [12, 14], [14, 16]];
const DOM = [6, 8, 10, 12, 14, 16];
const C = { dom: '#ff9628', off: '#46beff', mid: '#ebebeb', green: '#34c759', ink: 'rgba(0,0,0,.6)' };
const THR = 0.3;
const CAM = typeof isSecureContext !== 'undefined' && isSecureContext && !!navigator.mediaDevices?.getUserMedia;

function focusOf(cat, pose, ids) {
  const focus = new Set();
  const guides = new Map();
  for (const id of ids) {
    const sp = cat?.checks?.[id] ? figureSpec(cat, id, pose.keys) : { focus: id === 'rd_width' ? ['feet', 'legs'] : ['legs'], guides: [] };
    sp?.focus.forEach((f) => focus.add(f));
    sp?.guides.forEach((g) => guides.set(JSON.stringify(g), g));
  }
  return { focus: [...focus], guides: [...guides.values()] };
}

function stdFig(cat, pose, view, hand, size, ids) {
  const f = focusOf(cat, pose, ids);
  return poseFigure({ catalog: cat, pose: pose.key, view, hand, focus: f.focus, guides: f.guides, size });
}

function chkRow(c, live) {
  const st = c.status || 'na';
  const you = c.display || c.reason || '—';
  return h('div', { class: `row pc-chk${live ? ' live' : ''}`, 'data-id': c.id },
    h('i', { class: `dot s-${st}` }),
    h('div', { class: 'grow' },
      h('div', { class: 'pc-name' }, c.name),
      h('div', { class: 'pc-l' }, h('span', { class: 'k' }, '你'), h('span', { class: st === 'na' ? 'na' : '' }, you)),
      h('div', { class: 'pc-l' }, h('span', { class: 'k' }, '标准'), h('span', {}, c.std)),
      st === 'warn' && c.cue ? h('div', { class: 'pc-cue' }, `「${c.cue}」`) : null));
}

function line(ctx, a, b) {
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.stroke();
}

function paint(cv, r, hand) {
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  if (!r?.ok) return;
  const kp = r.kp;
  const ok = (j) => kp[j] && kp[j][2] >= THR;
  const t = Math.max(2, cv.height / 220);
  const dom = new Set(hand === 'left' ? DOM.map((j) => j - 1) : DOM);
  ctx.lineCap = 'round';
  for (const f of r.fix || []) {
    ctx.setLineDash([t * 4, t * 3]);
    for (const g of f.guides) {
      if (g.kind === 'bone' && g.p) {
        ctx.save();
        ctx.setLineDash([]);
        ctx.strokeStyle = C.green;
        ctx.lineWidth = t * 1.8;
        ctx.globalAlpha = 0.85;
        line(ctx, g.p[0], g.p[1]);
        ctx.restore();
        continue;
      }
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = t;
      if (g.p) for (let i = 1; i < g.p.length; i++) line(ctx, g.p[i - 1], g.p[i]);
      if (g.c) {
        ctx.beginPath();
        ctx.arc(g.c[0], g.c[1], g.r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);
  }
  for (const [a, b] of EDGES) {
    if (!ok(a) || !ok(b)) continue;
    ctx.strokeStyle = dom.has(a) && dom.has(b) ? C.dom : !dom.has(a) && !dom.has(b) ? C.off : C.mid;
    ctx.lineWidth = t;
    line(ctx, kp[a], kp[b]);
  }
  for (let j = 5; j < 17; j++) {
    if (!ok(j)) continue;
    ctx.fillStyle = dom.has(j) ? C.dom : C.off;
    ctx.beginPath();
    ctx.arc(kp[j][0], kp[j][1], t * 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const f of r.fix || []) {
    const g = f.ghost;
    const at = (j) => g[j] || kp[j];
    const focus = new Set(f.focus);
    ctx.strokeStyle = C.green;
    ctx.lineWidth = t * 1.8;
    ctx.globalAlpha = 0.85;
    for (const [a, b] of EDGES) {
      if ((g[a] || g[b]) && (g[a] || focus.has(a)) && (g[b] || focus.has(b))) line(ctx, at(a), at(b));
    }
    ctx.fillStyle = C.green;
    for (const p of Object.values(g)) {
      ctx.beginPath();
      ctx.arc(p[0], p[1], t * 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = t;
    for (const [i, [a, b]] of f.arrows.entries()) {
      const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (d < 8) continue;
      const u = [(b[0] - a[0]) / d, (b[1] - a[1]) / d];
      const hl = Math.min(t * 5, d * 0.5);
      line(ctx, a, b);
      ctx.beginPath();
      ctx.moveTo(b[0], b[1]);
      ctx.lineTo(b[0] - u[0] * hl - u[1] * hl * 0.5, b[1] - u[1] * hl + u[0] * hl * 0.5);
      ctx.lineTo(b[0] - u[0] * hl + u[1] * hl * 0.5, b[1] - u[1] * hl - u[0] * hl * 0.5);
      ctx.closePath();
      ctx.fillStyle = '#fff';
      ctx.fill();
      if (i || !f.label) continue;
      const fs = Math.round(cv.height / 26);
      ctx.font = `600 ${fs}px system-ui, -apple-system, sans-serif`;
      const tw = ctx.measureText(f.label).width;
      const x = (a[0] + b[0]) / 2 + (u[1] > 0 ? -1 : 1) * (tw / 2 + fs * 0.6) - tw / 2 - fs * 0.35;
      const y = (a[1] + b[1]) / 2 - fs * 0.7;
      ctx.fillStyle = C.ink;
      ctx.beginPath();
      ctx.roundRect(x, y, tw + fs * 0.7, fs * 1.4, fs * 0.35);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(f.label, x + fs * 0.35, y + fs * 1.05);
    }
  }
}

export async function posecheckView() {
  const [poses, cat, settings, sessions] = await Promise.all([
    api('/api/posecheck/poses'), catalog(), api('/api/settings').catch(() => ({})), api('/api/sessions').catch(() => []),
  ]);
  const hand = settings.handedness === 'left' ? 'left' : 'right';
  const last = sessions.find((s) => VIEWS.some(([v]) => v === s.view));
  const st = { pose: poses[0].key, view: last?.view || 'back_high', phase: 'idle', frac: 0, res: null, err: '' };
  const live = { on: false, stream: null, ok: false, gen: 0 };
  let xhr = null;
  const poseOf = () => poses.find((p) => p.key === st.pose);
  const itemsOf = (p) => p.items.filter((c) => !c.side || st.view === 'side');

  const pick = (capture) => {
    const inp = h('input', { type: 'file', accept: 'image/*,video/*', hidden: true, capture: capture ? 'environment' : null, onchange: () => {
      if (inp.files[0]) send(inp.files[0]);
      inp.value = '';
    } });
    return inp;
  };
  const camIn = pick(true);
  const libIn = pick(false);

  const node = h('div', { class: 'pc' });
  const body = h('div', { class: 'pc-body' });
  const zoom = h('div', { class: 'pc-zoom', hidden: true, onclick: () => { zoom.hidden = true; } });
  const onKey = (e) => e.key === 'Escape' && (zoom.hidden = true);
  addEventListener('keydown', onKey);

  const send = (file) => {
    stopLive();
    xhr?.abort();
    if (file.size > 300 * 1024 * 1024) {
      Object.assign(st, { phase: 'err', err: '文件太大' });
      draw();
      return;
    }
    const fd = new FormData();
    fd.append('pose', st.pose);
    fd.append('view', st.view);
    fd.append('file', file, file.name || 'photo.jpg');
    const x = new XMLHttpRequest();
    xhr = x;
    Object.assign(st, { phase: 'up', frac: 0, res: null, err: '' });
    draw();
    x.open('POST', '/api/posecheck');
    x.upload.onprogress = (e) => {
      if (e.lengthComputable && xhr === x) {
        st.frac = e.loaded / e.total;
        draw();
      }
    };
    x.upload.onload = () => {
      if (xhr !== x) return;
      st.phase = 'busy';
      draw();
    };
    x.onload = () => {
      if (xhr !== x) return;
      let r = null;
      try {
        r = JSON.parse(x.responseText);
      } catch {}
      if (x.status === 200 && r?.ok) Object.assign(st, { phase: 'done', res: r });
      else Object.assign(st, { phase: 'err', err: (x.status === 200 ? r?.error : typeof r?.detail === 'string' ? r.detail : '') || (x.status === 401 ? '没有权限' : '分析失败') });
      xhr = null;
      draw();
    };
    x.onerror = () => {
      if (xhr !== x) return;
      Object.assign(st, { phase: 'err', err: '上传失败' });
      xhr = null;
      draw();
    };
    x.send(fd);
  };

  const stopLive = () => {
    live.on = false;
    live.stream?.getTracks().forEach((t) => t.stop());
    live.stream = null;
  };

  const startLive = async () => {
    xhr?.abort();
    xhr = null;
    try {
      live.stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    } catch {
      Object.assign(st, { phase: 'err', err: '打不开摄像头' });
      draw();
      return;
    }
    live.on = true;
    live.ok = false;
    st.phase = 'live';
    draw();
  };

  const liveBody = () => {
    const video = h('video', { autoplay: true, muted: true, playsinline: true });
    video.srcObject = live.stream;
    const cv = h('canvas', {});
    const stage = h('div', { class: 'pc-stage' }, video, cv, h('div', { class: 'pc-pass' }, '✓'));
    const list = h('div', { class: 'list' }, itemsOf(poseOf()).map((c) => chkRow({ ...c, status: 'na' }, true)));
    const grab = document.createElement('canvas');
    const pose = poseOf();
    const my = ++live.gen;
    const loop = async () => {
      while (live.on && live.gen === my) {
        if (video.readyState < 2 || !video.videoWidth) {
          await new Promise((r) => setTimeout(r, 100));
          continue;
        }
        const k = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
        grab.width = Math.round(video.videoWidth * k);
        grab.height = Math.round(video.videoHeight * k);
        stage.style.aspectRatio = `${grab.width} / ${grab.height}`;
        grab.getContext('2d').drawImage(video, 0, 0, grab.width, grab.height);
        const blob = await new Promise((r) => grab.toBlob(r, 'image/jpeg', 0.75));
        let r = null;
        try {
          const resp = await fetch(`/api/posecheck/frame?pose=${encodeURIComponent(pose.key)}&view=${encodeURIComponent(st.view)}`, { method: 'POST', body: blob, headers: { 'content-type': 'image/jpeg' } });
          r = resp.ok ? await resp.json() : null;
        } catch {}
        if (!live.on || live.gen !== my) return;
        if (!r) {
          await new Promise((res) => setTimeout(res, 300));
          continue;
        }
        cv.width = r.size[0];
        cv.height = r.size[1];
        paint(cv, r, hand);
        const checks = r.ok ? r.checks : [];
        list.replaceChildren(...itemsOf(pose).map((c) => chkRow(checks.find((x) => x.id === c.id) || { ...c, status: 'na' }, true)));
        const ev = checks.filter((c) => c.status === 'good' || c.status === 'warn');
        const pass = ev.length > 0 && ev.every((c) => c.status === 'good');
        if (pass && !live.ok) {
          stage.classList.remove('flash');
          void stage.offsetWidth;
          stage.classList.add('flash');
        }
        if (!pass) stage.classList.remove('flash');
        live.ok = pass;
        stage.classList.toggle('ok', pass);
      }
    };
    video.addEventListener('loadedmetadata', () => video.play().catch(() => {}), { once: true });
    loop();
    return [h('div', { class: 'pc-res' }, stage, list)];
  };

  const resultBody = () => {
    const r = st.res;
    const pose = poseOf();
    const img = h('img', { src: r.image, alt: '', onclick: () => {
      zoom.replaceChildren(h('img', { src: r.image, alt: '' }));
      zoom.hidden = false;
    } });
    return [h('div', { class: 'pc-res' },
      h('div', { class: 'pc-pair' },
        h('figure', { class: 'pc-shot' }, img, h('figcaption', {}, r.t != null ? `你 · ${r.t.toFixed(1)} s` : '你')),
        h('figure', { class: 'pc-std' }, stdFig(cat, pose, r.view, r.hand, 200, r.checks.filter((c) => c.status === 'warn').map((c) => c.id)), h('figcaption', {}, '标准'))),
      h('div', { class: 'list pc-list' }, r.checks.map((c) => chkRow(c))))];
  };

  const idleBody = () => {
    const pose = poseOf();
    return [h('div', { class: 'card pc-idle' },
      h('div', { class: 'pc-fig' }, stdFig(cat, pose, st.view, hand, 180, [])),
      h('ul', { class: 'pc-items' }, itemsOf(pose).map((c) => h('li', {}, h('b', {}, c.name), h('span', {}, c.std)))))];
  };

  const draw = () => {
    const busy = st.phase === 'up' || st.phase === 'busy';
    node.replaceChildren(
      h('h1', { class: 'h1' }, '自查'),
      h('div', { class: 'pc-poses' }, poses.map((p) => h('button', {
        class: `pc-chip${p.key === st.pose ? ' on' : ''}`, onclick: () => {
          if (p.key === st.pose) return;
          st.pose = p.key;
          if (st.phase !== 'live') Object.assign(st, { phase: 'idle', res: null });
          draw();
        },
      }, h('span', { class: 'pc-cf' }, poseFigure({ catalog: cat, pose: p.key, view: st.view, hand, size: 52 })), h('span', {}, p.name)))),
      h('div', { class: 'seg full pc-views' }, VIEWS.map(([v, label]) => h('button', {
        class: st.view === v ? 'on' : '', onclick: () => {
          if (st.view === v) return;
          st.view = v;
          if (st.phase !== 'live') Object.assign(st, { phase: 'idle', res: null });
          draw();
        },
      }, label))),
      h('div', { class: 'pc-acts' },
        h('button', { class: 'btn primary', disabled: busy, onclick: () => camIn.click() }, '拍照'),
        h('button', { class: 'btn', disabled: busy, onclick: () => libIn.click() }, '相册'),
        CAM ? h('button', { class: `btn${st.phase === 'live' ? ' on' : ''}`, disabled: busy, onclick: () => {
          if (st.phase === 'live') {
            stopLive();
            st.phase = 'idle';
            draw();
          } else startLive();
        } }, st.phase === 'live' ? '关闭' : '摄像头') : null),
      camIn, libIn, body, zoom);
    body.replaceChildren(...(
      st.phase === 'up' ? [h('div', { class: 'card pc-prog' }, h('div', { class: 'l' }, h('span', {}, '上传'), h('span', {}, `${Math.round(st.frac * 100)}%`)),
        h('div', { class: 'bar' }, h('i', { style: { width: `${Math.round(st.frac * 100)}%` } })))]
        : st.phase === 'busy' ? [h('div', { class: 'card pc-prog busy' }, h('div', { class: 'spin' }), h('span', {}, '分析中'))]
          : st.phase === 'err' ? [h('div', { class: 'card pc-err' }, st.err)]
            : st.phase === 'done' ? resultBody()
              : st.phase === 'live' ? liveBody()
                : idleBody()));
  };

  draw();
  return {
    node,
    leave: () => {
      removeEventListener('keydown', onKey);
      stopLive();
      xhr?.abort();
      xhr = null;
    },
  };
}
