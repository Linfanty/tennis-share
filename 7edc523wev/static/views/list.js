import { h, api, media, fmtDate, fmtDur, countsLine, progressOf, toast } from '../util.js';

const uploads = [];
let uploading = false;
let onUploadChange = null;

function sendFile(u) {
  return new Promise((resolve) => {
    const fd = new FormData();
    fd.append('files', u.file, u.file.name);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');
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

async function startUploads(files) {
  for (const file of files) uploads.push({ file, frac: 0, state: 'wait' });
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
      h('div', { class: 'l' }, h('span', {}, u.file.name),
        h('span', {}, u.state === 'error' ? '失败' : u.state === 'wait' ? '等待' : u.state === 'done' ? '完成' : `${Math.round(u.frac * 100)}%`)),
      h('div', { class: 'bar' }, h('i', { style: { width: `${Math.round((u.state === 'done' ? 1 : u.frac) * 100)}%` } }))));
}

function card(it) {
  const busy = it.status === 'queued' || it.status === 'processing';
  const p = progressOf(it.progress);
  const sub = it.status === 'error' ? '分析失败' : busy ? (it.status === 'queued' ? '排队中' : p.label || '分析中') : countsLine(it.counts) || '没有击球';
  const issue = it.top_issue?.name;
  return h('a', { class: 'scard', href: `#/s/${encodeURIComponent(it.id)}` },
    it.thumb ? h('img', { class: 'thumb', src: media(it.id, it.thumb), alt: '', loading: 'lazy', onerror: (e) => e.target.replaceWith(h('div', { class: 'thumb' })) }) : h('div', { class: 'thumb' }),
    h('div', { class: 'grow' },
      h('div', { class: 't1' }, h('span', {}, fmtDate(it.recorded_at || it.created_at)), h('span', {}, fmtDur(it.duration))),
      h('div', { class: 't2' }, sub),
      busy ? h('div', { class: 'bar' }, h('i', { style: { width: `${Math.round(p.frac * 100)}%` } }))
        : issue ? h('div', { class: 't3' }, h('i', { class: 'dot s-warn' }), issue) : null));
}

export async function listView() {
  let items = await api('/api/sessions');
  const input = h('input', { type: 'file', accept: 'video/*', multiple: true, hidden: true, onchange: () => {
    if (input.files.length) startUploads([...input.files]);
    input.value = '';
  } });
  const upBox = h('div', { class: 'uploads' });
  const listBox = h('div', { class: 'sessions' });
  const draw = () => {
    upBox.replaceChildren(...uploadRows());
    listBox.replaceChildren(...(items.length ? items.map(card) : uploads.length ? [] : [h('div', { class: 'empty' }, '还没有训练')]));
  };
  const node = h('div', {},
    h('div', { class: 'listhead' },
      h('h1', { class: 'h1' }, '训练'),
      h('button', { class: 'btn primary big', style: { marginTop: '16px' }, onclick: () => input.click() }, '上传视频')),
    input, upBox, listBox);
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
