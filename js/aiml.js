/* Shared AIML API key and base URL.
   The key is hardcoded per user request; rotate it whenever you're done. */
window.AIML_KEY = "c8a1efa1c822ea8d82c0fe53f13b893e";
window.AIML_BASE = "https://api.aimlapi.com/v1";

/* AviationStack (flight data) for the FlightStats site.
   Free-tier AviationStack only serves over HTTP, which an HTTPS page blocks as
   mixed content — so we route through a public HTTPS read proxy. If the proxy
   is down or the key is out of quota, the site falls back to placeholder data. */
window.FLIGHT_API = {
  key: "3d2cdb800b6b92b0738df8ce393967e8",
  http: "http://api.aviationstack.com/v1",
  proxy: "https://api.allorigins.win/raw?url=",
};

/* Brandfetch — real brand logos for the icon picker & DoorDash Retail.
   Hardcoded per user request (rotate it whenever you're done). The Brand API
   returns CORS access-control-allow-origin:* so it works straight from the
   browser. If it's ever unavailable we fall back to a keyless favicon source. */
window.BRANDFETCH_API_KEY = "2aGHRy7xjDUaw49bTCmi/wFKDwb0iVIavy10eg3evno=";
window.BRANDFETCH_BASE = "https://api.brandfetch.io/v2";

/* Poof (poof.bg) — used by Canva's "Remove background" on image elements.
   POST https://api.poof.bg/v1/remove with header x-api-key and a multipart
   image_file; returns the cut-out PNG as binary. */
window.POOF_API_KEY = "pk_471c354e1dd7facbeb1c54d4ace3d3ac";

/* GIPHY — powers the GIPHY app in Canva's Apps panel. GET the search/trending
   endpoints with api_key in the query; the API is CORS-enabled for browsers. */
window.GIPHY_API_KEY = "k6lB9GA3q2cXzeOfXVS2UROmXC1RjLoS";

/* QRCoder — powers the QR Code generator. GET the v4 endpoint with key + text;
   returns a QR PNG that can be used straight as an <img src>. */
window.QRCODER_API_KEY = "ZMlBVgqOiHv1aobL3F6kTn4AwPKW8Chc";

/* Shared AI text generation — used by Copilot-style "generate text" buttons in
   apps like Word and Acrobat. Chat-completions against the AIML (OpenAI-compatible)
   endpoint. Returns the generated text, or throws on error. */
window.AIText = {
  async generate(prompt, opts) {
    opts = opts || {};
    let key = window.AIML_KEY;
    try { if (window.State && State.data && State.data.copilot && State.data.copilot.apiKey) key = State.data.copilot.apiKey; } catch (e) {}
    const sys = opts.system || "You are a helpful writing assistant. Write clear, well-structured prose. Return only the requested text — no preamble, no markdown fences, no commentary.";
    const res = await fetch(window.AIML_BASE + "/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
      body: JSON.stringify({
        model: opts.model || "openai/gpt-4o-mini",
        messages: [{ role: "system", content: sys }, { role: "user", content: prompt }],
        max_tokens: opts.max || 700,
        temperature: opts.temperature == null ? 0.8 : opts.temperature,
      }),
    });
    if (!res.ok) { let d = "HTTP " + res.status; try { const j = await res.json(); d += " — " + (j.error && j.error.message || j.message || ""); } catch (e) {} throw new Error(d); }
    const data = await res.json();
    return ((data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "").trim();
  },
  // Popover: ask what to write, generate, and resolve the text (or null if cancelled).
  compose(opts) {
    opts = opts || {};
    return new Promise((resolve) => {
      const host = document.getElementById("screen") || document.body;
      const wrap = document.createElement("div");
      wrap.className = "aitext-modal";
      wrap.innerHTML =
        '<div class="aitext-card">' +
        '<div class="aitext-head"><img src="assets/ai_gen.png?v=1" alt=""><b>' + (opts.title || "Generate text with AI") + "</b></div>" +
        '<textarea class="aitext-in" rows="3" placeholder="' + (opts.placeholder || "Describe what to write…") + '"></textarea>' +
        '<div class="aitext-err"></div>' +
        '<div class="aitext-foot"><button class="aitext-cancel">Cancel</button><button class="aitext-go">Generate</button></div>' +
        "</div>";
      host.appendChild(wrap);
      const ta = wrap.querySelector(".aitext-in"), go = wrap.querySelector(".aitext-go"), err = wrap.querySelector(".aitext-err");
      const close = (v) => { wrap.remove(); resolve(v); };
      setTimeout(() => ta.focus(), 30);
      wrap.querySelector(".aitext-cancel").onclick = () => close(null);
      wrap.addEventListener("mousedown", (e) => { if (e.target === wrap) close(null); });
      async function run() {
        const p = ta.value.trim(); if (!p) { ta.focus(); return; }
        go.disabled = true; go.textContent = "Generating…"; err.textContent = "";
        try {
          const text = await window.AIText.generate(opts.prefix ? opts.prefix + " " + p : p, opts);
          close(text || "");
        } catch (e) { err.textContent = "Couldn't generate — " + (e.message || e); go.disabled = false; go.textContent = "Generate"; }
      }
      go.onclick = run;
      ta.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) run(); if (e.key === "Escape") close(null); });
    });
  },
};
