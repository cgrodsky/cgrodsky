/* Out-of-box setup experience. Non-closable window over a Win11-style background. */
(function () {
  "use strict";

  const screen = () => document.getElementById("screen");
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }

  let bg, win, onComplete;
  const S = () => State.data;

  function mount() {
    bg = el(`<div class="setup-bg"><div class="setup-window"></div></div>`);
    screen().appendChild(bg);
    win = bg.querySelector(".setup-window");
  }

  function render(node) { win.innerHTML = ""; win.appendChild(node); }

  // ---------- Step 1: Region & Language ----------
  function stepRegion() {
    const regions = ["United States", "United Kingdom", "Canada", "Australia", "Germany", "France", "Japan", "India", "Brazil", "Mexico"];
    const node = el(`<div>
      <h1>Is this the right country or region?</h1>
      <p class="sub">Windows 12 supports a single language and will translate everything for you.</p>
      <div class="setup-list" id="regionList"></div>
      <div class="field" style="margin-top:16px">
        <label>Language</label>
        <select id="lang"><option>English (United States)</option></select>
      </div>
      <div class="setup-actions"><button class="btn-primary" id="next">Yes</button></div>
    </div>`);
    const list = node.querySelector("#regionList");
    regions.forEach((r) => {
      const o = el(`<div class="opt">${r}</div>`);
      if (r === S().region) o.classList.add("sel");
      o.onclick = () => { list.querySelectorAll(".opt").forEach((x) => x.classList.remove("sel")); o.classList.add("sel"); S().region = r; };
      list.appendChild(o);
    });
    node.querySelector("#next").onclick = () => { State.save(); stepAccessibility(); };
    render(node);
  }

  // ---------- Step 2: Accessibility ----------
  function stepAccessibility() {
    const node = el(`<div>
      <h1>Accessibility settings</h1>
      <p class="sub">Set things up now, or skip and change them later in Settings.</p>
      <div class="field"><label>Appearance</label>
        <div class="toggle-row" id="themeRow">
          <button data-v="light">Light</button>
          <button data-v="dark">Dark</button>
        </div>
      </div>
      <div class="field"><label>Text size — <span id="tsVal">${S().textScale}%</span></label>
        <input type="range" id="ts" min="80" max="180" step="10" value="${S().textScale}">
      </div>
      <div class="field"><label>On-screen keyboard</label>
        <div class="toggle-row" id="oskRow">
          <button data-v="off">Off</button>
          <button data-v="on">On</button>
        </div>
      </div>
      <div class="setup-actions spread">
        <button class="btn-text" id="later">Later in settings</button>
        <button class="btn-primary" id="setup">Set up</button>
      </div>
    </div>`);

    const themeRow = node.querySelector("#themeRow");
    function paintTheme() { themeRow.querySelectorAll("button").forEach((b) => b.classList.toggle("sel", b.dataset.v === S().theme)); }
    themeRow.querySelectorAll("button").forEach((b) => b.onclick = () => { S().theme = b.dataset.v; document.body.classList.toggle("dark", S().theme === "dark"); paintTheme(); });
    paintTheme();

    const ts = node.querySelector("#ts"), tsVal = node.querySelector("#tsVal");
    ts.oninput = () => { S().textScale = +ts.value; tsVal.textContent = ts.value + "%"; document.documentElement.style.setProperty("--scale", ts.value / 100); };

    const oskRow = node.querySelector("#oskRow");
    oskRow.querySelectorAll("button").forEach((b) => b.onclick = () => {
      oskRow.querySelectorAll("button").forEach((x) => x.classList.remove("sel")); b.classList.add("sel");
      if (b.dataset.v === "on") OSK.show(); else OSK.hide();
    });
    oskRow.querySelector('[data-v="off"]').classList.add("sel");

    const go = () => { State.save(); stepProductKey(); };
    node.querySelector("#later").onclick = go;
    node.querySelector("#setup").onclick = go;
    render(node);
  }

  // ---------- Step 3: Product key ----------
  function stepProductKey() {
    const node = el(`<div>
      <h1>Activate Windows</h1>
      <p class="sub">Do you have a product key? Enter it now, or skip and activate later.</p>
      <div class="field">
        <input type="text" id="key" class="key-input" maxlength="15" placeholder="xxx-xxx-xxx-xxx">
        <div class="error-msg" id="err"></div>
      </div>
      <p><span class="link-blue" id="sheet">View the 100-key sheet</span></p>
      <div class="setup-actions spread">
        <button class="btn-text" id="skip">Skip</button>
        <button class="btn-primary" id="cont">Continue</button>
      </div>
    </div>`);

    const key = node.querySelector("#key"), err = node.querySelector("#err");
    key.addEventListener("input", () => {
      let v = key.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
      key.value = v.replace(/(.{3})/g, "$1-").replace(/-$/, "");
      err.textContent = "";
    });

    node.querySelector("#sheet").onclick = () => showKeySheet();

    node.querySelector("#skip").onclick = () => { S().hasProductKey = false; State.save(); stepAccount(false); };
    node.querySelector("#cont").onclick = () => {
      const res = State.validateKey(key.value);
      if (res === "valid") { State.redeemKey(key.value); stepAccount(true); }
      else if (res === "redeemed") err.textContent = "Product Key Already Redeemed";
      else err.textContent = "Invalid Key";
    };
    render(node);
  }

  function showKeySheet() {
    const overlay = el(`<div class="modal-mask" style="z-index:9999;overflow:auto;padding:40px">
      <div style="background:#fff;color:#111;max-width:700px;margin:0 auto;padding:30px;border-radius:12px">
        <h2 style="margin-top:0">Windows 12 — Product Key Sheet (100 keys)</h2>
        <p style="color:#666">Each key works once. After use it becomes "Already Redeemed".</p>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-family:monospace;font-size:13px"></div>
        <div style="text-align:right;margin-top:16px"><button class="pill-btn" id="closeSheet">Close</button></div>
      </div></div>`);
    const grid = overlay.querySelector("div[style*='grid']");
    State.VALID_KEYS.forEach((k, i) => {
      const used = S().redeemedKeys.includes(k);
      grid.appendChild(el(`<div style="${used ? "color:#c00;text-decoration:line-through" : ""}">${(i + 1).toString().padStart(3, "0")}. ${k}</div>`));
    });
    overlay.querySelector("#closeSheet").onclick = () => overlay.remove();
    screen().appendChild(overlay);
  }

  // ---------- Step 4: Account ----------
  function stepAccount(forced) {
    const node = el(`<div>
      <h1>${forced ? "Create your account" : "Sign in to your account"}</h1>
      <p class="sub">${forced ? "An account is required to finish activating Windows." : "Add an account, or skip for now."}</p>
      <div class="field"><label>Email</label><input type="email" id="email" placeholder="name@example.com"></div>
      <div class="field"><label>Password</label><input type="password" id="pw" placeholder="Password"></div>
      <div class="field row">
        <input type="checkbox" id="tos" style="width:auto">
        <span>I agree to the <span class="link-blue" id="tosLink">terms of service</span></span>
      </div>
      <div class="error-msg" id="err"></div>
      <div class="setup-actions spread">
        ${forced ? "<span></span>" : '<button class="btn-text" id="skip">Skip</button>'}
        <button class="btn-primary" id="next" disabled>Next</button>
      </div>
    </div>`);

    const tos = node.querySelector("#tos"), next = node.querySelector("#next"), err = node.querySelector("#err");
    tos.onchange = () => { next.disabled = !tos.checked; };

    node.querySelector("#tosLink").onclick = (e) => {
      const link = e.target; link.classList.add("flash");
      setTimeout(() => { link.classList.remove("flash"); openTermsBrowser(); }, 350);
    };

    if (!forced) node.querySelector("#skip").onclick = () => { stepCustomize(); };

    next.onclick = () => {
      const email = node.querySelector("#email").value.trim();
      const pw = node.querySelector("#pw").value;
      if (!email || !pw) { err.textContent = "Email and password are required."; return; }
      S().account = { email, password: pw };
      State.save();
      stepCustomize();
    };
    render(node);
  }

  function openTermsBrowser() {
    const overlay = el(`<div class="modal-mask" style="z-index:9999;display:flex;align-items:center;justify-content:center">
      <div class="win" style="width:min(820px,92vw);height:min(560px,86vh);position:relative">
        <div class="win-titlebar"><div class="title">${Icon.mini("browser", "Edge")} Edge</div>
          <div class="win-controls"><button class="close" title="Close">&#215;</button></div></div>
        <div class="browser-bar">
          <button id="rl" title="Reload">&#8635;</button>
          <div class="addr locked"><span class="muted" style="font-size:.72rem">Secure</span><input value="https://windows12.local/terms" readonly></div>
        </div>
        <div class="win-body"><div class="site" id="termsBody"></div></div>
      </div></div>`);
    const body = overlay.querySelector("#termsBody");
    const renderTerms = () => { body.innerHTML = `
      <h1>Windows 12 — Terms of Service</h1>
      <p class="muted">Last updated: today (in simulation time)</p>
      <p>This is a simulated operating system created for fun and learning. It is <b>not affiliated with Microsoft</b>. By using it you agree that:</p>
      <ul>
        <li>All money, purchases, accounts and "cloud" features are simulated.</li>
        <li>No real products are delivered and no real money changes hands.</li>
        <li>Your data stays in this browser's local storage.</li>
        <li>You will have a good time.</li>
      </ul>
      <p>Thank you for reading. Close this window to go back.</p>`; };
    renderTerms();
    overlay.querySelector("#rl").onclick = renderTerms;
    overlay.querySelector(".close").onclick = () => overlay.remove();
    screen().appendChild(overlay);
  }

  // ---------- Step 5: Customize (profile picture + username + pin/password) ----------
  function stepCustomize() {
    const node = el(`<div>
      <h1>Make it yours</h1>
      <p class="sub">Add a profile picture and a username, then choose how you'll sign in.</p>
      <div class="center-col">
        <div class="pic-crop" id="crop"><span class="muted" style="margin:auto">No photo</span></div>
        <button class="btn-text" id="upload">Upload a photo</button>
      </div>
      <div class="field"><label>Username</label><input type="text" id="uname" value="User"></div>
      <div class="field"><label>Sign-in method</label>
        <div class="toggle-row" id="authRow"><button data-v="pin" class="sel">PIN</button><button data-v="password">Password</button></div>
      </div>
      <div class="field"><label id="secLabel">PIN (4 or 6 digits)</label>
        <input type="password" id="secret" placeholder="Enter PIN"></div>
      <div class="error-msg" id="err"></div>
      <div class="setup-actions"><button class="btn-primary" id="next">Next</button></div>
    </div>`);

    // picture upload + drag crop
    const crop = node.querySelector("#crop");
    let imgEl = null;
    node.querySelector("#upload").onclick = () => {
      const inp = document.getElementById("globalFileInput");
      inp.accept = "image/*"; inp.value = "";
      inp.onchange = () => {
        const f = inp.files[0]; if (!f) return;
        const reader = new FileReader();
        reader.onload = () => {
          crop.innerHTML = "";
          imgEl = document.createElement("img");
          imgEl.src = reader.result;
          imgEl.style.width = "100%";
          imgEl.onload = () => enableDrag(imgEl, crop);
          crop.appendChild(imgEl);
        };
        reader.readAsDataURL(f);
      };
      inp.click();
    };

    let authType = "pin";
    const authRow = node.querySelector("#authRow");
    const secLabel = node.querySelector("#secLabel"), secret = node.querySelector("#secret");
    authRow.querySelectorAll("button").forEach((b) => b.onclick = () => {
      authRow.querySelectorAll("button").forEach((x) => x.classList.remove("sel")); b.classList.add("sel");
      authType = b.dataset.v;
      if (authType === "pin") { secLabel.textContent = "PIN (4 or 6 digits)"; secret.placeholder = "Enter PIN"; secret.inputMode = "numeric"; }
      else { secLabel.textContent = "Password"; secret.placeholder = "Enter password"; secret.inputMode = "text"; }
    });

    node.querySelector("#next").onclick = () => {
      const err = node.querySelector("#err");
      const uname = node.querySelector("#uname").value.trim() || "User";
      const sec = secret.value;
      if (authType === "pin") {
        if (!/^(\d{4}|\d{6})$/.test(sec)) { err.textContent = "PIN must be exactly 4 or 6 digits."; return; }
      } else if (!sec) { err.textContent = "Password is required."; return; }
      S().profile = {
        picture: imgEl ? captureCrop(imgEl, crop) : null,
        username: uname, authType, secret: sec,
      };
      State.save();
      stepTime();
    };
    render(node);
  }

  function enableDrag(img, container) {
    let dragging = false, sx, sy, ox = 0, oy = 0;
    img.style.position = "absolute"; img.style.left = "0px"; img.style.top = "0px";
    img.onmousedown = (e) => { dragging = true; sx = e.clientX; sy = e.clientY; img.style.cursor = "grabbing"; e.preventDefault(); };
    window.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      ox += e.clientX - sx; oy += e.clientY - sy; sx = e.clientX; sy = e.clientY;
      img.style.left = ox + "px"; img.style.top = oy + "px";
    });
    window.addEventListener("mouseup", () => { dragging = false; img.style.cursor = "grab"; });
  }

  function captureCrop(img, container) {
    try {
      const size = 180;
      const canvas = document.createElement("canvas");
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext("2d");
      const left = parseFloat(img.style.left) || 0, top = parseFloat(img.style.top) || 0;
      ctx.drawImage(img, left, top, img.width, img.height);
      return canvas.toDataURL("image/png");
    } catch (e) { return img.src; }
  }

  // ---------- Step 6: Time ----------
  function stepTime() {
    const node = el(`<div>
      <h1>Date & time</h1>
      <p class="sub">Set automatically, or choose a custom time.</p>
      <div class="field"><label>Mode</label>
        <div class="toggle-row" id="modeRow"><button data-v="automatic" class="sel">Automatic</button><button data-v="custom">Custom</button></div>
      </div>
      <div class="field"><label>Clock format</label>
        <div class="toggle-row" id="fmtRow"><button data-v="12" class="sel">12-hour</button><button data-v="24">24-hour</button></div>
      </div>
      <div class="field" id="customWrap" style="display:none"><label>Custom time</label>
        <input type="time" id="customTime"></div>
      <p class="muted" id="preview"></p>
      <div class="setup-actions"><button class="btn-primary" id="finish">Finish</button></div>
    </div>`);

    let mode = "automatic", fmt24 = false;
    const modeRow = node.querySelector("#modeRow"), fmtRow = node.querySelector("#fmtRow");
    const customWrap = node.querySelector("#customWrap"), preview = node.querySelector("#preview");

    function updatePreview() {
      const d = new Date();
      preview.textContent = "Preview: " + (fmt24 ? d.toTimeString().slice(0, 5) : d.toLocaleTimeString());
    }
    modeRow.querySelectorAll("button").forEach((b) => b.onclick = () => {
      modeRow.querySelectorAll("button").forEach((x) => x.classList.remove("sel")); b.classList.add("sel");
      mode = b.dataset.v; customWrap.style.display = mode === "custom" ? "" : "none";
    });
    fmtRow.querySelectorAll("button").forEach((b) => b.onclick = () => {
      fmtRow.querySelectorAll("button").forEach((x) => x.classList.remove("sel")); b.classList.add("sel");
      fmt24 = b.dataset.v === "24"; updatePreview();
    });
    updatePreview();

    node.querySelector("#finish").onclick = () => {
      S().clock.mode = mode;
      S().clock.format24 = fmt24;
      if (mode === "custom") {
        const t = node.querySelector("#customTime").value || "12:00";
        const [h, m] = t.split(":").map(Number);
        const base = new Date(); base.setHours(h, m, 0, 0);
        S().clock.customBaseMs = base.getTime();
        S().clock.customSetAt = Date.now();
      }
      S().setupCompleted = true;
      State.save();
      finish();
    };
    render(node);
  }

  function finish() {
    bg.classList.add("fade-out");
    setTimeout(() => { bg.remove(); if (onComplete) onComplete(); }, 700);
  }

  function run(done) {
    onComplete = done;
    document.body.classList.toggle("dark", S().theme === "dark");
    document.documentElement.style.setProperty("--scale", S().textScale / 100);
    mount();
    stepRegion();
  }

  window.Setup = { run };
})();
