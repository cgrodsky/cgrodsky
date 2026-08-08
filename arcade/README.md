# Arcade Card Manager

A professional web app for running an arcade card / ticket system. Load a card,
**add or remove credits and tickets**, **create prize items**, **redeem** them,
and **merge two cards** together. It connects to a real **RFID card reader**,
and can store all data in the **cloud** so every device stays in sync.

The card itself only carries an ID. All balances live in the database (cloud or
local), looked up by that ID — so a lost card never means lost value you can't
trace, and any reader that can read the ID works.

## Features

**Everyday use**
- **Add / remove credits and tickets** with quick buttons or custom amounts.
- **Create, edit and delete prize items** with **categories**; redeem with a tap.
- **Prize search & category filter**, with low-stock warnings.
- **Merge cards** — tap a second card, choose credits / tickets / both, and pick
  which card keeps the combined balance.
- **RFID support**: tap a card and it loads automatically. Unknown cards prompt
  you to register them.

Credits and tickets are only ever added **manually** by staff (or when a card is
tapped) — there is **no way to buy credits with money**. It's a pure
arcade/ticket system.

**Advanced mode (a full back office)**
- **Big-screen leaderboard** — a full-screen, auto-refreshing ranking of who has
  the most tickets (gold/silver/bronze for the top 3). Open it from the trophy
  button or press **B** — great to show on a monitor at the event.
- **Dashboard** — tickets awarded, credits/tickets in circulation, redemptions, a
  **7-day activity chart**, a **ticket leaderboard**, and **low-stock** list.
- **Membership** — card **tiers** (Standard/Silver/Gold/VIP), **notes**, and
  **freeze/unfreeze** (frozen cards can't spend or earn).
- **Transaction tools** — **void/undo** any balance change, **CSV export**, and a
  filterable activity log.
- **Bulk & data** — **batch-create cards**, **backup/restore** (JSON), reset all
  balances, delete all cards.
- **Per-card operations** — set an exact balance, convert credits ⇄ tickets at a
  configurable rate.

**Kiosk & polish**
- **4-digit PIN lock** with **auto-lock on idle**.
- **Light / dark themes** + custom **accent colour**, **fullscreen** kiosk mode,
  **beep on tap/redeem**, and **keyboard shortcuts**.
- **Clean, icon-based interface** (no emoji), works well on tablets.
- **Two data backends:** the Python/SQLite server (shared, persistent, real RFID)
  or browser storage (zero-install, works on GitHub Pages).

---

## Three ways to run it

| You want… | Do this | RFID? | Syncs across devices? |
| --- | --- | --- | --- |
| Just try it | Open the GitHub Pages link / `static/index.html` | No | No (per-device) |
| One arcade PC with a reader | Run `python server.py` on that PC | Yes | Yes (on your network) |
| **No computer — iPad + cloud** | **Deploy to the cloud (below)** | Yes, via a reader on the iPad | **Yes, everywhere** |

---

## Cloud hosting (no computer needed — iPad friendly)

This is the setup for **online syncing** when you don't have a computer: the
server runs in the cloud, and every device (iPad, phone, etc.) shares one
database. You deploy entirely from a browser.

**Why cloud, not a home computer?** The arcade UI hosted on GitHub Pages is
served over HTTPS, and a browser will only let an HTTPS page talk to an HTTPS
backend. Cloud hosts give you HTTPS automatically; a plain `http://` address on
a home PC would be blocked.

### Deploy to Render (free, from your iPad browser)

1. Go to **[render.com](https://render.com)** and sign up (free).
2. **New +  →  Blueprint**, and connect this GitHub repo. Render reads
   `arcade/render.yaml` and creates the service for you. (Or use **New + →
   Web Service**, set **Root Directory** to `arcade`, **Build**
   `pip install -r requirements.txt`, **Start**
   `gunicorn server:app -k gthread -w 1 --threads 8 -b 0.0.0.0:$PORT`.)
3. When it finishes you get an HTTPS URL like
   `https://arcade-card-manager.onrender.com`.
4. On the iPad, open the arcade UI, go to **Settings**, paste that URL into
   **Backend URL**, choose **USB keyboard-wedge reader**, and tap **Connect**.
   The pill turns green: *Cloud · keyboard-wedge*.
5. Do the same on any other device with the same URL — they now share one
   database. Add tickets on one, see them on all.

> **Keep your data across restarts.** Render's free disk resets on each redeploy.
> To make card data permanent, add a **Render Disk** mounted at `/var/data`, then
> uncomment the `DB_PATH: /var/data/arcade.db` lines in `render.yaml`. Other
> hosts that work the same way: Replit, Railway, Fly.io, PythonAnywhere.

### Using the RFID reader on the iPad

Your USB RFID reader (via the USB adapter) acts like a keyboard: when you tap a
card it "types" the card's ID and presses Enter. With **keyboard-wedge** mode
selected, the app catches that and loads the card — no reader software needed on
the iPad. The balances come from the cloud. (An Android phone could instead read
NFC directly; iOS Safari can't, which is why the wedge reader is the way to go on
iPad.)

---

## Run locally with a real reader (one arcade PC)

```bash
cd arcade
pip install -r requirements.txt
python server.py                 # http://localhost:5000  (simulated reader)
```

Pick your reader with `--reader`:

| Reader hardware | Command | Extra install |
| --- | --- | --- |
| Simulator (demo) | `python server.py` | — |
| MFRC522 / RC522 (Raspberry Pi, SPI) | `python server.py --reader mfrc522` | `pip install mfrc522 RPi.GPIO` |
| PC/SC NFC (ACR122U & most USB NFC) | `python server.py --reader pcsc` | `pip install pyscard` |
| Serial / Wiegand-to-serial | `python server.py --reader serial --port /dev/ttyUSB0` | `pip install pyserial` |
| USB keyboard-wedge | Settings → keyboard-wedge (no backend reader needed) | — |

Other computers on the same Wi-Fi can open `http://<that-pc-ip>:5000` and share
the database.

---

## Browser-only mode (no install, no sync)

Open `static/index.html` or the GitHub Pages link. With no backend, data is kept
in that browser only. Good for a quick trial or a single kiosk.

---

## Project layout

```
arcade/
├── server.py         Flask API + static hosting + live tap feed (SSE)
├── rfid.py           Reader backends (sim / mfrc522 / pcsc / serial)
├── requirements.txt
├── render.yaml       One-click Render cloud deploy
├── Procfile          Generic cloud start command
└── static/
    ├── index.html    UI markup + SVG icon set
    ├── style.css     Professional dark theme
    └── app.js        Front-end logic (cloud + local modes, PIN, merge)
```

## REST API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Server + reader status |
| GET/POST | `/api/cards` | List / create cards |
| GET/PATCH/DELETE | `/api/cards/<uid>` | Read / adjust balances / delete |
| GET/POST | `/api/items` | List / create prize items |
| PATCH/DELETE | `/api/items/<id>` | Edit / delete an item |
| POST | `/api/redeem` | `{uid, item_id}` — redeem an item |
| POST | `/api/merge` | `{source, dest, credits, tickets}` — combine two cards |
| GET | `/api/transactions` | Recent activity (`?uid=` to filter) |
| GET | `/api/scan/stream` | Server-Sent Events feed of live card taps |
| POST | `/api/scan/simulate` | `{uid}` — inject a fake tap for testing |

`PATCH /api/cards/<uid>` body: `{ "credits_delta": 10, "tickets_delta": -5, "name": "...", "reason": "..." }`.
