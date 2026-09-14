// Tap to turn: the bottom third of the screen moves down, the top third moves back.
mangax.effect(function (ctx) {
  var options = ctx.options;
  var INTERACTIVE = 'a, button, input, select, textarea, label, summary, video, audio, ' +
    '[role="button"], [role="link"], [contenteditable], [onclick]';

  ctx.onOptions(function (next) { options = next; });

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

  ctx.on(document, 'click', function (event) {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.target.closest && event.target.closest(INTERACTIVE)) return;
    // A tap that ends a text selection is not a page turn.
    var selection = window.getSelection && window.getSelection();
    if (selection && !selection.isCollapsed) return;

    var y = event.clientY / window.innerHeight;
    var direction = y > 2 / 3 ? 1 : y < 1 / 3 ? -1 : 0;
    if (!direction) return;

    var el = scroller();
    var page = el === (document.scrollingElement || document.documentElement);
    var height = page ? window.innerHeight : el.clientHeight;
    var distance = height * (Number(options.distance) || 85) / 100;
    (page ? window : el).scrollBy({ top: direction * distance, behavior: options.smooth ? 'smooth' : 'auto' });
  }, true);
});
