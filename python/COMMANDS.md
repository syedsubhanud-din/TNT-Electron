# Sojet Printer Commands Reference

**IP:** 172.16.0.55  
**Port:** 9944  
**Protocol:** TCP-JSON (messages end with `\r\n`)

---

## How to Create an Object (Best Practice)

The hierarchy for printable content is:

```
Source → Object → Message
```

1. **Add Source** – Defines the content (text, image, date, counter, schedule)
2. **Add Object** – Positions the source on the layout; references `source_list` (source ids)
3. **New Message** – Groups objects; references `object_list` (object ids)

**Source object fields** (text, barcode, image): `content`, `limit` (optional), `name`, edit toggle (`exported`=false means editable).

**Correct order:**
1. `add_source` → get `source_id`
2. `add_object` with `source_list: [{"type":"text","id":source_id}]` → get `object_id`
3. `new_message` with `object_list: [{"id":object_id,"type":"text"}]` → get `message_id`

Use `create_object.py` for the recommended flow:
```bash
python create_object.py "Hello World" --create-message MyMsg
```

---

## Scripts Overview

| Script | Purpose |
|--------|---------|
| `sojet_client.py` | Base client with all protocol methods |
| `run_command.py` | CLI to run any action: `python run_command.py <category> <action> [args]` |
| `create_object.py` | Best way to create object (source → object) |
| `message_manager.py` | Message list, delete, modify |
| `create_message.py` | Interactive: create text message |
| `create_product_message.py` | Create message with barcode |
| `create_product_qrcode.py` | Create message with QR code + product info (user-provided content) |
| `create_product_barcode.py` | Create message with text + barcode (Code128) or QR code |
| `create_product_label.py` | Product label: QR (left) + GTIN/MFG/EXP/BATCH/SN/TMDA (right) |
| `get_message_sources.py` | Get message and all its sources |

---

## All Commands by Category

### 1. Print Control (`print`)

| Action | Command | Description |
|--------|---------|-------------|
| Start printing | `python run_command.py print start <message_name>` | Start print job |
| Stop printing | `python run_command.py print stop` | Stop print engine |
| Clear cache | `python run_command.py print clear` | Clear engine cache |
| Get status | `python run_command.py print status` | Real-time print info |
| Modify initial value | `python run_command.py print modify_parm <type> <id> <value>` | e.g. counter value |
| Cleaning nozzle | `python run_command.py print nozzle` | Clean printheads |

**Paths:** `/engine/printjob`, `/engine/clear_cache`, `/engine/real`, `/engine/parm_modify`, `/engine/printhead_clear`

---

### 2. Printer List (`printer`)

| Action | Command |
|--------|---------|
| Get list | `python run_command.py printer list` |
| Update | `python run_command.py printer update '[...]'` |

**Path:** `/system/printer`

---

### 3. Printhead (`printhead`)

| Action | Command |
|--------|---------|
| Get list | `python run_command.py printhead list` |
| Update | `python run_command.py printhead update '[...]'` |

**Path:** `/system/printhead_list`

---

### 4. Print Settings (`settings`)

| Action | Command |
|--------|---------|
| Get | `python run_command.py settings get` |
| Update | `python run_command.py settings update '{}'` |

**Path:** `/system/print_settings`

---

### 5. System (`system`)

| Action | Command |
|--------|---------|
| Get settings | `python run_command.py system get` |
| Update settings | `python run_command.py system update '{}'` |
| Get time | `python run_command.py system time_get` |
| Set time | `python run_command.py system time_set <y> <m> <d> <h> <min> <s>` |
| Restore factory | `python run_command.py system reset` |

**Paths:** `/system/system_settings`, `/system/date_get`, `/system/date_set`, `/system/reset`

---

### 6. Radix (`radix`)

| Action | Command |
|--------|---------|
| List | `python run_command.py radix list [offset] [num]` |
| Add | `python run_command.py radix add <name>` |
| Find | `python run_command.py radix find <id>` |
| Delete | `python run_command.py radix delete <id>` |
| Modify | `python run_command.py radix modify <id> <name>` |

**Paths:** `/system/radix_list`, `/system/radix`

---

### 7. Date Format (`dateformat`)

| Action | Command |
|--------|---------|
| List | `python run_command.py dateformat list [offset] [num]` |
| Add | `python run_command.py dateformat add <name> '{"attribute":...}'` |
| Find | `python run_command.py dateformat find <id>` |
| Delete | `python run_command.py dateformat delete <id>` |
| Update | `python run_command.py dateformat update <id> <name> '{"attribute":...}'` |

**Path:** `/system/dateformat_list`, `/system/dateformat`

---

### 8. Shift / Schedule (`shift`)

| Action | Command |
|--------|---------|
| List | `python run_command.py shift list [offset] [num]` |
| Create | `python run_command.py shift create <name> '{"attribute":...}'` |
| Find | `python run_command.py shift find <id>` |
| Delete | `python run_command.py shift delete <id>` |
| Edit | `python run_command.py shift edit <id> <name> '{"attribute":...}'` |

**Paths:** `/system/schedule_list`, `/system/schedule`

---

### 9. Alarm Kit (`alarm`)

| Action | Command |
|--------|---------|
| Get config | `python run_command.py alarm get` |
| Set config | `python run_command.py alarm set '[{"signals":...}]'` |
| Restore | `python run_command.py alarm restore` |

**Path:** `/system/signal_config`

---

### 10. System Status (`status`)

| Action | Command |
|--------|---------|
| Heartbeat | `python run_command.py status heartbeat` |
| System status | `python run_command.py status system` |

**Paths:** `/info/heart_beat`, `/info/status`

---

### 11. Message Operations (`message`)

| Action | Command |
|--------|---------|
| List messages | `python run_command.py message list [offset] [num]` |
| Find message | `python run_command.py message find <id>` |
| Delete message | `python run_command.py message delete <id>` |
| Add source | `python run_command.py message source_add <type> <name> '{"content":"..."}'` |
| Find source | `python run_command.py message source_find <id> <type>` |
| Delete source | `python run_command.py message source_delete <id> <type>` |
| Modify source | `python run_command.py message source_modify <id> <type> <name> '{"content":"..."}'` |
| Add object | `python run_command.py message object_add <type> <name> '{style}' '[source_list]'` |
| Find object | `python run_command.py message object_find <id>` |
| Delete object | `python run_command.py message object_delete <id>` |
| Modify object | `python run_command.py message object_modify <id> <type> <name> '{style}' '[source_list]'` |
| New message | `python run_command.py message new <name> '[object_list]'` |
| Modify message | `python run_command.py message modify <id> <name> '[object_list]'` |

**Paths:** `/data/list`, `/data/data`, `/data/source`, `/data/object`

---

### 12. Dynamic Data

| Action | API | Path |
|--------|-----|------|
| Send dynamic data | `client.send_dynamic_data(print_mode, data)` | `/engine/dynamic` |
| Upload image | `client.download_image(name, content_b64)` | `/engine/download_image` |

Use `sojet_client.py` directly for these.

---

## message_manager.py (Legacy)

```bash
python message_manager.py list
python message_manager.py delete 1
python message_manager.py modify 2 "NewName"
```

---

## Product + QR Code (M2 IPS-9510)

Print product information with a QR code. The QR code content is user-specified (URL, ID, serial, etc.):

```bash
# Interactive
python create_product_qrcode.py

# CLI (for automation)
python create_product_qrcode.py Prod1 "Product Description" "https://example.com/item123"
```

Uses image flow: generate QR BMP, upload via download_image, create image source with `attribute.path` = image name.

---

## Product + Barcode / QR Code

Create a message with product description text and either Code128 barcode or QR code:

```bash
# Interactive (prompts for name, text, data)
python create_product_barcode.py

# CLI - barcode (Code128, default)
python create_product_barcode.py <msg_name> <product_text> <data>

# CLI - QR code
python create_product_barcode.py <msg_name> <product_text> <data> -t qrcode
```

Examples:
```bash
python create_product_barcode.py TestProd "My Product" "98765"
python create_product_barcode.py TestProd "My Product" "https://example.com" -t qrcode
```

Uses text sources for both content; barcode object references a text source. `-t barcode` (default) → Code128, `-t qrcode` → QR code.

---

## Product label (pharma-style)

Create a label with QR code on the left and human-readable fields on the right. User inputs are concatenated into the QR content.

**Fields:** GTIN, MFG, EXP, BATCH, SN, TMDA REG. NO.

```bash
# CLI (all fields)
python create_product_label.py <name> --gtin <val> --mfg <val> --exp <val> --batch <val> --sn <val> --tmda_reg <val>

# Interactive (prompts for each field)
python create_product_label.py
```

**QR content format** (`-f`):
- `gs1` (default): GS1 Application Identifiers, e.g. `(01)08961101532710(11)012026(17)012029(10)153A26(21)...(99)TZ 11H178`
- `pipe`: `val1|val2|val3|...`
- `simple`: concatenated with no delimiters

Example:
```bash
python create_product_label.py PharmaLabel --gtin 08961101532710 --mfg 012026 --exp 012029 --batch 153A26 --sn 02750082604216564872 --tmda_reg "TZ 11H178"
```

---

## Get message and sources

```bash
# By message ID
python get_message_sources.py 1

# Interactive (lists messages, prompts for ID)
python get_message_sources.py
```

---

## Web-to-LAN Label Printing

Enable an internet-hosted website to print labels on the LAN printer via a local agent.

**API server** (deploy on cloud):

```bash
pip install -r requirements-webprint.txt
uvicorn webprint.api_server:app --host 0.0.0.0 --port 8000
```

Open `/` for the label form. Optional: `export AGENT_API_KEY=secret` to require agent auth.

**Print agent** (run on PC on printer LAN):

```bash
python -m webprint.print_agent --api-url https://your-api.example.com
```

See [webprint/README.md](webprint/README.md) for full docs.

---

## Quick Examples

```bash
# Get message list
python run_command.py message list 0 10

# Delete message id 5
python run_command.py message delete 5

# Get print status
python run_command.py print status

# Get system status
python run_command.py status system

# Create text object and message
python create_object.py "Product XYZ" --create-message ProductXYZ
```
