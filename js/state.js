/* Central state: persisted to localStorage. One global `State` object. */
(function () {
  "use strict";

  const STORAGE_KEY = "win12_state_v1";

  const defaults = () => ({
    bootCompleted: false,
    setupCompleted: false,
    // setup choices
    region: "United States",
    language: "English (United States)",
    langCode: "en",
    theme: "light", // light | dark
    textScale: 100, // percent
    productKey: null,
    hasProductKey: false,
    account: null, // { email, password }
    profile: {
      picture: null, // dataURL
      username: "User",
      authType: "pin", // pin | password
      secret: "", // pin or password value
    },
    clock: {
      mode: "automatic", // automatic | custom
      format24: false,
      customBaseMs: null, // epoch ms set at config time for custom
      customSetAt: null,
    },
    // bank
    bank: {
      balance: 1000,
      transactions: [], // {id, vendor, item, amount, refundable, refunded, ts}
    },
    // youtube
    youtube: {
      premium: false,
      subscriptions: [], // channel ids
      likes: [], // video ids
      playlists: [], // {id,name,videos:[]}
      uploads: [], // {id, title, channel, ts}
    },
    // discord
    discord: {
      loggedIn: false,
      joinedServers: [], // server ids
      myServers: [], // {id,name,icon}
      bots: [], // {id,name}
    },
    // store
    installedApps: [], // app ids
    // desktop
    desktop: {
      wallpaper: "default", // 'default' | color hex | dataURL
    },
    // amazon
    amazon: { cart: [] },
    // redeemed product keys are global (shared file) — tracked here
    redeemedKeys: [],
    // Copilot AI assistant (key stored only in this browser, never committed)
    copilot: { apiKey: "", model: "baidu/ernie-4-5-0-3b", history: [] },
    // Per-app saved data (To Do, Sticky Notes, etc.)
    appData: {},
  });

  let data = load();

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaults();
      return Object.assign(defaults(), JSON.parse(raw));
    } catch (e) {
      return defaults();
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  function reset() {
    data = defaults();
    save();
  }

  // ---- Product keys ----
  // Deterministic set of 100 valid keys generated from a seed so the
  // "sheet" matches what Windows accepts.
  function seededRandom(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function generateKeys() {
    const rnd = seededRandom(20261225);
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const keys = [];
    for (let i = 0; i < 100; i++) {
      const groups = [];
      for (let g = 0; g < 4; g++) {
        let grp = "";
        for (let c = 0; c < 3; c++) {
          grp += chars[Math.floor(rnd() * chars.length)];
        }
        groups.push(grp);
      }
      keys.push(groups.join("-"));
    }
    return keys;
  }

  const VALID_KEYS = generateKeys();

  function validateKey(input) {
    const key = (input || "").trim().toUpperCase();
    if (!VALID_KEYS.includes(key)) return "invalid";
    if (data.redeemedKeys.includes(key)) return "redeemed";
    return "valid";
  }

  function redeemKey(input) {
    const key = (input || "").trim().toUpperCase();
    if (!data.redeemedKeys.includes(key)) data.redeemedKeys.push(key);
    data.productKey = key;
    data.hasProductKey = true;
    save();
  }

  // ---- Clock ----
  function now() {
    if (data.clock.mode === "custom" && data.clock.customBaseMs != null) {
      // add 1 simulated minute per real minute on top of base (2x time as requested)
      const realElapsed = Date.now() - data.clock.customSetAt;
      return new Date(data.clock.customBaseMs + realElapsed + realElapsed);
    }
    return new Date();
  }

  function formatClock() {
    const d = now();
    let h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, "0");
    if (data.clock.format24) {
      return `${h.toString().padStart(2, "0")}:${m}`;
    }
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  }

  function formatDate() {
    const d = now();
    return d.toLocaleDateString(undefined, { month: "numeric", day: "numeric", year: "numeric" });
  }

  // ---- Bank ----
  function addTransaction({ vendor, item, amount, refundable }) {
    const id = "tx_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
    data.bank.balance = Math.round((data.bank.balance - amount) * 100) / 100;
    data.bank.transactions.unshift({
      id, vendor, item, amount, refundable: !!refundable, refunded: false, ts: Date.now(),
    });
    save();
    if (window.Achievements && typeof amount === "number" && amount > 0) window.Achievements.bump("big_spender", amount);
    return id;
  }

  function refundTransaction(id) {
    const tx = data.bank.transactions.find((t) => t.id === id);
    if (!tx || tx.refunded || !tx.refundable) return false;
    tx.refunded = true;
    data.bank.balance = Math.round((data.bank.balance + tx.amount) * 100) / 100;
    save();
    return true;
  }

  window.State = {
    get data() { return data; },
    save, reset, load,
    VALID_KEYS,
    validateKey, redeemKey,
    now, formatClock, formatDate,
    addTransaction, refundTransaction,
  };
})();
