/* Global Trading Hub WebSocket compatibility bridge.
 * Anonymous bootstrap uses Deriv's documented public v3 WebSocket endpoint
 * without the old app_id=1089/brand query that is producing HTTP 520 here.
 * Authenticated sockets are left untouched.
 */
(function () {
	function hasValidAuthSession() {
		try {
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
			var isDerivSocket =
				/(^|\.)derivws\.com$/i.test(url.hostname) ||
				/(^|\.)binaryws\.com$/i.test(url.hostname);
			if (!isDerivSocket || !/\/websockets\/v3(?:\/|$)/i.test(url.pathname)) return input;

			url.protocol = 'wss:';
			url.hostname = 'ws.binaryws.com';

			if (!hasValidAuthSession()) {
				url.searchParams.delete('app_id');
				url.searchParams.delete('brand');
			}
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
