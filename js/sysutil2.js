/* System utilities, wave 5 — Windows 11 style and working on this desktop's real data:
     1. Storage Sense (Settings ▸ System ▸ Storage): scheduled clean-up of temp files, old Recycle Bin
        items and old Downloads, a real "freed" report, and storage usage by category.
     2. Task Scheduler (taskschd.msc): library tree, Basic Task wizard, Create Task (General / Triggers /
        Actions / Conditions / Settings), triggers that really fire while the desktop is open (time, daily,
        weekly, log on, startup, idle, an Event Log event), missed-run catch-up, history, export XML.
     3. BitLocker Drive Encryption (Control Panel, `manage-bde`): PBKDF2 -> AES-256-GCM (Web Crypto) over
        the C: drive's file contents and IndexedDB file blobs, password + 48-digit recovery key, lock /
        unlock, suspend / resume, turn off. Self-describing ciphertext + batched conversion so a reload
        mid-way resumes; plaintext is never thrown away before its ciphertext round-trips.
     4. Power plans (Control Panel ▸ Power Options, Settings ▸ Power mode / Energy saver) feeding
        IdleLock's screen / sleep timeouts; Power saver really turns off animations + transparency and
        slows Recall; battery saver auto-on via navigator.getBattery(). Hibernate saves the open windows
        (and Notepad text) and restores them after the next sign-in.
     5. Fonts (Settings ▸ Personalization ▸ Fonts): web + detected system fonts, preview, install from
        .ttf/.otf/.woff/.woff2 (device or This PC) with the FontFace API, kept in IndexedDB. window.FontsRegistry.
     6. Search indexing (Settings ▸ Privacy & security ▸ Searching Windows, Control Panel ▸ Indexing
        Options): an inverted index of file names + text (Office documents too) in IndexedDB, updated
        on vfs-change / State.onSave; Start search shows Best match / Files from it. window.SearchIndex.
   Styles: css/sysutil2.css (.su-*). Settings rows are injected at runtime (settings12.js isn't edited);
   the Start ▸ Power menu gets Hibernate the same way (wm.js isn't edited). */
(function () {
  "use strict";
  if (window.SysUtil2) return;

  // =====================================================================
  //  shared helpers
  // =====================================================================
  const SCRIPT_V = (() => { try { const s = document.currentScript && document.currentScript.src; const m = s && s.match(/[?&]v=([^&#]+)/); return m ? m[1] : ""; } catch (e) { return ""; } })();
  const VQ = SCRIPT_V ? "?v=" + SCRIPT_V : "";
  const S = () => State.data;
  const AD = () => { const d = S(); if (!d.appData) d.appData = {}; return d.appData; };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function el(html) { const d = document.createElement("div"); d.innerHTML = String(html).trim(); return d.firstElementChild; }
  const save = () => { try { State.save(); } catch (_) {} };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const now = () => Date.now();
  const MIN = 60000, HOUR = 3600000, DAY = 86400000;
  function log(logName, level, source, id, msg, opts) { try { if (window.EventLog) EventLog.add(logName, level, source, id, msg, opts); } catch (_) {} }
  function note(title, body, iconKey, onClick) { try { if (window.Notify) Notify.show({ icon: window.Icon ? Icon.mini(iconKey || "settings", title) : "", title: esc(title), body: esc(body), onClick }); } catch (_) {} }
  function fmtBytes(b) {
    if (window.SysTools && SysTools.fmtBytes) return SysTools.fmtBytes(b);
    if (b == null || isNaN(b)) return "—"; if (b < 1024) return Math.round(b) + " bytes";
    const u = ["KB", "MB", "GB", "TB"]; let i = -1; do { b /= 1024; i++; } while (b >= 1024 && i < u.length - 1);
    return (b >= 100 ? Math.round(b) : b >= 10 ? b.toFixed(1) : b.toFixed(2)) + " " + u[i];
  }
  const fmtWhen = (ts) => { if (!ts) return "Never"; try { return new Date(ts).toLocaleString(undefined, { year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit" }); } catch (_) { return new Date(ts).toString(); } };
  const userName = () => { try { return (S().profile && S().profile.username) || "User"; } catch (_) { return "User"; } };
  const desktopUp = () => !!document.querySelector(".desktop") && !document.querySelector(".lock-screen, .boot-layer, .wsetup-screen, .bsod, .rc-winre, .su-hib-screen, .su-bl-boot");
  const screenEl = () => document.getElementById("screen") || document.body;
  const isDark = () => document.body.classList.contains("dark");
  const uid = (p) => (p || "") + now().toString(36) + Math.random().toString(36).slice(2, 8);
  function ensureCSS() {
    if (document.getElementById("su-css") || document.querySelector('link[href*="sysutil2.css"]')) return;
    const l = document.createElement("link"); l.id = "su-css"; l.rel = "stylesheet"; l.href = "css/sysutil2.css" + VQ; document.head.appendChild(l);
  }
  ensureCSS();
  function download(blob, name) {
    const u = URL.createObjectURL(blob), a = document.createElement("a"); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 30000);
  }
  // Inline icons (stroke = currentColor), 24 viewBox.
  const P = {
    broom: '<path d="M14 3l-5 9M6 12h8l2 9H4z"/><path d="M7 16v5M10 16v5M13 16v5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    unlock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/>',
    key: '<circle cx="8" cy="14" r="4"/><path d="M11 11l8-8M16 6l2 2M14 8l2 2"/>',
    power: '<path d="M12 4v8"/><path d="M6.3 7.3a8 8 0 1 0 11.4 0"/>',
    leaf: '<path d="M5 19c0-9 5-14 15-14 0 10-5 15-14 15"/><path d="M5 19l8-8"/>',
    font: '<path d="M4 19l6-14h1l6 14M6.5 14h8"/><path d="M17 19h4"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    gauge: '<path d="M4 16a8 8 0 1 1 16 0"/><path d="M12 16l4-5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    play: '<path d="M7 4l13 8-13 8z"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="1"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
    export: '<path d="M12 3v12M7 8l5-5 5 5M5 21h14"/>',
    import: '<path d="M12 15V3M7 10l5 5 5-5M5 21h14"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    check: '<path d="M5 12l5 5 9-10"/>',
    warn: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4 6.6 6.6 0 0 0 20 14.5z"/>',
    snow: '<path d="M12 2v20M3.5 7l17 10M3.5 17l17-10"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v4h16v-4"/>',
    disk: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 14h6M17 14h.01"/>',
    task: '<rect x="4" y="4" width="16" height="17" rx="2"/><path d="M8 2v4M16 2v4M4 10h16M8 14l2 2 4-4"/>',
  };
  const ic = (k, s) => `<svg class="su-i" viewBox="0 0 24 24" width="${s || 18}" height="${s || 18}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[k] || P.info}</svg>`;
  // Settings rows use the shared gradient (#w12s-g) like the built-in icons.
  const sic = (k) => `<svg class="w12s-svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="url(#w12s-g)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${P[k] || P.info}</svg>`;

  // ---- small IndexedDB key-value + stores (own database; VFS blobs stay in "win12-files") ----
  let dbP = null;
  function db() {
    if (dbP) return dbP;
    dbP = new Promise((res, rej) => {
      try {
        const r = indexedDB.open("win12-sysutil2", 1);
        r.onupgradeneeded = () => { const d = r.result; ["kv", "fonts", "index"].forEach((n) => { if (!d.objectStoreNames.contains(n)) d.createObjectStore(n); }); };
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
      } catch (e) { rej(e); }
    });
    dbP.catch(() => { dbP = null; });
    return dbP;
  }
  function idbReq(store, mode, fn) {
    return db().then((d) => new Promise((res, rej) => {
      const t = d.transaction(store, mode), st = t.objectStore(store); let out;
      const r = fn(st); if (r) r.onsuccess = () => { out = r.result; };
      t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error("aborted"));
    }));
  }
  const idbGet = (store, k) => idbReq(store, "readonly", (s) => s.get(k));
  const idbPut = (store, k, v) => idbReq(store, "readwrite", (s) => { s.put(v, k); });
  const idbDel = (store, k) => idbReq(store, "readwrite", (s) => { s.delete(k); });
  const idbAll = (store) => db().then((d) => new Promise((res, rej) => {
    const out = []; const t = d.transaction(store, "readonly"); const c = t.objectStore(store).openCursor();
    c.onsuccess = () => { const cur = c.result; if (cur) { out.push({ key: cur.key, value: cur.value }); cur.continue(); } };
    t.oncomplete = () => res(out); t.onerror = () => rej(t.error);
  }));
  // The VFS blob store, opened directly so BitLocker can rewrite a blob under the same id.
  let fdbP = null;
  function filesDb() {
    if (fdbP) return fdbP;
    fdbP = new Promise((res, rej) => { try { const r = indexedDB.open("win12-files", 1); r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains("blobs")) r.result.createObjectStore("blobs"); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } });
    fdbP.catch(() => { fdbP = null; });
    return fdbP;
  }
  const rawBlobGet = (id) => filesDb().then((d) => new Promise((res, rej) => { const q = d.transaction("blobs").objectStore("blobs").get(id); q.onsuccess = () => res(q.result || null); q.onerror = () => rej(q.error); }));
  const rawBlobPut = (id, b) => filesDb().then((d) => new Promise((res, rej) => { const t = d.transaction("blobs", "readwrite"); t.objectStore("blobs").put(b, id); t.oncomplete = () => res(id); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error("aborted")); }));
  const rawBlobDel = (id) => filesDb().then((d) => new Promise((res, rej) => { const t = d.transaction("blobs", "readwrite"); t.objectStore("blobs").delete(id); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }));
  const rawBlobKeys = () => filesDb().then((d) => new Promise((res, rej) => { const q = d.transaction("blobs").objectStore("blobs").getAllKeys(); q.onsuccess = () => res(q.result || []); q.onerror = () => rej(q.error); }));

  // ---- the file tree ----
  const SYS = "Local Disk (C:)";
  // Read-only view of the tree: never seeds it (File Explorer creates the first tree with its own defaults).
  function root() { try { const a = S().appData; if (a && a.files && a.files.root) return a.files.root; } catch (_) {} return {}; }
  // Every node, depth-first: cb(node, name, parentPathArray, parentChildren). Includes C:.
  function walk(cb, start, base) {
    const rec = (kids, p, depth) => {
      if (!kids || depth > 40) return;
      Object.keys(kids).forEach((name) => { const n = kids[name]; if (!n || typeof n !== "object") return; if (cb(n, name, p, kids) === false) return; if (n.type === "folder" && n.children) rec(n.children, p.concat(name), depth + 1); });
    };
    rec(start || root(), base || [], 0);
  }
  function nodeAt(path) { let n = { type: "folder", children: root() }; for (const seg of path || []) { n = n && n.children && n.children[seg]; if (!n) return null; } return n; }
  function winPath(path) {
    if (window.FilesHelper && FilesHelper.winPath) { try { return FilesHelper.winPath(path); } catch (_) {} }
    if (!path || !path.length) return "This PC";
    if (path[0] === SYS) return "C:\\" + path.slice(1).join("\\");
    return "C:\\Users\\" + userName() + "\\" + path.join("\\");
  }
  const extOf = (name) => (String(name).match(/\.([a-z0-9]+)$/i) || [, ""])[1].toLowerCase();
  function nodeBytes(n) {
    if (!n || n.type !== "file") return 0;
    if (typeof n.size === "number" && n.size >= 0 && (n.blob || n.bl || !n.content)) return n.size;
    let b = 0; if (typeof n.content === "string") b += n.content.length; if (typeof n.src === "string" && !n.blob) b += n.src.length;
    return b || (typeof n.size === "number" ? n.size : 0);
  }
  function changed() { save(); try { window.dispatchEvent(new Event("vfs-change")); } catch (_) {} }

  // ---- dialogs (Windows 11 ContentDialog look; Accounts.modal when present) ----
  function dialog(opts) {
    if (window.Accounts && Accounts.modal) return Accounts.modal(Object.assign({ host: screenEl() }, opts));
    return Promise.resolve(window.confirm((opts.title || "") + "\n\n" + String(opts.html || "").replace(/<[^>]+>/g, "")) ? ((opts.buttons || [])[0] || { value: true }).value : null);
  }
  const alertBox = (title, html) => dialog({ title, html, buttons: [{ label: "OK", primary: true, value: true }] });
  const confirmBox = (title, html, yes) => dialog({ title, html, buttons: [{ label: yes || "Yes", primary: true, value: true }, { label: "Cancel", value: false }] }).then((v) => v === true);
  function elevate(what) {
    try { if (window.Accounts && Accounts.elevate) return Accounts.elevate(what); } catch (_) {}
    if (window.SysTools && SysTools.elevate) return new Promise((res) => SysTools.elevate({ name: what, publisher: "Microsoft Windows" }, () => res(true), () => res(false)));
    return Promise.resolve(true);
  }
  // A multi-step wizard sheet (BitLocker, Basic Task). steps: render(api) functions; api.next / back / close.
  function wizard(opts) {
    return new Promise((resolve) => {
      const dim = el(`<div class="su-wiz-dim" role="presentation"><div class="su-wiz" role="dialog" aria-modal="true" aria-label="${esc(opts.title)}">
        <div class="su-wiz-head"><span class="su-wiz-ic">${opts.icon || ""}</span><span class="su-wiz-title">${esc(opts.title)}</span><button type="button" class="su-wiz-x" aria-label="Close">✕</button></div>
        <div class="su-wiz-wrap">${opts.side ? `<div class="su-wiz-side"></div>` : ""}<div class="su-wiz-body"></div></div>
        <div class="su-wiz-foot"><span class="su-wiz-err" role="alert"></span><span class="su-grow"></span><button type="button" class="su-btn su-wiz-back">&lt; Back</button><button type="button" class="su-btn su-btn-pri su-wiz-next">Next &gt;</button><button type="button" class="su-btn su-wiz-cancel">Cancel</button></div></div></div>`);
      const body = dim.querySelector(".su-wiz-body"), side = dim.querySelector(".su-wiz-side"), err = dim.querySelector(".su-wiz-err");
      const nextB = dim.querySelector(".su-wiz-next"), backB = dim.querySelector(".su-wiz-back"), cancelB = dim.querySelector(".su-wiz-cancel");
      let i = 0, done = false; const data = opts.data || {};
      const close = (v) => { if (done) return; done = true; dim.remove(); document.removeEventListener("keydown", onKey, true); resolve(v); };
      const api = {
        data, body, root: dim,
        error(t) { err.textContent = t || ""; },
        busy(on) { [nextB, backB, cancelB].forEach((b) => (b.disabled = !!on)); },
        setNext(label, enabled) { nextB.textContent = label; if (enabled !== undefined) nextB.disabled = !enabled; },
        go(n) { i = Math.max(0, Math.min(opts.steps.length - 1, n)); paint(); },
        close,
      };
      function paint() {
        err.textContent = ""; body.innerHTML = ""; body.scrollTop = 0; body.oninput = body.onchange = null;
        const st = opts.steps[i];
        if (side) side.innerHTML = opts.steps.map((s, k) => `<div class="su-wiz-step ${k === i ? "on" : ""} ${k < i ? "done" : ""}">${esc(s.name || "")}</div>`).join("");
        backB.hidden = i === 0 || st.noBack; cancelB.hidden = !!st.noCancel;
        nextB.disabled = false; nextB.textContent = st.next || (i === opts.steps.length - 1 ? "Finish" : "Next >");
        st.render(api);
        setTimeout(() => { const f = body.querySelector("input:not([type=checkbox]):not([type=radio]):not([readonly]),select,textarea"); if (f && !("ontouchstart" in window)) try { f.focus(); } catch (_) {} }, 40);
      }
      nextB.onclick = async () => {
        const st = opts.steps[i]; err.textContent = "";
        if (st.validate) { api.busy(true); let ok; try { ok = await st.validate(api); } catch (e) { ok = false; err.textContent = e && e.message ? e.message : String(e); } api.busy(false); if (ok === false) return; if (ok === "close") return close(data); }
        if (i >= opts.steps.length - 1) close(data); else { i++; paint(); }
      };
      backB.onclick = () => { if (i > 0) { i--; paint(); } };
      cancelB.onclick = () => close(null);
      dim.querySelector(".su-wiz-x").onclick = () => { if (!cancelB.hidden) close(null); };
      const onKey = (e) => { if (e.key === "Escape" && !cancelB.hidden) { e.stopPropagation(); close(null); } };
      document.addEventListener("keydown", onKey, true);
      (opts.host || screenEl()).appendChild(dim);
      paint();
    });
  }

  // ---- Settings page injection (settings12.js isn't edited) ----
  const T = {
    storage: ["Storage", "Lagring"], power: ["Power & battery", "Energi och batteri"], personal: ["Personalization", "Anpassning"],
    privacy: ["Privacy & security", "Sekretess och säkerhet"], system: ["System"],
  };
  function toggleEl(on, fn, label) {
    const t = el(`<label class="w12s-sw"><input type="checkbox" ${on ? "checked" : ""} aria-label="${esc(label || "")}"><span></span></label>`);
    t.addEventListener("click", (e) => e.stopPropagation());
    t.querySelector("input").onchange = (e) => fn(e.target.checked);
    return t;
  }
  function selectEl(pairs, val, fn, label) {
    const s = el(`<select class="w12s-select" aria-label="${esc(label || "")}">${pairs.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(val) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`);
    s.addEventListener("click", (e) => e.stopPropagation()); s.onchange = () => fn(s.value); return s;
  }
  function srow(icon, t, s, opts) {
    opts = opts || {};
    const click = !!opts.onClick;
    const r = el(`<div class="w12s-row ${click ? "w12s-click" : "w12s-row-static"} su-row" tabindex="${click ? 0 : -1}"><span class="w12s-row-ic">${icon ? sic(icon) : ""}</span><div class="w12s-row-txt"><div class="w12s-row-t"></div><div class="w12s-row-s"></div></div><div class="w12s-row-ctl"></div>${click ? `<span class="w12s-chev"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 6l6 6-6 6"/></svg></span>` : ""}</div>`);
    r.querySelector(".w12s-row-t").textContent = t; r.querySelector(".w12s-row-s").textContent = s || "";
    if (opts.ctl) r.querySelector(".w12s-row-ctl").appendChild(opts.ctl);
    if (click) { r.onclick = opts.onClick; r.addEventListener("keydown", (e) => { if (e.key === "Enter") opts.onClick(); }); }
    return r;
  }
  const SUBS = {};
  function registerSub(key, sub) {
    const build = sub.build;   // tag the list so the page enhancers leave it alone (settings12 may render it too)
    sub.build = function (h) { try { h.dataset.suPage = key; h.classList.add("su-sub"); } catch (_) {} return build.apply(this, arguments); };
    SUBS[key] = sub;
    window.SettingsSubs = window.SettingsSubs || {};
    if (!Object.prototype.hasOwnProperty.call(window.SettingsSubs, key)) window.SettingsSubs[key] = sub;
  }
  function navTo(page, id) { const root = page.closest(".w12s"); const a = root && root.querySelector(`.w12s-nav-it[data-p="${id}"]`); if (a) a.click(); }
  function renderSub(page, key) {
    const sp = SUBS[key]; const rootEl = page.closest(".w12s"); if (!sp || !rootEl) return;
    rootEl.querySelectorAll(".w12s-nav-it").forEach((a) => a.classList.toggle("on", a.dataset.p === sp.parent));
    const parentA = rootEl.querySelector(`.w12s-nav-it[data-p="${sp.parent}"]`);
    page.innerHTML = ""; page.scrollTop = 0;
    // "System › Storage › Storage Sense": sp.via names the parent row to reopen.
    const head = el(`<h1 class="w12s-title"><a class="w12s-crumb"></a><span class="w12s-crumb-sep">›</span>${sp.via ? `<a class="w12s-crumb su-crumb2"></a><span class="w12s-crumb-sep">›</span>` : ""}<span class="su-ttl"></span></h1>`);
    const pName = parentA && (parentA.lastElementChild || parentA);
    const crumb = head.querySelector(".w12s-crumb");
    crumb.textContent = pName ? pName.textContent.trim() : "Settings"; crumb.onclick = () => navTo(page, sp.parent);
    if (sp.via) {
      const c2 = head.querySelector(".su-crumb2"); c2.textContent = sp.via;
      c2.onclick = () => { navTo(page, sp.parent); const row = [...page.querySelectorAll(".w12s-row")].find((x) => { const t = x.querySelector(".w12s-row-t"); return t && t.textContent.trim() === sp.via; }); if (row) row.click(); };
    }
    head.querySelector(".su-ttl").textContent = sp.title;
    page.appendChild(head);
    const box = el(`<div class="w12s-list su-sub" data-su-page="${key}"></div>`); page.appendChild(box);
    try { sp.build(box, () => renderSub(page, key)); } catch (e) { console.error("[SysUtil2]", e); box.appendChild(el(`<div class="w12s-empty">This page couldn't be shown.</div>`)); }
  }
  function openSettingsSub(key) {
    const page = document.querySelector(".win .w12s-page");
    if (page) { const win = page.closest(".win"); if (win) { win.style.display = ""; win.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })); } renderSub(page, key); return; }
    window.SettingsStartPage = key; if (window.WM) WM.open("settings");
  }
  const ENH = [];   // fns(page, list, { title, sub })
  function pageInfo(page) {
    const h1 = page.querySelector("h1.w12s-title"); if (!h1) return null;
    const crumb = h1.querySelector(".w12s-crumb");
    const title = (crumb ? (h1.lastChild && h1.lastChild.textContent) || "" : h1.textContent).trim();
    return { title, sub: !!crumb };
  }
  function enhance(page) {
    const list = page.querySelector(".w12s-list"); if (!list || list.dataset.suPage || list.dataset.suDone) return;
    const info = pageInfo(page); if (!info) return;
    list.dataset.suDone = "1";
    ENH.forEach((fn) => { try { fn(page, list, info); } catch (e) { console.error("[SysUtil2] settings", e); } });
  }
  function hookSettingsWin(win) {
    const page = win.querySelector && win.querySelector(".w12s-page");
    if (!page || page.__su) return;
    page.__su = true;
    new MutationObserver(() => enhance(page)).observe(page, { childList: true });
    enhance(page);
  }
  const winHooks = [];   // fns(winElement) for every new window
  function watchWindows() {
    const scr = screenEl();
    scr.querySelectorAll(".win").forEach((w) => { hookSettingsWin(w); winHooks.forEach((f) => { try { f(w); } catch (_) {} }); });
    new MutationObserver((muts) => muts.forEach((m) => m.addedNodes.forEach((n) => {
      if (n.nodeType !== 1) return;
      if (n.classList.contains("win")) { setTimeout(() => { hookSettingsWin(n); winHooks.forEach((f) => { try { f(n); } catch (e) { console.error(e); } }); }, 0); }
      if (n.classList.contains("start-menu")) hookStart(n);
    }))).observe(scr, { childList: true });
    const sm = scr.querySelector(".start-menu"); if (sm) hookStart(sm);
  }
  const startHooks = [];
  function hookStart(sm) { if (sm.__su) return; sm.__su = true; startHooks.forEach((f) => { try { f(sm); } catch (e) { console.error(e); } }); }
  const appIdOf = (win) => { try { const e = window.WM && WM.entryFor && WM.entryFor(win); return e ? e.appId : null; } catch (_) { return null; } };

  // =====================================================================
  //  3. BITLOCKER DRIVE ENCRYPTION (real AES-256-GCM over file contents)
  // =====================================================================
  // Design (never lose data):
  //  * A random 256-bit data key (DEK) encrypts content. It is stored only wrapped (AES-GCM) by keys
  //    derived with PBKDF2-SHA256 from the password and from the 48-digit recovery key. The wrapped
  //    keys live in their own localStorage entry (+ an IndexedDB copy + a mirror in the state) so a
  //    System Restore can never orphan encrypted files.
  //  * Encrypted data is self-describing: a file node holds `bl: { k: keyId, v: base64(iv|ciphertext) }`
  //    instead of `content`/`src`; an encrypted IndexedDB blob starts with a 16-byte magic header.
  //    So a conversion interrupted by a reload simply carries on: each item is either done or not.
  //  * Every ciphertext is decrypted and compared with the plaintext BEFORE the plaintext is dropped.
  //  * While unlocked the plaintext stays in memory (apps keep working) and State.save is wrapped so
  //    what reaches localStorage is the ciphertext. Edits are re-encrypted right after the save.
  const BitLocker = (function () {
    const te = new TextEncoder(), td = new TextDecoder();
    const ITER = 210000;
    const MAGIC = te.encode("W12BITLOCKERBLB1");   // 16 bytes
    const PH = "[This file is encrypted by BitLocker Drive Encryption. Unlock drive C: to open it.]";
    const metaKey = () => "win12_bitlocker_v1::" + ((window.State && State.STORAGE_KEY) || "win12_state_v1");
    const clearKeyId = () => "blclear::" + metaKey();
    const DEKS = {};                 // keyId -> CryptoKey (only while unlocked)
    const cache = new WeakMap();     // node -> { c, s, hasC, hasS, bl } : plaintext snapshot + its ciphertext
    const encBlobs = new Set();      // blob ids known to be encrypted this session
    const listeners = new Set();
    let prog = null;                 // { op: "encrypt"|"decrypt", done, total }
    let throttle = 0;                // test hook: ms pause between batches
    const BATCH = 8;
    const emit = () => listeners.forEach((f) => { try { f(); } catch (_) {} });

    // ---- bytes ----
    const b64 = (u) => { let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
    const unb64 = (s) => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
    const eq = (a, b) => { if (!a || !b || a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i]; return d === 0; };
    async function kekFrom(secret, salt, iter) {
      const km = await crypto.subtle.importKey("raw", te.encode(secret), "PBKDF2", false, ["deriveKey"]);
      return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: iter, hash: "SHA-256" }, km, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    }
    async function seal(key, u8, aad) { const iv = crypto.getRandomValues(new Uint8Array(12)); const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad }, key, u8)); const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12); return out; }
    async function unseal(key, u8, aad) { return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: u8.subarray(0, 12), additionalData: aad }, key, u8.subarray(12))); }
    const importDEK = (raw) => crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);

    // ---- recovery key: 8 groups of 6 digits, each a multiple of 11 (like BitLocker's numerical password) ----
    function newRecoveryKey() { const r = crypto.getRandomValues(new Uint16Array(8)); return Array.from(r, (v) => String(v * 11).padStart(6, "0")).join("-"); }
    function normRecovery(s) {
      const d = String(s || "").replace(/[^0-9]/g, "");
      if (d.length !== 48) return null;
      const g = d.match(/.{6}/g);
      if (!g.every((x) => +x % 11 === 0 && +x / 11 < 65536)) return null;
      return g.join("-");
    }
    const newId = () => { const h = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase(); return h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20); };

    // ---- metadata (wrapped keys) ----
    function readMeta() {
      try { const r = localStorage.getItem(metaKey()); if (r) return JSON.parse(r); } catch (_) {}
      try { const m = AD().bitlockerMeta; if (m && m.v) { localStorage.setItem(metaKey(), JSON.stringify(m)); return JSON.parse(JSON.stringify(m)); } } catch (_) {}
      return null;
    }
    let M = readMeta();
    // The IndexedDB copy may hold newer metadata if localStorage was wiped.
    idbGet("kv", "bl:" + metaKey()).then((m) => { if (m && m.v && (!M || (m.rev || 0) > (M.rev || 0))) { M = m; try { localStorage.setItem(metaKey(), JSON.stringify(m)); } catch (_) {} markLocked(); emit(); } }).catch(() => {});
    function writeMeta(m) {
      m.rev = (m.rev || 0) + 1; M = m;
      try { localStorage.setItem(metaKey(), JSON.stringify(m)); } catch (e) { console.warn("[BitLocker] meta", e); }
      try { AD().bitlockerMeta = JSON.parse(JSON.stringify(m)); } catch (_) {}
      idbPut("kv", "bl:" + metaKey(), JSON.parse(JSON.stringify(m))).catch(() => {});
      emit();
    }
    const meta = () => M;
    const status = () => (M && M.status) || "off";
    const isOn = () => status() !== "off";
    const unlocked = () => !!(M && M.keyId && DEKS[M.keyId]);
    const lockedNow = () => isOn() && !unlocked();
    const keyFor = (k) => DEKS[k] || null;
    const isLockedNode = (n) => !!(n && n.bl && !DEKS[n.bl.k]);

    // ---- which nodes: every file on the PC (user folders live in C:\Users\<you>) + the Recycle Bin ----
    function eachFile(cb) {
      walk((n, name, p, kids) => { if (n.type === "file" && !n._ze && !n._loading) cb(n, name, p, kids); });
      const bin = Array.isArray(AD().fileBin) ? AD().fileBin : [];
      bin.forEach((b) => {
        if (!b || !b.node) return;
        if (b.node.type === "file") cb(b.node, b.name, ["$Recycle.Bin"], null);
        else if (b.node.type === "folder") walk((n, name, p, kids) => { if (n.type === "file") cb(n, name, p, kids); }, b.node.children, ["$Recycle.Bin", b.name]);
      });
    }
    const goodSrc = (s) => typeof s === "string" && !/^blob:/.test(s);
    const hasPayload = (n) => n.content !== undefined && n.content !== null || goodSrc(n.src);
    const isPH = (n) => (n.content === undefined || n.content === PH || n.content === "<p>" + PH + "</p>") && !goodSrc(n.src);
    function setPH(n) { delete n.content; delete n.src; if (n.kind === "text") n.content = PH; else if (n.kind === "word") n.content = "<p>" + PH + "</p>"; }
    function sameAsCache(n, c) {
      if (("content" in n) !== c.hasC) return false;
      if (c.hasC && n.content !== c.c && (typeof n.content !== "object" || JSON.stringify(n.content) !== c.cj)) return false;
      if (goodSrc(n.src) !== c.hasS) return false;
      if (c.hasS && n.src !== c.s) return false;
      return true;
    }
    function remember(n, payload, bl) { cache.set(n, { c: payload.c, cj: typeof payload.c === "object" ? JSON.stringify(payload.c) : null, hasC: "c" in payload, s: payload.s, hasS: "s" in payload, bl }); }

    async function encPayload(n, keyId, key) {
      const payload = {}; if (n.content !== undefined && n.content !== null) payload.c = n.content; if (goodSrc(n.src)) payload.s = n.src;
      const pt = te.encode(JSON.stringify(payload)), aad = te.encode(keyId);
      const ct = await seal(key, pt, aad);
      const back = await unseal(key, ct, aad);
      if (!eq(back, pt)) throw new Error("BitLocker self-check failed (ciphertext did not round-trip).");
      return { payload, bl: { k: keyId, v: b64(ct) } };
    }
    async function decPayload(bl) {
      const key = keyFor(bl.k); if (!key) throw new Error("locked");
      return JSON.parse(td.decode(await unseal(key, unb64(bl.v), te.encode(bl.k))));
    }

    // ---- blobs ----
    async function blobIsEnc(b) { if (!b || !b.size || b.size < 16 + 1 + 2 + 12 + 16) return false; try { return eq(new Uint8Array(await b.slice(0, 16).arrayBuffer()), MAGIC); } catch (_) { return false; } }
    async function encBlob(b, keyId, key) {
      const pt = new Uint8Array(await b.arrayBuffer()), kid = te.encode(keyId), typ = te.encode(b.type || "");
      const ct = await seal(key, pt, kid);
      const back = await unseal(key, ct, kid);
      if (!eq(back, pt)) throw new Error("BitLocker self-check failed for a file blob.");
      const head = new Uint8Array(16 + 1 + kid.length + 2 + typ.length);
      head.set(MAGIC); head[16] = kid.length; head.set(kid, 17); const o = 17 + kid.length; head[o] = typ.length >> 8; head[o + 1] = typ.length & 255; head.set(typ, o + 2);
      return new Blob([head, ct], { type: "application/x-bitlocker" });
    }
    async function parseEnc(b) {
      const u = new Uint8Array(await b.arrayBuffer()); const kl = u[16]; const kid = td.decode(u.subarray(17, 17 + kl)); const o = 17 + kl;
      const tl = (u[o] << 8) | u[o + 1]; return { kid, type: td.decode(u.subarray(o + 2, o + 2 + tl)), ct: u.subarray(o + 2 + tl) };
    }
    async function decBlob(b) { const p = await parseEnc(b); const key = keyFor(p.kid); if (!key) throw new Error("locked"); return new Blob([await unseal(key, p.ct, te.encode(p.kid))], { type: p.type }); }

    // ---- in-memory locked view ----
    function markLocked() {
      eachFile((n) => {
        if (!n.bl) return;
        if (keyFor(n.bl.k)) return;
        if (isPH(n)) setPH(n);
      });
    }

    // ---- State.save wrapper: ciphertext to storage, plaintext stays in memory ----
    let inSave = false, pendingResave = 0;
    function swapOut() {
      const undo = [];
      eachFile((n) => {
        const c = cache.get(n);
        if (c && !n.bl && sameAsCache(n, c)) {
          undo.push([n, "content" in n, n.content, "src" in n, n.src, false]);
          if (c.hasC) delete n.content; if (c.hasS) delete n.src; n.bl = c.bl;
        } else if (n.bl && isPH(n)) {
          undo.push([n, "content" in n, n.content, "src" in n, n.src, true]);
          delete n.content; if (!goodSrc(n.src)) delete n.src;
        }
      });
      return undo;
    }
    function swapIn(undo) {
      for (let i = 0; i < undo.length; i++) {
        const [n, hc, c, hs, s, keepBl] = undo[i];
        if (hc) n.content = c; if (hs) n.src = s; if (!keepBl) delete n.bl;
      }
    }
    function installSaveHook() {
      if (!window.State || State.save.__suBL) return;
      const inner = State.save;
      const w = function () {
        if (!M || (M.status === "off" && !(M.retired && M.retired.length))) return inner.apply(this, arguments);
        inSave = true; let undo = [];
        try { undo = swapOut(); } catch (e) { console.error("[BitLocker] swap", e); }
        try { return inner.apply(this, arguments); } finally { try { swapIn(undo); } catch (e) { console.error(e); } inSave = false; scheduleSweep(); }
      };
      w.__suBL = true; State.save = w;
      // A save that bypassed the wrapper (debounced raw saves, direct writes) is rewritten at once.
      State.onSave(() => { if (!inSave && isOn() && unlocked()) { clearTimeout(pendingResave); pendingResave = setTimeout(() => State.save(), 0); } });
      window.addEventListener("vfs-change", () => { if (isOn() && unlocked()) { clearTimeout(pendingResave); pendingResave = setTimeout(() => State.save(), 30); } });
    }

    // ---- unlock / lock ----
    async function unwrapWith(prot, secret, keyId) {
      const kek = await kekFrom(secret, unb64(prot.salt), prot.iter || ITER);
      return unseal(kek, unb64(prot.w), te.encode(keyId));
    }
    // Try a password or recovery key against the current key and any retired ones. Returns true/false.
    async function unlock(secret, how) {
      if (!M) return false;
      const sets = [{ keyId: M.keyId, protectors: M.protectors || [] }].concat(M.retired || []).filter((x) => x.keyId);
      const val = how === "recovery" ? normRecovery(secret) : String(secret || "");
      if (!val) { log("System", "Warning", "Microsoft-Windows-BitLocker-API", 24620, "The recovery key entered for volume C: isn't in the right format."); return false; }
      let ok = false;
      for (const set of sets) {
        if (DEKS[set.keyId]) { if (set.keyId === M.keyId || !M.keyId) ok = true; continue; }
        for (const p of set.protectors) {
          if ((how === "recovery") !== (p.type === "recovery")) continue;
          try { const raw = await unwrapWith(p, val, set.keyId); DEKS[set.keyId] = await importDEK(raw); raw.fill(0); if (set.keyId === M.keyId || !M.keyId) ok = true; break; } catch (_) {}
        }
      }
      if (!ok) { log("Security", "Audit Failure", "Microsoft-Windows-BitLocker-API", 24620, "BitLocker couldn't unlock volume C:. The " + (how === "recovery" ? "recovery key" : "password") + " is incorrect."); return false; }
      log("System", "Information", "Microsoft-Windows-BitLocker-API", 782, "BitLocker unlocked volume C: using a " + (how === "recovery" ? "recovery password (numerical password)" : "password") + " protector.");
      await afterUnlock();
      return true;
    }
    async function afterUnlock() {
      await decryptInMemory();
      emit(); changed();
      scheduleSweep(10);
    }
    // Decrypt every locked node we have a key for (also handles edits made while it was locked).
    async function decryptInMemory() {
      const todo = []; eachFile((n, name, p, kids) => { if (n.bl && keyFor(n.bl.k)) todo.push({ n, name, kids }); });
      let i = 0;
      for (const t of todo) {
        const n = t.n, bl = n.bl;
        let payload; try { payload = await decPayload(bl); } catch (e) { console.warn("[BitLocker] can't decrypt", t.name, e); continue; }
        if (n.bl !== bl) continue;
        const edited = !isPH(n);
        if (edited && t.kids) {   // keep what was typed while locked next to the original
          const copy = JSON.parse(JSON.stringify(n)); delete copy.bl;
          const m = t.name.match(/^(.*?)(\.[^.]+)?$/); let nm = m[1] + " (edited while locked)" + (m[2] || ""), k = 2;
          while (t.kids[nm]) nm = m[1] + " (edited while locked " + (k++) + ")" + (m[2] || "");
          t.kids[nm] = copy;
        }
        delete n.content; delete n.src;
        if ("c" in payload) n.content = payload.c; if ("s" in payload) n.src = payload.s;
        delete n.bl; remember(n, payload, bl);
        if (++i % 25 === 0) await sleep(0);
      }
    }
    async function lock() {
      if (!isOn() || !unlocked()) return false;
      if (status() !== "on") throw new Error("Wait for BitLocker to finish encrypting the drive first.");
      await runSweep();
      // anything still plaintext (just edited) gets encrypted first
      const key = DEKS[M.keyId];
      const plain = []; eachFile((n) => { if (!n.bl && hasPayload(n) && !(cache.get(n) && sameAsCache(n, cache.get(n)))) plain.push(n); });
      for (const n of plain) { const r = await encPayload(n, M.keyId, key); remember(n, r.payload, r.bl); }
      eachFile((n) => { const c = cache.get(n); if (c && !n.bl && sameAsCache(n, c)) { n.bl = c.bl; cache.delete(n); setPH(n); } });
      Object.keys(DEKS).forEach((k) => delete DEKS[k]);
      encBlobs.clear();
      save(); changed(); emit();
      log("System", "Information", "Microsoft-Windows-BitLocker-API", 783, "BitLocker locked volume C:.");
      return true;
    }

    // ---- conversion (encrypt / decrypt), batched and resumable ----
    let sweepT = 0, sweeping = null, again = false;
    // throttled, not debounced: a stream of saves from other apps must not hold back re-encryption
    function scheduleSweep(ms) { if (sweepT && ms == null) return; clearTimeout(sweepT); sweepT = setTimeout(() => { sweepT = 0; runSweep(); }, ms == null ? 400 : ms); }
    function runSweep() {
      if (sweeping) { again = true; return sweeping; }
      sweeping = (async () => { await null; try { do { again = false; await sweepOnce(); } while (again); } catch (e) { console.error("[BitLocker]", e); log("System", "Error", "Microsoft-Windows-BitLocker-API", 24588, "The BitLocker conversion of volume C: stopped: " + (e && e.message)); } finally { sweeping = null; prog = null; emit(); } })();
      return sweeping;
    }
    const pause = () => sleep(throttle || 0);
    function referencedBlobs() { const s = new Set(); eachFile((n) => { if (typeof n.blob === "string") s.add(n.blob); }); return [...s]; }
    async function sweepOnce() {
      if (!M || M.status === "off") return;
      if (M.status === "decrypting") return decryptPass();
      const key = DEKS[M.keyId]; if (!key) return;
      // clones of encrypted nodes (copy / paste duplicates `bl`): decrypt them in memory first
      let clones = 0; eachFile((n) => { if (n.bl && keyFor(n.bl.k)) clones++; });
      if (clones) await decryptInMemory();
      const nodes = []; eachFile((n) => { if (!n.bl && hasPayload(n)) { const c = cache.get(n); if (!(c && sameAsCache(n, c))) nodes.push(n); } });
      const blobs = referencedBlobs().filter((id) => !encBlobs.has(id));
      const total = nodes.length + blobs.length;
      if (!total) { if (M.status === "encrypting") finishEncrypt(); return; }
      let already = 0; eachFile((n) => { if (cache.get(n) && !nodes.includes(n)) already++; }); already += encBlobs.size;
      if (M.status === "encrypting") prog = { op: "encrypt", done: already, total: total + already };
      let done = already;
      for (let i = 0; i < nodes.length; i += BATCH) {
        if (!DEKS[M.keyId] || M.status === "off" || M.status === "decrypting") return;
        for (const n of nodes.slice(i, i + BATCH)) {
          const before = { c: n.content, s: n.src };
          const r = await encPayload(n, M.keyId, key);
          if (n.content === before.c && n.src === before.s && !n.bl) remember(n, r.payload, r.bl);
          done++;
        }
        save();
        if (prog) { prog.done = done; emit(); }
        await pause();
      }
      for (const id of blobs) {
        if (!DEKS[M.keyId] || M.status !== "on" && M.status !== "encrypting") return;
        const raw = await rawBlobGet(id).catch(() => null);
        if (raw && !(await blobIsEnc(raw))) {
          const eb = await encBlob(raw, M.keyId, key);
          await rawBlobPut(id, eb);
          const chk = await rawBlobGet(id);
          if (!chk || chk.size !== eb.size) { await rawBlobPut(id, raw); throw new Error("A file blob couldn't be written back; it was left unencrypted."); }
        }
        if (raw) encBlobs.add(id);
        done++;
        if (prog) { prog.done = done; emit(); }
        await pause();
      }
      if (M.status === "encrypting") finishEncrypt();
    }
    function finishEncrypt() {
      const m = Object.assign({}, M, { status: "on", completed: now() });
      writeMeta(m);
      log("System", "Information", "Microsoft-Windows-BitLocker-Driver", 24577, "Encryption of volume C: completed.");
      note("BitLocker Drive Encryption", "Encryption of drive C: is complete.", "bitlocker");
    }
    async function decryptPass() {
      if (!Object.keys(DEKS).length) return;
      const nodes = []; eachFile((n) => { if (cache.get(n) || (n.bl && keyFor(n.bl.k))) nodes.push(n); });
      const keys = await rawBlobKeys().catch(() => []);
      prog = { op: "decrypt", done: 0, total: nodes.length + keys.length }; emit();
      let done = 0;
      for (let i = 0; i < nodes.length; i += BATCH) {
        for (const n of nodes.slice(i, i + BATCH)) {
          if (n.bl && keyFor(n.bl.k)) { const bl = n.bl; const payload = await decPayload(bl); if (n.bl === bl) { delete n.content; delete n.src; if ("c" in payload) n.content = payload.c; if ("s" in payload) n.src = payload.s; delete n.bl; } }
          cache.delete(n); done++;
        }
        save(); prog.done = done; emit(); await pause();
      }
      let stuck = 0;
      for (const id of keys) {
        const raw = await rawBlobGet(id).catch(() => null);
        if (raw && (await blobIsEnc(raw))) {
          try { const pb = await decBlob(raw); await rawBlobPut(id, pb); encBlobs.delete(id); } catch (e) { stuck++; }
        }
        done++; prog.done = done; emit(); await pause();
      }
      let left = 0; eachFile((n) => { if (n.bl) left++; });
      if (left || stuck) { log("System", "Warning", "Microsoft-Windows-BitLocker-API", 24590, "Decryption of volume C: paused: " + (left + stuck) + " item(s) need a key that isn't unlocked."); return; }
      const m = Object.assign({}, M, { status: "off", suspended: false, decrypted: now() });
      m.retired = (m.retired || []).concat(m.keyId ? [{ keyId: m.keyId, protectors: m.protectors, retiredAt: now() }] : []);
      m.keyId = null; m.protectors = []; m.recoveryId = null;
      writeMeta(m);
      idbDel("kv", clearKeyId()).catch(() => {});
      save();
      log("System", "Information", "Microsoft-Windows-BitLocker-Driver", 24579, "Decryption of volume C: completed.");
      note("BitLocker Drive Encryption", "Drive C: is decrypted. BitLocker is off.", "bitlocker");
    }

    // ---- turn on / off ----
    async function makeProtector(type, secret, raw, keyId, extra) {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const kek = await kekFrom(secret, salt, ITER);
      const w = await seal(kek, raw, te.encode(keyId));
      const back = await unseal(kek, w, te.encode(keyId));
      if (!eq(back, raw)) throw new Error("Key protector self-check failed.");
      return Object.assign({ type, salt: b64(salt), iter: ITER, w: b64(w), created: now() }, extra || {});
    }
    async function turnOn(password, recovery, rid0) {
      if (isOn()) throw new Error("BitLocker is already on for drive C:.");
      if (String(password || "").length < 8) throw new Error("The password must be at least 8 characters.");
      const rk = normRecovery(recovery); if (!rk) throw new Error("The recovery key isn't valid.");
      const keyId = newId(), raw = crypto.getRandomValues(new Uint8Array(32)), rid = rid0 || newId();
      const prots = [await makeProtector("password", password, raw, keyId), await makeProtector("recovery", rk, raw, keyId, { id: rid })];
      const key = await importDEK(raw); raw.fill(0);
      // The recovery key itself, sealed with the drive key, so "Back up your recovery key" works while unlocked.
      const rkEnc = b64(await seal(key, te.encode(rk), te.encode(keyId + ":rk")));
      const old = M || {};
      writeMeta({ v: 1, rev: old.rev || 0, status: "encrypting", keyId, recoveryId: rid, rkEnc, created: now(), method: "AES-256-GCM", suspended: false, protectors: prots, retired: old.retired || [] });
      DEKS[keyId] = key;
      log("System", "Information", "Microsoft-Windows-BitLocker-API", 775, "A BitLocker key protector was created.\r\nProtector type: Password\r\nVolume: C:");
      log("System", "Information", "Microsoft-Windows-BitLocker-API", 775, "A BitLocker key protector was created.\r\nProtector type: Numerical password (recovery key)\r\nID: {" + rid + "}\r\nVolume: C:");
      log("System", "Information", "Microsoft-Windows-BitLocker-API", 768, "BitLocker encryption was started for volume C:. Method: AES-256-GCM (Web Crypto), used space only.");
      return runSweep();
    }
    async function turnOff() {
      if (!isOn()) return;
      if (!unlocked()) throw new Error("Unlock drive C: first.");
      writeMeta(Object.assign({}, M, { status: "decrypting" }));
      log("System", "Information", "Microsoft-Windows-BitLocker-API", 769, "BitLocker decryption was started for volume C:.");
      return runSweep();
    }
    async function changePassword(oldSecret, how, newPw) {
      if (!isOn() || !M.keyId) throw new Error("BitLocker is off.");
      if (String(newPw || "").length < 8) throw new Error("The password must be at least 8 characters.");
      const val = how === "recovery" ? normRecovery(oldSecret) : oldSecret;
      let raw = null;
      for (const p of M.protectors) { if ((how === "recovery") !== (p.type === "recovery")) continue; try { raw = await unwrapWith(p, val, M.keyId); break; } catch (_) {} }
      if (!raw) throw new Error("The " + (how === "recovery" ? "recovery key" : "current password") + " is incorrect.");
      const np = await makeProtector("password", newPw, raw, M.keyId); raw.fill(0);
      writeMeta(Object.assign({}, M, { protectors: M.protectors.filter((p) => p.type !== "password").concat([np]) }));
      log("System", "Information", "Microsoft-Windows-BitLocker-API", 775, "The BitLocker password protector for volume C: was changed.");
    }
    // Suspend: keep the data encrypted but store the key in the clear (a non-extractable CryptoKey in
    // IndexedDB — the browser's stand-in for the TPM) so the drive unlocks at boot without a prompt.
    async function suspend() {
      if (!unlocked()) throw new Error("Unlock drive C: first.");
      await idbPut("kv", clearKeyId(), { keyId: M.keyId, key: DEKS[M.keyId] });
      writeMeta(Object.assign({}, M, { suspended: true }));
      log("System", "Warning", "Microsoft-Windows-BitLocker-API", 778, "BitLocker protection was suspended for volume C:. The data stays encrypted; the key is stored unprotected so the drive unlocks without a password.");
    }
    async function resume() {
      await idbDel("kv", clearKeyId()).catch(() => {});
      writeMeta(Object.assign({}, M, { suspended: false }));
      log("System", "Information", "Microsoft-Windows-BitLocker-API", 779, "BitLocker protection was resumed for volume C:.");
    }
    async function autoUnlock() {
      if (!M || !M.suspended || unlocked()) return false;
      try { const r = await idbGet("kv", clearKeyId()); if (r && r.key && r.keyId === M.keyId) { DEKS[r.keyId] = r.key; log("System", "Information", "Microsoft-Windows-BitLocker-API", 782, "BitLocker unlocked volume C: automatically (protection is suspended)."); await afterUnlock(); return true; } } catch (e) { console.warn("[BitLocker] auto-unlock", e); }
      return false;
    }

    async function recoveryKey() {
      if (!unlocked() || !M.rkEnc) return null;
      try { return td.decode(await unseal(DEKS[M.keyId], unb64(M.rkEnc), te.encode(M.keyId + ":rk"))); } catch (_) { return null; }
    }
    // A real Web Crypto self-test ("Run BitLocker system check").
    async function selfTest() {
      const key = await importDEK(crypto.getRandomValues(new Uint8Array(32)));
      const pt = crypto.getRandomValues(new Uint8Array(4096)), aad = te.encode("selftest");
      const ct = await seal(key, pt, aad); const back = await unseal(key, ct, aad);
      let tamper = false; try { const bad = ct.slice(); bad[20] ^= 1; await unseal(key, bad, aad); } catch (_) { tamper = true; }
      return eq(back, pt) && tamper;
    }
    // ---- recovery key backup text ----
    function recoveryText(key, id) {
      return "BitLocker Drive Encryption recovery key\r\n\r\nTo verify that this is the correct recovery key, compare the start of the following identifier with the identifier value displayed on your PC.\r\n\r\nIdentifier:\r\n\r\n\t" + id + "\r\n\r\nIf the above identifier matches the one displayed by your PC, then use the following key to unlock your drive.\r\n\r\nRecovery Key:\r\n\r\n\t" + key + "\r\n\r\nIf the above identifier doesn't match the one displayed by your PC, then this isn't the right key to unlock your drive.\r\nTry another recovery key, or refer to https://go.microsoft.com/fwlink/?LinkID=260589 for additional assistance.\r\n";
    }

    // ---- VFS integration: blobs + guards ----
    function wrapVFS() {
      if (!window.VFS || VFS.__suBL) return;
      VFS.__suBL = true;
      const get0 = VFS.getBlob, put0 = VFS.putBlob, open0 = VFS.openNode;
      VFS.getBlob = async function (id) {
        const b = await get0.call(VFS, id);
        if (!b || !(await blobIsEnc(b))) return b;
        encBlobs.add(id);
        try { return await decBlob(b); } catch (e) { promptSoon(); return null; }
      };
      VFS.putBlob = async function (blob) {
        if (M && (M.status === "on" || M.status === "encrypting") && unlocked() && blob) {
          try { const eb = await encBlob(blob, M.keyId, DEKS[M.keyId]); const id = await put0.call(VFS, eb); encBlobs.add(id); return id; } catch (e) { console.warn("[BitLocker] putBlob", e); }
        }
        return put0.call(VFS, blob);
      };
      VFS.openNode = function (name, node) {
        if (node && node.type === "file" && isLockedNode(node)) { promptUnlock({ reason: name }).then((ok) => { if (ok) VFS.openNode(name, node); }); return; }
        if (node && node.type === "file" && typeof node.blob === "string" && !node._loading && isOn()) {
          rawBlobGet(node.blob).then(async (raw) => {
            if (!raw || !(await blobIsEnc(raw))) return open0.call(VFS, name, node);
            let pb; try { pb = await decBlob(raw); } catch (_) { const ok = await promptUnlock({ reason: name }); if (ok) VFS.openNode(name, node); return; }
            const url = URL.createObjectURL(pb); setTimeout(() => URL.revokeObjectURL(url), 120000);
            const clone = Object.assign({}, node, { src: url }); delete clone.blob;
            open0.call(VFS, name, clone);
          }).catch(() => open0.call(VFS, name, node));
          return;
        }
        return open0.apply(VFS, arguments);
      };
    }
    function guard(obj, fn, nodeOf) {
      if (!obj || typeof obj[fn] !== "function" || obj[fn].__suG) return;
      const orig = obj[fn];
      const w = function () {
        const args = arguments; let node = null; try { node = nodeOf(args); } catch (_) {}
        if (node && isLockedNode(node)) { promptUnlock({ reason: "open" }).then((ok) => { if (ok) orig.apply(obj, args); }); return; }
        return orig.apply(this, args);
      };
      w.__suG = true; obj[fn] = w;
    }
    function installGuards() {
      wrapVFS();
      if (window.Office) ["openWord", "openExcel", "openPowerPoint"].forEach((f) => guard(Office, f, (a) => a[0] && a[0].node));
      if (window.CrPhotos) guard(CrPhotos, "openNode", (a) => a[1]);
      if (window.CrMedia) guard(CrMedia, "openNode", (a) => a[1]);
    }

    // ---- unlock prompts ----
    let promptP = null, promptT = 0;
    function promptSoon() { clearTimeout(promptT); promptT = setTimeout(() => { if (lockedNow()) promptUnlock({ reason: "read" }); }, 200); }
    function promptUnlock(opts) {
      if (!lockedNow()) return Promise.resolve(true);
      if (promptP && document.querySelector(".su-bl-dlg")) return promptP;   // one prompt at a time (a removed dialog doesn't block new ones)
      opts = opts || {};
      let mode = "password";
      const html = () => mode === "password"
        ? `<div class="su-bl-dlg"><div class="su-bl-dlg-ic">${ic("lock", 34)}</div><div><p>This drive is BitLocker-protected. Enter the password to unlock drive <b>C:</b>.</p>
            <label class="rc-field"><span>Password</span><input class="rc-input su-bl-pw" type="password" autocomplete="off" data-no-eye></label>
            <button type="button" class="su-link su-bl-more">More options · Enter recovery key</button></div></div>`
        : `<div class="su-bl-dlg"><div class="su-bl-dlg-ic">${ic("key", 34)}</div><div><p>Enter the 48-digit recovery key to unlock drive <b>C:</b>.</p>
            <p class="rc-dim">Recovery key ID: <b>${esc(((M && M.recoveryId) || "").slice(0, 8))}</b> — it's in the file “BitLocker Recovery Key ${esc(((M && M.recoveryId) || "").slice(0, 8))}.txt” you saved or printed.</p>
            <label class="rc-field"><span>Recovery key</span><input class="rc-input su-bl-rk" inputmode="numeric" autocomplete="off" placeholder="000000-000000-000000-000000-000000-000000-000000-000000"></label>
            <button type="button" class="su-link su-bl-more">Use my password instead</button></div></div>`;
      promptP = dialog({
        title: "BitLocker (C:)", html: html(),
        onOpen(api) { const wire = () => { const m = api.content.querySelector(".su-bl-more"); if (m) m.onclick = () => { mode = mode === "password" ? "recovery" : "password"; api.content.innerHTML = html(); api.error(""); wire(); const f = api.content.querySelector("input"); if (f) f.focus(); }; }; wire(); },
        buttons: [{ label: "Unlock", primary: true, onClick: async (api) => {
          const inp = api.content.querySelector("input"); const v = inp ? inp.value : "";
          if (!v) { api.error(mode === "password" ? "Type the password." : "Type the recovery key."); return false; }
          api.busy(true); let ok = false; try { ok = await unlock(v, mode); } catch (e) { ok = false; } api.busy(false);
          if (!ok) { api.error(mode === "password" ? "The password is incorrect. Try again." : "That recovery key doesn't unlock this drive."); if (inp) { inp.value = ""; inp.focus(); } return false; }
          return true;
        } }, { label: "Cancel", value: false }],
      }).then((v) => { promptP = null; return v === true; });
      return promptP;
    }

    // ---- pre-boot screen (Lock.run is wrapped for the first sign-in of this page load) ----
    function preboot() {
      return new Promise((resolve) => {
        let mode = "password";
        const scr = el(`<div class="su-bl-boot" role="dialog" aria-label="BitLocker"><div class="su-bl-boot-in"></div></div>`);
        const inner = scr.querySelector(".su-bl-boot-in");
        const paint = (msg) => {
          const rid = (M && M.recoveryId) || "";
          inner.innerHTML = mode === "password"
            ? `<h1>BitLocker</h1><p>Enter the password to unlock this drive</p><input class="su-bl-boot-in-pw" type="password" autocomplete="off" aria-label="BitLocker password" data-no-eye>
               <div class="su-bl-boot-msg" role="alert">${esc(msg || "")}</div>
               <div class="su-bl-boot-keys"><button type="button" data-a="go">Press Enter to continue</button><button type="button" data-a="rec">Press Esc for BitLocker recovery</button><button type="button" data-a="show">Press the Insert key to see the password as you type</button></div>
               <button type="button" class="su-bl-boot-skip" data-a="skip">Skip this drive (simulated) — start Windows with drive C: locked</button>`
            : `<h1>BitLocker recovery</h1><p>Enter the recovery key for this drive</p><input class="su-bl-boot-in-rk" inputmode="numeric" autocomplete="off" aria-label="Recovery key" placeholder="______-______-______-______-______-______-______-______">
               <div class="su-bl-boot-msg" role="alert">${esc(msg || "")}</div>
               <p class="su-bl-boot-small">Use the number keys or function keys F1-F10 (use F10 for 0).<br>Recovery key ID (to identify your key): <b>${esc(rid.slice(0, 8))}</b><br>Here's how to find your key: the file “BitLocker Recovery Key ${esc(rid.slice(0, 8))}.txt” you saved, or the printout you made when you turned on BitLocker.</p>
               <div class="su-bl-boot-keys"><button type="button" data-a="go">Press Enter to continue</button><button type="button" data-a="pw">Press Esc to enter the password instead</button></div>
               <button type="button" class="su-bl-boot-skip" data-a="skip">Skip this drive (simulated) — start Windows with drive C: locked</button>`;
          const inp = inner.querySelector("input");
          inner.querySelectorAll("[data-a]").forEach((b) => b.onclick = () => act(b.dataset.a));
          setTimeout(() => { try { inp.focus(); } catch (_) {} }, 50);
        };
        let busy = false;
        async function act(a) {
          if (busy) return;
          const inp = inner.querySelector("input");
          if (a === "show") { if (inp) inp.type = inp.type === "password" ? "text" : "password"; return; }
          if (a === "rec") { mode = "recovery"; paint(); return; }
          if (a === "pw") { mode = "password"; paint(); return; }
          if (a === "skip") { log("System", "Warning", "Microsoft-Windows-BitLocker-API", 24620, "Startup continued with volume C: locked (the BitLocker prompt was skipped)."); finish(); return; }
          if (a === "go") {
            const v = inp ? inp.value : ""; if (!v) return;
            busy = true; inner.classList.add("busy");
            const ok = await unlock(v, mode === "password" ? "password" : "recovery").catch(() => false);
            busy = false; inner.classList.remove("busy");
            if (ok) finish(); else paint(mode === "password" ? "The password is incorrect. Try again." : "That key is incorrect. Check it and try again.");
          }
        }
        // Keys work wherever focus is while this screen is up (Enter / Esc / Insert, like the real one).
        const onKey = (e) => {
          if (!scr.isConnected) return;
          const inp = inner.querySelector("input");
          if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); act("go"); }
          else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); act(mode === "password" ? "rec" : "pw"); }
          else if (e.key === "Insert") { e.preventDefault(); e.stopPropagation(); act("show"); }
          else if (mode === "recovery" && inp && /^F([1-9]|10)$/.test(e.key)) { e.preventDefault(); inp.value += String(+e.key.slice(1) % 10); }
          else if (inp && document.activeElement !== inp && e.key.length === 1) { try { inp.focus(); } catch (_) {} }
        };
        document.addEventListener("keydown", onKey, true);
        function finish() { document.removeEventListener("keydown", onKey, true); scr.classList.add("su-out"); setTimeout(() => scr.remove(), 250); resolve(); }
        document.body.appendChild(scr);
        paint();
      });
    }
    let bootHandled = false;
    function hookBoot() {
      if (!window.Lock || Lock.run.__suBL) return;
      const orig = Lock.run;
      const w = function (cb) {
        const args = arguments, self = this;
        const atBoot = !document.querySelector(".desktop") && !bootHandled;
        if (atBoot) bootHandled = true;
        if (!atBoot || !isOn() || unlocked()) return orig.apply(self, args);
        (async () => {
          try {
            if (M && M.suspended && (await autoUnlock())) return;
            if (lockedNow()) await preboot();
          } catch (e) { console.error("[BitLocker] preboot", e); }
        })().then(() => orig.apply(self, args));
      };
      w.__suBL = true; Lock.run = w;
    }

    // ---- Explorer: prompt when it opens while locked + lock badges on encrypted items ----
    function decorateExplorer(win) {
      if (appIdOf(win) !== "fileexplorer" && appIdOf(win) !== "files") return;
      if (lockedNow()) setTimeout(() => { if (win.isConnected) promptUnlock({ reason: "explorer" }); }, 300);
      let raf = 0;
      const paint = () => {
        raf = 0; if (!win.isConnected) { mo.disconnect(); return; }
        win.querySelectorAll("[data-k]").forEach((it) => {
          const k = it.dataset.k; let on = false, drive = false;
          if (k === SYS) { drive = isOn(); on = lockedNow(); }
          else { const n = nodeAt(k.split("/")); on = !!(n && n.type === "file" && isLockedNode(n)); }
          it.classList.toggle("su-bl-item", on); it.classList.toggle("su-bl-drive", drive); it.classList.toggle("su-bl-open", drive && !on);
        });
        // This PC ▸ Devices and drives: the C: tile gets the BitLocker lock / unlocked badge
        win.querySelectorAll('.fx12-drive[data-drive="' + SYS + '"]').forEach((d) => { const on = isOn(), lk = lockedNow(); d.classList.toggle("su-bl-drive", on); d.classList.toggle("su-bl-open", on && !lk); d.title = on ? "Local Disk (C:) — BitLocker " + (lk ? "on (locked)" : "on") : ""; });
      };
      const mo = new MutationObserver(() => { if (!raf) raf = requestAnimationFrame(paint); });
      mo.observe(win, { childList: true, subtree: true });
      const off = () => { if (!win.isConnected) { listeners.delete(off); return; } if (!raf) raf = requestAnimationFrame(paint); };
      listeners.add(off);
      paint();
    }

    function init() {
      installSaveHook();
      markLocked();
      hookBoot();
      installGuards();
      if (document.readyState === "complete") installGuards(); else window.addEventListener("load", () => setTimeout(installGuards, 0));
      winHooks.push(decorateExplorer);
      // Fallback for a late load (no boot hook in time): ask once the desktop is up.
      setTimeout(async () => {
        if (!isOn() || unlocked()) return;
        if (M.suspended && (await autoUnlock())) return;
        const iv = setInterval(() => { if (!lockedNow()) { clearInterval(iv); return; } if (desktopUp() && !document.querySelector(".su-bl-boot")) { clearInterval(iv); if (!bootHandled) { bootHandled = true; promptUnlock({ reason: "boot" }); } } }, 800);
      }, 1500);
    }

    function percent() {
      if (prog && prog.total) return Math.min(100, (prog.done / prog.total) * 100);
      const s = status(); if (s === "on") return 100; if (s === "off") return 0;
      let a = 0, b = 0; eachFile((n) => { if (!hasPayload(n) && !n.bl) return; b++; if (n.bl || cache.get(n)) a++; });
      return b ? (a / b) * 100 : 100;
    }
    return {
      init, meta, status, isOn, unlocked, lockedNow, isLockedNode, unlock, lock, turnOn, turnOff, changePassword, suspend, resume,
      newRecoveryKey, newRecoveryId: newId, normRecovery, recoveryText, recoveryKey, selfTest, promptUnlock, percent, progress: () => prog, runSweep,
      on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
      set _throttle(v) { throttle = +v || 0; }, get _throttle() { return throttle; },
      _blobIsEnc: blobIsEnc, _rawBlobGet: rawBlobGet, PH,
    };
  })();

  // ---------------- BitLocker UI: Control Panel page, setup wizard, manage-bde ----------------
  const BLUI = (function () {
    const B = BitLocker;
    const stLabel = () => {
      const s = B.status(), m = B.meta();
      if (s === "off") return "BitLocker off";
      if (s === "encrypting") return "BitLocker encrypting (" + B.percent().toFixed(1) + "%)" + (B.lockedNow() ? " — locked, unlock to continue" : "");
      if (s === "decrypting") return "BitLocker decrypting (" + (100 - B.percent()).toFixed(1) + "%)" + (B.lockedNow() ? " — locked, unlock to continue" : "");
      if (B.lockedNow()) return "BitLocker on (Locked)";
      return m && m.suspended ? "BitLocker suspended" : "BitLocker on";
    };
    function saveKeyFile(key, id) { download(new Blob([B.recoveryText(key, id)], { type: "text/plain" }), "BitLocker Recovery Key " + id.slice(0, 8) + ".txt"); }
    function printKey(key, id) {
      const f = document.createElement("iframe"); f.style.cssText = "position:fixed;width:0;height:0;border:0;left:-10px;top:-10px";
      document.body.appendChild(f);
      try { const d = f.contentDocument; d.open(); d.write("<pre style='font:14px Consolas,monospace;white-space:pre-wrap'>" + esc(B.recoveryText(key, id)) + "</pre>"); d.close(); f.contentWindow.focus(); f.contentWindow.print(); } catch (_) {}
      setTimeout(() => f.remove(), 60000);
    }
    const keyBox = (key, id) => `<div class="su-bl-key"><div class="su-dim">Recovery key ID: ${esc(id)}</div><div class="su-bl-keyv">${esc(key)}</div></div>`;

    async function setup() {
      if (B.isOn()) return;
      if (!(await elevate("BitLocker Drive Encryption"))) return;
      const rk = B.newRecoveryKey(), rid = B.newRecoveryId();
      let backedUp = false;
      const data = await wizard({
        title: "BitLocker Drive Encryption (C:)", icon: ic("lock", 18), data: { rk },
        steps: [
          { name: "Unlock", render(api) {
            api.body.innerHTML = `<h2 class="su-h2">Choose how you want to unlock your drive at startup</h2>
              <p class="su-dim">To help keep your data more secure, you can have BitLocker prompt you to enter a password each time you start your PC.</p>
              <label class="su-opt"><input type="radio" name="bl-u" checked> <span><b>Enter a password</b><br><span class="su-dim">Asked before Windows starts (and when File Explorer opens while drive C: is locked).</span></span></label>
              <label class="su-opt su-off"><input type="radio" name="bl-u" disabled> <span><b>Insert a USB flash drive</b><br><span class="su-dim">Not available — a web page can't read startup keys from USB drives.</span></span></label>
              <div class="su-form"><label>Enter your password<input type="password" class="su-input" data-f="p1" autocomplete="new-password" data-no-eye value="${esc(api.data.p1 || "")}"></label>
              <label>Reenter your password<input type="password" class="su-input" data-f="p2" autocomplete="new-password" data-no-eye value="${esc(api.data.p2 || "")}"></label>
              <p class="su-dim">Use at least 8 characters. Mix upper and lowercase letters, numbers, spaces and symbols.</p></div>`;
            api.body.querySelectorAll("[data-f]").forEach((i) => i.oninput = () => { api.data[i.dataset.f] = i.value; });
          }, validate(api) {
            const a = api.data.p1 || "", b = api.data.p2 || "";
            if (a.length < 8) { api.error("The password must be at least 8 characters."); return false; }
            if (a !== b) { api.error("The passwords don't match."); return false; }
            return true;
          } },
          { name: "Back up", render(api) {
            api.body.innerHTML = `<h2 class="su-h2">How do you want to back up your recovery key?</h2>
              <p class="su-dim">A recovery key can be used to access your files and folders if you forget your password. It's a good idea to have more than one and keep each in a safe place other than your PC.</p>
              ${keyBox(rk, rid)}
              <div class="su-bl-bk">
                <button type="button" class="su-bigbtn" data-a="acct" disabled>${ic("info")}<span>Save to your Microsoft account<small>Not available offline</small></span></button>
                <button type="button" class="su-bigbtn" data-a="file">${ic("export")}<span>Save to a file<small>Downloads “BitLocker Recovery Key.txt”</small></span></button>
                <button type="button" class="su-bigbtn" data-a="print">${ic("task")}<span>Print the recovery key<small>Opens the print dialog</small></span></button>
                <button type="button" class="su-bigbtn" data-a="copy">${ic("check")}<span>Copy the recovery key<small>Paste it somewhere safe</small></span></button>
              </div>
              <label class="su-chk"><input type="checkbox" data-a="wrote" ${backedUp ? "checked" : ""}> I wrote the recovery key down and will keep it somewhere safe</label>
              <div class="su-bl-saved su-ok" ${backedUp ? "" : "hidden"}>${ic("check")} Your recovery key is backed up.</div>`;
            const ok = () => { backedUp = true; api.body.querySelector(".su-bl-saved").hidden = false; api.setNext("Next >", true); };
            api.setNext("Next >", backedUp);
            api.body.querySelector('[data-a="file"]').onclick = () => { saveKeyFile(rk, rid); ok(); };
            api.body.querySelector('[data-a="print"]').onclick = () => { printKey(rk, rid); ok(); };
            api.body.querySelector('[data-a="copy"]').onclick = () => { try { navigator.clipboard.writeText(rk).then(ok, ok); } catch (_) { ok(); } };
            api.body.querySelector('[data-a="wrote"]').onchange = (e) => { if (e.target.checked) ok(); else { backedUp = false; api.body.querySelector(".su-bl-saved").hidden = true; api.setNext("Next >", false); } };
          }, validate(api) { if (!backedUp) { api.error("Back up your recovery key before you continue."); return false; } return true; } },
          { name: "Space", render(api) {
            api.body.innerHTML = `<h2 class="su-h2">Choose how much of your drive to encrypt</h2>
              <p class="su-dim">If you're setting up BitLocker on a new drive or a new PC, you only need to encrypt the part of the drive that's being used now.</p>
              <label class="su-opt"><input type="radio" name="bl-s" checked> <span><b>Encrypt used disk space only</b> (faster and best for new PCs and drives)</span></label>
              <label class="su-opt"><input type="radio" name="bl-s"> <span><b>Encrypt entire drive</b> (slower but best for PCs and drives already in use)</span></label>
              <p class="su-note">${ic("info", 16)} This desktop has no raw disk sectors, so both choices encrypt the same thing: every file's contents on C: (text and documents in your state, pictures and other files in IndexedDB).</p>`;
          } },
          { name: "Mode", render(api) {
            api.body.innerHTML = `<h2 class="su-h2">Choose which encryption mode to use</h2>
              <label class="su-opt"><input type="radio" name="bl-m" checked> <span><b>New encryption mode</b> (best for fixed drives on this device)</span></label>
              <label class="su-opt"><input type="radio" name="bl-m"> <span><b>Compatible mode</b> (best for drives that can be moved from this device)</span></label>
              <p class="su-note">${ic("info", 16)} Real algorithm: AES-256-GCM through the browser's Web Crypto API, with the key protected by PBKDF2-SHA256 (210,000 iterations). Windows itself uses XTS-AES.</p>`;
          } },
          { name: "Encrypt", next: "Start encrypting", render(api) {
            api.body.innerHTML = `<h2 class="su-h2">Are you ready to encrypt this drive?</h2>
              <label class="su-chk"><input type="checkbox" data-a="chk" checked> Run BitLocker system check</label>
              <p class="su-dim">The system check makes sure Web Crypto can encrypt and decrypt correctly (and detects tampering) before anything is encrypted.</p>
              <p class="su-dim">Encryption might take a while depending on how many files you have. You can keep using your PC, and if the page is closed it carries on after you unlock the drive next time.</p>`;
          }, async validate(api) {
            const chk = api.body.querySelector('[data-a="chk"]').checked;
            if (chk && !(await B.selfTest())) { api.error("The BitLocker system check failed: Web Crypto didn't round-trip. Nothing was changed."); return false; }
            return true;
          } },
        ],
      });
      if (!data) return;
      try {
        const p = B.turnOn(data.p1, rk, rid);
        p.catch((e) => alertBox("BitLocker Drive Encryption", esc(e.message || String(e))));
        data.p1 = data.p2 = "";
        note("BitLocker Drive Encryption", "Encrypting drive C:… You can keep working.", "bitlocker");
      } catch (e) { alertBox("BitLocker Drive Encryption", esc(e.message || String(e))); }
    }

    async function backupKey() {
      if (B.lockedNow()) { if (!(await B.promptUnlock())) return; }
      const key = await B.recoveryKey(); const m = B.meta();
      if (!key) return alertBox("Back up your recovery key", "The recovery key can't be read right now.");
      const v = await dialog({ title: "How do you want to back up your recovery key?", html: keyBox(key, m.recoveryId), buttons: [{ label: "Save to a file", primary: true, value: "file" }, { label: "Print", value: "print" }, { label: "Close", value: null }] });
      if (v === "file") saveKeyFile(key, m.recoveryId); else if (v === "print") printKey(key, m.recoveryId);
    }
    async function changePw() {
      const html = `<label class="rc-field"><span>Current password (or 48-digit recovery key)</span><input class="rc-input" data-f="old" type="password" data-no-eye autocomplete="off"></label>
        <label class="rc-field"><span>New password</span><input class="rc-input" data-f="n1" type="password" data-no-eye autocomplete="new-password"></label>
        <label class="rc-field"><span>Confirm new password</span><input class="rc-input" data-f="n2" type="password" data-no-eye autocomplete="new-password"></label>`;
      await dialog({ title: "Change password", html, buttons: [{ label: "Change password", primary: true, onClick: async (api) => {
        const v = (k) => api.content.querySelector(`[data-f="${k}"]`).value;
        if (v("n1").length < 8) { api.error("The new password must be at least 8 characters."); return false; }
        if (v("n1") !== v("n2")) { api.error("The new passwords don't match."); return false; }
        api.busy(true);
        const how = B.normRecovery(v("old")) ? "recovery" : "password";
        try { await B.changePassword(v("old"), how, v("n1")); } catch (e) { api.busy(false); api.error(e.message); return false; }
        api.busy(false); note("BitLocker Drive Encryption", "The password for drive C: was changed.", "bitlocker"); return true;
      } }, { label: "Cancel", value: null }] });
    }
    async function suspendFlow() {
      if (!(await elevate("BitLocker Drive Encryption"))) return;
      if (!(await confirmBox("BitLocker Drive Encryption", "<p>Do you want to suspend BitLocker protection?</p><p class='rc-dim'>Your data stays encrypted, but the key is kept unprotected on this device (in IndexedDB, as the TPM would), so drive C: unlocks without a password until you resume protection.</p>", "Yes"))) return;
      try { await B.suspend(); } catch (e) { alertBox("BitLocker Drive Encryption", esc(e.message)); }
    }
    async function resumeFlow() { if (!(await elevate("BitLocker Drive Encryption"))) return; await B.resume(); }
    async function offFlow() {
      if (B.lockedNow() && !(await B.promptUnlock())) return;
      if (!(await elevate("BitLocker Drive Encryption"))) return;
      if (!(await confirmBox("Turn off BitLocker", "<p>Your drive will be decrypted. This might take a long time, but you can keep using your PC during the decryption process.</p>", "Turn off BitLocker"))) return;
      try { B.turnOff().catch((e) => alertBox("BitLocker Drive Encryption", esc(e.message))); } catch (e) { alertBox("BitLocker Drive Encryption", esc(e.message)); }
    }
    async function lockFlow() { try { await B.lock(); } catch (e) { alertBox("BitLocker Drive Encryption", esc(e.message)); } }

    // Control Panel ▸ System and Security ▸ BitLocker Drive Encryption
    function cpPage(main, side, nav) {
      const sl = (t, fn, shield) => { const b = el(`<button class="st-sidelink ${shield ? "st-shield" : ""}">${esc(t)}</button>`); b.onclick = fn; side.appendChild(b); };
      side.appendChild(el(`<div class="su-side-h">See also</div>`));
      sl("TPM Administration", () => WM.open("security"));
      sl("Disk Management", () => WM.open("diskmgmt"));
      const box = el(`<div class="su-bl-cp"></div>`); main.appendChild(box);
      let raf = 0;
      const paint = () => {
        raf = 0; if (!box.isConnected) return;
        const s = B.status(), m = B.meta() || {}, locked = B.lockedNow(), p = B.progress();
        const acts = [];
        if (s === "off") acts.push(["Turn on BitLocker", setup, true]);
        else if (locked) acts.push(["Unlock drive", () => B.promptUnlock()]);
        else {
          if (s === "on") acts.push(m.suspended ? ["Resume protection", resumeFlow, true] : ["Suspend protection", suspendFlow, true]);
          acts.push(["Back up your recovery key", backupKey, true]);
          if (s === "on" || s === "encrypting") acts.push(["Change password", changePw]);
          if (s === "on") acts.push(["Lock drive", lockFlow]);
          if (s !== "decrypting") acts.push(["Turn off BitLocker", offFlow, true]);
        }
        box.innerHTML = `<p class="st-dim">Help protect your files and folders from unauthorized access by protecting your drives with BitLocker.</p>
          <h2 class="st-h2">Operating system drive</h2>
          <div class="su-bl-drv"><span class="su-bl-drvic ${s !== "off" ? "on" : ""} ${locked ? "locked" : ""}">${ic("disk", 30)}<i>${ic(locked ? "lock" : s !== "off" ? "unlock" : "lock", 14)}</i></span><div><b>C: ${esc(stLabel())}</b>
            ${s === "encrypting" || s === "decrypting" ? `<div class="su-bar"><i style="width:${(s === "encrypting" ? B.percent() : 100 - B.percent()).toFixed(1)}%"></i></div><div class="su-dim">${p ? (p.op === "encrypt" ? "Encrypting" : "Decrypting") + " " + p.done + " of " + p.total + " items…" : locked ? "Unlock the drive to continue." : "Waiting…"}</div>` : ""}
            ${s !== "off" ? `<div class="su-dim">Protectors: Password, Recovery key${m.recoveryId ? " (ID " + esc(m.recoveryId.slice(0, 8)) + ")" : ""}${m.suspended ? " · protection suspended (the key is stored unprotected)" : ""} · AES-256-GCM</div>` : ""}</div></div>
          <div class="su-bl-acts">${acts.map((a, i) => `<button class="st-sidelink su-bl-act ${a[2] ? "st-shield" : ""}" data-i="${i}">${a[2] ? ic("lock", 14) : ""}${esc(a[0])}</button>`).join("")}</div>
          <h2 class="st-h2">Fixed data drives</h2><p class="st-dim">This PC has no other fixed drives.</p>
          <h2 class="st-h2">Removable data drives — BitLocker To Go</h2><p class="st-dim">Insert a removable USB flash drive to use BitLocker To Go. (Browsers can't open USB drives, so this isn't available.)</p>
          <p class="su-note">${ic("info", 16)} What's real: the contents of every file on C: (your user folders, C:\\ and the Recycle Bin) and their IndexedDB blobs are encrypted with AES-256-GCM via Web Crypto; the key is protected by your password and a 48-digit recovery key. Simulated: there's no TPM or pre-boot firmware — the BitLocker screen appears before the sign-in screen instead. Not covered: File History copies and Visual Studio Code's own workspace copies.</p>`;
        box.querySelectorAll(".su-bl-act").forEach((b) => b.onclick = () => acts[+b.dataset.i][1]());
      };
      paint();
      const off = B.on(() => { if (!box.isConnected) { off(); return; } if (!raf) raf = requestAnimationFrame(paint); });
      if (nav && nav.onLeave) nav.onLeave(off);
    }

    // ---- manage-bde / PowerShell ----
    const HDR = "BitLocker Drive Encryption: Configuration Tool version 10.0.26100\nCopyright (C) 2013 Microsoft Corporation. All rights reserved.\n";
    function statusText() {
      const s = B.status(), m = B.meta() || {}, pc = B.percent();
      const conv = s === "off" ? "Fully Decrypted" : s === "on" ? "Used Space Only Encrypted" : s === "encrypting" ? "Encryption in Progress" : "Decryption in Progress";
      const L = (k, v) => "    " + (k + ":").padEnd(22) + v;
      return [HDR, "Disk volumes that can be protected with", "BitLocker Drive Encryption:", "Volume C: [Local Disk]", "[OS Volume]", "",
        L("Size", "Browser storage (see Disk Management)"), L("BitLocker Version", s === "off" ? "None" : "2.0"), L("Conversion Status", conv),
        L("Percentage Encrypted", (s === "off" ? 0 : s === "on" ? 100 : s === "encrypting" ? pc : 100 - pc).toFixed(1) + "%"),
        L("Encryption Method", s === "off" ? "None" : "AES-GCM 256 (Web Crypto)"),
        L("Protection Status", s === "off" || m.suspended ? "Protection Off" + (m.suspended ? " (Suspended)" : "") : "Protection On"),
        L("Lock Status", B.lockedNow() ? "Locked" : "Unlocked"), L("Identification Field", "Unknown"),
        "    Key Protectors:" + (s === "off" ? "        None Found" : "\n        Password\n        Numerical Password"), ""].join("\n");
    }
    async function manageBde(c) {
      const io = c.io, a = c.a.map((x) => String(x)), al = a.map((x) => x.toLowerCase());
      const has = (f) => al.includes(f);
      const vol = a.find((x) => /^[a-z]:$/i.test(x));
      if (!al.length || has("-?") || has("/?") || has("-h")) { io.out(HDR + "\nmanage-bde[.exe] -parameter [arguments]\n\nDescription:\n    Configures BitLocker Drive Encryption on disk volumes.\n\nParameter List:\n    -status     Provides information about BitLocker-capable volumes.\n    -on         Encrypts the volume and turns BitLocker protection on.\n    -off        Decrypts the volume and turns BitLocker protection off.\n    -lock       Prevents access to BitLocker-encrypted data.\n    -unlock     Allows access to BitLocker-encrypted data (-pw or -rp <key>).\n    -protectors Manages protection methods (-get, -disable, -enable).\n    -changepassword  Modifies the password for a data volume.\n    -? or /?    Displays brief help.\n"); return 0; }
      if (vol && vol.toUpperCase() !== "C:") { io.err("ERROR: An error occurred (code 0x80070057):\nThe parameter is incorrect. This PC only has volume C:."); return 1; }
      if (has("-status")) { io.out(statusText()); return 0; }
      if (has("-on")) {
        if (B.isOn()) { io.err(HDR + "\nERROR: The volume C: is already encrypted (or being converted)."); return 1; }
        io.out(HDR + "\nOpening BitLocker setup for volume C: (a password and recovery key are chosen in the wizard)…"); setup(); return 0;
      }
      if (has("-off")) {
        if (!B.isOn()) { io.out(HDR + "\nVolume C: is already fully decrypted."); return 0; }
        if (B.lockedNow()) { io.err("ERROR: Volume C: is locked. Unlock it first with manage-bde -unlock C: -pw"); return 1; }
        if (!(await elevate("manage-bde -off C:"))) { io.err("ERROR: An attempt to access a required resource was denied.\nCheck that you have administrative rights on the computer."); return 1; }
        B.turnOff().catch(() => {}); io.out(HDR + "\nDecryption is now in progress."); return 0;
      }
      if (has("-lock")) {
        if (!B.isOn()) { io.err("ERROR: Volume C: isn't protected by BitLocker."); return 1; }
        try { await B.lock(); io.out(HDR + "\nVolume C: is now locked"); return 0; } catch (e) { io.err("ERROR: " + e.message); return 1; }
      }
      if (has("-unlock")) {
        if (!B.lockedNow()) { io.out(HDR + "\nVolume C: is already unlocked."); return 0; }
        const ri = al.findIndex((x) => x === "-rp" || x === "-recoverypassword");
        if (ri >= 0) { const k = a[ri + 1] || ""; const ok = await B.unlock(k, "recovery"); if (ok) { io.out(HDR + "\nThe password successfully unlocked volume C:."); return 0; } io.err("ERROR: The recovery password could not unlock volume C:."); return 1; }
        io.out(HDR + "\nEnter the password to unlock this volume (a secure prompt opened):");
        const ok = await B.promptUnlock(); if (ok) { io.out("The password successfully unlocked volume C:."); return 0; } io.err("ERROR: Volume C: is still locked."); return 1;
      }
      if (has("-protectors")) {
        const m = B.meta() || {};
        if (has("-get")) {
          if (!B.isOn()) { io.out(HDR + "\nVolume C: [Local Disk]\nAll Key Protectors\n\n    ERROR: No key protectors found."); return 0; }
          io.out(HDR + "\nVolume C: [Local Disk]\nAll Key Protectors\n\n    Password:\n      ID: {" + (m.keyId || "") + "}\n\n    Numerical Password:\n      ID: {" + (m.recoveryId || "") + "}\n      Password:\n        " + (B.lockedNow() ? "(unlock the volume to show the recovery key)" : ((await B.recoveryKey()) || "")) + "\n"); return 0;
        }
        if (has("-disable")) { if (!B.isOn() || B.lockedNow()) { io.err("ERROR: Volume C: must be encrypted and unlocked."); return 1; } if (!(await elevate("manage-bde -protectors -disable C:"))) { io.err("ERROR: Access denied."); return 1; } try { await B.suspend(); io.out(HDR + "\nKey Protectors Disabled for Volume C:"); return 0; } catch (e) { io.err("ERROR: " + e.message); return 1; } }
        if (has("-enable")) { if (!B.isOn()) { io.err("ERROR: Volume C: isn't protected by BitLocker."); return 1; } if (!(await elevate("manage-bde -protectors -enable C:"))) { io.err("ERROR: Access denied."); return 1; } await B.resume(); io.out(HDR + "\nKey Protectors Enabled for Volume C:"); return 0; }
        io.err("ERROR: Use -get, -disable or -enable."); return 1;
      }
      if (has("-changepassword")) { if (!B.isOn()) { io.err("ERROR: Volume C: isn't protected by BitLocker."); return 1; } changePw(); io.out(HDR + "\nA secure prompt opened to change the password."); return 0; }
      io.err("ERROR: An invalid parameter was specified. Type manage-bde -? for help."); return 1;
    }
    function getVol(c) {
      const s = B.status(), m = B.meta() || {};
      c.io.out("\n   ComputerName: " + ((window.SysTools && SysTools.deviceName && SysTools.deviceName()) || "WIN12-PC") + "\n\nVolumeType      Mount CapacityGB VolumeStatus           Encryption KeyProtector              AutoUnlock Protection\n                Point                                  Percentage                           Enabled    Status\n----------      ----- ---------- ------------           ---------- ------------              ---------- ----------");
      const vs = s === "off" ? "FullyDecrypted" : s === "on" ? "FullyEncrypted" : s === "encrypting" ? "EncryptionInProgress" : "DecryptionInProgress";
      c.io.out("OperatingSystem C:         —     " + vs.padEnd(22) + " " + String(Math.round(s === "on" ? 100 : s === "off" ? 0 : B.percent())).padEnd(10) + " " + (s === "off" ? "{}" : "{Password, RecoveryPassword}").padEnd(25) + " " + "".padEnd(10) + " " + (s === "off" || m.suspended ? "Off" : "On") + "\n");
      return 0;
    }
    function registerTerminal() {
      window.TerminalExt = window.TerminalExt || { cmd: {}, ps: {} };
      TerminalExt.cmd = TerminalExt.cmd || {}; TerminalExt.ps = TerminalExt.ps || {};
      TerminalExt.cmd["manage-bde"] = manageBde;
      TerminalExt.ps["get-bitlockervolume"] = getVol;
      TerminalExt.ps["enable-bitlocker"] = (c) => { setup(); c.io.out("Opening BitLocker setup…"); return 0; };
      TerminalExt.ps["disable-bitlocker"] = (c) => manageBde(Object.assign({}, c, { a: ["-off", "C:"] }));
      TerminalExt.ps["lock-bitlocker"] = (c) => manageBde(Object.assign({}, c, { a: ["-lock", "C:"] }));
      TerminalExt.ps["unlock-bitlocker"] = (c) => { const i = c.a.findIndex((x) => /^-recoverypassword$/i.test(x)); return manageBde(Object.assign({}, c, { a: i >= 0 ? ["-unlock", "C:", "-rp", c.a[i + 1]] : ["-unlock", "C:", "-pw"] })); };
      TerminalExt.ps["suspend-bitlocker"] = (c) => manageBde(Object.assign({}, c, { a: ["-protectors", "-disable", "C:"] }));
      TerminalExt.ps["resume-bitlocker"] = (c) => manageBde(Object.assign({}, c, { a: ["-protectors", "-enable", "C:"] }));
    }
    return { setup, cpPage, backupKey, changePw, suspendFlow, resumeFlow, offFlow, lockFlow, registerTerminal, statusText, label: stLabel };
  })();

  // =====================================================================
  //  2. TASK SCHEDULER (taskschd.msc) — tasks really run while the desktop is open
  // =====================================================================
  const TaskSched = (function () {
    const R = { OK: 0, NEVER: 0x41303, RUNNING: 0x41301, TERMINATED: 0x41306, FAIL: 0x1, REFUSED: 0x800710E0, NOTFOUND: 0x80070002 };
    const RTEXT = { 0: "The operation completed successfully.", 0x41303: "The task has not yet run.", 0x41301: "The task is currently running.", 0x41306: "The task was terminated by the user.", 0x1: "Incorrect function.", 0x800710E0: "The operator or administrator has refused the request.", 0x80070002: "The system cannot find the file specified." };
    const hex = (n) => "0x" + (n >>> 0).toString(16).toUpperCase();
    const resultText = (n) => (n == null ? "" : (RTEXT[n] || "Error") + " (" + hex(n) + ")");
    const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const SRC = "Microsoft-Windows-TaskScheduler";
    const listeners = new Set();
    const emit = () => listeners.forEach((f) => { try { f(); } catch (_) {} });
    const running = new Map();   // id -> { cancel() }

    function store() {
      const a = AD(); let s = a.taskSched;
      if (!s || typeof s !== "object") s = a.taskSched = {};
      if (!Array.isArray(s.tasks)) s.tasks = [];
      if (!Array.isArray(s.folders)) s.folders = ["\\"];
      if (s.histOn == null) s.histOn = true;
      if (!s.seeded) seed(s);
      return s;
    }
    function seed(s) {
      s.seeded = 1;
      ["\\Microsoft\\", "\\Microsoft\\Windows\\", "\\Microsoft\\Windows\\DiskFootprint\\", "\\Microsoft\\Windows\\Windows Search\\"].forEach((f) => { if (!s.folders.includes(f)) s.folders.push(f); });
      const at3 = new Date(); at3.setHours(3, 0, 0, 0);
      s.tasks.push(mkTask({ name: "StorageSense", folder: "\\Microsoft\\Windows\\DiskFootprint\\", author: "Microsoft Corporation", builtin: true,
        desc: "Storage Sense: frees up space by deleting temporary files, old Recycle Bin items and old Downloads, on the schedule chosen in Settings ▸ System ▸ Storage.",
        triggers: [{ type: "daily", start: at3.getTime(), every: 1 }], actions: [{ type: "internal", fn: "storagesense" }], settings: { startWhenAvailable: true } }));
      s.tasks.push(mkTask({ name: "IndexerAutomaticMaintenance", folder: "\\Microsoft\\Windows\\Windows Search\\", author: "Microsoft Corporation", builtin: true,
        desc: "Keeps the search index up to date and compact.", triggers: [{ type: "daily", start: at3.getTime() + 30 * MIN, every: 1 }], actions: [{ type: "internal", fn: "indexer" }], settings: { startWhenAvailable: true } }));
    }
    function mkTask(o) {
      const t = Object.assign({ id: uid("t"), name: "New Task", folder: "\\", desc: "", author: (window.SysTools && SysTools.deviceName ? SysTools.deviceName() : "WIN12-PC") + "\\" + userName(), created: now(), enabled: true, highest: false, hidden: false, triggers: [], actions: [] }, o || {});
      t.conditions = Object.assign({ idleOnly: false, idleMin: 10, acOnly: false }, o && o.conditions);
      t.settings = Object.assign({ allowDemand: true, startWhenAvailable: false, stopAfter: 60 }, o && o.settings);
      t.state = Object.assign({ lastRun: 0, lastResult: R.NEVER }, o && o.state);
      t.history = Array.isArray(t.history) ? t.history : [];
      t.triggers = t.triggers.map((tr) => Object.assign({ id: uid("tr"), enabled: true }, tr));
      t.triggers.forEach((tr) => { if (tr.next == null) tr.next = nextOf(tr, now()); });
      return t;
    }
    const tasks = () => store().tasks;
    const byId = (id) => tasks().find((t) => t.id === id) || null;
    const fullName = (t) => t.folder + t.name;
    const byName = (n) => { const q = String(n || "").replace(/^\\?/, "\\").toLowerCase(); return tasks().find((t) => fullName(t).toLowerCase() === q) || tasks().find((t) => t.name.toLowerCase() === String(n || "").replace(/^\\/, "").toLowerCase()) || null; };

    // ---- schedule math (local time) ----
    function atTimeOfDay(dayTs, ref) { const d = new Date(dayTs), r = new Date(ref); d.setHours(r.getHours(), r.getMinutes(), r.getSeconds(), 0); return d.getTime(); }
    const dayStart = (ts) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
    const addDays = (ts, n) => { const d = new Date(ts); d.setDate(d.getDate() + n); return d.getTime(); };
    const daysBetween = (a, b) => Math.round((dayStart(b) - dayStart(a)) / DAY);
    function nextOf(tr, from) {
      if (!tr || tr.enabled === false) return null;
      const st = +tr.start || 0;
      if (tr.type === "time") return st > from ? st : null;
      if (tr.type === "daily") {
        const every = Math.max(1, tr.every | 0);
        if (st > from) return st;
        let k = Math.floor(daysBetween(st, from) / every) * every; let c = atTimeOfDay(addDays(st, k), st);
        while (c <= from) { k += every; c = atTimeOfDay(addDays(st, k), st); }
        return c;
      }
      if (tr.type === "weekly") {
        const every = Math.max(1, tr.every | 0), days = (tr.days && tr.days.length ? tr.days : [new Date(st).getDay()]);
        const wk0 = addDays(dayStart(st), -new Date(st).getDay());
        for (let i = 0; i < 7 * every * 2 + 8; i++) {
          const day = addDays(dayStart(Math.max(from, st)), i), c = atTimeOfDay(day, st);
          if (c <= from || c < st) continue;
          const wk = Math.floor(daysBetween(wk0, day) / 7);
          if (wk % every === 0 && days.includes(new Date(day).getDay())) return c;
        }
        return null;
      }
      return null;
    }
    const taskNext = (t) => { if (!t.enabled) return null; let n = null; t.triggers.forEach((tr) => { if (tr.enabled !== false && tr.next && (!n || tr.next < n)) n = tr.next; }); return n; };
    const tfmt = (ts) => new Date(ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    const dfmt = (ts) => new Date(ts).toLocaleDateString();
    function trigText(tr) {
      const st = +tr.start || now();
      let s;
      if (tr.type === "time") s = "At " + tfmt(st) + " on " + dfmt(st);
      else if (tr.type === "daily") s = "At " + tfmt(st) + " every " + ((tr.every | 0) > 1 ? tr.every + " days" : "day");
      else if (tr.type === "weekly") s = "At " + tfmt(st) + " every " + (tr.days || []).map((d) => DAYS[d]).join(", ") + " of every " + ((tr.every | 0) > 1 ? tr.every + " weeks" : "week");
      else if (tr.type === "logon") s = "At log on of " + userName();
      else if (tr.type === "startup") s = "At system startup";
      else if (tr.type === "idle") s = "On idle (after " + (tr.idleMin || 10) + " minutes)";
      else if (tr.type === "event") s = "On event - Log: " + (tr.log || "Any") + ", Source: " + (tr.source || "Any") + ", Event ID: " + (tr.eventId || "Any");
      else s = tr.type;
      if (tr.delayMin) s += " - Delay " + tr.delayMin + " minute(s)";
      return s + (tr.enabled === false ? " (disabled)" : "");
    }
    const TRIG_NAMES = { time: "One time", daily: "Daily", weekly: "Weekly", logon: "At log on", startup: "At startup", idle: "On idle", event: "On an event" };
    function actText(a) {
      if (a.type === "app") return "Start a program: " + (a.program || "");
      if (a.type === "msg") return "Display a message: " + (a.title || "") + (a.text ? " — " + a.text : "");
      if (a.type === "cmd") return "Run a terminal command (" + (a.shell === "ps" ? "PowerShell" : "Command Prompt") + "): " + (a.line || "");
      if (a.type === "restore") return "Create a restore point: " + (a.desc || "Scheduled restore point");
      if (a.type === "internal") return "Custom Handler: " + ({ storagesense: "Storage Sense", indexer: "Windows Search indexer maintenance" }[a.fn] || a.fn);
      return a.type;
    }
    function hist(t, id, msg, level) {
      if (!store().histOn) return;
      t.history.unshift({ ts: now(), id, level: level || "Information", msg });
      if (t.history.length > 60) t.history.length = 60;
    }

    // ---- running actions ----
    let termP = null;
    function loadTerminal() {
      if (window.TerminalCore) return Promise.resolve(window.TerminalCore);
      if (termP) return termP;
      termP = new Promise((res, rej) => { const sc = document.createElement("script"); sc.src = "js/terminal-core.js" + VQ; sc.onload = () => (window.TerminalCore ? res(window.TerminalCore) : rej(new Error("Terminal engine missing"))); sc.onerror = () => { termP = null; rej(new Error("Couldn't load the terminal engine")); }; document.head.appendChild(sc); });
      return termP;
    }
    // Runs a command line in a hidden terminal session (the same engine as Terminal). Resolves with its output.
    async function runCommand(a, cancelBox) {
      const TC = await loadTerminal();
      const host = el(`<div class="su-hidden-term" aria-hidden="true"></div>`); document.body.appendChild(host);
      const ad = AD(), th = ad.terminal && Array.isArray(ad.terminal.history) ? ad.terminal.history.slice() : null;
      const sess = TC.createSession({ host, profile: { shell: a.shell === "ps" ? "ps" : "cmd", banner: "none", startDir: a.dir || null }, close: () => {} });
      cancelBox.cancel = () => { try { sess.dispose(); } catch (_) {} };
      try {
        await sleep(30);
        const lines = String(a.line || "").split(/\r?\n/).filter((x) => x.trim());
        await sess.run(lines);
        const txt = (sess.text() || "").trim();
        return txt.split("\n").slice(-40).join("\n");
      } finally {
        try { sess.dispose(); } catch (_) {}
        host.remove();
        if (th && AD().terminal) { AD().terminal.history = th; }
      }
    }
    function waitDesktop(cancelBox) { return new Promise((res, rej) => { if (desktopUp()) return res(); const iv = setInterval(() => { if (cancelBox.dead) { clearInterval(iv); rej(new Error("terminated")); } else if (desktopUp()) { clearInterval(iv); res(); } }, 500); }); }
    async function execAction(a, t, cancelBox) {
      if (a.type === "app") {
        await waitDesktop(cancelBox);
        const prog = String(a.program || "").trim(); if (!prog) throw new Error("No program was given.");
        let ok = false;
        if (window.SysRun) { const r = SysRun(prog + (a.args ? " " + a.args : "")); ok = !!(r && r.ok); }
        if (!ok && window.AppRegistry && AppRegistry[prog]) { WM.open(prog); ok = true; }
        if (!ok) { const e = new Error("Windows cannot find '" + prog + "'."); e.code = R.NOTFOUND; throw e; }
        return "Started " + prog;
      }
      if (a.type === "msg") {
        await waitDesktop(cancelBox);
        dialog({ title: a.title || t.name, html: `<div class="su-ts-msg">${ic("info", 30)}<div>${esc(a.text || "").replace(/\n/g, "<br>")}</div></div><p class="rc-dim">Shown by the scheduled task “${esc(t.name)}”.</p>`, buttons: [{ label: "OK", primary: true, value: true }] });
        return "Message shown";
      }
      if (a.type === "cmd") { const out = await runCommand(a, cancelBox); return out ? "Output:\n" + out : "No output"; }
      if (a.type === "restore") {
        if (!window.Recovery || !Recovery.createPoint) throw new Error("System Restore isn't available.");
        const m = await Recovery.createPoint(a.desc || "Scheduled restore point (" + t.name + ")", "Manual");
        return "Created restore point “" + (m && m.desc) + "”";
      }
      if (a.type === "internal") {
        if (a.fn === "storagesense") { const r = await StorageSense.scheduled(); return r ? "Storage Sense freed " + fmtBytes(r.freed) : "Storage Sense: nothing to do (off or not due)"; }
        if (a.fn === "indexer") { await SearchIndex.update(); const st = SearchIndex.status(); return "Indexed " + st.count + " items"; }
      }
      throw new Error("Unknown action");
    }
    async function runTask(t, why) {
      if (!t) return R.NOTFOUND;
      if (running.has(t.id)) { hist(t, 322, "Task Scheduler did not launch task “" + fullName(t) + "” because instance is already running (MultipleInstancesPolicy: IgnoreNew).", "Warning"); return R.RUNNING; }
      const c = t.conditions || {};
      if (why !== "demand") {
        if (c.idleOnly && window.IdleLock && IdleLock.idleMs() < (c.idleMin || 10) * MIN) { hist(t, 141, "Task Scheduler did not launch task “" + fullName(t) + "” because the computer wasn't idle (condition).", "Warning"); t.state.lastResult = R.REFUSED; save(); emit(); return R.REFUSED; }
        if (c.acOnly && PowerPlans.onBattery()) { hist(t, 141, "Task Scheduler did not launch task “" + fullName(t) + "” because the computer is running on batteries (condition).", "Warning"); t.state.lastResult = R.REFUSED; save(); emit(); return R.REFUSED; }
      }
      const box = { dead: false, cancel: null };
      running.set(t.id, { cancel: () => { box.dead = true; if (box.cancel) box.cancel(); } });
      t.state.lastRun = now(); t.state.lastResult = R.RUNNING; t.state.running = true;
      const whyTxt = { demand: "launched on demand by user " + userName(), time: "launched by its time trigger", missed: "launched because a scheduled start was missed (Run task as soon as possible after a scheduled start is missed)", logon: "launched at log on of user " + userName(), startup: "launched at system startup", idle: "launched because the computer was idle", event: "launched by an Event Log event" }[why] || "launched";
      hist(t, why === "demand" ? 110 : 107, "Task “" + fullName(t) + "” " + whyTxt + ".");
      hist(t, 100, "Task Scheduler started “" + fullName(t) + "” for user " + userName() + ".");
      log("Application", "Information", SRC, 100, "Task Scheduler started \"" + fullName(t) + "\" instance for user \"" + userName() + "\" (" + whyTxt + ").");
      save(); emit();
      let result = R.OK;
      const limit = (t.settings.stopAfter | 0) > 0 ? t.settings.stopAfter * MIN : 0;
      try {
        for (const a of t.actions) {
          if (box.dead) { result = R.TERMINATED; break; }
          hist(t, 200, "Task Scheduler launched action “" + actText(a) + "” in instance of task “" + fullName(t) + "”.");
          const p = execAction(a, t, box);
          const out = await (limit ? Promise.race([p, sleep(limit).then(() => { box.dead = true; if (box.cancel) box.cancel(); throw Object.assign(new Error("stopped after " + t.settings.stopAfter + " min"), { code: R.TERMINATED }); })]) : p);
          hist(t, 201, "Task Scheduler successfully completed task “" + fullName(t) + "”, action “" + actText(a) + "”. " + (out || ""));
        }
        if (box.dead) result = R.TERMINATED;
      } catch (e) {
        result = box.dead ? R.TERMINATED : (e && e.code) || R.FAIL;
        hist(t, result === R.TERMINATED ? 111 : 203, result === R.TERMINATED ? "Task Scheduler terminated “" + fullName(t) + "” task instance." : "Task Scheduler failed to launch action in instance of “" + fullName(t) + "”: " + (e && e.message ? e.message : e), result === R.TERMINATED ? "Warning" : "Error");
        if (result !== R.TERMINATED) log("Application", "Error", SRC, 203, "Task Scheduler failed to launch action in instance of \"" + fullName(t) + "\". Additional Data: Error Value: " + hex(result) + " " + (e && e.message ? e.message : ""));
      }
      running.delete(t.id);
      t.state.running = false; t.state.lastResult = result;
      hist(t, 102, "Task Scheduler finished “" + fullName(t) + "”. Result: " + resultText(result), result === R.OK ? "Information" : "Warning");
      if (result === R.OK) log("Application", "Information", SRC, 102, "Task Scheduler successfully finished \"" + fullName(t) + "\" instance for user \"" + userName() + "\".");
      save(); emit();
      return result;
    }
    function endTask(t) { const r = running.get(t.id); if (!r) return false; r.cancel(); hist(t, 111, "Task “" + fullName(t) + "” was terminated by user " + userName() + ".", "Warning"); return true; }

    // ---- the scheduler loop ----
    let started = false, wasLocked = true, idleFired = false, lastSeq = 0, startupFired = false;
    function fireType(type, filter) {
      tasks().forEach((t) => {
        if (!t.enabled) return;
        t.triggers.forEach((tr) => {
          if (tr.enabled === false || tr.type !== type || (filter && !filter(tr))) return;
          const go = () => runTask(t, type);
          if (tr.delayMin) setTimeout(go, tr.delayMin * MIN); else go();
        });
      });
    }
    function tick() {
      if (!S().setupCompleted) return;   // nothing runs during Windows Setup
      if (!startupFired) { startupFired = true; fireType("startup"); }
      const t0 = now();
      let dirty = false;
      tasks().forEach((t) => {
        t.triggers.forEach((tr) => {
          if (!["time", "daily", "weekly"].includes(tr.type)) return;
          if (tr.next == null && tr.enabled !== false && !tr.done) { tr.next = nextOf(tr, t0); dirty = true; }
          if (!t.enabled || tr.enabled === false || !tr.next || tr.next > t0) return;
          const late = t0 - tr.next;
          if (late < 2 * MIN) { runTask(t, "time"); }
          else if (t.settings.startWhenAvailable) { hist(t, 153, "A scheduled start of “" + fullName(t) + "” was missed at " + fmtWhen(tr.next) + "; it runs now (Run task as soon as possible after a scheduled start is missed)."); runTask(t, "missed"); }
          else hist(t, 153, "Task Scheduler missed a start of “" + fullName(t) + "” at " + fmtWhen(tr.next) + " because the computer was off. It will run at its next scheduled time.", "Warning");
          if (tr.type === "time") tr.done = true;
          tr.next = nextOf(tr, Math.max(t0, tr.next));
          dirty = true;
        });
      });
      // log on: the lock screen went away
      const locked = !desktopUp();
      if (wasLocked && !locked) fireType("logon");
      wasLocked = locked;
      // idle
      if (window.IdleLock && IdleLock.idleMs) {
        const idle = IdleLock.idleMs();
        if (idle < 15000) idleFired = false;
        else if (!idleFired) { const mins = idle / MIN; let any = false; fireType("idle", (tr) => { const ok = mins >= (tr.idleMin || 10); if (ok) any = true; return ok; }); if (any) idleFired = true; }
      }
      if (dirty) { save(); emit(); }
    }
    function onEvents() {
      if (!window.EventLog) return;
      const list = EventLog.list() || [];
      let max = lastSeq;
      list.forEach((e) => {
        if (!(e.n > lastSeq)) return; if (e.n > max) max = e.n;
        if (e.source === SRC) return;   // never trigger on our own events (no loops)
        fireType("event", (tr) => (!tr.log || tr.log === e.log) && (!tr.source || String(e.source).toLowerCase().includes(String(tr.source).toLowerCase())) && (!tr.eventId || +tr.eventId === e.id));
      });
      lastSeq = max;
    }
    function start() {
      if (started) return; started = true;
      store();
      try { const l = window.EventLog ? EventLog.list() || [] : []; lastSeq = l.reduce((m, e) => Math.max(m, e.n || 0), 0); } catch (_) {}
      if (window.EventLog && EventLog.on) EventLog.on(() => { try { onEvents(); } catch (e) { console.error(e); } });
      // At startup (once per page load) + catch-up of missed starts happen in the first tick.
      setTimeout(() => { try { tick(); } catch (e) { console.error("[TaskSched]", e); } }, 1500);
      setInterval(() => { try { tick(); } catch (e) { console.error("[TaskSched]", e); } }, 5000);
    }

    // ---- create / change ----
    function add(o) { const t = mkTask(o); store().tasks.push(t); if (o.folder && !store().folders.includes(o.folder)) store().folders.push(o.folder); hist(t, 106, "User “" + userName() + "” registered Task Scheduler task “" + fullName(t) + "”."); save(); emit(); return t; }
    function update(t, o) {
      Object.assign(t, o); t.triggers = t.triggers.map((tr) => Object.assign({ id: uid("tr"), enabled: true }, tr));
      t.triggers.forEach((tr) => { tr.done = false; tr.next = nextOf(tr, now()); });
      hist(t, 140, "User “" + userName() + "” updated Task Scheduler task “" + fullName(t) + "”."); save(); emit();
    }
    function remove(t) { endTask(t); const s = store(); s.tasks = s.tasks.filter((x) => x !== t); log("Application", "Information", SRC, 141, "User \"" + userName() + "\" deleted Task Scheduler task \"" + fullName(t) + "\"."); save(); emit(); }
    function setEnabled(t, on) { t.enabled = !!on; t.triggers.forEach((tr) => { tr.next = on ? nextOf(tr, now()) : tr.next; }); hist(t, on ? 140 : 142, "User “" + userName() + "” " + (on ? "enabled" : "disabled") + " Task Scheduler task “" + fullName(t) + "”."); save(); emit(); }

    // ---- XML (Task Scheduler 1.4 schema) ----
    const xe = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const iso = (ts) => { const d = new Date(ts), p = (n) => String(n).padStart(2, "0"); return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + "T" + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds()); };
    function toXML(t) {
      const trig = t.triggers.map((tr) => {
        const en = `<Enabled>${tr.enabled !== false}</Enabled>`, sb = tr.start ? `<StartBoundary>${iso(tr.start)}</StartBoundary>` : "", dl = tr.delayMin ? `<Delay>PT${tr.delayMin}M</Delay>` : "";
        if (tr.type === "time") return `    <TimeTrigger>${sb}${en}</TimeTrigger>`;
        if (tr.type === "daily") return `    <CalendarTrigger>${sb}${en}<ScheduleByDay><DaysInterval>${tr.every || 1}</DaysInterval></ScheduleByDay></CalendarTrigger>`;
        if (tr.type === "weekly") return `    <CalendarTrigger>${sb}${en}<ScheduleByWeek><DaysOfWeek>${(tr.days || []).map((d) => "<" + DAYS[d] + " />").join("")}</DaysOfWeek><WeeksInterval>${tr.every || 1}</WeeksInterval></ScheduleByWeek></CalendarTrigger>`;
        if (tr.type === "logon") return `    <LogonTrigger>${en}${dl}<UserId>${xe(userName())}</UserId></LogonTrigger>`;
        if (tr.type === "startup") return `    <BootTrigger>${en}${dl}</BootTrigger>`;
        if (tr.type === "idle") return `    <IdleTrigger>${en}<!-- idle minutes: ${tr.idleMin || 10} --></IdleTrigger>`;
        if (tr.type === "event") return `    <EventTrigger>${en}<Subscription>${xe(`<QueryList><Query Id="0" Path="${tr.log || "System"}"><Select Path="${tr.log || "System"}">*[System[${[tr.source ? `Provider[@Name='${tr.source}']` : "", tr.eventId ? `EventID=${tr.eventId}` : ""].filter(Boolean).join(" and ") || "*"}]]</Select></Query></QueryList>`)}</Subscription></EventTrigger>`;
        return "";
      }).join("\n");
      const acts = t.actions.map((a) => {
        if (a.type === "app") return `    <Exec><Command>${xe(a.program)}</Command>${a.args ? `<Arguments>${xe(a.args)}</Arguments>` : ""}</Exec>`;
        if (a.type === "msg") return `    <ShowMessage><Title>${xe(a.title)}</Title><Body>${xe(a.text)}</Body></ShowMessage>`;
        if (a.type === "cmd") return a.shell === "ps" ? `    <Exec><Command>powershell.exe</Command><Arguments>-Command ${xe(a.line)}</Arguments></Exec>` : `    <Exec><Command>cmd.exe</Command><Arguments>/c ${xe(a.line)}</Arguments></Exec>`;
        if (a.type === "restore") return `    <Exec><Command>powershell.exe</Command><Arguments>-Command Checkpoint-Computer -Description "${xe(a.desc || "Scheduled restore point")}"</Arguments></Exec>`;
        return `    <ComHandler><ClassId>{${a.fn}}</ClassId></ComHandler>`;
      }).join("\n");
      const c = t.conditions, s = t.settings;
      return `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Date>${iso(t.created)}</Date>
    <Author>${xe(t.author)}</Author>
    <Description>${xe(t.desc)}</Description>
    <URI>${xe(fullName(t))}</URI>
  </RegistrationInfo>
  <Triggers>
${trig}
  </Triggers>
  <Principals>
    <Principal id="Author">
      <UserId>${xe(userName())}</UserId>
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>${t.highest ? "HighestAvailable" : "LeastPrivilege"}</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>${!!c.acOnly}</DisallowStartIfOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>${!!s.startWhenAvailable}</StartWhenAvailable>
    <IdleSettings>
      <Duration>PT${c.idleMin || 10}M</Duration>
      <StopOnIdleEnd>false</StopOnIdleEnd>
    </IdleSettings>
    <AllowStartOnDemand>${s.allowDemand !== false}</AllowStartOnDemand>
    <Enabled>${!!t.enabled}</Enabled>
    <Hidden>${!!t.hidden}</Hidden>
    <RunOnlyIfIdle>${!!c.idleOnly}</RunOnlyIfIdle>
    <ExecutionTimeLimit>${s.stopAfter ? "PT" + s.stopAfter + "M" : "PT0S"}</ExecutionTimeLimit>
  </Settings>
  <Actions Context="Author">
${acts}
  </Actions>
</Task>
`;
    }
    function fromXML(text, name) {
      const doc = new DOMParser().parseFromString(String(text).replace(/^﻿/, "").replace(/encoding="UTF-16"/i, 'encoding="UTF-8"'), "application/xml");
      if (doc.querySelector("parsererror")) throw new Error("The task XML is malformed.");
      const q = (n, s) => { const x = (n || doc).getElementsByTagName(s)[0]; return x ? x.textContent : ""; };
      const ts = (s) => { const t = Date.parse(s); return isNaN(t) ? now() : t; };
      const uri = q(doc, "URI"); const parts = uri ? uri.split("\\") : [];
      const o = { name: parts.length ? parts[parts.length - 1] : (name || "Imported Task").replace(/\.xml$/i, ""), folder: parts.length > 2 ? parts.slice(0, -1).join("\\") + "\\" : "\\", desc: q(doc, "Description"), author: q(doc, "Author") || undefined, triggers: [], actions: [] };
      const trs = doc.getElementsByTagName("Triggers")[0];
      [...(trs ? trs.children : [])].forEach((n) => {
        const en = q(n, "Enabled") !== "false", start = ts(q(n, "StartBoundary")), dl = (q(n, "Delay").match(/PT(\d+)M/) || [])[1];
        const base = { enabled: en, start, delayMin: dl ? +dl : 0 };
        if (n.localName === "TimeTrigger") o.triggers.push(Object.assign(base, { type: "time" }));
        else if (n.localName === "CalendarTrigger") {
          if (n.getElementsByTagName("ScheduleByWeek")[0]) { const dw = n.getElementsByTagName("DaysOfWeek")[0]; o.triggers.push(Object.assign(base, { type: "weekly", every: +q(n, "WeeksInterval") || 1, days: dw ? [...dw.children].map((d) => DAYS.indexOf(d.localName)).filter((x) => x >= 0) : [] })); }
          else o.triggers.push(Object.assign(base, { type: "daily", every: +q(n, "DaysInterval") || 1 }));
        } else if (n.localName === "LogonTrigger") o.triggers.push(Object.assign(base, { type: "logon" }));
        else if (n.localName === "BootTrigger") o.triggers.push(Object.assign(base, { type: "startup" }));
        else if (n.localName === "IdleTrigger") o.triggers.push(Object.assign(base, { type: "idle", idleMin: 10 }));
        else if (n.localName === "EventTrigger") { const sub = q(n, "Subscription"); o.triggers.push(Object.assign(base, { type: "event", log: (sub.match(/Path="([^"]+)"/) || [])[1] || "", source: (sub.match(/Provider\[@Name='([^']+)'\]/) || [])[1] || "", eventId: +((sub.match(/EventID=(\d+)/) || [])[1] || 0) || "" })); }
      });
      const acs = doc.getElementsByTagName("Actions")[0];
      [...(acs ? acs.children : [])].forEach((n) => {
        if (n.localName === "Exec") {
          const cmd = q(n, "Command"), args = q(n, "Arguments");
          if (/^cmd(\.exe)?$/i.test(cmd) && /^\/c /i.test(args)) o.actions.push({ type: "cmd", shell: "cmd", line: args.slice(3) });
          else if (/^powershell(\.exe)?$/i.test(cmd) && /Checkpoint-Computer/i.test(args)) o.actions.push({ type: "restore", desc: (args.match(/-Description "([^"]*)"/) || [])[1] || "Scheduled restore point" });
          else if (/^powershell(\.exe)?$/i.test(cmd)) o.actions.push({ type: "cmd", shell: "ps", line: args.replace(/^-Command /i, "") });
          else o.actions.push({ type: "app", program: cmd, args });
        } else if (n.localName === "ShowMessage") o.actions.push({ type: "msg", title: q(n, "Title"), text: q(n, "Body") });
      });
      const st = doc.getElementsByTagName("Settings")[0];
      if (st) {
        o.enabled = q(st, "Enabled") !== "false"; o.hidden = q(st, "Hidden") === "true";
        o.settings = { startWhenAvailable: q(st, "StartWhenAvailable") === "true", allowDemand: q(st, "AllowStartOnDemand") !== "false", stopAfter: +((q(st, "ExecutionTimeLimit").match(/PT(\d+)M/) || [])[1] || (/PT(\d+)H/.test(q(st, "ExecutionTimeLimit")) ? +q(st, "ExecutionTimeLimit").match(/PT(\d+)H/)[1] * 60 : 0)) };
        o.conditions = { acOnly: q(st, "DisallowStartIfOnBatteries") === "true", idleOnly: q(st, "RunOnlyIfIdle") === "true", idleMin: +((q(st, "Duration").match(/PT(\d+)M/) || [])[1] || 10) };
      }
      o.highest = /HighestAvailable/.test(q(doc, "RunLevel"));
      return o;
    }
    function exportTask(t) { download(new Blob([toXML(t)], { type: "application/xml" }), t.name + ".xml"); }

    return {
      R, resultText, hex, DAYS, TRIG_NAMES, store, tasks, byId, byName, fullName, nextOf, taskNext, trigText, actText,
      runTask, endTask, isRunning: (t) => running.has(t.id), add, update, remove, setEnabled, toXML, fromXML, exportTask, start, tick,
      on(fn) { listeners.add(fn); return () => listeners.delete(fn); }, emit, mkTask,
    };
  })();

  // ---------------- Task Scheduler UI ----------------
  const TSUI = (function () {
    const TS = TaskSched;
    const pad = (n) => String(n).padStart(2, "0");
    const dateVal = (ts) => { const d = new Date(ts); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
    const timeVal = (ts) => { const d = new Date(ts); return pad(d.getHours()) + ":" + pad(d.getMinutes()); };
    const joinDT = (dv, tv) => { const [y, m, d] = String(dv).split("-").map(Number), [h, mi] = String(tv || "0:0").split(":").map(Number); const x = new Date(y || 2026, (m || 1) - 1, d || 1, h || 0, mi || 0, 0, 0); return x.getTime(); };
    const nextHour = () => { const d = new Date(); d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 1); return d.getTime(); };
    const appChoices = () => {
      let list = [];
      try { list = window.SysTools && SysTools.installedList ? SysTools.installedList().map((a) => [a.id, a.name]) : []; } catch (_) {}
      return list.length ? list : [["notepad", "Notepad"], ["calculator", "Calculator"], ["fileexplorer", "File Explorer"], ["settings", "Settings"]];
    };

    // A sheet (modal panel) inside the Task Scheduler window. tabs: [{ id, name, render(host) }]
    function sheet(host, title, opts) {
      return new Promise((resolve) => {
        const m = el(`<div class="su-sheet-dim"><div class="su-sheet ${opts.small ? "small" : ""}" role="dialog" aria-label="${esc(title)}"><div class="su-sheet-h"><span>${esc(title)}</span><button type="button" class="su-wiz-x" aria-label="Close">✕</button></div>${opts.tabs ? `<div class="st-tabs su-sheet-tabs">${opts.tabs.map((t, i) => `<button type="button" data-t="${i}" class="${i ? "" : "on"}">${esc(t.name)}</button>`).join("")}</div>` : ""}<div class="su-sheet-b"></div><div class="su-sheet-f"><span class="su-wiz-err" role="alert"></span><span class="su-grow"></span><button type="button" class="su-btn su-btn-pri" data-a="ok">OK</button><button type="button" class="su-btn" data-a="cancel">Cancel</button></div></div></div>`);
        const b = m.querySelector(".su-sheet-b"), err = m.querySelector(".su-wiz-err");
        const panes = (opts.tabs || [{ render: opts.render }]).map((t) => { const p = el(`<div class="su-pane"></div>`); b.appendChild(p); t.render(p); return p; });
        panes.forEach((p, i) => { p.hidden = i !== 0; });
        m.querySelectorAll("[data-t]").forEach((x) => x.onclick = () => { m.querySelectorAll("[data-t]").forEach((y) => y.classList.toggle("on", y === x)); panes.forEach((p, i) => { p.hidden = i !== +x.dataset.t; }); });
        const close = (v) => { m.remove(); resolve(v); };
        m.querySelector('[data-a="cancel"]').onclick = () => close(null);
        m.querySelector(".su-wiz-x").onclick = () => close(null);
        m.querySelector('[data-a="ok"]').onclick = () => { err.textContent = ""; const r = opts.ok ? opts.ok((t) => { err.textContent = t; }) : true; if (r !== false) close(r); };
        m.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); close(null); } });
        (host.closest(".win") || host).appendChild(m);
        setTimeout(() => { const f = m.querySelector("input:not([type=checkbox]):not([type=radio]),select"); if (f && !("ontouchstart" in window)) try { f.focus(); } catch (_) {} }, 30);
      });
    }

    // ---- trigger editor ----
    function trigForm(p, tr) {
      tr = Object.assign({ type: "daily", start: nextHour(), every: 1, days: [new Date().getDay()], idleMin: 10, log: "System", source: "", eventId: "", delayMin: 0, enabled: true }, tr || {});
      const sched = ["time", "daily", "weekly"].includes(tr.type);
      p.innerHTML = `<div class="su-form">
        <label>Begin the task:<select class="su-input" data-f="begin"><option value="sched">On a schedule</option><option value="logon">At log on</option><option value="startup">At startup</option><option value="idle">On idle</option><option value="event">On an event</option></select></label>
        <fieldset class="su-fs" data-g="sched"><legend>Settings</legend>
          <div class="su-radios"><label><input type="radio" name="su-rec" value="time"> One time</label><label><input type="radio" name="su-rec" value="daily"> Daily</label><label><input type="radio" name="su-rec" value="weekly"> Weekly</label></div>
          <div class="su-row2"><label>Start:<input type="date" class="su-input" data-f="d" value="${dateVal(tr.start)}"></label><label>&nbsp;<input type="time" class="su-input" data-f="t" value="${timeVal(tr.start)}"></label></div>
          <label data-g="every">Recur every:<span class="su-inl"><input type="number" min="1" max="365" class="su-input su-num" data-f="every" value="${tr.every || 1}"> <span data-g="unit">days</span></span></label>
          <div class="su-days" data-g="days">${TS.DAYS.map((d, i) => `<label><input type="checkbox" value="${i}" ${(tr.days || []).includes(i) ? "checked" : ""}> ${d}</label>`).join("")}</div>
        </fieldset>
        <fieldset class="su-fs" data-g="idle"><legend>On idle</legend><label>Start when the computer has been idle for:<select class="su-input" data-f="idleMin">${[1, 5, 10, 15, 30, 60].map((n) => `<option value="${n}" ${+tr.idleMin === n ? "selected" : ""}>${n} minute${n > 1 ? "s" : ""}</option>`).join("")}</select></label></fieldset>
        <fieldset class="su-fs" data-g="event"><legend>On an event</legend>
          <label>Log:<select class="su-input" data-f="log"><option value="">Any</option>${["Application", "Security", "Setup", "System"].map((l) => `<option ${tr.log === l ? "selected" : ""}>${l}</option>`).join("")}</select></label>
          <label>Source:<input class="su-input" data-f="source" value="${esc(tr.source || "")}" placeholder="e.g. Microsoft-Windows-Kernel-Power"></label>
          <label>Event ID:<input class="su-input su-num" type="number" data-f="eventId" value="${esc(tr.eventId || "")}" placeholder="e.g. 42"></label></fieldset>
        <fieldset class="su-fs" data-g="delay"><legend>Advanced settings</legend><label>Delay task for:<select class="su-input" data-f="delayMin">${[0, 1, 5, 10, 15, 30].map((n) => `<option value="${n}" ${+tr.delayMin === n ? "selected" : ""}>${n ? n + " minute" + (n > 1 ? "s" : "") : "No delay"}</option>`).join("")}</select></label></fieldset>
        <label class="su-chk"><input type="checkbox" data-f="enabled" ${tr.enabled !== false ? "checked" : ""}> Enabled</label></div>`;
      const $ = (s) => p.querySelector(s);
      $('[data-f="begin"]').value = sched ? "sched" : tr.type;
      p.querySelectorAll('[name="su-rec"]').forEach((r) => { r.checked = r.value === (sched ? tr.type : "daily"); });
      const sync = () => {
        const b = $('[data-f="begin"]').value, rec = (p.querySelector('[name="su-rec"]:checked') || {}).value;
        $('[data-g="sched"]').hidden = b !== "sched"; $('[data-g="idle"]').hidden = b !== "idle"; $('[data-g="event"]').hidden = b !== "event"; $('[data-g="delay"]').hidden = !(b === "logon" || b === "startup");
        $('[data-g="every"]').hidden = rec === "time"; $('[data-g="days"]').hidden = rec !== "weekly"; $('[data-g="unit"]').textContent = rec === "weekly" ? "weeks on:" : "days";
      };
      p.querySelectorAll("select,input").forEach((x) => x.addEventListener("change", sync)); sync();
      return () => {
        const b = $('[data-f="begin"]').value, rec = (p.querySelector('[name="su-rec"]:checked') || {}).value || "daily";
        const out = { id: tr.id, enabled: $('[data-f="enabled"]').checked, type: b === "sched" ? rec : b };
        if (b === "sched") { out.start = joinDT($('[data-f="d"]').value, $('[data-f="t"]').value); out.every = Math.max(1, +$('[data-f="every"]').value || 1); if (rec === "weekly") { out.days = [...p.querySelectorAll('[data-g="days"] input:checked')].map((x) => +x.value); if (!out.days.length) throw new Error("Pick at least one day of the week."); } }
        if (b === "idle") out.idleMin = +$('[data-f="idleMin"]').value;
        if (b === "event") { out.log = $('[data-f="log"]').value; out.source = $('[data-f="source"]').value.trim(); out.eventId = +$('[data-f="eventId"]').value || ""; if (!out.source && !out.eventId) throw new Error("Give an event source or an event ID."); }
        if (b === "logon" || b === "startup") out.delayMin = +$('[data-f="delayMin"]').value;
        return out;
      };
    }
    // ---- action editor ----
    function actForm(p, a) {
      a = Object.assign({ type: "app", program: "", args: "", title: "", text: "", shell: "cmd", line: "", desc: "" }, a || {});
      p.innerHTML = `<div class="su-form">
        <label>Action:<select class="su-input" data-f="type"><option value="app">Start a program</option><option value="msg">Display a message (deprecated)</option><option value="cmd">Run a terminal command</option><option value="restore">Create a restore point</option>${a.type === "internal" ? `<option value="internal">Custom handler (built-in)</option>` : ""}</select></label>
        <div data-g="app"><label>Program/script:<input class="su-input" data-f="program" list="su-ts-apps" value="${esc(a.program)}" placeholder="e.g. notepad, calc, taskschd.msc, Documents\\Notes.txt"></label>
          <datalist id="su-ts-apps">${appChoices().map(([id, n]) => `<option value="${esc(id)}">${esc(n)}</option>`).join("")}</datalist>
          <label>Browse installed apps:<select class="su-input" data-f="pick"><option value="">—</option>${appChoices().map(([id, n]) => `<option value="${esc(id)}">${esc(n)}</option>`).join("")}</select></label>
          <label>Add arguments (optional):<input class="su-input" data-f="args" value="${esc(a.args)}"></label></div>
        <div data-g="msg"><label>Title:<input class="su-input" data-f="title" value="${esc(a.title)}"></label><label>Message:<textarea class="su-input" rows="3" data-f="text">${esc(a.text)}</textarea></label></div>
        <div data-g="cmd"><label>Shell:<select class="su-input" data-f="shell"><option value="cmd">Command Prompt</option><option value="ps">PowerShell</option></select></label><label>Command (one per line):<textarea class="su-input su-mono" rows="3" data-f="line" placeholder="echo Hello > %USERPROFILE%\\Documents\\hello.txt">${esc(a.line)}</textarea></label><p class="su-dim">Runs in a hidden Terminal session on this PC's real files. The output is kept in the task's History.</p></div>
        <div data-g="restore"><label>Restore point description:<input class="su-input" data-f="desc" value="${esc(a.desc)}" placeholder="Scheduled restore point"></label></div>
        <div data-g="internal"><p class="su-dim">${esc(TS.actText(a))}</p></div></div>`;
      const $ = (s) => p.querySelector(s);
      $('[data-f="type"]').value = a.type; $('[data-f="shell"]').value = a.shell || "cmd";
      $('[data-f="pick"]').onchange = (e) => { if (e.target.value) $('[data-f="program"]').value = e.target.value; };
      const sync = () => { const t = $('[data-f="type"]').value; ["app", "msg", "cmd", "restore", "internal"].forEach((g) => { $(`[data-g="${g}"]`).hidden = g !== t; }); };
      $('[data-f="type"]').onchange = sync; sync();
      return () => {
        const t = $('[data-f="type"]').value, v = (k) => $(`[data-f="${k}"]`).value;
        if (t === "app") { if (!v("program").trim()) throw new Error("Type a program or pick an app."); return { type: t, program: v("program").trim(), args: v("args").trim() }; }
        if (t === "msg") { if (!v("text").trim()) throw new Error("Type a message."); return { type: t, title: v("title").trim(), text: v("text") }; }
        if (t === "cmd") { if (!v("line").trim()) throw new Error("Type a command."); return { type: t, shell: v("shell"), line: v("line") }; }
        if (t === "restore") return { type: t, desc: v("desc").trim() || "Scheduled restore point" };
        return a;
      };
    }

    // ---- Create Task / Properties ----
    function taskDialog(host, t) {
      const isNew = !t;
      const d = JSON.parse(JSON.stringify(t || TS.mkTask({ name: "New Task", folder: (host.__tsFolder || "\\") })));
      let readTrigs = null;
      const tabs = [
        { name: "General", render(p) {
          p.innerHTML = `<div class="su-form">
            <label>Name:<input class="su-input" data-f="name" value="${esc(d.name)}"></label>
            <label>Location:<input class="su-input" value="${esc(d.folder)}" readonly></label>
            <label>Author:<input class="su-input" value="${esc(d.author)}" readonly></label>
            <label>Description:<textarea class="su-input" rows="3" data-f="desc">${esc(d.desc)}</textarea></label>
            <fieldset class="su-fs"><legend>Security options</legend><p class="su-dim">When running the task, use the following user account: <b>${esc(userName())}</b></p>
              <label class="su-chk"><input type="radio" checked> Run only when user is logged on</label>
              <label class="su-chk su-off"><input type="radio" disabled> Run whether user is logged on or not (not available: tasks run while this page is open)</label>
              <label class="su-chk"><input type="checkbox" data-f="highest" ${d.highest ? "checked" : ""}> Run with highest privileges</label></fieldset>
            <label class="su-chk"><input type="checkbox" data-f="hidden" ${d.hidden ? "checked" : ""}> Hidden</label>
            <label class="su-chk"><input type="checkbox" data-f="enabled" ${d.enabled ? "checked" : ""}> Enabled</label></div>`;
          p.oninput = p.onchange = () => { d.name = p.querySelector('[data-f="name"]').value; d.desc = p.querySelector('[data-f="desc"]').value; d.highest = p.querySelector('[data-f="highest"]').checked; d.hidden = p.querySelector('[data-f="hidden"]').checked; d.enabled = p.querySelector('[data-f="enabled"]').checked; };
        } },
        { name: "Triggers", render(p) { listEditor(p, d.triggers, "trigger", (x) => TS.TRIG_NAMES[x.type] || x.type, (x) => TS.trigText(x), (x) => x.enabled === false ? "Disabled" : "Enabled", trigForm); readTrigs = () => d.triggers; } },
        { name: "Actions", render(p) { listEditor(p, d.actions, "action", (x) => ({ app: "Start a program", msg: "Display a message", cmd: "Run a command", restore: "Restore point", internal: "Custom Handler" }[x.type]), (x) => TS.actText(x).replace(/^[^:]+: /, ""), null, actForm); } },
        { name: "Conditions", render(p) {
          p.innerHTML = `<div class="su-form"><p class="su-dim">Specify the conditions that, along with the trigger, determine whether the task should run.</p>
            <fieldset class="su-fs"><legend>Idle</legend><label class="su-chk"><input type="checkbox" data-f="idleOnly" ${d.conditions.idleOnly ? "checked" : ""}> Start the task only if the computer is idle for:</label>
              <select class="su-input" data-f="idleMin">${[1, 5, 10, 15, 30, 60].map((n) => `<option value="${n}" ${+d.conditions.idleMin === n ? "selected" : ""}>${n} minute${n > 1 ? "s" : ""}</option>`).join("")}</select></fieldset>
            <fieldset class="su-fs"><legend>Power</legend><label class="su-chk"><input type="checkbox" data-f="acOnly" ${d.conditions.acOnly ? "checked" : ""}> Start the task only if the computer is on AC power</label><p class="su-dim">${PowerPlans.batteryKnown() ? "This device reports its battery (it's " + (PowerPlans.onBattery() ? "on battery" : "plugged in") + ")." : "This browser doesn't report the battery, so the PC counts as plugged in."}</p>
              <label class="su-chk su-off"><input type="checkbox" disabled> Wake the computer to run this task (a web page can't wake the device)</label></fieldset></div>`;
          p.onchange = () => { d.conditions.idleOnly = p.querySelector('[data-f="idleOnly"]').checked; d.conditions.idleMin = +p.querySelector('[data-f="idleMin"]').value; d.conditions.acOnly = p.querySelector('[data-f="acOnly"]').checked; };
        } },
        { name: "Settings", render(p) {
          p.innerHTML = `<div class="su-form"><p class="su-dim">Specify additional settings that affect the behavior of the task.</p>
            <label class="su-chk"><input type="checkbox" data-f="allowDemand" ${d.settings.allowDemand !== false ? "checked" : ""}> Allow task to be run on demand</label>
            <label class="su-chk"><input type="checkbox" data-f="swa" ${d.settings.startWhenAvailable ? "checked" : ""}> Run task as soon as possible after a scheduled start is missed</label>
            <label>Stop the task if it runs longer than:<select class="su-input" data-f="stopAfter">${[[0, "Never (no limit)"], [1, "1 minute"], [5, "5 minutes"], [30, "30 minutes"], [60, "1 hour"], [240, "4 hours"], [1440, "1 day"], [4320, "3 days"]].map(([v, l]) => `<option value="${v}" ${+d.settings.stopAfter === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
            <label class="su-chk"><input type="checkbox" checked disabled> If the running task does not end when requested, force it to stop</label>
            <label>If the task is already running, then the following rule applies:<select class="su-input" disabled><option>Do not start a new instance</option></select></label></div>`;
          p.onchange = () => { d.settings.allowDemand = p.querySelector('[data-f="allowDemand"]').checked; d.settings.startWhenAvailable = p.querySelector('[data-f="swa"]').checked; d.settings.stopAfter = +p.querySelector('[data-f="stopAfter"]').value; };
        } },
      ];
      void readTrigs;
      return sheet(host, isNew ? "Create Task" : (d.name + " Properties (Local Computer)"), { tabs, ok: (err) => {
        if (!d.name.trim() || /[\\/:*?"<>|]/.test(d.name)) { err("Type a valid task name (it can't contain \\ / : * ? \" < > |)."); return false; }
        const dup = TS.tasks().find((x) => x !== t && x.folder === d.folder && x.name.toLowerCase() === d.name.trim().toLowerCase());
        if (dup) { err("A task with this name already exists in " + d.folder + "."); return false; }
        if (!d.actions.length) { err("You must specify at least one action for this task."); return false; }
        d.name = d.name.trim();
        if (isNew) { delete d.id; return TS.add(d); }
        TS.update(t, { name: d.name, desc: d.desc, highest: d.highest, hidden: d.hidden, enabled: d.enabled, triggers: d.triggers, actions: d.actions, conditions: d.conditions, settings: d.settings });
        return t;
      } });
    }
    function listEditor(p, arr, what, col1, col2, col3, form) {
      const paint = () => {
        p.innerHTML = `<p class="su-dim">${what === "trigger" ? "When you create a task, you can specify the conditions that will trigger the task." : "When you create a task, you must specify the action that will occur when your task starts."}</p>
          <div class="st-tablewrap su-ts-mini"><table class="st-table"><thead><tr><th>${what === "trigger" ? "Trigger" : "Action"}</th><th>Details</th>${col3 ? "<th>Status</th>" : ""}</tr></thead><tbody>${arr.map((x, i) => `<tr data-i="${i}"><td>${esc(col1(x))}</td><td>${esc(col2(x))}</td>${col3 ? `<td>${esc(col3(x))}</td>` : ""}</tr>`).join("") || `<tr><td colspan="3" class="su-dim">No ${what}s yet.</td></tr>`}</tbody></table></div>
          <div class="su-btnrow"><button type="button" class="su-btn" data-a="new">New…</button><button type="button" class="su-btn" data-a="edit" disabled>Edit…</button><button type="button" class="su-btn" data-a="del" disabled>Delete</button></div>`;
        let sel = -1;
        p.querySelectorAll("tr[data-i]").forEach((r) => { r.onclick = () => { sel = +r.dataset.i; p.querySelectorAll("tr[data-i]").forEach((x) => x.classList.toggle("sel", x === r)); p.querySelector('[data-a="edit"]').disabled = p.querySelector('[data-a="del"]').disabled = false; }; r.ondblclick = () => edit(+r.dataset.i); });
        const edit = (i) => { let read; sheet(p, (i >= 0 ? "Edit " : "New ") + (what === "trigger" ? "Trigger" : "Action"), { small: true, render: (h) => { read = form(h, i >= 0 ? arr[i] : null); }, ok: (err) => { try { const v = read(); if (i >= 0) arr[i] = v; else arr.push(v); return true; } catch (e) { err(e.message); return false; } } }).then((r) => { if (r) paint(); }); };
        p.querySelector('[data-a="new"]').onclick = () => edit(-1);
        p.querySelector('[data-a="edit"]').onclick = () => { if (sel >= 0) edit(sel); };
        p.querySelector('[data-a="del"]').onclick = () => { if (sel >= 0) { arr.splice(sel, 1); paint(); } };
      };
      paint();
    }

    // ---- Basic Task wizard ----
    async function basicTask(host) {
      const tr = { type: "daily", start: nextHour(), every: 1, days: [new Date().getDay()] };
      const ac = { type: "app" };
      let readTr = null, readAc = null;
      const kinds = [["daily", "Daily"], ["weekly", "Weekly"], ["time", "One time"], ["startup", "When the computer starts"], ["logon", "When I log on"], ["event", "When a specific event is logged"], ["idle", "When the computer is idle"]];
      const data = await wizard({
        title: "Create Basic Task Wizard", icon: ic("task", 18), side: true, host: host.closest(".win") || host, data: { name: "", desc: "" },
        steps: [
          { name: "Create a Basic Task", render(api) {
            api.body.innerHTML = `<h2 class="su-h2">Create a Basic Task</h2><p class="su-dim">Use this wizard to quickly schedule a common task. For more advanced options or settings such as multiple task actions or triggers, use the Create Task command in the Actions pane.</p>
              <div class="su-form"><label>Name:<input class="su-input" data-f="name" value="${esc(api.data.name)}"></label><label>Description:<textarea class="su-input" rows="3" data-f="desc">${esc(api.data.desc)}</textarea></label></div>`;
            api.body.oninput = () => { api.data.name = api.body.querySelector('[data-f="name"]').value; api.data.desc = api.body.querySelector('[data-f="desc"]').value; };
          }, validate(api) { if (!api.data.name.trim() || /[\\/:*?"<>|]/.test(api.data.name)) { api.error("Type a valid task name."); return false; } if (TS.tasks().some((x) => x.folder === (host.__tsFolder || "\\") && x.name.toLowerCase() === api.data.name.trim().toLowerCase())) { api.error("A task with this name already exists."); return false; } return true; } },
          { name: "Trigger", render(api) {
            api.body.innerHTML = `<h2 class="su-h2">When do you want the task to start?</h2><div class="su-radios su-col">${kinds.map(([v, l]) => `<label><input type="radio" name="su-bt" value="${v}" ${tr.type === v ? "checked" : ""}> ${l}</label>`).join("")}</div>`;
            api.body.onchange = () => { tr.type = (api.body.querySelector('[name="su-bt"]:checked') || {}).value || "daily"; };
          } },
          { name: "Details", render(api) {
            api.body.innerHTML = `<h2 class="su-h2">${esc((kinds.find((k) => k[0] === tr.type) || [, ""])[1])}</h2><div class="su-bt-form"></div>`;
            readTr = trigForm(api.body.querySelector(".su-bt-form"), tr);
            const begin = api.body.querySelector('[data-f="begin"]'); if (begin) begin.closest("label").hidden = true;
            api.body.querySelectorAll('[name="su-rec"]').forEach((r) => { r.closest(".su-radios").hidden = true; });
          }, validate(api) { try { Object.assign(tr, readTr()); return true; } catch (e) { api.error(e.message); return false; } } },
          { name: "Action", render(api) {
            api.body.innerHTML = `<h2 class="su-h2">What action do you want the task to perform?</h2><div class="su-radios su-col">
              <label><input type="radio" name="su-ba" value="app" ${ac.type === "app" ? "checked" : ""}> Start a program</label>
              <label class="su-off"><input type="radio" disabled> Send an e-mail (deprecated)</label>
              <label><input type="radio" name="su-ba" value="msg" ${ac.type === "msg" ? "checked" : ""}> Display a message (deprecated)</label>
              <label><input type="radio" name="su-ba" value="cmd" ${ac.type === "cmd" ? "checked" : ""}> Run a terminal command</label>
              <label><input type="radio" name="su-ba" value="restore" ${ac.type === "restore" ? "checked" : ""}> Create a restore point</label></div>`;
            api.body.onchange = () => { ac.type = (api.body.querySelector('[name="su-ba"]:checked') || {}).value || "app"; };
          } },
          { name: "Action details", render(api) {
            api.body.innerHTML = `<h2 class="su-h2">${esc({ app: "Start a Program", msg: "Display a Message", cmd: "Run a Terminal Command", restore: "Create a Restore Point" }[ac.type])}</h2><div class="su-ba-form"></div>`;
            readAc = actForm(api.body.querySelector(".su-ba-form"), ac);
            api.body.querySelector('[data-f="type"]').closest("label").hidden = true;
          }, validate(api) { try { Object.assign(ac, readAc()); return true; } catch (e) { api.error(e.message); return false; } } },
          { name: "Finish", next: "Finish", render(api) {
            api.body.innerHTML = `<h2 class="su-h2">Summary</h2><table class="su-kv"><tr><td>Name:</td><td>${esc(api.data.name)}</td></tr><tr><td>Description:</td><td>${esc(api.data.desc)}</td></tr><tr><td>Trigger:</td><td>${esc(TS.trigText(tr))}</td></tr><tr><td>Action:</td><td>${esc(TS.actText(ac))}</td></tr></table>
              <label class="su-chk"><input type="checkbox" data-f="props"> Open the Properties dialog for this task when I click Finish</label><p class="su-dim">When you click Finish, the new task will be created and added to your Windows schedule.</p>`;
            api.body.onchange = () => { api.data.props = api.body.querySelector('[data-f="props"]').checked; };
          } },
        ],
      });
      if (!data) return null;
      const t = TS.add({ name: data.name.trim(), desc: data.desc, folder: host.__tsFolder || "\\", triggers: [Object.assign({}, tr)], actions: [Object.assign({}, ac)], settings: { startWhenAvailable: ["daily", "weekly", "time"].includes(tr.type) } });
      if (data.props) taskDialog(host, t);
      return t;
    }

    // ---- the app window ----
    function open() {
      const ref = WM.createWindow({ title: "Task Scheduler", icon: Icon.mini("taskschd", "Task Scheduler"), width: Math.min(1060, innerWidth - 24), height: Math.min(660, innerHeight - 80), appId: "taskschd" });
      const body = ref.body; body.classList.add("st-host");
      body.innerHTML = `<div class="st-app su-ts">
        <div class="st-menubar"><button data-m="file">File</button><button data-m="action">Action</button><button data-m="view">View</button><button data-m="help">Help</button></div>
        <div class="st-toolbar">
          <button class="st-tb" data-a="basic">${ic("plus", 16)}<span>Create Basic Task…</span></button>
          <button class="st-tb" data-a="create">${ic("task", 16)}<span>Create Task…</span></button>
          <button class="st-tb" data-a="run" disabled>${ic("play", 16)}<span>Run</span></button>
          <button class="st-tb" data-a="end" disabled>${ic("stop", 16)}<span>End</span></button>
          <button class="st-tb" data-a="toggle" disabled>${ic("power", 16)}<span>Disable</span></button>
          <button class="st-tb" data-a="props" disabled>${ic("edit", 16)}<span>Properties</span></button>
          <button class="st-tb" data-a="export" disabled>${ic("export", 16)}<span>Export…</span></button>
          <button class="st-tb" data-a="del" disabled>${ic("trash", 16)}<span>Delete</span></button>
          <button class="st-tb" data-a="refresh">${ic("refresh", 16)}<span>Refresh</span></button>
        </div>
        <div class="su-ts-main"><div class="st-tree su-ts-tree"></div><div class="su-ts-center"></div><div class="su-ts-actions"></div></div>
        <div class="st-status"></div></div>`;
      const $ = (s) => body.querySelector(s);
      let folder = "lib:\\", selId = null, tab = "general";
      body.__tsFolder = "\\";
      const cur = () => (selId ? TS.byId(selId) : null);
      const folders = () => TS.store().folders.slice().sort((a, b) => a.localeCompare(b));
      function paintTree() {
        const t = $(".su-ts-tree");
        const rows = [`<div class="st-tn st-tn-root ${folder === "root" ? "sel" : ""}" data-f="root" tabindex="0">${ic("clock", 16)}<span>Task Scheduler (Local)</span></div>`];
        folders().forEach((f) => {
          const depth = f === "\\" ? 0 : f.split("\\").filter(Boolean).length;
          const name = f === "\\" ? "Task Scheduler Library" : f.split("\\").filter(Boolean).pop();
          rows.push(`<div class="st-tn ${folder === "lib:" + f ? "sel" : ""}" style="padding-left:${22 + depth * 16}px" data-f="lib:${esc(f)}" tabindex="0">${ic("folder", 15)}<span>${esc(name)}</span><em>${TS.tasks().filter((x) => x.folder === f).length || ""}</em></div>`);
        });
        t.innerHTML = rows.join("");
        t.querySelectorAll("[data-f]").forEach((n) => { const go = () => { folder = n.dataset.f; body.__tsFolder = folder.startsWith("lib:") ? folder.slice(4) : "\\"; selId = null; paint(); }; n.onclick = go; n.onkeydown = (e) => { if (e.key === "Enter") go(); }; });
      }
      const status = (t) => (TS.isRunning(t) ? "Running" : t.enabled ? "Ready" : "Disabled");
      function paintCenter() {
        const c = $(".su-ts-center");
        if (folder === "root") {
          const all = TS.tasks(), day = now() - DAY;
          const ran = all.filter((t) => t.state.lastRun > day), active = all.filter((t) => t.enabled && TS.taskNext(t)).sort((a, b) => TS.taskNext(a) - TS.taskNext(b));
          c.innerHTML = `<div class="su-ts-sum st-scroll"><h2 class="su-h2">Overview of Task Scheduler</h2><p class="su-dim">You can use Task Scheduler to create and manage common tasks that your computer will carry out automatically at the times you specify. Tasks are stored in the Task Scheduler Library. Tasks run while Windows 12 is open in this browser; a start that's missed while it's closed can run as soon as it opens again.</p>
            <h3 class="su-h3">Task Status</h3><p class="su-dim">Status of tasks that have started in the last 24 hours: ${ran.length} total — ${ran.filter((t) => t.state.lastResult === 0).length} succeeded, ${ran.filter((t) => t.state.lastResult !== 0 && t.state.lastResult !== TS.R.RUNNING).length} stopped or failed, ${ran.filter((t) => TS.isRunning(t)).length} running</p>
            <div class="st-tablewrap"><table class="st-table"><thead><tr><th>Task Name</th><th>Run Result</th><th>Run Start</th></tr></thead><tbody>${ran.map((t) => `<tr><td>${esc(TS.fullName(t))}</td><td>${esc(TS.resultText(t.state.lastResult))}</td><td>${esc(fmtWhen(t.state.lastRun))}</td></tr>`).join("") || `<tr><td colspan="3" class="su-dim">No tasks have run in the last 24 hours.</td></tr>`}</tbody></table></div>
            <h3 class="su-h3">Active Tasks</h3><div class="st-tablewrap"><table class="st-table"><thead><tr><th>Task Name</th><th>Next Run Time</th><th>Triggers</th><th>Location</th></tr></thead><tbody>${active.map((t) => `<tr><td>${esc(t.name)}</td><td>${esc(fmtWhen(TS.taskNext(t)))}</td><td>${esc(t.triggers.map(TS.trigText).join("; "))}</td><td>${esc(t.folder)}</td></tr>`).join("")}</tbody></table></div></div>`;
          return;
        }
        const f = folder.slice(4), list = TS.tasks().filter((t) => t.folder === f);
        const t = cur();
        c.innerHTML = `<div class="su-ts-list st-scroll"><table class="st-table"><thead><tr><th>Name</th><th>Status</th><th>Triggers</th><th>Next Run Time</th><th>Last Run Time</th><th>Last Run Result</th><th class="su-col-opt">Author</th><th class="su-col-opt">Created</th></tr></thead><tbody>
          ${list.map((x) => `<tr data-id="${x.id}" class="${x.id === selId ? "sel" : ""}" tabindex="0"><td>${ic("task", 14)} ${esc(x.name)}</td><td>${status(x)}</td><td>${esc(x.triggers.length > 1 ? "Multiple triggers defined" : x.triggers[0] ? TS.trigText(x.triggers[0]) : "")}</td><td>${TS.taskNext(x) ? esc(fmtWhen(TS.taskNext(x))) : ""}</td><td>${x.state.lastRun ? esc(fmtWhen(x.state.lastRun)) : "Never"}</td><td>${esc(TS.resultText(x.state.lastResult))}</td><td class="su-col-opt">${esc(x.author)}</td><td class="su-col-opt">${esc(fmtWhen(x.created))}</td></tr>`).join("") || `<tr><td colspan="8" class="su-dim">There are no tasks in this folder.</td></tr>`}
        </tbody></table></div><div class="su-ts-detail">${t ? detail(t) : `<div class="su-dim su-pad">Select a task to see its details.</div>`}</div>`;
        const bindTabs = () => c.querySelectorAll(".su-ts-dtabs [data-t]").forEach((b) => b.onclick = () => { tab = b.dataset.t; const dt = c.querySelector(".su-ts-detail"), x = cur(); if (dt && x) { dt.innerHTML = detail(x); bindTabs(); } });
        c.querySelectorAll("tr[data-id]").forEach((r) => {
          // select without rebuilding the table, so a double-click still lands on the same row
          r.onclick = () => { if (selId === r.dataset.id) return; selId = r.dataset.id; c.querySelectorAll("tr[data-id]").forEach((x) => x.classList.toggle("sel", x === r)); const dt = c.querySelector(".su-ts-detail"), x = cur(); if (dt && x) { dt.innerHTML = detail(x); bindTabs(); } paintActions(); };
          r.ondblclick = () => { const x = TS.byId(r.dataset.id); if (x) taskDialog(body, x).then(() => paint()); };
          r.onkeydown = (e) => { if (e.key === "Enter") r.ondblclick(); if (e.key === "Delete") act("del"); };
        });
        bindTabs();
      }
      function detail(t) {
        const tabs = [["general", "General"], ["triggers", "Triggers"], ["actions", "Actions"], ["conditions", "Conditions"], ["settings", "Settings"], ["history", "History"]];
        let inner = "";
        if (tab === "general") inner = `<table class="su-kv"><tr><td>Name:</td><td>${esc(t.name)}</td></tr><tr><td>Location:</td><td>${esc(t.folder)}</td></tr><tr><td>Author:</td><td>${esc(t.author)}</td></tr><tr><td>Description:</td><td>${esc(t.desc)}</td></tr><tr><td>Security:</td><td>Run only when ${esc(userName())} is logged on${t.highest ? " · with highest privileges" : ""}</td></tr><tr><td>Status:</td><td>${status(t)} · Last Run Result: ${esc(TS.resultText(t.state.lastResult))}</td></tr></table>`;
        else if (tab === "triggers") inner = `<table class="st-table"><thead><tr><th>Trigger</th><th>Details</th><th>Next</th><th>Status</th></tr></thead><tbody>${t.triggers.map((x) => `<tr><td>${esc(TS.TRIG_NAMES[x.type])}</td><td>${esc(TS.trigText(x))}</td><td>${x.next ? esc(fmtWhen(x.next)) : ""}</td><td>${x.enabled === false ? "Disabled" : "Enabled"}</td></tr>`).join("")}</tbody></table>`;
        else if (tab === "actions") inner = `<table class="st-table"><thead><tr><th>Action</th><th>Details</th></tr></thead><tbody>${t.actions.map((x) => `<tr><td>${esc(TS.actText(x).split(":")[0])}</td><td>${esc(TS.actText(x).replace(/^[^:]+: /, ""))}</td></tr>`).join("")}</tbody></table>`;
        else if (tab === "conditions") inner = `<table class="su-kv"><tr><td>Idle:</td><td>${t.conditions.idleOnly ? "Start only if idle for " + t.conditions.idleMin + " minutes" : "No idle condition"}</td></tr><tr><td>Power:</td><td>${t.conditions.acOnly ? "Start only on AC power" : "Run on battery or AC power"}</td></tr></table>`;
        else if (tab === "settings") inner = `<table class="su-kv"><tr><td>Run on demand:</td><td>${t.settings.allowDemand !== false ? "Allowed" : "Not allowed"}</td></tr><tr><td>Missed start:</td><td>${t.settings.startWhenAvailable ? "Run as soon as possible after a scheduled start is missed" : "Wait for the next scheduled time"}</td></tr><tr><td>Time limit:</td><td>${t.settings.stopAfter ? "Stop after " + t.settings.stopAfter + " minutes" : "None"}</td></tr><tr><td>Instances:</td><td>Do not start a new instance</td></tr></table>`;
        else inner = TS.store().histOn ? `<table class="st-table su-ts-hist"><thead><tr><th>Level</th><th>Date and Time</th><th>Event ID</th><th>Message</th></tr></thead><tbody>${t.history.map((h) => `<tr><td>${esc(h.level)}</td><td>${esc(fmtWhen(h.ts))}</td><td>${h.id}</td><td class="su-pre">${esc(h.msg)}</td></tr>`).join("") || `<tr><td colspan="4" class="su-dim">No history yet.</td></tr>`}</tbody></table>` : `<div class="su-dim su-pad">History is disabled. Use “Enable All Tasks History” in the Actions pane.</div>`;
        return `<div class="st-tabs su-ts-dtabs">${tabs.map(([k, n]) => `<button data-t="${k}" class="${tab === k ? "on" : ""}">${n}</button>`).join("")}</div><div class="su-ts-dbody st-scroll">${inner}</div>`;
      }
      function paintActions() {
        const t = cur(), a = $(".su-ts-actions");
        const fName = folder === "root" ? "Task Scheduler (Local)" : folder === "lib:\\" ? "Task Scheduler Library" : folder.slice(4).split("\\").filter(Boolean).pop();
        const it = (k, label, icn, dis) => `<button class="su-ts-act" data-a="${k}" ${dis ? "disabled" : ""}>${ic(icn, 14)}<span>${esc(label)}</span></button>`;
        a.innerHTML = `<div class="su-ts-acth">Actions</div><div class="su-ts-actsec">${esc(fName)}</div>
          ${it("basic", "Create Basic Task…", "plus")}${it("create", "Create Task…", "task")}${it("import", "Import Task…", "import")}${it("runningall", "Display All Running Tasks", "play")}${it("hist", TS.store().histOn ? "Disable All Tasks History" : "Enable All Tasks History", "clock")}${it("newfolder", "New Folder…", "folder")}${it("delfolder", "Delete Folder", "trash", folder === "root" || folder === "lib:\\" || TS.tasks().some((x) => x.folder === folder.slice(4)))}${it("refresh", "Refresh", "refresh")}
          ${t ? `<div class="su-ts-actsec">Selected Item</div>${it("run", "Run", "play", t.settings.allowDemand === false || TS.isRunning(t))}${it("end", "End", "stop", !TS.isRunning(t))}${it("toggle", t.enabled ? "Disable" : "Enable", "power")}${it("export", "Export…", "export")}${it("props", "Properties", "edit")}${it("del", "Delete", "trash")}` : ""}`;
        a.querySelectorAll("[data-a]").forEach((b) => b.onclick = () => act(b.dataset.a));
        const tb = (k, dis) => { const b = $(`.st-toolbar [data-a="${k}"]`); if (b) b.disabled = dis; };
        tb("run", !t || t.settings.allowDemand === false || TS.isRunning(t)); tb("end", !t || !TS.isRunning(t)); tb("toggle", !t); tb("props", !t); tb("export", !t); tb("del", !t);
        const tg = $('.st-toolbar [data-a="toggle"] span'); if (tg) tg.textContent = t && !t.enabled ? "Enable" : "Disable";
      }
      function paint() {
        if (selId && !cur()) selId = null;
        paintTree(); paintCenter(); paintActions();
        const n = TS.tasks().length, r = TS.tasks().filter((t) => TS.isRunning(t)).length;
        $(".st-status").textContent = n + " task(s) · " + r + " running · tasks run while this desktop is open";
      }
      async function act(k) {
        const t = cur();
        if (k === "basic") { const x = await basicTask(body); if (x) { selId = x.id; folder = "lib:" + x.folder; } paint(); return; }
        if (k === "create") { const x = await taskDialog(body, null); if (x) { selId = x.id; folder = "lib:" + x.folder; } paint(); return; }
        if (k === "refresh") return paint();
        if (k === "hist") { TS.store().histOn = !TS.store().histOn; save(); return paint(); }
        if (k === "runningall") { const rs = TS.tasks().filter((x) => TS.isRunning(x)); alertBox("All Running Tasks", rs.length ? `<table class="su-kv">${rs.map((x) => `<tr><td>${esc(TS.fullName(x))}</td><td>started ${esc(fmtWhen(x.state.lastRun))}</td></tr>`).join("")}</table>` : "<p>No tasks are running.</p>"); return; }
        if (k === "newfolder") {
          const v = await dialog({ title: "Create Folder", html: `<label class="rc-field"><span>Name</span><input class="rc-input su-nf"></label>`, buttons: [{ label: "OK", primary: true, onClick: (api) => { const n = api.content.querySelector(".su-nf").value.trim(); if (!n || /[\\/:*?"<>|]/.test(n)) { api.error("Type a valid folder name."); return false; } return n; } }, { label: "Cancel", value: null }] });
          if (v) { const base = folder.startsWith("lib:") ? folder.slice(4) : "\\"; const f = base + v + "\\"; if (!TS.store().folders.includes(f)) TS.store().folders.push(f); save(); folder = "lib:" + f; body.__tsFolder = f; paint(); }
          return;
        }
        if (k === "delfolder") { const f = folder.slice(4); if (await confirmBox("Delete Folder", "Are you sure you want to delete the folder " + esc(f) + "?")) { const s = TS.store(); s.folders = s.folders.filter((x) => x !== f && !x.startsWith(f)); save(); folder = "lib:\\"; paint(); } return; }
        if (k === "import") {
          const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".xml,text/xml,application/xml";
          // Import opens the Create Task dialog pre-filled (like Windows).
          inp.onchange = async () => { const fl = inp.files && inp.files[0]; if (!fl) return; try { const o = TS.fromXML(await fl.text(), fl.name); o.folder = body.__tsFolder || "\\"; let nm = o.name, i = 2; while (TS.tasks().some((x) => x.folder === o.folder && x.name === nm)) nm = o.name + " (" + (i++) + ")"; o.name = nm; const x = TS.add(o); selId = x.id; paint(); taskDialog(body, x).then(() => paint()); } catch (e) { alertBox("Task Scheduler", esc(e.message)); } };
          inp.click(); return;
        }
        if (!t) return;
        if (k === "run") { TS.runTask(t, "demand"); setTimeout(paint, 50); return; }
        if (k === "end") { TS.endTask(t); return; }
        if (k === "toggle") { TS.setEnabled(t, !t.enabled); return paint(); }
        if (k === "props") { await taskDialog(body, t); return paint(); }
        if (k === "export") { TS.exportTask(t); return; }
        if (k === "del") { if (await confirmBox("Task Scheduler", "Are you sure you want to delete this task?<br><b>" + esc(TS.fullName(t)) + "</b>")) { TS.remove(t); selId = null; paint(); } return; }
      }
      body.querySelectorAll(".st-toolbar [data-a]").forEach((b) => b.onclick = () => act(b.dataset.a));
      if (window.STUI && STUI.menus) STUI.menus(body, {
        file: [["Import Task…", () => act("import")], ["Export…", () => act("export"), () => !cur()], ["-"], ["Exit", () => ref.close()]],
        action: [["Create Basic Task…", () => act("basic")], ["Create Task…", () => act("create")], ["New Folder…", () => act("newfolder")], ["-"], ["Run", () => act("run"), () => !cur()], ["End", () => act("end"), () => !cur()], ["Properties", () => act("props"), () => !cur()], ["Delete", () => act("del"), () => !cur()], ["-"], ["Refresh", () => act("refresh")]],
        view: [["Refresh", () => act("refresh")]],
        help: [["About Task Scheduler", () => alertBox("Task Scheduler", "<p>Task Scheduler for Windows 12.</p><p class='rc-dim'>Tasks run while this desktop is open in the browser (a web page can't wake the device or run while closed). Missed starts can run as soon as the desktop opens again.</p>")]],
      });
      const off = TS.on(() => { if (!body.isConnected) { off(); return; } if (!body.querySelector(".su-sheet-dim")) paint(); });
      const iv = setInterval(() => { if (!body.isConnected) { clearInterval(iv); return; } if (!body.querySelector(".su-sheet-dim, .su-wiz-dim")) paintCenter(); }, 15000);
      paint();
      return ref;
    }
    return { open, basicTask, taskDialog };
  })();

  // =====================================================================
  //  1. STORAGE SENSE + storage usage by category
  // =====================================================================
  const StorageSense = (function () {
    const listeners = new Set();
    const emit = () => listeners.forEach((f) => { try { f(); } catch (_) {} });
    function cfg() {
      const a = AD(); let c = a.storageSense;
      if (!c || typeof c !== "object") c = a.storageSense = {};
      if (c.on == null) c.on = false;
      if (!c.cadence) c.cadence = "low";          // day | week | month | low
      if (c.temp == null) c.temp = true;
      if (c.binDays == null) c.binDays = 30;      // 0 = never
      if (c.dlDays == null) c.dlDays = 0;         // 0 = never
      if (!Array.isArray(c.history)) c.history = [];
      return c;
    }
    const lsTotal = () => { try { return window.SysTools && SysTools.lsKeys ? SysTools.lsKeys().total : 0; } catch (_) { return 0; } };
    async function estimate() { try { if (navigator.storage && navigator.storage.estimate) return await navigator.storage.estimate(); } catch (_) {} return null; }
    // "During low free disk space": localStorage near its ~5 MB cap (iPad Safari) or the origin quota >90% used.
    async function lowSpace() {
      const chars = lsTotal() / 2;
      if (chars > 4.2e6) return true;
      const e = await estimate(); return !!(e && e.quota && e.usage / e.quota > 0.9);
    }
    async function isDue(c) {
      const age = now() - (c.lastRun || 0);
      if (c.cadence === "day") return age >= DAY - 5 * MIN;
      if (c.cadence === "week") return age >= 7 * DAY - 5 * MIN;
      if (c.cadence === "month") return age >= 30 * DAY - 5 * MIN;
      return lowSpace();
    }
    async function scheduled() { const c = cfg(); if (!c.on) return null; if (!(await isDue(c))) return null; return run({ reason: "schedule" }); }

    // Is this blob id used anywhere (any account's saved state, File History aliases…)? Then keep its bytes.
    function blobReferenced(id) {
      const needle = '"' + id + '"';
      try { for (let i = 0; i < localStorage.length; i++) { const v = localStorage.getItem(localStorage.key(i)); if (v && v.indexOf(needle) >= 0) return true; } } catch (_) { return true; }
      try { if (JSON.stringify(S()).indexOf(needle) >= 0) return true; } catch (_) { return true; }
      return false;
    }
    function blobIdsIn(node, out) { if (!node) return out; if (typeof node.blob === "string") out.push(node.blob); if (node.type === "folder") Object.values(node.children || {}).forEach((n) => blobIdsIn(n, out)); return out; }
    const nodeTotal = (n) => { if (!n) return 0; if (n.type === "file") return nodeBytes(n); let s = 0; Object.values(n.children || {}).forEach((x) => { s += nodeTotal(x); }); return s; };

    let busy = null;
    function run(opts) { if (busy) return busy; busy = doRun(opts || {}).finally(() => { busy = null; emit(); }); emit(); return busy; }
    async function doRun(opts) {
      const c = cfg(), t0 = now(), ls0 = lsTotal(), est0 = await estimate();
      const items = [];
      // Temporary files — the same category as Disk Cleanup.
      if (c.temp) {
        let cat = null; try { cat = window.SysTools && SysTools.cleanupCats ? SysTools.cleanupCats(false).find((x) => x.id === "temp") : null; } catch (_) {}
        if (cat && cat.count) { try { await cat.run(); } catch (_) {} items.push({ name: "Temporary files", count: cat.count, bytes: cat.bytes || 0 }); }
        else items.push({ name: "Temporary files", count: 0, bytes: 0 });
      }
      // Recycle Bin items older than N days (deleted for good) — their file bytes are freed too.
      const gcIds = [];
      if (c.binDays > 0) {
        const bin = Array.isArray(AD().fileBin) ? AD().fileBin : [];
        const cut = now() - c.binDays * DAY;
        const old = bin.filter((b) => b && (b.ts || 0) < cut);
        if (old.length) { old.forEach((b) => blobIdsIn(b.node, gcIds)); AD().fileBin = bin.filter((b) => !old.includes(b)); }
        items.push({ name: "Recycle Bin (over " + c.binDays + " days)", count: old.length, bytes: old.reduce((s, b) => s + nodeTotal(b.node), 0) });
      }
      // Downloads not opened for N days → moved to the Recycle Bin (restorable).
      if (c.dlDays > 0) {
        const cut = now() - c.dlDays * DAY, moved = [];
        const dl = root().Downloads;
        if (dl && dl.children) Object.keys(dl.children).forEach((nm) => { const n = dl.children[nm]; const t = n && (n.atime || n.ts || 0); if (n && n.type === "file" && t > 0 && t < cut && !n.readOnly) moved.push(nm); });
        let bytes = 0;
        moved.forEach((nm) => {
          bytes += nodeTotal(dl.children[nm]);
          if (window.FilesHelper && FilesHelper.recycle) FilesHelper.recycle(["Downloads", nm]);
          else { const bin = Array.isArray(AD().fileBin) ? AD().fileBin : (AD().fileBin = []); bin.push({ id: uid("r"), name: nm, node: dl.children[nm], from: ["Downloads"], ts: now() }); delete dl.children[nm]; }
        });
        items.push({ name: "Downloads (not opened for " + c.dlDays + " days) — moved to the Recycle Bin", count: moved.length, bytes });
      }
      save(); changed();
      let blobFreed = 0;
      for (const id of gcIds) {
        if (blobReferenced(id)) continue;
        try { const b = await rawBlobGet(id); if (b) { blobFreed += b.size; await rawBlobDel(id); } } catch (_) {}
      }
      const ls1 = lsTotal(), est1 = await estimate();
      const lsFreed = Math.max(0, ls0 - ls1), estFreed = est0 && est1 ? Math.max(0, est0.usage - est1.usage) : 0;
      const freed = lsFreed + Math.max(blobFreed, estFreed);
      const rep = { ts: t0, reason: opts.reason || "manual", freed, lsFreed, blobFreed, items };
      c.lastRun = t0; c.history.unshift(rep); if (c.history.length > 12) c.history.length = 12;
      save();
      log("Application", "Information", "Microsoft-Windows-StorageSense", 1003, "Storage Sense " + (opts.reason === "schedule" ? "(scheduled)" : "(Run now)") + " freed " + fmtBytes(freed) + ". " + items.map((i) => i.name + ": " + i.count).join("; ") + ".");
      if (opts.reason === "schedule" && freed > 0) note("Storage Sense", "Storage Sense freed " + fmtBytes(freed) + " of space.", "settings", () => openSettingsSub("su-storagesense"));
      return rep;
    }

    // ---- usage by category (VFS + localStorage + IndexedDB estimate) ----
    async function usage() {
      const r = root();
      const folderBytes = (name) => nodeTotal(r[name]);
      const used = (k) => (r[k] ? folderBytes(k) : 0);
      const known = new Set(["Documents", "Desktop", "Pictures", "Videos", "Music", "Downloads", "OneDrive", SYS]);
      let other = 0; Object.keys(r).forEach((k) => { if (!known.has(k)) other += folderBytes(k); });
      let temp = 0; try { const tc = window.SysTools && SysTools.cleanupCats ? SysTools.cleanupCats(false).find((x) => x.id === "temp") : null; temp = tc ? tc.bytes || 0 : 0; } catch (_) {}
      const bin = (Array.isArray(AD().fileBin) ? AD().fileBin : []).reduce((s, b) => s + nodeTotal(b && b.node), 0);
      const sys = Math.max(0, folderBytes(SYS) - temp);
      let filesJson = 0; try { filesJson = JSON.stringify(AD().files || {}).length * 2 + JSON.stringify(AD().fileBin || []).length * 2; } catch (_) {}
      const ls = lsTotal();
      const e = await estimate();
      let blobBytes = 0; walk((n) => { if (n.type === "file" && n.blob && typeof n.size === "number") blobBytes += n.size; });
      const idbOther = e && e.usage ? Math.max(0, e.usage - ls - blobBytes) : 0;
      const apps = Math.max(0, ls - filesJson) + idbOther;
      const cats = [
        { key: "apps", name: "Apps & features", desc: "Settings and data saved by your apps, caches and app databases", bytes: apps, color: "#0067c0", go: () => openSettingsAt("installed") },
        { key: "docs", name: "Documents", desc: "Documents and Desktop folders", bytes: used("Documents") + used("Desktop"), color: "#8764b8", go: () => FilesHelper && FilesHelper.open(["Documents"]) },
        { key: "pics", name: "Pictures", desc: "Pictures folder", bytes: used("Pictures"), color: "#00b294", go: () => FilesHelper && FilesHelper.open(["Pictures"]) },
        { key: "vids", name: "Videos", desc: "Videos folder", bytes: used("Videos"), color: "#e3008c", go: () => FilesHelper && FilesHelper.open(["Videos"]) },
        { key: "music", name: "Music", desc: "Music folder", bytes: used("Music"), color: "#ff8c00", go: () => FilesHelper && FilesHelper.open(["Music"]) },
        { key: "temp", name: "Temporary files", desc: "Temporary files and the Recycle Bin", bytes: temp + bin, color: "#ffb900", go: () => WM.open("cleanmgr") },
        { key: "other", name: "Other", desc: "Downloads, OneDrive and other folders", bytes: used("Downloads") + used("OneDrive") + other, color: "#767676", go: () => FilesHelper && FilesHelper.open(["Downloads"]) },
        { key: "sys", name: "System & reserved", desc: "C:\\Windows, Program Files and other system files", bytes: sys, color: "#4a5459", go: () => WM.open("diskmgmt") },
      ];
      const total = cats.reduce((s, c) => s + c.bytes, 0);
      return { cats: cats.sort((a, b) => b.bytes - a.bytes), total, used: e && e.usage ? Math.max(e.usage, ls) : total, quota: e && e.quota || 0, ls };
    }
    return { cfg, run, scheduled, usage, lowSpace, isDue, busy: () => !!busy, on(fn) { listeners.add(fn); return () => listeners.delete(fn); } };
  })();

  // ---- Settings pages for Storage ----
  function openSettingsAt(key) {
    const page = document.querySelector(".win .w12s-page");
    if (page && SUBS[key]) return renderSub(page, key);
    window.SettingsStartPage = key; if (window.WM) WM.open("settings");
  }
  function usageCard(box, opts) {
    const card = el(`<div class="w12s-card su-usage"><div class="su-usage-h"><b>Local Disk (C:)</b><span class="su-dim">Calculating…</span></div><div class="su-stack"></div><div class="su-usage-list"></div></div>`);
    box.appendChild(card);
    StorageSense.usage().then((u) => {
      if (!card.isConnected) return;
      const cap = u.quota || Math.max(u.used, 5 * 1048576);
      card.querySelector(".su-usage-h span").textContent = fmtBytes(u.used) + " used" + (u.quota ? " · " + fmtBytes(Math.max(0, u.quota - u.used)) + " free (browser quota)" : " of browser storage");
      const st = card.querySelector(".su-stack");
      u.cats.filter((c) => c.bytes > 0).forEach((c) => { const i = el(`<i title="${esc(c.name)}"></i>`); i.style.background = c.color; i.style.width = Math.max(0.6, (c.bytes / cap) * 100) + "%"; st.appendChild(i); });
      const list = card.querySelector(".su-usage-list");
      (opts && opts.all ? u.cats : u.cats.slice(0, 4)).forEach((c) => {
        const r = el(`<button type="button" class="su-cat"><span class="su-dot"></span><span class="su-cat-t"><b></b><small></small></span><span class="su-cat-b"><span class="su-cat-v"></span><span class="su-cat-bar"><i></i></span></span></button>`);
        r.querySelector(".su-dot").style.background = c.color; r.querySelector("b").textContent = c.name; r.querySelector("small").textContent = c.desc;
        r.querySelector(".su-cat-v").textContent = fmtBytes(c.bytes);
        const bar = r.querySelector(".su-cat-bar i"); bar.style.background = c.color; bar.style.width = Math.max(1, (c.bytes / Math.max(1, u.cats[0].bytes)) * 100) + "%";
        r.onclick = () => { try { c.go(); } catch (_) {} };
        list.appendChild(r);
      });
      if (!(opts && opts.all)) { const more = srow("chart", "Show more categories", "See how storage is used and find files you can delete", { onClick: () => openSettingsSub("su-storagecats") }); list.appendChild(more); }
    });
    return card;
  }
  function reportCard(rep) {
    const c = el(`<div class="w12s-card su-report"></div>`);
    c.innerHTML = `<div class="su-report-h">${ic("check", 18)}<b>Storage Sense freed ${esc(fmtBytes(rep.freed))}</b><span class="su-dim">${esc(fmtWhen(rep.ts))}${rep.reason === "schedule" ? " · scheduled" : ""}</span></div>
      <ul class="su-ul">${rep.items.map((i) => `<li>${esc(i.name)}: ${i.count} item${i.count === 1 ? "" : "s"}${i.bytes ? " (" + esc(fmtBytes(i.bytes)) + ")" : ""}</li>`).join("")}</ul>
      <div class="su-dim">localStorage freed: ${esc(fmtBytes(rep.lsFreed))} · IndexedDB file data freed: ${esc(fmtBytes(rep.blobFreed))}</div>`;
    return c;
  }
  registerSub("su-storagesense", { title: "Storage Sense", parent: "system", via: "Storage", build(h, redraw) {
    const c = StorageSense.cfg();
    const set = (k) => (v) => { c[k] = v; save(); };
    h.appendChild(el(`<div class="su-s-h">Cleanup of temporary files</div>`));
    const tmp = el(`<label class="w12s-card su-chkcard"><input type="checkbox" ${c.temp ? "checked" : ""}> <span>Keep Windows running smoothly by automatically cleaning up temporary system and app files</span></label>`);
    tmp.querySelector("input").onchange = (e) => set("temp")(e.target.checked); h.appendChild(tmp);
    h.appendChild(srow("broom", "Automatic User content cleanup", c.on ? "On — Storage Sense runs on the schedule below" : "Off", { ctl: toggleEl(c.on, (v) => { c.on = v; save(); log("Application", "Information", "Microsoft-Windows-StorageSense", 1001, "Storage Sense was turned " + (v ? "on" : "off") + "."); redraw(); }, "Storage Sense") }));
    h.appendChild(el(`<div class="su-s-h">Configure cleanup schedules</div>`));
    h.appendChild(srow("clock", "Run Storage Sense", "Checked by the StorageSense task in Task Scheduler", { ctl: selectEl([["day", "Every day"], ["week", "Every week"], ["month", "Every month"], ["low", "During low free disk space (default)"]], c.cadence, (v) => { c.cadence = v; save(); }, "Run Storage Sense") }));
    h.appendChild(srow("trash", "Delete files in my recycle bin if they have been there for over:", "Deleted for good — their space is freed", { ctl: selectEl([[0, "Never"], [1, "1 day"], [14, "14 days"], [30, "30 days (default)"], [60, "60 days"]], c.binDays, (v) => { c.binDays = +v; save(); }, "Recycle Bin") }));
    h.appendChild(srow("folder", "Delete files in my Downloads folder if they haven't been opened for more than:", "They're moved to the Recycle Bin, so you can still restore them", { ctl: selectEl([[0, "Never (default)"], [1, "1 day"], [14, "14 days"], [30, "30 days"], [60, "60 days"]], c.dlDays, (v) => { c.dlDays = +v; save(); }, "Downloads") }));
    const runBox = el(`<div class="su-runbox"><button type="button" class="w12s-btn su-run">Run Storage Sense now</button><span class="su-dim su-runst"></span></div>`);
    h.appendChild(runBox);
    const out = el(`<div class="su-report-host"></div>`); h.appendChild(out);
    const showLast = () => { out.innerHTML = ""; const r = StorageSense.cfg().history[0]; if (r) out.appendChild(reportCard(r)); runBox.querySelector(".su-runst").textContent = c.lastRun ? "Last run: " + fmtWhen(c.lastRun) : "Storage Sense hasn't run yet."; };
    runBox.querySelector(".su-run").onclick = async (e) => {
      const b = e.currentTarget; b.disabled = true; runBox.querySelector(".su-runst").textContent = "Cleaning up…";
      try { await StorageSense.run({ reason: "manual" }); } catch (err) { console.error(err); }
      b.disabled = false; showLast();
    };
    showLast();
  } });
  registerSub("su-storagecats", { title: "Storage used on Local Disk (C:)", parent: "system", via: "Storage", build(h) {
    h.appendChild(el(`<p class="su-dim su-p">How this desktop's storage is used: your files (from the file system), app data in localStorage, and IndexedDB / caches from the browser's storage estimate.</p>`));
    usageCard(h, { all: true });
  } });
  ENH.push((page, list, info) => {
    if (!info.sub || !T.storage.includes(info.title)) return;
    const box = el(`<div class="su-inject"></div>`);
    usageCard(box);
    box.appendChild(el(`<div class="su-s-h">Storage management</div>`));
    const c = StorageSense.cfg();
    box.appendChild(srow("broom", "Storage Sense", "Automatically free up space, delete temporary files, and manage old Recycle Bin and Downloads files" + (c.lastRun ? " · last run " + fmtWhen(c.lastRun) : ""), { ctl: toggleEl(c.on, (v) => { c.on = v; save(); }, "Storage Sense"), onClick: () => renderSub(page, "su-storagesense") }));
    box.appendChild(srow("trash", "Cleanup recommendations", "Over-sized or unused files you can delete (Disk Cleanup)", { onClick: () => WM.open("cleanmgr") }));
    box.appendChild(srow("disk", "Advanced storage settings", "Disks & volumes, browser storage quota (Disk Management)", { onClick: () => WM.open("diskmgmt") }));
    list.appendChild(box);
  });

  // =====================================================================
  //  4. POWER PLANS, ENERGY SAVER, SLEEP / HIBERNATE
  // =====================================================================
  const PowerPlans = (function () {
    const BUILTIN = {
      balanced: { name: "Balanced", desc: "Automatically balances performance with energy consumption on capable hardware.", screenAC: 10, screenDC: 5, sleepAC: 30, sleepDC: 15, low: false },
      saver: { name: "Power saver", desc: "Saves energy by reducing your computer's performance where possible: animations and transparency are turned off and Recall snapshots less often.", screenAC: 5, screenDC: 2, sleepAC: 15, sleepDC: 10, low: true },
      perf: { name: "High performance", desc: "Favors performance, but may use more energy.", screenAC: 15, screenDC: 10, sleepAC: 0, sleepDC: 30, low: false },
    };
    const listeners = new Set();
    const emit = () => listeners.forEach((f) => { try { f(); } catch (_) {} });
    let battery = null;
    try { if (navigator.getBattery) navigator.getBattery().then((b) => { battery = b; ["levelchange", "chargingchange"].forEach((e) => b.addEventListener(e, () => { applyEffects(); emit(); })); applyEffects(); emit(); }).catch(() => {}); } catch (_) {}
    const batteryKnown = () => !!battery;
    const onBattery = () => !!(battery && !battery.charging);
    const level = () => (battery ? Math.round(battery.level * 100) : null);
    function cfg() {
      const a = AD(); let c = a.powerPlans;
      if (!c || typeof c !== "object") c = a.powerPlans = {};
      if (!c.active) c.active = "balanced";
      if (!c.custom || typeof c.custom !== "object") c.custom = {};
      if (!c.over || typeof c.over !== "object") c.over = {};
      if (c.saverAuto == null) c.saverAuto = 20;    // percent; 0 = never, 100 = always
      if (c.saverOn == null) c.saverOn = false;
      if (c.saverDim == null) c.saverDim = true;
      if (c.hibernate == null) c.hibernate = true;
      return c;
    }
    function plans() {
      const c = cfg(), out = [];
      Object.keys(BUILTIN).forEach((id) => out.push(Object.assign({ id, builtin: true }, BUILTIN[id], c.over[id] || {})));
      Object.keys(c.custom).forEach((id) => out.push(Object.assign({ id, builtin: false }, c.custom[id])));
      return out;
    }
    const plan = (id) => plans().find((p) => p.id === id) || plans()[0];
    const active = () => plan(cfg().active);
    function setActive(id, why) {
      const c = cfg(); if (!plan(id) || plan(id).id !== id) return;
      c.active = id; save();
      pushTimeouts();
      applyEffects();
      log("System", "Information", "Microsoft-Windows-UserModePowerService", 12, "Process powercfg changed the active power scheme to " + plan(id).name + (why ? " (" + why + ")" : "") + ".");
      emit();
    }
    // The plan's timeouts are what IdleLock uses (its own Settings rows edit the active plan).
    function pushTimeouts() {
      if (!window.IdleLock) return;
      const p = active(), pw = IdleLock.config().power;
      ["screenAC", "screenDC", "sleepAC", "sleepDC"].forEach((k) => { pw[k] = p[k]; });
      save();
    }
    function pullTimeouts() {   // the user changed screen/sleep in Settings ▸ Power & battery → keep the plan in step
      if (!window.IdleLock) return;
      const p = active(), pw = IdleLock.config().power, c = cfg();
      const diff = ["screenAC", "screenDC", "sleepAC", "sleepDC"].some((k) => pw[k] !== p[k]);
      if (!diff) return;
      const v = { screenAC: pw.screenAC, screenDC: pw.screenDC, sleepAC: pw.sleepAC, sleepDC: pw.sleepDC };
      if (p.builtin) c.over[p.id] = Object.assign({}, c.over[p.id] || {}, v); else Object.assign(c.custom[p.id], v);
      save(); emit();
    }
    function savePlan(id, vals) {
      const c = cfg(), p = plan(id);
      if (p.builtin) c.over[id] = Object.assign({}, c.over[id] || {}, vals); else Object.assign(c.custom[id], vals);
      save(); if (cfg().active === id) { pushTimeouts(); applyEffects(); } emit();
    }
    function restoreDefaults(id) { const c = cfg(); if (BUILTIN[id]) { delete c.over[id]; save(); if (c.active === id) { pushTimeouts(); applyEffects(); } emit(); } }
    function createPlan(name, base) {
      const c = cfg(), b = plan(base || "balanced"), id = uid("plan");
      c.custom[id] = { name: String(name || "My Custom Plan").slice(0, 60), desc: "Custom plan based on " + b.name + ".", screenAC: b.screenAC, screenDC: b.screenDC, sleepAC: b.sleepAC, sleepDC: b.sleepDC, low: !!b.low };
      save(); setActive(id, "new plan"); return id;
    }
    function deletePlan(id) { const c = cfg(); if (!c.custom[id] || c.active === id) return false; delete c.custom[id]; save(); emit(); return true; }
    // Energy saver (battery saver)
    const saverActive = () => { const c = cfg(); if (c.saverOn) return true; if (c.saverAuto >= 100) return true; return !!(c.saverAuto > 0 && onBattery() && level() != null && level() <= c.saverAuto); };
    const lowPower = () => !!active().low || saverActive();
    let lastLow = null;
    function applyEffects() {
      const low = lowPower();
      document.body.classList.toggle("su-lowpower", low);
      document.body.classList.toggle("su-saver-dim", low && saverActive() && cfg().saverDim);
      // Recall snapshots less often while saving power (its interval is restored afterwards).
      try {
        if (window.Recall && Recall.config) {
          const rc = Recall.config(), c = cfg();
          if (low && rc.interval < 300) { if (c.recallPrev == null) c.recallPrev = rc.interval; rc.interval = 300; save(); }
          else if (!low && c.recallPrev != null) { rc.interval = c.recallPrev; delete c.recallPrev; save(); }
        }
      } catch (_) {}
      if (lastLow !== null && low !== lastLow) log("System", "Information", "Microsoft-Windows-Kernel-Power", 566, "Energy saver / power saver effects turned " + (low ? "on" : "off") + ".");
      lastLow = low;
    }
    function start() {
      cfg(); pullTimeouts(); applyEffects();   // IdleLock holds the live timeouts: adopt them into the active plan
      setInterval(() => { try { pullTimeouts(); applyEffects(); } catch (_) {} }, 3000);
    }
    return { BUILTIN, cfg, plans, plan, active, setActive, savePlan, restoreDefaults, createPlan, deletePlan, saverActive, lowPower, applyEffects, batteryKnown, onBattery, level, start, on(fn) { listeners.add(fn); return () => listeners.delete(fn); } };
  })();

  // ---- Hibernate: save open windows (+ Notepad text) and bring them back after the next sign-in ----
  const Hibernate = (function () {
    const SKIP = new Set(["run", "uac", "lockscreen"]);
    function capture() {
      const out = [];
      (window.WM && WM.windows ? WM.windows() : []).forEach((e) => {
        if (!e || !e.appId || SKIP.has(e.appId) || !e.win || !e.win.isConnected) return;
        const w = e.win, st = w.style;
        const rec = { appId: e.appId, title: e.title || "", maximized: !!e.maximized, minimized: st.display === "none", rect: { left: st.left, top: st.top, width: st.width, height: st.height } };
        if (e.maximized && e.maxPrev) { const p = e.maxPrev(); if (p) rec.rect = { left: p.l + "px", top: p.t + "px", width: p.w + "px", height: p.h + "px" }; }
        if (e.appId === "notepad") { const ta = w.querySelector("textarea"); const tt = w.querySelector(".t-text"); if (ta) rec.notepad = { text: ta.value, title: tt ? tt.textContent : "Notepad" }; }
        out.push(rec);
      });
      return out;
    }
    function hibernate() {
      const wins = capture();
      AD().hiberfil = { ts: now(), windows: wins, v: 1 };
      save();
      log("System", "Information", "Microsoft-Windows-Kernel-Power", 42, "The system is entering sleep.\r\nSleep Reason: Hibernate (Start ▸ Power ▸ Hibernate)\r\nTarget state: S4 (hibernate). " + wins.length + " window(s) saved to hiberfil.");
      const scr = el(`<div class="su-hib-screen" role="status"><div class="su-hib-in"><div class="su-spin"></div><div class="su-hib-t">Hibernating</div></div></div>`);
      document.body.appendChild(scr);
      setTimeout(() => {
        scr.classList.add("off");
        scr.innerHTML = `<button type="button" class="su-hib-power" aria-label="Turn on">${ic("power", 30)}<span>This PC is hibernating. Tap or press any key to turn it on.</span></button>`;
        const wake = () => { document.removeEventListener("keydown", wake, true); scr.innerHTML = ""; setTimeout(() => location.reload(), 150); };
        scr.querySelector("button").onclick = wake;
        setTimeout(() => document.addEventListener("keydown", wake, true), 400);
      }, 1600);
    }
    let restoring = false;
    async function restore() {
      const h = AD().hiberfil; if (!h || restoring) return;
      restoring = true;
      log("System", "Information", "Microsoft-Windows-Power-Troubleshooter", 1, "The system has returned from a low power state (hibernate).\r\nSleep Time: " + new Date(h.ts).toISOString() + "\r\nWake Time: " + new Date().toISOString());
      const done = [];
      for (const r of h.windows || []) {
        try {
          const before = new Set(WM.windows().map((e) => e.win));
          WM.open(r.appId);
          await sleep(120);
          const e = WM.windows().find((x) => !before.has(x.win) && x.appId === r.appId) || WM.windows().filter((x) => x.appId === r.appId).pop();
          if (e) {
            if (r.rect && r.rect.width && !/%/.test(r.rect.width)) Object.assign(e.win.style, { left: r.rect.left, top: r.rect.top, width: r.rect.width, height: r.rect.height });
            if (r.maximized && e.setMaximized) e.setMaximized(true);
            if (r.notepad) { const ta = e.win.querySelector("textarea"); if (ta) { ta.value = r.notepad.text; ta.dispatchEvent(new Event("input", { bubbles: true })); } const tt = e.win.querySelector(".t-text"); if (tt && r.notepad.title) tt.textContent = r.notepad.title; }
            if (r.minimized) { e.win.style.display = "none"; if (WM.refreshTaskbarActive) WM.refreshTaskbarActive(); }
            done.push(r.appId);
          }
        } catch (err) { console.warn("[Hibernate] restore", r.appId, err); }
      }
      AD().hiberLast = h; delete AD().hiberfil; save();
      restoring = false;
      if (done.length) note("Resumed from hibernation", "Windows reopened " + done.length + " app" + (done.length === 1 ? "" : "s") + " you had open.", "settings");
    }
    function watchBoot() {
      if (!AD().hiberfil) return;
      const iv = setInterval(() => { if (!AD().hiberfil) { clearInterval(iv); return; } if (desktopUp() && window.WM && WM.windows) { clearInterval(iv); setTimeout(restore, 600); } }, 400);
    }
    function hookPowerMenu(sm) {
      new MutationObserver((muts) => muts.forEach((m) => m.addedNodes.forEach((n) => {
        if (n.nodeType !== 1 || !n.classList.contains("start-powmenu") || n.querySelector(".su-hib-btn") || !PowerPlans.cfg().hibernate) return;
        const b = el(`<button data-a="hibernate" class="su-hib-btn"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4 6.6 6.6 0 0 0 20 14.5z"/><path d="M13 8h4l-4 4h4"/></svg> Hibernate</button>`);
        b.onclick = (e) => { e.stopPropagation(); n.remove(); sm.classList.remove("open"); hibernate(); };
        const sl = n.querySelector('[data-a="sleep"]'); if (sl && sl.nextSibling) n.insertBefore(b, sl.nextSibling); else n.appendChild(b);
      }))).observe(sm, { childList: true });
    }
    return { hibernate, restore, capture, watchBoot, hookPowerMenu, pending: () => !!AD().hiberfil };
  })();

  // ---- Control Panel ▸ Power Options ----
  const TIMEOUTS = [[1, "1 minute"], [2, "2 minutes"], [3, "3 minutes"], [5, "5 minutes"], [10, "10 minutes"], [15, "15 minutes"], [20, "20 minutes"], [25, "25 minutes"], [30, "30 minutes"], [45, "45 minutes"], [60, "1 hour"], [120, "2 hours"], [180, "3 hours"], [300, "5 hours"], [0, "Never"]];
  const tLabel = (m) => (TIMEOUTS.find((x) => x[0] === +m) || [0, m + " minutes"])[1];
  function cpPower(main, side, nav) {
    const sl = (t, fn) => { const b = el(`<button class="st-sidelink">${esc(t)}</button>`); b.onclick = fn; side.appendChild(b); };
    let view = "plans", editId = null;
    sl("Choose what the power buttons do", () => { view = "buttons"; paint(); });
    sl("Create a power plan", () => { view = "create"; paint(); });
    sl("Choose when to turn off the display", () => { view = "edit"; editId = PowerPlans.cfg().active; paint(); });
    sl("Change when the computer sleeps", () => { view = "edit"; editId = PowerPlans.cfg().active; paint(); });
    side.appendChild(el(`<div class="su-side-h">See also</div>`));
    sl("Power & battery (Settings)", () => openSettingsAt("power"));
    sl("User Accounts", () => nav.go("users"));
    const box = el(`<div class="su-pp"></div>`); main.appendChild(box);
    const h1 = main.querySelector(".st-h1");
    function battery() {
      if (!PowerPlans.batteryKnown()) return `<p class="su-dim">${ic("info", 14)} This browser doesn't share battery information (Safari and Firefox keep it private), so “plugged in” timeouts are used and energy saver turns on only when you switch it on.</p>`;
      return `<div class="su-pp-bat">${ic("power", 16)} Battery: <b>${PowerPlans.level()}%</b> · ${PowerPlans.onBattery() ? "on battery" : "plugged in"}${PowerPlans.saverActive() ? " · <b>Energy saver is on</b>" : ""} <span class="su-dim">(reported by your device)</span></div>`;
    }
    function paint() {
      if (!box.isConnected) return;
      const c = PowerPlans.cfg();
      if (view === "plans") {
        if (h1) h1.textContent = "Choose or customize a power plan";
        box.innerHTML = `<p class="st-dim">A power plan is a collection of settings that manages how your computer uses power: here it sets when the screen turns off and when the PC sleeps (the same timeouts as Settings ▸ Power & battery), and Power saver turns off animations and transparency.</p>${battery()}
          <h2 class="st-h2">Preferred plans</h2>
          <div class="su-pp-list">${PowerPlans.plans().map((p) => `<div class="su-pp-row"><label class="su-pp-pick"><input type="radio" name="su-pp" value="${p.id}" ${c.active === p.id ? "checked" : ""}> <b>${esc(p.name)}</b>${p.id === "balanced" ? " (recommended)" : ""}</label><button class="su-link" data-edit="${p.id}">Change plan settings</button><div class="su-dim">${esc(p.desc)}</div><div class="su-dim su-pp-vals">Display off: ${esc(tLabel(p.screenAC))} plugged in / ${esc(tLabel(p.screenDC))} on battery · Sleep: ${esc(tLabel(p.sleepAC))} / ${esc(tLabel(p.sleepDC))}</div></div>`).join("")}</div>`;
        box.querySelectorAll('[name="su-pp"]').forEach((r) => r.onchange = () => { PowerPlans.setActive(r.value, "Control Panel"); paint(); });
        box.querySelectorAll("[data-edit]").forEach((b) => b.onclick = () => { view = "edit"; editId = b.dataset.edit; paint(); });
      } else if (view === "edit") {
        const p = PowerPlans.plan(editId);
        if (h1) h1.textContent = "Change settings for the plan: " + p.name;
        const sel = (k, v) => `<select class="st-input st-sm" data-k="${k}">${TIMEOUTS.map(([m, l]) => `<option value="${m}" ${+v === m ? "selected" : ""}>${l}</option>`).join("")}</select>`;
        box.innerHTML = `<p class="st-dim">Choose the sleep and display settings that you want your computer to use.</p>
          <table class="su-pp-grid"><tr><th></th><th>${ic("power", 14)} On battery</th><th>${ic("power", 14)} Plugged in</th></tr>
          <tr><td>Turn off the display:</td><td>${sel("screenDC", p.screenDC)}</td><td>${sel("screenAC", p.screenAC)}</td></tr>
          <tr><td>Put the computer to sleep:</td><td>${sel("sleepDC", p.sleepDC)}</td><td>${sel("sleepAC", p.sleepAC)}</td></tr></table>
          <label class="st-check"><input type="checkbox" data-k="low" ${p.low ? "checked" : ""}> Reduce animations and transparency, and snapshot Recall less often (power saving)</label>
          <div class="su-btnrow">${p.builtin ? `<button class="st-btn" data-a="def">Restore default settings for this plan</button>` : `<button class="st-btn" data-a="del" ${c.active === p.id ? "disabled title='Switch to another plan first'" : ""}>Delete this plan</button>`}<span class="su-grow"></span><button class="st-btn st-btn-def" data-a="save">Save changes</button><button class="st-btn" data-a="cancel">Cancel</button></div>`;
        box.querySelector('[data-a="save"]').onclick = () => { const v = {}; box.querySelectorAll("select[data-k]").forEach((s) => { v[s.dataset.k] = +s.value; }); v.low = box.querySelector('[data-k="low"]').checked; PowerPlans.savePlan(p.id, v); view = "plans"; paint(); };
        box.querySelector('[data-a="cancel"]').onclick = () => { view = "plans"; paint(); };
        const d = box.querySelector('[data-a="def"]'); if (d) d.onclick = () => { PowerPlans.restoreDefaults(p.id); paint(); };
        const x = box.querySelector('[data-a="del"]'); if (x) x.onclick = async () => { if (await confirmBox("Power Options", "Are you sure you want to delete this plan?<br><b>" + esc(p.name) + "</b>")) { PowerPlans.deletePlan(p.id); view = "plans"; paint(); } };
      } else if (view === "create") {
        if (h1) h1.textContent = "Create a power plan";
        box.innerHTML = `<p class="st-dim">To create your own plan, start by selecting one of the following plans that's closest to what you want.</p>
          ${Object.keys(PowerPlans.BUILTIN).map((id) => `<label class="st-check"><input type="radio" name="su-base" value="${id}" ${id === "balanced" ? "checked" : ""}> <b>${esc(PowerPlans.BUILTIN[id].name)}</b></label>`).join("")}
          <label class="su-lbl">Plan name:<input class="st-input" data-a="name" value="My Custom Plan 1"></label>
          <div class="su-btnrow"><span class="su-grow"></span><button class="st-btn st-btn-def" data-a="next">Next</button><button class="st-btn" data-a="cancel">Cancel</button></div>`;
        box.querySelector('[data-a="cancel"]').onclick = () => { view = "plans"; paint(); };
        box.querySelector('[data-a="next"]').onclick = () => { const base = (box.querySelector('[name="su-base"]:checked') || {}).value; const id = PowerPlans.createPlan(box.querySelector('[data-a="name"]').value.trim() || "My Custom Plan 1", base); view = "edit"; editId = id; paint(); };
      } else if (view === "buttons") {
        if (h1) h1.textContent = "Define power buttons and turn on password protection";
        box.innerHTML = `<p class="st-dim">Choose the power settings that you want for your computer.</p>
          <h2 class="st-h2">Shutdown settings</h2>
          <label class="st-check"><input type="checkbox" checked disabled> Sleep — Show in Power menu.</label>
          <label class="st-check"><input type="checkbox" data-k="hibernate" ${c.hibernate ? "checked" : ""}> Hibernate — Show in Power menu. (Saves your open apps and Notepad text, then turns off; they reopen after you sign in.)</label>
          <label class="st-check"><input type="checkbox" checked disabled> Lock — Show in account picture menu.</label>
          <div class="su-btnrow"><span class="su-grow"></span><button class="st-btn st-btn-def" data-a="save">Save changes</button><button class="st-btn" data-a="cancel">Cancel</button></div>`;
        box.querySelector('[data-a="save"]').onclick = () => { c.hibernate = box.querySelector('[data-k="hibernate"]').checked; save(); view = "plans"; paint(); };
        box.querySelector('[data-a="cancel"]').onclick = () => { view = "plans"; paint(); };
      }
    }
    paint();
    const off = PowerPlans.on(() => { if (!box.isConnected) { off(); return; } if (view === "plans" && !box.contains(document.activeElement)) paint(); });
    if (nav && nav.onLeave) nav.onLeave(off);
  }

  // ---- Settings ▸ System ▸ Power & battery: Power mode + Energy saver ----
  ENH.push((page, list, info) => {
    if (!info.sub || !T.power.includes(info.title)) return;
    const box = el(`<div class="su-inject su-power"></div>`);
    const paint = () => {
      const c = PowerPlans.cfg(), a = c.active;
      box.innerHTML = "";
      const mode = a === "saver" ? "saver" : a === "perf" ? "perf" : a === "balanced" ? "balanced" : "custom";
      const pairs = [["saver", "Best power efficiency"], ["balanced", "Balanced"], ["perf", "Best performance"]].concat(mode === "custom" ? [["custom", PowerPlans.active().name + " (custom plan)"]] : []);
      box.appendChild(srow("gauge", "Power mode", "Optimize your device based on power use and performance — sets the power plan, screen and sleep timeouts", { ctl: selectEl(pairs, mode, (v) => { if (v !== "custom") PowerPlans.setActive(v, "Settings ▸ Power mode"); }, "Power mode") }));
      const st = PowerPlans.saverActive() ? "On" : "Off";
      box.appendChild(srow("leaf", "Energy saver", (PowerPlans.batteryKnown() ? "Battery " + PowerPlans.level() + "% · " : "") + st + " — turns off animations and transparency effects and snapshots Recall less often", { ctl: toggleEl(PowerPlans.cfg().saverOn, (v) => { PowerPlans.cfg().saverOn = v; save(); PowerPlans.applyEffects(); paint(); }, "Energy saver") }));
      box.appendChild(srow("leaf", "Turn energy saver on automatically at", PowerPlans.batteryKnown() ? "Uses your device's real battery level" : "This browser doesn't report the battery level (Safari keeps it private), so only “Always” and “Never” apply here", { ctl: selectEl([[0, "Never"], [10, "10%"], [20, "20%"], [30, "30%"], [40, "40%"], [50, "50%"], [100, "Always"]], c.saverAuto, (v) => { PowerPlans.cfg().saverAuto = +v; save(); PowerPlans.applyEffects(); paint(); }, "Energy saver automatically") }));
      box.appendChild(srow("leaf", "Lower screen brightness when using energy saver", "", { ctl: toggleEl(c.saverDim, (v) => { PowerPlans.cfg().saverDim = v; save(); PowerPlans.applyEffects(); }, "Lower brightness") }));
      box.appendChild(srow("moon", "Power plans & hibernate", "Control Panel ▸ Power Options: plans, custom plans, Hibernate in the Power menu", { onClick: () => { window.ControlPanelStartPage = "power"; WM.open("controlpanel"); } }));
    };
    paint();
    const off = PowerPlans.on(() => { if (!box.isConnected) { off(); return; } if (!box.contains(document.activeElement)) paint(); });
    const first = list.firstElementChild; if (first && first.nextSibling) list.insertBefore(box, first.nextSibling); else list.appendChild(box);
  });

  // ---- powercfg ----
  function powercfg(c) {
    const io = c.io, a = c.a.map((x) => x.toLowerCase());
    const guidOf = (p) => ({ balanced: "381b4222-f694-41f0-9685-ff5bb260df2e", saver: "a1841308-3541-4fab-bc81-f71556f20b4a", perf: "8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c" }[p.id] || (p.id.replace(/[^a-z0-9]/g, "").padEnd(32, "0").slice(0, 8) + "-0000-4000-8000-" + p.id.replace(/[^a-z0-9]/g, "").padEnd(12, "0").slice(0, 12)));
    if (!a.length || a[0] === "/?" || a[0] === "-?") { io.out("POWERCFG /COMMAND [ARGUMENTS]\n\n  /LIST, /L           Lists all power schemes.\n  /GETACTIVESCHEME    Retrieves the currently active power scheme.\n  /SETACTIVE <GUID|SCHEME_MIN|SCHEME_MAX|SCHEME_BALANCED>  Makes a power scheme active.\n  /CHANGE <setting> <value>   monitor-timeout-ac|dc, standby-timeout-ac|dc (minutes)\n  /HIBERNATE, /H on|off       Shows or hides Hibernate in the Power menu.\n  /BATTERYREPORT      Shows the battery status your browser reports."); return 0; }
    const cmd = a[0].replace(/^-/, "/");
    if (cmd === "/list" || cmd === "/l") { io.out("\nExisting Power Schemes (* Active)\n-----------------------------------"); PowerPlans.plans().forEach((p) => io.out("Power Scheme GUID: " + guidOf(p) + "  (" + p.name + ")" + (PowerPlans.cfg().active === p.id ? " *" : ""))); return 0; }
    if (cmd === "/getactivescheme") { const p = PowerPlans.active(); io.out("Power Scheme GUID: " + guidOf(p) + "  (" + p.name + ")"); return 0; }
    if (cmd === "/setactive" || cmd === "/s") {
      const v = a[1] || ""; const p = v === "scheme_min" ? PowerPlans.plan("perf") : v === "scheme_max" ? PowerPlans.plan("saver") : v === "scheme_balanced" ? PowerPlans.plan("balanced") : PowerPlans.plans().find((x) => guidOf(x) === v);
      if (!p) { io.err("Invalid Parameters -- try \"/?\" for help"); return 1; }
      PowerPlans.setActive(p.id, "powercfg"); return 0;
    }
    if (cmd === "/change" || cmd === "/x") {
      const map = { "monitor-timeout-ac": "screenAC", "monitor-timeout-dc": "screenDC", "standby-timeout-ac": "sleepAC", "standby-timeout-dc": "sleepDC" };
      const k = map[a[1]]; const v = parseInt(a[2], 10);
      if (!k || isNaN(v) || v < 0) { io.err("Invalid Parameters -- try \"/?\" for help"); return 1; }
      PowerPlans.savePlan(PowerPlans.cfg().active, { [k]: v }); return 0;
    }
    if (cmd === "/hibernate" || cmd === "/h") { const on = a[1] !== "off"; PowerPlans.cfg().hibernate = on; save(); io.out("Hibernate is " + (on ? "on" : "off") + " (Start ▸ Power ▸ Hibernate)."); return 0; }
    if (cmd === "/batteryreport") { io.out(PowerPlans.batteryKnown() ? "Battery: " + PowerPlans.level() + "% · " + (PowerPlans.onBattery() ? "Discharging" : "Charging / AC") + " (Battery Status API)" : "This browser doesn't report battery information."); return 0; }
    io.err("Invalid Parameters -- try \"/?\" for help"); return 1;
  }

  // =====================================================================
  //  5. FONTS (window.FontsRegistry) — real FontFace installs kept in IndexedDB
  // =====================================================================
  const FontsRegistry = (function () {
    const WEB = ["Nunito", "Google Sans", "Poppins", "Montserrat", "Playfair Display", "Oswald", "Lobster", "Pacifico", "Bebas Neue", "Dancing Script", "Roboto Slab"];
    const SYSTEM = ["Segoe UI", "Segoe UI Variable", "Segoe Print", "Segoe Script", "Arial", "Arial Black", "Bahnschrift", "Calibri", "Cambria", "Candara", "Comic Sans MS", "Consolas", "Constantia", "Corbel", "Courier New", "Franklin Gothic Medium", "Gabriola", "Georgia", "Impact", "Ink Free", "Lucida Console", "Lucida Sans Unicode", "Palatino Linotype", "Sitka", "Sylfaen", "Tahoma", "Times New Roman", "Trebuchet MS", "Verdana",
      "Helvetica", "Helvetica Neue", "Avenir", "Avenir Next", "Futura", "Gill Sans", "Optima", "Baskerville", "Didot", "American Typewriter", "Chalkboard SE", "Marker Felt", "Noteworthy", "Papyrus", "Menlo", "Monaco", "SF Mono", "Hoefler Text", "Rockwell", "Garamond",
      "DejaVu Sans", "DejaVu Serif", "DejaVu Sans Mono", "Liberation Sans", "Liberation Serif", "Liberation Mono", "Noto Sans", "Noto Serif", "Ubuntu", "Roboto", "Open Sans", "Cantarell", "FreeSans", "FreeSerif"];
    const faces = new Map();      // id -> FontFace
    let installed = [];           // [{ id, family, file, format, size, ts }]
    let sysCache = null;
    const listeners = new Set();
    const emit = () => { listeners.forEach((f) => { try { f(); } catch (_) {} }); try { window.dispatchEvent(new CustomEvent("fonts-change")); } catch (_) {} };

    // Canvas measurement against three generic fallbacks: if any width differs, the font exists.
    function detect(f) {
      try {
        const c = (detect.c = detect.c || document.createElement("canvas").getContext("2d")), t = "mmmmmmmmmmlliWW@#1";
        return ["monospace", "serif", "sans-serif"].some((b) => { c.font = "72px " + b; const w0 = c.measureText(t).width; c.font = "72px '" + f + "', " + b; return c.measureText(t).width !== w0; });
      } catch (_) { return false; }
    }
    function systemFonts() { if (!sysCache) sysCache = SYSTEM.filter(detect); return sysCache; }
    function webFonts() {
      const set = new Set();
      try { document.fonts.forEach((f) => { const fam = f.family.replace(/["']/g, ""); if (WEB.includes(fam)) set.add(fam); }); } catch (_) {}
      return [...set];
    }
    function list() {
      const out = [], seen = new Set();
      installed.forEach((f) => { if (!seen.has(f.family)) { seen.add(f.family); out.push({ family: f.family, source: "installed", id: f.id, file: f.file, size: f.size, ts: f.ts }); } });
      webFonts().forEach((f) => { if (!seen.has(f)) { seen.add(f); out.push({ family: f, source: "web" }); } });
      systemFonts().forEach((f) => { if (!seen.has(f)) { seen.add(f); out.push({ family: f, source: "system" }); } });
      return out.sort((a, b) => a.family.localeCompare(b.family));
    }

    // ---- read the family name from the font file (TrueType / OpenType / WOFF; WOFF2 → file name) ----
    async function inflate(u8) {
      if (typeof DecompressionStream === "undefined") throw new Error("no DecompressionStream");
      const ds = new DecompressionStream("deflate"); const w = ds.writable.getWriter(); w.write(u8); w.close();
      return new Uint8Array(await new Response(ds.readable).arrayBuffer());
    }
    function readName(u8) {
      const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
      const count = dv.getUint16(2), strOff = dv.getUint16(4);
      let best = null, bestScore = -1;
      for (let i = 0; i < count; i++) {
        const r = 6 + i * 12, pid = dv.getUint16(r), eid = dv.getUint16(r + 2), lid = dv.getUint16(r + 4), nid = dv.getUint16(r + 6), len = dv.getUint16(r + 8), off = dv.getUint16(r + 10);
        if (nid !== 1 && nid !== 16) continue;
        const bytes = u8.subarray(strOff + off, strOff + off + len);
        let s = "";
        if (pid === 3 || pid === 0) { for (let k = 0; k + 1 < bytes.length; k += 2) s += String.fromCharCode((bytes[k] << 8) | bytes[k + 1]); }
        else if (pid === 1) s = String.fromCharCode.apply(null, bytes);
        else continue;
        const score = (nid === 16 ? 4 : 0) + (pid === 3 ? 2 : 0) + (lid === 0x409 || lid === 0 ? 1 : 0); void eid;
        if (s.trim() && score > bestScore) { best = s.trim(); bestScore = score; }
      }
      return best;
    }
    async function familyOf(buf, fileName) {
      const u8 = new Uint8Array(buf); const dv = new DataView(buf);
      const tag = String.fromCharCode(u8[0], u8[1], u8[2], u8[3]);
      try {
        if (tag === "wOFF") {
          const n = dv.getUint16(12);
          for (let i = 0; i < n; i++) {
            const r = 44 + i * 20, t = String.fromCharCode(u8[r], u8[r + 1], u8[r + 2], u8[r + 3]);
            if (t !== "name") continue;
            const off = dv.getUint32(r + 4), comp = dv.getUint32(r + 8), orig = dv.getUint32(r + 12);
            let tb = u8.slice(off, off + comp); if (comp < orig) tb = await inflate(tb);
            return readName(tb);
          }
        } else if (tag === "\u0000\u0001\u0000\u0000" || tag === "OTTO" || tag === "true" || tag === "ttcf") {
          let base = 0; if (tag === "ttcf") base = dv.getUint32(12);
          const n = dv.getUint16(base + 4);
          for (let i = 0; i < n; i++) {
            const r = base + 12 + i * 16, t = String.fromCharCode(u8[r], u8[r + 1], u8[r + 2], u8[r + 3]);
            if (t === "name") { const off = dv.getUint32(r + 8), len = dv.getUint32(r + 12); return readName(u8.subarray(off, off + len)); }
          }
        }
      } catch (e) { console.warn("[Fonts] name table", e); }
      return String(fileName || "Font").replace(/\.(ttf|otf|woff2?|ttc)$/i, "").replace(/[-_](regular|bold|italic|light|medium|semibold|black|thin)$/i, "").replace(/[-_]+/g, " ").trim() || "Font";
    }
    const FORMAT = { ttf: "TrueType", otf: "OpenType", ttc: "TrueType Collection", woff: "WOFF", woff2: "WOFF2" };

    async function register(rec) {
      const face = new FontFace(rec.family, rec.bytes);
      await face.load();
      document.fonts.add(face);
      faces.set(rec.id, face);
    }
    async function install(buf, fileName) {
      if (!(buf instanceof ArrayBuffer)) buf = await new Response(buf).arrayBuffer();
      if (!buf.byteLength) throw new Error("The file is empty.");
      const ext = extOf(fileName);
      if (!/^(ttf|otf|woff2?|ttc)$/.test(ext)) throw new Error("“" + fileName + "” isn't a font file (.ttf, .otf, .woff, .woff2).");
      const family = await familyOf(buf, fileName);
      // Validate with the real FontFace API before keeping anything.
      try { const test = new FontFace("su-test-" + now(), buf.slice(0)); await test.load(); } catch (e) { throw new Error("“" + fileName + "” isn't a valid font file."); }
      const old = installed.find((f) => f.family.toLowerCase() === family.toLowerCase());
      if (old) await uninstall(old.id, true);
      const rec = { id: uid("f"), family, file: fileName, format: FORMAT[ext] || ext.toUpperCase(), size: buf.byteLength, ts: now(), bytes: buf };
      await idbPut("fonts", rec.id, rec);
      await register(rec);
      installed.push({ id: rec.id, family, file: fileName, format: rec.format, size: rec.size, ts: rec.ts });
      // Show it in C:\Windows\Fonts too (the bytes stay in the fonts store, not on the encryptable drive).
      try { const f = nodeAt([SYS, "Windows", "Fonts"]); if (f && f.children) { f.children[fileName] = { type: "file", kind: "font", fontId: rec.id, size: rec.size, ts: rec.ts, mime: "font/" + ext }; changed(); } } catch (_) {}
      log("Application", "Information", "Microsoft-Windows-Font", 1, "Font installed: " + family + " (" + fileName + ", " + fmtBytes(rec.size) + ").");
      emit();
      return family;
    }
    async function uninstall(id, quiet) {
      const f = installed.find((x) => x.id === id); if (!f) return false;
      const face = faces.get(id); if (face) { try { document.fonts.delete(face); } catch (_) {} faces.delete(id); }
      await idbDel("fonts", id).catch(() => {});
      installed = installed.filter((x) => x.id !== id);
      try { const dir = nodeAt([SYS, "Windows", "Fonts"]); if (dir && dir.children) Object.keys(dir.children).forEach((k) => { if (dir.children[k] && dir.children[k].fontId === id) delete dir.children[k]; }); changed(); } catch (_) {}
      if (!quiet) { log("Application", "Information", "Microsoft-Windows-Font", 2, "Font uninstalled: " + f.family + "."); emit(); }
      return true;
    }
    async function load() {
      try {
        const all = await idbAll("fonts");
        for (const { value: r } of all) { try { await register(r); installed.push({ id: r.id, family: r.family, file: r.file, format: r.format, size: r.size, ts: r.ts }); } catch (e) { console.warn("[Fonts] couldn't load", r && r.file, e); } }
      } catch (e) { console.warn("[Fonts] store", e); }
      emit();
    }
    // Word's font box (and any <select data-font-picker>) gets the installed fonts.
    function patchPickers(scope) {
      const fams = new Set(installed.map((f) => f.family));
      (scope || document).querySelectorAll("select.wd-font, select[data-font-picker]").forEach((s) => {
        // only touch the DOM when something changed (a MutationObserver calls this)
        s.querySelectorAll("option.su-fopt").forEach((o) => { if (!fams.has(o.value) && o.value !== s.value) o.remove(); });
        const have = new Set([...s.options].map((o) => o.value));
        installed.forEach((f) => { if (have.has(f.family)) return; const o = document.createElement("option"); o.className = "su-fopt"; o.value = f.family; o.textContent = f.family; o.style.fontFamily = "'" + f.family + "'"; s.appendChild(o); });
      });
    }
    // Pick font files from This PC (the virtual file system).
    function vfsFontFiles() { const out = []; walk((n, name, p) => { if (n.type === "file" && /\.(ttf|otf|woff2?|ttc)$/i.test(name) && n.kind !== "font" && (n.blob || n.src || n.content)) out.push({ name, node: n, path: p }); }); return out; }
    async function bytesOfNode(n) {
      if (n.blob && window.VFS && VFS.getBlob) { const b = await VFS.getBlob(n.blob); if (b) return b.arrayBuffer(); throw new Error("This file's contents aren't on this device (or drive C: is locked)."); }
      const s = n.src || n.content;
      if (typeof s === "string" && /^data:/.test(s)) return (await fetch(s)).arrayBuffer();
      throw new Error("This file has no font data.");
    }
    return { list, install, uninstall, load, patchPickers, vfsFontFiles, bytesOfNode, familyOf, installed: () => installed.slice(), detect, on(fn) { listeners.add(fn); return () => listeners.delete(fn); }, emit };
  })();

  // ---- Settings ▸ Personalization ▸ Fonts ----
  function fontSample(f, size, text) { return `<div class="su-font-sample" style="font-family:'${esc(f)}', var(--su-fallback);font-size:${size}px">${esc(text)}</div>`; }
  function pickDeviceFonts(done) {
    const inp = document.createElement("input"); inp.type = "file"; inp.multiple = true; inp.accept = ".ttf,.otf,.woff,.woff2,.ttc,font/ttf,font/otf,font/woff,font/woff2";
    inp.onchange = async () => { const files = [...(inp.files || [])]; const res = []; for (const f of files) { try { res.push({ ok: true, family: await FontsRegistry.install(await f.arrayBuffer(), f.name) }); } catch (e) { res.push({ ok: false, msg: e.message }); } } done(res); };
    inp.click();
  }
  async function pickVfsFonts(done) {
    const files = FontsRegistry.vfsFontFiles();
    if (!files.length) { await alertBox("Install fonts from This PC", "<p>There are no .ttf, .otf, .woff or .woff2 files on This PC yet. Copy a font into Downloads or Documents first (drag it into File Explorer), or use “Browse and install fonts” to pick one from your device.</p>"); return; }
    const v = await dialog({ title: "Install fonts from This PC", html: `<div class="su-vfslist">${files.map((f, i) => `<label class="su-chk"><input type="checkbox" value="${i}"> ${esc(f.name)} <span class="su-dim">${esc(winPath(f.path))}</span></label>`).join("")}</div>`, buttons: [{ label: "Install", primary: true, onClick: (api) => [...api.content.querySelectorAll("input:checked")].map((x) => +x.value) }, { label: "Cancel", value: null }] });
    if (!v || !v.length) return;
    const res = [];
    for (const i of v) { const f = files[i]; try { res.push({ ok: true, family: await FontsRegistry.install(await FontsRegistry.bytesOfNode(f.node), f.name) }); } catch (e) { res.push({ ok: false, msg: e.message }); } }
    done(res);
  }
  registerSub("su-fonts", { title: "Fonts", parent: "personal", build(h, redraw) {
    const st = { q: "", size: 32, text: "" };
    const add = el(`<div class="w12s-card su-fadd"><div class="su-fadd-drop" tabindex="0">${ic("upload", 26)}<div><b>Add fonts</b><div class="su-dim">Drag and drop font files (.ttf, .otf, .woff, .woff2) here to install them</div></div></div>
      <div class="su-btnrow"><button type="button" class="w12s-btn" data-a="dev">Browse and install fonts</button><button type="button" class="w12s-btn" data-a="vfs">Install from This PC…</button></div><div class="su-fmsg su-dim" role="status"></div></div>`);
    h.appendChild(add);
    const msg = add.querySelector(".su-fmsg");
    const report = (res) => { msg.textContent = res.map((r) => r.ok ? "Installed " + r.family : r.msg).join(" · "); paint(); };
    add.querySelector('[data-a="dev"]').onclick = () => pickDeviceFonts(report);
    add.querySelector('[data-a="vfs"]').onclick = () => pickVfsFonts(report);
    const drop = add.querySelector(".su-fadd-drop");
    drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
    drop.addEventListener("dragleave", () => drop.classList.remove("over"));
    drop.addEventListener("drop", async (e) => { e.preventDefault(); drop.classList.remove("over"); const res = []; for (const f of [...(e.dataTransfer.files || [])]) { try { res.push({ ok: true, family: await FontsRegistry.install(await f.arrayBuffer(), f.name) }); } catch (er) { res.push({ ok: false, msg: er.message }); } } report(res); });
    drop.onclick = () => pickDeviceFonts(report);
    h.appendChild(el(`<div class="su-s-h">Available fonts</div>`));
    const tools = el(`<div class="su-ftools"><label class="su-fsearch">${ic("search", 16)}<input placeholder="Type here to search" aria-label="Search fonts" data-no-eye></label><label class="su-fsize">Size <input type="range" min="12" max="96" value="32" aria-label="Preview size"><span>32</span></label><input class="su-input su-ftext" placeholder="Type here to preview" aria-label="Preview text"></div>`);
    h.appendChild(tools);
    const grid = el(`<div class="su-fgrid"></div>`); h.appendChild(grid);
    tools.querySelector(".su-fsearch input").oninput = (e) => { st.q = e.target.value.trim().toLowerCase(); paint(); };
    tools.querySelector(".su-fsize input").oninput = (e) => { st.size = +e.target.value; tools.querySelector(".su-fsize span").textContent = st.size; grid.querySelectorAll(".su-font-sample").forEach((s) => (s.style.fontSize = st.size + "px")); };
    tools.querySelector(".su-ftext").oninput = (e) => { st.text = e.target.value; grid.querySelectorAll(".su-font-sample").forEach((s) => (s.textContent = st.text || "The quick brown fox jumps over the lazy dog.")); };
    function paint() {
      if (!grid.isConnected) return;
      const all = FontsRegistry.list().filter((f) => !st.q || f.family.toLowerCase().includes(st.q));
      grid.innerHTML = "";
      all.forEach((f) => {
        const card = el(`<button type="button" class="su-fcard">${fontSample(f.family, st.size, st.text || "The quick brown fox jumps over the lazy dog.")}<div class="su-fname"><b>${esc(f.family)}</b><span class="su-dim">${f.source === "installed" ? "Installed by you · " + esc(f.file) : f.source === "web" ? "Web font (loaded by this page)" : "Found on your device"}</span></div></button>`);
        card.onclick = () => detail(f);
        grid.appendChild(card);
      });
      if (!all.length) grid.appendChild(el(`<div class="w12s-empty">No fonts match “${esc(st.q)}”.</div>`));
    }
    function detail(f) {
      h.innerHTML = "";
      const back = el(`<button type="button" class="su-link su-back">‹ All fonts</button>`); back.onclick = redraw; h.appendChild(back);
      const card = el(`<div class="w12s-card su-fdetail"><h2 class="su-h2" style="font-family:'${esc(f.family)}'">${esc(f.family)}</h2>
        <label class="su-fsize">Change font size <input type="range" min="12" max="120" value="48"><span>48</span></label>
        <input class="su-input su-ftext" placeholder="Type here to preview the font" value="${esc(st.text)}">
        <div class="su-fprev">${[["Regular", 400, ""], ["Bold", 700, ""], ["Italic", 400, "italic"]].map(([n, w, s]) => `<div><span class="su-dim">${n}</span><div class="su-font-sample" style="font-family:'${esc(f.family)}';font-weight:${w};font-style:${s || "normal"};font-size:48px">${esc(st.text || "The quick brown fox jumps over the lazy dog.")}</div></div>`).join("")}</div>
        <div class="su-font-sample su-charset" style="font-family:'${esc(f.family)}'">ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789 !@#$%&amp;*()</div>
        <h3 class="su-h3">Metadata</h3><table class="su-kv"><tr><td>Full name:</td><td>${esc(f.family)}</td></tr><tr><td>Source:</td><td>${f.source === "installed" ? "Installed from “" + esc(f.file) + "” (" + esc(fmtBytes(f.size)) + ") · kept in IndexedDB" : f.source === "web" ? "Google Fonts, loaded by this page" : "Detected on your device by measuring text"}</td></tr>${f.source === "installed" ? `<tr><td>Installed:</td><td>${esc(fmtWhen(f.ts))}</td></tr>` : ""}</table>
        ${f.source === "installed" ? `<button type="button" class="w12s-btn su-danger" data-a="un">Uninstall</button>` : `<p class="su-dim">Fonts that come with your device or this page can't be uninstalled.</p>`}</div>`);
      h.appendChild(card);
      const r = card.querySelector('input[type="range"]');
      r.oninput = () => { card.querySelector(".su-fsize span").textContent = r.value; card.querySelectorAll(".su-fprev .su-font-sample").forEach((s) => (s.style.fontSize = r.value + "px")); };
      card.querySelector(".su-ftext").oninput = (e) => { st.text = e.target.value; card.querySelectorAll(".su-fprev .su-font-sample").forEach((s) => (s.textContent = st.text || "The quick brown fox jumps over the lazy dog.")); };
      const un = card.querySelector('[data-a="un"]');
      if (un) un.onclick = async () => { if (await confirmBox("Uninstall " + f.family, "Are you sure you want to permanently uninstall this font family?", "Uninstall")) { await FontsRegistry.uninstall(f.id); redraw(); } };
    }
    paint();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => paint());
    const off = FontsRegistry.on(() => { if (!grid.isConnected) { off(); return; } paint(); });
  } });
  ENH.push((page, list, info) => {
    if (info.sub || !T.personal.includes(info.title)) return;
    const r = srow("font", "Fonts", "Install, manage", { onClick: () => renderSub(page, "su-fonts") }); r.classList.add("su-inject");
    const rows = list.querySelectorAll(":scope > .w12s-row");
    if (rows[3]) list.insertBefore(r, rows[3].nextSibling); else list.appendChild(r);
  });
  // Control Panel ▸ Fonts
  function cpFonts(main) {
    const box = el(`<div class="su-cpfonts"><p class="st-dim">Preview, delete, or show and hide the fonts installed on your computer. Drop .ttf, .otf, .woff or .woff2 files here to install them.</p><div class="st-cmdbar"><button class="st-cmd" data-a="dev">Install fonts…</button><button class="st-cmd" data-a="vfs">Install from This PC…</button><button class="st-cmd" data-a="set">Font settings</button><span class="st-grow"></span></div><div class="st-fonts su-cpf-grid"></div><div class="su-dim su-cpf-msg"></div></div>`);
    main.appendChild(box);
    const grid = box.querySelector(".su-cpf-grid");
    const paint = () => { if (!grid.isConnected) return; grid.innerHTML = ""; FontsRegistry.list().forEach((f) => { const t = el(`<div class="st-font su-cpf ${f.source === "installed" ? "mine" : ""}" title="${esc(f.family)}"><div class="st-font-a" style="font-family:'${esc(f.family)}'">Abg</div><div class="st-font-n">${esc(f.family)}</div>${f.source === "installed" ? `<button class="su-cpf-x" title="Uninstall">✕</button>` : ""}</div>`); const x = t.querySelector(".su-cpf-x"); if (x) x.onclick = async () => { if (await confirmBox("Delete Font", "Are you sure you want to permanently delete " + esc(f.family) + "?", "Yes")) FontsRegistry.uninstall(f.id); }; grid.appendChild(t); }); };
    const report = (res) => { box.querySelector(".su-cpf-msg").textContent = res.map((r) => r.ok ? "Installed " + r.family : r.msg).join(" · "); };
    box.querySelector('[data-a="dev"]').onclick = () => pickDeviceFonts(report);
    box.querySelector('[data-a="vfs"]').onclick = () => pickVfsFonts(report);
    box.querySelector('[data-a="set"]').onclick = () => openSettingsSub("su-fonts");
    box.addEventListener("dragover", (e) => e.preventDefault());
    box.addEventListener("drop", async (e) => { e.preventDefault(); const res = []; for (const f of [...(e.dataTransfer.files || [])]) { try { res.push({ ok: true, family: await FontsRegistry.install(await f.arrayBuffer(), f.name) }); } catch (er) { res.push({ ok: false, msg: er.message }); } } report(res); });
    paint();
    const off = FontsRegistry.on(() => { if (!grid.isConnected) { off(); return; } paint(); });
  }

  // =====================================================================
  //  6. SEARCH INDEXING (window.SearchIndex) — inverted index of names + text in IndexedDB
  // =====================================================================
  const SearchIndex = (function () {
    const USER_TOP = ["Desktop", "Documents", "Downloads", "Pictures", "Videos", "Music", "OneDrive", "Homework", "Education", "Math", "3D Models"];
    const DEF_EXCL = [SYS + "/Windows", SYS + "/Program Files", SYS + "/Program Files (x86)", SYS + "/ProgramData"];
    const TEXT_EXT = /\.(txt|md|csv|tsv|json|js|mjs|ts|css|html?|xml|py|java|c|cpp|h|cs|go|rb|php|rs|sh|bat|ps1|ini|cfg|log|yml|yaml|sql|srt|vtt|svg)$/i;
    const docs = new Map();       // key -> { key, path, name, kind, sig, terms: [], pv }
    const post = new Map();       // term -> Set(key)
    let state = "idle", pending = 0, loaded = false, paused = 0, lastBuilt = 0;
    const listeners = new Set();
    const emit = () => listeners.forEach((f) => { try { f(); } catch (_) {} });
    const dbKey = () => "idx2::" + ((window.State && State.STORAGE_KEY) || "win12_state_v1");
    function cfg() {
      const a = AD(); let c = a.searchIdx;
      if (!c || typeof c !== "object") c = a.searchIdx = {};
      if (!c.mode) c.mode = "classic";
      if (!Array.isArray(c.excl)) c.excl = DEF_EXCL.slice();
      if (!Array.isArray(c.extra)) c.extra = [];          // extra included folders in Classic mode
      if (c.contents == null) c.contents = true;
      return c;
    }
    const cfgSig = () => { const c = cfg(); return [c.mode, c.excl.join("|"), c.extra.join("|"), c.contents].join("#"); };
    function inScope(path) {
      const c = cfg(), k = path.join("/");
      if (c.excl.some((e) => k === e || k.startsWith(e + "/"))) return false;
      if (c.mode === "enhanced") return true;
      return USER_TOP.includes(path[0]) || c.extra.some((e) => k === e || k.startsWith(e + "/"));
    }
    function tokenize(s, cap) {
      const out = new Set();
      const m = String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").match(/[\p{L}\p{N}]+/gu) || [];
      for (const t of m) { if (t.length < 2 && !/\d/.test(t)) continue; out.add(t.slice(0, 40)); if (cap && out.size >= cap) break; }
      return [...out];
    }
    const sigOf = (n) => [n.ts || 0, n.size || 0, typeof n.content === "string" ? n.content.length : 0, n.bl ? "L" : "", n.blob || "", typeof n.src === "string" ? n.src.length : 0].join(":");
    function htmlText(h) { return String(h || "").replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;|&quot;/g, " "); }
    function jsonStrings(o, out, depth) { if (depth > 12 || out.length > 20000) return out; if (typeof o === "string") { if (!/^data:|^blob:|^#[0-9a-f]{3,8}$/i.test(o) && o.length < 5000) out.push(o); } else if (Array.isArray(o)) o.forEach((x) => jsonStrings(x, out, depth + 1)); else if (o && typeof o === "object") Object.keys(o).forEach((k) => jsonStrings(o[k], out, depth + 1)); return out; }
    async function textOf(name, n) {
      if (!cfg().contents) return "";
      if (BitLocker.isLockedNode(n)) return "";
      const c = n.content;
      if (typeof c === "string" && c && !/^data:/.test(c)) {
        if (n.kind === "word" || /\.(docx?|html?)$/i.test(name)) return htmlText(c);
        if (n.kind === "xlsx" || n.kind === "pptx") { try { return jsonStrings(JSON.parse(c), [], 0).map(htmlText).join(" "); } catch (_) { return htmlText(c); } }
        return c;
      }
      if (n.blob && TEXT_EXT.test(name) && (n.size || 0) <= 1048576 && window.VFS && VFS.getBlob) { try { const b = await VFS.getBlob(n.blob); if (b && b.size <= 1048576) return await b.text(); } catch (_) {} }
      return "";
    }
    function removeDoc(key) { const d = docs.get(key); if (!d) return; d.terms.forEach((t) => { const s = post.get(t); if (s) { s.delete(key); if (!s.size) post.delete(t); } }); docs.delete(key); }
    function addDoc(d) { removeDoc(d.key); docs.set(d.key, d); d.terms.forEach((t) => { let s = post.get(t); if (!s) post.set(t, (s = new Set())); s.add(d.key); }); }
    async function indexOne(path, name, n) {
      const txt = await textOf(name, n);
      const terms = tokenize(name.replace(/\.[^.]+$/, "") + " " + extOf(name) + " " + txt, 4000);
      const pv = txt ? txt.replace(/\s+/g, " ").trim().slice(0, 200) : "";
      addDoc({ key: path.concat(name).join("/"), path: path.slice(), name, kind: n.kind || "", sig: sigOf(n), terms, pv, ts: n.ts || 0 });
    }
    let running = null, again = false, persistT = 0;
    function update() {
      if (running) { again = true; return running; }
      running = (async () => {
        await null;   // let `running` be assigned before the finally below can clear it
        try {
          do {
            again = false;
            if (paused > now()) break;
            const seen = new Set(), todo = [];
            walk((n, name, p) => {
              if (n.type === "folder") { const fk = p.concat(name).join("/"); return cfg().excl.some((e) => fk === e || fk.startsWith(e + "/")) ? false : undefined; }
              if (n.type !== "file" || n.hidden || n.kind === "shortcut" || !inScope(p)) return;
              const key = p.concat(name).join("/"); seen.add(key);
              const d = docs.get(key); if (!d || d.sig !== sigOf(n)) todo.push([p, name, n]);
            });
            [...docs.keys()].forEach((k) => { if (!seen.has(k)) removeDoc(k); });
            pending = todo.length; state = todo.length ? "indexing" : "idle"; emit();
            let i = 0;
            for (const [p, name, n] of todo) { await indexOne(p, name, n); pending--; if (++i % 20 === 0) { emit(); await sleep(0); } }
            state = "idle"; pending = 0; lastBuilt = now(); emit();
            if (todo.length) persistSoon();
          } while (again);
        } catch (e) { console.error("[SearchIndex]", e); state = "idle"; }
        finally { running = null; }
      })();
      return running;
    }
    // While BitLocker is on, the index stays in memory only (its terms would leak encrypted text).
    function persistSoon() { if (persistT) return; persistT = setTimeout(() => { persistT = 0; persist(); }, 1200); }
    function persist() {
      if (BitLocker.isOn()) { idbDel("index", dbKey()).catch(() => {}); return; }
      const rows = [...docs.values()].map((d) => [d.key, d.name, d.kind, d.sig, d.terms, d.pv, d.ts]);
      idbPut("index", dbKey(), { v: 1, cfg: cfgSig(), at: now(), rows }).catch((e) => console.warn("[SearchIndex] save", e));
    }
    async function load() {
      try {
        const r = await idbGet("index", dbKey());
        if (r && r.v === 1 && r.cfg === cfgSig() && Array.isArray(r.rows) && !BitLocker.isOn()) r.rows.forEach(([key, name, kind, sig, terms, pv, ts]) => addDoc({ key, path: key.split("/").slice(0, -1), name, kind, sig, terms: terms || [], pv: pv || "", ts: ts || 0 }));
      } catch (_) {}
      loaded = true; emit();
      return update();
    }
    function rebuild() { docs.clear(); post.clear(); idbDel("index", dbKey()).catch(() => {}); log("Application", "Information", "Microsoft-Windows-Search", 1013, "The search index is being rebuilt (requested by " + userName() + ")."); return update(); }
    let soonT = 0;
    // throttled (not debounced): frequent saves elsewhere must not starve the index
    function soon() { if (soonT) return; soonT = setTimeout(() => { soonT = 0; update(); }, 1500); }
    function query(q, limit) {
      const qs = String(q || "").trim(); if (!qs) return [];
      const terms = tokenize(qs); const ql = qs.toLowerCase();
      const score = new Map();
      const bump = (k, v) => score.set(k, (score.get(k) || 0) + v);
      if (terms.length) {
        let cand = null;
        terms.forEach((t, i) => {
          const hit = new Set();
          const last = i === terms.length - 1;
          if (post.has(t)) post.get(t).forEach((k) => hit.add(k));
          if (last || t.length >= 3) post.forEach((set, term) => { if (term !== t && term.startsWith(t)) set.forEach((k) => hit.add(k)); });
          cand = cand ? new Set([...cand].filter((k) => hit.has(k))) : hit;
        });
        (cand || new Set()).forEach((k) => bump(k, 1));
      }
      docs.forEach((d, k) => {
        const nm = d.name.toLowerCase();
        if (nm === ql) bump(k, 30); else if (nm.startsWith(ql)) bump(k, 14); else if (nm.includes(ql)) bump(k, 8);
        else if (terms.length && terms.every((t) => tokenize(nm).some((x) => x.startsWith(t)))) bump(k, 5);
      });
      const out = [];
      score.forEach((s, k) => {
        const d = docs.get(k); if (!d) return;
        const node = nodeAt(d.path.concat(d.name)); if (!node || node.type !== "file") return;
        const nameHit = d.name.toLowerCase().includes(ql) || terms.every((t) => tokenize(d.name).some((x) => x.startsWith(t)));
        let snip = "";
        if (!nameHit && d.pv) { const i = d.pv.toLowerCase().indexOf(terms[0] || ql); snip = i >= 0 ? (i > 40 ? "…" : "") + d.pv.slice(Math.max(0, i - 40), i + 80) : d.pv.slice(0, 100); }
        out.push({ key: k, path: d.path, name: d.name, node, score: s + Math.min(1, (d.ts || 0) / 1e13), where: nameHit ? "name" : "content", snippet: snip });
      });
      return out.sort((a, b) => b.score - a.score || (b.node.ts || 0) - (a.node.ts || 0)).slice(0, limit || 20);
    }
    function status() { return { state: paused > now() ? "paused" : state, count: docs.size, pending, terms: post.size, mode: cfg().mode, loaded, lastBuilt, persisted: !BitLocker.isOn() }; }
    function start() {
      cfg();
      window.addEventListener("vfs-change", soon);
      if (window.State && State.onSave) State.onSave(soon);
      BitLocker.on(soon);
      setTimeout(load, 2500);
    }
    function setMode(m) { cfg().mode = m === "enhanced" ? "enhanced" : "classic"; save(); emit(); return update(); }
    function setExcl(list) { cfg().excl = list.slice(); save(); emit(); return update(); }
    function pause(ms) { paused = now() + (ms || 15 * MIN); emit(); setTimeout(() => { emit(); update(); }, (ms || 15 * MIN) + 50); }
    return { cfg, update, rebuild, query, status, start, setMode, setExcl, inScope, tokenize, pause, resume: () => { paused = 0; emit(); update(); }, USER_TOP, on(fn) { listeners.add(fn); return () => listeners.delete(fn); } };
  })();

  // ---- folder picker (for exclusions / included locations) ----
  function folderChoices(maxDepth) {
    const out = [];
    walk((n, name, p) => { if (n.type !== "folder") return; const path = p.concat(name); out.push(path.join("/")); if (path.length >= (maxDepth || 3)) return false; });
    return out;
  }
  const prettyPath = (k) => winPath(k.split("/"));
  registerSub("su-searching", { title: "Searching Windows", parent: "privacy", build(h, redraw) {
    const c = SearchIndex.cfg();
    const stc = el(`<div class="w12s-card su-idxst"></div>`); h.appendChild(stc);
    const paintSt = () => { if (!stc.isConnected) return; const s = SearchIndex.status(); stc.innerHTML = `<div class="su-idxst-h">${ic("search", 20)}<div><b>Indexing status</b><div class="su-dim">${s.state === "indexing" ? "Indexing in progress — " + s.pending + " items left" : s.state === "paused" ? "Indexing is paused" : "Indexed: " + s.count + " items · " + s.terms + " words · Pending: 0"}</div><div class="su-dim">${s.persisted ? "The index is saved on this device (IndexedDB)." : "BitLocker is on, so the index is kept in memory only and rebuilt each time."}</div></div></div>`; };
    paintSt();
    const off = SearchIndex.on(() => { if (!stc.isConnected) { off(); return; } paintSt(); });
    h.appendChild(el(`<div class="su-s-h">Find my files</div>`));
    const mode = el(`<div class="w12s-card su-modecard"><label class="su-opt"><input type="radio" name="su-im" value="classic" ${c.mode === "classic" ? "checked" : ""}> <span><b>Classic</b><br><span class="su-dim">Only search your documents, pictures, music, videos and desktop folders.</span></span></label><label class="su-opt"><input type="radio" name="su-im" value="enhanced" ${c.mode === "enhanced" ? "checked" : ""}> <span><b>Enhanced</b><br><span class="su-dim">Search your entire PC, including your libraries and desktop — except the excluded folders below.</span></span></label></div>`);
    mode.querySelectorAll("input").forEach((r) => r.onchange = () => { SearchIndex.setMode(r.value); redraw(); });
    h.appendChild(mode);
    h.appendChild(el(`<div class="su-s-h">Exclude folders from enhanced search</div>`));
    const ex = el(`<div class="w12s-card su-excl"></div>`); h.appendChild(ex);
    const paintEx = () => {
      ex.innerHTML = c.excl.map((k, i) => `<div class="su-excl-row">${ic("folder", 16)}<span>${esc(prettyPath(k))}</span><button type="button" class="su-link" data-i="${i}">Remove</button></div>`).join("") || `<div class="su-dim">No folders are excluded.</div>`;
      ex.appendChild(el(`<button type="button" class="w12s-btn su-addex">Add an excluded folder</button>`));
      ex.querySelectorAll("[data-i]").forEach((b) => b.onclick = () => { const l = c.excl.slice(); l.splice(+b.dataset.i, 1); SearchIndex.setExcl(l); paintEx(); });
      ex.querySelector(".su-addex").onclick = async () => {
        const opts = folderChoices(3).filter((k) => !c.excl.includes(k));
        const v = await dialog({ title: "Add an excluded folder", html: `<label class="rc-field"><span>Folder</span><select class="rc-input su-exsel">${opts.map((k) => `<option value="${esc(k)}">${esc(prettyPath(k))}</option>`).join("")}</select></label>`, buttons: [{ label: "Exclude Folder", primary: true, onClick: (api) => api.content.querySelector(".su-exsel").value }, { label: "Cancel", value: null }] });
        if (v) { SearchIndex.setExcl(c.excl.concat([v])); paintEx(); }
      };
    };
    paintEx();
    h.appendChild(el(`<div class="su-s-h">Related settings</div>`));
    h.appendChild(srow("refresh", "Rebuild index", "Delete and rebuild the search index from scratch", { ctl: (() => { const b = el(`<button type="button" class="w12s-btn">Rebuild</button>`); b.onclick = (e) => { e.stopPropagation(); SearchIndex.rebuild(); }; return b; })() }));
    h.appendChild(srow("search", "Index file contents", "Search inside text files and Office documents, not just their names", { ctl: toggleEl(c.contents, (v) => { c.contents = v; save(); SearchIndex.rebuild(); }, "Index contents") }));
    h.appendChild(srow("info", "Advanced indexing options", "Control Panel ▸ Indexing Options", { onClick: () => { window.ControlPanelStartPage = "indexing"; WM.open("controlpanel"); } }));
  } });
  ENH.push((page, list, info) => {
    if (info.sub || !T.privacy.includes(info.title)) return;
    const r = srow("search", "Searching Windows", "Search indexing for faster results, Find my files, folders excluded from search", { onClick: () => renderSub(page, "su-searching") }); r.classList.add("su-inject");
    list.appendChild(r);
    // "Device encryption" opens BitLocker Drive Encryption.
    const de = [...list.querySelectorAll(".w12s-row")].find((x) => { const t = x.querySelector(".w12s-row-t"); return t && /^(Device encryption|Enhetskryptering)$/.test(t.textContent.trim()); });
    if (de) {
      de.classList.remove("w12s-row-static"); de.classList.add("w12s-click"); de.tabIndex = 0;
      const s = de.querySelector(".w12s-row-s"); if (s) s.textContent = "BitLocker: " + BLUI.label().replace(/^BitLocker /, "") + " — help protect your data with encryption";
      de.onclick = () => { window.ControlPanelStartPage = "bitlocker"; WM.open("controlpanel"); };
    }
  });
  // Control Panel ▸ Indexing Options
  function cpIndexing(main, side, nav) {
    const box = el(`<div class="su-idx"></div>`); main.appendChild(box);
    const paint = () => {
      if (!box.isConnected) return;
      const s = SearchIndex.status(), c = SearchIndex.cfg();
      const incl = c.mode === "enhanced" ? [["(Entire PC)", ""]] : SearchIndex.USER_TOP.filter((k) => root()[k]).map((k) => [k, ""]).concat(c.extra.map((k) => [k, ""]));
      box.innerHTML = `<div class="su-idx-top"><b>${s.count} items indexed</b><div class="su-dim">${s.state === "indexing" ? "Indexing in progress. Search results might not be complete during this time." : s.state === "paused" ? "Indexing is paused." : "Indexing complete."}</div></div>
        <div class="st-tablewrap"><table class="st-table"><thead><tr><th>Included Locations</th><th>Exclude</th></tr></thead><tbody>${incl.map(([k]) => `<tr><td>${ic("folder", 14)} ${esc(k === "(Entire PC)" ? "This PC (Enhanced mode)" : prettyPath(k))}</td><td>${esc(c.excl.filter((e) => k === "(Entire PC)" || e.startsWith(k + "/")).map(prettyPath).join("; "))}</td></tr>`).join("")}</tbody></table></div>
        <div class="su-btnrow"><button class="st-btn" data-a="modify">Modify</button><button class="st-btn" data-a="adv">Advanced</button><button class="st-btn" data-a="pause">${s.state === "paused" ? "Resume" : "Pause"}</button><span class="su-grow"></span><button class="st-btn" data-a="settings">Searching Windows settings</button></div>
        <p class="st-dim">How does indexing affect searches? Start search and its “Best match / Files” results come from this index of file names and their text (also inside Word, Excel and PowerPoint documents).</p>`;
      box.querySelector('[data-a="settings"]').onclick = () => openSettingsSub("su-searching");
      box.querySelector('[data-a="pause"]').onclick = () => { if (SearchIndex.status().state === "paused") SearchIndex.resume(); else SearchIndex.pause(15 * MIN); paint(); };
      box.querySelector('[data-a="adv"]').onclick = async () => {
        const v = await dialog({ title: "Advanced Options", html: `<p><b>Index Settings</b></p><label class="su-chk"><input type="checkbox" class="su-ic" ${c.contents ? "checked" : ""}> Index Properties and File Contents (text files, Word, Excel, PowerPoint)</label><p><b>Troubleshooting</b></p><p class="rc-dim">Delete and rebuild index: this may take a while to complete.</p><p class="rc-dim">Index location: IndexedDB (win12-sysutil2 ▸ index)${BitLocker.isOn() ? " — in memory only while BitLocker is on" : ""}.</p>`, buttons: [{ label: "Rebuild", value: "rebuild" }, { label: "OK", primary: true, onClick: (api) => ({ contents: api.content.querySelector(".su-ic").checked }) }, { label: "Cancel", value: null }] });
        if (v === "rebuild") SearchIndex.rebuild(); else if (v && v.contents !== c.contents) { c.contents = v.contents; save(); SearchIndex.rebuild(); }
      };
      box.querySelector('[data-a="modify"]').onclick = async () => {
        const choices = folderChoices(2);
        const v = await dialog({ title: "Indexed Locations", wide: true, html: `<p class="rc-dim">Change selected locations (unchecked folders are excluded).</p><div class="su-vfslist">${choices.map((k) => { const on = SearchIndex.inScope(k.split("/")) || (c.mode === "classic" && !SearchIndex.USER_TOP.includes(k.split("/")[0]) && c.extra.includes(k)); return `<label class="su-chk" style="padding-left:${(k.split("/").length - 1) * 16}px"><input type="checkbox" value="${esc(k)}" ${on ? "checked" : ""}> ${esc(prettyPath(k))}</label>`; }).join("")}</div>`,
          buttons: [{ label: "OK", primary: true, onClick: (api) => [...api.content.querySelectorAll("input")].map((x) => [x.value, x.checked]) }, { label: "Cancel", value: null }] });
        if (!v) return;
        const excl = new Set(c.excl), extra = new Set(c.extra);
        v.forEach(([k, on]) => {
          const top = SearchIndex.USER_TOP.includes(k.split("/")[0]);
          if (on) { excl.delete(k); if (c.mode === "classic" && !top && !SearchIndex.inScope(k.split("/"))) extra.add(k); }
          else { if (c.mode === "classic" && !top) extra.delete(k); else excl.add(k); }
        });
        c.extra = [...extra]; save(); SearchIndex.setExcl([...excl]); paint();
      };
    };
    paint();
    const off = SearchIndex.on(() => { if (!box.isConnected) { off(); return; } paint(); });
    if (nav && nav.onLeave) nav.onLeave(off);
  }

  // ---- Start search: Best match / Files from the index ----
  function hookStartSearch(sm) {
    const input = sm.querySelector(".search"); if (!input) return;
    const augment = () => {
      const q = input.value.trim(); if (!q) return;
      const left = sm.querySelector(".sm12-list"); if (!left) return;
      const res = SearchIndex.query(q, 8); if (!res.length) return;
      // drop Start's own name-only "Files" section; the index covers names and contents
      const kids = [...left.children];
      const fi = kids.findIndex((x) => x.classList.contains("sm12-letter") && /^(Files|Filer)$/.test(x.textContent.trim()));
      const web = kids.filter((x) => x.classList.contains("sm12-app")).pop();
      if (fi >= 0) { for (let i = fi; i < kids.length; i++) { if (kids[i] === web) break; if (i === fi || kids[i].classList.contains("sm12-app")) kids[i].remove(); } }
      kids.forEach((x) => { if (x.classList.contains("sm12-letter") && /No apps found/.test(x.textContent)) x.remove(); });
      const hasApps = !!left.querySelector(".sm12-letter") && [...left.querySelectorAll(".sm12-app")].some((x) => x !== web && !x.classList.contains("su-sm-file"));
      const mk = (r, best) => {
        const b = el(`<button class="sm12-app su-sm-file ${best ? "su-sm-best" : ""}"><span class="sm12-app-ic">${window.FilesHelper ? FilesHelper.glyph(r.name, r.node, best ? 32 : 22) : ic("folder", 20)}</span><span class="su-sm-tx"><span class="su-sm-n"></span><small></small>${r.snippet ? `<small class="su-sm-snip"></small>` : ""}</span></button>`);
        b.querySelector(".su-sm-n").textContent = r.name;
        b.querySelector("small").textContent = (best ? "File · " : "") + winPath(r.path);
        if (r.snippet) b.querySelector(".su-sm-snip").textContent = r.snippet;
        b.onclick = () => { sm.classList.remove("open"); if (window.VFS) VFS.openNode(r.name, r.node); };
        return b;
      };
      const frag = document.createDocumentFragment();
      let list = res;
      if (!hasApps) { frag.appendChild(el(`<div class="sm12-letter">Best match</div>`)); frag.appendChild(mk(res[0], true)); list = res.slice(1); left.querySelectorAll(".sm12-letter").forEach((x) => { if (/^Best match$/.test(x.textContent.trim())) x.remove(); }); }
      if (list.length) { frag.appendChild(el(`<div class="sm12-letter">Files</div>`)); list.forEach((r) => frag.appendChild(mk(r, false))); }
      if (web && web.parentNode === left) left.insertBefore(frag, web); else left.appendChild(frag);
    };
    input.addEventListener("input", () => { try { augment(); } catch (e) { console.error("[SearchIndex] start", e); } });
  }

  // =====================================================================
  //  Terminal: schtasks / powercfg / manage-bde (+ PowerShell cmdlets)
  // =====================================================================
  async function schtasks(c) {
    const io = c.io, a = c.a.map(String), al = a.map((x) => x.toLowerCase());
    const opt = (f) => { const i = al.indexOf(f); return i >= 0 ? (a[i + 1] || "") : null; };
    const has = (f) => al.includes(f);
    const TS = TaskSched;
    if (!a.length || has("/?")) { io.out("SCHTASKS /parameter [arguments]\n\nDescription:\n    Enables an administrator to create, delete, query, change, run and\n    end scheduled tasks on this system.\n\nParameter List:\n    /Create         Creates a new scheduled task.\n    /Delete         Deletes the scheduled task(s).\n    /Query          Displays all scheduled tasks.\n    /Change         Changes the properties of scheduled task.\n    /Run            Runs the scheduled task on demand.\n    /End            Stops the currently running scheduled task.\n\nExamples:\n    SCHTASKS /Create /SC DAILY /TN \"Backup\" /TR notepad /ST 09:00\n    SCHTASKS /Create /SC ONLOGON /TN Hello /TR \"cmd /c echo hi > %USERPROFILE%\\Documents\\hi.txt\"\n    SCHTASKS /Run /TN Backup\n    SCHTASKS /Query /FO LIST /V\n"); return 0; }
    const find = () => { const n = opt("/tn"); const t = n && TS.byName(n); if (!t) io.err("ERROR: The system cannot find the file specified."); return t; };
    if (has("/query")) {
      const tn = opt("/tn"); const list = tn ? [TS.byName(tn)].filter(Boolean) : TS.tasks().filter((t) => !t.hidden);
      if (tn && !list.length) { io.err("ERROR: The system cannot find the file specified."); return 1; }
      const fo = (opt("/fo") || "table").toLowerCase();
      if (fo === "list") list.forEach((t) => io.out("\nFolder: " + t.folder + "\nHostName:                             " + ((window.SysTools && SysTools.deviceName()) || "WIN12-PC") + "\nTaskName:                             " + TS.fullName(t) + "\nNext Run Time:                        " + (TS.taskNext(t) ? fmtWhen(TS.taskNext(t)) : "N/A") + "\nStatus:                               " + (TS.isRunning(t) ? "Running" : t.enabled ? "Ready" : "Disabled") + (has("/v") ? "\nLast Run Time:                        " + (t.state.lastRun ? fmtWhen(t.state.lastRun) : "N/A") + "\nLast Result:                          " + t.state.lastResult + "\nAuthor:                               " + t.author + "\nTask To Run:                          " + t.actions.map(TS.actText).join("; ") + "\nSchedule Type:                        " + t.triggers.map(TS.trigText).join("; ") : "")));
      else if (fo === "csv") { io.out('"TaskName","Next Run Time","Status"'); list.forEach((t) => io.out('"' + TS.fullName(t) + '","' + (TS.taskNext(t) ? fmtWhen(TS.taskNext(t)) : "N/A") + '","' + (TS.isRunning(t) ? "Running" : t.enabled ? "Ready" : "Disabled") + '"')); }
      else {
        const by = {}; list.forEach((t) => (by[t.folder] = by[t.folder] || []).push(t));
        Object.keys(by).sort().forEach((f) => { io.out("\nFolder: " + f + "\nTaskName                                 Next Run Time          Status\n======================================== ====================== ==============="); by[f].forEach((t) => io.out(t.name.slice(0, 40).padEnd(41) + (TS.taskNext(t) ? fmtWhen(TS.taskNext(t)) : "N/A").padEnd(23) + (TS.isRunning(t) ? "Running" : t.enabled ? "Ready" : "Disabled"))); });
      }
      return 0;
    }
    if (has("/run")) { const t = find(); if (!t) return 1; if (t.settings.allowDemand === false) { io.err("ERROR: The task cannot be run on demand."); return 1; } TS.runTask(t, "demand"); io.out('SUCCESS: Attempted to run the scheduled task "' + TS.fullName(t) + '".'); return 0; }
    if (has("/end")) { const t = find(); if (!t) return 1; if (!TS.endTask(t)) { io.out('INFO: There is no running instance of the scheduled task "' + TS.fullName(t) + '".'); return 0; } io.out('SUCCESS: The scheduled task "' + TS.fullName(t) + '" has been terminated successfully.'); return 0; }
    if (has("/delete")) {
      const t = find(); if (!t) return 1;
      if (!has("/f")) { const ans = await io.ask('WARNING: Are you sure you want to remove the task "' + TS.fullName(t) + '" (Y/N)? '); if (!/^y/i.test(String(ans).trim())) { io.out("INFO: Cancelled."); return 0; } }
      TS.remove(t); io.out('SUCCESS: The scheduled task "' + TS.fullName(t) + '" was successfully deleted.'); return 0;
    }
    if (has("/change")) { const t = find(); if (!t) return 1; if (has("/enable")) TS.setEnabled(t, true); else if (has("/disable")) TS.setEnabled(t, false); else { io.err("ERROR: Use /ENABLE or /DISABLE."); return 1; } io.out('SUCCESS: The parameters of scheduled task "' + TS.fullName(t) + '" have been changed.'); return 0; }
    if (has("/create")) {
      const sc = (opt("/sc") || "").toLowerCase(), tn = opt("/tn"), tr = opt("/tr");
      if (!sc || !tn || !tr) { io.err("ERROR: Invalid syntax. Mandatory option '/sc', '/tn' and '/tr' are required.\nType \"SCHTASKS /CREATE /?\" for usage."); return 1; }
      const parts = tn.replace(/^\\/, "").split("\\"), name = parts.pop(), folder = "\\" + (parts.length ? parts.join("\\") + "\\" : "");
      const ex = TS.tasks().find((x) => x.folder === folder && x.name.toLowerCase() === name.toLowerCase());
      if (ex && !has("/f")) { io.err('ERROR: Cannot create a file when that file already exists.'); return 1; }
      const st = opt("/st") || "", sd = opt("/sd") || "", mo = +(opt("/mo") || 1) || 1;
      const base = new Date(); if (sd) { const m = sd.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if (m) base.setFullYear(+m[3], +m[1] - 1, +m[2]); }
      if (st) { const m = st.match(/^(\d{1,2}):(\d{2})/); if (m) base.setHours(+m[1], +m[2], 0, 0); } else base.setSeconds(0, 0);
      const map = { once: "time", daily: "daily", weekly: "weekly", onlogon: "logon", onstart: "startup", onidle: "idle", minute: "daily" };
      if (!map[sc]) { io.err("ERROR: Invalid value for /SC. Use ONCE, DAILY, WEEKLY, ONLOGON, ONSTART or ONIDLE."); return 1; }
      const trig = { type: map[sc], start: base.getTime(), every: mo };
      if (sc === "weekly") { const D = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }; trig.days = (opt("/d") || "").toLowerCase().split(",").map((x) => D[x.trim().slice(0, 3)]).filter((x) => x != null); if (!trig.days.length) trig.days = [base.getDay()]; }
      if (sc === "onidle") trig.idleMin = +(opt("/i") || 10);
      let action;
      const m1 = tr.match(/^cmd(?:\.exe)?\s+\/c\s+([\s\S]+)$/i), m2 = tr.match(/^powershell(?:\.exe)?\s+(?:-command\s+)?([\s\S]+)$/i);
      if (m1) action = { type: "cmd", shell: "cmd", line: m1[1] }; else if (m2) action = { type: "cmd", shell: "ps", line: m2[1] }; else action = { type: "app", program: tr };
      if (ex) TS.remove(ex);
      TS.add({ name, folder, triggers: [trig], actions: [action], settings: { startWhenAvailable: ["time", "daily", "weekly"].includes(trig.type) } });
      io.out('SUCCESS: The scheduled task "' + name + '" has successfully been created.'); return 0;
    }
    io.err("ERROR: Invalid argument/option. Type \"SCHTASKS /?\" for usage."); return 1;
  }
  function psTask(fn) {
    return async (c) => {
      const a = c.a.map(String), i = a.findIndex((x) => /^-taskname$/i.test(x)); const n = i >= 0 ? a[i + 1] : a.find((x) => !/^-/.test(x));
      const t = n ? TaskSched.byName(n) : null;
      if (!t) { c.io.err(fn + " : No MSFT_ScheduledTask objects found with property 'TaskName' equal to '" + (n || "") + "'."); return 1; }
      if (fn === "Start-ScheduledTask") TaskSched.runTask(t, "demand");
      else if (fn === "Stop-ScheduledTask") TaskSched.endTask(t);
      else if (fn === "Enable-ScheduledTask") TaskSched.setEnabled(t, true);
      else if (fn === "Disable-ScheduledTask") TaskSched.setEnabled(t, false);
      else if (fn === "Unregister-ScheduledTask") TaskSched.remove(t);
      else if (fn === "Get-ScheduledTaskInfo") { c.io.out("\nLastRunTime        : " + (t.state.lastRun ? fmtWhen(t.state.lastRun) : "") + "\nLastTaskResult     : " + t.state.lastResult + "\nNextRunTime        : " + (TaskSched.taskNext(t) ? fmtWhen(TaskSched.taskNext(t)) : "") + "\nNumberOfMissedRuns : 0\nTaskName           : " + t.name + "\nTaskPath           : " + t.folder + "\n"); }
      return 0;
    };
  }
  function registerTerminal() {
    BLUI.registerTerminal();
    TerminalExt.cmd.schtasks = schtasks;
    TerminalExt.cmd.powercfg = powercfg;
    TerminalExt.ps["get-scheduledtask"] = (c) => { c.io.out("\nTaskPath                                       TaskName                          State\n--------                                       --------                          -----"); TaskSched.tasks().forEach((t) => c.io.out(t.folder.padEnd(47) + t.name.slice(0, 33).padEnd(34) + (TaskSched.isRunning(t) ? "Running" : t.enabled ? "Ready" : "Disabled"))); c.io.out(""); return 0; };
    ["Start-ScheduledTask", "Stop-ScheduledTask", "Enable-ScheduledTask", "Disable-ScheduledTask", "Unregister-ScheduledTask", "Get-ScheduledTaskInfo"].forEach((n) => { TerminalExt.ps[n.toLowerCase()] = psTask(n); });
  }

  // =====================================================================
  //  init
  // =====================================================================
  const svgApp = {
    taskschd: '<svg viewBox="0 0 48 48" width="100%" height="100%"><rect x="6" y="8" width="36" height="34" rx="4" fill="#fff" stroke="#6b7a90" stroke-width="2"/><rect x="6" y="8" width="36" height="9" rx="4" fill="#0067c0"/><path d="M14 4v8M34 4v8" stroke="#444" stroke-width="3" stroke-linecap="round"/><circle cx="30" cy="31" r="10" fill="#fff" stroke="#0067c0" stroke-width="2.5"/><path d="M30 25v6l4 3" stroke="#222" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M12 24h8M12 30h6M12 36h7" stroke="#9aa6b8" stroke-width="2.4" stroke-linecap="round"/></svg>',
    bitlocker: '<svg viewBox="0 0 48 48" width="100%" height="100%"><rect x="6" y="14" width="36" height="22" rx="4" fill="#8a94a6"/><rect x="10" y="27" width="28" height="5" rx="2" fill="#5a6477"/><rect x="22" y="22" width="20" height="18" rx="3" fill="#ffb900"/><path d="M26 22v-4a6 6 0 0 1 12 0v4" stroke="#6b5000" stroke-width="3" fill="none"/><circle cx="32" cy="31" r="2.5" fill="#6b5000"/></svg>',
  };
  function registerApps() {
    try {
      if (window.Icon && Icon.register) Object.keys(svgApp).forEach((k) => Icon.register(k, () => svgApp[k]));
      if (window.Catalog && Catalog.storeApps && !Catalog.storeApps.find((x) => x.id === "taskschd")) Catalog.storeApps.push({ id: "taskschd", name: "Task Scheduler", cat: "System", price: 0, builtin: "taskschd", desc: "Schedule apps, messages, terminal commands and restore points to run at a time, at sign-in, at startup, when idle or when an event is logged." });
      const ex = (window.EXTRA_DEFAULT_APPS = window.EXTRA_DEFAULT_APPS || []); if (!ex.includes("taskschd")) ex.push("taskschd");
      window.AppRegistry = window.AppRegistry || {};
      AppRegistry.taskschd = () => TSUI.open();
    } catch (e) { console.error("[SysUtil2] apps", e); }
  }
  function fontPickerHooks() {
    const handler = (e) => { const t = e.target; if (t && t.matches && t.matches("select.wd-font, select[data-font-picker]")) FontsRegistry.patchPickers(t.parentNode || document); };
    document.addEventListener("pointerdown", handler, true); document.addEventListener("focusin", handler, true);
    winHooks.push((w) => {   // apps build their toolbars after the window opens: watch for a font box for a while
      FontsRegistry.patchPickers(w);
      let raf = 0; const mo = new MutationObserver(() => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; if (w.querySelector("select.wd-font, select[data-font-picker]")) FontsRegistry.patchPickers(w); }); });
      mo.observe(w, { childList: true, subtree: true }); setTimeout(() => mo.disconnect(), 30000);
    });
    FontsRegistry.on(() => FontsRegistry.patchPickers(document));
    // C:\Windows\Fonts\<file> opens the Fonts page.
    const wrapOpen = () => {
      if (!window.VFS || VFS.__suFont) return; VFS.__suFont = true;
      const o = VFS.openNode;
      VFS.openNode = function (name, node) { if (node && node.kind === "font" && node.fontId) { openSettingsSub("su-fonts"); return; } return o.apply(this, arguments); };
    };
    wrapOpen(); window.addEventListener("load", () => setTimeout(wrapOpen, 10));
  }

  BitLocker.init();
  registerApps();
  try { registerTerminal(); } catch (e) { console.error("[SysUtil2] terminal", e); }
  startHooks.push((sm) => Hibernate.hookPowerMenu(sm), hookStartSearch);
  fontPickerHooks();
  function domReady() {
    watchWindows();
    Hibernate.watchBoot();
    FontsRegistry.load();
    PowerPlans.start();
    TaskSched.start(); SearchIndex.start();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", domReady); else domReady();

  window.StorageSense = StorageSense;
  window.TaskScheduler = TaskSched;
  window.BitLocker = BitLocker;
  window.PowerPlans = PowerPlans;
  window.Hibernate = Hibernate;
  window.FontsRegistry = FontsRegistry;
  window.SearchIndex = SearchIndex;
  window.SysUtil2 = {
    version: 1, StorageSense, TaskScheduler: TaskSched, BitLocker, PowerPlans, Hibernate, FontsRegistry, SearchIndex,
    cp: { bitlocker: BLUI.cpPage, power: cpPower, fonts: cpFonts, indexing: cpIndexing },
    openTaskScheduler: () => TSUI.open(), bitlockerSetup: BLUI.setup, openSettingsSub,
    gcBlobs: async (ids) => { let freed = 0; for (const id of ids || []) { try { const refd = (() => { const n = '"' + id + '"'; for (let i = 0; i < localStorage.length; i++) { const v = localStorage.getItem(localStorage.key(i)); if (v && v.indexOf(n) >= 0) return true; } return JSON.stringify(S()).indexOf(n) >= 0; })(); if (refd) continue; const b = await rawBlobGet(id); if (b) { freed += b.size; await rawBlobDel(id); } } catch (_) {} } return freed; },
  };
})();
