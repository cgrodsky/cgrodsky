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
    amount      REAL NOT NULL DEFAULT 0,   -- money ($) for POS sales
    voided      INTEGER NOT NULL DEFAULT 0,
    ts          REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS packages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    price       REAL NOT NULL DEFAULT 0,   -- dollars charged
    credits     INTEGER NOT NULL DEFAULT 0,
    tickets     INTEGER NOT NULL DEFAULT 0
);
"""

# Columns added after v1; applied idempotently by migrate().
MIGRATIONS = {
    "cards": [
        ("status", "TEXT NOT NULL DEFAULT 'active'"),
        ("tier", "TEXT NOT NULL DEFAULT 'Standard'"),
        ("notes", "TEXT NOT NULL DEFAULT ''"),
    ],
    "items": [("category", "TEXT NOT NULL DEFAULT ''")],
    "transactions": [
        ("amount", "REAL NOT NULL DEFAULT 0"),
        ("voided", "INTEGER NOT NULL DEFAULT 0"),
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
        if db.execute("SELECT COUNT(*) AS n FROM packages").fetchone()[0] == 0:
            db.executemany(
                "INSERT INTO packages (name, price, credits, tickets) VALUES (?,?,?,?)",
                [
                    ("Starter — $5", 5, 50, 0),
                    ("Value — $10", 10, 120, 0),
                    ("Mega — $20", 20, 300, 0),
                    ("Party Pack — $50", 50, 800, 0),
                ],
            )
        db.commit()


def row_to_dict(row):
    return {k: row[k] for k in row.keys()}


def log_tx(db, uid, kind, detail="", credits_d=0, tickets_d=0, amount=0):
    db.execute(
        "INSERT INTO transactions (uid, kind, detail, credits_d, tickets_d, amount, ts) "
        "VALUES (?,?,?,?,?,?,?)",
        (uid, kind, detail, credits_d, tickets_d, amount, time.time()),
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
    db.execute(
        "INSERT INTO cards (uid, name, credits, tickets, created_at, updated_at) "
        "VALUES (?,?,?,?,?,?)",
        (uid, data.get("name", ""), int(data.get("credits", 0)),
         int(data.get("tickets", 0)), now, now),
    )
    log_tx(db, uid, "create_card", detail=data.get("name", ""))
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
    if (cd or td) and row["status"] == "frozen":
        return jsonify({"error": "card_frozen"}), 400

    new_credits = row["credits"] + cd
    new_tickets = row["tickets"] + td
    if new_credits < 0 or new_tickets < 0:
        return jsonify({"error": "insufficient_balance"}), 400

    name = data.get("name", row["name"])
    status = data.get("status", row["status"])
    tier = data.get("tier", row["tier"])
    notes = data.get("notes", row["notes"])
    db.execute(
        "UPDATE cards SET credits=?, tickets=?, name=?, status=?, tier=?, notes=?, updated_at=? WHERE uid=?",
        (new_credits, new_tickets, name, status, tier, notes, time.time(), uid),
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
    if card["status"] == "frozen":
        return jsonify({"error": "card_frozen"}), 400
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


@app.route("/api/packages", methods=["GET"])
def list_packages():
    db = get_db()
    rows = db.execute("SELECT * FROM packages ORDER BY price ASC").fetchall()
    return jsonify([row_to_dict(r) for r in rows])


@app.route("/api/packages", methods=["POST"])
def create_package():
    data = request.get_json(force=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name_required"}), 400
    db = get_db()
    cur = db.execute(
        "INSERT INTO packages (name, price, credits, tickets) VALUES (?,?,?,?)",
        (name, float(data.get("price", 0)), int(data.get("credits", 0)), int(data.get("tickets", 0))),
    )
    db.commit()
    row = db.execute("SELECT * FROM packages WHERE id=?", (cur.lastrowid,)).fetchone()
    return jsonify(row_to_dict(row)), 201


@app.route("/api/packages/<int:pkg_id>", methods=["PATCH"])
def update_package(pkg_id):
    data = request.get_json(force=True) or {}
    db = get_db()
    row = db.execute("SELECT * FROM packages WHERE id=?", (pkg_id,)).fetchone()
    if not row:
        return jsonify({"error": "not_found"}), 404
    db.execute(
        "UPDATE packages SET name=?, price=?, credits=?, tickets=? WHERE id=?",
        (data.get("name", row["name"]), float(data.get("price", row["price"])),
         int(data.get("credits", row["credits"])), int(data.get("tickets", row["tickets"])), pkg_id),
    )
    db.commit()
    row = db.execute("SELECT * FROM packages WHERE id=?", (pkg_id,)).fetchone()
    return jsonify(row_to_dict(row))


@app.route("/api/packages/<int:pkg_id>", methods=["DELETE"])
def delete_package(pkg_id):
    db = get_db()
    db.execute("DELETE FROM packages WHERE id=?", (pkg_id,))
    db.commit()
    return jsonify({"ok": True})


@app.route("/api/sell", methods=["POST"])
def sell_package():
    """Sell a top-up package to a card. Body: {uid, package_id}."""
    data = request.get_json(force=True) or {}
    db = get_db()
    card = db.execute("SELECT * FROM cards WHERE uid=?", (data.get("uid"),)).fetchone()
    pkg = db.execute("SELECT * FROM packages WHERE id=?", (data.get("package_id"),)).fetchone()
    if not card:
        return jsonify({"error": "card_not_found"}), 404
    if not pkg:
        return jsonify({"error": "package_not_found"}), 404
    if card["status"] == "frozen":
        return jsonify({"error": "card_frozen"}), 400
    db.execute(
        "UPDATE cards SET credits=credits+?, tickets=tickets+?, updated_at=? WHERE uid=?",
        (pkg["credits"], pkg["tickets"], time.time(), card["uid"]),
    )
    log_tx(db, card["uid"], "sale", detail=pkg["name"],
           credits_d=pkg["credits"], tickets_d=pkg["tickets"], amount=pkg["price"])
    db.commit()
    card = db.execute("SELECT * FROM cards WHERE uid=?", (card["uid"],)).fetchone()
    return jsonify(row_to_dict(card))


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
           credits_d=-tx["credits_d"], tickets_d=-tx["tickets_d"], amount=-tx["amount"])
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
    packages = [row_to_dict(r) for r in db.execute("SELECT * FROM packages").fetchall()]
    txs = [row_to_dict(r) for r in db.execute("SELECT * FROM transactions ORDER BY ts").fetchall()]
    return jsonify({"version": 2, "cards": cards, "items": items, "packages": packages, "transactions": txs})


@app.route("/api/import", methods=["POST"])
def import_data():
    """Restore a backup. Body: {cards, items}. Replaces existing cards & items."""
    data = request.get_json(force=True) or {}
    cards = data.get("cards", [])
    items = data.get("items", [])
    packages = data.get("packages", [])
    db = get_db()
    db.execute("DELETE FROM cards")
    db.execute("DELETE FROM items")
    db.execute("DELETE FROM packages")
    now = time.time()
    for c in cards:
        db.execute(
            "INSERT INTO cards (uid, name, credits, tickets, status, tier, notes, created_at, updated_at) "
            "VALUES (?,?,?,?,?,?,?,?,?)",
            (c.get("uid"), c.get("name", ""), int(c.get("credits", 0)), int(c.get("tickets", 0)),
             c.get("status", "active"), c.get("tier", "Standard"), c.get("notes", ""),
             c.get("created_at", now), c.get("updated_at", now)),
        )
    for it in items:
        db.execute(
            "INSERT INTO items (name, cost, currency, stock, emoji, category) VALUES (?,?,?,?,?,?)",
            (it.get("name", "Item"), int(it.get("cost", 0)), it.get("currency", "tickets"),
             int(it.get("stock", -1)), it.get("emoji", ""), it.get("category", "")),
        )
    for pk in packages:
        db.execute(
            "INSERT INTO packages (name, price, credits, tickets) VALUES (?,?,?,?)",
            (pk.get("name", "Package"), float(pk.get("price", 0)),
             int(pk.get("credits", 0)), int(pk.get("tickets", 0))),
        )
    db.commit()
    return jsonify({"ok": True, "cards": len(cards), "items": len(items), "packages": len(packages)})


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
    _broadcast_tap(uid)
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
            t = threading.Thread(target=reader.run, daemon=True)
            t.start()
            print(f"[rfid] started '{args.reader}' reader")

    print(f"[web] serving on http://{args.host}:{args.http_port}")
    app.run(host=args.host, port=args.http_port, threaded=True)


if __name__ == "__main__":
    main()
