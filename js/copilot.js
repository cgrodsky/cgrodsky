/* Copilot: an AI chat assistant backed by an OpenAI-compatible API (AIML API).
   The API key is entered at runtime and stored only in this browser (localStorage),
   never written into the source. */
(function () {
  "use strict";
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  const S = () => State.data;
  const CHAT_URL = window.AIML_BASE + "/chat/completions";
  const COMPLETIONS_URL = window.AIML_BASE + "/completions";
  const TTS_URL = window.AIML_BASE + "/tts";
  const IMAGES_URL = window.AIML_BASE + "/images/generations";
  const DEFAULT_MODEL = "openai/gpt-4o-mini";
  const IMAGE_MODEL = "google/nano-banana-2";
  const activeKey = () => S().copilot.apiKey || window.AIML_KEY;
  const activeModel = () => DEFAULT_MODEL;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  const LOGO = (cls) => `<div class="${cls}"><div class="ring"></div><div class="dot"></div></div>`;
  const SEND_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 12l16-8-6 16-3-7-7-1z" fill="currentColor"/></svg>`;
  const MIC_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/></svg>`;
  const CLIP_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>`;
  const FILE_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
  const X_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
  const PLUS_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>`;
  // M365 sidebar nav icons
  const SEARCH_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>`;
  const LIB_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5v14M9 4v16M14 5l4 14M19 6l1 0"/></svg>`;
  const CREATE_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>`;
  const AGENT_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M12 8V4M9 14h.01M15 14h.01"/></svg>`;
  const BOOK_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/></svg>`;
  const DOC_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c14343" stroke-width="1.8"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h5M8 12h8M8 16h8"/></svg>`;
  // Empty-state prompt suggestions (mirrors the M365 Copilot home)
  const SUGGEST = [
    { title: "Draft an email to my team asking for feedback", sub: "Ask for input", prompt: "Draft an email to my team asking for feedback on the latest project report." },
    { title: "Help me prepare for a review of a project", sub: "Get unbiased feedback", prompt: "Help me prepare for a review of the Total Sports Group project — what questions should I expect?" },
    { title: "Summarize the key points of a document", sub: "Get an overview", prompt: "Summarize the key points I should know from a long quarterly report." },
  ];

  // ---- Plans & usage limits (fake money) ----
  const PLANS = {
    basic: { id: "basic", name: "Basic", price: 0, msgs: 15, attach: 1, images: 0, blurb: "Everyday help" },
    plus: { id: "plus", name: "Copilot+", price: 4.99, msgs: 150, attach: 3, images: 3, blurb: "More of everything" },
    advanced: { id: "advanced", name: "Advanced", price: 9.99, msgs: Infinity, attach: Infinity, images: 5, blurb: "Unlimited chats" },
  };
  function cop() { if (!S().copilot) S().copilot = {}; return S().copilot; }
  function planCfg() { return PLANS[cop().plan] || PLANS.basic; }
  function dateKey() { const d = State.now ? State.now() : new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }
  function usage() { const c = cop(); const today = dateKey(); if (!c.usage || c.usage.date !== today) c.usage = { date: today, messages: 0, images: 0 }; return c.usage; }
  function limitLabel(n) { return n === Infinity ? "∞" : n; }

  // ---- Conversations ----
  function convos() {
    const c = cop();
    if (!c.convos) {
      // Migrate the old single history into the first conversation.
      const hist = c.history && c.history.length ? c.history : [];
      c.convos = [{ id: "c" + (State.now ? State.now().getTime() : 1), title: convTitle(hist), history: hist, ts: 1 }];
      c.activeId = c.convos[0].id;
      delete c.history;
    }
    return c.convos;
  }
  function convTitle(hist) { const first = (hist || []).find((m) => m.role === "user" && m.content); return first ? first.content.replace(/\[[^\]]*\]/g, "").trim().slice(0, 34) || "New chat" : "New chat"; }
  function activeConv() { const list = convos(); let a = list.find((x) => x.id === cop().activeId); if (!a) { a = list[0]; cop().activeId = a.id; } return a; }
  function newConv() { const c = cop(); convos(); const id = "c" + ((State.now ? State.now().getTime() : Date.now()) + Math.floor(c.convos.length)); c.convos.unshift({ id, title: "New chat", history: [], ts: c.convos.length + 1 }); c.activeId = id; State.save(); return id; }

  AppRegistry.copilot = function () {
    const { body } = window.WM.createWindow({ title: "Copilot", icon: LOGO("cop-logo"), width: 760, height: 640, appId: "copilot" });
    render(body);
  };

  function render(body) {
    if (!activeKey()) return renderKeyForm(body);
    const plan = planCfg();
    const uname = (S().profile && S().profile.username) || "You";
    body.innerHTML = `
      <div class="cop-shell cop-m365">
        <div class="cop-side">
          <div class="cop-brand">${LOGO("cop-logo")}<b>M365 Copilot</b></div>
          <button class="cop-newchat cop-nav">${LOGO("cop-logo cop-nav-dot")}<span>New chat</span></button>
          <button class="cop-nav" data-nav="search">${SEARCH_SVG}<span>Search</span></button>
          <button class="cop-nav" data-nav="library">${LIB_SVG}<span>Library</span></button>
          <button class="cop-nav" data-nav="create">${CREATE_SVG}<span>Create</span></button>
          <div class="cop-sec">Recent</div>
          <div class="cop-convos"></div>
          <div class="cop-sec cop-sec-lbl">${AGENT_SVG}<span>Agents</span></div>
          <div class="cop-sec cop-sec-lbl">${BOOK_SVG}<span>Notebooks</span></div>
          <div class="cop-side-foot">
            <div class="cop-user">${Icon.mini("user", uname)}<span class="cop-user-n">${escapeHtml(uname)}</span><button class="cop-user-x" title="Options">…</button></div>
            <button class="cop-upgrade cop-plan">Upgrade Copilot</button>
            <div class="cop-chat-label">Copilot Chat</div>
          </div>
        </div>
        <div class="cop">
          <div class="cop-topbar"><span class="grow"></span>
            <label class="container spk" title="Speak replies aloud">
              <input type="checkbox">
              <svg class="mute" xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 0 24 24" width="20"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" style="opacity:.35"></path><line x1="3" y1="21" x2="21" y2="3" stroke="currentColor" stroke-width="2"/></svg>
              <svg class="voice" xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 0 24 24" width="20"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"></path></svg>
            </label>
            <button class="clear">Clear</button><button class="setkey">API key</button></div>
          <div class="cop-msgs"></div>
          <div class="cop-prompt" data-empty="true">
            <div class="cop-files"></div>
            <textarea class="cop-ta" rows="1" placeholder="Message Copilot"></textarea>
            <div class="cop-prompt-bar">
              <button class="cop-mic mic" title="Voice mode">${MIC_SVG}</button>
              <button class="cop-attach" title="Attach file">${CLIP_SVG}</button>
              <span class="cop-usage muted"></span>
              <span class="grow"></span>
              <button class="cop-send" title="Send">${SEND_SVG}</button>
            </div>
            <input type="file" class="cop-file-input" multiple style="display:none">
          </div>
        </div>
      </div>`;
    // Sidebar nav: Search focuses the box, Create seeds an image prompt, Library/Agents/Notebooks are informational
    body.querySelectorAll(".cop-nav[data-nav]").forEach((b) => b.onclick = () => {
      const n = b.dataset.nav;
      const t = body.querySelector(".cop-ta");
      if (n === "search") { t && t.focus(); }
      else if (n === "create") { if (t) { t.value = "Create an image of "; t.focus(); } }
      else if (window.Notify) Notify.show({ icon: LOGO("cop-logo"), title: "M365 Copilot", body: n.charAt(0).toUpperCase() + n.slice(1) + " is part of Microsoft 365." });
    });
    const msgs = body.querySelector(".cop-msgs");
    const usageEl = body.querySelector(".cop-usage");

    // ---- conversations sidebar ----
    function renderConvos() {
      const wrap = body.querySelector(".cop-convos");
      wrap.innerHTML = "";
      convos().forEach((cv) => {
        const row = el(`<button class="cop-convo ${cv.id === cop().activeId ? "on" : ""}"><span class="cop-convo-t">${escapeHtml(cv.title || "New chat")}</span><span class="cop-convo-x" title="Delete">${X_SVG}</span></button>`);
        row.querySelector(".cop-convo-t").onclick = () => { cop().activeId = cv.id; State.save(); renderConvos(); paint(); };
        row.querySelector(".cop-convo-x").onclick = (e) => {
          e.stopPropagation();
          const list = convos(); const i = list.findIndex((x) => x.id === cv.id);
          list.splice(i, 1); if (!list.length) newConv(); if (cop().activeId === cv.id) cop().activeId = convos()[0].id;
          State.save(); renderConvos(); paint();
        };
        wrap.appendChild(row);
      });
    }
    body.querySelector(".cop-newchat").onclick = () => { newConv(); renderConvos(); paint(); };
    body.querySelector(".cop-plan").onclick = () => showPlans(body);
    function updateUsage() {
      const p = planCfg(), u = usage();
      const left = p.msgs === Infinity ? "Unlimited" : Math.max(0, p.msgs - u.messages) + " left";
      usageEl.textContent = p.name + " · " + left;
    }
    renderConvos();
    const ta = body.querySelector("textarea");
    const sendBtn = body.querySelector(".cop-send");
    const micBtn = body.querySelector(".cop-mic");
    const speakToggle = body.querySelector(".spk input");

    body.querySelector(".setkey").onclick = () => renderKeyForm(body);
    body.querySelector(".clear").onclick = () => { activeConv().history = []; activeConv().title = "New chat"; State.save(); renderConvos(); paint(); };

    // ---- Voice mode (browser STT + AIML TTS) ----
    let voiceOn = false, rec = null, audioEl = null;
    function setMicVisual() { micBtn.classList.toggle("active", voiceOn); }
    micBtn.onclick = () => {
      if (!SR) { addBubble({ role: "assistant", content: "Voice mode needs Chrome or Edge — your browser doesn't support speech recognition." }); return; }
      voiceOn = !voiceOn; setMicVisual();
      if (voiceOn) startListening(); else stopListening();
    };
    function startListening() {
      try {
        rec = new SR();
        rec.continuous = false; rec.interimResults = false; rec.lang = (I18n.lang === "en" ? "en-US" : I18n.lang);
        rec.onresult = (e) => { const t = e.results[0][0].transcript; ta.value = t; send(); };
        rec.onerror = () => { voiceOn = false; setMicVisual(); };
        rec.onend = () => { if (voiceOn && !sendBtn.disabled) { try { rec.start(); } catch (_) {} } };
        rec.start();
      } catch (e) { voiceOn = false; setMicVisual(); }
    }
    function stopListening() { if (rec) { try { rec.stop(); } catch (_) {} rec = null; } if (audioEl) { audioEl.pause(); audioEl = null; } }
    async function speak(text) {
      try {
        const r = await fetch(TTS_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + activeKey() },
          body: JSON.stringify({ model: "openai/tts-1", text: text.slice(0, 4000), voice: "coral" }),
        });
        const j = await r.json();
        const url = j.audio?.url || j.url;
        if (!url) return;
        audioEl = new Audio(url);
        audioEl.onended = () => { if (voiceOn) { try { rec && rec.start(); } catch (_) {} } };
        audioEl.play();
      } catch (e) {}
    }

    async function generateImage(prompt) {
      const r = await fetch(IMAGES_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + activeKey() },
        body: JSON.stringify({ model: IMAGE_MODEL, prompt }),
      });
      if (!r.ok) { let d = "HTTP " + r.status; try { const j = await r.json(); d += " — " + (j.error?.message || j.message || JSON.stringify(j)); } catch (_) {} throw new Error(d); }
      const j = await r.json();
      const url = j.images?.[0]?.url || j.data?.[0]?.url || j.image?.url || j.url ||
        (j.data?.[0]?.b64_json ? "data:image/png;base64," + j.data[0].b64_json : null);
      if (!url) throw new Error("No image in response.");
      return url;
    }

    // ---- file attachments ----
    const promptEl = body.querySelector(".cop-prompt");
    const filesEl = body.querySelector(".cop-files");
    const fileInput = body.querySelector(".cop-file-input");
    const attachBtn = body.querySelector(".cop-attach");
    let pendingFiles = []; // {name, type, size, dataUrl?}

    function refreshPromptState() {
      const empty = !ta.value.trim() && pendingFiles.length === 0;
      promptEl.dataset.empty = empty ? "true" : "false";
    }

    function renderFiles() {
      filesEl.innerHTML = "";
      pendingFiles.forEach((f, i) => {
        const chip = el(`<div class="cop-file">
          ${f.dataUrl ? `<img src="${f.dataUrl}" alt="">` : `<span class="cop-file-ic">${FILE_SVG}</span>`}
          <span class="cop-file-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</span>
          <button class="cop-file-x" title="Remove">${X_SVG}</button>
        </div>`);
        chip.querySelector(".cop-file-x").onclick = () => { pendingFiles.splice(i, 1); renderFiles(); refreshPromptState(); };
        filesEl.appendChild(chip);
      });
      filesEl.style.display = pendingFiles.length ? "flex" : "none";
    }

    function addFiles(list) {
      const maxAtt = planCfg().attach;
      for (const f of list) {
        if (f.size > 10 * 1024 * 1024) { alert(`"${f.name}" is over 10MB and was skipped.`); continue; }
        if (pendingFiles.length >= maxAtt) {
          if (maxAtt === Infinity) break;
          showLimit(body, planCfg().id === "basic" ? "The Basic plan allows 1 attachment. Upgrade for more." : "You've reached " + maxAtt + " attachments on " + planCfg().name + ". Upgrade for more.");
          break;
        }
        const entry = { name: f.name, type: f.type, size: f.size };
        pendingFiles.push(entry);
        if (f.type.startsWith("image/")) {
          const r = new FileReader();
          r.onload = (ev) => { entry.dataUrl = ev.target.result; renderFiles(); };
          r.readAsDataURL(f);
        }
      }
      renderFiles(); refreshPromptState();
    }

    attachBtn.onclick = () => fileInput.click();
    fileInput.onchange = () => { if (fileInput.files) addFiles(fileInput.files); fileInput.value = ""; };

    // drag and drop
    ["dragenter", "dragover"].forEach((evt) => promptEl.addEventListener(evt, (e) => { e.preventDefault(); promptEl.classList.add("drag"); }));
    ["dragleave", "drop"].forEach((evt) => promptEl.addEventListener(evt, (e) => { e.preventDefault(); promptEl.classList.remove("drag"); }));
    promptEl.addEventListener("drop", (e) => { if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files); });

    // paste images
    ta.addEventListener("paste", (e) => {
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      const imgs = [];
      for (const it of items) { if (it.type && it.type.startsWith("image/")) { const f = it.getAsFile(); if (f) imgs.push(f); } }
      if (imgs.length) { e.preventDefault(); addFiles(imgs); }
    });

    function paint() {
      updateUsage();
      msgs.innerHTML = "";
      if (!activeConv().history.length) {
        const hero = el(`<div class="cop-hero cop-hero-m365">
          ${LOGO("cop-logo big-logo")}
          <h2>Message Copilot</h2>
          <p class="muted">Chat, draft, summarize, or create an image — with your Microsoft 365 apps.</p>
          <div class="cop-cards"></div>
        </div>`);
        const cards = hero.querySelector(".cop-cards");
        SUGGEST.forEach((s) => {
          const card = el(`<button class="cop-card">${DOC_SVG}<span class="cop-card-t">${escapeHtml(s.title)}</span><span class="cop-card-s">${escapeHtml(s.sub)}</span></button>`);
          card.onclick = () => { ta.value = s.prompt; ta.dispatchEvent(new Event("input")); send(); };
          cards.appendChild(card);
        });
        msgs.appendChild(hero);
        return;
      }
      activeConv().history.forEach((m) => addBubble(m));
    }
    function viewImage(src) {
      const ov = el(`<div class="bf-mask"><div class="bf-big"><div class="bf-big-img"><img src="${src}" alt=""></div><div class="row" style="justify-content:center"><button class="btn-text" id="cl">Close</button></div></div></div>`);
      ov.querySelector("#cl").onclick = () => ov.remove();
      ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
      document.getElementById("screen").appendChild(ov);
    }
    function addBubble(msg) {
      const who = msg.role === "user" ? "user" : "bot";
      const avatar = who === "bot" ? LOGO("cop-logo") : `${Icon.mini("user", S().profile.username)}`;
      let inner = "";
      if (msg.content) inner += `<div class="cop-text">${escapeHtml(msg.content)}</div>`;
      const imgs = (msg.images || []).concat(msg.image ? [msg.image] : []);
      imgs.forEach((u) => inner += `<img class="cop-img" src="${u}" alt="">`);
      const bubble = el(`<div class="cop-msg ${who}"><div style="flex:0 0 auto">${avatar}</div><div class="cop-bubble">${inner || "&nbsp;"}</div></div>`);
      bubble.querySelectorAll(".cop-img").forEach((im) => im.onclick = () => viewImage(im.src));
      msgs.appendChild(bubble);
      msgs.scrollTop = msgs.scrollHeight;
      return bubble;
    }

    async function send() {
      const text = ta.value.trim();
      if (!text && pendingFiles.length === 0) return;
      // Daily message limit per plan.
      const p = planCfg(), u = usage();
      if (u.messages >= p.msgs) { showLimit(body, "You've used all " + p.msgs + " messages today on " + p.name + ". Upgrade for more."); return; }
      const images = pendingFiles.filter((f) => f.dataUrl).map((f) => f.dataUrl);
      const otherNames = pendingFiles.filter((f) => !f.dataUrl).map((f) => f.name);
      const note = otherNames.length ? "[Attached: " + otherNames.join(", ") + "]" : "";
      const content = [note, text].filter(Boolean).join("\n").trim();
      ta.value = ""; ta.style.height = "auto";
      pendingFiles = []; renderFiles(); refreshPromptState();
      if (msgs.querySelector(".cop-hero")) msgs.innerHTML = "";
      const userMsg = { role: "user", content };
      if (images.length) userMsg.images = images;
      const conv = activeConv();
      conv.history.push(userMsg);
      if (conv.history.filter((m) => m.role === "user").length === 1) { conv.title = convTitle(conv.history); renderConvos(); }
      u.messages++; State.save(); updateUsage();
      addBubble(userMsg);

      const typing = el(`<div class="cop-msg bot"><div style="flex:0 0 auto">${LOGO("cop-logo")}</div><div class="cop-bubble"><div class="cop-typing"><span></span><span></span><span></span></div></div></div>`);
      msgs.appendChild(typing); msgs.scrollTop = msgs.scrollHeight;
      sendBtn.disabled = true;

      try {
        const reply = await callApi(conv.history);
        typing.remove();
        const m = reply.match(/\[\[IMAGE:\s*([\s\S]+?)\]\]/i);
        if (m) {
          const imgPrompt = m[1].trim();
          const caption = reply.replace(/\[\[IMAGE:[\s\S]+?\]\]/i, "").trim();
          // Image-generation limit per plan.
          const pp = planCfg(), uu = usage();
          if (uu.images >= pp.images) {
            const am = { role: "assistant", content: pp.images === 0
              ? "Image generation isn't available on the Basic plan. Upgrade to Copilot+ or Advanced to create images."
              : "You've reached your " + pp.images + " images for today on " + pp.name + ". Upgrade to Advanced for more." };
            conv.history.push(am); State.save(); addBubble(am);
            showPlans(body);
          } else {
            const gen = el(`<div class="cop-msg bot"><div style="flex:0 0 auto">${LOGO("cop-logo")}</div><div class="cop-bubble"><span class="cop-text">Creating your image…</span><div class="cop-img-skeleton"><div class="cop-skel-shine"></div><svg viewBox="0 0 24 24" class="cop-skel-ic" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.6"/><path d="M4 18l5-5 4 4 3-3 4 4"/></svg></div></div></div>`);
            msgs.appendChild(gen); msgs.scrollTop = msgs.scrollHeight;
            try {
              const url = await generateImage(imgPrompt);
              gen.remove();
              uu.images++; State.save(); updateUsage();
              const am = { role: "assistant", content: caption || `Here's "${imgPrompt}".`, image: url };
              conv.history.push(am); State.save(); addBubble(am);
            } catch (e) {
              gen.remove();
              const am = { role: "assistant", content: "I couldn't create that image.\n\n" + (e.message || e) };
              conv.history.push(am); State.save(); addBubble(am);
            }
          }
        } else {
          const am = { role: "assistant", content: reply };
          conv.history.push(am); State.save(); addBubble(am);
          if (voiceOn || (speakToggle && speakToggle.checked)) speak(reply);
        }
      } catch (err) {
        typing.remove();
        addBubble({ role: "assistant", content: "Couldn't reach the AI service.\n\n" + (err && err.message ? err.message : err) +
          "\n\nIf this is a CORS or network error, the API likely needs to be called from a small backend rather than directly from the browser." });
      } finally {
        sendBtn.disabled = false;
      }
    }

    sendBtn.onclick = send;
    ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } });
    ta.addEventListener("input", () => { ta.style.height = "auto"; ta.style.height = Math.min(120, ta.scrollHeight) + "px"; refreshPromptState(); });
    refreshPromptState();
    paint();
  }

  function upgradeTo(planId, body) {
    const p = PLANS[planId];
    if (p.price > 0) {
      const bal = S().bank && S().bank.balance;
      if (bal != null && bal < p.price) { alert("Not enough balance in Forge Bank to subscribe. Earn some in Forge Bank first."); return; }
      try { if (State.addTransaction) State.addTransaction({ vendor: "Microsoft Copilot", item: p.name + " subscription", amount: p.price, refundable: false }); } catch (_) {}
    }
    cop().plan = planId; State.save();
    if (window.Notify) Notify.show({ icon: "", title: "Copilot " + p.name, body: p.price ? "Subscribed — $" + p.price.toFixed(2) + "/mo (pretend)" : "Switched to Basic" });
    document.querySelectorAll(".cop-plans-ov").forEach((m) => m.remove());
    render(body);
  }
  function showPlans(body) {
    document.querySelectorAll(".cop-plans-ov").forEach((m) => m.remove());
    const cur = cop().plan || "basic";
    const cards = Object.keys(PLANS).map((k) => PLANS[k]).map((p) => `
      <div class="cop-plan-card cop-plan-${p.id} ${p.id === cur ? "current" : ""}">
        <div class="cop-pc-name">${p.name}</div>
        <div class="cop-pc-blurb">${p.blurb}</div>
        <div class="cop-pc-price">${p.price ? "$" + p.price.toFixed(2) + "<small> /mo</small>" : "Free"}</div>
        <ul class="cop-pc-feats">
          <li>${p.msgs === Infinity ? "Unlimited" : p.msgs} messages a day</li>
          <li>${p.attach === Infinity ? "Unlimited" : p.attach} attachment${p.attach === 1 ? "" : "s"} per message</li>
          <li>${p.images ? p.images + " image generations a day" : "No image generation"}</li>
        </ul>
        <button class="cop-pc-btn" data-p="${p.id}" ${p.id === cur ? "disabled" : ""}>${p.id === cur ? "Current plan" : (p.price ? "Get " + p.name : "Switch to Basic")}</button>
      </div>`).join("");
    const ov = el(`<div class="cop-plans-ov"><div class="cop-plans"><div class="cop-plans-head">${LOGO("cop-logo")}<b>Choose your Copilot plan</b><span class="grow"></span><button class="cop-plans-x">${X_SVG}</button></div><div class="cop-plans-grid">${cards}</div><p class="cop-plans-note">This is pretend money — subscriptions are billed to Forge Bank, not a real card.</p></div></div>`);
    ov.querySelector(".cop-plans-x").onclick = () => ov.remove();
    ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
    ov.querySelectorAll(".cop-pc-btn[data-p]").forEach((b) => b.onclick = () => upgradeTo(b.dataset.p, body));
    body.appendChild(ov);
  }
  function showLimit(body, msg) { if (window.Notify) Notify.show({ icon: "", title: "Copilot", body: msg }); showPlans(body); }

  function systemPrompt() {
    const langName = ((window.I18n && I18n.languages.find((l) => l.code === I18n.lang)) || { name: "English" }).name;
    return `You are Copilot, a friendly and helpful AI assistant built into Windows 12. Always respond in ${langName}, regardless of the language of the question.

If the user asks you to create, generate, draw, make, or design an image, picture, photo, wallpaper, logo, or artwork, do NOT describe it in words. Instead reply with exactly one line in this format and nothing else:
[[IMAGE: a vivid, detailed description of the image to generate]]
Write that description in English for best results. When the user sends you an image, look at it and answer their question about it normally.`;
  }

  async function callApi(history) {
    const model = activeModel();
    // phi-2 (and other base models) use /v1/completions with a flat prompt.
    // Chat-tuned models use /v1/chat/completions with a messages array.
    const isCompletion = /phi-2|davinci|babbage|llama-(?!2-chat)/i.test(model);
    if (isCompletion) {
      const recent = history.slice(-20);
      const lines = [systemPrompt() + "\n"];
      recent.forEach((m) => lines.push((m.role === "user" ? "User: " : "Assistant: ") + m.content));
      lines.push("Assistant:");
      const res = await fetch(COMPLETIONS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + activeKey() },
        body: JSON.stringify({ model, prompt: lines.join("\n"), max_tokens: 400, stop: ["\nUser:"] }),
      });
      if (!res.ok) { let d = "HTTP " + res.status; try { const j = await res.json(); d += " — " + (j.error?.message || j.message || JSON.stringify(j)); } catch (e) {} throw new Error(d); }
      const data = await res.json();
      const t = (data.choices?.[0]?.text || "").trim();
      return t || "(no response)";
    }
    const messages = [{ role: "system", content: systemPrompt() }];
    history.slice(-20).forEach((m) => {
      if (m.role === "user" && m.images && m.images.length) {
        // Vision format: text + one or more image parts.
        const parts = [];
        if (m.content) parts.push({ type: "text", text: m.content });
        m.images.forEach((u) => parts.push({ type: "image_url", image_url: { url: u } }));
        messages.push({ role: "user", content: parts });
      } else if (m.role === "assistant" && m.image) {
        messages.push({ role: "assistant", content: m.content || "[generated an image]" });
      } else {
        messages.push({ role: m.role, content: m.content });
      }
    });
    const res = await fetch(CHAT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + activeKey() },
      body: JSON.stringify({ model, messages }),
    });
    if (!res.ok) {
      let detail = "HTTP " + res.status;
      try { const j = await res.json(); detail += " — " + (j.error?.message || j.message || JSON.stringify(j)); } catch (e) {}
      throw new Error(detail);
    }
    const data = await res.json();
    return (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "(no response)";
  }

  function renderKeyForm(body) {
    body.innerHTML = `<div class="cop"><div class="cop-keyform">
      ${LOGO("cop-logo big-logo")}
      <h2 style="margin:.4rem 0">Connect Copilot</h2>
      <p class="muted">Paste your AIML API key. It's stored only in this browser and is never saved into the app's code.</p>
      <input type="password" placeholder="API key (optional — a default is built in)" value="${S().copilot.apiKey || ""}">
      <button class="pill-btn" style="width:100%">Save & start chatting</button>
      <p class="muted" style="font-size:.78rem;margin-top:14px">Model: ${DEFAULT_MODEL}. If the browser blocks the request (CORS), the key needs a small server instead.</p>
    </div></div>`;
    const keyInput = body.querySelector("input");
    body.querySelector("button").onclick = () => {
      S().copilot.apiKey = keyInput.value.trim();
      State.save();
      render(body);
    };
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }
})();
