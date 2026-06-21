/* Boot sequence: Cameron animation -> disclaimer -> logo morph + spinner -> getting ready. */
(function () {
  "use strict";

  const screen = () => document.getElementById("screen");

  function el(html) {
    const d = document.createElement("div");
    d.innerHTML = html.trim();
    return d.firstElementChild;
  }

  let skip = null;
  function wait(ms) { return Promise.race([new Promise((r) => setTimeout(r, ms)), skip || new Promise(() => {})]); }

  function clearBoot() {
    const layer = document.querySelector(".boot-layer");
    if (layer) layer.remove();
  }

  // Historical Windows logo color sets (4 panes each) to morph through.
  const logoSets = [
    ["#e84d3d", "#7ac143", "#4a90d9", "#f4c20d"], // retro 4-color
    ["#d33", "#3a3", "#36c", "#fb3"],             // XP flag
    ["#2f9be0", "#2f9be0", "#2f9be0", "#2f9be0"], // Win8/10 single blue
    ["#0078d4", "#0078d4", "#0078d4", "#0078d4"], // Win11 blue
  ];

  async function cameron(layer) {
    const word = "CAMERON";
    const wrap = el(`<div class="center-col"><div class="cameron"></div><div class="cameron-sub">SYSTEMS</div></div>`);
    layer.appendChild(wrap);
    const cam = wrap.querySelector(".cameron");
    [...word].forEach((ch, i) => {
      const s = document.createElement("span");
      s.textContent = ch;
      s.style.animationDelay = i * 0.12 + "s";
      cam.appendChild(s);
    });
    await wait(2600);
    wrap.classList.add("fade-out");
    await wait(800);
    wrap.remove();
  }

  async function disclaimer(layer) {
    const d = el(`<div class="disclaimer">Not affiliated with Microsoft</div>`);
    layer.appendChild(d);
    await wait(2200);
    d.classList.add("fade-out");
    await wait(800);
    d.remove();
  }

  const XP_LOGO_SVG = `<svg viewBox="0 0 220 150" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="xpR" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff8546"/><stop offset="1" stop-color="#c81e00"/></linearGradient>
      <linearGradient id="xpG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#aede4d"/><stop offset="1" stop-color="#5a8a0d"/></linearGradient>
      <linearGradient id="xpB" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8aa6ff"/><stop offset="1" stop-color="#1e3aa8"/></linearGradient>
      <linearGradient id="xpY" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe06b"/><stop offset="1" stop-color="#c89500"/></linearGradient>
    </defs>
    <g stroke="#000" stroke-width="1.6" stroke-linejoin="round">
      <path d="M22 24 Q60 8 100 18 Q104 28 102 62 Q70 50 28 64 Q22 50 22 24 Z" fill="url(#xpR)"/>
      <path d="M104 18 Q146 10 190 26 Q198 50 192 70 Q160 56 106 62 Q104 36 104 18 Z" fill="url(#xpG)"/>
      <path d="M22 70 Q60 56 102 70 Q104 100 100 132 Q60 124 22 138 Q18 100 22 70 Z" fill="url(#xpB)"/>
      <path d="M106 70 Q160 60 192 78 Q200 110 192 132 Q150 120 106 132 Q104 100 106 70 Z" fill="url(#xpY)"/>
    </g>
  </svg>`;

  async function xpLogo(layer) {
    const wrap = el(`<div class="center-col" style="gap:18px">
      <div class="xp-logo">${XP_LOGO_SVG}</div>
      <div style="color:#fff;font-size:1.6rem;letter-spacing:.04em;font-family:Tahoma,'Segoe UI',sans-serif">Windows XP</div>
    </div>`);
    layer.appendChild(wrap);
    await wait(2400);
    wrap.classList.add("fade-out");
    await wait(700);
    wrap.remove();
  }

  function paintLogo(logoEl, colors) {
    [...logoEl.children].forEach((pane, i) => { pane.style.background = colors[i]; });
  }

  async function logoMorph(layer) {
    const wrap = el(`<div class="boot-logo-wrap">
      <div class="win-logo">
        <div class="pane"></div><div class="pane"></div>
        <div class="pane"></div><div class="pane"></div>
      </div>
      <svg class="windows-loading-spinner" viewBox="0 0 16 16">
        <circle cx="8" cy="8" r="7"></circle>
      </svg>
    </div>`);
    layer.appendChild(wrap);
    const logo = wrap.querySelector(".win-logo");
    paintLogo(logo, logoSets[0]);

    await wait(400);
    // shrink + move to top-middle
    logo.classList.add("small");
    layer.style.justifyContent = "flex-start";
    layer.style.paddingTop = "8vh";
    await wait(900);

    // morph through logo sets with fade
    for (let i = 1; i < logoSets.length; i++) {
      logo.style.transition = "opacity 0.4s";
      logo.style.opacity = "0.2";
      await wait(420);
      paintLogo(logo, logoSets[i]);
      logo.style.opacity = "1";
      await wait(900);
    }
    // hold with spinner for the rest of ~5s
    await wait(1600);
    wrap.classList.add("fade-out");
    await wait(700);
    wrap.remove();
    layer.style.justifyContent = "center";
    layer.style.paddingTop = "0";
  }

  async function gettingReady(layer) {
    const wrap = el(`<div class="getting-ready">
      <div class="vibrant-logo">
        <div class="glow"></div>
        <div class="core"><div class="pane"></div><div class="pane"></div><div class="pane"></div><div class="pane"></div></div>
      </div>
      <div class="ring"></div>
      <div class="loader word-loader">
        <p>${I18n.t("getting_ready")}</p>
        <div class="words">
          <span class="word">Setting things up</span>
          <span class="word">Installing apps</span>
          <span class="word">Personalizing</span>
          <span class="word">Almost there</span>
          <span class="word">Setting things up</span>
        </div>
      </div>
      <div class="muted" style="margin-top:8px;color:#aaa">${I18n.t("dont_turn_off")}</div>
    </div>`);
    layer.appendChild(wrap);
    await wait(10000); // 10 seconds as requested
    wrap.classList.add("fade-out");
    await wait(700);
    wrap.remove();
  }

  // The very first thing every user sees — a safety notice. Must be acknowledged.
  function safetyWarning(layer) {
    return new Promise((resolve) => {
      const card = el(`<div class="safety-notice">
        <div class="safety-mark">!</div>
        <h1>Before you start</h1>
        <p>This is a <b>pretend computer</b> made for fun. It is <b>not real</b> and is <b>not affiliated with Microsoft</b>.</p>
        <p class="safety-strong">Never type real passwords, real card numbers, or real personal information anywhere in here.</p>
        <p>All money, accounts, and purchases are fake.</p>
        <button class="safety-btn">I understand</button>
      </div>`);
      layer.appendChild(card);
      card.querySelector(".safety-btn").onclick = () => { card.classList.add("fade-out"); setTimeout(() => { card.remove(); resolve(); }, 400); };
    });
  }

  async function run(done) {
    clearBoot();
    const layer = el(`<div class="boot-layer"></div>`);
    screen().appendChild(layer);

    // Safety notice is shown first and is NOT skippable.
    await safetyWarning(layer);

    // Click anywhere to fast-forward the rest of the boot sequence (handy while testing).
    const hint = el(`<div style="position:absolute;bottom:18px;width:100%;text-align:center;color:#555;font-size:.75rem">Click to skip</div>`);
    layer.appendChild(hint);
    skip = new Promise((res) => layer.addEventListener("click", () => res(), { once: true }));

    await cameron(layer);
    await disclaimer(layer);
    await xpLogo(layer);
    await logoMorph(layer);
    await gettingReady(layer);

    layer.remove();
    if (typeof done === "function") done();
  }

  window.Boot = { run };
})();
