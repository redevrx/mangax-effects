(function () {
  var config = { type: 'toggle', engine: 'novel', options: {}, permissions: [], auto: false };
  var run = null;

  // What menu.items answers here. The app's list depends on the engine and the page.
  var MENU_KEYS = {
    manga: ['scan', 'effects', 'full_context_scan', 'settings'],
    novel: ['scan', 'effects', 'read_aloud', 'settings']
  };

  var MENU_ICONS = {
    scan: 'document_scanner', effects: 'auto_fix_high', full_context_scan: 'auto_awesome',
    read_aloud: 'record_voice_over', settings: 'settings'
  };

  var COMMAND_PERMISSIONS = {
    toast: 'toast',
    'menu.items': 'menu', 'menu.press': 'menu', 'menu.replace': 'menu',
    'engine.get': null,
    'engine.set': 'engine'
  };

  function log(kind, text) {
    console.log('%c[mangax] ' + kind, 'color:#8b5cf6;font-weight:bold', text);
  }

  function stop(r, why) {
    if (!r || r.stopped) return;
    r.stopped = true;
    for (var i = r.cleanups.length - 1; i >= 0; i--) {
      try { r.cleanups[i](); } catch (e) { log('cleanup error', e); }
    }
    r.cleanups = [];
    if (run === r) run = null;
    log('stopped', why || '');
  }

  function fail(r, e) {
    if (r.stopped) return;
    log('error — the app would switch the effect off and show:', (e && e.message) || String(e));
    console.error(e);
    stop(r, 'after an error');
  }

  function guard(r, fn) {
    return function () {
      if (r.stopped) return undefined;
      try { return fn.apply(this, arguments); } catch (e) { fail(r, e); }
      return undefined;
    };
  }

  function cleanup(r, fn) {
    if (r.stopped) { try { fn(); } catch (e) {} return; }
    r.cleanups.push(fn);
  }

  function context(r) {
    var ctx = {
      id: 'devtools.test',
      options: config.options,
      engine: config.engine,
      site: location.host,
      auto: !!config.auto,
      on: function (target, type, fn, options) {
        if (!target || typeof target.addEventListener !== 'function') {
          throw new TypeError('ctx.on(target, type, fn): target must be an element, document or window, got ' + JSON.stringify(target));
        }
        var handler = guard(r, fn);
        target.addEventListener(type, handler, options);
        cleanup(r, function () { target.removeEventListener(type, handler, options); });
      },
      observe: function (selector, fn) {
        if (typeof selector !== 'string') throw new TypeError('ctx.observe(selector, fn): selector must be one CSS selector string');
        var seen = new WeakSet();
        var call = guard(r, fn);
        function visit(node) {
          if (!node || node.nodeType !== 1 || seen.has(node)) return;
          seen.add(node);
          call(node);
        }
        function scan(root) {
          if (!root || root.nodeType !== 1) return;
          if (root.matches && root.matches(selector)) visit(root);
          var found = root.querySelectorAll(selector);
          for (var i = 0; i < found.length; i++) visit(found[i]);
        }
        scan(document.documentElement);
        var observer = new MutationObserver(function (records) {
          if (r.stopped) return;
          for (var i = 0; i < records.length; i++) {
            for (var j = 0; j < records[i].addedNodes.length; j++) scan(records[i].addedNodes[j]);
          }
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
        cleanup(r, function () { observer.disconnect(); });
      },
      addStyle: function (css) {
        var el = document.createElement('style');
        el.setAttribute('data-mangax-effect', ctx.id);
        el.textContent = String(css);
        (document.head || document.documentElement).appendChild(el);
        cleanup(r, function () { if (el.parentNode) el.parentNode.removeChild(el); });
        return el;
      },
      onOptions: function (fn) { r.optionListeners.push(guard(r, fn)); },
      onUrlChange: function (fn) {
        var last = location.href;
        var handler = guard(r, fn);
        var timer = setInterval(function () {
          if (location.href !== last) { last = location.href; handler(last); }
        }, 500);
        cleanup(r, function () { clearInterval(timer); });
      },
      onEvent: function (name, fn) {
        if (typeof fn !== 'function') throw new TypeError('ctx.onEvent(name, fn): fn must be a function');
        var entry = { name: String(name), fn: guard(r, fn) };
        r.eventListeners.push(entry);
        if (entry.name === 'page:overlay') watchOverlays(r);
        cleanup(r, function () {
          var i = r.eventListeners.indexOf(entry);
          if (i >= 0) r.eventListeners.splice(i, 1);
        });
      },
      call: function (cmd, args) {
        if (!(cmd in COMMAND_PERMISSIONS)) return Promise.reject(new Error('unknown command "' + cmd + '"'));
        var needs = COMMAND_PERMISSIONS[cmd];
        if (needs && config.permissions.indexOf(needs) < 0) {
          return Promise.reject(new Error('"' + cmd + '" needs the "' + needs + '" permission in effect.json'));
        }
        args = args || {};
        switch (cmd) {
          case 'toast':
            log('toast', args.text);
            return Promise.resolve(null);
          case 'menu.items':
            return Promise.resolve({
              engine: config.engine,
              items: MENU_KEYS[config.engine].map(function (key) { return { key: key, label: key, icon: MENU_ICONS[key], active: false }; })
            });
          case 'menu.press':
            if (MENU_KEYS[config.engine].indexOf(args.key) < 0) {
              return Promise.reject(new Error('the menu has no "' + args.key + '" button right now'));
            }
            log('menu.press', args.key);
            return Promise.resolve(null);
          case 'menu.replace':
            log('menu.replace', args.on === false ? 'menu button back' : 'menu button hidden while this runs');
            return Promise.resolve(args.on !== false);
          case 'engine.get':
            return Promise.resolve(config.engine);
          case 'engine.set':
            if (args.type !== 'manga' && args.type !== 'novel') {
              return Promise.reject(new Error('"engine.set" needs { type: "manga" | "novel" }'));
            }
            if (args.type !== config.engine) {
              config.engine = args.type;
              emit('engine:change', { type: args.type });
              emit('menu:change', { engine: config.engine, items: MENU_KEYS[config.engine].map(function (key) {
                return { key: key, label: key, icon: MENU_ICONS[key], active: false };
              }) });
            }
            return Promise.resolve(args.type);
        }
      },
      toast: function (text) { return ctx.call('toast', { text: String(text) }); },
      stop: function () { stop(r, 'by the effect'); }
    };
    return ctx;
  }

  // page:overlay, raised the way the app raises it: every pinned box that comes up, once.
  function watchOverlays(r) {
    if (r.overlayWatch) return;
    var shown = new Set(), seq = 0, lastTap = 0, timer = 0, lastScan = 0;
    function box(el, style) {
      if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) < 0.05) return null;
      var b = el.getBoundingClientRect(), vw = innerWidth, vh = innerHeight;
      var left = Math.max(b.left, 0), top = Math.max(b.top, 0);
      var w = Math.min(b.right, vw) - left, h = Math.min(b.bottom, vh) - top;
      if (w <= 0 || h <= 0 || w * h < 400) return null;
      return { left: left, top: top, width: w, height: h, cover: (w * h) / (vw * vh) };
    }
    function scan() {
      timer = 0;
      lastScan = Date.now();
      var showing = new Set(), appeared = [];
      // As the app does: under <html> too, where some ad scripts pin their boxes.
      document.querySelectorAll('body *, html > :not(head):not(body), html > :not(head):not(body) *').forEach(function (el) {
        var style = getComputedStyle(el);
        if (style.position !== 'fixed' && style.position !== 'sticky') return;
        for (var p = el.parentElement; p; p = p.parentElement) if (showing.has(p)) return;
        var b = box(el, style);
        if (!b) return;
        showing.add(el);
        if (shown.has(el)) return;
        var id = el.getAttribute('data-mangax-overlay') || String(++seq);
        el.setAttribute('data-mangax-overlay', id);
        appeared.push({
          id: id, selector: '[data-mangax-overlay="' + id + '"]', position: style.position,
          cover: Math.round(b.cover * 100) / 100, left: Math.round(b.left), top: Math.round(b.top),
          width: Math.round(b.width), height: Math.round(b.height),
          z: parseInt(style.zIndex, 10) || 0, sinceTap: lastTap ? Date.now() - lastTap : -1
        });
      });
      shown = showing;
      // Straight to this run: an action is not `run`, and its listeners stay until the page goes.
      appeared.forEach(function (data) {
        log('event', 'page:overlay ' + JSON.stringify(data));
        r.eventListeners.slice().forEach(function (entry) {
          if (entry.name === 'page:overlay' || entry.name === '*') entry.fn(data, 'page:overlay');
        });
      });
    }
    function schedule() {
      if (!timer) timer = setTimeout(scan, Math.max(0, lastScan + 200 - Date.now()));
    }
    function tap() { lastTap = Date.now(); }
    var observer = new MutationObserver(schedule);
    observer.observe(document.documentElement, {
      childList: true, subtree: true, attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'open', 'aria-hidden']
    });
    addEventListener('pointerdown', tap, true);
    addEventListener('touchstart', tap, true);
    r.overlayWatch = true;
    schedule();
    cleanup(r, function () {
      observer.disconnect();
      clearTimeout(timer);
      removeEventListener('pointerdown', tap, true);
      removeEventListener('touchstart', tap, true);
    });
  }

  function emit(name, data) {
    if (!run) return log('emit', 'nothing is running');
    log('event', name + ' ' + JSON.stringify(data));
    run.eventListeners.slice().forEach(function (entry) {
      if (entry.name === name || entry.name === '*') entry.fn(data, name);
    });
  }

  var called = false;
  window.mangax = {
    version: 1,
    effect: function (body) {
      if (typeof body !== 'function') throw new TypeError('mangax.effect(fn): fn must be a function');
      stop(run, 'restarted');
      var r = { cleanups: [], optionListeners: [], eventListeners: [], stopped: false };
      var ctx = context(r);
      try {
        var result = body(ctx);
        var pending = result && typeof result.then === 'function';
        if (config.type === 'toggle') {
          if (pending) {
            result.then(function (fn) { if (typeof fn === 'function') cleanup(r, fn); }, function (e) { fail(r, e); });
          } else if (typeof result === 'function') {
            cleanup(r, result);
          }
        } else if (pending) {
          result.then(null, function (e) { fail(r, e); });
        }
      } catch (e) {
        fail(r, e);
        return;
      }
      if (config.type === 'action') { log('ran', 'an action keeps nothing running'); return; }
      if (r.stopped) return;
      run = r;
      r.ctx = ctx;
      called = true;
      log('running', 'mangaxTest.stop() to switch it off');
    }
  };

  window.mangaxTest = {
    setup: function (next) {
      for (var k in next) config[k] = next[k];
      log('setup', JSON.stringify(config));
    },
    options: function (next) {
      config.options = next;
      if (!run) return log('options', 'nothing is running');
      run.ctx.options = next;
      run.optionListeners.forEach(function (fn) { fn(next); });
    },
    // An app event, e.g. emit('translate:done', { type: 'manga', engine: 'manga', mode: 'realtime' })
    emit: function (name, data) { emit(String(name), data || {}); },
    closeMenu: function (key) { emit('menu:close', { key: key || null }); },
    stop: function () {
      if (!run) return log('stop', called ? 'already stopped' : 'nothing is running');
      stop(run, 'by the reader');
    }
  };

  log('ready', 'paste the effect\'s main.js now');
})();
