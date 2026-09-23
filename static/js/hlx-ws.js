/* ─────────────────────────────────────────────────────────────────────────
   Global Trading Hub WebSocket app_id bridge
   Two jobs, both done by intercepting `new WebSocket(url)` before the bundle
   opens its Deriv sockets (this file loads before the app bundle):

   1. PUBLIC DATA / CHARTS — anonymous bootstrap traffic is routed to Deriv's
      documented public WebSocket endpoint with App ID 1089. This prevents the
      failing public handshake observed on ws.derivws.com.

   2. AUTHENTICATED TRADING — once signed in, the app receives an authenticated
      WebSocket URL from Deriv's OTP endpoint. Those URLs are connection-specific,
      so this bridge leaves them untouched.

   Also normalises http(s):// → ws(s):// (some in-app webviews throw otherwise).
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  var PUBLIC_APP_ID = '1089';               // Deriv public app for anonymous data

  // `active_loginid` alone is NOT proof of a real session — the app also sets
  // it for the anonymous "?account=demo" preview mode, with no auth_info/account
  // list behind it. Trusting it alone made every anonymous visit look "logged
  // in", so the public data socket got the alphanumeric app_id (which Deriv's
  // server rejects for anonymous connections), causing an endless reconnect
  // loop that left the boot loader stuck forever.
  function hasValidAuthSession() {
    try {
      if (new URLSearchParams(window.location.search).get('account') === 'demo') return false;
      var raw = sessionStorage.getItem('auth_info');
      if (raw) {
        var info = JSON.parse(raw);
        if (info && info.access_token && (!info.expires_at || Date.now() < Number(info.expires_at))) return true;
      }
      var token = localStorage.getItem('authToken');
      var loginid = localStorage.getItem('active_loginid');
      return !!(token && token !== 'null' && loginid && loginid !== 'null');
    } catch (e) { return false; }
  }

  function fixUrl(u) {
    if (typeof u !== 'string') return u;

    try {
      var url = new URL(u);

      // Anonymous/public bootstrap traffic uses Deriv's documented legacy
      // public WebSocket endpoint. The current ws.derivws.com edge is returning
      // HTTP 520 during the browser handshake for this site, which prevents
      // the app from completing initialization and leaves the custom loader
      // intentionally parked at 98%.
      var isDerivSocket = /^(ws\\.)?(derivws\\.com|binaryws\\.com)$/i.test(url.hostname) ||
        /(^|\\.)derivws\\.com$/i.test(url.hostname) ||
        /(^|\\.)binaryws\\.com$/i.test(url.hostname);

      if (!isDerivSocket || !url.pathname.includes('/websockets/v3')) return u;

      // The app obtains authenticated WebSocket URLs from Deriv's OTP endpoint.
      // Never rewrite those URLs: they may carry connection-specific routing.
      if (hasValidAuthSession()) return u;

      // Public/anonymous market data is the only traffic this bridge rewrites.
      // Use Deriv's documented public WebSocket endpoint and test App ID.
      if (url.protocol === 'http:') url.protocol = 'ws:';
      if (url.protocol === 'https:') url.protocol = 'wss:';
      url.hostname = 'ws.binaryws.com';
      url.searchParams.set('app_id', PUBLIC_APP_ID);
      url.searchParams.delete('brand');

      return url.toString();
    } catch (e) {
      return u;
    }
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
