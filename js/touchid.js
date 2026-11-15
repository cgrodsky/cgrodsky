/* Touch ID (real) — uses the device's built-in fingerprint/face sensor through WebAuthn
   (passkeys). Works in Safari on an iPad/iPhone/Mac with Touch ID (or Face ID), and on
   Windows Hello PCs. Nothing leaves the device: the sensor just confirms it's you.
   When there's no sensor, callers fall back to the pretend scan animation. */
(function () {
  "use strict";
  const S = () => (window.State && State.data) || {};
  const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const unb64 = (s) => { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); };
  const rand = (n) => crypto.getRandomValues(new Uint8Array(n));

  let availP = null;
  function available() {
    if (availP) return availP;
    availP = (window.PublicKeyCredential && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable)
      ? PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable().catch(() => false)
      : Promise.resolve(false);
    return availP;
  }
  const enrolled = () => !!(S().profile && S().profile.touchId && S().profile.touchId.id);
  // What the sensor is probably called on this device (for labels only).
  const sensorName = () => /iPad|iPhone|Macintosh/.test(navigator.userAgent) ? "Touch ID" : /Windows/.test(navigator.userAgent) ? "Windows Hello" : "Fingerprint";

  // Register this device's sensor for the current user. Must be called from a tap/click.
  function enroll() {
    const pr = S().profile || {};
    const name = pr.username || "User";
    return navigator.credentials.create({ publicKey: {
      challenge: rand(32),
      rp: { name: "Windows 12 (web)" },
      user: { id: rand(16), name: name, displayName: name },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
      timeout: 60000, attestation: "none",
    } }).then((cred) => {
      if (!cred) throw new Error("cancelled");
      S().profile = Object.assign({}, S().profile, { fingerprint: true, touchId: { id: b64(cred.rawId), at: Date.now() } });
      if (window.State) State.save();
      return true;
    });
  }
  // Ask the sensor to confirm it's the enrolled user. Must be called from a tap/click.
  function verify() {
    const t = S().profile && S().profile.touchId;
    if (!t) return Promise.reject(new Error("not enrolled"));
    return navigator.credentials.get({ publicKey: {
      challenge: rand(32),
      allowCredentials: [{ type: "public-key", id: unb64(t.id) }],
      userVerification: "required", timeout: 60000,
    } }).then((a) => { if (!a) throw new Error("cancelled"); return true; });
  }
  function forget() { if (S().profile) { delete S().profile.touchId; S().profile.fingerprint = false; if (window.State) State.save(); } }

  // ---- "Driver" install: the first time a sensor is found, Windows-style device setup ----
  function driverInfo() {
    return { name: sensorName() + " sensor", driver: "Windows Hello biometric driver (WebAuthn)", version: "12.0.26100.1", provider: "Microsoft (web)", date: "11/14/2026" };
  }
  function installDriverOnce() {
    return available().then((ok) => {
      if (!ok || !window.State) return ok;
      const d = S().appData || (S().appData = {});
      if (d.touchDriver) return ok;
      d.touchDriver = { installed: Date.now() }; State.save();
      const info = driverInfo();
      const icon = `<img src="assets/touchid.png?v=1" alt="" style="width:100%;height:100%;object-fit:contain">`;
      if (window.Notify) {
        Notify.show({ icon, title: "Setting up a device", body: "Installing " + info.name + " driver…" });
        setTimeout(() => Notify.show({ icon, title: info.name + " is ready", body: enrolled() ? "You can sign in with your fingerprint." : "Set it up in Settings → Accounts → Sign-in options.", onClick: () => { window.SettingsStartPage = "signin"; if (window.WM) WM.open("settings"); } }), 2600);
      }
      return ok;
    });
  }

  window.TouchID = { available, enrolled, enroll, verify, forget, sensorName, driverInfo, installDriverOnce };
})();
