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

	function isDemoMode() {
		try { return new URLSearchParams(window.location.search).get('account') === 'demo'; }
		catch (e) { return false; }
	}

	function createDemoFallbackSocket(url) {
		var listeners = {};
		var socket = {
			url: url,
			readyState: 1,
			bufferedAmount: 0,
			protocol: '',
			extensions: '',
			binaryType: 'blob',
			addEventListener: function (type, listener) {
				(listeners[type] || (listeners[type] = [])).push(listener);
			},
			removeEventListener: function (type, listener) {
				listeners[type] = (listeners[type] || []).filter(function (item) { return item !== listener; });
			},
			dispatchEvent: function (event) {
				(listeners[event.type] || []).slice().forEach(function (listener) { listener.call(socket, event); });
				var handler = socket['on' + event.type];
				if (typeof handler === 'function') handler.call(socket, event);
				return true;
			},
			send: function () {},
			close: function () {
				if (socket.readyState === 3) return;
				socket.readyState = 3;
				socket.dispatchEvent({ type: 'close', target: socket });
			},
			onopen: null,
			onerror: null,
			onclose: null,
			onmessage: null
		};
		setTimeout(function () { socket.dispatchEvent({ type: 'open', target: socket }); }, 0);
		return socket;
	}

	try {
		var OriginalWebSocket = window.WebSocket;
		window.WebSocket = new Proxy(OriginalWebSocket, {
			construct: function (Target, args) {
				try {
					if (args && typeof args[0] === 'string') {
						var fixed = fixUrl(args[0]);
						if (fixed !== args[0]) { args = args.slice(); args[0] = fixed; }
						if (isDemoMode() && /\/websockets\/v3(?:\/|\?|$)/i.test(fixed)) {
							return createDemoFallbackSocket(fixed);
						}
					}
				} catch (e) {}
				return Reflect.construct(Target, args);
			}
		});
		window.WebSocket.prototype = OriginalWebSocket.prototype;
	} catch (e) {}
})();
