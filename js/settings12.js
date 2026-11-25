/* Settings — Windows 12 style (profile card + search + section list on the left,
   big title, header card and rounded rows on the right). Uses the signed-in user's name. */
(function () {
  "use strict";
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  const S = () => State.data;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // ---------- line icons (drawn with the purple→blue gradient) ----------
  const P = {
    display: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16v4"/>',
    sound: '<path d="M4 9h3l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4 6.6 6.6 0 0 0 20 14.5z"/>',
    battery: '<rect x="3" y="7" width="16" height="10" rx="2"/><path d="M21 10.5v3M6 10v4M9 10v4"/>',
    storage: '<rect x="3" y="8" width="18" height="8" rx="2"/><path d="M17 12h.01M7 12h6"/>',
    multitask: '<rect x="3" y="7" width="12" height="11" rx="1.5"/><path d="M8 7V5h13v11h-6"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/>',
    wrench: '<path d="M14.5 6.5a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3l7.5-7.5a4 4 0 0 0-2-2z"/>',
    recovery: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    cast: '<rect x="3" y="4" width="18" height="13" rx="1.5"/><path d="M9 21l3-4 3 4"/>',
    remote: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20h8M10 10h4M12 8l2 2-2 2"/>',
    clipboard: '<rect x="5" y="5" width="14" height="16" rx="2"/><path d="M9 5V3h6v2M9 11h6M9 15h4"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
    bluetooth: '<path d="M7 7l10 10-5 4V3l5 4L7 17"/>',
    plus: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
    mouse: '<rect x="7" y="3" width="10" height="18" rx="5"/><path d="M12 7v4"/>',
    printer: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="1.5"/><path d="M7 14h10v7H7z"/>',
    phone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
    touchpad: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 15h18M12 15v4"/>',
    pen: '<path d="M4 20l4-1L19 8l-3-3L5 16z"/><path d="M14 7l3 3"/>',
    usb: '<path d="M12 3v15M9 6l3-3 3 3M8 11v2l4 3M16 9v3l-4 2"/><circle cx="12" cy="19" r="2"/>',
    wifi: '<path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.5 16a5 5 0 0 1 7 0"/><path d="M12 19.5h.01"/>',
    cell: '<path d="M4 20v-3M9 20v-6M14 20v-9M19 20V5"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
    hotspot: '<circle cx="12" cy="12" r="2"/><path d="M8 8a5.5 5.5 0 0 0 0 8M16 8a5.5 5.5 0 0 1 0 8M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14"/>',
    plane: '<path d="M10 21l2-1 2 1v-2l-2-1.5V13l8 3v-2l-8-5V4.5a2 2 0 0 0-4 0V9L0 14v2l8-3v4.5L6 19v2z" transform="translate(2 0)"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    call: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
    sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>',
    palette: '<path d="M12 3a9 9 0 0 0 0 18c1.5 0 2-1 2-2s-1-1.5-1-2.5S14 15 15 15h2a4 4 0 0 0 4-4c0-4.5-4-8-9-8z"/><path d="M7.5 11h.01M10 7.5h.01M14.5 7.5h.01"/>',
    brush: '<path d="M19 3L9 13M6 14a3 3 0 0 0-3 3c0 1.5-1 3-1 3s3 0 5-1a3 3 0 0 0 2-3"/><path d="M8.5 12.5l3 3"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    corner: '<path d="M4 20V11a7 7 0 0 1 7-7h9"/>',
    sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18"/>',
    layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    glass: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 16L17 8M7 11l4-3"/>',
    music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
    check: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12l3 3 5-6"/>',
    map: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
    puzzle: '<path d="M10 4a2 2 0 0 1 4 0v2h4v4h-2a2 2 0 0 0 0 4h2v4h-4v-2a2 2 0 0 0-4 0v2H6v-4h2a2 2 0 0 0 0-4H6V6h4z"/>',
    web: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M7 6.5h.01M10 6.5h.01"/>',
    video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/>',
    rocket: '<path d="M14 4c3 0 6 3 6 6l-7 7-6-6z"/><path d="M7 11l-3 1 3 3M13 17l-1 3-3-3M15 9h.01"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    idcard: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M6 16a3 3 0 0 1 6 0M14 10h4M14 13h3"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    family: '<circle cx="8" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M2 20a6 6 0 0 1 12 0M14 20a4 4 0 0 1 8 0"/>',
    cloud: '<path d="M7 18a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.3A4 4 0 0 1 17 18z"/><path d="M12 11v5M10 13l2-2 2 2"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M3 20a6 6 0 0 1 12 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3 6"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5h6v2M3 12h18"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    lang: '<path d="M4 5h9M8.5 3v2M6 5c0 4 3 7 6 8M11 5c0 4-3 7-7 8"/><path d="M13 21l4-9 4 9M14.5 18h5"/>',
    keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    gamepad: '<path d="M6 8h12a4 4 0 0 1 4 4l-1 5a2 2 0 0 1-3.5 1L15 16H9l-2.5 2A2 2 0 0 1 3 17l-1-5a4 4 0 0 1 4-4z"/><path d="M7 11v3M5.5 12.5h3M16 12h.01M18 13.5h.01"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    speed: '<path d="M4 18a8 8 0 1 1 16 0"/><path d="M12 18l4-6"/>',
    text: '<path d="M4 7V5h16v2M12 5v14M9 19h6"/>',
    contrast: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18" /><path d="M12 3a9 9 0 0 1 0 18z" fill="url(#w12s-g)" stroke="none"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    pointer: '<path d="M5 3l14 7-6 2-2 6z"/>',
    narrator: '<path d="M4 9h3l5-4v14l-5-4H4z"/><path d="M16 12h5M17 8l3-2M17 16l3 2"/>',
    zoom: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4M8 11h6M11 8v6"/>',
    cc: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 10a2 2 0 1 0 0 4M16 10a2 2 0 1 0 0 4"/>',
    location: '<path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    find: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
    pause: '<circle cx="12" cy="12" r="9"/><path d="M10 9v6M14 9v6"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  };
  const ic = (k, size) => `<svg class="w12s-svg" viewBox="0 0 24 24" width="${size || 20}" height="${size || 20}" fill="none" stroke="url(#w12s-g)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${P[k] || P.sliders}</svg>`;
  const BIG = {   // large black line art for the header cards (like the reference)
    laptop: '<svg viewBox="0 0 64 48" width="76" height="58" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"><rect x="16" y="4" width="40" height="27" rx="4"/><rect x="6" y="14" width="40" height="27" rx="4" fill="var(--w12s-card-solid)"/><path d="M2 46h48"/></svg>',
    bluetooth: '<svg viewBox="0 0 24 24" width="58" height="58" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7l10 10-5 4V3l5 4L7 17"/></svg>',
    wifi: '<svg viewBox="0 0 24 24" width="58" height="58" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.5 16a5 5 0 0 1 7 0"/><path d="M12 19.5h.01" stroke-width="3"/></svg>',
    wifioff: '<svg viewBox="0 0 24 24" width="58" height="58" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.5 16a5 5 0 0 1 7 0" opacity=".35"/><path d="M3 3l18 18"/></svg>',
  };

  // ---------- state helpers ----------
  function qs() { if (!S().appData) S().appData = {}; if (!S().appData.quickSettings) S().appData.quickSettings = { wifi: true, bt: false, plane: false, night: false, focus: false, brightness: 90, volume: 55, signal: "good" }; return S().appData.quickSettings; }
  function prefs() { if (!S().appData) S().appData = {}; return S().appData.settings12 || (S().appData.settings12 = { gameMode: true, gameBar: true, autoUpdate: true, findDevice: true, location: true, camera: true, mic: true, autoTime: true, bootSound: true, osk: false }); }
  function fx() { const d = S().desktop || (S().desktop = {}); return d.fx || (d.fx = { round: true, anim: true, shadow: true, blur: true }); }
  function applyUiFx() {
    try {
      const f = fx(), r = document.documentElement;
      r.classList.toggle("fx-square", !f.round); r.classList.toggle("fx-noanim", !f.anim);
      r.classList.toggle("fx-noshadow", !f.shadow); r.classList.toggle("fx-noblur", !f.blur);
    } catch (_) {}
  }
  window.applyUiFx = applyUiFx;
  if (window.State && State.data) applyUiFx();
  const profile = () => S().profile || (S().profile = { username: "User" });
  const userName = () => profile().username || "User";
  const userSub = () => (S().account && S().account.email) ? S().account.email : "Local Account";
  const deviceName = () => (userName().replace(/[^A-Za-z0-9-]/g, "").slice(0, 12) || "USER").toUpperCase() + "-PC";
  function avatar(size) {
    const pr = profile();
    return pr.picture ? `<img class="w12s-av-img" src="${esc(pr.picture)}" style="width:${size}px;height:${size}px" alt="">`
      : `<span class="w12s-av-def" style="width:${size}px;height:${size}px">${'<svg viewBox="0 0 40 40" width="100%" height="100%"><defs><linearGradient id="w12s-avg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b061d6"/><stop offset="1" stop-color="#3b7fd8"/></linearGradient></defs><circle cx="20" cy="14" r="7" fill="url(#w12s-avg)"/><path d="M7 33c1-7 6.5-10 13-10s12 3 13 10z" fill="url(#w12s-avg)" opacity=".85"/></svg>'}</span>`;
  }
  function toggle(on, onChange) {
    const t = el(`<label class="w12s-sw"><input type="checkbox" ${on ? "checked" : ""}><span></span></label>`);
    t.addEventListener("click", (e) => e.stopPropagation());
    t.querySelector("input").onchange = (e) => onChange(e.target.checked);
    return t;
  }
  function slider(min, max, val, onInput, step) {
    const s = el(`<input class="w12s-range" type="range" min="${min}" max="${max}" step="${step || 1}" value="${val}">`);
    s.addEventListener("click", (e) => e.stopPropagation());
    s.oninput = () => onInput(+s.value);
    return s;
  }
  function select(opts, val, onChange) {
    const s = el(`<select class="w12s-select">${opts.map(([v, l]) => `<option value="${esc(v)}" ${v === val ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`);
    s.addEventListener("click", (e) => e.stopPropagation());
    s.onchange = () => onChange(s.value);
    return s;
  }
  const refreshWifi = () => { if (window.WM && WM.refreshWifi) WM.refreshWifi(); };
  // Network row control: a live real-status badge + the (simulated) Wi-Fi switch. Keeps the row's subtitle live too.
  function wifiCtl(q) {
    const wrap = el(`<span class="rad-ctl"><span class="rad-badge"></span></span>`), badge = wrap.firstElementChild;
    wrap.appendChild(toggle(!!q.wifi, (v) => { q.wifi = v; if (v) q.plane = false; State.save(); refreshWifi(); Radios.emit(); go("network"); }));
    let seen = false;
    const paint = () => {
      const n = Radios.net.info(), conn = Radios.net.isConnected();
      badge.className = "rad-badge " + (conn ? "on" : "off");
      badge.textContent = !n.online ? "Offline" : !q.wifi ? "Off" : n.testing ? "Testing…" : n.latency != null ? "Online · " + n.latency + " ms" : "Online";
      const row = wrap.closest(".w12s-row"), s = row && row.querySelector(".w12s-row-s");
      if (s) s.textContent = Radios.net.summary();
    };
    const off = Radios.on(() => { if (!wrap.isConnected) { if (seen) off(); return; } seen = true; paint(); });
    paint(); requestAnimationFrame(() => { if (wrap.isConnected) { seen = true; paint(); } });
    return wrap;
  }
  const note = (body) => { if (window.Notify) Notify.show({ icon: Icon.mini("settings", "Settings"), title: "Settings", body }); };

  // ---------- sections ----------
  const NAV = [
    { id: "system", name: "System", ic: "opt_monitor" },
    { id: "devices", name: "Bluetooth & devices", ic: "set_bluetooth" },
    { id: "network", name: "Network & internet", ic: "wifi" },
    { id: "personal", name: "Personalization", ic: "personalization" },
    { id: "apps", name: "Apps", ic: "store__" },
    { id: "accounts", name: "Accounts", ic: "user" },
    { id: "time", name: "Time & language", ic: "clock" },
    { id: "gaming", name: "Gaming", ic: "xbox" },
    { id: "access", name: "Accessibility", ic: "accessibility" },
    { id: "privacy", name: "Privacy & security", ic: "security" },
    { id: "update", name: "Windows Update", ic: "winupdate" },
  ];

  // Rows: { ic, t, s, sub } opens a sub-page, { ctl } puts a control on the right, { act } runs on click, { expand } opens a panel under the row.
  function pages() {
    const q = qs(), pf = prefs(), f = fx();
    return {
      system: [
        { ic: "display", t: "Display", s: "Brightness, night light, text size", sub: "display" },
        { ic: "sound", t: "Sound", s: "Volume, output, input, sound devices", sub: "sound" },
        { ic: "bell", t: "Notifications", s: "Alerts from apps and system, do not disturb", sub: "notifications" },
        { ic: "moon", t: "Focus", s: "Do not disturb, automatic rules", sub: "notifications" },
        { ic: "battery", t: "Power & battery", s: "Sleep, battery usage, battery saver", sub: "power" },
        { ic: "storage", t: "Storage", s: "Storage space, drives, configuration rules", sub: "storage" },
        { ic: "multitask", t: "Multitasking", s: "Snap windows, desktops, task switching", sub: "multitask" },
        { ic: "key", t: "Activation", s: "Activation state, subscriptions, product key", sub: "activation" },
        { ic: "wrench", t: "Troubleshoot", s: "Recommended troubleshooters, preferences, history", sub: "troubleshoot" },
        { ic: "recovery", t: "Recovery", s: "Reset, advanced startup, go back", sub: "recovery" },
        { ic: "cast", t: "Projecting to this PC", s: "Permissions, pairing PIN, discoverability" },
        { ic: "remote", t: "Remote Desktop", s: "Remote Desktop users, connection permissions" },
        { ic: "clipboard", t: "Clipboard", s: "Cut and copy history, sync, clear" },
        { ic: "info", t: "About", s: "Device specifications, rename PC, Windows specifications", sub: "about" },
      ],
      devices: [
        window.Radios
          ? { ic: "plus", t: "Add device", s: Radios.bt.supported() ? "Pair a real Bluetooth device nearby (your browser shows the list)" : "Not available in this browser — open this page in Chrome or Edge", act: () => { if (Radios.bt.supported()) Radios.bt.pair(); else note(Radios.bt.UNSUPPORTED_MSG); } }
          : { ic: "plus", t: "Add device", s: "Search for new Bluetooth devices", act: () => note(q.bt ? "Searching for devices… nothing found nearby." : "Turn on Bluetooth first.") },
        { ic: "mouse", t: "Mouse", s: "Buttons, pointer speed, scrolling", sub: "mouse" },
        { ic: "keyboard", t: "Devices & drivers", s: "Fingerprint sensor, mouse, keyboard — drivers and status", sub: "devmgr" },
        { ic: "printer", t: "Printers & scanners", s: "Set up and troubleshoot printers" },
        { ic: "phone", t: "Phone Link", s: "Get to your phone's photos, texts and more" },
        { ic: "touchpad", t: "Touchpad", s: "Taps, scrolling, zoom, gestures" },
        { ic: "pen", t: "Pen & touch", s: "Pen settings, touch screen" },
        { ic: "usb", t: "USB", s: "Connect more devices with USB" },
      ],
      network: [
        window.Radios
          ? { ic: "wifi", t: "Wi-Fi", s: Radios.net.summary(), ctl: () => wifiCtl(q) }
          : { ic: "wifi", t: "Wi-Fi", s: q.wifi ? "Connected to HomeNetwork_5G, secured" : "Off", ctl: () => toggle(!!q.wifi, (v) => { q.wifi = v; if (v) q.plane = false; State.save(); refreshWifi(); go("network"); }) },
        ...(window.Radios ? [{ ic: "speed", t: "Run network test", s: "Measure the real latency from this device to this site's server", act: () => Radios.net.test() }] : []),
        ...(window.Radios ? [{ ic: "wifi", t: "Show available networks", s: "Your real connection, plus simulated networks to join", sub: "wifinets" }] : []),
        ...(q.wifi ? [{ ic: "cell", t: window.Radios ? "Signal strength (simulated)" : "Signal strength", s: window.Radios ? "Pretend the Wi-Fi signal is weak — the tray icon shows the real state otherwise" : "How strong the Wi-Fi signal is", ctl: () => select([["good", "Strong"], ["poor", "Weak"]], q.signal === "poor" ? "poor" : "good", (v) => { q.signal = v; State.save(); refreshWifi(); go("network"); }) }] : []),
        { ic: "cell", t: "Mobile network", s: "Not connected — get online over a cellular network" },
        { ic: "shield", t: "VPN", s: "Add, connect, manage" },
        { ic: "hotspot", t: "Mobile hotspot", s: "Share your internet connection" },
        { ic: "plane", t: "Airplane mode", s: q.plane ? "On — all wireless radios are off" + (window.Radios ? " (simulated; real Bluetooth devices are disconnected)" : "") : "Stop all wireless communication", ctl: () => toggle(!!q.plane, (v) => { q.plane = v; if (v) { q.wifi = false; q.bt = false; if (window.Radios) Radios.bt.setEnabled(false); } State.save(); refreshWifi(); if (window.Radios) Radios.emit(); go("network"); }) },
        { ic: "globe", t: "Proxy", s: "Proxy server for Wi-Fi and Ethernet connections" },
        { ic: "call", t: "Dial-up", s: "Set up a dial-up internet connection" },
        { ic: "sliders", t: "Advanced network settings", s: "View all network adapters, network reset" },
      ],
      personal: [
        { ic: "image", t: "Background", s: "Pictures, solid colors, upload your own", sub: "background" },
        { ic: "palette", t: "Colors", s: "Accent color for Windows", expand: buildColors },
        { ic: "brush", t: "Themes", s: "Windows 12 or the classic Windows XP look", expand: buildThemes },
        { ic: "grid", t: "Personalize icons", s: "Change the icon of any app", sub: "icons" },
        ...(window.Tidy ? [{ ic: "grid", t: "Desktop icons", s: "Choose which shortcuts appear on the desktop", expand: (p) => Tidy.buildSettings(p) }] : []),
        { ic: "corner", t: "Rounded corners", s: "Round the corners of windows and menus", ctl: () => toggle(f.round, (v) => { f.round = v; State.save(); applyUiFx(); }) },
        { ic: "sparkle", t: "Animation effects", s: "Animate windows and controls", ctl: () => toggle(f.anim, (v) => { f.anim = v; State.save(); applyUiFx(); }) },
        { ic: "layers", t: "Shadows", s: "Show shadows under windows and menus", ctl: () => toggle(f.shadow, (v) => { f.shadow = v; State.save(); applyUiFx(); }) },
        { ic: "glass", t: "Transparency effects", s: "Frosted-glass windows, menus and taskbar", ctl: () => toggle(f.blur, (v) => { f.blur = v; State.save(); applyUiFx(); }) },
        { ic: "music", t: "Startup sound", s: "Play a sound when Windows starts", ctl: () => toggle(pf.bootSound, (v) => { pf.bootSound = v; State.save(); }) },
      ],
      apps: [
        { ic: "grid", t: "Installed apps", s: "Open or uninstall your apps", sub: "installed" },
        { ic: "check", t: "Default apps", s: "Defaults for file and link types" },
        { ic: "map", t: "Offline maps", s: "Downloads, storage location, map updates" },
        { ic: "puzzle", t: "Optional features", s: "Extra functionality for your device" },
        { ic: "web", t: "Apps for websites", s: "Websites that can open in an app instead of a browser" },
        { ic: "video", t: "Video playback", s: "Video adjustments, HDR streaming, battery options" },
        { ic: "rocket", t: "Startup", s: "Apps that start automatically when you sign in" },
      ],
      accounts: [
        { ic: "idcard", t: "Your info", s: "Your name, profile picture", sub: "yourinfo" },
        { ic: "key", t: "Sign-in options", s: "PIN, password, Windows Hello", sub: "signin" },
        { ic: "mail", t: "Email & accounts", s: "Accounts used by email, calendar and contacts", sub: "email" },
        { ic: "family", t: "Family", s: "Manage your family group, edit account types and device permissions" },
        { ic: "cloud", t: "Windows Backup", s: "Back up your desktop, or move it to another device with a code", sub: "devicesync" },
        { ic: "users", t: "Other users", s: "Add, remove or change the type of accounts on this PC", sub: "otherusers" },
        { ic: "briefcase", t: "Access work or school", s: "Organization resources like email, apps and the network" },
      ],
      time: [
        { ic: "clock", t: "Date & time", s: "Time zone, clock format, set time automatically", sub: "datetime" },
        { ic: "lang", t: "Language & region", s: "Windows and some apps format dates and time based on your region", sub: "language" },
        { ic: "keyboard", t: "Typing", s: "Touch keyboard, text suggestions, preferences" },
        { ic: "mic", t: "Speech", s: "Speech language, voice recognition, microphone setup" },
        { ic: "globe", t: "Windows display language", s: "Settings and File Explorer will appear in this language", ctl: () => select((window.I18n ? I18n.languages : [{ code: "en", name: "English" }]).map((l) => [l.code, l.name]), window.I18n ? I18n.lang : "en", (v) => { if (window.I18n) I18n.set(v); note(v === "sv" ? "Visningsspråket är nu svenska." : "Display language changed."); }) },
      ],
      gaming: [
        { ic: "gamepad", t: "Game Bar", s: "Controller and keyboard shortcuts", ctl: () => toggle(pf.gameBar, (v) => { pf.gameBar = v; State.save(); }) },
        { ic: "camera", t: "Captures", s: "Save location, recording preferences" },
        { ic: "speed", t: "Game Mode", s: "Optimize your PC for play", ctl: () => toggle(pf.gameMode, (v) => { pf.gameMode = v; State.save(); }) },
      ],
      access: [
        { ic: "text", t: "Text size", s: "Make text bigger or smaller (" + S().textScale + "%)", ctl: () => slider(80, 180, S().textScale || 100, (v) => { S().textScale = v; document.documentElement.style.setProperty("--scale", v / 100); State.save(); }, 10) },
        { ic: "contrast", t: "Appearance", s: "Light, dark, or match your device automatically", ctl: () => select([["auto", "Auto (match device)"], ["light", "Light"], ["dark", "Dark"]], (S().theme === "light" || S().theme === "dark") ? S().theme : "auto", (v) => { S().theme = v; State.save(); if (window.applyTheme) window.applyTheme(); if (window.applyWallpaper) window.applyWallpaper(); }) },
        { ic: "accessibility", t: "Accessibility mode", s: "High contrast, bigger text and reduced motion", ctl: () => toggle(!!(S().appData.a11y && S().appData.a11y.on), (v) => { const a = (S().appData.a11y = S().appData.a11y || {}); a.on = v; a.contrast = a.bigText = a.reduceMotion = true; State.save(); if (window.applyTheme) window.applyTheme(); }) },
        { ic: "monitor", t: "Kiosk mode", s: "Full screen, single-app lock — hides the taskbar and desktop", ctl: () => toggle(!!(S().appData && S().appData.kiosk), (v) => { if (window.setKiosk) window.setKiosk(v); }) },
        { ic: "keyboard", t: "On-screen keyboard", s: "Type with the mouse or touch", ctl: () => toggle(!!pf.osk, (v) => { pf.osk = v; State.save(); if (window.OSK) (v ? OSK.show() : OSK.hide()); }) },
        { ic: "eye", t: "Visual effects", s: "Animations, transparency, scrollbars", act: () => go("personal") },
        { ic: "pointer", t: "Mouse pointer and touch", s: "Pointer color, size", sub: "mouse" },
        { ic: "narrator", t: "Narrator", s: "Voice, verbosity, keyboard, braille" },
        { ic: "zoom", t: "Magnifier", s: "Zoom level, zoom increment" },
        { ic: "cc", t: "Captions", s: "Styles, live captions" },
      ],
      privacy: [
        { ic: "shield", t: "Windows Security", s: "Antivirus, browser, firewall and network protection", act: () => WM.open("security") },
        { ic: "find", t: "Find my device", s: "Track your device if you think you've lost it", ctl: () => toggle(pf.findDevice, (v) => { pf.findDevice = v; State.save(); }) },
        { ic: "lock", t: "Device encryption", s: "Help protect your data with encryption" },
        { ic: "location", t: "Location", s: "Let apps use your location", ctl: () => toggle(pf.location, (v) => { pf.location = v; State.save(); }) },
        { ic: "camera", t: "Camera", s: "Let apps use your camera", ctl: () => toggle(pf.camera, (v) => { pf.camera = v; State.save(); }) },
        { ic: "mic", t: "Microphone", s: "Let apps use your microphone", ctl: () => toggle(pf.mic, (v) => { pf.mic = v; State.save(); }) },
      ],
      update: [
        { ic: "pause", t: "Pause updates", s: "Pause for 1 week", act: () => note("Updates paused for 1 week.") },
        { ic: "history", t: "Update history", s: "See what was installed", sub: "uphistory" },
        { ic: "sliders", t: "Advanced options", s: "Delivery optimization, optional updates, active hours" },
        { ic: "download", t: "Get the latest updates as soon as they're available", s: "Be among the first to get new features", ctl: () => toggle(pf.autoUpdate, (v) => { pf.autoUpdate = v; State.save(); }) },
      ],
    };
  }

  // ---------- header cards ----------
  function hero(id, host) {
    const q = qs();
    if (id === "system") return el(`<div class="w12s-hero"><span class="w12s-hero-ic">${BIG.laptop}</span><div><div class="w12s-hero-big">${esc(userName())}</div><div class="w12s-hero-sub">${esc(userSub())}</div>${S().account ? `<span class="w12s-hero-meta">${esc(deviceName())}</span>` : `<a class="w12s-link" data-go="accounts">Sign in</a>`}</div></div>`);
    if (id === "devices") {
      const h = el(`<div class="w12s-hero"><span class="w12s-hero-ic">${BIG.bluetooth}</span><div style="flex:1"><div class="w12s-hero-sub">My device's name</div><div class="w12s-hero-big">${esc(deviceName())}</div><div class="w12s-hero-sub" style="font-size:.78rem">This is the name other devices see in their Bluetooth list</div><a class="w12s-link" data-sub="about">Rename</a></div><div class="w12s-hero-ctl"><span>Bluetooth</span></div></div>`);
      const btToggle = toggle(!!q.bt, (v) => { if (window.Radios) Radios.bt.setEnabled(v); else { q.bt = v; if (v) q.plane = false; State.save(); } refreshWifi(); });
      h.querySelector(".w12s-hero-ctl").appendChild(btToggle);
      if (!window.Radios) return h;
      // Real Bluetooth (Web Bluetooth): device list, pairing status, unsupported message.
      const wrap = el(`<div class="rad-wrap"></div>`);
      wrap.append(h, Radios.ui.btPanel());
      const off = Radios.on(() => { if (!wrap.isConnected) return off(); const inp = btToggle.querySelector("input"); if (inp) inp.checked = !!q.bt; });
      return wrap;
    }
    if (id === "network") {
      if (window.Radios) {
        // Real online/offline status + connection details; the network NAME stays simulated.
        const wrap = el(`<div class="rad-wrap"><div class="rad-hero-box"></div></div>`), box = wrap.firstElementChild;
        const paint = () => {
          const n = Radios.net.info(), conn = Radios.net.isConnected();
          const sub = !n.online ? "Not connected — this device is offline" : !q.wifi ? (q.plane ? "Airplane mode is on (simulated)" : "Wi-Fi is off (simulated)") : Radios.net.summary();
          box.innerHTML = "";
          const h = el(`<div class="w12s-hero"><span class="w12s-hero-ic">${conn ? BIG.wifi : BIG.wifioff}</span><div style="min-width:0"><div class="w12s-hero-sub">${esc(sub)}</div><div class="w12s-hero-big">${conn ? esc(q.ssid || "HomeNetwork_5G") : "No network"}</div>${conn ? `<div class="w12s-hero-sub" style="font-size:.74rem">Network name is simulated — browsers can't read the real Wi-Fi name</div>` : ""}${n.online ? `<a class="w12s-link w12s-wifi-link">${q.wifi ? "Disconnect (simulated)" : "Connect"}</a>` : ""}</div></div>`);
          const lk = h.querySelector(".w12s-wifi-link");
          if (lk) lk.onclick = () => { q.wifi = !q.wifi; if (q.wifi) q.plane = false; State.save(); refreshWifi(); Radios.emit(); go("network"); };
          box.appendChild(h);
        };
        paint();
        const off = Radios.on(() => { if (!wrap.isConnected) return off(); paint(); });
        wrap.appendChild(Radios.ui.netPanel());
        return wrap;
      }
      const h = el(`<div class="w12s-hero"><span class="w12s-hero-ic">${q.wifi ? BIG.wifi : BIG.wifioff}</span><div><div class="w12s-hero-sub">${q.wifi ? "Wi-Fi connected" : (q.plane ? "Airplane mode is on" : "Not connected")}</div><div class="w12s-hero-big">${q.wifi ? "HomeNetwork_5G" : "No network"}</div><a class="w12s-link w12s-wifi-link">${q.wifi ? "Disconnect" : "Connect"}</a></div></div>`);
      h.querySelector(".w12s-wifi-link").onclick = () => { q.wifi = !q.wifi; if (q.wifi) q.plane = false; State.save(); refreshWifi(); go("network"); };
      return h;
    }
    if (id === "accounts") return el(`<div class="w12s-hero">${avatar(64)}<div><div class="w12s-hero-big" style="font-size:1.35rem">${esc(userName())}</div><div class="w12s-hero-sub">${esc(userSub())}</div><div class="w12s-hero-sub" style="font-size:.78rem">${window.Accounts ? esc(Accounts.typeLabel()) : "Administrator"}</div></div></div>`);
    if (id === "time") {
      const h = el(`<div class="w12s-hero"><div><span class="w12s-hero-sub">Current device time:</span> <span class="w12s-hero-big w12s-clock"></span></div></div>`);
      const c = h.querySelector(".w12s-clock");
      const tick = (live) => { if (live && !c.isConnected) return clearInterval(host._clock); c.textContent =(State.now ? State.now() : new Date()).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" }); };
      tick(false); clearInterval(host._clock); host._clock = setInterval(() => tick(true), 1000);
      return h;
    }
    if (id === "update") { const box = el(`<div class="w12s-wu"></div>`); SettingsParts.renderWindowsUpdate(box); return box; }
    return null;
  }

  // ---------- sub-pages with real controls ----------
  function card(inner) { return el(`<div class="w12s-card">${inner || ""}</div>`); }
  function line(label, ctlEl, sub) { const r = el(`<div class="w12s-row w12s-row-static"><div class="w12s-row-txt"><div class="w12s-row-t">${label}</div>${sub ? `<div class="w12s-row-s">${sub}</div>` : ""}</div><div class="w12s-row-ctl"></div></div>`); if (ctlEl) r.querySelector(".w12s-row-ctl").appendChild(ctlEl); return r; }
  const SUB = {
    display: { title: "Display", parent: "system", build(h) {
      const q = qs();
      h.appendChild(line("Brightness", slider(10, 100, q.brightness, (v) => { q.brightness = v; State.save(); if (window.WM && WM.applyDisplayFx) WM.applyDisplayFx(); })));
      h.appendChild(line("Night light", toggle(!!q.night, (v) => { q.night = v; State.save(); if (window.WM && WM.applyDisplayFx) WM.applyDisplayFx(); }), "Use warmer colors to help you sleep"));
      h.appendChild(line("Text size", slider(80, 180, S().textScale || 100, (v) => { S().textScale = v; document.documentElement.style.setProperty("--scale", v / 100); State.save(); }, 10)));
      h.appendChild(line("Display resolution", null, window.screen.width + " × " + window.screen.height + " (Recommended)"));
    } },
    sound: { title: "Sound", parent: "system", build(h) {
      const q = qs();
      h.appendChild(line("Volume", slider(0, 100, q.volume, (v) => { q.volume = v; State.save(); })));
      h.appendChild(line("Output device", null, "Speakers (Cameron Systems High Definition Audio)"));
      h.appendChild(line("Input device", null, "Microphone Array"));
    } },
    notifications: { title: "Notifications", parent: "system", build(h) {
      const q = qs();
      h.appendChild(line("Do not disturb", toggle(!!q.focus, (v) => { q.focus = v; State.save(); }), "Notifications go straight to the notification center"));
    } },
    power: { title: "Power & battery", parent: "system", build(h) {
      h.appendChild(line("Battery level", null, "86% — about 5 hrs 20 min remaining"));
      const lock = el(`<button class="w12s-btn">Lock now</button>`); lock.onclick = () => { if (window.Lock) Lock.run(() => {}); };
      h.appendChild(line("Lock your PC", lock, "Shortcut: Windows + L"));
    } },
    storage: { title: "Storage", parent: "system", build(h) {
      let used = 0; try { used = JSON.stringify(S()).length; } catch (_) {}
      const cap = 5 * 1024 * 1024, pct = Math.min(100, used / cap * 100);
      h.appendChild(card(`<div class="w12s-row-t">Local disk (C:)</div><div class="w12s-bar"><i style="width:${Math.max(2, pct).toFixed(1)}%"></i></div><div class="w12s-row-s">${(used / 1024).toFixed(0)} KB used of 5 MB browser storage</div>`));
      h.appendChild(line("Installed apps", null, (S().installedApps || []).length + " apps from the Store"));
    } },
    multitask: { title: "Multitasking", parent: "system", build(h) {
      h.appendChild(line("Snap windows", null, "Drag a window to the edge of the screen to snap it"));
      h.appendChild(line("Alt + Tab", null, "Switch between open windows"));
    } },
    activation: { title: "Activation", parent: "system", build(h) {
      h.appendChild(line("Activation state", null, S().hasProductKey ? "Active — Windows is activated with a product key" : "Not active"));
      if (S().hasProductKey) h.appendChild(line("Product key", null, esc(S().productKey || "")));
      h.appendChild(line("Edition", null, "Windows 12 Home"));
    } },
    troubleshoot: { title: "Troubleshoot", parent: "system", build(h) {
      const b = el(`<button class="w12s-btn">Run</button>`); b.onclick = () => { b.disabled = true; b.textContent = "Running…"; setTimeout(() => { b.textContent = "No problems found"; }, 1600); };
      h.appendChild(line("Internet Connections", b, "Find and fix problems with connecting to the internet"));
    } },
    recovery: { title: "Recovery", parent: "system", build(h) {
      const b = el(`<button class="w12s-btn w12s-btn-danger">Reset PC</button>`); b.onclick = () => window.WM.factoryReset();
      h.appendChild(line("Reset this PC", b, "Start over: removes your apps, files and settings"));
      if (window.Recovery) Recovery.settingsRecovery(h, { line, card, el, note });
    } },
    about: { title: "About", parent: "system", build(h) {
      const inp = el(`<input class="w12s-input" maxlength="15" value="${esc(S().deviceName || deviceName())}">`);
      const save = el(`<button class="w12s-btn">Rename this PC</button>`); save.onclick = () => { S().deviceName = inp.value.trim() || deviceName(); State.save(); note("Your PC is now called " + S().deviceName + "."); };
      const r = line("Device name", save); r.querySelector(".w12s-row-txt").appendChild(inp); h.appendChild(r);
      h.appendChild(card(`<div class="w12s-row-t">Device specifications</div><table class="w12s-spec">
        <tr><td>Device name</td><td>${esc(S().deviceName || deviceName())}</td></tr><tr><td>Processor</td><td>Cameron Systems Virtual CPU @ 3.40 GHz</td></tr>
        <tr><td>Installed RAM</td><td>16.0 GB</td></tr><tr><td>System type</td><td>64-bit operating system</td></tr></table>`));
      h.appendChild(card(`<div class="w12s-row-t">Windows specifications</div><table class="w12s-spec">
        <tr><td>Edition</td><td>Windows 12 Home</td></tr><tr><td>Version</td><td>26H1 (simulation)</td></tr><tr><td>Registered to</td><td>${esc(userName())}</td></tr></table>
        <p class="w12s-row-s" style="margin-top:8px">A pretend computer made for fun. Not affiliated with Microsoft.</p>
        <p class="w12s-row-s">Some app icons by <a class="w12s-link" style="font-size:inherit" href="https://icons8.com" target="_blank" rel="noopener">Icons8</a>.</p>`));
      if (window.Recovery) Recovery.settingsAbout(h, { line, card, el, note });
    } },
    devmgr: { title: "Devices & drivers", parent: "devices", build(h) {
      const touch = /iPad|iPhone/.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
      const dev = (name, sub, status, ok, extra) => { const c = card(`<div class="w12s-row-t">${name}</div><table class="w12s-spec">${sub}</table><div class="w12s-row-s" style="color:${ok ? "#2a8a3e" : "#a35a00"}">${status}</div>`); if (extra) c.appendChild(extra); h.appendChild(c); };
      const fpBox = el(`<div></div>`); h.appendChild(fpBox);
      if (window.TouchID) TouchID.available().then((ok) => {
        if (!ok) return;   // no sensor → nothing to list
        const i = TouchID.driverInfo();
        const set = el(`<div style="display:flex;gap:8px"></div>`);
        if (ok) { const b = el(`<button class="w12s-btn">${TouchID.enrolled() ? "Sign-in options" : "Set up fingerprint"}</button>`); b.onclick = () => openSubRef("signin"); set.appendChild(b); }
        const c = card(`<div class="w12s-row-t">${ok ? esc(i.name) : "Fingerprint sensor"}</div>${ok ? `<table class="w12s-spec"><tr><td>Driver</td><td>${esc(i.driver)}</td></tr><tr><td>Version</td><td>${esc(i.version)}</td></tr><tr><td>Provider</td><td>${esc(i.provider)}</td></tr><tr><td>Date</td><td>${esc(i.date)}</td></tr></table>` : ""}<div class="w12s-row-s" style="color:${ok ? "#2a8a3e" : "#8a8a96"}">${ok ? "✓ This device is working properly." + (TouchID.enrolled() ? " A fingerprint is set up." : " No fingerprint set up yet.") : "Not found — this device doesn't have a fingerprint reader."}</div>`);
        c.appendChild(set); fpBox.appendChild(c);
      });
      dev(touch ? "Touch screen" : "Mouse", `<tr><td>Driver</td><td>${touch ? "HID-compliant touch screen" : "HID-compliant mouse"}</td></tr><tr><td>Version</td><td>10.0.26100.1</td></tr>`, "✓ This device is working properly.", true);
      dev("Keyboard", `<tr><td>Driver</td><td>Standard PS/2 Keyboard</td></tr><tr><td>Version</td><td>10.0.26100.1</td></tr>`, "✓ This device is working properly.", true);
      dev("Display adapter", `<tr><td>Driver</td><td>Microsoft Basic Display Adapter</td></tr><tr><td>Resolution</td><td>${screen.width} × ${screen.height}</td></tr>`, "✓ This device is working properly.", true);
    } },
    mouse: { title: "Mouse", parent: "devices", build(h) {
      const d = S().appData.mouse || (S().appData.mouse = { speed: 6, primary: "left", scroll: 3 });
      h.appendChild(line("Primary mouse button", select([["left", "Left"], ["right", "Right"]], d.primary, (v) => { d.primary = v; State.save(); })));
      h.appendChild(line("Mouse pointer speed", slider(1, 11, d.speed, (v) => { d.speed = v; State.save(); })));
      h.appendChild(line("Lines to scroll at a time", slider(1, 10, d.scroll, (v) => { d.scroll = v; State.save(); })));
    } },
    wifinets: { title: "Wi-Fi networks", parent: "network", build(h, redraw) {
      const q = qs();
      if (!window.Radios) { h.appendChild(line(q.wifi ? "HomeNetwork_5G" : "No network", null, q.wifi ? "Connected, secured" : "Wi-Fi is off")); return; }
      h.appendChild(el(`<div class="rad-banner rad-info" style="margin-bottom:2px"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/></svg><div>No web browser can scan for nearby Wi-Fi networks or join one — that's only possible in your device's own settings. The first card is your <b>real</b> connection; the list below it is <b>simulated</b> for fun, and "joining" one only changes the name shown here.</div></div>`));
      // The real connection (status live; name simulated)
      const cur = card(`<div class="w12s-row-t">Current connection</div><div class="rad-cur"></div>`), curBox = cur.querySelector(".rad-cur");
      const paintCur = () => {
        const conn = Radios.net.isConnected();
        curBox.innerHTML = `<div class="rad-net-row ${conn ? "on" : ""}"><span class="rad-dev-ic" style="${conn ? "" : "opacity:.45"}">${ic("wifi")}</span><div class="rad-dev-txt"><div class="rad-dev-name">${conn ? esc(q.ssid || "HomeNetwork_5G") : "Not connected"}<span class="rad-tag rad-tag-real">real status</span></div><div class="rad-dev-sub">${esc(Radios.net.summary())}</div></div></div>`;
      };
      paintCur(); h.appendChild(cur);
      let seen = false; const off = Radios.on(() => { if (!cur.isConnected) { if (seen) off(); return; } seen = true; paintCur(); });
      requestAnimationFrame(() => { if (cur.isConnected) seen = true; });
      // Simulated nearby networks
      const nets = [["HomeNetwork_5G", 4, true], ["HomeNetwork", 3, true], ["CoffeeShop_Guest", 2, false], ["NETGEAR-42", 2, true], ["Library-Free-WiFi", 1, false]];
      const list = card(`<div class="w12s-row-t">Nearby networks <span class="rad-tag">simulated</span></div><div class="rad-devs"></div>`), lb = list.querySelector(".rad-devs");
      const curName = q.ssid || "HomeNetwork_5G";
      nets.forEach(([name, bars, secure]) => {
        const isCur = q.wifi && name === curName;
        const r = el(`<div class="rad-net-row ${isCur ? "on" : ""}"><span class="rad-dev-ic">${ic("wifi")}</span><div class="rad-dev-txt"><div class="rad-dev-name">${esc(name)}</div><div class="rad-dev-sub">${isCur ? "Shown as your network (simulated name)" : (secure ? "Secured" : "Open") + " · signal " + "▮".repeat(bars) + "▯".repeat(4 - bars)}</div></div><span class="rad-dev-btns"></span></div>`);
        const b = el(`<button class="w12s-btn">${isCur ? "Disconnect" : "Connect"}</button>`);
        b.onclick = () => {
          if (isCur) { q.wifi = false; State.save(); refreshWifi(); Radios.emit(); redraw(); return; }
          b.disabled = true; b.textContent = "Connecting… (simulated)";
          setTimeout(() => { q.ssid = name; q.wifi = true; q.plane = false; State.save(); refreshWifi(); Radios.emit(); note("Now showing " + name + " as your network (simulated). Your device's real connection didn't change."); if (h.isConnected) redraw(); }, 1100);
        };
        r.querySelector(".rad-dev-btns").appendChild(b);
        lb.appendChild(r);
      });
      h.appendChild(list);
    } },
    background: { title: "Background", parent: "personal", build(h, redraw) {
      const cur = S().desktop.wallpaper || "default";
      const walls = [["default", "assets/wall3.jpg"], ["assets/wall4.jpg"], ["assets/wall5.jpg"], ["assets/wall6.jpg"], ["assets/wall2.jpg"]];
      const set = (v) => { S().desktop.wallpaper = v; State.save(); window.applyWallpaper(); redraw(); };
      const c1 = card(`<div class="w12s-row-t">Pictures</div><div class="w12s-walls"></div>`);
      walls.forEach(([v, img]) => { const s = el(`<button class="w12s-wall ${cur === v ? "sel" : ""}" style="background-image:url(${img || v})"></button>`); s.onclick = () => set(v); c1.querySelector(".w12s-walls").appendChild(s); });
      h.appendChild(c1);
      const c2 = card(`<div class="w12s-row-t">Solid colors</div><div class="w12s-walls"></div>`);
      ["#0067c0", "#7b5cff", "#e53935", "#43a047", "#fb8c00", "#00897b", "#222", "#111827", "#5a189a", "#b5179e", "#006466"].forEach((c) => { const s = el(`<button class="w12s-wall w12s-solid ${cur === c ? "sel" : ""}" style="background:${c}"></button>`); s.onclick = () => set(c); c2.querySelector(".w12s-walls").appendChild(s); });
      h.appendChild(c2);
      const up = el(`<button class="w12s-btn">Browse photos</button>`);
      up.onclick = () => { const inp = document.getElementById("globalFileInput"); inp.accept = "image/*"; inp.value = ""; inp.onchange = () => { const fl = inp.files[0]; if (!fl) return; const r = new FileReader(); r.onload = () => { S().desktop.wallpaper = r.result; State.save(); window.applyWallpaper(); redraw(); }; r.readAsDataURL(fl); }; inp.click(); };
      h.appendChild(line("Choose a photo", up));
    } },
    icons: { title: "Personalize icons", parent: "personal", build(h) { const box = el(`<div class="w12s-legacy"></div>`); h.appendChild(box); SettingsParts.renderIconCustomizer(box); } },
    installed: { title: "Installed apps", parent: "apps", build(h, redraw) {
      const all = (window.Catalog && Catalog.storeApps) || [];
      const mine = all.filter((a) => SettingsParts.isInstalled(a.id)).sort((a, b) => a.name.localeCompare(b.name));
      h.appendChild(el(`<div class="w12s-row-s" style="margin:0 0 8px 4px">${mine.length} apps found</div>`));
      mine.forEach((a) => {
        const fromStore = (S().installedApps || []).includes(a.id);
        const r = el(`<div class="w12s-row w12s-row-static"><span class="w12s-app-ic">${Icon.mini(a.id, a.name)}</span><div class="w12s-row-txt"><div class="w12s-row-t">${esc(a.name)}</div><div class="w12s-row-s">${esc(a.cat || "App")}${fromStore ? " · From Microsoft Store" : " · Built in"}</div></div><div class="w12s-row-ctl"><button class="w12s-btn">Open</button>${fromStore ? `<button class="w12s-btn">Uninstall</button>` : ""}</div></div>`);
        const [open, un] = r.querySelectorAll("button");
        open.onclick = () => WM.open(a.id);
        if (un) un.onclick = () => { const i = S().installedApps.indexOf(a.id); if (i >= 0) S().installedApps.splice(i, 1); State.save(); if (WM.refreshDesktopIcons) WM.refreshDesktopIcons(); note(a.name + " was uninstalled."); redraw(); };
        h.appendChild(r);
      });
    } },
    devicesync: { title: "Windows Backup", parent: "accounts", build(h, redraw) {
      const DS = window.DeviceSync;
      if (!DS) { h.appendChild(el(`<div class="w12s-row-s">Backup is unavailable on this device.</div>`)); return; }
      const kind = DS.passwordKind();
      h.appendChild(card(`<div class="w12s-row-t">Back up &amp; move this desktop</div><div class="w12s-row-s">Copy your files, apps, settings and desktop to another device. The backup is end-to-end encrypted with your ${kind} — the other device has to enter it to restore. Nothing is stored online.</div>`));

      // ---- SHARE (old device) ----
      const shareCard = card(`<div class="w12s-row-t">Send to another device</div><div class="w12s-row-s">On the device you want to copy, tap Start sharing to get a code, then enter that code on the new device below.</div><div class="w12s-sync-share"></div>`);
      const sb = shareCard.querySelector(".w12s-sync-share");
      const startBtn = el(`<button class="w12s-btn w12s-btn-accent">Start sharing</button>`);
      sb.appendChild(startBtn);
      startBtn.onclick = async () => {
        const code = DS.newCode();
        sb.innerHTML = `<div class="w12s-synccode">${code}</div><div class="w12s-row-s">Enter this code on the new device while this screen stays open.</div><div class="w12s-syncstatus" data-state="starting">Starting…</div>`;
        const sst = sb.querySelector(".w12s-syncstatus");
        try { await DS.startShare(code, (st) => { sst.textContent = st.message; sst.dataset.state = st.state; }); }
        catch (e) { sst.textContent = (e && e.message) || "Couldn't start sharing."; sst.dataset.state = "error"; }
      };
      h.appendChild(shareCard);

      // ---- RESTORE (new device) ----
      const restoreCard = card(`<div class="w12s-row-t">Restore from another device</div><div class="w12s-row-s">Enter the 5-character code shown on your other device (it stays open while you connect).</div>`);
      const codeIn = el(`<input class="w12s-input w12s-codein" maxlength="5" placeholder="e.g. 7K2QF" autocapitalize="characters" autocomplete="off" spellcheck="false">`);
      codeIn.oninput = () => { codeIn.value = codeIn.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5); };
      const connBtn = el(`<button class="w12s-btn w12s-btn-accent">Connect</button>`);
      const rrow = line("Pairing code", connBtn); rrow.querySelector(".w12s-row-txt").appendChild(codeIn); restoreCard.appendChild(rrow);
      const rstat = el(`<div class="w12s-syncstatus"></div>`); restoreCard.appendChild(rstat);
      const pwWrap = el(`<div class="w12s-sync-pw"></div>`); pwWrap.hidden = true; restoreCard.appendChild(pwWrap);
      connBtn.onclick = async () => {
        const code = codeIn.value.trim();
        if (code.length !== 5) { rstat.textContent = "Enter the full 5-character code."; rstat.dataset.state = "error"; return; }
        rstat.textContent = "Connecting…"; rstat.dataset.state = "connecting"; pwWrap.hidden = true; pwWrap.innerHTML = ""; connBtn.disabled = true;
        try {
          await DS.startRestore(code, (st) => {
            rstat.textContent = st.message; rstat.dataset.state = st.state;
            if (st.state === "error") connBtn.disabled = false;
            if (st.state !== "received") return;
            connBtn.disabled = false;
            const p = st.payload;
            pwWrap.hidden = false;
            pwWrap.innerHTML = `<div class="w12s-row-s">Paired with <b>${esc(p.name || "that device")}</b>. Enter the previous ${esc(p.kind || "password")} to finish restoring.</div>`;
            const pin = el(`<input class="w12s-input" type="password" placeholder="${p.hasPassword ? "Previous " + esc(p.kind) : "(no password was set — just continue)"}">`);
            const go = el(`<button class="w12s-btn w12s-btn-accent">Restore desktop</button>`);
            const err = el(`<div class="w12s-err"></div>`);
            const prow = line("Previous " + (p.kind || "password"), go); prow.querySelector(".w12s-row-txt").appendChild(pin); pwWrap.append(prow, err);
            pin.focus();
            const doRestore = async () => {
              if (p.hasPassword && !pin.value) { err.textContent = "Enter the previous " + (p.kind || "password") + "."; return; }
              err.textContent = ""; go.disabled = true; go.textContent = "Restoring…";
              try { await DS.applyRestore(p, pin.value); /* reloads on success */ }
              catch (_) { err.textContent = "That " + (p.kind || "password") + " isn't right. Try again."; go.disabled = false; go.textContent = "Restore desktop"; }
            };
            go.onclick = doRestore;
            pin.onkeydown = (e) => { if (e.key === "Enter") doRestore(); };
          });
        } catch (e) { rstat.textContent = (e && e.message) || "Couldn't connect."; rstat.dataset.state = "error"; connBtn.disabled = false; }
      };
      h.appendChild(restoreCard);

      // ---- file backup (offline fallback) ----
      const fileCard = card(`<div class="w12s-row-t">Or use a backup file</div><div class="w12s-row-s">Download a backup you can move with AirDrop, email or a USB drive, then restore it on the other device. Works even without a live connection.</div>`);
      const btns = el(`<span style="display:inline-flex;gap:8px"></span>`);
      const dl = el(`<button class="w12s-btn">Download backup</button>`); dl.onclick = () => { DS.downloadBackup(); note("Backup downloaded."); };
      const rf = el(`<button class="w12s-btn">Restore from file…</button>`);
      rf.onclick = () => { const inp = document.getElementById("globalFileInput"); inp.accept = "application/json,.json"; inp.value = ""; inp.onchange = () => { const fl = inp.files[0]; if (fl) DS.restoreFromFile(fl, (msg) => note(msg)); }; inp.click(); };
      btns.append(dl, rf);
      fileCard.appendChild(line("Backup file", btns));
      h.appendChild(fileCard);
    } },
    yourinfo: { title: "Your info", parent: "accounts", build(h, redraw) {
      const pr = profile();
      const top = el(`<div class="w12s-hero" style="margin-bottom:10px">${avatar(84)}<div><div class="w12s-hero-big">${esc(userName())}</div><div class="w12s-hero-sub">${esc(userSub())}</div></div></div>`);
      h.appendChild(top);
      const pic = el(`<button class="w12s-btn">Browse files</button>`);
      pic.onclick = () => { const inp = document.getElementById("globalFileInput"); inp.accept = "image/*"; inp.value = ""; inp.onchange = () => { const fl = inp.files[0]; if (!fl) return; const r = new FileReader(); r.onload = () => { pr.picture = r.result; State.save(); redraw(); }; r.readAsDataURL(fl); }; inp.click(); };
      h.appendChild(line("Choose a photo", pic, "Shown on the lock screen, Start and here"));
      if (pr.picture) { const rm = el(`<button class="w12s-btn">Remove</button>`); rm.onclick = () => { pr.picture = null; State.save(); redraw(); }; h.appendChild(line("Remove photo", rm)); }
      const nameIn = el(`<input class="w12s-input" maxlength="24" value="${esc(userName())}">`);
      const save = el(`<button class="w12s-btn">Save</button>`);
      save.onclick = () => { const v = nameIn.value.trim(); if (!v) return; pr.username = v; State.save(); note("Your name is now " + v + "."); redraw(); };
      const r = line("Your name", save); r.querySelector(".w12s-row-txt").appendChild(nameIn); h.appendChild(r);
    } },
    signin: { title: "Sign-in options", parent: "accounts", build(h) {
      const pr = profile(), isPin = pr.authType === "pin";
      const errMsg = (e, fallback) => (e && e.message === "cancelled") ? "" : ((e && e.friendly) || fallback);
      const when = (t) => t ? new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";
      // Touch ID / Face ID / Windows Hello — the device's real sensor (WebAuthn passkey).
      const tName = window.TouchID ? TouchID.sensorName() : "Touch ID";
      const fp = card(`<div class="w12s-row-t">${esc(tName)} (fingerprint or face)</div><div class="w12s-row-s w12s-fp-s">Checking this device…</div><div class="w12s-fp-btns"></div><div class="w12s-err"></div>`);
      h.appendChild(fp);
      const fs = fp.querySelector(".w12s-fp-s"), fb = fp.querySelector(".w12s-fp-btns"), fe = fp.querySelector(".w12s-err");
      const paintFp = () => {
        if (!window.TouchID) { fp.remove(); return; }
        TouchID.available().then((real) => {
          fb.innerHTML = ""; fe.textContent = "";
          const on = TouchID.enrolled();
          if (!real && !on) { fs.textContent = TouchID.isNative ? "Touch ID / Face ID isn't set up on this iPad (iPad Settings → Touch ID & Passcode)." : "Not available in this browser. " + tName + " needs a device with a fingerprint or face sensor, a browser that supports passkeys, and an https page."; return; }
          if (on) {
            fs.textContent = TouchID.isNative
              ? "On — the Windows 12 app uses your iPad's real " + TouchID.sensorName() + " directly. No passkey."
              : "On — your device's real " + tName + " checks your fingerprint or face (through a passkey), and Windows 12 checks the signed answer." + (real ? "" : " The sensor isn't reachable in this browser right now.");
            const t = el(`<button class="w12s-btn">Test it</button>`); t.onclick = () => TouchID.verify().then(() => { fe.textContent = ""; note(tName + " recognized ✓"); }).catch((e) => { fe.textContent = errMsg(e, "Not recognized — try again."); });
            const r = el(`<button class="w12s-btn">Remove</button>`); r.onclick = () => { TouchID.forget(); note(tName + " removed. You can also delete its passkey from your device's saved passwords."); paintFp(); };
            fb.append(t, r);
          } else {
            fs.textContent = TouchID.isNative
              ? "Unlock and pay with your iPad's real " + TouchID.sensorName() + ". The Windows 12 app uses it directly — no passkey."
              : "Unlock and pay with your device's real " + tName + ". Setting it up saves a passkey for this site.";
            const a = el(`<button class="w12s-btn w12s-btn-accent">Set up</button>`);
            a.onclick = () => TouchID.enroll().then(() => { note(tName + " set up ✓"); paintFp(); }).catch((e) => { fe.textContent = errMsg(e, "Setup didn't finish."); });
            fb.append(a);
          }
        });
      };
      paintFp();
      // Security keys — real WebAuthn roaming authenticators (USB / NFC / Bluetooth).
      const sk = card(`<div class="w12s-row-t">Security key</div><div class="w12s-row-s w12s-sk-s"></div><div class="w12s-sk-list"></div><div class="w12s-fp-btns w12s-sk-btns"></div><div class="w12s-err"></div>`);
      h.appendChild(sk);
      const paintSk = () => {
        const ss = sk.querySelector(".w12s-sk-s"), sl = sk.querySelector(".w12s-sk-list"), sb = sk.querySelector(".w12s-sk-btns"), se = sk.querySelector(".w12s-err");
        sl.innerHTML = ""; sb.innerHTML = ""; se.textContent = "";
        if (!window.SecurityKey || !SecurityKey.supported()) { ss.textContent = "This browser can't use security keys here (it needs WebAuthn and an https page)."; return; }
        const keys = SecurityKey.list();
        ss.textContent = keys.length ? "Sign in by plugging in or tapping your key." : "Sign in with a physical key such as a YubiKey or Titan key (USB, NFC or Bluetooth).";
        keys.forEach((k) => {
          const row = el(`<div class="w12s-sk-row"><span class="w12s-sk-name"></span><span class="w12s-row-s">Added ${esc(when(k.at))}${k.last ? " · last used " + esc(when(k.last)) : ""}</span><span class="w12s-sk-act"></span></div>`);
          row.querySelector(".w12s-sk-name").textContent = k.name;
          const rn = el(`<button class="w12s-btn">Rename</button>`); rn.onclick = () => { const v = prompt("Name this key:", k.name); if (v && v.trim()) { SecurityKey.rename(k.id, v.trim().slice(0, 40)); paintSk(); } };
          const rm = el(`<button class="w12s-btn">Remove</button>`); rm.onclick = () => { if (confirm("Remove “" + k.name + "”? You won't be able to sign in with it.")) { SecurityKey.remove(k.id); note("Security key removed."); paintSk(); } };
          row.querySelector(".w12s-sk-act").append(rn, rm); sl.appendChild(row);
        });
        const add = el(`<button class="w12s-btn w12s-btn-accent">${keys.length ? "Add another key" : "Add a security key"}</button>`);
        add.onclick = () => SecurityKey.add().then((k) => { note("“" + k.name + "” added ✓"); paintSk(); }).catch((e) => { se.textContent = errMsg(e, "The key wasn't added."); });
        sb.appendChild(add);
        if (keys.length) { const t = el(`<button class="w12s-btn">Test a key</button>`); t.onclick = () => SecurityKey.verify().then((k) => { se.textContent = ""; note("“" + k.name + "” works ✓"); paintSk(); }).catch((e) => { se.textContent = errMsg(e, "Key not recognized."); }); sb.appendChild(t); }
      };
      paintSk();
      // Password (in addition to the PIN) — stored as a salted PBKDF2 hash.
      if (isPin && window.PasswordAuth) {
        const pc = card(`<div class="w12s-row-t">Password</div><div class="w12s-row-s">${PasswordAuth.has() ? "On — you can also sign in with your password." : "Add a password as another way to sign in. Only a salted hash is stored."}</div>
          <input class="w12s-input" type="password" autocomplete="new-password" placeholder="${PasswordAuth.has() ? "New password" : "Password"}">
          <input class="w12s-input" type="password" autocomplete="new-password" placeholder="Confirm password">
          <div class="w12s-err"></div><div class="w12s-fp-btns"><button class="w12s-btn w12s-btn-accent w12s-pw-set">${PasswordAuth.has() ? "Change password" : "Add password"}</button>${PasswordAuth.has() ? `<button class="w12s-btn w12s-pw-rm">Remove</button>` : ""}</div>`);
        const [p1, p2] = pc.querySelectorAll("input"), pe = pc.querySelector(".w12s-err");
        pc.querySelector(".w12s-pw-set").onclick = async () => {
          if (p1.value.length < 4) { pe.textContent = "Use at least 4 characters."; return; }
          if (p1.value !== p2.value) { pe.textContent = "They don't match. Try again."; return; }
          const had = PasswordAuth.has();
          try { await PasswordAuth.set(p1.value); } catch (e) { pe.textContent = e.message; return; }
          p1.value = p2.value = ""; pe.textContent = ""; note(had ? "Your password was changed." : "Password added ✓"); openSubRef("signin");
        };
        const rmb = pc.querySelector(".w12s-pw-rm"); if (rmb) rmb.onclick = () => { if (confirm("Remove your password? You can still sign in with your PIN.")) { PasswordAuth.clear(); note("Password removed."); openSubRef("signin"); } };
        h.appendChild(pc);
      }
      h.appendChild(line("Require sign-in", toggle(!!pr.requireSignIn, (v) => { pr.requireSignIn = v; State.save(); }), "Hide “Skip (test mode)” on the lock screen"));
      h.appendChild(line(isPin ? "PIN (Windows Hello)" : "Password", null, "This is how you sign in on the lock screen"));
      const c = card(`<div class="w12s-row-t">Change your ${isPin ? "PIN" : "password"}</div>
        <input class="w12s-input" type="password" placeholder="New ${isPin ? "PIN" : "password"}" ${isPin ? 'inputmode="numeric"' : ""}>
        <input class="w12s-input" type="password" placeholder="Confirm ${isPin ? "PIN" : "password"}" ${isPin ? 'inputmode="numeric"' : ""}>
        <div class="w12s-err"></div><button class="w12s-btn w12s-btn-accent">Change</button>`);
      const [a, b] = c.querySelectorAll("input"), err = c.querySelector(".w12s-err");
      c.querySelector("button").onclick = () => {
        if (isPin && !/^\d{4,6}$/.test(a.value)) { err.textContent = "Your PIN must be 4 to 6 numbers."; return; }
        if (!a.value) { err.textContent = "Type a new password."; return; }
        if (a.value !== b.value) { err.textContent = "They don't match. Try again."; return; }
        pr.secret = a.value; State.save(); a.value = b.value = ""; err.textContent = ""; note("Your " + (isPin ? "PIN" : "password") + " was changed.");
      };
      h.appendChild(c);
    } },
    email: { title: "Email & accounts", parent: "accounts", build(h) {
      h.appendChild(line(S().account ? esc(S().account.email) : "No accounts yet", null, S().account ? "Microsoft account · used by Outlook, Calendar and the Store" : "Add a Microsoft account to use email and the Store"));
    } },
    datetime: { title: "Date & time", parent: "time", build(h, redraw) {
      const pf = prefs();
      h.appendChild(line("Set time automatically", toggle(pf.autoTime, (v) => { pf.autoTime = v; State.save(); })));
      h.appendChild(line("24-hour clock", toggle(!!S().clock.format24, (v) => { S().clock.format24 = v; State.save(); redraw(); }), "Example: " + State.formatClock()));
      let tz = ""; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (_) {}
      h.appendChild(line("Time zone", null, esc(tz || "Automatic")));
    } },
    language: { title: "Language & region", parent: "time", build(h) {
      h.appendChild(line("Country or region", null, esc(S().region || "United States")));
      h.appendChild(line("Windows display language", null, esc(S().language || "English")));
      h.appendChild(line("Regional format", null, esc(navigator.language || "en-US")));
    } },
    uphistory: { title: "Update history", parent: "update", build(h) {
      const done = S().update && S().update.installed;
      SettingsParts.UPDATES.forEach((u) => h.appendChild(line(esc(u.name), null, done ? "Successfully installed" : "Pending install")));
    } },
  };

  // Sub-pages added by other files (e.g. js/accounts.js → "otherusers"): window.SettingsSubs[key] = { title, parent, build(h, redraw, helpers) }.
  const subPage = (k) => SUB[k] || (window.SettingsSubs && Object.prototype.hasOwnProperty.call(window.SettingsSubs, k) && window.SettingsSubs[k]) || null;

  // ---------- the app ----------
  AppRegistry.settings = function () {
    const { body } = WM.createWindow({ title: "Settings", icon: Icon.mini("settings", "Settings"), width: 1000, height: 640, appId: "settings" });
    body.innerHTML = `<div class="w12s">
      <svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><linearGradient id="w12s-g" gradientUnits="userSpaceOnUse" x1="3" y1="21" x2="21" y2="3"><stop offset="0" stop-color="#ad6eca"/><stop offset="1" stop-color="#3b91d8"/></linearGradient></defs></svg>
      <aside class="w12s-side">
        <button class="w12s-user" title="Your info"></button>
        <label class="w12s-search"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg><input placeholder="Find a setting" data-no-eye></label>
        <nav class="w12s-nav">${NAV.map((n) => `<a class="w12s-nav-it" data-p="${n.id}"><span class="w12s-nav-ic">${Icon.mini(n.ic, n.name)}</span><span>${n.name}</span></a>`).join("")}<span class="w12s-focus"></span></nav>
      </aside>
      <main class="w12s-page"></main>
    </div>`;
    const page = body.querySelector(".w12s-page"), nav = body.querySelector(".w12s-nav"), focus = body.querySelector(".w12s-focus");
    const userBtn = body.querySelector(".w12s-user"), search = body.querySelector(".w12s-search input");
    let cur = "system";

    function paintUser() { userBtn.innerHTML = `${avatar(56)}<span class="w12s-user-txt"><b>${esc(userName())}</b><span>${esc(userSub())}</span></span>`; }
    userBtn.onclick = () => openSub("yourinfo");
    function markNav(id) {
      nav.querySelectorAll(".w12s-nav-it").forEach((a) => a.classList.toggle("on", a.dataset.p === id));
      const a = nav.querySelector(`.w12s-nav-it[data-p="${id}"]`);
      if (a) { focus.style.top = (a.offsetTop + a.offsetHeight / 2 - 9) + "px"; focus.style.opacity = "1"; } else focus.style.opacity = "0";
    }
    nav.querySelectorAll(".w12s-nav-it").forEach((a) => a.onclick = () => { search.value = ""; go(a.dataset.p); });

    function rowEl(r) {
      const has = r.sub || r.act || r.expand;
      const row = el(`<div class="w12s-row ${has ? "w12s-click" : "w12s-row-static"}" tabindex="${has ? 0 : -1}"><span class="w12s-row-ic">${ic(r.ic)}</span><div class="w12s-row-txt"><div class="w12s-row-t">${esc(r.t)}</div><div class="w12s-row-s">${esc(r.s || "")}</div></div><div class="w12s-row-ctl"></div>${has ? `<span class="w12s-chev ${r.expand ? "down" : ""}"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 6l6 6-6 6"/></svg></span>` : ""}</div>`);
      if (r.ctl) row.querySelector(".w12s-row-ctl").appendChild(r.ctl());
      if (r.sub) row.onclick = () => openSub(r.sub);
      else if (r.act) row.onclick = r.act;
      else if (r.expand) {
        let panel = null;
        row.onclick = () => {
          if (panel) { panel.remove(); panel = null; row.classList.remove("open"); return; }
          panel = el(`<div class="w12s-panel"></div>`); r.expand(panel); row.after(panel); row.classList.add("open");
        };
      }
      row.addEventListener("keydown", (e) => { if (e.key === "Enter" && row.onclick) row.onclick(); });
      return row;
    }

    function go(id) {
      cur = id; markNav(id); page.innerHTML = ""; page.scrollTop = 0;
      const n = NAV.find((x) => x.id === id);
      page.appendChild(el(`<h1 class="w12s-title">${esc(n ? n.name : id)}</h1>`));
      const h = hero(id, page); if (h) { page.appendChild(h); h.querySelectorAll("[data-go]").forEach((a) => a.onclick = () => go(a.dataset.go)); h.querySelectorAll("[data-sub]").forEach((a) => a.onclick = () => openSub(a.dataset.sub)); }
      const list = el(`<div class="w12s-list"></div>`);
      (pages()[id] || []).forEach((r) => list.appendChild(rowEl(r)));
      page.appendChild(list);
      paintUser();
    }

    function openSub(key) {
      const sp = subPage(key); if (!sp) return;
      markNav(sp.parent); page.innerHTML = ""; page.scrollTop = 0;
      const parent = NAV.find((x) => x.id === sp.parent);
      const head = el(`<h1 class="w12s-title"><a class="w12s-crumb">${esc(parent.name)}</a><span class="w12s-crumb-sep">›</span>${esc(sp.title)}</h1>`);
      head.querySelector(".w12s-crumb").onclick = () => go(sp.parent);
      page.appendChild(head);
      const box = el(`<div class="w12s-list"></div>`); page.appendChild(box);
      sp.build(box, () => openSub(key), { line, card, el, note, esc, toggle });
      paintUser();
    }

    // Search: every row title / description across all sections
    search.addEventListener("input", () => {
      const t = search.value.trim().toLowerCase();
      if (!t) { go(cur); return; }
      markNav(null); page.innerHTML = ""; page.appendChild(el(`<h1 class="w12s-title">Search results</h1>`));
      const list = el(`<div class="w12s-list"></div>`); page.appendChild(list);
      const all = pages(); let n = 0;
      NAV.forEach((sec) => (all[sec.id] || []).forEach((r) => {
        if ((r.t + " " + (r.s || "") + " " + sec.name).toLowerCase().includes(t)) {
          n++; const row = rowEl(Object.assign({}, r, { s: sec.name + " · " + (r.s || "") }));
          if (!r.sub && !r.act && !r.expand && !r.ctl) { row.classList.add("w12s-click"); row.onclick = () => { search.value = ""; go(sec.id); }; }
          list.appendChild(row);
        }
      }));
      if (!n) list.appendChild(el(`<div class="w12s-empty">No results for “${esc(search.value)}”. Try another word.</div>`));
    });

    // Window-level helpers used by the rows
    goRef = go; subRef = openSub;
    paintUser();
    const start = window.SettingsStartPage; window.SettingsStartPage = null;   // e.g. "personal" from the desktop menu
    if (start && subPage(start)) openSub(start); else go(start && NAV.some((n) => n.id === start) ? start : "system");
    requestAnimationFrame(() => markNav(cur));
  };
  // rows built in pages() call go(): route to the most recently opened Settings window
  let goRef = () => {}, subRef = () => {};
  function go(id) { goRef(id); }
  function openSubRef(k) { subRef(k); }

  // ---------- expanding panels (Personalization) ----------
  function buildColors(panel) {
    const cur = S().accent || "#0067c0";
    panel.innerHTML = `<div class="w12s-row-s" style="margin-bottom:6px">Current color</div><div class="w12s-accent-now" style="background:${cur}"></div><div class="w12s-row-s" style="margin:12px 0 6px">Windows colors</div><div class="w12s-accents"></div><div class="w12s-row-s" style="margin:12px 0 6px">Custom color</div><div class="w12s-custom"></div>`;
    const setAccent = (hx) => { S().accent = hx; State.save(); document.documentElement.style.setProperty("--accent", hx); panel.querySelector(".w12s-accent-now").style.background = hx; panel.querySelectorAll(".w12s-acc").forEach((b) => b.classList.toggle("sel", b.dataset.c.toLowerCase() === hx.toLowerCase())); };
    ["#0067c0", "#0078d4", "#2a5bd7", "#6b57ff", "#8a5cf6", "#b146c2", "#e3008c", "#e81123", "#da3b01", "#ff8c00", "#ffb900", "#107c10", "#00b294", "#038387", "#4a5459", "#1d1d21"].forEach((c) => {
      const b = el(`<button class="w12s-acc ${c === cur.toLowerCase() ? "sel" : ""}" data-c="${c}" style="background:${c}"></button>`); b.onclick = () => setAccent(c); panel.querySelector(".w12s-accents").appendChild(b);
    });
    const picker = SettingsParts.makeColorPicker(cur, setAccent); panel.querySelector(".w12s-custom").appendChild(picker.el);
  }
  function buildThemes(panel) {
    const xp = !!(S().desktop && S().desktop.xpTheme);
    panel.innerHTML = `<div class="w12s-themes"><button class="w12s-theme ${xp ? "" : "sel"}" data-t="w12"><span style="background-image:url(assets/wall3.jpg)"></span>Windows 12</button><button class="w12s-theme ${xp ? "sel" : ""}" data-t="xp"><span style="background-image:url(assets/xp_wallpaper.png)"></span>Windows XP</button></div>`;
    panel.querySelectorAll(".w12s-theme").forEach((b) => b.onclick = () => {
      const on = b.dataset.t === "xp"; S().desktop.xpTheme = on; S().desktop.wallpaper = on ? "assets/xp_wallpaper.png" : "default";
      document.body.classList.toggle("xp-theme", on); State.save(); window.applyWallpaper();
      panel.querySelectorAll(".w12s-theme").forEach((x) => x.classList.toggle("sel", x === b));
    });
  }
})();
