/* ============================================================
   Arcade Card Manager — front-end logic
   Works in two modes:
     • Backend mode  — talks to the Python/Flask server (real RFID reader,
                       shared SQLite database, live tap feed over SSE).
     • Local mode    — no backend; everything is kept in localStorage so the
                       UI still works when hosted statically (e.g. GitHub Pages).
   The two modes share the same API surface via the Store abstraction below.
   ============================================================ */
(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // ---------------------------------------------------------------
  // Settings persisted in localStorage
  // ---------------------------------------------------------------
  const SETTINGS_KEY = "arcade.settings";
  const settings = Object.assign(
    { backendUrl: "", rfidMode: "backend", mode: "simple" },
    JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}")
  );
  // Default the backend URL to same-origin when served by Flask.
  if (settings.backendUrl === "" && location.protocol.startsWith("http")) {
    settings.backendUrl = location.origin;
  }
  const saveSettings = () =>
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

  // ---------------------------------------------------------------
  // Store: BackendStore (REST) or LocalStore (localStorage)
  // ---------------------------------------------------------------
  class BackendStore {
    constructor(base) { this.base = base.replace(/\/$/, ""); this.name = "backend"; }
    async _req(path, opts) {
      const res = await fetch(this.base + path, {
        headers: { "Content-Type": "application/json" },
        ...opts,
      });
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
    updateCard(uid, patch) {
      return this._req(`/api/cards/${encodeURIComponent(uid)}`, { method: "PATCH", body: JSON.stringify(patch) });
    }
    deleteCard(uid) { return this._req(`/api/cards/${encodeURIComponent(uid)}`, { method: "DELETE" }); }
    listItems() { return this._req("/api/items"); }
    createItem(i) { return this._req("/api/items", { method: "POST", body: JSON.stringify(i) }); }
    updateItem(id, patch) { return this._req(`/api/items/${id}`, { method: "PATCH", body: JSON.stringify(patch) }); }
    deleteItem(id) { return this._req(`/api/items/${id}`, { method: "DELETE" }); }
    redeem(uid, itemId) { return this._req("/api/redeem", { method: "POST", body: JSON.stringify({ uid, item_id: itemId }) }); }
    listTransactions(uid) {
      const q = uid ? `?uid=${encodeURIComponent(uid)}` : "";
      return this._req(`/api/transactions${q}`);
    }
    simulate(uid) { return this._req("/api/scan/simulate", { method: "POST", body: JSON.stringify({ uid }) }); }
  }

  class LocalStore {
    constructor() {
      this.name = "local";
      this.KEY = "arcade.data";
      this.data = JSON.parse(localStorage.getItem(this.KEY) || "null") || {
        cards: {}, items: [], tx: [], nextItemId: 1,
      };
      if (this.data.items.length === 0) {
        [
          ["Rubber Duck", 50, "tickets", -1, "🦆"],
          ["Plush Bear", 500, "tickets", 10, "🧸"],
          ["Candy Bar", 25, "tickets", -1, "🍫"],
          ["Game Console", 25000, "tickets", 2, "🎮"],
        ].forEach(([name, cost, currency, stock, emoji]) =>
          this.data.items.push({ id: this.data.nextItemId++, name, cost, currency, stock, emoji })
        );
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
      this.data.cards[uid] = card;
      this._log(uid, "create_card", c.name);
      this._save();
      return card;
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
      this._save();
      return c;
    }
    async deleteCard(uid) { delete this.data.cards[uid]; this._log(uid, "delete_card"); this._save(); return { ok: true }; }
    async listItems() { return [...this.data.items].sort((a, b) => a.cost - b.cost); }
    async createItem(i) {
      if (!(i.name || "").trim()) throw new Error("name_required");
      const item = { id: this.data.nextItemId++, name: i.name, cost: +i.cost || 0, currency: i.currency || "tickets", stock: i.stock === undefined ? -1 : +i.stock, emoji: i.emoji || "🎁" };
      this.data.items.push(item); this._save(); return item;
    }
    async updateItem(id, patch) {
      const item = this.data.items.find((x) => x.id === id);
      if (!item) throw new Error("not_found");
      Object.assign(item, {
        name: patch.name ?? item.name, cost: patch.cost === undefined ? item.cost : +patch.cost,
        currency: patch.currency ?? item.currency, stock: patch.stock === undefined ? item.stock : +patch.stock,
        emoji: patch.emoji ?? item.emoji,
      });
      this._save(); return item;
    }
    async deleteItem(id) { this.data.items = this.data.items.filter((x) => x.id !== id); this._save(); return { ok: true }; }
    async redeem(uid, itemId) {
      const c = this.data.cards[uid], item = this.data.items.find((x) => x.id === itemId);
      if (!c) throw new Error("card_not_found");
      if (!item) throw new Error("item_not_found");
      if (item.stock === 0) throw new Error("out_of_stock");
      if (c[item.currency] < item.cost) throw new Error("insufficient_balance");
      const cd = item.currency === "credits" ? -item.cost : 0;
      const td = item.currency === "tickets" ? -item.cost : 0;
      c.credits += cd; c.tickets += td; c.updated_at = Date.now() / 1000;
      if (item.stock > 0) item.stock -= 1;
      this._log(uid, "redeem", item.name, cd, td);
      this._save(); return c;
    }
    async listTransactions(uid) { return this.data.tx.filter((t) => !uid || t.uid === uid).slice(0, 50); }
    async simulate(uid) { onTap(uid); return { ok: true }; }
    reset() { localStorage.removeItem(this.KEY); }
  }

  let store = null;
  let activeCard = null;
  let items = [];
  let sse = null;
  let appStarted = false;

  function startApp() {
    appStarted = true;
    connect();
  }

  // ---------------------------------------------------------------
  // Connection handling
  // ---------------------------------------------------------------
  async function connect() {
    const url = settings.backendUrl.trim();
    setConn("checking", "Checking…");
    if (url && settings.rfidMode !== "wedge") {
      try {
        const s = new BackendStore(url);
        const h = await Promise.race([
          s.health(),
          new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 2500)),
        ]);
        store = s;
        setConn("online", `Backend · ${h.reader} reader`);
        openStream(url);
        await refreshAll();
        return;
      } catch (e) {
        // fall through to local mode
      }
    }
    store = new LocalStore();
    setConn("local", settings.rfidMode === "wedge" ? "Keyboard-wedge mode" : "Local mode (browser storage)");
    closeStream();
    await refreshAll();
  }

  function setConn(state, text) {
    const pill = $("#connPill");
    pill.className = "conn-pill " + state;
    $("#connText").textContent = text;
  }

  function openStream(url) {
    closeStream();
    try {
      sse = new EventSource(url.replace(/\/$/, "") + "/api/scan/stream");
      sse.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data.uid) onTap(data.uid);
        } catch (_) {}
      };
      sse.onerror = () => { /* browser auto-reconnects */ };
    } catch (_) {}
  }
  function closeStream() { if (sse) { sse.close(); sse = null; } }

  // ---------------------------------------------------------------
  // RFID tap handling (from SSE, wedge, or manual)
  // ---------------------------------------------------------------
  async function onTap(uid) {
    uid = (uid || "").trim();
    if (!uid) return;
    // If the new-card modal is open, fill its UID field instead of loading.
    if (!$("#modalBackdrop").classList.contains("hidden")) {
      $("#newUid").value = uid;
      $("#newCardScanHint").textContent = `Card ${uid} detected — press Create.`;
      return;
    }
    try {
      const card = await store.getCard(uid);
      loadCard(card);
      toast(`Card ${uid} loaded`, "success");
    } catch (e) {
      // Unknown card — offer to register it.
      openNewCardModal(uid);
      toast(`Unknown card ${uid} — register it?`, "error");
    }
  }

  // Keyboard-wedge readers "type" the UID then press Enter. Capture rapid
  // keystrokes that end in Enter while not focused on a text field.
  let wedgeBuf = "";
  let wedgeTimer = null;
  document.addEventListener("keydown", (e) => {
    if (settings.rfidMode !== "wedge") return;
    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "select" || tag === "textarea") return;
    if (e.key === "Enter") {
      if (wedgeBuf.length >= 3) onTap(wedgeBuf);
      wedgeBuf = "";
      return;
    }
    if (e.key.length === 1) {
      wedgeBuf += e.key;
      clearTimeout(wedgeTimer);
      wedgeTimer = setTimeout(() => (wedgeBuf = ""), 300);
    }
  });

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

  function unloadCard() {
    activeCard = null;
    $("#activeCard").classList.add("hidden");
    $("#scanHint").classList.remove("hidden");
    renderPrizes();
  }

  async function refreshAll() {
    await Promise.all([refreshItems(), refreshCards()]);
    if (activeCard) {
      try { loadCard(await store.getCard(activeCard.uid)); }
      catch (_) { unloadCard(); }
    }
    if (bodyIsAdvanced()) refreshLog();
  }

  async function refreshItems() {
    items = await store.listItems();
    renderPrizes();
    renderItemList();
  }

  function renderPrizes() {
    const grid = $("#prizeGrid");
    grid.innerHTML = "";
    if (items.length === 0) {
      grid.innerHTML = `<p class="panel-hint">No items yet. Add some in the Items tab.</p>`;
      return;
    }
    items.forEach((item) => {
      const affordable =
        activeCard && item.stock !== 0 && activeCard[item.currency] >= item.cost;
      const div = document.createElement("div");
      div.className = "prize" + (activeCard && !affordable ? " disabled" : "");
      div.innerHTML = `
        <div class="prize-emoji">${item.emoji || "🎁"}</div>
        <div class="prize-name">${escapeHtml(item.name)}</div>
        <div class="prize-cost ${item.currency}">${item.cost} ${item.currency}</div>
        <div class="prize-stock">${item.stock < 0 ? "In stock" : item.stock + " left"}</div>`;
      div.addEventListener("click", () => redeemItem(item));
      grid.appendChild(div);
    });
  }

  function renderItemList() {
    const list = $("#itemList");
    list.innerHTML = "";
    items.forEach((item) => {
      const row = document.createElement("div");
      row.className = "row-item";
      row.innerHTML = `
        <span class="ri-emoji">${item.emoji || "🎁"}</span>
        <div class="ri-main">
          <div class="ri-title">${escapeHtml(item.name)}</div>
          <div class="ri-sub">${item.cost} ${item.currency} · ${item.stock < 0 ? "unlimited" : item.stock + " in stock"}</div>
        </div>
        <div class="ri-actions">
          <button class="mini-btn" data-edit="${item.id}">Edit</button>
          <button class="mini-btn danger" data-del="${item.id}">Delete</button>
        </div>`;
      row.querySelector("[data-edit]").addEventListener("click", () => editItem(item));
      row.querySelector("[data-del]").addEventListener("click", async () => {
        if (!confirm(`Delete "${item.name}"?`)) return;
        await store.deleteItem(item.id);
        toast("Item deleted");
        refreshItems();
      });
      list.appendChild(row);
    });
  }

  async function refreshCards() {
    const cards = await store.listCards();
    const term = ($("#cardSearch").value || "").toLowerCase();
    const list = $("#cardList");
    list.innerHTML = "";
    const filtered = cards.filter(
      (c) => c.uid.toLowerCase().includes(term) || (c.name || "").toLowerCase().includes(term)
    );
    if (filtered.length === 0) {
      list.innerHTML = `<p class="panel-hint">No cards ${term ? "match" : "registered yet"}.</p>`;
      return;
    }
    filtered.forEach((c) => {
      const row = document.createElement("div");
      row.className = "row-item";
      row.innerHTML = `
        <span class="ri-emoji">💳</span>
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
      const badge = t.kind === "redeem" ? "redeem" :
        (t.credits_d > 0 || t.tickets_d > 0) ? "add" :
        (t.credits_d < 0 || t.tickets_d < 0) ? "remove" : "other";
      const parts = [];
      if (t.credits_d) parts.push(`${t.credits_d > 0 ? "+" : ""}${t.credits_d} credits`);
      if (t.tickets_d) parts.push(`${t.tickets_d > 0 ? "+" : ""}${t.tickets_d} tickets`);
      const row = document.createElement("div");
      row.className = "log-entry";
      row.innerHTML = `
        <span class="log-badge ${badge}">${t.kind}</span>
        <div class="log-main">
          <div>${escapeHtml(t.detail || t.uid)} ${parts.length ? "· " + parts.join(", ") : ""}</div>
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
    } catch (e) {
      toast(e.message === "insufficient_balance" ? "Not enough balance" : "Update failed", "error");
    }
  }

  async function redeemItem(item) {
    if (!activeCard) { toast("Load a card first", "error"); return; }
    if (item.stock === 0) { toast("Out of stock", "error"); return; }
    if (activeCard[item.currency] < item.cost) { toast("Not enough " + item.currency, "error"); return; }
    if (!confirm(`Redeem "${item.name}" for ${item.cost} ${item.currency}?`)) return;
    try {
      const card = await store.redeem(activeCard.uid, item.id);
      loadCard(card);
      refreshItems();
      if (bodyIsAdvanced()) { refreshCards(); refreshLog(); }
      toast(`Redeemed ${item.name} ${item.emoji || ""}`, "success");
    } catch (e) {
      toast("Redeem failed: " + e.message, "error");
    }
  }

  // ---------------------------------------------------------------
  // Item form
  // ---------------------------------------------------------------
  function editItem(item) {
    $("#itemId").value = item.id;
    $("#itemEmoji").value = item.emoji || "🎁";
    $("#itemName").value = item.name;
    $("#itemCost").value = item.cost;
    $("#itemCurrency").value = item.currency;
    $("#itemStock").value = item.stock;
    switchTab("items");
    $("#itemName").focus();
  }
  function resetItemForm() {
    $("#itemId").value = "";
    $("#itemEmoji").value = "🎁";
    $("#itemName").value = "";
    $("#itemCost").value = 100;
    $("#itemCurrency").value = "tickets";
    $("#itemStock").value = -1;
  }

  // ---------------------------------------------------------------
  // New-card modal
  // ---------------------------------------------------------------
  function openNewCardModal(uid) {
    $("#newUid").value = uid || "";
    $("#newName").value = "";
    $("#newCredits").value = 0;
    $("#newTickets").value = 0;
    $("#newCardScanHint").textContent = uid
      ? `Card ${uid} detected.`
      : "Waiting for a tap… or type the ID manually.";
    $("#modalBackdrop").classList.remove("hidden");
    $("#newName").focus();
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
    // If a hidden tab was active, fall back to prizes.
    if (mode === "simple") switchTab("prizes");
    else refreshLog();
  }
  function switchTab(name) {
    $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
    $$(".tab-panel").forEach((p) => p.classList.toggle("active", p.id === "tab-" + name));
    if (name === "cards") refreshCards();
    if (name === "log") refreshLog();
  }

  // ---------------------------------------------------------------
  // Password lock (front-end only; hash stored on this device)
  // ---------------------------------------------------------------
  const LOCK_KEY = "arcade.lock";
  let changingPassword = false;

  async function hashPassword(pw) {
    // Prefer a real SHA-256; fall back to a simple hash on insecure contexts
    // (e.g. opening the file directly via file://).
    try {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("arcade::" + pw));
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
    } catch (_) {
      let h = 5381;
      const s = "arcade::" + pw;
      for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
      return "fb" + (h >>> 0).toString(16);
    }
  }

  function hasPassword() { return !!localStorage.getItem(LOCK_KEY); }

  function showLock({ create }) {
    document.body.classList.add("locked");
    const screen = $("#lockScreen");
    screen.classList.remove("hidden");
    screen.style.display = "flex";
    $("#lockError").classList.add("hidden");
    $("#lockPass").value = "";
    $("#lockPass2").value = "";
    if (create) {
      $("#lockTitle").textContent = changingPassword ? "Set a new password" : "Create a password";
      $("#lockSub").textContent = "Choose a password to protect this app";
      $("#lockPass").placeholder = "New password";
      $("#lockPass2").classList.remove("hidden");
      $("#lockBtn").textContent = "Set password";
    } else {
      $("#lockTitle").textContent = "Arcade Card Manager";
      $("#lockSub").textContent = "Enter your password to unlock";
      $("#lockPass").placeholder = "Password";
      $("#lockPass2").classList.add("hidden");
      $("#lockBtn").textContent = "Unlock";
    }
    setTimeout(() => $("#lockPass").focus(), 50);
  }

  function hideLock() {
    document.body.classList.remove("locked");
    $("#lockScreen").style.display = "none";
  }

  function lockError(msg) {
    const e = $("#lockError");
    e.textContent = msg;
    e.classList.remove("hidden");
  }

  async function handleLockSubmit(ev) {
    ev.preventDefault();
    const pw = $("#lockPass").value;
    const creating = !hasPassword() || changingPassword;
    if (creating) {
      if (pw.length < 3) return lockError("Password must be at least 3 characters.");
      if (pw !== $("#lockPass2").value) return lockError("Passwords don't match.");
      localStorage.setItem(LOCK_KEY, await hashPassword(pw));
      changingPassword = false;
      hideLock();
      if (!appStarted) startApp();
      else toast("Password updated", "success");
    } else {
      if ((await hashPassword(pw)) !== localStorage.getItem(LOCK_KEY)) return lockError("Wrong password.");
      hideLock();
      if (!appStarted) startApp();
    }
  }

  function lockNow() { showLock({ create: false }); }

  // ---------------------------------------------------------------
  // Toast helper
  // ---------------------------------------------------------------
  function toast(msg, type = "") {
    const el = document.createElement("div");
    el.className = "toast " + type;
    el.textContent = msg;
    $("#toastWrap").appendChild(el);
    setTimeout(() => { el.style.opacity = "0"; el.style.transition = ".3s"; }, 2200);
    setTimeout(() => el.remove(), 2600);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function escapeAttr(s) { return escapeHtml(s); }

  // ---------------------------------------------------------------
  // Wire up the DOM
  // ---------------------------------------------------------------
  function init() {
    // Mode
    setMode(settings.mode || "simple");
    $("#modeSimple").addEventListener("click", () => setMode("simple"));
    $("#modeAdvanced").addEventListener("click", () => setMode("advanced"));

    // Tabs
    $$(".tab").forEach((t) => t.addEventListener("click", () => switchTab(t.dataset.tab)));

    // Quick-action chips
    $$(".qa-buttons").forEach((group) => {
      const kind = group.dataset.kind;
      group.querySelectorAll(".chip").forEach((chip) =>
        chip.addEventListener("click", () => adjust(kind, parseInt(chip.dataset.delta, 10), "quick action"))
      );
    });

    // Custom amount
    $("#customAddBtn").addEventListener("click", () => {
      const amt = Math.abs(parseInt($("#customAmount").value, 10) || 0);
      if (amt) adjust($("#customKind").value, amt, "manual add");
    });
    $("#customRemoveBtn").addEventListener("click", () => {
      const amt = Math.abs(parseInt($("#customAmount").value, 10) || 0);
      if (amt) adjust($("#customKind").value, -amt, "manual remove");
    });

    // Card tools
    $("#saveNameBtn").addEventListener("click", async () => {
      if (!activeCard) return;
      const card = await store.updateCard(activeCard.uid, { name: $("#cardName").value });
      loadCard(card); refreshCards(); toast("Name saved", "success");
    });
    $("#switchCardBtn").addEventListener("click", unloadCard);
    $("#deleteCardBtn").addEventListener("click", async () => {
      if (!activeCard || !confirm(`Delete card ${activeCard.uid}?`)) return;
      await store.deleteCard(activeCard.uid);
      unloadCard(); refreshCards(); toast("Card deleted");
    });

    // Manual scan + register
    $("#manualScanBtn").addEventListener("click", () => onTap($("#manualUid").value));
    $("#manualUid").addEventListener("keydown", (e) => { if (e.key === "Enter") onTap($("#manualUid").value); });
    $("#newCardBtn").addEventListener("click", () => openNewCardModal(""));

    // Item form
    $("#itemForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = {
        emoji: $("#itemEmoji").value, name: $("#itemName").value,
        cost: parseInt($("#itemCost").value, 10) || 0,
        currency: $("#itemCurrency").value,
        stock: parseInt($("#itemStock").value, 10),
      };
      try {
        const id = $("#itemId").value;
        if (id) await store.updateItem(parseInt(id, 10), payload);
        else await store.createItem(payload);
        resetItemForm(); refreshItems(); toast("Item saved", "success");
      } catch (err) { toast("Save failed: " + err.message, "error"); }
    });
    $("#itemResetBtn").addEventListener("click", resetItemForm);

    // Card search
    $("#cardSearch").addEventListener("input", refreshCards);

    // New-card modal
    $("#createCardBtn").addEventListener("click", async () => {
      try {
        const card = await store.createCard({
          uid: $("#newUid").value, name: $("#newName").value,
          credits: parseInt($("#newCredits").value, 10) || 0,
          tickets: parseInt($("#newTickets").value, 10) || 0,
        });
        closeNewCardModal(); loadCard(card); refreshCards();
        toast("Card created", "success");
      } catch (err) {
        toast(err.message === "exists" ? "Card already exists" :
          err.message === "uid_required" ? "Enter a card ID" : "Create failed", "error");
      }
    });
    $("#cancelCardBtn").addEventListener("click", closeNewCardModal);
    $("#modalBackdrop").addEventListener("click", (e) => { if (e.target.id === "modalBackdrop") closeNewCardModal(); });

    // Settings drawer
    const openDrawer = () => {
      $("#backendUrl").value = settings.backendUrl;
      $$("input[name=rfidMode]").forEach((r) => (r.checked = r.value === settings.rfidMode));
      $("#settingsDrawer").classList.remove("hidden");
      $("#drawerBackdrop").classList.remove("hidden");
    };
    const closeDrawer = () => {
      $("#settingsDrawer").classList.add("hidden");
      $("#drawerBackdrop").classList.add("hidden");
    };
    $("#settingsBtn").addEventListener("click", openDrawer);
    $("#closeDrawer").addEventListener("click", closeDrawer);
    $("#drawerBackdrop").addEventListener("click", closeDrawer);

    $("#reconnectBtn").addEventListener("click", async () => {
      settings.backendUrl = $("#backendUrl").value.trim();
      settings.rfidMode = ($$("input[name=rfidMode]:checked")[0] || {}).value || "backend";
      saveSettings();
      await connect();
      toast(store.name === "backend" ? "Connected to backend" : "Running in local mode", store.name === "backend" ? "success" : "");
    });
    $$("input[name=rfidMode]").forEach((r) =>
      r.addEventListener("change", () => {
        settings.rfidMode = r.value; saveSettings();
      })
    );

    $("#simBtn").addEventListener("click", async () => {
      const uid = $("#simUid").value.trim() || "04A1B2C3";
      try { await store.simulate(uid); } catch (_) { onTap(uid); }
    });

    $("#resetLocalBtn").addEventListener("click", () => {
      if (!confirm("Clear all locally-stored cards and items?")) return;
      localStorage.removeItem("arcade.data");
      location.reload();
    });

    // Password lock
    $("#lockForm").addEventListener("submit", handleLockSubmit);
    $("#lockNowBtn").addEventListener("click", () => {
      $("#settingsDrawer").classList.add("hidden");
      $("#drawerBackdrop").classList.add("hidden");
      lockNow();
    });
    $("#changePassBtn").addEventListener("click", () => {
      $("#settingsDrawer").classList.add("hidden");
      $("#drawerBackdrop").classList.add("hidden");
      changingPassword = true;
      showLock({ create: true });
    });

    // Show lock first; the app starts once unlocked / password created.
    showLock({ create: !hasPassword() });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
