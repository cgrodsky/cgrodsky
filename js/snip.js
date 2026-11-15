/* Snipping Tool — drag a region of the screen and capture it to an image.
   Uses html2canvas (loaded on demand from cdnjs) to rasterize the desktop, then
   crops to the selected rectangle. Snips save into Photos (appData.snips). */
(function () {
  "use strict";
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  const cw = (opts) => window.WM.createWindow(opts);
  const notify = (t, b) => { if (window.Notify) Notify.show({ icon: window.Icon ? Icon.mini("snip", t) : "", title: t, body: b }); };
  function snips() { const s = State.data; s.appData = s.appData || {}; s.appData.snips = s.appData.snips || []; return s.appData.snips; }

  let h2cLoading = null;
  function loadH2C() {
    if (window.html2canvas) return Promise.resolve(window.html2canvas);
    if (h2cLoading) return h2cLoading;
    h2cLoading = new Promise((res, rej) => {
      const sc = document.createElement("script");
      sc.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
      sc.onload = () => res(window.html2canvas); sc.onerror = () => rej(new Error("load failed"));
      document.head.appendChild(sc);
    });
    return h2cLoading;
  }

  function startSnip(hideWin, onDone) {
    const scr = document.getElementById("screen");
    const ov = el(`<div class="snip-ov"><div class="snip-rect" hidden></div><div class="snip-hint">Drag to select an area &middot; Esc to cancel</div></div>`);
    scr.appendChild(ov);
    const rectEl = ov.querySelector(".snip-rect");
    let sx = 0, sy = 0, drag = false, rect = null;
    const esc = (e) => { if (e.key === "Escape") cleanup(); };
    function cleanup() { ov.remove(); document.removeEventListener("keydown", esc); }
    document.addEventListener("keydown", esc);
    ov.addEventListener("pointerdown", (e) => { drag = true; sx = e.clientX; sy = e.clientY; rectEl.hidden = false; rectEl.style.left = sx + "px"; rectEl.style.top = sy + "px"; rectEl.style.width = "0px"; rectEl.style.height = "0px"; ov.setPointerCapture(e.pointerId); });
    ov.addEventListener("pointermove", (e) => { if (!drag) return; const x = Math.min(sx, e.clientX), y = Math.min(sy, e.clientY), w = Math.abs(e.clientX - sx), h = Math.abs(e.clientY - sy); rect = { x, y, w, h }; rectEl.style.left = x + "px"; rectEl.style.top = y + "px"; rectEl.style.width = w + "px"; rectEl.style.height = h + "px"; });
    ov.addEventListener("pointerup", async () => {
      drag = false;
      if (!rect || rect.w < 8 || rect.h < 8) { cleanup(); return; }
      ov.style.display = "none"; if (hideWin) hideWin.style.visibility = "hidden";
      let h2c;
      try { h2c = await loadH2C(); } catch (e) { cleanup(); if (hideWin) hideWin.style.visibility = ""; notify("Snipping Tool", "Couldn't load the capture engine (offline?)."); return; }
      try {
        const dpr = window.devicePixelRatio || 1;
        const full = await h2c(scr, { backgroundColor: null, logging: false, useCORS: true, scale: dpr });
        const out = document.createElement("canvas"); out.width = Math.round(rect.w * dpr); out.height = Math.round(rect.h * dpr);
        out.getContext("2d").drawImage(full, rect.x * dpr, rect.y * dpr, rect.w * dpr, rect.h * dpr, 0, 0, out.width, out.height);
        const url = out.toDataURL("image/png");
        cleanup(); if (hideWin) hideWin.style.visibility = "";
        onDone(url);
      } catch (e) { cleanup(); if (hideWin) hideWin.style.visibility = ""; notify("Snipping Tool", "Couldn't capture that area."); }
    });
  }

  window.AppRegistry.snip = function () {
    const ref = cw({ title: "Snipping Tool", icon: Icon.mini("snip", "Snipping Tool"), width: 640, height: 540, appId: "snip" });
    const body = ref.body;
    function render(preview) {
      body.innerHTML = `<div class="snip">
        <div class="snip-bar"><button class="snip-new">✂ New</button><span class="muted">Capture a region of the screen</span></div>
        <div class="snip-preview">${preview ? `<img src="${preview}" alt="snip"><div class="snip-actions"><button class="snip-save">Save to Photos</button><button class="snip-copy">Copy</button></div>` : `<div class="snip-empty">No snip yet. Click <b>New</b>, then drag a box on the screen.</div>`}</div>
        <div class="snip-recent"><div class="snip-sec">Recent snips</div><div class="snip-grid"></div></div>
      </div>`;
      const grid = body.querySelector(".snip-grid");
      snips().slice().reverse().forEach((u) => { const t = el(`<button class="snip-thumb"><img src="${u}" alt=""></button>`); t.onclick = () => render(u); grid.appendChild(t); });
      body.querySelector(".snip-new").onclick = () => startSnip(ref.win, (url) => render(url));
      if (preview) {
        body.querySelector(".snip-save").onclick = () => { const arr = snips(); arr.push(preview); if (arr.length > 24) arr.shift(); State.save(); notify("Snipping Tool", "Saved to Photos."); render(preview); };
        body.querySelector(".snip-copy").onclick = async () => {
          try { const blob = await (await fetch(preview)).blob(); await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]); notify("Snipping Tool", "Copied to clipboard."); }
          catch (e) { notify("Snipping Tool", "Copy isn't supported in this browser."); }
        };
      }
    }
    render(null);
  };

  if (window.Icon && Icon.register) {
    Icon.register("snip", `<svg viewBox="0 0 24 24" fill="none" stroke="#5b6b7e" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="7" r="2.2"/><circle cx="6" cy="17" r="2.2"/><path d="M8 8.2 19 16M8 15.8 19 8"/></svg>`);
  }
})();
