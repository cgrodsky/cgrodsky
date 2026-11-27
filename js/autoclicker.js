/* Auto Clicker (OP) — a rapid auto-clicker for the Windows 12 sim.
   You set a fixed click point (its own cursor marker, drawn inverted so it shows on any
   background); the clicker clicks THERE at up to 200 clicks/second, so it keeps clicking the
   same spot while your real mouse is free to do other things. (A "Follow mouse" option can
   make it track the pointer instead.) Toggle with the Start button or F6. Point it at the
   Microsoft Store's "Get" / price button and it buys apps — which still spends the sim's
   balance, so it's "not actually free", just automated. It clicks real sim UI only; it
   never leaves the page and does nothing to your real device. */
(function () {
  "use strict";
  if (window.AutoClicker) return;

  function el(html) { const d = document.createElement("div"); d.innerHTML = String(html).trim(); return d.firstElementChild; }
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  try {
    if (window.Icon && Icon.register) {
      Icon.register("autoclicker", `<svg viewBox="0 0 48 48" width="100%" height="100%"><rect x="4" y="4" width="40" height="40" rx="9" fill="#1f6feb"/><path d="M17 13l15 7-6 2 5 8-3 2-5-8-4 5z" fill="#fff"/><path d="M33 12l4-2M36 18l4 0M33 24l4 2" stroke="#ffd34d" stroke-width="2.4" stroke-linecap="round"/></svg>`);
    }
  } catch (e) {}

  const cfg = () => {
    State.data.appData = State.data.appData || {};
    return (State.data.appData.autoclicker = Object.assign({ cps: 25, limit: 0, follow: false }, State.data.appData.autoclicker));
  };

  let running = false, timer = 0, count = 0;
  let mx = innerWidth / 2, my = innerHeight / 2;     // live pointer
  let tx = null, ty = null;                           // fixed click point
  let marker = null, arming = false, badge = null, panels = [];

  function track(e) {
    const t = e.touches && e.touches[0];
    mx = t ? t.clientX : e.clientX; my = t ? t.clientY : e.clientY;
  }
  addEventListener("mousemove", track, true);
  addEventListener("touchmove", track, true);
  addEventListener("pointermove", track, true);

  // ---- the fixed click point marker (an inverted cursor) ----
  function placeMarker(x, y) {
    tx = x; ty = y;
    if (!marker) {
      marker = el(`<div class="ac-marker gbs-skip" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="26" height="26"><path d="M4 2l15 8.5-6.3 1.4 4 7.1-2.8 1.6-4-7.1L4 18z" fill="#fff" stroke="#000" stroke-width="1"/></svg>
        <span class="ac-marker-ring"></span></div>`);
      document.body.appendChild(marker);
    }
    marker.style.left = x + "px"; marker.style.top = y + "px";
    marker.classList.remove("ac-hide");
    panels.forEach(syncPanel);
  }
  function clearMarker() { tx = ty = null; if (marker) marker.classList.add("ac-hide"); panels.forEach(syncPanel); }

  function armTarget() {
    if (arming) return;
    arming = true;
    document.body.classList.add("ac-arming");
    const hint = el(`<div class="ac-arm-hint gbs-skip">Tap where you want it to click</div>`);
    document.body.appendChild(hint);
    const onDown = (e) => {
      // ignore clicks on our own window / badge / this hint
      if (e.target.closest(".ac-win, .ac-badge, .ac-arm-hint")) return;
      e.preventDefault(); e.stopPropagation();
      const t = e.touches && e.touches[0];
      placeMarker(t ? t.clientX : e.clientX, t ? t.clientY : e.clientY);
      done();
    };
    const done = () => {
      arming = false; document.body.classList.remove("ac-arming");
      hint.remove();
      removeEventListener("pointerdown", onDown, true);
      removeEventListener("keydown", onEsc, true);
    };
    const onEsc = (e) => { if (e.key === "Escape") { e.preventDefault(); done(); } };
    addEventListener("pointerdown", onDown, true);
    addEventListener("keydown", onEsc, true);
  }

  function clickAt(x, y) {
    const target = document.elementFromPoint(x, y);
    if (!target) return false;
    if (target.closest(".ac-win, .ac-badge, .ac-marker, .ac-arm-hint")) return false;
    const opts = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, view: window, button: 0 };
    try {
      target.dispatchEvent(new PointerEvent("pointerdown", Object.assign({ pointerId: 1, pointerType: "mouse", isPrimary: true }, opts)));
      target.dispatchEvent(new MouseEvent("mousedown", opts));
      target.dispatchEvent(new PointerEvent("pointerup", Object.assign({ pointerId: 1, pointerType: "mouse", isPrimary: true }, opts)));
      target.dispatchEvent(new MouseEvent("mouseup", opts));
      target.dispatchEvent(new MouseEvent("click", opts));
    } catch (e) { return false; }
    return true;
  }

  function start() {
    if (running) return;
    const c = cfg();
    // In fixed-point mode, drop the marker at the current pointer if none is set yet.
    if (!c.follow && tx == null) placeMarker(mx, my);
    running = true; count = 0;
    showBadge();
    const interval = clamp(Math.round(1000 / clamp(c.cps || 25, 1, 200)), 5, 1000);
    timer = setInterval(() => {
      const c2 = cfg();
      const x = c2.follow ? mx : (tx == null ? mx : tx);
      const y = c2.follow ? my : (ty == null ? my : ty);
      clickAt(x, y); count++;
      updateBadge(); panels.forEach(syncPanel);
      if (c2.limit && count >= c2.limit) stop();
    }, interval);
    panels.forEach(syncPanel);
  }
  function stop() {
    if (!running) return;
    running = false; clearInterval(timer); timer = 0;
    hideBadge(); panels.forEach(syncPanel);
  }
  const toggle = () => (running ? stop() : start());

  function showBadge() {
    if (badge) return;
    badge = el(`<div class="ac-badge gbs-skip" role="status">⚡ Auto Clicker <b class="ac-badge-n">0</b> · F6 to stop</div>`);
    document.body.appendChild(badge);
  }
  function updateBadge() { if (badge) { const n = badge.querySelector(".ac-badge-n"); if (n) n.textContent = count; } }
  function hideBadge() { if (badge) { badge.remove(); badge = null; } }

  function syncPanel(p) {
    if (!p.isConnected) return;
    const btn = p.querySelector(".ac-start");
    if (btn) { btn.textContent = running ? "Stop (F6)" : "Start (F6)"; btn.classList.toggle("ac-on", running); }
    const cnt = p.querySelector(".ac-count"); if (cnt) cnt.textContent = count + " click" + (count === 1 ? "" : "s");
    const tgt = p.querySelector(".ac-target"); if (tgt) tgt.textContent = cfg().follow ? "Following the mouse" : (tx == null ? "No click point set" : "Click point: " + Math.round(tx) + ", " + Math.round(ty));
    const fol = p.querySelector(".ac-follow"); if (fol) fol.checked = !!cfg().follow;
    const setb = p.querySelector(".ac-setpoint"); if (setb) setb.disabled = !!cfg().follow;
  }

  function open() {
    const ref = WM.createWindow({ title: "Auto Clicker", icon: Icon.mini("autoclicker", "Auto Clicker"), width: Math.min(430, innerWidth - 24), height: Math.min(520, innerHeight - 90), appId: "autoclicker" });
    const body = ref.body || ref.content || (ref.el && ref.el.querySelector(".win-body"));
    const c = cfg();
    const root = el(`
      <div class="ac-win">
        <div class="ac-title">⚡ OP Auto Clicker</div>
        <label class="ac-row"><span>Clicks per second</span><input class="ac-cps" type="number" min="1" max="200" value="${c.cps}"></label>
        <div class="ac-presets">
          <button data-cps="10">10</button><button data-cps="25">25</button><button data-cps="50">50</button><button data-cps="100">100</button><button data-cps="200">OP (200)</button>
        </div>
        <label class="ac-row"><span>Stop after (0 = never)</span><input class="ac-limit" type="number" min="0" max="100000" value="${c.limit}"></label>
        <div class="ac-point">
          <button class="ac-setpoint" type="button">📍 Set click point</button>
          <div class="ac-target">No click point set</div>
        </div>
        <label class="ac-followrow"><input class="ac-follow" type="checkbox"${c.follow ? " checked" : ""}> Follow the mouse instead</label>
        <button class="ac-start">Start (F6)</button>
        <div class="ac-count">0 clicks</div>
        <div class="ac-help">Press <b>Set click point</b> and tap where you want it to click — a little inverted cursor marks the spot. It clicks <b>there</b>, so your mouse is free. Point it at the Store's <b>Get</b> button to auto-buy (it still spends your sim balance). <b>F6</b> starts/stops.</div>
      </div>`);
    body.appendChild(root);
    panels.push(root);
    const cps = root.querySelector(".ac-cps"), lim = root.querySelector(".ac-limit");
    cps.onchange = () => { c.cps = clamp(+cps.value || 25, 1, 200); cps.value = c.cps; State.save(); if (running) { stop(); start(); } };
    lim.onchange = () => { c.limit = clamp(+lim.value || 0, 0, 100000); lim.value = c.limit; State.save(); };
    root.querySelectorAll(".ac-presets button").forEach((b) => b.onclick = () => { c.cps = +b.dataset.cps; cps.value = c.cps; State.save(); if (running) { stop(); start(); } });
    root.querySelector(".ac-setpoint").onclick = armTarget;
    root.querySelector(".ac-follow").onchange = (e) => { c.follow = e.target.checked; State.save(); if (c.follow && marker) marker.classList.add("ac-hide"); else if (!c.follow && tx != null) marker && marker.classList.remove("ac-hide"); panels.forEach(syncPanel); };
    root.querySelector(".ac-start").onclick = toggle;
    syncPanel(root);
    return ref;
  }

  addEventListener("keydown", (e) => {
    if (e.key === "F6" && !/^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || "")) { e.preventDefault(); toggle(); }
  }, true);

  if (window.AppRegistry) AppRegistry.autoclicker = function () { return open(); };
  try {
    if (window.Catalog && Catalog.storeApps && !Catalog.storeApps.find((a) => a.id === "autoclicker"))
      Catalog.storeApps.push({ id: "autoclicker", name: "Auto Clicker", cat: "Utilities", price: 0, builtin: "autoclicker", desc: "An OP auto-clicker: set a fixed click point and it clicks there up to 200 times a second (your mouse stays free), toggled with F6. Point it at the Store's Get button to auto-buy apps (it still spends your sim balance)." });
    const ex = (window.EXTRA_DEFAULT_APPS = window.EXTRA_DEFAULT_APPS || []);
    if (ex.indexOf("autoclicker") < 0) ex.push("autoclicker");
  } catch (e) {}

  window.AutoClicker = { start, stop, toggle, open, setPoint: placeMarker, armTarget, clearPoint: clearMarker, setCps: (n) => { cfg().cps = clamp(n, 1, 200); State.save(); }, running: () => running };
})();
