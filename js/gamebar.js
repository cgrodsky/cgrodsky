/* Xbox Game Bar (Windows 11 style) for Windows 12.
   Open with Win+G or Ctrl+Alt+G (or Start → "Xbox Game Bar"). A translucent overlay with
   movable widgets: Capture, Audio, Performance, Gallery, Xbox Social / Achievements, Settings.
   Widgets can be pinned so they stay on screen after the overlay closes; layout is remembered
   in State.data.appData.gamebar.

   Shortcuts: Win+Alt+PrtScn / Ctrl+Alt+Shift+S  screenshot
              Win+Alt+R      / Ctrl+Alt+Shift+R  start / stop recording   (Ctrl+Alt+R is Run)

   What is REAL here:
   - Screenshots / recordings use the browser's screen sharing (getDisplayMedia + MediaRecorder)
     where it exists (desktop browsers). Where it doesn't (iPad Safari), the Windows 12 page itself
     is rendered into a canvas (DOM → SVG foreignObject → canvas, see GBSnap below) and that is
     labelled "page-only". Files go to Pictures/Screenshots and Videos/Captures (bytes in IndexedDB).
   - FPS, frame time, long tasks, JS heap (Chrome), cores, device memory (browser-rounded), DOM size,
     storage use are measured from browser APIs; anything estimated is labelled "est.".
   - The audio mixer changes the real volume / mute of <audio>/<video> elements apps are playing.
   - Achievements come from js/achievements.js. There is no Xbox network here, so no friends are shown.

   Also exports window.GBSnap (the page → canvas renderer) for Recall (js/recall.js). */
(function () {
  "use strict";
  if (window.GameBar) return;
  const S = () => State.data;
  const scr = () => document.getElementById("screen");
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const UA = navigator.userAgent || "";
  const isApple = /Mac|iPhone|iPad|iPod/.test(navigator.platform || "") || (/Macintosh/.test(UA) && "ontouchend" in document);
  const isWebKit = /AppleWebKit/.test(UA) && !/(Chrome|Chromium|CriOS|Edg|OPR|Android)/.test(UA);
  const desktopReady = () => !!document.querySelector(".desktop") && !document.querySelector(".lock-screen, .boot-layer, .wsetup-screen");
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
  const TRANSPARENT = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
  function mkCanvas(w, h) { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
  const toBlob = (c, type, q) => new Promise((res) => { try { c.toBlob((b) => res(b), type, q); } catch (e) { res(null); } });
  const blobToDataURL = (b) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => res(null); r.readAsDataURL(b); });
  function loadImage(src) { return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error("image")); im.src = src; }); }
  function absUrl(u, base) { try { return new URL(u, base || document.baseURI).href; } catch (e) { return u; } }
  const fmtSize = (n) => n >= 1073741824 ? (n / 1073741824).toFixed(1) + " GB" : n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : n >= 1024 ? Math.round(n / 1024) + " KB" : (n | 0) + " B";
  const fmtDur = (s) => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };

  // =====================================================================
  //  GBSnap — render the Windows 12 screen (#screen) into a canvas
  //  Clone the DOM, sanitize it (no passwords, no scripts/iframes, current input values,
  //  canvases/videos/images inlined as data URLs, scroll offsets kept), wrap it with the page's
  //  CSS in an SVG <foreignObject>, draw that SVG into a canvas. If the browser refuses (tainted
  //  canvas / broken SVG) a simplified painter draws wallpaper + window frames + canvases instead.
  // =====================================================================
  const GBSnap = (function () {
    // ---- inlined resources (cached) ----
    const cache = new Map();
    function remember(k, p) { cache.set(k, p); if (cache.size > 220) cache.delete(cache.keys().next().value); return p; }
    async function shrink(b) {
      if (!b) return null;
      if (!/^image\//.test(b.type) || /svg/.test(b.type) || b.size < 350000) return blobToDataURL(b);
      try {
        const u = URL.createObjectURL(b); const im = await loadImage(u); URL.revokeObjectURL(u);
        const k = Math.min(1, 1920 / Math.max(im.naturalWidth, im.naturalHeight));
        const c = mkCanvas(im.naturalWidth * k, im.naturalHeight * k); c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
        return c.toDataURL(b.type === "image/png" ? "image/png" : "image/jpeg", 0.86);
      } catch (e) { return blobToDataURL(b); }
    }
    function inlineUrl(u) {
      if (!u) return Promise.resolve(null);
      if (/^data:/i.test(u)) return Promise.resolve(u);
      if (cache.has(u)) return cache.get(u);
      const p = fetch(u, { credentials: "same-origin" }).then((r) => (r.ok ? r.blob() : null)).then(shrink).catch(() => null);
      return remember(u, p);
    }
    function imgData(n) {
      const src = n.currentSrc || n.src || "";
      if (!src) return Promise.resolve(null);
      if (/^data:/i.test(src)) return Promise.resolve(src);
      if (cache.has(src)) return cache.get(src);
      if (n.complete && n.naturalWidth && !/\.svg(\?|#|$)/i.test(src)) {
        try { // copy the pixels of the already-loaded image (no network); throws for cross-origin
          const want = Math.max(256, 2 * Math.max(n.offsetWidth, n.offsetHeight));
          const k = Math.min(1, want / Math.max(n.naturalWidth, n.naturalHeight));
          const c = mkCanvas(n.naturalWidth * k, n.naturalHeight * k);
          c.getContext("2d").drawImage(n, 0, 0, c.width, c.height);
          const d = /\.jpe?g(\?|#|$)/i.test(src) ? c.toDataURL("image/jpeg", 0.88) : c.toDataURL("image/png");
          return remember(src, Promise.resolve(d));
        } catch (e) { /* cross-origin: fall through to fetch (works only when CORS allows it) */ }
      }
      return inlineUrl(src);
    }
    const URL_RE = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;
    async function replaceUrls(str, base) {
      const found = []; let m; URL_RE.lastIndex = 0;
      while ((m = URL_RE.exec(str))) found.push(m);
      if (!found.length) return str;
      const data = await Promise.all(found.map((x) => /^data:/i.test(x[2]) ? x[2] : inlineUrl(absUrl(x[2].trim(), base))));
      let out = "", last = 0;
      found.forEach((x, i) => { out += str.slice(last, x.index) + (data[i] ? 'url("' + data[i] + '")' : "none"); last = x.index + x[0].length; });
      return out + str.slice(last);
    }

    // ---- the page's CSS, rewritten for a wrapper <div> (html/body/:root → classes) ----
    let cssCache = null;
    function sheetsKey() {
      let k = "";
      for (const s of document.styleSheets) { let n = -1; try { n = s.cssRules.length; } catch (e) {} k += (s.href || "inline") + "#" + n + (s.disabled ? "d" : "") + "|"; }
      return k;
    }
    function rewriteSel(sel) {
      return sel.replace(/(^|[\s,>+~(])(html|body)(?![\w-])/gi, (m, p, t) => p + (t.toLowerCase() === "html" ? ".gbs-html" : ".gbs-body")).replace(/:root(?![\w-])/g, ".gbs-html");
    }
    function collect(rules, base, out) {
      for (const r of rules) {
        try {
          if (r.type === 1) {
            const sel = rewriteSel(r.selectorText), body = r.style.cssText;
            if (body.indexOf("url(") < 0) { out.push(sel + "{" + body + "}"); continue; }
            out.push(sel + "{");
            let last = 0, m; URL_RE.lastIndex = 0;
            while ((m = URL_RE.exec(body))) {
              out.push(body.slice(last, m.index));
              if (/^data:/i.test(m[2])) out.push(m[0]); else out.push({ url: absUrl(m[2].trim(), base), sel: r.selectorText });
              last = m.index + m[0].length;
            }
            out.push(body.slice(last) + "}");
          } else if (r.type === 4) { out.push("@media " + r.media.mediaText + "{"); collect(r.cssRules, base, out); out.push("}"); }
          else if (r.type === 12) { out.push("@supports " + r.conditionText + "{"); collect(r.cssRules, base, out); out.push("}"); }
          else if (r.type === 3) { if (r.styleSheet) collect(r.styleSheet.cssRules, r.styleSheet.href || base, out); }
          else if (r.type === 5 || r.type === 6 || r.type === 7) { /* @font-face, @page, @keyframes: not needed in a still frame */ }
          else if (r.cssRules) { const t = r.cssText; out.push(t.slice(0, t.indexOf("{")) + "{"); collect(r.cssRules, base, out); out.push("}"); }
        } catch (e) { /* unreadable rule */ }
      }
    }
    function getCss() {
      const key = sheetsKey();
      if (cssCache && cssCache.key === key) return cssCache;
      const out = [];
      for (const s of document.styleSheets) {
        let rules; try { rules = s.cssRules; } catch (e) { continue; } // cross-origin (web fonts)
        if (!rules || s.disabled) continue;
        const media = s.media && s.media.mediaText;
        if (media && media !== "all") out.push("@media " + media + "{");
        collect(rules, s.href || document.baseURI, out);
        if (media && media !== "all") out.push("}");
      }
      const parts = []; let buf = "";
      out.forEach((p) => { if (typeof p === "string") buf += p; else { parts.push(buf); buf = ""; parts.push(p); } });
      parts.push(buf);
      cssCache = { key, parts };
      return cssCache;
    }
    const DYN_PSEUDO = /::?(?:before|after|hover|focus-within|focus-visible|focus|active|visited|placeholder|selection|marker|first-line|first-letter|backdrop|-webkit-[\w-]+|-moz-[\w-]+)(?:\([^)]*\))?/g;
    async function resolveCss() {
      const { parts } = getCss();
      const seen = new Map();
      const used = (sel) => {
        if (seen.has(sel)) return seen.get(sel);
        let ok = false; try { ok = !!document.querySelector(sel.replace(DYN_PSEUDO, "") || "*"); } catch (e) { ok = false; }
        seen.set(sel, ok); return ok;
      };
      const out = await Promise.all(parts.map((p) => typeof p === "string" ? p : (used(p.sel) ? inlineUrl(p.url).then((d) => (d ? 'url("' + d + '")' : "none")) : "none")));
      return out.join("");
    }
    const EXTRA_CSS = "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}" +
      ".gbs-skip{display:none!important}" +
      ".gbs-frame{display:flex!important;align-items:center;justify-content:center;background:repeating-linear-gradient(135deg,#d9dde3 0 10px,#cfd4db 10px 20px)!important;color:#3d4450!important;font:600 13px system-ui,sans-serif!important;overflow:hidden}" +
      ".gbs-filtered{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:6px;background:linear-gradient(135deg,#5b6472,#2f3540);color:#fff;font:600 15px system-ui,sans-serif;border-radius:inherit}" +
      ".gbs-filtered small{font-weight:400;opacity:.8;font-size:12px}";

    // ---- secrets: password-like fields are always blanked ----
    function isSecret(n) {
      if (!n || !n.getAttribute) return false;
      const t = (n.getAttribute("type") || "").toLowerCase();
      if (t === "password" || n.type === "password" || n.hasAttribute("data-pw-eye")) return true;
      const ac = (n.getAttribute("autocomplete") || "").toLowerCase();
      if (/password|cc-|one-time-code/.test(ac)) return true;
      const nm = ((n.getAttribute("name") || "") + " " + (n.id || "") + " " + (n.getAttribute("placeholder") || "")).toLowerCase();
      return /pass(word|code)|\bpwd\b|\bpin\b|cvv|cvc|card ?number|\bssn\b|\botp\b/.test(nm);
    }
    function copyBoxStyle(dst, n, c) {
      for (const a of Array.from(c.attributes)) if (a.name === "class" || a.name === "style") dst.setAttribute(a.name, a.value);
      let cs = null; try { cs = getComputedStyle(n); } catch (e) {}
      if (cs) ["display", "position", "top", "left", "right", "bottom", "margin", "transform", "zIndex", "borderRadius", "objectFit", "verticalAlign"].forEach((p) => { try { if (cs[p]) dst.style[p] = cs[p]; } catch (e) {} });
      if (dst.style.display === "inline") dst.style.display = "inline-block";
      dst.style.width = n.offsetWidth + "px"; dst.style.height = n.offsetHeight + "px";
    }
    function canvasData(n, scale) {
      try {
        if (!n.width || !n.height) return null;
        const tw = Math.max(32, Math.round((n.offsetWidth || n.width) * Math.min(2, Math.max(0.6, scale * 1.25))));
        const k = Math.min(1, tw / n.width);
        const c = mkCanvas(n.width * k, n.height * k); c.getContext("2d").drawImage(n, 0, 0, c.width, c.height);
        return c.width * c.height > 250000 ? c.toDataURL("image/jpeg", 0.85) : c.toDataURL("image/png");
      } catch (e) { return null; }
    }
    function videoData(n, scale) {
      try {
        if (n.readyState < 2 || !n.videoWidth) return null;
        const tw = Math.max(64, Math.round((n.offsetWidth || n.videoWidth) * Math.min(2, Math.max(0.6, scale * 1.25))));
        const k = Math.min(1, tw / n.videoWidth);
        const c = mkCanvas(n.videoWidth * k, n.videoHeight * k); c.getContext("2d").drawImage(n, 0, 0, c.width, c.height);
        return c.toDataURL("image/jpeg", 0.85);
      } catch (e) { return null; }
    }
    function filterWin(c) {
      c.innerHTML = '<div class="gbs-filtered">Filtered<small>Hidden by your privacy settings</small></div>';
      c.style.overflow = "hidden";
    }

    async function renderDom(root, W, H, scale, opts) {
      const L = root.querySelectorAll("*");
      const clone = root.cloneNode(true);
      const C = clone.querySelectorAll("*");
      if (C.length !== L.length) throw new Error("clone mismatch");
      const jobs = [];
      for (let i = 0; i < L.length; i++) {
        const n = L[i], c = C[i], cls = n.classList, tag = n.tagName;
        const skipKids = () => { i += n.getElementsByTagName("*").length; };
        if (cls && cls.contains("gbs-skip")) { c.remove(); skipKids(); continue; }
        if (cls && cls.contains("win")) {
          if (n.style.display === "none" || cls.contains("wx-offdesk") || (opts.hide && opts.hide(n))) { c.remove(); skipKids(); continue; }
          if (opts.exclude && opts.exclude(n)) { filterWin(c); skipKids(); continue; }
        }
        if (tag === "SCRIPT" || tag === "LINK" || tag === "NOSCRIPT" || tag === "TEMPLATE") { c.remove(); skipKids(); continue; }
        if (n.scrollTop || n.scrollLeft) { const t = (-n.scrollLeft) + "px " + (-n.scrollTop) + "px"; for (const ch of Array.from(c.children)) { try { ch.style.translate = t; } catch (e) {} } }
        if (tag === "IMG") {
          c.removeAttribute("srcset"); c.removeAttribute("loading"); c.removeAttribute("onerror"); c.removeAttribute("onload");
          if (n.style.display === "none") { c.remove(); continue; }
          if (!(n.complete && n.naturalWidth)) { c.setAttribute("src", TRANSPARENT); continue; }
          jobs.push(imgData(n).then((d) => c.setAttribute("src", d || TRANSPARENT)));
          continue;
        }
        if (tag === "CANVAS" || tag === "VIDEO") {
          const img = document.createElement("img"); copyBoxStyle(img, n, c);
          if (tag === "VIDEO") img.style.background = "#000";
          img.setAttribute("src", (tag === "CANVAS" ? canvasData(n, scale) : videoData(n, scale)) || TRANSPARENT);
          c.replaceWith(img); skipKids(); continue;
        }
        if (tag === "AUDIO") { c.remove(); skipKids(); continue; }
        if (tag === "IFRAME" || tag === "OBJECT" || tag === "EMBED") {
          const d = document.createElement("div"); copyBoxStyle(d, n, c); d.classList.add("gbs-frame");
          let label = ""; try { label = (n.contentDocument && n.contentDocument.title) || ""; } catch (e) {}
          d.textContent = (label ? label + " — " : "") + "embedded web content (not captured)";
          c.replaceWith(d); skipKids(); continue;
        }
        if (tag === "INPUT") {
          const t = (n.type || "").toLowerCase();
          if (t === "checkbox" || t === "radio") { if (n.checked) c.setAttribute("checked", ""); else c.removeAttribute("checked"); }
          else if (t !== "file" && t !== "hidden") c.setAttribute("value", isSecret(n) ? "" : n.value);
          continue;
        }
        if (tag === "TEXTAREA") { c.textContent = isSecret(n) ? "" : n.value; continue; }
        if (tag === "SELECT") { for (let k = 0; k < c.options.length; k++) { if (n.options[k] && n.options[k].selected) c.options[k].setAttribute("selected", ""); else c.options[k].removeAttribute("selected"); } continue; }
        if (tag === "image") {
          const h = n.getAttribute("href") || n.getAttribute("xlink:href");
          if (h && !/^data:/i.test(h)) jobs.push(inlineUrl(absUrl(h)).then((d) => { c.setAttribute("href", d || TRANSPARENT); c.removeAttribute("xlink:href"); }));
        }
        if (n.isContentEditable && c.removeAttribute) c.removeAttribute("contenteditable");
      }
      [clone].concat(Array.from(clone.querySelectorAll('[style*="url("]'))).forEach((c) => {
        const st = c.getAttribute("style"); if (!st || st.indexOf("url(") < 0) return;
        jobs.push(replaceUrls(st, document.baseURI).then((s) => c.setAttribute("style", s)));
      });
      const cssP = resolveCss();
      await Promise.all(jobs);
      const css = await cssP;
      // wrapper that stands in for <html> and <body>
      const he = document.documentElement, be = document.body;
      const wrap = document.createElement("div");
      wrap.className = ("gbs-html " + he.className).trim();
      wrap.setAttribute("style", (he.getAttribute("style") || "") + ";width:" + W + "px;height:" + H + "px;overflow:hidden;position:relative;margin:0;padding:0");
      const bd = document.createElement("div");
      bd.className = ("gbs-body " + be.className).trim();
      bd.setAttribute("style", (be.getAttribute("style") || "") + ";width:100%;height:100%;overflow:hidden;position:relative;margin:0;padding:0");
      const st = document.createElement("style"); st.textContent = css + EXTRA_CSS;
      wrap.appendChild(st); wrap.appendChild(bd); bd.appendChild(clone);
      const xhtml = new XMLSerializer().serializeToString(wrap);
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '"><foreignObject x="0" y="0" width="100%" height="100%">' + xhtml + "</foreignObject></svg>";
      const img = await loadImage("data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg));
      if (img.decode) { try { await img.decode(); } catch (e) {} }
      const cv = mkCanvas(W * scale, H * scale), g = cv.getContext("2d");
      g.fillStyle = "#000"; g.fillRect(0, 0, cv.width, cv.height);
      g.drawImage(img, 0, 0, cv.width, cv.height);
      if (isWebKit) { await sleep(60); g.drawImage(img, 0, 0, cv.width, cv.height); } // WebKit can paint inlined images late
      g.getImageData(0, 0, 1, 1); // throws SecurityError if the browser tainted the canvas
      return cv;
    }

    // ---- fallback: a simplified painting of the desktop ----
    function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
    function cleanCopy(src) { // a copy of src's pixels if they are readable (never taints our canvas)
      try {
        const w = src.videoWidth || src.naturalWidth || src.width, h = src.videoHeight || src.naturalHeight || src.height;
        if (!w || !h) return null;
        const k = Math.min(1, 900 / Math.max(w, h));
        const c = mkCanvas(w * k, h * k), g = c.getContext("2d"); g.drawImage(src, 0, 0, c.width, c.height); g.getImageData(0, 0, 1, 1);
        return c;
      } catch (e) { return null; }
    }
    async function renderSimple(root, W, H, scale, opts) {
      const cv = mkCanvas(W * scale, H * scale), g = cv.getContext("2d");
      g.scale(scale, scale); g.fillStyle = "#0b1a33"; g.fillRect(0, 0, W, H);
      const sr = root.getBoundingClientRect();
      const desk = root.querySelector(".desktop");
      if (desk) {
        const cs = getComputedStyle(desk);
        if (cs.backgroundColor && !/rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor)) { g.fillStyle = cs.backgroundColor; g.fillRect(0, 0, W, H); }
        const m = /url\(["']?([^"')]+)["']?\)/.exec(cs.backgroundImage || "");
        if (m) { try { const d = await inlineUrl(absUrl(m[1])); if (d) { const im = await loadImage(d); const k = Math.max(W / im.naturalWidth, H / im.naturalHeight); g.drawImage(im, (W - im.naturalWidth * k) / 2, (H - im.naturalHeight * k) / 2, im.naturalWidth * k, im.naturalHeight * k); } } catch (e) {} }
      }
      const dark = document.body.classList.contains("dark");
      const wins = (window.WM && WM.windows ? WM.windows() : []).filter((e) => e.win.isConnected && e.win.style.display !== "none" && !e.win.classList.contains("wx-offdesk") && !e.win.classList.contains("gbs-skip") && !(opts.hide && opts.hide(e.win)))
        .sort((a, b) => (+a.win.style.zIndex || 0) - (+b.win.style.zIndex || 0));
      for (const e of wins) {
        const r = e.win.getBoundingClientRect(), x = r.left - sr.left, y = r.top - sr.top;
        g.save(); rr(g, x, y, r.width, r.height, 8); g.fillStyle = dark ? "#242424" : "#f9f9f9"; g.shadowColor = "rgba(0,0,0,.35)"; g.shadowBlur = 18; g.fill(); g.shadowBlur = 0; g.clip();
        if (opts.exclude && opts.exclude(e.win)) {
          g.fillStyle = "#3b424e"; g.fillRect(x, y, r.width, r.height); g.fillStyle = "#fff"; g.font = "600 15px system-ui, sans-serif"; g.textAlign = "center"; g.fillText("Filtered", x + r.width / 2, y + r.height / 2); g.textAlign = "left";
        } else {
          g.fillStyle = dark ? "#2d2d2d" : "#eeeeee"; g.fillRect(x, y, r.width, 34);
          g.fillStyle = dark ? "#f3f3f3" : "#1b1b1b"; g.font = "13px system-ui, sans-serif";
          const t = e.win.querySelector(".win-titlebar .t-text"); g.fillText(((t && t.textContent) || e.title || "").trim().slice(0, 80), x + 12, y + 22);
          const body = e.win.querySelector(".win-body");
          const lines = ((body && body.innerText) || "").split(/\n+/).map((s) => s.trim()).filter(Boolean).slice(0, Math.max(0, Math.floor((r.height - 50) / 18)));
          g.fillStyle = dark ? "#cfcfcf" : "#444"; g.font = "12px system-ui, sans-serif";
          lines.forEach((ln, i) => g.fillText(ln.slice(0, Math.floor(r.width / 6.5)), x + 14, y + 56 + i * 18));
          e.win.querySelectorAll("canvas, video, img").forEach((m) => {
            const q = m.getBoundingClientRect(); if (q.width < 40 || q.height < 40 || m.style.display === "none") return;
            const cp = cleanCopy(m); if (cp) g.drawImage(cp, q.left - sr.left, q.top - sr.top, q.width, q.height);
          });
        }
        g.restore();
      }
      const tb = root.querySelector(".taskbar");
      if (tb && tb.offsetHeight) {
        const r = tb.getBoundingClientRect();
        g.fillStyle = dark ? "rgba(32,32,32,.9)" : "rgba(243,243,243,.9)"; rr(g, r.left - sr.left, r.top - sr.top, r.width, r.height, 8); g.fill();
        const clk = root.querySelector(".tb-clock"); g.fillStyle = dark ? "#fff" : "#111"; g.font = "12px system-ui, sans-serif"; g.textAlign = "right";
        if (clk) g.fillText((clk.innerText || "").split("\n")[0], r.right - sr.left - 14, r.top - sr.top + r.height / 2 + 4); g.textAlign = "left";
      }
      return cv;
    }

    let lastMode = "";
    async function render(opts) {
      opts = opts || {};
      const t0 = performance.now(), root = scr();
      const W = Math.max(1, root.clientWidth), H = Math.max(1, root.clientHeight), scale = opts.scale || 1;
      let canvas = null, mode = "page";
      if (!opts.simple) { try { canvas = await renderDom(root, W, H, scale, opts); } catch (e) { canvas = null; } }
      if (!canvas) { canvas = await renderSimple(root, W, H, scale, opts); mode = "simplified"; }
      lastMode = mode;
      return { canvas, mode, W, H, ms: Math.round(performance.now() - t0) };
    }
    return { render, isSecret, lastMode: () => lastMode, inlineUrl };
  })();
  window.GBSnap = GBSnap;

  // =====================================================================
  //  Settings / layout state  (State.data.appData.gamebar)
  // =====================================================================
  const DEFAULT_OPEN = ["capture", "audio", "perf", "social"];
  function gb() {
    const d = S(); d.appData = d.appData || {};
    let g = d.appData.gamebar; if (!g || typeof g !== "object") g = d.appData.gamebar = {};
    if (!g.widgets || typeof g.widgets !== "object") g.widgets = {};
    g.settings = Object.assign({ source: "screen", mic: false, sysAudio: true, maxMin: 30 }, g.settings || {});
    if (!g.appVol || typeof g.appVol !== "object") g.appVol = {};
    if (!Array.isArray(g.recent)) g.recent = [];
    return g;
  }
  function wstate(id) { const g = gb(); return g.widgets[id] || (g.widgets[id] = { open: DEFAULT_OPEN.indexOf(id) >= 0, pinned: false }); }
  function save() { try { State.save(); } catch (e) {} }
  const canScreen = () => !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
  const useScreen = () => canScreen() && gb().settings.source !== "page";

  // =====================================================================
  //  Icons (line icons, currentColor)
  // =====================================================================
  const P = {
    xbox: '<circle cx="12" cy="12" r="9"/><path d="M7.5 6.5c2.5 2 6.5 7 7.5 11M16.5 6.5c-2.5 2-6.5 7-7.5 11"/>',
    camera: '<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M8.5 7l1.5-2.5h4L15.5 7"/><circle cx="12" cy="13.5" r="3.6"/>',
    rec: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.2" fill="currentColor" stroke="none"/>',
    stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="2" fill="currentColor" stroke="none"/>',
    history: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/><path d="M12 8v4l3 2"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
    micoff: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M4 4l16 16"/>',
    audio: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
    mute: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>',
    perf: '<path d="M3 20h18"/><path d="M5 16l4-5 4 3 6-8"/>',
    gallery: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.8"/><path d="M4 17l5-4 3 2.5 4-4 4 4"/>',
    social: '<circle cx="9" cy="8.5" r="3.3"/><path d="M3 19.5c.6-3.4 3-5.3 6-5.3s5.4 1.9 6 5.3"/><circle cx="17" cy="9.5" r="2.5"/><path d="M16.5 14.4c2.4.2 4 1.8 4.5 4.6"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>',
    pin: '<path d="M9 4h6l-1 5 3 3H7l3-3z"/><path d="M12 12v8"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    folder: '<path d="M3.5 7a1.5 1.5 0 0 1 1.5-1.5h4l2 2h8a1.5 1.5 0 0 1 1.5 1.5v8.5a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5z"/>',
    trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
    open: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none"/>',
  };
  const ic = (n, s) => '<svg class="gb-ic" viewBox="0 0 24 24" width="' + (s || 18) + '" height="' + (s || 18) + '" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[n] || "") + "</svg>";

  // =====================================================================
  //  Helpers: windows, names, saving to the file system
  // =====================================================================
  const wins = () => (window.WM && WM.windows ? WM.windows() : []);
  function visibleWins() { return wins().filter((e) => e.win.isConnected && e.win.style.display !== "none" && !e.win.classList.contains("wx-offdesk")).sort((a, b) => (+b.win.style.zIndex || 0) - (+a.win.style.zIndex || 0)); }
  function titleOf(e) { const t = e && e.win.querySelector(".win-titlebar .t-text"); return (t && t.textContent.trim()) || (e && (e.title || e.appId)) || "Window"; }
  function stamp(d) { const p = (n) => String(n).padStart(2, "0"); return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + "-" + p(d.getMinutes()) + "-" + p(d.getSeconds()); }
  function captureBase() { const e = visibleWins()[0]; return ((e ? titleOf(e) : "Desktop").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 40) || "Desktop") + " " + stamp(new Date()); }
  function notify(title, body, onClick) { try { if (window.Notify) Notify.show({ icon: window.Icon ? Icon.mini("gamebar", "Xbox Game Bar") : "", title: esc(title), body, onClick }); } catch (e) {} }
  function folderAt(path) {
    const K = window.CrKit; if (K && K.folder) return K.folder(path, true);
    let ch = window.VFS ? VFS.ensure() : ((S().appData.files = S().appData.files || { root: {} }).root);
    path.forEach((seg) => { if (!ch[seg] || ch[seg].type !== "folder") ch[seg] = { type: "folder", children: {} }; if (!ch[seg].children) ch[seg].children = {}; ch = ch[seg].children; });
    return ch;
  }
  function uniqueName(kids, name) {
    if (!kids[name]) return name;
    const m = name.match(/^(.*?)(\.[^.]+)?$/); let i = 2;
    while (kids[m[1] + " (" + i + ")" + (m[2] || "")]) i++;
    return m[1] + " (" + i + ")" + (m[2] || "");
  }
  function persist() { const K = window.CrKit; if (K && K.trySave) return K.trySave(); try { State.save(); return true; } catch (e) { return false; } }
  function vfsChanged() { try { window.dispatchEvent(new CustomEvent("vfs-change", { detail: { source: "gamebar" } })); } catch (e) {} }
  async function saveCapture(dir, name, blob, kind, extra) {
    const node = Object.assign({ type: "file", kind, mime: blob.type, size: blob.size, ts: Date.now(), capture: "gamebar" }, extra || {});
    let id = null;
    if (window.VFS && VFS.putBlob && window.indexedDB) { try { id = await VFS.putBlob(blob); } catch (e) { id = null; } }
    if (id) node.blob = id;
    else if (kind === "image" && blob.size < 1.5e6) node.src = await blobToDataURL(blob);
    else { const e = new Error("no storage"); e.noStore = true; throw e; }
    const kids = folderAt(dir), finalName = uniqueName(kids, name);
    kids[finalName] = node;
    if (!persist()) { delete kids[finalName]; persist(); const e = new Error("quota"); e.quota = true; throw e; }
    vfsChanged();
    return { name: finalName, node, path: dir.concat(finalName) };
  }
  function download(blob, name) { const K = window.CrKit; if (K && K.download) return K.download(blob, name); const u = URL.createObjectURL(blob), a = document.createElement("a"); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 60000); }
  function thumbOf(canvas, max) { const k = Math.min(1, (max || 320) / Math.max(canvas.width, canvas.height)); const c = mkCanvas(canvas.width * k, canvas.height * k), g = c.getContext("2d"); g.fillStyle = "#000"; g.fillRect(0, 0, c.width, c.height); g.drawImage(canvas, 0, 0, c.width, c.height); return c.toDataURL("image/jpeg", 0.75); }
  function openNode(name, node) { try { if (window.VFS && VFS.openNode) VFS.openNode(name, node); } catch (e) {} }
  function showInFiles(path) { window.FilesStartPath = path; if (window.WM) WM.open("fileexplorer"); }
  function flash() { const f = el('<div class="gb-flash gbs-skip"></div>'); scr().appendChild(f); setTimeout(() => f.remove(), 450); }

  // =====================================================================
  //  Capture: screenshots + recordings
  // =====================================================================
  const Rec = { active: false, starting: false };
  let shotBusy = false;
  function frameFrom(video) { const c = mkCanvas(video.videoWidth, video.videoHeight); c.getContext("2d").drawImage(video, 0, 0); return c; }
  async function videoFor(stream) {
    const v = document.createElement("video"); v.__gbInternal = true; v.muted = true; v.playsInline = true; v.setAttribute("playsinline", ""); v.srcObject = stream;
    try { await v.play(); } catch (e) {}
    for (let i = 0; i < 40 && !(v.videoWidth && v.readyState >= 2); i++) await sleep(50);
    return v;
  }
  async function grabScreen() {
    const stream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: "browser" }, audio: false, selfBrowserSurface: "include", surfaceSwitching: "exclude" });
    const hidden = [];
    try {
      document.querySelectorAll(".gb-overlay, .gb-widget, .gb-recbar").forEach((x) => { hidden.push([x, x.style.visibility]); x.style.visibility = "hidden"; });
      const v = await videoFor(stream);
      await nextFrame(); await nextFrame(); await sleep(260); // let the overlay disappear from the shared surface
      if (!v.videoWidth) throw new Error("no frame");
      return frameFrom(v);
    } finally { stream.getTracks().forEach((t) => t.stop()); hidden.forEach(([x, vis]) => { x.style.visibility = vis; }); }
  }
  async function screenshot() {
    if (shotBusy || !desktopReady()) return;
    shotBusy = true; refreshCaptureUI();
    const base = captureBase();
    try {
      let canvas = null, source = "";
      if (Rec.active && Rec.mode === "screen" && Rec.video && Rec.video.videoWidth) { canvas = frameFrom(Rec.video); source = "screen"; }
      else if (useScreen()) {
        try { canvas = await grabScreen(); source = "screen"; }
        catch (e) {
          if (e && (e.name === "NotAllowedError" || e.name === "AbortError")) { notify("Screenshot cancelled", "Screen sharing wasn't allowed, so no screenshot was taken."); return; }
          canvas = null; // API present but failed (e.g. headless) → page capture below
        }
      }
      if (!canvas) { const r = await GBSnap.render({ scale: Math.min(2, window.devicePixelRatio || 1) }); canvas = r.canvas; source = r.mode; }
      flash();
      const blob = await toBlob(canvas, "image/png");
      if (!blob) throw new Error("encode");
      const label = source === "screen" ? "Real screen pixels (browser screen sharing)" : source === "page" ? "Page-only capture of the Windows 12 screen" : "Simplified page capture (this browser can't render the page into an image)";
      let res;
      try { res = await saveCapture(["Pictures", "Screenshots"], base + ".png", blob, "image", { src: thumbOf(canvas, 320), w: canvas.width, h: canvas.height, source }); }
      catch (e) { download(blob, base + ".png"); notify("Screenshot downloaded", "Storage is full, so the screenshot was downloaded instead."); return; }
      remember("Pictures/Screenshots/" + res.name);
      notify("Screenshot saved", esc(res.name) + "<br><small>" + esc(label) + " · Pictures › Screenshots</small>", () => openNode(res.name, res.node));
      lastCapture = res; refreshCaptureUI(); refreshGallery();
      if (window.EventLog && EventLog.add) EventLog.add("Application", "Information", "GameBar", 1001, "Screenshot saved: Pictures\\Screenshots\\" + res.name + " (" + source + ").");
    } catch (e) {
      notify("Screenshot failed", "Something went wrong while capturing. Try again.");
    } finally { shotBusy = false; refreshCaptureUI(); }
  }
  function remember(p) { const g = gb(); g.recent = [p].concat(g.recent.filter((x) => x !== p)).slice(0, 12); save(); }
  let lastCapture = null;

  function pickMime(hasAudio) {
    if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return "";
    const list = hasAudio ? ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4"]
      : ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4;codecs=avc1.42E01E", "video/mp4"];
    for (const t of list) { try { if (MediaRecorder.isTypeSupported(t)) return t; } catch (e) {} }
    return "";
  }
  function startPageStream() {
    const root = scr(), W = root.clientWidth, H = root.clientHeight, k = Math.min(1, 1280 / W);
    const c = mkCanvas(Math.round(W * k / 2) * 2, Math.round(H * k / 2) * 2), g = c.getContext("2d");
    g.fillStyle = "#000"; g.fillRect(0, 0, c.width, c.height);
    if (!c.captureStream) { const e = new Error("This browser can't record a canvas."); e.noCanvas = true; throw e; }
    const stream = c.captureStream(30);
    const st = { frames: 0, t0: performance.now(), alive: true, mode: "page" };
    (async () => {
      while (st.alive) {
        try { const r = await GBSnap.render({ scale: k }); if (!st.alive) break; g.drawImage(r.canvas, 0, 0, c.width, c.height); st.frames++; st.mode = r.mode; }
        catch (e) { await sleep(300); }
        await sleep(20);
      }
    })();
    return { stream, canvas: c, st, stop: () => { st.alive = false; } };
  }
  async function startRecording() {
    if (Rec.active || Rec.starting || !desktopReady()) return;
    if (!window.MediaRecorder) { notify("Recording isn't available", "This browser can't record video (no MediaRecorder)."); return; }
    Rec.starting = true; refreshCaptureUI();
    const wasOpen = !!overlay; closeBar(true);
    const name = captureBase();
    const stops = [];
    try {
      let vstream = null, mode = "page", page = null;
      if (useScreen()) {
        try {
          vstream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 30 }, displaySurface: "browser" }, audio: !!gb().settings.sysAudio, selfBrowserSurface: "include", systemAudio: "include", surfaceSwitching: "include" });
          mode = "screen";
        } catch (e) {
          if (e && (e.name === "NotAllowedError" || e.name === "AbortError")) { notify("Recording cancelled", "Screen sharing wasn't allowed, so nothing was recorded."); if (wasOpen) openBar(); return; }
          vstream = null;
        }
      }
      if (!vstream) {
        try { page = startPageStream(); } catch (e) { notify("Recording isn't available", "This browser can't record the Windows 12 screen."); if (wasOpen) openBar(); return; }
        vstream = page.stream; stops.push(page.stop);
      }
      stops.push(() => vstream.getTracks().forEach((t) => t.stop()));
      const vtracks = vstream.getVideoTracks(), atracks = vstream.getAudioTracks().slice();
      let micTrack = null, micNote = "";
      if (gb().settings.mic) {
        try { const ms = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true } }); micTrack = ms.getAudioTracks()[0]; atracks.push(micTrack); stops.push(() => ms.getTracks().forEach((t) => t.stop())); }
        catch (e) { micNote = "Mic not available — recording without it."; }
      }
      let audio = atracks;
      if (atracks.length > 1) {
        try {
          const AC = window.AudioContext || window.webkitAudioContext, ac = new AC(), dst = ac.createMediaStreamDestination();
          atracks.forEach((t) => ac.createMediaStreamSource(new MediaStream([t])).connect(dst));
          audio = dst.stream.getAudioTracks(); stops.push(() => { try { ac.close(); } catch (e) {} });
        } catch (e) { audio = atracks.slice(0, 1); }
      }
      const stream = new MediaStream(vtracks.concat(audio));
      const mime = pickMime(audio.length > 0);
      let rec;
      try { rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: mode === "page" ? 2500000 : 6000000 } : undefined); }
      catch (e) { rec = new MediaRecorder(stream); }
      Object.assign(Rec, { active: true, rec, mode, page, stops, chunks: [], t0: Date.now(), name, mime: rec.mimeType || mime, micTrack, poster: null, video: null });
      rec.ondataavailable = (e) => { if (e.data && e.data.size) Rec.chunks.push(e.data); };
      rec.onstop = () => finishRecording();
      if (vtracks[0]) vtracks[0].addEventListener("ended", () => stopRecording());
      rec.start(1000);
      if (mode === "screen") { videoFor(vstream).then((v) => { Rec.video = v; setTimeout(() => { try { if (v.videoWidth) Rec.poster = thumbOf(frameFrom(v), 320); } catch (e) {} }, 700); }); }
      else setTimeout(() => { try { if (page && page.st.frames) Rec.poster = thumbOf(page.canvas, 320); } catch (e) {} }, 1500);
      Rec.maxT = setTimeout(() => stopRecording(), (gb().settings.maxMin || 30) * 60000);
      showRecBar();
      if (micNote) notify("Recording", micNote);
      if (mode === "page") notify("Recording the Windows 12 screen", "This browser can't share the real screen, so Game Bar records the Windows 12 page itself (page-only, a few frames per second, no app audio).");
    } catch (e) {
      stops.forEach((f) => { try { f(); } catch (er) {} });
      Rec.active = false; notify("Recording failed", "The recording couldn't start.");
    } finally { Rec.starting = false; refreshCaptureUI(); }
  }
  function stopRecording() {
    if (!Rec.active || !Rec.rec) return;
    try { if (Rec.rec.state !== "inactive") { try { Rec.rec.requestData(); } catch (e) {} Rec.rec.stop(); } else finishRecording(); } catch (e) { finishRecording(); }
  }
  let finishing = false;
  async function finishRecording() {
    if (finishing || !Rec.active) return; finishing = true;
    const R = Object.assign({}, Rec);
    clearTimeout(Rec.maxT);
    if (!R.poster) { try { if (R.video && R.video.videoWidth) R.poster = thumbOf(frameFrom(R.video), 320); else if (R.page && R.page.st.frames) R.poster = thumbOf(R.page.canvas, 320); } catch (e) {} }
    (R.stops || []).forEach((f) => { try { f(); } catch (e) {} });
    if (R.video) { try { R.video.srcObject = null; } catch (e) {} }
    Rec.active = false; Rec.rec = null; Rec.video = null; Rec.page = null;
    hideRecBar(); refreshCaptureUI();
    try {
      const type = (R.mime || "video/webm").split(";")[0] || "video/webm";
      const blob = new Blob(R.chunks || [], { type });
      if (!blob.size) { notify("Recording failed", "No video was recorded."); return; }
      const ext = /mp4/.test(type) ? "mp4" : "webm", dur = (Date.now() - R.t0) / 1000;
      const fps = R.page ? R.page.st.frames / Math.max(1, dur) : 0;
      const extra = { poster: R.poster || undefined, duration: Math.round(dur * 10) / 10, source: R.mode === "screen" ? "screen" : "page" };
      let res;
      try { res = await saveCapture(["Videos", "Captures"], R.name + "." + ext, blob, "video", extra); }
      catch (e) { download(blob, R.name + "." + ext); notify("Clip downloaded", "Not enough storage for Videos › Captures, so the clip was downloaded instead."); return; }
      remember("Videos/Captures/" + res.name);
      const how = R.mode === "screen" ? "Real screen recording (browser screen sharing)" : "Page-only recording of the Windows 12 screen" + (fps ? " · about " + fps.toFixed(1) + " fps" : "");
      notify("Game clip recorded", esc(res.name) + " · " + fmtDur(dur) + "<br><small>" + esc(how) + " · Videos › Captures</small>", () => openNode(res.name, res.node));
      lastCapture = res; refreshCaptureUI(); refreshGallery();
      if (window.EventLog && EventLog.add) EventLog.add("Application", "Information", "GameBar", 1002, "Recording saved: Videos\\Captures\\" + res.name + " (" + fmtSize(blob.size) + ", " + R.mode + ").");
    } finally { finishing = false; }
  }
  function toggleRecording() { if (Rec.active) stopRecording(); else startRecording(); }

  // ---- recording status bar (stays out of page-only captures) ----
  let recBar = null, recTick = 0;
  function showRecBar() {
    hideRecBar();
    recBar = el(`<div class="gb-recbar gbs-skip" role="status" aria-live="polite">
      <span class="gb-recdot"></span><span class="gb-rectime">0:00</span>
      <span class="gb-recmode"></span>
      <button class="gb-recmic" title="Mic on/off">${ic(Rec.micTrack ? "mic" : "micoff", 16)}</button>
      <button class="gb-recstop" title="Stop recording (Win+Alt+R · Ctrl+Alt+Shift+R)">${ic("stop", 16)}</button>
    </div>`);
    scr().appendChild(recBar);
    const st = gb().widgets.recbar; if (st && st.x != null) { recBar.style.left = clamp(st.x, 0, innerWidth - 120) + "px"; recBar.style.top = clamp(st.y, 0, innerHeight - 40) + "px"; recBar.style.right = "auto"; }
    recBar.querySelector(".gb-recstop").onclick = () => stopRecording();
    const micB = recBar.querySelector(".gb-recmic");
    if (!Rec.micTrack) { micB.disabled = true; micB.title = "Mic isn't being recorded (turn it on in Capture before you start)"; }
    micB.onclick = () => { if (!Rec.micTrack) return; Rec.micTrack.enabled = !Rec.micTrack.enabled; micB.innerHTML = ic(Rec.micTrack.enabled ? "mic" : "micoff", 16); };
    dragBy(recBar, recBar, (x, y) => { gb().widgets.recbar = { x, y }; save(); });
    const tick = () => {
      if (!recBar) return;
      const s = (Date.now() - Rec.t0) / 1000;
      recBar.querySelector(".gb-rectime").textContent = fmtDur(s);
      const m = recBar.querySelector(".gb-recmode");
      if (Rec.mode === "page" && Rec.page) { const f = Rec.page.st.frames / Math.max(1, (performance.now() - Rec.page.st.t0) / 1000); m.textContent = "Page-only · " + f.toFixed(1) + " fps"; }
      else m.textContent = "Screen";
      document.querySelectorAll(".gb-w-capture .gb-rectimer").forEach((t) => { t.textContent = fmtDur(s); });
    };
    tick(); recTick = setInterval(tick, 500);
  }
  function hideRecBar() { clearInterval(recTick); if (recBar) { recBar.remove(); recBar = null; } }

  // =====================================================================
  //  Overlay + widgets
  // =====================================================================
  let overlay = null, clockT = 0, zTop = 10;
  const live = {}; // id -> { el, body, onShow, onHide }
  const WIDGETS = [
    { id: "capture", name: "Capture", icon: "camera", w: 304, pos: (W, H) => [16, 76], build: buildCapture },
    { id: "audio", name: "Audio", icon: "audio", w: 330, pos: (W, H) => [16, Math.min(320, H - 300)], build: buildAudio },
    { id: "perf", name: "Performance", icon: "perf", w: 336, pos: (W, H) => [Math.max(16, W - 352), 76], build: buildPerf },
    { id: "gallery", name: "Gallery", icon: "gallery", w: 420, pos: (W, H) => [Math.max(16, W / 2 - 210), 150], build: buildGallery },
    { id: "social", name: "Xbox Social", icon: "social", w: 316, pos: (W, H) => [Math.max(16, W - 332), Math.min(460, H - 330)], build: buildSocial },
    { id: "settings", name: "Settings", icon: "gear", w: 380, pos: (W, H) => [Math.max(16, W / 2 - 190), 120], build: buildSettings },
  ];
  const wdef = (id) => WIDGETS.find((w) => w.id === id);

  function dragBy(target, handle, onEnd) {
    handle.style.touchAction = "none";
    handle.addEventListener("pointerdown", (e) => {
      if (e.button || e.target.closest("button, input, select, a, textarea, label")) return;
      e.preventDefault();
      const sx = e.clientX, sy = e.clientY, ox = target.offsetLeft, oy = target.offsetTop;
      target.style.right = "auto";
      try { handle.setPointerCapture(e.pointerId); } catch (er) {}
      const mv = (ev) => {
        target.style.left = clamp(ox + ev.clientX - sx, 60 - target.offsetWidth, innerWidth - 60) + "px";
        target.style.top = clamp(oy + ev.clientY - sy, 0, innerHeight - 40) + "px";
      };
      const up = () => {
        handle.removeEventListener("pointermove", mv); handle.removeEventListener("pointerup", up); handle.removeEventListener("pointercancel", up);
        if (onEnd) onEnd(target.offsetLeft, target.offsetTop);
      };
      handle.addEventListener("pointermove", mv); handle.addEventListener("pointerup", up); handle.addEventListener("pointercancel", up);
    });
  }
  function ensureWidget(id) {
    if (live[id]) return live[id];
    const d = wdef(id); if (!d) return null;
    const w = el(`<section class="gb-widget gbs-skip gb-w-${id}" role="region" aria-label="${esc(d.name)}" style="width:${d.w}px">
      <header class="gb-whead"><span class="gb-wtitle">${ic(d.icon, 16)}<b>${esc(d.name)}</b></span>
        <button class="gb-wbtn gb-wpin" title="Pin (keep on screen when Game Bar closes)">${ic("pin", 15)}</button>
        <button class="gb-wbtn gb-wclose" title="Close widget">${ic("close", 15)}</button></header>
      <div class="gb-wbody"></div></section>`);
    const L = live[id] = { el: w, body: w.querySelector(".gb-wbody"), onShow: null, onHide: null };
    dragBy(w, w.querySelector(".gb-whead"), (x, y) => { const st = wstate(id); st.x = x; st.y = y; save(); });
    w.addEventListener("pointerdown", () => { w.style.zIndex = ++zTop; }, true);
    w.querySelector(".gb-wclose").onclick = () => { wstate(id).open = false; save(); hideWidget(id); paintHome(); };
    w.querySelector(".gb-wpin").onclick = () => {
      const st = wstate(id); st.pinned = !st.pinned; save(); paintPin(id);
      if (!overlay && !st.pinned) hideWidget(id);
    };
    d.build(L);
    paintPin(id);
    return L;
  }
  function paintPin(id) { const L = live[id]; if (!L) return; const on = !!wstate(id).pinned; L.el.classList.toggle("gb-pinned", on); const b = L.el.querySelector(".gb-wpin"); b.classList.toggle("on", on); b.title = on ? "Unpin" : "Pin (keep on screen when Game Bar closes)"; b.setAttribute("aria-pressed", on ? "true" : "false"); }
  function place(id) {
    const L = live[id], d = wdef(id), st = wstate(id); if (!L) return;
    const W = innerWidth, H = innerHeight;
    let x = st.x, y = st.y;
    if (x == null || y == null) { const p = d.pos(W, H); x = p[0]; y = p[1]; }
    L.el.style.left = clamp(x, 0, Math.max(0, W - Math.min(d.w, W) )) + "px";
    L.el.style.top = clamp(y, 0, Math.max(0, H - 80)) + "px";
    L.el.style.width = Math.min(d.w, W - 16) + "px";
  }
  function showWidget(id) {
    const L = ensureWidget(id); if (!L) return;
    const host = overlay || scr();
    if (L.el.parentNode !== host) host.appendChild(L.el);
    L.el.classList.toggle("gb-floating", !overlay);
    L.el.style.zIndex = ++zTop;
    place(id);
    if (!L.shown) { L.shown = true; if (L.onShow) L.onShow(); }
  }
  function hideWidget(id) { const L = live[id]; if (!L) return; if (L.el.parentNode) L.el.remove(); if (L.shown) { L.shown = false; if (L.onHide) L.onHide(); } }
  function toggleWidget(id) { const st = wstate(id); st.open = !st.open; save(); if (st.open) showWidget(id); else hideWidget(id); paintHome(); }

  function paintHome() {
    if (!overlay) return;
    overlay.querySelectorAll(".gb-hb[data-w]").forEach((b) => { const on = !!wstate(b.dataset.w).open; b.classList.toggle("on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); });
    const t = overlay.querySelector(".gb-hclock"); if (t) t.textContent = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const a = overlay.querySelector(".gb-happ"); if (a) { const e = visibleWins()[0]; a.textContent = e ? titleOf(e) : "Desktop"; }
  }
  function openBar() {
    if (overlay || !desktopReady()) return;
    overlay = el(`<div class="gb-overlay gbs-skip" role="dialog" aria-label="Xbox Game Bar">
      <div class="gb-home">
        <button class="gb-hb gb-hxbox" title="Open the Xbox app">${ic("xbox", 20)}</button>
        <span class="gb-hsep"></span>
        <button class="gb-hb" data-w="audio" title="Audio">${ic("audio")}</button>
        <button class="gb-hb" data-w="capture" title="Capture">${ic("camera")}</button>
        <button class="gb-hb" data-w="perf" title="Performance">${ic("perf")}</button>
        <button class="gb-hb" data-w="gallery" title="Gallery">${ic("gallery")}</button>
        <button class="gb-hb" data-w="social" title="Xbox Social &amp; achievements">${ic("social")}</button>
        <span class="gb-hsep"></span>
        <span class="gb-hinfo"><span class="gb-hclock"></span><span class="gb-happ"></span></span>
        <button class="gb-hb" data-w="settings" title="Settings">${ic("gear")}</button>
      </div>
      <div class="gb-hint">Win+G or Ctrl+Alt+G to close · tap outside the widgets to return</div>
    </div>`);
    scr().appendChild(overlay);
    overlay.querySelectorAll(".gb-hb[data-w]").forEach((b) => b.onclick = () => toggleWidget(b.dataset.w));
    overlay.querySelector(".gb-hxbox").onclick = () => { closeBar(); if (window.WM) WM.open("xbox"); };
    overlay.addEventListener("pointerdown", (e) => { if (e.target === overlay || e.target.classList.contains("gb-hint")) { e.preventDefault(); closeBar(); } });
    WIDGETS.forEach((w) => { const st = wstate(w.id); if (st.open) showWidget(w.id); });
    paintHome(); clockT = setInterval(paintHome, 5000);
    requestAnimationFrame(() => overlay && overlay.classList.add("show"));
    if (window.EventLog && EventLog.add) { try { EventLog.add("Application", "Information", "GameBar", 1000, "Xbox Game Bar opened."); } catch (e) {} }
  }
  function closeBar(quick) {
    if (!overlay) return;
    clearInterval(clockT);
    WIDGETS.forEach((w) => {
      const L = live[w.id]; if (!L || !L.el.parentNode) return;
      const st = wstate(w.id);
      if (st.open && st.pinned) { scr().appendChild(L.el); L.el.classList.add("gb-floating"); }
      else hideWidget(w.id);
    });
    const o = overlay; overlay = null;
    if (quick) o.remove(); else { o.classList.remove("show"); setTimeout(() => o.remove(), 140); }
  }
  function toggleBar() { if (overlay) closeBar(); else openBar(); }
  function restorePinned() {
    if (overlay || !desktopReady()) return;
    WIDGETS.forEach((w) => { const st = wstate(w.id); if (st.open && st.pinned && !(live[w.id] && live[w.id].el.isConnected)) showWidget(w.id); });
  }
  window.addEventListener("resize", () => { Object.keys(live).forEach((id) => { if (live[id].el.isConnected) place(id); }); });

  // ---------------- Capture widget ----------------
  function buildCapture(L) {
    L.body.innerHTML = `
      <div class="gb-cap-row">
        <button class="gb-cap-btn" data-a="shot" title="Take screenshot (Win+Alt+PrtScn · Ctrl+Alt+Shift+S)" aria-label="Take screenshot">${ic("camera", 22)}</button>
        <button class="gb-cap-btn" data-a="last30" disabled title="Record last 30 sec needs background recording, which a web browser can't do" aria-label="Record last 30 seconds (not available)">${ic("history", 22)}</button>
        <button class="gb-cap-btn gb-recbtn" data-a="rec" title="Start recording (Win+Alt+R · Ctrl+Alt+Shift+R)" aria-label="Start recording">${ic("rec", 22)}</button>
        <button class="gb-cap-btn" data-a="mic" aria-label="Microphone while recording">${ic("micoff", 22)}</button>
      </div>
      <div class="gb-cap-status"></div>
      <label class="gb-field"><span>Capture</span><select class="gb-src">
        <option value="screen">Real screen (browser asks what to share)</option>
        <option value="page">Windows 12 page only (no prompt)</option></select></label>
      <div class="gb-note gb-cap-note"></div>
      <div class="gb-cap-last"></div>
      <button class="gb-link" data-a="gallery">${ic("gallery", 15)} See my captures</button>`;
    const b = L.body;
    b.querySelector('[data-a="shot"]').onclick = () => screenshot();
    b.querySelector('[data-a="rec"]').onclick = () => toggleRecording();
    b.querySelector('[data-a="mic"]').onclick = () => { const s = gb().settings; s.mic = !s.mic; save(); refreshCaptureUI(); };
    b.querySelector('[data-a="gallery"]').onclick = () => { const st = wstate("gallery"); if (!st.open) toggleWidget("gallery"); else showWidget("gallery"); };
    const sel = b.querySelector(".gb-src");
    sel.onchange = () => { gb().settings.source = sel.value; save(); refreshCaptureUI(); };
    L.onShow = refreshCaptureUI;
    refreshCaptureUI();
  }
  function refreshCaptureUI() {
    const L = live.capture; if (!L) return;
    const b = L.body, s = gb().settings;
    const rec = b.querySelector('[data-a="rec"]');
    rec.classList.toggle("on", !!Rec.active);
    rec.innerHTML = Rec.active ? ic("stop", 22) : ic("rec", 22);
    rec.title = Rec.active ? "Stop recording" : "Start recording (Win+Alt+R · Ctrl+Alt+Shift+R)";
    rec.disabled = !!Rec.starting || !window.MediaRecorder;
    b.querySelector('[data-a="shot"]').disabled = shotBusy;
    const mic = b.querySelector('[data-a="mic"]');
    mic.innerHTML = ic(s.mic ? "mic" : "micoff", 22); mic.classList.toggle("on", !!s.mic);
    mic.title = s.mic ? "Mic will be recorded (click to turn off)" : "Mic is off while recording (click to turn on)";
    mic.setAttribute("aria-pressed", s.mic ? "true" : "false");
    const sel = b.querySelector(".gb-src");
    sel.querySelector('option[value="screen"]').disabled = !canScreen();
    sel.value = useScreen() ? "screen" : "page";
    const status = b.querySelector(".gb-cap-status");
    status.innerHTML = Rec.active ? `<span class="gb-recdot"></span> Recording <b class="gb-rectimer">${fmtDur((Date.now() - Rec.t0) / 1000)}</b> · ${Rec.mode === "screen" ? "screen" : "page-only"}`
      : shotBusy ? "Capturing…" : Rec.starting ? "Starting…" : "";
    b.querySelector(".gb-cap-note").textContent = !canScreen()
      ? "This browser can't capture the real screen (no screen sharing API, e.g. iPad Safari). Screenshots and recordings render the Windows 12 page itself — page-only."
      : useScreen() ? "Uses your browser's screen sharing: real pixels. The browser asks what to share each time (a screenshot while recording doesn't ask)."
        : "Page-only: Game Bar renders the Windows 12 page into an image. No prompt; web content inside apps (iframes) shows as a placeholder.";
    const last = b.querySelector(".gb-cap-last");
    if (lastCapture && lastCapture.node) {
      const n = lastCapture.node, t = n.kind === "video" ? n.poster : n.src;
      last.innerHTML = `<button class="gb-last">${t ? `<img src="${esc(t)}" alt="">` : ic(n.kind === "video" ? "play" : "gallery", 20)}<span><b>${esc(lastCapture.name)}</b><small>${n.kind === "video" ? "Videos › Captures" : "Pictures › Screenshots"}</small></span></button>`;
      last.querySelector(".gb-last").onclick = () => openNode(lastCapture.name, lastCapture.node);
    } else last.innerHTML = "";
  }

  // ---------------- Audio widget (real per-app volume) ----------------
  const media = new Set(), owner = new WeakMap(), mutedByUs = new WeakSet(), gains = new WeakMap();
  let actx = null;
  function guessOwner(m) {
    const w = m.isConnected && m.closest ? m.closest(".win") : null;
    const e = w && window.WM && WM.entryFor ? WM.entryFor(w) : visibleWins()[0];
    if (m.isConnected && m.closest && m.closest(".gb-widget")) return { key: "gamebar", name: "Xbox Game Bar", appId: "gamebar", guessed: false };
    if (!e) return { key: "other", name: "Background audio", appId: "", guessed: true };
    return { key: e.appId || titleOf(e), name: titleOf(e), appId: e.appId || "", win: e.win, guessed: !w };
  }
  function trackMedia(m) { if (!m || !(m instanceof HTMLMediaElement) || m.__gbInternal) return; media.add(m); if (!owner.has(m)) owner.set(m, guessOwner(m)); applyVol(m); setTimeout(paintAudio, 50); }
  (function hookPlay() {
    try {
      const Pr = HTMLMediaElement.prototype; if (Pr.__gbHooked) return;
      const orig = Pr.play;
      Pr.play = function () { try { trackMedia(this); } catch (e) {} return orig.apply(this, arguments); };
      Object.defineProperty(Pr, "__gbHooked", { value: true });
    } catch (e) {}
  })();
  function scanMedia() {
    document.querySelectorAll("#screen audio, #screen video").forEach((m) => { if (!m.closest(".gbs-skip") && (m.currentSrc || m.srcObject)) { media.add(m); if (!owner.has(m)) owner.set(m, guessOwner(m)); } });
    media.forEach((m) => {
      const o = owner.get(m);
      const stale = (!m.isConnected && m.paused) || m.ended && !m.isConnected || (o && o.win && !o.win.isConnected && m.paused) || !(m.currentSrc || m.srcObject);
      if (stale || (m.closest && m.closest(".gb-widget"))) media.delete(m);
    });
  }
  function groups() {
    scanMedia();
    const map = new Map();
    media.forEach((m) => {
      const o = owner.get(m) || guessOwner(m);
      if (o.win && !o.win.isConnected) { o.win = null; o.name += " (closed)"; }
      let g = map.get(o.key); if (!g) map.set(o.key, g = { key: o.key, name: o.name, appId: o.appId, guessed: o.guessed, els: [] });
      g.els.push(m);
    });
    return [...map.values()];
  }
  function sameOrigin(m) { const u = m.currentSrc || m.src || ""; if (!u) return !!m.srcObject; if (/^(blob|data):/.test(u)) return true; try { return new URL(u, document.baseURI).origin === location.origin; } catch (e) { return false; } }
  function setVolume(m, v) {
    v = clamp(v, 0, 1);
    const gn = gains.get(m);
    if (gn) { gn.gain.value = v; return "gain"; }
    try { m.volume = v; } catch (e) {}
    if (Math.abs(m.volume - v) < 0.02) return "volume";
    // iOS/iPadOS ignore element.volume: route same-origin media through a Web Audio gain node.
    if (!sameOrigin(m) || m.srcObject) return "fixed";
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return "fixed";
      actx = actx || new AC(); if (actx.state === "suspended") actx.resume();
      const src = actx.createMediaElementSource(m), g = actx.createGain(); g.gain.value = v; src.connect(g); g.connect(actx.destination);
      gains.set(m, g); return "gain";
    } catch (e) { return "fixed"; }
  }
  function applyVol(m) {
    const o = owner.get(m); if (!o) return;
    const s = gb().appVol[o.key]; if (!s) return;
    if (typeof s.v === "number" && s.v < 1) setVolume(m, s.v);
    if (s.m) { m.muted = true; mutedByUs.add(m); }
  }
  function buildAudio(L) {
    L.body.innerHTML = `<div class="gb-tabs"><button class="on">Mix</button></div>
      <div class="gb-aud-out">${ic("audio", 16)} <span>Output: this browser's default audio device</span></div>
      <div class="gb-aud-list"></div>
      <div class="gb-note">Real controls for the audio and video elements apps are playing. Sounds made with Web Audio (e.g. some games) can't be listed.</div>`;
    let t = 0;
    L.onShow = () => { paintAudio(true); t = setInterval(() => paintAudio(), 1000); };
    L.onHide = () => clearInterval(t);
  }
  let audSig = "";
  function paintAudio(force) {
    const L = live.audio; if (!L || !L.el.isConnected) return;
    const list = L.body.querySelector(".gb-aud-list");
    const gs = groups();
    const sig = gs.map((g) => g.key + ":" + g.els.length).join("|");
    if (!force && sig === audSig && list.children.length) {
      gs.forEach((g) => { const row = list.querySelector(`.gb-aud-row[data-k="${CSS.escape(g.key)}"]`); if (row) row.querySelector(".gb-aud-state").textContent = stateText(g); });
      return;
    }
    audSig = sig;
    if (!gs.length) { list.innerHTML = `<div class="gb-empty">${ic("audio", 26)}<b>No apps are playing audio</b><span>Play something in Media Player, YouTube or a video and it shows up here.</span></div>`; return; }
    list.innerHTML = "";
    gs.forEach((g) => {
      const s = gb().appVol[g.key] || {};
      const v = Math.round((typeof s.v === "number" ? s.v : g.els[0].volume) * 100);
      const row = el(`<div class="gb-aud-row" data-k="${esc(g.key)}">
        <span class="gb-aud-ic">${window.Icon ? Icon.mini(g.appId || "media", g.name) : ""}</span>
        <div class="gb-aud-main"><div class="gb-aud-name"><b>${esc(g.name)}</b><small class="gb-aud-state">${esc(stateText(g))}</small></div>
          <div class="gb-aud-ctl"><button class="gb-wbtn gb-aud-mute" aria-label="Mute ${esc(g.name)}">${ic(s.m ? "mute" : "audio", 16)}</button>
          <input type="range" min="0" max="100" value="${v}" aria-label="${esc(g.name)} volume"><span class="gb-aud-val">${v}</span></div>
          <small class="gb-aud-warn" hidden></small></div></div>`);
      const rng = row.querySelector("input"), val = row.querySelector(".gb-aud-val"), warn = row.querySelector(".gb-aud-warn"), mb = row.querySelector(".gb-aud-mute");
      rng.oninput = () => {
        const nv = rng.value / 100; val.textContent = rng.value;
        const st = gb().appVol[g.key] = Object.assign({}, gb().appVol[g.key], { v: nv });
        let fixed = false; g.els.forEach((m) => { if (setVolume(m, nv) === "fixed") fixed = true; });
        warn.hidden = !fixed; warn.textContent = fixed ? "This device doesn't let web pages change this source's volume — mute still works." : "";
        void st;
      };
      rng.onchange = () => save();
      mb.onclick = () => {
        const st = gb().appVol[g.key] = Object.assign({}, gb().appVol[g.key]); st.m = !st.m; save();
        g.els.forEach((m) => { if (st.m) { m.muted = true; mutedByUs.add(m); } else if (mutedByUs.has(m)) { m.muted = false; mutedByUs.delete(m); } });
        mb.innerHTML = ic(st.m ? "mute" : "audio", 16); mb.classList.toggle("on", !!st.m);
      };
      mb.classList.toggle("on", !!s.m);
      list.appendChild(row);
    });
  }
  function stateText(g) {
    const playing = g.els.filter((m) => !m.paused).length;
    return (playing ? "Playing" : "Paused") + (g.els.length > 1 ? " · " + g.els.length + " sources" : "") + (g.guessed ? " · detected when playback started" : "");
  }

  // ---------------- Performance widget (measured) ----------------
  const Perf = { on: false, raf: 0, frames: 0, t0: 0, last: 0, worst: 0, sumDt: 0, jank: 0, long: 0, longOk: false, fps: [], heap: [], busy: [], maxFps: 0, store: null };
  try {
    const po = new PerformanceObserver((l) => { l.getEntries().forEach((e) => { Perf.long += e.duration; }); });
    po.observe({ type: "longtask", buffered: false }); Perf.longOk = true;
  } catch (e) { Perf.longOk = false; }
  function perfLoop(t) {
    if (!Perf.on) return;
    if (Perf.last) { const dt = t - Perf.last; Perf.sumDt += dt; Perf.worst = Math.max(Perf.worst, dt); if (dt > 17.5) Perf.jank += dt - 16.7; }
    Perf.last = t; Perf.frames++;
    if (t - Perf.t0 >= 1000) {
      const el_ = t - Perf.t0, fps = Perf.frames * 1000 / el_;
      Perf.maxFps = Math.max(Perf.maxFps * 0.98, fps);
      const busy = Perf.longOk ? Math.min(100, Perf.long / el_ * 100) : Math.min(100, Perf.jank / el_ * 100);
      const mem = performance.memory;
      push(Perf.fps, fps); push(Perf.busy, busy); push(Perf.heap, mem ? mem.usedJSHeapSize / 1048576 : 0);
      Perf.cur = { fps, ft: Perf.sumDt / Math.max(1, Perf.frames - 1), worst: Perf.worst, busy };
      Perf.frames = 0; Perf.t0 = t; Perf.worst = 0; Perf.sumDt = 0; Perf.jank = 0; Perf.long = 0;
      paintPerf();
    }
    Perf.raf = requestAnimationFrame(perfLoop);
  }
  function push(a, v) { a.push(v); if (a.length > 60) a.shift(); }
  function perfStart() { if (Perf.on) return; Perf.on = true; Perf.t0 = performance.now(); Perf.last = 0; Perf.frames = 0; Perf.raf = requestAnimationFrame(perfLoop); refreshStorage(); }
  function perfStop() { Perf.on = false; cancelAnimationFrame(Perf.raf); }
  function refreshStorage() { try { if (navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then((e) => { Perf.store = e; }).catch(() => {}); } catch (e) {} }
  function buildPerf(L) {
    L.body.innerHTML = `<div class="gb-tabs gb-perf-tabs"><button data-m="fps" class="on">FPS</button><button data-m="busy">CPU</button><button data-m="heap">RAM</button></div>
      <div class="gb-perf-big"><b class="gb-perf-num">--</b><span class="gb-perf-lbl"></span></div>
      <canvas class="gb-perf-graph" width="600" height="150" aria-label="Performance graph"></canvas>
      <div class="gb-perf-axis"><span>60 seconds</span><span>now</span></div>
      <dl class="gb-stats"></dl>`;
    let metric = "fps", storeT = 0;
    L.body.querySelectorAll(".gb-perf-tabs button").forEach((b) => b.onclick = () => { metric = b.dataset.m; L.body.querySelectorAll(".gb-perf-tabs button").forEach((x) => x.classList.toggle("on", x === b)); L.metric = metric; paintPerf(); });
    L.metric = metric;
    L.onShow = () => { perfStart(); storeT = setInterval(refreshStorage, 10000); paintPerf(); };
    L.onHide = () => { clearInterval(storeT); perfStop(); };
  }
  function paintPerf() {
    const L = live.perf; if (!L || !L.el.isConnected) return;
    const b = L.body, cur = Perf.cur, mem = performance.memory, m = L.metric || "fps";
    const num = b.querySelector(".gb-perf-num"), lbl = b.querySelector(".gb-perf-lbl");
    if (m === "fps") { num.textContent = cur ? Math.round(cur.fps) : "--"; lbl.textContent = "frames per second · measured"; }
    else if (m === "busy") { num.textContent = cur ? Math.round(cur.busy) + "%" : "--"; lbl.textContent = Perf.longOk ? "main thread busy with long tasks · measured" : "main thread load · est. from frame timing"; }
    else { num.textContent = mem ? fmtSize(mem.usedJSHeapSize) : "n/a"; lbl.textContent = mem ? "JavaScript heap in use · measured" : "this browser doesn't report memory use"; }
    // graph
    const cv = b.querySelector(".gb-perf-graph"), g = cv.getContext("2d"), W = cv.width, H = cv.height;
    const data = m === "fps" ? Perf.fps : m === "busy" ? Perf.busy : Perf.heap;
    const cs = getComputedStyle(L.el), acc = cs.getPropertyValue("--gb-accent").trim() || "#3aa0ff", grid = cs.getPropertyValue("--gb-grid").trim() || "rgba(255,255,255,.12)";
    const max = m === "fps" ? Math.max(60, Math.ceil(Math.max(0, ...data) / 30) * 30) : m === "busy" ? 100 : Math.max(16, Math.max(0, ...data) * 1.25);
    g.clearRect(0, 0, W, H);
    g.strokeStyle = grid; g.lineWidth = 1; for (let i = 1; i < 4; i++) { const y = Math.round(H * i / 4) + 0.5; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    if (data.length > 1) {
      const step = W / 59, off = W - (data.length - 1) * step;
      g.beginPath(); data.forEach((v, i) => { const x = off + i * step, y = H - 4 - (Math.min(v, max) / max) * (H - 10); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
      g.strokeStyle = acc; g.lineWidth = 3; g.lineJoin = "round"; g.stroke();
      g.lineTo(W, H); g.lineTo(off, H); g.closePath(); g.globalAlpha = 0.18; g.fillStyle = acc; g.fill(); g.globalAlpha = 1;
    }
    g.fillStyle = cs.color; g.globalAlpha = 0.6; g.font = "20px system-ui, sans-serif"; g.fillText(m === "heap" ? fmtSize(max * 1048576) : m === "busy" ? "100%" : max + " fps", 8, 24); g.globalAlpha = 1;
    // stats
    const nav = navigator, conn = nav.connection, st = Perf.store;
    const rows = [
      ["Frame time", cur ? cur.ft.toFixed(1) + " ms avg · " + Math.round(cur.worst) + " ms worst" : "--", "measured"],
      ["Display", screen.width + "×" + screen.height + " @" + (window.devicePixelRatio || 1) + "x · ≈" + (Perf.maxFps ? Math.round(Perf.maxFps) : "--") + " Hz", "Hz est."],
      ["CPU", (nav.hardwareConcurrency || "?") + " logical cores", "browser"],
      ["Memory", nav.deviceMemory ? "≈ " + nav.deviceMemory + " GB" + (nav.deviceMemory >= 8 ? "+" : "") : "not reported", nav.deviceMemory ? "rounded by browser" : ""],
      ["JS heap", mem ? fmtSize(mem.usedJSHeapSize) + " of " + fmtSize(mem.jsHeapSizeLimit) : "not reported by this browser", mem ? "measured" : ""],
      ["DOM", document.getElementsByTagName("*").length.toLocaleString() + " elements · " + wins().length + " windows", "measured"],
      ["Storage", st && st.usage != null ? fmtSize(st.usage) + (st.quota ? " of " + fmtSize(st.quota) : "") : "not reported", st ? "browser" : ""],
    ];
    if (conn && conn.effectiveType) rows.push(["Network", conn.effectiveType.toUpperCase() + (conn.downlink ? " · ~" + conn.downlink + " Mb/s" : ""), "browser est."]);
    b.querySelector(".gb-stats").innerHTML = rows.map(([k, v, t]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}${t ? ` <i>${esc(t)}</i>` : ""}</dd></div>`).join("");
  }

  // ---------------- Gallery widget ----------------
  function listCaptures() {
    const out = [];
    const walk = (path, kind) => {
      const ch = (function () { let c = window.VFS ? VFS.ensure() : {}; for (const s of path) { if (!c[s] || c[s].type !== "folder") return null; c = c[s].children || {}; } return c; })();
      if (!ch) return;
      Object.keys(ch).forEach((name) => { const n = ch[name]; if (n && n.type === "file") out.push({ name, node: n, path: path.concat(name), dir: path, kind: n.kind === "video" || /\.(webm|mp4|mov)$/i.test(name) ? "video" : "image", ts: n.ts || 0 }); });
    };
    walk(["Pictures", "Screenshots"]); walk(["Videos", "Captures"]);
    return out.sort((a, b) => b.ts - a.ts);
  }
  function buildGallery(L) {
    L.body.innerHTML = `<div class="gb-tabs gb-gal-tabs"><button data-f="all" class="on">All</button><button data-f="image">Screenshots</button><button data-f="video">Recordings</button></div>
      <div class="gb-gal-grid"></div><div class="gb-gal-view" hidden></div>`;
    L.filter = "all";
    L.body.querySelectorAll(".gb-gal-tabs button").forEach((b) => b.onclick = () => { L.filter = b.dataset.f; L.body.querySelectorAll(".gb-gal-tabs button").forEach((x) => x.classList.toggle("on", x === b)); closeView(L); paintGallery(); });
    L.onShow = () => paintGallery();
  }
  function refreshGallery() { if (live.gallery && live.gallery.el.isConnected) paintGallery(); }
  window.addEventListener("vfs-change", (e) => { if (!e.detail || e.detail.source !== "gamebar") refreshGallery(); });
  function closeView(L) { const v = L.body.querySelector(".gb-gal-view"); if (L.viewUrl) { URL.revokeObjectURL(L.viewUrl); L.viewUrl = null; } v.innerHTML = ""; v.hidden = true; L.body.querySelector(".gb-gal-grid").hidden = false; }
  function paintGallery() {
    const L = live.gallery; if (!L) return;
    const grid = L.body.querySelector(".gb-gal-grid");
    const items = listCaptures().filter((x) => L.filter === "all" || x.kind === L.filter);
    if (!items.length) { grid.innerHTML = `<div class="gb-empty">${ic("gallery", 26)}<b>No captures yet</b><span>Take a screenshot (Win+Alt+PrtScn or Ctrl+Alt+Shift+S) or record a clip from the Capture widget.</span></div>`; return; }
    grid.innerHTML = "";
    items.slice(0, 60).forEach((it) => {
      const t = it.kind === "video" ? it.node.poster : it.node.src;
      const c = el(`<button class="gb-gal-it" title="${esc(it.name)}">${t ? `<img src="${esc(t)}" alt="" loading="lazy">` : `<span class="gb-gal-ph">${ic(it.kind === "video" ? "play" : "gallery", 22)}</span>`}${it.kind === "video" ? `<span class="gb-gal-badge">${ic("play", 11)}${it.node.duration ? fmtDur(it.node.duration) : ""}</span>` : ""}</button>`);
      c.onclick = () => viewCapture(L, it);
      grid.appendChild(c);
    });
  }
  async function viewCapture(L, it) {
    const v = L.body.querySelector(".gb-gal-view"), grid = L.body.querySelector(".gb-gal-grid");
    closeView(L); grid.hidden = true; v.hidden = false;
    const n = it.node, when = n.ts ? new Date(n.ts).toLocaleString() : "";
    v.innerHTML = `<div class="gb-gal-top"><button class="gb-wbtn gb-gal-back" aria-label="Back">${ic("back", 16)}</button><b title="${esc(it.name)}">${esc(it.name)}</b></div>
      <div class="gb-gal-media"><div class="gb-gal-loading">Loading…</div></div>
      <div class="gb-gal-meta">${esc(when)}${n.size ? " · " + fmtSize(n.size) : ""}${n.w ? " · " + n.w + "×" + n.h : ""}${n.source ? " · " + (n.source === "screen" ? "real screen" : n.source === "page" ? "page-only" : "simplified") : ""}</div>
      <div class="gb-gal-acts"><button class="gb-btn" data-a="open">${ic("open", 15)} Open</button><button class="gb-btn" data-a="files">${ic("folder", 15)} Show in folder</button><button class="gb-btn gb-danger" data-a="del">${ic("trash", 15)} Delete</button></div>`;
    v.querySelector(".gb-gal-back").onclick = () => closeView(L);
    v.querySelector('[data-a="open"]').onclick = () => openNode(it.name, n);
    v.querySelector('[data-a="files"]').onclick = () => { closeBar(); showInFiles(it.dir); };
    v.querySelector('[data-a="del"]').onclick = () => {
      if (!confirm("Delete " + it.name + "?")) return;
      const kids = folderAt(it.dir); if (kids[it.name] === n) delete kids[it.name];
      persist(); vfsChanged(); closeView(L); paintGallery();
    };
    const box = v.querySelector(".gb-gal-media");
    let url = n.src || null;
    if (n.blob && window.VFS && VFS.getBlob) { try { const b = await VFS.getBlob(n.blob); if (b) { url = L.viewUrl = URL.createObjectURL(b); } } catch (e) {} }
    if (!url) { box.innerHTML = `<div class="gb-gal-loading">This file's contents aren't on this device.</div>`; return; }
    if (it.kind === "video") { box.innerHTML = `<video controls playsinline preload="metadata" ${n.poster ? `poster="${esc(n.poster)}"` : ""}></video>`; box.querySelector("video").src = url; }
    else { box.innerHTML = `<img alt="">`; box.querySelector("img").src = url; }
  }

  // ---------------- Xbox Social / achievements (real local data) ----------------
  function buildSocial(L) {
    L.body.innerHTML = `<div class="gb-soc-head"></div>
      <div class="gb-tabs gb-soc-tabs"><button data-t="ach" class="on">${ic("trophy", 14)} Achievements</button><button data-t="friends">${ic("social", 14)} Friends</button></div>
      <div class="gb-soc-body"></div>`;
    L.tab = "ach";
    L.body.querySelectorAll(".gb-soc-tabs button").forEach((b) => b.onclick = () => { L.tab = b.dataset.t; L.body.querySelectorAll(".gb-soc-tabs button").forEach((x) => x.classList.toggle("on", x === b)); paintSocial(); });
    L.onShow = paintSocial;
  }
  function paintSocial() {
    const L = live.social; if (!L) return;
    const prof = S().profile || {}, name = prof.username || "Player";
    const list = (window.Achievements && Achievements.LIST) || [];
    const ad = (S().appData && S().appData.achievements) || { progress: {}, unlocked: {} };
    const unlocked = list.filter((a) => ad.unlocked && ad.unlocked[a.id]);
    const games = (S().appData && S().appData.games) || {};
    const owned = Array.isArray(games.owned) ? games.owned.length : 0;
    const initials = name.replace(/[^A-Za-z0-9 ]/g, "").split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "P";
    L.body.querySelector(".gb-soc-head").innerHTML = `<span class="gb-avatar">${esc(initials)}</span><div><b>${esc(name)}</b><small>Local profile · not signed in to the Xbox network</small>
      <small>${unlocked.length} of ${list.length} achievements · ${owned} game${owned === 1 ? "" : "s"} in your library${games.gamepass ? " + Game Pass" : ""}</small></div>`;
    const body = L.body.querySelector(".gb-soc-body");
    if (L.tab === "friends") {
      body.innerHTML = `<div class="gb-empty">${ic("social", 26)}<b>No friends to show</b><span>This Windows 12 isn't connected to the Xbox network, so Game Bar can't show real friends, parties or who's online — and it won't make any up.</span><button class="gb-btn" data-a="xbox">${ic("xbox", 15)} Open Xbox app</button></div>`;
      body.querySelector('[data-a="xbox"]').onclick = () => { closeBar(); WM.open("xbox"); };
      return;
    }
    if (!list.length) { body.innerHTML = `<div class="gb-empty"><b>Achievements aren't available</b></div>`; return; }
    const sorted = list.slice().sort((a, b) => (ad.unlocked[b.id] || 0) - (ad.unlocked[a.id] || 0));
    body.innerHTML = `<div class="gb-ach-list">${sorted.map((a) => {
      const u = ad.unlocked && ad.unlocked[a.id], p = (ad.progress && ad.progress[a.id]) || 0, pct = Math.min(100, p / a.goal * 100);
      return `<div class="gb-ach ${u ? "done" : ""}"><span class="gb-ach-medal">${u ? "★" : ic("trophy", 16)}</span><div><b>${esc(a.name)}</b><small>${esc(a.desc)}</small>
        <div class="gb-bar"><i style="width:${pct}%"></i></div><small class="gb-ach-p">${u ? "Unlocked " + new Date(u).toLocaleDateString() : p + " / " + a.goal}</small></div></div>`;
    }).join("")}</div><button class="gb-link" data-a="all">${ic("trophy", 15)} Open Achievements</button>`;
    body.querySelector('[data-a="all"]').onclick = () => { closeBar(); WM.open("achievements"); };
  }

  // ---------------- Settings widget ----------------
  function buildSettings(L) {
    const s = gb().settings;
    L.body.innerHTML = `<div class="gb-set">
      <h4>Capturing</h4>
      <label class="gb-field"><span>Capture source</span><select data-k="source"><option value="screen"${canScreen() ? "" : " disabled"}>Real screen (browser screen sharing)</option><option value="page">Windows 12 page only</option></select></label>
      <label class="gb-check"><input type="checkbox" data-k="mic"> Record my microphone</label>
      <label class="gb-check"><input type="checkbox" data-k="sysAudio"${canScreen() ? "" : " disabled"}> Record audio from the shared tab/screen</label>
      <label class="gb-field"><span>Max recording length</span><select data-k="maxMin"><option value="5">5 minutes</option><option value="10">10 minutes</option><option value="30">30 minutes</option><option value="60">1 hour</option></select></label>
      <p class="gb-note">${canScreen() ? "Screen sharing gives real pixels of whatever you share." : "This browser has no screen sharing, so captures are page-only renders of Windows 12."} Background recording ("record last 30 seconds") isn't possible in a web page.</p>
      <h4>Shortcuts</h4>
      <dl class="gb-keys">
        <div><dt>Open Game Bar</dt><dd>${isApple ? "" : "Win+G · "}Ctrl+Alt+G</dd></div>
        <div><dt>Screenshot</dt><dd>${isApple ? "" : "Win+Alt+PrtScn · "}Ctrl+Alt+Shift+S</dd></div>
        <div><dt>Start/stop recording</dt><dd>${isApple ? "" : "Win+Alt+R · "}Ctrl+Alt+Shift+R</dd></div>
      </dl>
      <h4>Widgets</h4>
      <button class="gb-btn" data-a="reset">Reset widget layout</button>
    </div>`;
    const b = L.body;
    b.querySelectorAll("select[data-k]").forEach((x) => { x.value = String(s[x.dataset.k]); x.onchange = () => { const v = x.dataset.k === "maxMin" ? +x.value : x.value; gb().settings[x.dataset.k] = v; save(); refreshCaptureUI(); }; });
    b.querySelectorAll("input[data-k]").forEach((x) => { x.checked = !!s[x.dataset.k]; x.onchange = () => { gb().settings[x.dataset.k] = x.checked; save(); refreshCaptureUI(); }; });
    if (!canScreen()) b.querySelector('select[data-k="source"]').value = "page";
    b.querySelector('[data-a="reset"]').onclick = () => {
      const g = gb(); Object.keys(g.widgets).forEach((k) => { if (k !== "recbar") { const w = g.widgets[k]; delete w.x; delete w.y; w.pinned = false; w.open = DEFAULT_OPEN.indexOf(k) >= 0 || k === "settings"; } });
      save(); Object.keys(live).forEach((id) => { paintPin(id); const st = wstate(id); if (st.open) showWidget(id); else hideWidget(id); }); paintHome();
    };
    L.onShow = () => { b.querySelectorAll("select[data-k]").forEach((x) => { x.value = String(gb().settings[x.dataset.k]); }); if (!canScreen()) b.querySelector('select[data-k="source"]').value = "page"; b.querySelectorAll("input[data-k]").forEach((x) => { x.checked = !!gb().settings[x.dataset.k]; }); };
  }

  // =====================================================================
  //  Keyboard
  // =====================================================================
  function own(e) { e.preventDefault(); e.stopPropagation(); }
  window.addEventListener("keydown", (e) => {
    if (!desktopReady()) return;
    const code = e.code || "", k = e.key || "";
    const winKey = e.metaKey && !e.ctrlKey && !isApple;
    const ca = e.ctrlKey && e.altKey && !e.metaKey;
    const isPrt = k === "PrintScreen" || code === "PrintScreen";
    if ((winKey && !e.altKey && !e.shiftKey && (code === "KeyG" || k === "g" || k === "G")) || (ca && !e.shiftKey && code === "KeyG")) { own(e); toggleBar(); return; }
    if ((winKey && e.altKey && isPrt) || (ca && isPrt) || (ca && e.shiftKey && code === "KeyS")) { own(e); screenshot(); return; }
    if ((winKey && e.altKey && code === "KeyR") || (ca && e.shiftKey && code === "KeyR")) { own(e); toggleRecording(); return; }
    if (overlay && k === "Escape") { own(e); closeBar(); }
  }, true);
  // Some browsers only report PrintScreen on key-up.
  window.addEventListener("keyup", (e) => { if ((e.key === "PrintScreen" || e.code === "PrintScreen") && e.altKey && (e.metaKey || e.ctrlKey) && desktopReady()) { own(e); screenshot(); } }, true);

  // Pinned widgets come back after a reload once the desktop exists.
  (function waitDesktop() {
    const s = scr(); if (!s) return;
    let t = 0;
    new MutationObserver(() => { clearTimeout(t); t = setTimeout(restorePinned, 300); }).observe(s, { childList: true });
    setTimeout(restorePinned, 800);
  })();

  // =====================================================================
  //  Start menu entry
  // =====================================================================
  window.AppRegistry = window.AppRegistry || {};
  AppRegistry.gamebar = function () { setTimeout(openBar, 30); };
  try {
    if (window.Icon && Icon.alias) Icon.alias("gamebar", "xbox");
    if (window.Catalog && !Catalog.storeApps.find((a) => a.id === "gamebar")) {
      Catalog.storeApps.push({ id: "gamebar", name: "Xbox Game Bar", cat: "Games", price: 0, builtin: "gamebar", desc: "Capture screenshots and clips, watch performance, mix app audio and see achievements over any app (Win+G or Ctrl+Alt+G)." });
    }
    const ex = (window.EXTRA_DEFAULT_APPS = window.EXTRA_DEFAULT_APPS || []); if (ex.indexOf("gamebar") < 0) ex.push("gamebar");
  } catch (e) {}

  window.GameBar = {
    open: openBar, close: closeBar, toggle: toggleBar, isOpen: () => !!overlay,
    screenshot, startRecording, stopRecording, isRecording: () => !!Rec.active, recordingMode: () => Rec.mode || "",
    showWidget: (id) => { wstate(id).open = true; save(); showWidget(id); paintHome(); },
    captures: listCaptures, canScreen,
  };
})();
