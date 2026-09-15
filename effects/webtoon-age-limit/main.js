mangax.effect(function (ctx) {
  // ctx.addStyle handles injection and cleanup automatically
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
    // ctx.addStyle cleans up automatically on stop
    // Restore dialogs
    document.querySelectorAll('.age_limit').forEach(function (el) {
      el.style.display = '';
    });
  };
});
