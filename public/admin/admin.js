/* Dt Amna Transformation — admin panel (vanilla JS, no build step) */
const { sectionTypes, settingsFields, assessmentFields } = window.SCHEMAS;

// ------------------------------------------------------------------ helpers
const $ = (sel, root = document) => root.querySelector(sel);

// Safe DOM builder: strings become text nodes, never HTML
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}
const icon = cls => h('i', { class: cls });
const fmtNum = n => Number(n || 0).toLocaleString();
const fmtDate = ts => ts ? new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const fmtDateTime = ts => new Date(ts).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const clone = o => JSON.parse(JSON.stringify(o));

async function api(path, opts = {}) {
  const res = await fetch('/api/admin' + path, {
    method: opts.method || 'GET',
    headers: { 'X-Requested-With': 'admin', ...(opts.body && !(opts.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}) },
    body: opts.body instanceof FormData ? opts.body : opts.body ? JSON.stringify(opts.body) : undefined
  });
  if (res.status === 401 && !path.startsWith('/login')) { showAuth(false); throw new Error('Please log in again'); }
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  if (!res.ok) throw new Error(data?.error || 'Request failed');
  return data;
}

let toastTimer;
function toast(msg, isErr = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast show' + (isErr ? ' err' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.className = 'toast', 2800);
}
const run = fn => async (...a) => { try { await fn(...a); } catch (e) { toast(e.message, true); } };

function openModal(title, body) {
  $('#modalTitle').textContent = title;
  $('#modalBody').replaceChildren(body);
  $('#modal').hidden = false;
}
const closeModal = () => { $('#modal').hidden = true; $('#modalBody').replaceChildren(); };
$('#modalClose').onclick = closeModal;
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });

function setPage(title, actions = []) {
  $('#pageTitle').textContent = title;
  $('#pageActions').replaceChildren(...actions);
}

// Unsaved-changes guard for editors
let dirty = false;
const markDirty = () => { dirty = true; };
window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

// ------------------------------------------------------------------ auth
let needsSetup = false;
function showAuth(setup) {
  needsSetup = setup;
  $('#app').hidden = true;
  $('#auth').hidden = false;
  $('#authTitle').textContent = setup ? 'Create your admin account' : 'Admin login';
  $('#authSub').textContent = setup ? 'First-time setup: choose the username and password you will use to manage the website.' : 'Sign in to manage your website.';
  $('#authConfirmWrap').hidden = !setup;
  $('#authBtn').textContent = setup ? 'Create account' : 'Log in';
  $('#authForm').password.autocomplete = setup ? 'new-password' : 'current-password';
}
$('#authForm').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;
  $('#authErr').textContent = '';
  if (needsSetup && f.password.value !== f.confirm.value) { $('#authErr').textContent = 'Passwords do not match'; return; }
  try {
    await api(needsSetup ? '/setup' : '/login', { method: 'POST', body: { username: f.username.value, password: f.password.value } });
    f.reset();
    startApp();
  } catch (err) { $('#authErr').textContent = err.message; }
});
$('#logoutBtn').onclick = run(async () => { await api('/logout', { method: 'POST' }); showAuth(false); });

async function boot() {
  const me = await fetch('/api/admin/me').then(r => r.json());
  if (me.user) startApp(); else showAuth(me.needsSetup);
}
function startApp() {
  $('#auth').hidden = true;
  $('#app').hidden = false;
  refreshBadge();
  route();
}
async function refreshBadge() {
  try {
    const o = await api('/overview');
    $('#leadBadge').hidden = !o.unreadLeads;
    $('#leadBadge').textContent = o.unreadLeads;
  } catch {}
}

// ------------------------------------------------------------------ router
const setSidebar = open => { $('#sidebar').classList.toggle('open', open); $('#backdrop').classList.toggle('show', open); };
$('#menuBtn').onclick = () => setSidebar(!$('#sidebar').classList.contains('open'));
$('#backdrop').onclick = () => setSidebar(false);
window.addEventListener('hashchange', () => {
  if (dirty && !confirm('You have unsaved changes. Leave without saving?')) {
    history.back();
    return;
  }
  dirty = false;
  route();
});

// Clicking the menu item of the page you're already on reloads it (hashchange doesn't fire)
document.querySelectorAll('[data-nav]').forEach(a => a.addEventListener('click', e => {
  if (a.getAttribute('href') === location.hash) { e.preventDefault(); route(); }
}));

const charts = [];
let refreshTimer;
function route() {
  clearInterval(refreshTimer);
  refreshTimer = null;
  charts.splice(0).forEach(c => c.destroy());
  setSidebar(false);
  const [name = 'analytics', arg] = location.hash.replace(/^#\/?/, '').split('/');
  document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === name));
  const view = $('#view');
  view.replaceChildren(h('p', { class: 'muted' }, 'Loading…'));
  const views = { analytics: viewAnalytics, sections: arg ? viewSectionEdit : viewSections, blog: arg ? viewPostEdit : viewBlog, assessment: viewAssessment, media: viewMedia, leads: viewLeads, settings: viewSettings, theme: viewTheme };
  run(views[name] || viewAnalytics)(view, arg);
}

// ================================================================== ANALYTICS
let range = 30;
const SOURCE_COLORS = {
  Instagram: '#d62976', Facebook: '#1877f2', TikTok: '#111111', WhatsApp: '#25d366', YouTube: '#ff0000',
  'X / Twitter': '#555555', LinkedIn: '#0a66c2', Snapchat: '#f7d600', Pinterest: '#e60023',
  Google: '#34a853', Bing: '#008373', Email: '#8b5cf6', Direct: '#9aa0ae', 'Other websites': '#b9737a'
};
const colorFor = (s, i) => SOURCE_COLORS[s] || ['#4a1d3f', '#b9737a', '#6f8f5f', '#c0623a', '#5b7aa6', '#c9a227'][i % 6];

function delta(cur, prev) {
  if (!prev && !cur) return h('span', { class: 'delta flat' }, 'No data yet');
  if (!prev) return h('span', { class: 'delta up' }, 'New this period');
  const p = Math.round((cur - prev) / prev * 100);
  return h('span', { class: 'delta ' + (p > 0 ? 'up' : p < 0 ? 'down' : 'flat') },
    (p > 0 ? '▲ ' : p < 0 ? '▼ ' : '') + Math.abs(p) + '% vs previous ' + range + ' days');
}

function kpi(label, ic, value, cur, prev, highlight) {
  return h('div', { class: 'kpi' + (highlight ? ' kpi--highlight' : '') },
    h('div', { class: 'kpi__label' }, icon(ic), label),
    h('div', { class: 'kpi__value' }, value),
    delta(cur, prev));
}

function insights(r) {
  const out = [];
  const k = r.kpis;
  const top = r.sources[0];
  if (top) out.push(['fa-solid fa-trophy', `${top.source} brought the most visitors: ${fmtNum(top.sessions)} visits (${Math.round(top.sessions / Math.max(k.sessions, 1) * 100)}% of all traffic).`]);
  const conv = r.sources.filter(s => s.sessions >= 3 && s.conversions).sort((a, b) => b.conversions / b.sessions - a.conversions / a.sessions)[0];
  if (conv) out.push(['fa-solid fa-bullseye', `${conv.source} visitors are most likely to book or enquire — ${Math.round(conv.conversions / conv.sessions * 100)}% of them took action. Focus your posting there.`]);
  const social = r.sources.filter(s => s.social).reduce((a, s) => a + s.sessions, 0);
  if (k.sessions) out.push(['fa-solid fa-share-nodes', `${Math.round(social / k.sessions * 100)}% of visits came from social media.`]);
  const post = r.posts.find(p => p.views);
  if (post) out.push(['fa-solid fa-book-open', `Most read article: “${post.title}” — ${fmtNum(post.views)} views, ${post.readRate}% read to the end.`]);
  const click = r.clicks[0];
  if (click) out.push(['fa-solid fa-hand-pointer', `Most clicked: “${click.label || click.target}” (${fmtNum(click.clicks)} clicks).`]);
  const mob = r.devices.find(d => d.device === 'Mobile');
  const totalDev = r.devices.reduce((a, d) => a + d.sessions, 0);
  if (mob && totalDev) out.push(['fa-solid fa-mobile-screen', `${Math.round(mob.sessions / totalDev * 100)}% of visitors use a phone — always check new content on mobile.`]);
  const direct = r.sources.find(s => s.source === 'Direct');
  if (direct && k.sessions && direct.sessions / k.sessions > 0.4) out.push(['fa-solid fa-lightbulb', 'Many visits show as “Direct” — Instagram and WhatsApp often hide where visitors came from. Use the tracking links below in your bio and posts so they are counted correctly.']);
  if (!out.length) out.push(['fa-solid fa-hourglass-half', 'Not enough data yet. Insights appear here once people start visiting the website.']);
  return h('ul', { class: 'insights' }, out.map(([i, t]) => h('li', {}, icon(i), h('span', {}, t))));
}

function tableCard(title, cols, rows, emptyMsg) {
  return h('div', { class: 'card' },
    h('div', { class: 'card__head' }, h('h3', {}, title)),
    rows.length
      ? h('div', { class: 'table-wrap' }, h('table', {},
          h('thead', {}, h('tr', {}, cols.map(c => h('th', { class: c.num ? 'num' : '' }, c.label)))),
          h('tbody', {}, rows.map(r => h('tr', {}, cols.map(c => h('td', { class: c.num ? 'num' : '', 'data-label': c.num ? c.label : '' }, c.render(r))))))))
      : h('div', { class: 'empty' }, emptyMsg || 'No data yet'));
}

function utmBuilder() {
  const base = location.origin + '/';
  const input = h('input', { readonly: true, value: base + '?utm_source=instagram' });
  const sel = h('select', { style: { width: 'auto' }, onchange: () => { input.value = base + '?utm_source=' + sel.value; } },
    ['instagram', 'facebook', 'tiktok', 'whatsapp', 'youtube', 'email'].map(s => h('option', { value: s }, s)));
  return h('div', { class: 'card' },
    h('div', { class: 'card__head' }, h('h3', {}, 'Tracking links for your social media')),
    h('p', { class: 'muted small', style: { marginBottom: '12px' } }, 'Put these links in your Instagram bio, stories, Facebook posts and WhatsApp messages. Visits from them are always counted under the right platform, even when the app hides it.'),
    h('div', { class: 'utm' }, sel, input,
      h('button', { class: 'btn btn--sm', onclick: () => { navigator.clipboard.writeText(input.value); toast('Link copied'); } }, icon('fa-regular fa-copy'), 'Copy')));
}

// Re-draw in place (keeps scroll position, no "Loading…" flash)
const refreshAnalytics = run(async () => {
  const y = window.scrollY;
  const view = $('#view');
  view.style.minHeight = view.offsetHeight + 'px'; // hold the page height while re-drawing
  const old = charts.splice(0);
  try {
    await viewAnalytics(view); // only swaps content once the new numbers have arrived
    old.forEach(c => c.destroy());
    window.scrollTo(0, y);
  } finally { view.style.minHeight = ''; }
});

async function viewAnalytics(view) {
  setPage('Analytics', [
    h('span', { class: 'muted small', style: { alignSelf: 'center' } }, 'Updated ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })),
    h('button', { class: 'btn btn--ghost', onclick: refreshAnalytics }, icon('fa-solid fa-rotate-right'), 'Refresh')
  ]);
  if (!refreshTimer) refreshTimer = setInterval(() => {
    if (document.visibilityState === 'visible' && /^#?\/?(analytics)?$/.test(location.hash.replace(/^#/, ''))) refreshAnalytics();
  }, 60000);
  const r = await api(`/analytics?days=${range}&tz=${new Date().getTimezoneOffset()}`);
  const k = r.kpis, p = r.previous;

  const seg = h('div', { class: 'seg' }, [7, 30, 90, 365].map(d =>
    h('button', { class: d === range ? 'active' : '', onclick: () => { range = d; route(); } }, d === 365 ? '1 year' : d + ' days')));

  const lineCanvas = h('canvas');
  const srcCanvas = h('canvas');
  const devCanvas = h('canvas');
  const maxPost = Math.max(...r.posts.map(x => x.views), 1);
  const maxClick = Math.max(...r.clicks.map(x => x.clicks), 1);

  view.replaceChildren(
    h('div', { class: 'toolbar' }, seg, h('span', { class: 'live' }, `${r.live} on the website right now`)),
    h('p', { class: 'muted small', style: { margin: '-8px 0 18px' } }, icon('fa-solid fa-circle-info'),
      ' Your own visits are not counted while you are logged in here. To test, open the website in a private / incognito window. “Blog views” counts people opening an article.'),
    h('div', { class: 'kpis' },
      kpi('Visitors', 'fa-solid fa-users', fmtNum(k.visitors), k.visitors, p.visitors),
      kpi('Page views', 'fa-regular fa-eye', fmtNum(k.pageviews), k.pageviews, p.pageviews),
      kpi('From social media', 'fa-solid fa-share-nodes', fmtNum(k.socialSessions), k.socialSessions, p.socialSessions),
      kpi('Booking / WhatsApp clicks', 'fa-regular fa-calendar-check', fmtNum(k.bookingClicks), k.bookingClicks, p.bookingClicks),
      kpi('Form leads', 'fa-regular fa-envelope', fmtNum(k.leads), k.leads, p.leads),
      kpi('Conversion rate', 'fa-solid fa-bullseye', k.conversionRate + '%', k.conversionRate, p.conversionRate, true),
      kpi('Blog views', 'fa-solid fa-book-open', fmtNum(k.postViews), k.postViews, p.postViews),
      kpi('Assessments completed', 'fa-solid fa-clipboard-check', fmtNum(k.assessDone), k.assessDone, p.assessDone),
      kpi('BMI calculations', 'fa-solid fa-calculator', fmtNum(k.bmiUses), k.bmiUses, p.bmiUses)
    ),
    h('div', { class: 'grid grid--3' },
      h('div', { class: 'card' }, h('div', { class: 'card__head' }, h('h3', {}, 'Visitors over time')), h('div', { class: 'chart-box' }, lineCanvas)),
      h('div', { class: 'card' }, h('div', { class: 'card__head' }, h('h3', {}, 'Key insights')), insights(r))
    ),
    h('div', { class: 'grid grid--3 mt' },
      tableCard('Where visitors come from', [
        { label: 'Source', render: s => h('span', {}, h('span', { class: 'dot', style: { background: colorFor(s.source, 0) } }), s.source, s.social ? h('span', { class: 'pill pill--blue', style: { marginLeft: '8px' } }, 'social') : null) },
        { label: 'Visits', num: true, render: s => fmtNum(s.sessions) },
        { label: 'Share', num: true, render: s => Math.round(s.sessions / Math.max(k.sessions, 1) * 100) + '%' },
        { label: 'Booked / enquired', num: true, render: s => fmtNum(s.conversions) },
        { label: 'Conv. rate', num: true, render: s => s.sessions ? Math.round(s.conversions / s.sessions * 100) + '%' : '—' }
      ], r.sources, 'No visits yet in this period'),
      h('div', { class: 'card' }, h('div', { class: 'card__head' }, h('h3', {}, 'Traffic sources')), h('div', { class: 'chart-box chart-box--sm' }, srcCanvas))
    ),
    h('div', { class: 'grid grid--2 mt' },
      tableCard('Most read blog posts', [
        { label: 'Post', render: x => h('a', { href: '/blog/' + x.slug, target: '_blank', class: 'truncate', style: { display: 'block' } }, x.title) },
        { label: 'Views', num: true, render: x => fmtNum(x.views) },
        { label: 'Readers', num: true, render: x => fmtNum(x.readers) },
        { label: 'Read to end', num: true, render: x => x.readRate + '%' },
        { label: '', render: x => h('div', { class: 'bar' }, h('span', { style: { width: x.views / maxPost * 100 + '%' } })) }
      ], r.posts.filter(x => x.views), 'No blog views yet'),
      tableCard('Most clicked links & buttons', [
        { label: 'Link / button', render: x => h('div', {}, h('div', { class: 'truncate' }, x.label || '(no text)'), h('div', { class: 'muted small truncate' }, x.target || '')) },
        { label: 'Clicks', num: true, render: x => fmtNum(x.clicks) },
        { label: 'People', num: true, render: x => fmtNum(x.visitors) },
        { label: '', render: x => h('div', { class: 'bar' }, h('span', { style: { width: x.clicks / maxClick * 100 + '%' } })) }
      ], r.clicks, 'No clicks yet')
    ),
    h('div', { class: 'grid grid--3 mt' },
      tableCard('Top pages', [
        { label: 'Page', render: x => h('span', { class: 'truncate', style: { display: 'block' } }, x.path) },
        { label: 'Views', num: true, render: x => fmtNum(x.views) },
        { label: 'Visitors', num: true, render: x => fmtNum(x.visitors) }
      ], r.pages),
      h('div', { class: 'card' }, h('div', { class: 'card__head' }, h('h3', {}, 'Devices')), h('div', { class: 'chart-box chart-box--sm' }, devCanvas))
    ),
    r.referrers.length ? h('div', { class: 'mt' }, tableCard('Other websites linking to you', [
      { label: 'Website', render: x => x.referrer }, { label: 'Visits', num: true, render: x => fmtNum(x.visits) }
    ], r.referrers)) : null,
    h('div', { class: 'mt' }, utmBuilder())
  );

  if (!window.Chart) return;
  Chart.defaults.font.family = 'Poppins';
  Chart.defaults.color = '#6b7180';
  charts.push(new Chart(lineCanvas, {
    type: 'line',
    data: {
      labels: r.daily.map(d => new Date(d.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })),
      datasets: [
        { label: 'Visitors', data: r.daily.map(d => d.visitors), borderColor: '#f28c38', backgroundColor: 'rgba(242,140,56,.12)', fill: true, tension: .35, pointRadius: 0, pointHoverRadius: 5 },
        { label: 'Page views', data: r.daily.map(d => d.pageviews), borderColor: '#3b82f6', backgroundColor: 'transparent', tension: .35, pointRadius: 0, pointHoverRadius: 5, borderDash: [5, 4] }
      ]
    },
    options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false }, ticks: { maxTicksLimit: 10 } } }, plugins: { legend: { position: 'bottom' } } }
  }));
  const doughnut = (canvas, labels, data, colors) => charts.push(new Chart(canvas, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }] },
    options: { maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } } }
  }));
  if (r.sources.length) doughnut(srcCanvas, r.sources.map(s => s.source), r.sources.map(s => s.sessions), r.sources.map((s, i) => colorFor(s.source, i)));
  else srcCanvas.parentNode.replaceChildren(h('div', { class: 'empty' }, 'No data yet'));
  if (r.devices.length) doughnut(devCanvas, r.devices.map(d => d.device), r.devices.map(d => d.sessions), ['#f28c38', '#3b82f6', '#18a058']);
  else devCanvas.parentNode.replaceChildren(h('div', { class: 'empty' }, 'No data yet'));
}

// ================================================================== MEDIA PICKER
function pickImage() {
  return new Promise(resolve => {
    const grid = h('div', { class: 'media-grid' });
    const render = items => grid.replaceChildren(...(items.length ? items.map(m =>
      h('div', { class: 'media-item pickable', onclick: () => { closeModal(); resolve(m.url); } },
        h('img', { src: m.url, alt: m.original || '', loading: 'lazy' }),
        h('div', { class: 'media-item__bar' }, h('span', {}, m.original || m.filename)))) : [h('div', { class: 'empty' }, 'No photos yet — upload one above.')]));
    const zone = dropzone(async files => {
      const added = await uploadFiles(files);
      if (added.length === 1) { closeModal(); resolve(added[0].url); }
      else render(await api('/media'));
    });
    openModal('Choose a photo', h('div', {}, zone, grid));
    api('/media').then(render);
  });
}

// Shrink big photos in the browser (max 2000px, WebP) so uploads stay fast and under the 4 MB limit
async function prepareImage(file) {
  if (!/^image\/(jpeg|png|webp|avif)$/.test(file.type)) return file;
  const MAX = 2000;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(r => canvas.toBlob(r, 'image/webp', 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.webp', { type: 'image/webp' });
  } catch { return file; }
}

async function uploadFiles(files) {
  const list = [...files];
  const added = [];
  for (const [i, f] of list.entries()) {
    toast(`Uploading ${list.length > 1 ? `${i + 1} of ${list.length}` : 'photo'}…`);
    const fd = new FormData();
    fd.append('files', await prepareImage(f));
    added.push(...await api('/media', { method: 'POST', body: fd }));
  }
  toast(`${added.length} photo${added.length > 1 ? 's' : ''} uploaded`);
  return added;
}

function dropzone(onFiles) {
  const input = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/gif,image/avif', multiple: true, hidden: true,
    onchange: run(async () => { if (input.files.length) await onFiles(input.files); input.value = ''; }) });
  const z = h('div', { class: 'dropzone', onclick: () => input.click() },
    icon('fa-solid fa-cloud-arrow-up'), h('strong', {}, 'Click to upload'), ' or drag photos here',
    h('div', { class: 'small' }, 'JPG, PNG, WebP or GIF — large photos are resized automatically'), input);
  z.addEventListener('dragover', e => { e.preventDefault(); z.classList.add('drag'); });
  z.addEventListener('dragleave', () => z.classList.remove('drag'));
  z.addEventListener('drop', run(async e => { e.preventDefault(); z.classList.remove('drag'); await onFiles(e.dataTransfer.files); }));
  return z;
}

// ================================================================== FIELD EDITOR
const ICONS = ['fa-solid fa-weight-scale', 'fa-solid fa-venus', 'fa-solid fa-baby', 'fa-solid fa-heart-pulse', 'fa-solid fa-dumbbell',
  'fa-solid fa-bowl-food', 'fa-solid fa-apple-whole', 'fa-solid fa-carrot', 'fa-solid fa-fire', 'fa-solid fa-utensils', 'fa-solid fa-moon',
  'fa-solid fa-glass-water', 'fa-solid fa-leaf', 'fa-solid fa-person-running', 'fa-solid fa-spa', 'fa-solid fa-user-doctor',
  'fa-solid fa-stethoscope', 'fa-solid fa-star', 'fa-solid fa-heart', 'fa-solid fa-calendar-check', 'fa-solid fa-comments',
  'fa-solid fa-trophy', 'fa-solid fa-seedling', 'fa-solid fa-scale-balanced', 'fa-solid fa-mug-hot', 'fa-brands fa-whatsapp'];
const iconList = h('datalist', { id: 'iconList' }, ICONS.map(i => h('option', { value: i })));
document.body.append(iconList);

function imageField(obj, key) {
  const preview = h('div', { class: 'img-field__preview' });
  const update = () => {
    preview.style.backgroundImage = obj[key] ? `url("${String(obj[key]).replace(/["\\]/g, '')}")` : '';
    preview.replaceChildren(obj[key] ? '' : icon('fa-regular fa-image'));
    removeBtn.hidden = !obj[key];
  };
  const removeBtn = h('button', { type: 'button', class: 'btn btn--ghost btn--sm', onclick: () => { obj[key] = ''; markDirty(); update(); } }, 'Remove');
  const chooseBtn = h('button', { type: 'button', class: 'btn btn--sm', onclick: async () => { const url = await pickImage(); obj[key] = url; markDirty(); update(); } },
    icon('fa-solid fa-upload'), 'Upload / choose');
  const el = h('div', { class: 'img-field' }, preview, h('div', { class: 'img-field__btns' }, chooseBtn, removeBtn));
  update();
  return el;
}

function richField(obj, key, large) {
  const holder = h('div');
  const wrap = h('div', { class: large ? 'editor-lg' : '' }, holder);
  const q = new Quill(holder, {
    theme: 'snow',
    modules: { toolbar: { container: [[{ header: [2, 3, false] }], ['bold', 'italic', 'underline'], [{ list: 'ordered' }, { list: 'bullet' }], ['blockquote', 'link', 'image', 'video'], [{ align: [] }], ['clean']],
      handlers: { image: async () => { const url = await pickImage(); const range = q.getSelection(true); q.insertEmbed(range.index, 'image', url); } } } }
  });
  q.clipboard.dangerouslyPasteHTML(obj[key] || '');
  q.on('text-change', () => { obj[key] = q.root.innerHTML === '<p><br></p>' ? '' : q.root.innerHTML; markDirty(); });
  return wrap;
}

function fieldInput(f, obj) {
  const set = v => { obj[f.key] = v; markDirty(); };
  switch (f.type) {
    case 'textarea': return h('textarea', { rows: 3, value: obj[f.key] ?? '', oninput: e => set(e.target.value) });
    case 'richtext': return richField(obj, f.key);
    case 'image': return imageField(obj, f.key);
    case 'number': return h('input', { type: 'number', value: obj[f.key] ?? 0, oninput: e => set(e.target.value === '' ? 0 : Number(e.target.value)) });
    case 'color': return h('input', { type: 'color', value: obj[f.key] || '#f28c38', oninput: e => set(e.target.value) });
    case 'select': return h('select', { onchange: e => set(e.target.value) }, f.options.map(o => h('option', { value: o, selected: obj[f.key] === o }, o)));
    case 'icon': {
      const prev = h('i', { class: 'preview ' + (obj[f.key] || '') });
      return h('div', { class: 'icon-field' }, prev, h('input', { list: 'iconList', value: obj[f.key] ?? '', placeholder: 'fa-solid fa-star',
        oninput: e => { set(e.target.value); prev.className = 'preview ' + e.target.value; } }),
        h('a', { href: 'https://fontawesome.com/search?o=r&m=free', target: '_blank', class: 'small muted', style: { whiteSpace: 'nowrap' } }, 'Browse icons'));
    }
    default: return h('input', { type: 'text', value: obj[f.key] ?? '', oninput: e => set(e.target.value) });
  }
}

function listField(f, obj) {
  if (!Array.isArray(obj[f.key])) obj[f.key] = [];
  const arr = obj[f.key];
  const items = h('div', { style: { display: 'grid', gap: '10px' } });
  const blank = () => Object.fromEntries(f.fields.map(sf => [sf.key, sf.type === 'number' ? 0 : sf.type === 'checkbox' ? false : sf.type === 'list' ? [] : '']));
  const render = (openIndex = -1) => {
    items.replaceChildren(...arr.map((item, i) => {
      const title = h('strong', {}, item[f.itemLabel] || `Item ${i + 1}`);
      const body = h('div', { class: 'list-item__body' }, renderFields(f.fields, item, () => { title.textContent = item[f.itemLabel] || `Item ${i + 1}`; }));
      const box = h('div', { class: 'list-item' + (i === openIndex ? '' : ' collapsed') });
      const stop = fn => e => { e.stopPropagation(); fn(); };
      box.append(h('div', { class: 'list-item__head', onclick: () => box.classList.toggle('collapsed') },
        icon('fa-solid fa-chevron-down chev'), title,
        h('button', { type: 'button', class: 'icon-btn', title: 'Move up', disabled: i === 0, onclick: stop(() => { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; markDirty(); render(); }) }, icon('fa-solid fa-arrow-up')),
        h('button', { type: 'button', class: 'icon-btn', title: 'Move down', disabled: i === arr.length - 1, onclick: stop(() => { [arr[i + 1], arr[i]] = [arr[i], arr[i + 1]]; markDirty(); render(); }) }, icon('fa-solid fa-arrow-down')),
        h('button', { type: 'button', class: 'icon-btn', title: 'Duplicate', onclick: stop(() => { arr.splice(i + 1, 0, clone(item)); markDirty(); render(i + 1); }) }, icon('fa-regular fa-copy')),
        h('button', { type: 'button', class: 'icon-btn danger', title: 'Delete', onclick: stop(() => { if (confirm('Delete this item?')) { arr.splice(i, 1); markDirty(); render(); } }) }, icon('fa-regular fa-trash-can'))
      ), body);
      return box;
    }));
  };
  render();
  return h('div', { class: 'list-field' },
    h('div', { class: 'list-head' }, h('strong', {}, f.label, ' ', h('span', { class: 'muted small' }, `(${arr.length})`)),
      h('button', { type: 'button', class: 'btn btn--sm', onclick: () => { arr.push(blank()); markDirty(); render(arr.length - 1); } }, icon('fa-solid fa-plus'), 'Add')),
    items);
}

function renderFields(fields, obj, onChange) {
  const wrap = h('div', { class: 'fields' });
  if (onChange) wrap.addEventListener('input', onChange);
  let row = null;
  for (const f of fields) {
    let el;
    if (f.type === 'list') el = listField(f, obj);
    else if (f.type === 'checkbox') el = h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!obj[f.key], onchange: e => { obj[f.key] = e.target.checked; markDirty(); } }), f.label);
    else el = h('label', {}, h('span', {}, f.label, f.hint ? h('span', { class: 'hint' }, ' — ' + f.hint) : null), fieldInput(f, obj));
    // Pair short text inputs side by side
    const short = ['text', 'number', 'select', 'icon'].includes(f.type);
    if (short && row && row.childElementCount === 1) { row.append(el); row = null; continue; }
    if (short) { row = h('div', { class: 'field-row' }, el); wrap.append(row); }
    else { row = null; wrap.append(el); }
  }
  return wrap;
}

// ================================================================== SECTIONS
async function viewSections(view) {
  const list = await api('/sections');
  setPage('Page sections', [
    h('a', { class: 'btn btn--ghost', href: '/', target: '_blank' }, icon('fa-regular fa-eye'), 'Preview'),
    h('button', { class: 'btn', onclick: addSectionDialog }, icon('fa-solid fa-plus'), 'Add section')
  ]);
  const container = h('div', { class: 'sec-list' });
  const move = run(async (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    render();
    await api('/sections/reorder', { method: 'PUT', body: { ids: list.map(x => x.id) } });
    toast('Order saved');
    container.children[j]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
  const render = () => container.replaceChildren(...list.map((s, i) => {
    const t = sectionTypes[s.type] || { label: s.type };
    const name = [s.data.title, s.data.highlight].filter(Boolean).join(' ') || s.data.text || t.label;
    return h('div', { class: 'sec-item' + (s.enabled ? '' : ' off'), 'data-id': s.id },
      h('span', { class: 'handle', title: 'Drag to reorder' }, icon('fa-solid fa-grip-vertical')),
      h('div', { class: 'sec-item__info' },
        h('strong', {}, name),
        h('span', { class: 'muted small' }, t.label, s.navLabel ? ` · in menu as “${s.navLabel}”` : '', ' · #' + s.anchor)),
      h('div', { class: 'sec-item__actions' },
        h('span', { class: 'move-btns' },
          h('button', { class: 'icon-btn', title: 'Move up', 'aria-label': 'Move up', disabled: i === 0, onclick: () => move(i, -1) }, icon('fa-solid fa-arrow-up')),
          h('button', { class: 'icon-btn', title: 'Move down', 'aria-label': 'Move down', disabled: i === list.length - 1, onclick: () => move(i, 1) }, icon('fa-solid fa-arrow-down'))),
        h('label', { class: 'switch', title: s.enabled ? 'Visible — click to hide' : 'Hidden — click to show' },
          h('input', { type: 'checkbox', checked: s.enabled, onchange: run(async e => {
            s.enabled = e.target.checked; await api('/sections/' + s.id, { method: 'PUT', body: { enabled: s.enabled } });
            toast(s.enabled ? 'Section shown on website' : 'Section hidden'); render();
          }) }), h('span')),
        h('a', { class: 'btn btn--ghost btn--sm', href: '#/sections/' + s.id }, icon('fa-regular fa-pen-to-square'), 'Edit'),
        h('button', { class: 'icon-btn', title: 'Duplicate', onclick: run(async () => { await api(`/sections/${s.id}/duplicate`, { method: 'POST' }); toast('Section duplicated (hidden until you turn it on)'); route(); }) }, icon('fa-regular fa-copy')),
        h('button', { class: 'icon-btn danger', title: 'Delete', onclick: run(async () => {
          if (!confirm(`Delete the “${name}” section? This cannot be undone.`)) return;
          await api('/sections/' + s.id, { method: 'DELETE' }); toast('Section deleted'); route();
        }) }, icon('fa-regular fa-trash-can'))));
  }));
  render();
  view.replaceChildren(
    h('p', { class: 'muted', style: { marginBottom: '16px' } }, 'These are the sections of your home page, top to bottom. Drag the handle or use the up / down arrows to reorder, use the switch to show or hide, and click Edit to change text and photos.'),
    container);
  if (window.Sortable) Sortable.create(container, { handle: '.handle', animation: 150, onEnd: run(async () => {
    const ids = [...container.children].map(c => c.dataset.id);
    list.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
    await api('/sections/reorder', { method: 'PUT', body: { ids } });
    toast('Order saved');
  }) });
}

function addSectionDialog() {
  const labelInput = h('input', { placeholder: 'e.g. Testimonials — leave empty to keep it out of the menu' });
  const grid = h('div', { class: 'type-grid' }, Object.entries(sectionTypes).map(([type, t]) =>
    h('button', { class: 'type-card', 'data-type': type, onclick: run(async () => {
      const navLabel = labelInput.value.trim();
      const s = await api('/sections', { method: 'POST', body: { type, navLabel, anchor: navLabel || t.label, data: { title: t.label } } });
      closeModal();
      toast('Section added at the bottom of the page');
      location.hash = '#/sections/' + s.id;
    }) }, h('strong', {}, t.label), h('p', {}, t.description))));
  openModal('Add a new section', h('div', { class: 'fields' },
    h('label', {}, '1. Name in the top menu (optional)', labelInput),
    h('label', {}, '2. Choose the type of section'),
    grid));
}

async function viewSectionEdit(view, id) {
  const s = await api('/sections').then(l => l.find(x => x.id === id));
  if (!s) { view.replaceChildren(h('div', { class: 'empty' }, 'Section not found')); return; }
  const t = sectionTypes[s.type];
  const meta = { navLabel: s.navLabel, anchor: s.anchor };
  const save = run(async () => {
    await api('/sections/' + s.id, { method: 'PUT', body: { ...meta, data: s.data } });
    dirty = false;
    toast('Saved — changes are live on the website');
  });
  setPage('Edit: ' + t.label, [
    h('a', { class: 'btn btn--ghost', href: '#/sections' }, icon('fa-solid fa-arrow-left'), 'Back'),
    h('a', { class: 'btn btn--ghost', href: '/#' + s.anchor, target: '_blank' }, icon('fa-regular fa-eye'), 'View'),
    h('button', { class: 'btn', onclick: save }, icon('fa-regular fa-floppy-disk'), 'Save')
  ]);
  view.replaceChildren(
    h('div', { class: 'editor-layout' },
      h('div', { class: 'card' }, renderFields(t.fields, s.data)),
      h('div', { class: 'card sticky' },
        h('div', { class: 'card__head' }, h('h3', {}, 'Section options')),
        h('div', { class: 'fields' },
          h('label', {}, h('span', {}, 'Show in top menu as', h('span', { class: 'hint' }, ' — leave empty to hide from menu')),
            h('input', { value: meta.navLabel, oninput: e => { meta.navLabel = e.target.value; markDirty(); } })),
          h('label', {}, h('span', {}, 'Section link name', h('span', { class: 'hint' }, ' — used in links like #programs')),
            h('input', { value: meta.anchor, oninput: e => { meta.anchor = e.target.value; markDirty(); } }))),
        h('p', { class: 'muted small mt' }, t.description),
        h('button', { class: 'btn btn--block mt', onclick: save }, icon('fa-regular fa-floppy-disk'), 'Save changes'))));
  document.onkeydown = e => { if ((e.ctrlKey || e.metaKey) && e.key === 's' && location.hash.startsWith('#/sections/')) { e.preventDefault(); save(); } };
}

// ================================================================== BLOG
async function viewBlog(view) {
  const posts = await api('/posts');
  setPage('Blog', [
    h('a', { class: 'btn btn--ghost', href: '/blog', target: '_blank' }, icon('fa-regular fa-eye'), 'View blog'),
    h('a', { class: 'btn', href: '#/blog/new' }, icon('fa-solid fa-plus'), 'New post')
  ]);
  if (!posts.length) {
    view.replaceChildren(h('div', { class: 'card empty' }, icon('fa-solid fa-pen-nib'), 'No posts yet. ', h('a', { href: '#/blog/new', style: { color: 'var(--primary)' } }, 'Write your first post')));
    return;
  }
  view.replaceChildren(h('div', { class: 'card' }, h('div', { class: 'table-wrap' }, h('table', {},
    h('thead', {}, h('tr', {}, h('th', {}, ''), h('th', {}, 'Title'), h('th', {}, 'Status'), h('th', {}, 'Date'), h('th', { class: 'num' }, ''))),
    h('tbody', {}, posts.map(p => {
      const scheduled = p.status === 'published' && p.publishedAt > Date.now();
      return h('tr', {},
        h('td', { style: { width: '70px' } }, h('div', { class: 'img-field__preview', style: { width: '56px', height: '42px', backgroundImage: p.cover ? `url("${p.cover}")` : '' } }, p.cover ? '' : icon('fa-regular fa-image'))),
        h('td', {}, h('a', { href: '#/blog/' + p.id }, h('strong', {}, p.title)), h('div', { class: 'muted small truncate' }, '/blog/' + p.slug)),
        h('td', {}, h('span', { class: 'pill ' + (scheduled ? 'pill--blue' : p.status === 'published' ? 'pill--green' : 'pill--orange') }, scheduled ? 'Scheduled' : p.status === 'published' ? 'Published' : 'Draft')),
        h('td', { class: 'muted' }, fmtDate(p.publishedAt || p.updatedAt)),
        h('td', { class: 'num' },
          h('a', { class: 'icon-btn', href: '/blog/' + p.slug, target: '_blank', title: 'View' }, icon('fa-regular fa-eye')), ' ',
          h('a', { class: 'icon-btn', href: '#/blog/' + p.id, title: 'Edit' }, icon('fa-regular fa-pen-to-square')), ' ',
          h('button', { class: 'icon-btn danger', title: 'Delete', onclick: run(async () => {
            if (!confirm(`Delete “${p.title}”? This cannot be undone.`)) return;
            await api('/posts/' + p.id, { method: 'DELETE' }); toast('Post deleted'); route();
          }) }, icon('fa-regular fa-trash-can'))));
    }))))));
}

const toLocalInput = ts => { if (!ts) return ''; const d = new Date(ts); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

async function viewPostEdit(view, id) {
  const isNew = id === 'new';
  const post = isNew ? { title: '', slug: '', excerpt: '', cover: '', content: '', tags: '', status: 'draft', publishedAt: null } : await api('/posts/' + id);
  const save = status => run(async () => {
    if (!post.title.trim()) { toast('Please add a title', true); return; }
    const saved = await api(isNew ? '/posts' : '/posts/' + id, { method: isNew ? 'POST' : 'PUT', body: { ...post, status: status || post.status } });
    dirty = false;
    toast(saved.status === 'published' ? 'Published — the post is live' : 'Draft saved');
    if (isNew) location.hash = '#/blog/' + saved.id; else route();
  });
  setPage(isNew ? 'New blog post' : 'Edit post', [
    h('a', { class: 'btn btn--ghost', href: '#/blog' }, icon('fa-solid fa-arrow-left'), 'Back'),
    !isNew ? h('a', { class: 'btn btn--ghost', href: '/blog/' + post.slug, target: '_blank' }, icon('fa-regular fa-eye'), 'Preview') : null
  ]);

  const titleInput = h('input', { value: post.title, placeholder: 'Post title', style: { fontSize: '20px', fontWeight: '600', padding: '12px 14px' }, oninput: e => { post.title = e.target.value; markDirty(); } });
  const dateInput = h('input', { type: 'datetime-local', value: toLocalInput(post.publishedAt), onchange: e => { post.publishedAt = e.target.value ? new Date(e.target.value).getTime() : null; markDirty(); } });
  const statusPill = h('span', { class: 'pill ' + (post.status === 'published' ? 'pill--green' : 'pill--orange') }, post.status === 'published' ? 'Published' : 'Draft');

  view.replaceChildren(h('div', { class: 'editor-layout' },
    h('div', { class: 'card fields' },
      titleInput,
      h('label', {}, 'Content'),
      richField(post, 'content', true)),
    h('div', { class: 'sticky' },
      h('div', { class: 'card fields' },
        h('div', { class: 'card__head', style: { marginBottom: 0 } }, h('h3', {}, 'Publish'), statusPill),
        h('label', {}, h('span', {}, 'Publish date', h('span', { class: 'hint' }, ' — set a future date to schedule')), dateInput),
        post.status === 'published'
          ? h('div', { style: { display: 'grid', gap: '8px' } },
              h('button', { class: 'btn btn--block', onclick: save('published') }, icon('fa-regular fa-floppy-disk'), 'Update post'),
              h('button', { class: 'btn btn--ghost btn--block', onclick: save('draft') }, 'Unpublish (make draft)'))
          : h('div', { style: { display: 'grid', gap: '8px' } },
              h('button', { class: 'btn btn--block', onclick: save('published') }, icon('fa-solid fa-paper-plane'), 'Publish'),
              h('button', { class: 'btn btn--ghost btn--block', onclick: save('draft') }, 'Save draft'))),
      h('div', { class: 'card fields' },
        h('label', {}, 'Cover photo'), imageField(post, 'cover'),
        h('label', {}, h('span', {}, 'Short summary', h('span', { class: 'hint' }, ' — shown on blog cards and Google')),
          h('textarea', { rows: 3, value: post.excerpt, oninput: e => { post.excerpt = e.target.value; markDirty(); } })),
        h('label', {}, h('span', {}, 'Tags', h('span', { class: 'hint' }, ' — comma separated')),
          h('input', { value: post.tags, placeholder: 'fat loss, PCOS, recipes', oninput: e => { post.tags = e.target.value; markDirty(); } })),
        h('label', {}, h('span', {}, 'URL name', h('span', { class: 'hint' }, ' — auto-made from title if empty')),
          h('input', { value: post.slug, placeholder: 'my-post-title', oninput: e => { post.slug = e.target.value; markDirty(); } }))))));
}

// ================================================================== ASSESSMENT
function assessmentRows(l) {
  if (l.kind !== 'assessment' || !l.details) return [];
  let d;
  try { d = JSON.parse(l.details); } catch { return []; }
  return [
    h('div', { class: 'card mt', style: { boxShadow: 'none', display: 'grid', gap: '8px' } },
      h('div', {}, h('strong', {}, 'BMI: '), `${d.bmi} (${d.category}) — ${d.weightKg} kg, ${d.heightCm} cm`),
      ...(d.answers || []).map(a => h('div', {}, h('strong', {}, a.question + ' '), a.answer.length ? a.answer.join(', ') : '—')),
      h('div', {}, h('strong', {}, 'WhatsApp OK: '), d.whatsappConsent ? 'Yes' : 'No'))
  ];
}

async function viewAssessment(view) {
  const [config, stats] = await Promise.all([
    api('/assessment'),
    api(`/analytics?days=30&tz=${new Date().getTimezoneOffset()}`)
  ]);
  const save = run(async () => {
    const saved = await api('/assessment', { method: 'PUT', body: config });
    Object.assign(config, saved);
    dirty = false;
    toast('Saved — the assessment is updated on the website');
  });
  setPage('Free assessment', [
    h('a', { class: 'btn btn--ghost', href: '/assessment', target: '_blank' }, icon('fa-regular fa-eye'), 'Preview'),
    h('button', { class: 'btn', onclick: save }, icon('fa-regular fa-floppy-disk'), 'Save')
  ]);

  // Funnel: how many people reach each step (last 30 days)
  const f = stats.funnel || [];
  const started = (f.find(x => x.step === 'start') || {}).sessions || 0;
  const maxF = Math.max(started, ...f.map(x => x.sessions), 1);
  const funnel = h('div', { class: 'card' },
    h('div', { class: 'card__head' }, h('h3', {}, 'Last 30 days'),
      h('span', { class: 'muted small' }, `${fmtNum(stats.kpis.assessDone)} completed of ${fmtNum(started)} started` +
        (started ? ` (${Math.round(stats.kpis.assessDone / started * 100)}%)` : ''))),
    f.length
      ? h('div', { class: 'table-wrap' }, h('table', {}, h('tbody', {}, f.map(x => h('tr', {},
          h('td', {}, x.step === 'start' ? 'Pressed Start' : x.step === 'done' ? 'Saw their result' : (x.name || x.step)),
          h('td', { class: 'num' }, fmtNum(x.sessions)),
          h('td', { style: { width: '40%' } }, h('div', { class: 'bar' }, h('span', { style: { width: x.sessions / maxF * 100 + '%' } }))))))))
      : h('div', { class: 'empty' }, 'No one has taken the assessment yet. Share the link: ', h('a', { href: '/assessment', target: '_blank', style: { color: 'var(--primary)' } }, location.origin + '/assessment')));

  view.replaceChildren(
    h('p', { class: 'muted', style: { marginBottom: '16px' } },
      'Edit the questions, answers and result messages of your free assessment. The height & weight step and the contact step are always included. Completed assessments appear in Leads.'),
    h('div', { class: 'editor-layout' },
      h('div', { class: 'card' }, renderFields(assessmentFields, config)),
      h('div', { class: 'sticky' }, funnel,
        h('div', { class: 'card' }, h('div', { class: 'card__head' }, h('h3', {}, 'Link to share')),
          h('div', { class: 'utm' }, h('input', { readonly: true, value: location.origin + '/assessment?utm_source=instagram' }),
            h('button', { class: 'btn btn--sm', onclick: e => { navigator.clipboard.writeText(e.target.closest('.utm').querySelector('input').value); toast('Link copied'); } }, icon('fa-regular fa-copy'), 'Copy')),
          h('p', { class: 'muted small mt' }, 'Put this in your Instagram bio or stories.')),
        h('button', { class: 'btn btn--block mt', onclick: save }, icon('fa-regular fa-floppy-disk'), 'Save changes'))));
}

// ================================================================== MEDIA
async function viewMedia(view) {
  setPage('Photos & media');
  const grid = h('div', { class: 'media-grid' });
  const load = async () => {
    const items = await api('/media');
    grid.replaceChildren(...(items.length ? items.map(m => h('div', { class: 'media-item' },
      h('a', { href: m.url, target: '_blank' }, h('img', { src: m.url, alt: m.original || '', loading: 'lazy' })),
      h('div', { class: 'media-item__bar' },
        h('span', { title: m.original }, m.original || m.filename),
        h('span', { style: { display: 'flex', gap: '4px', flexShrink: 0 } },
          h('button', { class: 'icon-btn', title: 'Copy link', style: { width: '28px', height: '28px' }, onclick: () => { navigator.clipboard.writeText(location.origin + m.url); toast('Link copied'); } }, icon('fa-regular fa-copy')),
          h('button', { class: 'icon-btn danger', title: 'Delete', style: { width: '28px', height: '28px' }, onclick: run(async () => {
            if (!confirm('Delete this photo? Any section or post using it will show a placeholder.')) return;
            await api('/media/' + m.id, { method: 'DELETE' }); toast('Photo deleted'); load();
          }) }, icon('fa-regular fa-trash-can')))))) : [h('div', { class: 'empty' }, icon('fa-regular fa-images'), 'No photos uploaded yet')]));
  };
  view.replaceChildren(dropzone(async files => { await uploadFiles(files); load(); }), grid);
  await load();
}

// ================================================================== LEADS
async function viewLeads(view) {
  const leads = await api('/leads');
  setPage('Leads', [h('a', { class: 'btn btn--ghost', href: '/api/admin/leads.csv' }, icon('fa-solid fa-file-csv'), 'Download CSV')]);
  if (!leads.length) {
    view.replaceChildren(h('div', { class: 'card empty' }, icon('fa-regular fa-envelope'), 'No form submissions yet. When someone fills in the contact form on your website, it appears here.'));
    return;
  }
  const showLead = run(async l => {
    if (!l.is_read) { await api('/leads/' + l.id, { method: 'PUT', body: { read: true } }); l.is_read = 1; refreshBadge(); render(); }
    const row = (k, v) => v ? h('div', {}, h('strong', {}, k + ': '), v) : null;
    const wa = String(l.phone || '').replace(/\D/g, '');
    openModal(`${l.first} ${l.last}`.trim(), h('div', { class: 'lead-detail' },
      row('Received', fmtDateTime(l.created_at)), row('Email', l.email), row('Phone', l.phone), row('Country', l.country),
      row('Type', l.kind === 'assessment' ? 'Free assessment' : 'Contact form'),
      row('Program', l.program), row('Medical issue', l.medical), row('Came from', l.source),
      ...assessmentRows(l),
      l.message ? h('div', { class: 'card mt', style: { whiteSpace: 'pre-wrap', boxShadow: 'none' } }, l.message) : null,
      h('div', { class: 'mt', style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
        wa ? h('a', { class: 'btn', href: 'https://wa.me/' + wa, target: '_blank' }, icon('fa-brands fa-whatsapp'), 'WhatsApp') : null,
        l.email ? h('a', { class: 'btn btn--ghost', href: 'mailto:' + l.email }, icon('fa-regular fa-envelope'), 'Email') : null)));
  });
  const tbody = h('tbody');
  const render = () => tbody.replaceChildren(...leads.map(l => h('tr', { class: 'lead-row' + (l.is_read ? '' : ' unread') },
    h('td', {}, h('a', { href: 'javascript:void 0', onclick: () => showLead(l) }, h(l.is_read ? 'span' : 'strong', {}, `${l.first} ${l.last}`.trim())),
      h('div', { class: 'muted small' }, l.email)),
    h('td', { 'data-label': 'Phone' }, l.phone),
    h('td', {}, l.kind === 'assessment' ? h('span', { class: 'pill pill--orange', style: { marginRight: '6px' } }, 'Assessment') : null, l.program),
    h('td', { 'data-label': 'From' }, h('span', { class: 'pill pill--blue' }, l.source || '—')),
    h('td', { class: 'muted' }, fmtDateTime(l.created_at)),
    h('td', { class: 'num' },
      h('button', { class: 'icon-btn', title: l.is_read ? 'Mark unread' : 'Mark read', onclick: run(async () => {
        l.is_read = l.is_read ? 0 : 1; await api('/leads/' + l.id, { method: 'PUT', body: { read: !!l.is_read } }); refreshBadge(); render();
      }) }, icon(l.is_read ? 'fa-regular fa-envelope' : 'fa-regular fa-envelope-open')), ' ',
      h('button', { class: 'icon-btn danger', title: 'Delete', onclick: run(async () => {
        if (!confirm('Delete this lead?')) return;
        await api('/leads/' + l.id, { method: 'DELETE' }); leads.splice(leads.indexOf(l), 1); refreshBadge(); render();
      }) }, icon('fa-regular fa-trash-can'))))));
  render();
  view.replaceChildren(h('div', { class: 'card' }, h('div', { class: 'table-wrap' }, h('table', {},
    h('thead', {}, h('tr', {}, ['Name', 'Phone', 'Program', 'Came from', 'Received', ''].map(c => h('th', { class: c ? '' : 'num' }, c)))), tbody))));
}

// ================================================================== SETTINGS
async function viewSettings(view) {
  const s = await api('/settings');
  const save = run(async () => { await api('/settings', { method: 'PUT', body: s }); dirty = false; toast('Settings saved'); });
  setPage('Settings', [h('button', { class: 'btn', onclick: save }, icon('fa-regular fa-floppy-disk'), 'Save settings')]);
  const groups = [...new Set(settingsFields.map(f => f.group))].filter(g => g !== 'Theme');
  const account = { username: '', currentPassword: '', newPassword: '' };
  api('/me').then(me => { account.username = me.user.username; userInput.value = me.user.username; });
  const userInput = h('input', { autocomplete: 'username', oninput: e => { account.username = e.target.value; } });
  view.replaceChildren(
    h('div', { class: 'grid grid--2' }, groups.map(g => h('div', { class: 'card' },
      h('div', { class: 'card__head' }, h('h3', {}, g)),
      renderFields(settingsFields.filter(f => f.group === g), s)))),
    h('div', { class: 'card mt' },
      h('div', { class: 'card__head' }, h('h3', {}, 'Your admin account')),
      h('form', { class: 'fields', style: { maxWidth: '520px' }, onsubmit: run(async e => {
        e.preventDefault();
        await api('/account', { method: 'POST', body: account });
        e.target.reset(); userInput.value = account.username;
        toast('Account updated');
      }) },
        h('label', {}, 'Username', userInput),
        h('label', {}, 'Current password', h('input', { type: 'password', required: true, autocomplete: 'current-password', oninput: e => { account.currentPassword = e.target.value; } })),
        h('label', {}, h('span', {}, 'New password', h('span', { class: 'hint' }, ' — leave empty to keep, at least 8 characters')),
          h('input', { type: 'password', autocomplete: 'new-password', minlength: 8, oninput: e => { account.newPassword = e.target.value; } })),
        h('div', {}, h('button', { class: 'btn', type: 'submit' }, 'Update account')))));
}

// ================================================================== THEME
const THEME_COLORS = [
  ['themePaper', 'Page background', 'The main background of the website'],
  ['themePaper2', 'Soft background', 'Alternate panels and cards'],
  ['themeBlush', 'Blush accent', 'Banners and soft highlights'],
  ['themeRose', 'Highlight colour', 'Italic words, small numbers and links'],
  ['themePlum', 'Buttons & dark sections', 'Buttons, the dark BMI section, header button'],
  ['themeInk', 'Main text', 'Headings and body text'],
  ['themeMuted', 'Secondary text', 'Paragraphs, captions and labels'],
  ['themeDeep', 'Deepest dark', 'Footer and the darkest areas']
];
const THEME_PRESETS = [
  { name: 'Blush & Plum', v: {} },
  { name: 'Sage & Forest', v: { themePaper: '#eef1e8', themePaper2: '#dfe5d3', themeBlush: '#c9d6b8', themeRose: '#6f8f5f', themePlum: '#2f4a2f', themeInk: '#1c2a1c', themeDeep: '#142014', themeMuted: '#5c6b58' } },
  { name: 'Sand & Terracotta', v: { themePaper: '#f7efe3', themePaper2: '#eadcc6', themeBlush: '#e6c3a3', themeRose: '#c0623a', themePlum: '#6b2d1a', themeInk: '#2e1a12', themeDeep: '#211009', themeMuted: '#74604f' } },
  { name: 'Ivory & Navy', v: { themePaper: '#f5f3ee', themePaper2: '#e7e4da', themeBlush: '#cfd8e6', themeRose: '#5b7aa6', themePlum: '#1f2f54', themeInk: '#151d33', themeDeep: '#0e1424', themeMuted: '#5d6577' } }
];

async function viewTheme(view) {
  const T = window.THEME;
  const s = await api('/settings');
  const cur = {};
  for (const k of Object.keys(T.DEFAULTS)) cur[k] = s[k] || T.DEFAULTS[k];

  const preview = h('div', { class: 'tp' },
    h('p', { class: 'tp__label' }, 'Free tool · 01'),
    h('h2', { class: 'tp__title' }, 'Gain Confidence, ', h('em', {}, 'one plan at a time.')),
    h('p', { class: 'tp__text' }, 'Practical diet plans that fit real life, real food and real families.'),
    h('div', { class: 'tp__row' }, h('span', { class: 'tp__btn' }, 'Book a consultation →'), h('span', { class: 'tp__link' }, 'Start free assessment →')),
    h('div', { class: 'tp__band' }, 'Strength begins with a single step'),
    h('div', { class: 'tp__dark' }, h('strong', {}, '500+'), ' women coached'));
  const fontLink = h('link', { rel: 'stylesheet' });
  document.head.append(fontLink);
  const paint = () => {
    const t = T.resolve(cur);
    preview.style.cssText = T.themeCss(cur).replace(/^:root\{/, '').replace(/\}[^}]*$/, '');
    preview.style.fontSize = (t.scale / 100 * 16) + 'px';
    fontLink.href = T.fontsHref(cur);
  };
  const inputs = {};
  const set = (k, v) => { cur[k] = v; markDirty(); paint(); };

  const toHex = n => Math.max(0, Math.min(255, Math.round(Number(n) || 0))).toString(16).padStart(2, '0');
  const fromHex = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const colorRow = ([key, label, hint]) => {
    const sync = hex => {
      pick.value = text.value = hex;
      fromHex(hex).forEach((v, i) => { rgb[i].value = v; });
    };
    const pick = h('input', { type: 'color', value: cur[key], oninput: e => { sync(e.target.value); set(key, e.target.value); } });
    const text = h('input', { type: 'text', value: cur[key], maxlength: 7, class: 'hex', 'aria-label': label + ' hex', oninput: e => {
      if (/^#[0-9a-f]{6}$/i.test(e.target.value)) { const v = e.target.value.toLowerCase(); sync(v); set(key, v); }
    } });
    const rgb = ['R', 'G', 'B'].map((ch, i) => h('input', { type: 'number', min: 0, max: 255, value: fromHex(cur[key])[i], class: 'rgb', 'aria-label': label + ' ' + ch, title: ch, oninput: e => {
      if (e.target.value === '') return;
      const hex = '#' + rgb.map(r => toHex(r.value)).join('');
      pick.value = text.value = hex;
      set(key, hex);
    } }));
    inputs[key] = { sync };
    return h('div', { class: 'color-row' }, pick,
      h('div', { class: 'color-row__txt' }, h('strong', {}, label), h('span', { class: 'hint' }, hint)),
      h('div', { class: 'color-row__vals' }, text, h('div', { class: 'rgb-row' }, rgb.map((r, i) => h('label', { class: 'rgb-ch' }, h('span', {}, ['R', 'G', 'B'][i]), r)))));
  };
  const fontSelect = (key, list) => {
    const sel = h('select', { onchange: e => set(key, e.target.value) }, list.map(f => h('option', { value: f.name, selected: f.name === cur[key] }, f.name)));
    sel.dataset.key = key;
    return sel;
  };
  const scale = h('input', { type: 'range', min: 85, max: 125, step: 5, value: cur.themeTextScale });
  const scaleOut = h('strong', {}, cur.themeTextScale + '%');
  scale.oninput = () => { scaleOut.textContent = scale.value + '%'; set('themeTextScale', scale.value); };

  const apply = v => {
    Object.assign(cur, T.DEFAULTS, v);
    for (const [k, { sync }] of Object.entries(inputs)) sync(cur[k]);
    scale.value = cur.themeTextScale; scaleOut.textContent = cur.themeTextScale + '%';
    view.querySelectorAll('select[data-key]').forEach(sel => { sel.value = cur[sel.dataset.key]; });
    markDirty(); paint();
  };
  const save = run(async () => {
    const body = {};
    for (const k of Object.keys(T.DEFAULTS)) body[k] = cur[k];
    await api('/settings', { method: 'PUT', body });
    dirty = false; toast('Theme saved — your website is updated');
  });
  setPage('Edit theme', [
    h('button', { class: 'btn btn--ghost', onclick: () => { if (confirm('Reset all theme colours and fonts to the original design?')) apply({}); } }, icon('fa-solid fa-rotate-left'), 'Reset'),
    h('button', { class: 'btn', onclick: save }, icon('fa-regular fa-floppy-disk'), 'Save theme')
  ]);

  view.replaceChildren(h('div', { class: 'editor-layout' },
    h('div', {},
      h('div', { class: 'card' },
        h('div', { class: 'card__head' }, h('h3', {}, 'Ready-made palettes')),
        h('div', { class: 'preset-row' }, THEME_PRESETS.map(p => h('button', { class: 'preset', type: 'button', onclick: () => apply(p.v) },
          h('span', { class: 'preset__sw' }, ['themePaper', 'themeBlush', 'themeRose', 'themePlum'].map(k => h('i', { style: { background: p.v[k] || T.DEFAULTS[k] } }))), p.name)))),
      h('div', { class: 'card' },
        h('div', { class: 'card__head' }, h('h3', {}, 'Colours')),
        h('div', { class: 'color-list' }, THEME_COLORS.map(colorRow))),
      h('div', { class: 'card' },
        h('div', { class: 'card__head' }, h('h3', {}, 'Fonts & text size')),
        h('div', { class: 'fields' },
          h('label', {}, 'Heading font', fontSelect('themeFontDisplay', T.DISPLAY_FONTS)),
          h('label', {}, 'Body font', fontSelect('themeFontText', T.TEXT_FONTS)),
          h('label', {}, h('span', {}, 'Text size ', scaleOut), scale)))),
    h('div', { class: 'sticky' },
      h('div', { class: 'card' }, h('div', { class: 'card__head' }, h('h3', {}, 'Live preview')), preview,
        h('p', { class: 'hint', style: { marginTop: '12px' } }, 'Changes go live on your website only after you press Save theme.')))));
  paint();
}

boot();
