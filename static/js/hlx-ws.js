/* Global Trading Hub Deriv WebSocket compatibility bridge.
 * Anonymous bootstrap uses the public numeric app ID. Authenticated API-token
 * and OAuth sessions retain the app ID supplied by the application.
 */
(function () {
	var PUBLIC_APP_ID = '1089';

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

	function fixUrl(input) {
		if (typeof input !== 'string') return input;
		try {
			var url = new URL(input);
			var isDerivSocket = /(^|\.)derivws\.com$/i.test(url.hostname) ||
				/(^|\.)binaryws\.com$/i.test(url.hostname);
			if (!isDerivSocket || !/\/websockets\/v3(?:\/|$)/i.test(url.pathname)) return input;

			url.protocol = 'wss:';
			url.hostname = 'ws.derivws.com';
			if (!hasValidAuthSession()) url.searchParams.set('app_id', PUBLIC_APP_ID);
			return url.toString();
		} catch (e) { return input; }
	}

	try {
		var OriginalWebSocket = window.WebSocket;
		window.WebSocket = new Proxy(OriginalWebSocket, {
			construct: function (Target, args) {
				try {
					if (args && typeof args[0] === 'string') {
						var fixed = fixUrl(args[0]);
						if (fixed !== args[0]) { args = args.slice(); args[0] = fixed; }
					}
				} catch (e) {}
				return Reflect.construct(Target, args);
			}
		});
		window.WebSocket.prototype = OriginalWebSocket.prototype;
	} catch (e) {}
})();
