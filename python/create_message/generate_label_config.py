#!/usr/bin/env python3
"""
Generate label config JSON from user input.
QR pattern: 01{GTIN}21{SerialNumber}17{YYMMDD}10{Batch}
Expiry: MMYYYY -> YYMMDD (Year=last2, Month=first2, Day=01)
"""

import json
import argparse
import sys


def expiry_mmyyyy_to_yymmdd(mmyyyy: str) -> str:
    """Convert Expiry from MMYYYY to YYMMDD. Example: 012029 -> 290100"""
    if not mmyyyy or len(mmyyyy) < 6:
        return "000000"
    mm = mmyyyy[:2]
    yy = mmyyyy[-2:]
    return f"{yy}{mm}00"


def build_qr_string(gtin: str, serial_number: str, expiry_mmyyyy: str, batch: str) -> str:
    """Build QR string: 01{GTIN}21{SerialNumber}17{YYMMDD}10{Batch}"""
    yymmdd = expiry_mmyyyy_to_yymmdd(expiry_mmyyyy)
    return f"01{gtin}21{serial_number}17{yymmdd}10{batch}"


def mmyyyy_to_display(mmyyyy: str) -> str:
    """Convert MMYYYY to display format 'MM YYYY'. Example: 012029 -> 01 2029"""
    if not mmyyyy or len(mmyyyy) < 6:
        return ""
    return f"{mmyyyy[:2]} {mmyyyy[2:6]}"


def generate_label_config(
    gtin: str,
    serial_number: str,
    expiry: str,
    batch: str,
    mfg: str,
    tmda_reg: str = "",
    template_path: str = "label-config-example.json",
) -> dict:
    """Generate label config JSON with dynamic values from user input."""

    with open(template_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    qr_content = build_qr_string(gtin, serial_number, expiry, batch)
    mfg_display = mmyyyy_to_display(mfg)
    exp_display = mmyyyy_to_display(expiry)

    replacements = {
        281: qr_content,           # PharmaLabel_QRData
        282: f"GTIN :{gtin}",      # GTIN
        283: f"MFG: {mfg_display}",  # MFG
        284: f"EXP: {exp_display}",   # EXP
        285: f"BATCH: {batch}",    # BATCH
        286: f"SN: {serial_number}", # SN
    }

    def replace_content_in_source(src: dict) -> None:
        if src.get("type") == "text" and "attribute" in src and "content" in src["attribute"]:
            sid = src.get("id")
            if sid in replacements:
                src["attribute"]["content"] = replacements[sid]

    for src in data.get("message", {}).get("source_list", []):
        replace_content_in_source(src)

    for src in data.get("sources", []):
        replace_content_in_source(src)

    return data


def main():
    ap = argparse.ArgumentParser(description="Generate label config JSON from user input")
    ap.add_argument("--gtin", required=True, help="GTIN (14 digits)")
    ap.add_argument("--serial", "--sn", dest="serial", required=True, help="Serial number")
    ap.add_argument("--expiry", required=True, help="Expiry (MMYYYY)")
    ap.add_argument("--batch", required=True, help="Batch number")
    ap.add_argument("--mfg", required=True, help="MFG (MMYYYY)")
    ap.add_argument("--tmda-reg", default="", help="TMDAREG (optional)")
    ap.add_argument("-t", "--template", default="label-config-example.json", help="Template JSON path")
    ap.add_argument("-o", "--output", help="Output file (default: stdout)")
    args = ap.parse_args()

    config = generate_label_config(
        gtin=args.gtin,
        serial_number=args.serial,
        expiry=args.expiry,
        batch=args.batch,
        mfg=args.mfg,
        tmda_reg=args.tmda_reg,
        template_path=args.template,
    )

    output = json.dumps(config, separators=(",", ":"), ensure_ascii=False)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(output)
        print(f"Written to {args.output}", file=sys.stderr)
        print(f"QR: {build_qr_string(args.gtin, args.serial, args.expiry, args.batch)}", file=sys.stderr)
    else:
        print(output)


if __name__ == "__main__":
    main()
