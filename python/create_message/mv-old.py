"""
Microscan MV40 -> PostgreSQL
Connects to MV40 over TCP (same as PuTTY), reads QR/Data Matrix decoded data,
and inserts each value into a PostgreSQL database.

Optimized for high-throughput (200-300 boxes/min):
  - Persistent camera TCP connection (ONLINE sent once)
  - Persistent DB connection with batch inserts
  - Graceful shutdown with pending-flush guarantee
"""

import socket
import time
import signal
import argparse
import os
import threading
import logging
from datetime import datetime, timezone
from pathlib import Path

try:
    from ftplib import FTP
except ImportError:
    FTP = None  # type: ignore

import sqlite3

# try:
#     import psycopg2
#     import psycopg2.extras
# except ImportError:
#     psycopg2 = None  # type: ignore

try:
    from dotenv import load_dotenv
    load_dotenv()
except (ImportError, ModuleNotFoundError):
    pass  # dotenv optional; env vars still work

# --- Configuration (override with .env, env vars, or CLI) ---
CAMERA_IP = os.environ.get("MV40_IP", "192.168.2.155")
CAMERA_PORT = int(os.environ.get("MV40_PORT", "49211"))
BARCODE_TAG = os.environ.get("MV40_BARCODE_TAG", "avp/insp1/snapshot1/barcode1/data")
DB_PATH = os.environ.get("MV40_DB_PATH", "mv40.db")
# DB_HOST = os.environ.get("MV40_DB_HOST", "localhost")
# DB_PORT = int(os.environ.get("MV40_DB_PORT", "5432"))
# DB_NAME = os.environ.get("MV40_DB_NAME", "mv40")
# DB_USER = os.environ.get("MV40_DB_USER", "postgres")
# DB_PASSWORD = os.environ.get("MV40_DB_PASSWORD", "")
TRIGGER_INTERVAL_SEC = float(os.environ.get("MV40_TRIGGER_INTERVAL", "1.0"))
BATCH_SIZE = int(os.environ.get("MV40_BATCH_SIZE", "10"))
BATCH_FLUSH_SEC = float(os.environ.get("MV40_BATCH_FLUSH_SEC", "1.0"))

log = logging.getLogger("mv40")


def setup_logging(verbose: bool) -> None:
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="[%(asctime)s] %(message)s",
        datefmt="%H:%M:%S",
    )


# ---------------------------------------------------------------------------
# Camera connection
# ---------------------------------------------------------------------------

class CameraConnection:
    """Persistent TCP connection to MV40 with auto-reconnect."""

    def __init__(
        self,
        ip: str,
        port: int,
        barcode_tag: str = BARCODE_TAG,
        cmd_delay: float = 0.01,
        command_logger: "DatabaseWriter | None" = None,
    ):
        self._ip = ip
        self._port = port
        self._barcode_tag = barcode_tag
        self._cmd_delay = cmd_delay
        self._command_logger = command_logger
        self._sock: socket.socket | None = None
        self._is_online: bool = False

    def connect(self) -> None:
        """Open TCP socket and send ONLINE so the camera is armed and ready.
        Capturing does NOT start until trigger() is called explicitly.
        """
        if self._sock is not None:
            self.close()
        self._sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self._sock.settimeout(10.0)
        log.info("Connecting to camera at %s:%d...", self._ip, self._port)
        self._sock.connect((self._ip, self._port))
        self._is_online = False
        self.online()

    def online(self) -> None:
        """Send ONLINE to start camera inspections."""
        if self._sock is None:
            self.connect()
        self._send_cmd_read_response("ONLINE")
        self._is_online = True
        log.info("Camera ONLINE — inspections started.")

    def offline(self) -> None:
        """Send OFFLINE to stop camera inspections gracefully."""
        if self._sock:
            try:
                self._send_cmd_read_response("OFFLINE", timeout=3.0)
                self._is_online = False
                log.info("Camera set OFFLINE.")
            except OSError:
                pass

    def close(self) -> None:
        if self._sock:
            try:
                self._sock.close()
            except OSError:
                pass
            self._sock = None

    def _ensure_connected(self) -> None:
        if self._sock is None:
            self.connect()

    def _send_cmd(self, cmd: str) -> None:
        self._sock.sendall((cmd.strip() + "\r\n").encode())
        if self._cmd_delay > 0:
            time.sleep(self._cmd_delay)

    def _read_response(self, timeout: float = 2.0) -> str:
        """Read until ETX (\\x03) which the camera uses as end-of-message."""
        self._sock.settimeout(timeout)
        chunks: list[bytes] = []
        try:
            while True:
                chunk = self._sock.recv(4096)
                if not chunk:
                    break
                chunks.append(chunk)
                if b"\x03" in b"".join(chunks):
                    break
        except (socket.timeout, TimeoutError):
            log.warning("Timeout reading response from camera")
            pass
        return b"".join(chunks).decode(errors="replace").strip()

    def _drain_buffer(self, timeout: float = 0.15) -> None:
        """Discard any unsolicited camera data sitting in the receive buffer."""
        self._sock.settimeout(timeout)
        try:
            while self._sock.recv(4096):
                pass
        except (socket.timeout, TimeoutError, OSError):
            pass

    def _send_cmd_read_response(self, cmd: str, timeout: float = 60) -> str:
        """Send command, read response, optionally log to command_log table. Returns response."""
        self._send_cmd(cmd)
        r = self._read_response(timeout)
        if self._command_logger:
            self._command_logger.log_command(cmd, r)
        return r

    def recv_raw(self, size: int = 4096, timeout: float = 1.0) -> bytes:
        """Read raw bytes from socket. Returns empty bytes on timeout/disconnect."""
        self._ensure_connected()
        self._sock.settimeout(timeout)
        try:
            return self._sock.recv(size)
        except socket.timeout:
            return b""
        except OSError:
            return b""

    @staticmethod
    def _parse_tag_response(raw: str) -> tuple[str | None, str | None]:
        """Clean a GET tag response. Returns (value, error)."""
        # Strip the ETX terminator and any !OK acknowledgement
        cleaned = raw.replace("\x03", "").replace("!OK", "").strip()
        if cleaned.startswith("!ERROR"):
            return None, cleaned
        # Take only the first line — the tag value; ignore any trailing status lines
        first_line = cleaned.splitlines()[0].strip() if cleaned else ""
        if not first_line:
            return None, "Empty response"
        # Reject noise: a valid barcode is at least 6 chars and contains non-digits
        if len(first_line) < 6 or first_line.isdigit():
            return None, f"Noise/stale response: {first_line!r}"
        return first_line, None

    def trigger(self) -> tuple[str | None, str | None]:
        """Trigger one scan, GET barcode data. Returns (value, error). Reconnects on failure."""
        try:
            self._ensure_connected()
            self._send_cmd_read_response("TRIGGER")
            time.sleep(0.2)  # Wait for camera to process
            self._drain_buffer()  # Discard any auto-pushed inspection results
            result = self._send_cmd_read_response(f"GET {self._barcode_tag}")
            return self._parse_tag_response(result)
        except (OSError, socket.error) as exc:
            log.warning("Camera connection error: %s, reconnecting...", exc)
            self.close()
            try:
                self.connect()  # connect() calls online() internally
                self._send_cmd_read_response("TRIGGER")
                time.sleep(0.2)
                self._drain_buffer()
                result = self._send_cmd_read_response(f"GET {self._barcode_tag}")
                return self._parse_tag_response(result)
            except (OSError, socket.error) as exc2:
                return None, f"Camera reconnect failed: {exc2}"

    def load_job(self, avp_path: str | Path) -> bool:
        """
        Load an AVP/AVZ job file onto the camera before running.
        Uses JOBDOWNLOAD (FTP) + JOBLOAD per MV-40 Guide Appendix D.
        Returns True on success, False on failure.
        """
        path = Path(avp_path)
        if not path.exists():
            log.error("Job file not found: %s", path)
            return False
        if FTP is None:
            log.error("FTP support required for job loading (stdlib ftplib)")
            return False

        size = path.stat().st_size

        self.connect()
        try:
            r = self._send_cmd_read_response("OFFLINE", 5.0)
            if "!ERROR" in r:
                log.warning("OFFLINE response: %s", r)

            log.info("Preparing RAM disk for job (%d bytes)...", size)
            r = self._send_cmd_read_response(f"JOBDOWNLOAD -transfer=ftp -size={size}", 5.0)
            if "!ERROR" in r:
                log.error("JOBDOWNLOAD failed: %s", r)
                return False
            log.info("JOBDOWNLOAD OK, uploading via FTP...")

            ftp = FTP(timeout=30)
            ftp.connect(self._ip, 21)
            try:
                ftp.login("target", "password")
            except Exception:
                try:
                    ftp.login("anonymous", "")
                except Exception:
                    ftp.login()
            # JOBDOWNLOAD creates /streamd0 RAM disk. Try: (1) cwd into streamd0
            # and store file; (2) else delete pre-created streamd0 and overwrite.
            def do_stor(cmd: str) -> None:
                with path.open("rb") as f:
                    ftp.storbinary(cmd, f)

            try:
                ftp.cwd("streamd0")
                do_stor(f"STOR {path.name}")
            except Exception:
                try:
                    ftp.delete("streamd0")
                except Exception:
                    pass
                do_stor("STOR streamd0")
            ftp.quit()

            log.info("Loading job and starting inspections...")
            r = self._send_cmd_read_response("JOBLOAD -mem -r", 10.0)
            if "!ERROR" in r:
                log.error("JOBLOAD failed: %s", r)
                return False
            log.info("Job loaded and running.")
            return True
        except Exception as exc:
            log.error("Job load failed: %s", exc)
            return False

    def listen_and_log(self, db: "DatabaseWriter") -> None:
        """Listen for raw data, parse into lines, log and insert into DB. Ctrl+C to stop."""
        run_listen_loop(self, db)

    def autofocus(self, x: int = 640, y: int = 480) -> tuple[str | None, str | None]:
        """
        Run QUICKFOCUS to adjust focus. Camera must support autofocus (MV-30/MV-40 with liquid lens).
        Returns (response_string, error) e.g. ("124;50;300", None) for focus=124mm, range 50-300mm.
        """
        try:
            self._ensure_connected()
            r = self._send_cmd_read_response("OFFLINE", 5.0)
            if "!ERROR" in r:
                return None, f"OFFLINE failed: {r}"
            log.info("Running QUICKFOCUS at (%d, %d)...", x, y)
            result = self._send_cmd_read_response(f"QUICKFOCUS {x} {y}", 10.0)
            result = result.replace("!OK\x03", "").strip()
            if result.startswith("!ERROR"):
                self._send_cmd_read_response("ONLINE", 2.0)
                return None, result
            self._send_cmd_read_response("ONLINE", 2.0)
            log.info("Autofocus done: %s (current;min;max mm)", result)
            return result, None
        except (OSError, socket.error) as exc:
            log.warning("Autofocus error: %s", exc)
            return None, str(exc)

    def __enter__(self):
        self.connect()
        return self

    def __exit__(self, *exc):
        self.close()


# ---------------------------------------------------------------------------
# Database writer
# ---------------------------------------------------------------------------

class DatabaseWriter:
    """Persistent SQLite connection with batch insert support."""

    # -- SQLite schema ---------------------------------------------------------
    CREATE_TABLE = """
        CREATE TABLE IF NOT EXISTS scans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            barcode_value TEXT NOT NULL,
            scanned_at TEXT NOT NULL
        )
    """

    CREATE_COMMAND_LOG_TABLE = """
        CREATE TABLE IF NOT EXISTS command_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            command TEXT NOT NULL,
            response TEXT,
            sent_at TEXT NOT NULL
        )
    """

    # -- PostgreSQL schema (commented out) -------------------------------------
    # CREATE_TABLE = """
    #     CREATE TABLE IF NOT EXISTS scans (
    #         id SERIAL PRIMARY KEY,
    #         barcode_value TEXT NOT NULL,
    #         scanned_at TIMESTAMPTZ NOT NULL
    #     )
    # """
    #
    # CREATE_COMMAND_LOG_TABLE = """
    #     CREATE TABLE IF NOT EXISTS command_log (
    #         id SERIAL PRIMARY KEY,
    #         command TEXT NOT NULL,
    #         response TEXT,
    #         sent_at TIMESTAMPTZ NOT NULL
    #     )
    # """

    def __init__(
        self,
        db_path: str = "mv40.db",
        batch_size: int = 10,
        flush_interval: float = 1.0,
        # host: str = "",       # PostgreSQL
        # port: int = 5432,     # PostgreSQL
        # dbname: str = "",     # PostgreSQL
        # user: str = "",       # PostgreSQL
        # password: str = "",   # PostgreSQL
    ):
        self._db_path = db_path
        # self._dsn = dict(host=host, port=port, dbname=dbname, user=user, password=password)
        self._conn: sqlite3.Connection | None = None
        self._batch: list[tuple[str, str]] = []
        self._batch_size = batch_size
        self._flush_interval = flush_interval
        self._last_flush = time.monotonic()
        self._lock = threading.Lock()
        self._total_inserted = 0

    def connect(self) -> None:
        if self._conn is not None:
            self.close()
        log.info("Opening SQLite database at %s...", self._db_path)
        self._conn = sqlite3.connect(self._db_path, check_same_thread=False)
        self._conn.isolation_level = None  # autocommit; we commit manually
        self._ensure_table()

        # -- PostgreSQL connect (commented out) ---------------------------------
        # if psycopg2 is None:
        #     raise RuntimeError("Install psycopg2: pip install psycopg2-binary")
        # if self._conn is not None:
        #     self.close()
        # log.info(
        #     "Connecting to PostgreSQL %s:%d/%s...",
        #     self._dsn["host"], self._dsn["port"], self._dsn["dbname"],
        # )
        # self._conn = psycopg2.connect(**self._dsn)
        # self._conn.autocommit = False
        # self._ensure_table()

    def _ensure_table(self) -> None:
        cur = self._conn.cursor()
        cur.execute(self.CREATE_TABLE)
        cur.execute(self.CREATE_COMMAND_LOG_TABLE)
        self._conn.commit()
        log.info("Tables 'scans' and 'command_log' ready.")

        # -- PostgreSQL _ensure_table (commented out) --------------------------
        # with self._conn.cursor() as cur:
        #     cur.execute(self.CREATE_TABLE)
        #     cur.execute(self.CREATE_COMMAND_LOG_TABLE)
        # self._conn.commit()

    def log_command(self, command: str, response: str | None = None) -> None:
        """Log a camera command and its response to command_log table."""
        ts = datetime.now(timezone.utc).isoformat()
        try:
            self._ensure_connected()
            cur = self._conn.cursor()
            cur.execute(
                "INSERT INTO command_log (command, response, sent_at) VALUES (?, ?, ?)",
                (command.strip(), response, ts),
            )
            self._conn.commit()
        except sqlite3.OperationalError as exc:
            log.debug("Command log failed (non-fatal): %s", exc)

        # -- PostgreSQL log_command (commented out) ----------------------------
        # try:
        #     self._ensure_connected()
        #     with self._conn.cursor() as cur:
        #         cur.execute(
        #             "INSERT INTO command_log (command, response, sent_at) VALUES (%s, %s, %s)",
        #             (command.strip(), response, ts),
        #         )
        #     self._conn.commit()
        # except (psycopg2.OperationalError, psycopg2.InterfaceError) as exc:
        #     log.debug("Command log failed (non-fatal): %s", exc)

    def _ensure_connected(self) -> None:
        if self._conn is None:
            self.connect()
            return
        try:
            self._conn.execute("SELECT 1")
        except sqlite3.OperationalError:
            log.warning("DB connection lost, reconnecting...")
            self.connect()

        # -- PostgreSQL _ensure_connected (commented out) ----------------------
        # if self._conn is None or self._conn.closed:
        #     self.connect()
        #     return
        # try:
        #     with self._conn.cursor() as cur:
        #         cur.execute("SELECT 1")
        # except (psycopg2.OperationalError, psycopg2.InterfaceError):
        #     log.warning("DB connection lost, reconnecting...")
        #     self.connect()

    def add_scan(self, value: str) -> None:
        """Queue a scan for batch insert. Flushes when batch is full."""
        ts = datetime.now(timezone.utc).isoformat()
        value = value.replace("!ERROR", "").strip()
        value = value.replace("\x03", "").strip()
        with self._lock:
            self._batch.append((value.strip(), ts))
            if len(self._batch) >= self._batch_size:
                self._flush_locked()

    def flush(self) -> int:
        """Force flush pending scans. Returns count flushed."""
        with self._lock:
            return self._flush_locked()

    def _flush_locked(self) -> int:
        if not self._batch:
            return 0
        batch = self._batch[:]
        self._batch.clear()
        count = len(batch)
        try:
            self._ensure_connected()
            cur = self._conn.cursor()
            cur.executemany(
                "INSERT INTO scans (barcode_value, scanned_at) VALUES (?, ?)",
                batch,
            )
            self._conn.commit()
            self._total_inserted += count
            self._last_flush = time.monotonic()
            log.info("Flushed %d scans (total: %d)", count, self._total_inserted)
        except sqlite3.OperationalError as exc:
            log.error("DB flush failed: %s, will retry", exc)
            self._batch = batch + self._batch
            self._conn = None
        return count

        # -- PostgreSQL _flush_locked (commented out) --------------------------
        # try:
        #     self._ensure_connected()
        #     with self._conn.cursor() as cur:
        #         psycopg2.extras.execute_values(
        #             cur,
        #             "INSERT INTO scans (barcode_value, scanned_at) VALUES %s",
        #             batch,
        #             template="(%s, %s)",
        #         )
        #     self._conn.commit()
        #     self._total_inserted += count
        #     self._last_flush = time.monotonic()
        #     log.info("Flushed %d scans (total: %d)", count, self._total_inserted)
        # except (psycopg2.OperationalError, psycopg2.InterfaceError) as exc:
        #     log.error("DB flush failed: %s, will retry", exc)
        #     self._batch = batch + self._batch
        #     self._conn = None

    def maybe_flush(self) -> int:
        """Flush if flush_interval has elapsed. Call from main loop."""
        with self._lock:
            elapsed = time.monotonic() - self._last_flush
            if elapsed >= self._flush_interval and self._batch:
                return self._flush_locked()
        return 0

    @property
    def pending_count(self) -> int:
        return len(self._batch)

    @property
    def total_inserted(self) -> int:
        return self._total_inserted

    def close(self) -> None:
        self.flush()
        if self._conn is not None:
            try:
                self._conn.close()
            except Exception:
                pass
        self._conn = None

        # -- PostgreSQL close (commented out) ----------------------------------
        # if self._conn and not self._conn.closed:
        #     try:
        #         self._conn.close()
        #     except Exception:
        #         pass

    def __enter__(self):
        self.connect()
        return self

    def __exit__(self, *exc):
        self.close()


# ---------------------------------------------------------------------------
# Shutdown handler
# ---------------------------------------------------------------------------

class ShutdownHandler:
    """Coordinate clean shutdown on SIGINT/SIGTERM."""

    def __init__(self):
        self._shutdown = threading.Event()
        signal.signal(signal.SIGINT, self._handle)
        signal.signal(signal.SIGTERM, self._handle)

    def _handle(self, signum, frame):
        log.info("Shutdown signal received, finishing pending work...")
        self._shutdown.set()

    @property
    def should_stop(self) -> bool:
        return self._shutdown.is_set()

    def wait(self, timeout: float) -> bool:
        """Sleep for timeout, but return early on shutdown. Returns True if stopping."""
        return self._shutdown.wait(timeout)


# ---------------------------------------------------------------------------
# Operating modes
# ---------------------------------------------------------------------------

def run_loop(
    camera: CameraConnection,
    db: DatabaseWriter,
    interval_sec: float,
    verbose: bool,
) -> None:
    """Continuous trigger-read-insert loop."""
    log.info("Starting MV40 continuous loop.")
    log.info("  Trigger every %.1fs. Ctrl+C to stop.", interval_sec)
    shutdown = ShutdownHandler()

    while not shutdown.should_stop:
        value, err = camera.trigger()
        if err:
            log.info("Scan error: %s", err)
            if shutdown.wait(interval_sec):
                break
            continue
        log.info("SCANNED: %s", value)
        db.add_scan(value)
        db.maybe_flush()
        if shutdown.wait(interval_sec):
            break

    log.info("Flushing remaining scans...")
    db.flush()
    log.info("Stopped. Total scans inserted: %d", db.total_inserted)


def run_listen_loop(camera: CameraConnection, db: DatabaseWriter) -> None:
    """
    Listen-only loop: no TRIGGER from code. Keeps connection alive, receives/logs
    incoming data, and inserts each chunk into the database.
    """
    log.info("Starting MV40 listen loop (no trigger). Ctrl+C to stop.")
    shutdown = ShutdownHandler()
    camera._ensure_connected()

    buf = b""
    camera._sock.settimeout(2.0)

    while not shutdown.should_stop:
        try:
            chunk = camera._sock.recv(4096)
            line = chunk.decode(errors="replace").replace("!OK\x03", "").replace("!OK", "").strip()
            line = line.replace("!ERROR", "").strip()
            if line:
                log.info("SCANNED: %s", line)
                db.add_scan(line)
                db.maybe_flush()

        except socket.timeout:
            continue
        except OSError as exc:
            log.warning("Connection error: %s, reconnecting...", exc)
            camera.close()
            try:
                camera.connect()
            except OSError as exc2:
                log.error("Reconnect failed: %s", exc2)
                break
            buf = b""
            continue

    log.info("Flushing remaining scans...")
    db.flush()
    log.info("Stopped. Total scans inserted: %d", db.total_inserted)


def trigger_capture_and_insert(
    camera: CameraConnection,
    db: DatabaseWriter,
) -> tuple[str | None, str | None]:
    """
    Trigger camera capture once and insert the record into the database.
    Returns (value, None) on success, (None, error_msg) on failure.
    """
    value, err = camera.trigger()
    if err:
        return None, err
    db.add_scan(value)
    db.flush()
    return value, None


def run_once(
    camera: CameraConnection,
    db: DatabaseWriter,
) -> None:
    """Trigger once, insert, exit."""
    log.info("Single scan mode.")
    value, err = trigger_capture_and_insert(camera, db)
    if err:
        log.error("Scan error: %s", err)
        return
    log.info("Scanned: %s", value)
    log.info("Done.")


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="MV40 barcode scanner -> SQLite.",
    )
    parser.add_argument("--ip", default=CAMERA_IP, help="Camera IP")
    parser.add_argument("--port", type=int, default=CAMERA_PORT, help="Camera TCP port")
    parser.add_argument("--tag", default=BARCODE_TAG, help="GET tag for barcode data")
    parser.add_argument("--dbpath", default=DB_PATH, help="SQLite database file path")
    # parser.add_argument("--dbhost", default=DB_HOST, help="PostgreSQL host")
    # parser.add_argument("--dbport", type=int, default=DB_PORT, help="PostgreSQL port")
    # parser.add_argument("--dbname", default=DB_NAME, help="Database name")
    # parser.add_argument("--dbuser", default=DB_USER, help="Database user")
    # parser.add_argument("--dbpassword", default=DB_PASSWORD, help="Database password")
    parser.add_argument(
        "--interval", type=float, default=TRIGGER_INTERVAL_SEC,
        help="Seconds between triggers in loop mode (default: 1.0)",
    )
    parser.add_argument(
        "--batch-size", type=int, default=BATCH_SIZE,
        help="DB batch insert size (default: 10)",
    )
    parser.add_argument(
        "--batch-flush-sec", type=float, default=BATCH_FLUSH_SEC,
        help="Max seconds before flushing partial batch (default: 1.0)",
    )
    parser.add_argument("--once", action="store_true", help="Single scan then exit")
    parser.add_argument(
        "--capture",
        action="store_true",
        help="Trigger camera capture once and insert record into DB (same as --once)",
    )
    parser.add_argument(
        "--listen", action="store_true",
        help="Listen for incoming data and insert into DB (no trigger)",
    )
    parser.add_argument(
        "--load-job",
        default=os.environ.get("MV40_LOAD_JOB", ""),
        metavar="FILE",
        help="Load AVP/AVZ job file before running (e.g. 1.avp, or MV40_LOAD_JOB env)",
    )
    parser.add_argument(
        "--autofocus",
        action="store_true",
        help="Run QUICKFOCUS to adjust focus, then exit (no DB required)",
    )
    parser.add_argument(
        "--autofocus-x", type=int, default=640,
        help="X coordinate for QUICKFOCUS (default: 640)",
    )
    parser.add_argument(
        "--autofocus-y", type=int, default=480,
        help="Y coordinate for QUICKFOCUS (default: 480)",
    )
    parser.add_argument("-v", "--verbose", action="store_true", help="Debug logging")
    args = parser.parse_args()

    setup_logging(args.verbose)

    if args.autofocus:
        camera = CameraConnection(args.ip, args.port, args.tag)
        try:
            # if args.load_job:
            #     if not camera.load_job(args.load_job):
            #         raise SystemExit(1)
            # else:
            camera.connect()
            result, err = camera.autofocus(args.autofocus_x, args.autofocus_y)
            if err:
                log.error("Autofocus failed: %s", err)
                raise SystemExit(1)
            log.info("Autofocus complete. Focus: %s", result)
        finally:
            camera.close()
        return

    db = DatabaseWriter(
        db_path=args.dbpath,
        batch_size=args.batch_size,
        flush_interval=args.batch_flush_sec,
    )

    # -- PostgreSQL password guard (commented out) ----------------------------
    # if not args.dbpassword:
    #     log.error(
    #         "Database password required. "
    #         "Set MV40_DB_PASSWORD env var, use a .env file, or pass --dbpassword."
    #     )
    #     raise SystemExit(1)
    #
    # db = DatabaseWriter(
    #     host=args.dbhost,
    #     port=args.dbport,
    #     dbname=args.dbname,
    #     user=args.dbuser,
    #     password=args.dbpassword,
    #     batch_size=args.batch_size,
    #     flush_interval=args.batch_flush_sec,
    # )

    camera = CameraConnection(args.ip, args.port, args.tag, command_logger=db)
    try:
        # if args.load_job:
        #     if not camera.load_job(args.load_job):
        #         raise SystemExit(1)
        # else:
        camera.offline()
        camera.connect()
        with db:
            if args.listen:
                run_listen_loop(camera, db)
            elif args.once or args.capture:
                run_once(camera, db)
            else:
                run_loop(camera, db, args.interval, args.verbose)
    finally:
        camera.offline()
        camera.close()


if __name__ == "__main__":
    main()
