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

  // ---------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------
  const SETTINGS_KEY = "arcade.settings";
  const settings = Object.assign(
    { backendUrl: "", rfidMode: "backend", mode: "simple" },
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
      const res = await fetch(this.base + path, { headers: { "Content-Type": "application/json" }, ...opts });
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
    listTransactions(uid) { return this._req(`/api/transactions${uid ? `?uid=${encodeURIComponent(uid)}` : ""}`); }
    simulate(uid) { return this._req("/api/scan/simulate", { method: "POST", body: JSON.stringify({ uid }) }); }
  }

  class LocalStore {
    constructor() {
      this.name = "local";
      this.KEY = "arcade.data";
      this.data = JSON.parse(localStorage.getItem(this.KEY) || "null") || { cards: {}, items: [], tx: [], nextItemId: 1 };
      if (this.data.items.length === 0) {
        [["Candy Bar", 25, "tickets", -1], ["Rubber Duck", 50, "tickets", -1],
         ["Plush Bear", 500, "tickets", 10], ["Game Console", 25000, "tickets", 2]]
          .forEach(([name, cost, currency, stock]) =>
            this.data.items.push({ id: this.data.nextItemId++, name, cost, currency, stock }));
        this._save();
      }
    }
    _save() { localStorage.setItem(this.KEY, JSON.stringify(this.data)); }
    _log(uid, kind, detail, cd = 0, td = 0) {
      this.data.tx.unshift({ id: Date.now() + Math.random(), uid, kind, detail: detail || "", credits_d: cd, tickets_d: td, ts: Date.now() / 1000 });
      this.data.tx = this.data.tx.slice(0, 300);
    }
    async health() { return { ok: true, reader: "local" }; }
    async listCards() { return Object.values(this.data.cards).sort((a, b) => b.updated_at - a.updated_at); }
    async getCard(uid) { const c = this.data.cards[uid]; if (!c) throw new Error("not_found"); return c; }
    async createCard(c) {
      const uid = (c.uid || "").trim();
      if (!uid) throw new Error("uid_required");
      if (this.data.cards[uid]) throw new Error("exists");
      const now = Date.now() / 1000;
      const card = { uid, name: c.name || "", credits: +c.credits || 0, tickets: +c.tickets || 0, created_at: now, updated_at: now };
      this.data.cards[uid] = card; this._log(uid, "create_card", c.name); this._save(); return card;
    }
    async updateCard(uid, patch) {
      const c = this.data.cards[uid];
      if (!c) throw new Error("not_found");
      const cd = +patch.credits_delta || 0, td = +patch.tickets_delta || 0;
      if (c.credits + cd < 0 || c.tickets + td < 0) throw new Error("insufficient_balance");
      c.credits += cd; c.tickets += td;
      if (patch.name !== undefined) c.name = patch.name;
      c.updated_at = Date.now() / 1000;
      if (cd || td) this._log(uid, cd > 0 || td > 0 ? "add" : "remove", patch.reason, cd, td);
      this._save(); return c;
    }
    async deleteCard(uid) { delete this.data.cards[uid]; this._log(uid, "delete_card"); this._save(); return { ok: true }; }
    async listItems() { return [...this.data.items].sort((a, b) => a.cost - b.cost); }
    async createItem(i) {
      if (!(i.name || "").trim()) throw new Error("name_required");
      const item = { id: this.data.nextItemId++, name: i.name, cost: +i.cost || 0, currency: i.currency || "tickets", stock: i.stock === undefined ? -1 : +i.stock };
      this.data.items.push(item); this._save(); return item;
    }
    async updateItem(id, patch) {
      const item = this.data.items.find((x) => x.id === id);
      if (!item) throw new Error("not_found");
      Object.assign(item, { name: patch.name ?? item.name, cost: patch.cost === undefined ? item.cost : +patch.cost,
        currency: patch.currency ?? item.currency, stock: patch.stock === undefined ? item.stock : +patch.stock });
      this._save(); return item;
    }
    async deleteItem(id) { this.data.items = this.data.items.filter((x) => x.id !== id); this._save(); return { ok: true }; }
    async redeem(uid, itemId) {
      const c = this.data.cards[uid], item = this.data.items.find((x) => x.id === itemId);
      if (!c) throw new Error("card_not_found");
      if (!item) throw new Error("item_not_found");
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
    async listTransactions(uid) { return this.data.tx.filter((t) => !uid || t.uid === uid).slice(0, 50); }
    async simulate(uid) { onTap(uid); return { ok: true }; }
  }

  let store = null, activeCard = null, items = [], sse = null, appStarted = false;
  function startApp() { appStarted = true; connect(); }

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
    // Merge flow is waiting for the second card?
    if (mergeAwaiting) { mergeSecondCard(uid); return; }
    // New-card modal open? fill its UID.
    if (!$("#modalBackdrop").classList.contains("hidden")) {
      $("#newUid").value = uid;
      $("#newCardScanHint").textContent = `Card ${uid} detected — press Create.`;
      return;
    }
    try { const card = await store.getCard(uid); loadCard(card); toast(`Card ${uid} loaded`, "success"); }
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
    $("#balCredits").textContent = card.credits;
    $("#balTickets").textContent = card.tickets;
    renderPrizes();
    if (bodyIsAdvanced()) refreshLog();
  }
  function unloadCard() { activeCard = null; $("#activeCard").classList.add("hidden"); $("#scanHint").classList.remove("hidden"); renderPrizes(); }

  async function refreshAll() {
    await Promise.all([refreshItems(), refreshCards()]);
    if (activeCard) { try { loadCard(await store.getCard(activeCard.uid)); } catch (_) { unloadCard(); } }
    if (bodyIsAdvanced()) refreshLog();
  }
  async function refreshItems() { items = await store.listItems(); renderPrizes(); renderItemList(); }

  function renderPrizes() {
    const grid = $("#prizeGrid"); grid.innerHTML = "";
    if (items.length === 0) { grid.innerHTML = `<p class="panel-hint">No items yet. Add some in the Items tab.</p>`; return; }
    items.forEach((item) => {
      const affordable = activeCard && item.stock !== 0 && activeCard[item.currency] >= item.cost;
      const div = document.createElement("div");
      div.className = "prize" + (activeCard && !affordable ? " disabled" : "");
      div.innerHTML = `
        <div class="prize-badge" style="${badgeStyle(item.name)}">${escapeHtml(monogram(item.name))}</div>
        <div class="prize-name">${escapeHtml(item.name)}</div>
        <div class="prize-cost ${item.currency}">${item.cost} ${item.currency}</div>
        <div class="prize-stock">${item.stock < 0 ? "In stock" : item.stock + " left"}</div>`;
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
          <button class="mini-btn" data-edit="${item.id}">${svgUse("edit")} Edit</button>
          <button class="mini-btn danger" data-del="${item.id}">${svgUse("trash")}</button>
        </div>`;
      row.querySelector("[data-edit]").addEventListener("click", () => editItem(item));
      row.querySelector("[data-del]").addEventListener("click", async () => {
        if (!confirm(`Delete "${item.name}"?`)) return;
        await store.deleteItem(item.id); toast("Item deleted"); refreshItems();
      });
      list.appendChild(row);
    });
  }

  async function refreshCards() {
    const cards = await store.listCards();
    const term = ($("#cardSearch").value || "").toLowerCase();
    const list = $("#cardList"); list.innerHTML = "";
    const filtered = cards.filter((c) => c.uid.toLowerCase().includes(term) || (c.name || "").toLowerCase().includes(term));
    if (filtered.length === 0) { list.innerHTML = `<p class="panel-hint">No cards ${term ? "match" : "registered yet"}.</p>`; return; }
    filtered.forEach((c) => {
      const row = document.createElement("div");
      row.className = "row-item";
      row.innerHTML = `
        <span class="ri-badge card">${svgUse("cards")}</span>
        <div class="ri-main">
          <div class="ri-title">${escapeHtml(c.name || "(no name)")}</div>
          <div class="ri-sub">${escapeHtml(c.uid)} · ${c.credits} credits · ${c.tickets} tickets</div>
        </div>
        <div class="ri-actions"><button class="mini-btn" data-load="${escapeAttr(c.uid)}">Open</button></div>`;
      row.querySelector("[data-load]").addEventListener("click", () => onTap(c.uid));
      list.appendChild(row);
    });
  }

  async function refreshLog() {
    const list = $("#logList");
    const tx = await store.listTransactions(activeCard ? activeCard.uid : null);
    list.innerHTML = "";
    if (tx.length === 0) { list.innerHTML = `<p class="panel-hint">No activity yet.</p>`; return; }
    tx.forEach((t) => {
      let badge = "other";
      if (t.kind === "redeem") badge = "redeem";
      else if (t.kind.startsWith("merge")) badge = "merge";
      else if (t.credits_d > 0 || t.tickets_d > 0) badge = "add";
      else if (t.credits_d < 0 || t.tickets_d < 0) badge = "remove";
      const parts = [];
      if (t.credits_d) parts.push(`${t.credits_d > 0 ? "+" : ""}${t.credits_d} credits`);
      if (t.tickets_d) parts.push(`${t.tickets_d > 0 ? "+" : ""}${t.tickets_d} tickets`);
      const label = { create_card: "created", delete_card: "deleted", merge_in: "merge in", merge_out: "merge out" }[t.kind] || t.kind;
      const row = document.createElement("div");
      row.className = "log-entry";
      row.innerHTML = `
        <span class="log-badge ${badge}">${escapeHtml(label)}</span>
        <div class="log-main">
          <div>${escapeHtml(t.detail || t.uid)}${parts.length ? " · " + parts.join(", ") : ""}</div>
          <div class="log-time">${new Date(t.ts * 1000).toLocaleString()}</div>
        </div>`;
      list.appendChild(row);
    });
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
      loadCard(card);
      if (bodyIsAdvanced()) { refreshCards(); refreshLog(); }
      toast(`${delta > 0 ? "Added" : "Removed"} ${Math.abs(delta)} ${kind}`, "success");
    } catch (e) { toast(e.message === "insufficient_balance" ? "Not enough balance" : "Update failed", "error"); }
  }

  async function redeemItem(item) {
    if (!activeCard) { toast("Load a card first", "error"); return; }
    if (item.stock === 0) { toast("Out of stock", "error"); return; }
    if (activeCard[item.currency] < item.cost) { toast("Not enough " + item.currency, "error"); return; }
    if (!confirm(`Redeem "${item.name}" for ${item.cost} ${item.currency}?`)) return;
    try {
      const card = await store.redeem(activeCard.uid, item.id);
      loadCard(card); refreshItems();
      if (bodyIsAdvanced()) { refreshCards(); refreshLog(); }
      toast(`Redeemed ${item.name}`, "success");
    } catch (e) { toast("Redeem failed: " + e.message, "error"); }
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
  // Item form / new card modal
  // ---------------------------------------------------------------
  function editItem(item) {
    $("#itemId").value = item.id; $("#itemName").value = item.name; $("#itemCost").value = item.cost;
    $("#itemCurrency").value = item.currency; $("#itemStock").value = item.stock;
    switchTab("items"); $("#itemName").focus();
  }
  function resetItemForm() { $("#itemId").value = ""; $("#itemName").value = ""; $("#itemCost").value = 100; $("#itemCurrency").value = "tickets"; $("#itemStock").value = -1; }

  function openNewCardModal(uid) {
    $("#newUid").value = uid || ""; $("#newName").value = ""; $("#newCredits").value = 0; $("#newTickets").value = 0;
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
    $("#deleteCardBtn").addEventListener("click", async () => { if (!activeCard || !confirm(`Delete card ${activeCard.uid}?`)) return; await store.deleteCard(activeCard.uid); unloadCard(); refreshCards(); toast("Card deleted"); });

    $("#manualScanBtn").addEventListener("click", () => onTap($("#manualUid").value));
    $("#manualUid").addEventListener("keydown", (e) => { if (e.key === "Enter") onTap($("#manualUid").value); });
    $("#newCardBtn").addEventListener("click", () => openNewCardModal(""));

    // Merge
    $("#mergeBtn").addEventListener("click", openMerge);
    $("#mergeCancelBtn").addEventListener("click", closeMerge);
    $("#mergeConfirmBtn").addEventListener("click", doMerge);
    $("#mergeUidBtn").addEventListener("click", () => mergeSecondCard($("#mergeUid").value));
    $("#mergeUid").addEventListener("keydown", (e) => { if (e.key === "Enter") mergeSecondCard($("#mergeUid").value); });
    $("#mergeCredits").addEventListener("change", updateMergePreview);
    $("#mergeTickets").addEventListener("change", updateMergePreview);
    $("#mergeBackdrop").addEventListener("click", (e) => { if (e.target.id === "mergeBackdrop") closeMerge(); });

    // Item form
    $("#itemForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = { name: $("#itemName").value, cost: parseInt($("#itemCost").value, 10) || 0, currency: $("#itemCurrency").value, stock: parseInt($("#itemStock").value, 10) };
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
        const card = await store.createCard({ uid: $("#newUid").value, name: $("#newName").value, credits: parseInt($("#newCredits").value, 10) || 0, tickets: parseInt($("#newTickets").value, 10) || 0 });
        closeNewCardModal(); loadCard(card); refreshCards(); toast("Card created", "success");
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

    // Show lock; app starts once unlocked / PIN created.
    showLock(hasPin() ? "unlock" : "create");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
