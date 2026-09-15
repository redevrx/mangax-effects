mangax.effect(function(ctx) {
  const CONFIG = {
    MODAL_SELECTORS: [
      ".fixed.top-0.left-0.right-0.bottom-0.z-[9999]",
      ".modal-backdrop",
      ".login-modal",
      ".auth-modal",
      ".modal-overlay",
      "[role='dialog']",
      "[aria-modal='true']",
      ".full-screen-modal",
      ".fullscreen-modal",
      ".blocker-modal",
      ".blocker-overlay",
    ],
    LOGIN_SELECTORS: [
      ".login-modal",
      ".auth-modal",
      ".modal-content",
      ".modal-dialog",
      ".login-overlay",
      ".auth-overlay",
      ".login-screen",
      ".auth-screen",
      "[role='dialog']",
    ],
    MODAL_BUTTON_SELECTORS: [
      ".modal-close",
      ".close-modal",
      ".btn-close",
      ".close-btn",
      ".modal-dismiss",
      ".dismiss-btn",
      ".modal-accept",
      ".accept-btn",
      ".btn-accept",
      ".accept-modal",
      ".modal-yes",
      ".yes-btn",
    ],
  };

  let observer;
  let modalElement = null;
  let isBypassed = false;

  function hideModal() {
    if (!modalElement || modalElement.dataset.mx_bypassed) return;
    modalElement.dataset.mx_bypassed = "true";
    modalElement.style.display = "none";
  }

  function restoreModal() {
    if (!modalElement || !modalElement.dataset.mx_bypassed) return;
    modalElement.style.display = "";
    modalElement.removeAttribute("data-mx_bypassed");
    isBypassed = false;
  }

  function restoreAll() {
    if (observer) observer.disconnect();
    isBypassed = false;
  }

  function setupObserver() {
    if (observer) return;
    observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        mutation.addedNodes.forEach(function(node) {
          if (node.nodeType === 1) {
            CONFIG.MODAL_SELECTORS.some(function(selector) {
              return node.matches(selector);
            }) && (modalElement = node);
          }
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function checkAndApply() {
    if (modalElement && !modalElement.dataset.mx_bypassed && !isBypassed) {
      setupObserver();
      isBypassed = true;
      modalElement.dataset.mx_bypassed = "true";
      modalElement.style.display = "none";
    }
  }

  ctx.observe(".fixed.top-0.left-0.right-0.bottom-0.z-50,.fixed.top-0.left-0.right-0.bottom-0.z-9999,.fixed.top-0.left-0.right-0.bottom-0.z-[9999],.fixed.top-0.left-0.right-0.bottom-0", function(el) {
    if (!el.dataset.mx_bypassed) {
      el.dataset.mx_bypassed = "true";
      el.style.display = "none";
    }
  });

  ctx.observe("[role='dialog']", function(el) {
    if (!el.dataset.mx_bypassed) {
      el.dataset.mx_bypassed = "true";
      el.style.display = "none";
    }
  });

  ctx.observe(".login-modal,.auth-modal,.modal-overlay,.full-screen-modal,.fullscreen-modal,.blocker-modal,.blocker-overlay,.auth-screen,.login-screen", function(el) {
    if (!el.dataset.mx_bypassed) {
      el.dataset.mx_bypassed = "true";
      el.style.display = "none";
    }
  });

  ctx.addStyle(`
    .fixed.top-0.left-0.right-0.bottom-0.z-9999,
    .modal-backdrop,
    .login-modal,
    .auth-modal,
    .modal-overlay,
    [role="dialog"][aria-modal="true"],
    .full-screen-modal,
    .fullscreen-modal,
    .blocker-modal,
    .blocker-overlay,
    .auth-screen,
    .login-screen {
      display: none !important;
    }
  `);

  ctx.toast("Bypass active: login modals hidden. Refresh to restore.");

  return function() {
    restoreAll();
    return { restored: true };
  };
});