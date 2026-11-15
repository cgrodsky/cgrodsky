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

  // ======================================================================
  //  Shared helpers for the features that used to say "coming soon"
  // ======================================================================
  const cvToast = (m, title) => { if (window.Notify) Notify.show({ icon: window.Icon ? Icon.mini("canva", "Canva") : "", title: title || "Canva", body: m }); };
  function downloadBlob(blob, name) {
    const a = document.createElement("a"), url = URL.createObjectURL(blob);
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  const safeName = (s) => (s || "design").replace(/[^\w.\- ]+/g, "").trim().replace(/\s+/g, "_") || "design";

  // Royalty-free music, synthesized live with WebAudio (Audio panel + presenting).
  const TRACKS = [
    { id: "lofi", name: "Lo-fi Study", mood: "Chill · 80 BPM", bpm: 80, chords: [[57, 60, 64, 67], [50, 53, 57, 60], [55, 59, 62, 65], [48, 52, 55, 59]], pad: "triangle", lead: "triangle", drums: "soft" },
    { id: "pop", name: "Sunny Pop", mood: "Upbeat · 118 BPM", bpm: 118, chords: [[60, 64, 67], [67, 71, 74], [69, 72, 76], [65, 69, 72]], pad: "triangle", lead: "square", arp: true, drums: "pop" },
    { id: "ambient", name: "Ocean Pad", mood: "Ambient · 60 BPM", bpm: 60, chords: [[48, 55, 64], [45, 52, 60], [41, 48, 57], [43, 50, 59]], pad: "sine", lead: null, drums: null },
    { id: "hype", name: "Hype Beat", mood: "Energetic · 100 BPM", bpm: 100, chords: [[45, 48, 52], [45, 48, 52], [41, 45, 48], [43, 47, 50]], pad: "triangle", lead: "sawtooth", drums: "trap" },
  ];
  function makeMusic(track) {
    let ac = null, master = null, timer = null, step = 0, next = 0;
    const spb = 60 / track.bpm / 2, mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
    function tone(f, t, dur, type, vol) {
      const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
    }
    function hiss(t, dur, vol, hp) {
      const b = ac.createBuffer(1, Math.max(1, (ac.sampleRate * dur) | 0), ac.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = b; f.type = "highpass"; f.frequency.value = hp;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(g); g.connect(master); s.start(t);
    }
    function kick(t, vol) {
      const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22); o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.25);
    }
    function sched() {
      while (next < ac.currentTime + 0.25) {
        const ch = track.chords[Math.floor(step / 8) % track.chords.length], b = step % 8;
        if (b === 0) ch.forEach((m) => tone(mtof(m), next, spb * 7.6, track.pad, 0.045));
        if (b === 0 || b === 4) tone(mtof(ch[0] - 12), next, spb * 1.8, "sine", 0.1);
        if (track.arp) tone(mtof(ch[b % ch.length] + 12), next, spb * 0.85, track.lead, 0.022);
        else if (track.lead && b % 2 === 0) tone(mtof(ch[(b / 2) % ch.length] + 12), next, spb * 1.5, track.lead, 0.02);
        if (track.drums === "soft") { if (b === 0 || b === 5) kick(next, 0.35); if (b % 2 === 1) hiss(next, 0.04, 0.03, 7000); }
        else if (track.drums === "pop") { if (b % 4 === 0) kick(next, 0.45); if (b === 2 || b === 6) hiss(next, 0.12, 0.12, 1500); hiss(next, 0.03, 0.03, 8000); }
        else if (track.drums === "trap") { if (b === 0 || b === 3 || b === 6) kick(next, 0.5); if (b === 4) hiss(next, 0.16, 0.16, 1200); hiss(next, 0.025, 0.04, 9000); }
        next += spb; step++;
      }
    }
    return {
      id: track.id,
      start() {
        try {
          ac = new (window.AudioContext || window.webkitAudioContext)();
          master = ac.createGain(); master.gain.value = 0.7; master.connect(ac.destination);
          next = ac.currentTime + 0.06; step = 0; sched(); timer = setInterval(sched, 60);
        } catch (e) { ac = null; }
      },
      stop() { clearInterval(timer); timer = null; try { if (ac) ac.close(); } catch (e) {} ac = null; },
    };
  }

  // App directory (editor Apps panel + the home "Apps" page).
  const CV_APPS = [
    { id: "simplebooklet", name: "Simplebooklet", desc: "Publish your pages as a flipbook.", c: "#f0932b", emoji: "📖" },
    { id: "giphy", name: "GIPHY", desc: "Add GIFs to your designs.", c: "#111111", img: "assets/cv_app_giphy.png" },
    { id: "did", name: "D-ID AI Avatars", desc: "Generate a presenter avatar with AI.", c: "#5b6cf0", emoji: "🧑" },
    { id: "youtube", name: "YouTube", desc: "Embed a YouTube video in your design.", c: "#ff0000", emoji: "▶️" },
    { id: "mockups", name: "Mockups", desc: "Put your design on a phone, poster, shirt or laptop.", c: "#22b573", emoji: "🖼️" },
  ];
  function markAppUsed(id) { const st = store(); if (!st.usedApps) st.usedApps = []; if (!st.usedApps.includes(id)) { st.usedApps.unshift(id); State.save(); } }

  const LESSONS = [
    { id: "hierarchy", t: "Visual hierarchy", m: 4, body: ["Decide the one thing a viewer must see first, and make it the biggest, boldest or most colorful element on the page.", "Use no more than three levels of emphasis: a headline, a supporting line, and details. More levels compete with each other.", "Squint at your design — whatever still stands out is your real focal point. If it's the wrong thing, scale it down or mute its color."] },
    { id: "color", t: "Choosing a color palette", m: 5, body: ["Start from one brand color, then add a dark neutral for text and a light neutral for backgrounds.", "Pick an accent that contrasts with your brand color for calls to action — use it sparingly so it keeps its punch.", "Check contrast: body text should reach at least 4.5:1 against its background so everyone can read it."] },
    { id: "type", t: "Pairing fonts", m: 4, body: ["Pair a characterful display font for headlines with a simple, highly legible font for body text.", "Two typefaces are almost always enough. Create variety with size and weight instead of new fonts.", "Keep line length around 45–75 characters and line height about 1.4× the font size for comfortable reading."] },
    { id: "space", t: "Using white space", m: 3, body: ["Empty space isn't wasted — it groups related items and gives the important ones room to breathe.", "Keep equal margins around the edge of the page, and use consistent gaps between related elements.", "When a design feels cluttered, remove an element before you shrink everything to fit."] },
    { id: "align", t: "Alignment and grids", m: 3, body: ["Line elements up on a shared edge or center — accidental near-alignments look like mistakes.", "Pick one dominant alignment per page. Mixing left, center and right alignment makes a layout feel random.", "Use Canva's arrow keys (Shift for 10px steps) to nudge elements into place precisely."] },
    { id: "social", t: "Designing for social media", m: 5, body: ["Design for a thumb-scroll: the message must land in under a second, so lead with one bold line.", "Keep important content away from the edges — platforms crop and overlay buttons there.", "Use the Content Planner to schedule posts, and Grow to draft captions and hashtags for each one."] },
  ];

  // Accessibility preferences (Settings → Accessibility) applied to every Canva screen.
  function applyA11y(body) {
    const root = body.querySelector(".cv"); if (!root) return;
    const s = (store().settings || {});
    root.classList.toggle("cvx-reduce-motion", !!s.reduceMotion);
    root.classList.toggle("cvx-contrast", !!s.highContrast);
    root.classList.toggle("cvx-large", !!s.largeText);
    root.classList.toggle("cvx-underline", !!s.underlineLinks);
  }
  function injectCvxStyles() {
    if (document.getElementById("cvx-style")) return;
    const st = document.createElement("style"); st.id = "cvx-style";
    st.textContent = `
      .cvx-reduce-motion *, .cvx-reduce-motion *::before, .cvx-reduce-motion *::after { animation: none !important; transition: none !important; }
      .cvx-contrast { filter: contrast(1.25); } .cvx-contrast .cv-nav, .cvx-contrast button { outline: 1px solid rgba(0,0,0,.25); }
      .cvx-large { font-size: 1.12em; } .cvx-large .cv-nav, .cvx-large button, .cvx-large input, .cvx-large select { font-size: 1.08em; }
      .cvx-underline .cv-link { text-decoration: underline !important; }
      .cvx-page { padding: 26px 34px; overflow: auto; height: 100%; box-sizing: border-box; }
      .cvx-page h1 { margin: 0 0 6px; font-size: 26px; } .cvx-sub { color: #6b7280; margin: 0 0 18px; }
      .cvx-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }
      .cvx-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px; display: flex; flex-direction: column; gap: 8px; }
      .cvx-card b { font-size: 15px; } .cvx-card span { color: #6b7280; font-size: 13px; }
      .cvx-ic { width: 40px; height: 40px; border-radius: 10px; display: grid; place-items: center; font-size: 20px; color: #fff; overflow: hidden; }
      .cvx-ic img { width: 100%; height: 100%; object-fit: cover; }
      .cvx-row { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid #eef0f3; }
      .cvx-row .grow { flex: 1; } .cvx-row small { display: block; color: #6b7280; font-size: 12px; margin-top: 2px; }
      .cvx-switch { position: relative; width: 42px; height: 24px; flex: none; } .cvx-switch input { opacity: 0; width: 0; height: 0; }
      .cvx-switch i { position: absolute; inset: 0; border-radius: 12px; background: #cfd3da; transition: .15s; cursor: pointer; }
      .cvx-switch i::after { content: ""; position: absolute; left: 3px; top: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: .15s; }
      .cvx-switch input:checked + i { background: #7b2ae8; } .cvx-switch input:checked + i::after { left: 21px; }
      .cvx-meter { height: 10px; background: #eef0f3; border-radius: 6px; overflow: hidden; } .cvx-meter > div { height: 100%; background: linear-gradient(90deg,#00c4cc,#7b2ae8); }
      .cvx-cal { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; }
      .cvx-cal .h { font-size: 12px; color: #6b7280; text-align: center; font-weight: 700; }
      .cvx-day { min-height: 84px; background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 6px; font-size: 12px; cursor: pointer; display: flex; flex-direction: column; gap: 4px; text-align: left; }
      .cvx-day.out { opacity: .4; } .cvx-day.today { border-color: #7b2ae8; box-shadow: 0 0 0 2px rgba(123,42,232,.15); }
      .cvx-chip { max-width: 100%; box-sizing: border-box; background: #f3e8ff; color: #5b21b6; border-radius: 6px; padding: 2px 6px; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .cvx-chip.done { background: #dcfce7; color: #166534; }
      .cvx-modal { position: absolute; inset: 0; background: rgba(15,15,25,.45); display: grid; place-items: center; z-index: 60; }
      .cvx-box { background: #fff; border-radius: 14px; padding: 18px; width: min(460px, 92%); max-height: 86%; overflow: auto; box-shadow: 0 20px 60px rgba(0,0,0,.3); display: flex; flex-direction: column; gap: 10px; }
      .cvx-box h3 { margin: 0; } .cvx-box textarea, .cvx-box input, .cvx-box select, .cvx-in { width: 100%; box-sizing: border-box; border: 1px solid #d6d9df; border-radius: 8px; padding: 8px 10px; font: inherit; }
      .cvx-actions { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }
      .cvx-pop { position: absolute; bottom: 52px; z-index: 50; background: #fff; border-radius: 12px; box-shadow: 0 12px 40px rgba(0,0,0,.25); padding: 12px; display: flex; flex-direction: column; gap: 8px; }
      .cvx-pages { display: flex; gap: 10px; overflow-x: auto; max-width: 70vw; padding-bottom: 4px; }
      .cvx-thumb { flex: none; width: 110px; display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 12px; cursor: pointer; }
      .cvx-thumb canvas { width: 110px; height: auto; border-radius: 6px; border: 2px solid transparent; background: #f3f4f6; }
      .cvx-thumb.on canvas { border-color: #7b2ae8; }
      .cvx-timer { font: 700 34px ui-monospace, monospace; text-align: center; letter-spacing: 1px; }
      .cvx-notes { position: absolute; left: 0; right: 0; bottom: 48px; height: 140px; background: #fff; border-top: 1px solid #e5e7eb; z-index: 40; display: flex; flex-direction: column; padding: 8px 12px; gap: 6px; box-shadow: 0 -8px 24px rgba(0,0,0,.08); }
      .cvx-notes textarea { flex: 1; resize: none; border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px; font: inherit; }
      .cvx-gridview { position: absolute; inset: 0; background: #f4f5f8; z-index: 55; overflow: auto; padding: 22px; }
      .cvx-gridview .cvx-pages { flex-wrap: wrap; max-width: none; overflow: visible; }
      .cvx-gridview .cvx-thumb, .cvx-gridview .cvx-thumb canvas { width: 200px; }
      .cvx-present { position: fixed; inset: 0; background: #000; z-index: 2147483000; display: flex; align-items: center; justify-content: center; outline: none; }
      .cvx-present canvas { width: 100%; height: 100%; }
      .cvx-pbar { position: absolute; left: 50%; bottom: 18px; transform: translateX(-50%); display: flex; gap: 8px; align-items: center; background: rgba(20,20,28,.78); color: #fff; padding: 8px 12px; border-radius: 12px; font: 600 14px system-ui, sans-serif; opacity: .25; transition: opacity .2s; }
      .cvx-present:hover .cvx-pbar, .cvx-pbar:focus-within { opacity: 1; }
      .cvx-pbar button { background: rgba(255,255,255,.14); color: #fff; border: 0; border-radius: 8px; padding: 6px 12px; font: inherit; cursor: pointer; }
      .cvx-rec { color: #ff4d4d; animation: cvxblink 1s infinite; } @keyframes cvxblink { 50% { opacity: .3; } }
      .cvx-pnotes { position: absolute; left: 18px; top: 18px; max-width: 40vw; max-height: 40vh; overflow: auto; background: rgba(20,20,28,.85); color: #fff; padding: 12px 14px; border-radius: 10px; font: 15px/1.45 system-ui, sans-serif; white-space: pre-wrap; }
      .cvx-camvid { width: 100%; border-radius: 10px; background: #000; max-height: 50vh; }
      .cvx-tracks { display: flex; flex-direction: column; gap: 8px; }
      .cvx-track { display: flex; align-items: center; gap: 10px; padding: 8px; border: 1px solid #e5e7eb; border-radius: 10px; }
      .cvx-track.on { border-color: #7b2ae8; background: #faf5ff; }
      .cvx-track .grow { flex: 1; display: flex; flex-direction: column; } .cvx-track span { color: #6b7280; font-size: 12px; }
      .cvx-track button { border: 0; border-radius: 8px; padding: 6px 10px; cursor: pointer; background: #f3f4f6; font: inherit; }
      .cvx-comp { display: flex; align-items: center; gap: 6px; } .cvx-comp button:first-child { flex: 1; text-align: left; }
      .cvx-lesson-p { line-height: 1.6; color: #374151; }
      .cvx-ppl { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
      .cvx-av { width: 30px; height: 30px; border-radius: 50%; background: #7b2ae8; color: #fff; display: grid; place-items: center; font-weight: 800; font-size: 13px; cursor: pointer; }
    `;
    document.head.appendChild(st);
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
    (store().templates || []).forEach((tp) => {   // saved via Share → Brand Template
      const ty = TYPES.find((x) => x.id === tp.type) || TYPES[0];
      const card = el(`<button class="cv-tpl"><div class="cv-tpl-thumb" style="background:${tp.bg};aspect-ratio:${ty.w}/${ty.h}"></div><span>🗂️ ${esc(tp.name)}</span></button>`);
      card.onclick = () => editor(body, ref, { type: tp.type, bg: tp.bg, els: JSON.parse(JSON.stringify(tp.els)), pages: tp.pages ? JSON.parse(JSON.stringify(tp.pages)) : undefined, page: 0, name: tp.name });
      tplEl.appendChild(card);
    });
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
      menu.querySelectorAll(".cv-more-item").forEach((b, k) => b.onclick = () => { menu.remove(); morePage(body, ref, ITEMS[k].t); });
      body.querySelector(".cv").appendChild(menu);
      setTimeout(() => document.addEventListener("pointerdown", function h(x) { if (!menu.contains(x.target) && x.target !== ev.target) { menu.remove(); document.removeEventListener("pointerdown", h); } }), 0);
    };
    body.querySelector(".cv-profile").onclick = () => profileScreen(body, ref);
    injectCvxStyles(); applyA11y(body); publishDuePosts();
  }

  // Content Planner: posts whose time has come are marked published (with a notification).
  function publishDuePosts() {
    const st = store(), now = Date.now(); let n = 0;
    (st.planner || []).forEach((p) => { if (!p.done && new Date(p.date + "T" + (p.time || "09:00")).getTime() <= now) { p.done = true; n++; cvToast(`Published “${p.title}” to ${p.platform}.`, "Content Planner"); } });
    if (n) State.save();
  }

  // ---------- Home → More: Apps, Grow, Content Planner, Design School ----------
  function moreShell(body, ref, title, sub) {
    const main = body.querySelector(".cv-main");
    main.innerHTML = `<div class="cvx-page"><button class="cv-link cvx-back" style="margin-bottom:10px">‹ Back to home</button><h1>${esc(title)}</h1><p class="cvx-sub">${esc(sub)}</p><div class="cvx-body"></div></div>`;
    main.querySelector(".cvx-back").onclick = () => home(body, ref);
    return main.querySelector(".cvx-body");
  }
  function morePage(body, ref, which) {
    const st = store();
    if (which === "Apps") {
      const host = moreShell(body, ref, "Apps", "Connect design and productivity tools. Open an app to use it in a new design.");
      const g = el(`<div class="cvx-grid"></div>`); host.appendChild(g);
      CV_APPS.forEach((a) => {
        const used = (st.usedApps || []).includes(a.id);
        const c = el(`<div class="cvx-card"><div class="cvx-ic" style="background:${a.c}">${a.img ? `<img src="${esc(a.img)}?v=1" alt="">` : a.emoji}</div><b>${esc(a.name)}</b><span>${esc(a.desc)}</span><button class="cv-btn">${used ? "Open" : "Use in a design"}</button></div>`);
        c.querySelector("button").onclick = () => { markAppUsed(a.id); editor(body, ref, { type: TYPES[0].id, bg: "#ffffff", els: [], name: "Untitled design" }, null, { panel: "apps", app: a.id }); };
        g.appendChild(c);
      });
    } else if (which === "Grow") {
      const host = moreShell(body, ref, "Grow", "Draft captions and hashtags for your designs with Canva AI.");
      const ds = st.designs || [];
      if (!ds.length) { host.appendChild(el(`<div class="cv-empty">Create a design first — Grow writes captions for it.</div>`)); applyA11y(body); return; }
      host.appendChild(el(`<div class="cvx-card" style="max-width:640px">
        <label>Design<select class="cvx-in cvx-g-d">${ds.map((d, i) => `<option value="${i}">${esc(d.name || "Untitled")}</option>`).join("")}</select></label>
        <label>Platform<select class="cvx-in cvx-g-p"><option>Instagram</option><option>TikTok</option><option>LinkedIn</option><option>X</option><option>Facebook</option></select></label>
        <label>Tone<select class="cvx-in cvx-g-t"><option>Friendly</option><option>Professional</option><option>Playful</option><option>Bold</option></select></label>
        <button class="cv-btn cvx-g-go">✨ Write captions</button><div class="cvx-g-out"></div></div>`));
      host.querySelector(".cvx-g-go").onclick = async () => {
        const d = ds[+host.querySelector(".cvx-g-d").value], plat = host.querySelector(".cvx-g-p").value, tone = host.querySelector(".cvx-g-t").value, out = host.querySelector(".cvx-g-out");
        const words = [d.name].concat(((d.pages && d.pages.length ? d.pages.flatMap((p) => p.els) : d.els) || []).filter((e) => e.t === "text").map((e) => e.text)).filter(Boolean).join(" · ");
        out.innerHTML = `<div class="cv-empty">Writing…</div>`;
        let caps;
        try {
          const txt = await window.AIText.generate(`Write 3 short ${tone.toLowerCase()} ${plat} captions for a post whose design says: "${words}". Each caption on its own line, followed by 4-6 relevant hashtags on the same line. No numbering.`, { max: 300 });
          caps = txt.split(/\n+/).map((x) => x.replace(/^[-*\d.)\s]+/, "").trim()).filter(Boolean).slice(0, 3);
        } catch (e) { caps = null; }
        if (!caps || !caps.length) { // offline fallback: build captions from the design's own words
          const key = (d.name || "our new design").replace(/^Untitled\s*/i, "") || "our new design";
          const tags = ["#design", "#" + plat.toLowerCase(), "#" + (key.split(/\s+/)[0] || "create").toLowerCase().replace(/[^a-z0-9]/g, ""), "#madewithcanva"].join(" ");
          caps = [`${tone === "Bold" ? "Big news:" : "Say hello to"} ${key}! ✨ ${tags}`, `${key} — made for you. Tap the link to see more. ${tags}`, `We couldn't wait to share ${key} with you 💜 ${tags}`];
        }
        out.innerHTML = ""; caps.forEach((c) => { const r = el(`<div class="cvx-row"><div class="grow">${esc(c)}</div><button class="cv-btn">Copy</button></div>`); r.querySelector("button").onclick = () => { (navigator.clipboard ? navigator.clipboard.writeText(c) : Promise.resolve()).then(() => cvToast("Caption copied.")).catch(() => cvToast("Caption copied.")); }; out.appendChild(r); });
      };
    } else if (which === "Content Planner") {
      const host = moreShell(body, ref, "Content Planner", "Schedule your designs. Due posts publish automatically while Canva is open.");
      let view = new Date(); view.setDate(1);
      const ymd = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      const draw = () => {
        if (!st.planner) st.planner = [];
        host.innerHTML = `<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px"><button class="cv-btn cvx-pp">‹</button><b style="min-width:150px;text-align:center">${view.toLocaleString(undefined, { month: "long", year: "numeric" })}</b><button class="cv-btn cvx-pn">›</button></div><div class="cvx-cal"></div>`;
        const cal = host.querySelector(".cvx-cal");
        ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach((d) => cal.appendChild(el(`<div class="h">${d}</div>`)));
        const start = new Date(view); start.setDate(1 - start.getDay()); const today = ymd(new Date());
        for (let i = 0; i < 42; i++) {
          const d = new Date(start); d.setDate(start.getDate() + i); const key = ymd(d);
          const cell = el(`<button class="cvx-day ${d.getMonth() !== view.getMonth() ? "out" : ""} ${key === today ? "today" : ""}"><b>${d.getDate()}</b></button>`);
          st.planner.filter((p) => p.date === key).forEach((p) => {
            const chip = el(`<span class="cvx-chip ${p.done ? "done" : ""}" title="Click to remove">${p.done ? "✓ " : ""}${esc(p.time)} ${esc(p.platform)} · ${esc(p.title)}</span>`);
            chip.onclick = (e) => { e.stopPropagation(); if (confirm(`Remove “${p.title}” from ${key}?`)) { st.planner.splice(st.planner.indexOf(p), 1); State.save(); draw(); } };
            cell.appendChild(chip);
          });
          cell.onclick = () => schedule(key);
          cal.appendChild(cell);
        }
        host.querySelector(".cvx-pp").onclick = () => { view.setMonth(view.getMonth() - 1); draw(); };
        host.querySelector(".cvx-pn").onclick = () => { view.setMonth(view.getMonth() + 1); draw(); };
        applyA11y(body);
      };
      const schedule = (key) => {
        const ds = st.designs || [];
        if (!ds.length) { cvToast("Create a design first, then schedule it here."); return; }
        const m = el(`<div class="cvx-modal"><div class="cvx-box"><h3>Schedule a post · ${esc(key)}</h3>
          <label>Design<select class="cvx-s-d">${ds.map((d, i) => `<option value="${i}">${esc(d.name || "Untitled")}</option>`).join("")}</select></label>
          <label>Platform<select class="cvx-s-p"><option>Instagram</option><option>TikTok</option><option>LinkedIn</option><option>X</option><option>Facebook</option><option>Pinterest</option></select></label>
          <label>Time<input type="time" class="cvx-s-t" value="09:00"></label>
          <div class="cvx-actions"><button class="cv-link cvx-x">Cancel</button><button class="cv-btn cvx-ok">Schedule</button></div></div></div>`);
        m.querySelector(".cvx-x").onclick = () => m.remove();
        m.querySelector(".cvx-ok").onclick = () => {
          const d = ds[+m.querySelector(".cvx-s-d").value];
          st.planner.push({ date: key, time: m.querySelector(".cvx-s-t").value || "09:00", platform: m.querySelector(".cvx-s-p").value, title: d.name || "Untitled", done: false });
          State.save(); m.remove(); publishDuePosts(); draw(); cvToast(`Scheduled “${d.name || "Untitled"}” for ${key}.`, "Content Planner");
        };
        body.querySelector(".cv").appendChild(m);
      };
      draw();
    } else if (which === "Design School") {
      const host = moreShell(body, ref, "Design School", "Short lessons on the fundamentals of good design.");
      if (!st.school) st.school = {};
      const draw = () => {
        const done = LESSONS.filter((l) => st.school[l.id]).length;
        host.innerHTML = `<div style="max-width:640px;margin-bottom:14px"><div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px"><b>Your progress</b><span>${done} / ${LESSONS.length} lessons</span></div><div class="cvx-meter"><div style="width:${done / LESSONS.length * 100}%"></div></div></div><div class="cvx-grid"></div>`;
        const g = host.querySelector(".cvx-grid");
        LESSONS.forEach((l) => {
          const c = el(`<div class="cvx-card"><b>${st.school[l.id] ? "✅ " : ""}${esc(l.t)}</b><span>${l.m} min read</span><button class="cv-btn">${st.school[l.id] ? "Review" : "Start lesson"}</button></div>`);
          c.querySelector("button").onclick = () => {
            host.innerHTML = `<div style="max-width:640px"><button class="cv-link cvx-lb">‹ All lessons</button><h2>${esc(l.t)}</h2>${l.body.map((p) => `<p class="cvx-lesson-p">${esc(p)}</p>`).join("")}<button class="cv-btn cvx-done">${st.school[l.id] ? "✓ Completed" : "Mark as complete"}</button></div>`;
            host.querySelector(".cvx-lb").onclick = draw;
            host.querySelector(".cvx-done").onclick = () => { st.school[l.id] = true; State.save(); cvToast(`Lesson complete: ${l.t}`, "Design School"); draw(); };
          };
          g.appendChild(c);
        });
      };
      draw();
    }
    applyA11y(body);
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
    body.querySelectorAll(".cv-nav:not(.cv-back-nav)").forEach((b, k) => b.onclick = () => {
      body.querySelectorAll(".cv-nav").forEach((x) => x.classList.toggle("on", x === b));
      if (k === 0) { profileScreen(body, ref); return; }
      settingsPage(body, ref, NAV[k][0]);
    });
    injectCvxStyles(); applyA11y(body);
  }

  // ---------- Profile → settings pages ----------
  function settingsPage(body, ref, page) {
    const st = store(); if (!st.settings) st.settings = {}; const S2 = st.settings;
    const main = body.querySelector(".cv-main");
    main.innerHTML = `<h1 class="cv-p-title">${esc(page)}</h1><div class="cv-card cvx-set"></div>`;
    const box = main.querySelector(".cvx-set");
    const toggle = (key, label, desc, onChange) => {
      const r = el(`<div class="cvx-row"><div class="grow"><b>${esc(label)}</b>${desc ? `<small>${esc(desc)}</small>` : ""}</div><label class="cvx-switch"><input type="checkbox" ${S2[key] ? "checked" : ""}><i></i></label></div>`);
      r.querySelector("input").onchange = (e) => { S2[key] = e.target.checked; State.save(); if (onChange) onChange(S2[key]); };
      box.appendChild(r);
    };
    const select = (key, label, opts, def) => {
      const r = el(`<div class="cvx-row"><div class="grow"><b>${esc(label)}</b></div><select class="cv-select">${opts.map((o) => `<option ${(S2[key] || def) === o ? "selected" : ""}>${esc(o)}</option>`).join("")}</select></div>`);
      r.querySelector("select").onchange = (e) => { S2[key] = e.target.value; State.save(); };
      box.appendChild(r);
    };
    const button = (label, desc, btn, fn, danger) => {
      const r = el(`<div class="cvx-row"><div class="grow"><b>${esc(label)}</b>${desc ? `<small>${esc(desc)}</small>` : ""}</div><button class="cv-btn" ${danger ? 'style="background:#e5484d;color:#fff"' : ""}>${esc(btn)}</button></div>`);
      r.querySelector("button").onclick = fn; box.appendChild(r);
    };
    const exportAll = () => downloadBlob(new Blob([JSON.stringify(store(), null, 2)], { type: "application/json" }), "canva-data.json");
    if (page === "Account and security") {
      const ua = navigator.userAgent, dev = /iPad/.test(ua) ? "iPad" : /iPhone/.test(ua) ? "iPhone" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows PC" : /Android/.test(ua) ? "Android" : "This device";
      const br = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : /Firefox\//.test(ua) ? "Firefox" : "Browser";
      button("Password", S2.pwChanged ? "Last changed " + new Date(S2.pwChanged).toLocaleDateString() : "Set a password for email sign-in.", "Change", () => {
        const a = prompt("New password (at least 8 characters):"); if (a == null) return;
        if (a.length < 8) { cvToast("Password must be at least 8 characters."); return; }
        if (prompt("Confirm new password:") !== a) { cvToast("Passwords didn't match."); return; }
        S2.pwChanged = Date.now(); State.save(); cvToast("Password updated."); settingsPage(body, ref, page);
      });
      toggle("twoStep", "Two-step verification", "Ask for a code from your authenticator app when you sign in.", (on) => cvToast(on ? "Two-step verification is on." : "Two-step verification is off."));
      box.appendChild(el(`<div class="cvx-row"><div class="grow"><b>Active sessions</b><small>${esc(dev)} · ${esc(br)} — current session, signed in ${new Date().toLocaleDateString()}</small></div></div>`));
      button("Sign out of all other devices", "Ends every session except this one.", "Sign out others", () => cvToast("Signed out of all other devices."));
    } else if (page === "Accessibility") {
      const reapply = () => applyA11y(body);
      toggle("reduceMotion", "Reduce motion", "Turn off animations and transitions.", reapply);
      toggle("highContrast", "Increase contrast", "Make text, borders and controls easier to tell apart.", reapply);
      toggle("largeText", "Larger text", "Increase the size of text across Canva.", reapply);
      toggle("underlineLinks", "Underline links", "Always underline links so they don't rely on color.", reapply);
    } else if (page === "Message preferences") {
      toggle("mTips", "Tips and tutorials", "Design tips, feature announcements and how-tos.");
      toggle("mComments", "Comments and mentions", "When someone comments on or mentions you in a design.");
      toggle("mShares", "Shared with you", "When someone shares a design or folder with you.");
      toggle("mNews", "Newsletter", "Canva news, inspiration and offers.");
      select("mFreq", "Email frequency", ["Instantly", "Daily digest", "Weekly digest", "Never"], "Daily digest");
    } else if (page === "Privacy controls") {
      toggle("pTraining", "Use my content to improve AI features", "Off by default. Your designs are never shared with other users.");
      toggle("pPersonal", "Personalized recommendations", "Suggest templates based on what you design.");
      toggle("pSearch", "Let people find me by email", "People can invite you to teams using your email address.");
      button("Download your data", "Get a copy of all your Canva data as a JSON file.", "Download", exportAll);
    } else if (page === "Data and storage") {
      const bytes = new Blob([JSON.stringify(store())]).size, cap = 5 * 1024 * 1024, pct = Math.min(100, bytes / cap * 100);
      const fmt = (n) => n > 1048576 ? (n / 1048576).toFixed(2) + " MB" : (n / 1024).toFixed(1) + " KB";
      box.appendChild(el(`<div class="cvx-row" style="flex-direction:column;align-items:stretch"><div style="display:flex;justify-content:space-between"><b>Storage used on this device</b><span>${fmt(bytes)} of ~5 MB</span></div><div class="cvx-meter" style="margin-top:8px"><div style="width:${pct.toFixed(1)}%"></div></div><small>${(st.designs || []).length} designs · ${(st.uploads || []).length} uploads · ${(st.fonts || []).length} fonts · ${(st.templates || []).length} templates</small></div>`));
      button("Export everything", "Download all designs, uploads and settings as JSON.", "Export", exportAll);
      button("Clear uploads", "Remove every uploaded image. Designs keep the images they already use.", "Clear", () => { if (!confirm("Clear all uploads?")) return; st.uploads = []; State.save(); cvToast("Uploads cleared."); settingsPage(body, ref, page); });
      button("Delete all designs", "Permanently deletes every design on this device.", "Delete", () => { if (!confirm("Delete ALL designs? This can't be undone.")) return; st.designs = []; State.save(); cvToast("All designs deleted."); settingsPage(body, ref, page); }, true);
    } else if (page === "Your teams") {
      if (!st.teams) st.teams = [];
      button("Create a team", "Design together — share brand kits, templates and folders.", "＋ New team", () => { const n = prompt("Team name:"); if (!n || !n.trim()) return; st.teams.push({ name: n.trim(), members: [profileEmail()] }); State.save(); settingsPage(body, ref, page); });
      if (!st.teams.length) box.appendChild(el(`<div class="cv-empty">You're not in any teams yet.</div>`));
      st.teams.forEach((t, ti) => {
        const r = el(`<div class="cvx-row" style="align-items:flex-start"><div class="grow"><b>👥 ${esc(t.name)}</b><small>${t.members.map(esc).join(" · ")}</small></div><button class="cv-btn cvx-inv">Invite</button><button class="cv-link cvx-leave">Leave</button></div>`);
        r.querySelector(".cvx-inv").onclick = () => { const e = prompt("Invite by email:"); if (!e) return; if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e.trim())) { cvToast("That isn't a valid email address."); return; } t.members.push(e.trim()); State.save(); cvToast(`Invited ${e.trim()} to ${t.name}.`); settingsPage(body, ref, page); };
        r.querySelector(".cvx-leave").onclick = () => { if (!confirm(`Leave ${t.name}?`)) return; st.teams.splice(ti, 1); State.save(); settingsPage(body, ref, page); };
        box.appendChild(r);
      });
    } else if (page === "AI personalization") {
      toggle("aiPersonal", "Personalize Canva AI", "Let Canva AI use your profile and recent designs to tailor suggestions.");
      select("aiTone", "Default writing tone", ["Friendly", "Professional", "Playful", "Bold", "Concise"], "Friendly");
      const r = el(`<div class="cvx-row" style="flex-direction:column;align-items:stretch"><b>About you and your brand</b><small>Canva AI uses this when writing captions and generating designs.</small><textarea class="cvx-in" rows="3" style="margin-top:6px" placeholder="e.g. We're a small bakery in Austin. Warm, cozy, a little cheeky.">${esc(S2.aiAbout || "")}</textarea></div>`);
      r.querySelector("textarea").oninput = (e) => { S2.aiAbout = e.target.value; State.save(); };
      box.appendChild(r);
    } else if (page === "Your apps") {
      const used = st.usedApps || [];
      if (!used.length) box.appendChild(el(`<div class="cv-empty">Apps you use in the editor show up here.</div>`));
      CV_APPS.filter((a) => used.includes(a.id)).forEach((a) => {
        const r = el(`<div class="cvx-row"><div class="cvx-ic" style="background:${a.c}">${a.img ? `<img src="${esc(a.img)}?v=1" alt="">` : a.emoji}</div><div class="grow"><b>${esc(a.name)}</b><small>${esc(a.desc)}</small></div><button class="cv-link">Disconnect</button></div>`);
        r.querySelector("button").onclick = () => { st.usedApps = used.filter((x) => x !== a.id); State.save(); cvToast(a.name + " disconnected."); settingsPage(body, ref, page); };
        box.appendChild(r);
      });
    }
    applyA11y(body);
  }

  const PALETTE = ["#111111", "#ffffff", "#ff5a5f", "#ff9f1c", "#ffd54a", "#2ec4b6", "#3a86ff", "#7b5cff", "#e84393", "#00b894", "#636e72", "#fab1a0"];
  const FONTS = ["Nunito", "Poppins", "Montserrat", "Playfair Display", "Oswald", "Lobster", "Pacifico", "Bebas Neue", "Dancing Script", "Roboto Slab", "Arial", "Georgia", "Times New Roman", "Courier New", "Comic Sans MS", "Impact"];

  function editor(body, ref, design, existingIndex, opts) {
    const ty = TYPES.find((x) => x.id === design.type) || TYPES[0];
    let sel = null;
    if (!Array.isArray(design.els)) design.els = [];
    if (Array.isArray(design.pages) && design.pages.length) { const pg = design.pages[design.page || 0] || design.pages[0]; design.page = design.pages.indexOf(pg); design.bg = pg.bg; design.els = pg.els; design.notes = pg.notes || ""; }
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
    injectCvxStyles(); applyA11y(body);
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
        else if (e.t === "video") o = el(`<video class="cv-obj cv-video" data-i="${i}" src="${esc(e.src)}" muted loop autoplay playsinline style="left:${e.x}px;top:${e.y}px;width:${e.w || 320}px;height:${e.h || 180}px;object-fit:cover;background:#111"></video>`);
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
      stopPreview();
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
        P.querySelector(".cv-up-record").onclick = () => openCamera();
        P.querySelectorAll(".cv-up-tab").forEach((t) => t.onclick = () => {
          P.querySelectorAll(".cv-up-tab").forEach((x) => x.classList.toggle("on", x === t));
          if (t.dataset.tab === "images") draw(q.value);
          else if (t.dataset.tab === "videos") drawVideoGrid(grid);
          else if (t.dataset.tab === "designs") { grid.innerHTML = ""; (store().designs || []).forEach((d, i) => { const b = el(`<button class="cv-proj-card"><span class="cv-proj-sw" style="background:${d.bg}"></span>${esc(d.name || "Untitled")}</button>`); b.onclick = () => { saveDesign(); editor(body, ref, JSON.parse(JSON.stringify(d)), i); }; grid.appendChild(b); }); if (!grid.children.length) grid.appendChild(el(`<div class="cv-empty">No designs yet.</div>`)); }
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
        P.querySelector(".cv-ai-mic").onclick = () => {
          const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
          if (!SR) { t3("Voice input isn't supported in this browser — try Chrome, Edge or Safari."); return; }
          const mic = P.querySelector(".cv-ai-mic"), rec = new SR();
          rec.lang = navigator.language || "en-US"; rec.interimResults = true; rec.continuous = false;
          rec.onresult = (e) => { aiInput.value = Array.from(e.results).map((r) => r[0].transcript).join(""); };
          rec.onerror = (e) => t3(e.error === "not-allowed" ? "Microphone access was blocked." : "Voice input error: " + e.error);
          rec.onend = () => { mic.textContent = "🎙"; mic.title = "Voice"; };
          try { rec.start(); mic.textContent = "⏺"; mic.title = "Listening… tap to stop"; mic.onclick = () => rec.stop(); } catch (e) { t3("Couldn't start voice input."); }
        };
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
          else disableDraw();
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
        const APPS = CV_APPS;
        const alist = P.querySelector(".cv-app-list");
        const drawApps = () => { alist.innerHTML = ""; APPS.forEach((a) => {
          const icon = a.img ? `<span class="cv-app-ic cv-app-ic-img"><img src="${esc(a.img)}?v=1" alt="${esc(a.name)}"></span>` : `<span class="cv-app-ic" style="background:${a.c}">${a.emoji}</span>`;
          const row = el(`<button class="cv-app-row">${icon}<span class="cv-app-meta"><span class="cv-app-name">${esc(a.name)}</span><span class="cv-app-desc">${esc(a.desc)}</span></span><span class="cv-app-more">•••</span></button>`);
          row.onclick = () => runApp(a.id);
          alist.appendChild(row); }); };
        drawApps();
        P.querySelectorAll(".cv-app-pill").forEach((p) => p.onclick = () => P.querySelectorAll(".cv-app-pill").forEach((x) => x.classList.toggle("on", x === p)));
        P.querySelectorAll(".cv-up-tab").forEach((t) => t.onclick = () => {
          P.querySelectorAll(".cv-up-tab").forEach((x) => x.classList.toggle("on", x === t));
          if (t.dataset.atab === "your") {
            alist.innerHTML = ""; const used = store().usedApps || [];
            if (!used.length) alist.appendChild(el(`<div class="cv-empty">Apps you open show up here.</div>`));
            CV_APPS.filter((a) => used.includes(a.id)).forEach((a) => { const r = el(`<button class="cv-app-row"><span class="cv-app-ic" style="background:${a.c}">${a.img ? `<img src="${esc(a.img)}?v=1" alt="" style="width:100%;height:100%;object-fit:cover">` : a.emoji}</span><span class="cv-app-meta"><span class="cv-app-name">${esc(a.name)}</span><span class="cv-app-desc">${esc(a.desc)}</span></span></button>`); r.onclick = () => runApp(a.id); alist.appendChild(r); });
          } else drawApps();
        });
      } else if (id === "components") {
        componentsPanel(P);
      } else if (id === "audio") {
        audioPanel(P);
      } else if (id === "videos") {
        P.innerHTML = `<div class="cv-panel-h">Videos</div>
          <button class="cv-tool cvx-v-up">⬆ Upload a video</button>
          <button class="cv-tool cvx-v-yt">▶ Add a YouTube video</button>
          <button class="cv-tool cvx-v-rec">🎥 Record yourself</button>
          <div class="cv-empty" style="padding:6px 0">Clips under 1.5 MB are saved with your design; larger ones stay for this session.</div>
          <div class="cv-up-grid cvx-v-grid"></div>`;
        P.querySelector(".cvx-v-up").onclick = uploadVideo;
        P.querySelector(".cvx-v-yt").onclick = addYouTube;
        P.querySelector(".cvx-v-rec").onclick = () => openCamera();
        drawVideoGrid(P.querySelector(".cvx-v-grid"));
      } else if (id === "bulk") {
        bulkPanel(P);
      } else if (id === "translate") {
        translatePanel(P);
      } else {
        P.innerHTML = placeholder((RAIL.find((r) => r.id === id) || {}).label || "Canva", "Pick a tool from the left.");
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
    showPanel((opts && opts.panel) || "templates");
    if (opts && opts.app) setTimeout(() => runApp(opts.app), 60);

    // Bottom bar: functional zoom slider + placeholder actions.
    const zoom = body.querySelector(".cv-zoom"), zoomVal = body.querySelector(".cv-zoom-val");
    const setZoom = (z) => { stage.style.transform = `scale(${z / 100})`; zoomVal.textContent = z + "%"; };
    zoom.oninput = () => setZoom(+zoom.value);
    const bbToast = (m) => { if (window.Notify) Notify.show({ icon: window.Icon ? Icon.mini("canva", "Canva") : "", title: "Canva", body: m }); };
    void bbToast;
    body.querySelector(".cv-bb-notes").onclick = toggleNotes;
    body.querySelector(".cv-bb-timer").onclick = toggleTimer;
    body.querySelector(".cv-bb-pages").onclick = togglePages;
    body.querySelector(".cv-bb-grid").onclick = openGridView;
    body.querySelector(".cv-bb-expand").onclick = () => presentMode();
    body.querySelector(".cv-bb-help").onclick = openHelp;
    updatePageIdx();
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
    body.querySelector(".cv-back").onclick = () => { stopPreview(); saveDesign(); home(body, ref); };
    { const w = body.closest(".win"); if (w) w.addEventListener("wm-cleanup", () => { stopPreview(); if (timerIv) clearInterval(timerIv); }); }
    // Rasterize the actual design (background + every element) to a PNG canvas.
    // =================== render / export engine ===================
    function bgFill(bg) { if (!bg) return "#ffffff"; if (/^\s*(#|rgb|hsl)/i.test(bg)) return bg; const m = bg.match(/#[0-9a-f]{3,8}|rgba?\([^)]+\)/i); return m ? m[0] : "#ffffff"; }
    // CSS fill (solid or linear-gradient(<angle>deg, stops…)) → canvas fill style for a box.
    function cssFill(g, css, x, y, w, h) {
      const m = /linear-gradient\(\s*(?:([-\d.]+)deg\s*,)?(.+)\)\s*$/i.exec(css || "");
      if (!m) return bgFill(css);
      const a = ((m[1] != null ? +m[1] : 180) - 90) * Math.PI / 180;
      const stops = m[2].split(/,(?![^(]*\))/).map((t) => t.trim()).filter(Boolean);
      const cx = x + w / 2, cy = y + h / 2, len = Math.abs(w * Math.cos(a)) + Math.abs(h * Math.sin(a)), dx = Math.cos(a) * len / 2, dy = Math.sin(a) * len / 2;
      const gr = g.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
      stops.forEach((st, i) => { const mm = /^(.*?)(?:\s+([\d.]+)%)?$/.exec(st); const pos = mm[2] != null ? +mm[2] / 100 : (stops.length > 1 ? i / (stops.length - 1) : 0); try { gr.addColorStop(Math.max(0, Math.min(1, pos)), mm[1].trim()); } catch (e) {} });
      return gr;
    }
    function loadImg(src) { return new Promise((res) => { if (!src) return res(null); const im = new Image(); im.crossOrigin = "anonymous"; im.onload = () => res(im); im.onerror = () => res(null); im.src = src; }); }
    // Render a page (default: the current one) to a canvas, at `scale`.
    async function renderToCanvas(scale, pg, isCurrent) {
      scale = scale || 2; if (!pg) { pg = { bg: design.bg, els: design.els }; isCurrent = true; }
      const W = ty.w, H = ty.h;
      const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(W * scale)); c.height = Math.max(1, Math.round(H * scale));
      const g = c.getContext("2d"); g.scale(scale, scale);
      g.fillStyle = cssFill(g, pg.bg, 0, 0, W, H); g.fillRect(0, 0, W, H);
      const els = pg.els || [];
      for (let idx = 0; idx < els.length; idx++) {
        const e = els[idx];
        g.save(); g.globalAlpha = (e.opacity != null ? e.opacity : 1);
        if (e.rot) { const cx = e.x + (e.w || 0) / 2, cy = e.y + (e.h || 0) / 2; g.translate(cx, cy); g.rotate(e.rot * Math.PI / 180); g.translate(-cx, -cy); }
        if (e.t === "text") {
          const size = e.size || 32; g.font = `${e.italic ? "italic " : ""}${e.bold ? "800" : "400"} ${size}px '${(e.font || "Nunito").replace(/'/g, "")}', system-ui, sans-serif`;
          g.fillStyle = e.color || "#000"; g.textBaseline = "top"; g.textAlign = e.align === "justify" ? "left" : (e.align || "left");
          const maxW = e.w || null; let tx = e.x; if (maxW && e.align === "center") tx = e.x + maxW / 2; else if (maxW && e.align === "right") tx = e.x + maxW;
          // wrap to the box width like the editor does
          const lines = []; String(e.text || "Text").split("\n").forEach((para) => {
            if (!maxW) { lines.push(para); return; }
            let line = ""; para.split(/\s+/).forEach((wd) => { const t = line ? line + " " + wd : wd; if (g.measureText(t).width > maxW && line) { lines.push(line); line = wd; } else line = t; }); lines.push(line);
          });
          const lh = size * 1.25;
          lines.forEach((ln, li) => {
            g.fillText(ln, tx, e.y + li * lh);
            if (e.underline || e.strike) { const wdt = g.measureText(ln).width, lx = g.textAlign === "center" ? tx - wdt / 2 : g.textAlign === "right" ? tx - wdt : tx; g.fillRect(lx, e.y + li * lh + (e.underline ? size * 1.02 : size * 0.55), wdt, Math.max(1, size / 14)); }
          });
        } else if (e.t === "image" || e.t === "frame") {
          const im = await loadImg(e.src); const w = e.w || 160, h = e.h || 160;
          if (e.t === "frame" && e.shape === "circle") { g.beginPath(); g.ellipse(e.x + w / 2, e.y + h / 2, w / 2, h / 2, 0, 0, 7); g.clip(); }
          if (im) {
            if (e.t === "frame") { const r = Math.max(w / im.width, h / im.height), sw = w / r, sh = h / r; g.drawImage(im, (im.width - sw) / 2, (im.height - sh) / 2, sw, sh, e.x, e.y, w, h); }
            else g.drawImage(im, e.x, e.y, w, h);
          } else if (e.t === "frame") { g.fillStyle = "#e8ebf0"; g.fillRect(e.x, e.y, w, h); }
        } else if (e.t === "path") {
          const pts = e.pts || []; if (pts.length) { const sx = (e.w || 1) / (e.vbW || e.w || 1), sy = (e.h || 1) / (e.vbH || e.h || 1); g.strokeStyle = e.color || "#000"; g.lineWidth = e.width || 4; g.lineCap = "round"; g.lineJoin = "round"; g.beginPath(); pts.forEach((pt, k) => { const X = e.x + pt[0] * sx, Y = e.y + pt[1] * sy; k ? g.lineTo(X, Y) : g.moveTo(X, Y); }); g.stroke(); }
        } else if (e.t === "table") {
          const w = e.w || 240, h = e.h || 160, rows = e.rows || 3, cols = e.cols || 3; g.strokeStyle = e.color || "#1c1c28"; g.lineWidth = 1.5;
          for (let r = 0; r <= rows; r++) { g.beginPath(); g.moveTo(e.x, e.y + h * r / rows); g.lineTo(e.x + w, e.y + h * r / rows); g.stroke(); }
          for (let cc = 0; cc <= cols; cc++) { g.beginPath(); g.moveTo(e.x + w * cc / cols, e.y); g.lineTo(e.x + w * cc / cols, e.y + h); g.stroke(); }
        } else if (e.t === "video") {
          const w = e.w || 320, h = e.h || 180, v = isCurrent ? stage.querySelector(`video[data-i="${idx}"]`) : null;
          let drew = false; if (v && v.readyState >= 2) { try { g.drawImage(v, e.x, e.y, w, h); drew = true; } catch (er) {} }
          if (!drew) { g.fillStyle = "#111"; g.fillRect(e.x, e.y, w, h); g.fillStyle = "#fff"; g.beginPath(); g.moveTo(e.x + w / 2 - 14, e.y + h / 2 - 18); g.lineTo(e.x + w / 2 + 18, e.y + h / 2); g.lineTo(e.x + w / 2 - 14, e.y + h / 2 + 18); g.fill(); }
        } else { // rectangles, circles, sticky notes, lines, chart bars
          const w = e.w || 120, h = e.h || 120; g.fillStyle = cssFill(g, e.color || "#7b5cff", e.x, e.y, w, h);
          g.beginPath();
          if (e.t === "circle") g.ellipse(e.x + w / 2, e.y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
          else if (g.roundRect) g.roundRect(e.x, e.y, w, h, Math.min(6, w / 2, h / 2)); else g.rect(e.x, e.y, w, h);
          g.fill();
        }
        g.restore();
      }
      return c;
    }
    function allPages() { if (Array.isArray(design.pages) && design.pages.length) { syncPage(); return design.pages; } return [{ bg: design.bg, els: design.els, notes: design.notes || "" }]; }
    function curPageIdx() { return Array.isArray(design.pages) && design.pages.length ? design.page : 0; }
    async function pageCanvases(scale) { const pages = allPages(), out = []; for (let i = 0; i < pages.length; i++) out.push(await renderToCanvas(scale, pages[i], i === curPageIdx())); return out; }
    const canvasBlob = (c, type, q) => new Promise((res) => c.toBlob(res, type, q));
    async function doDownload() {
      saveDesign();
      try {
        const cvs = await pageCanvases(2), base = safeName(design.name);
        for (let i = 0; i < cvs.length; i++) {
          const blob = await canvasBlob(cvs[i], "image/png");
          if (!blob) { toast("Couldn't export this design."); return; }
          downloadBlob(blob, cvs.length > 1 ? `${base}-${i + 1}.png` : base + ".png");
          if (cvs.length > 1) await new Promise((r) => setTimeout(r, 350));
        }
        toast(cvs.length > 1 ? `Downloaded ${cvs.length} pages as PNG.` : `Downloaded “${design.name}.png” (${ty.w}×${ty.h})`);
      } catch (err) { toast("Couldn't export — an external image blocked it. Remove it and retry."); }
    }
    async function exportJPG() {
      try { const cvs = await pageCanvases(2), base = safeName(design.name); for (let i = 0; i < cvs.length; i++) { downloadBlob(await canvasBlob(cvs[i], "image/jpeg", 0.92), cvs.length > 1 ? `${base}-${i + 1}.jpg` : base + ".jpg"); if (cvs.length > 1) await new Promise((r) => setTimeout(r, 350)); } toast("Downloaded as JPG."); }
      catch (e) { toast("Couldn't export — an external image blocked it."); }
    }
    // Real multi-page PDF: one JPEG image per page, sized in points (96px → 72pt).
    async function exportPDF() {
      try {
        const cvs = await pageCanvases(2), enc = new TextEncoder(), parts = [], offs = []; let len = 0;
        const push = (x) => { const b = typeof x === "string" ? enc.encode(x) : x; parts.push(b); len += b.length; };
        const obj = (id, chunks) => { offs[id] = len; push(id + " 0 obj\n"); chunks.forEach(push); push("\nendobj\n"); };
        const W = (ty.w * 0.75).toFixed(2), H = (ty.h * 0.75).toFixed(2), n = cvs.length;
        push("%PDF-1.4\n%âãÏÓ\n");
        obj(1, ["<< /Type /Catalog /Pages 2 0 R >>"]);
        obj(2, [`<< /Type /Pages /Kids [${cvs.map((_, i) => (3 + i * 3) + " 0 R").join(" ")}] /Count ${n} >>`]);
        for (let i = 0; i < n; i++) {
          const pid = 3 + i * 3, jpg = new Uint8Array(await (await canvasBlob(cvs[i], "image/jpeg", 0.9)).arrayBuffer());
          const content = `q ${W} 0 0 ${H} 0 0 cm /Im${i} Do Q`;
          obj(pid, [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im${i} ${pid + 2} 0 R >> >> /Contents ${pid + 1} 0 R >>`]);
          obj(pid + 1, [`<< /Length ${content.length} >>\nstream\n${content}\nendstream`]);
          obj(pid + 2, [`<< /Type /XObject /Subtype /Image /Width ${cvs[i].width} /Height ${cvs[i].height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`, jpg, "\nendstream"]);
        }
        const total = 3 + n * 3, xref = len;
        let x = `xref\n0 ${total}\n0000000000 65535 f \n`; for (let i = 1; i < total; i++) x += String(offs[i]).padStart(10, "0") + " 00000 n \n";
        push(x); push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
        downloadBlob(new Blob(parts, { type: "application/pdf" }), safeName(design.name) + ".pdf");
        toast(`Downloaded PDF (${n} page${n > 1 ? "s" : ""}).`);
      } catch (e) { toast("Couldn't export the PDF — an external image blocked it."); }
    }
    async function exportWebsite() {
      try {
        const cvs = await pageCanvases(1.5), imgs = cvs.map((c, i) => `<section><img src="${c.toDataURL("image/jpeg", 0.9)}" alt="${esc(design.name || "Design")} — page ${i + 1}"></section>`).join("\n");
        const html = `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(design.name || "My design")}</title>\n<style>html,body{margin:0;background:#0f1014;color:#9aa0aa;font-family:system-ui,sans-serif}main{display:flex;flex-direction:column;align-items:center;gap:28px;padding:32px 14px}section img{display:block;width:min(100%,${ty.w}px);height:auto;border-radius:10px;box-shadow:0 14px 50px rgba(0,0,0,.55)}footer{text-align:center;padding:10px 0 28px;font-size:13px}</style></head>\n<body><main>\n${imgs}\n</main><footer>Made with Canva</footer></body></html>`;
        downloadBlob(new Blob([html], { type: "text/html" }), safeName(design.name) + ".html");
        toast("Website downloaded — open the .html file in any browser, or upload it to your host.");
      } catch (e) { toast("Couldn't build the website — an external image blocked it."); }
    }
    async function exportPowerPoint() {
      try {
        const cvs = await pageCanvases(1);
        const deck = { slides: cvs.map((c) => ({ bg: "#ffffff", title: "", body: "", titleColor: "#17181c", bodyColor: "#5a5f6b", images: [{ src: c.toDataURL("image/jpeg", 0.85), x: 0, y: 0, w: 100, h: 100 }] })) };
        if (!window.VFS || !window.Office) { downloadBlob(new Blob([JSON.stringify(deck)], { type: "application/json" }), safeName(design.name) + ".pptx.json"); return; }
        const kids = window.VFS.childrenAt(["Documents"]) || window.VFS.ensure().Documents.children;
        const name = window.VFS.uniqueName(kids, (design.name || "Presentation").replace(/[\\/:*?"<>|]+/g, ""), ".pptx");
        const node = { type: "file", kind: "pptx", content: JSON.stringify(deck), ts: Date.now() };
        kids[name] = node; State.save();
        toast(`Saved “${name}” to Documents — opening in PowerPoint.`);
        window.Office.openPowerPoint({ name, node });
      } catch (e) { toast("Couldn't export to PowerPoint (" + e.message + ")."); }
    }

    // =================== pages ===================
    function ensurePages() { if (!Array.isArray(design.pages) || !design.pages.length) { design.pages = [{ bg: design.bg, els: design.els, notes: design.notes || "" }]; design.page = 0; } if (!(design.page >= 0 && design.page < design.pages.length)) design.page = 0; }
    function syncPage() { ensurePages(); design.pages[design.page] = { bg: design.bg, els: design.els, notes: design.notes || "" }; }
    function updatePageIdx() { const e2 = body.querySelector(".cv-bb-pageidx"); if (e2) e2.textContent = (curPageIdx() + 1) + " / " + (Array.isArray(design.pages) && design.pages.length ? design.pages.length : 1); }
    function loadPage(i) {
      const pg = design.pages[i]; design.page = i; design.bg = pg.bg; design.els = pg.els; design.notes = pg.notes || "";
      stage.style.background = design.bg; render(); selectEl(null);
      past = []; future = []; present = snapshot();
      updatePageIdx(); saveDesign(); refreshNotes(); refreshPagesPop();
    }
    function gotoPage(i) { syncPage(); if (i < 0 || i >= design.pages.length || i === design.page) return; loadPage(i); }
    function addPage(dup) { syncPage(); const cur = design.pages[design.page]; design.pages.splice(design.page + 1, 0, dup ? JSON.parse(JSON.stringify(cur)) : { bg: "#ffffff", els: [], notes: "" }); loadPage(design.page + 1); toast(dup ? "Page duplicated." : `Page ${design.page + 1} added.`); }
    function deletePage() { syncPage(); if (design.pages.length <= 1) { toast("A design needs at least one page."); return; } const i = design.page; design.pages.splice(i, 1); loadPage(Math.min(i, design.pages.length - 1)); toast("Page deleted."); }
    function movePage(d) { syncPage(); const i = design.page, j = i + d; if (j < 0 || j >= design.pages.length) return; const t = design.pages[i]; design.pages[i] = design.pages[j]; design.pages[j] = t; design.page = j; updatePageIdx(); saveDesign(); refreshPagesPop(); }
    async function thumbStrip(host, big) {
      const pages = allPages(), wrap = el(`<div class="cvx-pages"></div>`); host.appendChild(wrap);
      for (let i = 0; i < pages.length; i++) {
        const t = el(`<div class="cvx-thumb ${i === curPageIdx() ? "on" : ""}"></div>`); wrap.appendChild(t);
        const c = await renderToCanvas((big ? 200 : 110) / ty.w, pages[i], i === curPageIdx()); t.appendChild(c); t.appendChild(el(`<span>Page ${i + 1}</span>`));
        t.onclick = () => { gotoPage(i); const gv = body.querySelector(".cvx-gridview"); if (gv && big) gv.remove(); };
      }
      return wrap;
    }
    function closePops() { body.querySelectorAll(".cvx-pop").forEach((x) => x.remove()); }
    function refreshPagesPop() { if (body.querySelector(".cvx-pages-pop")) { closePops(); togglePages(); } }
    function togglePages() {
      if (body.querySelector(".cvx-pages-pop")) { closePops(); return; }
      closePops(); ensurePages();
      const pop = el(`<div class="cvx-pop cvx-pages-pop" style="right:12px"><div class="cvx-strip"></div><div class="cvx-actions" style="justify-content:flex-start">
        <button class="cv-btn" data-pa="add">＋ Add page</button><button class="cv-btn" data-pa="dup">⧉ Duplicate</button><button class="cv-btn" data-pa="left">← Move</button><button class="cv-btn" data-pa="right">Move →</button><button class="cv-btn" data-pa="del">🗑 Delete</button><button class="cv-link" data-pa="x">Close</button></div></div>`);
      body.querySelector(".cv").appendChild(pop);
      thumbStrip(pop.querySelector(".cvx-strip"), false);
      pop.querySelectorAll("[data-pa]").forEach((b) => b.onclick = () => { const a = b.dataset.pa; if (a === "add") addPage(false); else if (a === "dup") addPage(true); else if (a === "del") { if (confirm(`Delete page ${design.page + 1}?`)) deletePage(); } else if (a === "left") movePage(-1); else if (a === "right") movePage(1); else closePops(); });
    }
    function openGridView() {
      const gv = el(`<div class="cvx-gridview"><div style="display:flex;align-items:center;gap:10px;margin-bottom:14px"><h2 style="margin:0">All pages</h2><span class="grow" style="flex:1"></span><button class="cv-btn cvx-gv-add">＋ Add page</button><button class="cv-btn cvx-gv-x">Done</button></div><div class="cvx-gv-body"></div></div>`);
      body.querySelector(".cv").appendChild(gv);
      gv.querySelector(".cvx-gv-x").onclick = () => gv.remove();
      gv.querySelector(".cvx-gv-add").onclick = () => { addPage(false); gv.remove(); };
      thumbStrip(gv.querySelector(".cvx-gv-body"), true);
    }

    // =================== notes / timer / help ===================
    function refreshNotes() { const ta = body.querySelector(".cvx-notes textarea"); if (ta) ta.value = design.notes || ""; }
    function toggleNotes() {
      const ex = body.querySelector(".cvx-notes"); if (ex) { ex.remove(); return; }
      const n = el(`<div class="cvx-notes"><div style="display:flex;justify-content:space-between"><b>Notes · page ${curPageIdx() + 1}</b><button class="cv-link">Close</button></div><textarea placeholder="Add speaker notes for this page — they show up while you present."></textarea></div>`);
      body.querySelector(".cv").appendChild(n);
      const ta = n.querySelector("textarea"); ta.value = design.notes || ""; ta.focus();
      let tmr = null; ta.oninput = () => { design.notes = ta.value; clearTimeout(tmr); tmr = setTimeout(() => { saveDesign(); flashSaved(); }, 400); };
      n.querySelector("button").onclick = () => n.remove();
    }
    var timerIv = null, timerMs = 0, timerStart = 0, timerOn = false;
    function toggleTimer() {
      const ex = body.querySelector(".cvx-timer-pop"); if (ex) { ex.remove(); return; }
      closePops();
      const pop = el(`<div class="cvx-pop cvx-timer-pop" style="left:110px;min-width:220px"><b>Presenter timer</b><div class="cvx-timer">00:00</div><div class="cvx-actions" style="justify-content:center"><button class="cv-btn cvx-tgo"></button><button class="cv-btn cvx-treset">Reset</button></div></div>`);
      body.querySelector(".cv").appendChild(pop);
      const disp = pop.querySelector(".cvx-timer"), go = pop.querySelector(".cvx-tgo");
      const elapsed = () => timerMs + (timerOn ? Date.now() - timerStart : 0);
      const paint = () => { const t = Math.floor(elapsed() / 1000); disp.textContent = String(Math.floor(t / 60)).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0"); go.textContent = timerOn ? "❚❚ Pause" : "▶ Start"; };
      go.onclick = () => { if (timerOn) { timerMs = elapsed(); timerOn = false; } else { timerStart = Date.now(); timerOn = true; } paint(); };
      pop.querySelector(".cvx-treset").onclick = () => { timerMs = 0; timerStart = Date.now(); paint(); };
      clearInterval(timerIv); timerIv = setInterval(() => { if (!pop.isConnected) { clearInterval(timerIv); timerIv = null; return; } paint(); }, 250); paint();
    }
    function openHelp() {
      const m = el(`<div class="cvx-modal"><div class="cvx-box"><h3>Help & shortcuts</h3>
        <div class="cvx-row"><div class="grow">Undo / redo</div><b>Ctrl/⌘ Z · Ctrl/⌘ Y</b></div>
        <div class="cvx-row"><div class="grow">Copy · cut · paste · duplicate</div><b>⌘ C · ⌘ X · ⌘ V · ⌘ D</b></div>
        <div class="cvx-row"><div class="grow">Nudge selection (10px with Shift)</div><b>Arrow keys</b></div>
        <div class="cvx-row"><div class="grow">Delete selection</div><b>Delete / Backspace</b></div>
        <div class="cvx-row"><div class="grow">Bold · italic · underline (while editing text)</div><b>⌘ B · ⌘ I · ⌘ U</b></div>
        <div class="cvx-row"><div class="grow">Deselect / stop drawing</div><b>Esc</b></div>
        <div class="cvx-row"><div class="grow">Present: next / previous / notes / exit</div><b>→ Space · ← · N · Esc</b></div>
        <p class="cvx-sub" style="margin:6px 0 0">Tip: add pages with <b>Pages</b>, write speaker notes with <b>Notes</b>, then <b>Share → Present</b>. Learn more in Home → More → Design School.</p>
        <div class="cvx-actions"><button class="cv-btn">Got it</button></div></div></div>`);
      m.querySelector("button").onclick = () => m.remove(); m.onclick = (e) => { if (e.target === m) m.remove(); };
      body.querySelector(".cv").appendChild(m);
    }

    // =================== present (and record) ===================
    async function presentMode(o) {
      o = o || {}; saveDesign();
      const pages = allPages(); let cur = curPageIdx();
      const ov = el(`<div class="cvx-present" tabindex="0"><canvas></canvas>
        <div class="cvx-pnotes" hidden></div>
        <div class="cvx-pbar"><button data-p="prev" title="Previous">‹</button><span class="cvx-pidx"></span><button data-p="next" title="Next">›</button><button data-p="notes">Notes</button><button data-p="fs" title="Full screen">⛶</button>${o.record ? '<span class="cvx-rec">● REC</span>' : ""}<button data-p="exit">${o.record ? "■ Stop & save" : "✕ Exit"}</button></div></div>`);
      document.body.appendChild(ov); ov.focus();
      try { if (ov.requestFullscreen) ov.requestFullscreen().catch(() => {}); } catch (e) {}
      const cv = ov.querySelector("canvas"), g = cv.getContext("2d"), notesEl = ov.querySelector(".cvx-pnotes");
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      let imgs = [], fade = 1, prevImg = null, cam = null, camStream = null, recorder = null, chunks = [], music = null, raf = 0, closed = false;
      const sizeCanvas = () => { cv.width = Math.round(innerWidth * dpr); cv.height = Math.round(innerHeight * dpr); };
      sizeCanvas();
      const fitScale = Math.min(innerWidth / ty.w, innerHeight / ty.h) * dpr;
      ov.querySelector(".cvx-pidx").textContent = "Loading…";
      for (let i = 0; i < pages.length; i++) imgs.push(await renderToCanvas(Math.min(fitScale, 3), pages[i], i === curPageIdx()));
      const box = () => { const s = Math.min(cv.width / ty.w, cv.height / ty.h), w = ty.w * s, h = ty.h * s; return { x: (cv.width - w) / 2, y: (cv.height - h) / 2, w, h, s }; };
      const show = (i) => { if (i < 0 || i >= imgs.length) return; prevImg = imgs[cur]; cur = i; fade = o.flipbook ? 0 : 0.25; ov.querySelector(".cvx-pidx").textContent = `${cur + 1} / ${imgs.length}`; notesEl.textContent = pages[cur].notes || "No notes for this page."; };
      show(cur); fade = 1;
      function draw() {
        if (closed) return;
        g.fillStyle = "#000"; g.fillRect(0, 0, cv.width, cv.height);
        const b = box();
        fade = Math.min(1, fade + 0.08);
        if (prevImg && fade < 1) { g.globalAlpha = 1; if (o.flipbook) { g.drawImage(prevImg, b.x - b.w * fade, b.y, b.w, b.h); g.drawImage(imgs[cur], b.x + b.w * (1 - fade), b.y, b.w, b.h); } else { g.drawImage(prevImg, b.x, b.y, b.w, b.h); g.globalAlpha = fade; g.drawImage(imgs[cur], b.x, b.y, b.w, b.h); } g.globalAlpha = 1; }
        else g.drawImage(imgs[cur], b.x, b.y, b.w, b.h);
        if (cam && cam.readyState >= 2) { // webcam bubble, bottom-right
          const r = Math.min(cv.width, cv.height) * 0.12, cx = cv.width - r - 30 * dpr, cy = cv.height - r - 30 * dpr;
          g.save(); g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.clip();
          const vw = cam.videoWidth, vh = cam.videoHeight, sc = Math.max(2 * r / vw, 2 * r / vh);
          g.translate(cx, cy); g.scale(-1, 1); g.drawImage(cam, -vw * sc / 2, -vh * sc / 2, vw * sc, vh * sc); g.restore();
          g.lineWidth = 4 * dpr; g.strokeStyle = "#fff"; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
        }
        raf = requestAnimationFrame(draw);
      }
      if (design.audio) { const tr = TRACKS.find((t) => t.id === design.audio); if (tr) { music = makeMusic(tr); music.start(); } }
      if (o.record) {
        try {
          camStream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: true });
          cam = document.createElement("video"); cam.muted = true; cam.playsInline = true; cam.srcObject = camStream; cam.play().catch(() => {});
        } catch (e) { toast("Camera/mic unavailable — recording the slides only."); }
        try {
          const stream = cv.captureStream(30); if (camStream) camStream.getAudioTracks().forEach((t) => stream.addTrack(t));
          const mime = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm", "video/mp4"].find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) || "";
          recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
          recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
          recorder.onstop = () => { const type = recorder.mimeType || "video/webm", blob = new Blob(chunks, { type }); if (blob.size) { downloadBlob(blob, safeName(design.name) + "-presentation." + (/mp4/.test(type) ? "mp4" : "webm")); toast("Recording saved to your downloads."); } };
          recorder.start(500);
        } catch (e) { recorder = null; toast("Recording isn't supported in this browser — presenting without recording."); ov.querySelector(".cvx-rec") && ov.querySelector(".cvx-rec").remove(); }
      }
      draw();
      function close() {
        if (closed) return; closed = true; cancelAnimationFrame(raf);
        document.removeEventListener("keydown", onKey, true); window.removeEventListener("resize", sizeCanvas);
        if (recorder && recorder.state !== "inactive") recorder.stop();
        if (camStream) camStream.getTracks().forEach((t) => t.stop());
        if (music) music.stop();
        if (document.fullscreenElement === ov) document.exitFullscreen().catch(() => {});
        ov.remove();
      }
      function onKey(e) {
        if (["ArrowRight", "PageDown", " ", "Enter"].includes(e.key)) { e.preventDefault(); e.stopPropagation(); show(cur + 1); }
        else if (["ArrowLeft", "PageUp", "Backspace"].includes(e.key)) { e.preventDefault(); e.stopPropagation(); show(cur - 1); }
        else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
        else if (e.key.toLowerCase() === "n") notesEl.hidden = !notesEl.hidden;
      }
      document.addEventListener("keydown", onKey, true); window.addEventListener("resize", sizeCanvas);
      cv.onclick = (e) => { // clicking a YouTube element opens it; anywhere else advances
        const b = box(), r = cv.getBoundingClientRect(), x = ((e.clientX - r.left) * dpr - b.x) / b.s, y = ((e.clientY - r.top) * dpr - b.y) / b.s;
        const hit = (pages[cur].els || []).slice().reverse().find((el2) => el2.link && x >= el2.x && y >= el2.y && x <= el2.x + (el2.w || 0) && y <= el2.y + (el2.h || 0));
        if (hit) window.open(hit.link, "_blank", "noopener"); else show(cur + 1);
      };
      ov.querySelectorAll("[data-p]").forEach((b) => b.onclick = (e) => { e.stopPropagation(); const a = b.dataset.p; if (a === "prev") show(cur - 1); else if (a === "next") show(cur + 1); else if (a === "notes") notesEl.hidden = !notesEl.hidden; else if (a === "fs") { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else if (ov.requestFullscreen) ov.requestFullscreen().catch(() => {}); } else close(); });
    }

    // =================== camera, video, YouTube ===================
    const sessionVideos = [];
    async function openCamera() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { toast("This browser can't access a camera."); return; }
      let stream; try { stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: true }); }
      catch (e) { try { stream = await navigator.mediaDevices.getUserMedia({ video: true }); } catch (e2) { toast("Camera access was blocked — allow it in your browser settings and try again."); return; } }
      const m = el(`<div class="cvx-modal"><div class="cvx-box" style="width:min(640px,94%)"><h3>Record yourself</h3><video class="cvx-camvid" autoplay playsinline muted></video>
        <div class="cvx-actions" style="justify-content:space-between;align-items:center"><span class="cvx-camt" style="font:600 14px ui-monospace,monospace;color:#e5484d"></span><span style="flex:1"></span><button class="cv-btn cvx-snap">📸 Photo</button><button class="cv-btn cvx-recb">⏺ Record</button><button class="cv-link cvx-cx">Close</button></div></div></div>`);
      body.querySelector(".cv").appendChild(m);
      const v = m.querySelector("video"); v.srcObject = stream; v.style.transform = "scaleX(-1)";
      let rec = null, chunks = [], t0 = 0, tick = null;
      const stopAll = () => { if (rec && rec.state !== "inactive") rec.stop(); stream.getTracks().forEach((t) => t.stop()); clearInterval(tick); m.remove(); };
      m.querySelector(".cvx-cx").onclick = stopAll;
      m.querySelector(".cvx-snap").onclick = () => {
        const c = document.createElement("canvas"); c.width = v.videoWidth || 1280; c.height = v.videoHeight || 720;
        const g2 = c.getContext("2d"); g2.translate(c.width, 0); g2.scale(-1, 1); g2.drawImage(v, 0, 0, c.width, c.height);
        const url = c.toDataURL("image/jpeg", 0.85); const st = store(); if (!st.uploads) st.uploads = []; st.uploads.unshift({ src: url, name: "Camera photo" }); State.save();
        addImage(url); toast("Photo added to your design and Uploads.");
      };
      m.querySelector(".cvx-recb").onclick = (e) => {
        const b = e.currentTarget;
        if (rec && rec.state === "recording") { rec.stop(); b.textContent = "⏺ Record"; clearInterval(tick); m.querySelector(".cvx-camt").textContent = ""; return; }
        try { rec = new MediaRecorder(stream); } catch (er) { toast("Video recording isn't supported in this browser."); return; }
        chunks = []; rec.ondataavailable = (ev) => { if (ev.data.size) chunks.push(ev.data); };
        rec.onstop = () => { const blob = new Blob(chunks, { type: rec.mimeType || "video/webm" }); keepVideo(blob, "Recording " + new Date().toLocaleTimeString()); };
        rec.start(250); t0 = Date.now(); b.textContent = "■ Stop";
        tick = setInterval(() => { const t = Math.floor((Date.now() - t0) / 1000); m.querySelector(".cvx-camt").textContent = "● " + Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0"); }, 250);
      };
    }
    function keepVideo(blob, name) {
      const add = (src, persisted) => { sessionVideos.unshift({ src, name }); addVideo(src); toast(persisted ? "Video added and saved with your design." : "Video added (large clips last for this session)."); const gr = body.querySelector(".cvx-v-grid"); if (gr) drawVideoGrid(gr); };
      if (blob.size < 1.5 * 1024 * 1024) { const r = new FileReader(); r.onload = () => add(r.result, true); r.readAsDataURL(blob); }
      else add(URL.createObjectURL(blob), false);
    }
    function uploadVideo() {
      const inp = document.createElement("input"); inp.type = "file"; inp.accept = "video/*";
      inp.onchange = () => { const f = inp.files && inp.files[0]; if (f) keepVideo(f, f.name); };
      inp.click();
    }
    function addVideo(src) { design.els.push({ t: "video", x: 40, y: 40, w: Math.min(360, ty.w - 80), h: Math.round(Math.min(360, ty.w - 80) * 9 / 16), src }); render(); selectEl(design.els.length - 1); record(); }
    function drawVideoGrid(grid) {
      grid.innerHTML = "";
      const vids = sessionVideos.concat(allPages().flatMap((p) => p.els || []).filter((e) => e.t === "video" && !sessionVideos.some((s2) => s2.src === e.src)).map((e) => ({ src: e.src, name: "In this design" })));
      if (!vids.length) { grid.appendChild(el(`<div class="cv-empty">Videos you upload or record show up here.</div>`)); return; }
      vids.forEach((vd) => { const b = el(`<button class="cv-el-card" title="${esc(vd.name)}"><video src="${esc(vd.src)}" muted playsinline style="width:100%;height:100%;object-fit:cover"></video></button>`); b.onclick = () => addVideo(vd.src); grid.appendChild(b); });
    }
    function addYouTube() {
      const u = prompt("Paste a YouTube link:"); if (!u) return;
      const m = /(?:youtu\.be\/|[?&]v=|embed\/|shorts\/|live\/)([\w-]{11})/.exec(u) || /^\s*([\w-]{11})\s*$/.exec(u);
      if (!m) { toast("That doesn't look like a YouTube link."); return; }
      const w = Math.min(360, ty.w - 80);
      design.els.push({ t: "image", x: 40, y: 40, w, h: Math.round(w * 9 / 16), src: "https://i.ytimg.com/vi/" + m[1] + "/hqdefault.jpg", link: "https://www.youtube.com/watch?v=" + m[1] });
      render(); selectEl(design.els.length - 1); record(); markAppUsed("youtube");
      toast("YouTube video added — click it while presenting to play it on YouTube.");
    }

    // =================== apps ===================
    function runApp(id) {
      markAppUsed(id);
      if (id === "giphy") openGiphy();
      else if (id === "youtube") addYouTube();
      else if (id === "simplebooklet") { toast("Opening your pages as a flipbook…"); presentMode({ flipbook: true }); }
      else if (id === "did") { toast("Generating an AI presenter avatar…"); generateImage("friendly professional presenter avatar, head and shoulders portrait, soft studio lighting, looking at the camera, plain background"); }
      else if (id === "mockups") openMockups();
    }
    async function openMockups() {
      let art; try { art = await renderToCanvas(1.5); } catch (e) { toast("Couldn't render the design for mockups."); return; }
      const KINDS = [["phone", "📱 Phone"], ["poster", "🖼 Framed poster"], ["tshirt", "👕 T-shirt"], ["laptop", "💻 Laptop"]];
      const m = el(`<div class="cvx-modal"><div class="cvx-box" style="width:min(760px,95%)"><h3>Mockups</h3><div class="cvx-actions" style="justify-content:flex-start">${KINDS.map(([k, l], i) => `<button class="cv-btn cvx-mk ${i ? "" : "on"}" data-k="${k}">${l}</button>`).join("")}</div>
        <canvas width="900" height="620" style="width:100%;height:auto;border-radius:10px;background:#eee"></canvas><div class="cvx-actions"><button class="cv-link cvx-mx">Close</button><button class="cv-btn cvx-mdl">⬇ Download mockup</button></div></div></div>`);
      body.querySelector(".cv").appendChild(m);
      const c = m.querySelector("canvas"), g = c.getContext("2d"); let kind = "phone";
      const fit = (bx, by, bw, bh, cover) => { const s2 = cover ? Math.max(bw / art.width, bh / art.height) : Math.min(bw / art.width, bh / art.height), w = art.width * s2, h = art.height * s2; g.save(); g.beginPath(); g.rect(bx, by, bw, bh); g.clip(); g.drawImage(art, bx + (bw - w) / 2, by + (bh - h) / 2, w, h); g.restore(); };
      const rr = (x, y, w, h, r) => { g.beginPath(); if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); };
      function draw() {
        const bg = g.createLinearGradient(0, 0, 0, 620);
        if (kind === "phone") {
          bg.addColorStop(0, "#e9ecf3"); bg.addColorStop(1, "#cfd5e0"); g.fillStyle = bg; g.fillRect(0, 0, 900, 620);
          g.fillStyle = "rgba(0,0,0,.18)"; rr(352, 48, 220, 540, 38); g.fill();
          g.fillStyle = "#16171b"; rr(340, 36, 220, 540, 38); g.fill(); g.fillStyle = "#000"; rr(352, 48, 196, 516, 28); g.fill();
          g.save(); rr(352, 48, 196, 516, 28); g.clip(); fit(352, 48, 196, 516, true); g.restore();
          g.fillStyle = "#16171b"; rr(410, 56, 80, 20, 10); g.fill();
        } else if (kind === "poster") {
          bg.addColorStop(0, "#efe7dc"); bg.addColorStop(1, "#ddd2c2"); g.fillStyle = bg; g.fillRect(0, 0, 900, 620);
          g.fillStyle = "#b9a98f"; g.fillRect(0, 540, 900, 80);
          const r2 = Math.min(460 / art.width, 420 / art.height), w = art.width * r2 + 60, h = art.height * r2 + 60, x = (900 - w) / 2, y = 40 + (440 - h) / 2;
          g.fillStyle = "rgba(0,0,0,.22)"; g.fillRect(x + 10, y + 14, w, h);
          g.fillStyle = "#3b2a1c"; g.fillRect(x, y, w, h); g.fillStyle = "#faf8f4"; g.fillRect(x + 14, y + 14, w - 28, h - 28);
          fit(x + 30, y + 30, w - 60, h - 60, false);
        } else if (kind === "tshirt") {
          bg.addColorStop(0, "#dfe7ef"); bg.addColorStop(1, "#c3cfdb"); g.fillStyle = bg; g.fillRect(0, 0, 900, 620);
          g.fillStyle = "#fbfbfb"; g.strokeStyle = "#d6d9de"; g.lineWidth = 3;
          g.beginPath(); g.moveTo(330, 70); g.quadraticCurveTo(450, 120, 570, 70); g.lineTo(720, 140); g.lineTo(670, 250); g.lineTo(610, 225); g.lineTo(610, 580); g.lineTo(290, 580); g.lineTo(290, 225); g.lineTo(230, 250); g.lineTo(180, 140); g.closePath(); g.fill(); g.stroke();
          g.save(); g.globalCompositeOperation = "multiply"; fit(360, 170, 180, 220, false); g.restore();
        } else {
          bg.addColorStop(0, "#e6e9f0"); bg.addColorStop(1, "#cdd2dc"); g.fillStyle = bg; g.fillRect(0, 0, 900, 620);
          g.fillStyle = "#1d1f24"; rr(170, 70, 560, 360, 18); g.fill(); g.fillStyle = "#000"; g.fillRect(186, 86, 528, 328); fit(186, 86, 528, 328, true);
          g.fillStyle = "#c9ccd2"; g.beginPath(); g.moveTo(110, 450); g.lineTo(790, 450); g.lineTo(830, 490); g.lineTo(70, 490); g.closePath(); g.fill();
          g.fillStyle = "#b3b7bf"; g.fillRect(400, 450, 100, 8);
        }
      }
      draw();
      m.querySelectorAll(".cvx-mk").forEach((b) => b.onclick = () => { kind = b.dataset.k; m.querySelectorAll(".cvx-mk").forEach((x) => x.classList.toggle("on", x === b)); draw(); });
      m.querySelector(".cvx-mx").onclick = () => m.remove();
      m.querySelector(".cvx-mdl").onclick = () => c.toBlob((b) => { downloadBlob(b, safeName(design.name) + "-" + kind + "-mockup.png"); toast("Mockup downloaded."); }, "image/png");
    }

    // =================== components ===================
    const STARTER_COMPONENTS = [
      { name: "Button", els: [{ t: "rect", x: 0, y: 0, w: 200, h: 56, color: "#7b2ae8" }, { t: "text", x: 0, y: 12, w: 200, align: "center", text: "Get started", size: 24, color: "#ffffff", bold: true }] },
      { name: "Quote card", els: [{ t: "rect", x: 0, y: 0, w: 320, h: 180, color: "#fff4d6" }, { t: "text", x: 20, y: 20, w: 280, text: "“Design is intelligence made visible.”", size: 24, color: "#3a2a00", italic: true }, { t: "text", x: 20, y: 132, w: 280, text: "— Alina Wheeler", size: 16, color: "#7a5a10" }] },
      { name: "Sale badge", els: [{ t: "circle", x: 0, y: 0, w: 140, h: 140, color: "#e14b3b" }, { t: "text", x: 0, y: 46, w: 140, align: "center", text: "50% OFF", size: 26, color: "#ffffff", bold: true }] },
      { name: "Section divider", els: [{ t: "rect", x: 0, y: 0, w: 300, h: 4, color: "#1c1c28" }] },
      { name: "Label pill", els: [{ t: "rect", x: 0, y: 0, w: 150, h: 40, color: "#11998e" }, { t: "text", x: 0, y: 8, w: 150, align: "center", text: "NEW", size: 20, color: "#ffffff", bold: true }] },
    ];
    function insertComponent(els) {
      const minX = Math.min.apply(null, els.map((e) => e.x || 0)), minY = Math.min.apply(null, els.map((e) => e.y || 0));
      els.forEach((e) => { const c2 = JSON.parse(JSON.stringify(e)); c2.x = (c2.x || 0) - minX + 60; c2.y = (c2.y || 0) - minY + 60; design.els.push(c2); });
      render(); selectEl(design.els.length - 1); record();
    }
    function componentsPanel(P) {
      const st = store(); if (!st.components) st.components = [];
      P.innerHTML = `<div class="cv-panel-h">Components</div><button class="cv-tool cvx-c-save">＋ Save selection as a component</button><div class="cv-panel-h">Your components</div><div class="cvx-c-mine"></div><div class="cv-panel-h">Starter components</div><div class="cvx-c-built"></div>`;
      const mine = P.querySelector(".cvx-c-mine"), built = P.querySelector(".cvx-c-built");
      if (!st.components.length) mine.appendChild(el(`<div class="cv-empty">Select an element and save it to reuse it in any design.</div>`));
      st.components.forEach((cp, i) => { const r = el(`<div class="cvx-comp"><button class="cv-tool">🧩 ${esc(cp.name)}</button><button class="cv-link" title="Delete">✕</button></div>`); r.children[0].onclick = () => insertComponent(cp.els); r.children[1].onclick = () => { st.components.splice(i, 1); State.save(); componentsPanel(P); }; mine.appendChild(r); });
      STARTER_COMPONENTS.forEach((cp) => { const b = el(`<button class="cv-tool">🧩 ${esc(cp.name)}</button>`); b.onclick = () => insertComponent(cp.els); built.appendChild(b); });
      P.querySelector(".cvx-c-save").onclick = () => {
        if (sel == null || !design.els[sel]) { toast("Select an element on the page first."); return; }
        const n = prompt("Component name:", "My component"); if (!n || !n.trim()) return;
        st.components.unshift({ name: n.trim(), els: [JSON.parse(JSON.stringify(design.els[sel]))] }); State.save(); toast(`Saved “${n.trim()}” — reuse it in any design.`); componentsPanel(P);
      };
    }

    // =================== audio ===================
    var preview = null;
    function stopPreview() { if (preview) { preview.stop(); preview = null; } }
    function audioPanel(P) {
      P.innerHTML = `<div class="cv-panel-h">Audio</div><div class="cv-empty" style="padding:0 0 8px">Royalty-free tracks. Add one and it plays when you present.</div><div class="cvx-tracks"></div>`;
      const list = P.querySelector(".cvx-tracks");
      const draw = () => {
        list.innerHTML = "";
        TRACKS.forEach((tr) => {
          const on = design.audio === tr.id, playing = preview && preview.id === tr.id;
          const r = el(`<div class="cvx-track ${on ? "on" : ""}"><button title="Preview">${playing ? "❚❚" : "▶"}</button><div class="grow"><b>${esc(tr.name)}</b><span>${esc(tr.mood)}</span></div><button>${on ? "✓ Added" : "＋ Add"}</button></div>`);
          const [pb, ab] = r.querySelectorAll("button");
          pb.onclick = () => { const was = playing; stopPreview(); if (!was) { preview = makeMusic(tr); preview.start(); } draw(); };
          ab.onclick = () => { design.audio = on ? null : tr.id; saveDesign(); flashSaved(); toast(on ? "Audio removed." : `“${tr.name}” added — it plays when you present.`); draw(); };
          list.appendChild(r);
        });
      };
      draw();
    }

    // =================== bulk create ===================
    function bulkPanel(P) {
      const texts = design.els.filter((e) => e.t === "text").slice(0, 5);
      if (!texts.length) { P.innerHTML = placeholder("Bulk create", "Add at least one text box. Each row of data then becomes a new copy of this design with the text filled in."); return; }
      P.innerHTML = `<div class="cv-panel-h">Bulk create</div><div class="cv-empty" style="padding:0 0 6px">One row per design, fields separated by commas, in this order:</div>
        <ol style="margin:0 0 8px 18px;padding:0;font-size:13px">${texts.map((t) => `<li>“${esc((t.text || "").slice(0, 26))}”</li>`).join("")}</ol>
        <textarea class="cvx-in cvx-bulk" rows="7" placeholder="${esc(texts.map((t) => (t.text || "").split(/\s+/)[0] || "Text").join(", "))}"></textarea>
        <button class="cv-btn cvx-bulk-go" style="margin-top:8px">Generate designs</button>`;
      const parse = (line) => { const out = []; let cur = "", q = false; for (const ch of line) { if (ch === '"') q = !q; else if (ch === "," && !q) { out.push(cur.trim()); cur = ""; } else cur += ch; } out.push(cur.trim()); return out; };
      P.querySelector(".cvx-bulk-go").onclick = () => {
        const rows = P.querySelector(".cvx-bulk").value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
        if (!rows.length) { toast("Paste at least one row of data."); return; }
        saveDesign(); const st = store(), idxs = design.els.map((e, i) => (e.t === "text" ? i : -1)).filter((i) => i >= 0).slice(0, 5);
        rows.forEach((row, r) => {
          const f = parse(row), copy = JSON.parse(JSON.stringify({ type: design.type, bg: design.bg, els: design.els, name: design.name }));
          idxs.forEach((ei, k) => { if (f[k] != null && f[k] !== "") copy.els[ei].text = f[k]; });
          copy.name = `${design.name || "Design"} – ${f[0] || "row " + (r + 1)}`; st.designs.push(copy);
        });
        State.save(); toast(`Created ${rows.length} design${rows.length > 1 ? "s" : ""} — find them under Projects or on the Canva home screen.`);
      };
    }

    // =================== translate ===================
    function translatePanel(P) {
      const LANGS = ["Spanish", "French", "German", "Italian", "Portuguese", "Japanese", "Korean", "Chinese (Simplified)", "Arabic", "Hindi", "Swedish", "Dutch"];
      P.innerHTML = `<div class="cv-panel-h">Translate</div><div class="cv-empty" style="padding:0 0 8px">Translate every text box on this page with Canva AI.</div>
        <select class="cv-select cvx-lang">${LANGS.map((l) => `<option>${l}</option>`).join("")}</select>
        <button class="cv-btn cvx-tr-go" style="margin-top:8px">Translate page</button>`;
      P.querySelector(".cvx-tr-go").onclick = async () => {
        const items = design.els.filter((e) => e.t === "text" && (e.text || "").trim());
        if (!items.length) { toast("There's no text on this page to translate."); return; }
        const lang = P.querySelector(".cvx-lang").value, btn = P.querySelector(".cvx-tr-go"); btn.disabled = true; btn.textContent = "Translating…";
        try {
          const out = await window.AIText.generate(`Translate each string in this JSON array into ${lang}. Keep emoji, numbers and line breaks. Reply with ONLY a JSON array of the same length.\n${JSON.stringify(items.map((e) => e.text))}`, { temperature: 0.2, max: 900, system: "You are a professional translator. Output only valid JSON." });
          const arr = JSON.parse((out.match(/\[[\s\S]*\]/) || [out])[0]);
          if (!Array.isArray(arr) || arr.length !== items.length) throw new Error("unexpected reply");
          items.forEach((e, i) => { e.text = String(arr[i]); }); render(); selectEl(null); record(); toast(`Translated ${items.length} text box${items.length > 1 ? "es" : ""} into ${lang}.`);
        } catch (e) { toast("Translation failed (" + e.message + "). Check your connection and try again."); }
        btn.disabled = false; btn.textContent = "Translate page";
      };
    }

    body.querySelector(".cv-dl").onclick = doDownload;
    body.querySelector(".cv-share-btn").onclick = () => openShare();

    function openShare() {
      saveDesign();
      if (!design.share) design.share = {};
      const SH = design.share;
      if (!SH.id) SH.id = Math.random().toString(36).slice(2, 10);
      if (!SH.people) SH.people = []; if (!SH.access) SH.access = "private";
      if (!SH.settings) SH.settings = { comments: true, download: true, visitors: true };
      const slug = () => SH.slug || ((design.name || "untitled").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + SH.id);
      const link = () => `https://www.canva.com/design/${slug()}/${SH.access === "edit" ? "edit" : "view"}`;
      const ACC = { private: ["🔒", "Only you can access"], view: ["🌐", "Anyone with the link can view"], edit: ["✏️", "Anyone with the link can edit"] };
      const items = [
        { k: "download", label: "Download", emoji: "⬇️" }, { k: "brand", label: "Brand Template", emoji: "🗂️" },
        { k: "present", label: "Present", emoji: "▶️", c: "#e8562a" }, { k: "public", label: "Public view link", emoji: "🔗" },
        { k: "record", label: "Present and record", emoji: "🎥" }, { k: "website", label: "Website", emoji: "🌐", c: "#5b3df5" },
        { k: "ppt", label: "Microsoft PowerPoint", emoji: "📊", c: "#c43e1c" }, { k: "all", label: "See all", emoji: "•••" },
      ];
      const ov = el(`<div class="cv-imgpick cv-share-ov">
        <div class="cv-share">
          <div class="cv-share-toprow"><h3>Share design</h3><span class="cv-share-vis"></span><button class="cv-share-gear" title="Settings">⚙</button></div>
          <div class="cv-share-h">People with access</div>
          <div class="cv-up-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg><input class="cvx-add-in" placeholder="Add people by email" type="email"></div>
          <div class="cv-share-ppl cvx-ppl"></div>
          <div class="cv-share-h">Access level</div>
          <button class="cv-share-access"><span class="cv-share-lock"></span><span class="cvx-acc-t"></span><span class="cv-share-caret">⌄</span></button>
          <button class="cv-share-copy">🔗 Copy link</button>
          <div class="cv-share-perso">Personalize your link <img src="assets/cv_pro.png?v=1" class="cv-share-crown" alt="Pro"></div>
          <div class="cv-share-sep"></div>
          <div class="cv-share-grid">${items.map((i) => `<button class="cv-share-opt" data-k="${i.k}"><span class="cv-share-opt-ic" style="${i.c ? `background:${i.c};color:#fff` : ""}">${i.emoji}</span><span class="cv-share-opt-l">${esc(i.label)}</span></button>`).join("")}</div>
        </div>
      </div>`);
      const close = () => ov.remove();
      const persist = () => { saveDesign(); flashSaved(); };
      const paint = () => {
        const a = ACC[SH.access];
        ov.querySelector(".cv-share-lock").textContent = a[0]; ov.querySelector(".cvx-acc-t").textContent = a[1];
        ov.querySelector(".cv-share-vis").textContent = SH.settings.visitors ? `👥 ${SH.people.length + 1} with access` : "";
        const ppl = ov.querySelector(".cvx-ppl"); ppl.innerHTML = "";
        ppl.appendChild(el(`<span class="cv-share-av" title="${esc(profileName())} (owner)">${esc((profileName()[0] || "Y").toUpperCase())}</span>`));
        SH.people.forEach((pp, i) => { const av = el(`<span class="cvx-av" title="${esc(pp.email)} · can ${pp.role} — click to remove">${esc(pp.email[0].toUpperCase())}</span>`); av.onclick = () => { if (confirm(`Remove ${pp.email}?`)) { SH.people.splice(i, 1); persist(); paint(); } }; ppl.appendChild(av); });
        const plus = el(`<button class="cv-share-addp" title="Add">＋</button>`); plus.onclick = addPerson; ppl.appendChild(plus);
      };
      const addPerson = () => {
        const inp = ov.querySelector(".cvx-add-in"), e = (inp.value || "").trim();
        if (!e) { inp.focus(); return; }
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { toast("Enter a valid email address."); return; }
        if (SH.people.some((pp) => pp.email.toLowerCase() === e.toLowerCase())) { toast(e + " already has access."); return; }
        SH.people.push({ email: e, role: SH.access === "edit" ? "edit" : "view" }); inp.value = ""; persist(); paint();
        toast(`Invited ${e} — they can ${SH.access === "edit" ? "edit" : "view"} this design.`);
      };
      ov.querySelector(".cvx-add-in").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); addPerson(); } });
      ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
      const copy = (txt, msg) => { const done = () => toast(msg); if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done).catch(done); else done(); };
      ov.querySelector(".cv-share-copy").onclick = () => copy(link(), SH.access === "private" ? "Link copied — only people you add can open it." : "Link copied to clipboard.");
      ov.querySelector(".cv-share-access").onclick = () => { SH.access = { private: "view", view: "edit", edit: "private" }[SH.access]; persist(); paint(); toast(ACC[SH.access][1] + "."); };
      ov.querySelector(".cv-share-gear").onclick = () => {
        const m = el(`<div class="cvx-modal"><div class="cvx-box"><h3>Share settings</h3>
          ${[["comments", "Allow comments", "People with access can leave comments."], ["download", "Allow downloads", "Viewers can download this design."], ["visitors", "Show access count", "Show how many people have access."]].map(([k, l, d]) => `<div class="cvx-row"><div class="grow"><b>${l}</b><small>${d}</small></div><label class="cvx-switch"><input type="checkbox" data-k="${k}" ${SH.settings[k] ? "checked" : ""}><i></i></label></div>`).join("")}
          <div class="cvx-actions"><button class="cv-btn">Done</button></div></div></div>`);
        m.querySelectorAll("input[data-k]").forEach((i) => i.onchange = () => { SH.settings[i.dataset.k] = i.checked; persist(); paint(); });
        m.querySelector(".cv-btn").onclick = () => m.remove(); ov.appendChild(m);
      };
      ov.querySelector(".cv-share-perso").onclick = () => requirePremium(() => {
        const v = prompt("Custom link name (letters, numbers, dashes):", SH.slug || ""); if (v == null) return;
        const clean = v.toLowerCase().trim().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
        if (clean.length < 3) { toast("Use at least 3 letters or numbers."); return; }
        SH.slug = clean; persist(); copy(link(), "Personalized link created and copied.");
      });
      const doOpt = (k) => {
        if (k === "download") { close(); doDownload(); }
        else if (k === "brand") {
          syncPage(); const st = store(); if (!st.templates) st.templates = [];
          st.templates.unshift({ name: design.name || "Brand template", type: design.type, bg: design.bg, els: JSON.parse(JSON.stringify(design.els)), pages: design.pages ? JSON.parse(JSON.stringify(design.pages)) : undefined });
          State.save(); toast("Saved as a Brand Template — it's at the top of “Templates for you” on the home screen.");
        }
        else if (k === "present") { close(); presentMode(); }
        else if (k === "public") { if (SH.access === "private") SH.access = "view"; persist(); paint(); copy(link(), "Public view link copied — anyone with it can view."); }
        else if (k === "record") { close(); presentMode({ record: true }); }
        else if (k === "website") { close(); exportWebsite(); }
        else if (k === "ppt") { close(); exportPowerPoint(); }
        else if (k === "all") seeAll();
      };
      const seeAll = () => {
        const OPTS = [["png", "⬇️", "PNG", "Best for images (each page)"], ["jpg", "🖼", "JPG", "Smaller image files"], ["pdf", "📄", "PDF", "Every page in one document"], ["website", "🌐", "Website", "A single .html page you can host anywhere"], ["ppt", "📊", "PowerPoint", "Opens in PowerPoint, saved to Documents"], ["json", "💾", "Canva project", "A .json backup you can keep"], ["present", "▶️", "Present", "Full screen, with notes and music"], ["record", "🎥", "Present and record", "Slides + your camera → video file"]];
        const m = el(`<div class="cvx-modal"><div class="cvx-box"><h3>All share & download options</h3>${OPTS.map(([k, e, t, d]) => `<button class="cvx-row" data-o="${k}" style="border:0;background:none;text-align:left;cursor:pointer;width:100%"><span style="font-size:20px">${e}</span><div class="grow"><b>${t}</b><small>${d}</small></div><span>›</span></button>`).join("")}<div class="cvx-actions"><button class="cv-link">Close</button></div></div></div>`);
        m.querySelector(".cv-link").onclick = () => m.remove();
        m.querySelectorAll("[data-o]").forEach((b) => b.onclick = () => {
          const k = b.dataset.o; m.remove();
          if (k === "png") { close(); doDownload(); } else if (k === "jpg") { close(); exportJPG(); } else if (k === "pdf") { close(); exportPDF(); }
          else if (k === "json") { syncPage(); downloadBlob(new Blob([JSON.stringify(design, null, 2)], { type: "application/json" }), safeName(design.name) + ".canva.json"); toast("Project file downloaded."); }
          else doOpt(k);
        });
        ov.appendChild(m);
      };
      ov.querySelectorAll(".cv-share-opt").forEach((b) => b.onclick = () => doOpt(b.dataset.k));
      paint();
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
      if (Array.isArray(design.pages) && design.pages.length) syncPage();
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
