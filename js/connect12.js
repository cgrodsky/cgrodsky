/* Connect12 — Phone Link, Nearby Sharing, Quick Assist and Remote Desktop for Windows 12.

   Load order: after js/p2p12.js (shared transport / E2E crypto / QR) and after js/gamebar.js,
   js/vm12.js, js/files12.js, js/settings12.js (all optional at run time), before js/main.js.
   Styles: css/connect12.css (classes cn-).

   REAL
   - Phone Link pairs a real phone: the QR code opens phone.html#CODE on the phone; the two connect
     over WebRTC (PeerJS broker only introduces them), keys are agreed with ECDH and confirmed with a
     6-digit number shown on both screens; then photos (file input on the phone) land in Pictures,
     "Phone Link messages" go both ways, and the phone's name / battery (when its browser reports it)
     and notifications from the phone page show here. It is NOT SMS and NOT calls — browsers can't.
   - Nearby Sharing sends files between two Windows 12 devices (or two tabs) the same way: the
     receiver shows a 5-character code (no Bluetooth proximity — the code IS the discovery), the
     receiver accepts or declines, progress on both sides, files saved to Downloads byte-for-byte.
   - Quick Assist / Remote Desktop: the sharer streams this Windows 12 page — real screen sharing
     (getDisplayMedia) where the browser has it, else Game Bar's page renderer (GBSnap) at a few fps —
     as JPEG frames over the encrypted data channel. The helper can request control; only after the
     sharer allows it are pointer / keyboard events replayed here (elementFromPoint + synthetic
     events), with a banner and an always-available Stop.
   PRIVACY: nothing is sent anywhere until you pair; then only to the paired device. The only
   third party is PeerJS's free signalling broker, which sees the 5-character code and connection
   setup, never content (everything is AES-GCM encrypted end to end). No accounts, no analytics. */
(function () {
  "use strict";
  if (window.Connect12) return;
  const P = () => window.P2P12;
  const S = () => State.data;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function el(html) { const d = document.createElement("div"); d.innerHTML = String(html).trim(); return d.firstElementChild; }
  const scr = () => document.getElementById("screen") || document.body;
  const IN_SANDBOX = (() => { try { return new URLSearchParams(location.search).get("sandbox") === "1"; } catch (_) { return false; } })();
  const isTouch = () => matchMedia("(pointer: coarse)").matches;
  const fmtSize = (n) => n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : n >= 1024 ? Math.round(n / 1024) + " KB" : (n | 0) + " B";
  const clock = (ts) => new Date(ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

  function store() {
    const a = S().appData || (S().appData = {});
    const c = a.connect12 || (a.connect12 = {});
    if (!c.deviceId) c.deviceId = "d" + Math.random().toString(36).slice(2, 12);
    c.phone = c.phone || { msgs: [], notifs: [], photos: [], last: null };
    c.nearby = c.nearby || { mode: "off", code: null, trusted: [], recent: [] };
    c.rdp = c.rdp || { enabled: false, code: null, saved: [] };
    return c;
  }
  const save = () => { try { State.save(); } catch (_) {} };
  const pcName = () => (S() && S().deviceName) || "WIN12-PC";
  const userName = () => (S() && S().profile && S().profile.username) || "User";
  function toast(title, body, onClick) { if (window.Notify) Notify.show({ icon: Icon.mini(toast.ic || "phonelink", title), title: esc(title), body: esc(body || ""), onClick }); }
  function log(level, source, id, msg) { try { if (window.EventLog) EventLog.add("Application", level, source, id, msg); } catch (_) {} }

  // ================================================================ small UI kit
  function dialog(o) {
    return new Promise((res) => {
      const m = el(`<div class="cn-mask${o.local ? " cn-local gbs-skip" : ""}" role="presentation"><div class="cn-dlg" role="dialog" aria-modal="true"><h3></h3><div class="cn-dlg-body"></div><div class="cn-dlg-btns"></div></div></div>`);
      m.querySelector("h3").textContent = o.title || "";
      const body = m.querySelector(".cn-dlg-body");
      if (typeof o.html === "string") body.innerHTML = o.html; else if (o.body) body.appendChild(o.body);
      const done = (v) => { m.remove(); res(v); };
      (o.buttons || [{ t: "OK", v: true, primary: true }]).forEach((b) => {
        const x = el(`<button class="cn-btn${b.primary ? " cn-primary" : ""}${b.danger ? " cn-danger" : ""}"></button>`); x.textContent = b.t;
        x.onclick = () => done(typeof b.v === "function" ? b.v(m) : b.v); m.querySelector(".cn-dlg-btns").appendChild(x);
      });
      m.addEventListener("keydown", (e) => { if (e.key === "Escape") done(o.cancel == null ? null : o.cancel); });
      (o.host || scr()).appendChild(m);
      const f = m.querySelector("input") || m.querySelector(".cn-primary"); if (f) setTimeout(() => { try { f.focus(); } catch (_) {} }, 30);
    });
  }
  // A Windows-style action toast (bottom right) with buttons; resolves with the button value.
  function actionToast(o) {
    return new Promise((res) => {
      let host = document.querySelector(".cn-toasts"); if (!host) { host = el(`<div class="cn-toasts" aria-live="polite"></div>`); document.body.appendChild(host); }
      const t = el(`<div class="cn-toast gbs-skip" role="alertdialog"><div class="cn-toast-h"><span class="cn-toast-ic">${Icon.mini(o.icon || "nearbyshare", o.app || "")}</span><span class="cn-toast-app"></span></div><div class="cn-toast-t"></div><div class="cn-toast-b"></div><div class="cn-toast-btns"></div></div>`);
      t.querySelector(".cn-toast-app").textContent = o.app || "";
      t.querySelector(".cn-toast-t").textContent = o.title || "";
      t.querySelector(".cn-toast-b").innerHTML = o.html || "";
      let done = false; const fin = (v) => { if (done) return; done = true; t.classList.add("cn-out"); setTimeout(() => t.remove(), 250); res(v); };
      (o.buttons || []).forEach((b) => { const x = el(`<button class="cn-btn${b.primary ? " cn-primary" : ""}"></button>`); x.textContent = b.t; x.onclick = () => fin(b.v); t.querySelector(".cn-toast-btns").appendChild(x); });
      host.appendChild(t);
      if (o.timeout) setTimeout(() => fin(o.timeoutValue), o.timeout);
      t.cancel = () => fin(o.timeoutValue);
      if (o.onShow) o.onShow(t, fin);
    });
  }
  const sasHtml = (sas) => `<span class="cn-sas" aria-label="Confirmation number ${esc(sas)}">${esc(sas)}</span>`;

  // ================================================================ VFS helpers
  function kidsAt(path) {
    if (window.FilesHelper && FilesHelper.ensureFolder) { try { return FilesHelper.ensureFolder(path); } catch (_) {} }
    let k = VFS.ensure();
    for (const seg of path) { if (!k[seg] || k[seg].type !== "folder") k[seg] = { type: "folder", children: {}, created: Date.now() }; k = k[seg].children || (k[seg].children = {}); }
    return k;
  }
  function nodeAtPath(p) { let n = { type: "folder", children: VFS.ensure() }; for (const s of p) { n = n && n.children && n.children[s]; if (!n) return null; } return n; }
  function uniqueName(kids, name) {
    if (!kids[name]) return name;
    const m = name.match(/^(.*?)(\.[^.]+)?$/); const base = m[1], ext = m[2] || ""; let i = 2;
    while (kids[base + " (" + i + ")" + ext]) i++;
    return base + " (" + i + ")" + ext;
  }
  const MIME = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", heic: "image/heic", pdf: "application/pdf", txt: "text/plain", mp4: "video/mp4", mp3: "audio/mpeg", zip: "application/zip", json: "application/json", html: "text/html", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
  const mimeOf = (name) => MIME[(String(name).split(".").pop() || "").toLowerCase()] || "application/octet-stream";
  function dataUrlBytes(u) {
    const i = u.indexOf(","), meta = u.slice(5, i), d = u.slice(i + 1);
    if (/;base64/i.test(meta)) return { mime: meta.split(";")[0], bytes: P().ub64(d) };
    return { mime: meta.split(";")[0], bytes: new TextEncoder().encode(decodeURIComponent(d)) };
  }
  async function thumbOf(blob) {
    try {
      const bmp = await createImageBitmap(blob); const k = Math.min(1, 240 / Math.max(bmp.width, bmp.height));
      const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
      const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0, c.width, c.height);
      return { src: c.toDataURL("image/jpeg", 0.72), w: bmp.width, h: bmp.height };
    } catch (_) { return null; }
  }
  // A VFS file node → { meta, bytes } for sending.
  async function packNode(name, node) {
    const meta = { name, kind: node.kind || "other", mime: node.mime || mimeOf(name) };
    let bytes = null;
    if (node.blob) { const b = await VFS.getBlob(node.blob); if (!b) throw new Error("“" + name + "” isn't stored on this device."); bytes = new Uint8Array(await b.arrayBuffer()); if (b.type) meta.mime = b.type; }
    else if (typeof node.src === "string" && /^data:/.test(node.src)) { const d = dataUrlBytes(node.src); bytes = d.bytes; meta.mime = d.mime || meta.mime; }
    else if (typeof node.src === "string" && /^blob:|^https?:|^assets\//.test(node.src)) { const r = await fetch(node.src); bytes = new Uint8Array(await r.arrayBuffer()); meta.mime = r.headers.get("content-type") || meta.mime; }
    else if (typeof node.content === "string") { bytes = new TextEncoder().encode(node.content); meta.utf8 = true; }
    else if (node.content != null) { bytes = new TextEncoder().encode(JSON.stringify(node.content)); meta.json = true; }
    else bytes = new Uint8Array(0);
    meta.size = bytes.length;
    return { meta, bytes };
  }
  // Received { meta, bytes } → a node saved into a folder. Returns the saved name.
  async function saveIncoming(folder, meta, bytes) {
    let node;
    if (meta.utf8) node = { type: "file", kind: meta.kind || "text", content: new TextDecoder().decode(bytes), size: bytes.length, ts: Date.now() };
    else if (meta.json) { let c = null; try { c = JSON.parse(new TextDecoder().decode(bytes)); } catch (_) {} node = { type: "file", kind: meta.kind || "other", content: c, size: bytes.length, ts: Date.now() }; }
    else {
      const mime = meta.mime || mimeOf(meta.name);
      const blob = new Blob([bytes], { type: mime });
      const id = await VFS.putBlob(blob);
      const isImg = /^image\//.test(mime) && !/heic|heif/i.test(mime);
      node = { type: "file", kind: isImg ? "image" : (meta.kind && meta.kind !== "image" ? meta.kind : "other"), blob: id, mime, size: bytes.length, ts: Date.now() };
      if (isImg) { const t = await thumbOf(blob); if (t) { node.src = t.src; node.w = t.w; node.h = t.h; } }
    }
    const kids = kidsAt(folder);
    const safe = String(meta.name || "file").replace(/[\\/:*?"<>|]+/g, "_").slice(0, 120) || "file";
    const name = uniqueName(kids, safe);
    kids[name] = node;
    save(); window.dispatchEvent(new Event("vfs-change"));
    return name;
  }
  const openFolder = (path, select) => { if (window.FilesHelper) FilesHelper.open(path); };

  // Background host helper: (re)start a listener with a fixed code.
  async function startHost(app, code, opts) {
    try { return await P().host(app, code, opts); }
    catch (e) { opts.onStatus && opts.onStatus({ error: e.message || String(e) }); return null; }
  }
  const myInfo = (role) => ({ name: pcName() + " (" + userName() + ")", role, info: { id: store().deviceId, pc: pcName(), user: userName(), os: "Windows 12" } });

  // ================================================================================================
  //  PHONE LINK
  // ================================================================================================
  const PL = (function () {
    const st = { phase: "off", code: null, hostRef: null, sess: null, phone: null, err: "", carriers: [], incoming: new Map(), sending: new Map(), rd: null };
    const listeners = new Set();
    const emit = () => listeners.forEach((f) => { try { f(); } catch (e) { console.error(e); } });
    let emitT = 0; const emitSoon = () => { if (emitT) return; emitT = setTimeout(() => { emitT = 0; emit(); }, 120); };
    const data = () => store().phone;
    const phoneUrl = (code) => new URL("phone.html#" + code, document.baseURI).href;
    const newId = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const phoneName = () => (st.phone && st.phone.name) || "Your phone";
    const pushMsg = (x) => { const d = data(); d.msgs.push(x); if (d.msgs.length > 300) d.msgs.splice(0, d.msgs.length - 300); save(); };

    async function start() {
      if (st.hostRef) return;
      // A stable code, so the Phone Link app on the phone can reconnect with one tap. Every new
      // connection still has to be confirmed here with the 6-digit number.
      const d = data(); if (!d.code || !P().validCode(d.code)) { d.code = P().newCode(); save(); }
      st.code = d.code; st.phase = "starting"; st.err = ""; emit();
      const ref = await startHost("pl", st.code, Object.assign(myInfo("pc"), { onSession, onStatus: (s) => { if (s.error) { st.err = s.error; st.phase = "error"; emit(); } } }));
      if (!ref) return;
      st.hostRef = ref; st.carriers = ref.carriers; st.phase = st.sess ? st.phase : "waiting";
      if (ref.peerError) st.err = "Internet pairing is unavailable (" + ref.peerError + ") — only tabs on this device can connect.";
      emit();
    }
    function stop() { if (st.hostRef) { st.hostRef.stop(); st.hostRef = null; } }
    function onSession(sess) {
      if (st.sess && !st.sess.closed) { sess.send({ t: "busy" }); setTimeout(() => sess.close(), 300); return; }
      st.sess = sess; st.phase = "confirm"; st.phone = Object.assign({ name: sess.peer.name }, sess.peer.info || {});
      sess.onMessage(onMsg);
      sess.onClose(() => {
        if (st.sess !== sess) return;
        if (st.rd) { const r = st.rd; st.rd = null; try { r.sub._end(); } catch (_) {} }
        st.sess = null; st.incoming.clear(); st.sending.clear();
        const was = st.phase; st.phase = st.hostRef ? "waiting" : "off";
        if (was === "paired") { toast.ic = "phonelink"; toast("Phone Link", phoneName() + " disconnected."); log("Information", "PhoneLink", 210, "Phone disconnected."); }
        emit();
      });
      toast.ic = "phonelink"; toast("Phone Link", "A phone wants to connect — check the number in Phone Link.", () => open());
      emit();
    }
    function confirm(ok) {
      const s = st.sess; if (!s) return;
      if (!ok) { s.send({ t: "reject" }); setTimeout(() => s.close(), 200); st.sess = null; st.phase = "waiting"; emit(); return; }
      s.send({ t: "paired", pc: pcName(), user: userName(), code: st.code });
      st.phase = "paired"; data().last = { name: st.phone.name, at: Date.now() }; save();
      log("Information", "PhoneLink", 200, "Paired with " + st.phone.name + " (end-to-end encrypted, confirmation " + s.sas + ").");
      emit();
    }
    function onMsg(m, bytes) {
      if (st.phase !== "paired") return; // nothing is accepted before you confirm the number
      if (m.rd) { if (st.rd) st.rd.sub._in(m, bytes); return; } // remote-desktop traffic → the screen-share session
      if (m.t === "rd-req") { startScreen("phone"); return; }
      const d = data();
      if (m.t === "info") { st.phone = Object.assign(st.phone || {}, { name: String(m.name || phoneName()).slice(0, 60), battery: m.battery, charging: m.charging, platform: m.platform }); emit(); }
      else if (m.t === "msg") {
        const x = { id: String(m.id || newId("p")), from: "phone", text: String(m.text || "").slice(0, 4000), ts: Date.now() };
        pushMsg(x);
        toast.ic = "phonelink"; toast(phoneName(), x.text, () => open("messages")); emit();
      } else if (m.t === "react") {
        const x = d.msgs.find((y) => String(y.id) === String(m.id)); if (!x) return;
        x.react = x.react || {};
        if (TAP[m.r]) x.react.phone = m.r; else delete x.react.phone;
        save(); emit();
        if (TAP[m.r] && x.from === "pc") { toast.ic = "phonelink"; toast(phoneName(), TAP_LABEL[m.r] + " " + (x.photo ? "a photo" : "“" + String(x.text || "").slice(0, 60) + "”"), () => open("messages")); }
      } else if (m.t === "notif") {
        const n = { id: Date.now(), app: String(m.app || "Phone").slice(0, 40), title: String(m.title || "").slice(0, 120), body: String(m.body || "").slice(0, 400), ts: Date.now() };
        d.notifs.unshift(n); d.notifs.length = Math.min(d.notifs.length, 60); save();
        toast.ic = "phonelink"; toast(n.app + " · " + phoneName(), (n.title ? n.title + " — " : "") + n.body, () => open("notifs")); emit();
      } else if (m.t === "photo-begin") {
        st.incoming.set(m.id, { name: String(m.name || "photo.jpg"), mime: m.mime, size: m.size, parts: [], got: 0 }); emit();
      } else if (m.t === "photo-chunk" && bytes) {
        const f = st.incoming.get(m.id); if (!f) return; f.parts.push(bytes); f.got += bytes.length; emitSoon();
      } else if (m.t === "photo-end") {
        const f = st.incoming.get(m.id); if (!f) return; st.incoming.delete(m.id);
        const all = new Uint8Array(f.got); let k = 0; f.parts.forEach((p) => { all.set(p, k); k += p.length; });
        saveIncoming(["Pictures"], { name: f.name, mime: f.mime }, all).then((name) => {
          d.photos.unshift({ name, at: Date.now(), size: all.length }); d.photos.length = Math.min(d.photos.length, 200);
          pushMsg({ id: String(m.id), from: "phone", photo: name, ts: Date.now() });
          st.sess && st.sess.send({ t: "photo-saved", id: m.id, name });
          toast.ic = "phonelink"; toast("Photo from " + phoneName(), name + " was saved to Pictures.", () => open("messages"));
          log("Information", "PhoneLink", 220, "Received photo " + name + " (" + fmtSize(all.length) + ") into Pictures.");
          emit();
        });
      } else if (m.t === "photo-got") {
        const x = d.msgs.find((y) => String(y.id) === String(m.id)); if (x) { x.delivered = true; save(); emit(); }
      }
    }
    function sendText(text) {
      text = String(text || "").trim(); if (!text || !st.sess || st.phase !== "paired") return false;
      const x = { id: newId("c"), from: "pc", text: text.slice(0, 4000), ts: Date.now() };
      st.sess.send({ t: "msg", id: x.id, text: x.text });
      pushMsg(x); emit(); return true;
    }
    // Send photos to the phone. items: [{ name, mime, bytes }]. Each also appears in the Messages thread.
    async function sendPhotos(items) {
      for (const it of items) {
        if (!st.sess || st.phase !== "paired") break;
        const id = newId("c");
        const t = await thumbOf(new Blob([it.bytes], { type: it.mime || "image/jpeg" }));
        pushMsg({ id, from: "pc", photo: it.name, thumb: t ? t.src : null, ts: Date.now() });
        st.sending.set(id, 0); emit();
        st.sess.send({ t: "photo-begin", id, name: it.name, mime: it.mime || "image/jpeg", size: it.bytes.length });
        const CH = 64 * 1024;
        for (let o = 0; o < it.bytes.length; o += CH) {
          if (!st.sess) break;
          await st.sess.send({ t: "photo-chunk", id }, it.bytes.subarray(o, o + CH));
          st.sending.set(id, Math.min(1, (o + CH) / it.bytes.length)); emitSoon();
        }
        if (st.sess) await st.sess.send({ t: "photo-end", id });
        st.sending.delete(id); emit();
        log("Information", "PhoneLink", 221, "Sent photo " + it.name + " (" + fmtSize(it.bytes.length) + ") to " + phoneName() + ".");
      }
    }
    async function sendFiles(fileList) {
      const items = [];
      for (const f of fileList) { if (!/^image\//.test(f.type || "") && !/\.(jpe?g|png|gif|webp|heic|bmp)$/i.test(f.name)) continue; items.push({ name: f.name || "photo.jpg", mime: f.type || "image/jpeg", bytes: new Uint8Array(await f.arrayBuffer()) }); }
      if (items.length) await sendPhotos(items);
    }
    function react(id, r) {
      const x = data().msgs.find((y) => String(y.id) === String(id)); if (!x || !st.sess || st.phase !== "paired") return;
      x.react = x.react || {};
      const nr = x.react.pc === r ? null : r;
      if (nr) x.react.pc = nr; else delete x.react.pc;
      st.sess.send({ t: "react", id: String(x.id), r: nr });
      save(); emit();
    }

    // ---------------- remote desktop over the Phone Link connection ----------------
    // The screen-share core (shared with Quick Assist) runs on a sub-session: its messages ride the
    // paired, encrypted Phone Link channel tagged rd:1, and stopping it doesn't unpair the phone.
    function makeSub(base) {
      const mh = [], ch = []; let closed = false;
      const sub = {
        peer: base.peer, sas: base.sas,
        get closed() { return closed || base.closed; },
        send: (m, b) => (closed ? Promise.resolve(false) : base.send(Object.assign({}, m, { rd: 1 }), b)),
        onMessage: (f) => { mh.push(f); }, onClose: (f) => { ch.push(f); },
        buffered: () => (base.buffered ? base.buffered() : 0),
        close: () => { if (closed) return; closed = true; try { base.send({ t: "rd-end" }); } catch (_) {} ch.forEach((f) => { try { f(); } catch (_) {} }); },
        _in: (m, b) => mh.forEach((f) => { try { f(m, b); } catch (e) { console.warn(e); } }),
        _end: () => { if (closed) return; closed = true; ch.forEach((f) => { try { f(); } catch (_) {} }); },
      };
      return sub;
    }
    async function startScreen(by) {
      if (!st.sess || st.phase !== "paired" || st.rd) return;
      const name = phoneName();
      if (by === "phone") {
        const ok = await dialog({ title: name + " wants to see this PC", html: `<p>Show this PC's screen on ${esc(name)}? It can watch your screen, and it has to ask separately before it can control it. You can stop at any time from the bar at the top of the screen.</p>`, buttons: [{ t: "Allow", v: true, primary: true }, { t: "Decline", v: false }], cancel: false, local: true, host: document.body });
        if (!ok || !st.sess) { if (st.sess) st.sess.send({ t: "share-declined", rd: 1 }); return; }
      }
      const sub = makeSub(st.sess); const mine = { sub, at: Date.now() }; st.rd = mine;
      const clear = () => { if (st.rd === mine) { st.rd = null; emit(); } };
      sub.onClose(clear);
      emit();
      // The PC here IS this Windows 12 page: render it directly (no extra browser screen-picker prompt; works on iPad too).
      const s = await Share.startSharing(sub, { app: "Phone Link", icon: "phonelink", method: "snap", onStop: clear });
      if (!s) { clear(); sub.close(); return; }
      log("Information", "PhoneLink", 230, "Showing this PC on " + name + " (Phone Link remote desktop).");
      emit();
    }
    function stopScreen() {
      const r = st.rd; if (!r) return;
      const a = Share.active();
      if (a && a.sess === r.sub) a.stop("user"); else r.sub.close();
      st.rd = null; emit();
    }
    function disconnect() { stopScreen(); if (st.sess) { st.sess.send({ t: "bye" }); st.sess.close(); st.sess = null; } stop(); st.phase = "off"; st.code = null; emit(); }

    // ---------------- app window ----------------
    let win = null;
    function open(tab) {
      if (win && win.body.isConnected) { win.focus(); win.win.style.display = ""; if (tab) win.setTab(tab); return; }
      const ref = WM.createWindow({ title: "Phone Link", icon: Icon.mini("phonelink", "Phone Link"), width: Math.min(920, innerWidth - 30), height: Math.min(640, innerHeight - 90), appId: "phonelink", onClose: () => { listeners.delete(paint); win = null; } });
      win = ref; let cur = tab || "messages"; let draft = "";
      ref.body.classList.add("cn-app", "cn-pl");
      ref.setTab = (t) => { cur = t; paint(); };
      const picsKids = () => (nodeAtPath(["Pictures"]) || {}).children || {};
      function closePicker() { document.querySelectorAll(".cn-tb-pick").forEach((p) => p.remove()); }
      function openPicker(bub, x) {
        closePicker();
        const mine = x.react && x.react.pc;
        const pk = el(`<div class="cn-tb-pick gbs-skip" role="menu" aria-label="React">${TAP_IDS.map((r) => `<button type="button" role="menuitem" class="${mine === r ? "on" : ""}" data-r="${r}" title="${TAP_LABEL[r]}" aria-label="${TAP_LABEL[r]}">${TAP[r]}</button>`).join("")}${x.photo && x.from === "phone" ? `<button type="button" class="cn-tb-open" title="Open photo">Open</button>` : ""}</div>`);
        pk.querySelectorAll("[data-r]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); closePicker(); react(x.id, b.dataset.r); }));
        const op = pk.querySelector(".cn-tb-open"); if (op) op.onclick = (e) => { e.stopPropagation(); closePicker(); const n = picsKids()[x.photo]; if (n) VFS.openNode(x.photo, n); };
        ref.body.appendChild(pk);
        const r = bub.getBoundingClientRect(), hr = ref.body.getBoundingClientRect();
        let left = (x.from === "pc" ? r.right - pk.offsetWidth : r.left) - hr.left; left = Math.max(6, Math.min(left, hr.width - pk.offsetWidth - 6));
        let top = r.top - hr.top - pk.offsetHeight - 6; if (top < 4) top = r.bottom - hr.top + 6;
        pk.style.left = left + "px"; pk.style.top = top + "px";
        setTimeout(() => document.addEventListener("pointerdown", function h(ev) { if (!pk.contains(ev.target)) { closePicker(); document.removeEventListener("pointerdown", h, true); } }, true), 0);
      }
      function bubbleEl(x) {
        const b = el(`<div class="cn-bub ${x.from === "pc" ? "me" : "them"}${x.photo ? " cn-bub-ph" : ""}" tabindex="0" role="button" aria-haspopup="menu"></div>`);
        b.dataset.id = x.id;
        if (x.photo) {
          const n = x.from === "phone" ? picsKids()[x.photo] : null; const src = x.thumb || (n && n.src);
          if (src) { const im = document.createElement("img"); im.alt = x.photo; im.src = src; b.appendChild(im); } else { const s = document.createElement("span"); s.textContent = x.photo; b.appendChild(s); }
        } else { const s = document.createElement("span"); s.textContent = x.text; b.appendChild(s); }
        const pct = st.sending.get(x.id);
        const t = document.createElement("time"); t.textContent = clock(x.ts) + (pct != null ? " · Sending " + Math.round(pct * 100) + "%" : x.from === "pc" && x.photo && x.delivered ? " · Delivered" : ""); b.appendChild(t);
        const rs = x.react ? [["pc", x.react.pc], ["phone", x.react.phone]].filter((p) => TAP[p[1]]) : [];
        if (rs.length) b.appendChild(el(`<span class="cn-tb" aria-label="${rs.map((p) => (p[0] === "pc" ? "You: " : phoneName() + ": ") + TAP_LABEL[p[1]]).join(", ")}">${rs.map((p) => `<i class="cn-tb-i ${p[0] === "pc" ? "mine" : ""}">${TAP[p[1]]}</i>`).join("")}</span>`));
        b.onclick = () => openPicker(b, x);
        b.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openPicker(b, x); } });
        return b;
      }
      async function pickFromPictures() {
        const kids = picsKids();
        const names = Object.keys(kids).filter((k) => kids[k] && kids[k].type === "file" && (kids[k].kind === "image" || /\.(jpe?g|png|gif|webp|bmp)$/i.test(k))).slice(0, 60);
        const body = el(`<div class="cn-picgrid">${names.length ? "" : `<div class="cn-empty">No pictures in your Pictures folder yet.</div>`}</div>`);
        const chosen = new Set();
        names.forEach((nm) => { const n = kids[nm]; const t = el(`<button type="button" class="cn-pl-ph" title="${esc(nm)}">${n.src ? `<img alt="" src="${esc(n.src)}">` : `<span>${esc(nm)}</span>`}<i>${esc(nm)}</i></button>`); t.onclick = () => { if (chosen.has(nm)) chosen.delete(nm); else chosen.add(nm); t.classList.toggle("on", chosen.has(nm)); }; body.appendChild(t); });
        const ok = await dialog({ title: "Send pictures to " + phoneName(), body, buttons: [{ t: "Send", v: true, primary: true }, { t: "Cancel", v: false }], cancel: false });
        if (!ok || !chosen.size) return;
        const items = [];
        for (const nm of chosen) { try { const p = await packNode(nm, kids[nm]); items.push({ name: nm, mime: p.meta.mime, bytes: p.bytes }); } catch (e) { toast("Phone Link", e.message || String(e)); } }
        sendPhotos(items);
      }
      function paint() {
        if (!ref.body.isConnected) return;
        const ph = st.phone || {}, d = data();
        if (st.phase !== "paired") { paintPair(); return; }
        const keepDraft = ref.body.querySelector(".cn-chat-in .cn-input"); if (keepDraft) draft = keepDraft.value;
        const hadFocus = keepDraft && document.activeElement === keepDraft;
        closePicker();
        const batt = ph.battery == null ? "Battery not reported by the phone's browser" : Math.round(ph.battery * 100) + "%" + (ph.charging ? " · charging" : "");
        ref.body.innerHTML = `<div class="cn-pl-wrap">
          <aside class="cn-pl-side">
            <div class="cn-pl-phone"><div class="cn-pl-phone-ic">${PHONE_SVG}</div><b class="cn-pl-name"></b><span class="cn-pl-batt"></span><span class="cn-ok-dot">Connected · end-to-end encrypted</span></div>
            <nav class="cn-tabs" role="tablist">${[["messages", "Messages"], ["photos", "Photos"], ["screen", "Remote desktop"], ["notifs", "Notifications"], ["calls", "Calls"]].map(([k, n]) => `<button role="tab" data-t="${k}" class="${cur === k ? "on" : ""}" aria-selected="${cur === k}">${n}${k === "notifs" && d.notifs.length ? ` <i class="cn-badge">${d.notifs.length}</i>` : ""}${k === "screen" && st.rd ? ` <i class="cn-badge cn-live">Live</i>` : ""}</button>`).join("")}</nav>
            <button class="cn-btn cn-pl-disc">Disconnect</button>
          </aside>
          <main class="cn-pl-main"></main></div>`;
        ref.body.querySelector(".cn-pl-name").textContent = ph.name || "Phone";
        ref.body.querySelector(".cn-pl-batt").textContent = batt;
        ref.body.querySelectorAll(".cn-tabs [data-t]").forEach((b) => (b.onclick = () => { cur = b.dataset.t; paint(); }));
        ref.body.querySelector(".cn-pl-disc").onclick = () => disconnect();
        const main = ref.body.querySelector(".cn-pl-main");
        const filePick = (onFiles) => { const i = document.createElement("input"); i.type = "file"; i.accept = "image/*"; i.multiple = true; i.onchange = () => { const fs = [...(i.files || [])]; if (fs.length) onFiles(fs); }; i.click(); };
        if (cur === "messages") {
          main.innerHTML = `<div class="cn-chat-h"><b>Messages</b><span>Phone Link messages and photos between this PC and your phone. Select a message to react. (Not SMS — browsers can't read or send your phone's texts.)</span></div><div class="cn-chat" role="log" aria-live="polite"></div><form class="cn-chat-in"><button type="button" class="cn-btn cn-attach" title="Send photos" aria-label="Send photos">${CAM_SVG}</button><input class="cn-input" placeholder="Message ${esc(ph.name || "your phone")}" aria-label="Message" maxlength="4000"><button class="cn-btn cn-primary" type="submit">Send</button></form>`;
          const lg = main.querySelector(".cn-chat");
          d.msgs.slice(-200).forEach((x) => lg.appendChild(bubbleEl(x)));
          [...st.incoming.entries()].forEach(([id, f]) => lg.appendChild(el(`<div class="cn-bub them cn-bub-inc"><span>Receiving ${esc(f.name)}… ${f.size ? Math.round(f.got / f.size * 100) : 0}%</span></div>`)));
          if (!d.msgs.length && !st.incoming.size) lg.appendChild(el(`<div class="cn-empty">No messages yet. Type below, send a photo, or message from the phone.</div>`));
          lg.scrollTop = lg.scrollHeight;
          const inp = main.querySelector(".cn-input"); inp.value = draft;
          main.querySelector("form").onsubmit = (e) => { e.preventDefault(); if (sendText(inp.value)) { draft = ""; inp.value = ""; setTimeout(() => { const i2 = ref.body.querySelector(".cn-chat-in .cn-input"); if (i2) i2.focus(); }, 0); } };
          main.querySelector(".cn-attach").onclick = () => filePick((fs) => sendFiles(fs));
          if (hadFocus || !isTouch()) setTimeout(() => { try { inp.focus(); } catch (_) {} }, 0);
        } else if (cur === "photos") {
          const inc = [...st.incoming.values()], outgoing = [...st.sending.entries()];
          main.innerHTML = `<div class="cn-chat-h"><b>Photos</b><span>Photos from your phone are saved to <a href="#" class="cn-link cn-open-pics">Pictures</a>. Photos you send appear on the phone, where you can save them.</span></div>
            <div class="cn-row cn-pl-sendrow"><button class="cn-btn cn-primary cn-send-dev">${CAM_SVG}<span>Send photos to phone</span></button><button class="cn-btn cn-send-pics">From Pictures…</button></div>
            ${inc.map((f) => `<div class="cn-prog"><span>From phone: ${esc(f.name)}</span><progress max="${f.size || 1}" value="${f.got}"></progress></div>`).join("")}
            ${outgoing.map(([id, p]) => { const x = d.msgs.find((y) => y.id === id); return `<div class="cn-prog"><span>To phone: ${esc(x ? x.photo : "photo")}</span><progress max="1" value="${p}"></progress></div>`; }).join("")}
            <h4 class="cn-sub-h">From your phone</h4><div class="cn-pl-grid cn-g-in"></div>
            <h4 class="cn-sub-h">Sent to your phone</h4><div class="cn-pl-grid cn-g-out"></div>`;
          main.querySelector(".cn-open-pics").onclick = (e) => { e.preventDefault(); openFolder(["Pictures"]); };
          main.querySelector(".cn-send-dev").onclick = () => filePick((fs) => sendFiles(fs));
          main.querySelector(".cn-send-pics").onclick = () => pickFromPictures();
          const gin = main.querySelector(".cn-g-in"), gout = main.querySelector(".cn-g-out"), kids = picsKids();
          d.photos.slice(0, 60).forEach((p) => { const n = kids[p.name]; const t = el(`<button class="cn-pl-ph" title="${esc(p.name)}">${n && n.src ? `<img alt="" src="${esc(n.src)}">` : `<span>${esc(p.name)}</span>`}<i>${esc(p.name)}</i></button>`); t.onclick = () => { if (n) VFS.openNode(p.name, n); }; gin.appendChild(t); });
          if (!d.photos.length) gin.appendChild(el(`<div class="cn-empty">No photos from your phone yet.</div>`));
          const sent = d.msgs.filter((x) => x.from === "pc" && x.photo).slice(-60).reverse();
          sent.forEach((x) => gout.appendChild(el(`<div class="cn-pl-ph" title="${esc(x.photo)}">${x.thumb ? `<img alt="" src="${esc(x.thumb)}">` : `<span>${esc(x.photo)}</span>`}<i>${esc(x.photo)}${x.delivered ? " ✓" : ""}</i></div>`)));
          if (!sent.length) gout.appendChild(el(`<div class="cn-empty">Nothing sent yet.</div>`));
        } else if (cur === "screen") {
          if (st.rd) {
            main.innerHTML = `<div class="cn-chat-h"><b>Remote desktop</b><span>${esc(ph.name || "Your phone")} is viewing this PC.</span></div><div class="cn-rd-live"><span class="cn-banner-dot"></span><div><b>Sharing this PC with ${esc(ph.name || "your phone")}</b><span>It has to ask before it can control your mouse and keyboard. The bar at the top of the screen shows who's connected, and lets you take back control or stop.</span></div></div><button class="cn-btn cn-danger cn-rd-stop">Stop sharing</button>`;
            main.querySelector(".cn-rd-stop").onclick = () => stopScreen();
          } else {
            main.innerHTML = `<div class="cn-chat-h"><b>Remote desktop</b><span>See and use this PC from your phone, over the same encrypted Phone Link connection.</span></div>
              <ol class="cn-steps"><li>Select <b>Show this PC on my phone</b>, or tap <b>PC screen</b> on your phone (you'll be asked to allow it here).</li><li>Your phone shows this PC's screen live.</li><li>To use the mouse and keyboard from the phone, it asks for control — you approve that separately.</li></ol>
              <button class="cn-btn cn-primary cn-rd-go">Show this PC on my phone</button>
              <div class="cn-note">Showing your phone's screen on this PC isn't possible: phone browsers can't capture their own screen.</div>`;
            main.querySelector(".cn-rd-go").onclick = () => startScreen("pc");
          }
        } else if (cur === "notifs") {
          main.innerHTML = `<div class="cn-chat-h"><b>Notifications</b><span>Notifications sent from the Phone Link page on your phone. Other apps' notifications stay on the phone — a web page can't read them.</span></div><div class="cn-nlist"></div>${d.notifs.length ? `<button class="cn-btn cn-clear">Clear all</button>` : ""}`;
          const L = main.querySelector(".cn-nlist");
          d.notifs.forEach((n) => { const r = el(`<div class="cn-ncard"><b></b><span></span><time></time></div>`); r.children[0].textContent = n.app + (n.title ? " · " + n.title : ""); r.children[1].textContent = n.body; r.children[2].textContent = clock(n.ts); L.appendChild(r); });
          if (!d.notifs.length) L.appendChild(el(`<div class="cn-empty">No notifications.</div>`));
          const c = main.querySelector(".cn-clear"); if (c) c.onclick = () => { d.notifs = []; save(); paint(); };
        } else {
          main.innerHTML = `<div class="cn-chat-h"><b>Calls</b><span>Not available.</span></div><div class="cn-note">Calling needs a Bluetooth link to your phone's cellular radio, which web browsers can't use. Phone Link here does messages, photos both ways, reactions, notifications and remote desktop.</div>`;
        }
      }
      function paintPair() {
        const url = st.code ? phoneUrl(st.code) : "";
        ref.body.innerHTML = `<div class="cn-pair">
          <div class="cn-pair-l">
            <h2>Link your phone</h2>
            <ol class="cn-steps"><li>On your phone, open the camera and scan this QR code (or visit the link below).</li><li>The Phone Link app opens in the phone's browser and connects directly to this PC. Add it to your home screen to reconnect with one tap next time.</li><li>Check that both screens show the same 6-digit number, then select <b>Yes, they match</b>.</li></ol>
            <div class="cn-pair-status" role="status"></div>
            <div class="cn-privacy">${LOCK_SVG}<span>End-to-end encrypted. The phone connects straight to this PC (WebRTC); PeerJS's free broker only introduces the two devices and never sees your photos, messages or screen. Nothing is stored online.</span></div>
          </div>
          <div class="cn-pair-r"><div class="cn-qr"></div><div class="cn-code-row">Code <b class="cn-code"></b></div><a class="cn-link cn-url" target="_blank" rel="noopener"></a></div></div>`;
        const status = ref.body.querySelector(".cn-pair-status"), qr = ref.body.querySelector(".cn-qr");
        if (st.code) {
          qr.innerHTML = P().qrSvg(url, { size: 220, label: "QR code to open Phone Link on your phone" });
          ref.body.querySelector(".cn-code").textContent = st.code;
          const a = ref.body.querySelector(".cn-url"); a.href = url; a.textContent = url.replace(/^https?:\/\//, "");
        } else qr.innerHTML = `<div class="cn-spin"></div>`;
        if (st.phase === "confirm" && st.sess) {
          status.innerHTML = `<div class="cn-confirm"><div>Does <b></b> show this number?</div>${sasHtml(st.sess.sas)}<div class="cn-row"><button class="cn-btn cn-primary" data-a="yes">Yes, they match</button><button class="cn-btn" data-a="no">No</button></div></div>`;
          status.querySelector("b").textContent = phoneName();
          status.querySelector('[data-a="yes"]').onclick = () => confirm(true);
          status.querySelector('[data-a="no"]').onclick = () => confirm(false);
        } else if (st.phase === "error") status.innerHTML = `<div class="cn-err">${esc(st.err)}</div><button class="cn-btn cn-retry">Try again</button>`;
        else status.innerHTML = `<div class="cn-wait"><span class="cn-spin sm"></span>${st.phase === "starting" ? "Getting a pairing code…" : "Waiting for your phone…"}</div>${st.err ? `<div class="cn-warn">${esc(st.err)}</div>` : ""}${data().last ? `<div class="cn-sub">Last paired: ${esc(data().last.name)} · ${new Date(data().last.at).toLocaleDateString()}</div>` : ""}`;
        const r = status.querySelector(".cn-retry"); if (r) r.onclick = () => { stop(); data().code = null; st.phase = "off"; start(); };
      }
      listeners.add(paint);
      paint();
      if (!st.hostRef && st.phase !== "paired") start();
    }
    return { open, start, stop, disconnect, sendText, sendPhotos, react, startScreen, stopScreen, confirm, state: () => st, on: (f) => { listeners.add(f); return () => listeners.delete(f); }, phoneUrl };
  })();

  // Tapback reactions (like Messages) — drawn as SVG so they look the same everywhere.
  const TAP_IDS = ["heart", "like", "dislike", "laugh", "emph", "question"];
  const TAP_LABEL = { heart: "Loved", like: "Liked", dislike: "Disliked", laugh: "Laughed at", emph: "Emphasized", question: "Questioned" };
  const TAP = {
    heart: `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 20.5C5.5 16 2.5 12.4 2.5 8.7 2.5 6 4.6 4 7.2 4c1.9 0 3.6 1 4.8 2.7C13.2 5 14.9 4 16.8 4c2.6 0 4.7 2 4.7 4.7 0 3.7-3 7.3-9.5 11.8z" fill="#ff4d6d"/></svg>`,
    like: `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M7 10v10H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1zm2 0 4.2-7.1a1.6 1.6 0 0 1 2.9 1.2L15 9h5a2 2 0 0 1 2 2.3l-1.3 7.2A2 2 0 0 1 18.7 20H9z" fill="currentColor"/></svg>`,
    dislike: `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M17 14V4h3a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1zm-2 0-4.2 7.1a1.6 1.6 0 0 1-2.9-1.2L9 15H4a2 2 0 0 1-2-2.3l1.3-7.2A2 2 0 0 1 5.3 4H15z" fill="currentColor"/></svg>`,
    laugh: `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><text x="12" y="11" text-anchor="middle" font-family="Segoe UI,system-ui,sans-serif" font-weight="800" font-size="8.5" fill="currentColor">HA</text><text x="12" y="20" text-anchor="middle" font-family="Segoe UI,system-ui,sans-serif" font-weight="800" font-size="8.5" fill="currentColor">HA</text></svg>`,
    emph: `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M8 3h3l-.6 12H8.6zM13 3h3l-.6 12h-1.8z" fill="#ff6b3d"/><circle cx="9.5" cy="19" r="1.7" fill="#ff6b3d"/><circle cx="14.5" cy="19" r="1.7" fill="#ff6b3d"/></svg>`,
    question: `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M8.5 8.5a3.5 3.5 0 1 1 5.4 2.9c-1.1.8-1.9 1.5-1.9 3V15" fill="none" stroke="#3b82f6" stroke-width="2.6" stroke-linecap="round"/><circle cx="12" cy="19.5" r="1.6" fill="#3b82f6"/></svg>`,
  };
  const CAM_SVG = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 8h3l1.6-2.4h6.8L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.6"/></svg>`;

  const PHONE_SVG = `<svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true"><rect x="13" y="4" width="22" height="40" rx="4" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M21 9h6" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="24" cy="38" r="1.8" fill="currentColor"/></svg>`;
  const LOCK_SVG = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>`;

  // ================================================================================================
  //  NEARBY SHARING
  // ================================================================================================
  const NS = (function () {
    let hostRef = null, hostState = "off", hostErr = "";
    const listeners = new Set(); const emit = () => listeners.forEach((f) => { try { f(); } catch (_) {} });
    const cfg = () => store().nearby;
    function ensureCode() { const c = cfg(); if (!c.code || !P().validCode(c.code)) { c.code = P().newCode(); save(); } return c.code; }
    async function applyMode() {
      const mode = cfg().mode;
      if (mode === "off" || IN_SANDBOX) { if (hostRef) { hostRef.stop(); hostRef = null; } hostState = "off"; emit(); return; }
      if (hostRef) return;
      hostState = "starting"; emit();
      const ref = await startHost("ns", ensureCode(), Object.assign(myInfo("receiver"), { onSession: incoming, onStatus: (s) => { if (s.error) { hostErr = s.error; hostState = "error"; emit(); } } }));
      if (!ref) return;
      if (cfg().mode === "off") { ref.stop(); hostState = "off"; emit(); return; }
      hostRef = ref; hostState = "on"; hostErr = ref.peerError ? "Only tabs on this device can find you right now (" + ref.peerError + ")" : ""; emit();
    }
    function setMode(m) {
      const was = cfg().mode; cfg().mode = m; save();
      // switching between "My devices only" and "Everyone" keeps the same listener (checked per offer)
      if (m === "off" || was === "off" || !hostRef) { if (hostRef) { hostRef.stop(); hostRef = null; } applyMode(); } else emit();
      log("Information", "NearbySharing", 300, "Nearby sharing set to " + m + ".");
    }
    function newCode() { cfg().code = P().newCode(); save(); if (hostRef) { hostRef.stop(); hostRef = null; } applyMode(); }

    // -------- receive --------
    function incoming(sess) {
      let offer = null, files = [], cur = null, total = 0, got = 0, card = null, saved = [];
      sess.onMessage(async (m, bytes) => {
        if (m.t === "offer" && !offer) {
          offer = m; total = (m.files || []).reduce((a, f) => a + (f.size || 0), 0);
          const from = String((sess.peer && sess.peer.name) || "A device");
          const fid = sess.peer && sess.peer.info && sess.peer.info.id;
          const trusted = cfg().trusted.some((t) => t.id === fid);
          if (cfg().mode === "mine" && !trusted) { sess.send({ t: "decline", why: "This PC only accepts Nearby Sharing from its own devices." }); setTimeout(() => sess.close(), 300); log("Information", "NearbySharing", 302, "Declined a share from " + from + " (My devices only)."); return; }
          const list = (m.files || []).slice(0, 50);
          const what = list.length === 1 ? "“" + list[0].name + "”" : list.length + " files";
          const v = await actionToast({ app: "Nearby sharing", icon: "nearbyshare", title: from + " wants to share " + what + " (" + fmtSize(total) + ")",
            html: `Make sure the other device shows ${sasHtml(sess.sas)}<label class="cn-chk"><input type="checkbox" class="cn-trust"> This is one of my devices</label>`,
            buttons: [{ t: "Save", v: "save", primary: true }, { t: "Decline", v: "decline" }], timeout: 120000, timeoutValue: "decline",
            onShow: (t) => { card = t; sess.onClose(() => t.cancel && t.cancel()); } });
          if (v !== "save" || sess.closed) { sess.send({ t: "decline" }); setTimeout(() => sess.close(), 300); return; }
          if (card && card.querySelector(".cn-trust:checked") && fid && !trusted) { cfg().trusted.push({ id: fid, name: from, at: Date.now() }); save(); }
          files = list.map((f) => ({ meta: f, parts: [], got: 0 }));
          prog = progressToast("Receiving from " + from, total);
          sess.send({ t: "accept" });
        } else if (m.t === "chunk" && bytes && files[m.i]) {
          const f = files[m.i]; f.parts.push(bytes); f.got += bytes.length; got += bytes.length; prog && prog.set(got);
        } else if (m.t === "file-end" && files[m.i]) {
          const f = files[m.i]; const all = new Uint8Array(f.got); let k = 0; f.parts.forEach((p) => { all.set(p, k); k += p.length; }); f.parts = [];
          const name = await saveIncoming(["Downloads"], f.meta, all); saved.push(name);
          sess.send({ t: "saved", i: m.i, name });
        } else if (m.t === "done") {
          prog && prog.done(saved.length + " file" + (saved.length === 1 ? "" : "s") + " saved to Downloads");
          toast.ic = "nearbyshare"; toast("Nearby sharing", (saved.length === 1 ? saved[0] : saved.length + " files") + " saved to Downloads.", () => openFolder(["Downloads"]));
          log("Information", "NearbySharing", 301, "Received " + saved.join(", ") + " from " + ((sess.peer && sess.peer.name) || "a device") + " into Downloads.");
          setTimeout(() => sess.close(), 500);
        }
      });
      let prog = null;
      sess.onClose(() => { if (prog && !prog.finished) prog.done("Transfer stopped — the other device disconnected", true); });
    }
    function progressToast(title, total) {
      let host = document.querySelector(".cn-toasts"); if (!host) { host = el(`<div class="cn-toasts" aria-live="polite"></div>`); document.body.appendChild(host); }
      const t = el(`<div class="cn-toast gbs-skip"><div class="cn-toast-h"><span class="cn-toast-ic">${Icon.mini("nearbyshare", "Nearby sharing")}</span><span class="cn-toast-app">Nearby sharing</span></div><div class="cn-toast-t"></div><progress class="cn-bar" max="1" value="0"></progress><div class="cn-toast-b"></div></div>`);
      t.querySelector(".cn-toast-t").textContent = title; host.appendChild(t);
      const bar = t.querySelector("progress"), b = t.querySelector(".cn-toast-b");
      const o = { finished: false, set(v) { bar.value = total ? v / total : 1; b.textContent = fmtSize(v) + " of " + fmtSize(total); }, done(msg, err) { o.finished = true; bar.value = err ? bar.value : 1; b.textContent = msg; t.classList.toggle("cn-bad", !!err); setTimeout(() => { t.classList.add("cn-out"); setTimeout(() => t.remove(), 250); }, err ? 6000 : 3500); } };
      return o;
    }

    // -------- send --------
    // items: [{ name, node }] (VFS file nodes)
    async function send(items, presetCode) {
      items = (items || []).filter((x) => x && x.node && x.node.type === "file");
      if (!items.length) { await dialog({ title: "Nearby sharing", html: "<p>Choose one or more files to share. Folders can't be shared — compress them to a ZIP file first.</p>" }); return; }
      const recent = cfg().recent || [];
      const body = el(`<div class="cn-ns-send"><p>Sharing <b class="cn-what"></b>.</p><p class="cn-sub">On the other Windows 12 device, open <b>Settings › System › Nearby sharing</b> (or the Nearby Sharing app) and type the 5-character code it shows. There's no Bluetooth in a browser, so the code is how devices find each other.</p><label class="cn-field">Code of the other device<input class="cn-input cn-codein" maxlength="5" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="e.g. 7KQ4M"></label><div class="cn-recent"></div><div class="cn-ns-st" role="status"></div></div>`);
      body.querySelector(".cn-what").textContent = items.length === 1 ? items[0].name : items.length + " files";
      const inp = body.querySelector(".cn-codein"); if (presetCode) inp.value = presetCode;
      inp.addEventListener("input", () => { const p = inp.selectionStart; inp.value = P().normCode(inp.value); try { inp.setSelectionRange(p, p); } catch (_) {} });
      recent.slice(0, 4).forEach((r) => { const b = el(`<button class="cn-chipbtn"></button>`); b.textContent = r.name + " · " + r.code; b.onclick = () => { inp.value = r.code; }; body.querySelector(".cn-recent").appendChild(b); });
      const go = await dialog({ title: "Nearby sharing", body, buttons: [{ t: "Share", v: () => inp.value, primary: true }, { t: "Cancel", v: null }] });
      if (!go) return;
      return sendTo(go, items);
    }
    async function sendTo(code, items) {
      const win = WM.createWindow({ title: "Nearby sharing", icon: Icon.mini("nearbyshare", "Nearby sharing"), width: 420, height: 300, appId: "nearbyshare" });
      win.body.classList.add("cn-app");
      win.body.innerHTML = `<div class="cn-ns-prog"><h3>Sharing ${items.length === 1 ? esc(items[0].name) : items.length + " files"}</h3><div class="cn-ns-st" role="status"><span class="cn-spin sm"></span> Looking for the device with code ${esc(P().normCode(code))}…</div><progress class="cn-bar" max="1" value="0"></progress><div class="cn-sub cn-ns-b"></div><div class="cn-row"><button class="cn-btn cn-cancel">Cancel</button></div></div>`;
      const stEl = win.body.querySelector(".cn-ns-st"), bar = win.body.querySelector("progress"), sub = win.body.querySelector(".cn-ns-b");
      let sess = null, cancelled = false;
      win.body.querySelector(".cn-cancel").onclick = () => { cancelled = true; if (sess) sess.close(); win.close(); };
      const fail = (msg) => { stEl.innerHTML = `<span class="cn-err"></span>`; stEl.firstChild.textContent = msg; win.body.querySelector(".cn-cancel").textContent = "Close"; };
      try {
        sess = await P().join("ns", code, myInfo("sender"));
        if (cancelled) { sess.close(); return; }
        const r = cfg().recent.filter((x) => x.code !== P().normCode(code)); r.unshift({ code: P().normCode(code), name: String(sess.peer.name || "Device").slice(0, 40), at: Date.now() }); cfg().recent = r.slice(0, 6); save();
        const packed = [];
        for (const it of items) packed.push(await packNode(it.name, it.node));
        const total = packed.reduce((a, p) => a + p.bytes.length, 0);
        stEl.innerHTML = `Waiting for <b></b> to accept… Make sure it shows ${sasHtml(sess.sas)}`;
        stEl.querySelector("b").textContent = sess.peer.name;
        const answer = new Promise((res) => { sess.onMessage((m) => { if (m.t === "accept" || m.t === "decline") res(m); }); sess.onClose(() => res({ t: "closed" })); });
        sess.send({ t: "offer", files: packed.map((p) => p.meta) });
        const a = await answer;
        if (a.t !== "accept") { fail(a.t === "decline" ? (a.why || sess.peer.name + " declined.") : "The other device disconnected."); return; }
        stEl.textContent = "Sending to " + sess.peer.name + "…";
        let sent = 0; const CH = 64 * 1024;
        const savedP = new Promise((res) => { let n = 0; sess.onMessage((m) => { if (m.t === "saved" && ++n === packed.length) res(); }); sess.onClose(res); });
        for (let i = 0; i < packed.length; i++) {
          const b = packed[i].bytes;
          for (let o = 0; o < b.length; o += CH) {
            if (sess.closed || cancelled) throw new Error("The transfer was stopped.");
            await sess.send({ t: "chunk", i }, b.subarray(o, o + CH)); sent += Math.min(CH, b.length - o);
            bar.value = total ? sent / total : 1; sub.textContent = fmtSize(sent) + " of " + fmtSize(total);
          }
          await sess.send({ t: "file-end", i });
        }
        await savedP;
        if (sess.closed && bar.value < 1) throw new Error("The other device disconnected.");
        await sess.send({ t: "done" });
        bar.value = 1; stEl.textContent = "Shared with " + sess.peer.name + "."; sub.textContent = fmtSize(total) + " sent";
        win.body.querySelector(".cn-cancel").textContent = "Done";
        log("Information", "NearbySharing", 303, "Sent " + items.map((x) => x.name).join(", ") + " to " + sess.peer.name + ".");
      } catch (e) { fail(e.message || String(e)); if (sess) sess.close(); }
    }

    // -------- app window: receive + send --------
    function openApp() {
      const ref = WM.createWindow({ title: "Nearby sharing", icon: Icon.mini("nearbyshare", "Nearby sharing"), width: Math.min(560, innerWidth - 30), height: Math.min(520, innerHeight - 90), appId: "nearbyshare", onClose: () => listeners.delete(paint) });
      ref.body.classList.add("cn-app");
      function paint() {
        if (!ref.body.isConnected) return;
        const c = cfg();
        ref.body.innerHTML = `<div class="cn-ns">
          <h2>Nearby sharing</h2>
          <div class="cn-card"><div class="cn-card-h"><b>Receive</b><select class="w12s-select cn-mode" aria-label="Nearby sharing">${[["off", "Off"], ["mine", "My devices only"], ["everyone", "Everyone nearby"]].map(([v, n]) => `<option value="${v}" ${c.mode === v ? "selected" : ""}>${n}</option>`).join("")}</select></div>
            ${c.mode === "off" ? `<p class="cn-sub">Turn on Nearby sharing to receive files from other Windows 12 devices.</p>` : `<div class="cn-bigcode" aria-label="Your code">${esc(c.code || "")}</div><p class="cn-sub">${hostState === "on" ? "Discoverable — the other device types this code to send you files." : hostState === "error" ? esc(hostErr) : "Getting ready…"}${hostErr && hostState === "on" ? "<br>" + esc(hostErr) : ""}</p><button class="cn-btn cn-newcode">New code</button>`}
          </div>
          <div class="cn-card"><div class="cn-card-h"><b>Send</b></div><p class="cn-sub">Pick files from this PC, then type the other device's code. In File Explorer you can also right-click files › <b>Share with Nearby sharing</b>.</p><div class="cn-row"><button class="cn-btn cn-primary cn-pick">Choose files…</button><button class="cn-btn cn-device">From this device…</button></div></div>
          <p class="cn-note">${LOCK_SVG} Files go straight to the other device (WebRTC, end-to-end encrypted). “My devices only” accepts devices you've marked as yours; there is no Bluetooth or Wi-Fi proximity in a browser, so discovery is by code.</p></div>`;
        ref.body.querySelector(".cn-mode").onchange = (e) => { setMode(e.target.value); };
        const nc = ref.body.querySelector(".cn-newcode"); if (nc) nc.onclick = newCode;
        ref.body.querySelector(".cn-pick").onclick = () => VFS.pickFile({ title: "Choose a file to share" }, (r) => { if (r && r.node) send([{ name: r.name, node: r.node }]); });
        ref.body.querySelector(".cn-device").onclick = () => {
          const i = document.createElement("input"); i.type = "file"; i.multiple = true;
          i.onchange = async () => { const items = []; for (const f of i.files) { items.push({ name: f.name, node: { type: "file", kind: "other", src: URL.createObjectURL(f), mime: f.type } }); } send(items); };
          i.click();
        };
      }
      listeners.add(paint); paint();
    }
    return { applyMode, setMode, newCode, send, sendTo, openApp, cfg, state: () => ({ hostState, hostErr }), on: (f) => { listeners.add(f); return () => listeners.delete(f); } };
  })();

  // ================================================================================================
  //  SCREEN SHARING core (used by Quick Assist and Remote Desktop)
  // ================================================================================================
  const Share = (function () {
    let active = null; // the one sharing session on this device
    let lastViewer = null;
    // ---- sharer ----
    async function startSharing(sess, o) {
      if (active) active.stop("replaced");
      o = o || {};
      const who = String((sess.peer && sess.peer.name) || "Helper");
      const s = { sess, controlled: !!o.control, paused: false, mode: "", stopped: false, stream: null, video: null, timer: 0, lastBtn: null };
      active = s;
      // capture method
      const canDisplay = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) && o.method !== "snap";
      if (canDisplay) {
        try {
          s.stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 10, max: 15 }, displaySurface: "browser" }, audio: false, preferCurrentTab: true, selfBrowserSurface: "include", surfaceSwitching: "exclude" });
          s.mode = "display";
          s.video = document.createElement("video"); s.video.muted = true; s.video.playsInline = true; s.video.srcObject = s.stream;
          await s.video.play().catch(() => {});
          s.stream.getVideoTracks().forEach((t) => t.addEventListener("ended", () => stop("ended")));
          const st = s.stream.getVideoTracks()[0] && s.stream.getVideoTracks()[0].getSettings ? s.stream.getVideoTracks()[0].getSettings() : {};
          s.surface = st.displaySurface || "";
        } catch (e) { s.stream = null; s.mode = ""; }
      }
      if (!s.mode) { if (!window.GBSnap) { sess.send({ t: "share-error", msg: "This PC can't capture its screen." }); active = null; return null; } s.mode = "snap"; }
      sess.send({ t: "share-start", mode: s.mode, surface: s.surface || "page" });
      log("Information", "QuickAssist", 400, "Screen sharing started with " + who + " (" + (s.mode === "display" ? "browser screen capture" : "page renderer") + ").");
      // banner + border
      const banner = el(`<div class="cn-banner gbs-skip" role="status" aria-live="polite"><span class="cn-banner-dot"></span><span class="cn-banner-t"></span><button class="cn-btn cn-banner-ctl" hidden>Take back control</button><button class="cn-btn cn-banner-pause">Pause</button><button class="cn-btn cn-danger cn-banner-stop">Stop sharing</button></div>`);
      const border = el(`<div class="cn-share-border gbs-skip" aria-hidden="true"></div>`);
      const cursor = el(`<div class="cn-rcursor gbs-skip" aria-hidden="true" hidden><svg viewBox="0 0 24 24" width="22" height="22"><path d="M4 2l15 11-7 1.2L8.8 21z" fill="#fff" stroke="#000" stroke-width="1.4" stroke-linejoin="round"/></svg><span></span></div>`);
      cursor.querySelector("span").textContent = who;
      document.body.append(border, banner, cursor);
      const paintBanner = () => {
        banner.querySelector(".cn-banner-t").textContent = s.paused ? "Screen sharing paused" : s.controlled ? who + " is controlling your screen" : "Sharing your screen with " + who;
        banner.querySelector(".cn-banner-ctl").hidden = !s.controlled;
        banner.querySelector(".cn-banner-pause").textContent = s.paused ? "Resume" : "Pause";
        banner.classList.toggle("cn-ctl", s.controlled);
        border.classList.toggle("cn-ctl", s.controlled);
      };
      paintBanner();
      // These buttons are never reachable by forwarded input (see apply()).
      banner.querySelector(".cn-banner-stop").onclick = () => stop("user");
      banner.querySelector(".cn-banner-pause").onclick = () => { s.paused = !s.paused; sess.send({ t: "share-paused", paused: s.paused }); paintBanner(); };
      banner.querySelector(".cn-banner-ctl").onclick = () => { s.controlled = false; cursor.hidden = true; sess.send({ t: "ctl-revoked" }); paintBanner(); log("Information", "QuickAssist", 403, "Control taken back from " + who + "."); };
      // frames
      let busy = false;
      const canvas = document.createElement("canvas");
      async function frame() {
        if (s.stopped) return;
        if (busy || s.paused || sess.buffered() > 1.5 * 1024 * 1024) return;
        busy = true;
        try {
          let region, blob;
          if (s.mode === "display" && s.video && s.video.videoWidth) {
            const vw = s.video.videoWidth, vh = s.video.videoHeight, k = Math.min(1, 1280 / vw);
            canvas.width = Math.round(vw * k); canvas.height = Math.round(vh * k);
            canvas.getContext("2d").drawImage(s.video, 0, 0, canvas.width, canvas.height);
            region = { x: 0, y: 0, w: innerWidth, h: innerHeight };
          } else if (s.mode === "snap") {
            const root = scr(), r = root.getBoundingClientRect();
            const out = await GBSnap.render({ scale: Math.min(1, 1280 / Math.max(1, r.width)), simple: s.simple });
            if (out.mode === "simplified") s.simple = true; // don't keep paying for a failing DOM render
            canvas.width = out.canvas.width; canvas.height = out.canvas.height; canvas.getContext("2d").drawImage(out.canvas, 0, 0);
            region = { x: r.left, y: r.top, w: r.width, h: r.height };
          }
          if (region) {
            blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.62));
            if (blob && !s.stopped) { s.region = region; await sess.send({ t: "frame", w: canvas.width, h: canvas.height, mode: s.mode }, new Uint8Array(await blob.arrayBuffer())); s.frames = (s.frames || 0) + 1; }
          }
        } catch (e) { console.warn("share frame", e); }
        busy = false;
      }
      s.timer = setInterval(frame, s.mode === "display" ? 150 : 600);
      frame();
      // control
      let down = null, lastClick = { t: 0, x: 0, y: 0 };
      function apply(m) {
        if (!s.controlled || s.paused) return;
        const rg = s.region || { x: 0, y: 0, w: innerWidth, h: innerHeight };
        if (m.t === "in") {
          const x = rg.x + Math.max(0, Math.min(1, m.nx)) * rg.w, y = rg.y + Math.max(0, Math.min(1, m.ny)) * rg.h;
          cursor.hidden = false; cursor.style.transform = `translate(${x}px,${y}px)`;
          let target = document.elementFromPoint(x, y);
          if (!target || target.closest(".cn-banner, .cn-toasts, .cn-mask.cn-local")) return; // the helper can never press Stop / consent buttons
          const base = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, screenX: x, screenY: y, view: window };
          const btn = m.b | 0, btns = m.e === "up" ? 0 : (btn === 2 ? 2 : 1);
          const P2 = (type, extra) => { try { target.dispatchEvent(new PointerEvent(type, Object.assign({}, base, { pointerId: 77, pointerType: "mouse", isPrimary: true, button: btn, buttons: btns }, extra))); } catch (_) {} };
          const M = (type, extra) => target.dispatchEvent(new MouseEvent(type, Object.assign({}, base, { button: btn, buttons: btns }, extra)));
          if (m.e === "move") { if (down) { down.target && (target = target); } P2("pointermove", { button: -1 }); M("mousemove"); }
          else if (m.e === "down") {
            down = { x, y, target, t: Date.now() };
            P2("pointerdown"); M("mousedown");
            const f = target.closest("input, textarea, select, [contenteditable='true'], [contenteditable=''], button, a, [tabindex]");
            if (f && typeof f.focus === "function") { try { f.focus({ preventScroll: true }); } catch (_) {} }
          } else if (m.e === "up") {
            P2("pointerup"); M("mouseup");
            if (down && Math.hypot(x - down.x, y - down.y) < 8) {
              if (btn === 2) M("contextmenu");
              else {
                M("click", { detail: 1 });
                const now = Date.now();
                if (now - lastClick.t < 450 && Math.hypot(x - lastClick.x, y - lastClick.y) < 10) { M("dblclick", { detail: 2 }); lastClick.t = 0; }
                else lastClick = { t: now, x, y };
              }
            }
            down = null;
          } else if (m.e === "wheel") {
            try { target.dispatchEvent(new WheelEvent("wheel", Object.assign({}, base, { deltaX: m.dx || 0, deltaY: m.dy || 0 }))); } catch (_) {}
            let n = target; while (n && n !== document.body) { const cs = getComputedStyle(n); if (/(auto|scroll)/.test(cs.overflowY + cs.overflowX) && (n.scrollHeight > n.clientHeight || n.scrollWidth > n.clientWidth)) { n.scrollBy(m.dx || 0, m.dy || 0); break; } n = n.parentElement; }
          }
        } else if (m.t === "key") applyKey(m);
      }
      sess.onMessage((m) => {
        if (s.stopped) return;
        if (m.t === "ctl-req" && !s.controlled) askControl();
        else if (m.t === "ctl-release") { s.controlled = false; cursor.hidden = true; paintBanner(); }
        else if (m.t === "in" || m.t === "key") apply(m);
        else if (m.t === "leave") stop("helper");
      });
      let asking = false;
      async function askControl() {
        if (asking) return; asking = true;
        const ok = await dialog({ title: who + " wants to control your screen", html: `<p>${esc(who)} will be able to use your mouse and keyboard in Windows 12. You can take back control or stop sharing at any time from the bar at the top.</p>`, buttons: [{ t: "Allow", v: true, primary: true }, { t: "Decline", v: false }], cancel: false, local: true, host: document.body });
        asking = false;
        if (s.stopped) return;
        s.controlled = !!ok; paintBanner();
        sess.send({ t: ok ? "ctl-ok" : "ctl-no" });
        log("Information", "QuickAssist", ok ? 401 : 402, (ok ? "Allowed " : "Declined ") + who + " to control this device.");
      }
      function stop(why) {
        if (s.stopped) return; s.stopped = true; clearInterval(s.timer);
        if (s.stream) s.stream.getTracks().forEach((t) => t.stop());
        banner.remove(); border.remove(); cursor.remove();
        if (why !== "closed") { sess.send({ t: "share-stop" }); setTimeout(() => sess.close(), 300); }
        if (active === s) active = null;
        log("Information", "QuickAssist", 404, "Screen sharing ended (" + why + ").");
        if (why === "helper" || why === "closed") { toast.ic = o.icon || "quickassist"; toast(o.app || "Quick Assist", "Screen sharing with " + who + " has ended."); }
        o.onStop && o.onStop(why);
      }
      sess.onClose(() => stop("closed"));
      s.stop = stop; s.askControl = askControl; s.apply = apply; s.paintBanner = paintBanner;
      return s;
    }
    function editable(n) { return n && (n.tagName === "TEXTAREA" || (n.tagName === "INPUT" && !/^(checkbox|radio|button|submit|reset|file|range|color|image)$/i.test(n.type)) || n.isContentEditable); }
    function insertText(n, text) {
      if (n.isContentEditable) { try { document.execCommand("insertText", false, text); } catch (_) {} return; }
      const a = n.selectionStart != null ? n.selectionStart : n.value.length, b = n.selectionEnd != null ? n.selectionEnd : a;
      try { n.setRangeText(text, a, b, "end"); } catch (_) { n.value += text; }
      n.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
    }
    function applyKey(m) {
      const t = document.activeElement || document.body;
      if (t.closest && t.closest(".cn-banner, .cn-local, .cn-toasts")) return; // consent UI is local-only
      const init = { key: m.key, code: m.code || "", ctrlKey: !!m.ctrl, shiftKey: !!m.shift, altKey: !!m.alt, metaKey: !!m.meta, bubbles: true, cancelable: true, composed: true };
      const ev = new KeyboardEvent("keydown", init); const ok = t.dispatchEvent(ev);
      if (ok && !m.ctrl && !m.meta && !m.alt) {
        if (m.key.length === 1 && editable(t)) insertText(t, m.key);
        else if (m.key === "Backspace" && editable(t)) {
          if (t.isContentEditable) { try { document.execCommand("delete"); } catch (_) {} }
          else { const a = t.selectionStart, b = t.selectionEnd; if (a === b && a > 0) t.setRangeText("", a - 1, a, "end"); else t.setRangeText("", a, b, "end"); t.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "deleteContentBackward" })); }
        } else if (m.key === "Enter" && editable(t)) {
          if (t.tagName === "TEXTAREA" || t.isContentEditable) insertText(t, "\n");
          else if (t.form) { try { t.form.requestSubmit ? t.form.requestSubmit() : t.form.submit(); } catch (_) {} }
        }
      }
      t.dispatchEvent(new KeyboardEvent("keyup", init));
    }

    // ---- viewer (helper) window ----
    function openViewer(sess, o) {
      o = o || {};
      const who = String((sess.peer && sess.peer.name) || "Device");
      const ref = WM.createWindow({ title: (o.title || "Quick Assist") + " — " + who, icon: Icon.mini(o.icon || "quickassist", o.title || "Quick Assist"), width: Math.min(1000, innerWidth - 20), height: Math.min(700, innerHeight - 70), appId: o.appId || "quickassist", onClose: () => { if (!sess.closed) { sess.send({ t: "leave" }); setTimeout(() => sess.close(), 200); } } });
      ref.body.classList.add("cn-app", "cn-viewer");
      ref.body.innerHTML = `<div class="cn-vbar"><span class="cn-vstate" role="status"></span><span class="cn-grow"></span><button class="cn-btn cn-vctl">Request control</button><button class="cn-btn cn-vkbd" hidden title="Show the keyboard">Keyboard</button><button class="cn-btn cn-danger cn-vleave">Leave</button></div><div class="cn-vstage" tabindex="0" aria-label="Remote screen"><canvas class="cn-vcanvas"></canvas><div class="cn-vmsg"></div><input class="cn-vkbin" aria-label="Type on the remote device" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false"></div>`;
      const stEl = ref.body.querySelector(".cn-vstate"), ctlBtn = ref.body.querySelector(".cn-vctl"), stage = ref.body.querySelector(".cn-vstage"), cv = ref.body.querySelector("canvas"), msg = ref.body.querySelector(".cn-vmsg"), kb = ref.body.querySelector(".cn-vkbd"), kbin = ref.body.querySelector(".cn-vkbin");
      const v = { ctl: o.autoControl ? "asking" : "none", frames: 0, sharing: false, ended: false };
      const paint = () => {
        stEl.textContent = v.ended ? "Session ended" : !v.sharing ? "Waiting for " + who + " to share their screen…" : v.paused ? who + " paused sharing" : v.ctl === "on" ? "You're controlling " + who + "'s screen" : "Viewing " + who + "'s screen";
        ctlBtn.textContent = v.ctl === "on" ? "Stop controlling" : v.ctl === "asking" ? "Waiting for permission…" : "Request control";
        ctlBtn.disabled = v.ctl === "asking" || !v.sharing || v.ended;
        kb.hidden = v.ctl !== "on";
        stage.classList.toggle("cn-controlling", v.ctl === "on");
        msg.textContent = v.ended ? "The session has ended." : v.frames ? "" : (v.sharing ? "Loading the screen…" : "Waiting for " + who + " to allow screen sharing. They'll see the number " + sess.sas + ".");
        msg.hidden = !msg.textContent;
      };
      paint();
      const g = cv.getContext("2d");
      let drawing = false, pending = null;
      async function draw(m, bytes) {
        if (drawing) { pending = [m, bytes]; return; }
        drawing = true;
        try {
          const bmp = await createImageBitmap(new Blob([bytes], { type: "image/jpeg" }));
          if (cv.width !== m.w || cv.height !== m.h) { cv.width = m.w; cv.height = m.h; }
          g.drawImage(bmp, 0, 0); if (bmp.close) bmp.close();
          v.frames++; if (v.frames === 1) paint();
          ref.body.dataset.frames = v.frames;
        } catch (_) {}
        drawing = false;
        if (pending) { const p = pending; pending = null; draw(p[0], p[1]); }
      }
      sess.onMessage((m, bytes) => {
        if (m.t === "frame" && bytes) draw(m, bytes);
        else if (m.t === "share-start") { v.sharing = true; v.mode = m.mode; paint(); if (o.autoControl) sess.send({ t: "ctl-req" }); }
        else if (m.t === "share-paused") { v.paused = !!m.paused; paint(); }
        else if (m.t === "ctl-ok") { v.ctl = "on"; paint(); try { stage.focus({ preventScroll: true }); } catch (_) {} }
        else if (m.t === "ctl-no") { v.ctl = "none"; paint(); stEl.textContent = who + " declined control."; }
        else if (m.t === "ctl-revoked") { v.ctl = "none"; paint(); stEl.textContent = who + " took back control."; }
        else if (m.t === "share-declined") { v.ended = true; paint(); msg.textContent = who + " declined to share their screen."; msg.hidden = false; }
        else if (m.t === "share-error") { v.ended = true; paint(); msg.textContent = m.msg || "Sharing failed."; msg.hidden = false; }
        else if (m.t === "share-stop") { v.ended = true; paint(); }
      });
      sess.onClose(() => { v.ended = true; v.ctl = "none"; paint(); });
      ctlBtn.onclick = () => {
        if (v.ctl === "on") { v.ctl = "none"; sess.send({ t: "ctl-release" }); paint(); return; }
        v.ctl = "asking"; sess.send({ t: "ctl-req" }); paint();
      };
      ref.body.querySelector(".cn-vleave").onclick = () => { sess.send({ t: "leave" }); setTimeout(() => sess.close(), 200); ref.close(); };
      // input forwarding (only while control was granted)
      const norm = (e) => {
        const r = cv.getBoundingClientRect(); if (!cv.width) return null;
        const k = Math.min(r.width / cv.width, r.height / cv.height), w = cv.width * k, h = cv.height * k, ox = r.left + (r.width - w) / 2, oy = r.top + (r.height - h) / 2;
        const nx = (e.clientX - ox) / w, ny = (e.clientY - oy) / h;
        if (nx < 0 || ny < 0 || nx > 1 || ny > 1) return null;
        return { nx, ny };
      };
      let lastMove = 0, isDown = false;
      stage.addEventListener("pointerdown", (e) => { if (v.ctl !== "on") return; const p = norm(e); if (!p) return; e.preventDefault(); isDown = true; try { stage.setPointerCapture(e.pointerId); } catch (_) {} try { stage.focus({ preventScroll: true }); } catch (_) {} sess.send({ t: "in", e: "down", b: e.button === 2 ? 2 : 0, nx: p.nx, ny: p.ny }); });
      stage.addEventListener("pointermove", (e) => { if (v.ctl !== "on") return; const now = performance.now(); if (now - lastMove < 33 && !isDown) return; lastMove = now; const p = norm(e); if (!p) return; sess.send({ t: "in", e: "move", nx: p.nx, ny: p.ny }); });
      stage.addEventListener("pointerup", (e) => { if (v.ctl !== "on" || !isDown) return; isDown = false; const p = norm(e) || { nx: 0, ny: 0 }; sess.send({ t: "in", e: "up", b: e.button === 2 ? 2 : 0, nx: p.nx, ny: p.ny }); });
      stage.addEventListener("contextmenu", (e) => { if (v.ctl === "on") e.preventDefault(); });
      stage.addEventListener("wheel", (e) => { if (v.ctl !== "on") return; const p = norm(e); if (!p) return; e.preventDefault(); sess.send({ t: "in", e: "wheel", nx: p.nx, ny: p.ny, dx: e.deltaX, dy: e.deltaY }); }, { passive: false });
      stage.addEventListener("keydown", (e) => {
        if (v.ctl !== "on" || e.target === kbin) return;
        e.preventDefault(); e.stopPropagation();
        sess.send({ t: "key", key: e.key, code: e.code, ctrl: e.ctrlKey, shift: e.shiftKey, alt: e.altKey, meta: e.metaKey });
      });
      // iPad: a real text field brings up the on-screen keyboard; its input is forwarded as keys.
      kb.onclick = () => { kbin.value = ""; kbin.focus(); };
      kbin.addEventListener("keydown", (e) => { if (v.ctl !== "on") return; if (["Enter", "Backspace", "Tab", "Escape", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) { e.preventDefault(); sess.send({ t: "key", key: e.key, code: e.code }); } });
      kbin.addEventListener("input", (e) => { if (v.ctl !== "on") return; const d = e.data || kbin.value; for (const ch of d || "") sess.send({ t: "key", key: ch }); kbin.value = ""; });
      ref.viewer = v; ref.sess = sess; lastViewer = ref;
      return ref;
    }
    return { startSharing, openViewer, active: () => active, lastViewer: () => lastViewer, applyKey };
  })();

  // ================================================================================================
  //  QUICK ASSIST
  // ================================================================================================
  function quickAssist() {
    const ref = WM.createWindow({ title: "Quick Assist", icon: Icon.mini("quickassist", "Quick Assist"), width: Math.min(560, innerWidth - 30), height: Math.min(560, innerHeight - 90), appId: "quickassist", onClose: () => { if (helpHost) helpHost.stop(); } });
    ref.body.classList.add("cn-app");
    let helpHost = null;
    function home() {
      ref.body.innerHTML = `<div class="cn-qa">
        <div class="cn-qa-hero">${Icon.big ? Icon.big("quickassist", "Quick Assist") : ""}<h2>Quick Assist</h2></div>
        <div class="cn-card"><b>Get assistance</b><p class="cn-sub">Allow someone you trust to help you by sharing your screen.</p><label class="cn-field">Code from assistant<input class="cn-input cn-code5" maxlength="5" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="5 characters"></label><div class="cn-err" role="alert"></div><button class="cn-btn cn-primary cn-submit">Submit</button></div>
        <div class="cn-card"><b>Give assistance</b><p class="cn-sub">Assist another person over a secure connection.</p><button class="cn-btn cn-primary cn-help">Help someone</button></div>
        <p class="cn-note">${LOCK_SVG} Only share your screen with people you trust. Your screen goes directly to their device (WebRTC, end-to-end encrypted); nothing is recorded or stored.</p></div>`;
      const inp = ref.body.querySelector(".cn-code5");
      inp.addEventListener("input", () => { inp.value = P().normCode(inp.value); });
      ref.body.querySelector(".cn-help").onclick = giveHelp;
      ref.body.querySelector(".cn-submit").onclick = () => getHelp(inp.value);
      inp.addEventListener("keydown", (e) => { if (e.key === "Enter") getHelp(inp.value); });
    }
    async function giveHelp() {
      const code = P().newCode();
      ref.body.innerHTML = `<div class="cn-qa"><h2>Share security code</h2><p class="cn-sub">Share this code with the person you're helping. They type it in Quick Assist under “Get assistance”.</p><div class="cn-bigcode">${esc(code)}</div><div class="cn-qa-st" role="status"><span class="cn-spin sm"></span> Waiting for the other person…</div><button class="cn-btn cn-back">Cancel</button></div>`;
      ref.body.querySelector(".cn-back").onclick = () => { if (helpHost) { helpHost.stop(); helpHost = null; } home(); };
      const st = ref.body.querySelector(".cn-qa-st");
      helpHost = await startHost("qa", code, Object.assign(myInfo("helper"), {
        onSession: (sess) => {
          if (helpHost) { helpHost.stop(true); helpHost = null; } // one helper per code; keep this session
          ref.close();
          Share.openViewer(sess, { title: "Quick Assist", appId: "quickassist" });
          log("Information", "QuickAssist", 410, "Helping " + sess.peer.name + " (confirmation " + sess.sas + ").");
        },
        onStatus: (s) => { if (s.error) st.innerHTML = `<span class="cn-err">${esc(s.error)}</span>`; },
      }));
      if (helpHost && helpHost.peerError) st.insertAdjacentHTML("beforeend", `<div class="cn-warn">Internet connections unavailable (${esc(helpHost.peerError)}) — only another tab on this device can connect.</div>`);
    }
    async function getHelp(code) {
      const err = ref.body.querySelector(".cn-err"); err.textContent = "";
      if (!P().validCode(P().normCode(code))) { err.textContent = "Enter the 5-character code from the person helping you."; return; }
      const btn = ref.body.querySelector(".cn-submit"); btn.disabled = true; btn.textContent = "Connecting…";
      let sess;
      try { sess = await P().join("qa", code, myInfo("sharer")); }
      catch (e) { err.textContent = e.message || String(e); btn.disabled = false; btn.textContent = "Submit"; return; }
      shareConsent(sess, "Quick Assist", ref);
    }
    home();
    return ref;
  }
  async function shareConsent(sess, appName, ref) {
    const who = sess.peer.name;
    const body = el(`<div><p><b></b> wants to see your screen.</p><p>Make sure they see the number ${sasHtml(sess.sas)} — if not, select Decline.</p><p class="cn-sub">They'll see everything on the Windows 12 screen. They can ask to control it; you'll be asked first, and you can stop at any time.</p></div>`);
    body.querySelector("b").textContent = who;
    const ok = await dialog({ title: appName + ": share your screen?", body, buttons: [{ t: "Allow", v: true, primary: true }, { t: "Decline", v: false }], cancel: false, local: true });
    if (!ok || sess.closed) { sess.send({ t: "share-declined" }); setTimeout(() => sess.close(), 300); if (ref && ref.body.isConnected) ref.close(); return; }
    if (ref && ref.body.isConnected) {
      ref.body.innerHTML = `<div class="cn-qa"><h2>Sharing your screen</h2><p class="cn-sub">You're sharing with <b></b>. Use the bar at the top of the screen to pause or stop.</p></div>`;
      ref.body.querySelector("b").textContent = who;
    }
    await Share.startSharing(sess, { onStop: () => { if (ref && ref.body.isConnected) ref.close(); } });
  }

  // ================================================================================================
  //  REMOTE DESKTOP (same transport, saved connections, code based)
  // ================================================================================================
  const RD = (function () {
    let hostRef = null, hostState = "off", hostErr = "";
    const cfg = () => store().rdp;
    function ensureCode() { if (!cfg().code || !P().validCode(cfg().code)) { cfg().code = P().newCode(); save(); } return cfg().code; }
    async function apply() {
      if (!cfg().enabled || IN_SANDBOX) { if (hostRef) { hostRef.stop(); hostRef = null; } hostState = "off"; return; }
      if (hostRef) return;
      hostState = "starting";
      const ref = await startHost("rd", ensureCode(), Object.assign(myInfo("rdhost"), {
        onSession: async (sess) => {
          const body = el(`<div><p><b></b> wants to connect to this PC with Remote Desktop and use it (screen, mouse and keyboard).</p><p>Make sure they see ${sasHtml(sess.sas)}.</p></div>`);
          body.querySelector("b").textContent = sess.peer.name;
          const ok = await dialog({ title: "Allow Remote Desktop connection?", body, buttons: [{ t: "Allow", v: true, primary: true }, { t: "Deny", v: false }], cancel: false, local: true });
          if (!ok || sess.closed) { sess.send({ t: "share-declined" }); setTimeout(() => sess.close(), 300); log("Warning", "TerminalServices-RemoteConnectionManager", 1149, "Denied a Remote Desktop connection from " + sess.peer.name + "."); return; }
          log("Information", "TerminalServices-RemoteConnectionManager", 1149, "Remote Desktop connection from " + sess.peer.name + " allowed.");
          const s = await Share.startSharing(sess, { control: false });
          // RDP: consent to the connection already includes control
          if (s) { s.controlled = true; s.paintBanner(); sess.send({ t: "ctl-ok" }); }
        },
        onStatus: (s) => { if (s.error) { hostErr = s.error; hostState = "error"; } },
      }));
      if (ref) { hostRef = ref; hostState = "on"; hostErr = ref.peerError || ""; }
    }
    function setEnabled(on) { cfg().enabled = !!on; save(); if (hostRef) { hostRef.stop(); hostRef = null; } apply(); }
    function openApp() {
      const ref = WM.createWindow({ title: "Remote Desktop Connection", icon: Icon.mini("remotedesktop", "Remote Desktop Connection"), width: Math.min(520, innerWidth - 30), height: Math.min(480, innerHeight - 90), appId: "remotedesktop" });
      ref.body.classList.add("cn-app");
      function paint(err) {
        const saved = cfg().saved || [];
        ref.body.innerHTML = `<div class="cn-rd">
          <div class="cn-rd-hero">${Icon.mini("remotedesktop", "")}<div><b>Remote Desktop</b><span>Connection</span></div></div>
          <label class="cn-field">Computer (its Remote Desktop code)<input class="cn-input cn-rdcode" maxlength="5" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="e.g. 7KQ4M"></label>
          <label class="cn-field">Save as (optional)<input class="cn-input cn-rdname" maxlength="40" placeholder="Living room PC"></label>
          <div class="cn-err" role="alert"></div>
          <div class="cn-row"><button class="cn-btn cn-primary cn-rdgo">Connect</button></div>
          <h4>Saved connections</h4><div class="cn-rdlist"></div>
          <p class="cn-note">On the other Windows 12 PC turn on <b>Settings › System › Remote Desktop</b>; it shows the code. Someone at that PC must allow each connection.</p></div>`;
        if (err) ref.body.querySelector(".cn-err").textContent = err;
        const L = ref.body.querySelector(".cn-rdlist");
        saved.forEach((s, i) => { const r = el(`<div class="cn-rdrow"><button class="cn-rdopen"><b></b><span></span></button><button class="cn-btn cn-rddel" aria-label="Remove">Remove</button></div>`); r.querySelector("b").textContent = s.name; r.querySelector("span").textContent = s.code + (s.last ? " · last used " + new Date(s.last).toLocaleDateString() : ""); r.querySelector(".cn-rdopen").onclick = () => connect(s.code, s.name); r.querySelector(".cn-rddel").onclick = () => { saved.splice(i, 1); save(); paint(); }; L.appendChild(r); });
        if (!saved.length) L.appendChild(el(`<div class="cn-empty">No saved connections yet.</div>`));
        const ci = ref.body.querySelector(".cn-rdcode"); ci.addEventListener("input", () => { ci.value = P().normCode(ci.value); });
        ref.body.querySelector(".cn-rdgo").onclick = () => connect(ci.value, ref.body.querySelector(".cn-rdname").value.trim());
      }
      async function connect(code, name) {
        code = P().normCode(code);
        if (!P().validCode(code)) { paint("Type the 5-character code shown on the other PC."); return; }
        const btn = ref.body.querySelector(".cn-rdgo"); if (btn) { btn.disabled = true; btn.textContent = "Connecting…"; }
        try {
          const sess = await P().join("rd", code, myInfo("rdclient"));
          const saved = cfg().saved; const ex = saved.find((x) => x.code === code);
          if (ex) { ex.last = Date.now(); if (name) ex.name = name; } else saved.unshift({ code, name: name || String(sess.peer.name).slice(0, 40), last: Date.now() });
          save();
          ref.close();
          Share.openViewer(sess, { title: "Remote Desktop", icon: "remotedesktop", appId: "remotedesktop" });
        } catch (e) { paint(e.message || String(e)); }
      }
      paint();
    }
    return { apply, setEnabled, openApp, cfg, state: () => ({ hostState, hostErr }) };
  })();

  // ================================================================================================
  //  File Explorer: "Share with Nearby sharing" (runtime hook, files12.js unchanged)
  // ================================================================================================
  function explorerSelection() {
    const wins = (WM.windows ? WM.windows() : []).filter((e) => e.appId === "fileexplorer" && e.win.isConnected).sort((a, b) => (+b.win.style.zIndex || 0) - (+a.win.style.zIndex || 0));
    for (const e of wins) {
      const keys = [...e.win.querySelectorAll(".fx12-body .fx-it.sel[data-k]")].map((n) => n.dataset.k).filter((k) => k && !/^(bin|zip):/.test(k));
      if (keys.length) return keys.map((k) => k.split("/"));
    }
    return [];
  }
  function hookExplorer() {
    const s = document.getElementById("screen"); if (!s) { setTimeout(hookExplorer, 800); return; }
    new MutationObserver((recs) => recs.forEach((r) => r.addedNodes.forEach((m) => {
      if (m.nodeType !== 1 || !m.classList || !m.classList.contains("fx12-pop") || m.querySelector(".cn-fx-ns")) return;
      const level0 = m.dataset.level === "0" && m.querySelector(":scope > .fx-pop-strip");
      const sendTo = !level0 && [...m.querySelectorAll(":scope > button")].some((b) => /Compressed \(zipped\) folder/.test(b.textContent));
      if (!level0 && !sendTo) return;
      const sel = explorerSelection(); if (!sel.length) return;
      const items = sel.map((p) => ({ name: p[p.length - 1], node: nodeAtPath(p) })).filter((x) => x.node && x.node.type === "file");
      if (!items.length) return;
      const born = Date.now();
      const b = el(`<button role="menuitem" class="cn-fx-ns"><span class="fx-pop-ic">${Icon.mini("nearbyshare", "")}</span><span class="fx-pop-t">${level0 ? "Share with Nearby sharing" : "Nearby sharing"}</span></button>`);
      b.onclick = (e) => { e.stopPropagation(); if (Date.now() - born < 250) return; document.querySelectorAll(".fx12-pop").forEach((x) => x.remove()); NS.send(items); };
      if (level0) { const after = [...m.querySelectorAll(":scope > button")].find((x) => /^Send to/.test(x.textContent.trim())); if (after) after.before(b); else m.appendChild(b); }
      else m.appendChild(b);
      const H = innerHeight, top = parseFloat(m.style.top) || 0; if (top + m.offsetHeight > H - 6) m.style.top = Math.max(4, H - m.offsetHeight - 6) + "px";
    }))).observe(s, { childList: true });
  }

  // ================================================================================================
  //  Settings pages (settings12.js unchanged: rows are made clickable at run time)
  // ================================================================================================
  const svgI = (p) => `<svg class="w12s-svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="url(#w12s-g)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const ICONS = {
    share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 11l7.6-3.8M8.2 13l7.6 3.8"/>',
    remote: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16v4M9 10h6M13 8l2 2-2 2"/>',
    phone: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/>',
    lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  };
  function sRow(ic, t, s, o) {
    o = o || {};
    const click = !!o.onClick;
    const r = el(`<div class="w12s-row ${click ? "w12s-click" : "w12s-row-static"} cn-srow" tabindex="${click ? 0 : -1}"><span class="w12s-row-ic">${svgI(ICONS[ic] || ICONS.share)}</span><div class="w12s-row-txt"><div class="w12s-row-t"></div><div class="w12s-row-s"></div></div><div class="w12s-row-ctl"></div>${click ? `<span class="w12s-chev"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 6l6 6-6 6"/></svg></span>` : ""}</div>`);
    r.querySelector(".w12s-row-t").textContent = t; r.querySelector(".w12s-row-s").textContent = s || "";
    if (o.ctl) r.querySelector(".w12s-row-ctl").appendChild(o.ctl);
    if (click) { r.onclick = o.onClick; r.addEventListener("keydown", (e) => { if (e.key === "Enter") o.onClick(); }); }
    return r;
  }
  function sToggle(on, fn, label) { const t = el(`<label class="w12s-sw"><input type="checkbox" ${on ? "checked" : ""} aria-label="${esc(label || "")}"><span></span></label>`); t.addEventListener("click", (e) => e.stopPropagation()); t.querySelector("input").onchange = (e) => fn(e.target.checked); return t; }
  // Render one of our sub-pages inside a Settings window (same look as settings12's own sub-pages).
  function renderSub(page, key) {
    const sp = SUBS[key]; const root = page && page.closest(".w12s"); if (!sp || !root) return;
    const navA = root.querySelector(`.w12s-nav-it[data-p="${sp.parent}"]`);
    root.querySelectorAll(".w12s-nav-it").forEach((a) => a.classList.toggle("on", a === navA));
    const f = root.querySelector(".w12s-focus"); if (navA && f) { f.style.top = (navA.offsetTop + navA.offsetHeight / 2 - 9) + "px"; f.style.opacity = "1"; }
    page.innerHTML = ""; page.scrollTop = 0;
    const head = el(`<h1 class="w12s-title"><a class="w12s-crumb" tabindex="0"></a><span class="w12s-crumb-sep">›</span><span class="cn-ttl"></span></h1>`);
    head.querySelector(".w12s-crumb").textContent = navA ? (navA.lastElementChild || navA).textContent.trim() : "Settings";
    head.querySelector(".cn-ttl").textContent = sp.title;
    head.querySelector(".w12s-crumb").onclick = () => navA && navA.click();
    page.appendChild(head);
    const box = el(`<div class="w12s-list" data-cn-page="${key}"></div>`); page.appendChild(box);
    sp.build(box, () => renderSub(page, key));
  }
  const SUBS = {
    "cn-nearby": { title: "Nearby sharing", parent: "system", build(h, redraw) {
      const c = NS.cfg(), st = NS.state();
      const r = sRow("share", "Nearby sharing", "Share files with other Windows 12 devices, found by a 5-character code");
      const sel = el(`<select class="w12s-select" aria-label="Nearby sharing">${[["off", "Off"], ["mine", "My devices only"], ["everyone", "Everyone nearby"]].map(([v, n]) => `<option value="${v}" ${c.mode === v ? "selected" : ""}>${n}</option>`).join("")}</select>`);
      sel.addEventListener("click", (e) => e.stopPropagation());
      sel.onchange = () => { NS.setMode(sel.value); setTimeout(redraw, 50); };
      r.querySelector(".w12s-row-ctl").appendChild(sel); h.appendChild(r);
      if (c.mode !== "off") {
        h.appendChild(el(`<div class="w12s-card cn-scard"><div class="w12s-row-s">Your code — type it on the device that's sending</div><div class="cn-bigcode">${esc(c.code || "…")}</div><div class="w12s-row-s">${st.hostState === "on" ? "Discoverable now" : st.hostState === "error" ? esc(st.hostErr) : "Getting ready…"}</div></div>`));
        const nc = el(`<button class="w12s-btn">New code</button>`); nc.onclick = () => { NS.newCode(); setTimeout(redraw, 50); };
        h.appendChild(sRow("lock", "Change my code", "Anyone who knows your code can offer you files (you always accept or decline)", { ctl: nc }));
      }
      const tr = c.trusted || [];
      h.appendChild(el(`<div class="cn-s-h">My devices (${tr.length})</div>`));
      if (!tr.length) h.appendChild(el(`<div class="w12s-row w12s-row-static"><div class="w12s-row-txt"><div class="w12s-row-s">When you accept a share, tick “This is one of my devices” to add it here. With “My devices only”, shares from other devices are declined automatically.</div></div></div>`));
      tr.forEach((d, i) => { const rm = el(`<button class="w12s-btn">Remove</button>`); rm.onclick = () => { tr.splice(i, 1); save(); redraw(); }; h.appendChild(sRow("phone", d.name, "Added " + new Date(d.at).toLocaleDateString(), { ctl: rm })); });
      h.appendChild(el(`<div class="cn-s-note">How it works: there is no Bluetooth or Wi-Fi proximity in a web browser, so “nearby” means “knows your code”. Files travel directly between the two devices over WebRTC, encrypted end to end; a free PeerJS broker only introduces the devices. Saved files go to Downloads.</div>`));
      const open = el(`<button class="w12s-btn">Open Nearby sharing</button>`); open.onclick = () => NS.openApp();
      h.appendChild(sRow("share", "Send files", "Choose files and the other device's code", { ctl: open }));
    } },
    "cn-rdp": { title: "Remote Desktop", parent: "system", build(h, redraw) {
      const c = RD.cfg(), st = RD.state();
      h.appendChild(sRow("remote", "Remote Desktop", "Connect to and use this PC from another Windows 12 device with the Remote Desktop Connection app", { ctl: sToggle(c.enabled, (v) => { if (v && !confirm("Enable Remote Desktop?\n\nAnyone with this PC's code can ask to connect. Someone at this PC must allow each connection, and can disconnect any time.")) { redraw(); return; } RD.setEnabled(v); setTimeout(redraw, 400); }, "Remote Desktop") }));
      if (c.enabled) h.appendChild(el(`<div class="w12s-card cn-scard"><div class="w12s-row-s">This PC's Remote Desktop code</div><div class="cn-bigcode">${esc(c.code || "…")}</div><div class="w12s-row-s">${esc(pcName())} · ${st.hostState === "error" ? esc(st.hostErr) : "Ready for connections"}</div></div>`));
      const op = el(`<button class="w12s-btn">Open</button>`); op.onclick = () => RD.openApp();
      h.appendChild(sRow("remote", "Remote Desktop Connection", "Connect to another PC", { ctl: op }));
      const qa = el(`<button class="w12s-btn">Open</button>`); qa.onclick = () => quickAssist();
      h.appendChild(sRow("share", "Quick Assist", "Get or give help by sharing a screen", { ctl: qa }));
      h.appendChild(el(`<div class="cn-s-note">Remote Desktop here is code based: no network discovery or Windows accounts. The screen is sent as images over an end-to-end encrypted WebRTC connection; input from the other PC is replayed only after it is allowed, with a banner and a Stop button on this screen.</div>`));
    } },
  };
  window.SettingsSubs = window.SettingsSubs || {};
  Object.keys(SUBS).forEach((k) => { if (!Object.prototype.hasOwnProperty.call(window.SettingsSubs, k)) window.SettingsSubs[k] = { title: SUBS[k].title, parent: SUBS[k].parent, build: SUBS[k].build }; });
  function enhanceSettings(page) {
    const list = page.querySelector(":scope > .w12s-list"); if (!list || list.dataset.cnDone || list.dataset.cnPage) return;
    const root = page.closest(".w12s"); const navOn = root && root.querySelector(".w12s-nav-it.on"); const sec = navOn && navOn.dataset.p;
    const rows = [...list.querySelectorAll(":scope > .w12s-row")]; const byT = (t) => rows.find((r) => { const x = r.querySelector(".w12s-row-t"); return x && x.textContent.trim() === t; });
    const make = (row, fn) => { if (!row || row.__cn) return; row.__cn = true; row.classList.remove("w12s-row-static"); row.classList.add("w12s-click"); row.tabIndex = 0; row.onclick = fn; row.addEventListener("keydown", (e) => { if (e.key === "Enter") fn(); }); if (!row.querySelector(".w12s-chev")) row.insertAdjacentHTML("beforeend", `<span class="w12s-chev"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 6l6 6-6 6"/></svg></span>`); };
    if (sec === "system") {
      list.dataset.cnDone = "1";
      make(byT("Remote Desktop"), () => renderSub(page, "cn-rdp"));
      if (!byT("Nearby sharing")) {
        const r = sRow("share", "Nearby sharing", "Discoverability, received files location", { onClick: () => renderSub(page, "cn-nearby") });
        const after = byT("Projecting to this PC") || byT("Clipboard"); if (after) after.before(r); else list.appendChild(r);
      }
    } else if (sec === "devices") {
      list.dataset.cnDone = "1";
      make(byT("Phone Link"), () => PL.open());
    }
  }
  function hookSettings() {
    const s = document.getElementById("screen"); if (!s) { setTimeout(hookSettings, 800); return; }
    const hook = (win) => { const pg = win.querySelector && win.querySelector(".w12s-page"); if (!pg || pg.__cn) return; pg.__cn = true; new MutationObserver(() => enhanceSettings(pg)).observe(pg, { childList: true }); enhanceSettings(pg); };
    new MutationObserver((recs) => recs.forEach((r) => r.addedNodes.forEach((n) => { if (n.nodeType === 1 && n.classList.contains("win")) setTimeout(() => hook(n), 0); }))).observe(s, { childList: true });
    s.querySelectorAll(".win").forEach(hook);
  }
  // Open one of our pages: reuse an open Settings window, else open Settings at it.
  function openSettingsAt(key) {
    const page = document.querySelector(".win .w12s-page");
    if (page) { const w = page.closest(".win"); w.style.display = ""; if (WM.focusWindow) WM.focusWindow(w); renderSub(page, key); return; }
    window.SettingsStartPage = key; WM.open("settings");
  }

  // ================================================================================================
  //  Start menu entries + boot
  // ================================================================================================
  window.AppRegistry = window.AppRegistry || {};
  AppRegistry.phonelink = () => PL.open();
  AppRegistry.nearbyshare = () => NS.openApp();
  AppRegistry.quickassist = () => quickAssist();
  AppRegistry.remotedesktop = () => RD.openApp();
  try {
    if (window.Catalog) {
      const add = (o) => { if (!Catalog.storeApps.find((a) => a.id === o.id)) Catalog.storeApps.push(o); (window.EXTRA_DEFAULT_APPS = window.EXTRA_DEFAULT_APPS || []).push(o.id); };
      // the old decorative "Phone Link" listing becomes the real app
      const old = Catalog.storeApps.find((a) => a.name === "Phone Link" && a.decorative);
      if (old) { (window.EXTRA_DEFAULT_APPS = window.EXTRA_DEFAULT_APPS || []).push(old.id); old.builtin = "phonelink"; delete old.decorative; old.desc = "Pair your phone with a QR code: messages with reactions, photos both ways, notifications and remote desktop. End-to-end encrypted."; if (Icon.alias) Icon.alias(old.id, "phonelink"); }
      else add({ id: "phonelink", name: "Phone Link", cat: "System", price: 0, builtin: "phonelink", desc: "Pair your phone with a QR code: photos, Phone Link messages and notifications." });
      add({ id: "nearbyshare", name: "Nearby Sharing", cat: "System", price: 0, builtin: "nearbyshare", desc: "Send files to another Windows 12 device by its 5-character code. End-to-end encrypted." });
      add({ id: "quickassist", name: "Quick Assist", cat: "System", price: 0, builtin: "quickassist", desc: "Get or give help by sharing a screen, with optional remote control." });
      add({ id: "remotedesktop", name: "Remote Desktop Connection", cat: "System", price: 0, builtin: "remotedesktop", desc: "Connect to another Windows 12 PC by its Remote Desktop code." });
    }
  } catch (e) {}

  function whenDesktop(fn) {
    let n = 0;
    (function wait() { if (document.querySelector(".taskbar") && window.State && State.data && State.data.setupCompleted) fn(); else if (n++ < 600) setTimeout(wait, 1000); })();
  }
  function boot() {
    hookExplorer(); hookSettings();
    whenDesktop(() => { try { NS.applyMode(); RD.apply(); } catch (e) { console.warn(e); } });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else setTimeout(boot, 0);

  window.Connect12 = {
    PhoneLink: PL, Nearby: NS, Share, RemoteDesktop: RD, quickAssist, openSettingsAt, renderSub,
    packNode, saveIncoming, dialog, actionToast, explorerSelection, IN_SANDBOX,
  };
})();
