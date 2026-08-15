#!/usr/bin/env python3
"""
Arcade Card Manager -- backend server.

A small Flask application that:
  * serves the web UI (static/)
  * stores cards, catalog items and the transaction log in SQLite
  * exposes a REST API the UI talks to
  * talks to an RFID reader (real hardware or a built-in simulator) and
    streams live card taps to the browser over Server-Sent Events (SSE)

Run it with:  python server.py            (uses the simulated reader)
              python server.py --reader mfrc522
              python server.py --reader pcsc
              python server.py --reader serial --port /dev/ttyUSB0

See README.md for the full list of reader backends and hosting notes.
"""

import argparse
import datetime
import json
import os
import queue
import sqlite3
import threading
import time
from contextlib import closing

try:
    from flask import (
        Flask,
        Response,
        g,
        jsonify,
        request,
        send_from_directory,
        stream_with_context,
    )
    from flask_cors import CORS
except ImportError:  # pragma: no cover - helpful message when deps missing
    raise SystemExit(
        "Missing dependencies. Run:  pip install -r requirements.txt"
    )

from rfid import create_reader

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
# DB_PATH is env-configurable so a cloud host can point it at a persistent disk
# (e.g. DB_PATH=/var/data/arcade.db on Render with a mounted disk).
DB_PATH = os.environ.get("DB_PATH") or os.path.join(BASE_DIR, "arcade.db")

app = Flask(__name__, static_folder=None)
CORS(app)  # allow the UI to be hosted separately (e.g. GitHub Pages)

# ---------------------------------------------------------------------------
# Live RFID tap fan-out.  Each connected browser gets its own queue; the reader
# thread pushes the scanned UID onto every queue.
# ---------------------------------------------------------------------------
_subscribers = []
_subscribers_lock = threading.Lock()
_last_scan = {"uid": None, "ts": 0}


def _broadcast_tap(uid):
    _last_scan["uid"] = uid
    _last_scan["ts"] = time.time()
    payload = json.dumps({"uid": uid, "ts": _last_scan["ts"]})
    with _subscribers_lock:
        for q in list(_subscribers):
            try:
                q.put_nowait(payload)
            except queue.Full:
                pass


# ---------------------------------------------------------------------------
# Database helpers
# ---------------------------------------------------------------------------
SCHEMA = """
CREATE TABLE IF NOT EXISTS cards (
    uid         TEXT PRIMARY KEY,
    name        TEXT NOT NULL DEFAULT '',
    credits     INTEGER NOT NULL DEFAULT 0,
    tickets     INTEGER NOT NULL DEFAULT 0,
    created_at  REAL NOT NULL,
    updated_at  REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    cost        INTEGER NOT NULL DEFAULT 0,
    currency    TEXT NOT NULL DEFAULT 'tickets',   -- 'tickets' or 'credits'
    stock       INTEGER NOT NULL DEFAULT -1,       -- -1 = unlimited
    emoji       TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS transactions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    uid         TEXT NOT NULL,
    kind        TEXT NOT NULL,       -- add_credits / remove_credits / redeem / ...
    detail      TEXT NOT NULL DEFAULT '',
    credits_d   INTEGER NOT NULL DEFAULT 0,
    tickets_d   INTEGER NOT NULL DEFAULT 0,
    voided      INTEGER NOT NULL DEFAULT 0,
    ts          REAL NOT NULL
);
"""

# Columns added after v1; applied idempotently by migrate().
MIGRATIONS = {
    "cards": [
        ("status", "TEXT NOT NULL DEFAULT 'active'"),
        ("tier", "TEXT NOT NULL DEFAULT 'Standard'"),
        ("notes", "TEXT NOT NULL DEFAULT ''"),
        ("role", "TEXT NOT NULL DEFAULT 'customer'"),   # 'customer' or 'staff'
        ("expires", "TEXT NOT NULL DEFAULT ''"),        # 'YYYY-MM-DD', '' = never
    ],
    "items": [("category", "TEXT NOT NULL DEFAULT ''")],
    "transactions": [
        ("voided", "INTEGER NOT NULL DEFAULT 0"),
        ("operator", "TEXT NOT NULL DEFAULT ''"),       # who made the change (audit)
    ],
}


def migrate(db):
    for table, cols in MIGRATIONS.items():
        # PRAGMA rows are (cid, name, type, notnull, dflt_value, pk) — name is [1].
        have = {r[1] for r in db.execute(f"PRAGMA table_info({table})").fetchall()}
        for col, decl in cols:
            if col not in have:
                db.execute(f"ALTER TABLE {table} ADD COLUMN {col} {decl}")


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(_exc):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    with closing(sqlite3.connect(DB_PATH)) as db:
        db.executescript(SCHEMA)
        migrate(db)
        # Seed a couple of prize items the first time the DB is created.
        cur = db.execute("SELECT COUNT(*) AS n FROM items")
        if cur.fetchone()[0] == 0:
            db.executemany(
                "INSERT INTO items (name, cost, currency, stock, emoji, category) "
                "VALUES (?,?,?,?,?,?)",
                [
                    ("Candy Bar", 25, "tickets", -1, "", "Snacks"),
                    ("Rubber Duck", 50, "tickets", -1, "", "Small"),
                    ("Plush Bear", 500, "tickets", 10, "", "Plush"),
                    ("Game Console", 25000, "tickets", 2, "", "Big"),
                ],
            )
        db.commit()


def row_to_dict(row):
    return {k: row[k] for k in row.keys()}


def card_blocked(row):
    """A card is blocked (can't earn/spend) if frozen, lost, or past expiry."""
    if row["status"] in ("frozen", "lost"):
        return True
    exp = row["expires"] if "expires" in row.keys() else ""
    if exp and datetime.date.today().isoformat() > exp:
        return True
    return False


def log_tx(db, uid, kind, detail="", credits_d=0, tickets_d=0):
    # The operator name rides along on every request as a header, so we can
    # record "who did what" without changing each endpoint's body.
    try:
        operator = (request.headers.get("X-Operator") or "")[:40]
    except Exception:
        operator = ""
    db.execute(
        "INSERT INTO transactions (uid, kind, detail, credits_d, tickets_d, operator, ts) "
        "VALUES (?,?,?,?,?,?,?)",
        (uid, kind, detail, credits_d, tickets_d, operator, time.time()),
    )


# ---------------------------------------------------------------------------
# Static file serving (the UI)
# ---------------------------------------------------------------------------
@app.route("/")
def index():
    return send_from_directory(STATIC_DIR, "index.html")


@app.route("/<path:path>")
def static_files(path):
    return send_from_directory(STATIC_DIR, path)


# ---------------------------------------------------------------------------
# REST API
# ---------------------------------------------------------------------------
@app.route("/api/health")
def health():
    return jsonify({"ok": True, "reader": app.config.get("READER_NAME", "none")})


@app.route("/api/cards", methods=["GET"])
def list_cards():
    db = get_db()
    rows = db.execute("SELECT * FROM cards ORDER BY updated_at DESC").fetchall()
    return jsonify([row_to_dict(r) for r in rows])


@app.route("/api/cards/<uid>", methods=["GET"])
def get_card(uid):
    db = get_db()
    row = db.execute("SELECT * FROM cards WHERE uid=?", (uid,)).fetchone()
    if not row:
        return jsonify({"error": "not_found"}), 404
    return jsonify(row_to_dict(row))


@app.route("/api/cards", methods=["POST"])
def create_card():
    data = request.get_json(force=True) or {}
    uid = (data.get("uid") or "").strip()
    if not uid:
        return jsonify({"error": "uid_required"}), 400
    db = get_db()
    existing = db.execute("SELECT uid FROM cards WHERE uid=?", (uid,)).fetchone()
    if existing:
        return jsonify({"error": "exists"}), 409
    now = time.time()
    role = "staff" if data.get("role") == "staff" else "customer"
    db.execute(
        "INSERT INTO cards (uid, name, credits, tickets, role, created_at, updated_at) "
        "VALUES (?,?,?,?,?,?,?)",
        (uid, data.get("name", ""), int(data.get("credits", 0)),
         int(data.get("tickets", 0)), role, now, now),
    )
    log_tx(db, uid, "create_card", detail=data.get("name", "") + (" (staff)" if role == "staff" else ""))
    db.commit()
    row = db.execute("SELECT * FROM cards WHERE uid=?", (uid,)).fetchone()
    return jsonify(row_to_dict(row)), 201


@app.route("/api/cards/<uid>", methods=["PATCH"])
def update_card(uid):
    """Adjust balances, rename, or set status/tier/notes.

    Body: {credits_delta, tickets_delta, name, reason, status, tier, notes}.
    Balance changes are blocked while the card is frozen.
    """
    data = request.get_json(force=True) or {}
    db = get_db()
    row = db.execute("SELECT * FROM cards WHERE uid=?", (uid,)).fetchone()
    if not row:
        return jsonify({"error": "not_found"}), 404

    cd = int(data.get("credits_delta", 0))
    td = int(data.get("tickets_delta", 0))
    if (cd or td) and card_blocked(row):
        return jsonify({"error": "card_blocked"}), 400
    if td > 0 and row["role"] == "staff":
        return jsonify({"error": "staff_no_tickets"}), 400

    new_credits = row["credits"] + cd
    new_tickets = row["tickets"] + td
    if new_credits < 0 or new_tickets < 0:
        return jsonify({"error": "insufficient_balance"}), 400

    name = data.get("name", row["name"])
    status = data.get("status", row["status"])
    tier = data.get("tier", row["tier"])
    notes = data.get("notes", row["notes"])
    role = data.get("role", row["role"])
    expires = data.get("expires", row["expires"])
    db.execute(
        "UPDATE cards SET credits=?, tickets=?, name=?, status=?, tier=?, notes=?, role=?, expires=?, updated_at=? WHERE uid=?",
        (new_credits, new_tickets, name, status, tier, notes, role, expires, time.time(), uid),
    )
    if cd or td:
        kind = "add" if (cd > 0 or td > 0) else "remove"
        log_tx(db, uid, kind, detail=data.get("reason", ""), credits_d=cd, tickets_d=td)
    if status != row["status"]:
        log_tx(db, uid, "status", detail=status)
    db.commit()
    row = db.execute("SELECT * FROM cards WHERE uid=?", (uid,)).fetchone()
    return jsonify(row_to_dict(row))


@app.route("/api/cards/<uid>", methods=["DELETE"])
def delete_card(uid):
    db = get_db()
    db.execute("DELETE FROM cards WHERE uid=?", (uid,))
    log_tx(db, uid, "delete_card")
    db.commit()
    return jsonify({"ok": True})


@app.route("/api/items", methods=["GET"])
def list_items():
    db = get_db()
    rows = db.execute("SELECT * FROM items ORDER BY cost ASC").fetchall()
    return jsonify([row_to_dict(r) for r in rows])


@app.route("/api/items", methods=["POST"])
def create_item():
    data = request.get_json(force=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name_required"}), 400
    db = get_db()
    cur = db.execute(
        "INSERT INTO items (name, cost, currency, stock, emoji, category) VALUES (?,?,?,?,?,?)",
        (name, int(data.get("cost", 0)), data.get("currency", "tickets"),
         int(data.get("stock", -1)), data.get("emoji", ""), data.get("category", "")),
    )
    db.commit()
    row = db.execute("SELECT * FROM items WHERE id=?", (cur.lastrowid,)).fetchone()
    return jsonify(row_to_dict(row)), 201


@app.route("/api/items/<int:item_id>", methods=["PATCH"])
def update_item(item_id):
    data = request.get_json(force=True) or {}
    db = get_db()
    row = db.execute("SELECT * FROM items WHERE id=?", (item_id,)).fetchone()
    if not row:
        return jsonify({"error": "not_found"}), 404
    db.execute(
        "UPDATE items SET name=?, cost=?, currency=?, stock=?, emoji=?, category=? WHERE id=?",
        (data.get("name", row["name"]), int(data.get("cost", row["cost"])),
         data.get("currency", row["currency"]), int(data.get("stock", row["stock"])),
         data.get("emoji", row["emoji"]), data.get("category", row["category"]), item_id),
    )
    db.commit()
    row = db.execute("SELECT * FROM items WHERE id=?", (item_id,)).fetchone()
    return jsonify(row_to_dict(row))


@app.route("/api/items/<int:item_id>", methods=["DELETE"])
def delete_item(item_id):
    db = get_db()
    db.execute("DELETE FROM items WHERE id=?", (item_id,))
    db.commit()
    return jsonify({"ok": True})


@app.route("/api/redeem", methods=["POST"])
def redeem():
    """Body: {uid, item_id}. Deducts the item cost and decrements stock."""
    data = request.get_json(force=True) or {}
    uid = data.get("uid")
    item_id = data.get("item_id")
    db = get_db()
    card = db.execute("SELECT * FROM cards WHERE uid=?", (uid,)).fetchone()
    item = db.execute("SELECT * FROM items WHERE id=?", (item_id,)).fetchone()
    if not card:
        return jsonify({"error": "card_not_found"}), 404
    if not item:
        return jsonify({"error": "item_not_found"}), 404
    if card_blocked(card):
        return jsonify({"error": "card_blocked"}), 400
    if card["role"] == "staff":
        return jsonify({"error": "staff_no_redeem"}), 400
    if item["stock"] == 0:
        return jsonify({"error": "out_of_stock"}), 400

    balance = card[item["currency"]]  # 'tickets' or 'credits'
    if balance < item["cost"]:
        return jsonify({"error": "insufficient_balance"}), 400

    cd = -item["cost"] if item["currency"] == "credits" else 0
    td = -item["cost"] if item["currency"] == "tickets" else 0
    db.execute(
        "UPDATE cards SET credits=credits+?, tickets=tickets+?, updated_at=? WHERE uid=?",
        (cd, td, time.time(), uid),
    )
    if item["stock"] > 0:
        db.execute("UPDATE items SET stock=stock-1 WHERE id=?", (item_id,))
    log_tx(db, uid, "redeem", detail=item["name"], credits_d=cd, tickets_d=td)
    db.commit()
    card = db.execute("SELECT * FROM cards WHERE uid=?", (uid,)).fetchone()
    return jsonify(row_to_dict(card))


@app.route("/api/play", methods=["POST"])
def play_game():
    """Charge a card to play a game at a station.

    Body: {uid, cost, game}. Deducts ``cost`` credits (staff cards play free).
    Returns {card, paid, free} or an error the station screen can show.
    """
    data = request.get_json(force=True) or {}
    uid = data.get("uid")
    cost = max(0, int(data.get("cost", 1)))
    reward = max(0, int(data.get("reward", 0)))   # tickets won per play
    game = data.get("game", "Game")
    db = get_db()
    card = db.execute("SELECT * FROM cards WHERE uid=?", (uid,)).fetchone()
    if not card:
        return jsonify({"error": "card_not_found"}), 404
    if card_blocked(card):
        return jsonify({"error": "card_blocked"}), 400
    if card["role"] == "staff":
        # Staff play free and never earn tickets.
        log_tx(db, uid, "play", detail=f"{game} (free)")
        db.commit()
        return jsonify({"card": row_to_dict(card), "paid": 0, "won": 0, "free": True})
    if card["credits"] < cost:
        return jsonify({"error": "insufficient_credits", "have": card["credits"], "need": cost}), 400
    db.execute(
        "UPDATE cards SET credits=credits-?, tickets=tickets+?, updated_at=? WHERE uid=?",
        (cost, reward, time.time(), uid),
    )
    log_tx(db, uid, "play", detail=game, credits_d=-cost, tickets_d=reward)
    db.commit()
    card = db.execute("SELECT * FROM cards WHERE uid=?", (uid,)).fetchone()
    return jsonify({"card": row_to_dict(card), "paid": cost, "won": reward, "free": False})


@app.route("/api/transactions/<int:tx_id>/void", methods=["POST"])
def void_transaction(tx_id):
    """Reverse a balance-affecting transaction."""
    db = get_db()
    tx = db.execute("SELECT * FROM transactions WHERE id=?", (tx_id,)).fetchone()
    if not tx:
        return jsonify({"error": "not_found"}), 404
    if tx["voided"]:
        return jsonify({"error": "already_voided"}), 400
    card = db.execute("SELECT * FROM cards WHERE uid=?", (tx["uid"],)).fetchone()
    if not card:
        return jsonify({"error": "card_not_found"}), 404
    new_c = card["credits"] - tx["credits_d"]
    new_t = card["tickets"] - tx["tickets_d"]
    if new_c < 0 or new_t < 0:
        return jsonify({"error": "would_go_negative"}), 400
    db.execute("UPDATE cards SET credits=?, tickets=?, updated_at=? WHERE uid=?",
               (new_c, new_t, time.time(), card["uid"]))
    db.execute("UPDATE transactions SET voided=1 WHERE id=?", (tx_id,))
    log_tx(db, tx["uid"], "void", detail=f"{tx['kind']}: {tx['detail']}",
           credits_d=-tx["credits_d"], tickets_d=-tx["tickets_d"])
    db.commit()
    card = db.execute("SELECT * FROM cards WHERE uid=?", (card["uid"],)).fetchone()
    return jsonify(row_to_dict(card))


@app.route("/api/merge", methods=["POST"])
def merge_cards():
    """Move balances from one card onto another.

    Body: {source, dest, credits: bool, tickets: bool}
    The selected balances are moved from ``source`` to ``dest`` (source zeroed
    for those currencies). Both cards are kept.
    """
    data = request.get_json(force=True) or {}
    src_uid = data.get("source")
    dst_uid = data.get("dest")
    do_credits = bool(data.get("credits"))
    do_tickets = bool(data.get("tickets"))
    if not src_uid or not dst_uid or src_uid == dst_uid:
        return jsonify({"error": "bad_cards"}), 400
    if not (do_credits or do_tickets):
        return jsonify({"error": "nothing_selected"}), 400

    db = get_db()
    src = db.execute("SELECT * FROM cards WHERE uid=?", (src_uid,)).fetchone()
    dst = db.execute("SELECT * FROM cards WHERE uid=?", (dst_uid,)).fetchone()
    if not src or not dst:
        return jsonify({"error": "card_not_found"}), 404

    move_c = src["credits"] if do_credits else 0
    move_t = src["tickets"] if do_tickets else 0
    now = time.time()
    db.execute(
        "UPDATE cards SET credits=credits+?, tickets=tickets+?, updated_at=? WHERE uid=?",
        (move_c, move_t, now, dst_uid),
    )
    db.execute(
        "UPDATE cards SET credits=credits-?, tickets=tickets-?, updated_at=? WHERE uid=?",
        (move_c, move_t, now, src_uid),
    )
    log_tx(db, src_uid, "merge_out", detail=f"to {dst_uid}", credits_d=-move_c, tickets_d=-move_t)
    log_tx(db, dst_uid, "merge_in", detail=f"from {src_uid}", credits_d=move_c, tickets_d=move_t)
    db.commit()
    src = db.execute("SELECT * FROM cards WHERE uid=?", (src_uid,)).fetchone()
    dst = db.execute("SELECT * FROM cards WHERE uid=?", (dst_uid,)).fetchone()
    return jsonify({"source": row_to_dict(src), "dest": row_to_dict(dst)})


@app.route("/api/export", methods=["GET"])
def export_data():
    """Full backup of cards, items and transactions."""
    db = get_db()
    cards = [row_to_dict(r) for r in db.execute("SELECT * FROM cards").fetchall()]
    items = [row_to_dict(r) for r in db.execute("SELECT * FROM items").fetchall()]
    txs = [row_to_dict(r) for r in db.execute("SELECT * FROM transactions ORDER BY ts").fetchall()]
    return jsonify({"version": 3, "cards": cards, "items": items, "transactions": txs})


@app.route("/api/import", methods=["POST"])
def import_data():
    """Restore a backup. Body: {cards, items}. Replaces existing cards & items."""
    data = request.get_json(force=True) or {}
    cards = data.get("cards", [])
    items = data.get("items", [])
    db = get_db()
    db.execute("DELETE FROM cards")
    db.execute("DELETE FROM items")
    now = time.time()
    for c in cards:
        db.execute(
            "INSERT INTO cards (uid, name, credits, tickets, status, tier, notes, role, expires, created_at, updated_at) "
            "VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            (c.get("uid"), c.get("name", ""), int(c.get("credits", 0)), int(c.get("tickets", 0)),
             c.get("status", "active"), c.get("tier", "Standard"), c.get("notes", ""),
             c.get("role", "customer"), c.get("expires", ""), c.get("created_at", now), c.get("updated_at", now)),
        )
    for it in items:
        db.execute(
            "INSERT INTO items (name, cost, currency, stock, emoji, category) VALUES (?,?,?,?,?,?)",
            (it.get("name", "Item"), int(it.get("cost", 0)), it.get("currency", "tickets"),
             int(it.get("stock", -1)), it.get("emoji", ""), it.get("category", "")),
        )
    db.commit()
    return jsonify({"ok": True, "cards": len(cards), "items": len(items)})


@app.route("/api/transactions", methods=["GET"])
def list_transactions():
    db = get_db()
    uid = request.args.get("uid")
    limit = int(request.args.get("limit", 50))
    if uid:
        rows = db.execute(
            "SELECT * FROM transactions WHERE uid=? ORDER BY ts DESC LIMIT ?",
            (uid, limit),
        ).fetchall()
    else:
        rows = db.execute(
            "SELECT * FROM transactions ORDER BY ts DESC LIMIT ?", (limit,)
        ).fetchall()
    return jsonify([row_to_dict(r) for r in rows])


# ---------------------------------------------------------------------------
# Live RFID feed
# ---------------------------------------------------------------------------
@app.route("/api/scan/last")
def last_scan():
    return jsonify(_last_scan)


@app.route("/api/scan/simulate", methods=["POST"])
def simulate_scan():
    """Fire a fake tap -- handy for testing the UI without hardware."""
    data = request.get_json(force=True) or {}
    uid = (data.get("uid") or "").strip()
    if not uid:
        return jsonify({"error": "uid_required"}), 400
    # If the reader models a physical card (the simulator), "place" this card on
    # it so the NFC read/write endpoints act on it.
    reader = app.config.get("READER")
    if reader is not None and hasattr(reader, "place"):
        reader.place(uid)
    _broadcast_tap(uid)
    return jsonify({"ok": True, "uid": uid})


@app.route("/api/nfc/read", methods=["POST"])
def nfc_read():
    """Read data stored ON the physical NFC card via the reader.

    Returns {uid, data} where data is the JSON object written to the card's
    memory (or null if the card is blank / unformatted). Requires a reader that
    supports reading card memory (ACR122U/PC-SC, MFRC522, or the simulator).
    """
    reader = app.config.get("READER")
    if not reader or not hasattr(reader, "read_card"):
        return jsonify({"error": "reader_cannot_read_data"}), 400
    try:
        uid, data = reader.read_card()
    except Exception as exc:  # pragma: no cover - hardware dependent
        return jsonify({"error": f"read_failed: {exc}"}), 500
    if not uid:
        return jsonify({"error": "no_card_present"}), 404
    return jsonify({"uid": uid, "data": data})


@app.route("/api/nfc/write", methods=["POST"])
def nfc_write():
    """Write data ONTO the physical NFC card. Body: {data: {...}}."""
    reader = app.config.get("READER")
    if not reader or not hasattr(reader, "write_card"):
        return jsonify({"error": "reader_cannot_write_data"}), 400
    payload = request.get_json(force=True) or {}
    data = payload.get("data")
    if data is None:
        return jsonify({"error": "data_required"}), 400
    try:
        uid = reader.write_card(data)
    except Exception as exc:  # pragma: no cover - hardware dependent
        return jsonify({"error": f"write_failed: {exc}"}), 500
    if not uid:
        return jsonify({"error": "no_card_present"}), 404
    return jsonify({"ok": True, "uid": uid})


@app.route("/api/scan/stream")
def scan_stream():
    def gen():
        q = queue.Queue(maxsize=10)
        with _subscribers_lock:
            _subscribers.append(q)
        try:
            # Prime the connection so EventSource fires 'open' promptly.
            yield "retry: 3000\n\n"
            while True:
                try:
                    payload = q.get(timeout=15)
                    yield f"data: {payload}\n\n"
                except queue.Empty:
                    yield ": keep-alive\n\n"  # comment frame keeps the socket warm
        finally:
            with _subscribers_lock:
                if q in _subscribers:
                    _subscribers.remove(q)

    return Response(stream_with_context(gen()), mimetype="text/event-stream")


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------
# Initialise the schema at import time so `gunicorn server:app` works in the
# cloud without going through main().
init_db()


def main():
    parser = argparse.ArgumentParser(description="Arcade Card Manager server")
    parser.add_argument(
        "--reader",
        default="sim",
        choices=["sim", "mfrc522", "pcsc", "serial", "none"],
        help="RFID reader backend (default: sim)",
    )
    parser.add_argument("--port", default=None, help="serial port for --reader serial")
    parser.add_argument("--baud", type=int, default=9600, help="serial baud rate")
    parser.add_argument("--host", default="0.0.0.0", help="bind host")
    parser.add_argument(
        "--http-port",
        type=int,
        default=int(os.environ.get("PORT", 5000)),
        help="HTTP port (defaults to $PORT, then 5000)",
    )
    args = parser.parse_args()

    init_db()
    app.config["READER_NAME"] = args.reader

    if args.reader != "none":
        reader = create_reader(
            args.reader, on_tap=_broadcast_tap, port=args.port, baud=args.baud
        )
        if reader:
            app.config["READER"] = reader
            t = threading.Thread(target=reader.run, daemon=True)
            t.start()
            print(f"[rfid] started '{args.reader}' reader")

    print(f"[web] serving on http://{args.host}:{args.http_port}")
    app.run(host=args.host, port=args.http_port, threaded=True)


if __name__ == "__main__":
    main()
