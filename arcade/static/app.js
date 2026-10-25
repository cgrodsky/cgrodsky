/* ============================================================
   Arcade Card Manager — front-end logic
     • Backend mode  — Python/Flask server (real RFID, shared DB, live taps).
     • Local mode    — localStorage only, so the UI works when hosted statically.
   The card only carries an ID; all balances live in the store (cloud/local).
   ============================================================ */
(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const svgUse = (name) => `<svg class="ico"><use href="#i-${name}"/></svg>`;
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const isExpired = (c) => !!(c && c.expires && todayISO() > c.expires);
  const cardBlocked = (c) => c && (c.status === "frozen" || c.status === "lost" || isExpired(c));

  // ---------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------
  const SETTINGS_KEY = "arcade.settings";
  const settings = Object.assign(
    { backendUrl: "", rfidMode: "backend", mode: "simple", exchangeRate: 1,
      theme: "dark", accent: "#4f6bed", sound: false, autolockSec: 0, nfcWrite: false,
      receiptWidth: "80", receiptName: "ARCADE", autoPrint: false, operator: "",
      stationName: "Ring Toss", stationCost: 1, stationReward: 0 },
    JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}")
  );
  if (settings.backendUrl === "" && location.protocol.startsWith("http")) {
    settings.backendUrl = location.origin;
  }
  const saveSettings = () => localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

  // ---------------------------------------------------------------
  // Store abstraction
  // ---------------------------------------------------------------
  class BackendStore {
    constructor(base) { this.base = base.replace(/\/$/, ""); this.name = "backend"; }
    async _req(path, opts) {
      const headers = { "Content-Type": "application/json" };
      if (settings.operator) headers["X-Operator"] = settings.operator;
      const res = await fetch(this.base + path, { headers, ...opts });
      if (!res.ok) {
        let msg = "request_failed";
        try { msg = (await res.json()).error || msg; } catch (_) {}
        throw new Error(msg);
      }
      return res.status === 204 ? null : res.json();
    }
    health() { return this._req("/api/health"); }
    listCards() { return this._req("/api/cards"); }
    getCard(uid) { return this._req(`/api/cards/${encodeURIComponent(uid)}`); }
    createCard(c) { return this._req("/api/cards", { method: "POST", body: JSON.stringify(c) }); }
    updateCard(uid, patch) { return this._req(`/api/cards/${encodeURIComponent(uid)}`, { method: "PATCH", body: JSON.stringify(patch) }); }
    deleteCard(uid) { return this._req(`/api/cards/${encodeURIComponent(uid)}`, { method: "DELETE" }); }
    listItems() { return this._req("/api/items"); }
    createItem(i) { return this._req("/api/items", { method: "POST", body: JSON.stringify(i) }); }
    updateItem(id, patch) { return this._req(`/api/items/${id}`, { method: "PATCH", body: JSON.stringify(patch) }); }
    deleteItem(id) { return this._req(`/api/items/${id}`, { method: "DELETE" }); }
    redeem(uid, itemId) { return this._req("/api/redeem", { method: "POST", body: JSON.stringify({ uid, item_id: itemId }) }); }
    merge(payload) { return this._req("/api/merge", { method: "POST", body: JSON.stringify(payload) }); }
    listTransactions(uid, limit = 50) {
      const q = new URLSearchParams();
      if (uid) q.set("uid", uid);
      q.set("limit", limit);
      return this._req(`/api/transactions?${q.toString()}`);
    }
    exportData() { return this._req("/api/export"); }
    importData(data) { return this._req("/api/import", { method: "POST", body: JSON.stringify(data) }); }
    voidTx(id) { return this._req(`/api/transactions/${id}/void`, { method: "POST" }); }
    play(uid, cost, reward, game) { return this._req("/api/play", { method: "POST", body: JSON.stringify({ uid, cost, reward, game }) }); }
    nfcRead(_uid) { return this._req("/api/nfc/read", { method: "POST", body: JSON.stringify({}) }); }
    nfcWrite(_uid, data) { return this._req("/api/nfc/write", { method: "POST", body: JSON.stringify({ data }) }); }
    simulate(uid) { return this._req("/api/scan/simulate", { method: "POST", body: JSON.stringify({ uid }) }); }
  }

  class LocalStore {
    constructor() {
      this.name = "local";
      this.KEY = "arcade.data";
      this.data = JSON.parse(localStorage.getItem(this.KEY) || "null") || { cards: {}, items: [], tx: [], nextItemId: 1, nextTxId: 1 };
      this.data.nextTxId = this.data.nextTxId || 1;
      if (this.data.items.length === 0) {
        [["Candy Bar", 25, "tickets", -1, "Snacks"], ["Rubber Duck", 50, "tickets", -1, "Small"],
         ["Plush Bear", 500, "tickets", 10, "Plush"], ["Game Console", 25000, "tickets", 2, "Big"]]
          .forEach(([name, cost, currency, stock, category]) =>
            this.data.items.push({ id: this.data.nextItemId++, name, cost, currency, stock, category }));
      }
      this._save();
    }
    _save() { localStorage.setItem(this.KEY, JSON.stringify(this.data)); }
    _log(uid, kind, detail, cd = 0, td = 0) {
      this.data.tx.unshift({ id: this.data.nextTxId++, uid, kind, detail: detail || "", credits_d: cd, tickets_d: td, voided: 0, operator: settings.operator || "", ts: Date.now() / 1000 });
      this.data.tx = this.data.tx.slice(0, 2000);
    }
    async health() { return { ok: true, reader: "local" }; }
    async listCards() { return Object.values(this.data.cards).sort((a, b) => b.updated_at - a.updated_at); }
    async getCard(uid) { const c = this.data.cards[uid]; if (!c) throw new Error("not_found"); return c; }
    async createCard(c) {
      const uid = (c.uid || "").trim();
      if (!uid) throw new Error("uid_required");
      if (this.data.cards[uid]) throw new Error("exists");
      const now = Date.now() / 1000;
      const card = { uid, name: c.name || "", credits: +c.credits || 0, tickets: +c.tickets || 0, status: "active", tier: "Standard", notes: "", role: c.role === "staff" ? "staff" : "customer", expires: "", created_at: now, updated_at: now };
      this.data.cards[uid] = card; this._log(uid, "create_card", (c.name || "") + (card.role === "staff" ? " (staff)" : "")); this._save(); return card;
    }
    async updateCard(uid, patch) {
      const c = this.data.cards[uid];
      if (!c) throw new Error("not_found");
      const cd = +patch.credits_delta || 0, td = +patch.tickets_delta || 0;
      if ((cd || td) && cardBlocked(c)) throw new Error("card_blocked");
      if (td > 0 && c.role === "staff") throw new Error("staff_no_tickets");
      if (c.credits + cd < 0 || c.tickets + td < 0) throw new Error("insufficient_balance");
      c.credits += cd; c.tickets += td;
      if (patch.name !== undefined) c.name = patch.name;
      const prevStatus = c.status;
      if (patch.status !== undefined) c.status = patch.status;
      if (patch.tier !== undefined) c.tier = patch.tier;
      if (patch.notes !== undefined) c.notes = patch.notes;
      if (patch.role !== undefined) c.role = patch.role;
      if (patch.expires !== undefined) c.expires = patch.expires;
      c.updated_at = Date.now() / 1000;
      if (cd || td) this._log(uid, cd > 0 || td > 0 ? "add" : "remove", patch.reason, cd, td);
      if (patch.status !== undefined && patch.status !== prevStatus) this._log(uid, "status", patch.status);
      this._save(); return c;
    }
    async deleteCard(uid) { delete this.data.cards[uid]; this._log(uid, "delete_card"); this._save(); return { ok: true }; }
    async listItems() { return [...this.data.items].sort((a, b) => a.cost - b.cost); }
    async createItem(i) {
      if (!(i.name || "").trim()) throw new Error("name_required");
      const item = { id: this.data.nextItemId++, name: i.name, cost: +i.cost || 0, currency: i.currency || "tickets", stock: i.stock === undefined ? -1 : +i.stock, category: i.category || "" };
      this.data.items.push(item); this._save(); return item;
    }
    async updateItem(id, patch) {
      const item = this.data.items.find((x) => x.id === id);
      if (!item) throw new Error("not_found");
      Object.assign(item, { name: patch.name ?? item.name, cost: patch.cost === undefined ? item.cost : +patch.cost,
        currency: patch.currency ?? item.currency, stock: patch.stock === undefined ? item.stock : +patch.stock,
        category: patch.category ?? item.category });
      this._save(); return item;
    }
    async deleteItem(id) { this.data.items = this.data.items.filter((x) => x.id !== id); this._save(); return { ok: true }; }
    async voidTx(id) {
      const tx = this.data.tx.find((t) => t.id === id);
      if (!tx) throw new Error("not_found");
      if (tx.voided) throw new Error("already_voided");
      const c = this.data.cards[tx.uid];
      if (!c) throw new Error("card_not_found");
      if (c.credits - tx.credits_d < 0 || c.tickets - tx.tickets_d < 0) throw new Error("would_go_negative");
      c.credits -= tx.credits_d; c.tickets -= tx.tickets_d; c.updated_at = Date.now() / 1000;
      tx.voided = 1;
      this._log(tx.uid, "void", `${tx.kind}: ${tx.detail}`, -tx.credits_d, -tx.tickets_d);
      this._save(); return c;
    }
    async redeem(uid, itemId) {
      const c = this.data.cards[uid], item = this.data.items.find((x) => x.id === itemId);
      if (!c) throw new Error("card_not_found");
      if (!item) throw new Error("item_not_found");
      if (cardBlocked(c)) throw new Error("card_blocked");
      if (c.role === "staff") throw new Error("staff_no_redeem");
      if (item.stock === 0) throw new Error("out_of_stock");
      if (c[item.currency] < item.cost) throw new Error("insufficient_balance");
      const cd = item.currency === "credits" ? -item.cost : 0, td = item.currency === "tickets" ? -item.cost : 0;
      c.credits += cd; c.tickets += td; c.updated_at = Date.now() / 1000;
      if (item.stock > 0) item.stock -= 1;
      this._log(uid, "redeem", item.name, cd, td); this._save(); return c;
    }
    async merge({ source, dest, credits, tickets }) {
      const s = this.data.cards[source], d = this.data.cards[dest];
      if (!s || !d || source === dest) throw new Error("bad_cards");
      if (!credits && !tickets) throw new Error("nothing_selected");
      const mc = credits ? s.credits : 0, mt = tickets ? s.tickets : 0;
      d.credits += mc; d.tickets += mt; s.credits -= mc; s.tickets -= mt;
      const now = Date.now() / 1000; s.updated_at = now; d.updated_at = now;
      this._log(source, "merge_out", `to ${dest}`, -mc, -mt);
      this._log(dest, "merge_in", `from ${source}`, mc, mt);
      this._save(); return { source: s, dest: d };
    }
    async listTransactions(uid, limit = 50) { return this.data.tx.filter((t) => !uid || t.uid === uid).slice(0, limit); }
    async play(uid, cost, reward, game) {
      const c = this.data.cards[uid];
      if (!c) throw new Error("card_not_found");
      if (cardBlocked(c)) throw new Error("card_blocked");
      if (c.role === "staff") { this._log(uid, "play", `${game} (free)`); this._save(); return { card: c, paid: 0, won: 0, free: true }; }
      cost = Math.max(0, +cost || 0); reward = Math.max(0, +reward || 0);
      if (c.credits < cost) { const e = new Error("insufficient_credits"); e.have = c.credits; e.need = cost; throw e; }
      c.credits -= cost; c.tickets += reward; c.updated_at = Date.now() / 1000;
      this._log(uid, "play", game, -cost, reward);
      this._save(); return { card: c, paid: cost, won: reward, free: false };
    }
    async nfcRead(uid) { this.data.nfcmem = this.data.nfcmem || {}; return { uid, data: this.data.nfcmem[uid] || null }; }
    async nfcWrite(uid, data) { this.data.nfcmem = this.data.nfcmem || {}; this.data.nfcmem[uid] = data; this._save(); return { ok: true, uid }; }
    async exportData() { return { version: 3, cards: Object.values(this.data.cards), items: this.data.items, transactions: this.data.tx }; }
    async importData({ cards = [], items = [] }) {
      const now = Date.now() / 1000;
      this.data.cards = {};
      cards.forEach((c) => { if (c.uid) this.data.cards[c.uid] = { uid: c.uid, name: c.name || "", credits: +c.credits || 0, tickets: +c.tickets || 0, status: c.status || "active", tier: c.tier || "Standard", notes: c.notes || "", role: c.role || "customer", expires: c.expires || "", created_at: c.created_at || now, updated_at: c.updated_at || now }; });
      this.data.items = []; this.data.nextItemId = 1;
      items.forEach((it) => this.data.items.push({ id: this.data.nextItemId++, name: it.name || "Item", cost: +it.cost || 0, currency: it.currency || "tickets", stock: it.stock === undefined ? -1 : +it.stock, category: it.category || "" }));
      this._save(); return { ok: true, cards: cards.length, items: items.length };
    }
    async simulate(uid) { onTap(uid); return { ok: true }; }
  }

  let store = null, activeCard = null, items = [], sse = null, appStarted = false;
  function startApp() { appStarted = true; connect(); resetIdle(); }

  // ---------------------------------------------------------------
  // Connection
  // ---------------------------------------------------------------
  async function connect() {
    const url = settings.backendUrl.trim();
    setConn("checking", "Checking…");
    // Use the cloud/backend store whenever a URL is set, regardless of RFID mode.
    // (Keyboard-wedge readers still need the shared cloud data — the reader is
    // the keyboard, but the balances live in the cloud.)
    if (url) {
      try {
        const s = new BackendStore(url);
        const h = await Promise.race([s.health(), new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 3500))]);
        store = s;
        const label = settings.rfidMode === "wedge" ? "Cloud · keyboard-wedge" : `Cloud · ${h.reader} reader`;
        setConn("online", label);
        // Live tap feed only matters when the backend owns the reader.
        if (settings.rfidMode === "backend") openStream(url); else closeStream();
        await refreshAll();
        return;
      } catch (e) { /* backend unreachable — fall back to local */ }
    }
    store = new LocalStore();
    setConn("local", settings.rfidMode === "wedge" ? "Keyboard-wedge (local)" : "Local mode (this device only)");
    closeStream(); await refreshAll();
  }
  function setConn(state, text) { $("#connPill").className = "conn-pill " + state; $("#connText").textContent = text; }
  function openStream(url) {
    closeStream();
    try {
      sse = new EventSource(url.replace(/\/$/, "") + "/api/scan/stream");
      sse.onmessage = (ev) => { try { const d = JSON.parse(ev.data); if (d.uid) onTap(d.uid); } catch (_) {} };
      sse.onerror = () => {};
    } catch (_) {}
  }
  function closeStream() { if (sse) { sse.close(); sse = null; } }

  // ---------------------------------------------------------------
  // Tap handling
  // ---------------------------------------------------------------
  async function onTap(uid) {
    uid = (uid || "").trim();
    if (!uid) return;
    // Ignore taps while the screen is locked.
    if (document.body.classList.contains("locked")) return;
    // Station kiosk open? every tap is a "play".
    if (stationOpen()) { playAtStation(uid); return; }
    // Merge / transfer flows waiting for the second card?
    if (mergeAwaiting) { mergeSecondCard(uid); return; }
    if (transferAwaiting) { transferSecondCard(uid); return; }
    // New-card modal open? fill its UID.
    if (!$("#modalBackdrop").classList.contains("hidden")) {
      $("#newUid").value = uid;
      $("#newCardScanHint").textContent = `Card ${uid} detected — press Create.`;
      return;
    }
    try { const card = await store.getCard(uid); loadCard(card); beep(660); toast(`Card ${uid} loaded`, "success"); }
    catch (e) { openNewCardModal(uid); toast(`Unknown card ${uid} — register it?`, "error"); }
  }

  // Keyboard-wedge readers "type" the UID then Enter.
  let wedgeBuf = "", wedgeTimer = null;
  document.addEventListener("keydown", (e) => {
    if (settings.rfidMode !== "wedge") return;
    if (document.body.classList.contains("locked")) return; // ignore while locked
    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "select" || tag === "textarea") return;
    if (e.key === "Enter") { if (wedgeBuf.length >= 3) onTap(wedgeBuf); wedgeBuf = ""; return; }
    if (e.key.length === 1) { wedgeBuf += e.key; clearTimeout(wedgeTimer); wedgeTimer = setTimeout(() => (wedgeBuf = ""), 300); }
  });

  // ---------------------------------------------------------------
  // Visual helpers (monogram badges instead of emojis)
  // ---------------------------------------------------------------
  function hashHue(str) { let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return Math.abs(h) % 360; }
  function badgeStyle(str) { const hue = hashHue(str || "?"); return `background:linear-gradient(150deg,hsl(${hue} 62% 52%),hsl(${(hue + 30) % 360} 62% 44%))`; }
  function monogram(name) { return (name || "?").trim().charAt(0).toUpperCase() || "?"; }

  // ---------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------
  function loadCard(card) {
    activeCard = card;
    $("#scanHint").classList.add("hidden");
    $("#activeCard").classList.remove("hidden");
    $("#cardUid").textContent = card.uid;
    $("#cardName").value = card.name || "";
    const isStaffCard = card.role === "staff";
    $("#balCredits").textContent = isStaffCard ? "∞" : card.credits;
    $("#balTickets").textContent = card.tickets;
    document.getElementById("activeCard").classList.toggle("staff-card", isStaffCard);
    const expired = isExpired(card);
    const status = expired ? "lost" : (card.status || "active");
    const badge = $("#cardStatusBadge");
    const isStaff = card.role === "staff";
    const statusText = expired ? "EXPIRED" : status;
    badge.textContent = (isStaff ? "STAFF · " : "") + (card.tier && card.tier !== "Standard" ? card.tier + " · " : "") + statusText;
    badge.className = "card-status-badge " + (isStaff ? "staff" : status);
    if ($("#tierSelect")) $("#tierSelect").value = card.tier || "Standard";
    if ($("#cardNotes")) $("#cardNotes").value = card.notes || "";
    if ($("#cardExpires")) $("#cardExpires").value = card.expires || "";
    $$("#statusSeg .seg-btn").forEach((btn) => btn.classList.toggle("active", btn.dataset.status === status));
    renderPrizes();
    renderCustomer();
    if (bodyIsAdvanced()) refreshLog();
  }
  function unloadCard() { activeCard = null; $("#activeCard").classList.add("hidden"); $("#scanHint").classList.remove("hidden"); renderPrizes(); renderCustomer(); }

  async function refreshAll() {
    await Promise.all([refreshItems(), refreshCards()]);
    if (activeCard) { try { loadCard(await store.getCard(activeCard.uid)); } catch (_) { unloadCard(); } }
    if (bodyIsAdvanced()) refreshLog();
  }
  async function refreshItems() {
    if (!store) return;
    items = await store.listItems();
    populateCategories();
    renderPrizes(); renderItemList();
  }

  function populateCategories() {
    const sel = $("#prizeCategory");
    const cur = sel.value;
    const cats = [...new Set(items.map((i) => i.category).filter(Boolean))].sort();
    sel.innerHTML = `<option value="">All categories</option>` + cats.map((c) => `<option value="${escapeAttr(c)}">${escapeHtml(c)}</option>`).join("");
    sel.value = cur;
  }

  function renderPrizes() {
    const grid = $("#prizeGrid"); grid.innerHTML = "";
    const term = ($("#prizeSearch") ? $("#prizeSearch").value : "").toLowerCase();
    const cat = $("#prizeCategory") ? $("#prizeCategory").value : "";
    const shown = items.filter((i) =>
      (!term || i.name.toLowerCase().includes(term)) && (!cat || i.category === cat));
    if (shown.length === 0) { grid.innerHTML = `<p class="panel-hint">No matching prizes.</p>`; return; }
    shown.forEach((item) => {
      const affordable = activeCard && item.stock !== 0 && activeCard[item.currency] >= item.cost;
      const low = item.stock > 0 && item.stock <= 3;
      const div = document.createElement("div");
      div.className = "prize" + (activeCard && !affordable ? " disabled" : "");
      div.innerHTML = `
        <div class="prize-badge" style="${badgeStyle(item.name)}">${escapeHtml(monogram(item.name))}</div>
        <div class="prize-name">${escapeHtml(item.name)}</div>
        <div class="prize-cost ${item.currency}">${item.cost} ${item.currency}</div>
        <div class="prize-stock">${item.stock < 0 ? "In stock" : (low ? "Low: " : "") + item.stock + " left"}</div>`;
      div.addEventListener("click", () => redeemItem(item));
      grid.appendChild(div);
    });
  }

  function renderItemList() {
    const list = $("#itemList"); list.innerHTML = "";
    items.forEach((item) => {
      const row = document.createElement("div");
      row.className = "row-item";
      row.innerHTML = `
        <span class="ri-badge" style="${badgeStyle(item.name)}">${escapeHtml(monogram(item.name))}</span>
        <div class="ri-main">
          <div class="ri-title">${escapeHtml(item.name)}</div>
          <div class="ri-sub">${item.cost} ${item.currency} · ${item.stock < 0 ? "unlimited" : item.stock + " in stock"}</div>
        </div>
        <div class="ri-actions">
          ${item.stock >= 0 ? `<button class="mini-btn" data-restock="${item.id}">+10 stock</button>` : ""}
          <button class="mini-btn" data-edit="${item.id}">${svgUse("edit")} Edit</button>
          <button class="mini-btn danger" data-del="${item.id}">${svgUse("trash")}</button>
        </div>`;
      row.querySelector("[data-edit]").addEventListener("click", () => editItem(item));
      const restock = row.querySelector("[data-restock]");
      if (restock) restock.addEventListener("click", async () => {
        await store.updateItem(item.id, { stock: item.stock + 10 }); toast(`Restocked ${item.name} (+10)`, "success"); refreshItems();
      });
      row.querySelector("[data-del]").addEventListener("click", async () => {
        if (!confirm(`Delete "${item.name}"?`)) return;
        await store.deleteItem(item.id); toast("Item deleted"); refreshItems();
      });
      list.appendChild(row);
    });
  }

  async function refreshCards() {
    if (!store) return;
    const cards = await store.listCards();
    const term = ($("#cardSearch").value || "").toLowerCase();
    const list = $("#cardList"); list.innerHTML = "";
    const filtered = cards.filter((c) => c.uid.toLowerCase().includes(term) || (c.name || "").toLowerCase().includes(term));
    const bc = $("#bulkCount"); if (bc) bc.textContent = filtered.filter((c) => c.role !== "staff").length + (term ? " matching card(s)" : " card(s)");
    if (filtered.length === 0) { list.innerHTML = `<p class="panel-hint">No cards ${term ? "match" : "registered yet"}.</p>`; return; }
    filtered.forEach((c) => {
      const row = document.createElement("div");
      row.className = "row-item";
      row.innerHTML = `
        <span class="ri-badge card">${svgUse("cards")}</span>
        <div class="ri-main">
          <div class="ri-title">${escapeHtml(c.name || "(no name)")}${c.role === "staff" ? " · STAFF" : ""}${c.status === "frozen" ? " · FROZEN" : ""}${c.tier && c.tier !== "Standard" ? " · " + escapeHtml(c.tier) : ""}</div>
          <div class="ri-sub">${escapeHtml(c.uid)} · ${c.credits} credits · ${c.tickets} tickets</div>
        </div>
        <div class="ri-actions">
          <button class="mini-btn" data-send="${escapeAttr(c.uid)}">Send</button>
          <button class="mini-btn" data-load="${escapeAttr(c.uid)}">Open</button>
        </div>`;
      row.querySelector("[data-load]").addEventListener("click", () => onTap(c.uid));
      row.querySelector("[data-send]").addEventListener("click", () => openTransfer(c));
      list.appendChild(row);
    });
  }

  function txBadge(t) {
    if (t.kind === "redeem") return "redeem";
    if (t.kind === "void") return "remove";
    if (t.kind.startsWith("merge")) return "merge";
    if (t.credits_d > 0 || t.tickets_d > 0) return "add";
    if (t.credits_d < 0 || t.tickets_d < 0) return "remove";
    return "other";
  }
  const TX_LABELS = { create_card: "created", delete_card: "deleted", merge_in: "merge in", merge_out: "merge out", void: "void", status: "status", play: "play" };

  async function refreshLog() {
    if (!store) return;
    const list = $("#logList");
    $("#logScope").textContent = activeCard ? `Activity for ${activeCard.uid}` : "Recent activity (all cards)";
    const tx = await store.listTransactions(activeCard ? activeCard.uid : null, 200);
    list.innerHTML = "";
    if (tx.length === 0) { list.innerHTML = `<p class="panel-hint">No activity yet.</p>`; return; }
    tx.forEach((t) => {
      const label = TX_LABELS[t.kind] || t.kind;
      const parts = [];
      if (t.credits_d) parts.push(`${t.credits_d > 0 ? "+" : ""}${t.credits_d} credits`);
      if (t.tickets_d) parts.push(`${t.tickets_d > 0 ? "+" : ""}${t.tickets_d} tickets`);
      const canVoid = !t.voided && (t.credits_d || t.tickets_d) && t.kind !== "void";
      const row = document.createElement("div");
      row.className = "log-entry" + (t.voided ? " voided" : "");
      row.innerHTML = `
        <span class="log-badge ${txBadge(t)}">${escapeHtml(label)}</span>
        <div class="log-main">
          <div>${escapeHtml(t.detail || t.uid)}${parts.length ? " · " + parts.join(", ") : ""}</div>
          <div class="log-time">${escapeHtml(t.uid)} · ${new Date(t.ts * 1000).toLocaleString()}${t.operator ? " · by " + escapeHtml(t.operator) : ""}</div>
        </div>
        ${canVoid ? `<button class="log-void" data-void="${t.id}">${svgUse("undo")} Void</button>` : ""}`;
      if (canVoid) row.querySelector("[data-void]").addEventListener("click", async () => {
        if (!confirm("Void this transaction? It reverses the balance change.")) return;
        try { await store.voidTx(t.id); toast("Transaction voided", "success"); if (activeCard) { try { loadCard(await store.getCard(activeCard.uid)); } catch (_) {} } refreshLog(); refreshCards(); }
        catch (e) { toast("Void failed: " + e.message, "error"); }
      });
      list.appendChild(row);
    });
  }

  async function exportCsv() {
    const tx = await store.listTransactions(activeCard ? activeCard.uid : null, 5000);
    const head = ["id", "uid", "kind", "detail", "credits_d", "tickets_d", "voided", "datetime"];
    const rows = tx.map((t) => [t.id, t.uid, t.kind, (t.detail || "").replace(/"/g, '""'),
      t.credits_d, t.tickets_d, t.voided || 0, new Date(t.ts * 1000).toISOString()]);
    const csv = [head.join(","), ...rows.map((r) => r.map((v) => `"${v}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "arcade-transactions.csv"; a.click();
    URL.revokeObjectURL(a.href);
    toast("CSV downloaded", "success");
  }

  // ---------------------------------------------------------------
  // Membership / freeze
  // ---------------------------------------------------------------
  async function saveMeta() {
    if (!activeCard) return;
    try {
      const card = await store.updateCard(activeCard.uid, { tier: $("#tierSelect").value, notes: $("#cardNotes").value, expires: $("#cardExpires").value });
      loadCard(card); syncToCard(); refreshCards(); toast("Membership saved", "success");
    } catch (e) { toast("Save failed", "error"); }
  }
  async function setStatus(next) {
    if (!activeCard || activeCard.status === next) return;
    try {
      const card = await store.updateCard(activeCard.uid, { status: next });
      loadCard(card); refreshCards(); if (bodyIsAdvanced()) refreshLog();
      const label = { active: "Card active", frozen: "Card frozen", lost: "Card marked lost" }[next] || "Status updated";
      toast(label, "success");
    } catch (e) { toast("Failed", "error"); }
  }
  async function bulkFreeze(freeze) {
    const cards = filteredCards(await store.listCards());
    if (cards.length === 0) { toast("No cards match", "error"); return; }
    if (!confirm(`${freeze ? "Freeze" : "Unfreeze"} ${cards.length} card(s)?`)) return;
    let ok = 0;
    for (const c of cards) { try { await store.updateCard(c.uid, { status: freeze ? "frozen" : "active" }); ok++; } catch (_) {} }
    toast(`${freeze ? "Froze" : "Unfroze"} ${ok} card(s)`, "success");
    refreshCards();
    if (activeCard) { try { loadCard(await store.getCard(activeCard.uid)); } catch (_) {} }
  }

  // ---------------------------------------------------------------
  // On-card data (NFC read/write)
  // ---------------------------------------------------------------
  // Keep this small — an NTAG213 chip only has ~142 usable bytes. The physical
  // UID is always read separately, so we don't store it in the blob.
  function cardToNfc(c) { return { n: c.name || "", c: c.credits, t: c.tickets, s: c.status || "active", tr: c.tier || "Standard", r: c.role || "customer" }; }

  async function writeToCard(silent) {
    if (!activeCard) { if (!silent) toast("Load a card first", "error"); return; }
    if (!store.nfcWrite) { if (!silent) toast("This mode can't write cards", "error"); return; }
    try { await store.nfcWrite(activeCard.uid, cardToNfc(activeCard)); if (!silent) toast("Saved onto the card", "success"); }
    catch (e) { if (!silent) toast("Write failed: " + (e.message === "no_card_present" ? "no card on the reader" : e.message), "error"); }
  }
  // Best-effort auto-write after a change, when the setting is on.
  function syncToCard() { if (settings.nfcWrite && store && store.nfcWrite) writeToCard(true); }

  async function readFromCard() {
    if (!store.nfcRead) { toast("This mode can't read card data", "error"); return; }
    try {
      const res = await store.nfcRead(activeCard ? activeCard.uid : null);
      if (!res || !res.data) { toast("Card is blank (no data stored on it)", "error"); return; }
      const d = res.data;
      const summary = `On card: ${d.n || "(no name)"} — ${d.c} credits, ${d.t} tickets`;
      if (!confirm(summary + "\n\nApply this to the record and load it?")) { toast(summary); return; }
      const uid = res.uid || d.u;
      let card;
      try { card = await store.getCard(uid); }
      catch (_) { card = await store.createCard({ uid, name: d.n, credits: 0, tickets: 0, role: d.r }); }
      // Set exact balances + meta to match the card's stored data.
      card = await store.updateCard(uid, {
        name: d.n, role: d.r, tier: d.tr, status: d.s,
        credits_delta: (+d.c || 0) - card.credits, tickets_delta: (+d.t || 0) - card.tickets, reason: "read from card",
      });
      loadCard(card); if (bodyIsAdvanced()) { refreshCards(); refreshLog(); }
      toast("Loaded from card", "success");
    } catch (e) { toast("Read failed: " + (e.message === "no_card_present" ? "no card on the reader" : e.message), "error"); }
  }

  // ---------------------------------------------------------------
  // Sound / theme / kiosk
  // ---------------------------------------------------------------
  let audioCtx = null;
  function beep(freq = 660) {
    if (!settings.sound) return;
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = freq; o.type = "sine"; o.connect(g); g.connect(audioCtx.destination);
      g.gain.setValueAtTime(0.12, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.18);
      o.start(); o.stop(audioCtx.currentTime + 0.18);
    } catch (_) {}
  }
  function applyTheme() {
    document.documentElement.setAttribute("data-theme", settings.theme);
    document.documentElement.style.setProperty("--accent", settings.accent);
  }
  function applyReceiptWidth() {
    const w = settings.receiptWidth;
    const rule = w === "58" ? "@page { size: 58mm auto; margin: 3mm; }"
      : w === "full" ? "@page { size: auto; margin: 12mm; }"
      : "@page { size: 80mm auto; margin: 4mm; }";
    const el = document.getElementById("printSize");
    if (el) el.textContent = rule;
  }
  function toggleTheme() { settings.theme = settings.theme === "dark" ? "light" : "dark"; saveSettings(); applyTheme(); }
  function toggleFullscreen() {
    if (!document.fullscreenElement) (document.documentElement.requestFullscreen || (() => {})).call(document.documentElement);
    else document.exitFullscreen && document.exitFullscreen();
  }

  // Auto-lock on inactivity
  let idleTimer = null;
  function resetIdle() {
    clearTimeout(idleTimer);
    const secs = parseInt(settings.autolockSec, 10) || 0;
    if (secs > 0 && appStarted) idleTimer = setTimeout(() => { if (!document.body.classList.contains("locked")) showLock("unlock"); }, secs * 1000);
  }

  // ---------------------------------------------------------------
  // Card profile & full history
  // ---------------------------------------------------------------
  async function openProfile() {
    if (!activeCard) { toast("Load a card first", "error"); return; }
    const c = await store.getCard(activeCard.uid);
    const tx = await store.listTransactions(c.uid, 2000);
    const live = tx.filter((t) => !t.voided);
    const ticketsEarned = live.filter((t) => t.tickets_d > 0).reduce((s, t) => s + t.tickets_d, 0);
    const creditsAdded = live.filter((t) => t.credits_d > 0).reduce((s, t) => s + t.credits_d, 0);
    const prizes = live.filter((t) => t.kind === "redeem").length;
    const created = c.created_at ? new Date(c.created_at * 1000).toLocaleDateString() : "—";

    $("#pfAvatar").textContent = monogram(c.name || c.uid);
    $("#pfAvatar").style.cssText = badgeStyle(c.name || c.uid);
    $("#pfName").textContent = c.name || "(no name)";
    $("#pfMeta").innerHTML = `${escapeHtml(c.uid)} · ${escapeHtml(c.status || "active")}` +
      `${c.tier && c.tier !== "Standard" ? " · " + escapeHtml(c.tier) : ""} · member since ${created}` +
      `${c.notes ? `<br><em>${escapeHtml(c.notes)}</em>` : ""}`;
    $("#pfStats").innerHTML = `
      <div class="stat"><div class="stat-label">Credits now</div><div class="stat-value credits">${c.credits}</div></div>
      <div class="stat"><div class="stat-label">Tickets now</div><div class="stat-value tickets">${c.tickets}</div></div>
      <div class="stat"><div class="stat-label">Tickets earned</div><div class="stat-value">${ticketsEarned}</div><div class="stat-sub">all-time</div></div>
      <div class="stat"><div class="stat-label">Credits added</div><div class="stat-value">${creditsAdded}</div><div class="stat-sub">all-time</div></div>
      <div class="stat"><div class="stat-label">Prizes claimed</div><div class="stat-value">${prizes}</div></div>
      <div class="stat"><div class="stat-label">Activity</div><div class="stat-value">${tx.length}</div><div class="stat-sub">events</div></div>`;

    const hist = $("#pfHistory");
    if (tx.length === 0) { hist.innerHTML = `<p class="panel-hint">No history yet.</p>`; }
    else {
      hist.innerHTML = "";
      tx.forEach((t) => {
        const label = TX_LABELS[t.kind] || t.kind;
        const parts = [];
        if (t.credits_d) parts.push(`${t.credits_d > 0 ? "+" : ""}${t.credits_d} credits`);
        if (t.tickets_d) parts.push(`${t.tickets_d > 0 ? "+" : ""}${t.tickets_d} tickets`);
        const row = document.createElement("div");
        row.className = "log-entry" + (t.voided ? " voided" : "");
        row.innerHTML = `<span class="log-badge ${txBadge(t)}">${escapeHtml(label)}</span>
          <div class="log-main"><div>${escapeHtml(t.detail || "")}${parts.length ? " · " + parts.join(", ") : ""}</div>
          <div class="log-time">${new Date(t.ts * 1000).toLocaleString()}</div></div>`;
        hist.appendChild(row);
      });
    }
    $("#profileBackdrop").classList.remove("hidden");
  }
  function closeProfile() { $("#profileBackdrop").classList.add("hidden"); }

  // ---------------------------------------------------------------
  // Undo last change on the active card
  // ---------------------------------------------------------------
  async function undoLast() {
    if (!activeCard) { toast("Load a card first", "error"); return; }
    const tx = await store.listTransactions(activeCard.uid, 40);
    const target = tx.find((t) => !t.voided && (t.credits_d || t.tickets_d) && t.kind !== "void");
    if (!target) { toast("Nothing to undo", "error"); return; }
    const desc = [];
    if (target.credits_d) desc.push(`${target.credits_d > 0 ? "+" : ""}${target.credits_d} credits`);
    if (target.tickets_d) desc.push(`${target.tickets_d > 0 ? "+" : ""}${target.tickets_d} tickets`);
    if (!confirm(`Undo last change — ${target.detail || target.kind}: ${desc.join(", ")}?`)) return;
    try {
      await store.voidTx(target.id);
      loadCard(await store.getCard(activeCard.uid)); syncToCard();
      if (bodyIsAdvanced()) { refreshCards(); refreshLog(); }
      toast("Undid last change", "success");
    } catch (e) { toast("Undo failed: " + e.message, "error"); }
  }

  // ---------------------------------------------------------------
  // Bulk actions (Cards tab)
  // ---------------------------------------------------------------
  function filteredCards(cards) {
    const term = ($("#cardSearch").value || "").toLowerCase();
    return cards.filter((c) => c.role !== "staff" && (c.uid.toLowerCase().includes(term) || (c.name || "").toLowerCase().includes(term)));
  }
  async function bulkAdjust(sign) {
    const amt = Math.abs(parseInt($("#bulkAmount").value, 10) || 0);
    if (!amt) { toast("Enter an amount", "error"); return; }
    const kind = $("#bulkKind").value;
    const cards = filteredCards(await store.listCards());
    if (cards.length === 0) { toast("No cards match", "error"); return; }
    if (!confirm(`${sign > 0 ? "Add" : "Remove"} ${amt} ${kind} ${sign > 0 ? "to" : "from"} ${cards.length} card(s)?`)) return;
    let ok = 0, fail = 0;
    for (const c of cards) {
      const patch = { reason: "bulk" };
      patch[kind === "credits" ? "credits_delta" : "tickets_delta"] = sign * amt;
      try { await store.updateCard(c.uid, patch); ok++; } catch (_) { fail++; }
    }
    $("#bulkAmount").value = "";
    toast(`Updated ${ok} card(s)${fail ? `, ${fail} skipped` : ""}`, "success");
    refreshCards();
    if (activeCard) { try { loadCard(await store.getCard(activeCard.uid)); } catch (_) {} }
  }

  // ---------------------------------------------------------------
  // Full-screen live stats (for a big display)
  // ---------------------------------------------------------------
  let statsTimer = null;
  async function renderStatsScreen() {
    const [cards, items, tx] = await Promise.all([store.listCards(), store.listItems(), store.listTransactions(null, 3000)]);
    const live = tx.filter((t) => !t.voided);
    const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
    const startSec = midnight.getTime() / 1000;
    const today = live.filter((t) => t.ts >= startSec);
    const creditsCirc = cards.reduce((s, c) => s + c.credits, 0);
    const ticketsCirc = cards.reduce((s, c) => s + c.tickets, 0);
    const redeemsToday = today.filter((t) => t.kind === "redeem").length;
    const ticketsToday = today.filter((t) => t.tickets_d > 0).reduce((s, t) => s + t.tickets_d, 0);
    $("#statsScreenGrid").innerHTML = `
      <div class="stat"><div class="stat-label">Cards</div><div class="stat-value">${cards.length}</div></div>
      <div class="stat"><div class="stat-label">Credits in play</div><div class="stat-value credits">${creditsCirc}</div></div>
      <div class="stat"><div class="stat-label">Tickets in play</div><div class="stat-value tickets">${ticketsCirc}</div></div>
      <div class="stat"><div class="stat-label">Tickets won today</div><div class="stat-value tickets">${ticketsToday}</div></div>
      <div class="stat"><div class="stat-label">Prizes today</div><div class="stat-value">${redeemsToday}</div></div>`;
    // top prizes today
    const counts = {};
    today.filter((t) => t.kind === "redeem").forEach((t) => { const n = t.detail || "?"; counts[n] = (counts[n] || 0) + 1; });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);
    topListInto($("#statsTopPrizes"), top, top[0] ? top[0][1] : 1, (v) => v + "×");
    // ticker
    const ticker = $("#statsTicker");
    const recent = live.slice(0, 10);
    if (recent.length === 0) { ticker.innerHTML = `<p class="panel-hint">No activity yet.</p>`; }
    else {
      ticker.innerHTML = "";
      recent.forEach((t) => {
        const label = TX_LABELS[t.kind] || t.kind;
        const parts = [];
        if (t.credits_d) parts.push(`${t.credits_d > 0 ? "+" : ""}${t.credits_d}c`);
        if (t.tickets_d) parts.push(`${t.tickets_d > 0 ? "+" : ""}${t.tickets_d}t`);
        const row = document.createElement("div");
        row.className = "log-entry";
        row.innerHTML = `<span class="log-badge ${txBadge(t)}">${escapeHtml(label)}</span>
          <div class="log-main"><div>${escapeHtml(t.detail || t.uid)}${parts.length ? " · " + parts.join(", ") : ""}</div>
          <div class="log-time">${new Date(t.ts * 1000).toLocaleTimeString()}</div></div>`;
        ticker.appendChild(row);
      });
    }
  }
  function openStats() { $("#statsScreen").classList.remove("hidden"); renderStatsScreen(); clearInterval(statsTimer); statsTimer = setInterval(renderStatsScreen, 4000); }
  function closeStats() { $("#statsScreen").classList.add("hidden"); clearInterval(statsTimer); statsTimer = null; }

  // ---------------------------------------------------------------
  // Game station display (charges credits to play, one per booth)
  // ---------------------------------------------------------------
  let stationTimer = null;
  function stationOpen() { return !$("#stationScreen").classList.contains("hidden"); }
  function countUp(el, to) {
    to = +to || 0;
    const from = el.dataset.v !== undefined ? +el.dataset.v : 0;
    el.dataset.v = to;
    if (from === to) { el.textContent = to; return; }   // no change -> don't re-animate
    const dur = 550, t0 = performance.now();
    requestAnimationFrame(function step(t) {
      const p = Math.min(1, (t - t0) / dur), e = p * (2 - p); // easeOut
      el.textContent = Math.round(from + (to - from) * e);
      if (p < 1) requestAnimationFrame(step);
    });
  }
  function stationIdle() {
    $("#stGame").textContent = settings.stationName || "Game";
    $("#stCost").textContent = parseInt(settings.stationCost, 10) || 0;
    $("#stIdle").classList.remove("hidden");
    $("#stResult").classList.add("hidden");
  }
  function stationMessage(big, sub, warn) {
    $("#stHello").textContent = big;
    $("#stHello").className = "st-hello" + (warn ? " warn" : "");
    $("#stPaid").textContent = sub || "";
    $("#stPaid").className = "st-paid";
    $("#stStats").classList.add("hidden");
    $("#stIdle").classList.add("hidden");
    $("#stResult").classList.remove("hidden");
  }
  function stationResult(res, cost) {
    const c = res.card;
    $("#stHello").textContent = `Hi ${c.name || "player"}!`;
    $("#stHello").className = "st-hello";
    if (res.free) { $("#stPaid").textContent = "FREE PLAY"; $("#stPaid").className = "st-paid free"; }
    else {
      const parts = [];
      if (cost) parts.push(`−${cost} credits`);
      if (res.won) parts.push(`+${res.won} tickets`);
      $("#stPaid").innerHTML = parts.length
        ? parts.map((t, i) => `<span class="${t[0] === "+" ? "won" : ""}">${t}</span>`).join("  ·  ")
        : "Played!";
      $("#stPaid").className = "st-paid";
    }
    $("#stStats").classList.remove("hidden");
    if (res.free) $("#stLeft").textContent = "∞"; else countUp($("#stLeft"), c.credits);
    countUp($("#stTickets"), c.tickets);
    $("#stIdle").classList.add("hidden");
    $("#stResult").classList.remove("hidden");
  }
  async function playAtStation(uid) {
    uid = (uid || "").trim(); if (!uid) return;
    const cost = parseInt(settings.stationCost, 10) || 0;
    const reward = parseInt(settings.stationReward, 10) || 0;
    const game = settings.stationName || "Game";
    clearTimeout(stationTimer);
    try {
      const res = await store.play(uid, cost, reward, game);
      stationResult(res, cost); beep(880);
    } catch (e) {
      if (e.message === "card_not_found") stationMessage("Card not registered", "Ask a helper to set it up", true);
      else if (e.message === "card_blocked") stationMessage("Card not active", "Frozen, lost, or expired", true);
      else if (e.message === "insufficient_credits") {
        let have = e.have; if (have === undefined) { try { have = (await store.getCard(uid)).credits; } catch (_) { have = "?"; } }
        stationMessage("Not enough credits", `You have ${have}, need ${cost}`, true);
      } else stationMessage("Please try again", "", true);
      beep(300);
    }
    stationTimer = setTimeout(stationIdle, 5000);
  }
  function openStation() { $("#stationScreen").classList.remove("hidden"); stationIdle(); }
  function closeStation() { $("#stationScreen").classList.add("hidden"); clearTimeout(stationTimer); }

  // ---------------------------------------------------------------
  // Customer display (Square-style, shows the player their tickets)
  // ---------------------------------------------------------------
  function customerOpen() { return !$("#customerScreen").classList.contains("hidden"); }
  async function renderCustomer() {
    if (!customerOpen()) return;
    if (!activeCard) {
      $("#custIdle").classList.remove("hidden");
      $("#custActive").classList.add("hidden");
      return;
    }
    $("#custIdle").classList.add("hidden");
    $("#custActive").classList.remove("hidden");
    const staff = activeCard.role === "staff";
    $("#custName").textContent = activeCard.name || "there";
    countUp($("#custTickets"), activeCard.tickets);
    $("#custCredits").textContent = staff ? "∞ free play" : `${activeCard.credits} credits to play`;
    // Affordable prizes: what they can grab right now with their tickets
    const canGet = items.filter((i) => i.currency === "tickets" && i.stock !== 0 && i.cost <= activeCard.tickets)
      .sort((a, b) => b.cost - a.cost).slice(0, 6);
    const pz = $("#custPrizes");
    pz.innerHTML = canGet.length
      ? `<div class="cust-prizes-label">You can get</div>` +
        canGet.map((i) => `<span class="cust-prize-chip">${escapeHtml(i.name)} <b>${i.cost}</b></span>`).join("")
      : "";
    const lines = $("#custLines");
    try {
      const tx = (await store.listTransactions(activeCard.uid, 12))
        .filter((t) => !t.voided && (t.tickets_d || t.credits_d)).slice(0, 5);
      lines.innerHTML = "";
      tx.forEach((t) => {
        const useT = !!t.tickets_d;
        const d = useT ? t.tickets_d : t.credits_d;
        const unit = useT ? "tickets" : "credits";
        const row = document.createElement("div");
        row.className = "cust-line";
        row.innerHTML = `<span class="cust-line-name">${escapeHtml(t.detail || (t.kind === "redeem" ? "Prize" : d > 0 ? "Added" : "Used"))}</span>
          <span class="cust-line-amt ${d > 0 ? "up" : "down"}">${d > 0 ? "+" : ""}${d} ${unit}</span>`;
        lines.appendChild(row);
      });
    } catch (_) { lines.innerHTML = ""; }
  }
  let custTimer = null;
  function openCustomer() {
    $("#customerScreen").classList.remove("hidden");
    renderCustomer();
    // Poll so the display stays live even when a different device (the staff
    // iPad) is the one making changes against the same backend.
    clearInterval(custTimer);
    custTimer = setInterval(async () => {
      if (!customerOpen()) return;
      if (activeCard && store) { try { activeCard = await store.getCard(activeCard.uid); } catch (_) {} }
      renderCustomer();
    }, 2000);
  }
  function closeCustomer() { $("#customerScreen").classList.add("hidden"); clearInterval(custTimer); custTimer = null; }

  // ---------------------------------------------------------------
  // Full-screen leaderboard (for a big display)
  // ---------------------------------------------------------------
  let lbTimer = null;
  let lbSig = "", lbLeader = null;
  async function renderLeaderboard() {
    const cards = (await store.listCards()).filter((c) => c.tickets > 0 && c.role !== "staff")
      .sort((a, b) => b.tickets - a.tickets).slice(0, 10);
    const list = $("#lbList");
    const sig = cards.map((c) => c.uid + ":" + c.tickets).join(",");
    if (sig === lbSig) return;            // nothing changed — don't churn/re-animate
    const leaderChanged = lbLeader !== null && cards[0] && cards[0].uid !== lbLeader;
    lbSig = sig; lbLeader = cards[0] ? cards[0].uid : null;
    if (cards.length === 0) { list.innerHTML = `<p class="lb-empty">No tickets yet — tap a card and add some!</p>`; return; }
    list.innerHTML = "";
    cards.forEach((c, i) => {
      const row = document.createElement("div");
      row.className = "lb-row" + (i < 3 ? " top" + (i + 1) : "") + (i === 0 && leaderChanged ? " crowned" : "");
      row.style.animationDelay = (i * 0.04) + "s";
      row.innerHTML = `
        <div class="lb-rank">${i + 1}</div>
        <div class="lb-name">${escapeHtml(c.name || c.uid)}
          <div class="lb-sub">${escapeHtml(c.uid)}${c.tier && c.tier !== "Standard" ? " · " + escapeHtml(c.tier) : ""}</div>
        </div>
        <div class="lb-tickets">${c.tickets}<small>tickets</small></div>`;
      list.appendChild(row);
    });
    if (leaderChanged) {
      const banner = $("#lbBanner");
      banner.textContent = `New leader: ${cards[0].name || cards[0].uid}!`;
      banner.classList.add("show");
      clearTimeout(renderLeaderboard._bt);
      renderLeaderboard._bt = setTimeout(() => banner.classList.remove("show"), 4000);
    }
  }
  function openLeaderboard() {
    $("#leaderboardScreen").classList.remove("hidden");
    renderLeaderboard();
    clearInterval(lbTimer);
    lbTimer = setInterval(renderLeaderboard, 4000); // live-ish for a big screen
  }
  function closeLeaderboard() {
    $("#leaderboardScreen").classList.add("hidden");
    clearInterval(lbTimer); lbTimer = null;
  }

  // ---------------------------------------------------------------
  // Dashboard (advanced)
  // ---------------------------------------------------------------
  function topListInto(el, rows, maxv, fmt) {
    if (rows.length === 0) { el.innerHTML = `<p class="panel-hint">Nothing yet.</p>`; return; }
    el.innerHTML = "";
    rows.forEach(([name, val], i) => {
      const row = document.createElement("div");
      row.className = "top-row";
      row.innerHTML = `<span class="top-rank">${i + 1}</span>
        <div style="flex:1;min-width:0"><div class="top-name">${escapeHtml(name)}</div>
          <div class="top-bar" style="width:${Math.round((val / (maxv || 1)) * 100)}%"></div></div>
        <span class="top-count">${fmt(val)}</span>`;
      el.appendChild(row);
    });
  }

  async function renderDashboard() {
    if (!store) return;
    const [cards, itemList, tx] = await Promise.all([
      store.listCards(), store.listItems(), store.listTransactions(null, 5000),
    ]);
    const live = tx.filter((t) => !t.voided);
    const creditsCirc = cards.reduce((s, c) => s + c.credits, 0);
    const ticketsCirc = cards.reduce((s, c) => s + c.tickets, 0);
    const redeems = live.filter((t) => t.kind === "redeem");
    const ticketsAwarded = live.filter((t) => t.tickets_d > 0).reduce((s, t) => s + t.tickets_d, 0);
    const frozen = cards.filter((c) => c.status === "frozen" || c.status === "lost").length;

    $("#statGrid").innerHTML = `
      <div class="stat"><div class="stat-label">Cards</div><div class="stat-value">${cards.length}</div><div class="stat-sub">${frozen} frozen · ${itemList.length} prizes</div></div>
      <div class="stat"><div class="stat-label">Tickets awarded</div><div class="stat-value tickets">${ticketsAwarded}</div><div class="stat-sub">all-time</div></div>
      <div class="stat"><div class="stat-label">Credits in play</div><div class="stat-value credits">${creditsCirc}</div><div class="stat-sub">across all cards</div></div>
      <div class="stat"><div class="stat-label">Tickets in play</div><div class="stat-value tickets">${ticketsCirc}</div><div class="stat-sub">${redeems.length} redemptions</div></div>`;

    // 7-day activity chart (transaction count per day)
    const days = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      days.push({ key: d.toDateString(), label: d.toLocaleDateString(undefined, { weekday: "short" }), n: 0 });
    }
    const idx = {}; days.forEach((d, i) => (idx[d.key] = i));
    live.forEach((t) => { const k = new Date(t.ts * 1000).toDateString(); if (k in idx) days[idx[k]].n++; });
    const maxn = Math.max(1, ...days.map((d) => d.n));
    $("#activityChart").innerHTML = days.map((d) =>
      `<div class="chart-col"><span class="chart-val">${d.n || ""}</span>
        <div class="chart-bar" style="height:${Math.round((d.n / maxn) * 100)}%"></div>
        <span class="chart-label">${d.label}</span></div>`).join("");

    // Top prizes
    const counts = {};
    redeems.forEach((t) => { const n = t.detail || "?"; counts[n] = (counts[n] || 0) + 1; });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    topListInto($("#topList"), top, top[0] ? top[0][1] : 1, (v) => v + "×");

    // Leaderboard — most tickets
    const lead = cards.filter((c) => c.tickets > 0 && c.role !== "staff").sort((a, b) => b.tickets - a.tickets).slice(0, 5)
      .map((c) => [c.name || c.uid, c.tickets]);
    topListInto($("#leaderList"), lead, lead[0] ? lead[0][1] : 1, (v) => v + " tix");

    // Low stock
    const low = itemList.filter((i) => i.stock >= 0 && i.stock <= 3).sort((a, b) => a.stock - b.stock).slice(0, 6)
      .map((i) => [i.name, i.stock]);
    topListInto($("#lowStockList"), low, low[0] ? Math.max(...low.map((x) => x[1]), 3) : 3, (v) => v + " left");
  }

  async function exportBackup() {
    const data = await store.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "arcade-backup.json";
    a.click();
    URL.revokeObjectURL(a.href);
    toast("Backup downloaded", "success");
  }
  async function importBackup(file) {
    if (!file) return;
    if (!confirm("Import will REPLACE all current cards and items. Continue?")) return;
    try {
      const data = JSON.parse(await file.text());
      const res = await store.importData(data);
      toast(`Imported ${res.cards} cards, ${res.items} items`, "success");
      unloadCard(); await refreshAll(); renderDashboard();
    } catch (e) { toast("Import failed: " + e.message, "error"); }
  }
  async function batchCreate() {
    const prefix = $("#batchPrefix").value || "CARD-";
    const count = Math.max(1, Math.min(500, parseInt($("#batchCount").value, 10) || 0));
    const credits = parseInt($("#batchCredits").value, 10) || 0;
    const tickets = parseInt($("#batchTickets").value, 10) || 0;
    if (!confirm(`Create ${count} cards named ${prefix}0001…?`)) return;
    const existing = new Set((await store.listCards()).map((c) => c.uid));
    let made = 0, n = 1;
    while (made < count && n < count * 5 + 1000) {
      const uid = prefix + String(n).padStart(4, "0");
      n++;
      if (existing.has(uid)) continue;
      try { await store.createCard({ uid, credits, tickets }); made++; } catch (_) {}
    }
    toast(`Created ${made} cards`, "success");
    refreshCards(); renderDashboard();
  }
  async function zeroAll() {
    if (!(await requireManager())) { toast("Manager PIN required", "error"); return; }
    if (!confirm("Set every card's credits and tickets to 0? This cannot be undone.")) return;
    const cards = await store.listCards();
    for (const c of cards) {
      const patch = { reason: "reset all" };
      if (c.credits) patch.credits_delta = -c.credits;
      if (c.tickets) patch.tickets_delta = -c.tickets;
      if (patch.credits_delta || patch.tickets_delta) { try { await store.updateCard(c.uid, patch); } catch (_) {} }
    }
    toast("All balances reset", "success");
    unloadCard(); await refreshAll(); renderDashboard();
  }
  async function wipeAll() {
    if (!(await requireManager())) { toast("Manager PIN required", "error"); return; }
    if (!confirm("Delete ALL cards permanently? This cannot be undone.")) return;
    const cards = await store.listCards();
    for (const c of cards) { try { await store.deleteCard(c.uid); } catch (_) {} }
    toast("All cards deleted", "success");
    unloadCard(); await refreshAll(); renderDashboard();
  }

  // Advanced per-card tools
  async function setExactBalance() {
    if (!activeCard) return;
    const sc = $("#setCredits").value, st = $("#setTickets").value;
    const patch = { reason: "set exact" };
    if (sc !== "") patch.credits_delta = (parseInt(sc, 10) || 0) - activeCard.credits;
    if (st !== "") patch.tickets_delta = (parseInt(st, 10) || 0) - activeCard.tickets;
    if (patch.credits_delta === undefined && patch.tickets_delta === undefined) { toast("Enter a value", "error"); return; }
    try {
      const card = await store.updateCard(activeCard.uid, patch);
      loadCard(card); syncToCard(); $("#setCredits").value = ""; $("#setTickets").value = "";
      if (bodyIsAdvanced()) { refreshCards(); refreshLog(); }
      toast("Balance set", "success");
    } catch (e) { toast(e.message === "insufficient_balance" ? "Value can't be negative" : "Failed", "error"); }
  }
  async function convert(dir) {
    if (!activeCard) return;
    const rate = parseFloat(settings.exchangeRate) || 1; // credits per 1 ticket
    const amt = Math.abs(parseInt($("#convertAmount").value, 10) || 0);
    if (!amt) { toast("Enter an amount", "error"); return; }
    let patch = { reason: "convert" };
    if (dir === "c2t") {
      // spend `amt` credits -> gain amt/rate tickets
      const gained = Math.floor(amt / rate);
      if (gained < 1) { toast("Amount too small for the rate", "error"); return; }
      patch.credits_delta = -amt; patch.tickets_delta = gained;
    } else {
      // spend `amt` tickets -> gain amt*rate credits
      patch.tickets_delta = -amt; patch.credits_delta = Math.floor(amt * rate);
    }
    try {
      const card = await store.updateCard(activeCard.uid, patch);
      loadCard(card); syncToCard(); $("#convertAmount").value = "";
      if (bodyIsAdvanced()) { refreshCards(); refreshLog(); }
      toast("Converted", "success");
    } catch (e) { toast(e.message === "insufficient_balance" ? "Not enough balance" : "Failed", "error"); }
  }

  // ---------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------
  async function adjust(kind, delta, reason) {
    if (!activeCard) { toast("Load a card first", "error"); return; }
    const patch = { reason: reason || "" };
    patch[kind === "credits" ? "credits_delta" : "tickets_delta"] = delta;
    try {
      const card = await store.updateCard(activeCard.uid, patch);
      loadCard(card); syncToCard();
      if (bodyIsAdvanced()) { refreshCards(); refreshLog(); }
      toast(`${delta > 0 ? "Added" : "Removed"} ${Math.abs(delta)} ${kind}`, "success");
    } catch (e) {
      const m = { card_blocked: "Card is frozen, lost, or expired", staff_no_tickets: "Staff cards can't earn tickets", insufficient_balance: "Not enough balance" }[e.message] || "Update failed";
      toast(m, "error");
    }
  }

  async function redeemItem(item) {
    if (!activeCard) { toast("Load a card first", "error"); return; }
    if (item.stock === 0) { toast("Out of stock", "error"); return; }
    if (activeCard[item.currency] < item.cost) { toast("Not enough " + item.currency, "error"); return; }
    if (!confirm(`Redeem "${item.name}" for ${item.cost} ${item.currency}?`)) return;
    const holder = activeCard.name || activeCard.uid;
    const cardUid = activeCard.uid;
    try {
      const card = await store.redeem(activeCard.uid, item.id);
      loadCard(card); refreshItems(); beep(990); syncToCard();
      if (bodyIsAdvanced()) { refreshCards(); refreshLog(); }
      // Claim number = the id of the redeem transaction we just created.
      let claim = "C" + Date.now().toString(36).toUpperCase().slice(-6);
      try { const last = await store.listTransactions(cardUid, 1); if (last[0]) claim = "#" + last[0].id; } catch (_) {}
      showReceipt(item, holder, cardUid, claim);
    } catch (e) {
      const m = { card_blocked: "Card is frozen, lost, or expired", staff_no_redeem: "Staff cards can't redeem prizes", out_of_stock: "Out of stock" }[e.message] || ("Redeem failed: " + e.message);
      toast(m, "error");
    }
  }

  // --- Real Code 39 barcode (scannable) ---
  const CODE39 = {
    "0": "nnnwwnwnn", "1": "wnnwnnnnw", "2": "nnwwnnnnw", "3": "wnwwnnnnn", "4": "nnnwwnnnw",
    "5": "wnnwwnnnn", "6": "nnwwwnnnn", "7": "nnnwnnwnw", "8": "wnnwnnwnn", "9": "nnwwnnwnn",
    "A": "wnnnnwnnw", "B": "nnwnnwnnw", "C": "wnwnnwnnn", "D": "nnnnwwnnw", "E": "wnnnwwnnn",
    "F": "nnwnwwnnn", "G": "nnnnnwwnw", "H": "wnnnnwwnn", "I": "nnwnnwwnn", "J": "nnnnwwwnn",
    "K": "wnnnnnnww", "L": "nnwnnnnww", "M": "wnwnnnnwn", "N": "nnnnwnnww", "O": "wnnnwnnwn",
    "P": "nnwnwnnwn", "Q": "nnnnnnwww", "R": "wnnnnnwwn", "S": "nnwnnnwwn", "T": "nnnnwnwwn",
    "U": "wwnnnnnnw", "V": "nwwnnnnnw", "W": "wwwnnnnnn", "X": "nwnnwnnnw", "Y": "wwnnwnnnn",
    "Z": "nwwnwnnnn", "-": "nwnnnnwnw", ".": "wwnnnnwnn", " ": "nwwnnnwnn", "$": "nwnwnwnnn",
    "/": "nwnwnnnwn", "+": "nwnnnwnwn", "%": "nnnwnwnwn", "*": "nwnnwnwnn",
  };
  function makeBarcodeSVG(text) {
    const data = ("" + (text || "")).toUpperCase().replace(/[^0-9A-Z\-. $/+%]/g, "") || "0";
    const seq = "*" + data + "*";
    const N = 2, W = 5, H = 42, gap = 2;
    let x = 0; const rects = [];
    for (const ch of seq) {
      const pat = CODE39[ch]; if (!pat) continue;
      for (let i = 0; i < 9; i++) {
        const w = pat[i] === "w" ? W : N;
        if (i % 2 === 0) rects.push(`<rect x="${x}" y="0" width="${w}" height="${H}"/>`);
        x += w;
      }
      x += gap;
    }
    return `<svg viewBox="0 0 ${x} ${H}" width="${x}" height="${H}" fill="#111" style="max-width:100%;height:44px" xmlns="http://www.w3.org/2000/svg">${rects.join("")}</svg>`
      + `<div class="rc-barcode-num">${escapeHtml(data)}</div>`;
  }

  let lastReceipt = JSON.parse(localStorage.getItem("arcade.lastReceipt") || "null");
  function populateReceipt(r) {
    $("#rcStore").textContent = settings.receiptName || "ARCADE";
    $("#rcPrize").textContent = r.prize;
    $("#rcHolder").textContent = r.holder;
    $("#rcCard").textContent = r.cardUid;
    $("#rcCost").textContent = r.cost;
    $("#rcNum").textContent = r.claim;
    $("#rcDate").textContent = r.date;
    $("#rcBarcode").innerHTML = makeBarcodeSVG(r.claim);
  }
  function showReceipt(item, holder, cardUid, claim) {
    const r = { prize: item.name, holder, cardUid, cost: `${item.cost} ${item.currency}`, claim, date: new Date().toLocaleString() };
    lastReceipt = r;
    try { localStorage.setItem("arcade.lastReceipt", JSON.stringify(r)); } catch (_) {}
    populateReceipt(r);
    $("#receiptBackdrop").classList.remove("hidden");
    if (settings.autoPrint) setTimeout(() => window.print(), 300);
  }
  function reprintLast() {
    if (!lastReceipt) { toast("No receipt yet", "error"); return; }
    populateReceipt(lastReceipt);
    $("#receiptBackdrop").classList.remove("hidden");
    setTimeout(() => window.print(), 300);
  }

  // ---------------------------------------------------------------
  // Merge flow
  // ---------------------------------------------------------------
  let mergeAwaiting = false, mergeA = null, mergeB = null, mergeDest = null;

  function openMerge() {
    if (!activeCard) { toast("Load a card first", "error"); return; }
    mergeA = activeCard; mergeB = null; mergeDest = null; mergeAwaiting = true;
    $("#mergeStepTap").classList.remove("hidden");
    $("#mergeStepConfig").classList.add("hidden");
    $("#mergeConfirmBtn").classList.add("hidden");
    $("#mergeWaitText").textContent = "Waiting for a tap…";
    $("#mergeUid").value = "";
    $("#mergeBackdrop").classList.remove("hidden");
  }
  function closeMerge() { mergeAwaiting = false; $("#mergeBackdrop").classList.add("hidden"); }

  async function mergeSecondCard(uid) {
    uid = (uid || "").trim();
    if (!uid) return;
    if (uid === mergeA.uid) { toast("That's the same card", "error"); return; }
    let card;
    try { card = await store.getCard(uid); }
    catch (_) { toast(`Card ${uid} isn't registered`, "error"); $("#mergeWaitText").textContent = `Card ${uid} not found — try another.`; return; }
    mergeAwaiting = false;
    mergeB = card;
    mergeDest = mergeA.uid; // default: keep on the originally-active card
    $("#mergeStepTap").classList.add("hidden");
    $("#mergeStepConfig").classList.remove("hidden");
    $("#mergeConfirmBtn").classList.remove("hidden");
    renderMergeConfig();
  }

  function mergeCardHtml(card) {
    return `<div class="mc-uid">${escapeHtml(card.uid)}</div>
      <div class="mc-name">${escapeHtml(card.name || "(no name)")}</div>
      <div class="mc-bal">${card.credits} credits · ${card.tickets} tickets</div>`;
  }
  function renderMergeConfig() {
    const a = $("#mergeCardA"), b = $("#mergeCardB");
    a.innerHTML = mergeCardHtml(mergeA); b.innerHTML = mergeCardHtml(mergeB);
    a.classList.toggle("dest", mergeDest === mergeA.uid);
    b.classList.toggle("dest", mergeDest === mergeB.uid);
    $("#destChoice").innerHTML = "";
    [mergeA, mergeB].forEach((c) => {
      const btn = document.createElement("button");
      btn.className = "dest-btn" + (mergeDest === c.uid ? " active" : "");
      btn.textContent = c.name ? c.name : c.uid;
      btn.addEventListener("click", () => { mergeDest = c.uid; renderMergeConfig(); });
      $("#destChoice").appendChild(btn);
    });
    updateMergePreview();
  }
  function updateMergePreview() {
    const doC = $("#mergeCredits").checked, doT = $("#mergeTickets").checked;
    const dest = mergeDest === mergeA.uid ? mergeA : mergeB;
    const src = mergeDest === mergeA.uid ? mergeB : mergeA;
    const c = (doC ? dest.credits + src.credits : dest.credits);
    const t = (doT ? dest.tickets + src.tickets : dest.tickets);
    const which = [doC && "credits", doT && "tickets"].filter(Boolean).join(" and ") || "nothing";
    $("#mergePreview").innerHTML =
      `Move <strong>${which}</strong> from <strong>${escapeHtml(src.name || src.uid)}</strong> onto ` +
      `<strong>${escapeHtml(dest.name || dest.uid)}</strong>.<br>` +
      `Result on ${escapeHtml(dest.name || dest.uid)}: <strong>${c} credits · ${t} tickets</strong>.`;
  }
  async function doMerge() {
    const doC = $("#mergeCredits").checked, doT = $("#mergeTickets").checked;
    if (!doC && !doT) { toast("Pick credits, tickets, or both", "error"); return; }
    const dest = mergeDest, source = mergeDest === mergeA.uid ? mergeB.uid : mergeA.uid;
    try {
      const res = await store.merge({ source, dest, credits: doC, tickets: doT });
      closeMerge();
      loadCard(res.dest);
      if (bodyIsAdvanced()) { refreshCards(); refreshLog(); }
      toast("Cards merged", "success");
    } catch (e) { toast("Merge failed: " + e.message, "error"); }
  }

  // ---------------------------------------------------------------
  // Transfer flow (move a specific amount to another card)
  // ---------------------------------------------------------------
  let transferAwaiting = false, transferFrom = null, transferTo = null;
  function openTransfer(source) {
    const src = source || activeCard;
    if (!src) { toast("Load a card first", "error"); return; }
    transferFrom = src; transferTo = null; transferAwaiting = true;
    $("#transferStepTap").classList.remove("hidden");
    $("#transferStepConfig").classList.add("hidden");
    $("#transferConfirmBtn").classList.add("hidden");
    $("#transferWaitText").textContent = "Waiting for a tap…";
    $("#transferUid").value = "";
    $("#transferBackdrop").classList.remove("hidden");
  }
  function closeTransfer() { transferAwaiting = false; $("#transferBackdrop").classList.add("hidden"); }
  async function transferSecondCard(uid) {
    uid = (uid || "").trim();
    if (!uid) return;
    if (uid === transferFrom.uid) { toast("That's the same card", "error"); return; }
    let card;
    try { card = await store.getCard(uid); }
    catch (_) { $("#transferWaitText").textContent = `Card ${uid} not found — try another.`; toast(`Card ${uid} isn't registered`, "error"); return; }
    transferAwaiting = false; transferTo = card;
    $("#transferStepTap").classList.add("hidden");
    $("#transferStepConfig").classList.remove("hidden");
    $("#transferConfirmBtn").classList.remove("hidden");
    $("#transferFrom").innerHTML = mergeCardHtml(transferFrom);
    $("#transferTo").innerHTML = mergeCardHtml(transferTo);
    updateTransferPreview();
  }
  function updateTransferPreview() {
    const kind = $("#transferKind").value;
    const amt = Math.abs(parseInt($("#transferAmount").value, 10) || 0);
    const have = transferFrom[kind];
    $("#transferPreview").innerHTML = amt
      ? `Send <strong>${amt} ${kind}</strong> from <strong>${escapeHtml(transferFrom.name || transferFrom.uid)}</strong> ` +
        `(has ${have}) to <strong>${escapeHtml(transferTo.name || transferTo.uid)}</strong>.`
      : "Enter an amount to send.";
  }
  async function doTransfer() {
    const kind = $("#transferKind").value;
    const amt = Math.abs(parseInt($("#transferAmount").value, 10) || 0);
    if (!amt) { toast("Enter an amount", "error"); return; }
    if (transferFrom[kind] < amt) { toast(`Not enough ${kind} to send`, "error"); return; }
    const dk = kind === "credits" ? "credits_delta" : "tickets_delta";
    try {
      await store.updateCard(transferFrom.uid, { [dk]: -amt, reason: `transfer to ${transferTo.uid}` });
      try {
        await store.updateCard(transferTo.uid, { [dk]: amt, reason: `transfer from ${transferFrom.uid}` });
      } catch (e2) {
        // roll back the source if the destination couldn't receive it
        await store.updateCard(transferFrom.uid, { [dk]: amt, reason: "transfer rollback" });
        throw e2;
      }
      closeTransfer();
      loadCard(await store.getCard(transferFrom.uid)); syncToCard();
      if (bodyIsAdvanced()) { refreshCards(); refreshLog(); }
      toast(`Sent ${amt} ${kind}`, "success");
    } catch (e) {
      const m = { staff_no_tickets: "Staff cards can't receive tickets", card_blocked: "That card is frozen, lost, or expired" }[e.message] || "Transfer failed";
      toast(m, "error");
    }
  }

  // ---------------------------------------------------------------
  // Item form / new card modal
  // ---------------------------------------------------------------
  function editItem(item) {
    $("#itemId").value = item.id; $("#itemName").value = item.name; $("#itemCost").value = item.cost;
    $("#itemCurrency").value = item.currency; $("#itemStock").value = item.stock; $("#itemCategory").value = item.category || "";
    switchTab("items"); $("#itemName").focus();
  }
  function resetItemForm() { $("#itemId").value = ""; $("#itemName").value = ""; $("#itemCost").value = 100; $("#itemCurrency").value = "tickets"; $("#itemStock").value = -1; $("#itemCategory").value = ""; }

  function openNewCardModal(uid) {
    $("#newUid").value = uid || ""; $("#newName").value = ""; $("#newCredits").value = 0; $("#newTickets").value = 0; $("#newStaff").checked = false;
    $("#newCardScanHint").textContent = uid ? `Card ${uid} detected.` : "Waiting for a tap… or type the ID manually.";
    $("#modalBackdrop").classList.remove("hidden"); $("#newName").focus();
  }
  function closeNewCardModal() { $("#modalBackdrop").classList.add("hidden"); }

  // ---------------------------------------------------------------
  // Mode + tabs
  // ---------------------------------------------------------------
  function bodyIsAdvanced() { return document.body.classList.contains("advanced"); }
  function setMode(mode) {
    settings.mode = mode; saveSettings();
    document.body.classList.toggle("advanced", mode === "advanced");
    $("#modeSimple").classList.toggle("active", mode === "simple");
    $("#modeAdvanced").classList.toggle("active", mode === "advanced");
    if (mode === "simple") switchTab("prizes"); else refreshLog();
  }
  function switchTab(name) {
    $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
    $$(".tab-panel").forEach((p) => p.classList.toggle("active", p.id === "tab-" + name));
    if (name === "cards") refreshCards();
    if (name === "log") refreshLog();
    if (name === "dash") renderDashboard();
  }

  // ---------------------------------------------------------------
  // 4-digit PIN lock
  // ---------------------------------------------------------------
  const PIN_KEY = "arcade.pin";
  let pinMode = "unlock", pinTemp = "", pinChanging = false;
  const pinBoxes = () => $$(".pin-box");

  async function hashPin(pin) {
    try {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("arcade-pin::" + pin));
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch (_) {
      let h = 5381; const s = "arcade-pin::" + pin;
      for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
      return "fb" + (h >>> 0).toString(16);
    }
  }
  const hasPin = () => !!localStorage.getItem(PIN_KEY);

  // Manager PIN — gates the destructive admin actions.
  const MANAGER_KEY = "arcade.manager";
  async function requireManager() {
    const stored = localStorage.getItem(MANAGER_KEY);
    if (!stored) return true; // no manager PIN configured
    const pin = window.prompt("Manager PIN required for this action:");
    if (pin === null) return false;
    return (await hashPin(pin)) === stored;
  }
  async function setManagerPin() {
    const a = window.prompt("Enter a new 4-digit manager PIN:");
    if (a === null) return;
    if (!/^\d{4}$/.test(a)) { toast("Manager PIN must be 4 digits", "error"); return; }
    if (window.prompt("Confirm the manager PIN:") !== a) { toast("PINs didn't match", "error"); return; }
    localStorage.setItem(MANAGER_KEY, await hashPin(a)); toast("Manager PIN set", "success");
  }
  async function clearManagerPin() {
    if (!localStorage.getItem(MANAGER_KEY)) { toast("No manager PIN set"); return; }
    if (!(await requireManager())) { toast("Wrong manager PIN", "error"); return; }
    localStorage.removeItem(MANAGER_KEY); toast("Manager PIN removed", "success");
  }

  function clearPinBoxes() { pinBoxes().forEach((b) => { b.value = ""; b.classList.remove("filled", "err"); }); }
  function focusFirstPin() { setTimeout(() => { const b = pinBoxes()[0]; if (b) b.focus(); }, 60); }
  function readPin() { return pinBoxes().map((b) => b.value).join(""); }

  function showLock(mode) {
    pinMode = mode;
    document.body.classList.add("locked");
    const s = $("#lockScreen"); s.style.display = "flex"; s.classList.remove("hidden");
    $("#lockError").textContent = " ";
    clearPinBoxes();
    if (mode === "create") { $("#lockTitle").textContent = pinChanging ? "Set a new PIN" : "Create a PIN"; $("#lockSub").textContent = "Choose a 4-digit PIN"; }
    else if (mode === "confirm") { $("#lockTitle").textContent = "Confirm your PIN"; $("#lockSub").textContent = "Re-enter the same 4 digits"; }
    else { $("#lockTitle").textContent = "Arcade Card Manager"; $("#lockSub").textContent = "Enter your PIN"; }
    $("#pinForgot").style.display = mode === "unlock" ? "" : "none";
    focusFirstPin();
  }
  function hideLock() { document.body.classList.remove("locked"); $("#lockScreen").style.display = "none"; }
  function pinErr(msg) { $("#lockError").textContent = msg; pinBoxes().forEach((b) => b.classList.add("err")); setTimeout(() => { clearPinBoxes(); focusFirstPin(); }, 500); }

  async function onPinComplete(pin) {
    if (pinMode === "create") { pinTemp = pin; showLock("confirm"); return; }
    if (pinMode === "confirm") {
      if (pin !== pinTemp) { pinTemp = ""; $("#lockError").textContent = "PINs didn't match — start again."; setTimeout(() => showLock("create"), 700); return; }
      localStorage.setItem(PIN_KEY, await hashPin(pin)); pinTemp = "";
      const wasChanging = pinChanging; pinChanging = false; hideLock();
      if (!appStarted) startApp(); else if (wasChanging) toast("PIN updated", "success");
      return;
    }
    // unlock
    if ((await hashPin(pin)) === localStorage.getItem(PIN_KEY)) { hideLock(); if (!appStarted) startApp(); }
    else pinErr("Wrong PIN");
  }

  function wirePinInputs() {
    const boxes = pinBoxes();
    boxes.forEach((box, i) => {
      box.addEventListener("input", () => {
        box.value = box.value.replace(/\D/g, "").slice(0, 1);
        box.classList.toggle("filled", !!box.value);
        if (box.value && i < boxes.length - 1) boxes[i + 1].focus();
        const pin = readPin();
        if (pin.length === 4 && boxes.every((b) => b.value)) onPinComplete(pin);
      });
      box.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" && !box.value && i > 0) { boxes[i - 1].focus(); boxes[i - 1].value = ""; boxes[i - 1].classList.remove("filled"); e.preventDefault(); }
      });
      box.addEventListener("paste", (e) => {
        const txt = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 4);
        if (!txt) return; e.preventDefault();
        boxes.forEach((b, j) => { b.value = txt[j] || ""; b.classList.toggle("filled", !!b.value); });
        if (txt.length === 4) onPinComplete(txt);
      });
    });
  }

  // ---------------------------------------------------------------
  // Toast + escaping
  // ---------------------------------------------------------------
  function toast(msg, type = "") {
    const el = document.createElement("div");
    el.className = "toast " + type;
    el.innerHTML = (type === "success" ? svgUse("check") : "") + `<span>${escapeHtml(msg)}</span>`;
    $("#toastWrap").appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; el.style.transition = ".3s"; }, 2200);
    setTimeout(() => el.remove(), 2600);
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function escapeAttr(s) { return escapeHtml(s); }

  // ---------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------
  function init() {
    setMode(settings.mode || "simple");
    $("#modeSimple").addEventListener("click", () => setMode("simple"));
    $("#modeAdvanced").addEventListener("click", () => setMode("advanced"));
    $$(".tab").forEach((t) => t.addEventListener("click", () => switchTab(t.dataset.tab)));

    $$(".qa-buttons").forEach((group) => {
      const kind = group.dataset.kind;
      group.querySelectorAll(".chip").forEach((chip) => chip.addEventListener("click", () => adjust(kind, parseInt(chip.dataset.delta, 10), "quick action")));
    });
    $("#customAddBtn").addEventListener("click", () => { const a = Math.abs(parseInt($("#customAmount").value, 10) || 0); if (a) adjust($("#customKind").value, a, "manual add"); });
    $("#customRemoveBtn").addEventListener("click", () => { const a = Math.abs(parseInt($("#customAmount").value, 10) || 0); if (a) adjust($("#customKind").value, -a, "manual remove"); });

    $("#saveNameBtn").addEventListener("click", async () => { if (!activeCard) return; const c = await store.updateCard(activeCard.uid, { name: $("#cardName").value }); loadCard(c); refreshCards(); toast("Name saved", "success"); });
    $("#switchCardBtn").addEventListener("click", unloadCard);
    $("#deleteCardBtn").addEventListener("click", async () => {
      if (!activeCard) return;
      if (!(await requireManager())) { toast("Manager PIN required", "error"); return; }
      if (!confirm(`Delete card ${activeCard.uid}?`)) return;
      await store.deleteCard(activeCard.uid); unloadCard(); refreshCards(); toast("Card deleted");
    });

    $("#manualScanBtn").addEventListener("click", () => onTap($("#manualUid").value));
    $("#manualUid").addEventListener("keydown", (e) => { if (e.key === "Enter") onTap($("#manualUid").value); });
    $("#newCardBtn").addEventListener("click", () => openNewCardModal(""));

    // Advanced card tools
    $("#setBalanceBtn").addEventListener("click", setExactBalance);
    $("#convCtoT").addEventListener("click", () => convert("c2t"));
    $("#convTtoC").addEventListener("click", () => convert("t2c"));
    $$("#statusSeg .seg-btn").forEach((btn) => btn.addEventListener("click", () => setStatus(btn.dataset.status)));
    $("#saveMetaBtn").addEventListener("click", saveMeta);

    // Bulk freeze + manager PIN
    $("#bulkFreezeBtn").addEventListener("click", () => bulkFreeze(true));
    $("#bulkUnfreezeBtn").addEventListener("click", () => bulkFreeze(false));
    $("#setManagerBtn").addEventListener("click", setManagerPin);
    $("#clearManagerBtn").addEventListener("click", clearManagerPin);
    $("#operatorName").value = settings.operator || "";
    $("#operatorName").addEventListener("input", () => { settings.operator = $("#operatorName").value; saveSettings(); });

    // Prize search + category
    $("#prizeSearch").addEventListener("input", renderPrizes);
    $("#prizeCategory").addEventListener("change", renderPrizes);

    // CSV export
    $("#csvBtn").addEventListener("click", exportCsv);

    // Undo last + bulk actions
    $("#undoLastBtn").addEventListener("click", undoLast);
    $("#bulkAddBtn").addEventListener("click", () => bulkAdjust(1));
    $("#bulkRemoveBtn").addEventListener("click", () => bulkAdjust(-1));

    // Leaderboard + live stats big screens
    $("#leaderboardBtn").addEventListener("click", openLeaderboard);
    $("#closeLeaderboard").addEventListener("click", closeLeaderboard);
    $("#statsBtn").addEventListener("click", openStats);
    $("#closeStats").addEventListener("click", closeStats);
    $("#customerBtn").addEventListener("click", openCustomer);
    $("#closeCustomer").addEventListener("click", closeCustomer);

    // Game station
    $("#stationName").value = settings.stationName || "";
    $("#stationCost").value = settings.stationCost;
    $("#stationReward").value = settings.stationReward;
    $("#stationName").addEventListener("input", () => { settings.stationName = $("#stationName").value; saveSettings(); if (stationOpen()) stationIdle(); });
    $("#stationCost").addEventListener("input", () => { settings.stationCost = parseInt($("#stationCost").value, 10) || 0; saveSettings(); if (stationOpen()) stationIdle(); });
    $("#stationReward").addEventListener("input", () => { settings.stationReward = parseInt($("#stationReward").value, 10) || 0; saveSettings(); });
    $("#openStationBtn").addEventListener("click", () => { $("#settingsDrawer").classList.add("hidden"); $("#drawerBackdrop").classList.add("hidden"); openStation(); });
    $("#closeStation").addEventListener("click", closeStation);

    // Prize claim receipt
    $("#rcClose").addEventListener("click", () => $("#receiptBackdrop").classList.add("hidden"));
    $("#rcPrint").addEventListener("click", () => window.print());
    $("#receiptBackdrop").addEventListener("click", (e) => { if (e.target.id === "receiptBackdrop") $("#receiptBackdrop").classList.add("hidden"); });

    // Card profile & history
    $("#profileBtn").addEventListener("click", openProfile);
    $("#pfClose").addEventListener("click", closeProfile);
    $("#profileBackdrop").addEventListener("click", (e) => { if (e.target.id === "profileBackdrop") closeProfile(); });

    // On-card data (NFC)
    $("#writeCardBtn").addEventListener("click", () => writeToCard(false));
    $("#readCardBtn").addEventListener("click", readFromCard);
    $("#nfcAutoWrite").checked = !!settings.nfcWrite;
    $("#nfcAutoWrite").addEventListener("change", () => { settings.nfcWrite = $("#nfcAutoWrite").checked; saveSettings(); });

    // Receipt printing
    $("#receiptName").value = settings.receiptName || "ARCADE";
    $("#receiptWidth").value = settings.receiptWidth || "80";
    $("#receiptName").addEventListener("input", () => { settings.receiptName = $("#receiptName").value; saveSettings(); });
    $("#receiptWidth").addEventListener("change", () => { settings.receiptWidth = $("#receiptWidth").value; saveSettings(); applyReceiptWidth(); });
    $("#autoPrint").checked = !!settings.autoPrint;
    $("#autoPrint").addEventListener("change", () => { settings.autoPrint = $("#autoPrint").checked; saveSettings(); });
    $("#reprintBtn").addEventListener("click", reprintLast);

    // Appearance + kiosk
    $("#themeToggle").addEventListener("click", toggleTheme);
    $("#accentColor").addEventListener("input", () => { settings.accent = $("#accentColor").value; saveSettings(); applyTheme(); });
    $("#fullscreenBtn").addEventListener("click", toggleFullscreen);
    $("#soundToggle").addEventListener("change", () => { settings.sound = $("#soundToggle").checked; saveSettings(); if (settings.sound) beep(720); });
    $("#autolockSelect").addEventListener("change", () => { settings.autolockSec = parseInt($("#autolockSelect").value, 10) || 0; saveSettings(); resetIdle(); });

    // Dashboard admin tools
    $("#exportBtn").addEventListener("click", exportBackup);
    $("#importBtn").addEventListener("click", () => $("#importFile").click());
    $("#importFile").addEventListener("change", (e) => { importBackup(e.target.files[0]); e.target.value = ""; });
    $("#batchBtn").addEventListener("click", batchCreate);
    $("#zeroAllBtn").addEventListener("click", zeroAll);
    $("#wipeAllBtn").addEventListener("click", wipeAll);

    // Exchange rate
    const applyRate = () => { $("#rateLabel").textContent = settings.exchangeRate; $("#rateInput").value = settings.exchangeRate; };
    applyRate();
    $("#rateInput").addEventListener("change", () => { settings.exchangeRate = parseFloat($("#rateInput").value) || 1; saveSettings(); applyRate(); });

    // Merge
    $("#mergeBtn").addEventListener("click", openMerge);
    $("#mergeCancelBtn").addEventListener("click", closeMerge);
    $("#mergeConfirmBtn").addEventListener("click", doMerge);
    $("#mergeUidBtn").addEventListener("click", () => mergeSecondCard($("#mergeUid").value));
    $("#mergeUid").addEventListener("keydown", (e) => { if (e.key === "Enter") mergeSecondCard($("#mergeUid").value); });
    $("#mergeCredits").addEventListener("change", updateMergePreview);
    $("#mergeTickets").addEventListener("change", updateMergePreview);
    $("#mergeBackdrop").addEventListener("click", (e) => { if (e.target.id === "mergeBackdrop") closeMerge(); });

    // Transfer
    $("#transferBtn").addEventListener("click", openTransfer);
    $("#transferCancelBtn").addEventListener("click", closeTransfer);
    $("#transferConfirmBtn").addEventListener("click", doTransfer);
    $("#transferUidBtn").addEventListener("click", () => transferSecondCard($("#transferUid").value));
    $("#transferUid").addEventListener("keydown", (e) => { if (e.key === "Enter") transferSecondCard($("#transferUid").value); });
    $("#transferKind").addEventListener("change", updateTransferPreview);
    $("#transferAmount").addEventListener("input", updateTransferPreview);
    $("#transferBackdrop").addEventListener("click", (e) => { if (e.target.id === "transferBackdrop") closeTransfer(); });

    // Item form
    $("#itemForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = { name: $("#itemName").value, cost: parseInt($("#itemCost").value, 10) || 0, currency: $("#itemCurrency").value, stock: parseInt($("#itemStock").value, 10), category: $("#itemCategory").value };
      try {
        const id = $("#itemId").value;
        if (id) await store.updateItem(parseInt(id, 10), payload); else await store.createItem(payload);
        resetItemForm(); refreshItems(); toast("Item saved", "success");
      } catch (err) { toast("Save failed: " + err.message, "error"); }
    });
    $("#itemResetBtn").addEventListener("click", resetItemForm);
    $("#cardSearch").addEventListener("input", refreshCards);

    // New-card modal
    $("#createCardBtn").addEventListener("click", async () => {
      try {
        const role = $("#newStaff").checked ? "staff" : "customer";
        const card = await store.createCard({ uid: $("#newUid").value, name: $("#newName").value, credits: parseInt($("#newCredits").value, 10) || 0, tickets: parseInt($("#newTickets").value, 10) || 0, role });
        closeNewCardModal(); loadCard(card); syncToCard(); refreshCards();
        toast(role === "staff" ? "Staff card created" : "Card created", "success");
      } catch (err) { toast(err.message === "exists" ? "Card already exists" : err.message === "uid_required" ? "Enter a card ID" : "Create failed", "error"); }
    });
    $("#cancelCardBtn").addEventListener("click", closeNewCardModal);
    $("#modalBackdrop").addEventListener("click", (e) => { if (e.target.id === "modalBackdrop") closeNewCardModal(); });

    // Settings drawer
    const openDrawer = () => { $("#backendUrl").value = settings.backendUrl; $$("input[name=rfidMode]").forEach((r) => (r.checked = r.value === settings.rfidMode)); $("#settingsDrawer").classList.remove("hidden"); $("#drawerBackdrop").classList.remove("hidden"); };
    const closeDrawer = () => { $("#settingsDrawer").classList.add("hidden"); $("#drawerBackdrop").classList.add("hidden"); };
    $("#settingsBtn").addEventListener("click", openDrawer);
    $("#closeDrawer").addEventListener("click", closeDrawer);
    $("#drawerBackdrop").addEventListener("click", closeDrawer);
    $("#reconnectBtn").addEventListener("click", async () => {
      settings.backendUrl = $("#backendUrl").value.trim();
      settings.rfidMode = ($$("input[name=rfidMode]:checked")[0] || {}).value || "backend";
      saveSettings(); await connect();
      toast(store.name === "backend" ? "Connected to cloud" : "Running in local mode", store.name === "backend" ? "success" : "");
    });
    $$("input[name=rfidMode]").forEach((r) => r.addEventListener("change", () => { settings.rfidMode = r.value; saveSettings(); }));
    $("#simBtn").addEventListener("click", async () => { const uid = $("#simUid").value.trim() || "04A1B2C3"; try { await store.simulate(uid); } catch (_) { onTap(uid); } });
    $("#resetLocalBtn").addEventListener("click", () => { if (!confirm("Clear all locally-stored cards and items?")) return; localStorage.removeItem("arcade.data"); location.reload(); });

    // PIN lock
    wirePinInputs();
    $("#lockNowBtn").addEventListener("click", () => { closeDrawer(); showLock("unlock"); });
    $("#changePassBtn").addEventListener("click", () => { closeDrawer(); pinChanging = true; showLock("create"); });
    $("#pinForgot").addEventListener("click", () => { if (!confirm("Reset the PIN? You'll choose a new one now.")) return; localStorage.removeItem(PIN_KEY); pinChanging = false; showLock("create"); });

    // Apply saved appearance + kiosk settings to controls
    applyTheme();
    applyReceiptWidth();
    $("#accentColor").value = settings.accent;
    $("#soundToggle").checked = !!settings.sound;
    $("#autolockSelect").value = String(settings.autolockSec || 0);

    // Global hotkeys (ignored while typing or locked)
    document.addEventListener("keydown", (e) => {
      if (document.body.classList.contains("locked")) return;
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "select" || tag === "textarea") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "l") { e.preventDefault(); showLock("unlock"); }
      else if (k === "f") { e.preventDefault(); toggleFullscreen(); }
      else if (k === "n") { e.preventDefault(); openNewCardModal(""); }
      else if (k === "a") { e.preventDefault(); setMode(bodyIsAdvanced() ? "simple" : "advanced"); }
      else if (k === "/") { e.preventDefault(); const s = $("#prizeSearch"); if (s) { switchTab("prizes"); s.focus(); } }
      else if (k === "b") { e.preventDefault(); if ($("#leaderboardScreen").classList.contains("hidden")) openLeaderboard(); else closeLeaderboard(); }
      else if (k === "s" && bodyIsAdvanced()) { e.preventDefault(); if ($("#statsScreen").classList.contains("hidden")) openStats(); else closeStats(); }
      else if (k === "c") { e.preventDefault(); if (customerOpen()) closeCustomer(); else openCustomer(); }
      else if (k === "g") { e.preventDefault(); if (stationOpen()) closeStation(); else openStation(); }
      else if (e.key === "Escape") {
        if (!$("#leaderboardScreen").classList.contains("hidden")) closeLeaderboard();
        if (!$("#statsScreen").classList.contains("hidden")) closeStats();
        if (customerOpen()) closeCustomer();
        if (stationOpen()) closeStation();
      }
    });

    // Auto-lock idle tracking
    ["mousemove", "keydown", "touchstart", "click"].forEach((ev) =>
      document.addEventListener(ev, resetIdle, { passive: true }));

    // Show lock; app starts once unlocked / PIN created.
    showLock(hasPin() ? "unlock" : "create");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
