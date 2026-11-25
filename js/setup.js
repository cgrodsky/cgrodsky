/* Out-of-box experience — rebuilt to match the "Windows 12.1" reference setup video
   frame-for-frame.

   STAGE 1 — INSTALLER (on the wavy blue→magenta wallpaper):
     splash → language → "Windows Setup" dialog cards:
       Activate Windows (product key) → Choose your edition → License Terms →
       Installation Types → Select a partition → Installing Windows (animated
       checklist) → reboot → "Getting ready" flag screens.
   STAGE 2 — OOBE ("Windows 12.1 Pro", glassy panel, 3D illustrations):
     Just a moment → name device → country/region → keyboard → second keyboard →
     how to set up → personalize (theme/accent) → personalize (wallpaper) →
     sign in to Microsoft → set up PIN → fingerprint → Alright → welcome back →
     restoring → privacy → customize experience → OneDrive → Office 365 → Thank you.
   Reuses State product-key / account / PIN / TouchID / FilesParts logic. */
(function () {
  "use strict";

  const screen = () => document.getElementById("screen");
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }

  let bg, onComplete;
  const S = () => State.data;

  // Full list of countries/regions for the OOBE picker.
  const ALL_COUNTRIES = ["Afghanistan","Albania","Algeria","Andorra","Angola","Antigua and Barbuda","Argentina","Armenia","Australia","Austria","Azerbaijan","Bahamas","Bahrain","Bangladesh","Barbados","Belarus","Belgium","Belize","Benin","Bhutan","Bolivia","Bosnia and Herzegovina","Botswana","Brazil","Brunei","Bulgaria","Burkina Faso","Burundi","Cabo Verde","Cambodia","Cameroon","Canada","Central African Republic","Chad","Chile","China","Colombia","Comoros","Congo (Brazzaville)","Congo (Kinshasa)","Costa Rica","Côte d'Ivoire","Croatia","Cuba","Cyprus","Czechia","Denmark","Djibouti","Dominica","Dominican Republic","Ecuador","Egypt","El Salvador","Equatorial Guinea","Eritrea","Estonia","Eswatini","Ethiopia","Fiji","Finland","France","Gabon","Gambia","Georgia","Germany","Ghana","Greece","Grenada","Guatemala","Guinea","Guinea-Bissau","Guyana","Haiti","Honduras","Hong Kong","Hungary","Iceland","India","Indonesia","Iran","Iraq","Ireland","Israel","Italy","Jamaica","Japan","Jordan","Kazakhstan","Kenya","Kiribati","Kosovo","Kuwait","Kyrgyzstan","Laos","Latvia","Lebanon","Lesotho","Liberia","Libya","Liechtenstein","Lithuania","Luxembourg","Macau","Madagascar","Malawi","Malaysia","Maldives","Mali","Malta","Marshall Islands","Mauritania","Mauritius","Mexico","Micronesia","Moldova","Monaco","Mongolia","Montenegro","Morocco","Mozambique","Myanmar","Namibia","Nauru","Nepal","Netherlands","New Zealand","Nicaragua","Niger","Nigeria","North Korea","North Macedonia","Norway","Oman","Pakistan","Palau","Palestine","Panama","Papua New Guinea","Paraguay","Peru","Philippines","Poland","Portugal","Qatar","Romania","Russia","Rwanda","Saint Kitts and Nevis","Saint Lucia","Saint Vincent and the Grenadines","Samoa","San Marino","Sao Tome and Principe","Saudi Arabia","Senegal","Serbia","Seychelles","Sierra Leone","Singapore","Slovakia","Slovenia","Solomon Islands","Somalia","South Africa","South Korea","South Sudan","Spain","Sri Lanka","Sudan","Suriname","Sweden","Switzerland","Syria","Taiwan","Tajikistan","Tanzania","Thailand","Timor-Leste","Togo","Tonga","Trinidad and Tobago","Tunisia","Turkey","Turkmenistan","Tuvalu","Uganda","Ukraine","United Arab Emirates","United Kingdom","United States","Uruguay","Uzbekistan","Vanuatu","Vatican City","Venezuela","Vietnam","Yemen","Zambia","Zimbabwe"];

  // Keyboard / input layouts, including Swedish.
  const ALL_KEYBOARDS = ["US","United States-International","United Kingdom","Canadian","Canadian French","Spanish","Spanish (Latin America)","French","French (Canada)","German","German (Switzerland)","Italian","Portuguese","Portuguese (Brazil)","Dutch","Swedish","Norwegian","Danish","Finnish","Icelandic","Polish","Czech","Hungarian","Romanian","Greek","Russian","Ukrainian","Turkish","Arabic","Hebrew","Hindi","Japanese","Korean","Chinese (Simplified)","Chinese (Traditional)","Thai","Vietnamese","Dvorak","Colemak"];

  function mount() {
    bg = el(`<div class="setup-bg iwave-bg"></div>`);
    screen().appendChild(bg);
  }

  // ============================================================
  //  Logos
  // ============================================================
  // White 4-pane flag (installer / OOBE brand).
  const FLAG_WHITE = (s) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" class="iflag"><rect x="2" y="2" width="9" height="9" rx="1.4" fill="#fff"/><rect x="13" y="2" width="9" height="9" rx="1.4" fill="#fff"/><rect x="2" y="13" width="9" height="9" rx="1.4" fill="#fff"/><rect x="13" y="13" width="9" height="9" rx="1.4" fill="#fff"/></svg>`;
  // Gradient 4-pane flag (boot tiles).
  const FLAG_GRAD = (s) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}"><defs><linearGradient id="fg${s}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5ec8ff"/><stop offset=".5" stop-color="#8b5cff"/><stop offset="1" stop-color="#ff4fa3"/></linearGradient></defs><rect x="2" y="2" width="9" height="9" rx="1.4" fill="url(#fg${s})"/><rect x="13" y="2" width="9" height="9" rx="1.4" fill="url(#fg${s})"/><rect x="2" y="13" width="9" height="9" rx="1.4" fill="url(#fg${s})"/><rect x="13" y="13" width="9" height="9" rx="1.4" fill="url(#fg${s})"/></svg>`;
  const BRAND_PILL = (s) => `<span class="iwin-brand">${FLAG_WHITE(s || 26)}<span class="iwin-txt">Windows <span class="iwin-ver">12.1</span></span></span>`;
  // Small colourful "Set Up Windows" glyph used in the dialog/OOBE breadcrumb.
  const SETUP_IC = (s) => `<svg viewBox="0 0 24 24" width="${s || 18}" height="${s || 18}" style="vertical-align:middle"><rect x="2" y="2" width="9" height="9" rx="2" fill="#ff4fa3"/><rect x="13" y="2" width="9" height="9" rx="2" fill="#8b5cff"/><rect x="2" y="13" width="9" height="9" rx="2" fill="#3b82e8"/><rect x="13" y="13" width="9" height="9" rx="2" fill="#19c3b2"/></svg>`;

  // ============================================================
  //  3D-style illustrations (approximating the video's Fluent icons)
  // ============================================================
  const IC = {};
  // Glowing key orb + gold pointing finger (Activate Windows).
  IC.activate = `<svg class="il-svg" viewBox="0 0 220 200"><defs><radialGradient id="aGlow" cx="50%" cy="45%" r="55%"><stop offset="0" stop-color="#3ad1ff"/><stop offset=".6" stop-color="#2b7bff"/><stop offset="1" stop-color="#1b2b8f" stop-opacity="0"/></radialGradient><linearGradient id="aKey" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6ff0a6"/><stop offset="1" stop-color="#17b56b"/></linearGradient></defs><circle cx="96" cy="86" r="74" fill="url(#aGlow)"/><circle cx="96" cy="86" r="30" fill="url(#aKey)"/><circle cx="96" cy="80" r="9" fill="#0b3a24"/><rect x="92" y="86" width="8" height="24" rx="3" fill="#0b3a24"/><rect x="100" y="100" width="10" height="5" rx="2" fill="#0b3a24"/><g transform="translate(70 96)"><path d="M18 70 V40 a9 9 0 0 1 18 0 v8 l20 3 a10 10 0 0 1 8 10 v18 a12 12 0 0 1-12 12 H34 a16 16 0 0 1-14-8 L8 72 a7 7 0 0 1 10-9 z" fill="#ffcf6b" stroke="#e0a63c" stroke-width="2"/><path d="M36 48 v-8 a9 9 0 0 0-18 0 V70" fill="#ffd98a"/></g></svg>`;
  // Windows flag + open cardboard box (Choose your edition).
  IC.edition = `<svg class="il-svg" viewBox="0 0 200 200"><defs><linearGradient id="eF" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7fd0ff"/><stop offset=".5" stop-color="#8b5cff"/><stop offset="1" stop-color="#ff5fb0"/></linearGradient></defs><rect x="40" y="26" width="64" height="64" rx="8" fill="#0d0b1e"/><rect x="48" y="34" width="22" height="22" rx="3" fill="url(#eF)"/><rect x="74" y="34" width="22" height="22" rx="3" fill="url(#eF)"/><rect x="48" y="60" width="22" height="22" rx="3" fill="url(#eF)"/><rect x="74" y="60" width="22" height="22" rx="3" fill="url(#eF)"/><g><path d="M62 108 L104 94 L150 110 L150 158 L104 176 L62 160 Z" fill="#d79a5a"/><path d="M104 130 L150 110 L150 158 L104 176 Z" fill="#b97c3e"/><path d="M62 108 L104 130 L104 176 L62 160 Z" fill="#e8b579"/><path d="M62 108 L82 84 L124 96 L104 94 Z" fill="#f0c88c"/><path d="M150 110 L132 86 L82 84 L104 94 Z" fill="#c98f4f"/></g></svg>`;
  // Flag tile + certificate with seal (License Terms).
  IC.license = `<svg class="il-svg" viewBox="0 0 200 200"><defs><linearGradient id="lF" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7fd0ff"/><stop offset=".5" stop-color="#8b5cff"/><stop offset="1" stop-color="#ff5fb0"/></linearGradient></defs><rect x="34" y="40" width="58" height="58" rx="10" fill="#0d0b1e"/><rect x="42" y="48" width="18" height="18" rx="2.5" fill="url(#lF)"/><rect x="66" y="48" width="18" height="18" rx="2.5" fill="url(#lF)"/><rect x="42" y="72" width="18" height="18" rx="2.5" fill="url(#lF)"/><rect x="66" y="72" width="18" height="18" rx="2.5" fill="url(#lF)"/><g transform="translate(86 86)"><rect x="0" y="0" width="86" height="74" rx="8" fill="#bfe8ff"/><rect x="0" y="0" width="86" height="20" rx="8" fill="#5ec0ff"/><path d="M12 36 H74 M12 48 H74 M12 60 H56" stroke="#5a90c0" stroke-width="4" stroke-linecap="round"/><circle cx="66" cy="70" r="15" fill="#f2b23a" stroke="#fff" stroke-width="3"/><path d="M60 82 l-5 16 8 -5 8 5 -5 -16" fill="#e23a63"/></g></svg>`;
  // Gold handbag/lock (Installation Types).
  IC.types = `<svg class="il-svg" viewBox="0 0 200 200"><defs><linearGradient id="tB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd87a"/><stop offset="1" stop-color="#f0a93b"/></linearGradient></defs><path d="M62 72 a38 38 0 0 1 76 0" fill="none" stroke="#e0a63c" stroke-width="12"/><rect x="40" y="68" width="120" height="96" rx="18" fill="url(#tB)"/><rect x="40" y="68" width="120" height="96" rx="18" fill="#fff" fill-opacity=".06"/><rect x="86" y="104" width="28" height="22" rx="5" fill="#8a5a12"/></svg>`;
  // Monitor + hard drive (Select a partition).
  IC.partition = `<svg class="il-svg" viewBox="0 0 200 200"><defs><linearGradient id="pM" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6fe0ff"/><stop offset="1" stop-color="#2f8bff"/></linearGradient></defs><rect x="46" y="34" width="118" height="80" rx="9" fill="#1a2740"/><rect x="54" y="42" width="102" height="64" rx="4" fill="url(#pM)"/><rect x="92" y="114" width="26" height="14" fill="#223354"/><rect x="72" y="128" width="66" height="9" rx="4.5" fill="#223354"/><rect x="40" y="140" width="120" height="34" rx="9" fill="#cfd8e8"/><rect x="40" y="140" width="120" height="34" rx="9" fill="#8595b0" fill-opacity=".4"/><circle cx="140" cy="157" r="7" fill="#45d07a"/><rect x="56" y="153" width="40" height="8" rx="4" fill="#6b7a95"/></svg>`;
  // File cluster (Installing — copying/extracting).
  IC.files = `<svg class="il-svg" viewBox="0 0 200 200"><defs><linearGradient id="fD" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8fd3ff"/><stop offset="1" stop-color="#3b8bff"/></linearGradient></defs><g transform="translate(44 66) rotate(-8)"><rect x="0" y="0" width="58" height="74" rx="7" fill="url(#fD)"/><path d="M12 16 H46 M12 28 H46 M12 40 H34" stroke="#fff" stroke-width="4" stroke-linecap="round"/></g><g transform="translate(96 44) rotate(6)"><rect x="0" y="0" width="58" height="74" rx="7" fill="url(#fD)"/><path d="M20 24 l-9 13 9 13 M38 24 l9 13 -9 13" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g><g transform="translate(82 108) rotate(-4)"><rect x="0" y="0" width="54" height="60" rx="7" fill="url(#fD)"/><circle cx="18" cy="20" r="6" fill="#fff"/><path d="M8 48 L24 30 L34 40 L42 34 L48 48 Z" fill="#fff"/></g></svg>`;
  // App cluster (Installing — features).
  IC.apps = `<svg class="il-svg" viewBox="0 0 200 200"><defs><linearGradient id="aEdge" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#35c1f1"/><stop offset="1" stop-color="#1f7 fd" stop-color="#1f77fd"/></linearGradient></defs><circle cx="70" cy="70" r="30" fill="#2f8bff"/><path d="M48 76 a24 24 0 0 1 44 -10 a20 20 0 0 0 -34 22 a24 24 0 0 1 -10 -12 z" fill="#8fe9c8"/><rect x="104" y="40" width="54" height="54" rx="10" fill="#f0a93b"/><rect x="112" y="48" width="38" height="38" rx="5" fill="#fff"/><rect x="118" y="54" width="12" height="12" fill="#f25022"/><rect x="132" y="54" width="12" height="12" fill="#7fba00"/><rect x="118" y="68" width="12" height="12" fill="#00a4ef"/><rect x="132" y="68" width="12" height="12" fill="#ffb900"/><circle cx="130" cy="138" r="26" fill="#107c10"/><path d="M122 128 l20 10 -20 10 z" fill="#fff"/><g transform="translate(44 108)"><rect x="0" y="0" width="52" height="40" rx="7" fill="#7c3aed"/><path d="M10 20 a16 16 0 0 1 32 0" fill="none" stroke="#fff" stroke-width="4"/><circle cx="26" cy="22" r="5" fill="#fff"/></g></svg>`;
  // Disc + flag + check (Installing — finishing).
  IC.disc = `<svg class="il-svg" viewBox="0 0 200 200"><defs><radialGradient id="dG" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#bfe8ff"/><stop offset=".55" stop-color="#3b8bff"/><stop offset="1" stop-color="#1b3a9f"/></radialGradient><linearGradient id="dF" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7fd0ff"/><stop offset=".5" stop-color="#8b5cff"/><stop offset="1" stop-color="#ff5fb0"/></linearGradient></defs><circle cx="78" cy="104" r="56" fill="url(#dG)"/><circle cx="78" cy="104" r="16" fill="#0d0b1e"/><circle cx="78" cy="104" r="6" fill="#4aa8ff"/><rect x="104" y="40" width="58" height="58" rx="9" fill="#0d0b1e"/><rect x="111" y="47" width="19" height="19" rx="2.5" fill="url(#dF)"/><rect x="134" y="47" width="19" height="19" rx="2.5" fill="url(#dF)"/><rect x="111" y="70" width="19" height="19" rx="2.5" fill="url(#dF)"/><rect x="134" y="70" width="19" height="19" rx="2.5" fill="url(#dF)"/><circle cx="140" cy="140" r="26" fill="#1fc06a"/><path d="M128 140 l8 9 16 -18" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  // 3D globe + paper plane (country/region).
  IC.globe = `<svg class="il-svg" viewBox="0 0 200 200"><defs><linearGradient id="gO" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5ec8ff"/><stop offset="1" stop-color="#2f6bff"/></linearGradient></defs><circle cx="86" cy="104" r="62" fill="url(#gO)"/><g fill="#8fd6a0" stroke="none"><path d="M60 66 q18 -8 30 2 q-6 16 -22 18 q-14 -2 -8 -20z"/><path d="M96 118 q22 -6 34 8 q-10 20 -30 18 q-16 -10 -4 -26z"/><path d="M52 118 q14 2 16 16 q-12 10 -22 -2 q-4 -12 6 -14z"/></g><g fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="2"><ellipse cx="86" cy="104" rx="26" ry="62"/><line x1="24" y1="104" x2="148" y2="104"/><path d="M34 72 H138 M34 136 H138"/></g><path d="M118 42 L176 60 L132 78 L128 66 Z" fill="#fff"/><path d="M128 66 L176 60 L132 78 Z" fill="#dce9ff"/></svg>`;
  // 3D keyboard + numpad.
  IC.keyboard = `<svg class="il-svg" viewBox="0 0 200 200"><defs><linearGradient id="kB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef3fb"/><stop offset="1" stop-color="#c3cde0"/></linearGradient></defs><rect x="26" y="70" width="118" height="58" rx="8" fill="url(#kB)"/><g fill="#8390ab">${(() => { let r = ""; for (let y = 0; y < 3; y++) for (let x = 0; x < 8; x++) r += `<rect x="${34 + x * 13}" y="${78 + y * 15}" width="9" height="9" rx="2"/>`; return r; })()}</g><rect x="56" y="123" width="58" height="8" rx="3" fill="#8390ab"/><g transform="translate(120 104) rotate(-6)"><rect x="0" y="0" width="56" height="60" rx="8" fill="#1f2636"/><g fill="#3b4760">${(() => { let r = ""; for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) r += `<rect x="${8 + x * 14}" y="${8 + y * 14}" width="10" height="10" rx="2"/>`; return r; })()}</g></g></svg>`;
  // Chat bubbles + photo + video + doc (how to set up).
  IC.chat = `<svg class="il-svg" viewBox="0 0 200 200"><defs><linearGradient id="cB" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4ec5ff"/><stop offset="1" stop-color="#2f8bff"/></linearGradient></defs><rect x="30" y="34" width="44" height="34" rx="5" fill="#fff" stroke="#cdd8ec" stroke-width="2"/><circle cx="44" cy="48" r="5" fill="#f0a93b"/><path d="M34 64 L48 52 L58 60 L66 54 L70 64 Z" fill="#8fd3a0"/><path d="M40 86 a40 40 0 0 1 78 0 a40 40 0 0 1 -40 40 l-20 14 4 -20 a40 40 0 0 1 -22 -34z" fill="url(#cB)"/><path d="M58 96 H100 M58 110 H88" stroke="#fff" stroke-width="5" stroke-linecap="round"/><g transform="translate(118 96)"><rect x="0" y="0" width="52" height="38" rx="6" fill="#1f2636"/><path d="M14 19 l18 -11 v22 z" fill="#fff"/></g><rect x="112" y="46" width="34" height="42" rx="5" fill="#fff" stroke="#cdd8ec" stroke-width="2"/><path d="M120 60 H140 M120 70 H140 M120 80 H132" stroke="#9fb0cc" stroke-width="3" stroke-linecap="round"/></svg>`;
  // Monitor + paintbrush + colour wheel (personalize).
  IC.personalize = `<svg class="il-svg" viewBox="0 0 200 200"><defs><linearGradient id="pS" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6fe0ff"/><stop offset="1" stop-color="#2f8bff"/></linearGradient></defs><rect x="52" y="44" width="110" height="74" rx="8" fill="#1a2740"/><rect x="60" y="52" width="94" height="58" rx="4" fill="url(#pS)"/><rect x="96" y="118" width="22" height="12" fill="#223354"/><rect x="78" y="130" width="58" height="9" rx="4.5" fill="#223354"/><g transform="translate(96 60) rotate(40)"><rect x="0" y="0" width="12" height="58" rx="6" fill="#d94a8c"/><rect x="0" y="-16" width="12" height="18" rx="4" fill="#f0a93b"/><path d="M0 58 l6 14 6 -14 z" fill="#ffd87a"/></g><g transform="translate(40 120)"><circle cx="22" cy="22" r="22" fill="#fff"/><path d="M22 22 L22 0 A22 22 0 0 1 41 11 Z" fill="#ff5fb0"/><path d="M22 22 L41 11 A22 22 0 0 1 41 33 Z" fill="#ffd34e"/><path d="M22 22 L41 33 A22 22 0 0 1 22 44 Z" fill="#45d07a"/><path d="M22 22 L22 44 A22 22 0 0 1 3 33 Z" fill="#4aa8ff"/><path d="M22 22 L3 33 A22 22 0 0 1 3 11 Z" fill="#8b5cff"/><path d="M22 22 L3 11 A22 22 0 0 1 22 0 Z" fill="#ff8a4a"/><circle cx="22" cy="22" r="8" fill="#fff"/></g></svg>`;
  // Gold padlock + key + PIN dots (set up PIN).
  IC.pin = `<svg class="il-svg" viewBox="0 0 200 200"><defs><linearGradient id="pL" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd87a"/><stop offset="1" stop-color="#eca12f"/></linearGradient></defs><g transform="translate(96 70)"><rect x="0" y="22" width="64" height="52" rx="9" fill="url(#pL)"/><path d="M10 22 V12 a22 22 0 0 1 44 0 V22" fill="none" stroke="#e0a63c" stroke-width="10"/><circle cx="32" cy="44" r="7" fill="#8a5a12"/><rect x="29" y="48" width="6" height="14" rx="3" fill="#8a5a12"/></g><g transform="translate(40 96)"><circle cx="24" cy="24" r="24" fill="url(#pL)"/><circle cx="24" cy="24" r="9" fill="#8a5a12"/><rect x="44" y="19" width="42" height="10" rx="3" fill="url(#pL)"/><rect x="78" y="19" width="8" height="16" rx="2" fill="url(#pL)"/></g><rect x="110" y="44" width="54" height="22" rx="6" fill="#cfe0ff"/><g fill="#2f6bff"><circle cx="122" cy="55" r="3.5"/><circle cx="134" cy="55" r="3.5"/><circle cx="146" cy="55" r="3.5"/><circle cx="158" cy="55" r="3.5"/></g></svg>`;
  // Cyan fingerprint.
  IC.finger = `<svg class="il-svg il-fp" viewBox="0 0 200 200" fill="none" stroke="#28d0ff" stroke-width="6" stroke-linecap="round"><path d="M44 96 q6 -52 56 -52 q50 0 56 52" stroke-opacity=".45"/><path d="M58 122 q0 -60 42 -60 q42 0 42 60"/><path d="M72 132 q0 -44 28 -44 q28 0 28 44"/><path d="M86 140 q0 -28 14 -28 q14 0 14 28 v8"/><path d="M100 112 v36"/></svg>`;
  // Orange marigold (welcome back).
  IC.flower = `<svg class="il-svg" viewBox="0 0 200 200"><defs><radialGradient id="flG" cx="50%" cy="45%" r="55%"><stop offset="0" stop-color="#ffd15a"/><stop offset="1" stop-color="#ff7a1a"/></radialGradient></defs><g transform="translate(100 100)">${(() => { let r = ""; for (let i = 0; i < 16; i++) { const a = (i / 16) * 360; r += `<ellipse cx="0" cy="-48" rx="13" ry="30" fill="#ff8a1e" transform="rotate(${a})"/>`; } return r; })()}${(() => { let r = ""; for (let i = 0; i < 12; i++) { const a = (i / 12) * 360 + 15; r += `<ellipse cx="0" cy="-32" rx="10" ry="22" fill="#ffb13e" transform="rotate(${a})"/>`; } return r; })()}<circle cx="0" cy="0" r="30" fill="url(#flG)"/><g fill="#d9731a">${(() => { let r = ""; for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; r += `<circle cx="${Math.cos(a) * 16}" cy="${Math.sin(a) * 16}" r="3"/>`; } return r; })()}</g></g></svg>`;
  // OneDrive cloud + media (OneDrive).
  IC.onedrive = `<svg class="il-svg" viewBox="0 0 200 200"><defs><linearGradient id="odC" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4aa8ff"/><stop offset="1" stop-color="#2f6bff"/></linearGradient></defs><g transform="translate(26 118) rotate(-8)"><rect x="0" y="0" width="40" height="30" rx="5" fill="#1f2636"/><path d="M11 15 l16 -9 v18 z" fill="#fff"/></g><rect x="28" y="70" width="40" height="30" rx="5" fill="#fff" stroke="#cdd8ec" stroke-width="2"/><circle cx="40" cy="82" r="5" fill="#f0a93b"/><path d="M30 96 L44 86 L54 94 L62 88 L66 96 Z" fill="#8fd3a0"/><path d="M70 150 a26 26 0 0 1 2 -52 a34 34 0 0 1 64 8 a24 24 0 0 1 -4 44 z" fill="url(#odC)"/><path d="M70 150 a26 26 0 0 1 2 -52 a34 34 0 0 1 40 -16 a30 30 0 0 0 -42 68 z" fill="#8fd0ff" opacity=".55"/></svg>`;
  // Gaming / cards / pen / disc cluster (customize experience).
  IC.customize = `<svg class="il-svg" viewBox="0 0 200 200"><defs><linearGradient id="cuD" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8b5cff"/><stop offset="1" stop-color="#5b3ee0"/></linearGradient></defs><g transform="translate(34 70) rotate(-10)"><path d="M14 16 Q14 2 32 4 H78 Q96 2 96 16 L104 50 Q108 68 86 68 Q74 68 70 58 L68 52 H42 L40 58 Q36 68 24 68 Q2 68 6 50 Z" fill="url(#cuD)"/><rect x="22" y="26" width="7" height="20" rx="2" fill="#fff"/><rect x="15" y="33" width="21" height="7" rx="2" fill="#fff"/><circle cx="78" cy="30" r="5" fill="#fff"/><circle cx="90" cy="40" r="5" fill="#fff"/></g><g transform="translate(96 94) rotate(8)"><rect x="0" y="0" width="54" height="68" rx="8" fill="#fff" stroke="#cdd8ec" stroke-width="2"/><path d="M27 16 C42 34 44 44 32 50 C27 53 27 46 27 46 C27 46 27 53 22 50 C10 44 12 34 27 16Z" fill="#111"/><rect x="24" y="50" width="6" height="10" fill="#111"/></g><g transform="translate(40 128) rotate(42)"><rect x="0" y="0" width="9" height="40" rx="4" fill="#d94a8c"/><rect x="0" y="-12" width="9" height="14" rx="3" fill="#f0a93b"/></g></svg>`;

  // Real 4-colour Microsoft logo (shown briefly during the reboot).
  const MS_LOGO = (s) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}"><rect x="2" y="2" width="9" height="9" rx="1" fill="#f25022"/><rect x="13" y="2" width="9" height="9" rx="1" fill="#7fba00"/><rect x="2" y="13" width="9" height="9" rx="1" fill="#00a4ef"/><rect x="13" y="13" width="9" height="9" rx="1" fill="#ffb900"/></svg>`;

  // Extra per-stage install glyphs that the reference cycles through.
  IC.goldtiles = `<svg class="il-svg" viewBox="0 0 200 200"><defs><linearGradient id="gt" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd87a"/><stop offset="1" stop-color="#f0a93b"/></linearGradient></defs><rect x="52" y="52" width="40" height="40" rx="5" fill="url(#gt)"/><rect x="108" y="52" width="40" height="40" rx="5" fill="url(#gt)"/><rect x="52" y="108" width="40" height="40" rx="5" fill="url(#gt)"/><rect x="108" y="108" width="40" height="40" rx="5" fill="url(#gt)"/></svg>`;
  IC.lock = `<svg class="il-svg" viewBox="0 0 200 200"><defs><linearGradient id="lk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#6fe0ff"/><stop offset="1" stop-color="#2f6bff"/></linearGradient></defs><rect x="62" y="92" width="76" height="62" rx="12" fill="url(#lk)"/><path d="M74 92 V74 a26 26 0 0 1 52 0 V92" fill="none" stroke="url(#lk)" stroke-width="13"/><circle cx="100" cy="118" r="9" fill="#fff"/><rect x="96" y="122" width="8" height="18" rx="4" fill="#fff"/></svg>`;
  IC.account = `<svg class="il-svg" viewBox="0 0 200 200"><defs><linearGradient id="ac" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8b5cff"/><stop offset="1" stop-color="#3b82e8"/></linearGradient></defs><circle cx="80" cy="76" r="26" fill="url(#ac)"/><path d="M38 150 a42 42 0 0 1 84 0 z" fill="url(#ac)"/><circle cx="140" cy="118" r="26" fill="#ff8a1e"/><path d="M128 110 l8 9 16 -18" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  IC.download = `<svg class="il-svg" viewBox="0 0 200 200"><defs><linearGradient id="dl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#45e08a"/><stop offset="1" stop-color="#17a861"/></linearGradient></defs><rect x="50" y="46" width="100" height="108" rx="16" fill="url(#dl)"/><path d="M100 70 V116 M78 98 l22 22 22 -22" stroke="#fff" stroke-width="11" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  IC.gears = `<svg class="il-svg" viewBox="0 0 200 200"><defs><linearGradient id="gr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8b5cff"/><stop offset="1" stop-color="#3b82e8"/></linearGradient></defs><g transform="translate(86 86)" fill="url(#gr)"><circle r="36"/>${(() => { let r = ""; for (let i = 0; i < 8; i++) { const a = i * 45; r += `<rect x="-9" y="-50" width="18" height="18" rx="3" transform="rotate(${a})"/>`; } return r; })()}<circle r="16" fill="#140f3c"/></g><g transform="translate(140 132)" fill="#45d07a"><circle r="22"/>${(() => { let r = ""; for (let i = 0; i < 6; i++) { const a = i * 60; r += `<rect x="-6" y="-31" width="12" height="12" rx="2" transform="rotate(${a})"/>`; } return r; })()}<circle r="9" fill="#140f3c"/></g></svg>`;

  // Office / Microsoft 365 app cluster (Office offer screen).
  IC.office = `<svg class="il-svg" viewBox="0 0 200 200">
    <g transform="translate(96 30)"><rect x="0" y="0" width="52" height="52" rx="9" fill="#c43e1c"/><rect x="8" y="8" width="36" height="36" rx="4" fill="#fff"/><text x="26" y="36" font-size="30" font-weight="700" fill="#c43e1c" text-anchor="middle" font-family="Segoe UI,Arial">P</text></g>
    <g transform="translate(36 70)"><rect x="0" y="0" width="52" height="52" rx="9" fill="#185abd"/><rect x="8" y="8" width="36" height="36" rx="4" fill="#fff"/><text x="26" y="36" font-size="30" font-weight="700" fill="#185abd" text-anchor="middle" font-family="Segoe UI,Arial">W</text></g>
    <g transform="translate(118 86)"><rect x="0" y="0" width="48" height="48" rx="9" fill="#0a7cbb"/><rect x="7" y="7" width="34" height="34" rx="4" fill="#fff"/><path d="M15 24 a9 9 0 0 1 18 0 a9 9 0 0 1 -18 0" fill="none" stroke="#0a7cbb" stroke-width="4"/></g>
    <g transform="translate(90 92)"><rect x="0" y="0" width="46" height="46" rx="8" fill="#7719aa"/><rect x="7" y="7" width="32" height="32" rx="4" fill="#fff"/><text x="23" y="32" font-size="24" font-weight="700" fill="#7719aa" text-anchor="middle" font-family="Segoe UI,Arial">N</text></g>
    <g transform="translate(70 132)"><rect x="0" y="0" width="48" height="48" rx="9" fill="#107c41"/><rect x="7" y="7" width="34" height="34" rx="4" fill="#fff"/><text x="24" y="33" font-size="26" font-weight="700" fill="#107c41" text-anchor="middle" font-family="Segoe UI,Arial">X</text></g>
    <g transform="translate(34 136)"><path d="M12 40 a16 16 0 0 1 2 -32 a22 22 0 0 1 40 6 a15 15 0 0 1 -2 26 z" fill="#2f8bff"/></g>
  </svg>`;

  // ============================================================
  //  STAGE 1 — INSTALLER
  // ============================================================
  function iwave() { bg.className = "setup-bg iwave-bg"; return bg; }

  // Branded "Windows 12.1" splash (frame ~#093 in the reference).
  function installerSplash() {
    iwave();
    bg.innerHTML = `<div class="isplash">${BRAND_PILL(34)}</div>`;
    setTimeout(installerLanguage, 1600);
  }

  // Centered glassy panel used for the language screen.
  function ipanel(inner) {
    iwave();
    bg.innerHTML = `<div class="ipanel"><div class="ipanel-head">${BRAND_PILL(30)}</div>${inner}</div>`;
    wireSkip();
    return bg.querySelector(".ipanel");
  }

  function installerLanguage() {
    const opt = (arr, sel) => arr.map((o) => `<option${o === sel ? " selected" : ""}>${o}</option>`).join("");
    const langs = ["English (United States)", "English (United Kingdom)", "Español (España)", "Français (France)", "Deutsch (Deutschland)", "Svenska (Sverige)", "日本語 (日本)", "Português (Brasil)", "中文 (简体)"];
    const times = ["English (United States)", "English (United Kingdom)", "Español (España)", "Français (France)", "Deutsch (Deutschland)", "Svenska (Sverige)", "日本語 (日本)"];
    const kbs = ["US", "United Kingdom", "Spanish", "French", "German", "Swedish", "Japanese"];
    const p = ipanel(`
      <div class="ipanel-rows">
        <div class="ipanel-row"><label>Language to install:</label><select class="ipanel-sel" id="il-lang">${opt(langs, "English (United States)")}</select></div>
        <div class="ipanel-row"><label>Time &amp; currency format:</label><select class="ipanel-sel" id="il-time">${opt(times, "English (United States)")}</select></div>
        <div class="ipanel-row"><label>Keyboard or input method:</label><select class="ipanel-sel" id="il-kb">${opt(kbs, "US")}</select></div>
      </div>
      <div class="ipanel-hint">Enter your preferences then click &ldquo;Next&rdquo; to continue.</div>
      <div class="ipanel-foot"><span class="ipanel-copy">&copy;Microsoft Corporation. All rights reserved.</span><button class="ibtn" id="il-next">Next</button></div>`);
    p.querySelector("#il-next").onclick = winsetupActivate;
  }

  // ---- "Windows Setup" dialog chrome ----
  // step: 1 = collecting information, 2 = installing windows (bottom progress)
  function winsetup(titleHtml, bodyHtml, opts) {
    opts = opts || {};
    const step = opts.step || 1;
    iwave();
    bg.innerHTML = `
      <div class="wsetup-screen">
        <div class="wsetup-card${opts.wide ? " wide" : ""}">
          <div class="wsetup-top">
            <span class="wsetup-id">${opts.back ? `<button class="wsetup-back">&#8592;</button>` : ""}${SETUP_IC(18)} Windows Setup</span>
            <button class="wsetup-x setup-skip">&#215;</button>
          </div>
          <div class="wsetup-body${opts.illus ? "" : " noillus"}">
            ${opts.illus ? `<div class="wsetup-illus">${opts.illus}</div>` : ""}
            <div class="wsetup-main">
              <h1 class="wsetup-title">${titleHtml}</h1>
              ${bodyHtml}
            </div>
          </div>
        </div>
        <div class="wsetup-steps">
          <div class="wsetup-track"><div class="wsetup-fill" style="width:${step === 2 ? "100%" : "18%"}"></div></div>
          <div class="wsetup-labels">
            <span class="wsetup-step ${step >= 1 ? "on" : ""}"><b>1</b> Collecting information</span>
            <span class="wsetup-step ${step >= 2 ? "on" : ""}"><b>2</b> Installing Windows</span>
          </div>
        </div>
      </div>`;
    wireSkip();
    const back = bg.querySelector(".wsetup-back");
    if (back && opts.back) back.onclick = opts.back;
    return bg.querySelector(".wsetup-main");
  }

  function winsetupActivate() {
    const main = winsetup("Activate Windows", `
      <p class="wsetup-p">If this is the first time you're installing Windows on this PC (or you're installing a different edition), you need to enter a valid Windows product key. Your product key should be in the confirmation email you received after buying a digital copy of Windows or on a label inside the box that Windows came in.</p>
      <p class="wsetup-p">The product key looks like this:<br><span class="wsetup-mono">XXXXX-XXXXX-XXXXX-XXXXX-XXXXX</span></p>
      <p class="wsetup-p">If you doesn't have a valid product key, select <b>I don't have product key</b>, then you must to have a 30-days trial and after trial ends, you must insert a valid product key.</p>
      <div class="wsetup-field"><input type="text" id="key" class="activate-key" placeholder="Enter product key"><div class="wsetup-err" id="err"></div></div>
      <div class="wsetup-foot">
        <button class="wsetup-link" id="priv">Privacy Statement</button>
        <span class="wsetup-foot-r"><button class="wsetup-link" id="nokey">I don't have product key</button><button class="ibtn" id="next">Next</button></span>
      </div>`, { illus: IC.activate, step: 1 });
    const key = main.querySelector("#key"), err = main.querySelector("#err");
    key.addEventListener("input", () => {
      const v = key.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 25);
      key.value = v.replace(/(.{5})/g, "$1-").replace(/-$/, ""); err.textContent = "";
    });
    main.querySelector("#priv").onclick = openTermsBrowser;
    main.querySelector("#nokey").onclick = () => { S().hasProductKey = false; winsetupEdition(); };
    main.querySelector("#next").onclick = () => {
      const res = State.validateKey(key.value);
      if (res === "valid") { State.redeemKey(key.value); winsetupEdition(); }
      else if (res === "redeemed") err.textContent = "That key has already been redeemed.";
      else if (!key.value.trim()) { S().hasProductKey = false; winsetupEdition(); }
      else err.textContent = "That doesn't look like a valid product key.";
    };
    // quick-fill helper
    key.ondblclick = showKeySheet;
  }

  function winsetupEdition() {
    const eds = ["Windows 12.1 Pro", "Windows 12.1 Home", "Windows 12.1 Enterprise", "Windows 12.1 Education", "Windows 12.1 Pro Education", "Windows 12.1 SE"];
    const main = winsetup("Choose your edition", `
      <p class="wsetup-sub">${eds.length} editions are available</p>
      <div class="wsetup-editions" id="eds">${eds.map((e, i) => `<div class="wsetup-ed ${i === 0 ? "sel" : ""}" data-e="${e}">${e}</div>`).join("")}</div>
      <div class="wsetup-foot end"><button class="wsetup-btn" id="next">Next</button></div>`, { illus: IC.edition, step: 1, back: winsetupActivate });
    const list = main.querySelector("#eds");
    let sel = eds[0];
    list.querySelectorAll(".wsetup-ed").forEach((o) => o.onclick = () => { list.querySelectorAll(".wsetup-ed").forEach((x) => x.classList.remove("sel")); o.classList.add("sel"); sel = o.dataset.e; });
    main.querySelector("#next").onclick = () => { S().edition = sel; State.save(); winsetupLicense(); };
  }

  function winsetupLicense() {
    const main = winsetup("License Terms", `
      <div class="wsetup-license">
        <p><b>MICROSOFT SOFTWARE LICENSE TERMS</b></p>
        <p><b>WINDOWS OPERATING SYSTEM</b></p>
        <p>IF YOU LIVE IN (OR IF YOUR PRINCIPAL PLACE OF BUSINESS IS IN) THE UNITED STATES, PLEASE READ THE BINDING ARBITRATION CLAUSE AND CLASS ACTION WAIVER IN SECTION 11. IT AFFECTS HOW DISPUTES ARE RESOLVED.</p>
        <p><b>Thank you for choosing Microsoft!</b></p>
        <p class="wsetup-license-note">This is a simulated operating system made for fun and learning. It is not affiliated with Microsoft. All purchases, accounts and cloud features are simulated.</p>
      </div>
      <label class="wsetup-accept"><input type="checkbox" id="acc" checked> I accept the license terms</label>
      <div class="wsetup-foot end"><button class="ibtn" id="next">Next</button></div>`, { illus: IC.license, step: 1, back: winsetupEdition });
    const acc = main.querySelector("#acc"), next = main.querySelector("#next");
    const sync = () => { next.disabled = !acc.checked; next.classList.toggle("disabled", !acc.checked); };
    acc.onchange = sync; sync();
    next.onclick = () => { if (acc.checked) winsetupTypes(); };
  }

  function winsetupTypes() {
    const main = winsetup("Installation Types", `
      <div class="wsetup-types">
        <button class="wsetup-type" id="t-up"><span class="wsetup-type-ic">${upgradeIc()}</span><span class="wsetup-type-tx"><b>Upgrade: Install Windows and keep files, apps, etc.</b><span>The Files, settings &amp; applications are moved to Windows with this option. This option is only available when a supported version of Windows is already running on the computer</span></span></button>
        <button class="wsetup-type sel" id="t-cu"><span class="wsetup-type-ic">${customIc()}</span><span class="wsetup-type-tx"><b>Custom: Install Windows only (advanced)</b><span>The Files, settings &amp; applications aren't moved to Windows with this option. If you want to make changes to partitions and drives, start the computer using the installation disc. We recommend backing up your files before you continue</span></span></button>
      </div>
      <p class="wsetup-note">NOTE: Upgrade has been disabled</p>
      <p class="wsetup-note">- To upgrade, start the installation from Windows.</p>`, { illus: IC.types, step: 1, back: winsetupLicense });
    const up = main.querySelector("#t-up"), cu = main.querySelector("#t-cu");
    up.onclick = () => {}; // disabled per the note
    cu.onclick = () => { winsetupPartition(); };
  }

  function winsetupPartition() {
    const main = winsetup("Select a partition to Install", `
      <div class="wsetup-parts">
        <div class="wsetup-parts-head"><span>Name</span><span>Total size</span><span>Free space</span><span>Type</span></div>
        <div class="wsetup-part sel"><span>🖴 Drive 0 Unallocated Space</span><span>500 GB</span><span>500 GB</span><span></span></div>
      </div>
      <div class="wsetup-parttools">
        <span class="wsetup-pt">&#10753; New</span><span class="wsetup-pt">&#10060; Delete</span><span class="wsetup-pt">&#9633; Format</span><span class="wsetup-pt wsetup-pt-r">&#8635;</span>
        <span class="wsetup-pt">&#9679; Load Driver</span><span class="wsetup-pt">&#8596; Extend</span>
      </div>
      <div class="wsetup-foot end"><button class="wsetup-btn" id="next">Next</button></div>`, { illus: IC.partition, step: 1, back: winsetupTypes });
    main.querySelector("#next").onclick = winsetupInstalling;
  }

  function upgradeIc() { return `<svg viewBox="0 0 48 48" width="40" height="40"><rect x="7" y="8" width="34" height="24" rx="3" fill="#2f8bff"/><rect x="11" y="12" width="26" height="16" rx="2" fill="#dbeeff"/><rect x="18" y="32" width="12" height="5" fill="#2f8bff"/><rect x="13" y="37" width="22" height="4" rx="2" fill="#2f8bff"/><path d="M24 24 V14 M19 19 l5 -5 5 5" stroke="#2f8bff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`; }
  function customIc() { return `<svg viewBox="0 0 48 48" width="40" height="40"><defs><linearGradient id="ciF" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7fd0ff"/><stop offset=".5" stop-color="#8b5cff"/><stop offset="1" stop-color="#ff5fb0"/></linearGradient></defs><rect x="6" y="9" width="22" height="22" rx="3" fill="#0d0b1e"/><rect x="9" y="12" width="7.5" height="7.5" rx="1" fill="url(#ciF)"/><rect x="18" y="12" width="7.5" height="7.5" rx="1" fill="url(#ciF)"/><rect x="9" y="21" width="7.5" height="7.5" rx="1" fill="url(#ciF)"/><rect x="18" y="21" width="7.5" height="7.5" rx="1" fill="url(#ciF)"/><rect x="26" y="20" width="16" height="20" rx="2" fill="#2f8bff"/><path d="M30 26 h8 M30 31 h8 M30 36 h5" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>`; }

  // Animated "Installing Windows" — checklist + per-stage left icon.
  function winsetupInstalling() {
    S().installerDone = true; State.save();
    const steps = ["Copying Windows files", "Extracting files", "Installing features", "Installing updates", "Finishing up"];
    const main = winsetup("Installing Windows", `
      <p class="wsetup-p">This is not take a long, just sit relax.</p>
      <ul class="wsetup-check" id="chk">${steps.map((s, i) => `<li data-i="${i}"><span class="wsetup-chk-mark"></span>${s}</li>`).join("")}</ul>
      <div class="wsetup-spin"><div class="spinner-ring sm"></div></div>`, { illus: IC.files, step: 2 });
    const items = [...main.querySelectorAll("#chk li")];
    const illusEl = bg.querySelector(".wsetup-illus");
    let i = 0;
    const mark = () => { items.forEach((li, k) => { li.classList.toggle("done", k < i); li.classList.toggle("cur", k === i); }); };
    mark();
    // The left icon cycles through many glyphs while installing (matches the reference).
    const cycle = [IC.files, IC.goldtiles, IC.lock, IC.account, IC.download, IC.gears, IC.disc, IC.apps];
    let c = 0;
    const cyc = setInterval(() => { c = (c + 1) % cycle.length; if (illusEl) illusEl.innerHTML = cycle[c]; }, 700);
    const iv = setInterval(() => {
      i++;
      if (i >= items.length) {
        clearInterval(iv);
        items.forEach((li) => { li.classList.add("done"); li.classList.remove("cur"); });
        if (illusEl) illusEl.innerHTML = IC.disc;
        setTimeout(() => { clearInterval(cyc); winsetupRestart(); }, 1100);
      } else mark();
    }, 1300);
  }

  // "Restart" card — Windows needs to restart to continue the setup.
  function winsetupRestart() {
    const main = winsetup("Restart", `
      <p class="wsetup-p">Windows needs to restart to continue the setup</p>
      <div class="wsetup-restartbar"><div class="wsetup-restartbar-fill"></div></div>
      <div class="wsetup-foot end"><button class="ibtn" id="rn">Restart now</button></div>`, { step: 2 });
    let gone = false;
    const go = () => { if (gone) return; gone = true; rebootSequence(); };
    main.querySelector("#rn").onclick = go;
    setTimeout(go, 2800);
  }

  // ---- Reboot + "getting ready" flag screens between installer and OOBE ----
  function flagScreen(flagHtml, title, sub, bar, noSpin) {
    bg.className = "setup-bg boot-bg";
    const prog = noSpin ? "" : (bar ? `<div class="boot-bar"><div class="boot-bar-fill"></div></div>` : `<div class="spinner-ring boot-spin"></div>`);
    bg.innerHTML = `<div class="boot-wrap">
      ${title && title.top ? `<div class="boot-top">${title.top}</div>` : ""}
      <div class="boot-flag">${flagHtml}</div>
      ${prog}
      ${title && title.text ? `<div class="boot-msg">${title.text}</div>` : ""}
      ${sub ? `<div class="boot-sub">${sub}</div>` : ""}
    </div>`;
  }
  function waveScreen(title, sub, note) {
    bg.className = "setup-bg iwave-bg boot-wave";
    bg.innerHTML = `<div class="boot-wrap">
      <div class="spinner-ring boot-spin"></div>
      <div class="boot-msg">${title}</div>
      ${sub ? `<div class="boot-sub">${sub}</div>` : ""}
      ${note ? `<div class="boot-note">${note}</div>` : ""}
    </div>`;
  }

  function rebootSequence() {
    // reboot → registry → services → get-ready flag screens (matches the reference).
    const seq = [
      () => flagScreen(MS_LOGO(56), null, null, false, true),         // 4-colour Microsoft logo
      () => flagScreen(FLAG_GRAD(56), null),                          // gradient flag + spinner
      () => flagScreen(FLAG_WHITE(56), { text: "Setup is updating registry settings" }, null, true),
      () => waveScreen("Setup is starting services.", null),
      () => flagScreen(FLAG_GRAD(56), { top: "Windows 12.1" }, null),
      () => flagScreen(FLAG_WHITE(56), { text: "Get ready to running your PC for first use" }),
      () => waveScreen("Checking your performance", null),
    ];
    let k = 0;
    const run = () => { if (k < seq.length) { seq[k](); k++; setTimeout(run, 1500); } else oobeJustAMoment(oobeNameDevice); };
    run();
  }

  // Jump straight to the desktop with sensible defaults (available on every screen).
  function skipSetup() {
    if (!S().profile || !S().profile.username) {
      S().profile = Object.assign({ picture: null, username: "User", authType: "pin", secret: "" }, S().profile || {});
    }
    S().installerDone = true;
    S().setupCompleted = true;
    State.save();
    if (window.Achievements) window.Achievements.unlock("welcome");
    finish();
  }
  function wireSkip() { bg.querySelectorAll(".setup-skip").forEach((x) => x.onclick = skipSetup); }

  // ============================================================
  //  STAGE 2 — OOBE
  // ============================================================
  function oobeChrome() {
    if (bg.querySelector(".oobe2-panel")) return;
    bg.className = "setup-bg iwave-bg oobe2-bg";
    bg.innerHTML = `
      <div class="oobe2-brand">${FLAG_WHITE(22)} Windows <b>12.1</b> Pro</div>
      <div class="oobe2-panel">
        <div class="oobe2-top"><span class="oobe2-id">${SETUP_IC(18)} Set Up Windows</span></div>
        <div class="oobe2-stage"><div class="oobe2-illus"></div><div class="oobe2-content"></div></div>
      </div>
      <div class="oobe2-corner">
        <button title="Accessibility">${cornerAccess()}</button>
        <button title="Settings">${cornerGear()}</button>
      </div>`;
  }
  function cornerAccess() { return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#dfe6fb" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="7" r="1.4" fill="#dfe6fb" stroke="none"/><path d="M7 10 h10 M12 10 v5 M12 15 l-2.5 3.5 M12 15 l2.5 3.5"/></svg>`; }
  function cornerGear() { return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#dfe6fb" stroke-width="1.7"><circle cx="12" cy="12" r="3.2"/><path d="M12 3.5v2.5M12 18v2.5M4.6 7l2.2 1.3M17.2 15.7l2.2 1.3M4.6 17l2.2-1.3M17.2 8.3l2.2-1.3"/></svg>`; }

  // opts: { illus, back, big (illustration spans full on spinners), wide }
  function oobe(contentNode, opts) {
    opts = opts || {};
    oobeChrome();
    const top = bg.querySelector(".oobe2-top");
    let back = top.querySelector(".oobe2-back");
    if (opts.back) { if (!back) { back = el(`<button class="oobe2-back">&#8592;</button>`); top.insertBefore(back, top.firstChild); } back.onclick = opts.back; }
    else if (back) back.remove();
    const illus = bg.querySelector(".oobe2-illus");
    const content = bg.querySelector(".oobe2-content");
    const stage = bg.querySelector(".oobe2-stage");
    stage.classList.toggle("noillus", !opts.illus);
    illus.innerHTML = opts.illus || "";
    content.innerHTML = ""; content.appendChild(contentNode);
    illus.classList.remove("oobe2-in"); content.classList.remove("oobe2-in");
    void content.offsetWidth;
    illus.classList.add("oobe2-in"); content.classList.add("oobe2-in");
    return bg;
  }

  // ---- Just a moment… (spinner inside panel) ----
  function oobeJustAMoment(next, label) {
    oobeChrome();
    const top = bg.querySelector(".oobe2-top");
    const b = top.querySelector(".oobe2-back"); if (b) b.remove();
    const stage = bg.querySelector(".oobe2-stage");
    stage.classList.add("noillus");
    bg.querySelector(".oobe2-illus").innerHTML = "";
    const content = bg.querySelector(".oobe2-content");
    content.innerHTML = `<div class="oobe2-moment"><div class="spinner-ring big"></div><p>${label || "Just a moment…"}</p></div>`;
    setTimeout(() => next(), 2400);
  }

  // ---- Let's name your device ----
  function oobeNameDevice() {
    const cur = S().deviceName || "";
    const node = el(`<div>
      <h1>Let's name your device</h1>
      <p class="sub">Make it yours with a unique name that's easy to recognize when connecting to it from other devices. Your devices will restart after you name it.</p>
      <div class="field"><input type="text" id="dname" maxlength="15" placeholder="" value="${escapeHtml(cur)}"></div>
      <p class="sub small">Can't contain only numbers<br>No more than 15 characters<br>No spaces or any of the following special characters: " / \\ [ ] : | &lt; &gt; + = ; , ?</p>
      <div class="error-msg" id="derr"></div>
      <div class="oobe2-actions"><button class="ibtn" id="next">Next</button></div>
    </div>`);
    const inp = node.querySelector("#dname"), err = node.querySelector("#derr");
    const go = () => {
      const v = inp.value.trim();
      if (v) {
        if (/^\d+$/.test(v)) { err.textContent = "The name can't be only numbers."; return; }
        if (/[\s"/\\[\]:|<>+=;,?]/.test(v)) { err.textContent = "The name has a space or a character that isn't allowed."; return; }
        S().deviceName = v;
      }
      State.save(); oobeRegion();
    };
    inp.onkeydown = (e) => { if (e.key === "Enter") go(); };
    node.querySelector("#next").onclick = go;
    oobe(node, {});
  }

  // ---- Country / region ----
  function oobeRegion() {
    const regions = ALL_COUNTRIES;
    const node = el(`<div>
      <h1>Is this the right country or region?</h1>
      <div class="oobe2-search"><span class="oobe2-search-ic">&#128269;</span><input id="csearch" placeholder="Search another Country"></div>
      <div class="oobe2-rlist" id="rlist"></div>
      <div class="oobe2-actions"><button class="ibtn" id="next">Yes</button></div>
    </div>`);
    const list = node.querySelector("#rlist"), srch = node.querySelector("#csearch");
    let sel = S().region || "United States";
    function render(filter) {
      list.innerHTML = "";
      regions.filter((r) => !filter || r.toLowerCase().includes(filter.toLowerCase())).forEach((r) => {
        const o = el(`<div class="oobe2-ritem ${r === sel ? "sel" : ""}">${r}</div>`);
        o.onclick = () => { sel = r; S().region = r; list.querySelectorAll(".oobe2-ritem").forEach((x) => x.classList.toggle("sel", x === o)); };
        list.appendChild(o);
        if (r === sel && !filter) setTimeout(() => o.scrollIntoView({ block: "nearest" }), 0);
      });
    }
    render("");
    srch.oninput = () => render(srch.value);
    node.querySelector("#next").onclick = () => { S().region = sel; State.save(); oobeKeyboard(); };
    oobe(node, { illus: IC.globe });
  }

  // ---- Keyboard layout ----
  function oobeKeyboard() {
    const kbs = ALL_KEYBOARDS;
    const node = el(`<div>
      <h1>Is this the right keyboard layout?</h1>
      <p class="sub">If you also use another keyboard layout, you can add one next.</p>
      <div class="oobe2-search"><span class="oobe2-search-ic">&#128269;</span><input id="ksearch" placeholder="Search a keyboard layout"></div>
      <div class="oobe2-rlist" id="klist"></div>
      <div class="oobe2-actions"><button class="ibtn" id="next">Yes</button></div>
    </div>`);
    const list = node.querySelector("#klist"), srch = node.querySelector("#ksearch");
    let sel = S().keyboard || "US";
    function render(filter) {
      list.innerHTML = "";
      kbs.filter((k) => !filter || k.toLowerCase().includes(filter.toLowerCase())).forEach((k) => {
        const o = el(`<div class="oobe2-ritem ${k === sel ? "sel" : ""}">${k}</div>`);
        o.onclick = () => { sel = k; list.querySelectorAll(".oobe2-ritem").forEach((x) => x.classList.toggle("sel", x === o)); };
        list.appendChild(o);
        if (k === sel && !filter) setTimeout(() => o.scrollIntoView({ block: "nearest" }), 0);
      });
    }
    render("");
    srch.oninput = () => render(srch.value);
    node.querySelector("#next").onclick = () => { S().keyboard = sel; State.save(); oobeSecondKeyboard(); };
    oobe(node, { illus: IC.keyboard, back: oobeRegion });
  }

  function oobeSecondKeyboard() {
    const node = el(`<div>
      <h1>Want too add a second keyboard layout?</h1>
      <p class="sub">You can add more keyboard layouts and switch between them any time in Settings.</p>
      <div class="oobe2-actions spread"><button class="oobe2-link" id="add">Add layout</button><button class="ibtn" id="skip">Skip</button></div>
    </div>`);
    node.querySelector("#add").onclick = () => oobeJustAMoment(oobeSetupType);
    node.querySelector("#skip").onclick = () => oobeJustAMoment(oobeSetupType);
    oobe(node, { illus: IC.keyboard, back: oobeKeyboard });
  }

  // ---- How would you like to set up this device? ----
  function oobeSetupType() {
    const node = el(`<div>
      <h1>How would you like to set up this device?</h1>
      <div class="oobe2-opts">
        <button class="oobe2-opt sel" id="o-personal"><span class="oobe2-opt-ic">${homeIc()}</span><span class="oobe2-opt-tx"><b>Set up for personal use</b><span>Use a personal Microsoft account to get set up and have full control over this device.</span></span></button>
        <button class="oobe2-opt" id="o-work"><span class="oobe2-opt-ic">${workIc()}</span><span class="oobe2-opt-tx"><b>Set up for work or school</b><span>Get access to your organization's resources like email, Network, apps and services. Your organization will gave Full control over this device.</span></span></button>
      </div>
      <div class="oobe2-actions"><button class="ibtn" id="next">Next</button></div>
    </div>`);
    let choice = "personal";
    const pe = node.querySelector("#o-personal"), wk = node.querySelector("#o-work");
    pe.onclick = () => { choice = "personal"; pe.classList.add("sel"); wk.classList.remove("sel"); };
    wk.onclick = () => { choice = "work"; wk.classList.add("sel"); pe.classList.remove("sel"); };
    node.querySelector("#next").onclick = () => { S().setupFor = choice; State.save(); oobePersonalizeTheme(); };
    oobe(node, { illus: IC.chat, back: oobeSecondKeyboard });
  }
  function homeIc() { return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 11 L12 4 L20 11"/><path d="M6 10 v9 h12 v-9"/></svg>`; }
  function workIc() { return `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="4" y="8" width="16" height="12" rx="1.5"/><path d="M9 8 V5 h6 v3 M4 13 h16"/></svg>`; }

  // ---- Personalize: theme + accent ----
  function oobePersonalizeTheme() {
    const node = el(`<div>
      <h1>Personalize your device</h1>
      <p class="sub">More personalization options are available in the settings app.</p>
      <div class="oobe2-prow"><span class="oobe2-plabel">Theme</span></div>
      <div class="oobe2-themes" id="themes">
        <button class="oobe2-theme sel" data-t="dark"><span class="oobe2-theme-prev dark">Aa</span></button>
        <button class="oobe2-theme" data-t="light"><span class="oobe2-theme-prev light">Aa</span></button>
      </div>
      <div class="oobe2-prow"><span class="oobe2-plabel">Accent color</span><span class="oobe2-pmode"><span class="on">Gradient</span><span>Solid color</span></span></div>
      <div class="oobe2-accents" id="accents"></div>
      <div class="oobe2-actions"><button class="ibtn" id="next">Next</button></div>
    </div>`);
    const themes = node.querySelector("#themes");
    themes.querySelectorAll(".oobe2-theme").forEach((b) => b.onclick = () => {
      themes.querySelectorAll(".oobe2-theme").forEach((x) => x.classList.toggle("sel", x === b));
      S().theme = b.dataset.t; document.body.classList.toggle("dark", S().theme !== "light");
    });
    const accents = ["#ff4fa3", "#8b5cff", "#3b82e8", "#19c3b2", "#45d07a", "#ffb13e", "#ff6b4a", "#c061ff"];
    const acc = node.querySelector("#accents");
    accents.forEach((c, i) => {
      const o = el(`<button class="oobe2-acc ${i === 1 ? "sel" : ""}" style="background:${c}"></button>`);
      o.onclick = () => { acc.querySelectorAll(".oobe2-acc").forEach((x) => x.classList.toggle("sel", x === o)); S().accent = c; };
      acc.appendChild(o);
    });
    node.querySelector("#next").onclick = () => { State.save(); oobePersonalizeWallpaper(); };
    oobe(node, { illus: IC.personalize, back: oobeSetupType });
  }

  // ---- Personalize: wallpaper ----
  function oobePersonalizeWallpaper() {
    const papers = [
      "linear-gradient(135deg,#1b1152,#7b1f6a,#ff4fa3)",
      "linear-gradient(135deg,#2a1b5e,#8b5cff,#d98fe0)",
      "linear-gradient(135deg,#0d1b3a,#2f6bff,#5ec8ff)",
      "radial-gradient(circle at 50% 45%,#2a2550,#0d0b1e)",
      "linear-gradient(135deg,#0a3d91,#2f8bff)",
      "linear-gradient(135deg,#143a7a,#4aa8ff,#bfe8ff)",
      "linear-gradient(135deg,#1b1152,#3b82e8)",
      "linear-gradient(135deg,#0a2a5e,#1f77c0)",
    ];
    const node = el(`<div>
      <h1>Personalize your device</h1>
      <p class="sub">More personalization options are available in the settings app.</p>
      <div class="oobe2-prow"><span class="oobe2-plabel">Wallpaper</span></div>
      <div class="oobe2-papers" id="papers">${papers.map((p, i) => `<button class="oobe2-paper ${i === 0 ? "sel" : ""}" style="background:${p}"></button>`).join("")}<button class="oobe2-paper oobe2-paper-more">🖼<span>More wallpapers</span></button></div>
      <div class="oobe2-actions"><button class="ibtn" id="next">Next</button></div>
    </div>`);
    const papersEl = node.querySelector("#papers");
    papersEl.querySelectorAll(".oobe2-paper:not(.oobe2-paper-more)").forEach((b, i) => b.onclick = () => { papersEl.querySelectorAll(".oobe2-paper").forEach((x) => x.classList.remove("sel")); b.classList.add("sel"); S().wallpaperChoice = i; });
    node.querySelector("#next").onclick = () => { State.save(); oobeJustAMoment(oobeSignIn); };
    oobe(node, { illus: IC.personalize, back: oobePersonalizeTheme });
  }

  // ---- Sign in to Microsoft ----
  function oobeSignIn() {
    const node = el(`<div>
      <h1>Let's sign in to Microsoft</h1>
      <p class="sub">One account connects your device across Microsoft apps and services, like Office, OneDrive, Microsoft Edge and Microsoft Store.</p>
      <div class="ms-badge">${msLogo()} Microsoft</div>
      <div class="ms-stage" id="msStage"></div>
    </div>`);
    const stage = node.querySelector("#msStage");
    function emailView() {
      stage.innerHTML = `
        <div class="field"><label>Sign in</label><input type="email" id="email" placeholder="Email, phone, or Skype" value="${S().account ? S().account.email : ""}"></div>
        <p class="ms-links"><span class="oobe2-link" id="createLink">No account? Create one!</span></p>
        <div class="oobe2-actions spread"><button class="oobe2-link" id="noacc">Skip for now</button><button class="ibtn" id="next">Next</button></div>`;
      stage.querySelector("#createLink").onclick = createView;
      stage.querySelector("#noacc").onclick = () => { S().account = null; State.save(); oobeJustAMoment(oobePin); };
      stage.querySelector("#next").onclick = () => {
        const email = stage.querySelector("#email").value.trim();
        if (!email) { stage.querySelector("#email").focus(); return; }
        S().account = { email, password: "" };
        pwView(email);
      };
    }
    function createView() {
      stage.innerHTML = `
        <div class="field"><label>Create account</label><input type="email" id="cemail" placeholder="someone@example.com"></div>
        <div class="field"><input type="password" id="cpw" placeholder="Create a password"></div>
        <div class="error-msg" id="cerr"></div>
        <div class="oobe2-actions spread"><button class="oobe2-link" id="cback">Back to sign in</button><button class="ibtn" id="ccreate">Create</button></div>`;
      const cpw = stage.querySelector("#cpw"), cerr = stage.querySelector("#cerr");
      stage.querySelector("#cback").onclick = emailView;
      stage.querySelector("#ccreate").onclick = () => {
        const email = stage.querySelector("#cemail").value.trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { cerr.textContent = "Enter a valid email address."; return; }
        if (cpw.value.length < 4) { cerr.textContent = "Password must be at least 4 characters."; return; }
        S().account = { email, password: cpw.value, created: true }; State.save();
        oobeJustAMoment(oobePin);
      };
    }
    function pwView(email) {
      stage.innerHTML = `
        <div class="ms-return">&#8592; ${escapeHtml(email)}</div>
        <div class="field"><label>Enter Password</label><input type="password" id="pw" placeholder="Password"></div>
        <p class="ms-links"><span class="oobe2-link">Forgot password?</span></p>
        <div class="oobe2-actions spread"><button class="oobe2-link" id="back2">Back</button><button class="ibtn" id="signin">Next</button></div>`;
      stage.querySelector("#back2").onclick = emailView;
      stage.querySelector("#signin").onclick = () => {
        S().account = { email, password: stage.querySelector("#pw").value }; State.save();
        oobeJustAMoment(oobePin);
      };
    }
    emailView();
    oobe(node, { illus: IC.chat, back: oobePersonalizeWallpaper });
  }

  // ---- Set up PIN ----
  function oobePin() {
    const node = el(`<div>
      <h1>Set up PIN</h1>
      <p class="sub">A Windows Hello PIN is a fast, secure way to sign in to your device, Apps and services.</p>
      <div class="field"><input type="password" id="pin" placeholder="New PIN" inputmode="numeric"></div>
      <div class="field"><input type="password" id="pin2" placeholder="Confirm PIN" inputmode="numeric"></div>
      <div class="field checkrow"><input type="checkbox" id="letters"><label for="letters">Include letters and symbols</label></div>
      <div class="error-msg" id="err"></div>
      <div class="oobe2-actions spread"><button class="oobe2-link" id="skip">Skip</button><button class="ibtn" id="ok">Ok</button></div>
    </div>`);
    const pin = node.querySelector("#pin"), pin2 = node.querySelector("#pin2"), err = node.querySelector("#err"), letters = node.querySelector("#letters");
    letters.onchange = () => {
      const mode = letters.checked ? "text" : "numeric";
      pin.inputMode = mode; pin2.inputMode = mode;
      pin.placeholder = letters.checked ? "New password" : "New PIN";
      pin2.placeholder = letters.checked ? "Confirm password" : "Confirm PIN";
    };
    node.querySelector("#skip").onclick = () => oobeBiometric();
    node.querySelector("#ok").onclick = () => {
      const a = pin.value, b = pin2.value;
      if (letters.checked) { if (!a) { err.textContent = "Enter a password."; return; } }
      else if (!/^(\d{4}|\d{6})$/.test(a)) { err.textContent = "PIN must be 4 or 6 digits."; return; }
      if (a !== b) { err.textContent = "The two entries don't match."; return; }
      S().profile = Object.assign({}, S().profile, { authType: letters.checked ? "password" : "pin", secret: a });
      State.save();
      oobeBiometric();
    };
    oobe(node, { illus: IC.pin, back: oobeSignIn });
  }

  // ---- Add a biometric (chooser) ----
  function oobeBiometric() {
    const node = el(`<div>
      <h1>Add a biometric</h1>
      <p class="sub">Windows Hello lets you sign in and verify it's you with a touch. This is optional.</p>
      <button class="oobe2-choice sel" id="b-fp"><b>&#128070; Fingerprint</b><span>Unlock with a touch using your device's fingerprint sensor.</span></button>
      <button class="oobe2-choice" id="b-pin"><b>&#128273; PIN</b><span>Use the PIN you just set up to sign in.</span></button>
      <div class="oobe2-actions spread"><button class="oobe2-link" id="skip">Skip</button><button class="ibtn" id="next">Next</button></div>
    </div>`);
    let choice = "fp";
    const fp = node.querySelector("#b-fp"), pn = node.querySelector("#b-pin");
    fp.onclick = () => { choice = "fp"; fp.classList.add("sel"); pn.classList.remove("sel"); };
    pn.onclick = () => { choice = "pin"; pn.classList.add("sel"); fp.classList.remove("sel"); };
    node.querySelector("#skip").onclick = () => oobeAlright();
    node.querySelector("#next").onclick = () => (choice === "fp" ? oobeFingerprintIntro() : oobeAlright());
    oobe(node, { illus: IC.finger, back: oobePin });
  }

  // ---- Fingerprint ----
  function oobeFingerprintIntro() { oobeFingerprintShow(); }
  // The device's real Touch ID / Face ID through WebAuthn (saves a passkey).
  function oobeFingerprintShow() {
    const nm = window.TouchID ? TouchID.sensorName() : "Touch ID";
    const node = el(`<div>
      <h1>${escapeHtml(nm)}</h1>
      <p class="oobe2-sub-strong">Sign in with your fingerprint or face</p>
      <p class="sub" id="fpmsg">Tap <b>Set up</b> and your device will ask for your real ${escapeHtml(nm)}. This saves a passkey for this site.</p>
      <div class="oobe2-fp-sensor"><div class="oobe2-fp-pad"></div><span class="oobe2-fp-hand">&#128070;</span></div>
      <p class="sub" id="fperr" style="color:#ff8a8a;min-height:1.2em"></p>
      <div class="oobe2-actions spread"><button class="oobe2-link" id="skip">Skip</button><button class="ibtn" id="next">Set up</button></div>
    </div>`);
    const next = node.querySelector("#next"), msg = node.querySelector("#fpmsg"), fe = node.querySelector("#fperr");
    node.querySelector("#skip").onclick = () => oobeAlright();
    if (window.TouchID) TouchID.available().then((ok) => {
      if (ok) return;
      msg.textContent = "This browser can't reach a fingerprint or face sensor on this device. Skip this — you can set it up later in Settings → Accounts → Sign-in options on a device that has one.";
      next.hidden = true;
    });
    next.onclick = () => {
      if (!window.TouchID) { oobeAlright(); return; }
      next.disabled = true; fe.textContent = "";
      TouchID.enroll().then(() => oobeFingerprintDone(nm)).catch((e) => { // straight from the tap (Safari needs that)
        next.disabled = false;
        fe.textContent = e && e.message === "cancelled" ? "Cancelled — tap Set up to try again, or Skip." : ((e && e.friendly) || "That didn't work.");
      });
    };
    oobe(node, { illus: IC.finger, back: oobeBiometric });
  }
  function oobeFingerprintDone(nm) {
    const node = el(`<div class="oobe2-fpscan">
      <div class="oobe2-fpring done"><div class="oobe2-fpring-fill" style="background:conic-gradient(#1fc06a 360deg,#1fc06a 360deg)"></div><span class="oobe2-fpglyph"><svg viewBox="0 0 48 48" width="70" height="70"><circle cx="24" cy="24" r="22" fill="#1fc06a"/><path d="M15 24 l6 7 12 -14" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg></span></div>
      <p class="oobe2-fp-status">${escapeHtml(nm)} is set up</p>
    </div>`);
    oobe(node, {});
    bg.querySelector(".oobe2-stage").classList.add("noillus");
    setTimeout(oobeAlright, 1200);
  }

  // ---- Alright! ----
  function oobeAlright() {
    const node = el(`<div>
      <h1>Alright!</h1>
      <p class="sub">${window.TouchID && TouchID.enrolled() ? "Now your account is more secure! Next time, sign in with " + escapeHtml(TouchID.sensorName()) + " or your PIN." : "Your account is ready. You can add " + escapeHtml(window.TouchID ? TouchID.sensorName() : "Touch ID") + ", a password or a security key later in Settings → Accounts → Sign-in options."}</p>
      <div class="oobe2-actions"><button class="ibtn" id="save">Save</button></div>
    </div>`);
    node.querySelector("#save").onclick = () => oobeWelcomeBack();
    oobe(node, { illus: IC.finger });
  }

  // ---- Welcome back / Restore ----
  function oobeWelcomeBack() {
    const name = (S().account && S().account.email ? S().account.email.split("@")[0] : (S().profile && S().profile.username)) || "there";
    const node = el(`<div>
      <h1>Welcome back, ${escapeHtml(name)}!</h1>
      <p class="sub">Your settings and OneDrive files are synced to this PC and you'll get a chance to restore apps from your previous PC once you finish your device setup.</p>
      <button class="oobe2-choice sel" id="restore"><b>&#8635; Restore from DESKTOP-TV89QC4D</b><span>Last synced on Wednesday, June 23, 2021 use settings &amp; preferences, sync OneDrive files, and select apps to install from this device.</span></button>
      <button class="oobe2-choice" id="fresh"><b>&#128187; Set up as new device</b><span>Choose new apps. You'll still have access to your settings, preferences, and OneDrive files.</span></button>
      <div class="oobe2-actions"><button class="ibtn" id="next">Next</button></div>
    </div>`);
    let choice = "restore";
    const restore = node.querySelector("#restore"), fresh = node.querySelector("#fresh");
    restore.onclick = () => { choice = "restore"; restore.classList.add("sel"); fresh.classList.remove("sel"); };
    fresh.onclick = () => { choice = "fresh"; fresh.classList.add("sel"); restore.classList.remove("sel"); };
    node.querySelector("#next").onclick = () => { S().setup = Object.assign({}, S().setup, { restore: choice }); State.save(); if (choice === "restore") oobeRestoring(); else oobePrivacy(); };
    oobe(node, { illus: IC.flower, back: oobeAlright });
  }
  function oobeRestoring() {
    oobeChrome();
    const b = bg.querySelector(".oobe2-back"); if (b) b.remove();
    bg.querySelector(".oobe2-stage").classList.add("noillus");
    bg.querySelector(".oobe2-illus").innerHTML = "";
    bg.querySelector(".oobe2-content").innerHTML = `<div class="oobe2-moment"><div class="spinner-ring big"></div><p>Restoring your files…</p><span class="oobe2-moment-sub">This not take a long, just relax.</span></div>`;
    setTimeout(oobePrivacy, 2600);
  }

  // ---- Choose privacy settings ----
  function oobePrivacy() {
    const opts = [
      ["location", "Location", "Get location-based experiences like weather and directions. Let Windows and apps request your location."],
      ["findmy", "Find my device", "Use your location to help you find your device if you lose it."],
      ["diagnostic", "Diagnostic data", "Send required and optional diagnostic data about your device to Microsoft."],
      ["inking", "Inking & typing", "Improve suggestions by sending typing and inking data to Microsoft."],
      ["tailored", "Tailored experiences", "Let Microsoft use your diagnostic data for personalized tips and recommendations."],
      ["adid", "Advertising ID", "Apps can use advertising ID to show more personalized ads."],
    ];
    const node = el(`<div>
      <h1>Choose privacy settings for your device</h1>
      <p class="sub">Microsoft puts you in control of your privacy. Choose your settings, then select Accept to save them. You can change these at any time.</p>
      <div class="oobe2-privacy" id="pv">${opts.map((o) => `<div class="oobe2-priv"><div class="oobe2-priv-tx"><b>${o[1]}</b><span>${o[2]}</span></div><label class="oobe2-switch"><input type="checkbox" checked data-k="${o[0]}"><span></span></label></div>`).join("")}</div>
      <div class="oobe2-actions"><button class="ibtn" id="accept">Accept</button></div>
    </div>`);
    node.querySelector("#accept").onclick = () => {
      const pv = {}; node.querySelectorAll("#pv input").forEach((c) => pv[c.dataset.k] = c.checked);
      S().setup = Object.assign({}, S().setup, { privacy: pv }); State.save(); oobeCustomize();
    };
    oobe(node, { illus: IC.types, back: oobeWelcomeBack });
  }

  // ---- Customize your experience ----
  function oobeCustomize() {
    const cats = [
      { id: "gaming", name: "Gaming", ic: catIc("#7c5cff", '<path d="M6 8 h12 a5 5 0 0 1 5 5 a3 3 0 0 1 -5.5 1.8 H8.5 A3 3 0 0 1 3 13 a5 5 0 0 1 3 -5 z"/><circle cx="16.5" cy="12" r="1.2" fill="#fff"/><rect x="6" y="11" width="4" height="1.6" fill="#fff"/><rect x="7.2" y="9.8" width="1.6" height="4" fill="#fff"/>') },
      { id: "school", name: "School", ic: catIc("#0a7d3a", '<path d="M12 4 L22 9 L12 14 L2 9 z"/><path d="M6 11 v4 c0 1.5 3 3 6 3 s6 -1.5 6 -3 v-4" fill="none" stroke="#0a7d3a" stroke-width="1.6"/>') },
      { id: "family", name: "Family", ic: catIc("#e3008c", '<circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M2 20 c0 -4 3 -6 6 -6 s6 2 6 6 M12 20 c0 -4 3 -6 6 -6 s4 2 4 6"/>') },
      { id: "entertainment", name: "Entertainment", ic: catIc("#e50914", '<rect x="2" y="4" width="20" height="14" rx="2"/><path d="M10 8 l6 3 -6 3 z" fill="#fff"/>') },
      { id: "creativity", name: "Creativity", ic: catIc("#ff6b4a", '<path d="M12 3 a9 9 0 1 0 0 18 c1.5 0 2 -1 2 -2 a2 2 0 0 1 2 -2 h1 a4 4 0 0 0 4 -4 c0 -5 -4 -8 -9 -8 z"/><circle cx="8" cy="10" r="1.3" fill="#fff"/><circle cx="12" cy="7.5" r="1.3" fill="#fff"/><circle cx="16" cy="10" r="1.3" fill="#fff"/>') },
      { id: "business", name: "Business", ic: catIc("#0067c0", '<rect x="3" y="8" width="18" height="11" rx="2"/><path d="M9 8 V6 a2 2 0 0 1 2 -2 h2 a2 2 0 0 1 2 2 v2" fill="none" stroke="#0067c0" stroke-width="1.6"/>') },
    ];
    const chosen = new Set((S().setup && S().setup.categories) || ["gaming"]);
    const node = el(`<div>
      <h1>Let's customize your experience</h1>
      <p class="sub">Select all the ways you plan to use your device to get customized suggestions for tips, tools, and services. You can always change this in Settings.</p>
      <div class="oobe2-cats" id="cats"></div>
      <div class="oobe2-actions"><button class="ibtn" id="next">Next</button></div>
    </div>`);
    const catsEl = node.querySelector("#cats");
    cats.forEach((c) => {
      const row = el(`<button class="oobe2-cat ${chosen.has(c.id) ? "sel" : ""}"><span class="oobe2-cat-ic">${c.ic}</span><b>${c.name}</b><span class="oobe2-cat-box">${chosen.has(c.id) ? "&#10003;" : ""}</span></button>`);
      row.onclick = () => { const on = !chosen.has(c.id); if (on) chosen.add(c.id); else chosen.delete(c.id); row.classList.toggle("sel", on); row.querySelector(".oobe2-cat-box").innerHTML = on ? "&#10003;" : ""; };
      catsEl.appendChild(row);
    });
    node.querySelector("#next").onclick = () => { S().setup = Object.assign({}, S().setup, { categories: [...chosen] }); State.save(); oobeOneDrive(); };
    oobe(node, { illus: IC.customize, back: oobePrivacy });
  }
  function catIc(c, inner) { return `<svg viewBox="0 0 24 24" width="18" height="18" fill="${c}">${inner}</svg>`; }

  // ---- OneDrive ----
  function oobeOneDrive() {
    const node = el(`<div>
      <h1>Save space on your PC with OneDrive</h1>
      <p class="sub">Store your Desktop, Documents, and Pictures folders in OneDrive to keep them protected and accessible on all your devices. You can also share your files and photos with others by sending them a link.</p>
      <button class="oobe2-choice sel" id="od-on"><b>&#9729; Automatically store my files in OneDrive</b><span>Save space on your PC protect your files, and access them anywhere.</span></button>
      <button class="oobe2-choice" id="od-off"><b>&#128421; Only store files on this device</b><span>Your files will only be accessible on this device.</span></button>
      <div class="oobe2-actions spread"><button class="oobe2-link">Privacy Statement</button><button class="ibtn" id="next">Next</button></div>
    </div>`);
    let choice = "on";
    const on = node.querySelector("#od-on"), off = node.querySelector("#od-off");
    on.onclick = () => { choice = "on"; on.classList.add("sel"); off.classList.remove("sel"); };
    off.onclick = () => { choice = "off"; off.classList.add("sel"); on.classList.remove("sel"); };
    node.querySelector("#next").onclick = () => { S().setup = Object.assign({}, S().setup, { oneDrive: choice === "on" }); State.save(); oobeOffice(); };
    oobe(node, { illus: IC.onedrive, back: oobeCustomize });
  }

  // ---- Try premium Office apps for free (Microsoft 365) ----
  function oobeOffice() {
    const chk = `<span class="oobe2-office-chk">&#10003;</span>`;
    const node = el(`<div>
      <h1>Try premium Office apps for free<br>With Microsoft 365</h1>
      <div class="oobe2-office">
        <div class="oobe2-office-row">${chk}<div><b>Premium Office apps</b><span>Collaborate across Word, Excel, PowerPoint and more, share your subscription</span></div></div>
        <div class="oobe2-office-row">${chk}<div><b>Share your subscription</b><span>One subscription can be shared with up to 5 different people.</span></div></div>
        <div class="oobe2-office-row">${chk}<div><b>Accessible anywhere</b><span>Access, edit, and share files with 1 TB of cloud storage per person.</span></div></div>
      </div>
      <p class="sub small">You'll need a credit card to start your 1-month trial. After that Microsoft 365 Family is $99.99 plus applicable taxes per year. Cancel anytime to stop future charges by visiting your Microsoft account.</p>
      <div class="oobe2-actions spread"><button class="oobe2-link" id="haskey">I have a product key</button><span class="oobe2-office-r"><button class="oobe2-link" id="no">No, thanks</button><button class="ibtn" id="try">Try for free</button></span></div>
    </div>`);
    node.querySelector("#haskey").onclick = () => { S().setup = Object.assign({}, S().setup, { m365: "key" }); State.save(); oobeThankYou(); };
    node.querySelector("#no").onclick = () => { S().setup = Object.assign({}, S().setup, { m365: false }); State.save(); oobeThankYou(); };
    node.querySelector("#try").onclick = () => { S().setup = Object.assign({}, S().setup, { m365: true }); State.save(); oobeThankYou(); };
    oobe(node, { illus: IC.office, back: oobeOneDrive });
  }

  // ---- Thank you! ----
  function oobeThankYou() {
    const node = el(`<div class="oobe2-thanks">
      <h1>Thank you!</h1>
      <p class="sub">Thank you for your participate in this Windows 12.1 setup. Your Windows 12.1 is ready for use now. Let's go!</p>
      <div class="oobe2-actions"><button class="ibtn" id="go">Finish</button></div>
    </div>`);
    node.querySelector("#go").onclick = finishSetup;
    oobe(node, {});
  }

  function finishSetup() {
    S().clock = Object.assign({ mode: "automatic", format24: false }, S().clock, { mode: "automatic" });
    S().setupCompleted = true;
    if (S().systemBroken) { try { const d = S(); if (window.FilesParts) { d.appData = d.appData || {}; d.appData.files = d.appData.files || { root: FilesParts.FILE_SEED() }; Object.assign(d.appData.files.root, FilesParts.WIN_FS()); } } catch (_) {} S().systemBroken = false; }
    State.save();
    if (window.Achievements) window.Achievements.unlock("welcome");
    prepareDesktop();
  }

  // "This may take several minutes / Getting ready / Almost there" → desktop.
  function prepareDesktop() {
    const seq = [
      () => waveScreen("This may take several minutes", "In order for you to use your PC", "Don't turn off or unplug your device."),
      () => waveScreen("Getting ready", "In order for you to use your PC", "Don't turn off or unplug your device."),
      () => waveScreen("Almost there", "In order for you to use your PC", "Don't turn off or unplug your device."),
      () => flagScreen(FLAG_GRAD(56), null),
    ];
    let k = 0;
    const run = () => { if (k < seq.length) { seq[k](); k++; setTimeout(run, 1600); } else finish(); };
    run();
  }

  // ============================================================
  //  shared helpers
  // ============================================================
  function msLogo() {
    return `<svg width="18" height="18" viewBox="0 0 24 24"><rect x="1" y="1" width="10" height="10" fill="#f25022"/><rect x="13" y="1" width="10" height="10" fill="#7fba00"/><rect x="1" y="13" width="10" height="10" fill="#00a4ef"/><rect x="13" y="13" width="10" height="10" fill="#ffb900"/></svg>`;
  }

  function showKeySheet() {
    const overlay = el(`<div class="modal-mask" style="z-index:9999;overflow:auto;padding:40px">
      <div style="background:#fff;color:#111;max-width:700px;margin:0 auto;padding:30px;border-radius:12px">
        <h2 style="margin-top:0">Windows 12 — Product Key Sheet</h2>
        <p style="color:#666">Tap any key to copy it and fill the box. Each key works once.</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-family:monospace;font-size:13px"></div>
        <div style="text-align:right;margin-top:16px"><button class="pill-btn" id="closeSheet">Close</button></div>
      </div></div>`);
    const grid = overlay.querySelector("div[style*='grid']");
    State.VALID_KEYS.forEach((k, i) => {
      const used = S().redeemedKeys.includes(k);
      const row = el(`<div class="key-sheet-row ${used ? "used" : ""}">${(i + 1).toString().padStart(3, "0")}. ${k}</div>`);
      if (!used) row.onclick = () => {
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(k).catch(() => {});
        const inp = document.querySelector(".activate-key, .key-input");
        if (inp) { inp.value = k; inp.dispatchEvent(new Event("input", { bubbles: true })); }
        row.textContent = "Copied ✓  " + k;
        setTimeout(() => overlay.remove(), 550);
      };
      grid.appendChild(row);
    });
    overlay.querySelector("#closeSheet").onclick = () => overlay.remove();
    screen().appendChild(overlay);
  }

  function openTermsBrowser() {
    const overlay = el(`<div class="modal-mask" style="z-index:9999;display:flex;align-items:center;justify-content:center">
      <div class="win" style="width:min(820px,92vw);height:min(560px,86vh);position:relative">
        <div class="win-titlebar"><div class="title">${Icon.mini("browser", "Edge")} Edge</div>
          <div class="win-controls"><button class="close" title="Close">&#215;</button></div></div>
        <div class="browser-bar"><button id="rl" title="Reload">&#8635;</button>
          <div class="addr locked"><span class="muted" style="font-size:.72rem">Secure</span><input value="https://windows12.local/privacy" readonly></div></div>
        <div class="win-body"><div class="site" id="termsBody"></div></div>
      </div></div>`);
    const body = overlay.querySelector("#termsBody");
    body.innerHTML = `
      <h1>Windows 12 — Privacy &amp; Terms</h1>
      <p class="muted">Last updated: today (in simulation time)</p>
      <p>This is a simulated operating system created for fun and learning. It is <b>not affiliated with Microsoft</b>. By using it you agree that:</p>
      <ul>
        <li>All money, purchases, accounts and "cloud" features are simulated.</li>
        <li>No real products are delivered and no real money changes hands.</li>
        <li>Your data stays in this browser's local storage.</li>
        <li>You will have a good time.</li>
      </ul>
      <p>Close this window to go back.</p>`;
    overlay.querySelector("#rl").onclick = () => {};
    overlay.querySelector(".close").onclick = () => overlay.remove();
    screen().appendChild(overlay);
  }

  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

  function finish() {
    bg.classList.add("fade-out");
    setTimeout(() => { bg.remove(); if (onComplete) onComplete(); }, 700);
  }

  function run(done) {
    onComplete = done;
    document.body.classList.toggle("dark", S().theme === "dark");
    document.documentElement.style.setProperty("--scale", S().textScale / 100);
    mount();
    if (!S().installerDone) installerSplash();
    else oobeJustAMoment(oobeNameDevice);
  }

  window.Setup = { run };
})();
