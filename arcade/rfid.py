"""
Pluggable RFID reader backends for the Arcade Card Manager.

Each backend exposes a ``run()`` method that loops forever, and calls the
``on_tap(uid)`` callback whenever a card is presented.  ``uid`` is a string
(hex or decimal, whatever the reader gives us) that uniquely identifies a card.

Backends
--------
sim      Software simulator -- emits random UIDs occasionally. Great for demos
         and for developing the UI without any hardware.
mfrc522  RC522 / MFRC522 SPI reader on a Raspberry Pi.  Needs `mfrc522` +
         `RPi.GPIO`.
pcsc     PC/SC contactless readers (ACR122U, most USB NFC readers). Needs
         `pyscard`.
serial   Any reader that streams the UID over a serial port as text
         (Wiegand-to-serial converters, many cheap USB modules). Needs
         `pyserial`.

USB "keyboard-wedge" readers do not need a backend at all: they type the card
number followed by Enter, so the browser can capture them directly.  Use the
"Keyboard wedge" option in the UI's Advanced Settings for those.
"""

import json
import time


def create_reader(kind, on_tap, port=None, baud=9600):
    kind = (kind or "sim").lower()
    if kind == "sim":
        return SimReader(on_tap)
    if kind == "mfrc522":
        return MFRC522Reader(on_tap)
    if kind == "pcsc":
        return PCSCReader(on_tap)
    if kind == "serial":
        return SerialReader(on_tap, port=port, baud=baud)
    return None


class _DebounceMixin:
    """Ignore repeated reads of the same card within a short window."""

    _last_uid = None
    _last_ts = 0.0
    debounce_seconds = 1.5

    def emit(self, uid):
        now = time.time()
        if uid == self._last_uid and (now - self._last_ts) < self.debounce_seconds:
            return
        self._last_uid = uid
        self._last_ts = now
        self.on_tap(uid)


class SimReader(_DebounceMixin):
    """Simulated reader with in-memory "card memory" so the on-card (NFC data)
    flow can be developed and tested without any hardware. Each virtual card
    keeps its own JSON blob, exactly like a real NFC chip's user memory."""

    def __init__(self, on_tap):
        self.on_tap = on_tap
        self.present_uid = None       # the card currently "on the reader"
        self.memory = {}              # uid -> data dict (what's written on that card)
        self.auto = True              # emit random taps for demos

    def place(self, uid):
        """Simulate placing a card on the reader (used by /api/scan/simulate)."""
        self.present_uid = uid

    def read_card(self):
        uid = self.present_uid
        if not uid:
            return None, None
        return uid, self.memory.get(uid)

    def write_card(self, data):
        uid = self.present_uid
        if not uid:
            return None
        self.memory[uid] = data
        return uid

    def run(self):
        import random

        pool = ["04A1B2C3", "04D4E5F6", "1234567890", "0987654321"]
        while True:
            time.sleep(random.uniform(8, 20))
            if not self.auto:
                continue
            uid = random.choice(pool)
            self.present_uid = uid
            self.emit(uid)


class MFRC522Reader(_DebounceMixin):
    """RC522 on a Raspberry Pi. Supports storing data ON the card: we keep a JSON
    blob in the card's text area via SimpleMFRC522.read()/write()."""

    def __init__(self, on_tap):
        self.on_tap = on_tap
        self._reader = None
        self._lock = None

    def _ensure(self):
        if self._reader is None:
            from mfrc522 import SimpleMFRC522
            import threading as _t
            self._reader = SimpleMFRC522()
            self._lock = _t.Lock()
        return self._reader

    def read_card(self):
        r = self._ensure()
        with self._lock:
            uid, text = r.read_no_block()
        if not uid:
            return None, None
        data = None
        if text:
            try:
                data = json.loads(text.strip())
            except Exception:
                data = None
        return str(uid), data

    def write_card(self, data):
        r = self._ensure()
        with self._lock:
            r.write(json.dumps(data, separators=(",", ":")))  # blocks until a card is present
            uid, _t = r.read_no_block()
        return str(uid) if uid else "written"

    def run(self):
        try:
            self._ensure()
        except ImportError:
            print("[rfid] mfrc522 not installed -- pip install mfrc522 RPi.GPIO")
            return
        try:
            while True:
                with self._lock:
                    uid, _text = self._reader.read_no_block()
                if uid:
                    self.emit(str(uid))
                time.sleep(0.25)
        finally:
            try:
                import RPi.GPIO as GPIO

                GPIO.cleanup()
            except Exception:
                pass


class PCSCReader(_DebounceMixin):
    """PC/SC readers (ACR122U etc.). Supports storing data ON the card: we write
    our JSON to the tag's user memory (NTAG21x) as an app-specific blob with a
    2-byte big-endian length header, starting at page 4.  This is our own format
    (not full NDEF) -- fine because this app both writes and reads it."""

    USER_PAGE = 4          # NTAG21x user memory starts here
    MAX_PAGES = 36         # NTAG213 has 36 user pages (144 bytes); larger tags have more

    def __init__(self, on_tap):
        self.on_tap = on_tap
        import threading as _t
        self._lock = _t.Lock()

    def _conn(self):
        from smartcard.System import readers
        rlist = readers()
        if not rlist:
            raise RuntimeError("no PC/SC readers found")
        conn = rlist[0].createConnection()
        conn.connect()
        return conn

    def _uid(self, conn):
        from smartcard.util import toHexString
        data, sw1, _sw2 = conn.transmit([0xFF, 0xCA, 0x00, 0x00, 0x00])
        return toHexString(data).replace(" ", "") if sw1 == 0x90 else None

    def read_card(self):
        with self._lock:
            conn = self._conn()
            try:
                uid = self._uid(conn)
                if not uid:
                    return None, None
                # Read length header (page 4, first 2 bytes)
                page4, sw1, _ = conn.transmit([0xFF, 0xB0, 0x00, self.USER_PAGE, 0x04])
                if sw1 != 0x90:
                    return uid, None
                length = (page4[0] << 8) | page4[1]
                if length == 0 or length > self.MAX_PAGES * 4:
                    return uid, None
                buf = bytes(page4[2:4])
                page = self.USER_PAGE + 1
                while len(buf) < length and page < self.USER_PAGE + self.MAX_PAGES:
                    chunk, sw1, _ = conn.transmit([0xFF, 0xB0, 0x00, page, 0x04])
                    if sw1 != 0x90:
                        break
                    buf += bytes(chunk)
                    page += 1
                try:
                    return uid, json.loads(buf[:length].decode("utf-8"))
                except Exception:
                    return uid, None
            finally:
                try: conn.disconnect()
                except Exception: pass

    def write_card(self, data):
        blob = json.dumps(data, separators=(",", ":")).encode("utf-8")
        payload = len(blob).to_bytes(2, "big") + blob
        while len(payload) % 4:
            payload += b"\x00"
        if len(payload) > self.MAX_PAGES * 4:
            raise RuntimeError("data too large for this tag")
        with self._lock:
            conn = self._conn()
            try:
                uid = self._uid(conn)
                for i in range(0, len(payload), 4):
                    page = self.USER_PAGE + i // 4
                    four = list(payload[i:i + 4])
                    _r, sw1, _sw2 = conn.transmit([0xFF, 0xD6, 0x00, page, 0x04] + four)
                    if sw1 != 0x90:
                        raise RuntimeError(f"write failed at page {page}")
                return uid or "written"
            finally:
                try: conn.disconnect()
                except Exception: pass

    def run(self):
        try:
            import smartcard  # noqa: F401
        except ImportError:
            print("[rfid] pyscard not installed -- pip install pyscard")
            return
        from smartcard.Exceptions import NoCardException, CardConnectionException
        print("[rfid] PC/SC reader active")
        while True:
            try:
                with self._lock:
                    conn = self._conn()
                    uid = self._uid(conn)
                    try: conn.disconnect()
                    except Exception: pass
                if uid:
                    self.emit(uid)
            except (NoCardException, CardConnectionException, RuntimeError):
                pass
            except Exception as exc:  # keep the thread alive on flaky hardware
                print(f"[rfid] pcsc error: {exc}")
            time.sleep(0.3)


class SerialReader(_DebounceMixin):
    def __init__(self, on_tap, port=None, baud=9600):
        self.on_tap = on_tap
        self.port = port
        self.baud = baud

    def run(self):
        try:
            import serial
        except ImportError:
            print("[rfid] pyserial not installed -- pip install pyserial")
            return
        if not self.port:
            print("[rfid] serial reader needs --port (e.g. /dev/ttyUSB0 or COM3)")
            return
        try:
            ser = serial.Serial(self.port, self.baud, timeout=1)
        except Exception as exc:
            print(f"[rfid] could not open {self.port}: {exc}")
            return
        print(f"[rfid] listening on {self.port} @ {self.baud}")
        while True:
            try:
                line = ser.readline().decode("utf-8", "ignore").strip()
                if line:
                    self.emit(line)
            except Exception as exc:
                print(f"[rfid] serial error: {exc}")
                time.sleep(1)
