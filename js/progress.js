/* Reusable "generating…" progress UI with a cancel button — the vanilla-JS
   equivalent of the Canva App SDK progress pattern. Use it anywhere an app runs
   a long task (AI images, exports, etc.):

     const job = ProgressUI.show(host, { title, subtitle, etaMs, onCancel });
     ... await realWork ...
     job.complete();            // jumps the bar to 100% then removes it
     // or job.remove() to drop it immediately, job.setLabel("…") mid-run.

   The bar auto-advances toward ~90% over etaMs so it feels alive, then complete()
   finishes it — so it never claims "done" before the real task actually is. */
(function () {
  "use strict";
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }

  function show(host, opts) {
    opts = opts || {};
    const eta = Math.max(1000, opts.etaMs || 10000);
    const node = el(`<div class="pjob">
      <div class="pjob-in">
        <div class="pjob-title">${esc(opts.title || "Generating…")}</div>
        <div class="pjob-bar"><div class="pjob-fill"></div></div>
        <div class="pjob-sub">${esc(opts.subtitle || "This may take a few seconds.")}</div>
        ${opts.cancel === false ? "" : `<button class="pjob-cancel">Cancel</button>`}
      </div>
    </div>`);
    const fill = node.querySelector(".pjob-fill"), sub = node.querySelector(".pjob-sub");
    let p = 0, raf = null, last = 0, finished = false, canceled = false;

    function loop(ts) {
      if (finished) return;
      if (!last) last = ts;
      const dt = ts - last; last = ts;
      if (p < 90) p = Math.min(90, p + (90 / eta) * dt);   // reach ~90% at etaMs
      else p = Math.min(99, p + 0.0025 * dt);              // then creep slowly
      fill.style.width = p + "%";
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    const cancelBtn = node.querySelector(".pjob-cancel");
    function stop() { finished = true; if (raf) cancelAnimationFrame(raf); }
    if (cancelBtn) cancelBtn.onclick = () => { if (finished) return; canceled = true; stop(); node.remove(); if (opts.onCancel) opts.onCancel(); };
    (host || document.body).appendChild(node);

    return {
      node,
      setLabel(t) { if (sub) sub.textContent = t; },
      setTitle(t) { const el2 = node.querySelector(".pjob-title"); if (el2) el2.textContent = t; },
      setProgress(v) { p = Math.max(p, Math.min(100, v)); fill.style.width = p + "%"; },
      canceled() { return canceled; },
      complete(after) { if (finished) return; stop(); fill.style.width = "100%"; node.classList.add("pjob-done"); setTimeout(() => { node.remove(); if (after) after(); }, 320); },
      remove() { stop(); node.remove(); },
    };
  }

  window.ProgressUI = { show };
})();
