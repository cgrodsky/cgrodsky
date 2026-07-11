/* Auth0 verification service — hidden. There is no Auth0 app anywhere; it only
   surfaces as the Auth0 login POPUP when something calls window.Auth0.verify().
   Uses auth0-spa-js in popup mode (works inside the sim; the iframe browser
   can't do redirects). Public config only: domain + SPA client id (PKCE). */
(function () {
  "use strict";
  const CFG = { domain: "windows12.us.auth0.com", clientId: "LQ7egZhMvDppMjHn7IQWO6MAGLWhJslX" };
  const redirectUri = window.location.origin + window.location.pathname;

  let clientPromise = null;
  function getClient() {
    if (clientPromise) return clientPromise;
    if (typeof auth0 === "undefined" || !auth0.createAuth0Client) {
      return Promise.reject(new Error("Auth0 SDK didn't load (offline or blocked)."));
    }
    clientPromise = auth0.createAuth0Client({
      domain: CFG.domain,
      clientId: CFG.clientId,
      authorizationParams: { redirect_uri: redirectUri },
      cacheLocation: "localstorage",
    });
    return clientPromise;
  }

  window.Auth0 = {
    // Pop up the Auth0 login (must be called from a user gesture, e.g. a click).
    // onSuccess(user) fires when verified; onError(message) on failure.
    async verify(onSuccess, onError, opts) {
      let client;
      try { client = await getClient(); }
      catch (e) { (onError || function () {})(e.message); return; }
      try {
        if (!(await client.isAuthenticated())) await client.loginWithPopup(opts);
        (onSuccess || function () {})(await client.getUser());
      } catch (e) {
        (onError || function () {})(e && (e.message || String(e)) || "Verification cancelled.");
      }
    },
    async user() {
      try { const c = await getClient(); return (await c.isAuthenticated()) ? c.getUser() : null; }
      catch (_) { return null; }
    },
    async isVerified() { try { const c = await getClient(); return await c.isAuthenticated(); } catch (_) { return false; } },
    async logout() {
      try { const c = await getClient(); await c.logout({ logoutParams: { returnTo: redirectUri }, openUrl: (u) => window.open(u, "_blank") }); }
      catch (_) {}
    },
  };
})();
