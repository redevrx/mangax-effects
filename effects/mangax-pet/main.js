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

      // ============ 🚶 LOCOMOTION (14) ============
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

      '#mx-pet.crawl svg{animation:mx-crawl 1.6s ease-in-out infinite!important;transform-origin:120px 260px;}\n' +
      '@keyframes mx-crawl{0%,100%{transform:rotate(-14deg) scaleY(.86)}50%{transform:rotate(-12deg) scaleY(.84) translateY(4px)}}\n' +
      '#mx-pet.crawl .mx-arm-l{animation:mx-arm-l .7s ease-in-out infinite;transform-origin:60px 180px;}\n' +
      '#mx-pet.crawl .mx-arm-r{animation:mx-arm-r .7s ease-in-out infinite;transform-origin:180px 180px;}\n' +

      '#mx-pet.limp .mx-leg-l{animation:mx-leg-l .6s ease-in-out infinite;}\n' +
      '#mx-pet.limp .mx-leg-r{animation:mx-limp-r .6s ease-in-out infinite;}\n' +
      '@keyframes mx-limp-r{0%,100%{transform:rotate(6deg)}50%{transform:rotate(-10deg) translateY(4px)}}\n' +
      '#mx-pet.limp svg{animation:mx-limp-body .6s ease-in-out infinite!important;}\n' +
      '@keyframes mx-limp-body{0%,100%{transform:rotate(2deg)}50%{transform:rotate(-2deg) translateY(2px)}}\n' +
      '#mx-pet.limp .mx-eye-l,#mx-pet.limp .mx-eye-r{transform:scaleY(.7)!important;}\n' +

      '#mx-pet.strut .mx-leg-l{animation:mx-strut-l .5s ease-in-out infinite;}\n' +
      '#mx-pet.strut .mx-leg-r{animation:mx-strut-r .5s ease-in-out infinite .25s;}\n' +
      '@keyframes mx-strut-l{0%,100%{transform:rotate(-28deg) translateX(-2px)}50%{transform:rotate(18deg) translateX(2px)}}\n' +
      '@keyframes mx-strut-r{0%,100%{transform:rotate(28deg) translateX(2px)}50%{transform:rotate(-18deg) translateX(-2px)}}\n' +
      '#mx-pet.strut svg{animation:mx-strut-body .5s ease-in-out infinite!important;}\n' +
      '@keyframes mx-strut-body{0%,100%{transform:rotate(-3deg) translateY(0)}50%{transform:rotate(3deg) translateY(-3px)}}\n' +

      '#mx-pet.bounce-walk .mx-leg-l{animation:mx-leg-l .28s ease-in-out infinite;}\n' +
      '#mx-pet.bounce-walk .mx-leg-r{animation:mx-leg-r .28s ease-in-out infinite;}\n' +
      '#mx-pet.bounce-walk svg{animation:mx-bounce-walk .28s ease-in-out infinite!important;}\n' +
      '@keyframes mx-bounce-walk{0%,100%{transform:translateY(0) scaleY(1)}50%{transform:translateY(-12px) scaleY(1.04)}}\n' +

      '#mx-pet.slide svg{animation:mx-slide 1s ease-in-out infinite!important;transform-origin:120px 260px;}\n' +
      '@keyframes mx-slide{0%,100%{transform:rotate(-18deg) translateY(6px)}50%{transform:rotate(-15deg) translateY(4px)}}\n' +
      '#mx-pet.slide .mx-arm-l{animation:mx-arm-l .5s ease-in-out infinite;transform-origin:60px 180px;}\n' +
      '#mx-pet.slide .mx-arm-r{animation:mx-arm-r .5s ease-in-out infinite;transform-origin:180px 180px;}\n' +

      // ============ 😴 REST (11) ============
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

      '#mx-pet.nap svg{animation:mx-nap 2.2s ease-in-out infinite!important;transform-origin:120px 260px;}\n' +
      '@keyframes mx-nap{0%,100%{transform:rotate(-9deg) scale(.98)}50%{transform:rotate(-9deg) scale(1)}}\n' +
      '#mx-pet.nap .mx-eye-l,#mx-pet.nap .mx-eye-r{animation:none!important;transform:scaleY(.15)!important;}\n' +

      '#mx-pet.snooze svg{animation:mx-snooze 5s ease-in-out infinite!important;transform-origin:120px 260px;}\n' +
      '@keyframes mx-snooze{0%,100%{transform:rotate(-13deg) scale(.95)}50%{transform:rotate(-13deg) scale(.97) translateY(2px)}}\n' +
      '#mx-pet.snooze .mx-eye-l,#mx-pet.snooze .mx-eye-r{animation:none!important;transform:scaleY(.06)!important;}\n' +

      '#mx-pet.wake svg{animation:mx-wake 1s cubic-bezier(.34,1.56,.64,1)!important;}\n' +
      '@keyframes mx-wake{0%{transform:rotate(-12deg) scale(.94)}60%{transform:rotate(4deg) scale(1.08)}100%{transform:rotate(0) scale(1)}}\n' +

      '#mx-pet.dream-hop svg{animation:mx-dream-hop 1.4s ease-in-out infinite!important;}\n' +
      '@keyframes mx-dream-hop{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-8px) rotate(3deg)}}\n' +
      '#mx-pet.dream-hop .mx-eye-l,#mx-pet.dream-hop .mx-eye-r{animation:none!important;transform:scaleY(.15)!important;fill:#FF69B4!important;}\n' +

      // ============ 😂 EMOTION (19) ============
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

      '#mx-pet.smug svg{animation:mx-smug 2.4s ease-in-out infinite!important;}\n' +
      '@keyframes mx-smug{0%,100%{transform:rotate(2deg)}50%{transform:rotate(-2deg)}}\n' +
      '#mx-pet.smug .mx-mouth{d:path("M112 98 Q120 96 128 92");}\n' +
      '#mx-pet.smug .mx-eye-l,#mx-pet.smug .mx-eye-r{transform:scaleY(.65)!important;}\n' +

      '#mx-pet.panic svg{animation:mx-panic .12s linear 15!important;}\n' +
      '@keyframes mx-panic{0%,100%{transform:translate(0,0)}25%{transform:translate(-5px,-3px) rotate(-3deg)}75%{transform:translate(5px,3px) rotate(3deg)}}\n' +
      '#mx-pet.panic .mx-mouth{d:path("M114 100 Q120 108 126 100");}\n' +
      '#mx-pet.panic .mx-eye-l,#mx-pet.panic .mx-eye-r{transform:scaleY(1.2)!important;}\n' +

      '#mx-pet.confused svg{animation:mx-confused 2.5s ease-in-out infinite!important;}\n' +
      '@keyframes mx-confused{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg)}}\n' +
      '#mx-pet.confused .mx-mouth{d:path("M114 100 Q120 96 126 102");}\n' +
      '#mx-pet.confused .mx-eye-l{transform:scaleY(.5)!important;}\n' +

      '#mx-pet.sweat svg{animation:mx-sweat 2s ease-in-out infinite!important;}\n' +
      '@keyframes mx-sweat{0%,100%{transform:rotate(-1deg)}50%{transform:rotate(1deg) translateY(-2px)}}\n' +
      '#mx-pet.sweat .mx-mouth{d:path("M114 100 Q120 96 126 100");}\n' +
      '#mx-pet.sweat .mx-eye-l,#mx-pet.sweat .mx-eye-r{transform:scaleY(.7)!important;}\n' +

      '#mx-pet.relieved svg{animation:mx-relieved 2.4s ease-in-out!important;}\n' +
      '@keyframes mx-relieved{0%{transform:scale(1.05) translateY(-4px)}100%{transform:scale(1) translateY(0)}}\n' +
      '#mx-pet.relieved .mx-eye-l,#mx-pet.relieved .mx-eye-r{transform:scaleY(.3)!important;animation:none!important;}\n' +

      '#mx-pet.determined svg{animation:mx-det 1.6s ease-in-out infinite!important;}\n' +
      '@keyframes mx-det{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}\n' +
      '#mx-pet.determined .mx-mouth{d:path("M112 100 L128 100");}\n' +
      '#mx-pet.determined .mx-eye-l,#mx-pet.determined .mx-eye-r{transform:scaleY(.85)!important;fill:#FF3B3B!important;}\n' +

      '#mx-pet.mischievous svg{animation:mx-mis 2s ease-in-out infinite!important;}\n' +
      '@keyframes mx-mis{0%,100%{transform:rotate(-3deg) translateX(0)}50%{transform:rotate(3deg) translateX(2px)}}\n' +
      '#mx-pet.mischievous .mx-mouth{d:path("M110 100 Q120 108 130 96");}\n' +
      '#mx-pet.mischievous .mx-eye-l,#mx-pet.mischievous .mx-eye-r{transform:scaleY(.6)!important;}\n' +

      // ============ 🎉 CELEBRATE (13) ============
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

      '#mx-pet.fist-pump .mx-arm-r{animation:mx-fp .4s ease-in-out 4!important;transform-origin:180px 180px;}\n' +
      '@keyframes mx-fp{0%,100%{transform:rotate(0)}50%{transform:rotate(-80deg)}}\n' +
      '#mx-pet.fist-pump svg{animation:mx-fp-body .4s ease-in-out 4!important;}\n' +
      '@keyframes mx-fp-body{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}\n' +

      '#mx-pet.high-five .mx-arm-r{animation:mx-hf .5s cubic-bezier(.34,1.56,.64,1) 3!important;transform-origin:180px 180px;}\n' +
      '@keyframes mx-hf{0%,100%{transform:rotate(0)}50%{transform:rotate(-95deg)}}\n' +

      '#mx-pet.fanfare svg{animation:mx-fan 1.2s ease-in-out 3!important;}\n' +
      '@keyframes mx-fan{0%,100%{transform:rotate(0) scale(1)}25%{transform:rotate(-12deg) scale(1.08)}' +
      '75%{transform:rotate(12deg) scale(1.08)}}\n' +
      '#mx-pet.fanfare .mx-eye-l,#mx-pet.fanfare .mx-eye-r{fill:#FFD93D!important;}\n' +

      '#mx-pet.cartwheel svg{animation:mx-cart 1.6s cubic-bezier(.5,0,.5,1)!important;transform-origin:120px 200px;}\n' +
      '@keyframes mx-cart{0%{transform:rotate(0) translateY(0)}25%{transform:rotate(-90deg) translateY(-20px)}' +
      '50%{transform:rotate(-180deg) translateY(-30px)}75%{transform:rotate(-270deg) translateY(-20px)}' +
      '100%{transform:rotate(-360deg) translateY(0)}}\n' +

      '#mx-pet.victory svg{animation:mx-vic .6s cubic-bezier(.34,1.56,.64,1)!important;}\n' +
      '@keyframes mx-vic{0%{transform:scale(1) translateY(0)}50%{transform:scale(1.15) translateY(-14px)}100%{transform:scale(1.05) translateY(-6px)}}\n' +
      '#mx-pet.victory .mx-arm-l{transform:rotate(-100deg)!important;transform-origin:60px 180px;}\n' +
      '#mx-pet.victory .mx-arm-r{transform:rotate(100deg)!important;transform-origin:180px 180px;}\n' +
      '#mx-pet.victory .mx-eye-l,#mx-pet.victory .mx-eye-r{fill:#FFD93D!important;}\n' +

      // ============ 📖 READING (13) ============
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

      '#mx-pet.book-hug .mx-arm-l{transform:rotate(-50deg)!important;transform-origin:60px 180px;}\n' +
      '#mx-pet.book-hug .mx-arm-r{transform:rotate(50deg)!important;transform-origin:180px 180px;}\n' +
      '#mx-pet.book-hug svg{animation:mx-bh 1.6s ease-in-out infinite!important;}\n' +
      '@keyframes mx-bh{0%,100%{transform:scale(1)}50%{transform:scale(1.05) rotate(-2deg)}}\n' +
      '#mx-pet.book-hug .mx-cheek{fill:#FF69B4!important;opacity:1!important;}\n' +

      '#mx-pet.tear-jerk svg{animation:mx-tj 1.2s ease-in-out 3!important;}\n' +
      '@keyframes mx-tj{0%,100%{transform:translateY(0)}50%{transform:translateY(4px) rotate(-3deg)}}\n' +
      '#mx-pet.tear-jerk .mx-mouth{d:path("M114 102 Q120 94 126 102");}\n' +

      '#mx-pet.gasp svg{animation:mx-gasp .8s cubic-bezier(.34,1.56,.64,1)!important;}\n' +
      '@keyframes mx-gasp{0%{transform:scale(1)}50%{transform:scale(1.12) translateY(-4px)}100%{transform:scale(1)}}\n' +
      '#mx-pet.gasp .mx-mouth{d:path("M116 100 Q120 108 124 100 Q120 96 116 100");}\n' +
      '#mx-pet.gasp .mx-eye-l,#mx-pet.gasp .mx-eye-r{transform:scaleY(1.15)!important;}\n' +

      '#mx-pet.nod svg{animation:mx-nod .6s ease-in-out 4!important;transform-origin:120px 260px;}\n' +
      '@keyframes mx-nod{0%,100%{transform:rotate(0)}50%{transform:rotate(8deg)}}\n' +

      '#mx-pet.squint svg{animation:mx-squint 1.6s ease-in-out infinite!important;}\n' +
      '@keyframes mx-squint{0%,100%{transform:rotate(-2deg)}50%{transform:rotate(2deg)}}\n' +
      '#mx-pet.squint .mx-eye-l,#mx-pet.squint .mx-eye-r{transform:scaleY(.35)!important;animation:none!important;}\n' +

      '#mx-pet.bookmark .mx-arm-r{animation:mx-bm .8s ease-in-out 3!important;transform-origin:180px 180px;}\n' +
      '@keyframes mx-bm{0%,100%{transform:rotate(0)}50%{transform:rotate(-70deg)}}\n' +

      // ============ 🎭 MISC (15) ============
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

      '#mx-pet.grumble svg{animation:mx-grumble .8s ease-in-out 3!important;}\n' +
      '@keyframes mx-grumble{0%,100%{transform:rotate(0)}25%{transform:rotate(-5deg)}75%{transform:rotate(5deg)}}\n' +
      '#mx-pet.grumble .mx-mouth{d:path("M114 102 Q120 96 126 102");}\n' +

      '#mx-pet.shiver svg{animation:mx-shiver .1s linear 15!important;}\n' +
      '@keyframes mx-shiver{0%,100%{transform:translateX(0)}50%{transform:translateX(-2px)}}\n' +
      '#mx-pet.shiver .mx-eye-l,#mx-pet.shiver .mx-eye-r{transform:scaleY(.4)!important;}\n' +

      '#mx-pet.stretch-arms .mx-arm-l{animation:mx-sa-l 1.6s ease-in-out!important;transform-origin:60px 180px;}\n' +
      '#mx-pet.stretch-arms .mx-arm-r{animation:mx-sa-r 1.6s ease-in-out!important;transform-origin:180px 180px;}\n' +
      '@keyframes mx-sa-l{0%,100%{transform:rotate(0)}50%{transform:rotate(-90deg)}}\n' +
      '@keyframes mx-sa-r{0%,100%{transform:rotate(0)}50%{transform:rotate(90deg)}}\n' +

      '#mx-pet.finger-heart svg{animation:mx-fh 1.4s ease-in-out 3!important;}\n' +
      '@keyframes mx-fh{0%,100%{transform:scale(1)}50%{transform:scale(1.08) translateY(-2px)}}\n' +
      '#mx-pet.finger-heart .mx-arm-r{transform:rotate(-45deg)!important;transform-origin:180px 180px;}\n' +
      '#mx-pet.finger-heart .mx-cheek{fill:#FF69B4!important;opacity:1!important;}\n' +

      '#mx-pet.cover-mouth .mx-arm-l{animation:mx-cm-l .8s ease-in-out 4!important;transform-origin:60px 180px;}\n' +
      '#mx-pet.cover-mouth .mx-arm-r{animation:mx-cm-r .8s ease-in-out 4!important;transform-origin:180px 180px;}\n' +
      '@keyframes mx-cm-l{0%,100%{transform:rotate(0)}50%{transform:rotate(40deg)}}\n' +
      '@keyframes mx-cm-r{0%,100%{transform:rotate(0)}50%{transform:rotate(-40deg)}}\n' +
      '#mx-pet.cover-mouth svg{animation:mx-cm-body .8s ease-in-out 4!important;}\n' +
      '@keyframes mx-cm-body{0%,100%{transform:translateY(0)}50%{transform:translateY(3px) scale(.98)}}\n' +

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

      // ============ MENU LAYER ============
      '#mx-pet-menu-layer{all:initial;position:fixed;inset:0;z-index:1000002;' +
      'background:rgba(10,10,24,.32);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px);' +
      '-webkit-tap-highlight-color:transparent;}\n' +
      '#mx-pet-menu-layer .mx-menu{position:fixed;display:flex;flex-direction:column;gap:8px;}\n' +
      '#mx-pet-menu-layer .mx-menu.right{align-items:flex-end;}\n' +
      '#mx-pet-menu-layer .mx-menu.left{align-items:flex-start;}\n' +

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
      '#mx-pet-menu-layer .mx-menu-item:active{transform:scale(.95);}\n' +

      '#mx-pet-menu-layer .mx-menu-icon{width:36px;height:36px;flex-shrink:0;border-radius:12px;' +
      'display:flex;align-items:center;justify-content:center;' +
      'background:linear-gradient(135deg,rgba(62,224,255,.22),rgba(168,85,247,.28));' +
      'color:#c7d2fe;box-shadow:inset 0 1px 0 rgba(255,255,255,.08);' +
      'transition:transform .2s ease;}\n' +
      '#mx-pet-menu-layer .mx-menu-icon svg{width:20px;height:20px;display:block;}\n' +
      '#mx-pet-menu-layer .mx-menu-item.active{border-color:#22d3ee;' +
      'box-shadow:0 0 16px rgba(34,211,238,.6),inset 0 1px 0 rgba(255,255,255,.1);}\n' +
      '#mx-pet-menu-layer .mx-menu-item.active .mx-menu-icon{' +
      'background:linear-gradient(135deg,rgba(34,211,238,.4),rgba(34,211,238,.25));color:#fff;}\n' +

      '#mx-pet-menu-layer .mx-menu-item.engine{' +
      'border-color:rgba(255,213,61,.6);' +
      'background:linear-gradient(135deg,rgba(40,25,60,.98),rgba(60,35,80,.98));}\n' +

      '#mx-pet-menu-layer .mx-menu-item[data-group="0"] .mx-menu-icon{' +
      'background:linear-gradient(135deg,rgba(62,224,255,.28),rgba(99,102,241,.32));' +
      'color:#7dd3fc;}\n' +
      '#mx-pet-menu-layer .mx-menu-item[data-group="1"] .mx-menu-icon{' +
      'background:linear-gradient(135deg,rgba(168,85,247,.3),rgba(255,158,199,.28));' +
      'color:#d8b4fe;}\n' +
      '#mx-pet-menu-layer .mx-menu-item[data-group="2"] .mx-menu-icon{' +
      'background:linear-gradient(135deg,rgba(20,184,166,.3),rgba(34,211,238,.28));' +
      'color:#5eead4;}\n' +
      '#mx-pet-menu-layer .mx-menu-item[data-group="3"] .mx-menu-icon{' +
      'background:linear-gradient(135deg,rgba(148,163,184,.28),rgba(100,116,139,.32));' +
      'color:#cbd5e1;}\n' +
      '#mx-pet-menu-layer .mx-menu-item[data-group="4"] .mx-menu-icon{' +
      'background:linear-gradient(135deg,rgba(255,213,61,.32),rgba(251,146,60,.3));' +
      'color:#fde68a;}\n' +

      '#mx-pet-menu-layer .mx-menu-item[data-group="0"]:hover{' +
      'transform:translateY(-1px);border-color:rgba(62,224,255,.9);' +
      'box-shadow:0 8px 24px rgba(62,224,255,.4),inset 0 1px 0 rgba(255,255,255,.1);}\n' +
      '#mx-pet-menu-layer .mx-menu-item[data-group="1"]:hover{' +
      'transform:translateY(-1px);border-color:rgba(168,85,247,.9);' +
      'box-shadow:0 8px 24px rgba(168,85,247,.4),inset 0 1px 0 rgba(255,255,255,.1);}\n' +
      '#mx-pet-menu-layer .mx-menu-item[data-group="2"]:hover{' +
      'transform:translateY(-1px);border-color:rgba(20,184,166,.9);' +
      'box-shadow:0 8px 24px rgba(20,184,166,.4),inset 0 1px 0 rgba(255,255,255,.1);}\n' +
      '#mx-pet-menu-layer .mx-menu-item[data-group="3"]:hover{' +
      'transform:translateY(-1px);border-color:rgba(148,163,184,.9);' +
      'box-shadow:0 8px 24px rgba(148,163,184,.35),inset 0 1px 0 rgba(255,255,255,.1);}\n' +
      '#mx-pet-menu-layer .mx-menu-item[data-group="4"]:hover{' +
      'transform:translateY(-1px);border-color:rgba(255,213,61,.95);' +
      'box-shadow:0 8px 24px rgba(255,213,61,.45),inset 0 1px 0 rgba(255,255,255,.1);}\n' +

      '#mx-pet-menu-layer .mx-menu-item:hover .mx-menu-icon svg{' +
      'animation:mx-icon-pop .35s cubic-bezier(.34,1.56,.64,1);}\n' +
      '@keyframes mx-icon-pop{' +
      '  0%   {transform:scale(1) rotate(0);}\n' +
      '  50%  {transform:scale(1.18) rotate(-6deg);}\n' +
      '  100% {transform:scale(1) rotate(0);}\n' +
      '}\n' +

      '#mx-pet-menu-layer .mx-menu-group{display:flex;align-items:center;gap:6px;' +
      'margin:6px 4px 2px;font:700 10px/1 -apple-system,sans-serif;' +
      'letter-spacing:.5px;text-transform:uppercase;color:rgba(199,210,254,.55);' +
      'opacity:0;animation:mx-menu-in .3s ease .1s forwards;}\n' +
      '#mx-pet-menu-layer .mx-menu.right .mx-menu-group{flex-direction:row-reverse;}\n' +
      '#mx-pet-menu-layer .mx-menu-group::before,' +
      '#mx-pet-menu-layer .mx-menu-group::after{content:"";height:1px;flex:1;' +
      'background:linear-gradient(90deg,transparent,rgba(129,140,248,.45),transparent);}\n' +

      '@keyframes mx-menu-in{to{opacity:1;transform:none;}}\n' +

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

  // ================================================================
  // ============ 🛡 SAFE MOUNT — กัน document.body ยังไม่มี ============
  // ================================================================
  var bubble = null;
  var bubbleHideTimer = null;

  function ensureBubble() {
    if (!bubble && mascot) {
      try { bubble = mascot.querySelector('#mx-pet-bubble'); } catch (e) { bubble = null; }
    }
    return bubble;
  }

  function mountMascot() {
    if (document.body && !mascot.isConnected) {
      try { document.body.appendChild(mascot); } catch (e) {}
      ensureBubble();
    }
  }

  if (document.body) {
    mountMascot();
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountMascot, { once: true });
  } else {
    var mountRetry = safeInterval(function () {
      if (document.body) {
        clearSafeInterval(mountRetry);
        mountMascot();
      }
    }, 50);
  }

  // Re-mount อัตโนมัติถ้า mascot หลุดจาก DOM (SPA / page reload)
  safeInterval(function () {
    if (document.body && !mascot.isConnected) {
      try { document.body.appendChild(mascot); } catch (e) {}
      ensureBubble();
    }
  }, 1500);

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

  var MENU_ICON_SVG = {
    document_scanner:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M3 8V5.5A2.5 2.5 0 0 1 5.5 3H8" opacity=".9"/>' +
        '<path d="M16 3h2.5A2.5 2.5 0 0 1 21 5.5V8" opacity=".9"/>' +
        '<path d="M21 16v2.5a2.5 2.5 0 0 1-2.5 2.5H16" opacity=".9"/>' +
        '<path d="M8 21H5.5A2.5 2.5 0 0 1 3 18.5V16" opacity=".9"/>' +
        '<circle cx="12" cy="12" r="3.2" fill="currentColor" opacity=".22" stroke="none"/>' +
        '<circle cx="12" cy="12" r="3.2"/>' +
        '<path d="M12 8.8v6.4M8.8 12h6.4" opacity=".35" stroke-width="1.2"/>' +
        '</svg>',
    auto_awesome:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M12 2.5l1.7 4.8 4.8 1.7-4.8 1.7L12 15.5l-1.7-4.8L5.5 9l4.8-1.7L12 2.5z" fill="currentColor" opacity=".22"/>' +
        '<path d="M12 2.5l1.7 4.8 4.8 1.7-4.8 1.7L12 15.5l-1.7-4.8L5.5 9l4.8-1.7L12 2.5z"/>' +
        '<path d="M19 15l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z" fill="currentColor" opacity=".5" stroke-width="1.4"/>' +
        '<path d="M5 16l.6 1.7 1.7.6-1.7.6L5 20.6l-.6-1.7-1.7-.6 1.7-.6L5 16z" fill="currentColor" opacity=".5" stroke-width="1.4"/>' +
        '</svg>',
    auto_fix_high:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M9.5 14.5L3 21l1.5-6.5L9.5 14.5z" fill="currentColor" opacity=".22"/>' +
        '<path d="M9.5 14.5L3 21l1.5-6.5L9.5 14.5z"/>' +
        '<path d="M14 10l-4.5 4.5L14 19l4.5-4.5L14 10z" fill="currentColor" opacity=".22"/>' +
        '<path d="M14 10l-4.5 4.5L14 19l4.5-4.5L14 10z"/>' +
        '<path d="M18 4l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z" fill="currentColor" stroke-width="1.4"/>' +
        '<path d="M20 13l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3L18.2 15l1.3-.5.5-1.5z" fill="currentColor" opacity=".7" stroke-width="1.2"/>' +
        '</svg>',
    palette:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M12 2.5C6.5 2.5 2.5 6.8 2.5 12S6.5 21.5 12 21.5c1.3 0 2.3-1 2.3-2.3 0-.6-.2-1.1-.6-1.5-.3-.4-.5-.9-.5-1.5 0-1.2 1-2.2 2.2-2.2h2.1c2.1 0 3.8-1.7 3.8-3.8 0-4.6-4.1-7.7-9.3-7.7z" fill="currentColor" opacity=".18"/>' +
        '<path d="M12 2.5C6.5 2.5 2.5 6.8 2.5 12S6.5 21.5 12 21.5c1.3 0 2.3-1 2.3-2.3 0-.6-.2-1.1-.6-1.5-.3-.4-.5-.9-.5-1.5 0-1.2 1-2.2 2.2-2.2h2.1c2.1 0 3.8-1.7 3.8-3.8 0-4.6-4.1-7.7-9.3-7.7z"/>' +
        '<circle cx="8" cy="10" r="1.2" fill="currentColor" stroke="none"/>' +
        '<circle cx="12" cy="7.5" r="1.2" fill="currentColor" stroke="none"/>' +
        '<circle cx="16" cy="9" r="1.2" fill="currentColor" stroke="none"/>' +
        '<circle cx="17" cy="13.5" r="1.2" fill="currentColor" stroke="none"/>' +
        '</svg>',
    record_voice_over:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
        '<circle cx="9" cy="7" r="3.2" fill="currentColor" opacity=".22" stroke="none"/>' +
        '<circle cx="9" cy="7" r="3.2"/>' +
        '<path d="M3 20.5v-1.5a4.5 4.5 0 0 1 4.5-4.5h3A4.5 4.5 0 0 1 15 19v1.5" fill="currentColor" opacity=".22" stroke="none"/>' +
        '<path d="M3 20.5v-1.5a4.5 4.5 0 0 1 4.5-4.5h3A4.5 4.5 0 0 1 15 19v1.5"/>' +
        '<path d="M17.5 8.5a3 3 0 0 1 0 6" opacity=".9"/>' +
        '<path d="M20 6a6.5 6.5 0 0 1 0 11" opacity=".6"/>' +
        '</svg>',
    volume_up:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M11 5.5L6.5 9.5H3.5v5h3L11 18.5V5.5z" fill="currentColor" opacity=".22"/>' +
        '<path d="M11 5.5L6.5 9.5H3.5v5h3L11 18.5V5.5z"/>' +
        '<path d="M15 9.5a3.5 3.5 0 0 1 0 5"/>' +
        '<path d="M18 6.5a7 7 0 0 1 0 11" opacity=".7"/>' +
        '</svg>',
    save_alt:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M19.5 20.5H4.5a1.5 1.5 0 0 1-1.5-1.5V5a1.5 1.5 0 0 1 1.5-1.5h11L20 7.9V19a1.5 1.5 0 0 1-.5 1.5z" fill="currentColor" opacity=".18"/>' +
        '<path d="M19.5 20.5H4.5a1.5 1.5 0 0 1-1.5-1.5V5a1.5 1.5 0 0 1 1.5-1.5h11L20 7.9V19a1.5 1.5 0 0 1-.5 1.5z"/>' +
        '<path d="M7 3.5v5h8v-5" opacity=".9"/>' +
        '<path d="M16.5 20.5v-6.5h-9v6.5" opacity=".9"/>' +
        '</svg>',
    settings:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" fill="currentColor" opacity=".22" stroke="none"/>' +
        '<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/>' +
        '<path d="M19.4 14.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.55-1.1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1.5z"/>' +
        '</svg>',
    swap_horiz:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M4 7.5h14" opacity=".55"/>' +
        '<path d="M4 7.5h14"/>' +
        '<path d="M14 3.5l4 4-4 4"/>' +
        '<path d="M20 16.5H6" opacity=".55"/>' +
        '<path d="M20 16.5H6"/>' +
        '<path d="M10 20.5l-4-4 4-4"/>' +
        '</svg>',
    translate:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M4 5h10M9 3v2c0 4-2 7-5 9M5 9c0 3 3 6 6 7"/>' +
        '<path d="M13 21l4-9 4 9M14.5 17.5h5"/>' +
        '</svg>',
    star:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M12 3.5l2.6 5.6 6 .7-4.5 4.2 1.2 6-5.3-3-5.3 3 1.2-6L3.4 9.8l6-.7L12 3.5z" fill="currentColor" opacity=".22"/>' +
        '<path d="M12 3.5l2.6 5.6 6 .7-4.5 4.2 1.2 6-5.3-3-5.3 3 1.2-6L3.4 9.8l6-.7L12 3.5z"/>' +
        '</svg>',
    favorite:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M12 20.5s-7-4.3-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10.5c0 5.7-7 10-7 10z" fill="currentColor" opacity=".22"/>' +
        '<path d="M12 20.5s-7-4.3-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10.5c0 5.7-7 10-7 10z"/>' +
        '</svg>',
    download:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M12 3v13M6.5 11L12 16.5 17.5 11"/>' +
        '<path d="M4 20h16" opacity=".6"/>' +
        '</svg>',
    notifications:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M6 8a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6z" fill="currentColor" opacity=".18"/>' +
        '<path d="M6 8a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6z"/>' +
        '<path d="M10 20a2 2 0 0 0 4 0"/>' +
        '</svg>',
    content_copy:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="8" y="8" width="12" height="12" rx="2"/>' +
        '<path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>' +
        '</svg>',
    refresh:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M20.5 12a8.5 8.5 0 1 1-2.5-6L21 8.5"/>' +
        '<path d="M21 3v5.5h-5.5"/>' +
        '</svg>'
  };

  var MENU_ICON_DEFAULT =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="12" cy="12" r="8"/>' +
      '<path d="M12 8v8M8 12h8" opacity=".6"/>' +
      '</svg>';

  var ENGINE_KEY = '__engine';

  var MENU_GROUPS = {
    scan: 0, full_context_scan: 0,
    effects: 1, bubble_edit: 1,
    read_aloud: 2, export_chapter: 2,
    settings: 3,
    __engine: 4
  };
  var MENU_ICON_GROUPS = {
    document_scanner: 0, auto_awesome: 0,
    auto_fix_high: 1, palette: 1,
    record_voice_over: 2, volume_up: 2, save_alt: 2,
    settings: 3,
    swap_horiz: 4
  };
  var GROUP_LABELS = {
    0: 'แปล', 1: 'เอฟเฟกต์', 2: 'อื่นๆ', 3: 'ตั้งค่า', 4: 'โหมด'
  };

  function itemGroup(item) {
    if (typeof MENU_GROUPS[item.key] === 'number') return MENU_GROUPS[item.key];
    if (typeof MENU_ICON_GROUPS[item.icon] === 'number') return MENU_ICON_GROUPS[item.icon];
    return 2;
  }

  var menuState = { items: [], engine: ctx.engine === 'novel' ? 'novel' : 'manga', open: false };
  var menuLayer = null;

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
    if (!document.body) return;

    var r = mascot.getBoundingClientRect();
    var w = window.innerWidth;
    var h = window.innerHeight;

    var above = r.top + r.height / 2 > h / 2;
    var onRight = r.left + r.width / 2 > w / 2;

    var items = sortMenuItems(withEngineItem(menuState.items));
    var groupOf = items.map(itemGroup);

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
      button.setAttribute('data-group', grp);
      button.style.animationDelay = (nearIdx * 40) + 'ms';
      nearIdx++;

      var icon = document.createElement('span');
      icon.className = 'mx-menu-icon';
      icon.innerHTML = MENU_ICON_SVG[item.icon] || MENU_ICON_DEFAULT;

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

  function spawnRing(cx, cy) {
    if (!document.body) return;
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

    if (item.key === ENGINE_KEY) {
      var to = menuState.engine === 'novel' ? 'manga' : 'novel';
      var c = center();

      mascot.classList.add('engine-switch');
      spawnRing(c.x, c.y);
      spawnSparks(c.x, c.y, 12);
      spawnHearts(c.x, c.top, 5);
      say(to === 'novel' ? 'ไปโหมดนิยายกัน~ 📖' : 'ไปโหมดมังงะกัน~ 🎨', false);

      safeTimeout(function () {
        appCall('engine.set', { type: to }).then(function (engine) {
          if (!engine) {
            mascot.classList.remove('engine-switch');
            react('shake', 900);
            say('สลับไม่ได้น้า 🥺');
          }
        });
      }, 1100);
      return;
    }

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

  // ================================================================
  // ============ SAY ============
  // ================================================================
  function keepBubbleOnScreen() {
    var b = ensureBubble();
    if (!b) return;
    var r = mascot.getBoundingClientRect();
    var half = b.offsetWidth / 2;
    var center = r.left + r.width / 2;
    var edge = 8;
    var dx = 0;
    if (center - half < edge) dx = edge - (center - half);
    else if (center + half > window.innerWidth - edge) dx = (window.innerWidth - edge) - (center + half);
    b.style.setProperty('--mx-bubble-dx', dx + 'px');
  }

  function say(text, showToast) {
    if (!text) return;
    var b = ensureBubble();
    if (b) {
      b.textContent = text;
      keepBubbleOnScreen();
      b.classList.add('show');
      if (bubbleHideTimer) clearTimeout(bubbleHideTimer);
      bubbleHideTimer = safeTimeout(function () {
        b.classList.remove('show');
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
    if (!document.body) return;
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
    if (!document.body) return;
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
        doAction('cartwheel', 1600);
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
            'จั๊กจี้นะ! 🤣', 'หืม? มีอะไรเหรอ 👀', 'เค้าอยู่นี่น้าา 💙',
            'อยากอ่านต่อแล้ว~ 📚', 'แอบดึงความสนใจนิดนึง 😜'
          ];
          var tapActions = ['tap', 'wink', 'hiccup', 'blush', 'finger-heart', 'smug'];
          var pick = tapActions[Math.floor(Math.random() * tapActions.length)];
          doAction(pick, 700);
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
    'เมื่อยขาแล้วน้าา 🦵', 'ไปเดินเล่นกัน! 🚶',
    'ทำอะไรอยู่น้า~ 👀', 'คิดถึงอยู่นะ 💭',
    'เค้าอยากอ่านด้วยย 📖', 'หืมม~ เงียบจัง 🤫'
  ];

  var actionGroups = {
    walkActions:  ['walk', 'walk', 'walk', 'hop', 'skip', 'tiptoe', 'sneak', 'run',
      'moonwalk', 'crawl', 'limp', 'strut', 'bounce-walk', 'slide'],
    shortActions: ['jump', 'yawn', 'shake', 'spin', 'wink', 'clap', 'hiccup', 'sneeze',
      'nod', 'gasp', 'shiver', 'wake'],
    moodActions:  ['laugh', 'dance', 'think', 'love', 'blush', 'pout', 'bored', 'surprised',
      'smug', 'panic', 'confused', 'sweat', 'relieved', 'determined',
      'mischievous', 'grumble'],
    restActions:  ['yawn', 'stretch', 'sigh', 'doze', 'meditate', 'bored',
      'nap', 'snooze', 'dream-hop', 'stretch-arms'],
    readActions:  ['read', 'book-hug', 'tear-jerk', 'gasp', 'nod', 'squint', 'bookmark'],
    celebrateActions: ['cheer', 'clap', 'spin', 'translate-happy', 'star', 'party',
      'fist-pump', 'high-five', 'fanfare', 'cartwheel', 'victory']
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
      'ฉากต่อสู้มันส์สุดๆ ⚔️', 'เดาว่าตอนหน้าต้องหักมุมแน่ 🤔', 'ตัวประกอบคนนี้น่ารักจัง 🥰',
      'ช่องนี้ CG หนักมาก 🌟', 'เส้นสายสวยเหมือนงานศิลป์ 🎨', 'ท่าไม้ตายนี่เท่มากก ⚡',
      'เปิดช่องใหม่มาอีกแล้ว! 🎉', 'อ่านแล้วอยากวาดการ์ตูนเลย ✏️', 'หน้านี้เงียบเกินไป 😐',
      'ตื่นเต้นจนลืมหายใจเลย 😰'
    ],
    novel: [
      'สำนวนเรื่องนี้ดีจัง ✍️', 'บรรยายเห็นภาพเลย 🌄', 'ตัวละครนี้น่าสงสัยนะ 🤔',
      'อ่านอีกบทเดียวน้า~ 📖', 'ประโยคนี้โดนใจมาก 💘', 'ปมเริ่มคลายแล้วว 🧩',
      'ให้เค้าอ่านให้ฟังไหม? มีในเมนูนะ 🎧', 'ตัวละครนี้มีมิติมาก 🎭',
      'บทนี้เศร้าจังง 😢', 'อ่านไปยิ้มไปเลย ☺️', 'อยากให้มีภาคต่อเร็วๆ ⏳',
      'คำผิดไม่มีเลย นักแปลเก่งมาก 👏', 'บทสนทนาธรรมชาติมาก 💬',
      'ฉากนี้ตื่นเต้นจนลืมหายใจ 😰', 'ได้กลิ่นอายแฟนตาซีเลย 🐉',
      'อ่านแล้วคิดถึงตัวเองเลย 🥹', 'เนื้อเรื่องดำเนินไวมาก ⚡',
      'ตัวร้ายเขียนดีจนเกลียดไม่ลง 😈', 'บทนี้ต้องอ่านซ้ำ 🔁',
      'ประโยคสุดท้ายทำน้ำตาไหล 😭'
    ],
    translating: [
      'กำลังแปลอยู่น้า รอแป๊บ ⏳', 'ช่องคำพูดเยอะจัง สู้ๆ 💪', 'ใกล้เสร็จแล้วว ✨',
      'ขอเวลาหน่อยน้าา~ 🕐', 'เค้าช่วยดูอยู่นะ 👀'
    ],
    tips: [
      'กดค้างที่เค้าเพื่อเปิดเมนูนะ 👆', 'ลองแปลทั้งตอนด้วย Full Context Scan ดูสิ 🌟',
      'แตะเค้า 2 ครั้ง เค้าจะเต้นให้ดู 🕺', 'ลากเค้าไปวางตรงไหนก็ได้นะ 🛸',
      'ปรับขนาดเค้าได้ในเมนู Effects 🎛️', 'แตะ 3 ครั้ง เค้าจะหัวเราะให้ 😂',
      'ปัดเร็วๆ เค้าจะตีลังกา 🤸', 'ปล่อยนิ่งๆ เค้าจะหลับ 💤',
      'แตะ 4 ครั้ง มีเซอร์ไพรส์ 🎊', 'สลับโหมดได้ในเมนูของเค้านะ 🔄',
      'อ่านตอนดึก เค้าจะหาวให้ดู 🥱', 'ถ้าอ่านจบตอน เค้าจะปรบมือให้ 👏',
      'กดค้าง 2 วิ เค้าจะคิดอะไรอยู่นะ 🤔', 'อ่านตอนเช้า เค้าจะทักทาย ☀️',
      'ขนาดตัวปรับได้ตามใจเลย 🎨'
    ],
    morning: ['อรุณสวัสดิ์! ☀️', 'เช้าแบบนี้ อ่านมังงะกับกาแฟ ☕', 'ตื่นมาอ่านเลย! 🌅', 'วันใหม่แล้วน้าา 🌱'],
    afternoon: ['บ่ายแล้วน้า พักสายตาบ้าง 👀', 'บ่ายแก่ๆ อ่านเพลินเลย 🌤️', 'อากาศดีนะวันนี้ 🌞'],
    evening: ['เย็นแล้ว อ่านสบายๆ 🌆', 'พระอาทิตย์ตกแล้ว อ่านต่อน้า 🌇', 'ค่ำนี้มีมังงะอร่อย 🍵'],
    lateNight: ['ดึกมากแล้วน้า 🌙', 'จะตี 2 แล้วนะ! 😴', 'อ่านอีกตอนเดียวจริงๆ นะ 🥱', 'ตาจะปิดแล้วว~ 😪'],
    walking: ['ไปเดินเล่นก่อนน้า~ 🚶', 'ขอเดินย่อยหน่อย 🍃', 'ไปดูตรงโน้นดีกว่า 🚶‍♀️'],
    yawning: ['ง่วงงงง~ 🥱', 'หาววว~ 😮‍💨'],
    sleeping: ['นอนแป๊บนะ 💤', 'หลับฝันดี 😴', 'zzz...'],
    eating: ['อร่อยจัง~ 😋', 'กินหน่อยน้า 🍰'],
    surprised: ['ว้ายย! 😱', 'ตกใจหมดเลย! 😲', 'อะไรนะ!? 😮'],
    happy: ['เย้! 🎉', 'ดีใจจังง~ ✨', 'สุขใจสุดๆ 💜'],
    sad: ['แงง 😢', 'เศร้าเลย 💧', 'ไม่เป็นไรนะ 🥺']
  };

  var routines = {
    manga: [
      ['read', 1800, 'page-flip', 1400, 'laugh', 1500],
      ['read', 1600, 'surprised', 900, 'nosebleed', 1600],
      ['page-flip', 1500, 'excited', 1400, 'clap', 1200],
      ['read', 1800, 'cry', 1800, 'sigh', 1400],
      ['peek', 1400, 'think', 1500, 'star', 1300],
      ['read', 1500, 'blush', 1500, 'love', 1400],
      ['read', 1800, 'gasp', 900, 'determined', 1400],
      ['page-flip', 1500, 'squint', 1400, 'bookmark', 1200],
      ['read', 1700, 'tear-jerk', 1500, 'book-hug', 1400]
    ],
    novel: [
      ['read', 2200, 'think', 1600],
      ['read', 1800, 'blush', 1400],
      ['meditate', 2000, 'read', 1800, 'wink', 800],
      ['read', 2000, 'surprised', 900, 'excited', 1300],
      ['read', 2100, 'smug', 1500, 'nod', 1000],
      ['read', 1900, 'squint', 1400, 'bookmark', 1200],
      ['read', 2000, 'tear-jerk', 1600, 'book-hug', 1500]
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
    if (hour >= 23 || hour < 5) {
      if (roll < 0.4) {
        react('yawn', 1800);
        return say(pickPhrase(talk.lateNight));
      }
    } else if (hour >= 6 && hour < 12) {
      if (roll < 0.25) {
        react('stretch-arms', 1800);
        return say(pickPhrase(talk.morning));
      }
    } else if (hour >= 12 && hour < 17) {
      if (roll < 0.15) {
        react('wink', 800);
        return say(pickPhrase(talk.afternoon));
      }
    } else {
      if (roll < 0.15) {
        react('relieved', 1600);
        return say(pickPhrase(talk.evening));
      }
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
    var groups = ['walkActions', 'shortActions', 'moodActions', 'restActions',
      'readActions', 'celebrateActions'];
    if (energy === 'lazy') groups = ['walkActions', 'restActions', 'restActions', 'readActions'];
    if (energy === 'hyper') groups = ['walkActions', 'shortActions', 'shortActions', 'moodActions',
      'celebrateActions', 'celebrateActions'];
    var group = groups[Math.floor(Math.random() * groups.length)];
    var pick = pickFromGroup(group);

    if (group === 'walkActions') {
      if (pick === 'walk' || pick === 'run' || pick === 'moonwalk' ||
          pick === 'crawl' || pick === 'limp' || pick === 'strut' ||
          pick === 'bounce-walk' || pick === 'slide') {
        doAction(pick, 1800);
        pickNewTarget();
      } else if (pick === 'hop') { doAction('hop', 1400); pickNewTarget(); }
      else if (pick === 'skip') { doAction('skip', 1400); pickNewTarget(); }
      else if (pick === 'tiptoe') { doAction('tiptoe', 1600); pickNewTarget(); }
      else if (pick === 'sneak') { doAction('sneak', 1600); pickNewTarget(); }
      if (chattiness === 'chatty' && Math.random() < 0.3) say(pickPhrase(talk.walking));
    } else {
      var durations = {
        jump: 1100, yawn: 1800, shake: 1500, spin: 1000, wink: 800,
        clap: 1500, hiccup: 1800, sneeze: 800, laugh: 1800, dance: 1800,
        think: 1600, love: 1500, blush: 2000, pout: 1800, bored: 2400,
        surprised: 900, stretch: 1800, sigh: 2000, doze: 2000, meditate: 2400,
        nap: 2000, snooze: 2500, wake: 1200, 'dream-hop': 1800,
        smug: 2000, panic: 1500, confused: 2000, sweat: 2000,
        relieved: 1800, determined: 1600, mischievous: 2000, grumble: 1800,
        shiver: 1500, 'stretch-arms': 1600, 'finger-heart': 1400, 'cover-mouth': 1400,
        read: 2000, 'book-hug': 1800, 'tear-jerk': 1800, gasp: 900, nod: 1200,
        squint: 1600, bookmark: 1500,
        cheer: 2000, party: 3000, star: 2000, excited: 1800,
        'fist-pump': 1600, 'high-five': 1500, fanfare: 2000, cartwheel: 1600, victory: 1500,
        'page-flip': 1500, 'translate-happy': 1800, 'translate-sad': 1800, relax: 1800
      };
      doAction(pick, durations[pick] || 1500);

      if (pick === 'yawn' || pick === 'snooze' || pick === 'nap') say(pickPhrase(talk.yawning));
      else if (pick === 'laugh') say(pickPhrase(talk.happy));
      else if (pick === 'love' || pick === 'finger-heart') say('รักเลยน้าา 💜');
      else if (pick === 'bored') say('เบื่อจัง... 🥱');
      else if (pick === 'sneeze') say('ฮัดเช้ย! 🤧');
      else if (pick === 'hiccup') say('อึก! 😳');
      else if (pick === 'blush') say('ว้ายย~ 😳');
      else if (pick === 'gasp') say(pickPhrase(talk.surprised));
      else if (pick === 'cry') say(pickPhrase(talk.sad));
      else if (pick === 'cheer' || pick === 'party' || pick === 'victory' ||
          pick === 'fist-pump' || pick === 'fanfare') say(pickPhrase(talk.happy));
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
      mascot.classList.remove('sleep', 'doze', 'dream', 'snore', 'nap', 'snooze');
      doAction('wake', 1400);
      safeTimeout(function () { doAction('stretch', 1800); }, 1450);
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
      var sleeps = ['sleep', 'doze', 'dream', 'snore', 'nap', 'snooze'];
      var pick = sleeps[Math.floor(Math.random() * sleeps.length)];
      mascot.classList.remove('walking', 'idle', 'yawn');
      mascot.classList.add(pick);
      mascot.setAttribute('data-action', pick);
      startZzz();
      if (pick === 'dream') {
        var r = mascot.getBoundingClientRect();
        spawnDreams(r.left + r.width / 2, r.top, 5);
      }
      sayIfChance(pickPhrase(talk.sleeping));
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
            ? pickPhrase(['ดูฉากนี้นานเลยนะ ชอบเหรอ? 👀', 'ช่องนี้สวยใช่ม้า 😍',
              'อ่านละเอียดจังง 🔎', 'จดจำทุกช่องเลยนะ 🧐'])
            : pickPhrase(['ย่อหน้านี้ลึกซึ้งเนอะ 🤔', 'อ่านช้าๆ ซึมซับไปนะ 📖',
              'ประโยคนี้เพราะจัง 💭']));
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
          doAction('fanfare', 2400);
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
            doAction('fanfare', 2400);
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
      react(type === 'manga' ? 'party' : 'fanfare', 3000);
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
          ? ['cheer', 'clap', 'spin', 'translate-happy', 'fist-pump', 'high-five']
          : ['clap', 'translate-happy', 'star', 'victory', 'fanfare'];
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
      react('panic', 2400);
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
      react('sigh', 1800);
      safeTimeout(function () { react('relax', 1800); }, 1850);
      sayIfChance(pickPhrase(phrases.stopUser), true);
    } else {
      react('wave', 1800);
      sayIfChance(pickPhrase(phrases.stopAuto));
    }
  });

  // ================================================================
  // ============ MENU / ENGINE EVENTS ============
  // ================================================================
  var menuReactions = {
    effects: ['wink', 'เลือกเอฟเฟกต์กัน~ ✨'],
    read_aloud: ['read', 'อ่านให้ฟังนะ 🎧'],
    bubble_edit: ['think', 'แต่งกล่องข้อความกัน 🎨'],
    export_chapter: ['bookmark', 'เก็บตอนนี้ไว้อ่านทีหลัง 💾'],
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

    mascot.classList.remove('engine-switch');

    if (type === 'novel') {
      react('read', 1400);
      safeTimeout(function () { react('bow', 1200); }, 1450);
      safeTimeout(function () {
        var c = center();
        spawnHearts(c.x, c.top, 4);
        spawnNotes(c.x, c.top, 5);
      }, 2700);
      sayIfChance('โหมดนิยายมาแล้ว! 📖✨');
    } else {
      react('victory', 1500);
      safeTimeout(function () { react('spin', 1000); }, 1550);
      safeTimeout(function () { react('wink', 800); }, 2600);
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
      sayIfChance(pickPhrase(['มาอ่านต่อกันเลย~ 👋', 'เจอกันอีกแล้วน้า 💜',
        'หน้านี้มีอะไรน้า 👀', 'เค้าพร้อมแล้วน้า ✨']));
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