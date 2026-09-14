// Runs an effect in desktop Chrome with the same `ctx` the MangaX app gives it, so a script can be
// tried on the real site before it goes anywhere near a phone.
//
// 1. Open the site in Chrome, open DevTools → Console.
// 2. Paste this whole file and press Enter.
// 3. Optional — set up like the app would (defaults: toggle, no options, novel):
//      mangaxTest.setup({ type: 'toggle', engine: 'manga', options: { speed: 60 }, permissions: ['toast'] })
// 4. Paste the effect's main.js and press Enter. It starts at once.
// 5. Try it, then:
//      mangaxTest.options({ speed: 120 })   the reader changes a setting
//      mangaxTest.stop()                    the reader switches it off — the page should be back to normal
//
// Errors are printed the way the app would report them. Toasts go to the console.
// Differences from the app: the page's own globals are visible here (on iOS they are not), and
// options are not clamped to the manifest's limits.
(function () {
  var config = { type: 'toggle', engine: 'novel', options: {}, permissions: [] };
  var run = null;

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
      call: function (cmd, args) {
        if (cmd !== 'toast') return Promise.reject(new Error('unknown command "' + cmd + '"'));
        if (config.permissions.indexOf('toast') < 0) {
          return Promise.reject(new Error('"toast" needs the "toast" permission in effect.json'));
        }
        log('toast', args && args.text);
        return Promise.resolve(true);
      },
      toast: function (text) { return ctx.call('toast', { text: String(text) }); },
      stop: function () { stop(r, 'by the effect'); }
    };
    return ctx;
  }

  var called = false;
  window.mangax = {
    version: 1,
    effect: function (body) {
      if (typeof body !== 'function') throw new TypeError('mangax.effect(fn): fn must be a function');
      stop(run, 'restarted');
      var r = { cleanups: [], optionListeners: [], stopped: false };
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
    stop: function () {
      if (!run) return log('stop', called ? 'already stopped' : 'nothing is running');
      stop(run, 'by the reader');
    }
  };

  log('ready', 'paste the effect\'s main.js now');
})();
