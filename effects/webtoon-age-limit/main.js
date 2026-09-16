mangax.effect(function (ctx) {
  ctx.addStyle(
    'body:has(.ly_adult) #_dimForPopup, body:has(.ly_adult) .ly_dim, body:has(.ly_adult) .dim,\n' +
    'body:has(.age_limit) #_dimForPopup, body:has(.age_limit) .ly_dim, body:has(.age_limit) .dim,\n' +
    '.ly_wrap:has(.ly_adult), .ly_wrap:has(.age_limit),\n' +
    '.ly_adult, .age_limit, [data-mx-webtoon-age-hidden] {\n' +
    '  display: none !important;\n' +
    '}\n' +
    'body:has(.ly_adult), html:has(.ly_adult),\n' +
    'body:has(.age_limit), html:has(.age_limit),\n' +
    'body[data-mx-webtoon-age-unlocked], html[data-mx-webtoon-age-unlocked] {\n' +
    '  overflow: visible !important;\n' +
    '  height: auto !important;\n' +
    '}\n' +
    'body:has(.ly_adult) #wrap, body:has(.age_limit) #wrap,\n' +
    'body:has(.ly_adult).fixed, body:has(.age_limit).fixed,\n' +
    '#wrap[data-mx-webtoon-age-unlocked],\n' +
    'body[data-mx-webtoon-age-unlocked] #wrap,\n' +
    'body[data-mx-webtoon-age-unlocked].fixed {\n' +
    '  position: static !important;\n' +
    '  overflow: visible !important;\n' +
    '  height: auto !important;\n' +
    '  top: auto !important;\n' +
    '}'
  );

  function unlock() {
    document.body.setAttribute('data-mx-webtoon-age-unlocked', '');
    if (document.documentElement) {
      document.documentElement.setAttribute('data-mx-webtoon-age-unlocked', '');
    }
    var wrap = document.getElementById('wrap') || document.querySelector('.wrap');
    if (wrap) {
      wrap.setAttribute('data-mx-webtoon-age-unlocked', '');
    }
    var dim = document.getElementById('_dimForPopup') || document.querySelector('.ly_dim, .dim');
    if (dim) {
      dim.setAttribute('data-mx-webtoon-age-hidden', '');
    }
  }

  ctx.observe('.ly_adult, .age_limit', function (el) {
    var wrap = el.closest ? el.closest('.ly_wrap, .ly_flex_wrap') : null;
    var target = wrap || el;
    target.setAttribute('data-mx-webtoon-age-hidden', '');
    unlock();
  });

  ctx.observe('#_dimForPopup, .ly_dim, .dim', function (dim) {
    if (document.querySelector('.ly_adult, .age_limit')) {
      dim.setAttribute('data-mx-webtoon-age-hidden', '');
      unlock();
    }
  });

  return function () {
    document.querySelectorAll('[data-mx-webtoon-age-hidden]').forEach(function (el) {
      el.removeAttribute('data-mx-webtoon-age-hidden');
    });
    document.querySelectorAll('[data-mx-webtoon-age-unlocked]').forEach(function (el) {
      el.removeAttribute('data-mx-webtoon-age-unlocked');
    });
  };
});
