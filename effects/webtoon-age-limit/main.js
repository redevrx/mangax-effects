mangax.effect(function (ctx) {
  ctx.addStyle(
    '.ly_wrap:has(.ly_adult), .ly_wrap:has(.age_limit), .ly_adult, .age_limit, [data-mx-webtoon-age-hidden] {\n' +
    '  display: none !important;\n' +
    '}\n' +
    'body[data-mx-webtoon-age-unlocked] {\n' +
    '  overflow: visible !important;\n' +
    '}'
  );

  ctx.observe('.ly_adult, .age_limit', function (el) {
    var wrap = el.closest ? el.closest('.ly_wrap') : null;
    var target = wrap || el;
    target.setAttribute('data-mx-webtoon-age-hidden', '');
    document.body.setAttribute('data-mx-webtoon-age-unlocked', '');
  });

  return function () {
    document.querySelectorAll('[data-mx-webtoon-age-hidden]').forEach(function (el) {
      el.removeAttribute('data-mx-webtoon-age-hidden');
    });
    document.body.removeAttribute('data-mx-webtoon-age-unlocked');
  };
});
