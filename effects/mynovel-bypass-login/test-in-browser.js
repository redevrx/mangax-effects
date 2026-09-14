// ============================================================
// MANGAX EFFECT TEST - Bypass Login (mynovel.co)
// Run this in Chrome DevTools Console on mynovel.co
// ============================================================

const CONFIG = {
  MIN_COINS: 10,
  MODAL_SELECTORS: ["[data-modal=\"login\"]", "[data-modal=\"auth\"]", ".login-modal", ".modal-login", "#login-modal"],
  COIN_SELECTORS: ["[data-coin]", "[data-credits]", ".coin-count", ".credits", "[data-coins]", ".coins"],
};

let isBypassed = false;

// --- Test 1: Coin Detection ---
console.log("═══════════════════════════════════════════════════════");
console.log("🧪 MANGAX EFFECT TEST - Bypass Login");
console.log("═══════════════════════════════════════════════════════");

function getCoinCount() {
  for (const selector of CONFIG.COIN_SELECTORS) {
    const el = document.querySelector(selector);
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

console.log("💰 Coins detected:", getCoinCount());
console.log("🚀 Should bypass:", getCoinCount() >= CONFIG.MIN_COINS);

// --- Test 2: Modal Detection ---
console.log("\n🔍 Modal Detection:");
const modals = [];
for (const selector of CONFIG.MODAL_SELECTORS) {
  const found = document.querySelectorAll(selector);
  found.forEach(el => {
    modals.push(el);
    console.log("  ✅ Found modal:", selector, "→", el.tagName, el.className || "");
  });
}
console.log("  Total modals found:", modals.length);

// --- Test 3: Simulate Bypass ---
console.log("\n🎬 Simulating bypass...");
setTimeout(() => {
  if (getCoinCount() >= CONFIG.MIN_COINS && !isBypassed) {
    console.log("🔓 Bypass activated! Hiding modals...");
    isBypassed = true;
    modals.forEach((modal, i) => {
      modal.classList.add("hidden");
      modal.style.display = "none";
      modal.setAttribute("aria-hidden", "true");
      console.log(`  ✅ Hidden modal #${i + 1}: ${modal.tagName}`);
    });
  } else {
    console.log("⚠️  Coins < 10 or no modals found");
  }
}, 300);

// --- Test 4: Mutation Observer (like real effect) ---
console.log("\n👁️  Setting up MutationObserver...");
const observer = new MutationObserver((records) => {
  for (const record of records) {
    const added = record.addedNodes;
    for (const node of added) {
      if (node.nodeType === 1 && node.matches && CONFIG.MODAL_SELECTORS.some(sel => node.matches(sel))) {
        console.log("  🆕 New modal detected:", node.tagName);
        if (getCoinCount() >= CONFIG.MIN_COINS && !isBypassed) {
          node.classList.add("hidden");
          node.style.display = "none";
          console.log("  ✅ Auto-hidden new modal");
          isBypassed = true;
        }
      }
    }
  }
});

observer.observe(document.documentElement, { childList: true, subtree: true });
setTimeout(() => observer.disconnect(), 10000);

// --- Test 5: Manual Toggle ---
console.log("\n🔄 Manual toggle:");
console.log("  Type: toggleBypass(true/false) in console to manually hide/show modals");

function toggleBypass(force) {
  isBypassed = force;
  if (force) {
    if (getCoinCount() >= CONFIG.MIN_COINS) {
      modals.forEach(hideModal);
    }
  } else {
    modals.forEach((m) => {
      m.classList.remove("hidden");
      m.style.display = "";
      m.removeAttribute("aria-hidden");
    });
  }
}

window.toggleBypass = toggleBypass;
window.toggleBypass(false);

console.log("\n✅ Test complete. Modals hidden:", modals.every(m => m.classList.contains("hidden")));
console.log("═══════════════════════════════════════════════════════");
