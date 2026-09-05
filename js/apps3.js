/* AI-powered apps: Image Studio (image generation) and Text (phi-2 completion). */
(function () {
  "use strict";
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  const S = () => State.data;
  const cw = (opts) => window.WM.createWindow(opts);
  const KEY = () => window.AIML_KEY;
  const BASE = () => window.AIML_BASE;

  // ---------- Image Studio ----------
  AppRegistry.imagestudio = function () {
    const { body } = cw({ title: "Image Studio", icon: Icon.mini("imagestudio", "Image"), width: 720, height: 580 });
    body.innerHTML = `
      <div class="imgstudio">
        <div class="imgstudio-bar">
          <textarea id="prompt" rows="2" placeholder="Describe an image: a jellyfish in the ocean, neon city at night, a dragon made of cake..."></textarea>
          <button class="pill-btn" id="gen">Generate</button>
        </div>
        <div class="imgstudio-gallery" id="gallery"></div>
      </div>`;
    const ta = body.querySelector("#prompt"), btn = body.querySelector("#gen"), gallery = body.querySelector("#gallery");
    if (S().appData.imageGen == null) S().appData.imageGen = [];
    const history = S().appData.imageGen;

    function renderGallery() {
      gallery.innerHTML = "";
      if (!history.length) {
        gallery.innerHTML = `<div class="muted" style="text-align:center;padding:40px">No images yet. Try a prompt above.</div>`;
        return;
      }
      history.forEach((item, idx) => {
        const card = el(`<div class="img-card">
          <img src="${item.url}" alt="" onerror="this.style.opacity=.3;this.alt='(image expired)'">
          <div class="img-meta"><div class="img-prompt">${escapeHtml(item.prompt)}</div>
          <button class="btn-text del">Remove</button></div></div>`);
        card.querySelector(".del").onclick = () => { history.splice(idx, 1); State.save(); renderGallery(); };
        gallery.appendChild(card);
      });
    }
    renderGallery();

    btn.onclick = async () => {
      const prompt = ta.value.trim();
      if (!prompt) return;
      btn.disabled = true; btn.textContent = "Generating...";
      let aborted = false;
      const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
      const job = window.ProgressUI ? ProgressUI.show(body, {
        title: "Creating your image…", subtitle: `“${prompt.slice(0, 60)}”`, etaMs: 14000,
        onCancel: () => { aborted = true; if (ctrl) ctrl.abort(); btn.disabled = false; btn.textContent = "Generate"; },
      }) : null;
      try {
        const r = await fetch(BASE() + "/images/generations", {
          method: "POST", signal: ctrl ? ctrl.signal : undefined,
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + KEY() },
          body: JSON.stringify({ model: "google/nano-banana-2", prompt }),
        });
        if (aborted) return;
        if (!r.ok) throw new Error("HTTP " + r.status);
        const j = await r.json();
        const url = j.images?.[0]?.url || j.data?.[0]?.url || j.image?.url || j.url;
        if (!url) throw new Error("No image in response: " + JSON.stringify(j).slice(0, 200));
        history.unshift({ url, prompt, ts: Date.now() });
        State.save();
        if (job) job.complete(renderGallery); else renderGallery();
        ta.value = "";
      } catch (e) {
        if (aborted || (e && e.name === "AbortError")) return;
        if (job) job.remove();
        alert("Image generation failed: " + (e.message || e));
      }
      if (!aborted) { btn.disabled = false; btn.textContent = "Generate"; }
    };
  };

  // ---------- Text (phi-2 completion) ----------
  AppRegistry.textgen = function () {
    const { body } = cw({ title: "AI Text", icon: Icon.mini("textgen", "Text"), width: 560, height: 520 });
    body.innerHTML = `
      <div style="padding:18px;display:flex;flex-direction:column;gap:12px;height:100%">
        <div>
          <h2 style="margin:0">AI Text</h2>
          <div class="muted">Write a starting prompt and let phi-2 continue it.</div>
        </div>
        <textarea id="prompt" rows="5" placeholder="Once upon a time in a small town..." style="padding:12px;border-radius:8px;border:1px solid var(--border);background:var(--bg-elev);color:var(--text);font-size:.95rem;resize:vertical"></textarea>
        <div class="row"><button class="pill-btn" id="gen">Continue</button><span class="grow"></span><button class="btn-text" id="clr">Clear output</button></div>
        <div id="out" style="flex:1;overflow:auto;padding:14px;border:1px dashed var(--border);border-radius:8px;white-space:pre-wrap;line-height:1.5"></div>
      </div>`;
    const ta = body.querySelector("#prompt"), btn = body.querySelector("#gen"), out = body.querySelector("#out");
    body.querySelector("#clr").onclick = () => { out.textContent = ""; };
    btn.onclick = async () => {
      const prompt = ta.value;
      if (!prompt.trim()) return;
      btn.disabled = true; const old = btn.textContent; btn.textContent = "Thinking...";
      out.textContent = "";
      try {
        const r = await fetch(BASE() + "/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + KEY() },
          body: JSON.stringify({ model: "microsoft/phi-2", prompt }),
        });
        if (!r.ok) throw new Error("HTTP " + r.status);
        const j = await r.json();
        const text = j.choices?.[0]?.text || j.text || "(no text in response)";
        out.textContent = text;
      } catch (e) { out.textContent = "Error: " + (e.message || e); }
      btn.disabled = false; btn.textContent = old;
    };
  };

  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
})();
