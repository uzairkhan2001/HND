const crypto = require('crypto');
const db = require('./db');

const COOKIE = 'dta_admin';
const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

// Signing secret: SESSION_SECRET env var if set, otherwise generated once and kept in the database
let secretPromise;
const getSecret = () => secretPromise ||= process.env.SESSION_SECRET
  ? Promise.resolve(process.env.SESSION_SECRET)
  : db.initKV('secret', crypto.randomBytes(32).toString('hex'));

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(password, salt, 64).toString('hex') };
}
function verifyPassword(password, user) {
  const { hash } = hashPassword(password, user.salt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(user.hash, 'hex'));
}

const sign = async v => crypto.createHmac('sha256', await getSecret()).update(v).digest('base64url');
async function makeToken(userId) {
  const payload = Buffer.from(JSON.stringify({ u: userId, exp: Date.now() + MAX_AGE })).toString('base64url');
  return payload + '.' + await sign(payload);
}
async function readToken(token) {
  if (!token || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expected = await sign(payload);
  if (!sig || sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const { u, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return exp > Date.now() ? (await db.getUserById(u)) || null : null;
  } catch { return null; }
}

function parseCookies(req) {
  const out = {};
  (req.headers.cookie || '').split(';').forEach(c => {
    const i = c.indexOf('=');
    if (i > 0) out[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim());
  });
  return out;
}

async function setLoginCookie(req, res, userId) {
  res.cookie(COOKIE, await makeToken(userId), {
    httpOnly: true, sameSite: 'lax', maxAge: MAX_AGE, secure: req.secure, path: '/'
  });
}
const clearLoginCookie = res => res.clearCookie(COOKIE, { path: '/' });

// Cached per request
function currentUser(req) {
  if (!req._userPromise) req._userPromise = readToken(parseCookies(req)[COOKIE]);
  return req._userPromise;
}

async function requireAdmin(req, res, next) {
  try {
    const user = await currentUser(req);
    if (!user) return res.status(401).json({ error: 'Not logged in' });
    // Basic CSRF protection for state-changing calls: require the admin panel's custom header
    if (req.method !== 'GET' && req.get('X-Requested-With') !== 'admin') {
      return res.status(403).json({ error: 'Bad request origin' });
    }
    req.user = user;
    next();
  } catch (e) { next(e); }
}

// Login throttle: 8 failed attempts per IP per 15 minutes (per server instance)
const attempts = new Map();
const WINDOW = 15 * 60 * 1000;
function loginThrottle(req, res, next) {
  const rec = attempts.get(req.ip);
  if (rec && rec.count >= 8 && Date.now() - rec.first < WINDOW) {
    return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
  }
  next();
}
function recordFailure(ip) {
  const rec = attempts.get(ip);
  if (!rec || Date.now() - rec.first > WINDOW) attempts.set(ip, { count: 1, first: Date.now() });
  else rec.count++;
}
const clearFailures = ip => attempts.delete(ip);

module.exports = {
  hashPassword, verifyPassword, setLoginCookie, clearLoginCookie, currentUser,
  requireAdmin, loginThrottle, recordFailure, clearFailures, parseCookies
};
