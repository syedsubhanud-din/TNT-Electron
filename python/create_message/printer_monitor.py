import socket
import json
import time
from datetime import datetime

printer_ip = "172.16.0.55"
port = 9944

def send_command(socket_obj, command_dict):
    """Send a command and wait for response"""
    cmd_str = json.dumps(command_dict) + '\r\n'
    socket_obj.sendall(cmd_str.encode('utf-8'))
    
    try:
        socket_obj.settimeout(5)
        response = socket_obj.recv(4096)
        response_str = response.decode(errors='ignore').strip()
        return json.loads(response_str)
    except socket.timeout:
        return {"error": "timeout"}
    except json.JSONDecodeError:
        return {"error": "invalid_json"}
    finally:
        socket_obj.settimeout(None)

def format_realtime_info(data):
    """Format realtime info for display"""
    if data.get("error"):
        return f"[ERROR] {data['error']}"
    
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    output = [f"\n{'='*70}"]
    output.append(f"[{timestamp}] PRINTER REAL-TIME STATUS")
    output.append('='*70)
    
    status = data.get("status", "unknown")
    state = data.get("state", "unknown")
    output.append(f"Status: {status.upper()}")
    output.append(f"State: {state.upper()}")
    
    if state == "started" or state == "running":
        data_name = data.get("data_name", "N/A")
        data_id = data.get("data_id", "N/A")
        output.append(f"Message: {data_name} (ID: {data_id})")
        
        output_count = data.get("output", 0)
        ink_used = data.get("ink_used", 0)
        output.append(f"Output Count: {output_count}")
        output.append(f"Ink Used: {ink_used}")
        
        start_time = data.get("start_time")
        if start_time:
            start_dt = datetime.fromtimestamp(start_time)
            output.append(f"Started: {start_dt.strftime('%Y-%m-%d %H:%M:%S')}")
        
        reprint = data.get("reprint", False)
        output.append(f"Reprint Mode: {'ON' if reprint else 'OFF'}")
        
        trans_ready = data.get("trans_ready")
        if trans_ready is not None:
            output.append(f"Transmission Ready: {'YES' if trans_ready else 'NO'}")
        
        # Source information
        source_info = data.get("source_info", [])
        if source_info:
            output.append("\nActive Sources:")
            for src in source_info:
                src_type = src.get("type", "unknown")
                src_name = src.get("name", "N/A")
                src_content = src.get("content", "N/A")
                src_id = src.get("id", "N/A")
                output.append(f"  - [{src_type}] {src_name} (ID: {src_id}): {src_content}")
                
                if "current" in src:
                    output.append(f"    Current: {src['current']}, Copies Index: {src.get('copies_index', 'N/A')}")
                if "alarm_status" in src:
                    alarm = "⚠ ALARM" if src["alarm_status"] else "✓ OK"
                    output.append(f"    Status: {alarm}")
    
    output.append('='*70)
    return '\n'.join(output)

def log_to_file(data):
    """Log data to file"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_entry = {
        "timestamp": timestamp,
        "data": data
    }
    
    with open("printer_log.json", "a", encoding="utf-8") as f:
        f.write(json.dumps(log_entry) + "\n")

def print_menu():
    print("\n" + "="*70)
    print("PRINTER MONITOR & LOGGER")
    print("="*70)
    print("1. Get real-time info (once)")
    print("2. Start continuous monitoring (every 2 seconds)")
    print("3. Get real-time info and log to file")
    print("4. View recent logs")
    print("q. Quit")
    print("="*70)

print(f"[INFO] Connecting to printer at {printer_ip}:{port}...")
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

try:
    s.connect((printer_ip, port))
    print("[SUCCESS] Connected to printer!")
    
    monitoring = False
    
    while True:
        if not monitoring:
            print_menu()
            choice = input("Enter choice: ").strip()
            
            if choice == 'q':
                break
            elif choice == '1':
                # Get real-time info once
                cmd = {"request_type": "get", "path": "/engine/real"}
                response = send_command(s, cmd)
                print(format_realtime_info(response))
                
            elif choice == '2':
                # Start continuous monitoring
                print("\n[INFO] Starting continuous monitoring...")
                print("[INFO] Press Ctrl+C to stop monitoring")
                monitoring = True
                try:
                    while monitoring:
                        cmd = {"request_type": "get", "path": "/engine/real"}
                        response = send_command(s, cmd)
                        print(format_realtime_info(response))
                        time.sleep(2)
                except KeyboardInterrupt:
                    print("\n[INFO] Monitoring stopped")
                    monitoring = False
                    
            elif choice == '3':
                # Get info and log to file
                cmd = {"request_type": "get", "path": "/engine/real"}
                response = send_command(s, cmd)
                print(format_realtime_info(response))
                log_to_file(response)
                print(f"[INFO] Logged to printer_log.json")
                
            elif choice == '4':
                # View recent logs
                try:
                    with open("printer_log.json", "r", encoding="utf-8") as f:
                        lines = f.readlines()
                        print(f"\n[INFO] Showing last 5 log entries:")
                        for line in lines[-5:]:
                            log_entry = json.loads(line)
                            print(f"\n[{log_entry['timestamp']}]")
                            print(json.dumps(log_entry['data'], indent=2))
                except FileNotFoundError:
                    print("[INFO] No log file found yet")
                except Exception as e:
                    print(f"[ERROR] Failed to read logs: {e}")
            else:
                print("[WARN] Invalid choice")
        
        time.sleep(0.5)

except ConnectionRefusedError:
    print(f"[ERROR] Could not connect to printer at {printer_ip}:{port}")
except KeyboardInterrupt:
    print("\n[INFO] Interrupted by user")
except Exception as e:
    print(f"[ERROR] An error occurred: {e}")
finally:
    print("[INFO] Closing connection...")
    s.close()
    print("[INFO] Disconnected")
