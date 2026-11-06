const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const multer = require('multer');
const xss = require('xss');

const db = require('./src/db');
const auth = require('./src/auth');
const analytics = require('./src/analytics');
const { sectionTypes, settingsFields, assessmentFields } = require('./public/shared/schemas');
const { computeBmi } = require('./public/shared/bmi');
const THEME = require('./public/shared/theme');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(PUBLIC_DIR, 'uploads');
// Photos go to Vercel Blob when a Blob store is connected, otherwise to local disk
const USE_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1);
app.disable('x-powered-by');

// Async route helper (Express 4 doesn't catch rejected promises)
const ah = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

app.use(express.json({ limit: '2mb' }));
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
// On Vercel these files are served by the CDN; locally Express serves them
app.use(express.static(PUBLIC_DIR)); // revalidated each visit, so edits/deploys show immediately
app.get('/admin', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'admin', 'index.html')));
app.use(ah(async (req, res, next) => { await db.started; next(); }));

// ---------------------------------------------------------------- helpers
// Rich text (blog posts, custom sections) is cleaned to a safe tag/attribute allow-list
const IFRAME_HOSTS = ['www.youtube.com', 'www.youtube-nocookie.com', 'player.vimeo.com', 'www.instagram.com'];
const richFilter = new xss.FilterXSS({
  whiteList: {
    ...xss.getDefaultWhiteList(),
    p: ['class'], span: ['class'], li: ['class'], h1: ['class'], h2: ['class'], h3: ['class'],
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height'],
    iframe: ['src', 'width', 'height', 'allowfullscreen', 'frameborder', 'allow']
  },
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style', 'noscript'],
  onTagAttr(tag, name, value) {
    if (name === 'class') return /^[\w\s-]*$/.test(value) ? `class="${value}"` : '';
    if (tag === 'iframe' && name === 'src') {
      let host = '';
      try { host = new URL(value).hostname; } catch {}
      return IFRAME_HOSTS.includes(host) && value.startsWith('https://') ? `src="${xss.escapeAttrValue(value)}"` : '';
    }
  }
});
const cleanRich = html => richFilter.process(String(html || ''));

function safeUrl(u) {
  u = String(u || '').trim();
  if (!u) return '';
  if (/^(https?:|mailto:|tel:|#|\/)/i.test(u)) return u;
  if (/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(u)) return 'https://' + u; // "calendly.com/x"
  return '';
}
const isExternal = u => /^https?:/i.test(u);

// Coerce section data to what its schema allows (drops unknown keys, cleans rich text)
function normalizeFields(fields, data = {}) {
  const out = {};
  for (const f of fields) {
    const v = data[f.key];
    switch (f.type) {
      case 'list':
        out[f.key] = Array.isArray(v) ? v.slice(0, 50).map(item => normalizeFields(f.fields, item)) : [];
        break;
      case 'richtext': out[f.key] = cleanRich(v); break;
      case 'number': out[f.key] = Number.isFinite(Number(v)) && v !== '' ? Number(v) : 0; break;
      case 'checkbox': out[f.key] = !!v; break;
      case 'select': out[f.key] = f.options.includes(v) ? v : f.options[0]; break;
      default: out[f.key] = v == null ? '' : String(v).slice(0, 5000);
    }
  }
  return out;
}
const slugAnchor = s => db.slugify(s || '').slice(0, 40);

function darken(hex, amt = 0.15) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return '#d96f1c';
  const n = parseInt(m[1], 16);
  const c = sh => Math.max(0, Math.round(((n >> sh) & 255) * (1 - amt)));
  return '#' + [16, 8, 0].map(sh => c(sh).toString(16).padStart(2, '0')).join('');
}

const fmtDate = ts => ts ? new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

const ASSET_PATH = /^\/(uploads|img|css|js|shared|api|admin|robots\.txt|sitemap\.xml)(\/|$)/;

async function pageLocals(req, extra = {}) {
  const [settings, sections, user] = await Promise.all([db.getSettings(), db.listSections({ onlyEnabled: true }), auth.currentUser(req)]);
  const link = u => safeUrl(u);
  const home = '/';
  const navLinks = sections.filter(s => s.navLabel && s.anchor)
    .map(s => ({ label: s.navLabel, href: (extra.onHome ? '' : '/') + '#' + s.anchor }));
  return {
    settings, sections, navLinks, safeUrl, isExternal, fmtDate, link, home, base: '',
    pic: src => src || '/img/placeholder.svg',
    ext: u => (isExternal(u) ? ' target="_blank" rel="noopener"' : ''),
    themeCss: THEME.themeCss(settings),
    fontsHref: THEME.fontsHref(settings),
    isAdmin: !!user,
    isPreview: false,
    ...extra
  };
}

function sitePages() {
  const r = express.Router();

  r.get('/', ah(async (req, res) => {
    const locals = await pageLocals(req, { onHome: true });
    const blogCount = Math.max(0, ...locals.sections.filter(s => s.type === 'blog').map(s => s.data.count || 3));
    const latestPosts = blogCount ? await db.listPosts({ publishedOnly: true, limit: blogCount }) : [];
    res.render('index', { ...locals, latestPosts, page: 'home' });
  }));

  r.get('/blog', ah(async (req, res) => {
    const [locals, posts] = await Promise.all([pageLocals(req), db.listPosts({ publishedOnly: true })]);
    res.render('blog-list', { ...locals, posts, page: 'blog' });
  }));

  r.get('/blog/:slug', ah(async (req, res, next) => {
    const [post, admin] = await Promise.all([db.getPostBySlug(req.params.slug), auth.currentUser(req)]);
    if (!post || (!admin && (post.status !== 'published' || post.publishedAt > Date.now()))) return next();
    const [locals, recent] = await Promise.all([pageLocals(req), db.listPosts({ publishedOnly: true, limit: 4 })]);
    res.render('blog-post', { ...locals, post, more: recent.filter(p => p.id !== post.id).slice(0, 3), page: 'post' });
  }));

  r.get('/assessment', ah(async (req, res) => {
    const [locals, assessment] = await Promise.all([pageLocals(req), db.getAssessment()]);
    res.render('assessment', { ...locals, assessment, page: 'assessment', title: 'Free Assessment', description: assessment.introText });
  }));
  return r;
}
// The old /v2 and /classic addresses now point to the one site design
app.get(/^\/(?:v2|classic)(\/.*)?$/, (req, res) => res.redirect(301, req.params[0] || '/'));
app.use('/', sitePages());

app.get('/robots.txt',(req, res) => res.type('text/plain').send(`User-agent: *\nDisallow: /admin\nSitemap: ${req.protocol}://${req.get('host')}/sitemap.xml\n`));
app.get('/sitemap.xml', ah(async (req, res) => {
  const base = `${req.protocol}://${req.get('host')}`;
  const urls = ['/', '/assessment', '/blog', ...(await db.listPosts({ publishedOnly: true })).map(p => '/blog/' + p.slug)];
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(u => `<url><loc>${base}${u}</loc></url>`).join('')}</urlset>`);
}));

// ---------------------------------------------------------------- public API
app.post('/api/track', express.text({ type: 'text/plain', limit: '10kb' }), ah(async (req, res) => {
  if (typeof req.body === 'string') { try { req.body = JSON.parse(req.body); } catch { req.body = {}; } }
  if (!(await auth.currentUser(req))) { // don't count the owner's own visits
    try { await analytics.record(req, req.body || {}, req.hostname); } catch (e) { console.error('track', e.message); }
  }
  res.status(204).end();
}));

// Free assessment submission → BMI result + lead in the admin panel
app.post('/api/assessment', ah(async (req, res) => {
  const b = req.body || {};
  if (b.website) return res.json({ ok: true }); // honeypot
  const s = (v, n = 200) => String(v ?? '').trim().slice(0, n);
  const config = await db.getAssessment();

  // Answers must be options that exist in the current questions
  const given = Array.isArray(b.answers) ? b.answers : [];
  const answers = [];
  for (const [i, q] of (config.questions || []).entries()) {
    const allowed = (q.options || []).map(o => o.label);
    const picked = [].concat(given[i] || []).map(String).filter(v => allowed.includes(v));
    const values = q.multiple ? [...new Set(picked)] : picked.slice(0, 1);
    if (q.required && !values.length) return res.status(400).json({ error: `Please answer: ${q.question}` });
    answers.push({ question: q.question, answer: values });
  }

  const result = computeBmi(b.body || {});
  if (result.error) return res.status(400).json({ error: result.error });

  const c = b.contact || {};
  const contact = { first: s(c.first, 80), last: s(c.last, 80), email: s(c.email, 120), phone: s(c.phone, 40), consent: !!c.consent };
  if (!contact.first || !contact.phone) return res.status(400).json({ error: 'Please enter your name and phone / WhatsApp number.' });
  if ((config.emailRequired || contact.email) && !/^\S+@\S+\.\S+$/.test(contact.email)) return res.status(400).json({ error: 'Please enter a valid email address.' });

  const summary = answers.filter(a => a.answer.length).map(a => `${a.question} ${a.answer.join(', ')}`).join('\n');
  await db.addLead({
    ...contact, country: '', kind: 'assessment',
    program: answers[0]?.answer.join(', ') || 'Assessment',
    medical: answers.find(a => /condition|health/i.test(a.question))?.answer.join(', ') || '',
    message: `BMI ${result.bmi} (${result.category.label}) — ${result.weightKg} kg, ${result.heightCm} cm\n${summary}`,
    source: (await analytics.sessionSource(b.session)) || 'Unknown',
    details: { answers, bmi: result.bmi, category: result.category.label, weightKg: result.weightKg, heightCm: result.heightCm, whatsappConsent: contact.consent }
  });
  await analytics.recordLead({ ...b, program: 'Assessment' });

  const messages = { under: config.msgUnder, healthy: config.msgHealthy, over: config.msgOver, obese: config.msgObese };
  res.json({ ok: true, ...result, message: messages[result.category.key] || '' });
}));

app.post('/api/leads', ah(async (req, res) => {
  const b = req.body || {};
  const s = (v, n = 200) => String(v || '').trim().slice(0, n);
  const lead = {
    first: s(b.first, 80), last: s(b.last, 80), email: s(b.email, 120), phone: s(b.phone, 40),
    country: s(b.country, 60), program: s(b.program, 120), medical: s(b.medical, 300), message: s(b.message, 3000)
  };
  if (b.website) return res.json({ ok: true }); // honeypot: bots fill hidden field
  if (!lead.first || !/^\S+@\S+\.\S+$/.test(lead.email) || !lead.phone) {
    return res.status(400).json({ error: 'Please fill in your name, a valid email and phone number.' });
  }
  lead.source = (await analytics.sessionSource(b.session)) || 'Unknown';
  await db.addLead(lead);
  await analytics.recordLead(b);
  res.json({ ok: true });
}));

// ---------------------------------------------------------------- admin auth
const admin = express.Router();
// Admin data must always be fresh — never cached by the browser or CDN
admin.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

admin.get('/me', ah(async (req, res) => {
  const [user, hasUsers] = await Promise.all([auth.currentUser(req), db.hasUsers()]);
  res.json({ user, needsSetup: !hasUsers });
}));

admin.post('/setup', ah(async (req, res) => {
  if (await db.hasUsers()) return res.status(400).json({ error: 'Admin already exists' });
  const { username, password } = req.body || {};
  if (!username || !password || password.length < 8) return res.status(400).json({ error: 'Choose a username and a password of at least 8 characters.' });
  const name = String(username).trim();
  const { hash, salt } = auth.hashPassword(password);
  await db.setUser(name, hash, salt);
  await auth.setLoginCookie(req, res, (await db.getUser(name)).id);
  res.json({ ok: true });
}));

admin.post('/login', auth.loginThrottle, ah(async (req, res) => {
  const { username, password } = req.body || {};
  const user = await db.getUser(String(username || '').trim());
  if (!user || !auth.verifyPassword(String(password || ''), user)) {
    auth.recordFailure(req.ip);
    return res.status(401).json({ error: 'Wrong username or password' });
  }
  auth.clearFailures(req.ip);
  await auth.setLoginCookie(req, res, user.id);
  res.json({ ok: true });
}));

admin.post('/logout', (req, res) => { auth.clearLoginCookie(res); res.json({ ok: true }); });

// Everything below requires login
admin.use(auth.requireAdmin);

admin.post('/account', ah(async (req, res) => {
  const { username, currentPassword, newPassword } = req.body || {};
  const user = await db.getUser(req.user.username);
  if (!auth.verifyPassword(String(currentPassword || ''), user)) return res.status(400).json({ error: 'Current password is wrong' });
  if (newPassword && newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });
  const { hash, salt } = newPassword ? auth.hashPassword(newPassword) : user;
  await db.setUser(String(username || user.username).trim(), hash, salt, user.id);
  res.json({ ok: true });
}));

admin.get('/overview', ah(async (req, res) => {
  const [posts, unreadLeads, media] = await Promise.all([db.countPosts(), db.unreadLeads(), db.countMedia()]);
  res.json({ posts: posts.total, published: posts.published, unreadLeads, media });
}));

// Settings
admin.get('/settings', ah(async (req, res) => res.json(await db.getSettings())));
admin.put('/settings', ah(async (req, res) => {
  const cur = await db.getSettings();
  for (const f of settingsFields) if (f.key in req.body) cur[f.key] = String(req.body[f.key] ?? '').slice(0, 1000);
  // Theme values are checked so a bad value can never break the public site
  const t = THEME.resolve(cur);
  for (const k of THEME.COLOR_KEYS) cur[k] = t[k];
  cur.themeFontDisplay = t.display.name; cur.themeFontText = t.text.name; cur.themeTextScale = String(t.scale);
  await db.saveSettings(cur);
  res.json(cur);
}));

// Sections
admin.get('/sections', ah(async (req, res) => res.json(await db.listSections())));
admin.post('/sections', ah(async (req, res) => {
  const { type, anchor, navLabel } = req.body || {};
  if (!sectionTypes[type]) return res.status(400).json({ error: 'Unknown section type' });
  res.json(await db.createSection({
    type, anchor: slugAnchor(anchor || navLabel || type + '-' + crypto.randomBytes(2).toString('hex')),
    navLabel: String(navLabel || ''), data: normalizeFields(sectionTypes[type].fields, req.body.data || {})
  }));
}));
admin.post('/sections/:id/duplicate', ah(async (req, res) => {
  const s = await db.getSection(req.params.id);
  if (!s) return res.status(404).json({ error: 'Not found' });
  res.json(await db.createSection({ ...s, anchor: s.anchor + '-copy', navLabel: '', enabled: false }));
}));
admin.put('/sections/reorder', ah(async (req, res) => {
  if (!Array.isArray(req.body.ids)) return res.status(400).json({ error: 'ids required' });
  await db.reorderSections(req.body.ids.slice(0, 200));
  res.json({ ok: true });
}));
admin.put('/sections/:id', ah(async (req, res) => {
  const s = await db.getSection(req.params.id);
  if (!s) return res.status(404).json({ error: 'Not found' });
  const b = req.body || {};
  res.json(await db.updateSection(s.id, {
    anchor: b.anchor != null ? slugAnchor(b.anchor) : undefined,
    navLabel: b.navLabel != null ? String(b.navLabel).slice(0, 40) : undefined,
    enabled: b.enabled,
    data: b.data ? normalizeFields(sectionTypes[s.type].fields, b.data) : undefined
  }));
}));
admin.delete('/sections/:id', ah(async (req, res) => { await db.deleteSection(req.params.id); res.json({ ok: true }); }));

// Blog posts
admin.get('/posts', ah(async (req, res) => res.json(await db.listPosts())));
admin.get('/posts/:id', ah(async (req, res) => {
  const p = await db.getPost(req.params.id);
  p ? res.json(p) : res.status(404).json({ error: 'Not found' });
}));
const cleanPost = b => ({
  title: String(b.title || '').slice(0, 200), slug: String(b.slug || ''), excerpt: String(b.excerpt || '').slice(0, 500),
  cover: String(b.cover || ''), content: cleanRich(b.content), tags: String(b.tags || '').slice(0, 200),
  status: b.status, publishedAt: b.publishedAt
});
admin.post('/posts', ah(async (req, res) => res.json(await db.savePost(cleanPost(req.body || {})))));
admin.put('/posts/:id', ah(async (req, res) => {
  const id = Number(req.params.id);
  if (!(await db.getPost(id))) return res.status(404).json({ error: 'Not found' });
  res.json(await db.savePost(cleanPost(req.body || {}), id));
}));
admin.delete('/posts/:id', ah(async (req, res) => { await db.deletePost(Number(req.params.id)); res.json({ ok: true }); }));

// Media library. Vercel caps request bodies at 4.5 MB; the admin panel shrinks photos before upload.
const ALLOWED = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/avif': '.avif' };
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Math.floor(4.4 * 1024 * 1024), files: 1 },
  fileFilter: (req, file, cb) => cb(null, !!ALLOWED[file.mimetype])
});
async function storeFile(file) {
  const filename = Date.now().toString(36) + '-' + crypto.randomBytes(4).toString('hex') + ALLOWED[file.mimetype];
  if (USE_BLOB) {
    const { put } = require('@vercel/blob');
    const blob = await put('uploads/' + filename, file.buffer, { access: 'public', contentType: file.mimetype });
    return { filename, url: blob.url };
  }
  if (process.env.VERCEL) {
    throw Object.assign(new Error('Photo storage is not connected. In the Vercel dashboard open Storage → create a Blob store, connect it to this project, then redeploy.'), { status: 503 });
  }
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), file.buffer);
  return { filename, url: '/uploads/' + filename };
}
admin.get('/media', ah(async (req, res) => res.json(await db.listMedia())));
admin.post('/media', upload.array('files', 1), ah(async (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: 'Only JPG, PNG, WebP, GIF or AVIF images up to 4 MB.' });
  const out = [];
  for (const f of req.files) {
    const { filename, url } = await storeFile(f);
    out.push(await db.addMedia({ filename, url, original: f.originalname, size: f.size, mime: f.mimetype }));
  }
  res.json(out);
}));
admin.delete('/media/:id', ah(async (req, res) => {
  const m = await db.getMedia(Number(req.params.id));
  if (m) {
    if (/^https?:/.test(m.url)) {
      if (USE_BLOB) await require('@vercel/blob').del(m.url).catch(e => console.error('blob delete', e.message));
    } else {
      fs.rm(path.join(UPLOAD_DIR, path.basename(m.filename)), { force: true }, () => {});
    }
    await db.deleteMedia(m.id);
  }
  res.json({ ok: true });
}));

// Leads
admin.get('/leads', ah(async (req, res) => res.json(await db.listLeads())));
admin.put('/leads/:id', ah(async (req, res) => { await db.markLead(Number(req.params.id), !!req.body.read); res.json({ ok: true }); }));
admin.delete('/leads/:id', ah(async (req, res) => { await db.deleteLead(Number(req.params.id)); res.json({ ok: true }); }));
admin.get('/leads.csv', ah(async (req, res) => {
  const cols = ['created_at', 'kind', 'first', 'last', 'email', 'phone', 'country', 'program', 'medical', 'message', 'source'];
  const cell = v => {
    let s = String(v ?? '');
    if (/^[=+\-@]/.test(s)) s = "'" + s; // stop spreadsheet formula injection
    return '"' + s.replace(/"/g, '""') + '"';
  };
  const rows = (await db.listLeads()).map(l => cols.map(c => cell(c === 'created_at' ? new Date(l[c]).toISOString() : l[c])).join(','));
  res.type('text/csv').attachment('leads.csv').send([cols.join(','), ...rows].join('\n'));
}));

// Assessment questions & texts
admin.get('/assessment', ah(async (req, res) => res.json(await db.getAssessment())));
admin.put('/assessment', ah(async (req, res) => {
  const a = normalizeFields(assessmentFields, req.body || {});
  a.questions = a.questions.filter(q => q.question.trim() && q.options.some(o => o.label.trim()))
    .map(q => ({ ...q, options: q.options.filter(o => o.label.trim()) }));
  await db.saveAssessment(a);
  res.json(a);
}));

// Analytics
admin.get('/analytics', ah(async (req, res) => res.json(await analytics.report({ days: req.query.days, tzOffset: req.query.tz }))));

app.use('/api/admin', admin);

// ---------------------------------------------------------------- errors
app.use(ah(async (req, res) => {
  res.status(404).render('404', { ...(await pageLocals(req)), page: '404' });
}));
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
  const message = err.code === 'LIMIT_FILE_SIZE' ? 'Photo is too large (max 4 MB).' : status < 500 || status === 503 ? err.message : 'Server error';
  if (req.path.startsWith('/api/')) return res.status(status).json({ error: message });
  // Show the setup hint (no secrets in it) when the database isn't connected yet
  if (/^No database connected/.test(err.message)) return res.status(503).send(err.message);
  res.status(status).send('Something went wrong');
});

// Local: start a server. On Vercel: api/index.js imports the app.
if (require.main === module) {
  app.listen(PORT, () => console.log(`Dt Amna Transformation running at http://localhost:${PORT}  (admin: /admin)`));
}

module.exports = app;
