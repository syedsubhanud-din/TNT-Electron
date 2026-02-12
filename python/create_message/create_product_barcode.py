#!/usr/bin/env python3
"""
Create message with text + barcode (Code128) or QR code.
Structure: text source + text source (data) → text object + barcode object.
"""

import argparse
import socket
import json
import time
import sys

PRINTER_IP = "172.16.0.55"
PRINTER_PORT = 9944


def send_command(s, cmd):
    s.sendall((json.dumps(cmd, separators=(',', ':')) + '\r\n').encode())
    try:
        s.settimeout(5)
        r = s.recv(65536).decode().strip()
        return json.loads(r)
    finally:
        s.settimeout(None)


# Barcode (Code128) - top half, text below
BARCODE_STYLE = {
    "x": 0, "y": 0, "w": 500, "h": 200,
    "rotate": 0, "mirror": 0, "stretch": 0, "reverse": 0,
    "visiblity": "visible", "halign": 0, "valign": 0,
    "font_style": "ttf-default-r*nnn*-80-80-UTF-8",
    "format": "code128",
    "human_readable": "bottom",
    "bearer_bar_type": "none",
    "extras": {}, "data_type": "unicode",
    "text_margin": 3, "x_dimension": 5, "bar_height": 153,
    "quiet_zone": 0, "bearer_bar_thickness": 0,
    "gs1_nocheck": False, "escape_seq": False,
    "pivot_x": 0, "pivot_y": 0, "scale_x": 1, "scale_y": 1,
    "paint_style": "fill", "line_cap": "butt", "line_join": "miter",
    "line_width": 0, "line_miter": 0, "dot": False,
    "gs1_ai_delimiter": "auto", "fast_encoding": False,
}

# QR code - top half, text below
QRCODE_STYLE = {
    "x": 0, "y": 0, "w": 250, "h": 250,
    "rotate": 0, "mirror": 0, "stretch": 0, "reverse": 0,
    "visiblity": "visible", "halign": 0, "valign": 0,
    "font_style": "ttf-default-r*nnn*-80-80-UTF-8",
    "format": "qr_code",
    "human_readable": "bottom",
    "bearer_bar_type": "none",
    "extras": {"qr_ver": 0, "qr_ec_level": "auto"},
    "data_type": "unicode",
    "text_margin": 3, "x_dimension": 14, "bar_height": 227,
    "quiet_zone": 0, "bearer_bar_thickness": 0,
    "gs1_nocheck": False, "escape_seq": False,
    "pivot_x": 0, "pivot_y": 0, "scale_x": 1, "scale_y": 1,
    "paint_style": "fill", "line_cap": "butt", "line_join": "miter",
    "line_width": 0, "line_miter": 0, "dot": False,
    "gs1_ai_delimiter": "auto", "fast_encoding": False,
}

TEXT_STYLE_BASE = {
    "rotate": 0, "mirror": 0, "stretch": 0, "reverse": 0,
    "visiblity": "visible", "halign": 0, "valign": 0,
    "row_space": 1, "letter_space": 10, "fh_ratio": 0, "fw_ratio": 0,
    "pivot_x": 0, "pivot_y": 0, "scale_x": 1, "scale_y": 1,
    "paint_style": "fill", "line_cap": "butt", "line_join": "miter",
    "line_width": 0, "line_miter": 1, "letter_spacing": 0,
    "font_style": "ttf-default-r*nnn*-127-127-UTF-8",
}


def main():
    ap = argparse.ArgumentParser(
        description="Create message with text + barcode (Code128) or QR code"
    )
    ap.add_argument("msg_name", nargs="?", help="Message name")
    ap.add_argument("product_text", nargs="?", help="Product description")
    ap.add_argument("data", nargs="?", help="Barcode/QR data (e.g. 12345 or URL)")
    ap.add_argument(
        "-t", "--type",
        choices=["barcode", "qrcode"],
        default="barcode",
        help="Barcode type: barcode (Code128) or qrcode (default: barcode)"
    )
    args = ap.parse_args()

    if args.msg_name and args.product_text and args.data:
        msg_name, product_text, data = args.msg_name, args.product_text, args.data
    else:
        print("=" * 60)
        print("CREATE MESSAGE WITH TEXT + BARCODE / QR CODE")
        print("=" * 60)
        msg_name = input("Message name: ").strip()
        product_text = input("Product description (text): ").strip()
        data = input(f"{args.type.capitalize()} data: ").strip()
        if not data:
            data = input("Barcode/QR data: ").strip()

    if not all([msg_name, product_text, data]):
        ap.print_help()
        print("\nExamples:")
        print("  python create_product_barcode.py Prod1 'My Product' 12345")
        print("  python create_product_barcode.py Prod1 'My Product' https://example.com -t qrcode")
        sys.exit(1)

    use_qrcode = args.type == "qrcode"
    code_style = QRCODE_STYLE if use_qrcode else BARCODE_STYLE
    code_label = "QR code" if use_qrcode else "Barcode (code128)"
    # Text below code: vertical stack, no overlap
    code_h = code_style["h"]
    text_y = code_h + 15
    text_style = {"x": 0, "y": text_y, "w": code_style["w"] + 100, "h": 80, **TEXT_STYLE_BASE}

    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.connect((PRINTER_IP, PRINTER_PORT))

    try:
        # 1. Text source (product description)
        r = send_command(s, {
            "request_type": "post", "path": "/data/source", "hash": int(time.time()),
            "type": "text", "name": f"{msg_name}_Text",
            "attribute": {"content": product_text}
        })
        if r.get("status") != "ok":
            print("Failed text source:", r)
            sys.exit(1)
        text_src_id = r["id"]
        time.sleep(0.3)

        # 2. Text source (barcode/QR data - barcode object uses text source)
        r = send_command(s, {
            "request_type": "post", "path": "/data/source", "hash": int(time.time()),
            "type": "text", "name": f"{msg_name}_Data",
            "attribute": {"content": data}
        })
        if r.get("status") != "ok":
            print("Failed data source:", r)
            sys.exit(1)
        data_src_id = r["id"]
        time.sleep(0.3)

        # 3. Text object (right of barcode/QR, no overlap)
        r = send_command(s, {
            "request_type": "post", "path": "/data/object", "hash": int(time.time()),
            "type": "text", "name": f"{msg_name}_TextObj",
            "style": text_style,
            "attribute": {}, "source_list": [{"type": "text", "id": text_src_id}]
        })
        if r.get("status") != "ok":
            print("Failed text object:", r)
            sys.exit(1)
        text_obj_id = r["id"]
        time.sleep(0.3)

        # 4. Barcode/QR object (type=barcode, format=code128|qr_code)
        r = send_command(s, {
            "request_type": "post", "path": "/data/object", "hash": int(time.time()),
            "type": "barcode", "name": "Barcode",
            "style": code_style,
            "attribute": {}, "source_list": [{"type": "text", "id": data_src_id}]
        })
        if r.get("status") != "ok":
            print("Failed barcode object:", r)
            sys.exit(1)
        code_obj_id = r["id"]
        time.sleep(0.3)

        # 5. New message
        prefs = [{"ff_margin": 60, "fr_margin": 0, "bf_margin": 0, "br_margin": 0, "continuous_print": False}] * 4
        r = send_command(s, {
            "request_type": "post", "path": "/data/data", "hash": int(time.time()),
            "name": msg_name,
            "attribute": {"printdata_pref": {"print_prefs": prefs}},
            "object_list": [
                {"id": text_obj_id, "type": "text"},
                {"id": code_obj_id, "type": "barcode"}
            ]
        })
        if r.get("status") != "ok":
            print("Failed message:", r)
            sys.exit(1)

        print(f"\n[OK] Message '{msg_name}' created (id={r['id']})")
        print(f"     Text: {product_text}")
        print(f"     {code_label}: {data}")
    finally:
        s.close()


if __name__ == "__main__":
    main()
