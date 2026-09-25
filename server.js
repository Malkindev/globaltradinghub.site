const express = require('express');

// ─── PERSISTENT SITE AUTH DATABASE ───────────────────────────────────────────
// Separate email/password account layer. Existing Deriv OAuth remains untouched.
// Set DATABASE_URL (PostgreSQL) in the hosting environment to enable it.
const crypto = require('crypto');
const { Pool } = require('pg');
const AUTH_COOKIE = 'gth_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
let authPool = null;
let authSchemaPromise = null;

function getAuthPool() {
  if (!DATABASE_URL) return null;
  if (!authPool) {
    authPool = new Pool({
      connectionString: DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
      ssl: /localhost|127\\.0\\.0\\.1/i.test(DATABASE_URL) ? false : { rejectUnauthorized: false },
    });
  }
  return authPool;
}

async function ensureAuthSchema() {
  const pool = getAuthPool();
  if (!pool) return false;
  await pool.query(\`
    CREATE TABLE IF NOT EXISTS gth_users (
      id BIGSERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_login_at TIMESTAMPTZ,
      last_logout_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS gth_sessions (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES gth_users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      user_agent TEXT NOT NULL DEFAULT '',
      ip_address TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS gth_sessions_user_id_idx ON gth_sessions(user_id);
    CREATE INDEX IF NOT EXISTS gth_sessions_expires_at_idx ON gth_sessions(expires_at);
  \`);
  await pool.query('DELETE FROM gth_sessions WHERE expires_at <= NOW()');
  return true;
}

async function requireAuthDatabase() {
  const pool = getAuthPool();
  if (!pool) {
    const err = new Error('Persistent auth database is not configured. Set DATABASE_URL.');
    err.statusCode = 503;
    throw err;
  }
  if (!authSchemaPromise) {
    authSchemaPromise = ensureAuthSchema().catch((err) => {
      authSchemaPromise = null;
      throw err;
    });
  }
  await authSchemaPromise;
  return pool;
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function parseCookies(req) {
  const raw = String(req.headers.cookie || '');
  const out = {};
  raw.split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i < 0) return;
    const key = part.slice(0, i).trim();
    if (!key) return;
    try { out[key] = decodeURIComponent(part.slice(i + 1).trim()); } catch (e) { out[key] = part.slice(i + 1).trim(); }
  });
  return out;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = crypto.scryptSync(String(password), salt, 64);
  return 'scryptconst path = require('path');
const fs = require('fs');
const BRAND = require('./brand.config');
const app = express();
const PORT = process.env.PORT || 3001;

// ─── TEMPLATE TOKEN RENDERING ────────────────────────────────────────────────
// index.html / manifest.json ship with %%TOKEN%% placeholders instead of
// hardcoded brand strings. Fill them in from brand.config.js on every request
// (cheap — these are small files) so editing brand.config.js is enough to
// re-skin the whole app; no rebuild step needed.
function darken(hex, amount) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (n >> 16) - amount);
  const g = Math.max(0, ((n >> 8) & 0xff) - amount);
  const b = Math.max(0, (n & 0xff) - amount);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}
const TOKENS = {
  '%%APP_NAME%%': BRAND.appName,
  '%%LOGO_TEXT_MAIN%%': BRAND.logoTextMain,
  '%%LOGO_TEXT_ACCENT%%': BRAND.logoTextAccent,
  '%%TAGLINE%%': BRAND.tagline,
  '%%DESCRIPTION%%': BRAND.description,
  '%%PRIMARY_DOMAIN%%': BRAND.primaryDomain,
  '%%ALLOWED_DOMAINS_JSON%%': JSON.stringify(BRAND.allowedDomains),
  '%%PRIMARY_COLOR%%': BRAND.primaryColor,
  '%%PRIMARY_COLOR_DARK%%': darken(BRAND.primaryColor, 0x20),
  '%%ACCENT_COLOR%%': BRAND.accentColor,
  '%%SECONDARY_COLOR%%': BRAND.secondaryColor,
  '%%BACKGROUND_COLOR%%': BRAND.backgroundColor,
  '%%FONT_FAMILY%%': `'${BRAND.fontFamily}'`,
  '%%FONT_GOOGLE_PARAM%%': BRAND.fontGoogleParam,
};
function renderTemplate(filePath) {
  let s = fs.readFileSync(filePath, 'utf8');
  for (const [token, value] of Object.entries(TOKENS)) s = s.split(token).join(value);
  return s;
}

// ─── SECURITY / ANTI-CLONE HEADERS ───────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'self'");
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

function noCache(res) {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

// ─── SITE CONFIG (sourced from brand.config.js) ──────────────────────────────
// The app build (a "Deriv site manager" build) configures itself entirely from
// /api/appwrite/site-settings: branding, theme colours, tab list, referral
// link and — crucially — the Deriv OAuth identifiers. Providing `newAppId`
// makes the bundle use the modern PKCE login flow (auth.deriv.com/oauth2/auth
// + /api/oauth/token exchange), which is what an alphanumeric client_id needs.
const DERIV_CLIENT_ID = BRAND.derivAppId;

// settingsJson is what the bundle JSON.parses first (falls back to the flat
// fields below only if this is absent). Keep the two in sync.
const HLX_SETTINGS = {
  brandName: BRAND.appName,
  platformName: BRAND.appName,
  siteTitle: `${BRAND.appName} — ${BRAND.tagline}`,
  logoUrl: '/assets/media/logo.png',
  logoFileId: '',
  faviconUrl: '/assets/media/favicon.png',
  faviconFileId: '',

  // ── Deriv OAuth ── newAppId present ⇒ PKCE flow (see bundle login builder L()).
  newAppId: DERIV_CLIENT_ID,
  oauthClientId: DERIV_CLIENT_ID,
  appId: DERIV_CLIENT_ID,
  legacyAppId: '',

  // ── Theme ──
  primaryColor: BRAND.primaryColor,
  secondaryColor: BRAND.secondaryColor,
  tabActiveColor: BRAND.accentColor,
  buttonPrimaryColor: BRAND.primaryColor,
  buttonLoginColor: '#ffffff',
  loaderPrimaryColor: BRAND.primaryColor,
  loaderSecondaryColor: BRAND.accentColor,
  loaderBackgroundColor: BRAND.backgroundColor,
  loaderStyle: 'orbit_terminal',
  botCardStyle: 'minimal',
  listItemBackgroundGradient: `linear-gradient(135deg, #1a0f2e 0%, ${BRAND.primaryColor} 45%, ${BRAND.accentColor} 100%)`,
  listItemHoverGradient: `linear-gradient(135deg, #241640 0%, ${BRAND.primaryColor} 55%, ${BRAND.accentColor} 100%)`,

  // ── Referral / marketing ──
  referralUrl: BRAND.referralUrl,
  referralTitle: 'INVITE FRIENDS',
  referralText: '',
  marketingAccounts: [],

  // ── Socials ──
  socialWhatsapp: 'https://whatsapp.com/channel/0029VbDmCLQ5a248r8IuF304',
  socialTelegram: 'https://t.me/globaltrading_hub1',
  socialInstagram: '',
  socialFacebook: '',
  socialYoutube: '',
  socialTiktok: 'https://www.tiktok.com/@issa_ke1?_r=1&_t=ZS-99l26xRbSvY',
  socialWebsite: 'https://globaltradinghub.site',

  // ── Tabs (mirror the reference site's feature set) ──
  tabs: [
    { id: 'dashboard',      label: 'Dashboard',      always: true, icon: 'FaHome',      visible: true },
    { id: 'bot_builder',    label: 'Bot Builder',    always: true, icon: 'FaRobot',     visible: true },
    { id: 'free_bots',      label: 'Free Bots',                    icon: 'FaRobot',     visible: true },
    { id: 'analysis',       label: 'Analysis',                     icon: 'FaChartLine', visible: true },
    { id: 'dtrader',        label: 'D-Trader',                     icon: 'FaChartBar',  visible: true },
    { id: 'smart_analysis', label: 'Smart Analysis',               icon: 'FaChartLine', visible: true },
    { id: 'signals',        label: 'Signals',                      icon: 'FaSignal',    visible: true },
    { id: 'matches',        label: 'Matches',                      icon: 'FaCrown',     visible: true },
    { id: 'speedbot',       label: 'Speedbot',                     icon: 'FaBolt',      visible: true },
    { id: 'charts',         label: 'Charts',                       icon: 'FaChartLine', visible: true },
    { id: 'copy_trader',    label: 'Copy Trading',                 icon: 'FaCopy',      visible: true },
  ],
};

const HLX_SITE = {
  $id: BRAND.appName.toLowerCase(),
  name: BRAND.appName,
  domains: BRAND.allowedDomains,
  domainList: BRAND.primaryDomain,
  settingsJson: JSON.stringify(HLX_SETTINGS),
  suspended: false,
  appId: DERIV_CLIENT_ID,
  brandName: BRAND.appName,
  logoUrl: '/assets/media/logo.png',
  faviconUrl: '/assets/media/favicon.png',
  primaryColor: BRAND.primaryColor,
  secondaryColor: BRAND.secondaryColor,
  accentColor: BRAND.accentColor,
  backgroundColor: BRAND.backgroundColor,
  textColor: '#e5e7eb',
  fontFamily: null,
  socialWhatsapp: 'https://whatsapp.com/channel/0029VbDmCLQ5a248r8IuF304',
  socialTelegram: 'https://t.me/globaltrading_hub1',
  socialInstagram: '',
  socialFacebook: '',
  socialYoutube: '',
  socialTiktok: 'https://www.tiktok.com/@issa_ke1?_r=1&_t=ZS-99l26xRbSvY',
  socialWebsite: 'https://globaltradinghub.site',
  referralUrl: BRAND.referralUrl,
  website: 'https://globaltradinghub.site',
  websiteUrl: 'https://globaltradinghub.site',
  tabsConfig: HLX_SETTINGS.tabs,
  includeFreeBots: true,
};

// ─── FREE BOTS LIBRARY ───────────────────────────────────────────────────────
// Served through the same /api/appwrite/bots + /bot-xml contract the bundle
// expects. `storageFileId` == the bot id so /bot-xml?id= resolves the file.
const BOT_DIR = path.join(__dirname, 'bots');
const HLX_BOTS = [];
const nowIso = new Date().toISOString();
function botCards() {
  return HLX_BOTS.map(b => ({
    id: b.id,
    displayName: b.displayName,
    description: b.description,
    folderId: b.folderId,
    folderName: b.folderName,
    category: b.category,
    storageFileId: b.id,
    createdAt: nowIso,
  }));
}

// ─── SITE AUTHENTICATION ENDPOINTS ───────────────────────────────────────────
app.get('/api/auth/health', async (req, res) => {
  try {
    const pool = await requireAuthDatabase();
    await pool.query('SELECT 1');
    res.json({ ok: true, databaseConfigured: true, databaseConnected: true });
  } catch (e) {
    res.status(e.statusCode || 500).json({
      ok: false,
      databaseConfigured: !!DATABASE_URL,
      databaseConnected: false,
      error: e.statusCode === 503 ? e.message : 'auth_database_unavailable',
    });
  }
});

app.post('/api/auth/signup', express.json(), async (req, res) => {
  try {
    const pool = await requireAuthDatabase();
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');
    const displayName = String(req.body?.displayName || req.body?.name || '').trim().slice(0, 120);
    if (!/^\\S+@\\S+\\.\\S+$/.test(email)) {
      return res.status(400).json({ ok: false, error: 'invalid_email', message: 'Enter a valid email address.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ ok: false, error: 'weak_password', message: 'Password must be at least 8 characters.' });
    }
    try {
      const created = await pool.query(
        \`INSERT INTO gth_users (email, password_hash, display_name)
         VALUES ($1, $2, $3)
         RETURNING id, email, display_name, created_at\`,
        [email, hashPassword(password), displayName]
      );
      const user = created.rows[0];
      await createSiteSession(pool, user.id, req, res);
      return res.status(201).json({ ok: true, user });
    } catch (e) {
      if (e && e.code === '23505') {
        return res.status(409).json({ ok: false, error: 'email_exists', message: 'An account with this email already exists.' });
      }
      throw e;
    }
  } catch (e) {
    res.status(e.statusCode || 500).json({
      ok: false,
      error: e.statusCode === 503 ? 'database_not_configured' : 'signup_failed',
      message: e.statusCode ? e.message : 'Unable to create account.',
    });
  }
});

app.post('/api/auth/signin', express.json(), async (req, res) => {
  try {
    const pool = await requireAuthDatabase();
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');
    const result = await pool.query(
      \`SELECT id, email, password_hash, display_name, created_at
         FROM gth_users
        WHERE email = $1
        LIMIT 1\`,
      [email]
    );
    const user = result.rows[0];
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ ok: false, error: 'invalid_credentials', message: 'Incorrect email or password.' });
    }
    await pool.query('UPDATE gth_users SET last_login_at = NOW() WHERE id = $1', [user.id]);
    await createSiteSession(pool, user.id, req, res);
    delete user.password_hash;
    return res.json({ ok: true, user });
  } catch (e) {
    res.status(e.statusCode || 500).json({
      ok: false,
      error: e.statusCode === 503 ? 'database_not_configured' : 'signin_failed',
      message: e.statusCode ? e.message : 'Unable to sign in.',
    });
  }
});

app.get('/api/auth/me', async (req, res) => {
  try {
    const { user } = await currentSiteUser(req);
    if (!user) return res.json({ ok: true, authenticated: false, user: null });
    return res.json({ ok: true, authenticated: true, user });
  } catch (e) {
    res.status(e.statusCode || 500).json({
      ok: false,
      error: e.statusCode === 503 ? 'database_not_configured' : 'session_check_failed',
      message: e.statusCode ? e.message : 'Unable to check the current session.',
    });
  }
});

app.post('/api/auth/signout', async (req, res) => {
  try {
    const pool = await requireAuthDatabase();
    const token = parseCookies(req)[AUTH_COOKIE];
    if (token) {
      const tokenHash = hashSessionToken(token);
      const session = await pool.query('SELECT user_id FROM gth_sessions WHERE token_hash = $1 LIMIT 1', [tokenHash]);
      if (session.rows[0]) {
        await pool.query('UPDATE gth_users SET last_logout_at = NOW() WHERE id = $1', [session.rows[0].user_id]);
      }
      await pool.query('DELETE FROM gth_sessions WHERE token_hash = $1', [tokenHash]);
    }
    clearAuthCookie(res);
    return res.json({ ok: true, signedOut: true });
  } catch (e) {
    clearAuthCookie(res);
    res.status(e.statusCode || 500).json({
      ok: false,
      error: e.statusCode === 503 ? 'database_not_configured' : 'signout_failed',
      message: e.statusCode ? e.message : 'Unable to sign out.',
    });
  }
});

app.post('/api/auth/signout-all', async (req, res) => {
  try {
    const { user } = await currentSiteUser(req);
    if (!user) {
      clearAuthCookie(res);
      return res.status(401).json({ ok: false, error: 'not_authenticated' });
    }
    const pool = getAuthPool();
    await pool.query('DELETE FROM gth_sessions WHERE user_id = $1', [user.id]);
    await pool.query('UPDATE gth_users SET last_logout_at = NOW() WHERE id = $1', [user.id]);
    clearAuthCookie(res);
    return res.json({ ok: true, signedOut: true, allSessions: true });
  } catch (e) {
    clearAuthCookie(res);
    res.status(e.statusCode || 500).json({
      ok: e.statusCode === 503 ? 'database_not_configured' : 'signout_all_failed',
      message: e.statusCode ? e.message : 'Unable to sign out all sessions.',
    });
  }
});

// ─── APPWRITE-CONTRACT ENDPOINTS (served locally, no external Appwrite) ───────
function jsonCors(res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
}

app.get('/api/appwrite/site-settings', (req, res) => {
  jsonCors(res); noCache(res);
  res.json({ ok: true, hostname: req.query.hostname || BRAND.primaryDomain, site: HLX_SITE });
});

app.get('/api/appwrite/site-entitlement', (req, res) => {
  jsonCors(res); noCache(res);
  res.json({ ok: true, entitlement: {
    allowed: true, status: 'active', reason: 'ok',
    hostname: req.query.hostname || BRAND.primaryDomain,
    siteId: HLX_SITE.$id, siteName: BRAND.appName, ownerId: HLX_SITE.$id, hasSiteToken: false,
  }});
});

app.get('/api/appwrite/bots', (req, res) => {
  jsonCors(res);
  res.json({ ok: true, bots: botCards() });
});

app.get('/api/appwrite/bot-xml', (req, res) => {
  const id = String(req.query.id || '');
  const bot = HLX_BOTS.find(b => b.id === id || b.file === id);
  if (!bot) return res.status(404).type('text/plain').send('bot not found');
  const full = path.join(BOT_DIR, bot.file);
  fs.readFile(full, 'utf8', (err, xml) => {
    if (err) return res.status(404).type('text/plain').send('bot xml not found');
    res.setHeader('Content-Type', 'application/xml');
    res.send(xml);
  });
});

// ─── DERIV OAUTH PKCE TOKEN EXCHANGE PROXY ───────────────────────────────────
// The bundle POSTs { grant_type, client_id, code, environment, redirect_uri,
// code_verifier } here; we forward it to Deriv's token endpoint (server-side to
// avoid browser CORS on the token endpoint) and return the JSON verbatim.
app.post('/api/oauth/token', express.json(), async (req, res) => {
  jsonCors(res); noCache(res);
  try {
    const b = req.body || {};
    const env = (b.environment || '').toString().toLowerCase();
    const tokenUrl = env === 'staging'
      ? 'https://staging-auth.deriv.com/oauth2/token'
      : 'https://auth.deriv.com/oauth2/token';
    const form = new URLSearchParams({
      grant_type: b.grant_type || 'authorization_code',
      client_id: b.client_id || DERIV_CLIENT_ID,
      code: b.code || '',
      redirect_uri: b.redirect_uri || '',
      code_verifier: b.code_verifier || '',
    });
    const upstream = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
      body: form.toString(),
    });
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    res.send(text);
  } catch (e) {
    res.status(502).json({ error: 'token_exchange_failed', detail: String(e && e.message || e) });
  }
});

// ─── HTML SHELL + STATIC ─────────────────────────────────────────────────────
app.get('/', (req, res) => {
  noCache(res);
  res.type('html').send(renderTemplate(path.join(__dirname, 'index.html')));
});
app.get('/manifest.json', (req, res) => {
  res.type('json').send(renderTemplate(path.join(__dirname, 'manifest.json')));
});

// Minimal no-op service worker: the build registers a SW for PWA support, but we
// intentionally ship one with no fetch/caching handler so nothing is cached
// (freshness matters on a trading UI) and registration stops erroring on the
// SPA-fallback HTML it otherwise received.
app.get('/service-worker.js', (req, res) => {
  noCache(res);
  res.setHeader('Content-Type', 'application/javascript');
  res.send(
    "self.addEventListener('install',function(){self.skipWaiting();});\n" +
    "self.addEventListener('activate',function(e){e.waitUntil(self.clients.claim());});\n"
  );
});
app.get(/^\/static\/js\/hlx-.*\.js$/, (req, res, next) => { noCache(res); next(); });

app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/loaders', express.static(path.join(__dirname, 'loaders')));
app.use('/static', express.static(path.join(__dirname, 'static')));
app.use('/translations', express.static(path.join(__dirname, 'translations')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/bots', express.static(BOT_DIR));
app.use('/docs', express.static(path.join(__dirname, 'docs'))); // strategy guide PDFs
app.get('/deriv-logo.svg', (req, res) => res.sendFile(path.join(__dirname, 'deriv-logo.svg')));
app.get('/robots.txt', (req, res) => res.sendFile(path.join(__dirname, 'robots.txt')));

// Legacy HYPRLVX config endpoint (kept for any of our own overlays).
app.get('/api/site-config', (req, res) => {
  jsonCors(res);
  res.sendFile(path.join(__dirname, 'api', 'site-config.html'));
});

// Featured bots (used by our own bot-library overlay).
app.get('/api/featured-bots', (req, res) => res.json({ bots: [] }));

// Empty/OK stubs for any other /api/* the bundle probes.
app.all('/api/*', (req, res) => { jsonCors(res); res.json({ ok: true, data: null, status: 'ok' }); });

// Missing static assets must 404 cleanly (never fall through to the SPA HTML) so
// webpack's chunk loader degrades gracefully instead of trying to parse HTML as JS.
app.get(['/static/*', '/assets/*', '/translations/*', '/loaders/*'], (req, res) => {
  res.status(404).type('text/plain').send('Not found');
});

// ─── SPA FALLBACK ────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  noCache(res);
  res.type('html').send(renderTemplate(path.join(__dirname, 'index.html')));
});

// Vercel invokes this file as a serverless function (via module.exports) instead
// of binding a port, so only listen when actually run as a standalone process
// (local dev / Railway).
if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`${BRAND.appName} running on port ${PORT}`));
}

module.exports = app;
 + salt + 'const path = require('path');
const fs = require('fs');
const BRAND = require('./brand.config');
const app = express();
const PORT = process.env.PORT || 3001;

// ─── TEMPLATE TOKEN RENDERING ────────────────────────────────────────────────
// index.html / manifest.json ship with %%TOKEN%% placeholders instead of
// hardcoded brand strings. Fill them in from brand.config.js on every request
// (cheap — these are small files) so editing brand.config.js is enough to
// re-skin the whole app; no rebuild step needed.
function darken(hex, amount) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (n >> 16) - amount);
  const g = Math.max(0, ((n >> 8) & 0xff) - amount);
  const b = Math.max(0, (n & 0xff) - amount);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}
const TOKENS = {
  '%%APP_NAME%%': BRAND.appName,
  '%%LOGO_TEXT_MAIN%%': BRAND.logoTextMain,
  '%%LOGO_TEXT_ACCENT%%': BRAND.logoTextAccent,
  '%%TAGLINE%%': BRAND.tagline,
  '%%DESCRIPTION%%': BRAND.description,
  '%%PRIMARY_DOMAIN%%': BRAND.primaryDomain,
  '%%ALLOWED_DOMAINS_JSON%%': JSON.stringify(BRAND.allowedDomains),
  '%%PRIMARY_COLOR%%': BRAND.primaryColor,
  '%%PRIMARY_COLOR_DARK%%': darken(BRAND.primaryColor, 0x20),
  '%%ACCENT_COLOR%%': BRAND.accentColor,
  '%%SECONDARY_COLOR%%': BRAND.secondaryColor,
  '%%BACKGROUND_COLOR%%': BRAND.backgroundColor,
  '%%FONT_FAMILY%%': `'${BRAND.fontFamily}'`,
  '%%FONT_GOOGLE_PARAM%%': BRAND.fontGoogleParam,
};
function renderTemplate(filePath) {
  let s = fs.readFileSync(filePath, 'utf8');
  for (const [token, value] of Object.entries(TOKENS)) s = s.split(token).join(value);
  return s;
}

// ─── SECURITY / ANTI-CLONE HEADERS ───────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'self'");
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

function noCache(res) {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

// ─── SITE CONFIG (sourced from brand.config.js) ──────────────────────────────
// The app build (a "Deriv site manager" build) configures itself entirely from
// /api/appwrite/site-settings: branding, theme colours, tab list, referral
// link and — crucially — the Deriv OAuth identifiers. Providing `newAppId`
// makes the bundle use the modern PKCE login flow (auth.deriv.com/oauth2/auth
// + /api/oauth/token exchange), which is what an alphanumeric client_id needs.
const DERIV_CLIENT_ID = BRAND.derivAppId;

// settingsJson is what the bundle JSON.parses first (falls back to the flat
// fields below only if this is absent). Keep the two in sync.
const HLX_SETTINGS = {
  brandName: BRAND.appName,
  platformName: BRAND.appName,
  siteTitle: `${BRAND.appName} — ${BRAND.tagline}`,
  logoUrl: '/assets/media/logo.png',
  logoFileId: '',
  faviconUrl: '/assets/media/favicon.png',
  faviconFileId: '',

  // ── Deriv OAuth ── newAppId present ⇒ PKCE flow (see bundle login builder L()).
  newAppId: DERIV_CLIENT_ID,
  oauthClientId: DERIV_CLIENT_ID,
  appId: DERIV_CLIENT_ID,
  legacyAppId: '',

  // ── Theme ──
  primaryColor: BRAND.primaryColor,
  secondaryColor: BRAND.secondaryColor,
  tabActiveColor: BRAND.accentColor,
  buttonPrimaryColor: BRAND.primaryColor,
  buttonLoginColor: '#ffffff',
  loaderPrimaryColor: BRAND.primaryColor,
  loaderSecondaryColor: BRAND.accentColor,
  loaderBackgroundColor: BRAND.backgroundColor,
  loaderStyle: 'orbit_terminal',
  botCardStyle: 'minimal',
  listItemBackgroundGradient: `linear-gradient(135deg, #1a0f2e 0%, ${BRAND.primaryColor} 45%, ${BRAND.accentColor} 100%)`,
  listItemHoverGradient: `linear-gradient(135deg, #241640 0%, ${BRAND.primaryColor} 55%, ${BRAND.accentColor} 100%)`,

  // ── Referral / marketing ──
  referralUrl: BRAND.referralUrl,
  referralTitle: 'INVITE FRIENDS',
  referralText: '',
  marketingAccounts: [],

  // ── Socials ──
  socialWhatsapp: 'https://whatsapp.com/channel/0029VbDmCLQ5a248r8IuF304',
  socialTelegram: 'https://t.me/globaltrading_hub1',
  socialInstagram: '',
  socialFacebook: '',
  socialYoutube: '',
  socialTiktok: 'https://www.tiktok.com/@issa_ke1?_r=1&_t=ZS-99l26xRbSvY',
  socialWebsite: 'https://globaltradinghub.site',

  // ── Tabs (mirror the reference site's feature set) ──
  tabs: [
    { id: 'dashboard',      label: 'Dashboard',      always: true, icon: 'FaHome',      visible: true },
    { id: 'bot_builder',    label: 'Bot Builder',    always: true, icon: 'FaRobot',     visible: true },
    { id: 'free_bots',      label: 'Free Bots',                    icon: 'FaRobot',     visible: true },
    { id: 'analysis',       label: 'Analysis',                     icon: 'FaChartLine', visible: true },
    { id: 'dtrader',        label: 'D-Trader',                     icon: 'FaChartBar',  visible: true },
    { id: 'smart_analysis', label: 'Smart Analysis',               icon: 'FaChartLine', visible: true },
    { id: 'signals',        label: 'Signals',                      icon: 'FaSignal',    visible: true },
    { id: 'matches',        label: 'Matches',                      icon: 'FaCrown',     visible: true },
    { id: 'speedbot',       label: 'Speedbot',                     icon: 'FaBolt',      visible: true },
    { id: 'charts',         label: 'Charts',                       icon: 'FaChartLine', visible: true },
    { id: 'copy_trader',    label: 'Copy Trading',                 icon: 'FaCopy',      visible: true },
  ],
};

const HLX_SITE = {
  $id: BRAND.appName.toLowerCase(),
  name: BRAND.appName,
  domains: BRAND.allowedDomains,
  domainList: BRAND.primaryDomain,
  settingsJson: JSON.stringify(HLX_SETTINGS),
  suspended: false,
  appId: DERIV_CLIENT_ID,
  brandName: BRAND.appName,
  logoUrl: '/assets/media/logo.png',
  faviconUrl: '/assets/media/favicon.png',
  primaryColor: BRAND.primaryColor,
  secondaryColor: BRAND.secondaryColor,
  accentColor: BRAND.accentColor,
  backgroundColor: BRAND.backgroundColor,
  textColor: '#e5e7eb',
  fontFamily: null,
  socialWhatsapp: 'https://whatsapp.com/channel/0029VbDmCLQ5a248r8IuF304',
  socialTelegram: 'https://t.me/globaltrading_hub1',
  socialInstagram: '',
  socialFacebook: '',
  socialYoutube: '',
  socialTiktok: 'https://www.tiktok.com/@issa_ke1?_r=1&_t=ZS-99l26xRbSvY',
  socialWebsite: 'https://globaltradinghub.site',
  referralUrl: BRAND.referralUrl,
  website: 'https://globaltradinghub.site',
  websiteUrl: 'https://globaltradinghub.site',
  tabsConfig: HLX_SETTINGS.tabs,
  includeFreeBots: true,
};

// ─── FREE BOTS LIBRARY ───────────────────────────────────────────────────────
// Served through the same /api/appwrite/bots + /bot-xml contract the bundle
// expects. `storageFileId` == the bot id so /bot-xml?id= resolves the file.
const BOT_DIR = path.join(__dirname, 'bots');
const HLX_BOTS = [];
const nowIso = new Date().toISOString();
function botCards() {
  return HLX_BOTS.map(b => ({
    id: b.id,
    displayName: b.displayName,
    description: b.description,
    folderId: b.folderId,
    folderName: b.folderName,
    category: b.category,
    storageFileId: b.id,
    createdAt: nowIso,
  }));
}

// ─── APPWRITE-CONTRACT ENDPOINTS (served locally, no external Appwrite) ───────
function jsonCors(res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
}

app.get('/api/appwrite/site-settings', (req, res) => {
  jsonCors(res); noCache(res);
  res.json({ ok: true, hostname: req.query.hostname || BRAND.primaryDomain, site: HLX_SITE });
});

app.get('/api/appwrite/site-entitlement', (req, res) => {
  jsonCors(res); noCache(res);
  res.json({ ok: true, entitlement: {
    allowed: true, status: 'active', reason: 'ok',
    hostname: req.query.hostname || BRAND.primaryDomain,
    siteId: HLX_SITE.$id, siteName: BRAND.appName, ownerId: HLX_SITE.$id, hasSiteToken: false,
  }});
});

app.get('/api/appwrite/bots', (req, res) => {
  jsonCors(res);
  res.json({ ok: true, bots: botCards() });
});

app.get('/api/appwrite/bot-xml', (req, res) => {
  const id = String(req.query.id || '');
  const bot = HLX_BOTS.find(b => b.id === id || b.file === id);
  if (!bot) return res.status(404).type('text/plain').send('bot not found');
  const full = path.join(BOT_DIR, bot.file);
  fs.readFile(full, 'utf8', (err, xml) => {
    if (err) return res.status(404).type('text/plain').send('bot xml not found');
    res.setHeader('Content-Type', 'application/xml');
    res.send(xml);
  });
});

// ─── DERIV OAUTH PKCE TOKEN EXCHANGE PROXY ───────────────────────────────────
// The bundle POSTs { grant_type, client_id, code, environment, redirect_uri,
// code_verifier } here; we forward it to Deriv's token endpoint (server-side to
// avoid browser CORS on the token endpoint) and return the JSON verbatim.
app.post('/api/oauth/token', express.json(), async (req, res) => {
  jsonCors(res); noCache(res);
  try {
    const b = req.body || {};
    const env = (b.environment || '').toString().toLowerCase();
    const tokenUrl = env === 'staging'
      ? 'https://staging-auth.deriv.com/oauth2/token'
      : 'https://auth.deriv.com/oauth2/token';
    const form = new URLSearchParams({
      grant_type: b.grant_type || 'authorization_code',
      client_id: b.client_id || DERIV_CLIENT_ID,
      code: b.code || '',
      redirect_uri: b.redirect_uri || '',
      code_verifier: b.code_verifier || '',
    });
    const upstream = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
      body: form.toString(),
    });
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    res.send(text);
  } catch (e) {
    res.status(502).json({ error: 'token_exchange_failed', detail: String(e && e.message || e) });
  }
});

// ─── HTML SHELL + STATIC ─────────────────────────────────────────────────────
app.get('/', (req, res) => {
  noCache(res);
  res.type('html').send(renderTemplate(path.join(__dirname, 'index.html')));
});
app.get('/manifest.json', (req, res) => {
  res.type('json').send(renderTemplate(path.join(__dirname, 'manifest.json')));
});

// Minimal no-op service worker: the build registers a SW for PWA support, but we
// intentionally ship one with no fetch/caching handler so nothing is cached
// (freshness matters on a trading UI) and registration stops erroring on the
// SPA-fallback HTML it otherwise received.
app.get('/service-worker.js', (req, res) => {
  noCache(res);
  res.setHeader('Content-Type', 'application/javascript');
  res.send(
    "self.addEventListener('install',function(){self.skipWaiting();});\n" +
    "self.addEventListener('activate',function(e){e.waitUntil(self.clients.claim());});\n"
  );
});
app.get(/^\/static\/js\/hlx-.*\.js$/, (req, res, next) => { noCache(res); next(); });

app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/loaders', express.static(path.join(__dirname, 'loaders')));
app.use('/static', express.static(path.join(__dirname, 'static')));
app.use('/translations', express.static(path.join(__dirname, 'translations')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/bots', express.static(BOT_DIR));
app.use('/docs', express.static(path.join(__dirname, 'docs'))); // strategy guide PDFs
app.get('/deriv-logo.svg', (req, res) => res.sendFile(path.join(__dirname, 'deriv-logo.svg')));
app.get('/robots.txt', (req, res) => res.sendFile(path.join(__dirname, 'robots.txt')));

// Legacy HYPRLVX config endpoint (kept for any of our own overlays).
app.get('/api/site-config', (req, res) => {
  jsonCors(res);
  res.sendFile(path.join(__dirname, 'api', 'site-config.html'));
});

// Featured bots (used by our own bot-library overlay).
app.get('/api/featured-bots', (req, res) => res.json({ bots: [] }));

// Empty/OK stubs for any other /api/* the bundle probes.
app.all('/api/*', (req, res) => { jsonCors(res); res.json({ ok: true, data: null, status: 'ok' }); });

// Missing static assets must 404 cleanly (never fall through to the SPA HTML) so
// webpack's chunk loader degrades gracefully instead of trying to parse HTML as JS.
app.get(['/static/*', '/assets/*', '/translations/*', '/loaders/*'], (req, res) => {
  res.status(404).type('text/plain').send('Not found');
});

// ─── SPA FALLBACK ────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  noCache(res);
  res.type('html').send(renderTemplate(path.join(__dirname, 'index.html')));
});

// Vercel invokes this file as a serverless function (via module.exports) instead
// of binding a port, so only listen when actually run as a standalone process
// (local dev / Railway).
if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`${BRAND.appName} running on port ${PORT}`));
}

module.exports = app;
 + key.toString('hex');
}

function verifyPassword(password, stored) {
  const parts = String(stored || '').split('const path = require('path');
const fs = require('fs');
const BRAND = require('./brand.config');
const app = express();
const PORT = process.env.PORT || 3001;

// ─── TEMPLATE TOKEN RENDERING ────────────────────────────────────────────────
// index.html / manifest.json ship with %%TOKEN%% placeholders instead of
// hardcoded brand strings. Fill them in from brand.config.js on every request
// (cheap — these are small files) so editing brand.config.js is enough to
// re-skin the whole app; no rebuild step needed.
function darken(hex, amount) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (n >> 16) - amount);
  const g = Math.max(0, ((n >> 8) & 0xff) - amount);
  const b = Math.max(0, (n & 0xff) - amount);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}
const TOKENS = {
  '%%APP_NAME%%': BRAND.appName,
  '%%LOGO_TEXT_MAIN%%': BRAND.logoTextMain,
  '%%LOGO_TEXT_ACCENT%%': BRAND.logoTextAccent,
  '%%TAGLINE%%': BRAND.tagline,
  '%%DESCRIPTION%%': BRAND.description,
  '%%PRIMARY_DOMAIN%%': BRAND.primaryDomain,
  '%%ALLOWED_DOMAINS_JSON%%': JSON.stringify(BRAND.allowedDomains),
  '%%PRIMARY_COLOR%%': BRAND.primaryColor,
  '%%PRIMARY_COLOR_DARK%%': darken(BRAND.primaryColor, 0x20),
  '%%ACCENT_COLOR%%': BRAND.accentColor,
  '%%SECONDARY_COLOR%%': BRAND.secondaryColor,
  '%%BACKGROUND_COLOR%%': BRAND.backgroundColor,
  '%%FONT_FAMILY%%': `'${BRAND.fontFamily}'`,
  '%%FONT_GOOGLE_PARAM%%': BRAND.fontGoogleParam,
};
function renderTemplate(filePath) {
  let s = fs.readFileSync(filePath, 'utf8');
  for (const [token, value] of Object.entries(TOKENS)) s = s.split(token).join(value);
  return s;
}

// ─── SECURITY / ANTI-CLONE HEADERS ───────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'self'");
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

function noCache(res) {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

// ─── SITE CONFIG (sourced from brand.config.js) ──────────────────────────────
// The app build (a "Deriv site manager" build) configures itself entirely from
// /api/appwrite/site-settings: branding, theme colours, tab list, referral
// link and — crucially — the Deriv OAuth identifiers. Providing `newAppId`
// makes the bundle use the modern PKCE login flow (auth.deriv.com/oauth2/auth
// + /api/oauth/token exchange), which is what an alphanumeric client_id needs.
const DERIV_CLIENT_ID = BRAND.derivAppId;

// settingsJson is what the bundle JSON.parses first (falls back to the flat
// fields below only if this is absent). Keep the two in sync.
const HLX_SETTINGS = {
  brandName: BRAND.appName,
  platformName: BRAND.appName,
  siteTitle: `${BRAND.appName} — ${BRAND.tagline}`,
  logoUrl: '/assets/media/logo.png',
  logoFileId: '',
  faviconUrl: '/assets/media/favicon.png',
  faviconFileId: '',

  // ── Deriv OAuth ── newAppId present ⇒ PKCE flow (see bundle login builder L()).
  newAppId: DERIV_CLIENT_ID,
  oauthClientId: DERIV_CLIENT_ID,
  appId: DERIV_CLIENT_ID,
  legacyAppId: '',

  // ── Theme ──
  primaryColor: BRAND.primaryColor,
  secondaryColor: BRAND.secondaryColor,
  tabActiveColor: BRAND.accentColor,
  buttonPrimaryColor: BRAND.primaryColor,
  buttonLoginColor: '#ffffff',
  loaderPrimaryColor: BRAND.primaryColor,
  loaderSecondaryColor: BRAND.accentColor,
  loaderBackgroundColor: BRAND.backgroundColor,
  loaderStyle: 'orbit_terminal',
  botCardStyle: 'minimal',
  listItemBackgroundGradient: `linear-gradient(135deg, #1a0f2e 0%, ${BRAND.primaryColor} 45%, ${BRAND.accentColor} 100%)`,
  listItemHoverGradient: `linear-gradient(135deg, #241640 0%, ${BRAND.primaryColor} 55%, ${BRAND.accentColor} 100%)`,

  // ── Referral / marketing ──
  referralUrl: BRAND.referralUrl,
  referralTitle: 'INVITE FRIENDS',
  referralText: '',
  marketingAccounts: [],

  // ── Socials ──
  socialWhatsapp: 'https://whatsapp.com/channel/0029VbDmCLQ5a248r8IuF304',
  socialTelegram: 'https://t.me/globaltrading_hub1',
  socialInstagram: '',
  socialFacebook: '',
  socialYoutube: '',
  socialTiktok: 'https://www.tiktok.com/@issa_ke1?_r=1&_t=ZS-99l26xRbSvY',
  socialWebsite: 'https://globaltradinghub.site',

  // ── Tabs (mirror the reference site's feature set) ──
  tabs: [
    { id: 'dashboard',      label: 'Dashboard',      always: true, icon: 'FaHome',      visible: true },
    { id: 'bot_builder',    label: 'Bot Builder',    always: true, icon: 'FaRobot',     visible: true },
    { id: 'free_bots',      label: 'Free Bots',                    icon: 'FaRobot',     visible: true },
    { id: 'analysis',       label: 'Analysis',                     icon: 'FaChartLine', visible: true },
    { id: 'dtrader',        label: 'D-Trader',                     icon: 'FaChartBar',  visible: true },
    { id: 'smart_analysis', label: 'Smart Analysis',               icon: 'FaChartLine', visible: true },
    { id: 'signals',        label: 'Signals',                      icon: 'FaSignal',    visible: true },
    { id: 'matches',        label: 'Matches',                      icon: 'FaCrown',     visible: true },
    { id: 'speedbot',       label: 'Speedbot',                     icon: 'FaBolt',      visible: true },
    { id: 'charts',         label: 'Charts',                       icon: 'FaChartLine', visible: true },
    { id: 'copy_trader',    label: 'Copy Trading',                 icon: 'FaCopy',      visible: true },
  ],
};

const HLX_SITE = {
  $id: BRAND.appName.toLowerCase(),
  name: BRAND.appName,
  domains: BRAND.allowedDomains,
  domainList: BRAND.primaryDomain,
  settingsJson: JSON.stringify(HLX_SETTINGS),
  suspended: false,
  appId: DERIV_CLIENT_ID,
  brandName: BRAND.appName,
  logoUrl: '/assets/media/logo.png',
  faviconUrl: '/assets/media/favicon.png',
  primaryColor: BRAND.primaryColor,
  secondaryColor: BRAND.secondaryColor,
  accentColor: BRAND.accentColor,
  backgroundColor: BRAND.backgroundColor,
  textColor: '#e5e7eb',
  fontFamily: null,
  socialWhatsapp: 'https://whatsapp.com/channel/0029VbDmCLQ5a248r8IuF304',
  socialTelegram: 'https://t.me/globaltrading_hub1',
  socialInstagram: '',
  socialFacebook: '',
  socialYoutube: '',
  socialTiktok: 'https://www.tiktok.com/@issa_ke1?_r=1&_t=ZS-99l26xRbSvY',
  socialWebsite: 'https://globaltradinghub.site',
  referralUrl: BRAND.referralUrl,
  website: 'https://globaltradinghub.site',
  websiteUrl: 'https://globaltradinghub.site',
  tabsConfig: HLX_SETTINGS.tabs,
  includeFreeBots: true,
};

// ─── FREE BOTS LIBRARY ───────────────────────────────────────────────────────
// Served through the same /api/appwrite/bots + /bot-xml contract the bundle
// expects. `storageFileId` == the bot id so /bot-xml?id= resolves the file.
const BOT_DIR = path.join(__dirname, 'bots');
const HLX_BOTS = [];
const nowIso = new Date().toISOString();
function botCards() {
  return HLX_BOTS.map(b => ({
    id: b.id,
    displayName: b.displayName,
    description: b.description,
    folderId: b.folderId,
    folderName: b.folderName,
    category: b.category,
    storageFileId: b.id,
    createdAt: nowIso,
  }));
}

// ─── APPWRITE-CONTRACT ENDPOINTS (served locally, no external Appwrite) ───────
function jsonCors(res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
}

app.get('/api/appwrite/site-settings', (req, res) => {
  jsonCors(res); noCache(res);
  res.json({ ok: true, hostname: req.query.hostname || BRAND.primaryDomain, site: HLX_SITE });
});

app.get('/api/appwrite/site-entitlement', (req, res) => {
  jsonCors(res); noCache(res);
  res.json({ ok: true, entitlement: {
    allowed: true, status: 'active', reason: 'ok',
    hostname: req.query.hostname || BRAND.primaryDomain,
    siteId: HLX_SITE.$id, siteName: BRAND.appName, ownerId: HLX_SITE.$id, hasSiteToken: false,
  }});
});

app.get('/api/appwrite/bots', (req, res) => {
  jsonCors(res);
  res.json({ ok: true, bots: botCards() });
});

app.get('/api/appwrite/bot-xml', (req, res) => {
  const id = String(req.query.id || '');
  const bot = HLX_BOTS.find(b => b.id === id || b.file === id);
  if (!bot) return res.status(404).type('text/plain').send('bot not found');
  const full = path.join(BOT_DIR, bot.file);
  fs.readFile(full, 'utf8', (err, xml) => {
    if (err) return res.status(404).type('text/plain').send('bot xml not found');
    res.setHeader('Content-Type', 'application/xml');
    res.send(xml);
  });
});

// ─── DERIV OAUTH PKCE TOKEN EXCHANGE PROXY ───────────────────────────────────
// The bundle POSTs { grant_type, client_id, code, environment, redirect_uri,
// code_verifier } here; we forward it to Deriv's token endpoint (server-side to
// avoid browser CORS on the token endpoint) and return the JSON verbatim.
app.post('/api/oauth/token', express.json(), async (req, res) => {
  jsonCors(res); noCache(res);
  try {
    const b = req.body || {};
    const env = (b.environment || '').toString().toLowerCase();
    const tokenUrl = env === 'staging'
      ? 'https://staging-auth.deriv.com/oauth2/token'
      : 'https://auth.deriv.com/oauth2/token';
    const form = new URLSearchParams({
      grant_type: b.grant_type || 'authorization_code',
      client_id: b.client_id || DERIV_CLIENT_ID,
      code: b.code || '',
      redirect_uri: b.redirect_uri || '',
      code_verifier: b.code_verifier || '',
    });
    const upstream = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
      body: form.toString(),
    });
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    res.send(text);
  } catch (e) {
    res.status(502).json({ error: 'token_exchange_failed', detail: String(e && e.message || e) });
  }
});

// ─── HTML SHELL + STATIC ─────────────────────────────────────────────────────
app.get('/', (req, res) => {
  noCache(res);
  res.type('html').send(renderTemplate(path.join(__dirname, 'index.html')));
});
app.get('/manifest.json', (req, res) => {
  res.type('json').send(renderTemplate(path.join(__dirname, 'manifest.json')));
});

// Minimal no-op service worker: the build registers a SW for PWA support, but we
// intentionally ship one with no fetch/caching handler so nothing is cached
// (freshness matters on a trading UI) and registration stops erroring on the
// SPA-fallback HTML it otherwise received.
app.get('/service-worker.js', (req, res) => {
  noCache(res);
  res.setHeader('Content-Type', 'application/javascript');
  res.send(
    "self.addEventListener('install',function(){self.skipWaiting();});\n" +
    "self.addEventListener('activate',function(e){e.waitUntil(self.clients.claim());});\n"
  );
});
app.get(/^\/static\/js\/hlx-.*\.js$/, (req, res, next) => { noCache(res); next(); });

app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/loaders', express.static(path.join(__dirname, 'loaders')));
app.use('/static', express.static(path.join(__dirname, 'static')));
app.use('/translations', express.static(path.join(__dirname, 'translations')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/bots', express.static(BOT_DIR));
app.use('/docs', express.static(path.join(__dirname, 'docs'))); // strategy guide PDFs
app.get('/deriv-logo.svg', (req, res) => res.sendFile(path.join(__dirname, 'deriv-logo.svg')));
app.get('/robots.txt', (req, res) => res.sendFile(path.join(__dirname, 'robots.txt')));

// Legacy HYPRLVX config endpoint (kept for any of our own overlays).
app.get('/api/site-config', (req, res) => {
  jsonCors(res);
  res.sendFile(path.join(__dirname, 'api', 'site-config.html'));
});

// Featured bots (used by our own bot-library overlay).
app.get('/api/featured-bots', (req, res) => res.json({ bots: [] }));

// Empty/OK stubs for any other /api/* the bundle probes.
app.all('/api/*', (req, res) => { jsonCors(res); res.json({ ok: true, data: null, status: 'ok' }); });

// Missing static assets must 404 cleanly (never fall through to the SPA HTML) so
// webpack's chunk loader degrades gracefully instead of trying to parse HTML as JS.
app.get(['/static/*', '/assets/*', '/translations/*', '/loaders/*'], (req, res) => {
  res.status(404).type('text/plain').send('Not found');
});

// ─── SPA FALLBACK ────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  noCache(res);
  res.type('html').send(renderTemplate(path.join(__dirname, 'index.html')));
});

// Vercel invokes this file as a serverless function (via module.exports) instead
// of binding a port, so only listen when actually run as a standalone process
// (local dev / Railway).
if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`${BRAND.appName} running on port ${PORT}`));
}

module.exports = app;
);
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const expected = Buffer.from(parts[2], 'hex');
  const actual = crypto.scryptSync(String(password), parts[1], expected.length);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function hashSessionToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function issueAuthCookie(res, token) {
  res.setHeader('Set-Cookie',
    AUTH_COOKIE + '=' + encodeURIComponent(token) +
    '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + SESSION_TTL_SECONDS
  );
}

function clearAuthCookie(res) {
  res.setHeader('Set-Cookie',
    AUTH_COOKIE + '=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'
  );
}

async function createSiteSession(pool, userId, req, res) {
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashSessionToken(token);
  await pool.query(
    \`INSERT INTO gth_sessions (user_id, token_hash, expires_at, user_agent, ip_address)
     VALUES ($1, $2, NOW() + ($3 || ' seconds')::interval, $4, $5)\`,
    [
      userId,
      tokenHash,
      SESSION_TTL_SECONDS,
      String(req.headers['user-agent'] || '').slice(0, 1000),
      String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].slice(0, 100),
    ]
  );
  issueAuthCookie(res, token);
}

async function currentSiteUser(req) {
  const pool = await requireAuthDatabase();
  const token = parseCookies(req)[AUTH_COOKIE];
  if (!token) return { pool, user: null };
  const result = await pool.query(
    \`SELECT u.id, u.email, u.display_name, u.created_at
       FROM gth_sessions s
       JOIN gth_users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > NOW()
      LIMIT 1\`,
    [hashSessionToken(token)]
  );
  return { pool, user: result.rows[0] || null };
}

const path = require('path');
const fs = require('fs');
const BRAND = require('./brand.config');
const app = express();
const PORT = process.env.PORT || 3001;

// ─── TEMPLATE TOKEN RENDERING ────────────────────────────────────────────────
// index.html / manifest.json ship with %%TOKEN%% placeholders instead of
// hardcoded brand strings. Fill them in from brand.config.js on every request
// (cheap — these are small files) so editing brand.config.js is enough to
// re-skin the whole app; no rebuild step needed.
function darken(hex, amount) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (n >> 16) - amount);
  const g = Math.max(0, ((n >> 8) & 0xff) - amount);
  const b = Math.max(0, (n & 0xff) - amount);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}
const TOKENS = {
  '%%APP_NAME%%': BRAND.appName,
  '%%LOGO_TEXT_MAIN%%': BRAND.logoTextMain,
  '%%LOGO_TEXT_ACCENT%%': BRAND.logoTextAccent,
  '%%TAGLINE%%': BRAND.tagline,
  '%%DESCRIPTION%%': BRAND.description,
  '%%PRIMARY_DOMAIN%%': BRAND.primaryDomain,
  '%%ALLOWED_DOMAINS_JSON%%': JSON.stringify(BRAND.allowedDomains),
  '%%PRIMARY_COLOR%%': BRAND.primaryColor,
  '%%PRIMARY_COLOR_DARK%%': darken(BRAND.primaryColor, 0x20),
  '%%ACCENT_COLOR%%': BRAND.accentColor,
  '%%SECONDARY_COLOR%%': BRAND.secondaryColor,
  '%%BACKGROUND_COLOR%%': BRAND.backgroundColor,
  '%%FONT_FAMILY%%': `'${BRAND.fontFamily}'`,
  '%%FONT_GOOGLE_PARAM%%': BRAND.fontGoogleParam,
};
function renderTemplate(filePath) {
  let s = fs.readFileSync(filePath, 'utf8');
  for (const [token, value] of Object.entries(TOKENS)) s = s.split(token).join(value);
  return s;
}

// ─── SECURITY / ANTI-CLONE HEADERS ───────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'self'");
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

function noCache(res) {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

// ─── SITE CONFIG (sourced from brand.config.js) ──────────────────────────────
// The app build (a "Deriv site manager" build) configures itself entirely from
// /api/appwrite/site-settings: branding, theme colours, tab list, referral
// link and — crucially — the Deriv OAuth identifiers. Providing `newAppId`
// makes the bundle use the modern PKCE login flow (auth.deriv.com/oauth2/auth
// + /api/oauth/token exchange), which is what an alphanumeric client_id needs.
const DERIV_CLIENT_ID = BRAND.derivAppId;

// settingsJson is what the bundle JSON.parses first (falls back to the flat
// fields below only if this is absent). Keep the two in sync.
const HLX_SETTINGS = {
  brandName: BRAND.appName,
  platformName: BRAND.appName,
  siteTitle: `${BRAND.appName} — ${BRAND.tagline}`,
  logoUrl: '/assets/media/logo.png',
  logoFileId: '',
  faviconUrl: '/assets/media/favicon.png',
  faviconFileId: '',

  // ── Deriv OAuth ── newAppId present ⇒ PKCE flow (see bundle login builder L()).
  newAppId: DERIV_CLIENT_ID,
  oauthClientId: DERIV_CLIENT_ID,
  appId: DERIV_CLIENT_ID,
  legacyAppId: '',

  // ── Theme ──
  primaryColor: BRAND.primaryColor,
  secondaryColor: BRAND.secondaryColor,
  tabActiveColor: BRAND.accentColor,
  buttonPrimaryColor: BRAND.primaryColor,
  buttonLoginColor: '#ffffff',
  loaderPrimaryColor: BRAND.primaryColor,
  loaderSecondaryColor: BRAND.accentColor,
  loaderBackgroundColor: BRAND.backgroundColor,
  loaderStyle: 'orbit_terminal',
  botCardStyle: 'minimal',
  listItemBackgroundGradient: `linear-gradient(135deg, #1a0f2e 0%, ${BRAND.primaryColor} 45%, ${BRAND.accentColor} 100%)`,
  listItemHoverGradient: `linear-gradient(135deg, #241640 0%, ${BRAND.primaryColor} 55%, ${BRAND.accentColor} 100%)`,

  // ── Referral / marketing ──
  referralUrl: BRAND.referralUrl,
  referralTitle: 'INVITE FRIENDS',
  referralText: '',
  marketingAccounts: [],

  // ── Socials ──
  socialWhatsapp: 'https://whatsapp.com/channel/0029VbDmCLQ5a248r8IuF304',
  socialTelegram: 'https://t.me/globaltrading_hub1',
  socialInstagram: '',
  socialFacebook: '',
  socialYoutube: '',
  socialTiktok: 'https://www.tiktok.com/@issa_ke1?_r=1&_t=ZS-99l26xRbSvY',
  socialWebsite: 'https://globaltradinghub.site',

  // ── Tabs (mirror the reference site's feature set) ──
  tabs: [
    { id: 'dashboard',      label: 'Dashboard',      always: true, icon: 'FaHome',      visible: true },
    { id: 'bot_builder',    label: 'Bot Builder',    always: true, icon: 'FaRobot',     visible: true },
    { id: 'free_bots',      label: 'Free Bots',                    icon: 'FaRobot',     visible: true },
    { id: 'analysis',       label: 'Analysis',                     icon: 'FaChartLine', visible: true },
    { id: 'dtrader',        label: 'D-Trader',                     icon: 'FaChartBar',  visible: true },
    { id: 'smart_analysis', label: 'Smart Analysis',               icon: 'FaChartLine', visible: true },
    { id: 'signals',        label: 'Signals',                      icon: 'FaSignal',    visible: true },
    { id: 'matches',        label: 'Matches',                      icon: 'FaCrown',     visible: true },
    { id: 'speedbot',       label: 'Speedbot',                     icon: 'FaBolt',      visible: true },
    { id: 'charts',         label: 'Charts',                       icon: 'FaChartLine', visible: true },
    { id: 'copy_trader',    label: 'Copy Trading',                 icon: 'FaCopy',      visible: true },
  ],
};

const HLX_SITE = {
  $id: BRAND.appName.toLowerCase(),
  name: BRAND.appName,
  domains: BRAND.allowedDomains,
  domainList: BRAND.primaryDomain,
  settingsJson: JSON.stringify(HLX_SETTINGS),
  suspended: false,
  appId: DERIV_CLIENT_ID,
  brandName: BRAND.appName,
  logoUrl: '/assets/media/logo.png',
  faviconUrl: '/assets/media/favicon.png',
  primaryColor: BRAND.primaryColor,
  secondaryColor: BRAND.secondaryColor,
  accentColor: BRAND.accentColor,
  backgroundColor: BRAND.backgroundColor,
  textColor: '#e5e7eb',
  fontFamily: null,
  socialWhatsapp: 'https://whatsapp.com/channel/0029VbDmCLQ5a248r8IuF304',
  socialTelegram: 'https://t.me/globaltrading_hub1',
  socialInstagram: '',
  socialFacebook: '',
  socialYoutube: '',
  socialTiktok: 'https://www.tiktok.com/@issa_ke1?_r=1&_t=ZS-99l26xRbSvY',
  socialWebsite: 'https://globaltradinghub.site',
  referralUrl: BRAND.referralUrl,
  website: 'https://globaltradinghub.site',
  websiteUrl: 'https://globaltradinghub.site',
  tabsConfig: HLX_SETTINGS.tabs,
  includeFreeBots: true,
};

// ─── FREE BOTS LIBRARY ───────────────────────────────────────────────────────
// Served through the same /api/appwrite/bots + /bot-xml contract the bundle
// expects. `storageFileId` == the bot id so /bot-xml?id= resolves the file.
const BOT_DIR = path.join(__dirname, 'bots');
const HLX_BOTS = [];
const nowIso = new Date().toISOString();
function botCards() {
  return HLX_BOTS.map(b => ({
    id: b.id,
    displayName: b.displayName,
    description: b.description,
    folderId: b.folderId,
    folderName: b.folderName,
    category: b.category,
    storageFileId: b.id,
    createdAt: nowIso,
  }));
}

// ─── APPWRITE-CONTRACT ENDPOINTS (served locally, no external Appwrite) ───────
function jsonCors(res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
}

app.get('/api/appwrite/site-settings', (req, res) => {
  jsonCors(res); noCache(res);
  res.json({ ok: true, hostname: req.query.hostname || BRAND.primaryDomain, site: HLX_SITE });
});

app.get('/api/appwrite/site-entitlement', (req, res) => {
  jsonCors(res); noCache(res);
  res.json({ ok: true, entitlement: {
    allowed: true, status: 'active', reason: 'ok',
    hostname: req.query.hostname || BRAND.primaryDomain,
    siteId: HLX_SITE.$id, siteName: BRAND.appName, ownerId: HLX_SITE.$id, hasSiteToken: false,
  }});
});

app.get('/api/appwrite/bots', (req, res) => {
  jsonCors(res);
  res.json({ ok: true, bots: botCards() });
});

app.get('/api/appwrite/bot-xml', (req, res) => {
  const id = String(req.query.id || '');
  const bot = HLX_BOTS.find(b => b.id === id || b.file === id);
  if (!bot) return res.status(404).type('text/plain').send('bot not found');
  const full = path.join(BOT_DIR, bot.file);
  fs.readFile(full, 'utf8', (err, xml) => {
    if (err) return res.status(404).type('text/plain').send('bot xml not found');
    res.setHeader('Content-Type', 'application/xml');
    res.send(xml);
  });
});

// ─── DERIV OAUTH PKCE TOKEN EXCHANGE PROXY ───────────────────────────────────
// The bundle POSTs { grant_type, client_id, code, environment, redirect_uri,
// code_verifier } here; we forward it to Deriv's token endpoint (server-side to
// avoid browser CORS on the token endpoint) and return the JSON verbatim.
app.post('/api/oauth/token', express.json(), async (req, res) => {
  jsonCors(res); noCache(res);
  try {
    const b = req.body || {};
    const env = (b.environment || '').toString().toLowerCase();
    const tokenUrl = env === 'staging'
      ? 'https://staging-auth.deriv.com/oauth2/token'
      : 'https://auth.deriv.com/oauth2/token';
    const form = new URLSearchParams({
      grant_type: b.grant_type || 'authorization_code',
      client_id: b.client_id || DERIV_CLIENT_ID,
      code: b.code || '',
      redirect_uri: b.redirect_uri || '',
      code_verifier: b.code_verifier || '',
    });
    const upstream = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
      body: form.toString(),
    });
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    res.send(text);
  } catch (e) {
    res.status(502).json({ error: 'token_exchange_failed', detail: String(e && e.message || e) });
  }
});

// ─── HTML SHELL + STATIC ─────────────────────────────────────────────────────
app.get('/', (req, res) => {
  noCache(res);
  res.type('html').send(renderTemplate(path.join(__dirname, 'index.html')));
});
app.get('/manifest.json', (req, res) => {
  res.type('json').send(renderTemplate(path.join(__dirname, 'manifest.json')));
});

// Minimal no-op service worker: the build registers a SW for PWA support, but we
// intentionally ship one with no fetch/caching handler so nothing is cached
// (freshness matters on a trading UI) and registration stops erroring on the
// SPA-fallback HTML it otherwise received.
app.get('/service-worker.js', (req, res) => {
  noCache(res);
  res.setHeader('Content-Type', 'application/javascript');
  res.send(
    "self.addEventListener('install',function(){self.skipWaiting();});\n" +
    "self.addEventListener('activate',function(e){e.waitUntil(self.clients.claim());});\n"
  );
});
app.get(/^\/static\/js\/hlx-.*\.js$/, (req, res, next) => { noCache(res); next(); });

app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/loaders', express.static(path.join(__dirname, 'loaders')));
app.use('/static', express.static(path.join(__dirname, 'static')));
app.use('/translations', express.static(path.join(__dirname, 'translations')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/bots', express.static(BOT_DIR));
app.use('/docs', express.static(path.join(__dirname, 'docs'))); // strategy guide PDFs
app.get('/deriv-logo.svg', (req, res) => res.sendFile(path.join(__dirname, 'deriv-logo.svg')));
app.get('/robots.txt', (req, res) => res.sendFile(path.join(__dirname, 'robots.txt')));

// Legacy HYPRLVX config endpoint (kept for any of our own overlays).
app.get('/api/site-config', (req, res) => {
  jsonCors(res);
  res.sendFile(path.join(__dirname, 'api', 'site-config.html'));
});

// Featured bots (used by our own bot-library overlay).
app.get('/api/featured-bots', (req, res) => res.json({ bots: [] }));

// Empty/OK stubs for any other /api/* the bundle probes.
app.all('/api/*', (req, res) => { jsonCors(res); res.json({ ok: true, data: null, status: 'ok' }); });

// Missing static assets must 404 cleanly (never fall through to the SPA HTML) so
// webpack's chunk loader degrades gracefully instead of trying to parse HTML as JS.
app.get(['/static/*', '/assets/*', '/translations/*', '/loaders/*'], (req, res) => {
  res.status(404).type('text/plain').send('Not found');
});

// ─── SPA FALLBACK ────────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  noCache(res);
  res.type('html').send(renderTemplate(path.join(__dirname, 'index.html')));
});

// Vercel invokes this file as a serverless function (via module.exports) instead
// of binding a port, so only listen when actually run as a standalone process
// (local dev / Railway).
if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`${BRAND.appName} running on port ${PORT}`));
}

module.exports = app;
