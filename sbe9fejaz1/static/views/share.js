import { h, api, toast, fmtDate } from '../util.js';

export function openShare(s) {
  const url = `/api/sessions/${encodeURIComponent(s.id)}/share`;
  let st = null;
  let timer;
  let alive = true;
  const body = h('div', { class: 'sh-body' });
  const onKey = (e) => e.key === 'Escape' && close();
  const close = () => {
    alive = false;
    clearTimeout(timer);
    removeEventListener('keydown', onKey);
    removeEventListener('hashchange', close);
    wrap.classList.remove('on');
    setTimeout(() => wrap.remove(), 250);
  };
  const sheet = h('div', { class: 'sh-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': '分享' },
    h('div', { class: 'sh-head' }, h('b', {}, '分享'), h('button', { class: 'sh-x', 'aria-label': '关闭', onclick: close })),
    body);
  const wrap = h('div', { class: 'sh-wrap', onclick: (e) => e.target === wrap && close() }, sheet);

  const load = async () => {
    try {
      st = await api(url);
    } catch {
      st = { state: 'error', error: '加载失败' };
    }
    draw();
  };
  const act = async (method) => {
    try {
      st = await api(url, { method });
    } catch (e) {
      st = { state: 'error', error: e.status === 409 ? '分析未完成' : '稍后再试' };
    }
    draw();
  };
  const copy = async (link) => {
    try {
      await navigator.clipboard.writeText(st.url);
      toast('已复制');
    } catch {
      getSelection().selectAllChildren(link);
      toast('已选中');
    }
  };
  const stop = () => confirm('停止分享？') && act('DELETE');

  function draw() {
    clearTimeout(timer);
    if (!alive) return;
    const state = st?.state || 'none';
    if (state === 'publishing') {
      body.replaceChildren(h('div', { class: 'sh-prog' }, h('div', { class: 'spin' }), h('span', {}, st.progress || '发布中')));
      timer = setTimeout(load, 2000);
    } else if (state === 'ready') {
      const link = h('a', { class: 'sh-url', href: st.url, target: '_blank', rel: 'noopener' }, st.url);
      body.replaceChildren(
        st.qr ? h('div', { class: 'sh-qr', html: st.qr }) : null,
        link,
        st.published_at ? h('div', { class: 'sh-time' }, `更新于 ${fmtDate(st.published_at, true)}`) : null,
        h('button', { class: 'btn primary big', onclick: () => copy(link) }, '复制链接'),
        h('div', { class: 'sh-row' },
          h('button', { class: 'btn', onclick: () => act('POST') }, '更新'),
          h('button', { class: 'btn sh-stop', onclick: stop }, '停止分享')));
    } else if (state === 'error') {
      body.replaceChildren(
        h('div', { class: 'sh-err' }, st.error || '失败'),
        h('button', { class: 'btn primary big', onclick: () => act(st.op === 'unpublish' ? 'DELETE' : 'POST') }, '重试'));
    } else {
      body.replaceChildren(h('button', { class: 'btn primary big', onclick: () => act('POST') }, '生成链接'));
    }
  }

  body.append(h('div', { class: 'sh-prog' }, h('div', { class: 'spin' })));
  document.body.append(wrap);
  requestAnimationFrame(() => requestAnimationFrame(() => wrap.classList.add('on')));
  addEventListener('keydown', onKey);
  addEventListener('hashchange', close);
  load();
  return { close };
}
