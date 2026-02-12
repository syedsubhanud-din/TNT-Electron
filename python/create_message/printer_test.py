import socket
import time

printer_ip = "172.16.0.55"
port = 9944

commands = {
    "1": ("Start printing", '{"request_type":"post","path":"/engine/printjob","hash":11112,"attribute":{"print_data_name":"Msg2"}}'),
    "2": ("Stop printing", '{"request_type":"delete","path":"/engine/printjob","id":0}'),
    "3": ("Clear cache", '{"request_type":"put","path":"/engine/clear_cache"}'),
    "4": ("Get real-time info", '{"request_type":"get","path":"/engine/real"}')
}

def print_menu():
    print("\nSelect a command to send:")
    for k, v in commands.items():
        print(f"  {k}. {v[0]}")
    print("  q. Quit")

print("[INFO] Creating socket...")
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
print(f"[INFO] Connecting to {printer_ip}:{port} ...")
s.connect((printer_ip, port))
print("[INFO] Connected. Ready to send commands.")

try:
    while True:
        print_menu()
        choice = input("Enter choice: ").strip()
        if choice == 'q':
            break
        if choice in commands:
            cmd_name, json_cmd = commands[choice]
            data = (json_cmd + '\r\n').encode('utf-8')
            print(f"[INFO] Sending: {json_cmd}")
            s.sendall(data)
            print("[INFO] Command sent.")
            try:
                s.settimeout(5)
                response = s.recv(4096)
                print("[INFO] Response:", response.decode(errors='ignore'))
            except socket.timeout:
                print("[WARN] No response received.")
            finally:
                s.settimeout(None)
        else:
            print("[WARN] Invalid choice.")
        time.sleep(1)
except KeyboardInterrupt:
    print("[INFO] Keyboard interrupt received.")
finally:
    print("[INFO] Closing socket.")
    s.close()
