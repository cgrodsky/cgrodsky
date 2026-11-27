/* Windows Sandbox for Windows 12 — a disposable Windows 12 that is wiped when it closes.

   How it works (state.js / vm12.js / accounts.js / recovery.js are not edited):
   - The sandbox is index.html?vm=9&sandbox=1 in an iframe. state.js keeps a VM's data under
     "…__vm9"; the sandbox also gets its own account id, so its state lives under a UNIQUE key
     win12_state_v1__vm9__u<random> (the accounts registry win12_accounts_v1__vm9 points at it).
     Depth 9 is outside Hyper-V's 1–3 levels, and VM12.canNest() is false inside (like real Sandbox).
   - Setup is skipped: the state is pre-made with the "WDAGUtilityAccount" user and no password, the
     boot animation is skipped with recovery.js's one-time fast boot flag, and the lock screen is
     dismissed automatically.
   - Clipboard: "Copy text into Sandbox" / "Copy text out of Sandbox" buttons (host ↔ sandbox
     clipboard history; also the real clipboard where the browser allows).
   - Files: drop files from the device onto the Sandbox window, or "Add files from this PC" (host's
     File Explorer files) — sent to the sandbox with postMessage (same-origin iframe only) and saved
     on the sandbox's Desktop.
   - Closing asks for confirmation, then EVERYTHING is wiped: every localStorage / sessionStorage key
     of the sandbox, its IndexedDB databases and its file contents in the shared "win12-files" store.
     Leftovers from a crash or reload are wiped the next time Windows 12 starts.
   Load after js/vm12.js and js/connect12.js (optional), before js/main.js.
   window.Sandbox12 = { launch, wipe, running, SLOT } */
(function () {
  "use strict";
  if (window.Sandbox12) return;
  const SLOT = 9;
  const SUFFIX = "__vm" + SLOT;
  const BASE = "win12_state_v1" + SUFFIX, ACC = "win12_accounts_v1" + SUFFIX, FAST = "win12_fastboot" + SUFFIX, LOCK = "win12_sandbox_lock";
  const KEY_RE = new RegExp(SUFFIX + "(__|$)");
  const IN_SANDBOX = (() => { try { return new URLSearchParams(location.search).get("sandbox") === "1"; } catch (_) { return false; } })();
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function el(html) { const d = document.createElement("div"); d.innerHTML = String(html).trim(); return d.firstElementChild; }
  const LS = window.localStorage;
  const log = (lvl, id, msg) => { try { if (window.EventLog) EventLog.add("Application", lvl, "Windows Sandbox", id, msg); } catch (_) {} };
  const dlg = (o) => (window.Connect12 ? Connect12.dialog(o) : Promise.resolve(confirm((o.title || "") + "\n\n" + (o.text || "")) ? o.okValue : null));

  // ================================================================ inside the sandbox
  if (IN_SANDBOX) {
    window.WIN12_SANDBOX = true;
    document.documentElement.classList.add("cn-in-sandbox");
    window.addEventListener("message", async (e) => {
      if (e.origin !== location.origin || e.source !== window.parent || !e.data || !e.data.w12sb) return;
      const m = e.data, reply = (x) => { try { window.parent.postMessage(Object.assign({ w12sbr: m.id }, x), location.origin); } catch (_) {} };
      if (m.w12sb === "file") {
        try {
          const bytes = new Uint8Array(m.bytes);
          let name;
          if (window.Connect12 && Connect12.saveIncoming) name = await Connect12.saveIncoming(["Desktop"], { name: m.name, mime: m.mime, kind: m.kind, utf8: m.utf8 }, bytes);
          else name = await saveDirect(window, m, bytes);
          if (window.WM && WM.refreshDesktopIcons) WM.refreshDesktopIcons();
          reply({ ok: true, name });
        } catch (err) { reply({ ok: false, error: String(err && err.message || err) }); }
      } else if (m.w12sb === "clip-in") {
        const t = String(m.text || "");
        if (window.PowerTools && PowerTools.record) PowerTools.record(t);
        const f = document.activeElement;
        if (m.insert && f && (f.tagName === "TEXTAREA" || (f.tagName === "INPUT" && /^(text|search|url|email|tel|number|password)?$/i.test(f.type)) || f.isContentEditable)) insertInto(f, t);
        if (window.Notify) Notify.show({ title: "Clipboard", body: "Text from the host was copied into Windows Sandbox. Paste it with Ctrl+V." });
        reply({ ok: true });
      } else if (m.w12sb === "clip-out") reply({ ok: true, text: sandboxText(window) });
    });
  }
  function insertInto(f, t) {
    if (f.isContentEditable) { try { f.ownerDocument.execCommand("insertText", false, t); } catch (_) {} return; }
    const a = f.selectionStart != null ? f.selectionStart : f.value.length, b = f.selectionEnd != null ? f.selectionEnd : a;
    try { f.setRangeText(t, a, b, "end"); } catch (_) { f.value += t; }
    f.dispatchEvent(new f.ownerDocument.defaultView.InputEvent("input", { bubbles: true, inputType: "insertText", data: t }));
  }
  // The sandbox's selected text, else its newest clipboard-history text.
  function sandboxText(w) {
    try {
      const d = w.document, f = d.activeElement;
      if (f && (f.tagName === "TEXTAREA" || f.tagName === "INPUT") && f.selectionEnd > f.selectionStart) return f.value.slice(f.selectionStart, f.selectionEnd);
      const s = String(w.getSelection ? w.getSelection() : ""); if (s.trim()) return s;
      const c = w.State && w.State.data && w.State.data.appData && w.State.data.appData.clipboard;
      const it = c && Array.isArray(c.items) && c.items.find((x) => x.type === "text"); if (it) return it.text;
    } catch (_) {}
    return "";
  }
  // Fallback writer (when the sandbox page doesn't answer postMessage): same-origin direct access.
  async function saveDirect(w, m, bytes) {
    const st = w.State.data; st.appData = st.appData || {};
    const root = w.VFS.ensure(); const desk = root.Desktop || (root.Desktop = { type: "folder", children: {} });
    const kids = desk.children || (desk.children = {});
    let name = String(m.name || "file").replace(/[\\/:*?"<>|]+/g, "_"); const mm = name.match(/^(.*?)(\.[^.]+)?$/); let i = 2; while (kids[name]) name = mm[1] + " (" + i++ + ")" + (mm[2] || "");
    if (m.utf8) kids[name] = { type: "file", kind: m.kind || "text", content: new TextDecoder().decode(bytes), size: bytes.length, ts: Date.now() };
    else { const id = await w.VFS.putBlob(new w.Blob([bytes], { type: m.mime || "application/octet-stream" })); kids[name] = { type: "file", kind: /^image\//.test(m.mime || "") ? "image" : "other", blob: id, mime: m.mime, size: bytes.length, ts: Date.now() }; }
    w.State.save(); w.dispatchEvent(new w.Event("vfs-change"));
    return name;
  }

  // ================================================================ wipe
  function idsIn(node, out) {
    if (!node || typeof node !== "object") return out;
    if (typeof node.blob === "string") out.add(node.blob);
    if (node.children) Object.values(node.children).forEach((c) => idsIn(c, out));
    return out;
  }
  function sandboxKeys() { const ks = []; try { for (let i = 0; i < LS.length; i++) { const k = LS.key(i); if (k && KEY_RE.test(k)) ks.push(k); } } catch (_) {} return ks; }
  async function wipe() {
    const keys = sandboxKeys();
    // file contents the sandbox put in the shared IndexedDB store
    const blobs = new Set();
    keys.forEach((k) => { if (!/^win12_state_v1/.test(k)) return; try { const st = JSON.parse(LS.getItem(k) || "null"); const r = st && st.appData && st.appData.files && st.appData.files.root; if (r) Object.values(r).forEach((n) => idsIn(n, blobs)); const bin = st && st.appData && st.appData.fileBin; if (Array.isArray(bin)) bin.forEach((b) => idsIn(b.node, blobs)); } catch (_) {} });
    if (blobs.size && window.indexedDB) {
      await new Promise((res) => {
        try {
          const rq = indexedDB.open("win12-files", 1);
          rq.onupgradeneeded = () => rq.result.createObjectStore("blobs");
          rq.onsuccess = () => { const d = rq.result; const t = d.transaction("blobs", "readwrite"); blobs.forEach((id) => t.objectStore("blobs").delete(id)); t.oncomplete = t.onerror = () => { d.close(); res(); }; };
          rq.onerror = () => res();
        } catch (_) { res(); }
      });
    }
    keys.forEach((k) => { try { LS.removeItem(k); } catch (_) {} });
    try { for (let i = sessionStorage.length - 1; i >= 0; i--) { const k = sessionStorage.key(i); if (k && KEY_RE.test(k)) sessionStorage.removeItem(k); } } catch (_) {}
    // IndexedDB databases that belong to the sandbox (e.g. System Restore points "win12_restore__vm9")
    const names = new Set(["win12_restore" + SUFFIX]);
    try { if (indexedDB.databases) (await indexedDB.databases()).forEach((d) => { if (d.name && KEY_RE.test(d.name)) names.add(d.name); }); } catch (_) {}
    await Promise.all([...names].map((n) => new Promise((res) => { try { const r = indexedDB.deleteDatabase(n); r.onsuccess = r.onerror = r.onblocked = () => res(); setTimeout(res, 1500); } catch (_) { res(); } })));
    return { keys: keys.length, blobs: blobs.size };
  }
  const lockAlive = () => { try { const t = +LS.getItem(LOCK) || 0; return Date.now() - t < 8000; } catch (_) { return false; } };

  // ================================================================ host app
  let cur = null;
  function hostState(id) {
    const H = window.State && State.data ? State.data : {};
    const now = Date.now();
    return {
      bootCompleted: true, installerDone: true, setupCompleted: true, setup: { restore: "fresh", categories: [] },
      region: H.region || "United States", language: H.language || "English (United States)", langCode: H.langCode || "en",
      theme: H.theme || "auto", accent: H.accent || "#0067c0", textScale: H.textScale || 100,
      productKey: null, hasProductKey: !!H.hasProductKey, account: null,
      deviceName: "SANDBOX-" + id.toString(16).toUpperCase().slice(-4),
      profile: { picture: null, username: "WDAGUtilityAccount", authType: "pin", secret: "", requireSignIn: false },
      clock: Object.assign({ mode: "automatic", format24: false, customBaseMs: null, customSetAt: null }, H.clock || {}),
      bank: { balance: 0, transactions: [] }, youtube: { premium: false, subscriptions: [], likes: [], playlists: [], uploads: [] },
      discord: { loggedIn: false, joinedServers: [], myServers: [], bots: [] }, installedApps: [], desktop: { wallpaper: "default", hiddenIcons: [] },
      amazon: { cart: [] }, redeemedKeys: [], copilot: { apiKey: "", model: "", history: [] },
      accountMeta: { type: "admin", created: now },
      appData: { sandbox: { createdAt: now }, usage: "personal" },
    };
  }
  async function launch() {
    if (IN_SANDBOX) { await dlg({ title: "Windows Sandbox", html: "<p>Windows Sandbox can't run inside Windows Sandbox.</p>" }); return null; }
    if (cur && cur.ref.body.isConnected) { cur.ref.focus(); cur.ref.win.style.display = ""; return cur; }
    if (lockAlive()) { await dlg({ title: "Windows Sandbox", html: "<p>Only one instance of Windows Sandbox can run at a time. It's already open in another window or tab.</p>" }); return null; }
    const wf = (State.data.appData = State.data.appData || {}).winFeatures || (State.data.appData.winFeatures = { net35: false, ie: false, hyperv: false, telnet: false, sandbox: false });
    if (!wf.sandbox) {
      const ok = await dlg({ title: "Turn on Windows Sandbox?", html: "<p>Windows Sandbox is an optional feature (Control Panel › Programs › Turn Windows features on or off). Turn it on now?</p>", buttons: [{ t: "Turn on", v: true, primary: true }, { t: "Cancel", v: false }] });
      if (!ok) return null;
      wf.sandbox = true; State.save();
    }
    await wipe(); // anything left from a previous run
    const id = 100000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 900000);
    const key = BASE + "__u" + id;
    try {
      LS.setItem(key, JSON.stringify(hostState(id)));
      LS.setItem(ACC, JSON.stringify({ v: 1, current: id, nextId: id + 1, users: [{ id, name: "WDAGUtilityAccount", type: "admin", picture: null, methods: [], email: null, created: Date.now(), lastSignIn: null }] }));
      sessionStorage.setItem(FAST, JSON.stringify({ at: Date.now(), to: "boot" }));
    } catch (e) { await dlg({ title: "Windows Sandbox", html: "<p>There isn't enough storage space to start Windows Sandbox. Delete some large files and try again.</p>" }); await wipe(); return null; }
    try { LS.setItem(LOCK, String(Date.now())); } catch (_) {}
    const beat = setInterval(() => { try { LS.setItem(LOCK, String(Date.now())); } catch (_) {} }, 3000);
    const src = new URL("index.html?vm=" + SLOT + "&sandbox=1", document.baseURI).href;
    let closing = false;
    const ref = WM.createWindow({ title: "Windows Sandbox", icon: Icon.mini("sandbox", "Windows Sandbox"), width: Math.min(1040, innerWidth - 20), height: Math.min(720, innerHeight - 60), appId: "sandbox",
      onClose: () => { clearInterval(beat); finish(); } });
    const body = ref.body; body.classList.add("cn-app", "cn-sb", "vm12-host");
    body.innerHTML = `<div class="cn-sb-bar" role="toolbar" aria-label="Windows Sandbox">
        <button class="cn-btn" data-a="clipin" title="Put text on the Sandbox's clipboard">Copy text into Sandbox</button>
        <button class="cn-btn" data-a="clipout" title="Get the Sandbox's selected or copied text">Copy text out of Sandbox</button>
        <button class="cn-btn" data-a="files" title="Copy files from this PC to the Sandbox's Desktop">Add files from this PC</button>
        <button class="cn-btn" data-a="device" title="Copy files from your device to the Sandbox's Desktop">Add files from device</button>
        <span class="cn-grow"></span><button class="cn-btn" data-a="full">Full screen</button></div>
      <div class="cn-sb-screen"><iframe class="cn-sb-frame" title="Windows Sandbox" src="${src}" allow="fullscreen; clipboard-read; clipboard-write; autoplay"></iframe>
        <div class="cn-sb-boot"><div class="cn-spin"></div><div>Starting Windows Sandbox…</div><small>A fresh, disposable Windows 12. Everything in it is deleted when you close it.</small></div>
        <div class="cn-sb-drop" hidden><div>Drop files to copy them to the Sandbox's Desktop</div></div></div>
      <div class="cn-sb-status">Signed in as WDAGUtilityAccount · temporary storage key <code>${esc(key)}</code> · wiped on close</div>`;
    const frame = body.querySelector("iframe"), boot = body.querySelector(".cn-sb-boot"), drop = body.querySelector(".cn-sb-drop"), status = body.querySelector(".cn-sb-status");
    const s = { ref, key, id, frame, started: Date.now() };
    cur = s;
    // auto sign-in (lock screen has no password; the boot animation is skipped by the fast-boot flag)
    const signIn = setInterval(() => {
      try {
        const d = frame.contentDocument; if (!d) return;
        const safety = d.querySelector(".safety-btn"); if (safety) safety.click();
        const bootL = d.querySelector(".boot-layer"); if (bootL) bootL.click();
        const skip = d.querySelector(".lock-skip"); if (skip) { skip.click(); return; }
        const form = d.querySelector(".lock-form"); if (form) { const b = form.querySelector(".lock-go"); if (b) b.click(); return; }
        if (d.querySelector(".taskbar")) { clearInterval(signIn); boot.hidden = true; s.ready = true; body.dataset.ready = "1"; log("Information", 1, "Windows Sandbox started (" + key + ")."); }
      } catch (_) {}
    }, 250);
    setTimeout(() => clearInterval(signIn), 60000);
    // our close button asks first (Windows: "Are you sure you want to close Windows Sandbox?")
    const closeBtn = ref.win.querySelector(".win-titlebar .ctl-close");
    if (closeBtn) closeBtn.onclick = (e) => { e.stopPropagation(); askClose(); };
    async function askClose() {
      if (closing) return;
      const ok = await dlg({ title: "Windows Sandbox", html: "<p><b>Are you sure you want to close Windows Sandbox?</b></p><p>Once Windows Sandbox is closed, all of its content will be discarded and permanently lost.</p>", buttons: [{ t: "OK", v: true, primary: true, danger: true }, { t: "Cancel", v: false }], cancel: false });
      if (ok) { closing = true; ref.close(); }
    }
    s.close = () => { closing = true; ref.close(); };
    s.askClose = askClose;
    function finish() {
      clearInterval(signIn);
      try { frame.src = "about:blank"; } catch (_) {}
      setTimeout(async () => {
        const r = await wipe();
        try { LS.removeItem(LOCK); } catch (_) {}
        log("Information", 2, "Windows Sandbox closed; its storage was deleted (" + r.keys + " keys, " + r.blobs + " files).");
        if (cur === s) cur = null;
        s.wiped = r;
      }, 120);
    }
    // ---- clipboard ----
    function ask(m, ms) {
      return new Promise((res) => {
        const mid = "m" + Math.random().toString(36).slice(2);
        const on = (e) => { if (e.source === frame.contentWindow && e.origin === location.origin && e.data && e.data.w12sbr === mid) { window.removeEventListener("message", on); res(e.data); } };
        window.addEventListener("message", on);
        try { frame.contentWindow.postMessage(Object.assign({ id: mid }, m), location.origin, m.bytes ? [m.bytes] : []); } catch (_) { res(null); }
        setTimeout(() => { window.removeEventListener("message", on); res(null); }, ms || 2500);
      });
    }
    async function clipIn() {
      let text = "";
      try { if (navigator.clipboard && navigator.clipboard.readText) text = await navigator.clipboard.readText(); } catch (_) {}
      const box = el(`<div><p>Text to put on the Sandbox's clipboard:</p><textarea class="cn-input cn-sb-ta" rows="5" style="width:100%"></textarea><label class="cn-chk"><input type="checkbox" class="cn-sb-ins" checked> Also type it into the Sandbox's selected text box</label></div>`);
      box.querySelector("textarea").value = text;
      const v = await dlg({ title: "Copy text into Sandbox", body: box, buttons: [{ t: "Copy into Sandbox", v: (m) => ({ text: m.querySelector("textarea").value, insert: m.querySelector(".cn-sb-ins").checked }), primary: true }, { t: "Cancel", v: null }] });
      if (!v || !v.text) return;
      const r = await ask({ w12sb: "clip-in", text: v.text, insert: v.insert });
      if (!r) { try { const w = frame.contentWindow; if (w.PowerTools) w.PowerTools.record(v.text); } catch (_) {} }
      try { if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(v.text); } catch (_) {}
      status.textContent = "Copied " + v.text.length + " characters into Windows Sandbox.";
    }
    async function clipOut() {
      const r = await ask({ w12sb: "clip-out" });
      const text = (r && r.text) || sandboxText(frame.contentWindow);
      if (!text) { await dlg({ title: "Copy text out of Sandbox", html: "<p>Nothing to copy. Select or copy some text inside Windows Sandbox first.</p>" }); return; }
      const box = el(`<div><p>Text from Windows Sandbox:</p><textarea class="cn-input" rows="5" readonly style="width:100%"></textarea></div>`); box.querySelector("textarea").value = text;
      const ok = await dlg({ title: "Copy text out of Sandbox", body: box, buttons: [{ t: "Copy to this PC", v: true, primary: true }, { t: "Cancel", v: false }] });
      if (!ok) return;
      if (window.PowerTools && PowerTools.record) PowerTools.record(text);
      try { if (window.PowerTools && PowerTools.writeReal) PowerTools.writeReal(text); else if (navigator.clipboard) await navigator.clipboard.writeText(text); } catch (_) {}
      status.textContent = "Copied " + text.length + " characters from Windows Sandbox to this PC's clipboard.";
      s.lastOut = text;
    }
    // ---- files ----
    async function sendFile(name, mime, bytes, extra) {
      const buf = bytes.buffer.byteLength === bytes.length && bytes.byteOffset === 0 ? bytes.buffer : bytes.slice().buffer;
      const copy = buf.slice(0); // keep a copy for the direct fallback (the first one is transferred)
      const r = await ask(Object.assign({ w12sb: "file", name, mime, bytes: buf }, extra || {}), 4000);
      if (r && r.ok) return r.name;
      return saveDirect(frame.contentWindow, Object.assign({ name, mime }, extra || {}), new Uint8Array(copy));
    }
    async function sendFiles(files) {
      if (!s.ready) { status.textContent = "Wait for Windows Sandbox to finish starting, then try again."; return; }
      const names = [];
      for (const f of files) { try { names.push(await sendFile(f.name, f.type || "application/octet-stream", new Uint8Array(await f.arrayBuffer()))); } catch (e) { status.textContent = "Couldn't copy " + f.name + ": " + (e.message || e); } }
      if (names.length) { status.textContent = "Copied " + names.join(", ") + " to the Sandbox's Desktop."; try { const w = frame.contentWindow; if (w.WM && w.WM.refreshDesktopIcons) w.WM.refreshDesktopIcons(); } catch (_) {} }
      return names;
    }
    s.sendFiles = sendFiles;
    s.sendNode = async (name, node) => {
      if (window.Connect12 && Connect12.packNode) { const p = await Connect12.packNode(name, node); return sendFile(name, p.meta.mime, p.bytes, { kind: p.meta.kind, utf8: !!p.meta.utf8 }); }
      return null;
    };
    body.querySelector(".cn-sb-bar").addEventListener("click", (e) => {
      const a = e.target.closest("[data-a]") && e.target.closest("[data-a]").dataset.a; if (!a) return;
      if (a === "clipin") clipIn(); else if (a === "clipout") clipOut();
      else if (a === "full") { try { const r = (frame.requestFullscreen || frame.webkitRequestFullscreen || function () {}).call(frame); if (r && r.catch) r.catch(() => {}); } catch (_) {} }
      else if (a === "device") { const i = document.createElement("input"); i.type = "file"; i.multiple = true; i.onchange = () => sendFiles([...i.files]); i.click(); }
      else if (a === "files") VFS.pickFile({ title: "Copy a file into Windows Sandbox" }, async (r) => { if (!r || !r.node) return; if (!s.ready) { status.textContent = "Wait for Windows Sandbox to finish starting."; return; } try { const n = await s.sendNode(r.name, r.node); status.textContent = "Copied " + n + " to the Sandbox's Desktop."; } catch (e) { status.textContent = "Couldn't copy: " + (e.message || e); } });
    });
    s.clipIn = clipIn; s.clipOut = clipOut;
    // drag & drop from the device (Finder, Files app in Split View, desktop)
    const scrEl = body.querySelector(".cn-sb-screen");
    let dragN = 0;
    const hasFiles = (e) => e.dataTransfer && [...(e.dataTransfer.types || [])].includes("Files");
    body.addEventListener("dragenter", (e) => { if (!hasFiles(e)) return; e.preventDefault(); dragN++; drop.hidden = false; });
    body.addEventListener("dragover", (e) => { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = "copy"; });
    body.addEventListener("dragleave", (e) => { if (!hasFiles(e)) return; if (--dragN <= 0) { dragN = 0; drop.hidden = true; } });
    body.addEventListener("drop", (e) => { if (!hasFiles(e)) return; e.preventDefault(); dragN = 0; drop.hidden = true; sendFiles([...e.dataTransfer.files]); });
    scrEl.addEventListener("pointerdown", () => { drop.hidden = true; });
    log("Information", 0, "Starting Windows Sandbox.");
    return s;
  }

  // Leftovers from a closed tab / crash: wipe them when the host starts (never inside a sandbox).
  if (!IN_SANDBOX) setTimeout(() => { if (sandboxKeys().length && !lockAlive()) wipe(); }, 4000);

  window.AppRegistry = window.AppRegistry || {};
  AppRegistry.sandbox = () => { launch(); };
  try {
    if (window.Catalog && !IN_SANDBOX && !Catalog.storeApps.find((a) => a.id === "sandbox")) {
      Catalog.storeApps.push({ id: "sandbox", name: "Windows Sandbox", cat: "System", price: 0, builtin: "sandbox", desc: "A disposable Windows 12 that is deleted when you close it. Try things safely." });
      (window.EXTRA_DEFAULT_APPS = window.EXTRA_DEFAULT_APPS || []).push("sandbox");
    }
  } catch (e) {}

  window.Sandbox12 = { launch, wipe, running: () => cur, SLOT, IN_SANDBOX, keys: sandboxKeys };
})();
