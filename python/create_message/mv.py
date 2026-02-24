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

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    psycopg2 = None  # type: ignore

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv optional; env vars still work

# --- Configuration (override with .env, env vars, or CLI) ---
CAMERA_IP = os.environ.get("MV40_IP", "192.168.1.14")
CAMERA_PORT = int(os.environ.get("MV40_PORT", "49211"))
BARCODE_TAG = os.environ.get("MV40_BARCODE_TAG", "avp/insp1/snapshot1/barcode1/data")
DB_HOST = os.environ.get("MV40_DB_HOST", "localhost")
DB_PORT = int(os.environ.get("MV40_DB_PORT", "5432"))
DB_NAME = os.environ.get("MV40_DB_NAME", "mv40")
DB_USER = os.environ.get("MV40_DB_USER", "postgres")
DB_PASSWORD = os.environ.get("MV40_DB_PASSWORD", "")
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
    ):
        self._ip = ip
        self._port = port
        self._barcode_tag = barcode_tag
        self._cmd_delay = cmd_delay
        self._sock: socket.socket | None = None

    def connect(self, skip_online: bool = False) -> None:
        if self._sock is not None:
            self.close()
        self._sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self._sock.settimeout(10.0)
        log.info("Connecting to camera at %s:%d...", self._ip, self._port)
        self._sock.connect((self._ip, self._port))
        if not skip_online:
            self._send_cmd("ONLINE")
            log.info("Camera connected, ONLINE sent.")
        else:
            log.info("Camera connected (raw).")

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
        self._sock.settimeout(timeout)
        chunks: list[bytes] = []
        try:
            while True:
                chunk = self._sock.recv(4096)
                if not chunk:
                    break
                chunks.append(chunk)
                joined = b"".join(chunks)
                if b"\n" in joined or b"!OK" in joined or b"!ERROR" in joined:
                    break
        except socket.timeout:
            pass
        return b"".join(chunks).decode(errors="replace").strip()
    
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

    def trigger(self) -> tuple[str | None, str | None]:
        """Trigger one scan, GET barcode data. Returns (value, error). Reconnects on failure."""
        try:
            self._ensure_connected()
            self._send_cmd("TRIGGER")
            self._read_response()  # Consume TRIGGER response (!OK)
            time.sleep(0.2)  # Wait for camera to process
            self._send_cmd(f"GET {self._barcode_tag}")
            result = self._read_response()
            result = result.replace("!OK\x03", "").strip()
            if result.startswith("!ERROR"):
                return None, result
            if not result:
                return None, "Empty response"
            log.debug("Scan data: %s", result)
            return result, None
        except (OSError, socket.error) as exc:
            log.warning("Camera connection error: %s, reconnecting...", exc)
            self.close()
            try:
                self.connect()
                self._send_cmd("TRIGGER")
                self._read_response()
                time.sleep(0.2)
                self._send_cmd(f"GET {self._barcode_tag}")
                result = self._read_response()
                result = result.replace("!OK\x03", "").strip()
                if result.startswith("!ERROR"):
                    return None, result
                if not result:
                    return None, "Empty response"
                return result, None
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

        self.connect(skip_online=True)
        try:
            self._send_cmd("OFFLINE")
            r = self._read_response(5.0)
            if "!ERROR" in r:
                log.warning("OFFLINE response: %s", r)

            log.info("Preparing RAM disk for job (%d bytes)...", size)
            self._send_cmd(f"JOBDOWNLOAD -transfer=ftp -size={size}")
            r = self._read_response(5.0)
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
            self._send_cmd("JOBLOAD -mem -r")
            r = self._read_response(10.0)
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

    def __enter__(self):
        self.connect()
        return self

    def __exit__(self, *exc):
        self.close()


# ---------------------------------------------------------------------------
# Database writer
# ---------------------------------------------------------------------------

class DatabaseWriter:
    """Persistent PostgreSQL connection with batch insert support."""

    CREATE_TABLE = """
        CREATE TABLE IF NOT EXISTS scans (
            id SERIAL PRIMARY KEY,
            barcode_value TEXT NOT NULL,
            scanned_at TIMESTAMPTZ NOT NULL
        )
    """

    def __init__(
        self,
        host: str,
        port: int,
        dbname: str,
        user: str,
        password: str,
        batch_size: int = 10,
        flush_interval: float = 1.0,
    ):
        self._dsn = dict(host=host, port=port, dbname=dbname, user=user, password=password)
        self._conn = None
        self._batch: list[tuple[str, str]] = []
        self._batch_size = batch_size
        self._flush_interval = flush_interval
        self._last_flush = time.monotonic()
        self._lock = threading.Lock()
        self._total_inserted = 0

    def connect(self) -> None:
        if psycopg2 is None:
            raise RuntimeError("Install psycopg2: pip install psycopg2-binary")
        if self._conn is not None:
            self.close()
        log.info(
            "Connecting to PostgreSQL %s:%d/%s...",
            self._dsn["host"], self._dsn["port"], self._dsn["dbname"],
        )
        self._conn = psycopg2.connect(**self._dsn)
        self._conn.autocommit = False
        self._ensure_table()

    def _ensure_table(self) -> None:
        with self._conn.cursor() as cur:
            cur.execute(self.CREATE_TABLE)
        self._conn.commit()
        log.info("Table 'scans' ready.")

    def _ensure_connected(self) -> None:
        if self._conn is None or self._conn.closed:
            self.connect()
            return
        try:
            with self._conn.cursor() as cur:
                cur.execute("SELECT 1")
        except (psycopg2.OperationalError, psycopg2.InterfaceError):
            log.warning("DB connection lost, reconnecting...")
            self.connect()

    def add_scan(self, value: str) -> None:
        """Queue a scan for batch insert. Flushes when batch is full."""
        ts = datetime.now(timezone.utc).isoformat()
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
            with self._conn.cursor() as cur:
                psycopg2.extras.execute_values(
                    cur,
                    "INSERT INTO scans (barcode_value, scanned_at) VALUES %s",
                    batch,
                    template="(%s, %s)",
                )
            self._conn.commit()
            self._total_inserted += count
            self._last_flush = time.monotonic()
            log.info("Flushed %d scans (total: %d)", count, self._total_inserted)
        except (psycopg2.OperationalError, psycopg2.InterfaceError) as exc:
            log.error("DB flush failed: %s, will retry", exc)
            self._batch = batch + self._batch
            self._conn = None
        return count

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
        if self._conn and not self._conn.closed:
            try:
                self._conn.close()
            except Exception:
                pass
        self._conn = None

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
            log.debug("Scan error: %s", err)
            if shutdown.wait(interval_sec):
                break
            continue
        log.info("Scanned: %s", value)
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
            line = chunk.decode(errors="replace").replace("!OK\x03", "").replace("!OK\x03", "").strip()            
            if line:
                log.info("RECEIVED: %s", line)
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


def run_once(
    camera: CameraConnection,
    db: DatabaseWriter,
) -> None:
    """Trigger once, insert, exit."""
    log.info("Single scan mode.")
    value, err = camera.trigger()
    if err:
        log.error("Scan error: %s", err)
        return
    log.info("Scanned: %s", value)
    db.add_scan(value)
    db.flush()
    log.info("Done.")


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="MV40 barcode scanner -> PostgreSQL.",
    )
    parser.add_argument("--ip", default=CAMERA_IP, help="Camera IP")
    parser.add_argument("--port", type=int, default=CAMERA_PORT, help="Camera TCP port")
    parser.add_argument("--tag", default=BARCODE_TAG, help="GET tag for barcode data")
    parser.add_argument("--dbhost", default=DB_HOST, help="PostgreSQL host")
    parser.add_argument("--dbport", type=int, default=DB_PORT, help="PostgreSQL port")
    parser.add_argument("--dbname", default=DB_NAME, help="Database name")
    parser.add_argument("--dbuser", default=DB_USER, help="Database user")
    parser.add_argument("--dbpassword", default=DB_PASSWORD, help="Database password")
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
        "--listen", action="store_true",
        help="Listen for incoming data and insert into DB (no trigger)",
    )
    parser.add_argument(
        "--load-job",
        default=os.environ.get("MV40_LOAD_JOB", ""),
        metavar="FILE",
        help="Load AVP/AVZ job file before running (e.g. 1.avp, or MV40_LOAD_JOB env)",
    )
    parser.add_argument("-v", "--verbose", action="store_true", help="Debug logging")
    args = parser.parse_args()

    setup_logging(args.verbose)

    if not args.dbpassword:
        log.error(
            "Database password required. "
            "Set MV40_DB_PASSWORD env var, use a .env file, or pass --dbpassword."
        )
        raise SystemExit(1)

    db = DatabaseWriter(
        host=args.dbhost,
        port=args.dbport,
        dbname=args.dbname,
        user=args.dbuser,
        password=args.dbpassword,
        batch_size=args.batch_size,
        flush_interval=args.batch_flush_sec,
    )

    camera = CameraConnection(args.ip, args.port, args.tag)
    try:
        if args.load_job:
            if not camera.load_job(args.load_job):
                raise SystemExit(1)
        else:
            camera.connect()
        with db:
            if args.listen:
                run_listen_loop(camera, db)
            elif args.once:
                run_once(camera, db)
            else:
                run_loop(camera, db, args.interval, args.verbose)
    finally:
        camera.close()


if __name__ == "__main__":
    main()
