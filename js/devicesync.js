/* DeviceSync — move your whole Windows 12 desktop to another device.

   The old device shows a 5-character code (numbers + letters). The new device
   enters it while both are open; they connect directly over WebRTC (PeerJS's
   free broker is used only to introduce them — no desktop data is stored on any
   server). The backup is end-to-end encrypted with your PIN/password using
   AES-GCM, so the new device must enter the previous password to decrypt and
   restore. A plain file backup is offered as an offline fallback. */
(function () {
  "use strict";
  const S = () => State.data;
  const STORAGE_KEY = "win12_state_v1";
  const PEER_LIB = "https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.4/peerjs.min.js";
  // Unambiguous charset (no 0/O, 1/I/L) for an easy-to-read 5-char code.
  const CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const PID = (code) => "w12sync-" + String(code).toUpperCase();

  function newCode() {
    let c = "", a = crypto.getRandomValues(new Uint32Array(5));
    for (let i = 0; i < 5; i++) c += CHARS[a[i] % CHARS.length];
    return c;
  }

  // ---------- crypto (PBKDF2 -> AES-GCM) ----------
  function b64(u) { let s = "", C = 0x8000; for (let i = 0; i < u.length; i += C) s += String.fromCharCode.apply(null, u.subarray(i, i + C)); return btoa(s); }
  function ub64(s) { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
  async function deriveKey(password, salt) {
    const km = await crypto.subtle.importKey("raw", new TextEncoder().encode(password || ""), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 120000, hash: "SHA-256" }, km, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }
  async function encrypt(obj, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt);
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(obj))));
    return { v: 1, s: b64(salt), i: b64(iv), c: b64(ct) };
  }
  async function decrypt(pkg, password) {
    const key = await deriveKey(password, ub64(pkg.s));
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: ub64(pkg.i) }, key, ub64(pkg.c)); // throws on wrong password
    return JSON.parse(new TextDecoder().decode(pt));
  }

  // ---------- state helpers ----------
  function snapshot() { return JSON.parse(JSON.stringify(S())); }
  function devicePassword() { const p = S().profile; return (p && p.secret) || ""; }
  function hasPassword() { return !!devicePassword(); }
  function passwordKind() { const p = S().profile; return p && p.authType === "password" ? "password" : "PIN"; }
  function restore(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { alert("Couldn't save the restored desktop — it may be too large for this browser."); return; }
    location.reload();
  }

  // ---------- PeerJS ----------
  let peerLibP;
  function loadPeer() {
    if (window.Peer) return Promise.resolve();
    if (peerLibP) return peerLibP;
    peerLibP = new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = PEER_LIB; s.onload = res;
      s.onerror = () => { peerLibP = null; rej(new Error("Couldn't load the connection service. Check your internet and try again.")); };
      document.head.appendChild(s);
    });
    return peerLibP;
  }
  function friendlyErr(e) {
    const t = (e && (e.type || e.message || "")) + "";
    if (/unavailable-id|is taken/i.test(t)) return "That code is already in use — start sharing again for a new one.";
    if (/peer-unavailable/i.test(t)) return "No device is sharing with that code right now.";
    if (/browser-incompatible/i.test(t)) return "This browser can't make a direct connection. Use the backup file instead.";
    if (/network|server|socket|disconnected/i.test(t)) return "Couldn't reach the connection service. Check your internet and try again.";
    return "Connection problem — please try again, or use the backup file.";
  }

  // ---------- SHARE (old device) ----------
  async function startShare(code, cb) {
    await loadPeer();
    const peer = new Peer(PID(code), { debug: 1 });
    const pkgP = encrypt(snapshot(), devicePassword());
    peer.on("open", () => cb({ state: "waiting", message: "Ready — enter this code on the other device." }));
    peer.on("error", (e) => cb({ state: "error", message: friendlyErr(e) }));
    peer.on("connection", (conn) => {
      cb({ state: "connecting", message: "A device is connecting…" });
      conn.on("open", async () => {
        try {
          const pkg = await pkgP;
          conn.send({ type: "backup", pkg, hasPassword: hasPassword(), kind: passwordKind(), name: (S().profile && S().profile.username) || "User" });
          cb({ state: "sent", message: "Backup sent securely. The other device will ask for your " + passwordKind() + "." });
        } catch (e) { cb({ state: "error", message: "Couldn't prepare the backup." }); }
      });
      conn.on("error", (e) => cb({ state: "error", message: friendlyErr(e) }));
    });
    return { stop() { try { peer.destroy(); } catch (_) {} } };
  }

  // ---------- RESTORE (new device) ----------
  async function startRestore(code, cb) {
    await loadPeer();
    const peer = new Peer({ debug: 1 });
    let done = false;
    peer.on("error", (e) => { if (!done) cb({ state: "error", message: friendlyErr(e) }); });
    peer.on("open", () => {
      cb({ state: "connecting", message: "Connecting…" });
      const conn = peer.connect(PID(code), { reliable: true });
      const to = setTimeout(() => { if (!done) cb({ state: "error", message: "No device is sharing with that code. Open Windows Backup on the other device and start sharing first." }); }, 20000);
      conn.on("open", () => cb({ state: "connecting", message: "Connected — receiving your desktop…" }));
      conn.on("data", (msg) => {
        if (msg && msg.type === "backup") { done = true; clearTimeout(to); cb({ state: "received", message: "Paired.", payload: msg }); setTimeout(() => { try { peer.destroy(); } catch (_) {} }, 500); }
      });
      conn.on("error", (e) => { if (!done) { clearTimeout(to); cb({ state: "error", message: friendlyErr(e) }); } });
    });
    return { stop() { try { peer.destroy(); } catch (_) {} } };
  }
  async function applyRestore(payload, password) {
    const data = await decrypt(payload.pkg, password); // throws on wrong password
    restore(data);
  }

  // ---------- file backup ----------
  function downloadBackup() {
    const blob = new Blob([JSON.stringify(snapshot())], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "windows12-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  }
  function restoreFromFile(file, done) {
    const r = new FileReader();
    r.onload = () => { try { const d = JSON.parse(r.result); if (!d || typeof d !== "object" || !d.profile) throw 0; restore(d); } catch (_) { done && done("That file isn't a valid Windows 12 backup."); } };
    r.onerror = () => done && done("Couldn't read that file.");
    r.readAsText(file);
  }

  window.DeviceSync = { newCode, startShare, startRestore, applyRestore, hasPassword, passwordKind, downloadBackup, restoreFromFile, encrypt, decrypt, _snapshot: snapshot };
})();
