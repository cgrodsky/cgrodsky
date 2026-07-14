/* Xbox app (Game Pass store) + Minecraft Launcher.
   Ownership + Game Pass persist in appData.games. Minecraft is owned by
   default so it always plays; other titles come with Game Pass or a purchase. */
(function () {
  "use strict";
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  const S = () => State.data;
  const cw = (opts) => window.WM.createWindow(opts);

  const GP_PRICE = 16.99; // Game Pass Ultimate, monthly (pretend)
  // `play` maps a title to a built-in mini-game so it actually launches.
  const GAMES = [
    { id: "minecraft", name: "Minecraft", price: 29.99, gp: true, playable: true, tag: "Sandbox", c1: "#7cae42", c2: "#33500f", art: "assets/game_minecraft.jpg" },
    // --- Playable arcade titles (wired to the built-in mini-games) ---
    { id: "neonsnake", name: "Neon Snake", price: 9.99, gp: true, play: "snake", tag: "Arcade", c1: "#22c55e", c2: "#064e3b" },
    { id: "blockblast", name: "Block Blast", price: 9.99, gp: true, play: "breakout", tag: "Arcade", c1: "#1e88e5", c2: "#0a2540" },
    { id: "pongclassic", name: "Pong Classic", price: 4.99, gp: true, play: "pong", tag: "Arcade", c1: "#64748b", c2: "#0f172a" },
    { id: "ultra2048", name: "2048 Ultra", price: 4.99, gp: true, play: "g2048", tag: "Puzzle", c1: "#f59e0b", c2: "#7c2d12" },
    { id: "minesweeperx", name: "Minesweeper X", price: 6.99, gp: true, play: "minesweeper", tag: "Puzzle", c1: "#6b7280", c2: "#1f2937" },
    { id: "memorymatch", name: "Memory Match", price: 4.99, gp: true, play: "memory", tag: "Casual", c1: "#ec4899", c2: "#500724" },
    { id: "simonsays", name: "Simon Says", price: 4.99, gp: true, play: "simon", tag: "Casual", c1: "#14b8a6", c2: "#042f2e" },
    { id: "whackmole", name: "Whack-a-Mole", price: 4.99, gp: true, play: "whack", tag: "Arcade", c1: "#a16207", c2: "#422006" },
    { id: "tictactoe2", name: "Tic-Tac-Toe+", price: 0, gp: true, play: "tictactoe", tag: "Casual", c1: "#8b5cf6", c2: "#2e1065" },
    // --- Marquee demo tiles (art only) ---
    { id: "forza", name: "Forza Horizon 6", price: 59.99, gp: true, tag: "Racing", c1: "#8b5cf6", c2: "#2b0a5e", art: "assets/game_forza.jpg" },
    { id: "halo", name: "Halo Infinite", price: 59.99, gp: true, tag: "Shooter", c1: "#3b82f6", c2: "#0a1f3d" },
    { id: "seaofthieves", name: "Sea of Thieves", price: 39.99, gp: true, tag: "Adventure", c1: "#0891b2", c2: "#04303d" },
    { id: "starfield", name: "Starfield", price: 69.99, gp: true, tag: "RPG", c1: "#c026d3", c2: "#3b0764" },
    { id: "flightsim", name: "Microsoft Flight Simulator", price: 59.99, gp: true, tag: "Simulation", c1: "#0ea5e9", c2: "#0c4a6e", art: "assets/game_flightsim.jpg" },
    { id: "gears5", name: "Gears 5", price: 39.99, gp: true, tag: "Shooter", c1: "#dc2626", c2: "#3f0d0d" },
    { id: "fallout4", name: "Fallout 4", price: 29.99, gp: true, tag: "RPG", c1: "#65a30d", c2: "#1a2e05" },
    { id: "doometernal", name: "Doom Eternal", price: 39.99, gp: true, tag: "Shooter", c1: "#ea580c", c2: "#431407" },
    { id: "aoe4", name: "Age of Empires IV", price: 49.99, gp: true, tag: "Strategy", c1: "#b45309", c2: "#3b1d05" },
    { id: "hades", name: "Hades", price: 24.99, gp: true, tag: "Roguelike", c1: "#e11d48", c2: "#4c0519" },
    { id: "hollowknight", name: "Hollow Knight", price: 14.99, gp: true, tag: "Metroidvania", c1: "#0e7490", c2: "#083344" },
    { id: "stardew", name: "Stardew Valley", price: 14.99, gp: true, tag: "Farming", c1: "#16a34a", c2: "#14532d", art: "assets/game_stardew.jpg" },
    { id: "cuphead", name: "Cuphead", price: 19.99, gp: true, tag: "Platformer", c1: "#eab308", c2: "#713f12" },
    { id: "gta5", name: "Grand Theft Auto V", price: 29.99, gp: true, tag: "Adventure", c1: "#1b5e20", c2: "#0a2410" },
    { id: "fortnite", name: "Fortnite", price: 0, gp: false, tag: "Shooter", c1: "#7c3aed", c2: "#2563eb" },
    { id: "bluey", name: "Bluey: The Videogame", price: 39.99, gp: true, tag: "Casual", c1: "#3a7bd5", c2: "#0a2540", art: "assets/game_bluey.jpg" },
  ];
  const CATS = ["All", "Arcade", "Puzzle", "Casual", "Racing", "Shooter", "RPG", "Adventure", "Strategy", "Roguelike", "Platformer", "Simulation", "Sandbox", "Metroidvania", "Farming"];
  // ESRB content ratings.
  const RATINGS = {
    minecraft: "E10+", forza: "E", halo: "T", seaofthieves: "T", starfield: "M", flightsim: "E",
    gears5: "M", fallout4: "M", doometernal: "M", aoe4: "T", hades: "T", hollowknight: "E10+",
    stardew: "E10+", cuphead: "E10+", gta5: "AO", fortnite: "T", bluey: "EC",
  };
  const RATING_COLOR = { "E": "#4b7f2f", "E10+": "#3a7bd5", "T": "#c98a1a", "M": "#c0392b" };
  // Official ESRB badge images (others fall back to a colored text badge).
  const RATING_IMG = { "T": "assets/esrb_t.png", "M": "assets/esrb_m.png", "EC": "assets/esrb_ec.png", "AO": "assets/esrb_ao.png" };
  // Common Sense Media age recommendation, derived from the ESRB rating.
  const CSM_AGE = { "EC": "age 3+", "E": "age 6+", "E10+": "age 9+", "T": "age 13+", "M": "age 17+", "AO": "age 18+" };
  function ratingBadge(r) {
    const esrb = RATING_IMG[r]
      ? `<img class="xb-rating-img" src="${RATING_IMG[r]}" alt="ESRB ${r}" title="ESRB: ${r}">`
      : `<span class="xb-rating" style="background:${RATING_COLOR[r] || "#555"}" title="ESRB rating">${esc(r)}</span>`;
    const csm = `<span class="xb-csm" title="Common Sense Media"><img src="assets/commonsense.png" alt="Common Sense">${CSM_AGE[r] || ""}</span>`;
    return esrb + csm;
  }
  GAMES.forEach((g) => { g.rating = RATINGS[g.id] || "E"; });
  function games() { if (!S().appData) S().appData = {}; if (!S().appData.games) S().appData.games = { gamepass: false, owned: ["minecraft"] }; if (!S().appData.games.owned) S().appData.games.owned = []; return S().appData.games; }
  function meta(id) { return GAMES.find((g) => g.id === id); }
  function owns(id) { const g = games(); const m = meta(id); return g.owned.indexOf(id) >= 0 || (g.gamepass && m && m.gp); }
  function canAfford(p) { const b = S().bank && S().bank.balance; return b == null || b >= p; }
  function charge(item, amount) { try { if (State.addTransaction) State.addTransaction({ vendor: "Xbox", item, amount, refundable: false }); } catch (_) {} }

  function gameArt(g, cls) {
    if (g.art) return `<div class="xb-art xb-art-photo ${cls || ""}" style="background:${g.c1}"><img class="xb-art-img" src="${g.art}" alt=""><div class="xb-art-shade"></div><span class="xb-art-name">${esc(g.name)}</span></div>`;
    return `<div class="xb-art ${cls || ""}" style="background:linear-gradient(135deg,${g.c1},${g.c2})">
      <svg viewBox="0 0 100 60" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;opacity:.35"><circle cx="80" cy="12" r="22" fill="rgba(255,255,255,.15)"/><circle cx="15" cy="50" r="16" fill="rgba(0,0,0,.15)"/></svg>
      <span class="xb-art-name">${esc(g.name)}</span></div>`;
  }

  // ---------- Xbox app ----------
  function openXbox() {
    const ref = cw({ title: "Xbox", icon: window.Icon ? Icon.mini("xbox", "Xbox") : "", width: 940, height: 660, appId: "xbox" });
    const body = ref.body;
    body.classList.add("xb-host");
    let cat = "All", query = "";

    function render() {
      const g = games();
      body.innerHTML = `<div class="xb">
        <div class="xb-top"><span class="xb-logo">${window.Icon ? Icon.mini("xbox", "Xbox") : ""}</span><b>Xbox</b><span class="grow"></span>
          <div class="xb-search"><input placeholder="Search games" value="${esc(query)}"></div>
          <span class="xb-gp-pill ${g.gamepass ? "on" : ""}">${g.gamepass ? "Game Pass active" : "No Game Pass"}</span></div>
        <div class="xb-scroll">
          <div class="xb-hero">
            <div class="xb-hero-in">
              <span class="xb-hero-badge">Xbox Game Pass Ultimate</span>
              <h1>Hundreds of games. One low price.</h1>
              <p>Play Minecraft, Forza, Halo and more — all included.</p>
              <div class="xb-hero-actions">
                ${g.gamepass ? `<button class="xb-btn ghost" data-a="cancelgp">Cancel Game Pass</button>` : `<button class="xb-btn" data-a="joingp">Join for $${GP_PRICE.toFixed(2)}/mo</button>`}
              </div>
            </div>
          </div>
          <div class="xb-cats">${CATS.map((c) => `<button class="xb-cat ${c === cat ? "on" : ""}" data-c="${c}">${c}</button>`).join("")}</div>
          <h2 class="xb-h">${query ? "Results" : (cat === "All" ? (g.gamepass ? "Included with Game Pass" : "Games") : cat)}</h2>
          <div class="xb-grid"></div>
        </div>
      </div>`;
      const grid = body.querySelector(".xb-grid");
      const searchIn = body.querySelector(".xb-search input");
      searchIn.oninput = () => { query = searchIn.value; renderGrid(); };
      body.querySelectorAll(".xb-cat").forEach((b) => b.onclick = () => { cat = b.dataset.c; query = ""; render(); });

      function renderGrid() {
        grid.innerHTML = "";
        const q = query.trim().toLowerCase();
        // When searching, look across all categories.
        const list = GAMES.filter((game) => (q ? (game.name.toLowerCase().includes(q) || game.tag.toLowerCase().includes(q)) : (cat === "All" || game.tag === cat)));
        if (!list.length) { grid.innerHTML = `<div class="xb-empty">No games found.</div>`; return; }
        list.forEach(makeCard);
      }
      renderGrid();
      const joinBtn = body.querySelector('[data-a="joingp"]'); if (joinBtn) joinBtn.onclick = joinGamePass;
      const cancelBtn = body.querySelector('[data-a="cancelgp"]'); if (cancelBtn) cancelBtn.onclick = () => { games().gamepass = false; State.save(); render(); };

      function makeCard(game) {
        const owned = owns(game.id);
        const viaGp = games().gamepass && game.gp && games().owned.indexOf(game.id) < 0;
        const card = el(`<div class="xb-card">
          ${gameArt(game)}
          <div class="xb-card-body">
            <div class="xb-card-top"><b>${esc(game.name)}</b>${game.gp ? `<span class="xb-gp-tag">Game Pass</span>` : ""}</div>
            <div class="xb-card-tag">${esc(game.tag)} ${ratingBadge(game.rating)}</div>
            <div class="xb-card-actions"></div>
          </div>
        </div>`);
        const acts = card.querySelector(".xb-card-actions");
        if (owned) {
          const play = el(`<button class="xb-btn sm">${(game.playable || game.play) ? "Play" : "Installed"}</button>`);
          play.onclick = () => playGame(game);
          acts.appendChild(play);
          if (viaGp) acts.appendChild(el(`<span class="xb-owned">with Game Pass</span>`));
          else acts.appendChild(el(`<span class="xb-owned">Owned</span>`));
        } else {
          const buy = el(`<button class="xb-btn sm">${game.price ? "Buy $" + game.price.toFixed(2) : "Get — Free"}</button>`);
          buy.onclick = () => buyGame(game);
          acts.appendChild(buy);
          if (game.gp && !games().gamepass) { const gp = el(`<button class="xb-btn sm ghost">Play with Game Pass</button>`); gp.onclick = () => joinGamePass(); acts.appendChild(gp); }
        }
        grid.appendChild(card);
      }
    }

    function joinGamePass() {
      if (games().gamepass) return;
      if (!canAfford(GP_PRICE)) return notify("Not enough balance in Forge Bank. Earn some first.");
      charge("Game Pass Ultimate", GP_PRICE);
      games().gamepass = true; State.save();
      if (window.Notify) Notify.show({ icon: window.Icon ? Icon.mini("xbox", "Xbox") : "", title: "Game Pass Ultimate", body: "You're in — hundreds of games unlocked." });
      render();
    }
    function buyGame(game) {
      if (!canAfford(game.price)) return notify("Not enough balance in Forge Bank. Earn some first.");
      charge(game.name, game.price);
      if (games().owned.indexOf(game.id) < 0) games().owned.push(game.id);
      State.save();
      if (window.Notify) Notify.show({ icon: window.Icon ? Icon.mini("xbox", "Xbox") : "", title: game.name, body: "Purchased — ready to play." });
      render();
    }
    function playGame(game) {
      if (game.id === "minecraft") { AppRegistry.mclauncher(); return; }
      if (game.play && window.Games && window.Games.launch) { window.Games.launch({ id: game.id, name: game.name, game: game.play }, window.WM.createWindow); return; }
      if (window.Notify) Notify.show({ icon: window.Icon ? Icon.mini("xbox", "Xbox") : "", title: game.name, body: "Launching… this title is a demo tile in the sim." });
    }
    function notify(msg) { if (window.Notify) Notify.show({ icon: window.Icon ? Icon.mini("xbox", "Xbox") : "", title: "Xbox", body: msg }); }
    render();
  }

  // ---------- Minecraft Launcher ----------
  function openLauncher() {
    const ref = cw({ title: "Minecraft Launcher", icon: window.Icon ? Icon.mini("mclauncher", "Minecraft") : "", width: 980, height: 660, appId: "mclauncher" });
    const body = ref.body;
    body.classList.add("mcl-host");
    const user = (S().profile && S().profile.username) || "Player";
    if (!S().appData) S().appData = {};
    const skinImg = S().appData.mcSkin === "alex" ? "assets/skin_alex.png" : "assets/skin_steve.png";
    let nav = S().appData.mclNav || "java";
    let tab = "play";

    const GAMES_NAV = [
      { id: "news", top: "", name: "News", ic: newsIcon() },
      { id: "java", top: "MINECRAFT:", name: "Java Edition", ic: `<img src="assets/mc_java.png" alt="">` },
      { id: "windows", top: "MINECRAFT", name: "for Windows", ic: `<img src="assets/mc_bedrock.png" alt="">` },
      { id: "dungeons", top: "MINECRAFT", name: "Dungeons", ic: dungeonsIcon() },
      { id: "legends", top: "MINECRAFT", name: "Legends", ic: legendsIcon() },
    ];

    function build() {
      body.innerHTML = `<div class="mcl">
        <div class="mcl-side">
          <button class="mcl-acct"><span class="mcl-skin-face" style="background-image:url(${skinImg})"></span><div class="mcl-acct-txt"><b>${esc(user)}</b><span>Microsoft account</span></div><span class="mcl-acct-chev">&#9662;</span></button>
          <div class="mcl-games">
            ${GAMES_NAV.map((g) => `<button class="mcl-game ${g.id === nav ? "on" : ""} ${g.id === "news" ? "mcl-game-news" : ""}" data-nav="${g.id}"><span class="mcl-game-ic">${g.ic}</span><div class="mcl-game-txt">${g.top ? `<small>${g.top}</small>` : ""}<b>${g.name}</b></div></button>`).join("")}
          </div>
        </div>
        <div class="mcl-main"></div>
      </div>`;
      body.querySelectorAll(".mcl-game").forEach((b) => b.onclick = () => { nav = b.dataset.nav; S().appData.mclNav = nav; State.save(); tab = "play"; build(); });
      renderMain();
    }

    function renderMain() {
      const main = body.querySelector(".mcl-main");
      if (nav === "news") return renderNews(main);
      if (nav === "dungeons" || nav === "legends") return renderSpinoff(main, nav);
      const owned = owns("minecraft");
      const gname = nav === "java" ? "MINECRAFT: JAVA EDITION" : "MINECRAFT FOR WINDOWS";
      main.innerHTML = `
        <div class="mcl-gt">
          <div class="mcl-gt-name">${gname}</div>
          <div class="mcl-tabs2">
            <button class="mcl-tab2 ${tab === "play" ? "on" : ""}" data-t="play">Play</button>
            <button class="mcl-tab2 ${tab === "inst" ? "on" : ""}" data-t="inst">Installations</button>
            <button class="mcl-tab2" data-t="skins">Skins</button>
            <button class="mcl-tab2 ${tab === "patch" ? "on" : ""}" data-t="patch">Patch Notes</button>
          </div>
        </div>
        <div class="mcl-stage"></div>`;
      main.querySelectorAll(".mcl-tab2").forEach((b) => b.onclick = () => { if (b.dataset.t === "skins") { showSkins(); return; } tab = b.dataset.t; renderMain(); });
      const stage = main.querySelector(".mcl-stage");
      if (tab === "inst") { stage.innerHTML = `<div class="mcl-inst"><div class="mcl-inst-row"><div class="mcl-inst-ic">${grassSmall()}</div><div><b>Latest release</b><small>1.21.4 · Release</small></div><button class="mcl-inst-play">Play</button></div><div class="mcl-inst-row"><div class="mcl-inst-ic">${grassSmall()}</div><div><b>Latest snapshot</b><small>24w45a · Snapshot</small></div><button class="mcl-inst-play">Play</button></div></div>`; stage.querySelectorAll(".mcl-inst-play").forEach((b) => b.onclick = () => launch()); return; }
      if (tab === "patch") { stage.innerHTML = `<div class="mcl-patch"><h2>Latest Patch Notes</h2><div class="mcl-patch-item"><b>1.21.4 — Winter Drop</b><p>New cold biomes, the pale garden, creaking mobs, and bundle recipes.</p></div><div class="mcl-patch-item"><b>1.21 — Tricky Trials</b><p>Trial chambers, the mace, wind charges, and the breeze mob.</p></div><div class="mcl-patch-item"><b>1.20 — Trails & Tales</b><p>Cherry groves, archaeology, camels, and the sniffer.</p></div></div>`; return; }
      // Play tab
      stage.innerHTML = `
        <div class="mcl-hero big">
          <img class="mcl-hero-bg" src="assets/mc_banner.jpg" alt="">
          <div class="mcl-hero-logo">MINECRAFT<span>${nav === "java" ? "JAVA EDITION" : "FOR WINDOWS"}</span></div>
          ${owned ? "" : `<div class="mcl-promo"><b>Now Java &amp; Bedrock are sold together!</b><p>Start your Minecraft adventure today. Buy Java Edition, also get Bedrock — or play the Demo for free.</p><button class="mcl-demo">Play Demo</button></div>`}
          <div class="mcl-hero-bar">
            <div class="mcl-ver-chip"><div class="mcl-ver-ic">${grassSmall()}</div><div class="mcl-ver-txt"><small>Latest release</small><b>1.21.4</b></div></div>
            <button class="mcl-play ${owned ? "" : "buy"}">${owned ? "PLAY" : "BUY NOW"}</button>
            <span class="mcl-player">${esc(user)}</span>
          </div>
        </div>`;
      const pb = stage.querySelector(".mcl-play");
      pb.onclick = () => { if (owns("minecraft")) launch(); else getMinecraft(); };
      const demo = stage.querySelector(".mcl-demo"); if (demo) demo.onclick = () => launch();
    }

    function renderNews(main) {
      const NEWS = [
        { t: "1.21.4 — The Winter Drop is here", tag: "Java Edition", c1: "#3a7bd5", c2: "#0a2540" },
        { t: "Celebrate a decade of Minecraft", tag: "for Windows", c1: "#7c3aed", c2: "#2e1065" },
        { t: "New realms plus subscription perks", tag: "Java Edition", c1: "#16a34a", c2: "#14532d" },
        { t: "Marketplace: fresh maps & skins", tag: "for Windows", c1: "#ca5010", c2: "#431407" },
      ];
      main.innerHTML = `<div class="mcl-news2">
        <div class="mcl-news2-top"><h1>News</h1><input class="mcl-news2-search" placeholder="News title"></div>
        <div class="mcl-news2-grid">${NEWS.map((n) => `<div class="mcl-news2-card"><div class="mcl-news2-img" style="background:linear-gradient(135deg,${n.c1},${n.c2})"></div><div class="mcl-news2-body"><h3>${esc(n.t)}</h3><div class="mcl-news2-meta"><span class="mcl-news2-tag">${n.tag}</span><span>Jul 2026</span></div></div></div>`).join("")}</div>
      </div>`;
    }
    function renderSpinoff(main, which) {
      const info = which === "dungeons"
        ? { name: "Minecraft Dungeons", tag: "An action-adventure dungeon crawler", c1: "#b45309", c2: "#3b1d05", ic: dungeonsIcon() }
        : { name: "Minecraft Legends", tag: "A strategy-action game to defend the Overworld", c1: "#2563eb", c2: "#0a1f3d", ic: legendsIcon() };
      main.innerHTML = `<div class="mcl-spin" style="--s1:${info.c1};--s2:${info.c2}">
        <div class="mcl-spin-hero"><div class="mcl-spin-ic">${info.ic}</div><h1>${info.name.toUpperCase()}</h1><p>${info.tag}</p></div>
        <div class="mcl-spin-bar"><button class="mcl-play buy">BUY NOW — $${(which === "dungeons" ? 19.99 : 29.99).toFixed(2)}</button></div>
      </div>`;
      main.querySelector(".mcl-play").onclick = () => { if (window.Notify) Notify.show({ icon: window.Icon ? Icon.mini("mclauncher", "Minecraft") : "", title: info.name, body: "Opening the Store…" }); };
    }
    function launch() {
      if (window.MojangIntro) window.MojangIntro(body, () => { AppRegistry.minecraft({ skipIntro: true }); ref.close && ref.close(); });
      else { AppRegistry.minecraft(); ref.close && ref.close(); }
    }

    function showSkins() {
      const cur = S().appData.mcSkin || "steve";
      const SKINS = [{ id: "steve", name: "Steve", img: "assets/skin_steve.png" }, { id: "alex", name: "Alex", img: "assets/skin_alex.png" }];
      const ov = el(`<div class="mcl-skins-ov"><div class="mcl-skins">
        <div class="mcl-skins-head"><b>Skins</b><button class="mcl-skins-x">&times;</button></div>
        <div class="mcl-skins-grid">
          ${SKINS.map((s) => `<button class="mcl-skin-card ${s.id === cur ? "sel" : ""}" data-skin="${s.id}"><div class="mcl-skin-body" style="background-image:url(${s.img})"></div><span>${s.name}</span><small>${s.id === "steve" ? "Default" : "Classic"}${s.id === cur ? " · Equipped" : ""}</small></button>`).join("")}
        </div>
        <p class="mcl-skins-note">Pick your default skin.</p>
      </div></div>`);
      const close = () => ov.remove();
      ov.querySelector(".mcl-skins-x").onclick = close;
      ov.onclick = (e) => { if (e.target === ov) close(); };
      ov.querySelectorAll(".mcl-skin-card").forEach((c) => c.onclick = () => { const face = S().appData.mcSkin = c.dataset.skin; State.save(); const f = body.querySelector(".mcl-skin-face"); if (f) f.style.backgroundImage = `url(assets/skin_${face}.png)`; ov.remove(); });
      body.appendChild(ov);
    }
    function getMinecraft() {
      const ov = el(`<div class="mcl-buy-ov"><div class="mcl-buy">
        <div class="mcl-buy-art">${grassIcon()}</div>
        <h2>Get Minecraft</h2>
        <p>Own it forever, or play it with Xbox Game Pass.</p>
        <div class="mcl-buy-btns">
          <button class="mcl-buy-b" data-b="buy">Buy — $29.99</button>
          <button class="mcl-buy-b ghost" data-b="gp">Get Game Pass — $${GP_PRICE.toFixed(2)}/mo</button>
        </div>
        <button class="mcl-buy-x">Not now</button>
      </div></div>`);
      const close = () => ov.remove();
      ov.querySelector(".mcl-buy-x").onclick = close;
      ov.onclick = (e) => { if (e.target === ov) close(); };
      ov.querySelector('[data-b="buy"]').onclick = () => {
        if (!canAfford(29.99)) { close(); return openXbox(); }
        charge("Minecraft", 29.99); if (games().owned.indexOf("minecraft") < 0) games().owned.push("minecraft"); State.save();
        close(); build();
        if (window.Notify) Notify.show({ icon: "", title: "Minecraft", body: "Purchased — press Play!" });
      };
      ov.querySelector('[data-b="gp"]').onclick = () => { close(); ref.close && ref.close(); openXbox(); };
      body.appendChild(ov);
    }

    build();
  }

  function grassIcon() {
    return `<svg viewBox="0 0 32 32" width="34" height="34" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="4" width="24" height="8" fill="#6aa84f"/><rect x="4" y="4" width="24" height="3" fill="#7cbd5c"/>
      <rect x="4" y="12" width="24" height="16" fill="#8a6d4b"/>
      <rect x="7" y="15" width="4" height="4" fill="#7a5d3f"/><rect x="14" y="19" width="4" height="4" fill="#7a5d3f"/><rect x="21" y="14" width="4" height="4" fill="#7a5d3f"/><rect x="18" y="23" width="4" height="3" fill="#7a5d3f"/>
    </svg>`;
  }
  function grassSmall() {
    return `<svg viewBox="0 0 32 32" width="30" height="30" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="28" height="10" fill="#6aa84f"/><rect x="2" y="2" width="28" height="4" fill="#7cbd5c"/><rect x="2" y="12" width="28" height="18" fill="#8a6d4b"/><rect x="6" y="16" width="5" height="5" fill="#7a5d3f"/><rect x="20" y="15" width="5" height="5" fill="#7a5d3f"/></svg>`;
  }
  function newsIcon() {
    return `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#c9c9c9" stroke-width="1.6" stroke-linejoin="round"><path d="M5 4h11a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V5"/><path d="M17 8h2a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2M8 8h6M8 12h6M8 16h4"/></svg>`;
  }
  function dungeonsIcon() {
    return `<svg viewBox="0 0 32 32" width="30" height="30" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="32" rx="5" fill="#7a3b12"/><path d="M16 6l8 5v10l-8 5-8-5V11z" fill="#c2661a"/><path d="M16 11l4 2.5v5L16 21l-4-2.5v-5z" fill="#3a1e08"/></svg>`;
  }
  function legendsIcon() {
    return `<svg viewBox="0 0 32 32" width="30" height="30" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="32" rx="5" fill="#0e2a5e"/><circle cx="16" cy="16" r="9" fill="none" stroke="#4aa3ff" stroke-width="2.4"/><path d="M16 8v16M8 16h16" stroke="#4aa3ff" stroke-width="2.4"/><circle cx="16" cy="16" r="3" fill="#cfe6ff"/></svg>`;
  }

  window.AppRegistry = window.AppRegistry || {};
  window.AppRegistry.xbox = openXbox;
  window.AppRegistry.mclauncher = openLauncher;
})();
