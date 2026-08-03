/* Edge browser: custom sites for 5 known hosts, generic iframe embed for everything else. */
(function () {
  "use strict";

  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

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

  function resolveSpecial(input) {
    const raw = (input || "").trim().toLowerCase();
    if (!raw || raw === "home" || raw === "newtab" || raw === "about:home") return "home";
    const key = raw.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
    return SPECIAL[key] || SPECIAL[raw] || null;
  }

  // Microsoft Edge new-tab: Bing search box, quick-link tiles, and a news feed (original copy).
  const EDGE_NEWS = [
    { cat: "Weather", title: "Sunny skies expected through the weekend", src: "Weather Center", img: "linear-gradient(135deg,#48b1f3,#8fd3ff)" },
    { cat: "Technology", title: "Foldable laptops steal the show at this year's tech expo", src: "Tech Daily", img: "linear-gradient(135deg,#7b5cff,#5433ff)" },
    { cat: "Sports", title: "Home team clinches a playoff spot in an overtime thriller", src: "Sports Wire", img: "linear-gradient(135deg,#22b573,#0a9d6e)" },
    { cat: "Finance", title: "Markets edge higher as tech shares rally", src: "Market Watch", img: "linear-gradient(135deg,#f7971e,#ffd200)" },
    { cat: "Science", title: "Researchers map a new region of the deep ocean", src: "Science Today", img: "linear-gradient(135deg,#2193b0,#6dd5ed)" },
    { cat: "Travel", title: "Ten underrated cities worth a visit this year", src: "Travel Guide", img: "linear-gradient(135deg,#ff7e5f,#feb47b)" },
  ];
  function renderEdgeHome(ctx) {
    const page = el(`<div class="edge-home">
      <div class="edge-hero">
        <div class="edge-hero-top"><span class="edge-weather">🌤 72°F</span><span class="grow"></span><button class="edge-gear" title="Page settings">⚙</button></div>
        <form class="edge-search-form">
          <div class="edge-search">
            <svg class="edge-bing" viewBox="0 0 24 24"><path d="M6 3l4 1.4v11l6-2.8-2.9-1-1.4-3.6L16 10l3 1.3v3.3L9 20V4.8z" fill="#008373"/></svg>
            <input class="edge-q" placeholder="Search the web" autofocus>
            <button type="submit" class="edge-go" title="Search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg></button>
          </div>
        </form>
        <div class="edge-tiles"></div>
      </div>
      <div class="edge-feed">
        <div class="edge-feed-tabs"><button class="on">My Feed</button><button>News</button><button>Sports</button><button>Money</button><button>Entertainment</button><button>Health</button></div>
        <div class="edge-cards"></div>
      </div>
    </div>`);
    const tiles = page.querySelector(".edge-tiles");
    Catalog.bookmarks.slice(0, 8).forEach((b) => {
      const t = el(`<button class="edge-tile"><span class="edge-tile-ic">${Icon.md(b.label.toLowerCase(), b.label)}</span><span class="edge-tile-lb">${b.label}</span></button>`);
      t.onclick = () => ctx.navigate(b.url);
      tiles.appendChild(t);
    });
    page.querySelector(".edge-search-form").onsubmit = (e) => { e.preventDefault(); const q = page.querySelector(".edge-q").value.trim(); if (q) ctx.navigate("https://www.bing.com/search?q=" + encodeURIComponent(q)); };
    const cards = page.querySelector(".edge-cards");
    EDGE_NEWS.forEach((n) => cards.appendChild(el(`<div class="edge-card"><div class="edge-card-img" style="background:${n.img}"></div><div class="edge-card-body"><div class="edge-card-cat">${esc(n.cat)}</div><div class="edge-card-title">${esc(n.title)}</div><div class="edge-card-src">${esc(n.src)}</div></div></div>`)));
    ctx.page.appendChild(page);
  }

  function renderHome(ctx) {
    const colors = ["#4285F4", "#EA4335", "#FBBC05", "#4285F4", "#34A853", "#EA4335"];
    const letters = "Google".split("").map((ch, i) => `<span style="color:${colors[i]}">${ch}</span>`).join("");
    const page = el(`<div class="google-home">
      <div class="google-top">
        <a class="g-top-link" data-url="https://mail.google.com">Gmail</a>
        <a class="g-top-link" data-url="https://www.google.com/imghp">Images</a>
        <button class="g-apps" title="Google apps"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><circle cx="5" cy="5" r="1.8"/><circle cx="12" cy="5" r="1.8"/><circle cx="19" cy="5" r="1.8"/><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/><circle cx="5" cy="19" r="1.8"/><circle cx="12" cy="19" r="1.8"/><circle cx="19" cy="19" r="1.8"/></svg></button>
      </div>
      <div class="google-logo">${letters}</div>
      <form class="searchbar" autocomplete="off">
        <div class="searchbar-wrapper">
          <div class="searchbar-left"><div class="search-icon-wrapper"><span class="search-icon searchbar-icon">
            <svg focusable="false" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"></path></svg>
          </span></div></div>
          <div class="searchbar-center">
            <input class="searchbar-input" type="text" placeholder="Search Google or type a URL" autofocus>
          </div>
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
    Catalog.bookmarks.forEach((b) => {
      const sc = el(`<button class="google-sc"><span class="g-sc-ic">${Icon.md(b.label.toLowerCase(), b.label)}</span><span class="g-sc-lb">${b.label}</span></button>`);
      sc.onclick = () => ctx.navigate(b.url);
      shortcuts.appendChild(sc);
    });
    const input = page.querySelector(".searchbar-input");
    page.querySelector("form").onsubmit = (e) => { e.preventDefault(); const q = input.value.trim(); if (q) ctx.navigate(q); };
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    page.querySelector(".voice-search").onclick = () => {
      if (!SR) { input.focus(); return; }
      try {
        const rec = new SR(); rec.lang = "en-US"; rec.interimResults = false;
        rec.onresult = (ev) => { input.value = ev.results[0][0].transcript; ctx.navigate(input.value.trim()); };
        rec.start();
      } catch (_) { input.focus(); }
    };
    // Top links + Google apps grid (waffle).
    page.querySelectorAll(".g-top-link").forEach((a) => a.onclick = () => ctx.navigate(a.dataset.url));
    const G_APPS = [
      { n: "Account", c: "#5f6368", e: "👤", u: "https://myaccount.google.com" }, { n: "Search", c: "#4285F4", e: "🔍", u: "home" }, { n: "Maps", c: "#34A853", e: "📍", u: "https://maps.google.com" },
      { n: "YouTube", c: "#FF0000", e: "▶️", u: "https://youtube.com" }, { n: "Play", c: "#00c4b3", e: "▶", u: "https://play.google.com" }, { n: "News", c: "#4285F4", e: "📰", u: "https://news.google.com" },
      { n: "Gmail", c: "#EA4335", e: "✉️", u: "https://mail.google.com" }, { n: "Drive", c: "#FBBC05", e: "📁", u: "https://drive.google.com" }, { n: "Calendar", c: "#4285F4", e: "📅", u: "https://calendar.google.com" },
      { n: "Photos", c: "#EA4335", e: "🖼️", u: "https://photos.google.com" }, { n: "Translate", c: "#4285F4", e: "🌐", u: "https://translate.google.com" }, { n: "Meet", c: "#00897B", e: "📹", u: "https://meet.google.com" },
    ];
    page.querySelector(".g-apps").onclick = (ev) => {
      ev.stopPropagation();
      page.querySelectorAll(".g-apps-pop").forEach((m) => m.remove());
      const pop = el(`<div class="g-apps-pop"><div class="g-apps-grid">${G_APPS.map((a) => `<button class="g-app" data-u="${a.u}"><span class="g-app-ic" style="background:${a.c}">${a.e}</span><span class="g-app-n">${a.n}</span></button>`).join("")}</div></div>`);
      pop.querySelectorAll(".g-app").forEach((b) => b.onclick = () => { pop.remove(); ctx.navigate(b.dataset.u); });
      page.querySelector(".google-top").appendChild(pop);
      setTimeout(() => document.addEventListener("pointerdown", function h(x) { if (!pop.contains(x.target)) { pop.remove(); document.removeEventListener("pointerdown", h); } }), 0);
    };
    ctx.page.appendChild(page);
  }

  function openBrowser(createWindow, startUrl, opts) {
    opts = opts || {};
    const { body, win } = createWindow({ title: opts.title || "Edge", icon: opts.icon || Icon.mini("browser", "Edge"), width: 920, height: 620, appId: opts.appId || "browser" });

    body.innerHTML = `
      <div class="browser-bar">
        <button class="bb-nav back" title="Back">&#8592;</button>
        <button class="bb-nav fwd" title="Forward">&#8594;</button>
        <button class="bb-nav reload" title="Reload">&#8635;</button>
        <button class="bb-nav home-btn" title="Home"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 11 12 4l8 7"/><path d="M6 10v9h12v-9"/></svg></button>
        <div class="addr"><span class="lock muted" style="font-size:.72rem"></span><input class="url" placeholder="Search or enter address"></div>
        <button class="bb-ic bb-read" title="Read aloud"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 8a5 5 0 0 1 0 8"/></svg></button>
        <button class="bb-ic bb-fav" title="Add to favorites"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 4l2.5 5 5.5.8-4 3.9 1 5.5-5-2.7-5 2.7 1-5.5-4-3.9L9.5 9z"/></svg></button>
        <button class="bb-ic bb-collections" title="Collections"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="5" y="4" width="14" height="16" rx="2"/><path d="M9 4v16"/></svg></button>
        <button class="bb-ic bb-menu" title="Settings and more">&#8943;</button>
      </div>
      <div class="bookmark-bar"></div>
      <div class="browser-page"></div>`;

    const urlInput = body.querySelector(".url");
    const page = body.querySelector(".browser-page");
    const lock = body.querySelector(".lock");
    const bmBar = body.querySelector(".bookmark-bar");
    const history = [], forward = [];

    Catalog.bookmarks.forEach((b) => {
      const bm = el(`<div class="bm">${b.label}</div>`);
      bm.onclick = () => navigate(b.url);
      bmBar.appendChild(bm);
    });

    function navigate(url, pushHistory = true) {
      if (pushHistory) { history.push(urlInput.value || "home"); forward.length = 0; }
      urlInput.value = url;
      page.innerHTML = "";
      const special = resolveSpecial(url);
      const ctx = { page, navigate, win, urlInput };
      if (special === "home") {
        lock.textContent = "";
        body.querySelector(".addr").classList.remove("locked-site");
        urlInput.value = "";
        if (opts.edge) renderEdgeHome(ctx); else renderHome(ctx);
        return;
      }
      if (special) {
        lock.textContent = "Secure";
        body.querySelector(".addr").classList.add("locked-site");
        Sites[special](ctx);
      } else {
        lock.textContent = "";
        const final = /^https?:\/\//.test(url) ? url
          : /\.[a-z]{2,}$/i.test(url.trim()) ? "https://" + url.trim()
          : "https://www.google.com/search?q=" + encodeURIComponent(url);
        const frame = el(`<iframe class="embed-frame" src="${final}"></iframe>`);
        const fallback = el(`<div class="site"><p class="muted">If the page below is blank, that site blocks being embedded. Try one of the bookmarks above.</p></div>`);
        page.appendChild(fallback);
        page.appendChild(frame);
      }
    }

    urlInput.addEventListener("keydown", (e) => { if (e.key === "Enter") navigate(urlInput.value); });
    body.querySelector(".reload").onclick = () => navigate(urlInput.value, false);
    body.querySelector(".back").onclick = () => { const prev = history.pop(); if (prev != null) { forward.push(urlInput.value || "home"); navigate(prev, false); } };
    body.querySelector(".fwd").onclick = () => { const nxt = forward.pop(); if (nxt != null) { history.push(urlInput.value || "home"); navigate(nxt, false); } };
    body.querySelector(".home-btn").onclick = () => navigate("home");
    const notify = (msg) => { if (window.Notify) Notify.show({ icon: opts.icon || "", title: opts.title || "Edge", body: msg }); };
    // Read aloud — TTS of the visible page text (toggle).
    let speaking = false;
    body.querySelector(".bb-read").onclick = () => {
      if (!window.speechSynthesis) { notify("Read aloud isn't available here."); return; }
      if (speaking) { speechSynthesis.cancel(); speaking = false; return; }
      const txt = (page.innerText || "").trim().slice(0, 700);
      if (!txt) { notify("Nothing to read on this page."); return; }
      const u = new SpeechSynthesisUtterance(txt); u.onend = () => { speaking = false; };
      speechSynthesis.cancel(); speechSynthesis.speak(u); speaking = true;
      notify("Reading this page aloud…");
    };
    // Favorites — toggle the star.
    const favBtn = body.querySelector(".bb-fav");
    favBtn.onclick = () => { favBtn.classList.toggle("on"); notify(favBtn.classList.contains("on") ? "Added to favorites." : "Removed from favorites."); };
    body.querySelector(".bb-collections").onclick = () => notify("Collections are coming soon.");
    // Settings and more (…) menu.
    body.querySelector(".bb-menu").onclick = (ev) => {
      body.querySelectorAll(".bb-menu-pop").forEach((m) => m.remove());
      const m = el(`<div class="bb-menu-pop">
        <button data-a="newtab">New tab</button><button data-a="reload">Reload</button>
        <button data-a="read">Read aloud</button><button data-a="fav">Favorites</button>
        <button data-a="settings">Settings</button></div>`);
      m.querySelectorAll("button").forEach((b) => b.onclick = () => {
        m.remove();
        const a = b.dataset.a;
        if (a === "newtab") navigate("home");
        else if (a === "reload") navigate(urlInput.value, false);
        else if (a === "read") body.querySelector(".bb-read").click();
        else if (a === "fav") favBtn.click();
        else notify("Settings are coming soon.");
      });
      body.querySelector(".browser-bar").appendChild(m);
      setTimeout(() => document.addEventListener("pointerdown", function h(x) { if (!m.contains(x.target)) { m.remove(); document.removeEventListener("pointerdown", h); } }), 0);
    };

    navigate(startUrl || "home", false);
    return { navigate };
  }

  // Registered launcher + a programmatic opener used by other apps.
  let lastBrowserCreate = null;
  AppRegistry.browser = function (createWindow) { lastBrowserCreate = createWindow; return openBrowser(createWindow); };
  AppRegistry.chrome = function (createWindow) { lastBrowserCreate = createWindow; return openBrowser(createWindow, "home", { title: "Chrome", icon: Icon.mini("chrome", "Chrome"), appId: "chrome" }); };
  AppRegistry.edge = function (createWindow) { lastBrowserCreate = createWindow; return openBrowser(createWindow, "home", { title: "Microsoft Edge", icon: Icon.mini("edge", "Microsoft Edge"), appId: "edge", edge: true }); };
  if (window.Icon && Icon.register) {
    Icon.register("edge", `<svg viewBox="0 0 48 48"><defs><linearGradient id="edgeA" x1="8" y1="34" x2="42" y2="18" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#0c59a4"/><stop offset="1" stop-color="#114a8b"/></linearGradient><radialGradient id="edgeB" cx="0" cy="0" r="1" gradientTransform="matrix(20 0 0 19 24 27)" gradientUnits="userSpaceOnUse"><stop offset=".7" stop-color="#35c1f1"/><stop offset=".9" stop-color="#258ccf"/><stop offset="1" stop-color="#1077bc"/></radialGradient><radialGradient id="edgeC" cx="0" cy="0" r="1" gradientTransform="matrix(6 -18 30 10 21 14)" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#4ac1e2"/><stop offset="1" stop-color="#2aa458"/></radialGradient></defs><path d="M40 30c-1 4-3 7-6 9a19 19 0 0 1-26-6c6 4 14 3 18-2 3-4 2-8-2-9 5-1 12 1 16 8z" fill="url(#edgeA)"/><path d="M8 33A19 19 0 0 1 24 5c5 0 10 2 13 6-3-2-8-3-12-1-6 2-9 8-7 13 1 4 5 6 9 6-6 2-13 1-16-6z" fill="url(#edgeB)"/><path d="M37 11c-3-4-8-6-13-6a19 19 0 0 0-17 12c2-5 7-9 12-9 7 0 10 4 11 8 1 3-1 6-4 7 6 0 10-4 11-9-1-1-1-2 0-3z" fill="url(#edgeC)"/></svg>`);
  }

  window.Browser = {
    openTo(url) {
      // open an Edge window already navigated to url
      const createWindow = lastBrowserCreate || window.WM.createWindow;
      return openBrowser(createWindow, url);
    },
  };
})();
