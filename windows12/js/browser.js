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
  };

  function resolveSpecial(input) {
    const key = (input || "").trim().toLowerCase()
      .replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
    return SPECIAL[key] || SPECIAL[(input || "").trim().toLowerCase()] || null;
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

    navigate(startUrl || "bank.local");
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
