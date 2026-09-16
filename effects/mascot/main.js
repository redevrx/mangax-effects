mangax.effect(function (ctx) {
  var activeTimers = [];
  var cleanups = [];

  function safeTimeout(fn, ms) {
    var id = setTimeout(function () {
      var idx = activeTimers.indexOf(id);
      if (idx >= 0) activeTimers.splice(idx, 1);
      try { fn(); } catch (e) {}
    }, ms);
    activeTimers.push(id);
    return id;
  }

  var options = ctx.options || {};
  var currentSize = typeof options.size === 'number' ? options.size : 80;
  var reactToReading = options.interactive !== false;

  ctx.addStyle(
    '#mx-pet {\n' +
    '  position: fixed;\n' +
    '  bottom: 24px;\n' +
    '  left: 0;\n' +
    '  width: var(--mx-pet-size, ' + currentSize + 'px);\n' +
    '  height: calc(var(--mx-pet-size, ' + currentSize + 'px) * 1.25);\n' +
    '  z-index: 999999;\n' +
    '  pointer-events: auto;\n' +
    '  cursor: grab;\n' +
    '  touch-action: none;\n' +
    '  user-select: none;\n' +
    '  -webkit-user-select: none;\n' +
    '  -webkit-tap-highlight-color: transparent;\n' +
    '  will-change: transform, left, bottom;\n' +
    '  filter: drop-shadow(0 6px 12px rgba(99, 102, 241, .4));\n' +
    '}\n' +
    '#mx-pet:active { cursor: grabbing; }\n' +
    '#mx-pet.dragging {\n' +
    '  cursor: grabbing;\n' +
    '  transform: scale(1.12) rotate(6deg) !important;\n' +
    '  filter: drop-shadow(0 14px 20px rgba(99, 102, 241, .55)) !important;\n' +
    '  transition: transform .12s ease-out !important;\n' +
    '}\n' +
    '#mx-pet svg { width: 100%; height: 100%; display: block; overflow: visible; }\n' +
    '\n' +
    '/* เดิน: ขาสลับ */\n' +
    '@keyframes mx-leg-l { 0%,100%{transform:rotate(-22deg)} 50%{transform:rotate(22deg)} }\n' +
    '@keyframes mx-leg-r { 0%,100%{transform:rotate(22deg)}  50%{transform:rotate(-22deg)} }\n' +
    '#mx-pet.walking .mx-leg-l { animation: mx-leg-l .32s ease-in-out infinite; }\n' +
    '#mx-pet.walking .mx-leg-r { animation: mx-leg-r .32s ease-in-out infinite; }\n' +
    '\n' +
    '/* แขนสลับ */\n' +
    '@keyframes mx-arm-l { 0%,100%{transform:rotate(-14deg)} 50%{transform:rotate(14deg)} }\n' +
    '@keyframes mx-arm-r { 0%,100%{transform:rotate(14deg)}  50%{transform:rotate(-14deg)} }\n' +
    '#mx-pet.walking .mx-arm-l { animation: mx-arm-l .32s ease-in-out infinite; }\n' +
    '#mx-pet.walking .mx-arm-r { animation: mx-arm-r .32s ease-in-out infinite; }\n' +
    '\n' +
    '/* ตัวโยกขึ้นลงตอนเดิน */\n' +
    '@keyframes mx-bounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }\n' +
    '#mx-pet.walking svg { animation: mx-bounce .32s ease-in-out infinite; }\n' +
    '\n' +
    '/* หายใจตอนยืนเฉย */\n' +
    '@keyframes mx-breathe { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-3px) scale(1.02); } }\n' +
    '#mx-pet.idle svg { animation: mx-breathe 2.6s ease-in-out infinite; }\n' +
    '\n' +
    '/* ตากะพริบ */\n' +
    '@keyframes mx-blink { 0%, 92%, 100% { transform: scaleY(1); } 95% { transform: scaleY(.08); } }\n' +
    '#mx-pet .mx-eye-l, #mx-pet .mx-eye-r { transform-origin: center; animation: mx-blink 4.2s infinite; }\n' +
    '\n' +
    '/* หูขยับเบาๆ */\n' +
    '@keyframes mx-ear { 0%,90%,100% { transform: rotate(0); } 95% { transform: rotate(-9deg); } }\n' +
    '#mx-pet .mx-ear-l { transform-origin: 88px 55px; animation: mx-ear 5s infinite; }\n' +
    '#mx-pet .mx-ear-r { transform-origin: 152px 55px; animation: mx-ear 5s infinite .4s; }\n' +
    '\n' +
    '/* Halo หมุน */\n' +
    '@keyframes mx-halo-spin { to { transform: rotate(360deg); } }\n' +
    '#mx-pet .mx-halo { animation: mx-halo-spin 18s linear infinite; }\n' +
    '\n' +
    '/* ท่าทางต่างๆ */\n' +
    '#mx-pet.jump svg { animation: mx-jump .55s cubic-bezier(.34,1.56,.64,1) 2 !important; }\n' +
    '@keyframes mx-jump { 0%,100% { transform: translateY(0) scale(1); } 40% { transform: translateY(-38px) scale(1.08); } }\n' +
    '\n' +
    '#mx-pet.yawn svg { animation: mx-yawn 1.8s ease-in-out !important; }\n' +
    '@keyframes mx-yawn { 0%,100% { transform: translateY(0) rotate(0); } 50% { transform: translateY(8px) rotate(-4deg); } }\n' +
    '#mx-pet.yawn .mx-mouth { d: path("M114 98 Q120 110 126 98 Q120 116 114 98"); }\n' +
    '\n' +
    '#mx-pet.shake svg { animation: mx-shake .5s ease-in-out 3 !important; }\n' +
    '@keyframes mx-shake { 0%,100% { transform: rotate(0); } 25% { transform: rotate(-12deg); } 75% { transform: rotate(12deg); } }\n' +
    '\n' +
    '#mx-pet.tap svg { animation: mx-tap .4s cubic-bezier(.34,1.56,.64,1) !important; }\n' +
    '@keyframes mx-tap { 0% { transform: scale(1) rotate(0); } 40% { transform: scale(1.25) rotate(12deg); } 100% { transform: scale(1) rotate(0); } }\n' +
    '\n' +
    '#mx-pet.cheer svg { animation: mx-cheer .5s ease-in-out 4 !important; }\n' +
    '@keyframes mx-cheer { 0%,100% { transform: translateY(0) rotate(0); } 25% { transform: translateY(-22px) rotate(-8deg); } 75% { transform: translateY(-22px) rotate(8deg); } }\n' +
    '\n' +
    '/* หัวใจลอยตอนแตะ */\n' +
    '.mx-heart {\n' +
    '  position: fixed;\n' +
    '  font-size: 22px;\n' +
    '  pointer-events: none;\n' +
    '  z-index: 1000000;\n' +
    '  animation: mx-heart-up 1.1s ease-out forwards;\n' +
    '}\n' +
    '@keyframes mx-heart-up {\n' +
    '  0%   { opacity: 1; transform: translate(0, 0) scale(.6); }\n' +
    '  100% { opacity: 0; transform: translate(var(--hx, 0), -80px) scale(1.3); }\n' +
    '}\n' +
    '\n' +
    '/* ประกายตัวอักษร */\n' +
    '@keyframes mx-spark { 0% { opacity: 0; transform: translateY(0) scale(.6); } 30% { opacity: 1; } 100% { opacity: 0; transform: translateY(-30px) scale(1.1); } }\n' +
    '#mx-pet .mx-spark-1 { animation: mx-spark 3s ease-out infinite; }\n' +
    '#mx-pet .mx-spark-2 { animation: mx-spark 3s ease-out infinite .7s; }\n' +
    '#mx-pet .mx-spark-3 { animation: mx-spark 3s ease-out infinite 1.4s; }\n' +
    '#mx-pet .mx-spark-4 { animation: mx-spark 3s ease-out infinite 2.1s; }\n' +
    '\n' +
    '/* กลับทิศ */\n' +
    '#mx-pet.face-left svg { transform: scaleX(-1); }\n'
  );

  var mascot = document.createElement('div');
  mascot.id = 'mx-pet';
  mascot.classList.add('idle');
  mascot.innerHTML =
    '<svg viewBox="0 0 240 300" xmlns="http://www.w3.org/2000/svg">\n' +
    '  <defs>\n' +
    '    <linearGradient id="mx-gx" x1="0%" y1="0%" x2="100%" y2="100%">\n' +
    '      <stop offset="0%"   stop-color="#3EE0FF"/>\n' +
    '      <stop offset="50%"  stop-color="#6366F1"/>\n' +
    '      <stop offset="100%" stop-color="#A855F7"/>\n' +
    '    </linearGradient>\n' +
    '    <linearGradient id="mx-gxd" x1="0%" y1="0%" x2="0%" y2="100%">\n' +
    '      <stop offset="0%"   stop-color="#6366F1"/>\n' +
    '      <stop offset="100%" stop-color="#7E22CE"/>\n' +
    '    </linearGradient>\n' +
    '    <filter id="mx-glow" x="-50%" y="-50%" width="200%" height="200%">\n' +
    '      <feGaussianBlur stdDeviation="2" result="b"/>\n' +
    '      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>\n' +
    '    </filter>\n' +
    '    <radialGradient id="mx-shadow" cx="50%" cy="50%" r="50%">\n' +
    '      <stop offset="0%" stop-color="#000" stop-opacity=".4"/>\n' +
    '      <stop offset="100%" stop-color="#000" stop-opacity="0"/>\n' +
    '    </radialGradient>\n' +
    '  </defs>\n' +
    '  <ellipse cx="120" cy="285" rx="60" ry="9" fill="url(#mx-shadow)"/>\n' +
    '  <g class="mx-halo" style="transform-origin:120px 85px;">\n' +
    '    <circle cx="120" cy="85" r="52" fill="none" stroke="#1a1a1a" stroke-width="9"/>\n' +
    '    <circle cx="120" cy="85" r="52" fill="none" stroke="#2e2e2e" stroke-width="3"/>\n' +
    '    <circle cx="120" cy="33"  r="2.5" fill="#3EE0FF"/>\n' +
    '    <circle cx="172" cy="85"  r="2.5" fill="#A855F7"/>\n' +
    '    <circle cx="120" cy="137" r="2.5" fill="#6366F1"/>\n' +
    '    <circle cx="68"  cy="85"  r="2.5" fill="#3EE0FF"/>\n' +
    '  </g>\n' +
    '  <g stroke-linecap="round">\n' +
    '    <path class="mx-leg-l" d="M88 220 L82 255 L76 270" stroke="url(#mx-gxd)" stroke-width="15" fill="none" style="transform-origin:88px 220px;"/>\n' +
    '    <ellipse cx="72" cy="274" rx="15" ry="8" fill="#1a1a2e"/>\n' +
    '    <path class="mx-leg-r" d="M152 220 L158 255 L164 270" stroke="url(#mx-gxd)" stroke-width="15" fill="none" style="transform-origin:152px 220px;"/>\n' +
    '    <ellipse cx="168" cy="274" rx="15" ry="8" fill="#1a1a2e"/>\n' +
    '  </g>\n' +
    '  <g class="mx-arm-l" style="transform-origin:60px 180px;">\n' +
    '    <path d="M60 180 Q30 200 28 230" stroke="url(#mx-gxd)" stroke-width="12" fill="none" stroke-linecap="round"/>\n' +
    '    <circle cx="28" cy="234" r="10" fill="url(#mx-gxd)" stroke="#fff" stroke-width="2"/>\n' +
    '    <g transform="translate(6 240) rotate(-15)">\n' +
    '      <rect x="0" y="0" width="26" height="32" rx="3" fill="#fff" stroke="#1a1a2e" stroke-width="2"/>\n' +
    '      <line x1="5" y1="9"  x2="21" y2="9"  stroke="#A855F7" stroke-width="1.8"/>\n' +
    '      <line x1="5" y1="15" x2="21" y2="15" stroke="#6366F1" stroke-width="1.8"/>\n' +
    '      <line x1="5" y1="21" x2="16" y2="21" stroke="#3EE0FF" stroke-width="1.8"/>\n' +
    '    </g>\n' +
    '  </g>\n' +
    '  <g class="mx-arm-r" style="transform-origin:180px 180px;">\n' +
    '    <path d="M180 180 Q210 200 212 230" stroke="url(#mx-gxd)" stroke-width="12" fill="none" stroke-linecap="round"/>\n' +
    '    <circle cx="212" cy="234" r="10" fill="url(#mx-gxd)" stroke="#fff" stroke-width="2"/>\n' +
    '    <g transform="translate(206 244) rotate(20)">\n' +
    '      <rect x="0" y="0" width="7" height="30" rx="2" fill="#1a1a2e"/>\n' +
    '      <polygon points="0,30 7,30 3.5,38" fill="#A855F7"/>\n' +
    '      <rect x="0" y="0" width="7" height="7" fill="#3EE0FF"/>\n' +
    '    </g>\n' +
    '  </g>\n' +
    '  <path d="M72 130 L120 178 L168 130 L192 154 L144 202 L192 250 L168 274 L120 226 L72 274 L48 250 L96 202 L48 154 Z"\n' +
    '        fill="url(#mx-gx)" stroke="#fff" stroke-width="4" stroke-linejoin="round" filter="url(#mx-glow)"/>\n' +
    '  <rect x="112" y="118" width="16" height="18" fill="url(#mx-gxd)"/>\n' +
    '  <path class="mx-ear-l" d="M88 55 L82 22 L108 42 Z" fill="url(#mx-gx)" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>\n' +
    '  <path class="mx-ear-r" d="M152 55 L158 22 L132 42 Z" fill="url(#mx-gx)" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>\n' +
    '  <path d="M90 52 L86 32 L104 46 Z" fill="#FF9EC7" opacity=".9"/>\n' +
    '  <path d="M150 52 L154 32 L136 46 Z" fill="#FF9EC7" opacity=".9"/>\n' +
    '  <circle cx="120" cy="80" r="42" fill="url(#mx-gx)" stroke="#fff" stroke-width="4"/>\n' +
    '  <ellipse cx="94"  cy="92" rx="9" ry="5.5" fill="#FF9EC7" opacity=".85"/>\n' +
    '  <ellipse cx="146" cy="92" rx="9" ry="5.5" fill="#FF9EC7" opacity=".85"/>\n' +
    '  <ellipse class="mx-eye-l" cx="106" cy="80" rx="7" ry="9" fill="#1a1a2e"/>\n' +
    '  <ellipse cx="106" cy="77" rx="3" ry="3.5" fill="#fff"/>\n' +
    '  <circle cx="104" cy="82" r="1.5" fill="#fff"/>\n' +
    '  <ellipse class="mx-eye-r" cx="134" cy="80" rx="7" ry="9" fill="#1a1a2e"/>\n' +
    '  <ellipse cx="134" cy="77" rx="3" ry="3.5" fill="#fff"/>\n' +
    '  <circle cx="132" cy="82" r="1.5" fill="#fff"/>\n' +
    '  <path class="mx-mouth" d="M114 98 Q120 104 126 98" stroke="#1a1a2e" stroke-width="2.5" fill="none" stroke-linecap="round"/>\n' +
    '  <g font-family="sans-serif" font-weight="bold" font-size="13">\n' +
    '    <text class="mx-spark-1" x="196" y="120" fill="#FFD93D">あ</text>\n' +
    '    <text class="mx-spark-2" x="34"  y="140" fill="#3EE0FF">A</text>\n' +
    '    <text class="mx-spark-3" x="196" y="230" fill="#A855F7">ก</text>\n' +
    '    <text class="mx-spark-4" x="30"  y="230" fill="#FF9EC7">字</text>\n' +
    '  </g>\n' +
    '</svg>';

  document.body.appendChild(mascot);

  var margin = 16;
  var state = {
    size: currentSize,
    x: Math.max(margin, window.innerWidth - currentSize - 20),
    targetX: Math.max(margin, window.innerWidth - currentSize - 20),
    bottom: 24,
    speed: 1.2,
    isWalking: false,
    isBusy: false,
    lastInteract: Date.now(),
    rafId: null,
    cheeredEnd: false
  };

  mascot.style.left = state.x + 'px';
  mascot.style.bottom = state.bottom + 'px';

  // ===== Drag & Drop =====
  var isPointerDown = false;
  var isDragging = false;
  var startPointerX = 0;
  var startPointerY = 0;
  var startMascotLeft = 0;
  var startMascotBottom = 0;

  ctx.on(mascot, 'pointerdown', function (e) {
    if (e.button !== undefined && e.button !== 0) return;
    isPointerDown = true;
    isDragging = false;
    startPointerX = e.clientX;
    startPointerY = e.clientY;
    startMascotLeft = state.x;
    startMascotBottom = state.bottom;
    state.lastInteract = Date.now();

    if (mascot.setPointerCapture) {
      try { mascot.setPointerCapture(e.pointerId); } catch (err) {}
    }
  });

  ctx.on(mascot, 'pointermove', function (e) {
    if (!isPointerDown) return;
    var dx = e.clientX - startPointerX;
    var dy = e.clientY - startPointerY;

    if (!isDragging && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      isDragging = true;
      state.isWalking = false;
      mascot.classList.add('dragging');
      mascot.classList.remove('walking', 'idle');
    }

    if (isDragging) {
      state.lastInteract = Date.now();
      var curW = state.size;
      var curH = state.size * 1.25;
      var maxX = Math.max(margin, window.innerWidth - curW - margin);
      var maxB = Math.max(margin, window.innerHeight - curH - margin);

      var newX = Math.max(margin, Math.min(maxX, startMascotLeft + dx));
      var newBottom = Math.max(margin, Math.min(maxB, startMascotBottom - dy));

      state.x = newX;
      state.targetX = newX;
      state.bottom = newBottom;
      mascot.style.left = newX + 'px';
      mascot.style.bottom = newBottom + 'px';
    }
  });

  function spawnHearts(cx, cy) {
    var emojis = ['💜', '💙', '✨', '💖'];
    for (var i = 0; i < 3; i++) {
      var h = document.createElement('div');
      h.className = 'mx-heart';
      h.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      h.style.left = (cx - 10) + 'px';
      h.style.top = (cy - 10) + 'px';
      h.style.setProperty('--hx', (Math.random() * 80 - 40) + 'px');
      document.body.appendChild(h);
      safeTimeout(function () {
        if (h.parentNode) h.parentNode.removeChild(h);
      }, 1100);
    }
  }

  function doAction(name, duration) {
    if (state.isBusy || isDragging) return;
    state.isBusy = true;
    state.isWalking = false;
    mascot.classList.remove('walking', 'idle');
    mascot.classList.add(name);

    safeTimeout(function () {
      mascot.classList.remove(name);
      if (!isDragging) {
        mascot.classList.add('idle');
      }
      state.isBusy = false;
    }, duration || 1500);
  }

  function onPointerEnd(e) {
    if (!isPointerDown) return;
    isPointerDown = false;

    if (mascot.releasePointerCapture) {
      try { mascot.releasePointerCapture(e.pointerId); } catch (err) {}
    }

    if (isDragging) {
      isDragging = false;
      mascot.classList.remove('dragging');
      mascot.classList.add('idle');
      state.lastInteract = Date.now();
    } else {
      // Tap/click
      state.lastInteract = Date.now();
      doAction('tap', 450);
      spawnHearts(e.clientX, e.clientY);
    }
  }

  ctx.on(mascot, 'pointerup', onPointerEnd);
  ctx.on(mascot, 'pointercancel', onPointerEnd);

  // ===== Animation Loop (Walking / Idle) =====
  function tick() {
    if (!isDragging && !state.isBusy) {
      var dx = state.targetX - state.x;
      if (Math.abs(dx) < 2) {
        if (state.isWalking) {
          state.isWalking = false;
          mascot.classList.remove('walking');
          mascot.classList.add('idle');
        }
      } else {
        if (!state.isWalking) {
          state.isWalking = true;
          mascot.classList.remove('idle');
          mascot.classList.add('walking');
        }
        state.x += Math.sign(dx) * state.speed;
        if (dx < 0) {
          mascot.classList.add('face-left');
        } else {
          mascot.classList.remove('face-left');
        }
        mascot.style.left = state.x + 'px';
      }
    }
    state.rafId = requestAnimationFrame(tick);
  }
  state.rafId = requestAnimationFrame(tick);

  // ===== AI Autonomous Behavior =====
  function pickNewTarget() {
    if (state.isBusy || isDragging) return;
    var maxX = Math.max(margin, window.innerWidth - state.size - margin);
    var nx;
    var attempts = 0;
    do {
      nx = margin + Math.random() * (maxX - margin);
      attempts++;
    } while (Math.abs(nx - state.x) < 80 && attempts < 10);
    state.targetX = nx;
    state.speed = 0.9 + Math.random() * 1.3;
  }

  function randomAction() {
    if (state.isBusy || isDragging) return;
    var actions = ['jump', 'yawn', 'shake', 'walk', 'walk'];
    var pick = actions[Math.floor(Math.random() * actions.length)];
    if (pick === 'walk') {
      pickNewTarget();
    } else {
      doAction(pick, pick === 'yawn' ? 1800 : (pick === 'shake' ? 1500 : 1100));
    }
  }

  var aiInterval = setInterval(function () {
    if (Date.now() - state.lastInteract > 4000) {
      randomAction();
    }
  }, 3600);

  // ===== Reading Reactions =====
  if (reactToReading) {
    var lastY = window.scrollY || window.pageYOffset || 0;
    var lastT = Date.now();

    ctx.on(window, 'scroll', function () {
      state.lastInteract = Date.now();
      var now = Date.now();
      var curY = window.scrollY || window.pageYOffset || 0;
      var dt = (now - lastT) || 1;
      var scrollSpeed = Math.abs(curY - lastY) / dt;
      lastY = curY;
      lastT = now;

      if (scrollSpeed > 1.2) {
        state.speed = Math.min(3.2, 1.2 + scrollSpeed * 0.6);
        if (Math.random() < 0.12) pickNewTarget();
      } else {
        state.speed = 1.2;
      }

      // Check if reached end of chapter
      var docH = document.documentElement.scrollHeight || document.body.scrollHeight || 0;
      var winH = window.innerHeight;
      if (docH > winH * 1.4 && (curY + winH >= docH - 80)) {
        if (!state.cheeredEnd) {
          state.cheeredEnd = true;
          doAction('cheer', 2200);
          safeTimeout(function () { state.cheeredEnd = false; }, 8000);
        }
      }
    }, { passive: true });

    if (typeof IntersectionObserver !== 'undefined') {
      var io = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting) {
            state.lastInteract = Date.now();
            doAction('cheer', 2200);
            break;
          }
        }
      }, { threshold: 0.1 });

      ctx.observe('.viewer_footer, #comment, .comment_area, #comments, .viewer_end, .ep_bottom', function (el) {
        io.observe(el);
      });
      cleanups.push(function () { io.disconnect(); });
    }
  }

  // ===== Handle Option Changes =====
  ctx.onOptions(function (opts) {
    if (typeof opts.size === 'number') {
      state.size = opts.size;
      mascot.style.setProperty('--mx-pet-size', opts.size + 'px');
    }
    if (typeof opts.interactive === 'boolean') {
      reactToReading = opts.interactive;
    }
  });

  // ===== Resize =====
  ctx.on(window, 'resize', function () {
    var curW = state.size;
    var curH = state.size * 1.25;
    var maxX = Math.max(margin, window.innerWidth - curW - margin);
    var maxB = Math.max(margin, window.innerHeight - curH - margin);
    if (state.x > maxX) {
      state.x = maxX;
      state.targetX = maxX;
      mascot.style.left = maxX + 'px';
    }
    if (state.bottom > maxB) {
      state.bottom = maxB;
      mascot.style.bottom = maxB + 'px';
    }
  }, { passive: true });

  // ===== Reversible Cleanup =====
  return function () {
    if (state.rafId) cancelAnimationFrame(state.rafId);
    clearInterval(aiInterval);
    for (var i = 0; i < activeTimers.length; i++) {
      clearTimeout(activeTimers[i]);
    }
    activeTimers = [];
    for (var j = 0; j < cleanups.length; j++) {
      try { cleanups[j](); } catch (e) {}
    }
    cleanups = [];
    if (mascot.parentNode) {
      mascot.parentNode.removeChild(mascot);
    }
    var hearts = document.querySelectorAll('.mx-heart');
    for (var k = 0; k < hearts.length; k++) {
      if (hearts[k].parentNode) hearts[k].parentNode.removeChild(hearts[k]);
    }
  };
});
