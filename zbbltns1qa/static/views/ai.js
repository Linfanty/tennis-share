import { h, api, toast, SHARE } from '../util.js';

function content(ai) {
  if (typeof ai === 'string') return [h('p', {}, ai)];
  const out = [];
  const text = ai.text || ai.summary || ai.comment;
  if (typeof text === 'string') out.push(h('p', {}, text));
  if (ai.highlight) out.push(h('p', {}, ai.highlight));
  const items = (ai.top_issues || ai.issues || []).map((x) => (typeof x === 'string' ? x : x.coach_text || x.text)).filter(Boolean);
  if (items.length) out.push(h('ul', {}, items.map((t) => h('li', {}, t))));
  if (ai.cue) out.push(h('p', {}, h('b', {}, ai.cue)));
  if (ai.drill) out.push(h('p', { class: 'q' }, typeof ai.drill === 'string' ? ai.drill : [ai.drill.name, ai.drill.how].filter(Boolean).join('　')));
  const cj = ai.cannot_judge || [];
  if (cj.length) out.push(h('p', { class: 'q' }, `看不清：${cj.join('、')}`));
  return out;
}

const usable = (ai) => ai && !ai.error && ai.source !== 'template' && (typeof ai === 'string' || ai.text || ai.summary || ai.comment || ai.highlight || ai.cue || (ai.top_issues || []).length);

export function aiBlock({ sid, stroke = null, data, running, error }) {
  const node = h('section', { class: 'sec ai' });
  let timer;
  let alive = true;
  const draw = (ai, busy, err) => {
    if (usable(ai)) node.replaceChildren(h('h2', { class: 'sec-h' }, 'AI 点评'), h('div', { class: 'card' }, content(ai)));
    else if (SHARE) node.replaceChildren();
    else if (busy) node.replaceChildren(h('div', { class: 'card prog' }, h('div', { class: 'spin' }), h('div', { class: 'grow' }, 'AI 点评生成中')));
    else node.replaceChildren(...[
      err ? h('div', { style: { margin: '0 0 8px 4px', color: 'var(--muted)', fontSize: '14px' } }, err) : null,
      h('button', { class: 'btn big', onclick: trigger }, 'AI 点评')].filter(Boolean));
  };
  const poll = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      try {
        const s = await api(`/api/sessions/${encodeURIComponent(sid)}`);
        if (!alive) return;
        const ai = stroke == null ? s.ai : (s.strokes || []).find((k) => k.id === stroke)?.ai;
        draw(ai, s.ai_running, s.ai_error || ai?.error);
        if (s.ai_running) poll();
      } catch {
        if (alive) poll();
      }
    }, 3000);
  };
  async function trigger() {
    try {
      await api(`/api/sessions/${encodeURIComponent(sid)}/ai`, { method: 'POST', json: stroke == null ? {} : { stroke } });
      draw(null, true);
      poll();
    } catch (e) {
      toast(e.status === 409 ? '正在处理' : '暂不可用');
    }
  }
  draw(data, running, error || data?.error);
  return { node, poll, stop: () => { alive = false; clearTimeout(timer); } };
}
