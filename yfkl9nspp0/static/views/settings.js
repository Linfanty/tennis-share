import { h, api, toast } from '../util.js';

const TIPS = [
  '底线后方高处固定机位，全程录制',
  '横屏 1080p，60 fps 以上',
  '全身入镜，发球时头顶留空',
  '每次加拍 10 分钟侧面：高 1–1.2 m，距 4–6 m，120 fps',
  '快门 1/500 s 或更快',
  '每次位置、高度、焦段保持一致',
];

const OPTS = {
  handedness: [['right', '右手'], ['left', '左手']],
  backhand: [['auto', '自动'], ['one', '单手'], ['two', '双手']],
  view: [['auto', '自动'], ['back_high', '背面'], ['side', '侧面']],
  ai_model: [['sonnet', 'Sonnet'], ['opus', 'Opus'], ['haiku', 'Haiku']],
};

export async function settingsView() {
  const info = await api('/api/info');
  let st = info.settings || {};
  const save = async (patch) => {
    try {
      st = await api('/api/settings', { method: 'PUT', json: patch });
    } catch {
      toast('保存失败');
    }
    draw();
  };
  const seg = (key, cur = st[key], set = (v) => save({ [key]: v })) => h('div', { class: 'seg' }, OPTS[key].map(([v, label]) =>
    h('button', { class: cur === v ? 'on' : '', onclick: () => cur !== v && set(v) }, label)));
  const rows = (p, set) => [
    h('div', { class: 'row' }, h('span', {}, '持拍手'), seg('handedness', p.handedness || 'right', (v) => set({ handedness: v }))),
    h('div', { class: 'row' }, h('span', {}, '反手'), seg('backhand', p.backhand || 'auto', (v) => set({ backhand: v }))),
  ];
  const people = () => {
    const ps = st.players || [];
    const put = (i, patch) => save({ players: ps.map((q, j) => (j === i ? { ...q, ...patch } : q)) });
    const inp = h('input', { type: 'text', class: 'name', maxlength: '20', placeholder: '名字' });
    const add = () => {
      const n = inp.value.trim();
      const base = ps.length ? ps : [{ name: '我', handedness: st.handedness, backhand: st.backhand }];
      if (!n || base.some((p) => p.name === n)) return toast(n ? '已有这个名字' : '先填名字');
      save({ players: [...base, { name: n }] });
    };
    const addRow = h('div', { class: 'list' }, h('div', { class: 'row' }, inp, h('button', { class: 'btn', onclick: add }, '添加球员')));
    if (!ps.length) return [h('div', { class: 'list' }, rows(st, save)), addRow];
    return [...ps.map((p, i) => h('div', { class: 'list' }, h('div', { class: 'row' }, h('b', {}, p.name)), rows(p, (patch) => put(i, patch)))), addRow];
  };
  const sw = () => {
    const inp = h('input', { type: 'checkbox', role: 'switch', 'aria-label': 'AI 点评' });
    inp.checked = !!st.ai;
    inp.addEventListener('change', () => save({ ai: inp.checked }));
    return h('label', { class: 'switch' }, inp, h('i'));
  };
  const node = h('div', { class: 'narrow' });
  const draw = () => node.replaceChildren(
    h('h1', { class: 'h1' }, '设置'),
    h('section', { class: 'sec form people' }, h('h2', { class: 'sec-h' }, '球员'), people()),
    h('section', { class: 'sec form' }, h('h2', { class: 'sec-h' }, 'AI 点评'), h('div', { class: 'list' },
      h('div', { class: 'row' }, h('span', {}, '自动点评'), sw()),
      h('div', { class: 'row' }, h('span', {}, '模型'), seg('ai_model')))),
    h('section', { class: 'sec form people' }, h('h2', { class: 'sec-h' }, '拍摄'),
      h('div', { class: 'list' }, h('div', { class: 'row' }, h('span', {}, '机位'), seg('view'))),
      h('div', { class: 'list' }, h('ol', { class: 'tips' }, TIPS.map((t) => h('li', {}, t))))),
    h('section', { class: 'sec qrsec' }, h('h2', { class: 'sec-h' }, '手机访问'),
      h('div', { class: 'list' }, info.lan_urls?.length
        ? info.lan_urls.slice(0, 1).map((u, i) => h('div', { class: 'qr' }, h('div', { class: 'code', html: info.qr[i] }), h('div', { class: 'url' }, u)))
        : h('div', { class: 'row sub' }, '未连接局域网'))),
    h('div', { class: 'foot' }, `版本 ${info.version}`));
  draw();
  return { node };
}
