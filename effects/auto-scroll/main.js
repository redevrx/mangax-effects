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
