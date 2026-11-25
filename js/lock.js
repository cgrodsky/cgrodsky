/* Lock screen — shown after boot if setup is complete.
   Sign-in options, like Windows 11:
     PIN · Password · Touch ID / Windows Hello (no passkey) · Security key (real WebAuthn)
   Passwords set in Settings are checked against a salted hash (js/touchid.js). */
(function () {
  "use strict";
  const screen = () => document.getElementById("screen");
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  const S = () => State.data;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const IC = {
    pin: `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><circle cx="6" cy="6" r="1.7"/><circle cx="12" cy="6" r="1.7"/><circle cx="18" cy="6" r="1.7"/><circle cx="6" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="18" cy="12" r="1.7"/><circle cx="6" cy="18" r="1.7"/><circle cx="12" cy="18" r="1.7"/><circle cx="18" cy="18" r="1.7"/></svg>`,
    password: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v3M21 12v2"/></svg>`,
    touchid: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M7 4.5A9 9 0 0 1 20.5 11M3.5 9.5A9 9 0 0 1 5 7M3.5 14a9 9 0 0 0 .5 2M9 20.5c-1.5-2-2.5-4.5-2.5-7.5a5.5 5.5 0 0 1 11 0v1M12 13v1.5c0 2.5 1 4.6 2.5 6.5M9.5 13a2.5 2.5 0 0 1 5 0v1.5c0 1.5.4 3 1.2 4.2M17.5 17.5c.6-1 1-2.2 1-3.5"/></svg>`,
    key: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="7" y="2.5" width="10" height="13" rx="2"/><path d="M9 15.5v4.5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-4.5"/><circle cx="12" cy="8" r="2"/></svg>`,
  };

  function run(onSuccess) {
    const pr = S().profile;
    const hasSecret = !!pr.secret;
    const isPinAcct = pr.authType !== "password";
    const tidName = window.TouchID ? TouchID.sensorName() : "Touch ID";
    // Which methods this account has.
    const methods = [];
    if (hasSecret && isPinAcct) methods.push("pin");
    if ((hasSecret && !isPinAcct) || (window.PasswordAuth && PasswordAuth.has())) methods.push("password");
    if (window.TouchID && TouchID.enrolled()) methods.push("touchid");
    if (window.SecurityKey && SecurityKey.enrolled() && SecurityKey.supported()) methods.push("key");
    const LABEL = { pin: "PIN", password: "Password", touchid: tidName, key: "Security key" };

    const layer = el(`<div class="lock-screen">
      <div class="lock-bg"></div>
      <div class="lock-time">${State.formatClock()}</div>
      <div class="lock-date">${new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</div>
      <div class="lock-card">
        <div class="lock-avatar">${pr.picture ? `<img src="${pr.picture}">` : Icon.big("user", pr.username)}</div>
        <div class="lock-name">${esc(pr.username)}</div>
        <div class="lock-method"></div>
        <div class="lock-err" role="alert"></div>
        <button type="button" class="btn-text lock-opts" ${methods.length > 1 ? "" : "hidden"}>Sign-in options</button>
        <div class="lock-optrow" hidden>${methods.map((m) => `<button type="button" class="lock-opt" data-m="${m}" title="${esc(LABEL[m])}" aria-label="${esc(LABEL[m])}">${IC[m]}</button>`).join("")}</div>
        <div class="lock-actions"><button type="button" class="btn-text lock-forgot">${isPinAcct ? "I forgot my PIN" : "I forgot my password"}</button>${pr.requireSignIn ? "" : `<button type="button" class="btn-text lock-skip">Skip (test mode)</button>`}</div>
      </div>
    </div>`);
    screen().appendChild(layer);

    // Apply current wallpaper to the lock background
    const wp = S().desktop.wallpaper;
    const bg = layer.querySelector(".lock-bg");
    if (!wp || wp === "default") bg.style.background = "url(assets/wall3.jpg) center/cover";
    else if (wp.startsWith("data:") || wp.startsWith("http") || wp.startsWith("assets/")) bg.style.background = `url(${wp}) center/cover`;
    else bg.style.background = wp;

    // Live time
    const timeEl = layer.querySelector(".lock-time");
    const iv = setInterval(() => { if (!document.body.contains(layer)) { clearInterval(iv); return; } timeEl.textContent = State.formatClock(); }, 1000);

    const box = layer.querySelector(".lock-method");
    const err = layer.querySelector(".lock-err");
    const card = layer.querySelector(".lock-card");
    const optBtn = layer.querySelector(".lock-opts"), optRow = layer.querySelector(".lock-optrow");
    let done = false, current = null;
    function unlock(method) {
      if (done) return; done = true;
      if (method) { pr.lastSignIn = method; State.save(); }
      layer.classList.add("lock-fade");
      setTimeout(() => { layer.remove(); onSuccess(); }, 350);
    }
    const shake = () => { card.classList.add("shake"); setTimeout(() => card.classList.remove("shake"), 350); };

    function show(m, autoStart) {
      current = m; err.textContent = "";
      optRow.querySelectorAll(".lock-opt").forEach((b) => b.classList.toggle("on", b.dataset.m === m));
      if (m === "pin" || m === "password" || !m) {
        const pin = m === "pin";
        box.innerHTML = `<form class="lock-form" autocomplete="off">
            <input type="password" placeholder="${pin ? "PIN" : "Password"}" ${pin ? 'inputmode="numeric"' : ""} aria-label="${pin ? "PIN" : "Password"}">
            <button type="submit" class="lock-go" title="Sign in">&#8594;</button></form>`;
        // Touch ID set up → always show it right here, not only under "Sign-in options".
        if (methods.includes("touchid")) {
          const quick = el(`<button type="button" class="lock-touchid"><img src="assets/touchid.png?v=1" alt=""><span>Use ${esc(tidName)}</span></button>`);
          quick.onclick = () => show("touchid", true);
          box.appendChild(quick);
        }
        const inp = box.querySelector("input"), form = box.querySelector("form");
        setTimeout(() => { try { inp.focus(); } catch (_) {} }, 50);
        form.onsubmit = async (e) => {
          e.preventDefault();
          const v = inp.value;
          let ok;
          if (!methods.length) ok = true; // no sign-in set up at all
          else if (pin || !isPinAcct) ok = hasSecret ? v === pr.secret : true;
          else { form.classList.add("busy"); ok = await PasswordAuth.check(v).catch(() => false); form.classList.remove("busy"); }
          if (ok) { err.textContent = ""; unlock(m); }
          else { err.textContent = "Incorrect " + (pin ? "PIN" : "password") + " — try again."; inp.value = ""; shake(); }
        };
      } else {
        const isKey = m === "key";
        box.innerHTML = `<button type="button" class="lock-webauthn">${IC[m]}<span>${isKey ? "Use your security key" : "Use " + esc(tidName)}</span></button>
          <div class="lock-hint">${isKey ? "Insert or tap your key when asked, then touch it." : "Touch the fingerprint sensor when it appears."}</div>`;
        const b = box.querySelector(".lock-webauthn");
        // WebAuthn must start from a tap (Safari requires it) — no auto-prompt.
        b.onclick = () => {
          if (b.disabled) return; b.disabled = true; b.classList.add("scanning"); err.textContent = "";
          const p = isKey ? SecurityKey.verify() : TouchID.verify();
          p.then(() => unlock(m)).catch((e) => {
            b.disabled = false; b.classList.remove("scanning");
            if (e && e.message === "cancelled") { err.textContent = isKey ? "Cancelled, or that key isn't set up for this account." : ""; return; }
            if (e && e.message === "pin") { const alt = methods.find((x) => x === "pin" || x === "password"); if (alt) { show(alt); return; } }
            err.textContent = (isKey ? "Security key not recognized" : tidName + " not recognized") + " — " + ((e && e.friendly) || "try again.");
            shake();
          });
        };
        if (autoStart) b.onclick(); // tapped "Use Touch ID": open the sensor straight away
      }
    }
    optBtn.onclick = () => { optRow.hidden = !optRow.hidden; };
    optRow.onclick = (e) => { const b = e.target.closest(".lock-opt"); if (b) show(b.dataset.m); };

    const skip = layer.querySelector(".lock-skip");
    if (skip) skip.onclick = () => unlock(null);

    // Forgot PIN/password: if another sign-in option exists, use it (you can then change the PIN in
    // Settings). With no other option this is a personal simulation, so allow a reset.
    layer.querySelector(".lock-forgot").onclick = () => {
      const others = methods.filter((m) => m !== (isPinAcct ? "pin" : "password"));
      if (others.length) {
        optRow.hidden = false; show(others[0]);
        err.textContent = "Sign in with another option, then change your " + (isPinAcct ? "PIN" : "password") + " in Settings → Accounts → Sign-in options.";
        return;
      }
      const nv = prompt(`Set a new ${isPinAcct ? "PIN (4 or 6 digits)" : "password"}:`);
      if (nv == null) return;
      if (isPinAcct && !/^(\d{4}|\d{6})$/.test(nv)) { err.textContent = "PIN must be 4 or 6 digits."; return; }
      if (!isPinAcct && !nv) { err.textContent = "Password can't be empty."; return; }
      pr.secret = nv; State.save();
      alert("Your " + (isPinAcct ? "PIN" : "password") + " has been reset. Signing you in.");
      unlock(isPinAcct ? "pin" : "password");
    };

    // Start on the method used last time (if it's still set up), else PIN / password.
    // Touch ID first whenever it's set up (like Windows Hello); else the method used last time.
    let first = methods.includes("touchid") ? "touchid" : methods.includes(pr.lastSignIn) ? pr.lastSignIn : methods[0] || null;
    show(first);
    // Touch ID set up on another device but not available here → fall back quietly.
    if (methods.includes("touchid") && window.TouchID) TouchID.available().then((ok) => {
      if (ok) return;
      const b = optRow.querySelector('[data-m="touchid"]'); if (b) b.remove();
      methods.splice(methods.indexOf("touchid"), 1);
      if (methods.length < 2) optBtn.hidden = true;
      if (current === "touchid" && !done) show(methods[0] || null);
    });
  }

  window.Lock = { run };
})();
