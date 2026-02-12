import socket
import json
import time
import base64
import io

try:
    import barcode
    from barcode.writer import ImageWriter
    BARCODE_AVAILABLE = True
except ImportError:
    print("[WARN] python-barcode library not installed. Install with: pip install python-barcode pillow")
    BARCODE_AVAILABLE = False

try:
    import qrcode
    QRCODE_AVAILABLE = True
except ImportError:
    print("[WARN] qrcode library not installed. Install with: pip install qrcode pillow")
    QRCODE_AVAILABLE = False

printer_ip = "172.16.0.55"
port = 9944

def send_command(socket_obj, command_dict):
    """Send a command and wait for response"""
    cmd_str = json.dumps(command_dict) + '\r\n'
    print(f"[INFO] Sending: {cmd_str.strip()}")
    socket_obj.sendall(cmd_str.encode('utf-8'))
    
    try:
        socket_obj.settimeout(5)
        response = socket_obj.recv(4096)
        response_str = response.decode(errors='ignore').strip()
        print(f"[INFO] Response: {response_str}")
        return json.loads(response_str)
    except socket.timeout:
        print("[WARN] No response received.")
        return None
    except json.JSONDecodeError as e:
        print(f"[ERROR] Failed to parse response: {e}")
        return None
    finally:
        socket_obj.settimeout(None)

def generate_qrcode(content):
    """Generate QR code image"""
    qr = qrcode.QRCode(box_size=10, border=2)
    qr.add_data(content)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Convert to BMP
    buf = io.BytesIO()
    img.save(buf, format='BMP')
    return buf.getvalue()

def generate_barcode(content, barcode_type='code128'):
    """Generate barcode image"""
    try:
        # Create barcode
        barcode_class = barcode.get_barcode_class(barcode_type)
        barcode_instance = barcode_class(content, writer=ImageWriter())
        
        # Save to bytes
        buf = io.BytesIO()
        barcode_instance.write(buf)
        buf.seek(0)
        
        # Convert to BMP
        from PIL import Image
        img = Image.open(buf)
        bmp_buf = io.BytesIO()
        img.save(bmp_buf, format='BMP')
        return bmp_buf.getvalue()
    except Exception as e:
        print(f"[ERROR] Failed to generate barcode: {e}")
        return None

def upload_and_print(socket_obj, image_bytes, content, code_type):
    """Upload image and send print command"""
    # Encode as base64
    image_b64 = base64.b64encode(image_bytes).decode()
    image_name = f"{code_type}_{int(time.time())}"
    
    # Upload image
    print(f"\n[STEP 1] Uploading {code_type} image: {image_name}")
    upload_cmd = {
        "request_type": "post",
        "path": "/engine/download_image",
        "parm": 1,
        "size": len(image_bytes),
        "name": image_name,
        "content": image_b64
    }
    upload_response = send_command(socket_obj, upload_cmd)
    
    if not upload_response or upload_response.get("status") == "error":
        print("[ERROR] Failed to upload image!")
        return False
    
    time.sleep(1)
    
    # Start print job
    print(f"\n[STEP 2] Starting print job for: {image_name}")
    print_cmd = {
        "request_type": "post",
        "path": "/engine/printjob",
        "hash": int(time.time()),
        "attribute": {
            "print_data_name": image_name
        }
    }
    print_response = send_command(socket_obj, print_cmd)
    
    if print_response and print_response.get("status") == "ok":
        print(f"[SUCCESS] Print job started for: {content}")
        return True
    else:
        print("[ERROR] Failed to start print job")
        return False

def print_menu():
    print("\n" + "="*70)
    print("BARCODE & QR CODE PRINTER")
    print("="*70)
    if QRCODE_AVAILABLE:
        print("1. Print QR Code")
    else:
        print("1. Print QR Code [UNAVAILABLE - install qrcode]")
    
    if BARCODE_AVAILABLE:
        print("2. Print Code128 Barcode")
        print("3. Print EAN13 Barcode")
        print("4. Print Code39 Barcode")
    else:
        print("2-4. Print Barcodes [UNAVAILABLE - install python-barcode]")
    
    print("q. Quit")
    print("="*70)

print(f"[INFO] Connecting to printer at {printer_ip}:{port}...")
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

try:
    s.connect((printer_ip, port))
    print("[SUCCESS] Connected to printer!")
    
    while True:
        print_menu()
        choice = input("Enter choice: ").strip()
        
        if choice == 'q':
            break
        
        if choice == '1' and QRCODE_AVAILABLE:
            # QR Code
            content = input("Enter QR code content: ").strip()
            if not content:
                print("[ERROR] Content cannot be empty!")
                continue
            
            print(f"[INFO] Generating QR code for: {content}")
            image_bytes = generate_qrcode(content)
            upload_and_print(s, image_bytes, content, "qr")
            
        elif choice == '2' and BARCODE_AVAILABLE:
            # Code128 Barcode
            content = input("Enter barcode content: ").strip()
            if not content:
                print("[ERROR] Content cannot be empty!")
                continue
            
            print(f"[INFO] Generating Code128 barcode for: {content}")
            image_bytes = generate_barcode(content, 'code128')
            if image_bytes:
                upload_and_print(s, image_bytes, content, "code128")
                
        elif choice == '3' and BARCODE_AVAILABLE:
            # EAN13 Barcode (needs 12 digits, checksum added automatically)
            content = input("Enter 12-digit EAN13 code: ").strip()
            if not content.isdigit() or len(content) != 12:
                print("[ERROR] EAN13 requires exactly 12 digits!")
                continue
            
            print(f"[INFO] Generating EAN13 barcode for: {content}")
            image_bytes = generate_barcode(content, 'ean13')
            if image_bytes:
                upload_and_print(s, image_bytes, content, "ean13")
                
        elif choice == '4' and BARCODE_AVAILABLE:
            # Code39 Barcode
            content = input("Enter barcode content (uppercase letters/numbers): ").strip().upper()
            if not content:
                print("[ERROR] Content cannot be empty!")
                continue
            
            print(f"[INFO] Generating Code39 barcode for: {content}")
            image_bytes = generate_barcode(content, 'code39')
            if image_bytes:
                upload_and_print(s, image_bytes, content, "code39")
        else:
            print("[WARN] Invalid choice or library not installed")
        
        time.sleep(0.5)

except ConnectionRefusedError:
    print(f"[ERROR] Could not connect to printer at {printer_ip}:{port}")
except KeyboardInterrupt:
    print("\n[INFO] Interrupted by user")
except Exception as e:
    print(f"[ERROR] An error occurred: {e}")
    import traceback
    traceback.print_exc()
finally:
    print("[INFO] Closing connection...")
    s.close()
    print("[INFO] Disconnected")
