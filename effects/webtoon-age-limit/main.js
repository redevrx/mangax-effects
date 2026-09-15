mangax.effect(function (ctx) {
  // Hide Webtoon's 18+ age limit dialog
  ctx.addStyle(`
    .age_limit {
      display: none !important;
    }
  `);

  // Observe for late-loaded dialogs
  ctx.observe('.age_limit', function (el) {
    el.style.display = 'none';
  });

  // Return undo function for toggle
  return function () {
    // Remove all our styles and hide commands
    const style = document.querySelector('style[data-mx-age-limit]');
    if (style) {
      style.remove();
    }

    document.querySelectorAll('.age_limit').forEach(function (el) {
      el.style.display = '';
    });
  };
});
