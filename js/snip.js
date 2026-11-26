/* Snipping Tool — screenshots and screen recordings (Windows 11 style).
   Screenshot: Rectangle / Window / Full screen (optional delay). html2canvas (loaded on demand
   from cdnjs) rasterizes the desktop, then it is cropped. Snips save into Photos (appData.snips).
   Record: pick a region (Rectangle / Window / Full screen) → Start → 3-2-1 → recording with a
   floating bar (pause, stop, discard, mic mute) → preview with a start/end trim → saved to
   Videos › Screen Recordings (bytes in IndexedDB), copy / share / download / open in Clipchamp.
   REAL: where the browser can share the screen (getDisplayMedia) the real pixels are recorded
   and cropped to the region on a canvas; system (tab) audio and the microphone can be mixed in.
   Elsewhere (iPad Safari has no getDisplayMedia) the Windows 12 page itself is rendered with
   Game Bar's GBSnap renderer and recorded — clearly labelled "page-only". */
(function () {
  "use strict";
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const cw = (opts) => window.WM.createWindow(opts);
  const scr = () => document.getElementById("screen");
  const notify = (t, b, onClick) => { if (window.Notify) Notify.show({ icon: window.Icon ? Icon.mini("snip", t) : "", title: t, body: b, onClick }); };
  function snips() { const s = State.data; s.appData = s.appData || {}; s.appData.snips = s.appData.snips || []; return s.appData.snips; }
  function prefs() {
    const s = State.data; s.appData = s.appData || {};
    const p = s.appData.snipTool && typeof s.appData.snipTool === "object" ? s.appData.snipTool : (s.appData.snipTool = {});
    if (p.kind !== "rec") p.kind = "shot";
    if (!/^(rect|window|full)$/.test(p.shotMode)) p.shotMode = "rect";
    if (!/^(rect|window|full)$/.test(p.recMode)) p.recMode = "rect";
    if (![0, 3, 5, 10].includes(p.delay)) p.delay = 0;
    if (p.mic == null) p.mic = false;
    if (p.sysAudio == null) p.sysAudio = true;
    return p;
  }
  const save = () => { try { State.save(); } catch (e) {} };
  const K = () => window.CrKit || null;
  const REC_DIR = ["Videos", "Screen Recordings"];
  const canScreen = () => !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
  const canRecord = () => typeof window.MediaRecorder !== "undefined" && !!(window.HTMLCanvasElement && HTMLCanvasElement.prototype.captureStream);
  const fmtT = (s) => { if (!isFinite(s) || s < 0) s = 0; const m = Math.floor(s / 60), x = s - m * 60; return m + ":" + (x < 10 ? "0" : "") + x.toFixed(1); };
  const fmtDur = (s) => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
  const fmtSize = (n) => n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";
  const MODE_NAMES = { rect: "Rectangle", window: "Window", full: "Full screen" };

  let h2cLoading = null;
  function loadH2C() {
    if (window.html2canvas) return Promise.resolve(window.html2canvas);
    if (h2cLoading) return h2cLoading;
    h2cLoading = new Promise((res, rej) => {
      const sc = document.createElement("script");
      sc.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
      sc.onload = () => res(window.html2canvas); sc.onerror = () => { h2cLoading = null; rej(new Error("load failed")); };
      document.head.appendChild(sc);
    });
    return h2cLoading;
  }

  // =====================================================================
  //  Region selection: Rectangle (drag), Window (tap a window), Full screen
  //  Resolves { x, y, w, h } in #screen coordinates, or null when cancelled.
  // =====================================================================
  function selectRegion(mode, hint) {
    const root = scr(), sr = root.getBoundingClientRect();
    if (mode === "full") return Promise.resolve({ x: 0, y: 0, w: root.clientWidth, h: root.clientHeight });
    return new Promise((resolve) => {
      const ov = el(`<div class="snip-ov gbs-skip${mode === "window" ? " snip-ov-win" : ""}"><div class="snip-rect" hidden></div><div class="snip-hint"></div></div>`);
      ov.querySelector(".snip-hint").innerHTML = hint || (mode === "window" ? "Tap or click a window &middot; Esc to cancel" : "Drag to select an area &middot; Esc to cancel");
      root.appendChild(ov);
      const rectEl = ov.querySelector(".snip-rect");
      let sx = 0, sy = 0, drag = false, rect = null;
      const esc = (e) => { if (e.key === "Escape") { e.preventDefault(); finish(null); } };
      function finish(r) { ov.remove(); document.removeEventListener("keydown", esc, true); resolve(r); }
      document.addEventListener("keydown", esc, true);
      const show = (r) => { rectEl.hidden = !r; if (!r) return; rectEl.style.left = r.x + "px"; rectEl.style.top = r.y + "px"; rectEl.style.width = r.w + "px"; rectEl.style.height = r.h + "px"; };
      if (mode === "window") {
        const winAt = (cx, cy) => {
          ov.style.pointerEvents = "none";
          const hit = document.elementsFromPoint(cx, cy).find((n) => n.classList && n.classList.contains("win") && n.style.display !== "none" && !n.classList.contains("snip-hidden"));
          ov.style.pointerEvents = "";
          if (!hit) return null;
          const r = hit.getBoundingClientRect();
          const x = clamp(r.left - sr.left, 0, root.clientWidth), y = clamp(r.top - sr.top, 0, root.clientHeight);
          return { x, y, w: clamp(r.right - sr.left, 0, root.clientWidth) - x, h: clamp(r.bottom - sr.top, 0, root.clientHeight) - y };
        };
        ov.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse") { rect = winAt(e.clientX, e.clientY); show(rect); } });
        ov.addEventListener("pointerup", (e) => { const r = winAt(e.clientX, e.clientY); if (r && r.w > 8 && r.h > 8) finish(r); else { show(null); } });
        return;
      }
      ov.addEventListener("pointerdown", (e) => { drag = true; sx = e.clientX - sr.left; sy = e.clientY - sr.top; rect = null; show({ x: sx, y: sy, w: 0, h: 0 }); try { ov.setPointerCapture(e.pointerId); } catch (_) {} });
      ov.addEventListener("pointermove", (e) => {
        if (!drag) return;
        const cx = clamp(e.clientX - sr.left, 0, root.clientWidth), cy = clamp(e.clientY - sr.top, 0, root.clientHeight);
        rect = { x: Math.min(sx, cx), y: Math.min(sy, cy), w: Math.abs(cx - sx), h: Math.abs(cy - sy) }; show(rect);
      });
      const up = () => { if (!drag) return; drag = false; if (!rect || rect.w < 8 || rect.h < 8) { finish(null); return; } finish(rect); };
      ov.addEventListener("pointerup", up); ov.addEventListener("pointercancel", up);
    });
  }
  function hideWin(w, on) { if (!w) return; w.style.visibility = on ? "hidden" : ""; w.classList.toggle("snip-hidden", !!on); }
  async function delayCountdown(sec) {
    if (!sec) return;
    const t = el(`<div class="snip-delay gbs-skip" role="status"></div>`); scr().appendChild(t);
    for (let i = sec; i > 0; i--) { t.textContent = "Snipping in " + i + "…"; await sleep(1000); }
    t.remove(); await sleep(60);
  }

  // =====================================================================
  //  Screenshot (html2canvas, unchanged behaviour)
  // =====================================================================
  async function captureShot(rect) {
    const root = scr();
    const h2c = await loadH2C();
    const dpr = window.devicePixelRatio || 1;
    const full = await h2c(root, { backgroundColor: null, logging: false, useCORS: true, scale: dpr, ignoreElements: (n) => n.classList && (n.classList.contains("snip-ov") || n.classList.contains("snip-delay")) });
    const out = document.createElement("canvas"); out.width = Math.max(1, Math.round(rect.w * dpr)); out.height = Math.max(1, Math.round(rect.h * dpr));
    out.getContext("2d").drawImage(full, rect.x * dpr, rect.y * dpr, rect.w * dpr, rect.h * dpr, 0, 0, out.width, out.height);
    return out.toDataURL("image/png");
  }
  async function takeShot(winEl, mode, delay, onDone) {
    hideWin(winEl, true);
    try {
      await delayCountdown(delay);
      const rect = await selectRegion(mode);
      if (!rect) return;
      await sleep(30);
      let url;
      try { url = await captureShot(rect); }
      catch (e) { notify("Snipping Tool", e && /load/.test(e.message) ? "Couldn't load the capture engine (offline?)." : "Couldn't capture that area."); return; }
      onDone(url);
    } finally { hideWin(winEl, false); }
  }

  // =====================================================================
  //  Screen recording
  // =====================================================================
  function pickMime(hasAudio) {
    if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return "";
    const list = hasAudio ? ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4"]
      : ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4;codecs=avc1.42E01E", "video/mp4"];
    for (const t of list) { try { if (MediaRecorder.isTypeSupported(t)) return t; } catch (e) {} }
    return "";
  }
  const even = (n) => Math.max(2, Math.round(n / 2) * 2);
  function stamp(d) { const p = (n) => String(n).padStart(2, "0"); return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()); }
  function folderAt(path) {
    const k = K(); if (k && k.folder) return k.folder(path, true);
    let ch = window.VFS ? VFS.ensure() : null; if (!ch) return {};
    path.forEach((seg) => { if (!ch[seg] || ch[seg].type !== "folder") ch[seg] = { type: "folder", children: {} }; ch = ch[seg].children || (ch[seg].children = {}); });
    return ch;
  }
  function uniqueName(kids, name) { if (!kids[name]) return name; const m = name.match(/^(.*?)(\.[^.]+)?$/); let i = 2; while (kids[m[1] + " (" + i + ")" + (m[2] || "")]) i++; return m[1] + " (" + i + ")" + (m[2] || ""); }
  function trySave() { const k = K(); if (k && k.trySave) return k.trySave(); try { State.save(); return true; } catch (e) { return false; } }
  async function saveVideo(name, blob, extra) {
    const node = Object.assign({ type: "file", kind: "video", mime: blob.type, size: blob.size, ts: Date.now(), capture: "snip" }, extra || {});
    let id = null;
    if (window.VFS && VFS.putBlob && window.indexedDB) { try { id = await VFS.putBlob(blob); } catch (e) { id = null; } }
    if (!id) { const e = new Error("no storage"); e.noStore = true; throw e; }
    node.blob = id;
    const kids = folderAt(REC_DIR), fn = uniqueName(kids, name);
    kids[fn] = node;
    if (!trySave()) { delete kids[fn]; trySave(); const e = new Error("quota"); e.quota = true; throw e; }
    try { window.dispatchEvent(new CustomEvent("vfs-change", { detail: { source: "snip" } })); } catch (e) {}
    return { name: fn, node, path: REC_DIR.concat(fn) };
  }
  function listRecordings() {
    const kids = (K() && K().folder ? K().folder(REC_DIR, false) : null) || (function () { let c = window.VFS ? VFS.ensure() : {}; for (const s of REC_DIR) { if (!c[s] || c[s].type !== "folder") return null; c = c[s].children || {}; } return c; })() || {};
    return Object.keys(kids).filter((n) => kids[n] && kids[n].type === "file" && (kids[n].kind === "video" || /^video\//.test(kids[n].mime || ""))).map((name) => ({ name, node: kids[name] })).sort((a, b) => (b.node.ts || 0) - (a.node.ts || 0));
  }
  async function blobOf(node) {
    if (node && node.blob && window.VFS && VFS.getBlob) { try { const b = await VFS.getBlob(node.blob); if (b) return b; } catch (e) {} }
    if (node && node.src && /^(data|blob):/.test(node.src)) { try { return await (await fetch(node.src)).blob(); } catch (e) {} }
    return null;
  }
  function download(blob, name) { const k = K(); if (k && k.download) return k.download(blob, name); const u = URL.createObjectURL(blob), a = document.createElement("a"); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 60000); }
  async function videoFor(stream) {
    const v = document.createElement("video"); v.__gbInternal = true; v.muted = true; v.playsInline = true; v.setAttribute("playsinline", ""); v.srcObject = stream;
    try { await v.play(); } catch (e) {}
    for (let i = 0; i < 60 && !(v.videoWidth && v.readyState >= 2); i++) await sleep(50);
    return v;
  }
  // Map #screen coordinates into the shared surface's pixels.
  function surfaceMap(track, video) {
    const s = (track.getSettings && track.getSettings()) || {}, surf = s.displaySurface || "";
    const vw = video.videoWidth, vh = video.videoHeight, sr = scr().getBoundingClientRect();
    const bx = Math.max(0, (outerWidth - innerWidth) / 2), by = Math.max(0, outerHeight - innerHeight - bx);
    if (surf === "browser" || !surf) { const k = vw / innerWidth; return { k, ky: vh / innerHeight, ox: sr.left * k, oy: sr.top * (vh / innerHeight), exact: true, surf: surf || "browser" }; }
    if (surf === "window") { const k = vw / Math.max(1, outerWidth); return { k, ky: k, ox: (bx + sr.left) * k, oy: (by + sr.top) * k, exact: false, surf }; }
    const k = vw / Math.max(1, screen.width); // monitor
    return { k, ky: vh / Math.max(1, screen.height), ox: ((window.screenX || 0) + bx + sr.left) * k, oy: ((window.screenY || 0) + by + sr.top) * (vh / Math.max(1, screen.height)), exact: (window.screenX || 0) === 0 && (window.screenY || 0) === 0 && outerWidth === innerWidth && outerHeight === innerHeight && screen.width === innerWidth, surf };
  }

  const Rec = { active: null };
  // Start bar shown over the chosen region: Start / mic / system audio / cancel
  function confirmRegion(rect, p) {
    return new Promise((resolve) => {
      const root = scr(), W = root.clientWidth, H = root.clientHeight;
      const frame = el(`<div class="snr-frame gbs-skip"></div>`); place(frame, rect); root.appendChild(frame);
      const fallback = !canScreen();
      const bar = el(`<div class="snr-start gbs-skip" role="toolbar" aria-label="Screen recording">
        <button class="snr-go" data-a="start">Start</button>
        <label class="snr-tg" title="Record your microphone"><input type="checkbox" data-a="mic" ${p.mic ? "checked" : ""}><span>Microphone</span></label>
        ${fallback ? "" : `<label class="snr-tg" title="Record sound from this browser tab (Chrome/Edge: share this tab with audio)"><input type="checkbox" data-a="sys" ${p.sysAudio ? "checked" : ""}><span>System audio</span></label>`}
        <button class="snr-x" data-a="cancel" title="Cancel" aria-label="Cancel">✕</button>
        ${fallback ? `<div class="snr-note">Page-only recording: this browser can't share the screen, so the Windows 12 page itself is recorded (no app audio).</div>` : ""}
      </div>`);
      root.appendChild(bar);
      const bw = bar.offsetWidth || 340, bh = bar.offsetHeight || 46;
      bar.style.left = clamp(rect.x + rect.w / 2 - bw / 2, 8, W - bw - 8) + "px";
      bar.style.top = (rect.y - bh - 12 >= 8 ? rect.y - bh - 12 : rect.y + rect.h + 12 + bh <= H - 8 ? rect.y + rect.h + 12 : rect.y + 12) + "px";
      const done = (v) => { document.removeEventListener("keydown", key, true); bar.remove(); if (!v) frame.remove(); resolve(v ? { frame } : null); };
      const key = (e) => { if (e.key === "Escape") { e.preventDefault(); done(null); } };
      document.addEventListener("keydown", key, true);
      bar.querySelector('[data-a="mic"]').onchange = (e) => { p.mic = e.target.checked; save(); };
      const sys = bar.querySelector('[data-a="sys"]'); if (sys) sys.onchange = (e) => { p.sysAudio = e.target.checked; save(); };
      bar.querySelector('[data-a="cancel"]').onclick = () => done(null);
      bar.querySelector('[data-a="start"]').onclick = () => done(true);
    });
  }
  function place(n, r) { n.style.left = r.x + "px"; n.style.top = r.y + "px"; n.style.width = r.w + "px"; n.style.height = r.h + "px"; }
  async function countdown(rect) {
    const c = el(`<div class="snr-count gbs-skip" aria-live="assertive"></div>`); place(c, rect); scr().appendChild(c);
    for (let i = 3; i > 0; i--) { c.innerHTML = `<span>${i}</span>`; await sleep(800); }
    c.remove(); await sleep(80); // let it leave the shared surface before the first frame
  }

  // Returns a promise of { blob, rect, w, h, duration, mode, poster } or null (cancelled / discarded)
  async function recordScreen(winEl, p) {
    if (Rec.active) return null;
    if (!canRecord()) { notify("Snipping Tool", "This browser can't record video (no MediaRecorder / canvas capture)."); return null; }
    hideWin(winEl, true);
    const stops = [];
    const cleanupAll = () => { stops.splice(0).reverse().forEach((f) => { try { f(); } catch (e) {} }); };
    try {
      const rect = await selectRegion(p.recMode, p.recMode === "window" ? "Tap or click the window to record &middot; Esc to cancel" : "Drag to select the area to record &middot; Esc to cancel");
      if (!rect) return null;
      rect.x = Math.round(rect.x); rect.y = Math.round(rect.y); rect.w = Math.round(rect.w); rect.h = Math.round(rect.h);
      const conf = await confirmRegion(rect, p);
      if (!conf) return null;
      stops.push(() => conf.frame.remove());
      // ---- sources (inside the Start tap) ----
      let mode = "page", disp = null, vid = null, map = null, micNote = "";
      if (canScreen()) {
        try {
          disp = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 30 }, displaySurface: "browser" }, audio: !!p.sysAudio, preferCurrentTab: true, selfBrowserSurface: "include", systemAudio: "include", surfaceSwitching: "exclude" });
          mode = "screen";
          stops.push(() => disp.getTracks().forEach((t) => t.stop()));
        } catch (e) {
          if (e && (e.name === "NotAllowedError" || e.name === "AbortError")) { notify("Recording cancelled", "Screen sharing wasn't allowed, so nothing was recorded."); return null; }
          disp = null; // API present but failing → page-only below
        }
      }
      const atracks = [];
      if (disp) disp.getAudioTracks().forEach((t) => atracks.push(t));
      let micTrack = null;
      if (p.mic) {
        try { const ms = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true } }); micTrack = ms.getAudioTracks()[0]; atracks.push(micTrack); stops.push(() => ms.getTracks().forEach((t) => t.stop())); }
        catch (e) { micNote = "Microphone not available — recording without it."; }
      }
      if (mode === "screen") {
        vid = await videoFor(disp); stops.push(() => { try { vid.srcObject = null; } catch (e) {} });
        if (!vid.videoWidth) { disp.getTracks().forEach((t) => t.stop()); disp = null; mode = "page"; }
        else map = surfaceMap(disp.getVideoTracks()[0], vid);
      }
      if (mode === "page" && !window.GBSnap) { notify("Snipping Tool", "This browser can't record the screen."); cleanupAll(); return null; }
      // ---- output canvas ----
      const root = scr();
      // page-only: render scale — sharp for small regions, capped so a full render stays ~2.5 MP
      const pk = mode === "page" ? Math.max(0.4, Math.min(window.devicePixelRatio || 1, 1.5, 1280 / Math.max(1, rect.w), Math.sqrt(2.5e6 / Math.max(1, root.clientWidth * root.clientHeight)))) : 1;
      const ow = mode === "screen" ? even(rect.w * map.k) : even(rect.w * pk), oh = mode === "screen" ? even(rect.h * map.ky) : even(rect.h * pk);
      const cv = document.createElement("canvas"); cv.width = ow; cv.height = oh;
      const g = cv.getContext("2d"); g.fillStyle = "#000"; g.fillRect(0, 0, ow, oh);
      const cstream = cv.captureStream(30);
      // ---- audio mix ----
      let audio = atracks;
      if (atracks.length > 1) {
        try { const AC = window.AudioContext || window.webkitAudioContext, ac = new AC(), dst = ac.createMediaStreamDestination(); atracks.forEach((t) => ac.createMediaStreamSource(new MediaStream([t])).connect(dst)); audio = dst.stream.getAudioTracks(); stops.push(() => { try { ac.close(); } catch (e) {} }); }
        catch (e) { audio = atracks.slice(0, 1); }
      }
      // ---- frame pump ----
      const R = { mode, rect, ow, oh, frames: 0, running: true, paused: false, t0: 0, acc: 0, discard: false, micTrack, map };
      stops.push(() => { R.running = false; });
      if (mode === "page") {
        // page-only: start rendering during the countdown (overlays are .gbs-skip), so the clip
        // begins with a real frame instead of black
        let first; const firstFrame = new Promise((r) => { first = r; });
        (async () => {
          while (R.running) {
            if (R.paused) { await sleep(120); continue; }
            try {
              const r = await GBSnap.render({ scale: pk });
              if (!R.running) break;
              const k = r.canvas.width / Math.max(1, r.W);
              g.drawImage(r.canvas, rect.x * k, rect.y * k, rect.w * k, rect.h * k, 0, 0, ow, oh); R.frames++; R.pageMode = r.mode; first();
            } catch (e) { await sleep(250); }
            await sleep(15);
          }
        })();
        await countdown(rect);
        await Promise.race([firstFrame, sleep(4000)]);
      } else {
        await countdown(rect);
        const draw = () => { if (!R.running || R.paused || !vid.videoWidth) return; try { g.drawImage(vid, map.ox + rect.x * map.k, map.oy + rect.y * map.ky, rect.w * map.k, rect.h * map.ky, 0, 0, ow, oh); R.frames++; } catch (e) {} };
        draw(); const iv = setInterval(draw, 33); stops.push(() => clearInterval(iv));
      }
      const mime = pickMime(audio.length > 0);
      const stream = new MediaStream(cstream.getVideoTracks().concat(audio));
      stops.push(() => cstream.getTracks().forEach((t) => t.stop()));
      let mr; try { mr = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: mode === "page" ? 2500000 : 5000000 } : undefined); } catch (e) { mr = new MediaRecorder(stream); }
      const chunks = [];
      mr.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      const stopped = new Promise((res) => { mr.onstop = res; });
      mr.start(1000); R.t0 = performance.now(); Rec.active = R;
      if (disp) disp.getVideoTracks()[0].addEventListener("ended", () => stopRec());
      if (micNote) notify("Snipping Tool", micNote);
      // ---- floating bar ----
      const elapsed = () => R.acc + (R.paused ? 0 : performance.now() - R.t0);
      const bar = el(`<div class="snr-bar gbs-skip" role="toolbar" aria-label="Recording controls">
        <span class="snr-dot"></span><span class="snr-time">0:00</span>
        ${mode === "page" ? `<span class="snr-mode" title="This browser can't share the screen, so the Windows 12 page itself is being recorded">Page-only</span>` : ""}
        <button class="snr-b" data-a="pause" title="Pause" aria-label="Pause"><svg viewBox="0 0 24 24" width="16" height="16"><path d="M8 5v14M16 5v14" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg></button>
        <button class="snr-b snr-stop" data-a="stop" title="Stop" aria-label="Stop recording"><svg viewBox="0 0 24 24" width="16" height="16"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/></svg></button>
        <button class="snr-b" data-a="mic" title="${micTrack ? "Mute microphone" : "Microphone is off"}" aria-label="Microphone" ${micTrack ? "" : "disabled"}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>${micTrack ? "" : '<path d="M4 4l16 16"/>'}</svg></button>
        <button class="snr-b" data-a="discard" title="Discard recording" aria-label="Discard recording"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/></svg></button>
      </div>`);
      root.appendChild(bar); stops.push(() => bar.remove());
      const W = root.clientWidth, H = root.clientHeight, bw = bar.offsetWidth || 260, bh = bar.offsetHeight || 44;
      bar.style.left = clamp(rect.x + rect.w / 2 - bw / 2, 8, W - bw - 8) + "px";
      bar.style.top = (rect.y - bh - 12 >= 8 ? rect.y - bh - 12 : rect.y + rect.h + 12 + bh <= H - 8 ? rect.y + rect.h + 12 : 8) + "px";
      const tick = setInterval(() => { bar.querySelector(".snr-time").textContent = fmtDur(elapsed() / 1000); }, 250); stops.push(() => clearInterval(tick));
      function stopRec() { if (!R.running) return; R.running = false; if (!R.paused) R.acc += performance.now() - R.t0; try { if (mr.state === "paused") mr.resume(); mr.requestData(); } catch (e) {} try { mr.stop(); } catch (e) {} }
      R.stop = stopRec;
      bar.querySelector('[data-a="stop"]').onclick = stopRec;
      bar.querySelector('[data-a="discard"]').onclick = () => { R.discard = true; stopRec(); };
      const pb = bar.querySelector('[data-a="pause"]');
      pb.onclick = () => {
        if (!R.running) return;
        if (!R.paused) { R.paused = true; R.acc += performance.now() - R.t0; try { mr.pause(); } catch (e) {} pb.title = "Resume"; pb.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="12" r="6" fill="#e0393e"/></svg>'; bar.classList.add("paused"); }
        else { R.paused = false; R.t0 = performance.now(); try { mr.resume(); } catch (e) {} pb.title = "Pause"; pb.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M8 5v14M16 5v14" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>'; bar.classList.remove("paused"); }
      };
      const mb = bar.querySelector('[data-a="mic"]'); mb.onclick = () => { if (!micTrack) return; micTrack.enabled = !micTrack.enabled; mb.classList.toggle("off", !micTrack.enabled); mb.title = micTrack.enabled ? "Mute microphone" : "Unmute microphone"; };
      await stopped;
      let poster = null; try { const t = document.createElement("canvas"), k = Math.min(1, 320 / Math.max(ow, oh)); t.width = Math.max(1, Math.round(ow * k)); t.height = Math.max(1, Math.round(oh * k)); t.getContext("2d").drawImage(cv, 0, 0, t.width, t.height); poster = t.toDataURL("image/jpeg", 0.75); } catch (e) {}
      cleanupAll();
      Rec.active = null;
      if (R.discard) { notify("Snipping Tool", "Recording discarded."); return null; }
      const type = ((mr.mimeType || mime || "video/webm").split(";")[0]) || "video/webm";
      let blob = new Blob(chunks, { type });
      if (!blob.size) { notify("Snipping Tool", "No video was recorded."); return null; }
      const duration = R.acc / 1000;
      if (/webm/.test(type) && window.WebmFix) blob = await WebmFix.fix(blob, R.acc);
      return { blob, rect, w: ow, h: oh, duration, mode, pageMode: R.pageMode || "", poster, frames: R.frames, exact: mode === "page" || (map && map.exact), surface: map ? map.surf : "page" };
    } catch (e) {
      cleanupAll(); Rec.active = null;
      notify("Snipping Tool", "The recording couldn't start: " + esc((e && e.message) || e));
      return null;
    } finally { hideWin(winEl, false); }
  }

  // Re-encode [tin, tout] of a video in real time (canvas + MediaRecorder), like Clipchamp's export.
  async function exportTrim(url, tin, tout, onProgress, isCancelled) {
    const ev = document.createElement("video"); ev.playsInline = true; ev.preload = "auto"; ev.src = url; ev.__gbInternal = true;
    ev.style.cssText = "position:fixed;left:-10px;top:-10px;width:2px;height:2px;opacity:0;pointer-events:none"; document.body.appendChild(ev);
    let actx = null;
    const once = (t, n, ms) => new Promise((res) => { let to; const f = () => { clearTimeout(to); t.removeEventListener(n, f); res(true); }; t.addEventListener(n, f); to = setTimeout(() => { t.removeEventListener(n, f); res(false); }, ms || 4000); });
    try {
      await once(ev, "loadeddata", 6000);
      const c = document.createElement("canvas"); c.width = even(ev.videoWidth || 640); c.height = even(ev.videoHeight || 360);
      const g = c.getContext("2d"); g.fillStyle = "#000"; g.fillRect(0, 0, c.width, c.height);
      const stream = c.captureStream(30);
      try { const AC = window.AudioContext || window.webkitAudioContext; actx = new AC(); const src = actx.createMediaElementSource(ev), dst = actx.createMediaStreamDestination(); src.connect(dst); dst.stream.getAudioTracks().forEach((t) => stream.addTrack(t)); } catch (e) { actx = null; ev.muted = true; }
      const hasA = stream.getAudioTracks().length > 0, mime = pickMime(hasA);
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4000000 }) : new MediaRecorder(stream);
      const chunks = []; rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      const stopped = new Promise((r) => (rec.onstop = r));
      ev.currentTime = tin; await once(ev, "seeked", 3000);
      g.drawImage(ev, 0, 0, c.width, c.height);
      rec.start(250);
      try { await ev.play(); } catch (e) { ev.muted = true; await ev.play(); }
      const t0 = performance.now();
      await new Promise((res) => {
        const frame = () => {
          if (isCancelled && isCancelled()) return res();
          g.drawImage(ev, 0, 0, c.width, c.height);
          onProgress && onProgress(clamp((ev.currentTime - tin) / Math.max(0.01, tout - tin), 0, 1));
          if (ev.currentTime >= tout || ev.ended || performance.now() - t0 > (tout - tin) * 1000 + 4000) return res();
          setTimeout(frame, 33);
        };
        frame();
      });
      ev.pause(); try { rec.requestData(); } catch (e) {} rec.stop(); await stopped;
      if (isCancelled && isCancelled()) return null;
      const type = ((rec.mimeType || mime || "video/webm").split(";")[0]);
      let blob = new Blob(chunks, { type });
      if (/webm/.test(type) && window.WebmFix) blob = await WebmFix.fix(blob, (tout - tin) * 1000);
      return { blob, w: c.width, h: c.height };
    } finally { try { ev.pause(); ev.removeAttribute("src"); ev.load(); ev.remove(); } catch (e) {} try { if (actx) actx.close(); } catch (e) {} }
  }

  // =====================================================================
  //  The app window
  // =====================================================================
  const IC = {
    cam: '<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M8.5 7l1.5-2.5h4L15.5 7"/><circle cx="12" cy="13.5" r="3.6"/>',
    vid: '<rect x="3" y="6" width="13" height="12" rx="2.5"/><path d="M16 10l5-3v10l-5-3"/>',
  };
  const ic = (n, s) => `<svg viewBox="0 0 24 24" width="${s || 18}" height="${s || 18}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n] || ""}</svg>`;

  window.AppRegistry.snip = function (opts) {
    const o = opts && typeof opts === "object" ? opts : {};
    const ref = cw({ title: "Snipping Tool", icon: Icon.mini("snip", "Snipping Tool"), width: Math.min(700, innerWidth - 20), height: Math.min(580, innerHeight - 90), appId: "snip" });
    const body = ref.body, winEl = body.closest(".win");
    const p = prefs();
    let view = null;          // { type:"shot", url } | { type:"rec", name, node, url, blob }
    let busy = false, cancelExport = false;
    const api = { last: null };

    function render() {
      const isRec = p.kind === "rec";
      const mode = isRec ? p.recMode : p.shotMode;
      body.innerHTML = `<div class="snip">
        <div class="snip-bar">
          <button class="snip-new">✂ New</button>
          <div class="snip-seg" role="radiogroup" aria-label="Capture type"><button class="snip-k${!isRec ? " on" : ""}" data-k="shot" role="radio" aria-checked="${!isRec}" title="Screenshot">${ic("cam")}</button><button class="snip-k${isRec ? " on" : ""}" data-k="rec" role="radio" aria-checked="${isRec}" title="Screen recording">${ic("vid")}</button></div>
          <select class="snip-mode" aria-label="${isRec ? "Recording" : "Snipping"} mode">${["rect", "window", "full"].map((m) => `<option value="${m}" ${m === mode ? "selected" : ""}>${MODE_NAMES[m]}</option>`).join("")}</select>
          ${isRec ? "" : `<select class="snip-delay-sel" aria-label="Delay">${[0, 3, 5, 10].map((d) => `<option value="${d}" ${d === p.delay ? "selected" : ""}>${d ? d + " seconds" : "No delay"}</option>`).join("")}</select>`}
          <span class="muted snip-sub">${isRec ? (canScreen() ? "Record a region of the screen" : "Record (page-only on this browser)") : "Capture a region of the screen"}</span>
        </div>
        <div class="snip-preview"></div>
        <div class="snip-recent"><div class="snip-sec">${isRec ? "Recent screen recordings" : "Recent snips"}</div><div class="snip-grid"></div></div>
      </div>`;
      const $ = (s) => body.querySelector(s);
      $(".snip-new").onclick = () => (p.kind === "rec" ? doRecord() : doShot());
      body.querySelectorAll(".snip-k").forEach((b) => b.onclick = () => { p.kind = b.dataset.k; save(); if (view && view.type !== (p.kind === "rec" ? "rec" : "shot")) view = null; render(); });
      $(".snip-mode").onchange = (e) => { if (p.kind === "rec") p.recMode = e.target.value; else p.shotMode = e.target.value; save(); };
      const ds = $(".snip-delay-sel"); if (ds) ds.onchange = (e) => { p.delay = +e.target.value; save(); };
      paintPreview(); paintRecent();
    }
    function paintRecent() {
      const grid = body.querySelector(".snip-grid"); if (!grid) return; grid.innerHTML = "";
      if (p.kind === "rec") {
        const recs = listRecordings().slice(0, 12);
        if (!recs.length) grid.appendChild(el(`<span class="muted snip-none">Recordings you make are saved to Videos › Screen Recordings.</span>`));
        recs.forEach((r) => {
          const t = el(`<button class="snip-thumb snip-vthumb" title="${esc(r.name)}">${r.node.poster ? `<img src="${r.node.poster}" alt="">` : ic("vid", 22)}<span>${r.node.duration ? fmtDur(r.node.duration) : ""}</span></button>`);
          t.onclick = () => openRecording(r.name, r.node);
          grid.appendChild(t);
        });
      } else {
        snips().slice().reverse().forEach((u) => { const t = el(`<button class="snip-thumb"><img src="${u}" alt=""></button>`); t.onclick = () => { view = { type: "shot", url: u }; paintPreview(); }; grid.appendChild(t); });
      }
    }
    function paintPreview() {
      const pv = body.querySelector(".snip-preview"); if (!pv) return;
      if (view && view.url && view.type === "rec" && view.video && pv.contains(view.video)) return;
      pv.innerHTML = "";
      if (!view) {
        pv.appendChild(el(p.kind === "rec"
          ? `<div class="snip-empty">No recording yet. Click <b>New</b>, choose the area, then press <b>Start</b>.${canScreen() ? "" : "<br><small>This browser can't share the screen, so the Windows 12 page itself is recorded (page-only).</small>"}</div>`
          : `<div class="snip-empty">No snip yet. Click <b>New</b>, then drag a box on the screen.</div>`));
        return;
      }
      if (view.type === "shot") {
        pv.appendChild(el(`<img src="${view.url}" alt="snip">`));
        const acts = el(`<div class="snip-actions"><button class="snip-save">Save to Photos</button><button class="snip-copy">Copy</button></div>`);
        pv.appendChild(acts);
        acts.querySelector(".snip-save").onclick = () => { const arr = snips(); arr.push(view.url); if (arr.length > 24) arr.shift(); State.save(); notify("Snipping Tool", "Saved to Photos."); paintRecent(); };
        acts.querySelector(".snip-copy").onclick = async () => {
          try { const blob = await (await fetch(view.url)).blob(); await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]); notify("Snipping Tool", "Copied to clipboard."); }
          catch (e) { notify("Snipping Tool", "Copy isn't supported in this browser."); }
        };
        return;
      }
      paintVideo(pv);
    }
    function paintVideo(pv) {
      const v = view, n = v.node;
      const info = (n.w && n.h ? n.w + " × " + n.h + " · " : "") + (n.duration ? fmtDur(n.duration) + " · " : "") + (n.size ? fmtSize(n.size) : "");
      const box = el(`<div class="snip-vbox">
        <div class="snip-vhead"><b class="snip-vname"></b><span class="muted">${esc(info)}</span>${n.source === "page" ? `<span class="snip-badge" title="This browser can't share the screen, so the Windows 12 page itself was recorded">Page-only</span>` : n.source === "screen-estimated" ? `<span class="snip-badge" title="The whole screen was shared, so the region's position was estimated. Share this tab for exact framing.">Estimated framing</span>` : ""}</div>
        <video class="snip-video" controls playsinline preload="auto"></video>
        <div class="snip-trim" aria-label="Trim"><div class="snip-track"><div class="snip-shade l"></div><div class="snip-shade r"></div><div class="snip-win"><i class="snip-h l" title="Drag to set the start"></i><i class="snip-h r" title="Drag to set the end"></i></div><div class="snip-ph"></div></div>
          <div class="snip-trim-row"><span class="snip-trim-info"></span><span class="snip-grow"></span><button class="snip-btn" data-a="reset">Reset</button><button class="snip-btn snip-primary" data-a="trim" disabled>Save trimmed copy</button></div></div>
        <div class="snip-actions snip-vacts"><button data-a="copy">Copy</button><button data-a="share">Share</button><button data-a="dl">Download</button><button data-a="cc">Edit in Clipchamp</button><button data-a="folder">Show in folder</button></div>
        <div class="snip-exp" hidden><div class="snip-expbox"><b>Saving trimmed copy…</b><div class="snip-bar2"><i></i></div><button class="snip-btn" data-a="cancel">Cancel</button></div></div>
      </div>`);
      box.querySelector(".snip-vname").textContent = v.name;
      pv.appendChild(box);
      const video = box.querySelector(".snip-video"); v.video = video; video.__gbInternal = true;
      if (n.poster) video.poster = n.poster;
      video.src = v.url;
      const dur = () => n.duration || (isFinite(video.duration) ? video.duration : 0);
      let tin = 0, tout = dur();
      const track = box.querySelector(".snip-track"), win = box.querySelector(".snip-win"), ph = box.querySelector(".snip-ph");
      const layout = () => {
        const d = dur(); if (!d) return; if (!tout) tout = d;
        const W = track.clientWidth, x0 = tin / d * W, x1 = tout / d * W;
        win.style.left = x0 + "px"; win.style.width = Math.max(2, x1 - x0) + "px";
        box.querySelector(".snip-shade.l").style.width = x0 + "px"; box.querySelector(".snip-shade.r").style.left = x1 + "px";
        ph.style.left = clamp(video.currentTime / d, 0, 1) * W + "px";
        box.querySelector(".snip-trim-info").textContent = fmtT(tin) + " → " + fmtT(tout) + "  (" + fmtT(tout - tin) + ")";
        box.querySelector('[data-a="trim"]').disabled = !(tin > 0.05 || tout < d - 0.05) || !canRecord();
      };
      v.setTrim = (a, b) => { const d = dur(); tin = clamp(a, 0, d); tout = clamp(b, tin + 0.2, d); layout(); };
      v.trim = () => ({ tin, tout });
      video.addEventListener("loadedmetadata", layout);
      video.addEventListener("timeupdate", () => { if (!video.paused && video.currentTime >= tout - 0.03 && tout < dur() - 0.05) { video.pause(); video.currentTime = tout; } layout(); });
      video.addEventListener("play", () => { if (video.currentTime < tin || video.currentTime >= tout - 0.05) video.currentTime = tin; });
      track.addEventListener("pointerdown", (e) => {
        const d = dur(); if (!d) return; e.preventDefault(); try { track.setPointerCapture(e.pointerId); } catch (_) {}
        const h = e.target.classList.contains("snip-h") ? (e.target.classList.contains("l") ? "in" : "out") : "seek";
        const at = (ev) => { const r = track.getBoundingClientRect(); return clamp((ev.clientX - r.left) / r.width, 0, 1) * d; };
        const mv = (ev) => { const t = at(ev); if (h === "in") { tin = clamp(t, 0, tout - 0.2); video.currentTime = tin; } else if (h === "out") { tout = clamp(t, tin + 0.2, d); video.currentTime = tout; } else video.currentTime = t; layout(); };
        const up = () => { track.removeEventListener("pointermove", mv); track.removeEventListener("pointerup", up); track.removeEventListener("pointercancel", up); };
        track.addEventListener("pointermove", mv); track.addEventListener("pointerup", up); track.addEventListener("pointercancel", up); mv(e);
      });
      const ro = new ResizeObserver(layout); ro.observe(track); winEl.addEventListener("wm-cleanup", () => ro.disconnect());
      layout();
      const act = (a) => box.querySelector(`[data-a="${a}"]`);
      act("reset").onclick = () => { tin = 0; tout = dur(); layout(); };
      act("trim").onclick = async () => {
        if (busy) return; busy = true; cancelExport = false;
        const ex = box.querySelector(".snip-exp"), bar = box.querySelector(".snip-bar2 i"); ex.hidden = false; video.pause();
        try {
          const r = await exportTrim(v.url, tin, tout, (f) => { bar.style.width = (f * 100).toFixed(1) + "%"; }, () => cancelExport);
          if (!r) return;
          const ext = /mp4/.test(r.blob.type) ? ".mp4" : ".webm";
          const res = await saveVideo(v.name.replace(/\.[^.]+$/, "") + " (trimmed)" + ext, r.blob, { w: r.w, h: r.h, duration: Math.round((tout - tin) * 10) / 10, poster: n.poster, source: n.source });
          notify("Snipping Tool", "Saved " + esc(res.name) + " to Videos › Screen Recordings.");
          await openRecording(res.name, res.node);
        } catch (e) { notify("Snipping Tool", e && e.quota ? "Storage is full — use Download instead." : "Couldn't save the trimmed copy."); }
        finally { busy = false; const x = box.querySelector(".snip-exp"); if (x) x.hidden = true; }
      };
      act("cancel").onclick = () => { cancelExport = true; };
      act("copy").onclick = async () => {
        try { if (!window.ClipboardItem || !navigator.clipboard || !navigator.clipboard.write) throw new Error("no"); await navigator.clipboard.write([new ClipboardItem({ [v.blob.type]: v.blob })]); notify("Snipping Tool", "Copied to clipboard."); }
        catch (e) { notify("Snipping Tool", "This browser can't put a video on the clipboard. Use Share or Download instead."); }
      };
      act("share").onclick = async () => {
        const f = new File([v.blob], v.name, { type: v.blob.type });
        if (navigator.canShare && navigator.share) { try { if (navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: v.name }); return; } } catch (e) { if (e && e.name === "AbortError") return; } }
        download(v.blob, v.name); notify("Snipping Tool", "Sharing files isn't supported here, so the video was downloaded.");
      };
      act("dl").onclick = () => download(v.blob, v.name);
      act("cc").onclick = () => { if (AppRegistry.clipchamp) AppRegistry.clipchamp({ url: v.url, name: v.name }); };
      act("folder").onclick = () => { if (window.FilesHelper) FilesHelper.open(REC_DIR.slice()); else { window.FilesStartPath = REC_DIR.slice(); WM.open("fileexplorer"); } };
    }
    async function openRecording(name, node) {
      const blob = await blobOf(node);
      if (!blob) { notify("Snipping Tool", "This recording's video isn't on this device."); return; }
      if (view && view.url && view.type === "rec") URL.revokeObjectURL(view.url);
      view = { type: "rec", name, node, blob, url: URL.createObjectURL(blob) };
      if (p.kind !== "rec") { p.kind = "rec"; save(); render(); } else { paintPreview(); paintRecent(); }
    }
    async function doShot() {
      if (busy) return;
      busy = true;
      try { await takeShot(winEl, p.shotMode, p.delay, (url) => { view = { type: "shot", url }; api.last = { type: "shot", url }; }); }
      finally { busy = false; if (winEl.isConnected) { render(); } }
    }
    async function doRecord() {
      if (busy || Rec.active) return;
      busy = true;
      let r = null;
      try { r = await recordScreen(winEl, p); } finally { busy = false; }
      if (!r) { if (winEl.isConnected) render(); return; }
      const ext = /mp4/.test(r.blob.type) ? ".mp4" : ".webm";
      const name = "Screen Recording " + stamp(new Date()) + ext;
      const source = r.mode === "page" ? "page" : r.exact ? "screen" : "screen-estimated";
      try {
        const res = await saveVideo(name, r.blob, { w: r.w, h: r.h, duration: Math.round(r.duration * 10) / 10, poster: r.poster || undefined, source, region: r.rect });
        api.last = { type: "rec", name: res.name, w: r.w, h: r.h, mode: r.mode, duration: r.duration, frames: r.frames, size: r.blob.size, mime: r.blob.type, surface: r.surface };
        const how = r.mode === "page" ? "Page-only recording of the Windows 12 screen" : "Screen recording";
        notify("Screen recording saved", esc(res.name) + " · " + fmtDur(r.duration) + "<br><small>" + esc(how) + " · Videos › Screen Recordings</small>", () => { if (window.VFS) VFS.openNode(res.name, res.node); });
        try { if (window.EventLog && EventLog.add) EventLog.add("Application", "Information", "SnippingTool", 2001, "Screen recording saved: Videos\\Screen Recordings\\" + res.name + " (" + r.w + "×" + r.h + ", " + r.mode + ")."); } catch (e) {}
        if (winEl.isConnected) { p.kind = "rec"; await openRecording(res.name, res.node); }
      } catch (e) {
        download(r.blob, name);
        api.last = { type: "rec", name, w: r.w, h: r.h, mode: r.mode, downloaded: true };
        notify("Screen recording downloaded", e && e.quota ? "Storage is full, so the recording was downloaded instead." : "It couldn't be kept in Videos, so it was downloaded instead.");
        if (winEl.isConnected) render();
      }
    }
    const onVfs = (e) => { if (e && e.detail && e.detail.source === "snip") return; if (p.kind === "rec") paintRecent(); };
    window.addEventListener("vfs-change", onVfs);
    winEl.addEventListener("wm-cleanup", () => { window.removeEventListener("vfs-change", onVfs); cancelExport = true; if (view && view.url && view.type === "rec") setTimeout(() => URL.revokeObjectURL(view.url), 1000); });
    api.win = winEl; api.prefs = p; api.record = doRecord; api.shot = doShot; api.openRecording = openRecording; api.view = () => view; api.stop = () => { if (Rec.active && Rec.active.stop) Rec.active.stop(); };
    winEl.__snip = api;
    render();
    if (o.record) doRecord();
    return api;
  };

  // Win+Shift+R (not on Apple keyboards, where Cmd+Shift+R reloads): start a screen recording
  (function () {
    const UA = navigator.userAgent || "";
    const isApple = /Mac|iPhone|iPad|iPod/.test(navigator.platform || "") || (/Macintosh/.test(UA) && "ontouchend" in document);
    window.addEventListener("keydown", (e) => {
      if (isApple || !e.metaKey || !e.shiftKey || e.ctrlKey || e.altKey || e.code !== "KeyR") return;
      if (!document.querySelector(".desktop")) return;
      e.preventDefault(); e.stopPropagation();
      if (Rec.active) { if (Rec.active.stop) Rec.active.stop(); return; }
      AppRegistry.snip({ record: true });
    }, true);
  })();

  window.SnipTool = { isRecording: () => !!Rec.active, stop: () => { if (Rec.active && Rec.active.stop) Rec.active.stop(); }, recordings: listRecordings, selectRegion };

  if (window.Icon && Icon.register) {
    Icon.register("snip", `<svg viewBox="0 0 24 24" fill="none" stroke="#5b6b7e" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="7" r="2.2"/><circle cx="6" cy="17" r="2.2"/><path d="M8.2 8.2 19 16M8.2 15.8 19 8"/></svg>`);
  }
})();
