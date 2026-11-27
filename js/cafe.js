/* Sip & Bite Café — a Store app for ordering drinks and food in every flavor.
   Tea, coffee, hot chocolate, bubble tea, smoothies, milkshakes, bakery, meals and desserts,
   each with flavors, sizes, milk, sweetness and extras. Pays with (pretend) Forge Bank money,
   tracks the order until it's ready, and earns reward stars. Saves in appData.cafe. */
(function () {
  "use strict";
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  const S = () => window.State && State.data;
  const money = (n) => "$" + n.toFixed(2);

  // ---------- flavor lists (name, color used to draw the drink/food) ----------
  const F = {
    tea: [["Classic Black", "#7a3b12"], ["English Breakfast", "#6b3410"], ["Earl Grey", "#8a4a1c"], ["Green", "#a7b94a"], ["Jasmine Green", "#bdc86a"], ["Matcha", "#7fae3b"], ["Chai", "#b47a45"], ["Dirty Chai", "#93603a"], ["Oolong", "#b0702e"], ["White Peony", "#e7d39a"], ["Chamomile", "#e6c35a"], ["Peppermint", "#9fc77a"], ["Hibiscus Berry", "#b8233f"], ["Lemon Ginger", "#e9c13f"], ["Rooibos Vanilla", "#b5502b"], ["Honey Lavender", "#a58bc4"], ["Peach", "#f0a35a"], ["Mango Passion", "#f2a031"], ["Strawberry Rose", "#e46b80"], ["Thai Tea", "#e48a3a"]],
    coffee: [["Plain", "#5a3420"], ["Vanilla", "#a77a4f"], ["Caramel", "#b06a2c"], ["Hazelnut", "#8e5a33"], ["Mocha (Chocolate)", "#4e2a1a"], ["White Chocolate", "#c9a77d"], ["Cinnamon Dolce", "#a0603a"], ["Pumpkin Spice", "#c4692b"], ["Peppermint Mocha", "#5b2d1f"], ["Toffee Nut", "#9c6a3b"], ["Coconut", "#c8b08a"], ["Brown Sugar Oat", "#93653b"], ["Lavender", "#9f87b8"], ["Maple Pecan", "#9a5b2a"]],
    chocolate: [["Classic Milk Chocolate", "#6b3a1f"], ["Dark Chocolate", "#3b1f12"], ["White Chocolate", "#efe0c6"], ["Mint Chocolate", "#5c3a26"], ["Salted Caramel", "#8a4f24"], ["Peanut Butter", "#9c6a35"], ["Raspberry", "#6e2a33"], ["Orange", "#7a3e1c"], ["Mexican Spiced", "#5a2a14"], ["Hazelnut", "#6a3a1d"], ["Toasted Marshmallow", "#7d5134"], ["Cookies & Cream", "#5a4a44"], ["Ruby Chocolate", "#c25b72"], ["Cherry", "#5e1f24"]],
    boba: [["Classic Milk Tea", "#c9a27a"], ["Brown Sugar", "#8e5a33"], ["Taro", "#b49ad6"], ["Matcha", "#8fbf5a"], ["Thai Tea", "#eb9a52"], ["Strawberry", "#f2a2b5"], ["Mango", "#f5b53c"], ["Honeydew", "#bde09a"], ["Lychee", "#f3e3e8"], ["Chocolate", "#6b3a1f"], ["Coconut", "#efe7d6"], ["Passion Fruit", "#f1b63a"]],
    smoothie: [["Strawberry Banana", "#ef6f7d"], ["Mango Pineapple", "#f6b33c"], ["Mixed Berry", "#8e2f5c"], ["Peach", "#f4a46a"], ["Green Machine", "#7fb54a"], ["Blueberry", "#5b4a9c"], ["Tropical", "#f39a3a"], ["Chocolate Peanut Butter", "#7a4a2a"], ["Acai", "#4a1e3a"], ["Watermelon", "#f27a8a"]],
    shake: [["Vanilla", "#f3e7c9"], ["Chocolate", "#6b3a1f"], ["Strawberry", "#f4a2b0"], ["Cookies & Cream", "#d9d2c9"], ["Mint Chip", "#bfe6c9"], ["Salted Caramel", "#d29a5a"], ["Peanut Butter", "#c69256"], ["Banana", "#f5e08a"], ["Birthday Cake", "#f5d0e6"], ["Coffee", "#a07850"], ["Double Chocolate Fudge", "#3e2014"]],
    cold: [["Lemonade", "#f5e36a"], ["Pink Lemonade", "#f6a6b8"], ["Strawberry Lemonade", "#f07a8a"], ["Iced Peach Tea", "#e8964a"], ["Iced Green Tea", "#b9c95a"], ["Arnold-Style Half & Half", "#d8a24a"], ["Sparkling Raspberry", "#e0506e"], ["Orange Juice", "#f6a32b"], ["Apple Juice", "#e9c35a"], ["Cucumber Mint Water", "#cfe8c6"], ["Cherry Limeade", "#d63b4f"]],
    muffin: [["Blueberry", "#6a5aa8"], ["Chocolate Chip", "#5a3420"], ["Double Chocolate", "#3e2014"], ["Banana Nut", "#c49a5a"], ["Lemon Poppy Seed", "#efd76a"], ["Pumpkin", "#d9822b"], ["Cinnamon Streusel", "#b07a45"]],
    cookie: [["Chocolate Chip", "#c48a4a"], ["Double Chocolate", "#4a2616"], ["Oatmeal Raisin", "#b98a52"], ["Snickerdoodle", "#dcb57c"], ["White Chocolate Macadamia", "#e4c48a"], ["Peanut Butter", "#c8904a"], ["Sugar Cookie", "#f2d9a8"], ["Red Velvet", "#a0263a"]],
    donut: [["Glazed", "#e9b86a"], ["Chocolate Frosted", "#4e2a1a"], ["Strawberry Sprinkle", "#f4a2b5"], ["Boston Cream", "#5a3420"], ["Maple", "#c27a35"], ["Powdered Sugar", "#f3efe8"], ["Jelly", "#b8233f"], ["Cinnamon Sugar", "#c9935a"]],
    croissant: [["Butter", "#e3a95a"], ["Chocolate", "#c08040"], ["Almond", "#d6a56a"], ["Ham & Cheese", "#d99a55"], ["Strawberry Cream", "#e8a07a"]],
    cake: [["Chocolate Fudge", "#3e2014"], ["Red Velvet", "#a8233a"], ["Carrot", "#d9822b"], ["New York Cheesecake", "#f2e3bf"], ["Tiramisu", "#a07850"], ["Lemon", "#f2dd6a"], ["Strawberry Shortcake", "#f4b6c2"], ["Black Forest", "#4a1a1a"], ["Matcha Crepe", "#9cc46a"]],
    macaron: [["Vanilla", "#f3e7c9"], ["Chocolate", "#6b3a1f"], ["Pistachio", "#b7d38a"], ["Raspberry", "#e0506e"], ["Lemon", "#f2dd6a"], ["Lavender", "#b9a3d6"], ["Salted Caramel", "#d29a5a"], ["Coffee", "#a07850"]],
    icecream: [["Vanilla Bean", "#f6ecd2"], ["Chocolate", "#6b3a1f"], ["Strawberry", "#f4a2b5"], ["Mint Chocolate Chip", "#bfe6c9"], ["Cookie Dough", "#e4cfa0"], ["Rocky Road", "#5a3420"], ["Pistachio", "#c4dc9a"], ["Butter Pecan", "#e2c08a"], ["Cookies & Cream", "#d9d2c9"], ["Mango Sorbet", "#f6b33c"], ["Cotton Candy", "#b9d6f6"], ["Coffee", "#a07850"]],
    sandwich: [["Turkey & Swiss", "#e2c08a"], ["Ham & Cheddar", "#e8a07a"], ["BLT", "#d9533a"], ["Caprese (Tomato Mozzarella)", "#e0504a"], ["Chicken Pesto", "#8fbf5a"], ["Grilled Cheese", "#f2b53c"], ["Veggie Hummus", "#c8b08a"]],
    pizza: [["Cheese", "#f2c14e"], ["Pepperoni", "#c8402a"], ["Margherita", "#e0504a"], ["Veggie", "#8fbf5a"], ["BBQ Chicken", "#8a4a24"], ["Hawaiian", "#f2c76a"]],
    breakfast: [["Bacon, Egg & Cheese", "#f2c14e"], ["Sausage, Egg & Cheese", "#c4692b"], ["Veggie Egg White", "#bfe08a"], ["Avocado Toast", "#8fbf5a"], ["Pancakes with Maple", "#d9a05a"], ["Waffles with Berries", "#e2a35a"], ["Oatmeal with Brown Sugar", "#c9a77d"]],
    bowl: [["Mac & Cheese", "#f2b53c"], ["Chicken Noodle Soup", "#e9c96a"], ["Tomato Soup", "#d9533a"], ["Caesar Salad", "#a8c86a"], ["Fruit Cup", "#ef6f7d"], ["Yogurt Parfait", "#f3e7f0"]],
  };
  const SIZES = [["Small", 0], ["Medium", 0.6], ["Large", 1.2]];
  const MILKS = ["Whole", "2%", "Skim", "Oat", "Almond", "Soy", "Coconut", "No milk"];
  const SWEET = ["0%", "25%", "50%", "75%", "100%"];
  // id, category, name, base price, flavor list, kind (cup|boba|tall|plate|bowl|cone), options
  const MENU = [
    ["hot-tea", "Tea", "Hot Tea", 2.75, "tea", "mug", { size: 1, sweet: 1, milk: 1, extras: ["Honey", "Lemon slice", "Extra tea bag"] }],
    ["iced-tea", "Tea", "Iced Tea", 3.15, "tea", "tall", { size: 1, sweet: 1, extras: ["Lemon slice", "Fruit pieces", "Light ice"] }],
    ["tea-latte", "Tea", "Tea Latte", 4.25, "tea", "cup", { size: 1, sweet: 1, milk: 1, temp: 1, extras: ["Whipped cream", "Cinnamon dust", "Extra foam"] }],
    ["hot-choc", "Hot Chocolate", "Hot Chocolate", 3.65, "chocolate", "mug", { size: 1, milk: 1, sweet: 1, extras: ["Whipped cream", "Mini marshmallows", "Chocolate drizzle", "Caramel drizzle", "Sprinkles"] }],
    ["frozen-choc", "Hot Chocolate", "Frozen Hot Chocolate", 4.95, "chocolate", "tall", { size: 1, milk: 1, extras: ["Whipped cream", "Chocolate shavings", "Cookie crumbles"] }],
    ["choc-milk", "Hot Chocolate", "Chocolate Milk", 2.95, "chocolate", "tall", { size: 1, milk: 1 }],
    ["latte", "Coffee", "Latte", 4.45, "coffee", "cup", { size: 1, milk: 1, sweet: 1, temp: 1, extras: ["Extra shot", "Whipped cream", "Caramel drizzle", "Cold foam"] }],
    ["cappuccino", "Coffee", "Cappuccino", 4.15, "coffee", "cup", { size: 1, milk: 1, sweet: 1, extras: ["Extra shot", "Cinnamon dust", "Cocoa dust"] }],
    ["cold-brew", "Coffee", "Cold Brew", 4.25, "coffee", "tall", { size: 1, milk: 1, sweet: 1, extras: ["Sweet cream", "Cold foam", "Extra shot"] }],
    ["frappe", "Coffee", "Blended Frappé", 5.25, "coffee", "tall", { size: 1, milk: 1, extras: ["Whipped cream", "Caramel drizzle", "Chocolate chips"] }],
    ["boba", "Bubble Tea", "Bubble Tea", 5.25, "boba", "boba", { size: 1, sweet: 1, milk: 1, extras: ["Tapioca pearls", "Popping boba", "Lychee jelly", "Pudding", "Cheese foam"] }],
    ["smoothie", "Smoothies & Shakes", "Fruit Smoothie", 5.45, "smoothie", "tall", { size: 1, extras: ["Protein boost", "Chia seeds", "Spinach", "Honey"] }],
    ["shake", "Smoothies & Shakes", "Milkshake", 5.75, "shake", "tall", { size: 1, milk: 1, extras: ["Whipped cream", "Cherry on top", "Sprinkles", "Cookie crumbles", "Hot fudge"] }],
    ["cold", "Cold Drinks", "Lemonade & Juice", 2.95, "cold", "tall", { size: 1, sweet: 1, extras: ["Light ice", "Fresh mint", "Berry boost"] }],
    ["muffin", "Bakery", "Muffin", 2.95, "muffin", "plate", { warm: 1, extras: ["Butter on the side"] }],
    ["cookie", "Bakery", "Cookie", 1.95, "cookie", "plate", { warm: 1 }],
    ["donut", "Bakery", "Donut", 1.75, "donut", "plate", {}],
    ["croissant", "Bakery", "Croissant", 3.25, "croissant", "plate", { warm: 1 }],
    ["macaron", "Bakery", "Macaron", 1.5, "macaron", "plate", {}],
    ["breakfast", "Breakfast", "Breakfast", 5.25, "breakfast", "plate", { warm: 1, extras: ["Hash browns", "Fresh fruit", "Extra bacon"] }],
    ["sandwich", "Lunch", "Sandwich", 7.45, "sandwich", "plate", { warm: 1, extras: ["Chips", "Pickle", "Side salad", "Extra cheese"] }],
    ["pizza", "Lunch", "Pizza Slice", 3.95, "pizza", "plate", { extras: ["Ranch dip", "Garlic knots", "Extra cheese"] }],
    ["bowl", "Lunch", "Soups, Salads & Bowls", 6.25, "bowl", "bowl", { extras: ["Bread roll", "Crackers", "Extra cheese"] }],
    ["cake", "Desserts", "Cake Slice", 4.75, "cake", "plate", { extras: ["Scoop of vanilla ice cream", "Whipped cream", "Fresh berries"] }],
    ["icecream", "Desserts", "Ice Cream", 3.95, "icecream", "cone", { scoops: 1, extras: ["Sprinkles", "Hot fudge", "Caramel", "Waffle cone", "Cherry on top"] }],
  ];
  const CATS = ["Tea", "Hot Chocolate", "Coffee", "Bubble Tea", "Smoothies & Shakes", "Cold Drinks", "Bakery", "Breakfast", "Lunch", "Desserts"];
  const CAT_ICON = { "Tea": "🍵", "Hot Chocolate": "🍫", "Coffee": "☕", "Bubble Tea": "🧋", "Smoothies & Shakes": "🥤", "Cold Drinks": "🍋", "Bakery": "🥐", "Breakfast": "🥞", "Lunch": "🥪", "Desserts": "🍰" };
  const EXTRA_PRICE = 0.6;

  // ---------- pictures (drawn in SVG, tinted by flavor) ----------
  function pic(kind, color, size) {
    size = size || 72; const c = color || "#8a5a33";
    const steam = `<path d="M38 14c-4 5 4 7 0 12M50 12c-4 5 4 7 0 12M62 14c-4 5 4 7 0 12" stroke="#c9ced6" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    const svg = {
      mug: `${steam}<path d="M24 34h52l-5 50a6 6 0 0 1-6 5H35a6 6 0 0 1-6-5z" fill="#fff" stroke="#d6d9de" stroke-width="2"/><path d="M76 44h6a9 9 0 0 1 0 18h-8" fill="none" stroke="#d6d9de" stroke-width="6"/><ellipse cx="50" cy="36" rx="25" ry="5" fill="${c}"/><path d="M28 52h44" stroke="#f05a7e" stroke-width="5" opacity=".75"/>`,
      cup: `${steam}<path d="M26 32h48l-6 56H32z" fill="#f4efe6" stroke="#d6cdbf" stroke-width="2"/><rect x="24" y="26" width="52" height="8" rx="3" fill="#fff" stroke="#d6cdbf" stroke-width="2"/><path d="M30 50h40l-3 22H33z" fill="#2e7d5b"/><circle cx="50" cy="61" r="7" fill="#fff"/><ellipse cx="50" cy="27" rx="20" ry="3" fill="${c}"/>`,
      tall: `<rect x="56" y="6" width="5" height="34" rx="2" fill="#f05a7e" transform="rotate(12 58 23)"/><path d="M28 24h44l-6 66H34z" fill="${c}" opacity=".92"/><path d="M28 24h44l-6 66H34z" fill="none" stroke="#c9d3df" stroke-width="2"/><path d="M32 38h36" stroke="#fff" stroke-width="3" opacity=".5"/><rect x="38" y="44" width="9" height="9" rx="2" fill="#fff" opacity=".45"/><rect x="51" y="58" width="9" height="9" rx="2" fill="#fff" opacity=".4"/><ellipse cx="50" cy="24" rx="23" ry="4" fill="#fff" opacity=".6"/>`,
      boba: `<rect x="48" y="2" width="7" height="40" rx="3" fill="#333" transform="rotate(8 51 22)"/><path d="M26 22h48l-6 68H32z" fill="${c}"/><path d="M26 22h48l-6 68H32z" fill="none" stroke="#c9d3df" stroke-width="2"/>${[[38, 80], [47, 82], [56, 80], [42, 74], [52, 74], [60, 76]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4" fill="#2a1a12"/>`).join("")}<rect x="24" y="18" width="52" height="6" rx="3" fill="#fff" opacity=".8"/>`,
      plate: `<ellipse cx="50" cy="74" rx="40" ry="12" fill="#fff" stroke="#d6d9de" stroke-width="2"/><ellipse cx="50" cy="58" rx="27" ry="20" fill="${c}"/><ellipse cx="44" cy="52" rx="10" ry="5" fill="#fff" opacity=".25"/>${[[40, 60], [55, 50], [58, 64], [47, 66]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.5" fill="#000" opacity=".18"/>`).join("")}`,
      bowl: `${steam}<path d="M16 46h68a34 30 0 0 1-68 0z" fill="#fff" stroke="#d6d9de" stroke-width="2"/><ellipse cx="50" cy="46" rx="34" ry="7" fill="${c}"/><path d="M30 52c6 4 34 4 40 0" stroke="#fff" stroke-width="2" opacity=".4" fill="none"/>`,
      cone: `<path d="M34 52h32L50 94z" fill="#d9a05a" stroke="#b07a35" stroke-width="2"/><path d="M38 58l20 20M44 54l16 16M62 58 42 78" stroke="#b07a35" stroke-width="1.5"/><circle cx="50" cy="40" r="18" fill="${c}"/><circle cx="42" cy="34" r="5" fill="#fff" opacity=".3"/><circle cx="50" cy="22" r="5" fill="#d63b4f"/>`,
    }[kind] || "";
    return `<svg viewBox="0 0 100 100" width="${size}" height="${size}">${svg}</svg>`;
  }

  function store() {
    const d = S(); if (!d) return { cart: [], orders: [], stars: 0, favs: [] };
    if (!d.appData) d.appData = {};
    if (!d.appData.cafe) d.appData.cafe = { cart: [], orders: [], stars: 0, favs: [] };
    const c = d.appData.cafe; c.cart = c.cart || []; c.orders = c.orders || []; c.favs = c.favs || []; c.stars = c.stars || 0;
    return c;
  }
  const save = () => { if (window.State) State.save(); };
  const balance = () => { const d = S(); return d && d.bank ? d.bank.balance : 0; };
  function linePrice(l) { return Math.round(((l.base + l.sizeAdd + l.extras.length * EXTRA_PRICE + (l.scoops ? (l.scoops - 1) * 1.25 : 0)) * l.qty) * 100) / 100; }

  window.AppRegistry = window.AppRegistry || {};
  window.AppRegistry.cafe = function () {
    const ref = window.WM.createWindow({ title: "Sip & Bite Café", icon: window.Icon ? Icon.mini("cafe", "Sip & Bite Café") : "", width: 980, height: 660, appId: "cafe" });
    const body = ref.body; body.classList.add("cafe-host");
    let cat = "Tea", view = "menu", query = "";
    const timers = [];
    const win = body.closest(".win"); if (win) win.addEventListener("wm-cleanup", () => timers.forEach(clearInterval));

    function frame(inner) {
      const c = store(), n = c.cart.reduce((a, l) => a + l.qty, 0);
      body.innerHTML = `<div class="cafe">
        <div class="cafe-top"><div class="cafe-logo"><span>☕</span><div><b>Sip &amp; Bite</b><small>CAFÉ</small></div></div>
          <input class="cafe-search" placeholder="Search drinks, food & flavors (try “tea” or “chocolate”)" value="${esc(query)}">
          <div class="cafe-stars" title="Reward stars — 25 stars = a free drink">⭐ ${c.stars}</div>
          <button class="cafe-nav ${view === "orders" ? "on" : ""}" data-v="orders">🧾 Orders</button>
          <button class="cafe-cartbtn ${view === "cart" ? "on" : ""}" data-v="cart">🛒 Cart${n ? `<span>${n}</span>` : ""}</button></div>
        <div class="cafe-main">${inner}</div></div>`;
      body.querySelectorAll("[data-v]").forEach((b) => b.onclick = () => { view = view === b.dataset.v ? "menu" : b.dataset.v; render(); });
      const s = body.querySelector(".cafe-search");
      s.oninput = () => { query = s.value; view = "menu"; const pos = s.selectionStart; render(); const s2 = body.querySelector(".cafe-search"); s2.focus(); s2.setSelectionRange(pos, pos); };
    }

    function menuView() {
      const q = query.trim().toLowerCase();
      const items = MENU.filter((m) => q ? (m[2].toLowerCase().includes(q) || m[1].toLowerCase().includes(q) || F[m[4]].some(([f]) => f.toLowerCase().includes(q))) : m[1] === cat);
      frame(`<div class="cafe-cats">${CATS.map((c) => `<button class="cafe-cat ${!q && c === cat ? "on" : ""}" data-c="${esc(c)}"><span>${CAT_ICON[c]}</span>${esc(c)}</button>`).join("")}</div>
        <div class="cafe-list"><h2>${q ? "Results for “" + esc(query) + "”" : CAT_ICON[cat] + " " + esc(cat)}</h2>
        <div class="cafe-grid">${items.map((m) => { const fl = F[m[4]]; const match = q ? fl.filter(([f]) => f.toLowerCase().includes(q)) : []; const shown = match.length ? match : fl;
          return `<button class="cafe-item" data-id="${m[0]}"><div class="cafe-pic">${pic(m[5], (match[0] || fl[0])[1], 84)}</div><b>${esc(m[2])}</b><span class="cafe-fl">${fl.length} flavors · ${esc(shown.slice(0, 3).map((x) => x[0]).join(", "))}${shown.length > 3 ? "…" : ""}</span><span class="cafe-price">from ${money(m[3])}</span></button>`; }).join("") || `<p class="cafe-empty">Nothing matches that — try another flavor.</p>`}</div></div>`);
      body.querySelectorAll(".cafe-cat").forEach((b) => b.onclick = () => { cat = b.dataset.c; query = ""; render(); });
      body.querySelectorAll(".cafe-item").forEach((b) => b.onclick = () => customize(MENU.find((m) => m[0] === b.dataset.id)));
    }

    function customize(m, preset) {
      const [id, , name, base, flKey, kind, o] = m; const fl = F[flKey];
      const q = query.trim().toLowerCase(); const qm = q && fl.find(([f]) => f.toLowerCase().includes(q));
      const st = Object.assign({ flavor: (qm || fl[0])[0], size: 1, milk: o.milk ? "Whole" : null, sweet: "50%", temp: "Hot", warm: true, extras: [], qty: 1, scoops: 1 }, preset || {});
      const ov = el(`<div class="cafe-mask"><div class="cafe-sheet"><button class="cafe-x">✕</button><div class="cafe-sheet-in"></div></div></div>`);
      body.appendChild(ov);
      const close = () => ov.remove();
      ov.querySelector(".cafe-x").onclick = close; ov.onclick = (e) => { if (e.target === ov) close(); };
      const opt = (label, key, list) => `<div class="cafe-opt"><div class="cafe-opt-h">${label}</div><div class="cafe-chips">${list.map((v) => `<button class="cafe-chip ${st[key] === v ? "on" : ""}" data-k="${key}" data-v="${esc(v)}">${esc(v)}</button>`).join("")}</div></div>`;
      function line() { return { id, name, flavor: st.flavor, kind, color: (fl.find((f) => f[0] === st.flavor) || fl[0])[1], base, size: o.size ? SIZES[st.size][0] : null, sizeAdd: o.size ? SIZES[st.size][1] : 0, milk: o.milk ? st.milk : null, sweet: o.sweet ? st.sweet : null, temp: o.temp ? st.temp : null, warm: o.warm ? st.warm : null, scoops: o.scoops ? st.scoops : 0, extras: st.extras.slice(), qty: st.qty }; }
      function draw() {
        const l = line(), fav = store().favs.includes(id + "|" + st.flavor);
        ov.querySelector(".cafe-sheet-in").innerHTML = `<div class="cafe-sh-head"><div class="cafe-pic big">${pic(kind, l.color, 130)}</div><div><h2>${esc(st.flavor)} ${esc(name)}</h2><p>${fl.length} flavors to choose from</p><button class="cafe-fav ${fav ? "on" : ""}">${fav ? "♥ Favorite" : "♡ Add to favorites"}</button></div></div>
          <div class="cafe-opt"><div class="cafe-opt-h">Flavor</div><div class="cafe-flavors">${fl.map(([f, c]) => `<button class="cafe-flv ${st.flavor === f ? "on" : ""}" data-f="${esc(f)}"><i style="background:${c}"></i>${esc(f)}</button>`).join("")}</div></div>
          ${o.size ? `<div class="cafe-opt"><div class="cafe-opt-h">Size</div><div class="cafe-chips">${SIZES.map(([s, a], i) => `<button class="cafe-chip ${st.size === i ? "on" : ""}" data-size="${i}">${s}${a ? " +" + money(a) : ""}</button>`).join("")}</div></div>` : ""}
          ${o.temp ? opt("Hot or iced", "temp", ["Hot", "Iced"]) : ""}
          ${o.milk ? opt("Milk", "milk", MILKS) : ""}
          ${o.sweet ? opt("Sweetness", "sweet", SWEET) : ""}
          ${o.warm ? `<div class="cafe-opt"><label class="cafe-check"><input type="checkbox" class="cafe-warm" ${st.warm ? "checked" : ""}> Warm it up</label></div>` : ""}
          ${o.scoops ? `<div class="cafe-opt"><div class="cafe-opt-h">Scoops</div><div class="cafe-chips">${[1, 2, 3].map((n) => `<button class="cafe-chip ${st.scoops === n ? "on" : ""}" data-scoops="${n}">${n}${n > 1 ? " +" + money((n - 1) * 1.25) : ""}</button>`).join("")}</div></div>` : ""}
          ${o.extras ? `<div class="cafe-opt"><div class="cafe-opt-h">Extras <small>+${money(EXTRA_PRICE)} each</small></div><div class="cafe-chips">${o.extras.map((x) => `<button class="cafe-chip ${st.extras.includes(x) ? "on" : ""}" data-x="${esc(x)}">${esc(x)}</button>`).join("")}</div></div>` : ""}
          <div class="cafe-sh-foot"><div class="cafe-qty"><button data-q="-1">−</button><span>${st.qty}</span><button data-q="1">+</button></div><button class="cafe-add">${preset && preset.edit != null ? "Update" : "Add to cart"} · ${money(linePrice(l))}</button></div>`;
        const sh = ov.querySelector(".cafe-sheet-in");
        sh.querySelectorAll(".cafe-flv").forEach((b) => b.onclick = () => { st.flavor = b.dataset.f; draw(); });
        sh.querySelectorAll("[data-size]").forEach((b) => b.onclick = () => { st.size = +b.dataset.size; draw(); });
        sh.querySelectorAll("[data-scoops]").forEach((b) => b.onclick = () => { st.scoops = +b.dataset.scoops; draw(); });
        sh.querySelectorAll("[data-k]").forEach((b) => b.onclick = () => { st[b.dataset.k] = b.dataset.v; draw(); });
        sh.querySelectorAll("[data-x]").forEach((b) => b.onclick = () => { const x = b.dataset.x, i = st.extras.indexOf(x); if (i >= 0) st.extras.splice(i, 1); else st.extras.push(x); draw(); });
        sh.querySelectorAll("[data-q]").forEach((b) => b.onclick = () => { st.qty = Math.max(1, Math.min(9, st.qty + +b.dataset.q)); draw(); });
        const w = sh.querySelector(".cafe-warm"); if (w) w.onchange = () => { st.warm = w.checked; };
        sh.querySelector(".cafe-fav").onclick = () => { const f = store().favs, k = id + "|" + st.flavor, i = f.indexOf(k); if (i >= 0) f.splice(i, 1); else f.push(k); save(); draw(); };
        sh.querySelector(".cafe-add").onclick = () => {
          const c = store(); const l2 = line();
          if (preset && preset.edit != null) c.cart[preset.edit] = l2; else c.cart.push(l2);
          save(); close(); if (window.Notify && !(preset && preset.edit != null)) Notify.show({ icon: window.Icon ? Icon.mini("cafe", "Café") : "", title: "Added to cart", body: l2.qty + "× " + l2.flavor + " " + l2.name });
          render();
        };
      }
      draw();
    }

    function desc(l) { return [l.size, l.temp, l.milk && l.milk !== "Whole" ? l.milk + " milk" : null, l.sweet && l.sweet !== "50%" ? l.sweet + " sweet" : null, l.warm ? "warmed" : null, l.scoops > 1 ? l.scoops + " scoops" : null].concat(l.extras).filter(Boolean).join(" · "); }

    function cartView() {
      const c = store(); const sub = c.cart.reduce((a, l) => a + linePrice(l), 0); const tax = Math.round(sub * 0.08 * 100) / 100;
      const freeOk = c.stars >= 25 && c.cart.some((l) => MENU.find((m) => m[0] === l.id)[5] !== "plate" && MENU.find((m) => m[0] === l.id)[5] !== "bowl");
      frame(`<div class="cafe-list"><h2>🛒 Your cart</h2>${c.cart.length ? `<div class="cafe-lines">${c.cart.map((l, i) => `<div class="cafe-line"><div class="cafe-pic">${pic(l.kind, l.color, 56)}</div><div class="cafe-line-t"><b>${l.qty}× ${esc(l.flavor)} ${esc(l.name)}</b><span>${esc(desc(l))}</span></div><b>${money(linePrice(l))}</b><button class="cafe-edit" data-i="${i}">Edit</button><button class="cafe-rm" data-i="${i}">✕</button></div>`).join("")}</div>
        <div class="cafe-total"><label class="cafe-check ${freeOk ? "" : "dis"}"><input type="checkbox" class="cafe-free" ${freeOk ? "" : "disabled"}> Use 25 ⭐ for a free drink ${freeOk ? "" : "(need 25 stars and a drink)"}</label>
          <div><span>Subtotal</span><b>${money(sub)}</b></div><div><span>Tax</span><b>${money(tax)}</b></div><div class="cafe-free-row" hidden><span>Free drink</span><b class="cafe-free-amt"></b></div><div class="big"><span>Total</span><b class="cafe-tot">${money(sub + tax)}</b></div>
          <div class="cafe-bal">Paying with Forge Bank · balance ${money(balance())}</div>
          <button class="cafe-pay">Place order</button></div>` : `<p class="cafe-empty">Your cart is empty. Pick something tasty from the menu!</p>`}</div>`);
      body.querySelectorAll(".cafe-rm").forEach((b) => b.onclick = () => { c.cart.splice(+b.dataset.i, 1); save(); render(); });
      body.querySelectorAll(".cafe-edit").forEach((b) => b.onclick = () => { const l = c.cart[+b.dataset.i]; const m = MENU.find((x) => x[0] === l.id); customize(m, { flavor: l.flavor, size: Math.max(0, SIZES.findIndex((s) => s[0] === l.size)), milk: l.milk, sweet: l.sweet || "50%", temp: l.temp || "Hot", warm: l.warm !== false, extras: l.extras.slice(), qty: l.qty, scoops: l.scoops || 1, edit: +b.dataset.i }); });
      const pay = body.querySelector(".cafe-pay"); if (!pay) return;
      const free = body.querySelector(".cafe-free");
      let freeAmt = 0;
      const recalc = () => {
        freeAmt = 0;
        if (free && free.checked) { const drinks = c.cart.filter((l) => !["plate", "bowl"].includes(l.kind)); const top = drinks.reduce((a, l) => Math.max(a, linePrice(l) / l.qty), 0); freeAmt = Math.round(top * 100) / 100; }
        const row = body.querySelector(".cafe-free-row"); row.hidden = !freeAmt; body.querySelector(".cafe-free-amt").textContent = "−" + money(freeAmt);
        body.querySelector(".cafe-tot").textContent = money(Math.max(0, sub + tax - freeAmt));
      };
      if (free) free.onchange = recalc;
      pay.onclick = () => {
        const total = Math.max(0, Math.round((sub + tax - freeAmt) * 100) / 100);
        if (balance() < total) { alert("Not enough money in Forge Bank. Claim your daily bonus in the Forge Bank app first."); return; }
        if (total > 0 && window.State && State.addTransaction) State.addTransaction({ vendor: "Sip & Bite Café", item: c.cart.reduce((a, l) => a + l.qty, 0) + " item order", amount: total, refundable: false });
        const earned = Math.floor(total);
        c.stars = c.stars - (freeAmt ? 25 : 0) + earned;
        const name = (S().profile && S().profile.username) || "Guest";
        const order = { id: "SB" + String(Date.now()).slice(-5), items: c.cart.slice(), total, placed: Date.now(), readyAt: Date.now() + 15000 + c.cart.length * 3000, name, stars: earned };
        c.orders.unshift(order); c.orders = c.orders.slice(0, 30); c.cart = []; save();
        view = "orders"; render();
      };
    }

    function stage(o) { const t = Date.now(), span = o.readyAt - o.placed, p = Math.min(1, (t - o.placed) / span); return { p, label: p >= 1 ? "Ready for pickup!" : p > 0.66 ? "Finishing up…" : p > 0.25 ? "Making your order…" : "Order received" }; }

    function ordersView() {
      const c = store();
      frame(`<div class="cafe-list"><h2>🧾 Your orders</h2>${c.orders.length ? c.orders.map((o) => { const s = stage(o); return `<div class="cafe-order ${s.p >= 1 ? "ready" : ""}"><div class="cafe-o-h"><b>Order ${esc(o.id)}</b><span>${new Date(o.placed).toLocaleString()}</span><b>${money(o.total)}</b></div>
        <div class="cafe-o-items">${o.items.map((l) => `<span class="cafe-o-it">${pic(l.kind, l.color, 34)}${l.qty}× ${esc(l.flavor)} ${esc(l.name)}</span>`).join("")}</div>
        <div class="cafe-track"><div style="width:${Math.round(s.p * 100)}%"></div></div><div class="cafe-o-st">${s.p >= 1 ? `🔔 “${esc(o.name)}, your order is ready!”` : esc(s.label)} <span>+${o.stars} ⭐</span></div>
        <button class="cafe-again" data-o="${esc(o.id)}">Order again</button></div>`; }).join("") : `<p class="cafe-empty">No orders yet.</p>`}</div>`);
      body.querySelectorAll(".cafe-again").forEach((b) => b.onclick = () => { const o = c.orders.find((x) => x.id === b.dataset.o); c.cart = c.cart.concat(JSON.parse(JSON.stringify(o.items))); save(); view = "cart"; render(); });
    }

    function render() { if (view === "cart") cartView(); else if (view === "orders") ordersView(); else menuView(); }

    // Tick active orders: refresh the tracker and announce when ready.
    timers.push(setInterval(() => {
      if (!body.isConnected) return;
      const c = store(); let changed = false;
      c.orders.forEach((o) => { if (!o.announced && Date.now() >= o.readyAt) { o.announced = true; changed = true; if (window.Notify) Notify.show({ icon: window.Icon ? Icon.mini("cafe", "Café") : "", title: "Sip & Bite Café", body: o.name + ", your order " + o.id + " is ready for pickup! 🔔" }); } });
      if (changed) save();
      if (view === "orders" && c.orders.some((o) => Date.now() < o.readyAt + 1500)) ordersView();
    }, 1000));
    render();
  };
  window.Cafe = { MENU, FLAVORS: F, CATS };
})();
