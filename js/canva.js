/* Canva — a lightweight design tool. Pick a design type, drop text/shapes on a
   canvas, drag & recolor them, and "download". Designs persist in appData.canva. */
(function () {
  "use strict";
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  const S = () => State.data;
  const cw = (o) => window.WM.createWindow(o);

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
  ];

  // Left editor rail — mirrors Canva's icon rail. `svg` is the inner markup of a 24×24 line icon.
  const RAIL = [
    { id: "templates", label: "Templates", svg: `<rect x="4" y="4" width="16" height="16" rx="2"/><line x1="12" y1="4" x2="12" y2="20"/><line x1="12" y1="12" x2="20" y2="12"/>` },
    { id: "elements", label: "Elements", svg: `<circle cx="8" cy="8" r="4"/><rect x="13" y="13" width="7" height="7" rx="1.2"/><path d="M4 20l4-6 4 6z"/>` },
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

  function open(createWindow) {
    const make = createWindow || window.WM.createWindow;
    const ref = make({ title: "Canva", icon: window.Icon ? Icon.mini("canva", "Canva") : "", width: 1000, height: 660, appId: "canva" });
    home(ref.body, ref);
    return ref;
  }

  function home(body, ref) {
    body.classList.add("cv-host");
    const recents = store().designs;
    body.innerHTML = `<div class="cv">
      <aside class="cv-side">
        <div class="cv-brand"><img class="cv-wordmark" src="assets/canva_wordmark.png?v=1" alt="Canva"></div>
        <button class="cv-nav on">🏠 Home</button>
        <button class="cv-nav">📁 Projects</button>
        <button class="cv-nav">✨ Brand</button>
        <button class="cv-nav">📐 Templates</button>
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
      const ic = t.img ? `<span class="cv-type-ic cv-type-img"><img src="${t.img}?v=1" alt=""></span>` : `<span class="cv-type-ic" style="background:${t.c}">${t.emoji}</span>`;
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
    body.querySelector(".cv-new").onclick = () => editor(body, ref, { type: "ig", bg: "#ffffff", els: [], name: "Untitled design" });
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
        <span class="grow"></span>
        <button class="cv-dl">⬇ Download</button>
        <button class="cv-share-btn">Share</button>
      </div>
      <div class="cv-subbar" style="display:none">
        <button class="cv-sb cv-sb-ask"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 6a4 4 0 1 0 0 8"/><path d="M18 4l.7 1.8L20.5 6.5 18.7 7.2 18 9l-.7-1.8L15.5 6.5 17.3 5.8z"/></svg>Ask Canva</button>
        <span class="cv-sb-div"></span>
        <button class="cv-sb cv-sb-edit">Edit</button>
        <span class="cv-sb-div"></span>
        <label class="cv-sb cv-sb-color" title="Color"><span class="cv-color-wheel"></span><input type="color" value="#7b5cff"></label>
        <button class="cv-sb cv-sb-animate">Animate</button>
        <button class="cv-sb cv-sb-position">Position</button>
        <span class="cv-sb-div"></span>
        <button class="cv-sb cv-sb-comment" title="Comment"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/><path d="M12 8v5M9.5 10.5h5"/></svg></button>
      </div>
      <div class="cv-work">
        <div class="cv-rail">${RAIL.map((r) => `<button class="cv-rail-btn" data-rail="${r.id}"><span class="cv-rail-ic">${r.pro ? '<img class="cv-rail-crown" src="assets/cv_pro.png?v=1" alt="Pro">' : ""}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${r.svg}</svg></span><span class="cv-rail-lbl">${esc(r.label)}</span></button>`).join("")}</div>
        <div class="cv-panel">
          <div class="cv-panel-body"></div>
          <div class="cv-panel-h cv-sel-h" style="display:none">Selected</div>
          <div class="cv-sel-tools" style="display:none">
            <div class="cv-swatches cv-el-sw"></div>
            <select class="cv-font" style="display:none">${FONTS.map((f) => `<option value="${esc(f)}" style="font-family:'${esc(f)}'">${esc(f)}</option>`).join("")}</select>
            <label class="cv-size-row" style="display:none">Size <input type="range" class="cv-size" min="10" max="120"></label>
            <button class="cv-rembg" style="display:none">✂ Remove background</button>
            <button class="cv-del">🗑 Delete</button>
          </div>
        </div>
        <div class="cv-stage-wrap">
          <div class="cv-stage" style="width:${ty.w}px;height:${ty.h}px;background:${design.bg}"></div>
        </div>
      </div>
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
    const selH = body.querySelector(".cv-sel-h"), selTools = body.querySelector(".cv-sel-tools"), sizeRow = body.querySelector(".cv-size-row"), sizeIn = body.querySelector(".cv-size"), rembgBtn = body.querySelector(".cv-rembg"), subbar = body.querySelector(".cv-subbar"), fontSel = body.querySelector(".cv-font");

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
    colorPanel(body.querySelector(".cv-el-sw"), (c) => { if (sel != null) { design.els[sel].color = c; render(); selectEl(sel); } });

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
      if (isText) fontSel.value = design.els[i].font || "Nunito";
      rembgBtn.style.display = has && design.els[i].t === "image" ? "block" : "none";
      subbar.style.display = has ? "flex" : "none";
    }
    fontSel.onchange = () => { if (sel != null && design.els[sel].t === "text") { design.els[sel].font = fontSel.value; render(); selectEl(sel); } };
    rembgBtn.onclick = () => removeBg();

    // Contextual toolbar (shown when an element is selected).
    const toast = (msg) => { if (window.Notify) Notify.show({ icon: window.Icon ? Icon.mini("canva", "Canva") : "", title: "Canva", body: msg }); };
    subbar.querySelector(".cv-sb-ask").onclick = () => toast("Ask Canva is coming soon.");
    subbar.querySelector(".cv-sb-edit").onclick = () => toast("Edit tools are in the left panel.");
    subbar.querySelector(".cv-sb-animate").onclick = () => toast("Animations are coming soon.");
    subbar.querySelector(".cv-sb-comment").onclick = () => toast("Comments are coming soon.");
    subbar.querySelector(".cv-sb-color input").oninput = (e) => { if (sel != null && design.els[sel].t !== "image") { design.els[sel].color = e.target.value; render(); selectEl(sel); } };
    subbar.querySelector(".cv-sb-position").onclick = () => {
      if (sel == null) return;
      const e = design.els.splice(sel, 1)[0]; design.els.push(e); render(); selectEl(design.els.length - 1);
    };
    sizeIn.oninput = () => {
      if (sel == null) return;
      const e = design.els[sel];
      if (e.t === "text") e.size = +sizeIn.value;
      else { const ratio = (e.h || 1) / (e.w || 1); e.w = +sizeIn.value; e.h = Math.round(e.w * ratio); }
      render(); selectEl(sel);
    };
    body.querySelector(".cv-del").onclick = () => { if (sel != null) { design.els.splice(sel, 1); sel = null; render(); selectEl(null); } };

    function render() {
      stage.innerHTML = "";
      design.els.forEach((e, i) => {
        let o;
        if (e.t === "text") o = el(`<div class="cv-obj cv-text" contenteditable="true" data-i="${i}" style="left:${e.x}px;top:${e.y}px;font-size:${e.size || 32}px;color:${e.color};font-weight:${e.bold ? 800 : 400};font-family:'${(e.font || "Nunito").replace(/'/g, "")}'">${esc(e.text || "Text")}</div>`);
        else if (e.t === "image") o = el(`<img class="cv-obj cv-image" data-i="${i}" src="${esc(e.src)}" alt="" draggable="false" style="left:${e.x}px;top:${e.y}px;width:${e.w || 160}px;height:${e.h || 160}px">`);
        else o = el(`<div class="cv-obj cv-shape" data-i="${i}" style="left:${e.x}px;top:${e.y}px;width:${e.w || 120}px;height:${e.h || 120}px;background:${e.color};border-radius:${e.t === "circle" ? "50%" : "6px"}"></div>`);
        if (e.t === "text") o.oninput = () => { e.text = o.textContent; };
        dragify(o, e, i);
        stage.appendChild(o);
      });
    }
    function dragify(o, e, i) {
      o.addEventListener("pointerdown", (ev) => {
        if (o.isContentEditable && document.activeElement === o) return;   // let text editing work
        selectEl(i);
        const r = stage.getBoundingClientRect(); const ox = ev.clientX - e.x, oy = ev.clientY - e.y;
        let moved = false;
        const mv = (m) => { moved = true; e.x = Math.max(0, Math.min(ty.w - 10, m.clientX - ox)); e.y = Math.max(0, Math.min(ty.h - 10, m.clientY - oy)); o.style.left = e.x + "px"; o.style.top = e.y + "px"; };
        const up = () => { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); };
        document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up);
      });
      o.addEventListener("click", (ev) => { ev.stopPropagation(); selectEl(i); });
    }
    stage.onclick = (ev) => { if (ev.target === stage) selectEl(null); };
    render();

    function addEl(kind) {
      if (kind === "text") design.els.push({ t: "text", x: 40, y: 40, text: "Your text", size: 36, color: "#111111" });
      else design.els.push({ t: kind, x: 60, y: 60, w: 140, h: 140, color: kind === "circle" ? "#7b5cff" : "#3a86ff" });
      render(); selectEl(design.els.length - 1);
    }

    // Drop an image element onto the stage, sizing it from the image's natural aspect ratio.
    function addImage(src) {
      const img = new Image();
      img.onload = () => {
        const maxW = Math.min(ty.w * 0.6, 360, img.naturalWidth || 240);
        const w = Math.max(60, Math.round(maxW));
        const ratio = (img.naturalHeight || 1) / (img.naturalWidth || 1);
        design.els.push({ t: "image", x: 40, y: 40, w, h: Math.round(w * ratio), src });
        render(); selectEl(design.els.length - 1);
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

    function openImagePicker() {
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
          r.onload = () => { addImage(r.result); close(); };
          r.readAsDataURL(f);
        };
        inp.click();
      };
      ov.querySelector(".cv-ip-brand").onclick = () => {
        const d = prompt("Brand or website (e.g. spotify.com):");
        if (!d) return;
        const domain = d.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
        const src = window.Icon && Icon.brandLogoUrl ? Icon.brandLogoUrl(domain) : `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
        addImage(src); close();
      };
      ov.querySelector(".cv-ip-url").onclick = () => {
        const u = prompt("Image URL:");
        if (!u) return;
        addImage(u.trim()); close();
      };
      body.querySelector(".cv").appendChild(ov);
    }

    // Remove the background of the selected image via the remove.bg API.
    function removeBg() {
      if (sel == null || !design.els[sel] || design.els[sel].t !== "image") return;
      const idx = sel, e = design.els[idx];
      const key = window.POOF_API_KEY;
      if (!key) { if (window.Notify) Notify.show({ title: "Canva", body: "No Poof API key configured." }); return; }
      const prog = window.ProgressUI ? ProgressUI.show(body.querySelector(".cv-stage-wrap"), { title: "Removing background…", subtitle: "poof.bg", etaMs: 7000, cancel: false }) : null;
      // Poof takes a multipart image_file only, so turn whatever src we have into a blob first.
      fetch(e.src).then((r) => r.blob())
        .then((blob) => { const fd = new FormData(); fd.append("image_file", blob, "image.png");
          return fetch("https://api.poof.bg/v1/remove", { method: "POST", headers: { "x-api-key": key }, body: fd }); })
        .then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.blob(); })
        .then((blob) => new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); }))
        .then((dataUrl) => { design.els[idx].src = dataUrl; render(); selectEl(idx); if (prog) prog.complete(); if (window.Notify) Notify.show({ icon: window.Icon ? Icon.mini("canva", "Canva") : "", title: "Canva", body: "Background removed." }); })
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
          c.onclick = () => { design.bg = t.bg; stage.style.background = t.bg; design.els = JSON.parse(JSON.stringify(t.els)); render(); selectEl(null); };
          list.appendChild(c);
        });
      } else if (id === "elements") {
        P.innerHTML = `<div class="cv-panel-h">Shapes</div>
          <button class="cv-tool" data-add="rect">▭ Rectangle</button>
          <button class="cv-tool" data-add="circle">● Circle</button>
          <div class="cv-panel-h">Graphics</div>
          <div class="cv-el-grid"></div>`;
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
          <button class="cv-txt-brandfonts">Add your brand fonts</button>
          <div class="cv-panel-h">Default text styles</div>
          <button class="cv-txt-style" data-role="heading">Add a heading</button>
          <button class="cv-txt-style" data-role="subheading">Add a subheading</button>
          <button class="cv-txt-style" data-role="body">Add a little bit of body text</button>
          <div class="cv-panel-h">Dynamic text</div>
          <button class="cv-tool cv-txt-pagenum">🔢 Page numbers</button>`;
        const styles = { heading: { text: "Add a heading", size: 48, bold: true }, subheading: { text: "Add a subheading", size: 30, bold: true }, body: { text: "Add a little bit of body text", size: 18, bold: false } };
        P.querySelectorAll(".cv-txt-style").forEach((b) => b.onclick = () => {
          const s = styles[b.dataset.role];
          design.els.push({ t: "text", x: 40, y: 40, text: s.text, size: s.size, color: "#111111", bold: s.bold });
          render(); selectEl(design.els.length - 1);
        });
        const t2 = (m) => { if (window.Notify) Notify.show({ icon: window.Icon ? Icon.mini("canva", "Canva") : "", title: "Canva", body: m }); };
        P.querySelector(".cv-txt-magic").onclick = () => t2("Magic Write is coming soon.");
        P.querySelector(".cv-txt-edit").onclick = () => t2("Brand fonts are coming soon.");
        P.querySelector(".cv-txt-brandfonts").onclick = () => t2("Brand fonts are coming soon.");
        P.querySelector(".cv-txt-pagenum").onclick = () => t2("Page numbers are coming soon.");
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
        colorPanel(P.querySelector(".cv-bg-sw"), (c) => { design.bg = c; stage.style.background = c; });
      } else if (id === "brand") {
        P.innerHTML = `<div class="cv-panel-h">Brand Kit</div>
          <div class="cv-swatches cv-brand-sw"></div>
          <button class="cv-tool cv-brand-logo">✦ Add your logo</button>`;
        colorPanel(P.querySelector(".cv-brand-sw"), (c) => { if (sel != null) { design.els[sel].color = c; render(); selectEl(sel); } else { design.bg = c; stage.style.background = c; } });
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
          render(); selectEl(null);
        };
      } else if (id === "ai") {
        P.innerHTML = `
          <div class="cv-ai-h">What shall we do with this design?</div>
          <button class="cv-ai-pill" data-ai="redesign"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v3M12 17v3M4 12h3M17 12h3M6.3 6.3l2 2M15.7 15.7l2 2M17.7 6.3l-2 2M8.3 15.7l-2 2"/></svg>Redesign this page</button>
          <button class="cv-ai-pill" data-ai="bg"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="14" height="12" rx="2"/><path d="M6 15l3-3 3 2 2-2 3 3"/><circle cx="8.5" cy="9" r="1"/><path d="M19 9v8M15 13h8"/></svg>Add background</button>
          <button class="cv-ai-pill" data-ai="style"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="12" height="6" rx="1.5"/><path d="M16 7h3v4h-7v3"/><rect x="9" y="14" width="5" height="5" rx="1"/></svg>Change style</button>
          <div class="cv-ai-box">
            <textarea class="cv-ai-input" placeholder="Describe your idea"></textarea>
            <div class="cv-ai-boxbar"><button class="cv-ai-plus" title="Add">＋</button><button class="cv-ai-mic" title="Voice">🎙</button></div>
          </div>`;
        const t3 = (m) => { if (window.Notify) Notify.show({ icon: window.Icon ? Icon.mini("canva", "Canva") : "", title: "Canva AI", body: m }); };
        const GRADS = ["linear-gradient(135deg,#ff7e5f,#feb47b)", "linear-gradient(135deg,#2193b0,#6dd5ed)", "linear-gradient(135deg,#8e2de2,#4a00e0)", "linear-gradient(135deg,#11998e,#38ef7d)", "linear-gradient(135deg,#fc5c7d,#6a82fb)", "linear-gradient(135deg,#f7971e,#ffd200)", "linear-gradient(135deg,#c471f5,#fa71cd)"];
        P.querySelector('[data-ai="redesign"]').onclick = () => t3("Redesign is coming soon.");
        P.querySelector('[data-ai="bg"]').onclick = () => { let g; do { g = GRADS[Math.floor(Math.random() * GRADS.length)]; } while (g === design.bg && GRADS.length > 1); design.bg = g; stage.style.background = g; t3("Added a fresh background."); };
        P.querySelector('[data-ai="style"]').onclick = () => t3("Change style is coming soon.");
        P.querySelector(".cv-ai-plus").onclick = () => t3("Canva AI is coming soon.");
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
          if (t === "select") selectEl(null);
          else if (t === "text") { design.els.push({ t: "text", x: 40, y: 40, text: "Your text", size: 36, color: "#111111" }); render(); selectEl(design.els.length - 1); }
          else if (t === "shape") { design.els.push({ t: "circle", x: 60, y: 60, w: 140, h: 140, color: "#7b5cff" }); render(); selectEl(design.els.length - 1); }
          else if (t === "line") { design.els.push({ t: "rect", x: 60, y: 200, w: 220, h: 6, color: "#3a86ff" }); render(); selectEl(design.els.length - 1); }
          else if (t === "sticky") { design.els.push({ t: "rect", x: 60, y: 60, w: 180, h: 160, color: "#ffd54a" }); render(); selectEl(design.els.length - 1); }
          else tt(b.title + " is coming soon.");
        });
      } else if (id === "apps") {
        P.innerHTML = `
          <div class="cv-up-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg><input placeholder="Search Canva apps"></div>
          <div class="cv-up-tabs"><button class="cv-up-tab on" data-atab="discover">Discover</button><button class="cv-up-tab" data-atab="your">Your apps</button></div>
          <div class="cv-app-pills"><button class="cv-app-pill on">For you</button><button class="cv-app-pill">AI generation</button><button class="cv-app-pill">Audio and video</button></div>
          <div class="cv-panel-h">Made for presentations</div>
          <div class="cv-app-list"></div>`;
        const APPS = [
          { name: "Simplebooklet", desc: "Publish and track flipbooks.", c: "#f0932b", emoji: "📖" },
          { name: "GIPHY", desc: "Add GIFs to your designs.", c: "#111111", emoji: "🎞️" },
          { name: "D-ID AI Avatars", desc: "Add a talking head video.", c: "#5b6cf0", emoji: "🧑" },
          { name: "YouTube", desc: "Embed videos in your design.", c: "#ff0000", emoji: "▶️" },
          { name: "Mockups", desc: "Put your design on products.", c: "#22b573", emoji: "🖼️" },
        ];
        const alist = P.querySelector(".cv-app-list");
        const drawApps = () => { alist.innerHTML = ""; APPS.forEach((a) => {
          const row = el(`<button class="cv-app-row"><span class="cv-app-ic" style="background:${a.c}">${a.emoji}</span><span class="cv-app-meta"><span class="cv-app-name">${esc(a.name)}</span><span class="cv-app-desc">${esc(a.desc)}</span></span><span class="cv-app-more">•••</span></button>`);
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
      const b = ev.target.closest(".cv-rail-btn"); if (b) showPanel(b.dataset.rail);
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
