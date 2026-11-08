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
            <img class="edge-bing" src="assets/bing.png?v=1" alt="Bing">
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
    page.querySelector(".edge-search-form").onsubmit = (e) => { e.preventDefault(); const q = page.querySelector(".edge-q").value.trim(); if (q) ctx.navigate("search:" + q); };
    const cards = page.querySelector(".edge-cards");
    EDGE_NEWS.forEach((n) => cards.appendChild(el(`<div class="edge-card"><div class="edge-card-img" style="background:${n.img}"></div><div class="edge-card-body"><div class="edge-card-cat">${esc(n.cat)}</div><div class="edge-card-title">${esc(n.title)}</div><div class="edge-card-src">${esc(n.src)}</div></div></div>`)));
    ctx.page.appendChild(page);
  }

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
    page.querySelectorAll(".g-top-link").forEach((a) => a.onclick = () => { const u = a.dataset.url; if (u.startsWith("app:")) { if (window.WM) WM.open(u.slice(4)); } else ctx.navigate(u); });
    const G_APPS = [
      { n: "Classroom", img: "assets/gapp_classroom.png" }, { n: "Gmail", img: "assets/gapp_gmail.png" }, { n: "Meet", img: "assets/gapp_meet.png" },
      { n: "Calendar", img: "assets/gapp_calendar.png" }, { n: "Drive", img: "assets/gapp_drive.png" }, { n: "Maps", img: "assets/gapp_maps.png" },
      { n: "Sheets", img: "assets/gapp_sheets.png" },
    ];
    page.querySelector(".g-apps").onclick = (ev) => {
      ev.stopPropagation();
      page.querySelectorAll(".g-apps-pop").forEach((m) => m.remove());
      const pop = el(`<div class="g-apps-pop"><div class="g-apps-grid">${G_APPS.map((a) => `<button class="g-app">${a.img ? `<span class="g-app-ic g-app-ic-img"><img src="${a.img}?v=1" alt=""></span>` : `<span class="g-app-ic" style="background:${a.c}">${a.e}</span>`}<span class="g-app-n">${a.n}</span></button>`).join("")}</div></div>`);
      pop.querySelectorAll(".g-app").forEach((b, i) => b.onclick = () => {
        pop.remove();
        // Classroom & Gmail open their apps; others are decorative for now.
        const n = G_APPS[i] && G_APPS[i].n;
        if (n === "Classroom" && window.AppRegistry.classroom) window.WM.open("classroom");
        else if (n === "Gmail" && window.AppRegistry.gmail) window.WM.open("gmail");
        else if (n === "Calendar" && window.AppRegistry.calendar) window.WM.open("calendar");
      });
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
        <button class="bb-ic bb-fav" title="Add to favorites"><img src="assets/bookmark_add.png?v=9" width="17" height="17" alt="Add bookmark" style="object-fit:contain;vertical-align:middle"></button>
        <button class="bb-ic bb-collections" title="Collections"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="5" y="4" width="14" height="16" rx="2"/><path d="M9 4v16"/></svg></button>
        <button class="bb-ic bb-menu" title="Settings and more">&#8943;</button>
      </div>
      <div class="bookmark-bar"></div>
      <div class="browser-page"></div>`;

    // Edge gets a Copilot button on the toolbar (like real Edge's Copilot).
    if (opts.edge) {
      const cp = el(`<button class="bb-ic bb-copilot" title="Copilot"><img src="assets/copilot.png?v=1" alt="Copilot" onerror="this.replaceWith(document.createTextNode('◈'))"></button>`);
      cp.onclick = () => { if (window.WM) WM.open("copilot"); };
      body.querySelector(".bb-menu").before(cp);
    }
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
        const isUrl = /^https?:\/\//.test(url) || /^[\w-]+(\.[\w-]+)+(\/.*)?$/i.test(url.trim());
        if (/^(search|images):/i.test(url) || !isUrl) { // in-app search results (Google/Bing refuse to load inside a window)
          const m = url.match(/^(search|images):(.*)$/i); const mode = m ? m[1].toLowerCase() : "search", q = m ? m[2] : url.trim();
          urlInput.value = q; renderSearch(ctx, q, mode); addHistory(q, mode + ":" + q); return;
        }
        const final = /^https?:\/\//.test(url) ? url : "https://" + url.trim();
        const frame = el(`<iframe class="embed-frame" src="${esc(final)}"></iframe>`);
        const bar = el(`<div class="frame-bar"><span>Some sites won't show inside an app window — if this one stays blank, open it in a real tab.</span><a href="${esc(final)}" target="_blank" rel="noopener">Open in a real tab ↗</a></div>`);
        page.appendChild(bar);
        page.appendChild(frame); addHistory(final, final);
      }
    }

    // ---- in-app search: quick answers (built-in sites, dictionary) + Wikipedia results / Wikimedia images ----
    function renderSearch(ctx, q, mode) {
      const site = el(`<div class="site srch">
        <div class="srch-top"><b class="srch-logo">Search</b><input class="srch-q" value="${esc(q)}"><button class="srch-go">🔍</button></div>
        <div class="srch-tabs"><button data-m="search" class="${mode === "search" ? "on" : ""}">All</button><button data-m="images" class="${mode === "images" ? "on" : ""}">Images</button></div>
        <div class="srch-quick"></div><div class="srch-res"><p class="muted">Searching…</p></div></div>`);
      page.appendChild(site);
      const go = (m) => navigate((m || mode) + ":" + site.querySelector(".srch-q").value.trim());
      site.querySelector(".srch-go").onclick = () => go();
      site.querySelector(".srch-q").onkeydown = (e) => { if (e.key === "Enter") go(); };
      site.querySelectorAll(".srch-tabs button").forEach((b) => b.onclick = () => go(b.dataset.m));
      const quick = site.querySelector(".srch-quick"), res = site.querySelector(".srch-res"), ql = q.toLowerCase();
      // built-in sites that match
      Object.keys(SPECIAL).filter((k) => !k.includes(".") && (ql.includes(k) || k.includes(ql)) && ql.length > 2).slice(0, 3).forEach((k) => {
        const a = el(`<button class="srch-site">🌐 <b>${esc(k[0].toUpperCase() + k.slice(1))}</b><span>${esc(k)}.com</span></button>`); a.onclick = () => navigate(k); quick.appendChild(a);
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
        res.querySelectorAll(".srch-title").forEach((b) => b.onclick = () => navigate("https://en.wikipedia.org/wiki/" + encodeURIComponent(b.dataset.t.replace(/ /g, "_"))));
      }).catch(() => { res.innerHTML = `<p class="muted">Couldn't reach the search service — check your connection and try again.</p>`; });
    }
    // ---- browsing history, favorites (Collections) and settings, saved per user ----
    const bstore = () => { const d = (window.State && State.data) || {}; d.appData = d.appData || {}; d.appData.browser = d.appData.browser || { history: [], favs: [], settings: { bookmarks: true } }; return d.appData.browser; };
    function addHistory(label, url) { const b = bstore(); b.history = b.history.filter((h) => h.url !== url); b.history.unshift({ label: String(label).slice(0, 120), url, ts: Date.now() }); b.history = b.history.slice(0, 100); if (window.State) State.save(); }
    if (!bstore().settings.bookmarks) bmBar.style.display = "none";
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
    const curUrl = () => urlInput.value.trim() || "home";
    const isFav = () => bstore().favs.some((f) => f.url === curUrl());
    favBtn.onclick = () => {
      const b = bstore(), u = curUrl(); if (u === "home") { notify("Open a page first, then star it."); return; }
      const i = b.favs.findIndex((f) => f.url === u);
      if (i >= 0) { b.favs.splice(i, 1); notify("Removed from favorites."); } else { b.favs.unshift({ url: u, label: u.replace(/^https?:\/\//, "").slice(0, 60), ts: Date.now() }); notify("Added to favorites — find it under Collections."); }
      favBtn.classList.toggle("on", isFav()); if (window.State) State.save();
    };
    function panel(title, html, onOpen) {
      body.querySelectorAll(".bb-panel").forEach((m) => m.remove());
      const m = el(`<div class="bb-panel"><div class="bb-panel-h"><b>${esc(title)}</b><button class="bb-panel-x">✕</button></div><div class="bb-panel-b">${html}</div></div>`);
      m.querySelector(".bb-panel-x").onclick = () => m.remove(); body.querySelector(".browser-bar").appendChild(m); if (onOpen) onOpen(m);
      setTimeout(() => document.addEventListener("pointerdown", function h(x) { if (!m.isConnected) { document.removeEventListener("pointerdown", h); return; } if (!m.contains(x.target) && !x.target.closest(".bb-collections")) { m.remove(); document.removeEventListener("pointerdown", h); } }), 0);
      return m;
    }
    function collections() {
      const b = bstore();
      panel("Collections", `<div class="bb-sec">⭐ Favorites</div>${b.favs.length ? b.favs.map((f, i) => `<div class="bb-row"><button data-go="${i}">${esc(f.label)}</button><button class="bb-del" data-del="${i}">✕</button></div>`).join("") : `<p class="muted">No favorites yet — tap ☆ on a page.</p>`}
        <div class="bb-sec">🕘 Recent</div>${b.history.slice(0, 12).map((h, i) => `<div class="bb-row"><button data-h="${i}">${esc(h.label)}</button></div>`).join("") || `<p class="muted">Nothing yet.</p>`}`, (m) => {
        m.querySelectorAll("[data-go]").forEach((x) => x.onclick = () => { m.remove(); navigate(b.favs[+x.dataset.go].url); });
        m.querySelectorAll("[data-del]").forEach((x) => x.onclick = () => { b.favs.splice(+x.dataset.del, 1); if (window.State) State.save(); collections(); favBtn.classList.toggle("on", isFav()); });
        m.querySelectorAll("[data-h]").forEach((x) => x.onclick = () => { m.remove(); navigate(b.history[+x.dataset.h].url); });
      });
    }
    function settings() {
      const b = bstore();
      panel("Settings", `<label class="bb-row"><input type="checkbox" class="bb-set-bm" ${b.settings.bookmarks ? "checked" : ""}> Show the bookmarks bar</label>
        <div class="bb-row"><button class="bb-set-hist">Clear browsing history (${b.history.length})</button></div>
        <div class="bb-row"><button class="bb-set-favs">Remove all favorites (${b.favs.length})</button></div>
        <p class="muted">Searches show results from Wikipedia inside the app; images come from Wikimedia Commons.</p>`, (m) => {
        m.querySelector(".bb-set-bm").onchange = (e) => { b.settings.bookmarks = e.target.checked; bmBar.style.display = e.target.checked ? "" : "none"; if (window.State) State.save(); };
        m.querySelector(".bb-set-hist").onclick = () => { b.history = []; history.length = 0; forward.length = 0; if (window.State) State.save(); notify("Browsing history cleared."); settings(); };
        m.querySelector(".bb-set-favs").onclick = () => { b.favs = []; if (window.State) State.save(); favBtn.classList.remove("on"); notify("Favorites removed."); settings(); };
      });
    }
    body.querySelector(".bb-collections").onclick = collections;
    // Settings and more (…) menu.
    body.querySelector(".bb-menu").onclick = (ev) => {
      body.querySelectorAll(".bb-menu-pop, .bb-panel").forEach((m) => m.remove());
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
        else settings();
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
