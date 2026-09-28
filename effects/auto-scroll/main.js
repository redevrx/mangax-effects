// Auto scroll: moves the page down at ctx.options.speed pixels per second.
mangax.effect(function (ctx) {
  var speed = ctx.options.speed;
  var pauseOnTouch = ctx.options.pauseOnTouch;
  var touching = false;
  var atEndSince = 0;
  var toldEnd = false;
  var last = 0;
  var carry = 0;
  var frame = 0;
  var target = null;
  var targetAt = -1e9;

  // Pages with CSS scroll-behavior: smooth fight continuous frame-by-frame scrolling.
  // Override it while auto-scrolling is active; ctx removes this style on stop.
  ctx.addStyle('html, body, * { scroll-behavior: auto !important; }');

  function safeGetStyle(prop, el) {
    try {
      return getComputedStyle(el).getPropertyValue(prop);
    } catch (e) {
      return '';
    }
  }

  // Manga readers often scroll a box inside the page rather than the page itself: use the
  // scrollable box under the middle of the screen, else the page. Every layer at that point
  // is tried, so a banner floating over the reader does not hide it.
  function scroller() {
    var page = document.scrollingElement || document.documentElement;
    try {
      var stack = document.elementsFromPoint(window.innerWidth / 2, window.innerHeight / 2);
      for (var i = 0; i < stack.length; i++) {
        for (var el = stack[i]; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
          if (el.scrollHeight - el.clientHeight < 2) continue;
          var overflow = safeGetStyle('overflow-y', el);
          if (overflow === 'auto' || overflow === 'scroll' || overflow === 'overlay') return el;
        }
      }
    } catch (e) {
      // Some sites block elementsFromPoint or getComputedStyle
    }
    return page;
  }

  function currentScroller(now) {
    if (!target || !target.isConnected || now - targetAt > 500) {
      target = scroller();
      targetAt = now;
    }
    return target;
  }

  function scrollBy(el, dy) {
    if (!el || !el.isConnected) return;
    var page = document.scrollingElement || document.documentElement;
    try {
      if (el === page) {
        var before = window.scrollY;
        window.scrollBy(0, dy);
        if (window.scrollY === before) {
          if (document.documentElement) document.documentElement.scrollTop += dy;
          if (window.scrollY === before && document.body) document.body.scrollTop += dy;
        }
      } else {
        el.scrollTop += dy;
      }
    } catch (e) {
      try {
        if (el === page) {
          if (document.documentElement) document.documentElement.scrollTop += Math.round(dy);
          if (document.body) document.body.scrollTop += Math.round(dy);
        } else {
          el.scrollTop += Math.round(dy);
        }
      } catch (e2) {}
    }
  }

  function move(now) {
    if (!last) {
      last = now;
      return;
    }
    var dt = Math.min(Math.max(now - last, 0), 100);
    last = now;

    if (!(pauseOnTouch && touching)) {
      var el = currentScroller(now);
      if (!el || !el.isConnected) {
        carry = 0;
        return;
      }

      var isPage = el === (document.scrollingElement || document.documentElement);
      var scrollHeight = isPage ? Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) : el.scrollHeight;
      var clientHeight = isPage ? window.innerHeight : el.clientHeight;
      var scrollTop = isPage ? window.scrollY : el.scrollTop;
      var maxScroll = scrollHeight - clientHeight;
      var atBottom = maxScroll > 0 && scrollTop >= maxScroll - 2;

      if (atBottom || maxScroll <= 0) {
        if (!atEndSince) atEndSince = now;
        if (!toldEnd && now - atEndSince > 2500) {
          toldEnd = true;
          ctx.toast('Reached the end of the page').catch(function () {});
        }
      } else {
        atEndSince = 0;
        toldEnd = false;
        carry += speed * dt / 1000;
        var whole = Math.floor(carry);
        if (whole >= 1) {
          carry -= whole;
          scrollBy(el, whole);
        }
      }
    }
  }

  function step(now) {
    try {
      move(now);
    } catch (e) {
      ctx.stop();
      return;
    }
    frame = requestAnimationFrame(step);
  }
  frame = requestAnimationFrame(step);

  ctx.on(window, 'touchstart', function () { touching = true; }, { passive: true });
  ctx.on(window, 'touchend', function () { touching = false; last = performance.now(); }, { passive: true });
  ctx.on(window, 'touchcancel', function () { touching = false; last = performance.now(); }, { passive: true });

  ctx.onOptions(function (options) {
    speed = options.speed;
    pauseOnTouch = options.pauseOnTouch;
  });

  ctx.observe('body', function () { target = null; });

  return function () {
    cancelAnimationFrame(frame);
  };
});

// Its own settings, on the page: the settings button in the effects sheet opens this as a floating
// panel, so the speed can be tried against the page it scrolls. Apps before settings panels have
// no mangax.settings, and there the sheet's own controls still work.
if (mangax.settings) mangax.settings(function (ctx) {
  var th = ctx.lang === 'th';
  var box = ctx.panel();
  box.css(
    '.title{font-weight:700;font-size:16px;margin:0 0 12px}' +
    '.row{display:flex;align-items:center;gap:12px;margin:10px 0}' +
    '.label{flex:1;color:var(--mx-text-body)}' +
    '.value{font:12px ui-monospace,monospace;color:var(--mx-text);min-width:64px;text-align:right}' +
    'input[type=range]{width:100%;accent-color:var(--mx-primary)}' +
    'input[type=checkbox]{width:22px;height:22px;accent-color:var(--mx-primary)}' +
    '.done{display:block;width:100%;margin-top:14px;padding:12px;border:0;border-radius:12px;' +
    'background:var(--mx-primary);color:#fff;font:600 14px system-ui,sans-serif}'
  );
  box.card.innerHTML =
    '<p class="title"></p>' +
    '<div class="row"><span class="label speed-label"></span><span class="value"></span></div>' +
    '<input type="range" min="10" max="400" step="10">' +
    '<label class="row"><span class="label pause-label"></span><input type="checkbox"></label>' +
    '<button class="done"></button>';
  var q = function (s) { return box.card.querySelector(s); };
  q('.title').textContent = th ? 'เลื่อนอัตโนมัติ' : 'Auto scroll';
  q('.speed-label').textContent = th ? 'ความเร็ว' : 'Speed';
  q('.pause-label').textContent = th ? 'หยุดระหว่างแตะจอ' : 'Pause while touching';
  q('.done').textContent = th ? 'เสร็จ' : 'Done';

  var slider = q('input[type=range]');
  var pause = q('input[type=checkbox]');
  var value = q('.value');

  function show(options) {
    slider.value = options.speed;
    value.textContent = options.speed + ' px/s';
    pause.checked = !!options.pauseOnTouch;
  }
  show(ctx.options);

  ctx.on(slider, 'input', function () { value.textContent = slider.value + ' px/s'; });
  // Saved when let go: the running scroll picks it up through ctx.onOptions.
  ctx.on(slider, 'change', function () { ctx.setOption('speed', Number(slider.value)).catch(function () {}); });
  ctx.on(pause, 'change', function () { ctx.setOption('pauseOnTouch', pause.checked).catch(function () {}); });
  ctx.on(q('.done'), 'click', function () { ctx.close(); });
  ctx.onOptions(show);
});
