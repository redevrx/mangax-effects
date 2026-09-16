mangax.effect(function (ctx) {
  // ================================================================
  // ============ HELPERS ============
  // ================================================================
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

  function safeInterval(fn, ms) {
    var id = setInterval(function () { try { fn(); } catch (e) {} }, ms);
    cleanups.push(function () { clearInterval(id); });
    return id;
  }

  // ================================================================
  // ============ OPTIONS ============
  // ================================================================
  var options = ctx.options || {};
  var currentSize = typeof options.size === 'number' ? options.size : 80;
  var reactToReading = options.interactive !== false;
  var chattiness = options.chattiness || 'normal';
  var defaultPosition = options.position || 'top';
  var isTop = defaultPosition === 'top';

  function sayChance() {
    if (chattiness === 'quiet') return 0.15;
    if (chattiness === 'chatty') return 0.8;
    return 0.45;
  }

  // ================================================================
  // ============ CSS ============
  // ================================================================
  ctx.addStyle(
      '#mx-pet{position:fixed;' +
      'width:var(--mx-pet-size,' + currentSize + 'px);' +
      'height:calc(var(--mx-pet-size,' + currentSize + 'px)*1.25);' +
      'z-index:999999;pointer-events:auto;cursor:grab;touch-action:none;' +
      'user-select:none;-webkit-user-select:none;-webkit-tap-highlight-color:transparent;' +
      'will-change:transform,left,top,bottom;' +
      'filter:drop-shadow(0 6px 12px rgba(99,102,241,.4));}\n' +
      '#mx-pet.at-top{top:24px;bottom:auto;}\n' +
      '#mx-pet.at-bottom{bottom:24px;top:auto;}\n' +
      '#mx-pet:active{cursor:grabbing;}\n' +
      '#mx-pet.dragging{cursor:grabbing;transform:scale(1.12) rotate(6deg)!important;' +
      'filter:drop-shadow(0 14px 20px rgba(99,102,241,.55))!important;' +
      'transition:transform .12s ease-out!important;}\n' +
      '#mx-pet svg{width:100%;height:100%;display:block;overflow:visible;}\n' +

      // บอลลูน
      '#mx-pet-bubble{position:absolute;left:50%;transform:translateX(-50%) scale(0);' +
      'transform-origin:bottom center;background:rgba(26,26,46,.95);color:#fff;' +
      'border:2px solid #818cf8;border-radius:12px;padding:5px 10px;font-size:12px;' +
      'font-weight:600;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
      'white-space:nowrap;pointer-events:none;opacity:0;' +
      'transition:transform .22s cubic-bezier(.34,1.56,.64,1),opacity .18s ease;' +
      'box-shadow:0 4px 14px rgba(0,0,0,.35);z-index:10;}\n' +
      '#mx-pet.at-bottom #mx-pet-bubble{bottom:104%;top:auto;transform-origin:bottom center;}\n' +
      '#mx-pet.at-top #mx-pet-bubble{top:104%;bottom:auto;transform-origin:top center;}\n' +
      '#mx-pet-bubble.show{transform:translateX(-50%) scale(1);opacity:1;}\n' +
      '#mx-pet.at-bottom #mx-pet-bubble::after{content:"";position:absolute;top:100%;left:50%;' +
      'margin-left:-5px;border-width:5px;border-style:solid;border-color:#818cf8 transparent transparent transparent;}\n' +
      '#mx-pet.at-top #mx-pet-bubble::after{content:"";position:absolute;bottom:100%;left:50%;' +
      'margin-left:-5px;border-width:5px;border-style:solid;border-color:transparent transparent #818cf8 transparent;}\n' +

      // เดิน
      '@keyframes mx-leg-l{0%,100%{transform:rotate(-22deg)}50%{transform:rotate(22deg)}}\n' +
      '@keyframes mx-leg-r{0%,100%{transform:rotate(22deg)}50%{transform:rotate(-22deg)}}\n' +
      '#mx-pet.walking .mx-leg-l{animation:mx-leg-l .32s ease-in-out infinite;}\n' +
      '#mx-pet.walking .mx-leg-r{animation:mx-leg-r .32s ease-in-out infinite;}\n' +
      '@keyframes mx-arm-l{0%,100%{transform:rotate(-14deg)}50%{transform:rotate(14deg)}}\n' +
      '@keyframes mx-arm-r{0%,100%{transform:rotate(14deg)}50%{transform:rotate(-14deg)}}\n' +
      '#mx-pet.walking .mx-arm-l{animation:mx-arm-l .32s ease-in-out infinite;}\n' +
      '#mx-pet.walking .mx-arm-r{animation:mx-arm-r .32s ease-in-out infinite;}\n' +
      '@keyframes mx-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}\n' +
      '#mx-pet.walking svg{animation:mx-bounce .32s ease-in-out infinite;}\n' +
      '@keyframes mx-breathe{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-3px) scale(1.02)}}\n' +
      '#mx-pet.idle svg{animation:mx-breathe 2.6s ease-in-out infinite;}\n' +

      // ตา/หู/halo
      '@keyframes mx-blink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.08)}}\n' +
      '#mx-pet .mx-eye-l,#mx-pet .mx-eye-r{transform-origin:center;animation:mx-blink 4.2s infinite;}\n' +
      '@keyframes mx-ear{0%,90%,100%{transform:rotate(0)}95%{transform:rotate(-9deg)}}\n' +
      '#mx-pet .mx-ear-l{transform-origin:88px 55px;animation:mx-ear 5s infinite;}\n' +
      '#mx-pet .mx-ear-r{transform-origin:152px 55px;animation:mx-ear 5s infinite .4s;}\n' +
      '@keyframes mx-halo-spin{to{transform:rotate(360deg)}}\n' +
      '#mx-pet .mx-halo{animation:mx-halo-spin 18s linear infinite;}\n' +

      // ===== ท่าพื้นฐาน =====
      '#mx-pet.jump svg{animation:mx-jump .55s cubic-bezier(.34,1.56,.64,1) 2!important;}\n' +
      '@keyframes mx-jump{0%,100%{transform:translateY(0) scale(1)}40%{transform:translateY(-38px) scale(1.08)}}\n' +

      '#mx-pet.yawn svg{animation:mx-yawn 1.8s ease-in-out!important;}\n' +
      '@keyframes mx-yawn{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(8px) rotate(-4deg)}}\n' +

      '#mx-pet.shake svg{animation:mx-shake .5s ease-in-out 3!important;}\n' +
      '@keyframes mx-shake{0%,100%{transform:rotate(0)}25%{transform:rotate(-12deg)}75%{transform:rotate(12deg)}}\n' +

      '#mx-pet.tap svg{animation:mx-tap .4s cubic-bezier(.34,1.56,.64,1)!important;}\n' +
      '@keyframes mx-tap{0%{transform:scale(1) rotate(0)}40%{transform:scale(1.25) rotate(12deg)}100%{transform:scale(1) rotate(0)}}\n' +

      '#mx-pet.cheer svg{animation:mx-cheer .5s ease-in-out 4!important;}\n' +
      '@keyframes mx-cheer{0%,100%{transform:translateY(0) rotate(0)}25%{transform:translateY(-22px) rotate(-8deg)}75%{transform:translateY(-22px) rotate(8deg)}}\n' +

      '#mx-pet.dance svg{animation:mx-dance .6s ease-in-out 6!important;}\n' +
      '@keyframes mx-dance{0%{transform:rotate(0) scale(1)}25%{transform:rotate(-18deg) scale(1.1)}' +
      '50%{transform:rotate(0) scale(.95)}75%{transform:rotate(18deg) scale(1.1)}100%{transform:rotate(0) scale(1)}}\n' +

      '#mx-pet.laugh svg{animation:mx-laugh .22s ease-in-out 8!important;}\n' +
      '@keyframes mx-laugh{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-6px) rotate(4deg)}}\n' +

      '#mx-pet.wave .mx-arm-r{animation:mx-wave .5s ease-in-out 4!important;transform-origin:180px 180px;}\n' +
      '@keyframes mx-wave{0%,100%{transform:rotate(0)}50%{transform:rotate(-55deg)}}\n' +

      '#mx-pet.think svg{animation:mx-think 1.6s ease-in-out infinite!important;}\n' +
      '@keyframes mx-think{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}\n' +
      '#mx-pet.think .mx-arm-r{transform:rotate(-70deg)!important;transform-origin:180px 180px;}\n' +

      '#mx-pet.angry svg{animation:mx-angry .18s linear 8!important;}\n' +
      '@keyframes mx-angry{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px) rotate(-3deg)}75%{transform:translateX(4px) rotate(3deg)}}\n' +
      '#mx-pet.angry .mx-cheek{fill:#FF3B3B!important;opacity:1!important;}\n' +

      '#mx-pet.love svg{animation:mx-love 1s ease-in-out 3!important;}\n' +
      '@keyframes mx-love{0%,100%{transform:scale(1)}50%{transform:scale(1.08) translateY(-4px)}}\n' +
      '#mx-pet.love .mx-eye-l,#mx-pet.love .mx-eye-r{fill:#FF69B4!important;}\n' +

      '#mx-pet.peek .mx-arm-l{transform:rotate(45deg)!important;transform-origin:60px 180px;}\n' +
      '#mx-pet.peek .mx-arm-r{transform:rotate(-45deg)!important;transform-origin:180px 180px;}\n' +
      '#mx-pet.peek svg{animation:mx-peek 1.4s ease-in-out!important;}\n' +
      '@keyframes mx-peek{0%,100%{transform:scale(1)}50%{transform:scale(.92) translateY(6px)}}\n' +

      '#mx-pet.run .mx-leg-l{animation:mx-leg-l .16s ease-in-out infinite;}\n' +
      '#mx-pet.run .mx-leg-r{animation:mx-leg-r .16s ease-in-out infinite;}\n' +
      '#mx-pet.run svg{animation:mx-bounce .16s ease-in-out infinite;}\n' +

      '#mx-pet.flip svg{animation:mx-flip .9s cubic-bezier(.5,0,.5,1)!important;}\n' +
      '@keyframes mx-flip{0%{transform:rotate(0) translateY(0)}50%{transform:rotate(360deg) translateY(-30px)}100%{transform:rotate(720deg) translateY(0)}}\n' +

      '#mx-pet.excited svg{animation:mx-excited .12s linear 15!important;}\n' +
      '@keyframes mx-excited{0%,100%{transform:translate(0,0)}25%{transform:translate(-3px,-3px)}75%{transform:translate(3px,3px)}}\n' +
      '#mx-pet.excited .mx-eye-l,#mx-pet.excited .mx-eye-r{fill:#FFD93D!important;}\n' +

      // ===== นอนหลับ =====
      '#mx-pet.sleep svg{animation:mx-sleep 3.5s ease-in-out infinite!important;' +
      'transform-origin:120px 260px;}\n' +
      '@keyframes mx-sleep{0%,100%{transform:rotate(-12deg) scale(.96)}50%{transform:rotate(-12deg) scale(1)}}\n' +
      '#mx-pet.sleep .mx-eye-l,#mx-pet.sleep .mx-eye-r{animation:none!important;transform:scaleY(.1)!important;}\n' +
      '#mx-pet.sleep .mx-mouth{d:path("M114 100 Q120 96 126 100");}\n' +

      '#mx-pet.doze svg{animation:mx-doze 4s ease-in-out infinite!important;transform-origin:120px 260px;}\n' +
      '@keyframes mx-doze{0%,100%{transform:rotate(-14deg) scale(.94) translateY(4px)}50%{transform:rotate(-14deg) scale(.98) translateY(4px)}}\n' +
      '#mx-pet.doze .mx-eye-l,#mx-pet.doze .mx-eye-r{animation:none!important;transform:scaleY(.08)!important;}\n' +

      '#mx-pet.stretch svg{animation:mx-stretch 1.8s ease-in-out!important;transform-origin:120px 260px;}\n' +
      '@keyframes mx-stretch{0%{transform:rotate(-10deg) scale(1)}40%{transform:rotate(-4deg) scale(1.06) translateY(-6px)}' +
      '70%{transform:rotate(-2deg) scale(1.02)}100%{transform:rotate(0) scale(1)}}\n' +

      '#mx-pet.sigh svg{animation:mx-sigh 2s ease-in-out!important;}\n' +
      '@keyframes mx-sigh{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(4px) rotate(-2deg)}}\n' +
      '#mx-pet.sigh .mx-arm-l{transform:rotate(35deg)!important;transform-origin:60px 180px;}\n' +
      '#mx-pet.sigh .mx-arm-r{transform:rotate(-35deg)!important;transform-origin:180px 180px;}\n' +

      // ===== App Event ท่า =====
      '#mx-pet.scan svg{animation:mx-scan 1s ease-in-out infinite!important;}\n' +
      '@keyframes mx-scan{0%,100%{transform:scale(1)}50%{transform:scale(1.06) rotate(2deg)}}\n' +
      '#mx-pet.scan .mx-halo{animation:mx-halo-spin 1.2s linear infinite!important;}\n' +
      '#mx-pet.scan .mx-eye-l,#mx-pet.scan .mx-eye-r{fill:#3EE0FF!important;}\n' +

      '#mx-pet.read svg{animation:mx-read 2s ease-in-out infinite!important;}\n' +
      '@keyframes mx-read{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg)}}\n' +
      '#mx-pet.read .mx-arm-l{transform:rotate(-30deg)!important;transform-origin:60px 180px;}\n' +
      '#mx-pet.read .mx-arm-r{transform:rotate(-60deg)!important;transform-origin:180px 180px;}\n' +

      '#mx-pet.cry svg{animation:mx-cry .5s ease-in-out 4!important;}\n' +
      '@keyframes mx-cry{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(4px) rotate(3deg)}}\n' +
      '#mx-pet.cry .mx-mouth{d:path("M114 102 Q120 94 126 102");}\n' +

      '#mx-pet.relax svg{animation:mx-relax 2.5s ease-in-out!important;}\n' +
      '@keyframes mx-relax{0%{transform:translateY(-4px) scale(1.03)}100%{transform:translateY(0) scale(1)}}\n' +

      // ===== พิเศษ =====
      '#mx-pet.party svg{animation:mx-party .3s ease-in-out 12!important;}\n' +
      '@keyframes mx-party{0%{transform:translate(0,0) rotate(0) scale(1)}' +
      '25%{transform:translate(-6px,-10px) rotate(-15deg) scale(1.1)}' +
      '50%{transform:translate(0,0) rotate(0) scale(1)}' +
      '75%{transform:translate(6px,-10px) rotate(15deg) scale(1.1)}100%{transform:translate(0,0)}}\n' +
      '#mx-pet.party .mx-eye-l,#mx-pet.party .mx-eye-r{fill:#FFD93D!important;}\n' +

      '#mx-pet.star svg{animation:mx-star 1.2s ease-in-out 6!important;}\n' +
      '@keyframes mx-star{0%,100%{transform:scale(1)}50%{transform:scale(1.15) rotate(8deg)}}\n' +
      '#mx-pet.star .mx-eye-l,#mx-pet.star .mx-eye-r{fill:#FFD93D!important;}\n' +
      '#mx-pet.star .mx-cheek{fill:#FF69B4!important;opacity:1!important;}\n' +

      '#mx-pet.eat svg{animation:mx-eat .4s ease-in-out 5!important;}\n' +
      '@keyframes mx-eat{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}\n' +
      '#mx-pet.eat .mx-mouth{d:path("M112 98 Q120 108 128 98");}\n' +

      '#mx-pet.bow svg{animation:mx-bow 1.6s ease-in-out!important;transform-origin:120px 280px;}\n' +
      '@keyframes mx-bow{0%{transform:rotate(0)}50%{transform:rotate(28deg) translateY(8px)}100%{transform:rotate(0)}}\n' +

      // FX
      '.mx-heart{position:fixed;font-size:22px;pointer-events:none;z-index:1000000;' +
      'animation:mx-heart-up 1.1s ease-out forwards;}\n' +
      '@keyframes mx-heart-up{0%{opacity:1;transform:translate(0,0) scale(.6)}' +
      '100%{opacity:0;transform:translate(var(--hx,0),-80px) scale(1.3)}}\n' +
      '.mx-tear{position:fixed;font-size:18px;pointer-events:none;z-index:1000000;' +
      'animation:mx-tear-drop 1.4s ease-in forwards;}\n' +
      '@keyframes mx-tear-drop{0%{opacity:1;transform:translateY(0)}' +
      '100%{opacity:0;transform:translateY(50px) scale(.7)}}\n' +
      '.mx-zzz{position:fixed;font-size:20px;font-weight:900;color:#A855F7;' +
      'pointer-events:none;z-index:1000000;animation:mx-zzz-anim 2s ease-out infinite;}\n' +
      '@keyframes mx-zzz-anim{0%{opacity:0;transform:translate(0,0) scale(.5)}' +
      '20%{opacity:1}100%{opacity:0;transform:translate(20px,-50px) scale(1.3)}}\n' +
      '.mx-spark{position:fixed;font-size:20px;pointer-events:none;z-index:1000000;' +
      'animation:mx-spark-fly 1.2s ease-out forwards;}\n' +
      '@keyframes mx-spark-fly{0%{opacity:1;transform:translate(0,0) scale(.5) rotate(0)}' +
      '100%{opacity:0;transform:translate(var(--sx,0),var(--sy,-80px)) scale(1.3) rotate(180deg)}}\n' +
      '@keyframes mx-spark-in{0%{opacity:0;transform:translateY(0) scale(.6)}30%{opacity:1}' +
      '100%{opacity:0;transform:translateY(-30px) scale(1.1)}}\n' +
      '#mx-pet .mx-spark-1{animation:mx-spark-in 3s ease-out infinite;}\n' +
      '#mx-pet .mx-spark-2{animation:mx-spark-in 3s ease-out infinite .7s;}\n' +
      '#mx-pet .mx-spark-3{animation:mx-spark-in 3s ease-out infinite 1.4s;}\n' +
      '#mx-pet .mx-spark-4{animation:mx-spark-in 3s ease-out infinite 2.1s;}\n' +
      '#mx-pet.face-left svg{transform:scaleX(-1);}\n'
  );

  // ================================================================
  // ============ SVG ============
  // ================================================================
  var mascot = document.createElement('div');
  mascot.id = 'mx-pet';
  mascot.classList.add('idle');
  mascot.classList.add(isTop ? 'at-top' : 'at-bottom');
  mascot.innerHTML =
      '<div id="mx-pet-bubble"></div>\n' +
      '<svg viewBox="0 0 240 300" xmlns="http://www.w3.org/2000/svg">\n' +
      '  <defs>\n' +
      '    <linearGradient id="mx-gx" x1="0%" y1="0%" x2="100%" y2="100%">\n' +
      '      <stop offset="0%" stop-color="#3EE0FF"/>\n' +
      '      <stop offset="50%" stop-color="#6366F1"/>\n' +
      '      <stop offset="100%" stop-color="#A855F7"/>\n' +
      '    </linearGradient>\n' +
      '    <linearGradient id="mx-gxd" x1="0%" y1="0%" x2="0%" y2="100%">\n' +
      '      <stop offset="0%" stop-color="#6366F1"/>\n' +
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
      '    <circle cx="120" cy="33" r="2.5" fill="#3EE0FF"/>\n' +
      '    <circle cx="172" cy="85" r="2.5" fill="#A855F7"/>\n' +
      '    <circle cx="120" cy="137" r="2.5" fill="#6366F1"/>\n' +
      '    <circle cx="68" cy="85" r="2.5" fill="#3EE0FF"/>\n' +
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
      '      <line x1="5" y1="9" x2="21" y2="9" stroke="#A855F7" stroke-width="1.8"/>\n' +
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
      '  <ellipse class="mx-cheek" cx="94" cy="92" rx="9" ry="5.5" fill="#FF9EC7" opacity=".85"/>\n' +
      '  <ellipse class="mx-cheek" cx="146" cy="92" rx="9" ry="5.5" fill="#FF9EC7" opacity=".85"/>\n' +
      '  <ellipse class="mx-eye-l" cx="106" cy="80" rx="7" ry="9" fill="#1a1a2e"/>\n' +
      '  <ellipse cx="106" cy="77" rx="3" ry="3.5" fill="#fff"/>\n' +
      '  <circle cx="104" cy="82" r="1.5" fill="#fff"/>\n' +
      '  <ellipse class="mx-eye-r" cx="134" cy="80" rx="7" ry="9" fill="#1a1a2e"/>\n' +
      '  <ellipse cx="134" cy="77" rx="3" ry="3.5" fill="#fff"/>\n' +
      '  <circle cx="132" cy="82" r="1.5" fill="#fff"/>\n' +
      '  <path class="mx-mouth" d="M114 98 Q120 104 126 98" stroke="#1a1a2e" stroke-width="2.5" fill="none" stroke-linecap="round"/>\n' +
      '  <g font-family="sans-serif" font-weight="bold" font-size="13">\n' +
      '    <text class="mx-spark-1" x="196" y="120" fill="#FFD93D">あ</text>\n' +
      '    <text class="mx-spark-2" x="34" y="140" fill="#3EE0FF">A</text>\n' +
      '    <text class="mx-spark-3" x="196" y="230" fill="#A855F7">ก</text>\n' +
      '    <text class="mx-spark-4" x="30" y="230" fill="#FF9EC7">字</text>\n' +
      '  </g>\n' +
      '</svg>';

  document.body.appendChild(mascot);
  var bubble = mascot.querySelector('#mx-pet-bubble');
  var bubbleHideTimer = null;

  // ================================================================
  // ============ SAY (บอลลูนคำพูด) ============
  // ================================================================
  function say(text, showToast) {
    if (!text) return;
    if (bubble) {
      bubble.textContent = text;
      bubble.classList.add('show');
      if (bubbleHideTimer) clearTimeout(bubbleHideTimer);
      bubbleHideTimer = safeTimeout(function () {
        bubble.classList.remove('show');
        bubbleHideTimer = null;
      }, 2600);
    }
    if (showToast && typeof ctx.toast === 'function') {
      try { ctx.toast(text).catch(function () {}); } catch (e) {}
    }
  }

  function sayIfChance(text, force) {
    if (force || Math.random() < sayChance()) say(text);
  }

  // ================================================================
  // ============ STATE ============
  // ================================================================
  var margin = 16;
  var state = {
    size: currentSize,
    x: Math.max(margin, window.innerWidth - currentSize - 20),
    targetX: Math.max(margin, window.innerWidth - currentSize - 20),
    bottom: 24,
    top: 24,
    speed: 1.2,
    isWalking: false,
    isBusy: false,
    isAsleep: false,
    lastInteract: Date.now(),
    rafId: null,
    cheeredEnd: false,
    zzzInterval: null,
    tapCount: 0,
    tapTimer: null,
    lastTapTime: 0,
    idleTimer: null,
    dozeTimer: null
  };

  mascot.style.left = state.x + 'px';
  if (isTop) {
    mascot.style.top = state.top + 'px';
  } else {
    mascot.style.bottom = state.bottom + 'px';
  }

  function setPosition(pos) {
    isTop = (pos === 'top');
    mascot.classList.toggle('at-top', isTop);
    mascot.classList.toggle('at-bottom', !isTop);
    if (isTop) {
      mascot.style.top = state.top + 'px';
      mascot.style.bottom = '';
      state.bottom = 0;
    } else {
      mascot.style.bottom = state.bottom + 'px';
      mascot.style.top = '';
      state.top = 0;
    }
  }

  // ================================================================
  // ============ FX ============
  // ================================================================
  function spawnHearts(cx, cy, count) {
    var emojis = ['💜', '💙', '✨', '💖', '💕'];
    var n = count || 3;
    for (var i = 0; i < n; i++) {
      (function (ii) {
        var h = document.createElement('div');
        h.className = 'mx-heart';
        h.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        h.style.left = (cx - 10) + 'px';
        h.style.top = (cy - 10) + 'px';
        h.style.setProperty('--hx', (Math.random() * 80 - 40) + 'px');
        document.body.appendChild(h);
        safeTimeout(function () {
          if (h.parentNode) h.parentNode.removeChild(h);
        }, 1200);
      })(i);
    }
  }

  function spawnTears(cx, cy) {
    for (var i = 0; i < 4; i++) {
      (function (ii) {
        var t = document.createElement('div');
        t.className = 'mx-tear';
        t.textContent = '💧';
        t.style.left = (cx + (ii - 2) * 12) + 'px';
        t.style.top = (cy + 10) + 'px';
        document.body.appendChild(t);
        safeTimeout(function () {
          if (t.parentNode) t.parentNode.removeChild(t);
        }, 1600);
      })(i);
    }
  }

  function spawnSparks(cx, cy, count) {
    var emojis = ['✨', '⭐', '🌟', '💫'];
    var n = count || 8;
    for (var i = 0; i < n; i++) {
      (function () {
        var s = document.createElement('div');
        s.className = 'mx-spark';
        s.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        s.style.left = cx + 'px';
        s.style.top = cy + 'px';
        s.style.setProperty('--sx', (Math.random() * 200 - 100) + 'px');
        s.style.setProperty('--sy', (-Math.random() * 120 - 40) + 'px');
        document.body.appendChild(s);
        safeTimeout(function () {
          if (s.parentNode) s.parentNode.removeChild(s);
        }, 1400);
      })();
    }
  }

  function startZzz() {
    if (state.zzzInterval) return;
    state.zzzInterval = safeInterval(function () {
      var r = mascot.getBoundingClientRect();
      var z = document.createElement('div');
      z.className = 'mx-zzz';
      z.textContent = 'Z';
      z.style.left = (r.left + r.width - 20) + 'px';
      z.style.top = (r.top + 10) + 'px';
      z.style.fontSize = (14 + Math.random() * 10) + 'px';
      document.body.appendChild(z);
      safeTimeout(function () {
        if (z.parentNode) z.parentNode.removeChild(z);
      }, 2100);
    }, 900);
  }

  function stopZzz() {
    if (state.zzzInterval) {
      clearInterval(state.zzzInterval);
      state.zzzInterval = null;
    }
  }

  // ================================================================
  // ============ ACTION ============
  // ================================================================
  function doAction(name, duration) {
    if (state.isBusy || isDragging) return;
    state.isBusy = true;
    state.isWalking = false;
    state.isAsleep = false;
    mascot.classList.remove('walking', 'idle', 'sleep', 'doze', 'stretch');
    mascot.classList.add(name);
    stopZzz();

    safeTimeout(function () {
      mascot.classList.remove(name);
      if (!isDragging) mascot.classList.add('idle');
      state.isBusy = false;
    }, duration || 1500);
  }

  // ================================================================
  // ============ DRAG & DROP ============
  // ================================================================
  var isPointerDown = false;
  var isDragging = false;
  var startPointerX = 0;
  var startPointerY = 0;
  var startMascotLeft = 0;
  var startMascotTop = 0;
  var startMascotBottom = 0;
  var lastMoveX = 0;
  var lastMoveT = 0;
  var dragSpeed = 0;

  ctx.on(mascot, 'pointerdown', function (e) {
    if (e.button !== undefined && e.button !== 0) return;
    isPointerDown = true;
    isDragging = false;
    startPointerX = e.clientX;
    startPointerY = e.clientY;
    startMascotLeft = state.x;
    startMascotTop = state.top;
    startMascotBottom = state.bottom;
    lastMoveX = e.clientX;
    lastMoveT = Date.now();
    dragSpeed = 0;
    state.lastInteract = Date.now();
    resetIdleTimer();

    if (mascot.setPointerCapture) {
      try { mascot.setPointerCapture(e.pointerId); } catch (err) {}
    }
  });

  ctx.on(mascot, 'pointermove', function (e) {
    if (!isPointerDown) return;
    var dx = e.clientX - startPointerX;
    var dy = e.clientY - startPointerY;
    var now = Date.now();
    var dt = (now - lastMoveT) || 1;
    dragSpeed = Math.abs(e.clientX - lastMoveX) / dt;
    lastMoveX = e.clientX;
    lastMoveT = now;

    if (!isDragging && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      isDragging = true;
      state.isWalking = false;
      state.isAsleep = false;
      stopZzz();
      mascot.classList.add('dragging');
      mascot.classList.remove('walking', 'idle', 'sleep', 'doze');
      say('ว้ากก ลอยแล้วว! 🛸');
    }

    if (isDragging) {
      state.lastInteract = Date.now();
      var curW = state.size;
      var curH = state.size * 1.25;
      var maxX = Math.max(margin, window.innerWidth - curW - margin);

      var newX = Math.max(margin, Math.min(maxX, startMascotLeft + dx));
      state.x = newX;
      state.targetX = newX;
      mascot.style.left = newX + 'px';

      if (isTop) {
        var maxTop = Math.max(margin, window.innerHeight - curH - margin);
        var newTop = Math.max(margin, Math.min(maxTop, startMascotTop + dy));
        state.top = newTop;
        mascot.style.top = newTop + 'px';
      } else {
        var maxBottom = Math.max(margin, window.innerHeight - curH - margin);
        var newBottom = Math.max(margin, Math.min(maxBottom, startMascotBottom - dy));
        state.bottom = newBottom;
        mascot.style.bottom = newBottom + 'px';
      }

      if (dragSpeed < 0.4 && !mascot.classList.contains('love')) {
        mascot.classList.remove('angry');
        mascot.classList.add('love');
      } else if (dragSpeed > 1.5 && !mascot.classList.contains('angry')) {
        mascot.classList.remove('love');
        mascot.classList.add('angry');
      }
    }
  });

  function onPointerEnd(e) {
    if (!isPointerDown) return;
    isPointerDown = false;

    if (mascot.releasePointerCapture) {
      try { mascot.releasePointerCapture(e.pointerId); } catch (err) {}
    }

    if (isDragging) {
      var wasFast = dragSpeed > 1.8;
      isDragging = false;
      mascot.classList.remove('dragging', 'love', 'angry');
      mascot.classList.add('idle');
      state.lastInteract = Date.now();
      resetIdleTimer();

      if (wasFast) {
        doAction('flip', 1000);
        spawnSparks(e.clientX, e.clientY, 6);
      } else {
        spawnHearts(e.clientX, e.clientY, 2);
      }
    } else {
      var now = Date.now();
      if (now - state.lastTapTime > 450) state.tapCount = 0;
      state.tapCount++;
      state.lastTapTime = now;
      clearTimeout(state.tapTimer);
      state.tapTimer = safeTimeout(function () {
        var count = state.tapCount;
        state.tapCount = 0;
        var r = mascot.getBoundingClientRect();
        if (count >= 3) {
          doAction('laugh', 1800);
          say('ฮ่าๆๆ~ 😂');
          spawnHearts(r.left + r.width / 2, r.top, 5);
        } else if (count === 2) {
          doAction('dance', 1800);
          say('เต้นๆ~ 🕺');
        } else {
          doAction('tap', 450);
          spawnHearts(e.clientX, e.clientY, 3);
          var tapPhrases = [
            'งื้ออ~ 💜', 'อย่าจิ้มเก๊าา 🐱', 'อ่านสนุกไหม? 📖',
            'อยู่เป็นเพื่อนนะ! ✨', 'ลุยตอนต่อไปกัน! 🚀', 'ฮิฮิ จั๊กจี้จัง~ 😆'
          ];
          say(tapPhrases[Math.floor(Math.random() * tapPhrases.length)]);
        }
      }, 420);
    }
  }

  ctx.on(mascot, 'pointerup', onPointerEnd);
  ctx.on(mascot, 'pointercancel', onPointerEnd);

  // ================================================================
  // ============ ANIMATION LOOP ============
  // ================================================================
  function tick() {
    if (!isDragging && !state.isBusy && !state.isAsleep) {
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

  // ================================================================
  // ============ AI ============
  // ================================================================
  function pickNewTarget() {
    if (state.isBusy || isDragging || state.isAsleep) return;
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

  var idlePhrases = [
    'ง่วงจังง~ 🥱', 'พักสายตาบ้างน้า ☕️',
    'อ่านถึงไหนแล้วนะ? 🤔', 'คอยเชียร์อยู่นะ! ✌️'
  ];

  function randomAction() {
    if (state.isBusy || isDragging || state.isAsleep) return;
    var actions = ['jump', 'yawn', 'shake', 'walk', 'walk'];
    var pick = actions[Math.floor(Math.random() * actions.length)];
    if (pick === 'walk') {
      pickNewTarget();
      if (chattiness === 'chatty' && Math.random() < 0.3) {
        say(idlePhrases[Math.floor(Math.random() * idlePhrases.length)]);
      }
    } else {
      doAction(pick, pick === 'yawn' ? 1800 : (pick === 'shake' ? 1500 : 1100));
      if (pick === 'yawn') say('ง่วงจังง~ 🥱');
    }
  }

  var aiInterval = setInterval(function () {
    if (Date.now() - state.lastInteract > 4000) {
      randomAction();
    }
  }, 3600);
  cleanups.push(function () { clearInterval(aiInterval); });

  // ================================================================
  // ============ IDLE TIMER: ง่วง → นอน ============
  // ================================================================
  function resetIdleTimer() {
    if (state.idleTimer) clearTimeout(state.idleTimer);
    if (state.dozeTimer) clearTimeout(state.dozeTimer);

    if (state.isAsleep) {
      state.isAsleep = false;
      state.isBusy = false;
      mascot.classList.remove('sleep', 'doze');
      doAction('stretch', 1800);
      sayIfChance('หืมม~ หลับไปเลย 😴', true);
      stopZzz();
    }

    // 25 วิ → ง่วง (หาว)
    state.idleTimer = safeTimeout(function () {
      if (state.isBusy || isDragging || state.isAsleep) return;
      doAction('yawn', 1800);
      sayIfChance('ง่วงจังง~ 🥱');
    }, 25000);

    // 50 วิ → นอนจริง
    state.dozeTimer = safeTimeout(function () {
      if (state.isBusy || isDragging || state.isAsleep) return;
      state.isAsleep = true;
      state.isBusy = true;
      state.isWalking = false;
      mascot.classList.remove('walking', 'idle', 'yawn');
      mascot.classList.add('sleep');
      startZzz();
      sayIfChance('นอนแป๊บนะ 😴💤');
    }, 50000);
  }

  resetIdleTimer();

  // ================================================================
  // ============ SCROLL REACTIONS ============
  // ================================================================
  if (reactToReading) {
    var lastY = window.scrollY || window.pageYOffset || 0;
    var lastT = Date.now();

    ctx.on(window, 'scroll', function () {
      state.lastInteract = Date.now();
      resetIdleTimer();

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

      var docH = document.documentElement.scrollHeight || document.body.scrollHeight || 0;
      var winH = window.innerHeight;
      if (docH > winH * 1.4 && (curY + winH >= docH - 80)) {
        if (!state.cheeredEnd) {
          state.cheeredEnd = true;
          doAction('cheer', 2400);
          say('อ่านจบแล้ว! เก่งมากก 🎉', true);
          safeTimeout(function () { state.cheeredEnd = false; }, 8000);
        }
      }
    }, { passive: true });

    if (typeof IntersectionObserver !== 'undefined') {
      var io = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting) {
            state.lastInteract = Date.now();
            doAction('cheer', 2400);
            say('อ่านจบแล้ว! เก่งมากก 🎉', true);
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

  // ================================================================
  // ============ APP EVENTS: การแปล ============
  // ================================================================
  var translationState = {
    active: null,
    lastEventAt: 0,
    failedCount: 0
  };

  var phrases = {
    scanStart: ['กำลังสแกนอยู่นะ 🔍', 'แป๊บนึงน้าา~ 👀', 'ขอดูก่อนน้า 📖'],
    readStart: ['ตั้งใจอ่านอยู่นะ 📚', 'หืมม~ น่าสนใจจัง 🤔', 'อ่านอยู่ๆ อย่ารบกวนน้า~'],
    done: ['แปลเสร็จแล้วว! 🎉', 'ได้อ่านแล้วน้า~ ✨', 'เย้! เก่งมากเลยย 💜'],
    failed: ['แงง แปลไม่ได้ 😢', 'มีอะไรผิดพลาดน้าา 💧', 'ลองอีกทีได้ไหม~ 🥺'],
    stopUser: ['หยุดก่อนก็ได้น้าา~ 😌', 'โอเค พักก่อนน้า ☕', 'ไม่เป็นไรน้า~ 💜'],
    stopAuto: ['เปลี่ยนหน้าแล้วน้า~ 👋', 'ไปตอนต่อไปกันเลย! 📖'],
    chapterNew: ['ตอนใหม่มาแล้วว! 🎊', 'ลุยยย! 🚀', 'ตื่นเต้นจังง~ ✨']
  };

  function pickPhrase(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ----- translate:start -----
  ctx.onEvent('translate:start', function (data) {
    var mode = (data && data.mode) || 'realtime';
    var type = (data && data.type) || 'manga';

    translationState.active = mode;
    translationState.lastEventAt = Date.now();
    state.lastInteract = Date.now();
    resetIdleTimer();

    if (mode === 'full') {
      doAction('read', 3000);
      if (type === 'manga') {
        sayIfChance(pickPhrase(phrases.readStart));
      } else {
        sayIfChance('อ่านนิยายอยู่นะ 📖');
      }
    } else {
      doAction('scan', 2200);
      sayIfChance(pickPhrase(phrases.scanStart));
    }

    // ไถหางตาดู ไม่ให้ดูค้าง
    safeTimeout(function () {
      if (translationState.active) {
        var r = mascot.getBoundingClientRect();
        spawnSparks(r.left + r.width / 2, r.top + r.height / 2, 3);
      }
    }, 4000);
  });

  // ----- translate:done -----
  ctx.onEvent('translate:done', function (data) {
    translationState.active = null;
    translationState.failedCount = 0;
    state.lastInteract = Date.now();
    resetIdleTimer();

    doAction('cheer', 2400);

    var r = mascot.getBoundingClientRect();
    spawnSparks(r.left + r.width / 2, r.top + r.height / 2, 10);
    spawnHearts(r.left + r.width / 2, r.top, 5);

    if (data && data.mode === 'full') {
      sayIfChance('ทั้งตอนเสร็จแล้วว! 🎉 อ่านเลยย', true);
      if (typeof ctx.toast === 'function') {
        try { ctx.toast('แปลครบตอนแล้ว! ✨').catch(function () {}); } catch (e) {}
      }
    } else {
      sayIfChance(pickPhrase(phrases.done));
    }
  });

  // ----- translate:failed -----
  ctx.onEvent('translate:failed', function (data) {
    translationState.active = null;
    translationState.failedCount++;
    state.lastInteract = Date.now();
    resetIdleTimer();

    var r = mascot.getBoundingClientRect();

    if (translationState.failedCount === 1) {
      doAction('cry', 2400);
      spawnTears(r.left + r.width / 2, r.top + r.height / 2);
      sayIfChance(pickPhrase(phrases.failed), true);
    } else if (translationState.failedCount === 2) {
      doAction('shake', 1800);
      sayIfChance('อีกแล้วว 😢 ลองอีกทีนะ', true);
    } else {
      doAction('sigh', 2400);
      spawnTears(r.left + r.width / 2, r.top + r.height / 2);
      sayIfChance('พักก่อนก็ได้น้าา 😢💧', true);
    }

    safeTimeout(function () { translationState.failedCount = 0; }, 30000);
  });

  // ----- translate:stop -----
  ctx.onEvent('translate:stop', function (data) {
    translationState.active = null;
    var reason = (data && data.reason) || 'auto';
    state.lastInteract = Date.now();
    resetIdleTimer();

    if (reason === 'user') {
      doAction('sigh', 2000);
      sayIfChance(pickPhrase(phrases.stopUser), true);
    } else {
      doAction('wave', 1800);
      sayIfChance(pickPhrase(phrases.stopAuto));
    }
  });

  // ================================================================
  // ============ URL CHANGE: ขึ้นตอนใหม่ ============
  // ================================================================
  if (typeof ctx.onUrlChange === 'function') {
    ctx.onUrlChange(function () {
      state.lastInteract = Date.now();
      doAction('bow', 1600);
      sayIfChance(pickPhrase(phrases.chapterNew));
      safeTimeout(function () { pickNewTarget(); }, 800);
    });
  }

  // ================================================================
  // ============ OPTION CHANGES ============
  // ================================================================
  ctx.onOptions(function (opts) {
    if (!opts) return;
    if (typeof opts.size === 'number') {
      state.size = opts.size;
      mascot.style.setProperty('--mx-pet-size', opts.size + 'px');
    }
    if (typeof opts.interactive === 'boolean') {
      reactToReading = opts.interactive;
    }
    if (opts.chattiness) {
      chattiness = opts.chattiness;
    }
    if (opts.position) {
      defaultPosition = opts.position;
      setPosition(defaultPosition);
    }
  });

  // ================================================================
  // ============ RESIZE ============
  // ================================================================
  ctx.on(window, 'resize', function () {
    var curW = state.size;
    var curH = state.size * 1.25;
    var maxX = Math.max(margin, window.innerWidth - curW - margin);
    var maxY = Math.max(margin, window.innerHeight - curH - margin);
    if (state.x > maxX) {
      state.x = maxX;
      state.targetX = maxX;
      mascot.style.left = maxX + 'px';
    }
    if (isTop && state.top > maxY) {
      state.top = maxY;
      mascot.style.top = maxY + 'px';
    }
    if (!isTop && state.bottom > maxY) {
      state.bottom = maxY;
      mascot.style.bottom = maxY + 'px';
    }
  }, { passive: true });

  // ================================================================
  // ============ CLEANUP ============
  // ================================================================
  return function () {
    if (state.rafId) cancelAnimationFrame(state.rafId);
    if (state.tapTimer) clearTimeout(state.tapTimer);
    if (state.idleTimer) clearTimeout(state.idleTimer);
    if (state.dozeTimer) clearTimeout(state.dozeTimer);
    if (bubbleHideTimer) clearTimeout(bubbleHideTimer);
    stopZzz();

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

    var fx = document.querySelectorAll('.mx-heart, .mx-tear, .mx-zzz, .mx-spark');
    for (var k = 0; k < fx.length; k++) {
      if (fx[k].parentNode) fx[k].parentNode.removeChild(fx[k]);
    }
  };
});