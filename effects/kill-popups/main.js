// Kill pop-ups: removes fixed boxes that cover a large part of the screen, then undoes the
// scroll lock such boxes usually put on the page.
mangax.effect(function (ctx) {
  var screenArea = window.innerWidth * window.innerHeight;
  // A page with no viewport yet (still laying out, or hidden) would make every box "cover" it.
  if (!screenArea) return;
  // Pages the app has scanned carry these; an overlay holding them is the reader's content.
  var CONTENT = '[data-tl-id], [data-manga-idx], [data-manga-url]';
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
    if (visibleArea < screenArea * 0.3 || zIndex < 10) continue;
    if (el.matches(CONTENT) || el.querySelector(CONTENT)) continue;

    el.remove();
    removed++;
  }

  [document.documentElement, document.body].forEach(function (root) {
    if (!root) return;
    var s = getComputedStyle(root);
    if (s.overflow === 'hidden' || s.overflowY === 'hidden') root.style.setProperty('overflow', 'auto', 'important');
    if (s.position === 'fixed') root.style.setProperty('position', 'static', 'important');
  });

  ctx.toast(removed ? 'Removed ' + removed + ' overlay' + (removed > 1 ? 's' : '') : 'No overlays found')
    .catch(function () {});
});
