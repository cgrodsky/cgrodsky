/* Stardew Valley — a farming life sim in the spirit of ConcernedApe's 2016 game.
   Grandpa's overgrown farm, Pelican Town with Pierre's General Store, the farmhouse;
   hoe / watering can / axe / pickaxe / scythe / fishing rod; 18 crops across four
   28-day seasons (with regrowing crops, watering, rain and withering), foraging,
   the fishing-bar minigame, energy and the 2 AM pass-out, the shipping bin with the
   overnight shipping summary, villagers with friendship hearts and gifts, the TV
   forecast, and Mayor Lewis's welcome letter. Pixel art is drawn procedurally.
   Saves to appData.stardew. */
(function () {
  "use strict";
  const TS = 16;
  const SEASONS = ["Spring", "Summer", "Fall", "Winter"], WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function hash(a, b, c) { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 982451653)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

  // ---------------- data ----------------
  const CROPS = {
    parsnip: { name: "Parsnip", seasons: [0], seed: 20, days: 4, sell: 35, col: "#f2e2b0", leaf: "#4ab03a", energy: 25 },
    greenbean: { name: "Green Bean", seasons: [0], seed: 60, days: 10, sell: 40, regrow: 3, col: "#4aa83a", leaf: "#2e7a2e", energy: 25, trellis: true },
    cauliflower: { name: "Cauliflower", seasons: [0], seed: 80, days: 12, sell: 175, col: "#f4f4ea", leaf: "#3a8a3a", energy: 75 },
    potato: { name: "Potato", seasons: [0], seed: 50, days: 6, sell: 80, col: "#c9a56a", leaf: "#4a9a3a", energy: 25, extra: 0.2 },
    kale: { name: "Kale", seasons: [0], seed: 70, days: 6, sell: 110, col: "#2e7a3a", leaf: "#2e6a2e", energy: 50 },
    tulip: { name: "Tulip", seasons: [0], seed: 20, days: 6, sell: 30, col: "#e8508a", leaf: "#4ab03a", energy: 45 },
    melon: { name: "Melon", seasons: [1], seed: 80, days: 12, sell: 250, col: "#e8607a", leaf: "#3a8a3a", energy: 113 },
    tomato: { name: "Tomato", seasons: [1], seed: 50, days: 11, sell: 60, regrow: 4, col: "#e33a2a", leaf: "#3a8a3a", energy: 20 },
    blueberry: { name: "Blueberry", seasons: [1], seed: 80, days: 13, sell: 50, regrow: 4, yield: 3, col: "#3a5ad0", leaf: "#2e6a3a", energy: 25 },
    hotpepper: { name: "Hot Pepper", seasons: [1], seed: 40, days: 5, sell: 40, regrow: 3, col: "#e8401a", leaf: "#3a8a3a", energy: 13 },
    radish: { name: "Radish", seasons: [1], seed: 40, days: 6, sell: 90, col: "#c83a6a", leaf: "#4ab03a", energy: 45 },
    wheat: { name: "Wheat", seasons: [1, 2], seed: 10, days: 4, sell: 25, col: "#e6c46a", leaf: "#c9b04a", energy: 0 },
    corn: { name: "Corn", seasons: [1, 2], seed: 150, days: 14, sell: 50, regrow: 4, col: "#f2d23a", leaf: "#4a9a3a", energy: 25 },
    pumpkin: { name: "Pumpkin", seasons: [2], seed: 100, days: 13, sell: 320, col: "#f0821a", leaf: "#3a7a2a", energy: 0 },
    cranberries: { name: "Cranberries", seasons: [2], seed: 240, days: 7, sell: 75, regrow: 5, yield: 2, col: "#c8203a", leaf: "#3a6a2a", energy: 38 },
    eggplant: { name: "Eggplant", seasons: [2], seed: 20, days: 5, sell: 60, regrow: 5, col: "#6a3a8a", leaf: "#3a7a2a", energy: 20 },
    bokchoy: { name: "Bok Choy", seasons: [2], seed: 50, days: 4, sell: 80, col: "#7ac85a", leaf: "#4ab03a", energy: 25 },
    yam: { name: "Yam", seasons: [2], seed: 60, days: 10, sell: 160, col: "#c8603a", leaf: "#4a8a3a", energy: 45 },
  };
  const FORAGE = [
    [["Wild Horseradish", 50, "#d8c8a0"], ["Daffodil", 30, "#f2e23a"], ["Leek", 60, "#a8d88a"], ["Dandelion", 40, "#f2d23a"]],
    [["Grape", 80, "#7a3ab0"], ["Spice Berry", 80, "#e8401a"], ["Sweet Pea", 50, "#e888c8"]],
    [["Common Mushroom", 40, "#c8a888"], ["Wild Plum", 80, "#8a3a8a"], ["Hazelnut", 90, "#8a5a2a"], ["Blackberry", 20, "#3a1a4a"]],
    [["Winter Root", 70, "#a87a4a"], ["Crystal Fruit", 150, "#9ae0f0"], ["Snow Yam", 100, "#e8e8f0"], ["Crocus", 60, "#c888e8"]],
  ];
  const FISH = [
    [["Sunfish", 30, 30], ["Bream", 45, 35], ["Carp", 30, 15], ["Largemouth Bass", 100, 50], ["Catfish", 200, 75]],
    [["Sunfish", 30, 30], ["Rainbow Trout", 65, 45], ["Pike", 100, 60], ["Tuna", 100, 70], ["Pufferfish", 200, 80]],
    [["Salmon", 75, 50], ["Chub", 50, 35], ["Walleye", 105, 45], ["Tiger Trout", 150, 60], ["Largemouth Bass", 100, 50]],
    [["Perch", 55, 35], ["Lingcod", 120, 85], ["Pike", 100, 60], ["Carp", 30, 15]],
  ];
  const TOOLS = { hoe: "Hoe", can: "Watering Can", axe: "Axe", pick: "Pickaxe", scythe: "Scythe", rod: "Bamboo Pole" };
  const RES = { wood: ["Wood", 2, "#8a5a2c"], stone: ["Stone", 2, "#9a9aa0"], fiber: ["Fiber", 1, "#7ab04a"], sap: ["Sap", 2, "#c8903a"] };
  const VILLAGERS = [
    { name: "Lewis", hair: "#8a8a8a", shirt: "#4a7a3a", hat: "#3a5a2a", loves: ["crop:hotpepper", "crop:yam"], lines: ["Ah, the new farmer! How's the old place treating you?", "I've been mayor of Pelican Town for a long time. It's a good town.", "Don't work yourself to the bone. Get to bed at a decent hour!", "Your grandfather would be proud to see the farm alive again."] },
    { name: "Abigail", hair: "#7a3ab0", shirt: "#4a4a8a", loves: ["crop:pumpkin", "forage:Blackberry"], lines: ["Ugh, this town is so boring. Got any adventures for me?", "I love the color purple. Isn't that obvious?", "Have you been down to the mines yet? I'm dying to explore.", "My dad runs the general store. Don't tell him I said it's overpriced."] },
    { name: "Emily", hair: "#3a8ad0", shirt: "#e8508a", loves: ["crop:melon", "forage:Daffodil"], lines: ["The universe has a way of bringing the right people together.", "I make clothes when I'm not working at the saloon!", "Did you know crystals have amazing energies?", "What a beautiful day to be alive!"] },
    { name: "Sam", hair: "#e8c84a", shirt: "#3a6ad0", loves: ["crop:cauliflower", "fish:Tuna"], lines: ["Hey! Want to hear my band some time?", "I skateboard around town when I can. Watch out!", "Pizza is the best food. I will not be taking questions.", "My little brother Vincent never stops talking."] },
  ];
  const HEART = 250;

  // ---------------- items ----------------
  function itemInfo(id) {
    const [kind, key] = id.split(":");
    if (TOOLS[id]) return { name: TOOLS[id], tool: true, sell: 0 };
    if (kind === "seed") { const c = CROPS[key]; return { name: c.name + " Seeds", sell: Math.floor(c.seed / 2), seed: key, col: c.col }; }
    if (kind === "crop") { const c = CROPS[key]; return { name: c.name, sell: c.sell, energy: c.energy, col: c.col, cat: "Farming" }; }
    if (kind === "forage") { const f = FORAGE.flat().find((x) => x[0] === key); return { name: key, sell: f ? f[1] : 20, energy: f ? Math.round(f[1] * 0.6) : 10, col: f ? f[2] : "#ccc", cat: "Foraging" }; }
    if (kind === "fish") { const f = FISH.flat().find((x) => x[0] === key); return { name: key, sell: f ? f[1] : 30, energy: f ? Math.round(f[1] * 0.4) : 10, col: "#5a8ac8", cat: "Fishing" }; }
    if (RES[id]) return { name: RES[id][0], sell: RES[id][1], col: RES[id][2], cat: "Other" };
    return { name: id, sell: 0 };
  }

  // ---------------- maps ----------------
  // ground codes: g grass, d dirt path, w water, e edge (trees/cliff, blocking), c cobble, f wood floor, x wall
  function makeFarm() {
    const W = 50, H = 36, ground = [];
    for (let y = 0; y < H; y++) { const r = []; for (let x = 0; x < W; x++) r.push(x === 0 || y === 0 || x === W - 1 || y === H - 1 || y < 3 ? "e" : "g"); ground.push(r); }
    for (let y = 14; y <= 16; y++) ground[y][W - 1] = "d";                            // east exit → town
    for (let x = 26; x < W; x++) ground[15][x] = "d"; for (let y = 10; y <= 15; y++) ground[y][26] = "d";
    for (let y = 21; y <= 29; y++) for (let x = 5; x <= 15; x++) if (((x - 10) / 5.2) ** 2 + ((y - 25) / 3.8) ** 2 < 1) ground[y][x] = "w";
    const structs = [
      { t: "house", x: 23, y: 5, w: 6, h: 5, door: { x: 26, y: 9, to: "house", tx: 6, ty: 7 } },
      { t: "bin", x: 29, y: 8, w: 2, h: 1 },
    ];
    return { id: "farm", W, H, ground, structs, exits: [{ x: W - 1, y0: 14, y1: 16, to: "town", tx: 1 }] };
  }
  function makeTown() {
    const W = 42, H = 30, ground = [];
    for (let y = 0; y < H; y++) { const r = []; for (let x = 0; x < W; x++) r.push(x === W - 1 || y === 0 || y === H - 1 || y < 3 ? "e" : "g"); ground.push(r); }
    for (let y = 1; y < H - 1; y++) ground[y][0] = (y >= 14 && y <= 16) ? "c" : "e";
    for (let y = 13; y <= 17; y++) for (let x = 0; x < W - 1; x++) ground[y][x] = "c";
    for (let y = 10; y <= 24; y++) for (let x = 18; x <= 23; x++) ground[y][x] = "c";
    for (let y = 19; y <= 21; y++) for (let x = 20; x <= 22; x++) ground[y][x] = "w";
    const structs = [
      { t: "pierre", x: 15, y: 5, w: 7, h: 5, door: { x: 18, y: 9, shop: true } },
      { t: "saloon", x: 25, y: 5, w: 7, h: 5, door: { x: 28, y: 9, msg: "The Stardrop Saloon opens at noon. (Gus is still mopping.)" } },
      { t: "manor", x: 5, y: 20, w: 6, h: 4, door: { x: 8, y: 23, msg: "Mayor Lewis's manor. Nobody's answering." } },
      { t: "board", x: 24, y: 11, w: 2, h: 1 },
    ];
    return { id: "town", W, H, ground, structs, exits: [{ x: 0, y0: 14, y1: 16, to: "farm", tx: 48 }] };
  }
  function makeHouse() {
    const W = 12, H = 9, ground = [];
    for (let y = 0; y < H; y++) { const r = []; for (let x = 0; x < W; x++) r.push(x === 0 || x === W - 1 || y <= 1 || y === H - 1 ? "x" : "f"); ground.push(r); }
    ground[H - 1][6] = "f";
    const structs = [{ t: "bed", x: 2, y: 2, w: 2, h: 2 }, { t: "tv", x: 8, y: 2, w: 1, h: 1 }, { t: "fireplace", x: 5, y: 1, w: 2, h: 1 }, { t: "table", x: 8, y: 5, w: 2, h: 1 }];
    return { id: "house", W, H, ground, structs, exits: [{ x: 6, y0: H - 1, y1: H - 1, to: "farm", tx: 26, ty: 10, door: true }] };
  }

  function newGame(name, farmName) {
    const farm = makeFarm(), obj = {};
    for (let y = 4; y < farm.H - 1; y++) for (let x = 1; x < farm.W - 1; x++) {
      if (farm.ground[y][x] !== "g") continue;
      if (x >= 21 && x <= 33 && y >= 4 && y <= 13) continue;            // yard by the house stays clear
      const r = hash(x, y, 7);
      if (y < 7 || x < 3 || x > 46 || y > 32) { if (r < 0.22) obj[x + "," + y] = { t: "tree", hp: 6 }; continue; }
      if (r < 0.15) obj[x + "," + y] = { t: "weed" };
      else if (r < 0.22) obj[x + "," + y] = { t: "stone" };
      else if (r < 0.27) obj[x + "," + y] = { t: "twig" };
      else if (r < 0.29) obj[x + "," + y] = { t: "tree", hp: 6 };
    }
    const inv = new Array(36).fill(null);
    ["hoe", "can", "axe", "pick", "scythe", "rod"].forEach((t, i) => (inv[i] = { id: t, n: 1 }));
    inv[6] = { id: "seed:parsnip", n: 15 };
    return {
      v: 1, name: name || "Farmer", farmName: farmName || "Stardew", day: 1, season: 0, year: 1, time: 600, gold: 500,
      energy: 270, maxEnergy: 270, water: 40, inv, sel: 0,
      map: "house", x: 6 * TS + 8, y: 5 * TS + 12, face: 0,
      objs: { farm: obj, town: {} }, soil: {}, bin: [],
      weather: "sun", tomorrow: "sun", friends: {}, talked: {}, gifted: {},
      letterRead: false, stats: { earned: 0, crops: 0, fish: 0, forage: 0 },
    };
  }

  // =========================================================================
  function start(body) {
    const store = () => { const S = window.State && State.data; if (!S) return {}; if (!S.appData) S.appData = {}; return S.appData; };
    let G = store().stardew && store().stardew.v === 1 ? store().stardew : null;
    body.innerHTML = `<div class="sv"><canvas class="sv-cv"></canvas>
      <div class="sv-touch">
        <div class="sv-pad"><button data-d="up">▲</button><button data-d="left">◀</button><button data-d="right">▶</button><button data-d="down">▼</button></div>
        <div class="sv-btns"><button data-b="act">✋</button><button data-b="tool">⛏</button><button data-b="inv">🎒</button></div>
      </div>
      <div class="sv-modal" hidden></div></div>`;
    injectStyles();
    const host = body.querySelector(".sv"), cv = host.querySelector(".sv-cv"), g = cv.getContext("2d"), modal = host.querySelector(".sv-modal");
    const MAPS = { farm: makeFarm(), town: makeTown(), house: makeHouse() };
    let W = 0, H = 0, S = 3, camX = 0, camY = 0, t = 0, dead = false, raf = 0, last = performance.now();
    let menuOpen = false, swing = 0, swingTool = null, msgs = [], fishing = null, npcs = [], clockAcc = 0, exhaustedTold = false;
    const keys = {};
    const coarse = (window.matchMedia && matchMedia("(pointer: coarse)").matches) || "ontouchstart" in window;
    if (!coarse) host.querySelector(".sv-touch").style.display = "none";

    function fit() { const r = host.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1); W = r.width; H = r.height; cv.width = Math.max(1, W * dpr); cv.height = Math.max(1, H * dpr); g.setTransform(dpr, 0, 0, dpr, 0, 0); S = W < 620 ? 2 : 3; }
    fit();
    let ro = null; try { ro = new ResizeObserver(fit); ro.observe(host); } catch (e) {}

    // ---------------- pixel art ----------------
    const ART = {};
    function art(key, w, h, draw) { if (ART[key]) return ART[key]; const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); draw(x, w, h); ART[key] = c; return c; }
    const px = (c, x, y, col, w, h) => { c.fillStyle = col; c.fillRect(x, y, w || 1, h || 1); };
    function groundArt(code, variant, frame) {
      return art("g" + code + variant + frame + (G && G.season === 3 ? "w" : ""), TS, TS, (c) => {
        const winter = G && G.season === 3;
        if (code === "g") { px(c, 0, 0, winter ? "#e8eef4" : G && G.season === 2 ? "#8aa83a" : G && G.season === 1 ? "#5aa83a" : "#6ab84a", 16, 16); for (let i = 0; i < 6; i++) { const x = (hash(variant, i, 1) * 15) | 0, y = (hash(variant, i, 2) * 14) | 0; px(c, x, y, winter ? "#cfd8e2" : "#4a9a3a", 1, 2); px(c, x + 1, y + 1, winter ? "#d8e0ea" : "#58a842"); } }
        else if (code === "d") { px(c, 0, 0, winter ? "#d8d8dc" : "#c8a46a", 16, 16); for (let i = 0; i < 5; i++) px(c, (hash(variant, i, 3) * 15) | 0, (hash(variant, i, 4) * 15) | 0, winter ? "#c8c8d0" : "#b08a52", 2, 1); }
        else if (code === "w") { px(c, 0, 0, "#3a7ad0", 16, 16); for (let i = 0; i < 3; i++) px(c, ((hash(variant, i, 5) * 12) | 0) + frame * 2, ((hash(variant, i, 6) * 14) | 0), "#7ab0f0", 4, 1); }
        else if (code === "e") { px(c, 0, 0, winter ? "#2a4a3a" : "#2a5a2a", 16, 16); px(c, 2, 1, winter ? "#e8eef4" : "#3a7a3a", 12, 8); px(c, 4, 0, winter ? "#f4f8fc" : "#4a8a3a", 8, 4); px(c, 7, 9, "#5a3a1a", 2, 7); }
        else if (code === "c") { px(c, 0, 0, "#a8a098", 16, 16); for (let yy = 0; yy < 16; yy += 4) for (let xx = (yy / 4) % 2 * 4; xx < 16; xx += 8) { px(c, xx, yy, "#968e86", 7, 3); } }
        else if (code === "f") { px(c, 0, 0, "#b98a54", 16, 16); for (let yy = 0; yy < 16; yy += 4) px(c, 0, yy, "#a0723e", 16, 1); px(c, (variant % 2) * 8, 0, "#a0723e", 1, 16); }
        else if (code === "x") { px(c, 0, 0, "#7a5a3a", 16, 16); px(c, 0, 0, "#e8d8b0", 16, 11); for (let xx = 0; xx < 16; xx += 4) px(c, xx, 0, "#d8c49a", 1, 11); }
      });
    }
    function soilArt(wet) { return art("soil" + wet, TS, TS, (c) => { px(c, 1, 1, wet ? "#5a3a1e" : "#8a5a2c", 14, 14); for (let i = 0; i < 4; i++) px(c, 2, 3 + i * 3, wet ? "#4a2e16" : "#7a4a22", 12, 1); }); }
    function cropArt(id, stage, dead) {
      const C = CROPS[id];
      return art("c" + id + stage + (dead ? "d" : ""), TS, 24, (c) => {
        if (dead) { px(c, 6, 14, "#8a7a5a", 4, 8); px(c, 4, 16, "#9a8a6a", 8, 2); return; }
        if (stage === 0) { [[5, 18], [9, 19], [7, 21], [10, 17]].forEach(([x, y]) => px(c, x, y, "#e8d8a0", 2, 1)); return; }
        if (C.trellis && stage >= 1) { px(c, 7, 4, "#8a5a2c", 2, 20); px(c, 4, 8, "#8a5a2c", 8, 1); }
        const L = C.leaf;
        if (stage === 1) { px(c, 7, 17, L, 2, 5); px(c, 5, 16, L, 2, 2); px(c, 9, 15, L, 2, 2); return; }
        if (stage === 2) { px(c, 7, 12, L, 2, 10); px(c, 3, 12, L, 4, 3); px(c, 9, 10, L, 4, 3); px(c, 4, 17, L, 3, 2); px(c, 10, 16, L, 3, 2); return; }
        // ripe
        px(c, 7, 8, L, 2, 14); px(c, 2, 9, L, 5, 3); px(c, 9, 7, L, 5, 3); px(c, 3, 15, L, 4, 2); px(c, 10, 14, L, 4, 2);
        if (["parsnip", "potato", "radish", "yam"].includes(id)) { px(c, 4, 17, C.col, 8, 5); px(c, 5, 22, C.col, 6, 1); }
        else if (["cauliflower", "kale", "bokchoy"].includes(id)) { px(c, 3, 10, C.col, 10, 9); px(c, 4, 9, C.col, 8, 1); }
        else if (["melon", "pumpkin"].includes(id)) { px(c, 2, 13, C.col, 12, 9); px(c, 3, 12, C.col, 10, 1); px(c, 7, 12, "#3a5a1a", 2, 2); }
        else if (id === "wheat" || id === "corn") { px(c, 6, 2, C.col, 4, 10); px(c, 7, 1, C.col, 2, 1); }
        else if (id === "tulip") { px(c, 5, 3, C.col, 6, 5); px(c, 6, 2, C.col, 1, 1); px(c, 9, 2, C.col, 1, 1); }
        else { [[3, 7], [10, 6], [6, 11], [11, 12], [4, 13]].forEach(([x, y]) => px(c, x, y, C.col, 3, 3)); }
      });
    }
    function objArt(o) {
      const k = o.t + (o.name || "");
      return art("o" + k + (G && G.season), TS, o.t === "tree" ? 48 : 16, (c) => {
        const winter = G && G.season === 3;
        if (o.t === "weed") { px(c, 3, 8, "#3a8a2a", 2, 7); px(c, 6, 5, "#4a9a3a", 2, 10); px(c, 9, 7, "#3a8a2a", 2, 8); px(c, 11, 9, "#4a9a3a", 2, 6); px(c, 5, 4, "#5ab04a", 1, 2); }
        else if (o.t === "stone") { px(c, 2, 6, "#8a8a90", 12, 9); px(c, 3, 5, "#9a9aa0", 10, 2); px(c, 4, 7, "#aaaab0", 4, 3); px(c, 2, 14, "#6a6a70", 12, 1); }
        else if (o.t === "twig") { px(c, 2, 9, "#7a4a22", 11, 2); px(c, 5, 6, "#8a5a2c", 2, 6); px(c, 9, 8, "#6a3a1a", 5, 1); }
        else if (o.t === "stump") { px(c, 3, 6, "#7a4a22", 10, 9); px(c, 4, 5, "#c8a06a", 8, 2); px(c, 6, 5, "#a07a4a", 4, 1); }
        else if (o.t === "tree") {
          px(c, 6, 32, "#5a3a1a", 4, 16); px(c, 4, 46, "#4a2e14", 8, 2);
          const leaf = winter ? "#e8eef4" : G && G.season === 2 ? "#d8742a" : "#3a8a2a", dark = winter ? "#c8d4e0" : G && G.season === 2 ? "#b8541a" : "#2a6a1e";
          c.fillStyle = dark; c.beginPath(); c.arc(8, 20, 8, 0, 7); c.arc(4, 26, 5, 0, 7); c.arc(12, 26, 5, 0, 7); c.fill();
          c.fillStyle = leaf; c.beginPath(); c.arc(8, 18, 7, 0, 7); c.arc(5, 24, 4, 0, 7); c.arc(11, 23, 4, 0, 7); c.fill();
        }
        else if (o.t === "forage") { const info = itemInfo("forage:" + o.name); px(c, 6, 8, "#4a9a3a", 1, 6); px(c, 4, 4, info.col, 6, 6); px(c, 5, 3, info.col, 4, 1); px(c, 5, 5, "#fff", 1, 1); }
      });
    }
    function iconFor(id) {
      return art("i" + id, 16, 16, (c) => {
        const info = itemInfo(id), [kind, key] = id.split(":");
        if (id === "hoe") { px(c, 3, 12, "#8a5a2c", 9, 2); px(c, 11, 3, "#8a5a2c", 2, 10); px(c, 9, 2, "#9aa0a8", 6, 3); }
        else if (id === "can") { px(c, 3, 6, "#5a8ac8", 8, 8); px(c, 10, 5, "#5a8ac8", 4, 2); px(c, 13, 3, "#5a8ac8", 2, 3); px(c, 4, 4, "#3a6aa8", 6, 2); }
        else if (id === "axe") { px(c, 4, 4, "#8a5a2c", 2, 11); px(c, 6, 3, "#9aa0a8", 6, 6); px(c, 11, 4, "#c8ccd2", 1, 4); }
        else if (id === "pick") { px(c, 7, 4, "#8a5a2c", 2, 11); px(c, 2, 3, "#9aa0a8", 12, 2); px(c, 1, 5, "#9aa0a8", 2, 2); px(c, 13, 5, "#9aa0a8", 2, 2); }
        else if (id === "scythe") { px(c, 4, 4, "#8a5a2c", 2, 11); px(c, 6, 3, "#c8ccd2", 8, 2); px(c, 12, 5, "#c8ccd2", 2, 3); }
        else if (id === "rod") { for (let i = 0; i < 12; i++) px(c, 2 + i, 14 - i, "#b89a5a", 1, 1); px(c, 13, 2, "#fff", 1, 8); px(c, 12, 10, "#e33", 2, 2); }
        else if (kind === "seed") { px(c, 3, 2, "#e8d8b0", 10, 12); px(c, 3, 2, "#c8b890", 10, 2); px(c, 5, 6, info.col, 6, 5); px(c, 6, 5, CROPS[key].leaf, 4, 1); }
        else if (kind === "crop") { const cr = cropArt(key, 3, false); c.drawImage(cr, 0, 8, 16, 16, 0, 0, 16, 16); }
        else if (kind === "fish") { px(c, 2, 6, info.col, 10, 5); px(c, 12, 4, info.col, 3, 9); px(c, 4, 7, "#a8c8f0", 6, 1); px(c, 4, 7, "#111", 1, 1); }
        else if (kind === "forage") { px(c, 7, 9, "#4a9a3a", 2, 5); px(c, 4, 3, info.col, 8, 7); px(c, 5, 2, info.col, 6, 1); }
        else if (RES[id]) { if (id === "wood") { px(c, 2, 5, "#8a5a2c", 12, 6); px(c, 2, 5, "#c8a06a", 2, 6); } else if (id === "stone") { px(c, 3, 4, "#9a9aa0", 10, 8); px(c, 4, 5, "#b0b0b6", 4, 3); } else if (id === "fiber") { px(c, 4, 3, "#7ab04a", 2, 10); px(c, 8, 2, "#6aa03a", 2, 11); px(c, 11, 4, "#7ab04a", 2, 9); } else { px(c, 5, 4, "#c8903a", 6, 9); } }
      });
    }
    function personArt(look, dir, frame, isPlayer) {
      return art("p" + look.hair + look.shirt + (look.hat || "") + dir + frame + (isPlayer ? "P" : ""), 16, 32, (c) => {
        const skin = look.skin || "#f0c8a0", walk = frame % 2 ? 1 : 0;
        px(c, 4, 29, "rgba(0,0,0,.25)", 8, 2);
        px(c, 5, 22, look.pants || "#3a5a9a", 3, 7 - walk); px(c, 8, 22, look.pants || "#3a5a9a", 3, 7 - (1 - walk));
        px(c, 5, 28 - walk, "#3a2414", 3, 2); px(c, 8, 29 - (1 - walk), "#3a2414", 3, 2);
        px(c, 4, 14, look.shirt, 8, 9);
        if (isPlayer) { px(c, 5, 15, "#3a5a9a", 2, 8); px(c, 9, 15, "#3a5a9a", 2, 8); px(c, 5, 19, "#3a5a9a", 6, 4); }
        px(c, 3, 15, look.shirt, 1, 6); px(c, 12, 15, look.shirt, 1, 6); px(c, 3, 21, skin, 1, 2); px(c, 12, 21, skin, 1, 2);
        px(c, 4, 4, skin, 8, 10);
        px(c, 4, 2, look.hair, 8, 4); px(c, 3, 4, look.hair, 1, dir === 1 ? 9 : 5); px(c, 12, 4, look.hair, 1, dir === 1 ? 9 : 5);
        if (dir === 1) px(c, 4, 4, look.hair, 8, 9);
        if (look.hat) { px(c, 3, 1, look.hat, 10, 3); px(c, 2, 4, look.hat, 12, 1); }
        if (dir === 0) { px(c, 6, 8, "#1a1a1a", 1, 2); px(c, 9, 8, "#1a1a1a", 1, 2); px(c, 7, 11, "#a85a4a", 2, 1); }
        if (dir === 2) { px(c, 5, 8, "#1a1a1a", 1, 2); px(c, 4, 4, look.hair, 4, 6); }
        if (dir === 3) { px(c, 10, 8, "#1a1a1a", 1, 2); px(c, 8, 4, look.hair, 4, 6); }
      });
    }
    const PLAYER_LOOK = { hair: "#7a4a22", shirt: "#e8402a", pants: "#3a5a9a", hat: "#c89a3a" };

    // ---------------- helpers ----------------
    const M = () => MAPS[G.map];
    const objsOf = (id) => G.objs[id] || (G.objs[id] = {});
    const key = (x, y) => x + "," + y;
    function structAt(m, x, y) { return m.structs.find((s) => x >= s.x && x < s.x + s.w && y >= s.y && y < s.y + s.h); }
    function solid(m, x, y) {
      if (x < 0 || y < 0 || x >= m.W || y >= m.H) return true;
      const gc = m.ground[y][x]; if (gc === "e" || gc === "w" || gc === "x") return true;
      const s = structAt(m, x, y); if (s && !(s.door && s.door.x === x && s.door.y === y)) return true;
      const o = objsOf(m.id)[key(x, y)]; if (o && o.t !== "forage") return true;
      if (m.id === "farm") { const so = G.soil[key(x, y)]; if (so && so.crop && CROPS[so.crop.id].trellis && !so.crop.dead) return true; }
      return false;
    }
    function canStand(px2, py2) { const m = M(); const pts = [[px2 - 5, py2 - 3], [px2 + 5, py2 - 3], [px2 - 5, py2], [px2 + 5, py2]]; return pts.every(([a, b]) => !solid(m, Math.floor(a / TS), Math.floor(b / TS))); }
    function say(text, col) { msgs.push({ text, t: 3.5, col }); if (msgs.length > 4) msgs.shift(); }
    function addItem(id, n) {
      n = n || 1;
      for (const s of G.inv) if (s && s.id === id && !TOOLS[id]) { s.n += n; return true; }
      const i = G.inv.findIndex((s) => !s); if (i < 0) { say("Your inventory is full!", "#e33"); return false; }
      G.inv[i] = { id, n }; return true;
    }
    function removeSel(n) { const s = G.inv[G.sel]; if (!s) return; s.n -= n || 1; if (s.n <= 0) G.inv[G.sel] = null; }
    const cur = () => G.inv[G.sel];
    const fmtTime = (tm) => { let h = Math.floor(tm / 100), m = tm % 100; const ap = h >= 12 && h < 24 ? "pm" : "am"; h = h % 12 || 12; return `${h}:${String(m).padStart(2, "0")} ${ap}`; };
    const weekday = () => WEEK[(G.day - 1) % 7];
    function useEnergy(n) {
      G.energy -= n;
      if (G.energy <= 0 && !exhaustedTold) { exhaustedTold = true; say("You feel exhausted. Better get some sleep.", "#e33"); }
      if (G.energy <= -15) passOut("You collapsed from exhaustion.");
    }
    function save() { if (G) { store().stardew = G; try { State.save(); } catch (e) {} } }

    // ---------------- modal UI ----------------
    function showModal(html, onOpen, opts) {
      menuOpen = true; modal.innerHTML = `<div class="sv-box ${opts && opts.wide ? "wide" : ""}">${html}</div>`; modal.hidden = false;
      if (onOpen) onOpen(modal.querySelector(".sv-box"));
    }
    function closeModal() { modal.hidden = true; modal.innerHTML = ""; menuOpen = false; }
    function dialogue(name, text, onClose) {
      showModal(`<div class="sv-dlg"><div class="sv-dlg-t">${esc(text)}</div><div class="sv-dlg-n">${esc(name)}</div></div><button class="sv-btn sv-ok">OK</button>`, (b) => { b.querySelector(".sv-ok").onclick = () => { closeModal(); if (onClose) onClose(); }; });
    }
    function confirmBox(q, yes) { showModal(`<div class="sv-dlg-t">${esc(q)}</div><div class="sv-row"><button class="sv-btn sv-y">Yes</button><button class="sv-btn sv-n">No</button></div>`, (b) => { b.querySelector(".sv-y").onclick = () => { closeModal(); yes(); }; b.querySelector(".sv-n").onclick = closeModal; }); }

    function openInventory() {
      const paint = (b) => {
        b.innerHTML = `<div class="sv-h">${esc(G.name)} · ${esc(G.farmName)} Farm <span class="sv-gold">${G.gold.toLocaleString()}g</span></div>
          <div class="sv-inv">${G.inv.map((s, i) => `<button class="sv-slot ${i === G.sel ? "on" : ""} ${i < 12 ? "hb" : ""}" data-i="${i}" title="${s ? esc(itemInfo(s.id).name) : ""}">${s ? `<canvas width="16" height="16"></canvas>${s.n > 1 ? `<i>${s.n}</i>` : ""}` : ""}</button>`).join("")}</div>
          <div class="sv-detail">Tap an item to select it (the top row is your toolbar). Tap a second slot to swap.</div>
          <div class="sv-h" style="margin-top:8px">Friendship</div><div class="sv-hearts">${VILLAGERS.map((v) => { const p = G.friends[v.name] || 0, h = Math.floor(p / HEART); return `<div><b>${v.name}</b> ${"❤".repeat(h)}${"♡".repeat(10 - h)}</div>`; }).join("")}</div>
          <div class="sv-row"><button class="sv-btn sv-eat" hidden>Eat</button><button class="sv-btn sv-trash">🗑 Trash</button><button class="sv-btn sv-close">Close</button></div>`;
        b.querySelectorAll(".sv-slot canvas").forEach((cc) => { const i = +cc.parentElement.dataset.i; cc.getContext("2d").drawImage(iconFor(G.inv[i].id), 0, 0); });
        let picked = null;
        b.querySelectorAll(".sv-slot").forEach((el) => el.onclick = () => {
          const i = +el.dataset.i;
          if (picked != null && picked !== i) { const tmp = G.inv[picked]; G.inv[picked] = G.inv[i]; G.inv[i] = tmp; picked = null; paint(b); return; }
          picked = i; if (i < 12) G.sel = i;
          b.querySelectorAll(".sv-slot").forEach((x) => x.classList.toggle("pick", x === el));
          const s = G.inv[i], info = s && itemInfo(s.id);
          b.querySelector(".sv-detail").innerHTML = s ? `<b>${esc(info.name)}</b>${info.sell ? ` · sells for ${info.sell}g` : ""}${info.energy ? ` · +${info.energy} energy` : ""}${info.tool ? " · tool" : ""}` : "Empty slot.";
          const eat = b.querySelector(".sv-eat"); eat.hidden = !(s && info.energy); eat.onclick = () => { eatItem(i); paint(b); };
        });
        b.querySelector(".sv-trash").onclick = () => { if (picked == null || !G.inv[picked] || TOOLS[G.inv[picked].id]) return; G.inv[picked] = null; paint(b); };
        b.querySelector(".sv-close").onclick = closeModal;
      };
      showModal("", paint, { wide: true });
    }
    function eatItem(i) {
      const s = G.inv[i]; if (!s) return; const info = itemInfo(s.id); if (!info.energy) return;
      G.energy = Math.min(G.maxEnergy, G.energy + info.energy); s.n--; if (s.n <= 0) G.inv[i] = null;
      say(`Ate ${info.name}. +${info.energy} energy`, "#3a3");
    }
    function openShop() {
      const h = Math.floor(G.time / 100);
      if (weekday() === "Wed") { dialogue("Pierre's", "Pierre's General Store is closed on Wednesdays."); return; }
      if (h < 9 || h >= 17) { dialogue("Pierre's", "Pierre's General Store is open 9:00am to 5:00pm."); return; }
      const paint = (b) => {
        const stock = Object.keys(CROPS).filter((k) => CROPS[k].seasons.includes(G.season));
        b.innerHTML = `<div class="sv-h">Pierre's General Store <span class="sv-gold">${G.gold.toLocaleString()}g</span></div>
          <div class="sv-dlg-t" style="margin-bottom:8px">Pierre: "Welcome! ${G.season === 3 ? "Nothing grows in winter, I'm afraid — come back in spring!" : "Fresh " + SEASONS[G.season].toLowerCase() + " seeds, just in."}"</div>
          <div class="sv-shop">${stock.map((k) => `<button class="sv-buy" data-k="${k}"><canvas width="16" height="16"></canvas><span>${CROPS[k].name} Seeds<small>${CROPS[k].days} days${CROPS[k].regrow ? ", regrows" : ""} · sells ${CROPS[k].sell}g</small></span><b>${CROPS[k].seed}g</b></button>`).join("") || "<div>No seeds this season.</div>"}</div>
          <div class="sv-h" style="margin-top:8px">Sell to Pierre</div><div class="sv-shop">${G.inv.map((s, i) => s && itemInfo(s.id).sell && !TOOLS[s.id] ? `<button class="sv-sell" data-i="${i}"><canvas width="16" height="16"></canvas><span>${esc(itemInfo(s.id).name)} ×${s.n}</span><b>${itemInfo(s.id).sell}g</b></button>` : "").join("") || "<div>Nothing to sell.</div>"}</div>
          <div class="sv-row"><button class="sv-btn sv-close">Leave</button></div>`;
        b.querySelectorAll(".sv-buy").forEach((el) => { el.querySelector("canvas").getContext("2d").drawImage(iconFor("seed:" + el.dataset.k), 0, 0); el.onclick = () => { const k = el.dataset.k, n = 1; if (G.gold < CROPS[k].seed * n) { say("Not enough gold.", "#e33"); return; } if (addItem("seed:" + k, n)) { G.gold -= CROPS[k].seed * n; paint(b); } }; });
        b.querySelectorAll(".sv-sell").forEach((el) => { const i = +el.dataset.i; el.querySelector("canvas").getContext("2d").drawImage(iconFor(G.inv[i].id), 0, 0); el.onclick = () => { const s = G.inv[i]; G.gold += itemInfo(s.id).sell; G.stats.earned += itemInfo(s.id).sell; s.n--; if (s.n <= 0) G.inv[i] = null; paint(b); }; });
        b.querySelector(".sv-close").onclick = () => { closeModal(); save(); };
      };
      showModal("", paint, { wide: true });
    }
    function openBin() {
      const s = cur();
      if (s && itemInfo(s.id).sell && !TOOLS[s.id]) {
        const info = itemInfo(s.id); G.bin.push({ id: s.id, n: s.n }); say(`Shipped ${s.n}× ${info.name}. You'll be paid overnight.`, "#3a3"); G.inv[G.sel] = null; return;
      }
      const total = G.bin.reduce((a, b) => a + itemInfo(b.id).sell * b.n, 0);
      dialogue("Shipping Bin", G.bin.length ? `In the bin: ${G.bin.map((b) => b.n + "× " + itemInfo(b.id).name).join(", ")} — worth ${total}g. Items are sold overnight.` : "Hold an item and use the bin to ship it. Shipped items are sold overnight.");
    }

    // ---------------- world actions ----------------
    function facingTile() { const tx = Math.floor(G.x / TS), ty = Math.floor((G.y - 4) / TS); const d = [[0, 1], [0, -1], [-1, 0], [1, 0]][G.face]; return [tx + d[0], ty + d[1]]; }
    function useTool(tx, ty) {
      if (menuOpen || fishing || swing > 0) return;
      const s = cur(); if (!s) return;
      const m = M(); if (tx == null) [tx, ty] = facingTile();
      const k = key(tx, ty), O = objsOf(m.id), o = O[k], soil = m.id === "farm" ? G.soil[k] : null, gc = m.ground[ty] && m.ground[ty][tx];
      const info = itemInfo(s.id);
      if (info.seed) {
        if (!soil || soil.crop) { say("Seeds must be planted in tilled soil.", "#a60"); return; }
        if (!CROPS[info.seed].seasons.includes(G.season)) { say(`${CROPS[info.seed].name} can't grow in ${SEASONS[G.season]}.`, "#a60"); return; }
        soil.crop = { id: info.seed, grow: 0, regrowing: false, dead: false }; removeSel(1); return;
      }
      if (!info.tool) { // holding food or goods: eat
        if (info.energy) confirmBox(`Eat ${info.name}? (+${info.energy} energy)`, () => eatItem(G.sel));
        return;
      }
      swing = 0.28; swingTool = s.id;
      if (s.id === "hoe") {
        useEnergy(2);
        if (m.id !== "farm") { say("You can't till here.", "#a60"); return; }
        if (!o && !soil && (gc === "g" || gc === "d") && !structAt(m, tx, ty)) G.soil[k] = { watered: G.weather === "rain", crop: null };
        else if (o && o.t === "forage") return;
      } else if (s.id === "can") {
        if (gc === "w") { G.water = 40; say("Watering can refilled.", "#38c"); return; }
        if (G.water <= 0) { say("Your watering can is empty. Refill it at the pond.", "#a60"); return; }
        useEnergy(2); G.water--; if (soil) soil.watered = true;
      } else if (s.id === "axe") {
        useEnergy(2);
        if (o && o.t === "twig") { delete O[k]; addItem("wood", 1 + (Math.random() < 0.3 ? 1 : 0)); }
        else if (o && o.t === "tree") { o.hp--; if (o.hp <= 0) { O[k] = { t: "stump", hp: 3 }; addItem("wood", 10); if (Math.random() < 0.5) addItem("sap", 2); say("Timber!", "#8a5a2c"); } }
        else if (o && o.t === "stump") { o.hp--; if (o.hp <= 0) { delete O[k]; addItem("wood", 4); } }
      } else if (s.id === "pick") {
        useEnergy(2);
        if (o && o.t === "stone") { delete O[k]; addItem("stone", 1 + (Math.random() < 0.25 ? 1 : 0)); }
        else if (soil && !soil.crop) delete G.soil[k];
      } else if (s.id === "scythe") {
        if (o && o.t === "weed") { delete O[k]; if (Math.random() < 0.5) addItem("fiber", 1); }
        else if (soil && soil.crop && soil.crop.dead) soil.crop = null;
        else if (soil && soil.crop && soil.crop.id === "wheat" && ripe(soil.crop)) harvest(k, soil);
      } else if (s.id === "rod") {
        if (gc !== "w") { swing = 0; say("Face the water to fish.", "#a60"); return; }
        useEnergy(8); startFishing();
      }
    }
    function stageOf(c) { const C = CROPS[c.id]; if (c.regrowing) return c.grow >= C.regrow ? 3 : 2; const f = c.grow / C.days; return f >= 1 ? 3 : f >= 0.55 ? 2 : f > 0 ? 1 : 0; }
    const ripe = (c) => !c.dead && stageOf(c) === 3;
    function harvest(k, soil) {
      const C = CROPS[soil.crop.id], n = (C.yield || 1) + (C.extra && Math.random() < C.extra ? 1 : 0);
      if (!addItem("crop:" + soil.crop.id, n)) return;
      G.stats.crops += n;
      if (C.regrow) { soil.crop.regrowing = true; soil.crop.grow = 0; } else soil.crop = null;
    }
    function interact(tx, ty) {
      if (menuOpen || fishing) return;
      const m = M(); if (tx == null) [tx, ty] = facingTile();
      const k = key(tx, ty);
      // villagers
      const v = npcs.find((n) => Math.abs(n.x - (tx * TS + 8)) < 14 && Math.abs(n.y - (ty * TS + 12)) < 18);
      if (v) { talkTo(v); return; }
      // crops
      if (m.id === "farm" && G.soil[k] && G.soil[k].crop && ripe(G.soil[k].crop)) { harvest(k, G.soil[k]); return; }
      // forage
      const o = objsOf(m.id)[k]; if (o && o.t === "forage") { if (addItem("forage:" + o.name)) { delete objsOf(m.id)[k]; G.stats.forage++; say(`Found ${o.name}!`, "#3a3"); } return; }
      // structures
      const st = structAt(m, tx, ty);
      if (st) {
        if (st.t === "bin") return openBin();
        if (st.t === "bed") return confirmBox("Go to sleep for the night?", () => endDay(false));
        if (st.t === "tv") return watchTV();
        if (st.t === "board") return dialogue("Help Wanted", "Help Wanted: Pierre needs 10 Parsnips by the end of the season — just kidding, ship whatever you grow! Tip: water every crop each morning.");
        if (st.t === "fireplace") return say("The fire crackles warmly.", "#a60");
        if (st.door) { if (st.door.shop) return openShop(); if (st.door.msg) return dialogue(st.t === "saloon" ? "Stardrop Saloon" : "Mayor's Manor", st.door.msg); if (st.door.to) return warp(st.door.to, st.door.tx, st.door.ty); }
      }
      // holding food → eat
      const s = cur(); if (s && itemInfo(s.id).energy) confirmBox(`Eat ${itemInfo(s.id).name}? (+${itemInfo(s.id).energy} energy)`, () => eatItem(G.sel));
    }
    function talkTo(v) {
      const s = cur(), today = G.year * 1000 + G.season * 100 + G.day;
      if (s && !TOOLS[s.id] && itemInfo(s.id).sell && G.gifted[v.name] !== today) {
        const loved = v.loves.includes(s.id), pts = loved ? 80 : 20; G.friends[v.name] = Math.min(10 * HEART, (G.friends[v.name] || 0) + pts); G.gifted[v.name] = today; removeSel(1);
        dialogue(v.name, loved ? `For me? I love this! Thank you so much!` : `Oh, thanks. That's nice of you.`); return;
      }
      if (G.talked[v.name] !== today) { G.talked[v.name] = today; G.friends[v.name] = Math.min(10 * HEART, (G.friends[v.name] || 0) + 20); }
      const h = Math.floor((G.friends[v.name] || 0) / HEART);
      dialogue(v.name, h >= 4 ? v.lines[(G.day + 1) % v.lines.length] + " It's always nice to see you, " + G.name + "." : v.lines[G.day % v.lines.length]);
    }
    function watchTV() {
      const f = { sun: "It's going to be clear and sunny all day.", rain: "Rain is expected all day tomorrow — no need to water your crops!", snow: "Expect snow tomorrow. Bundle up!", storm: "Looks like a storm is approaching. Thunder and lightning expected." }[G.tomorrow];
      dialogue("KOZU 5 — Weather Report", "Tomorrow's forecast: " + f + " " + ["Tip: Parsnips grow fast — perfect for your first days.", "Tip: Crops that regrow keep producing all season long.", "Tip: Each crop withers when its season ends.", "Tip: Talk to villagers every day to build friendship."][G.day % 4]);
    }
    function warp(to, tx, ty) {
      G.map = to; const m = MAPS[to];
      if (ty == null) ty = Math.floor(G.y / TS);
      G.x = tx * TS + 8; G.y = ty * TS + 12;
      if (to === "house") G.face = 1; else if (to === "farm" && tx === 26) G.face = 0;
      for (let i = 0; i < 6 && !canStand(G.x, G.y); i++) G.y += 4;
      spawnNPCs(); void m;
    }

    // ---------------- fishing minigame ----------------
    function startFishing() {
      fishing = { phase: "wait", t: 0, bite: 1 + Math.random() * 4, fish: null };
      say("You cast your line…", "#38c");
    }
    function fishTick(dt) {
      const F = fishing; if (!F) return; F.t += dt;
      if (F.phase === "wait" && F.t >= F.bite) { F.phase = "bite"; F.t = 0; say("!", "#e33"); }
      if (F.phase === "bite" && F.t > 1.2) { fishing = null; say("The fish got away…", "#a60"); }
      if (F.phase === "game") {
        const diff = F.fish[2] / 100;
        F.ftimer -= dt; if (F.ftimer <= 0) { F.ftarget = Math.random(); F.ftimer = 0.4 + Math.random() * (1.4 - diff); }
        F.fy += (F.ftarget - F.fy) * dt * (1 + diff * 3);
        F.bv += (F.hold ? 2.4 : -2.0) * dt; F.bv = clamp(F.bv, -1.2, 1.2); F.by += F.bv * dt;
        if (F.by < 0) { F.by = 0; F.bv = Math.abs(F.bv) * 0.3; } if (F.by > 1 - F.bh) { F.by = 1 - F.bh; F.bv = 0; }
        const inBar = F.fy >= F.by && F.fy <= F.by + F.bh;
        F.prog += (inBar ? 0.32 : -0.22) * dt;
        if (F.prog >= 1) { fishing = null; const f = F.fish; if (addItem("fish:" + f[0])) { G.stats.fish++; const inches = 5 + Math.round(Math.random() * 20); say(`You caught a ${f[0]}! (${inches} in.)`, "#38c"); } }
        else if (F.prog <= 0) { fishing = null; say("The fish escaped!", "#a60"); }
      }
    }
    function fishPress(down) {
      const F = fishing; if (!F) return false;
      if (F.phase === "bite" && down) { const list = FISH[G.season]; const f = list[(Math.random() * list.length) | 0]; Object.assign(F, { phase: "game", fish: f, fy: 0.5, ftarget: 0.5, ftimer: 0, by: 0.4, bv: 0, bh: 0.26, prog: 0.3, hold: true }); return true; }
      if (F.phase === "game") { F.hold = down; return true; }
      if (F.phase === "wait" && down) { fishing = null; say("You reeled in too early.", "#a60"); return true; }
      return true;
    }

    // ---------------- day cycle ----------------
    function rollWeather(season) { const r = Math.random(); if (season === 3) return r < 0.4 ? "snow" : "sun"; if (season === 1) return r < 0.08 ? "storm" : r < 0.18 ? "rain" : "sun"; return r < 0.2 ? "rain" : "sun"; }
    function endDay(passedOut) {
      // ship
      const lines = {}; let total = 0;
      G.bin.forEach((b) => { const info = itemInfo(b.id), v = info.sell * b.n; total += v; const c = info.cat || "Other"; lines[c] = (lines[c] || 0) + v; });
      G.gold += total; G.stats.earned += total; G.bin = [];
      // grow crops
      const nextDay = G.day + 1, seasonChange = nextDay > 28, newSeason = seasonChange ? (G.season + 1) % 4 : G.season;
      for (const k in G.soil) {
        const so = G.soil[k];
        if (so.crop && !so.crop.dead) {
          if (so.watered) so.crop.grow++;
          if (seasonChange && !CROPS[so.crop.id].seasons.includes(newSeason)) so.crop.dead = true;
        }
        if (!so.crop && !so.watered && Math.random() < 0.1) delete G.soil[k];
        else so.watered = false;
      }
      G.weather = G.tomorrow; G.tomorrow = rollWeather(newSeason);
      if (G.weather === "rain" || G.weather === "storm") for (const k in G.soil) G.soil[k].watered = true;
      // date
      G.day = nextDay; if (seasonChange) { G.day = 1; G.season = newSeason; if (newSeason === 0) G.year++; }
      // debris and forage regrow
      const F = objsOf("farm"), T = objsOf("town"), farm = MAPS.farm, town = MAPS.town;
      for (let i = 0; i < 6; i++) { const x = 3 + ((Math.random() * 44) | 0), y = 8 + ((Math.random() * 24) | 0); if (farm.ground[y][x] === "g" && !F[key(x, y)] && !G.soil[key(x, y)] && !structAt(farm, x, y)) F[key(x, y)] = { t: Math.random() < 0.7 ? "weed" : "stone" }; }
      Object.keys(T).forEach((k) => { if (T[k].t === "forage") delete T[k]; });
      const fl = FORAGE[G.season];
      for (let i = 0; i < 4; i++) { const x = 2 + ((Math.random() * 38) | 0), y = 4 + ((Math.random() * 24) | 0); if (town.ground[y][x] === "g" && !structAt(town, x, y)) T[key(x, y)] = { t: "forage", name: fl[(Math.random() * fl.length) | 0][0] }; }
      for (let i = 0; i < 2; i++) { const x = 3 + ((Math.random() * 44) | 0), y = 5 + ((Math.random() * 28) | 0); if (farm.ground[y][x] === "g" && !F[key(x, y)] && !G.soil[key(x, y)] && !structAt(farm, x, y)) F[key(x, y)] = { t: "forage", name: fl[(Math.random() * fl.length) | 0][0] }; }
      // wake up
      let note = "";
      if (passedOut) { const fine = Math.min(1000, Math.floor(G.gold * 0.1)); G.gold -= fine; G.energy = Math.floor(G.maxEnergy / 2); note = `Someone found you passed out and brought you home. They charged you ${fine}g for the trouble.`; }
      else G.energy = G.time >= 2400 ? Math.floor(G.maxEnergy * 0.75) : G.maxEnergy;
      exhaustedTold = false; G.time = 600; G.map = "house"; G.x = 4 * TS + 8; G.y = 5 * TS + 12; G.face = 0; G.water = 40; spawnNPCs();
      save();
      const cats = ["Farming", "Foraging", "Fishing", "Other"];
      showModal(`<div class="sv-h">${passedOut ? "Passed out…" : "Good night!"}</div>
        ${note ? `<div class="sv-dlg-t">${esc(note)}</div>` : ""}
        <div class="sv-ship">${cats.map((c) => `<div><span>${c}</span><b>${(lines[c] || 0).toLocaleString()}g</b></div>`).join("")}<div class="tot"><span>Total</span><b>${total.toLocaleString()}g</b></div></div>
        ${seasonChange ? `<div class="sv-dlg-t">🍂 It's the first day of ${SEASONS[G.season]}! Crops from last season have withered.</div>` : ""}
        <div class="sv-dlg-t">Day ${G.day} of ${SEASONS[G.season]}, Year ${G.year} · ${G.weather === "rain" ? "🌧 Rain today — crops are watered." : G.weather === "storm" ? "⛈ Storm today." : G.weather === "snow" ? "❄ Snow today." : "☀ Sunny today."}</div>
        <div class="sv-row"><button class="sv-btn sv-ok">Start the day</button></div>`, (b) => { b.querySelector(".sv-ok").onclick = closeModal; });
    }
    function passOut(why) { if (menuOpen && modal.querySelector(".sv-ship")) return; closeModal(); say(why, "#e33"); endDay(true); }

    // ---------------- villagers ----------------
    function spawnNPCs() {
      npcs = [];
      if (!G || G.map !== "town") return;
      VILLAGERS.forEach((v, i) => { npcs.push({ ...v, x: (8 + i * 7) * TS + 8, y: (12 + (i % 2) * 6) * TS + 12, dir: 0, tx: 0, ty: 0, wait: Math.random() * 2, anim: 0, look: { hair: v.hair, shirt: v.shirt, hat: v.hat, pants: "#4a4a5a", skin: "#f0c8a0" } }); });
    }
    function npcTick(dt) {
      npcs.forEach((n) => {
        if (n.wait > 0) { n.wait -= dt; n.moving = false; return; }
        if (!n.tx) { n.tx = n.x + (Math.random() - 0.5) * 96; n.ty = n.y + (Math.random() - 0.5) * 64; }
        const dx = n.tx - n.x, dy = n.ty - n.y, d = Math.hypot(dx, dy);
        if (d < 2) { n.tx = 0; n.wait = 1 + Math.random() * 3; return; }
        const sp = 28 * dt, nx = n.x + dx / d * sp, ny = n.y + dy / d * sp, m = M();
        if (solid(m, Math.floor(nx / TS), Math.floor(ny / TS)) || Math.hypot(nx - G.x, ny - G.y) < 10) { n.tx = 0; n.wait = 0.5; return; }
        n.x = nx; n.y = ny; n.moving = true; n.anim += dt * 6; n.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 2 : 3) : (dy < 0 ? 1 : 0);
      });
    }

    // ---------------- update ----------------
    function update(dt) {
      t += dt; msgs.forEach((m) => (m.t -= dt)); msgs = msgs.filter((m) => m.t > 0);
      if (!G || menuOpen) return;
      if (swing > 0) swing -= dt;
      fishTick(dt);
      // clock: 10 game minutes every 7 real seconds
      clockAcc += dt;
      while (clockAcc >= 0.7) { clockAcc -= 0.7; G.time += 1; if (G.time % 100 >= 60) G.time += 40; if (G.time >= 2600) { passOut("It's 2:00 AM… you passed out."); return; } }
      if (G.time === 2400 && !G.lateWarned) { G.lateWarned = true; say("It's getting late. Head to bed!", "#e33"); } if (G.time < 2400) G.lateWarned = false;
      // movement
      if (!fishing) {
        let mx = 0, my = 0;
        if (keys.ArrowLeft || keys.KeyA || keys.left) mx -= 1; if (keys.ArrowRight || keys.KeyD || keys.right) mx += 1;
        if (keys.ArrowUp || keys.KeyW || keys.up) my -= 1; if (keys.ArrowDown || keys.KeyS || keys.down) my += 1;
        if (mx || my) {
          const sp = (G.energy <= 0 ? 36 : 64) * dt, mag = Math.hypot(mx, my);
          const nx = G.x + mx / mag * sp, ny = G.y + my / mag * sp;
          if (canStand(nx, G.y)) G.x = nx; if (canStand(G.x, ny)) G.y = ny;
          G.face = Math.abs(mx) >= Math.abs(my) && mx ? (mx < 0 ? 2 : 3) : (my < 0 ? 1 : 0);
          G.walkT = (G.walkT || 0) + dt;
          // map exits
          const m = M(), tx = Math.floor(G.x / TS), ty = Math.floor((G.y - 2) / TS);
          for (const ex of m.exits) if ((ex.door ? (tx === ex.x && ty >= ex.y0) : (tx === ex.x && ty >= ex.y0 && ty <= ex.y1))) { warp(ex.to, ex.tx, ex.ty); break; }
          // farmhouse door (entering)
          const st = structAt(m, tx, Math.floor((G.y - 6) / TS)); if (st && st.door && st.door.to && G.face === 1 && tx === st.door.x) warp(st.door.to, st.door.tx, st.door.ty);
        }
      }
      npcTick(dt);
    }

    // ---------------- draw ----------------
    function draw() {
      g.imageSmoothingEnabled = false;
      g.fillStyle = "#1a1a1a"; g.fillRect(0, 0, W, H);
      if (!G) return;
      const m = M(), vw = W / S, vh = H / S;
      camX = clamp(G.x - vw / 2, 0, Math.max(0, m.W * TS - vw)); camY = clamp(G.y - vh / 2, 0, Math.max(0, m.H * TS - vh));
      if (m.W * TS < vw) camX = -(vw - m.W * TS) / 2; if (m.H * TS < vh) camY = -(vh - m.H * TS) / 2;
      const X = (wx) => Math.round((wx - camX) * S), Y = (wy) => Math.round((wy - camY) * S);
      const x0 = Math.max(0, Math.floor(camX / TS)), y0 = Math.max(0, Math.floor(camY / TS)), x1 = Math.min(m.W - 1, Math.ceil((camX + vw) / TS)), y1 = Math.min(m.H - 1, Math.ceil((camY + vh) / TS));
      const wf = ((t * 2) | 0) % 2;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const gc = m.ground[y][x]; g.drawImage(groundArt(gc, (hash(x, y, 1) * 4) | 0, gc === "w" ? wf : 0), X(x * TS), Y(y * TS), TS * S, TS * S);
        if (m.id === "farm") { const so = G.soil[key(x, y)]; if (so) g.drawImage(soilArt(so.watered ? 1 : 0), X(x * TS), Y(y * TS), TS * S, TS * S); }
      }
      // sprites sorted by baseline
      const list = [], O = objsOf(m.id);
      for (const k in O) { const [x, y] = k.split(",").map(Number); if (x < x0 - 1 || x > x1 + 1 || y < y0 - 1 || y > y1 + 3) continue; const o = O[k], im = objArt(o); list.push({ y: (y + 1) * TS, f: () => g.drawImage(im, X(x * TS), Y((y + 1) * TS - im.height), TS * S, im.height * S) }); }
      if (m.id === "farm") for (const k in G.soil) { const so = G.soil[k]; if (!so.crop) continue; const [x, y] = k.split(",").map(Number); if (x < x0 || x > x1 || y < y0 || y > y1 + 1) continue; const im = cropArt(so.crop.id, stageOf(so.crop), so.crop.dead); list.push({ y: (y + 1) * TS - 1, f: () => { g.drawImage(im, X(x * TS), Y((y + 1) * TS - 24), TS * S, 24 * S); if (ripe(so.crop) && ((t * 2) | 0) % 2) { g.fillStyle = "rgba(255,255,255,.7)"; g.fillRect(X(x * TS + 7), Y(y * TS - 6), S * 2, S * 2); } } }); }
      m.structs.forEach((s) => list.push({ y: (s.y + s.h) * TS, f: () => drawStruct(s, X, Y) }));
      npcs.forEach((n) => list.push({ y: n.y, f: () => { const im = personArt(n.look, n.dir, n.moving ? ((n.anim | 0) % 2) + 1 : 0, false); g.drawImage(im, X(n.x - 8), Y(n.y - 30), 16 * S, 32 * S); } }));
      list.push({ y: G.y, f: () => drawPlayer(X, Y) });
      list.sort((a, b) => a.y - b.y).forEach((d) => d.f());
      // tool target highlight
      if (!fishing && !menuOpen) { const [fx, fy] = facingTile(); g.strokeStyle = "rgba(255,255,255,.45)"; g.lineWidth = 2; g.strokeRect(X(fx * TS) + 1, Y(fy * TS) + 1, TS * S - 2, TS * S - 2); }
      // weather + lighting
      const outdoors = m.id !== "house";
      if (outdoors && (G.weather === "rain" || G.weather === "storm")) { g.strokeStyle = "rgba(180,200,255,.55)"; g.lineWidth = 1.5; for (let i = 0; i < 90; i++) { const rx = (hash(i, 1, 1) * W + t * 120) % W, ry = (hash(i, 2, 2) * H + t * 520) % H; g.beginPath(); g.moveTo(rx, ry); g.lineTo(rx - 4, ry + 12); g.stroke(); } g.fillStyle = "rgba(30,40,70,.18)"; g.fillRect(0, 0, W, H); }
      if (outdoors && G.weather === "snow") { g.fillStyle = "rgba(255,255,255,.85)"; for (let i = 0; i < 70; i++) { const rx = (hash(i, 3, 1) * W + Math.sin(t + i) * 20) % W, ry = (hash(i, 4, 2) * H + t * 40) % H; g.fillRect(rx, ry, 3, 3); } }
      const hr = G.time / 100, dark = outdoors ? clamp((hr - 18) / 4, 0, 0.62) : 0;
      if (dark > 0) { g.fillStyle = `rgba(20,20,70,${dark})`; g.fillRect(0, 0, W, H); }
      drawHUD();
      if (fishing) drawFishing();
    }
    function drawStruct(s, X, Y) {
      const x = X(s.x * TS), y = Y(s.y * TS), w = s.w * TS * S, h = s.h * TS * S, u = S;
      const r = (cx, cy, cw, ch, col) => { g.fillStyle = col; g.fillRect(x + cx * u, y + cy * u, cw * u, ch * u); };
      if (s.t === "house") {
        r(4, 30, 88, 50, "#c89a6a"); for (let i = 0; i < 6; i++) r(4, 34 + i * 8, 88, 1, "#a87a4a");
        g.fillStyle = "#b8402a"; g.beginPath(); g.moveTo(x, y + 34 * u); g.lineTo(x + w / 2, y - 4 * u); g.lineTo(x + w, y + 34 * u); g.fill();
        r(6, 28, 84, 6, "#8a2a1a"); r(64, 6, 10, 16, "#8a5a3a");
        r(42, 56, 12, 24, "#6a3a1a"); r(51, 68, 2, 2, "#e8c84a");
        r(14, 46, 16, 14, "#9ad0f0"); r(66, 46, 16, 14, "#9ad0f0"); r(21, 46, 2, 14, "#fff"); r(73, 46, 2, 14, "#fff");
        if (G.time >= 1800) { r(14, 46, 16, 14, "rgba(255,220,120,.85)"); r(66, 46, 16, 14, "rgba(255,220,120,.85)"); }
      } else if (s.t === "bin") {
        r(1, -4, 30, 18, "#8a5a2c"); r(1, -6, 30, 4, "#6a3a1a"); for (let i = 0; i < 3; i++) r(2, -1 + i * 5, 28, 1, "#6a3a1a"); r(13, 0, 6, 3, "#c8a06a");
      } else if (s.t === "pierre") {
        r(2, 26, 108, 54, "#e8d8b0"); g.fillStyle = "#3a8a5a"; g.fillRect(x, y + 16 * u, w, 12 * u); for (let i = 0; i < 9; i++) r(i * 12 + 2, 16, 6, 12, "#e8e8e8");
        r(4, 4, 104, 12, "#5a8a3a"); r(30, 6, 52, 9, "#f4e8c8"); g.fillStyle = "#3a5a2a"; g.font = `bold ${7 * u}px monospace`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("PIERRE'S", x + 56 * u, y + 10.5 * u);
        r(48, 56, 16, 24, "#6a3a1a"); r(10, 40, 24, 16, "#9ad0f0"); r(78, 40, 24, 16, "#9ad0f0"); r(10, 52, 24, 4, "#c84a3a"); r(78, 52, 24, 4, "#e8c84a");
      } else if (s.t === "saloon") {
        r(2, 20, 108, 60, "#a85a3a"); for (let i = 0; i < 7; i++) r(2, 24 + i * 8, 108, 1, "#884a2a"); r(0, 14, 112, 8, "#6a2a1a");
        r(24, 4, 64, 10, "#3a2a1a"); g.fillStyle = "#e8c84a"; g.font = `bold ${6 * u}px monospace`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("STARDROP SALOON", x + 56 * u, y + 9 * u);
        r(48, 56, 16, 24, "#4a2a14"); r(12, 38, 22, 14, "#f0d08a"); r(78, 38, 22, 14, "#f0d08a");
      } else if (s.t === "manor") {
        r(2, 20, 92, 44, "#d8c8b8"); g.fillStyle = "#4a5a8a"; g.beginPath(); g.moveTo(x, y + 22 * u); g.lineTo(x + w / 2, y); g.lineTo(x + w, y + 22 * u); g.fill(); r(40, 40, 14, 24, "#5a3a1a"); r(10, 32, 18, 14, "#9ad0f0"); r(66, 32, 18, 14, "#9ad0f0");
      } else if (s.t === "board") { r(2, -10, 28, 18, "#8a5a2c"); r(5, -7, 9, 7, "#f4e8c8"); r(17, -6, 10, 9, "#f4e8c8"); r(8, 8, 3, 8, "#5a3a1a"); r(22, 8, 3, 8, "#5a3a1a"); }
      else if (s.t === "bed") { r(1, 0, 30, 31, "#8a5a2c"); r(3, 2, 26, 8, "#ffffff"); r(3, 10, 26, 20, "#4a6ad0"); r(3, 12, 26, 2, "#3a5ab0"); }
      else if (s.t === "tv") { r(1, 6, 14, 10, "#5a3a1a"); r(2, -2, 12, 10, "#2a2a30"); r(3, -1, 10, 7, ((t * 3) | 0) % 2 ? "#5a8ac8" : "#4a7ab8"); }
      else if (s.t === "fireplace") { r(0, 0, 32, 16, "#8a8a90"); r(8, 4, 16, 12, "#2a1a14"); r(10, 8 + Math.sin(t * 8), 12, 6, "#f0821a"); r(13, 10, 6, 4, "#ffd84a"); }
      else if (s.t === "table") { r(1, 2, 30, 10, "#a0703e"); r(3, 12, 3, 4, "#7a4a22"); r(26, 12, 3, 4, "#7a4a22"); r(12, 0, 8, 4, "#e8402a"); }
    }
    function drawPlayer(X, Y) {
      const moving = keys.ArrowLeft || keys.ArrowRight || keys.ArrowUp || keys.ArrowDown || keys.KeyA || keys.KeyD || keys.KeyW || keys.KeyS || keys.left || keys.right || keys.up || keys.down;
      const frame = moving && !fishing ? ((G.walkT * 6) | 0) % 2 + 1 : 0;
      const im = personArt(PLAYER_LOOK, G.face, frame, true);
      g.drawImage(im, X(G.x - 8), Y(G.y - 30), 16 * S, 32 * S);
      if (swing > 0 && swingTool) { const ic = iconFor(swingTool), a = (1 - swing / 0.28) * 1.6 - 0.8, d = [[0, 10], [0, -14], [-12, -4], [12, -4]][G.face]; g.save(); g.translate(X(G.x + d[0]), Y(G.y - 10 + d[1])); g.rotate(a * (G.face === 2 ? -1 : 1)); g.drawImage(ic, -8 * S, -12 * S, 16 * S, 16 * S); g.restore(); }
      if (fishing) { const d = [[0, 26], [0, -26], [-26, 0], [26, 0]][G.face], bx = X(G.x + d[0]), by = Y(G.y - 4 + d[1]) + Math.sin(t * 4) * 2; g.strokeStyle = "rgba(255,255,255,.7)"; g.lineWidth = 1; g.beginPath(); g.moveTo(X(G.x), Y(G.y - 24)); g.lineTo(bx, by); g.stroke(); g.fillStyle = "#e33"; g.fillRect(bx - 3, by - 3, 6, 6); if (fishing.phase === "bite") { g.fillStyle = "#ffd84a"; g.font = "bold 28px system-ui"; g.textAlign = "center"; g.fillText("!", X(G.x), Y(G.y - 36)); } }
    }
    function drawHUD() {
      // date / time / gold box (top right)
      const bx = W - 180, by = 10;
      g.fillStyle = "#f4dca0"; g.strokeStyle = "#8a5a2c"; g.lineWidth = 4; g.beginPath(); if (g.roundRect) g.roundRect(bx, by, 168, 112, 10); else g.rect(bx, by, 168, 112); g.fill(); g.stroke();
      g.fillStyle = "#4a2a14"; g.textAlign = "center"; g.textBaseline = "middle"; g.font = "bold 17px Georgia, serif";
      g.fillText(`${weekday()}. ${G.day}`, bx + 84, by + 20);
      g.font = "20px system-ui"; g.fillText({ sun: "☀️", rain: "🌧️", storm: "⛈️", snow: "❄️" }[G.weather] + " " + ["🌸", "🌻", "🍂", "⛄"][G.season], bx + 84, by + 46);
      g.font = "bold 17px Georgia, serif"; g.fillText(fmtTime(G.time), bx + 84, by + 72);
      g.fillStyle = "#3a2a14"; g.fillRect(bx + 14, by + 86, 140, 20); g.fillStyle = "#ffd84a"; g.font = "bold 15px monospace"; g.textAlign = "right"; g.fillText(G.gold.toLocaleString() + "g", bx + 148, by + 97);
      // energy bar (bottom right)
      const eh = 150, ex = W - 34, ey = H - eh - (coarse ? 150 : 16), f = clamp(G.energy / G.maxEnergy, 0, 1);
      g.fillStyle = "#8a5a2c"; g.fillRect(ex - 4, ey - 4, 26, eh + 8); g.fillStyle = "#3a2a14"; g.fillRect(ex, ey, 18, eh);
      g.fillStyle = f > 0.5 ? "#4ad04a" : f > 0.2 ? "#e8c84a" : "#e8402a"; g.fillRect(ex, ey + eh * (1 - f), 18, eh * f);
      g.fillStyle = "#fff"; g.font = "bold 12px system-ui"; g.textAlign = "center"; g.fillText("E", ex + 9, ey - 12);
      // watering-can level
      if (cur() && cur().id === "can") { g.fillStyle = "#3a2a14"; g.fillRect(ex - 30, ey + eh - 60, 10, 60); g.fillStyle = "#5a8ac8"; g.fillRect(ex - 30, ey + eh - 60 * (G.water / 40), 10, 60 * (G.water / 40)); }
      // toolbar
      const slot = Math.min(48, (W - 40) / 12), tw = slot * 12, tx0 = (W - tw) / 2, ty0 = H - slot - (coarse ? 132 : 12);
      g.fillStyle = "#f4dca0"; g.fillRect(tx0 - 6, ty0 - 6, tw + 12, slot + 12); g.strokeStyle = "#8a5a2c"; g.lineWidth = 3; g.strokeRect(tx0 - 6, ty0 - 6, tw + 12, slot + 12);
      for (let i = 0; i < 12; i++) {
        const sx = tx0 + i * slot; g.fillStyle = "#e8c88a"; g.fillRect(sx + 2, ty0 + 2, slot - 4, slot - 4);
        const s = G.inv[i]; if (s) { g.drawImage(iconFor(s.id), sx + 4, ty0 + 4, slot - 8, slot - 8); if (s.n > 1) { g.fillStyle = "#fff"; g.strokeStyle = "#000"; g.lineWidth = 3; g.font = "bold 12px monospace"; g.textAlign = "right"; g.strokeText(s.n, sx + slot - 4, ty0 + slot - 8); g.fillText(s.n, sx + slot - 4, ty0 + slot - 8); } }
        if (i === G.sel) { g.strokeStyle = "#e8402a"; g.lineWidth = 3; g.strokeRect(sx + 1, ty0 + 1, slot - 2, slot - 2); }
      }
      hudSlots = { x0: tx0, y0: ty0, slot };
      const sel = cur(); if (sel) { g.fillStyle = "rgba(0,0,0,.6)"; const label = itemInfo(sel.id).name; g.font = "bold 13px system-ui"; const lw = g.measureText(label).width + 16; g.fillRect(W / 2 - lw / 2, ty0 - 30, lw, 20); g.fillStyle = "#fff"; g.textAlign = "center"; g.fillText(label, W / 2, ty0 - 20); }
      // messages
      msgs.forEach((m, i) => { g.font = "bold 14px system-ui"; const w = g.measureText(m.text).width + 20; g.globalAlpha = Math.min(1, m.t); g.fillStyle = "rgba(244,220,160,.95)"; g.fillRect(12, 12 + i * 30, w, 24); g.fillStyle = m.col || "#4a2a14"; g.textAlign = "left"; g.fillText(m.text, 22, 25 + i * 30); g.globalAlpha = 1; });
      // location label
      g.fillStyle = "rgba(0,0,0,.4)"; g.font = "bold 12px system-ui"; g.textAlign = "left"; g.fillText({ farm: G.farmName + " Farm", town: "Pelican Town", house: "Farmhouse" }[G.map], 14, H - (coarse ? 150 : 72));
    }
    let hudSlots = null;
    function drawFishing() {
      const F = fishing; if (F.phase !== "game") return;
      const bh = Math.min(300, H * 0.55), bx = W / 2 + 60, by = H / 2 - bh / 2;
      g.fillStyle = "#8a5a2c"; g.fillRect(bx - 8, by - 8, 56, bh + 16); g.fillStyle = "#2a5a9a"; g.fillRect(bx, by, 26, bh);
      g.fillStyle = "rgba(90,220,90,.85)"; g.fillRect(bx, by + bh * (1 - F.by - F.bh), 26, bh * F.bh);
      const fy = by + bh * (1 - F.fy); g.fillStyle = "#f0a020"; g.beginPath(); g.ellipse(bx + 13, fy, 10, 6, 0, 0, 7); g.fill(); g.fillRect(bx + 20, fy - 5, 5, 10);
      g.fillStyle = "#3a2a14"; g.fillRect(bx + 32, by, 10, bh); g.fillStyle = F.prog > 0.66 ? "#4ad04a" : F.prog > 0.33 ? "#e8c84a" : "#e8402a"; g.fillRect(bx + 32, by + bh * (1 - F.prog), 10, bh * F.prog);
      g.fillStyle = "#fff"; g.font = "bold 14px system-ui"; g.textAlign = "center"; g.fillText(coarse ? "Hold ⛏ to reel" : "Hold click / C to reel", bx + 20, by + bh + 26);
    }

    // ---------------- input ----------------
    const MOVE = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD"]);
    let active = true;
    function onKey(e) {
      if (!active || !document.body.contains(host)) return;
      const a = document.activeElement; if (a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA")) return;
      if (MOVE.has(e.code) || e.code === "Space") e.preventDefault();
      if (menuOpen) { if (e.code === "Escape" || e.code === "KeyE") { const ok = modal.querySelector(".sv-ok,.sv-close,.sv-n"); if (ok) ok.click(); } return; }
      if (fishing && (e.code === "KeyC" || e.code === "Space")) { fishPress(true); return; }
      keys[e.code] = true;
      if (e.repeat) return;
      if (e.code === "KeyC") useTool();
      if (e.code === "KeyX" || e.code === "Enter") interact();
      if (e.code === "KeyE" || e.code === "KeyI" || e.code === "Escape") openInventory();
      const n = "1234567890".indexOf(e.key); if (n >= 0) G.sel = n; if (e.key === "-") G.sel = 10; if (e.key === "=") G.sel = 11;
    }
    function onKeyUp(e) { keys[e.code] = false; if (fishing && (e.code === "KeyC" || e.code === "Space")) fishPress(false); }
    function onDocDown(e) { active = host.contains(e.target); if (!active) for (const k in keys) keys[k] = false; }
    document.addEventListener("keydown", onKey); document.addEventListener("keyup", onKeyUp); document.addEventListener("pointerdown", onDocDown, true);
    cv.addEventListener("contextmenu", (e) => e.preventDefault());
    cv.addEventListener("wheel", (e) => { e.preventDefault(); if (G) G.sel = (G.sel + (e.deltaY > 0 ? 1 : 11)) % 12; }, { passive: false });
    cv.addEventListener("pointerdown", (e) => {
      if (!G || menuOpen) return; e.preventDefault(); active = true;
      if (fishing) { fishPress(true); return; }
      const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
      if (hudSlots && my >= hudSlots.y0 && my <= hudSlots.y0 + hudSlots.slot && mx >= hudSlots.x0 && mx <= hudSlots.x0 + hudSlots.slot * 12) { G.sel = Math.floor((mx - hudSlots.x0) / hudSlots.slot); return; }
      const wx = mx / S + camX, wy = my / S + camY, tx = Math.floor(wx / TS), ty = Math.floor(wy / TS);
      const px2 = Math.floor(G.x / TS), py2 = Math.floor((G.y - 4) / TS);
      if (Math.abs(tx - px2) > 1 || Math.abs(ty - py2) > 1 || (tx === px2 && ty === py2)) { say("Too far — move closer.", "#a60"); return; }
      const dx = tx - px2, dy = ty - py2; G.face = Math.abs(dx) >= Math.abs(dy) && dx ? (dx < 0 ? 2 : 3) : (dy < 0 ? 1 : 0);
      const so = G.map === "farm" && G.soil[key(tx, ty)], O = objsOf(G.map)[key(tx, ty)], st = structAt(M(), tx, ty);
      const wantsAct = e.button === 2 || (so && so.crop && ripe(so.crop)) || (O && O.t === "forage") || (st && st.t !== "house") || (st && st.door) || npcs.some((n) => Math.abs(n.x - (tx * TS + 8)) < 14 && Math.abs(n.y - (ty * TS + 12)) < 18);
      if (wantsAct) interact(tx, ty); else useTool(tx, ty);
    });
    cv.addEventListener("pointerup", () => { if (fishing) fishPress(false); });
    host.querySelectorAll(".sv-pad button").forEach((b) => { const d = b.dataset.d; const on = (e) => { e.preventDefault(); keys[d] = true; }, off = () => { keys[d] = false; }; b.addEventListener("pointerdown", on); b.addEventListener("pointerup", off); b.addEventListener("pointerleave", off); b.addEventListener("pointercancel", off); });
    host.querySelectorAll(".sv-btns button").forEach((b) => {
      b.addEventListener("pointerdown", (e) => { e.preventDefault(); if (!G || menuOpen) return; const k = b.dataset.b; if (k === "tool") { if (fishing) fishPress(true); else useTool(); } else if (k === "act") interact(); else openInventory(); });
      b.addEventListener("pointerup", () => { if (fishing && b.dataset.b === "tool") fishPress(false); });
    });

    // ---------------- new game / title ----------------
    function titleScreen() {
      showModal(`<div class="sv-title">Stardew Valley</div><div class="sv-dlg-t">You've inherited your grandfather's old farm in Stardew Valley.</div>
        <label class="sv-l">Your name <input class="sv-in sv-nm" maxlength="14" placeholder="Farmer"></label>
        <label class="sv-l">Farm name <input class="sv-in sv-fm" maxlength="14" placeholder="Sunny"></label>
        <div class="sv-row"><button class="sv-btn sv-ok">Okay</button></div>`, (b) => {
        b.querySelector(".sv-ok").onclick = () => {
          G = newGame(b.querySelector(".sv-nm").value.trim(), b.querySelector(".sv-fm").value.trim()); save(); closeModal(); spawnNPCs();
          dialogue("Mayor Lewis", `Dear ${G.name}, welcome to Pelican Town! Your grandfather's farm has gone wild, but I'm sure you'll whip it into shape. I've left 15 parsnip seeds in your pack — plant them with your hoe, water them every day, and they'll be ready in 4 days. Pierre's General Store in town (east of the farm) sells more seeds. Ship your harvest in the bin next to the house. — Mayor Lewis`, () => { G.letterRead = true; save(); });
        };
      });
    }

    // ---------------- loop ----------------
    function frame(now) {
      if (dead) return;
      if (!document.body.contains(host)) { cleanup(); return; }
      let dt = (now - last) / 1000; last = now; if (dt > 0.1) dt = 0.1;
      update(dt); draw();
      if (G && ((t * 10) | 0) % 150 === 0) save();
      raf = requestAnimationFrame(frame);
    }
    function cleanup() { if (dead) return; dead = true; cancelAnimationFrame(raf); save(); document.removeEventListener("keydown", onKey); document.removeEventListener("keyup", onKeyUp); document.removeEventListener("pointerdown", onDocDown, true); if (ro) ro.disconnect(); }
    const win = body.closest(".win"); if (win) win.addEventListener("wm-cleanup", cleanup);
    if (G) spawnNPCs(); else titleScreen();
    raf = requestAnimationFrame((n) => { last = n; frame(n); });
    host.__sv = {
      get G() { return G; }, get fishing() { return fishing; }, get npcs() { return npcs; }, get menuOpen() { return menuOpen; },
      warp, useTool: (x, y) => { swing = 0; useTool(x, y); }, interact: (x, y) => interact(x, y), endDay, fishPress, step: (s) => { for (let i = 0; i < s * 10; i++) update(0.1); }, facingTile, maps: MAPS, ripe, stageOf,
    };
    return { dispose: cleanup };
  }

  function injectStyles() {
    if (document.getElementById("sv-style")) return;
    const s = document.createElement("style"); s.id = "sv-style";
    s.textContent = `
      .sv { position: relative; width: 100%; height: 100%; overflow: hidden; background: #1a1a1a; user-select: none; -webkit-user-select: none; font-family: Georgia, "Times New Roman", serif; }
      .sv-cv { display: block; width: 100%; height: 100%; touch-action: none; image-rendering: pixelated; }
      .sv-modal[hidden] { display: none !important; }
      .sv-modal { position: absolute; inset: 0; background: rgba(0,0,0,.45); display: grid; place-items: center; z-index: 20; }
      .sv-box { background: #f4dca0; border: 4px solid #8a5a2c; border-radius: 12px; padding: 14px 16px; width: min(460px, 92%); max-height: 88%; overflow: auto; color: #4a2a14; box-shadow: 0 0 0 3px #e8c88a inset, 0 18px 50px rgba(0,0,0,.5); }
      .sv-box.wide { width: min(640px, 94%); }
      .sv-title { font: 900 34px Georgia, serif; text-align: center; color: #5a8a2a; text-shadow: 2px 2px 0 #fff, 4px 4px 0 #8a5a2c; margin-bottom: 8px; }
      .sv-h { font: 700 17px Georgia, serif; display: flex; justify-content: space-between; margin-bottom: 6px; } .sv-gold { color: #a8781a; font-family: monospace; }
      .sv-dlg-t { font-size: 15px; line-height: 1.45; margin: 6px 0; } .sv-dlg-n { font-weight: 700; text-align: right; color: #8a5a2c; }
      .sv-row { display: flex; gap: 8px; justify-content: flex-end; margin-top: 10px; flex-wrap: wrap; }
      .sv-btn { background: #e8b86a; border: 3px solid #8a5a2c; border-radius: 8px; padding: 6px 16px; font: 700 15px Georgia, serif; color: #4a2a14; cursor: pointer; } .sv-btn:hover { background: #ffd28a; }
      .sv-l { display: block; margin: 6px 0; font-size: 14px; } .sv-in { width: 100%; box-sizing: border-box; border: 2px solid #8a5a2c; border-radius: 6px; padding: 6px 8px; font: 15px Georgia, serif; background: #fff8e4; }
      .sv-inv { display: grid; grid-template-columns: repeat(12, minmax(0,1fr)); gap: 3px; }
      .sv-slot { aspect-ratio: 1; background: #e8c88a; border: 2px solid #b8885a; border-radius: 4px; position: relative; padding: 2px; cursor: pointer; } .sv-slot.hb { border-color: #8a5a2c; } .sv-slot.on { box-shadow: 0 0 0 2px #e8402a; } .sv-slot.pick { background: #ffe8a8; }
      .sv-slot canvas { width: 100%; height: 100%; image-rendering: pixelated; } .sv-slot i { position: absolute; right: 2px; bottom: 0; font: 700 11px monospace; color: #fff; text-shadow: 1px 1px 0 #000; font-style: normal; }
      .sv-detail { font-size: 13px; margin-top: 8px; min-height: 18px; }
      .sv-hearts { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 13px; color: #c8203a; } .sv-hearts b { color: #4a2a14; display: inline-block; width: 64px; }
      .sv-shop { display: flex; flex-direction: column; gap: 4px; max-height: 210px; overflow: auto; }
      .sv-buy, .sv-sell { display: flex; align-items: center; gap: 8px; background: #fff3d0; border: 2px solid #b8885a; border-radius: 6px; padding: 4px 8px; cursor: pointer; text-align: left; font: 14px Georgia, serif; color: #4a2a14; }
      .sv-buy:hover, .sv-sell:hover { background: #ffe8a8; } .sv-buy canvas, .sv-sell canvas { width: 28px; height: 28px; image-rendering: pixelated; }
      .sv-buy span, .sv-sell span { flex: 1; display: flex; flex-direction: column; } .sv-buy small { color: #8a6a3a; font-size: 12px; } .sv-buy b, .sv-sell b { font-family: monospace; color: #a8781a; }
      .sv-ship { display: flex; flex-direction: column; gap: 4px; margin: 8px 0; } .sv-ship div { display: flex; justify-content: space-between; border-bottom: 1px dashed #b8885a; padding: 2px 0; } .sv-ship .tot { font-weight: 700; border-bottom: 0; font-size: 17px; }
      .sv-touch { position: absolute; left: 0; right: 0; bottom: 0; height: 128px; pointer-events: none; }
      .sv-pad { position: absolute; left: 14px; bottom: 10px; width: 132px; height: 112px; display: grid; grid-template-areas: ". up ." "left . right" ". down ."; grid-template-columns: repeat(3, 44px); grid-template-rows: repeat(3, 36px); pointer-events: auto; }
      .sv-pad button, .sv-btns button { background: rgba(244,220,160,.85); border: 3px solid #8a5a2c; border-radius: 10px; font-size: 16px; color: #4a2a14; touch-action: none; }
      .sv-pad [data-d=up] { grid-area: up; } .sv-pad [data-d=left] { grid-area: left; } .sv-pad [data-d=right] { grid-area: right; } .sv-pad [data-d=down] { grid-area: down; }
      .sv-btns { position: absolute; right: 50px; bottom: 16px; display: flex; gap: 10px; pointer-events: auto; } .sv-btns button { width: 60px; height: 60px; font-size: 24px; border-radius: 50%; }
    `;
    document.head.appendChild(s);
  }

  window.STARDEW = { start, CROPS };
})();
