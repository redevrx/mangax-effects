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

  // Manga readers often scroll a box inside the page rather than the page itself: use the
  // scrollable box under the middle of the screen, else the page. Every layer at that point
  // is tried, so a banner floating over the reader does not hide it.
  function scroller() {
    var page = document.scrollingElement || document.documentElement;
    var stack = document.elementsFromPoint(window.innerWidth / 2, window.innerHeight / 2);
    for (var i = 0; i < stack.length; i++) {
      for (var el = stack[i]; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
        if (el.scrollHeight - el.clientHeight < 2) continue;
        var overflow = getComputedStyle(el).overflowY;
        if (overflow === 'auto' || overflow === 'scroll' || overflow === 'overlay') return el;
      }
    }
    return page;
  }

  // Looked up every half second, not every frame: the page rarely swaps its scroller.
  var target = null;
  var targetAt = -1e9;
  function currentScroller(now) {
    if (!target || !target.isConnected || now - targetAt > 500) {
      target = scroller();
      targetAt = now;
    }
    return target;
  }

  function scrollBy(el, dy) {
    if (el === (document.scrollingElement || document.documentElement)) window.scrollBy(0, dy);
    else el.scrollTop += dy;
  }

  function step(now) {
    // requestAnimationFrame is not a ctx callback, so an error here would end the loop
    // silently while the switch still shows on. Stop properly instead.
    try {
      move(now);
    } catch (e) {
      ctx.stop();
      return;
    }
    frame = requestAnimationFrame(step);
  }

  function move(now) {
    var dt = Math.min(now - last, 100);
    last = now;
    if (!(pauseOnTouch && touching)) {
      // Sub-pixel moves are dropped by some engines, so they are saved up.
      carry += speed * dt / 1000;
      var whole = Math.floor(carry);
      if (whole >= 1) {
        carry -= whole;
        var el = currentScroller(now);
        var before = el.scrollTop;
        scrollBy(el, whole);
        if (el.scrollTop === before) {
          // Nothing moved: the end of the page, or a page still loading more below.
          if (!atEndSince) atEndSince = now;
          if (!toldEnd && now - atEndSince > 2500) {
            toldEnd = true;
            ctx.toast('Reached the end of the page').catch(function () {});
          }
        } else {
          atEndSince = 0;
          toldEnd = false;
        }
      }
    }
  }
  frame = requestAnimationFrame(step);

  ctx.on(window, 'touchstart', function () { touching = true; }, { passive: true });
  ctx.on(window, 'touchend', function () { touching = false; last = performance.now(); }, { passive: true });
  ctx.on(window, 'touchcancel', function () { touching = false; last = performance.now(); }, { passive: true });

  ctx.onOptions(function (options) {
    speed = options.speed;
    pauseOnTouch = options.pauseOnTouch;
  });

  return function () {
    cancelAnimationFrame(frame);
  };
});
