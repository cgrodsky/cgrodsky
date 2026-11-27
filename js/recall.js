/* Recall (Windows 11 style) for Windows 12 — a searchable timeline of what you did.
   Open: Start → "Recall", Win+J or Ctrl+Alt+J.

   Every N seconds (default 60, configurable) while the desktop is in use, Recall saves a
   snapshot: the time, the open windows (app ids + titles), a small JPEG of the screen (rendered
   by GBSnap from js/gamebar.js) and the text visible in each window (innerText) for search.
   A snapshot is skipped when nothing on screen changed, when the page is hidden, after 10
   minutes without input, while paused, and always in kiosk mode.

   Privacy: snapshots live only in this browser (IndexedDB "win12-recall"), never uploaded.
   Password fields are always blanked; windows of filtered apps, sign-in / password pages and
   private-browsing windows are replaced by a "Filtered" block and their text isn't stored.
   Storage is capped (default 200 snapshots / 50 MB, oldest deleted first).
   Settings: State.data.appData.recall. */
(function () {
  "use strict";
  if (window.Recall) return;
  const S = () => State.data;
  const scr = () => document.getElementById("screen");
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const UA = navigator.userAgent || "";
  const isApple = /Mac|iPhone|iPad|iPod/.test(navigator.platform || "") || (/Macintosh/.test(UA) && "ontouchend" in document);
  const kiosk = () => document.body.classList.contains("kiosk-mode");
  const desktopReady = () => !!document.querySelector(".desktop") && !document.querySelector(".lock-screen, .boot-layer, .wsetup-screen");
  const toBlob = (c, type, q) => new Promise((res) => { try { c.toBlob((b) => res(b), type, q); } catch (e) { res(null); } });
  const fmtSize = (n) => n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : n >= 1024 ? Math.round(n / 1024) + " KB" : (n | 0) + " B";
  const save = () => { try { State.save(); } catch (e) {} };

  const DEF = { enabled: false, paused: false, interval: 60, maxSnaps: 200, maxMB: 50, exclude: ["security"], filterPw: true, filterPrivate: true, introShown: false };
  function cfg() {
    const d = S(); d.appData = d.appData || {};
    let r = d.appData.recall; if (!r || typeof r !== "object") r = d.appData.recall = {};
    Object.keys(DEF).forEach((k) => { if (r[k] === undefined) r[k] = Array.isArray(DEF[k]) ? DEF[k].slice() : DEF[k]; });
    if (!Array.isArray(r.exclude)) r.exclude = DEF.exclude.slice();
    return r;
  }

  // =====================================================================
  //  IndexedDB: "snaps" (metadata + text) and "thumbs" (JPEG blobs)
  // =====================================================================
  const DB_NAME = "win12-recall" + (window.WIN12_VM_DEPTH ? "__vm" + window.WIN12_VM_DEPTH : "");
  let dbp = null, dbBroken = false;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      try {
        if (!window.indexedDB) throw new Error("no indexedDB");
        const r = indexedDB.open(DB_NAME, 1);
        r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains("snaps")) d.createObjectStore("snaps", { keyPath: "id" }); if (!d.objectStoreNames.contains("thumbs")) d.createObjectStore("thumbs"); };
        r.onsuccess = () => { const d = r.result; d.onversionchange = () => { d.close(); dbp = null; }; res(d); }; r.onerror = () => rej(r.error || new Error("idb")); r.onblocked = () => rej(new Error("blocked"));
      } catch (e) { rej(e); }
    });
    dbp.catch(() => { dbBroken = true; });
    return dbp;
  }
  function req(r) { return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
  function done(t) { return new Promise((res, rej) => { t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error("abort")); }); }
  async function idbAll() { const d = await db(); return req(d.transaction("snaps").objectStore("snaps").getAll()); }
  async function idbPut(rec, blob) { const d = await db(); const t = d.transaction(["snaps", "thumbs"], "readwrite"); t.objectStore("snaps").put(rec); if (blob) t.objectStore("thumbs").put(blob, rec.id); return done(t); }
  async function idbDel(ids) { if (!ids.length) return; const d = await db(); const t = d.transaction(["snaps", "thumbs"], "readwrite"); ids.forEach((id) => { t.objectStore("snaps").delete(id); t.objectStore("thumbs").delete(id); }); return done(t); }
  async function idbClear() { const d = await db(); const t = d.transaction(["snaps", "thumbs"], "readwrite"); t.objectStore("snaps").clear(); t.objectStore("thumbs").clear(); return done(t); }
  async function idbThumb(id) { const d = await db(); return req(d.transaction("thumbs").objectStore("thumbs").get(id)); }

  let snaps = [], loaded = null;
  function load() {
    if (loaded) return loaded;
    loaded = idbAll().then((all) => { snaps = (all || []).sort((a, b) => a.ts - b.ts); emit(); return snaps; }).catch(() => { snaps = []; return snaps; });
    return loaded;
  }
  const listeners = new Set();
  function emit() { listeners.forEach((f) => { try { f(); } catch (e) {} }); try { paintTray(); } catch (e) {} }
  const totalBytes = () => snaps.reduce((s, r) => s + (r.size || 0), 0);

  // thumbnail object URLs (small LRU)
  const urls = new Map();
  async function thumbURL(id) {
    if (urls.has(id)) { const u = urls.get(id); urls.delete(id); urls.set(id, u); return u; }
    let b = null; try { b = await idbThumb(id); } catch (e) {}
    if (!b) return null;
    const u = URL.createObjectURL(b); urls.set(id, u);
    if (urls.size > 90) { const [k, v] = urls.entries().next().value; urls.delete(k); URL.revokeObjectURL(v); }
    return u;
  }
  function dropUrls(ids) { ids.forEach((id) => { const u = urls.get(id); if (u) { URL.revokeObjectURL(u); urls.delete(id); } }); }

  // =====================================================================
  //  What's on screen
  // =====================================================================
  const wins = () => (window.WM && WM.windows ? WM.windows() : []);
  function visibleWins() { return wins().filter((e) => e.win.isConnected && e.win.style.display !== "none" && !e.win.classList.contains("wx-offdesk")).sort((a, b) => (+b.win.style.zIndex || 0) - (+a.win.style.zIndex || 0)); }
  function titleOf(e) { const t = e && e.win.querySelector(".win-titlebar .t-text"); return (t && t.textContent.trim()) || (e && (e.title || e.appId)) || "Window"; }
  const isRecallWin = (w) => { const e = window.WM && WM.entryFor ? WM.entryFor(w) : null; return !!(e && e.appId === "recall"); };
  function shown(n) { return !!(n.offsetWidth || n.offsetHeight || n.getClientRects().length); }
  function excludeReason(e) {
    const c = cfg();
    if (e.appId && c.exclude.indexOf(e.appId) >= 0) return "app";
    if (c.filterPrivate && /\b(InPrivate|Incognito|Private (browsing|window|tab))\b/i.test(titleOf(e) + " " + ((e.win.querySelector(".inprivate, [data-private='true']") && "InPrivate") || ""))) return "private";
    if (c.filterPw) {
      const pw = Array.from(e.win.querySelectorAll('input[type="password"], input[data-pw-eye], input[autocomplete="current-password"], input[autocomplete="new-password"]')).some(shown);
      if (pw) return "password";
      if (e.appId === "settings") { const h = e.win.querySelector(".w12s-title"); if (h && /sign-in options|passkey|password/i.test(h.textContent)) return "signin"; }
    }
    return "";
  }
  function extractText(e) {
    const body = e.win.querySelector(".win-body"); if (!body) return "";
    let t = ""; try { t = body.innerText || ""; } catch (er) {}
    const vals = [];
    body.querySelectorAll("input").forEach((i) => {
      const ty = (i.type || "text").toLowerCase();
      if ((ty === "text" || ty === "search" || ty === "url") && i.value && shown(i) && !(window.GBSnap && GBSnap.isSecret(i))) vals.push(i.value.slice(0, 300));
    });
    return (vals.join("\n") + "\n" + t).replace(/[ \t ]+/g, " ").replace(/\s*\n\s*/g, "\n").trim().slice(0, 4000);
  }

  // =====================================================================
  //  Taking snapshots
  // =====================================================================
  let busy = false, lastSig = "", lastAt = Date.now() - 45000, lastInput = Date.now();
  ["pointerdown", "keydown", "wheel", "touchstart"].forEach((t) => window.addEventListener(t, () => { lastInput = Date.now(); }, { passive: true, capture: true }));
  function blockedReason(manual) {
    if (dbBroken || !window.indexedDB) return "Recall needs IndexedDB storage, which isn't available in this browser.";
    if (!window.GBSnap) return "The screen renderer (Game Bar) isn't loaded.";
    const c = cfg();
    if (!c.enabled) return "Saving snapshots is turned off.";
    if (kiosk()) return "Recall is off in kiosk mode.";
    if (!desktopReady()) return "The desktop is locked.";
    if (!manual) {
      if (c.paused) return "Snapshots are paused.";
      if (document.visibilityState === "hidden") return "The page isn't visible.";
      if (Date.now() - lastInput > 10 * 60000) return "No activity for 10 minutes.";
    }
    return "";
  }
  async function capture(reason) {
    reason = reason || "auto";
    if (busy) return { ok: false, why: "A snapshot is already being saved." };
    const why = blockedReason(reason === "manual"); if (why) return { ok: false, why };
    busy = true;
    try {
      await load();
      const vis = visibleWins(), filtered = new Set(), apps = [];
      vis.forEach((e) => {
        if (e.appId === "recall") return;
        if (excludeReason(e)) { filtered.add(e.win); return; }
        apps.push({ appId: e.appId || "", title: titleOf(e).slice(0, 160), text: extractText(e) });
      });
      const sig = apps.map((a) => a.appId + "\u0001" + a.title + "\u0001" + a.text).join("\u0002") + "|" + filtered.size;
      if (reason === "auto" && sig === lastSig) { lastAt = Date.now(); return { ok: false, why: "Nothing changed on screen." }; }
      const W = scr().clientWidth || innerWidth;
      const r = await GBSnap.render({ scale: Math.min(1, 960 / W), exclude: (w) => filtered.has(w), hide: isRecallWin });
      const blob = await toBlob(r.canvas, "image/jpeg", 0.62);
      const ts = Date.now();
      const textBytes = apps.reduce((s, a) => s + a.text.length + a.title.length, 0);
      const rec = { id: ts, ts, apps, filtered: filtered.size, mode: r.mode, w: r.canvas.width, h: r.canvas.height, size: (blob ? blob.size : 0) + textBytes, reason, ms: r.ms };
      await idbPut(rec, blob);
      snaps.push(rec); lastSig = sig; lastAt = ts;
      await enforceCaps();
      emit();
      const c = cfg();
      if (!c.introShown && reason === "auto") {
        c.introShown = true; save();
        if (window.Notify) Notify.show({ icon: window.Icon ? Icon.mini("recall", "Recall") : "", title: "Recall is saving snapshots", body: "Every " + c.interval + " s Recall saves a small picture and the text of your windows on this device, so you can search what you did. Pause it from the taskbar or in Recall settings.", onClick: () => openApp() });
      }
      return { ok: true, rec };
    } catch (e) {
      return { ok: false, why: "The snapshot couldn't be saved (" + (e && e.name || "error") + ")." };
    } finally { busy = false; }
  }
  async function enforceCaps() {
    const c = cfg(), maxB = c.maxMB * 1048576;
    let total = totalBytes(); const drop = [];
    while (snaps.length && (snaps.length > c.maxSnaps || total > maxB)) { const r = snaps.shift(); total -= r.size || 0; drop.push(r.id); }
    if (drop.length) { await idbDel(drop); dropUrls(drop); emit(); }
    return drop.length;
  }
  async function deleteWhere(fn) {
    await load();
    const drop = snaps.filter(fn).map((r) => r.id);
    if (!drop.length) return 0;
    await idbDel(drop); dropUrls(drop);
    snaps = snaps.filter((r) => drop.indexOf(r.id) < 0);
    lastSig = ""; emit();
    return drop.length;
  }
  async function deleteAll() { await load(); await idbClear(); dropUrls(snaps.map((r) => r.id)); const n = snaps.length; snaps = []; lastSig = ""; emit(); return n; }

  setInterval(() => {
    const c = cfg();
    if (Date.now() - lastAt < c.interval * 1000) return;
    if (blockedReason(false)) return;
    capture("auto");
  }, 5000);

  // =====================================================================
  //  Tray icon + flyout ("Pause Recall")
  // =====================================================================
  const ICON = `<svg class="rl-logo" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><defs><linearGradient id="rlg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4cc2ff"/><stop offset=".55" stop-color="#7a5cff"/><stop offset="1" stop-color="#ff6fb1"/></linearGradient></defs><rect x="2.5" y="4" width="14" height="11" rx="2.4" fill="none" stroke="url(#rlg)" stroke-width="2"/><rect x="7.5" y="9" width="14" height="11" rx="2.4" fill="url(#rlg)" opacity=".9"/><path d="M12 14.5h6M12 17h4" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/></svg>`;
  const IC = {
    search: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>',
    pause: '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><rect x="6.5" y="5" width="4" height="14" rx="1.2"/><rect x="13.5" y="5" width="4" height="14" rx="1.2"/></svg>',
    play: '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M8 5.5v13l10.5-6.5z"/></svg>',
    gear: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/></svg>',
    camera: '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M8.5 7l1.5-2.5h4L15.5 7"/><circle cx="12" cy="13.5" r="3.6"/></svg>',
    prev: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 5l-7 7 7 7"/></svg>',
    next: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 5l7 7-7 7"/></svg>',
    open: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
    trash: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/></svg>',
    copy: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
    back: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 5l-7 7 7 7"/></svg>',
  };
  try {
    if (window.Icon && Icon.register) Icon.register("recall", `<svg viewBox="0 0 48 48" width="100%" height="100%"><defs><linearGradient id="rlgi" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4cc2ff"/><stop offset=".55" stop-color="#7a5cff"/><stop offset="1" stop-color="#ff6fb1"/></linearGradient></defs><rect x="4" y="8" width="28" height="22" rx="5" fill="none" stroke="url(#rlgi)" stroke-width="3.5"/><rect x="15" y="18" width="29" height="22" rx="5" fill="url(#rlgi)"/><path d="M21 27h17M21 32h11" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></svg>`);
  } catch (e) {}

  let fly = null;
  function paintTray() {
    const tray = document.querySelector(".taskbar .tb-tray"); if (!tray) return;
    let b = tray.querySelector(".rl-tray");
    const c = cfg();
    if (!c.enabled || kiosk()) { if (b) b.remove(); return; }
    if (!b) {
      b = el(`<button class="rl-tray" aria-label="Recall">${ICON}<i class="rl-tray-dot"></i></button>`);
      tray.insertBefore(b, tray.firstChild);
      b.addEventListener("click", (e) => { e.stopPropagation(); if (fly) closeFly(); else openFly(b); });
    }
    b.classList.toggle("paused", !!c.paused);
    b.title = c.paused ? "Recall · snapshots paused" : "Recall · saving snapshots every " + c.interval + " s";
    if (fly) paintFly();
  }
  function openFly(anchor) {
    closeFly();
    fly = el(`<div class="rl-fly gbs-skip" role="dialog" aria-label="Recall"></div>`);
    scr().appendChild(fly);
    const r = anchor.getBoundingClientRect();
    fly.style.right = Math.max(8, innerWidth - r.right - 60) + "px";
    paintFly();
    setTimeout(() => { document.addEventListener("pointerdown", outside, true); document.addEventListener("keydown", flyKey, true); }, 0);
  }
  function outside(e) { if (fly && !fly.contains(e.target) && !e.target.closest(".rl-tray")) closeFly(); }
  function flyKey(e) { if (e.key === "Escape" && fly) { e.preventDefault(); closeFly(); } }
  function closeFly() { if (fly) { fly.remove(); fly = null; } document.removeEventListener("pointerdown", outside, true); document.removeEventListener("keydown", flyKey, true); }
  function paintFly() {
    if (!fly) return;
    const c = cfg();
    fly.innerHTML = `<div class="rl-fly-h">${ICON}<b>Recall</b><span class="rl-fly-st ${c.paused ? "off" : "on"}">${c.paused ? "Paused" : "Saving snapshots"}</span></div>
      <p>${c.paused ? "No new snapshots are being saved." : "A snapshot every " + c.interval + " s while you use Windows 12 (skipped when nothing changes)."}</p>
      <button class="rl-btn rl-primary" data-a="pause">${c.paused ? IC.play + " Resume snapshots" : IC.pause + " Pause snapshots"}</button>
      <div class="rl-fly-meta">${snaps.length} snapshot${snaps.length === 1 ? "" : "s"} · ${fmtSize(totalBytes())} of ${c.maxMB} MB</div>
      <div class="rl-fly-links"><button class="rl-link" data-a="open">Open Recall</button><button class="rl-link" data-a="settings">Settings</button></div>`;
    fly.querySelector('[data-a="pause"]').onclick = () => { setPaused(!cfg().paused); };
    fly.querySelector('[data-a="open"]').onclick = () => { closeFly(); openApp(); };
    fly.querySelector('[data-a="settings"]').onclick = () => { closeFly(); openApp({ view: "settings" }); };
  }
  function setPaused(p) {
    const c = cfg(); c.paused = !!p; save(); emit();
    if (window.EventLog && EventLog.add) { try { EventLog.add("Application", "Information", "Recall", 200, p ? "Recall snapshots paused." : "Recall snapshots resumed."); } catch (e) {} }
  }
  (function watchTaskbar() {
    const s = scr(); if (!s) return;
    let t = 0;
    new MutationObserver(() => { clearTimeout(t); t = setTimeout(paintTray, 200); }).observe(s, { childList: true });
    setTimeout(paintTray, 600);
  })();
  window.addEventListener("load", () => { if (window.indexedDB) load(); });
  if (document.readyState !== "loading" && window.indexedDB) load();

  // =====================================================================
  //  Search helpers
  // =====================================================================
  function hay(r) { if (!r._hay) r._hay = r.apps.map((a) => a.title + "\n" + a.text).join("\n").toLowerCase(); return r._hay; }
  const termsOf = (q) => String(q || "").toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8);
  function matches(r, terms) { if (!terms.length) return false; const h = hay(r); return terms.every((t) => h.indexOf(t) >= 0); }
  function reEsc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  function highlight(text, terms) {
    const t = esc(text); if (!terms.length) return t;
    const re = new RegExp("(" + terms.map((x) => reEsc(esc(x))).join("|") + ")", "gi");
    return t.replace(re, "<mark>$1</mark>");
  }
  function snippet(r, terms) {
    for (const a of r.apps) {
      const src = a.title + " — " + a.text.replace(/\n/g, " · "), low = src.toLowerCase();
      const i = terms.reduce((m, t) => { const k = low.indexOf(t); return k >= 0 && (m < 0 || k < m) ? k : m; }, -1);
      if (i >= 0) { const s = Math.max(0, i - 50), e = Math.min(src.length, i + 110); return (s ? "…" : "") + highlight(src.slice(s, e), terms) + (e < src.length ? "…" : ""); }
    }
    return "";
  }
  function whenText(ts) {
    const d = new Date(ts), now = new Date();
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const tm = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    if (ts >= day) return "Today, " + tm;
    if (ts >= day - 86400000) return "Yesterday, " + tm;
    return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }) + ", " + tm;
  }
  function appName(id) { const a = window.Catalog && Catalog.storeApps.find((x) => x.id === id || x.builtin === id); return a ? a.name : id; }
  function canOpen(id) { return !!id && (!!(window.AppRegistry && AppRegistry[id]) || !!(window.Catalog && Catalog.storeApps.some((x) => x.id === id || x.builtin === id))); }
  function reopen(appId, title) {
    const open = wins().find((e) => e.appId === appId && (!title || titleOf(e) === title)) || wins().find((e) => e.appId === appId);
    if (open) { WM.focusWindow(open.win); return; }
    if (canOpen(appId)) WM.open(appId);
    else if (window.Notify) Notify.show({ icon: "", title: "Recall", body: esc(title || appId) + " can't be reopened from here." });
  }

  // =====================================================================
  //  The Recall app
  // =====================================================================
  let app = null; // { ref, ... }
  function openApp(opts) {
    opts = opts || {};
    const ex = wins().find((e) => e.appId === "recall");
    if (ex && app) { WM.focusWindow(ex.win); if (opts.view) app.go(opts.view); return; }
    buildApp(opts);
  }
  function buildApp(opts) {
    const W = Math.min(1120, innerWidth - 24), H = Math.min(740, innerHeight - 70);
    const ref = WM.createWindow({ title: "Recall", icon: Icon.mini("recall", "Recall"), width: W, height: H, appId: "recall", onClose: () => { unsub(); app = null; } });
    const body = ref.body; body.classList.add("rl-host");
    body.innerHTML = `<div class="rl">
      <header class="rl-top">
        <div class="rl-brand">${ICON}<b>Recall</b></div>
        <label class="rl-search">${IC.search}<input type="search" placeholder="Search your snapshots: words, apps, windows" aria-label="Search Recall" data-no-eye autocomplete="off"></label>
        <div class="rl-tools">
          <button class="rl-tb rl-pausebtn"></button>
          <button class="rl-tb" data-a="now" title="Save a snapshot now">${IC.camera}</button>
          <button class="rl-tb" data-a="settings" title="Recall settings">${IC.gear}</button>
        </div>
      </header>
      <div class="rl-banner" hidden></div>
      <div class="rl-tl" tabindex="0" role="slider" aria-label="Timeline" aria-valuemin="0">
        <div class="rl-tl-labels"></div>
        <div class="rl-tl-track"><div class="rl-tl-ticks"></div><div class="rl-tl-handle"></div></div>
        <div class="rl-tl-pop" hidden><img alt=""><span></span></div>
      </div>
      <main class="rl-main">
        <section class="rl-view">
          <div class="rl-stage">
            <button class="rl-nav" data-a="prev" aria-label="Earlier snapshot">${IC.prev}</button>
            <figure class="rl-shot"><img alt="Snapshot"><figcaption></figcaption></figure>
            <button class="rl-nav" data-a="next" aria-label="Later snapshot">${IC.next}</button>
          </div>
          <aside class="rl-side"></aside>
        </section>
        <section class="rl-results" hidden></section>
        <section class="rl-settings" hidden></section>
        <section class="rl-empty" hidden></section>
      </main>
    </div>`;
    const $ = (s) => body.querySelector(s);
    const input = $(".rl-search input"), tl = $(".rl-tl"), track = $(".rl-tl-track"), ticks = $(".rl-tl-ticks"), handle = $(".rl-tl-handle"), pop = $(".rl-tl-pop"), labels = $(".rl-tl-labels");
    const view = $(".rl-view"), results = $(".rl-results"), setv = $(".rl-settings"), empty = $(".rl-empty"), side = $(".rl-side"), shotImg = $(".rl-shot img"), cap = $(".rl-shot figcaption");
    let idx = -1, mode = "view", terms = [], qTimer = 0;

    function go(v) {
      mode = v;
      const none = !snaps.length;
      view.hidden = v !== "view" || none; results.hidden = v !== "results"; setv.hidden = v !== "settings"; empty.hidden = !(v === "view" && none);
      tl.hidden = v === "settings";
      if (v === "settings") paintSettings();
      if (v === "results") paintResults();
      if (v === "view") { if (none) paintEmpty(); else show(idx < 0 ? snaps.length - 1 : idx); }
      paintTools();
    }
    function paintTools() {
      const c = cfg(), pb = $(".rl-pausebtn");
      pb.innerHTML = c.paused ? IC.play : IC.pause;
      pb.title = c.paused ? "Resume snapshots" : "Pause snapshots";
      pb.setAttribute("aria-label", pb.title); pb.classList.toggle("on", !!c.paused);
      $('[data-a="settings"]').classList.toggle("on", mode === "settings");
      const ban = $(".rl-banner"), why = !c.enabled ? "Saving snapshots is off. Turn it on in settings to build your timeline." : kiosk() ? "Recall is off in kiosk mode." : c.paused ? "Snapshots are paused. Recall isn't saving anything new." : (dbBroken || !window.indexedDB) ? "This browser can't store snapshots (no IndexedDB)." : "";
      ban.hidden = !why; ban.textContent = why;
    }
    function paintEmpty() {
      empty.innerHTML = `<div class="rl-empty-in">${ICON.replace('width="18" height="18"', 'width="64" height="64"')}<h2>Your timeline is empty</h2>
        <p>Recall saves a snapshot every ${cfg().interval} seconds while you use Windows 12: a small picture of the screen and the text in your windows. Then you can scroll back in time or search for something you saw.</p>
        <p class="rl-dim">Snapshots stay in this browser and are never uploaded. Password fields are always blanked, and filtered apps and sign-in pages are hidden.</p>
        <button class="rl-btn rl-primary" data-a="first">${IC.camera} Save a snapshot now</button></div>`;
      empty.querySelector('[data-a="first"]').onclick = snapNow;
    }
    async function snapNow() {
      const r = await capture("manual");
      if (!r.ok && window.Notify) Notify.show({ icon: Icon.mini("recall", "Recall"), title: "No snapshot saved", body: esc(r.why) });
      if (r.ok) { idx = snaps.length - 1; if (mode !== "view") go("view"); else show(idx); }
    }

    // ---- timeline ----
    function paintTimeline() {
      const n = snaps.length;
      tl.setAttribute("aria-valuemax", String(Math.max(0, n - 1)));
      if (!n) { ticks.innerHTML = ""; labels.innerHTML = ""; handle.hidden = true; return; }
      handle.hidden = false;
      const frag = document.createDocumentFragment();
      const tw = track.clientWidth || 600;
      snaps.forEach((r, i) => {
        const t = document.createElement("i");
        t.style.left = pos(i) + "%";
        if (terms.length && matches(r, terms)) t.className = "hit";
        if (r.filtered) t.classList.add("flt");
        frag.appendChild(t);
      });
      ticks.innerHTML = ""; ticks.appendChild(frag);
      // time labels where the hour/day changes, spaced out
      labels.innerHTML = ""; let lastX = -999, lastKey = "";
      snaps.forEach((r, i) => {
        const d = new Date(r.ts), key = d.toDateString() + d.getHours();
        if (key === lastKey) return; lastKey = key;
        const x = pos(i) / 100 * tw; if (x - lastX < 84) return; lastX = x;
        const s = document.createElement("span"); s.style.left = pos(i) + "%";
        s.textContent = (i === 0 || new Date(snaps[i - 1].ts).toDateString() !== d.toDateString()) ? whenText(r.ts).replace(/, .*/, "") + " " + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        labels.appendChild(s);
      });
      placeHandle();
    }
    const pos = (i) => snaps.length <= 1 ? 100 : i / (snaps.length - 1) * 100;
    function placeHandle() { if (idx >= 0) { handle.style.left = pos(idx) + "%"; tl.setAttribute("aria-valuenow", String(idx)); tl.setAttribute("aria-valuetext", snaps[idx] ? whenText(snaps[idx].ts) : ""); } }
    function idxAt(clientX) { const r = track.getBoundingClientRect(); const f = clamp((clientX - r.left) / Math.max(1, r.width), 0, 1); return Math.round(f * (snaps.length - 1)); }
    let dragging = false;
    tl.addEventListener("pointerdown", (e) => {
      if (!snaps.length || e.button) return;
      e.preventDefault(); dragging = true; tl.classList.add("drag");
      try { tl.setPointerCapture(e.pointerId); } catch (er) {}
      if (mode !== "view") go("view");
      scrubTo(idxAt(e.clientX), e.clientX);
    });
    tl.addEventListener("pointermove", (e) => {
      if (!snaps.length) return;
      if (dragging) { scrubTo(idxAt(e.clientX), e.clientX); return; }
      if (e.pointerType === "mouse") showPop(idxAt(e.clientX), e.clientX);
    });
    const endDrag = () => { if (!dragging) return; dragging = false; tl.classList.remove("drag"); pop.hidden = true; };
    tl.addEventListener("pointerup", endDrag); tl.addEventListener("pointercancel", endDrag);
    tl.addEventListener("pointerleave", () => { if (!dragging) pop.hidden = true; });
    tl.addEventListener("keydown", (e) => {
      if (!snaps.length) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); stepBy(-1); }
      else if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); stepBy(1); }
      else if (e.key === "Home") { e.preventDefault(); if (mode !== "view") go("view"); show(0); }
      else if (e.key === "End") { e.preventDefault(); if (mode !== "view") go("view"); show(snaps.length - 1); }
    });
    function stepBy(d) { if (mode !== "view") go("view"); show(clamp(idx + d, 0, snaps.length - 1)); }
    let scrubI = -1;
    function scrubTo(i, x) { if (i !== scrubI) { scrubI = i; show(i); } showPop(i, x); }
    let popTok = 0;
    async function showPop(i, x) {
      const r = snaps[i]; if (!r) return;
      const tr = tl.getBoundingClientRect();
      pop.hidden = false;
      pop.style.left = clamp(x - tr.left, 90, tr.width - 90) + "px";
      pop.querySelector("span").textContent = whenText(r.ts);
      const tok = ++popTok, u = await thumbURL(r.id);
      if (tok === popTok && u) pop.querySelector("img").src = u;
    }

    // ---- the selected snapshot ----
    let showTok = 0;
    async function show(i) {
      if (!snaps.length) { go("view"); return; }
      idx = clamp(i, 0, snaps.length - 1);
      const r = snaps[idx]; placeHandle();
      body.querySelector('[data-a="prev"]').disabled = idx <= 0;
      body.querySelector('[data-a="next"]').disabled = idx >= snaps.length - 1;
      cap.innerHTML = `<b>${esc(whenText(r.ts))}</b><span>${idx + 1} of ${snaps.length}${r.mode === "simplified" ? " · simplified picture" : ""}</span>`;
      paintSide(r);
      const tok = ++showTok, u = await thumbURL(r.id);
      if (tok !== showTok) return;
      if (u) { shotImg.src = u; shotImg.hidden = false; } else shotImg.hidden = true;
    }
    function paintSide(r) {
      const chips = r.apps.map((a, k) => `<div class="rl-app"><span class="rl-app-ic">${Icon.mini(a.appId || "app", a.title)}</span><div class="rl-app-t"><b>${highlight(a.title, terms)}</b><small>${esc(appName(a.appId) || "App")}</small></div>
        ${canOpen(a.appId) ? `<button class="rl-btn rl-sm" data-open="${k}">${IC.open} Open</button>` : ""}</div>`).join("");
      const text = r.apps.filter((a) => a.text).map((a) => `<div class="rl-txt-app"><b>${esc(a.title)}</b><p>${highlight(a.text, terms).replace(/\n/g, "<br>")}</p></div>`).join("");
      const act = activityAround(r);
      side.innerHTML = `<h3>In this snapshot</h3>
        <div class="rl-apps">${chips || `<p class="rl-dim">No app windows were open — just the desktop.</p>`}${r.filtered ? `<p class="rl-dim rl-flt">${r.filtered} window${r.filtered === 1 ? " was" : "s were"} filtered for privacy.</p>` : ""}</div>
        ${act ? `<h3>Around this time</h3><ul class="rl-act">${act}</ul>` : ""}
        <h3>Text Recall found</h3>
        <div class="rl-text">${text || `<p class="rl-dim">No text.</p>`}</div>
        <div class="rl-side-acts"><button class="rl-btn rl-sm" data-a="copy">${IC.copy} Copy text</button><button class="rl-btn rl-sm rl-danger" data-a="del">${IC.trash} Delete snapshot</button></div>`;
      side.querySelectorAll("[data-open]").forEach((b) => b.onclick = () => { const a = r.apps[+b.dataset.open]; reopen(a.appId, a.title); });
      side.querySelector('[data-a="copy"]').onclick = () => {
        const t = r.apps.map((a) => a.title + "\n" + a.text).join("\n\n");
        try { navigator.clipboard.writeText(t).then(() => toast("Copied the snapshot's text"), () => toast("Couldn't copy — select the text instead")); } catch (e) { toast("Couldn't copy — select the text instead"); }
      };
      side.querySelector('[data-a="del"]').onclick = async () => { const id = r.id; await deleteWhere((x) => x.id === id); };
      const m = side.querySelector(".rl-text mark"); if (m) m.scrollIntoView({ block: "nearest" });
    }
    function toast(t) { if (window.Notify) Notify.show({ icon: Icon.mini("recall", "Recall"), title: "Recall", body: esc(t) }); }
    function activityAround(r) {
      if (!window.EventLog || !EventLog.list) return "";
      const prev = snaps[snaps.indexOf(r) - 1], from = prev ? prev.ts : r.ts - cfg().interval * 1000;
      const ev = EventLog.list("Application").filter((e) => (e.id === 9707 || e.id === 9708) && e.source === "Shell-Core" && e.ts > from && e.ts <= r.ts).slice(0, 6);
      return ev.map((e) => { const m = /'([^']*)'/.exec(e.msg); return `<li><span>${new Date(e.ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span> ${e.id === 9707 ? "Opened" : "Closed"} ${esc(m ? m[1] : (e.data && e.data.app) || "an app")}</li>`; }).join("");
    }
    body.querySelector('[data-a="prev"]').onclick = () => show(idx - 1);
    body.querySelector('[data-a="next"]').onclick = () => show(idx + 1);
    // swipe on the picture (touch)
    (function swipe() {
      let sx = 0, on = false;
      const st = $(".rl-shot");
      st.addEventListener("pointerdown", (e) => { if (e.pointerType === "mouse") return; on = true; sx = e.clientX; });
      st.addEventListener("pointerup", (e) => { if (!on) return; on = false; const dx = e.clientX - sx; if (dx > 60) show(idx - 1); else if (dx < -60) show(idx + 1); });
      st.addEventListener("pointercancel", () => { on = false; });
    })();

    // ---- search ----
    input.addEventListener("input", () => { clearTimeout(qTimer); qTimer = setTimeout(runSearch, 160); });
    input.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") { clearTimeout(qTimer); runSearch(); } if (e.key === "Escape") { input.value = ""; runSearch(); } });
    function runSearch() {
      terms = termsOf(input.value);
      paintTimeline();
      if (terms.length) go("results"); else go("view");
    }
    async function paintResults() {
      const hits = snaps.filter((r) => matches(r, terms)).reverse();
      results.innerHTML = `<div class="rl-res-h"><b>${hits.length ? hits.length + " snapshot" + (hits.length === 1 ? "" : "s") : "No snapshots"}</b> match “${esc(input.value.trim())}”${hits.length ? " · newest first" : ""}</div>
        <div class="rl-grid"></div>`;
      const grid = results.querySelector(".rl-grid");
      if (!hits.length) { grid.innerHTML = `<p class="rl-dim rl-pad">Try other words. Recall searches window titles and the text that was on screen (not pictures).</p>`; return; }
      hits.slice(0, 80).forEach((r) => {
        const first = r.apps.find((a) => hay({ apps: [a] }).indexOf(terms[0]) >= 0) || r.apps[0];
        const card = el(`<div class="rl-card" tabindex="0" role="button" aria-label="Snapshot ${esc(whenText(r.ts))}"><div class="rl-card-img"><img alt=""></div>
          <div class="rl-card-b"><div class="rl-card-t"><b>${esc(whenText(r.ts))}</b>${first ? `<span>${Icon.mini(first.appId || "app", first.title)}</span>` : ""}</div>
          <p class="rl-snip">${snippet(r, terms)}</p>
          ${first && canOpen(first.appId) ? `<button class="rl-btn rl-sm" data-open>${IC.open} Open ${esc(appName(first.appId))}</button>` : ""}</div></div>`);
        card.onclick = (e) => { if (e.target.closest("[data-open]")) return; idx = snaps.indexOf(r); go("view"); };
        card.onkeydown = (e) => { if (e.key === "Enter") card.onclick(e); };
        const ob = card.querySelector("[data-open]"); if (ob) ob.onclick = () => reopen(first.appId, first.title);
        grid.appendChild(card);
        thumbURL(r.id).then((u) => { if (u) card.querySelector("img").src = u; });
      });
    }

    // ---- settings page ----
    function paintSettings() {
      const c = cfg(), used = totalBytes();
      const pct = Math.min(100, used / (c.maxMB * 1048576) * 100);
      const appsList = (window.Catalog ? Catalog.storeApps.slice() : []).filter((a) => a.id && a.name).sort((a, b) => a.name.localeCompare(b.name));
      const nameFor = (id) => { const a = appsList.find((x) => x.id === id || x.builtin === id); return a ? a.name : id; };
      setv.innerHTML = `<div class="rl-set">
        <button class="rl-btn rl-sm" data-a="back">${IC.back} Back to timeline</button>
        <h2>Recall &amp; snapshots</h2>
        <div class="rl-card-s">
          <div class="rl-row"><div><b>Save snapshots</b><small>Take snapshots of your screen and save them on this device.</small></div><label class="rl-sw"><input type="checkbox" data-k="enabled"><i></i></label></div>
          <div class="rl-row"><div><b>Pause snapshots</b><small>Stops new snapshots until you resume. Also in the taskbar (Recall icon).</small></div><label class="rl-sw"><input type="checkbox" data-k="paused"><i></i></label></div>
          <div class="rl-row"><div><b>Snapshot interval</b><small>How often Recall looks at the screen. Unchanged screens aren't saved again.</small></div>
            <select data-n="interval"><option value="15">15 seconds</option><option value="30">30 seconds</option><option value="60">1 minute</option><option value="120">2 minutes</option><option value="300">5 minutes</option><option value="600">10 minutes</option></select></div>
        </div>
        <h3>Storage</h3>
        <div class="rl-card-s">
          <div class="rl-row rl-col"><div><b>${snaps.length} snapshot${snaps.length === 1 ? "" : "s"} · ${fmtSize(used)} of ${c.maxMB} MB used</b><small>Stored in this browser (IndexedDB). Oldest snapshots are deleted first when a limit is reached.</small></div>
            <div class="rl-meter" role="meter" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div></div>
          <div class="rl-row"><div><b>Maximum storage</b></div><select data-n="maxMB"><option value="10">10 MB</option><option value="25">25 MB</option><option value="50">50 MB</option><option value="100">100 MB</option><option value="200">200 MB</option></select></div>
          <div class="rl-row"><div><b>Maximum snapshots</b></div><select data-n="maxSnaps"><option value="50">50</option><option value="100">100</option><option value="200">200</option><option value="500">500</option></select></div>
        </div>
        <h3>Filter lists</h3>
        <div class="rl-card-s">
          <div class="rl-row"><div><b>Filter sign-in and password pages</b><small>Windows showing a password field, and Settings › Sign-in options, are hidden and their text isn't saved. Password fields are always blanked.</small></div><label class="rl-sw"><input type="checkbox" data-k="filterPw"><i></i></label></div>
          <div class="rl-row"><div><b>Filter private browsing</b><small>Windows titled InPrivate / Incognito / Private browsing are hidden.</small></div><label class="rl-sw"><input type="checkbox" data-k="filterPrivate"><i></i></label></div>
          <div class="rl-row rl-col"><div><b>Apps to filter</b><small>Recall never saves these apps' windows or text.</small></div>
            <div class="rl-chips">${c.exclude.map((id) => `<span class="rl-chip">${Icon.mini(id, nameFor(id))}${esc(nameFor(id))}<button aria-label="Remove ${esc(nameFor(id))}" data-rm="${esc(id)}">×</button></span>`).join("") || `<span class="rl-dim">No apps filtered.</span>`}</div>
            <div class="rl-add"><select class="rl-addsel" aria-label="App to filter"><option value="">Add an app…</option>${appsList.filter((a) => c.exclude.indexOf(a.id) < 0).map((a) => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join("")}</select><button class="rl-btn rl-sm" data-a="add">Add</button></div></div>
        </div>
        <h3>Delete snapshots</h3>
        <div class="rl-card-s">
          <div class="rl-row"><div><b>Delete snapshots from a time range</b></div><span class="rl-btns"><button class="rl-btn rl-sm" data-del="3600000">Past hour</button><button class="rl-btn rl-sm" data-del="86400000">Past 24 hours</button></span></div>
          <div class="rl-row"><div><b>Delete all snapshots</b><small>Removes every snapshot, picture and saved text.</small></div><button class="rl-btn rl-sm rl-danger" data-a="delall">${IC.trash} Delete all</button></div>
        </div>
        <p class="rl-dim rl-pad">Recall in Windows 12 runs entirely in this browser: snapshots are rendered from the Windows 12 page (not your real screen), kept in IndexedDB on this device and never uploaded. Turned off in kiosk mode. Shortcut: ${isApple ? "" : "Win+J or "}Ctrl+Alt+J.</p>
      </div>`;
      setv.querySelector('[data-a="back"]').onclick = () => go("view");
      setv.querySelectorAll("input[data-k]").forEach((x) => { x.checked = !!c[x.dataset.k]; x.onchange = () => { if (x.dataset.k === "paused") setPaused(x.checked); else { cfg()[x.dataset.k] = x.checked; save(); emit(); } paintTools(); }; });
      setv.querySelectorAll("select[data-n]").forEach((x) => { x.value = String(c[x.dataset.n]); x.onchange = async () => { cfg()[x.dataset.n] = +x.value; save(); if (x.dataset.n !== "interval") await enforceCaps(); emit(); paintSettings(); }; });
      setv.querySelectorAll("[data-rm]").forEach((b) => b.onclick = () => { const cc = cfg(); cc.exclude = cc.exclude.filter((x) => x !== b.dataset.rm); save(); paintSettings(); });
      setv.querySelector('[data-a="add"]').onclick = () => { const v = setv.querySelector(".rl-addsel").value; if (!v) return; const cc = cfg(); if (cc.exclude.indexOf(v) < 0) cc.exclude.push(v); save(); paintSettings(); };
      setv.querySelectorAll("[data-del]").forEach((b) => b.onclick = async () => { const since = Date.now() - +b.dataset.del; const n = await deleteWhere((r) => r.ts >= since); toast(n ? "Deleted " + n + " snapshot" + (n === 1 ? "" : "s") : "No snapshots in that time range"); paintSettings(); });
      setv.querySelector('[data-a="delall"]').onclick = async () => { if (!confirm("Delete all Recall snapshots? This can't be undone.")) return; const n = await deleteAll(); toast("Deleted " + n + " snapshot" + (n === 1 ? "" : "s")); idx = -1; paintSettings(); };
    }

    // ---- wiring ----
    $(".rl-pausebtn").onclick = () => { setPaused(!cfg().paused); };
    $('[data-a="now"]').onclick = snapNow;
    $('[data-a="settings"]').onclick = () => go(mode === "settings" ? "view" : "settings");
    const onChange = () => {
      if (idx >= snaps.length) idx = snaps.length - 1;
      paintTimeline(); paintTools();
      if (mode === "view") { if (!snaps.length) go("view"); else if (!view.hidden) show(idx < 0 ? snaps.length - 1 : idx); else go("view"); }
      else if (mode === "results") paintResults();
      else if (mode === "settings") paintSettings();
    };
    listeners.add(onChange);
    const unsub = () => listeners.delete(onChange);
    let ro = null; if (window.ResizeObserver) { ro = new ResizeObserver(() => paintTimeline()); ro.observe(track); }
    app = { ref, go, show: (i) => show(i), search: (q) => { input.value = q; runSearch(); } };
    load().then(() => { idx = snaps.length - 1; paintTimeline(); go(opts.view || "view"); });
    go("view");
    setTimeout(() => { if (!opts.view) input.focus({ preventScroll: true }); }, 80);
  }

  // =====================================================================
  //  Keyboard + Start entry
  // =====================================================================
  window.addEventListener("keydown", (e) => {
    if (!desktopReady()) return;
    const code = e.code || "", k = e.key || "";
    const winKey = e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey && !isApple;
    const ca = e.ctrlKey && e.altKey && !e.metaKey && !e.shiftKey;
    if ((winKey && (code === "KeyJ" || k === "j" || k === "J")) || (ca && code === "KeyJ")) {
      e.preventDefault(); e.stopPropagation();
      const ex = wins().find((x) => x.appId === "recall");
      if (ex && app && ex.win.style.display !== "none" && +ex.win.style.zIndex >= Math.max(0, ...wins().map((x) => +x.win.style.zIndex || 0))) { if (ex.win.querySelector(".ctl-close")) ex.win.querySelector(".ctl-close").click(); }
      else openApp();
    }
  }, true);
  window.AppRegistry = window.AppRegistry || {};
  AppRegistry.recall = function () { openApp(); };
  try {
    if (window.Catalog && !Catalog.storeApps.find((a) => a.id === "recall")) {
      Catalog.storeApps.push({ id: "recall", name: "Recall", cat: "Productivity", price: 0, builtin: "recall", desc: "Scroll back through snapshots of what you did and search the text that was on screen (Win+J or Ctrl+Alt+J). Stays on this device." });
    }
    const ex = (window.EXTRA_DEFAULT_APPS = window.EXTRA_DEFAULT_APPS || []); if (ex.indexOf("recall") < 0) ex.push("recall");
  } catch (e) {}

  window.Recall = {
    open: openApp, capture, setPaused, deleteAll, deleteWhere, enforceCaps,
    snapshots: () => snaps.slice(), load, config: cfg, totalBytes, search: (q) => { const t = termsOf(q); return snaps.filter((r) => matches(r, t)); },
    app: () => app, excludeReason,
  };
})();
