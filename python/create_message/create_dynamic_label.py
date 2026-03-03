#!/usr/bin/env python3
import argparse
import socket
import json
import time
import sys

# Constants for Sojet-style printers
PRINTER_IP = "192.168.2.22"
PRINTER_PORT = 9944
# Scale factor: cm to printer dots
# Based on working payload: 1.8cm -> 280 dots => 155.5 dots/cm (approx 400 DPI)
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

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--payload", help="JSON payload of elements from Canva")
    parser.add_argument("--name", help="Message name", default="")
    parser.add_argument("--print", action="store_true", help="Start printing immediately")
    parser.add_argument("--ip", default="192.168.2.22", help="Printer IP address")
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

    elements = data.get("elements", [])
    # Canvas size from payload or defaults to 18x8cm
    canvas_w = data.get("canvasSize", {}).get("w", 18.0)
    canvas_h = data.get("canvasSize", {}).get("h", 8.0)

    msg_name = args.name or f"MSG_{int(time.time() * 1000) % 10000:04d}"

    # 1. Connect to Printer
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(5)
    print(f"Connecting to printer at {printer_ip}:{printer_port}...")
    try:
        s.connect((printer_ip, printer_port))
        print("Connected successfully.")
    except Exception as e:
        print(f"Error connecting to printer: {e}")
        sys.exit(1)

    try:
        source_map = {} # {element_id: printer_source_id}
        source_details = [] # Store full source info for the final structure
        created_objects = [] # Store full object info

        # --- STEP 1: CREATE SOURCES (text & clock only — barcodes do NOT get their own source) ---
        print(f"Creating sources for {len(elements)} elements...")
        for el in elements:
            # Barcodes reference text sources; they never get their own source entry
            if el["type"] == "barcode":
                continue

            src_type = "date" if el["type"] == "clock" else "text"
            content = el.get("content", "")
            src_name = el.get("id", f"src_{int(time.time() * 1000) % 1000:03d}")

            attribute = {
                "content": content,
                "exported": False,
                "limit_switch": False,
                "page": 0
            }

            if src_type == "date":
                # JULION DAY date format — matches working printer payload
                attribute.update({
                    "format": {
                        "hash": 23560760,
                        "name": "JULION DAY",
                        "radix": {
                            "hash": 24481712,
                            "name": "dec",
                            "radix_digits": "0123456789"
                        },
                        "locale": "default",
                        "items": [
                            {"type": "date", "content": "DST"},
                            {"type": "date", "content": "HH"},
                            {"type": "date", "content": "mm"},
                            {"type": "date", "content": "ss"}
                        ]
                    },
                    "expiry": 0, "zero": 0, "expiry_unit": "year",
                    "leading_zero": "leading_zeros", "calendar": "gregorian",
                    "daylight_saving_time": "off", "best_date": False,
                    "best_date_month": 0, "best_date_type": "last_day", "lose_days": 0
                })

            src_payload = {
                "request_type": "post", "path": "/data/source", "hash": int(time.time()),
                "type": src_type, "name": src_name, "attribute": attribute
            }

            r = send_command(s, src_payload)
            if r.get("status") == "ok":
                source_id = r["id"]
                source_map[el["id"]] = source_id
                source_details.append({
                    "type": src_type,
                    "id": source_id,
                    "name": src_name,
                    "attribute": src_payload["attribute"]
                })
                print(f"  [OK] Source '{src_name}' created (ID: {source_id})")
            else:
                print(f"  [ERROR] Failed to create source for '{el['id']}': {r}")
            time.sleep(0.05)

        # --- STEP 2: CREATE OBJECTS ---
        print("Creating objects...")
        DOT_LIMIT = 300
        for el in elements:
            x = max(0, min(int(el["x"] * SCALE), DOT_LIMIT))
            y = max(0, min(int(el["y"] * SCALE), DOT_LIMIT))

            # Clamp width and height so they don't exceed remaining space
            w = max(1, min(int(el["w"] * SCALE), DOT_LIMIT - x))
            h = max(1, min(int(el["h"] * SCALE), DOT_LIMIT - y))

            obj_type = el["type"]
            if obj_type not in ["text", "barcode"]:
                continue # Skip shapes/images for now as per current printer focus

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
                "lock_aspect_ratio": (obj_type == "text"),
                "relative_resize": False,
                "enabled": True,
                "page": 0
            }

            source_list = []

            if obj_type == "text":
                fs = int(el.get("fontSize", 11) * 4) # Adjusting font size mapping
                style.update({
                    "font_style": f"ttf-OCR_B-r*nnn*-{fs}-{fs}-UTF-8",
                    "row_space": 1,
                    "letter_space": 10,
                    "letter_spacing": 0,
                    "text_skewx": -0.25,
                    "fh_ratio": 0, "fw_ratio": 0
                })
                if el["id"] in source_map:
                    source_list.append({"type": "text", "id": source_map[el["id"]]})

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
                    "x_dimension": 14,
                    "bar_height": 200,
                    "quiet_zone": 0,
                    "bearer_bar_thickness": 0,
                    "gs1_nocheck": False,
                    "escape_seq": False,
                    "dot": False,
                    "gs1_ai_delimiter": "auto",
                    "fast_encoding": False
                })

                # Build barcode source_list from explicitly linked sources
                sids = el.get("sourceElementIds", [])
                if sids:
                    # Use specifically linked text elements
                    for sid in sids:
                        if sid in source_map:
                            src_type = "date" if elements[next((i for i, e in enumerate(elements) if e["id"] == sid), -1)]["type"] == "clock" else "text"
                            source_list.append({"type": src_type, "id": source_map[sid]})
                else:
                    # No explicit links: auto-link ALL text/date sources (fallback)
                    for src in source_details:
                        source_list.append({"type": src["type"], "id": src["id"]})

            # Create the object on the printer
            obj_payload = {
                "request_type": "post",
                "path": "/data/object",
                "hash": int(time.time()),
                "type": obj_type,
                "name": el.get("id", f"obj_{int(time.time())}"),
                "attribute": obj_attribute,
                "style": style,
                "source_list": source_list
            }

            r = send_command(s, obj_payload)
            if r.get("status") == "ok":
                obj_id = r["id"]
                created_objects.append({
                    "type": obj_type,
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

        # Calculate printer bounds based on canvas size
        fixed_w = int(canvas_w * SCALE)
        fixed_h = int(canvas_h * SCALE)

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
                "fixed_height": 300,
                "fixed_width": 300,
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
