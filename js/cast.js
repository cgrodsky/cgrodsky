/* Cast — real AirPlay / Remote Playback for the videos in this simulation.
   On Safari (iPad, iPhone, Mac) the Cast tile and the video player's Cast button open
   the genuine native AirPlay route picker via video.webkitShowPlaybackTargetPicker(),
   so a chosen Apple TV / AirPlay receiver on the same network plays the ACTUAL clip.
   On browsers that ship the standard Remote Playback API (e.g. Chrome -> Chromecast)
   it uses video.remote.prompt() instead. Where neither exists it says so plainly.
   Nothing here is faked — the OS owns the device list and the streaming. */
(function () {
  "use strict";
  if (window.Cast) return;

  function el(html) { const d = document.createElement("div"); d.innerHTML = String(html).trim(); return d.firstElementChild; }
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const VP = window.HTMLVideoElement && HTMLVideoElement.prototype;
  const hasAirplay = !!(VP && typeof VP.webkitShowPlaybackTargetPicker === "function") || ("WebKitPlaybackTargetAvailabilityEvent" in window);
  const hasRemote = !!(window.HTMLMediaElement && "remote" in HTMLMediaElement.prototype);
  function supported() { return hasAirplay || hasRemote; }

  const CAST_SVG = `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M2.5 19.5a4 4 0 0 1 2 1.5M2.5 16a7.5 7.5 0 0 1 5.5 5"/><circle cx="3.2" cy="20.8" r=".2" fill="currentColor"/></svg>`;

  function vidName(v) { try { return (v && v.__castName) || ""; } catch (e) { return ""; } }
  function isWireless(v) { try { return !!v.webkitCurrentPlaybackTargetIsWireless || (v.remote && v.remote.state === "connected"); } catch (e) { return false; } }

  // Wire a <video> for AirPlay / Remote Playback. Safe to call repeatedly.
  // onAvail(availability, wireless) fires whenever the OS reports a change.
  function attach(v, name, onAvail) {
    if (!v) return v;
    if (name) v.__castName = name;
    if (onAvail) (v.__castCbs = v.__castCbs || []).push(onAvail);
    if (v.__castWired) { if (onAvail) onAvail(v.__castAvail, isWireless(v)); return v; }
    v.__castWired = true;
    try { v.setAttribute("x-webkit-airplay", "allow"); } catch (e) {}
    try { v.disableRemotePlayback = false; } catch (e) {}
    v.__castAvail = supported() ? "unknown" : "unavailable";
    function fire() { (v.__castCbs || []).forEach((cb) => { try { cb(v.__castAvail, isWireless(v)); } catch (e) {} }); }
    v.__castFire = fire;
    try {
      v.addEventListener("webkitplaybacktargetavailabilitychanged", (e) => { v.__castAvail = (e.availability === "available") ? "available" : "not-available"; fire(); });
      v.addEventListener("webkitcurrentplaybacktargetiswirelesschanged", fire);
    } catch (e) {}
    if (hasRemote && v.remote && v.remote.watchAvailability) {
      try { v.remote.watchAvailability((a) => { v.__castAvail = a ? "available" : "not-available"; fire(); }).catch(() => {}); } catch (e) {}
      try { v.remote.onconnect = fire; v.remote.ondisconnect = fire; } catch (e) {}
    }
    if (onAvail) onAvail(v.__castAvail, isWireless(v));
    return v;
  }

  // MUST run inside a user gesture. Opens the real OS picker. Returns true if a picker opened.
  function pick(v) {
    if (!v) return false;
    attach(v);
    try { if (typeof v.webkitShowPlaybackTargetPicker === "function") { v.webkitShowPlaybackTargetPicker(); return true; } } catch (e) {}
    if (v.remote && typeof v.remote.prompt === "function") {
      try { v.remote.prompt().catch(() => {}); return true; } catch (e) {}
    }
    return false;
  }

  // The <video> worth casting: one playing on screen, else the most recent on-screen, else any.
  function activeVideo() {
    const vids = Array.prototype.slice.call(document.querySelectorAll("video"));
    if (!vids.length) return null;
    const onScreen = vids.filter((v) => v.offsetParent !== null && (v.src || v.currentSrc));
    const playing = onScreen.filter((v) => !v.paused && !v.ended && v.readyState > 1);
    if (playing.length) return playing[playing.length - 1];
    if (onScreen.length) return onScreen[onScreen.length - 1];
    return vids[vids.length - 1];
  }

  function toast(title, body) {
    try { if (window.Notify) { Notify.show({ icon: "", title: title, body: body || "" }); return; } } catch (e) {}
  }

  function statusFor(v) {
    if (!supported()) return { t: "AirPlay isn't available in this browser", s: "AirPlay works in Safari on an iPhone, iPad or Mac. Open this in Safari, with an Apple TV or AirPlay-enabled TV on the same Wi-Fi.", ok: false };
    if (!v) return { t: "Nothing is playing", s: "Start a video, then come back here to send it to a TV or speaker over AirPlay.", ok: false, needVideo: true };
    if (isWireless(v)) return { t: "Playing on your TV", s: "“" + (vidName(v) || "This video") + "” is streaming over AirPlay. Open the picker again to switch devices or stop.", ok: true };
    const a = v.__castAvail;
    if (a === "available") return { t: "Devices found nearby", s: "Ready to send “" + (vidName(v) || "this video") + "” to an AirPlay device.", ok: true };
    if (a === "not-available") return { t: "No devices found yet", s: "Make sure your Apple TV or AirPlay speaker is on and on the same Wi-Fi. You can still open the picker to search.", ok: true };
    return { t: "Ready to cast", s: "Send “" + (vidName(v) || "this video") + "” to an AirPlay device on your network.", ok: true };
  }

  let flyoutEl = null;
  function closeFlyout() { if (flyoutEl) { flyoutEl.remove(); flyoutEl = null; document.removeEventListener("mousedown", outside, true); } }
  function outside(ev) { if (flyoutEl && !flyoutEl.contains(ev.target) && !ev.target.closest(".tb-qs,.qs-tile")) closeFlyout(); }

  function openFlyout() {
    closeFlyout();
    const v = activeVideo();
    const st = statusFor(v);
    const panel = el(`<div class="cast-flyout" role="dialog" aria-label="Cast">
      <div class="cast-head"><span class="cast-head-ic">${CAST_SVG}</span><b>Cast</b><button class="cast-x" aria-label="Close">&times;</button></div>
      <div class="cast-body">
        <div class="cast-status ${st.ok ? "ok" : ""}">
          <div class="cast-status-t">${esc(st.t)}</div>
          <div class="cast-status-s">${esc(st.s)}</div>
        </div>
        <div class="cast-actions"></div>
        <div class="cast-foot">AirPlay sends real video from this device to your TV over your own Wi-Fi. The device list comes from your operating system.</div>
      </div>
    </div>`);
    const actions = panel.querySelector(".cast-actions");
    if (v && supported()) {
      const primary = el(`<button class="cast-go" type="button">${CAST_SVG}<span>${isWireless(v) ? "Switch or stop device" : "Cast to a device"}</span></button>`);
      primary.onclick = () => {
        const ok = pick(v);
        closeFlyout();
        if (ok) toast("AirPlay", "Choose a device to play " + (vidName(v) ? "“" + vidName(v) + "”" : "this video") + ".");
        else toast("Cast", "This browser can't open an AirPlay picker. Use Safari on an Apple device.");
      };
      actions.appendChild(primary);
      // Keep the status fresh if the OS reports devices while the flyout is open.
      attach(v, vidName(v), () => { if (!flyoutEl) return; const s2 = statusFor(v); const tt = flyoutEl.querySelector(".cast-status-t"), ss = flyoutEl.querySelector(".cast-status-s"); if (tt) tt.textContent = s2.t; if (ss) ss.textContent = s2.s; flyoutEl.querySelector(".cast-status").classList.toggle("ok", s2.ok); });
    }
    const openVid = el(`<button class="cast-sec" type="button">${v ? "Open the Video app" : "Open a video to cast"}</button>`);
    openVid.onclick = () => { closeFlyout(); try { window.WM && WM.open("drivevideo"); } catch (e) {} };
    actions.appendChild(openVid);
    panel.querySelector(".cast-x").onclick = closeFlyout;
    document.body.appendChild(panel);
    flyoutEl = panel;
    setTimeout(() => document.addEventListener("mousedown", outside, true), 0);
    return panel;
  }

  // Quick-settings "Cast" tile entry point.
  function tileClick() {
    const qp = document.getElementById("qsPanel"); if (qp) qp.remove();
    openFlyout();
  }

  // A compact Cast button for the video player's toolbar. Reflects live availability.
  function buttonFor(v, name) {
    const btn = el(`<button class="dv-cast" type="button" title="Cast to a TV or speaker (AirPlay)">${CAST_SVG}<span>Cast</span></button>`);
    btn.onclick = () => {
      const ok = pick(v);
      if (ok) toast("AirPlay", "Choose a device to play " + (name ? "“" + name + "”" : "this video") + ".");
      else if (!supported()) toast("Cast", "AirPlay needs Safari on an iPhone, iPad or Mac, with an Apple TV on the same Wi-Fi.");
      else toast("Cast", "Couldn't open the device picker on this browser.");
    };
    attach(v, name, (avail, wireless) => {
      btn.classList.toggle("on", !!wireless);
      btn.classList.toggle("avail", avail === "available");
    });
    return btn;
  }

  window.Cast = { supported, attach, pick, activeVideo, openFlyout, tileClick, buttonFor, icon: CAST_SVG };
})();
