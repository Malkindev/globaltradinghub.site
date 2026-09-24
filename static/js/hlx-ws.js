/* Global Trading Hub Deriv WebSocket compatibility bridge.
 * Anonymous bootstrap uses the public numeric app ID. Authenticated API-token
 * and OAuth sessions retain the app ID supplied by the application.
 *
 * Demo mode has a local bootstrap socket because the legacy public WebSocket can
 * return an HTTP 520 handshake on some browser/network paths. The bootstrap
 * socket must answer the requests used by API initialization; a socket that only
 * reports "open" but never responds leaves api_base.init() waiting forever.
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
			url.hostname = 'ws.binaryws.com';
			url.searchParams.set('app_id', PUBLIC_APP_ID);
			return url.toString();
		} catch (e) { return input; }
	}

	function isDemoMode() {
		try { return new URLSearchParams(window.location.search).get('account') === 'demo'; }
		catch (e) { return false; }
	}

	function bootstrapSymbols() {
		return [
			{symbol:'1HZ10V', display_name:'Volatility 10 (1s) Index', symbol_type:'synthetic_index', pip:2, pip_size:2},
			{symbol:'R_10', display_name:'Volatility 10 Index', symbol_type:'synthetic_index', pip:3, pip_size:3},
			{symbol:'1HZ25V', display_name:'Volatility 25 (1s) Index', symbol_type:'synthetic_index', pip:2, pip_size:2},
			{symbol:'R_25', display_name:'Volatility 25 Index', symbol_type:'synthetic_index', pip:3, pip_size:3},
			{symbol:'1HZ50V', display_name:'Volatility 50 (1s) Index', symbol_type:'synthetic_index', pip:2, pip_size:2},
			{symbol:'R_50', display_name:'Volatility 50 Index', symbol_type:'synthetic_index', pip:3, pip_size:3},
			{symbol:'1HZ75V', display_name:'Volatility 75 (1s) Index', symbol_type:'synthetic_index', pip:2, pip_size:2},
			{symbol:'R_75', display_name:'Volatility 75 Index', symbol_type:'synthetic_index', pip:4, pip_size:4},
			{symbol:'1HZ100V', display_name:'Volatility 100 (1s) Index', symbol_type:'synthetic_index', pip:2, pip_size:2},
			{symbol:'R_100', display_name:'Volatility 100 Index', symbol_type:'synthetic_index', pip:2, pip_size:2}
		];
	}

	function mockResponse(request) {
		var req = request && typeof request === 'object' ? request : {};
		var base = { echo_req: req };
		if (req.req_id !== undefined) base.req_id = req.req_id;

		if (req.active_symbols) {
			base.msg_type = 'active_symbols';
			base.active_symbols = bootstrapSymbols();
			return base;
		}
		if (req.time) {
			base.msg_type = 'time';
			base.time = Math.floor(Date.now() / 1000);
			return base;
		}
		if (req.ping) {
			base.msg_type = 'ping';
			base.ping = 'pong';
			return base;
		}
		if (req.get_settings) {
			base.msg_type = 'get_settings';
			base.get_settings = {country_code:'ke'};
			return base;
		}
		if (req.landing_company) {
			base.msg_type = 'landing_company';
			base.landing_company = {name:req.landing_company};
			return base;
		}
		if (req.get_account_status) {
			base.msg_type = 'get_account_status';
			base.get_account_status = {};
			return base;
		}
		if (req.website_status) {
			base.msg_type = 'website_status';
			base.website_status = {site_status:'up'};
			return base;
		}
		return null;
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
			send: function (data) {
				var request = data;
				try { if (typeof request === 'string') request = JSON.parse(request); } catch (e) { request = {}; }
				var response = mockResponse(request);
				if (!response) return;
				setTimeout(function () {
					socket.dispatchEvent({ type: 'message', data: JSON.stringify(response), target: socket });
				}, 0);
			},
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
						if (isDemoMode() && /\/websockets\/v3(?:\/|\\?|$)/i.test(fixed)) {
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
