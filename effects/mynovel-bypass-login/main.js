mangax.effect(function(ctx) {
  const CONFIG = {
    MIN_COINS: 10, // minimum coins threshold to allow reading
    MODAL_SELECTORS: ["[data-modal=\"login\"]", "[data-modal=\"auth\"]", ".login-modal", ".modal-login", "#login-modal"],
    COIN_SELECTORS: ["[data-coin]", "[data-credits]", ".coin-count", ".credits", "[data-coins]", ".coins"],
  };

  let isBypassed = false;

  function getCoinCount() {
    for (const selector of CONFIG.COIN_SELECTORS) {
      const el = ctx.site.querySelector(selector);
      if (el) {
        const text = el.textContent || el.innerText || "";
        const match = text.match(/(\d+)/);
        if (match) {
          return parseInt(match[1], 10);
        }
      }
    }
    return 0;
  }

  function shouldBypass() {
    return getCoinCount() >= CONFIG.MIN_COINS;
  }

  function hideModal(modal) {
    if (modal.hidden) return;
    modal.classList.add("hidden");
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
  }

  function restoreModal(modal) {
    if (!modal.hidden) return;
    modal.classList.remove("hidden");
    modal.style.display = "";
    modal.removeAttribute("aria-hidden");
    isBypassed = false;
  }

  function setupObserver() {
    const options = {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "data-modal"],
    };

    const observer = ctx.observe(function(el) {
      for (const selector of CONFIG.MODAL_SELECTORS) {
        if (el.matches(selector)) {
          const modal = el;
          setTimeout(function() {
            if (shouldBypass() && !isBypassed) {
              hideModal(modal);
              isBypassed = true;
            }
          }, 100);
          break;
        }
      }
    });

    ctx.on("stop", function() {
      observer.disconnect();
    });
  }

  function setupDirectDetection() {
    for (const selector of CONFIG.MODAL_SELECTORS) {
      const modals = ctx.site.querySelectorAll(selector);
      modals.forEach(function(modal) {
        setTimeout(function() {
          if (shouldBypass() && !modal.hidden && !isBypassed) {
            hideModal(modal);
            isBypassed = true;
          }
        }, 500);
      });
    }
  }

  function createStyles() {
    const styleId = "mynovel-bypass-login-styles";
    if (ctx.site.getElementById(styleId)) return;

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      .hidden { display: none !important; }
      [data-modal][hidden] { display: none !important; }
    `;
    document.head.appendChild(style);

    ctx.on("stop", function() {
      const existing = document.getElementById(styleId);
      if (existing) existing.remove();
    });
  }

  createStyles();
  setupDirectDetection();
  setupObserver();
});