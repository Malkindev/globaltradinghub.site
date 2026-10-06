/* Global Trading Hub WebSocket compatibility bridge.
 * Keep the app on Deriv's official legacy v3 WebSocket endpoint.
 * The previous bridge was stripping app_id and forcing ws.binaryws.com,
 * which produced the exact 520 handshake error seen in the browser.
 */
(function () {
	var FALLBACK_LEGACY_APP_ID = '65555';

	function isDerivV3(input) {
		if (typeof input !== 'string') return false;
		try {
			var url = new URL(input);
			return /(^|\.)derivws\.com$/i.test(url.hostname) &&
				/\/websockets\/v3(?:\/|$)/i.test(url.pathname);
		} catch (e) {
			return false;
		}
	}

	function fixUrl(input) {
		if (!isDerivV3(input)) return input;
		try {
			var url = new URL(input);
			url.protocol = 'wss:';
			url.hostname = 'ws.derivws.com';

			// Never remove the app_id: the v3 endpoint expects the application
			// identifier. Preserve a valid existing numeric id, otherwise use
			// the production legacy id configured for this project.
			var appId = String(url.searchParams.get('app_id') || '').trim();
			if (!/^\d+$/.test(appId) || Number(appId) <= 0) {
				url.searchParams.set('app_id', FALLBACK_LEGACY_APP_ID);
			}
			return url.toString();
		} catch (e) {
			return input;
		}
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