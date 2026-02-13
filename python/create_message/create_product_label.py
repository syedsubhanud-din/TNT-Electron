#!/usr/bin/env python3
"""
Create product label: Data Matrix barcode (left) + human-readable text (right).
Uses generate_label_config format: 01{GTIN}21{SN}17{YYMMDD}10{Batch}
User inputs: GTIN, MFG, EXP, BATCH, SN, TMDA REG. NO.

Features:
- Data Matrix format (GS1-compatible)
- Barcode sources: "dynamic" (default), "single", "multi"
- dynamic: SN (user input) + SN-DATE (date) in Data Matrix - SN-DATE changes on every print
- SN-DATE: printer variable filled at print time, positioned adjacent to SN

Example usage:
  # Dynamic: SN-DATE in Data Matrix changes on every print, SN from user
  python create_product_label.py --gtin 08961101532710 --mfg 012026 --exp 012029 --batch 153A26 --sn 02750082604216564872

  # Static (single) or multi:
  python create_product_label.py --barcode-source single --gtin ... --sn 02750082604216564872
  python create_product_label.py --no-sn-date --gtin ... --batch 153A26
"""

import argparse
import random
import socket
import json
import time
import sys

from generate_label_config import build_qr_string, build_qr_parts, mmyyyy_to_display

PRINTER_IP = "172.16.0.55"
PRINTER_PORT = 9944

# --- Barcode source presets: user selects which config to use ---
# "single":  one text source with full GS1 string (static)
# "multi":   GS1 text + date source (SN-DATE in barcode, SN static)
# "dynamic": prefix + SN(user input) + suffix + date(SN-DATE) - SN-DATE changes on every print
BARCODE_SOURCE_PRESETS = ("single", "multi", "dynamic")

FIELDS = [
    ("gtin", "GTIN", "14"),
    ("mfg", "MFG", "6"),
    ("exp", "EXP", "6"),
    ("batch", "BATCH", None),
    ("sn", "SN", None),
    ("tmda_reg", "TMDA REG. NO.", None),
]
REQUIRED_KEYS = frozenset({"gtin", "mfg", "exp", "batch", "sn"})


def build_field_contents(values):
    """Build content for each field in exact label-config-example format. All from user input; only SN-DATE is dynamic (printer variable)."""
    return {
        "GTIN": f"GTIN: {values.get('gtin', '')}",
        "MFG": f"MFG: {mmyyyy_to_display(values.get('mfg', ''))}",
        "EXP": f"EXP: {mmyyyy_to_display(values.get('exp', ''))}",
        "BATCH": f"BATCH: {values.get('batch', '')}",
        "SN": f"SN: {values.get('sn', '')}",
    }


def validate_barcode_source(source: str) -> str:
    """Validate --barcode-source; return normalized value or raise."""
    norm = source.strip().lower() if source else "single"
    if norm not in BARCODE_SOURCE_PRESETS:
        raise ValueError(
            f"Invalid barcode source '{source}'. Must be one of: {', '.join(BARCODE_SOURCE_PRESETS)}"
        )
    return norm


def send_command(s, cmd):
    s.sendall((json.dumps(cmd, separators=(',', ':')) + '\r\n').encode())
    try:
        s.settimeout(5)
        r = s.recv(65536).decode().strip()
        return json.loads(r)
    finally:
        s.settimeout(None)


# Data matrix barcode - match label-config-example sizing
BARCODE_STYLE = {
    "x": 10, "y": 0, "w": 294, "h": 294,
    "rotate": 0, "mirror": 0, "stretch": 0, "reverse": 0,
    "visiblity": "visible", "halign": 0, "valign": 0,
    "font_style": "ttf-default-r*nnn*-80-80-UTF-8",
    "format": "data_matrix",
    "human_readable": "bottom",
    "bearer_bar_type": "none",
    "extras": {"dm_size": 0, "gs1_gs_separator": False},
    "data_type": "unicode",
    "text_margin": 3, "x_dimension": 14, "bar_height": 180,
    "quiet_zone": 0, "bearer_bar_thickness": 0,
    "gs1_nocheck": False, "escape_seq": False,
    "pivot_x": 0, "pivot_y": 0, "scale_x": 1, "scale_y": 1,
    "paint_style": "fill", "line_cap": "butt", "line_join": "miter",
    "line_width": 0, "line_miter": 0, "dot": False,
    "gs1_ai_delimiter": "auto", "fast_encoding": False,
}

# Per-field text styles matching label-config-example (separate lines, OCR font)
TEXT_FIELD_STYLE = {
    "font_style": "ttf-OCR_B-r*nnn*-40-40-UTF-8",
    "rotate": 0, "mirror": 0, "stretch": 0, "reverse": 0,
    "visiblity": "visible", "halign": 0, "valign": 0,
    "row_space": 1, "letter_space": 10, "fh_ratio": 0, "fw_ratio": 0,
    "pivot_x": 0, "pivot_y": 0, "scale_x": 1, "scale_y": 1,
    "paint_style": "fill", "line_cap": "butt", "line_join": "miter",
    "line_width": 0, "line_miter": 1, "letter_spacing": 0, "text_skewx": -0.25,
}
# Positions (x, y, w, h) for each field - to right of barcode
# SN-DATE adjacent to SN (printer variable at print time)
TEXT_FIELD_LAYOUT = [
    ("GTIN", 310, 2, 311, 40),
    ("MFG", 315, 53, 414, 40),
    ("EXP", 317, 108, 414, 40),
    ("BATCH", 315, 161, 445, 40),
    ("SN", 314, 202, 752, 40)
]
# SN-DATE: printer variable, filled at print time (positioned adjacent to SN row)
SN_DATE_LAYOUT = (693, 205, 207, 40)  # x, y, w, h - adjacent to SN

# SN-DATE date source format: HHmmss (printer injects at print time)
SN_DATE_SOURCE_ATTR = {
    "format": {
        "name": "HHmmss",
        "radix": {"name": "dec", "radix_digits": "0123456789"},
        "locale": "default",
        "items": [
            {"type": "date", "content": "HH"},
            {"type": "date", "content": "mm"},
            {"type": "date", "content": "ss"},
        ],
    },
    "expiry": 0, "zero": 0, "expiry_unit": "year",
    "leading_zero": "leading_zeros",
    "calendar": "gregorian",
    "daylight_saving_time": "off",
    "page": 0,
    "best_date": False,
    "best_date_month": 0,
    "best_date_type": "last_day",
    "lose_days": 0,
}


def main():
    ap = argparse.ArgumentParser(
        description="Create product label: QR (left) + GTIN/MFG/EXP/BATCH/SN/TMDA (right)"
    )
    ap.add_argument("msg_name", nargs="?", help="Message name")
    for key, label, _ in FIELDS:
        ap.add_argument(f"--{key}", help=f"{label} value")
    ap.add_argument(
        "--barcode-source",
        default="dynamic",
        choices=BARCODE_SOURCE_PRESETS,
        help="Barcode source: 'dynamic' (SN user input + SN-DATE in Data Matrix, default), "
             "'single' (static GS1), 'multi' (GS1 + date)",
    )
    ap.add_argument(
        "--sn-date",
        action="store_true",
        default=True,
        help="Add SN-DATE field (printer variable at print time). Default: True.",
    )
    ap.add_argument(
        "--no-sn-date",
        action="store_false",
        dest="sn_date",
        help="Omit SN-DATE field.",
    )
    args = ap.parse_args()

    # Validate barcode source (redundant with choices, but allows clearer errors)
    try:
        barcode_source = validate_barcode_source(args.barcode_source)
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    values = {}
    for key, label, _ in FIELDS:
        val = getattr(args, key, None)
        values[key] = (val or "").strip()

    if args.msg_name:
        msg_name = args.msg_name
    else:
        msg_name = f"PharmaLabel_{random.randint(1, 999):03d}"
        print("=" * 60)
        print("CREATE PRODUCT LABEL (QR + GTIN/MFG/EXP/BATCH/SN/TMDA)")
        print("=" * 60)
        for key, label, hint in FIELDS:
            if key in REQUIRED_KEYS and not values.get(key):
                if sys.stdin.isatty():
                    prompt = f"{label}" + (f" ({hint} digits)" if hint else "") + ": "
                    values[key] = input(prompt).strip()
                else:
                    print(f"Error: --{key} required when no message name given", file=sys.stderr)
                    sys.exit(1)

    # GS1 encoding
    qr_content = build_qr_string(
        values["gtin"], values.get("sn") or "0", values["exp"], values["batch"]
    )
    qr_prefix, qr_suffix = build_qr_parts(values["gtin"], values["exp"], values["batch"])
    field_contents = build_field_contents(values)

    if not qr_content and not any(values.values()):
        ap.print_help()
        print("\nExample:")
        print('  python create_product_label.py --gtin 08961101532710 --mfg 012026 --exp 012029 --batch 153A26 --sn 02750082604216564872')
        print('\n  # Use multi barcode sources (GS1 + date):')
        print('  python create_product_label.py --barcode-source multi --gtin 08961101532710 ...')
        print('\n  # Without SN-DATE field:')
        print('  python create_product_label.py --no-sn-date --gtin 08961101532710 ...')
        sys.exit(1)

    if not qr_content:
        qr_content = " ".join(field_contents.values())

    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.connect((PRINTER_IP, PRINTER_PORT))

    try:
        # 1. Text sources (one per field - GTIN, MFG, EXP, BATCH, SN)
        text_src_ids = {}
        for field_name, x, y, w, h in TEXT_FIELD_LAYOUT:
            r = send_command(s, {
                "request_type": "post", "path": "/data/source", "hash": int(time.time()),
                "type": "text", "name": field_name,
                "attribute": {"content": field_contents[field_name]}
            })
            if r.get("status") != "ok":
                print(f"Failed text source {field_name}:", r)
                sys.exit(1)
            text_src_ids[field_name] = r["id"]
            time.sleep(0.3)

        # 2. Barcode source(s) - single, multi, or dynamic (SN counter + SN-DATE in Data Matrix)
        if barcode_source == "single":
            r = send_command(s, {
                "request_type": "post", "path": "/data/source", "hash": int(time.time()),
                "type": "text", "name": f"{msg_name}_QRData",
                "attribute": {"content": qr_content}
            })
            if r.get("status") != "ok":
                print("Failed QR source:", r)
                sys.exit(1)
            barcode_source_list = [{"type": "text", "id": r["id"]}]
            time.sleep(0.3)
        elif barcode_source == "multi":
            # multi: create GS1 text source + date source; barcode concatenates both
            r = send_command(s, {
                "request_type": "post", "path": "/data/source", "hash": int(time.time()),
                "type": "text", "name": f"{msg_name}_QRData",
                "attribute": {"content": qr_content}
            })
            if r.get("status") != "ok":
                print("Failed QR text source:", r)
                sys.exit(1)
            qr_text_id = r["id"]
            time.sleep(0.3)

            r = send_command(s, {
                "request_type": "post", "path": "/data/source", "hash": int(time.time()),
                "type": "date", "name": f"{msg_name}_QRDate",
                "attribute": SN_DATE_SOURCE_ATTR
            })
            if r.get("status") != "ok":
                print("Failed QR date source:", r)
                sys.exit(1)
            qr_date_id = r["id"]
            barcode_source_list = [
                {"type": "text", "id": qr_text_id},
                {"type": "date", "id": qr_date_id},
            ]
            time.sleep(0.3)
        else:
            # dynamic: prefix + SN(user input) + suffix + date(SN-DATE) - SN-DATE changes on every print
            r = send_command(s, {
                "request_type": "post", "path": "/data/source", "hash": int(time.time()),
                "type": "text", "name": f"{msg_name}_QRPrefix",
                "attribute": {"content": qr_prefix}
            })
            if r.get("status") != "ok":
                print("Failed QR prefix source:", r)
                sys.exit(1)
            qr_prefix_id = r["id"]
            time.sleep(0.3)

            r = send_command(s, {
                "request_type": "post", "path": "/data/source", "hash": int(time.time()),
                "type": "text", "name": f"{msg_name}_SN",
                "attribute": {"content": values["sn"]}
            })
            if r.get("status") != "ok":
                print("Failed SN source:", r)
                sys.exit(1)
            sn_text_id = r["id"]
            time.sleep(0.3)

            r = send_command(s, {
                "request_type": "post", "path": "/data/source", "hash": int(time.time()),
                "type": "text", "name": f"{msg_name}_QRSuffix",
                "attribute": {"content": qr_suffix}
            })
            if r.get("status") != "ok":
                print("Failed QR suffix source:", r)
                sys.exit(1)
            qr_suffix_id = r["id"]
            time.sleep(0.3)

            r = send_command(s, {
                "request_type": "post", "path": "/data/source", "hash": int(time.time()),
                "type": "date", "name": f"{msg_name}_QRDate",
                "attribute": SN_DATE_SOURCE_ATTR
            })
            if r.get("status") != "ok":
                print("Failed QR date source:", r)
                sys.exit(1)
            qr_date_id = r["id"]
            barcode_source_list = [
                {"type": "text", "id": qr_prefix_id},
                {"type": "text", "id": sn_text_id},
                {"type": "text", "id": qr_suffix_id},
                {"type": "date", "id": qr_date_id},
            ]
            time.sleep(0.3)

        # 3. SN-DATE source (printer variable, injected at print time)
        sn_date_src_id = None
        if args.sn_date:
            if barcode_source in ("multi", "dynamic"):
                sn_date_src_id = qr_date_id  # reuse date from barcode
            else:
                r = send_command(s, {
                    "request_type": "post", "path": "/data/source", "hash": int(time.time()),
                    "type": "date", "name": "SN-DATE",
                    "attribute": SN_DATE_SOURCE_ATTR
                })
                if r.get("status") != "ok":
                    print("Failed SN-DATE source:", r)
                    sys.exit(1)
                sn_date_src_id = r["id"]
                time.sleep(0.3)

        # 4. Text objects (one per field, each on its own line)
        text_obj_ids = []
        for field_name, x, y, w, h in TEXT_FIELD_LAYOUT:
            style = {"x": x, "y": y, "w": w, "h": h, **TEXT_FIELD_STYLE}
            r = send_command(s, {
                "request_type": "post", "path": "/data/object", "hash": int(time.time()),
                "type": "text", "name": field_name,
                "style": style,
                "attribute": {}, "source_list": [{"type": "text", "id": text_src_ids[field_name]}]
            })
            if r.get("status") != "ok":
                print(f"Failed text object {field_name}:", r)
                sys.exit(1)
            text_obj_ids.append(r["id"])
            time.sleep(0.3)

        # 5. SN-DATE object (adjacent to SN - printer fills at print time)
        sn_date_obj_id = None
        if args.sn_date and sn_date_src_id is not None:
            dx, dy, dw, dh = SN_DATE_LAYOUT
            sn_date_style = {"x": dx, "y": dy, "w": dw, "h": dh, **TEXT_FIELD_STYLE}
            r = send_command(s, {
                "request_type": "post", "path": "/data/object", "hash": int(time.time()),
                "type": "text", "name": "SN-DATE",
                "style": sn_date_style,
                "attribute": {},
                "source_list": [{"type": "date", "id": sn_date_src_id}]
            })
            if r.get("status") != "ok":
                print("Failed SN-DATE object:", r)
                sys.exit(1)
            sn_date_obj_id = r["id"]
            time.sleep(0.3)

        # 6. Barcode object (left side, data_matrix) - source_list from selected barcode preset
        r = send_command(s, {
            "request_type": "post", "path": "/data/object", "hash": int(time.time()),
            "type": "barcode", "name": "Barcode",
            "style": BARCODE_STYLE,
            "attribute": {},
            "source_list": barcode_source_list
        })
        if r.get("status") != "ok":
            print("Failed barcode object:", r)
            sys.exit(1)
        qr_obj_id = r["id"]
        time.sleep(0.3)

        # 7. New message (order: text fields, barcode, sn-date)
        prefs = [{"ff_margin": 60, "fr_margin": 0, "bf_margin": 0, "br_margin": 0, "continuous_print": False}] * 4
        object_list = []
        for oid in text_obj_ids:
            object_list.append({"id": oid, "type": "text"})
        object_list.append({"id": qr_obj_id, "type": "barcode"})
        if sn_date_obj_id is not None:
            object_list.append({"id": sn_date_obj_id, "type": "text"})
        r = send_command(s, {
            "request_type": "post", "path": "/data/data", "hash": int(time.time()),
            "name": msg_name,
            "attribute": {"printdata_pref": {"print_prefs": prefs}},
            "object_list": object_list
        })
        if r.get("status") != "ok":
            print("Failed message:", r)
            sys.exit(1)

        print(f"\n[OK] Message '{msg_name}' created (id={r['id']})")
        if barcode_source == "dynamic":
            print(f"     Data Matrix: SN-DATE dynamic (change on every print), SN from user input")
        else:
            print(f"     Barcode source: {barcode_source}, QR: {qr_content[:50]}{'...' if len(qr_content) > 50 else ''}")
        if args.sn_date:
            print(f"     SN-DATE: enabled (printer variable at print time)")
    finally:
        s.close()


if __name__ == "__main__":
    main()
