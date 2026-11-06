const { all, get, run } = require('./db');

const BOT_RE = /bot|crawl|spider|slurp|facebookexternalhit|preview|headless|lighthouse|pingdom|monitor/i;

// utm_source values / referrer hosts / in-app browser user agents → source name
const SOURCE_RULES = [
  { name: 'Instagram', utm: /^(ig|insta|instagram)/i, host: /instagram\.com$/i, ua: /Instagram/ },
  { name: 'Facebook', utm: /^(fb|facebook|meta)/i, host: /(facebook\.com|fb\.me|fb\.com)$/i, ua: /FBAN|FBAV|FB_IAB|FBIOS/ },
  { name: 'TikTok', utm: /^(tt|tiktok)/i, host: /tiktok\.com$/i, ua: /musical_ly|BytedanceWebview|TikTok/i },
  { name: 'WhatsApp', utm: /^(wa|whatsapp)/i, host: /(whatsapp\.com|wa\.me)$/i, ua: /WhatsApp/i },
  { name: 'YouTube', utm: /^(yt|youtube)/i, host: /(youtube\.com|youtu\.be)$/i, ua: null },
  { name: 'X / Twitter', utm: /^(x|twitter)$/i, host: /(twitter\.com|t\.co|x\.com)$/i, ua: /Twitter/i },
  { name: 'LinkedIn', utm: /^(li|linkedin)/i, host: /(linkedin\.com|lnkd\.in)$/i, ua: /LinkedInApp/i },
  { name: 'Snapchat', utm: /^snap/i, host: /snapchat\.com$/i, ua: /Snapchat/i },
  { name: 'Pinterest', utm: /^pin/i, host: /pinterest\./i, ua: /Pinterest/i },
  { name: 'Google', utm: /^google/i, host: /(^|\.)google\./i, ua: null },
  { name: 'Bing', utm: /^bing/i, host: /bing\.com$/i, ua: null },
  { name: 'Email', utm: /^(email|newsletter|mail)/i, host: /(mail\.|outlook\.)/i, ua: null }
];
const SOCIAL = new Set(['Instagram', 'Facebook', 'TikTok', 'WhatsApp', 'YouTube', 'X / Twitter', 'LinkedIn', 'Snapchat', 'Pinterest']);

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

function classify({ utm, referrer, ua, siteHost }) {
  if (utm) {
    const r = SOURCE_RULES.find(s => s.utm.test(utm));
    return r ? r.name : utm.slice(0, 40);
  }
  const host = hostOf(referrer);
  if (host && host !== siteHost) {
    const r = SOURCE_RULES.find(s => s.host.test(host));
    return r ? r.name : 'Other websites';
  }
  const app = SOURCE_RULES.find(s => s.ua && s.ua.test(ua || ''));
  if (app) return app.name;
  return 'Direct';
}

function device(ua = '') {
  if (/iPad|Tablet/i.test(ua)) return 'Tablet';
  if (/Mobi|Android|iPhone/i.test(ua)) return 'Mobile';
  return 'Desktop';
}

const clip = (v, n = 300) => (v == null ? null : String(v).slice(0, n));

// Per-IP throttle so the tracking endpoint can't be flooded
const hits = new Map();
setInterval(() => hits.clear(), 60 * 1000).unref();


async function record(req, body, siteHost) {
  const ua = req.get('user-agent') || '';
  if (BOT_RE.test(ua)) return;
  const n = (hits.get(req.ip) || 0) + 1;
  hits.set(req.ip, n);
  if (n > 120) return;

  const type = ['pageview', 'read', 'click', 'assess', 'bmi'].includes(body.type) ? body.type : null;
  if (!type) return;
  const source = type === 'pageview'
    ? classify({ utm: clip(body.utm, 60), referrer: body.referrer, ua, siteHost })
    : null;
  await run(`INSERT INTO events (ts, type, visitor, session, path, source, referrer, device, post_slug, label, target, section)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    Date.now(), type, clip(body.visitor, 40), clip(body.session, 40), clip(body.path, 200), source,
    clip(hostOf(body.referrer) || null, 120), device(ua), clip(body.post, 160), clip(body.label, 120),
    clip(body.target, 300), clip(body.section, 60));
}

const recordLead = body => run(`INSERT INTO events (ts, type, visitor, session, path, label) VALUES (?, 'lead', ?, ?, ?, ?)`,
  Date.now(), clip(body.visitor, 40), clip(body.session, 40), clip(body.path, 200), clip(body.program, 120));

// Source of a session = source of its first pageview
async function sessionSource(session) {
  if (!session) return null;
  const r = await get(`SELECT source FROM events WHERE session = ? AND type = 'pageview' ORDER BY ts LIMIT 1`, String(session));
  return r ? r.source : null;
}

const booking = (col = 'target') =>
  `(${col} LIKE '%calendly%' OR ${col} LIKE '%wa.me%' OR ${col} LIKE '%whatsapp%' OR ${col} LIKE 'tel:%')`;
const SOCIAL_LIST = [...SOCIAL];
const socialIn = SOCIAL_LIST.map(() => '?').join(',');

// First pageview of each session in the range → its source
const FIRST_PV = `SELECT DISTINCT ON (session) session, source FROM events
                  WHERE type = 'pageview' AND ts BETWEEN ? AND ? ORDER BY session, ts`;

async function kpis(from, to) {
  const r = await get(`SELECT
      COUNT(*) FILTER (WHERE type = 'pageview')::int AS pageviews,
      COUNT(DISTINCT visitor) FILTER (WHERE type = 'pageview')::int AS visitors,
      COUNT(DISTINCT session) FILTER (WHERE type = 'pageview')::int AS sessions,
      COUNT(*) FILTER (WHERE type = 'pageview' AND post_slug IS NOT NULL)::int AS post_views,
      COUNT(*) FILTER (WHERE type = 'read')::int AS reads,
      COUNT(*) FILTER (WHERE type = 'click')::int AS clicks,
      COUNT(*) FILTER (WHERE type = 'click' AND ${booking()})::int AS booking_clicks,
      COUNT(*) FILTER (WHERE type = 'lead')::int AS leads,
      COUNT(DISTINCT session) FILTER (WHERE type = 'pageview' AND source IN (${socialIn}))::int AS social,
      COUNT(DISTINCT session) FILTER (WHERE type = 'lead' OR (type = 'click' AND ${booking()}))::int AS converted,
      COUNT(DISTINCT session) FILTER (WHERE type = 'assess' AND label = 'start')::int AS assess_started,
      COUNT(*) FILTER (WHERE type = 'lead' AND label = 'Assessment')::int AS assess_done,
      COUNT(*) FILTER (WHERE type = 'bmi')::int AS bmi_uses
    FROM events WHERE ts BETWEEN ? AND ?`, ...SOCIAL_LIST, from, to);
  return {
    visitors: r.visitors, sessions: r.sessions, pageviews: r.pageviews, postViews: r.post_views, reads: r.reads,
    clicks: r.clicks, bookingClicks: r.booking_clicks, leads: r.leads, socialSessions: r.social,
    assessStarted: r.assess_started, assessDone: r.assess_done, bmiUses: r.bmi_uses,
    conversionRate: r.sessions ? +(r.converted / r.sessions * 100).toFixed(1) : 0
  };
}

async function report({ days = 30, tzOffset = 0 }) {
  days = Math.min(Math.max(Number(days) || 30, 1), 365);
  const to = Date.now();
  const from = to - days * 86400000;
  const prevFrom = from - days * 86400000;
  const off = (Number(tzOffset) || 0) * 60000; // client's getTimezoneOffset() in ms

  const [cur, previous, dailyRows, sources, sourceConversions, pages, posts, clicks, devices, referrers, liveRow, steps] = await Promise.all([
    kpis(from, to),
    kpis(prevFrom, from),
    all(`SELECT FLOOR((ts - ?) / 86400000)::int AS d, COUNT(*)::int AS pageviews, COUNT(DISTINCT visitor)::int AS visitors
         FROM events WHERE type = 'pageview' AND ts BETWEEN ? AND ? GROUP BY d ORDER BY d`, off, from, to),
    all(`SELECT source, COUNT(*)::int AS sessions FROM (${FIRST_PV}) f GROUP BY source ORDER BY sessions DESC`, from, to),
    // Leads + booking clicks per traffic source — which platform actually brings clients
    all(`SELECT f.source, COUNT(DISTINCT e.session)::int AS conversions
         FROM events e JOIN (SELECT DISTINCT ON (session) session, source FROM events WHERE type = 'pageview' ORDER BY session, ts) f
           ON f.session = e.session
         WHERE e.ts BETWEEN ? AND ? AND (e.type = 'lead' OR (e.type = 'click' AND ${booking('e.target')}))
         GROUP BY f.source`, from, to),
    all(`SELECT path, COUNT(*)::int AS views, COUNT(DISTINCT visitor)::int AS visitors FROM events
         WHERE type = 'pageview' AND ts BETWEEN ? AND ? GROUP BY path ORDER BY views DESC LIMIT 15`, from, to),
    all(`SELECT p.title, p.slug,
           COUNT(e.id) FILTER (WHERE e.type = 'pageview')::int AS views,
           COUNT(DISTINCT e.visitor) FILTER (WHERE e.type = 'pageview')::int AS readers,
           COUNT(e.id) FILTER (WHERE e.type = 'read')::int AS reads
         FROM posts p LEFT JOIN events e ON e.post_slug = p.slug AND e.ts BETWEEN ? AND ?
         GROUP BY p.id ORDER BY views DESC, p.published_at DESC NULLS LAST LIMIT 20`, from, to),
    all(`SELECT label, target, MIN(section) AS section, COUNT(*)::int AS clicks, COUNT(DISTINCT visitor)::int AS visitors FROM events
         WHERE type = 'click' AND ts BETWEEN ? AND ? GROUP BY label, target ORDER BY clicks DESC LIMIT 20`, from, to),
    all(`SELECT device, COUNT(DISTINCT session)::int AS sessions FROM events
         WHERE type = 'pageview' AND ts BETWEEN ? AND ? GROUP BY device ORDER BY sessions DESC`, from, to),
    all(`SELECT referrer, COUNT(*)::int AS visits FROM events WHERE type = 'pageview' AND referrer IS NOT NULL
         AND source = 'Other websites' AND ts BETWEEN ? AND ? GROUP BY referrer ORDER BY visits DESC LIMIT 10`, from, to),
    get(`SELECT COUNT(DISTINCT visitor)::int AS n FROM events WHERE ts > ?`, Date.now() - 5 * 60000),
    all(`SELECT label AS step, MIN(section) AS name, COUNT(DISTINCT session)::int AS sessions FROM events
         WHERE type = 'assess' AND ts BETWEEN ? AND ? GROUP BY label`, from, to)
  ]);

  const convMap = Object.fromEntries(sourceConversions.map(r => [r.source, r.conversions]));
  sources.forEach(s => { s.social = SOCIAL.has(s.source); s.conversions = convMap[s.source] || 0; });

  const byDay = new Map(dailyRows.map(r => [r.d, r]));
  const daily = [];
  for (let d = Math.floor((from - off) / 86400000); d <= Math.floor((to - off) / 86400000); d++) {
    const r = byDay.get(d);
    daily.push({ date: new Date(d * 86400000).toISOString().slice(0, 10), pageviews: r?.pageviews || 0, visitors: r?.visitors || 0 });
  }

  return {
    days, live: liveRow.n, kpis: cur, previous, daily, sources, pages,
    posts: posts.map(p => ({ ...p, readRate: p.views ? Math.round(p.reads / p.views * 100) : 0 })),
    clicks, devices, referrers,
    // Assessment funnel in step order: start, q1…, body, …, contact, done
    funnel: steps.sort((a, b) => stepOrder(a.step) - stepOrder(b.step))
  };
}

function stepOrder(step) {
  if (step === 'start') return -1;
  if (step === 'done') return 999;
  const n = parseInt(String(step).replace(/D/g, ''), 10);
  return Number.isFinite(n) ? n : 500;
}

module.exports = { record, recordLead, sessionSource, report, classify };
