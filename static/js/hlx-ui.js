/* ─────────────────────────────────────────────────────────────────────────
   Global Trading Hub UI overlay
   Post-render styling & behaviours matching autotrades.site:
     • clean pill tab styling & active states
     • deep teal (#064e72) Blockly block headers
     • dark navy (#0f2a5a) Quick strategy button
     • clean white background and navigation
     • rebrand generic strings to Global Trading Hub
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  var css = document.createElement('style');
  css.textContent =
    '.social-icons-btn,[aria-label="Social Media"]{cursor:pointer !important;' +
      'filter:drop-shadow(0 0 6px rgba(15,42,90,.25));transition:filter .3s,transform .3s}' +
    '.social-icons-btn:hover,[aria-label="Social Media"]:hover{transform:scale(1.08);' +
      'filter:drop-shadow(0 0 10px rgba(15,42,90,.4))}' +
    '.social-icons-modal__link[data-hlx-link]{text-decoration:none !important}' +
    /* Quick Strategy button styling (autotrades navy pill) */
    '#db-toolbar__get-started-button,.toolbar__btn--start{background:#0f2a5a !important;color:#fff !important;' +
      'border:none !important;border-radius:6px !important;font-weight:600 !important;box-shadow:0 1px 3px rgba(15,42,90,.2) !important}' +
    '#db-toolbar__get-started-button svg,.toolbar__btn--start svg{fill:#fff !important;color:#fff !important}' +
    '#db-toolbar__get-started-button:hover,.toolbar__btn--start:hover{background:#1e3a8a !important}' +
    /* Blocks menu button (autotrades clean border) */
    '#db-toolbar__blocks-button,.toolbar__btn--blocks{background:#fff !important;color:#334155 !important;' +
      'border:1px solid #cbd5e1 !important;border-radius:6px !important;font-weight:500 !important}' +
    '#db-toolbar__blocks-button:hover,.toolbar__btn--blocks:hover{background:#f8fafc !important;border-color:#94a3b8 !important}' +
    /* Toolbox / Blocks menu categories */
    '.db-toolbox{background:#fff !important;border-right:1px solid #e2e8f0 !important}' +
    '.db-toolbox__title{color:#0f2a5a !important;font-weight:700 !important}' +
    '.db-toolbox__category--selected{background-color:#064e72 !important;border-radius:6px !important}' +
    '.db-toolbox__category--selected .db-toolbox__category-text,.db-toolbox__category--selected span{color:#fff !important}' +
    /* Workspace canvas */
    '.injectionDiv,svg.blocklySvg{background-color:#f8fafc !important}' +
    /* Root block SVG headers (autotrades deep teal #064e72) */
    'path.blocklyPath[fill="#3b82f6"],path.blocklyPath[fill="#002D62"],path.blocklyPath[fill="#002d62"],' +
    'path.blocklyPath[fill="#191970"],path.blocklyPath[fill="#0e0e4c"]{fill:#064e72 !important}' +
    '.blocklyText.blocklyTextRootBlockHeader{fill:#fff !important;font-weight:600 !important}' +
    /* Bottom run panel */
    '.main__run-strategy-wrapper,.db-run-panel{background:#fff !important;border-top:1px solid #e2e8f0 !important}' +
    '.btn--run,.db-run-panel__button--run,button.dc-btn--green{background:#10b981 !important;color:#fff !important;border-radius:6px !important;font-weight:600 !important}' +
    '.btn--run:hover,.db-run-panel__button--run:hover,button.dc-btn--green:hover{background:#059669 !important}';
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
  var BRAND_RE = /\b(D[-‑]?Bot|Binary[Tt]ool|HYPRLVX)\b/g;
  var AUTHOR_RE = /Trader\s*Mike/gi;
  function rewrite() {
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null), n;
    while ((n = w.nextNode())) {
      var v = n.nodeValue;
      if (v && BRAND_RE.test(v)) v = v.replace(BRAND_RE, 'Global Trading Hub');
      if (v && AUTHOR_RE.test(v)) v = v.replace(AUTHOR_RE, 'Global Trading Hub');
      if (v !== n.nodeValue) n.nodeValue = v;
    }
    document.querySelectorAll('h1,h2,h3,[class*="title"],[class*="heading"]').forEach(function (el) {
      if (el.__hlxTitled) return;
      var txt = (el.textContent || '').trim();
      if (/analysis\s?tool|Analysis/i.test(txt) && txt.length < 40) {
        el.__hlxTitled = true;
        el.style.color = '#064e72';
      }
    });

    // Color root block headers to autotrades teal #064e72
    var rootPaths = document.querySelectorAll('path.blocklyPath');
    for (var i = 0; i < rootPaths.length; i++) {
      var fill = rootPaths[i].getAttribute('fill');
      if (fill === '#3b82f6' || fill === '#002D62' || fill === '#002d62' || fill === '#191970' || fill === '#0e0e4c') {
        rootPaths[i].setAttribute('fill', '#064e72');
      }
    }
  }

  var scheduled = false;
  function run() { scheduled = false; try { rewrite(); addExtraLinks(); } catch (e) {} }
  function schedule() { if (!scheduled) { scheduled = true; requestAnimationFrame(run); } }
  function start() {
    run();
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, characterData: true });
    loadExtraLinks();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
