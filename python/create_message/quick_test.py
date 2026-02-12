#!/usr/bin/env python3
"""
Quick test script for Sojet Printer Message Manager
Uses IP: 172.16.0.55, Port: 9944
"""

from message_manager import SojetPrinterClient, print_message_list

# Printer configuration
PRINTER_IP = "172.16.0.55"
PRINTER_PORT = 9944

def main():
    """Quick test of message operations"""
    print("=" * 80)
    print("Sojet Printer Message Manager - Quick Test")
    print(f"Printer: {PRINTER_IP}:{PRINTER_PORT}")
    print("=" * 80)
    
    # Create client and connect
    client = SojetPrinterClient(PRINTER_IP, port=PRINTER_PORT)
    
    try:
        if not client.connect():
            print(f"\n❌ Failed to connect to {PRINTER_IP}:{PRINTER_PORT}")
            print("Please check:")
            print("  1. Printer is powered on")
            print("  2. Network connection is active")
            print("  3. IP address is correct")
            return
        
        print(f"\n✅ Connected to printer at {PRINTER_IP}:{PRINTER_PORT}\n")
        
        # Test 1: Get message list
        print("📋 Getting message list...")
        messages = client.get_message_list(offset=0, num=10)
        
        if messages is not None:
            if messages:
                print_message_list(messages)
                print(f"\n✅ Found {len(messages)} message(s)")
                
                # Show available operations
                print("\n" + "=" * 80)
                print("Available operations:")
                print("=" * 80)
                print("\nTo delete a message:")
                print(f"  python message_manager.py delete <message_id>")
                print("\nTo modify a message:")
                print(f"  python message_manager.py modify <message_id> <new_name>")
                print("\nOr use the Python API:")
                print("  from message_manager import SojetPrinterClient")
                print(f"  client = SojetPrinterClient('{PRINTER_IP}', port={PRINTER_PORT})")
                print("  client.connect()")
                print("  client.get_message_list()")
                print("  client.delete_message(1)")
                print("  client.disconnect()")
            else:
                print("ℹ️  No messages found on the printer")
        else:
            print("❌ Failed to retrieve message list")
    
    except Exception as e:
        print(f"\n❌ Error: {e}")
    
    finally:
        client.disconnect()
        print("\n" + "=" * 80)
        print("Connection closed")

if __name__ == "__main__":
    main()
