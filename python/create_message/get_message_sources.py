#!/usr/bin/env python3
"""
Get a message and all its sources from the printer.
Usage: python get_message_sources.py [message_id]
       python get_message_sources.py 1
       python get_message_sources.py   (lists messages, prompts for id)
"""

import sys
import json
from sojet_client import SojetClient

PRINTER_IP = "172.16.0.55"
PRINTER_PORT = 9944


def main():
    client = SojetClient(PRINTER_IP, PRINTER_PORT)
    if not client.connect():
        print("Failed to connect")
        sys.exit(1)

    try:
        if len(sys.argv) >= 2:
            message_id = int(sys.argv[1])
        else:
            r = client.get_message_list(0, 20)
            if not r or not r.get("data_list"):
                print("No messages found")
                return
            print("Messages:")
            for m in r["data_list"]:
                print(f"  ID {m.get('id')}: {m.get('name')}")
            message_id = int(input("Enter message ID: "))

        result = client.get_message_with_sources(message_id)
        if not result:
            print("Message not found or error")
            sys.exit(1)

        msg = result["message"]
        print("\n" + "=" * 60)
        print(f"MESSAGE: {msg.get('name')} (id={msg.get('id')})")
        print("=" * 60)

        for i, obj in enumerate(result["objects"]):
            print(f"\nObject {i+1}: {obj.get('name')} (id={obj.get('id')}, type={obj.get('type')})")
            for src_ref in obj.get("source_list", []):
                sid, styp = src_ref.get("id"), src_ref.get("type")
                src = next((s for s in result["sources"] if s.get("id") == sid and s.get("type") == styp), None)
                if src and "error" not in src:
                    content = src.get("attribute", {}).get("content", src.get("attribute", {}).get("path", "—"))
                    print(f"  Source id={sid} type={styp}: content={content}")
                else:
                    print(f"  Source id={sid} type={styp}: (not found)")

        print("\n" + "=" * 60)
        print("Full JSON:")
        print(json.dumps(result, indent=2))

    finally:
        client.disconnect()


if __name__ == "__main__":
    main()
