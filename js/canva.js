/* Canva — a lightweight design tool. Pick a design type, drop text/shapes on a
   canvas, drag & recolor them, and "download". Designs persist in appData.canva. */
(function () {
  "use strict";
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  const S = () => State.data;
  const cw = (o) => window.WM.createWindow(o);
  let cvKeyHandler = null;   // document keydown listener for the open editor (shortcuts)

  const TYPES = [
    { id: "pres", name: "Presentation", w: 720, h: 405, img: "assets/cv_presentation.png", c: "#f2542d" },
    { id: "ig", name: "Social media", w: 520, h: 520, img: "assets/cv_social.png", c: "#f22e63" },
    { id: "video", name: "Video", w: 720, h: 405, emoji: "🎥", c: "#a533ff" },
    { id: "poster", name: "Poster", w: 420, h: 594, emoji: "🖼️", c: "#0aa5b5" },
    { id: "doc", name: "Doc", w: 560, h: 420, emoji: "📄", c: "#2b83f6" },
    { id: "whiteboard", name: "Whiteboard", w: 700, h: 460, emoji: "🧮", c: "#22b573" },
    { id: "logo", name: "Logo", w: 480, h: 480, emoji: "✨", c: "#7b2ae8" },
    { id: "story", name: "Story", w: 360, h: 640, emoji: "📱", c: "#e8478b" },
    { id: "website", name: "Website", w: 720, h: 460, emoji: "🌐", c: "#2e6bff" },
    { id: "email", name: "Email", w: 560, h: 640, emoji: "✉️", c: "#4453d6" },
  ];
  const TEMPLATES = [
    { name: "Sunset Sale", type: "ig", bg: "linear-gradient(135deg,#ff7e5f,#feb47b)", els: [{ t: "text", x: 60, y: 180, text: "BIG SALE", size: 64, color: "#fff", bold: true }, { t: "text", x: 60, y: 270, text: "Up to 50% off", size: 26, color: "#fff" }] },
    { name: "Ocean Deck", type: "pres", bg: "linear-gradient(135deg,#2193b0,#6dd5ed)", els: [{ t: "text", x: 60, y: 150, text: "Q3 Review", size: 52, color: "#fff", bold: true }, { t: "text", x: 60, y: 230, text: "Team Update", size: 24, color: "#eaf6ff" }] },
    { name: "Neon Logo", type: "logo", bg: "#12121a", els: [{ t: "circle", x: 160, y: 120, w: 160, h: 160, color: "#7b5cff" }, { t: "text", x: 150, y: 320, text: "NOVA", size: 48, color: "#fff", bold: true }] },
    { name: "Party Poster", type: "poster", bg: "linear-gradient(135deg,#8e2de2,#4a00e0)", els: [{ t: "text", x: 40, y: 120, text: "FRIDAY", size: 60, color: "#ffd54a", bold: true }, { t: "text", x: 40, y: 220, text: "Night Vibes", size: 30, color: "#fff" }, { t: "rect", x: 40, y: 300, w: 300, h: 6, color: "#ffd54a" }] },
    { name: "Minimal Story", type: "story", bg: "#f4f1ea", els: [{ t: "text", x: 40, y: 260, text: "new drop", size: 40, color: "#222", bold: true }, { t: "text", x: 40, y: 330, text: "shop now →", size: 22, color: "#a06a3a" }] },
    { name: "Clean Doc", type: "doc", bg: "#ffffff", els: [{ t: "text", x: 50, y: 60, text: "Project Brief", size: 36, color: "#111", bold: true }, { t: "text", x: 50, y: 140, text: "Overview and goals for the new launch.", size: 18, color: "#555" }] },
  ];

  // Draggable graphics available under the Elements panel — click to drop on the canvas.
  const ELEMENTS = [
    { name: "Loading bar", src: "assets/cv_el_loadbar.png" },
    { name: "TikTok", src: "assets/cv_el_tiktok.png" },
    { name: "TikTok wide", src: "assets/cv_el_tiktok_wide.png" },
    { name: "Telegram", src: "assets/cv_el_telegram.png" },
    { name: "Like", src: "assets/cv_el_like.png" },
    { name: "Snapchat", src: "assets/cv_el_snapchat.png" },
    { name: "LEGO", src: "assets/cv_el_lego.png" },
    { name: "Crown", src: "assets/cv_el_crown_blue.png" },
    { name: "Gold crown", src: "assets/cv_el_crown_gold.png" },
    { name: "Tree", src: "assets/cv_el_tree.png" },
    { name: "Alien", src: "assets/cv_el_alien.png" },
    { name: "Owl", src: "assets/cv_el_owl.png" },
    { name: "Campfire", src: "assets/cv_el_campfire.png" },
    { name: "? Block", src: "assets/cv_el_qblock.png" },
    { name: "Cupcake", src: "assets/cv_el_cupcake.png" },
    { name: "Cupcakes", src: "assets/cv_el_cupcakes.png" },
    { name: "Cake", src: "assets/cv_el_cake.png" },
    { name: "Ping pong", src: "assets/cv_el_pingpong.png" },
    { name: "Fish", src: "assets/cv_el_fish_orange.png" },
    { name: "Blue fish", src: "assets/cv_el_fish_blue.png" },
    { name: "Poop", src: "assets/cv_el_poop.png" },
    { name: "Rainbow", src: "assets/cv_el_rainbow.png" },
    { name: "Toad", src: "assets/cv_el_toad.png" },
    { name: "Flower", src: "assets/cv_el_flower.png" },
    { name: "Rainbow", src: "assets/cv_el_rainbowcloud.png" },
    { name: "Cat", src: "assets/cv_el_cat.png" },
    { name: "Paw", src: "assets/cv_el_paw.png" },
    { name: "Dog bowl", src: "assets/cv_el_dogbowl.png" },
    { name: "Candy corn", src: "assets/cv_el_candycorn.png" },
    { name: "Candle", src: "assets/cv_el_candle.png" },
    { name: "Computer", src: "assets/cv_el_computer.png" },
    { name: "Laptop", src: "assets/cv_el_laptop.png" },
    { name: "Pizza", src: "assets/cv_el_pizza.png" },
    { name: "Kiss", src: "assets/cv_el_kiss.png" },
    { name: "Thinking", src: "assets/cv_el_thinking.png" },
    { name: "Laugh", src: "assets/cv_el_laugh.png" },
    { name: "Bird", src: "assets/cv_el_bird.png" },
    { name: "Sheep", src: "assets/cv_el_sheep.png" },
    { name: "Monkey", src: "assets/cv_el_monkey.png" },
    { name: "Daisy", src: "assets/cv_el_daisy.png" },
    { name: "Pink flower", src: "assets/cv_el_flower_pink.png" },
    { name: "Green tree", src: "assets/cv_el_tree2.png" },
    { name: "Dog", src: "assets/cv_el_dog.png" },
    { name: "Cat 2", src: "assets/cv_el_cat2.png" },
    { name: "Netflix", src: "assets/cv_el_netflix.png" },
    { name: "Netflix N", src: "assets/cv_el_netflix_n.png" },
  ];

  // Picture frames — shaped placeholders you drop a photo into.
  const FRAMES = [{ shape: "square", name: "Square" }, { shape: "rounded", name: "Rounded" }, { shape: "circle", name: "Circle" }, { shape: "heart", name: "Heart" }];

  // Cohesive style palettes used by Canva AI (Change style / Redesign / generate).
  const STYLE_SETS = [
    { bg: "linear-gradient(135deg,#2193b0,#6dd5ed)", colors: ["#ffffff", "#ffd54a", "#0b3954"] },
    { bg: "#12121a", colors: ["#7b5cff", "#ff5a5f", "#ffffff"] },
    { bg: "linear-gradient(135deg,#ff9a9e,#fecfef)", colors: ["#7a2048", "#ffffff", "#ff5a5f"] },
    { bg: "linear-gradient(135deg,#11998e,#38ef7d)", colors: ["#053225", "#ffffff", "#ffd54a"] },
    { bg: "#faf3e0", colors: ["#e07a5f", "#3d405b", "#81b29a"] },
    { bg: "linear-gradient(135deg,#8e2de2,#4a00e0)", colors: ["#ffd54a", "#ffffff", "#ff5a5f"] },
  ];
  const rand = (a) => a[Math.floor(Math.random() * a.length)];

  // Element animation presets (map to CSS @keyframes cv-anim-<id>).
  const ANIMS = [
    { id: "fade", name: "Fade" }, { id: "rise", name: "Rise" }, { id: "pan", name: "Pan" }, { id: "pop", name: "Pop" },
    { id: "tumble", name: "Tumble" }, { id: "bounce", name: "Bounce" }, { id: "breathe", name: "Breathe" }, { id: "drift", name: "Drift" },
  ];

  // Left editor rail — mirrors Canva's icon rail. `svg` is the inner markup of a 24×24 line icon.
  const RAIL = [
    { id: "templates", label: "Templates", svg: `<rect x="4" y="4" width="16" height="16" rx="2"/><line x1="12" y1="4" x2="12" y2="20"/><line x1="12" y1="12" x2="20" y2="12"/>` },
    { id: "elements", label: "Elements", svg: `<path d="M6 3.5 2 11h8z"/><rect x="13" y="3" width="8" height="8" fill="currentColor" stroke="none"/><circle cx="11.5" cy="17" r="5.5" fill="currentColor" stroke="none"/>` },
    { id: "text", label: "Text", svg: `<path d="M5 6h14"/><path d="M12 6v13"/><path d="M9 19h6"/>` },
    { id: "brand", label: "Brand", pro: true, svg: `<ellipse cx="12" cy="12" rx="7" ry="5"/><path d="M9 12a3 3 0 0 1 6 0"/><path d="M9 12v-1.5"/><path d="M15 12v-1.5"/>` },
    { id: "ai", label: "Canva AI", svg: `<path d="M14 6a4 4 0 1 0 0 8"/><path d="M18 4l.7 1.8L20.5 6.5 18.7 7.2 18 9l-.7-1.8L15.5 6.5 17.3 5.8z"/>` },
    { id: "uploads", label: "Uploads", svg: `<path d="M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3"/><path d="M12 15V4"/><path d="M8 8l4-4 4 4"/>` },
    { id: "tools", label: "Tools", svg: `<path d="M4 20l7-7"/><path d="M13 6l5 5"/><path d="M11 8l5 5 3-3a3 3 0 0 0-4-4z"/>` },
    { id: "projects", label: "Projects", svg: `<path d="M4 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/>` },
    { id: "apps", label: "Apps", svg: `<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M17 14v6M14 17h6"/>` },
    { id: "components", label: "Components", svg: `<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/>` },
    { id: "audio", label: "Audio", svg: `<circle cx="7" cy="17" r="2.5"/><circle cx="17" cy="15" r="2.5"/><path d="M9.5 17V7l10-2v10"/>` },
    { id: "videos", label: "Videos", svg: `<rect x="4" y="6" width="16" height="12" rx="2"/><path d="M10 9l5 3-5 3z"/>` },
    { id: "background", label: "Background", svg: `<path d="M4 8L8 4M4 13L13 4M4 19L19 4M9 20L20 9M14 20L20 14M18 20L20 18"/>` },
    { id: "bulk", label: "Bulk create", svg: `<rect x="7" y="7" width="12" height="12" rx="2"/><path d="M5 15V6a1 1 0 0 1 1-1h9"/><path d="M13 11v4M11 13h4"/>` },
    { id: "translate", label: "Translate", svg: `<path d="M4 6h8M8 4v2M6 6c0 4-2 6-2 6M5 8c0 2 3 4 5 4"/><path d="M13 20l4-9 4 9M14.5 17h5"/>` },
    { id: "charts", label: "Charts", svg: `<path d="M5 5v14h14"/><rect x="8" y="11" width="2.5" height="5"/><rect x="12.5" y="8" width="2.5" height="8"/><rect x="17" y="13" width="2.5" height="3"/>` },
  ];

  function store() { if (!S().appData) S().appData = {}; if (!S().appData.canva) S().appData.canva = { designs: [] }; if (!S().appData.canva.designs) S().appData.canva.designs = []; const c = S().appData.canva; if (!c.profile) c.profile = {}; return c; }
  function profileName() { const st = store(); return st.profile.name || (S().profile && S().profile.username) || (S().account && S().account.name) || "You"; }
  function profileEmail() { const st = store(); return st.profile.email || (S().account && S().account.email) || (S().profile && S().profile.email) || "you@example.com"; }
  function profilePhoto() { const st = store(); return st.profile.photo || (S().profile && S().profile.picture) || null; }

  // Canva Pro (premium). Gate features behind a paid subscription (fake money via Pay).
  function isPremium() { return !!store().premium; }
  function requirePremium(cb) { if (isPremium()) return cb(); premiumModal(cb); }
  function premiumModal(cb) {
    const ov = el(`<div class="pay-mask cv-prem-mask">
      <div class="cv-prem">
        <div class="cv-prem-hero">
          <img src="assets/cv_pro.png?v=1" class="cv-prem-crown" alt="Pro">
          <div class="cv-prem-title">Canva Pro</div>
          <div class="cv-prem-sub">Unlock premium design tools</div>
        </div>
        <ul class="cv-prem-feats">
          <li>Upload your own fonts</li>
          <li>Premium templates &amp; elements</li>
          <li>One-click Background Remover</li>
          <li>100 GB of cloud storage</li>
        </ul>
        <div class="cv-prem-price"><b>$12.99</b> <span>/ month</span></div>
        <button class="cv-prem-buy">Upgrade to Canva Pro</button>
        <button class="cv-prem-cancel">Maybe later</button>
      </div>
    </div>`);
    const close = () => ov.remove();
    ov.querySelector(".cv-prem-cancel").onclick = close;
    ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
    ov.querySelector(".cv-prem-buy").onclick = () => {
      close();
      window.Pay.ensureCard(() => {
        const st = store(); st.premium = true; State.save();
        if (window.Notify) Notify.show({ icon: window.Icon ? Icon.mini("canva", "Canva") : "", title: "Canva Pro", body: "You're on Canva Pro 🎉 Premium features unlocked." });
        cb();
      });
    };
    document.getElementById("screen").appendChild(ov);
  }

  function isOffline() { const q = S().appData && S().appData.quickSettings; return q ? !q.wifi : false; }
  function boot(body, ref) { if (isOffline()) offlineScreen(body, ref); else home(body, ref); }

  function open(createWindow) {
    const make = createWindow || window.WM.createWindow;
    const ref = make({ title: "Canva", icon: window.Icon ? Icon.mini("canva", "Canva") : "", width: 1000, height: 660, appId: "canva" });
    boot(ref.body, ref);
    return ref;
  }

  // Shown when Wi-Fi is off — Canva can't reach its servers.
  function offlineScreen(body, ref) {
    const ray = (Math.random().toString(16).slice(2, 8) + Math.random().toString(16).slice(2, 8)).slice(0, 12) + "-ORD";
    body.innerHTML = `<div class="cv cv-offline">
      <div class="cv-off-top">
        <img class="cv-off-logo" src="assets/canva_wordmark.png?v=1" alt="Canva">
        <h1 class="cv-off-h">We couldn't load this page</h1>
        <p class="cv-off-sub">Reloading the page often helps. If it keeps happening, check our <a class="cv-off-link">status page</a> for known issues.</p>
        <div class="cv-off-err">Error: 400 • Ray ID: ${ray}</div>
        <button class="cv-off-reload">Reload</button>
      </div>
      <svg class="cv-off-art" viewBox="0 0 400 170" preserveAspectRatio="xMidYMax slice">
        <defs><pattern id="cvStripe" width="12" height="12" patternTransform="rotate(45)" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#4b2fd6"/><rect width="6" height="12" fill="#ffcf3f"/></pattern></defs>
        <g fill="#e2f2fb"><ellipse cx="55" cy="72" rx="58" ry="34"/><ellipse cx="120" cy="84" rx="52" ry="30"/><ellipse cx="335" cy="60" rx="62" ry="36"/><ellipse cx="385" cy="86" rx="46" ry="28"/></g>
        <path d="M0 150 Q80 104 175 145 T400 140 L400 170 L0 170Z" fill="#66bd63"/>
        <path d="M0 162 Q120 124 245 158 T400 152 L400 170 L0 170Z" fill="#3f9e46"/>
        <g><rect x="188" y="112" width="6" height="54" fill="#cfe0f0"/><rect x="210" y="112" width="6" height="54" fill="#cfe0f0"/><rect x="174" y="112" width="56" height="14" rx="3" fill="url(#cvStripe)"/><rect x="174" y="131" width="56" height="14" rx="3" fill="url(#cvStripe)"/><circle cx="180" cy="109" r="6" fill="#ff5a5f"/><circle cx="224" cy="109" r="6" fill="#ff5a5f"/></g>
      </svg>
    </div>`;
    body.querySelector(".cv-off-reload").onclick = () => boot(body, ref);
    body.querySelector(".cv-off-link").onclick = (e) => { e.preventDefault(); if (window.Notify) Notify.show({ icon: window.Icon ? Icon.mini("canva", "Canva") : "", title: "Canva Status", body: "All systems operational." }); };
  }

  function home(body, ref) {
    body.classList.add("cv-host");
    const recents = store().designs;
    body.innerHTML = `<div class="cv">
      <aside class="cv-side">
        <div class="cv-brand"><img class="cv-wordmark" src="assets/canva_wordmark.png?v=1" alt="Canva"></div>
        <button class="cv-nav cv-nav-home on"><span class="cv-home-ic"><svg class="cv-ic-out" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10.6 10.6 4.3a2 2 0 0 1 2.8 0L20 10.6V19a1.5 1.5 0 0 1-1.5 1.5H15V16a3 3 0 0 0-6 0v4.5H5.5A1.5 1.5 0 0 1 4 19z"/></svg><svg class="cv-ic-fill" viewBox="0 0 24 24" fill="currentColor"><path d="M4 10.6 10.6 4.3a2 2 0 0 1 2.8 0L20 10.6V19a1.5 1.5 0 0 1-1.5 1.5H15V16a3 3 0 0 0-6 0v4.5H5.5A1.5 1.5 0 0 1 4 19z"/></svg></span> Home</button>
        <button class="cv-nav">📁 Projects</button>
        <button class="cv-nav">✨ Brand</button>
        <button class="cv-nav">📐 Templates</button>
        <button class="cv-nav cv-nav-more">••• More</button>
        <button class="cv-new">＋ Create a design</button>
        <button class="cv-profile"><span class="cv-avatar">${profilePhoto() ? `<img src="${esc(profilePhoto())}" alt="">` : esc(profileName()[0].toUpperCase())}</span><span class="cv-profile-n">${esc(profileName())}</span></button>
      </aside>
      <main class="cv-main">
        <div class="cv-hero"><img class="cv-banner" src="assets/canva_banner${Math.random() < 0.5 ? 1 : 2}.jpg?v=1" alt=""><input class="cv-search" placeholder="Search anything"></div>
        <div class="cv-types"></div>
        <h2 class="cv-h">Templates for you</h2>
        <div class="cv-tpls"></div>
        <h2 class="cv-h">${recents.length ? "Continue designing" : "Start designing"}</h2>
        ${recents.length ? `<div class="cv-recents"></div>` : `<div class="cv-empty-note">Your recent designs will show up here.</div>`}
      </main>
    </div>`;
    const typesEl = body.querySelector(".cv-types");
    TYPES.forEach((t) => {
      const ic = t.img ? `<span class="cv-type-ic cv-type-img"><img src="${t.img}?v=2" alt=""></span>` : `<span class="cv-type-ic" style="background:${t.c}">${t.emoji}</span>`;
      const c = el(`<button class="cv-type">${ic}<span>${esc(t.name)}</span></button>`);
      c.onclick = () => editor(body, ref, { type: t.id, bg: "#ffffff", els: [], name: "Untitled " + t.name });
      typesEl.appendChild(c);
    });
    const tplEl = body.querySelector(".cv-tpls");
    TEMPLATES.forEach((tp) => {
      const ty = TYPES.find((x) => x.id === tp.type);
      const card = el(`<button class="cv-tpl"><div class="cv-tpl-thumb" style="background:${tp.bg};aspect-ratio:${ty.w}/${ty.h}"></div><span>${esc(tp.name)}</span></button>`);
      // mini preview of the template's text
      const thumb = card.querySelector(".cv-tpl-thumb");
      tp.els.filter((e) => e.t === "text").slice(0, 1).forEach((e) => { const s = document.createElement("span"); s.className = "cv-tpl-txt"; s.textContent = e.text; s.style.color = e.color; thumb.appendChild(s); });
      card.onclick = () => editor(body, ref, { type: tp.type, bg: tp.bg, els: JSON.parse(JSON.stringify(tp.els)), name: tp.name });
      tplEl.appendChild(card);
    });
    if (recents.length) {
      const rEl = body.querySelector(".cv-recents");
      recents.forEach((d, i) => {
        const ty = TYPES.find((x) => x.id === d.type) || TYPES[0];
        const card = el(`<button class="cv-tpl"><div class="cv-tpl-thumb" style="background:${d.bg};aspect-ratio:${ty.w}/${ty.h}"></div><span>${esc(d.name || "Design")}</span></button>`);
        card.onclick = () => editor(body, ref, d, i);
        rEl.appendChild(card);
      });
    }
    // Create a design → a picker of design types (not a random one).
    body.querySelector(".cv-new").onclick = (ev) => {
      body.querySelectorAll(".cv-create-menu, .cv-more-menu").forEach((m) => m.remove());
      const r = ev.currentTarget.getBoundingClientRect(), cvR = body.querySelector(".cv").getBoundingClientRect();
      const menu = el(`<div class="cv-create-menu" style="left:${r.left - cvR.left}px;top:${r.bottom - cvR.top + 6}px">
        <div class="cv-cm-search"><input placeholder="Search designs"></div>
        <div class="cv-cm-list">${TYPES.map((t) => `<button class="cv-cm-item" data-t="${t.id}"><span class="cv-cm-ic" style="background:${t.img ? "transparent" : t.c}">${t.img ? `<img src="${t.img}?v=2" alt="">` : t.emoji}</span><span class="cv-cm-meta"><span>${esc(t.name)}</span><span class="cv-cm-dim">${t.w} × ${t.h} px</span></span></button>`).join("")}</div>
      </div>`);
      menu.querySelectorAll(".cv-cm-item").forEach((b) => b.onclick = () => { menu.remove(); const t = TYPES.find((x) => x.id === b.dataset.t); editor(body, ref, { type: t.id, bg: "#ffffff", els: [], name: "Untitled " + t.name }); });
      const si = menu.querySelector(".cv-cm-search input");
      si.oninput = () => { const q = si.value.toLowerCase(); menu.querySelectorAll(".cv-cm-item").forEach((b) => { b.style.display = b.textContent.toLowerCase().includes(q) ? "flex" : "none"; }); };
      body.querySelector(".cv").appendChild(menu);
      setTimeout(() => { si.focus(); document.addEventListener("pointerdown", function h(x) { if (!menu.contains(x.target) && x.target !== ev.target) { menu.remove(); document.removeEventListener("pointerdown", h); } }); }, 0);
    };
    // More menu (Apps, Grow, Content Planner, Design School).
    body.querySelector(".cv-nav-more").onclick = (ev) => {
      body.querySelectorAll(".cv-more-menu, .cv-create-menu").forEach((m) => m.remove());
      const r = ev.currentTarget.getBoundingClientRect(), cvR = body.querySelector(".cv").getBoundingClientRect();
      const ITEMS = [
        { t: "Apps", d: "Connect design and productivity tools.", i: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M17 14v6M14 17h6"/></svg>` },
        { t: "Grow", d: "AI tools to grow your marketing.", i: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M4 14l5-5 4 3 7-7"/><path d="M14 5h6v6"/></svg>` },
        { t: "Content Planner", d: "Take control of your social channels.", i: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M4 9h16M8 3v4M16 3v4"/></svg>` },
        { t: "Design School", d: "Learn how to design with Canva.", i: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><circle cx="12" cy="12" r="7"/><path d="M12 8l1.3 2.7L16 11l-2 1.8.5 2.7L12 14.3 9.5 15.5 10 12.8 8 11l2.7-.3z"/></svg>` },
      ];
      const menu = el(`<div class="cv-more-menu" style="left:${r.right - cvR.left + 6}px;top:${r.top - cvR.top}px">${ITEMS.map((x) => `<button class="cv-more-item"><span class="cv-more-ic">${x.i}</span><span class="cv-more-meta"><span class="cv-more-t">${x.t}</span><span class="cv-more-d">${x.d}</span></span></button>`).join("")}</div>`);
      menu.querySelectorAll(".cv-more-item").forEach((b, k) => b.onclick = () => { menu.remove(); if (window.Notify) Notify.show({ icon: window.Icon ? Icon.mini("canva", "Canva") : "", title: "Canva", body: ITEMS[k].t + " — coming soon." }); });
      body.querySelector(".cv").appendChild(menu);
      setTimeout(() => document.addEventListener("pointerdown", function h(x) { if (!menu.contains(x.target) && x.target !== ev.target) { menu.remove(); document.removeEventListener("pointerdown", h); } }), 0);
    };
    body.querySelector(".cv-profile").onclick = () => profileScreen(body, ref);
  }

  function profileScreen(body, ref) {
    const st = store();
    const NAV = [["Your profile", "👤", true], ["Account and security", "🔐"], ["Accessibility", "♿"], ["Message preferences", "✉️"], ["Privacy controls", "🔒"], ["Data and storage", "🗄️"], ["Your teams", "👥"], ["AI personalization", "✨"], ["Your apps", "▦"]];
    body.innerHTML = `<div class="cv">
      <aside class="cv-side">
        <div class="cv-brand"><img class="cv-wordmark" src="assets/canva_wordmark.png?v=1" alt="Canva"></div>
        ${NAV.map((n) => `<button class="cv-nav ${n[2] ? "on" : ""}">${n[1]} ${esc(n[0])}</button>`).join("")}
        <button class="cv-nav cv-back-nav" style="margin-top:auto">‹ Back to home</button>
      </aside>
      <main class="cv-main cv-profile-main">
        <h1 class="cv-p-title">Your profile</h1>
        <h2 class="cv-p-sec">Your account</h2>
        <div class="cv-card">
          <div class="cv-p-row">
            <div class="cv-p-photo">${profilePhoto() ? `<img src="${esc(profilePhoto())}" alt="">` : esc(profileName()[0].toUpperCase())}</div>
            <div class="cv-p-photo-lbl"><b>Profile Photo</b></div>
            <span class="grow"></span>
            ${profilePhoto() ? `<button class="cv-link cv-photo-remove">Remove photo</button>` : ""}
            <button class="cv-btn cv-photo-change">Change photo</button>
          </div>
          <div class="cv-p-row"><div><b>Name</b><div class="cv-p-val">${esc(profileName())}</div></div><span class="grow"></span><button class="cv-btn cv-edit-name">Edit</button></div>
          <div class="cv-p-row"><div><b>Email address</b><div class="cv-p-val">${esc(profileEmail())}</div></div><span class="grow"></span><button class="cv-btn cv-edit-email">Edit</button></div>
          <div class="cv-p-row"><div><b>What will you be using Canva for?</b></div><span class="grow"></span>
            <select class="cv-select cv-use"><option>Personal</option><option>Small business</option><option>Large company</option><option>Student</option><option>Teacher</option><option>Nonprofit</option></select></div>
          <div class="cv-p-row"><div><b>Language</b></div><span class="grow"></span>
            <select class="cv-select cv-lang"><option>English (US)</option><option>English (UK)</option><option>Español</option><option>Français</option><option>Deutsch</option><option>日本語</option></select></div>
        </div>
      </main>
    </div>`;
    body.querySelector(".cv-back-nav").onclick = () => home(body, ref);
    const use = body.querySelector(".cv-use"); if (st.profile.use) use.value = st.profile.use; use.onchange = () => { st.profile.use = use.value; State.save(); };
    const lang = body.querySelector(".cv-lang"); if (st.profile.lang) lang.value = st.profile.lang; lang.onchange = () => { st.profile.lang = lang.value; State.save(); };
    body.querySelector(".cv-edit-name").onclick = () => { const v = prompt("Your name", profileName()); if (v != null && v.trim()) { st.profile.name = v.trim(); State.save(); profileScreen(body, ref); } };
    body.querySelector(".cv-edit-email").onclick = () => { const v = prompt("Email address", profileEmail()); if (v != null && v.trim()) { st.profile.email = v.trim(); State.save(); profileScreen(body, ref); } };
    const rem = body.querySelector(".cv-photo-remove"); if (rem) rem.onclick = () => { st.profile.photo = null; State.save(); profileScreen(body, ref); };
    body.querySelector(".cv-photo-change").onclick = () => {
      const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*";
      inp.onchange = () => { const f = inp.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { st.profile.photo = r.result; State.save(); profileScreen(body, ref); }; r.readAsDataURL(f); };
      inp.click();
    };
    body.querySelectorAll(".cv-nav:not(.on):not(.cv-back-nav)").forEach((b) => b.onclick = () => { if (window.Notify) Notify.show({ icon: window.Icon ? Icon.mini("canva", "Canva") : "", title: "Canva", body: b.textContent.trim() + " — coming soon." }); });
  }

  const PALETTE = ["#111111", "#ffffff", "#ff5a5f", "#ff9f1c", "#ffd54a", "#2ec4b6", "#3a86ff", "#7b5cff", "#e84393", "#00b894", "#636e72", "#fab1a0"];
  const FONTS = ["Nunito", "Poppins", "Montserrat", "Playfair Display", "Oswald", "Lobster", "Pacifico", "Bebas Neue", "Dancing Script", "Roboto Slab", "Arial", "Georgia", "Times New Roman", "Courier New", "Comic Sans MS", "Impact"];

  function editor(body, ref, design, existingIndex) {
    const ty = TYPES.find((x) => x.id === design.type) || TYPES[0];
    let sel = null;
    body.innerHTML = `<div class="cv cv-edit">
      <div class="cv-topbar">
        <button class="cv-back">‹ Home</button>
        <input class="cv-title" value="${esc(design.name || "Untitled design")}">
        <span class="cv-saved">☁ All changes saved</span>
        <span class="grow"></span>
        <button class="cv-dl">⬇ Download</button>
        <button class="cv-share-btn">Share</button>
      </div>
      <div class="cv-work">
        <div class="cv-rail">${RAIL.map((r) => `<button class="cv-rail-btn" data-rail="${r.id}"><span class="cv-rail-ic">${r.pro ? '<img class="cv-rail-crown" src="assets/cv_pro.png?v=1" alt="Pro">' : ""}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${r.svg}</svg></span><span class="cv-rail-lbl">${esc(r.label)}</span></button>`).join("")}</div>
        <div class="cv-panel">
          <div class="cv-panel-body"></div>
          <div class="cv-panel-h cv-sel-h" style="display:none">Selected</div>
          <div class="cv-sel-tools" style="display:none">
            <div class="cv-swatches cv-el-sw"></div>
            <select class="cv-font" style="display:none">${FONTS.map((f) => `<option value="${esc(f)}" style="font-family:'${esc(f)}'">${esc(f)}</option>`).join("")}</select>
            <div class="cv-fmt-row" style="display:none">
              <button class="cv-fmt" data-fmt="bold" title="Bold"><b>B</b></button>
              <button class="cv-fmt" data-fmt="italic" title="Italic"><i>I</i></button>
              <button class="cv-fmt" data-fmt="underline" title="Underline"><u>U</u></button>
              <button class="cv-fmt" data-fmt="strike" title="Strikethrough"><s>S</s></button>
              <button class="cv-fmt cv-align" title="Alignment"></button>
            </div>
            <label class="cv-size-row" style="display:none">Size <input type="range" class="cv-size" min="10" max="120"></label>
            <label class="cv-op-row">Opacity <input type="range" class="cv-op" min="0" max="100" value="100"></label>
            <button class="cv-rembg" style="display:none">✂ Remove background</button>
            <button class="cv-frame-photo" style="display:none">🖼 Add photo to frame</button>
            <button class="cv-del">🗑 Delete</button>
          </div>
        </div>
        <div class="cv-stage-wrap">
          <div class="cv-stage" style="width:${ty.w}px;height:${ty.h}px;background:${design.bg}"></div>
        </div>
      </div>
      ${ty.id === "video" ? `<div class="cv-timeline">
        <div class="cv-tl-transport"><span class="cv-tl-cur">0:00</span><button class="cv-tl-play" title="Play">▶</button><span class="cv-tl-dur">0:05</span></div>
        <div class="cv-tl-ruler">${[0, 10, 20, 30, 40, 50].map((s) => `<span class="cv-tl-mark">${s}s</span>`).join("")}</div>
        <div class="cv-tl-tracks">
          <div class="cv-tl-track"><span>＋ Add elements</span></div>
          <div class="cv-tl-track cv-tl-media"><span>＋ or drag and drop media</span></div>
          <div class="cv-tl-track"><span>♪ Add audio</span></div>
          <div class="cv-tl-playhead"></div>
        </div>
      </div>` : ""}
      <div class="cv-bottombar">
        <button class="cv-bb cv-bb-notes"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h9M4 12h8M4 17h6"/><path d="M15 16l5-5 2 2-5 5h-2z"/></svg>Notes</button>
        <button class="cv-bb cv-bb-timer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="14" r="7"/><path d="M12 14V10M10 3h4M18 8l1.5-1.5"/></svg>Timer</button>
        <span class="grow"></span>
        <input type="range" class="cv-zoom" min="10" max="200" value="100">
        <span class="cv-zoom-val">100%</span>
        <button class="cv-bb cv-bb-pages"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="13" rx="2"/><path d="M7 18v2M17 18v2"/></svg>Pages</button>
        <span class="cv-bb-pageidx">1 / 1</span>
        <button class="cv-bb-ic cv-bb-grid" title="Grid view"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/></svg></button>
        <button class="cv-bb-ic cv-bb-expand" title="Full screen"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7"/></svg></button>
        <button class="cv-bb-ic cv-bb-help" title="Help"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9.6 9.2a2.5 2.5 0 1 1 3.4 2.3c-.7.4-1 .8-1 1.6"/><circle cx="12" cy="16.6" r=".7" fill="currentColor" stroke="none"/></svg></button>
      </div>
    </div>`;
    const stage = body.querySelector(".cv-stage");
    body.querySelector(".cv").appendChild(el(`<svg width="0" height="0" style="position:absolute"><defs><clipPath id="cvHeart" clipPathUnits="objectBoundingBox"><path d="M.5.95C.1.68 0 .42 0 .26 0 .09 .17 0 .3 .1 .4 .17 .47 .27 .5 .34 .53 .27 .6 .17 .7 .1 .83 0 1 .09 1 .26 1 .42 .9 .68 .5 .95Z"/></clipPath></defs></svg>`));
    const selH = body.querySelector(".cv-sel-h"), selTools = body.querySelector(".cv-sel-tools"), sizeRow = body.querySelector(".cv-size-row"), sizeIn = body.querySelector(".cv-size"), rembgBtn = body.querySelector(".cv-rembg"), fontSel = body.querySelector(".cv-font"), fmtRow = body.querySelector(".cv-fmt-row"), framePhotoBtn = body.querySelector(".cv-frame-photo"), alignBtn = body.querySelector(".cv-align");
    const ALIGN_ORDER = ["left", "center", "right", "justify"];
    const ALIGN_IC = {
      left: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 10h10M4 14h16M4 18h10"/></svg>`,
      center: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M7 10h10M4 14h16M7 18h10"/></svg>`,
      right: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M10 10h10M4 14h16M10 18h10"/></svg>`,
      justify: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>`,
    };
    const opRow = body.querySelector(".cv-op-row"), opIn = body.querySelector(".cv-op");

    // Color panel: default swatches + an "add color" picker + deletable custom colors (persisted).
    function customColors() { const st = store(); if (!st.colors) st.colors = []; return st.colors; }
    function colorPanel(host, apply) {
      host.innerHTML = "";
      const add = el(`<label class="cv-sw cv-add-color" title="Add a color">＋<input type="color" value="#143f6b"></label>`);
      add.querySelector("input").oninput = (e) => {
        const c = e.target.value; const cols = customColors();
        if (!cols.includes(c)) cols.unshift(c); if (cols.length > 24) cols.pop();
        State.save(); apply(c); colorPanel(host, apply);
      };
      host.appendChild(add);
      PALETTE.forEach((c) => { const b = el(`<button class="cv-sw" style="background:${c}"></button>`); b.onclick = () => apply(c); host.appendChild(b); });
      customColors().forEach((c) => {
        const b = el(`<button class="cv-sw cv-sw-custom" style="background:${c}" title="${c}"><span class="cv-sw-x">×</span></button>`);
        b.onclick = () => apply(c);
        b.querySelector(".cv-sw-x").onclick = (e) => { e.stopPropagation(); const cols = customColors(); const i = cols.indexOf(c); if (i >= 0) cols.splice(i, 1); State.save(); colorPanel(host, apply); };
        host.appendChild(b);
      });
    }
    colorPanel(body.querySelector(".cv-el-sw"), (c) => { if (sel != null) { design.els[sel].color = c; render(); selectEl(sel); record(); } });

    const savedEl = body.querySelector(".cv-saved");
    let savedTimer = null;
    function flashSaved() { if (!savedEl) return; savedEl.textContent = "☁ Saving…"; clearTimeout(savedTimer); savedTimer = setTimeout(() => { savedEl.textContent = "☁ All changes saved"; }, 500); }

    // Custom uploaded fonts (persisted) feed the font dropdown alongside the built-ins.
    function allFonts() { return FONTS.concat(((store().fonts) || []).map((f) => f.name)); }
    function fillFontSelect() { const cur = fontSel.value; fontSel.innerHTML = allFonts().map((f) => `<option value="${esc(f)}" style="font-family:'${esc(f)}'">${esc(f)}</option>`).join(""); if (cur) fontSel.value = cur; }
    function registerFont(name, src) { try { if (!window.FontFace) return; const ff = new FontFace(name, `url(${src})`); ff.load().then((face) => document.fonts.add(face)).catch(() => {}); } catch (e) {} }
    function uploadFont() { requirePremium(doUploadFont); }   // premium-gated
    function doUploadFont() {
      const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".ttf";
      inp.onchange = () => { const f = inp.files && inp.files[0]; if (!f) return;
        if (!/\.ttf$/i.test(f.name)) { if (window.Notify) Notify.show({ title: "Canva", body: "Please choose a .ttf font file." }); return; }
        const r = new FileReader();
        r.onload = () => {
          const name = (f.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim()) || "Custom Font";
          const st = store(); if (!st.fonts) st.fonts = [];
          if (!st.fonts.some((x) => x.name === name)) st.fonts.unshift({ name, src: r.result });
          State.save(); registerFont(name, r.result); fillFontSelect();
          if (sel != null && design.els[sel] && design.els[sel].t === "text") { design.els[sel].font = name; render(); selectEl(sel); }
          if (window.Notify) Notify.show({ icon: window.Icon ? Icon.mini("canva", "Canva") : "", title: "Canva", body: `Font “${name}” added.` });
        };
        r.readAsDataURL(f); };
      inp.click();
    }
    ((store().fonts) || []).forEach((f) => registerFont(f.name, f.src));
    fillFontSelect();

    function selectEl(i) {
      sel = i;
      stage.querySelectorAll(".cv-obj").forEach((o) => o.classList.toggle("sel", +o.dataset.i === i));
      const has = i != null && design.els[i];
      selH.style.display = selTools.style.display = has ? "block" : "none";
      selTools.style.display = has ? "flex" : "none";
      const isText = has && design.els[i].t === "text";
      if (isText) { sizeRow.style.display = "flex"; sizeIn.min = 10; sizeIn.max = 120; sizeIn.value = design.els[i].size || 32; }
      else if (has) { sizeRow.style.display = "flex"; sizeIn.min = 40; sizeIn.max = 500; sizeIn.value = design.els[i].w || 140; }
      else sizeRow.style.display = "none";
      fontSel.style.display = isText ? "block" : "none";
      fmtRow.style.display = isText ? "flex" : "none";
      if (isText) { fontSel.value = design.els[i].font || "Nunito"; const e = design.els[i]; fmtRow.querySelectorAll(".cv-fmt[data-fmt]").forEach((b) => b.classList.toggle("on", !!e[b.dataset.fmt])); alignBtn.innerHTML = ALIGN_IC[e.align || "left"]; }
      rembgBtn.style.display = has && design.els[i].t === "image" ? "block" : "none";
      framePhotoBtn.style.display = has && design.els[i].t === "frame" ? "block" : "none";
      opRow.style.display = has ? "flex" : "none";
      if (has) opIn.value = Math.round((design.els[i].opacity != null ? design.els[i].opacity : 1) * 100);
      if (has) showPill(i); else clearPill();
      if (has && design.els[i].t !== "text") showFrame(i); else clearFrame();
    }

    // PowerPoint-style resize frame: 8 handles around the selected image/shape.
    let frameNode = null;
    function clearFrame() { if (frameNode) { frameNode.remove(); frameNode = null; } }
    function placeFrame() { if (!frameNode || sel == null) return; const e = design.els[sel]; if (!e) return; frameNode.style.left = e.x + "px"; frameNode.style.top = e.y + "px"; frameNode.style.width = (e.w || 140) + "px"; frameNode.style.height = (e.h || 140) + "px"; frameNode.style.transform = "rotate(" + (e.rot || 0) + "deg)"; }
    function showFrame(i) {
      clearFrame();
      const e = design.els[i]; if (!e || e.t === "text") return;
      frameNode = el(`<div class="cv-selframe">${["nw", "n", "ne", "e", "se", "s", "sw", "w"].map((p) => `<div class="cv-handle cv-h-${p}" data-pos="${p}"></div>`).join("")}<div class="cv-rot-stalk"></div><div class="cv-handle cv-h-rot" title="Rotate"></div></div>`);
      const objNode = stage.querySelector(`.cv-obj[data-i="${i}"]`);
      // Rotate handle: spin the element around its centre.
      frameNode.querySelector(".cv-h-rot").addEventListener("pointerdown", (ev) => {
        ev.stopPropagation(); ev.preventDefault();
        const rect = stage.getBoundingClientRect();
        const scale = (parseFloat((body.querySelector(".cv-zoom") || {}).value) || 100) / 100;
        const cx = rect.left + (e.x + (e.w || 140) / 2) * scale, cy = rect.top + (e.y + (e.h || 140) / 2) * scale;
        const mv = (m) => {
          let deg = Math.atan2(m.clientY - cy, m.clientX - cx) * 180 / Math.PI + 90;
          if (m.shiftKey) deg = Math.round(deg / 15) * 15;
          e.rot = Math.round(deg);
          const t = "rotate(" + e.rot + "deg)";
          if (objNode) { objNode.style.transform = t; objNode.style.setProperty("--rot", e.rot + "deg"); }
          frameNode.style.transform = t;
        };
        const up = () => { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); render(); selectEl(i); record(); };
        document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up);
      });
      frameNode.querySelectorAll(".cv-handle[data-pos]").forEach((h) => h.addEventListener("pointerdown", (ev) => {
        ev.stopPropagation(); ev.preventDefault();
        const pos = h.dataset.pos, corner = pos.length === 2;
        const east = pos.includes("e"), west = pos.includes("w"), north = pos.includes("n"), south = pos.includes("s");
        const sx = ev.clientX, sy = ev.clientY, ox = e.x, oy = e.y, ow = e.w || 140, oh = e.h || 140, ratio = oh / (ow || 1);
        const scale = (parseFloat((body.querySelector(".cv-zoom") || {}).value) || 100) / 100;
        const mv = (m) => {
          const dx = (m.clientX - sx) / scale, dy = (m.clientY - sy) / scale;
          let nx = ox, ny = oy, nw = ow, nh = oh;
          if (corner) {                                   // corners keep aspect ratio
            const deltaW = east ? dx : -dx;
            nw = Math.max(20, ow + deltaW); nh = Math.max(20, Math.round(nw * ratio));
            if (west) nx = ox + (ow - nw);
            if (north) ny = oy + (oh - nh);
          } else {                                        // edges stretch one side
            if (east) nw = Math.max(20, ow + dx);
            if (west) { nw = Math.max(20, ow - dx); nx = ox + (ow - nw); }
            if (south) nh = Math.max(20, oh + dy);
            if (north) { nh = Math.max(20, oh - dy); ny = oy + (oh - nh); }
          }
          e.x = nx; e.y = ny; e.w = nw; e.h = nh;
          if (objNode) { objNode.style.left = nx + "px"; objNode.style.top = ny + "px"; objNode.style.width = nw + "px"; objNode.style.height = nh + "px"; }
          placeFrame();
        };
        const up = () => { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); render(); selectEl(i); record(); };
        document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up);
      }));
      stage.appendChild(frameNode);
      placeFrame();
    }
    fontSel.onchange = () => { if (sel != null && design.els[sel].t === "text") { design.els[sel].font = fontSel.value; render(); selectEl(sel); record(); } };
    fmtRow.querySelectorAll(".cv-fmt[data-fmt]").forEach((b) => b.onclick = () => { if (sel != null && design.els[sel].t === "text") { const k = b.dataset.fmt; design.els[sel][k] = !design.els[sel][k]; render(); selectEl(sel); record(); } });
    alignBtn.onclick = () => { if (sel != null && design.els[sel].t === "text") { const e = design.els[sel]; e.align = ALIGN_ORDER[(ALIGN_ORDER.indexOf(e.align || "left") + 1) % ALIGN_ORDER.length]; render(); selectEl(sel); record(); } };
    rembgBtn.onclick = () => removeBg();
    framePhotoBtn.onclick = () => fillFrame();

    // Floating selection toolbar (a pill above the selected element).
    const toast = (msg) => { if (window.Notify) Notify.show({ icon: window.Icon ? Icon.mini("canva", "Canva") : "", title: "Canva", body: msg }); };
    function reorder(kind) {
      if (sel == null) return;
      const e = design.els.splice(sel, 1)[0]; let ni = sel;
      if (kind === "front") ni = design.els.length;
      else if (kind === "back") ni = 0;
      else if (kind === "forward") ni = Math.min(design.els.length, sel + 1);
      else if (kind === "backward") ni = Math.max(0, sel - 1);
      design.els.splice(ni, 0, e); render(); selectEl(ni); record();
    }
    let pillNode = null;
    function clearPill() { if (pillNode) { pillNode.remove(); pillNode = null; } }
    function placePill() {
      if (!pillNode || sel == null) return;
      const e = design.els[sel]; if (!e) return;
      const obj = stage.querySelector(`.cv-obj[data-i="${sel}"]`);
      const w = obj ? obj.offsetWidth : (e.w || 140);
      pillNode.style.left = (e.x + w / 2) + "px";
      pillNode.style.top = Math.max(2, (e.y - 46)) + "px";
    }
    function showPill(i) {
      clearPill();
      const e = design.els[i]; if (!e) return;
      const locked = !!e.locked;
      pillNode = el(`<div class="cv-pill">
        <button class="cv-pl cv-pl-ask"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 6a4 4 0 1 0 0 8"/><path d="M18 4l.7 1.8L20.5 6.5 18.7 7.2 18 9l-.7-1.8L15.5 6.5 17.3 5.8z"/></svg>Ask Canva</button>
        <button class="cv-pl cv-pl-comment" title="Comment"><img src="assets/cv_comment.png?v=1" alt=""></button>
        <button class="cv-pl cv-pl-lock" title="${locked ? "Unlock" : "Lock"}">${locked ? "🔒" : "🔓"}</button>
        <button class="cv-pl cv-pl-dup" title="Duplicate"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><rect x="4" y="4" width="12" height="12" rx="2"/><path d="M8 16v2a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-2"/></svg></button>
        <button class="cv-pl cv-pl-del" title="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/></svg></button>
        <button class="cv-pl cv-pl-more" title="More">&#8943;</button>
      </div>`);
      pillNode.querySelector(".cv-pl-ask").onclick = (ev) => { ev.stopPropagation(); showPanel("ai"); };
      pillNode.querySelector(".cv-pl-comment").onclick = (ev) => { ev.stopPropagation(); addComment(); };
      pillNode.querySelector(".cv-pl-lock").onclick = (ev) => { ev.stopPropagation(); e.locked = !e.locked; render(); selectEl(i); record(); };
      pillNode.querySelector(".cv-pl-dup").onclick = (ev) => { ev.stopPropagation(); duplicateSel(); };
      pillNode.querySelector(".cv-pl-del").onclick = (ev) => { ev.stopPropagation(); design.els.splice(i, 1); sel = null; render(); selectEl(null); record(); };
      pillNode.querySelector(".cv-pl-more").onclick = (ev) => {
        ev.stopPropagation();
        body.querySelectorAll(".cv-pos-menu").forEach((m) => m.remove());
        const r = ev.currentTarget.getBoundingClientRect(), cvR = body.querySelector(".cv").getBoundingClientRect();
        const menu = el(`<div class="cv-pos-menu" style="left:${r.left - cvR.left - 120}px;top:${r.bottom - cvR.top + 4}px">
          <button data-a="animate">✨ Animate</button><button data-o="front">⤒ To front</button><button data-o="forward">↑ Forward</button>
          <button data-o="backward">↓ Backward</button><button data-o="back">⤓ To back</button></div>`);
        menu.querySelectorAll("button").forEach((b) => b.onclick = () => { menu.remove(); if (b.dataset.a === "animate") openAnimate(); else reorder(b.dataset.o); });
        body.querySelector(".cv").appendChild(menu);
        setTimeout(() => document.addEventListener("pointerdown", function h(x) { if (!menu.contains(x.target)) { menu.remove(); document.removeEventListener("pointerdown", h); } }), 0);
      };
      stage.appendChild(pillNode);
      placePill();
    }
    opIn.oninput = () => { if (sel != null && design.els[sel]) { design.els[sel].opacity = +opIn.value / 100; const o = stage.querySelector(`.cv-obj[data-i="${sel}"]`); if (o) o.style.opacity = design.els[sel].opacity; } };
    opIn.addEventListener("change", () => { if (sel != null) record(); });
    sizeIn.oninput = () => {
      if (sel == null) return;
      const e = design.els[sel];
      if (e.t === "text") e.size = +sizeIn.value;
      else { const ratio = (e.h || 1) / (e.w || 1); e.w = +sizeIn.value; e.h = Math.round(e.w * ratio); }
      render(); selectEl(sel);
    };
    sizeIn.addEventListener("change", () => { if (sel != null) record(); });
    body.querySelector(".cv-del").onclick = () => { if (sel != null) { design.els.splice(sel, 1); sel = null; render(); selectEl(null); record(); } };

    function render() {
      stage.innerHTML = "";
      design.els.forEach((e, i) => {
        let o;
        if (e.t === "text") { const deco = [e.underline && "underline", e.strike && "line-through"].filter(Boolean).join(" ") || "none"; const wrap = e.w ? `width:${e.w}px;white-space:normal;` : ""; o = el(`<div class="cv-obj cv-text" contenteditable="true" data-i="${i}" style="left:${e.x}px;top:${e.y}px;font-size:${e.size || 32}px;color:${e.color};font-weight:${e.bold ? 800 : 400};font-style:${e.italic ? "italic" : "normal"};text-decoration:${deco};text-align:${e.align || "left"};font-family:'${(e.font || "Nunito").replace(/'/g, "")}';${wrap}">${esc(e.text || "Text")}</div>`); }
        else if (e.t === "image") o = el(`<img class="cv-obj cv-image" data-i="${i}" src="${esc(e.src)}" alt="" draggable="false" style="left:${e.x}px;top:${e.y}px;width:${e.w || 160}px;height:${e.h || 160}px">`);
        else if (e.t === "path") o = el(`<svg class="cv-obj cv-draw" data-i="${i}" viewBox="0 0 ${e.vbW || e.w} ${e.vbH || e.h}" preserveAspectRatio="none" style="left:${e.x}px;top:${e.y}px;width:${e.w}px;height:${e.h}px;overflow:visible"><polyline points="${(e.pts || []).map((p) => p.join(",")).join(" ")}" fill="none" stroke="${e.color}" stroke-width="${e.width || 4}" stroke-linecap="round" stroke-linejoin="round"/></svg>`);
        else if (e.t === "table") { const cells = Array.from({ length: (e.rows || 3) * (e.cols || 3) }, () => `<div class="cv-td"></div>`).join(""); o = el(`<div class="cv-obj cv-table" data-i="${i}" style="left:${e.x}px;top:${e.y}px;width:${e.w || 240}px;height:${e.h || 160}px;grid-template-columns:repeat(${e.cols || 3},1fr);grid-template-rows:repeat(${e.rows || 3},1fr);--tc:${e.color || "#1c1c28"}">${cells}</div>`); }
        else if (e.t === "frame") { const inner = e.src ? `<img src="${esc(e.src)}" alt="" draggable="false">` : `<span class="cv-frame-ph"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 16l5-5 4 3 3-3 6 6"/><circle cx="8.5" cy="9.5" r="1.5"/></svg></span>`; o = el(`<div class="cv-obj cv-frame cv-frame-${e.shape}" data-i="${i}" style="left:${e.x}px;top:${e.y}px;width:${e.w || 180}px;height:${e.h || 180}px">${inner}</div>`); }
        else o = el(`<div class="cv-obj cv-shape" data-i="${i}" style="left:${e.x}px;top:${e.y}px;width:${e.w || 120}px;height:${e.h || 120}px;background:${e.color};border-radius:${e.t === "circle" ? "50%" : "6px"}"></div>`);
        if (e.t === "text") o.oninput = () => { e.text = o.textContent; };
        if (e.anim) o.classList.add("cv-anim", "cv-anim-" + e.anim);
        o.style.setProperty("--rot", (e.rot || 0) + "deg");
        if (e.rot) o.style.transform = "rotate(" + e.rot + "deg)";
        if (e.opacity != null && e.opacity !== 1) o.style.opacity = e.opacity;
        dragify(o, e, i);
        stage.appendChild(o);
      });
      renderComments();
    }
    function renderComments() {
      (design.comments || []).forEach((cm, ci) => {
        const pin = el(`<button class="cv-comment-pin" data-ci="${ci}" style="left:${cm.x}px;top:${cm.y}px" title="${esc(cm.author || "")}">💬</button>`);
        pin.onclick = (ev) => { ev.stopPropagation(); showComment(ci); };
        stage.appendChild(pin);
      });
    }
    function showComment(ci) {
      stage.querySelectorAll(".cv-comment-pop").forEach((p) => p.remove());
      const cm = design.comments && design.comments[ci]; if (!cm) return;
      const pop = el(`<div class="cv-comment-pop" style="left:${cm.x + 26}px;top:${cm.y}px">
        <div class="cv-comment-author">${esc(cm.author || "You")}</div>
        <div class="cv-comment-text">${esc(cm.text)}</div>
        <div class="cv-comment-actions"><button class="cv-comment-reply">Reply</button><button class="cv-comment-del">Resolve</button></div>
      </div>`);
      pop.querySelector(".cv-comment-del").onclick = () => { design.comments.splice(ci, 1); render(); record(); };
      pop.querySelector(".cv-comment-reply").onclick = () => { const r = prompt("Reply"); if (r && r.trim()) { cm.text += "\n↳ " + r.trim(); render(); record(); showComment(ci); } };
      stage.appendChild(pop);
    }
    function addComment() {
      const txt = prompt("Add a comment"); if (!txt || !txt.trim()) return;
      if (!design.comments) design.comments = [];
      let x = ty.w / 2 - 12, y = ty.h / 2 - 12;
      if (sel != null && design.els[sel]) { x = (design.els[sel].x || 0) + (design.els[sel].w || 60); y = (design.els[sel].y || 0) - 6; }
      x = Math.max(4, Math.min(ty.w - 28, x)); y = Math.max(4, Math.min(ty.h - 28, y));
      design.comments.push({ x, y, text: txt.trim(), author: profileName() });
      render(); record();
      if (window.Notify) Notify.show({ icon: window.Icon ? Icon.mini("canva", "Canva") : "", title: "Canva", body: "Comment added." });
    }
    function clearGuides() { stage.querySelectorAll(".cv-guide").forEach((g) => g.remove()); }
    function showGuide(dir, pos) { stage.appendChild(el(`<div class="cv-guide cv-guide-${dir}" style="${dir === "v" ? "left" : "top"}:${pos}px"></div>`)); }
    function dragify(o, e, i) {
      o.addEventListener("pointerdown", (ev) => {
        if (o.isContentEditable && document.activeElement === o) return;   // let text editing work
        selectEl(i);
        if (e.locked) return;   // locked elements can't be moved
        const r = stage.getBoundingClientRect(); const ox = ev.clientX - e.x, oy = ev.clientY - e.y;
        let moved = false;
        const mv = (m) => {
          moved = true;
          let nx = m.clientX - ox, ny = m.clientY - oy;
          const w = o.offsetWidth || e.w || 0, h = o.offsetHeight || e.h || 0, SNAP = 6;
          clearGuides();
          if (Math.abs((nx + w / 2) - ty.w / 2) < SNAP) { nx = Math.round(ty.w / 2 - w / 2); showGuide("v", ty.w / 2); }
          else if (Math.abs(nx) < SNAP) { nx = 0; showGuide("v", 0); }
          else if (Math.abs((nx + w) - ty.w) < SNAP) { nx = ty.w - w; showGuide("v", ty.w); }
          if (Math.abs((ny + h / 2) - ty.h / 2) < SNAP) { ny = Math.round(ty.h / 2 - h / 2); showGuide("h", ty.h / 2); }
          else if (Math.abs(ny) < SNAP) { ny = 0; showGuide("h", 0); }
          else if (Math.abs((ny + h) - ty.h) < SNAP) { ny = ty.h - h; showGuide("h", ty.h); }
          e.x = Math.max(0, Math.min(ty.w - 10, nx)); e.y = Math.max(0, Math.min(ty.h - 10, ny));
          o.style.left = e.x + "px"; o.style.top = e.y + "px"; if (i === sel) { placeFrame(); placePill(); }
        };
        const up = () => { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); clearGuides(); if (moved) record(); };
        document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up);
      });
      o.addEventListener("click", (ev) => { ev.stopPropagation(); selectEl(i); });
    }
    stage.onclick = (ev) => { if (ev.target === stage) { selectEl(null); stage.querySelectorAll(".cv-comment-pop").forEach((p) => p.remove()); } };

    // Right-click context menu: copy / paste / duplicate / delete.
    let clipboard = null;
    function copySel() { if (sel != null && design.els[sel]) clipboard = JSON.parse(JSON.stringify(design.els[sel])); }
    function cutSel() { if (sel != null && design.els[sel]) { clipboard = JSON.parse(JSON.stringify(design.els[sel])); design.els.splice(sel, 1); sel = null; render(); selectEl(null); record(); } }
    function pasteClip() { if (!clipboard) return; const c = JSON.parse(JSON.stringify(clipboard)); c.x = (c.x || 0) + 18; c.y = (c.y || 0) + 18; design.els.push(c); render(); selectEl(design.els.length - 1); record(); }
    function closeCtx() { const m = body.querySelector(".cv-ctx"); if (m) m.remove(); }
    const CTX_IC = {
      cut: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M8 7.7l12 8.3M8 16.3l12-8.3"/></svg>`,
      copy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="4" y="4" width="12" height="12" rx="2"/><path d="M8 16v2a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-2"/></svg>`,
      paste: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="5" y="5" width="14" height="16" rx="2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>`,
      dup: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><rect x="4" y="4" width="12" height="12" rx="2"/><rect x="8" y="8" width="12" height="12" rx="2"/></svg>`,
      del: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/></svg>`,
    };
    stage.addEventListener("contextmenu", (ev) => {
      ev.preventDefault(); closeCtx();
      const objEl = ev.target.closest(".cv-obj");
      if (objEl) selectEl(+objEl.dataset.i);
      const cvRect = body.querySelector(".cv").getBoundingClientRect();
      const has = sel != null;
      const menu = el(`<div class="cv-ctx" style="left:${ev.clientX - cvRect.left}px;top:${ev.clientY - cvRect.top}px">
        <button data-act="cut"${has ? "" : " disabled"}>${CTX_IC.cut}Cut</button>
        <button data-act="copy"${has ? "" : " disabled"}>${CTX_IC.copy}Copy</button>
        <button data-act="paste"${clipboard ? "" : " disabled"}>${CTX_IC.paste}Paste</button>
        <button data-act="dup"${has ? "" : " disabled"}>${CTX_IC.dup}Duplicate</button>
        <button data-act="del"${has ? "" : " disabled"}>${CTX_IC.del}Delete</button>
      </div>`);
      menu.querySelectorAll("button").forEach((b) => b.onclick = () => {
        const a = b.dataset.act; closeCtx();
        if (a === "cut") cutSel();
        else if (a === "copy") copySel();
        else if (a === "paste") pasteClip();
        else if (a === "dup") duplicateSel();
        else if (a === "del" && sel != null) { design.els.splice(sel, 1); sel = null; render(); selectEl(null); record(); }
      });
      body.querySelector(".cv").appendChild(menu);
    });
    stage.addEventListener("pointerdown", () => closeCtx(), true);
    render();

    // ---- Freehand pen / pencil drawing -------------------------------------
    let drawMode = null;   // {color,width} while the pen/signature tool is active
    function enableDraw(opts) { drawMode = opts; stage.classList.add("cv-drawing"); selectEl(null); if (window.Notify) Notify.show({ icon: window.Icon ? Icon.mini("canva", "Canva") : "", title: "Canva", body: "Draw on the canvas. Pick the Select tool (or Esc) to stop." }); }
    function disableDraw() { drawMode = null; stage.classList.remove("cv-drawing"); }

    // Magic Write: generate text from a prompt via the AI API and drop it on the canvas.
    function magicWrite() {
      const q = prompt("Magic Write — what should I write about?"); if (!q || !q.trim()) return;
      const prog = window.ProgressUI ? ProgressUI.show(body.querySelector(".cv-stage-wrap"), { title: "Magic Write…", subtitle: "Writing your copy", etaMs: 6000, cancel: false }) : null;
      const insert = (txt) => {
        design.els.push({ t: "text", x: 40, y: 40, text: txt, size: 22, color: "#111111", w: Math.round(ty.w * 0.72) });
        render(); selectEl(design.els.length - 1); record();
        if (prog) prog.complete();
      };
      fetch("https://api.aimlapi.com/v1/chat/completions", {
        method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + window.AIML_KEY },
        body: JSON.stringify({ model: "baidu/ernie-4-5-0-3b", messages: [{ role: "user", content: `Write a short, punchy piece of copy about: ${q.trim()}. Keep it under 55 words. Reply with only the copy.` }] }),
      }).then((r) => r.json()).then((j) => {
        const txt = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content || "").trim();
        if (txt) insert(txt); else { if (prog) prog.remove(); if (window.Notify) Notify.show({ title: "Canva", body: "Magic Write couldn't generate text." }); }
      }).catch(() => { if (prog) prog.remove(); if (window.Notify) Notify.show({ title: "Canva", body: "Magic Write failed (network/CORS)." }); });
    }

    // Canva AI — Change style / Redesign restyle the page; generateDesign makes one from a prompt.
    function applyStyle(animate) {
      const set = rand(STYLE_SETS);
      design.bg = set.bg; stage.style.background = set.bg;
      design.els.forEach((e) => {
        if (e.t === "text" || e.t === "path" || e.t === "rect" || e.t === "circle") e.color = rand(set.colors);
        if (animate) e.anim = rand(ANIMS).id;
      });
      render(); selectEl(null); record();
      if (window.Notify) Notify.show({ icon: window.Icon ? Icon.mini("canva", "Canva") : "", title: "Canva AI", body: animate ? "Redesigned your page." : "Applied a new style." });
    }
    function generateDesign(idea) {
      if (!idea || !idea.trim()) return;
      const prog = window.ProgressUI ? ProgressUI.show(body.querySelector(".cv-stage-wrap"), { title: "Generating a design…", subtitle: "Canva AI", etaMs: 7000, cancel: false }) : null;
      const build = (headline, tagline) => {
        const set = rand(STYLE_SETS);
        design.bg = set.bg; stage.style.background = set.bg;
        const light = /#fff|linear-gradient/.test(set.bg) ? "#ffffff" : "#111111";
        design.els = [
          { t: "text", x: Math.round(ty.w * 0.08), y: Math.round(ty.h * 0.3), text: headline, size: 52, color: light, bold: true, w: Math.round(ty.w * 0.84), anim: "rise" },
          { t: "text", x: Math.round(ty.w * 0.08), y: Math.round(ty.h * 0.3) + 96, text: tagline, size: 22, color: light, w: Math.round(ty.w * 0.84), anim: "fade" },
        ];
        render(); selectEl(null); record();
        if (prog) prog.complete();
      };
      fetch("https://api.aimlapi.com/v1/chat/completions", {
        method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + window.AIML_KEY },
        body: JSON.stringify({ model: "baidu/ernie-4-5-0-3b", messages: [{ role: "user", content: `Design brief: "${idea.trim()}". Give a punchy headline (max 5 words) and a short tagline (max 12 words). Reply EXACTLY as: HEADLINE | TAGLINE` }] }),
      }).then((r) => r.json()).then((j) => {
        const out = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content || "").trim();
        const parts = out.split("|");
        build((parts[0] || idea).trim().slice(0, 40) || idea, (parts[1] || "").trim().slice(0, 90));
      }).catch(() => { build(idea.trim().slice(0, 40), ""); });   // offline fallback: use the idea itself
    }
    function addTable() {
      design.els.push({ t: "table", x: 60, y: 60, w: 260, h: 170, rows: 3, cols: 3, color: "#1c1c28" });
      render(); selectEl(design.els.length - 1); record();
    }
    // Magic Media: generate an image from a text prompt and drop it on the canvas.
    function generateImage(p) {
      if (!p || !p.trim()) return;
      const prog = window.ProgressUI ? ProgressUI.show(body.querySelector(".cv-stage-wrap"), { title: "Generating image…", subtitle: "Canva AI", etaMs: 14000, cancel: false }) : null;
      fetch("https://api.aimlapi.com/v1/images/generations", {
        method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + window.AIML_KEY },
        body: JSON.stringify({ model: "google/nano-banana-2", prompt: p.trim() }),
      }).then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
        .then((j) => {
          const url = (j.images && j.images[0] && j.images[0].url) || (j.data && j.data[0] && j.data[0].url) || (j.image && j.image.url) || j.url;
          if (!url) throw new Error("no image");
          const st = store(); if (!st.uploads) st.uploads = []; st.uploads.unshift({ src: url, name: p.trim().slice(0, 40) }); State.save();
          addImage(url); if (prog) prog.complete();
          if (window.Notify) Notify.show({ icon: window.Icon ? Icon.mini("canva", "Canva") : "", title: "Canva AI", body: "Image generated." });
        })
        .catch((err) => { if (prog) prog.remove(); if (window.Notify) Notify.show({ title: "Canva AI", body: "Image generation failed (" + err.message + ")." }); });
    }

    // Animate panel: apply a motion preset to the selected element (plays on render).
    function openAnimate() {
      if (sel == null || !design.els[sel]) return;
      body.querySelectorAll(".cv-rail-btn").forEach((b) => b.classList.remove("on"));
      const cur = design.els[sel].anim || "";
      panelBody.innerHTML = `<div class="cv-panel-h">Animate</div>
        <button class="cv-tool cv-anim-play">▶ Play</button>
        <button class="cv-anim-opt${cur ? "" : " on"}" data-anim="">None</button>
        <div class="cv-anim-grid">${ANIMS.map((a) => `<button class="cv-anim-opt cv-anim-card${cur === a.id ? " on" : ""}" data-anim="${a.id}">${esc(a.name)}</button>`).join("")}</div>`;
      panelBody.querySelector(".cv-anim-play").onclick = () => { render(); selectEl(sel); };
      panelBody.querySelectorAll(".cv-anim-opt").forEach((b) => b.onclick = () => {
        if (sel == null) return;
        const id = b.dataset.anim;
        if (id) design.els[sel].anim = id; else delete design.els[sel].anim;
        panelBody.querySelectorAll(".cv-anim-opt").forEach((x) => x.classList.toggle("on", x === b));
        render(); selectEl(sel); record();
      });
    }
    stage.addEventListener("pointerdown", (ev) => {
      if (!drawMode) return;
      ev.stopPropagation(); ev.preventDefault();
      const rect = stage.getBoundingClientRect();
      const scale = (parseFloat((body.querySelector(".cv-zoom") || {}).value) || 100) / 100;
      const toXY = (m) => [(m.clientX - rect.left) / scale, (m.clientY - rect.top) / scale];
      const pts = [toXY(ev)];
      const preview = el(`<svg class="cv-draw-preview" style="position:absolute;left:0;top:0;width:${ty.w}px;height:${ty.h}px;pointer-events:none;overflow:visible;z-index:7"><polyline fill="none" stroke="${drawMode.color}" stroke-width="${drawMode.width}" stroke-linecap="round" stroke-linejoin="round"/></svg>`);
      const poly = preview.querySelector("polyline");
      const upd = () => poly.setAttribute("points", pts.map((p) => p.join(",")).join(" "));
      upd(); stage.appendChild(preview);
      const mv = (m) => { pts.push(toXY(m)); upd(); };
      const up = () => {
        document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up);
        preview.remove();
        if (pts.length < 2) return;
        const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), pad = drawMode.width;
        const minX = Math.min.apply(null, xs) - pad, minY = Math.min.apply(null, ys) - pad;
        const w = Math.max(1, Math.max.apply(null, xs) + pad - minX), h = Math.max(1, Math.max.apply(null, ys) + pad - minY);
        const rel = pts.map((p) => [+(p[0] - minX).toFixed(1), +(p[1] - minY).toFixed(1)]);
        design.els.push({ t: "path", x: minX, y: minY, w, h, vbW: w, vbH: h, color: drawMode.color, width: drawMode.width, pts: rel });
        render(); selectEl(design.els.length - 1); record();
      };
      document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up);
    }, true);

    function addEl(kind) {
      if (kind === "text") design.els.push({ t: "text", x: 40, y: 40, text: "Your text", size: 36, color: "#111111" });
      else design.els.push({ t: kind, x: 60, y: 60, w: 140, h: 140, color: kind === "circle" ? "#7b5cff" : "#3a86ff" });
      render(); selectEl(design.els.length - 1); record();
    }

    // Drop an image element onto the stage, sizing it from the image's natural aspect ratio.
    function addImage(src) {
      const img = new Image();
      img.onload = () => {
        const maxW = Math.min(ty.w * 0.6, 360, img.naturalWidth || 240);
        const w = Math.max(60, Math.round(maxW));
        const ratio = (img.naturalHeight || 1) / (img.naturalWidth || 1);
        design.els.push({ t: "image", x: 40, y: 40, w, h: Math.round(w * ratio), src });
        render(); selectEl(design.els.length - 1); record();
      };
      img.onerror = () => {
        if (window.Notify) Notify.show({ title: "Canva", body: "Couldn't load that image." });
      };
      img.src = src;
    }

    // GIPHY search — pick a GIF to drop on the canvas as an (animated) image element.
    function openGiphy() {
      const key = window.GIPHY_API_KEY;
      const trending = `https://api.giphy.com/v1/gifs/trending?api_key=${key}&limit=24&rating=g`;
      const ov = el(`<div class="cv-imgpick cv-giphy-ov">
        <div class="cv-giphy">
          <div class="cv-giphy-top"><strong>GIPHY</strong><button class="cv-giphy-x" title="Close">✕</button></div>
          <div class="cv-up-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg><input class="cv-giphy-q" placeholder="Search GIPHY"></div>
          <div class="cv-giphy-grid"></div>
        </div>
      </div>`);
      const grid = ov.querySelector(".cv-giphy-grid"), q = ov.querySelector(".cv-giphy-q");
      const close = () => ov.remove();
      ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
      ov.querySelector(".cv-giphy-x").onclick = close;
      const load = (url) => {
        grid.innerHTML = `<div class="cv-empty">Loading…</div>`;
        fetch(url).then((r) => r.json()).then((j) => {
          grid.innerHTML = "";
          const items = j.data || [];
          if (!items.length) { grid.appendChild(el(`<div class="cv-empty">No GIFs found.</div>`)); return; }
          items.forEach((g) => {
            const img = g.images || {}, src = (img.fixed_width && img.fixed_width.url) || (img.original && img.original.url);
            if (!src) return;
            const b = el(`<button class="cv-giphy-card"><img src="${esc(src)}" alt="" draggable="false"></button>`);
            b.onclick = () => { addImage(src); close(); };
            grid.appendChild(b);
          });
        }).catch(() => { grid.innerHTML = `<div class="cv-empty">Couldn't reach GIPHY.</div>`; });
      };
      load(trending);
      let deb;
      q.oninput = () => { clearTimeout(deb); const v = q.value.trim(); deb = setTimeout(() => load(v ? `https://api.giphy.com/v1/gifs/search?api_key=${key}&q=${encodeURIComponent(v)}&limit=24&rating=g` : trending), 300); };
      body.querySelector(".cv").appendChild(ov);
    }

    function openImagePicker(onPick) {
      const pick = onPick || addImage;
      const ov = el(`<div class="cv-imgpick">
        <div class="cv-imgpick-card">
          <div class="cv-imgpick-h">Add an image</div>
          <button class="cv-imgpick-btn cv-ip-upload">⬆ Upload from device</button>
          <button class="cv-imgpick-btn cv-ip-brand">✦ Brand logo</button>
          <button class="cv-imgpick-btn cv-ip-url">🔗 Paste image URL</button>
          <button class="cv-imgpick-x">Cancel</button>
        </div>
      </div>`);
      const close = () => ov.remove();
      ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
      ov.querySelector(".cv-imgpick-x").onclick = close;
      ov.querySelector(".cv-ip-upload").onclick = () => {
        const inp = document.createElement("input");
        inp.type = "file"; inp.accept = "image/*";
        inp.onchange = () => {
          const f = inp.files && inp.files[0]; if (!f) return;
          const r = new FileReader();
          r.onload = () => { pick(r.result); close(); };
          r.readAsDataURL(f);
        };
        inp.click();
      };
      ov.querySelector(".cv-ip-brand").onclick = () => {
        const d = prompt("Brand or website (e.g. spotify.com):");
        if (!d) return;
        const domain = d.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
        const src = window.Icon && Icon.brandLogoUrl ? Icon.brandLogoUrl(domain) : `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
        pick(src); close();
      };
      ov.querySelector(".cv-ip-url").onclick = () => {
        const u = prompt("Image URL:");
        if (!u) return;
        pick(u.trim()); close();
      };
      body.querySelector(".cv").appendChild(ov);
    }

    // Frames: a shaped placeholder you drop a picture into (image is clipped to the shape).
    function addFrame(shape) {
      design.els.push({ t: "frame", shape: shape, x: 60, y: 60, w: 200, h: 200, src: null });
      render(); selectEl(design.els.length - 1); record();
    }
    function fillFrame() {
      if (sel == null || !design.els[sel] || design.els[sel].t !== "frame") return;
      const idx = sel;
      openImagePicker((src) => { design.els[idx].src = src; render(); selectEl(idx); record(); });
    }

    // Remove the background of the selected image via the remove.bg API.
    function removeBg() {
      if (sel == null || !design.els[sel] || design.els[sel].t !== "image") return;
      const idx = sel, e = design.els[idx];
      const key = window.POOF_API_KEY;
      if (!key) { if (window.Notify) Notify.show({ title: "Canva", body: "No Poof API key configured." }); return; }
      const prog = window.ProgressUI ? ProgressUI.show(body.querySelector(".cv-stage-wrap"), { title: "Removing background…", subtitle: "poof.bg", etaMs: 7000, cancel: false }) : null;
      // Poof takes a multipart image_file only, so we must send the raw bytes. Data URLs and
      // same-origin assets fetch directly; remote images are CORS-blocked, so proxy those.
      const isRemote = /^https?:\/\//i.test(e.src) && e.src.indexOf(location.origin) !== 0;
      const proxy = (u) => "https://api.allorigins.win/raw?url=" + encodeURIComponent(u);
      const getBytes = () => {
        if (isRemote) return fetch(proxy(e.src)).then((r) => { if (!r.ok) throw new Error("image " + r.status); return r.blob(); });
        return fetch(e.src).then((r) => { if (!r.ok) throw new Error("image " + r.status); return r.blob(); })
          .catch(() => fetch(proxy(e.src)).then((r) => r.blob()));   // fallback if direct fetch is blocked
      };
      getBytes()
        .then((blob) => { const fd = new FormData(); fd.append("image_file", blob, "image.png");
          return fetch("https://api.poof.bg/v1/remove", { method: "POST", headers: { "x-api-key": key }, body: fd }); })
        .then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.blob(); })
        .then((blob) => new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); }))
        .then((dataUrl) => { design.els[idx].src = dataUrl; render(); selectEl(idx); record(); if (prog) prog.complete(); if (window.Notify) Notify.show({ icon: window.Icon ? Icon.mini("canva", "Canva") : "", title: "Canva", body: "Background removed." }); })
        .catch((err) => { if (prog) prog.remove(); if (window.Notify) Notify.show({ title: "Canva", body: "Couldn't remove background (" + err.message + ")." }); });
    }

    // ---- Left rail: switch the panel body per rail item ---------------------
    const panelBody = body.querySelector(".cv-panel-body");
    function placeholder(title, desc) { return `<div class="cv-panel-h">${esc(title)}</div><div class="cv-empty">${esc(desc)}</div>`; }

    function showPanel(id) {
      body.querySelectorAll(".cv-rail-btn").forEach((b) => b.classList.toggle("on", b.dataset.rail === id));
      const P = panelBody;
      if (id === "templates") {
        P.innerHTML = `<div class="cv-panel-h">Templates</div><div class="cv-tpl-list"></div>`;
        const list = P.querySelector(".cv-tpl-list");
        TEMPLATES.forEach((t) => {
          const c = el(`<button class="cv-tpl-card" style="background:${t.bg}"><span>${esc(t.name)}</span></button>`);
          c.onclick = () => { design.bg = t.bg; stage.style.background = t.bg; design.els = JSON.parse(JSON.stringify(t.els)); render(); selectEl(null); record(); };
          list.appendChild(c);
        });
      } else if (id === "elements") {
        P.innerHTML = `<div class="cv-panel-h">Shapes</div>
          <button class="cv-tool" data-add="rect">▭ Rectangle</button>
          <button class="cv-tool" data-add="circle">● Circle</button>
          <div class="cv-panel-h">Frames</div>
          <div class="cv-frame-grid"></div>
          <div class="cv-panel-h">Graphics</div>
          <div class="cv-el-grid"></div>`;
        const fgrid = P.querySelector(".cv-frame-grid");
        FRAMES.forEach((f) => {
          const c = el(`<button class="cv-frame-card" title="${esc(f.name)} frame"><span class="cv-frame-mini cv-frame-${f.shape}"></span></button>`);
          c.onclick = () => addFrame(f.shape);
          fgrid.appendChild(c);
        });
        const grid = P.querySelector(".cv-el-grid");
        ELEMENTS.forEach((g) => {
          const c = el(`<button class="cv-el-card" title="${esc(g.name)}"><img src="${esc(g.src)}?v=1" alt="${esc(g.name)}" draggable="false"></button>`);
          c.onclick = () => addImage(g.src);
          grid.appendChild(c);
        });
      } else if (id === "text") {
        P.innerHTML = `
          <div class="cv-up-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg><input placeholder="Search fonts and combinations"></div>
          <button class="cv-txt-add" data-add="text"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 6h14M12 6v13M9 19h6"/></svg>Add a text box</button>
          <button class="cv-txt-magic">✎ Magic Write</button>
          <div class="cv-txt-team"><span class="cv-txt-teamname">${esc(profileName())}'s Team ▾</span><button class="cv-txt-edit">Edit</button></div>
          <button class="cv-txt-brandfonts"><svg class="cv-upfont-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 18a4 4 0 0 1-1-7.9A5 5 0 0 1 16 8.5a3.5 3.5 0 0 1 1 6.8"/><path d="M12 21v-8M9 16l3-3 3 3"/></svg> Add your brand fonts <img src="assets/cv_pro.png?v=1" class="cv-inline-crown" alt="Pro"></button>
          <div class="cv-panel-h">Default text styles</div>
          <button class="cv-txt-style" data-role="heading">Add a heading</button>
          <button class="cv-txt-style" data-role="subheading">Add a subheading</button>
          <button class="cv-txt-style" data-role="body">Add a little bit of body text</button>
          <div class="cv-panel-h">Dynamic text</div>
          ${ty.id === "video" ? `<button class="cv-dyn cv-dyn-captions"><span class="cv-dyn-ic"><img src="assets/cv_dyn_captions.png?v=1" alt=""></span>Captions</button>` : ""}
          <button class="cv-dyn cv-dyn-pagenum"><span class="cv-dyn-ic"><img src="assets/cv_dyn_pagenum.png?v=1" alt=""></span>Page numbers</button>`;
        const styles = { heading: { text: "Add a heading", size: 48, bold: true }, subheading: { text: "Add a subheading", size: 30, bold: true }, body: { text: "Add a little bit of body text", size: 18, bold: false } };
        P.querySelectorAll(".cv-txt-style").forEach((b) => b.onclick = () => {
          const s = styles[b.dataset.role];
          design.els.push({ t: "text", x: 40, y: 40, text: s.text, size: s.size, color: "#111111", bold: s.bold });
          render(); selectEl(design.els.length - 1);
        });
        const t2 = (m) => { if (window.Notify) Notify.show({ icon: window.Icon ? Icon.mini("canva", "Canva") : "", title: "Canva", body: m }); };
        P.querySelector(".cv-txt-magic").onclick = () => magicWrite();
        P.querySelector(".cv-txt-edit").onclick = () => uploadFont();
        P.querySelector(".cv-txt-brandfonts").onclick = () => uploadFont();
        P.querySelector(".cv-dyn-pagenum").onclick = () => {
          design.els.push({ t: "text", x: ty.w - 62, y: ty.h - 52, text: "1", size: 24, color: "#111111", bold: true });
          render(); selectEl(design.els.length - 1); record();
        };
        const capBtn = P.querySelector(".cv-dyn-captions"); if (capBtn) capBtn.onclick = () => {};   // video only, not wired yet
      } else if (id === "uploads") {
        const c = store(); if (!c.uploads) c.uploads = [];
        P.innerHTML = `
          <div class="cv-up-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg><input class="cv-up-q" placeholder="Search keywords, tags, color"></div>
          <div class="cv-up-row">
            <button class="cv-up-upload">Upload files</button>
            <button class="cv-up-more" title="More">•••</button>
          </div>
          <button class="cv-up-record">Record yourself</button>
          <div class="cv-up-tabs">
            <button class="cv-up-tab on" data-tab="images">Images</button>
            <button class="cv-up-tab" data-tab="videos">Videos</button>
            <button class="cv-up-tab" data-tab="audio">Audio</button>
            <button class="cv-up-tab" data-tab="designs">Designs</button>
            <button class="cv-up-tab" data-tab="folders">Folders</button>
          </div>
          <div class="cv-up-grid"></div>`;
        const grid = P.querySelector(".cv-up-grid"), q = P.querySelector(".cv-up-q");
        const draw = (filter) => {
          grid.innerHTML = "";
          const items = c.uploads.filter((u) => !filter || (u.name || "").toLowerCase().includes(filter.toLowerCase()));
          if (!items.length) { grid.appendChild(el(`<div class="cv-empty">Your uploaded images show up here. Tap Upload files to add some.</div>`)); return; }
          items.forEach((u) => { const b = el(`<button class="cv-el-card" title="${esc(u.name || "")}"><img src="${esc(u.src)}" alt="" draggable="false"></button>`); b.onclick = () => addImage(u.src); grid.appendChild(b); });
        };
        draw("");
        q.oninput = (e) => draw(e.target.value);
        P.querySelector(".cv-up-upload").onclick = () => {
          const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*"; inp.multiple = true;
          inp.onchange = () => { const files = Array.from(inp.files || []); let pending = files.length; if (!pending) return;
            files.forEach((f) => { const r = new FileReader(); r.onload = () => { c.uploads.unshift({ src: r.result, name: f.name }); State.save(); if (--pending === 0) draw(q.value); }; r.readAsDataURL(f); }); };
          inp.click();
        };
        P.querySelector(".cv-up-more").onclick = () => openImagePicker();
        P.querySelector(".cv-up-record").onclick = () => { if (window.Notify) Notify.show({ icon: window.Icon ? Icon.mini("canva", "Canva") : "", title: "Canva", body: "Recording is coming soon." }); };
        P.querySelectorAll(".cv-up-tab").forEach((t) => t.onclick = () => {
          P.querySelectorAll(".cv-up-tab").forEach((x) => x.classList.toggle("on", x === t));
          if (t.dataset.tab === "images") draw(q.value);
          else { grid.innerHTML = ""; grid.appendChild(el(`<div class="cv-empty">No ${esc(t.textContent.toLowerCase())} yet.</div>`)); }
        });
      } else if (id === "background") {
        P.innerHTML = `<div class="cv-panel-h">Background</div><div class="cv-swatches cv-bg-sw"></div>`;
        colorPanel(P.querySelector(".cv-bg-sw"), (c) => { design.bg = c; stage.style.background = c; record(); });
      } else if (id === "brand") {
        P.innerHTML = `<div class="cv-panel-h">Brand Kit</div>
          <div class="cv-swatches cv-brand-sw"></div>
          <button class="cv-tool cv-brand-logo">✦ Add your logo</button>`;
        colorPanel(P.querySelector(".cv-brand-sw"), (c) => { if (sel != null) { design.els[sel].color = c; render(); selectEl(sel); } else { design.bg = c; stage.style.background = c; } record(); });
        P.querySelector(".cv-brand-logo").onclick = () => {
          const d = prompt("Brand or website (e.g. spotify.com):"); if (!d) return;
          const domain = d.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
          addImage(window.Icon && Icon.brandLogoUrl ? Icon.brandLogoUrl(domain) : `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`);
        };
      } else if (id === "projects") {
        P.innerHTML = `<div class="cv-panel-h">Projects</div><div class="cv-proj-list"></div>`;
        const list = P.querySelector(".cv-proj-list"), ds = store().designs || [];
        if (!ds.length) list.appendChild(el(`<div class="cv-empty">No saved designs yet.</div>`));
        ds.forEach((d, i) => {
          const c = el(`<button class="cv-proj-card"><span class="cv-proj-sw" style="background:${d.bg}"></span>${esc(d.name || "Untitled")}</button>`);
          c.onclick = () => { saveDesign(); editor(body, ref, JSON.parse(JSON.stringify(d)), i); };
          list.appendChild(c);
        });
      } else if (id === "charts") {
        P.innerHTML = `<div class="cv-panel-h">Charts</div><button class="cv-tool cv-add-chart">📊 Add a bar chart</button>`;
        P.querySelector(".cv-add-chart").onclick = () => {
          const vals = [80, 130, 60, 160, 110]; const bw = 26, gap = 16; let x = 40;
          vals.forEach((v) => { design.els.push({ t: "rect", x, y: 260 - v, w: bw, h: v, color: "#7b2ae8" }); x += bw + gap; });
          render(); selectEl(null); record();
        };
      } else if (id === "ai") {
        P.innerHTML = `
          <div class="cv-ai-h">What shall we do with this design?</div>
          <button class="cv-ai-pill" data-ai="redesign"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v3M12 17v3M4 12h3M17 12h3M6.3 6.3l2 2M15.7 15.7l2 2M17.7 6.3l-2 2M8.3 15.7l-2 2"/></svg>Redesign this page</button>
          <button class="cv-ai-pill" data-ai="bg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="14" height="12" rx="2"/><path d="M6 15l3-3 3 2 2-2 3 3"/><circle cx="8.5" cy="9" r="1"/><path d="M19 9v8M15 13h8"/></svg>Add background</button>
          <button class="cv-ai-pill" data-ai="style"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="12" height="6" rx="1.5"/><path d="M16 7h3v4h-7v3"/><rect x="9" y="14" width="5" height="5" rx="1"/></svg>Change style</button>
          <div class="cv-ai-box">
            <textarea class="cv-ai-input" placeholder="Describe your idea"></textarea>
            <div class="cv-ai-boxbar"><button class="cv-ai-plus" title="Generate a design">＋</button><button class="cv-ai-img" title="Generate an image">🎨 Image</button><span class="grow"></span><button class="cv-ai-mic" title="Voice">🎙</button></div>
          </div>`;
        const t3 = (m) => { if (window.Notify) Notify.show({ icon: window.Icon ? Icon.mini("canva", "Canva") : "", title: "Canva AI", body: m }); };
        const GRADS = ["linear-gradient(135deg,#ff7e5f,#feb47b)", "linear-gradient(135deg,#2193b0,#6dd5ed)", "linear-gradient(135deg,#8e2de2,#4a00e0)", "linear-gradient(135deg,#11998e,#38ef7d)", "linear-gradient(135deg,#fc5c7d,#6a82fb)", "linear-gradient(135deg,#f7971e,#ffd200)", "linear-gradient(135deg,#c471f5,#fa71cd)"];
        P.querySelector('[data-ai="redesign"]').onclick = () => applyStyle(true);
        P.querySelector('[data-ai="bg"]').onclick = () => { let g; do { g = GRADS[Math.floor(Math.random() * GRADS.length)]; } while (g === design.bg && GRADS.length > 1); design.bg = g; stage.style.background = g; record(); t3("Added a fresh background."); };
        P.querySelector('[data-ai="style"]').onclick = () => applyStyle(false);
        const aiInput = P.querySelector(".cv-ai-input");
        P.querySelector(".cv-ai-plus").onclick = () => { generateDesign(aiInput.value); aiInput.value = ""; };
        P.querySelector(".cv-ai-img").onclick = () => { generateImage(aiInput.value); };
        aiInput.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); generateDesign(aiInput.value); aiInput.value = ""; } });
        P.querySelector(".cv-ai-mic").onclick = () => t3("Voice input is coming soon.");
      } else if (id === "tools") {
        P.innerHTML = `<div class="cv-panel-h">Tools</div><div class="cv-tools-palette">
          <button class="cv-tp on" data-tool="select" title="Select"><svg viewBox="0 0 24 24" fill="none" stroke="#7b2ae8" stroke-width="1.8" stroke-linejoin="round"><path d="M6 4l13 6-5.5 1.6L11 19z"/></svg></button>
          <button class="cv-tp" data-tool="pen" title="Draw"><svg viewBox="0 0 24 24" fill="none" stroke="#e14b3b" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l4 4-8 8-4 1 1-4z"/><path d="M4 20c2-2 4 0 6-1"/></svg></button>
          <button class="cv-tp" data-tool="shape" title="Shapes"><svg viewBox="0 0 24 24"><circle cx="9" cy="10" r="5" fill="#4b4b57"/><rect x="12" y="12" width="8" height="8" rx="1.5" fill="#1c1c28"/></svg></button>
          <button class="cv-tp" data-tool="line" title="Line"><svg viewBox="0 0 24 24" stroke="#3a86ff" stroke-width="3" stroke-linecap="round"><path d="M6 18L18 6"/></svg></button>
          <button class="cv-tp" data-tool="sticky" title="Sticky note"><svg viewBox="0 0 24 24"><path d="M5 5h14v10l-4 4H5z" fill="#ffcf3f"/><path d="M15 19v-4h4z" fill="#e5b52f"/></svg></button>
          <button class="cv-tp" data-tool="text" title="Text"><svg viewBox="0 0 24 24" fill="none" stroke="#7b2ae8" stroke-width="2.2" stroke-linecap="round"><path d="M5 6h14M12 6v13M9 19h6"/></svg></button>
          <button class="cv-tp" data-tool="sign" title="Signature"><svg viewBox="0 0 24 24" fill="none" stroke="#1c1c28" stroke-width="1.6" stroke-linecap="round"><path d="M4 16c3 0 3-8 5-8s1 8 3 8 2-4 3-4"/><path d="M6 19h12"/></svg></button>
          <button class="cv-tp" data-tool="table" title="Table"><svg viewBox="0 0 24 24" fill="#26307a"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="6" y="6" width="4" height="4" fill="#fff"/><rect x="11" y="6" width="4" height="4" fill="#fff"/><rect x="6" y="11" width="4" height="4" fill="#fff"/><rect x="11" y="11" width="4" height="4" fill="#fff"/></svg></button>
        </div>`;
        const tt = (m) => { if (window.Notify) Notify.show({ icon: window.Icon ? Icon.mini("canva", "Canva") : "", title: "Canva", body: m }); };
        const setTool = (b) => P.querySelectorAll(".cv-tp").forEach((x) => x.classList.toggle("on", x === b));
        P.querySelectorAll(".cv-tp").forEach((b) => b.onclick = () => {
          setTool(b);
          const t = b.dataset.tool;
          if (t === "select") { disableDraw(); selectEl(null); }
          else if (t === "pen") enableDraw({ color: "#1c1c28", width: 6 });
          else if (t === "sign") enableDraw({ color: "#1c1c28", width: 3 });
          else if (t === "text") { disableDraw(); design.els.push({ t: "text", x: 40, y: 40, text: "Your text", size: 36, color: "#111111" }); render(); selectEl(design.els.length - 1); record(); }
          else if (t === "shape") { disableDraw(); design.els.push({ t: "circle", x: 60, y: 60, w: 140, h: 140, color: "#7b5cff" }); render(); selectEl(design.els.length - 1); record(); }
          else if (t === "line") { disableDraw(); design.els.push({ t: "rect", x: 60, y: 200, w: 220, h: 6, color: "#3a86ff" }); render(); selectEl(design.els.length - 1); record(); }
          else if (t === "sticky") { disableDraw(); design.els.push({ t: "rect", x: 60, y: 60, w: 180, h: 160, color: "#ffd54a" }); render(); selectEl(design.els.length - 1); record(); }
          else if (t === "table") { disableDraw(); addTable(); }
          else tt(b.title + " is coming soon.");
        });
      } else if (id === "apps") {
        P.innerHTML = `
          <div class="cv-up-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg><input placeholder="Search Canva apps"></div>
          <div class="cv-up-tabs"><button class="cv-up-tab on" data-atab="discover">Discover</button><button class="cv-up-tab" data-atab="your">Your apps</button></div>
          <div class="cv-app-pills"><button class="cv-app-pill on">For you</button><button class="cv-app-pill">AI generation</button><button class="cv-app-pill">Audio and video</button></div>
          <div class="cv-panel-h">Collections</div>
          <div class="cv-app-collection">
            <div class="cv-coll-text"><b>Your go-to apps, in Canva AI</b><span>Connect your workflows. Bring your favorite tools into Canva AI.</span></div>
            <div class="cv-coll-icons"><img src="assets/gapp_gmail.png?v=1"><img src="assets/gapp_meet.png?v=1"><img src="assets/gapp_calendar.png?v=1"><img src="assets/gapp_drive.png?v=1"></div>
          </div>
          <div class="cv-panel-h">Made for video</div>
          <div class="cv-app-list"></div>
          <div class="cv-panel-h">Trending</div>
          <div class="cv-app-trending">
            <div class="cv-trend-card" style="background:linear-gradient(135deg,#ffe3c2,#ffd0a0)"><span>Make text stand out with TypeGradient ›</span></div>
            <div class="cv-trend-card" style="background:linear-gradient(135deg,#5b7cff,#8b5cff);color:#fff"><span>Fill text with TypeCutout ›</span></div>
          </div>`;
        const APPS = [
          { name: "Simplebooklet", desc: "Publish and track flipbooks.", c: "#f0932b", emoji: "📖" },
          { name: "GIPHY", desc: "Add GIFs to your designs.", c: "#111111", img: "assets/cv_app_giphy.png" },
          { name: "D-ID AI Avatars", desc: "Add a talking head video.", c: "#5b6cf0", emoji: "🧑" },
          { name: "YouTube", desc: "Embed videos in your design.", c: "#ff0000", emoji: "▶️" },
          { name: "Mockups", desc: "Put your design on products.", c: "#22b573", emoji: "🖼️" },
        ];
        const alist = P.querySelector(".cv-app-list");
        const drawApps = () => { alist.innerHTML = ""; APPS.forEach((a) => {
          const icon = a.img ? `<span class="cv-app-ic cv-app-ic-img"><img src="${esc(a.img)}?v=1" alt="${esc(a.name)}"></span>` : `<span class="cv-app-ic" style="background:${a.c}">${a.emoji}</span>`;
          const row = el(`<button class="cv-app-row">${icon}<span class="cv-app-meta"><span class="cv-app-name">${esc(a.name)}</span><span class="cv-app-desc">${esc(a.desc)}</span></span><span class="cv-app-more">•••</span></button>`);
          row.onclick = () => { if (a.name === "GIPHY") openGiphy(); else if (window.Notify) Notify.show({ icon: window.Icon ? Icon.mini("canva", "Canva") : "", title: "Canva", body: a.name + " — coming soon." }); };
          alist.appendChild(row); }); };
        drawApps();
        P.querySelectorAll(".cv-app-pill").forEach((p) => p.onclick = () => P.querySelectorAll(".cv-app-pill").forEach((x) => x.classList.toggle("on", x === p)));
        P.querySelectorAll(".cv-up-tab").forEach((t) => t.onclick = () => {
          P.querySelectorAll(".cv-up-tab").forEach((x) => x.classList.toggle("on", x === t));
          if (t.dataset.atab === "your") { alist.innerHTML = ""; alist.appendChild(el(`<div class="cv-empty">You haven't added any apps yet.</div>`)); }
          else drawApps();
        });
      } else {
        const meta = { components: "Reusable building blocks for your design.", audio: "Add background music and sound effects.", videos: "Drop in video clips and animations.", bulk: "Create many designs at once from your data.", translate: "Translate your design into another language." };
        P.innerHTML = placeholder((RAIL.find((r) => r.id === id) || {}).label || "Canva", meta[id] || "Coming soon.");
      }
    }

    body.querySelector(".cv-rail").addEventListener("click", (ev) => {
      const b = ev.target.closest(".cv-rail-btn"); if (!b) return;
      if (b.dataset.rail === "brand") requirePremium(() => showPanel("brand")); else showPanel(b.dataset.rail);
    });
    // Delegate panel actions so dynamically-built tool buttons keep working.
    body.querySelector(".cv-panel").addEventListener("click", (ev) => {
      const add = ev.target.closest("[data-add]"); if (add) { addEl(add.dataset.add); return; }
      if (ev.target.closest(".cv-add-image")) openImagePicker();
    });
    showPanel("templates");

    // Bottom bar: functional zoom slider + placeholder actions.
    const zoom = body.querySelector(".cv-zoom"), zoomVal = body.querySelector(".cv-zoom-val");
    const setZoom = (z) => { stage.style.transform = `scale(${z / 100})`; zoomVal.textContent = z + "%"; };
    zoom.oninput = () => setZoom(+zoom.value);
    const bbToast = (m) => { if (window.Notify) Notify.show({ icon: window.Icon ? Icon.mini("canva", "Canva") : "", title: "Canva", body: m }); };
    body.querySelector(".cv-bb-notes").onclick = () => bbToast("Notes are coming soon.");
    body.querySelector(".cv-bb-timer").onclick = () => bbToast("Presenter timer is coming soon.");
    body.querySelector(".cv-bb-pages").onclick = () => bbToast("Page manager is coming soon.");
    body.querySelector(".cv-bb-grid").onclick = () => bbToast("Grid view is coming soon.");
    body.querySelector(".cv-bb-expand").onclick = () => bbToast("Full screen is coming soon.");
    body.querySelector(".cv-bb-help").onclick = () => bbToast("Help is coming soon.");
    // Video timeline: play button sweeps a playhead over 5 seconds.
    const tlPlay = body.querySelector(".cv-tl-play"), playhead = body.querySelector(".cv-tl-playhead"), tlCur = body.querySelector(".cv-tl-cur");
    if (tlPlay) {
      let tlRaf = null, tlPlaying = false;
      tlPlay.onclick = () => {
        if (tlPlaying) { tlPlaying = false; if (tlRaf) cancelAnimationFrame(tlRaf); tlPlay.textContent = "▶"; return; }
        tlPlaying = true; tlPlay.textContent = "❚❚"; const dur = 5000; let start = null;
        const loop = (ts) => { if (!tlPlaying) return; if (!start) start = ts; const p = Math.min(1, (ts - start) / dur); playhead.style.left = (p * 100) + "%"; tlCur.textContent = "0:0" + Math.floor(p * 5); if (p < 1) { tlRaf = requestAnimationFrame(loop); } else { tlPlaying = false; tlPlay.textContent = "▶"; } };
        tlRaf = requestAnimationFrame(loop);
      };
    }

    body.querySelector(".cv-title").oninput = (e) => { design.name = e.target.value; };
    body.querySelector(".cv-back").onclick = () => { saveDesign(); home(body, ref); };
    body.querySelector(".cv-dl").onclick = () => {
      saveDesign();
      if (window.Notify) Notify.show({ icon: window.Icon ? Icon.mini("canva", "Canva") : "", title: "Canva", body: `“${design.name}” downloaded (${ty.w}×${ty.h}).` });
    };
    body.querySelector(".cv-share-btn").onclick = () => openShare();

    function openShare() {
      saveDesign();
      const link = `https://canva.com/design/${(design.name || "untitled").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Math.random().toString(36).slice(2, 8)}`;
      const share = (m) => { if (window.Notify) Notify.show({ icon: window.Icon ? Icon.mini("canva", "Canva") : "", title: "Canva", body: m }); };
      const items = [
        { k: "download", label: "Download", emoji: "⬇️" }, { k: "brand", label: "Brand Template", emoji: "🗂️" },
        { k: "present", label: "Present", emoji: "▶️", c: "#e8562a" }, { k: "public", label: "Public view link", emoji: "🔗" },
        { k: "record", label: "Present and record", emoji: "🎥" }, { k: "website", label: "Website", emoji: "🌐", c: "#5b3df5" },
        { k: "ppt", label: "Microsoft PowerPoint", emoji: "📊", c: "#c43e1c" }, { k: "all", label: "See all", emoji: "•••" },
      ];
      const ov = el(`<div class="cv-imgpick cv-share-ov">
        <div class="cv-share">
          <div class="cv-share-toprow"><h3>Share design</h3><span class="cv-share-vis">📊 0 visitors</span><button class="cv-share-gear" title="Settings">⚙</button></div>
          <div class="cv-share-h">People with access</div>
          <div class="cv-up-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg><input placeholder="Add people"></div>
          <div class="cv-share-ppl"><span class="cv-share-av">${esc((profileName()[0] || "Y").toUpperCase())}</span><button class="cv-share-addp">＋</button></div>
          <div class="cv-share-h">Access level</div>
          <button class="cv-share-access"><span class="cv-share-lock">🔒</span>Only you can access<span class="cv-share-caret">⌄</span></button>
          <button class="cv-share-copy">🔗 Copy link</button>
          <div class="cv-share-perso">Personalize your link <img src="assets/cv_pro.png?v=1" class="cv-share-crown" alt="Pro"></div>
          <div class="cv-share-sep"></div>
          <div class="cv-share-grid">${items.map((i) => `<button class="cv-share-opt" data-k="${i.k}"><span class="cv-share-opt-ic" style="${i.c ? `background:${i.c};color:#fff` : ""}">${i.emoji}</span><span class="cv-share-opt-l">${esc(i.label)}</span></button>`).join("")}</div>
        </div>
      </div>`);
      const close = () => ov.remove();
      ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
      ov.querySelector(".cv-share-copy").onclick = () => {
        const done = () => share("Link copied to clipboard.");
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(done).catch(done); else done();
      };
      ov.querySelector(".cv-share-gear").onclick = () => share("Share settings are coming soon.");
      ov.querySelector(".cv-share-addp").onclick = () => share("Collaborators are coming soon.");
      ov.querySelector(".cv-share-access").onclick = () => share("More access levels are coming soon.");
      ov.querySelector(".cv-share-perso").onclick = () => share("Personalized links are coming soon.");
      ov.querySelectorAll(".cv-share-opt").forEach((b) => b.onclick = () => {
        if (b.dataset.k === "download") { close(); share(`“${design.name}” downloaded (${ty.w}×${ty.h}).`); }
        else share((items.find((i) => i.k === b.dataset.k) || {}).label + " — coming soon.");
      });
      body.querySelector(".cv").appendChild(ov);
    }

    // ---- Undo / redo history + keyboard shortcuts --------------------------
    let past = [], future = [];
    function snapshot() { return JSON.stringify({ els: design.els, bg: design.bg }); }
    let present = snapshot();
    function record() { past.push(present); if (past.length > 60) past.shift(); present = snapshot(); future.length = 0; saveDesign(); flashSaved(); }
    function restore(s) { const o = JSON.parse(s); design.els = o.els; design.bg = o.bg; stage.style.background = design.bg; render(); selectEl(null); saveDesign(); }
    function undo() { if (!past.length) return; future.push(present); present = past.pop(); restore(present); }
    function redoHist() { if (!future.length) return; past.push(present); present = future.pop(); restore(present); }
    function duplicateSel() { if (sel == null || !design.els[sel]) return; const c = JSON.parse(JSON.stringify(design.els[sel])); c.x = (c.x || 0) + 16; c.y = (c.y || 0) + 16; design.els.push(c); render(); selectEl(design.els.length - 1); record(); }

    if (cvKeyHandler) document.removeEventListener("keydown", cvKeyHandler);
    cvKeyHandler = (e) => {
      if (!body.isConnected || !body.querySelector(".cv-edit")) return;
      const ae = document.activeElement, typing = ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || ae.isContentEditable);
      const meta = e.ctrlKey || e.metaKey, k = (e.key || "").toLowerCase();
      if (e.key === "Escape") { disableDraw(); selectEl(null); return; }
      if (meta && k === "z") { e.preventDefault(); e.shiftKey ? redoHist() : undo(); return; }
      if (meta && k === "y") { e.preventDefault(); redoHist(); return; }
      if (typing) {
        if (meta && sel != null && design.els[sel] && design.els[sel].t === "text" && ["b", "i", "u"].includes(k)) {
          e.preventDefault(); const m = { b: "bold", i: "italic", u: "underline" }; design.els[sel][m[k]] = !design.els[sel][m[k]]; render(); selectEl(sel); record();
        }
        return;
      }
      if (meta && k === "c") { copySel(); return; }
      if (meta && k === "x") { if (sel != null) { e.preventDefault(); cutSel(); } return; }
      if (meta && k === "v") { e.preventDefault(); pasteClip(); return; }
      if (sel == null) return;
      if (meta && k === "d") { e.preventDefault(); duplicateSel(); return; }
      if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); design.els.splice(sel, 1); sel = null; render(); selectEl(null); record(); return; }
      const step = e.shiftKey ? 10 : 1, se = design.els[sel];
      if (e.key === "ArrowLeft") { e.preventDefault(); se.x -= step; render(); selectEl(sel); }
      else if (e.key === "ArrowRight") { e.preventDefault(); se.x += step; render(); selectEl(sel); }
      else if (e.key === "ArrowUp") { e.preventDefault(); se.y -= step; render(); selectEl(sel); }
      else if (e.key === "ArrowDown") { e.preventDefault(); se.y += step; render(); selectEl(sel); }
      else return;
    };
    document.addEventListener("keydown", cvKeyHandler);

    function saveDesign() {
      const st = store();
      if (existingIndex != null && st.designs[existingIndex]) st.designs[existingIndex] = design;
      else { st.designs.unshift(design); existingIndex = 0; }
      State.save();
    }
  }

  if (window.Icon && Icon.register) {
    Icon.register("canva", `<svg viewBox="0 0 128 128"><defs><linearGradient id="cvG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#00c4cc"/><stop offset=".5" stop-color="#7d2ae8"/><stop offset="1" stop-color="#5433ff"/></linearGradient></defs><circle cx="64" cy="64" r="60" fill="url(#cvG)"/><path d="M84 84a30 30 0 1 1 6-34" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round"/></svg>`);
  }

  window.AppRegistry = window.AppRegistry || {};
  window.AppRegistry.canva = open;
})();
