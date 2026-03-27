<?php
/**
 * PLC Device Deployment System - Main Page
 * Layout: Left sidebar (devices) | Main (toolbar, canvas) | Right sidebar (Req)
 */
define('PLC_SYSTEM', true);
require_once __DIR__ . '/config.php';
initDatabase();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PLC Device Deployment System</title>
    <link rel="stylesheet" href="style.css">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
</head>
<body>
    <header class="app-header">
        <h1>PLC Device Deployment System</h1>
    </header>

    <div class="app-layout">
        <!-- Left: PLC Devices Panel -->
        <aside class="device-panel" id="device-panel">
            <h2>PLC Devices</h2>
            <button type="button" id="btn-add-device" class="btn-add-device">+ Add Device</button>
            <div class="device-list" id="device-list">
                <p class="loading" id="device-loading">Loading devices...</p>
            </div>
            <p class="panel-desc">Each device is a drop zone for rooms &amp; appliances. Capacity based on switch (1/2/4/8).</p>
        </aside>

        <main class="main-area">
            <!-- Top: DRAGGABLE ITEMS toolbar -->
            <div class="icon-toolbar" id="icon-toolbar">
                <span class="toolbar-title">DRAGGABLE ITEMS</span>
                <button type="button" id="btn-save" class="btn-save">Save</button>
                <button type="button" id="btn-load" class="btn-load">Load</button>
                <button type="button" id="btn-clear-all" class="btn-clear-all">Delete All</button>
                <div class="toolbar-icons">
                    <div class="toolbar-icon draggable-icon" data-type="room" title="Room">
                        <span class="icon-svg icon-room" aria-hidden="true"></span>
                        <span>ROOM</span>
                    </div>
                    <div class="toolbar-icon draggable-icon" data-type="aircon" title="Aircon">
                        <span class="icon-svg icon-aircon" aria-hidden="true"></span>
                        <span>Aircon</span>
                    </div>
                    <div class="toolbar-icon draggable-icon" data-type="fan" title="Fan">
                        <span class="icon-svg icon-fan" aria-hidden="true"></span>
                        <span>Fan</span>
                    </div>
                    <div class="toolbar-icon draggable-icon" data-type="light" title="Light">
                        <span class="icon-svg icon-light" aria-hidden="true"></span>
                        <span>Light</span>
                    </div>
                </div>
            </div>

            <!-- Deployment Canvas: SVG lines layer (z-index 1) then canvas (z-index 2, transparent) so lines show through -->
            <div class="canvas-wrapper" id="canvas-wrapper">
                <svg id="canvas-lines" class="canvas-lines" aria-hidden="true"></svg>
                <div class="canvas" id="deployment-canvas">
                <p class="canvas-hint" id="canvas-hint">Drag PLC devices from the left panel here. Then drag Room / Appliances from the toolbar onto devices / rooms.</p>
                </div>
            </div>
        </main>

        <!-- Right: Guidelines (rules) sidebar -->
        <aside class="req-panel" id="req-panel">
            <h2>Guidelines</h2>
            <ol class="req-list">
                <li>Drag items from the top bar; they remain available as templates.</li>
                <li>Each PLC device can host a limited number of rooms and appliances based on its switch value.</li>
                <li>Rooms must be placed inside a PLC device.</li>
                <li>Appliances must be placed inside a room.</li>
                <li>Single-click appliances to toggle ON/OFF.</li>
                <li>Double-click appliances or rooms to see properties.</li>
                <li>Canvas layout is persisted to the database (devices → rooms → appliances).</li>
            </ol>
            <p class="req-notes">Use this panel as a quick reminder of the deployment rules.</p>
        </aside>
    </div>

    <!-- Add Device Modal -->
    <div class="modal" id="add-device-modal" aria-hidden="true">
        <div class="modal-content">
            <h3>Add New PLC Device</h3>
            <form id="add-device-form">
                <label>Name <input type="text" name="name" value="test" required maxlength="50"></label>
                <label>IP Address <input type="text" name="IP_address" value="192.168.1.1" required placeholder="192.168.1.xxx" maxlength="15"></label>
                <label>Firmware <input type="text" name="fw" value="fw1" placeholder="fw#" maxlength="20"></label>
                <label>Switch (capacity)
                    <select name="switch">
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="4">4</option>
                        <option value="8">8</option>
                        <option value="16">16</option>
                    </select>
                </label>
                <label>Power <input type="number" name="power" value="0" step="0.01" min="0"></label>
                <div class="form-actions">
                    <button type="submit" class="btn-primary">Add Device</button>
                    <button type="button" class="btn-secondary" id="btn-cancel-add">Cancel</button>
                </div>
            </form>
        </div>
    </div>

    <!-- Add Appliance modal (shown when dropping Aircon/Fan/Light onto a room) -->
    <div class="modal" id="add-appliance-modal" aria-hidden="true">
        <div class="modal-content">
            <h3>Add Appliance</h3>
            <form id="add-appliance-form">
                <label>Appliance Name <input type="text" name="appliance_name" placeholder="e.g. Aircon, Fan, Light" required maxlength="50"></label>
                <label>Power (W) <input type="number" name="power" step="0.01" min="0" placeholder="Watts" required></label>
                <label>HP <input type="number" name="hp" step="0.01" min="0" placeholder="Horsepower" required></label>
                <label>Current (A) <input type="number" name="current" step="0.01" min="0" placeholder="Amps" required></label>
                <div class="form-actions">
                    <button type="submit" class="btn-primary">Add Appliance</button>
                    <button type="button" class="btn-secondary" id="btn-cancel-add-appliance">Cancel</button>
                </div>
            </form>
        </div>
    </div>

    <!-- Add Room modal (shown when dropping a Room onto a device) -->
    <div class="modal" id="add-room-modal" aria-hidden="true">
        <div class="modal-content">
            <h3>Add Room</h3>
            <form id="add-room-form">
                <label>Room No / Name <input type="text" name="roomnoname" placeholder="e.g. ROOMNO. 1 or Room 101" required maxlength="50"></label>
                <label>Building No <input type="text" name="bldgno" placeholder="e.g. BLDG A or CTE" maxlength="20"></label>
                <div class="form-actions">
                    <button type="submit" class="btn-primary">Add Room</button>
                    <button type="button" class="btn-secondary" id="btn-cancel-add-room">Cancel</button>
                </div>
            </form>
        </div>
    </div>

    <!-- Device Details modal -->
    <div class="modal" id="device-details-modal" aria-hidden="true">
        <div class="modal-content">
            <h3>Device Details</h3>
            <div id="device-details-content"></div>
            <button type="button" class="btn-secondary" id="btn-close-device-details">Close</button>
        </div>
    </div>

    <!-- Room Details modal (shown on double-clicking a room chip) -->
    <div class="modal" id="room-details-modal" aria-hidden="true">
        <div class="modal-content">
            <h3>Room Details</h3>
            <div id="room-details-content"></div>
            <button type="button" class="btn-secondary" id="btn-close-room-details">Close</button>
        </div>
    </div>

    <div class="modal" id="appliance-props-modal" aria-hidden="true">
        <div class="modal-content">
            <h3>Appliance Properties (PLCdeployment)</h3>
            <div id="appliance-props-content"></div>
            <button type="button" class="btn-secondary" id="btn-close-props">Close</button>
        </div>
    </div>

    <script src="script.js"></script>
</body>
</html>
