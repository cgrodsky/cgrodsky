/* Microsoft Family Safety for this Windows 12 simulation.

   What it does (all inside the simulated OS — it cannot see or limit the real iPad, other
   browser tabs or other websites):
     · An administrator marks other local accounts (standard users) as "child" members.
     · Screen time: a daily allowance and an allowed time window per day of the week. Real usage
       is measured while that child is signed in and this page is visible and awake; warnings at
       15 and 5 minutes left, then a "Time's up" screen with "Ask for more time".
     · App & game limits: per-app daily limits and blocked apps, enforced at every launch path
       (WM.open, AppRegistry, Games.launch and, as a backstop, any new window).
     · Content filters for the in-OS browsers (Edge / Chrome windows): SafeSearch forced on
       (reuses js/browser.js's own SafeSearch lock) plus a block list or an allow-only list.
     · Activity: per child, per day — total screen time, time per app, app opens (own tracking +
       EventLog 9707 "Started execution" entries from the child's own event log), weekly chart.

   Storage (machine-wide, next to the account registry; never in a child's own state):
     win12_family_v1[__vmN]           POLICY — members, schedules, app/web rules, approved grants.
                                       Only written by commitPolicy(), which always runs the real
                                       admin-approval prompt first (Accounts.elevate: a standard user
                                       must type an administrator's PIN / password, checked against
                                       that admin's own saved state) or a verified parent approval.
     win12_family_activity_v1[__vmN]  ACTIVITY — measured usage, requests. Written by the child's
                                       session; it can't raise any limit by itself.

   window.Family = { isChild, screenStatus, appStatus, policy, activity, open, version } */
(function () {
  "use strict";
  if (!window.State || !State.keyFor || !window.Accounts) return;
  const LS = window.localStorage;
  const VMS = window.WIN12_VM_DEPTH ? "__vm" + window.WIN12_VM_DEPTH : "";
  const POLICY_KEY = "win12_family_v1" + VMS;
  const ACT_KEY = "win12_family_activity_v1" + VMS;
  const MID = State.accountId;
  const TICK = 5000;
  const NEVER_BLOCK = ["family"];
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function el(html) { const d = document.createElement("div"); d.innerHTML = String(html).trim(); return d.firstElementChild; }
  const log = (level, id, msg, logName) => { try { if (window.EventLog) EventLog.add(logName || "Application", level || "Information", "Microsoft Family Safety", id, msg); } catch (_) {} };
  const icon = () => (window.Icon ? Icon.mini("family", "Family Safety") : "");
  const toast = (title, body, onClick) => { try { if (window.Notify) Notify.show({ icon: icon(), title: esc(title), body: esc(body), onClick }); } catch (_) {} };
  const A = window.Accounts;
  const me = () => A.current();

  // ------------------------------------------------------------------ time helpers
  const pad = (n) => String(n).padStart(2, "0");
  const dayKey = (d) => { d = d || new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
  const minsOf = (hm) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(hm || "")); return m ? Math.min(1440, +m[1] * 60 + +m[2]) : null; };
  const hmOf = (mins) => { mins = Math.max(0, Math.min(1440, Math.round(mins))); return pad(Math.floor(mins / 60)) + ":" + pad(mins % 60); };
  const nowMins = (d) => { d = d || new Date(); return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60; };
  function fmtClock(hm) {
    const m = minsOf(hm); if (m == null) return "";
    if (m >= 1440) return "midnight";
    const d = new Date(2026, 0, 1, Math.floor(m / 60), m % 60);
    try { return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); } catch (_) { return hm; }
  }
  function fmtDur(secs, short) {
    secs = Math.max(0, Math.round(secs || 0));
    const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60);
    if (h && m) return h + " h " + m + (short ? "m" : " min");
    if (h) return h + " h";
    if (!m && secs > 0 && secs < 60) return "<1 min";
    return m + " min";
  }
  const fmtMins = (mins) => (mins == null ? "No limit" : mins === 0 ? "No screen time" : fmtDur(mins * 60));
  const DAY_NAMES = (() => { const out = []; for (let i = 0; i < 7; i++) { const d = new Date(2026, 1, 1 + i); /* Feb 1 2026 is a Sunday */ let n; try { n = d.toLocaleDateString(undefined, { weekday: "long" }); } catch (_) { n = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][i]; } out[d.getDay()] = n; } return out; })();
  const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

  // ------------------------------------------------------------------ storage
  function readJSON(k, def) { try { const v = JSON.parse(LS.getItem(k) || "null"); return v && typeof v === "object" ? v : def(); } catch (_) { return def(); } }
  const readPolicy = () => { const p = readJSON(POLICY_KEY, () => ({ v: 1, members: {}, grants: {}, rev: 0 })); p.members = p.members || {}; p.grants = p.grants || {}; return p; };
  const readAct = () => { const a = readJSON(ACT_KEY, () => ({ v: 1, usage: {}, requests: [], warned: {} })); a.usage = a.usage || {}; a.requests = Array.isArray(a.requests) ? a.requests : []; a.warned = a.warned || {}; return a; };
  function writeAct(a) { try { LS.setItem(ACT_KEY, JSON.stringify(a)); return true; } catch (_) { return false; } }
  function mutateAct(fn) { const a = readAct(); const r = fn(a); writeAct(a); return r; }

  const listeners = new Set();
  const emit = () => listeners.forEach((f) => { try { f(); } catch (_) {} });
  const onChange = (f) => { listeners.add(f); return () => listeners.delete(f); };

  function defaultMember() {
    const day = (we) => ({ limit: we ? 180 : 120, from: we ? "08:00" : "07:00", to: we ? "21:00" : "20:00" });
    return {
      addedAt: Date.now(), addedBy: me().name,
      screen: { on: true, days: [0, 1, 2, 3, 4, 5, 6].map((i) => day(i === 0 || i === 6)) },
      // A virtual machine is a separate copy of Windows without these family settings.
      apps: { hyperv: { block: true, limit: 0 } },
      web: { mode: "block", block: [], allow: ["wikipedia.org", "khanacademy.org", "duolingo.com", "microsoft.com"] },
    };
  }

  // Every change to the POLICY goes through here: the admin-approval prompt runs first.
  // `verified` is only passed by approveWith(), which has just checked a parent's PIN / password.
  async function commitPolicy(what, mutate, verified) {
    if (!verified) {
      let ok = false;
      try { ok = await A.elevate("Family Safety — " + what); } catch (_) { ok = false; }
      if (!ok) { log("Warning", 4110, "A change to family settings was not approved: " + what + "\r\nSigned-in user:\t" + me().name); return false; }
    }
    const p = readPolicy();
    mutate(p);
    // drop members whose account no longer exists, and old grants
    const ids = new Set(A.list().map((u) => String(u.id)));
    Object.keys(p.members).forEach((id) => { if (!ids.has(id)) delete p.members[id]; });
    const keep = new Set(lastDays(3));
    Object.keys(p.grants).forEach((id) => { const g = p.grants[id]; if (!p.members[id]) { delete p.grants[id]; return; } Object.keys(g || {}).forEach((d) => { if (!keep.has(d)) delete g[d]; }); });
    p.v = 1; p.rev = (p.rev | 0) + 1; p.updated = Date.now(); p.updatedBy = verified ? (verified.name || "") : me().name;
    try { LS.setItem(POLICY_KEY, JSON.stringify(p)); } catch (_) { return false; }
    log("Information", 4100, "Family settings changed: " + what + "\r\nChanged by:\t" + p.updatedBy + "\r\nSigned-in user:\t" + me().name);
    emit();
    setTimeout(evaluate, 0);
    return true;
  }
  function lastDays(n, from) { const out = []; const d = from ? new Date(from) : new Date(); for (let i = 0; i < n; i++) { out.push(dayKey(d)); d.setDate(d.getDate() - 1); } return out; }

  // ------------------------------------------------------------------ apps
  const catalog = () => (window.Catalog && Catalog.storeApps) || [];
  // One key per app: the Store catalog id (builtin keys, window appIds and titles map onto it).
  function canon(x) {
    if (!x) return "";
    x = String(x);
    const c = catalog();
    if (c.some((a) => a.id === x)) return x;
    const b = c.find((a) => a.builtin === x); if (b) return b.id;
    const lx = x.toLowerCase();
    const n = c.find((a) => String(a.name).toLowerCase() === lx); if (n) return n.id;
    return x;
  }
  function nameOf(key) {
    if (key === "family") return "Family Safety";
    if (key === "__desktop") return "Desktop & other";
    const a = catalog().find((x) => x.id === key);
    return a ? a.name : String(key).replace(/^./, (c) => c.toUpperCase());
  }
  const appIcon = (key) => (window.Icon ? Icon.mini(key === "__desktop" ? "winflag" : key, nameOf(key)) : "");
  function appChoices() {
    const seen = new Set(), out = [];
    catalog().forEach((a) => { if (!a || !a.id || seen.has(a.id) || a.id === "family") return; seen.add(a.id); out.push({ key: a.id, name: a.name, game: !!(a.game || a.cat === "Games") }); });
    return out.sort((x, y) => x.name.localeCompare(y.name));
  }

  // ------------------------------------------------------------------ members & status
  function isChild(id) {
    id = +id;
    const m = readPolicy().members[id]; if (!m) return false;
    const u = A.get(id); return !!u && u.type === "standard";
  }
  const children = () => { const p = readPolicy(); return A.list().filter((u) => p.members[u.id] && u.type === "standard"); };
  function grantOf(p, id, d) { const g = (p.grants[id] || {})[d || dayKey()]; return g || {}; }
  function usageOf(a, id, d) { const u = (a.usage[id] || {})[d || dayKey()]; return u || { t: 0, apps: {}, opens: {} }; }

  function screenStatus(id, when) {
    id = +id; when = when || new Date();
    const p = readPolicy(), m = p.members[id];
    if (!m || !m.screen || !m.screen.on || !isChild(id)) return { limited: false };
    const d = dayKey(when), day = (m.screen.days || [])[when.getDay()] || { limit: null, from: "00:00", to: "24:00" };
    const g = grantOf(p, id, d), used = usageOf(readAct(), id, d).t || 0;
    const nm = nowMins(when);
    const from = Math.min(minsOf(day.from) ?? 0, g.from != null ? g.from : 1440);
    const to = Math.max(minsOf(day.to) ?? 1440, g.to != null ? g.to : 0);
    const allowance = day.limit == null ? Infinity : (day.limit + (g.extra || 0)) * 60;
    const base = { limited: true, used, allowance, day, from, to, grant: g, date: d };
    // "Until <time>" from a parent overrides the allowance and the window for today.
    const until = minsOf(g.until);
    if (until != null && nm < until) return Object.assign(base, { left: (until - nm) * 60, until: g.until, reason: null });
    if (nm < from) return Object.assign(base, { left: 0, reason: "early" });
    const left = Math.min(allowance - used, (to - nm) * 60);
    let reason = null;
    if (left <= 0) reason = used >= allowance ? "allowance" : "late";
    return Object.assign(base, { left: Math.max(0, left), reason });
  }
  function appStatus(id, key) {
    key = canon(key);
    if (!key || NEVER_BLOCK.includes(key) || !isChild(id)) return { blocked: false };
    const p = readPolicy(), rule = ((p.members[id] || {}).apps || {})[key];
    if (!rule) return { blocked: false };
    const g = grantOf(p, id);
    if ((g.appsDay || {})[key]) return { blocked: false, allowedToday: true };
    if (rule.block) return { blocked: true, reason: "blocked" };
    if (rule.limit > 0) {
      const allowance = (rule.limit + ((g.apps || {})[key] || 0)) * 60, used = (usageOf(readAct(), id).apps || {})[key] || 0;
      if (used >= allowance) return { blocked: true, reason: "limit", allowance, used };
      return { blocked: false, left: allowance - used, allowance, used };
    }
    return { blocked: false };
  }
  function normHost(s) {
    s = String(s || "").trim().toLowerCase().replace(/^[a-z]+:\/\//, "").replace(/^www\./, "").replace(/[\/?#:].*$/, "");
    return s.replace(/[^a-z0-9.-]/g, "");
  }
  function hostMatches(host, entry) {
    host = normHost(host); entry = normHost(entry); if (!host || !entry) return false;
    if (entry.indexOf(".") < 0) return host.split(".").includes(entry);
    return host === entry || host.endsWith("." + entry);
  }
  function siteStatus(id, host) {
    if (!isChild(id) || !host) return { blocked: false };
    const p = readPolicy(), w = (p.members[id] || {}).web || {};
    const g = grantOf(p, id);
    if ((g.sites || []).some((s) => hostMatches(host, s))) return { blocked: false };
    if (w.mode === "allow") return (w.allow || []).some((s) => hostMatches(host, s)) ? { blocked: false } : { blocked: true, reason: "allow" };
    return (w.block || []).some((s) => hostMatches(host, s)) ? { blocked: true, reason: "block" } : { blocked: false };
  }

  // ------------------------------------------------------------------ grants, requests, approval
  function applyGrant(p, childId, kind, target, choice) {
    const d = dayKey();
    p.grants[childId] = p.grants[childId] || {};
    const g = p.grants[childId][d] = p.grants[childId][d] || {};
    const m = p.members[childId]; if (!m) return "";
    const nm = Math.floor(nowMins());
    if (kind === "time") {
      if (/^until:/.test(choice)) { g.until = choice.slice(6); return "until " + fmtClock(g.until); }
      const n = +choice || 15;
      // Outside the allowed hours the extra minutes start now ("until now + n");
      // otherwise they raise today's allowance (and stretch the window if it ends sooner).
      const st = screenStatus(childId);
      if (st.limited && (st.reason === "early" || st.reason === "late")) {
        const u = Math.min(1440, Math.ceil(nm + n));
        if ((minsOf(g.until) ?? -1) < u) g.until = hmOf(u);
      } else {
        g.extra = (g.extra || 0) + n;
        if (st.limited && st.to - nm < n) g.to = Math.max(g.to || 0, Math.min(1440, Math.ceil(nm + n)));
      }
      return n + " more minutes";
    }
    if (kind === "app") {
      const key = canon(target);
      if (choice === "day") { g.appsDay = g.appsDay || {}; g.appsDay[key] = true; return nameOf(key) + " for the rest of today"; }
      if (choice === "always") { m.apps = m.apps || {}; delete m.apps[key]; return nameOf(key) + " without limits"; }
      const n = +choice || 15; g.apps = g.apps || {}; g.apps[key] = (g.apps[key] || 0) + n;
      return n + " more minutes of " + nameOf(key);
    }
    if (kind === "site") {
      const host = normHost(target);
      if (choice === "always") {
        m.web = m.web || { mode: "block", block: [], allow: [] };
        m.web.block = (m.web.block || []).filter((s) => !hostMatches(host, s));
        if (m.web.mode === "allow" && !(m.web.allow || []).some((s) => hostMatches(host, s))) (m.web.allow = m.web.allow || []).push(host);
        return host + " (always)";
      }
      g.sites = g.sites || []; if (!g.sites.includes(host)) g.sites.push(host);
      return host + " for today";
    }
    return "";
  }
  function choicesFor(kind) {
    if (kind === "time") {
      const out = [["15", "15 more minutes"], ["30", "30 more minutes"], ["60", "1 more hour"]];
      const h = new Date().getHours() + 1;
      for (let x = h; x <= 23 && out.length < 7; x++) out.push(["until:" + pad(x) + ":00", "Until " + fmtClock(pad(x) + ":00")]);
      return out;
    }
    if (kind === "app") return [["15", "15 more minutes"], ["30", "30 more minutes"], ["60", "1 more hour"], ["day", "Allow for the rest of today"], ["always", "Always allow (remove the limit)"]];
    return [["day", "Allow for today"], ["always", "Always allow this site"]];
  }
  const kindLabel = (r) => (r.kind === "time" ? "more screen time" : r.kind === "app" ? "to use " + nameOf(r.target) : "to visit " + r.target);

  function addRequest(kind, target, note) {
    const childId = MID, name = me().name;
    const r = mutateAct((a) => {
      let x = a.requests.find((q) => q.child === childId && q.kind === kind && q.target === (target || "") && q.status === "pending");
      if (x) { x.at = Date.now(); x.seen = {}; }
      else { x = { id: "rq" + Date.now().toString(36) + Math.floor(Math.random() * 1e4), child: childId, childName: name, kind, target: target || "", note: note || "", at: Date.now(), status: "pending", seen: {} }; a.requests.push(x); }
      a.requests = a.requests.slice(-60);
      return x;
    });
    log("Information", 4102, name + " asked " + kindLabel(r) + ".\r\nThe request is waiting for a parent in Family Safety.");
    emit();
    return r;
  }
  function settleRequests(childId, kind, target, status, by, grantText) {
    mutateAct((a) => a.requests.forEach((q) => {
      if (q.child === +childId && q.kind === kind && q.target === (target || "") && q.status === "pending") { q.status = status; q.by = by; q.grant = grantText || ""; q.done = Date.now(); }
    }));
  }
  // A parent approved with their PIN / password (checked here) — commit without a second prompt.
  async function approveWith(adminId, secret, childId, kind, target, choice) {
    const u = A.get(adminId);
    if (!u || u.type !== "admin") return { ok: false, error: "Pick a parent (administrator) account." };
    if (A.needsSecret(adminId) && !secret) return { ok: false, error: "Enter " + u.name + "'s PIN or password." };
    const ok = await A.verify(adminId, secret);
    if (!ok) {
      log("Audit Failure", 4625, "An account failed to log on (Family Safety approval).\r\nAccount Name:\t" + u.name + "\r\nStatus:\t0xC000006D", "Security");
      return { ok: false, error: "The PIN or password is incorrect." };
    }
    log("Audit Success", 4648, "A logon was attempted using explicit credentials (Family Safety approval).\r\nSubject:\t" + me().name + "\r\nAccount Whose Credentials Were Used:\t" + u.name, "Security");
    let text = "";
    const done = await commitPolicy("approve " + kind + " request", (p) => { text = applyGrant(p, childId, kind, target, choice); }, u);
    if (!done) return { ok: false, error: "Couldn't save the approval." };
    settleRequests(childId, kind, target, "approved", u.name, text);
    log("Information", 4103, u.name + " approved " + text + " for " + ((A.get(childId) || {}).name || "a child") + ".");
    emit();
    return { ok: true, text };
  }

  // "Ask" dialog: a parent here approves on the spot, or the child sends a request.
  function askDialog(kind, target, intro) {
    const admins = A.list().filter((u) => u.type === "admin" && u.id !== MID);
    const title = kind === "time" ? "Ask for more time" : kind === "app" ? "Ask to use " + nameOf(target) : "Ask to visit " + target;
    const html = `<div class="fam-ask">
      <p>${esc(intro || "")}</p>
      ${admins.length ? `<div class="fam-ask-sec"><div class="fam-ask-h">A parent is here</div>
        <label class="fam-field"><span>Parent</span><select class="fam-in fam-ask-who">${admins.map((u) => `<option value="${u.id}">${esc(u.name)}</option>`).join("")}</select></label>
        <label class="fam-field"><span>Parent's PIN or password</span><input class="fam-in fam-ask-pw" type="password" data-no-eye autocomplete="off"></label>
        <label class="fam-field"><span>Allow</span><select class="fam-in fam-ask-grant">${choicesFor(kind).map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join("")}</select></label></div>` : `<p class="fam-dim">There's no parent (administrator) account on this PC yet.</p>`}
      <p class="fam-dim">No parent nearby? Send a request — it shows up in their Family Safety app and notifications the next time they sign in.</p></div>`;
    const buttons = [];
    if (admins.length) buttons.push({ label: "Approve", primary: true, onClick: async (api) => {
      const q = (s) => api.content.querySelector(s);
      api.busy(true);
      const r = await approveWith(+q(".fam-ask-who").value, q(".fam-ask-pw").value, MID, kind, target || "", q(".fam-ask-grant").value);
      api.busy(false);
      if (!r.ok) { api.error(r.error); const pw = q(".fam-ask-pw"); pw.value = ""; try { pw.focus(); } catch (_) {} return false; }
      toast("Approved", "A parent allowed " + r.text + ".");
      return "approved";
    } });
    buttons.push({ label: "Send request", primary: !admins.length, onClick: () => { addRequest(kind, target); toast("Request sent", "Your parent will see it in Family Safety."); return "sent"; } });
    buttons.push({ label: "Cancel", value: null });
    return A.modal({ title, html, buttons });
  }

  // ------------------------------------------------------------------ usage tracking (child session)
  let desktopUp = false, lastTick = 0;
  const session = { tu: null, warned: new Set(), lastReqCheck: 0, blockedAt: {} };
  function isLockedOut() { return !!document.querySelector(".lock-screen"); }
  function idleNow() { try { return !!(window.IdleLock && ["saver", "off", "sleep"].includes(IdleLock.state())); } catch (_) { return false; } }
  function wins() { try { return (window.WM && WM.windows ? WM.windows() : []).filter((e) => e && e.win && e.win.isConnected); } catch (_) { return []; } }
  function fgKey() {
    let top = null, z = -1;
    wins().forEach((e) => {
      if (e.win.style.display === "none") return;
      try { if (window.WinX && WinX.onActive && !WinX.onActive(e)) return; } catch (_) {}
      const zi = parseInt(e.win.style.zIndex, 10) || 0; if (zi > z) { z = zi; top = e; }
    });
    return top ? canon(top.appId) || "__desktop" : "__desktop";
  }
  function record(secs, key) {
    if (!(secs > 0)) return;
    mutateAct((a) => {
      const u = a.usage[MID] = a.usage[MID] || {};
      const d = dayKey(), x = u[d] = u[d] || { t: 0, apps: {}, opens: {} };
      x.t = Math.round((x.t + secs) * 10) / 10;
      x.apps = x.apps || {}; x.apps[key] = Math.round(((x.apps[key] || 0) + secs) * 10) / 10;
      const keep = new Set(lastDays(35));
      Object.keys(u).forEach((k) => { if (!keep.has(k)) delete u[k]; });
    });
  }
  function countOpen(key) {
    mutateAct((a) => { const u = a.usage[MID] = a.usage[MID] || {}; const d = dayKey(), x = u[d] = u[d] || { t: 0, apps: {}, opens: {} }; x.opens = x.opens || {}; x.opens[key] = (x.opens[key] || 0) + 1; });
  }
  function step() {
    const now = Date.now();
    const dt = lastTick ? Math.min(Math.max(0, now - lastTick), TICK * 2) : 0;
    lastTick = now;
    if (!desktopUp) return;
    if (!isChild(MID)) { hideTimesUp(); return; }
    ensureSafeSearch(); wrapRegistry(); hookGames();
    const st = screenStatus(MID);
    const active = document.visibilityState === "visible" && !isLockedOut() && !idleNow() && !(st.limited && st.left <= 0);
    if (active && dt > 0) record(dt / 1000, fgKey());
    evaluate();
  }
  function loop() { try { step(); } catch (e) { try { console.warn("Family Safety:", e); } catch (_) {} } setTimeout(loop, TICK); }
  document.addEventListener("visibilitychange", () => { lastTick = Date.now(); if (document.visibilityState === "visible") setTimeout(evaluate, 0); });
  window.addEventListener("storage", (e) => { if (e.key === POLICY_KEY || e.key === ACT_KEY) { emit(); evaluate(); } });

  function evaluate() {
    if (!desktopUp || !isChild(MID)) { hideTimesUp(); return; }
    const st = screenStatus(MID);
    if (st.limited && st.left <= 0) showTimesUp(st);
    else {
      hideTimesUp(st);
      if (st.limited && isFinite(st.left)) {
        const g = st.grant || {}, sig = [st.date, g.extra || 0, g.until || "", g.from == null ? "" : g.from, g.to == null ? "" : g.to, st.day.limit, st.day.from, st.day.to].join("|");
        [[15, "15 minutes left"], [5, "5 minutes left"]].forEach(([m, t]) => {
          const k = sig + "|" + m;
          if (st.left <= m * 60 && st.left > (m === 15 ? 5 * 60 : 0) && !session.warned.has(k)) {
            session.warned.add(k);
            toast(t, "Screen time ends at " + new Date(Date.now() + st.left * 1000).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) + ". Save your work — or ask a parent for more time.", () => askDialog("time", "", "You have " + fmtDur(st.left) + " left today."));
            log("Information", 4105, me().name + " has " + m + " minutes of screen time left today.");
          }
        });
      }
    }
    // app limits on apps that are already open
    const open = new Set(wins().map((e) => canon(e.appId)).filter(Boolean));
    open.forEach((k) => {
      const s = appStatus(MID, k);
      if (s.blocked) { closeApp(k); blockedDialog(k, s); }
      else if (s.left != null && s.left <= 300) {
        const wk = dayKey() + "|app|" + k + "|" + s.allowance;
        if (!session.warned.has(wk)) { session.warned.add(wk); toast(nameOf(k) + ": 5 minutes left", "Your time limit for " + nameOf(k) + " is almost up for today."); }
      }
    });
    // answers to this child's requests
    if (Date.now() - session.lastReqCheck > 4000) {
      session.lastReqCheck = Date.now();
      const done = readAct().requests.filter((r) => r.child === MID && r.status !== "pending" && !r.childSeen);
      if (done.length) {
        mutateAct((a) => a.requests.forEach((r) => { if (r.child === MID && r.status !== "pending") r.childSeen = true; }));
        done.slice(-3).forEach((r) => toast(r.status === "approved" ? "Request approved" : "Request declined", r.status === "approved" ? (r.by || "A parent") + " allowed " + (r.grant || kindLabel(r)) + "." : (r.by || "A parent") + " said no to " + kindLabel(r) + "."));
      }
    }
  }
  function closeApp(key) { wins().filter((e) => canon(e.appId) === key).forEach((e) => { try { e.close(); } catch (_) {} }); }

  // SafeSearch: reuse js/browser.js's own setting, locked on for a child.
  function ensureSafeSearch() {
    const d = State.data; d.appData = d.appData || {};
    const s = d.appData.safety || (d.appData.safety = {});
    const child = isChild(MID);
    if (child && !(s.asked && s.locked && s.safeSearch && s.famLocked)) { Object.assign(s, { asked: true, adult: false, safeSearch: true, locked: true, famLocked: true }); State.save(); }
    else if (!child && s.famLocked) { delete s.famLocked; s.locked = false; s.asked = false; State.save(); }
  }

  // ------------------------------------------------------------------ "Time's up"
  function reasonText(st) {
    const day = st.day || {};
    if (st.reason === "early") return "Screen time starts at " + fmtClock(hmOf(st.from)) + " today.";
    if (st.reason === "late") return "Screen time is allowed until " + fmtClock(hmOf(st.to)) + " on " + DAY_NAMES[new Date().getDay()] + "s.";
    if (day.limit === 0) return "There's no screen time on " + DAY_NAMES[new Date().getDay()] + "s.";
    return "You've used your " + fmtDur(st.allowance) + " of screen time for today.";
  }
  const keyBlock = (e) => {
    if (!session.tu || session.tu.hidden) return;
    if (e.target && e.target.closest && (e.target.closest(".fam-tu") || e.target.closest(".rc-modal-dim"))) return;
    e.stopImmediatePropagation(); e.preventDefault();
  };
  window.addEventListener("keydown", keyBlock, true);
  function showTimesUp(st) {
    let tu = session.tu;
    if (!tu || !tu.isConnected) {
      tu = session.tu = el(`<div class="fam-tu" role="dialog" aria-modal="true" aria-labelledby="fam-tu-h">
        <div class="fam-tu-bg"></div>
        <div class="fam-tu-card">
          <div class="fam-tu-ic" aria-hidden="true"><svg viewBox="0 0 48 48" width="56" height="56" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 6h20M14 42h20M16 6c0 9 8 12 8 18s-8 9-8 18M32 6c0 9-8 12-8 18s8 9 8 18"/><path d="M19 38c1-3 3-4 5-5 2 1 4 2 5 5z" fill="currentColor" stroke="none"/></svg></div>
          <div class="fam-tu-clock"></div>
          <h1 id="fam-tu-h">Time's up</h1>
          <p class="fam-tu-why"></p>
          <p class="fam-tu-sub">Your family set this limit in Family Safety. Your apps are still open — they'll be right here when you get more time.</p>
          <div class="fam-tu-btns"><button type="button" class="fam-btn fam-btn-primary" data-a="ask">Ask for more time</button><button type="button" class="fam-btn" data-a="signout">Sign out</button></div>
          <div class="fam-tu-status" role="status"></div>
        </div></div>`);
      tu.querySelector('[data-a="ask"]').onclick = () => askDialog("time", "", reasonText(screenStatus(MID))).then(() => { paintTU(); evaluate(); });
      tu.querySelector('[data-a="signout"]').onclick = () => A.signOut();
      document.body.appendChild(tu);
      try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch (_) {}
      log("Information", 4101, "Screen time is up for " + me().name + ". " + reasonText(st));
      document.body.classList.add("fam-timesup-on");
      setTimeout(() => { try { tu.querySelector('[data-a="ask"]').focus(); } catch (_) {} }, 80);
    }
    tu.hidden = isLockedOut();
    tu.__st = st;
    paintTU();
  }
  function paintTU() {
    const tu = session.tu; if (!tu) return;
    const st = tu.__st || screenStatus(MID);
    tu.querySelector(".fam-tu-why").textContent = reasonText(st);
    tu.querySelector("h1").textContent = st.reason === "early" ? "Not yet" : st.reason === "late" ? "That's it for today" : "Time's up";
    try { tu.querySelector(".fam-tu-clock").textContent = new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); } catch (_) {}
    const pend = readAct().requests.filter((r) => r.child === MID && r.kind === "time" && r.status === "pending").pop();
    tu.querySelector(".fam-tu-status").textContent = pend ? "Request sent at " + new Date(pend.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) + " — a parent will see it when they sign in." : "";
    try { const wp = State.data.desktop && State.data.desktop.wallpaper; const bg = tu.querySelector(".fam-tu-bg"); bg.style.backgroundImage = !wp || wp === "default" ? "url(assets/wall3.jpg)" : /^(data:|http|assets\/)/.test(wp) ? `url(${wp})` : "none"; } catch (_) {}
  }
  function hideTimesUp(st) {
    const tu = session.tu; if (!tu) return;
    session.tu = null; tu.classList.add("fam-out"); setTimeout(() => tu.remove(), 220);
    document.body.classList.remove("fam-timesup-on");
    if (st && st.limited) toast("You have more time", (st.until ? "You can use this PC until " + fmtClock(st.until) : fmtDur(st.left) + " of screen time left") + ".");
  }

  // ------------------------------------------------------------------ app & game blocking
  let dlgOpen = null;
  function blockedDialog(key, s) {
    const now = Date.now();
    if (dlgOpen === key || (session.blockedAt[key] && now - session.blockedAt[key] < 1200)) return;
    session.blockedAt[key] = now; dlgOpen = key;
    const name = nameOf(key);
    log("Information", 4104, name + " was blocked for " + me().name + " (" + (s.reason === "limit" ? "daily limit reached" : "blocked by a parent") + ").");
    const msg = s.reason === "limit" ? `You've used ${esc(name)} for ${esc(fmtDur(s.used))} today — that's your limit.` : `${esc(name)} isn't allowed on your account.`;
    A.modal({ title: s.reason === "limit" ? "Time limit reached" : "This app is blocked",
      html: `<div class="fam-blk"><span class="fam-blk-ic">${appIcon(key)}</span><div><b>${esc(name)}</b><p>${msg}</p><p class="fam-dim">Your family manages this in Family Safety.</p></div></div>`,
      buttons: [{ label: "Ask to use", primary: true, value: "ask" }, { label: "OK", value: null }] })
      .then((v) => { dlgOpen = null; session.blockedAt[key] = Date.now(); if (v === "ask") return askDialog("app", key, s.reason === "limit" ? "You've reached today's limit for " + name + "." : name + " is blocked on your account."); })
      .then((v) => { if (v === "approved" && !appStatus(MID, key).blocked && window.WM) setTimeout(() => WM.open(key), 250); });
  }
  // Returns true when `id` may start now (child session only); shows the dialog otherwise.
  function guard(id) {
    if (!desktopUp || !isChild(MID)) return true;
    const key = canon(id);
    if (NEVER_BLOCK.includes(key)) return true;
    const st = screenStatus(MID);
    if (st.limited && st.left <= 0) { evaluate(); return false; }
    const s = appStatus(MID, key);
    if (s.blocked) { blockedDialog(key, s); return false; }
    return true;
  }
  const stubRef = () => { const d = document.createElement("div"); return { body: d, win: document.createElement("div"), close() {}, focus() {}, navigate() {} }; };
  function wrapRegistry() {
    const R = window.AppRegistry; if (!R) return;
    Object.keys(R).forEach((k) => {
      const f = R[k];
      if (typeof f !== "function" || f.__fam) return;
      const w = function () { if (!guard(k)) return stubRef(); return f.apply(this, arguments); };
      try { Object.keys(f).forEach((p) => { w[p] = f[p]; }); } catch (_) {}
      w.__fam = true; R[k] = w;
    });
  }
  function hookGames() {
    if (!window.Games || !Games.launch || Games.launch.__fam) return;
    const o = Games.launch;
    const w = function (app) { if (!guard((app && app.id) || "")) return stubRef(); return o.apply(this, arguments); };
    w.__fam = true; Games.launch = w;
  }
  function hookOpen() {
    if (!window.WM || !WM.open || WM.open.__fam) return;
    const o = WM.open;
    const w = function (id) { if (!guard(id)) return; return o.apply(this, arguments); };
    w.__fam = true; WM.open = w;
  }
  // Backstop: any new window (decorative Store apps open straight through createWindow).
  function watchWindows() {
    const scr = document.getElementById("screen"); if (!scr || scr.__fam) return; scr.__fam = true;
    new MutationObserver((muts) => {
      for (const m of muts) {
        for (const n of m.addedNodes) {
          if (!n || n.nodeType !== 1) continue;
          if (n.classList.contains("lock-screen") && session.tu) session.tu.hidden = true;
          if (!n.classList.contains("win")) continue;
          if (!desktopUp || !isChild(MID)) continue;
          setTimeout(() => {
            const e = window.WM && WM.entryFor ? WM.entryFor(n) : null; if (!e) return;
            const key = canon(e.appId); if (!key) return;
            const s = appStatus(MID, key), st = screenStatus(MID);
            if (s.blocked) { try { e.close(); } catch (_) {} blockedDialog(key, s); return; }
            if (st.limited && st.left <= 0) { try { e.close(); } catch (_) {} return; }
            countOpen(key);
            if (n.querySelector(".browser-page")) hookBrowser(n);
          }, 0);
        }
        for (const n of m.removedNodes) if (n && n.nodeType === 1 && n.classList.contains("lock-screen") && session.tu) { session.tu.hidden = false; }
      }
    }).observe(scr, { childList: true });
  }

  // ------------------------------------------------------------------ web filter (in-OS browser windows only)
  const SPECIAL_HOST = { bank: "bank.local", amazon: "amazon.com", microsoft: "microsoft.com", youtube: "youtube.com", discord: "discord.com", duolingo: "duolingo.com", netflix: "netflix.com", flightstats: "flightstats.com", flights: "flightstats.com", doordash: "doordash.com" };
  function pageTarget(win) {
    const page = win.querySelector(".browser-page"); if (!page) return null;
    if (page.querySelector(".fam-webblock")) return null;
    const fr = page.querySelector("iframe.embed-frame");
    if (fr) { const src = fr.getAttribute("src") || ""; return { host: fr.classList.contains("g-frame") ? "google.com" : normHost(src), url: src, frame: true }; }
    if (page.querySelector(".edge-home, .google-home, .bw-age, .srch, .bw-warn")) return null;
    const inp = win.querySelector(".url"); const v = normHost(inp ? inp.value : "");
    if (!v) return null;
    const bare = v.replace(/\.(local|com)$/, "");
    if (SPECIAL_HOST[bare]) return { host: SPECIAL_HOST[bare], url: v };
    return null;
  }
  function hookBrowser(win) {
    if (win.__famWeb) return; win.__famWeb = true;
    let queued = false;
    const check = () => {
      queued = false;
      if (!win.isConnected || !isChild(MID)) return;
      // SafeSearch's own wording assumes the user answered an age question; say who locked it.
      win.querySelectorAll(".bw-warn p").forEach((p) => { if (/you said you're under 18/.test(p.textContent) && !p.__fam) { p.__fam = true; p.innerHTML = p.innerHTML.replace(/SafeSearch is locked on because you said you're under 18[^.]*\./, "SafeSearch is locked on by your family settings."); } });
      const t = pageTarget(win); if (!t) return;
      const s = siteStatus(MID, t.host); if (!s.blocked) return;
      const page = win.querySelector(".browser-page");
      page.innerHTML = "";
      log("Information", 4106, "A website was blocked for " + me().name + ": " + t.host + (s.reason === "allow" ? " (not on the allowed list)" : " (on the blocked list)") + ".");
      const card = el(`<div class="fam-webblock"><div class="fam-wb-card">
        <div class="fam-wb-ic" aria-hidden="true">${icon()}</div>
        <h2>This site is blocked</h2>
        <p class="fam-wb-host"></p>
        <p>${s.reason === "allow" ? "Your family only allows certain websites on your account, and this isn't one of them yet." : "Your family has blocked this website on your account."}</p>
        <div class="fam-wb-btns"><button type="button" class="fam-btn" data-a="back">Go back</button><button type="button" class="fam-btn fam-btn-primary" data-a="ask">Ask to visit</button></div>
        <p class="fam-dim fam-wb-note">Family Safety filters websites in this Windows 12 simulation's browser only.</p></div></div>`);
      card.querySelector(".fam-wb-host").textContent = t.host;
      card.querySelector('[data-a="back"]').onclick = () => { const b = win.querySelector(".bb-nav.back"); if (b) b.click(); };
      card.querySelector('[data-a="ask"]').onclick = () => askDialog("site", t.host, t.host + " is blocked on your account.").then((v) => { if (v === "approved") { const r = win.querySelector(".bb-nav.reload"); if (r) r.click(); } });
      page.appendChild(card);
    };
    // Only a navigation replaces the page's direct children (typing in the address bar doesn't).
    const pg = win.querySelector(".browser-page");
    if (pg) new MutationObserver(() => { if (!queued) { queued = true; Promise.resolve().then(check); } }).observe(pg, { childList: true });
    check();
  }

  // ------------------------------------------------------------------ sign-in hooks
  function onDesktop() {
    desktopUp = true; lastTick = Date.now();
    if (isChild(MID)) {
      ensureSafeSearch(); wrapRegistry(); hookGames(); hookOpen();
      document.querySelectorAll("#screen .win").forEach((w) => { if (w.querySelector(".browser-page")) hookBrowser(w); });
      const st = screenStatus(MID);
      evaluate();
      setTimeout(() => {
        if (st.limited && st.left > 0 && isFinite(st.left)) toast("Screen time", "You have " + fmtDur(st.left) + " left today" + (st.until || st.to >= 1440 ? "" : " (until " + fmtClock(hmOf(st.to)) + " at the latest)") + ".");
        evaluate();
      }, 1500);
    } else {
      ensureSafeSearch();
      if (me().type === "admin") setTimeout(notifyAdmin, 2600);
    }
  }
  function notifyAdmin() {
    const pend = readAct().requests.filter((r) => r.status === "pending" && !(r.seen || {})[MID] && isChild(r.child));
    if (!pend.length) return;
    const show = pend.slice(-3);
    show.forEach((r) => toast("Family Safety request", (r.childName || "Your child") + " asked " + kindLabel(r) + " · " + new Date(r.at).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" }), () => openApp({ view: "requests" })));
    if (pend.length > show.length) toast("Family Safety", (pend.length - show.length) + " more requests are waiting.", () => openApp({ view: "requests" }));
    mutateAct((a) => a.requests.forEach((r) => { if (pend.some((x) => x.id === r.id)) { r.seen = r.seen || {}; r.seen[MID] = Date.now(); } }));
  }
  if (window.WM && WM.buildDesktop && !WM.__fam) {
    const o = WM.buildDesktop; WM.__fam = true;
    WM.buildDesktop = function () { const r = o.apply(this, arguments); try { onDesktop(); } catch (e) { try { console.warn("Family Safety:", e); } catch (_) {} } return r; };
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watchWindows); else watchWindows();
  setTimeout(loop, TICK);

  // ================================================================== UI
  const avatar = (u, s) => A.avatar(u, s || 40);
  function todayLine(id) {
    const st = screenStatus(id), used = usageOf(readAct(), id).t || 0;
    if (!st.limited) return fmtDur(used) + " today · no screen time limit";
    if (st.left <= 0) return fmtDur(used) + " today · " + (st.reason === "early" ? "starts at " + fmtClock(hmOf(st.from)) : st.reason === "late" ? "done for today (after " + fmtClock(hmOf(st.to)) + ")" : "time's up");
    return fmtDur(used) + " used · " + (st.until ? "until " + fmtClock(st.until) : fmtDur(st.left) + " left");
  }

  // ---------- weekly chart (single series: minutes per day; thin tick = that day's limit)
  function weekChart(id, selected, onPick) {
    const p = readPolicy(), act = readAct(), m = p.members[id] || {};
    const days = lastDays(7).reverse();
    const data = days.map((d) => {
      const dt = new Date(d + "T12:00:00");
      const day = ((m.screen || {}).days || [])[dt.getDay()] || {};
      const g = grantOf(p, id, d);
      const lim = m.screen && m.screen.on && day.limit != null ? day.limit + (g.extra || 0) : null;
      return { d, dt, mins: (usageOf(act, id, d).t || 0) / 60, lim };
    });
    const max = Math.max(60, ...data.map((x) => Math.max(x.mins, x.lim || 0))) * 1.1;
    const step = max > 600 ? 240 : max > 300 ? 120 : max > 120 ? 60 : 30;
    const grid = []; for (let v = step; v < max; v += step) grid.push(v);
    const avg = data.reduce((s, x) => s + x.mins, 0) / 7;
    const box = el(`<figure class="fam-chart" aria-label="Screen time over the last 7 days">
      <figcaption class="fam-chart-cap"><b>Last 7 days</b><span>Daily average ${esc(fmtDur(avg * 60))}</span></figcaption>
      <div class="fam-chart-plot">
        <div class="fam-chart-grid">${grid.map((v) => `<div class="fam-gl" style="bottom:${(v / max * 100).toFixed(2)}%"><span>${v >= 60 ? v / 60 + " h" : v + " m"}</span></div>`).join("")}</div>
        <div class="fam-chart-bars"></div>
      </div>
      <div class="fam-chart-x"></div>
      <div class="fam-chart-tip" role="status" hidden></div>
      <table class="fam-sr"><caption>Screen time per day</caption><thead><tr><th>Day</th><th>Screen time</th><th>Limit</th></tr></thead><tbody>${data.map((x) => `<tr><td>${esc(x.dt.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }))}</td><td>${esc(fmtDur(x.mins * 60))}</td><td>${esc(x.lim == null ? "No limit" : fmtDur(x.lim * 60))}</td></tr>`).join("")}</tbody></table>
    </figure>`);
    const bars = box.querySelector(".fam-chart-bars"), xs = box.querySelector(".fam-chart-x"), tip = box.querySelector(".fam-chart-tip");
    const today = dayKey();
    data.forEach((x) => {
      const label = x.dt.toLocaleDateString(undefined, { weekday: "short" });
      const full = x.dt.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }) + ": " + fmtDur(x.mins * 60) + (x.lim == null ? "" : " of " + fmtDur(x.lim * 60));
      const col = el(`<button type="button" class="fam-col${x.d === selected ? " on" : ""}" aria-label="${esc(full)}" aria-pressed="${x.d === selected}">
        <span class="fam-bar" style="height:${Math.max(x.mins > 0 ? 1.5 : 0, x.mins / max * 100).toFixed(2)}%"></span>
        ${x.lim != null ? `<span class="fam-lim" style="bottom:${(x.lim / max * 100).toFixed(2)}%"></span>` : ""}</button>`);
      const show = () => { tip.hidden = false; tip.textContent = full; const r = col.getBoundingClientRect(), b = box.getBoundingClientRect(); tip.style.left = Math.min(Math.max(4, r.left - b.left + r.width / 2), b.width - 4) + "px"; };
      col.addEventListener("pointerenter", show); col.addEventListener("focus", show);
      col.addEventListener("pointerleave", () => { tip.hidden = true; }); col.addEventListener("blur", () => { tip.hidden = true; });
      col.onclick = () => onPick && onPick(x.d);
      bars.appendChild(col);
      xs.appendChild(el(`<span class="${x.d === today ? "fam-today" : ""}">${esc(x.d === today ? "Today" : label)}</span>`));
    });
    return box;
  }
  function topApps(id, d) {
    const u = usageOf(readAct(), id, d), rows = {};
    Object.keys(u.apps || {}).forEach((k) => { rows[k] = rows[k] || { k, t: 0, n: 0 }; rows[k].t += u.apps[k]; });
    Object.keys(u.opens || {}).forEach((k) => { rows[k] = rows[k] || { k, t: 0, n: 0 }; rows[k].n = Math.max(rows[k].n, u.opens[k]); });
    // app opens recorded in the child's own event log (Event Viewer → Application, ID 9707)
    try {
      const st = id === MID ? State.data : A.readState(id);
      const evs = (st && st.appData && st.appData.eventLog) || [];
      const ev = {};
      evs.forEach((e) => { if (e.id === 9707 && e.data && e.data.app && dayKey(new Date(e.ts)) === d) { const k = canon(e.data.app); ev[k] = (ev[k] || 0) + 1; } });
      Object.keys(ev).forEach((k) => { rows[k] = rows[k] || { k, t: 0, n: 0 }; rows[k].n = Math.max(rows[k].n, ev[k]); });
    } catch (_) {}
    return Object.values(rows).sort((a, b) => b.t - a.t || b.n - a.n);
  }

  // ---------- the app
  function openApp(opts) {
    if (window.WM) { window.__famOpen = opts || null; WM.open("family"); }
  }
  window.AppRegistry = window.AppRegistry || {};
  AppRegistry.family = function () {
    const ref = WM.createWindow({ title: "Family Safety", icon: icon(), width: 1000, height: 660, appId: "family" });
    const body = ref.body; body.classList.add("fam-host");
    const init = window.__famOpen || {}; window.__famOpen = null;
    const ui = { view: init.view || null, child: init.child || null, tab: "activity", day: dayKey(), draft: null, editing: false, appQ: "" };
    body.innerHTML = `<div class="fam"><aside class="fam-side"></aside><main class="fam-main"></main></div>`;
    const side = body.querySelector(".fam-side"), main = body.querySelector(".fam-main");
    const childMode = () => isChild(MID);
    function pickDefault() {
      const kids = children();
      if (childMode()) { if (!ui.view) ui.view = "me"; return; }
      if (!ui.view) ui.view = kids.length ? "child" : "add";
      if (ui.view === "child" && !kids.some((u) => u.id === ui.child)) { ui.child = kids[0] ? kids[0].id : null; if (!ui.child) ui.view = "add"; }
    }
    function paintSide() {
      const kids = children();
      const pend = readAct().requests.filter((r) => r.status === "pending" && isChild(r.child)).length;
      side.innerHTML = `<div class="fam-brand">${icon()}<div><b>Family Safety</b><span>${esc(childMode() ? "Your account" : me().type === "admin" ? "Organizer" : "Family")}</span></div></div>
        <nav class="fam-nav" aria-label="Family"></nav>`;
      const nav = side.querySelector(".fam-nav");
      const item = (view, child, html, label) => {
        const b = el(`<button type="button" class="fam-nav-it${ui.view === view && (child == null || ui.child === child) ? " on" : ""}">${html}</button>`);
        b.setAttribute("aria-label", label);
        b.onclick = () => { ui.view = view; if (child != null) { ui.child = child; ui.tab = "activity"; ui.day = dayKey(); } ui.draft = null; ui.editing = false; paint(); };
        nav.appendChild(b);
      };
      if (childMode()) item("me", null, `${avatar(me(), 30)}<span class="fam-nav-tx"><b>${esc(me().name)}</b><small data-live="me">${esc(todayLine(MID))}</small></span>`, "My screen time");
      kids.filter((u) => !childMode() || u.id !== MID).forEach((u) => item("child", u.id, `${avatar(u, 30)}<span class="fam-nav-tx"><b>${esc(u.name)}</b><small data-live="kid" data-id="${u.id}">${esc(todayLine(u.id))}</small></span>`, u.name));
      if (!childMode()) item("add", null, `<span class="fam-nav-ic">+</span><span class="fam-nav-tx"><b>Add a family member</b></span>`, "Add a family member");
      item("requests", null, `<span class="fam-nav-ic">${svgI("bell")}</span><span class="fam-nav-tx"><b>Requests</b></span>${pend ? `<span class="fam-badge">${pend}</span>` : ""}`, "Requests");
      item("about", null, `<span class="fam-nav-ic">${svgI("info")}</span><span class="fam-nav-tx"><b>About & help</b></span>`, "About and help");
    }
    function paint() {
      pickDefault(); paintSide();
      main.innerHTML = ""; main.scrollTop = 0;
      if (ui.view === "me") viewMe();
      else if (ui.view === "child") viewChild();
      else if (ui.view === "add") viewAdd();
      else if (ui.view === "requests") viewRequests();
      else viewAbout();
    }
    const h1 = (t, sub) => el(`<header class="fam-head"><h1>${esc(t)}</h1>${sub ? `<p>${esc(sub)}</p>` : ""}</header>`);

    // ---- child's own view
    function viewMe() {
      const st = screenStatus(MID), u = usageOf(readAct(), MID);
      main.appendChild(h1("Hi, " + me().name, "Here's your screen time today. Your family manages these settings."));
      const tiles = el(`<div class="fam-tiles">
        <div class="fam-tile"><span>Used today</span><b data-live="used">${esc(fmtDur(u.t))}</b></div>
        <div class="fam-tile"><span>Time left</span><b data-live="left">${esc(!st.limited ? "No limit" : st.until ? "Until " + fmtClock(st.until) : fmtDur(st.left))}</b></div>
        <div class="fam-tile"><span>Allowed today</span><b>${esc(!st.limited || (st.from <= 0 && st.to >= 1440) ? "All day" : fmtClock(hmOf(st.from)) + " – " + fmtClock(hmOf(st.to)))}</b></div></div>`);
      main.appendChild(tiles);
      const actions = el(`<div class="fam-row-btns"><button type="button" class="fam-btn fam-btn-primary">Ask for more time</button><button type="button" class="fam-btn" data-a="parent">Change settings (parent)</button></div>`);
      actions.firstElementChild.onclick = () => askDialog("time", "", st.limited ? "You have " + fmtDur(st.left) + " left today." : "").then(() => paint());
      actions.querySelector('[data-a="parent"]').onclick = () => { ui.view = "child"; ui.child = MID; ui.tab = "screen"; paint(); };
      main.appendChild(actions);
      main.appendChild(weekChart(MID, ui.day, (d) => { ui.day = d; paint(); }));
      main.appendChild(appsTable(MID, ui.day));
      const p = readPolicy(), m = p.members[MID] || {};
      const lim = Object.keys(m.apps || {}).filter((k) => m.apps[k].block || m.apps[k].limit > 0);
      const sec = el(`<section class="fam-sec"><h2>Your limits</h2><div class="fam-list"></div></section>`);
      const list = sec.querySelector(".fam-list");
      DAY_ORDER.forEach((i) => { const d = ((m.screen || {}).days || [])[i] || {}; list.appendChild(el(`<div class="fam-li"><span class="fam-li-t">${esc(DAY_NAMES[i])}</span><span class="fam-li-s">${esc(m.screen && m.screen.on ? fmtMins(d.limit) + " · " + fmtClock(d.from) + " – " + fmtClock(d.to) : "No schedule")}</span></div>`)); });
      lim.forEach((k) => list.appendChild(el(`<div class="fam-li"><span class="fam-li-ic">${appIcon(k)}</span><span class="fam-li-t">${esc(nameOf(k))}</span><span class="fam-li-s">${esc(m.apps[k].block ? "Blocked" : fmtDur(m.apps[k].limit * 60) + " a day")}</span></div>`)));
      main.appendChild(sec);
      main.appendChild(myRequests());
    }
    function myRequests() {
      const rs = readAct().requests.filter((r) => r.child === MID).slice(-8).reverse();
      const sec = el(`<section class="fam-sec"><h2>Your requests</h2><div class="fam-list"></div></section>`);
      const list = sec.querySelector(".fam-list");
      if (!rs.length) list.appendChild(el(`<div class="fam-empty">No requests yet.</div>`));
      rs.forEach((r) => list.appendChild(el(`<div class="fam-li"><span class="fam-li-t">Asked ${esc(kindLabel(r))}</span><span class="fam-pill fam-pill-${r.status}">${esc(r.status === "pending" ? "Waiting" : r.status === "approved" ? "Approved" : "Declined")}</span><span class="fam-li-s">${esc(new Date(r.at).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" }))}</span></div>`)));
      return sec;
    }

    // ---- organizer view of one child
    function viewChild() {
      const u = A.get(ui.child); if (!u) { ui.view = "add"; paint(); return; }
      const p = readPolicy(), m = p.members[u.id];
      const head = el(`<header class="fam-head fam-head-kid">${avatar(u, 52)}<div><h1></h1><p data-live="kid" data-id="${u.id}">${esc(todayLine(u.id))}</p></div></header>`);
      head.querySelector("h1").textContent = u.name;
      main.appendChild(head);
      if (childMode() && u.id === MID) main.appendChild(el(`<div class="fam-note">These are your settings. Changes need a parent's PIN or password.</div>`));
      const tabs = el(`<div class="fam-tabs" role="tablist"></div>`);
      [["activity", "Activity"], ["screen", "Screen time"], ["apps", "Apps & games"], ["web", "Content filters"]].forEach(([k, t]) => {
        const b = el(`<button type="button" role="tab" class="fam-tab${ui.tab === k ? " on" : ""}" aria-selected="${ui.tab === k}">${t}</button>`);
        b.onclick = () => { if (ui.draft && !confirmDiscard()) return; ui.tab = k; ui.draft = null; paint(); };
        tabs.appendChild(b);
      });
      main.appendChild(tabs);
      const pane = el(`<div class="fam-pane" role="tabpanel"></div>`); main.appendChild(pane);
      if (ui.tab === "activity") paneActivity(pane, u);
      else if (ui.tab === "screen") paneScreen(pane, u, m);
      else if (ui.tab === "apps") paneApps(pane, u, m);
      else paneWeb(pane, u, m);
    }
    const confirmDiscard = () => {
      const cur = readPolicy().members[ui.child];
      if (!ui.draft || JSON.stringify(ui.draft) === JSON.stringify(cur)) return true;
      return window.confirm("Discard your unsaved changes?");
    };
    function paneActivity(pane, u) {
      const st = screenStatus(u.id), today = usageOf(readAct(), u.id);
      pane.appendChild(el(`<div class="fam-tiles">
        <div class="fam-tile"><span>Screen time today</span><b data-live="used" data-id="${u.id}">${esc(fmtDur(today.t))}</b></div>
        <div class="fam-tile"><span>Left today</span><b data-live="left" data-id="${u.id}">${esc(!st.limited ? "No limit" : st.left <= 0 ? (st.reason === "early" ? "From " + fmtClock(hmOf(st.from)) : "Time's up") : st.until ? "Until " + fmtClock(st.until) : fmtDur(st.left))}</b></div>
        <div class="fam-tile"><span>Requests waiting</span><b>${readAct().requests.filter((r) => r.child === u.id && r.status === "pending").length}</b></div></div>`));
      pane.appendChild(weekChart(u.id, ui.day, (d) => { ui.day = d; paint(); }));
      pane.appendChild(appsTable(u.id, ui.day));
      const btns = el(`<div class="fam-row-btns"><button type="button" class="fam-btn" data-a="more">Give more time today</button><button type="button" class="fam-btn" data-a="ev">Open Event Viewer</button></div>`);
      btns.querySelector('[data-a="more"]').onclick = () => grantDialog(u, "time", "");
      btns.querySelector('[data-a="ev"]').onclick = () => WM.open("eventvwr");
      if (u.id === MID) btns.querySelector('[data-a="ev"]').remove();
      pane.appendChild(btns);
    }
    function appsTable(id, d) {
      const rows = topApps(id, d).slice(0, 8);
      const label = d === dayKey() ? "today" : new Date(d + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
      const sec = el(`<section class="fam-sec"><h2>Top apps & games — ${esc(label)}</h2><div class="fam-apps"></div></section>`);
      const box = sec.querySelector(".fam-apps");
      if (!rows.length) { box.appendChild(el(`<div class="fam-empty">No activity ${esc(d === dayKey() ? "yet today" : "on this day")}.</div>`)); return sec; }
      const max = Math.max(60, ...rows.map((r) => r.t));
      rows.forEach((r) => box.appendChild(el(`<div class="fam-app-row"><span class="fam-li-ic">${appIcon(r.k)}</span><span class="fam-app-n">${esc(nameOf(r.k))}</span><span class="fam-app-bar"><i style="width:${(r.t / max * 100).toFixed(1)}%"></i></span><span class="fam-app-v">${esc(fmtDur(r.t))}</span><span class="fam-app-o">${r.n ? r.n + (r.n === 1 ? " open" : " opens") : ""}</span></div>`)));
      return sec;
    }
    function draftOf(m) { if (!ui.draft) ui.draft = JSON.parse(JSON.stringify(m || defaultMember())); return ui.draft; }
    function saveBar(pane, u, what, apply) {
      const bar = el(`<div class="fam-savebar"><span class="fam-dim">Saving asks for ${me().type === "admin" ? "administrator approval" : "a parent's PIN or password"}.</span><button type="button" class="fam-btn" data-a="undo">Discard</button><button type="button" class="fam-btn fam-btn-primary" data-a="save">Save changes</button></div>`);
      bar.querySelector('[data-a="undo"]').onclick = () => { ui.draft = null; paint(); };
      bar.querySelector('[data-a="save"]').onclick = async () => {
        const d = ui.draft; if (!d) { paint(); return; }
        const ok = await commitPolicy(what + " for " + u.name, (p) => { if (p.members[u.id]) apply(p.members[u.id], d); });
        if (ok) { ui.draft = null; toast("Saved", what + " for " + u.name + " updated."); paint(); }
      };
      pane.appendChild(bar);
    }
    const LIMITS = [[null, "No limit"], [0, "No screen time"], [15, "15 min"], [30, "30 min"], [45, "45 min"], [60, "1 h"], [90, "1 h 30 min"], [120, "2 h"], [150, "2 h 30 min"], [180, "3 h"], [240, "4 h"], [300, "5 h"], [360, "6 h"], [480, "8 h"], [600, "10 h"], [720, "12 h"]];
    function limitSelect(val, onCh, label) {
      const opts = LIMITS.slice(); if (val != null && !opts.some((o) => o[0] === val)) opts.push([val, fmtDur(val * 60)]);
      const s = el(`<select class="fam-in" aria-label="${esc(label)}">${opts.map(([v, l]) => `<option value="${v == null ? "" : v}"${v === val ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>`);
      s.onchange = () => onCh(s.value === "" ? null : +s.value);
      return s;
    }
    function paneScreen(pane, u, m) {
      const d = draftOf(m);
      const top = el(`<div class="fam-card fam-switch-row"><div><b>Use one screen time schedule</b><p class="fam-dim">Applies whenever ${esc(u.name)} is signed in to this PC. Time counts while the Windows 12 page is open, visible and not locked.</p></div><label class="fam-toggle"><input type="checkbox"${d.screen.on ? " checked" : ""} aria-label="Screen time schedule"><i></i></label></div>`);
      top.querySelector("input").onchange = (e) => { d.screen.on = e.target.checked; paint(); };
      pane.appendChild(top);
      const tbl = el(`<div class="fam-card fam-sched${d.screen.on ? "" : " fam-off"}"><div class="fam-sched-h"><span>Day</span><span>Daily allowance</span><span>Allowed from</span><span>Until</span></div></div>`);
      DAY_ORDER.forEach((i) => {
        const day = d.screen.days[i];
        const row = el(`<div class="fam-sched-r"><span class="fam-sched-d">${esc(DAY_NAMES[i])}</span><span class="fam-c-lim"></span><input type="time" class="fam-in" value="${esc(day.from)}" aria-label="${esc(DAY_NAMES[i])} from"><input type="time" class="fam-in" value="${esc(day.to === "24:00" ? "23:59" : day.to)}" aria-label="${esc(DAY_NAMES[i])} until"></div>`);
        row.querySelector(".fam-c-lim").appendChild(limitSelect(day.limit, (v) => { day.limit = v; }, DAY_NAMES[i] + " allowance"));
        const [f, t] = row.querySelectorAll('input[type="time"]');
        f.onchange = () => { if (minsOf(f.value) != null) day.from = f.value; };
        t.onchange = () => { if (minsOf(t.value) != null) day.to = t.value === "23:59" ? "24:00" : t.value; };
        if (!d.screen.on) row.querySelectorAll("select,input").forEach((x) => (x.disabled = true));
        tbl.appendChild(row);
      });
      const same = el(`<div class="fam-sched-foot"><button type="button" class="fam-btn fam-btn-sm">Copy Monday to every day</button></div>`);
      same.firstElementChild.onclick = () => { const mo = d.screen.days[1]; d.screen.days = d.screen.days.map(() => Object.assign({}, mo)); paint(); };
      tbl.appendChild(same);
      pane.appendChild(tbl);
      saveBar(pane, u, "Screen time", (mm, dd) => { mm.screen = dd.screen; });
    }
    function paneApps(pane, u, m) {
      const d = draftOf(m); d.apps = d.apps || {};
      const usage = usageOf(readAct(), u.id).apps || {};
      pane.appendChild(el(`<p class="fam-dim fam-pad">Set a daily time limit or block an app or game. Blocked apps can't start from Start, the desktop, the taskbar, Search, Xbox or Terminal.</p>`));
      const search = el(`<label class="fam-search">${svgI("search")}<input class="fam-in" placeholder="Search apps and games" value="${esc(ui.appQ)}" data-no-eye></label>`);
      pane.appendChild(search);
      const list = el(`<div class="fam-card fam-applist"></div>`); pane.appendChild(list);
      const OPTS = [["ok", "Allowed"], ["15", "15 min a day"], ["30", "30 min a day"], ["60", "1 h a day"], ["90", "1 h 30 min a day"], ["120", "2 h a day"], ["180", "3 h a day"], ["block", "Blocked"]];
      function render() {
        const q = ui.appQ.trim().toLowerCase();
        const all = appChoices().filter((a) => !q || a.name.toLowerCase().includes(q));
        all.sort((x, y) => (d.apps[y.key] ? 1 : 0) - (d.apps[x.key] ? 1 : 0) || (usage[y.key] || 0) - (usage[x.key] || 0) || x.name.localeCompare(y.name));
        list.innerHTML = "";
        all.slice(0, q ? 80 : 40).forEach((a) => {
          const r = d.apps[a.key]; const v = !r ? "ok" : r.block ? "block" : String(r.limit);
          const opts = OPTS.slice(); if (!opts.some((o) => o[0] === v)) opts.splice(opts.length - 1, 0, [v, fmtDur(+v * 60) + " a day"]);
          const row = el(`<div class="fam-app-li"><span class="fam-li-ic">${appIcon(a.key)}</span><span class="fam-app-n"><b></b><small>${esc((a.game ? "Game" : "App") + (usage[a.key] ? " · " + fmtDur(usage[a.key]) + " today" : ""))}</small></span><select class="fam-in" aria-label="${esc(a.name)} limit">${opts.map(([x, l]) => `<option value="${x}"${x === v ? " selected" : ""}>${esc(l)}</option>`).join("")}</select></div>`);
          row.querySelector("b").textContent = a.name;
          row.querySelector("select").onchange = (e) => { const x = e.target.value; if (x === "ok") delete d.apps[a.key]; else if (x === "block") d.apps[a.key] = { block: true, limit: 0 }; else d.apps[a.key] = { block: false, limit: +x }; row.classList.toggle("fam-changed", true); };
          list.appendChild(row);
        });
        if (!all.length) list.appendChild(el(`<div class="fam-empty">No apps match “${esc(ui.appQ)}”.</div>`));
      }
      search.querySelector("input").oninput = (e) => { ui.appQ = e.target.value; render(); };
      render();
      saveBar(pane, u, "App and game limits", (mm, dd) => { mm.apps = dd.apps; });
    }
    function paneWeb(pane, u, m) {
      const d = draftOf(m); d.web = d.web || { mode: "block", block: [], allow: [] }; d.web.block = d.web.block || []; d.web.allow = d.web.allow || [];
      pane.appendChild(el(`<div class="fam-card fam-switch-row"><div><b>SafeSearch</b><p class="fam-dim">Always on for ${esc(u.name)}: adult websites and searches are blocked in Edge and Chrome, and it can't be turned off from their account.</p></div><span class="fam-pill fam-pill-approved">On · locked</span></div>`));
      const mode = el(`<div class="fam-card"><b>Websites</b>
        <label class="fam-radio"><input type="radio" name="fam-wm-${u.id}" value="block"${d.web.mode !== "allow" ? " checked" : ""}> <span><b>Block these sites</b><small>Everything else is allowed.</small></span></label>
        <label class="fam-radio"><input type="radio" name="fam-wm-${u.id}" value="allow"${d.web.mode === "allow" ? " checked" : ""}> <span><b>Only allow these sites</b><small>Every other website is blocked (search inside Edge still works).</small></span></label></div>`);
      mode.querySelectorAll("input").forEach((r) => (r.onchange = () => { if (r.checked) { d.web.mode = r.value; paint(); } }));
      pane.appendChild(mode);
      const which = d.web.mode === "allow" ? "allow" : "block";
      const box = el(`<div class="fam-card"><b>${which === "allow" ? "Allowed sites" : "Blocked sites"}</b>
        <form class="fam-addsite"><input class="fam-in" placeholder="example.com" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Website"><button type="submit" class="fam-btn">Add</button></form>
        <div class="fam-chips"></div><p class="fam-err" role="alert"></p></div>`);
      const chips = box.querySelector(".fam-chips");
      const paintChips = () => {
        chips.innerHTML = "";
        if (!d.web[which].length) chips.appendChild(el(`<span class="fam-dim">${which === "allow" ? "No sites yet — every website is blocked." : "No sites blocked yet."}</span>`));
        d.web[which].forEach((h, i) => { const c = el(`<span class="fam-chip"><span></span><button type="button" aria-label="Remove">×</button></span>`); c.firstElementChild.textContent = h; c.querySelector("button").onclick = () => { d.web[which].splice(i, 1); paintChips(); }; chips.appendChild(c); });
      };
      box.querySelector("form").onsubmit = (e) => {
        e.preventDefault(); const inp = box.querySelector("input"), h = normHost(inp.value), err = box.querySelector(".fam-err");
        if (!h || (h.indexOf(".") < 0 && h.length < 3)) { err.textContent = "Type a website address, like example.com."; return; }
        err.textContent = "";
        if (!d.web[which].includes(h)) d.web[which].push(h);
        inp.value = ""; paintChips();
      };
      paintChips();
      pane.appendChild(box);
      pane.appendChild(el(`<p class="fam-dim fam-pad">Filters apply to the Edge and Chrome windows inside this Windows 12 simulation only — not to Safari or other apps on the real device.</p>`));
      saveBar(pane, u, "Content filters", (mm, dd) => { mm.web = dd.web; });
    }
    function grantDialog(u, kind, target) {
      A.modal({ title: "Give " + u.name + " more time", html: `<div class="fam-ask"><label class="fam-field"><span>Allow</span><select class="fam-in fam-g-sel">${choicesFor(kind).map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join("")}</select></label><p class="fam-dim">Only for today.</p></div>`,
        buttons: [{ label: "Give time", primary: true, onClick: async (api) => {
          const v = api.content.querySelector(".fam-g-sel").value; let text = "";
          const ok = await commitPolicy("give " + u.name + " more time", (p) => { text = applyGrant(p, u.id, kind, target, v); });
          if (!ok) { api.error("An administrator has to approve this."); return false; }
          settleRequests(u.id, kind, target, "approved", me().name, text);
          toast("Done", u.name + " got " + text + "."); paint(); return true;
        } }, { label: "Cancel", value: null }] });
    }

    // ---- add / remove members
    function viewAdd() {
      main.appendChild(h1("Your family", "Add people who sign in to this PC with their own local account. Children get screen time, app and website limits."));
      const p = readPolicy(), users = A.list();
      const meU = me();
      if (meU.type === "admin" && !A.needsSecret(MID)) main.appendChild(el(`<div class="fam-note fam-note-warn"><b>Set a PIN or password for your account.</b> Without one, anyone could approve requests as you. Settings ▸ Accounts ▸ Sign-in options.</div>`));
      const list = el(`<div class="fam-card fam-members"></div>`);
      users.forEach((u) => {
        const child = !!p.members[u.id] && u.type === "standard";
        const row = el(`<div class="fam-mem">${avatar(u, 40)}<div class="fam-mem-tx"><b></b><small>${esc(u.type === "admin" ? "Organizer · Administrator" : child ? "Child · Standard user" : "Standard user · not in your family")}${u.id === MID ? " · you" : ""}</small></div><div class="fam-mem-act"></div></div>`);
        row.querySelector("b").textContent = u.name;
        const act = row.querySelector(".fam-mem-act");
        if (u.type === "admin") act.appendChild(el(`<span class="fam-dim">Can manage settings</span>`));
        else if (child) {
          const b = el(`<button type="button" class="fam-btn">Remove from family</button>`);
          b.onclick = async () => { if (await commitPolicy("remove " + u.name + " from the family", (pp) => { delete pp.members[u.id]; delete pp.grants[u.id]; })) { toast("Family Safety", u.name + " is no longer a child member. Their limits were removed."); paint(); } };
          act.appendChild(b);
        } else if (!childMode()) {
          const b = el(`<button type="button" class="fam-btn fam-btn-primary">Add as child</button>`);
          b.onclick = async () => {
            if (await commitPolicy("add " + u.name + " as a child", (pp) => { pp.members[u.id] = defaultMember(); })) {
              log("Information", 4107, u.name + " was added to the family as a child by " + me().name + ".");
              toast("Family Safety", u.name + " is now a child member. Default limits: 2 h on school days, 3 h on weekends.");
              ui.view = "child"; ui.child = u.id; ui.tab = "screen"; paint();
            }
          };
          act.appendChild(b);
        }
        list.appendChild(row);
      });
      main.appendChild(list);
      const add = el(`<div class="fam-card fam-switch-row"><div><b>Need an account for someone new?</b><p class="fam-dim">Create a standard user in Settings ▸ Accounts ▸ Other users (or <code>net user NAME PIN /add</code> in Terminal), then add them here.</p></div><button type="button" class="fam-btn">Other users</button></div>`);
      add.querySelector("button").onclick = () => { window.SettingsStartPage = "otherusers"; WM.open("settings"); };
      main.appendChild(add);
    }

    // ---- requests
    function viewRequests() {
      main.appendChild(h1("Requests", childMode() ? "What you've asked for and what your parents said." : "Your children's requests for more time, apps and websites."));
      if (childMode()) { main.appendChild(myRequests()); return; }
      const all = readAct().requests.filter((r) => isChild(r.child));
      const pend = all.filter((r) => r.status === "pending").reverse(), done = all.filter((r) => r.status !== "pending").slice(-10).reverse();
      const sec = el(`<section class="fam-sec"><h2>Waiting (${pend.length})</h2><div class="fam-list"></div></section>`);
      const list = sec.querySelector(".fam-list");
      if (!pend.length) list.appendChild(el(`<div class="fam-empty">No requests right now.</div>`));
      pend.forEach((r) => {
        const u = A.get(r.child) || { id: r.child, name: r.childName };
        const row = el(`<div class="fam-req">${avatar(u, 36)}<div class="fam-req-tx"><b></b><small>${esc(new Date(r.at).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }))}</small></div>
          <select class="fam-in" aria-label="What to allow">${choicesFor(r.kind).map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join("")}</select>
          <button type="button" class="fam-btn fam-btn-primary" data-a="ok">Approve</button><button type="button" class="fam-btn" data-a="no">Decline</button></div>`);
        row.querySelector("b").textContent = u.name + " asked " + kindLabel(r);
        row.querySelector('[data-a="ok"]').onclick = async () => {
          let text = ""; const v = row.querySelector("select").value;
          if (await commitPolicy("approve a request from " + u.name, (p) => { text = applyGrant(p, r.child, r.kind, r.target, v); })) { settleRequests(r.child, r.kind, r.target, "approved", me().name, text); log("Information", 4103, me().name + " approved " + text + " for " + u.name + "."); toast("Approved", u.name + " got " + text + "."); paint(); }
        };
        row.querySelector('[data-a="no"]').onclick = () => { settleRequests(r.child, r.kind, r.target, "declined", me().name); log("Information", 4108, me().name + " declined a request from " + u.name + " (" + kindLabel(r) + ")."); paint(); };
        list.appendChild(row);
      });
      main.appendChild(sec);
      const hist = el(`<section class="fam-sec"><h2>Earlier</h2><div class="fam-list"></div></section>`);
      if (!done.length) hist.querySelector(".fam-list").appendChild(el(`<div class="fam-empty">Nothing yet.</div>`));
      done.forEach((r) => hist.querySelector(".fam-list").appendChild(el(`<div class="fam-li"><span class="fam-li-t">${esc((r.childName || "") + " asked " + kindLabel(r))}</span><span class="fam-pill fam-pill-${r.status}">${esc(r.status === "approved" ? "Approved" + (r.grant ? ": " + r.grant : "") : "Declined")}</span><span class="fam-li-s">${esc(r.by || "")}</span></div>`)));
      main.appendChild(hist);
    }

    // ---- about
    function viewAbout() {
      main.appendChild(h1("About Family Safety", "Screen time, app limits and content filters for this Windows 12 simulation."));
      main.appendChild(el(`<div class="fam-card fam-about">
        <h2>What this controls</h2>
        <p><b>Only this Windows 12 simulation.</b> Family Safety limits what a child can do while they're signed in to Windows 12 on this device: how long they use it, which apps and games inside Windows 12 they can open, and which websites the Edge and Chrome windows inside Windows 12 can show.</p>
        <h2>What it can't do</h2>
        <ul><li>It can't limit or see the real iPad, its apps, Safari, or other websites and tabs.</li>
        <li>It doesn't track location, read messages or send anything off this device. Everything stays in this browser's storage.</li>
        <li>For limits on the device itself, use the device's own parental controls (on iPad: Settings ▸ Screen Time).</li></ul>
        <h2>How time is counted</h2>
        <p>Screen time is real time: it counts while a child is signed in, this page is open and visible, and the PC isn't locked, asleep or showing the screen saver. Time per app counts the app in front.</p>
        <h2>Who can change settings</h2>
        <p>Only an administrator (organizer). Children see their limits but can't change them: every change, and every “more time” approval on a child's account, needs an administrator's PIN or password. Requests a child sends show up here and in the parent's notifications the next time they sign in.</p>
        <p class="fam-dim">Event Viewer ▸ Application (source “Microsoft Family Safety”) records limit changes, blocked apps and sites, requests and approvals.</p></div>`));
    }

    // live numbers without repainting forms
    const live = () => {
      if (!body.isConnected) { off(); return; }
      body.querySelectorAll("[data-live]").forEach((n) => {
        const k = n.dataset.live, id = n.dataset.id ? +n.dataset.id : MID;
        if (k === "kid" || k === "me") n.textContent = todayLine(id);
        else if (k === "used") n.textContent = fmtDur(usageOf(readAct(), id).t);
        else if (k === "left") { const st = screenStatus(id); n.textContent = !st.limited ? "No limit" : st.left <= 0 ? (st.reason === "early" ? "From " + fmtClock(hmOf(st.from)) : "Time's up") : st.until ? "Until " + fmtClock(st.until) : fmtDur(st.left); }
      });
    };
    const off = onChange(() => { if (!body.isConnected) { off(); return; } if (!ui.draft && !body.contains(document.activeElement)) paint(); else live(); });
    const iv = setInterval(() => { if (!body.isConnected) { clearInterval(iv); off(); return; } live(); }, 5000);
    paint();
    return ref;
  };
  function svgI(n) {
    const P = { bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>', search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>' };
    return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ""}</svg>`;
  }

  // ------------------------------------------------------------------ Start / Store entry
  try {
    if (window.Catalog && !Catalog.storeApps.find((a) => a.id === "family")) Catalog.storeApps.push({ id: "family", name: "Family Safety", cat: "Utilities", price: 0, builtin: "family", desc: "Screen time, app & game limits and website filters for children's accounts on this Windows 12 PC." });
    const ex = (window.EXTRA_DEFAULT_APPS = window.EXTRA_DEFAULT_APPS || []); if (ex.indexOf("family") < 0) ex.push("family");
  } catch (_) {}

  // ------------------------------------------------------------------ Settings ▸ Accounts ▸ Family
  function buildSettings(h) {
    const kids = children(), child = isChild(MID);
    const intro = el(`<div class="w12s-card fam-s-intro"><span class="fam-s-ic">${icon()}</span><div><div class="w12s-row-t">Microsoft Family Safety</div><div class="w12s-row-s">${child ? "Your account is part of a family. A parent manages your screen time, apps and websites." : "Set screen time, app and game limits and website filters for children who use this PC."}</div></div><button type="button" class="w12s-btn w12s-btn-accent">Open Family Safety</button></div>`);
    intro.querySelector("button").onclick = () => openApp(child ? { view: "me" } : null);
    h.appendChild(intro);
    if (child) {
      h.appendChild(el(`<div class="w12s-card"><div class="w12s-row-t">Today</div><div class="w12s-row-s">${esc(todayLine(MID))}</div></div>`));
    } else {
      h.appendChild(el(`<div class="fam-s-h">Your family</div>`));
      if (!kids.length) h.appendChild(el(`<div class="w12s-card"><div class="w12s-row-s">No child members yet. Add a standard user from Other users, then add them in Family Safety.</div></div>`));
      kids.forEach((u) => {
        const c = el(`<div class="w12s-card fam-s-kid">${avatar(u, 40)}<div><div class="w12s-row-t"></div><div class="w12s-row-s">Child · ${esc(todayLine(u.id))}</div></div><button type="button" class="w12s-btn">Manage</button></div>`);
        c.querySelector(".w12s-row-t").textContent = u.name;
        c.querySelector("button").onclick = () => openApp({ view: "child", child: u.id });
        h.appendChild(c);
      });
      const add = el(`<div class="w12s-card fam-s-kid"><div><div class="w12s-row-t">Add a family member</div><div class="w12s-row-s">${me().type === "admin" ? "Mark a standard user on this PC as a child." : "An administrator will need to approve this."}</div></div><button type="button" class="w12s-btn">Add</button></div>`);
      add.querySelector("button").onclick = () => openApp({ view: "add" });
      h.appendChild(add);
      const pend = readAct().requests.filter((r) => r.status === "pending" && isChild(r.child)).length;
      if (pend) { const r = el(`<div class="w12s-card fam-s-kid"><div><div class="w12s-row-t">${pend} request${pend === 1 ? "" : "s"} waiting</div><div class="w12s-row-s">More time, apps or websites</div></div><button type="button" class="w12s-btn w12s-btn-accent">Review</button></div>`); r.querySelector("button").onclick = () => openApp({ view: "requests" }); h.appendChild(r); }
    }
    h.appendChild(el(`<div class="w12s-card"><div class="w12s-row-s">Family Safety works inside this Windows 12 simulation only. It can't limit the real device — use the device's own parental controls for that.</div></div>`));
  }
  window.SettingsSubs = window.SettingsSubs || {};
  if (!Object.prototype.hasOwnProperty.call(window.SettingsSubs, "family")) window.SettingsSubs.family = { title: "Family", parent: "accounts", build: buildSettings };

  // The built-in Accounts page lists "Family" as a static row; make it open the page above.
  function renderSub(page) {
    const root = page.closest(".w12s"); if (!root) return;
    root.querySelectorAll(".w12s-nav-it").forEach((a) => a.classList.toggle("on", a.dataset.p === "accounts"));
    const pa = root.querySelector('.w12s-nav-it[data-p="accounts"]');
    page.innerHTML = ""; page.scrollTop = 0;
    const head = el(`<h1 class="w12s-title"><a class="w12s-crumb"></a><span class="w12s-crumb-sep">›</span><span>Family</span></h1>`);
    head.querySelector(".w12s-crumb").textContent = pa ? (pa.lastElementChild || pa).textContent.trim() : "Accounts";
    head.querySelector(".w12s-crumb").onclick = () => { if (pa) pa.click(); };
    page.appendChild(head);
    const box = el(`<div class="w12s-list" data-fam-page="family"></div>`); page.appendChild(box);
    buildSettings(box);
  }
  function enhance(page) {
    const root = page.closest(".w12s"); if (!root) return;
    const on = root.querySelector(".w12s-nav-it.on");
    const h1e = page.querySelector("h1.w12s-title");
    if (!on || on.dataset.p !== "accounts" || !h1e || h1e.querySelector(".w12s-crumb")) return;
    const rows = [...page.querySelectorAll(".w12s-list > .w12s-row")];
    const r = rows.find((x) => /^(Family|Familj)$/i.test(((x.querySelector(".w12s-row-t") || {}).textContent || "").trim()));
    if (!r || r.__fam) return; r.__fam = true;
    r.classList.remove("w12s-row-static"); r.classList.add("w12s-click"); r.tabIndex = 0;
    const s = r.querySelector(".w12s-row-s"); if (s) s.textContent = "Screen time, app limits and website filters for your family";
    if (!r.querySelector(".w12s-chev")) r.appendChild(el(`<span class="w12s-chev"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 6l6 6-6 6"/></svg></span>`));
    r.onclick = () => renderSub(page);
    r.addEventListener("keydown", (e) => { if (e.key === "Enter") renderSub(page); });
  }
  function hookSettingsWin(win) {
    const page = win.querySelector && win.querySelector(".w12s-page");
    if (!page || page.__fam) return; page.__fam = true;
    new MutationObserver(() => enhance(page)).observe(page, { childList: true });
    enhance(page);
  }
  function watchSettings() {
    const scr = document.getElementById("screen"); if (!scr) return;
    new MutationObserver((muts) => { for (const m of muts) for (const n of m.addedNodes) if (n && n.nodeType === 1 && n.classList.contains("win")) hookSettingsWin(n); }).observe(scr, { childList: true });
    scr.querySelectorAll(".win").forEach(hookSettingsWin);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", watchSettings); else watchSettings();

  window.Family = {
    isChild, screenStatus, appStatus: (id, key) => appStatus(id, key), siteStatus, children: () => children().map((u) => ({ id: u.id, name: u.name })),
    policy: () => JSON.parse(JSON.stringify(readPolicy())), activity: () => JSON.parse(JSON.stringify(readAct())),
    open: openApp, ask: (kind, target) => askDialog(kind, target || ""), version: 1,
    POLICY_KEY, ACT_KEY,
  };
})();
