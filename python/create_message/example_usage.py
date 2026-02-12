#!/usr/bin/env python3
"""
Example usage of the Sojet Printer Message Manager
Demonstrates how to get message list, delete messages, and modify messages
"""

from message_manager import SojetPrinterClient, print_message_list


def example_get_message_list(client: SojetPrinterClient):
    """Example: Get message list"""
    print("\n=== Example: Get Message List ===")
    
    # Get first 10 messages
    messages = client.get_message_list(offset=0, num=10)
    
    if messages:
        print_message_list(messages)
        return messages
    else:
        print("Failed to retrieve message list or no messages found")
        return []


def example_delete_message(client: SojetPrinterClient, message_id: int):
    """Example: Delete a message"""
    print(f"\n=== Example: Delete Message {message_id} ===")
    
    success = client.delete_message(message_id)
    if success:
        print("Message deleted successfully")
    else:
        print("Failed to delete message")
    
    return success


def example_modify_message(client: SojetPrinterClient, message_id: int, new_name: str):
    """Example: Modify a message"""
    print(f"\n=== Example: Modify Message {message_id} ===")
    
    # First, get the message details to preserve its structure
    # For this example, we'll use a simple object_list
    # In production, you should fetch the full message details first
    
    # Example object_list (you should get this from the actual message)
    object_list = [
        {"id": 1, "type": "text"}
    ]
    
    # Example print preferences for 4 printheads
    print_prefs = [
        {"ff_margin": 60.0, "fr_margin": 0.0, "bf_margin": 0.0, 
         "br_margin": 0.0, "continuous_print": False},
        {"ff_margin": 0.0, "fr_margin": 0.0, "bf_margin": 0.0, 
         "br_margin": 0.0, "continuous_print": False},
        {"ff_margin": 0.0, "fr_margin": 0.0, "bf_margin": 0.0, 
         "br_margin": 0.0, "continuous_print": False},
        {"ff_margin": 0.0, "fr_margin": 0.0, "bf_margin": 0.0, 
         "br_margin": 0.0, "continuous_print": False}
    ]
    
    success = client.modify_message(
        message_id=message_id,
        name=new_name,
        object_list=object_list,
        print_prefs=print_prefs
    )
    
    if success:
        print("Message modified successfully")
    else:
        print("Failed to modify message")
    
    return success


def main():
    """Main example function"""
    # Printer IP address and port
    PRINTER_IP = "172.16.0.55"
    PRINTER_PORT = 9944
    
    print("Sojet Printer Message Manager - Example Usage")
    print("=" * 80)
    print(f"Connecting to printer at {PRINTER_IP}:{PRINTER_PORT}...")
    
    # Use context manager for automatic connection handling
    with SojetPrinterClient(PRINTER_IP, port=PRINTER_PORT) as client:
        if not client.socket:
            print(f"Failed to connect to printer at {PRINTER_IP}")
            return
        
        # Example 1: Get message list
        messages = example_get_message_list(client)
        
        if messages:
            # Example 2: Modify the first message (if any)
            first_message_id = messages[0].get('id')
            if first_message_id:
                example_modify_message(
                    client, 
                    first_message_id, 
                    f"{messages[0].get('name', 'Message')}_modified"
                )
            
            # Example 3: Delete a message (commented out for safety)
            # Uncomment the line below to actually delete a message
            # example_delete_message(client, first_message_id)
        
        print("\n" + "=" * 80)
        print("Examples completed!")


if __name__ == "__main__":
    main()
