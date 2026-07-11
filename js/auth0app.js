/* Auth0 login, native inside Windows 12. Uses auth0-spa-js in POPUP mode so it
   works without navigating the sim away (the iframe browser can't do redirects).
   Public config only: domain + SPA client id (PKCE, no secret). */
(function () {
  "use strict";
  function el(html) { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; }
  function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  const cw = (opts) => window.WM.createWindow(opts);

  const CFG = { domain: "windows12.us.auth0.com", clientId: "LQ7egZhMvDppMjHn7IQWO6MAGLWhJslX" };
  const redirectUri = window.location.origin + window.location.pathname;

  let clientPromise = null;
  function getClient() {
    if (clientPromise) return clientPromise;
    if (typeof auth0 === "undefined" || !auth0.createAuth0Client) return Promise.reject(new Error("Auth0 SDK didn't load (network/adblock?)."));
    clientPromise = auth0.createAuth0Client({
      domain: CFG.domain,
      clientId: CFG.clientId,
      authorizationParams: { redirect_uri: redirectUri },
      cacheLocation: "localstorage",
    });
    return clientPromise;
  }

  AppRegistry.auth0 = function () {
    const { body } = cw({ title: "Auth0", icon: Icon.mini("auth0", "Auth0"), width: 440, height: 500, appId: "auth0" });
    body.innerHTML = `<div class="a0"><div class="a0-status" id="st">Loading…</div><div id="stage"></div></div>`;
    const st = body.querySelector("#st"), stage = body.querySelector("#stage");
    const setStatus = (html, cls) => { st.className = "a0-status" + (cls ? " " + cls : ""); st.innerHTML = html; };

    async function render() {
      let client;
      try { client = await getClient(); }
      catch (e) { setStatus("✗ " + esc(e.message), "bad"); stage.innerHTML = ""; return; }

      let isAuth = false;
      try { isAuth = await client.isAuthenticated(); } catch (_) {}
      if (isAuth) {
        const u = await client.getUser();
        setStatus("✓ Signed in", "ok");
        stage.innerHTML = `<div class="a0-profile">
          <img src="${esc(u.picture || "")}" alt="">
          <div><b>${esc(u.name || u.nickname || "(no name)")}</b><div class="muted">${esc(u.email || "")}</div></div>
        </div>
        <button class="pill-btn" id="out">Log out</button>
        <pre class="a0-raw">${esc(JSON.stringify(u, null, 2))}</pre>`;
        stage.querySelector("#out").onclick = async () => {
          setStatus("Signing out…");
          try { await client.logout({ logoutParams: { returnTo: redirectUri }, openUrl: (url) => window.open(url, "_blank") }); } catch (_) {}
          clientPromise = null; setTimeout(render, 300);
        };
      } else {
        setStatus("Not signed in", "");
        stage.innerHTML = `<button class="pill-btn" id="login">Log in with Auth0</button>
          <button class="pill-btn a0-signup" id="signup">Sign up</button>
          <p class="muted" style="margin-top:14px;font-size:.8rem">Opens a secure Auth0 popup. Allow popups if your browser asks.</p>`;
        const doLogin = async (opts) => {
          setStatus("Opening Auth0…");
          try { await client.loginWithPopup(opts); render(); }
          catch (e) { setStatus("✗ " + esc(e.message || "Login cancelled or blocked.") + "<br>If it says popup blocked, allow popups and retry.", "bad"); }
        };
        stage.querySelector("#login").onclick = () => doLogin();
        stage.querySelector("#signup").onclick = () => doLogin({ authorizationParams: { screen_hint: "signup" } });
      }
    }
    render();
  };
})();
