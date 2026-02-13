#!/usr/bin/env python3
import sys
import json
import os
import subprocess

# Add the create_message directory to sys.path so we can import modules from it
script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(os.path.join(script_dir, 'create_message'))

def main():
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "error": "Missing action and data arguments"}))
        return

    action = sys.argv[1]
    data_str = sys.argv[2]

    try:
        if action == 'create':
            # Data is a JSON string of label info
            label_data = json.loads(data_str)
            
            # Format arguments for create_product_label.py
            args = [
                sys.executable,
                os.path.join(script_dir, 'create_message', 'create_product_label.py'),
                f"--gtin", label_data.get('gtin', ''),
                f"--mfg", label_data.get('mfg', ''),
                f"--exp", label_data.get('exp', ''),
                f"--batch", label_data.get('batch', label_data.get('rvsp', '')), # Using RVSP as batch if batch is missing
                f"--sn", label_data.get('sn', ''),
                f"--tmda_reg", label_data.get('trademark', '')
            ]
            
            # Run the script and capture output
            process = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            stdout, stderr = process.communicate()
            
            if process.returncode == 0:
                # Extract message name from output: [OK] Message 'PharmaLabel_123' created
                import re
                match = re.search(r"Message '([^']+)' created", stdout)
                if match:
                    message_name = match.group(1)
                    print(json.dumps({"success": True, "message_name": message_name}))
                else:
                    print(json.dumps({"success": True, "output": stdout}))
            else:
                print(json.dumps({"success": False, "error": stderr or stdout}))
                
        elif action == 'print':
            # Data is the message name
            message_name = data_str
            
            args = [
                sys.executable,
                os.path.join(script_dir, 'create_message', 'run_command.py'),
                "print", "start", message_name
            ]
            
            process = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            stdout, stderr = process.communicate()
            
            if process.returncode == 0:
                print(json.dumps({"success": True, "output": stdout}))
            else:
                print(json.dumps({"success": False, "error": stderr or stdout}))
        else:
            print(json.dumps({"success": False, "error": f"Unknown action: {action}"}))
            
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

if __name__ == "__main__":
    main()
