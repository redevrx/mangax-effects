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

  function scroller() {
    var page = document.scrollingElement || document.documentElement;
    var stack = document.elementsFromPoint(window.innerWidth / 2, window.innerHeight / 2);
    for (var i = 0; i < stack.length; i++) {
      for (var el = stack[i]; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
        if (el.scrollHeight - el.clientHeight < 2) continue;
        var overflow = getComputedStyle(el).overflowY;
        if (overflow === 'auto' || overflow === 'scroll' || overflow === 'overlay') {
          var scrollable = el.scrollHeight - el.clientHeight > 1;
          if (el.scrollTop > 0 || scrollable) return el;
        }
      }
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

  function findScrollableInIframe(el) {
    for (var child = el.firstChild; child; child = child.nextSibling) {
      if (child.nodeType === 1) {
        var childOverflow = getComputedStyle(child).overflowY;
        if (childOverflow === 'auto' || childOverflow === 'scroll' || childOverflow === 'overlay') {
          var childScrollable = child.scrollHeight - child.clientHeight > 1;
          if (child.scrollTop > 0 || childScrollable) return child;
        }
        var found = findScrollableInIframe(child);
        if (found) return found;
      }
    }
    return null;
  }

  function scrollBy(el, dy) {
    if (!el || !el.isConnected) return;
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
  }

  function move(now) {
    var dt = Math.min(now - last, 100);
    last = now;
    if (!(pauseOnTouch && touching)) {
      var el = currentScroller(now);
      if (!el || !el.isConnected) {
        carry = 0;
        return;
      }
      var scrollable = el.scrollHeight - el.clientHeight > 1;
      if (el.scrollTop >= el.scrollHeight - el.clientHeight && scrollable) {
        if (el.scrollTop < el.scrollHeight - el.clientHeight) scrollable = true;
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
