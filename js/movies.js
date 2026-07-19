/* Movies & TV — a catalog of titles. Because we can't stream real films, clicking
   a title opens a copyright gate (the "Netflix thing"). Posters live in
   assets/movie_<id>.jpg; titles without art get a gradient tile. */
(function () {
  "use strict";
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  // Title #1 (Scream 7) + Friends have real art; the rest are placeholders until posters arrive.
  // rated = content rating (G/PG/PG-13/R, or TV-Y…TV-MA); imdb = /10; rt = Rotten Tomatoes %.
  const MOVIES = [
    { id: "scream7", title: "Scream 7", year: 2026, genre: "Horror", art: "assets/movie_scream7.jpg", rated: "R", imdb: 7.1, rt: 78, c1: "#7f1d1d", c2: "#160303" },
    { id: "friends", title: "Friends", year: 1994, genre: "Sitcom", kind: "show", art: "assets/movie_friends.jpg", rated: "TV-14", imdb: 8.9, rt: 79, c1: "#111", c2: "#000" },
    { id: "m_dune3", title: "Dune: Part Three", year: 2026, genre: "Sci-Fi", rated: "PG-13", imdb: 8.5, rt: 91, c1: "#b45309", c2: "#3a1e05" },
    { id: "m_avatar3", title: "Avatar: Fire and Ash", year: 2025, genre: "Adventure", rated: "PG-13", imdb: 7.8, rt: 82, c1: "#0e7490", c2: "#052430" },
    { id: "m_batman2", title: "The Batman Part II", year: 2026, genre: "Action", rated: "PG-13", imdb: 8.0, rt: 85, c1: "#334155", c2: "#0b1120" },
    { id: "m_wicked2", title: "Wicked: For Good", year: 2025, genre: "Musical", rated: "PG", imdb: 7.5, rt: 88, c1: "#15803d", c2: "#052e16" },
    { id: "m_mission8", title: "Mission: Impossible 8", year: 2025, genre: "Action", rated: "PG-13", imdb: 7.6, rt: 90, c1: "#b91c1c", c2: "#2a0808" },
    { id: "m_super", title: "Superman", year: 2025, genre: "Action", rated: "PG-13", imdb: 7.4, rt: 83, c1: "#1d4ed8", c2: "#0a1a4a" },
    { id: "m_jurassic", title: "Jurassic World Rebirth", year: 2025, genre: "Adventure", rated: "PG-13", imdb: 6.5, rt: 71, c1: "#166534", c2: "#04160b" },
    { id: "m_zootopia2", title: "Zootopia 2", year: 2025, genre: "Family", rated: "PG", imdb: 7.0, rt: 86, c1: "#c2410c", c2: "#3a1204" },
    { id: "m_tron", title: "Tron: Ares", year: 2025, genre: "Sci-Fi", rated: "PG-13", imdb: 6.8, rt: 74, c1: "#0891b2", c2: "#04232b" },
    { id: "m_28years", title: "28 Years Later", year: 2025, genre: "Horror", rated: "R", imdb: 7.2, rt: 89, c1: "#4d7c0f", c2: "#16240a" },
    { id: "m_f1", title: "F1: The Movie", year: 2025, genre: "Drama", rated: "PG-13", imdb: 7.8, rt: 84, c1: "#dc2626", c2: "#2a0606" },
  ];
  const ROWS = [
    { label: "New & Trending", ids: ["scream7", "m_dune3", "m_avatar3", "m_batman2", "m_wicked2", "m_mission8"] },
    { label: "Popular TV Shows", ids: ["friends"] },
    { label: "Action & Adventure", ids: ["m_super", "m_jurassic", "m_mission8", "m_batman2", "m_f1"] },
    { label: "Sci-Fi & Fantasy", ids: ["m_dune3", "m_tron", "m_avatar3", "m_super"] },
    { label: "Horror", ids: ["scream7", "m_28years"] },
  ];
  const byId = (id) => MOVIES.find((m) => m.id === id);

  // Rating badges. Content-rating and IMDb/Rotten Tomatoes render as styled text now;
  // swap the inner HTML for <img> once the official logos are provided.
  function ratingsRow(m, cls) {
    let h = `<div class="mv-ratings ${cls || ""}">`;
    if (m.rated) h += `<span class="mv-rated">${esc(m.rated)}</span>`;
    if (m.imdb != null) h += `<span class="mv-imdb"><b>IMDb</b> ${m.imdb.toFixed(1)}</span>`;
    if (m.rt != null) h += `<span class="mv-rt">${m.rt >= 60 ? "🍅" : "🤢"} ${m.rt}%</span>`;
    return h + `</div>`;
  }

  function poster(m, cls) {
    const badge = m.rated ? `<span class="mv-card-rated">${esc(m.rated)}</span>` : "";
    if (m.art) return `<div class="${cls}">${badge}<img src="${m.art}" alt="${esc(m.title)}"></div>`;
    return `<div class="${cls} mv-noart" style="background:linear-gradient(160deg, ${m.c1}, ${m.c2})">${badge}<span>${esc(m.title)}</span></div>`;
  }

  function render(body) {
    body.classList.add("mv-host");
    body.innerHTML = `<div class="mv">
      <div class="mv-top"><span class="mv-brand">🎬 Movies &amp; TV</span><span class="grow"></span><input class="mv-search" placeholder="Search movies & shows"></div>
      <div class="mv-hero"></div>
      <div class="mv-rows"></div>
    </div>`;
    const hero = body.querySelector(".mv-hero");
    const feat = byId("scream7");
    hero.style.backgroundImage = feat.art ? `linear-gradient(90deg, rgba(10,10,12,.92) 0%, rgba(10,10,12,.4) 55%, rgba(10,10,12,.1) 100%), url(${feat.art})` : "";
    hero.innerHTML = `<div class="mv-hero-in">
      <div class="mv-hero-tag">Featured</div>
      <h1>${esc(feat.title)}</h1>
      ${ratingsRow(feat, "mv-ratings-hero")}
      <p>${feat.year} · ${esc(feat.genre)} · The next chapter in the Ghostface saga.</p>
      <button class="mv-play" data-id="${feat.id}">▶ Play</button>
    </div>`;

    const rowsEl = body.querySelector(".mv-rows");
    ROWS.forEach((r) => {
      const row = el(`<div class="mv-row"><h2>${esc(r.label)}</h2><div class="mv-strip"></div></div>`);
      const strip = row.querySelector(".mv-strip");
      r.ids.map(byId).filter(Boolean).forEach((m) => {
        const card = el(poster(m, "mv-card"));
        card.title = m.title;
        card.onclick = () => gate(body, m);
        strip.appendChild(card);
      });
      rowsEl.appendChild(row);
    });

    const search = body.querySelector(".mv-search");
    search.oninput = () => {
      const q = search.value.trim().toLowerCase();
      if (!q) { render(body); return; }
      const hits = MOVIES.filter((m) => m.title.toLowerCase().includes(q) || m.genre.toLowerCase().includes(q));
      rowsEl.innerHTML = "";
      const row = el(`<div class="mv-row"><h2>Results for "${esc(search.value)}"</h2><div class="mv-strip mv-grid"></div></div>`);
      const strip = row.querySelector(".mv-strip");
      (hits.length ? hits : []).forEach((m) => { const c = el(poster(m, "mv-card")); c.onclick = () => gate(body, m); strip.appendChild(c); });
      if (!hits.length) strip.innerHTML = `<p class="mv-empty">No titles found.</p>`;
      rowsEl.appendChild(row);
      body.querySelector(".mv-search").focus();
    };

    body.querySelector(".mv-play").onclick = () => gate(body, feat);
  }

  // Streaming services shown in the "Where to watch" list (reference: Google's panel).
  const SERVICES = [
    { name: "HBO Max", sub: "Subscription", c: "#000", t: "HBO" },
    { name: "Hulu", sub: "Subscription (Requires add-on)", c: "#1ce783", t: "hulu" },
    { name: "Prime Video", sub: "Subscription", c: "#00a8e1", t: "prime" },
    { name: "Apple TV", sub: "$3.99", c: "#111", t: "tv" },
    { name: "YouTube", sub: "$2.99", c: "#ff0000", t: "▶" },
    { name: "Fandango at Home", sub: "$1.99", c: "#f57b20", t: "F" },
  ];

  // The "Where to watch" detail + copyright gate shown when a title is opened.
  function gate(body, m) {
    const ov = el(`<div class="mv-gate">
      <div class="mv-gate-card">
        ${poster(m, "mv-gate-poster")}
        <div class="mv-gate-body">
          <h2>${esc(m.title)}</h2>
          <div class="mv-gate-meta">${m.year} · ${esc(m.genre)}${m.kind === "show" ? " · TV Series" : ""}</div>
          ${ratingsRow(m)}
          <div class="mv-watch-h">Where to watch</div>
          <div class="mv-services"></div>
          <div class="mv-copyright">Due to copyright, full films and shows can't actually be streamed in this simulation.</div>
          <button class="mv-gate-back">Back to browse</button>
        </div>
        <button class="mv-gate-x" aria-label="Close">&times;</button>
      </div>
    </div>`);
    const svc = ov.querySelector(".mv-services");
    const notice = ov.querySelector(".mv-copyright");
    SERVICES.forEach((s) => {
      const row = el(`<div class="mv-svc">
        <span class="mv-svc-ic" style="background:${s.c}">${esc(s.t)}</span>
        <span class="mv-svc-name"><b>${esc(s.name)}</b><span>${esc(s.sub)}</span></span>
        <button class="mv-svc-watch">▶ Watch</button>
      </div>`);
      row.querySelector(".mv-svc-watch").onclick = () => { notice.classList.add("show"); notice.scrollIntoView({ block: "nearest" }); };
      svc.appendChild(row);
    });
    const close = () => ov.remove();
    ov.querySelector(".mv-gate-back").onclick = close;
    ov.querySelector(".mv-gate-x").onclick = close;
    ov.onclick = (e) => { if (e.target === ov) close(); };
    body.querySelector(".mv").appendChild(ov);
  }

  if (window.Icon && Icon.register) {
    Icon.register("moviestv", `<svg viewBox="0 0 128 128"><defs><linearGradient id="mvIc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7b5cff"/><stop offset="1" stop-color="#e0518a"/></linearGradient></defs><rect width="128" height="128" rx="28" fill="url(#mvIc)"/><rect x="30" y="34" width="68" height="60" rx="8" fill="#fff" opacity=".95"/><path d="M58 50l24 14-24 14z" fill="#7b5cff"/></svg>`);
  }

  window.AppRegistry = window.AppRegistry || {};
  window.AppRegistry.moviestv = function (createWindow) {
    const cw = createWindow || window.WM.createWindow;
    const ref = cw({ title: "Movies & TV", icon: window.Icon ? Icon.mini("moviestv", "Movies & TV") : "", width: 920, height: 640, appId: "moviestv" });
    render(ref.body);
    return ref;
  };
})();
