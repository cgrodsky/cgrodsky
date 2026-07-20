/* Device HUD — when real headphones/AirPods connect to the device, show a big
   macOS-style translucent card (like the Mac volume HUD, but larger).
   Detection: navigator.mediaDevices "devicechange" + enumerateDevices() diff.
   Notes: without mic permission most browsers hide device *labels*, so we fall
   back to a generic "Headphones" name; if a label is available and mentions
   AirPods we switch to the AirPods artwork. */
(function () {
  "use strict";

  const AIRPODS_SVG = `<svg viewBox="0 0 120 84" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M38 14c-9 0-16 7-16 16 0 7 4 12 10 15v22c0 4 3 7 7 7s7-3 7-7V38c0-2 1-3 3-3" fill="none"/>
    <path d="M82 14c9 0 16 7 16 16 0 7-4 12-10 15v22c0 4-3 7-7 7s-7-3-7-7V38c0-2-1-3-3-3" fill="none"/>
  </svg>`;
  const HEADPHONE_SVG = `<svg viewBox="0 0 120 96" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M18 66V52c0-23 19-38 42-38s42 15 42 38v14"/>
    <rect x="10" y="60" width="20" height="28" rx="8" fill="#fff" stroke="none"/>
    <rect x="90" y="60" width="20" height="28" rx="8" fill="#fff" stroke="none"/>
  </svg>`;
  const OFF_SVG = `<svg viewBox="0 0 120 96" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" opacity=".85">
    <path d="M18 66V52c0-23 19-38 42-38s42 15 42 38v14"/>
    <rect x="10" y="60" width="20" height="28" rx="8" fill="#fff" stroke="none"/>
    <rect x="90" y="60" width="20" height="28" rx="8" fill="#fff" stroke="none"/>
    <line x1="16" y1="92" x2="104" y2="8" stroke="#ff6b6b" stroke-width="7"/>
  </svg>`;

  let hudEl = null, hideT = null;
  function show(opts) {
    const name = (opts && opts.name) || "Headphones";
    const connected = !opts || opts.connected !== false;
    const isPods = /airpods|buds|pods/i.test(name);
    if (!hudEl) {
      hudEl = document.createElement("div");
      hudEl.className = "dev-hud";
      (document.getElementById("screen") || document.body).appendChild(hudEl);
      hudEl.onclick = hide;
    }
    hudEl.innerHTML = `
      <div class="dev-hud-icon">${connected ? (isPods ? AIRPODS_SVG : HEADPHONE_SVG) : OFF_SVG}</div>
      <div class="dev-hud-name">${String(name).replace(/[<>&]/g, "")}</div>
      <div class="dev-hud-sub">${connected ? "Connected" : "Disconnected"}</div>
      <div class="dev-hud-vol">${Array.from({ length: 16 }, (_, i) => `<span class="${i < 10 ? "on" : ""}"></span>`).join("")}</div>`;
    clearTimeout(hideT);
    requestAnimationFrame(() => hudEl.classList.add("show"));
    hideT = setTimeout(hide, 3200);
  }
  function hide() { if (hudEl) hudEl.classList.remove("show"); clearTimeout(hideT); }

  // ---- real-device detection ----
  let baseline = null;
  function audioIds(devs) {
    return devs.filter((d) => d.kind === "audioinput" || d.kind === "audiooutput")
      .map((d) => (d.deviceId || "?") + ":" + d.kind + ":" + (d.groupId || ""));
  }
  function bestLabel(devs) {
    const withLabel = devs.find((d) => (d.kind === "audiooutput" || d.kind === "audioinput") && d.label && !/default|built-?in|speaker|internal/i.test(d.label));
    return withLabel ? withLabel.label.replace(/ (microphone|audio|input|output)$/i, "") : null;
  }
  async function snapshot() {
    try { return await navigator.mediaDevices.enumerateDevices(); } catch (_) { return null; }
  }
  async function onChange() {
    const devs = await snapshot();
    if (!devs) return;
    const now = audioIds(devs);
    if (baseline) {
      const added = now.filter((id) => !baseline.includes(id));
      const removed = baseline.filter((id) => !now.includes(id));
      if (added.length) show({ name: bestLabel(devs) || "Headphones", connected: true });
      else if (removed.length) show({ name: "Headphones", connected: false });
    }
    baseline = now;
  }
  if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
    snapshot().then((devs) => { if (devs) baseline = audioIds(devs); });
    if (navigator.mediaDevices.addEventListener) navigator.mediaDevices.addEventListener("devicechange", onChange);
    else if ("ondevicechange" in navigator.mediaDevices) navigator.mediaDevices.ondevicechange = onChange;
  }

  window.DeviceHUD = { show, hide };
})();
