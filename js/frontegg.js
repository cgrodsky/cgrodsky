/* Frontegg hosted-login (PKCE popup) — mirrors the Auth0 wrapper's shape.
   Public config only: tenant host + client id (no secret; PKCE flow).
   Surfaces as window.FE — used by DoorDash (and any future site) for sign-in. */
(function () {
  "use strict";
  const CFG = {
    baseUrl: "https://app-3vrdovwwww73.frontegg.com",
    // Public Client ID (the tenant/vendor id — safe to publish; the API key stays out of the repo).
    clientId: window.FRONTEGG_CLIENT_ID || "9dba3c08-27f3-4434-a9fe-fde411ea5c0f",
  };
  const KEY = "fe_session_v1";
  const redirectUri = window.location.origin + window.location.pathname.replace(/[^/]*$/, "") + "frontegg-callback.html";

  function b64url(bytes) { return btoa(String.fromCharCode.apply(null, new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
  function randStr(n) { const a = new Uint8Array(n); crypto.getRandomValues(a); return b64url(a.buffer); }
  async function challenge(verifier) { const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)); return b64url(d); }
  function decodeJwt(t) { try { return JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); } catch (_) { return null; } }
  function session() { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (_) { return null; } }
  function saveSession(s) { try { s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY); } catch (_) {} }

  async function exchange(code, verifier) {
    const r = await fetch(CFG.baseUrl + "/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grant_type: "authorization_code", code, redirect_uri: redirectUri, client_id: CFG.clientId, code_verifier: verifier }),
    });
    if (!r.ok) throw new Error("Token exchange failed (HTTP " + r.status + ")");
    return r.json();
  }

  window.FE = {
    configured() { return !!CFG.clientId; },
    user() {
      const s = session();
      if (!s || !s.claims) return null;
      if (s.claims.exp && s.claims.exp * 1000 < (new Date()).getTime()) { saveSession(null); return null; }
      return s.claims;
    },
    // Opens the Frontegg hosted login in a popup; resolves with the user claims.
    login() {
      return new Promise(async (resolve, reject) => {
        if (!CFG.clientId) return reject(new Error("Frontegg client ID isn't configured yet."));
        const verifier = randStr(32), state = randStr(16);
        let ch; try { ch = await challenge(verifier); } catch (e) { return reject(new Error("Crypto unavailable (needs HTTPS).")); }
        const url = CFG.baseUrl + "/oauth/authorize?" + new URLSearchParams({
          response_type: "code", client_id: CFG.clientId, redirect_uri: redirectUri,
          scope: "openid profile email", state, code_challenge: ch, code_challenge_method: "S256",
        });
        const pop = window.open(url, "fe_login", "width=480,height=680,menubar=no,toolbar=no");
        if (!pop) return reject(new Error("Popup blocked — allow popups and try again."));
        let done = false;
        function cleanup() { window.removeEventListener("message", onMsg); clearInterval(iv); }
        async function onMsg(e) {
          if (e.origin !== location.origin || !e.data || e.data.type !== "fe_auth" || done) return;
          done = true; cleanup();
          if (e.data.error || !e.data.code || e.data.state !== state) return reject(new Error(e.data.error || "Sign-in cancelled."));
          try {
            const tok = await exchange(e.data.code, verifier);
            const claims = decodeJwt(tok.id_token || tok.access_token) || {};
            saveSession({ claims, at: tok.access_token || null });
            resolve(claims);
          } catch (err) { reject(err); }
        }
        window.addEventListener("message", onMsg);
        const iv = setInterval(() => { if (pop.closed && !done) { done = true; cleanup(); reject(new Error("Sign-in cancelled.")); } }, 600);
      });
    },
    logout() { saveSession(null); },
  };
})();
