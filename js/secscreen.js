/* Ctrl+Alt+Del — the Windows security screen.
   Opens with the physical Ctrl+Alt+Delete (where the browser lets the page see it),
   from the On-Screen Keyboard's Options ▸ "Ctrl + Alt + Del", or via SecScreen.show().
   Options: Lock, Switch user, Sign out, Change a password, Task Manager, and a power
   button. Esc or Cancel returns to the desktop. Everything is in-sim; it signs out /
   locks through the existing Accounts/Lock engine and never leaves the page. */
(function () {
  "use strict";
  if (window.SecScreen) return;

  function el(html) { const d = document.createElement("div"); d.innerHTML = String(html).trim(); return d.firstElementChild; }
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function userName() {
    try {
      if (window.Accounts && Accounts.current) { const c = Accounts.current(); if (c && c.name) return c.name; }
      if (State.data && State.data.profile && State.data.profile.name) return State.data.profile.name;
    } catch (e) {}
    return "User";
  }

  let ov = null, onKey = null;

  function show() {
    if (ov) return;
    const name = userName();
    ov = el(`
      <div class="cad-screen" role="dialog" aria-label="Windows security options" aria-modal="true">
        <div class="cad-center">
          <ul class="cad-list">
            <li><button class="cad-opt" data-a="lock">Lock</button></li>
            <li><button class="cad-opt" data-a="switch">Switch user</button></li>
            <li><button class="cad-opt" data-a="signout">Sign out</button></li>
            <li><button class="cad-opt" data-a="password">Change a password…</button></li>
            <li><button class="cad-opt" data-a="taskmgr">Task Manager</button></li>
          </ul>
          <button class="cad-cancel" data-a="cancel">Cancel</button>
        </div>
        <div class="cad-bottom">
          <div class="cad-user"><span class="cad-ava">${esc((name[0] || "U").toUpperCase())}</span><span>${esc(name)}</span></div>
          <div class="cad-icons">
            <button class="cad-ic" data-a="ease" title="Accessibility" aria-label="Accessibility">&#9855;</button>
            <button class="cad-ic" data-a="net" title="Network" aria-label="Network">&#128246;</button>
            <button class="cad-ic cad-power" data-a="power" title="Power" aria-label="Power">&#9211;</button>
          </div>
        </div>
      </div>`);
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add("on"));
    ov.addEventListener("click", (e) => { const b = e.target.closest("[data-a]"); if (b) act(b.getAttribute("data-a"), b); });
    const first = ov.querySelector(".cad-opt"); if (first) try { first.focus(); } catch (e) {}
  }

  function hide() {
    if (!ov) return;
    const n = ov; ov = null;
    n.classList.remove("on");
    setTimeout(() => { try { n.remove(); } catch (e) {} }, 180);
    document.querySelectorAll(".cad-pw-menu").forEach((m) => m.remove());
  }
  const toggle = () => (ov ? hide() : show());

  function act(a, btn) {
    switch (a) {
      case "cancel": return hide();
      case "lock":
        hide();
        if (window.Accounts && Accounts.lock) Accounts.lock();
        else if (window.Lock && Lock.run) Lock.run(function () {});
        return;
      case "switch":
      case "signout":
        hide();
        if (window.Accounts && Accounts.signOut) Accounts.signOut();
        else if (window.Lock && Lock.run) Lock.run(function () {});
        return;
      case "password":
        hide();
        if (window.WM && window.AppRegistry && AppRegistry.settings) { WM.open("settings"); if (window.Notify) Notify.show({ icon: window.Icon ? Icon.mini("settings", "Settings") : "", title: "Change a password", body: "Open Accounts ▸ Sign-in options to change your PIN or password." }); }
        return;
      case "taskmgr":
        hide();
        if (window.WM && window.AppRegistry && (AppRegistry.taskmanager || AppRegistry.taskmgr)) WM.open(AppRegistry.taskmanager ? "taskmanager" : "taskmgr");
        else if (window.Notify) Notify.show({ icon: "", title: "Task Manager", body: "Task Manager isn't available." });
        return;
      case "ease":
        hide(); if (window.WM && window.AppRegistry && AppRegistry.settings) WM.open("settings");
        return;
      case "net":
        if (window.Notify) Notify.show({ icon: "", title: "Network", body: "You're connected." });
        return;
      case "power":
        return powerMenu(btn);
    }
  }

  function powerMenu(btn) {
    document.querySelectorAll(".cad-pw-menu").forEach((m) => m.remove());
    const r = btn.getBoundingClientRect();
    const m = el(`<div class="cad-pw-menu">
      <button data-p="sleep">Sleep</button>
      <button data-p="restart">Restart</button>
      <button data-p="shutdown">Shut down</button>
    </div>`);
    document.body.appendChild(m);
    m.style.left = Math.max(8, Math.min(innerWidth - 180, r.right - 170)) + "px";
    m.style.top = Math.max(8, r.top - m.offsetHeight - 8) + "px";
    const go = (p) => {
      m.remove();
      if (p === "sleep") { hide(); if (window.Accounts && Accounts.lock) Accounts.lock(); else if (window.Lock) Lock.run(function () {}); }
      else { location.reload(); }  // Restart / Shut down -> reboot the simulation
    };
    m.addEventListener("click", (e) => { const b = e.target.closest("[data-p]"); if (b) go(b.getAttribute("data-p")); });
    setTimeout(() => document.addEventListener("pointerdown", function h(e) { if (!m.contains(e.target)) { m.remove(); document.removeEventListener("pointerdown", h); } }), 0);
  }

  // Esc closes; physical Ctrl+Alt+Delete toggles (where the browser passes it to the page,
  // and for synthetic events from the On-Screen Keyboard's Ctrl+Alt+Del keys).
  onKey = function (e) {
    if (ov && e.key === "Escape") { e.preventDefault(); e.stopPropagation(); hide(); return; }
    const isDel = e.key === "Delete" || e.key === "Del" || e.keyCode === 46;
    if (e.ctrlKey && e.altKey && isDel) { e.preventDefault(); e.stopPropagation(); toggle(); }
  };
  window.addEventListener("keydown", onKey, true);

  window.SecScreen = { show, hide, toggle };
})();
