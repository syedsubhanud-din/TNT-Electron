#!/usr/bin/env python3
"""
Create product message with QR code for M2 IPS-9510 printer.
No image upload - QR source set like text (type + content only).
"""

import socket
import json
import time
import sys

PRINTER_IP = "172.16.0.55"
PRINTER_PORT = 9944


def make_source_attribute(
    content: str, limit: int = None, editable: bool = True, barcode_format: str = None
) -> dict:
    """
    Build attribute dict for a source (text, barcode, image, etc.).
    Fields: content, limit (optional), edit toggle (exported=false = editable), format (e.g. 'QR Code' for barcode).
    """
    attr = {"content": content, "exported": not editable}
    if limit is not None:
        attr["limit"] = limit
    if barcode_format:
        attr["format"] = barcode_format
    return attr


def send_command(socket_obj, command_dict):
    """Send a command and wait for response. Prints response for every command."""
    path = command_dict.get("path", "?")
    cmd_str = json.dumps(command_dict, separators=(',', ':')) + '\r\n'
    socket_obj.sendall(cmd_str.encode('utf-8'))
    try:
        socket_obj.settimeout(5)
        response = socket_obj.recv(65536)
        response_str = response.decode(errors='ignore').strip()
        parsed = json.loads(response_str)
        resp_str = json.dumps(parsed)
        if len(resp_str) > 500:
            resp_str = resp_str[:500] + "...(truncated)"
        print(f"  [RESPONSE] {path} -> {resp_str}")
        return parsed
    except socket.timeout:
        print(f"  [RESPONSE] {path} -> (timeout)")
        return None
    except json.JSONDecodeError:
        print(f"  [RESPONSE] {path} -> (raw) {response_str[:200]}...")
        return None
    finally:
        socket_obj.settimeout(None)


def main():
    print("=" * 70)
    print("CREATE PRODUCT MESSAGE WITH QR CODE (M2 IPS-9510)")
    print("=" * 70)

    # CLI or interactive mode
    if len(sys.argv) >= 4:
        message_name = sys.argv[1]
        product_info = sys.argv[2]
        qr_content = sys.argv[3]
        print("[INFO] Using CLI arguments")
    else:
        message_name = input("Enter message name (e.g., Product_001): ").strip()
        if not message_name:
            print("[ERROR] Message name cannot be empty!")
            sys.exit(1)
        product_info = input("Enter product information (text to display): ").strip()
        if not product_info:
            print("[ERROR] Product information cannot be empty!")
            sys.exit(1)
        qr_content = input("Enter QR code content (URL, ID, serial, etc.): ").strip()
        if not qr_content:
            print("[ERROR] QR code content cannot be empty!")
            sys.exit(1)

    if not message_name or not product_info or not qr_content:
        print("Usage: python create_product_qrcode.py <message_name> <product_info> <qr_content>")
        print("Example: python create_product_qrcode.py Prod1 'Widget XYZ' 'https://example.com/sku123'")
        sys.exit(1)

    print(f"\n[INFO] Message: {message_name}")
    print(f"[INFO] Product info: {product_info}")
    print(f"[INFO] QR content: {qr_content}")
    print("=" * 70)
    print("[INFO] No image upload - QR source like text (content only)")

    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        print(f"\n[INFO] Connecting to {PRINTER_IP}:{PRINTER_PORT}...")
        s.connect((PRINTER_IP, PRINTER_PORT))
        print("[SUCCESS] Connected")

        # Step 1: Create text source (product info)
        print("\n[STEP 1] Creating text source...")
        r = send_command(s, {
            "request_type": "post", "path": "/data/source", "hash": int(time.time()),
            "type": "text", "name": f"{message_name}_Text",
            "attribute": make_source_attribute(product_info, editable=True)
        })
        if not r or r.get("status") != "ok":
            print("[ERROR] Failed to create text source:", r)
            sys.exit(1)
        text_source_id = r["id"]
        time.sleep(0.5)

        # Step 2: Create QR source (same as text - type "text", content only)
        print("\n[STEP 2] Creating QR source (like text)...")
        r = send_command(s, {
            "request_type": "post", "path": "/data/source", "hash": int(time.time()),
            "type": "text", "name": f"{message_name}_QR",
            "attribute": {"content": qr_content}
        })
        if not r or r.get("status") != "ok":
            print("[ERROR] Failed to create QR source:", r)
            sys.exit(1)
        qr_source_id = r["id"]
        time.sleep(0.5)

        style_base = {
            "pivot_x": 0, "pivot_y": 0, "rotate": 0.0, "scale_x": 1.0, "scale_y": 1.0,
            "paint_style": "fill", "line_cap": "butt", "line_join": "miter",
            "line_width": 0, "miter_limit": 4,
            "font_style": "ttf-default-r*nnn*-378-378-UTF-8", "visiblity": "visible"
        }

        # Step 3: Create text object
        print("\n[STEP 3] Creating text object...")
        r = send_command(s, {
            "request_type": "post", "path": "/data/object", "hash": int(time.time()),
            "type": "text", "name": f"{message_name}_TextObj",
            "style": {"x": 0, "y": 10, "w": 800, "h": 80, **style_base},
            "attribute": {}, "source_list": [{"type": "text", "id": text_source_id}]
        })
        if not r or r.get("status") != "ok":
            print("[ERROR] Failed to create text object:", r)
            sys.exit(1)
        text_object_id = r["id"]
        time.sleep(0.5)

        # Step 4: Create QR object (same as text object)
        print("\n[STEP 4] Creating QR object...")
        r = send_command(s, {
            "request_type": "post", "path": "/data/object", "hash": int(time.time()),
            "type": "text", "name": f"{message_name}_QRObj",
            "style": {"x": 0, "y": 100, "w": 800, "h": 80, **style_base},
            "attribute": {}, "source_list": [{"type": "text", "id": qr_source_id}]
        })
        if not r or r.get("status") != "ok":
            print("[ERROR] Failed to create QR object:", r)
            sys.exit(1)
        qr_object_id = r["id"]
        time.sleep(0.5)

        # Step 5: Create message
        print("\n[STEP 5] Creating message...")
        prefs = [{"ff_margin": 60.0, "fr_margin": 0.0, "bf_margin": 0.0, "br_margin": 0.0}]
        prefs += [{"ff_margin": 0.0, "fr_margin": 0.0, "bf_margin": 0.0, "br_margin": 0.0}] * 3
        r = send_command(s, {
            "request_type": "post", "path": "/data/data", "hash": int(time.time()),
            "name": message_name,
            "attribute": {"printdata_pref": {"print_prefs": prefs}},
            "object_list": [
                {"id": text_object_id, "type": "text"},
                {"id": qr_object_id, "type": "text"}
            ]
        })
        if not r or r.get("status") != "ok":
            print("[ERROR] Failed to create message:", r)
            sys.exit(1)
        message_id = r["id"]

        print("\n" + "=" * 70)
        print("COMPLETED SUCCESSFULLY!")
        print("=" * 70)
        print(f"Message: '{message_name}' (ID: {message_id})")
        print(f"Product info: {product_info}")
        print(f"QR code content: {qr_content}")
        print("\nLayout: Product info (top) | QR code (below)")
        print("To print: python run_command.py print start", message_name)
        print("=" * 70)

    except ConnectionRefusedError:
        print(f"[ERROR] Could not connect to {PRINTER_IP}:{PRINTER_PORT}")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n[INFO] Interrupted")
    except Exception as e:
        print(f"[ERROR] {e}")
        import traceback
        traceback.print_exc()
    finally:
        s.close()
        print("\n[INFO] Disconnected")


if __name__ == "__main__":
    main()
