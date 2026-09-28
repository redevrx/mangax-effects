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
  var TIER = { standard: 'Standard ×0.5', pro: 'PRO ×1', prohd: 'HD ×2' };
  var openedHere = false;
  var voices = null;

  var box = ctx.panel();
  box.css(
    '.title{font-weight:700;font-size:16px;margin:0 0 4px}' +
    '.note{color:var(--mx-text-muted);font-size:12px;margin:0 0 12px}' +
    '.row{display:flex;align-items:center;gap:12px;margin:10px 0 4px}' +
    '.label{flex:1;color:var(--mx-text-body)}' +
    '.value{font:12px ui-monospace,monospace;color:var(--mx-text);min-width:48px;text-align:right}' +
    'input[type=range]{width:100%;accent-color:var(--mx-primary)}' +
    '.filter{display:flex;gap:6px;margin:6px 0}' +
    '.filter button{flex:1;padding:6px;border-radius:10px;border:1px solid var(--mx-surface2);background:none;color:var(--mx-text-body);font:12px system-ui,sans-serif}' +
    '.filter button.on{background:var(--mx-primary);border-color:var(--mx-primary);color:#fff}' +
    '.list{max-height:38vh;overflow:auto;border-radius:12px;background:var(--mx-surface2)}' +
    '.voice{display:flex;justify-content:space-between;gap:8px;width:100%;padding:10px 12px;border:0;background:none;color:var(--mx-text);text-align:left;font:14px system-ui,sans-serif}' +
    '.voice+.voice{border-top:1px solid var(--mx-surface)}' +
    '.voice small{color:var(--mx-text-muted)}' +
    '.voice.on{background:var(--mx-primary);color:#fff}.voice.on small{color:#fff}' +
    '.status{padding:14px;color:var(--mx-text-muted);text-align:center;font-size:13px}' +
    '.done{display:block;width:100%;margin-top:14px;padding:12px;border:0;border-radius:12px;background:var(--mx-primary);color:#fff;font:600 14px system-ui,sans-serif}'
  );
  box.card.innerHTML =
    '<p class="title"></p><p class="note"></p>' +
    '<div class="row"><span class="label rate-label"></span><span class="value"></span></div>' +
    '<input type="range" min="0.5" max="2" step="0.1">' +
    '<div class="row"><span class="label voice-label"></span></div>' +
    '<div class="filter"><button data-f="">' + (th ? 'ทั้งหมด' : 'All') + '</button>' +
    '<button data-f="female">' + (th ? 'หญิง' : 'Female') + '</button>' +
    '<button data-f="male">' + (th ? 'ชาย' : 'Male') + '</button></div>' +
    '<div class="list"><div class="status"></div></div>' +
    '<button class="done"></button>';
  var q = function (s) { return box.card.querySelector(s); };
  q('.title').textContent = th ? 'อ่านออกเสียงด้วย SpeechGen' : 'Read aloud with SpeechGen';
  q('.note').textContent = th
    ? 'ทุกตัวอักษรใช้เครดิต SpeechGen (×0.5 – ×2 ตามเสียง) ฟรีประมาณ 2,000 เครดิต หลังจากนั้นต้องเข้าสู่ระบบหรือซื้อเพิ่มบนเว็บ'
    : 'Every character uses SpeechGen credits (×0.5 – ×2 by voice). About 2,000 are free; after that sign in or buy more on the site.';
  q('.rate-label').textContent = th ? 'ความเร็ว' : 'Speed';
  q('.voice-label').textContent = th ? 'เสียง' : 'Voice';
  q('.done').textContent = th ? 'เสร็จ' : 'Done';
  q('.status').textContent = th ? 'กำลังโหลดรายชื่อเสียงจาก SpeechGen…' : 'Loading voices from SpeechGen…';

  var slider = q('input[type=range]');
  var value = q('.value');
  var list = q('.list');
  var filter = '';
  var chosen = String(ctx.options.voice || '');

  function showRate(r) {
    r = Math.round((Number(r) || 1) * 10) / 10;
    slider.value = r;
    value.textContent = r.toFixed(1) + 'x';
  }

  function drawVoices() {
    if (!voices) return;
    var buttons = box.card.querySelectorAll('.filter button');
    for (var i = 0; i < buttons.length; i++) buttons[i].className = buttons[i].getAttribute('data-f') === filter ? 'on' : '';
    list.textContent = '';
    var current = chosen || voices.current;
    voices.voices.forEach(function (v) {
      if (filter && v.sex !== filter) return;
      var b = document.createElement('button');
      b.className = 'voice' + (v.value === current ? ' on' : '');
      b.setAttribute('data-v', v.value);
      var name = document.createElement('span');
      name.textContent = v.name;
      var tier = document.createElement('small');
      tier.textContent = (TIER[v.tier] || v.tier) + (v.sex ? ' · ' + (v.sex === 'male' ? (th ? 'ชาย' : 'male') : (th ? 'หญิง' : 'female')) : '');
      b.appendChild(name);
      b.appendChild(tier);
      list.appendChild(b);
    });
    if (!list.firstChild) {
      var none = document.createElement('div');
      none.className = 'status';
      none.textContent = th ? 'ไม่มีเสียง' : 'No voices';
      list.appendChild(none);
    }
  }

  showRate(ctx.options.rate);
  ctx.on(slider, 'input', function () { showRate(slider.value); });
  ctx.on(slider, 'change', function () { ctx.setOption('rate', Math.round(Number(slider.value) * 10) / 10).catch(function () {}); });
  ctx.on(q('.filter'), 'click', function (e) {
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

  function fail(text) {
    var status = q('.status');
    if (status) status.textContent = text;
  }

  // The voices are the site's: ask the companion page, opening it (hidden) when reading is off.
  ctx.companion.state().then(function (s) {
    if (!s || !s.open) openedHere = true;
    return ctx.companion.open({ view: s && s.open ? s.view : 'hidden' });
  }).then(function () {
    return ctx.companion.send({ type: 'voices' });
  }).catch(function (e) {
    fail((th ? 'เปิด SpeechGen ไม่ได้: ' : 'Could not open SpeechGen: ') + ((e && e.message) || e));
  });

  return function () {
    if (openedHere) ctx.companion.close().catch(function () {});
  };
});
