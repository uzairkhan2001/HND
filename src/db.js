// Postgres storage. On Vercel it uses Neon (DATABASE_URL / POSTGRES_URL);
// locally, without a connection string, it uses an embedded Postgres (PGlite) in data/.
const path = require('path');
const crypto = require('crypto');
const defaults = require('./defaults');

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');

// Write SQL with `?` placeholders; they're converted to $1, $2… here.
const toPg = text => { let i = 0; return text.replace(/\?/g, () => '$' + ++i); };

let runQuery;
async function connect() {
  if (DB_URL) {
    const { neon } = require('@neondatabase/serverless');
    const sql = neon(DB_URL);
    runQuery = (text, params) => sql.query(text, params);
  } else {
    if (process.env.VERCEL) {
      throw new Error('No database connected. In the Vercel dashboard open Storage → add a Neon Postgres database to this project, then redeploy.');
    }
    const { PGlite } = await import('@electric-sql/pglite');
    require('fs').mkdirSync(DATA_DIR, { recursive: true });
    const pg = new PGlite(path.join(DATA_DIR, 'pgdata'));
    runQuery = async (text, params) => (await pg.query(text, params)).rows;
  }
}

const all = async (text, ...params) => {
  await ready;
  return runQuery(toPg(text), params);
};
const get = async (text, ...params) => (await all(text, ...params))[0];
const run = all;

// Timestamps are epoch milliseconds stored as DOUBLE PRECISION so both drivers return JS numbers.
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL, hash TEXT NOT NULL, salt TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS sections (
    id TEXT PRIMARY KEY, type TEXT NOT NULL, position INTEGER NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE, anchor TEXT, nav_label TEXT, data TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS posts (
    id SERIAL PRIMARY KEY, slug TEXT UNIQUE NOT NULL, title TEXT NOT NULL, excerpt TEXT, cover TEXT, content TEXT,
    tags TEXT, status TEXT NOT NULL DEFAULT 'draft', published_at DOUBLE PRECISION,
    created_at DOUBLE PRECISION NOT NULL, updated_at DOUBLE PRECISION NOT NULL
  );
  CREATE TABLE IF NOT EXISTS media (
    id SERIAL PRIMARY KEY, filename TEXT NOT NULL, url TEXT NOT NULL, original TEXT, size INTEGER, mime TEXT,
    created_at DOUBLE PRECISION NOT NULL
  );
  CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY, first TEXT, last TEXT, email TEXT, phone TEXT, country TEXT, program TEXT, medical TEXT,
    message TEXT, source TEXT, created_at DOUBLE PRECISION NOT NULL, is_read BOOLEAN NOT NULL DEFAULT FALSE
  );
  CREATE TABLE IF NOT EXISTS events (
    id BIGSERIAL PRIMARY KEY, ts DOUBLE PRECISION NOT NULL, type TEXT NOT NULL, visitor TEXT, session TEXT, path TEXT,
    source TEXT, referrer TEXT, device TEXT, post_slug TEXT, label TEXT, target TEXT, section TEXT
  );
  CREATE INDEX IF NOT EXISTS events_ts ON events(ts);
  CREATE INDEX IF NOT EXISTS events_type_ts ON events(type, ts);
  CREATE INDEX IF NOT EXISTS events_session ON events(session, ts);
  ALTER TABLE leads ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'contact';
  ALTER TABLE leads ADD COLUMN IF NOT EXISTS details TEXT;
`;

const now = () => Date.now();
const newId = () => crypto.randomBytes(6).toString('hex');

// ---------- key/value ----------
async function getKV(key, fallback) {
  const row = await get('SELECT value FROM kv WHERE key = ?', key);
  return row ? JSON.parse(row.value) : fallback;
}
async function setKV(key, value) {
  await run('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', key, JSON.stringify(value));
}
// Insert only if missing; returns the stored value (safe when several cold starts race)
async function initKV(key, value) {
  await run('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT (key) DO NOTHING', key, JSON.stringify(value));
  return getKV(key);
}

// ---------- settings ----------
const getSettings = async () => ({ ...defaults.settings, ...(await getKV('settings', {})) });
const saveSettings = s => setKV('settings', s);

// ---------- sections ----------
const rowToSection = r => ({
  id: r.id, type: r.type, position: r.position, enabled: !!r.enabled,
  anchor: r.anchor || '', navLabel: r.nav_label || '', data: JSON.parse(r.data)
});
async function listSections({ onlyEnabled = false } = {}) {
  const rows = await all('SELECT * FROM sections' + (onlyEnabled ? ' WHERE enabled' : '') + ' ORDER BY position');
  return rows.map(rowToSection);
}
async function getSection(id) {
  const r = await get('SELECT * FROM sections WHERE id = ?', id);
  return r ? rowToSection(r) : null;
}
async function createSection({ type, anchor = '', navLabel = '', data = {}, enabled = true }) {
  const id = newId();
  await run(`INSERT INTO sections (id, type, position, enabled, anchor, nav_label, data)
             VALUES (?, ?, (SELECT COALESCE(MAX(position), -1) + 1 FROM sections), ?, ?, ?, ?)`,
    id, type, !!enabled, anchor, navLabel, JSON.stringify(data));
  return getSection(id);
}
async function updateSection(id, { anchor, navLabel, data, enabled }) {
  const s = await getSection(id);
  if (!s) return null;
  await run('UPDATE sections SET anchor = ?, nav_label = ?, data = ?, enabled = ? WHERE id = ?',
    anchor ?? s.anchor, navLabel ?? s.navLabel, JSON.stringify(data ?? s.data), !!(enabled ?? s.enabled), id);
  return getSection(id);
}
const deleteSection = id => run('DELETE FROM sections WHERE id = ?', id);
async function reorderSections(ids) {
  if (!ids.length) return;
  // One statement: UPDATE … FROM (VALUES …)
  const values = ids.map(() => '(?, ?::int)').join(', ');
  await run(`UPDATE sections s SET position = v.pos FROM (VALUES ${values}) AS v(id, pos) WHERE s.id = v.id`,
    ...ids.flatMap((id, i) => [String(id), i]));
}

// ---------- posts ----------
const rowToPost = r => r && ({
  id: r.id, slug: r.slug, title: r.title, excerpt: r.excerpt || '', cover: r.cover || '',
  content: r.content || '', tags: r.tags || '', status: r.status,
  publishedAt: r.published_at, createdAt: r.created_at, updatedAt: r.updated_at
});
async function listPosts({ publishedOnly = false, limit = 1000 } = {}) {
  const rows = publishedOnly
    ? await all(`SELECT * FROM posts WHERE status = 'published' AND published_at <= ? ORDER BY published_at DESC LIMIT ?`, now(), limit)
    : await all('SELECT * FROM posts ORDER BY COALESCE(published_at, created_at) DESC LIMIT ?', limit);
  return rows.map(rowToPost);
}
const getPost = async id => rowToPost(await get('SELECT * FROM posts WHERE id = ?', Number(id) || 0));
const getPostBySlug = async slug => rowToPost(await get('SELECT * FROM posts WHERE slug = ?', slug));

function slugify(s) {
  return String(s).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '')
    .trim().replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '') || 'post';
}
async function uniqueSlug(base, ignoreId) {
  let slug = slugify(base), n = 1;
  while (true) {
    const r = await get('SELECT id FROM posts WHERE slug = ?', slug);
    if (!r || r.id === ignoreId) return slug;
    slug = `${slugify(base)}-${++n}`;
  }
}
async function savePost(p, id) {
  const t = now();
  const existing = id ? await getPost(id) : null;
  const status = p.status === 'published' ? 'published' : 'draft';
  const publishedAt = status === 'published'
    ? (p.publishedAt ? Number(p.publishedAt) : existing?.publishedAt || t)
    : (p.publishedAt ? Number(p.publishedAt) : null);
  const slug = await uniqueSlug(p.slug || p.title, id);
  const vals = [slug, p.title || 'Untitled', p.excerpt || '', p.cover || '', p.content || '', p.tags || '', status, publishedAt];
  if (existing) {
    await run('UPDATE posts SET slug=?, title=?, excerpt=?, cover=?, content=?, tags=?, status=?, published_at=?, updated_at=? WHERE id=?', ...vals, t, id);
    return getPost(id);
  }
  const r = await get('INSERT INTO posts (slug, title, excerpt, cover, content, tags, status, published_at, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) RETURNING id', ...vals, t, t);
  return getPost(r.id);
}
const deletePost = id => run('DELETE FROM posts WHERE id = ?', id);
const countPosts = async () => {
  const r = await get(`SELECT COUNT(*)::int AS n, COUNT(*) FILTER (WHERE status = 'published' AND published_at <= ?)::int AS p FROM posts`, now());
  return { total: r.n, published: r.p };
};

// ---------- media ----------
const listMedia = () => all('SELECT * FROM media ORDER BY created_at DESC');
const addMedia = ({ filename, url, original, size, mime }) =>
  get('INSERT INTO media (filename, url, original, size, mime, created_at) VALUES (?,?,?,?,?,?) RETURNING *', filename, url, original, size, mime, now());
const getMedia = id => get('SELECT * FROM media WHERE id = ?', id);
const deleteMedia = id => run('DELETE FROM media WHERE id = ?', id);
const countMedia = async () => (await get('SELECT COUNT(*)::int AS n FROM media')).n;

// ---------- leads ----------
const addLead = l => run('INSERT INTO leads (first, last, email, phone, country, program, medical, message, source, kind, details, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
  l.first, l.last, l.email, l.phone, l.country, l.program, l.medical, l.message, l.source,
  l.kind || 'contact', l.details ? JSON.stringify(l.details) : null, now());
const listLeads = () => all('SELECT * FROM leads ORDER BY created_at DESC');
const markLead = (id, read) => run('UPDATE leads SET is_read = ? WHERE id = ?', !!read, id);
const deleteLead = id => run('DELETE FROM leads WHERE id = ?', id);
const unreadLeads = async () => (await get('SELECT COUNT(*)::int AS n FROM leads WHERE NOT is_read')).n;

// ---------- users ----------
const hasUsers = async () => (await get('SELECT COUNT(*)::int AS n FROM users')).n > 0;
const getUser = username => get('SELECT * FROM users WHERE username = ?', username);
const getUserById = id => get('SELECT id, username FROM users WHERE id = ?', Number(id) || 0);
async function setUser(username, hash, salt, id) {
  if (id) await run('UPDATE users SET username = ?, hash = ?, salt = ? WHERE id = ?', username, hash, salt, id);
  else await run('INSERT INTO users (username, hash, salt) VALUES (?,?,?)', username, hash, salt);
}

// ---------- startup: schema + first-run content ----------
// `ready` = connected and tables exist (queries wait on this).
// `started` = also seeded on first run (the server waits on this before handling requests).
const ready = (async () => {
  await connect();
  for (const stmt of SCHEMA.split(';').map(s => s.trim()).filter(Boolean)) await runQuery(stmt, []);
})();

const started = ready.then(async () => {
  // Claim the seed atomically so concurrent cold starts can't seed twice
  const claimed = await runQuery(`INSERT INTO kv (key, value) VALUES ('seeded', 'true') ON CONFLICT (key) DO NOTHING RETURNING key`, []);
  if (!claimed.length) return;
  await saveSettings(defaults.settings);
  for (const s of defaults.sections) await createSection(s);
  for (const p of defaults.posts) await savePost({ ...p, status: 'published' });
}).then(runMigrations);

// ---------- one-time content updates for sites created by an earlier version ----------
// Each runs once per database (claimed atomically in kv, like the seed).
const claim = async key => (await runQuery(`INSERT INTO kv (key, value) VALUES ($1, 'true') ON CONFLICT (key) DO NOTHING RETURNING key`, [key])).length > 0;

async function insertSectionAfter(anchors, section) {
  const rows = await all('SELECT anchor, position FROM sections ORDER BY position');
  const after = anchors.map(a => rows.find(r => r.anchor === a)).find(Boolean);
  if (!after) return createSection(section);
  await run('UPDATE sections SET position = position + 1 WHERE position > ?', after.position);
  const s = await createSection(section);
  await run('UPDATE sections SET position = ? WHERE id = ?', after.position + 1, s.id);
  return s;
}

async function runMigrations() {
  if (await claim('migration:assessment-v1')) {
    await insertSectionAfter(['about', 'home'], defaults.assessmentCtaSection);
    await insertSectionAfter(['pcos', 'fatloss', 'programs'], defaults.bmiSection);
    // Point the hero's second button at the assessment, unless it was customised
    const hero = (await listSections()).find(s => s.type === 'hero');
    if (hero && (!hero.data.btn2Url || hero.data.btn2Url === '#programs')) {
      await updateSection(hero.id, { data: { ...hero.data, btn2Label: 'Start Free Assessment', btn2Url: '/assessment' } });
    }
  }
  if (await claim('migration:calorie-v1')) {
    // Remove the "Strength begins with a single step" banner and add the calorie calculator after BMI
    for (const s of await listSections()) if (s.type === 'strip' && s.anchor === 'tagline') await deleteSection(s.id);
    await insertSectionAfter(['bmi'], defaults.calorieSection);
  }
}

// ---------- assessment config ----------
const getAssessment = async () => ({ ...defaults.assessment, ...(await getKV('assessment', {})) });
const saveAssessment = a => setKV('assessment', a);
// Requests await `started` and report the error; this stops an early failure crashing the process
started.catch(e => console.error('Database startup failed:', e.message));

module.exports = {
  started, DATA_DIR, getKV, setKV, initKV, all, get, run,
  getSettings, saveSettings, getAssessment, saveAssessment,
  listSections, getSection, createSection, updateSection, deleteSection, reorderSections,
  listPosts, getPost, getPostBySlug, savePost, deletePost, countPosts, slugify,
  listMedia, addMedia, getMedia, deleteMedia, countMedia,
  addLead, listLeads, markLead, deleteLead, unreadLeads,
  hasUsers, getUser, getUserById, setUser
};
