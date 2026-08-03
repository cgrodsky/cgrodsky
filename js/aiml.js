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
