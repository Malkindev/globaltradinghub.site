const express = require('express');
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
  legacyAppId: DERIV_CLIENT_ID,

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
  socialWhatsapp: '', socialTelegram: '', socialInstagram: '',
  socialFacebook: '', socialYoutube: '', socialTiktok: '', socialWebsite: '',

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
  socialWhatsapp: '',
  socialTelegram: '',
  tabsConfig: HLX_SETTINGS.tabs,
  includeFreeBots: true,
};

// ─── FREE BOTS LIBRARY ───────────────────────────────────────────────────────
// Served through the same /api/appwrite/bots + /bot-xml contract the bundle
// expects. `storageFileId` == the bot id so /bot-xml?id= resolves the file.
const BOT_DIR = path.join(__dirname, 'bots');
const HLX_BOTS = [
  { id: 'hyprlvx-pro-ai', file: 'HyprlvxProAI.xml', displayName: 'HYPRLVX Pro AI', description: 'Advanced AI-powered signal engine built exclusively for HYPRLVX', category: 'AI Signal', folderId: 'hyprlvx', folderName: 'HYPRLVX' },
  { id: 'ximi',           file: 'XIMI.xml',         displayName: 'XIMI',           description: 'Even/Odd digit bot with virtual loss filter and martingale recovery', category: 'Digits', folderId: 'hyprlvx', folderName: 'HYPRLVX' },
  { id: 'bluebeam',       file: 'BlueBeam.xml',     displayName: 'BlueBeam Pro AI', description: 'Over/Under digit strategy with dual-window market analysis', category: 'Over/Under', folderId: 'hyprlvx', folderName: 'HYPRLVX' },
  { id: 'dark-owl',       file: 'DarkOwl.xml',      displayName: 'Dark Owl',       description: 'Alternating Under 4 / Over 5 strategy with smart martingale', category: 'Over/Under', folderId: 'hyprlvx', folderName: 'HYPRLVX' },
  { id: 'black-box-spider', file: 'BlackBoxSpider.xml', displayName: 'Black Box Spider', description: 'Under 4 / Over 5 strategy that waits for 3 consecutive virtual losses before entering a real trade, with TP/SL and 1.8x martingale recovery', category: 'Over/Under', folderId: 'hyprlvx', folderName: 'HYPRLVX' },
];
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
app.get('/api/featured-bots', (req, res) => res.json({ bots: [
  { id: 'hyprlvx-pro-ai', name: 'HYPRLVX Pro AI', file: '/bots/HyprlvxProAI.xml', description: 'Advanced AI-powered signal engine built exclusively for HYPRLVX', category: 'AI Signal', badge: 'EXCLUSIVE' },
  { id: 'ximi', name: 'XIMI', file: '/bots/XIMI.xml', description: 'Even/Odd digit bot with virtual loss filter and martingale recovery', category: 'Digits', badge: 'POPULAR' },
  { id: 'bluebeam', name: 'BlueBeam Pro AI', file: '/bots/BlueBeam.xml', description: 'Over/Under digit strategy with dual-window market analysis', category: 'Over/Under', badge: 'HOT' },
  { id: 'dark-owl', name: 'Dark Owl', file: '/bots/DarkOwl.xml', description: 'Alternating Under 4 / Over 5 strategy with smart martingale', category: 'Over/Under', badge: null },
]}));

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
