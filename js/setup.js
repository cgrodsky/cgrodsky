/* Out-of-box experience. Two stages:
   1. Installer  — "Welcome to Windows Setup" + "Activate Windows" (product key),
      styled as a windowed installer ("Step 1 of 3: Collecting Information").
   2. OOBE       — a glassy panel over a glowing orb with the "Windows 12 2026"
      wordmark: region → accessibility → Microsoft account → just a moment →
      personalize → PIN → fingerprint → welcome back/restore → customize → time.
   Reuses State product-key / account / PIN logic. */
(function () {
  "use strict";

  const screen = () => document.getElementById("screen");
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }

  let bg, onComplete;
  const S = () => State.data;
  const EDITION_YEAR = "2026";

  function mount() {
    bg = el(`<div class="setup-bg oobe-bg"></div>`);
    screen().appendChild(bg);
  }

  // ---------- shared corner icons (accessibility + volume) ----------
  const CORNER = `<div class="oobe-corner">
    <span title="Accessibility"><svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="4.2" r="1.8" fill="currentColor" stroke="none"/><path d="M4 8 h16 M12 8 v7 M12 15 l-3.5 5 M12 15 l3.5 5"/></svg></span>
    <span title="Volume"><svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor"><path d="M4 9 h3.5 L13 5 v14 L7.5 15 H4 z"/><path d="M16 8.5 a5 5 0 0 1 0 7" fill="none" stroke="currentColor" stroke-width="1.8"/></svg></span>
  </div>`;

  // ============================================================
  //  STAGE 1 — INSTALLER (windowed "Windows Setup")
  // ============================================================
  function installerFrame(inner, step) {
    bg.className = "setup-bg installer-bg";
    bg.innerHTML = `
      <div class="installer-win">
        <div class="installer-titlebar">
          <span class="installer-tt">${Icon.mini("settings", "Setup")} Windows Setup</span>
          <span class="row" style="gap:12px"><button class="setup-skip">Skip setup</button><span class="installer-x">&#215;</span></span>
        </div>
        <div class="installer-body">${inner}</div>
        <div class="installer-foot">
          <div class="installer-dashes">${[1, 2, 3].map((i) => `<span class="${i <= step ? "on" : ""}"></span>`).join("")}</div>
          <div class="installer-stepnote">Step ${step} of 3: Collecting Information</div>
        </div>
      </div>`;
    wireSkip();
    return bg.querySelector(".installer-body");
  }

  function installerWelcome() {
    const body = installerFrame(`
      <h1>Welcome to Windows Setup</h1>
      <p>Welcome to Windows 12 ${EDITION_YEAR} Setup. This will involve a very easy few steps. Once these steps are completed, setup will let you know when you can walk away and setup can complete on its own. This will take a while (maybe 10 or more minutes).</p>
      <p>To begin the setup, click <b>Next</b>. If you want to repair your PC, click <b>Repair Windows</b>.</p>
      <div class="installer-actions"><span></span>
        <div class="row" style="gap:12px">
          <button class="btn-text" id="repair">Repair Windows</button>
          <button class="btn-primary" id="next">Next</button>
        </div>
      </div>`, 1);
    body.querySelector("#repair").onclick = () => {
      const note = body.querySelector("#repair");
      note.textContent = "Nothing to repair — fresh install"; note.disabled = true;
    };
    body.querySelector("#next").onclick = installerActivate;
  }

  function installerActivate() {
    const body = installerFrame(`
      <h1>Activate Windows</h1>
      <p>If this is the first time you're installing Windows on this PC (or you're installing a different edition), you need to enter a valid Windows product key. Your product key should be in the confirmation email you received after buying a digital copy of Windows or on a label inside the box that Windows came in.</p>
      <p>The product key looks like this:<br><span class="mono">XXXXX-XXXXX-XXXXX-XXXXX-XXXXX</span></p>
      <p>If you don't have a valid product key, select <b>I don't have product key</b>, then you must have a 30-day trial and after trial ends, you must insert a valid product key.</p>
      <div class="field"><input type="text" id="key" class="key-input activate-key" maxlength="15" placeholder="XXX-XXX-XXX-XXX"><div class="error-msg" id="err"></div></div>
      <p><span class="link-blue" id="sheet">View available keys</span></p>
      <div class="installer-actions">
        <button class="btn-text" id="priv">Privacy Statement</button>
        <div class="row" style="gap:12px">
          <button class="btn-text" id="nokey">I don't have product key</button>
          <button class="btn-primary" id="next">Next</button>
        </div>
      </div>`, 1);

    const key = body.querySelector("#key"), err = body.querySelector("#err");
    key.addEventListener("input", () => {
      const v = key.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
      key.value = v.replace(/(.{3})/g, "$1-").replace(/-$/, ""); err.textContent = "";
    });
    body.querySelector("#sheet").onclick = showKeySheet;
    body.querySelector("#priv").onclick = () => openTermsBrowser();
    body.querySelector("#nokey").onclick = () => { S().hasProductKey = false; finishInstaller(); };
    body.querySelector("#next").onclick = () => {
      const res = State.validateKey(key.value);
      if (res === "valid") { State.redeemKey(key.value); finishInstaller(); }
      else if (res === "redeemed") err.textContent = "That key has already been redeemed.";
      else err.textContent = "That doesn't look like a valid product key.";
    };
  }

  function finishInstaller() {
    S().installerDone = true; State.save();
    installerDownload();
  }

  // "Downloading Windows" — a progress screen before the OOBE.
  function installerDownload() {
    const body = installerFrame(`
      <div class="installer-download">
        <div class="dl-flag"><span class="w12-flag"><i></i><i></i><i></i><i></i></span></div>
        <h1 class="dl-title">Downloading Windows 12</h1>
        <div class="dl-status">Preparing…</div>
        <div class="dl-bar"><div class="dl-fill"></div></div>
        <div class="dl-meta"><span class="dl-pct">0%</span><span class="dl-speed"></span></div>
        <p class="dl-note">Keep your PC on and plugged in until this is done.</p>
      </div>`, 3);
    const fill = body.querySelector(".dl-fill"), pct = body.querySelector(".dl-pct"), status = body.querySelector(".dl-status"), speed = body.querySelector(".dl-speed");
    const stages = ["Downloading files…", "Verifying download…", "Installing features…", "Getting ready…"];
    let p = 0;
    const iv = setInterval(() => {
      p += Math.random() * 6 + 2.5;
      if (p >= 100) {
        p = 100; fill.style.width = "100%"; pct.textContent = "100%"; status.textContent = "Download complete"; speed.textContent = "";
        clearInterval(iv); setTimeout(oobeRegion, 1000);
      } else {
        fill.style.width = p + "%"; pct.textContent = Math.floor(p) + "%";
        status.textContent = stages[Math.min(stages.length - 1, Math.floor(p / 25))];
        speed.textContent = (18 + Math.floor(Math.random() * 30)) + " MB/s";
      }
    }, 230);
    wireSkip();
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
  //  STAGE 2 — OOBE (glassy orb panel)
  // ============================================================
  // opts: { illustration, back, wide }
  // Build the persistent OOBE chrome once (animated orb + panel) so it stays
  // put between steps; only the illustration + content swap, with a slide-in.
  function ensureOobeChrome() {
    if (bg.querySelector(".oobe-panel")) return;
    bg.className = "setup-bg oobe-bg";
    bg.innerHTML = `
      <div class="oobe-brand"><span class="oobe-flag"><i></i><i></i><i></i><i></i></span>Windows <b>12</b><sup>${EDITION_YEAR}</sup></div>
      <div class="oobe-orb"></div>
      <div class="oobe-panel">
        <div class="oobe-breadcrumb"><span class="oobe-crumb"><span>${Icon.mini("settings", "Setup")} Set up Windows</span></span><span class="grow"></span><button class="setup-skip">Skip setup</button></div>
        <div class="oobe-stage">
          <div class="oobe-illus"></div>
          <div class="oobe-content"></div>
        </div>
        ${CORNER}
      </div>`;
  }
  function oobe(contentNode, opts) {
    opts = opts || {};
    ensureOobeChrome();
    // Back button in the breadcrumb
    const crumb = bg.querySelector(".oobe-crumb");
    let back = crumb.querySelector(".oobe-back");
    if (opts.back) { if (!back) { back = el(`<button class="oobe-back">&#8592;</button>`); crumb.insertBefore(back, crumb.firstChild); } back.onclick = opts.back; }
    else if (back) back.remove();
    // Swap illustration + content with a slide-in animation
    const illus = bg.querySelector(".oobe-illus");
    const content = bg.querySelector(".oobe-content");
    illus.innerHTML = opts.illustration || "";
    content.innerHTML = ""; content.appendChild(contentNode);
    illus.classList.remove("oobe-in"); content.classList.remove("oobe-in");
    void content.offsetWidth; // reflow to restart the animation
    illus.classList.add("oobe-in"); content.classList.add("oobe-in");
    wireSkip();
    return bg;
  }

  const ILLUS = {
    globe: `<svg class="il-svg" viewBox="0 0 200 200"><defs><linearGradient id="ilGl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5ec8ff"/><stop offset="1" stop-color="#2f6bff"/></linearGradient></defs><circle cx="100" cy="100" r="72" fill="url(#ilGl)"/><g fill="none" stroke="#fff" stroke-opacity=".65" stroke-width="2.5"><ellipse cx="100" cy="100" rx="30" ry="72"/><ellipse cx="100" cy="100" rx="58" ry="72"/><line x1="28" y1="100" x2="172" y2="100"/><path d="M40 62 H160"/><path d="M40 138 H160"/></g></svg>`,
    gear: `<svg class="il-svg" viewBox="0 0 200 200"><defs><linearGradient id="ilAc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7c5cff"/><stop offset="1" stop-color="#2f6bff"/></linearGradient></defs><circle cx="100" cy="100" r="72" fill="url(#ilAc)"/><circle cx="100" cy="62" r="13" fill="#fff"/><path d="M62 84 H138 M100 84 V132 M100 132 L74 168 M100 132 L126 168" stroke="#fff" stroke-width="9" fill="none" stroke-linecap="round"/></svg>`,
    apps: `<svg class="il-svg il-wide" viewBox="0 0 260 200"><defs><linearGradient id="ilPad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8a5cf6"/><stop offset="1" stop-color="#5b3ee0"/></linearGradient><linearGradient id="ilMus" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff8fc7"/><stop offset="1" stop-color="#e3008c"/></linearGradient><linearGradient id="ilPic" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#43d69a"/><stop offset="1" stop-color="#0a9d6e"/></linearGradient></defs><g transform="translate(24 74) rotate(-8)"><path d="M30 20 Q30 0 55 2 H115 Q140 0 140 20 L152 66 Q158 92 130 92 Q114 92 108 78 L104 68 H66 L62 78 Q56 92 40 92 Q12 92 18 66 Z" fill="url(#ilPad)"/><rect x="42" y="34" width="9" height="27" rx="3" fill="#fff"/><rect x="33" y="43" width="27" height="9" rx="3" fill="#fff"/><circle cx="112" cy="40" r="6" fill="#fff"/><circle cx="128" cy="52" r="6" fill="#fff"/><circle cx="112" cy="64" r="6" fill="#fff"/></g><g transform="translate(150 22)"><rect x="40" y="0" width="10" height="58" rx="5" fill="url(#ilMus)"/><circle cx="30" cy="60" r="15" fill="url(#ilMus)"/><path d="M40 0 q22 4 22 22 V6 q0 -8 -22 -6 Z" fill="url(#ilMus)"/></g><g transform="translate(178 98)"><rect x="0" y="0" width="64" height="52" rx="8" fill="url(#ilPic)"/><circle cx="18" cy="18" r="7" fill="#fff"/><path d="M6 44 L26 24 L40 38 L50 30 L58 44 Z" fill="#fff"/></g></svg>`,
    lock: `<svg class="il-svg" viewBox="0 0 200 200"><defs><linearGradient id="ilLk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5ec8ff"/><stop offset="1" stop-color="#2f6bff"/></linearGradient></defs><path d="M100 20 L160 42 V96 Q160 150 100 178 Q40 150 40 96 V42 Z" fill="url(#ilLk)"/><rect x="76" y="88" width="48" height="40" rx="6" fill="#fff"/><path d="M84 88 V76 a16 16 0 0 1 32 0 V88" fill="none" stroke="#fff" stroke-width="7"/><circle cx="100" cy="104" r="6" fill="#2f6bff"/><rect x="97" y="106" width="6" height="12" rx="3" fill="#2f6bff"/></svg>`,
    finger: `<svg class="il-svg il-fp" viewBox="0 0 200 200" fill="none" stroke="#5ea0ff" stroke-width="6" stroke-linecap="round"><path d="M50 96 q4 -46 50 -46 q46 0 50 46" stroke-opacity=".5"/><path d="M60 120 q0 -55 40 -55 q40 0 40 55"/><path d="M74 128 q0 -40 26 -40 q26 0 26 40"/><path d="M88 134 q0 -26 12 -26 q12 0 12 26 v6"/><path d="M100 108 v34"/></svg>`,
    restore: `<svg class="il-svg" viewBox="0 0 200 200"><defs><linearGradient id="ilBolt" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7a59"/><stop offset="1" stop-color="#e0245e"/></linearGradient></defs><rect x="40" y="40" width="120" height="120" rx="28" fill="url(#ilBolt)"/><path d="M108 62 L78 108 H98 L92 138 L124 90 H104 Z" fill="#fff"/></svg>`,
    cards: `<svg class="il-svg il-wide" viewBox="0 0 260 200"><defs><linearGradient id="ilNote" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8fd3ff"/><stop offset="1" stop-color="#4aa8ff"/></linearGradient></defs><g transform="translate(28 55) rotate(-6)"><rect x="0" y="0" width="78" height="96" rx="8" fill="#fff" stroke="#dfe6f2" stroke-width="2"/><rect x="0" y="0" width="78" height="20" rx="8" fill="url(#ilNote)"/><path d="M12 40 H62 M12 54 H62 M12 68 H46" stroke="#c6d2e6" stroke-width="4" stroke-linecap="round"/><path d="M52 74 l18 -18 8 8 -18 18 -10 2 2 -10Z" fill="#f5a623"/></g><g transform="translate(118 48) rotate(6)"><rect x="0" y="0" width="76" height="104" rx="10" fill="#fff" stroke="#dfe6f2" stroke-width="2"/><path d="M38 24 C58 46 60 58 46 66 C40 70 40 62 40 62 C40 62 40 70 34 70 C20 62 22 46 38 24Z" fill="#1d1d21"/><rect x="34" y="70" width="8" height="14" fill="#1d1d21"/></g><g transform="translate(196 108)"><circle cx="24" cy="24" r="24" fill="#e50914"/><path d="M18 14 L36 24 L18 34 Z" fill="#fff"/></g></svg>`,
  };

  // ---- Region & language ----
  function oobeRegion() {
    const regions = ["United States", "United Kingdom", "Canada", "Australia", "Germany", "France", "Japan", "India", "Brazil", "Mexico"];
    const node = el(`<div>
      <h1>Is this the right country or region?</h1>
      <div class="setup-list oobe-list" id="regionList"></div>
      <div class="field" style="margin-top:14px"><label>Language</label><select id="lang"></select></div>
      <div class="oobe-actions"><button class="btn-primary" id="next">Yes</button></div>
    </div>`);
    const list = node.querySelector("#regionList");
    regions.forEach((r) => {
      const o = el(`<div class="opt">${r}</div>`);
      if (r === (S().region || "United States")) o.classList.add("sel");
      o.onclick = () => { list.querySelectorAll(".opt").forEach((x) => x.classList.remove("sel")); o.classList.add("sel"); S().region = r; };
      list.appendChild(o);
    });
    const langSel = node.querySelector("#lang");
    I18n.languages.forEach((l) => {
      const opt = document.createElement("option");
      opt.value = l.code; opt.textContent = l.name;
      if (l.code === I18n.lang) opt.selected = true;
      langSel.appendChild(opt);
    });
    langSel.onchange = () => { I18n.set(langSel.value); oobeRegion(); };
    node.querySelector("#next").onclick = () => { State.save(); oobeAccessibility(); };
    oobe(node, { illustration: ILLUS.globe });
  }

  // ---- Accessibility ----
  function oobeAccessibility() {
    const node = el(`<div>
      <h1>Make it easier to use your PC</h1>
      <p class="sub">You can change any of this later in Settings.</p>
      <div class="field"><label>Appearance</label>
        <div class="toggle-row" id="themeRow"><button data-v="light">Light</button><button data-v="dark">Dark</button></div></div>
      <div class="field"><label>Text size — <span id="tsVal">${S().textScale}%</span></label>
        <input type="range" id="ts" min="80" max="180" step="10" value="${S().textScale}"></div>
      <div class="field"><label>Touch keyboard</label>
        <div class="toggle-row" id="oskRow"><button data-v="off" class="sel">Off</button><button data-v="on">On</button></div></div>
      <div class="oobe-actions spread"><button class="btn-text" id="later">Skip for now</button><button class="btn-primary" id="setup">Next</button></div>
    </div>`);
    const themeRow = node.querySelector("#themeRow");
    const paintTheme = () => themeRow.querySelectorAll("button").forEach((b) => b.classList.toggle("sel", b.dataset.v === S().theme));
    themeRow.querySelectorAll("button").forEach((b) => b.onclick = () => { S().theme = b.dataset.v; document.body.classList.toggle("dark", S().theme === "dark"); paintTheme(); });
    paintTheme();
    const ts = node.querySelector("#ts"), tsVal = node.querySelector("#tsVal");
    ts.oninput = () => { S().textScale = +ts.value; tsVal.textContent = ts.value + "%"; document.documentElement.style.setProperty("--scale", ts.value / 100); };
    const oskRow = node.querySelector("#oskRow");
    oskRow.querySelectorAll("button").forEach((b) => b.onclick = () => {
      oskRow.querySelectorAll("button").forEach((x) => x.classList.remove("sel")); b.classList.add("sel");
      if (b.dataset.v === "on") OSK.show(); else OSK.hide();
    });
    const go = () => { State.save(); oobeAccount(); };
    node.querySelector("#later").onclick = go;
    node.querySelector("#setup").onclick = go;
    oobe(node, { illustration: ILLUS.gear, back: oobeRegion });
  }

  // ---- Microsoft account ----
  function oobeAccount() {
    const node = el(`<div>
      <h1>Sign in with a Microsoft account</h1>
      <p class="sub">One account connects your device across Microsoft apps and services, like Office, OneDrive, Edge and Store.</p>
      <div class="ms-badge">${msLogo()} Microsoft</div>
      <div class="ms-stage" id="msStage"></div>
    </div>`);
    const stage = node.querySelector("#msStage");
    function emailView() {
      stage.innerHTML = `
        <div class="field"><label>Sign in</label><input type="email" id="email" placeholder="Email, phone, or Skype" value="${S().account ? S().account.email : ""}"></div>
        <p class="ms-links"><span class="link-blue" id="createLink">No account? Create one!</span><br><span class="link-blue">Sign-in options</span></p>
        <div class="oobe-actions spread"><button class="btn-text" id="skip">Skip for now</button><button class="btn-primary" id="next">Next</button></div>`;
      stage.querySelector("#skip").onclick = () => oobeJustAMoment(oobePersonalize);
      stage.querySelector("#createLink").onclick = createView;
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
        <div class="field"><div class="pw-wrap"><input type="password" id="cpw" placeholder="Create a password"><button class="pw-eye" id="ceye">&#128065;</button></div></div>
        <div class="field"><input type="password" id="cpw2" placeholder="Confirm password"></div>
        <div class="error-msg" id="cerr"></div>
        <div class="oobe-actions spread"><button class="btn-text" id="cback">Back to sign in</button><button class="btn-primary" id="ccreate">Create account</button></div>`;
      const cpw = stage.querySelector("#cpw"), cpw2 = stage.querySelector("#cpw2"), cerr = stage.querySelector("#cerr");
      stage.querySelector("#ceye").onclick = () => { const t = cpw.type === "password" ? "text" : "password"; cpw.type = t; cpw2.type = t; };
      stage.querySelector("#cback").onclick = emailView;
      stage.querySelector("#ccreate").onclick = () => {
        const email = stage.querySelector("#cemail").value.trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { cerr.textContent = "Enter a valid email address."; return; }
        if (cpw.value.length < 4) { cerr.textContent = "Password must be at least 4 characters."; return; }
        if (cpw.value !== cpw2.value) { cerr.textContent = "Those passwords don't match."; return; }
        S().account = { email, password: cpw.value, created: true }; State.save();
        oobeJustAMoment(oobePersonalize);
      };
    }
    function pwView(email) {
      stage.innerHTML = `
        <div class="ms-return">&#8592; ${escapeHtml(email)}</div>
        <div class="field"><label>Enter Password</label>
          <div class="pw-wrap"><input type="password" id="pw" placeholder="Password"><button class="pw-eye" id="eye">&#128065;</button></div></div>
        <p class="ms-links"><span class="link-blue">Forgot password?</span><br><span class="link-blue">Email code to ${escapeHtml(email)}</span></p>
        <div class="oobe-actions spread"><button class="btn-text" id="back2">Back</button><button class="btn-primary" id="signin">Next</button></div>`;
      const pw = stage.querySelector("#pw");
      stage.querySelector("#eye").onclick = () => { pw.type = pw.type === "password" ? "text" : "password"; };
      stage.querySelector("#back2").onclick = emailView;
      stage.querySelector("#signin").onclick = () => {
        S().account = { email, password: pw.value }; State.save();
        oobeJustAMoment(oobePersonalize);
      };
    }
    emailView();
    oobe(node, { illustration: ILLUS.apps, back: oobeAccessibility });
  }

  // ---- Just a moment… ----
  function oobeJustAMoment(next) {
    const node = el(`<div class="oobe-moment">
      <div class="moment-tiles"><span></span><span></span><span></span></div>
      <div class="moment-row"><div class="spinner-ring"></div><span>Just a moment…</span></div>
    </div>`);
    oobe(node, {});
    setTimeout(() => next(), 2600);
  }

  // ---- Personalize (username + picture) ----
  function oobePersonalize() {
    const suggested = S().account && S().account.email ? S().account.email.split("@")[0] : "User";
    const node = el(`<div>
      <h1>Personalize your device</h1>
      <p class="sub">Add a name and a picture. You can change these later.</p>
      <div class="center-col"><div class="pic-crop" id="crop"><span class="muted" style="margin:auto">No photo</span></div>
        <button class="btn-text" id="upload">Upload a photo</button></div>
      <div class="field"><label>Your name</label><input type="text" id="uname" value="${escapeHtml(suggested)}"></div>
      <div class="oobe-actions"><button class="btn-primary" id="next">Next</button></div>
    </div>`);
    const crop = node.querySelector("#crop");
    let imgEl = null;
    node.querySelector("#upload").onclick = () => {
      const inp = document.getElementById("globalFileInput");
      inp.accept = "image/*"; inp.value = "";
      inp.onchange = () => {
        const f = inp.files[0]; if (!f) return;
        const reader = new FileReader();
        reader.onload = () => { crop.innerHTML = ""; imgEl = document.createElement("img"); imgEl.src = reader.result; imgEl.style.width = "100%"; imgEl.onload = () => enableDrag(imgEl, crop); crop.appendChild(imgEl); };
        reader.readAsDataURL(f);
      };
      inp.click();
    };
    node.querySelector("#next").onclick = () => {
      const uname = node.querySelector("#uname").value.trim() || "User";
      S().profile = Object.assign({}, S().profile, { picture: imgEl ? captureCrop(imgEl, crop) : (S().profile && S().profile.picture) || null, username: uname });
      State.save();
      oobePin();
    };
    oobe(node, { illustration: ILLUS.apps, back: oobeAccount });
  }

  // ---- Set up a PIN ----
  function oobePin() {
    const node = el(`<div>
      <h1>Set up a PIN</h1>
      <p class="sub">A Windows Hello PIN is a fast, secure way to sign in to your device, Apps and services.</p>
      <div class="field"><div class="pw-wrap"><input type="password" id="pin" placeholder="New PIN" inputmode="numeric"><button class="pw-eye" id="eye">&#128065;</button></div></div>
      <div class="field"><input type="password" id="pin2" placeholder="Confirm PIN" inputmode="numeric"></div>
      <div class="field row" style="gap:8px;align-items:center"><input type="checkbox" id="letters" style="width:auto"><label for="letters" style="margin:0">Include letters and symbols</label></div>
      <div class="error-msg" id="err"></div>
      <div class="oobe-actions"><button class="btn-primary" id="ok">OK</button></div>
    </div>`);
    const pin = node.querySelector("#pin"), pin2 = node.querySelector("#pin2"), err = node.querySelector("#err"), letters = node.querySelector("#letters");
    node.querySelector("#eye").onclick = () => { const tp = pin.type === "password" ? "text" : "password"; pin.type = tp; pin2.type = tp; };
    letters.onchange = () => {
      const mode = letters.checked ? "text" : "numeric";
      pin.inputMode = mode; pin2.inputMode = mode;
      pin.placeholder = letters.checked ? "New password" : "New PIN";
      pin2.placeholder = letters.checked ? "Confirm password" : "Confirm PIN";
    };
    node.querySelector("#ok").onclick = () => {
      const a = pin.value, b = pin2.value;
      if (letters.checked) { if (!a) { err.textContent = "Enter a password."; return; } }
      else if (!/^(\d{4}|\d{6})$/.test(a)) { err.textContent = "PIN must be 4 or 6 digits."; return; }
      if (a !== b) { err.textContent = "The two entries don't match."; return; }
      S().profile = Object.assign({}, S().profile, { authType: letters.checked ? "password" : "pin", secret: a });
      State.save();
      oobeFingerprintIntro();
    };
    oobe(node, { illustration: ILLUS.lock, back: oobePersonalize });
  }

  // ---- Fingerprint (intro → scanning %) ----
  function oobeFingerprintIntro() {
    const node = el(`<div>
      <h1>Windows Hello</h1>
      <p class="sub">Set up a fingerprint so you can sign in with a touch. This is optional.</p>
      <div class="oobe-actions spread"><button class="btn-text" id="skip">Skip for now</button><button class="btn-primary" id="go">Set up</button></div>
    </div>`);
    node.querySelector("#skip").onclick = () => oobeWelcomeBack();
    node.querySelector("#go").onclick = () => oobeFingerprintScan();
    oobe(node, { illustration: ILLUS.finger, back: oobePin });
  }

  function oobeFingerprintScan() {
    const node = el(`<div>
      <h1>Fingerprint</h1>
      <p class="oobe-fp-status"><b>Fingerprint in progress</b></p>
      <p class="sub">Place your finger on the sensor, then lift it off when you feel a vibration.</p>
      <div class="oobe-fp-pct" id="pct">0%</div>
      <div class="oobe-actions"><button class="btn-primary" id="skip">Skip</button></div>
    </div>`);
    const illus = `<div class="fp-anim" id="fp">${ILLUS.finger}</div>`;
    oobe(node, { illustration: illus, back: oobeFingerprintIntro });
    const pctEl = bg.querySelector("#pct"), fp = bg.querySelector("#fp");
    let pct = 0;
    const iv = setInterval(() => {
      pct = Math.min(100, pct + 5 + Math.floor(Math.random() * 8));
      pctEl.textContent = pct + "%";
      if (fp) fp.style.filter = `drop-shadow(0 0 ${pct / 8}px #6cf)`;
      if (pct >= 100) { clearInterval(iv); S().profile = Object.assign({}, S().profile, { fingerprint: true }); State.save(); setTimeout(oobeWelcomeBack, 500); }
    }, 260);
    bg.querySelector("#skip").onclick = () => { clearInterval(iv); oobeWelcomeBack(); };
  }

  // ---- Welcome back / Restore ----
  function oobeWelcomeBack() {
    const name = (S().profile && S().profile.username) || "there";
    const node = el(`<div>
      <h1>Welcome back, ${escapeHtml(name)}!</h1>
      <p class="sub">Your settings and OneDrive files are synced to this PC and you'll get a chance to restore apps from your previous PC once you finish device setup.</p>
      <button class="oobe-choice" id="restore"><b>&#8635; Restore from previous PC</b><span>Last synced recently. Use settings &amp; preferences, sync OneDrive files, and select apps to install from this device.</span></button>
      <button class="oobe-choice" id="fresh"><b>&#128187; Set up as new device</b><span>Choose your apps. You'll still have access to your settings, preferences, and OneDrive files.</span></button>
      <div class="oobe-actions spread"><span class="link-blue">Restore from another device</span><button class="btn-primary" id="next">Next</button></div>
    </div>`);
    let choice = "fresh";
    const restore = node.querySelector("#restore"), fresh = node.querySelector("#fresh");
    const paint = () => { restore.classList.toggle("sel", choice === "restore"); fresh.classList.toggle("sel", choice === "fresh"); };
    restore.onclick = () => { choice = "restore"; paint(); };
    fresh.onclick = () => { choice = "fresh"; paint(); };
    paint();
    node.querySelector("#next").onclick = () => { S().setup = Object.assign({}, S().setup, { restore: choice }); State.save(); oobeCustomize(); };
    oobe(node, { illustration: ILLUS.restore, back: oobeFingerprintIntro });
  }

  // ---- Customize your experience ----
  function oobeCustomize() {
    const svg = (inner, c) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="${c}">${inner}</svg>`;
    const cats = [
      { id: "entertainment", name: "Entertainment", desc: "Watch videos, browse the web, connect on social media", icon: svg('<rect x="2" y="4" width="20" height="14" rx="2"/><path d="M10 8 l6 3 -6 3 z" fill="#fff"/>', "#e50914") },
      { id: "gaming", name: "Gaming", desc: "Play and discover games, keep up with new releases", icon: svg('<path d="M6 8 h12 a5 5 0 0 1 5 5 a3 3 0 0 1 -5.5 1.8 H8.5 A3 3 0 0 1 3 13 a5 5 0 0 1 3 -5 z"/><circle cx="16.5" cy="12" r="1.2" fill="#fff"/><rect x="6" y="11" width="4" height="1.6" fill="#fff"/><rect x="7.2" y="9.8" width="1.6" height="4" fill="#fff"/>', "#7c5cff") },
      { id: "school", name: "School", desc: "Take notes, write essays and collaborate on projects", icon: svg('<path d="M12 4 L22 9 L12 14 L2 9 z"/><path d="M6 11 v4 c0 1.5 3 3 6 3 s6 -1.5 6 -3 v-4" fill="none" stroke="#0a7d3a" stroke-width="1.6"/>', "#0a7d3a") },
      { id: "creativity", name: "Creativity", desc: "Draw, edit photos and make things", icon: svg('<path d="M12 3 a9 9 0 1 0 0 18 c1.5 0 2 -1 2 -2 a2 2 0 0 1 2 -2 h1 a4 4 0 0 0 4 -4 c0 -5 -4 -8 -9 -8 z"/><circle cx="8" cy="10" r="1.3" fill="#fff"/><circle cx="12" cy="7.5" r="1.3" fill="#fff"/><circle cx="16" cy="10" r="1.3" fill="#fff"/>', "#e3008c") },
      { id: "business", name: "Business", desc: "Manage work, email and meetings", icon: svg('<rect x="3" y="8" width="18" height="11" rx="2"/><path d="M9 8 V6 a2 2 0 0 1 2 -2 h2 a2 2 0 0 1 2 2 v2" fill="none" stroke="#0067c0" stroke-width="1.6"/>', "#0067c0") },
    ];
    const chosen = new Set((S().setup && S().setup.categories) || []);
    const node = el(`<div>
      <h1>Customize your experience</h1>
      <p class="sub">Select all the ways you plan to use your device to get customized suggestions for tips, tools, and services. You can change this in Settings.</p>
      <div class="oobe-cats" id="cats"></div>
      <div class="oobe-actions spread"><button class="btn-text" id="skip">Skip</button><button class="btn-primary" id="next">Next</button></div>
    </div>`);
    const catsEl = node.querySelector("#cats");
    cats.forEach((c) => {
      const row = el(`<button class="oobe-cat ${chosen.has(c.id) ? "sel" : ""}"><span class="oobe-cat-ic">${c.icon}</span><span class="oobe-cat-txt"><b>${c.name}</b><span>${c.desc}</span></span><span class="oobe-cat-check">&#10003;</span></button>`);
      row.onclick = () => { if (chosen.has(c.id)) chosen.delete(c.id); else chosen.add(c.id); row.classList.toggle("sel", chosen.has(c.id)); };
      catsEl.appendChild(row);
    });
    const go = () => { S().setup = Object.assign({}, S().setup, { categories: [...chosen] }); State.save(); oobeTime(); };
    node.querySelector("#skip").onclick = go;
    node.querySelector("#next").onclick = go;
    oobe(node, { illustration: ILLUS.cards, back: oobeWelcomeBack });
  }

  // ---- Time ----
  function oobeTime() {
    const node = el(`<div>
      <h1>Set the date and time</h1>
      <p class="sub">Choose how the clock behaves on your device.</p>
      <div class="field"><label>Mode</label>
        <div class="toggle-row" id="modeRow"><button data-v="automatic" class="sel">Automatic</button><button data-v="custom">Custom</button></div></div>
      <div class="field"><label>Clock format</label>
        <div class="toggle-row" id="fmtRow"><button data-v="12" class="sel">12-hour</button><button data-v="24">24-hour</button></div></div>
      <div class="field" id="customWrap" style="display:none"><label>Custom time</label><input type="time" id="customTime"></div>
      <p class="muted" id="preview"></p>
      <div class="oobe-actions"><button class="btn-primary" id="finish">Finish</button></div>
    </div>`);
    let mode = "automatic", fmt24 = false;
    const modeRow = node.querySelector("#modeRow"), fmtRow = node.querySelector("#fmtRow");
    const customWrap = node.querySelector("#customWrap"), preview = node.querySelector("#preview");
    function updatePreview() { const d = new Date(); preview.textContent = "Preview: " + (fmt24 ? d.toTimeString().slice(0, 5) : d.toLocaleTimeString()); }
    modeRow.querySelectorAll("button").forEach((b) => b.onclick = () => { modeRow.querySelectorAll("button").forEach((x) => x.classList.remove("sel")); b.classList.add("sel"); mode = b.dataset.v; customWrap.style.display = mode === "custom" ? "" : "none"; });
    fmtRow.querySelectorAll("button").forEach((b) => b.onclick = () => { fmtRow.querySelectorAll("button").forEach((x) => x.classList.remove("sel")); b.classList.add("sel"); fmt24 = b.dataset.v === "24"; updatePreview(); });
    updatePreview();
    node.querySelector("#finish").onclick = () => {
      S().clock.mode = mode; S().clock.format24 = fmt24;
      if (mode === "custom") { const tv = node.querySelector("#customTime").value || "12:00"; const [h, m] = tv.split(":").map(Number); const base = new Date(); base.setHours(h, m, 0, 0); S().clock.customBaseMs = base.getTime(); S().clock.customSetAt = Date.now(); }
      S().setupCompleted = true; State.save();
      if (window.Achievements) window.Achievements.unlock("welcome");
      finish();
    };
    oobe(node, { illustration: ILLUS.gear, back: oobeCustomize });
  }

  // ============================================================
  //  shared helpers (reused from prior version)
  // ============================================================
  function msLogo() {
    return `<svg width="18" height="18" viewBox="0 0 24 24"><rect x="1" y="1" width="10" height="10" fill="#f25022"/><rect x="13" y="1" width="10" height="10" fill="#7fba00"/><rect x="1" y="13" width="10" height="10" fill="#00a4ef"/><rect x="13" y="13" width="10" height="10" fill="#ffb900"/></svg>`;
  }

  function showKeySheet() {
    const overlay = el(`<div class="modal-mask" style="z-index:9999;overflow:auto;padding:40px">
      <div style="background:#fff;color:#111;max-width:700px;margin:0 auto;padding:30px;border-radius:12px">
        <h2 style="margin-top:0">Windows 12 — Product Key Sheet (100 keys)</h2>
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
        // Fill the activate-key / product-key input if one is on screen.
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

  function enableDrag(img, container) {
    let dragging = false, sx, sy, ox = 0, oy = 0;
    img.style.position = "absolute"; img.style.left = "0px"; img.style.top = "0px";
    img.onmousedown = (e) => { dragging = true; sx = e.clientX; sy = e.clientY; img.style.cursor = "grabbing"; e.preventDefault(); };
    window.addEventListener("mousemove", (e) => { if (!dragging) return; ox += e.clientX - sx; oy += e.clientY - sy; sx = e.clientX; sy = e.clientY; img.style.left = ox + "px"; img.style.top = oy + "px"; });
    window.addEventListener("mouseup", () => { dragging = false; img.style.cursor = "grab"; });
  }

  function captureCrop(img) {
    try {
      const size = 180;
      const canvas = document.createElement("canvas"); canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext("2d");
      const left = parseFloat(img.style.left) || 0, top = parseFloat(img.style.top) || 0;
      ctx.drawImage(img, left, top, img.width, img.height);
      return canvas.toDataURL("image/png");
    } catch (e) { return img.src; }
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
    if (!S().installerDone) installerWelcome();
    else oobeRegion();
  }

  window.Setup = { run };
})();
