// Dark page: a filter on the whole page, undone on the pictures so they keep their colours.
mangax.effect(function (ctx) {
  var style = ctx.addStyle('');

  function css(options) {
    var amount = Math.max(50, Math.min(100, Number(options.strength) || 90)) / 100;
    if (options.mode === 'dim') {
      return 'html { filter: brightness(' + (1.05 - amount * 0.6).toFixed(2) + ') !important; }';
    }
    // hue-rotate after invert keeps reds red and blues blue.
    return [
      'html { filter: invert(' + amount + ') hue-rotate(180deg) !important; background: #fff !important; }',
      'img, picture, video, canvas, svg image, iframe, [style*="background-image"] {',
      '  filter: invert(1) hue-rotate(180deg) !important;',
      '}'
    ].join('\n');
  }

  style.textContent = css(ctx.options);
  ctx.onOptions(function (options) {
    style.textContent = css(options);
  });
});
