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
    { id: "ig", name: "Social media", w: 520, h: 520, emoji: "❤️", c: "#f22e63" },
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

  function editor(body, ref, design, existingIndex) {
    const ty = TYPES.find((x) => x.id === design.type) || TYPES[0];
    let sel = null;
    body.innerHTML = `<div class="cv cv-edit">
      <div class="cv-topbar">
        <button class="cv-back">‹ Home</button>
        <input class="cv-title" value="${esc(design.name || "Untitled design")}">
        <span class="grow"></span>
        <button class="cv-dl">⬇ Download</button>
      </div>
      <div class="cv-work">
        <div class="cv-panel">
          <button class="cv-tool" data-add="text">＋ Text</button>
          <button class="cv-tool" data-add="rect">▭ Rectangle</button>
          <button class="cv-tool" data-add="circle">● Circle</button>
          <div class="cv-panel-h">Background</div>
          <div class="cv-swatches cv-bg-sw"></div>
          <div class="cv-panel-h cv-sel-h" style="display:none">Selected</div>
          <div class="cv-sel-tools" style="display:none">
            <div class="cv-swatches cv-el-sw"></div>
            <label class="cv-size-row" style="display:none">Size <input type="range" class="cv-size" min="10" max="120"></label>
            <button class="cv-del">🗑 Delete</button>
          </div>
        </div>
        <div class="cv-stage-wrap">
          <div class="cv-stage" style="width:${ty.w}px;height:${ty.h}px;background:${design.bg}"></div>
        </div>
      </div>
    </div>`;
    const stage = body.querySelector(".cv-stage");
    const selH = body.querySelector(".cv-sel-h"), selTools = body.querySelector(".cv-sel-tools"), sizeRow = body.querySelector(".cv-size-row"), sizeIn = body.querySelector(".cv-size");

    function swatches(host, cb) { host.innerHTML = ""; PALETTE.forEach((c) => { const b = el(`<button class="cv-sw" style="background:${c}"></button>`); b.onclick = () => cb(c); host.appendChild(b); }); }
    swatches(body.querySelector(".cv-bg-sw"), (c) => { design.bg = c; stage.style.background = c; });
    swatches(body.querySelector(".cv-el-sw"), (c) => { if (sel != null) { design.els[sel].color = c; render(); selectEl(sel); } });

    function selectEl(i) {
      sel = i;
      stage.querySelectorAll(".cv-obj").forEach((o) => o.classList.toggle("sel", +o.dataset.i === i));
      const has = i != null && design.els[i];
      selH.style.display = selTools.style.display = has ? "block" : "none";
      selTools.style.display = has ? "flex" : "none";
      if (has && design.els[i].t === "text") { sizeRow.style.display = "flex"; sizeIn.value = design.els[i].size || 32; }
      else sizeRow.style.display = "none";
    }
    sizeIn.oninput = () => { if (sel != null && design.els[sel].t === "text") { design.els[sel].size = +sizeIn.value; render(); selectEl(sel); } };
    body.querySelector(".cv-del").onclick = () => { if (sel != null) { design.els.splice(sel, 1); sel = null; render(); selectEl(null); } };

    function render() {
      stage.innerHTML = "";
      design.els.forEach((e, i) => {
        let o;
        if (e.t === "text") o = el(`<div class="cv-obj cv-text" contenteditable="true" data-i="${i}" style="left:${e.x}px;top:${e.y}px;font-size:${e.size || 32}px;color:${e.color};font-weight:${e.bold ? 800 : 400}">${esc(e.text || "Text")}</div>`);
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

    body.querySelectorAll(".cv-tool").forEach((b) => b.onclick = () => {
      const kind = b.dataset.add;
      if (kind === "text") design.els.push({ t: "text", x: 40, y: 40, text: "Your text", size: 36, color: "#111111" });
      else design.els.push({ t: kind, x: 60, y: 60, w: 140, h: 140, color: kind === "circle" ? "#7b5cff" : "#3a86ff" });
      render(); selectEl(design.els.length - 1);
    });

    body.querySelector(".cv-title").oninput = (e) => { design.name = e.target.value; };
    body.querySelector(".cv-back").onclick = () => { saveDesign(); home(body, ref); };
    body.querySelector(".cv-dl").onclick = () => {
      saveDesign();
      if (window.Notify) Notify.show({ icon: window.Icon ? Icon.mini("canva", "Canva") : "", title: "Canva", body: `“${design.name}” downloaded (${ty.w}×${ty.h}).` });
    };

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
