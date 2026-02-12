#!/usr/bin/env python3
"""
Best way to create an Object on Sojet printer.

Object creation hierarchy (required order):
  1. Add Source  → content (text/image/date/counter/schedule)
  2. Add Object  → positions the source on layout, references source_list
  3. New Message → groups objects, references object_list

This script demonstrates the correct flow: Source → Object (and optionally Message).
"""

import sys
from sojet_client import SojetClient

DEFAULT_IP = "172.16.0.55"
DEFAULT_PORT = 9944

# Default text object style (from protocol)
DEFAULT_TEXT_STYLE = {
    "x": 0, "y": 23, "w": 777, "h": 110,
    "pivot_x": 0, "pivot_y": 0, "rotate": 0.0,
    "scale_x": 1.0, "scale_y": 1.0,
    "paint_style": "fill", "line_cap": "butt", "line_join": "miter",
    "line_width": 0, "miter_limit": 4,
    "font_style": "ttf-default-r*nnn*-378-378-UTF-8",
    "visiblity": "visible"
}


def create_text_object(client: SojetClient, content: str, name: str = "text", **style_overrides):
    """
    Best way to create a text object:
    1. Add text source with content
    2. Add object referencing that source
    Returns (source_id, object_id) or (None, None) on failure.
    """
    # Step 1: Add source
    r = client.add_source_raw("text", name, {"content": content})
    if not r or r.get("status") != "ok":
        print("Failed to add source:", r)
        return None, None
    source_id = r.get("id")
    print(f"  Source created: id={source_id}")

    # Step 2: Add object with source_list
    style = {**DEFAULT_TEXT_STYLE, **style_overrides}
    source_list = [{"type": "text", "id": source_id}]
    r = client.add_object("text", name, style, source_list)
    if not r or r.get("status") != "ok":
        print("Failed to add object:", r)
        return source_id, None
    object_id = r.get("id")
    print(f"  Object created: id={object_id}")
    return source_id, object_id


def create_image_object(client: SojetClient, image_name: str, name: str = "image", x: int = 0, y: int = 0, w: int = 400, h: int = 150):
    """
    Best way to create an image object:
    1. Image must be uploaded first via /engine/download_image
    2. Add image source referencing the uploaded image name
    3. Add object referencing that source
    """
    # Add image source (content = image name used in download_image)
    r = client.add_source_raw("image", name, {"content": image_name})
    if not r or r.get("status") != "ok":
        return None, None
    source_id = r.get("id")
    style = {**DEFAULT_TEXT_STYLE, "x": x, "y": y, "w": w, "h": h}
    source_list = [{"type": "image", "id": source_id}]
    r = client.add_object("image", name, style, source_list)
    if not r or r.get("status") != "ok":
        return source_id, None
    return source_id, r.get("id")


def main():
    if len(sys.argv) < 2:
        print("Usage: python create_object.py <content> [--create-message <message_name>]")
        print("Example: python create_object.py 'Hello World' --create-message MyMsg")
        sys.exit(1)

    content = sys.argv[1]
    create_msg = "--create-message" in sys.argv
    msg_name = None
    if create_msg:
        idx = sys.argv.index("--create-message")
        if idx + 1 < len(sys.argv):
            msg_name = sys.argv[idx + 1]

    print(f"Creating text object with content: '{content}'")
    client = SojetClient(DEFAULT_IP, DEFAULT_PORT)
    if not client.connect():
        sys.exit(1)

    try:
        sid, oid = create_text_object(client, content)
        if oid is None:
            sys.exit(1)

        if create_msg and msg_name:
            r = client.new_message(msg_name, [{"id": oid, "type": "text"}])
            if r and r.get("status") == "ok":
                print(f"  Message created: id={r.get('id')}, name='{msg_name}'")
            else:
                print("  Failed to create message:", r)

    finally:
        client.disconnect()


if __name__ == "__main__":
    main()
