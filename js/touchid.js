/* Touch ID — talks to the (simulated) Windows Hello biometric driver only.
   It does NOT create or use a WebAuthn passkey, so it works the same in a VM
   (UTM SE, VirtualBox, etc.) or anywhere there's no real sensor: the fingerprint
   step just contacts the driver, animates, and confirms. Nothing leaves the
   device and no system passkey prompt is shown. */
(function () {
  "use strict";
  const S = () => (window.State && State.data) || {};
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // A simulated biometric sensor/driver is always present.
  function available() { return Promise.resolve(true); }
  const enrolled = () => !!(S().profile && S().profile.touchId && (S().profile.touchId.sim || S().profile.touchId.id));
  // What the sensor is called on this device (for labels only).
  const sensorName = () => /iPad|iPhone|Macintosh/.test(navigator.userAgent) ? "Touch ID" : /Windows/.test(navigator.userAgent) ? "Windows Hello" : "Fingerprint";

  // "Enroll" = contact the driver and register a fingerprint for this user.
  // No passkey: just a short driver handshake, then save a local marker.
  function enroll() {
    return wait(750).then(() => {
      S().profile = Object.assign({}, S().profile, { fingerprint: true, touchId: { sim: true, at: Date.now() } });
      if (window.State) State.save();
      return true;
    });
  }
  // "Verify" = ask the driver to confirm the touch. Always confirms when enrolled.
  function verify() {
    const t = S().profile && S().profile.touchId;
    if (!t) return Promise.reject(new Error("not enrolled"));
    return wait(650).then(() => true);
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
