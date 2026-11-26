/* Easter eggs. Konami code (up up down down left right left right B A) bursts confetti
   over the whole screen. Exposes window.Easter.confetti(opts) so other parts of the sim
   (a win, a corner hit) can celebrate too. Purely cosmetic; nothing is stored. */
(function () {
  "use strict";
  if (window.Easter) return;

  function confetti(opts) {
    opts = opts || {};
    const dur = opts.duration || 2600;
    const n = opts.count || 180;
    const cv = document.createElement("canvas");
    cv.className = "egg-confetti";
    cv.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:2147483600";
    document.body.appendChild(cv);
    const g = cv.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    function fit() { cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr); }
    fit();
    const COLORS = ["#e84393", "#0984e3", "#00b894", "#fdcb6e", "#6c5ce7", "#ff7675", "#55efc4", "#fd79a8"];
    const cx = (opts.x != null ? opts.x : innerWidth / 2) * dpr, cy = (opts.y != null ? opts.y : innerHeight * 0.35) * dpr;
    const parts = [];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = (3 + Math.random() * 9) * dpr;
      parts.push({ x: cx, y: cy, vx: Math.cos(a) * sp * (0.6 + Math.random()), vy: Math.sin(a) * sp - 6 * dpr, g: (0.18 + Math.random() * 0.12) * dpr,
        w: (6 + Math.random() * 7) * dpr, h: (8 + Math.random() * 9) * dpr, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.4,
        col: COLORS[(Math.random() * COLORS.length) | 0], life: 1 });
    }
    const t0 = performance.now();
    let raf = 0;
    function frame(t) {
      if (cv.width !== Math.round(innerWidth * dpr)) fit();
      const k = (t - t0) / dur;
      g.clearRect(0, 0, cv.width, cv.height);
      let alive = 0;
      parts.forEach((p) => {
        p.vy += p.g; p.vx *= 0.995; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        p.life = Math.max(0, 1 - k);
        if (p.y < cv.height + 40 && p.life > 0) alive++;
        g.save(); g.globalAlpha = Math.min(1, p.life * 1.4); g.translate(p.x, p.y); g.rotate(p.rot);
        g.fillStyle = p.col; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); g.restore();
      });
      if (t - t0 < dur && alive > 0) { raf = requestAnimationFrame(frame); }
      else { cancelAnimationFrame(raf); cv.remove(); }
    }
    raf = requestAnimationFrame(frame);
    return cv;
  }

  // Konami watcher.
  const SEQ = ["arrowup", "arrowup", "arrowdown", "arrowdown", "arrowleft", "arrowright", "arrowleft", "arrowright", "b", "a"];
  let pos = 0;
  function onKey(e) {
    const k = (e.key || "").toLowerCase();
    if (k === SEQ[pos]) {
      pos++;
      if (pos === SEQ.length) { pos = 0; celebrate(); }
    } else {
      pos = (k === SEQ[0]) ? 1 : 0;
    }
  }
  let cooling = false;
  function celebrate() {
    if (cooling) return; cooling = true; setTimeout(() => (cooling = false), 1500);
    confetti({ x: innerWidth / 2, y: innerHeight * 0.3 });
    setTimeout(() => confetti({ x: innerWidth * 0.2, y: innerHeight * 0.5, count: 90 }), 180);
    setTimeout(() => confetti({ x: innerWidth * 0.8, y: innerHeight * 0.5, count: 90 }), 360);
    try { if (window.Notify) Notify.show({ icon: "", title: "↑↑↓↓←→←→ B A", body: "Cheat activated. Have some confetti." }); } catch (e) {}
    try { if (window.Achievements && Achievements.unlock) Achievements.unlock("konami"); } catch (e) {}
  }
  try { window.addEventListener("keydown", onKey, true); } catch (e) {}

  window.Easter = { confetti, konami: celebrate };
})();
