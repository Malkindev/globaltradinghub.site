// ─────────────────────────────────────────────────────────────────────────
// BRAND CONFIG — the ONE file you need to edit to re-skin this template.
// Read HOW_TO_CUSTOMIZE.txt for the full walkthrough.
// ─────────────────────────────────────────────────────────────────────────
module.exports = {
  // ── Identity ──────────────────────────────────────────────────────────
  // Your app's full name, shown in the browser tab, loader screen and header.
  appName: 'YOURAPP',
  // The loader/header wordmark can be two-tone (e.g. "HYPR" + "LVX").
  // Split your app name across these two — set logoTextAccent to '' for a
  // single solid-color wordmark instead.
  logoTextMain: 'YOUR',
  logoTextAccent: 'APP',
  // Short tagline shown under the app name on the loader and in meta tags.
  tagline: 'Your Tagline Here',
  description: 'YOURAPP is an AI-powered automated trading platform on Deriv. Build and run trading bots, scan live markets, and let the AI Copilot suggest and deploy winning strategies.',

  // ── Deriv OAuth App ID ───────────────────────────────────────────────
  // Register your own app at https://api.deriv.com/dashboard (or your
  // Deriv-account "Manage applications" page) and paste the client_id here.
  // This single value drives newAppId / oauthClientId / appId / legacyAppId.
  derivAppId: '34qTQa7RfqxpXXpuMDb1k',

  // ── Domain lock ───────────────────────────────────────────────────────
  // Hostnames the app is allowed to run on (plus localhost/127.0.0.1, which
  // are always allowed for local dev). Add every domain you deploy to.
  allowedDomains: ['globaltradinghub.site', 'www.globaltradinghub.site'],
  primaryDomain: 'globaltradinghub.site',

  // ── Branding colors ───────────────────────────────────────────────────
  // primaryColor  — main brand color (buttons, active states, glow)
  // accentColor   — lighter highlight tone (hover states, active tab, wordmark)
  // secondaryColor— dark neutral used behind cards/surfaces
  // backgroundColor — page background (usually near-black)
  primaryColor: '#723EC3',
  accentColor: '#9d6ef0',
  secondaryColor: '#0b0f19',
  backgroundColor: '#0a0713',

  // ── Font ──────────────────────────────────────────────────────────────
  // fontFamily is the CSS font name used everywhere (UI text + wordmark).
  // fontGoogleParam is the matching Google Fonts CSS2 API "family" query
  // param (weights included) — must load the same font fontFamily names.
  // Change both together. Some options:
  //   Inter            -> 'Inter:wght@300;400;500;600;700;800'
  //   Poppins          -> 'Poppins:wght@300;400;500;600;700;800'
  //   Sora             -> 'Sora:wght@300;400;500;600;700;800'
  //   Space Grotesk    -> 'Space+Grotesk:wght@300;400;500;600;700'
  //   IBM Plex Sans    -> 'IBM+Plex+Sans:wght@300;400;500;600;700'
  //   Orbitron         -> 'Orbitron:wght@400;500;600;700;800;900'
  //   JetBrains Mono   -> 'JetBrains+Mono:wght@300;400;500;600;700'
  //   Playfair Display -> 'Playfair+Display:wght@400;500;600;700;800'
  //   Pirata One       -> 'Pirata+One'
  fontFamily: 'Inter',
  fontGoogleParam: 'Inter:wght@300;400;500;600;700;800',

  // ── Referral / marketing (optional) ──────────────────────────────────
  referralUrl: 'https://track.deriv.com/_oq3-w9_7dyRZl7VyVw174GNd7ZgqdRLk/1/',

  // ── Image assets ──────────────────────────────────────────────────────
  // Drop your own files into assets/media using these EXACT filenames and
  // nothing else needs to change:
  //   assets/media/logo.png     — square logo / app icon (also used as the
  //                               header mark and PWA icon)
  //   assets/media/favicon.png  — browser tab icon
  //   assets/media/loader.png   — big splash/loader image shown on boot
  //   assets/media/og-banner.png— social share preview image (1672x941)
};
