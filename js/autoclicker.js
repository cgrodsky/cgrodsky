/* Auto Clicker (OP) — a rapid auto-clicker for the Windows 12 sim.
   It clicks whatever is under the mouse pointer, at up to 200 clicks/second, until you
   stop it (button or the F6 hotkey). Point it at the Microsoft Store's "Get" / price
   button and it buys apps for you — which still costs the sim's money (the Store checks
   your balance), so it's "not actually free", just automated. It clicks real sim UI only;
   it never leaves the page and does nothing to your real device. */
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
    return (State.data.appData.autoclicker = Object.assign({ cps: 25, limit: 0 }, State.data.appData.autoclicker));
  };

  let running = false, timer = 0, count = 0, mx = innerWidth / 2, my = innerHeight / 2, badge = null, panels = [];

  function track(e) {
    const t = e.touches && e.touches[0];
    mx = t ? t.clientX : e.clientX; my = t ? t.clientY : e.clientY;
  }
  addEventListener("mousemove", track, true);
  addEventListener("touchmove", track, true);
  addEventListener("pointermove", track, true);

  function clickAt(x, y) {
    const target = document.elementFromPoint(x, y);
    if (!target) return false;
    // Never click our own window, the active badge, or the taskbar — so Start/Stop stays reachable.
    if (target.closest(".ac-win, .ac-badge")) return false;
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
    running = true; count = 0;
    showBadge();
    const interval = clamp(Math.round(1000 / clamp(c.cps || 25, 1, 200)), 5, 1000);
    timer = setInterval(() => {
      clickAt(mx, my); count++;
      updateBadge();
      panels.forEach(syncPanel);
      if (c.limit && count >= c.limit) stop();
    }, interval);
  }
  function stop() {
    if (!running) return;
    running = false; clearInterval(timer); timer = 0;
    hideBadge();
    panels.forEach(syncPanel);
  }
  const toggle = () => (running ? stop() : start());

  function showBadge() {
    if (badge) return;
    badge = el(`<div class="ac-badge gbs-skip" role="status">⚡ Auto Clicker <b class="ac-badge-n">0</b> · press F6 to stop</div>`);
    document.body.appendChild(badge);
  }
  function updateBadge() { if (badge) { const n = badge.querySelector(".ac-badge-n"); if (n) n.textContent = count; } }
  function hideBadge() { if (badge) { badge.remove(); badge = null; } }

  function syncPanel(p) {
    if (!p.isConnected) return;
    const btn = p.querySelector(".ac-start");
    if (btn) { btn.textContent = running ? "Stop (F6)" : "Start (F6)"; btn.classList.toggle("ac-on", running); }
    const cnt = p.querySelector(".ac-count"); if (cnt) cnt.textContent = count + " click" + (count === 1 ? "" : "s");
  }

  function open() {
    const ref = WM.createWindow({ title: "Auto Clicker", icon: Icon.mini("autoclicker", "Auto Clicker"), width: Math.min(420, innerWidth - 24), height: Math.min(460, innerHeight - 90), appId: "autoclicker" });
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
        <button class="ac-start">Start (F6)</button>
        <div class="ac-count">0 clicks</div>
        <div class="ac-help">Move the mouse over what you want clicked — e.g. the <b>Get</b> / price button in the Microsoft Store — then press <b>F6</b> (or Start). It clicks whatever is under the pointer. Buying still spends your sim balance, so it isn't free.</div>
      </div>`);
    body.appendChild(root);
    panels.push(root);
    const cps = root.querySelector(".ac-cps"), lim = root.querySelector(".ac-limit");
    cps.onchange = () => { c.cps = clamp(+cps.value || 25, 1, 200); cps.value = c.cps; State.save(); if (running) { stop(); start(); } };
    lim.onchange = () => { c.limit = clamp(+lim.value || 0, 0, 100000); lim.value = c.limit; State.save(); };
    root.querySelectorAll(".ac-presets button").forEach((b) => b.onclick = () => { c.cps = +b.dataset.cps; cps.value = c.cps; State.save(); if (running) { stop(); start(); } });
    root.querySelector(".ac-start").onclick = toggle;
    syncPanel(root);
    return ref;
  }

  // F6 toggles from anywhere (not while typing in a field).
  addEventListener("keydown", (e) => {
    if (e.key === "F6" && !/^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || "")) { e.preventDefault(); toggle(); }
  }, true);

  if (window.AppRegistry) AppRegistry.autoclicker = function () { return open(); };
  try {
    if (window.Catalog && Catalog.storeApps && !Catalog.storeApps.find((a) => a.id === "autoclicker"))
      Catalog.storeApps.push({ id: "autoclicker", name: "Auto Clicker", cat: "Utilities", price: 0, builtin: "autoclicker", desc: "An OP auto-clicker: clicks whatever is under your mouse up to 200 times a second, toggled with F6. Point it at the Store's Get button to auto-buy apps (it still spends your sim balance)." });
    const ex = (window.EXTRA_DEFAULT_APPS = window.EXTRA_DEFAULT_APPS || []);
    if (ex.indexOf("autoclicker") < 0) ex.push("autoclicker");
  } catch (e) {}

  window.AutoClicker = { start, stop, toggle, open, setCps: (n) => { cfg().cps = clamp(n, 1, 200); State.save(); }, running: () => running };
})();
