import socket
import json
import time

printer_ip = "172.16.0.55"
port = 9944

# Get message details from user
print("=" * 60)
print("CREATE NEW PRINTER MESSAGE")
print("=" * 60)
message_name = input("Enter message name: ").strip()
if not message_name:
    print("[ERROR] Message name cannot be empty!")
    exit(1)

message_content = input("Enter message content: ").strip()
if not message_content:
    print("[ERROR] Message content cannot be empty!")
    exit(1)

print(f"\n[INFO] Message name: {message_name}")
print(f"[INFO] Message content: {message_content}")
print("=" * 60)

print("\n[INFO] Creating socket...")
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
print(f"[INFO] Connecting to {printer_ip}:{port} ...")
s.connect((printer_ip, port))
print("[INFO] Connected.")

def send_command(socket_obj, command_dict):
    """Send a command and wait for response"""
    cmd_str = json.dumps(command_dict) + '\r\n'
    print(f"[INFO] Sending: {cmd_str.strip()}")
    socket_obj.sendall(cmd_str.encode('utf-8'))
    
    try:
        socket_obj.settimeout(5)
        response = socket_obj.recv(4096)
        response_str = response.decode(errors='ignore')
        print(f"[INFO] Response: {response_str}")
        return json.loads(response_str.strip())
    except socket.timeout:
        print("[WARN] No response received.")
        return None
    except json.JSONDecodeError as e:
        print(f"[ERROR] Failed to parse response: {e}")
        return None
    finally:
        socket_obj.settimeout(None)

try:
    # Step 1: Create a text source with message content
    print("\n[STEP 1] Creating text source...")
    source_cmd = {
        "request_type": "post",
        "path": "/data/source",
        "hash": int(time.time()),
        "type": "text",
        "name": f"{message_name}_Source",
        "attribute": {
            "content": message_content
        }
    }
    source_response = send_command(s, source_cmd)
    
    if not source_response or source_response.get("status") != "ok":
        print("[ERROR] Failed to create source!")
        exit(1)
    
    source_id = source_response.get("id")
    print(f"[SUCCESS] Source created with ID: {source_id}")
    time.sleep(1)
    
    # Step 2: Create a text object
    print("\n[STEP 2] Creating text object...")
    object_cmd = {
        "request_type": "post",
        "path": "/data/object",
        "hash": int(time.time()),
        "type": "text",
        "name": f"{message_name}_Object",
        "style": {
            "x": 0,
            "y": 23,
            "w": 777,
            "h": 110,
            "pivot_x": 0,
            "pivot_y": 0,
            "rotate": 0.0,
            "scale_x": 1.0,
            "scale_y": 1.0,
            "paint_style": "fill",
            "line_cap": "butt",
            "line_join": "miter",
            "line_width": 0,
            "miter_limit": 4,
            "font_style": "ttf-default-r*nnn*-378-378-UTF-8",
            "visiblity": "visible"
        },
        "attribute": {},
        "source_list": [
            {
                "type": "text",
                "id": source_id
            }
        ]
    }
    object_response = send_command(s, object_cmd)
    
    if not object_response or object_response.get("status") != "ok":
        print("[ERROR] Failed to create object!")
        exit(1)
    
    object_id = object_response.get("id")
    print(f"[SUCCESS] Object created with ID: {object_id}")
    time.sleep(1)
    
    # Step 3: Create a message
    print("\n[STEP 3] Creating message...")
    message_cmd = {
        "request_type": "post",
        "path": "/data/data",
        "hash": int(time.time()),
        "name": message_name,
        "attribute": {
            "printdata_pref": {
                "print_prefs": [
                    {
                        "ff_margin": 60.0,
                        "fr_margin": 0.0,
                        "bf_margin": 0.0,
                        "br_margin": 0.0
                    },
                    {
                        "ff_margin": 0.0,
                        "fr_margin": 0.0,
                        "bf_margin": 0.0,
                        "br_margin": 0.0
                    },
                    {
                        "ff_margin": 0.0,
                        "fr_margin": 0.0,
                        "bf_margin": 0.0,
                        "br_margin": 0.0
                    },
                    {
                        "ff_margin": 0.0,
                        "fr_margin": 0.0,
                        "bf_margin": 0.0,
                        "br_margin": 0.0
                    }
                ]
            }
        },
        "object_list": [
            {
                "id": object_id,
                "type": "text"
            }
        ]
    }
    message_response = send_command(s, message_cmd)
    
    if not message_response or message_response.get("status") != "ok":
        print("[ERROR] Failed to create message!")
        exit(1)
    
    message_id = message_response.get("id")
    print(f"[SUCCESS] Message created with ID: {message_id}")
    print(f"[SUCCESS] Message name: '{message_name}'")
    
    # Step 4: Start printing the new message
    print("\n[STEP 4] Starting print with new message...")
    print_cmd = {
        "request_type": "post",
        "path": "/engine/printjob",
        "hash": int(time.time()),
        "attribute": {
            "print_data_name": message_name
        }
    }
    print_response = send_command(s, print_cmd)
    
    if print_response and print_response.get("status") == "ok":
        print("[SUCCESS] Print job started!")
    else:
        print("[INFO] Check printer status - it may already be printing or require manual start")
    
    print("\n[COMPLETED] Message has been created and is ready to print!")
    print(f"[INFO] Message name: '{message_name}'")
    print(f"[INFO] Content: {message_content}")

except Exception as e:
    print(f"[ERROR] An error occurred: {e}")
finally:
    print("\n[INFO] Closing socket.")
    s.close()
