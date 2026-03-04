#!/usr/bin/env python3
import argparse
import socket
import json
import time
import sys

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

    elements = data.get("elements", [])
    # Canvas size from payload - defaults to 10cm x (300/190)cm for fixed_width:1900, fixed_height:300
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
    except socket.timeout:
        print(f"[ERROR] Connection timeout: Printer at {printer_ip}:{printer_port} did not respond within 5 seconds.")
        print("Please check:")
        print("  1. Printer is powered on and connected to network")
        print("  2. IP address is correct")
        print("  3. Printer port is correct (default: 9944)")
        print("  4. Firewall is not blocking the connection")
        sys.exit(1)
    except ConnectionRefusedError:
        print(f"[ERROR] Connection refused: Printer at {printer_ip}:{printer_port} actively refused the connection.")
        print("This usually means:")
        print("  1. Printer is not running or not ready")
        print("  2. Wrong IP address or port")
        print("  3. Printer service is not listening on this port")
        print("  4. Network connectivity issue")
        sys.exit(1)
    except socket.gaierror as e:
        print(f"[ERROR] DNS/Hostname resolution failed: {e}")
        print(f"Could not resolve IP address: {printer_ip}")
        sys.exit(1)
    except Exception as e:
        print(f"[ERROR] Connection error: {e}")
        print(f"Failed to connect to printer at {printer_ip}:{printer_port}")
        print("Please verify printer settings and network connectivity.")
        sys.exit(1)

    try:
        source_map = {} # {element_id: printer_source_id}
        source_details = [] # Store full source info for the final structure
        created_objects = [] # Store full object info

        # Build element lookup for barcode source resolution
        el_by_id = {e["id"]: e for e in elements}

        # --- STEP 1: CREATE SOURCES ---
        # Text & clock get sources; barcodes with static qrText (no linked sources) get one too
        print(f"Creating sources for {len(elements)} elements...")
        for el in elements:
            if el["type"] == "barcode":
                sids = el.get("sourceElementIds", [])
                qr_text = el.get("qrText", "")
                if sids:
                    # Build combined barcode value with prefixes 01, 10, 17
                    prefixes = ['01', '10', '17']
                    combined_value = ''
                    for idx, sid in enumerate(sids):
                        src_el = el_by_id.get(sid)
                        if src_el:
                            value = src_el.get("content", "")
                            # Remove label prefix before colon (e.g. "GTIN:08964001713210" -> "08964001713210")
                            if ':' in value:
                                value = value.split(':', 1)[1]
                            # Remove dashes
                            value = value.replace('-', '')
                            # Add prefix based on position
                            prefix = prefixes[idx] if idx < len(prefixes) else ''
                            combined_value += prefix + value
                    src_payload = {
                        "request_type": "post", "path": "/data/source", "hash": int(time.time()),
                        "type": "text",
                        "name": f"qr_combined_{el.get('id', '')}",
                        "attribute": {"content": combined_value, "exported": False, "limit_switch": False, "page": 0}
                    }
                    r = send_command(s, src_payload)
                    if r.get("status") == "ok":
                        source_map[f"barcode_combined_{el['id']}"] = r["id"]
                        source_details.append({
                            "type": "text", "id": r["id"], "name": src_payload["name"],
                            "attribute": src_payload["attribute"]
                        })
                        print(f"  [OK] Combined barcode source for '{el['id']}' created (ID: {r['id']}), value: {combined_value}")
                    time.sleep(0.05)
                elif not sids and qr_text:
                    # Create static text source when barcode has qrText and NO linked sources
                    src_payload = {
                        "request_type": "post", "path": "/data/source", "hash": int(time.time()),
                        "type": "text",
                        "name": f"qr_{el.get('id', '')}",
                        "attribute": {"content": qr_text, "exported": False, "limit_switch": False, "page": 0}
                    }
                    r = send_command(s, src_payload)
                    if r.get("status") == "ok":
                        source_map[f"barcode_static_{el['id']}"] = r["id"]
                        source_details.append({
                            "type": "text", "id": r["id"], "name": src_payload["name"],
                            "attribute": src_payload["attribute"]
                        })
                        print(f"  [OK] Static QR source for '{el['id']}' created (ID: {r['id']})")
                    time.sleep(0.05)
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
        # Use canvas size for limits instead of hardcoded DOT_LIMIT
        canvas_dot_w = int(canvas_w * SCALE)
        canvas_dot_h = int(canvas_h * SCALE)
        DOT_LIMIT_X = canvas_dot_w
        DOT_LIMIT_Y = canvas_dot_h

        for el in elements:
            # Scale coordinates properly - ensure they're within canvas bounds
            x = max(0, min(int(round(el["x"] * SCALE)), DOT_LIMIT_X))
            y = max(0, min(int(round(el["y"] * SCALE)), DOT_LIMIT_Y))

            # Clamp width and height so they don't exceed remaining space
            w = max(1, min(int(round(el["w"] * SCALE)), DOT_LIMIT_X - x))
            h = max(1, min(int(round(el["h"] * SCALE)), DOT_LIMIT_Y - y))

            obj_type = el["type"]
            if obj_type not in ["text", "barcode", "clock"]:
                continue  # Skip shapes/images for now as per current printer focus

            # Clock renders as text object with date source
            render_type = "text" if obj_type == "clock" else obj_type

            # Default premium style matching your example
            style = {
                "rotate": 0, "mirror": 0, "stretch": 0, "reverse": 0,
                "visiblity": "visible",
                "x": x, "y": y, "w": w, "h": h,
                "halign": 0, "valign": 0,
                "pivot_x": 0, "pivot_y": 0, "scale_x": 1, "scale_y": 1,
                # "paint_style": "fill", "line_cap": "butt", "line_join": "miter",
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
                src_type_for_obj = "date" if obj_type == "clock" else "text"
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

                # Build barcode source_list from combined source, static qrText, or fallback
                sids = el.get("sourceElementIds", [])
                combined_key = f"barcode_combined_{el['id']}"
                static_key = f"barcode_static_{el['id']}"
                if sids and combined_key in source_map:
                    # Use the combined source with prefixes (01/10/17) created in STEP 1
                    source_list.append({"type": "text", "id": source_map[combined_key]})
                elif static_key in source_map:
                    # Static qrText source created in STEP 1
                    source_list.append({"type": "text", "id": source_map[static_key]})
                else:
                    # No links and no static text: fallback to all sources (legacy)
                    for src in source_details:
                        source_list.append({"type": src["type"], "id": src["id"]})

            # Create the object on the printer
            obj_payload = {
                "request_type": "post",
                "path": "/data/object",
                "hash": int(time.time()),
                "type": render_type,
                "name": el.get("id", f"obj_{int(time.time())}"),
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
