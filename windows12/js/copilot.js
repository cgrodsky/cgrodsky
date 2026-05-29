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
  const DEFAULT_MODEL = "microsoft/phi-2";
  const activeKey = () => S().copilot.apiKey || window.AIML_KEY;
  const activeModel = () => DEFAULT_MODEL;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  const LOGO = (cls) => `<div class="${cls}"><div class="ring"></div><div class="dot"></div></div>`;
  const SEND_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 12l16-8-6 16-3-7-7-1z" fill="#fff"/></svg>`;
  const MIC_SVG = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/></svg>`;

  AppRegistry.copilot = function () {
    const { body } = window.WM.createWindow({ title: "Copilot", icon: LOGO("cop-logo"), width: 460, height: 620, appId: "copilot" });
    render(body);
  };

  function render(body) {
    if (!activeKey()) return renderKeyForm(body);
    body.innerHTML = `
      <div class="cop">
        <div class="cop-head">${LOGO("cop-logo")}<span class="ttl">Copilot</span><span class="grow"></span>
          <button class="mic" title="Voice mode">${MIC_SVG}</button>
          <button class="clear">Clear</button><button class="setkey">API key</button></div>
        <div class="cop-msgs"></div>
        <div class="cop-input">
          <textarea rows="1" placeholder="Message Copilot..."></textarea>
          <button class="cop-send" title="Send">${SEND_SVG}</button>
        </div>
      </div>`;
    const msgs = body.querySelector(".cop-msgs");
    const ta = body.querySelector("textarea");
    const sendBtn = body.querySelector(".cop-send");
    const micBtn = body.querySelector(".mic");

    body.querySelector(".setkey").onclick = () => renderKeyForm(body);
    body.querySelector(".clear").onclick = () => { S().copilot.history = []; State.save(); paint(); };

    // ---- Voice mode (browser STT + AIML TTS) ----
    let voiceOn = false, rec = null, audioEl = null;
    function setMicVisual() { micBtn.classList.toggle("active", voiceOn); }
    micBtn.onclick = () => {
      if (!SR) { addBubble("assistant", "Voice mode needs Chrome or Edge — your browser doesn't support speech recognition."); return; }
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

    function paint() {
      msgs.innerHTML = "";
      if (!S().copilot.history.length) {
        msgs.appendChild(el(`<div class="cop-hero">${LOGO("cop-logo big-logo")}<h2>Hi, I'm Copilot</h2><p class="muted">Ask me anything to get started.</p></div>`));
        return;
      }
      S().copilot.history.forEach((m) => addBubble(m.role, m.content));
    }
    function addBubble(role, content) {
      const who = role === "user" ? "user" : "bot";
      const avatar = who === "bot" ? LOGO("cop-logo") : `${Icon.mini("user", S().profile.username)}`;
      msgs.appendChild(el(`<div class="cop-msg ${who}"><div style="flex:0 0 auto">${avatar}</div><div class="cop-bubble">${escapeHtml(content)}</div></div>`));
      msgs.scrollTop = msgs.scrollHeight;
    }

    async function send() {
      const text = ta.value.trim();
      if (!text) return;
      ta.value = ""; ta.style.height = "auto";
      if (msgs.querySelector(".cop-hero")) msgs.innerHTML = "";
      S().copilot.history.push({ role: "user", content: text });
      State.save();
      addBubble("user", text);

      const typing = el(`<div class="cop-msg bot"><div style="flex:0 0 auto">${LOGO("cop-logo")}</div><div class="cop-bubble"><div class="cop-typing"><span></span><span></span><span></span></div></div></div>`);
      msgs.appendChild(typing); msgs.scrollTop = msgs.scrollHeight;
      sendBtn.disabled = true;

      try {
        const reply = await callApi(S().copilot.history);
        typing.remove();
        S().copilot.history.push({ role: "assistant", content: reply });
        State.save();
        addBubble("assistant", reply);
        if (voiceOn) speak(reply);
      } catch (err) {
        typing.remove();
        addBubble("assistant", "Couldn't reach the AI service.\n\n" + (err && err.message ? err.message : err) +
          "\n\nIf this is a CORS or network error, the API likely needs to be called from a small backend rather than directly from the browser.");
      } finally {
        sendBtn.disabled = false;
      }
    }

    sendBtn.onclick = send;
    ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } });
    ta.addEventListener("input", () => { ta.style.height = "auto"; ta.style.height = Math.min(120, ta.scrollHeight) + "px"; });
    paint();
  }

  async function callApi(history) {
    const model = activeModel();
    // phi-2 (and other base models) use /v1/completions with a flat prompt.
    // Chat-tuned models use /v1/chat/completions with a messages array.
    const isCompletion = /phi-2|davinci|babbage|llama-(?!2-chat)/i.test(model);
    if (isCompletion) {
      const recent = history.slice(-20);
      const lines = ["You are Copilot, a friendly and helpful AI assistant built into Windows 12.\n"];
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
    const messages = [{ role: "system", content: "You are Copilot, a friendly and helpful AI assistant built into Windows 12." }]
      .concat(history.slice(-20));
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
