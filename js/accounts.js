/* Multiple user accounts, Windows 11 style.

   Storage (see js/state.js):
     win12_accounts_v1[__vmN]          the account REGISTRY — names, small picture thumbnails, account
                                       type (admin / standard) and a summary of each account's sign-in
                                       methods. Never any secret.
     win12_state_v1[__vmN]             account #1's whole OS state (the original single user, unmoved)
     win12_state_v1[__vmN]__u<id>      every other account's whole OS state (desktop, files, apps,
                                       settings, PIN / password hash / passkeys …)
   State.data is always ONE account: the registry's `current`. Switching accounts saves, points
   `current` at the other user and restarts the page straight to the lock screen (no boot animation).

   Migration is idempotent: with no registry, one is built from the state keys that exist (account
   #1 = the existing user, nothing is copied or moved). A lost registry is rebuilt the same way.

   window.Accounts = { list, current, currentId, isAdmin, typeLabel, get, create, remove, setType,
                       switchTo, signOut, lock, elevate, verify, needsSecret, methodsOf, modal, avatar } */
(function () {
  "use strict";
  if (!window.State || !State.keyFor) return;
  const LS = window.localStorage;
  const REG_KEY = State.ACCOUNTS_KEY;
  const MID = State.accountId;            // the account whose state is loaded in this page
  const S = () => State.data;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function el(html) { const d = document.createElement("div"); d.innerHTML = String(html).trim(); return d.firstElementChild; }
  const screenEl = () => document.getElementById("screen") || document.body;
  const log = (logName, level, source, id, msg, opts) => { try { if (window.EventLog) EventLog.add(logName, level, source, id, msg, opts); } catch (_) {} };
  const VMS = window.WIN12_VM_DEPTH ? "__vm" + window.WIN12_VM_DEPTH : "";
  const FAST_KEY = "win12_fastboot" + VMS, SWITCH_KEY = "win12_switch_from" + VMS;
  const RESERVED = ["administrator", "guest", "defaultaccount", "system", "wdagutilityaccount", "everyone", "users", "administrators"];

  // ------------------------------------------------------------------ registry
  function readReg() {
    try { const r = JSON.parse(LS.getItem(REG_KEY) || "null"); return r && typeof r === "object" && Array.isArray(r.users) ? r : null; } catch (_) { return null; }
  }
  function writeReg(r) { try { LS.setItem(REG_KEY, JSON.stringify(r)); return true; } catch (_) { return false; } }
  function readState(id) {
    if (+id === MID) return S();
    try { return JSON.parse(LS.getItem(State.keyFor(id)) || "null"); } catch (_) { return null; }
  }
  function methodsOf(pr) {
    pr = pr || {};
    const m = [];
    if (pr.secret && pr.authType !== "password") m.push("pin");
    if ((pr.secret && pr.authType === "password") || pr.pwHash) m.push("password");
    if ((pr.webauthn && Array.isArray(pr.webauthn.platform) && pr.webauthn.platform.length) || (pr.touchId && pr.touchId.native)) m.push("touchid");
    if (pr.webauthn && Array.isArray(pr.webauthn.key) && pr.webauthn.key.length) m.push("key");
    return m;
  }
  function entryFrom(id, st, type) {
    const pr = (st && st.profile) || {};
    const meta = (st && st.accountMeta) || {};
    return {
      id: +id, name: String(pr.username || "User " + id).slice(0, 40),
      type: type || (meta.type === "standard" ? "standard" : "admin"),
      picture: null, methods: methodsOf(pr),
      email: (st && st.account && st.account.email) || null,
      created: meta.created || Date.now(), lastSignIn: null,
    };
  }
  // State keys that exist on this PC → account ids.
  function scanIds() {
    const ids = [];
    const base = State.BASE_KEY, re = new RegExp("^" + base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "__u(\\d+)$");
    try {
      if (LS.getItem(base) != null) ids.push(1);
      for (let i = 0; i < LS.length; i++) { const k = LS.key(i), m = k && re.exec(k); if (m && +m[1] > 1) ids.push(+m[1]); }
    } catch (_) {}
    return ids.sort((a, b) => a - b);
  }
  // Build / repair the registry. Safe to run any number of times.
  function ensureReg(atStart) {
    let r = readReg(), changed = false;
    if (!r) {
      const ids = scanIds().filter((id) => { const st = readState(id); return st && (st.setupCompleted || id === MID); });
      if (!ids.length || (ids.length === 1 && ids[0] === MID && !S().setupCompleted)) return null; // fresh PC: made after Setup
      r = { v: 1, current: MID, nextId: 2, users: ids.map((id) => entryFrom(id, readState(id), id === 1 ? "admin" : null)) };
      changed = true;
    }
    const seen = new Set();
    const users = r.users.filter((u) => u && +u.id > 0 && !seen.has(+u.id) && seen.add(+u.id));
    if (users.length !== r.users.length) { r.users = users; changed = true; }
    r.users.forEach((u) => { u.id = +u.id; if (u.type !== "admin" && u.type !== "standard") { u.type = "admin"; changed = true; } if (!Array.isArray(u.methods)) { u.methods = []; changed = true; } });
    if (!r.users.some((u) => u.id === MID) && S().setupCompleted) { r.users.push(entryFrom(MID, S(), r.users.some((u) => u.type === "admin") ? null : "admin")); changed = true; }
    if (r.users.length && !r.users.some((u) => u.type === "admin")) { r.users[0].type = "admin"; changed = true; }
    // Only at page start: state.js fell back to another account than the registry named.
    if (atStart && +r.current !== MID && r.users.some((u) => u.id === MID)) { r.current = MID; changed = true; }
    const maxId = r.users.reduce((m, u) => Math.max(m, u.id), 1);
    if (!(+r.nextId > maxId)) { r.nextId = maxId + 1; changed = true; }
    if (r.v !== 1) { r.v = 1; changed = true; }
    if (changed) writeReg(r);
    return r;
  }

  // Downscale a profile picture to a small thumbnail for the registry (lock screen list, Start).
  function thumb(src) {
    return new Promise((res) => {
      if (!src) return res(null);
      const img = new Image();
      img.onload = () => {
        try {
          const n = 96, c = document.createElement("canvas"); c.width = c.height = n;
          const g = c.getContext("2d"), s = Math.min(img.width, img.height) || 1;
          g.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, n, n);
          res(c.toDataURL("image/jpeg", 0.82));
        } catch (_) { res(null); }
      };
      img.onerror = () => res(null);
      img.src = src;
    });
  }
  const picSig = (p) => (p ? p.length + ":" + p.slice(0, 48) + p.slice(-48) : "");

  // Keep this account's registry entry in step with its profile (name, picture, sign-in methods).
  let leaving = false;   // a switch / sign-out is restarting the page
  function sync() {
    if (leaving || !S().setupCompleted) return;
    const r = ensureReg(); if (!r) return;
    const u = r.users.find((x) => x.id === MID); if (!u) return;
    const pr = S().profile || {};
    const next = { name: String(pr.username || u.name).slice(0, 40), methods: methodsOf(pr), email: (S().account && S().account.email) || null };
    let changed = false;
    Object.keys(next).forEach((k) => { if (JSON.stringify(u[k]) !== JSON.stringify(next[k])) { u[k] = next[k]; changed = true; } });
    if (changed) writeReg(r);
    // Mirror the (non-secret) account type into the state so a lost registry can be rebuilt.
    const meta = S().accountMeta || (S().accountMeta = {});
    if (meta.id !== MID || meta.type !== u.type) { meta.id = MID; meta.type = u.type; if (!meta.created) meta.created = u.created || Date.now(); }
    const sig = picSig(pr.picture);
    if ((u.picSig || "") !== sig) {
      thumb(pr.picture).then((t) => {
        const r2 = readReg(); const u2 = r2 && r2.users.find((x) => x.id === MID); if (!u2) return;
        u2.picture = t; u2.picSig = sig; writeReg(r2);
      });
    }
  }
  let syncTimer = 0;
  State.onSave(() => { clearTimeout(syncTimer); syncTimer = setTimeout(() => { try { sync(); } catch (_) {} }, 400); });

  // ------------------------------------------------------------------ queries
  const list = () => (ensureReg() || { users: [] }).users.slice();
  const get = (id) => list().find((u) => u.id === +id) || null;
  const current = () => get(MID) || entryFrom(MID, S(), "admin");
  const isAdmin = () => current().type !== "standard";
  const typeLabel = (u) => ((u || current()).type === "standard" ? "Standard user" : "Administrator");
  const methodLabel = { pin: "PIN", password: "Password", touchid: (window.TouchID && TouchID.sensorName()) || "Touch ID", key: "Security key" };
  const methodsText = (u) => (u.methods && u.methods.length ? u.methods.map((m) => methodLabel[m] || m).join(", ") : "No sign-in set up");
  const when = (t) => (t ? new Date(t).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Never");

  // ------------------------------------------------------------------ credentials (real checks)
  const te = new TextEncoder();
  const b64u = (u) => { let s = ""; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
  const unb64u = (s) => { s = String(s).replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  async function pbkdf2(pw, salt, iter) {
    const k = await crypto.subtle.importKey("raw", te.encode(pw), "PBKDF2", false, ["deriveBits"]);
    return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: iter, hash: "SHA-256" }, k, 256));
  }
  async function hashPassword(pw) { const salt = crypto.getRandomValues(new Uint8Array(16)); return { s: b64u(salt), h: b64u(await pbkdf2(pw, salt, 150000)), i: 150000 }; }
  // Does this account need a PIN / password to be entered?
  function needsSecret(id) { const st = readState(id), pr = (st && st.profile) || {}; return !!(pr.secret || pr.pwHash); }
  async function verify(id, secret) {
    const st = readState(id); if (!st) return false;
    const pr = st.profile || {};
    if (!pr.secret && !pr.pwHash) return true;
    if (pr.secret && String(secret) === String(pr.secret)) return true;
    if (pr.pwHash && pr.pwHash.s && pr.pwHash.h) {
      try { const a = await pbkdf2(String(secret || ""), unb64u(pr.pwHash.s), pr.pwHash.i || 150000), b = unb64u(pr.pwHash.h); if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i]; return d === 0; } catch (_) { return false; }
    }
    return false;
  }

  // ------------------------------------------------------------------ dialogs
  function avatar(u, size) {
    size = size || 40;
    const pic = u && (u.id === MID && S().profile && S().profile.picture ? S().profile.picture : u.picture);
    if (pic) return `<span class="rc-ava" style="width:${size}px;height:${size}px"><img src="${esc(pic)}" alt=""></span>`;
    const g = Math.round(size * 0.7);
    return `<span class="rc-ava rc-ava-def" style="width:${size}px;height:${size}px"><svg viewBox="0 0 40 40" width="${g}" height="${g}"><circle cx="20" cy="15" r="7.5" fill="currentColor"/><path d="M6 35c1-7.5 6.5-11.5 14-11.5S33 27.5 34 35z" fill="currentColor"/></svg></span>`;
  }
  // A Windows 11 ContentDialog. buttons: [{ label, primary, value }] → resolves with the value (null = dismissed).
  function modal(opts) {
    return new Promise((resolve) => {
      const dim = el(`<div class="rc-modal-dim${opts.uac ? " rc-uac-dim" : ""}" role="presentation"><div class="rc-modal${opts.uac ? " rc-uac" : ""}${opts.wide ? " rc-modal-wide" : ""}" role="dialog" aria-modal="true" aria-label="${esc(opts.title || "")}">
        ${opts.uac ? `<div class="rc-uac-band">User Account Control</div>` : ""}
        <div class="rc-modal-body">${opts.title ? `<h2 class="rc-modal-title">${esc(opts.title)}</h2>` : ""}<div class="rc-modal-content"></div></div>
        <div class="rc-modal-foot"></div></div></div>`);
      const content = dim.querySelector(".rc-modal-content"), foot = dim.querySelector(".rc-modal-foot");
      if (opts.uac) { try { const a = new Audio("assets/uac.mp3?v=1"); a.volume = 0.7; a.play().catch(function () {}); } catch (e) {} }   // Windows UAC chime
      if (typeof opts.html === "string") content.innerHTML = opts.html; else if (opts.html) content.appendChild(opts.html);
      let done = false;
      const close = (v) => { if (done) return; done = true; dim.classList.add("rc-out"); setTimeout(() => dim.remove(), 160); document.removeEventListener("keydown", onKey, true); resolve(v); };
      const api = { close, root: dim, content, error(t) { let e = content.querySelector(".rc-err"); if (!e) { e = el(`<div class="rc-err" role="alert"></div>`); content.appendChild(e); } e.textContent = t || ""; }, busy(on) { foot.querySelectorAll("button").forEach((b) => (b.disabled = !!on)); } };
      (opts.buttons || [{ label: "OK", primary: true, value: true }]).forEach((b) => {
        const btn = el(`<button type="button" class="rc-btn${b.primary ? " rc-btn-primary" : ""}">${esc(b.label)}</button>`);
        btn.onclick = async () => {
          if (b.onClick) { const r = await b.onClick(api); if (r === false) return; close(r === undefined ? b.value : r); }
          else close(b.value);
        };
        foot.appendChild(btn);
      });
      const onKey = (e) => {
        if (e.key === "Escape") { e.stopPropagation(); close(null); }
        else if (e.key === "Enter" && !(e.target && e.target.tagName === "TEXTAREA")) { const p = foot.querySelector(".rc-btn-primary"); if (p && !p.disabled) { e.preventDefault(); p.click(); } }
      };
      document.addEventListener("keydown", onKey, true);
      (opts.host || document.body).appendChild(dim);
      if (opts.onOpen) opts.onOpen(api);
      setTimeout(() => { const f = content.querySelector("input,select") || foot.querySelector(".rc-btn-primary"); try { f && f.focus(); } catch (_) {} }, 60);
    });
  }

  // User Account Control. Admins confirm; standard users must enter an administrator's PIN / password,
  // checked against that admin's own saved state.
  function elevate(what) {
    const me = current();
    const admins = list().filter((u) => u.type === "admin" && u.id !== me.id);
    if (me.type !== "standard") {
      return modal({ uac: true, title: "Do you want to allow this app to make changes to your device?", html: uacApp(what) + `<p class="rc-dim">Signed in as ${esc(me.name)} (Administrator)</p>`, buttons: [{ label: "Yes", primary: true, value: true }, { label: "No", value: false }] }).then((v) => v === true);
    }
    if (!admins.length) return modal({ uac: true, title: "You need an administrator to do this", html: uacApp(what) + `<p>There's no administrator account on this PC.</p>`, buttons: [{ label: "OK", primary: true, value: false }] }).then(() => false);
    const form = `${uacApp(what)}<p>To continue, enter an admin user name and PIN or password.</p>
      <label class="rc-field"><span>Administrator</span><select class="rc-input rc-uac-who">${admins.map((u) => `<option value="${u.id}">${esc(u.name)}</option>`).join("")}</select></label>
      <label class="rc-field"><span>PIN or password</span><input class="rc-input rc-uac-pw" type="password" data-no-eye autocomplete="off"></label>`;
    return modal({
      uac: true, title: "Do you want to allow this app to make changes to your device?", html: form,
      buttons: [{ label: "Yes", primary: true, onClick: async (api) => {
        const id = +api.content.querySelector(".rc-uac-who").value, pw = api.content.querySelector(".rc-uac-pw").value;
        api.busy(true); const ok = await verify(id, pw); api.busy(false);
        if (!ok) { api.error("The user name or password is incorrect."); log("Security", "Audit Failure", "Microsoft Windows security auditing.", 4625, "An account failed to log on (User Account Control).\r\nAccount Name:\t" + (get(id) || {}).name + "\r\nStatus:\t0xC000006D"); return false; }
        log("Security", "Audit Success", "Microsoft Windows security auditing.", 4648, "A logon was attempted using explicit credentials (User Account Control).\r\nSubject:\t" + me.name + "\r\nAccount Whose Credentials Were Used:\t" + (get(id) || {}).name + "\r\nAction:\t" + what);
        return true;
      } }, { label: "No", value: false }],
    }).then((v) => v === true);
  }
  function uacApp(what) {
    return `<div class="rc-uac-app"><span class="rc-uac-shield"><svg viewBox="0 0 24 24" width="30" height="30"><path d="M12 2l8 3v6c0 5-3.4 9.3-8 11-4.6-1.7-8-6-8-11V5z" fill="#0067c0"/><path d="M12 2v20c4.6-1.7 8-6 8-11V5z" fill="#ffb900"/></svg></span><div><b>${esc(what || "Windows")}</b><span>Verified publisher: Microsoft Windows</span></div></div>`;
  }

  // ------------------------------------------------------------------ actions
  function validName(name, exceptId) {
    const n = String(name || "").trim();
    if (!n) return "Enter a user name.";
    if (n.length > 20) return "User names can be up to 20 characters.";
    if (/["\/\\\[\]:;|=,+*?<>@]/.test(n)) return "User names can't contain these characters: \" / \\ [ ] : ; | = , + * ? < > @";
    if (RESERVED.includes(n.toLowerCase())) return "That user name is reserved by Windows. Choose another one.";
    if (list().some((u) => u.id !== exceptId && u.name.toLowerCase() === n.toLowerCase())) return "The user name you typed already exists. Choose another one.";
    return "";
  }
  // Create an account: its own complete state, seeded with this PC's machine-wide settings.
  async function create(o) {
    const name = String(o.name || "").trim();
    const bad = validName(name); if (bad) throw new Error(bad);
    const method = o.method === "password" ? "password" : o.method === "none" ? "none" : "pin";
    if (method === "pin" && !/^(\d{4}|\d{6})$/.test(String(o.secret || ""))) throw new Error("A PIN must be 4 or 6 digits.");
    if (method === "password" && String(o.secret || "").length < 4) throw new Error("Use at least 4 characters for the password.");
    if (S().setupCompleted) sync();
    const r = ensureReg() || { v: 1, current: MID, nextId: 2, users: [] };
    let id = Math.max(2, +r.nextId || 2);
    while (LS.getItem(State.keyFor(id)) != null || r.users.some((u) => u.id === id)) id++;
    const cur = S(), st = State.defaults(), clone = (v) => JSON.parse(JSON.stringify(v));
    ["region", "language", "langCode", "productKey", "hasProductKey", "redeemedKeys", "edition", "deviceName", "keyboard", "clock"].forEach((k) => { if (cur[k] !== undefined && cur[k] !== null) st[k] = clone(cur[k]); });
    st.bootCompleted = st.installerDone = st.setupCompleted = true;
    const type = o.type === "admin" ? "admin" : "standard";
    st.profile = { picture: null, username: name, authType: method === "password" ? "password" : "pin", secret: method === "pin" ? String(o.secret) : "" };
    if (method === "password") st.profile.pwHash = await hashPassword(String(o.secret));
    st.accountMeta = { id, type, created: Date.now(), createdBy: current().name };
    st.appData = { firstLogon: true };
    try { LS.setItem(State.keyFor(id), JSON.stringify(st)); } catch (_) { throw new Error("There isn't enough storage space on this PC to add another account."); }
    r.users.push({ id, name, type, picture: null, methods: methodsOf(st.profile), email: null, created: st.accountMeta.created, lastSignIn: null });
    r.nextId = id + 1;
    if (!writeReg(r)) { LS.removeItem(State.keyFor(id)); throw new Error("Couldn't save the list of accounts."); }
    log("Security", "Audit Success", "Microsoft Windows security auditing.", 4720, "A user account was created.\r\nSubject:\r\n\tAccount Name:\t" + current().name + "\r\nNew Account:\r\n\tAccount Name:\t" + name + "\r\n\tSecurity ID:\tS-1-5-21-1004-" + (1000 + id) + "\r\nSign-in:\t" + (method === "none" ? "no password" : method.toUpperCase()));
    log("Security", "Audit Success", "Microsoft Windows security auditing.", 4732, "A member was added to a security-enabled local group.\r\nMember:\t" + name + "\r\nGroup:\t" + (type === "admin" ? "Administrators" : "Users"));
    return id;
  }
  function remove(id) {
    id = +id;
    const r = ensureReg(); const u = r && r.users.find((x) => x.id === id);
    if (!u) throw new Error("That account doesn't exist.");
    if (id === MID) throw new Error("You can't remove the account you're signed in with.");
    if (u.type === "admin" && r.users.filter((x) => x.type === "admin").length < 2) throw new Error("You can't remove the last administrator.");
    try { LS.removeItem(State.keyFor(id)); } catch (_) {}
    r.users = r.users.filter((x) => x.id !== id);
    writeReg(r);
    try { if (window.Recovery && Recovery.points) Recovery.points.removeAllFor(State.keyFor(id)); } catch (_) {}
    log("Security", "Audit Success", "Microsoft Windows security auditing.", 4726, "A user account was deleted.\r\nSubject:\r\n\tAccount Name:\t" + current().name + "\r\nTarget Account:\r\n\tAccount Name:\t" + u.name + "\r\nThe account's files, settings and restore points were removed from this PC.");
    return true;
  }
  function setType(id, type) {
    id = +id; type = type === "admin" ? "admin" : "standard";
    const r = ensureReg(); const u = r && r.users.find((x) => x.id === id);
    if (!u) throw new Error("That account doesn't exist.");
    if (u.type === type) return false;
    if (type === "standard" && r.users.filter((x) => x.type === "admin").length < 2) throw new Error("This PC needs at least one administrator.");
    u.type = type; writeReg(r);
    // mirror into the account's own state (non-secret) so the registry can be rebuilt
    if (id === MID) { (S().accountMeta = S().accountMeta || {}).type = type; State.save(); }
    else { try { const st = readState(id); if (st) { st.accountMeta = Object.assign({}, st.accountMeta, { id, type }); LS.setItem(State.keyFor(id), JSON.stringify(st)); } } catch (_) {} }
    log("Security", "Audit Success", "Microsoft Windows security auditing.", type === "admin" ? 4732 : 4733, (type === "admin" ? "A member was added to a security-enabled local group." : "A member was removed from a security-enabled local group.") + "\r\nMember:\t" + u.name + "\r\nGroup:\tAdministrators\r\nChanged by:\t" + current().name);
    return true;
  }

  // Restart straight to the lock screen (sessionStorage flag read by js/recovery.js).
  function fastRestart(note, label) {
    leaving = true; clearTimeout(syncTimer);
    try { sessionStorage.setItem(FAST_KEY, JSON.stringify({ at: Date.now(), to: "lock", note: note || "" })); } catch (_) {}
    try { State.save(); } catch (_) {}
    State.freeze();
    const ov = el(`<div class="rc-signing"><div class="rc-spin"><i></i><i></i><i></i><i></i><i></i></div><div>${esc(label || "Signing out")}</div></div>`);
    document.body.appendChild(ov);
    setTimeout(() => location.reload(), 900);
  }
  function switchTo(id) {
    id = +id;
    const r = ensureReg(); const u = r && r.users.find((x) => x.id === id);
    if (!u) return false;
    if (id === MID) return false;
    if (LS.getItem(State.keyFor(id)) == null) { modal({ title: "Can't switch", html: `<p>${esc(u.name)}'s account data is missing. Run Startup Repair from Advanced startup.</p>` }); return false; }
    log("Security", "Audit Success", "Microsoft Windows security auditing.", 4647, "User initiated logoff (switch user).\r\nSubject:\r\n\tAccount Name:\t" + current().name + "\r\nSwitching to:\t" + u.name, { user: current().name, now: true });
    try { sessionStorage.setItem(SWITCH_KEY, current().name); } catch (_) {}
    r.current = id; writeReg(r);
    fastRestart("", "Switching user");
    return true;
  }
  function signOut() {
    log("Security", "Audit Success", "Microsoft Windows security auditing.", 4647, "User initiated logoff.\r\nSubject:\r\n\tAccount Name:\t" + current().name, { user: current().name, now: true });
    fastRestart("", "Signing out");
  }
  function lock() { if (window.Lock) Lock.run(() => {}); }

  // ------------------------------------------------------------------ lock screen: other users
  if (window.Lock && Lock.run && !Lock.__acct) {
    const o = Lock.run; Lock.__acct = true;
    Lock.run = function (cb) {
      const wrapped = function () {
        try {
          const r = ensureReg(); const u = r && r.users.find((x) => x.id === MID);
          if (u) { u.lastSignIn = Date.now(); writeReg(r); }
          const from = sessionStorage.getItem(SWITCH_KEY);
          if (from) { sessionStorage.removeItem(SWITCH_KEY); if (from !== current().name) log("Security", "Audit Success", "Microsoft Windows security auditing.", 4624, "An account was successfully logged on (fast user switching).\r\nLogon Type:\t\t2 (Interactive)\r\nPrevious user:\t" + from + "\r\nNew Logon:\r\n\tAccount Name:\t" + current().name, { user: current().name }); }
        } catch (_) {}
        return cb && cb.apply(this, arguments);
      };
      const res = o.call(this, wrapped);
      try { decorateLock(); } catch (_) {}
      return res;
    };
  }
  function decorateLock() {
    const layers = document.querySelectorAll(".lock-screen"), layer = layers[layers.length - 1];
    if (!layer || layer.querySelector(".rc-users")) return;
    const users = list(); if (users.length < 2) return;
    const box = el(`<div class="rc-users" role="list" aria-label="Users"></div>`);
    users.forEach((u) => {
      const b = el(`<button type="button" class="rc-user${u.id === MID ? " on" : ""}" role="listitem">${avatar(u, 38)}<span class="rc-user-name"></span></button>`);
      b.querySelector(".rc-user-name").textContent = u.name;
      b.onclick = () => { if (u.id !== MID) switchTo(u.id); };
      box.appendChild(b);
    });
    layer.appendChild(box);
  }

  // ------------------------------------------------------------------ desktop: Start menu user button, first sign-in
  function hookDesktop() {
    if (!window.WM || !WM.buildDesktop || WM.__acct) return;
    const o = WM.buildDesktop; WM.__acct = true;
    WM.buildDesktop = function () {
      const res = o.apply(this, arguments);
      try { sync(); } catch (_) {}
      try {
        const btn = document.querySelector(".start-menu .start-user");
        if (btn) { btn.title = "Account"; btn.onclick = (e) => { e.stopPropagation(); userMenu(btn); }; }
      } catch (_) {}
      try { if (S().appData && S().appData.firstLogon) firstLogon(); } catch (_) {}
      return res;
    };
  }
  hookDesktop();
  function userMenu(btn) {
    const sm = btn.closest(".start-menu"); if (!sm) return;
    const old = sm.querySelector(".rc-usermenu"); if (old) { old.remove(); return; }
    const me = current(), others = list().filter((u) => u.id !== MID);
    const m = el(`<div class="rc-usermenu" role="menu">
      <div class="rc-um-head">${avatar(me, 52)}<div><b></b><span>${esc(typeLabel(me))}${me.email ? " · " + esc(me.email) : " · Local account"}</span></div></div>
      <button type="button" role="menuitem" data-a="settings">Change account settings</button>
      <button type="button" role="menuitem" data-a="lock">Lock</button>
      <button type="button" role="menuitem" data-a="signout">Sign out</button>
      ${others.length ? `<div class="rc-um-sep"></div><div class="rc-um-sub">Switch user</div>` : ""}
    </div>`);
    m.querySelector(".rc-um-head b").textContent = me.name;
    others.forEach((u) => { const b = el(`<button type="button" role="menuitem" class="rc-um-user" data-id="${u.id}">${avatar(u, 30)}<span class="rc-um-name"></span></button>`); b.querySelector(".rc-um-name").textContent = u.name; m.appendChild(b); });
    const smr = sm.getBoundingClientRect(), br = btn.getBoundingClientRect();
    m.style.left = Math.max(8, br.left - smr.left) + "px";
    m.style.top = (br.bottom - smr.top + 6) + "px";
    sm.appendChild(m);
    const closeStart = () => { sm.classList.remove("open"); m.remove(); };
    m.onclick = (e) => {
      e.stopPropagation();
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.id) { closeStart(); switchTo(+b.dataset.id); return; }
      const a = b.dataset.a;
      closeStart();
      if (a === "settings") { window.SettingsStartPage = "yourinfo"; WM.open("settings"); }
      else if (a === "lock") lock();
      else if (a === "signout") signOut();
    };
    setTimeout(() => document.addEventListener("click", function h(e) { if (!m.contains(e.target)) { m.remove(); document.removeEventListener("click", h, true); } }, true), 0);
  }
  function firstLogon() {
    const ov = el(`<div class="rc-hi"><div class="rc-hi-1">Hi</div><div class="rc-hi-2">We're setting things up for you</div><div class="rc-spin"><i></i><i></i><i></i><i></i><i></i></div></div>`);
    document.body.appendChild(ov);
    setTimeout(() => { ov.classList.add("rc-hi-2on"); }, 1100);
    setTimeout(() => { ov.classList.add("rc-out"); setTimeout(() => ov.remove(), 500); }, 2600);
    delete S().appData.firstLogon; State.save();
    log("Application", "Information", "User Profile Service", 1500, "A new user profile was created for " + current().name + " on first sign-in.");
  }

  // ------------------------------------------------------------------ Settings → Accounts → Other users
  function addAccountDialog(redraw) {
    const html = `<p class="rc-dim">The new person gets their own desktop, files, apps and settings on this PC.</p>
      <label class="rc-field"><span>User name</span><input class="rc-input rc-a-name" maxlength="20" autocomplete="off" spellcheck="false"></label>
      <label class="rc-field"><span>Account type</span><select class="rc-input rc-a-type"><option value="standard">Standard user</option><option value="admin">Administrator</option></select></label>
      <label class="rc-field"><span>Sign in with</span><select class="rc-input rc-a-method"><option value="pin">PIN (4 or 6 digits)</option><option value="password">Password</option><option value="none">No password</option></select></label>
      <div class="rc-a-secret"><label class="rc-field"><span class="rc-a-l1">PIN</span><input class="rc-input rc-a-s1" type="password" data-no-eye inputmode="numeric" autocomplete="new-password"></label>
      <label class="rc-field"><span class="rc-a-l2">Confirm PIN</span><input class="rc-input rc-a-s2" type="password" data-no-eye inputmode="numeric" autocomplete="new-password"></label></div>`;
    return modal({
      title: "Create an account for this PC", html,
      onOpen(api) {
        const sel = api.content.querySelector(".rc-a-method"), box = api.content.querySelector(".rc-a-secret");
        sel.onchange = () => {
          const v = sel.value; box.hidden = v === "none";
          const pin = v === "pin";
          api.content.querySelector(".rc-a-l1").textContent = pin ? "PIN" : "Password";
          api.content.querySelector(".rc-a-l2").textContent = pin ? "Confirm PIN" : "Confirm password";
          api.content.querySelectorAll(".rc-a-s1,.rc-a-s2").forEach((i) => { i.inputMode = pin ? "numeric" : "text"; i.value = ""; });
        };
      },
      buttons: [{ label: "Next", primary: true, onClick: async (api) => {
        const q = (s) => api.content.querySelector(s);
        const name = q(".rc-a-name").value.trim(), type = q(".rc-a-type").value, method = q(".rc-a-method").value, s1 = q(".rc-a-s1").value, s2 = q(".rc-a-s2").value;
        const bad = validName(name); if (bad) { api.error(bad); return false; }
        if (method === "pin" && !/^(\d{4}|\d{6})$/.test(s1)) { api.error("A PIN must be 4 or 6 digits."); return false; }
        if (method === "password" && s1.length < 4) { api.error("Use at least 4 characters for the password."); return false; }
        if (method !== "none" && s1 !== s2) { api.error("The two entries don't match."); return false; }
        api.error("");
        if (!(await elevate("Add a user account"))) { api.error("An administrator has to approve this."); return false; }
        api.busy(true);
        try { await create({ name, type, method, secret: s1 }); } catch (e) { api.busy(false); api.error(e.message); return false; }
        if (window.Notify) Notify.show({ icon: Icon.mini("settings", "Settings"), title: "Account added", body: name + " can now sign in from the lock screen." });
        if (redraw) redraw();
        return true;
      } }, { label: "Cancel", value: null }],
    });
  }
  window.SettingsSubs = window.SettingsSubs || {};
  window.SettingsSubs.otherusers = { title: "Other users", parent: "accounts", build(h, redraw) {
    const me = current();
    h.appendChild(el(`<div class="w12s-card rc-s-me">${avatar(me, 48)}<div><div class="w12s-row-t"></div><div class="w12s-row-s">${esc(typeLabel(me))} · signed in · ${esc(methodsText(me))}</div></div></div>`));
    h.querySelector(".rc-s-me .w12s-row-t").textContent = me.name + " (you)";
    const addCard = el(`<div class="w12s-card rc-s-add"><div><div class="w12s-row-t">Add other user</div><div class="w12s-row-s">${isAdmin() ? "Give someone their own desktop, files and apps on this PC." : "You're a standard user — an administrator will need to approve this."}</div></div><button class="w12s-btn w12s-btn-accent">Add account</button></div>`);
    addCard.querySelector("button").onclick = () => addAccountDialog(redraw);
    h.appendChild(addCard);
    const others = list().filter((u) => u.id !== MID);
    h.appendChild(el(`<div class="rc-s-h">Other users</div>`));
    if (!others.length) h.appendChild(el(`<div class="w12s-card"><div class="w12s-row-s">No other users yet.</div></div>`));
    others.forEach((u) => {
      const c = el(`<div class="w12s-card rc-s-user">
        <button type="button" class="rc-s-uhead" aria-expanded="false">${avatar(u, 40)}<div class="rc-s-utx"><div class="w12s-row-t"></div><div class="w12s-row-s">${esc(typeLabel(u))} · ${esc(methodsText(u))}</div></div><span class="rc-s-chev">›</span></button>
        <div class="rc-s-ubody" hidden>
          <div class="rc-s-line"><span>Last sign-in</span><b>${esc(when(u.lastSignIn))}</b></div>
          <div class="rc-s-line"><span>Account options</span><span class="rc-s-btns"><button class="w12s-btn" data-a="type">Change account type</button><button class="w12s-btn" data-a="switch">Switch to this account</button></span></div>
          <div class="rc-s-line"><span>Account and data</span><button class="w12s-btn w12s-btn-danger" data-a="remove">Remove</button></div>
        </div></div>`);
      c.querySelector(".rc-s-utx .w12s-row-t").textContent = u.name;
      const head = c.querySelector(".rc-s-uhead"), body = c.querySelector(".rc-s-ubody");
      head.onclick = () => { body.hidden = !body.hidden; head.setAttribute("aria-expanded", String(!body.hidden)); c.classList.toggle("open", !body.hidden); };
      c.querySelector('[data-a="switch"]').onclick = () => switchTo(u.id);
      c.querySelector('[data-a="type"]').onclick = async () => {
        const v = await modal({ title: "Change account type", html: `<div class="rc-uac-app">${avatar(u, 40)}<div><b>${esc(u.name)}</b><span>${esc(typeLabel(u))}</span></div></div><label class="rc-field"><span>Account type</span><select class="rc-input rc-t-sel"><option value="admin"${u.type === "admin" ? " selected" : ""}>Administrator</option><option value="standard"${u.type !== "admin" ? " selected" : ""}>Standard User</option></select></label>`,
          buttons: [{ label: "OK", primary: true, onClick: async (api) => {
            const t = api.content.querySelector(".rc-t-sel").value;
            if (t === u.type) return null;
            if (!(await elevate("Change account type"))) { api.error("An administrator has to approve this."); return false; }
            try { setType(u.id, t); } catch (e) { api.error(e.message); return false; }
            return t;
          } }, { label: "Cancel", value: null }] });
        if (v) redraw();
      };
      c.querySelector('[data-a="remove"]').onclick = async () => {
        const ok = await modal({ title: "Delete account and data?", html: `<p>Deleting ${esc(u.name)}'s account will remove all of their data from this PC, including items on their desktop, downloads, documents, photos, music and other files, plus their restore points. If you haven't backed it up, it will be lost.</p>`, buttons: [{ label: "Delete account and data", primary: true, value: true }, { label: "Cancel", value: false }] });
        if (!ok) return;
        if (!(await elevate("Delete a user account"))) return;
        try { remove(u.id); if (window.Notify) Notify.show({ icon: Icon.mini("settings", "Settings"), title: "Account removed", body: u.name + "'s account and data were deleted." }); }
        catch (e) { modal({ title: "Couldn't remove the account", html: `<p>${esc(e.message)}</p>` }); }
        redraw();
      };
      h.appendChild(c);
    });
  } };

  // ------------------------------------------------------------------ Terminal: net user, net localgroup, whoami, Get-LocalUser
  const sid = (u) => "S-1-5-21-3623811015-3361044348-30300820-" + (1000 + (u ? u.id : 0));
  async function netCmd(c) {
    const io = c.io, a = c.a.slice(), sub = (a[0] || "").toLowerCase();
    const host = "WIN12-PC";
    if (sub === "user" || sub === "users") {
      const rest = a.slice(1), flags = rest.filter((x) => /^\//.test(x)).map((x) => x.toLowerCase()), args = rest.filter((x) => !/^\//.test(x));
      if (!args.length) {
        io.out("\nUser accounts for \\\\" + host + "\n\n-------------------------------------------------------------------------------");
        const names = ["Administrator", "DefaultAccount", "Guest"].concat(list().map((u) => u.name));
        for (let i = 0; i < names.length; i += 3) io.out(names.slice(i, i + 3).map((n) => n.padEnd(25)).join("").trimEnd());
        io.out("The command completed successfully.\n"); return 0;
      }
      const name = args[0], u = list().find((x) => x.name.toLowerCase() === name.toLowerCase());
      if (flags.includes("/add")) {
        if (!(await elevate("net user " + name + " /add"))) { io.err("System error 5 has occurred.\n\nAccess is denied.\n"); return 2; }
        const pw = args[1] || "";
        try { await create({ name, type: "standard", method: pw ? (/^(\d{4}|\d{6})$/.test(pw) ? "pin" : "password") : "none", secret: pw }); } catch (e) { io.err(e.message.includes("exists") ? "The account already exists.\n\nMore help is available by typing NET HELPMSG 2224." : e.message); return 2; }
        io.out("The command completed successfully.\n"); return 0;
      }
      if (!u) { io.err("The user name could not be found.\n\nMore help is available by typing NET HELPMSG 2221.\n"); return 2; }
      if (flags.includes("/delete") || flags.includes("/del")) {
        if (!(await elevate("net user " + name + " /delete"))) { io.err("System error 5 has occurred.\n\nAccess is denied.\n"); return 2; }
        try { remove(u.id); } catch (e) { io.err(e.message); return 2; }
        io.out("The command completed successfully.\n"); return 0;
      }
      const L = (k, v) => io.out(k.padEnd(29) + v);
      io.out("");
      L("User name", u.name); L("Full Name", u.name); L("Comment", ""); L("User's comment", ""); L("Country/region code", "000 (System Default)");
      L("Account active", "Yes"); L("Account expires", "Never"); io.out("");
      L("Password required", u.methods.some((m) => m === "pin" || m === "password") ? "Yes" : "No");
      L("Sign-in methods", methodsText(u)); io.out("");
      L("Last logon", u.lastSignIn ? new Date(u.lastSignIn).toLocaleString() : "Never"); io.out("");
      L("Local Group Memberships", u.type === "admin" ? "*Administrators        *Users" : "*Users");
      L("Global Group memberships", "*None");
      io.out("The command completed successfully.\n"); return 0;
    }
    if (sub === "localgroup") {
      const g = (a[1] || "").toLowerCase(), who = a[2], flags = a.slice(2).map((x) => x.toLowerCase());
      if (!g) { io.out("\nAliases for \\\\" + host + "\n\n-------------------------------------------------------------------------------\n*Administrators\n*Guests\n*Remote Desktop Users\n*Users\nThe command completed successfully.\n"); return 0; }
      if (g !== "administrators" && g !== "users") { io.err("The specified local group does not exist.\n"); return 2; }
      if (who && (flags.includes("/add") || flags.includes("/delete"))) {
        const u = list().find((x) => x.name.toLowerCase() === who.toLowerCase());
        if (!u) { io.err("There is no such global user or group: " + who + ".\n"); return 2; }
        if (!(await elevate("net localgroup " + g))) { io.err("System error 5 has occurred.\n\nAccess is denied.\n"); return 2; }
        try { setType(u.id, (g === "administrators") === flags.includes("/add") ? "admin" : "standard"); } catch (e) { io.err(e.message); return 2; }
        io.out("The command completed successfully.\n"); return 0;
      }
      const members = g === "administrators" ? ["Administrator"].concat(list().filter((u) => u.type === "admin").map((u) => u.name)) : list().map((u) => u.name);
      io.out("Alias name     " + (g === "administrators" ? "Administrators" : "Users") + "\nComment        " + (g === "administrators" ? "Administrators have complete and unrestricted access to the computer/domain" : "Users are prevented from making accidental or intentional system-wide changes") + "\n\nMembers\n\n-------------------------------------------------------------------------------");
      members.forEach((n) => io.out(n)); io.out("The command completed successfully.\n"); return 0;
    }
    if (!sub || sub === "help" || sub === "/?") { io.out("The syntax of this command is:\n\nNET\n    [ LOCALGROUP | USER ]\n\n  net user                       list accounts\n  net user <name>                account details\n  net user <name> [pin|pw] /add  create a standard account\n  net user <name> /delete        delete an account and its data\n  net localgroup administrators [<name> /add | /delete]\n"); return 0; }
    io.err("This command isn't supported here. Try NET USER or NET LOCALGROUP.\n"); return 1;
  }
  function whoami(c, api) {
    const io = c.io, a = c.a.map((x) => x.toLowerCase()), me = current();
    const nm = "win12-pc\\" + String(me.name).replace(/\s+/g, "").toLowerCase();
    if (a.includes("/user") || a.includes("/all")) { io.out("\nUSER INFORMATION\n----------------\n\nUser Name" + " ".repeat(Math.max(1, nm.length - 8)) + "SID\n" + "=".repeat(nm.length) + " " + "=".repeat(sid(me).length) + "\n" + nm + " " + sid(me) + "\n"); }
    if (a.includes("/groups") || a.includes("/all")) {
      io.out("\nGROUP INFORMATION\n-----------------\n\nGroup Name                             Type             SID          Attributes\n====================================== ================ ============ ==================================================");
      io.out("Everyone                               Well-known group S-1-1-0      Mandatory group, Enabled by default, Enabled group");
      if (me.type === "admin") io.out("BUILTIN\\Administrators                 Alias            S-1-5-32-544 Group used for deny only");
      io.out("BUILTIN\\Users                          Alias            S-1-5-32-545 Mandatory group, Enabled by default, Enabled group");
      io.out("NT AUTHORITY\\INTERACTIVE               Well-known group S-1-5-4      Mandatory group, Enabled by default, Enabled group");
      io.out("Mandatory Label\\Medium Mandatory Level Label            S-1-16-8192\n");
    }
    if (!a.some((x) => /^\/(user|groups|all)$/.test(x))) io.out(nm);
    return 0;
  }
  function getLocalUser(c) {
    const io = c.io;
    io.out("\nName               Enabled Description\n----               ------- -----------");
    io.out("Administrator      False   Built-in account for administering the computer/domain");
    list().forEach((u) => io.out(u.name.slice(0, 18).padEnd(19) + "True    " + typeLabel(u) + (u.id === MID ? " (signed in)" : "")));
    io.out("DefaultAccount     False   A user account managed by the system.\nGuest              False   Built-in account for guest access to the computer/domain\n");
    return 0;
  }
  window.TerminalExt = window.TerminalExt || { cmd: {}, ps: {} };
  TerminalExt.cmd = TerminalExt.cmd || {}; TerminalExt.ps = TerminalExt.ps || {};
  TerminalExt.cmd.net = netCmd; TerminalExt.cmd.net1 = netCmd;
  TerminalExt.cmd.whoami = whoami;
  TerminalExt.ps["get-localuser"] = getLocalUser;

  // ------------------------------------------------------------------ start
  try { ensureReg(true); } catch (_) {}

  window.Accounts = {
    list, get, current, currentId: MID, isAdmin, typeLabel: (u) => typeLabel(u), methodsOf, methodsText,
    create, remove, setType, switchTo, signOut, lock, elevate, verify, needsSecret,
    modal, avatar, ensure: ensureReg, sync, readState, el, esc,
  };
})();
