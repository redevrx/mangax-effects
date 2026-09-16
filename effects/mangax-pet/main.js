mangax.effect(function (ctx) {
  // ================================================================
  // ============ HELPERS ============
  // ================================================================
  var activeTimers = [];
  var activeIntervals = [];

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
    activeIntervals.push(id);
    return id;
  }
  function clearSafeInterval(id) {
    var i = activeIntervals.indexOf(id);
    if (i >= 0) activeIntervals.splice(i, 1);
    clearInterval(id);
  }

  // ================================================================
  // ============ OPTIONS ============
  // ================================================================
  var options = ctx.options || {};
  var currentSize = typeof options.size === 'number' ? options.size : 80;
  var reactToReading = options.interactive !== false;
  var chattiness = options.chattiness || 'normal';
  var defaultPosition = options.position || 'top';
  var energy = options.energy || 'normal';
  var replaceMenu = options.replaceMenu === true;
  var isTop = defaultPosition === 'top';

  var BOTTOM_CLEAR = 130;

  function sayChance() {
    if (chattiness === 'quiet') return 0.15;
    if (chattiness === 'chatty') return 0.8;
    return 0.45;
  }
  function actionInterval() {
    if (energy === 'hyper') return 1800;
    if (energy === 'lazy') return 6000;
    return 3600;
  }
  function walkSpeed() {
    if (energy === 'hyper') return 1.8;
    if (energy === 'lazy') return 0.6;
    return 1.2;
  }

  // ================================================================
  // ============ CSS ============
  // ================================================================
  ctx.addStyle(
      // ----- container -----
      '#mx-pet{position:fixed;' +
      'width:var(--mx-pet-size,' + currentSize + 'px);' +
      'height:calc(var(--mx-pet-size,' + currentSize + 'px)*1.25);' +
      'z-index:999999;pointer-events:auto;cursor:grab;touch-action:none;' +
      'user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;' +
      'will-change:transform,left,top,bottom;' +
      'filter:drop-shadow(0 6px 12px rgba(99,102,241,.4));}\n' +
      '#mx-pet.at-top{top:24px;bottom:auto;}\n' +
      '#mx-pet.at-bottom{bottom:' + BOTTOM_CLEAR + 'px;top:auto;}\n' +
      '#mx-pet:active{cursor:grabbing;}\n' +
      '#mx-pet.dragging{cursor:grabbing;transform:scale(1.12) rotate(6deg)!important;' +
      'filter:drop-shadow(0 14px 20px rgba(99,102,241,.55))!important;' +
      'transition:transform .12s ease-out!important;}\n' +
      '#mx-pet svg{width:100%;height:100%;display:block;overflow:visible;}\n' +

      // ----- บอลลูน -----
      '#mx-pet-bubble{position:absolute;left:50%;transform:translateX(calc(-50% + var(--mx-bubble-dx,0px))) scale(0);' +
      'transform-origin:bottom center;background:rgba(26,26,46,.95);color:#fff;' +
      'border:2px solid #818cf8;border-radius:12px;padding:5px 10px;font-size:12px;' +
      'font-weight:600;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
      'white-space:nowrap;pointer-events:none;opacity:0;' +
      'transition:transform .22s cubic-bezier(.34,1.56,.64,1),opacity .18s ease;' +
      'box-shadow:0 4px 14px rgba(0,0,0,.35);z-index:10;}\n' +
      '#mx-pet.at-bottom #mx-pet-bubble{bottom:104%;top:auto;transform-origin:bottom center;}\n' +
      '#mx-pet.at-top #mx-pet-bubble{top:104%;bottom:auto;transform-origin:top center;}\n' +
      '#mx-pet-bubble.show{transform:translateX(calc(-50% + var(--mx-bubble-dx,0px))) scale(1);opacity:1;}\n' +

      // ----- เดิน / ขยับพื้นฐาน -----
      '@keyframes mx-leg-l{0%,100%{transform:rotate(-22deg)}50%{transform:rotate(22deg)}}\n' +
      '@keyframes mx-leg-r{0%,100%{transform:rotate(22deg)}50%{transform:rotate(-22deg)}}\n' +
      '@keyframes mx-arm-l{0%,100%{transform:rotate(-14deg)}50%{transform:rotate(14deg)}}\n' +
      '@keyframes mx-arm-r{0%,100%{transform:rotate(14deg)}50%{transform:rotate(-14deg)}}\n' +
      '@keyframes mx-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}\n' +
      '@keyframes mx-breathe{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-3px) scale(1.02)}}\n' +
      '#mx-pet.walking .mx-leg-l{animation:mx-leg-l .32s ease-in-out infinite;}\n' +
      '#mx-pet.walking .mx-leg-r{animation:mx-leg-r .32s ease-in-out infinite;}\n' +
      '#mx-pet.walking .mx-arm-l{animation:mx-arm-l .32s ease-in-out infinite;}\n' +
      '#mx-pet.walking .mx-arm-r{animation:mx-arm-r .32s ease-in-out infinite;}\n' +
      '#mx-pet.walking svg{animation:mx-bounce .32s ease-in-out infinite;}\n' +
      '#mx-pet.idle svg{animation:mx-breathe 2.6s ease-in-out infinite;}\n' +

      // ----- ตา / หู / halo -----
      '@keyframes mx-blink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.08)}}\n' +
      '#mx-pet .mx-eye-l,#mx-pet .mx-eye-r{transform-origin:center;animation:mx-blink 4.2s infinite;}\n' +
      '@keyframes mx-ear{0%,90%,100%{transform:rotate(0)}95%{transform:rotate(-9deg)}}\n' +
      '#mx-pet .mx-ear-l{transform-origin:88px 55px;animation:mx-ear 5s infinite;}\n' +
      '#mx-pet .mx-ear-r{transform-origin:152px 55px;animation:mx-ear 5s infinite .4s;}\n' +
      '@keyframes mx-halo-spin{to{transform:rotate(360deg)}}\n' +
      '#mx-pet .mx-halo{animation:mx-halo-spin 18s linear infinite;}\n' +

      // ============ LOCOMOTION ============
      '#mx-pet.jump svg{animation:mx-jump .55s cubic-bezier(.34,1.56,.64,1) 2!important;}\n' +
      '@keyframes mx-jump{0%,100%{transform:translateY(0) scale(1)}40%{transform:translateY(-38px) scale(1.08)}}\n' +

      '#mx-pet.hop .mx-leg-l{animation:mx-leg-l .22s ease-in-out infinite;}\n' +
      '#mx-pet.hop .mx-leg-r{animation:mx-leg-r .22s ease-in-out infinite;}\n' +
      '#mx-pet.hop svg{animation:mx-hop .4s ease-in-out infinite!important;}\n' +
      '@keyframes mx-hop{0%,100%{transform:translateY(0)}50%{transform:translateY(-16px)}}\n' +

      '#mx-pet.skip .mx-leg-l{animation:mx-leg-l .26s ease-in-out infinite;}\n' +
      '#mx-pet.skip .mx-leg-r{animation:mx-leg-r .26s ease-in-out infinite;}\n' +
      '#mx-pet.skip svg{animation:mx-skip .5s ease-in-out infinite!important;}\n' +
      '@keyframes mx-skip{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-10px) rotate(3deg)}}\n' +

      '#mx-pet.tiptoe .mx-leg-l{animation:mx-tiptoe .5s ease-in-out infinite;}\n' +
      '#mx-pet.tiptoe .mx-leg-r{animation:mx-tiptoe .5s ease-in-out infinite .25s;}\n' +
      '@keyframes mx-tiptoe{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(8deg)}}\n' +
      '#mx-pet.tiptoe svg{animation:mx-bounce .5s ease-in-out infinite;}\n' +

      '#mx-pet.sneak svg{animation:mx-sneak 1s ease-in-out infinite!important;transform-origin:120px 260px;}\n' +
      '@keyframes mx-sneak{0%,100%{transform:rotate(-6deg) scaleY(.96)}50%{transform:rotate(-4deg) scaleY(.94)}}\n' +
      '#mx-pet.sneak .mx-eye-l,#mx-pet.sneak .mx-eye-r{animation:none!important;transform:scaleY(.5)!important;}\n' +

      '#mx-pet.run .mx-leg-l{animation:mx-leg-l .16s ease-in-out infinite;}\n' +
      '#mx-pet.run .mx-leg-r{animation:mx-leg-r .16s ease-in-out infinite;}\n' +
      '#mx-pet.run svg{animation:mx-bounce .16s ease-in-out infinite;}\n' +

      // ============ REST ============
      '#mx-pet.yawn svg{animation:mx-yawn 1.8s ease-in-out!important;}\n' +
      '@keyframes mx-yawn{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(8px) rotate(-4deg)}}\n' +
      '#mx-pet.yawn .mx-mouth{d:path("M112 98 Q120 110 128 98 Q120 116 112 98");}\n' +

      '#mx-pet.sleep svg{animation:mx-sleep 3.5s ease-in-out infinite!important;transform-origin:120px 260px;}\n' +
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

      '#mx-pet.dream svg{animation:mx-dream 3s ease-in-out infinite!important;transform-origin:120px 260px;}\n' +
      '@keyframes mx-dream{0%,100%{transform:rotate(-10deg) scale(.97)}50%{transform:rotate(-8deg) scale(.99)}}\n' +
      '#mx-pet.dream .mx-eye-l,#mx-pet.dream .mx-eye-r{animation:none!important;transform:scaleY(.15)!important;fill:#FF69B4!important;}\n' +

      '#mx-pet.snore svg{animation:mx-snore 1.2s ease-in-out infinite!important;transform-origin:120px 260px;}\n' +
      '@keyframes mx-snore{0%,100%{transform:rotate(-12deg) scale(.96) translateY(0)}50%{transform:rotate(-12deg) scale(1.02) translateY(-2px)}}\n' +
      '#mx-pet.snore .mx-eye-l,#mx-pet.snore .mx-eye-r{animation:none!important;transform:scaleY(.08)!important;}\n' +

      // ============ EMOTION ============
      '#mx-pet.tap svg{animation:mx-tap .4s cubic-bezier(.34,1.56,.64,1)!important;}\n' +
      '@keyframes mx-tap{0%{transform:scale(1)}40%{transform:scale(1.25) rotate(12deg)}100%{transform:scale(1)}}\n' +

      '#mx-pet.laugh svg{animation:mx-laugh .22s ease-in-out 8!important;}\n' +
      '@keyframes mx-laugh{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-6px) rotate(4deg)}}\n' +

      '#mx-pet.dance svg{animation:mx-dance .6s ease-in-out 6!important;}\n' +
      '@keyframes mx-dance{0%{transform:rotate(0) scale(1)}25%{transform:rotate(-18deg) scale(1.1)}' +
      '50%{transform:rotate(0) scale(.95)}75%{transform:rotate(18deg) scale(1.1)}100%{transform:rotate(0) scale(1)}}\n' +

      '#mx-pet.shake svg{animation:mx-shake .5s ease-in-out 3!important;}\n' +
      '@keyframes mx-shake{0%,100%{transform:rotate(0)}25%{transform:rotate(-12deg)}75%{transform:rotate(12deg)}}\n' +

      '#mx-pet.think svg{animation:mx-think 1.6s ease-in-out infinite!important;}\n' +
      '@keyframes mx-think{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg)}}\n' +
      '#mx-pet.think .mx-arm-r{transform:rotate(-70deg)!important;transform-origin:180px 180px;}\n' +

      '#mx-pet.angry svg{animation:mx-angry .18s linear 8!important;}\n' +
      '@keyframes mx-angry{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px) rotate(-3deg)}75%{transform:translateX(4px) rotate(3deg)}}\n' +
      '#mx-pet.angry .mx-cheek{fill:#FF3B3B!important;opacity:1!important;}\n' +

      '#mx-pet.love svg{animation:mx-love 1s ease-in-out 3!important;}\n' +
      '@keyframes mx-love{0%,100%{transform:scale(1)}50%{transform:scale(1.08) translateY(-4px)}}\n' +
      '#mx-pet.love .mx-eye-l,#mx-pet.love .mx-eye-r{fill:#FF69B4!important;}\n' +

      '#mx-pet.cry svg{animation:mx-cry .5s ease-in-out 4!important;}\n' +
      '@keyframes mx-cry{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(4px) rotate(3deg)}}\n' +
      '#mx-pet.cry .mx-mouth{d:path("M114 102 Q120 94 126 102");}\n' +

      '#mx-pet.pout svg{animation:mx-pout 2s ease-in-out infinite!important;}\n' +
      '@keyframes mx-pout{0%,100%{transform:rotate(0)}50%{transform:rotate(-6deg)}}\n' +
      '#mx-pet.pout .mx-mouth{d:path("M116 102 Q120 98 124 102");}\n' +

      '#mx-pet.blush svg{animation:mx-blush 2.4s ease-in-out infinite!important;}\n' +
      '@keyframes mx-blush{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}\n' +
      '#mx-pet.blush .mx-cheek{fill:#FF69B4!important;opacity:1!important;}\n' +

      '#mx-pet.surprised svg{animation:mx-surprised .6s cubic-bezier(.34,1.56,.64,1)!important;}\n' +
      '@keyframes mx-surprised{0%{transform:scale(1)}40%{transform:scale(1.18)}100%{transform:scale(1)}}\n' +
      '#mx-pet.surprised .mx-mouth{d:path("M116 100 Q120 108 124 100 Q120 96 116 100");}\n' +

      '#mx-pet.bored svg{animation:mx-bored 3s ease-in-out infinite!important;}\n' +
      '@keyframes mx-bored{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(-6deg) translateY(2px)}}\n' +
      '#mx-pet.bored .mx-eye-l,#mx-pet.bored .mx-eye-r{transform:scaleY(.5)!important;animation:none!important;}\n' +

      // ============ CELEBRATE ============
      '#mx-pet.cheer svg{animation:mx-cheer .5s ease-in-out 4!important;}\n' +
      '@keyframes mx-cheer{0%,100%{transform:translateY(0) rotate(0)}25%{transform:translateY(-22px) rotate(-8deg)}75%{transform:translateY(-22px) rotate(8deg)}}\n' +

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

      '#mx-pet.excited svg{animation:mx-excited .12s linear 15!important;}\n' +
      '@keyframes mx-excited{0%,100%{transform:translate(0,0)}25%{transform:translate(-3px,-3px)}75%{transform:translate(3px,3px)}}\n' +
      '#mx-pet.excited .mx-eye-l,#mx-pet.excited .mx-eye-r{fill:#FFD93D!important;}\n' +

      '#mx-pet.clap .mx-arm-l{animation:mx-clap-l .3s ease-in-out infinite;transform-origin:60px 180px;}\n' +
      '#mx-pet.clap .mx-arm-r{animation:mx-clap-r .3s ease-in-out infinite;transform-origin:180px 180px;}\n' +
      '@keyframes mx-clap-l{0%,100%{transform:rotate(-10deg)}50%{transform:rotate(20deg)}}\n' +
      '@keyframes mx-clap-r{0%,100%{transform:rotate(10deg)}50%{transform:rotate(-20deg)}}\n' +

      '#mx-pet.spin svg{animation:mx-spin 1s cubic-bezier(.5,0,.5,1)!important;}\n' +
      '@keyframes mx-spin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}}\n' +

      '#mx-pet.moonwalk .mx-leg-l{animation:mx-moon-l .6s ease-in-out infinite;}\n' +
      '#mx-pet.moonwalk .mx-leg-r{animation:mx-moon-r .6s ease-in-out infinite .3s;}\n' +
      '@keyframes mx-moon-l{0%,100%{transform:rotate(-15deg) translateY(0)}50%{transform:rotate(15deg) translateY(-4px)}}\n' +
      '@keyframes mx-moon-r{0%,100%{transform:rotate(15deg) translateY(-4px)}50%{transform:rotate(-15deg) translateY(0)}}\n' +
      '#mx-pet.moonwalk svg{animation:mx-moon-body .6s ease-in-out infinite!important;}\n' +
      '@keyframes mx-moon-body{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}\n' +

      '#mx-pet.backflip svg{animation:mx-backflip 1.2s cubic-bezier(.5,0,.5,1)!important;}\n' +
      '@keyframes mx-backflip{0%{transform:rotate(0) translateY(0)}50%{transform:rotate(-360deg) translateY(-40px)}100%{transform:rotate(-720deg) translateY(0)}}\n' +

      // ============ READING / TRANSLATE ============
      '#mx-pet.scan svg{animation:mx-scan 1s ease-in-out infinite!important;}\n' +
      '@keyframes mx-scan{0%,100%{transform:scale(1)}50%{transform:scale(1.06) rotate(2deg)}}\n' +
      '#mx-pet.scan .mx-halo{animation:mx-halo-spin 1.2s linear infinite!important;}\n' +
      '#mx-pet.scan .mx-eye-l,#mx-pet.scan .mx-eye-r{fill:#3EE0FF!important;}\n' +

      '#mx-pet.read svg{animation:mx-read 2s ease-in-out infinite!important;}\n' +
      '@keyframes mx-read{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg)}}\n' +
      '#mx-pet.read .mx-arm-l{transform:rotate(-30deg)!important;transform-origin:60px 180px;}\n' +
      '#mx-pet.read .mx-arm-r{transform:rotate(-60deg)!important;transform-origin:180px 180px;}\n' +

      '#mx-pet.relax svg{animation:mx-relax 2.5s ease-in-out!important;}\n' +
      '@keyframes mx-relax{0%{transform:translateY(-4px) scale(1.03)}100%{transform:translateY(0) scale(1)}}\n' +

      '#mx-pet.translate-happy svg{animation:mx-th 1s ease-in-out 3!important;}\n' +
      '@keyframes mx-th{0%,100%{transform:rotate(0) scale(1)}50%{transform:rotate(-8deg) scale(1.1)}}\n' +
      '#mx-pet.translate-happy .mx-eye-l,#mx-pet.translate-happy .mx-eye-r{fill:#FFD93D!important;}\n' +

      '#mx-pet.translate-sad svg{animation:mx-ts 1s ease-in-out 3!important;}\n' +
      '@keyframes mx-ts{0%,100%{transform:translateY(0)}50%{transform:translateY(6px) rotate(-3deg)}}\n' +
      '#mx-pet.translate-sad .mx-mouth{d:path("M114 102 Q120 94 126 102");}\n' +

      '#mx-pet.scan-halo .mx-halo{animation:mx-halo-spin .8s linear infinite!important;}\n' +
      '#mx-pet.scan-halo svg{animation:mx-breathe 1.2s ease-in-out infinite;}\n' +

      '#mx-pet.page-flip .mx-arm-r{animation:mx-page .6s ease-in-out 3!important;transform-origin:180px 180px;}\n' +
      '@keyframes mx-page{0%,100%{transform:rotate(0)}50%{transform:rotate(-45deg)}}\n' +

      // ============ MISC ============
      '#mx-pet.wave .mx-arm-r{animation:mx-wave .5s ease-in-out 4!important;transform-origin:180px 180px;}\n' +
      '@keyframes mx-wave{0%,100%{transform:rotate(0)}50%{transform:rotate(-55deg)}}\n' +

      '#mx-pet.bow svg{animation:mx-bow 1.6s ease-in-out!important;transform-origin:120px 280px;}\n' +
      '@keyframes mx-bow{0%{transform:rotate(0)}50%{transform:rotate(28deg) translateY(8px)}100%{transform:rotate(0)}}\n' +

      '#mx-pet.peek .mx-arm-l{transform:rotate(45deg)!important;transform-origin:60px 180px;}\n' +
      '#mx-pet.peek .mx-arm-r{transform:rotate(-45deg)!important;transform-origin:180px 180px;}\n' +
      '#mx-pet.peek svg{animation:mx-peek 1.4s ease-in-out!important;}\n' +
      '@keyframes mx-peek{0%,100%{transform:scale(1)}50%{transform:scale(.92) translateY(6px)}}\n' +

      '#mx-pet.eat svg{animation:mx-eat .4s ease-in-out 5!important;}\n' +
      '@keyframes mx-eat{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}\n' +
      '#mx-pet.eat .mx-mouth{d:path("M112 98 Q120 108 128 98");}\n' +

      '#mx-pet.drink .mx-arm-r{animation:mx-drink .8s ease-in-out 3!important;transform-origin:180px 180px;}\n' +
      '@keyframes mx-drink{0%,100%{transform:rotate(0)}50%{transform:rotate(-80deg)}}\n' +

      '#mx-pet.sneeze svg{animation:mx-sneeze .8s cubic-bezier(.34,1.56,.64,1)!important;}\n' +
      '@keyframes mx-sneeze{0%,100%{transform:translate(0,0) rotate(0)}30%{transform:translate(-3px,-8px) rotate(-8deg)}' +
      '60%{transform:translate(6px,4px) rotate(12deg)}}\n' +

      '#mx-pet.hiccup svg{animation:mx-hiccup .3s ease-in-out 6!important;}\n' +
      '@keyframes mx-hiccup{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px) scale(1.03)}}\n' +

      '#mx-pet.wink .mx-eye-l{animation:mx-wink .8s ease-in-out 2!important;}\n' +
      '@keyframes mx-wink{0%,100%{transform:scaleY(1)}50%{transform:scaleY(.1)}}\n' +

      '#mx-pet.nosebleed svg{animation:mx-nose .4s ease-in-out 4!important;}\n' +
      '@keyframes mx-nose{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}\n' +
      '#mx-pet.nosebleed .mx-cheek{fill:#FF3B3B!important;opacity:1!important;}\n' +

      '#mx-pet.meditate svg{animation:mx-meditate 3s ease-in-out infinite!important;}\n' +
      '@keyframes mx-meditate{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-5px) scale(1.02)}}\n' +
      '#mx-pet.meditate .mx-halo{animation:mx-halo-spin 6s linear infinite!important;}\n' +

      // ============ ENGINE SWITCH ============
      '#mx-pet.engine-switch svg{animation:mx-engine-switch 1.1s cubic-bezier(.5,0,.5,1)!important;}\n' +
      '@keyframes mx-engine-switch{' +
      '  0%   {transform:rotate(0) scale(1);opacity:1;}\n' +
      '  40%  {transform:rotate(180deg) scale(.7);opacity:.5;}\n' +
      '  70%  {transform:rotate(300deg) scale(1.15);opacity:.9;}\n' +
      '  100% {transform:rotate(360deg) scale(1);opacity:1;}\n' +
      '}\n' +
      '#mx-pet.engine-switch .mx-halo{animation:mx-halo-spin .6s linear infinite!important;}\n' +

      // ============ FX ============
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

      '.mx-note{position:fixed;font-size:20px;pointer-events:none;z-index:1000000;' +
      'animation:mx-note-fly 1.6s ease-out forwards;}\n' +
      '@keyframes mx-note-fly{0%{opacity:1;transform:translate(0,0) rotate(0)}' +
      '100%{opacity:0;transform:translate(var(--nx,20px),-70px) rotate(180deg)}}\n' +

      '.mx-dream{position:fixed;font-size:22px;pointer-events:none;z-index:1000000;' +
      'animation:mx-dream-float 3s ease-out forwards;}\n' +
      '@keyframes mx-dream-float{0%{opacity:0;transform:scale(.5)}20%{opacity:1;transform:scale(1.1)}' +
      '100%{opacity:0;transform:translate(30px,-40px) scale(1.3)}}\n' +

      '.mx-ring{position:fixed;width:20px;height:20px;margin:-10px 0 0 -10px;' +
      'border:3px solid #818cf8;border-radius:50%;pointer-events:none;z-index:1000000;' +
      'animation:mx-ring-out 1.1s ease-out forwards;}\n' +
      '@keyframes mx-ring-out{0%{opacity:1;transform:scale(.3)}100%{opacity:0;transform:scale(5)}}\n' +

      '@keyframes mx-spark-in{0%{opacity:0;transform:translateY(0) scale(.6)}30%{opacity:1}' +
      '100%{opacity:0;transform:translateY(-30px) scale(1.1)}}\n' +
      '#mx-pet .mx-spark-1{animation:mx-spark-in 3s ease-out infinite;}\n' +
      '#mx-pet .mx-spark-2{animation:mx-spark-in 3s ease-out infinite .7s;}\n' +
      '#mx-pet .mx-spark-3{animation:mx-spark-in 3s ease-out infinite 1.4s;}\n' +
      '#mx-pet .mx-spark-4{animation:mx-spark-in 3s ease-out infinite 2.1s;}\n' +
      '#mx-pet.face-left svg{transform:scaleX(-1);}\n' +

      '@media (prefers-reduced-motion: reduce){' +
      '#mx-pet svg{animation-duration:.01s!important;animation-iteration-count:1!important;}}'
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
  // ============ APP MENU ============
  // ================================================================
  var LONG_PRESS_MS = 500;

  function appCall(cmd, args) {
    try {
      return ctx.call(cmd, args).catch(function () { return null; });
    } catch (e) {
      return Promise.resolve(null);
    }
  }

  function applyReplaceMenu() {
    appCall('menu.replace', { on: replaceMenu });
  }

  // ================================================================
  // ============ MENU ICONS — ใหม่ ใช้ SVG สวย ๆ ============
  // ================================================================
  // ใช้ inline SVG แทน emoji → ดูสะอาด ต่างเครื่องเหมือนกัน
  // icon: ชื่อจาก manifest ของแอพ, สีจาก theme หลัก
  var MENU_ICON_SVG = {
    // ---- แปล / สแกน ----
    document_scanner:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/>' +
        '<path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>' +
        '<circle cx="12" cy="12" r="3"/></svg>',
    auto_awesome:
        '<svg viewBox="0 0 24 24" fill="currentColor">' +
        '<path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2z"/>' +
        '<path d="M19 14l.9 2.6L22.5 17.5l-2.6.9L19 21l-.9-2.6L15.5 17.5l2.6-.9L19 14z"/>' +
        '<path d="M5 14l.7 2 2 .7-2 .7L5 19.4l-.7-2-2-.7 2-.7L5 14z"/></svg>',
    auto_fix_high:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M15 4V2"/><path d="M15 16v-2"/><path d="M8 9h2"/><path d="M20 9h2"/>' +
        '<path d="M17.8 11.8L19 13"/><path d="M15 9h0"/><path d="M17.8 6.2L19 5"/>' +
        '<path d="M3 21l9-9"/><path d="M12.2 6.2L11 5"/></svg>',
    menu_book:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>' +
        '<path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
    record_voice_over:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<circle cx="9" cy="7" r="3"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>' +
        '<path d="M16 11a3 3 0 0 1 0 6"/><path d="M19 8a7 7 0 0 1 0 12"/></svg>',
    volume_up:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a9 9 0 0 1 0 14"/></svg>',
    stop:
        '<svg viewBox="0 0 24 24" fill="currentColor">' +
        '<rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
    close:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M6 6l12 12"/><path d="M18 6L6 18"/></svg>',
    // ---- เอฟเฟกต์ / แต่ง ----
    palette:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<circle cx="13.5" cy="6.5" r="1"/><circle cx="17.5" cy="10.5" r="1"/>' +
        '<circle cx="8.5" cy="7.5" r="1"/><circle cx="6.5" cy="12.5" r="1"/>' +
        '<path d="M12 2a10 10 0 0 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.3-.5-.8-.5-1.2 0-1.1.9-2 2-2h2.5A4.5 4.5 0 0 0 22 11c0-5-4.5-9-10-9z"/></svg>',
    save_alt:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>' +
        '<path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/></svg>',
    // ---- ตั้งค่า ----
    settings:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<circle cx="12" cy="12" r="3"/>' +
        '<path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 8.9 19a1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 5 8.9a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    // ---- สลับโหมด ----
    swap_horiz:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M16 3l4 4-4 4"/><path d="M20 7H4"/>' +
        '<path d="M8 21l-4-4 4-4"/><path d="M4 17h16"/></svg>'
  };
  // fallback: emoji ถ้า icon ใน manifest ไม่รู้จัก
  var MENU_ICON_EMOJI = {
    auto_awesome: '🌟', palette: '🎨', save_alt: '💾', settings: '⚙️',
    swap_horiz: '🔄', stop: '⏹️', close: '⏹️'
  };

  var ENGINE_KEY = '__engine';

  // ================================================================
  // ============ MENU GROUPS — จัดกลุ่มใหม่ ============
  // ================================================================
  // กลุ่มตาม "ลำดับความสำคัญในการใช้งาน":
  //   grp 0 → แปล (scan)                     ใกล้น้องที่สุด
  //   grp 1 → เอฟเฟกต์ / แต่งกล่อง
  //   grp 2 → อ่านออกเสียง / export
  //   grp 3 → ตั้งค่า
  //   grp 4 → สลับโหมด (แยกออกไปไกลสุด มีเส้นคั่น)
  var MENU_GROUPS = {
    // กลุ่ม 0
    scan: 0, full_context_scan: 0,
    // กลุ่ม 1
    effects: 1, bubble_edit: 1, palette: 1,
    // กลุ่ม 2
    read_aloud: 2, export_chapter: 2, volume_up: 2,
    // กลุ่ม 3
    settings: 3,
    // กลุ่ม 4
    __engine: 4
  };
  var MENU_ICON_GROUPS = {
    document_scanner: 0, auto_awesome: 0, auto_fix_high: 0,
    palette: 1, save_alt: 1,
    record_voice_over: 2, volume_up: 2,
    settings: 3,
    swap_horiz: 4
  };
  // ชื่อกลุ่ม (สำหรับแสดง label เล็กๆ ระหว่างคั่น)
  var GROUP_LABELS = {
    0: 'แปล',
    1: 'เอฟเฟกต์',
    2: 'อื่นๆ',
    3: 'ตั้งค่า',
    4: 'โหมด'
  };

  function itemGroup(item) {
    if (typeof MENU_GROUPS[item.key] === 'number') return MENU_GROUPS[item.key];
    if (typeof MENU_ICON_GROUPS[item.icon] === 'number') return MENU_ICON_GROUPS[item.icon];
    return 2; // ค่ากลางสำหรับปุ่มใหม่จากแอพ
  }

  // ================================================================
  // ============ MENU STATE ============
  // ================================================================
  var menuState = { items: [], engine: ctx.engine === 'novel' ? 'novel' : 'manga', open: false };
  var menuLayer = null;

  ctx.addStyle(
      '#mx-pet-menu-layer{all:initial;position:fixed;inset:0;z-index:1000002;' +
      'background:rgba(10,10,24,.32);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);' +
      '-webkit-tap-highlight-color:transparent;}\n' +
      '#mx-pet-menu-layer .mx-menu{position:fixed;display:flex;flex-direction:column;gap:8px;}\n' +
      '#mx-pet-menu-layer .mx-menu.right{align-items:flex-end;}\n' +
      '#mx-pet-menu-layer .mx-menu.left{align-items:flex-start;}\n' +

      // ---- menu item ----
      '#mx-pet-menu-layer .mx-menu-item{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:10px;' +
      'padding:6px 16px 6px 6px;border-radius:18px;' +
      'border:1.5px solid rgba(129,140,248,.55);' +
      'background:linear-gradient(135deg,rgba(26,26,46,.98),rgba(40,30,70,.98));' +
      'color:#fff;font:600 13px/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
      'box-shadow:0 6px 20px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.06);' +
      'opacity:0;transform:translateY(10px) scale(.85);' +
      'animation:mx-menu-in .3s cubic-bezier(.34,1.56,.64,1) forwards;cursor:pointer;white-space:nowrap;' +
      'transition:transform .15s ease,box-shadow .2s ease,border-color .2s ease;}\n' +
      '#mx-pet-menu-layer .mx-menu.right .mx-menu-item{flex-direction:row-reverse;padding:6px 6px 6px 16px;}\n' +
      '#mx-pet-menu-layer .mx-menu-item:hover{transform:translateY(-1px);' +
      'border-color:rgba(168,85,247,.9);' +
      'box-shadow:0 8px 24px rgba(99,102,241,.5),inset 0 1px 0 rgba(255,255,255,.1);}\n' +
      '#mx-pet-menu-layer .mx-menu-item:active{transform:scale(.95);}\n' +

      // ---- icon ----
      '#mx-pet-menu-layer .mx-menu-icon{width:36px;height:36px;flex-shrink:0;border-radius:12px;' +
      'display:flex;align-items:center;justify-content:center;' +
      'background:linear-gradient(135deg,rgba(62,224,255,.22),rgba(168,85,247,.28));' +
      'color:#c7d2fe;box-shadow:inset 0 1px 0 rgba(255,255,255,.08);}\n' +
      '#mx-pet-menu-layer .mx-menu-icon svg{width:20px;height:20px;display:block;}\n' +
      '#mx-pet-menu-layer .mx-menu-item.active{border-color:#22d3ee;' +
      'box-shadow:0 0 16px rgba(34,211,238,.6),inset 0 1px 0 rgba(255,255,255,.1);}\n' +
      '#mx-pet-menu-layer .mx-menu-item.active .mx-menu-icon{' +
      'background:linear-gradient(135deg,rgba(34,211,238,.4),rgba(34,211,238,.25));color:#fff;}\n' +

      // ---- item สลับโหมด (ไฮไลต์พิเศษ) ----
      '#mx-pet-menu-layer .mx-menu-item.engine{' +
      'border-color:rgba(255,213,61,.6);' +
      'background:linear-gradient(135deg,rgba(40,25,60,.98),rgba(60,35,80,.98));}\n' +
      '#mx-pet-menu-layer .mx-menu-item.engine .mx-menu-icon{' +
      'background:linear-gradient(135deg,rgba(255,213,61,.35),rgba(168,85,247,.35));color:#fff8c2;}\n' +

      // ---- group label ----
      '#mx-pet-menu-layer .mx-menu-group{display:flex;align-items:center;gap:6px;' +
      'margin:6px 4px 2px;font:700 10px/1 -apple-system,sans-serif;' +
      'letter-spacing:.5px;text-transform:uppercase;color:rgba(199,210,254,.55);' +
      'opacity:0;animation:mx-menu-in .3s ease .1s forwards;}\n' +
      '#mx-pet-menu-layer .mx-menu.right .mx-menu-group{flex-direction:row-reverse;}\n' +
      '#mx-pet-menu-layer .mx-menu-group::before,' +
      '#mx-pet-menu-layer .mx-menu-group::after{content:"";height:1px;flex:1;' +
      'background:linear-gradient(90deg,transparent,rgba(129,140,248,.45),transparent);}\n' +

      '@keyframes mx-menu-in{to{opacity:1;transform:none;}}\n'
  );

  function setMenuItems(data) {
    if (!data || !data.items) return;
    menuState.items = data.items;
    if (data.engine) menuState.engine = data.engine;
    if (menuState.open) renderMenu();
  }

  function loadMenu() {
    return appCall('menu.items').then(setMenuItems);
  }

  function withEngineItem(items) {
    var toNovel = menuState.engine !== 'novel';
    return items.concat([{
      key: ENGINE_KEY,
      label: toNovel ? 'สลับเป็นนิยาย' : 'สลับเป็นมังงะ',
      icon: 'swap_horiz',
      active: false
    }]);
  }

  // เรียงใหม่ตาม group → ในกลุ่มเดียวกันคงลำดับเดิม
  function sortMenuItems(items) {
    return items
        .map(function (it, i) { return { it: it, i: i, g: itemGroup(it) }; })
        .sort(function (a, b) { return a.g - b.g || a.i - b.i; })
        .map(function (x) { return x.it; });
  }

  function openPetMenu() {
    if (menuState.items.length) {
      menuState.open = true;
      renderMenu();
      return;
    }
    loadMenu().then(function () {
      if (!menuState.items.length) return say('ตอนนี้เปิดเมนูไม่ได้น้า 🥺');
      menuState.open = true;
      renderMenu();
    });
  }

  function closePetMenu() {
    menuState.open = false;
    if (menuLayer && menuLayer.parentNode) menuLayer.parentNode.removeChild(menuLayer);
    menuLayer = null;
  }

  function renderMenu() {
    if (menuLayer && menuLayer.parentNode) menuLayer.parentNode.removeChild(menuLayer);

    var r = mascot.getBoundingClientRect();
    var w = window.innerWidth;
    var h = window.innerHeight;

    var above = r.top + r.height / 2 > h / 2;
    var onRight = r.left + r.width / 2 > w / 2;

    var items = sortMenuItems(withEngineItem(menuState.items));
    var groupOf = items.map(itemGroup);

    // ถ้าอยู่ด้านบน → reverse ทั้ง list และ group
    var ordered = above ? items.slice().reverse() : items;
    var orderedGroups = above ? groupOf.slice().reverse() : groupOf;

    var layer = document.createElement('div');
    layer.id = 'mx-pet-menu-layer';
    var list = document.createElement('div');
    list.className = 'mx-menu ' + (onRight ? 'right' : 'left');

    var nearIdx = 0;
    var lastGroup = orderedGroups[0];

    ordered.forEach(function (item, i) {
      var grp = orderedGroups[i];

      // ขึ้น label กลุ่มใหม่ (ยกเว้นอันแรก)
      if (i > 0 && grp !== lastGroup) {
        var label = document.createElement('div');
        label.className = 'mx-menu-group';
        label.textContent = GROUP_LABELS[grp] || '';
        list.appendChild(label);
      }
      lastGroup = grp;

      var button = document.createElement('button');
      button.type = 'button';
      var isEngine = item.key === ENGINE_KEY;
      button.className = 'mx-menu-item' +
          (item.active ? ' active' : '') +
          (isEngine ? ' engine' : '');
      button.style.animationDelay = (nearIdx * 40) + 'ms';
      nearIdx++;

      var icon = document.createElement('span');
      icon.className = 'mx-menu-icon';
      // ใช้ SVG ถ้ามี, ไม่งั้น fallback เป็น emoji
      if (MENU_ICON_SVG[item.icon]) {
        icon.innerHTML = MENU_ICON_SVG[item.icon];
      } else {
        icon.textContent = MENU_ICON_EMOJI[item.icon] || '•';
      }

      var labelEl = document.createElement('span');
      labelEl.textContent = item.label;

      button.appendChild(icon);
      button.appendChild(labelEl);
      button.addEventListener('click', function (ev) {
        ev.stopPropagation();
        try { pressMenu(item); } catch (e) {}
      });
      list.appendChild(button);
    });

    layer.appendChild(list);
    layer.addEventListener('click', function () {
      closePetMenu();
      try {
        react('pout', 1000);
        sayIfChance('ไม่เอาแล้วเหรอ~ 🥺');
      } catch (e) {}
    });
    document.body.appendChild(layer);
    menuLayer = layer;

    var gap = 12;
    var lw = list.offsetWidth;
    var lh = list.offsetHeight;
    var left = onRight ? r.right - lw : r.left;
    var top = above ? r.top - gap - lh : r.bottom + gap;
    left = Math.max(8, Math.min(left, w - lw - 8));
    top = Math.max(8, Math.min(top, h - lh - BOTTOM_CLEAR));
    list.style.left = left + 'px';
    list.style.top = top + 'px';
  }

  // ================================================================
  // ============ PRESS MENU ============
  // ================================================================
  function spawnRing(cx, cy) {
    var ring = document.createElement('div');
    ring.className = 'mx-ring';
    ring.style.left = cx + 'px';
    ring.style.top = cy + 'px';
    document.body.appendChild(ring);
    safeTimeout(function () { if (ring.parentNode) ring.parentNode.removeChild(ring); }, 1100);
  }

  function pressMenu(item) {
    closePetMenu();
    state.lastInteract = Date.now();
    resetIdleTimer();

    // ---- สลับโหมด: เล่น animation 1.1 วิ ก่อนยิงคำสั่ง ----
    if (item.key === ENGINE_KEY) {
      var to = menuState.engine === 'novel' ? 'manga' : 'novel';
      var c = center();

      // 1. ใส่ class engine-switch (หมุน 360° + halo หมุนเร็ว)
      mascot.classList.add('engine-switch');
      // 2. วงแหวนขยาย
      spawnRing(c.x, c.y);
      // 3. ประกาย + หัวใจ
      spawnSparks(c.x, c.y, 12);
      spawnHearts(c.x, c.top, 5);
      // 4. พูดบอก
      say(to === 'novel' ? 'ไปโหมดนิยายกัน~ 📖' : 'ไปโหมดมังงะกัน~ 🎨', false);

      // 5. รอ animation จบ → ยิงคำสั่ง
      safeTimeout(function () {
        appCall('engine.set', { type: to }).then(function (engine) {
          if (!engine) {
            // ล้มเหลว → เอา class ออก + สั่นหัว
            mascot.classList.remove('engine-switch');
            react('shake', 900);
            say('สลับไม่ได้น้า 🥺');
          }
          // ถ้าสำเร็จ หน้าใหม่จะโหลด → effect ถูก stop → class หายไปเอง
        });
      }, 1100);

      return;
    }

    // ---- ปุ่มปกติ ----
    var reaction = menuReactions[item.key];
    if (reaction) {
      react(reaction[0], 1400);
      sayIfChance(reaction[1]);
    }
    ctx.call('menu.press', { key: item.key }).catch(function () {
      react('shake', 900);
      say('ปุ่มนี้ใช้ไม่ได้ตอนนี้น้า 😣');
      loadMenu();
    });
  }

  ctx.onEvent('menu:change', setMenuItems);
  loadMenu();
  applyReplaceMenu();

  safeInterval(function () {
    if (!mascot.isConnected && document.body) document.body.appendChild(mascot);
  }, 1500);

  // ================================================================
  // ============ SAY ============
  // ================================================================
  function keepBubbleOnScreen() {
    var r = mascot.getBoundingClientRect();
    var half = bubble.offsetWidth / 2;
    var center = r.left + r.width / 2;
    var edge = 8;
    var dx = 0;
    if (center - half < edge) dx = edge - (center - half);
    else if (center + half > window.innerWidth - edge) dx = (window.innerWidth - edge) - (center + half);
    bubble.style.setProperty('--mx-bubble-dx', dx + 'px');
  }

  function say(text, showToast) {
    if (!text) return;
    if (bubble) {
      bubble.textContent = text;
      keepBubbleOnScreen();
      bubble.classList.add('show');
      if (bubbleHideTimer) clearTimeout(bubbleHideTimer);
      bubbleHideTimer = safeTimeout(function () {
        bubble.classList.remove('show');
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
    x: Math.max(margin, window.innerWidth - currentSize - 20),
    targetX: Math.max(margin, window.innerWidth - currentSize - 20),
    top: 24,
    bottom: BOTTOM_CLEAR,
    speed: walkSpeed(),
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
  if (isTop) mascot.style.top = state.top + 'px';
  else mascot.style.bottom = state.bottom + 'px';

  function setPosition(pos) {
    isTop = (pos === 'top');
    mascot.classList.toggle('at-top', isTop);
    mascot.classList.toggle('at-bottom', !isTop);
    if (isTop) {
      mascot.style.top = state.top + 'px';
      mascot.style.bottom = '';
    } else {
      mascot.style.bottom = state.bottom + 'px';
      mascot.style.top = '';
    }
  }

  // ================================================================
  // ============ FX ============
  // ================================================================
  function spawnFX(cx, cy, list, count, cssClass, opts) {
    var n = count || 3;
    for (var i = 0; i < n; i++) {
      (function () {
        var el = document.createElement('div');
        el.className = cssClass;
        el.textContent = list[Math.floor(Math.random() * list.length)];
        el.style.left = (cx - 10) + 'px';
        el.style.top = (cy - 10) + 'px';
        if (opts && opts.setVars) opts.setVars(el);
        document.body.appendChild(el);
        safeTimeout(function () {
          if (el.parentNode) el.parentNode.removeChild(el);
        }, (opts && opts.life) || 1200);
      })();
    }
  }
  function spawnHearts(cx, cy, count) {
    spawnFX(cx, cy, ['💜', '💙', '✨', '💖', '💕'], count || 3, 'mx-heart', {
      setVars: function (el) { el.style.setProperty('--hx', (Math.random() * 80 - 40) + 'px'); }
    });
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
    spawnFX(cx, cy, ['✨', '⭐', '🌟', '💫'], count || 8, 'mx-spark', {
      life: 1400,
      setVars: function (el) {
        el.style.setProperty('--sx', (Math.random() * 200 - 100) + 'px');
        el.style.setProperty('--sy', (-Math.random() * 120 - 40) + 'px');
      }
    });
  }
  function spawnNotes(cx, cy, count) {
    spawnFX(cx, cy, ['🎵', '🎶', '♪'], count || 5, 'mx-note', {
      life: 1700,
      setVars: function (el) {
        el.style.setProperty('--nx', (Math.random() * 100 - 50) + 'px');
      }
    });
  }
  function spawnDreams(cx, cy, count) {
    spawnFX(cx, cy, ['💭', '💤', '⭐', '🌙'], count || 4, 'mx-dream', { life: 3000 });
  }
  function startZzz() {
    if (state.zzzInterval) return;
    state.zzzInterval = safeInterval(function () {
      var r = mascot.getBoundingClientRect();
      spawnFX(r.left + r.width - 20, r.top + 10, ['Z', 'z', 'Z', 'z'], 1, 'mx-zzz', { life: 2100 });
    }, 900);
  }
  function stopZzz() {
    if (state.zzzInterval) {
      clearSafeInterval(state.zzzInterval);
      state.zzzInterval = null;
    }
  }

  // ================================================================
  // ============ ACTION ============
  // ================================================================
  var actionToken = 0;
  function doAction(name, duration, force) {
    if (isDragging || (state.isBusy && !force)) return;
    var token = ++actionToken;
    state.isBusy = true;
    state.isWalking = false;
    state.isAsleep = false;
    var prev = mascot.getAttribute('data-action');
    if (prev) mascot.classList.remove(prev);
    mascot.setAttribute('data-action', name);
    mascot.classList.remove('walking', 'idle', 'sleep', 'doze', 'stretch');
    mascot.classList.add(name);
    stopZzz();

    safeTimeout(function () {
      if (token !== actionToken) return;
      mascot.classList.remove(name);
      mascot.removeAttribute('data-action');
      if (!isDragging) mascot.classList.add('idle');
      state.isBusy = false;
    }, duration || 1500);
  }
  function react(name, duration) {
    doAction(name, duration, true);
  }

  // ================================================================
  // ============ DRAG ============
  // ================================================================
  var isPointerDown = false;
  var isDragging = false;
  var startPointerX = 0, startPointerY = 0;
  var startMascotLeft = 0, startMascotTop = 0, startMascotBottom = 0;
  var lastMoveX = 0, lastMoveT = 0, dragSpeed = 0;
  var longPressed = false;

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
    longPressed = false;
    state.lastInteract = Date.now();
    resetIdleTimer();
    if (mascot.setPointerCapture) {
      try { mascot.setPointerCapture(e.pointerId); } catch (err) {}
    }
    var pointerId = e.pointerId;
    clearTimeout(state.pressTimer);
    state.pressTimer = safeTimeout(function () {
      if (!isPointerDown || isDragging) return;
      longPressed = true;
      isPointerDown = false;
      if (mascot.releasePointerCapture) {
        try { mascot.releasePointerCapture(pointerId); } catch (err) {}
      }
      react('surprised', 900);
      var r = mascot.getBoundingClientRect();
      spawnSparks(r.left + r.width / 2, r.top + r.height / 2, 5);
      if (menuState.open) closePetMenu();
      else openPetMenu();
    }, LONG_PRESS_MS);
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
      clearTimeout(state.pressTimer);
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
      var curW = currentSize;
      var curH = currentSize * 1.25;
      var maxX = Math.max(margin, window.innerWidth - curW - margin);
      var newX = Math.max(margin, Math.min(maxX, startMascotLeft + dx));
      state.x = newX; state.targetX = newX;
      mascot.style.left = newX + 'px';

      if (isTop) {
        var maxTop = Math.max(margin, window.innerHeight - curH - BOTTOM_CLEAR);
        var newTop = Math.max(margin, Math.min(maxTop, startMascotTop + dy));
        state.top = newTop;
        mascot.style.top = newTop + 'px';
      } else {
        var maxBottom = Math.max(BOTTOM_CLEAR, window.innerHeight - curH - margin);
        var newBottom = Math.max(BOTTOM_CLEAR, Math.min(maxBottom, startMascotBottom - dy));
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
    clearTimeout(state.pressTimer);
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
        doAction('backflip', 1200);
        spawnSparks(e.clientX, e.clientY, 8);
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
        if (count >= 4) {
          doAction('party', 3000);
          say('ปาร์ตี้! 🎊');
          spawnSparks(r.left + r.width / 2, r.top, 15);
        } else if (count === 3) {
          doAction('laugh', 1800);
          say('ฮ่าๆๆ~ 😂');
          spawnHearts(r.left + r.width / 2, r.top, 5);
        } else if (count === 2) {
          doAction('dance', 1800);
          say('เต้นๆ~ 🕺');
          spawnNotes(r.left + r.width / 2, r.top, 6);
        } else {
          var tapPhrases = [
            'งื้ออ~ 💜', 'อย่าจิ้มเก๊าา 🐱', 'อ่านสนุกไหม? 📖',
            'อยู่เป็นเพื่อนนะ! ✨', 'ลุยตอนต่อไปกัน! 🚀', 'ฮิฮิ จั๊กจี้จัง~ 😆',
            'จั๊กจี้นะ! 🤣', 'หืม? มีอะไรเหรอ 👀'
          ];
          var tapActions = ['tap', 'wink', 'hiccup', 'blush'];
          var pick = tapActions[Math.floor(Math.random() * tapActions.length)];
          doAction(pick, 600);
          spawnHearts(e.clientX, e.clientY, 3);
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
        if (dx < 0) mascot.classList.add('face-left');
        else mascot.classList.remove('face-left');
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
    var maxX = Math.max(margin, window.innerWidth - currentSize - margin);
    var nx, attempts = 0;
    do {
      nx = margin + Math.random() * (maxX - margin);
      attempts++;
    } while (Math.abs(nx - state.x) < 80 && attempts < 10);
    state.targetX = nx;
    state.speed = walkSpeed() * (0.8 + Math.random() * 0.6);
  }

  var idlePhrases = [
    'ง่วงจังง~ 🥱', 'พักสายตาบ้างน้า ☕️',
    'อ่านถึงไหนแล้วนะ? 🤔', 'คอยเชียร์อยู่นะ! ✌️',
    'เมื่อยขาแล้วน้าา 🦵', 'ไปเดินเล่นกัน! 🚶'
  ];

  var actionGroups = {
    walkActions:  ['walk', 'walk', 'walk', 'hop', 'skip', 'tiptoe', 'sneak', 'run', 'moonwalk'],
    shortActions: ['jump', 'yawn', 'shake', 'spin', 'wink', 'clap', 'hiccup', 'sneeze'],
    moodActions:  ['laugh', 'dance', 'think', 'love', 'blush', 'pout', 'bored', 'surprised'],
    restActions:  ['yawn', 'stretch', 'sigh', 'doze', 'meditate', 'bored']
  };

  function pickFromGroup(group) {
    var list = actionGroups[group];
    return list[Math.floor(Math.random() * list.length)];
  }

  var readingType = ctx.engine === 'novel' ? 'novel' : 'manga';

  var talk = {
    manga: [
      'ฉากนี้พีคมากก! 🔥', 'พระเอกเท่ชะมัด 😳', 'ตัวร้ายน่ากลัวจังง 😱', 'ช่องนี้วาดสวยมากเลย 🎨',
      'ไม่นะ! ตัดจบตรงนี้เหรอ 😭', 'รอตอนต่อไปไม่ไหวแล้วว ⏳', 'คู่นี้ต้องได้กันนะ 💕',
      'ใครชอบเรื่องนี้ยกมือ! 🙋', 'หน้านี้ต้องแคปเก็บไว้ 📸', 'มุกนี้ฮามากก 🤣',
      'ฉากต่อสู้มันส์สุดๆ ⚔️', 'เดาว่าตอนหน้าต้องหักมุมแน่ 🤔', 'ตัวประกอบคนนี้น่ารักจัง 🥰'
    ],
    novel: [
      'สำนวนเรื่องนี้ดีจัง ✍️', 'บรรยายเห็นภาพเลย 🌄', 'ตัวละครนี้น่าสงสัยนะ 🤔',
      'อ่านอีกบทเดียวน้า~ 📖', 'ประโยคนี้โดนใจมาก 💘', 'ปมเริ่มคลายแล้วว 🧩',
      'ให้เค้าอ่านให้ฟังไหม? มีในเมนูนะ 🎧'
    ],
    translating: ['กำลังแปลอยู่น้า รอแป๊บ ⏳', 'ช่องคำพูดเยอะจัง สู้ๆ 💪', 'ใกล้เสร็จแล้วว ✨'],
    tips: [
      'กดค้างที่เค้าเพื่อเปิดเมนูนะ 👆', 'ลองแปลทั้งตอนด้วย Full Context Scan ดูสิ 🌟',
      'แตะเค้า 2 ครั้ง เค้าจะเต้นให้ดู 🕺', 'ลากเค้าไปวางตรงไหนก็ได้นะ 🛸',
      'ปรับขนาดเค้าได้ในเมนู Effects 🎛️'
    ],
    lateNight: ['ดึกแล้วน้า อ่านอีกตอนเดียวพอนะ 🌙', 'ตาจะปิดแล้วว... อ่านต่อพรุ่งนี้ไหม 😪'],
    morning: ['อรุณสวัสดิ์! อ่านตอนเช้าสดชื่นดีน้า ☀️']
  };

  var routines = {
    manga: [
      ['read', 1800, 'page-flip', 1400, 'laugh', 1500],
      ['read', 1600, 'surprised', 900, 'nosebleed', 1600],
      ['page-flip', 1500, 'excited', 1400, 'clap', 1200],
      ['read', 1800, 'cry', 1800, 'sigh', 1400],
      ['peek', 1400, 'think', 1500, 'star', 1300],
      ['read', 1500, 'blush', 1500, 'love', 1400]
    ],
    novel: [
      ['read', 2200, 'think', 1600],
      ['read', 1800, 'blush', 1400],
      ['meditate', 2000, 'read', 1800, 'wink', 800],
      ['read', 2000, 'surprised', 900, 'excited', 1300]
    ]
  };

  function playRoutine(steps) {
    var t = 0;
    for (var i = 0; i < steps.length; i += 2) {
      (function (name, dur, at) {
        safeTimeout(function () {
          if (isDragging || state.isAsleep || menuState.open) return;
          react(name, dur);
        }, at);
      })(steps[i], steps[i + 1], t);
      t += steps[i + 1] + 80;
    }
  }

  function talkChance() {
    if (chattiness === 'quiet') return 0.08;
    if (chattiness === 'chatty') return 0.35;
    return 0.2;
  }

  function chatter() {
    var hour = new Date().getHours();
    var roll = Math.random();
    if (translationState.active) {
      react('scan', 1600);
      return say(pickPhrase(talk.translating));
    }
    if ((hour >= 23 || hour < 5) && roll < 0.25) {
      react('yawn', 1800);
      return say(pickPhrase(talk.lateNight));
    }
    if (hour >= 6 && hour < 9 && roll < 0.15) {
      react('stretch', 1800);
      return say(pickPhrase(talk.morning));
    }
    if (roll < 0.2) {
      react('wave', 1400);
      var tips = talk.tips.slice();
      if (readingType === 'novel') tips.push('สลับเป็นมังงะได้ในเมนูของเค้านะ 🔄');
      return say(pickPhrase(tips));
    }
    playRoutine(pickPhrase(routines[readingType]));
    say(pickPhrase(talk[readingType]));
  }

  function randomAction() {
    if (state.isBusy || isDragging || state.isAsleep || menuState.open) return;
    if (reactToReading && Math.random() < talkChance()) return chatter();
    var groups = ['walkActions', 'shortActions', 'moodActions', 'restActions'];
    if (energy === 'lazy') groups = ['walkActions', 'restActions', 'restActions'];
    if (energy === 'hyper') groups = ['walkActions', 'shortActions', 'shortActions', 'moodActions'];
    var group = groups[Math.floor(Math.random() * groups.length)];
    var pick = pickFromGroup(group);

    if (actionGroups.walkActions.indexOf(pick) >= 0) {
      if (pick === 'walk' || pick === 'run' || pick === 'moonwalk') pickNewTarget();
      else if (pick === 'hop') { doAction('hop', 1400); pickNewTarget(); }
      else if (pick === 'skip') { doAction('skip', 1400); pickNewTarget(); }
      else if (pick === 'tiptoe') { doAction('tiptoe', 1600); pickNewTarget(); }
      else if (pick === 'sneak') { doAction('sneak', 1600); pickNewTarget(); }
      if (chattiness === 'chatty' && Math.random() < 0.3) {
        say(idlePhrases[Math.floor(Math.random() * idlePhrases.length)]);
      }
    } else {
      var durations = {
        jump: 1100, yawn: 1800, shake: 1500, spin: 1000, wink: 800,
        clap: 1500, hiccup: 1800, sneeze: 800, laugh: 1800, dance: 1800,
        think: 1600, love: 1500, blush: 2000, pout: 1800, bored: 2400,
        surprised: 900, stretch: 1800, sigh: 2000, doze: 2000, meditate: 2400
      };
      doAction(pick, durations[pick] || 1500);

      if (pick === 'yawn') say('ง่วงจังง~ 🥱');
      else if (pick === 'laugh') say('ฮิฮิ 😂');
      else if (pick === 'love') say('รักเลยน้าา 💜');
      else if (pick === 'bored') say('เบื่อจัง... 🥱');
      else if (pick === 'sneeze') say('ฮัดเช้ย! 🤧');
      else if (pick === 'hiccup') say('อึก! 😳');
      else if (pick === 'blush') say('ว้ายย~ 😳');
    }
  }

  var aiInterval = safeInterval(function () {
    if (Date.now() - state.lastInteract > 4000) randomAction();
  }, actionInterval());

  // ================================================================
  // ============ IDLE TIMER ============
  // ================================================================
  function resetIdleTimer() {
    if (state.idleTimer) clearTimeout(state.idleTimer);
    if (state.dozeTimer) clearTimeout(state.dozeTimer);
    if (state.isAsleep) {
      state.isAsleep = false;
      state.isBusy = false;
      mascot.classList.remove('sleep', 'doze', 'dream', 'snore');
      doAction('stretch', 1800);
      sayIfChance('หืมม~ หลับไปเลย 😴', true);
      stopZzz();
    }
    state.idleTimer = safeTimeout(function () {
      if (state.isBusy || isDragging || state.isAsleep) return;
      doAction('yawn', 1800);
      sayIfChance('ง่วงจังง~ 🥱');
    }, 25000);
    state.dozeTimer = safeTimeout(function () {
      if (state.isBusy || isDragging || state.isAsleep) return;
      state.isAsleep = true;
      state.isBusy = true;
      state.isWalking = false;
      var sleeps = ['sleep', 'doze', 'dream', 'snore'];
      var pick = sleeps[Math.floor(Math.random() * sleeps.length)];
      mascot.classList.remove('walking', 'idle', 'yawn');
      mascot.classList.add(pick);
      mascot.setAttribute('data-action', pick);
      startZzz();
      if (pick === 'dream') {
        var r = mascot.getBoundingClientRect();
        spawnDreams(r.left + r.width / 2, r.top, 5);
      }
      sayIfChance('นอนแป๊บนะ 😴💤');
    }, 50000);
  }
  resetIdleTimer();

  // ================================================================
  // ============ SCROLL ============
  // ================================================================
  if (reactToReading) {
    var lastY = window.scrollY || window.pageYOffset || 0;
    var lastT = Date.now();

    ctx.on(window, 'scroll', function () {
      state.lastInteract = Date.now();
      resetIdleTimer();
      if (menuState.open) closePetMenu();
      if (state.lookTimer) clearTimeout(state.lookTimer);
      state.lookTimer = safeTimeout(function () {
        if (state.isBusy || isDragging || state.isAsleep || Math.random() > talkChance() + 0.15) return;
        react(readingType === 'manga' ? 'peek' : 'read', 1600);
        say(readingType === 'manga'
            ? pickPhrase(['ดูฉากนี้นานเลยนะ ชอบเหรอ? 👀', 'ช่องนี้สวยใช่ม้า 😍', 'อ่านละเอียดจังง 🔎'])
            : pickPhrase(['ย่อหน้านี้ลึกซึ้งเนอะ 🤔', 'อ่านช้าๆ ซึมซับไปนะ 📖']));
      }, 7000);
      var now = Date.now();
      var curY = window.scrollY || window.pageYOffset || 0;
      var dt = (now - lastT) || 1;
      var scrollSpeed = Math.abs(curY - lastY) / dt;
      lastY = curY; lastT = now;

      if (scrollSpeed > 1.2) {
        state.speed = Math.min(3.2, walkSpeed() + scrollSpeed * 0.6);
        if (scrollSpeed > 2.5 && !state.isBusy) {
          mascot.classList.remove('walking');
          mascot.classList.add('run');
        }
        if (Math.random() < 0.12) pickNewTarget();
      } else {
        state.speed = walkSpeed();
        mascot.classList.remove('run');
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
    }
  }

  // ================================================================
  // ============ APP EVENTS ============
  // ================================================================
  var translationState = { active: null, type: null, lastEventAt: 0, failedCount: 0, lastCelebrate: 0 };
  var CELEBRATE_EVERY_MS = 20000;

  var phrases = {
    scanStart: {
      manga: ['สแกนมังงะให้นะ 🔍', 'แป๊บนึงน้าา~ 👀', 'ขอดูช่องคำพูดก่อนน้า 💬'],
      novel: ['อ่านนิยายให้เลย 📖', 'ตัวหนังสือเยอะจังง~ 👀', 'แปลทีละย่อหน้านะ ✍️']
    },
    fullStart: {
      manga: ['แปลทั้งตอนเลยน้า 📚', 'เปิดทุกหน้ารอเลย~ 📖'],
      novel: ['แปลทั้งตอนรวดเดียว! 📚', 'ตั้งใจอ่านอยู่นะ 🤓']
    },
    batchDone: {
      manga: ['หน้านี้เสร็จแล้ว~ ✨', 'อีกนิดน้า 💜'],
      novel: ['ย่อหน้านี้เสร็จแล้ว ✍️', 'อ่านต่อได้เลย~ 📖']
    },
    done: {
      manga: ['แปลเสร็จแล้วว! 🎉', 'ได้อ่านมังงะแล้วน้า~ ✨', 'เย้! เก่งมากเลยย 💜'],
      novel: ['แปลนิยายเสร็จแล้วว! 🎉', 'อ่านสนุกนะ~ 📖✨', 'เย้! เก่งมากเลยย 💜']
    },
    fullDone: {
      manga: ['ทั้งตอนเสร็จแล้วว! 🎉 อ่านเลยย'],
      novel: ['นิยายทั้งตอนเสร็จแล้วว! 🎉 อ่านเลยย']
    },
    failed: ['แงง แปลไม่ได้ 😢', 'มีอะไรผิดพลาดน้าา 💧', 'ลองอีกทีได้ไหม~ 🥺'],
    stopUser: ['หยุดก่อนก็ได้น้าา~ 😌', 'โอเค พักก่อนน้า ☕'],
    stopAuto: ['เปลี่ยนหน้าแล้วน้า~ 👋', 'ไปตอนต่อไปกันเลย! 📖'],
    chapterNew: ['ตอนใหม่มาแล้วว! 🎊', 'ลุยยย! 🚀', 'ตื่นเต้นจังง~ ✨']
  };

  function pickPhrase(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }
  function typeOf(data) {
    return data && data.type === 'novel' ? 'novel' : 'manga';
  }
  function center() {
    var r = mascot.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, top: r.top };
  }
  function touch() {
    translationState.lastEventAt = Date.now();
    state.lastInteract = Date.now();
    state.isAsleep = false;
    stopZzz();
    resetIdleTimer();
  }
  function setHalo(on) {
    if (on) mascot.classList.add('scan-halo');
    else mascot.classList.remove('scan-halo');
  }

  ctx.onEvent('translate:start', function (data) {
    var mode = (data && data.mode) || 'realtime';
    var type = typeOf(data);
    translationState.active = mode;
    translationState.type = type;
    touch();
    var c = center();

    if (mode === 'full') {
      react(type === 'manga' ? 'page-flip' : 'read', 3000);
      sayIfChance(pickPhrase(phrases.fullStart[type]));
      spawnNotes(c.x, c.top, 3);
    } else {
      react(type === 'manga' ? 'scan' : 'read', 2200);
      sayIfChance(pickPhrase(phrases.scanStart[type]));
      setHalo(true);
      safeTimeout(function () {
        if (translationState.active) {
          var cc = center();
          spawnSparks(cc.x, cc.y, 4);
        }
      }, 3500);
    }
  });

  ctx.onEvent('translate:done', function (data) {
    var mode = (data && data.mode) || 'realtime';
    var type = typeOf(data);
    translationState.failedCount = 0;
    touch();
    var c = center();
    var now = Date.now();

    if (mode === 'full') {
      translationState.active = null;
      setHalo(false);
      react(type === 'manga' ? 'party' : 'cheer', 3000);
      spawnSparks(c.x, c.y, 16);
      spawnHearts(c.x, c.top, 8);
      spawnNotes(c.x, c.top, 5);
      say(pickPhrase(phrases.fullDone[type]), true);
      translationState.lastCelebrate = now;
      return;
    }

    if (now - translationState.lastCelebrate > CELEBRATE_EVERY_MS) {
      translationState.lastCelebrate = now;
      var celebrates = type === 'manga'
          ? ['cheer', 'clap', 'spin', 'translate-happy']
          : ['clap', 'translate-happy', 'star', 'hop'];
      react(pickPhrase(celebrates), 2400);
      spawnSparks(c.x, c.y, 12);
      spawnHearts(c.x, c.top, 6);
      sayIfChance(pickPhrase(phrases.done[type]));
    } else {
      react(type === 'manga' ? 'wink' : 'blush', 700);
      spawnSparks(c.x, c.y, 3);
      sayIfChance(pickPhrase(phrases.batchDone[type]));
    }
  });

  ctx.onEvent('translate:failed', function (data) {
    var mode = (data && data.mode) || 'realtime';
    translationState.failedCount++;
    if (mode === 'full') {
      translationState.active = null;
      setHalo(false);
    }
    touch();
    var c = center();

    if (translationState.failedCount === 1) {
      react('surprised', 900);
      safeTimeout(function () {
        react('cry', 2400);
        var cc = center();
        spawnTears(cc.x, cc.y);
      }, 950);
      sayIfChance(pickPhrase(phrases.failed), true);
    } else if (translationState.failedCount === 2) {
      react('translate-sad', 2400);
      spawnTears(c.x, c.y);
      sayIfChance('อีกแล้วว 😢 ลองอีกทีนะ', true);
    } else {
      react('sigh', 2400);
      spawnTears(c.x, c.y);
      sayIfChance('พักก่อนก็ได้น้าา 😢💧', true);
    }
    safeTimeout(function () { translationState.failedCount = 0; }, 30000);
  });

  ctx.onEvent('translate:stop', function (data) {
    var reason = (data && data.reason) || 'auto';
    translationState.active = null;
    setHalo(false);
    touch();
    if (reason === 'user') {
      react('yawn', 1400);
      safeTimeout(function () { react('relax', 1800); }, 1450);
      sayIfChance(pickPhrase(phrases.stopUser), true);
    } else {
      react('wave', 1800);
      sayIfChance(pickPhrase(phrases.stopAuto));
    }
  });

  // ================================================================
  // ============ APP MENU / ENGINE EVENTS ============
  // ================================================================
  var menuReactions = {
    effects: ['wink', 'เลือกเอฟเฟกต์กัน~ ✨'],
    read_aloud: ['read', 'อ่านให้ฟังนะ 🎧'],
    bubble_edit: ['think', 'แต่งกล่องข้อความกัน 🎨'],
    export_chapter: ['clap', 'เก็บตอนนี้ไว้อ่านทีหลัง 💾'],
    settings: ['think', 'ปรับอะไรดีน้า~ ⚙️']
  };

  ctx.onEvent('menu:close', function (data) {
    var key = data && data.key;
    state.lastInteract = Date.now();
    resetIdleTimer();
    if (key === 'scan' || key === 'full_context_scan') return;
    var reaction = key ? menuReactions[key] : ['pout', 'ไม่เอาแล้วเหรอ~ 🥺'];
    if (!reaction) return;
    react(reaction[0], 1400);
    sayIfChance(reaction[1]);
  });

  ctx.onEvent('engine:change', function (data) {
    var type = (data && data.type) || 'manga';
    menuState.engine = type;
    readingType = type === 'novel' ? 'novel' : 'manga';
    state.lastInteract = Date.now();
    resetIdleTimer();

    // ล้าง animation สลับโหมด (ถ้ามีค้างอยู่)
    mascot.classList.remove('engine-switch');

    // ---- ต้อนรับด้วยท่าที่ต่างกันตามโหมด ----
    if (type === 'novel') {
      // นิยาย: เปิดหนังสือ → ค้อม → หัวใจ
      react('read', 1400);
      safeTimeout(function () { react('bow', 1200); }, 1450);
      safeTimeout(function () {
        var c = center();
        spawnHearts(c.x, c.top, 4);
        spawnNotes(c.x, c.top, 5);
      }, 2700);
      sayIfChance('โหมดนิยายมาแล้ว! 📖✨');
    } else {
      // มังงะ: กระโดด → หมุน → ขยิบตา
      react('jump', 1100);
      safeTimeout(function () { react('spin', 1000); }, 1150);
      safeTimeout(function () { react('wink', 800); }, 2200);
      safeTimeout(function () {
        var c = center();
        spawnSparks(c.x, c.y, 10);
      }, 2300);
      sayIfChance('โหมดมังงะกลับมาแล้ว! 🎨✨');
    }
  });

  ctx.onUrlChange(function () {
    closePetMenu();
    state.lastInteract = Date.now();
    doAction('bow', 1600);
    sayIfChance(pickPhrase(phrases.chapterNew));
    safeTimeout(function () { pickNewTarget(); }, 800);
  });

  // ================================================================
  // ============ OPTIONS ============
  // ================================================================
  ctx.onOptions(function (opts) {
    if (!opts) return;
    if (typeof opts.size === 'number' && opts.size !== currentSize) {
      var grew = opts.size > currentSize;
      currentSize = opts.size;
      mascot.style.setProperty('--mx-pet-size', opts.size + 'px');
      react(grew ? 'jump' : 'shake', 1000);
      var c = mascot.getBoundingClientRect();
      if (grew) spawnSparks(c.left + c.width / 2, c.top + c.height / 2, 6);
      say(grew ? 'ตัวโตขึ้นแล้วว! 💪' : 'ตัวเล็กลงง~ 🐣');
      clampToScreen();
    }
    if (typeof opts.interactive === 'boolean') reactToReading = opts.interactive;
    if (opts.chattiness) chattiness = opts.chattiness;
    if (opts.position) {
      defaultPosition = opts.position;
      setPosition(defaultPosition);
    }
    if (opts.energy) {
      energy = opts.energy;
      state.speed = walkSpeed();
    }
    if (typeof opts.replaceMenu === 'boolean' && opts.replaceMenu !== replaceMenu) {
      replaceMenu = opts.replaceMenu;
      applyReplaceMenu();
      say(replaceMenu ? 'กดค้างที่เค้าเพื่อเปิดเมนูนะ! 👆' : 'ปุ่มเมนูกลับมาแล้ว~');
    }
  });

  // ================================================================
  // ============ RESIZE / CLAMP ============
  // ================================================================
  function clampToScreen() {
    var curW = currentSize;
    var curH = currentSize * 1.25;
    var maxX = Math.max(margin, window.innerWidth - curW - margin);
    var maxTopY = Math.max(margin, window.innerHeight - curH - BOTTOM_CLEAR);
    var maxBottomY = Math.max(BOTTOM_CLEAR, window.innerHeight - curH - margin);
    if (state.x > maxX) {
      state.x = maxX; state.targetX = maxX;
      mascot.style.left = maxX + 'px';
    }
    if (isTop && state.top > maxTopY) {
      state.top = maxTopY; mascot.style.top = maxTopY + 'px';
    }
    if (!isTop && state.bottom > maxBottomY) {
      state.bottom = maxBottomY; mascot.style.bottom = maxBottomY + 'px';
    }
    if (!isTop && state.bottom < BOTTOM_CLEAR) {
      state.bottom = BOTTOM_CLEAR; mascot.style.bottom = BOTTOM_CLEAR + 'px';
    }
  }
  ctx.on(window, 'resize', clampToScreen, { passive: true });

  // ================================================================
  // ============ GREETING ============
  // ================================================================
  safeTimeout(function () {
    var c = mascot.getBoundingClientRect();
    if (ctx.auto) {
      react('wave', 1600);
      sayIfChance(pickPhrase(['มาอ่านต่อกันเลย~ 👋', 'เจอกันอีกแล้วน้า 💜', 'หน้านี้มีอะไรน้า 👀']));
    } else {
      react('excited', 1800);
      spawnHearts(c.left + c.width / 2, c.top, 4);
      say(replaceMenu ? 'มาแล้วว! กดค้างที่เค้าเพื่อเปิดเมนูนะ 👆' : 'เย้! มาแล้วว ✨');
    }
  }, 500);

  // ================================================================
  // ============ CLEANUP ============
  // ================================================================
  return function () {
    if (state.rafId) cancelAnimationFrame(state.rafId);
    if (state.tapTimer) clearTimeout(state.tapTimer);
    if (state.pressTimer) clearTimeout(state.pressTimer);
    if (state.idleTimer) clearTimeout(state.idleTimer);
    if (state.dozeTimer) clearTimeout(state.dozeTimer);
    if (state.lookTimer) clearTimeout(state.lookTimer);
    if (bubbleHideTimer) clearTimeout(bubbleHideTimer);
    stopZzz();
    for (var i = 0; i < activeTimers.length; i++) clearTimeout(activeTimers[i]);
    activeTimers = [];
    for (var j = 0; j < activeIntervals.length; j++) clearInterval(activeIntervals[j]);
    activeIntervals = [];
    closePetMenu();
    if (mascot.parentNode) mascot.parentNode.removeChild(mascot);
    var fx = document.querySelectorAll(
        '.mx-heart, .mx-tear, .mx-zzz, .mx-spark, .mx-note, .mx-dream, .mx-ring'
    );
    for (var k = 0; k < fx.length; k++) {
      if (fx[k].parentNode) fx[k].parentNode.removeChild(fx[k]);
    }
  };
});