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
    print("[ERROR] python-barcode library not installed. Install with: pip install python-barcode pillow")
    BARCODE_AVAILABLE = False
    exit(1)

try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    print("[ERROR] Pillow library not installed. Install with: pip install pillow")
    PIL_AVAILABLE = False
    exit(1)

printer_ip = "172.16.0.55"
port = 9944

def send_command(socket_obj, command_dict):
    """Send a command and wait for response"""
    cmd_str = json.dumps(command_dict) + '\r\n'
    print(f"[INFO] Sending command to: {command_dict.get('path', 'unknown')}")
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

def generate_barcode_image(product_id, barcode_type='code128'):
    """Generate barcode image and return as BMP bytes"""
    try:
        barcode_class = barcode.get_barcode_class(barcode_type)
        barcode_instance = barcode_class(product_id, writer=ImageWriter())
        
        # Save to bytes
        buf = io.BytesIO()
        barcode_instance.write(buf)
        buf.seek(0)
        
        # Convert to BMP
        img = Image.open(buf)
        bmp_buf = io.BytesIO()
        img.save(bmp_buf, format='BMP')
        return bmp_buf.getvalue()
    except Exception as e:
        print(f"[ERROR] Failed to generate barcode: {e}")
        return None

# Get product information from user
print("=" * 70)
print("CREATE PRODUCT MESSAGE WITH BARCODE")
print("=" * 70)

message_name = input("Enter message name (e.g., 'Product_ABC'): ").strip()
if not message_name:
    print("[ERROR] Message name cannot be empty!")
    exit(1)

product_description = input("Enter product description: ").strip()
if not product_description:
    print("[ERROR] Product description cannot be empty!")
    exit(1)

product_id = input("Enter product ID for barcode: ").strip()
if not product_id:
    print("[ERROR] Product ID cannot be empty!")
    exit(1)

barcode_type = input("Barcode type (code128/code39/ean13) [default: code128]: ").strip().lower()
if not barcode_type:
    barcode_type = 'code128'

if barcode_type not in ['code128', 'code39', 'ean13']:
    print("[ERROR] Invalid barcode type!")
    exit(1)

if barcode_type == 'ean13' and (not product_id.isdigit() or len(product_id) != 12):
    print("[ERROR] EAN13 requires exactly 12 digits!")
    exit(1)

print(f"\n[INFO] Message name: {message_name}")
print(f"[INFO] Product description: {product_description}")
print(f"[INFO] Product ID: {product_id}")
print(f"[INFO] Barcode type: {barcode_type}")
print("=" * 70)

# Generate barcode image
print("\n[PREP] Generating barcode image...")
barcode_bytes = generate_barcode_image(product_id, barcode_type)
if not barcode_bytes:
    print("[ERROR] Failed to generate barcode!")
    exit(1)

barcode_b64 = base64.b64encode(barcode_bytes).decode()
barcode_image_name = f"{message_name}_barcode"

print(f"[SUCCESS] Barcode generated, size: {len(barcode_bytes)} bytes")

# Connect to printer
print(f"\n[INFO] Connecting to printer at {printer_ip}:{port}...")
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

try:
    s.connect((printer_ip, port))
    print("[SUCCESS] Connected to printer!")
    
    # Step 1: Upload barcode image
    print("\n[STEP 1] Uploading barcode image...")
    upload_cmd = {
        "request_type": "post",
        "path": "/engine/download_image",
        "parm": 1,
        "size": len(barcode_bytes),
        "name": barcode_image_name,
        "content": barcode_b64
    }
    upload_response = send_command(s, upload_cmd)
    
    if not upload_response or upload_response.get("status") == "error":
        print("[ERROR] Failed to upload barcode image!")
        exit(1)
    
    print(f"[SUCCESS] Barcode image uploaded: {barcode_image_name}")
    time.sleep(1)
    
    # Step 2: Create text source for product description
    print("\n[STEP 2] Creating text source for product description...")
    text_source_cmd = {
        "request_type": "post",
        "path": "/data/source",
        "hash": int(time.time()),
        "type": "text",
        "name": f"{message_name}_Text",
        "attribute": {
            "content": product_description
        }
    }
    text_source_response = send_command(s, text_source_cmd)
    
    if not text_source_response or text_source_response.get("status") != "ok":
        print("[ERROR] Failed to create text source!")
        exit(1)
    
    text_source_id = text_source_response.get("id")
    print(f"[SUCCESS] Text source created with ID: {text_source_id}")
    time.sleep(1)
    
    # Step 3: Create image source for barcode
    print("\n[STEP 3] Creating image source for barcode...")
    image_source_cmd = {
        "request_type": "post",
        "path": "/data/source",
        "hash": int(time.time()),
        "type": "image",
        "name": barcode_image_name,
        "attribute": {
            "content": barcode_image_name
        }
    }
    image_source_response = send_command(s, image_source_cmd)
    
    if not image_source_response or image_source_response.get("status") != "ok":
        print("[ERROR] Failed to create image source!")
        exit(1)
    
    image_source_id = image_source_response.get("id")
    print(f"[SUCCESS] Image source created with ID: {image_source_id}")
    time.sleep(1)
    
    # Step 4: Create text object
    print("\n[STEP 4] Creating text object...")
    text_object_cmd = {
        "request_type": "post",
        "path": "/data/object",
        "hash": int(time.time()),
        "type": "text",
        "name": f"{message_name}_TextObj",
        "style": {
            "x": 0,
            "y": 10,
            "w": 800,
            "h": 80,
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
                "id": text_source_id
            }
        ]
    }
    text_object_response = send_command(s, text_object_cmd)
    
    if not text_object_response or text_object_response.get("status") != "ok":
        print("[ERROR] Failed to create text object!")
        exit(1)
    
    text_object_id = text_object_response.get("id")
    print(f"[SUCCESS] Text object created with ID: {text_object_id}")
    time.sleep(1)
    
    # Step 5: Create image object for barcode
    print("\n[STEP 5] Creating image object for barcode...")
    image_object_cmd = {
        "request_type": "post",
        "path": "/data/object",
        "hash": int(time.time()),
        "type": "image",
        "name": f"{message_name}_BarcodeObj",
        "style": {
            "x": 0,
            "y": 100,
            "w": 400,
            "h": 150,
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
                "type": "image",
                "id": image_source_id
            }
        ]
    }
    image_object_response = send_command(s, image_object_cmd)
    
    if not image_object_response or image_object_response.get("status") != "ok":
        print("[ERROR] Failed to create image object!")
        exit(1)
    
    image_object_id = image_object_response.get("id")
    print(f"[SUCCESS] Image object created with ID: {image_object_id}")
    time.sleep(1)
    
    # Step 6: Create message with both objects
    print("\n[STEP 6] Creating message...")
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
                "id": text_object_id,
                "type": "text"
            },
            {
                "id": image_object_id,
                "type": "image"
            }
        ]
    }
    message_response = send_command(s, message_cmd)
    
    if not message_response or message_response.get("status") != "ok":
        print("[ERROR] Failed to create message!")
        exit(1)
    
    message_id = message_response.get("id")
    print(f"[SUCCESS] Message created with ID: {message_id}")
    time.sleep(1)
    
    # Step 7: Start printing
    print("\n[STEP 7] Starting print job...")
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
        print(f"[SUCCESS] Print job started!")
    else:
        print("[INFO] Message created but print may require manual start or engine may already be running")
    
    print("\n" + "=" * 70)
    print("COMPLETED SUCCESSFULLY!")
    print("=" * 70)
    print(f"Message Name: {message_name}")
    print(f"Product Description: {product_description}")
    print(f"Product ID (Barcode): {product_id}")
    print(f"Text Object ID: {text_object_id}")
    print(f"Barcode Object ID: {image_object_id}")
    print(f"Message ID: {message_id}")
    print("=" * 70)
    print("\nThe message contains:")
    print("  - Product description (text) at top")
    print("  - Product ID barcode below the text")
    print(f"\nYou can now print this message using: '{message_name}'")
    print("=" * 70)

except ConnectionRefusedError:
    print(f"[ERROR] Could not connect to printer at {printer_ip}:{port}")
except KeyboardInterrupt:
    print("\n[INFO] Interrupted by user")
except Exception as e:
    print(f"[ERROR] An error occurred: {e}")
    import traceback
    traceback.print_exc()
finally:
    print("\n[INFO] Closing connection...")
    s.close()
    print("[INFO] Disconnected")
