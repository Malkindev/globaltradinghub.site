/* ─────────────────────────────────────────────────────────────────────────
   HYPRLVX UI overlay
   Post-render behaviours the compiled build doesn't expose through config:
     • route the header chat / social icon to WhatsApp,
     • theme the Analysis-tool title,
     • swap the generic "D-Bot / Binarytool" brand tokens to HYPRLVX.
   The header logo lockup itself is handled by pure CSS in index.html (React
   reconciles injected DOM away, so we never inject persistent nodes here).
   WhatsApp uses document-level event delegation for the same reason.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  var css = document.createElement('style');
  css.textContent =
    '.social-icons-btn,[aria-label="Social Media"]{cursor:pointer !important;' +
      'filter:drop-shadow(0 0 6px rgba(37,211,102,.5));transition:filter .3s,transform .3s}' +
    '.social-icons-btn:hover,[aria-label="Social Media"]:hover{transform:scale(1.08);' +
      'filter:drop-shadow(0 0 13px rgba(37,211,102,.95))}' +
    '.social-icons-modal__link[data-hlx-link]{text-decoration:none !important}';
  document.head.appendChild(css);

  var extraLinks = null;
  function loadExtraLinks() {
    fetch('/api/appwrite/site-settings?hostname=' + encodeURIComponent(window.location.hostname))
      .then(function (response) { return response.json(); })
      .then(function (payload) {
        var site = payload && payload.site || {};
        var settings = site.settingsJson;
        if (typeof settings === 'string') {
          try { settings = JSON.parse(settings); } catch (e) { settings = {}; }
        }
        settings = settings || {};
        extraLinks = [
          { key: 'referralUrl', label: 'Deriv Affiliate', icon: '↗', href: settings.referralUrl || site.referralUrl },
          { key: 'socialWebsite', label: 'Global Trading Hub', icon: '◉', href: settings.socialWebsite || site.websiteUrl }
        ].filter(function (link) { return /^https:\/\//i.test(link.href || ''); });
        addExtraLinks();
      })
      .catch(function () {});
  }

  function addExtraLinks() {
    if (!extraLinks) return;
    var firstLink = document.querySelector('a.social-icons-modal__link');
    var container = firstLink && firstLink.parentElement;
    if (!container) return;
    extraLinks.forEach(function (link) {
      if (container.querySelector('[data-hlx-link="' + link.key + '"]')) return;
      var anchor = document.createElement('a');
      anchor.className = 'social-icons-modal__link';
      anchor.dataset.hlxLink = link.key;
      anchor.href = link.href;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.innerHTML = '<span aria-hidden="true">' + link.icon + '</span><span>' + link.label + '</span>';
      container.appendChild(anchor);
    });
  }

  // ── Brand-token swap + Analysis-tool title theming ──
  var BRAND_RE = /\b(D[-‑]?Bot|Binary[Tt]ool)\b/g;
  var AUTHOR_RE = /Trader\s*Mike/gi;
  function rewrite() {
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null), n;
    while ((n = w.nextNode())) {
      var v = n.nodeValue;
      if (v && BRAND_RE.test(v)) v = v.replace(BRAND_RE, 'HYPRLVX');
      if (v && AUTHOR_RE.test(v)) v = v.replace(AUTHOR_RE, 'Sapplanta');
      if (v !== n.nodeValue) n.nodeValue = v;
    }
    document.querySelectorAll('h1,h2,h3,[class*="title"],[class*="heading"]').forEach(function (el) {
      if (el.__hlxTitled) return;
      var txt = (el.textContent || '').trim();
      if (/analysis\s?tool|HYPRLVX\s*Analysis/i.test(txt) && txt.length < 40) {
        el.__hlxTitled = true;
        el.style.color = '#9d6ef0';
        el.style.textShadow = '0 0 14px rgba(114,62,195,.5)';
      }
    });
  }

  var scheduled = false;
  function run() { scheduled = false; try { rewrite(); } catch (e) {} }
  function schedule() { if (!scheduled) { scheduled = true; requestAnimationFrame(run); } }
  function start() {
    run();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, characterData: true });
    loadExtraLinks();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
