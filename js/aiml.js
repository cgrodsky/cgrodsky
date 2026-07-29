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

/* Brandfetch Logo Link (real brand logos, e.g. DoorDash Retail stores).
   Uses the PUBLIC client id — embeddable by design. Do NOT put the secret
   Brand-API key here; this repo is public and has no server to hide it. */
window.BRANDFETCH_CLIENT_ID = "2aGHRy7xjDUaw49bTCmi/wFKDwb0iVIavy10eg3evno=";   // public Logo Link client id (safe to embed)
