mangax.effect(function(ctx) {
  const CONFIG = {
    MIN_COINS: 10,
    MODAL_SELECTORS: [".modal", ".modal-dialog", ".modal-backdrop", "[role='dialog']", "#modal", "[class*='modal']", "[class*='popup']"],
    COIN_SELECTORS: [".coins", ".coin-count"],
  };

  let isBypassed = false;
  let observer;

  function getCoinCount() {
    const elements = document.querySelectorAll(CONFIG.COIN_SELECTORS.join(", "));
    if (elements.length === 0) return 0;
    const el = elements[0];
    const text = (el.textContent || el.innerText || "").trim();
    const match = text.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  function shouldBypass() {
    return getCoinCount() >= CONFIG.MIN_COINS;
  }

  function hideModal(modal) {
    if (modal.dataset.bypassed) return;
    modal.dataset.bypassed = "true";
    modal.classList.add("hidden");
    modal.style.display = "none";
    modal.setAttribute("aria-hidden", "true");
  }

  function restoreModal(modal) {
    if (!modal.dataset.bypassed) return;
    modal.classList.remove("hidden");
    modal.style.display = "";
    modal.removeAttribute("aria-hidden");
    modal.removeAttribute("data-bypassed");
    isBypassed = false;
  }

  function restoreOverflowElements() {
    document.querySelectorAll("[data-mx-overflow-hidden]").forEach(function(el) {
      el.removeAttribute("data-mx-overflow-hidden");
    });
  }

  function restoreAll() {
    restoreOverflowElements();
    document.querySelectorAll("[data-bypassed]").forEach(function(el) {
      el.removeAttribute("data-bypassed");
    });
    restoreModal(null);
    isBypassed = false;
  }

  ctx.on(window, "stop", function() {
    if (observer) observer.disconnect();
    restoreAll();
  });

  return function() {
    if (observer) observer.disconnect();
    restoreAll();
    return { restored: true };
  };
});