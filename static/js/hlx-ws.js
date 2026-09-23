/* Global Trading Hub Deriv WebSocket compatibility bridge.
 * Use Deriv's current secure WebSocket host. Do not confuse the OAuth
 * client_id with the classic WebSocket app_id.
 */
(function () {
  var PUBLIC_APP_ID = '1089';

  function fixUrl(input) {
    if (typeof input !== 'string') return input;

    var url = input;

    // Always use TLS for Deriv sockets.
    if (/^http:\/\//i.test(url)) url = url.replace(/^http:\/\//i, 'wss://');
    else if (/^https:\/\//i.test(url)) url = url.replace(/^https:\/\//i, 'wss://');
    else if (/^ws:\/\//i.test(url)) url = url.replace(/^ws:\/\//i, 'wss://');

    // Older template code can emit ws.binaryws.com. Deriv's current
    // documented v3 WebSocket endpoint is ws.derivws.com.
    if (/^wss?:\/\/[^/]*binaryws\.com/i.test(url)) {
      url = url.replace(/^wss?:\/\/[^/]+/i, 'wss://ws.derivws.com');
    }

    // For classic v3 sockets, preserve numeric app IDs (including the
    // separate PAT/token app ID). If the old bundle supplied an alphanumeric
    // OAuth client ID, use the public numeric app ID for anonymous data.
    if (/\/websockets\/v3(?:\?|$)/i.test(url) && /[?&]app_id=/i.test(url)) {
      var match = url.match(/[?&]app_id=([^&]+)/i);
      var current = match && match[1] ? decodeURIComponent(match[1]) : '';
      if (!/^\d+$/.test(current)) {
        url = url.replace(/([?&]app_id=)[^&]+/i, '$1' + PUBLIC_APP_ID);
      }
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
  } catch (e) {}
})();
