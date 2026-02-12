#!/usr/bin/env python3
"""
CLI to run all Sojet printer protocol actions.
Usage: python run_command.py <category> <action> [args...]
See COMMANDS.md for full reference.
"""

import sys
import json
from sojet_client import SojetClient

DEFAULT_IP = "172.16.0.55"
DEFAULT_PORT = 9944


def main():
    if len(sys.argv) < 3:
        print("Usage: python run_command.py <category> <action> [args...]")
        print("Categories: print, printer, printhead, settings, system, radix, dateformat,")
        print("           shift, alarm, status, message, dynamic")
        print("Use: python run_command.py --help for actions per category")
        sys.exit(1)

    cat = sys.argv[1].lower()
    action = sys.argv[2].lower()
    args = sys.argv[3:]

    client = SojetClient(DEFAULT_IP, DEFAULT_PORT)
    if not client.connect():
        sys.exit(1)

    try:
        run_action(client, cat, action, args)
    finally:
        client.disconnect()


def run_action(client, cat, action, args):
    # 1. Print control
    if cat == "print":
        if action == "start":
            r = client.start_print(args[0] if args else "Msg")
        elif action == "stop":
            r = client.stop_print()
        elif action == "clear":
            r = client.clear_cache()
        elif action == "status":
            r = client.get_print_status()
        elif action == "modify_parm":
            parm = [{"type": args[0], "id": int(args[1]), "value": int(args[2])}] if len(args) >= 3 else []
            r = client.modify_initial_value(parm)
        elif action == "nozzle":
            r = client.cleaning_nozzle()
        else:
            print("Actions: start, stop, clear, status, modify_parm, nozzle")
            return

    # 2. Printer
    elif cat == "printer":
        if action == "list":
            r = client.get_printer_list()
        elif action == "update":
            r = client.update_printer_list(json.loads(args[0]) if args else [])
        else:
            print("Actions: list, update")
            return

    # 3. Printhead
    elif cat == "printhead":
        if action == "list":
            r = client.get_printhead_list()
        elif action == "update":
            r = client.update_printhead_list(json.loads(args[0]) if args else [])
        else:
            print("Actions: list, update")
            return

    # 4. Print settings
    elif cat == "settings":
        if action == "get":
            r = client.get_print_settings()
        elif action == "update":
            r = client.update_print_settings(**json.loads(args[0]) if args else {})
        else:
            print("Actions: get, update")
            return

    # 5. System
    elif cat == "system":
        if action == "get":
            r = client.get_system_settings()
        elif action == "update":
            r = client.update_system_settings(**json.loads(args[0]) if args else {})
        elif action == "time_get":
            r = client.get_system_time()
        elif action == "time_set":
            r = client.set_system_time(*(int(a) for a in args[:6])) if len(args) >= 6 else None
        elif action == "reset":
            r = client.restore_factory_settings()
        else:
            print("Actions: get, update, time_get, time_set, reset")
            return

    # 6. Radix
    elif cat == "radix":
        if action == "list":
            r = client.get_radix_list(int(args[0]) if args else 0, int(args[1]) if len(args) > 1 else 10)
        elif action == "add":
            r = client.add_radix(args[0] if args else "Radix1")
        elif action == "find":
            r = client.find_radix(int(args[0])) if args else None
        elif action == "delete":
            r = client.delete_radix(int(args[0])) if args else None
        elif action == "modify":
            r = client.modify_radix(int(args[0]), args[1]) if len(args) >= 2 else None
        else:
            print("Actions: list, add, find, delete, modify")
            return

    # 7. Date format
    elif cat == "dateformat":
        if action == "list":
            r = client.get_dateformat_list(int(args[0]) if args else 0, int(args[1]) if len(args) > 1 else 10)
        elif action == "add":
            r = client.add_dateformat(args[0], json.loads(args[1])) if len(args) >= 2 else None
        elif action == "find":
            r = client.find_dateformat(int(args[0])) if args else None
        elif action == "delete":
            r = client.delete_dateformat(int(args[0])) if args else None
        elif action == "update":
            r = client.update_dateformat(int(args[0]), args[1], json.loads(args[2])) if len(args) >= 3 else None
        else:
            print("Actions: list, add, find, delete, update")
            return

    # 8. Shift
    elif cat == "shift":
        if action == "list":
            r = client.get_shift_list(int(args[0]) if args else 0, int(args[1]) if len(args) > 1 else 10)
        elif action == "create":
            r = client.create_shift(args[0], json.loads(args[1])) if len(args) >= 2 else None
        elif action == "find":
            r = client.find_shift(int(args[0])) if args else None
        elif action == "delete":
            r = client.delete_shift(int(args[0])) if args else None
        elif action == "edit":
            r = client.edit_shift(int(args[0]), args[1], json.loads(args[2])) if len(args) >= 3 else None
        else:
            print("Actions: list, create, find, delete, edit")
            return

    # 9. Alarm
    elif cat == "alarm":
        if action == "get":
            r = client.get_alarm_config()
        elif action == "set":
            r = client.set_alarm_config(json.loads(args[0])) if args else None
        elif action == "restore":
            r = client.restore_alarm_config()
        else:
            print("Actions: get, set, restore")
            return

    # 10. Status
    elif cat == "status":
        if action == "heartbeat":
            r = client.get_heartbeat()
        elif action == "system":
            r = client.get_system_status()
        else:
            print("Actions: heartbeat, system")
            return

    # 11. Message operations
    elif cat == "message":
        if action == "list":
            r = client.get_message_list(int(args[0]) if args else 0, int(args[1]) if len(args) > 1 else 10)
        elif action == "find":
            r = client.find_message(int(args[0]), int(args[1]) if len(args) > 1 else 1) if args else None
        elif action == "delete":
            r = client.delete_message(int(args[0])) if args else None
        elif action == "source_add":
            r = client.add_source_raw(args[0], args[1], json.loads(args[2])) if len(args) >= 3 else None
        elif action == "source_find":
            r = client.find_source(int(args[0]), args[1]) if len(args) >= 2 else None
        elif action == "source_delete":
            r = client.delete_source(int(args[0]), args[1]) if len(args) >= 2 else None
        elif action == "source_modify":
            r = client.modify_source(int(args[0]), args[1], args[2], json.loads(args[3])) if len(args) >= 4 else None
        elif action == "object_add":
            r = client.add_object(args[0], args[1], json.loads(args[2]), json.loads(args[3])) if len(args) >= 4 else None
        elif action == "object_find":
            r = client.find_object(int(args[0])) if args else None
        elif action == "object_delete":
            r = client.delete_object(int(args[0])) if args else None
        elif action == "object_modify":
            r = client.modify_object(int(args[0]), args[1], args[2], json.loads(args[3]), json.loads(args[4])) if len(args) >= 5 else None
        elif action == "new":
            r = client.new_message(args[0], json.loads(args[1])) if len(args) >= 2 else None
        elif action == "modify":
            r = client.modify_message(int(args[0]), args[1], json.loads(args[2])) if len(args) >= 3 else None
        else:
            print("Actions: list, find, delete, source_add, source_find, source_delete, source_modify,")
            print("        object_add, object_find, object_delete, object_modify, new, modify")
            return

    else:
        print(f"Unknown category: {cat}. See COMMANDS.md")
        return

    print(json.dumps(r, indent=2) if r else "No response")


if __name__ == "__main__":
    main()
