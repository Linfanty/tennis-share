import { h, api, media, fmtDate, fmtDur, countsLine, progressOf, toast, store, playerSeg } from '../util.js';

const uploads = [];
let uploading = false;
let onUploadChange = null;

function sendFile(u) {
  return new Promise((resolve) => {
    const fd = new FormData();
    fd.append('files', u.file, u.file.name);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', u.player ? `/api/upload?player=${encodeURIComponent(u.player)}` : '/api/upload');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        u.frac = e.loaded / e.total;
        onUploadChange?.();
      }
    };
    xhr.onload = () => {
      u.state = xhr.status === 200 ? 'done' : 'error';
      resolve();
    };
    xhr.onerror = () => {
      u.state = 'error';
      resolve();
    };
    xhr.send(fd);
  });
}

async function startUploads(files, player) {
  for (const file of files) uploads.push({ file, frac: 0, state: 'wait', player });
  onUploadChange?.();
  if (uploading) return;
  uploading = true;
  for (let u; (u = uploads.find((x) => x.state === 'wait')); ) {
    u.state = 'up';
    onUploadChange?.();
    await sendFile(u);
    if (u.state === 'error') toast('上传失败');
    onUploadChange?.(true);
  }
  uploading = false;
  for (let i = uploads.length - 1; i >= 0; i--) if (uploads[i].state === 'done') uploads.splice(i, 1);
  onUploadChange?.(true);
}

function uploadRows() {
  return uploads.map((u) =>
    h('div', { class: 'up' },
      h('div', { class: 'l' }, h('span', {}, u.player ? `${u.player} · ${u.file.name}` : u.file.name),
        h('span', {}, u.state === 'error' ? '失败' : u.state === 'wait' ? '等待' : u.state === 'done' ? '完成' : `${Math.round(u.frac * 100)}%`)),
      h('div', { class: 'bar' }, h('i', { style: { width: `${Math.round((u.state === 'done' ? 1 : u.frac) * 100)}%` } }))));
}

export function card(it, who) {
  const busy = it.status === 'queued' || it.status === 'processing';
  const p = progressOf(it.progress);
  const state = it.status === 'error' ? '分析失败' : busy ? (it.status === 'queued' ? '排队中' : p.label || '分析中') : countsLine(it.counts) || '没有击球';
  const sub = who && it.player ? `${it.player} · ${state}` : state;
  const issue = it.top_issue?.name;
  return h('a', { class: 'scard', href: it.href || `#/s/${encodeURIComponent(it.id)}` },
    it.src || it.thumb ? h('img', { class: 'thumb', src: it.src || media(it.id, it.thumb), alt: '', loading: 'lazy', onerror: (e) => e.target.replaceWith(h('div', { class: 'thumb' })) }) : h('div', { class: 'thumb' }),
    h('div', { class: 'grow' },
      h('div', { class: 't1' }, h('span', {}, fmtDate(it.recorded_at || it.created_at)), h('span', {}, fmtDur(it.duration))),
      h('div', { class: 't2' }, sub),
      busy ? h('div', { class: 'bar' }, h('i', { style: { width: `${Math.round(p.frac * 100)}%` } }))
        : issue ? h('div', { class: 't3' }, h('i', { class: 'dot s-warn' }), issue) : null));
}

export async function listView() {
  let [items, st] = await Promise.all([api('/api/sessions'), api('/api/settings').catch(() => ({}))]);
  const names = (st.players || []).map((p) => p.name);
  const multi = names.length > 1;
  let sel = multi && names.includes(store.get('tc_player')) ? store.get('tc_player') : '';
  let target = null;
  const input = h('input', { type: 'file', accept: 'video/*', multiple: true, hidden: true, onchange: () => {
    if (input.files.length) startUploads([...input.files], target);
    input.value = '';
  } });
  const choose = h('div', { class: 'choose', hidden: true }, h('span', { class: 'sub' }, '上传给'),
    names.map((n) => h('button', { class: 'btn', onclick: () => {
      target = n;
      choose.hidden = true;
      input.click();
    } }, n)));
  const upload = () => {
    if (multi && !sel) {
      choose.hidden = !choose.hidden;
      return;
    }
    target = sel || null;
    input.click();
  };
  const segBox = h('div', { class: 'who' });
  const upBox = h('div', { class: 'uploads' });
  const listBox = h('div', { class: 'sessions' });
  const draw = () => {
    segBox.replaceChildren(...(multi ? [playerSeg(names, sel, (v) => {
      sel = v;
      store.set('tc_player', v);
      choose.hidden = true;
      draw();
    }, true)] : []));
    const shown = sel ? items.filter((x) => x.player === sel) : items;
    upBox.replaceChildren(...uploadRows());
    listBox.replaceChildren(...(shown.length ? shown.map((it) => card(it, multi && !sel)) : uploads.length ? [] : [h('div', { class: 'empty' }, '还没有训练')]));
  };
  const node = h('div', {},
    h('div', { class: 'listhead' },
      h('h1', { class: 'h1' }, '训练'),
      h('button', { class: 'btn primary big', style: { marginTop: '16px' }, onclick: upload }, '上传视频')),
    choose, segBox, input, upBox, listBox);
  draw();
  let alive = true;
  let timer;
  const refresh = async () => {
    try {
      items = await api('/api/sessions');
    } catch {}
    if (alive) draw();
  };
  const poll = () => {
    clearTimeout(timer);
    const busy = uploading || items.some((x) => x.status === 'queued' || x.status === 'processing');
    timer = setTimeout(async () => {
      await refresh();
      if (alive) poll();
    }, busy ? 1500 : 6000);
  };
  onUploadChange = (finished) => {
    if (!alive) return;
    if (finished) refresh();
    else upBox.replaceChildren(...uploadRows());
    poll();
  };
  poll();
  return { node, leave: () => { alive = false; clearTimeout(timer); onUploadChange = null; } };
}
