/* Windows Messenger: a standalone chat app. Conversations / Contacts /
   Favorites / Settings tabs; famous tech personas reply via the AIML chat
   API (in-character) with a scripted fallback, plus a typing indicator.
   Threads persist in appData.messenger. */
(function () {
  "use strict";
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  const S = () => State.data;
  const cw = (opts) => window.WM.createWindow(opts);

  const CONTACTS = [
    { id: "gates", name: "Bill Gates", color: "#5b8fff", persona: "Bill Gates, co-founder of Microsoft. Warm, curious, a little nerdy; you love software, reading, and philanthropy." },
    { id: "cook", name: "Tim Cook", color: "#43a047", persona: "Tim Cook, CEO of Apple. Calm, measured and gracious; you care about privacy, design and doing the right thing." },
    { id: "pichai", name: "Sundar Pichai", color: "#fb8c00", persona: "Sundar Pichai, CEO of Google. Friendly and optimistic, especially about AI and helping people with technology." },
    { id: "nadella", name: "Satya Nadella", color: "#7b5cff", persona: "Satya Nadella, CEO of Microsoft. Empathetic and thoughtful with a growth mindset; you love cloud and AI." },
    { id: "huang", name: "Jensen Huang", color: "#e53935", persona: "Jensen Huang, CEO of NVIDIA. Energetic and enthusiastic about GPUs, accelerated computing and AI." },
    { id: "musk", name: "Elon Musk", color: "#111827", persona: "Elon Musk, an eccentric tech entrepreneur. Blunt, meme-y, big on rockets, EVs and Mars." },
  ];
  const byId = (id) => CONTACTS.find((c) => c.id === id);
  const MSGR_FALLBACK = ["hey! good to hear from you", "interesting — tell me more", "haha love that", "let me get back to you on that", "sounds good 👍", "totally agree", "that's a great point", "we should catch up soon"];

  async function msgrAiReply(contact, msgs) {
    const key = (S().copilot && S().copilot.apiKey) || window.AIML_KEY;
    const recent = msgs.slice(-10).map((m) => ({ role: m.self ? "user" : "assistant", content: m.text }));
    const sys = `You are ${contact.name}. ${contact.persona} You are texting a friend on Windows Messenger. Reply in character as a casual text message: 1-2 short sentences, warm and natural. Never say you are an AI, a language model, or a bot.`;
    const res = await fetch(window.AIML_BASE + "/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
      body: JSON.stringify({ model: "openai/gpt-4o-mini", messages: [{ role: "system", content: sys }].concat(recent), max_tokens: 120, temperature: 0.9 }),
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const j = await res.json();
    return ((j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || "").trim();
  }

  AppRegistry.messenger = function () {
    const { body } = cw({ title: "Messenger", icon: Icon.mini("messenger", "Messenger"), width: 860, height: 580, appId: "messenger" });
    if (!S().appData) S().appData = {};
    const data = S().appData.messenger || (S().appData.messenger = { threads: {}, favorites: [] });
    if (!data.threads) data.threads = {};
    if (!data.favorites) data.favorites = [];
    let tab = "Conversations", activeId = null, query = "";

    body.innerHTML = `<div class="msgr">
      <div class="msgr-side">
        <div class="msgr-tabs"></div>
        <div class="msgr-search"><span>&#128269;</span><input placeholder="Search" /></div>
        <div class="msgr-list"></div>
      </div>
      <div class="msgr-main"></div>
    </div>`;
    const tabsEl = body.querySelector(".msgr-tabs");
    const listEl = body.querySelector(".msgr-list");
    const mainEl = body.querySelector(".msgr-main");
    const searchEl = body.querySelector(".msgr-search input");

    ["Conversations", "Contacts", "Favorites", "Settings"].forEach((t) => {
      const b = el(`<button class="msgr-tab ${t === tab ? "active" : ""}">${t}</button>`);
      b.onclick = () => { tab = t; tabsEl.querySelectorAll(".msgr-tab").forEach((x) => x.classList.toggle("active", x.textContent === t)); renderList(); if (tab === "Settings") renderSettings(); };
      tabsEl.appendChild(b);
    });
    searchEl.oninput = () => { query = searchEl.value.toLowerCase(); renderList(); };

    function lastMsg(id) { const th = data.threads[id]; return th && th.length ? th[th.length - 1].text : ""; }

    function renderList() {
      listEl.style.display = tab === "Settings" ? "none" : "";
      listEl.innerHTML = "";
      let items = [];
      if (tab === "Conversations") items = CONTACTS.filter((c) => (data.threads[c.id] || []).length);
      else if (tab === "Favorites") items = CONTACTS.filter((c) => data.favorites.includes(c.id));
      else if (tab === "Contacts") items = CONTACTS.slice();
      if (query) items = items.filter((c) => c.name.toLowerCase().includes(query));
      if (!items.length && tab !== "Settings") { listEl.innerHTML = `<div class="muted" style="padding:18px;font-size:.85rem">${tab === "Conversations" ? "No conversations yet — open Contacts to start one." : "Nothing here yet."}</div>`; return; }
      items.forEach((c) => {
        const fav = data.favorites.includes(c.id);
        const row = el(`<button class="msgr-row ${c.id === activeId ? "active" : ""}">
          <span class="msgr-ava" style="background:${c.color}">${c.name[0]}</span>
          <span class="msgr-row-txt"><b>${c.name}</b><span class="msgr-row-sub">${escapeHtml(lastMsg(c.id) || c.persona.split(",")[0])}</span></span>
          <span class="msgr-fav ${fav ? "on" : ""}" title="Favorite">${fav ? "★" : "☆"}</span>
        </button>`);
        row.querySelector(".msgr-fav").onclick = (e) => { e.stopPropagation(); const i = data.favorites.indexOf(c.id); if (i >= 0) data.favorites.splice(i, 1); else data.favorites.push(c.id); State.save(); renderList(); };
        row.onclick = () => openChat(c.id);
        listEl.appendChild(row);
      });
    }

    function renderSettings() {
      mainEl.innerHTML = `<div class="msgr-settings">
        <h2>Settings</h2>
        <p class="muted">Windows Messenger — chat with famous tech personas. Replies use your AIML key (same as Copilot) and fall back to canned lines when offline.</p>
        <div class="row" style="gap:10px;margin-top:16px"><b>Your name:</b> ${escapeHtml((S().profile && S().profile.username) || "You")}</div>
        <button class="pill-btn" id="clearAll" style="margin-top:18px;background:#c0392b">Clear all conversations</button>
      </div>`;
      mainEl.querySelector("#clearAll").onclick = () => { if (confirm("Delete every conversation?")) { data.threads = {}; State.save(); activeId = null; renderList(); mainEl.innerHTML = emptyMain(); } };
    }

    function emptyMain() { return `<div class="msgr-empty"><div class="msgr-empty-ic">${Icon.big("messenger", "Messenger")}</div><h2>Windows Messenger</h2><p class="muted">Select a conversation or a contact to start chatting.</p></div>`; }

    function openChat(id) {
      activeId = id; tab = tab === "Settings" ? "Conversations" : tab;
      const c = byId(id);
      if (!data.threads[id]) data.threads[id] = [];
      renderList();
      mainEl.innerHTML = `<div class="msgr-chat">
        <div class="msgr-head"><span class="msgr-ava" style="background:${c.color}">${c.name[0]}</span><div><b>${c.name}</b><div class="msgr-head-sub">${escapeHtml(c.persona.split(",").slice(1).join(",").trim())}</div></div></div>
        <div class="msgr-msgs"></div>
        <div class="msgr-compose"><input placeholder="Type a message" /><button class="msgr-send">Send</button></div>
      </div>`;
      const msgsEl = mainEl.querySelector(".msgr-msgs");
      const input = mainEl.querySelector(".msgr-compose input");

      function renderMsgs() {
        msgsEl.innerHTML = "";
        data.threads[id].forEach((m) => {
          msgsEl.appendChild(el(`<div class="msgr-bubble ${m.self ? "self" : "them"}">${escapeHtml(m.text)}</div>`));
        });
        msgsEl.scrollTop = msgsEl.scrollHeight;
      }
      function showTyping() {
        const t = el(`<div class="msgr-bubble them msgr-typing"><span></span><span></span><span></span></div>`);
        msgsEl.appendChild(t); msgsEl.scrollTop = msgsEl.scrollHeight; return t;
      }
      renderMsgs();
      if (!data.threads[id].length) { data.threads[id].push({ text: greet(c), self: false }); State.save(); renderMsgs(); }

      function send() {
        const text = input.value.trim(); if (!text) return;
        data.threads[id].push({ text, self: true }); State.save(); input.value = ""; renderMsgs();
        const typing = showTyping();
        const started = Date.now();
        const deliver = (reply) => { typing.remove(); data.threads[id].push({ text: reply, self: false }); State.save(); renderMsgs(); renderList(); };
        msgrAiReply(c, data.threads[id])
          .then((r) => { const txt = r || MSGR_FALLBACK[Math.floor(Math.random() * MSGR_FALLBACK.length)]; setTimeout(() => deliver(txt), Math.max(0, 800 - (Date.now() - started))); })
          .catch(() => setTimeout(() => deliver(MSGR_FALLBACK[Math.floor(Math.random() * MSGR_FALLBACK.length)]), 600));
      }
      mainEl.querySelector(".msgr-send").onclick = send;
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); send(); } });
      input.focus();
    }

    function greet(c) { return `Hey ${(S().profile && S().profile.username) || "there"}! ${c.name.split(" ")[0]} here 👋`; }

    renderList();
    mainEl.innerHTML = emptyMain();
  };
})();
