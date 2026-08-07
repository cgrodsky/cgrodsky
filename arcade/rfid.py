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
    """Emits a fake tap every so often so the UI has something to show."""

    def __init__(self, on_tap):
        self.on_tap = on_tap

    def run(self):
        import random

        pool = ["04A1B2C3", "04D4E5F6", "1234567890", "0987654321"]
        while True:
            time.sleep(random.uniform(8, 20))
            self.emit(random.choice(pool))


class MFRC522Reader(_DebounceMixin):
    def __init__(self, on_tap):
        self.on_tap = on_tap

    def run(self):
        try:
            from mfrc522 import SimpleMFRC522
        except ImportError:
            print("[rfid] mfrc522 not installed -- pip install mfrc522 RPi.GPIO")
            return
        reader = SimpleMFRC522()
        try:
            while True:
                uid, _text = reader.read()  # blocks until a card is present
                self.emit(str(uid))
                time.sleep(0.2)
        finally:
            try:
                import RPi.GPIO as GPIO

                GPIO.cleanup()
            except Exception:
                pass


class PCSCReader(_DebounceMixin):
    def __init__(self, on_tap):
        self.on_tap = on_tap

    def run(self):
        try:
            from smartcard.System import readers
            from smartcard.util import toHexString
            from smartcard.Exceptions import NoCardException, CardConnectionException
        except ImportError:
            print("[rfid] pyscard not installed -- pip install pyscard")
            return

        rlist = readers()
        if not rlist:
            print("[rfid] no PC/SC readers found")
            return
        conn = rlist[0].createConnection()
        get_uid = [0xFF, 0xCA, 0x00, 0x00, 0x00]  # standard 'get UID' APDU
        print(f"[rfid] using PC/SC reader: {rlist[0]}")
        while True:
            try:
                conn.connect()
                data, sw1, sw2 = conn.transmit(get_uid)
                if sw1 == 0x90:
                    self.emit(toHexString(data).replace(" ", ""))
                conn.disconnect()
            except (NoCardException, CardConnectionException):
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
