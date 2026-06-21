/* Edge browser: custom sites for 5 known hosts, generic iframe embed for everything else. */
(function () {
  "use strict";

  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }

  const SPECIAL = {
    "bank": "bank", "bank.local": "bank",
    "amazon": "amazon", "amazon.local": "amazon", "amazon.com": "amazon",
    "microsoft": "microsoft", "microsoft.local": "microsoft", "microsoft.com": "microsoft",
    "youtube": "youtube", "youtube.local": "youtube", "youtube.com": "youtube",
    "discord": "discord", "discord.local": "discord", "discord.com": "discord",
    "duolingo": "duolingo", "duolingo.local": "duolingo", "duolingo.com": "duolingo",
  };

  function resolveSpecial(input) {
    const raw = (input || "").trim().toLowerCase();
    if (!raw || raw === "home" || raw === "newtab" || raw === "about:home") return "home";
    const key = raw.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
    return SPECIAL[key] || SPECIAL[raw] || null;
  }

  function renderHome(ctx) {
    const colors = ["#4285F4", "#EA4335", "#FBBC05", "#4285F4", "#34A853", "#EA4335"];
    const letters = "Google".split("").map((ch, i) => `<span style="color:${colors[i]}">${ch}</span>`).join("");
    const page = el(`<div class="google-home">
      <div class="google-logo">${letters}</div>
      <form class="searchbar" autocomplete="off">
        <div class="searchbar-wrapper">
          <div class="searchbar-left"><div class="search-icon-wrapper"><span class="search-icon searchbar-icon">
            <svg focusable="false" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"></path></svg>
          </span></div></div>
          <div class="searchbar-center">
            <input class="searchbar-input" type="text" placeholder="Search Google or type a URL" autofocus>
          </div>
          <div class="searchbar-right">
            <button type="button" class="voice-search" title="Voice search">
              <svg class="searchbar-icon" viewBox="0 0 24 24" style="height:24px;width:24px"><path fill="#4285f4" d="M12 15c1.66 0 3-1.31 3-2.97V5c0-1.66-1.34-3-3-3S9 3.34 9 5v7.03C9 13.69 10.34 15 12 15z"></path><path fill="#34a853" d="M11 18.08h2V21h-2z"></path><path fill="#fbbc05" d="M7.05 16.87C5.78 15.59 5 13.83 5 12h2c0 2.76 2.24 5 5 5s5-2.24 5-5h2c0 1.83-.78 3.59-2.05 4.87z" transform="translate(0 -1)"></path><path fill="#ea4335" d="M12 17c-2.76 0-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-2.08c3.39-.49 6-3.39 6-6.92h-2c0 2.76-2.24 5-5 5z"></path></svg>
            </button>
          </div>
        </div>
      </form>
      <div class="google-shortcuts"></div>
    </div>`);
    const shortcuts = page.querySelector(".google-shortcuts");
    Catalog.bookmarks.forEach((b) => {
      const sc = el(`<button class="google-sc"><span class="g-sc-ic">${Icon.md(b.label.toLowerCase(), b.label)}</span><span class="g-sc-lb">${b.label}</span></button>`);
      sc.onclick = () => ctx.navigate(b.url);
      shortcuts.appendChild(sc);
    });
    const input = page.querySelector(".searchbar-input");
    page.querySelector("form").onsubmit = (e) => { e.preventDefault(); const q = input.value.trim(); if (q) ctx.navigate(q); };
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    page.querySelector(".voice-search").onclick = () => {
      if (!SR) { input.focus(); return; }
      try {
        const rec = new SR(); rec.lang = "en-US"; rec.interimResults = false;
        rec.onresult = (ev) => { input.value = ev.results[0][0].transcript; ctx.navigate(input.value.trim()); };
        rec.start();
      } catch (_) { input.focus(); }
    };
    ctx.page.appendChild(page);
  }

  function openBrowser(createWindow, startUrl) {
    const { body, win } = createWindow({ title: "Edge", icon: Icon.mini("browser", "Edge"), width: 920, height: 620, appId: "browser" });

    body.innerHTML = `
      <div class="browser-bar">
        <button class="back" title="Back">&#8592;</button>
        <button class="reload" title="Reload">&#8635;</button>
        <div class="addr"><span class="lock muted" style="font-size:.72rem"></span><input class="url" placeholder="Search or enter address"></div>
        <button class="go" title="Go">&#8594;</button>
      </div>
      <div class="bookmark-bar"></div>
      <div class="browser-page"></div>`;

    const urlInput = body.querySelector(".url");
    const page = body.querySelector(".browser-page");
    const lock = body.querySelector(".lock");
    const bmBar = body.querySelector(".bookmark-bar");
    const history = [];

    Catalog.bookmarks.forEach((b) => {
      const bm = el(`<div class="bm">${b.label}</div>`);
      bm.onclick = () => navigate(b.url);
      bmBar.appendChild(bm);
    });

    function navigate(url, pushHistory = true) {
      if (pushHistory && urlInput.value) history.push(urlInput.value);
      urlInput.value = url;
      page.innerHTML = "";
      const special = resolveSpecial(url);
      const ctx = { page, navigate, win, urlInput };
      if (special === "home") {
        lock.textContent = "";
        body.querySelector(".addr").classList.remove("locked-site");
        urlInput.value = "";
        renderHome(ctx);
        return;
      }
      if (special) {
        lock.textContent = "Secure";
        body.querySelector(".addr").classList.add("locked-site");
        Sites[special](ctx);
      } else {
        lock.textContent = "";
        const final = /^https?:\/\//.test(url) ? url
          : /\.[a-z]{2,}$/i.test(url.trim()) ? "https://" + url.trim()
          : "https://www.google.com/search?q=" + encodeURIComponent(url);
        const frame = el(`<iframe class="embed-frame" src="${final}"></iframe>`);
        const fallback = el(`<div class="site"><p class="muted">If the page below is blank, that site blocks being embedded. Try one of the bookmarks above.</p></div>`);
        page.appendChild(fallback);
        page.appendChild(frame);
      }
    }

    body.querySelector(".go").onclick = () => navigate(urlInput.value);
    urlInput.addEventListener("keydown", (e) => { if (e.key === "Enter") navigate(urlInput.value); });
    body.querySelector(".reload").onclick = () => navigate(urlInput.value, false);
    body.querySelector(".back").onclick = () => { const prev = history.pop(); if (prev) navigate(prev, false); };

    navigate(startUrl || "home");
    return { navigate };
  }

  // Registered launcher + a programmatic opener used by other apps.
  let lastBrowserCreate = null;
  AppRegistry.browser = function (createWindow) { lastBrowserCreate = createWindow; return openBrowser(createWindow); };

  window.Browser = {
    openTo(url) {
      // open an Edge window already navigated to url
      const createWindow = lastBrowserCreate || window.WM.createWindow;
      return openBrowser(createWindow, url);
    },
  };
})();
