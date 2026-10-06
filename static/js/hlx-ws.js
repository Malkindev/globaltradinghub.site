/* Global Trading Hub WebSocket compatibility bridge.
 *
 * The public legacy Deriv v3 socket is currently returning HTTP 520 from the
 * browser/network path used by this site. The application only needs the
 * public socket during anonymous bootstrap; letting that handshake fail keeps
 * the React application inside its Suspense loader indefinitely.
 *
 * Therefore anonymous v3 bootstrap traffic uses a local, standards-shaped
 * bootstrap socket with the responses needed to render the app. Authenticated
 * sessions are NOT mocked: their real Deriv WebSocket is left untouched.
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
    } catch (e) {
      return false;
    }
  }

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

  function syntheticSymbols() {
    return [
      { symbol:'1HZ10V', underlying_symbol:'1HZ10V', display_name:'Volatility 10 (1s) Index', underlying_symbol_name:'Volatility 10 (1s) Index', market:'synthetic_index', market_display_name:'Synthetic Indices', submarket:'random_index', submarket_display_name:'Continuous Indices', symbol_type:'synthetic_index', pip:2, pip_size:2, exchange_is_open:1, is_trading_suspended:0 },
      { symbol:'R_10', underlying_symbol:'R_10', display_name:'Volatility 10 Index', underlying_symbol_name:'Volatility 10 Index', market:'synthetic_index', market_display_name:'Synthetic Indices', submarket:'random_index', submarket_display_name:'Continuous Indices', symbol_type:'synthetic_index', pip:3, pip_size:3, exchange_is_open:1, is_trading_suspended:0 },
      { symbol:'1HZ25V', underlying_symbol:'1HZ25V', display_name:'Volatility 25 (1s) Index', underlying_symbol_name:'Volatility 25 (1s) Index', market:'synthetic_index', market_display_name:'Synthetic Indices', submarket:'random_index', submarket_display_name:'Continuous Indices', symbol_type:'synthetic_index', pip:2, pip_size:2, exchange_is_open:1, is_trading_suspended:0 },
      { symbol:'R_25', underlying_symbol:'R_25', display_name:'Volatility 25 Index', underlying_symbol_name:'Volatility 25 Index', market:'synthetic_index', market_display_name:'Synthetic Indices', submarket:'random_index', submarket_display_name:'Continuous Indices', symbol_type:'synthetic_index', pip:3, pip_size:3, exchange_is_open:1, is_trading_suspended:0 },
      { symbol:'1HZ50V', underlying_symbol:'1HZ50V', display_name:'Volatility 50 (1s) Index', underlying_symbol_name:'Volatility 50 (1s) Index', market:'synthetic_index', market_display_name:'Synthetic Indices', submarket:'random_index', submarket_display_name:'Continuous Indices', symbol_type:'synthetic_index', pip:2, pip_size:2, exchange_is_open:1, is_trading_suspended:0 },
      { symbol:'R_50', underlying_symbol:'R_50', display_name:'Volatility 50 Index', underlying_symbol_name:'Volatility 50 Index', market:'synthetic_index', market_display_name:'Synthetic Indices', submarket:'random_index', submarket_display_name:'Continuous Indices', symbol_type:'synthetic_index', pip:3, pip_size:3, exchange_is_open:1, is_trading_suspended:0 },
      { symbol:'1HZ75V', underlying_symbol:'1HZ75V', display_name:'Volatility 75 (1s) Index', underlying_symbol_name:'Volatility 75 (1s) Index', market:'synthetic_index', market_display_name:'Synthetic Indices', submarket:'random_index', submarket_display_name:'Continuous Indices', symbol_type:'synthetic_index', pip:2, pip_size:2, exchange_is_open:1, is_trading_suspended:0 },
      { symbol:'R_75', underlying_symbol:'R_75', display_name:'Volatility 75 Index', underlying_symbol_name:'Volatility 75 Index', market:'synthetic_index', market_display_name:'Synthetic Indices', submarket:'random_index', submarket_display_name:'Continuous Indices', symbol_type:'synthetic_index', pip:4, pip_size:4, exchange_is_open:1, is_trading_suspended:0 },
      { symbol:'1HZ100V', underlying_symbol:'1HZ100V', display_name:'Volatility 100 (1s) Index', underlying_symbol_name:'Volatility 100 (1s) Index', market:'synthetic_index', market_display_name:'Synthetic Indices', submarket:'random_index', submarket_display_name:'Continuous Indices', symbol_type:'synthetic_index', pip:2, pip_size:2, exchange_is_open:1, is_trading_suspended:0 },
      { symbol:'R_100', underlying_symbol:'R_100', display_name:'Volatility 100 Index', underlying_symbol_name:'Volatility 100 Index', market:'synthetic_index', market_display_name:'Synthetic Indices', submarket:'random_index', submarket_display_name:'Continuous Indices', symbol_type:'synthetic_index', pip:2, pip_size:2, exchange_is_open:1, is_trading_suspended:0 }
    ];
  }

  function tradingTimes() {
    var markets = [{
      name: 'synthetic_index',
      submarkets: [{
        name: 'random_index',
        symbols: syntheticSymbols().map(function (s) {
          return {
            symbol: s.symbol,
            times: { open: ['00:00:00'], close: ['23:59:59'] }
          };
        })
      }]
    }];
    return markets;
  }

  function sampleHistory(req) {
    var now = Math.floor(Date.now() / 1000);
    var base = 1000;
    var count = Math.min(Math.max(Number(req && req.count) || 50, 1), 100);
    var prices = [];
    var times = [];
    for (var i = count - 1; i >= 0; i--) {
      var epoch = now - i;
      var wave = Math.sin(epoch / 7) * 3 + Math.sin(epoch / 23) * 1.2;
      prices.push(Number((base + wave).toFixed(2)));
      times.push(epoch);
    }
    return { prices: prices, times: times };
  }

  function mockResponse(request) {
    var req = request && typeof request === 'object' ? request : {};
    var base = { echo_req: req };
    if (req.req_id !== undefined) base.req_id = req.req_id;

    if (req.active_symbols) {
      base.msg_type = 'active_symbols';
      base.active_symbols = syntheticSymbols();
      return base;
    }
    if (req.trading_times) {
      base.msg_type = 'trading_times';
      base.trading_times = { markets: tradingTimes() };
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
    if (req.website_status) {
      base.msg_type = 'website_status';
      base.website_status = { site_status:'up', clients_country:'ke' };
      return base;
    }
    if (req.get_settings) {
      base.msg_type = 'get_settings';
      base.get_settings = { country_code:'ke', currency:'USD' };
      return base;
    }
    if (req.landing_company) {
      base.msg_type = 'landing_company';
      base.landing_company = { shortcode:String(req.landing_company || 'svg'), name:'Deriv' };
      return base;
    }
    if (req.get_account_status) {
      base.msg_type = 'get_account_status';
      base.get_account_status = { status:[] };
      return base;
    }
    if (req.contracts_for) {
      base.msg_type = 'contracts_for';
      base.contracts_for = { available:[] };
      return base;
    }
    if (req.ticks_history) {
      base.msg_type = 'history';
      base.history = sampleHistory(req);
      if (req.subscribe) {
        base.subscription = { id:'bootstrap-' + Date.now() };
      }
      return base;
    }
    if (req.forget || req.forget_all) {
      base.msg_type = req.forget_all ? 'forget_all' : 'forget';
      base.forget = { delete_count:1 };
      return base;
    }
    return base;
  }

  function createBootstrapSocket(url) {
    var listeners = {};
    var socket = {
      url: url,
      readyState: 0,
      bufferedAmount: 0,
      protocol: '',
      extensions: '',
      binaryType: 'blob',
      addEventListener: function (type, listener) {
        if (typeof listener !== 'function') return;
        (listeners[type] || (listeners[type] = [])).push(listener);
      },
      removeEventListener: function (type, listener) {
        listeners[type] = (listeners[type] || []).filter(function (item) { return item !== listener; });
      },
      dispatchEvent: function (event) {
        var type = event && event.type;
        (listeners[type] || []).slice().forEach(function (listener) {
          try { listener.call(socket, event); } catch (e) {}
        });
        var handler = socket['on' + type];
        if (typeof handler === 'function') {
          try { handler.call(socket, event); } catch (e) {}
        }
        return true;
      },
      send: function (data) {
        var request = data;
        try { if (typeof request === 'string') request = JSON.parse(request); } catch (e) { request = {}; }
        if (socket.readyState !== 1) return;
        var response = mockResponse(request);
        setTimeout(function () {
          socket.dispatchEvent({ type:'message', data:JSON.stringify(response), target:socket });
        }, 0);
      },
      close: function (code, reason) {
        if (socket.readyState === 3) return;
        socket.readyState = 3;
        socket.dispatchEvent({ type:'close', code:code || 1000, reason:reason || '', wasClean:true, target:socket });
      },
      onopen: null,
      onerror: null,
      onclose: null,
      onmessage: null
    };
    setTimeout(function () {
      if (socket.readyState !== 0) return;
      socket.readyState = 1;
      socket.dispatchEvent({ type:'open', target:socket });
    }, 0);
    return socket;
  }

  try {
    var OriginalWebSocket = window.WebSocket;
    var WrappedWebSocket = new Proxy(OriginalWebSocket, {
      construct: function (Target, args) {
        try {
          if (args && typeof args[0] === 'string' && isDerivV3(args[0]) && !hasValidAuthSession()) {
            return createBootstrapSocket(args[0]);
          }
        } catch (e) {}
        return Reflect.construct(Target, args);
      }
    });

    // Preserve the native static constants and prototype checks exposed by
    // browsers. The proxy target already carries the WebSocket constants.
    window.WebSocket = WrappedWebSocket;
  } catch (e) {}
})();