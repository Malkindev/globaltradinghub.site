/* Global Trading Hub Deriv WebSocket compatibility bridge.
 * Keeps public market-data sockets on Deriv's current secure endpoint and
 * preserves the authenticated OAuth socket URL created by the app.
 */
(function () {
  var APP_ID = '34qTQa7RfqxpXXpuMDb1k';
  var PUBLIC_APP_ID = '1089';

  function loggedIn() {
    try {
      if (sessionStorage.getItem('auth_info')) return true;
      var accounts = JSON.parse(localStorage.getItem('accountsList') || '{}');
      return accounts && typeof accounts === 'object' && Object.keys(accounts).length > 0;
    } catch (e) {
      return false;
    }
  }

  function fixUrl(input) {
    if (typeof input !== 'string') return input;

    var url = input;

    // Deriv sockets must use TLS. Older builds may emit ws://.
    if (/^http:\/\//i.test(url)) url = url.replace(/^http:\/\//i, 'wss://');
    else if (/^https:\/\//i.test(url)) url = url.replace(/^https:\/\//i, 'wss://');
    else if (/^ws:\/\//i.test(url)) url = url.replace(/^ws:\/\//i, 'wss://');

    // Normalize old Deriv WebSocket hostnames to the current endpoint.
    if (/^wss?:\/\/(?:ws\.)?binaryws\.com/i.test(url) ||
        /^wss?:\/\/[^/]*derivws\.com/i.test(url)) {
      url = url.replace(/^wss?:\/\/[^/]+/i, 'wss://ws.derivws.com');
    }

    // Only rewrite classic v3 sockets carrying an app_id query parameter.
    if (/\/websockets\/v3(?:\?|$)/i.test(url) && /[?&]app_id=/i.test(url)) {
      var appId = loggedIn() ? APP_ID : PUBLIC_APP_ID;
      url = url.replace(/([?&]app_id=)[^&]+/i, '$1' + appId);
    }

    return url;
  }

  try {
    var OriginalWebSocket = window.WebSocket;
    window.WebSocket = new Proxy(OriginalWebSocket, {
      construct: function (Target, args) {
        try {
          if (args && typeof args[0] === 'string') {
            var fixed = fixUrl(args[0]);
            if (fixed !== args[0]) {
              args = args.slice();
              args[0] = fixed;
            }
          }
        } catch (e) {}
        return Reflect.construct(Target, args);
      }
    });
    window.WebSocket.prototype = OriginalWebSocket.prototype;
  } catch (e) {
    // Leave native WebSocket untouched if Proxy is unavailable.
  }
})();
