/* ─────────────────────────────────────────────────────────────────────────
   HYPRLVX WebSocket app_id bridge
   Two jobs, both done by intercepting `new WebSocket(url)` before the bundle
   opens its Deriv sockets (this file loads before the app bundle):

   1. COMMISSION — every authenticated trade must run over a socket opened with
      HYPRLVX's own Deriv app_id so the app-markup commission accrues to it. The
      bundle derives the WS app_id by parseInt()-ing the alphanumeric client_id,
      which yields a wrong numeric ("33"); we rewrite it back to the real app id.

   2. PUBLIC DATA / CHARTS — Deriv's tick-history socket rejects the alphanumeric
      client_id for anonymous (logged-out) requests, which is why the Charts /
      Analysis feeds intermittently fail to render before login. When logged out
      we use Deriv's public app_id (1089) so public data always streams; once
      logged in we use the HYPRLVX app id so trades are attributed for markup.

   Also normalises http(s):// → ws(s):// (some in-app webviews throw otherwise).
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  var HLX_APP_ID = '33HS50xlw11qkkHSmGdxh'; // HYPRLVX Deriv app (markup / commission)
  var PUBLIC_APP_ID = '1089';               // Deriv public app for anonymous data

  // `active_loginid` alone is NOT proof of a real session — the app also sets
  // it for the anonymous "?account=demo" preview mode, with no auth_info/account
  // list behind it. Trusting it alone made every anonymous visit look "logged
  // in", so the public data socket got the alphanumeric app_id (which Deriv's
  // server rejects for anonymous connections), causing an endless reconnect
  // loop that left the boot loader stuck forever.
  function loggedIn() {
    try {
      if (sessionStorage.getItem('auth_info')) return true;
      var a = JSON.parse(localStorage.getItem('client_account_details') || '[]');
      return Array.isArray(a) && a.length > 0;
    } catch (e) { return false; }
  }

  function fixUrl(u) {
    if (typeof u !== 'string') return u;
    // scheme normalise
    if (/^https:\/\//i.test(u)) u = u.replace(/^https:\/\//i, 'wss://');
    else if (/^http:\/\//i.test(u)) u = u.replace(/^http:\/\//i, 'ws://');
    // only touch Deriv trading/data sockets
    if (/websockets\/v3|derivws\.com|binaryws\.com/i.test(u) && /[?&]app_id=/.test(u)) {
      var want = loggedIn() ? HLX_APP_ID : PUBLIC_APP_ID;
      u = u.replace(/([?&]app_id=)[^&]+/, '$1' + want);
    }
    return u;
  }

  try {
    var Orig = window.WebSocket;
    window.WebSocket = new Proxy(Orig, {
      construct: function (target, args) {
        try {
          if (typeof args[0] === 'string') {
            var u = fixUrl(args[0]);
            if (u !== args[0]) { args = args.slice(); args[0] = u; }
          }
        } catch (e) {}
        return Reflect.construct(target, args);
      }
    });
    window.WebSocket.prototype = Orig.prototype;
  } catch (e) { /* leave native WebSocket untouched */ }
})();
