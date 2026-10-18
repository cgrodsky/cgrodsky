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

  function paintLogo(logoEl, colors) {
    [...logoEl.children].forEach((pane, i) => { pane.style.background = colors[i]; });
  }

  async function logoMorph(layer) {
    const wrap = el(`<div class="boot-logo-wrap">
      <div class="win-logo">
        <div class="pane"></div><div class="pane"></div>
        <div class="pane"></div><div class="pane"></div>
      </div>
      <div class="boot-spin-wrap"></div>
    </div>`);
    layer.appendChild(wrap);
    const logo = wrap.querySelector(".win-logo");
    const spinWrap = wrap.querySelector(".boot-spin-wrap");
    paintLogo(logo, logoSets[0]);

    // build 8-dot spinner
    for (let i = 0; i < 8; i++) {
      const dot = document.createElement("div");
      const ang = (i / 8) * Math.PI * 2;
      dot.style.left = 19 + Math.cos(ang) * 18 + "px";
      dot.style.top = 19 + Math.sin(ang) * 18 + "px";
      dot.style.animationDelay = (i / 8) * 1.2 + "s";
      dot.style.position = "absolute";
      dot.style.width = "6px"; dot.style.height = "6px";
      dot.style.borderRadius = "50%"; dot.style.background = "#fff";
      dot.style.animation = "spinDots 1.2s linear infinite";
      dot.style.animationDelay = (i / 8) * 1.2 + "s";
      spinWrap.appendChild(dot);
    }

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
      <div style="font-size:1.3rem">${I18n.t("getting_ready")}</div>
      <div class="muted" style="margin-top:8px;color:#aaa">${I18n.t("dont_turn_off")}</div>
    </div>`);
    layer.appendChild(wrap);
    await wait(10000); // 10 seconds as requested
    wrap.classList.add("fade-out");
    await wait(700);
    wrap.remove();
  }

  async function run(done) {
    clearBoot();
    const layer = el(`<div class="boot-layer"></div>`);
    screen().appendChild(layer);

    // Click anywhere to fast-forward the boot sequence (handy while testing).
    const hint = el(`<div style="position:absolute;bottom:18px;width:100%;text-align:center;color:#555;font-size:.75rem">Click to skip</div>`);
    layer.appendChild(hint);
    skip = new Promise((res) => layer.addEventListener("click", () => res(), { once: true }));

    await cameron(layer);
    await disclaimer(layer);
    await logoMorph(layer);
    await gettingReady(layer);

    layer.remove();
    if (typeof done === "function") done();
  }

  window.Boot = { run };
})();
