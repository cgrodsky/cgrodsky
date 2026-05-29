/* Out-of-box setup experience. Non-closable window over a Win11-style background. */
(function () {
  "use strict";

  const screen = () => document.getElementById("screen");
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }

  let bg, win, onComplete;
  const S = () => State.data;
  const t = (k) => I18n.t(k);

  function mount() {
    bg = el(`<div class="setup-bg"><div class="setup-window"></div></div>`);
    screen().appendChild(bg);
    win = bg.querySelector(".setup-window");
  }

  const TOTAL_STEPS = 6;
  function render(node, step) {
    win.innerHTML = "";
    if (step) {
      const pips = el(`<div class="setup-stepper"></div>`);
      for (let i = 1; i <= TOTAL_STEPS; i++) {
        const cls = i < step ? "done" : i === step ? "current" : "";
        pips.appendChild(el(`<div class="setup-step-pip ${cls}"></div>`));
      }
      win.appendChild(pips);
    }
    const wrap = el(`<div class="setup-step-body"></div>`);
    wrap.appendChild(node);
    win.appendChild(wrap);
  }

  // ---------- Step 1: Region & Language ----------
  function stepRegion() {
    const regions = ["United States", "United Kingdom", "Canada", "Australia", "Germany", "France", "Japan", "India", "Brazil", "Mexico"];
    const node = el(`<div>
      <h1>${t("region_title")}</h1>
      <p class="sub">${t("region_sub")}</p>
      <div class="setup-list" id="regionList"></div>
      <div class="field" style="margin-top:16px">
        <label>${t("language")}</label>
        <select id="lang"></select>
      </div>
      <div class="setup-actions"><button class="btn-primary" id="next">${t("yes")}</button></div>
    </div>`);
    const list = node.querySelector("#regionList");
    regions.forEach((r) => {
      const o = el(`<div class="opt">${r}</div>`);
      if (r === S().region) o.classList.add("sel");
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
    langSel.onchange = () => { I18n.set(langSel.value); stepRegion(); };
    node.querySelector("#next").onclick = () => { State.save(); stepAccessibility(); };
    render(node, 1);
  }

  // ---------- Step 2: Accessibility ----------
  function stepAccessibility() {
    const node = el(`<div>
      <h1>${t("access_title")}</h1>
      <p class="sub">${t("access_sub")}</p>
      <div class="field"><label>${t("appearance")}</label>
        <div class="toggle-row" id="themeRow">
          <button data-v="light">${t("light")}</button>
          <button data-v="dark">${t("dark")}</button>
        </div>
      </div>
      <div class="field"><label>${t("text_size")} — <span id="tsVal">${S().textScale}%</span></label>
        <input type="range" id="ts" min="80" max="180" step="10" value="${S().textScale}">
      </div>
      <div class="field"><label>${t("osk")}</label>
        <div class="toggle-row" id="oskRow">
          <button data-v="off">${t("off")}</button>
          <button data-v="on">${t("on")}</button>
        </div>
      </div>
      <div class="setup-actions spread">
        <button class="btn-text" id="later">${t("later_settings")}</button>
        <button class="btn-primary" id="setup">${t("set_up")}</button>
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
    render(node, 2);
  }

  // ---------- Step 3: Product key ----------
  function stepProductKey() {
    const node = el(`<div>
      <h1>${t("activate_title")}</h1>
      <p class="sub">${t("activate_sub")}</p>
      <div class="field">
        <input type="text" id="key" class="key-input" maxlength="15" placeholder="xxx-xxx-xxx-xxx">
        <div class="error-msg" id="err"></div>
      </div>
      <p><span class="link-blue" id="sheet">${t("view_keys")}</span></p>
      <div class="setup-actions spread">
        <button class="btn-text" id="skip">${t("skip")}</button>
        <button class="btn-primary" id="cont">${t("continue")}</button>
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
      else if (res === "redeemed") err.textContent = t("key_redeemed");
      else err.textContent = t("key_invalid");
    };
    render(node, 3);
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
      <h1>${forced ? t("create_account") : t("signin_account")}</h1>
      <p class="sub">${forced ? t("account_required") : t("account_optional")}</p>
      <div class="field"><label>${t("email")}</label><input type="email" id="email" placeholder="name@example.com"></div>
      <div class="field"><label>${t("password")}</label><input type="password" id="pw" placeholder="${t("password")}"></div>
      <div class="field row">
        <input type="checkbox" id="tos" style="width:auto">
        <span>${t("agree_pre")} <span class="link-blue" id="tosLink">${t("terms")}</span></span>
      </div>
      <div class="error-msg" id="err"></div>
      <div class="setup-actions spread">
        ${forced ? "<span></span>" : `<button class="btn-text" id="skip">${t("skip")}</button>`}
        <button class="btn-primary" id="next" disabled>${t("next")}</button>
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
      if (!email || !pw) { err.textContent = t("email_pw_required"); return; }
      S().account = { email, password: pw };
      State.save();
      stepCustomize();
    };
    render(node, 4);
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
      <h1>${t("make_yours")}</h1>
      <p class="sub">${t("make_yours_sub")}</p>
      <div class="center-col">
        <div class="pic-crop" id="crop"><span class="muted" style="margin:auto">${t("no_photo")}</span></div>
        <button class="btn-text" id="upload">${t("upload_photo")}</button>
      </div>
      <div class="field"><label>${t("username")}</label><input type="text" id="uname" value="User"></div>
      <div class="field"><label>${t("signin_method")}</label>
        <div class="toggle-row" id="authRow"><button data-v="pin" class="sel">${t("pin")}</button><button data-v="password">${t("password")}</button></div>
      </div>
      <div class="field"><label id="secLabel">${t("pin_label")}</label>
        <input type="password" id="secret" placeholder="${t("enter_pin")}"></div>
      <div class="error-msg" id="err"></div>
      <div class="setup-actions"><button class="btn-primary" id="next">${t("next")}</button></div>
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
      if (authType === "pin") { secLabel.textContent = t("pin_label"); secret.placeholder = t("enter_pin"); secret.inputMode = "numeric"; }
      else { secLabel.textContent = t("password"); secret.placeholder = t("enter_password"); secret.inputMode = "text"; }
    });

    node.querySelector("#next").onclick = () => {
      const err = node.querySelector("#err");
      const uname = node.querySelector("#uname").value.trim() || "User";
      const sec = secret.value;
      if (authType === "pin") {
        if (!/^(\d{4}|\d{6})$/.test(sec)) { err.textContent = t("pin_error"); return; }
      } else if (!sec) { err.textContent = t("pw_required"); return; }
      S().profile = {
        picture: imgEl ? captureCrop(imgEl, crop) : null,
        username: uname, authType, secret: sec,
      };
      State.save();
      stepTime();
    };
    render(node, 5);
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
      <h1>${t("datetime_title")}</h1>
      <p class="sub">${t("datetime_sub")}</p>
      <div class="field"><label>${t("mode")}</label>
        <div class="toggle-row" id="modeRow"><button data-v="automatic" class="sel">${t("automatic")}</button><button data-v="custom">${t("custom")}</button></div>
      </div>
      <div class="field"><label>${t("clock_format")}</label>
        <div class="toggle-row" id="fmtRow"><button data-v="12" class="sel">${t("h12")}</button><button data-v="24">${t("h24")}</button></div>
      </div>
      <div class="field" id="customWrap" style="display:none"><label>${t("custom_time")}</label>
        <input type="time" id="customTime"></div>
      <p class="muted" id="preview"></p>
      <div class="setup-actions"><button class="btn-primary" id="finish">${t("finish")}</button></div>
    </div>`);

    let mode = "automatic", fmt24 = false;
    const modeRow = node.querySelector("#modeRow"), fmtRow = node.querySelector("#fmtRow");
    const customWrap = node.querySelector("#customWrap"), preview = node.querySelector("#preview");

    function updatePreview() {
      const d = new Date();
      preview.textContent = t("preview") + ": " + (fmt24 ? d.toTimeString().slice(0, 5) : d.toLocaleTimeString());
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
    render(node, 6);
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
