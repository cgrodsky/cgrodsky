# 🎟️ Arcade Card Manager

A professional web app for running an arcade card/ticket system. Load a card,
**add or remove credits and tickets**, **create prize items**, and **redeem**
them with a tap. It connects to a real **RFID card reader** through a small
Python server, and also runs fully in the browser (no backend) when you just
want to try it out.

![modes](https://img.shields.io/badge/UI-Simple%20%26%20Advanced-7c5cff)

## Features

- **Add / remove credits and tickets** with quick chips or custom amounts.
- **Create, edit and delete prize items** (emoji, cost, currency, stock).
- **Redeem** items against the active card — balances and stock update live.
- **RFID support** via Python: tap a card and it loads automatically. Unknown
  cards prompt you to register them.
- **Simple & Advanced UI modes.** Simple = card + quick actions + prizes.
  Advanced adds item management, the full card list, a transaction log, and the
  "danger zone".
- **Transaction log** of every add / remove / redeem.
- **Password lock.** The first time you open the app you choose a password;
  after that it's required to unlock. Change it or lock on demand from
  **⚙️ Settings → Security**. (Front-end lock: the password is hashed and stored
  on that device — it guards the screen, not the server API.)
- **Two data backends:** the Python/SQLite server (shared, persistent, real
  RFID) or browser `localStorage` (zero-install, works on GitHub Pages).

---

## Quick start (with RFID + Python backend)

```bash
cd arcade
pip install -r requirements.txt      # Flask + flask-cors
python server.py                     # starts on http://localhost:5000
```

Open <http://localhost:5000>. By default it runs the **simulated** reader
(fires a random tap every few seconds) so you can see the live feed working
immediately. Pick your real reader with `--reader`:

| Reader hardware | Command | Extra install |
| --- | --- | --- |
| **Simulator** (demo) | `python server.py` | — |
| **MFRC522 / RC522** (Raspberry Pi, SPI) | `python server.py --reader mfrc522` | `pip install mfrc522 RPi.GPIO` |
| **PC/SC NFC** (ACR122U & most USB NFC) | `python server.py --reader pcsc` | `pip install pyscard` |
| **Serial / Wiegand-to-serial** | `python server.py --reader serial --port /dev/ttyUSB0` | `pip install pyserial` |
| **USB keyboard-wedge** | no backend reader needed — see below | — |

### USB keyboard-wedge readers (the cheap ones)

Many USB RFID readers act as a keyboard: they "type" the card number and press
Enter. For these, open **⚙️ Settings → RFID input mode → USB keyboard-wedge**.
The page captures the typed number directly — no Python needed for the reader
(though you can still run the server for shared storage).

---

## Run in the browser only (no install)

Just open `static/index.html`, or host the `static/` folder anywhere static.
With no backend, everything is stored in your browser's `localStorage`. Use the
manual card-ID box or keyboard-wedge mode to load cards. Great for a quick trial
or a single kiosk.

---

## Hosting

You have a few options depending on whether you need the RFID hardware:

### 1. GitHub Pages (UI only, browser storage)
The `static/` folder is a plain static site. This repo already publishes to
GitHub Pages, so you can also expose the arcade UI at
`https://<user>.github.io/<repo>/arcade/static/`. No RFID, data lives in the
browser. Good for demos.

### 2. One machine at the arcade (recommended for real use)
Run `python server.py --reader <yours>` on the PC that has the reader plugged
in. Open `http://localhost:5000` on that machine. The SQLite file
(`arcade.db`) keeps all cards, items and history.

### 3. LAN kiosk / multiple stations
Run the server on one PC (it binds `0.0.0.0:5000` by default) and open
`http://<that-pc-ip>:5000` from any tablet or till on the same network. They
all share one database and see live taps. For a production kiosk, put it behind
a real WSGI server:

```bash
pip install gunicorn
gunicorn -w 1 -b 0.0.0.0:5000 server:app   # keep -w 1 so the RFID thread + SSE stay in one process
```

> Start the reader thread by running `python server.py` once, or launch under a
> process manager; `server:app` alone serves the API/UI. For a single-box arcade
> setup, plain `python server.py` is simplest and reliable.

### 4. Split hosting (UI on Pages, backend at the arcade)
Host the UI statically and point it at your backend: open **⚙️ Settings →
Backend URL**, enter `http://<arcade-pc-ip>:5000`, and press **Connect**. CORS
is already enabled on the server.

---

## Project layout

```
arcade/
├── server.py         Flask API + static hosting + SSE live tap feed
├── rfid.py           Pluggable reader backends (sim / mfrc522 / pcsc / serial)
├── requirements.txt
├── arcade.db         SQLite database (created on first run)
└── static/
    ├── index.html    UI markup
    ├── style.css     Dark, professional theme
    └── app.js        All front-end logic (backend + local modes)
```

## REST API (for reference / integration)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Server + reader status |
| GET/POST | `/api/cards` | List / create cards |
| GET/PATCH/DELETE | `/api/cards/<uid>` | Read / adjust balances / delete |
| GET/POST | `/api/items` | List / create prize items |
| PATCH/DELETE | `/api/items/<id>` | Edit / delete an item |
| POST | `/api/redeem` | `{uid, item_id}` — redeem an item |
| GET | `/api/transactions` | Recent activity (`?uid=` to filter) |
| GET | `/api/scan/stream` | Server-Sent Events feed of live card taps |
| POST | `/api/scan/simulate` | `{uid}` — inject a fake tap for testing |

`PATCH /api/cards/<uid>` body: `{ "credits_delta": 10, "tickets_delta": -5, "name": "...", "reason": "..." }`.
