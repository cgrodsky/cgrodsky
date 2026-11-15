/* Blue Screen of Death — shown when critical system files (System32) are deleted.
   Counts up, then "restarts": marks the PC broken and reloads into Setup, where
   "Repair Windows" can put it back. The QR code is a (harmless) rickroll. */
(function () {
  "use strict";
  const S = () => State.data;
  const screen = () => document.getElementById("screen");
  const RICK = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
  let active = false;

  function show(opts) {
    if (active) return; active = true;
    opts = opts || {};
    const stop = opts.stopCode || "CRITICAL_PROCESS_DIED";
    const bs = document.createElement("div");
    bs.className = "bsod";
    bs.innerHTML = `
      <div class="bsod-inner">
        <div class="bsod-face">:(</div>
        <p class="bsod-msg">Your PC ran into a problem and needs to restart. We're just collecting some error info, and then we'll restart for you.</p>
        <p class="bsod-pct"><span class="bsod-n">0</span>% complete</p>
        <div class="bsod-foot">
          <img class="bsod-qr" src="assets/bsod_qr.png?v=1" alt="QR code" title="Scan for more info">
          <div class="bsod-foot-tx">
            <p>For more information about this issue and possible fixes, visit https://www.windows.com/stopcode</p>
            <p class="bsod-small">If you call a support person, give them this info:</p>
            <p class="bsod-small">Stop code: ${stop}</p>
          </div>
        </div>
      </div>`;
    screen().appendChild(bs);
    // Tapping/scanning the QR goes to the rickroll.
    bs.querySelector(".bsod-qr").onclick = () => { try { window.open(RICK, "_blank", "noopener"); } catch (_) {} };
    try { const a = new Audio("assets/raw/SFX_023.mp3"); a.volume = 0.4; a.play().catch(() => {}); } catch (_) {}

    const nEl = bs.querySelector(".bsod-n");
    let pct = 0;
    const iv = setInterval(() => {
      pct = Math.min(100, pct + (pct < 30 ? 6 + Math.random() * 9 : pct < 85 ? 2 + Math.random() * 5 : 1 + Math.random() * 2));
      nEl.textContent = Math.floor(pct);
      if (pct >= 100) { clearInterval(iv); setTimeout(crash, 1100); }
    }, 360);
  }

  function crash() {
    try {
      const d = S();
      d.systemBroken = true;     // Repair Windows (in Setup) checks this
      d.setupCompleted = false;  // force Setup on the next boot
      d.installerDone = false;   // start from the installer, where "Repair Windows" lives
      State.save();
    } catch (_) {}
    location.reload();
  }

  window.BSOD = { show };
})();
