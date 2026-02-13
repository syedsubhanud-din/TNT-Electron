#!/usr/bin/env python3
"""
Sojet Printer TCP-JSON Client - All protocol actions
IP: 172.16.0.55, Port: 9944
"""

import socket
import json
import time
from typing import Dict, List, Optional, Any


class SojetClient:
    """Client for all Sojet printer TCP-JSON protocol actions."""
    
    def __init__(self, host: str = "172.16.0.55", port: int = 9944, timeout: int = 10):
        self.host = host
        self.port = port
        self.timeout = timeout
        self.socket = None
        self._load_config()

    def _load_config(self):
        """Try to load config from printer_config.json if it exists"""
        import os
        config_path = os.path.join(os.path.dirname(__file__), "printer_config.json")
        if os.path.exists(config_path):
            try:
                with open(config_path, "r") as f:
                    config = json.load(f)
                    self.host = config.get("printer_ip", self.host)
                    self.port = config.get("printer_port", self.port)
            except Exception as e:
                print(f"Warning: Failed to load config from {config_path}: {e}")

    def connect(self) -> bool:
        try:
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.socket.settimeout(self.timeout)
            self.socket.connect((self.host, self.port))
            return True
        except socket.timeout:
            print(f"Error: Connection to printer at {self.host}:{self.port} timed out.")
            return False
        except socket.error as e:
            print(f"Error: Could not connect to printer at {self.host}:{self.port}. {e}")
            return False

    def disconnect(self):
        if self.socket:
            self.socket.close()
            self.socket = None

    def send(self, request: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        if not self.socket:
            return None
        try:
            msg = json.dumps(request, separators=(',', ':')) + '\r\n'
            self.socket.sendall(msg.encode('utf-8'))
            data = b''
            while True:
                chunk = self.socket.recv(4096)
                if not chunk:
                    break
                data += chunk
                if data.endswith(b'\r\n'):
                    break
            s = data.decode('utf-8').strip()
            return json.loads(s) if s else None
        except Exception as e:
            print(f"Send error: {e}")
            return None

    def _hash(self) -> int:
        return int(time.time() * 1000) % 10000000

    # --- 1. Print Control ---
    def start_print(self, message_name: str) -> Optional[Dict]:
        return self.send({
            "request_type": "post", "path": "/engine/printjob", "hash": self._hash(),
            "attribute": {"print_data_name": message_name}
        })

    def stop_print(self) -> Optional[Dict]:
        return self.send({"request_type": "delete", "path": "/engine/printjob", "id": 0})

    def clear_cache(self) -> Optional[Dict]:
        return self.send({"request_type": "put", "path": "/engine/clear_cache"})

    def get_print_status(self) -> Optional[Dict]:
        return self.send({"request_type": "get", "path": "/engine/real"})

    def modify_initial_value(self, parm: List[Dict]) -> Optional[Dict]:
        return self.send({
            "request_type": "post", "path": "/engine/parm_modify",
            "cmd": "up_parm", "parm": parm
        })

    def cleaning_nozzle(self, ids: List[int] = None, columns: List[int] = None) -> Optional[Dict]:
        ids = ids or [0, 1, 2, 3]
        columns = columns or [200, 200, 200, 200]
        return self.send({
            "request_type": "put", "path": "/engine/printhead_clear",
            "id": ids, "columns": columns
        })

    # --- 2. Printhead / Printer ---
    def get_printer_list(self) -> Optional[Dict]:
        return self.send({"request_type": "get", "path": "/system/printer"})

    def update_printer_list(self, printer_list: List[Dict]) -> Optional[Dict]:
        return self.send({"request_type": "put", "path": "/system/printer", "printer_list": printer_list})

    def get_printhead_list(self) -> Optional[Dict]:
        return self.send({"request_type": "get", "path": "/system/printhead_list"})

    def update_printhead_list(self, printhead_list: List[Dict]) -> Optional[Dict]:
        return self.send({"request_type": "put", "path": "/system/printhead_list", "printhead_list": printhead_list})

    # --- 3. Print Settings ---
    def get_print_settings(self) -> Optional[Dict]:
        return self.send({"request_type": "get", "path": "/system/print_settings"})

    def update_print_settings(self, **kwargs) -> Optional[Dict]:
        return self.send({"request_type": "put", "path": "/system/print_settings", **kwargs})

    # --- 4. System Settings ---
    def get_system_settings(self) -> Optional[Dict]:
        return self.send({"request_type": "get", "path": "/system/system_settings"})

    def update_system_settings(self, **kwargs) -> Optional[Dict]:
        return self.send({"request_type": "put", "path": "/system/system_settings", **kwargs})

    def get_system_time(self) -> Optional[Dict]:
        return self.send({"request_type": "get", "path": "/system/date_get"})

    def set_system_time(self, year: int, month: int, day: int, hour: int, minute: int, second: int) -> Optional[Dict]:
        return self.send({
            "request_type": "put", "path": "/system/date_set",
            "year": year, "month": month, "day": day, "hour": hour, "minute": minute, "second": second
        })

    def restore_factory_settings(self) -> Optional[Dict]:
        return self.send({"request_type": "get", "path": "/system/reset"})

    # --- 5. Radix ---
    def get_radix_list(self, offset: int = 0, num: int = 10) -> Optional[Dict]:
        return self.send({"request_type": "get", "path": "/system/radix_list", "offset": offset, "num": num})

    def add_radix(self, name: str) -> Optional[Dict]:
        return self.send({"request_type": "post", "path": "/system/radix", "hash": self._hash(), "name": name})

    def find_radix(self, radix_id: int) -> Optional[Dict]:
        return self.send({"request_type": "get", "path": "/system/radix", "id": radix_id})

    def delete_radix(self, radix_id: int) -> Optional[Dict]:
        return self.send({"request_type": "delete", "path": "/system/radix_list", "id": radix_id})

    def modify_radix(self, radix_id: int, name: str) -> Optional[Dict]:
        return self.send({"request_type": "put", "path": "/system/radix", "id": radix_id, "name": name})

    # --- 6. Date Format ---
    def get_dateformat_list(self, offset: int = 0, num: int = 10) -> Optional[Dict]:
        return self.send({"request_type": "get", "path": "/system/dateformat_list", "offset": offset, "num": num})

    def add_dateformat(self, name: str, attribute: Dict) -> Optional[Dict]:
        return self.send({"request_type": "post", "path": "/system/dateformat", "hash": self._hash(), "name": name, "attribute": attribute})

    def find_dateformat(self, df_id: int) -> Optional[Dict]:
        return self.send({"request_type": "get", "path": "/system/dateformat", "id": df_id})

    def delete_dateformat(self, df_id: int) -> Optional[Dict]:
        return self.send({"request_type": "delete", "path": "/system/dateformat", "id": df_id})

    def update_dateformat(self, df_id: int, name: str, attribute: Dict) -> Optional[Dict]:
        return self.send({"request_type": "put", "path": "/system/dateformat", "id": df_id, "name": name, "attribute": attribute})

    # --- 7. Shift (Schedule) ---
    def get_shift_list(self, offset: int = 0, num: int = 10) -> Optional[Dict]:
        return self.send({"request_type": "get", "path": "/system/schedule_list", "offset": offset, "num": num})

    def create_shift(self, name: str, attribute: Dict) -> Optional[Dict]:
        return self.send({"request_type": "post", "path": "/system/schedule", "hash": self._hash(), "name": name, "attribute": attribute})

    def find_shift(self, shift_id: int) -> Optional[Dict]:
        return self.send({"request_type": "get", "path": "/system/schedule", "id": shift_id})

    def delete_shift(self, shift_id: int) -> Optional[Dict]:
        return self.send({"request_type": "delete", "path": "/system/schedule", "id": shift_id})

    def edit_shift(self, shift_id: int, name: str, attribute: Dict) -> Optional[Dict]:
        return self.send({"request_type": "put", "path": "/system/schedule", "id": shift_id, "name": name, "attribute": attribute})

    # --- 8. Alarm Kit ---
    def get_alarm_config(self) -> Optional[Dict]:
        return self.send({"request_type": "get", "path": "/system/signal_config"})

    def set_alarm_config(self, signals: List[Dict]) -> Optional[Dict]:
        return self.send({"request_type": "put", "path": "/system/signal_config", "signals": signals})

    def restore_alarm_config(self) -> Optional[Dict]:
        return self.send({"request_type": "delete", "path": "/system/signal_config"})

    # --- 9. System Status ---
    def get_heartbeat(self) -> Optional[Dict]:
        return self.send({"request_type": "get", "path": "/info/heart_beat"})

    def get_system_status(self) -> Optional[Dict]:
        return self.send({"request_type": "get", "path": "/info/status"})

    # --- 10. Message Operations ---
    def add_source(
        self,
        stype: str,
        name: str,
        content: str,
        limit: Optional[int] = None,
        editable: bool = True,
    ) -> Optional[Dict]:
        """
        Add a source (text, image, barcode, etc.).
        Source object: name, content, limit (optional), edit toggle (exported=false = editable).
        """
        attr = {"content": content, "exported": not editable}
        if limit is not None:
            attr["limit"] = limit
        return self.send({
            "request_type": "post", "path": "/data/source", "hash": self._hash(),
            "type": stype, "name": name, "attribute": attr
        })

    def add_source_raw(self, stype: str, name: str, attribute: Dict) -> Optional[Dict]:
        """Add source with raw attribute dict (for full control)."""
        return self.send({
            "request_type": "post", "path": "/data/source", "hash": self._hash(),
            "type": stype, "name": name, "attribute": attribute
        })

    def add_object(self, otype: str, name: str, style: Dict, source_list: List[Dict], attribute: Dict = None) -> Optional[Dict]:
        return self.send({
            "request_type": "post", "path": "/data/object", "hash": self._hash(),
            "type": otype, "name": name, "style": style, "attribute": attribute or {},
            "source_list": source_list
        })

    def new_message(self, name: str, object_list: List[Dict], print_prefs: List[Dict] = None) -> Optional[Dict]:
        prefs = print_prefs or [{"ff_margin": 0.0, "fr_margin": 0.0, "bf_margin": 0.0, "br_margin": 0.0}] * 4
        return self.send({
            "request_type": "post", "path": "/data/data", "hash": self._hash(),
            "name": name, "attribute": {"printdata_pref": {"print_prefs": prefs}},
            "object_list": object_list
        })

    def find_source(self, source_id: int, stype: str) -> Optional[Dict]:
        return self.send({"request_type": "get", "path": "/data/source", "id": source_id, "type": stype})

    def find_object(self, object_id: int) -> Optional[Dict]:
        return self.send({"request_type": "get", "path": "/data/object", "id": object_id})

    def find_message(self, message_id: int, detail: int = 1) -> Optional[Dict]:
        return self.send({"request_type": "get", "path": "/data/data", "id": message_id, "detail": detail})

    def get_message_with_sources(self, message_id: int) -> Optional[Dict]:
        """
        Get message (detail=1) and resolve all sources from object_list.
        Returns: {"message": msg, "objects": [...], "sources": [...]} or None
        """
        msg = self.find_message(message_id, detail=1)
        if not msg or msg.get("status") == "Error":
            return None
        objects = msg.get("object_list", [])
        sources = []
        seen = set()
        for obj in objects:
            for s in obj.get("source_list", []):
                sid, styp = s.get("id"), s.get("type")
                if sid is None or not styp or (sid, styp) in seen:
                    continue
                seen.add((sid, styp))
                src = self.find_source(sid, styp)
                sources.append(src if src and src.get("status") != "Error" else {"id": sid, "type": styp, "error": "not found"})
        return {"message": msg, "objects": objects, "sources": sources}

    def get_message_list(self, offset: int = 0, num: int = 10) -> Optional[Dict]:
        return self.send({"request_type": "get", "path": "/data/list", "offset": offset, "num": num})

    def delete_source(self, source_id: int, stype: str) -> Optional[Dict]:
        return self.send({"request_type": "delete", "path": "/data/source", "id": source_id, "type": stype})

    def delete_object(self, object_id: int) -> Optional[Dict]:
        return self.send({"request_type": "delete", "path": "/data/object", "id": object_id})

    def delete_message(self, message_id: int) -> Optional[Dict]:
        return self.send({"request_type": "delete", "path": "/data/data", "id": message_id})

    def modify_source(self, source_id: int, stype: str, name: str, attribute: Dict) -> Optional[Dict]:
        return self.send({
            "request_type": "put", "path": "/data/source",
            "id": source_id, "type": stype, "name": name, "attribute": attribute
        })

    def modify_object(self, object_id: int, otype: str, name: str, style: Dict, source_list: List[Dict], attribute: Dict = None) -> Optional[Dict]:
        return self.send({
            "request_type": "put", "path": "/data/object",
            "id": object_id, "type": otype, "name": name, "style": style,
            "attribute": attribute or {}, "source_list": source_list
        })

    def modify_message(self, message_id: int, name: str, object_list: List[Dict], print_prefs: List[Dict] = None) -> Optional[Dict]:
        prefs = print_prefs or [{"ff_margin": 0.0, "fr_margin": 0.0, "bf_margin": 0.0, "br_margin": 0.0}] * 4
        return self.send({
            "request_type": "put", "path": "/data/data",
            "id": message_id, "name": name, "attribute": {"printdata_pref": {"print_prefs": prefs}},
            "object_list": object_list
        })

    # --- 12. Dynamic Data ---
    def send_dynamic_data(self, print_mode: str, data: List[Dict]) -> Optional[Dict]:
        return self.send({"request_type": "post", "path": "/engine/dynamic", "print_mode": print_mode, "data": data})

    def download_image(self, name: str, content_b64: str, parm: int = 1) -> Optional[Dict]:
        return self.send({
            "request_type": "post", "path": "/engine/download_image",
            "parm": parm, "size": len(content_b64), "name": name, "content": content_b64
        })
