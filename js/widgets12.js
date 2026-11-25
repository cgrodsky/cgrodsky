/* Widgets board (Windows 11 style). Slides in from the left over a frosted background.
   Opens from the taskbar weather pill, Win+W / Ctrl+Alt+W, or "Widgets" in Start / search.
   Every widget shows real data from the rest of the system:
     weather  → the taskbar weather (NOAA/NWS when live, clearly labelled "Sample" otherwise)
     calendar → Calendar app events (State.data.appData.calendar.events)
     clock    → the system clock (State.now) + world clocks (Intl time zones)
     todo     → the widget to-do list (State.data.appData.widgetTodos, shared with the old panel)
     photos   → pictures in the virtual file system's Pictures folder
     system   → battery (navigator.getBattery), site storage (navigator.storage.estimate),
                network (navigator.onLine / Network Information API / js/radios.js)
     focus    → Clock's Focus sessions engine (window.FocusSessions)
   No stocks or news: those need keyed third-party APIs, and fake headlines would look real.
   Layout (which widgets, order, size, per-widget settings) is saved in
   State.data.appData.widgets12. Classes are prefixed sh2- (css/shell2.css). */
(function () {
  "use strict";
  const S = () => State.data;
  const save = () => { try { State.save(); } catch (_) {} };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const el = (html) => { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; };
  const now = () => { try { return State.now ? new Date(State.now()) : new Date(); } catch (_) { return new Date(); } };
  const h24 = () => !!(S().clock && S().clock.format24);
  const timeStr = (d, tz, secs) => { try { return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: secs ? "2-digit" : undefined, hour12: !h24(), timeZone: tz || undefined }); } catch (_) { return d.toLocaleTimeString(); } };
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const CAL_COLORS = ["#1a73e8", "#0f9d58", "#d93025", "#f4b400", "#a142f4", "#00897b", "#e8710a"];
  const calKey = (d) => d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();

  // ---------------------------------------------------------------------------
  //  Shared flyout coordinator (also defined, identically, by js/notifcenter.js):
  //  only one shell flyout is open at a time, and opening one closes the
  //  Start menu, search, Quick Settings and the PowerTools flyouts.
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  //  Glyphs (inline SVG, no image requests)
  // ---------------------------------------------------------------------------
  const G = {
    weather: `<svg viewBox="0 0 24 24" width="16" height="16"><circle cx="9" cy="9" r="4" fill="#f5b301"/><path d="M8 19a3.5 3.5 0 0 1 0-7 4.5 4.5 0 0 1 8.6-1.2A3.6 3.6 0 0 1 17 19Z" fill="#9cc3f5"/></svg>`,
    calendar: `<svg viewBox="0 0 24 24" width="16" height="16"><rect x="3" y="5" width="18" height="16" rx="3" fill="#1a73e8"/><rect x="3" y="9" width="18" height="12" rx="2" fill="#fff"/><path d="M8 3v4M16 3v4" stroke="#1a73e8" stroke-width="2" stroke-linecap="round"/><rect x="7" y="12" width="3" height="3" rx=".6" fill="#1a73e8"/></svg>`,
    clock: `<svg viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="12" r="9.5" fill="#5b5fc7"/><path d="M12 7v5l3.5 2" stroke="#fff" stroke-width="2" stroke-linecap="round" fill="none"/></svg>`,
    todo: `<svg viewBox="0 0 24 24" width="16" height="16"><rect x="3" y="3" width="18" height="18" rx="5" fill="#2564cf"/><path d="M7.5 12.5l3 3 6-7" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`,
    photos: `<svg viewBox="0 0 24 24" width="16" height="16"><rect x="2.5" y="4" width="19" height="16" rx="3" fill="#0f9d58"/><circle cx="8.5" cy="9.5" r="2" fill="#fff"/><path d="M4 18l5-5 3 3 3-4 5 6Z" fill="#c8f1d8"/></svg>`,
    system: `<svg viewBox="0 0 24 24" width="16" height="16"><rect x="3" y="4" width="18" height="12" rx="2.5" fill="#6b7280"/><rect x="5" y="6" width="14" height="8" rx="1" fill="#a5d8ff"/><path d="M9 20h6M12 16v4" stroke="#6b7280" stroke-width="2" stroke-linecap="round"/></svg>`,
    focus: `<svg viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="12" r="9.5" fill="none" stroke="#c239b3" stroke-width="2.5"/><circle cx="12" cy="12" r="4" fill="#c239b3"/></svg>`,
    more: `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><circle cx="5" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/></svg>`,
    plus: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`,
    close: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
    check: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`,
    refresh: `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>`,
  };

  // ---------------------------------------------------------------------------
  //  Saved layout
  // ---------------------------------------------------------------------------
  const DEFAULT_LAYOUT = [
    { type: "weather", size: "medium" }, { type: "calendar", size: "small" }, { type: "clock", size: "small" },
    { type: "todo", size: "medium" }, { type: "photos", size: "medium" }, { type: "system", size: "medium" }, { type: "focus", size: "small" },
  ];
  const uid = () => "w" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  function store() {
    const a = S().appData || (S().appData = {});
    let w = a.widgets12;
    if (!w || !Array.isArray(w.list)) { w = a.widgets12 = { list: DEFAULT_LAYOUT.map((x) => ({ id: uid(), type: x.type, size: x.size, cfg: {} })) }; save(); }
    w.list = w.list.filter((x) => x && TYPES[x.type]);
    w.list.forEach((x) => { if (!x.cfg) x.cfg = {}; if (sizesOf(x.type).indexOf(x.size) < 0) x.size = TYPES[x.type].def; if (!x.id) x.id = uid(); });
    return w;
  }
  const sizesOf = (type) => TYPES[type].sizes || ["small", "medium", "large"];
  function todos() { const a = S().appData || (S().appData = {}); if (!Array.isArray(a.widgetTodos)) a.widgetTodos = []; return a.widgetTodos; }

  // ---------------------------------------------------------------------------
  //  Data helpers
  // ---------------------------------------------------------------------------
  function weather() { try { return window.WM && WM.weather ? WM.weather() : null; } catch (_) { return null; } }
  const wxIcon = (k) => { try { return WM.weatherIcon(k); } catch (_) { return ""; } };
  const WX_BG = { sun: "linear-gradient(150deg,#2f74d0,#63b3ed)", partly: "linear-gradient(150deg,#3f72a8,#7fb0d9)", cloud: "linear-gradient(150deg,#56677b,#8a9bb0)", showers: "linear-gradient(150deg,#3b5f85,#6d8fb0)", rain: "linear-gradient(150deg,#33465e,#5b7089)", thunder: "linear-gradient(150deg,#2b3550,#4a4f6b)", snow: "linear-gradient(150deg,#647891,#aebfd4)", fog: "linear-gradient(150deg,#646b78,#9aa3b2)" };

  function calEvents(d) {
    const c = S().appData && S().appData.calendar;
    const list = (c && c.events && c.events[calKey(d)]) || [];
    return list.filter((e) => e && e.t);
  }
  function upcoming(days, max) {
    const out = [], base = now();
    for (let i = 0; i < days && out.length < max; i++) {
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
      calEvents(d).forEach((e) => { if (out.length < max) out.push({ d, e, i }); });
    }
    return out;
  }
  const dayLabel = (i, d) => (i === 0 ? "Today" : i === 1 ? "Tomorrow" : DOW[d.getDay()] + ", " + MONTHS[d.getMonth()].slice(0, 3) + " " + d.getDate());

  const IMG_EXT = /\.(png|jpe?g|gif|webp|bmp|svg|avif|heic)$/i;
  function pictures() {
    const r = S().appData && S().appData.files && S().appData.files.root;
    const out = [];
    (function walk(n, path, depth) {
      if (!n || !n.children || depth > 6) return;
      Object.keys(n.children).forEach((k) => {
        const c = n.children[k]; if (!c) return;
        if (c.type === "folder") walk(c, path.concat(k), depth + 1);
        else if (c.type === "file" && (c.kind === "image" || /^image\//.test(c.mime || "") || IMG_EXT.test(k)) && (c.src || c.blob)) out.push({ name: k, node: c, path });
      });
    })(r && r.Pictures, ["Pictures"], 0);
    return out.sort((a, b) => (b.node.ts || 0) - (a.node.ts || 0));
  }
  const blobUrls = new Map();   // blob id -> object URL (revoked when the board closes)
  function picSrc(p) {
    if (p.node.src) return Promise.resolve(p.node.src);
    const id = p.node.blob;
    if (blobUrls.has(id)) return Promise.resolve(blobUrls.get(id));
    if (!window.VFS || !VFS.getBlob) return Promise.resolve(null);
    return VFS.getBlob(id).then((b) => { if (!b) return null; const u = URL.createObjectURL(b); blobUrls.set(id, u); return u; }).catch(() => null);
  }

  // Real device info. Each value is null when the browser doesn't report it.
  let battMgr = null, battAsked = false;
  const sysListeners = new Set();
  const sysEmit = () => sysListeners.forEach((fn) => { try { fn(); } catch (_) {} });
  function battery() {
    if (!battAsked) {
      battAsked = true;
      try {
        if (navigator.getBattery) navigator.getBattery().then((b) => { battMgr = b; ["levelchange", "chargingchange", "chargingtimechange", "dischargingtimechange"].forEach((ev) => b.addEventListener(ev, sysEmit)); sysEmit(); }).catch(() => {});
      } catch (_) {}
    }
    return battMgr ? { level: battMgr.level, charging: battMgr.charging, chargingTime: battMgr.chargingTime, dischargingTime: battMgr.dischargingTime } : null;
  }
  let storeEst = null, storeAt = 0, storePersist = null;
  function storage() {
    if (Date.now() - storeAt > 8000) {
      storeAt = Date.now();
      try { if (navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then((e) => { storeEst = e; sysEmit(); }).catch(() => {}); } catch (_) {}
      try { if (navigator.storage && navigator.storage.persisted) navigator.storage.persisted().then((p) => { storePersist = p; }).catch(() => {}); } catch (_) {}
    }
    let stateBytes = null;
    try { const k = window.WIN12_STATE_KEY; const v = k && localStorage.getItem(k); if (v) stateBytes = v.length * 2; } catch (_) {}
    return { usage: storeEst ? storeEst.usage : null, quota: storeEst ? storeEst.quota : null, persisted: storePersist, stateBytes };
  }
  function network() {
    let n = null;
    try { if (window.Radios && Radios.net && Radios.net.info) n = Radios.net.info(); } catch (_) {}
    const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return {
      online: n ? n.online : navigator.onLine !== false,
      type: n ? n.type : (c && c.type) || "",
      effectiveType: n ? n.effectiveType : (c && c.effectiveType) || "",
      downlink: n ? n.downlink : (c && typeof c.downlink === "number" ? c.downlink : null),
      rtt: n ? (n.latency != null ? n.latency : n.rtt) : (c && typeof c.rtt === "number" ? c.rtt : null),
      wifiOn: n ? n.wifiOn : true,
    };
  }
  window.addEventListener("online", sysEmit); window.addEventListener("offline", sysEmit);
  const fmtBytes = (b) => { if (b == null) return "—"; const u = ["B", "KB", "MB", "GB", "TB"]; let i = 0; while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; } return (b >= 100 || i === 0 ? Math.round(b) : b.toFixed(1)) + " " + u[i]; };
  const bar = (frac, cls) => `<div class="sh2-bar ${cls || ""}"><i style="width:${Math.max(2, Math.min(100, Math.round(frac * 100)))}%"></i></div>`;

  // ---------------------------------------------------------------------------
  //  Widget types. render(ctx) fills ctx.body and may return { tick, destroy }.
  //  ctx = { item, size, body, card, rerender(), menuExtra }
  // ---------------------------------------------------------------------------
  const ZONES = [
    ["Honolulu", "Pacific/Honolulu"], ["Anchorage", "America/Anchorage"], ["Los Angeles", "America/Los_Angeles"], ["Denver", "America/Denver"],
    ["Chicago", "America/Chicago"], ["New York", "America/New_York"], ["São Paulo", "America/Sao_Paulo"], ["London", "Europe/London"],
    ["Paris", "Europe/Paris"], ["Berlin", "Europe/Berlin"], ["Stockholm", "Europe/Stockholm"], ["Cairo", "Africa/Cairo"], ["Moscow", "Europe/Moscow"],
    ["Dubai", "Asia/Dubai"], ["Mumbai", "Asia/Kolkata"], ["Singapore", "Asia/Singapore"], ["Beijing", "Asia/Shanghai"], ["Tokyo", "Asia/Tokyo"],
    ["Sydney", "Australia/Sydney"], ["Auckland", "Pacific/Auckland"],
  ];
  const zoneName = (tz) => { const z = ZONES.find((x) => x[1] === tz); return z ? z[0] : tz.split("/").pop().replace(/_/g, " "); };
  function tzOffsetLabel(tz, d) {
    try {
      const loc = new Date(d.toLocaleString("en-US")), oth = new Date(d.toLocaleString("en-US", { timeZone: tz }));
      const h = Math.round((oth - loc) / 360000) / 10;
      if (!h) return "Same time";
      return (h > 0 ? "+" : "") + h + " hr";
    } catch (_) { return ""; }
  }
  function tzDayDiff(tz, d) {
    try { const a = d.toLocaleDateString("en-CA"), b = d.toLocaleDateString("en-CA", { timeZone: tz }); return b > a ? "Tomorrow" : b < a ? "Yesterday" : "Today"; } catch (_) { return ""; }
  }
  function analog(d) {
    const hr = d.getHours() % 12, m = d.getMinutes(), s = d.getSeconds();
    let ticks = "";
    for (let i = 0; i < 12; i++) ticks += `<line x1="50" y1="${i % 3 ? 9 : 7}" x2="50" y2="${i % 3 ? 12 : 15}" transform="rotate(${i * 30} 50 50)" class="sh2-ck-tick${i % 3 ? "" : " q"}"/>`;
    return `<svg viewBox="0 0 100 100" class="sh2-ck" role="img" aria-label="${esc(timeStr(d))}"><circle cx="50" cy="50" r="46" class="sh2-ck-face"/>${ticks}
      <line x1="50" y1="54" x2="50" y2="29" class="sh2-ck-h" transform="rotate(${(hr + m / 60) * 30} 50 50)"/>
      <line x1="50" y1="56" x2="50" y2="18" class="sh2-ck-m" transform="rotate(${(m + s / 60) * 6} 50 50)"/>
      <line x1="50" y1="60" x2="50" y2="14" class="sh2-ck-s" transform="rotate(${s * 6} 50 50)"/><circle cx="50" cy="50" r="2.6" class="sh2-ck-pin"/></svg>`;
  }

  const TYPES = {
    weather: {
      name: "Weather", icon: G.weather, def: "medium", desc: "Current conditions and forecast for your location (US National Weather Service).",
      render(ctx) {
        const w = weather();
        if (!w) { ctx.body.innerHTML = `<div class="sh2-wg-empty">Weather isn't available.</div>`; return; }
        const live = !!w.live;
        const upd = live && w.ts ? "Updated " + timeStr(new Date(w.ts)) : "";
        const days = live && Array.isArray(w.days) ? w.days : [];
        const nDays = ctx.size === "small" ? 0 : ctx.size === "medium" ? 4 : 5;
        ctx.card.style.background = WX_BG[w.icon] || WX_BG.partly;
        ctx.card.classList.add("sh2-wg-onimg");
        ctx.body.innerHTML = `<button class="sh2-wx" data-open="weather" aria-label="Open Weather">
            <div class="sh2-wx-now"><span class="sh2-wx-ic">${wxIcon(w.icon)}</span><span class="sh2-wx-t">${esc(w.temp)}&deg;</span>
              <span class="sh2-wx-meta"><b>${esc(w.label)}</b><span>H ${esc(w.hi)}&deg; · L ${esc(w.lo)}&deg;</span>${w.city ? `<span class="sh2-wx-city">${esc(w.city)}</span>` : ""}</span></div>
          </button>
          ${nDays && days.length ? `<div class="sh2-wx-days">${days.slice(0, nDays).map((d) => `<div class="sh2-wx-day"><span>${esc(d.name)}</span>${wxIcon(d.icon)}<b>${esc(d.hi)}&deg;</b></div>`).join("")}</div>` : ""}
          ${ctx.size !== "small" && !(live && days.length) || ctx.size === "large" ? `<div class="sh2-wx-acts"><button class="sh2-chip sh2-wx-refresh">${G.refresh} ${live ? "Refresh" : "Try live weather"}</button><button class="sh2-chip sh2-wx-open">Open Weather</button></div>` : ""}
          <div class="sh2-wx-src">${live ? (ctx.size === "small" ? "Live · NWS" : `Live · National Weather Service${upd ? " · " + esc(upd) : ""}`) : ctx.size === "small" ? "Sample weather · not live" : "Sample weather, not live. Allow location access for the live forecast (US only, National Weather Service)."}</div>
`;
        ctx.body.querySelector(".sh2-wx").onclick = () => openApp("weather");
        const r = ctx.body.querySelector(".sh2-wx-refresh"); if (r) r.onclick = refreshWeather;
        const o = ctx.body.querySelector(".sh2-wx-open"); if (o) o.onclick = () => openApp("weather");
      },
      menu: [{ label: "Refresh", act: () => refreshWeather() }, { label: "Open Weather", act: () => openApp("weather") }],
    },

    calendar: {
      name: "Calendar", icon: G.calendar, def: "small", desc: "Today's date and your next events from the Calendar app.",
      render(ctx) {
        const d = now();
        const today = calEvents(d);
        const head = `<div class="sh2-cal-date"><span class="sh2-cal-dow">${esc(d.toLocaleDateString([], { weekday: "long" }))}</span><b>${d.getDate()}</b><span>${esc(MONTHS[d.getMonth()])}</span></div>`;
        const evRow = (x) => `<button class="sh2-cal-ev" data-open="calendar"><i style="background:${CAL_COLORS[(x.e.c || 0) % CAL_COLORS.length]}"></i><span><b>${esc(x.e.t)}</b><small>${esc(dayLabel(x.i, x.d))} · ${esc(x.e.time || "All day")}</small></span></button>`;
        if (ctx.size === "small") {
          ctx.body.innerHTML = `<button class="sh2-cal-small" data-open="calendar">${head}<div class="sh2-cal-sum">${today.length ? esc(today[0].t) + (today.length > 1 ? ` <span>+${today.length - 1} more</span>` : "") : "No events today"}</div></button>`;
        } else {
          const list = upcoming(ctx.size === "large" ? 14 : 7, ctx.size === "large" ? 7 : 3);
          let month = "";
          if (ctx.size === "large") {
            const y = d.getFullYear(), m = d.getMonth(), first = new Date(y, m, 1).getDay(), n = new Date(y, m + 1, 0).getDate();
            let cells = DOW.map((x) => `<span class="sh2-mm-dow">${x[0]}</span>`).join("");
            for (let i = 0; i < first; i++) cells += "<span></span>";
            for (let i = 1; i <= n; i++) { const has = calEvents(new Date(y, m, i)).length; cells += `<span class="sh2-mm-d${i === d.getDate() ? " today" : ""}${has ? " ev" : ""}">${i}</span>`; }
            month = `<div class="sh2-mm">${cells}</div>`;
          }
          ctx.body.innerHTML = `<div class="sh2-cal-mid">${head}${month}<div class="sh2-cal-list">${list.length ? list.map(evRow).join("") : `<div class="sh2-wg-empty">No upcoming events</div>`}</div></div>
            <button class="sh2-link" data-open="calendar">Open Calendar</button>`;
        }
        ctx.body.querySelectorAll("[data-open], .sh2-cal-mid > .sh2-cal-date").forEach((b) => b.onclick = () => openApp("calendar"));
        let lastDay = d.getDate();
        return { tick() { const n = now(); if (n.getDate() !== lastDay) { lastDay = n.getDate(); ctx.rerender(); } } };
      },
      menu: [{ label: "Open Calendar", act: () => openApp("calendar") }],
    },

    clock: {
      name: "Clock", icon: G.clock, def: "small", desc: "The time here and in other cities.",
      render(ctx) {
        const cfg = ctx.item.cfg;
        if (!Array.isArray(cfg.zones)) cfg.zones = ["America/New_York", "Europe/London", "Asia/Tokyo"];
        const max = ctx.size === "large" ? 6 : 3;
        const draw = () => {
          const d = now();
          if (ctx.size === "small") {
            ctx.body.innerHTML = `<button class="sh2-ck-small" aria-label="Open Clock">${analog(d)}<b>${esc(timeStr(d))}</b></button>`;
            ctx.body.firstChild.onclick = () => openApp("clock");
            return;
          }
          const rows = cfg.zones.slice(0, max).map((tz, i) => `<div class="sh2-wc"><span><b>${esc(zoneName(tz))}</b><small>${esc(tzDayDiff(tz, d))} · ${esc(tzOffsetLabel(tz, d))}</small></span><span class="sh2-wc-t">${esc(timeStr(d, tz))}</span>${ctx.editing ? `<button class="sh2-x" data-rm="${i}" aria-label="Remove ${esc(zoneName(tz))}">${G.close}</button>` : ""}</div>`).join("");
          const picker = ctx.editing ? `<div class="sh2-wc-add"><select class="sh2-select" aria-label="Add a city"><option value="">Add a city…</option>${ZONES.filter((z) => cfg.zones.indexOf(z[1]) < 0).map((z) => `<option value="${z[1]}">${esc(z[0])}</option>`).join("")}</select><button class="sh2-chip sh2-wc-done">Done</button></div>` : "";
          ctx.body.innerHTML = `<div class="sh2-ck-mid"><button class="sh2-ck-face-btn" aria-label="Open Clock">${analog(d)}<b>${esc(timeStr(d))}</b><small>Local time</small></button><div class="sh2-wc-list">${rows || `<div class="sh2-wg-empty">No cities yet</div>`}${picker}</div></div>`;
          ctx.body.querySelector(".sh2-ck-face-btn").onclick = () => openApp("clock");
          ctx.body.querySelectorAll("[data-rm]").forEach((b) => b.onclick = () => { cfg.zones.splice(+b.dataset.rm, 1); save(); draw(); });
          const sel = ctx.body.querySelector(".sh2-select");
          if (sel) sel.onchange = () => { if (sel.value) { cfg.zones.push(sel.value); if (cfg.zones.length > 6) cfg.zones.shift(); save(); draw(); } };
          const dn = ctx.body.querySelector(".sh2-wc-done"); if (dn) dn.onclick = () => { ctx.editing = false; draw(); };
        };
        draw();
        return { tick() { if (ctx.editing && ctx.body.contains(document.activeElement)) return; draw(); } };
      },
      menu: [{ label: "Choose cities", sizes: ["medium", "large"], act: (ctx) => { ctx.editing = true; ctx.rerender(); } }, { label: "Open Clock", act: () => openApp("clock") }],
    },

    todo: {
      name: "To Do", icon: G.todo, def: "medium", desc: "A simple to-do list, saved on this device.",
      render(ctx) {
        const list = todos();
        const open = list.filter((t) => !t.done).length;
        const max = ctx.size === "small" ? 2 : ctx.size === "medium" ? 3 : 9;
        const shown = list.map((t, i) => ({ t, i })).sort((a, b) => (a.t.done === b.t.done ? 0 : a.t.done ? 1 : -1)).slice(0, max);
        ctx.body.innerHTML = `<div class="sh2-td">
            <div class="sh2-td-count">${list.length ? open + " of " + list.length + " left" : "Nothing to do"}</div>
            <div class="sh2-td-list">${shown.map(({ t, i }) => `<div class="sh2-td-row${t.done ? " done" : ""}"><label><input type="checkbox" data-i="${i}" ${t.done ? "checked" : ""}><span>${esc(t.text)}</span></label><button class="sh2-x" data-del="${i}" aria-label="Delete task">${G.close}</button></div>`).join("")}
              ${list.length > max ? `<div class="sh2-td-more">+${list.length - max} more</div>` : ""}</div>
            <form class="sh2-td-add"><input class="sh2-input" placeholder="Add a task" maxlength="140" aria-label="Add a task"><button class="sh2-iconbtn" aria-label="Add task">${G.plus}</button></form>
          </div>`;
        ctx.body.querySelectorAll("input[type=checkbox]").forEach((c) => c.onchange = () => { const t = list[+c.dataset.i]; if (t) { t.done = c.checked; save(); rerenderType("todo"); } });
        ctx.body.querySelectorAll("[data-del]").forEach((b) => b.onclick = () => { list.splice(+b.dataset.del, 1); save(); rerenderType("todo"); });
        const f = ctx.body.querySelector(".sh2-td-add");
        f.onsubmit = (e) => { e.preventDefault(); const inp = f.querySelector("input"); const v = inp.value.trim(); if (!v) return; list.push({ text: v, done: false }); save(); rerenderType("todo", true); };
      },
      menu: [{ label: "Clear completed", act: () => { const l = todos(); for (let i = l.length - 1; i >= 0; i--) if (l[i].done) l.splice(i, 1); save(); rerenderType("todo"); } }],
    },

    photos: {
      name: "Photos", icon: G.photos, def: "medium", desc: "A slideshow of the pictures in your Pictures folder.",
      render(ctx) {
        const pics = pictures();
        if (!pics.length) {
          ctx.body.innerHTML = `<div class="sh2-ph-empty"><span>${G.photos}</span><p>Pictures you save to your Pictures folder show up here.</p><button class="sh2-chip">Open Pictures</button></div>`;
          ctx.body.querySelector("button").onclick = () => { window.FilesStartPath = ["Pictures"]; openApp("fileexplorer"); };
          return;
        }
        ctx.card.classList.add("sh2-wg-onimg", "sh2-wg-photo");
        if (ctx.size === "large" && pics.length >= 4) {
          ctx.body.innerHTML = `<div class="sh2-ph-grid">${pics.slice(0, 4).map((p, i) => `<button class="sh2-ph-cell" data-i="${i}" aria-label="${esc(p.name)}"></button>`).join("")}</div>`;
          ctx.body.querySelectorAll(".sh2-ph-cell").forEach((b) => { const p = pics[+b.dataset.i]; picSrc(p).then((u) => { if (u) b.style.backgroundImage = `url("${u.replace(/"/g, "%22")}")`; }); b.onclick = () => openPic(p); });
          return;
        }
        let idx = 0;
        ctx.body.innerHTML = `<button class="sh2-ph-show" aria-label="Open picture"><span class="sh2-ph-a"></span><span class="sh2-ph-b"></span><span class="sh2-ph-cap"></span></button>`;
        const btn = ctx.body.firstChild, layers = [btn.querySelector(".sh2-ph-a"), btn.querySelector(".sh2-ph-b")], cap = btn.querySelector(".sh2-ph-cap");
        let front = 0;
        const show = () => {
          const p = pics[idx % pics.length];
          picSrc(p).then((u) => {
            if (!u || !btn.isConnected) return;
            const back = layers[1 - front]; back.style.backgroundImage = `url("${u.replace(/"/g, "%22")}")`;
            back.classList.add("on"); layers[front].classList.remove("on"); front = 1 - front;
            cap.textContent = p.name + (pics.length > 1 ? "  ·  " + ((idx % pics.length) + 1) + " of " + pics.length : "");
          });
        };
        btn.onclick = () => openPic(pics[idx % pics.length]);
        show();
        let n = 0;
        return { tick() { if (pics.length > 1 && ++n % 8 === 0) { idx++; show(); } } };
      },
      menu: [{ label: "Open Pictures folder", act: () => { window.FilesStartPath = ["Pictures"]; openApp("fileexplorer"); } }],
    },

    system: {
      name: "System", icon: G.system, def: "medium", desc: "Battery, storage and network — straight from your browser.",
      render(ctx) {
        const draw = () => {
          const b = battery(), st = storage(), net = network();
          const bTxt = b ? Math.round(b.level * 100) + "%" + (b.charging ? " · Charging" : "") : "Not reported";
          const bSub = b ? (b.charging && isFinite(b.chargingTime) && b.chargingTime > 0 ? "Full in " + mins(b.chargingTime) : !b.charging && isFinite(b.dischargingTime) && b.dischargingTime > 0 ? mins(b.dischargingTime) + " left" : "") : "This browser doesn't share battery info";
          const sFrac = st.usage != null && st.quota ? st.usage / st.quota : 0;
          const sTxt = st.usage != null ? fmtBytes(st.usage) + " used" : (st.stateBytes != null ? fmtBytes(st.stateBytes) + " saved" : "Not reported");
          const sSub = st.quota ? "of " + fmtBytes(st.quota) + " available to this site" : "Storage estimate not available";
          const nTxt = !net.online ? "Offline" : net.wifiOn === false ? "Online (Wi-Fi switched off here)" : "Online";
          const nBits = [net.effectiveType && net.effectiveType.toUpperCase(), net.downlink != null ? net.downlink + " Mbps" : "", net.rtt != null ? Math.round(net.rtt) + " ms" : ""].filter(Boolean).join(" · ");
          const row = (k, ic, title, val, sub, extra) => `<div class="sh2-sys-row" data-k="${k}"><span class="sh2-sys-ic">${ic}</span><span class="sh2-sys-tx"><span class="sh2-sys-l">${title}</span><b>${esc(val)}</b>${extra || ""}${sub ? `<small>${esc(sub)}</small>` : ""}</span></div>`;
          const batIc = `<svg viewBox="0 0 24 24" width="20" height="20"><rect x="2.5" y="7" width="17" height="10" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="4.5" y="9" width="${b ? Math.max(1, 13 * b.level).toFixed(1) : 0}" height="6" rx="1" fill="${b && b.level <= 0.15 && !b.charging ? "#e5484d" : "#2fa84f"}"/><path d="M21.5 10.5v3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
          const diskIc = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6"><ellipse cx="12" cy="6.5" rx="7.5" ry="3"/><path d="M4.5 6.5v11c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-11M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3"/></svg>`;
          const netIc = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="${net.online ? "currentColor" : "#e5484d"}" stroke-width="1.8" stroke-linecap="round"><path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.2" r="1.2" fill="currentColor" stroke="none"/></svg>`;
          let html = "";
          if (ctx.size === "small") {
            html = `<div class="sh2-sys-small">${row("bat", batIc, "Battery", bTxt, "")}${row("net", netIc, "Network", nTxt, nBits)}</div>`;
          } else {
            html = row("bat", batIc, "Battery", bTxt, bSub, b ? bar(b.level, b.level <= 0.15 && !b.charging ? "low" : "ok") : "") +
              row("disk", diskIc, "Storage", sTxt, sSub, st.usage != null && st.quota ? bar(sFrac) : "") +
              row("net", netIc, "Network", nTxt, nBits || (net.online ? "Connection details not reported" : "Check your device's Wi-Fi"));
            {
              const cores = navigator.hardwareConcurrency, mem = navigator.deviceMemory;
              const scr = window.screen ? screen.width + " × " + screen.height + (window.devicePixelRatio > 1 ? " @" + (Math.round(devicePixelRatio * 100) / 100) + "x" : "") : "";
              html += `<div class="sh2-sys-grid"><div><span>Processor threads</span><b>${cores ? esc(cores) : "—"}</b></div><div><span>Memory</span><b>${mem ? "≥ " + esc(mem) + " GB" : "—"}</b></div><div><span>Screen</span><b>${esc(scr || "—")}</b></div><div><span>Saved state</span><b>${esc(fmtBytes(st.stateBytes))}</b></div></div>`;
            }
          }
          ctx.body.innerHTML = `<div class="sh2-sys">${html}</div>`;
        };
        draw();
        sysListeners.add(draw);
        let n = 0;
        return { tick() { if (++n % 10 === 0) draw(); }, destroy() { sysListeners.delete(draw); } };
      },
      menu: [{ label: "Open Task Manager", act: () => openApp("taskmanager") }],
    },

    focus: {
      name: "Focus", icon: G.focus, def: "small", sizes: ["small", "medium"], desc: "Start a focus session from Clock. Turns on Do not disturb while you work.",
      render(ctx) {
        const F = window.FocusSessions;
        if (!F) { ctx.body.innerHTML = `<div class="sh2-wg-empty">Focus sessions need the Clock app.</div>`; return; }
        let mode = null;
        const draw = () => {
          const i = F.info(), f = F.store();
          const m = i ? (i.paused ? "paused" : "run") : "idle";
          if (m === mode && i) {   // only the numbers change while running
            const t = ctx.body.querySelector(".sh2-fo-left"); if (t) t.textContent = fmtMs(i.segLeft);
            const p = ctx.body.querySelector(".sh2-fo-ring i"); if (p) p.style.setProperty("--p", String(Math.round((1 - i.segFrac) * 100)));
            return;
          }
          mode = m;
          if (!i) {
            ctx.body.innerHTML = `<div class="sh2-fo"><div class="sh2-fo-len"><button class="sh2-iconbtn" data-d="-1" aria-label="Less time">−</button><b>${esc(f.lengthMin)}<small> min</small></b><button class="sh2-iconbtn" data-d="1" aria-label="More time">+</button></div>
              <button class="sh2-primary sh2-fo-start">Start focus</button><small class="sh2-fo-note">Today: ${Math.floor(F.todaySec() / 60)} of ${esc(f.goalMin)} min</small></div>`;
            ctx.body.querySelectorAll("[data-d]").forEach((b) => b.onclick = () => { const d = +b.dataset.d, v = f.lengthMin, st = (d > 0 ? v >= 60 : v > 60) ? 15 : 5; f.lengthMin = Math.max(15, Math.min(240, v + d * st)); save(); mode = null; draw(); });
            ctx.body.querySelector(".sh2-fo-start").onclick = () => { F.start(); mode = null; draw(); };
          } else {
            ctx.body.innerHTML = `<div class="sh2-fo sh2-fo-on"><div class="sh2-fo-ring"><i style="--p:${Math.round((1 - i.segFrac) * 100)}"></i><b class="sh2-fo-left">${fmtMs(i.segLeft)}</b></div>
              <small>${i.paused ? "Paused" : i.seg.type === "break" ? "Break" : "Focusing"}</small>
              <div class="sh2-fo-ctl"><button class="sh2-chip sh2-fo-pp">${i.paused ? "Resume" : "Pause"}</button><button class="sh2-chip sh2-fo-open">Open</button></div></div>`;
            ctx.body.querySelector(".sh2-fo-pp").onclick = () => { const x = F.info(); if (x && x.paused) F.resume(); else F.pause(); F.emit(); mode = null; draw(); };
            ctx.body.querySelector(".sh2-fo-open").onclick = openFocus;
          }
        };
        draw();
        return { tick: draw };
      },
      menu: [{ label: "Open Focus in Clock", act: () => openFocus() }],
    },
  };
  const mins = (sec) => { const m = Math.round(sec / 60); return m >= 60 ? Math.floor(m / 60) + " h " + (m % 60) + " min" : m + " min"; };
  const fmtMs = (ms) => { const t = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60; return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(s).padStart(2, "0"); };

  // ---------------------------------------------------------------------------
  //  Actions
  // ---------------------------------------------------------------------------
  function openApp(id) { close(); setTimeout(() => { try { WM.open(id); } catch (_) {} }, 0); }
  function openFocus() { close(); try { if (window.FocusSessions) FocusSessions.wantTab = "focus"; WM.open("clock"); } catch (_) {} }
  function openPic(p) { close(); try { if (window.VFS && VFS.openNode) VFS.openNode(p.name, p.node); } catch (_) {} }
  let wxBusy = false;
  function refreshWeather() {
    if (wxBusy) return; wxBusy = true;
    if (board) board.classList.add("sh2-wx-busy");
    let p; try { p = WM.refreshWeather && WM.refreshWeather(); } catch (_) {}
    Promise.resolve(p).catch(() => {}).then(() => { wxBusy = false; if (board) board.classList.remove("sh2-wx-busy"); rerenderType("weather"); });
  }

  // ---------------------------------------------------------------------------
  //  The board
  // ---------------------------------------------------------------------------
  let board = null, ticker = null, openedAt = 0;
  const live = new Map();   // widget id -> { ctx, handle }

  function headTime() {
    const d = now();
    return `<b>${esc(timeStr(d))}</b><span>${esc(d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" }))}</span>`;
  }
  function open() {
    if (board) return;
    Fly.opening("widgets", () => close(true));
    try { if (window.WM && WM.refreshWeather) WM.refreshWeather(); } catch (_) {}
    board = el(`<section class="sh2-wb" role="dialog" aria-label="Widgets">
      <header class="sh2-wb-h">
        <div class="sh2-wb-time"></div>
        <button class="sh2-iconbtn sh2-wb-add" title="Add widgets" aria-label="Add widgets">${G.plus}</button>
        <button class="sh2-iconbtn sh2-wb-x" title="Close" aria-label="Close widgets">${G.close}</button>
      </header>
      <div class="sh2-wb-grid"></div>
      <div class="sh2-wb-foot">Drag a widget's title to rearrange · ⋯ for size and options</div>
    </section>`);
    board.querySelector(".sh2-wb-time").innerHTML = headTime();
    board.querySelector(".sh2-wb-x").onclick = () => close();
    board.querySelector(".sh2-wb-add").onclick = () => showPicker();
    (document.getElementById("screen") || document.body).appendChild(board);
    renderAll();
    openedAt = Date.now();
    requestAnimationFrame(() => requestAnimationFrame(() => board && board.classList.add("sh2-open")));
    ticker = setInterval(tick, 1000);
    const pill = document.querySelector(".tb-widgets"); if (pill) pill.classList.add("sh2-active");
  }
  function close(fromFly) {
    if (!board) return;
    const b = board; board = null;
    clearInterval(ticker); ticker = null;
    live.forEach((x) => { try { x.handle && x.handle.destroy && x.handle.destroy(); } catch (_) {} });
    live.clear();
    b.classList.remove("sh2-open"); b.classList.add("sh2-closing");
    setTimeout(() => { b.remove(); blobUrls.forEach((u) => { try { URL.revokeObjectURL(u); } catch (_) {} }); blobUrls.clear(); }, 260);
    if (!fromFly) Fly.closed("widgets");
    const pill = document.querySelector(".tb-widgets"); if (pill) pill.classList.remove("sh2-active");
  }
  function toggle() { if (board) close(); else open(); }
  function tick() {
    if (!board) return;
    const t = board.querySelector(".sh2-wb-time"); if (t) t.innerHTML = headTime();
    live.forEach((x) => { try { x.handle && x.handle.tick && x.handle.tick(); } catch (_) {} });
  }

  function renderAll() {
    if (!board) return;
    live.forEach((x) => { try { x.handle && x.handle.destroy && x.handle.destroy(); } catch (_) {} });
    live.clear();
    const grid = board.querySelector(".sh2-wb-grid"); grid.innerHTML = "";
    const list = store().list;
    if (!list.length) grid.innerHTML = `<div class="sh2-wb-none"><p>No widgets pinned.</p><button class="sh2-primary">Add widgets</button></div>`;
    const nb = grid.querySelector(".sh2-wb-none button"); if (nb) nb.onclick = showPicker;
    list.forEach((item) => grid.appendChild(buildCard(item)));
  }
  function buildCard(item, editing) {
    const T = TYPES[item.type];
    const card = el(`<article class="sh2-wg sh2-sz-${item.size} sh2-wg-${item.type}" data-id="${esc(item.id)}" aria-label="${esc(T.name)} widget">
      <div class="sh2-wg-h"><span class="sh2-wg-ic">${T.icon}</span><span class="sh2-wg-t">${esc(T.name)}</span><button class="sh2-wg-more" aria-label="${esc(T.name)} options">${G.more}</button></div>
      <div class="sh2-wg-b"></div></article>`);
    const ctx = { item, size: item.size, card, body: card.querySelector(".sh2-wg-b"), editing: !!editing, rerender: () => rerenderOne(item.id) };
    let handle = null;
    try { handle = T.render(ctx) || null; } catch (e) { ctx.body.innerHTML = `<div class="sh2-wg-empty">This widget couldn't load.</div>`; }
    live.set(item.id, { ctx, handle });
    card.querySelector(".sh2-wg-more").onclick = (e) => { e.stopPropagation(); showMenu(item, ctx, e.currentTarget); };
    attachDrag(card, item);
    return card;
  }
  function rerenderOne(id, focusInput) {
    if (!board) return;
    const old = board.querySelector(`.sh2-wg[data-id="${CSS.escape(id)}"]`);
    const item = store().list.find((x) => x.id === id);
    const prev = live.get(id);
    const editing = !!(prev && prev.ctx.editing);
    if (prev && prev.handle && prev.handle.destroy) { try { prev.handle.destroy(); } catch (_) {} }
    live.delete(id);
    if (!old || !item) return renderAll();
    const card = buildCard(item, editing);
    old.replaceWith(card);
    if (focusInput) { const inp = card.querySelector(".sh2-input"); if (inp) inp.focus({ preventScroll: true }); }
  }
  function rerenderType(type, focusInput) { store().list.filter((x) => x.type === type).forEach((x) => rerenderOne(x.id, focusInput)); }

  // ---- "⋯" menu: size, move, remove, plus the widget's own actions ----
  function closeMenus() { if (board) board.querySelectorAll(".sh2-menu").forEach((m) => m.remove()); }
  function showMenu(item, ctx, anchor) {
    const wasOpen = board.querySelector(`.sh2-menu[data-for="${CSS.escape(item.id)}"]`);
    closeMenus(); if (wasOpen) return;
    const T = TYPES[item.type], list = store().list, i = list.indexOf(item);
    const extra = (T.menu || []).filter((m) => !m.sizes || m.sizes.indexOf(item.size) >= 0);
    const m = el(`<div class="sh2-menu" role="menu" data-for="${esc(item.id)}">
      ${sizesOf(item.type).map((s) => `<button role="menuitemradio" aria-checked="${item.size === s}" data-size="${s}"><span class="sh2-menu-ck">${item.size === s ? G.check : ""}</span>${s[0].toUpperCase() + s.slice(1)}</button>`).join("")}
      <hr>
      ${extra.map((x, k) => `<button role="menuitem" data-x="${k}"><span class="sh2-menu-ck"></span>${esc(x.label)}</button>`).join("")}
      ${extra.length ? "<hr>" : ""}
      <button role="menuitem" data-mv="-1" ${i <= 0 ? "disabled" : ""}><span class="sh2-menu-ck"></span>Move up</button>
      <button role="menuitem" data-mv="1" ${i >= list.length - 1 ? "disabled" : ""}><span class="sh2-menu-ck"></span>Move down</button>
      <button role="menuitem" data-rm="1"><span class="sh2-menu-ck"></span>Remove widget</button>
    </div>`);
    m.querySelectorAll("[data-size]").forEach((b) => b.onclick = () => { item.size = b.dataset.size; save(); closeMenus(); rerenderOne(item.id); });
    m.querySelectorAll("[data-x]").forEach((b) => b.onclick = () => { closeMenus(); extra[+b.dataset.x].act(ctx); });
    m.querySelectorAll("[data-mv]").forEach((b) => b.onclick = () => { const d = +b.dataset.mv, j = list.indexOf(item); if (j + d < 0 || j + d >= list.length) return; list.splice(j, 1); list.splice(j + d, 0, item); save(); closeMenus(); renderAll(); });
    m.querySelector("[data-rm]").onclick = () => { list.splice(list.indexOf(item), 1); save(); closeMenus(); renderAll(); };
    board.appendChild(m);
    const r = anchor.getBoundingClientRect(), br = board.getBoundingClientRect();
    const mw = m.offsetWidth, mh = m.offsetHeight;
    m.style.left = Math.max(8, Math.min(br.width - mw - 8, r.right - br.left - mw)) + "px";
    m.style.top = Math.max(8, Math.min(br.height - mh - 8, r.bottom - br.top + 4)) + "px";
    const first = m.querySelector("button:not([disabled])"); if (first) first.focus({ preventScroll: true });
  }

  // ---- "Add widgets" picker ----
  function showPicker() {
    if (!board) return;
    closeMenus();
    const ex = board.querySelector(".sh2-picker"); if (ex) { ex.remove(); return; }
    const have = new Set(store().list.map((x) => x.type));
    const p = el(`<div class="sh2-picker" role="dialog" aria-label="Add widgets">
      <div class="sh2-picker-h"><b>Add widgets</b><button class="sh2-iconbtn" aria-label="Close">${G.close}</button></div>
      <div class="sh2-picker-list">${Object.keys(TYPES).map((k) => `<div class="sh2-picker-row"><span class="sh2-picker-ic">${TYPES[k].icon}</span><span class="sh2-picker-tx"><b>${esc(TYPES[k].name)}</b><small>${esc(TYPES[k].desc)}</small></span>${have.has(k) ? `<span class="sh2-picker-on">${G.check} Added</span>` : `<button class="sh2-chip" data-add="${k}">Pin</button>`}</div>`).join("")}</div>
    </div>`);
    p.querySelector(".sh2-picker-h button").onclick = () => p.remove();
    p.querySelectorAll("[data-add]").forEach((b) => b.onclick = () => {
      const k = b.dataset.add; const item = { id: uid(), type: k, size: TYPES[k].def, cfg: {} };
      store().list.unshift(item); save(); p.remove(); renderAll();
      const c = board.querySelector(`.sh2-wg[data-id="${CSS.escape(item.id)}"]`); if (c) { c.scrollIntoView({ block: "nearest" }); c.classList.add("sh2-new"); }
    });
    board.appendChild(p);
  }

  // ---- Drag a widget by its title bar to reorder (mouse + touch) ----
  function attachDrag(card, item) {
    const h = card.querySelector(".sh2-wg-h");
    h.addEventListener("pointerdown", (e) => {
      if (e.button > 0 || e.target.closest("button")) return;
      const sx = e.clientX, sy = e.clientY; let dragging = false;
      const move = (ev) => {
        if (!dragging) { if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 8) return; dragging = true; card.classList.add("sh2-dragging"); closeMenus(); }
        ev.preventDefault();
        const t = document.elementFromPoint(ev.clientX, ev.clientY);
        const over = t && t.closest && t.closest(".sh2-wg");
        if (!over || over === card || !over.parentNode) return;
        const r = over.getBoundingClientRect();
        const after = (ev.clientY - r.top) / r.height > 0.5 || ((ev.clientX - r.left) / r.width > 0.5 && Math.abs(ev.clientY - (r.top + r.height / 2)) < r.height / 4);
        over.parentNode.insertBefore(card, after ? over.nextSibling : over);
      };
      const up = () => {
        window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
        if (!dragging) return;
        card.classList.remove("sh2-dragging");
        const order = [...board.querySelectorAll(".sh2-wg")].map((c) => c.dataset.id);
        const st = store(); st.list.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)); save();
      };
      window.addEventListener("pointermove", move, { passive: false }); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
    });
  }

  // ---- close on outside tap / Esc; keyboard shortcuts ----
  document.addEventListener("pointerdown", (e) => {
    if (!board) return;
    if (!e.target.closest(".sh2-menu") && !e.target.closest(".sh2-wg-more")) closeMenus();
    if (board.contains(e.target) || e.target.closest(".tb-widgets") || Date.now() - openedAt < 250) return;
    close();
  }, true);
  const isApple = /Mac|iPhone|iPad|iPod/.test(navigator.platform || "") || (/Macintosh/.test(navigator.userAgent) && "ontouchend" in document);
  window.addEventListener("keydown", (e) => {
    const ctrlAlt = e.ctrlKey && e.altKey && !e.metaKey && !e.shiftKey;
    const winKey = e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey && !isApple;   // Cmd+W closes the tab on Apple devices
    if ((ctrlAlt || winKey) && (e.code === "KeyW" || (winKey && (e.key === "w" || e.key === "W")))) {
      if (!document.querySelector(".taskbar") || document.querySelector(".lock-screen")) return;   // desktop only (not boot / setup / lock)
      e.preventDefault(); e.stopPropagation(); toggle(); return;
    }
    if (board && e.key === "Escape") {
      e.preventDefault(); e.stopPropagation();
      if (board.querySelector(".sh2-menu")) closeMenus();
      else if (board.querySelector(".sh2-picker")) board.querySelector(".sh2-picker").remove();
      else close();
    }
  }, true);
  window.addEventListener("weather-change", () => rerenderType("weather"));

  // ---------------------------------------------------------------------------
  //  Start menu / search entry
  // ---------------------------------------------------------------------------
  window.AppRegistry = window.AppRegistry || {};
  AppRegistry.widgets = function () { setTimeout(open, 0); };
  try {
    if (window.Catalog && Catalog.storeApps && !Catalog.storeApps.find((a) => a.id === "widgets")) {
      Catalog.storeApps.push({ id: "widgets", name: "Widgets", cat: "System", price: 0, builtin: "widgets", desc: "Your widgets board — weather, calendar, clocks, to-do, photos and system info. Tap the weather on the taskbar, or press Win+W / Ctrl+Alt+W." });
    }
    (window.EXTRA_DEFAULT_APPS = window.EXTRA_DEFAULT_APPS || []).push("widgets");
  } catch (_) {}

  window.Widgets12 = { open, close: () => close(), toggle, isOpen: () => !!board, types: () => Object.keys(TYPES), layout: () => store().list.map((x) => ({ type: x.type, size: x.size })) };
})();
