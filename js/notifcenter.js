/* Notification Center + calendar flyout (Windows 11 style).
   Opens from the tray clock/date or the bell next to it, Win+N / Ctrl+Alt+N.
   - Wraps Notify.show (js/wm.js) so every notification is kept, with its app, time and icon,
     in State.data.appData.notifCenter (last 100). Callers are unchanged; they may also pass
     { app: "Name" } to choose the group.
   - Groups by app, newest first; dismiss one (×, or swipe right on touch), clear an app, clear all.
   - "Do not disturb" is the same switch as Quick Settings' Focus tile and Settings › Notifications
     (State.data.appData.quickSettings.focus): toasts stop popping up, but still land here.
   - A bell in the tray shows the unread count (bell with a "z" while Do not disturb is on).
   - Calendar: the real date (State.now), month navigation, today highlighted; pick a day to see
     its events from the Calendar app (State.data.appData.calendar.events).
   - Focus: set a length and open Clock's Focus tab (window.FocusSessions).
   Classes are prefixed sh2- (css/shell2.css). */
(function () {
  "use strict";
  const S = () => State.data;
  const save = () => { try { State.save(); } catch (_) {} };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const el = (html) => { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; };
  const now = () => { try { return State.now ? new Date(State.now()) : new Date(); } catch (_) { return new Date(); } };
  const h24 = () => !!(S().clock && S().clock.format24);
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const CAL_COLORS = ["#1a73e8", "#0f9d58", "#d93025", "#f4b400", "#a142f4", "#00897b", "#e8710a"];
  const calKey = (d) => d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  // Shared flyout coordinator (identical copy in js/widgets12.js; whichever loads first defines it).
  const Fly = window.Shell2Fly || (window.Shell2Fly = (function () {
    let cur = null;
    return {
      opening(name, closeFn) {
        if (cur && cur.name !== name) { const c = cur; cur = null; try { c.close(); } catch (_) {} }
        try { if (window.WM && WM.closeShellFlyouts) WM.closeShellFlyouts(); } catch (_) {}
        try { if (window.PowerTools && PowerTools.isOpen && PowerTools.isOpen()) PowerTools.close(); } catch (_) {}
        cur = { name, close: closeFn };
      },
      closed(name) { if (cur && cur.name === name) cur = null; },
      current: () => (cur ? cur.name : null),
    };
  })());

  const G = {
    bell: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2H4.5Z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0" stroke-linecap="round"/></svg>`,
    bellZ: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M6 16.5V11a6 6 0 0 1 8.2-5.6"/><path d="M18 13.5v3l1.5 2H4.5L6 16.5"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0" stroke-linecap="round"/><path d="M16 4.5h4.5L16 10h4.5" stroke-width="1.6" stroke-linecap="round"/></svg>`,
    close: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
    up: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l6-6 6 6"/></svg>`,
    down: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>`,
    win: `<svg viewBox="0 0 24 24" width="16" height="16"><path fill="#0a74d6" d="M3 3h8.5v8.5H3zM12.5 3H21v8.5h-8.5zM3 12.5h8.5V21H3zM12.5 12.5H21V21h-8.5z"/></svg>`,
    focus: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none"/></svg>`,
    plus: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`,
  };

  // ---------------------------------------------------------------------------
  //  Store
  // ---------------------------------------------------------------------------
  const MAX = 100;
  function nc() {
    const a = S().appData || (S().appData = {});
    const n = a.notifCenter || (a.notifCenter = { items: [] });
    if (!Array.isArray(n.items)) n.items = [];
    return n;
  }
  function qs() {
    const a = S().appData || (S().appData = {});
    return a.quickSettings || (a.quickSettings = { wifi: true, bt: false, plane: false, night: false, focus: false, brightness: 90, volume: 55, signal: "good" });
  }
  const dnd = () => { try { return !!(S().appData && S().appData.quickSettings && S().appData.quickSettings.focus); } catch (_) { return false; } };
  function setDnd(on) {
    qs().focus = !!on; save();
    try { window.dispatchEvent(new CustomEvent("quicksettings-change", { detail: { focus: !!on } })); } catch (_) {}
    paintBell(); if (panel) paintHead();
  }

  // ---------------------------------------------------------------------------
  //  Recording notifications (wraps Notify.show)
  // ---------------------------------------------------------------------------
  const clicks = new Map();   // item id -> onClick (this session only; functions can't be saved)
  function toText(h) {
    if (h == null) return "";
    const s = String(h);
    if (!/[<&]/.test(s)) return s.trim();
    try { const d = new DOMParser().parseFromString("<body>" + s.replace(/<br\s*\/?>/gi, "\n"), "text/html"); return (d.body.textContent || "").trim(); }
    catch (_) { return s.replace(/<[^>]*>/g, "").trim(); }
  }
  function cleanSvg(s) {
    try {
      const doc = new DOMParser().parseFromString(s, "image/svg+xml");
      const root = doc.documentElement;
      if (!root || root.nodeName.toLowerCase() !== "svg" || doc.querySelector("parsererror")) return null;
      root.querySelectorAll("script,foreignObject,image").forEach((n) => n.remove());
      [root].concat([...root.querySelectorAll("*")]).forEach((n) => [...n.attributes].forEach((a) => { if (/^on/i.test(a.name) || /javascript:/i.test(a.value)) n.removeAttribute(a.name); }));
      root.setAttribute("width", "100%"); root.setAttribute("height", "100%");
      return new XMLSerializer().serializeToString(root);
    } catch (_) { return null; }
  }
  function iconInfo(icon) {
    const s = String(icon || "");
    if (!s) return null;
    const m = s.match(/data-dyn-key="([\w-]+)"/) || s.match(/assets\/([\w-]+)\.(?:png|gif|jpe?g|webp|svg)/i);
    if (m) return { k: m[1] };
    if (/^\s*<svg[\s>]/i.test(s) && s.length < 8000) { const svg = cleanSvg(s); if (svg) return { svg }; }
    const t = toText(s);
    if (t && [...t].length <= 3) return { t };
    return null;
  }
  const NAMES = { notify: "", recyclebin: "Recycle Bin", sys_cut: "", sys_copy: "", winflag: "Windows" };
  function appName(k) {
    if (!k) return "";
    if (Object.prototype.hasOwnProperty.call(NAMES, k)) return NAMES[k];
    try { const a = window.Catalog && Catalog.storeApps.find((x) => x.id === k || x.builtin === k); if (a) return a.name; } catch (_) {}
    return k.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  function canOpen(k) {
    if (!k) return false;
    try { return !!(AppRegistry[k] || (window.Catalog && Catalog.storeApps.find((x) => x.id === k || x.builtin === k))); } catch (_) { return false; }
  }
  let seq = 0;
  function record(o) {
    o = o || {};
    const info = iconInfo(o.icon);
    const key = (o.appId && String(o.appId)) || (info && info.k) || "";
    const app = (o.app && String(o.app)) || appName(key) || "Windows";
    const item = {
      id: Date.now().toString(36) + "-" + (++seq),
      app, appKey: key,
      ic: info && info.svg ? { svg: info.svg } : info && info.t ? { t: info.t } : null,
      title: toText(o.title).slice(0, 200), body: toText(o.body).slice(0, 600),
      ts: now().getTime(), unread: !panel, quiet: dnd(),
    };
    const n = nc(); n.items.push(item);
    while (n.items.length > MAX) { const x = n.items.shift(); clicks.delete(x.id); }
    if (typeof o.onClick === "function") clicks.set(item.id, o.onClick);
    save();
    paintBell();
    if (panel) renderList();
  }
  let notifyDepth = 0;
  function wrapNotify() {
    if (!window.Notify || typeof Notify.show !== "function" || Notify.show.__sh2) return;
    const orig = Notify.show;
    // depth guard: if another module wraps Notify.show after us and we wrap again, record only once
    const wrapped = function () {
      if (!notifyDepth) { try { record(arguments[0]); } catch (_) {} }
      notifyDepth++;
      try { return orig.apply(this, arguments); } finally { notifyDepth--; }
    };
    wrapped.__sh2 = true;
    Notify.show = wrapped;
  }
  wrapNotify();

  // ---------------------------------------------------------------------------
  //  Tray bell (unread badge)
  // ---------------------------------------------------------------------------
  const unread = () => nc().items.filter((x) => x.unread).length;
  let bellSig = "";
  function ensureBell() {
    const tray = document.querySelector(".taskbar .tb-tray");
    if (!tray) return null;
    let b = tray.querySelector(".sh2-bell");
    if (!b) {
      b = el(`<button class="sh2-bell" type="button"></button>`);
      const clock = tray.querySelector(".tb-clock");
      if (clock && clock.nextSibling) tray.insertBefore(b, clock.nextSibling); else tray.appendChild(b);
      b.onclick = (e) => { e.stopPropagation(); toggle(); };
      bellSig = "";
    }
    return b;
  }
  function paintBell() {
    const b = ensureBell(); if (!b) return;
    const n = unread(), z = dnd();
    const sig = n + "|" + z + "|" + !!panel;
    if (sig === bellSig) return; bellSig = sig;
    b.innerHTML = (z ? G.bellZ : G.bell) + (n ? `<span class="sh2-bell-n">${n > 99 ? "99+" : n}</span>` : "");
    b.classList.toggle("sh2-has", n > 0); b.classList.toggle("sh2-dnd", z); b.classList.toggle("sh2-active", !!panel);
    const lbl = (n ? n + " new notification" + (n === 1 ? "" : "s") : "No new notifications") + (z ? " · Do not disturb is on" : "");
    b.title = lbl; b.setAttribute("aria-label", "Notifications: " + lbl);
    const clock = document.querySelector(".taskbar .tb-clock"); if (clock) clock.classList.toggle("sh2-active", !!panel);
  }

  // ---------------------------------------------------------------------------
  //  Panel
  // ---------------------------------------------------------------------------
  let panel = null, openedAt = 0, ticker = null;
  let view = null, sel = null;   // calendar month being shown, selected day

  function when(ts) {
    const d = new Date(ts), n = now();
    const mins = Math.round((n - d) / 60000);
    if (mins < 1) return "Now";
    if (mins < 60) return mins + " min ago";
    const t = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: !h24() });
    if (sameDay(d, n)) return t;
    const y = new Date(n.getFullYear(), n.getMonth(), n.getDate() - 1);
    if (sameDay(d, y)) return "Yesterday " + t;
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  }
  function iconHtml(it) {
    if (it.appKey && window.Icon) return Icon.mini(it.appKey, it.app);
    if (it.ic && it.ic.svg) return `<span class="sh2-nc-svg">${it.ic.svg}</span>`;
    if (it.ic && it.ic.t) return `<span class="sh2-nc-emo">${esc(it.ic.t)}</span>`;
    return G.win;
  }

  function open() {
    if (panel) return;
    Fly.opening("notif", () => close(true));
    const t = now(); view = new Date(t.getFullYear(), t.getMonth(), 1); sel = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    panel = el(`<section class="sh2-nc" role="dialog" aria-label="Notification center">
      <div class="sh2-nc-card sh2-nc-notifs">
        <header class="sh2-nc-h"><b>Notifications</b><span class="sh2-grow"></span>
          <button class="sh2-nc-dnd" type="button"></button>
          <button class="sh2-nc-clear" type="button">Clear all</button></header>
        <div class="sh2-nc-dndnote" hidden>Do not disturb is on. Notifications are collected here without popping up.</div>
        <div class="sh2-nc-list" aria-live="polite"></div>
      </div>
      <div class="sh2-nc-card sh2-nc-cal">
        <header class="sh2-nc-calh"><b class="sh2-nc-today"></b><button class="sh2-iconbtn sh2-nc-collapse" type="button"></button></header>
        <div class="sh2-nc-calbody">
          <div class="sh2-nc-mh"><button class="sh2-nc-mtitle" type="button" title="Go to today"></button><span class="sh2-grow"></span>
            <button class="sh2-iconbtn sh2-nc-prev" type="button" title="Previous month" aria-label="Previous month">${G.up}</button>
            <button class="sh2-iconbtn sh2-nc-next" type="button" title="Next month" aria-label="Next month">${G.down}</button></div>
          <div class="sh2-nc-grid" role="grid"></div>
          <div class="sh2-nc-agenda"></div>
        </div>
        <footer class="sh2-nc-focus"></footer>
      </div>
    </section>`);
    panel.querySelector(".sh2-nc-dnd").onclick = () => setDnd(!dnd());
    panel.querySelector(".sh2-nc-clear").onclick = () => clearAll();
    panel.querySelector(".sh2-nc-prev").onclick = () => { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); renderCal(); };
    panel.querySelector(".sh2-nc-next").onclick = () => { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); renderCal(); };
    panel.querySelector(".sh2-nc-mtitle").onclick = () => { const n = now(); view = new Date(n.getFullYear(), n.getMonth(), 1); sel = new Date(n.getFullYear(), n.getMonth(), n.getDate()); renderCal(); };
    panel.querySelector(".sh2-nc-collapse").onclick = () => { const s = nc(); s.calCollapsed = !s.calCollapsed; save(); paintCollapse(); };
    panel.querySelector(".sh2-nc-grid").addEventListener("wheel", (e) => { if (Math.abs(e.deltaY) < 20) return; e.preventDefault(); view = new Date(view.getFullYear(), view.getMonth() + (e.deltaY > 0 ? 1 : -1), 1); renderCal(); }, { passive: false });
    (document.getElementById("screen") || document.body).appendChild(panel);
    focusSig = "";
    paintHead(); renderList(); renderCal(); paintCollapse(); renderFocus();
    // Opening the center marks everything as seen (the unread styling stays until it closes).
    nc().items.forEach((x) => { x.unread = false; }); save();
    openedAt = Date.now();
    paintBell();
    requestAnimationFrame(() => requestAnimationFrame(() => panel && panel.classList.add("sh2-open")));
    let n = 0;
    ticker = setInterval(() => { if (!panel) return; renderFocus(); if (++n % 30 === 0) renderList(); const t2 = now(); if (!sameDay(t2, lastToday)) renderCal(); }, 1000);
  }
  let lastToday = now();
  function close(fromFly) {
    if (!panel) return;
    const p = panel; panel = null;
    clearInterval(ticker); ticker = null;
    p.classList.remove("sh2-open"); p.classList.add("sh2-closing");
    setTimeout(() => p.remove(), 220);
    if (!fromFly) Fly.closed("notif");
    paintBell();
  }
  function toggle() { if (panel) close(); else open(); }

  function paintHead() {
    if (!panel) return;
    const z = dnd(), b = panel.querySelector(".sh2-nc-dnd");
    const fsOn = !!(window.FocusSessions && FocusSessions.info && FocusSessions.info());
    const sig = z + "|" + fsOn;
    if (b.dataset.sig === sig) return; b.dataset.sig = sig;
    b.innerHTML = (z ? G.bellZ : G.bell) + `<span>Do not disturb</span>`;
    b.classList.toggle("on", z); b.setAttribute("aria-pressed", String(z));
    b.title = z ? "Do not disturb is on — tap to turn off" : "Turn on Do not disturb";
    panel.querySelector(".sh2-nc-dndnote").hidden = !z;
    const fs = window.FocusSessions && FocusSessions.info && FocusSessions.info();
    if (z && fs) panel.querySelector(".sh2-nc-dndnote").textContent = "Do not disturb is on during your focus session. Notifications are collected here without popping up.";
  }

  function renderList() {
    if (!panel) return;
    const list = panel.querySelector(".sh2-nc-list");
    const items = nc().items;
    panel.querySelector(".sh2-nc-clear").hidden = !items.length;
    panel.classList.toggle("sh2-nc-has", items.length > 0);
    if (!items.length) { list.innerHTML = `<div class="sh2-nc-empty">No new notifications</div>`; return; }
    const groups = new Map();
    items.slice().sort((a, b) => b.ts - a.ts).forEach((it) => { if (!groups.has(it.app)) groups.set(it.app, []); groups.get(it.app).push(it); });
    list.innerHTML = "";
    groups.forEach((arr, app) => {
      const g = el(`<div class="sh2-nc-grp"><div class="sh2-nc-gh"><span class="sh2-nc-gic">${iconHtml(arr[0])}</span><b>${esc(app)}</b><span class="sh2-grow"></span><button class="sh2-x" type="button" aria-label="Clear ${esc(app)} notifications" title="Clear all from ${esc(app)}">${G.close}</button></div></div>`);
      g.querySelector(".sh2-nc-gh .sh2-x").onclick = () => removeWhere((x) => x.app === app, g);
      arr.slice(0, 20).forEach((it) => g.appendChild(itemEl(it)));
      if (arr.length > 20) g.appendChild(el(`<div class="sh2-nc-more">+${arr.length - 20} older</div>`));
      list.appendChild(g);
    });
  }
  function itemEl(it) {
    const clickable = clicks.has(it.id) || canOpen(it.appKey);
    const row = el(`<div class="sh2-nc-it${it.unread ? " unread" : ""}${clickable ? " act" : ""}" role="${clickable ? "button" : "group"}" tabindex="0">
      <div class="sh2-nc-it-tx">${it.title ? `<b>${esc(it.title)}</b>` : ""}${it.body ? `<span>${esc(it.body)}</span>` : ""}<small>${esc(when(it.ts))}${it.quiet ? " · Silenced" : ""}</small></div>
      <button class="sh2-x" type="button" aria-label="Dismiss notification" title="Dismiss">${G.close}</button></div>`);
    row.querySelector(".sh2-x").onclick = (e) => { e.stopPropagation(); dismiss(it.id, row); };
    let swiped = false;
    const activate = () => {
      if (swiped) { swiped = false; return; }
      const fn = clicks.get(it.id);
      if (!fn && !canOpen(it.appKey)) return;
      dismiss(it.id, row, true); close();
      setTimeout(() => { try { if (fn) fn(); else WM.open(it.appKey); } catch (_) {} }, 0);
    };
    row.addEventListener("click", activate);
    row.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); } else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); dismiss(it.id, row); } });
    // Swipe right to dismiss (touch / pen / mouse drag).
    row.addEventListener("pointerdown", (e) => {
      if (e.button > 0 || e.target.closest("button")) return;
      const sx = e.clientX, sy = e.clientY; let dx = 0, horiz = null;
      const mv = (ev) => {
        dx = ev.clientX - sx; const dy = ev.clientY - sy;
        if (horiz === null && Math.hypot(dx, dy) > 8) horiz = Math.abs(dx) > Math.abs(dy);
        if (!horiz) return;
        row.style.transform = `translateX(${Math.max(0, dx)}px)`; row.style.opacity = String(Math.max(0.2, 1 - Math.max(0, dx) / 260));
      };
      const up = () => {
        window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
        if (horiz) { swiped = true; setTimeout(() => { swiped = false; }, 400); }
        if (horiz && dx > 90) dismiss(it.id, row);
        else { row.style.transform = ""; row.style.opacity = ""; }
      };
      window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
    });
    return row;
  }
  function dismiss(id, row, quick) {
    const n = nc(); n.items = n.items.filter((x) => x.id !== id); clicks.delete(id); save(); paintBell();
    if (row && !quick) { row.classList.add("sh2-gone"); setTimeout(renderList, 180); } else renderList();
  }
  function removeWhere(fn, node) {
    const n = nc(); n.items.filter(fn).forEach((x) => clicks.delete(x.id)); n.items = n.items.filter((x) => !fn(x)); save(); paintBell();
    if (node) { node.classList.add("sh2-gone"); setTimeout(renderList, 180); } else renderList();
  }
  function clearAll() {
    const list = panel && panel.querySelector(".sh2-nc-list");
    nc().items = []; clicks.clear(); save(); paintBell();
    if (list) { list.querySelectorAll(".sh2-nc-grp").forEach((g) => g.classList.add("sh2-gone")); setTimeout(renderList, 180); }
  }

  // ---- calendar ----
  function calEvents(d) {
    const c = S().appData && S().appData.calendar;
    return ((c && c.events && c.events[calKey(d)]) || []).filter((e) => e && e.t);
  }
  function timeVal(t) {
    const m = String(t || "").match(/^(\d{1,2})(?::(\d{2}))?\s*([ap])?/i);
    if (!m) return -1;   // "All day" first
    let h = +m[1] % 12; if (m[3] && /p/i.test(m[3])) h += 12; if (!m[3] && +m[1] === 12) h = 12;
    return h * 60 + (+m[2] || 0);
  }
  function renderCal() {
    if (!panel) return;
    const t = now(); lastToday = t;
    panel.querySelector(".sh2-nc-today").textContent = t.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
    panel.querySelector(".sh2-nc-mtitle").textContent = MONTHS[view.getMonth()] + " " + view.getFullYear();
    const grid = panel.querySelector(".sh2-nc-grid");
    const start = new Date(view.getFullYear(), view.getMonth(), 1 - new Date(view.getFullYear(), view.getMonth(), 1).getDay());
    let html = DOW.map((d) => `<span class="sh2-nc-dow" role="columnheader">${d}</span>`).join("");
    for (let i = 0; i < 42; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const cls = ["sh2-nc-day"];
      if (d.getMonth() !== view.getMonth()) cls.push("other");
      if (sameDay(d, t)) cls.push("today");
      if (sel && sameDay(d, sel)) cls.push("sel");
      const n = calEvents(d).length; if (n) cls.push("ev");
      html += `<button class="${cls.join(" ")}" type="button" data-i="${i}" aria-label="${esc(d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" }))}${n ? ", " + n + " event" + (n > 1 ? "s" : "") : ""}"${sameDay(d, t) ? ' aria-current="date"' : ""}>${d.getDate()}</button>`;
    }
    grid.innerHTML = html;
    grid.querySelectorAll(".sh2-nc-day").forEach((b) => b.onclick = () => {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + +b.dataset.i);
      sel = d;
      if (d.getMonth() !== view.getMonth()) view = new Date(d.getFullYear(), d.getMonth(), 1);
      renderCal();
    });
    renderAgenda();
  }
  function renderAgenda() {
    const box = panel.querySelector(".sh2-nc-agenda");
    const d = sel || now(), t = now();
    const tomorrow = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1);
    const label = sameDay(d, t) ? "Today" : sameDay(d, tomorrow) ? "Tomorrow" : d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
    const evs = calEvents(d).slice().sort((a, b) => timeVal(a.time) - timeVal(b.time));
    const hasCal = !!(S().appData && S().appData.calendar && S().appData.calendar.events);
    box.innerHTML = `<div class="sh2-nc-agh"><b>${esc(label)}</b><span class="sh2-grow"></span><button class="sh2-chip sh2-nc-addev" type="button">${G.plus} Add event</button></div>
      ${evs.length ? evs.map((e) => `<button class="sh2-nc-ev" type="button"><i style="background:${CAL_COLORS[(e.c || 0) % CAL_COLORS.length]}"></i><span><b>${esc(e.t)}</b><small>${esc(e.time || "All day")}</small></span></button>`).join("")
        : `<div class="sh2-nc-noev">${hasCal ? "No events" : "No events yet — add some in Calendar."}</div>`}`;
    const openCal = () => { close(); setTimeout(() => { try { WM.open("calendar"); } catch (_) {} }, 0); };
    box.querySelector(".sh2-nc-addev").onclick = openCal;
    box.querySelectorAll(".sh2-nc-ev").forEach((b) => b.onclick = openCal);
  }
  function paintCollapse() {
    if (!panel) return;
    const c = !!nc().calCollapsed;
    panel.classList.toggle("sh2-calcollapsed", c);
    const b = panel.querySelector(".sh2-nc-collapse");
    b.innerHTML = c ? G.up : G.down;
    b.title = c ? "Show calendar" : "Hide calendar"; b.setAttribute("aria-label", b.title); b.setAttribute("aria-expanded", String(!c));
  }

  // ---- Focus (Clock's focus sessions) ----
  let focusSig = "";
  function renderFocus() {
    if (!panel) return;
    const box = panel.querySelector(".sh2-nc-focus");
    const F = window.FocusSessions;
    if (!F) { box.hidden = true; return; }
    const i = F.info(), f = F.store();
    const fmt = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(s % 60).padStart(2, "0"); };
    const sig = i ? "run" : "idle|" + f.lengthMin;
    if (i) {
      if (focusSig !== "run") {
        box.innerHTML = `<span class="sh2-nc-fo-ic">${G.focus}</span><span class="sh2-nc-fo-tx"><b class="sh2-nc-fo-left"></b><small class="sh2-nc-fo-st"></small></span><span class="sh2-grow"></span><button class="sh2-primary sh2-nc-fo-btn" type="button">Open Focus</button>`;
        box.querySelector(".sh2-nc-fo-btn").onclick = openFocus;
      }
      box.querySelector(".sh2-nc-fo-left").textContent = fmt(i.segLeft) + " left";
      box.querySelector(".sh2-nc-fo-st").textContent = i.paused ? "Focus session paused" : i.seg.type === "break" ? "On a break" : "Focus session in progress";
    } else if (focusSig !== sig) {
      box.innerHTML = `<button class="sh2-iconbtn sh2-nc-fo-m" type="button" aria-label="Less time">−</button><span class="sh2-nc-fo-len"><b>${esc(f.lengthMin)}</b> mins</span><button class="sh2-iconbtn sh2-nc-fo-p" type="button" aria-label="More time">+</button><span class="sh2-grow"></span><button class="sh2-primary sh2-nc-fo-btn" type="button" title="Open Focus in Clock">${G.focus} Focus</button>`;
      const step = (d) => { const v = f.lengthMin, st = (d > 0 ? v >= 60 : v > 60) ? 15 : 5; f.lengthMin = Math.max(15, Math.min(240, v + d * st)); save(); renderFocus(); };
      box.querySelector(".sh2-nc-fo-m").onclick = () => step(-1);
      box.querySelector(".sh2-nc-fo-p").onclick = () => step(1);
      box.querySelector(".sh2-nc-fo-btn").onclick = openFocus;
    }
    focusSig = sig;
  }
  function openFocus() { close(); try { if (window.FocusSessions) FocusSessions.wantTab = "focus"; WM.open("clock"); } catch (_) {} }

  // ---------------------------------------------------------------------------
  //  Outside tap / Esc / shortcuts / upkeep
  // ---------------------------------------------------------------------------
  document.addEventListener("pointerdown", (e) => {
    if (!panel) return;
    if (panel.contains(e.target) || e.target.closest(".tb-clock") || e.target.closest(".sh2-bell") || Date.now() - openedAt < 250) return;
    close();
  }, true);
  const isApple = /Mac|iPhone|iPad|iPod/.test(navigator.platform || "") || (/Macintosh/.test(navigator.userAgent) && "ontouchend" in document);
  window.addEventListener("keydown", (e) => {
    const ctrlAlt = e.ctrlKey && e.altKey && !e.metaKey && !e.shiftKey;
    const winKey = e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey && !isApple;   // Cmd+N opens a browser window on Apple devices
    if ((ctrlAlt || winKey) && (e.code === "KeyN" || (winKey && (e.key === "n" || e.key === "N")))) {
      if (!document.querySelector(".taskbar") || document.querySelector(".lock-screen")) return;   // desktop only, never over the lock screen
      e.preventDefault(); e.stopPropagation(); toggle(); return;
    }
    if (panel && e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
  }, true);
  window.addEventListener("quicksettings-change", () => { paintBell(); paintHead(); });
  // Keep the bell attached (the taskbar can be rebuilt) and in step with Quick Settings' Focus tile.
  setInterval(() => { wrapNotify(); paintBell(); if (panel) paintHead(); }, 1000);
  try {
    if (window.WM && typeof WM.buildDesktop === "function" && !WM.buildDesktop.__sh2) {
      const ob = WM.buildDesktop;
      WM.buildDesktop = function () { const r = ob.apply(this, arguments); try { wrapNotify(); bellSig = ""; paintBell(); } catch (_) {} return r; };
      WM.buildDesktop.__sh2 = true;
    }
  } catch (_) {}

  window.NotifCenter = {
    open, close: () => close(), toggle, isOpen: () => !!panel,
    items: () => nc().items.slice(), unread, clear: () => { clearAll(); renderList(); },
    dnd, setDnd,
  };
})();
