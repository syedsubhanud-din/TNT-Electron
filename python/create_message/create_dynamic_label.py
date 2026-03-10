import argparse
import socket
import json
import time
import sys
import os
from datetime import datetime, timezone
from pathlib import Path

try:
    from dotenv import load_dotenv
    script_dir = Path(__file__).resolve().parent
    load_dotenv(script_dir.parent / ".env")
    load_dotenv(script_dir / ".env")
except ImportError:
    pass

try:
    import psycopg2
except ImportError:
    psycopg2 = None

# Constants for Sojet-style printers
PRINTER_IP = "192.168.1.22"
PRINTER_PORT = 9944
# Scale factor: cm to printer dots
# Based on working payload: 1.8cm -> 280 dots => 155.56 dots/cm (approx 400 DPI)
# Using 190 for compatibility, but can be adjusted if positioning is off
SCALE = 190

def send_command(s, cmd):
    """Sends a JSON command to the printer and returns the parsed response."""
    payload = json.dumps(cmd, separators=(',', ':')) + '\r\n'
    s.sendall(payload.encode())
    try:
        s.settimeout(5)
        r = s.recv(65536).decode().strip()
        if not r: return {}
        # Parse first JSON response (sometimes printer sends multiple chunks)
        try:
            return json.loads(r.split('\r\n')[0])
        except Exception:
            return {"status": "error", "raw": r}
    except socket.timeout:
        return {"status": "timeout"}
    except Exception as e:
        return {"status": "error", "error": str(e)}
    finally:
        s.settimeout(None)

def log_to_db(barcode_value):
    """Saves the printed barcode content to the database."""
    if not psycopg2:
        return

    db_host = os.environ.get("MV40_DB_HOST")
    db_port = int(os.environ.get("MV40_DB_PORT", "5432"))
    db_name = os.environ.get("MV40_DB_NAME")
    db_user = os.environ.get("MV40_DB_USER")
    db_pass = os.environ.get("MV40_DB_PASSWORD")

    if not all([db_host, db_name, db_user, db_pass]):
        return

    try:
        conn = psycopg2.connect(
            host=db_host, port=db_port, dbname=db_name,
            user=db_user, password=db_pass,
            connect_timeout=3
        )
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO scans (barcode_value, scanned_at) VALUES (%s, %s)",
                (barcode_value, datetime.now(timezone.utc))
            )
        conn.commit()
        conn.close()
        print(f"  [DB] Logged printer message to database: {barcode_value}")
    except Exception as e:
        print(f"  [DB_ERROR] Failed to log to database: {e}")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--payload", help="JSON payload of elements from Canva")
    parser.add_argument("--name", help="Message name", default="")
    parser.add_argument("--print", action="store_true", help="Start printing immediately")
    parser.add_argument("--ip", default="192.168.1.22", help="Printer IP address")
    parser.add_argument("--port", type=int, default=9944, help="Printer port")
    args = parser.parse_args()

    printer_ip = args.ip
    printer_port = args.port

    if not args.payload:
        print("Error: --payload is required")
        sys.exit(1)

    try:
        # Load elements from payload
        if args.payload.endswith('.json'):
            with open(args.payload, 'r') as f:
                data = json.load(f)
        else:
            data = json.loads(args.payload)
    except Exception as e:
        print(f"Error parsing JSON payload: {e}")
        sys.exit(1)

    # Handle both object payload and single-array payload
    if isinstance(data, list):
        elements = data
        canvas_w = 10.0
        canvas_h = 300.0 / SCALE
    else:
        elements = data.get("elements", [])
        canvas_size = data.get("canvasSize", {})
        canvas_w = canvas_size.get("w", 10.0)
        canvas_h = canvas_size.get("h", 300.0 / SCALE)

    msg_name = args.name or f"MSG_{int(time.time() * 1000) % 10000:04d}"

    # 1. Connect to Printer
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(5)
    print(f"Connecting to printer at {printer_ip}:{printer_port}...")
    try:
        s.connect((printer_ip, printer_port))
        print("Connected successfully.")
    except Exception as e:
        print(f"[ERROR] Connection error: {e}")
        sys.exit(1)

    # Track extracted barcode value for DB logging
    final_barcode_content = ""

    try:
        source_map = {} # {element_id: printer_source_id}
        source_details = [] # Store full source info for the final structure
        created_objects = [] # Store full object info

        # Build element lookup for barcode source resolution
        el_by_id = {e["id"]: e for e in elements}

        # Pre-create SN-DATE source so barcode can include it (date changes at print time)
        sn_text_el = next((e for e in elements if str(e.get("name") or "") == "SN-TEXT"), None)
        sn_date_el = next((e for e in elements if str(e.get("name") or "") == "SN-DATE"), None)
        sn_date_source_id = None
        if sn_date_el:
            attr = sn_date_el.get("attribute", {})
            if attr.get("format"):
                date_attr = attr
            else:
                date_attr = {
                    "format": {
                        "hash": 23560760, "name": "JULION DAY", "locale": "default",
                        "radix": {"hash": 24481712, "name": "dec", "radix_digits": "0123456789"},
                        "items": [{"type": "date", "content": "DST"}, {"type": "date", "content": "HH"}, {"type": "date", "content": "mm"}, {"type": "date", "content": "ss"}]
                    },
                    "expiry": 0, "zero": 0, "expiry_unit": "year", "leading_zero": "leading_zeros",
                    "calendar": "gregorian", "daylight_saving_time": "off", "page": 0
                }
            r = send_command(s, {
                "request_type": "post", "path": "/data/source", "hash": int(time.time()),
                "type": "date", "name": "SN-DATE", "attribute": date_attr
            })
            if r.get("status") == "ok":
                sn_date_source_id = r["id"]
                source_map[sn_date_el["id"]] = sn_date_source_id
                source_details.append({"type": "date", "id": sn_date_source_id, "name": "SN-DATE", "attribute": date_attr})
                print(f"  [OK] Source 'SN-DATE' created (ID: {sn_date_source_id})")
            time.sleep(0.05)

        # Deduplicate SN-TEXT/SN-DATE: when multiple elements display the same content,
        # keep only the one that does NOT overlap the barcode (rightmost).
        from collections import defaultdict

        # Get barcode bounds
        barcode_right = 0
        for el in elements:
            if el.get("type") == "barcode":
                bx = el.get("x", 0) if "x" in el else el.get("style", {}).get("x", 0)
                bw = el.get("w", 0) if "w" in el else el.get("style", {}).get("w", 0)
                if "x" not in el and "style" not in el:
                    bx, bw = 0, 0
                bx_dots = int(round(bx * SCALE)) if isinstance(bx, (int, float)) else bx
                bw_dots = int(round(bw * SCALE)) if isinstance(bw, (int, float)) else bw
                barcode_right = max(barcode_right, bx_dots + bw_dots)
        if barcode_right == 0:
            barcode_right = 260

        def get_display_key(el):
            if el.get("type") in ("clock", "date"):
                return ("date",)
            content = el.get("content") or el.get("attribute", {}).get("content", "")
            return ("text", content)

        def get_x(el):
            x = el.get("x") or el.get("style", {}).get("x", 0)
            return int(round(x * SCALE)) if isinstance(x, (int, float)) else x

        def overlaps_barcode(el):
            return get_x(el) < barcode_right

        display_by_key = defaultdict(list)
        for el in elements:
            if el.get("type") not in ("text", "clock", "date"):
                continue
            display_by_key[get_display_key(el)].append(el)

        skip_display_ids = set()
        for key, group in display_by_key.items():
            if len(group) <= 1:
                continue
            non_overlapping = [e for e in group if not overlaps_barcode(e)]
            to_keep = max(non_overlapping, key=get_x) if non_overlapping else max(group, key=get_x)
            for el in group:
                if el.get("id") != to_keep.get("id"):
                    skip_display_ids.add(el["id"])
        if skip_display_ids:
            print(f"  Deduplicating {len(skip_display_ids)} element(s) (keeping non-overlapping per source)")

        # --- STEP 1: CREATE SOURCES ---
        print(f"Creating sources for {len(elements)} elements...")
        for el in elements:
            if el.get("id") in skip_display_ids:
                continue
            if el["type"] == "barcode":
                sids = el.get("sourceElementIds", [])
                qr_text = el.get("qrText", "")
                if sids:
                    # GS1 Data Matrix: create 3 separate sources (01, 10, 17) - printer expects list
                    prefixes = ['01', '10', '17']
                    barcode_source_ids = []
                    for idx, sid in enumerate(sids):
                        src_el = el_by_id.get(sid)
                        if src_el:
                            value = src_el.get("content", src_el.get("attribute", {}).get("content", ""))
                            if ':' in value:
                                value = value.split(':', 1)[1]
                            value = value.replace('-', '').strip()
                            prefix = prefixes[idx] if idx < len(prefixes) else ''
                            combined = prefix + value
                            src_payload = {
                                "request_type": "post", "path": "/data/source", "hash": int(time.time()),
                                "type": "text", "name": f"qr_{el.get('id', '')}_{idx}",
                                "attribute": {"content": combined, "exported": False, "limit_switch": False, "page": 0}
                            }
                            r = send_command(s, src_payload)
                            if r.get("status") == "ok":
                                barcode_source_ids.append({"type": "text", "id": r["id"]})
                                source_details.append({"type": "text", "id": r["id"], "name": src_payload["name"], "attribute": src_payload["attribute"]})
                            time.sleep(0.05)
                    # Add SN (21) and date to barcode if SN-TEXT and SN-DATE exist
                    if sn_text_el:
                        sn_val = sn_text_el.get("content") or sn_text_el.get("attribute", {}).get("content", "")
                        if ":" in sn_val:
                            sn_val = sn_val.split(":", 1)[1]
                        sn_val = sn_val.replace("-", "").strip()
                        if sn_val:
                            src_payload = {
                                "request_type": "post", "path": "/data/source", "hash": int(time.time()),
                                "type": "text", "name": f"qr_{el.get('id', '')}_sn",
                                "attribute": {"content": "21" + sn_val, "exported": False, "limit_switch": False, "page": 0}
                            }
                            r = send_command(s, src_payload)
                            if r.get("status") == "ok":
                                barcode_source_ids.append({"type": "text", "id": r["id"]})
                                source_details.append({"type": "text", "id": r["id"], "name": src_payload["name"], "attribute": src_payload["attribute"]})
                                print(f"  [OK] Barcode +SN (21) source added")
                            time.sleep(0.05)
                    if sn_date_source_id is not None:
                        barcode_source_ids.append({"type": "date", "id": sn_date_source_id})
                        print(f"  [OK] Barcode +date source added")
                    if barcode_source_ids:
                        source_map[f"barcode_{el['id']}"] = barcode_source_ids
                        print(f"  [OK] Barcode sources for '{el['id']}' created ({len(barcode_source_ids)} sources)")

                        # Build printable representation for DB logging
                        parts = []
                        prefixes = ['01', '10', '17']
                        for idx, sid in enumerate(sids):
                            src_el = el_by_id.get(sid)
                            if src_el:
                                val = src_el.get("content", src_el.get("attribute", {}).get("content", ""))
                                if ':' in val: val = val.split(':', 1)[1]
                                val = val.replace('-', '').strip()
                                parts.append(f"({prefixes[idx]}){val}")

                        if sn_text_el:
                            sn_val = sn_text_el.get("content") or sn_text_el.get("attribute", {}).get("content", "")
                            if ":" in sn_val: sn_val = sn_val.split(":", 1)[1]
                            sn_val = sn_val.replace("-", "").strip()
                            if sn_val:
                                parts.append(f"(21){sn_val}")

                        # Add manufacturing date (13) or similar if needed
                        parts.append(f"(13){datetime.now().strftime('%y%m%d')}")
                        final_barcode_content = "".join(parts)
                    continue
                elif not sids and qr_text:
                    final_barcode_content = qr_text
                    src_payload = {
                        "request_type": "post", "path": "/data/source", "hash": int(time.time()),
                        "type": "text", "name": f"qr_{el.get('id', '')}",
                        "attribute": {"content": qr_text, "exported": False, "limit_switch": False, "page": 0}
                    }
                else:
                    continue # Skip barcode source if no content

                r = send_command(s, src_payload)
                if r.get("status") == "ok":
                    sid = r["id"]
                    source_map[f"barcode_{el['id']}"] = sid
                    source_details.append({"type": "text", "id": sid, "name": src_payload["name"], "attribute": src_payload["attribute"]})
                    print(f"  [OK] Barcode source for '{el['id']}' created (ID: {sid})")
                continue

            # Skip if source already created (e.g. SN-DATE in pre-pass for barcode)
            if el["id"] in source_map:
                time.sleep(0.05)
                continue

            # Handle Fixed Elements (with attribute) and Canvas Elements (with content)
            src_type = "date" if el["type"] == "clock" or el["type"] == "date" else "text"
            src_name = el.get("name", str(el.get("id")))

            if "attribute" in el:
                # Use provided fixed attribute
                attribute = el["attribute"]
            else:
                # Create standard canvas attribute
                attribute = {"content": el.get("content", ""), "exported": False, "limit_switch": False, "page": 0}
                if src_type == "date":
                    attribute.update({
                        "format": {
                            "hash": 23560760, "name": "JULION DAY", "locale": "default",
                            "radix": {"hash": 24481712, "name": "dec", "radix_digits": "0123456789"},
                            "items": [{"type": "date", "content": "DST"}, {"type": "date", "content": "HH"}, {"type": "date", "content": "mm"}, {"type": "date", "content": "ss"}]
                        },
                        "expiry": 0, "zero": 0, "expiry_unit": "year", "leading_zero": "leading_zeros", "calendar": "gregorian", "daylight_saving_time": "off", "page": 0
                    })

            src_payload = {
                "request_type": "post", "path": "/data/source", "hash": int(time.time()),
                "type": src_type, "name": src_name, "attribute": attribute
            }

            r = send_command(s, src_payload)
            if r.get("status") == "ok":
                source_id = r["id"]
                source_map[el["id"]] = source_id
                source_details.append({"type": src_type, "id": source_id, "name": src_name, "attribute": attribute})
                print(f"  [OK] Source '{src_name}' created (ID: {source_id})")
            time.sleep(0.05)

        # --- STEP 2: CREATE OBJECTS ---
        print("Creating objects...")
        # Use canvas size for limits instead of hardcoded DOT_LIMIT
        canvas_dot_w = int(canvas_w * SCALE)
        canvas_dot_h = int(canvas_h * SCALE)
        DOT_LIMIT_X = canvas_dot_w
        DOT_LIMIT_Y = canvas_dot_h

        def get_coord(el, key):
            """Get x/y/w/h from root (cm→dots) or style (already dots)."""
            val = el.get(key)
            if val is not None and isinstance(val, (int, float)):
                return int(round(val * SCALE))
            st = el.get("style") or {}
            val = st.get(key)
            return int(val) if val is not None else 0

        for el in elements:
            if el.get("id") in skip_display_ids:
                continue
            # Skip elements without usable coordinates
            if el.get("x") is None and (el.get("style") or {}).get("x") is None:
                continue
            # Scale coordinates properly - ensure they're within canvas bounds
            x = max(0, min(get_coord(el, "x"), DOT_LIMIT_X))
            y = max(0, min(get_coord(el, "y"), DOT_LIMIT_Y))
            w = max(1, min(get_coord(el, "w"), DOT_LIMIT_X - x))
            h = max(1, min(get_coord(el, "h"), DOT_LIMIT_Y - y))

            # Override SN-TEXT and SN-DATE positions to match reference layout
            el_name = str(el.get("name") or "")
            if el_name == "SN-TEXT":
                x, y, w, h = 297, 231, 413, 44
            elif el_name == "SN-DATE":
                x, y, w, h = 711, 231, 341, 44

            obj_type = el["type"]
            if obj_type not in ["text", "barcode", "clock", "date"]:
                continue  # Skip shapes/images for now as per current printer focus

            # Clock/Date renders as text object with date source
            render_type = "text" if obj_type in ["clock", "date"] else obj_type

            # Default premium style matching your example
            style = {
                "rotate": 0, "mirror": 0, "stretch": 0, "reverse": 0,
                "visiblity": "visible",
                "x": x, "y": y, "w": w, "h": h,
                "halign": 0, "valign": 0,
                "pivot_x": 0, "pivot_y": 0, "scale_x": 1, "scale_y": 1,
                "paint_style": "fill", "line_cap": "butt", "line_join": "miter",
                "line_width": 0, "line_miter": 1
            }

            obj_attribute = {
                "locked": False,
                "lock_aspect_ratio": (render_type == "text"),
                "relative_resize": False,
                "enabled": True,
                "page": 0
            }

            source_list = []

            if render_type == "text":
                fs = int(el.get("fontSize", 11) * 4) # Adjusting font size mapping
                style.update({
                    "font_style": f"ttf-OCR_B-r*nnn*-{fs}-{fs}-UTF-8",
                    "row_space": 1,
                    "letter_space": 10,
                    "letter_spacing": 0,
                    "text_skewx": -0.25,
                    "fh_ratio": 0, "fw_ratio": 0
                })
                src_type_for_obj = "date" if obj_type in ["clock", "date"] else "text"
                if el["id"] in source_map:
                    source_list.append({"type": src_type_for_obj, "id": source_map[el["id"]]})

            elif obj_type == "barcode":
                # Barcode style exactly matching the working printer payload
                style["line_miter"] = 0  # Override: barcode uses 0, not 1
                style.update({
                    "font_style": "ttf-default-r*nnn*-80-80-UTF-8",
                    "format": "data_matrix",
                    "human_readable": "bottom",
                    "bearer_bar_type": "none",
                    "extras": {"dm_size": 0, "gs1_gs_separator": False},
                    "data_type": "unicode",       # Required field from working payload
                    "text_margin": 3,
                    "x_dimension": 11,
                    "bar_height": 200,
                    "quiet_zone": 0,
                    "paint_style": "fill",
                    "line_cap": "butt",
                    "line_join": "miter",
                    "line_width": 0,
                    "line_miter": 0,
                    "bearer_bar_thickness": 0,
                    "gs1_nocheck": False,
                    "escape_seq": False,
                    "dot": False,
                    "gs1_ai_delimiter": "auto",
                    "fast_encoding": False
                })

                # Build barcode source_list from the key created in STEP 1
                barcode_key = f"barcode_{el['id']}"
                if barcode_key in source_map:
                    barcode_sources = source_map[barcode_key]
                    if isinstance(barcode_sources, list):
                        source_list = list(barcode_sources)
                    else:
                        source_list = [{"type": "text", "id": barcode_sources}]
                else:
                    for src in source_details:
                        source_list.append({"type": src["type"], "id": src["id"]})

            # Skip if no source (printer rejects empty source_list)
            if not source_list:
                continue

            # Name must be string; prefer el.name over el.id
            obj_name = str(el.get("name") or el.get("id") or f"obj_{int(time.time())}")

            # Create the object on the printer
            obj_payload = {
                "request_type": "post",
                "path": "/data/object",
                "hash": int(time.time()),
                "type": render_type,
                "name": obj_name,
                "attribute": obj_attribute,
                "style": style,
                "source_list": source_list
            }

            r = send_command(s, obj_payload)
            if r.get("status") == "ok":
                obj_id = r["id"]
                created_objects.append({
                    "type": render_type,
                    "name": obj_payload["name"],
                    "id": obj_id,
                    "attribute": obj_attribute,
                    "style": style,
                    "source_list": source_list
                })
                print(f"  [OK] Object '{obj_payload['name']}' created (ID: {obj_id})")
            else:
                print(f"  [ERROR] Failed to create object: {r}")
            time.sleep(0.05)

        # --- STEP 3: CREATE FINAL MESSAGE (DATA) ---
        if not created_objects:
            print("Error: No objects created. Aborting.")
            return

        print(f"Finalizing message '{msg_name}'...")

        # Enriched attributes matching your example
        print_prefs = [
            {"ff_margin": 40, "fr_margin": 0, "bf_margin": 0, "br_margin": 0, "continuous_print": False},
            {"ff_margin": 40, "fr_margin": 0, "bf_margin": 0, "br_margin": 0, "continuous_print": False},
            {"ff_margin": 40, "fr_margin": 0, "bf_margin": 0, "br_margin": 0, "continuous_print": False},
            {"ff_margin": 0, "fr_margin": 0, "bf_margin": 0, "br_margin": 0, "continuous_print": False}
        ]

        # Calculate printer bounds - must match Untitled-1 format (fixed_width:1900, fixed_height:300)
        fixed_w = int(round(canvas_w * SCALE))
        fixed_h = int(round(canvas_h * SCALE))

        final_payload = {
            "request_type": "post",
            "path": "/data/data",
            "hash": int(time.time()),
            "name": msg_name,
            "attribute": {
                "created_time": int(time.time()),
                "modified_time": int(time.time()),
                "permission": "rwx",
                "print_log": False,
                "printdata_pref": {"print_prefs": print_prefs},
                "fixed_boundary": False,
                "fixed_height": fixed_h,
                "fixed_width": fixed_w,
                "page_num": 1
            },
            "style": {
                "rotate": 0, "mirror": 0, "stretch": 0, "reverse": 0
            },
            "object_list": created_objects,
            "source_list": source_details
        }

        # Send the final bundled JSON
        r = send_command(s, final_payload)

        if r.get("status") == "ok":
            msg_id = r["id"]
            print(f"[OK] Message '{msg_name}' created (ID: {msg_id})")
            # Log the final JSON structure as requested
            print("\nGenerated JSON same as requested:")
            print(json.dumps(final_payload, indent=2))

            # Log to DB if successful
            if final_barcode_content:
                log_to_db(final_barcode_content)

            if args.print:
                print(f"\nStarting print job for '{msg_name}'...")
                time.sleep(0.5)
                p = send_command(s, {
                    "request_type": "post",
                    "path": "/engine/printjob",
                    "hash": int(time.time()),
                    "attribute": {"print_data_name": msg_name}
                })
                if p.get("status") == "ok":
                    print("[OK] Print sequence initiated.")
                else:
                    print(f"[ERROR] Failed to start print: {p}")
        else:
            print(f"[ERROR] Failed to finalize message: {r}")

    finally:
        s.close()
        print("Connection closed.")

if __name__ == "__main__":
    main()
