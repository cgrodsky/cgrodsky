/* Built-in apps: Store, Calculator, Media Player, Settings, Notepad, Paint, Clock, MS365, YouTube launcher. */
(function () {
  "use strict";
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  const S = () => State.data;
  const cw = (opts) => window.WM.createWindow(opts);

  // ---------- Store ----------
  // A Windows 11-style Microsoft Store: nav rail, live search, hero carousel, collection rows,
  // app detail pages with a real Get -> Downloading -> Installing -> Open flow, Library with updates.
  // Styles live in css/store.css (all classes prefixed `mss-`).
  AppRegistry.store = function () {
    if (!document.querySelector('link[href*="css/store.css"]')) {
      const l = document.createElement("link"); l.rel = "stylesheet"; l.href = "css/store.css"; document.head.appendChild(l);
    }
    let closed = false, heroTimer = null;
    const ww = Math.max(360, Math.min(1080, window.innerWidth - 40)), wh = Math.max(420, Math.min(720, window.innerHeight - 90));
    const { body } = cw({ title: "Microsoft Store", icon: Icon.mini("store__", "Store"), width: ww, height: wh, appId: "store__",
      onClose: () => { closed = true; clearInterval(heroTimer); } });
    body.classList.add("mss-host");

    // Downloads are shared by every Store window so progress shows everywhere and survives closing the window.
    const JOBS = window.__mssJobs || (window.__mssJobs = {});
    const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const hash = (s) => { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
    const seenNames = new Set();
    const APPS = Catalog.storeApps.filter((a) => { const k = a.name.toLowerCase(); if (seenNames.has(k)) return false; seenNames.add(k); return true; });
    const byId = (id) => Catalog.storeApps.find((a) => a.id === id);
    const isGame = (a) => a.cat === "Games";
    const rating = (a) => (3.6 + (hash(a.id) % 14) / 10).toFixed(1);
    const reviews = (a) => 180 + (hash(a.id + "r") % 96000);
    const fmtK = (n) => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "") + "K" : String(n));
    const sizeMB = (a) => 18 + (hash(a.id + "s") % (isGame(a) ? 1900 : 420));
    const fmtSize = (mb) => (mb >= 1000 ? (mb / 1024).toFixed(1) + " GB" : Math.round(mb) + " MB");
    const PUB = {
      chrome: "Google LLC", gmail: "Google LLC", classroom: "Google LLC", youtubeApp: "Google LLC", blender: "Blender Foundation",
      blockbench: "JannisX11", itunes: "Apple Inc.", vlc: "VideoLAN", canva: "Canva", acrobat: "Adobe Inc.", duolingo: "Duolingo",
      minecraft: "Mojang Studios", mclauncher: "Mojang Studios", curseforge: "Overwolf", sims: "Electronic Arts", stardew: "ConcernedApe",
      doom: "id Software", cafe: "Sip & Bite Inc.", messenger: "Microsoft Corporation", xbox: "Microsoft Corporation",
    };
    const publisher = (a) => PUB[a.id] || (a.game ? "Windows 12 Game Studios" : a.decorative ? "Contoso Ltd." : "Microsoft Corporation");
    const age = (a) => (a.id === "doom" ? ["M", "MATURE 17+"] : a.id === "sims" ? ["T", "TEEN"] : ["minecraft", "mclauncher", "stardew", "curseforge"].includes(a.id) ? ["E10+", "EVERYONE 10+"] : ["E", "EVERYONE"]);
    const priceOf = (a) => (a.price ? "$" + a.price.toFixed(2) : "Free");
    // "Core" = ships with Windows (can't be uninstalled here); Store-installed apps can be.
    const isCore = (id) => { const arr = S().installedApps, i = arr.indexOf(id); if (i < 0) return isInstalled(id); arr.splice(i, 1); const r = isInstalled(id); arr.splice(i, 0, id); return r; };
    const canUninstall = (id) => S().installedApps.includes(id) && !isCore(id);
    const priceLabel = (a) => { const j = JOBS[a.id]; if (j) return j.phase === "download" ? "Downloading " + Math.floor(j.pct) + "%" : "Installing…"; return isInstalled(a.id) ? "Installed" : priceOf(a); };

    const SVG = (p) => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
    const IC = {
      home: SVG('<path d="M4 10.2 12 4l8 6.2V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z"/>'),
      apps: SVG('<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>'),
      gaming: SVG('<path d="M7.5 8h9a4.5 4.5 0 0 1 4.4 5.5l-.6 2.8a2.3 2.3 0 0 1-4 1L14.6 15H9.4l-1.7 2.3a2.3 2.3 0 0 1-4-1l-.6-2.8A4.5 4.5 0 0 1 7.5 8z"/><path d="M8 10.3v3.4M6.3 12h3.4"/><circle cx="15.4" cy="11" r=".7"/><circle cx="17.2" cy="13" r=".7"/>'),
      movies: SVG('<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M3.5 9h17M7.5 5l1.5 4M12 5l1.5 4M16.5 5 18 9"/>'),
      library: SVG('<path d="M5 4v16M9 4v16"/><path d="m13 5.2 3.6-1 3.9 14.6-3.6 1z"/>'),
      help: SVG('<circle cx="12" cy="12" r="8.5"/><path d="M9.7 9.6a2.4 2.4 0 1 1 3.3 2.2c-.6.3-1 .8-1 1.5v.4"/><circle cx="12" cy="16.6" r=".4" fill="currentColor"/>'),
      back: SVG('<path d="M19 12H5M11 6l-6 6 6 6"/>'),
      search: SVG('<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/>'),
      user: SVG('<circle cx="12" cy="9" r="3.6"/><path d="M5.5 19.5a6.5 6.5 0 0 1 13 0"/>'),
      chevL: SVG('<path d="m14.5 6-6 6 6 6"/>'),
      chevR: SVG('<path d="m9.5 6 6 6-6 6"/>'),
      check: SVG('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
      x: SVG('<path d="M7 7l10 10M17 7 7 17"/>'),
      refresh: SVG('<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4"/>'),
      download: SVG('<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>'),
    };
    const NAV = [["home", "Home"], ["apps", "Apps"], ["gaming", "Gaming"], ["movies", "Movies & TV"]];
    const NAV_BOTTOM = [["library", "Library"], ["help", "Help"]];
    const NAVKEYS = [...NAV, ...NAV_BOTTOM].map((n) => n[0]);
    const navBtn = ([k, t]) => `<button class="mss-nav" data-nav="${k}" title="${t}">${IC[k]}<span>${t}</span></button>`;

    body.innerHTML = `<div class="mss">
      <header class="mss-top">
        <button class="mss-back" title="Back" aria-label="Back" disabled>${IC.back}</button>
        <div class="mss-brand">${Icon.box("store__", "Store", 20)}<span>Microsoft Store</span></div>
        <div class="mss-search">${IC.search}<input type="text" placeholder="Search apps, games, movies and more" aria-label="Search apps, games, movies and more" spellcheck="false"><button class="mss-search-x" title="Clear" aria-label="Clear search">${IC.x}</button></div>
        <button class="mss-avatar" title="Library" aria-label="Library">${IC.user}</button>
      </header>
      <div class="mss-shell">
        <nav class="mss-rail">${NAV.map(navBtn).join("")}<div class="mss-rail-gap"></div>${NAV_BOTTOM.map(navBtn).join("")}</nav>
        <main class="mss-main"></main>
      </div>
    </div>`;
    const main = body.querySelector(".mss-main"), backBtn = body.querySelector(".mss-back"), input = body.querySelector(".mss-search input");
    const searchBox = body.querySelector(".mss-search");

    // ---- navigation ----
    const hist = [{ page: "home" }];
    const cur = () => hist[hist.length - 1];
    function go(v, replace) {
      if (replace) hist[hist.length - 1] = v;
      else { cur().scroll = main.scrollTop; hist.push(v); }
      render(); main.scrollTop = 0;
    }
    function back() {
      if (hist.length < 2) return;
      const leaving = hist.pop();
      if (leaving.page === "search" && cur().page !== "search") input.value = "";
      if (cur().page === "search") input.value = cur().q;
      syncSearchX(); render(); main.scrollTop = cur().scroll || 0;
    }
    backBtn.onclick = back;
    body.querySelector(".mss-avatar").onclick = () => go({ page: "library" });
    body.querySelectorAll(".mss-nav").forEach((b) => b.onclick = () => { input.value = ""; syncSearchX(); go({ page: b.dataset.nav }); });
    const syncSearchX = () => searchBox.classList.toggle("has-q", !!input.value);
    input.addEventListener("input", () => {
      syncSearchX();
      const q = input.value.trim();
      if (!q) { if (cur().page === "search") back(); return; }
      if (cur().page === "search") { cur().q = q; render(); } else go({ page: "search", q, f: "all" });
    });
    input.addEventListener("keydown", (e) => { if (e.key === "Escape") { input.value = ""; syncSearchX(); if (cur().page === "search") back(); } });
    body.querySelector(".mss-search-x").onclick = () => { input.value = ""; syncSearchX(); if (cur().page === "search") back(); input.focus(); };

    function render() {
      clearInterval(heroTimer); heroTimer = null;
      const v = cur();
      backBtn.disabled = hist.length < 2;
      let sec = null;
      for (let i = hist.length - 1; i >= 0; i--) if (NAVKEYS.includes(hist[i].page)) { sec = hist[i].page; break; }
      if (v.page === "search") sec = null;
      body.querySelectorAll(".mss-nav").forEach((b) => b.classList.toggle("on", b.dataset.nav === sec));
      const pages = { home: pHome, apps: pApps, gaming: pGaming, movies: pMovies, library: pLibrary, help: pHelp, detail: pDetail, list: pList, search: pSearch };
      main.innerHTML = "";
      main.appendChild((pages[v.page] || pHome)(v));
    }

    // ---- building blocks ----
    function card(a) {
      const c = el(`<button class="mss-card" title="${esc(a.name)}">
        <div class="mss-card-ic">${Icon.box(a.id, a.name, 64)}</div>
        <div class="mss-card-name">${esc(a.name)}</div>
        <div class="mss-card-cat">${esc(a.cat)}</div>
        <div class="mss-card-rate">${rating(a)} <span class="mss-star">★</span></div>
        <div class="mss-card-price" data-mss-price="${a.id}">${priceLabel(a)}</div>
      </button>`);
      if (isInstalled(a.id)) c.querySelector(".mss-card-price").classList.add("is-inst");
      c.onclick = () => go({ page: "detail", id: a.id });
      return c;
    }
    function row(title, apps, opts) {
      opts = opts || {};
      const r = el(`<section class="mss-row"><div class="mss-row-h"><h3>${esc(title)}</h3><button class="mss-see">See all ${IC.chevR}</button></div>
        <div class="mss-strip-wrap"><button class="mss-arrow l" aria-label="Scroll left">${IC.chevL}</button><div class="mss-strip"></div><button class="mss-arrow r" aria-label="Scroll right">${IC.chevR}</button></div></section>`);
      const strip = r.querySelector(".mss-strip");
      apps.slice(0, opts.max || 14).forEach((a) => strip.appendChild(opts.make ? opts.make(a) : card(a)));
      const scroll = (d) => strip.scrollBy({ left: d * Math.max(200, strip.clientWidth * 0.8), behavior: "smooth" });
      r.querySelector(".mss-arrow.l").onclick = () => scroll(-1);
      r.querySelector(".mss-arrow.r").onclick = () => scroll(1);
      const upd = () => { r.querySelector(".mss-arrow.l").classList.toggle("off", strip.scrollLeft < 4); r.querySelector(".mss-arrow.r").classList.toggle("off", strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 4); };
      strip.addEventListener("scroll", upd); requestAnimationFrame(upd);
      r.querySelector(".mss-see").onclick = opts.seeAll || (() => go({ page: "list", title, ids: apps.map((a) => a.id) }));
      return r;
    }
    function grid(apps) { const g = el(`<div class="mss-grid"></div>`); apps.forEach((a) => g.appendChild(card(a))); return g; }
    function chips(list, active, onPick) {
      const c = el(`<div class="mss-chips"></div>`);
      list.forEach((k) => { const b = el(`<button class="mss-chip${k === active ? " on" : ""}">${esc(k)}</button>`); b.onclick = () => onPick(k); c.appendChild(b); });
      return c;
    }
    function hero(slides) {
      slides = slides.filter((s) => byId(s.id));
      const h = el(`<section class="mss-hero"><div class="mss-hero-track"></div>
        <button class="mss-hero-nav l" aria-label="Previous">${IC.chevL}</button><button class="mss-hero-nav r" aria-label="Next">${IC.chevR}</button><div class="mss-dots"></div></section>`);
      const track = h.querySelector(".mss-hero-track"), dots = h.querySelector(".mss-dots");
      slides.forEach((s, i) => {
        const a = byId(s.id), inst = isInstalled(a.id);
        const sl = el(`<div class="mss-slide${i === 0 ? " on" : ""}" style="background:${s.g}">
          <div class="mss-slide-txt"><span class="mss-slide-tag">${esc(s.tag)}</span><h2>${esc(s.title)}</h2><p>${esc(s.sub)}</p>
            <div class="mss-slide-cta"><button class="mss-btn-light">${inst ? "Open" : "Get"}</button><span>${esc(a.name)} · ${inst ? "Installed" : priceOf(a)}</span></div></div>
          <div class="mss-slide-art"><div class="mss-slide-glow">${Icon.box(a.id, a.name, 150)}</div><div class="mss-slide-ic">${Icon.box(a.id, a.name, 128)}</div></div>
        </div>`);
        sl.onclick = () => go({ page: "detail", id: a.id });
        sl.querySelector(".mss-btn-light").onclick = (e) => { e.stopPropagation(); if (isInstalled(a.id)) window.WM.open(a.id); else { go({ page: "detail", id: a.id }); startGet(a); } };
        track.appendChild(sl);
        const d = el(`<button class="mss-dot${i === 0 ? " on" : ""}" aria-label="Slide ${i + 1}"></button>`); d.onclick = () => show(i); dots.appendChild(d);
      });
      let idx = 0, hover = false;
      function show(n) {
        idx = (n + slides.length) % slides.length;
        [...track.children].forEach((x, i) => x.classList.toggle("on", i === idx));
        [...dots.children].forEach((x, i) => x.classList.toggle("on", i === idx));
      }
      h.querySelector(".mss-hero-nav.l").onclick = () => show(idx - 1);
      h.querySelector(".mss-hero-nav.r").onclick = () => show(idx + 1);
      h.addEventListener("mouseenter", () => hover = true); h.addEventListener("mouseleave", () => hover = false);
      clearInterval(heroTimer);
      heroTimer = setInterval(() => { if (closed || !h.isConnected) { clearInterval(heroTimer); return; } if (!hover) show(idx + 1); }, 5000);
      return h;
    }
    function promos(list) {
      const p = el(`<div class="mss-promos"></div>`);
      list.filter((x) => byId(x.id)).forEach((x) => {
        const a = byId(x.id);
        const t = el(`<button class="mss-promo" style="background:${x.g}"><span class="mss-promo-ic">${Icon.box(a.id, a.name, 44)}</span><span class="mss-promo-t"><b>${esc(x.t)}</b><span>${esc(x.s)}</span></span></button>`);
        t.onclick = () => go({ page: "detail", id: a.id });
        p.appendChild(t);
      });
      return p;
    }
    const pageEl = (cls) => el(`<div class="mss-page ${cls || ""}"></div>`);
    const head = (t, s) => el(`<div class="mss-phead"><h1>${esc(t)}</h1>${s ? `<p>${esc(s)}</p>` : ""}</div>`);

    // ---- collections ----
    const pick = (ids) => ids.map(byId).filter(Boolean);
    const byPop = (list) => list.slice().sort((x, y) => reviews(y) - reviews(x));
    const byRating = (list) => list.slice().sort((x, y) => rating(y) - rating(x) || reviews(y) - reviews(x));
    const inCats = (...cs) => APPS.filter((a) => cs.includes(a.cat));
    const nonGames = APPS.filter((a) => !isGame(a));
    const games = APPS.filter(isGame);
    const HOME_SLIDES = [
      { id: "minecraft", tag: "Featured game", title: "Build anything you can imagine", sub: "Mine, craft and explore a blocky world that's all yours.", g: "linear-gradient(120deg,#14451f,#2f8a3b 55%,#8bd17c)" },
      { id: "vscode", tag: "Developer favorite", title: "Code smarter, ship faster", sub: "A full editor with tabs, syntax highlighting, a command palette and live preview.", g: "linear-gradient(120deg,#0b2a4a,#0e5ea8 55%,#25a0ec)" },
      { id: "stardew", tag: "Cozy pick", title: "Grow your dream farm", sub: "Plant crops, go fishing and ship your harvest in Stardew Valley.", g: "linear-gradient(120deg,#4a2470,#b04c93 55%,#f39a66)" },
      { id: "canva", tag: "Create", title: "Design anything, in minutes", sub: "Posters, logos, posts and slides with simple drag-and-drop.", g: "linear-gradient(120deg,#2e1878,#6f3ad8 55%,#1fb8c2)" },
      { id: "doom", tag: "Action", title: "Rip and tear", sub: "A fast raycasting shooter tribute to the 1993 classic.", g: "linear-gradient(120deg,#240404,#851212 55%,#de4f1b)" },
    ];
    const GAME_SLIDES = [
      { id: "sims", tag: "Life simulation", title: "Create a Sim, build a life", sub: "Careers, skills, friends and a house to furnish — your story, your rules.", g: "linear-gradient(120deg,#0d3b2a,#1e8a5a 55%,#6fd39a)" },
      { id: "stardew", tag: "Top rated", title: "Grow your dream farm", sub: "Inherit your grandpa's farm and turn it into something special.", g: "linear-gradient(120deg,#4a2470,#b04c93 55%,#f39a66)" },
      { id: "doom", tag: "New on Windows 12", title: "Rip and tear", sub: "Two maps, imps, demons and a trusty shotgun.", g: "linear-gradient(120deg,#240404,#851212 55%,#de4f1b)" },
      { id: "xbox", tag: "PC Game Pass", title: "Hundreds of games, one app", sub: "Play, subscribe and buy games with the Xbox app.", g: "linear-gradient(120deg,#062b06,#107c10 55%,#5dc21e)" },
    ];
    const APP_SLIDES = [
      { id: "copilot", tag: "AI", title: "Your everyday AI companion", sub: "Ask anything, get answers, and get more done with Copilot.", g: "linear-gradient(120deg,#13235c,#3a4fd6 50%,#c04dd8)" },
      { id: "canva", tag: "Create", title: "Design anything, in minutes", sub: "Posters, logos, posts and slides with simple drag-and-drop.", g: "linear-gradient(120deg,#2e1878,#6f3ad8 55%,#1fb8c2)" },
      { id: "duolingo", tag: "Learn", title: "Learn a language for free", sub: "Fun, bite-sized lessons that fit into your day.", g: "linear-gradient(120deg,#2b5c06,#58cc02 60%,#a5ed6e)" },
      { id: "word", tag: "Microsoft 365", title: "Write with confidence", sub: "Documents with a full formatting ribbon, ready to share.", g: "linear-gradient(120deg,#0b2a66,#185abd 55%,#41a5ee)" },
    ];
    const MOVIES = [
      ["The Last Orbit", "Sci-Fi", 2026, "#0f2a5c", "#6a3fd1"], ["Midnight Harbor", "Thriller", 2025, "#0b1f2a", "#1f7a8c"], ["Paper Kingdoms", "Animation", 2025, "#f39a3d", "#d1417a"],
      ["Velocity", "Action", 2026, "#3a0b0b", "#e0482d"], ["Wildwood", "Family", 2024, "#1d4a1a", "#7cc251"], ["Northern Lights", "Drama", 2025, "#0c2340", "#3fc1c9"],
      ["Pixel Hearts", "Comedy", 2025, "#5a1a6e", "#f26ca7"], ["Deep Blue Silence", "Documentary", 2024, "#021b33", "#0a6fb5"], ["Crimson Run", "Action", 2026, "#2a0008", "#b3122e"],
      ["Echoes of Mars", "Sci-Fi", 2026, "#3b1206", "#d9682b"], ["The Baker's Secret", "Comedy", 2024, "#6b3b1c", "#f0b36a"], ["Storm Chasers", "Adventure", 2025, "#1b2735", "#7a8ea3"],
    ];
    const SHOWS = [["Harborview", "Drama series", 2026, "#14213d", "#fca311"], ["Lab Rats", "Comedy series", 2025, "#003049", "#2a9d8f"], ["Frontier", "Sci-Fi series", 2026, "#1a1a2e", "#e94560"], ["Kitchen Wars", "Reality", 2025, "#6a040f", "#f48c06"], ["Small Planet", "Documentary", 2024, "#003d29", "#52b788"], ["Night Shift", "Crime series", 2026, "#10002b", "#7b2cbf"]];
    function poster(m) {
      const p = el(`<button class="mss-poster"><div class="mss-poster-art" style="background:linear-gradient(160deg,${m[3]},${m[4]})"><span>${esc(m[0])}</span></div>
        <div class="mss-card-name">${esc(m[0])}</div><div class="mss-card-cat">${esc(m[1])} · ${m[2]}</div><div class="mss-card-price">${SHOWS.includes(m) ? "Episodes from $2.99" : "Rent from $3.99"}</div></button>`);
      p.onclick = () => { if (AppRegistry.moviestv) window.WM.open("moviestv"); else if (window.Notify) Notify.show({ icon: Icon.mini("store__", "Store"), title: m[0], body: "Coming soon to Movies & TV." }); };
      return p;
    }

    // ---- pages ----
    function pHome() {
      const p = pageEl();
      p.appendChild(hero(HOME_SLIDES));
      p.appendChild(promos([
        { id: "xbox", t: "PC Game Pass", s: "Play hundreds of games", g: "linear-gradient(120deg,#0e5a0e,#2fa52f)" },
        { id: "ms365", t: "Microsoft 365", s: "Word, Excel and more", g: "linear-gradient(120deg,#b0360f,#e8692c)" },
        { id: "copilot", t: "Copilot", s: "Your everyday AI companion", g: "linear-gradient(120deg,#1d3d9e,#8a3fd6)" },
        { id: "duolingo", t: "Duolingo", s: "Learn a language for free", g: "linear-gradient(120deg,#3f8f05,#78d21f)" },
      ]));
      p.appendChild(row("Top free apps", byPop(nonGames)));
      p.appendChild(row("Top free games", byPop(games)));
      p.appendChild(row("Essential apps", byRating(inCats("Productivity", "Utilities"))));
      p.appendChild(row("Best entertainment apps", byPop(inCats("Multimedia", "Social", "Lifestyle"))));
      p.appendChild(row("Trending", APPS.slice().sort((x, y) => hash(x.id + "trend") - hash(y.id + "trend"))));
      p.appendChild(row("Tools for developers", byRating(inCats("Developer", "System"))));
      p.appendChild(row("New movies", MOVIES, { make: poster, seeAll: () => go({ page: "movies" }) }));
      return p;
    }
    let appCat = "All";
    function pApps() {
      const p = pageEl();
      p.appendChild(head("Apps", "Get the apps you need for work, school and play"));
      p.appendChild(hero(APP_SLIDES));
      p.appendChild(row("Top free apps", byPop(nonGames)));
      p.appendChild(row("Productivity", byRating(inCats("Productivity"))));
      p.appendChild(row("Photo & video", byPop(inCats("Multimedia"))));
      p.appendChild(row("Utilities & tools", byRating(inCats("Utilities", "System"))));
      p.appendChild(row("Social & lifestyle", byPop(inCats("Social", "Lifestyle", "Finance"))));
      p.appendChild(row("Developer tools", byRating(inCats("Developer"))));
      const all = el(`<section class="mss-row"><div class="mss-row-h"><h3>All apps</h3></div></section>`);
      const cats = ["All", ...new Set(nonGames.map((a) => a.cat))];
      const draw = () => {
        all.querySelectorAll(".mss-chips,.mss-grid").forEach((x) => x.remove());
        all.appendChild(chips(cats, appCat, (k) => { appCat = k; draw(); }));
        all.appendChild(grid(nonGames.filter((a) => appCat === "All" || a.cat === appCat).sort((x, y) => x.name.localeCompare(y.name))));
      };
      draw(); p.appendChild(all);
      return p;
    }
    function pGaming() {
      const p = pageEl();
      p.appendChild(head("Gaming", "Play the best PC games on Windows 12"));
      p.appendChild(hero(GAME_SLIDES));
      p.appendChild(row("Top free games", byPop(games)));
      p.appendChild(row("Classic arcade", pick(["snake", "pong", "breakout", "whack", "simon", "app_20"])));
      p.appendChild(row("Puzzle & brain games", pick(["g2048", "memory", "minesweeper", "app_21", "tictactoe", "guess", "rps", "app_18", "app_19"])));
      p.appendChild(row("Minecraft & more", pick(["minecraft", "mclauncher", "curseforge", "xbox"])));
      const all = el(`<section class="mss-row"><div class="mss-row-h"><h3>All games</h3></div></section>`);
      all.appendChild(grid(games.slice().sort((x, y) => x.name.localeCompare(y.name))));
      p.appendChild(all);
      return p;
    }
    function pMovies() {
      const p = pageEl();
      p.appendChild(head("Movies & TV", "Rent or buy the latest movies and TV shows"));
      const b = el(`<section class="mss-mbanner" style="background:linear-gradient(120deg,#0f2a5c,#6a3fd1 60%,#e05a9b)"><div><span class="mss-slide-tag">New release</span><h2>The Last Orbit</h2><p>A stranded crew. A dying star. One last way home.</p><button class="mss-btn-light">Rent from $3.99</button></div></section>`);
      b.querySelector("button").onclick = () => poster(MOVIES[0]).onclick();
      p.appendChild(b);
      p.appendChild(row("New movies", MOVIES, { make: poster, seeAll: () => {} }));
      p.appendChild(row("Top TV shows", SHOWS, { make: poster, seeAll: () => {} }));
      const all = el(`<section class="mss-row"><div class="mss-row-h"><h3>Browse all</h3></div><div class="mss-grid mss-grid-posters"></div></section>`);
      [...MOVIES, ...SHOWS].forEach((m) => all.querySelector(".mss-grid").appendChild(poster(m)));
      p.appendChild(all);
      p.querySelectorAll(".mss-see").forEach((x) => x.style.visibility = "hidden");
      return p;
    }
    function pList(v) {
      const p = pageEl();
      p.appendChild(head(v.title, v.ids.length + " items"));
      p.appendChild(grid(pick(v.ids)));
      return p;
    }
    function pSearch(v) {
      const q = v.q.trim().toLowerCase();
      const p = pageEl();
      const hits = APPS.filter((a) => (a.name + " " + a.cat + " " + (a.desc || "") + " " + publisher(a)).toLowerCase().includes(q))
        .sort((x, y) => (y.name.toLowerCase().startsWith(q) - x.name.toLowerCase().startsWith(q)) || x.name.localeCompare(y.name));
      const mv = [...MOVIES, ...SHOWS].filter((m) => (m[0] + " " + m[1]).toLowerCase().includes(q));
      p.appendChild(head(`Results for "${v.q}"`));
      const f = v.f || "all";
      const counts = { all: hits.length + mv.length, apps: hits.filter((a) => !isGame(a)).length, games: hits.filter(isGame).length, movies: mv.length };
      const labels = { all: "All", apps: "Apps", games: "Games", movies: "Movies & TV" };
      const c = el(`<div class="mss-chips"></div>`);
      Object.keys(labels).forEach((k) => { const b = el(`<button class="mss-chip${k === f ? " on" : ""}">${labels[k]} <span>${counts[k]}</span></button>`); b.onclick = () => { v.f = k; render(); }; c.appendChild(b); });
      p.appendChild(c);
      const shown = f === "movies" ? [] : hits.filter((a) => f === "all" || (f === "games") === isGame(a));
      if (shown.length) p.appendChild(grid(shown));
      if (mv.length && (f === "all" || f === "movies")) { const g = el(`<div class="mss-grid mss-grid-posters"></div>`); mv.forEach((m) => g.appendChild(poster(m))); if (shown.length) p.appendChild(el(`<h3 class="mss-subh">Movies & TV</h3>`)); p.appendChild(g); }
      if (!shown.length && !(mv.length && (f === "all" || f === "movies"))) {
        p.appendChild(el(`<div class="mss-empty">${IC.search}<b>No results for "${esc(v.q)}"</b><span>Check the spelling or try searching for something else.</span></div>`));
      }
      return p;
    }

    function pDetail(v) {
      const a = byId(v.id);
      if (!a) return el(`<div class="mss-page"><div class="mss-empty"><b>This app isn't available.</b></div></div>`);
      const r = rating(a), n = reviews(a), h = hash(a.id), [ageC, ageT] = age(a), mb = sizeMB(a);
      const ver = `${1 + (h % 9)}.${h % 30}.${(h >>> 5) % 400}.0`;
      const rel = new Date(2018 + (h % 8), (h >>> 3) % 12, 1 + ((h >>> 7) % 27)).toLocaleDateString("en-US");
      const g = Icon.gradientFor ? Icon.gradientFor(a.name) : "linear-gradient(135deg,#0067c0,#5b2bd6)";
      const pal = [["#0f4c81", "#58a6ff"], ["#5b2bd6", "#e05a9b"], ["#0a7a5a", "#7bd88f"], ["#b3471f", "#f5b04b"], ["#1f2a44", "#6c7fa8"]];
      const shots = [0, 1, 2, 3].map((i) => {
        const c = pal[(h + i) % pal.length];
        return `<div class="mss-shot" style="background:linear-gradient(135deg,${c[0]},${c[1]})"><div class="mss-shot-win"><div class="mss-shot-bar"><i></i><i></i><i></i></div>
          <div class="mss-shot-body"><div class="mss-shot-side"><b></b><b></b><b></b></div><div class="mss-shot-main">${Icon.box(a.id, a.name, i === 0 ? 72 : 48)}<b style="width:${50 + ((h >>> i) % 40)}%"></b><b style="width:${30 + ((h >>> (i + 2)) % 50)}%"></b></div></div></div></div>`;
      }).join("");
      const feats = isGame(a)
        ? ["Jump straight in — no account or setup needed", "Smooth performance on Windows 12 PCs", "Keyboard, mouse and touch controls", "Track your best scores and achievements"]
        : ["Fast, fluid design made for Windows 12", "Works great with touch, pen, mouse and keyboard", "Pin it to Start and the taskbar for quick access", "Automatic updates from the Microsoft Store"];
      const wn = ["Performance and reliability improvements", "Refreshed look to match Windows 12", "Fixes for issues reported by our community"];
      const w5 = Math.max(8, (r - 3.4) * 50 + 30), dist = { 5: w5, 4: 26, 3: Math.max(4, (4.9 - r) * 12 + 4), 2: Math.max(2, (4.9 - r) * 5 + 2), 1: Math.max(2, (4.9 - r) * 8 + 3) };
      const tot = Object.values(dist).reduce((s, x) => s + x, 0);
      const NAMES = ["Alex M.", "Priya S.", "Jordan K.", "Sam T.", "Maria G.", "Chris P.", "Taylor R.", "Noah B.", "Lena W.", "Omar H."];
      const REV = isGame(a)
        ? [[5, "So much fun", "Easy to pick up and hard to put down. Runs smooth on my laptop."], [4, "Great time killer", "Really enjoying it. Would love a few more levels."], [5, "Classic!", "Brings back memories. Controls feel just right."], [3, "Pretty good", "Fun, but I wish there were more options in the settings."]]
        : [[5, "Does exactly what I need", "Clean, fast and simple. Opens instantly and never crashes."], [4, "Really useful", "Use it every day. A dark mode toggle inside the app would be nice."], [5, "Love the new design", "Fits right in with Windows 12. Great job by the team."], [4, "Solid app", "Works well with touch on my tablet. Recommended."]];
      const revs = [0, 1, 2].map((i) => { const x = REV[(h + i) % REV.length]; const nm = NAMES[(h + i * 3) % NAMES.length]; const d = new Date(2026, (h + i) % 11, 1 + ((h >>> i) % 27)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); return { s: x[0], t: x[1], b: x[2], nm, d, help: 3 + ((h >>> (i + 1)) % 60) }; });
      const stars = (val) => `<span class="mss-stars" style="--p:${(val / 5) * 100}%" aria-label="${val} out of 5 stars">★★★★★</span>`;
      const req = [["OS", "Windows 12 version 22H2 or higher"], ["Architecture", "x64, ARM64"], ["Memory", isGame(a) ? "8 GB" : "4 GB"], ["Storage", fmtSize(mb)], ...(isGame(a) ? [["Graphics", "DirectX 12 compatible"]] : []), ["Keyboard", "Integrated keyboard"], ["Mouse", "Integrated mouse"]];
      const d = el(`<div class="mss-page mss-detail">
        <section class="mss-dhero">
          <div class="mss-dhero-bg" style="background:${g}"></div>
          <div class="mss-dicon">${Icon.box(a.id, a.name, 112)}</div>
          <div class="mss-dinfo">
            <h1>${esc(a.name)}</h1>
            <button class="mss-pub">${esc(publisher(a))}</button>
            <div class="mss-dstats">
              <div class="mss-stat"><b>${r} <span class="mss-star">★</span></b><span>${fmtK(n)} ratings</span></div>
              <div class="mss-stat"><b><span class="mss-age">${ageC}</span></b><span>${ageT}</span></div>
              <div class="mss-stat"><b>${esc(a.cat)}</b><span>${isGame(a) ? "Game" : "App"}</span></div>
              <div class="mss-stat"><b>${fmtSize(mb)}</b><span>Size</span></div>
            </div>
            <div class="mss-act mss-act-big" data-mss-act="${a.id}"></div>
            <div class="mss-dnote">${a.price ? priceOf(a) + " · " : "Free · "}${isGame(a) ? "Offers in-game achievements" : "Get this app on up to 10 Windows devices"}</div>
          </div>
        </section>
        <section class="mss-sec"><h3>Screenshots</h3><div class="mss-shots">${shots}</div></section>
        <section class="mss-sec"><h3>Description</h3>
          <p>${esc(a.desc || a.name + " for Windows 12.")}</p>
          <p>${esc(a.name)} is ${isGame(a) ? "a free game" : "a free app"} from ${esc(publisher(a))}. Install it from the Microsoft Store to keep it up to date automatically, pin it to Start, and launch it right from your desktop.</p>
          <ul class="mss-feats">${feats.map((x) => `<li>${IC.check}<span>${x}</span></li>`).join("")}</ul></section>
        <section class="mss-sec"><h3>What's new in this version</h3><p class="mss-dim">Version ${ver}</p><ul class="mss-bul">${wn.map((x) => `<li>${x}</li>`).join("")}</ul></section>
        <section class="mss-sec"><h3>Ratings and reviews</h3>
          <div class="mss-rr">
            <div class="mss-rr-sum"><div class="mss-rr-big">${r}</div>${stars(+r)}<div class="mss-dim">${n.toLocaleString("en-US")} ratings</div></div>
            <div class="mss-rr-bars">${[5, 4, 3, 2, 1].map((k) => `<div class="mss-rr-row"><span>${k}</span><span class="mss-star">★</span><div class="mss-rr-bar"><i style="width:${(dist[k] / tot) * 100}%"></i></div></div>`).join("")}</div>
          </div>
          <div class="mss-reviews">${revs.map((x) => `<div class="mss-review"><div class="mss-rv-top"><span class="mss-rv-av">${x.nm[0]}</span><div><b>${x.nm}</b><span class="mss-dim">${x.d}</span></div></div>${stars(x.s)}<b class="mss-rv-t">${x.t}</b><p>${x.b}</p><span class="mss-dim mss-rv-help">${x.help} people found this helpful</span></div>`).join("")}</div>
        </section>
        <section class="mss-sec"><h3>System requirements</h3>
          <div class="mss-req-ok">${IC.check}<span>This product should work on your device. Items with a check mark meet the developer's minimum requirements.</span></div>
          <div class="mss-req">${req.map((x) => `<div class="mss-req-row"><span class="mss-req-k">${x[0]}</span><span class="mss-req-v">${x[1]}</span><span class="mss-req-ck">${IC.check}</span></div>`).join("")}</div>
        </section>
        <section class="mss-sec"><h3>Additional information</h3>
          <div class="mss-info">
            <div><span>Published by</span><b>${esc(publisher(a))}</b></div><div><span>Release date</span><b>${rel}</b></div>
            <div><span>Approximate size</span><b>${fmtSize(mb)}</b></div><div><span>Category</span><b>${esc(a.cat)}</b></div>
            <div><span>Age rating</span><b>${ageT}</b></div><div><span>Installation</span><b>Get this ${isGame(a) ? "game" : "app"} while signed in to your Microsoft account and install on up to ten Windows devices.</b></div>
            <div><span>Languages supported</span><b>English (United States) and 24 more</b></div><div><span>Version</span><b>${ver}</b></div>
          </div>
        </section>
        <section class="mss-sec mss-related"></section>
      </div>`);
      d.querySelector(".mss-pub").onclick = () => go({ page: "search", q: publisher(a), f: "all" });
      paintAct(d.querySelector(".mss-act"), a);
      const rel2 = APPS.filter((x) => x.cat === a.cat && x.id !== a.id);
      if (rel2.length) d.querySelector(".mss-related").replaceWith(row("People also like", byPop(rel2)));
      else d.querySelector(".mss-related").remove();
      return d;
    }

    // ---- Get / Open / Uninstall ----
    function paintAct(slot, a) {
      const j = JOBS[a.id];
      const mode = j ? "job" : isInstalled(a.id) ? "inst" : "get";
      if (mode === "job" && slot.dataset.mode === "job") {
        slot.querySelector(".mss-prog-l").textContent = j.phase === "download" ? `Downloading… ${Math.floor(j.pct)}%` : "Installing…";
        slot.querySelector(".mss-prog-r").textContent = j.phase === "download" ? `${fmtSize(j.total * j.pct / 100)} of ${fmtSize(j.total)}` : "";
        slot.querySelector(".mss-bar").classList.toggle("ind", j.phase !== "download");
        slot.querySelector(".mss-bar i").style.width = (j.phase === "download" ? j.pct : 100) + "%";
        return;
      }
      slot.dataset.mode = mode;
      if (mode === "job") {
        slot.innerHTML = `<div class="mss-prog"><div class="mss-prog-top"><span class="mss-prog-l"></span><span class="mss-prog-r"></span><button class="mss-prog-x" title="Cancel" aria-label="Cancel">${IC.x}</button></div><div class="mss-bar"><i></i></div></div>`;
        slot.querySelector(".mss-prog-x").onclick = (e) => { e.stopPropagation(); delete JOBS[a.id]; refreshApp(a.id); };
        slot.dataset.mode = "job"; paintAct(slot, a);
      } else if (mode === "inst") {
        slot.innerHTML = `<button class="mss-btn mss-btn-primary mss-open">Open</button>${canUninstall(a.id) ? `<button class="mss-btn mss-btn-sub mss-uninst">Uninstall</button>` : ""}`;
        slot.querySelector(".mss-open").onclick = (e) => { e.stopPropagation(); window.WM.open(a.id); };
        const un = slot.querySelector(".mss-uninst");
        if (un) un.onclick = (e) => {
          e.stopPropagation();
          slot.dataset.mode = "confirm";
          slot.innerHTML = `<span class="mss-confirm">Uninstall ${esc(a.name)}?</span><button class="mss-btn mss-btn-danger">Uninstall</button><button class="mss-btn mss-btn-sub">Cancel</button>`;
          slot.querySelector(".mss-btn-danger").onclick = (ev) => { ev.stopPropagation(); doUninstall(a); };
          slot.querySelector(".mss-btn-sub").onclick = (ev) => { ev.stopPropagation(); slot.dataset.mode = ""; paintAct(slot, a); };
        };
      } else {
        slot.innerHTML = `<button class="mss-btn mss-btn-primary mss-get">${a.price ? priceOf(a) : "Get"}</button>`;
        slot.querySelector(".mss-get").onclick = (e) => { e.stopPropagation(); startGet(a); };
      }
    }
    function refreshApp(id) {
      const a = byId(id); if (!a) return;
      document.querySelectorAll(`[data-mss-act="${id}"]`).forEach((s) => paintAct(s, a));
      document.querySelectorAll(`[data-mss-price="${id}"]`).forEach((s) => { s.textContent = priceLabel(a); s.classList.toggle("is-inst", isInstalled(id) && !JOBS[id]); });
    }
    function startGet(a) {
      if (JOBS[a.id] || isInstalled(a.id)) return;
      if (a.price && S().bank && S().bank.balance < a.price) { alert("Insufficient funds."); return; }
      const begin = () => {
        if (JOBS[a.id]) return;
        const job = JOBS[a.id] = { phase: "download", pct: 0, total: sizeMB(a), ticks: 0 };
        refreshApp(a.id);
        const t = setInterval(() => {
          if (JOBS[a.id] !== job) { clearInterval(t); return; } // cancelled
          if (job.phase === "download") {
            job.pct = Math.min(100, job.pct + 2.5 + Math.random() * 7);
            if (job.pct >= 100) { job.pct = 100; job.phase = "install"; }
          } else if (++job.ticks >= 7) { clearInterval(t); finish(job); return; }
          refreshApp(a.id);
        }, 170);
      };
      const finish = (job) => {
        const done = () => {
          if (a.price) State.addTransaction({ vendor: "App Store", item: a.name, amount: a.price, refundable: true, kind: "app", refId: a.id });
          if (!S().installedApps.includes(a.id)) S().installedApps.push(a.id);
          State.save();
          if (window.WM.refreshDesktopIcons) window.WM.refreshDesktopIcons();
          if (JOBS[a.id] === job) delete JOBS[a.id];
          refreshApp(a.id);
          if (window.Notify) Notify.show({ icon: Icon.mini(a.id, a.name), title: "Installed", body: a.name + " is installed and ready to use.", onClick: () => window.WM.open(a.id) });
          if (!closed && cur().page === "library") render();
        };
        // Some apps run a fake installer (terminal -> installer) or a UAC prompt after downloading.
        if (window.Installer && window.Installer.hasFlow(a.id)) window.Installer.install(a, done); else done();
      };
      if (a.price && window.Pay) Pay.ensureCard(begin, { item: a.name, amount: a.price }); else begin();
    }
    function doUninstall(a) {
      const i = S().installedApps.indexOf(a.id); if (i >= 0) S().installedApps.splice(i, 1);
      State.save();
      if (window.WM.refreshDesktopIcons) window.WM.refreshDesktopIcons();
      if (window.Notify) Notify.show({ icon: Icon.mini(a.id, a.name), title: "Microsoft Store", body: a.name + " was uninstalled." });
      refreshApp(a.id);
      if (cur().page === "library") render();
    }

    // ---- Library ----
    let libF = "All", UPD = { phase: "idle" };
    function installedList() { return APPS.filter((a) => isInstalled(a.id) && !JOBS[a.id]).sort((x, y) => x.name.localeCompare(y.name)); }
    function libRow(a) {
      const r = el(`<div class="mss-lib-row"><button class="mss-lib-main">${Icon.box(a.id, a.name, 40)}<span><b>${esc(a.name)}</b><span class="mss-dim">${esc(a.cat)} · ${esc(publisher(a))}</span></span></button>
        <span class="mss-lib-meta mss-dim">${fmtSize(sizeMB(a))}</span><div class="mss-act mss-act-sm" data-mss-act="${a.id}"></div></div>`);
      r.querySelector(".mss-lib-main").onclick = () => go({ page: "detail", id: a.id });
      paintAct(r.querySelector(".mss-act"), a);
      return r;
    }
    function lastChecked() { const t = S().appData && S().appData.storeLastUpdate; return t ? new Date(t) : null; }
    const fmtWhen = (d) => (d.toDateString() === new Date().toDateString() ? "Today" : d.toLocaleDateString("en-US", { month: "short", day: "numeric" })) + " at " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    function paintUpd() {
      const box = body.querySelector(".mss-upd"), btn = body.querySelector(".mss-upd-btn");
      if (!box) return;
      const busy = UPD.phase === "check" || UPD.phase === "update";
      if (btn) { btn.disabled = busy; btn.querySelector("span").textContent = busy ? (UPD.phase === "check" ? "Checking…" : "Updating…") : "Get updates"; btn.classList.toggle("spin", busy); }
      if (UPD.phase === "check") box.innerHTML = `<div class="mss-upd-card"><b>Checking for updates…</b><div class="mss-bar ind"><i style="width:100%"></i></div></div>`;
      else if (UPD.phase === "update") box.innerHTML = `<div class="mss-upd-card"><b>Updating ${UPD.items.length} app${UPD.items.length === 1 ? "" : "s"}</b>${UPD.items.map((it) => `<div class="mss-upd-item">${Icon.box(it.a.id, it.a.name, 28)}<span class="mss-upd-n">${esc(it.a.name)}</span><span class="mss-dim">${it.pct >= 100 ? "Updated" : it.pct > 0 ? "Downloading… " + Math.floor(it.pct) + "%" : "Pending"}</span><div class="mss-bar"><i style="width:${it.pct}%"></i></div></div>`).join("")}</div>`;
      else if (UPD.phase === "done") box.innerHTML = `<div class="mss-upd-card mss-upd-ok"><span class="mss-upd-ic">${IC.check}</span><div><b>You're up to date</b><span class="mss-dim">${UPD.n ? UPD.n + " app" + (UPD.n === 1 ? " was" : "s were") + " updated. " : ""}Last checked: ${fmtWhen(UPD.at)}</span></div></div>`;
      else { const lc = lastChecked(); box.innerHTML = lc ? `<div class="mss-dim mss-upd-last">Last checked: ${fmtWhen(lc)}</div>` : ""; }
    }
    function runUpdates() {
      if (UPD.phase === "check" || UPD.phase === "update") return;
      UPD = { phase: "check" }; paintUpd();
      setTimeout(() => {
        const list = installedList().filter((a) => a.id !== "store__").sort((x, y) => hash(x.id + Date.now()) - hash(y.id + Date.now()));
        const items = list.slice(0, Math.min(list.length, 2 + Math.floor(Math.random() * 2))).map((a) => ({ a, pct: 0 }));
        UPD = { phase: "update", items, i: 0 }; paintUpd();
        const st = UPD;
        const t = setInterval(() => {
          if (UPD !== st) { clearInterval(t); return; }
          const it = st.items[st.i];
          if (!it) {
            clearInterval(t);
            if (S().appData) { S().appData.storeLastUpdate = Date.now(); State.save(); }
            UPD = { phase: "done", n: st.items.length, at: new Date() }; paintUpd(); return;
          }
          it.pct = Math.min(100, it.pct + 9 + Math.random() * 16);
          if (it.pct >= 100) st.i++;
          paintUpd();
        }, 150);
      }, 1600);
    }
    function pLibrary() {
      const p = pageEl("mss-lib");
      const h = el(`<div class="mss-lib-head"><div class="mss-phead"><h1>Library</h1><p>Apps and games you own</p></div><button class="mss-btn mss-btn-primary mss-upd-btn">${IC.refresh}<span>Get updates</span></button></div>`);
      h.querySelector(".mss-upd-btn").onclick = runUpdates;
      p.appendChild(h);
      p.appendChild(el(`<div class="mss-upd"></div>`));
      const dl = Object.keys(JOBS).map(byId).filter(Boolean);
      if (dl.length) {
        const s = el(`<section class="mss-lib-sec"><h3>Downloads</h3><div class="mss-lib-list"></div></section>`);
        dl.forEach((a) => s.querySelector(".mss-lib-list").appendChild(libRow(a)));
        p.appendChild(s);
      }
      const all = installedList();
      const list = all.filter((a) => libF === "All" || (libF === "Games") === isGame(a));
      const s = el(`<section class="mss-lib-sec"><div class="mss-lib-bar"><h3>Installed <span class="mss-dim">${list.length}</span></h3></div><div class="mss-lib-list"></div></section>`);
      s.querySelector(".mss-lib-bar").appendChild(chips(["All", "Apps", "Games"], libF, (k) => { libF = k; render(); }));
      list.forEach((a) => s.querySelector(".mss-lib-list").appendChild(libRow(a)));
      if (!list.length) s.appendChild(el(`<div class="mss-empty"><b>Nothing here yet</b><span>Apps and games you get from the Store will show up here.</span></div>`));
      p.appendChild(s);
      requestAnimationFrame(paintUpd);
      return p;
    }
    function pHelp() {
      const p = pageEl("mss-help");
      p.appendChild(head("Help", "Get help with the Microsoft Store"));
      const qa = [
        ["How do I install an app or game?", "Find it on Home, Apps or Gaming (or search for it), open its page and select Get. The download and install progress shows on the button, and the app appears on your desktop when it's done."],
        ["Where do I find the apps I installed?", "Select Library at the bottom of the left menu. Every app and game you own is listed there with an Open button."],
        ["How do I update my apps?", "Go to Library and select Get updates. The Store checks for new versions and installs them for you."],
        ["How do I uninstall an app?", "Open the app's page in the Store and select Uninstall, or right-click its desktop icon and choose Delete. Apps that come with Windows can't be uninstalled."],
        ["Are the apps free?", "Yes. Every app and game in this Store is free to get."],
        ["A download is stuck. What can I do?", "Select the X next to the progress bar to cancel it, then select Get again."],
      ];
      const list = el(`<div class="mss-faq"></div>`);
      qa.forEach(([q, ans], i) => list.appendChild(el(`<details class="mss-faq-i"${i === 0 ? " open" : ""}><summary>${q}${IC.chevR}</summary><p>${ans}</p></details>`)));
      p.appendChild(list);
      return p;
    }

    render();
  };

  function isInstalled(id) {
    const defaults = ["browser", "chrome", "edge", "settings", "calculator", "mediaplayer", "youtubeApp", "ms365", "notepad", "copilot", "imagestudio", "textgen", "fileexplorer", "duolingo", "blockfinder", "messenger", "word", "powerpoint", "excel", "forms", "clock", "outlook", "onenote", "minecraft", "mclauncher", "xbox", "curseforge", "codeeditor", "vscode", "canva", "acrobat", "qrcode", "achievements", "powershell", "security", "solitaire", "colorpicker", "run", "taskmanager", "tips", "snip", "calendar", "weather", "store__"];
    return defaults.includes(id) || S().installedApps.includes(id);
  }

  // ---------- Calculator ----------
  AppRegistry.calculator = function () {
    const { body } = cw({ title: "Calculator", icon: Icon.mini("calculator", "Calc"), width: 320, height: 460, appId: "calculator" });
    body.innerHTML = `<div class="calc"><div class="calc-display" id="disp">0</div><div class="calc-grid"></div></div>`;
    const disp = body.querySelector("#disp"), grid = body.querySelector(".calc-grid");
    let cur = "0", prev = null, op = null, fresh = true;
    const keys = ["C", "±", "%", "÷", "7", "8", "9", "×", "4", "5", "6", "−", "1", "2", "3", "+", "0", ".", "="];
    keys.forEach((k) => {
      const isOp = ["÷", "×", "−", "+", "=", "C", "±", "%"].includes(k);
      const b = el(`<button class="${isOp && k !== "C" ? "op" : ""}" ${k === "0" ? 'style="grid-column:span 2"' : ""}>${k}</button>`);
      b.onclick = () => press(k);
      grid.appendChild(b);
    });
    function press(k) {
      if (k === "C") { cur = "0"; prev = null; op = null; fresh = true; }
      else if ("0123456789".includes(k)) { cur = fresh ? k : (cur === "0" ? k : cur + k); fresh = false; }
      else if (k === ".") { if (fresh) { cur = "0."; fresh = false; } else if (!cur.includes(".")) cur += "."; }
      else if (k === "±") cur = String(parseFloat(cur) * -1);
      else if (k === "%") cur = String(parseFloat(cur) / 100);
      else if (["÷", "×", "−", "+"].includes(k)) { if (op && !fresh) compute(); prev = parseFloat(cur); op = k; fresh = true; }
      else if (k === "=") compute();
      disp.textContent = cur;
    }
    function compute() {
      if (op == null || prev == null) return;
      const b = parseFloat(cur);
      let r = prev;
      if (op === "+") r = prev + b; if (op === "−") r = prev - b; if (op === "×") r = prev * b; if (op === "÷") r = b ? prev / b : 0;
      cur = String(Math.round(r * 1e10) / 1e10); op = null; prev = null; fresh = true;
    }
  };

  // ---------- Media Player ----------
  AppRegistry.mediaplayer = function () {
    const { body } = cw({ title: "Media Player", icon: Icon.mini("mediaplayer", "Media"), width: 640, height: 480, appId: "mediaplayer" });
    body.innerHTML = `<div class="mp"><button class="pill-btn" id="pick">Open a file from your device</button>
      <div id="stage" class="center-col grow" style="justify-content:center"><button class="mp-bigplay" id="bigplay" title="Open a file"><img src="assets/wmp_play.png?v=9" alt="Play"></button><p class="muted">No media loaded — tap play to open a file.</p></div></div>`;
    const stage = body.querySelector("#stage");
    body.querySelector("#pick").onclick = body.querySelector("#bigplay").onclick = () => {
      const inp = document.getElementById("globalFileInput");
      inp.accept = "video/*,audio/*,image/*"; inp.value = "";
      inp.onchange = () => {
        const f = inp.files[0]; if (!f) return;
        const url = URL.createObjectURL(f);
        stage.innerHTML = "";
        let elem;
        if (f.type.startsWith("video")) elem = el(`<video src="${url}" controls autoplay></video>`);
        else if (f.type.startsWith("audio")) elem = el(`<audio src="${url}" controls autoplay></audio>`);
        else if (f.type.startsWith("image")) elem = el(`<img src="${url}">`);
        else { stage.innerHTML = "<p class='muted'>Unsupported file type.</p>"; return; }
        stage.appendChild(elem);
        stage.appendChild(el(`<p class="muted">${f.name}</p>`));
      };
      inp.click();
    };
  };

  // ---------- VLC media player (Store app) ----------
  AppRegistry.vlc = function () {
    const { body } = cw({ title: "VLC media player", icon: Icon.mini("vlc", "VLC"), width: 680, height: 500, appId: "vlc" });
    body.innerHTML = `<div class="vlc">
      <div class="vlc-head">${Icon.mini("vlc", "VLC")} <b>VLC media player</b><span class="grow"></span><button class="pill-btn" id="pick">Open media…</button></div>
      <div class="vlc-stage" id="stage"><div class="center-col" style="justify-content:center;height:100%"><div style="transform:scale(2);margin-bottom:16px">${Icon.big("vlc", "VLC")}</div><p class="muted">Open a video or audio file to start playback.</p></div></div>
    </div>`;
    const stage = body.querySelector("#stage");
    body.querySelector("#pick").onclick = () => {
      const inp = document.getElementById("globalFileInput");
      inp.accept = "video/*,audio/*"; inp.value = "";
      inp.onchange = () => {
        const f = inp.files[0]; if (!f) return;
        const url = URL.createObjectURL(f);
        stage.innerHTML = "";
        const elem = f.type.startsWith("audio")
          ? el(`<audio src="${url}" controls autoplay style="width:90%"></audio>`)
          : el(`<video src="${url}" controls autoplay style="max-width:100%;max-height:100%"></video>`);
        stage.appendChild(elem);
        stage.appendChild(el(`<p class="muted" style="margin-top:8px">${f.name}</p>`));
      };
      inp.click();
    };
  };

  // ---------- Settings ----------
  // Settings app lives in js/settings12.js (Windows 12 style); it reuses the pieces below.

  // ---------- Windows Update ----------
  const UPDATES = [
    { name: "2026-07 Cumulative Update for Windows 12 (KB5039211)", size: "612 MB" },
    { name: "Windows 12 Feature Experience Pack 1000.26100.42", size: "148 MB" },
    { name: "Security Intelligence Update for Defender (KB2267602)", size: "84 MB" },
    { name: "Intel — System — Firmware Update", size: "12 MB" },
  ];
  function renderWindowsUpdate(sb) {
    if (!S().update) S().update = { installed: false, lastCheck: null };
    const u = S().update;
    sb.innerHTML = `<div class="wu">
      <div class="wu-hero">
        <div class="wu-ic ${u.installed ? "ok" : ""}">${u.installed ? wuCheck() : wuSpin()}</div>
        <div class="wu-hero-txt">
          <h2>${u.installed ? "You're up to date" : "Updates available"}</h2>
          <p class="muted">${u.installed ? "Last checked: just now" : UPDATES.length + " updates ready to install"}</p>
        </div>
        <span class="grow"></span>
        <button class="pill-btn wu-btn">${u.installed ? "Check for updates" : "Download & install all"}</button>
      </div>
      <div class="wu-list"></div>
      <div class="wu-progress" style="display:none"><div class="wu-progress-label">Preparing…</div><div class="wu-bar"><div class="wu-bar-fill"></div></div></div>
    </div>`;
    const list = sb.querySelector(".wu-list");
    if (!u.installed) UPDATES.forEach((up) => list.appendChild(el(`<div class="wu-item"><span class="wu-item-ic">${wuDown()}</span><div class="wu-item-txt"><b>${up.name}</b><span>${up.size}</span></div><span class="wu-item-status">Pending</span></div>`)));
    sb.querySelector(".wu-btn").onclick = () => {
      if (u.installed) { // re-check: brief spin then "up to date"
        const btn = sb.querySelector(".wu-btn"); btn.disabled = true; btn.textContent = "Checking…";
        setTimeout(() => { u.installed = false; State.save(); renderWindowsUpdate(sb); }, 1400);
        return;
      }
      const prog = sb.querySelector(".wu-progress");
      const fill = sb.querySelector(".wu-bar-fill");
      const label = sb.querySelector(".wu-progress-label");
      const rows = [...sb.querySelectorAll(".wu-item")];
      const statuses = [...sb.querySelectorAll(".wu-item-status")];
      sb.querySelector(".wu-btn").disabled = true;
      prog.style.display = "";
      let p = 0, stage = 0;
      const stages = ["Downloading…", "Verifying…", "Installing…", "Finalizing…"];
      const iv = setInterval(() => {
        p += Math.random() * 5 + 2;
        const done = Math.floor((p / 100) * UPDATES.length);
        rows.forEach((r, i) => { r.classList.toggle("done", i < done); if (statuses[i]) statuses[i].textContent = i < done ? "Installed" : (i === done ? "Installing…" : "Pending"); });
        label.textContent = stages[Math.min(stages.length - 1, Math.floor(p / 25))];
        fill.style.width = Math.min(100, p) + "%";
        if (p >= 100) {
          clearInterval(iv);
          statuses.forEach((s) => s.textContent = "Installed"); rows.forEach((r) => r.classList.add("done"));
          label.textContent = "Updates installed. A restart may be required.";
          u.installed = true; u.lastCheck = Date.now(); State.save();
          if (window.Notify) Notify.show({ icon: Icon.mini("settings", "Update"), title: "Windows Update", body: "Your device is up to date." });
          const restart = el(`<button class="pill-btn wu-restart">Restart now</button>`);
          restart.onclick = () => location.reload();
          prog.appendChild(restart);
        }
      }, 220);
    };
  }
  function wuSpin() { return `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-2.6-6.3M21 4v5h-5"/></svg>`; }
  function wuCheck() { return `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`; }
  function wuDown() { return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>`; }

  // ---------- Notepad ----------
  AppRegistry.notepad = function () {
    const { body } = cw({ title: "Notepad", icon: Icon.mini("notepad", "Notepad"), width: 560, height: 440, appId: "notepad" });
    body.innerHTML = `<textarea style="width:100%;height:100%;border:none;outline:none;resize:none;padding:14px;background:var(--window-bg);color:var(--text);font-family:Consolas,monospace;font-size:1rem"></textarea>`;
  };

  // ---------- Paint ----------
  // ---------- Color picker (vanilla port of a HeroUI-style ColorPicker) ----------
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  function hexToRgb(hex) { hex = hex.replace("#", ""); return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)]; }
  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0;
    if (d) { if (max === r) h = ((g - b) / d) % 6; else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
    return [h, max ? d / max : 0, max];
  }
  function hsvToHex(h, s, v) {
    const i = Math.floor(h / 60) % 6, f = h / 60 - Math.floor(h / 60);
    const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    const [r, g, b] = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
    return "#" + [r, g, b].map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("");
  }
  function dragify(elm, cb) {
    const frac = (e) => {
      const r = elm.getBoundingClientRect(), t = e.touches && e.touches[0];
      return [clamp01(((t ? t.clientX : e.clientX) - r.left) / r.width), clamp01(((t ? t.clientY : e.clientY) - r.top) / r.height)];
    };
    const down = (e) => {
      e.preventDefault();
      const [fx, fy] = frac(e); cb(fx, fy);
      const mv = (ev) => { const [x, y] = frac(ev); cb(x, y); };
      const up = () => {
        window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up);
        window.removeEventListener("touchmove", mv); window.removeEventListener("touchend", up);
      };
      window.addEventListener("mousemove", mv); window.addEventListener("mouseup", up);
      window.addEventListener("touchmove", mv, { passive: false }); window.addEventListener("touchend", up);
    };
    elm.addEventListener("mousedown", down);
    elm.addEventListener("touchstart", down, { passive: false });
  }
  function makeColorPicker(initial, onChange) {
    let [h, s, v] = rgbToHsv.apply(null, hexToRgb(initial));
    const root = el(`<div class="cpk"><button type="button" class="cpk-trigger" title="Color"><span class="cpk-swatch"></span><span class="cpk-hex"></span></button></div>`);
    const swatch = root.querySelector(".cpk-swatch"), hexLbl = root.querySelector(".cpk-hex");
    let pop = null;
    const hex = () => hsvToHex(h, s, v);
    function refresh() {
      const hx = hex();
      swatch.style.background = hx; hexLbl.textContent = hx.toUpperCase();
      if (pop) {
        pop.querySelector(".cpk-area").style.background = `linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, rgba(255,255,255,0)), hsl(${h}, 100%, 50%)`;
        const at = pop.querySelector(".cpk-area-thumb");
        at.style.left = (s * 100) + "%"; at.style.top = ((1 - v) * 100) + "%"; at.style.background = hx;
        pop.querySelector(".cpk-hue-thumb").style.left = (h / 360 * 100) + "%";
        pop.querySelector(".cpk-out").textContent = Math.round(h) + "°";
        const hi = pop.querySelector(".cpk-hex-input");
        if (hi && document.activeElement !== hi) hi.value = hx.replace("#", "").toUpperCase();
      }
      if (onChange) onChange(hx);
    }
    function positionPop() {
      const r = root.querySelector(".cpk-trigger").getBoundingClientRect();
      pop.style.left = Math.min(r.left, window.innerWidth - 236) + "px";
      pop.style.top = (r.bottom + 6) + "px";
    }
    function closePop() { if (!pop) return; document.removeEventListener("mousedown", outside); pop.remove(); pop = null; }
    function outside(e) { if (pop && !pop.contains(e.target) && !root.contains(e.target)) closePop(); }
    function openPop() {
      pop = el(`<div class="cpk-pop">
        <div class="cpk-area"><div class="cpk-area-thumb"></div></div>
        <div class="cpk-hue-row"><span>Hue</span><span class="cpk-out"></span></div>
        <div class="cpk-hue"><div class="cpk-hue-thumb"></div></div>
        <div class="cpk-hex-row"><span>#</span><input class="cpk-hex-input" maxlength="6" spellcheck="false"></div></div>`);
      document.getElementById("screen").appendChild(pop);
      positionPop();
      dragify(pop.querySelector(".cpk-area"), (fx, fy) => { s = fx; v = 1 - fy; refresh(); });
      dragify(pop.querySelector(".cpk-hue"), (fx) => { h = fx * 360; refresh(); });
      const hi = pop.querySelector(".cpk-hex-input");
      hi.addEventListener("input", () => {
        const val = hi.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
        if (val.length === 6) { [h, s, v] = rgbToHsv.apply(null, hexToRgb("#" + val)); refresh(); }
      });
      refresh();
      setTimeout(() => document.addEventListener("mousedown", outside), 0);
    }
    root.querySelector(".cpk-trigger").onclick = () => { if (pop) closePop(); else openPop(); };
    refresh();
    return { el: root, getValue: hex, destroy: closePop };
  }

  AppRegistry.paint = function () {
    const { body } = cw({ title: "Paint", icon: Icon.mini("paint", "Paint"), width: 640, height: 520, appId: "paint" });
    body.innerHTML = `<div style="padding:8px;display:flex;flex-direction:column;height:100%;gap:8px">
      <div class="row"><span id="col-host"></span><input type="range" id="sz" min="1" max="30" value="5"><button class="pill-btn" id="clr">Clear</button></div>
      <canvas width="600" height="420" style="background:#fff;border:1px solid var(--border);border-radius:6px;cursor:crosshair"></canvas></div>`;
    const picker = makeColorPicker("#0485F7", () => {});
    body.querySelector("#col-host").replaceWith(picker.el);
    const cv = body.querySelector("canvas"), ctx = cv.getContext("2d");
    cv.style.touchAction = "none"; // let finger drags draw instead of scrolling (iPad/touch)
    let drawing = false;
    // Pointer events unify mouse, touch and pen — mouse events don't fire reliably
    // during a touch drag on mobile Safari, so finger drawing was broken before.
    const pos = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) * (cv.width / r.width), y: (e.clientY - r.top) * (cv.height / r.height) }; };
    cv.onpointerdown = (e) => { drawing = true; try { cv.setPointerCapture(e.pointerId); } catch (_) {} const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
    cv.onpointermove = (e) => { if (!drawing) return; const p = pos(e); ctx.strokeStyle = picker.getValue(); ctx.lineWidth = body.querySelector("#sz").value; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineTo(p.x, p.y); ctx.stroke(); };
    const stopDraw = () => { drawing = false; };
    window.addEventListener("pointerup", stopDraw);
    body.querySelector("#clr").onclick = () => ctx.clearRect(0, 0, cv.width, cv.height);
    body.closest(".win").addEventListener("wm-cleanup", () => { picker.destroy(); window.removeEventListener("pointerup", stopDraw); });
  };

  // ---------- Clock ----------
  AppRegistry.clock = function () {
    const { body } = cw({ title: "Clock", icon: Icon.mini("clock", "Clock"), width: 380, height: 320, appId: "clock" });
    body.innerHTML = `<div class="center-col" style="justify-content:center;height:100%;gap:12px">
      <div id="big" style="font-size:3rem;font-weight:300"></div><div class="muted" id="date"></div></div>`;
    const tick = () => { const b = body.querySelector("#big"); if (!b) { clearInterval(iv); return; } b.textContent = State.formatClock(); body.querySelector("#date").textContent = State.formatDate(); };
    const iv = setInterval(tick, 1000); tick();
  };

  // ---------- MS365 launcher (opens browser to bundle chooser) ----------
  AppRegistry.ms365 = function () { window.Browser.openTo("microsoft.local"); };

  // ---------- YouTube launcher ----------
  AppRegistry.youtube = function () { window.Browser.openTo("youtube.local"); };

  // ---------- Duolingo launcher ----------
  AppRegistry.duolingo = function () { window.Browser.openTo("duolingo.local"); };

  // ---------- Icon customizer (Settings) ----------
  function renderIconCustomizer(host) {
    host.innerHTML = `<h2>Personalize icons</h2>
      <p class="muted">Upload an image to use as the icon. It's saved in this browser.</p>
      <div class="row" style="margin:10px 0 18px;gap:8px;flex-wrap:wrap">
        <button class="pill-btn" id="ic-copy">Copy icons as text (paste to Claude)</button>
        <button class="btn-text" id="ic-export">Download as files</button>
        <button class="btn-text" id="ic-view">View &amp; long-press to save</button>
        <p class="muted" style="font-size:.78rem;flex-basis:100%">Tap <b>Copy icons as text</b> and paste into your Claude chat — I'll commit the actual image files into the repo so they're global.</p>
      </div>
      <div id="ic-groups" style="display:flex;flex-direction:column;gap:18px"></div>`;
    host.querySelector("#ic-export").onclick = () => exportIconsAsFiles();
    host.querySelector("#ic-view").onclick = () => viewIconsForSave();
    host.querySelector("#ic-copy").onclick = () => copyIconsAsText();
    const groups = host.querySelector("#ic-groups");
    if (S().appData.customIcons == null) S().appData.customIcons = {};

    function group(title, items) {
      const sec = document.createElement("div");
      sec.innerHTML = `<h3 style="margin:6px 0">${title}</h3>`;
      const grid = document.createElement("div");
      grid.style.cssText = "display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px";
      items.forEach((it) => {
        const row = document.createElement("div");
        row.style.cssText = "border:1px solid var(--border);border-radius:8px;padding:10px;display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center";
        const has = !!S().appData.customIcons[it.key];
        row.innerHTML = `<div>${Icon.md(it.key, it.name)}</div><div style="font-size:.8rem">${it.name}</div>
          <div class="row" style="gap:4px;flex-wrap:wrap;justify-content:center"><button class="btn-text up" style="padding:4px 8px">Upload</button>${has ? '<button class="btn-text cp" style="padding:4px 8px">Copy</button><button class="btn-text rm" style="padding:4px 8px;color:#c0392b">Remove</button>' : ""}</div>`;
        row.querySelector(".up").onclick = () => pickIcon(it.key);
        const cp = row.querySelector(".cp"); if (cp) cp.onclick = () => copyOneIcon(it.key);
        const rm = row.querySelector(".rm"); if (rm) rm.onclick = () => { delete S().appData.customIcons[it.key]; State.save(); renderIconCustomizer(host); };
        grid.appendChild(row);
      });
      sec.appendChild(grid); return sec;
    }

    const channelItems = Catalog.channels.map((c) => ({ key: c.id, name: c.name }));
    const appItems = Catalog.storeApps.filter((a) => !a.decorative).map((a) => ({ key: a.id === "duolingo" ? "duolingo_app" : a.id, name: a.name }));
    const courseItems = [
      { key: "duo_en", name: "English" }, { key: "duo_es", name: "Spanish" },
      { key: "duo_ja", name: "Japanese" }, { key: "duo_zh", name: "Mandarin" }, { key: "duo_sv", name: "Swedish" },
    ];
    const serverItems = Catalog.discordServers.map((s) => ({ key: s.id, name: s.name }));
    const duoVariants = [
      { key: "duolingo", name: "Duolingo (taskbar)" },
      { key: "duolingo_app", name: "Duolingo (home/Start)" },
      { key: "duolingo_super", name: "Super Duolingo" },
      { key: "duolingo_max", name: "Duolingo Max" },
      { key: "duo_sad", name: "Sad Duo (quit modal)" },
    ];
    const brandLogos = [
      { key: "bank", name: "Bank" },
      { key: "discord", name: "Discord (login)" },
      { key: "microsoft", name: "Microsoft" },
      { key: "amazon", name: "Amazon" },
      { key: "youtubeApp", name: "YouTube" },
    ];

    groups.appendChild(group("Duolingo variants", duoVariants));
    groups.appendChild(group("YouTube channels", channelItems));
    groups.appendChild(group("Duolingo courses", courseItems));
    groups.appendChild(group("Brand logos", brandLogos));
    groups.appendChild(group("Apps", appItems));
    groups.appendChild(group("Discord servers", serverItems));
  }

  function pickIcon(key) {
    const inp = document.getElementById("globalFileInput");
    inp.accept = "image/*"; inp.value = "";
    inp.onchange = () => {
      const f = inp.files[0]; if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        // Downscale to 256x256 to keep localStorage small.
        const img = new Image();
        img.onload = () => {
          const sz = 128;
          const c = document.createElement("canvas"); c.width = sz; c.height = sz;
          const ctx = c.getContext("2d");
          // cover-fit
          const sc = Math.max(sz / img.width, sz / img.height);
          const w = img.width * sc, h = img.height * sc;
          ctx.drawImage(img, (sz - w) / 2, (sz - h) / 2, w, h);
          if (S().appData.customIcons == null) S().appData.customIcons = {};
          // JPEG is much smaller than PNG for paste-to-Claude bridge. Quality 0.85 is plenty for 128px.
          S().appData.customIcons[key] = c.toDataURL("image/jpeg", 0.85);
          try { State.save(); } catch (e) { alert("Storage full — try smaller/fewer images."); return; }
          // Re-render desktop + active settings panel
          if (window.WM.refreshDesktopIcons) window.WM.refreshDesktopIcons();
          const settingsBody = document.querySelector(".settings-body");
          if (settingsBody) renderIconCustomizer(settingsBody);
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(f);
    };
    inp.click();
  }

  function copyOneIcon(key) {
    const url = (S().appData.customIcons || {})[key];
    if (!url) return;
    const payload = `WIN12_ICON ${key} ${url}`;
    const showFallback = () => {
      const overlay = el(`<div class="modal-mask" style="z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px">
        <div style="background:var(--window-bg);color:var(--text);max-width:520px;padding:24px;border-radius:12px">
          <h2 style="margin-top:0">Copy and paste to Claude</h2>
          <p>Tap inside, select all, copy, then paste into chat.</p>
          <textarea readonly style="width:100%;height:120px;font-family:monospace;font-size:.7rem">${payload}</textarea>
          <div style="text-align:right;margin-top:12px"><button class="pill-btn" id="cc">Close</button></div>
        </div></div>`);
      overlay.querySelector("#cc").onclick = () => overlay.remove();
      document.getElementById("screen").appendChild(overlay);
      const ta = overlay.querySelector("textarea"); ta.focus(); ta.select();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(payload).then(() => Notify.show({ icon: "", title: "Copied", body: key + " — paste it in Claude" })).catch(showFallback);
    } else showFallback();
  }

  function copyIconsAsText() {
    const icons = S().appData.customIcons || {};
    const entries = Object.entries(icons);
    if (!entries.length) { alert("No personalized icons yet."); return; }
    const payload = "WIN12_ICONS_BEGIN\n" + JSON.stringify(icons, null, 0) + "\nWIN12_ICONS_END";
    const finish = (ok) => {
      const overlay = el(`<div class="modal-mask" style="z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px">
        <div style="background:var(--window-bg);color:var(--text);max-width:520px;padding:24px;border-radius:12px">
          <h2 style="margin-top:0">${ok ? "Copied!" : "Couldn't copy — copy manually"}</h2>
          <p>${ok ? "Switch to your Claude chat and paste. I'll see the icons and commit them to the repo." : "Select the text below and copy it, then paste it into your Claude chat."}</p>
          <textarea readonly style="width:100%;height:160px;font-family:monospace;font-size:.7rem">${payload}</textarea>
          <div style="text-align:right;margin-top:12px"><button class="pill-btn" id="cc">Close</button></div>
        </div></div>`);
      overlay.querySelector("#cc").onclick = () => overlay.remove();
      document.getElementById("screen").appendChild(overlay);
      const ta = overlay.querySelector("textarea"); ta.focus(); ta.select();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(payload).then(() => finish(true)).catch(() => finish(false));
    } else finish(false);
  }

  function exportIconsAsFiles() {
    const icons = S().appData.customIcons || {};
    const entries = Object.entries(icons);
    if (!entries.length) { alert("No personalized icons to export yet."); return; }
    entries.forEach(([key, url], i) => {
      setTimeout(() => {
        const a = document.createElement("a");
        a.href = url; a.download = key + ".png";
        document.body.appendChild(a); a.click(); a.remove();
      }, i * 250);
    });
  }

  function viewIconsForSave() {
    const icons = S().appData.customIcons || {};
    const entries = Object.entries(icons);
    if (!entries.length) { alert("No personalized icons yet."); return; }
    const overlay = el(`<div class="modal-mask" style="z-index:9999;overflow:auto;padding:20px">
      <div style="background:var(--window-bg);color:var(--text);max-width:520px;margin:0 auto;padding:24px;border-radius:12px">
        <h2 style="margin-top:0">Save these to your device</h2>
        <p class="muted" style="margin-top:0">Long-press each image → <b>Save Image</b>. Then upload to <code>windows12/assets/</code> on GitHub with the filename shown.</p>
        <div id="ic-list" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:14px;margin-top:14px"></div>
        <div style="text-align:right;margin-top:18px"><button class="pill-btn" id="ic-close">Close</button></div>
      </div></div>`);
    const list = overlay.querySelector("#ic-list");
    entries.forEach(([key, url]) => {
      list.appendChild(el(`<div style="text-align:center"><img src="${url}" style="width:120px;height:120px;border-radius:8px;object-fit:cover;background:#0001"><div style="font-family:monospace;font-size:.8rem;margin-top:6px">${key}.png</div></div>`));
    });
    overlay.querySelector("#ic-close").onclick = () => overlay.remove();
    document.getElementById("screen").appendChild(overlay);
  }

  // ---------- Factory reset (Settings + Terminal command) ----------
  function factoryReset() {
    const secret = S().profile.secret;
    const label = S().profile.authType === "pin" ? "PIN" : "password";
    const p1 = prompt(`Factory reset — enter your ${label}:`);
    if (p1 == null) return false;
    if (secret && p1 !== secret) { alert("Incorrect."); return false; }
    const p2 = prompt(`Enter your ${label} again:`);
    if (p2 == null) return false;
    if (secret && p2 !== secret) { alert("Incorrect."); return false; }
    const c = prompt('Type CONFIRM (all caps) to reset this PC:');
    if (c !== "CONFIRM") { alert("Not confirmed."); return false; }
    // Keep icons/apps/desktop by default so you can "set up as new" without losing them.
    const keep = confirm("Keep your icons, installed apps and wallpaper?\n\nOK = keep them (recommended)\nCancel = wipe everything");
    State.reset(keep);
    location.reload();
    return true;
  }
  // Make available on the WM namespace for both Settings and Terminal to call.
  if (window.WM) window.WM.factoryReset = factoryReset;
  else { const iv = setInterval(() => { if (window.WM) { window.WM.factoryReset = factoryReset; clearInterval(iv); } }, 50); }
  window.SettingsParts = { makeColorPicker, renderIconCustomizer, renderWindowsUpdate, UPDATES, isInstalled };
})();
