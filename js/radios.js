/* Radios — the real-hardware side of Bluetooth and Wi-Fi.
   Bluetooth: Web Bluetooth (Chrome / Edge / Opera on desktop & Android, HTTPS or localhost,
   started from a tap) scans for and connects to real Bluetooth Low Energy devices and reads
   their battery level / maker over GATT. Safari / iOS have no Web Bluetooth.
   Wi-Fi: no browser can scan for or join Wi-Fi networks. What IS real: online/offline state,
   the Network Information API (type, effective type, estimated speed, round-trip time) and a
   timed request to this site. Everything here degrades gracefully when an API is missing.
   Exposes window.Radios — settings12.js and the window manager use it when present. */
(function () {
  "use strict";

  // ---------- tiny helpers ----------
  const listeners = new Set();
  function emit() { listeners.forEach((fn) => { try { fn(); } catch (e) { console.warn("[Radios]", e); } }); }
  function on(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  const data = () => (window.State && State.data) || null;
  const save = () => { try { if (window.State && State.save) State.save(); } catch (_) {} };
  function qs() {
    const d = data(); if (!d) return { wifi: true, bt: false, plane: false, signal: "good" };
    if (!d.appData) d.appData = {};
    if (!d.appData.quickSettings) d.appData.quickSettings = { wifi: true, bt: false, plane: false, night: false, focus: false, brightness: 90, volume: 55, signal: "good" };
    return d.appData.quickSettings;
  }
  function store() {
    const d = data(); if (!d) return { devices: [] };
    if (!d.appData) d.appData = {};
    const b = d.appData.bluetooth || (d.appData.bluetooth = { devices: [] });
    if (!Array.isArray(b.devices)) b.devices = [];
    return b;
  }
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  function withTimeout(p, ms, what) {
    let t; return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(new Error((what || "Request") + " timed out")), ms); })]).finally(() => clearTimeout(t));
  }
  function notify(body, title) { try { if (window.Notify) Notify.show({ icon: "", title: esc(title || "Bluetooth"), body: esc(body) }); } catch (_) {} }

  // ====================================================================
  //  BLUETOOTH (real, via Web Bluetooth)
  // ====================================================================
  const UNSUPPORTED_MSG = "This browser can't access Bluetooth hardware. Open this page in Chrome or Edge on a computer or Android device with Bluetooth to pair real devices.";
  const OPTIONAL_SERVICES = ["battery_service", "device_information", "heart_rate", "generic_access"];
  const bt = {
    adapter: null,        // true / false from getAvailability(); null = unknown
    busy: false,          // the chooser / a connection is in progress
    message: "",          // last status line ("Connecting to …", errors)
    messageKind: "",      // "", "ok", "err"
    live: {},             // id -> { device, server, connected, connecting, battery, hr, manual }
  };
  const btApi = () => (typeof navigator !== "undefined" && navigator.bluetooth) || null;
  function btSupported() { const b = btApi(); return !!(b && typeof b.requestDevice === "function"); }
  function btReason() {
    if (btSupported()) return "";
    if (typeof window.isSecureContext === "boolean" && !window.isSecureContext) return "Bluetooth only works when this page is opened over HTTPS (or on localhost). " + UNSUPPORTED_MSG;
    return UNSUPPORTED_MSG;
  }
  let msgTimer = 0;
  function setMsg(text, kind) {
    bt.message = text || ""; bt.messageKind = kind || ""; emit();
    clearTimeout(msgTimer);   // status lines fade after a while; errors stay until the next action
    if (bt.message && kind !== "err" && !/…$/.test(bt.message)) msgTimer = setTimeout(() => { if (bt.message === text) { bt.message = ""; bt.messageKind = ""; emit(); } }, 10000);
  }

  function record(id) { return store().devices.find((d) => d.id === id) || null; }
  function remember(device) {
    const s = store();
    let r = record(device.id);
    if (!r) { r = { id: device.id, name: device.name || "Unnamed device", pairedAt: Date.now() }; s.devices.push(r); }
    if (device.name) r.name = device.name;
    save();
    return r;
  }
  function liveOf(device) {
    const L = bt.live[device.id] || (bt.live[device.id] = { device, connected: false, connecting: false });
    L.device = device;
    if (!L.hooked) {
      L.hooked = true;
      device.addEventListener("gattserverdisconnected", () => {
        const was = L.connected; L.connected = false; L.connecting = false; L.server = null;
        const r = record(device.id); if (r) { r.lastSeen = Date.now(); save(); }
        if (was && !L.manual) { const nm = r ? r.name : device.name || "Device"; setMsg(nm + " disconnected.", ""); notify(nm + " disconnected (out of range or turned off)."); }
        else emit();
        L.manual = false;
      });
    }
    return L;
  }
  const decodeText = (dv) => { try { return new TextDecoder("utf-8").decode(dv.buffer.slice(dv.byteOffset, dv.byteOffset + dv.byteLength)).replace(/\0+$/, "").trim(); } catch (_) { return ""; } };

  async function readInfo(device, server) {
    const r = record(device.id) || remember(device), L = liveOf(device);
    const found = [];
    // Battery level (0x180F / 0x2A19)
    try {
      const svc = await withTimeout(server.getPrimaryService("battery_service"), 6000, "Battery service");
      found.push("battery");
      const ch = await withTimeout(svc.getCharacteristic("battery_level"), 6000, "Battery level");
      const v = await withTimeout(ch.readValue(), 6000, "Battery read");
      L.battery = r.battery = v.getUint8(0);
      try {
        if (ch.properties && ch.properties.notify) {
          await ch.startNotifications();
          ch.addEventListener("characteristicvaluechanged", (e) => { try { L.battery = r.battery = e.target.value.getUint8(0); save(); emit(); } catch (_) {} });
        }
      } catch (_) {}
    } catch (_) {}
    // Maker & model (0x180A)
    try {
      const svc = await withTimeout(server.getPrimaryService("device_information"), 6000, "Device information");
      found.push("info");
      for (const [key, uuid] of [["manufacturer", "manufacturer_name_string"], ["model", "model_number_string"]]) {
        try { const ch = await withTimeout(svc.getCharacteristic(uuid), 5000); const t = decodeText(await withTimeout(ch.readValue(), 5000)); if (t) r[key] = t; } catch (_) {}
      }
    } catch (_) {}
    // Device name from Generic Access (0x1800 / 0x2A00) when the advert had none
    try {
      const svc = await withTimeout(server.getPrimaryService("generic_access"), 5000, "Generic access");
      const ch = await withTimeout(svc.getCharacteristic("gap.device_name"), 5000);
      const t = decodeText(await withTimeout(ch.readValue(), 5000));
      if (t && (!device.name || r.name === "Unnamed device")) r.name = t;
    } catch (_) {}
    // Heart rate (0x180D / 0x2A37) — live beats per minute
    try {
      const svc = await withTimeout(server.getPrimaryService("heart_rate"), 5000, "Heart rate");
      found.push("heart");
      const ch = await withTimeout(svc.getCharacteristic("heart_rate_measurement"), 5000);
      await ch.startNotifications();
      ch.addEventListener("characteristicvaluechanged", (e) => {
        try { const v = e.target.value, f = v.getUint8(0); L.hr = (f & 1) ? v.getUint16(1, true) : v.getUint8(1); emit(); } catch (_) {}
      });
    } catch (_) {}
    if (found.includes("heart")) r.kind = "heart";
    else if (!r.kind) r.kind = "generic";
    r.services = found;
    save();
  }

  async function connectDevice(device) {
    const L = liveOf(device), r = remember(device);
    if (!device.gatt) { setMsg(r.name + " doesn't offer a connection the browser can use.", "err"); return r; }
    L.connecting = true; L.manual = false;
    setMsg("Connecting to " + r.name + "…", "");
    try {
      const server = await withTimeout(device.gatt.connect(), 20000, "Connecting");
      L.server = server; L.connected = true; L.connecting = false;
      r.lastConnected = Date.now();
      qs().bt = true; save();
      setMsg("Connected to " + r.name + ". Reading device info…", "ok");
      await readInfo(device, server);
      setMsg("Connected to " + r.name + (r.battery != null ? " · battery " + r.battery + "%" : "") + ".", "ok");
    } catch (e) {
      L.connecting = false; L.connected = !!(device.gatt && device.gatt.connected);
      setMsg("Couldn't connect to " + r.name + ": " + friendlyError(e) + ".", "err");
    }
    emit();
    return r;
  }

  function friendlyError(e) {
    const m = (e && e.message) || String(e || "unknown error");
    if (/adapter not available|bluetooth.*(off|unavailable)|no bluetooth adapter/i.test(m)) return "no Bluetooth adapter is available — make sure Bluetooth is turned on in your computer's own settings";
    if (/cancel/i.test(m)) return "no device was chosen";
    if (/out of range|no longer in range/i.test(m)) return "the device is out of range or turned off";
    if (e && e.name === "SecurityError") return "the browser blocked Bluetooth here (it needs a tap, HTTPS, and no restricting frame)";
    if (e && e.name === "NotAllowedError") return "Bluetooth permission was denied";
    if (/timed out/i.test(m)) return "the device didn't answer in time";
    return m.replace(/\.$/, "");
  }

  // Opens the browser's real device chooser. Must be called straight from a click / tap.
  function pair() {
    if (!btSupported()) { setMsg(btReason(), "err"); return Promise.resolve(null); }
    if (bt.busy) return Promise.resolve(null);
    let p;
    try {
      p = btApi().requestDevice({ acceptAllDevices: true, optionalServices: OPTIONAL_SERVICES });
    } catch (e) { setMsg("Couldn't open the Bluetooth chooser: " + friendlyError(e) + ".", "err"); return Promise.resolve(null); }
    bt.busy = true; setMsg("Choose a device in the browser's Bluetooth window…", "");
    return p.then((device) => {
      bt.adapter = true;
      const q = qs(); q.bt = true; q.plane = false; save();
      return connectDevice(device);
    }).catch((e) => {
      const m = (e && e.message) || "";
      if (e && e.name === "NotFoundError" && /cancel/i.test(m)) setMsg("No device was chosen.", "");
      else if (/adapter not available/i.test(m)) { bt.adapter = false; setMsg("No Bluetooth adapter is available. Turn Bluetooth on in your computer's settings, or use a device that has Bluetooth.", "err"); }
      else setMsg("Pairing didn't finish: " + friendlyError(e) + ".", "err");
      return null;
    }).finally(() => { bt.busy = false; emit(); });
  }

  async function findDevice(id) {
    const L = bt.live[id]; if (L && L.device) return L.device;
    const b = btApi();
    if (b && typeof b.getDevices === "function") {
      try { const list = await b.getDevices(); const d = list.find((x) => x.id === id); if (d) { liveOf(d); return d; } } catch (_) {}
    }
    return null;
  }
  async function connect(id) {
    const r = record(id);
    const device = await findDevice(id);
    if (!device) { setMsg("The browser no longer remembers " + (r ? r.name : "this device") + ". Use Add device to pair it again.", "err"); return; }
    qs().bt = true; qs().plane = false; save();
    // Remembered devices may need to be seen advertising before a connection succeeds.
    if (typeof device.watchAdvertisements === "function" && !(device.gatt && device.gatt.connected)) {
      try {
        const L = liveOf(device);
        L.connecting = true; setMsg("Looking for " + (r ? r.name : "the device") + " nearby…", "");
        await withTimeout(device.gatt.connect(), 8000, "Connecting").then((server) => { L.server = server; }).catch(async () => {
          const ac = new AbortController();
          await withTimeout(new Promise((res) => { device.addEventListener("advertisementreceived", res, { once: true }); device.watchAdvertisements({ signal: ac.signal }).catch(() => {}); }), 15000, "Searching").finally(() => ac.abort());
        });
      } catch (e) { const L = bt.live[id]; if (L) L.connecting = false; setMsg("Couldn't find " + (r ? r.name : "the device") + ": " + friendlyError(e) + ".", "err"); return; }
    }
    await connectDevice(device);
  }
  function disconnect(id) {
    const L = bt.live[id];
    if (L && L.device && L.device.gatt) { L.manual = true; try { L.device.gatt.disconnect(); } catch (_) {} }
    if (L) { L.connected = false; L.connecting = false; L.server = null; }
    const r = record(id); setMsg((r ? r.name : "Device") + " disconnected.", "");
  }
  async function remove(id) {
    const r = record(id);
    disconnect(id);
    const device = await findDevice(id);
    if (device && typeof device.forget === "function") { try { await device.forget(); } catch (_) {} }
    delete bt.live[id];
    const s = store(); s.devices = s.devices.filter((d) => d.id !== id); save();
    setMsg((r ? r.name : "Device") + " was removed.", "");
  }
  // The simulated Bluetooth switch. Turning it off really disconnects real devices.
  function setEnabled(v) {
    const q = qs(); q.bt = !!v; if (v) q.plane = false; save();
    if (!v) Object.keys(bt.live).forEach((id) => { const L = bt.live[id]; if (L.connected || L.connecting) { L.manual = true; try { L.device.gatt.disconnect(); } catch (_) {} L.connected = false; L.connecting = false; } });
    emit();
  }
  function devices() {
    return store().devices.map((r) => {
      const L = bt.live[r.id] || {};
      return Object.assign({}, r, { connected: !!L.connected, connecting: !!L.connecting, battery: L.battery != null ? L.battery : r.battery, hr: L.hr, known: !!L.device });
    });
  }
  function connectedCount() { return Object.values(bt.live).filter((L) => L.connected).length; }
  function btSummary() {
    if (!btSupported()) return "Not available in this browser";
    if (bt.adapter === false) return "No Bluetooth adapter found on this device";
    const n = connectedCount();
    if (n) return n + " real device" + (n > 1 ? "s" : "") + " connected";
    if (!qs().bt) return "Off";
    return bt.adapter ? "Ready — Bluetooth adapter found" : "Ready";
  }
  function initBluetooth() {
    const b = btApi(); if (!b) return;
    try {
      if (typeof b.getAvailability === "function") b.getAvailability().then((ok) => { bt.adapter = !!ok; emit(); }).catch(() => {});
      b.addEventListener && b.addEventListener("availabilitychanged", (e) => { bt.adapter = !!e.value; emit(); });
    } catch (_) {}
    // Re-attach devices this site was allowed to use before (Chrome: getDevices()).
    if (typeof b.getDevices === "function") {
      b.getDevices().then((list) => {
        list.forEach((d) => { liveOf(d); const r = record(d.id); if (r && d.name) r.name = d.name; });
        emit();
      }).catch(() => {});
    }
  }

  // ====================================================================
  //  NETWORK (real, read-only)
  // ====================================================================
  const net = { latency: null, lastTest: 0, testing: false, error: "", reachable: null, jitter: null };
  const connApi = () => navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
  function netInfo() {
    const c = connApi(), q = qs();
    return {
      online: navigator.onLine !== false,
      infoSupported: !!c,
      type: c && c.type ? c.type : "",
      effectiveType: c && c.effectiveType ? c.effectiveType : "",
      downlink: c && typeof c.downlink === "number" ? c.downlink : null,
      rtt: c && typeof c.rtt === "number" ? c.rtt : null,
      saveData: !!(c && c.saveData),
      latency: net.latency, jitter: net.jitter, lastTest: net.lastTest, testing: net.testing, error: net.error, reachable: net.reachable,
      wifiOn: q.wifi !== false, plane: !!q.plane,
    };
  }
  // Connected = the device is really online AND the simulated Wi-Fi switch is on.
  function isConnected() { const n = netInfo(); return n.online && n.wifiOn && n.reachable !== false; }
  function fmtSpeed(mbps) { return mbps == null ? "" : (mbps >= 10 ? "~" + Math.round(mbps) : "~" + (Math.round(mbps * 10) / 10)) + " Mbps"; }
  function linkType(n) {
    if (n.type && n.type !== "unknown" && n.type !== "other") return n.type === "wifi" ? "Wi-Fi" : n.type === "ethernet" ? "Ethernet" : n.type;
    return n.effectiveType || "";
  }
  function netParts(n) {
    const parts = [];
    const t = linkType(n); if (t) parts.push(t);
    if (n.effectiveType && t !== n.effectiveType) parts.push(n.effectiveType);
    if (n.downlink != null && n.downlink > 0) parts.push(fmtSpeed(n.downlink));
    if (n.latency != null) parts.push(n.latency + " ms");
    else if (n.rtt) parts.push("~" + n.rtt + " ms rtt");
    return parts;
  }
  function netSummary() {
    const n = netInfo();
    if (!n.online) return "Disconnected — this device is offline (real)";
    if (n.reachable === false) return "Connected to a network, but this site can't be reached (real)";
    if (!n.wifiOn) return n.plane ? "Airplane mode is on (simulated) — your device is still online" : "Wi-Fi switched off here (simulated) — your device is still online";
    const p = netParts(n);
    return "Connected (real)" + (p.length ? " — " + p.join(", ") : "");
  }
  function iconKey() {
    const n = netInfo();
    if (!isConnected()) return "wifi_disabled";
    if (/^(slow-2g|2g)$/.test(n.effectiveType) || (n.latency != null && n.latency > 800) || qs().signal === "poor") return "wifi_poor";
    return "wifi";
  }
  async function timedFetch() {
    const ac = typeof AbortController === "function" ? new AbortController() : null;
    const t = setTimeout(() => ac && ac.abort(), 8000);
    const url = location.href.split("#")[0];
    const t0 = performance.now();
    try {
      let res = await fetch(url, { method: "HEAD", cache: "no-store", signal: ac && ac.signal });
      if (res.status === 405 || res.status === 501) res = await fetch(url, { cache: "no-store", signal: ac && ac.signal });
      return Math.round(performance.now() - t0);
    } finally { clearTimeout(t); }
  }
  // Runs 3 timed requests to this site's server and keeps the best (lowest) time.
  async function runTest() {
    if (net.testing) return netInfo();
    net.testing = true; net.error = ""; emit();
    try {
      if (navigator.onLine === false) throw new Error("This device is offline");
      const times = [];
      for (let i = 0; i < 3; i++) times.push(await timedFetch());
      times.sort((a, b) => a - b);
      net.latency = times[0]; net.jitter = times[times.length - 1] - times[0]; net.reachable = true;
    } catch (e) {
      net.latency = null; net.jitter = null;
      net.reachable = navigator.onLine === false ? null : false;
      net.error = navigator.onLine === false ? "This device is offline." : "Couldn't reach the server" + (e && e.name === "AbortError" ? " (timed out)" : "") + ".";
    }
    net.testing = false; net.lastTest = Date.now(); emit();
    return netInfo();
  }
  let netTimer = 0;
  function netChanged(retest) {
    if (navigator.onLine === false) { net.latency = null; net.reachable = null; }
    emit();
    if (retest && navigator.onLine !== false) { clearTimeout(netTimer); netTimer = setTimeout(runTest, 600); }
  }
  function initNetwork() {
    window.addEventListener("online", () => netChanged(true));
    window.addEventListener("offline", () => netChanged(false));
    const c = connApi(); if (c && c.addEventListener) c.addEventListener("change", () => netChanged(true));
    setTimeout(() => { if (navigator.onLine !== false) runTest(); }, 2500);
  }

  // ====================================================================
  //  UI pieces (settings pages + quick settings)
  // ====================================================================
  const SVG = {
    bt: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 7l10 10-5 4V3l5 4L7 17"/></svg>',
    heart: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>',
    wifi: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.5 16a5 5 0 0 1 7 0"/><path d="M12 19.5h.01" stroke-width="3"/></svg>',
    wifioff: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.5 16a5 5 0 0 1 7 0" opacity=".35"/><path d="M3 3l18 18"/></svg>',
    info: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/></svg>',
  };
  // Re-render `root` on every change for as long as it stays in the page.
  function live(root, paint) {
    let seen = false;
    const off = on(() => { if (!root.isConnected) { if (seen) off(); return; } seen = true; paint(); });
    paint();
    requestAnimationFrame(() => { if (root.isConnected) seen = true; });
    return root;
  }
  function ago(ts) { if (!ts) return ""; const s = Math.round((Date.now() - ts) / 1000); return s < 5 ? "just now" : s < 60 ? s + " s ago" : Math.round(s / 60) + " min ago"; }
  function batteryBar(pct) { return `<span class="rad-batt" title="Battery ${pct}%"><i style="width:${Math.max(4, Math.min(100, pct))}%;background:${pct <= 15 ? "#e5484d" : "#38c172"}"></i></span>${pct}%`; }

  // Settings → Bluetooth & devices: real device list + pairing status.
  function btPanel() {
    const root = el(`<div class="rad-bt w12s-card"></div>`);
    return live(root, () => {
      const sup = btSupported(), list = devices();
      let status;
      if (!sup) status = `<div class="rad-banner rad-warn">${SVG.info}<div><b>Real Bluetooth isn't available here</b><div>${esc(btReason())}</div><div class="rad-dim">The Bluetooth switch above still works as part of the simulation.</div></div></div>`;
      else if (bt.adapter === false) status = `<div class="rad-banner rad-warn">${SVG.info}<div><b>No Bluetooth adapter found</b><div>This browser supports Bluetooth, but it can't find a radio on this device (or Bluetooth is turned off in the computer's own settings). Turn it on there, then try Add device.</div></div></div>`;
      else status = `<div class="rad-banner rad-ok">${SVG.bt}<div><b>Real Bluetooth is available</b><div>${bt.adapter ? "A Bluetooth adapter was found. " : ""}Tap <b>Add device</b> to pick a nearby Bluetooth Low Energy device (watch, heart-rate strap, sensor, some headphones and keyboards). Your browser shows its own list and asks for permission.</div></div></div>`;
      root.innerHTML = `<div class="rad-head"><div class="w12s-row-t">Your real Bluetooth devices</div><span class="rad-pill ${sup && bt.adapter !== false ? "rad-pill-ok" : ""}">${esc(btSummary())}</span></div>${status}
        ${sup ? `<div class="rad-actions"><button class="w12s-btn w12s-btn-accent rad-add" ${bt.busy ? "disabled" : ""}>${bt.busy ? "Waiting for the chooser…" : "Add device"}</button></div>` : ""}
        ${bt.message ? `<div class="rad-msg ${bt.messageKind === "err" ? "rad-msg-err" : bt.messageKind === "ok" ? "rad-msg-ok" : ""}">${esc(bt.message)}</div>` : ""}
        <div class="rad-devs"></div>`;
      const box = root.querySelector(".rad-devs");
      if (!list.length) box.innerHTML = `<div class="rad-empty">${sup ? "No real devices paired yet." : "Real devices you pair in Chrome or Edge will be listed here."}</div>`;
      list.forEach((d) => {
        const bits = [d.connecting ? "Connecting…" : d.connected ? "Connected" : "Not connected"];
        if (d.manufacturer) bits.push(d.manufacturer + (d.model ? " " + d.model : ""));
        if (d.hr) bits.push("♥ " + d.hr + " bpm");
        if (!d.connected && d.lastConnected) bits.push("last connected " + new Date(d.lastConnected).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }));
        const row = el(`<div class="rad-dev ${d.connected ? "on" : ""}"><span class="rad-dev-ic">${d.kind === "heart" ? SVG.heart : SVG.bt}</span><div class="rad-dev-txt"><div class="rad-dev-name">${esc(d.name)}</div><div class="rad-dev-sub">${esc(bits.join(" · "))}</div></div>${d.battery != null ? `<span class="rad-dev-batt">${batteryBar(d.battery)}</span>` : ""}<span class="rad-dev-btns"></span></div>`);
        const btns = row.querySelector(".rad-dev-btns");
        const mk = (label, fn, cls) => { const b = el(`<button class="w12s-btn ${cls || ""}">${label}</button>`); b.onclick = (e) => { e.stopPropagation(); fn(); }; btns.appendChild(b); return b; };
        if (sup) {
          if (d.connected) mk("Disconnect", () => disconnect(d.id));
          else { const c = mk("Connect", () => connect(d.id)); if (d.connecting) c.disabled = true; }
        }
        mk("Remove", () => remove(d.id));
        box.appendChild(row);
      });
      const add = root.querySelector(".rad-add"); if (add) add.onclick = () => pair();
    });
  }

  // Settings → Network & internet: real connection details + "Run network test".
  function netPanel() {
    const root = el(`<div class="rad-net w12s-card"></div>`);
    return live(root, () => {
      const n = netInfo();
      const row = (k, v) => `<tr><td>${k}</td><td>${v}</td></tr>`;
      const latency = !n.online ? "Unavailable while offline" : n.testing ? "Testing…" : n.latency != null ? `${n.latency} ms <span class="rad-dim">(best of 3, to this site's server${n.jitter != null ? ", ±" + n.jitter + " ms" : ""})</span>` : n.error ? esc(n.error) : "Not tested yet";
      const realType = n.type && n.type !== "unknown" && n.type !== "other" ? linkType(n) : "";
      root.innerHTML = `<div class="rad-head"><div class="w12s-row-t">Your real connection</div><span class="rad-pill ${n.online ? "rad-pill-ok" : "rad-pill-bad"}">${n.online ? "Online" : "Offline"}</span></div>
        <table class="w12s-spec rad-spec">
          ${row("Status", n.online ? (n.reachable === false ? "Online, but this site didn't answer" : "Connected to the internet") : "Offline — no network connection")}
          ${row("Connection type", esc(realType || "Not reported by this browser"))}
          ${n.online && n.effectiveType ? row("Speed class", esc(n.effectiveType) + ' <span class="rad-dim">(effective type)</span>') : ""}
          ${n.online && n.downlink != null ? row("Estimated speed", fmtSpeed(n.downlink) + ' <span class="rad-dim">(browser estimate, capped at 10)</span>') : ""}
          ${n.online && n.rtt ? row("Estimated round trip", "~" + n.rtt + " ms") : ""}
          ${row("Measured latency", latency)}
          ${n.saveData ? row("Data saver", "On") : ""}
          ${n.online && n.lastTest ? row("Last tested", ago(n.lastTest)) : ""}
        </table>
        <div class="rad-actions"><button class="w12s-btn w12s-btn-accent rad-test" ${n.testing || !n.online ? "disabled" : ""}>${n.testing ? "Testing…" : "Run network test"}</button></div>
        <div class="rad-banner rad-info">${SVG.info}<div>Websites can't scan for or join Wi-Fi networks, or read the network's name. The status above is your device's <b>real</b> connection${n.infoSupported ? "" : " (this browser doesn't share connection type or speed, so only online status and measured latency are shown)"}. Network names and joining other networks on this page are <b>simulated</b>.</div></div>`;
      const t = root.querySelector(".rad-test"); if (t) t.onclick = () => runTest();
    });
  }

  // Quick Settings strip: one real Wi-Fi line and one real Bluetooth line.
  function quickStatus() {
    const root = el(`<div class="rad-qs"></div>`);
    return live(root, () => {
      const n = netInfo(), sup = btSupported();
      const conn = isConnected();
      const wifiTxt = !n.online ? "Offline (real)" : !n.wifiOn ? "Wi-Fi off (simulated)" : n.reachable === false ? "No internet (real)" : ["Connected (real)"].concat(netParts(n)).join(" · ");
      const btTxt = !sup ? "Not available in this browser" : bt.busy ? "Choose a device…" : btSummary();
      root.innerHTML = `<div class="rad-qs-line ${conn ? "on" : "off"}"><span class="rad-qs-ic">${conn ? SVG.wifi : SVG.wifioff}</span><span class="rad-qs-txt" title="${esc(netSummary())}">${esc(wifiTxt)}</span><button class="rad-qs-btn rad-qs-test" ${n.testing || !n.online ? "disabled" : ""}>${n.testing ? "Testing…" : "Test"}</button></div>
        <div class="rad-qs-line ${connectedCount() ? "on" : "off"}"><span class="rad-qs-ic">${SVG.bt}</span><span class="rad-qs-txt" title="${esc(sup ? btSummary() : UNSUPPORTED_MSG)}">${esc(btTxt)}</span>${sup ? `<button class="rad-qs-btn rad-qs-add" ${bt.busy ? "disabled" : ""}>Add device</button>` : `<button class="rad-qs-btn rad-qs-why">Why?</button>`}</div>
        ${bt.message && bt.messageKind === "err" ? `<div class="rad-qs-msg">${esc(bt.message)}</div>` : ""}`;
      root.querySelector(".rad-qs-test").onclick = (e) => { e.stopPropagation(); runTest(); };
      const a = root.querySelector(".rad-qs-add"); if (a) a.onclick = (e) => { e.stopPropagation(); pair(); };
      const w = root.querySelector(".rad-qs-why"); if (w) w.onclick = (e) => { e.stopPropagation(); setMsg(btReason(), "err"); };
    });
  }

  // Called by the Quick Settings Bluetooth tile (a real tap, so the chooser may open).
  function quickTile() {
    const q = qs();
    if (q.bt) { setEnabled(false); return false; }
    setEnabled(true);
    if (btSupported()) pair();
    else setMsg(btReason(), "err");   // shown in the Quick Settings strip
    return true;
  }

  window.Radios = {
    on, emit,
    bt: {
      supported: btSupported, reason: btReason, UNSUPPORTED_MSG,
      adapter: () => bt.adapter, busy: () => bt.busy, message: () => bt.message,
      pair, connect, disconnect, remove, setEnabled, devices, connectedCount, summary: btSummary,
    },
    net: { info: netInfo, test: runTest, summary: netSummary, iconKey, isConnected, parts: () => netParts(netInfo()), linkType: () => linkType(netInfo()) },
    ui: { btPanel, netPanel, quickStatus, quickTile },
  };

  initBluetooth();
  initNetwork();
})();
