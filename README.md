# PLC Device Deployment System

Web-based PLC device deployment using **Pure PHP, MySQL, HTML, CSS, and JavaScript** (no frameworks). Designed to run on **XAMPP**.

## Requirements

- XAMPP (Apache + MySQL + PHP)
- Modern browser with JavaScript enabled

## Setup

1. **Start XAMPP**  
   Start Apache and MySQL from the XAMPP Control Panel.

2. **Create database and tables**  
   Open in browser:
   ```
   http://localhost/plc_system/setup_db.php
   ```
   This creates the database `plc_system` and tables: `PLCdevices`, `roomdeployment`, `PLCdeployment`.  
   You can delete `setup_db.php` after the first run if you prefer.

3. **Configure database (optional)**  
   Edit `config.php` if your MySQL user, password, or host differ from XAMPP defaults (`root` / no password / `localhost`).

4. **Open the application**  
   ```
   http://localhost/plc_system/
   ```

## File Structure

| File | Purpose |
|------|---------|
| `index.php` | Main page: device panel, toolbar, canvas, room/appliance panels, graph |
| `config.php` | DB connection and table creation |
| `setup_db.php` | One-time DB setup script |
| `add_device.php` | POST API: add new PLC device |
| `get_devices.php` | API: list PLC devices |
| `get_rooms.php` | API: list rooms (roomdeployment) |
| `get_deployments.php` | API: list deployments (PLCdeployment) |
| `save_deployment.php` | POST API: save deployment layout and appliances |
| `style.css` | Layout and styling |
| `script.js` | Drag-and-drop, switch rules, Chart.js, UI logic |

## Usage

- **Device panel (left):** Drag a PLC device onto the canvas to create a drop zone.
- **Toolbar (top):** Drag **Room** onto a device; drag **Aircon / Fan / Light** onto a room.
- **Switch rules:** Device capacity = `switch` value. Max rooms ≤ switch, total appliances ≤ switch (e.g. switch=2 → 2 rooms with 1 appliance each, or 1 room with 2 appliances).
- **Room panel:** Select a room on the canvas to see Room No, Building No, Aircon Units.
- **Appliance panel:** Single-click an appliance to toggle ON/OFF; double-click to view properties (PLCdeployment data).
- **Add Device:** Use the header button to add a new device (name, IP, switch, power, status, etc.); page refreshes the device list.
- **Graph:** Chart.js shows Time vs Power (sample data; can be wired to real data later).

All deployments are persisted via `save_deployment.php` (roomdeployment and PLCdeployment tables).
