import { listView } from './views/list.js';
import { detailView } from './views/detail.js';
import { strokeView } from './views/stroke.js';
import { trendsView } from './views/trends.js';
import { settingsView } from './views/settings.js';
import { posecheckView } from './views/posecheck.js';
import { SHARE } from './util.js';

const app = document.getElementById('app');
let cleanup = null;

if (SHARE) {
  document.documentElement.classList.add('share');
  document.getElementById('tabs').hidden = true;
}

const routes = SHARE ? [
  [/^#\/s\/[^/]+\/k\/(\d+)$/, '', (m) => strokeView(SHARE.sid, Number(m[1]))],
  [/^/, '', () => detailView(SHARE.sid)],
] : [
  [/^#?\/?$/, 'list', () => listView()],
  [/^#\/s\/([^/]+)$/, 'list', (m) => detailView(decodeURIComponent(m[1]))],
  [/^#\/s\/([^/]+)\/k\/(\d+)$/, 'list', (m) => strokeView(decodeURIComponent(m[1]), Number(m[2]))],
  [/^#\/trends$/, 'trends', () => trendsView()],
  [/^#\/check$/, 'check', () => posecheckView()],
  [/^#\/settings$/, 'settings', () => settingsView()],
];

let seq = 0;

async function render() {
  if (cleanup) cleanup();
  cleanup = null;
  const my = ++seq;
  const hash = (location.hash || '#/').split('?')[0];
  const [re, tab, fn] = routes.find(([r]) => r.test(hash)) || routes[0];
  document.querySelectorAll('#tabs a').forEach((a) => a.classList.toggle('on', a.dataset.tab === tab));
  try {
    const view = await fn(hash.match(re) || []);
    if (my !== seq) {
      view?.leave?.();
      return;
    }
    app.replaceChildren(view.node);
    cleanup = view.leave || null;
  } catch (e) {
    console.error(e);
    if (my === seq) app.replaceChildren(Object.assign(document.createElement('div'), { className: 'empty', textContent: e.status === 404 ? '找不到' : '加载失败' }));
  }
}

const wantTheme = new URLSearchParams(location.hash.split('?')[1] || '').get('theme');
if (wantTheme) document.documentElement.dataset.theme = wantTheme;
addEventListener('hashchange', () => {
  render();
  scrollTo(0, 0);
});
render();
