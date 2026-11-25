/* Touch ID — talks to the (simulated) Windows Hello biometric driver only.
   It does NOT create or use a WebAuthn passkey, so it works the same in a VM
   (UTM SE, VirtualBox, etc.) or anywhere there's no real sensor. When Touch ID
   is used, a Windows Hello dialog pops up: tap/hold the sensor, it contacts the
   driver, and confirms. Nothing leaves the device; no system passkey prompt. */
(function () {
  "use strict";
  const S = () => (window.State && State.data) || {};
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const FP_SVG = `<svg viewBox="0 0 64 64" width="64" height="64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M14 30c0-10 8-18 18-18s18 8 18 18" opacity=".55"/><path d="M20 38c0-9 5-16 12-16s12 7 12 16"/><path d="M26 42c0-7 2.5-12 6-12s6 5 6 12v4"/><path d="M32 34v16"/><path d="M44 44c0 4-1 7-2 10M20 46c1 3 2 6 4 8" opacity=".7"/></svg>`;
  const CHECK_SVG = `<svg viewBox="0 0 64 64" width="64" height="64"><circle cx="32" cy="32" r="28" fill="#1e9d57"/><path d="M19 33l9 9 17-19" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

  // A simulated biometric sensor/driver is always present.
  function available() { return Promise.resolve(true); }
  const enrolled = () => !!(S().profile && S().profile.touchId && (S().profile.touchId.sim || S().profile.touchId.id));
  const sensorName = () => /iPad|iPhone|Macintosh/.test(navigator.userAgent) ? "Touch ID" : /Windows/.test(navigator.userAgent) ? "Windows Hello" : "Fingerprint";

  // ---- Windows Hello pop-up ----
  // mode "verify": one touch. mode "enroll": several touches to capture the print.
  function helloDialog(mode) {
    return new Promise((resolve, reject) => {
      document.querySelectorAll(".tid-mask").forEach((m) => m.remove());
      const enroll = mode === "enroll";
      const need = enroll ? 4 : 1;
      const mask = document.createElement("div");
      mask.className = "tid-mask";
      mask.innerHTML = `<div class="tid-dlg" role="dialog" aria-label="Windows Security">
          <div class="tid-top">Windows Security</div>
          <div class="tid-title">${enroll ? "Set up " + sensorName() : "Making sure it's you"}</div>
          <div class="tid-sub">${enroll ? "Touch the fingerprint sensor, then lift and touch again until it's captured." : "Touch the fingerprint sensor to continue."}</div>
          <button class="tid-sensor" type="button" aria-label="Fingerprint sensor"><span class="tid-ring"></span><span class="tid-glyph">${FP_SVG}</span></button>
          <div class="tid-status">${enroll ? "0 of " + need + " touches" : "Waiting for your finger…"}</div>
          <div class="tid-btns">${enroll ? "" : `<button class="tid-alt" type="button">Use PIN instead</button>`}<button class="tid-cancel" type="button">Cancel</button></div>
        </div>`;
      document.body.appendChild(mask);
      const dlg = mask.querySelector(".tid-dlg"), sensor = mask.querySelector(".tid-sensor"), ring = mask.querySelector(".tid-ring"), glyph = mask.querySelector(".tid-glyph"), status = mask.querySelector(".tid-status");
      let touches = 0, busy = false, done = false;
      const close = () => { mask.classList.add("tid-out"); setTimeout(() => mask.remove(), 180); };
      const fail = (why) => { if (done) return; done = true; close(); reject(new Error(why || "cancelled")); };
      mask.querySelector(".tid-cancel").onclick = () => fail("cancelled");
      const alt = mask.querySelector(".tid-alt"); if (alt) alt.onclick = () => fail("pin");
      mask.addEventListener("keydown", (e) => { if (e.key === "Escape") fail("cancelled"); });
      const setRing = (p) => { ring.style.background = `conic-gradient(#3b82f6 ${p * 3.6}deg, rgba(59,130,246,.16) ${p * 3.6}deg)`; };
      setRing(0);
      sensor.onclick = async () => {
        if (busy || done) return;
        busy = true; sensor.classList.add("tid-pressing");
        status.textContent = "Contacting the Windows Hello biometric driver…";
        await wait(enroll ? 420 : 650);
        touches++; setRing((touches / need) * 100);
        sensor.classList.remove("tid-pressing"); busy = false;
        if (touches < need) { status.textContent = touches + " of " + need + " touches — lift and touch again"; return; }
        done = true;
        glyph.innerHTML = CHECK_SVG; dlg.classList.add("tid-ok");
        status.textContent = enroll ? "All set — your fingerprint is ready." : "Fingerprint recognized.";
        await wait(650); close(); resolve(true);
      };
      setTimeout(() => sensor.focus(), 30);
    });
  }

  // Enroll = contact the driver and register a fingerprint (no passkey).
  // opts.silent skips the pop-up (Setup shows its own scan screen).
  function enroll(opts) {
    const go = opts && opts.silent ? wait(750) : helloDialog("enroll");
    return go.then(() => {
      S().profile = Object.assign({}, S().profile, { fingerprint: true, touchId: { sim: true, at: Date.now() } });
      if (window.State) State.save();
      return true;
    });
  }
  // Verify = pop-up asks for a touch, then the driver confirms.
  function verify() {
    if (!enrolled()) return Promise.reject(new Error("not enrolled"));
    return helloDialog("verify");
  }
  function forget() { if (S().profile) { delete S().profile.touchId; S().profile.fingerprint = false; if (window.State) State.save(); } }

  // ---- "Driver" install: the first time, Windows-style device setup ----
  function driverInfo() {
    return { name: sensorName() + " sensor", driver: "Windows Hello biometric driver", version: "12.0.26100.1", provider: "Microsoft (simulated)", date: "11/14/2026" };
  }
  function installDriverOnce() {
    return available().then((ok) => {
      if (!ok || !window.State) return ok;
      const d = S().appData || (S().appData = {});
      if (d.touchDriver) return ok;
      d.touchDriver = { installed: Date.now() }; State.save();
      const info = driverInfo();
      const icon = `<img src="assets/touchid.png?v=1" alt="" style="width:28px;height:28px;max-width:28px;max-height:28px;object-fit:contain;display:block">`;
      if (window.Notify) {
        Notify.show({ icon, title: "Setting up a device", body: "Installing " + info.name + " driver…" });
        setTimeout(() => Notify.show({ icon, title: info.name + " is ready", body: enrolled() ? "You can sign in with your fingerprint." : "Set it up in Settings → Accounts → Sign-in options.", onClick: () => { window.SettingsStartPage = "signin"; if (window.WM) WM.open("settings"); } }), 2600);
      }
      return ok;
    });
  }

  window.TouchID = { available, enrolled, enroll, verify, forget, sensorName, driverInfo, installDriverOnce, prompt: helloDialog };
})();
