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

  function scroller() {
    return document.scrollingElement || document.documentElement;
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
        var el = scroller();
        var before = el.scrollTop;
        window.scrollBy(0, whole);
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
