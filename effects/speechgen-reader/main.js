// Read aloud with SpeechGen: the page being read sends its paragraphs, a piece at a time, to
// speechgen.io open as a hidden companion page, which types them into its editor and presses its
// own button to make and play the speech.
//
// Messages, page → companion:
//   { type: 'speak', id, text }   make and play this text (the voice and speed set before apply)
//   { type: 'stop' }              stop playing, forget the piece in hand
//   { type: 'setVoice', voice }   a voice name from 'voices' ('' = the site's default)
//   { type: 'setRate', rate }     0.1 – 2.0
//   { type: 'voices' }            ask for the voice list
// companion → page:
//   { type: 'ready', credits }                  its code runs (again, after each page load)
//   { type: 'started', id, credits }            the speech for id began playing
//   { type: 'ended', id, credits }              …and finished
//   { type: 'error', id, message, needsUser }   needsUser: the site is shown full screen for the reader
//   { type: 'noCredits', id, credits }          the site will not make it: out of credits
//   { type: 'resumed', id }                     the reader dealt with it, the site is hidden again
//   { type: 'notice', message }                 worth telling the reader, reading goes on
//   { type: 'voices', voices: [{ value, name, tier, sex }], current, lang }

mangax.effect(function (ctx) {
  var MARK = 'data-mx-speechgen';
  var MIN_CHUNK = 250;   // paragraphs are joined up to about this many characters, fewer gaps
  var MAX_PIECE = 900;   // one generation; each costs credits, so no read-ahead
  var WATCHDOG_MS = 120000;
  var th = true;
  var seq = 0;
  var chunk = null;      // { els: [paragraph elements], pieces: [text], index }
  var waiting = 0;       // id of the piece sent and not yet ended
  var watchdog = 0;
  var stopped = false;
  var paused = false;    // the site needs the reader; carry on when it says so

  ctx.addStyle(
    '[' + MARK + ']{background-color:rgba(108,92,231,.18)!important;' +
    'box-shadow:0 0 0 4px rgba(108,92,231,.18)!important;border-radius:4px!important}'
  );

  function toast(text) {
    ctx.toast(text).catch(function () {});
  }

  function fail(e) {
    if (stopped) return;
    try { console.error(e); } catch (x) {}
    ctx.stop();
  }

  // Everything scheduled outside ctx callbacks goes through this.
  function safe(fn) {
    return function () {
      if (stopped) return undefined;
      try { return fn.apply(this, arguments); } catch (e) { fail(e); }
      return undefined;
    };
  }

  function send(data) {
    return ctx.companion.send(data).catch(function () {});
  }

  function rate(options) {
    var r = Number(options.rate);
    if (!(r > 0)) r = 1;
    return Math.round(r * 10) / 10;
  }

  function sendSettings(options) {
    send({ type: 'setVoice', voice: String(options.voice || '') });
    send({ type: 'setRate', rate: rate(options) });
  }

  // ── Paragraphs ─────────────────────────────────────────────────────────
  // After a scan the app tags each paragraph with data-tl-id and puts the translation in it; read
  // those. On a page not scanned yet, the page's own paragraphs. Only read, never changed — the
  // highlight is this effect's own attribute.
  var FALLBACK = 'p, h1, h2, h3, h4, blockquote, li';
  var SKIP = 'nav, header, footer, aside, form, button, [role=navigation], [data-mangax-ui]';

  function textOf(el) {
    return String(el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function shown(el) {
    return el.getClientRects().length > 0;
  }

  function paragraphs() {
    var tagged = document.querySelectorAll('[data-tl-id]');
    var selector = tagged.length ? '[data-tl-id]' : FALLBACK;
    var all = tagged.length ? tagged : document.querySelectorAll(FALLBACK);
    var out = [];
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.parentElement && el.parentElement.closest(selector)) continue;   // inside another one
      if (el.closest(SKIP)) continue;
      if (!shown(el) || textOf(el).length < 2) continue;
      out.push(el);
    }
    return out;
  }

  function firstOnScreen(list) {
    var h = window.innerHeight || document.documentElement.clientHeight;
    for (var i = 0; i < list.length; i++) {
      var r = list[i].getBoundingClientRect();
      if (r.bottom > 0 && r.top < h) return i;
      if (r.top >= h) return i;
    }
    return -1;
  }

  function indexAfter(list, el) {
    for (var i = 0; i < list.length; i++) {
      var pos = el.compareDocumentPosition(list[i]);
      if ((pos & Node.DOCUMENT_POSITION_FOLLOWING) && !(pos & Node.DOCUMENT_POSITION_CONTAINED_BY)) return i;
    }
    return -1;
  }

  // Cuts text longer than one generation at a line, a sentence end or a space.
  function split(text) {
    var out = [];
    while (text.length > MAX_PIECE) {
      var head = text.slice(0, MAX_PIECE);
      var cut = -1;
      var ends = ['\n', '. ', '! ', '? ', '。', '！', '？', ' '];
      for (var i = 0; i < ends.length && cut < MAX_PIECE / 2; i++) cut = Math.max(cut, head.lastIndexOf(ends[i]) + ends[i].length);
      if (cut < MAX_PIECE / 2) cut = MAX_PIECE;
      out.push(text.slice(0, cut).trim());
      text = text.slice(cut).trim();
    }
    if (text) out.push(text);
    return out;
  }

  function makeChunk(list, from) {
    if (from < 0 || from >= list.length) return null;
    var els = [];
    var texts = [];
    var length = 0;
    for (var i = from; i < list.length; i++) {
      var text = textOf(list[i]);
      if (els.length && (length + text.length > MAX_PIECE || length >= MIN_CHUNK)) break;
      els.push(list[i]);
      texts.push(text);
      length += text.length + 1;
    }
    return { els: els, pieces: split(texts.join('\n')), index: 0 };
  }

  function unmark() {
    var marked = document.querySelectorAll('[' + MARK + ']');
    for (var i = 0; i < marked.length; i++) marked[i].removeAttribute(MARK);
  }

  function mark(els) {
    unmark();
    for (var i = 0; i < els.length; i++) els[i].setAttribute(MARK, '');
    var r = els[0].getBoundingClientRect();
    var h = window.innerHeight || document.documentElement.clientHeight;
    if (r.top < h * 0.12 || r.top > h * 0.6) els[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  // ── Reading ────────────────────────────────────────────────────────────
  function speakPiece() {
    clearTimeout(watchdog);
    if (!chunk || paused) return;
    if (!chunk.els[0].isConnected) return next();
    mark(chunk.els);
    waiting = ++seq;
    send({ type: 'speak', id: waiting, text: chunk.pieces[chunk.index] });
    watchdog = setTimeout(safe(function () {
      toast(th ? 'SpeechGen ไม่ตอบ ลองเปิดใหม่อีกครั้ง' : 'SpeechGen did not answer — try again');
      ctx.stop();
    }), WATCHDOG_MS);
  }

  function next() {
    var list = paragraphs();
    var last = chunk && chunk.els[chunk.els.length - 1];
    var from = last && last.isConnected ? indexAfter(list, last) : firstOnScreen(list);
    chunk = makeChunk(list, from);
    if (!chunk) {
      unmark();
      toast(last ? (th ? 'อ่านจบหน้านี้แล้ว' : 'Finished this page')
                 : (th ? 'ไม่พบข้อความให้อ่าน' : 'No text to read on this page'));
      return ctx.stop();
    }
    speakPiece();
  }

  ctx.companion.onMessage(function (msg) {
    if (!msg || typeof msg !== 'object') return;
    switch (msg.type) {
      case 'ready':
        // First start, or the site reloaded (a sign-in): settings again, then the piece in hand.
        sendSettings(ctx.options);
        paused = false;
        if (!chunk) next(); else speakPiece();
        break;
      case 'ended':
        if (msg.id !== waiting) return;
        clearTimeout(watchdog);
        waiting = 0;
        if (chunk && ++chunk.index < chunk.pieces.length) speakPiece(); else next();
        break;
      case 'started':
        if (msg.id === waiting) clearTimeout(watchdog);
        break;
      case 'resumed':
        if (paused) { paused = false; clearTimeout(watchdog); }
        break;
      case 'notice':
        toast('SpeechGen: ' + String(msg.message || '').slice(0, 160));
        break;
      case 'noCredits':
        // Nothing to wait for: the reading stops, and the reader tops up on speechgen.io.
        if (msg.id !== waiting) return;
        clearTimeout(watchdog);
        toast(th ? 'เครดิต SpeechGen หมดแล้ว ปิดการอ่านออกเสียง' : 'Out of SpeechGen credits — read aloud turned off');
        ctx.stop();
        break;
      case 'error':
        if (msg.id !== waiting) return;
        clearTimeout(watchdog);
        toast('SpeechGen: ' + String(msg.message || (th ? 'ผิดพลาด' : 'error')).slice(0, 160));
        if (msg.needsUser) paused = true;   // shown full screen; 'ready' or 'resumed' carries on
        else ctx.stop();
        break;
    }
  });

  ctx.companion.onState(function (s) {
    if (s && s.open === false) {
      if (s.reason === 'user') toast(th ? 'ปิดการอ่านออกเสียงแล้ว' : 'Read aloud closed');
      ctx.stop();
    }
  });

  ctx.onOptions(sendSettings);

  ctx.onEvent('engine:change', function (data) {
    if (data && data.type === 'manga') ctx.stop();
  });

  // The reading page's own lang is the site's, not the reader's; the device's is closer.
  try { th = String(navigator.language || 'th').toLowerCase().indexOf('en') !== 0; } catch (e) {}

  ctx.companion.open({ view: 'hidden' }).catch(function (e) {
    toast((th ? 'เปิด SpeechGen ไม่ได้: ' : 'Could not open SpeechGen: ') + ((e && e.message) || e));
    ctx.stop();
  });

  return function () {
    stopped = true;
    clearTimeout(watchdog);
    unmark();
    ctx.companion.send({ type: 'stop' }).catch(function () {});
    ctx.companion.close().catch(function () {});
  };
});

// ── The companion page: speechgen.io ─────────────────────────────────────
if (mangax.companion) mangax.companion(function (ctx) {
  var GENERATE_MS = 90000;      // until the result shows up
  var USER_MS = 600000;         // …or this long once the reader has to act (sign in, a check)
  var want = { voice: '', rate: 1 };
  var ready = false;
  var inbox = [];
  var job = null;               // { id, known: {resultId: true}, item, told, since, user }
  var timers = [];
  var dead = false;

  function later(fn, ms) {
    var t = setTimeout(function () {
      timers.splice(timers.indexOf(t), 1);
      if (dead) return;
      try { fn(); } catch (e) { report(job && job.id, (e && e.message) || String(e), false); }
    }, ms);
    timers.push(t);
    return t;
  }

  function report(id, message, needsUser) {
    ctx.send({ type: 'error', id: id || 0, message: message, needsUser: !!needsUser });
  }

  function $(s, root) { return (root || document).querySelector(s); }

  function credits() {
    var el = $('.balans_coins');
    var n = el ? parseInt(el.textContent.replace(/[^\d]/g, ''), 10) : NaN;
    return isNaN(n) ? null : n;
  }

  function speaker() {
    // The voice picked for the first (only) speaker, as the site keeps it for its request.
    try { return JSON.parse($('input[name^="speaker_"][name$="_json"]').value); } catch (e) { return {}; }
  }

  function visible(el) {
    return !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  }

  // Waits until test() is truthy, then done(value); done(null) after ms.
  function waitFor(test, ms, done) {
    var until = Date.now() + ms;
    (function poll() {
      var v = test();
      if (v) return done(v);
      if (Date.now() > until) return done(null);
      later(poll, 150);
    })();
  }

  // ── Voices ─────────────────────────────────────────────────────────────
  // The list comes with the voice picker; once it has been opened it stays in the page.
  function voiceItems() {
    return document.querySelectorAll('.bigVoicesWindow li[data-voice-id]');
  }

  function closePicker() {
    var w = $('.bigVoicesWindow');
    var x = w && $('.closeModal', w);
    if (w && /\bopen\b/.test(w.className) && x) x.click();
  }

  function loadVoices(done) {
    if (voiceItems().length) return done(true);
    var opener = $('.newspeakers .uiName[aria-haspopup]') || $('.newspeakers .uiName');
    if (!opener) return done(false);
    opener.click();
    var last = -1;
    waitFor(function () {
      var n = voiceItems().length;
      var settled = n > 0 && n === last;
      last = n;
      return settled;
    }, 10000, function (ok) {
      closePicker();
      done(!!ok);
    });
  }

  function listVoices() {
    loadVoices(function () {
      var items = voiceItems();
      var voices = [];
      for (var i = 0; i < items.length; i++) {
        var d = items[i].dataset;
        voices.push({ value: d.value, name: d.value, tier: d.typecat || '', sex: d.sex === '1' ? 'male' : d.sex === '0' ? 'female' : '' });
      }
      var langButton = $('.bigVoicesWindow .xDrop');
      ctx.send({ type: 'voices', voices: voices, current: speaker().voice || '', lang: langButton ? langButton.textContent.trim() : '' });
    });
  }

  function applyVoice(done) {
    if (!want.voice || speaker().voice === want.voice) return done();
    loadVoices(function () {
      var items = voiceItems();
      var li = null;
      for (var i = 0; i < items.length; i++) if (items[i].dataset.value === want.voice) li = items[i];
      var use = li && $('.vuse', li);
      if (!use) {
        ctx.send({ type: 'notice', message: 'voice "' + want.voice + '" is not on the site — using ' + (speaker().voice || 'the default') });
        want.voice = '';
        return done();
      }
      use.click();
      waitFor(function () { return speaker().voice === want.voice; }, 3000, function () {
        closePicker();
        done();
      });
    });
  }

  // The speed is a select the site builds when its speed marker is tapped and hides behind its
  // own drop-down; pick through the drop-down so the site stores it. The popover closes itself.
  function speedSelect() {
    var selects = document.querySelectorAll('.newspeakers select');
    for (var i = 0; i < selects.length; i++) {
      var s = selects[i];
      if (s.querySelector('option[value="0.1"]') && s.querySelector('option[value="2.0"]')) return s;
    }
    return null;
  }

  function applyRate(done) {
    var value = (Math.round(Math.min(2, Math.max(0.1, Number(want.rate) || 1)) * 10) / 10).toFixed(1);
    if (Number(speaker().speed) === Number(value)) return done();
    var marker = $('.newspeakers [data-marker="speed"]');
    if (!speedSelect() && marker) marker.click();
    waitFor(speedSelect, 2000, function (select) {
      if (!select) {
        ctx.send({ type: 'notice', message: 'could not set the speed on the site' });
        return done();
      }
      var custom = document.getElementById(select.id + 'Custom');
      var option = custom && $('.select-option[data-value="' + value + '"]', custom);
      if (option) {
        var trigger = $('.select-trigger', custom);
        if (trigger) trigger.click();
        option.click();
      } else {
        select.value = value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      waitFor(function () { return Number(speaker().speed) === Number(value); }, 2000, function () { done(); });
    });
  }

  // ── Speaking ───────────────────────────────────────────────────────────
  function results() {
    return document.querySelectorAll('#result_area .result_item');
  }

  function pauseAll() {
    var audios = document.querySelectorAll('#result_area audio');
    for (var i = 0; i < audios.length; i++) { try { audios[i].pause(); } catch (e) {} }
  }

  // Out of credits is a notice the site puts on the page, not an error result, so the result the
  // job waits for never comes. Matched on its text: the element has no stable id.
  var NO_CREDITS = /ไม่เพียงพอ|not enough credits|insufficient credits/i;

  function outOfCredits() {
    if (credits() === 0) return true;
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (var n = walker.nextNode(); n; n = walker.nextNode()) {
      if (NO_CREDITS.test(n.textContent) && visible(n.parentElement)) return true;
    }
    return false;
  }

  function needsUser() {
    // The check the site shows on some settings. Out of credits comes back as an error result.
    var boxes = document.querySelectorAll('#div_cptch, iframe[src*="recaptcha"]');
    for (var i = 0; i < boxes.length; i++) if (visible(boxes[i])) return true;
    return false;
  }

  function speak(id, text) {
    stop();
    var mine = job = { id: id, known: {}, item: null, told: false, user: false, since: Date.now() };
    applyVoice(function () {
      if (job !== mine) return;
      applyRate(function () {
        if (job !== mine) return;
        var area = $('#mytextarea');
        var start = $('#start');
        if (!area || !start) return report(id, 'the site changed: no editor or button', false);
        var list = results();
        for (var i = 0; i < list.length; i++) mine.known[list[i].id] = true;
        // Through the native setter, so the site's own listeners see a real edit.
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(area, String(text));
        area.dispatchEvent(new Event('input', { bubbles: true }));
        area.dispatchEvent(new Event('change', { bubbles: true }));
        start.click();
        watch(mine);
      });
    });
  }

  // Until the result for the job shows up: done → play (the site autoplays it), error → tell.
  function watch(mine) {
    if (job !== mine) return;
    if (outOfCredits()) {
      job = null;
      return ctx.send({ type: 'noCredits', id: mine.id, credits: credits() });
    }
    if (needsUser() && !mine.user) {
      mine.user = true;
      ctx.show('full').catch(function () {});
      report(mine.id, 'SpeechGen needs you — see the page', true);
    }
    var list = results();
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (mine.known[item.id] || item.id === '1') continue;
      var status = item.getAttribute('status');
      if (status === 'error') {
        mine.user = true;
        job = null;
        ctx.show('full').catch(function () {});
        var text = (item.textContent || '').replace(/\s+/g, ' ').replace(/^Error:\s*/i, '').trim();
        return report(mine.id, text || 'SpeechGen could not make the speech', true);
      }
      if (status === 'done') {
        mine.item = item;
        if (mine.user) {
          mine.user = false;
          ctx.show('hidden').catch(function () {});
          ctx.send({ type: 'resumed', id: mine.id });
        }
        return kick(mine, Date.now());
      }
    }
    if (Date.now() - mine.since > (mine.user ? USER_MS : GENERATE_MS)) {
      job = null;
      return report(mine.id, 'SpeechGen took too long', true);
    }
    later(function () { watch(mine); }, 300);
  }

  // The site starts playing a new result by itself; nudge it if it did not.
  function kick(mine, since) {
    if (job !== mine || mine.told) return;
    var audio = $('audio', mine.item);
    if (audio && Date.now() - since > 4000) {
      var p = audio.play();
      if (p && p.catch) p.catch(function (e) { report(mine.id, 'could not play: ' + ((e && e.message) || e), false); });
      return;
    }
    if (Date.now() - since > 20000) return report(mine.id, 'the speech never loaded', false);
    later(function () { kick(mine, since); }, 250);
  }

  function ownAudio(e) {
    if (!job || !e.target || e.target.tagName !== 'AUDIO') return false;
    var item = e.target.closest('#result_area .result_item');
    if (!item || job.known[item.id]) return false;
    if (!job.item) job.item = item;
    return job.item === item;
  }

  function stop() {
    job = null;
    pauseAll();
    var cancel = $('#stop');
    if (visible(cancel)) cancel.click();
  }

  ctx.on(document, 'play', function (e) {
    if (!ownAudio(e)) return;
    if (job.told) return;   // resumed after a pause
    job.told = true;
    ctx.send({ type: 'started', id: job.id, credits: credits() });
  }, true);

  ctx.on(document, 'ended', function (e) {
    if (!ownAudio(e)) return;
    var id = job.id;
    job = null;
    ctx.send({ type: 'ended', id: id, credits: credits() });
  }, true);

  ctx.on(document, 'error', function (e) {
    if (!ownAudio(e)) return;
    var id = job.id;
    job = null;
    report(id, 'the speech could not be played', false);
  }, true);

  function handle(msg) {
    if (!msg || typeof msg !== 'object') return;
    switch (msg.type) {
      case 'speak': return speak(msg.id, String(msg.text || ''));
      case 'stop': return stop();
      case 'setVoice': want.voice = String(msg.voice || ''); return undefined;
      case 'setRate': want.rate = Number(msg.rate) || 1; return undefined;
      case 'voices': return listVoices();
    }
    return undefined;
  }

  ctx.onMessage(function (msg) {
    if (ready) handle(msg); else inbox.push(msg);
  });

  // Ready once the editor is in the page.
  ctx.observe('#start', function () {
    if (ready || !$('#mytextarea')) return;
    ready = true;
    ctx.send({ type: 'ready', credits: credits() });
    var waitingMsgs = inbox;
    inbox = [];
    waitingMsgs.forEach(handle);
  });

  return function () {
    dead = true;
    job = null;
    timers.forEach(clearTimeout);
    pauseAll();
  };
});

// ── Settings, drawn over the page being read ────────────────────────────
if (mangax.settings) mangax.settings(function (ctx) {
  var th = ctx.lang === 'th';
  var TIER = {
    standard: { name: 'Standard', cost: '×0.5' },
    pro: { name: 'PRO', cost: '×1' },
    prohd: { name: 'HD', cost: '×2' }
  };
  var RATE_MIN = 0.5;
  var RATE_MAX = 2;
  var RATE_STEP = 0.1;
  var ICON = {
    voice: '<svg viewBox="0 0 24 24"><path d="M9 13c2.2 0 4-1.8 4-4s-1.8-4-4-4-4 1.8-4 4 1.8 4 4 4zm0 2c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4zm7.8-9.6-1.7 1.7c.8 1.2.8 2.7 0 3.9l1.7 1.7c2-2 2-5.2 0-7.3zM20.1 2l-1.6 1.6c2.8 3 2.8 7.6 0 10.8l1.6 1.6c3.9-3.8 3.9-9.8 0-14z"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z"/></svg>',
    info: '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>',
    speed: '<svg viewBox="0 0 24 24"><path d="m20.4 8.6-1.2 1.9a8 8 0 0 1-.2 7.5H5a8 8 0 0 1 10.6-11l1.9-1.2A10 10 0 0 0 3.3 19a2 2 0 0 0 1.7 1h14a2 2 0 0 0 1.7-1 10 10 0 0 0-.3-10.4zm-9.8 6.8a2 2 0 0 0 2.8 0l5.7-8.5-8.5 5.7a2 2 0 0 0 0 2.8z"/></svg>',
    minus: '<svg viewBox="0 0 24 24"><path d="M19 13H5v-2h14z"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/></svg>'
  };
  var openedHere = false;
  var voices = null;
  var filter = '';
  var chosen = String(ctx.options.voice || '');

  var box = ctx.panel();
  box.css(
    'svg{width:20px;height:20px;fill:currentColor;flex:none}' +
    'button{font:inherit;color:inherit;-webkit-tap-highlight-color:transparent;cursor:pointer}' +
    '.handle{width:36px;height:4px;border-radius:2px;margin:-4px auto 14px;background:var(--mx-text-muted);opacity:.4}' +
    '.head{display:flex;align-items:center;gap:12px}' +
    '.badge{display:grid;place-items:center;width:42px;height:42px;border-radius:14px;color:#fff;' +
    'background:linear-gradient(135deg,var(--mx-primary),var(--mx-secondary))}' +
    '.titles{flex:1;min-width:0}' +
    '.title{font-weight:700;font-size:17px;margin:0}' +
    '.sub{color:var(--mx-text-muted);font-size:12px;margin:2px 0 0}' +
    '.icon-btn{display:grid;place-items:center;width:36px;height:36px;border:0;border-radius:50%;' +
    'background:var(--mx-surface2);color:var(--mx-text-body)}' +
    '.note{display:flex;gap:10px;align-items:flex-start;margin:14px 0 0;padding:10px 12px;border-radius:12px;' +
    'background:var(--mx-surface2);color:var(--mx-text-body);font-size:12px;line-height:1.5}' +
    '.note svg{width:16px;height:16px;margin-top:1px;color:var(--mx-secondary)}' +
    '.section{margin-top:18px}' +
    '.section-title{display:flex;align-items:center;gap:8px;margin:0 0 10px;font-size:13px;font-weight:600;' +
    'color:var(--mx-text-body)}' +
    '.section-title svg{width:16px;height:16px;color:var(--mx-primary)}' +
    '.section-title .grow{flex:1}' +
    '.pill{padding:3px 10px;border-radius:999px;background:var(--mx-primary);color:#fff;' +
    'font:600 12px ui-monospace,SFMono-Regular,monospace}' +
    '.rate{display:flex;align-items:center;gap:10px;padding:12px;border-radius:14px;background:var(--mx-surface2)}' +
    '.rate .icon-btn{width:32px;height:32px;background:var(--mx-surface);color:var(--mx-text)}' +
    '.rate .icon-btn:disabled{opacity:.35}' +
    '.track{flex:1;display:flex;flex-direction:column;gap:2px}' +
    'input[type=range]{width:100%;margin:0;accent-color:var(--mx-primary)}' +
    '.ticks{display:flex;justify-content:space-between;color:var(--mx-text-muted);font-size:10px}' +
    '.seg{display:flex;padding:3px;border-radius:12px;background:var(--mx-surface2);margin-bottom:10px}' +
    '.seg button{flex:1;padding:7px 0;border:0;border-radius:9px;background:none;color:var(--mx-text-muted);' +
    'font-size:13px;font-weight:600;transition:background .15s,color .15s}' +
    '.seg button.on{background:var(--mx-surface);color:var(--mx-text);box-shadow:0 1px 4px rgba(0,0,0,.25)}' +
    '.list{display:flex;flex-direction:column;gap:6px;max-height:34vh;overflow:auto;overscroll-behavior:contain}' +
    '.voice{position:relative;display:flex;align-items:center;gap:12px;width:100%;padding:10px 12px;' +
    'border:1.5px solid transparent;border-radius:14px;background:var(--mx-surface2);text-align:left}' +
    '.voice::before{content:"";position:absolute;inset:0;border-radius:inherit;background:var(--mx-primary);' +
    'opacity:0;transition:opacity .15s}' +
    '.voice.on{border-color:var(--mx-primary)}' +
    '.voice.on::before{opacity:.14}' +
    '.voice>*{position:relative}' +
    '.avatar{display:grid;place-items:center;width:36px;height:36px;border-radius:50%;flex:none;' +
    'font-weight:700;font-size:15px;color:#fff}' +
    '.avatar.female{background:#e17093}.avatar.male{background:#4a90d9}.avatar.none{background:var(--mx-text-muted)}' +
    '.who{flex:1;min-width:0}' +
    '.name{display:block;font-size:15px;font-weight:600;color:var(--mx-text);white-space:nowrap;overflow:hidden;' +
    'text-overflow:ellipsis}' +
    '.sex{display:block;font-size:12px;color:var(--mx-text-muted)}' +
    '.tier{padding:3px 8px;border-radius:8px;font-size:11px;font-weight:700;white-space:nowrap;' +
    'background:var(--mx-surface);color:var(--mx-text-body)}' +
    '.tier.pro{background:var(--mx-primary);color:#fff}' +
    '.tier.prohd{background:linear-gradient(135deg,#f5b041,#e67e22);color:#fff}' +
    '.tick{display:grid;place-items:center;width:22px;height:22px;border-radius:50%;flex:none;' +
    'background:var(--mx-primary);color:#fff;opacity:0}' +
    '.tick svg{width:14px;height:14px}' +
    '.voice.on .tick{opacity:1}' +
    '.skeleton{height:58px;border-radius:14px;background:var(--mx-surface2);animation:pulse 1.2s ease-in-out infinite}' +
    '@keyframes pulse{50%{opacity:.45}}' +
    '.status{padding:18px 12px;border-radius:14px;background:var(--mx-surface2);color:var(--mx-text-muted);' +
    'text-align:center;font-size:13px}' +
    '.done{display:block;width:100%;margin-top:16px;padding:13px;border:0;border-radius:14px;' +
    'background:var(--mx-primary);color:#fff;font-size:15px;font-weight:600}' +
    '.done:active,.voice:active,.icon-btn:active{transform:scale(.98)}'
  );
  box.card.innerHTML =
    '<div class="handle"></div>' +
    '<div class="head">' +
    '<div class="badge">' + ICON.voice + '</div>' +
    '<div class="titles"><p class="title"></p><p class="sub">SpeechGen.io</p></div>' +
    '<button class="icon-btn close">' + ICON.close + '</button>' +
    '</div>' +
    '<div class="note">' + ICON.info + '<span></span></div>' +
    '<div class="section">' +
    '<p class="section-title">' + ICON.speed + '<span class="grow rate-label"></span><span class="pill"></span></p>' +
    '<div class="rate">' +
    '<button class="icon-btn slower">' + ICON.minus + '</button>' +
    '<div class="track"><input type="range" min="' + RATE_MIN + '" max="' + RATE_MAX + '" step="' + RATE_STEP + '">' +
    '<div class="ticks"><span>0.5x</span><span>1x</span><span>1.5x</span><span>2x</span></div></div>' +
    '<button class="icon-btn faster">' + ICON.plus + '</button>' +
    '</div>' +
    '</div>' +
    '<div class="section">' +
    '<p class="section-title">' + ICON.voice + '<span class="grow voice-label"></span></p>' +
    '<div class="seg">' +
    '<button data-f="">' + (th ? 'ทั้งหมด' : 'All') + '</button>' +
    '<button data-f="female">' + (th ? 'หญิง' : 'Female') + '</button>' +
    '<button data-f="male">' + (th ? 'ชาย' : 'Male') + '</button>' +
    '</div>' +
    '<div class="list"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>' +
    '</div>' +
    '<button class="done"></button>';

  var q = function (s) { return box.card.querySelector(s); };
  q('.close').setAttribute('aria-label', th ? 'ปิด' : 'Close');
  q('.slower').setAttribute('aria-label', th ? 'ช้าลง' : 'Slower');
  q('.faster').setAttribute('aria-label', th ? 'เร็วขึ้น' : 'Faster');
  q('.title').textContent = th ? 'อ่านออกเสียง' : 'Read aloud';
  q('.note span').textContent = th
    ? 'ทุกตัวอักษรใช้เครดิต SpeechGen (Standard ×0.5, PRO ×1, HD ×2) ผู้ใช้ใหม่ได้ฟรีประมาณ 1,000 ตัวอักษร หลังจากนั้นเข้าสู่ระบบหรือซื้อเพิ่มบนเว็บ'
    : 'Every character uses SpeechGen credits (Standard ×0.5, PRO ×1, HD ×2). New visitors get about 1,000 characters free; after that sign in or buy more on the site.';
  q('.rate-label').textContent = th ? 'ความเร็ว' : 'Speed';
  q('.voice-label').textContent = th ? 'เสียง' : 'Voice';
  q('.done').textContent = th ? 'เสร็จ' : 'Done';

  var slider = q('input[type=range]');
  var pill = q('.pill');
  var list = q('.list');

  function roundRate(r) {
    r = Math.round((Number(r) || 1) * 10) / 10;
    return Math.min(RATE_MAX, Math.max(RATE_MIN, r));
  }

  function showRate(r) {
    r = roundRate(r);
    slider.value = r;
    pill.textContent = r.toFixed(1) + 'x';
    q('.slower').disabled = r <= RATE_MIN;
    q('.faster').disabled = r >= RATE_MAX;
  }

  function saveRate(r) {
    r = roundRate(r);
    showRate(r);
    ctx.setOption('rate', r).catch(function () {});
  }

  function sexLabel(sex) {
    if (sex === 'male') return th ? 'ชาย' : 'Male';
    if (sex === 'female') return th ? 'หญิง' : 'Female';
    return '';
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function voiceRow(v, current) {
    var tier = TIER[v.tier] || { name: v.tier, cost: '' };
    var row = el('button', 'voice' + (v.value === current ? ' on' : ''));
    row.setAttribute('data-v', v.value);
    row.appendChild(el('span', 'avatar ' + (v.sex || 'none'), String(v.name || '?').charAt(0).toUpperCase()));
    var who = el('span', 'who');
    who.appendChild(el('span', 'name', v.name));
    var sex = sexLabel(v.sex);
    if (sex) who.appendChild(el('span', 'sex', sex));
    row.appendChild(who);
    row.appendChild(el('span', 'tier ' + (TIER[v.tier] ? v.tier : ''), tier.name + (tier.cost ? ' ' + tier.cost : '')));
    var tick = el('span', 'tick');
    tick.innerHTML = ICON.check;
    row.appendChild(tick);
    return row;
  }

  function showStatus(text) {
    list.textContent = '';
    list.appendChild(el('div', 'status', text));
  }

  function drawFilter() {
    var buttons = box.card.querySelectorAll('.seg button');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].className = buttons[i].getAttribute('data-f') === filter ? 'on' : '';
    }
  }

  function drawVoices() {
    drawFilter();
    if (!voices) return;
    var current = chosen || voices.current;
    var shownVoices = voices.voices.filter(function (v) { return !filter || v.sex === filter; });
    if (!shownVoices.length) return showStatus(th ? 'ไม่มีเสียงในกลุ่มนี้' : 'No voices here');
    list.textContent = '';
    shownVoices.forEach(function (v) { list.appendChild(voiceRow(v, current)); });
    var on = list.querySelector('.voice.on');
    if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' });
  }

  showRate(ctx.options.rate);
  drawFilter();
  ctx.on(slider, 'input', function () { showRate(slider.value); });
  ctx.on(slider, 'change', function () { saveRate(slider.value); });
  ctx.on(q('.slower'), 'click', function () { saveRate(Number(slider.value) - RATE_STEP); });
  ctx.on(q('.faster'), 'click', function () { saveRate(Number(slider.value) + RATE_STEP); });
  ctx.on(q('.seg'), 'click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    filter = b.getAttribute('data-f') || '';
    drawVoices();
  });
  ctx.on(list, 'click', function (e) {
    var b = e.target.closest('.voice');
    if (!b) return;
    chosen = b.getAttribute('data-v');
    drawVoices();
    ctx.setOption('voice', chosen).catch(function () {});
  });
  ctx.on(q('.close'), 'click', function () { ctx.close(); });
  ctx.on(q('.done'), 'click', function () { ctx.close(); });
  ctx.onOptions(function (options) {
    showRate(options.rate);
    chosen = String(options.voice || '');
    drawVoices();
  });

  ctx.companion.onMessage(function (msg) {
    if (msg && msg.type === 'voices' && Array.isArray(msg.voices)) {
      voices = msg;
      drawVoices();
    }
  });

  // The voices are the site's: ask the companion page, opening it (hidden) when reading is off.
  ctx.companion.state().then(function (s) {
    if (!s || !s.open) openedHere = true;
    return ctx.companion.open({ view: s && s.open ? s.view : 'hidden' });
  }).then(function () {
    return ctx.companion.send({ type: 'voices' });
  }).catch(function (e) {
    showStatus((th ? 'เปิด SpeechGen ไม่ได้: ' : 'Could not open SpeechGen: ') + ((e && e.message) || e));
  });

  return function () {
    if (openedHere) ctx.companion.close().catch(function () {});
  };
});
