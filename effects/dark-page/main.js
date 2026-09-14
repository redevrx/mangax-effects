// Dark page: a filter on the whole page, undone on the pictures so they keep their colours.
mangax.effect(function (ctx) {
  var style = ctx.addStyle('');

  function css(options) {
    var amount = Math.max(50, Math.min(100, Number(options.strength) || 90)) / 100;
    if (options.mode === 'dim') {
      return 'html { filter: brightness(' + (1.05 - amount * 0.6).toFixed(2) + ') !important; }';
    }
    // hue-rotate after invert keeps reds red and blues blue.
    // Manga pages are mostly pictures and novel pages mostly text; both work the same way.
    // A picture inside something already turned back would be flipped a third time, so
    // those are left alone.
    var MEDIA = 'img, video, canvas, svg image, iframe, [style*="background-image"]';
    var nested = MEDIA.split(', ').map(function (m) {
      return '[style*="background-image"] ' + m;
    }).join(', ');
    return [
      'html { filter: invert(' + amount + ') hue-rotate(180deg) !important; background: #fff !important; }',
      MEDIA + ' { filter: invert(1) hue-rotate(180deg) !important; }',
      nested + ' { filter: none !important; }'
    ].join('\n');
  }

  style.textContent = css(ctx.options);
  ctx.onOptions(function (options) {
    style.textContent = css(options);
  });
});
