#!/usr/bin/env python3
"""
Test script to discover which source types/formats the printer accepts.
Run: python test_barcode_source.py
"""

import socket
import json
import time
import base64
import io

try:
    import qrcode
    from PIL import Image
except ImportError:
    print("Install: pip install qrcode pillow")
    exit(1)

PRINTER_IP = "172.16.0.55"
PRINTER_PORT = 9944

def send(s, cmd):
    s.sendall((json.dumps(cmd, separators=(',', ':')) + '\r\n').encode())
    try:
        s.settimeout(5)
        r = s.recv(65536).decode().strip()
        return json.loads(r)
    finally:
        s.settimeout(None)

def main():
    qr_content = "https://example.com/123"
    # Generate small QR as BMP
    qr = qrcode.QRCode(box_size=4, border=2)
    qr.add_data(qr_content)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white").convert("1")
    buf = io.BytesIO()
    img.save(buf, format='BMP')
    bmp = buf.getvalue()
    b64 = base64.b64encode(bmp).decode()
    img_name = f"qr_{int(time.time()) % 10000}"

    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.connect((PRINTER_IP, PRINTER_PORT))

    # Start engine (for download_image)
    r = send(s, {"request_type": "get", "path": "/data/list", "offset": 0, "num": 1})
    start_name = r.get("data_list", [{}])[0].get("name", "") if r and r.get("data_list") else ""
    send(s, {"request_type": "post", "path": "/engine/printjob", "hash": int(time.time()), "attribute": {"print_data_name": start_name}})
    time.sleep(0.5)

    # Upload image
    print("Uploading image...")
    r = send(s, {"request_type": "post", "path": "/engine/download_image", "parm": 1, "size": len(bmp), "name": img_name, "content": b64})
    print(f"  Upload: {r}")
    if r.get("status") in ("error", "Error"):
        print("Upload failed, exiting")
        s.close()
        return
    time.sleep(1)

    # Try different source configs
    configs = [
        ("image", {"content": img_name}, "image + content=name"),
        ("image", {}, "image + empty attr"),
        ("image", {"filename": img_name}, "image + filename"),
        ("image", {"path": img_name}, "image + path"),
        ("image", {"content": img_name, "format": "bmp"}, "image + format bmp"),
    ]

    for stype, attr, desc in configs:
        print(f"\nTrying: {desc}")
        r = send(s, {
            "request_type": "post", "path": "/data/source", "hash": int(time.time()),
            "type": stype, "name": f"test_{stype}", "attribute": attr
        })
        print(f"  Response: {r}")
        if r and r.get("status") == "ok":
            print(f"  SUCCESS with {desc}")
            break
        time.sleep(0.3)

    s.close()
    print("\nDone")

if __name__ == "__main__":
    main()
