// Auto scroll: moves the page down at ctx.options.speed pixels per second.
mangax.effect(function (ctx) {
  var speed = ctx.options.speed;
  var pauseOnTouch = ctx.options.pauseOnTouch;
  var touching = false;
  var atEndSince = 0;
  var toldEnd = false;
  var last = performance.now();
  var carry = 0;
  var frame = 0;
  var target = null;
  var targetAt = -1e9;

  function safeGetStyle(prop, el) {
    try {
      return getComputedStyle(el).getPropertyValue(prop);
    } catch (e) {
      return '';
    }
  }

  function scroller() {
    try {
      var page = document.scrollingElement || document.documentElement;
      var stack = document.elementsFromPoint(window.innerWidth / 2, window.innerHeight / 2);
      for (var i = 0; i < stack.length; i++) {
        var el = stack[i];
        if (!el || el === document.body || el === document.documentElement) continue;
        try {
          var overflow = safeGetStyle('overflow-y', el);
        } catch (e) {
          continue;
        }
        if (overflow === 'auto' || overflow === 'scroll' || overflow === 'overlay') {
          try {
            var scrollable = el.scrollHeight - el.clientHeight > 1;
          } catch (e) {
            continue;
          }
          if (el.scrollTop > 0 || scrollable) return el;
        }
      }
    } catch (e) {
      // Some sites block elementsFromPoint or getComputedStyle
    }
    return null;
  }

  function currentScroller(now) {
    if (!target || !target.isConnected || now - targetAt > 500) {
      target = scroller();
      targetAt = now;
    }
    return target;
  }

  function safeGetScrollHeight(el) {
    try {
      return el.scrollHeight;
    } catch (e) {
      return Infinity;
    }
  }

  function safeGetClientHeight(el) {
    try {
      return el.clientHeight;
    } catch (e) {
      return 0;
    }
  }

  function findScrollableInIframe(el) {
    for (var child = el.firstChild; child; child = child.nextSibling) {
      if (child.nodeType === 1) {
        try {
          var childOverflow = safeGetStyle('overflow-y', child);
        } catch (e) {
          continue;
        }
        if (childOverflow === 'auto' || childOverflow === 'scroll' || childOverflow === 'overlay') {
          try {
            var childScrollable = safeGetScrollHeight(child) - safeGetClientHeight(child) > 1;
          } catch (e) {
            continue;
          }
          try {
            if (child.scrollTop > 0 || childScrollable) return child;
          } catch (e) {
            continue;
          }
        }
        var found = findScrollableInIframe(child);
        if (found) return found;
      }
    }
    return null;
  }

  function scrollBy(el, dy) {
    if (!el || !el.isConnected) return;
    try {
      if (el === (document.scrollingElement || document.documentElement)) {
        var target = findScrollableInIframe(el);
        if (target) {
          target.scrollTop += dy;
          return;
        }
        window.scrollBy(0, dy);
      } else {
        el.scrollTop += dy;
      }
    } catch (e) {
      // Some sites block scrollBy - fall back to direct manipulation
      try {
        if (el === (document.scrollingElement || document.documentElement)) {
          window.scrollBy(0, Math.round(dy));
        } else {
          el.scrollTop += Math.round(dy);
        }
      } catch (e2) {
        // Ignore - some sites block all scroll manipulation
      }
    }
  }

  function move(now) {
    try {
      var dt = Math.min(now - last, 100);
      last = now;
      if (!(pauseOnTouch && touching)) {
        var el = currentScroller(now);
        if (!el || !el.isConnected) {
          carry = 0;
          return;
        }
        try {
          var scrollable = el.scrollHeight - el.clientHeight > 1;
        } catch (e) {
          carry = 0;
          return;
        }
        try {
          if (el.scrollTop >= el.scrollHeight - el.clientHeight && scrollable) {
            if (el.scrollTop < el.scrollHeight - el.clientHeight) scrollable = true;
          }
        } catch (e) {
          carry = 0;
          return;
        }
        if (!scrollable) {
          if (!atEndSince) atEndSince = now;
          if (!toldEnd && now - atEndSince > 2500) {
            toldEnd = true;
            ctx.toast('Reached the end of the page').catch(function () {});
          }
        } else {
          carry += speed * dt / 1000;
          var whole = Math.floor(carry);
          if (whole >= 1) {
            carry -= whole;
            scrollBy(el, whole);
          }
        }
      }
    } catch (e) {
      carry = 0;
    }
  }

  frame = requestAnimationFrame(function (now) {
    try {
      move(now);
    } catch (e) {
      ctx.stop();
      return;
    }
    frame = requestAnimationFrame(function (n) { move(n); });
  });

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
