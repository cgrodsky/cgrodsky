/* Microsoft Edge PDF viewer (loaded on demand by js/browser.js).

   Renders with pdf.js (vendor/pdfjs, Apache-2.0, loaded lazily the first time a PDF opens) so it works the
   same on iPad Safari, where a PDF inside an <iframe> only shows its first page. Falls back to the
   browser's own viewer (<iframe> on a blob: URL) if pdf.js can't load, or when the user picks it in
   edge://settings ▸ PDF documents.

   Toolbar: page n / N (type a number to jump), zoom (−, presets incl. fit width / fit page, +), rotate,
   Draw and Highlight (pen colours), Erase, Undo, Print (rendered pages + ink → print dialog), Save (the
   original file to Downloads) and Save with ink (a new PDF whose pages are the rendered pages with the
   drawings flattened in). Ink is kept as annotations in normalised page coordinates (0…1 of the page as
   first shown), handed back through o.onAnnotations() and stored by browser.js per file.

   window.EdgePDF = { mount(host, opts) → api, imagesToPdf(pages) → Blob, loadLib() } */
(function () {
  "use strict";
  if (window.EdgePDF) return;
  function el(html) { const d = document.createElement("div"); d.innerHTML = String(html).trim(); return d.firstElementChild; }
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const sv = (d) => `<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const IC = {
    zout: sv('<circle cx="11" cy="11" r="6.5"/><path d="M8 11h6M20 20l-4.2-4.2"/>'), zin: sv('<circle cx="11" cy="11" r="6.5"/><path d="M8 11h6M11 8v6M20 20l-4.2-4.2"/>'),
    fit: sv('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'), rot: sv('<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4h-4"/>'),
    draw: sv('<path d="M4.5 19.5l1-4L16 5l3 3L8.5 18.5z"/><path d="M14 7l3 3"/>'), hl: sv('<path d="M9 14l-3 6h6l1-2"/><path d="M9 14l7-10 4 3-7 10z"/><path d="M4 21h16"/>'),
    erase: sv('<path d="M8.5 19.5l-4-4a1.5 1.5 0 0 1 0-2.1L13.6 4.3a1.5 1.5 0 0 1 2.1 0l4 4a1.5 1.5 0 0 1 0 2.1L11 19.5z"/><path d="M9 9l6 6M8.5 19.5H20"/>'),
    undo: sv('<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'), print: sv('<path d="M7 9V4.5h10V9"/><rect x="4" y="9" width="16" height="7.5" rx="1.5"/><path d="M7 14h10v5.5H7z"/>'),
    save: sv('<path d="M5 4.5h11l3 3V19.5H5z"/><path d="M8 4.5v5h7v-5M8 19.5v-5h8v5"/>'), saveink: sv('<path d="M5 4.5h8M5 4.5v15h6"/><path d="M13.5 19.5l1-3.5 5.5-5.5 2.5 2.5-5.5 5.5z"/>'),
    dl: sv('<path d="M12 4v11"/><path d="M7.5 10.5 12 15l4.5-4.5"/><path d="M5 19.5h14"/>'),
  };
  const PENS = { draw: ["#1b1b1b", "#d13438", "#0f6cbd", "#107c10", "#8764b8"], hl: ["#ffe74c", "#7ef08a", "#73d8ff", "#ff9ad5", "#ffb46b"] };

  // ---------------------------------------------------------------- pdf.js loader
  let libP = null;
  function loadLib(vq) {
    if (window.pdfjsLib && window.pdfjsLib.getDocument) return Promise.resolve(window.pdfjsLib);
    if (libP) return libP;
    libP = new Promise((res, rej) => {
      const s = document.createElement("script"); s.src = "vendor/pdfjs/pdf.min.js" + (vq || "");
      const amd = window.define; let hid = false;
      if (amd && amd.amd) { try { window.define = undefined; hid = true; } catch (_) {} }   // keep the UMD build from registering with an AMD loader
      const restore = () => { if (hid) window.define = amd; };
      s.onload = () => { restore(); const L = window.pdfjsLib; if (!L || !L.getDocument) { libP = null; rej(new Error("The PDF engine didn't start.")); return; } try { L.GlobalWorkerOptions.workerSrc = "vendor/pdfjs/pdf.worker.min.js" + (vq || ""); } catch (_) {} res(L); };
      s.onerror = () => { restore(); libP = null; rej(new Error("The PDF engine (vendor/pdfjs) couldn't be loaded.")); };
      document.head.appendChild(s);
    });
    return libP;
  }

  // ---------------------------------------------------------------- image pages → PDF (DCTDecode JPEG images)
  function imagesToPdf(pages) {
    const enc = new TextEncoder(); const parts = []; let off = 0; const offs = [];
    const push = (x) => { const b = typeof x === "string" ? enc.encode(x) : x; parts.push(b); off += b.length; };
    const n = pages.length;
    push("%PDF-1.4\n%âãÏÓ\n");
    const begin = (id) => { offs[id] = off; push(id + " 0 obj\n"); };
    begin(1); push("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
    begin(2); push(`<< /Type /Pages /Kids [${pages.map((_, i) => (3 + i * 3) + " 0 R").join(" ")}] /Count ${n} >>\nendobj\n`);
    pages.forEach((p, i) => {
      const pid = 3 + i * 3, cid = pid + 1, xid = pid + 2;
      const pw = Math.round(p.pw * 100) / 100, ph = Math.round(p.ph * 100) / 100;
      begin(pid); push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im${i} ${xid} 0 R >> /ProcSet [/PDF /ImageC] >> /Contents ${cid} 0 R >>\nendobj\n`);
      const cs = `q ${pw} 0 0 ${ph} 0 0 cm /Im${i} Do Q`;
      begin(cid); push(`<< /Length ${cs.length} >>\nstream\n${cs}\nendstream\nendobj\n`);
      begin(xid); push(`<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.bytes.length} >>\nstream\n`); push(p.bytes); push("\nendstream\nendobj\n");
    });
    const total = 3 + n * 3, xref = off;
    let x = `xref\n0 ${total}\n0000000000 65535 f \n`; for (let i = 1; i < total; i++) x += String(offs[i]).padStart(10, "0") + " 00000 n \n";
    push(x + `trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    return new Blob(parts, { type: "application/pdf" });
  }

  // normalised point (page as first shown) <-> displayed point for an extra rotation r
  const toView = (x, y, r) => r === 90 ? [1 - y, x] : r === 180 ? [1 - x, 1 - y] : r === 270 ? [y, 1 - x] : [x, y];
  const fromView = (u, v, r) => r === 90 ? [v, 1 - u] : r === 180 ? [1 - u, 1 - v] : r === 270 ? [1 - v, u] : [u, v];
  function drawStrokes(ctx, strokes, W, H, r, scaleW) {
    (strokes || []).forEach((s) => {
      if (!s || !s.p || !s.p.length) return;
      ctx.save();
      ctx.lineCap = s.t === "hl" ? "square" : "round"; ctx.lineJoin = "round";
      ctx.strokeStyle = s.c; ctx.globalAlpha = s.t === "hl" ? 0.38 : 1;
      ctx.lineWidth = Math.max(1, s.w * scaleW);
      ctx.beginPath();
      s.p.forEach((pt, i) => { const v = toView(pt[0], pt[1], r); const X = v[0] * W, Y = v[1] * H; if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); });
      if (s.p.length === 1) { const v = toView(s.p[0][0], s.p[0][1], r); ctx.lineTo(v[0] * W + 0.1, v[1] * H); }
      ctx.stroke(); ctx.restore();
    });
  }

  // ---------------------------------------------------------------- viewer
  function mount(host, o) {
    o = o || {};
    const name = o.name || "document.pdf";
    const blobUrl = URL.createObjectURL(o.blob);
    const st = { dead: false, doc: null, pages: [], n: 0, mode: "width", scale: 1, rot: 0, tool: null, color: { draw: PENS.draw[0], hl: PENS.hl[0] }, ann: {}, undo: [], cur: 1, tasks: new Set() };
    try { const a = o.annotations || {}; Object.keys(a).forEach((k) => { if (Array.isArray(a[k])) st.ann[k] = a[k].filter((s) => s && Array.isArray(s.p)); }); } catch (_) {}
    const notify = (m) => { if (o.notify) o.notify(m); };
    const api = { destroy, print, save: () => o.onSave && o.onSave(o.blob, name), saveWithInk, pages: () => st.n, page: () => st.cur, goto, setTool, setZoom, rotate, undo, annotations: () => st.ann, state: st, engine: "pdfjs" };
    host.__egpdf = api;

    if (o.engine === "native") return nativeView();

    host.innerHTML = `<div class="eg-pdf" tabindex="-1">
      <div class="eg-pdf-bar" role="toolbar" aria-label="PDF tools">
        <span class="eg-pdf-pg"><input class="eg-pdf-n" value="1" inputmode="numeric" aria-label="Page number"><span class="eg-pdf-of">of …</span></span>
        <span class="eg-pdf-sep"></span>
        <button class="eg-ib" data-a="zout" title="Zoom out (Ctrl+−)" aria-label="Zoom out">${IC.zout}</button>
        <select class="eg-pdf-z" aria-label="Zoom"><option value="width">Fit width</option><option value="page">Fit page</option><option value="0.5">50%</option><option value="0.75">75%</option><option value="1">100%</option><option value="1.25">125%</option><option value="1.5">150%</option><option value="2">200%</option><option value="3">300%</option><option value="custom" hidden>—</option></select>
        <button class="eg-ib" data-a="zin" title="Zoom in (Ctrl+=)" aria-label="Zoom in">${IC.zin}</button>
        <button class="eg-ib" data-a="fit" title="Fit to page / width" aria-label="Fit">${IC.fit}</button>
        <button class="eg-ib" data-a="rot" title="Rotate (Ctrl+])" aria-label="Rotate">${IC.rot}</button>
        <span class="eg-pdf-sep"></span>
        <button class="eg-ib" data-a="draw" title="Draw" aria-label="Draw" aria-pressed="false">${IC.draw}</button>
        <button class="eg-ib" data-a="hl" title="Highlight" aria-label="Highlight" aria-pressed="false">${IC.hl}</button>
        <button class="eg-ib" data-a="erase" title="Erase" aria-label="Erase" aria-pressed="false">${IC.erase}</button>
        <span class="eg-pdf-colors" hidden></span>
        <button class="eg-ib" data-a="undo" title="Undo (Ctrl+Z)" aria-label="Undo" disabled>${IC.undo}</button>
        <span class="eg-grow"></span>
        <button class="eg-ib" data-a="print" title="Print (Ctrl+P)" aria-label="Print">${IC.print}</button>
        <button class="eg-ib" data-a="save" title="Save a copy to Downloads (Ctrl+S)" aria-label="Save">${IC.save}</button>
        <button class="eg-ib" data-a="saveink" title="Save a copy with your ink (drawings and highlights)" aria-label="Save with ink">${IC.saveink}</button>
      </div>
      <div class="eg-pdf-scroll"><div class="eg-pdf-pages"><div class="eg-pdf-msg"><span class="eg-spin"></span> Loading ${esc(name)}…</div></div></div>
      <div class="eg-pdf-badge"></div>
    </div>`;
    const root = host.querySelector(".eg-pdf"), bar = root.querySelector(".eg-pdf-bar"), scroll = root.querySelector(".eg-pdf-scroll"), pagesEl = root.querySelector(".eg-pdf-pages");
    const nIn = root.querySelector(".eg-pdf-n"), ofEl = root.querySelector(".eg-pdf-of"), zSel = root.querySelector(".eg-pdf-z"), colors = root.querySelector(".eg-pdf-colors"), badgeEl = root.querySelector(".eg-pdf-badge");
    let badgeT = 0; const badge = (m) => { badgeEl.textContent = m; badgeEl.classList.add("show"); clearTimeout(badgeT); badgeT = setTimeout(() => badgeEl.classList.remove("show"), 1600); };
    bar.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-a]"); if (!b || b.disabled) return;
      const a = b.dataset.a;
      if (a === "zout") stepZoom(-1); else if (a === "zin") stepZoom(1); else if (a === "fit") setZoom(st.mode === "width" ? "page" : "width");
      else if (a === "rot") rotate(); else if (a === "draw" || a === "hl" || a === "erase") setTool(st.tool === a ? null : a);
      else if (a === "undo") undo(); else if (a === "print") print(); else if (a === "save") { if (o.onSave) o.onSave(o.blob, name); } else if (a === "saveink") saveWithInk();
    });
    zSel.onchange = () => setZoom(zSel.value === "width" || zSel.value === "page" ? zSel.value : +zSel.value);
    nIn.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") { goto(parseInt(nIn.value, 10) || 1); nIn.blur(); } });
    nIn.addEventListener("focus", () => nIn.select());
    nIn.addEventListener("blur", () => { nIn.value = String(st.cur); });
    root.addEventListener("keydown", (e) => {
      const mod = e.ctrlKey || e.metaKey, k = (e.key || "").toLowerCase();
      if (mod && k === "z") { e.preventDefault(); e.stopPropagation(); undo(); }
      else if (mod && k === "s") { e.preventDefault(); e.stopPropagation(); if (o.onSave) o.onSave(o.blob, name); }
      else if (mod && (k === "=" || k === "+")) { e.preventDefault(); e.stopPropagation(); stepZoom(1); }
      else if (mod && k === "-") { e.preventDefault(); e.stopPropagation(); stepZoom(-1); }
      else if (mod && k === "]") { e.preventDefault(); e.stopPropagation(); rotate(); }
      else if (!mod && (e.key === "PageDown" || e.key === "PageUp") && e.target === root) { e.preventDefault(); goto(st.cur + (e.key === "PageDown" ? 1 : -1)); }
    });

    // ---- load
    o.blob.arrayBuffer().then((buf) => loadLib(o.vq).then((L) => L.getDocument({ data: new Uint8Array(buf), isEvalSupported: false, useSystemFonts: true }).promise)).then(async (doc) => {
      if (st.dead) { try { doc.destroy(); } catch (_) {} return; }
      st.doc = doc; st.n = doc.numPages;
      const pgs = [];
      for (let i = 1; i <= st.n; i++) pgs.push(await doc.getPage(i));
      if (st.dead) return;
      st.pages = pgs.map((p, i) => { const vp = p.getViewport({ scale: 1 }); return { i: i + 1, page: p, w: vp.width, h: vp.height, el: null, pg: null, ink: null, rendered: 0, task: null }; });
      ofEl.textContent = "of " + st.n;
      build(); layout();
      if (o.onPage) o.onPage(1, st.n);
    }).catch((e) => {
      if (st.dead) return;
      pagesEl.innerHTML = "";
      const m = el(`<div class="eg-pdf-msg"><h3>This PDF couldn't be opened here</h3><p>${esc((e && e.message) || e)}</p><p><button class="eg-btn eg-pdf-native-btn">Open with your device's viewer</button> <button class="eg-btn eg-pdf-dl-btn">Save to Downloads</button></p></div>`);
      m.querySelector(".eg-pdf-native-btn").onclick = () => { host.innerHTML = ""; nativeView(); };
      m.querySelector(".eg-pdf-dl-btn").onclick = () => o.onSave && o.onSave(o.blob, name);
      pagesEl.appendChild(m);
    });

    function build() {
      pagesEl.innerHTML = "";
      st.pages.forEach((p) => {
        p.el = el(`<div class="eg-pdf-page" data-page="${p.i}"><canvas class="pg"></canvas><canvas class="ink"></canvas><span class="eg-pdf-pnum">${p.i}</span></div>`);
        p.pg = p.el.querySelector(".pg"); p.ink = p.el.querySelector(".ink");
        pagesEl.appendChild(p.el);
      });
      st.io = new IntersectionObserver((ents) => ents.forEach((en) => { const p = st.pages.find((x) => x.el === en.target); if (!p) return; p.visible = en.isIntersecting; if (en.isIntersecting) renderPage(p); else releasePage(p); }), { root: scroll, rootMargin: "600px 0px" });
      st.pages.forEach((p) => st.io.observe(p.el));
      scroll.addEventListener("scroll", onScroll, { passive: true });
      wireInk();
      try { st.ro = new ResizeObserver(() => { if (st.mode === "width" || st.mode === "page") { clearTimeout(st.roT); st.roT = setTimeout(layout, 120); } }); st.ro.observe(scroll); } catch (_) {}
    }
    const dims = (p) => (st.rot % 180 === 0 ? [p.w, p.h] : [p.h, p.w]);
    function fitScale() {
      const W = Math.max(100, scroll.clientWidth - 28), H = Math.max(100, scroll.clientHeight - 28);
      const maxW = Math.max(...st.pages.map((p) => dims(p)[0])), first = st.pages[0]; const d = dims(first);
      return st.mode === "page" ? Math.min(W / d[0], H / d[1]) : W / maxW;
    }
    function layout() {
      if (!st.pages.length) return;
      const keep = st.cur;
      st.scale = typeof st.mode === "number" ? st.mode : Math.max(0.2, Math.min(4, fitScale()));
      st.pages.forEach((p) => { const d = dims(p); p.el.style.width = Math.round(d[0] * st.scale) + "px"; p.el.style.height = Math.round(d[1] * st.scale) + "px"; p.rendered = 0; if (p.task) { try { p.task.cancel(); } catch (_) {} p.task = null; } });
      const pct = Math.round(st.scale * 100) + "%";
      if (typeof st.mode === "string") zSel.value = st.mode;
      else { const opt = [...zSel.options].find((x) => +x.value === st.mode); if (opt) zSel.value = opt.value; else { const c = zSel.querySelector('option[value="custom"]'); c.textContent = pct; c.hidden = false; zSel.value = "custom"; } }
      zSel.title = "Zoom: " + pct;
      st.pages.forEach((p) => { if (p.visible) renderPage(p); paintInk(p); });
      requestAnimationFrame(() => { if (keep > 1) goto(keep, true); });
    }
    function renderPage(p) {
      if (st.dead || p.rendered === st.scale * 1000 + st.rot + 0.5 || p.task) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const d = dims(p); let k = dpr; const area = d[0] * d[1] * st.scale * st.scale * k * k; const MAX = 9e6; if (area > MAX) k *= Math.sqrt(MAX / area);
      const vp = p.page.getViewport({ scale: st.scale * k, rotation: (p.page.rotate + st.rot) % 360 });
      const c = document.createElement("canvas"); c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height); c.className = "pg";
      const sig = st.scale * 1000 + st.rot + 0.5;
      p.task = p.page.render({ canvasContext: c.getContext("2d"), viewport: vp });
      p.task.promise.then(() => { p.task = null; if (st.dead) return; p.pg.replaceWith(c); p.pg = c; p.rendered = sig; paintInk(p); if (p.rendered !== st.scale * 1000 + st.rot + 0.5 && p.visible) renderPage(p); }).catch(() => { p.task = null; });
    }
    function releasePage(p) { if (p.task) { try { p.task.cancel(); } catch (_) {} p.task = null; } if (p.rendered) { p.pg.width = 0; p.pg.height = 0; p.rendered = 0; } }
    function paintInk(p) {
      if (!p.el) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = Math.round(parseFloat(p.el.style.width) * dpr), H = Math.round(parseFloat(p.el.style.height) * dpr);
      if (p.ink.width !== W || p.ink.height !== H) { p.ink.width = W; p.ink.height = H; }
      const ctx = p.ink.getContext("2d"); ctx.clearRect(0, 0, W, H);
      const unrotW = st.rot % 180 === 0 ? W : H;
      drawStrokes(ctx, (st.ann[p.i] || []).concat(p.live ? [p.live] : []), W, H, st.rot, unrotW);
    }
    function onScroll() {
      if (st.scT) return;
      st.scT = requestAnimationFrame(() => {
        st.scT = 0; const top = scroll.getBoundingClientRect().top + scroll.clientHeight * 0.3;
        let cur = 1; for (const p of st.pages) { const r = p.el.getBoundingClientRect(); if (r.top <= top) cur = p.i; else break; }
        if (cur !== st.cur) { st.cur = cur; if (document.activeElement !== nIn) nIn.value = String(cur); if (o.onPage) o.onPage(cur, st.n); }
      });
    }
    function goto(n, instant) {
      n = Math.max(1, Math.min(st.n || 1, n | 0)); const p = st.pages[n - 1]; if (!p) return;
      scroll.scrollTop = p.el.offsetTop - 10; st.cur = n; nIn.value = String(n); if (o.onPage) o.onPage(n, st.n);
    }
    function setZoom(z) { st.mode = z; layout(); badge(typeof z === "number" ? Math.round(z * 100) + "%" : z === "width" ? "Fit width" : "Fit page"); }
    function stepZoom(d) { const steps = [0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4]; const cur = st.scale; let nx = d > 0 ? steps.find((s) => s > cur + 0.001) : steps.slice().reverse().find((s) => s < cur - 0.001); setZoom(nx || cur); }
    function rotate() { st.rot = (st.rot + 90) % 360; layout(); badge("Rotated " + st.rot + "°"); }
    function setTool(t) {
      st.tool = t || null;
      bar.querySelectorAll("button[data-a=draw],button[data-a=hl],button[data-a=erase]").forEach((b) => { b.classList.toggle("on", b.dataset.a === st.tool); b.setAttribute("aria-pressed", String(b.dataset.a === st.tool)); });
      root.classList.toggle("drawing", st.tool === "draw" || st.tool === "hl"); root.classList.toggle("erasing", st.tool === "erase");
      colors.hidden = !(st.tool === "draw" || st.tool === "hl");
      if (!colors.hidden) {
        colors.innerHTML = PENS[st.tool].map((c) => `<button class="eg-pdf-c${st.color[st.tool] === c ? " on" : ""}" style="--c:${c}" data-c="${c}" title="${c}" aria-label="Colour ${c}"></button>`).join("");
        colors.querySelectorAll("button").forEach((b) => b.onclick = () => { st.color[st.tool] = b.dataset.c; colors.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b)); });
      }
    }
    let annT = 0;
    function changed() { bar.querySelector("[data-a=undo]").disabled = !st.undo.length; clearTimeout(annT); annT = setTimeout(() => { if (o.onAnnotations) o.onAnnotations(st.ann); }, 250); }
    function undo() {
      const u = st.undo.pop(); if (!u) return;
      const list = st.ann[u.page] || (st.ann[u.page] = []);
      if (u.type === "add") { const i = list.indexOf(u.stroke); if (i >= 0) list.splice(i, 1); }
      else list.splice(Math.min(u.index, list.length), 0, u.stroke);
      const p = st.pages[u.page - 1]; if (p) paintInk(p); changed();
    }
    function wireInk() {
      const at = (p, e) => { const r = p.el.getBoundingClientRect(); const u = (e.clientX - r.left) / r.width, v = (e.clientY - r.top) / r.height; const q = fromView(Math.max(0, Math.min(1, u)), Math.max(0, Math.min(1, v)), st.rot); return [Math.round(q[0] * 10000) / 10000, Math.round(q[1] * 10000) / 10000]; };
      const eraseAt = (p, pt) => {
        const list = st.ann[p.i] || []; let hit = false;
        for (let i = list.length - 1; i >= 0; i--) { const s = list[i]; if (s.p.some((q) => Math.hypot(q[0] - pt[0], (q[1] - pt[1]) * (p.h / p.w)) < Math.max(0.012, s.w))) { st.undo.push({ type: "del", page: p.i, stroke: s, index: i }); list.splice(i, 1); hit = true; } }
        if (hit) { paintInk(p); changed(); }
      };
      pagesEl.addEventListener("pointerdown", (e) => {
        if (!st.tool) return;
        const pe = e.target.closest && e.target.closest(".eg-pdf-page"); if (!pe) return;
        const p = st.pages.find((x) => x.el === pe); if (!p) return;
        if (e.pointerType === "mouse" && e.button) return;
        e.preventDefault(); e.stopPropagation();
        try { pe.setPointerCapture(e.pointerId); } catch (_) {}
        if (st.tool === "erase") {
          eraseAt(p, at(p, e));
          const mv = (ev) => eraseAt(p, at(p, ev));
          const up = () => { pe.removeEventListener("pointermove", mv); pe.removeEventListener("pointerup", up); pe.removeEventListener("pointercancel", up); };
          pe.addEventListener("pointermove", mv); pe.addEventListener("pointerup", up); pe.addEventListener("pointercancel", up);
          return;
        }
        const s = { t: st.tool, c: st.color[st.tool], w: st.tool === "hl" ? 0.022 : 0.0035, p: [at(p, e)] };
        p.live = s; paintInk(p);
        const mv = (ev) => { const evs = ev.getCoalescedEvents ? ev.getCoalescedEvents() : [ev]; (evs.length ? evs : [ev]).forEach((x) => { const q = at(p, x); const l = s.p[s.p.length - 1]; if (Math.hypot(q[0] - l[0], q[1] - l[1]) > 0.0015) s.p.push(q); }); paintInk(p); };
        const up = () => {
          pe.removeEventListener("pointermove", mv); pe.removeEventListener("pointerup", up); pe.removeEventListener("pointercancel", up);
          p.live = null; (st.ann[p.i] = st.ann[p.i] || []).push(s); st.undo.push({ type: "add", page: p.i, stroke: s }); paintInk(p); changed();
        };
        pe.addEventListener("pointermove", mv); pe.addEventListener("pointerup", up); pe.addEventListener("pointercancel", up);
      });
    }
    // render every page (with ink) to canvases, for printing and "save with ink"
    async function renderAll(maxSide, onEach) {
      const out = [];
      for (const p of st.pages) {
        if (st.dead) break;
        const d = dims(p); const k = Math.min(2.2, maxSide / Math.max(d[0], d[1]));
        const vp = p.page.getViewport({ scale: k, rotation: (p.page.rotate + st.rot) % 360 });
        const c = document.createElement("canvas"); c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
        const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
        await p.page.render({ canvasContext: ctx, viewport: vp }).promise;
        drawStrokes(ctx, st.ann[p.i] || [], c.width, c.height, st.rot, st.rot % 180 === 0 ? c.width : c.height);
        const pt = p.page.getViewport({ scale: 1, rotation: (p.page.rotate + st.rot) % 360 });
        out.push(await onEach(c, pt.width, pt.height));
        c.width = 0; c.height = 0;
      }
      return out;
    }
    async function print() {
      if (!st.pages.length) return;
      badge("Preparing to print…");
      const urls = await renderAll(1600, async (c) => c.toDataURL("image/jpeg", 0.9));
      const fr = document.createElement("iframe");
      fr.setAttribute("aria-hidden", "true"); fr.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
      document.body.appendChild(fr);
      const d = fr.contentDocument;
      d.open(); d.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(name)}</title><style>@page{margin:0}html,body{margin:0;padding:0}img{display:block;width:100%;height:auto;break-after:page;page-break-after:always}img:last-child{break-after:auto;page-break-after:auto}</style></head><body>${urls.map((u, i) => `<img src="${u}" alt="Page ${i + 1}">`).join("")}</body></html>`); d.close();
      await Promise.all([...d.images].map((im) => (im.complete ? 0 : new Promise((r) => { im.onload = im.onerror = r; }))));
      try { if (typeof window.__egPrintHook === "function") window.__egPrintHook(fr, urls.length); else { fr.contentWindow.focus(); fr.contentWindow.print(); } } catch (e) { notify("Printing isn't available here."); }
      setTimeout(() => fr.remove(), 60000);
      return urls.length;
    }
    async function saveWithInk() {
      if (!st.pages.length) return null;
      badge("Saving a copy with your ink…");
      const pages = await renderAll(1700, (c, pw, ph) => new Promise((res) => c.toBlob((b) => { b.arrayBuffer().then((ab) => res({ bytes: new Uint8Array(ab), w: c.width, h: c.height, pw, ph })); }, "image/jpeg", 0.88)));
      const blob = imagesToPdf(pages);
      const nm = name.replace(/\.pdf$/i, "") + " (with ink).pdf";
      if (o.onSave) o.onSave(blob, nm);
      return blob;
    }
    function nativeView() {
      api.engine = "native";
      host.innerHTML = `<div class="eg-pdf"><div class="eg-pdf-bar"><b style="padding:0 6px">${esc(name)}</b><span class="eg-grow"></span><button class="eg-ib" data-a="save" title="Save a copy to Downloads" aria-label="Save">${IC.save}</button></div><iframe class="eg-pdf-native" title="${esc(name)}" src="${blobUrl}"></iframe></div>`;
      host.querySelector("[data-a=save]").onclick = () => o.onSave && o.onSave(o.blob, name);
      return api;
    }
    function destroy() {
      st.dead = true;
      st.pages.forEach((p) => { if (p.task) { try { p.task.cancel(); } catch (_) {} } });
      try { if (st.io) st.io.disconnect(); if (st.ro) st.ro.disconnect(); } catch (_) {}
      if (annT) { clearTimeout(annT); if (o.onAnnotations) o.onAnnotations(st.ann); }
      try { if (st.doc) st.doc.destroy(); } catch (_) {}
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    }
    return api;
  }

  window.EdgePDF = { mount, imagesToPdf, loadLib, version: "1" };
})();
