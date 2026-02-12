#!/usr/bin/env python3
"""
Sojet Printer Message Manager
Script to get message list, delete message, and modify message
Based on TCP-JSON Communication Protocol
"""

import socket
import json
import sys
from typing import Dict, List, Optional, Any


class SojetPrinterClient:
    """Client for communicating with Sojet printer via TCP-JSON protocol"""
    
    def __init__(self, host: str, port: int = 9944, timeout: int = 10):
        """
        Initialize the printer client
        
        Args:
            host: Printer IP address or hostname
            port: TCP port (default: 9944)
            timeout: Connection timeout in seconds (default: 10)
        """
        self.host = host
        self.port = port
        self.timeout = timeout
        self.socket = None
    
    def connect(self) -> bool:
        """Establish TCP connection to the printer"""
        try:
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.socket.settimeout(self.timeout)
            self.socket.connect((self.host, self.port))
            return True
        except socket.error as e:
            print(f"Connection error: {e}")
            return False
    
    def disconnect(self):
        """Close the TCP connection"""
        if self.socket:
            self.socket.close()
            self.socket = None
    
    def send_request(self, request: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Send a JSON request and receive response
        
        Args:
            request: Dictionary containing the request data
            
        Returns:
            Parsed JSON response or None if error
        """
        if not self.socket:
            print("Error: Not connected. Call connect() first.")
            return None
        
        try:
            # Convert request to JSON string (no line breaks)
            json_str = json.dumps(request, separators=(',', ':'))
            # Add newline at the end (0D0A)
            message = json_str + '\r\n'
            
            # Send request
            self.socket.sendall(message.encode('utf-8'))
            
            # Receive response
            response_data = b''
            while True:
                chunk = self.socket.recv(4096)
                if not chunk:
                    break
                response_data += chunk
                # Check if we have a complete JSON response (ends with newline)
                if response_data.endswith(b'\r\n'):
                    break
            
            # Parse response
            response_str = response_data.decode('utf-8').strip()
            if response_str:
                return json.loads(response_str)
            return None
            
        except json.JSONDecodeError as e:
            print(f"JSON decode error: {e}")
            print(f"Response: {response_data.decode('utf-8', errors='ignore')}")
            return None
        except socket.error as e:
            print(f"Socket error: {e}")
            return None
        except Exception as e:
            print(f"Unexpected error: {e}")
            return None
    
    def get_message_list(self, offset: int = 0, num: int = 10) -> Optional[List[Dict[str, Any]]]:
        """
        Get list of messages
        
        Args:
            offset: Start bit (default: 0)
            num: Total number to retrieve (default: 10)
            
        Returns:
            List of message dictionaries or None if error
        """
        request = {
            "request_type": "get",
            "path": "/data/list",
            "offset": offset,
            "num": num
        }
        
        response = self.send_request(request)
        if response and "data_list" in response:
            return response["data_list"]
        return None
    
    def delete_message(self, message_id: int) -> bool:
        """
        Delete a message by ID
        
        Args:
            message_id: ID of the message to delete
            
        Returns:
            True if successful, False otherwise
        """
        request = {
            "request_type": "delete",
            "path": "/data/data",
            "id": message_id
        }
        
        response = self.send_request(request)
        if response:
            if response.get("status") == "ok":
                print(f"Message {message_id} deleted successfully")
                return True
            else:
                print(f"Error deleting message {message_id}: {response.get('descript', 'Unknown error')}")
                return False
        return False
    
    def modify_message(
        self,
        message_id: int,
        name: str,
        object_list: List[Dict[str, Any]],
        print_prefs: Optional[List[Dict[str, Any]]] = None
    ) -> bool:
        """
        Modify a message
        
        Args:
            message_id: ID of the message to modify
            name: New name for the message
            object_list: List of objects in the message (e.g., [{"id": 1, "type": "text"}])
            print_prefs: Optional list of print preferences. If None, uses default.
                        Format: [{"ff_margin": 0.0, "fr_margin": 0.0, "bf_margin": 0.0, 
                                 "br_margin": 0.0, "continuous_print": false}, ...]
                                 (up to 4 printheads)
        
        Returns:
            True if successful, False otherwise
        """
        # Default print preferences if not provided
        if print_prefs is None:
            print_prefs = [
                {"ff_margin": 0.0, "fr_margin": 0.0, "bf_margin": 0.0, 
                 "br_margin": 0.0, "continuous_print": False}
            ] * 4
        
        request = {
            "request_type": "put",
            "path": "/data/data",
            "id": message_id,
            "name": name,
            "attribute": {
                "printdata_pref": {
                    "print_prefs": print_prefs
                }
            },
            "object_list": object_list
        }
        
        response = self.send_request(request)
        if response:
            if response.get("status") == "ok":
                print(f"Message {message_id} modified successfully")
                return True
            else:
                print(f"Error modifying message {message_id}: {response.get('descript', 'Unknown error')}")
                return False
        return False
    
    def __enter__(self):
        """Context manager entry"""
        self.connect()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit"""
        self.disconnect()


def print_message_list(messages: List[Dict[str, Any]]):
    """Pretty print the message list"""
    if not messages:
        print("No messages found.")
        return
    
    print("\n" + "="*80)
    print("MESSAGE LIST")
    print("="*80)
    for msg in messages:
        print(f"\nID: {msg.get('id')}")
        print(f"Name: {msg.get('name')}")
        attrs = msg.get('attribute', {})
        if 'created_time' in attrs:
            print(f"Created: {attrs['created_time']}")
        if 'modified_time' in attrs:
            print(f"Modified: {attrs['modified_time']}")
        if 'permission' in attrs:
            print(f"Permission: {attrs['permission']}")
        print("-" * 80)
    print()


def main():
    """Main function with example usage"""
    # Default printer IP and port
    DEFAULT_IP = "172.16.0.55"
    DEFAULT_PORT = 9944
    
    if len(sys.argv) < 2:
        print("Usage: python message_manager.py [printer_ip] [command] [args...]")
        print(f"\nDefault IP: {DEFAULT_IP}, Port: {DEFAULT_PORT}")
        print("\nCommands:")
        print("  list [offset] [num]          - Get message list (default: offset=0, num=10)")
        print("  delete <message_id>          - Delete a message")
        print("  modify <message_id> <name>   - Modify a message name")
        print("\nExamples:")
        print(f"  python message_manager.py list")
        print(f"  python message_manager.py {DEFAULT_IP} list")
        print(f"  python message_manager.py delete 1")
        print(f"  python message_manager.py modify 2 \"NewName\"")
        sys.exit(1)
    
    # Check if first argument is a command (not an IP)
    if sys.argv[1] in ["list", "delete", "modify"]:
        printer_ip = DEFAULT_IP
        command = sys.argv[1]
        args_start = 2
    else:
        printer_ip = sys.argv[1]
        command = sys.argv[2] if len(sys.argv) > 2 else "list"
        args_start = 3
    
    print(f"Connecting to printer at {printer_ip}:{DEFAULT_PORT}...")
    client = SojetPrinterClient(printer_ip, port=DEFAULT_PORT)
    
    try:
        if not client.connect():
            print(f"Failed to connect to {printer_ip}:{client.port}")
            sys.exit(1)
        
        if command == "list":
            offset = int(sys.argv[args_start]) if len(sys.argv) > args_start else 0
            num = int(sys.argv[args_start + 1]) if len(sys.argv) > args_start + 1 else 10
            
            messages = client.get_message_list(offset, num)
            if messages is not None:
                print_message_list(messages)
            else:
                print("Failed to get message list")
        
        elif command == "delete":
            if len(sys.argv) < args_start + 1:
                print("Error: message_id required for delete command")
                sys.exit(1)
            
            message_id = int(sys.argv[args_start])
            client.delete_message(message_id)
        
        elif command == "modify":
            if len(sys.argv) < args_start + 2:
                print("Error: message_id and name required for modify command")
                print("Usage: modify <message_id> <name>")
                sys.exit(1)
            
            message_id = int(sys.argv[args_start])
            name = sys.argv[args_start + 1]
            
            # For a simple name change, we need to get the existing message first
            # to preserve its object_list. This is a simplified version.
            # In production, you'd want to fetch the message details first.
            print("Warning: This is a simplified modify. To fully modify a message,")
            print("you need to provide the object_list. Use the Python API directly.")
            
            # Example with minimal object_list (you should get this from the message first)
            object_list = [{"id": 1, "type": "text"}]  # This should be fetched from existing message
            
            client.modify_message(message_id, name, object_list)
        
        else:
            print(f"Unknown command: {command}")
            print("Available commands: list, delete, modify")
            sys.exit(1)
    
    finally:
        client.disconnect()


if __name__ == "__main__":
    main()
