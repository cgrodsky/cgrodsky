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
    { id: "minecraft", name: "Minecraft", price: 29.99, gp: true, playable: true, tag: "Sandbox", c1: "#7cae42", c2: "#33500f" },
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
    { id: "forza", name: "Forza Horizon 5", price: 59.99, gp: true, tag: "Racing", c1: "#8b5cf6", c2: "#2b0a5e" },
    { id: "halo", name: "Halo Infinite", price: 59.99, gp: true, tag: "Shooter", c1: "#3b82f6", c2: "#0a1f3d" },
    { id: "seaofthieves", name: "Sea of Thieves", price: 39.99, gp: true, tag: "Adventure", c1: "#0891b2", c2: "#04303d" },
    { id: "starfield", name: "Starfield", price: 69.99, gp: true, tag: "RPG", c1: "#c026d3", c2: "#3b0764" },
    { id: "flightsim", name: "Flight Simulator", price: 59.99, gp: true, tag: "Simulation", c1: "#0ea5e9", c2: "#0c4a6e" },
    { id: "gears5", name: "Gears 5", price: 39.99, gp: true, tag: "Shooter", c1: "#dc2626", c2: "#3f0d0d" },
    { id: "fallout4", name: "Fallout 4", price: 29.99, gp: true, tag: "RPG", c1: "#65a30d", c2: "#1a2e05" },
    { id: "doometernal", name: "Doom Eternal", price: 39.99, gp: true, tag: "Shooter", c1: "#ea580c", c2: "#431407" },
    { id: "aoe4", name: "Age of Empires IV", price: 49.99, gp: true, tag: "Strategy", c1: "#b45309", c2: "#3b1d05" },
    { id: "hades", name: "Hades", price: 24.99, gp: true, tag: "Roguelike", c1: "#e11d48", c2: "#4c0519" },
    { id: "hollowknight", name: "Hollow Knight", price: 14.99, gp: true, tag: "Metroidvania", c1: "#0e7490", c2: "#083344" },
    { id: "stardew", name: "Stardew Valley", price: 14.99, gp: true, tag: "Farming", c1: "#16a34a", c2: "#14532d" },
    { id: "cuphead", name: "Cuphead", price: 19.99, gp: true, tag: "Platformer", c1: "#eab308", c2: "#713f12" },
  ];
  const CATS = ["All", "Arcade", "Puzzle", "Casual", "Racing", "Shooter", "RPG", "Adventure", "Strategy", "Roguelike", "Platformer", "Simulation", "Sandbox", "Metroidvania", "Farming"];
  function games() { if (!S().appData) S().appData = {}; if (!S().appData.games) S().appData.games = { gamepass: false, owned: ["minecraft"] }; if (!S().appData.games.owned) S().appData.games.owned = []; return S().appData.games; }
  function meta(id) { return GAMES.find((g) => g.id === id); }
  function owns(id) { const g = games(); const m = meta(id); return g.owned.indexOf(id) >= 0 || (g.gamepass && m && m.gp); }
  function canAfford(p) { const b = S().bank && S().bank.balance; return b == null || b >= p; }
  function charge(item, amount) { try { if (State.addTransaction) State.addTransaction({ vendor: "Xbox", item, amount, refundable: false }); } catch (_) {} }

  function gameArt(g, cls) {
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
            <div class="xb-card-tag">${esc(game.tag)}</div>
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
          const buy = el(`<button class="xb-btn sm">Buy $${game.price.toFixed(2)}</button>`);
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
    const ref = cw({ title: "Minecraft Launcher", icon: window.Icon ? Icon.mini("mclauncher", "Minecraft") : "", width: 900, height: 620, appId: "mclauncher" });
    const body = ref.body;
    body.classList.add("mcl-host");
    const owned = owns("minecraft");
    const user = (S().profile && S().profile.username) || "Player";
    if (!S().appData) S().appData = {};
    const ed = S().appData.mcEdition || "java";
    const edName = ed === "bedrock" ? "Bedrock Edition" : "Java Edition";
    const skinImg = S().appData.mcSkin === "alex" ? "assets/skin_alex.png" : "assets/skin_steve.png";

    body.innerHTML = `<div class="mcl mcl-${ed}">
      <div class="mcl-side">
        <div class="mcl-brand">${grassIcon()}<span>Minecraft<br><small>Launcher</small></span></div>
        <div class="mcl-editions">
          <button class="mcl-ed ${ed === "java" ? "on" : ""}" data-ed="java"><img src="assets/mc_java.png" alt=""><span>Java</span></button>
          <button class="mcl-ed ${ed === "bedrock" ? "on" : ""}" data-ed="bedrock"><img src="assets/mc_bedrock.png" alt=""><span>Bedrock</span></button>
        </div>
        <button class="mcl-nav on">Play</button>
        <button class="mcl-nav">Installations</button>
        <button class="mcl-nav">Skins</button>
        <button class="mcl-nav">Patch Notes</button>
        <span class="grow"></span>
        <div class="mcl-user"><span class="mcl-skin-face" style="background-image:url(${skinImg})"></span><span>${esc(user)}</span></div>
      </div>
      <div class="mcl-main">
        <div class="mcl-hero">
          <img class="mcl-hero-bg" src="assets/mc_banner.jpg" alt="">
          <div class="mcl-hero-shade"></div>
          <div class="mcl-hero-in">
            <span class="mcl-tag">Latest Release</span>
            <h1>MINECRAFT</h1>
            <p>${edName} &middot; 1.21</p>
          </div>
        </div>
        <div class="mcl-news">
          <div class="mcl-news-item"><b>Welcome, ${esc(user)}</b><span>Build, explore, and survive. Press Play to jump in.</span></div>
          <div class="mcl-news-item"><b>Tip</b><span>Mine ores to hear the XP sound. Watch out for creepers!</span></div>
        </div>
        <div class="mcl-footer">
          <div class="mcl-ver">
            <label>Version</label>
            <select class="mcl-version"><option>Latest Release 1.21.4</option><option>Latest Snapshot 24w45a</option><option>1.21.1</option><option>1.20.6</option><option>1.19.4</option><option>1.18.2</option><option>1.16.5</option><option>1.12.2</option><option>1.8.9</option></select>
          </div>
          <span class="grow"></span>
          <button class="mcl-play ${owned ? "" : "locked"}">${owned ? "PLAY" : "GET MINECRAFT"}</button>
        </div>
      </div>
    </div>`;

    body.querySelectorAll(".mcl-nav").forEach((b) => b.onclick = () => {
      body.querySelectorAll(".mcl-nav").forEach((x) => x.classList.toggle("on", x === b));
      if (b.textContent === "Skins") showSkins();
    });
    body.querySelectorAll(".mcl-ed").forEach((b) => b.onclick = () => { S().appData.mcEdition = b.dataset.ed; State.save(); openLauncher(); ref.close && ref.close(); });
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
      ov.querySelectorAll(".mcl-skin-card").forEach((c) => c.onclick = () => { S().appData.mcSkin = c.dataset.skin; State.save(); openLauncher(); ref.close && ref.close(); });
      body.appendChild(ov);
    }
    const playBtn = body.querySelector(".mcl-play");
    playBtn.onclick = () => {
      if (owns("minecraft")) {
        // Show the Mojang Studios loading screen in the launcher, then open the game.
        if (window.MojangIntro) window.MojangIntro(body, () => { AppRegistry.minecraft({ skipIntro: true }); ref.close && ref.close(); });
        else { AppRegistry.minecraft(); ref.close && ref.close(); }
      } else {
        getMinecraft();
      }
    };
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
        close(); openLauncher(); ref.close && ref.close();
        if (window.Notify) Notify.show({ icon: "", title: "Minecraft", body: "Purchased — press Play!" });
      };
      ov.querySelector('[data-b="gp"]').onclick = () => { close(); ref.close && ref.close(); openXbox(); };
      body.appendChild(ov);
    }
  }

  function grassIcon() {
    return `<svg viewBox="0 0 32 32" width="34" height="34" xmlns="http://www.w3.org/2000/svg">
      <rect x="4" y="4" width="24" height="8" fill="#6aa84f"/><rect x="4" y="4" width="24" height="3" fill="#7cbd5c"/>
      <rect x="4" y="12" width="24" height="16" fill="#8a6d4b"/>
      <rect x="7" y="15" width="4" height="4" fill="#7a5d3f"/><rect x="14" y="19" width="4" height="4" fill="#7a5d3f"/><rect x="21" y="14" width="4" height="4" fill="#7a5d3f"/><rect x="18" y="23" width="4" height="3" fill="#7a5d3f"/>
    </svg>`;
  }

  window.AppRegistry = window.AppRegistry || {};
  window.AppRegistry.xbox = openXbox;
  window.AppRegistry.mclauncher = openLauncher;
})();
