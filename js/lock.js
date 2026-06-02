/* Lock screen — shown after boot if setup is complete. Just needs the password/PIN. */
(function () {
  "use strict";
  const screen = () => document.getElementById("screen");
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  const S = () => State.data;

  function run(onSuccess) {
    const pr = S().profile;
    const layer = el(`<div class="lock-screen">
      <div class="lock-bg"></div>
      <div class="lock-time">${State.formatClock()}</div>
      <div class="lock-date">${new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</div>
      <div class="lock-card">
        <div class="lock-avatar">${pr.picture ? `<img src="${pr.picture}">` : Icon.big("user", pr.username)}</div>
        <div class="lock-name">${pr.username}</div>
        <form class="lock-form" autocomplete="off">
          <input type="password" placeholder="${pr.authType === "pin" ? "PIN" : "Password"}" ${pr.authType === "pin" ? 'inputmode="numeric"' : ""} autofocus>
          <button type="submit" class="lock-go" title="Sign in">&#8594;</button>
        </form>
        <div class="lock-err"></div>
        <div class="lock-actions"><button type="button" class="btn-text lock-skip">Skip (test mode)</button></div>
      </div>
    </div>`);
    screen().appendChild(layer);

    // Apply current wallpaper to the lock background
    const wp = S().desktop.wallpaper;
    const bg = layer.querySelector(".lock-bg");
    if (!wp || wp === "default") bg.style.background = "radial-gradient(circle at 50% 30%, #4a90e2, #0a3d8f 80%)";
    else if (wp.startsWith("data:") || wp.startsWith("http")) bg.style.background = `url(${wp}) center/cover`;
    else bg.style.background = wp;

    // Live time
    const timeEl = layer.querySelector(".lock-time");
    const iv = setInterval(() => { if (!document.body.contains(layer)) { clearInterval(iv); return; } timeEl.textContent = State.formatClock(); }, 1000);

    const inp = layer.querySelector("input");
    const err = layer.querySelector(".lock-err");
    const form = layer.querySelector("form");
    function unlock() {
      layer.classList.add("lock-fade");
      setTimeout(() => { layer.remove(); onSuccess(); }, 350);
    }
    form.onsubmit = (e) => {
      e.preventDefault();
      const v = inp.value;
      if (!pr.secret || v === pr.secret) { err.textContent = ""; unlock(); }
      else { err.textContent = "Incorrect — try again."; inp.value = ""; layer.querySelector(".lock-card").classList.add("shake"); setTimeout(() => layer.querySelector(".lock-card").classList.remove("shake"), 350); }
    };
    layer.querySelector(".lock-skip").onclick = unlock;
  }

  window.Lock = { run };
})();
