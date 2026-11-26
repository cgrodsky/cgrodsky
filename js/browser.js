/* Microsoft Edge (and Google Chrome) for the Windows 12 simulation.

   A real tabbed browser shell around two kinds of pages:
     · built-in sites from js/sites.js (bank.local, youtube.local, …) and edge:// pages, rendered in the OS page;
     · every other address in an <iframe> (sites that refuse framing stay blank — the bar offers a real tab).

   Edge features: tabs (each with its own page + back/forward history), new tab page, drag to reorder,
   duplicate, pin, mute (built-in media), tab groups (name, colour, collapse), vertical tabs, reopen closed
   tab (Ctrl+Shift+T), sleeping tabs (background pages are unloaded after N minutes), session restore,
   Collections side pane, PDF viewer (js/edge-pdf.js + vendor/pdfjs, loaded on demand), Downloads into the
   virtual file system (flyout + edge://downloads), History (flyout + edge://history), Favorites bar +
   manager (folders, import / export of bookmark HTML files) and edge://settings. Chrome gets the same shell
   without Collections / vertical tabs, with Google in its home frame.

   Kept from before: SafeSearch + first-run age question (State.data.appData.safety, window.SafeSearch),
   adult / suspicious-site warnings, in-app search, address-bar suggestions, Read aloud, Copilot button.

   Family Safety (js/family.js) hooks a window through `.browser-page`, `.url`, `.bb-nav.back/.reload` and
   `iframe.embed-frame`. Only the ACTIVE tab's pane carries `browser-page` (and only its iframe matches
   `.embed-frame` inside it), so its filters always look at the tab on screen. Its MutationObserver watches
   the pane that was active when it hooked the window; every navigation / tab switch touches the childList
   of every pane this window ever had (famTick) so that observer always fires.

   Storage: State.data.appData.browser = { history, favs, favFolders, quick, collections, downloads,
   sessions, closedTabs, pdfAnn, settings }. Downloaded bytes go to IndexedDB through VFS.putBlob.
   Styles: css/edge.css (added here if index.html doesn't link it). */
(function () {
  "use strict";
  const SCRIPT_V = (() => { try { const s = document.currentScript && document.currentScript.src; const m = s && s.match(/[?&]v=([^&#]+)/); return m ? m[1] : ""; } catch (e) { return ""; } })();
  const VQ = SCRIPT_V ? "?v=" + SCRIPT_V : "";
  function el(html) { const d = document.createElement("div"); d.innerHTML = String(html).trim(); return d.firstElementChild; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const save = () => { try { if (window.State) State.save(); } catch (_) {} };
  const vfsChanged = () => { save(); try { window.dispatchEvent(new Event("vfs-change")); } catch (_) {} };
  (function ensureCSS() {
    if (document.querySelector('link[href*="css/edge.css"]')) return;
    const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "css/edge.css" + VQ; l.id = "edge-css";
    (document.head || document.documentElement).appendChild(l);
  })();

  // ------------------------------------------------------------------ icons
  const sv = (d, w) => `<svg viewBox="0 0 24 24" width="${w || 16}" height="${w || 16}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const IC = {
    back: sv('<path d="M19 12H5"/><path d="M11 6l-6 6 6 6"/>', 17), fwd: sv('<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>', 17),
    reload: sv('<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4h-4"/>', 17), home: sv('<path d="M4 11 12 4l8 7"/><path d="M6 10v9h12v-9"/>', 17),
    star: sv('<path d="M12 3.6l2.5 5.2 5.7.8-4.1 4 1 5.7L12 16.6l-5.1 2.7 1-5.7-4.1-4 5.7-.8z"/>', 17),
    favs: sv('<path d="M9.5 4.5l1.8 3.7 4.1.6-3 2.9.7 4-3.6-1.9-3.6 1.9.7-4-3-2.9 4.1-.6z"/><path d="M15 15.5h6M15 18.5h6M17.5 12.5h3.5"/>', 17),
    collections: sv('<rect x="4.5" y="4" width="11" height="13.5" rx="2"/><path d="M8.5 20.5h8a3 3 0 0 0 3-3V8.5"/><path d="M8 10.7h4M10 8.7v4"/>', 17),
    download: sv('<path d="M12 4v11"/><path d="M7.5 10.5 12 15l4.5-4.5"/><path d="M5 19.5h14"/>', 17),
    history: sv('<path d="M3.5 12a8.5 8.5 0 1 0 2.5-6"/><path d="M3.5 4.5V9H8"/><path d="M12 7.5V12l3 2"/>', 17),
    more: sv('<circle cx="5" cy="12" r="1.1" fill="currentColor"/><circle cx="12" cy="12" r="1.1" fill="currentColor"/><circle cx="19" cy="12" r="1.1" fill="currentColor"/>', 17),
    plus: sv('<path d="M12 5v14M5 12h14"/>'), close: sv('<path d="M7 7l10 10M17 7 7 17"/>', 14),
    lock: sv('<rect x="5.5" y="10.5" width="13" height="9" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>', 14),
    warn: sv('<path d="M12 4.5 20.5 19h-17z"/><path d="M12 10v4M12 16.6v.2"/>', 14), info: sv('<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8v.2"/>', 14),
    search: sv('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>'), globe: sv('<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.8 3 2.8 14 0 17M12 3.5c-2.8 3-2.8 14 0 17"/>'),
    speaker: sv('<path d="M4 9.5v5h3.5l4.5 4v-13l-4.5 4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>', 14),
    muted: sv('<path d="M4 9.5v5h3.5l4.5 4v-13l-4.5 4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/>', 14),
    pin: sv('<path d="M9 4h6l-1 5 3 3v2H7v-2l3-3z"/><path d="M12 14v6"/>', 14),
    folder: sv('<path d="M3.5 7a1.5 1.5 0 0 1 1.5-1.5h4l2 2h8a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 18.5H5A1.5 1.5 0 0 1 3.5 17z"/>'),
    gear: sv('<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M6 18l1.4-1.4M16.6 7.4 18 6"/>'),
    trash: sv('<path d="M4.5 7h15M10 11v6M14 11v6M6.5 7l1 12.5h9l1-12.5M9.5 7V4.5h5V7"/>'),
    open: sv('<path d="M14 4.5h5.5V10"/><path d="M19.5 4.5 11 13"/><path d="M18 14v4.5a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1H10"/>'),
    vtabs: sv('<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M9 4.5v15M5.5 8.5h1.5M5.5 11.5h1.5M5.5 14.5h1.5"/>'),
    htabs: sv('<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9h17M8 4.5V9"/>'),
    tabacts: sv('<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M3.5 9h17M7 5v4"/>'),
    chevL: sv('<path d="M14.5 6 8.5 12l6 6"/>'), chevR: sv('<path d="M9.5 6l6 6-6 6"/>'), chevD: sv('<path d="M6 9.5l6 6 6-6"/>', 12),
    grip: sv('<circle cx="9" cy="6.5" r="1" fill="currentColor"/><circle cx="15" cy="6.5" r="1" fill="currentColor"/><circle cx="9" cy="12" r="1" fill="currentColor"/><circle cx="15" cy="12" r="1" fill="currentColor"/><circle cx="9" cy="17.5" r="1" fill="currentColor"/><circle cx="15" cy="17.5" r="1" fill="currentColor"/>'),
    note: sv('<path d="M5 4.5h10l4 4v11H5z"/><path d="M8.5 11h7M8.5 14.5h5"/>'), copy: sv('<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>'),
    dup: sv('<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>'),
    group: sv('<rect x="3.5" y="6" width="17" height="12" rx="3"/><path d="M8 10.5h8M8 13.5h5"/>'),
    moon: sv('<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/>', 12),
    read: sv('<path d="M4 9.5v5h3.5l4.5 4v-13l-4.5 4z"/><path d="M15.5 9a4 4 0 0 1 0 6"/>', 17),
    zoomIn: sv('<path d="M12 6v12M6 12h12"/>', 14), zoomOut: sv('<path d="M6 12h12"/>', 14),
    win: sv('<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M3.5 9h17"/>'), print: sv('<path d="M7 9V4.5h10V9"/><rect x="4" y="9" width="16" height="7.5" rx="1.5"/><path d="M7 14h10v5.5H7z"/>'),
    check: sv('<path d="M5 12.5l4.5 4.5L19 7.5"/>'), file: sv('<path d="M6.5 3.5h7.5l4 4v13h-11.5z"/><path d="M14 3.5v4h4"/>'),
    camera: sv('<path d="M4 8.5h3.5L9 6h6l1.5 2.5H20v10H4z"/><circle cx="12" cy="13" r="3.2"/>'),
    edit: sv('<path d="M5 19l1-4 9.5-9.5 3 3L9 18z"/><path d="M13.5 7.5l3 3"/>'), up: sv('<path d="M12 19V5M6 11l6-6 6 6"/>'), x2: sv('<path d="M7 7l10 10M17 7 7 17"/>'),
    retry: sv('<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4h-4"/>'), cancel: sv('<circle cx="12" cy="12" r="8.5"/><path d="M9 9l6 6M15 9l-6 6"/>'),
  };
  const PDF_ICON = `<img src="assets/pdf.png?v=1" alt="">`;
  const SPIN = `<span class="eg-spin" aria-hidden="true"></span>`;

  // ------------------------------------------------------------------ built-in sites
  const SPECIAL = {
    "bank": "bank", "bank.local": "bank",
    "amazon": "amazon", "amazon.local": "amazon", "amazon.com": "amazon",
    "microsoft": "microsoft", "microsoft.local": "microsoft", "microsoft.com": "microsoft",
    "youtube": "youtube", "youtube.local": "youtube", "youtube.com": "youtube",
    "discord": "discord", "discord.local": "discord", "discord.com": "discord",
    "duolingo": "duolingo", "duolingo.local": "duolingo", "duolingo.com": "duolingo",
    "netflix": "netflix", "netflix.local": "netflix", "netflix.com": "netflix",
    "flightstats": "flightstats", "flightstats.local": "flightstats", "flightstats.com": "flightstats", "flights": "flightstats",
    "doordash": "doordash", "doordash.local": "doordash", "doordash.com": "doordash",
  };
  const SITE_TITLE = { bank: "Forge Bank", amazon: "Amazon", microsoft: "Microsoft", youtube: "YouTube", discord: "Discord", duolingo: "Duolingo", netflix: "Netflix", flightstats: "FlightStats", doordash: "DoorDash" };
  function resolveSpecial(input) {
    const raw = (input || "").trim().toLowerCase();
    if (!raw || raw === "home" || raw === "newtab" || raw === "about:home" || raw === "about:blank" || /^(edge|chrome):\/\/newtab\/?$/.test(raw)) return "home";
    if (/^(edge|chrome|file|blob|data|search|images):/.test(raw)) return null;
    const key = raw.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
    return SPECIAL[key] || SPECIAL[raw] || null;
  }
  const ICON_KEY = { youtube: "youtubeApp", microsoft: "ms365" };
  const siteIcon = (k, big) => (window.Icon ? Icon[big ? "md" : "mini"](ICON_KEY[k] || k, SITE_TITLE[k] || k) : IC.globe);
  const INTERNAL = ["history", "favorites", "bookmarks", "downloads", "settings"];
  function internalOf(url) { const m = /^(edge|chrome):\/\/([a-z-]+)(?:\/([\w-]*))?/i.exec(String(url || "").trim()); if (!m) return null; let p = m[2].toLowerCase(); if (p === "bookmarks") p = "favorites"; return INTERNAL.includes(p) ? { page: p, sub: (m[3] || "").toLowerCase() } : (p === "newtab" ? { page: "newtab" } : { page: "unknown", raw: p }); }

  // Microsoft Edge new-tab news feed (original copy).
  const EDGE_NEWS = [
    { cat: "Weather", title: "Sunny skies expected through the weekend", src: "Weather Center", img: "linear-gradient(135deg,#48b1f3,#8fd3ff)" },
    { cat: "Technology", title: "Foldable laptops steal the show at this year's tech expo", src: "Tech Daily", img: "linear-gradient(135deg,#7b5cff,#5433ff)" },
    { cat: "Sports", title: "Home team clinches a playoff spot in an overtime thriller", src: "Sports Wire", img: "linear-gradient(135deg,#22b573,#0a9d6e)" },
    { cat: "Finance", title: "Markets edge higher as tech shares rally", src: "Market Watch", img: "linear-gradient(135deg,#f7971e,#ffd200)" },
    { cat: "Science", title: "Researchers map a new region of the deep ocean", src: "Science Today", img: "linear-gradient(135deg,#2193b0,#6dd5ed)" },
    { cat: "Travel", title: "Ten underrated cities worth a visit this year", src: "Travel Guide", img: "linear-gradient(135deg,#ff7e5f,#feb47b)" },
  ];

  // ------------------------------------------------------------------ site safety (unchanged behaviour)
  const SAFE_TLDS = ["com", "net", "org", "io", "gov", "edu", "local"];
  const ADULT_HOSTS = ["pornhub", "xvideos", "xnxx", "xhamster", "redtube", "youporn", "onlyfans", "chaturbate", "brazzers", "spankbang", "stripchat", "livejasmin", "bongacams", "cam4", "fansly", "rule34", "e-hentai", "nhentai", "hentaihaven", "motherless", "tube8", "eporner", "porntrex", "manyvids", "camsoda", "myfreecams"];
  // Every website owned by Aylo (formerly MindGeek) counts as adult content, including the company's own site.
  const AYLO_HOSTS = ["aylo", "mindgeek", "pornhub", "youporn", "redtube", "tube8", "thumbzilla", "pornmd", "xtube", "modelhub", "brazzers", "realitykings", "digitalplayground", "mofos", "twistys", "babes", "men", "seancody", "bangbros", "spicevids", "transangels", "fakehub", "sexyhub", "whynotbi", "biempire", "noirmale", "iconmale", "trueamateurs", "propertysex", "lookathernow", "doghousedigital", "erito", "squirted", "bromo", "milehighmedia", "realityjunkies", "dancingbear", "metrohd", "devianthardcore", "familyhookups", "transharder", "trans500", "gaywire"];
  const ADULT_WORDS = /(^|[^a-z])(porn|porno|xxx|nsfw|hentai|sex|sexy|nude|nudes|naked|erotic|camgirl|milf|fetish|escort|boobs|tits|onlyfans|rule34)([^a-z]|$)|porn|xxx/i;
  function hostOf(url) { try { return new URL(/^https?:\/\//i.test(url) ? url : "https://" + url).hostname.toLowerCase(); } catch (_) { return ""; } }
  const hostIs = (bare, list) => list.some((h) => bare === h || bare.startsWith(h + ".") || bare.endsWith("." + h + ".com") || bare.includes("." + h + "."));
  function isAdultSite(url) {
    const host = hostOf(url); const bare = host.replace(/^www\./, "");
    if (hostIs(bare, ["men"])) return /^(www\.)?men\.com$/.test(host);   // "men" only means men.com
    return !!host && (hostIs(bare, ADULT_HOSTS) || hostIs(bare, AYLO_HOSTS.filter((h) => h !== "men")) || ADULT_WORDS.test(bare.replace(/[.-]/g, " ")) || /\/(porn|xxx|nsfw|hentai)(\/|$)/i.test(url));
  }
  const isAdultText = (q) => ADULT_WORDS.test(String(q || "")) || ADULT_HOSTS.concat(AYLO_HOSTS.filter((h) => h !== "men" && h !== "babes")).some((h) => new RegExp("(^|\\W)" + h + "(\\W|$)", "i").test(String(q || "")));
  function siteWarning(url) {
    const host = hostOf(url); if (!host) return null;
    if (isAdultSite(url)) return { kind: "adult", host };
    if (/^\d+(\.\d+){3}$/.test(host)) return { kind: "suspicious", host, why: "This address is just numbers (an IP address), not a normal website name." };
    const tld = host.split(".").pop();
    if (!SAFE_TLDS.includes(tld)) return { kind: "suspicious", host, why: `Its address ends in <b>.${esc(tld)}</b>. Most trusted websites end in <b>.com</b>, <b>.net</b>, <b>.org</b> or <b>.io</b>.` };
    if (/^http:\/\//i.test(url) && tld !== "local") return { kind: "insecure", host, why: "This site uses <b>http://</b>, not <b>https://</b>, so what you type or see here isn't private — others on the network could read or change it." };
    return null;
  }
  // SafeSearch: asked once (age check). Under 18 → SafeSearch is locked on.
  function safety() { const d = State.data; d.appData = d.appData || {}; return d.appData.safety || (d.appData.safety = { asked: false, adult: false, safeSearch: true, locked: false }); }
  const safeOn = () => { const s = safety(); return s.locked || s.safeSearch !== false; };
  window.SafeSearch = { on: safeOn, isAdultText, isAdultSite };
  const allowedHosts = new Set();   // hosts the user chose to continue to (this session)
  function renderWarning(ctx, w, final, onContinue) {
    const adult = w.kind === "adult", blocked = adult && safeOn();
    const title = adult ? (blocked ? "Blocked by SafeSearch" : "Adult content warning") : w.kind === "insecure" ? "Not secure" : "Suspicious website";
    const msg = adult
      ? (blocked ? (safety().locked ? "This website has <b>adult content</b>. SafeSearch is locked on because you said you're under 18, so it can't be opened." : "This website has <b>adult content</b>. SafeSearch is on — turn it off in the browser's <b>Settings</b> if you're 18 or older.") : "This website may show <b>adult content</b> that isn't suitable for kids. You must be 18 or older to continue.")
      : w.kind === "insecure" ? w.why + " Don't type passwords or personal info on it."
      : "This website could be <b>unsafe</b>. " + w.why + " Sites like this are sometimes used for scams or to steal passwords.";
    const page = el(`<div class="bw-warn ${adult ? "bw-adult" : "bw-sus"}">
      <div class="bw-card">
        <div class="bw-ic">${adult ? (blocked ? "🛡" : "18+") : w.kind === "insecure" ? "🔓" : "!"}</div>
        <h2>${title}</h2>
        <p class="bw-host">${esc(w.host)}</p>
        <p>${msg}</p>
        <div class="bw-btns"><button class="bw-back">Go back${blocked ? "" : " (recommended)"}</button>${blocked ? "" : `<button class="bw-go">${adult ? "I'm 18 or older — continue" : "Continue anyway"}</button>`}</div>
      </div></div>`);
    page.querySelector(".bw-back").onclick = () => ctx.goBack();
    const go = page.querySelector(".bw-go"); if (go) go.onclick = () => { allowedHosts.add(w.host); onContinue(); };
    ctx.page.appendChild(page);
  }
  function renderSafeBlocked(ctx, q) {
    ctx.page.appendChild(el(`<div class="bw-warn bw-adult"><div class="bw-card"><div class="bw-ic">🛡</div><h2>SafeSearch is on</h2><p class="bw-host">${esc(q)}</p>
      <p>Results for this search are hidden because they may include adult content.${safety().locked ? " SafeSearch is locked on because you said you're under 18." : " You can turn SafeSearch off in the browser's <b>Settings</b> if you're 18 or older."}</p></div></div>`));
  }
  // The age check shown the first time Edge or Chrome opens.
  function ageGate(page, done) {
    const g = el(`<div class="bw-warn bw-age"><div class="bw-card">
      <div class="bw-ic">🛡</div><h2>Before you browse</h2>
      <p><b>Are you 18 or older?</b></p>
      <p class="bw-small">If you're under 18, <b>SafeSearch</b> stays on: adult websites and searches are blocked, and it can't be turned off.</p>
      <div class="bw-btns"><button class="bw-no">No, I'm under 18</button><button class="bw-yes">Yes, I'm 18 or older</button></div>
    </div></div>`);
    g.querySelector(".bw-no").onclick = () => { Object.assign(safety(), { asked: true, adult: false, safeSearch: true, locked: true }); State.save(); g.remove(); done(); };
    g.querySelector(".bw-yes").onclick = () => { Object.assign(safety(), { asked: true, adult: true, safeSearch: true, locked: false }); State.save(); g.remove(); done(); };
    page.appendChild(g);
  }
  // What to show in Chrome's Google frame for something typed in the address bar (or null for a normal site).
  function googleTarget(url, isUrl) {
    const t = String(url || "").trim();
    let m = t.match(/^(search|images):(.*)$/i);
    let q = null, images = false;
    if (m) { q = m[2].trim(); images = m[1].toLowerCase() === "images"; }
    else if (!isUrl) q = t;
    else {
      const u = (() => { try { return new URL(/^https?:\/\//.test(t) ? t : "https://" + t); } catch (_) { return null; } })();
      if (!u || !/(^|\.)google\.[a-z.]+$/i.test(u.hostname) || !/^(www\.)?google\./i.test(u.hostname)) return null;
      if (u.pathname === "/search") { q = u.searchParams.get("q") || ""; images = u.searchParams.get("tbm") === "isch"; }
      else return { src: "https://www.google.com/webhp?igu=1", q: "" };
    }
    if (!q) return { src: images ? "https://www.google.com/imghp?igu=1" : "https://www.google.com/webhp?igu=1", q: "" };
    return { src: "https://www.google.com/search?igu=1&q=" + encodeURIComponent(q) + (images ? "&tbm=isch" : ""), q, images };
  }

  // ------------------------------------------------------------------ store
  const DEFAULTS = { bookmarks: true, favBar: "always", vertical: false, vtCollapsed: false, sleep: true, sleepMins: 15, startup: "restore", askWhere: false, dlFolder: ["Downloads"], dlAutoOpen: true, pdfEngine: "pdfjs", ntpBg: "image", ntpQuick: true, ntpFeed: true, colShots: false, showColBtn: true };
  const GROUP_COLORS = [["grey", "#7a7574"], ["blue", "#0f6cbd"], ["red", "#d13438"], ["yellow", "#c19c00"], ["green", "#107c10"], ["pink", "#e3008c"], ["purple", "#8764b8"], ["cyan", "#038387"], ["orange", "#ca5010"]];
  const gColor = (c) => (GROUP_COLORS.find((g) => g[0] === c) || GROUP_COLORS[1])[1];
  function bstore() {
    const d = (window.State && State.data) || {}; d.appData = d.appData || {};
    const b = d.appData.browser || (d.appData.browser = {});
    if (!Array.isArray(b.history)) b.history = [];
    if (!Array.isArray(b.favs)) b.favs = [];
    if (!Array.isArray(b.favFolders)) b.favFolders = [];
    if (!Array.isArray(b.collections)) b.collections = [];
    if (!Array.isArray(b.downloads)) b.downloads = [];
    if (!Array.isArray(b.closedTabs)) b.closedTabs = [];
    if (!b.sessions || typeof b.sessions !== "object") b.sessions = {};
    if (!b.pdfAnn || typeof b.pdfAnn !== "object") b.pdfAnn = {};
    const s = b.settings && typeof b.settings === "object" ? b.settings : (b.settings = {});
    if (!("favBar" in s) && s.bookmarks === false) s.favBar = "never";
    Object.keys(DEFAULTS).forEach((k) => { if (!(k in s)) s[k] = Array.isArray(DEFAULTS[k]) ? DEFAULTS[k].slice() : DEFAULTS[k]; });
    if (!b.favSeeded) {   // one-time: built-in bookmarks become real, editable favorites on the bar
      b.favSeeded = true;
      const old = b.favs.slice();
      b.favs = ((window.Catalog && Catalog.bookmarks) || []).map((x) => ({ id: uid(), label: x.label, url: x.url, folder: "bar", ts: Date.now() }));
      old.forEach((f) => { if (!b.favs.some((x) => x.url === f.url)) b.favs.push(Object.assign({ id: uid(), folder: "bar", ts: Date.now() }, f, { folder: f.folder || "bar" })); });
    }
    b.favs.forEach((f) => { if (!f.id) f.id = uid(); if (!f.folder) f.folder = "bar"; });
    if (!Array.isArray(b.quick)) b.quick = ((window.Catalog && Catalog.bookmarks) || []).slice(0, 7).map((x) => ({ label: x.label, url: x.url }));
    return b;
  }
  const bus = new EventTarget();
  const emit = (t) => { try { bus.dispatchEvent(new Event(t)); } catch (_) {} };
  function addHistory(label, url) {
    const b = bstore(); b.history = b.history.filter((h) => h.url !== url);
    b.history.unshift({ label: String(label || url).slice(0, 140), url, ts: Date.now() });
    b.history = b.history.slice(0, 500); save(); emit("hist");
  }
  function retitleHistory(url, title) { const h = bstore().history.find((x) => x.url === url); if (h && title && h.label !== title) { h.label = String(title).slice(0, 140); save(); emit("hist"); } }
  const notify = (msg, title) => { try { if (window.Notify) Notify.show({ icon: window.Icon ? Icon.mini("edge", "Microsoft Edge") : "", title: title || "Microsoft Edge", body: msg }); } catch (_) {} };
  const fmtSize = (n) => { n = +n || 0; if (n < 1024) return n + " B"; if (n < 1048576) return (n / 1024).toFixed(n < 10240 ? 1 : 0) + " KB"; return (n / 1048576).toFixed(1) + " MB"; };
  const dayLabel = (ts) => { const d = new Date(ts), t = new Date(); const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()), b = new Date(t.getFullYear(), t.getMonth(), t.getDate()); const n = Math.round((b - a) / 864e5); return n === 0 ? "Today" : n === 1 ? "Yesterday" : d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: d.getFullYear() === t.getFullYear() ? undefined : "numeric" }); };
  const timeLabel = (ts) => new Date(ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  // ------------------------------------------------------------------ favicons / titles
  function iconFor(url) {
    const u = String(url || "");
    const sp = resolveSpecial(u);
    if (sp === "home") return window.Icon ? Icon.mini("edge", "New tab") : IC.globe;
    if (sp) return siteIcon(sp);
    const iu = internalOf(u);
    if (iu) return ({ history: IC.history, favorites: IC.favs, downloads: IC.download, settings: IC.gear })[iu.page] || IC.globe;
    if (/^(search|images):/i.test(u)) return IC.search;
    if (/\.pdf($|[?#])/i.test(u) || /^file:/i.test(u)) return /\.pdf($|[?#])/i.test(u) ? PDF_ICON : IC.file;
    const h = hostOf(u);
    if (h && /^https?:|^[\w-]+(\.[\w-]+)+/i.test(u)) return `<img src="https://${esc(h)}/favicon.ico" alt="" onerror="this.replaceWith(document.createRange().createContextualFragment(this.dataset.fb))" data-fb="${esc(IC.globe)}">`;
    return IC.globe;
  }
  function titleFor(url) {
    const u = String(url || ""); const sp = resolveSpecial(u);
    if (sp === "home") return "New tab"; if (sp) return SITE_TITLE[sp] || sp;
    const iu = internalOf(u); if (iu) return ({ history: "History", favorites: "Favorites", downloads: "Downloads", settings: "Settings" })[iu.page] || u;
    const m = /^(search|images):(.*)$/i.exec(u); if (m) return m[2] + " - Search";
    if (/^file:/i.test(u)) { try { return decodeURIComponent(u.split("/").pop()); } catch (_) { return u; } }
    return hostOf(u).replace(/^www\./, "") || u;
  }

  // ------------------------------------------------------------------ VFS helpers
  function vroot() { return window.VFS && VFS.ensure ? VFS.ensure() : ((State.data.appData.files = State.data.appData.files || { root: {} }).root); }
  function nodeAt(path) { let ch = vroot(), n = null; for (let i = 0; i < path.length; i++) { n = ch && ch[path[i]]; if (!n) return null; if (i < path.length - 1) { if (n.type !== "folder") return null; ch = n.children; } } return n; }
  function kidsAt(path) { let ch = vroot(); for (const seg of path || []) { const n = ch[seg]; if (!n || n.type !== "folder") return null; ch = n.children; } return ch; }
  function ensureFolder(path) { let ch = vroot(); for (const seg of path || []) { if (!ch[seg] || ch[seg].type !== "folder") ch[seg] = { type: "folder", children: {}, ts: Date.now() }; ch = ch[seg].children; } return ch; }
  function uniqueIn(kids, name) { if (!kids[name]) return name; const m = /^(.*?)(\.[^.]+)?$/.exec(name); let i = 1, n; do { n = m[1] + " (" + (i++) + ")" + (m[2] || ""); } while (kids[n]); return n; }
  function findPath(target) {
    const walk = (ch, p) => { for (const k of Object.keys(ch || {})) { const n = ch[k]; if (n === target) return p.concat(k); if (n && n.type === "folder") { const r = walk(n.children, p.concat(k)); if (r) return r; } } return null; };
    return walk(vroot(), []);
  }
  const userName = () => { const p = (State.data && State.data.profile) || {}; return String(p.username || p.name || "User").replace(/[\\/:*?"<>|]/g, "").trim() || "User"; };
  function winPath(path) { if (window.FilesHelper && FilesHelper.winPath) return FilesHelper.winPath(path); return "C:\\Users\\" + userName() + "\\" + path.join("\\"); }
  function fileUrl(path) { return "file:///" + winPath(path).replace(/\\/g, "/").split("/").map((s, i) => (i === 0 ? s : encodeURIComponent(s))).join("/"); }
  function pathFromFileUrl(url) {
    let s = String(url).replace(/^file:\/+/i, ""); try { s = decodeURIComponent(s); } catch (_) {}
    if (window.FilesHelper && FilesHelper.parseWinPath) { const p = FilesHelper.parseWinPath(s.replace(/\//g, "\\")); if (p) return p; }
    const m = /^[a-z]:\/Users\/[^/]+\/(.*)$/i.exec(s); return m ? m[1].split("/").filter(Boolean) : null;
  }
  async function nodeBlob(node, name) {
    const mime = node.mime || (/\.pdf$/i.test(name || "") ? "application/pdf" : "application/octet-stream");
    if (node.blob && window.VFS && VFS.getBlob) { const b = await VFS.getBlob(node.blob); if (b) return b.type ? b : new Blob([b], { type: mime }); }
    const s = node.src || (typeof node.content === "string" && /^data:/.test(node.content) ? node.content : null);
    if (s) { const r = await fetch(s); const b = await r.blob(); return b.type ? b : new Blob([b], { type: mime }); }
    if (typeof node.content === "string") return new Blob([node.content], { type: mime });
    if (node._ze && node._ze.read) return new Blob([await node._ze.read()], { type: mime });
    throw new Error("This file's contents aren't on this device.");
  }
  const TEXT_EXT = ["txt", "md", "csv", "json", "html", "htm", "css", "js", "xml", "log"];
  const IMG_EXT = ["png", "jpg", "jpeg", "gif", "webp", "bmp"];
  async function nodeFor(blob, name) {
    const ext = (/\.([a-z0-9]+)$/i.exec(name) || [])[1]; const e = (ext || "").toLowerCase(); const now = Date.now();
    const mime = blob.type || ({ pdf: "application/pdf", zip: "application/zip", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", txt: "text/plain", html: "text/html", csv: "text/csv" })[e] || "application/octet-stream";
    if (TEXT_EXT.includes(e) && blob.size < 400000) return { type: "file", kind: "text", content: await blob.text(), size: blob.size, mime, ts: now, created: now, origin: "edge" };
    let id = null; try { if (window.VFS && VFS.putBlob && window.indexedDB) id = await VFS.putBlob(blob.type ? blob : new Blob([blob], { type: mime })); } catch (_) { id = null; }
    const n = { type: "file", kind: IMG_EXT.includes(e) ? "image" : "other", size: blob.size, mime, ts: now, created: now, origin: "edge" };
    if (id) n.blob = id;
    else if (blob.size <= 1.5 * 1048576) n.src = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
    else throw new Error("This file is too big to store on this device.");
    if (n.kind === "image" && window.FilesHelper && FilesHelper.imageThumb) { try { const t = await FilesHelper.imageThumb(blob); if (t) { n.w = t.w; n.h = t.h; if (id) n.src = t.thumb; } } catch (_) {} }
    return n;
  }

  // ------------------------------------------------------------------ small PDF writer (text pages) — used by sites (bank statement)
  function makeTextPDF(pages, opts) {
    opts = opts || {};
    const clean = (s) => String(s == null ? "" : s).replace(/[^\x20-\x7e]/g, "?").replace(/([\\()])/g, "\\$1");
    const enc = new TextEncoder(); const parts = []; let off = 0; const offs = [];
    const push = (s) => { const b = enc.encode(s); parts.push(b); off += b.length; };
    const obj = (id, body) => { offs[id] = off; push(id + " 0 obj\n" + body + "\nendobj\n"); };
    const n = pages.length;
    push("%PDF-1.4\n");
    obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
    obj(2, `<< /Type /Pages /Kids [${pages.map((_, i) => (4 + i * 2) + " 0 R").join(" ")}] /Count ${n} >>`);
    obj(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
    pages.forEach((lines, i) => {
      let cs = "BT /F1 11 Tf 15 TL 56 790 Td\n";
      (lines || []).forEach((ln, j) => { const big = j === 0 && opts.title !== false; cs += (big ? "/F1 18 Tf " : (j === 1 && opts.title !== false ? "/F1 11 Tf " : "")) + "(" + clean(ln) + ") Tj T*\n" + (big ? "T*\n" : ""); });
      cs += "ET";
      obj(4 + i * 2, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`);
      obj(5 + i * 2, `<< /Length ${enc.encode(cs).length} >>\nstream\n${cs}\nendstream`);
    });
    const total = 4 + n * 2, xref = off;
    let x = `xref\n0 ${total}\n0000000000 65535 f \n`; for (let i = 1; i < total; i++) x += String(offs[i]).padStart(10, "0") + " 00000 n \n";
    push(x + `trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    return new Blob(parts, { type: "application/pdf" });
  }

  // ------------------------------------------------------------------ popups (menus) — live at body level so they can leave the window
  const OPEN_POPS = new Set();
  function closePops() { [...OPEN_POPS].forEach((f) => f()); }
  function popMenu(items, at, o) {
    o = o || {}; closePops();
    const m = el(`<div class="eg-menu" role="menu"></div>`);
    let closed = false;
    const close = () => { if (closed) return; closed = true; m.remove(); OPEN_POPS.delete(close); document.removeEventListener("pointerdown", outside, true); window.removeEventListener("blur", close); document.removeEventListener("keydown", onKey, true); if (o.onClose) o.onClose(); };
    const build = (list, title, prev) => {
      m.innerHTML = "";
      if (title) { const b = el(`<button class="eg-mi eg-mi-back"><span class="eg-mi-ic">${IC.chevL}</span><span class="eg-mi-t">${esc(title)}</span></button>`); b.onclick = (e) => { e.stopPropagation(); build(prev.items, prev.title, prev.prev); }; m.appendChild(b); m.appendChild(el(`<div class="eg-msep"></div>`)); }
      list.forEach((it) => {
        if (!it) return;
        if (it.sep) { if (m.lastElementChild && !m.lastElementChild.classList.contains("eg-msep")) m.appendChild(el(`<div class="eg-msep"></div>`)); return; }
        if (it.node) { m.appendChild(it.node); return; }
        const b = el(`<button class="eg-mi${it.checked ? " checked" : ""}${it.danger ? " danger" : ""}" role="menuitem" data-a="${esc(it.id || "")}"${it.disabled ? " disabled" : ""}><span class="eg-mi-ic">${it.checked ? IC.check : it.icon || ""}</span><span class="eg-mi-t">${esc(it.label)}</span>${it.kbd ? `<span class="eg-mi-k">${esc(it.kbd)}</span>` : ""}${it.sub ? `<span class="eg-mi-k">${IC.chevR}</span>` : ""}</button>`);
        b.onclick = (e) => { e.stopPropagation(); if (it.sub) { build(it.sub(), it.label, { items: list, title, prev }); place(); return; } close(); if (it.run) it.run(); };
        m.appendChild(b);
      });
      while (m.lastElementChild && m.lastElementChild.classList.contains("eg-msep")) m.lastElementChild.remove();
    };
    build(items);
    document.body.appendChild(m);
    function place() {
      let x, y;
      if (at && at.getBoundingClientRect) { const r = at.getBoundingClientRect(); x = o.alignLeft ? r.left : r.right - m.offsetWidth; y = r.bottom + 4; }
      else { x = at.x; y = at.y; }
      x = Math.max(6, Math.min(x, innerWidth - m.offsetWidth - 6)); if (y + m.offsetHeight > innerHeight - 6) y = Math.max(6, innerHeight - m.offsetHeight - 6);
      m.style.left = x + "px"; m.style.top = y + "px";
    }
    place();
    const outside = (e) => { if (!m.contains(e.target) && !(o.trigger && o.trigger.contains(e.target))) close(); };
    const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); close(); } };
    setTimeout(() => { if (!closed) { document.addEventListener("pointerdown", outside, true); window.addEventListener("blur", close); document.addEventListener("keydown", onKey, true); } }, 0);
    OPEN_POPS.add(close);
    return { el: m, close };
  }

  // In-window modal (prompts, Save As, confirmations)
  function modal(host, html, o) {
    o = o || {};
    host.querySelectorAll(":scope > .eg-modal").forEach((x) => x.remove());
    const m = el(`<div class="eg-modal"><div class="eg-dlg ${o.cls || ""}" role="dialog" aria-modal="true">${html}</div></div>`);
    const close = () => { m.remove(); };
    m.addEventListener("pointerdown", (e) => { if (e.target === m && o.dismiss !== false) { close(); if (o.onCancel) o.onCancel(); } });
    m.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Escape") { close(); if (o.onCancel) o.onCancel(); } });
    host.appendChild(m);
    setTimeout(() => { const f = m.querySelector("input:not([type=checkbox]),select,button.eg-primary"); if (f) { try { f.focus(); if (f.select) f.select(); } catch (_) {} } }, 30);
    return { el: m, dlg: m.firstElementChild, close };
  }
  function promptDlg(host, title, fields, okLabel) {
    return new Promise((res) => {
      const md = modal(host, `<h3>${esc(title)}</h3>${fields.map((f, i) => `<label class="eg-fld"><span>${esc(f.label)}</span><input data-i="${i}" value="${esc(f.value || "")}" placeholder="${esc(f.placeholder || "")}"></label>`).join("")}
        <div class="eg-dlg-btns"><button class="eg-btn eg-cancel">Cancel</button><button class="eg-btn eg-primary eg-ok">${esc(okLabel || "Save")}</button></div>`, { onCancel: () => res(null) });
      const done = () => { const v = [...md.el.querySelectorAll("input[data-i]")].map((x) => x.value.trim()); md.close(); res(v); };
      md.el.querySelector(".eg-ok").onclick = done;
      md.el.querySelector(".eg-cancel").onclick = () => { md.close(); res(null); };
      md.el.querySelectorAll("input").forEach((x) => x.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); done(); } }));
    });
  }
  function confirmDlg(host, title, text, okLabel) {
    return new Promise((res) => {
      const md = modal(host, `<h3>${esc(title)}</h3><p class="eg-dlg-p">${text}</p><div class="eg-dlg-btns"><button class="eg-btn eg-cancel">Cancel</button><button class="eg-btn eg-primary eg-ok">${esc(okLabel || "OK")}</button></div>`, { onCancel: () => res(false) });
      md.el.querySelector(".eg-ok").onclick = () => { md.close(); res(true); };
      md.el.querySelector(".eg-cancel").onclick = () => { md.close(); res(false); };
    });
  }
  // Save As / choose folder on the virtual file system.
  function saveAsDialog(host, o) {
    o = o || {};
    return new Promise((res) => {
      let path = (o.folder || ["Downloads"]).slice(); if (!kidsAt(path)) path = ["Downloads"];
      const md = modal(host, `<h3>${esc(o.title || (o.folderOnly ? "Choose a folder" : "Save As"))}</h3>
        <div class="eg-sa"><div class="eg-sa-side"></div><div class="eg-sa-main"><div class="eg-sa-crumbs"></div><div class="eg-sa-list"></div></div></div>
        ${o.folderOnly ? "" : `<label class="eg-fld eg-sa-fn"><span>File name</span><input class="eg-sa-name" value="${esc(o.name || "download")}"></label>`}
        <div class="eg-dlg-btns"><button class="eg-btn eg-sa-new">${IC.folder}<span>New folder</span></button><span class="eg-grow"></span><button class="eg-btn eg-cancel">Cancel</button><button class="eg-btn eg-primary eg-sa-ok">${o.folderOnly ? "Select folder" : "Save"}</button></div>`, { cls: "eg-saveas", onCancel: () => res(null) });
      const root = md.el; const side = root.querySelector(".eg-sa-side"), crumbs = root.querySelector(".eg-sa-crumbs"), list = root.querySelector(".eg-sa-list");
      const tops = Object.keys(vroot()).filter((k) => vroot()[k] && vroot()[k].type === "folder");
      tops.forEach((k) => { const b = el(`<button class="eg-sa-q" data-folder="${esc(k)}">${IC.folder}<span>${esc(k)}</span></button>`); b.onclick = () => { path = [k]; paint(); }; side.appendChild(b); });
      function paint() {
        crumbs.innerHTML = ""; const mk = (label, p) => { const c = el(`<button class="eg-sa-crumb">${esc(label)}</button>`); c.onclick = () => { if (p.length) { path = p; paint(); } }; crumbs.appendChild(c); };
        mk(userName(), []); path.forEach((seg, i) => { crumbs.appendChild(el(`<span class="eg-sa-sep">›</span>`)); mk(seg, path.slice(0, i + 1)); });
        side.querySelectorAll(".eg-sa-q").forEach((b) => b.classList.toggle("on", b.dataset.folder === path[0]));
        const kids = kidsAt(path) || {}; list.innerHTML = "";
        const names = Object.keys(kids).sort((a, b) => (kids[b].type === "folder") - (kids[a].type === "folder") || a.localeCompare(b));
        if (!names.length) list.appendChild(el(`<div class="eg-empty-s">This folder is empty.</div>`));
        names.forEach((nm) => {
          const f = kids[nm].type === "folder";
          const r = el(`<button class="eg-sa-row ${f ? "" : "file"}" ${f ? `data-folder="${esc(nm)}"` : ""}>${f ? IC.folder : IC.file}<span>${esc(nm)}</span></button>`);
          r.onclick = () => { if (f) { path = path.concat(nm); paint(); } else { const inp = root.querySelector(".eg-sa-name"); if (inp) inp.value = nm; } };
          list.appendChild(r);
        });
      }
      root.querySelector(".eg-sa-new").onclick = async () => {
        const v = await promptDlg(root.querySelector(".eg-dlg"), "New folder", [{ label: "Folder name", value: "New folder" }], "Create");
        if (!v || !v[0]) return; const kids = kidsAt(path); if (!kids) return; const nm = uniqueIn(kids, v[0].replace(/[\\/:*?"<>|]/g, "")); kids[nm] = { type: "folder", children: {}, ts: Date.now() }; vfsChanged(); path = path.concat(nm); paint();
      };
      root.querySelector(".eg-cancel").onclick = () => { md.close(); res(null); };
      root.querySelector(".eg-sa-ok").onclick = () => {
        let name = null;
        if (!o.folderOnly) { name = (root.querySelector(".eg-sa-name").value || "").trim().replace(/[\\/:*?"<>|]/g, "_"); if (!name) return; const ext = (/\.[a-z0-9]+$/i.exec(o.name || "") || [""])[0]; if (ext && !/\.[a-z0-9]+$/i.test(name)) name += ext; }
        md.close(); res({ folder: path.slice(), name });
      };
      const nm = root.querySelector(".eg-sa-name"); if (nm) nm.addEventListener("keydown", (e) => { if (e.key === "Enter") root.querySelector(".eg-sa-ok").click(); });
      paint();
    });
  }

  // ------------------------------------------------------------------ downloads engine (shared by every window)
  const DL_LIVE = new Map();   // id -> AbortController
  const DL_EXT = /\.(zip|rar|7z|tar|gz|exe|msi|dmg|pkg|apk|iso|mp3|wav|flac|ogg|m4a|docx?|xlsx?|pptx?|csv|epub|ics|vcf|torrent)$/i;
  function nameFromUrl(url, mime) {
    let n = ""; try { const u = new URL(url); if (/^https?:|^file:/i.test(u.protocol)) n = decodeURIComponent(u.pathname.split("/").pop() || ""); } catch (_) {}
    if (!n || !/\./.test(n)) { const ext = ({ "application/pdf": ".pdf", "image/png": ".png", "image/jpeg": ".jpg", "text/plain": ".txt", "text/html": ".html", "application/zip": ".zip", "text/csv": ".csv" })[mime] || ""; n = (n || "download") + ext; }
    return n.replace(/[\\/:*?"<>|]/g, "_").slice(0, 120);
  }
  async function fetchWithProgress(url, onP, signal) {
    const r = await fetch(url, { signal, credentials: "same-origin" });
    if (!r.ok) throw new Error("The server answered " + r.status + " " + (r.statusText || "") + ".");
    const total = +r.headers.get("content-length") || 0, type = (r.headers.get("content-type") || "").split(";")[0];
    if (!r.body || !r.body.getReader) { const b = await r.blob(); onP(b.size, b.size); return b; }
    const rd = r.body.getReader(); const chunks = []; let got = 0;
    for (;;) { const { done, value } = await rd.read(); if (done) break; chunks.push(value); got += value.length; onP(got, total); }
    return new Blob(chunks, { type });
  }
  let dlEmitT = 0; const dlEmitSoon = () => { if (dlEmitT) return; dlEmitT = setTimeout(() => { dlEmitT = 0; emit("dl"); }, 120); };
  async function startDownload(src, ctl) {
    const b = bstore(), S = b.settings;
    const item = { id: uid(), name: src.name || nameFromUrl(src.url || "", src.blob && src.blob.type), url: src.blob ? (src.url && !/^blob:/.test(src.url) ? src.url : "") : (src.url || ""), from: src.from || "", state: "progress", received: 0, total: src.blob ? src.blob.size : 0, ts: Date.now() };
    let folder = (S.dlFolder || ["Downloads"]).slice();
    if (S.askWhere && !src.noAsk && ctl) {
      const r = await saveAsDialog(ctl.shell, { name: item.name, folder, title: "Save As" });
      if (!r) return null;
      folder = r.folder; item.name = r.name;
    }
    b.downloads.unshift(item); b.downloads = b.downloads.slice(0, 120); save(); emit("dl");
    if (ctl && !src.quiet) ctl.showDownloads(true);
    const ac = new AbortController(); DL_LIVE.set(item.id, ac);
    try {
      let blob = src.blob;
      if (!blob) {
        if (!item.url) throw new Error("There's nothing to download.");
        try { blob = await fetchWithProgress(item.url, (got, tot) => { item.received = got; item.total = tot; dlEmitSoon(); }, ac.signal); }
        catch (e) { if (e && e.name === "AbortError") throw e; if (/^https?:/i.test(item.url) && e instanceof TypeError) { const x = new Error("This website doesn't let other pages download its files (it doesn't allow cross-origin requests)."); x.cors = true; throw x; } throw e; }
      }
      if (!blob.type && /\.pdf$/i.test(item.name)) blob = new Blob([blob], { type: "application/pdf" });
      if (!/\.[a-z0-9]{1,5}$/i.test(item.name)) item.name = nameFromUrl("x:/" + item.name, blob.type);
      const node = await nodeFor(blob, item.name);
      const kids = ensureFolder(folder); const nm = uniqueIn(kids, item.name); kids[nm] = node;
      Object.assign(item, { name: nm, path: folder.concat(nm), state: "done", received: blob.size, total: blob.size, mime: node.mime, size: blob.size, done: Date.now() });
      vfsChanged();
    } catch (e) {
      item.state = e && e.name === "AbortError" ? "cancelled" : "failed"; item.err = e && e.name === "AbortError" ? "Canceled" : String((e && e.message) || e); item.cors = !!(e && e.cors);
    }
    DL_LIVE.delete(item.id); save(); emit("dl");
    if (item.state === "done" && ctl && !src.quiet) ctl.showDownloads(true);
    return item;
  }
  function dlNode(it) { return it.path ? nodeAt(it.path) : null; }
  function dlStatus(it) {
    if (it.state === "progress") return (it.total ? fmtSize(it.received) + " of " + fmtSize(it.total) : fmtSize(it.received)) + " · Downloading…";
    if (it.state === "failed") return "Failed — " + (it.err || "Network error");
    if (it.state === "cancelled") return "Canceled";
    if (!dlNode(it)) return "Deleted";
    return fmtSize(it.size || it.total) + " · " + (it.path ? winPath(it.path.slice(0, -1)).replace(/^C:\\Users\\[^\\]+\\/, "") : "");
  }
  function dlOpen(it, ctl) {
    const n = dlNode(it); if (!n) { notify("This file was moved or deleted."); return; }
    if (/\.pdf$/i.test(it.name) || n.mime === "application/pdf") { const c = ctl || pickCtl(); if (c) { c.openTab(fileUrl(it.path), { activate: true }); return; } }
    if (window.FilesHelper && FilesHelper.openFile) FilesHelper.openFile(it.name, n, it.path); else if (window.VFS) VFS.openNode(it.name, n);
  }
  function dlShow(it) { if (!it.path) return; if (window.FilesHelper && FilesHelper.open) FilesHelper.open(it.path.slice(0, -1)); else { window.FilesStartPath = it.path.slice(0, -1); WM.open("fileexplorer"); } }
  function dlDelete(it) {
    if (it.path && dlNode(it)) { if (window.FilesHelper && FilesHelper.recycle) FilesHelper.recycle(it.path); else { const k = kidsAt(it.path.slice(0, -1)); if (k) delete k[it.path[it.path.length - 1]]; vfsChanged(); } }
    it.deleted = true; save(); emit("dl");
  }
  function dlRemove(it) { const b = bstore(); b.downloads = b.downloads.filter((x) => x !== it); save(); emit("dl"); }
  function dlRetry(it, ctl) { dlRemove(it); startDownload({ url: it.url, name: it.name.replace(/ \(\d+\)(?=\.[^.]+$)/, ""), from: it.from }, ctl); }
  function dlCancel(it) { const ac = DL_LIVE.get(it.id); if (ac) ac.abort(); }
  function dlRow(it, ctl, big) {
    const n = dlNode(it), isPdf = /\.pdf$/i.test(it.name);
    const pct = it.total ? Math.min(100, Math.round((it.received / it.total) * 100)) : 0;
    const r = el(`<div class="eg-dl ${it.state}${it.state === "done" && !n ? " gone" : ""}" data-id="${esc(it.id)}">
      <span class="eg-dl-ic">${window.FilesHelper && FilesHelper.glyph && n ? FilesHelper.glyph(it.name, n, big ? 32 : 28) : isPdf ? PDF_ICON : IC.file}</span>
      <div class="eg-dl-b"><button class="eg-dl-n" ${it.state === "done" && n ? "" : "disabled"} title="Open file">${esc(it.name)}</button>
        ${it.state === "progress" ? `<div class="eg-dl-bar"><i style="width:${it.total ? pct : 30}%"${it.total ? "" : ' class="ind"'}></i></div>` : ""}
        <div class="eg-dl-s">${esc(dlStatus(it))}</div>
        ${big && (it.url || it.from) ? `<div class="eg-dl-u">${esc(it.url && !/^(blob|data):/i.test(it.url) ? it.url.slice(0, 160) : "From " + String(it.from || "this page").replace(/^https?:\/\//, "").slice(0, 120))}</div>` : ""}
        ${it.cors && it.url ? `<a class="eg-dl-real" href="${esc(it.url)}" target="_blank" rel="noopener" data-real>Open in a real tab to download ↗</a>` : ""}</div>
      <div class="eg-dl-acts"></div></div>`);
    const acts = r.querySelector(".eg-dl-acts");
    const btn = (ic, t, f, cls) => { const b = el(`<button class="eg-ib ${cls || ""}" title="${esc(t)}" aria-label="${esc(t)}">${ic}</button>`); b.onclick = (e) => { e.stopPropagation(); f(); }; acts.appendChild(b); };
    if (it.state === "progress") btn(IC.cancel, "Cancel", () => dlCancel(it), "eg-dl-cancel");
    if (it.state === "failed" || it.state === "cancelled") { if (it.url) btn(IC.retry, "Retry", () => dlRetry(it, ctl), "eg-dl-retry"); }
    if (it.state === "done" && n) { btn(IC.folder, "Show in folder", () => { dlShow(it); if (!big && ctl && ctl.closeFly) ctl.closeFly(); }, "eg-dl-show"); btn(IC.trash, "Delete file", () => dlDelete(it), "eg-dl-del"); }
    if (it.state !== "progress") btn(IC.close, "Remove from list", () => dlRemove(it), "eg-dl-rm");
    r.querySelector(".eg-dl-n").onclick = () => { dlOpen(it, ctl); if (!big && ctl && ctl.closeFly) ctl.closeFly(); };
    return r;
  }

  // ------------------------------------------------------------------ favorites helpers
  const FAV_ROOTS = [{ id: "bar", name: "Favorites bar" }, { id: "other", name: "Other favorites" }];
  const folderName = (id) => (FAV_ROOTS.find((r) => r.id === id) || bstore().favFolders.find((f) => f.id === id) || { name: "Favorites" }).name;
  const subFolders = (pid) => bstore().favFolders.filter((f) => f.parent === pid);
  const favsIn = (fid) => bstore().favs.filter((f) => f.folder === fid);
  const allFolders = () => { const out = []; const walk = (id, depth) => { out.push({ id, name: folderName(id), depth }); subFolders(id).forEach((f) => walk(f.id, depth + 1)); }; FAV_ROOTS.forEach((r) => walk(r.id, 0)); return out; };
  function deleteFolder(id) { const b = bstore(); subFolders(id).forEach((f) => deleteFolder(f.id)); b.favs = b.favs.filter((f) => f.folder !== id); b.favFolders = b.favFolders.filter((f) => f.id !== id); }
  function moveFav(favId, folder, beforeId) {
    const b = bstore(); const i = b.favs.findIndex((f) => f.id === favId); if (i < 0) return; const [f] = b.favs.splice(i, 1); f.folder = folder;
    let j = beforeId ? b.favs.findIndex((x) => x.id === beforeId) : -1; if (j < 0) { const last = b.favs.map((x) => x.folder).lastIndexOf(folder); j = last + 1; if (j <= 0) j = b.favs.length; }
    b.favs.splice(j, 0, f); save(); emit("fav");
  }
  function exportBookmarks() {
    const ts = Math.floor(Date.now() / 1000);
    const href = (u) => /^[a-z][\w+.-]*:/i.test(u) ? u : (resolveSpecial(u) ? "https://" + u.replace(/^https?:\/\//, "") : "https://" + u);
    const walk = (fid, ind) => {
      let s = "";
      subFolders(fid).forEach((f) => { s += `${ind}<DT><H3 ADD_DATE="${ts}" LAST_MODIFIED="${ts}">${esc(f.name)}</H3>\n${ind}<DL><p>\n${walk(f.id, ind + "    ")}${ind}</DL><p>\n`; });
      favsIn(fid).forEach((f) => { s += `${ind}<DT><A HREF="${esc(href(f.url))}" ADD_DATE="${Math.floor((f.ts || Date.now()) / 1000)}">${esc(f.label)}</A>\n`; });
      return s;
    };
    return `<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<!-- This is an automatically generated file.\n     It will be read and overwritten.\n     DO NOT EDIT! -->\n<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n<TITLE>Bookmarks</TITLE>\n<H1>Bookmarks</H1>\n<DL><p>\n    <DT><H3 ADD_DATE="${ts}" LAST_MODIFIED="${ts}" PERSONAL_TOOLBAR_FOLDER="true">Favorites bar</H3>\n    <DL><p>\n${walk("bar", "        ")}    </DL><p>\n    <DT><H3 ADD_DATE="${ts}" LAST_MODIFIED="${ts}">Other favorites</H3>\n    <DL><p>\n${walk("other", "        ")}    </DL><p>\n</DL><p>\n`;
  }
  function importBookmarks(html) {
    const b = bstore(); const doc = new DOMParser().parseFromString(String(html), "text/html");
    const top = doc.querySelector("dl"); if (!top) throw new Error("This doesn't look like a bookmarks (favorites) HTML file.");
    const dest = { id: "f" + uid(), name: "Imported favorites", parent: "bar" }; b.favFolders.push(dest);
    let count = 0;
    const walk = (dl, fid) => {
      [...dl.children].forEach((dt) => {
        if (dt.tagName !== "DT") return;
        const h3 = dt.querySelector(":scope > h3"), a = dt.querySelector(":scope > a");
        if (h3) {
          const sub = dt.querySelector(":scope > dl") || (dt.nextElementSibling && dt.nextElementSibling.tagName === "DL" ? dt.nextElementSibling : null);
          const f = { id: "f" + uid(), name: (h3.textContent || "Folder").trim().slice(0, 80), parent: fid }; b.favFolders.push(f);
          if (sub) walk(sub, f.id);
        } else if (a) { const u = a.getAttribute("href") || ""; if (!u || /^javascript:/i.test(u)) return; b.favs.push({ id: uid(), label: (a.textContent || u).trim().slice(0, 140), url: u.replace(/^https:\/\/([a-z]+\.local)\/?$/i, "$1"), folder: fid, ts: (+a.getAttribute("add_date") || 0) * 1000 || Date.now() }); count++; }
      });
    };
    walk(top, dest.id);
    // flatten a single wrapper folder ("Favorites bar" from another browser) into the import folder
    save(); emit("fav"); return count;
  }

  // ------------------------------------------------------------------ collections helpers
  function colExportHTML(c) {
    return `<!DOCTYPE html>\n<html><head><meta charset="utf-8"><title>${esc(c.name)}</title><style>body{font-family:Segoe UI,system-ui,sans-serif;max-width:760px;margin:32px auto;padding:0 16px;color:#1b1b1b}li{margin:10px 0}small{color:#666}blockquote{margin:4px 0 0;padding:6px 10px;border-left:3px solid #0f6cbd;background:#f3f7fb}</style></head><body>\n<h1>${esc(c.name)}</h1>\n<p><small>Exported from Microsoft Edge Collections · ${esc(new Date().toLocaleString())}</small></p>\n<ol>\n${c.items.map((it) => it.kind === "note" ? `<li><blockquote>${esc(it.note)}</blockquote></li>` : `<li><a href="${esc(/^[a-z][\w+.-]*:/i.test(it.url) ? it.url : "https://" + it.url)}">${esc(it.title)}</a> <small>${esc(it.url)}</small>${it.note ? `<blockquote>${esc(it.note)}</blockquote>` : ""}</li>`).join("\n")}\n</ol>\n</body></html>\n`;
  }
  function colExportText(c) { return c.name + "\n" + "=".repeat(Math.min(60, c.name.length)) + "\n\n" + c.items.map((it, i) => it.kind === "note" ? `${i + 1}. Note: ${it.note}` : `${i + 1}. ${it.title}\n   ${it.url}${it.note ? "\n   Note: " + it.note : ""}`).join("\n\n") + "\n"; }
  const shotCache = new Map();
  function shotURL(id) { if (shotCache.has(id)) return shotCache.get(id); const p = (window.VFS && VFS.getBlob ? VFS.getBlob(id) : Promise.resolve(null)).then((b) => (b ? URL.createObjectURL(b) : null)).catch(() => null); shotCache.set(id, p); return p; }

  // generic pointer-based reordering (mouse + touch) with a grip handle
  function sortable(list, o) {
    list.addEventListener("pointerdown", (e) => {
      const h = e.target.closest && e.target.closest(o.handle); if (!h || !list.contains(h) || (e.pointerType === "mouse" && e.button)) return;
      const it = h.closest(o.item); if (!it) return;
      const items = [...list.querySelectorAll(o.item)]; const from = items.indexOf(it); if (from < 0) return;
      e.preventDefault(); e.stopPropagation(); try { h.setPointerCapture(e.pointerId); } catch (_) {}
      const y0 = e.clientY; let to = from, target = null, moved = false;
      const clear = () => { items.forEach((x) => x.classList.remove("eg-drop-before", "eg-drop-after")); if (o.targets) o.targets().forEach((t) => t.classList.remove("eg-drop-into")); };
      const move = (ev) => {
        if (ev.pointerId !== e.pointerId) return;
        if (!moved && Math.abs(ev.clientY - y0) < 4) return; moved = true;
        it.classList.add("eg-dragging"); it.style.transform = `translateY(${ev.clientY - y0}px)`;
        to = from; items.forEach((x, i) => { if (x === it) return; const r = x.getBoundingClientRect(), mid = r.top + r.height / 2; if (i < from && ev.clientY < mid) to = Math.min(to, i); if (i > from && ev.clientY > mid) to = Math.max(to, i); });
        clear(); target = null;
        if (o.targets) target = o.targets().find((t) => { const r = t.getBoundingClientRect(); return ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom; }) || null;
        if (target) target.classList.add("eg-drop-into"); else if (to !== from) items[to].classList.add(to < from ? "eg-drop-before" : "eg-drop-after");
      };
      const up = () => { h.removeEventListener("pointermove", move); h.removeEventListener("pointerup", up); h.removeEventListener("pointercancel", up); it.classList.remove("eg-dragging"); it.style.transform = ""; clear(); if (!moved) return; if (target && o.onTarget) o.onTarget(from, target); else if (to !== from) o.onMove(from, to); };
      h.addEventListener("pointermove", move); h.addEventListener("pointerup", up); h.addEventListener("pointercancel", up);
    });
  }

  // touch long-press (iPad has no right-click): fires fn once the finger rests ~0.55 s without moving
  function longPress(node, fn) {
    node.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse") return;
      const x0 = e.clientX, y0 = e.clientY;
      const tm = setTimeout(() => { node.__lp = true; fn(e); }, 550);
      const end = () => { clearTimeout(tm); node.removeEventListener("pointerup", end); node.removeEventListener("pointercancel", end); node.removeEventListener("pointermove", mv); };
      const mv = (ev) => { if (Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) > 10) end(); };
      node.addEventListener("pointerup", end); node.addEventListener("pointercancel", end); node.addEventListener("pointermove", mv);
    });
  }

  // ------------------------------------------------------------------ PDF module (lazy)
  let pdfModP = null;
  function loadPdfModule() {
    if (window.EdgePDF) return Promise.resolve(window.EdgePDF);
    if (pdfModP) return pdfModP;
    pdfModP = new Promise((res, rej) => { const s = document.createElement("script"); s.src = "js/edge-pdf.js" + VQ; s.onload = () => (window.EdgePDF ? res(window.EdgePDF) : rej(new Error("PDF viewer missing"))); s.onerror = () => { pdfModP = null; rej(new Error("Couldn't load the PDF viewer.")); }; document.head.appendChild(s); });
    return pdfModP;
  }

  // ------------------------------------------------------------------ Google home (Chrome new tab)
  function renderHome(ctx) {
    const colors = ["#4285F4", "#EA4335", "#FBBC05", "#4285F4", "#34A853", "#EA4335"];
    const letters = "Google".split("").map((ch, i) => `<span style="color:${colors[i]}">${ch}</span>`).join("");
    const page = el(`<div class="google-home">
      <div class="google-top">
        <a class="g-top-link" data-url="app:gmail">Gmail</a>
        <a class="g-top-link" data-url="images:">Images</a>
        <button class="g-apps" title="Google apps"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><circle cx="5" cy="5" r="1.8"/><circle cx="12" cy="5" r="1.8"/><circle cx="19" cy="5" r="1.8"/><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/><circle cx="5" cy="19" r="1.8"/><circle cx="12" cy="19" r="1.8"/><circle cx="19" cy="19" r="1.8"/></svg></button>
      </div>
      <div class="google-logo">${letters}</div>
      <form class="searchbar" autocomplete="off">
        <div class="searchbar-wrapper">
          <div class="searchbar-left"><div class="search-icon-wrapper"><span class="search-icon searchbar-icon">
            <svg focusable="false" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"></path></svg>
          </span></div></div>
          <div class="searchbar-center"><input class="searchbar-input" type="text" placeholder="Search Google or type a URL"></div>
          <div class="searchbar-right">
            <button type="button" class="voice-search" title="Voice search">
              <svg class="searchbar-icon" viewBox="0 0 24 24" style="height:24px;width:24px"><path fill="#4285f4" d="M12 15c1.66 0 3-1.31 3-2.97V5c0-1.66-1.34-3-3-3S9 3.34 9 5v7.03C9 13.69 10.34 15 12 15z"></path><path fill="#34a853" d="M11 18.08h2V21h-2z"></path><path fill="#fbbc05" d="M7.05 16.87C5.78 15.59 5 13.83 5 12h2c0 2.76 2.24 5 5 5s5-2.24 5-5h2c0 1.83-.78 3.59-2.05 4.87z" transform="translate(0 -1)"></path><path fill="#ea4335" d="M12 17c-2.76 0-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-2.08c3.39-.49 6-3.39 6-6.92h-2c0 2.76-2.24 5-5 5z"></path></svg>
            </button>
          </div>
        </div>
      </form>
      <div class="google-shortcuts"></div>
    </div>`);
    const shortcuts = page.querySelector(".google-shortcuts");
    (window.Catalog ? Catalog.bookmarks : []).forEach((b) => {
      const sc = el(`<button class="google-sc"><span class="g-sc-ic">${Icon.md(b.label.toLowerCase(), b.label)}</span><span class="g-sc-lb">${esc(b.label)}</span></button>`);
      sc.onclick = () => ctx.navigate(b.url); shortcuts.appendChild(sc);
    });
    const input = page.querySelector(".searchbar-input");
    page.querySelector("form").onsubmit = (e) => { e.preventDefault(); const q = input.value.trim(); if (q) ctx.navigate(q); };
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    page.querySelector(".voice-search").onclick = () => {
      if (!SR) { input.focus(); return; }
      try { const rec = new SR(); rec.lang = "en-US"; rec.interimResults = false; rec.onresult = (ev) => { input.value = ev.results[0][0].transcript; ctx.navigate(input.value.trim()); }; rec.start(); } catch (_) { input.focus(); }
    };
    page.querySelectorAll(".g-top-link").forEach((a) => a.onclick = () => { const u = a.dataset.url; if (u.startsWith("app:")) { if (window.WM) WM.open(u.slice(4)); } else ctx.navigate(u); });
    const G_APPS = [{ n: "Classroom", img: "assets/gapp_classroom.png" }, { n: "Gmail", img: "assets/gapp_gmail.png" }, { n: "Meet", img: "assets/gapp_meet.png" }, { n: "Calendar", img: "assets/gapp_calendar.png" }, { n: "Drive", img: "assets/gapp_drive.png" }, { n: "Maps", img: "assets/gapp_maps.png" }, { n: "Sheets", img: "assets/gapp_sheets.png" }];
    page.querySelector(".g-apps").onclick = (ev) => {
      ev.stopPropagation(); page.querySelectorAll(".g-apps-pop").forEach((m) => m.remove());
      const pop = el(`<div class="g-apps-pop"><div class="g-apps-grid">${G_APPS.map((a) => `<button class="g-app"><span class="g-app-ic g-app-ic-img"><img src="${a.img}?v=1" alt=""></span><span class="g-app-n">${a.n}</span></button>`).join("")}</div></div>`);
      pop.querySelectorAll(".g-app").forEach((b, i) => b.onclick = () => { pop.remove(); const n = G_APPS[i] && G_APPS[i].n; if (n === "Classroom" && window.AppRegistry.classroom) WM.open("classroom"); else if (n === "Gmail" && window.AppRegistry.gmail) WM.open("gmail"); else if (n === "Calendar" && window.AppRegistry.calendar) WM.open("calendar"); });
      page.querySelector(".google-top").appendChild(pop);
      setTimeout(() => document.addEventListener("pointerdown", function h(x) { if (!pop.contains(x.target)) { pop.remove(); document.removeEventListener("pointerdown", h); } }), 0);
    };
    ctx.page.appendChild(page);
  }

  // ------------------------------------------------------------------ the browser window
  const CTLS = new Set();
  function pickCtl(edgeOnly) {
    return [...CTLS].filter((c) => c.win.isConnected && c.win.getClientRects().length && (!edgeOnly || c.isEdge)).sort((a, b) => b.lastFocus - a.lastFocus)[0] || null;
  }

  function openBrowser(createWindow, startUrl, opts) {
    opts = opts || {};
    const appId = opts.appId || "browser";
    const isEdge = appId !== "chrome";
    const NAME = isEdge ? "Microsoft Edge" : "Google Chrome";
    const SCHEME = isEdge ? "edge" : "chrome";
    const B = bstore(), S = B.settings;
    const ref = createWindow({ title: opts.title || NAME, icon: opts.icon || Icon.mini(isEdge ? "edge" : "chrome", NAME), width: Math.max(360, Math.min(1000, innerWidth - 40)), height: Math.max(300, Math.min(680, innerHeight - 90)), appId, onClose: () => destroy() });
    const { body, win } = ref;
    win.classList.add("eg-win", isEdge ? "eg-edge" : "eg-chrome");
    body.classList.add("eg-body");
    body.innerHTML = `
      <div class="eg-shell" tabindex="-1">
        <div class="browser-bar">
          <button class="bb-nav back" title="Back (Alt+Left)" aria-label="Back">${IC.back}</button>
          <button class="bb-nav fwd" title="Forward (Alt+Right)" aria-label="Forward">${IC.fwd}</button>
          <button class="bb-nav reload" title="Refresh (Ctrl+R)" aria-label="Refresh">${IC.reload}</button>
          <button class="bb-nav home-btn" title="Home" aria-label="Home">${IC.home}</button>
          <div class="addr"><button class="eg-site" title="View site information"><span class="lock muted"></span></button><input class="url" placeholder="${isEdge ? "Search or enter web address" : "Search Google or type a URL"}" spellcheck="false" autocapitalize="off" autocomplete="off"><button class="bb-ic bb-fav" title="${isEdge ? "Add this page to favorites (Ctrl+D)" : "Bookmark this tab (Ctrl+D)"}" aria-label="Add to favorites">${IC.star}</button></div>
          <button class="bb-ic bb-read" title="Read aloud (Ctrl+Shift+U)" aria-label="Read aloud">${IC.read}</button>
          <button class="bb-ic bb-favs" title="${isEdge ? "Favorites (Ctrl+Shift+O)" : "Bookmarks"}" aria-label="Favorites">${IC.favs}</button>
          ${isEdge ? `<button class="bb-ic bb-collections" title="Collections (Ctrl+Shift+Y)" aria-label="Collections">${IC.collections}</button>` : ""}
          <button class="bb-ic bb-dl" title="Downloads (Ctrl+J)" aria-label="Downloads" hidden>${IC.download}<i class="eg-dl-ring"></i></button>
          <button class="bb-ic bb-menu" title="Settings and more (Alt+F)" aria-label="Settings and more">${IC.more}</button>
        </div>
        <div class="bookmark-bar eg-favbar"></div>
        <div class="eg-main">
          <div class="eg-vt" hidden></div>
          <div class="eg-panes"></div>
          <aside class="eg-side" hidden></aside>
        </div>
      </div>`;
    const shell = body.querySelector(".eg-shell");
    const bar = body.querySelector(".browser-bar");
    const urlInput = body.querySelector(".url");
    const lock = body.querySelector(".lock");
    const siteBtn = body.querySelector(".eg-site");
    const favBtn = body.querySelector(".bb-fav");
    const favBar = body.querySelector(".eg-favbar");
    const panesEl = body.querySelector(".eg-panes");
    const vtHost = body.querySelector(".eg-vt");
    const side = body.querySelector(".eg-side");
    const dlBtn = body.querySelector(".bb-dl");
    const tb = win.querySelector(".win-titlebar"), tText = win.querySelector(".win-titlebar .t-text");
    let ro = null; try { ro = new ResizeObserver(() => { const w = shell.clientWidth; win.classList.toggle("eg-narrow", w > 0 && w < 720); win.classList.toggle("eg-tiny", w > 0 && w < 480); }); ro.observe(shell); } catch (_) {}
    if (isEdge) { const cp = el(`<button class="bb-ic bb-copilot" title="Copilot (Ctrl+Shift+.)"><img src="assets/copilot.png?v=15" alt="Copilot" onerror="this.replaceWith(document.createTextNode('◈'))"></button>`); cp.onclick = () => { if (window.WM) WM.open("copilot"); }; body.querySelector(".bb-menu").before(cp); }

    // ---------- tab strip ----------
    const strip = el(`<div class="eg-strip" role="tablist" aria-label="Tabs">
      <div class="eg-vt-head">${isEdge ? `<button class="eg-ib eg-tabacts" title="Tab actions menu" aria-label="Tab actions menu">${IC.tabacts}</button>` : ""}<span class="eg-grow"></span><button class="eg-ib eg-vt-collapse" title="Collapse pane" aria-label="Collapse pane">${IC.chevL}</button></div>
      ${isEdge ? `<button class="eg-ib eg-tabacts eg-tabacts-h" title="Tab actions menu" aria-label="Tab actions menu">${IC.tabacts}</button>` : ""}
      <div class="eg-tabs"></div>
      <button class="eg-newtab" title="New tab (Ctrl+T)" aria-label="New tab">${IC.plus}<span class="eg-newtab-l">New tab</span></button>
      <div class="eg-drag"></div></div>`);
    const tabsEl = strip.querySelector(".eg-tabs");
    ["pointerdown", "dblclick"].forEach((ev) => strip.addEventListener(ev, (e) => { if (!e.target.closest(".eg-drag")) e.stopPropagation(); }));
    strip.querySelector(".eg-newtab").onclick = () => newTab();
    strip.querySelectorAll(".eg-tabacts").forEach((b) => b.onclick = (e) => { e.stopPropagation(); tabActionsMenu(b); });
    strip.querySelector(".eg-vt-collapse").onclick = () => { S.vtCollapsed = !S.vtCollapsed; save(); applyLayout(); };

    // ---------- state ----------
    let tabs = [], active = null, groups = [];
    const allPanes = new Set();
    const ctl = { appId, isEdge, win, shell, lastFocus: Date.now(), openTab, showDownloads, applyLayout, sleepCheck, focus: () => { if (win.style.display === "none") win.style.display = ""; ref.focus(); }, tabs: () => tabs, active: () => active, groups: () => groups, navigate: (u) => navigate(active, u), closeTab: (t) => closeTab(t), newTab: (u) => newTab(u), activate: (t) => activate(t), setMuted: (t, v) => setMuted(t, v), pin: (t, v) => setPinned(t, v), groupTabs: (list, o) => groupTabs(list, o), toggleGroup: (g) => toggleGroup(g), reopenClosed: () => reopenClosed(), duplicate: (t) => duplicateTab(t), moveTab: (t, i) => moveTabTo(t, i), toggleCollections: () => toggleCollections(), allPanes };
    ctl.afterAge = () => tabs.slice().forEach((t) => { if (t.pending != null || t.pane.querySelector(".bw-age")) { const u = t.pending || "home"; t.pending = null; if (t === active || !t.pane.isConnected) navigate(t, u, false); else { t.here = u; t.lazy = true; t.pane.innerHTML = ""; refreshTab(t); } } });
    CTLS.add(ctl);
    win.addEventListener("pointerdown", () => { ctl.lastFocus = Date.now(); }, true);
    win.addEventListener("focusin", () => { ctl.lastFocus = Date.now(); });

    // Family Safety: make sure the observer it attached to one pane fires for any navigation in this window.
    function famTick() { allPanes.forEach((p) => { const m = document.createElement("i"); m.className = "eg-tick"; m.hidden = true; p.appendChild(m); m.remove(); }); }
    function newPane() {
      let p = [...allPanes].find((x) => !x.isConnected);
      if (!p) {
        p = el(`<div class="eg-pane" tabindex="-1"></div>`); allPanes.add(p);
        ["play", "playing", "pause", "ended", "emptied", "volumechange"].forEach((ev) => p.addEventListener(ev, (e) => { const t = tabs.find((x) => x.pane === p); if (!t) return; if (t.muted && (ev === "play" || ev === "playing") && e.target) e.target.muted = true; audibleSoon(t); }, true));
        p.addEventListener("click", (e) => { const t = tabs.find((x) => x.pane === p); if (t) linkIntercept(t, e, document); }, true);
      }
      p.className = "eg-pane"; p.innerHTML = ""; p.style.zoom = "";
      panesEl.appendChild(p); return p;
    }
    function makeTab(o) {
      const t = Object.assign({ id: uid(), here: null, addr: "", title: "", icon: "", pinned: false, muted: false, groupId: null, back: [], fwd: [], lazy: false, sleeping: false, lastActive: Date.now(), audible: false, loading: false, zoom: 1, cleanup: [] }, o || {});
      t.pane = newPane();
      t.el = el(`<div class="eg-tab" role="tab" data-id="${t.id}"><span class="eg-tab-ic"></span><span class="eg-tab-t"></span><button class="eg-tab-audio" title="Mute tab" aria-label="Mute tab" hidden></button><button class="eg-tab-x" title="Close tab (Ctrl+W)" aria-label="Close tab">${IC.close}</button></div>`);
      wireTab(t);
      return t;
    }
    let audT = new Map();
    function audibleSoon(t) { clearTimeout(audT.get(t)); audT.set(t, setTimeout(() => { const was = t.audible; t.audible = [...t.pane.querySelectorAll("video,audio")].some((m) => !m.paused && !m.ended && m.readyState > 1); if (was !== t.audible) refreshTab(t); }, 60)); }
    function setMuted(t, on) { t.muted = !!on; t.pane.querySelectorAll("video,audio").forEach((m) => { m.muted = t.muted; }); refreshTab(t); saveSoon(); }
    function setPinned(t, on) {
      t.pinned = !!on; if (on) t.groupId = null;
      const rest = tabs.filter((x) => x !== t); const nPinned = rest.filter((x) => x.pinned).length;
      tabs = rest; tabs.splice(on ? nPinned : nPinned, 0, t);
      compactGroups(); renderStrip(); saveSoon();
    }

    // ---------- navigation ----------
    function teardown(t) { (t.cleanup || []).splice(0).forEach((f) => { try { f(); } catch (_) {} }); if (t.pdf) { try { t.pdf.destroy(); } catch (_) {} t.pdf = null; } t.frame = null; t.frameUrl = null; }
    function mkCtx(t) { return { page: t.pane, navigate: (u) => navigate(t, u), win, urlInput, tab: t, openTab: (u) => openTab(u, { activate: true, after: t }), goBack: () => goBack(t) }; }
    const isUrlLike = (s) => /^https?:\/\//i.test(s) || /^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/i.test(String(s).trim());
    function navigate(t, url, push) {
      if (!t) return;
      if (push === undefined) push = true;
      url = String(url == null ? "home" : url).trim() || "home";
      if (!safety().asked) {   // answer the age question first
        t.pending = url;
        if (!t.pane.querySelector(".bw-age")) { teardown(t); t.pane.innerHTML = ""; t.title = "New tab"; t.icon = iconFor("home"); ageGate(t.pane, () => CTLS.forEach((c) => c.afterAge())); }
        t.addr = ""; if (t === active) applyChrome(); refreshTab(t); return;
      }
      const iu = internalOf(url); if (iu && iu.page === "newtab") url = "home";
      if (push && t.here != null && t.here !== url) { t.back.push(t.here); if (t.back.length > 60) t.back.shift(); t.fwd.length = 0; }
      teardown(t);
      Object.assign(t, { here: url, lazy: false, sleeping: false, secure: "", loading: false, kind: "", pendingTitle: null });
      t.title = titleFor(url); t.icon = iconFor(url); t.addr = url;
      const pane = t.pane; pane.innerHTML = ""; pane.classList.remove("eg-framed", "eg-int-pane", "eg-pdf-pane");
      pane.style.zoom = t.zoom !== 1 ? String(t.zoom) : "";
      const ctx = mkCtx(t);
      const special = resolveSpecial(url);
      try {
        if (special === "home") { t.addr = ""; t.kind = "home"; if (isEdge) renderEdgeHome(ctx); else renderHome(ctx); }
        else if (iu) { t.kind = "internal"; t.addr = SCHEME + "://" + iu.page + (iu.sub ? "/" + iu.sub : ""); pane.classList.add("eg-int-pane"); renderInternal(t, iu); }
        else if (special) { t.kind = "site"; t.secure = "secure"; Sites[special](ctx); addHistory(SITE_TITLE[special], url); }
        else if (/^file:/i.test(url)) openFileUrl(t, url);
        else if (/^(blob:|data:)/i.test(url)) openBlobUrl(t, url);
        else renderWeb(t, url, ctx);
      } catch (e) {
        console.warn("Edge:", e);
        pane.innerHTML = ""; pane.appendChild(el(`<div class="eg-err"><h2>Hmmm… can't reach this page</h2><p>${esc((e && e.message) || e)}</p></div>`));
      }
      if (t === active) applyChrome();
      refreshTab(t); saveSoon(); famTick();
    }
    function renderWeb(t, url, ctx) {
      const pane = t.pane;
      const isUrl = isUrlLike(url);
      if (!isEdge) {
        const g = googleTarget(url, isUrl);
        if (g) {
          t.addr = g.q || "google.com"; t.title = g.q ? g.q + " - Google Search" : "Google"; t.icon = iconFor("https://www.google.com");
          if (g.q && safeOn() && isAdultText(g.q)) { renderSafeBlocked(ctx, g.q); return; }
          if (safeOn()) g.src += (g.src.includes("?") ? "&" : "?") + "safe=active";   // Google's own SafeSearch
          const frame = el(`<iframe class="embed-frame g-frame" src="${esc(g.src)}" referrerpolicy="no-referrer-when-downgrade" allow="clipboard-write; microphone"></iframe>`);
          pane.appendChild(frame); pane.classList.add("eg-framed"); t.secure = "secure"; t.frame = frame;
          addHistory(g.q || "google.com", g.q ? (g.images ? "images:" : "search:") + g.q : "https://www.google.com");
          return;
        }
      }
      if (/^(search|images):/i.test(url) || !isUrl) {   // in-app search results (Google/Bing refuse to load inside a window)
        const m = url.match(/^(search|images):(.*)$/i); const mode = m ? m[1].toLowerCase() : "search", q = m ? m[2] : url.trim();
        t.addr = q; t.title = q + " - Search"; t.icon = IC.search; t.kind = "search";
        if (safeOn() && isAdultText(q)) { renderSafeBlocked(ctx, q); return; }
        renderSearch(t, q, mode); addHistory(q, mode + ":" + q); return;
      }
      const final = /^https?:\/\//i.test(url) ? url : "https://" + url.trim();
      t.addr = final;
      const warn = siteWarning(final);
      if (warn && (!allowedHosts.has(warn.host) || (warn.kind === "adult" && safeOn()))) {
        t.secure = "warn"; t.title = warn.kind === "adult" ? "Blocked page" : "Warning"; t.icon = IC.warn; t.kind = "warn";
        renderWarning(Object.assign({}, ctx, { goBack: () => goBack(t) }), warn, final, () => navigate(t, final, false));
        return;
      }
      t.secure = /^http:\/\//i.test(final) ? "insecure" : "secure";
      if (/\.pdf($|[?#])/i.test(final)) { openPdfUrl(t, final); return; }
      embedFrame(t, final);
    }
    function embedFrame(t, final, note) {
      const pane = t.pane;
      const frame = el(`<iframe class="embed-frame" src="${esc(final)}" allow="autoplay; fullscreen; clipboard-write; encrypted-media; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin"></iframe>`);
      const barEl = el(`<div class="frame-bar"><span>${note || "Some sites won't show inside an app window — if this one stays blank, open it in a real tab."}</span><a href="${esc(final)}" target="_blank" rel="noopener" data-real>Open in a real tab ↗</a></div>`);
      pane.appendChild(barEl); pane.appendChild(frame); pane.classList.add("eg-framed");
      t.frame = frame; t.frameUrl = final; t.loading = true; t.kind = "web";
      frame.addEventListener("load", () => onFrameLoad(t, frame, final));
      let pth = ""; try { pth = new URL(final).pathname; } catch (_) {}
      addHistory(hostOf(final).replace(/^www\./, "") + (pth.length > 1 ? pth : ""), final);
    }
    function onFrameLoad(t, frame, final) {
      if (t.frame !== frame) return;
      t.loading = false;
      let doc = null; try { doc = frame.contentDocument; } catch (_) { doc = null; }
      if (doc && doc.location && doc.location.href && doc.location.href !== "about:blank") {   // same-origin page: we can read and hook it
        const href = doc.location.href;
        const norm = (u) => { try { const x = new URL(u); return x.origin + x.pathname.replace(/\/$/, "") + x.search; } catch (_) { return u; } };
        if (t.frameUrl && norm(href) !== norm(t.frameUrl)) { t.back.push(t.here); t.fwd.length = 0; t.here = href; t.addr = href; }
        t.frameUrl = href;
        if (doc.title) { t.title = doc.title; addHistory(doc.title, href); }
        const ic = doc.querySelector('link[rel~="icon"]'); if (ic && ic.href) t.icon = `<img src="${esc(ic.href)}" alt="">`;
        if (!doc.__egHooked) { doc.__egHooked = true; doc.addEventListener("click", (e) => linkIntercept(t, e, doc), true); }
      }
      refreshTab(t); if (t === active) applyChrome(); saveSoon();
    }
    // Links: downloads go to Downloads, PDFs open in a PDF tab, target=_blank opens a new tab.
    function linkIntercept(t, e, doc) {
      if (e.button || e.defaultPrevented) return;
      const a = e.target && e.target.closest ? e.target.closest("a[href]") : null; if (!a) return;
      if (a.hasAttribute("data-real")) return;
      const raw = a.getAttribute("href") || ""; if (!raw || raw[0] === "#" || /^(javascript|mailto|tel|sms):/i.test(raw)) return;
      const abs = a.href;
      let path = ""; try { path = new URL(abs).pathname; } catch (_) {}
      const isPdf = /\.pdf$/i.test(path) || /application\/pdf/i.test(a.type || "") || /\.pdf$/i.test(a.getAttribute("download") || "");
      const stop = () => { e.preventDefault(); e.stopPropagation(); };
      if (a.hasAttribute("download") || (/^(blob|data):/i.test(abs) && !isPdf) || DL_EXT.test(path)) { stop(); startDownload({ url: abs, name: a.getAttribute("download") || "", from: t.here }, ctl); return; }
      if (isPdf) { stop(); openTab(abs, { activate: !(e.ctrlKey || e.metaKey), after: t }); return; }
      if (a.target === "_blank" || e.ctrlKey || e.metaKey || e.shiftKey) { if (/^https?:|^blob:/i.test(abs)) { stop(); openTab(abs, { activate: !(e.ctrlKey || e.metaKey), after: t }); } return; }
      if (doc === document && /^https?:/i.test(abs) && !abs.startsWith(location.origin + location.pathname)) { stop(); navigate(t, abs); }
    }
    function goBack(t) { const prev = t.back.pop(); if (prev != null) { t.fwd.push(t.here || "home"); navigate(t, prev, false); } }
    function goFwd(t) { const nxt = t.fwd.pop(); if (nxt != null) { t.back.push(t.here || "home"); navigate(t, nxt, false); } }

    // ---------- PDFs ----------
    function pdfShell(t, name) { t.kind = "pdf"; t.title = name; t.icon = PDF_ICON; t.pane.classList.add("eg-pdf-pane"); const host = el(`<div class="eg-pdfhost"><div class="eg-pdf-loading">${SPIN}<span>Opening ${esc(name)}…</span></div></div>`); t.pane.appendChild(host); return host; }
    function mountPdf(t, host, blob, name, key, extra) {
      const here = t.here;
      loadPdfModule().then((P) => {
        if (t.here !== here || !host.isConnected) return;
        host.innerHTML = "";
        t.pdf = P.mount(host, Object.assign({
          blob, name, key, engine: S.pdfEngine, vq: VQ,
          annotations: (bstore().pdfAnn[key] || null),
          onAnnotations: (ann) => { const b = bstore(); if (ann && Object.keys(ann).some((k) => ann[k] && ann[k].length)) b.pdfAnn[key] = ann; else delete b.pdfAnn[key]; const keys = Object.keys(b.pdfAnn); if (keys.length > 40) delete b.pdfAnn[keys[0]]; save(); },
          onSave: (b2, n2) => startDownload({ blob: b2, name: n2, from: here }, ctl),
          onPage: (n, N) => { t.pdfPage = [n, N]; },
          notify,
        }, extra || {}));
      }).catch((e) => {   // no viewer module: let the browser's own PDF viewer try
        if (!host.isConnected) return;
        const u = URL.createObjectURL(blob); t.cleanup.push(() => setTimeout(() => URL.revokeObjectURL(u), 1000));
        host.innerHTML = `<div class="frame-bar"><span>${esc(e.message || "The PDF viewer couldn't load")} — showing the browser's own viewer.</span></div><iframe class="eg-pdf-native" src="${u}" title="${esc(name)}"></iframe>`;
      });
    }
    function openFileUrl(t, url) {
      const name = titleFor(url);
      const host = pdfShell(t, name);
      t.secure = "file";
      let node = t.srcNode && t.srcUrl === url ? t.srcNode : null; let path = null;
      if (!node) { path = pathFromFileUrl(url); node = path ? nodeAt(path) : null; }
      if (!node) { host.innerHTML = `<div class="eg-err"><h2>This file can't be opened</h2><p>It may have been moved, renamed or deleted.</p><p class="eg-dim">${esc(url)}</p></div>`; return; }
      addHistory(name, url);
      const key = (path ? path.join("/") : name) + "|" + (node.size || 0) + "|" + (node.ts || 0);
      nodeBlob(node, name).then((blob) => {
        if (/\.pdf$/i.test(name) || /pdf/.test(blob.type)) mountPdf(t, host, blob, name, key);
        else { const u = URL.createObjectURL(blob); t.cleanup.push(() => URL.revokeObjectURL(u)); host.innerHTML = `<iframe class="eg-filefr" src="${u}" title="${esc(name)}"${/\.(html?|svg)$/i.test(name) ? ' sandbox=""' : ""}></iframe>`; }
      }).catch((e) => { host.innerHTML = `<div class="eg-err"><h2>This file can't be opened</h2><p>${esc(e.message || e)}</p></div>`; });
    }
    function openBlobUrl(t, url) {
      const host = pdfShell(t, "Document");
      t.addr = url; t.secure = "file";
      fetch(url).then((r) => r.blob()).then(async (blob) => {
        const head = new Uint8Array(await blob.slice(0, 5).arrayBuffer()); const isPdf = /pdf/.test(blob.type) || String.fromCharCode.apply(null, head) === "%PDF-";
        const name = t.srcName || (isPdf ? "document.pdf" : "file"); t.title = name; refreshTab(t);
        if (isPdf) mountPdf(t, host, blob.type ? blob : new Blob([blob], { type: "application/pdf" }), name, "blob|" + name + "|" + blob.size);
        else { host.innerHTML = ""; startDownload({ blob, name: nameFromUrl("x:/" + name, blob.type), from: t.here }, ctl); host.appendChild(el(`<div class="eg-err"><h2>Downloaded</h2><p>This file was saved to your Downloads.</p></div>`)); }
      }).catch(() => { host.innerHTML = `<div class="eg-err"><h2>This file is no longer available</h2><p>The page that made it has closed. Open it again from where you found it.</p></div>`; });
    }
    function openPdfUrl(t, url) {
      const name = nameFromUrl(url, "application/pdf");
      const host = pdfShell(t, name);
      addHistory(name, url);
      fetch(url, { credentials: "same-origin" }).then((r) => { if (!r.ok) throw new Error(r.status); return r.blob(); }).then(async (blob) => {
        const head = new Uint8Array(await blob.slice(0, 5).arrayBuffer());
        if (String.fromCharCode.apply(null, head) !== "%PDF-") throw new Error("not a pdf");
        mountPdf(t, host, blob.type ? blob : new Blob([blob], { type: "application/pdf" }), name, url, { url });
      }).catch(() => {   // cross-origin PDF: we can't read it; the browser's own viewer may still show it
        if (!host.isConnected) return; host.remove(); t.pane.classList.remove("eg-pdf-pane");
        embedFrame(t, url, "This PDF comes from another website, so Edge's PDF tools (drawing, page count) aren't available — it's shown by your device's own viewer.");
        refreshTab(t);
      });
    }

    // ---------- in-app search ----------
    function renderSearch(t, q, mode) {
      const page = t.pane;
      const site = el(`<div class="site srch">
        <div class="srch-top"><b class="srch-logo">Search</b><input class="srch-q" value="${esc(q)}"><button class="srch-go">🔍</button></div>
        <div class="srch-tabs"><button data-m="search" class="${mode === "search" ? "on" : ""}">All</button><button data-m="images" class="${mode === "images" ? "on" : ""}">Images</button></div>
        <div class="srch-quick"></div><div class="srch-res"><p class="muted">Searching…</p></div></div>`);
      page.appendChild(site);
      const go = (m) => navigate(t, (m || mode) + ":" + site.querySelector(".srch-q").value.trim());
      site.querySelector(".srch-go").onclick = () => go();
      site.querySelector(".srch-q").onkeydown = (e) => { if (e.key === "Enter") go(); };
      site.querySelectorAll(".srch-tabs button").forEach((b) => b.onclick = () => go(b.dataset.m));
      const quick = site.querySelector(".srch-quick"), res = site.querySelector(".srch-res"), ql = q.toLowerCase();
      Object.keys(SPECIAL).filter((k) => !k.includes(".") && (ql.includes(k) || k.includes(ql)) && ql.length > 2).slice(0, 3).forEach((k) => {
        const a = el(`<button class="srch-site">🌐 <b>${esc(k[0].toUpperCase() + k.slice(1))}</b><span>${esc(k)}.com</span></button>`); a.onclick = () => navigate(t, k); quick.appendChild(a);
      });
      const word = ql.replace(/^(define|meaning of|what does)\s+/, "").replace(/\s+mean\??$/, "").trim();
      const d = window.DICTIONARY && window.DICTIONARY[word];
      if (d) quick.appendChild(el(`<div class="srch-card"><b>${esc(word)}</b> <i>${esc(d.pos)}</i><p>${esc(d.def)}</p></div>`));
      if (!q) { res.innerHTML = ""; return; }
      const W = "https://en.wikipedia.org/w/api.php?origin=*&format=json&";
      if (mode === "images") {
        fetch(W.replace("en.wikipedia.org", "commons.wikimedia.org") + "action=query&generator=search&gsrnamespace=6&gsrlimit=24&prop=imageinfo&iiprop=url&iiurlwidth=240&gsrsearch=" + encodeURIComponent(q))
          .then((r) => r.json()).then((j) => {
            const pages = Object.values((j.query && j.query.pages) || {}).filter((p) => p.imageinfo && p.imageinfo[0].thumburl);
            res.innerHTML = pages.length ? `<div class="srch-imgs">${pages.map((p) => `<a href="${esc(p.imageinfo[0].descriptionurl || p.imageinfo[0].url)}" target="_blank" rel="noopener"><img src="${esc(p.imageinfo[0].thumburl)}" alt="${esc(p.title.replace(/^File:/, ""))}" loading="lazy"></a>`).join("")}</div><p class="muted srch-src">Images from Wikimedia Commons</p>` : `<p class="muted">No images found for “${esc(q)}”.</p>`;
          }).catch(() => { res.innerHTML = `<p class="muted">Couldn't load images — check your connection.</p>`; });
        return;
      }
      fetch(W + "action=query&list=search&srlimit=10&srsearch=" + encodeURIComponent(q)).then((r) => r.json()).then((j) => {
        const hits = (j.query && j.query.search) || [];
        res.innerHTML = hits.length ? hits.map((h) => `<div class="srch-hit"><button class="srch-title" data-t="${esc(h.title)}">${esc(h.title)}</button><div class="srch-url">en.wikipedia.org › wiki › ${esc(h.title.replace(/ /g, "_"))}</div><p>${String(h.snippet || "").replace(/<(?!\/?span)[^>]*>/g, "")}…</p></div>`).join("") + `<p class="muted srch-src">Results from Wikipedia</p>` : `<p class="muted">No results for “${esc(q)}”.</p>`;
        res.querySelectorAll(".srch-title").forEach((b) => b.onclick = () => navigate(t, "https://en.wikipedia.org/wiki/" + encodeURIComponent(b.dataset.t.replace(/ /g, "_"))));
      }).catch(() => { res.innerHTML = `<p class="muted">Couldn't reach the search service — check your connection and try again.</p>`; });
    }

    // ---------- Edge new tab page ----------
    function renderEdgeHome(ctx) {
      const t = ctx.tab;
      const bgN = (new Date().getDate() % 6) + 1;
      const bg = S.ntpBg === "image" ? `url(assets/wall${bgN}.jpg) center/cover` : S.ntpBg === "gradient" ? "linear-gradient(135deg,#0f6cbd 0%,#3a96dd 45%,#7fc8ff 100%)" : "";
      const page = el(`<div class="edge-home eg-ntp ${bg ? "has-bg" : "no-bg"}">
        <div class="edge-hero" ${bg ? `style="background:${bg}"` : ""}>
          <div class="edge-hero-top"><span class="edge-weather">🌤 72°F</span><span class="grow"></span><button class="edge-gear" title="Page settings" aria-label="Page settings">${IC.gear}</button></div>
          <form class="edge-search-form">
            <div class="edge-search">
              <img class="edge-bing" src="assets/bing.png?v=15" alt="Bing">
              <input class="edge-q" placeholder="Search the web" aria-label="Search the web">
              <button type="submit" class="edge-go" title="Search">${IC.search}</button>
            </div>
          </form>
          <div class="edge-tiles"></div>
        </div>
        ${S.ntpFeed ? `<div class="edge-feed"><div class="edge-feed-tabs"><button class="on">My Feed</button><button>News</button><button>Sports</button><button>Money</button><button>Entertainment</button><button>Health</button></div><div class="edge-cards"></div></div>` : ""}
      </div>`);
      const tiles = page.querySelector(".edge-tiles");
      if (S.ntpQuick) {
        B.quick.forEach((q, i) => {
          const sp = resolveSpecial(q.url);
          const tile = el(`<div class="edge-tile" role="button" tabindex="0"><span class="edge-tile-ic">${sp && sp !== "home" ? siteIcon(sp, true) : `<span class="eg-qic">${iconFor(q.url)}</span>`}</span><span class="edge-tile-lb">${esc(q.label)}</span><button class="eg-tile-x" title="Remove" aria-label="Remove ${esc(q.label)}">${IC.close}</button></div>`);
          tile.onclick = (e) => { if (e.target.closest(".eg-tile-x")) { B.quick.splice(i, 1); save(); navigate(t, "home", false); return; } ctx.navigate(q.url); };
          tile.onkeydown = (e) => { if (e.key === "Enter") ctx.navigate(q.url); };
          tiles.appendChild(tile);
        });
        if (B.quick.length < 12) {
          const add = el(`<button class="edge-tile eg-tile-add" title="Add a site"><span class="edge-tile-ic"><span class="eg-qadd">${IC.plus}</span></span><span class="edge-tile-lb">Add a site</span></button>`);
          add.onclick = async () => { const v = await promptDlg(shell, "Add a site", [{ label: "Name", placeholder: "Example" }, { label: "URL", placeholder: "example.com" }], "Add"); if (!v || !v[1]) return; B.quick.push({ label: v[0] || titleFor(v[1]), url: v[1] }); save(); navigate(t, "home", false); };
          tiles.appendChild(add);
        }
      }
      page.querySelector(".edge-search-form").onsubmit = (e) => { e.preventDefault(); const q = page.querySelector(".edge-q").value.trim(); if (q) ctx.navigate(isUrlLike(q) ? q : "search:" + q); };
      const cards = page.querySelector(".edge-cards");
      if (cards) EDGE_NEWS.forEach((n) => cards.appendChild(el(`<div class="edge-card"><div class="edge-card-img" style="background:${n.img}"></div><div class="edge-card-body"><div class="edge-card-cat">${esc(n.cat)}</div><div class="edge-card-title">${esc(n.title)}</div><div class="edge-card-src">${esc(n.src)}</div></div></div>`)));
      page.querySelector(".edge-gear").onclick = (e) => {
        e.stopPropagation();
        const radio = (v, l) => ({ id: "bg-" + v, label: l, checked: S.ntpBg === v, run: () => { S.ntpBg = v; save(); navigate(t, "home", false); } });
        popMenu([{ node: el(`<div class="eg-mh">Page settings</div>`) }, radio("image", "Background: image of the day"), radio("gradient", "Background: Edge blue"), radio("off", "Background: off"), { sep: true },
          { id: "ntp-quick", label: "Show quick links", checked: S.ntpQuick, run: () => { S.ntpQuick = !S.ntpQuick; save(); navigate(t, "home", false); } },
          { id: "ntp-feed", label: "Show content (news feed)", checked: S.ntpFeed, run: () => { S.ntpFeed = !S.ntpFeed; save(); navigate(t, "home", false); } }], e.currentTarget, { trigger: e.currentTarget });
      };
      ctx.page.appendChild(page);
    }

    // ---------- tab strip rendering ----------
    function groupById(id) { return groups.find((g) => g.id === id) || null; }
    function compactGroups() {
      groups = groups.filter((g) => tabs.some((t) => t.groupId === g.id));
      // keep each group's tabs together (first occurrence wins)
      const seen = new Set(); const order = [];
      tabs.forEach((t) => { if (!t.groupId) { order.push(t); return; } if (seen.has(t.groupId)) return; seen.add(t.groupId); tabs.filter((x) => x.groupId === t.groupId).forEach((x) => order.push(x)); });
      tabs = order;
    }
    function chipFor(g) {
      if (!g.el) {
        g.el = el(`<div class="eg-gchip" role="button" tabindex="0"><span class="eg-gchip-dot"></span><span class="eg-gchip-t"></span><span class="eg-gchip-n"></span><span class="eg-gchip-chev">${IC.chevD}</span></div>`);
        g.el.addEventListener("click", (e) => { if (g.el.__lp) { g.el.__lp = false; return; } e.stopPropagation(); toggleGroup(g); });
        g.el.addEventListener("contextmenu", (e) => { e.preventDefault(); e.stopPropagation(); groupEditor(g); });
        g.el.addEventListener("pointerdown", (e) => e.stopPropagation());
      }
      const n = tabs.filter((t) => t.groupId === g.id).length;
      g.el.style.setProperty("--gc", gColor(g.color));
      g.el.classList.toggle("collapsed", !!g.collapsed); g.el.classList.toggle("unnamed", !g.name);
      g.el.querySelector(".eg-gchip-t").textContent = g.name || "";
      g.el.querySelector(".eg-gchip-n").textContent = g.collapsed || !g.name ? String(n) : "";
      g.el.title = (g.name || "Unnamed group") + " — " + n + " tab" + (n === 1 ? "" : "s") + (g.collapsed ? " (collapsed). Click to expand." : ". Click to collapse; right-click to edit.");
      g.el.setAttribute("aria-expanded", String(!g.collapsed));
      return g.el;
    }
    function renderStrip() {
      compactGroups();
      const kids = []; let last = null;
      tabs.forEach((t) => {
        const g = t.groupId ? groupById(t.groupId) : null;
        if (g && g.id !== last) kids.push(chipFor(g));
        last = g ? g.id : null;
        t.el.classList.toggle("eg-hidden", !!(g && g.collapsed));
        kids.push(t.el);
      });
      tabsEl.replaceChildren(...kids);
      tabs.forEach(refreshTab);
      strip.classList.toggle("eg-many", tabs.length > 7);
    }
    function refreshTab(t) {
      if (!t || !t.el) return;
      const g = t.groupId ? groupById(t.groupId) : null;
      t.el.classList.toggle("on", t === active); t.el.setAttribute("aria-selected", String(t === active));
      t.el.classList.toggle("pinned", !!t.pinned); t.el.classList.toggle("sleeping", !!(t.sleeping || t.lazy) && t !== active);
      t.el.classList.toggle("in-group", !!g); t.el.style.setProperty("--gc", g ? gColor(g.color) : "transparent");
      t.el.classList.toggle("audible", !!t.audible); t.el.classList.toggle("muted", !!t.muted);
      const ic = t.loading ? SPIN : (t.icon || IC.globe);
      const icEl = t.el.querySelector(".eg-tab-ic"); if (icEl.__ic !== ic) { icEl.__ic = ic; icEl.innerHTML = ic; }
      const title = t.title || titleFor(t.here) || "New tab";
      t.el.querySelector(".eg-tab-t").textContent = title;
      t.el.title = title + ((t.sleeping || t.lazy) && t !== active ? " — this tab is sleeping to save resources" : "") + (t.muted ? " — muted" : t.audible ? " — playing audio" : "");
      const au = t.el.querySelector(".eg-tab-audio"); au.hidden = !(t.audible || t.muted); au.innerHTML = t.muted ? IC.muted : IC.speaker; au.title = t.muted ? "Unmute tab" : "Mute tab"; au.setAttribute("aria-label", au.title);
      if (t === active) { const s = title + " - " + (isEdge ? "Microsoft Edge" : "Google Chrome"); if (tText && tText.textContent !== s) tText.textContent = s; }
    }
    function wireTab(t) {
      const te = t.el;
      te.addEventListener("click", (e) => {
        if (t._dragged) return;
        if (e.target.closest(".eg-tab-x")) { e.stopPropagation(); closeTab(t); return; }
        if (e.target.closest(".eg-tab-audio")) { e.stopPropagation(); setMuted(t, !t.muted); return; }
        if (t._lp) { t._lp = false; return; }
        activate(t);
      });
      te.addEventListener("auxclick", (e) => { if (e.button === 1) { e.preventDefault(); closeTab(t); } });
      te.addEventListener("mousedown", (e) => { if (e.button === 1) e.preventDefault(); });
      te.addEventListener("contextmenu", (e) => { e.preventDefault(); e.stopPropagation(); tabMenu(t, { x: e.clientX, y: e.clientY }); });
      te.addEventListener("dblclick", (e) => e.stopPropagation());
      te.addEventListener("pointerdown", (e) => startTabDrag(t, e));
    }
    function startTabDrag(t, e) {
      e.stopPropagation();
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (e.target.closest(".eg-tab-x,.eg-tab-audio")) return;
      if (e.pointerType === "mouse" && t !== active) activate(t);
      const vert = S.vertical && isEdge;
      const st = { x: e.clientX, y: e.clientY, id: e.pointerId, drag: false, lp: null, to: null };
      if (e.pointerType !== "mouse") st.lp = setTimeout(() => { if (!st.drag) { st.done = true; t._lp = true; tabMenu(t, { x: st.x, y: st.y + 12 }); } }, 550);
      try { t.el.setPointerCapture(e.pointerId); } catch (_) {}
      const marks = () => tabs.forEach((o) => o.el.classList.remove("eg-drop-before", "eg-drop-after"));
      const move = (ev) => {
        if (ev.pointerId !== st.id || st.done) return;
        const d = vert ? ev.clientY - st.y : ev.clientX - st.x, o = vert ? ev.clientX - st.x : ev.clientY - st.y;
        if (!st.drag) { if (Math.abs(d) < 8 && Math.abs(o) < 8) return; if (st.lp) clearTimeout(st.lp); st.drag = true; t.el.classList.add("eg-dragging"); }
        t.el.style.transform = vert ? `translateY(${d}px)` : `translateX(${d}px)`;
        const pos = vert ? ev.clientY : ev.clientX;
        const others = tabs.filter((x) => x !== t && !x.el.classList.contains("eg-hidden") && !!x.pinned === !!t.pinned);
        let before = null; for (const x of others) { const r = x.el.getBoundingClientRect(); const mid = vert ? r.top + r.height / 2 : r.left + r.width / 2; if (pos < mid) { before = x; break; } }
        marks();
        if (before) before.el.classList.add("eg-drop-before"); else if (others.length) others[others.length - 1].el.classList.add("eg-drop-after");
        st.to = before;
      };
      const up = (ev) => {
        t.el.removeEventListener("pointermove", move); t.el.removeEventListener("pointerup", up); t.el.removeEventListener("pointercancel", up);
        if (st.lp) clearTimeout(st.lp); t.el.style.transform = ""; t.el.classList.remove("eg-dragging"); marks();
        if (!st.drag) return;
        t._dragged = true; setTimeout(() => { t._dragged = false; }, 0);
        const rest = tabs.filter((x) => x !== t);
        let idx = st.to ? rest.indexOf(st.to) : (t.pinned ? rest.filter((x) => x.pinned).length : rest.length);
        moveTabTo(t, idx);
      };
      t.el.addEventListener("pointermove", move); t.el.addEventListener("pointerup", up); t.el.addEventListener("pointercancel", up);
    }
    function moveTabTo(t, idx) {
      const rest = tabs.filter((x) => x !== t);
      const nP = rest.filter((x) => x.pinned).length;
      idx = t.pinned ? Math.max(0, Math.min(idx, nP)) : Math.max(nP, Math.min(idx, rest.length));
      rest.splice(idx, 0, t); tabs = rest;
      const prev = tabs[idx - 1], next = tabs[idx + 1];
      if (!t.pinned) {
        if (prev && next && prev.groupId && prev.groupId === next.groupId) t.groupId = prev.groupId;
        else if (t.groupId && !(prev && prev.groupId === t.groupId) && !(next && next.groupId === t.groupId)) t.groupId = null;
      }
      renderStrip(); saveSoon();
    }

    // ---------- tab lifecycle ----------
    function activate(t) {
      if (!t) return;
      if (active && active !== t) { active.lastActive = Date.now(); active.pane.classList.remove("on", "browser-page"); }
      const g = t.groupId && groupById(t.groupId); if (g && g.collapsed) { g.collapsed = false; renderStrip(); }
      active = t; t.lastActive = Date.now();
      t.pane.classList.add("on", "browser-page");
      if (t.lazy || t.sleeping) navigate(t, t.here || "home", false);
      tabs.forEach(refreshTab);
      applyChrome(); famTick(); saveSoon();
      try { t.el.scrollIntoView({ block: "nearest", inline: "nearest" }); } catch (_) {}
    }
    function openTab(url, o) {
      o = o || {};
      const t = makeTab({ here: null });
      if (o.after && tabs.includes(o.after)) {
        let i = tabs.indexOf(o.after) + 1;
        if (o.after.groupId && !o.noGroup) { t.groupId = o.after.groupId; }
        else { while (tabs[i] && tabs[i].groupId && tabs[i].groupId === (tabs[i - 1] && tabs[i - 1].groupId)) i++; }
        if (o.after.pinned) { i = tabs.filter((x) => x.pinned).length; t.groupId = null; }
        tabs.splice(i, 0, t);
      } else if (o.index != null) tabs.splice(o.index, 0, t);
      else tabs.push(t);
      if (o.group) t.groupId = o.group;
      if (o.srcNode) { t.srcNode = o.srcNode; t.srcUrl = url; }
      if (o.srcName) t.srcName = o.srcName;
      renderStrip();
      if (o.activate !== false) { activate(t); navigate(t, url || "home", false); if (!url || resolveSpecial(url) === "home") setTimeout(() => { const ae = document.activeElement; if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return; if (active === t) { const q = t.pane.querySelector(".edge-q,.searchbar-input"); if (q && matchMedia("(pointer:fine)").matches) q.focus(); else urlInput.focus(); } }, 30); }
      else { t.here = url || "home"; t.lazy = true; t.title = titleFor(t.here); t.icon = iconFor(t.here); refreshTab(t); }
      saveSoon();
      return { tab: t, navigate: (u) => navigate(t, u) };
    }
    function newTab(url) { return openTab(url || "home", { activate: true }); }
    function closeTab(t, o) {
      const i = tabs.indexOf(t); if (i < 0) return;
      if (t.here && !(resolveSpecial(t.here) === "home" && !t.back.length)) { B.closedTabs.unshift({ url: t.here, title: t.title, back: t.back.slice(-15), fwd: t.fwd.slice(-15), ts: Date.now(), app: appId }); B.closedTabs = B.closedTabs.slice(0, 25); emit("hist"); }
      teardown(t); t.pane.innerHTML = ""; t.pane.remove(); t.el.remove();
      tabs.splice(i, 1);
      if (!tabs.length) { if (!(o && o.keepSession)) { B.sessions[appId] = null; save(); } closing = true; ref.close(); return; }
      if (t === active) {
        active = null;
        const vis = (x) => x && !(x.groupId && groupById(x.groupId) && groupById(x.groupId).collapsed);
        let nx = tabs.slice(i).find(vis) || tabs.slice(0, i).reverse().find(vis);
        if (!nx) { const g = groupById(tabs[0].groupId); if (g) g.collapsed = false; nx = tabs[Math.min(i, tabs.length - 1)]; }
        renderStrip(); activate(nx);
      } else renderStrip();
      saveSoon();
    }
    function reopenClosed() {
      const rec = B.closedTabs.find((x) => !x.app || x.app === appId) || B.closedTabs[0];
      if (!rec) { notify("There are no recently closed tabs."); return; }
      B.closedTabs = B.closedTabs.filter((x) => x !== rec); save(); emit("hist");
      const r = openTab(rec.url, { activate: false }); r.tab.back = rec.back || []; r.tab.fwd = rec.fwd || []; activate(r.tab);
    }
    function duplicateTab(t) { const r = openTab(t.here || "home", { activate: false, after: t }); r.tab.back = t.back.slice(); r.tab.fwd = t.fwd.slice(); activate(r.tab); }
    function closeOthers(t) { tabs.filter((x) => x !== t && !x.pinned).forEach((x) => closeTab(x)); }
    function closeRight(t) { tabs.slice(tabs.indexOf(t) + 1).forEach((x) => closeTab(x)); }
    function groupTabs(list, o) {
      o = o || {};
      const used = groups.map((g) => g.color);
      const g = { id: "g" + uid(), name: o.name || "", color: o.color || (GROUP_COLORS.find((c) => !used.includes(c[0])) || GROUP_COLORS[(groups.length + 1) % GROUP_COLORS.length])[0], collapsed: false };
      groups.push(g);
      const first = Math.min(...list.map((t) => tabs.indexOf(t)));
      list.forEach((t) => { t.pinned = false; t.groupId = g.id; });
      const rest = tabs.filter((t) => !list.includes(t)); const anchor = tabs.slice(0, first).filter((t) => !list.includes(t)).length;
      rest.splice(anchor, 0, ...list); tabs = rest;
      renderStrip(); saveSoon();
      if (o.edit !== false) setTimeout(() => groupEditor(g), 0);
      return g;
    }
    function addToGroup(t, g) {
      t.pinned = false; t.groupId = g.id;
      const rest = tabs.filter((x) => x !== t); let last = -1; rest.forEach((x, i) => { if (x.groupId === g.id) last = i; });
      rest.splice(last + 1, 0, t); tabs = rest; renderStrip(); saveSoon();
    }
    function toggleGroup(g, v) {
      g.collapsed = v == null ? !g.collapsed : !!v;
      if (g.collapsed && active && active.groupId === g.id) {
        const nx = tabs.find((x) => x.groupId !== g.id && !(x.groupId && groupById(x.groupId) && groupById(x.groupId).collapsed));
        renderStrip();
        if (nx) activate(nx); else openTab("home", { activate: true, noGroup: true });
      } else renderStrip();
      saveSoon();
    }
    function groupEditor(g) {
      const anchor = g.el && g.el.isConnected ? g.el : strip;
      const box = el(`<div class="eg-ged"><input class="eg-ged-name" placeholder="Name this group" value="${esc(g.name)}" aria-label="Group name"><div class="eg-ged-colors">${GROUP_COLORS.map((c) => `<button class="eg-ged-c${g.color === c[0] ? " on" : ""}" data-c="${c[0]}" title="${c[0]}" aria-label="${c[0]}" style="--gc:${c[1]}"></button>`).join("")}</div></div>`);
      const inp = box.querySelector(".eg-ged-name");
      inp.addEventListener("input", () => { g.name = inp.value.slice(0, 40); chipFor(g); saveSoon(); });
      inp.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") pm.close(); });
      box.querySelectorAll(".eg-ged-c").forEach((b) => b.onclick = (e) => { e.stopPropagation(); g.color = b.dataset.c; box.querySelectorAll(".eg-ged-c").forEach((x) => x.classList.toggle("on", x === b)); renderStrip(); saveSoon(); });
      const pm = popMenu([{ node: box }, { sep: true },
        { id: "g-new", label: "New tab in group", icon: IC.plus, run: () => { const last = tabs.filter((x) => x.groupId === g.id).pop(); openTab("home", { activate: true, after: last }); } },
        { id: "g-collapse", label: g.collapsed ? "Expand group" : "Collapse group", icon: IC.chevD, run: () => toggleGroup(g) },
        { id: "g-ungroup", label: "Ungroup", icon: IC.group, run: () => { tabs.forEach((x) => { if (x.groupId === g.id) x.groupId = null; }); renderStrip(); saveSoon(); } },
        { id: "g-close", label: "Close group", icon: IC.close, danger: true, run: () => tabs.filter((x) => x.groupId === g.id).forEach((x) => closeTab(x)) }], anchor, { alignLeft: true });
      pm.el.classList.add("eg-ged-menu");
      setTimeout(() => { try { inp.focus(); } catch (_) {} }, 20);
    }
    function tabMenu(t, at) {
      const other = groups.filter((g) => g.id !== t.groupId);
      popMenu([
        { id: "t-new-right", label: "New tab to the right", icon: IC.plus, run: () => openTab("home", { activate: true, after: t }) },
        { id: "t-group-new", label: "Add tab to new group", icon: IC.group, run: () => groupTabs([t]) },
        other.length ? { id: "t-group-add", label: "Add tab to group", icon: IC.group, sub: () => other.map((g) => ({ id: "t-to-" + g.id, label: g.name || "Unnamed group", icon: `<i class="eg-dot" style="--gc:${gColor(g.color)}"></i>`, run: () => addToGroup(t, g) })) } : null,
        t.groupId ? { id: "t-ungroup", label: "Remove from group", run: () => { const gid = t.groupId; t.groupId = null; const rest = tabs.filter((x) => x !== t); let last = -1; rest.forEach((x, i) => { if (x.groupId === gid) last = i; }); rest.splice(last + 1, 0, t); tabs = rest; renderStrip(); saveSoon(); } } : null,
        { sep: true },
        { id: "t-reload", label: "Refresh", icon: IC.reload, kbd: "Ctrl+R", run: () => navigate(t, t.here || "home", false) },
        { id: "t-dup", label: "Duplicate tab", icon: IC.dup, kbd: "Ctrl+Shift+K", run: () => duplicateTab(t) },
        { id: "t-pin", label: t.pinned ? "Unpin tab" : "Pin tab", icon: IC.pin, run: () => setPinned(t, !t.pinned) },
        { id: "t-mute", label: t.muted ? "Unmute tab" : "Mute tab", icon: t.muted ? IC.speaker : IC.muted, run: () => setMuted(t, !t.muted) },
        isEdge ? { id: "t-col", label: "Add tab to Collections", icon: IC.collections, run: () => addToCollection(t) } : null,
        { sep: true },
        { id: "t-close", label: "Close tab", icon: IC.close, kbd: "Ctrl+W", run: () => closeTab(t) },
        { id: "t-close-others", label: "Close other tabs", disabled: tabs.length < 2, run: () => closeOthers(t) },
        { id: "t-close-right", label: "Close tabs to the right", disabled: tabs.indexOf(t) === tabs.length - 1, run: () => closeRight(t) },
        { sep: true },
        { id: "t-reopen", label: "Reopen closed tab", kbd: "Ctrl+Shift+T", disabled: !B.closedTabs.length, run: reopenClosed },
        isEdge ? { id: "t-vert", label: S.vertical ? "Turn off vertical tabs" : "Turn on vertical tabs", icon: S.vertical ? IC.htabs : IC.vtabs, kbd: "Ctrl+Shift+,", run: toggleVertical } : null,
      ], at);
    }
    function tabActionsMenu(btn) {
      popMenu([
        { id: "ta-vert", label: S.vertical ? "Turn off vertical tabs" : "Turn on vertical tabs", icon: S.vertical ? IC.htabs : IC.vtabs, kbd: "Ctrl+Shift+,", run: toggleVertical },
        { id: "ta-reopen", label: "Reopen closed tab", icon: IC.history, kbd: "Ctrl+Shift+T", disabled: !B.closedTabs.length, run: reopenClosed },
        { id: "ta-col", label: "Add all tabs to a new collection", icon: IC.collections, run: () => { const c = { id: uid(), name: "Tabs " + new Date().toLocaleDateString(), items: [], ts: Date.now() }; tabs.forEach((t) => { if (t.here && resolveSpecial(t.here) !== "home") c.items.push(itemFromTab(t)); }); B.collections.unshift(c); save(); emit("col"); openCollections(c.id); } },
        { id: "ta-sleep", label: "Put other tabs to sleep now", icon: IC.moon, run: () => { tabs.forEach((t) => { if (t !== active) sleepTab(t); }); } },
        { sep: true },
        { node: (() => { const box = el(`<div class="eg-tsearch"><input placeholder="Search tabs" aria-label="Search tabs"><div class="eg-tsearch-l"></div></div>`); const inp = box.querySelector("input"), l = box.querySelector(".eg-tsearch-l"); const paint = () => { const q = inp.value.toLowerCase(); l.innerHTML = ""; tabs.filter((t) => !q || (t.title + " " + t.here).toLowerCase().includes(q)).slice(0, 12).forEach((t) => { const b = el(`<button class="eg-mi"><span class="eg-mi-ic">${t.icon || IC.globe}</span><span class="eg-mi-t">${esc(t.title || "New tab")}</span></button>`); b.onclick = () => { closePops(); activate(t); }; l.appendChild(b); }); }; inp.oninput = paint; inp.onkeydown = (e) => e.stopPropagation(); paint(); return box; })() },
      ], btn, { alignLeft: true, trigger: btn });
    }
    function toggleVertical() { S.vertical = !S.vertical; save(); CTLS.forEach((c) => c.applyLayout()); }

    // ---------- sleeping tabs ----------
    function sleepTab(t) {
      if (t === active || t.sleeping || t.lazy || t.audible || !t.pane.childElementCount) return false;
      teardown(t); t.pane.innerHTML = ""; t.sleeping = true; refreshTab(t); return true;
    }
    function sleepCheck(now) {
      if (!S.sleep) return 0; now = now || Date.now(); const lim = Math.max(0.05, +S.sleepMins || 15) * 60000; let n = 0;
      tabs.forEach((t) => { if (t !== active && now - (t.lastActive || 0) >= lim && sleepTab(t)) n++; });
      return n;
    }
    const sleepTimer = setInterval(() => { if (!win.isConnected) return; sleepCheck(); }, 30000);

    // ---------- session ----------
    let saveT = 0, closing = false;
    function saveSoon() { clearTimeout(saveT); saveT = setTimeout(saveSession, 350); }
    function saveSession() {
      if (closing) return;
      const keep = tabs.filter((t) => t.here);
      if (!keep.length) return;
      B.sessions[appId] = { ts: Date.now(), active: Math.max(0, keep.indexOf(active)), groups: groups.map((g) => ({ id: g.id, name: g.name, color: g.color, collapsed: g.collapsed })),
        tabs: keep.map((t) => ({ url: /^(blob|data):/i.test(t.here) ? "home" : t.here, title: t.title, pinned: !!t.pinned, muted: !!t.muted, groupId: t.groupId || null, back: t.back.filter((u) => !/^(blob|data):/i.test(u)).slice(-15), fwd: t.fwd.filter((u) => !/^(blob|data):/i.test(u)).slice(-15) })) };
      save();
    }
    function destroy() {
      clearInterval(sleepTimer); saveSession(); closing = true; try { if (ro) ro.disconnect(); } catch (_) {}
      tabs.forEach(teardown); CTLS.delete(ctl);
      window.removeEventListener("pointerdown", capDown, true); window.removeEventListener("contextmenu", capCtx, true);
      bus.removeEventListener("fav", onFav); bus.removeEventListener("dl", onDl); bus.removeEventListener("set", onSet);
      try { speechSynthesis.cancel(); } catch (_) {}
    }

    // ---------- chrome (address bar, buttons, title) ----------
    function applyChrome() {
      const t = active; if (!t) return;
      if (document.activeElement !== urlInput || !urlInput.value || urlInput.__shown !== t.id) { urlInput.value = t.addr || ""; urlInput.__shown = t.id; }
      const s = t.secure;
      lock.innerHTML = s === "secure" ? IC.lock : s === "insecure" ? `${IC.warn}<span>Not secure</span>` : s === "warn" ? IC.warn : s === "file" ? IC.file : t.kind === "internal" ? `<span class="eg-brand">${isEdge ? "Edge" : "Chrome"}</span>` : t.kind === "home" ? IC.search : IC.info;
      siteBtn.className = "eg-site " + (s || t.kind || "");
      siteBtn.title = s === "secure" ? "Connection is secure" : s === "insecure" ? "Not secure — this site doesn't use https" : s === "file" ? "This is a file on your device" : t.kind === "internal" ? "This is a " + (isEdge ? "Microsoft Edge" : "Chrome") + " page" : "View site information";
      body.querySelector(".bb-nav.back").disabled = !t.back.length; body.querySelector(".bb-nav.fwd").disabled = !t.fwd.length;
      favBtn.classList.toggle("on", isFav(t.here));
      favBtn.title = isFav(t.here) ? "Edit favorite for this page" : (isEdge ? "Add this page to favorites (Ctrl+D)" : "Bookmark this tab (Ctrl+D)");
      updateFavBarVisibility();
      refreshTab(t);
    }
    const isFav = (u) => !!u && B.favs.some((f) => f.url === u);
    function applyLayout() {
      const vert = isEdge && S.vertical;
      win.classList.toggle("eg-vert", vert); win.classList.toggle("eg-htabs", !vert); win.classList.toggle("eg-vt-mini", vert && !!S.vtCollapsed);
      if (vert) { if (strip.parentNode !== vtHost) vtHost.appendChild(strip); vtHost.hidden = false; }
      else { if (strip.parentNode !== tb) tb.insertBefore(strip, tb.querySelector(".win-controls")); vtHost.hidden = true; }
      strip.classList.toggle("vertical", vert);
      strip.querySelector(".eg-vt-collapse").innerHTML = S.vtCollapsed ? IC.chevR : IC.chevL;
      strip.querySelector(".eg-vt-collapse").title = S.vtCollapsed ? "Expand pane" : "Collapse pane";
      renderStrip(); updateFavBarVisibility();
    }
    function updateFavBarVisibility() { const m = S.favBar || "always"; favBar.hidden = m === "never" || (m === "newtab" && !(active && active.kind === "home")); }

    // touch: tabs handle their own gestures before titlebar features (window drag, long-press menus) see them
    const capDown = (e) => {
      if (e.pointerType === "mouse" || !e.target || !e.target.closest || !strip.contains(e.target) || e.target.closest(".eg-drag")) return;
      e.stopPropagation();
      const te = e.target.closest(".eg-tab"); const t = te && tabs.find((x) => x.el === te);
      if (t && !e.target.closest(".eg-tab-x,.eg-tab-audio")) startTabDrag(t, e);
      const ch = e.target.closest(".eg-gchip"); const g = ch && groups.find((x) => x.el === ch);
      if (g) { const tm = setTimeout(() => { g.el.__lp = true; groupEditor(g); }, 550); const c = () => { clearTimeout(tm); window.removeEventListener("pointerup", c, true); window.removeEventListener("pointercancel", c, true); }; window.addEventListener("pointerup", c, true); window.addEventListener("pointercancel", c, true); }
    };
    const capCtx = (e) => { if (!e.target || !e.target.closest || !strip.contains(e.target)) return; const te = e.target.closest(".eg-tab"); if (!te) return; const t = tabs.find((x) => x.el === te); if (!t) return; e.preventDefault(); e.stopPropagation(); if (!t._lp) tabMenu(t, { x: e.clientX, y: e.clientY }); };
    window.addEventListener("pointerdown", capDown, true);
    window.addEventListener("contextmenu", capCtx, true);

    // ---------- favorites bar ----------
    function renderFavBar() {
      favBar.innerHTML = "";
      const mkBtn = (html, cls) => el(`<button class="bm ${cls || ""}">${html}</button>`);
      favsIn("bar").forEach((f) => {
        const sp = resolveSpecial(f.url);
        const b = mkBtn(`<span class="eg-bm-ic">${sp && sp !== "home" ? siteIcon(sp) : iconFor(f.url)}</span><span class="eg-bm-t">${esc(f.label)}</span>`);
        b.title = f.label + "\n" + f.url;
        b.onclick = (e) => { if (b.__lp) { b.__lp = false; return; } if (e.ctrlKey || e.metaKey) openTab(f.url, { activate: false, after: active }); else navigate(active, f.url); };
        const menu = (at) => popMenu([{ id: "bm-open", label: "Open", run: () => navigate(active, f.url) }, { id: "bm-newtab", label: "Open in new tab", icon: IC.plus, run: () => openTab(f.url, { activate: true, after: active }) }, { sep: true }, { id: "bm-edit", label: "Edit", icon: IC.edit, run: () => editFav(f) }, { id: "bm-del", label: "Delete", icon: IC.trash, danger: true, run: () => { B.favs = B.favs.filter((x) => x !== f); save(); emit("fav"); } }], at);
        b.addEventListener("contextmenu", (e) => { e.preventDefault(); menu({ x: e.clientX, y: e.clientY }); });
        longPress(b, () => menu(b));
        favBar.appendChild(b);
      });
      const folderMenu = (fid, anchor) => popMenu(folderItems(fid), anchor, { alignLeft: true, trigger: anchor });
      subFolders("bar").forEach((fo) => { const b = mkBtn(`<span class="eg-bm-ic">${IC.folder}</span><span class="eg-bm-t">${esc(fo.name)}</span>`, "eg-bm-folder"); b.onclick = () => folderMenu(fo.id, b); favBar.appendChild(b); });
      if (favsIn("other").length || subFolders("other").length) { favBar.appendChild(el(`<span class="eg-grow"></span>`)); const b = mkBtn(`<span class="eg-bm-ic">${IC.folder}</span><span class="eg-bm-t">Other favorites</span>`, "eg-bm-folder eg-bm-other"); b.onclick = () => folderMenu("other", b); favBar.appendChild(b); }
      if (!favBar.childElementCount) favBar.appendChild(el(`<span class="eg-favbar-empty">For quick access, place your favorites here on the favorites bar.</span>`));
    }
    function folderItems(fid) {
      const items = subFolders(fid).map((fo) => ({ id: "fo-" + fo.id, label: fo.name, icon: IC.folder, sub: () => folderItems(fo.id) }));
      favsIn(fid).forEach((f) => items.push({ id: "fv-" + f.id, label: f.label, icon: iconFor(f.url), run: () => navigate(active, f.url) }));
      if (!items.length) items.push({ id: "empty", label: "(empty)", disabled: true });
      return items;
    }
    async function editFav(f) {
      const v = await promptDlg(shell, "Edit favorite", [{ label: "Name", value: f.label }, { label: "URL", value: f.url }], "Save");
      if (!v) return; f.label = v[0] || f.label; f.url = v[1] || f.url; save(); emit("fav");
    }
    function starPopover() {
      const t = active; if (!t || !t.here || t.kind === "home") { notify("Open a page first, then add it to favorites."); return; }
      let f = B.favs.find((x) => x.url === t.here); const isNew = !f;
      if (!f) { f = { id: uid(), label: (t.title || titleFor(t.here)).slice(0, 80), url: t.here, folder: "bar", ts: Date.now() }; B.favs.push(f); save(); emit("fav"); }
      const box = el(`<div class="eg-star"><div class="eg-star-h">${isNew ? "Favorite added" : "Edit favorite"}</div>
        <label class="eg-fld"><span>Name</span><input class="eg-star-name" value="${esc(f.label)}"></label>
        <label class="eg-fld"><span>Folder</span><select class="eg-star-folder">${allFolders().map((x) => `<option value="${esc(x.id)}" ${x.id === f.folder ? "selected" : ""}>${"\u00a0\u00a0".repeat(x.depth)}${esc(x.name)}</option>`).join("")}</select></label>
        <div class="eg-dlg-btns"><button class="eg-btn eg-star-more">More</button><span class="eg-grow"></span><button class="eg-btn eg-primary eg-star-done">Done</button><button class="eg-btn eg-star-rm">Remove</button></div></div>`);
      const name = box.querySelector(".eg-star-name"), fold = box.querySelector(".eg-star-folder");
      const commit = () => { f.label = name.value.trim() || f.label; if (fold.value !== f.folder) { f.folder = fold.value; B.favs = B.favs.filter((x) => x !== f).concat(f); } save(); emit("fav"); };
      name.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") { commit(); pm.close(); } });
      fold.onchange = commit;
      box.querySelector(".eg-star-done").onclick = () => { commit(); pm.close(); };
      box.querySelector(".eg-star-rm").onclick = () => { B.favs = B.favs.filter((x) => x !== f); save(); emit("fav"); pm.close(); };
      box.querySelector(".eg-star-more").onclick = () => { commit(); pm.close(); openInternal("favorites"); };
      const pm = popMenu([{ node: box }], favBtn, { trigger: favBtn });
      pm.el.classList.add("eg-star-pop");
      setTimeout(() => { try { name.focus(); name.select(); } catch (_) {} }, 30);
    }
    function openInternal(page) { const u = SCHEME + "://" + page; const ex = tabs.find((t) => t.here && internalOf(t.here) && internalOf(t.here).page === page.split("/")[0]); if (ex) { activate(ex); if (ex.here !== u) navigate(ex, u); return; } openTab(u, { activate: true, after: active }); }

    // ---------- flyouts (Favorites / History / Downloads hubs) ----------
    let fly = null;
    function closeFly() { if (fly) { fly.close(); fly = null; } }
    ctl.closeFly = closeFly;
    function flyout(kind, anchor, title, headBtns, paint) {
      if (fly && fly.kind === kind) { closeFly(); return null; }
      closeFly(); closePops();
      const f = el(`<div class="eg-fly eg-fly-${kind}" role="dialog" aria-label="${esc(title)}"><div class="eg-fly-h"><b>${esc(title)}</b><span class="eg-grow"></span><span class="eg-fly-hb"></span><button class="eg-ib eg-fly-x" title="Close" aria-label="Close">${IC.close}</button></div><div class="eg-fly-b"></div></div>`);
      const hb = f.querySelector(".eg-fly-hb");
      (headBtns || []).forEach((h) => { const b = el(`<button class="eg-ib ${h.cls || ""}" title="${esc(h.title)}" aria-label="${esc(h.title)}">${h.icon}</button>`); b.onclick = (e) => { e.stopPropagation(); h.run(b); }; hb.appendChild(b); });
      shell.appendChild(f);
      const sr = shell.getBoundingClientRect(), br = bar.getBoundingClientRect(), ar = (anchor && anchor.getClientRects().length ? anchor : body.querySelector(".bb-menu")).getBoundingClientRect();
      f.style.top = (br.bottom - sr.top + 2) + "px";
      f.style.right = Math.max(6, sr.right - ar.right - 4) + "px";
      f.style.maxHeight = Math.max(200, sr.bottom - br.bottom - 12) + "px";
      const b = f.querySelector(".eg-fly-b");
      const rerender = () => { if (!f.isConnected) return; const st = b.scrollTop; paint(b, f); b.scrollTop = st; };
      const ev = kind === "dl" ? "dl" : kind === "fav" ? "fav" : "hist";
      bus.addEventListener(ev, rerender);
      const outside = (e) => { if (!f.contains(e.target) && !(anchor && anchor.contains(e.target)) && !e.target.closest(".eg-menu,.eg-modal")) closeFly(); };
      setTimeout(() => document.addEventListener("pointerdown", outside, true), 0);
      const onBlur = () => setTimeout(() => { if (document.activeElement && document.activeElement.tagName === "IFRAME" && shell.contains(document.activeElement)) closeFly(); }, 0);
      window.addEventListener("blur", onBlur);
      fly = { kind, el: f, close: () => { bus.removeEventListener(ev, rerender); document.removeEventListener("pointerdown", outside, true); window.removeEventListener("blur", onBlur); f.remove(); } };
      f.querySelector(".eg-fly-x").onclick = closeFly;
      f.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); closeFly(); } });
      paint(b, f);
      return f;
    }
    function showDownloads(auto) {
      dlBtn.hidden = false;
      if (auto && fly && fly.kind === "dl") return;
      if (auto && !S.dlAutoOpen) return;
      flyout("dl", dlBtn, "Downloads", [
        { icon: IC.folder, title: "Open Downloads folder", cls: "eg-dl-openfolder", run: () => { if (window.FilesHelper) FilesHelper.open((S.dlFolder || ["Downloads"]).slice()); else { window.FilesStartPath = ["Downloads"]; WM.open("fileexplorer"); } } },
        { icon: IC.more, title: "More options", cls: "eg-dl-more", run: (b) => popMenu([{ id: "dl-page", label: "Open downloads page", icon: IC.open, kbd: "Ctrl+J", run: () => { closeFly(); openInternal("downloads"); } }, { id: "dl-ask", label: "Ask me where to save each file", checked: !!S.askWhere, run: () => { S.askWhere = !S.askWhere; save(); emit("set"); } }, { id: "dl-set", label: "Download settings", icon: IC.gear, run: () => { closeFly(); openInternal("settings/downloads"); } }, { sep: true }, { id: "dl-clear", label: "Clear all downloads history", icon: IC.trash, run: () => { B.downloads = B.downloads.filter((x) => x.state === "progress"); save(); emit("dl"); } }], b, { trigger: b }) },
      ], (b) => {
        b.innerHTML = "";
        const list = B.downloads.slice(0, 8);
        if (!list.length) b.appendChild(el(`<div class="eg-empty"><div class="eg-empty-ic">${IC.download}</div><b>No recent downloads</b><p>Files you download from pages open in this window will appear here.</p></div>`));
        list.forEach((it) => b.appendChild(dlRow(it, ctl)));
        if (B.downloads.length > 8) { const m = el(`<button class="eg-link eg-fly-all">See more (${B.downloads.length})</button>`); m.onclick = () => { closeFly(); openInternal("downloads"); }; b.appendChild(m); }
        b.appendChild(el(`<p class="eg-fly-note">${IC.info}<span>Saved to <b>${esc(winPath(S.dlFolder || ["Downloads"]))}</b>${S.askWhere ? " — Edge asks where to save each file" : ""}. Downloads started inside a page from another website (an embedded frame) can't be caught here — use “Open in a real tab” on that page to download them to your device instead.</span></p>`));
      });
    }
    function showHistory() {
      let tab = "all", q = "";
      flyout("hist", body.querySelector(".bb-menu"), "History", [
        { icon: IC.open, title: "Open history page", run: () => { closeFly(); openInternal("history"); } },
        { icon: IC.trash, title: "Clear browsing data", run: () => clearDataDialog() },
      ], (b) => {
        if (!b.querySelector(".eg-hf-top")) {
          b.innerHTML = `<div class="eg-hf-top"><div class="eg-seg"><button data-t="all" class="on">All</button><button data-t="closed">Recently closed</button></div><input class="eg-search" placeholder="Search history" aria-label="Search history"></div><div class="eg-hf-list"></div>`;
          b.querySelectorAll(".eg-seg button").forEach((x) => x.onclick = () => { tab = x.dataset.t; b.querySelectorAll(".eg-seg button").forEach((y) => y.classList.toggle("on", y === x)); paintList(); });
          const s = b.querySelector(".eg-search"); s.oninput = () => { q = s.value.toLowerCase(); paintList(); }; s.onkeydown = (e) => e.stopPropagation();
        }
        const paintList = () => {
          const l = b.querySelector(".eg-hf-list"); l.innerHTML = "";
          const src = tab === "closed" ? B.closedTabs.map((c) => ({ label: c.title || c.url, url: c.url, ts: c.ts, closed: c })) : B.history;
          const rows = src.filter((h) => !q || (h.label + " " + h.url).toLowerCase().includes(q)).slice(0, 60);
          if (!rows.length) { l.appendChild(el(`<div class="eg-empty"><b>${tab === "closed" ? "No recently closed tabs" : q ? "No results" : "No history yet"}</b></div>`)); return; }
          let day = "";
          rows.forEach((h) => {
            const d = dayLabel(h.ts); if (d !== day) { day = d; l.appendChild(el(`<div class="eg-day">${esc(d)}</div>`)); }
            const r = el(`<div class="eg-hrow"><span class="eg-hrow-ic">${iconFor(h.url)}</span><button class="eg-hrow-t" title="${esc(h.url)}">${esc(h.label)}<small>${esc(String(h.url).replace(/^(search|images):/, "Search: ").replace(/^https?:\/\//, ""))}</small></button><span class="eg-hrow-time">${esc(timeLabel(h.ts))}</span><button class="eg-ib eg-hrow-x" title="Delete" aria-label="Delete">${IC.close}</button></div>`);
            r.querySelector(".eg-hrow-t").onclick = () => { closeFly(); if (h.closed) { B.closedTabs = B.closedTabs.filter((x) => x !== h.closed); save(); const o = openTab(h.url, { activate: false }); o.tab.back = h.closed.back || []; activate(o.tab); } else navigate(active, h.url); };
            r.querySelector(".eg-hrow-x").onclick = (e) => { e.stopPropagation(); if (h.closed) B.closedTabs = B.closedTabs.filter((x) => x !== h.closed); else B.history = B.history.filter((x) => x !== h); save(); emit("hist"); };
            l.appendChild(r);
          });
        };
        paintList();
      });
    }
    function showFavorites() {
      let q = "";
      const open = new Set(["bar"]);
      flyout("fav", body.querySelector(".bb-favs"), isEdge ? "Favorites" : "Bookmarks", [
        { icon: IC.star, title: "Add this page to favorites", cls: "eg-ff-add", run: () => { closeFly(); starPopover(); } },
        { icon: IC.folder, title: "Add folder", cls: "eg-ff-folder", run: async () => { const v = await promptDlg(shell, "Add folder", [{ label: "Folder name", value: "New folder" }], "Add"); if (v && v[0]) { B.favFolders.push({ id: "f" + uid(), name: v[0], parent: "bar" }); save(); emit("fav"); } } },
        { icon: IC.open, title: "Open favorites page", cls: "eg-ff-page", run: () => { closeFly(); openInternal("favorites"); } },
      ], (b) => {
        if (!b.querySelector(".eg-search")) {
          b.innerHTML = `<input class="eg-search" placeholder="Search favorites" aria-label="Search favorites"><div class="eg-ff-tree"></div>`;
          const s = b.querySelector(".eg-search"); s.oninput = () => { q = s.value.toLowerCase(); paintTree(); }; s.onkeydown = (e) => e.stopPropagation();
        }
        const tree = b.querySelector(".eg-ff-tree");
        const favRow = (f, depth) => { const r = el(`<div class="eg-ff-row" style="--d:${depth}"><span class="eg-hrow-ic">${iconFor(f.url)}</span><button class="eg-ff-t" title="${esc(f.url)}">${esc(f.label)}</button><button class="eg-ib eg-ff-x" title="Delete" aria-label="Delete">${IC.close}</button></div>`); r.querySelector(".eg-ff-t").onclick = () => { closeFly(); navigate(active, f.url); }; r.querySelector(".eg-ff-x").onclick = () => { B.favs = B.favs.filter((x) => x !== f); save(); emit("fav"); }; return r; };
        const paintTree = () => {
          tree.innerHTML = "";
          if (q) { const hits = B.favs.filter((f) => (f.label + " " + f.url).toLowerCase().includes(q)); hits.forEach((f) => tree.appendChild(favRow(f, 0))); if (!hits.length) tree.appendChild(el(`<div class="eg-empty"><b>No results</b></div>`)); return; }
          const folder = (id, name, depth) => {
            const isOpen = open.has(id);
            const r = el(`<button class="eg-ff-folder${isOpen ? " open" : ""}" style="--d:${depth}" data-folder="${esc(id)}"><span class="eg-ff-chev">${IC.chevR}</span>${IC.folder}<span>${esc(name)}</span></button>`);
            r.onclick = () => { if (open.has(id)) open.delete(id); else open.add(id); paintTree(); };
            tree.appendChild(r);
            if (isOpen) { subFolders(id).forEach((fo) => folder(fo.id, fo.name, depth + 1)); favsIn(id).forEach((f) => tree.appendChild(favRow(f, depth + 1))); }
          };
          FAV_ROOTS.forEach((r) => folder(r.id, r.name, 0));
        };
        paintTree();
      });
    }

    // ---------- Collections side pane ----------
    let colView = null;   // null = list of collections, else collection id
    function toggleCollections() { if (!side.hidden) { side.hidden = true; win.classList.remove("eg-side-open"); bus.removeEventListener("col", paintSide); return; } openCollections(null); }
    function openCollections(id) {
      closeFly();
      colView = id || null; side.hidden = false; win.classList.add("eg-side-open");
      bus.removeEventListener("col", paintSide); bus.addEventListener("col", paintSide);
      paintSide();
    }
    function itemFromTab(t) { return { id: uid(), title: (t.title || titleFor(t.here)).slice(0, 140), url: t.here, ts: Date.now(), note: "" }; }
    async function snapActive(t) {
      if (!window.GBSnap || !GBSnap.render || !t || !t.pane.isConnected) return null;
      try {
        const scr = document.getElementById("screen") || document.body; const sr = scr.getBoundingClientRect(), pr = t.pane.getBoundingClientRect();
        const out = await GBSnap.render({ scale: 1 }); const c = out && out.canvas; if (!c) return null;
        const k = c.width / Math.max(1, sr.width);
        const sx = Math.max(0, (pr.left - sr.left) * k), sy = Math.max(0, (pr.top - sr.top) * k), sw = Math.min(c.width - sx, pr.width * k), sh = Math.min(c.height - sy, pr.height * k);
        if (sw < 4 || sh < 4) return null;
        const W = 320, H = Math.round(W * Math.min(sh / sw, 0.75)); const d = document.createElement("canvas"); d.width = W; d.height = H;
        d.getContext("2d").drawImage(c, sx, sy, sw, Math.min(sh, sw * 0.75), 0, 0, W, H);
        const blob = await new Promise((r) => d.toBlob(r, "image/jpeg", 0.72)); if (!blob) return null;
        return window.VFS && VFS.putBlob ? await VFS.putBlob(blob) : null;
      } catch (e) { return null; }
    }
    async function addToCollection(t, colId) {
      t = t || active; if (!t || !t.here || t.kind === "home") { notify("Open a page first, then add it to a collection."); return; }
      let c = colId ? B.collections.find((x) => x.id === colId) : null;
      if (!c) { c = B.collections[0]; if (!c) { c = { id: uid(), name: "New collection", items: [], ts: Date.now() }; B.collections.unshift(c); } }
      const it = itemFromTab(t); c.items.unshift(it); c.ts = Date.now(); save(); emit("col");
      if (side.hidden) openCollections(c.id); else if (colView !== c.id) { colView = c.id; paintSide(); }
      if (S.colShots) { const id = await snapActive(t); if (id) { it.shot = id; save(); emit("col"); } }
      return it;
    }
    function paintSide() {
      if (side.hidden) return;
      const c = colView ? B.collections.find((x) => x.id === colView) : null;
      if (colView && !c) colView = null;
      side.innerHTML = "";
      if (!c) {
        const v = el(`<div class="eg-col"><div class="eg-col-h"><b>Collections</b><span class="eg-grow"></span><button class="eg-ib eg-col-x" title="Close" aria-label="Close">${IC.close}</button></div>
          <button class="eg-col-new">${IC.plus}<span>Start new collection</span></button><div class="eg-col-list"></div></div>`);
        v.querySelector(".eg-col-x").onclick = toggleCollections;
        v.querySelector(".eg-col-new").onclick = async () => { const r = await promptDlg(shell, "New collection", [{ label: "Name", value: "New collection" }], "Create"); if (!r) return; const nc = { id: uid(), name: r[0] || "New collection", items: [], ts: Date.now() }; B.collections.unshift(nc); save(); colView = nc.id; emit("col"); };
        const l = v.querySelector(".eg-col-list");
        if (!B.collections.length) l.appendChild(el(`<div class="eg-empty"><div class="eg-empty-ic">${IC.collections}</div><b>Collect ideas as you browse</b><p>Save pages, notes and screenshots into collections, then open them all at once or export them.</p></div>`));
        B.collections.forEach((x) => {
          const r = el(`<button class="eg-col-card" data-id="${esc(x.id)}"><span class="eg-col-thumbs">${x.items.filter((i) => i.url).slice(0, 3).map((i) => `<span class="eg-col-th">${iconFor(i.url)}</span>`).join("") || IC.collections}</span><span class="eg-col-cn"><b>${esc(x.name)}</b><small>${x.items.length} item${x.items.length === 1 ? "" : "s"}</small></span></button>`);
          r.onclick = () => { colView = x.id; paintSide(); };
          l.appendChild(r);
        });
        side.appendChild(v); return;
      }
      const v = el(`<div class="eg-col"><div class="eg-col-h"><button class="eg-ib eg-col-back" title="All collections" aria-label="All collections">${IC.chevL}</button><input class="eg-col-name" value="${esc(c.name)}" aria-label="Collection name"><button class="eg-ib eg-col-more" title="More options" aria-label="More options">${IC.more}</button><button class="eg-ib eg-col-x" title="Close" aria-label="Close">${IC.close}</button></div>
        <div class="eg-col-acts"><button class="eg-btn eg-col-add">${IC.plus}<span>Add current page</span></button><button class="eg-ib eg-col-note" title="Add note" aria-label="Add note">${IC.note}</button><label class="eg-col-shot" title="${window.GBSnap ? "Save a screenshot with each page you add" : "Screenshots need Game Bar's renderer"}"><input type="checkbox" ${S.colShots ? "checked" : ""} ${window.GBSnap ? "" : "disabled"}>${IC.camera}</label></div>
        <div class="eg-col-items"></div></div>`);
      v.querySelector(".eg-col-back").onclick = () => { colView = null; paintSide(); };
      v.querySelector(".eg-col-x").onclick = toggleCollections;
      const nm = v.querySelector(".eg-col-name"); nm.onkeydown = (e) => { e.stopPropagation(); if (e.key === "Enter") nm.blur(); }; nm.onchange = () => { c.name = nm.value.trim() || c.name; save(); };
      v.querySelector(".eg-col-add").onclick = () => addToCollection(active, c.id);
      v.querySelector(".eg-col-note").onclick = async () => { const r = await promptDlg(shell, "Add note", [{ label: "Note", placeholder: "Type a note" }], "Add"); if (r && r[0]) { c.items.unshift({ id: uid(), kind: "note", note: r[0], ts: Date.now() }); save(); emit("col"); } };
      v.querySelector(".eg-col-shot input").onchange = (e) => { S.colShots = e.target.checked; save(); };
      v.querySelector(".eg-col-more").onclick = (e) => {
        const b = e.currentTarget;
        popMenu([
          { id: "col-openall", label: "Open all (" + c.items.filter((i) => i.url).length + ") as a tab group", icon: IC.group, disabled: !c.items.some((i) => i.url), run: () => { const made = c.items.filter((i) => i.url).map((i, k) => openTab(i.url, { activate: false }).tab); if (made.length) { groupTabs(made, { name: c.name.slice(0, 30), edit: false }); activate(made[0]); } } },
          { id: "col-export-html", label: "Export as HTML file (to Downloads)", icon: IC.download, run: () => startDownload({ blob: new Blob([colExportHTML(c)], { type: "text/html" }), name: c.name.replace(/[\\/:*?"<>|]/g, "_") + ".html", from: "edge://collections" }, ctl) },
          { id: "col-export-txt", label: "Export as text file (to Downloads)", icon: IC.note, run: () => startDownload({ blob: new Blob([colExportText(c)], { type: "text/plain" }), name: c.name.replace(/[\\/:*?"<>|]/g, "_") + ".txt", from: "edge://collections" }, ctl) },
          { id: "col-copy", label: "Copy all", icon: IC.copy, run: () => { try { navigator.clipboard.writeText(colExportText(c)).then(() => notify("Collection copied to the clipboard."), () => notify("Couldn't copy — use Export instead.")); } catch (_) { notify("Couldn't copy — use Export instead."); } } },
          { sep: true },
          { id: "col-del", label: "Delete collection", icon: IC.trash, danger: true, run: async () => { if (await confirmDlg(shell, "Delete collection?", `“${esc(c.name)}” and its ${c.items.length} item(s) will be deleted.`, "Delete")) { B.collections = B.collections.filter((x) => x !== c); save(); colView = null; emit("col"); } } },
        ], b, { trigger: b });
      };
      const l = v.querySelector(".eg-col-items");
      if (!c.items.length) l.appendChild(el(`<div class="eg-empty"><b>This collection is empty</b><p>Add the page you're on, or a note.</p></div>`));
      c.items.forEach((it) => {
        const r = el(it.kind === "note"
          ? `<div class="eg-ci eg-ci-note" data-id="${esc(it.id)}"><span class="eg-grip" title="Drag to reorder" aria-label="Drag to reorder">${IC.grip}</span><div class="eg-ci-b"><p class="eg-ci-notetext">${esc(it.note)}</p></div><button class="eg-ib eg-ci-more" title="More" aria-label="More">${IC.more}</button></div>`
          : `<div class="eg-ci" data-id="${esc(it.id)}"><span class="eg-grip" title="Drag to reorder" aria-label="Drag to reorder">${IC.grip}</span><div class="eg-ci-b"><div class="eg-ci-shot" hidden></div><button class="eg-ci-t" title="${esc(it.url)}"><span class="eg-ci-ic">${iconFor(it.url)}</span><span><b>${esc(it.title)}</b><small>${esc(String(it.url).replace(/^https?:\/\//, "").replace(/^(search|images):/, "Search: "))}</small></span></button>${it.note ? `<p class="eg-ci-notetext">${esc(it.note)}</p>` : ""}</div><button class="eg-ib eg-ci-more" title="More" aria-label="More">${IC.more}</button></div>`);
        const t = r.querySelector(".eg-ci-t"); if (t) t.onclick = () => navigate(active, it.url);
        if (it.shot) shotURL(it.shot).then((u) => { if (!u) return; const s = r.querySelector(".eg-ci-shot"); if (s) { s.hidden = false; s.innerHTML = `<img src="${u}" alt="Screenshot of ${esc(it.title)}">`; s.onclick = () => navigate(active, it.url); } });
        r.querySelector(".eg-ci-more").onclick = (e) => {
          const b = e.currentTarget;
          popMenu([
            it.url ? { id: "ci-newtab", label: "Open in new tab", icon: IC.plus, run: () => openTab(it.url, { activate: true, after: active }) } : null,
            { id: "ci-note", label: it.kind === "note" ? "Edit note" : it.note ? "Edit note" : "Add note", icon: IC.note, run: async () => { const x = await promptDlg(shell, it.kind === "note" ? "Edit note" : "Note for this page", [{ label: "Note", value: it.note || "" }], "Save"); if (x) { it.note = x[0]; if (it.kind === "note" && !it.note) c.items = c.items.filter((y) => y !== it); save(); emit("col"); } } },
            it.url ? { id: "ci-shot", label: it.shot ? "Retake screenshot" : "Add screenshot", icon: IC.camera, disabled: !window.GBSnap || !active || active.here !== it.url, run: async () => { const id = await snapActive(active); if (id) { it.shot = id; save(); emit("col"); } else notify("Couldn't take a screenshot of this page."); } } : null,
            { sep: true },
            { id: "ci-del", label: "Remove", icon: IC.trash, danger: true, run: () => { c.items = c.items.filter((y) => y !== it); save(); emit("col"); } },
          ], b, { trigger: b });
        };
        l.appendChild(r);
      });
      sortable(l, { item: ".eg-ci", handle: ".eg-grip", onMove: (from, to) => { const [x] = c.items.splice(from, 1); c.items.splice(to, 0, x); save(); emit("col"); } });
      side.appendChild(v);
    }

    // ---------- clear browsing data ----------
    async function clearDataDialog() {
      const md = modal(shell, `<h3>Clear browsing data</h3>
        <label class="eg-fld"><span>Time range</span><select class="eg-cd-range"><option value="3600000">Last hour</option><option value="86400000">Last 24 hours</option><option value="604800000">Last 7 days</option><option value="0" selected>All time</option></select></label>
        <label class="eg-chk"><input type="checkbox" class="eg-cd-hist" checked> Browsing history</label>
        <label class="eg-chk"><input type="checkbox" class="eg-cd-dl" checked> Download history <small>(the files stay in your folders)</small></label>
        <label class="eg-chk"><input type="checkbox" class="eg-cd-closed" checked> Recently closed tabs</label>
        <div class="eg-dlg-btns"><button class="eg-btn eg-cancel">Cancel</button><button class="eg-btn eg-primary eg-ok">Clear now</button></div>`);
      md.el.querySelector(".eg-cancel").onclick = md.close;
      md.el.querySelector(".eg-ok").onclick = () => {
        const range = +md.el.querySelector(".eg-cd-range").value, since = range ? Date.now() - range : 0;
        const keep = (x) => (x.ts || 0) < since;
        if (md.el.querySelector(".eg-cd-hist").checked) { B.history = B.history.filter(keep); tabs.forEach((t) => { if (!since) { t.back.length = 0; t.fwd.length = 0; } }); }
        if (md.el.querySelector(".eg-cd-dl").checked) B.downloads = B.downloads.filter((x) => x.state === "progress" || keep(x));
        if (md.el.querySelector(".eg-cd-closed").checked) B.closedTabs = B.closedTabs.filter(keep);
        save(); emit("hist"); emit("dl"); md.close(); notify("Browsing data cleared."); applyChrome();
      };
    }

    // ---------- edge:// pages ----------
    function renderInternal(t, iu) {
      const pane = t.pane;
      const page = el(`<div class="eg-int eg-int-${iu.page}"></div>`);
      pane.appendChild(page);
      const on = (ev, fn) => { bus.addEventListener(ev, fn); t.cleanup.push(() => bus.removeEventListener(ev, fn)); };
      if (iu.page === "history") pageHistory(t, page, on);
      else if (iu.page === "favorites") pageFavorites(t, page, on);
      else if (iu.page === "downloads") pageDownloads(t, page, on);
      else if (iu.page === "settings") pageSettings(t, page, on, iu.sub);
      else { t.title = "Page not found"; page.innerHTML = `<div class="eg-err"><h2>Hmmm… can't reach this page</h2><p>${esc(SCHEME)}://${esc(iu.raw || "")} isn't a page in this browser. Try ${SCHEME}://settings, ${SCHEME}://history, ${SCHEME}://favorites or ${SCHEME}://downloads.</p></div>`; }
    }
    function intHead(title, extra) { return `<div class="eg-int-h"><h1>${esc(title)}</h1><span class="eg-grow"></span>${extra || ""}</div>`; }
    function pageHistory(t, page, on) {
      let q = "", sel = new Set(), range = "all";
      page.innerHTML = `<div class="eg-int-side"><h2>History</h2><button class="eg-nav on" data-r="all">All</button><button class="eg-nav" data-r="today">Today</button><button class="eg-nav" data-r="yesterday">Yesterday</button><button class="eg-nav" data-r="week">Last week</button><button class="eg-nav" data-r="older">Older</button><button class="eg-nav" data-r="closed">Recently closed</button><button class="eg-nav eg-nav-clear">${IC.trash}<span>Clear browsing data</span></button></div>
        <div class="eg-int-main">${intHead("History", `<input class="eg-search eg-h-search" placeholder="Search history" aria-label="Search history">`)}<div class="eg-h-bar" hidden><span class="eg-h-n"></span><span class="eg-grow"></span><button class="eg-btn eg-h-cancel">Cancel</button><button class="eg-btn eg-primary eg-h-del">Delete</button></div><div class="eg-h-list"></div></div>`;
      const list = page.querySelector(".eg-h-list"), hbar = page.querySelector(".eg-h-bar");
      const inRange = (ts) => { const d = new Date(), today = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); if (range === "today") return ts >= today; if (range === "yesterday") return ts >= today - 864e5 && ts < today; if (range === "week") return ts >= today - 7 * 864e5; if (range === "older") return ts < today - 7 * 864e5; return true; };
      const paint = () => {
        list.innerHTML = "";
        const closed = range === "closed";
        const src = closed ? B.closedTabs.map((c) => ({ label: c.title || c.url, url: c.url, ts: c.ts, closed: c })) : B.history.filter((h) => inRange(h.ts));
        const rows = src.filter((h) => !q || (h.label + " " + h.url).toLowerCase().includes(q));
        if (!rows.length) list.appendChild(el(`<div class="eg-empty eg-empty-big"><div class="eg-empty-ic">${IC.history}</div><b>${q ? "No results found" : closed ? "No recently closed tabs" : "Your history will appear here"}</b><p>${q ? "Try a different search." : "Pages you visit in " + (isEdge ? "Microsoft Edge" : "Chrome") + " are listed here."}</p></div>`));
        let day = "", card = null;
        rows.forEach((h) => {
          const d = dayLabel(h.ts); if (d !== day) { day = d; card = el(`<div class="eg-card"><div class="eg-card-h">${esc(d)}</div></div>`); list.appendChild(card); }
          const r = el(`<div class="eg-hrow eg-hrow-big"><input type="checkbox" class="eg-h-chk" aria-label="Select"><span class="eg-hrow-time">${esc(timeLabel(h.ts))}</span><span class="eg-hrow-ic">${iconFor(h.url)}</span><button class="eg-hrow-t" title="${esc(h.url)}">${esc(h.label)}<small>${esc(String(h.url).replace(/^(search|images):/, "Search: ").replace(/^https?:\/\//, ""))}</small></button><button class="eg-ib eg-hrow-x" title="Delete" aria-label="Delete">${IC.close}</button></div>`);
          const chk = r.querySelector(".eg-h-chk"); chk.checked = sel.has(h.closed || h); chk.onchange = () => { if (chk.checked) sel.add(h.closed || h); else sel.delete(h.closed || h); selBar(); };
          r.querySelector(".eg-hrow-t").onclick = () => { if (h.closed) { B.closedTabs = B.closedTabs.filter((x) => x !== h.closed); save(); emit("hist"); } navigate(t, h.url); };
          r.querySelector(".eg-hrow-x").onclick = () => { if (h.closed) B.closedTabs = B.closedTabs.filter((x) => x !== h.closed); else B.history = B.history.filter((x) => x !== h); save(); emit("hist"); };
          card.appendChild(r);
        });
      };
      const selBar = () => { hbar.hidden = !sel.size; page.querySelector(".eg-h-n").textContent = sel.size + " selected"; };
      page.querySelectorAll(".eg-nav[data-r]").forEach((b) => b.onclick = () => { range = b.dataset.r; sel.clear(); selBar(); page.querySelectorAll(".eg-nav[data-r]").forEach((x) => x.classList.toggle("on", x === b)); paint(); });
      page.querySelector(".eg-nav-clear").onclick = clearDataDialog;
      const s = page.querySelector(".eg-h-search"); s.oninput = () => { q = s.value.toLowerCase(); paint(); };
      page.querySelector(".eg-h-cancel").onclick = () => { sel.clear(); selBar(); paint(); };
      page.querySelector(".eg-h-del").onclick = () => { B.history = B.history.filter((x) => !sel.has(x)); B.closedTabs = B.closedTabs.filter((x) => !sel.has(x)); sel.clear(); selBar(); save(); emit("hist"); };
      on("hist", paint); paint();
    }
    function pageFavorites(t, page, on) {
      let cur = "bar", q = "";
      page.innerHTML = `<div class="eg-int-side"><h2>${isEdge ? "Favorites" : "Bookmarks"}</h2><div class="eg-fm-tree"></div></div>
        <div class="eg-int-main">${intHead(isEdge ? "Favorites" : "Bookmarks", `<input class="eg-search eg-fm-search" placeholder="Search favorites" aria-label="Search favorites"><button class="eg-btn eg-fm-addfav">${IC.star}<span>Add favorite</span></button><button class="eg-btn eg-fm-addfolder">${IC.folder}<span>Add folder</span></button><button class="eg-ib eg-fm-more" title="More options" aria-label="More options">${IC.more}</button>`)}<div class="eg-fm-crumb"></div><div class="eg-card eg-fm-list"></div></div>`;
      const tree = page.querySelector(".eg-fm-tree"), list = page.querySelector(".eg-fm-list"), crumb = page.querySelector(".eg-fm-crumb");
      const crumbPath = (id) => { const out = []; let f = B.favFolders.find((x) => x.id === id); out.unshift(folderName(id)); while (f && f.parent) { out.unshift(folderName(f.parent)); f = B.favFolders.find((x) => x.id === f.parent); } return out; };
      const paintTree = () => {
        tree.innerHTML = "";
        allFolders().forEach((f) => { const b = el(`<button class="eg-nav eg-fm-f${f.id === cur ? " on" : ""}" data-folder="${esc(f.id)}" style="--d:${f.depth}">${IC.folder}<span>${esc(f.name)}</span><small>${favsIn(f.id).length || ""}</small></button>`); b.onclick = () => { cur = f.id; q = ""; page.querySelector(".eg-fm-search").value = ""; paint(); }; tree.appendChild(b); });
      };
      const paint = () => {
        paintTree();
        crumb.textContent = q ? "Search results" : crumbPath(cur).join(" › ");
        list.innerHTML = "";
        const folders = q ? [] : subFolders(cur);
        const favs = q ? B.favs.filter((f) => (f.label + " " + f.url).toLowerCase().includes(q)) : favsIn(cur);
        if (!folders.length && !favs.length) list.appendChild(el(`<div class="eg-empty"><b>${q ? "No results found" : "This folder is empty"}</b><p>${q ? "" : "Use ☆ in the address bar to add the page you're on."}</p></div>`));
        folders.forEach((fo) => {
          const r = el(`<div class="eg-fm-row eg-fm-folder" data-folder="${esc(fo.id)}"><span class="eg-grip eg-grip-off"></span><span class="eg-hrow-ic">${IC.folder}</span><button class="eg-fm-t">${esc(fo.name)}<small>${favsIn(fo.id).length} item(s)</small></button><button class="eg-ib eg-fm-rmore" title="More" aria-label="More">${IC.more}</button></div>`);
          r.querySelector(".eg-fm-t").onclick = () => { cur = fo.id; paint(); };
          r.querySelector(".eg-fm-rmore").onclick = (e) => popMenu([{ id: "fo-rename", label: "Rename", icon: IC.edit, run: async () => { const v = await promptDlg(shell, "Rename folder", [{ label: "Name", value: fo.name }], "Save"); if (v && v[0]) { fo.name = v[0]; save(); emit("fav"); } } }, { id: "fo-del", label: "Delete folder", icon: IC.trash, danger: true, run: async () => { if (await confirmDlg(shell, "Delete folder?", `“${esc(fo.name)}” and everything in it will be deleted.`, "Delete")) { deleteFolder(fo.id); save(); emit("fav"); } } }], e.currentTarget, { trigger: e.currentTarget });
          list.appendChild(r);
        });
        favs.forEach((f) => {
          const r = el(`<div class="eg-fm-row eg-fm-fav" data-id="${esc(f.id)}"><span class="eg-grip${q ? " eg-grip-off" : ""}" title="Drag to reorder or onto a folder" aria-label="Drag">${q ? "" : IC.grip}</span><span class="eg-hrow-ic">${iconFor(f.url)}</span><button class="eg-fm-t" title="${esc(f.url)}">${esc(f.label)}<small>${esc(f.url)}${q ? " · " + esc(folderName(f.folder)) : ""}</small></button><button class="eg-ib eg-fm-rmore" title="More" aria-label="More">${IC.more}</button></div>`);
          r.querySelector(".eg-fm-t").onclick = () => navigate(t, f.url);
          r.querySelector(".eg-fm-rmore").onclick = (e) => popMenu([
            { id: "fv-newtab", label: "Open in new tab", icon: IC.plus, run: () => openTab(f.url, { activate: true, after: t }) },
            { id: "fv-edit", label: "Edit", icon: IC.edit, run: () => editFav(f) },
            { id: "fv-move", label: "Move to", icon: IC.folder, sub: () => allFolders().filter((x) => x.id !== f.folder).map((x) => ({ id: "mv-" + x.id, label: "\u00a0".repeat(x.depth * 2) + x.name, icon: IC.folder, run: () => moveFav(f.id, x.id) })) },
            { id: "fv-del", label: "Delete", icon: IC.trash, danger: true, run: () => { B.favs = B.favs.filter((x) => x !== f); save(); emit("fav"); } }], e.currentTarget, { trigger: e.currentTarget });
          list.appendChild(r);
        });
        shown = q ? [] : favs;
      };
      let shown = [];
      sortable(list, { item: ".eg-fm-fav", handle: ".eg-grip:not(.eg-grip-off)", targets: () => [...tree.querySelectorAll("[data-folder]"), ...list.querySelectorAll(".eg-fm-folder")].filter((x) => x.dataset.folder !== cur),
        onMove: (from, to) => { const ids = shown.map((f) => f.id); const moving = ids[from]; if (!moving) return; const before = to < from ? ids[to] : ids[to + 1]; moveFav(moving, cur, before || null); },
        onTarget: (from, target) => { if (!shown[from]) return; moveFav(shown[from].id, target.dataset.folder); notify("Moved to " + folderName(target.dataset.folder) + "."); } });
      const s = page.querySelector(".eg-fm-search"); s.oninput = () => { q = s.value.toLowerCase(); paint(); };
      page.querySelector(".eg-fm-addfav").onclick = async () => { const v = await promptDlg(shell, "Add favorite", [{ label: "Name", placeholder: "Name" }, { label: "URL", placeholder: "example.com" }], "Save"); if (v && v[1]) { B.favs.push({ id: uid(), label: v[0] || titleFor(v[1]), url: v[1], folder: cur, ts: Date.now() }); save(); emit("fav"); } };
      page.querySelector(".eg-fm-addfolder").onclick = async () => { const v = await promptDlg(shell, "Add folder", [{ label: "Folder name", value: "New folder" }], "Add"); if (v && v[0]) { B.favFolders.push({ id: "f" + uid(), name: v[0], parent: cur }); save(); emit("fav"); } };
      const doImport = (text) => { try { const n = importBookmarks(text); notify(n + " favorite" + (n === 1 ? "" : "s") + " imported into “Imported favorites”."); cur = "bar"; paint(); } catch (e) { notify(e.message || "Couldn't read that file."); } };
      page.querySelector(".eg-fm-more").onclick = (e) => popMenu([
        { id: "fm-import-device", label: "Import favorites from a file on this device", icon: IC.up, run: () => { const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".html,.htm,text/html"; inp.onchange = () => { const f = inp.files && inp.files[0]; if (f) f.text().then(doImport); }; inp.click(); } },
        { id: "fm-import-vfs", label: "Import favorites from File Explorer", icon: IC.folder, run: () => { if (!window.VFS || !VFS.pickFile) return; VFS.pickFile({ title: "Import favorites" }, (r) => { if (!r || !r.node) return; nodeBlob(r.node, r.name).then((b) => b.text()).then(doImport).catch((er) => notify(er.message)); }); } },
        { id: "fm-export", label: "Export favorites (to Downloads)", icon: IC.download, run: () => { const d = new Date(); startDownload({ blob: new Blob([exportBookmarks()], { type: "text/html" }), name: `favorites_${d.getMonth() + 1}_${d.getDate()}_${String(d.getFullYear()).slice(2)}.html`, from: SCHEME + "://favorites" }, ctl); } },
        { sep: true },
        { id: "fm-bar", label: (S.favBar === "never" ? "Show" : "Hide") + " favorites bar", icon: IC.favs, run: () => { S.favBar = S.favBar === "never" ? "always" : "never"; S.bookmarks = S.favBar !== "never"; save(); emit("set"); } },
      ], e.currentTarget, { trigger: e.currentTarget });
      on("fav", paint); paint();
    }
    function pageDownloads(t, page, on) {
      let q = "";
      page.innerHTML = `<div class="eg-int-main eg-int-wide">${intHead("Downloads", `<input class="eg-search eg-dp-search" placeholder="Search downloads" aria-label="Search downloads"><button class="eg-btn eg-dp-folder">${IC.folder}<span>Open Downloads folder</span></button><button class="eg-ib eg-dp-more" title="More options" aria-label="More options">${IC.more}</button>`)}<div class="eg-dp-list"></div>
        <p class="eg-fly-note">${IC.info}<span>Files you download from pages in ${isEdge ? "Edge" : "Chrome"} are saved in this PC's file system (open them in File Explorer). Downloads started inside a page from another website can't be caught — browsers don't let one site see another site's files — so use “Open in a real tab” on that page to download them to your device instead.</span></p></div>`;
      const list = page.querySelector(".eg-dp-list");
      const paint = () => {
        list.innerHTML = "";
        const rows = B.downloads.filter((d) => !q || (d.name + " " + d.url).toLowerCase().includes(q));
        if (!rows.length) list.appendChild(el(`<div class="eg-empty eg-empty-big"><div class="eg-empty-ic">${IC.download}</div><b>${q ? "No results found" : "No downloads yet"}</b><p>${q ? "" : "Files you download appear here."}</p></div>`));
        let day = "", card = null;
        rows.forEach((d) => { const dl = dayLabel(d.ts); if (dl !== day) { day = dl; card = el(`<div class="eg-card"><div class="eg-card-h">${esc(dl)}</div></div>`); list.appendChild(card); } card.appendChild(dlRow(d, ctl, true)); });
      };
      const s = page.querySelector(".eg-dp-search"); s.oninput = () => { q = s.value.toLowerCase(); paint(); };
      page.querySelector(".eg-dp-folder").onclick = () => { if (window.FilesHelper) FilesHelper.open((S.dlFolder || ["Downloads"]).slice()); };
      page.querySelector(".eg-dp-more").onclick = (e) => popMenu([{ id: "dp-clear", label: "Clear all downloads history", icon: IC.trash, run: () => { B.downloads = B.downloads.filter((x) => x.state === "progress"); save(); emit("dl"); } }, { id: "dp-set", label: "Download settings", icon: IC.gear, run: () => navigate(t, SCHEME + "://settings/downloads") }], e.currentTarget, { trigger: e.currentTarget });
      on("dl", paint); paint();
    }
    function pageSettings(t, page, on, sub) {
      const sf = safety();
      const secs = [["privacy", "Privacy, search, and services", IC.lock], ["appearance", "Appearance", IC.tabacts], ["start", "Start, home, and new tabs", IC.home], ["downloads", "Downloads", IC.download], ["system", "System and performance", IC.moon], ["pdf", "PDF documents", IC.file], ["reset", "Reset settings", IC.retry]];
      page.innerHTML = `<div class="eg-int-side"><h2>Settings</h2>${secs.map((s) => `<button class="eg-nav" data-s="${s[0]}">${s[2]}<span>${esc(s[1])}</span></button>`).join("")}</div><div class="eg-int-main eg-set"></div>`;
      const main = page.querySelector(".eg-set");
      const row = (title, desc, ctrl, cls) => `<div class="eg-set-row ${cls || ""}"><div><b>${title}</b>${desc ? `<p>${desc}</p>` : ""}</div><div class="eg-set-c">${ctrl}</div></div>`;
      const tog = (cls, on2, dis) => `<label class="eg-switch"><input type="checkbox" class="${cls}" ${on2 ? "checked" : ""} ${dis ? "disabled" : ""}><i></i></label>`;
      const sel = (cls, opts2, v) => `<select class="${cls}">${opts2.map((o) => `<option value="${esc(o[0])}" ${String(o[0]) === String(v) ? "selected" : ""}>${esc(o[1])}</option>`).join("")}</select>`;
      const paint = () => {
        main.innerHTML = `${intHead("Settings")}
        <section id="eg-set-privacy"><h2>Privacy, search, and services</h2><div class="eg-card">
          ${row("SafeSearch", sf.locked ? "🔒 Locked on — " + (sf.famLocked ? "set by your family settings." : "you said you're under 18.") : safeOn() ? "On. Adult sites are blocked and Google uses SafeSearch." : "Off. Adult sites show a warning first.", `<label class="eg-switch"><input type="checkbox" class="bb-set-safe" ${safeOn() ? "checked" : ""} ${sf.locked || !sf.asked ? "disabled" : ""}><i></i></label>`)}
          ${row("Clear browsing data", "History, download history and recently closed tabs.", `<button class="eg-btn eg-set-clear">Choose what to clear</button>`)}
          ${row("Browsing history", B.history.length + " entries", `<button class="eg-btn bb-set-hist">Clear browsing history (${B.history.length})</button>`)}
          ${row("Favorites", B.favs.length + " favorites", `<button class="eg-btn bb-set-favs">Remove all favorites (${B.favs.length})</button>`)}
        </div><p class="eg-dim">Searches show results from Wikipedia inside the app; images come from Wikimedia Commons.</p></section>
        <section id="eg-set-appearance"><h2>Appearance</h2><div class="eg-card">
          ${row("Show favorites bar", "", sel("eg-set-favbar", [["always", "Always"], ["never", "Never"], ["newtab", "Only on new tabs"]], S.favBar) + `<input type="checkbox" class="bb-set-bm" ${S.favBar !== "never" ? "checked" : ""} hidden>`)}
          ${isEdge ? row("Vertical tabs", "Show tabs in a pane on the side of the window.", tog("eg-set-vert", S.vertical)) : ""}
          ${isEdge ? row("Collections button", "Show the Collections button on the toolbar.", tog("eg-set-colbtn", S.showColBtn)) : ""}
        </div></section>
        <section id="eg-set-start"><h2>Start, home, and new tabs</h2><div class="eg-card">
          ${row("When " + (isEdge ? "Edge" : "Chrome") + " starts", "", sel("eg-set-startup", [["restore", "Continue where you left off"], ["newtab", "Open the new tab page"]], S.startup))}
          ${isEdge ? row("New tab page background", "", sel("eg-set-ntpbg", [["image", "Image of the day"], ["gradient", "Edge blue"], ["off", "Off"]], S.ntpBg)) : ""}
          ${isEdge ? row("Quick links", "", tog("eg-set-quick", S.ntpQuick)) : ""}
          ${isEdge ? row("News feed", "", tog("eg-set-feed", S.ntpFeed)) : ""}
        </div></section>
        <section id="eg-set-downloads"><h2>Downloads</h2><div class="eg-card">
          ${row("Location", `<span class="eg-set-loc">${esc(winPath(S.dlFolder || ["Downloads"]))}</span>`, `<button class="eg-btn eg-set-change">Change</button>`)}
          ${row("Ask me what to do with each download", "Choose a folder and file name every time you download something.", tog("eg-set-ask", S.askWhere))}
          ${row("Show downloads menu when a download starts", "", tog("eg-set-dlopen", S.dlAutoOpen))}
        </div><p class="eg-dim">Only downloads from built-in sites, this PC's files and same-site pages can be saved here. A website shown inside the window from another site can't hand its files to ${isEdge ? "Edge" : "Chrome"} — open it in a real tab to download.</p></section>
        <section id="eg-set-system"><h2>System and performance</h2><div class="eg-card">
          ${row("Save resources with sleeping tabs", "Background tabs are unloaded after the time below and reload when you go back to them. Tabs playing audio don't sleep.", tog("eg-set-sleep", S.sleep))}
          ${row("Put inactive tabs to sleep after", "", sel("eg-set-sleepmins", [[5, "5 minutes of inactivity"], [15, "15 minutes of inactivity"], [30, "30 minutes of inactivity"], [60, "1 hour of inactivity"], [120, "2 hours of inactivity"]], S.sleepMins))}
        </div></section>
        <section id="eg-set-pdf"><h2>PDF documents</h2><div class="eg-card">
          ${row("Open PDFs with", "The built-in viewer (pdf.js) works on every device — including iPad — and supports page numbers, zoom, rotate, drawing, highlighting and printing. The device viewer uses your browser's own PDF reader (not available inside apps on iPad).", sel("eg-set-pdf", [["pdfjs", "Built-in viewer"], ["native", "Your device's viewer"]], S.pdfEngine))}
        </div></section>
        <section id="eg-set-reset"><h2>Reset settings</h2><div class="eg-card">
          ${row("Restore settings to their default values", "Favorites, history, collections and downloads aren't deleted.", `<button class="eg-btn eg-set-reset">Reset</button>`)}
        </div></section>`;
        const $ = (s) => main.querySelector(s);
        const bind = (s, fn) => { const x = $(s); if (x) x.onchange = (e) => { fn(e.target); save(); emit("set"); }; };
        const safe = $(".bb-set-safe"); safe.onchange = (e) => { if (sf.locked) { e.target.checked = true; return; } sf.safeSearch = e.target.checked; save(); notify("SafeSearch is " + (sf.safeSearch ? "on." : "off.")); paint(); };
        $(".eg-set-clear").onclick = clearDataDialog;
        $(".bb-set-hist").onclick = () => { B.history = []; tabs.forEach((x) => { x.back.length = 0; x.fwd.length = 0; }); save(); emit("hist"); notify("Browsing history cleared."); paint(); applyChrome(); };
        $(".bb-set-favs").onclick = async () => { if (!(await confirmDlg(shell, "Remove all favorites?", "All " + B.favs.length + " favorites and their folders will be deleted.", "Remove all"))) return; B.favs = []; B.favFolders = []; save(); emit("fav"); notify("Favorites removed."); paint(); };
        bind(".eg-set-favbar", (x) => { S.favBar = x.value; S.bookmarks = x.value !== "never"; });
        bind(".eg-set-vert", (x) => { S.vertical = x.checked; CTLS.forEach((c) => c.applyLayout()); });
        bind(".eg-set-colbtn", (x) => { S.showColBtn = x.checked; });
        bind(".eg-set-startup", (x) => { S.startup = x.value; });
        bind(".eg-set-ntpbg", (x) => { S.ntpBg = x.value; });
        bind(".eg-set-quick", (x) => { S.ntpQuick = x.checked; });
        bind(".eg-set-feed", (x) => { S.ntpFeed = x.checked; });
        bind(".eg-set-ask", (x) => { S.askWhere = x.checked; });
        bind(".eg-set-dlopen", (x) => { S.dlAutoOpen = x.checked; });
        bind(".eg-set-sleep", (x) => { S.sleep = x.checked; });
        bind(".eg-set-sleepmins", (x) => { S.sleepMins = +x.value; });
        bind(".eg-set-pdf", (x) => { S.pdfEngine = x.value; });
        $(".eg-set-change").onclick = async () => { const r = await saveAsDialog(shell, { folderOnly: true, folder: S.dlFolder, title: "Choose a download folder" }); if (r) { S.dlFolder = r.folder; save(); emit("set"); paint(); } };
        $(".eg-set-reset").onclick = async () => { if (!(await confirmDlg(shell, "Reset settings?", "Your browser settings go back to their defaults.", "Reset"))) return; Object.keys(S).forEach((k) => delete S[k]); bstore(); save(); emit("set"); CTLS.forEach((c) => c.applyLayout()); paint(); };
      };
      const go = (id) => { page.querySelectorAll(".eg-nav[data-s]").forEach((b) => b.classList.toggle("on", b.dataset.s === id)); const s = main.querySelector("#eg-set-" + id); if (s) { try { s.scrollIntoView({ block: "start" }); } catch (_) {} } };
      page.querySelectorAll(".eg-nav[data-s]").forEach((b) => b.onclick = () => { go(b.dataset.s); t.here = SCHEME + "://settings/" + b.dataset.s; t.addr = t.here; if (t === active) applyChrome(); });
      on("set", () => { if (!main.contains(document.activeElement) || document.activeElement.tagName !== "SELECT") paint(); });
      paint();
      if (sub) setTimeout(() => go(sub), 30);
    }

    // ---------- toolbar wiring ----------
    body.querySelector(".bb-nav.reload").onclick = () => { if (active) navigate(active, active.here || "home", false); };
    body.querySelector(".bb-nav.back").onclick = () => goBack(active);
    body.querySelector(".bb-nav.fwd").onclick = () => goFwd(active);
    body.querySelector(".home-btn").onclick = () => navigate(active, "home");
    favBtn.onclick = (e) => { e.stopPropagation(); starPopover(); };
    body.querySelector(".bb-favs").onclick = () => showFavorites();
    const colBtn = body.querySelector(".bb-collections"); if (colBtn) colBtn.onclick = () => toggleCollections();
    dlBtn.onclick = () => showDownloads(false);
    siteBtn.onclick = (e) => {
      const t = active; if (!t) return;
      const s = t.secure;
      const txt = s === "secure" ? "Connection is secure" : s === "insecure" ? "Your connection to this site isn't secure" : s === "file" ? "This is a file stored on this PC" : t.kind === "internal" ? "You're viewing a secure " + (isEdge ? "Microsoft Edge" : "Chrome") + " page" : t.kind === "home" ? "New tab" : "Site information";
      popMenu([{ node: el(`<div class="eg-mh">${esc(txt)}</div>`) }, t.here && t.kind !== "home" ? { node: el(`<div class="eg-mp">${esc(t.addr || t.here)}</div>`) } : null, { sep: true }, { id: "si-copy", label: "Copy link", icon: IC.copy, disabled: !t.here || t.kind === "home", run: () => { try { navigator.clipboard.writeText(t.addr || t.here); } catch (_) {} } }], siteBtn, { alignLeft: true, trigger: siteBtn });
    };
    let speaking = false;
    body.querySelector(".bb-read").onclick = () => {
      if (!window.speechSynthesis) { notify("Read aloud isn't available here."); return; }
      if (speaking) { speechSynthesis.cancel(); speaking = false; return; }
      const txt = ((active && active.pane.innerText) || "").trim().slice(0, 700);
      if (!txt) { notify("Nothing to read on this page."); return; }
      const u = new SpeechSynthesisUtterance(txt); u.onend = () => { speaking = false; };
      speechSynthesis.cancel(); speechSynthesis.speak(u); speaking = true;
      notify("Reading this page aloud…");
    };
    function setZoom(d) { const t = active; if (!t) return; t.zoom = d === 0 ? 1 : Math.max(0.5, Math.min(2, Math.round((t.zoom + d) * 10) / 10)); t.pane.style.zoom = t.zoom === 1 ? "" : String(t.zoom); return t.zoom; }
    body.querySelector(".bb-menu").onclick = (ev) => {
      const btn = ev.currentTarget;
      const zoomRow = el(`<div class="eg-zoomrow"><span>Zoom</span><span class="eg-grow"></span><button class="eg-ib eg-z-out" aria-label="Zoom out">${IC.zoomOut}</button><span class="eg-z-v">${Math.round(((active && active.zoom) || 1) * 100)}%</span><button class="eg-ib eg-z-in" aria-label="Zoom in">${IC.zoomIn}</button></div>`);
      zoomRow.querySelector(".eg-z-in").onclick = (e) => { e.stopPropagation(); zoomRow.querySelector(".eg-z-v").textContent = Math.round(setZoom(0.1) * 100) + "%"; };
      zoomRow.querySelector(".eg-z-out").onclick = (e) => { e.stopPropagation(); zoomRow.querySelector(".eg-z-v").textContent = Math.round(setZoom(-0.1) * 100) + "%"; };
      popMenu([
        { id: "newtab", label: "New tab", icon: IC.plus, kbd: "Ctrl+T", run: () => newTab() },
        { id: "newwin", label: "New window", icon: IC.win, kbd: "Ctrl+N", run: () => openBrowser(createWindow, "home", Object.assign({}, opts, { restore: false })) },
        { sep: true }, { node: zoomRow }, { sep: true },
        { id: "fav", label: isEdge ? "Favorites" : "Bookmarks", icon: IC.favs, kbd: "Ctrl+Shift+O", run: () => showFavorites() },
        { id: "history", label: "History", icon: IC.history, kbd: "Ctrl+H", run: () => showHistory() },
        { id: "downloads", label: "Downloads", icon: IC.download, kbd: "Ctrl+J", run: () => showDownloads(false) },
        isEdge ? { id: "collections", label: "Collections", icon: IC.collections, kbd: "Ctrl+Shift+Y", run: () => toggleCollections() } : null,
        { sep: true },
        { id: "reopen", label: "Reopen closed tab", icon: IC.history, kbd: "Ctrl+Shift+T", disabled: !B.closedTabs.length, run: reopenClosed },
        isEdge ? { id: "vertical", label: S.vertical ? "Turn off vertical tabs" : "Turn on vertical tabs", icon: S.vertical ? IC.htabs : IC.vtabs, kbd: "Ctrl+Shift+,", run: toggleVertical } : null,
        { id: "favbar", label: "Show favorites bar", checked: S.favBar !== "never", kbd: "Ctrl+Shift+B", run: () => { S.favBar = S.favBar === "never" ? "always" : "never"; S.bookmarks = S.favBar !== "never"; save(); emit("set"); } },
        { id: "read", label: "Read aloud", icon: IC.read, kbd: "Ctrl+Shift+U", run: () => body.querySelector(".bb-read").click() },
        active && active.pdf ? { id: "print", label: "Print", icon: IC.print, kbd: "Ctrl+P", run: () => active.pdf.print() } : null,
        { sep: true },
        { id: "settings", label: "Settings", icon: IC.gear, run: () => openInternal("settings") },
        { id: "close", label: "Close " + (isEdge ? "Microsoft Edge" : "Google Chrome"), run: () => ref.close() },
      ], btn, { trigger: btn });
    };

    // ---------- address bar suggestions ----------
    const sugg = el(`<div class="bb-suggest" hidden></div>`);
    body.querySelector(".addr").appendChild(sugg);
    let sIdx = -1, sItems = [];
    function hideSugg() { sugg.hidden = true; sIdx = -1; }
    function paintSugg() {
      const tx = urlInput.value.trim(), tl = tx.toLowerCase(); sugg.innerHTML = ""; sItems = [];
      const add = (html, go, cls, del) => { const r = el(`<div class="bb-s-row ${cls || ""}">${html}${del ? '<button class="bb-s-del" title="Remove">✕</button>' : ""}</div>`); r.onmousedown = (e) => { e.preventDefault(); if (e.target.closest(".bb-s-del")) { del(); paintSugg(); urlInput.focus(); return; } hideSugg(); go(); }; sugg.appendChild(r); sItems.push({ r, go }); };
      const IC2 = { clock: "🕘", search: "🔍", globe: "🌐", star: "⭐", img: "🖼️", tab: "🗂️" };
      if (tx && !isUrlLike(tx) && window.Brain) {
        try {
          const a = Brain.answer(tx);
          if (a && a.confident && a.source !== "fallback") {
            const txt = a.text.replace(/```[\s\S]*?```/g, "[code]").replace(/\*\*|__|`/g, "").replace(/\*([^*]+)\*/g, "$1").replace(/\n+/g, " ").trim();
            const card = el(`<div class="bb-s-answer"><div class="bb-s-ans-h">${(window.Icon ? Icon.mini("copilot", "Copilot") : "")}<b>Quick answer</b></div><div class="bb-s-ans-t">${esc(txt.length > 260 ? txt.slice(0, 257) + "…" : txt)}</div></div>`);
            card.onmousedown = (e) => { e.preventDefault(); hideSugg(); if (window.WM) WM.open("copilot"); };
            sugg.appendChild(card);
          }
        } catch (_) {}
      }
      if (tx) add(`<span class="bb-s-ic">${isUrlLike(tx) ? IC2.globe : IC2.search}</span><span class="bb-s-t">${isUrlLike(tx) ? esc(tx) : "Search for <b>" + esc(tx) + "</b>"}</span>`, () => navigate(active, tx));
      const sh = B.history.filter((h) => /^(search|images):/.test(h.url));
      const hist = sh.filter((h) => !tx || h.label.toLowerCase().includes(tl)).filter((h) => h.label.toLowerCase() !== tl).slice(0, tx ? 4 : 8);
      if (!tx && hist.length) sugg.appendChild(el(`<div class="bb-s-head"><span>Recent searches</span><button class="bb-s-clear">Clear</button></div>`));
      hist.forEach((h) => add(`<span class="bb-s-ic">${h.url.startsWith("images:") ? IC2.img : IC2.clock}</span><span class="bb-s-t">${esc(h.label)}</span>`, () => navigate(active, h.url), "bb-s-hist", () => { B.history = B.history.filter((x) => x !== h); save(); }));
      if (tx) {
        tabs.filter((t) => t !== active && t.here && (t.title + " " + t.here).toLowerCase().includes(tl)).slice(0, 2).forEach((t) => add(`<span class="bb-s-ic">${IC2.tab}</span><span class="bb-s-t">${esc(t.title)}<small>Switch to this tab</small></span>`, () => activate(t)));
        const seen = new Set();
        B.history.filter((h) => !/^(search|images):/.test(h.url) && (h.label + " " + h.url).toLowerCase().includes(tl)).slice(0, 3).forEach((h) => { if (seen.has(h.url)) return; seen.add(h.url); add(`<span class="bb-s-ic">${IC2.globe}</span><span class="bb-s-t">${esc(h.label)}<small>${esc(h.url.replace(/^https?:\/\//, ""))}</small></span>`, () => navigate(active, h.url)); });
        B.favs.filter((b) => (b.label + " " + b.url).toLowerCase().includes(tl)).slice(0, 3).forEach((b) => add(`<span class="bb-s-ic">${IC2.star}</span><span class="bb-s-t">${esc(b.label)}<small>${esc(String(b.url).replace(/^https?:\/\//, ""))}</small></span>`, () => navigate(active, b.url)));
        if (!isUrlLike(tx)) add(`<span class="bb-s-ic">${IC2.img}</span><span class="bb-s-t">Images of <b>${esc(tx)}</b></span>`, () => navigate(active, "images:" + tx));
      }
      const clr = sugg.querySelector(".bb-s-clear");
      if (clr) clr.onmousedown = (e) => { e.preventDefault(); B.history = B.history.filter((h) => !/^(search|images):/.test(h.url)); save(); paintSugg(); };
      sugg.hidden = !sugg.childElementCount; sIdx = -1;
    }
    urlInput.addEventListener("focus", () => { urlInput.select(); paintSugg(); if (window.Brain && Brain.load) Brain.load().then(() => { if (document.activeElement === urlInput) paintSugg(); }).catch(() => {}); });
    urlInput.addEventListener("input", paintSugg);
    urlInput.addEventListener("blur", () => setTimeout(() => { hideSugg(); if (active && document.activeElement !== urlInput) urlInput.value = active.addr || ""; }, 150));
    urlInput.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { if (sugg.hidden || !sItems.length) return; e.preventDefault(); sIdx = (sIdx + (e.key === "ArrowDown" ? 1 : -1) + sItems.length) % sItems.length; sItems.forEach((s, i) => s.r.classList.toggle("on", i === sIdx)); }
      else if (e.key === "Escape") { hideSugg(); urlInput.value = (active && active.addr) || ""; }
      else if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); const pick = sIdx >= 0 && sItems[sIdx]; hideSugg(); const v = urlInput.value; urlInput.blur(); if (pick) pick.go(); else if (e.altKey) openTab(v, { activate: true, after: active }); else navigate(active, v); }
    });

    // ---------- keyboard shortcuts (inside this window) ----------
    win.addEventListener("keydown", (e) => {
      const mod = e.ctrlKey || e.metaKey, k = (e.key || "").toLowerCase();
      const inField = e.target && (e.target.isContentEditable || /^(input|textarea|select)$/i.test(e.target.tagName)) && e.target !== urlInput;
      let done = true;
      if (mod && e.shiftKey && k === "t") reopenClosed();
      else if (mod && !e.shiftKey && k === "t") newTab();
      else if (mod && !e.shiftKey && k === "w") { if (active) closeTab(active); }
      else if (mod && !e.shiftKey && k === "n") openBrowser(createWindow, "home", Object.assign({}, opts, { restore: false }));
      else if (mod && k === "tab") { const vis = tabs.filter((x) => !x.el.classList.contains("eg-hidden")); const i = vis.indexOf(active); activate(vis[(i + (e.shiftKey ? -1 : 1) + vis.length) % vis.length]); }
      else if (mod && /^[1-9]$/.test(k) && !inField) { const i = +k; activate(i === 9 ? tabs[tabs.length - 1] : tabs[i - 1] || active); }
      else if ((mod && k === "l") || (e.altKey && k === "d") || e.key === "F6") { urlInput.focus(); urlInput.select(); }
      else if (mod && !e.shiftKey && k === "d") starPopover();
      else if (mod && e.shiftKey && k === "o") showFavorites();
      else if (mod && !e.shiftKey && k === "h") showHistory();
      else if (mod && !e.shiftKey && k === "j") showDownloads(false);
      else if (mod && e.shiftKey && k === "y" && isEdge) toggleCollections();
      else if (mod && e.shiftKey && k === "b") { S.favBar = S.favBar === "never" ? "always" : "never"; S.bookmarks = S.favBar !== "never"; save(); emit("set"); }
      else if (mod && e.shiftKey && (k === "," || k === "<") && isEdge) toggleVertical();
      else if (mod && e.shiftKey && k === "k") { if (active) duplicateTab(active); }
      else if ((mod && k === "r" && !e.shiftKey) || e.key === "F5") { if (active) navigate(active, active.here || "home", false); }
      else if (e.altKey && e.key === "ArrowLeft" && !inField) goBack(active);
      else if (e.altKey && e.key === "ArrowRight" && !inField) goFwd(active);
      else if (mod && k === "p" && active && active.pdf) active.pdf.print();
      else if (mod && (k === "=" || k === "+") && !inField) setZoom(0.1);
      else if (mod && k === "-" && !inField) setZoom(-0.1);
      else if (mod && k === "0" && !inField) setZoom(0);
      else done = false;
      if (done) { e.preventDefault(); e.stopPropagation(); }
    });

    // ---------- live updates ----------
    const onFav = () => { renderFavBar(); applyChrome(); };
    const onDl = () => { const live = B.downloads.some((d) => d.state === "progress"); if (B.downloads.length) dlBtn.hidden = false; dlBtn.classList.toggle("busy", live); const p = B.downloads.find((d) => d.state === "progress"); dlBtn.style.setProperty("--p", p && p.total ? Math.round((p.received / p.total) * 100) + "%" : "30%"); };
    const onSet = () => { renderFavBar(); updateFavBarVisibility(); if (colBtn) colBtn.hidden = !S.showColBtn; };
    bus.addEventListener("fav", onFav); bus.addEventListener("dl", onDl); bus.addEventListener("set", onSet);
    renderFavBar(); onDl(); onSet();

    // ---------- start: restore the last session or open the start page ----------
    const sess = B.sessions[appId];
    const othersOpen = [...CTLS].some((c) => c !== ctl && c.appId === appId);
    const startHome = !startUrl || resolveSpecial(startUrl) === "home";
    if (opts.restore !== false && S.startup === "restore" && sess && Array.isArray(sess.tabs) && sess.tabs.length && !othersOpen) {
      groups = (sess.groups || []).map((g) => ({ id: g.id, name: g.name || "", color: g.color || "blue", collapsed: !!g.collapsed }));
      sess.tabs.forEach((st) => { const t = makeTab({ here: st.url || "home", title: st.title || titleFor(st.url), pinned: !!st.pinned, muted: !!st.muted, groupId: st.groupId || null, back: (st.back || []).slice(), fwd: (st.fwd || []).slice(), lazy: true }); t.icon = iconFor(t.here); t.addr = resolveSpecial(t.here) === "home" ? "" : t.here; tabs.push(t); });
      applyLayout();
      let first = tabs[Math.min(tabs.length - 1, Math.max(0, sess.active | 0))];
      if (first.groupId && groupById(first.groupId) && groupById(first.groupId).collapsed) first = tabs.find((x) => !(x.groupId && groupById(x.groupId).collapsed)) || first;
      if (!startHome) { const r = openTab(startUrl, { activate: false }); first = r.tab; }
      activate(first);
    } else {
      const t = makeTab(); tabs.push(t);
      if (opts.srcNode) { t.srcNode = opts.srcNode; t.srcUrl = startUrl; }
      applyLayout(); activate(t); navigate(t, startUrl || "home", false);
    }
    return { navigate: (u) => navigate(active, u), ctl };
  }

  // ------------------------------------------------------------------ registration + public API
  let lastBrowserCreate = null;
  const EDGE_OPTS = () => ({ title: "Microsoft Edge", icon: window.Icon ? Icon.mini("edge", "Microsoft Edge") : "", appId: "edge", edge: true });
  AppRegistry.browser = function (createWindow) { lastBrowserCreate = createWindow; return openBrowser(createWindow, null, { title: "Microsoft Edge", icon: Icon.mini("edge", "Microsoft Edge"), appId: "browser", edge: true }); };
  AppRegistry.chrome = function (createWindow) { lastBrowserCreate = createWindow; return openBrowser(createWindow, null, { title: "Chrome", icon: Icon.mini("chrome", "Chrome"), appId: "chrome" }); };
  AppRegistry.edge = function (createWindow) { lastBrowserCreate = createWindow; return openBrowser(createWindow, null, EDGE_OPTS()); };
  if (window.Icon && Icon.register) {
    Icon.register("edge", `<svg viewBox="0 0 48 48"><defs><linearGradient id="edgeA" x1="8" y1="34" x2="42" y2="18" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#0c59a4"/><stop offset="1" stop-color="#114a8b"/></linearGradient><radialGradient id="edgeB" cx="0" cy="0" r="1" gradientTransform="matrix(20 0 0 19 24 27)" gradientUnits="userSpaceOnUse"><stop offset=".7" stop-color="#35c1f1"/><stop offset=".9" stop-color="#258ccf"/><stop offset="1" stop-color="#1077bc"/></radialGradient><radialGradient id="edgeC" cx="0" cy="0" r="1" gradientTransform="matrix(6 -18 30 10 21 14)" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#4ac1e2"/><stop offset="1" stop-color="#2aa458"/></radialGradient></defs><path d="M40 30c-1 4-3 7-6 9a19 19 0 0 1-26-6c6 4 14 3 18-2 3-4 2-8-2-9 5-1 12 1 16 8z" fill="url(#edgeA)"/><path d="M8 33A19 19 0 0 1 24 5c5 0 10 2 13 6-3-2-8-3-12-1-6 2-9 8-7 13 1 4 5 6 9 6-6 2-13 1-16-6z" fill="url(#edgeB)"/><path d="M37 11c-3-4-8-6-13-6a19 19 0 0 0-17 12c2-5 7-9 12-9 7 0 10 4 11 8 1 3-1 6-4 7 6 0 10-4 11-9-1-1-1-2 0-3z" fill="url(#edgeC)"/></svg>`);
  }

  window.Browser = {
    // Open url in Edge: a new tab in the Edge window used last, or a new Edge window (which restores the last session).
    openTo(url, o) {
      o = o || {};
      const c = !o.newWindow && pickCtl(true);
      if (c) { c.focus(); return c.openTab(url || "home", { activate: true }); }
      const createWindow = lastBrowserCreate || window.WM.createWindow;
      return openBrowser(createWindow, url || "home", EDGE_OPTS());
    },
    // File Explorer hook: open a file node (PDF) from the virtual file system in an Edge tab.
    openFileNode(name, node, path) {
      path = path || findPath(node);
      const url = path ? fileUrl(path) : "file:///" + encodeURIComponent(name);
      const c = pickCtl(true);
      if (c) { c.focus(); return c.openTab(url, { activate: true, srcNode: node }); }
      return openBrowser(lastBrowserCreate || window.WM.createWindow, url, Object.assign(EDGE_OPTS(), { restore: false, srcNode: node }));
    },
    // Save a blob / URL to Downloads through Edge's download manager.
    download(src) { return startDownload(src || {}, pickCtl(false)); },
    makeTextPDF,
    windows: () => [...CTLS],
    store: bstore,
    version: "edge-2",
  };
})();
