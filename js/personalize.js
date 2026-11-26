/* Personalization (Windows 11 style) — theme packs, Windows spotlight, time-of-day ("dynamic") wallpaper,
   slideshow backgrounds, picture fit, Night light strength + schedule, HDR look, Start "Recommended",
   Jump Lists, and taskbar badges / progress / overflow / drag-to-pin / combine buttons.

   What is real and what is simulated:
   - Theme packs really change the wallpaper(s), light/dark mode, accent color and mouse pointer.
     Export/import is a JSON file (".themepack.json") — the same idea as a .themepack, not Windows' CAB format.
   - Windows spotlight rotates daily through pictures bundled with this site (assets/pz/spot_*.jpg). They are
     procedurally generated landscapes made for this project — not photos of real places — and the
     "Learn about this picture" card says exactly that. Nothing is downloaded.
   - Dynamic wallpaper follows the real local time. Sunrise/sunset come from your location (only if you
     allow it) using the NOAA solar equations; otherwise 7:00 AM / 7:00 PM.
   - Night light is a real blue-light filter (a multiply layer, js/wm.js applyDisplayFx) with a strength
     slider and a schedule (sunset to sunrise, or set hours).
   - HDR: the HDR display check is real (CSS media query dynamic-range: high). The "HDR look" is simulated
     (a little extra contrast and saturation) — browsers can't switch a screen into HDR mode.
   - Recommended / Jump Lists use real files from the virtual file system (State.data.appData.files) —
     what you open (tracked here) and what you save (file timestamps) — plus apps installed recently.
   - Badges are the real unread counts from the Notification Center (js/notifcenter.js); apps can report
     progress with Notify.show({ app, progress: 0..1 }) or Notify.progress(appId, value).
   State: State.data.appData.pz (+ appData.taskbarCombine, quickSettings.nightStrength).
   Styles: css/personalize.css (classes pz-*). */
(function () {
  "use strict";
  if (window.Personalize) return;
  const S = () => State.data;
  const save = () => { try { State.save(); } catch (_) {} };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const el = (html) => { const d = document.createElement("div"); d.innerHTML = String(html).trim(); return d.firstElementChild; };
  const now = () => { try { return State.now ? new Date(State.now()) : new Date(); } catch (_) { return new Date(); } };
  const scr = () => document.getElementById("screen") || document.body;
  const toast = (title, body) => { try { if (window.Notify) Notify.show({ icon: window.Icon ? Icon.mini("personalization", "Personalization") : "", title, body, app: "Settings" }); } catch (_) {} };
  const reduceMotion = () => { try { return document.documentElement.classList.contains("fx-noanim") || document.body.classList.contains("a11y-reduce-motion") || matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (_) { return false; } };

  // ===================================================================
  //  Store
  // ===================================================================
  function pz() {
    const a = S().appData || (S().appData = {});
    const p = a.pz || (a.pz = {});
    const def = {
      bg: { mode: "picture", fit: "fill", fitColor: "#1f1f1f", recent: [], wpMark: null, slideshow: { source: "pack", images: [], folder: ["Pictures"], interval: 30, shuffle: false, idx: 0, last: 0 }, spot: { skip: 0, dislikes: [] } },
      theme: { custom: [] },
      night: { schedule: false, mode: "sun", on: "21:00", off: "07:00", lastPhase: "" },
      hdr: false,
      start: { recentApps: true, recFiles: true, layout: "default", removed: {} },
      badges: true, opens: {}, jumpPins: {}, appsSeen: null, geo: null,
    };
    for (const k in def) {
      if (p[k] == null) p[k] = JSON.parse(JSON.stringify(def[k]));
      else if (typeof def[k] === "object" && !Array.isArray(def[k])) for (const j in def[k]) if (p[k][j] == null) p[k][j] = JSON.parse(JSON.stringify(def[k][j]));
    }
    if (!p.bg.slideshow.folder) p.bg.slideshow.folder = ["Pictures"];
    return p;
  }
  function qs() { const a = S().appData || (S().appData = {}); return a.quickSettings || (a.quickSettings = { wifi: true, bt: false, plane: false, night: false, focus: false, brightness: 90, volume: 55, signal: "good" }); }

  // ===================================================================
  //  Pictures (all bundled locally in assets/pz; see header)
  // ===================================================================
  const P = (n) => "assets/pz/" + n + ".jpg", T = (n) => "assets/pz/" + n + "_t.jpg";
  const thumbOf = (url) => { const m = /^assets\/pz\/([\w-]+)\.jpg$/.exec(url || ""); return m ? T(m[1]) : url; };
  const SPOT = [
    { k: "spot_ridges", title: "Layered ridges", text: "Six mountain ridges drawn from smoothed random noise. Each ridge is lighter and pinker than the one in front of it — the same trick painters use to show haze making distant hills fade into the sky." },
    { k: "spot_alpine", title: "Alpine lake", text: "Snow-capped peaks above a forested shore. The lake is a mirrored copy of everything above the waterline, darkened and crossed with thin ripple lines." },
    { k: "spot_dunes", title: "Desert dunes", text: "Each dune crest is a sine wave nudged by noise. The shading runs from pale sand at the top of a dune to burnt orange in the troughs." },
    { k: "spot_aurora", title: "Aurora over a snowy plain", text: "The green, cyan and violet curtains are hundreds of thin vertical gradients whose height follows a noise curve, with 700 randomly placed stars behind them." },
    { k: "spot_forest", title: "Misty pine forest", text: "Five rows of pine silhouettes with bands of fog between them. Every row is drawn larger and darker than the one behind it, which reads as depth." },
    { k: "spot_coast", title: "Headland at sunset", text: "A single rocky headland against a sunset sky. The water reflects the sky's colors and is streaked with ripple lines." },
    { k: "spot_milkyway", title: "Starry hills", text: "More than a thousand stars and a faint violet glow over dark hills and a ragged tree line." },
    { k: "spot_hills", title: "Rolling green hills", text: "Soft hills under a summer sky. The clouds are clusters of overlapping ellipses, blurred so they look fluffy." },
  ];
  const DYN = { sunrise: P("dyn_sunrise"), day: P("dyn_day"), sunset: P("dyn_sunset"), night: P("dyn_night") };
  const DYN_LABEL = { sunrise: "Sunrise", day: "Day", sunset: "Sunset", night: "Night" };

  // Built-in theme packs.
  const PACKS = [
    { id: "win-light", name: "Windows (light)", mode: "light", accent: "#0067c0", cursor: "white", bg: { mode: "picture", wallpaper: "assets/wall4.jpg" }, thumb: "assets/wall4.jpg" },
    { id: "win-dark", name: "Windows (dark)", mode: "dark", accent: "#0067c0", cursor: "white", bg: { mode: "picture", wallpaper: "default" }, thumb: "assets/wall3.jpg" },
    { id: "glow", name: "Glow", mode: "dark", accent: "#8a5cf6", cursor: "white", bg: { mode: "slideshow", images: [P("glow1"), P("glow2"), P("glow3")], interval: 30, shuffle: false } },
    { id: "motion", name: "Captured Motion", mode: "dark", accent: "#e3008c", cursor: "white", bg: { mode: "slideshow", images: [P("motion1"), P("motion2"), P("motion3")], interval: 30, shuffle: false } },
    { id: "sunrise", name: "Sunrise", mode: "light", accent: "#da3b01", cursor: "white", bg: { mode: "slideshow", images: [P("dyn_sunrise"), P("spot_ridges"), P("spot_dunes")], interval: 30, shuffle: false } },
    { id: "flow", name: "Flow", mode: "light", accent: "#038387", cursor: "white", bg: { mode: "slideshow", images: [P("flow1"), P("flow2"), P("flow3")], interval: 30, shuffle: false } },
    { id: "spotlight", name: "Windows spotlight", mode: "light", accent: "#0078d4", cursor: "white", bg: { mode: "spotlight" }, thumb: T("spot_alpine") },
    { id: "lakeside", name: "Lakeside (time of day)", mode: "dark", accent: "#2a5bd7", cursor: "white", bg: { mode: "dynamic" }, thumb: T("dyn_sunset") },
    { id: "xp", name: "Windows XP (classic)", mode: "light", accent: "#245edb", cursor: "white", xp: true, bg: { mode: "picture", wallpaper: "assets/xp_wallpaper.png" }, thumb: "assets/xp_wallpaper.png" },
  ];
  const packThumb = (t) => t.thumb || (t.bg && t.bg.images && t.bg.images[0] ? thumbOf(t.bg.images[0]) : t.bg && t.bg.wallpaper ? wpUrl(t.bg.wallpaper) : "");

  // ===================================================================
  //  Time: sunrise / sunset (NOAA general solar position equations)
  // ===================================================================
  function sunTimes(date, lat, lon) {
    const rad = Math.PI / 180;
    const start = new Date(date.getFullYear(), 0, 0), doy = Math.floor((new Date(date.getFullYear(), date.getMonth(), date.getDate()) - start) / 86400000);
    const g = (2 * Math.PI / 365) * (doy - 1);
    const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
    const x = Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(decl)) - Math.tan(lat * rad) * Math.tan(decl);
    if (x > 1) return { polar: "night" };
    if (x < -1) return { polar: "day" };
    const ha = Math.acos(x) / rad;
    const tz = -new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12).getTimezoneOffset();
    const norm = (m) => ((Math.round(m) % 1440) + 1440) % 1440;
    return { rise: norm(720 - 4 * (lon + ha) - eq + tz), set: norm(720 - 4 * (lon - ha) - eq + tz) };
  }
  const FIXED_SUN = { rise: 7 * 60, set: 19 * 60 };
  function locationAllowed() { const p = S().appData && S().appData.settings12; return !(p && p.location === false); }
  function sun(date) {
    const g = pz().geo;
    if (g && locationAllowed()) { const t = sunTimes(date || now(), g.lat, g.lon); return Object.assign({ fromGeo: true }, t); }
    return Object.assign({ fromGeo: false }, FIXED_SUN);
  }
  const minsOf = (d) => d.getHours() * 60 + d.getMinutes();
  const hhmm = (m) => { m = ((m % 1440) + 1440) % 1440; const d = new Date(2000, 0, 1, Math.floor(m / 60), m % 60); return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); };
  const parseHM = (s) => { const m = /^(\d{1,2}):(\d{2})/.exec(s || ""); return m ? (+m[1]) * 60 + (+m[2]) : 0; };
  const inRange = (m, a, b) => (a <= b ? m >= a && m < b : m >= a || m < b);
  // Ask for (or silently reuse) the device location. `ask` = the user pressed a button.
  function refreshGeo(ask) {
    return new Promise((resolve) => {
      if (!navigator.geolocation || !locationAllowed()) return resolve(false);
      const go = () => navigator.geolocation.getCurrentPosition((pos) => {
        pz().geo = { lat: +pos.coords.latitude.toFixed(2), lon: +pos.coords.longitude.toFixed(2), ts: Date.now() }; save(); resolve(true);
      }, () => resolve(false), { timeout: 9000, maximumAge: 6 * 3600000 });
      if (ask) return go();
      try { navigator.permissions.query({ name: "geolocation" }).then((st) => (st.state === "granted" ? go() : resolve(false)), () => resolve(false)); } catch (_) { resolve(false); }
    });
  }
  function dynPhase(date) {
    const d = date || now(), s = sun(d), m = minsOf(d);
    if (s.polar) return { phase: s.polar === "day" ? "day" : "night", sun: s };
    let phase = "night";
    if (inRange(m, s.rise - 45, s.rise + 75)) phase = "sunrise";
    else if (inRange(m, s.rise + 75, s.set - 75)) phase = "day";
    else if (inRange(m, s.set - 75, s.set + 45)) phase = "sunset";
    return { phase, sun: s };
  }

  // ===================================================================
  //  Wallpaper resolution (called by js/wm.js applyWallpaper)
  // ===================================================================
  function wpUrl(wp) { return !wp || wp === "default" ? "assets/wall3.jpg" : wp; }
  const isImg = (wp) => !wp || wp === "default" || /^(data:|https?:|blob:|assets\/)/.test(wp);
  const dayNum = (d) => Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).getTime() / 86400000);
  function spotCurrent() {
    const sp = pz().bg.spot, dis = sp.dislikes || [];
    const base = dayNum(now()) + (sp.skip || 0);
    for (let i = 0; i < SPOT.length; i++) { const it = SPOT[(((base + i) % SPOT.length) + SPOT.length) % SPOT.length]; if (!dis.includes(it.k) || i === SPOT.length - 1) return Object.assign({ src: P(it.k) }, it); }
    return Object.assign({ src: P(SPOT[0].k) }, SPOT[0]);
  }
  // ---- slideshow ----
  const blobUrls = new Map();
  function nodeImgUrl(node) {
    if (node.blob && window.VFS && VFS.getBlob) {
      if (blobUrls.has(node.blob)) return blobUrls.get(node.blob) || node.src || null;
      blobUrls.set(node.blob, null);
      VFS.getBlob(node.blob).then((b) => { if (b) { blobUrls.set(node.blob, URL.createObjectURL(b)); applyWp(); } }).catch(() => {});
      return node.src || null;
    }
    return node.src || null;
  }
  const IMG_RE = /\.(png|jpe?g|gif|webp|bmp|avif)$/i;
  function folderImages(path) {
    const out = [];
    const start = nodeAtPath(path);
    (function rec(n, depth) {
      if (!n || !n.children || depth > 3) return;
      Object.keys(n.children).sort().forEach((k) => { const c = n.children[k]; if (!c || c.hidden) return; if (c.type === "folder") rec(c, depth + 1); else if (c.type === "file" && (c.kind === "image" || IMG_RE.test(k)) && (c.src || c.blob)) out.push({ name: k, node: c }); });
    })(start, 0);
    return out;
  }
  function slideList() {
    const ss = pz().bg.slideshow;
    if (ss.source === "folder") return folderImages(ss.folder || ["Pictures"]).map((x) => ({ key: x.name, url: () => nodeImgUrl(x.node) }));
    return (ss.images || []).map((u) => ({ key: u, url: () => u }));
  }
  function slideCurrent() {
    const list = slideList(); if (!list.length) return null;
    const ss = pz().bg.slideshow; ss.idx = ((ss.idx || 0) % list.length + list.length) % list.length;
    return list[ss.idx].url();
  }
  function slideNext() {
    const list = slideList(), ss = pz().bg.slideshow; if (!list.length) return;
    if (ss.shuffle && list.length > 2) { let n = ss.idx; while (n === ss.idx) n = Math.floor(Math.random() * list.length); ss.idx = n; }
    else ss.idx = ((ss.idx || 0) + 1) % list.length;
    ss.last = Date.now(); save(); applyWp();
  }
  // ---- the hook ----
  function fitCss(url, fit, color) {
    const u = `url("${String(url).replace(/"/g, "%22")}")`;
    switch (fit) {
      case "fit": return `${u} center / contain no-repeat ${color}`;
      case "stretch": return `${u} 0 0 / 100% 100% no-repeat ${color}`;
      case "tile": return `${u} 0 0 / auto repeat ${color}`;
      case "center": return `${u} center / auto no-repeat ${color}`;
      default: return `${u} center / cover no-repeat ${color}`;
    }
  }
  const shown = { dyn: "", spot: "" };   // what the desktop currently shows (the clock re-applies on change)
  function wallpaperCss() {
    const b = pz().bg, wp = S().desktop && S().desktop.wallpaper;
    // Something else (old Background page, Photos "set as background", XP theme…) picked a picture: follow it.
    if (b.mode !== "picture" && b.mode !== "solid" && typeof b.wpMark === "string" && String(wp || "") !== b.wpMark) { b.mode = isImg(wp) ? "picture" : "solid"; save(); }
    setTimeout(syncSpotChip, 0);
    const color = b.fitColor || "#1f1f1f";
    if (b.mode === "slideshow") { const u = slideCurrent(); if (u) return fitCss(u, b.fit, color); }
    if (b.mode === "spotlight") { const c = spotCurrent(); shown.spot = c.k; return fitCss(c.src, "fill", color); }
    if (b.mode === "dynamic") { const ph = dynPhase().phase; shown.dyn = ph; return fitCss(DYN[ph], "fill", color); }
    if (isImg(wp)) return fitCss(wpUrl(wp), b.fit, color);
    return null;   // solid color: js/wm.js paints it
  }
  // Fade from the previous wallpaper to the new one.
  function crossfade(desk, css) {
    if (desk.__pzCss === css && desk.style.background === desk.__pzSet) return;
    const prev = desk.style.background;
    desk.style.background = css;
    desk.__pzCss = css; desk.__pzSet = desk.style.background;
    if (!prev || prev === desk.style.background || reduceMotion()) return;
    desk.querySelectorAll(":scope > .pz-bgfade").forEach((x) => x.remove());
    const f = el(`<div class="pz-bgfade" aria-hidden="true"></div>`); f.style.background = prev;
    desk.prepend(f);
    requestAnimationFrame(() => requestAnimationFrame(() => { f.style.opacity = "0"; }));
    setTimeout(() => f.remove(), 1400);
  }
  function applyWp() { try { if (window.WM && WM.applyWallpaper) WM.applyWallpaper(); else if (window.applyWallpaper) window.applyWallpaper(); } catch (e) { console.error("[pz] wallpaper", e); } }
  function setBg(o) {
    const b = pz().bg;
    if (o.mode === "picture" || o.mode === "solid") {
      S().desktop.wallpaper = o.wallpaper; if (o.xp !== undefined) S().desktop.xpTheme = !!o.xp;
      if (o.mode === "picture" && o.wallpaper && !/^data:/.test(o.wallpaper)) { b.recent = [o.wallpaper].concat((b.recent || []).filter((x) => x !== o.wallpaper)).slice(0, 5); }
    }
    if (o.mode === "slideshow") {
      const ss = b.slideshow;
      if (o.images) { ss.source = "pack"; ss.images = o.images.slice(); ss.idx = 0; }
      if (o.source) ss.source = o.source;
      if (o.folder) { ss.folder = o.folder.slice(); ss.idx = 0; }
      if (o.interval) ss.interval = o.interval;
      if (o.shuffle != null) ss.shuffle = !!o.shuffle;
      ss.last = Date.now();
    }
    if (o.fit) b.fit = o.fit;
    b.mode = o.mode;
    b.wpMark = String(S().desktop.wallpaper || "");
    save();
    try { if (window.applyTheme) window.applyTheme(); } catch (_) {}
    applyWp();
  }

  // ---- "Learn about this picture" (Windows spotlight) ----
  function syncSpotChip() {
    const desk = document.querySelector("#screen > .desktop");
    const on = pz().bg.mode === "spotlight" && !!desk;
    let chip = desk && desk.querySelector(":scope > .pz-spot-chip");
    if (!on) { document.querySelectorAll(".pz-spot-chip,.pz-spot-card").forEach((x) => x.remove()); return; }
    const cur = spotCurrent();
    if (!chip) {
      chip = el(`<button type="button" class="pz-spot-chip" aria-haspopup="dialog"><span class="pz-spot-i" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5" stroke-linecap="round"/></svg></span><span>Learn about this picture</span></button>`);
      chip.addEventListener("mousedown", (e) => e.stopPropagation());
      chip.addEventListener("touchstart", (e) => e.stopPropagation(), { passive: true });
      chip.onclick = (e) => { e.stopPropagation(); toggleSpotCard(); };
      desk.appendChild(chip);
    }
    chip.title = cur.title;
    const card = document.querySelector(".pz-spot-card");
    if (card && card.dataset.k !== cur.k) { card.remove(); toggleSpotCard(); }
  }
  function toggleSpotCard() {
    const ex = document.querySelector(".pz-spot-card"); if (ex) { ex.remove(); return; }
    const cur = spotCurrent();
    const card = el(`<div class="pz-spot-card" role="dialog" aria-label="About this picture" data-k="${esc(cur.k)}">
      <img class="pz-spot-thumb" src="${esc(T(cur.k))}" alt="">
      <div class="pz-spot-body"><div class="pz-spot-kicker">Windows spotlight · Today's picture</div><b class="pz-spot-title">${esc(cur.title)}</b>
      <p>${esc(cur.text)}</p>
      <p class="pz-spot-note">This picture was generated by a small canvas program for this site and ships with it (no download). It is not a photograph of a real place.</p>
      <div class="pz-spot-btns"><button type="button" data-a="like" title="I like this picture">Like</button><button type="button" data-a="dislike" title="Don't show this picture again">Dislike</button><button type="button" data-a="next">Next picture</button></div></div></div>`);
    card.addEventListener("mousedown", (e) => e.stopPropagation());
    card.addEventListener("touchstart", (e) => e.stopPropagation(), { passive: true });
    card.querySelector('[data-a="next"]').onclick = () => { pz().bg.spot.skip = (pz().bg.spot.skip || 0) + 1; save(); card.remove(); applyWp(); };
    card.querySelector('[data-a="dislike"]').onclick = () => { const sp = pz().bg.spot; if (!sp.dislikes.includes(cur.k)) sp.dislikes.push(cur.k); if (sp.dislikes.length >= SPOT.length) sp.dislikes = [cur.k]; save(); card.remove(); applyWp(); };
    card.querySelector('[data-a="like"]').onclick = (e) => { const sp = pz().bg.spot; sp.dislikes = sp.dislikes.filter((x) => x !== cur.k); save(); e.currentTarget.textContent = "Liked ✓"; };
    (document.querySelector("#screen > .desktop") || scr()).appendChild(card);
    setTimeout(() => document.addEventListener("pointerdown", function h(ev) { if (!card.contains(ev.target) && !ev.target.closest(".pz-spot-chip")) { card.remove(); document.removeEventListener("pointerdown", h, true); } }, true), 0);
  }

  // ===================================================================
  //  Themes
  // ===================================================================
  function resolvedMode() { const t = S().theme; if (t === "light" || t === "dark") return t; return document.body.classList.contains("dark") ? "dark" : "light"; }
  function cursorStyle() { try { return (window.A11y && A11y.get("ptr.style")) || "white"; } catch (_) { return "white"; } }
  function snapshot(name) {
    const b = pz().bg, ss = b.slideshow, wp = S().desktop.wallpaper || "default";
    const bg = { mode: b.mode, fit: b.fit };
    if (b.mode === "picture" || b.mode === "solid") bg.wallpaper = wp;
    if (b.mode === "slideshow") Object.assign(bg, ss.source === "folder" ? { source: "folder", folder: ss.folder } : { images: ss.images }, { interval: ss.interval, shuffle: ss.shuffle });
    return { name: name || "Custom", mode: resolvedMode(), accent: (S().accent || "#0067c0").toLowerCase(), cursor: cursorStyle(), xp: !!S().desktop.xpTheme, bg };
  }
  function bgSig(bg) { if (!bg) return ""; const m = bg.mode; if (m === "picture" || m === "solid") return m + ":" + wpUrl(bg.wallpaper); if (m === "slideshow") return m + ":" + (bg.source === "folder" ? "f:" + (bg.folder || []).join("/") : (bg.images || []).join("|")); return m; }
  function themeSig(t) { return [t.mode, (t.accent || "").toLowerCase(), bgSig(t.bg), !!t.xp].join("#"); }
  function allThemes() { return PACKS.map((t) => Object.assign({ builtin: true }, t)).concat((pz().theme.custom || []).map((t) => Object.assign({ builtin: false }, t))); }
  function currentThemeId() {
    const sig = themeSig(snapshot()), all = allThemes(), last = all.find((x) => x.id === pz().theme.current);
    if (last && themeSig(last) === sig) return last.id;   // the theme last applied / saved, if nothing changed since
    const t = all.find((x) => themeSig(x) === sig); return t ? t.id : null;
  }
  function applyTheme(t) {
    if (!t) return;
    if (t.mode === "light" || t.mode === "dark") S().theme = t.mode;
    if (t.accent) { S().accent = t.accent; document.documentElement.style.setProperty("--accent", t.accent); }
    S().desktop.xpTheme = !!t.xp;
    if (t.cursor && window.A11y && A11y.set) { try { A11y.set("ptr.style", t.cursor, { now: true }); } catch (_) {} }
    const bg = Object.assign({}, t.bg || { mode: "picture", wallpaper: "default" });
    if (bg.mode === "slideshow" && bg.source === "folder") setBg({ mode: "slideshow", source: "folder", folder: bg.folder || ["Pictures"], interval: bg.interval, shuffle: bg.shuffle, fit: bg.fit });
    else setBg(Object.assign(bg, { xp: !!t.xp }));
    try { if (window.applyTheme) window.applyTheme(); } catch (_) {}
    pz().theme.current = t.id || null; save();
    try { window.dispatchEvent(new CustomEvent("theme-change", { detail: { id: t.id } })); } catch (_) {}
  }
  function saveTheme(name) {
    const t = snapshot(name); t.id = "c_" + Date.now().toString(36);
    pz().theme.custom.push(t); pz().theme.current = t.id; save(); return t;
  }
  function exportTheme(t) {
    const data = { format: "windows12-themepack", version: 1, note: "Windows 12 web theme (JSON). Not a Microsoft .themepack (CAB) file.", theme: { name: t.name, mode: t.mode, accent: t.accent, cursor: t.cursor, xp: !!t.xp, bg: t.bg } };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const fname = (t.name || "Theme").replace(/[\\/:*?"<>|]+/g, "_") + ".themepack.json";
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = fname; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
    return fname;
  }
  function importThemeText(text) {
    let j; try { j = JSON.parse(text); } catch (_) { throw new Error("That file isn't a theme file (it isn't valid JSON)."); }
    const t = j && j.theme;
    if (!j || j.format !== "windows12-themepack" || !t || typeof t !== "object") throw new Error("That file isn't a Windows 12 theme file.");
    const okColor = (c) => /^#[0-9a-f]{6}$/i.test(c || "");
    const okUrl = (u) => typeof u === "string" && (/^assets\/[\w./-]+$/.test(u) || /^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(u) || u === "default" || okColor(u));
    const bg = t.bg || {}, mode = ["picture", "solid", "slideshow", "spotlight", "dynamic"].includes(bg.mode) ? bg.mode : "picture";
    const clean = { id: "c_" + Date.now().toString(36), name: String(t.name || "Imported theme").slice(0, 60), mode: t.mode === "dark" ? "dark" : "light", accent: okColor(t.accent) ? t.accent.toLowerCase() : "#0067c0", cursor: ["white", "black", "inverted"].includes(t.cursor) ? t.cursor : "white", xp: !!t.xp, bg: { mode, fit: ["fill", "fit", "stretch", "tile", "center", "span"].includes(bg.fit) ? bg.fit : "fill" } };
    if (mode === "picture" || mode === "solid") { if (!okUrl(bg.wallpaper)) throw new Error("The theme's background picture isn't supported."); clean.bg.wallpaper = bg.wallpaper; }
    if (mode === "slideshow") {
      if (bg.source === "folder") { clean.bg.source = "folder"; clean.bg.folder = (Array.isArray(bg.folder) ? bg.folder : ["Pictures"]).map(String).slice(0, 8); }
      else { const imgs = (bg.images || []).filter(okUrl).slice(0, 30); if (!imgs.length) throw new Error("The theme's slideshow has no supported pictures."); clean.bg.images = imgs; }
      clean.bg.interval = [1, 10, 30, 60, 360, 1440].includes(+bg.interval) ? +bg.interval : 30; clean.bg.shuffle = !!bg.shuffle;
    }
    pz().theme.custom.push(clean); save(); return clean;
  }

  // ===================================================================
  //  Night light schedule + HDR look
  // ===================================================================
  function nightWindow() {
    const n = pz().night;
    if (n.mode === "hours") return { on: parseHM(n.on), off: parseHM(n.off), geo: false };
    const s = sun(); if (s.polar) return { on: s.polar === "night" ? 0 : 1, off: s.polar === "night" ? 1440 : 1, geo: s.fromGeo, polar: s.polar };
    return { on: s.set, off: s.rise, geo: s.fromGeo };
  }
  function nightTick(force) {
    const n = pz().night; if (!n.schedule) return;
    const w = nightWindow(), m = minsOf(now());
    const want = w.polar ? w.polar === "night" : inRange(m, w.on, w.off);
    const phase = want ? "on" : "off";
    if (force || n.lastPhase !== phase) {
      n.lastPhase = phase; const q = qs();
      if (!!q.night !== want) { q.night = want; try { window.dispatchEvent(new CustomEvent("quicksettings-change", { detail: { night: want } })); } catch (_) {} }
      save(); if (window.WM && WM.applyDisplayFx) WM.applyDisplayFx();
      document.querySelectorAll(".qs-panel .qs-tile").forEach((t) => { const l = t.querySelector(".qs-tile-lbl"); if (l && l.textContent === "Night light") t.classList.toggle("on", want); });
    }
  }
  function nightStatus() {
    const n = pz().night, q = qs();
    if (!n.schedule) return q.night ? "On" : "Off";
    const w = nightWindow();
    if (w.polar) return q.night ? "On (the sun doesn't rise here today)" : "Off (the sun doesn't set here today)";
    return q.night ? "On until " + hhmm(w.off) : "Off until " + hhmm(w.on);
  }
  const hdrSupported = () => { try { return matchMedia("(dynamic-range: high)").matches; } catch (_) { return false; } };
  const p3Supported = () => { try { return matchMedia("(color-gamut: p3)").matches; } catch (_) { return false; } };
  function applyHdr() {
    let o = document.getElementById("pzHdr");
    if (!pz().hdr) { if (o) o.remove(); document.documentElement.classList.remove("pz-hdr-on"); return; }
    if (!o) { o = el(`<div id="pzHdr" class="pz-hdr" aria-hidden="true"></div>`); scr().appendChild(o); }
    document.documentElement.classList.add("pz-hdr-on");
  }

  // ===================================================================
  //  Files: open tracking, Recommended, Jump Lists
  // ===================================================================
  function vroot() { try { return S().appData.files && S().appData.files.root; } catch (_) { return null; } }
  function nodeAtPath(p) {
    if (window.FilesHelper && FilesHelper.nodeAt) { try { return FilesHelper.nodeAt(p); } catch (_) {} }
    let n = { type: "folder", children: vroot() || {} }; for (const seg of p) { n = n && n.children && n.children[seg]; if (!n) return null; } return n;
  }
  function walkFiles(cb) {
    const r = vroot(); if (!r) return;
    (function rec(kids, p) { Object.keys(kids).forEach((k) => { const n = kids[k]; if (!n) return; if (n.type === "folder") { if (k !== "Local Disk (C:)" && n.children && !n.hidden) rec(n.children, p.concat(k)); } else cb(n, k, p); }); })(r, []);
  }
  function pathOf(node) {
    let found = null;
    walkFiles((n, k, p) => { if (!found && n === node) found = p.concat(k); });
    return found;
  }
  const keyOf = (path) => path.join("/");
  function noteOpen(path, app) {
    if (!path || !path.length) return;
    const o = pz().opens; o[keyOf(path)] = { t: Date.now(), app: app || (o[keyOf(path)] && o[keyOf(path)].app) || null };
    const ks = Object.keys(o); if (ks.length > 80) ks.sort((a, b) => o[a].t - o[b].t).slice(0, ks.length - 80).forEach((k) => delete o[k]);
    save();
  }
  function wrapOpeners() {
    if (window.VFS && VFS.openNode && !VFS.openNode.__pz) {
      const orig = VFS.openNode;
      const w = function (name, node) { try { if (node && node.type === "file" && !node._loading && !node.__fxClone) { const p = pathOf(node); if (p) noteOpen(p, VFS_APP[node.kind] || appForNode(name, node)); } } catch (_) {} return orig.apply(this, arguments); };
      w.__pz = true; Object.keys(orig).forEach((k) => { w[k] = orig[k]; }); VFS.openNode = w;
    }
    if (window.FilesHelper && FilesHelper.launch && !FilesHelper.launch.__pz) {
      const ol = FilesHelper.launch;
      FilesHelper.launch = function (appId, name, node, path) { try { if (node && !node.__fxClone) noteOpen((path || pathOf(node) || []).concat(path ? [name] : []), canon(appId)); } catch (_) {} return ol.apply(this, arguments); };
      FilesHelper.launch.__pz = true;
    }
    if (window.FilesHelper && FilesHelper.openFile && !FilesHelper.openFile.__pz) {
      const of = FilesHelper.openFile;
      FilesHelper.openFile = function (name, node, path) { try { if (node && !node.__fxClone) noteOpen(path ? path.concat(name) : pathOf(node), appForNode(name, node)); } catch (_) {} return of.apply(this, arguments); };
      FilesHelper.openFile.__pz = true;
    }
  }
  // App id → canonical builtin key (Catalog ids and builtin keys both work with WM.open).
  function canon(id) {
    if (!id) return id;
    try { const a = Catalog.storeApps.find((x) => x.id === id) || Catalog.storeApps.find((x) => x.builtin === id); if (a && a.builtin) return a.builtin; } catch (_) {}
    return id;
  }
  const EXT = {
    notepad: /\.(txt|md|log|ini|cfg|csv|json|xml|ya?ml)$/i,
    word: /\.(docx?|rtf|odt)$/i,
    excel: /\.(xlsx?|csv)$/i,
    powerpoint: /\.pptx?$/i,
    photos: /\.(png|jpe?g|gif|webp|bmp|heic|avif|svg)$/i,
    paint: /\.(png|jpe?g|bmp|gif)$/i,
    mediaplayer: /\.(mp3|wav|ogg|m4a|aac|flac|opus|mp4|webm|mov|m4v|mkv)$/i,
    vscode: /\.(js|mjs|ts|tsx|jsx|css|scss|html?|json|py|java|c|h|cpp|cs|go|rb|php|rs|swift|kt|sh|md|sql|lua|vue)$/i,
    codeeditor: /\.(js|ts|css|html?|json|py|c|cpp|cs|md)$/i,
    edge: /\.(pdf|html?|svg)$/i,
    acrobat: /\.pdf$/i,
  };
  // What VFS.openNode itself opens each kind of file in (js/vfs.js): text and Word files open in Word.
  const VFS_APP = { word: "word", text: "word", pptx: "powerpoint", xlsx: "excel", image: "photos" };
  const KIND_APP = { word: "word", xlsx: "excel", pptx: "powerpoint", image: "photos", text: "notepad" };
  function appForNode(name, node) {
    if (node && KIND_APP[node.kind] && (node.kind !== "text" || !/\.(docx?|rtf)$/i.test(name))) return KIND_APP[node.kind];
    for (const k of ["word", "excel", "powerpoint", "notepad", "photos", "mediaplayer", "edge"]) if (EXT[k].test(name)) return k;
    return null;
  }
  // Every real file in the virtual file system with when it was last opened or saved.
  function recentFiles() {
    const o = pz().opens, out = [];
    walkFiles((n, k, p) => {
      if (n.hidden || n.kind === "shortcut") return;
      const path = p.concat(k), key = keyOf(path), op = o[key];
      const t = Math.max(n.atime || 0, n.ts || 0, op ? op.t : 0);
      if (t > 0) out.push({ kind: "file", key, path, name: k, node: n, t, app: op && op.app });
    });
    return out.sort((a, b) => b.t - a.t);
  }
  function fileMatchesApp(f, app) {
    let c = canon(app); if (c === "browser" || c === "chrome") c = "edge";
    if (f.app && canon(f.app) === c) return true;
    if (EXT[c] && EXT[c].test(f.name)) return true;
    return !!(f.node && KIND_APP[f.node.kind] === c && c !== "notepad");
  }
  // ---- newly installed apps ----
  function scanApps() {
    if (!window.WM || !WM.installedApps) return;
    const p = pz(); let list; try { list = WM.installedApps(); } catch (_) { return; }
    if (!p.appsSeen) { p.appsSeen = {}; list.forEach((a) => { p.appsSeen[a.id] = 0; }); save(); return; }
    // Only apps the user installs (State.data.installedApps) count as "recently added"; built-ins that
    // other modules register after start-up are recorded as already seen.
    const user = new Set(S().installedApps || []);
    let ch = false; list.forEach((a) => { if (!(a.id in p.appsSeen)) { p.appsSeen[a.id] = user.has(a.id) ? Date.now() : 0; ch = true; } });
    if (ch) { save(); if (window.WM && WM.refreshStart) WM.refreshStart(); }
  }
  function recommended(limit) {
    const st = pz().start, rm = st.removed || {}, out = [];
    if (st.recentApps && window.WM && WM.installedApps) {
      const seen = pz().appsSeen || {}, cutoff = Date.now() - 14 * 86400000;
      let inst = []; try { inst = WM.installedApps(); } catch (_) {}
      inst.forEach((a) => { const t = seen[a.id]; if (t && t > cutoff && !(rm["app:" + a.id] >= t)) out.push({ kind: "app", key: "app:" + a.id, id: a.id, name: a.name, t, sub: "Recently added" }); });
    }
    if (st.recFiles) recentFiles().forEach((f) => { if (!(rm[f.key] >= f.t)) out.push(f); });
    out.sort((a, b) => (b.kind === "app") - (a.kind === "app") || b.t - a.t);
    return out.slice(0, limit || 6);
  }
  function openFileItem(f, viaApp) {
    const node = nodeAtPath(f.path);
    if (!node) { toast("Can't open this item", "“" + f.name + "” was moved or deleted."); forgetPath(f.key); return; }
    const parent = f.path.slice(0, -1), name = f.path[f.path.length - 1];
    if (node.type === "folder") { if (window.FilesHelper) FilesHelper.open(f.path); return; }
    let app = viaApp && canon(viaApp);
    noteOpen(f.path, app || f.app || appForNode(name, node));
    const LAUNCH = ["notepad", "word", "excel", "powerpoint", "photos", "paint", "mediaplayer", "vscode", "edge"];
    if (app === "browser" || app === "chrome") app = "edge";   // File Explorer opens web files in its Edge viewer
    if (app && LAUNCH.includes(app) && window.FilesHelper && FilesHelper.launch) return FilesHelper.launch(app, name, node, parent);
    if (window.FilesHelper && FilesHelper.openFile) return FilesHelper.openFile(name, node, parent);
    if (window.VFS) VFS.openNode(name, node);
  }
  function forgetPath(key) {
    const p = pz(); delete p.opens[key];
    Object.keys(p.jumpPins).forEach((a) => { p.jumpPins[a] = p.jumpPins[a].filter((x) => x !== key); });
    save();
  }
  function glyph(name, node, size) {
    try { if (window.FilesHelper && FilesHelper.glyph) return FilesHelper.glyph(name, node, size); } catch (_) {}
    return `<span style="font-size:${size * 0.7}px">📄</span>`;
  }
  const ago = (t) => { try { return window.FilesHelper ? FilesHelper.ago(t) : new Date(t).toLocaleString(); } catch (_) { return ""; } };

  // ---- Start ▸ Recommended ----
  const recCount = () => ({ pins: 2, recs: 10 }[pz().start.layout] || 6);
  function recRow(it, sm) {
    const icon = it.kind === "app" ? (window.Icon ? Icon.mini(it.id, it.name) : "") : glyph(it.name, it.node, 34);
    const sub = it.kind === "app" ? it.sub : ago(it.t);
    const r = el(`<button class="sm12-file pz-rec" ${it.kind === "app" ? `data-app="${esc(it.id)}"` : ""} data-key="${esc(it.key)}" title="${esc(it.kind === "file" ? (window.FilesHelper && FilesHelper.winPath ? FilesHelper.winPath(it.path) : it.key) : it.name)}"><span class="sm12-file-ic">${icon}</span><span class="sm12-file-tx"><b>${esc(it.name)}</b><span>${esc(sub)}</span></span></button>`);
    const close = () => sm.classList.remove("open");
    r.onclick = () => { close(); if (it.kind === "app") WM.open(it.id); else openFileItem(it); };
    r.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); recMenu(it, e, sm); };
    return r;
  }
  function recMenu(it, e, sm) {
    document.querySelectorAll(".start-ctx").forEach((m) => m.remove());
    const menu = el(`<div class="start-ctx pz-rec-ctx"><div class="jl-head">${esc(it.name)}</div></div>`);
    const add = (label, fn) => { const b = el(`<button type="button">${label}</button>`); b.onclick = () => { menu.remove(); fn(); }; menu.appendChild(b); };
    add("Open", () => { sm.classList.remove("open"); if (it.kind === "app") WM.open(it.id); else openFileItem(it); });
    if (it.kind === "file") add("Open file location", () => { sm.classList.remove("open"); if (window.FilesHelper) FilesHelper.open(it.path.slice(0, -1)); });
    if (it.kind === "app") add(WM.taskbarPins().includes(it.id) ? "Unpin from taskbar" : "Pin to taskbar", () => { WM.taskbarPins().includes(it.id) ? WM.unpinFromTaskbar(it.id) : WM.pinToTaskbar(it.id); });
    add("Remove from list", () => { pz().start.removed[it.key] = Date.now(); save(); renderRecommended(sm); const more = sm.querySelector(".pz-rec-more"); if (more) showMoreRecommended(sm); });
    scr().appendChild(menu);
    menu.style.left = Math.min(e.clientX, innerWidth - menu.offsetWidth - 8) + "px";
    menu.style.top = Math.min(e.clientY, innerHeight - menu.offsetHeight - 8) + "px";
    setTimeout(() => document.addEventListener("mousedown", function h(ev) { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener("mousedown", h); } }), 0);
    setTimeout(() => document.addEventListener("touchstart", function h(ev) { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener("touchstart", h); } }, { passive: true }), 0);
  }
  function renderRecommended(sm) {
    const card = sm.querySelector(".sm12-sugg"), box = sm.querySelector(".sm12-files"); if (!card || !box) return;
    const st = pz().start;
    card.classList.add("pz-rec-card");
    card.style.display = !st.recentApps && !st.recFiles ? "none" : "";
    sm.classList.toggle("pz-lay-pins", st.layout === "pins"); sm.classList.toggle("pz-lay-recs", st.layout === "recs");
    const head = card.querySelector(".sm12-head b"); if (head) head.textContent = "Recommended";
    box.innerHTML = "";
    const items = recommended(recCount());
    if (!items.length) box.appendChild(el(`<div class="sm12-empty">${st.recFiles ? "The more you use your device, the more we'll show your new apps and recently opened files here." : "Recommended files are off. Turn them on in Settings › Personalization › Start."}</div>`));
    items.forEach((it) => box.appendChild(recRow(it, sm)));
  }
  function showMoreRecommended(sm) {
    const right = sm.querySelector(".sm12-right") || sm;
    right.querySelectorAll(".pz-rec-more").forEach((x) => x.remove());
    const pane = el(`<div class="pz-rec-more"><div class="sm12-head"><b>Recommended</b><button type="button" class="sm12-pill pz-rec-back"><span>‹</span> Back</button></div><div class="sm12-files pz-rec-all"></div></div>`);
    const list = pane.querySelector(".pz-rec-all"), items = recommended(40);
    if (!items.length) list.appendChild(el(`<div class="sm12-empty">Nothing here yet. Files you open and apps you install will show up here.</div>`));
    items.forEach((it) => list.appendChild(recRow(it, sm)));
    pane.querySelector(".pz-rec-back").onclick = (e) => { e.stopPropagation(); pane.remove(); };
    right.appendChild(pane);
  }
  // Start closes → drop the "More" pane.
  setInterval(() => { const sm = document.querySelector(".start-menu"); if (sm && !sm.classList.contains("open")) sm.querySelectorAll(".pz-rec-more").forEach((x) => x.remove()); }, 800);

  // ---- Jump Lists (taskbar right-click / long-press, Start right-click) ----
  const PIN_SVG = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M9 4h6l-1 6 4 4H6l4-4z"/><path d="M12 14v6" stroke-linecap="round"/></svg>`;
  function jumpData(appId) {
    const c = canon(appId), p = pz(), pins = (p.jumpPins[c] || []);
    const files = recentFiles(), byKey = new Map(files.map((f) => [f.key, f]));
    const pinned = pins.map((k) => byKey.get(k) || (nodeAtPath(k.split("/")) ? { kind: "file", key: k, path: k.split("/"), name: k.split("/").pop(), node: nodeAtPath(k.split("/")), t: 0 } : null)).filter(Boolean);
    let recent = [], label = "Recent";
    if (p.start.recFiles) {
      if (c === "fileexplorer") {
        label = "Frequent"; const seen = new Set();
        files.forEach((f) => { const fp = f.path.slice(0, -1); const k = keyOf(fp); if (fp.length && !seen.has(k) && !pins.includes(k)) { seen.add(k); recent.push({ kind: "folder", key: k, path: fp, name: fp[fp.length - 1], t: f.t }); } });
      } else recent = files.filter((f) => fileMatchesApp(f, c) && !pins.includes(f.key));
      recent = recent.slice(0, 8);
    }
    return { c, pinned, recent, label };
  }
  function jumpListSection(container, appId, close) {
    if (!appId) return false;
    const sec = el(`<div class="pz-jl-sec"></div>`);
    function paint() {
      const d = jumpData(appId); sec.innerHTML = "";
      const row = (f, isPinned) => {
        const ic = f.kind === "folder" ? `<img src="assets/folder.png?v=7" alt="" width="18" height="18">` : glyph(f.name, f.node, 18);
        const r = el(`<div class="pz-jl-row"><button type="button" class="pz-jl-open" title="${esc(f.path.join(" › "))}"><span class="pz-jl-ic">${ic}</span><span class="pz-jl-name">${esc(f.name)}</span></button><button type="button" class="pz-jl-pin ${isPinned ? "on" : ""}" title="${isPinned ? "Unpin from this list" : "Pin to this list"}" aria-label="${isPinned ? "Unpin" : "Pin"} ${esc(f.name)}">${PIN_SVG}</button></div>`);
        r.querySelector(".pz-jl-open").onclick = (e) => { e.stopPropagation(); if (close) close(); if (f.kind === "folder") { if (window.FilesHelper) FilesHelper.open(f.path); } else openFileItem(f, d.c); };
        r.querySelector(".pz-jl-pin").onclick = (e) => {
          e.stopPropagation();
          const pins = pz().jumpPins[d.c] || (pz().jumpPins[d.c] = []);
          const i = pins.indexOf(f.key); if (i >= 0) pins.splice(i, 1); else pins.unshift(f.key);
          save(); paint();
        };
        return r;
      };
      if (d.pinned.length) { sec.appendChild(el(`<div class="jl-head">Pinned</div>`)); d.pinned.forEach((f) => sec.appendChild(row(f, true))); }
      if (d.recent.length) { sec.appendChild(el(`<div class="jl-head">${d.label}</div>`)); d.recent.forEach((f) => sec.appendChild(row(f, false))); }
      return d.pinned.length + d.recent.length;
    }
    const n = paint();
    if (!n) return false;
    const head = container.querySelector(":scope > .jl-head");
    if (container.classList.contains("start-ctx")) { container.appendChild(el(`<div class="jl-sep"></div>`)); container.appendChild(sec); }
    else if (head) container.insertBefore(sec, head); else container.appendChild(sec);
    return true;
  }

  // ===================================================================
  //  Taskbar: badges, progress, overflow, combine "when full"
  // ===================================================================
  const progress = {};   // canon app id → { v, state }
  function setProgress(appId, v, state) {
    const c = canon(appId); if (!c) return;
    if (v == null || v === false) delete progress[c];
    else { progress[c] = { v: Math.max(0, Math.min(1, +v || 0)), state: state || "normal" }; if (progress[c].v >= 1) setTimeout(() => { if (progress[c] && progress[c].v >= 1) { delete progress[c]; paintBadges(); } }, 1500); }
    paintBadges();
  }
  function appFromName(name) { try { const a = Catalog.storeApps.find((x) => x.name.toLowerCase() === String(name || "").toLowerCase()); return a ? (a.builtin || a.id) : null; } catch (_) { return null; } }
  function wrapNotify() {
    if (!window.Notify || typeof Notify.show !== "function" || Notify.show.__pz) return;
    const orig = Notify.show;
    const w = function (o) {
      try { if (o && o.progress != null) setProgress(o.appId || appFromName(o.app) || o.app, o.progress, o.progressState); } catch (_) {}
      return orig.apply(this, arguments);
    };
    w.__pz = true; if (orig.__sh2) w.__sh2 = true;
    Notify.show = w;
    if (!Notify.progress) Notify.progress = (appId, v, state) => setProgress(appId, v, state);
  }
  function aliases(appId) {
    const set = new Set(); if (!appId) return set;
    const add = (x) => { if (x) set.add(String(x).toLowerCase()); };
    add(appId); add(canon(appId));
    try { Catalog.storeApps.filter((x) => x.id === appId || x.builtin === appId || x.builtin === canon(appId)).forEach((a) => { add(a.id); add(a.builtin); add(a.name); }); } catch (_) {}
    try { add(WM.appName(appId)); } catch (_) {}
    if (appId === "store__") { add("store"); add("microsoft store"); }
    return set;
  }
  function unreadItems(appId) {
    if (!window.NotifCenter || !NotifCenter.items) return [];
    const al = aliases(appId);
    return NotifCenter.items().filter((x) => x.unread && (al.has(String(x.appKey || "").toLowerCase()) || al.has(String(x.app || "").toLowerCase())));
  }
  function markRead(appId) {
    const ids = new Set(unreadItems(appId).map((x) => x.id)); if (!ids.size) return;
    const nc = S().appData && S().appData.notifCenter; if (!nc || !nc.items) return;
    nc.items.forEach((x) => { if (ids.has(x.id)) x.unread = false; }); save(); paintBadges();
  }
  function appBtns(tb) { return [...tb.querySelectorAll(".tb-apps > .tb-btn")].filter((b) => !b.classList.contains("start") && !b.classList.contains("wx-tv-btn") && !b.classList.contains("pz-ovf-btn")); }
  function btnApp(b) { try { const i = WM.taskBtnApp(b); return i && i.appId; } catch (_) { return null; } }
  function badgeFor(b) {
    const id = btnApp(b); if (!id) return { n: 0, p: null };
    return { n: pz().badges ? unreadItems(id).length : 0, p: pz().badges ? progress[canon(id)] || null : null };
  }
  function paintOne(b, info) {
    let bd = b.querySelector(":scope > .pz-badge"), pr = b.querySelector(":scope > .pz-prog");
    if (info.n) { if (!bd) { bd = el(`<span class="pz-badge" aria-hidden="true"></span>`); b.appendChild(bd); } const t = info.n > 99 ? "99+" : String(info.n); if (bd.textContent !== t) bd.textContent = t; }
    else if (bd) bd.remove();
    if (info.p) { if (!pr) { pr = el(`<span class="pz-prog" aria-hidden="true"><i></i></span>`); b.appendChild(pr); } pr.className = "pz-prog pz-prog-" + info.p.state; pr.firstChild.style.width = Math.round(info.p.v * 100) + "%"; }
    else if (pr) pr.remove();
    const base = (b.__pzTitle != null ? b.__pzTitle : (b.__pzTitle = b.title || ""));
    const extra = (info.n ? info.n + " new notification" + (info.n === 1 ? "" : "s") : "") + (info.p ? (info.n ? ", " : "") + Math.round(info.p.v * 100) + "% done" : "");
    b.setAttribute("aria-label", base + (extra ? " — " + extra : ""));
  }
  function paintBadges() {
    const tb = window.WM && WM.taskbarEl && WM.taskbarEl(); if (!tb) return;
    let any = false;
    appBtns(tb).forEach((b) => { const info = badgeFor(b); paintOne(b, info); if (b.classList.contains("pz-ovf-hide") && (info.n || info.p)) any = true; });
    const ov = tb.querySelector(".pz-ovf-btn"); if (ov) ov.classList.toggle("pz-has-badge", any);
    const fly = document.querySelector(".pz-ovf-fly"); if (fly) fly.querySelectorAll(".pz-ovf-item").forEach((it) => { const b = it.__btn; if (b) paintOne(it, badgeFor(b)); });
  }

  // ---- overflow ("…" flyout) ----
  const OVF_SVG = `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><circle cx="6" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="18" cy="12" r="1.8"/></svg>`;
  let layingOut = false;
  function layoutOverflow() {
    const tb = window.WM && WM.taskbarEl && WM.taskbarEl(); if (!tb || !tb.isConnected || layingOut) return;
    const apps = tb.querySelector(".tb-apps"), dock = tb.querySelector(".tb-dock"); if (!apps || !dock) return;
    layingOut = true;
    try {
      const btns = appBtns(tb);
      btns.forEach((b) => b.classList.remove("pz-ovf-hide"));
      tb.classList.remove("pz-tb-tight");
      let ov = apps.querySelector(":scope > .pz-ovf-btn");
      if (!dock.offsetParent) { if (ov) ov.remove(); return; }   // kiosk / hidden taskbar
      const W = innerWidth, cs = getComputedStyle(apps), gap = parseFloat(cs.columnGap || cs.gap) || 4;
      const wb = tb.querySelector(".tb-widgets"), tray = tb.querySelector(".tb-tray"), cop = tb.querySelector(".tb-copilot");
      const leftLim = wb && wb.offsetParent ? wb.getBoundingClientRect().right + 10 : 8;
      const rightLim = tray && tray.offsetParent ? tray.getBoundingClientRect().left - 10 : W - 8;
      const classic = tb.classList.contains("tb-classic");
      const widths = btns.map((b) => b.offsetWidth + gap);
      const need = widths.reduce((s, x) => s + x, 0);
      const measure = (centered) => {
        const copW = cop && cop.offsetParent ? cop.offsetWidth + 12 : 0;
        const groupMax = centered ? 2 * Math.min(W / 2 - leftLim, rightLim - W / 2) : rightLim - leftLim;
        const used = need + (ov ? ov.offsetWidth + gap : 0);
        return groupMax - copW - (dock.offsetWidth - used);
      };
      let avail = measure(!classic);
      // Not enough room centered (narrow screens, a busy tray): move the dock next to Widgets and
      // show Search as an icon, like Windows does on small screens.
      if (!classic && need > avail) {
        tb.style.setProperty("--pz-tight-left", Math.round(leftLim) + "px");
        tb.classList.add("pz-tb-tight");
        avail = measure(false);
      }
      // "Combine when taskbar is full": combine first, before hiding anything.
      try {
        if (WM.combineMode && WM.combineMode() === "full") {
          if (!WM.combining() && need > avail) { WM.setCombineFull(true); layingOut = false; return layoutOverflow(); }
          if (WM.combining()) {
            const wins = WM.windows().length, est = need + wins * 120;
            if (est < avail - 40) { WM.setCombineFull(false); layingOut = false; return layoutOverflow(); }
          }
        }
      } catch (_) {}
      if (need <= avail || !btns.length) { if (ov) ov.remove(); closeOvf(); return; }
      const ovW = 44;
      let room = avail - ovW, keep = [];
      for (let i = 0; i < btns.length; i++) { if (room - widths[i] < 0) break; room -= widths[i]; keep.push(i); }
      // Keep the focused window's button on the taskbar (swap it with the last visible one).
      let act = -1;
      try { const top = WM.windows().filter((e) => e.win.style.display !== "none" && e.taskBtn).sort((a, b) => (+b.win.style.zIndex || 0) - (+a.win.style.zIndex || 0))[0]; if (top) act = btns.indexOf(top.taskBtn); } catch (_) {}
      if (act >= 0 && !keep.includes(act) && keep.length) keep[keep.length - 1] = act;
      btns.forEach((b, i) => b.classList.toggle("pz-ovf-hide", !keep.includes(i)));
      if (!ov) {
        ov = el(`<div class="tb-btn pz-ovf-btn" role="button" tabindex="0" title="Show more apps" aria-label="Show more apps" aria-haspopup="true">${OVF_SVG}</div>`);
        ov.onclick = (e) => { e.stopPropagation(); toggleOvf(ov); };
        ov.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleOvf(ov); } };
      }
      if (apps.lastElementChild !== ov) apps.appendChild(ov);
      const fly = document.querySelector(".pz-ovf-fly"); if (fly) fillOvf(fly);
    } finally { layingOut = false; }
  }
  function closeOvf() { document.querySelectorAll(".pz-ovf-fly").forEach((x) => x.remove()); }
  function fillOvf(fly) {
    const tb = WM.taskbarEl(); const hidden = appBtns(tb).filter((b) => b.classList.contains("pz-ovf-hide"));
    fly.innerHTML = "";
    if (!hidden.length) { closeOvf(); return; }
    hidden.forEach((b) => {
      const ic = (b.querySelector(":scope > .pz-tb-ic") || b).cloneNode(true);
      ic.querySelectorAll(".pz-badge,.pz-prog,.pz-tb-lbl").forEach((x) => x.remove());
      const it = el(`<button type="button" class="pz-ovf-item ${b.classList.contains("active") ? "active" : ""}" title="${esc(b.title || b.__pzTitle || "")}"></button>`);
      it.innerHTML = ic.innerHTML; it.__btn = b;
      it.onclick = (e) => { e.stopPropagation(); closeOvf(); if (WM.taskButtonClick) WM.taskButtonClick(b); else b.click(); setTimeout(queueLayout, 50); };
      it.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); closeOvf(); WM.showTaskbarMenu(b); };
      let lp = null;
      it.addEventListener("touchstart", () => { lp = setTimeout(() => { lp = "fired"; closeOvf(); WM.showTaskbarMenu(b); }, 550); }, { passive: true });
      it.addEventListener("touchend", (e) => { if (lp === "fired") e.preventDefault(); else clearTimeout(lp); lp = null; });
      it.addEventListener("touchmove", () => { if (lp && lp !== "fired") clearTimeout(lp); lp = null; }, { passive: true });
      fly.appendChild(it); paintOne(it, badgeFor(b));
    });
  }
  function toggleOvf(ov) {
    if (document.querySelector(".pz-ovf-fly")) { closeOvf(); return; }
    document.querySelectorAll(".jumplist,.tb-layoutmenu").forEach((m) => m.remove());
    const fly = el(`<div class="pz-ovf-fly" role="menu" aria-label="More apps"></div>`);
    scr().appendChild(fly); fillOvf(fly);
    const r = ov.getBoundingClientRect();
    fly.style.left = Math.max(8, Math.min(r.left + r.width / 2 - fly.offsetWidth / 2, innerWidth - fly.offsetWidth - 8)) + "px";
    fly.style.bottom = (innerHeight - r.top + 8) + "px";
    setTimeout(() => document.addEventListener("pointerdown", function h(ev) { if (!fly.contains(ev.target) && !ev.target.closest(".pz-ovf-btn")) { closeOvf(); document.removeEventListener("pointerdown", h, true); } }, true), 0);
  }
  let tbObs = null, tbObsFor = null, layoutQueued = false;
  function queueLayout() { if (layoutQueued) return; layoutQueued = true; requestAnimationFrame(() => { layoutQueued = false; layoutOverflow(); paintBadges(); }); }
  function hookTaskbar() {
    const tb = window.WM && WM.taskbarEl && WM.taskbarEl(); if (!tb) return;
    const apps = tb.querySelector(".tb-apps");
    if (apps && tbObsFor !== apps) {
      if (tbObs) tbObs.disconnect();
      tbObs = new MutationObserver(queueLayout); tbObs.observe(apps, { childList: true }); tbObsFor = apps;
      const tray = tb.querySelector(".tb-tray"); if (tray) tbObs.observe(tray, { childList: true });
      // Opening an app from its badged button counts as reading its notifications.
      tb.addEventListener("click", (e) => { const b = e.target.closest(".tb-apps > .tb-btn"); if (b && b.querySelector(":scope > .pz-badge")) { const id = btnApp(b); if (id) setTimeout(() => markRead(id), 0); } });
      queueLayout();
    }
  }
  window.addEventListener("resize", queueLayout);

  // ===================================================================
  //  Drag from Start to the taskbar (mouse + touch long-press)
  // ===================================================================
  let drag = null, swallowClickUntil = 0;
  function dragTarget(t) { const x = t && t.closest && t.closest(".start-menu [data-app]"); return x && !x.closest(".pz-rec-more .sm12-empty") ? x : null; }
  function beginDrag(src, x, y) {
    const ic = src.querySelector(".sm12-tile-ic, .sm12-app-ic, .sm12-file-ic");
    const g = el(`<div class="dicon-ghost pz-start-ghost"></div>`); g.innerHTML = ic ? ic.innerHTML : ""; scr().appendChild(g);
    drag.on = true; drag.ghost = g;
    const sm = src.closest(".start-menu"); if (sm) sm.classList.add("pz-start-dragging");
    moveDrag(x, y);
  }
  function moveDrag(x, y) { if (!drag || !drag.on) return; drag.ghost.style.left = x + "px"; drag.ghost.style.top = y + "px"; WM.taskbarDrop.over(x, y, drag.id); }
  function endDrag(x, y, cancel) {
    const d = drag; drag = null; if (!d) return false;
    clearTimeout(d.timer); d.src.classList.remove("pz-armed");
    if (!d.on) return false;
    d.ghost.remove();
    const sm = d.src.closest(".start-menu"); if (sm) sm.classList.remove("pz-start-dragging");
    const ok = !cancel && WM.taskbarDrop.drop(x, y, d.id);
    if (!ok) WM.taskbarDrop.cancel();
    if (ok && sm) sm.classList.remove("open");
    swallowClickUntil = Date.now() + 450;
    return true;
  }
  document.addEventListener("mousedown", (e) => {
    if (e.button) return; const src = dragTarget(e.target); if (!src) return;
    drag = { src, id: src.dataset.app, x: e.clientX, y: e.clientY, on: false, touch: false };
  }, true);
  document.addEventListener("mousemove", (e) => {
    if (!drag || drag.touch) return;
    if (!drag.on) { if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 8) return; beginDrag(drag.src, e.clientX, e.clientY); }
    e.preventDefault(); moveDrag(e.clientX, e.clientY);
  }, true);
  document.addEventListener("mouseup", (e) => { if (drag && !drag.touch) endDrag(e.clientX, e.clientY); }, true);
  // Start tiles are <img> icons: the browser's own image drag would swallow the mouse moves.
  document.addEventListener("dragstart", (e) => { if (e.target.closest && e.target.closest(".start-menu [data-app], .start-menu .pz-rec")) e.preventDefault(); }, true);
  // Touch: press and hold (~0.4 s) to pick the app up, then drag. Hold and release = the app's menu.
  document.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) { if (drag) endDrag(0, 0, true); return; }
    const src = e.target.closest && (dragTarget(e.target) || e.target.closest(".start-menu .pz-rec")); if (!src) return;
    const t = e.touches[0];
    drag = { src, id: src.dataset.app || null, x: t.clientX, y: t.clientY, on: false, touch: true, armed: false };
    drag.timer = setTimeout(() => { if (drag && drag.src === src) { drag.armed = true; src.classList.add("pz-armed"); } }, 400);
  }, { capture: true, passive: true });
  document.addEventListener("touchmove", (e) => {
    if (!drag || !drag.touch) return;
    const t = e.touches[0], dist = Math.hypot(t.clientX - drag.x, t.clientY - drag.y);
    if (!drag.armed) { if (dist > 10) { clearTimeout(drag.timer); drag = null; } return; }   // a scroll
    if (!drag.id) return;
    if (e.cancelable) e.preventDefault();
    if (!drag.on) { if (dist < 8) return; beginDrag(drag.src, t.clientX, t.clientY); }
    moveDrag(t.clientX, t.clientY);
  }, { capture: true, passive: false });
  document.addEventListener("touchend", (e) => {
    if (!drag || !drag.touch) return;
    const t = e.changedTouches[0], d = drag;
    if (d.on) { if (e.cancelable) e.preventDefault(); endDrag(t.clientX, t.clientY); return; }
    clearTimeout(d.timer); d.src.classList.remove("pz-armed"); drag = null;
    if (d.armed) {   // long-press without moving → the item's menu
      if (e.cancelable) e.preventDefault();
      swallowClickUntil = Date.now() + 450;
      d.src.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: t.clientX, clientY: t.clientY }));
    }
  }, { capture: true, passive: false });
  document.addEventListener("touchcancel", () => { if (drag) endDrag(0, 0, true); }, { capture: true, passive: true });
  document.addEventListener("click", (e) => { if (Date.now() < swallowClickUntil && e.target.closest && e.target.closest(".start-menu, .taskbar")) { swallowClickUntil = 0; e.preventDefault(); e.stopPropagation(); } }, true);

  // Quick Settings: right-click / long-press the Night light tile → Display settings.
  function openDisplaySettings() { document.querySelectorAll("#qsPanel").forEach((p) => p.remove()); window.SettingsStartPage = "display"; WM.open("settings"); }
  document.addEventListener("contextmenu", (e) => { const t = e.target.closest && e.target.closest(".qs-tile"); const l = t && t.querySelector(".qs-tile-lbl"); if (l && l.textContent === "Night light") { e.preventDefault(); openDisplaySettings(); } }, true);

  // ===================================================================
  //  Settings pages (injected into js/settings12.js windows)
  // ===================================================================
  const TXT = { personal: ["Personalization", "Anpassning"], background: ["Background", "Bakgrund"], themes: ["Themes", "Teman"], colors: ["Colors", "Färger"], display: ["Display", "Skärm"], night: ["Night light", "Nattljus"], icons: ["Personalize icons", "Anpassa ikoner"] };
  const SVGI = (d) => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const ICONS = {
    start: SVGI('<rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/>'),
    taskbar: SVGI('<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 15.5h19M8 17.3h1.5M11.3 17.3h1.5M14.6 17.3h1.5"/>'),
    image: SVGI('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>'),
    palette: SVGI('<path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.6-.9 1.2-1.8-.5-1 .1-2.2 1.3-2.2H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>'),
    cursor: SVGI('<path d="M6 3l12 9.5-5.4.7 3.1 6.3-2.4 1.2-3.1-6.4L6 18z"/>'),
    sound: SVGI('<path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/>'),
    moon: SVGI('<path d="M20 14A8 8 0 0 1 10 4a7 7 0 1 0 10 10Z"/>'),
    hdr: SVGI('<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 9.5v5M9 9.5v5M6 12h3M12 9.5v5h1.5a2.5 2.5 0 0 0 0-5zM17 14.5v-5h1.6a1.6 1.6 0 0 1 0 3.2H17M18.6 12.7l1.4 1.8"/>'),
    clock: SVGI('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    pin: SVGI('<path d="M9 4h6l-1 6 4 4H6l4-4z"/><path d="M12 14v6"/>'),
    contrast: SVGI('<circle cx="12" cy="12" r="9"/><path d="M12 3v18a9 9 0 0 0 0-18z" fill="currentColor"/>'),
  };
  const CHEV = `<span class="w12s-chev"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 6l6 6-6 6"/></svg></span>`;
  function row(ic, t, s, opts) {
    opts = opts || {}; const click = !!opts.onClick;
    const r = el(`<div class="w12s-row ${click ? "w12s-click" : "w12s-row-static"} pz-row" tabindex="${click ? 0 : -1}"><span class="w12s-row-ic">${ICONS[ic] || ic || ""}</span><div class="w12s-row-txt"><div class="w12s-row-t"></div><div class="w12s-row-s"></div></div><div class="w12s-row-ctl"></div>${click ? CHEV : ""}</div>`);
    r.querySelector(".w12s-row-t").textContent = t; r.querySelector(".w12s-row-s").textContent = s || "";
    if (opts.ctl) r.querySelector(".w12s-row-ctl").appendChild(opts.ctl);
    if (click) { r.onclick = opts.onClick; r.addEventListener("keydown", (e) => { if (e.key === "Enter") opts.onClick(); }); }
    return r;
  }
  function toggle(on, onChange, label) {
    const t = el(`<label class="w12s-sw"><input type="checkbox" ${on ? "checked" : ""} aria-label="${esc(label || "")}"><span></span></label>`);
    t.addEventListener("click", (e) => e.stopPropagation());
    t.querySelector("input").onchange = (e) => onChange(e.target.checked);
    return t;
  }
  function select(pairs, val, onChange, label) {
    const s = el(`<select class="w12s-select" aria-label="${esc(label || "")}">${pairs.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(val) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`);
    s.addEventListener("click", (e) => e.stopPropagation()); s.onchange = () => onChange(s.value); return s;
  }
  function btn(label, fn, accent) { const b = el(`<button type="button" class="w12s-btn ${accent ? "w12s-btn-accent" : ""}">${esc(label)}</button>`); b.onclick = (e) => { e.stopPropagation(); fn(e); }; return b; }
  const card = (cls) => el(`<div class="w12s-card pz-card ${cls || ""}"></div>`);
  function navTo(page, id) { const root = page.closest(".w12s"); const a = root && root.querySelector(`.w12s-nav-it[data-p="${id}"]`); if (a) a.click(); }
  function clickRow(page, section, titles) {
    navTo(page, section);
    const r = [...page.querySelectorAll(".w12s-row")].find((x) => { const t = x.querySelector(".w12s-row-t"); return t && titles.includes(t.textContent.trim()); });
    if (r) { r.click(); r.scrollIntoView({ block: "center" }); }
  }
  function renderPage(page, key) {
    const sp = PAGES[key], root = page.closest(".w12s"); if (!sp || !root) return;
    root.querySelectorAll(".w12s-nav-it").forEach((a) => a.classList.toggle("on", a.dataset.p === sp.parent));
    const parentA = root.querySelector(`.w12s-nav-it[data-p="${sp.parent}"]`);
    page.innerHTML = ""; page.scrollTop = 0;
    const head = el(`<h1 class="w12s-title"><a class="w12s-crumb"></a><span class="w12s-crumb-sep">›</span><span class="pz-ttl"></span></h1>`);
    const pName = parentA && (parentA.lastElementChild || parentA);
    head.querySelector(".w12s-crumb").textContent = pName ? pName.textContent.trim() : "Settings";
    head.querySelector(".pz-ttl").textContent = sp.title;
    head.querySelector(".w12s-crumb").onclick = () => navTo(page, sp.parent);
    page.appendChild(head);
    const box = el(`<div class="w12s-list" data-pz-page="${key}"></div>`); page.appendChild(box);
    sp.build(box, () => renderPage(page, key), page);
  }

  // ---- shared preview (mini desktop) ----
  function previewEl(cls) {
    const p = el(`<div class="pz-preview ${cls || ""}" aria-hidden="true"><div class="pz-pv-win"><div class="pz-pv-tb"></div><div class="pz-pv-body"><i></i><i></i><i></i></div></div><div class="pz-pv-bar"><span></span><span></span><span></span><span></span></div></div>`);
    const paint = () => {
      const css = wallpaperCss() || (S().desktop.wallpaper || "#0067c0");
      p.style.background = /url\(/.test(css) ? css.replace(/assets\/pz\/([\w-]+)\.jpg/, "assets/pz/$1_t.jpg") : css;
      p.classList.toggle("pz-pv-dark", resolvedMode() === "dark");
      p.querySelector(".pz-pv-tb").style.background = S().accent || "#0067c0";
    };
    paint(); p.repaint = paint; return p;
  }

  // ---- Background ----
  const FITS = [["fill", "Fill"], ["fit", "Fit"], ["stretch", "Stretch"], ["tile", "Tile"], ["center", "Center"], ["span", "Span"]];
  const INTERVALS = [[1, "1 minute"], [10, "10 minutes"], [30, "30 minutes"], [60, "1 hour"], [360, "6 hours"], [1440, "1 day"]];
  const SOLIDS = ["#0067c0", "#7b5cff", "#e53935", "#43a047", "#fb8c00", "#00897b", "#222222", "#111827", "#5a189a", "#b5179e", "#006466", "#8e8cd8", "#ffb900", "#ffffff"];
  function imageFolders() {
    const out = []; const r = vroot(); if (!r) return out;
    (function rec(kids, p) { Object.keys(kids).forEach((k) => { const n = kids[k]; if (!n || n.type !== "folder" || k === "Local Disk (C:)" || n.hidden || p.length > 2) return; const path = p.concat(k); const c = folderImages(path).length; if (c) out.push({ path, count: c }); if (n.children) rec(n.children, path); }); })(r, []);
    return out;
  }
  function buildBackground(h, redraw) {
    const b = pz().bg, wp = S().desktop.wallpaper || "default";
    const pv = previewEl("pz-preview-lg"); const top = card("pz-bg-top"); top.appendChild(pv); h.appendChild(top);
    const modeSel = select([["picture", "Picture"], ["solid", "Solid color"], ["slideshow", "Slideshow"], ["spotlight", "Windows spotlight"], ["dynamic", "Time of day (dynamic)"]], b.mode, (v) => {
      if (v === "picture") setBg({ mode: "picture", wallpaper: isImg(wp) ? wp : "default" });
      else if (v === "solid") setBg({ mode: "solid", wallpaper: isImg(wp) ? "#0067c0" : wp });
      else if (v === "slideshow") setBg({ mode: "slideshow", source: b.slideshow.source || "pack", images: b.slideshow.images && b.slideshow.images.length ? null : PACKS[2].bg.images });
      else setBg({ mode: v });
      redraw();
    }, "Personalize your background");
    h.appendChild(row("image", "Personalize your background", b.mode === "spotlight" ? "A different picture every day, made on and bundled with this PC" : b.mode === "dynamic" ? "Changes with the time of day" : "A picture background applies to your current desktop", { ctl: modeSel }));
    const c = card();
    if (b.mode === "picture") {
      c.appendChild(el(`<div class="w12s-row-t">Recent images</div>`));
      const grid = el(`<div class="pz-walls"></div>`);
      const pics = []; (b.recent || []).concat(["default", "assets/wall4.jpg", "assets/wall5.jpg", "assets/wall6.jpg", "assets/wall2.jpg", P("flow1"), P("glow1"), P("spot_alpine")]).forEach((x) => { if (!pics.includes(x) && isImg(x)) pics.push(x); });
      pics.slice(0, 10).forEach((x) => { const s = el(`<button type="button" class="pz-wall ${wpUrl(x) === wpUrl(wp) ? "sel" : ""}" aria-label="Use this picture"></button>`); s.style.backgroundImage = `url("${thumbOf(wpUrl(x))}")`; s.onclick = () => { setBg({ mode: "picture", wallpaper: x }); redraw(); }; grid.appendChild(s); });
      c.appendChild(grid); h.appendChild(c);
      const up = btn("Browse photos", () => {
        const inp = document.getElementById("globalFileInput") || Object.assign(document.createElement("input"), { type: "file" });
        inp.accept = "image/*"; inp.value = "";
        inp.onchange = () => { const fl = inp.files[0]; if (!fl) return; const r = new FileReader(); r.onload = () => { setBg({ mode: "picture", wallpaper: r.result }); redraw(); }; r.readAsDataURL(fl); };
        inp.click();
      });
      h.appendChild(row("image", "Choose a photo", "From this device", { ctl: up }));
      h.appendChild(row("image", "Choose a fit for your desktop image", "", { ctl: select(FITS, b.fit || "fill", (v) => { b.fit = v; save(); applyWp(); pv.repaint(); }, "Fit") }));
    } else if (b.mode === "solid") {
      c.appendChild(el(`<div class="w12s-row-t">Choose your background color</div>`));
      const grid = el(`<div class="pz-walls pz-solids"></div>`);
      SOLIDS.forEach((col) => { const s = el(`<button type="button" class="pz-wall pz-solid ${String(wp).toLowerCase() === col ? "sel" : ""}" style="background:${col}" aria-label="Color ${col}"></button>`); s.onclick = () => { setBg({ mode: "solid", wallpaper: col }); redraw(); }; grid.appendChild(s); });
      c.appendChild(grid);
      if (window.SettingsParts && SettingsParts.makeColorPicker) { const pk = SettingsParts.makeColorPicker(/^#[0-9a-f]{6}$/i.test(wp) ? wp : "#0067c0", (hx) => { S().desktop.wallpaper = hx; pz().bg.wpMark = hx; save(); applyWp(); pv.repaint(); }); const cc = el(`<div class="pz-custom-color"><span class="w12s-row-s">Custom color</span></div>`); cc.appendChild(pk.el); c.appendChild(cc); }
      h.appendChild(c);
    } else if (b.mode === "slideshow") {
      const ss = b.slideshow, folders = imageFolders();
      const opts = [["pack", "Theme pictures (" + (ss.images || []).length + ")"]].concat(folders.map((f) => ["f:" + f.path.join("/"), f.path.join(" › ") + " (" + f.count + ")"]));
      const cur = ss.source === "folder" ? "f:" + (ss.folder || []).join("/") : "pack";
      if (ss.source === "folder" && !opts.some((o) => o[0] === cur)) opts.push([cur, (ss.folder || []).join(" › ") + " (no pictures)"]);
      h.appendChild(row("image", "Choose a picture album for a slideshow", "Pictures in File Explorer folders (and their subfolders) or the current theme's pictures", { ctl: select(opts, cur, (v) => { if (v === "pack") setBg({ mode: "slideshow", source: "pack" }); else setBg({ mode: "slideshow", source: "folder", folder: v.slice(2).split("/") }); redraw(); }, "Picture album") }));
      const list = slideList();
      const strip = el(`<div class="pz-walls pz-strip"></div>`);
      list.slice(0, 12).forEach((x, i) => { const u = x.url(); const s = el(`<button type="button" class="pz-wall ${i === ss.idx ? "sel" : ""}" aria-label="Show picture ${i + 1}"></button>`); if (u) s.style.backgroundImage = `url("${thumbOf(u)}")`; s.onclick = () => { ss.idx = i; ss.last = Date.now(); save(); applyWp(); redraw(); }; strip.appendChild(s); });
      if (!list.length) strip.appendChild(el(`<div class="w12s-row-s">No pictures in this album yet. Save some pictures to that folder, or pick another album.</div>`));
      c.appendChild(strip); h.appendChild(c);
      h.appendChild(row("clock", "Change picture every", "", { ctl: select(INTERVALS, ss.interval || 30, (v) => { ss.interval = +v; ss.last = Date.now(); save(); }, "Change picture every") }));
      h.appendChild(row("image", "Shuffle the picture order", "", { ctl: toggle(!!ss.shuffle, (v) => { ss.shuffle = v; save(); }, "Shuffle") }));
      h.appendChild(row("image", "Next desktop background", "Skip to the next picture now", { ctl: btn("Next", () => { slideNext(); redraw(); }) }));
      h.appendChild(row("image", "Choose a fit for your desktop image", "", { ctl: select(FITS, b.fit || "fill", (v) => { b.fit = v; save(); applyWp(); pv.repaint(); }, "Fit") }));
    } else if (b.mode === "spotlight") {
      const cur = spotCurrent();
      c.appendChild(el(`<div class="w12s-row-t">Today's picture: ${esc(cur.title)}</div>`));
      c.appendChild(el(`<div class="w12s-row-s pz-note">Windows spotlight picks a new picture every day. Here, the pictures are landscapes generated by a small canvas program and bundled with this site — they aren't photos of real places and nothing is downloaded. Use “Learn about this picture” on the desktop to read how each one was made.</div>`));
      const strip = el(`<div class="pz-walls pz-strip"></div>`);
      SPOT.forEach((s) => { const d = (b.spot.dislikes || []).includes(s.k); const x = el(`<div class="pz-wall pz-static ${s.k === cur.k ? "sel" : ""} ${d ? "pz-disliked" : ""}" title="${esc(s.title)}${d ? " (disliked)" : ""}"></div>`); x.style.backgroundImage = `url("${T(s.k)}")`; strip.appendChild(x); });
      c.appendChild(strip); h.appendChild(c);
      h.appendChild(row("image", "Next picture", "Skip today's picture", { ctl: btn("Next picture", () => { b.spot.skip = (b.spot.skip || 0) + 1; save(); applyWp(); redraw(); }) }));
      if ((b.spot.dislikes || []).length) h.appendChild(row("image", "Disliked pictures", b.spot.dislikes.length + " hidden", { ctl: btn("Show them again", () => { b.spot.dislikes = []; save(); applyWp(); redraw(); }) }));
    } else if (b.mode === "dynamic") {
      const ph = dynPhase(), s = ph.sun;
      const grid = el(`<div class="pz-dyn"></div>`);
      const spans = s.polar ? null : { sunrise: [s.rise - 45, s.rise + 75], day: [s.rise + 75, s.set - 75], sunset: [s.set - 75, s.set + 45], night: [s.set + 45, s.rise - 45] };
      ["sunrise", "day", "sunset", "night"].forEach((k) => grid.appendChild(el(`<div class="pz-dyn-it ${ph.phase === k ? "sel" : ""}"><div class="pz-dyn-img" style="background-image:url('${T("dyn_" + k)}')"></div><b>${DYN_LABEL[k]}</b><span>${spans ? hhmm(spans[k][0]) + " – " + hhmm(spans[k][1]) : "—"}</span></div>`)));
      c.appendChild(el(`<div class="w12s-row-t">Lakeside — changes with the time of day</div>`)); c.appendChild(grid); h.appendChild(c);
      const locTxt = !locationAllowed() ? "Location is off in Privacy & security, so sunrise is 7:00 AM and sunset 7:00 PM." : s.fromGeo ? (s.polar ? "The sun doesn't " + (s.polar === "day" ? "set" : "rise") + " at your location today." : "Sunrise " + hhmm(s.rise) + " · Sunset " + hhmm(s.set) + " — from your location") : "Using 7:00 AM sunrise and 7:00 PM sunset. Allow location to use your real sunrise and sunset.";
      const lb = btn(pz().geo ? "Update location" : "Use my location", (e) => { e.currentTarget.disabled = true; e.currentTarget.textContent = "Locating…"; refreshGeo(true).then((ok) => { if (!ok) toast("Location", "Couldn't get your location. Using 7:00 AM / 7:00 PM."); applyWp(); redraw(); }); });
      if (!locationAllowed() || !navigator.geolocation) lb.disabled = true;
      h.appendChild(row("clock", "Sunrise and sunset", locTxt, { ctl: lb }));
    }
    // Hint on the desktop chip / lock screen.
    if (b.mode !== "spotlight") h.appendChild(row("image", "Related: Themes", "Wallpapers, colors and mouse pointer together", { onClick: () => renderPage(h.closest(".w12s-page"), "pzthemes") }));
  }

  // ---- Themes ----
  function buildThemes(h, redraw) {
    const curId = currentThemeId(), all = allThemes(), cur = all.find((t) => t.id === curId);
    const top = card("pz-theme-top"); const pv = previewEl("pz-preview-lg"); top.appendChild(pv);
    const info = el(`<div class="pz-theme-info"><div class="w12s-row-s">Current theme</div><div class="pz-theme-name">${esc(cur ? cur.name : "Custom")}</div></div>`);
    info.appendChild(btn("Save", () => {
      const nm = window.prompt("Save theme as", cur && !cur.builtin ? cur.name : "My theme"); if (!nm || !nm.trim()) return;
      saveTheme(nm.trim().slice(0, 60)); toast("Themes", "Saved “" + nm.trim() + "”."); redraw();
    }, true));
    top.appendChild(info); h.appendChild(top);
    const b = pz().bg;
    h.appendChild(row("image", "Background", { picture: "Picture", solid: "Solid color", slideshow: "Slideshow", spotlight: "Windows spotlight", dynamic: "Time of day" }[b.mode] || "Picture", { onClick: () => renderPage(h.closest(".w12s-page"), "pzbg") }));
    h.appendChild(row("palette", "Color", (S().accent || "#0067c0").toUpperCase() + " · " + (resolvedMode() === "dark" ? "Dark" : "Light"), { onClick: () => clickRow(h.closest(".w12s-page"), "personal", TXT.colors) }));
    h.appendChild(row("contrast", "Mode", "Light or dark apps and Windows", { ctl: select([["light", "Light"], ["dark", "Dark"]], resolvedMode(), (v) => { S().theme = v; save(); if (window.applyTheme) window.applyTheme(); redraw(); }, "Mode") }));
    if (window.A11y) h.appendChild(row("cursor", "Mouse cursor", "Pointer color (Accessibility › Mouse pointer has sizes)", { ctl: select([["white", "Windows default (white)"], ["black", "Windows black"], ["inverted", "Inverted"]], cursorStyle(), (v) => { try { A11y.set("ptr.style", v, { now: true }); } catch (_) {} redraw(); }, "Mouse cursor") }));
    h.appendChild(row("sound", "Sounds", "Windows default — themes here don't include sound schemes"));
    const c = card(); c.appendChild(el(`<div class="w12s-row-t">Change theme</div>`));
    const grid = el(`<div class="pz-themes"></div>`);
    all.forEach((t) => {
      const it = el(`<div class="pz-theme ${t.id === curId ? "sel" : ""}" role="button" tabindex="0" aria-label="Use theme ${esc(t.name)}"><span class="pz-theme-img"><span class="pz-theme-acc"></span></span><span class="pz-theme-n">${esc(t.name)}</span></div>`);
      const img = it.querySelector(".pz-theme-img"), th = packThumb(t);
      if (t.bg && t.bg.mode === "solid") img.style.background = t.bg.wallpaper; else if (th) img.style.backgroundImage = `url("${th}")`;
      if (t.bg && t.bg.mode === "slideshow" && t.bg.source === "folder") { img.style.background = "linear-gradient(135deg,#6b8bd6,#9b6fd8)"; img.appendChild(el(`<span class="pz-theme-tag">Slideshow</span>`)); }
      it.querySelector(".pz-theme-acc").style.background = t.accent;
      it.classList.toggle("pz-theme-dark", t.mode === "dark");
      const use = () => { applyTheme(t); redraw(); };
      it.onclick = use; it.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); use(); } };
      if (!t.builtin) {
        const tools = el(`<span class="pz-theme-tools"></span>`);
        const ex = el(`<button type="button" title="Export ${esc(t.name)}" aria-label="Export ${esc(t.name)}">⤓</button>`); ex.onclick = (e) => { e.stopPropagation(); const f = exportTheme(t); toast("Themes", "Exported " + f); };
        const del = el(`<button type="button" title="Delete ${esc(t.name)}" aria-label="Delete ${esc(t.name)}">✕</button>`); del.onclick = (e) => { e.stopPropagation(); pz().theme.custom = pz().theme.custom.filter((x) => x.id !== t.id); save(); redraw(); };
        tools.append(ex, del); it.appendChild(tools);
      }
      grid.appendChild(it);
    });
    c.appendChild(grid); h.appendChild(c);
    const imp = btn("Browse", () => {
      const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".json,.themepack,application/json";
      inp.onchange = () => { const f = inp.files[0]; if (!f) return; f.text().then((tx) => { try { const t = importThemeText(tx); applyTheme(t); toast("Themes", "Imported “" + t.name + "”."); redraw(); } catch (err) { toast("Couldn't import theme", err.message); } }); };
      inp.click();
    });
    h.appendChild(row("image", "Import a theme", "A .themepack.json file exported from Windows 12", { ctl: imp }));
    h.appendChild(row("image", "Export the current theme", "Download it as a .themepack.json file (JSON) to keep or share", { ctl: btn("Export", () => { const t = cur || snapshot("My theme"); const f = exportTheme(t); toast("Themes", "Exported " + f); }) }));
  }

  // ---- Start ----
  function buildStart(h, redraw) {
    const st = pz().start;
    const lay = el(`<div class="pz-layouts" role="radiogroup" aria-label="Layout"></div>`);
    [["pins", "More pins"], ["default", "Default"], ["recs", "More recommendations"]].forEach(([v, l]) => { const b = el(`<button type="button" role="radio" aria-checked="${st.layout === v}" class="pz-lay ${st.layout === v ? "sel" : ""}"><span class="pz-lay-art pz-lay-${v}"><i></i><i></i></span>${l}</button>`); b.onclick = () => { st.layout = v; save(); redraw(); }; lay.appendChild(b); });
    const c = card(); c.appendChild(el(`<div class="w12s-row-t">Layout</div>`)); c.appendChild(lay); h.appendChild(c);
    h.appendChild(row("start", "Show recently added apps", "New apps you install appear in Recommended for two weeks", { ctl: toggle(st.recentApps, (v) => { st.recentApps = v; save(); }, "Show recently added apps") }));
    h.appendChild(row("start", "Show recommended files in Start, recent files in File Explorer, and items in Jump Lists", "Files you open and save on this PC", { ctl: toggle(st.recFiles, (v) => { st.recFiles = v; save(); }, "Show recommended files") }));
    h.appendChild(row("start", "Clear the list", "Removes everything currently in Recommended and Jump Lists (it fills up again as you work)", { ctl: btn("Clear", () => {
      const now2 = Date.now(); recommended(400).forEach((it) => { st.removed[it.key] = now2; }); pz().opens = {}; save(); toast("Start", "Recommended list cleared.");
    }) }));
  }

  // ---- Taskbar ----
  function buildTaskbar(h, redraw) {
    const a = S().appData;
    h.appendChild(row("taskbar", "Combine taskbar buttons and hide labels", "Group windows of the same app into one button", { ctl: select([["always", "Always"], ["full", "When taskbar is full"], ["never", "Never"]], a.taskbarCombine || "always", (v) => { a.taskbarCombine = v; save(); if (WM.rebuildTaskButtons) WM.rebuildTaskButtons(); queueLayout(); }, "Combine taskbar buttons") }));
    h.appendChild(row("taskbar", "Show badges on taskbar apps", "Unread notification counts and progress", { ctl: toggle(pz().badges, (v) => { pz().badges = v; save(); paintBadges(); }, "Show badges") }));
    const pins = WM.taskbarPins();
    const c = card(); c.appendChild(el(`<div class="w12s-row-t">Pinned apps</div><div class="w12s-row-s">Tip: drag an app from Start or the desktop onto the taskbar to pin it, and drag pinned icons to reorder them (on touch, press and hold first).</div>`));
    const list = el(`<div class="pz-pinlist"></div>`);
    pins.forEach((id, i) => {
      const r = el(`<div class="pz-pin-row"><span class="pz-pin-ic">${window.Icon ? Icon.mini(id, WM.appName(id)) : ""}</span><span class="pz-pin-n">${esc(WM.appName(id))}</span></div>`);
      const up = btn("↑", () => { WM.movePin(id, i - 1); redraw(); }); up.title = "Move left"; up.setAttribute("aria-label", "Move " + WM.appName(id) + " left"); if (!i) up.disabled = true;
      const dn = btn("↓", () => { WM.movePin(id, i + 1); redraw(); }); dn.title = "Move right"; dn.setAttribute("aria-label", "Move " + WM.appName(id) + " right"); if (i === pins.length - 1) dn.disabled = true;
      const un = btn("Unpin", () => { WM.unpinFromTaskbar(id); redraw(); });
      r.append(up, dn, un); list.appendChild(r);
    });
    if (!pins.length) list.appendChild(el(`<div class="w12s-row-s">No pinned apps.</div>`));
    c.appendChild(list);
    let apps = []; try { apps = WM.installedApps().filter((x) => !pins.includes(x.id)).sort((x, y) => x.name.localeCompare(y.name)); } catch (_) {}
    const add = select([["", "Pin an app…"]].concat(apps.map((x) => [x.id, x.name])), "", (v) => { if (v) { WM.pinToTaskbar(v); redraw(); } }, "Pin an app");
    const ar = el(`<div class="pz-pin-add"></div>`); ar.appendChild(add); c.appendChild(ar);
    h.appendChild(c);
  }

  // ---- Display: Night light + HDR (injected below the Night light row) ----
  function nightCard() {
    const n = pz().night, q = qs();
    const c = card("pz-night"); c.dataset.pzInject = "1";
    const paint = () => {
      c.innerHTML = "";
      c.appendChild(el(`<div class="pz-card-h">${ICONS.moon}<b>Night light</b><span class="pz-night-st" aria-live="polite">${esc(nightStatus())}</span></div>`));
      const now2 = btn(q.night ? "Turn off now" : "Turn on now", () => { q.night = !q.night; save(); if (WM.applyDisplayFx) WM.applyDisplayFx(); syncRowToggle(); paint(); });
      c.appendChild(rowLine("Night light", now2));
      const sl = el(`<input class="w12s-range pz-night-str" type="range" min="0" max="100" step="1" aria-label="Night light strength">`); sl.value = q.nightStrength != null ? q.nightStrength : 50;
      sl.oninput = () => { q.nightStrength = +sl.value; save(); if (WM.applyDisplayFx) WM.applyDisplayFx(); };
      c.appendChild(rowLine("Strength", sl, q.night ? "" : "Turn Night light on to see the strength"));
      c.appendChild(rowLine("Schedule night light", toggle(n.schedule, (v) => { n.schedule = v; n.lastPhase = ""; save(); if (v) { if (n.mode === "sun") refreshGeo(false).then(() => { nightTick(true); paint(); }); nightTick(true); } paint(); syncRowToggle(); }, "Schedule night light")));
      if (n.schedule) {
        const s = sun();
        const modeSel = select([["sun", "Sunset to sunrise"], ["hours", "Set hours"]], n.mode, (v) => { n.mode = v; n.lastPhase = ""; save(); if (v === "sun") refreshGeo(true).then(() => { nightTick(true); paint(); syncRowToggle(); }); nightTick(true); paint(); syncRowToggle(); }, "Schedule");
        c.appendChild(rowLine("Schedule", modeSel, n.mode === "sun" ? (s.polar ? "The sun doesn't " + (s.polar === "day" ? "set" : "rise") + " here today" : (s.fromGeo ? "Sunset " + hhmm(s.set) + " · Sunrise " + hhmm(s.rise) + " (from your location)" : (locationAllowed() ? "Location not available — using 7:00 PM to 7:00 AM" : "Location is off in Privacy & security — using 7:00 PM to 7:00 AM"))) : ""));
        if (n.mode === "hours") {
          const ti = (val, fn, lbl) => { const t = el(`<input type="time" class="w12s-select pz-time" aria-label="${lbl}">`); t.value = val; t.addEventListener("click", (e) => e.stopPropagation()); t.onchange = () => { if (t.value) { fn(t.value); n.lastPhase = ""; save(); nightTick(true); paint(); syncRowToggle(); } }; return t; };
          c.appendChild(rowLine("Turn on", ti(n.on, (v) => { n.on = v; }, "Turn on at")));
          c.appendChild(rowLine("Turn off", ti(n.off, (v) => { n.off = v; }, "Turn off at")));
        }
      }
    };
    function syncRowToggle() {
      const list = c.parentNode; if (!list) return;
      const r = [...list.querySelectorAll(".w12s-row")].find((x) => { const t = x.querySelector(".w12s-row-t"); return t && TXT.night.includes(t.textContent.trim()); });
      const inp = r && r.querySelector("input[type=checkbox]"); if (inp) inp.checked = !!qs().night;
    }
    paint();
    c.repaint = () => { syncRowToggle(); paint(); };
    return c;
  }
  function rowLine(label, ctl, sub) { const r = el(`<div class="w12s-row w12s-row-static pz-line"><div class="w12s-row-txt"><div class="w12s-row-t"></div>${sub ? `<div class="w12s-row-s"></div>` : ""}</div><div class="w12s-row-ctl"></div></div>`); r.querySelector(".w12s-row-t").textContent = label; if (sub) r.querySelector(".w12s-row-s").textContent = sub; if (ctl) r.querySelector(".w12s-row-ctl").appendChild(ctl); return r; }
  function hdrCard() {
    const c = card("pz-hdr-card"); c.dataset.pzInject = "1";
    const hdr = hdrSupported(), p3 = p3Supported();
    c.appendChild(el(`<div class="pz-card-h">${ICONS.hdr}<b>HDR</b><span class="pz-hdr-st ${hdr ? "yes" : "no"}">${hdr ? "HDR display detected" : "HDR display not detected"}</span></div>`));
    c.appendChild(rowLine("Display capabilities", null, (hdr ? "This screen and browser report high dynamic range (CSS “dynamic-range: high”)." : "This screen or browser doesn't report high dynamic range (CSS “dynamic-range: high” is false).") + " Wide color (Display P3): " + (p3 ? "yes" : "no") + "."));
    c.appendChild(rowLine("HDR look (simulated)", toggle(!!pz().hdr, (v) => { pz().hdr = v; save(); applyHdr(); }, "HDR look (simulated)"), "Adds a little contrast and color saturation to everything on screen. It's a visual effect — a web page can't switch your screen into real HDR mode."));
    return c;
  }

  const PAGES = {
    pzbg: { title: "Background", parent: "personal", build: buildBackground },
    pzthemes: { title: "Themes", parent: "personal", build: buildThemes },
    pzstart: { title: "Start", parent: "personal", build: buildStart },
    pztaskbar: { title: "Taskbar", parent: "personal", build: buildTaskbar },
  };
  // Also reachable with window.SettingsStartPage = "pzthemes" etc. (js/settings12.js reads SettingsSubs).
  window.SettingsSubs = window.SettingsSubs || {};
  Object.keys(PAGES).forEach((k) => { if (!Object.prototype.hasOwnProperty.call(window.SettingsSubs, k)) window.SettingsSubs[k] = { title: PAGES[k].title, parent: PAGES[k].parent, build: (h, redraw) => PAGES[k].build(h, redraw) }; });

  function enhance(page) {
    const h1 = page.querySelector(":scope > h1.w12s-title"); if (!h1) return;
    const list = page.querySelector(":scope > .w12s-list"); if (!list || list.dataset.pzPage) return;
    const crumb = h1.querySelector(".w12s-crumb");
    const title = (crumb ? (h1.lastChild && h1.lastChild.textContent) || "" : h1.textContent).trim();
    const rowsBy = (names) => [...list.querySelectorAll(":scope > .w12s-row")].find((x) => { const t = x.querySelector(".w12s-row-t"); return t && names.includes(t.textContent.trim()); });
    if (!crumb && TXT.personal.includes(title) && !list.querySelector(".pz-row")) {
      const bg = rowsBy(TXT.background); if (bg) { bg.onclick = () => renderPage(page, "pzbg"); const s = bg.querySelector(".w12s-row-s"); if (s) s.textContent = "Pictures, solid colors, slideshow, Windows spotlight, time of day"; }
      const th = rowsBy(TXT.themes);
      if (th) { th.onclick = () => renderPage(page, "pzthemes"); const s = th.querySelector(".w12s-row-s"); if (s) s.textContent = "Install, create, manage, import and export themes"; const ch = th.querySelector(".w12s-chev"); if (ch) ch.classList.remove("down"); }
      const st = row("start", "Start", "Layout, recently added apps, recommended files", { onClick: () => renderPage(page, "pzstart") });
      const tb = row("taskbar", "Taskbar", "Pinned apps, badges, combine buttons", { onClick: () => renderPage(page, "pztaskbar") });
      const anchor = rowsBy(TXT.icons);
      if (anchor) { list.insertBefore(st, anchor); list.insertBefore(tb, anchor); } else { list.append(st, tb); }
    } else if (crumb && TXT.display.includes(title) && !list.querySelector(".pz-night")) {
      const nr = rowsBy(TXT.night);
      const nc = nightCard(), hc = hdrCard();
      if (nr) { nr.after(nc); nc.after(hc); const inp = nr.querySelector("input[type=checkbox]"); if (inp) inp.addEventListener("change", () => setTimeout(() => nc.repaint(), 0)); }
      else list.append(nc, hc);
    }
  }
  function hookSettingsWin(win) {
    const page = win.querySelector && win.querySelector(".w12s-page");
    if (!page || page.__pz) return; page.__pz = true;
    new MutationObserver(() => enhance(page)).observe(page, { childList: true });
    enhance(page);
  }
  function watchScreen() {
    const s = document.getElementById("screen"); if (!s) return;
    new MutationObserver((muts) => muts.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1 && n.classList.contains("win")) setTimeout(() => hookSettingsWin(n), 0); }))).observe(s, { childList: true });
    s.querySelectorAll(".win").forEach(hookSettingsWin);
  }

  // ===================================================================
  //  Clock: slideshow, spotlight day change, dynamic phase, night schedule
  // ===================================================================
  function tick() {
    if (!window.State || !State.data || !State.data.desktop) return;
    try {
      wrapNotify(); wrapOpeners(); hookTaskbar(); scanApps();
      const b = pz().bg;
      if (b.mode === "slideshow" && document.querySelector("#screen > .desktop")) {
        const ms = (b.slideshow.interval || 30) * 60000;
        if (!b.slideshow.last) { b.slideshow.last = Date.now(); save(); }
        else if (Date.now() - b.slideshow.last >= ms) slideNext();
      }
      if (b.mode === "dynamic" && dynPhase().phase !== shown.dyn) applyWp();
      if (b.mode === "spotlight" && spotCurrent().k !== shown.spot) applyWp();
      nightTick(false);
      const nc = document.querySelector(".pz-night"); if (nc) { const st = nc.querySelector(".pz-night-st"); if (st) st.textContent = nightStatus(); }
      paintBadges(); layoutOverflow();
    } catch (e) { console.error("[pz] tick", e); }
  }
  function start() {
    if (!window.State || !State.data) return;
    pz(); watchScreen(); applyHdr();
    // Reuse an already-granted location (no prompt) for sunrise/sunset.
    const g = pz().geo; if ((pz().bg.mode === "dynamic" || (pz().night.schedule && pz().night.mode === "sun")) && (!g || Date.now() - g.ts > 6 * 3600000)) refreshGeo(false).then((ok) => { if (ok) { applyWp(); nightTick(true); } });
    tick(); setInterval(tick, 1000 * 15);
    let focusSig = "";
    setInterval(() => {
      try {
        wrapNotify(); hookTaskbar(); paintBadges();
        // The focused window's button must stay out of the overflow: relayout when focus changes.
        const ws = WM.windows(), top = ws.filter((e) => e.win.style.display !== "none").sort((a, b) => (+b.win.style.zIndex || 0) - (+a.win.style.zIndex || 0))[0];
        const sig = ws.length + ":" + (top ? top.id : "");
        if (sig !== focusSig) { focusSig = sig; queueLayout(); }
      } catch (_) {}
    }, 1000);
    if (document.querySelector("#screen > .desktop")) applyWp();
  }
  // Re-apply after the desktop is (re)built.
  try {
    if (window.WM && typeof WM.buildDesktop === "function" && !WM.buildDesktop.__pz) {
      const ob = WM.buildDesktop;
      WM.buildDesktop = function () { const r = ob.apply(this, arguments); try { tbObsFor = null; hookTaskbar(); applyHdr(); setTimeout(() => { applyWp(); queueLayout(); }, 0); } catch (_) {} return r; };
      Object.keys(ob).forEach((k) => { WM.buildDesktop[k] = ob[k]; });
      WM.buildDesktop.__pz = true;
    }
  } catch (_) {}
  document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(); });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
  window.addEventListener("load", () => { wrapOpeners(); });

  window.Personalize = {
    // wallpaper hooks for js/wm.js
    wallpaperCss, crossfade, setBackground: setBg, nextBackground: slideNext,
    spotlight: () => spotCurrent(), dynamicPhase: (d) => dynPhase(d), sunTimes,
    // themes
    themes: allThemes, applyTheme: (idOrTheme) => applyTheme(typeof idOrTheme === "string" ? allThemes().find((t) => t.id === idOrTheme) : idOrTheme),
    currentTheme: currentThemeId, saveTheme, exportTheme, importTheme: importThemeText, snapshot,
    // night light / HDR
    nightTick: () => nightTick(true), nightStatus, setHdr: (v) => { pz().hdr = !!v; save(); applyHdr(); }, hdrSupported,
    // Start / Jump Lists
    renderRecommended, showMoreRecommended, recommended, jumpListSection, jumpItems: jumpData, noteOpen, recentFiles,
    // taskbar
    setProgress, paintBadges, layoutTaskbar: () => { layoutOverflow(); paintBadges(); },
    openSettings: (key) => { const page = document.querySelector(".win .w12s-page"); if (page && PAGES[key]) { renderPage(page, key); return; } window.SettingsStartPage = key; WM.open("settings"); },
    _tick: tick,
  };
})();
