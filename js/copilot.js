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

  AppRegistry.copilot = function () {
    const { body } = window.WM.createWindow({ title: "Copilot", icon: LOGO("cop-logo"), width: 460, height: 620, appId: "copilot" });
    render(body);
  };

  function render(body) {
    if (!activeKey()) return renderKeyForm(body);
    body.innerHTML = `
      <div class="cop">
        <div class="cop-head">${LOGO("cop-logo")}<span class="ttl">Copilot</span><span class="grow"></span>
          <label class="container spk" title="Speak replies aloud">
            <input type="checkbox">
            <svg class="mute" xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 0 24 24" width="20"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" style="opacity:.35"></path><line x1="3" y1="21" x2="21" y2="3" stroke="currentColor" stroke-width="2"/></svg>
            <svg class="voice" xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 0 24 24" width="20"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"></path></svg>
          </label>
          <button class="clear">Clear</button><button class="setkey">API key</button></div>
        <div class="cop-msgs"></div>
        <div class="cop-prompt" data-empty="true">
          <div class="cop-files"></div>
          <textarea class="cop-ta" rows="1" placeholder="Message Copilot..."></textarea>
          <div class="cop-prompt-bar">
            <button class="cop-mic mic" title="Voice mode">${MIC_SVG}</button>
            <button class="cop-attach" title="Attach file">${CLIP_SVG}</button>
            <span class="grow"></span>
            <button class="cop-send" title="Send">${SEND_SVG}</button>
          </div>
          <input type="file" class="cop-file-input" multiple style="display:none">
        </div>
      </div>`;
    const msgs = body.querySelector(".cop-msgs");
    const ta = body.querySelector("textarea");
    const sendBtn = body.querySelector(".cop-send");
    const micBtn = body.querySelector(".cop-mic");
    const speakToggle = body.querySelector(".spk input");

    body.querySelector(".setkey").onclick = () => renderKeyForm(body);
    body.querySelector(".clear").onclick = () => { S().copilot.history = []; State.save(); paint(); };

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
      for (const f of list) {
        if (f.size > 10 * 1024 * 1024) { alert(`"${f.name}" is over 10MB and was skipped.`); continue; }
        if (pendingFiles.length >= 5) { alert("Up to 5 files at a time."); break; }
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
      msgs.innerHTML = "";
      if (!S().copilot.history.length) {
        msgs.appendChild(el(`<div class="cop-hero">${LOGO("cop-logo big-logo")}<h2>Hi, I'm Copilot</h2><p class="muted">Ask me anything, send a photo, or ask me to create an image.</p></div>`));
        return;
      }
      S().copilot.history.forEach((m) => addBubble(m));
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
      const images = pendingFiles.filter((f) => f.dataUrl).map((f) => f.dataUrl);
      const otherNames = pendingFiles.filter((f) => !f.dataUrl).map((f) => f.name);
      const note = otherNames.length ? "[Attached: " + otherNames.join(", ") + "]" : "";
      const content = [note, text].filter(Boolean).join("\n").trim();
      ta.value = ""; ta.style.height = "auto";
      pendingFiles = []; renderFiles(); refreshPromptState();
      if (msgs.querySelector(".cop-hero")) msgs.innerHTML = "";
      const userMsg = { role: "user", content };
      if (images.length) userMsg.images = images;
      S().copilot.history.push(userMsg); State.save();
      addBubble(userMsg);

      const typing = el(`<div class="cop-msg bot"><div style="flex:0 0 auto">${LOGO("cop-logo")}</div><div class="cop-bubble"><div class="cop-typing"><span></span><span></span><span></span></div></div></div>`);
      msgs.appendChild(typing); msgs.scrollTop = msgs.scrollHeight;
      sendBtn.disabled = true;

      try {
        const reply = await callApi(S().copilot.history);
        typing.remove();
        const m = reply.match(/\[\[IMAGE:\s*([\s\S]+?)\]\]/i);
        if (m) {
          const imgPrompt = m[1].trim();
          const caption = reply.replace(/\[\[IMAGE:[\s\S]+?\]\]/i, "").trim();
          const gen = el(`<div class="cop-msg bot"><div style="flex:0 0 auto">${LOGO("cop-logo")}</div><div class="cop-bubble"><span class="cop-text">Creating your image…</span><div class="cop-typing"><span></span><span></span><span></span></div></div></div>`);
          msgs.appendChild(gen); msgs.scrollTop = msgs.scrollHeight;
          try {
            const url = await generateImage(imgPrompt);
            gen.remove();
            const am = { role: "assistant", content: caption || `Here's "${imgPrompt}".`, image: url };
            S().copilot.history.push(am); State.save(); addBubble(am);
          } catch (e) {
            gen.remove();
            const am = { role: "assistant", content: "I couldn't create that image.\n\n" + (e.message || e) };
            S().copilot.history.push(am); State.save(); addBubble(am);
          }
        } else {
          const am = { role: "assistant", content: reply };
          S().copilot.history.push(am); State.save(); addBubble(am);
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
