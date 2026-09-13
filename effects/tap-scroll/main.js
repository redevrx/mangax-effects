// Tap to turn: the bottom third of the screen moves down, the top third moves back.
mangax.effect(function (ctx) {
  var options = ctx.options;
  var INTERACTIVE = 'a, button, input, select, textarea, label, summary, video, audio, ' +
    '[role="button"], [role="link"], [contenteditable], [onclick]';

  ctx.onOptions(function (next) { options = next; });

  ctx.on(document, 'click', function (event) {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.target.closest && event.target.closest(INTERACTIVE)) return;
    // A tap that ends a text selection is not a page turn.
    var selection = window.getSelection && window.getSelection();
    if (selection && !selection.isCollapsed) return;

    var y = event.clientY / window.innerHeight;
    var direction = y > 2 / 3 ? 1 : y < 1 / 3 ? -1 : 0;
    if (!direction) return;

    var distance = window.innerHeight * (Number(options.distance) || 85) / 100;
    window.scrollBy({ top: direction * distance, behavior: options.smooth ? 'smooth' : 'auto' });
  }, true);
});
