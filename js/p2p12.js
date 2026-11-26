/* P2P12 — the shared peer-to-peer layer for Phone Link, Nearby Sharing, Quick Assist and
   Remote Desktop (js/connect12.js) and the phone companion page (phone.html).

   Transport (one interface, two carriers):
     "peer" — WebRTC data channels via PeerJS (loaded from cdnjs on demand, same pattern as
              js/devicesync.js). PeerJS's free broker (0.peerjs.com) is used ONLY to introduce the two
              devices; after that every byte goes device-to-device.
     "loop" — a BroadcastChannel between tabs/windows of this same browser on this device. Nothing
              leaves the device. Used automatically when the other side is another tab here, and as
              the test transport.
   A host listens on both; a guest first knocks on the local channel (≈350 ms) and falls back to PeerJS.

   End-to-end encryption (on top of WebRTC's own DTLS):
     both sides make a fresh ECDH P-256 key pair and exchange public keys; the shared secret goes
     through HKDF-SHA-256 salted with the pairing code (and the feature name), giving an AES-GCM-256
     key plus a 6-digit confirmation number. The user compares that number on both screens (the
     "extra confirmation step") — if a broker or anyone in the middle swapped keys, the numbers differ.
     Each message is sealed with AES-GCM and a random 96-bit IV.

   QR codes: P2P12.qr(text) / P2P12.qrSvg(text) — a small self-contained QR encoder (byte mode,
   error correction M, versions 1–40), written for this project; no CDN.

   window.P2P12 = { newCode, normCode, loadPeer, host(app, code, opts), join(app, code, opts),
                    qr, qrSvg, b64, ub64, CHARS, transportPref } */
(function () {
  "use strict";
  if (window.P2P12) return;
  const PEER_LIB = "https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.4/peerjs.min.js";
  const CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I/L
  const enc = new TextEncoder(), dec = new TextDecoder();

  function newCode() {
    let c = ""; const a = crypto.getRandomValues(new Uint32Array(5));
    for (let i = 0; i < 5; i++) c += CHARS[a[i] % CHARS.length];
    return c;
  }
  function normCode(s) {
    return String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
  }
  const validCode = (c) => c && c.length === 5 && [...c].every((ch) => CHARS.includes(ch));

  // Which carriers to use: "auto" (default), "loop" (this device only), "peer" (internet only).
  function transportPref() {
    try { const v = window.P2P12_TRANSPORT || localStorage.getItem("w12p2p_transport"); if (v === "loop" || v === "peer") return v; } catch (_) {}
    return "auto";
  }

  // ---------------------------------------------------------------- bytes
  function b64(u) { u = u instanceof Uint8Array ? u : new Uint8Array(u); let s = ""; const C = 0x8000; for (let i = 0; i < u.length; i += C) s += String.fromCharCode.apply(null, u.subarray(i, i + C)); return btoa(s); }
  function ub64(s) { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
  function u8(x) {
    if (!x) return null;
    if (x instanceof Uint8Array) return x;
    if (x instanceof ArrayBuffer) return new Uint8Array(x);
    if (ArrayBuffer.isView(x)) return new Uint8Array(x.buffer, x.byteOffset, x.byteLength);
    if (typeof x === "object" && typeof x.length === "number") return Uint8Array.from(x);
    return null;
  }
  const ab = (u) => (u.byteOffset === 0 && u.byteLength === u.buffer.byteLength ? u.buffer : u.slice().buffer);
  function cat() { let n = 0; for (const a of arguments) n += a.length; const o = new Uint8Array(n); let k = 0; for (const a of arguments) { o.set(a, k); k += a.length; } return o; }
  function cmp(a, b) { for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i]; return a.length - b.length; }

  // ---------------------------------------------------------------- PeerJS loader (devicesync.js pattern)
  let peerLibP;
  function loadPeer() {
    if (window.Peer) return Promise.resolve();
    if (peerLibP) return peerLibP;
    peerLibP = new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = PEER_LIB; s.onload = () => (window.Peer ? res() : rej(new Error("The connection service didn't start.")));
      s.onerror = () => { peerLibP = null; rej(new Error("Couldn't load the connection service. Check your internet and try again.")); };
      document.head.appendChild(s);
    });
    return peerLibP;
  }
  function friendlyErr(e) {
    const t = (e && (e.type || e.message || "")) + "";
    if (/unavailable-id|is taken/i.test(t)) return "That code is already in use — try again for a new one.";
    if (/peer-unavailable/i.test(t)) return "No device is waiting with that code right now.";
    if (/browser-incompatible/i.test(t)) return "This browser can't make a direct connection.";
    if (/network|server|socket|disconnected|load/i.test(t)) return "Couldn't reach the connection service. Check your internet and try again.";
    return "Connection problem — please try again.";
  }

  // ---------------------------------------------------------------- raw links
  // A raw link: { kind, send(msg), onData(fn), onClose(fn), close(), buffered() }
  function mkRaw(kind, sendFn, closeFn, bufFn) {
    const dl = [], cl = []; let closed = false;
    return {
      kind,
      send(m) { if (!closed) { try { sendFn(m); } catch (e) { console.warn("p2p send", e); } } },
      onData(f) { dl.push(f); }, onClose(f) { cl.push(f); },
      _data(m) { dl.forEach((f) => { try { f(m); } catch (e) { console.error(e); } }); },
      _closed() { if (closed) return; closed = true; cl.forEach((f) => { try { f(); } catch (e) {} }); },
      close() { if (closed) return; try { closeFn && closeFn(); } catch (_) {} this._closed(); },
      buffered: () => (bufFn ? bufFn() : 0),
      get isClosed() { return closed; },
    };
  }
  const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

  // Loop (BroadcastChannel) host
  function loopHost(chanName, onRaw) {
    if (typeof BroadcastChannel !== "function") return null;
    const me = "h" + rid(), bc = new BroadcastChannel(chanName), links = new Map();
    let accepting = true;
    const maybeClose = () => { if (!accepting && !links.size) { try { bc.close(); } catch (_) {} } };
    bc.onmessage = (ev) => {
      const m = ev.data; if (!m || typeof m !== "object") return;
      if (m.k === "knock") {
        if (!accepting) return;
        bc.postMessage({ k: "welcome", to: m.from, from: me });
        if (links.has(m.from)) return;
        const raw = mkRaw("loop", (x) => bc.postMessage({ k: "d", to: m.from, from: me, m: x }), () => bc.postMessage({ k: "bye", to: m.from, from: me }));
        links.set(m.from, raw); raw.onClose(() => { links.delete(m.from); maybeClose(); });
        onRaw(raw);
      } else if (m.to === me && links.has(m.from)) {
        const raw = links.get(m.from);
        if (m.k === "d") raw._data(m.m); else if (m.k === "bye") raw._closed();
      }
    };
    // stop(true): stop accepting new devices but keep the ones already connected
    return { stop(keep) { accepting = false; if (keep) { maybeClose(); return; } links.forEach((r) => r.close()); try { bc.close(); } catch (_) {} } };
  }
  // Loop guest: resolves with a raw link, or null when nobody answers in time.
  function loopJoin(chanName, waitMs) {
    if (typeof BroadcastChannel !== "function") return Promise.resolve(null);
    return new Promise((res) => {
      const me = "g" + rid(), bc = new BroadcastChannel(chanName); let host = null, raw = null;
      const to = setTimeout(() => { if (!host) { try { bc.close(); } catch (_) {} res(null); } }, waitMs || 350);
      bc.onmessage = (ev) => {
        const m = ev.data; if (!m || m.to !== me) return;
        if (m.k === "welcome" && !host) {
          host = m.from; clearTimeout(to);
          raw = mkRaw("loop", (x) => bc.postMessage({ k: "d", to: host, from: me, m: x }), () => { bc.postMessage({ k: "bye", to: host, from: me }); setTimeout(() => { try { bc.close(); } catch (_) {} }, 50); });
          res(raw);
        } else if (raw && m.from === host) {
          if (m.k === "d") raw._data(m.m); else if (m.k === "bye") { raw._closed(); try { bc.close(); } catch (_) {} }
        }
      };
      bc.postMessage({ k: "knock", from: me });
    });
  }
  // PeerJS data connection → raw link
  function wrapConn(conn) {
    const raw = mkRaw("peer", (m) => conn.send(m), () => conn.close(), () => { try { return conn.dataChannel ? conn.dataChannel.bufferedAmount : 0; } catch (_) { return 0; } });
    conn.on("data", (m) => raw._data(m));
    conn.on("close", () => raw._closed());
    conn.on("error", () => raw._closed());
    return raw;
  }
  // PeerJS host
  async function peerHost(pid, onRaw, onStatus, tries) {
    await loadPeer();
    try { return await peerHostOnce(pid, onRaw, onStatus); }
    catch (e) {
      // the broker keeps a just-closed ID for a moment: retry a few times before giving up
      if (e.idTaken && (tries || 0) < 4) { await new Promise((r) => setTimeout(r, 1500)); return peerHost(pid, onRaw, onStatus, (tries || 0) + 1); }
      throw e;
    }
  }
  function peerHostOnce(pid, onRaw, onStatus) {
    return new Promise((res, rej) => {
      const peer = new window.Peer(pid, { debug: 0 });
      let opened = false, stopped = false; const conns = new Set();
      const maybeDestroy = () => { if (stopped && !conns.size) { try { peer.destroy(); } catch (_) {} } };
      peer.on("open", () => {
        opened = true;
        // stop(true): leave the broker (no new devices can find this code) but keep live connections
        res({ stop(keep) { stopped = true; if (keep) { try { peer.disconnect(); } catch (_) {} maybeDestroy(); } else { try { peer.destroy(); } catch (_) {} } }, peer });
      });
      peer.on("error", (e) => { if (!opened) { try { peer.destroy(); } catch (_) {} const er = new Error(friendlyErr(e)); er.idTaken = /unavailable-id/.test(String(e && e.type)); rej(er); } else onStatus && onStatus({ warn: friendlyErr(e) }); });
      peer.on("disconnected", () => { if (opened && !stopped) { setTimeout(() => { if (!stopped && !peer.destroyed) { try { peer.reconnect(); } catch (_) {} } }, 1000); } });
      peer.on("connection", (conn) => {
        if (stopped) { try { conn.close(); } catch (_) {} return; }
        conns.add(conn);
        const gone = () => { conns.delete(conn); maybeDestroy(); };
        conn.on("close", gone); conn.on("error", gone);
        conn.on("open", () => onRaw(wrapConn(conn)));
      });
    });
  }
  async function peerJoin(pid, timeoutMs) {
    await loadPeer();
    return new Promise((res, rej) => {
      const peer = new window.Peer({ debug: 0 }); let done = false;
      const fail = (msg) => { if (done) return; done = true; try { peer.destroy(); } catch (_) {} rej(new Error(msg)); };
      const to = setTimeout(() => fail("No device answered with that code. Make sure it's open and showing the code."), timeoutMs || 20000);
      peer.on("error", (e) => { clearTimeout(to); fail(friendlyErr(e)); });
      peer.on("open", () => {
        const conn = peer.connect(pid, { reliable: true });
        conn.on("open", () => {
          if (done) return; done = true; clearTimeout(to);
          const raw = wrapConn(conn);
          raw.onClose(() => setTimeout(() => { try { peer.destroy(); } catch (_) {} }, 200));
          res(raw);
        });
      });
    });
  }

  // ---------------------------------------------------------------- secure session (ECDH + HKDF + AES-GCM)
  async function secure(raw, app, code, me) {
    const kp = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
    const pub = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
    const nonce = crypto.getRandomValues(new Uint8Array(16));
    const handlers = [], closers = []; let key = null, closed = false;
    const queue = []; // encrypted messages that arrived before the key was ready
    const sess = {
      kind: raw.kind, peer: null, sas: "", ready: null,
      onMessage(f) { handlers.push(f); }, onClose(f) { closers.push(f); if (closed) setTimeout(f, 0); },
      async send(obj, bytes) {
        if (!key || closed) return false;
        const j = enc.encode(JSON.stringify(obj || {})), b = bytes ? u8(bytes) : new Uint8Array(0);
        const len = new Uint8Array(4); new DataView(len.buffer).setUint32(0, j.length);
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, cat(len, j, b)));
        raw.send({ k: "e", i: ab(iv), c: ab(ct) });
        // gentle back-pressure for big transfers
        let n = 0; while (raw.buffered() > 4 * 1024 * 1024 && n++ < 400) await new Promise((r) => setTimeout(r, 25));
        return true;
      },
      close() { raw.close(); },
      get closed() { return closed; },
      buffered: () => raw.buffered(),
    };
    raw.onClose(() => { closed = true; closers.forEach((f) => { try { f(); } catch (_) {} }); });
    async function open(m) {
      try {
        const iv = u8(m.i), ct = u8(m.c);
        const pt = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct));
        const n = new DataView(pt.buffer, pt.byteOffset, 4).getUint32(0);
        const obj = JSON.parse(dec.decode(pt.subarray(4, 4 + n)));
        const bytes = pt.length > 4 + n ? pt.slice(4 + n) : null;
        handlers.forEach((f) => { try { f(obj, bytes); } catch (e) { console.error(e); } });
      } catch (e) { console.warn("p2p: dropped a message that failed to decrypt"); }
    }
    sess.ready = new Promise((resolve, reject) => {
      const to = setTimeout(() => reject(new Error("The other device didn't answer the secure handshake.")), 15000);
      raw.onData(async (m) => {
        if (!m || typeof m !== "object") return;
        if (m.k === "hs" && !key) {
          try {
            const ppub = u8(m.pub), pnon = u8(m.nonce);
            if (!ppub || ppub.length !== 65 || !pnon) throw new Error("bad handshake");
            const pk = await crypto.subtle.importKey("raw", ppub, { name: "ECDH", namedCurve: "P-256" }, false, []);
            const shared = await crypto.subtle.deriveBits({ name: "ECDH", public: pk }, kp.privateKey, 256);
            const hk = await crypto.subtle.importKey("raw", shared, "HKDF", false, ["deriveBits", "deriveKey"]);
            const lo = cmp(pub, ppub) < 0;
            const transcript = lo ? cat(pub, ppub, nonce, pnon) : cat(ppub, pub, pnon, nonce);
            const salt = new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode("w12p2p|" + app + "|" + code)));
            key = await crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt, info: cat(enc.encode("w12-aes|"), transcript) }, hk, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
            const sasBits = new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info: cat(enc.encode("w12-sas|"), transcript) }, hk, 32));
            const num = new DataView(sasBits.buffer).getUint32(0) % 1000000;
            sess.sas = String(num).padStart(6, "0").replace(/^(\d{3})(\d{3})$/, "$1 $2");
            sess.peer = { name: String(m.name || "Device").slice(0, 60), role: m.role || "", info: m.info || {} };
            clearTimeout(to); resolve(sess);
            while (queue.length) await open(queue.shift());
          } catch (e) { clearTimeout(to); reject(e); }
        } else if (m.k === "e") {
          if (!key) queue.push(m); else await open(m);
        }
      });
      raw.onClose(() => { clearTimeout(to); reject(new Error("The other device disconnected.")); });
      raw.send({ k: "hs", v: 1, app, pub: ab(pub), nonce: ab(nonce), name: (me && me.name) || "Device", role: (me && me.role) || "", info: (me && me.info) || {} });
    });
    return sess;
  }

  // ---------------------------------------------------------------- public: host / join
  // host(app, code, { name, role, info, onSession(sess), onStatus(st) }) → { code, stop(), carriers }
  async function host(app, code, opts) {
    opts = opts || {};
    code = code || newCode();
    const pref = transportPref(), chan = "w12p2p:" + app + ":" + code, pid = "w12" + app + "-" + code;
    const me = { name: opts.name, role: opts.role, info: opts.info };
    const onRaw = (raw) => {
      secure(raw, app, code, me).then((s) => s.ready).then((s) => opts.onSession && opts.onSession(s))
        .catch((e) => opts.onStatus && opts.onStatus({ warn: e.message || String(e) }));
    };
    const parts = [], carriers = [];
    if (pref !== "peer") { const l = loopHost(chan, onRaw); if (l) { parts.push(l); carriers.push("loop"); } }
    let peerErr = null;
    if (pref !== "loop") {
      try { parts.push(await peerHost(pid, onRaw, opts.onStatus)); carriers.push("peer"); }
      catch (e) { peerErr = e; }
    }
    if (!carriers.length) throw peerErr || new Error("No way to connect is available in this browser.");
    return { code, carriers, peerError: peerErr ? peerErr.message : null, stop(keep) { parts.forEach((p) => { try { p.stop(keep); } catch (_) {} }); } };
  }
  // join(app, code, { name, role, info, timeout }) → Promise<session> (ready, with .sas)
  async function join(app, code, opts) {
    opts = opts || {};
    code = normCode(code);
    if (!validCode(code)) throw new Error("Codes are 5 letters and numbers, like 7KQ4M.");
    const pref = transportPref(), chan = "w12p2p:" + app + ":" + code, pid = "w12" + app + "-" + code;
    let raw = null;
    if (pref !== "peer") raw = await loopJoin(chan, pref === "loop" ? 1500 : 350);
    if (!raw) {
      if (pref === "loop") throw new Error("No tab on this device is waiting with that code.");
      raw = await peerJoin(pid, opts.timeout);
    }
    const s = await secure(raw, app, code, { name: opts.name, role: opts.role, info: opts.info });
    return s.ready;
  }

  // ================================================================ QR encoder (byte mode)
  const QR = (function () {
    const ECC = { L: [1, [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30], [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25]],
                  M: [0, [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28], [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49]] };
    function rawModules(v) { let r = (16 * v + 128) * v + 64; if (v >= 2) { const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; } return r; }
    const dataCW = (v, e) => Math.floor(rawModules(v) / 8) - ECC[e][1][v] * ECC[e][2][v];
    function gmul(x, y) { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; } return z & 0xff; }
    function rsDivisor(deg) { const r = new Array(deg).fill(0); r[deg - 1] = 1; let root = 1; for (let i = 0; i < deg; i++) { for (let j = 0; j < r.length; j++) { r[j] = gmul(r[j], root); if (j + 1 < r.length) r[j] ^= r[j + 1]; } root = gmul(root, 2); } return r; }
    function rsRem(data, div) { const r = div.map(() => 0); for (const b of data) { const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => { r[i] ^= gmul(c, f); }); } return r; }
    function alignPos(v) { if (v === 1) return []; const n = Math.floor(v / 7) + 2, size = v * 4 + 17; const step = v === 32 ? 26 : Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2; const r = [6]; for (let p = size - 7; r.length < n; p -= step) r.splice(1, 0, p); return r; }

    function encode(text, ecl) {
      ecl = ecl === "L" ? "L" : "M";
      const bytes = Array.from(enc.encode(String(text)));
      let v = 1;
      for (; v <= 40; v++) { const cc = v <= 9 ? 8 : 16; if (4 + cc + bytes.length * 8 <= dataCW(v, ecl) * 8) break; }
      if (v > 40) throw new Error("Text too long for a QR code");
      const cap = dataCW(v, ecl) * 8, bits = [];
      const put = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
      put(4, 4); put(bytes.length, v <= 9 ? 8 : 16); bytes.forEach((b) => put(b, 8));
      put(0, Math.min(4, cap - bits.length)); put(0, (8 - (bits.length % 8)) % 8);
      for (let p = 0xec; bits.length < cap; p ^= 0xec ^ 0x11) put(p, 8);
      const data = []; for (let i = 0; i < bits.length; i += 8) { let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j]; data.push(b); }
      // error correction + interleave
      const nb = ECC[ecl][2][v], el = ECC[ecl][1][v], rawCW = Math.floor(rawModules(v) / 8);
      const nShort = nb - (rawCW % nb), shortLen = Math.floor(rawCW / nb), div = rsDivisor(el), blocks = [];
      for (let i = 0, k = 0; i < nb; i++) {
        const d = data.slice(k, k + shortLen - el + (i < nShort ? 0 : 1)); k += d.length;
        const e = rsRem(d, div); if (i < nShort) d.push(0); blocks.push(d.concat(e));
      }
      const cw = [];
      for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== shortLen - el || j >= nShort) cw.push(b[i]); });
      // matrix
      const size = v * 4 + 17, M = [], F = [];
      for (let y = 0; y < size; y++) { M.push(new Array(size).fill(false)); F.push(new Array(size).fill(false)); }
      const setF = (x, y, d) => { M[y][x] = d; F[y][x] = true; };
      for (let i = 0; i < size; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); }
      const finder = (cx, cy) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= size || y >= size) continue; const d = Math.max(Math.abs(dx), Math.abs(dy)); setF(x, y, d !== 2 && d !== 4); } };
      finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
      const ap = alignPos(v), na = ap.length;
      for (let i = 0; i < na; i++) for (let j = 0; j < na; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) continue;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setF(ap[i] + dx, ap[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
      const drawFormat = (mask) => {
        const d = (ECC[ecl][0] << 3) | mask; let r = d; for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
        const b = ((d << 10) | r) ^ 0x5412, g = (i) => ((b >>> i) & 1) === 1;
        for (let i = 0; i <= 5; i++) setF(8, i, g(i));
        setF(8, 7, g(6)); setF(8, 8, g(7)); setF(7, 8, g(8));
        for (let i = 9; i < 15; i++) setF(14 - i, 8, g(i));
        for (let i = 0; i < 8; i++) setF(size - 1 - i, 8, g(i));
        for (let i = 8; i < 15; i++) setF(8, size - 15 + i, g(i));
        setF(8, size - 8, true);
      };
      drawFormat(0);
      if (v >= 7) {
        let r = v; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
        const b = (v << 12) | r;
        for (let i = 0; i < 18; i++) { const bit = ((b >>> i) & 1) === 1, a = size - 11 + (i % 3), c = Math.floor(i / 3); setF(a, c, bit); setF(c, a, bit); }
      }
      // codewords (zig-zag)
      let bi = 0;
      for (let right = size - 1; right >= 1; right -= 2) {
        if (right === 6) right = 5;
        for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
          const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
          if (!F[y][x] && bi < cw.length * 8) { M[y][x] = ((cw[bi >>> 3] >>> (7 - (bi & 7))) & 1) === 1; bi++; }
        }
      }
      const maskFn = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0, (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0, (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0];
      const applyMask = (m) => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!F[y][x] && maskFn[m](x, y)) M[y][x] = !M[y][x]; };
      const penalty = () => {
        let p = 0, dark = 0;
        for (let y = 0; y < size; y++) for (let pass = 0; pass < 2; pass++) {
          let run = 1;
          for (let x = 1; x < size; x++) { const a = pass ? M[x][y] : M[y][x], b = pass ? M[x - 1][y] : M[y][x - 1]; if (a === b) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; }
        }
        for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) { const c = M[y][x]; if (c === M[y][x + 1] && c === M[y + 1][x] && c === M[y + 1][x + 1]) p += 3; }
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (M[y][x]) dark++;
        const tot = size * size; p += (Math.ceil(Math.abs(dark * 20 - tot * 10) / tot) - 1) * 10;
        return p;
      };
      let best = 0, bestP = Infinity;
      for (let m = 0; m < 8; m++) { applyMask(m); drawFormat(m); const p = penalty(); if (p < bestP) { bestP = p; best = m; } applyMask(m); }
      applyMask(best); drawFormat(best);
      return { size, version: v, mask: best, modules: M };
    }
    function svg(text, o) {
      o = o || {};
      const q = encode(text, o.ecl), border = o.border == null ? 4 : o.border, n = q.size + border * 2;
      let d = "";
      for (let y = 0; y < q.size; y++) for (let x = 0; x < q.size; x++) if (q.modules[y][x]) d += `M${x + border},${y + border}h1v1h-1z`;
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" ${o.size ? `width="${o.size}" height="${o.size}"` : ""} shape-rendering="crispEdges" role="img" aria-label="${(o.label || "QR code").replace(/"/g, "")}"><rect width="${n}" height="${n}" fill="${o.light || "#fff"}"/><path d="${d}" fill="${o.dark || "#000"}"/></svg>`;
    }
    return { encode, svg };
  })();

  window.P2P12 = {
    CHARS, newCode, normCode, validCode, loadPeer, host, join, transportPref, friendlyErr,
    qr: QR.encode, qrSvg: QR.svg, b64, ub64, u8,
  };
})();
