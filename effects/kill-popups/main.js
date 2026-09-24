// Kill pop-ups: removes fixed boxes that cover a large part of the screen, then undoes the
// scroll lock such boxes usually put on the page. After the first sweep it stays on the page
// and removes each new one as the site brings it up, which is how pop-up ads keep coming back.
mangax.effect(function (ctx) {
  var screenArea = window.innerWidth * window.innerHeight;
  // A page with no viewport yet (still laying out, or hidden) would make every box "cover" it.
  if (!screenArea) return;
  // Pages the app has scanned carry these; an overlay holding them is the reader's content.
  var CONTENT = '[data-tl-id], [data-manga-idx], [data-manga-url]';
  // Share of the screen a box has to cover to be a pop-up rather than a bar or a button.
  var MIN_COVER = 0.3;
  // Below this the box sits among the page, not above it.
  var MIN_Z = 10;
  // A box that comes up this soon after a tap is one the reader opened: a chapter list, a menu.
  var TAP_GRACE_MS = 1000;

  // Before the app has scanned a page, a site's own full-screen reader looks like any other
  // overlay. It holds a page-sized picture (manga) or a lot of text (novel); a pop-up does not.
  function isReader(box) {
    if ((box.innerText || '').length > 4000) return true;
    var media = box.querySelectorAll('img, canvas, picture, video');
    var pictures = 0;
    for (var j = 0; j < media.length; j++) {
      var r = media[j].getBoundingClientRect();
      if (r.width >= window.innerWidth * 0.6 && r.height >= window.innerHeight * 0.4) return true;
      if (r.width >= 150 && r.height >= 150) pictures++;
    }
    return pictures >= 3;
  }

  function isContent(el) {
    return el.matches(CONTENT) || !!el.querySelector(CONTENT) || isReader(el);
  }

  function unlockScroll() {
    [document.documentElement, document.body].forEach(function (root) {
      if (!root) return;
      var s = getComputedStyle(root);
      if (s.overflow === 'hidden' || s.overflowY === 'hidden') root.style.setProperty('overflow', 'auto', 'important');
      if (s.position === 'fixed') root.style.setProperty('position', 'static', 'important');
    });
  }

  var removed = 0;
  var candidates = document.querySelectorAll('body *');
  for (var i = 0; i < candidates.length; i++) {
    var el = candidates[i];
    if (!el.isConnected) continue;
    var style = getComputedStyle(el);
    if (style.position !== 'fixed' && style.position !== 'sticky') continue;
    if (style.display === 'none' || style.visibility === 'hidden') continue;

    var box = el.getBoundingClientRect();
    var visibleArea = Math.max(0, Math.min(box.right, window.innerWidth) - Math.max(box.left, 0)) *
      Math.max(0, Math.min(box.bottom, window.innerHeight) - Math.max(box.top, 0));
    var zIndex = parseInt(style.zIndex, 10) || 0;
    if (visibleArea < screenArea * MIN_COVER || zIndex < MIN_Z) continue;
    if (isContent(el)) continue;

    el.remove();
    removed++;
  }
  unlockScroll();

  // From here on the app reports every pinned box that comes up; this keeps the big ones.
  ctx.onEvent('page:overlay', function (data) {
    if (data.cover < MIN_COVER || data.z < MIN_Z) return;
    if (data.sinceTap >= 0 && data.sinceTap < TAP_GRACE_MS) return;
    var overlay = document.querySelector(data.selector);
    if (!overlay || isContent(overlay)) return;
    overlay.remove();
    unlockScroll();
  });

  // Started by the app on every page load it works quietly; run by hand it says what it did.
  if (!ctx.auto) {
    ctx.toast(removed ? 'Removed ' + removed + ' overlay' + (removed > 1 ? 's' : '') : 'No overlays found')
      .catch(function () {});
  }
});
