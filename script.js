/**
 * PLC Device Deployment System - Frontend Logic
 * Drag-and-drop: toolbar icons (copies), devices from sidebar, rooms onto devices, appliances onto rooms.
 * Uses native HTML5 Drag and Drop API.
 */

(function () {
    'use strict';

    // --- State ---
    const state = {
        devices: [],           // from API
        rooms: [],            // from get_rooms.php (for room panel data)
        deployments: [],      // from get_deployments.php
        selectedRoomEl: null,
        selectedDeviceEl: null,
        pendingRoomDevice: null,
        pendingAppliance: null,
        canvasLayout: [],     // { deviceId, deviceIp, switch: n, rooms: [ { roomId, roomnoname, bldgno, appliances: [] } ] }
    };

    const LAYOUT_STORAGE_KEY = 'plc_canvas_layout';

    const DOM = {
        deviceList: document.getElementById('device-list'),
        deviceLoading: document.getElementById('device-loading'),
        canvasWrapper: document.getElementById('canvas-wrapper'),
        canvas: document.getElementById('deployment-canvas'),
        canvasLines: document.getElementById('canvas-lines'),
        canvasHint: document.getElementById('canvas-hint'),
        iconToolbar: document.getElementById('icon-toolbar'),
        roomPanelContent: document.getElementById('room-panel-content'),
        appliancePanelContent: document.getElementById('appliance-panel-content'),
        addDeviceModal: document.getElementById('add-device-modal'),
        addDeviceForm: document.getElementById('add-device-form'),
        btnAddDevice: document.getElementById('btn-add-device'),
        btnCancelAdd: document.getElementById('btn-cancel-add'),
        btnSave: document.getElementById('btn-save'),
        btnLoad: document.getElementById('btn-load'),
        btnClearAll: document.getElementById('btn-clear-all'),
        appliancePropsModal: document.getElementById('appliance-props-modal'),
        appliancePropsContent: document.getElementById('appliance-props-content'),
        btnCloseProps: document.getElementById('btn-close-props'),
        addRoomModal: document.getElementById('add-room-modal'),
        addRoomForm: document.getElementById('add-room-form'),
        btnCancelAddRoom: document.getElementById('btn-cancel-add-room'),
        addApplianceModal: document.getElementById('add-appliance-modal'),
        addApplianceForm: document.getElementById('add-appliance-form'),
        btnCancelAddAppliance: document.getElementById('btn-cancel-add-appliance'),
        deviceDetailsModal: document.getElementById('device-details-modal'),
        deviceDetailsContent: document.getElementById('device-details-content'),
        btnCloseDeviceDetails: document.getElementById('btn-close-device-details'),
        roomDetailsModal: document.getElementById('room-details-modal'),
        roomDetailsContent: document.getElementById('room-details-content'),
        btnCloseRoomDetails: document.getElementById('btn-close-room-details'),
    };
    let alertToastTimer = null;

    function showApplianceStatusAlert(message, status) {
        let toast = document.getElementById('appliance-status-alert');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'appliance-status-alert';
            toast.className = 'appliance-status-alert';
            document.body.appendChild(toast);
        }
        toast.classList.remove('is-on', 'is-off', 'is-visible');
        toast.textContent = message;
        toast.classList.add(status === 'ON' ? 'is-on' : 'is-off', 'is-visible');

        if (alertToastTimer) {
            clearTimeout(alertToastTimer);
        }
        alertToastTimer = setTimeout(() => {
            toast.classList.remove('is-visible');
        }, 1800);
    }

    let capacityToastTimer = null;
    function showCapacityLimitAlert(message) {
        let toast = document.getElementById('capacity-limit-alert');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'capacity-limit-alert';
            toast.className = 'capacity-limit-alert';
            document.body.appendChild(toast);
        }
        toast.classList.remove('is-visible');
        toast.textContent = message;
        toast.classList.add('is-visible');
        if (capacityToastTimer) clearTimeout(capacityToastTimer);
        capacityToastTimer = setTimeout(() => {
            toast.classList.remove('is-visible');
        }, 2000);
    }

    // --- Switch capacity rules: max rooms <= switch, total appliances <= switch ---
    function getDeviceCapacity(deviceId) {
        const dev = state.devices.find(d => d.device_id == deviceId);
        return dev ? parseInt(dev.switch, 10) : 0;
    }

    function getCanvasDeviceData(deviceEl) {
        const deviceId = deviceEl.getAttribute('data-device-id');
        const deviceIp = deviceEl.getAttribute('data-device-ip');
        const switchCap = parseInt(deviceEl.getAttribute('data-device-switch') || '1', 10);
        const rooms = [];
        deviceEl.querySelectorAll('.canvas-room').forEach(roomEl => {
            const roomId = roomEl.getAttribute('data-room-id');
            const roomnoname = roomEl.getAttribute('data-room-name') || 'Room';
            const bldgno = roomEl.getAttribute('data-room-bldg') || '';
            const appliances = [];
            roomEl.querySelectorAll('.appliance-chip').forEach(chip => {
                appliances.push({
                    appliance_id: parseInt(chip.getAttribute('data-appliance-id') || '0', 10),
                    appliance_name: chip.getAttribute('data-appliance-name') || chip.textContent.trim(),
                    type: chip.getAttribute('data-appliance-type') || 'light',
                    power: parseFloat(chip.getAttribute('data-power') || '0'),
                    hp: parseFloat(chip.getAttribute('data-hp') || '0'),
                    current: parseFloat(chip.getAttribute('data-current') || '0'),
                    status: chip.classList.contains('status-on') ? 'ON' : 'OFF',
                });
            });
            rooms.push({ roomId, roomnoname, bldgno, appliances });
        });
        return { deviceId, deviceIp, switch: switchCap, rooms };
    }

    /** Capture current canvas layout (device sizes, room and appliance positions) for persistence. */
    function getCanvasLayoutFromDOM() {
        const layout = {};
        if (!DOM.canvas) return layout;
        DOM.canvas.querySelectorAll('.canvas-device').forEach(deviceEl => {
            const ip = deviceEl.getAttribute('data-device-ip');
            if (!ip) return;
            const rect = deviceEl.getBoundingClientRect();
            const roomPositions = [];
            const appliancePositions = [];
            deviceEl.querySelectorAll('.canvas-room').forEach(roomEl => {
                roomPositions.push({
                    left: parseFloat(roomEl.style.left) || 0,
                    top: parseFloat(roomEl.style.top) || 0,
                });
                const apps = [];
                roomEl.querySelectorAll('.appliance-chip').forEach(chip => {
                    apps.push({
                        left: parseFloat(chip.style.left) || 0,
                        top: parseFloat(chip.style.top) || 0,
                    });
                });
                appliancePositions.push(apps);
            });
            layout[ip] = {
                width: rect.width,
                height: rect.height,
                rooms: roomPositions,
                appliances: appliancePositions,
            };
        });
        return layout;
    }

    function countRoomsAndAppliances(deviceEl) {
        const rooms = deviceEl.querySelectorAll('.canvas-room');
        let totalApps = 0;
        rooms.forEach(r => { totalApps += r.querySelectorAll('.appliance-chip').length; });
        return { roomCount: rooms.length, applianceCount: totalApps };
    }

    function canAddRoom(deviceEl) {
        const cap = parseInt(deviceEl.getAttribute('data-device-switch') || '1', 10);
        const { roomCount, applianceCount } = countRoomsAndAppliances(deviceEl);
        return roomCount < cap;
    }

    function canAddAppliance(roomEl) {
        const deviceEl = roomEl.closest('.canvas-device');
        if (!deviceEl) return false;
        const cap = parseInt(deviceEl.getAttribute('data-device-switch') || '1', 10);
        const { roomCount, applianceCount } = countRoomsAndAppliances(deviceEl);
        return applianceCount < cap;
    }

    // --- Fetch APIs ---
    function fetchDevices() {
        return fetch('get_devices.php')
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    state.devices = data.devices;
                    renderDeviceList();
                }
            })
            .catch(err => {
                if (DOM.deviceLoading) DOM.deviceLoading.textContent = 'Failed to load devices.';
                console.error(err);
            });
    }

    function fetchRooms() {
        return fetch('get_rooms.php')
            .then(r => r.json())
            .then(data => { if (data.success) state.rooms = data.rooms; })
            .catch(() => {});
    }

    function fetchDeployments() {
        return fetch('get_deployments.php')
            .then(r => r.json())
            .then(data => { if (data.success) state.deployments = data.deployments; })
            .catch(() => {});
    }

    // --- Restore layout from previously saved deployments ---
    function restoreLayoutFromState() {
        if (!state.deployments || state.deployments.length === 0) return;
        let savedLayout = {};
        try {
            const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
            if (raw) savedLayout = JSON.parse(raw);
        } catch (e) { /* ignore */ }
        // Group deployments by device IP, then by room_id
        const devicesByIp = {};
        state.devices.forEach(d => { devicesByIp[d.IP_address] = d; });

        const grouped = {};
        state.deployments.forEach(dep => {
            const ip = dep.ipaddress || dep.room_ip;
            const device = devicesByIp[ip];
            if (!device) return;
            if (!grouped[ip]) {
                grouped[ip] = { device, rooms: {} };
            }
            const roomKey = String(dep.room_id);
            if (!grouped[ip].rooms[roomKey]) {
                grouped[ip].rooms[roomKey] = {
                    room_id: dep.room_id,
                    roomnoname: dep.roomnoname || 'Room',
                    bldgno: dep.bldgno || '',
                    appliances: [],
                };
            }
            grouped[ip].rooms[roomKey].appliances.push(dep);
        });

        Object.keys(grouped).forEach(ip => {
            const info = grouped[ip];
            const dev = info.device;
            // Create empty device on canvas (do not call addDeviceToCanvas - that would trigger restoreDeviceDeployment and duplicate rooms)
            if (!DOM.canvas.querySelector(`.canvas-device[data-device-id="${dev.device_id}"]`)) {
                createEmptyDeviceOnCanvas({
                    device_id: dev.device_id,
                    IP_address: dev.IP_address,
                    name: dev.name,
                    switch: dev.switch,
                    power: dev.power,
                    fw: dev.fw != null ? dev.fw : '',
                });
                const sidebarCard = DOM.deviceList.querySelector(`.device-card[data-device-id="${dev.device_id}"]`);
                if (sidebarCard) sidebarCard.remove();
            }
            const deviceEl = DOM.canvas.querySelector(`.canvas-device[data-device-id="${dev.device_id}"]`);
            if (!deviceEl) return;

            const layoutForDevice = savedLayout[dev.IP_address];
            if (layoutForDevice && typeof layoutForDevice.width === 'number' && typeof layoutForDevice.height === 'number') {
                const w = Math.max(400, Math.min(1600, layoutForDevice.width));
                const h = Math.max(280, Math.min(900, layoutForDevice.height));
                deviceEl.style.setProperty('width', w + 'px');
                deviceEl.style.setProperty('flex', '0 0 ' + w + 'px');
                deviceEl.style.setProperty('min-width', w + 'px');
                deviceEl.style.setProperty('height', h + 'px');
            }

            // Add rooms and appliances from state (only place that adds rooms on init - avoids duplicate with restoreDeviceDeployment)
            const roomsContainer = deviceEl.querySelector('.rooms-container');
            if (!roomsContainer) return;
            const roomList = Object.values(info.rooms).sort((a, b) => (a.room_id - b.room_id));
            roomList.forEach((roomInfo, idx) => {
                const roomIndex = idx + 1;
                const roomLabel = (roomInfo.roomnoname && String(roomInfo.roomnoname).trim()) ? String(roomInfo.roomnoname).trim() : ('ROOMNO. ' + roomIndex);
                const roomEl = document.createElement('div');
                roomEl.className = 'canvas-room';
                roomEl.setAttribute('data-room-id', roomInfo.room_id);
                roomEl.setAttribute('data-room-name', roomLabel);
                roomEl.setAttribute('data-room-bldg', roomInfo.bldgno || '');
                roomEl.innerHTML = `
                    <div class="room-header">
                        <span class="room-title">${escapeHtml(roomLabel)}</span>
                        <button type="button" class="btn-remove-room" title="Remove room" aria-label="Remove room">×</button>
                    </div>
                    <div class="drop-hint">Drop appliances here</div>
                    <div class="appliances-container"></div>
                `;
                roomEl.addEventListener('dragover', onRoomDragover);
                roomEl.addEventListener('dragleave', onRoomDragleave);
                roomEl.addEventListener('drop', onRoomDrop);
                roomEl.addEventListener('click', () => selectRoom(roomEl));
                roomEl.addEventListener('dblclick', () => showRoomDetails(roomEl));
                const btnRemove = roomEl.querySelector('.btn-remove-room');
                if (btnRemove) {
                    btnRemove.addEventListener('click', e => {
                        e.stopPropagation();
                        removeRoom(roomEl);
                    });
                }
                const savedRoomPos = layoutForDevice && layoutForDevice.rooms && layoutForDevice.rooms[idx];
                const pos = savedRoomPos && typeof savedRoomPos.left === 'number' && typeof savedRoomPos.top === 'number'
                    ? { left: savedRoomPos.left, top: savedRoomPos.top }
                    : getNextRoomPosition(roomsContainer);
                roomEl.style.left = pos.left + 'px';
                roomEl.style.top = pos.top + 'px';
                roomsContainer.appendChild(roomEl);
                makeRoomDraggable(roomEl);

                const appsContainer = roomEl.querySelector('.appliances-container');
                const savedAppPositions = layoutForDevice && layoutForDevice.appliances && layoutForDevice.appliances[idx];
                roomInfo.appliances.forEach((dep, aIdx) => {
                    const chip = document.createElement('div');
                    chip.className = 'appliance-chip' + (String(dep.status || '').toUpperCase() === 'ON' ? ' status-on' : '');
                    chip.setAttribute('data-appliance-id', dep.appliance_id);
                    chip.setAttribute('data-appliance-name', dep.appliance_name);
                    chip.setAttribute('data-appliance-type', (dep.appliance_name || '').toLowerCase().includes('fan') ? 'fan' :
                        (dep.appliance_name || '').toLowerCase().includes('light') ? 'light' :
                        (dep.appliance_name || '').toLowerCase().includes('air') ? 'aircon' : 'light');
                    chip.setAttribute('data-power', dep.power || 0);
                    chip.setAttribute('data-hp', dep.hp || 0);
                    chip.setAttribute('data-current', dep.current || 0);
                    chip.title = dep.appliance_name || 'Appliance';
                    const type = chip.getAttribute('data-appliance-type');
                    chip.innerHTML = `
                        <span class="icon-appliance icon-appliance-${type}"></span>
                        <button type="button" class="btn-remove-appliance" title="Remove" aria-label="Remove"></button>
                    `;
                    chip.querySelector('.btn-remove-appliance').addEventListener('click', e => {
                        e.stopPropagation();
                        chip.remove();
                        renderDeviceRoomTable(deviceEl);
                        initDeviceChart(deviceEl);
                        updateRoomPanelIfSelected(roomEl);
                        scheduleUpdateConnectingLines();
                    });
                    chip.addEventListener('click', e => {
                        if (e.target.classList.contains('btn-remove-appliance')) return;
                        if (e.detail === 2) showApplianceProps(chip);
                        else toggleAppliance(chip);
                    });
                    const savedAppPos = savedAppPositions && savedAppPositions[aIdx] && typeof savedAppPositions[aIdx].left === 'number' && typeof savedAppPositions[aIdx].top === 'number';
                    const aPos = savedAppPos
                        ? { left: savedAppPositions[aIdx].left, top: savedAppPositions[aIdx].top }
                        : getNextAppliancePosition(appsContainer);
                    chip.style.left = aPos.left + 'px';
                    chip.style.top = aPos.top + 'px';
                    appsContainer.appendChild(chip);
                    makeApplianceChipDraggable(chip);
                });
            });
            renderDeviceRoomTable(deviceEl);
            initDeviceChart(deviceEl);
        });
        scheduleUpdateConnectingLines();
    }

    // --- Render device list (left sidebar) ---
    function createDeviceCard(dev) {
        const card = document.createElement('div');
        card.className = 'device-card';
        card.draggable = true;
        card.setAttribute('data-device-id', dev.device_id);
        card.setAttribute('data-device-ip', dev.IP_address);
        card.setAttribute('data-device-name', dev.name);
        card.setAttribute('data-device-switch', dev.switch);
        card.setAttribute('data-device-power', dev.power);
        card.setAttribute('data-device-fw', dev.fw != null ? dev.fw : '');
        card.innerHTML = `
            <div class="device-id">#${dev.device_id}</div>
            <div class="device-ip">${escapeHtml(dev.IP_address)}</div>
            <div class="device-meta">
                <span>Switch: ${dev.switch}</span>
                <span>Power: ${dev.power}</span>
            </div>
        `;
        attachDeviceCardDrag(card);
        return card;
    }

    function renderDeviceList() {
        if (!DOM.deviceList) return;
        if (DOM.deviceLoading) DOM.deviceLoading.remove();
        DOM.deviceList.innerHTML = '';
        state.devices.forEach(dev => {
            const card = createDeviceCard(dev);
            DOM.deviceList.appendChild(card);
        });
    }

    function escapeHtml(s) {
        if (s == null) return '';
        const div = document.createElement('div');
        div.textContent = s;
        return div.innerHTML;
    }

    // --- Drag: device from sidebar (copy device onto canvas) ---
    function attachDeviceCardDrag(card) {
        card.addEventListener('dragstart', e => {
            e.dataTransfer.setData('application/plc-device', JSON.stringify({
                device_id: card.getAttribute('data-device-id'),
                IP_address: card.getAttribute('data-device-ip'),
                name: card.getAttribute('data-device-name'),
                switch: card.getAttribute('data-device-switch'),
                power: card.getAttribute('data-device-power'),
                fw: card.getAttribute('data-device-fw') || '',
            }));
            e.dataTransfer.effectAllowed = 'copy';
        });
    }

    // --- Toolbar: drag copies (room / aircon / fan / light) ---
    function initToolbarDrag() {
        DOM.iconToolbar.querySelectorAll('.draggable-icon').forEach(icon => {
            icon.addEventListener('dragstart', e => {
                const type = icon.getAttribute('data-type') || 'room';
                e.dataTransfer.setData('application/plc-toolbar', type);
                e.dataTransfer.effectAllowed = 'copy';
            });
        });
    }

    // --- Canvas: drop zone for devices (only canvas area) ---
    function initCanvasDrops() {
        DOM.canvas.addEventListener('dragover', e => {
            e.preventDefault();
            const isDevice = e.dataTransfer.types.includes('application/plc-device');
            const isToolbar = e.dataTransfer.types.includes('application/plc-toolbar');
            if (isDevice || isToolbar) e.dataTransfer.dropEffect = 'copy';
        });

        DOM.canvas.addEventListener('drop', e => {
            e.preventDefault();
            const deviceData = e.dataTransfer.getData('application/plc-device');
            if (deviceData) {
                const data = JSON.parse(deviceData);
                // Only allow one visual instance of the device on the canvas
                if (!DOM.canvas.querySelector(`.canvas-device[data-device-id="${data.device_id}"]`)) {
                    addDeviceToCanvas(data, e.clientX, e.clientY);
                    // Remove the device from the sidebar once deployed
                    const sidebarCard = DOM.deviceList.querySelector(`.device-card[data-device-id="${data.device_id}"]`);
                    if (sidebarCard) {
                        sidebarCard.remove();
                    }
                }
            }
        });
    }

    /** Creates empty device card on canvas (no rooms). Used by both init restore and drop. */
    function createEmptyDeviceOnCanvas(data) {
        if (DOM.canvasHint) DOM.canvasHint.style.display = 'none';
        const wrap = document.createElement('div');
        wrap.className = 'canvas-device';
        wrap.draggable = true;
        wrap.setAttribute('data-device-id', data.device_id);
        wrap.setAttribute('data-device-ip', data.IP_address);
        wrap.setAttribute('data-device-switch', data.switch);
        wrap.setAttribute('data-device-name', data.name || ('Device ' + data.device_id));
        wrap.setAttribute('data-device-power', data.power != null ? data.power : '0');
        wrap.setAttribute('data-device-fw', (data.fw != null ? data.fw : '') || '');
        const deviceLabel = (data.name && data.name.trim()) ? data.name : ('4KL' + data.device_id);
        wrap.innerHTML = `
            <div class="canvas-device-content">
                <div class="device-header">
                    <div class="device-title">
                        <span class="device-id-label">DEVICE ID: ${escapeHtml(deviceLabel)}</span>
                        <span class="device-ip-label">IP: ${escapeHtml(data.IP_address)}</span>
                    </div>
                    <div class="device-header-actions">
                        <button type="button" class="btn-details-device" title="View device details">Details</button>
                        <button type="button" class="btn-remove-device" title="Remove device from canvas">Remove</button>
                        <button type="button" class="btn-clear-device" title="Delete device">Delete</button>
                    </div>
                </div>
                <div class="rooms-container"></div>
                <div class="device-chart-wrap">
                    <div class="device-chart-title">MTUT</div>
                    <div class="device-chart-container"><canvas></canvas></div>
                </div>
            </div>
            <div class="canvas-device-resize-handle" title="Drag to resize"></div>
        `;
        const headerEl = wrap.querySelector('.device-header');
        if (headerEl) {
            headerEl.draggable = true;
            headerEl.addEventListener('dragstart', e => {
                // Don't start device drag when interacting with header buttons
                if (e.target.closest('.btn-details-device') || e.target.closest('.btn-remove-device') || e.target.closest('.btn-clear-device')) {
                    e.preventDefault();
                }
            });
        }
        initDeviceCardResize(wrap);
        const roomsContainer = wrap.querySelector('.rooms-container');
        if (roomsContainer) {
            roomsContainer.addEventListener('scroll', scheduleUpdateConnectingLines);
        }
        wrap.querySelector('.btn-details-device').addEventListener('click', e => {
            e.stopPropagation();
            showDeviceDetails(wrap);
        });
        wrap.querySelector('.btn-remove-device').addEventListener('click', e => {
            e.stopPropagation();
            clearDeviceFromCanvas(wrap);
        });
        wrap.querySelector('.btn-clear-device').addEventListener('click', e => {
            e.stopPropagation();
            deleteDevice(wrap);
        });
        wrap.addEventListener('dragstart', e => {
            if (e.target.closest('.canvas-device-resize-handle')) {
                e.preventDefault();
                return;
            }
            e.dataTransfer.setData('application/plc-deployed-device', JSON.stringify({
                device_id: data.device_id
            }));
            e.dataTransfer.effectAllowed = 'move';
        });
        wrap.addEventListener('dragover', onDeviceDragover);
        wrap.addEventListener('dragleave', onDeviceDragleave);
        wrap.addEventListener('drop', onDeviceDrop);
        DOM.canvas.appendChild(wrap);
        renderDeviceRoomTable(wrap);
        initDeviceChart(wrap);
        return wrap;
    }

    function initDeviceCardResize(deviceEl) {
        const handle = deviceEl.querySelector('.canvas-device-resize-handle');
        if (!handle) return;
        const minW = 400;
        const hardMaxW = 1600;
        const minH = 280;
        const maxH = 900;
        let startX = 0, startY = 0, startW = 0, startH = 0;
        function onMove(e) {
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            // Clamp width so the device cannot grow beyond the visible canvas area,
            // which prevents it from visually overlapping the sidebars.
            let dynamicMaxW = hardMaxW;
            if (DOM.canvasWrapper) {
                const wrapperRect = DOM.canvasWrapper.getBoundingClientRect();
                // Leave a small margin for canvas padding / gaps.
                dynamicMaxW = Math.min(hardMaxW, Math.max(minW, wrapperRect.width - 48));
            }
            const w = Math.max(minW, Math.min(dynamicMaxW, startW + dx));
            const h = Math.max(minH, Math.min(maxH, startH + dy));
            deviceEl.style.setProperty('width', w + 'px');
            deviceEl.style.setProperty('flex', '0 0 ' + w + 'px');
            deviceEl.style.setProperty('min-width', w + 'px');
            deviceEl.style.setProperty('height', h + 'px');
            scheduleUpdateConnectingLines();
        }
        function onUp() {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        }
        handle.addEventListener('mousedown', e => {
            e.preventDefault();
            e.stopPropagation();
            startX = e.clientX;
            startY = e.clientY;
            startW = deviceEl.getBoundingClientRect().width;
            startH = deviceEl.getBoundingClientRect().height;
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    }

    function addDeviceToCanvas(data, x, y) {
        const wrap = createEmptyDeviceOnCanvas(data);
        // Restore saved rooms/appliances from DB when user drops a device (e.g. after remove then drop again)
        restoreDeviceDeployment(wrap);
        scheduleUpdateConnectingLines();
    }

    /** Restore one device's rooms and appliances from DB (used when dropping a device that was previously saved). */
    function restoreDeviceDeployment(deviceEl) {
        const deviceIp = deviceEl.getAttribute('data-device-ip');
        if (!deviceIp) return;
        let savedLayout = {};
        try {
            const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
            if (raw) savedLayout = JSON.parse(raw);
        } catch (e) { /* ignore */ }
        const layoutForDevice = savedLayout[deviceIp];
        fetch('get_deployments.php')
            .then(r => r.json())
            .then(data => {
                if (!data.success || !data.deployments) return;
                const deps = data.deployments.filter(d => (d.ipaddress || d.room_ip) === deviceIp);
                if (deps.length === 0) return;
                if (layoutForDevice && typeof layoutForDevice.width === 'number' && typeof layoutForDevice.height === 'number') {
                    const w = Math.max(400, Math.min(1600, layoutForDevice.width));
                    const h = Math.max(280, Math.min(900, layoutForDevice.height));
                    deviceEl.style.setProperty('width', w + 'px');
                    deviceEl.style.setProperty('flex', '0 0 ' + w + 'px');
                    deviceEl.style.setProperty('min-width', w + 'px');
                    deviceEl.style.setProperty('height', h + 'px');
                }
                const rooms = {};
                deps.forEach(dep => {
                    const key = String(dep.room_id);
                    if (!rooms[key]) {
                        rooms[key] = {
                            room_id: dep.room_id,
                            roomnoname: dep.roomnoname || 'Room',
                            bldgno: dep.bldgno || '',
                            appliances: [],
                        };
                    }
                    rooms[key].appliances.push(dep);
                });
                const roomList = Object.values(rooms).sort((a, b) => a.room_id - b.room_id);
                const roomsContainer = deviceEl.querySelector('.rooms-container');
                if (!roomsContainer) return;
                roomList.forEach((roomInfo, idx) => {
                    const roomIndex = idx + 1;
                    const roomLabel = (roomInfo.roomnoname && String(roomInfo.roomnoname).trim()) ? String(roomInfo.roomnoname).trim() : ('ROOMNO. ' + roomIndex);
                    const roomEl = document.createElement('div');
                    roomEl.className = 'canvas-room';
                    roomEl.setAttribute('data-room-id', roomInfo.room_id);
                    roomEl.setAttribute('data-room-name', roomLabel);
                    roomEl.setAttribute('data-room-bldg', roomInfo.bldgno || '');
                    roomEl.innerHTML = `
                        <div class="room-header">
                            <span class="room-title">${escapeHtml(roomLabel)}</span>
                            <button type="button" class="btn-remove-room" title="Remove room" aria-label="Remove room">×</button>
                        </div>
                        <div class="drop-hint">Drop appliances here</div>
                        <div class="appliances-container"></div>
                    `;
                    roomEl.addEventListener('dragover', onRoomDragover);
                    roomEl.addEventListener('dragleave', onRoomDragleave);
                    roomEl.addEventListener('drop', onRoomDrop);
                    roomEl.addEventListener('click', () => selectRoom(roomEl));
                    roomEl.addEventListener('dblclick', () => showRoomDetails(roomEl));
                    const btnRemove = roomEl.querySelector('.btn-remove-room');
                    if (btnRemove) {
                        btnRemove.addEventListener('click', e => {
                            e.stopPropagation();
                            removeRoom(roomEl);
                        });
                    }
                    const savedRoomPos = layoutForDevice && layoutForDevice.rooms && layoutForDevice.rooms[idx];
                    const pos = savedRoomPos && typeof savedRoomPos.left === 'number' && typeof savedRoomPos.top === 'number'
                        ? { left: savedRoomPos.left, top: savedRoomPos.top }
                        : getNextRoomPosition(roomsContainer);
                    roomEl.style.left = pos.left + 'px';
                    roomEl.style.top = pos.top + 'px';
                    roomsContainer.appendChild(roomEl);
                    makeRoomDraggable(roomEl);
                    const appsContainer = roomEl.querySelector('.appliances-container');
                    const savedAppPositions = layoutForDevice && layoutForDevice.appliances && layoutForDevice.appliances[idx];
                    roomInfo.appliances.forEach((dep, aIdx) => {
                        const chip = document.createElement('div');
                        chip.className = 'appliance-chip' + (String(dep.status || '').toUpperCase() === 'ON' ? ' status-on' : '');
                        chip.setAttribute('data-appliance-id', dep.appliance_id);
                        chip.setAttribute('data-appliance-name', dep.appliance_name);
                        chip.setAttribute('data-appliance-type', (dep.appliance_name || '').toLowerCase().includes('fan') ? 'fan' :
                            (dep.appliance_name || '').toLowerCase().includes('light') ? 'light' :
                            (dep.appliance_name || '').toLowerCase().includes('air') ? 'aircon' : 'light');
                        chip.setAttribute('data-power', dep.power || 0);
                        chip.setAttribute('data-hp', dep.hp || 0);
                        chip.setAttribute('data-current', dep.current || 0);
                        chip.title = dep.appliance_name || 'Appliance';
                        const type = chip.getAttribute('data-appliance-type');
                        chip.innerHTML = `
                            <span class="icon-appliance icon-appliance-${type}"></span>
                            <button type="button" class="btn-remove-appliance" title="Remove" aria-label="Remove"></button>
                        `;
                        chip.querySelector('.btn-remove-appliance').addEventListener('click', e => {
                            e.stopPropagation();
                            chip.remove();
                            renderDeviceRoomTable(deviceEl);
                            updateRoomPanelIfSelected(roomEl);
                            scheduleUpdateConnectingLines();
                        });
                        chip.addEventListener('click', e => {
                            if (e.target.classList.contains('btn-remove-appliance')) return;
                            if (e.detail === 2) showApplianceProps(chip);
                            else toggleAppliance(chip);
                        });
                        const savedAppPos = savedAppPositions && savedAppPositions[aIdx] && typeof savedAppPositions[aIdx].left === 'number' && typeof savedAppPositions[aIdx].top === 'number';
                        const aPos = savedAppPos
                            ? { left: savedAppPositions[aIdx].left, top: savedAppPositions[aIdx].top }
                            : getNextAppliancePosition(appsContainer);
                        chip.style.left = aPos.left + 'px';
                        chip.style.top = aPos.top + 'px';
                        appsContainer.appendChild(chip);
                        makeApplianceChipDraggable(chip);
                    });
                });
                renderDeviceRoomTable(deviceEl);
                scheduleUpdateConnectingLines();
            })
            .catch(() => {});
    }

    function showDeviceDetails(deviceEl) {
        const id = deviceEl.getAttribute('data-device-id');
        const name = deviceEl.getAttribute('data-device-name') || '';
        const ip = deviceEl.getAttribute('data-device-ip') || '';
        const fw = deviceEl.getAttribute('data-device-fw') || '';
        const switchVal = deviceEl.getAttribute('data-device-switch') || '';
        const power = deviceEl.getAttribute('data-device-power') || '';
        const dev = state.devices.find(d => String(d.device_id) === String(id));
        const fwDisplay = (fw !== '' ? fw : (dev && dev.fw != null ? dev.fw : '-'));
        if (!DOM.deviceDetailsContent) return;
        DOM.deviceDetailsContent.innerHTML = `
            <div class="detail-row"><span>Device ID</span><span>${escapeHtml(id)}</span></div>
            <div class="detail-row"><span>Name</span><span>${escapeHtml(name)}</span></div>
            <div class="detail-row"><span>IP Address</span><span>${escapeHtml(ip)}</span></div>
            <div class="detail-row"><span>Firmware</span><span>${escapeHtml(fwDisplay)}</span></div>
            <div class="detail-row"><span>Switch (capacity)</span><span>${escapeHtml(switchVal)}</span></div>
            <div class="detail-row"><span>Power</span><span>${escapeHtml(power)}</span></div>
        `;
        if (DOM.deviceDetailsModal) {
            DOM.deviceDetailsModal.classList.add('is-open');
            DOM.deviceDetailsModal.setAttribute('aria-hidden', 'false');
        }
    }

    function closeDeviceDetailsModal() {
        if (DOM.deviceDetailsModal) {
            DOM.deviceDetailsModal.classList.remove('is-open');
            DOM.deviceDetailsModal.setAttribute('aria-hidden', 'true');
        }
    }

    function clearDeviceFromCanvas(deviceEl) {
        const deviceId = deviceEl.getAttribute('data-device-id');
        const deviceIp = deviceEl.getAttribute('data-device-ip');
        // Delete this device's rooms and appliances from the database
        if (deviceIp) {
            fetch('clear_deployment.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deviceIp: deviceIp }),
            }).catch(() => {});
        }
        deviceEl.remove();
        const dev = state.devices.find(d => String(d.device_id) === String(deviceId));
        if (dev && DOM.deviceList && !DOM.deviceList.querySelector(`.device-card[data-device-id="${deviceId}"]`)) {
            DOM.deviceList.appendChild(createDeviceCard(dev));
        }
        if (DOM.canvas && !DOM.canvas.querySelector('.canvas-device')) {
            if (DOM.canvasHint) DOM.canvasHint.style.display = '';
        }
        scheduleUpdateConnectingLines();
    }

    /** Permanently delete a device from the system (DB + UI). */
    function deleteDevice(deviceEl) {
        const deviceId = deviceEl.getAttribute('data-device-id');
        const deviceIp = deviceEl.getAttribute('data-device-ip');
        if (!deviceId && !deviceIp) return;
        if (!confirm('Delete this device from the system? This will remove its rooms and appliances.')) return;
        fetch('delete_device.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ deviceId, deviceIp }),
        })
            .then(r => r.json())
            .then(data => {
                if (!data || data.success === false) {
                    alert('Delete failed: ' + (data && data.error ? data.error : 'Unknown error'));
                    return;
                }
                // Remove from canvas
                deviceEl.remove();
                // Remove from sidebar list
                if (DOM.deviceList && deviceId) {
                    const card = DOM.deviceList.querySelector(`.device-card[data-device-id="${deviceId}"]`);
                    if (card) card.remove();
                }
                // Remove from in-memory state
                if (deviceId) {
                    state.devices = state.devices.filter(d => String(d.device_id) !== String(deviceId));
                }
                if (DOM.canvas && !DOM.canvas.querySelector('.canvas-device')) {
                    if (DOM.canvasHint) DOM.canvasHint.style.display = '';
                }
                scheduleUpdateConnectingLines();
            })
            .catch(() => {
                alert('Delete request failed');
            });
    }

    /** Clear all rooms and appliances from this device; device stays on canvas. */
    function clearDeviceRoomsOnly(deviceEl) {
        const deviceIp = deviceEl.getAttribute('data-device-ip');
        if (deviceIp) {
            fetch('clear_deployment.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ deviceIp: deviceIp }),
            }).catch(() => {});
        }
        const roomsContainer = deviceEl.querySelector('.rooms-container');
        if (roomsContainer) {
            roomsContainer.innerHTML = '';
        }
        scheduleUpdateConnectingLines();
    }

    // --- Connecting lines: Device → Room → Appliance ---
    function getConnectorPoint(el, placement) {
        if (!DOM.canvasWrapper || !el) return null;
        const wr = DOM.canvasWrapper.getBoundingClientRect();
        const er = el.getBoundingClientRect();
        const borderX = (DOM.canvasWrapper.clientLeft || 0);
        const borderY = (DOM.canvasWrapper.clientTop || 0);
        let x = er.left - wr.left - borderX + er.width / 2;
        let y = er.top - wr.top - borderY;
        if (placement === 'bottom-center') y += er.height;
        else if (placement === 'top-center') { /* x already center, y is top */ }
        return { x, y };
    }

    function getRoomToApplianceStart(roomEl) {
        // Use the outer room chip itself so the line starts at the chip's bottom edge.
        return getConnectorPoint(roomEl, 'bottom-center');
    }

    function updateConnectingLines() {
        const wrapper = DOM.canvasWrapper;
        const svg = DOM.canvasLines;
        if (!wrapper || !svg || !DOM.canvas) return;
        const devices = DOM.canvas.querySelectorAll('.canvas-device');
        if (devices.length === 0) {
            svg.innerHTML = '';
            return;
        }
        const w = Math.max(1, wrapper.offsetWidth || 0);
        const h = Math.max(1, wrapper.offsetHeight || 0);
        svg.setAttribute('width', w);
        svg.setAttribute('height', h);
        svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

        const wrRect = wrapper.getBoundingClientRect();
        const borderX = wrapper.clientLeft || 0;
        const borderY = wrapper.clientTop || 0;

        const segments = [];
        devices.forEach(deviceEl => {
            const devRect = deviceEl.getBoundingClientRect();
            const devLeft = devRect.left - wrRect.left - borderX;
            const devRight = devRect.right - wrRect.left - borderX;
            const devTop = devRect.top - wrRect.top - borderY;
            const devBottom = devRect.bottom - wrRect.top - borderY;

            // If the device card is small (user has minimized it), do not draw any connectors for it.
            // This makes the lines effectively disappear when the device is collapsed.
            if (devRect.height < 420 || devRect.width < 520) {
                return;
            }
            deviceEl.querySelectorAll('.canvas-room').forEach(roomEl => {
                const fromRoom = getRoomToApplianceStart(roomEl);
                roomEl.querySelectorAll('.appliance-chip').forEach(chip => {
                    const toApp = getConnectorPoint(chip, 'top-center');
                    if (!fromRoom || !toApp) return;
                    // Only draw connectors if both endpoints are inside the *device card* bounds.
                    // This avoids lines appearing outside when content is scrolled or the device is resized smaller.
                    const fromInsideDevice =
                        fromRoom.x >= devLeft &&
                        fromRoom.x <= devRight &&
                        fromRoom.y >= devTop &&
                        fromRoom.y <= devBottom;
                    const toInsideDevice =
                        toApp.x >= devLeft &&
                        toApp.x <= devRight &&
                        toApp.y >= devTop &&
                        toApp.y <= devBottom;
                    if (!fromInsideDevice || !toInsideDevice) return;
                    const midX = (fromRoom.x + toApp.x) / 2;
                    const ctrlY = fromRoom.y + (toApp.y - fromRoom.y) * 0.5;
                    const d = `M ${fromRoom.x} ${fromRoom.y} Q ${midX} ${ctrlY} ${toApp.x} ${toApp.y}`;
                    const isOn = chip.classList.contains('status-on');
                    segments.push({ d, fromRoom, toApp, isOn });
                });
            });
        });

        const strokeOff = '#94a3b8';
        const strokeOn = '#059669';
        const pathEls = segments.map(({ d, fromRoom, toApp, isOn }) => {
            const stroke = isOn ? strokeOn : strokeOff;
            const strokeWidth = isOn ? 2.5 : 2;
            return `<path d="${d}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round" fill="none" class="connector-line ${isOn ? 'connector-on' : 'connector-off'}"/>
            <circle cx="${fromRoom.x}" cy="${fromRoom.y}" r="3" fill="${stroke}" class="connector-dot"/>
            <circle cx="${toApp.x}" cy="${toApp.y}" r="3" fill="${stroke}" class="connector-dot"/>`;
        }).join('');
        svg.innerHTML = pathEls;
    }

    let _connectingLinesTimer = null;
    function scheduleUpdateConnectingLines() {
        if (_connectingLinesTimer) clearTimeout(_connectingLinesTimer);
        _connectingLinesTimer = setTimeout(() => {
            _connectingLinesTimer = null;
            updateConnectingLines();
        }, 50);
    }

    function renderDeviceRoomTable(deviceEl) {
        // Room summary table has been removed from the UI.
        // This function is kept as a no-op so existing calls remain safe.
    }

    function showRoomDetails(roomEl) {
        if (!roomEl || !DOM.roomDetailsModal || !DOM.roomDetailsContent) return;
        const name = roomEl.getAttribute('data-room-name') || 'Room';
        const bldg = roomEl.getAttribute('data-room-bldg') || '-';
        const units = roomEl.querySelectorAll('.appliance-chip').length;
        DOM.roomDetailsContent.innerHTML = `
            <p><strong>Room:</strong> ${escapeHtml(name)}</p>
            <p><strong>Building:</strong> ${escapeHtml(bldg)}</p>
            <p><strong>Units:</strong> ${units}</p>
        `;
        DOM.roomDetailsModal.classList.add('is-open');
        DOM.roomDetailsModal.setAttribute('aria-hidden', 'false');
    }

    function getDeviceTotalPower(deviceEl) {
        if (!deviceEl) return 0;
        let total = 0;
        // Sum power of ON appliances in this device.
        deviceEl.querySelectorAll('.appliance-chip').forEach(chip => {
            if (!chip.classList.contains('status-on')) return;
            const raw = chip.getAttribute('data-power');
            const val = raw != null && raw !== '' ? parseFloat(raw) : 0;
            if (!Number.isNaN(val)) total += val;
        });
        // Fallback: if no ON appliances, use the device's configured power, if any.
        if (total === 0) {
            const rawDev = deviceEl.getAttribute('data-device-power');
            const devVal = rawDev != null && rawDev !== '' ? parseFloat(rawDev) : 0;
            if (!Number.isNaN(devVal)) total = devVal;
        }
        return total;
    }

    const MTUT_LABELS = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'];

    function applyMTUTData(deviceEl, labels, values) {
        const chart = deviceEl._mtutChart;
        if (!chart) return;
        chart.data.labels = labels;
        chart.data.datasets[0].data = values;
        chart.update();
    }

    function initDeviceChart(deviceEl) {
        if (!deviceEl || typeof Chart === 'undefined') return;
        const canvasEl = deviceEl.querySelector('.device-chart-container canvas');
        if (!canvasEl) return;

        const deviceId = deviceEl.getAttribute('data-device-id');
        const fallbackLabels = MTUT_LABELS.slice();
        const fallbackPower = getDeviceTotalPower(deviceEl);
        const fallbackValues = fallbackLabels.map(() => fallbackPower);

        const existing = deviceEl._mtutChart;
        if (existing) {
            applyMTUTData(deviceEl, fallbackLabels, fallbackValues);
            return;
        }

        const chart = new Chart(canvasEl.getContext('2d'), {
            type: 'bar',
            data: {
                labels: fallbackLabels,
                datasets: [{
                    label: 'Power (W)',
                    data: fallbackValues,
                    backgroundColor: 'rgba(109, 40, 217, 0.7)',
                    borderColor: '#6d28d9',
                    borderWidth: 1,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        display: true,
                        title: { display: true, text: 'Time (24h)' },
                    },
                    y: {
                        beginAtZero: true,
                        display: true,
                        title: { display: true, text: 'Power (W)' },
                    },
                },
                plugins: { legend: { display: false } },
            },
        });
        deviceEl._mtutChart = chart;

        if (deviceId) {
            fetch('get_device_power.php?device_id=' + encodeURIComponent(deviceId))
                .then(function (r) { return r.json(); })
                .then(function (data) {
                    if (data.success && Array.isArray(data.labels) && Array.isArray(data.values)) {
                        applyMTUTData(deviceEl, data.labels, data.values);
                    }
                })
                .catch(function () {});
        }
    }

    // Allow dropping a deployed device back into the sidebar list to remove it from canvas
    function initSidebarDeviceRemoval() {
        if (!DOM.deviceList) return;

        DOM.deviceList.addEventListener('dragover', e => {
            if (e.dataTransfer.types.includes('application/plc-deployed-device')) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            }
        });

        DOM.deviceList.addEventListener('drop', e => {
            e.preventDefault();
            const dataStr = e.dataTransfer.getData('application/plc-deployed-device');
            if (!dataStr) return;
            const data = JSON.parse(dataStr);
            const deviceId = data.device_id;
            // Remove from canvas
            const canvasDevice = DOM.canvas.querySelector(`.canvas-device[data-device-id="${deviceId}"]`);
            if (canvasDevice) {
                canvasDevice.remove();
            }
            // Recreate card in sidebar if not already there
            if (!DOM.deviceList.querySelector(`.device-card[data-device-id="${deviceId}"]`)) {
                const dev = state.devices.find(d => String(d.device_id) === String(deviceId));
                if (dev) {
                    const card = createDeviceCard(dev);
                    DOM.deviceList.appendChild(card);
                }
            }
        });
    }

    function onDeviceDragover(e) {
        e.preventDefault();
        const type = e.dataTransfer.getData('application/plc-toolbar');
        if (type === 'room' && canAddRoom(e.currentTarget)) {
            e.currentTarget.classList.add('drag-over');
            e.dataTransfer.dropEffect = 'copy';
        }
    }

    function onDeviceDragleave(e) {
        if (!e.currentTarget.contains(e.relatedTarget)) {
            e.currentTarget.classList.remove('drag-over');
        }
    }

    function onDeviceDrop(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');
        const type = e.dataTransfer.getData('application/plc-toolbar');
        if (type !== 'room') return;
        if (!canAddRoom(e.currentTarget)) {
            const cap = parseInt(e.currentTarget.getAttribute('data-device-switch') || '1', 10);
            showCapacityLimitAlert('Switch capacity reached: max ' + cap + ' room(s) per device.');
            return;
        }
        openAddRoomForm(e.currentTarget);
    }

    function openAddRoomForm(deviceEl) {
        state.pendingRoomDevice = deviceEl;
        if (DOM.addRoomForm) {
            DOM.addRoomForm.reset();
            const roomIndex = deviceEl.querySelectorAll('.canvas-room').length + 1;
            const nameInput = DOM.addRoomForm.querySelector('input[name="roomnoname"]');
            if (nameInput) nameInput.placeholder = 'e.g. ROOMNO. ' + roomIndex + ' or Room 101';
        }
        if (DOM.addRoomModal) {
            DOM.addRoomModal.classList.add('is-open');
            DOM.addRoomModal.setAttribute('aria-hidden', 'false');
        }
    }

    function closeAddRoomForm() {
        state.pendingRoomDevice = null;
        if (DOM.addRoomModal) {
            DOM.addRoomModal.classList.remove('is-open');
            DOM.addRoomModal.setAttribute('aria-hidden', 'true');
        }
    }

    function addRoomToDevice(deviceEl, opts) {
        const roomsContainer = deviceEl.querySelector('.rooms-container');
        const roomId = 'new-' + Date.now();
        const roomIndex = deviceEl.querySelectorAll('.canvas-room').length + 1;
        const roomName = (opts && opts.roomnoname && String(opts.roomnoname).trim()) ? String(opts.roomnoname).trim() : ('ROOMNO. ' + roomIndex);
        const bldgNo = (opts && opts.bldgno != null) ? String(opts.bldgno).trim() : '';
        const roomEl = document.createElement('div');
        roomEl.className = 'canvas-room';
        roomEl.setAttribute('data-room-id', roomId);
        roomEl.setAttribute('data-room-name', roomName);
        roomEl.setAttribute('data-room-bldg', bldgNo);
        roomEl.innerHTML = `
            <div class="room-header">
                <span class="room-title">${escapeHtml(roomName)}</span>
                <button type="button" class="btn-remove-room" title="Remove room" aria-label="Remove room">×</button>
            </div>
            <div class="drop-hint">Drop appliances here</div>
            <div class="appliances-container"></div>
        `;
        roomEl.addEventListener('dragover', onRoomDragover);
        roomEl.addEventListener('dragleave', onRoomDragleave);
        roomEl.addEventListener('drop', onRoomDrop);
        roomEl.addEventListener('click', () => selectRoom(roomEl));
        roomEl.addEventListener('dblclick', () => showRoomDetails(roomEl));
        const btnRemove = roomEl.querySelector('.btn-remove-room');
        if (btnRemove) {
            btnRemove.addEventListener('click', e => {
                e.stopPropagation();
                removeRoom(roomEl);
            });
        }
        const pos = getNextRoomPosition(roomsContainer);
        roomEl.style.left = pos.left + 'px';
        roomEl.style.top = pos.top + 'px';
        roomsContainer.appendChild(roomEl);
        makeRoomDraggable(roomEl);
        renderDeviceRoomTable(deviceEl);
        selectRoom(roomEl);
        scheduleUpdateConnectingLines();
    }

    function onRoomDragover(e) {
        e.preventDefault();
        const type = e.dataTransfer.getData('application/plc-toolbar');
        const isAppliance = type === 'aircon' || type === 'fan' || type === 'light';
        if (isAppliance && canAddAppliance(e.currentTarget)) {
            e.currentTarget.classList.add('drag-over');
            e.dataTransfer.dropEffect = 'copy';
        }
    }

    function onRoomDragleave(e) {
        if (!e.currentTarget.contains(e.relatedTarget)) {
            e.currentTarget.classList.remove('drag-over');
        }
    }

    function onRoomDrop(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');
        const type = e.dataTransfer.getData('application/plc-toolbar');
        if (type !== 'aircon' && type !== 'fan' && type !== 'light') return;
        if (!canAddAppliance(e.currentTarget)) {
            const deviceEl = e.currentTarget.closest('.canvas-device');
            const cap = deviceEl ? parseInt(deviceEl.getAttribute('data-device-switch') || '1', 10) : 1;
            showCapacityLimitAlert('Switch capacity reached: max ' + cap + ' appliance(s) per device.');
            return;
        }
        openAddApplianceForm(e.currentTarget, type);
    }

    // --- Free-position drag: rooms and appliance chips (pointer drag) ---
    const ROOM_GAP = 14;
    const ROOM_STEP_X = 140;
    const ROOM_STEP_Y = 52;
    const CHIP_STEP_X = 100;
    const CHIP_STEP_Y = 44;

    function getNextRoomPosition(roomsContainer) {
        const rooms = roomsContainer.querySelectorAll('.canvas-room');
        const cols = Math.max(1, Math.floor((roomsContainer.offsetWidth - 40) / ROOM_STEP_X));
        const i = rooms.length;
        return { left: 10 + (i % cols) * ROOM_STEP_X, top: 10 + Math.floor(i / cols) * ROOM_STEP_Y };
    }

    function getNextAppliancePosition(container) {
        const chips = container.querySelectorAll('.appliance-chip');
        const i = chips.length;
        const cols = 4;
        return { left: (i % cols) * CHIP_STEP_X, top: Math.floor(i / cols) * CHIP_STEP_Y };
    }

    function makeRoomDraggable(roomEl) {
        const container = roomEl.parentElement;
        if (!container || !container.classList.contains('rooms-container')) return;
        roomEl.addEventListener('mousedown', function startDrag(e) {
            if (e.button !== 0 || e.target.closest('.appliance-chip')) return;
            e.preventDefault();
            const baseX = parseFloat(roomEl.style.left) || 0;
            const baseY = parseFloat(roomEl.style.top) || 0;
            const startX = e.clientX;
            const startY = e.clientY;
            function onMove(ev) {
                roomEl.style.left = (baseX + ev.clientX - startX) + 'px';
                roomEl.style.top = (baseY + ev.clientY - startY) + 'px';
                scheduleUpdateConnectingLines();
            }
            function onUp() {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            }
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    }

    function makeApplianceChipDraggable(chip) {
        const container = chip.parentElement;
        if (!container || !container.classList.contains('appliances-container')) return;
        chip.addEventListener('mousedown', function startDrag(e) {
            if (e.button !== 0 || e.target.closest('.btn-remove-appliance')) return;
            e.preventDefault();
            const baseX = parseFloat(chip.style.left) || 0;
            const baseY = parseFloat(chip.style.top) || 0;
            const startX = e.clientX;
            const startY = e.clientY;
            function onMove(ev) {
                chip.style.left = (baseX + ev.clientX - startX) + 'px';
                chip.style.top = (baseY + ev.clientY - startY) + 'px';
                scheduleUpdateConnectingLines();
            }
            function onUp() {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            }
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    }

    function removeRoom(roomEl) {
        const deviceEl = roomEl.closest('.canvas-device');
        if (!deviceEl) {
            roomEl.remove();
            scheduleUpdateConnectingLines();
            return;
        }
        // If this room is currently selected, clear selection
        if (state.selectedRoomEl === roomEl) {
            state.selectedRoomEl = null;
            if (DOM.roomPanelContent) DOM.roomPanelContent.innerHTML = '<p class="no-selection">No room selected.</p>';
            if (DOM.appliancePanelContent) DOM.appliancePanelContent.innerHTML = '<p class="no-selection">No appliances in this room.</p>';
        }
        roomEl.remove();
        renderDeviceRoomTable(deviceEl);
        scheduleUpdateConnectingLines();
    }

    const applianceLabels = { aircon: 'Aircon', fan: 'Fan', light: 'Light' };

    function getNextNumericApplianceId(deviceEl) {
        if (!deviceEl) return Date.now();
        let maxId = 0;
        deviceEl.querySelectorAll('.appliance-chip').forEach(chip => {
            const raw = chip.getAttribute('data-appliance-id') || '';
            const n = parseInt(raw, 10);
            if (!Number.isNaN(n)) maxId = Math.max(maxId, n);
        });
        return maxId + 1;
    }

    /** 1-based switch channel for PLC (matches switchappx.php s1: '1', '2', …). Order = DOM order on device. */
    function getApplianceSwitchNumber(chip) {
        const deviceEl = chip && chip.closest('.canvas-device');
        if (!deviceEl) return '1';
        const chips = deviceEl.querySelectorAll('.appliance-chip');
        for (let i = 0; i < chips.length; i++) {
            if (chips[i] === chip) return String(i + 1);
        }
        return '1';
    }

    /** 1-based switch channel for PLC (matches switchappx.php s1: '1', '2', …). Order = DOM order on device. */
    function getApplianceSwitchNumber(chip) {
        const deviceEl = chip && chip.closest('.canvas-device');
        if (!deviceEl) return '1';
        const chips = deviceEl.querySelectorAll('.appliance-chip');
        for (let i = 0; i < chips.length; i++) {
            if (chips[i] === chip) return String(i + 1);
        }
        return '1';
    }

    /** 1-based switch channel for PLC (matches switchappx.php s1: '1', '2', …). Order = DOM order on device. */
    function getApplianceSwitchNumber(chip) {
        const deviceEl = chip && chip.closest('.canvas-device');
        if (!deviceEl) return '1';
        const chips = deviceEl.querySelectorAll('.appliance-chip');
        for (let i = 0; i < chips.length; i++) {
            if (chips[i] === chip) return String(i + 1);
        }
        return '1';
    }

    function openAddApplianceForm(roomEl, type) {
        state.pendingAppliance = { roomEl: roomEl, type: type };
        if (DOM.addApplianceForm) {
            DOM.addApplianceForm.reset();
            const nameInput = DOM.addApplianceForm.querySelector('input[name="appliance_name"]');
            if (nameInput) nameInput.value = applianceLabels[type] || type;
        }
        if (DOM.addApplianceModal) {
            DOM.addApplianceModal.classList.add('is-open');
            DOM.addApplianceModal.setAttribute('aria-hidden', 'false');
        }
    }

    function closeAddApplianceForm() {
        state.pendingAppliance = null;
        if (DOM.addApplianceModal) {
            DOM.addApplianceModal.classList.remove('is-open');
            DOM.addApplianceModal.setAttribute('aria-hidden', 'true');
        }
    }

    function addApplianceToRoom(roomEl, type, opts) {
        const container = roomEl.querySelector('.appliances-container');
        const deviceEl = roomEl.closest('.canvas-device');
        const id = getNextNumericApplianceId(deviceEl);
        const name = (opts && opts.appliance_name && String(opts.appliance_name).trim()) ? String(opts.appliance_name).trim() : (applianceLabels[type] || type);
        const power = (opts && opts.power != null) ? String(opts.power) : '0';
        const hp = (opts && opts.hp != null) ? String(opts.hp) : '0';
        const current = (opts && opts.current != null) ? String(opts.current) : '0';
        const chip = document.createElement('div');
        chip.className = 'appliance-chip';
        chip.setAttribute('data-appliance-id', String(id));
        chip.setAttribute('data-appliance-name', name);
        chip.setAttribute('data-appliance-type', type);
        chip.setAttribute('data-power', power);
        chip.setAttribute('data-hp', hp);
        chip.setAttribute('data-current', current);
        chip.innerHTML = `
            <span class="icon-appliance icon-appliance-${type}"></span>
            <button type="button" class="btn-remove-appliance" title="Remove" aria-label="Remove"></button>
        `;
        chip.title = name;
        chip.querySelector('.btn-remove-appliance').addEventListener('click', e => {
            e.stopPropagation();
            chip.remove();
            if (deviceEl) {
                renderDeviceRoomTable(deviceEl);
                initDeviceChart(deviceEl);
            }
            updateRoomPanelIfSelected(roomEl);
            scheduleUpdateConnectingLines();
        });
        chip.addEventListener('click', e => {
            if (e.target.classList.contains('btn-remove-appliance')) return;
            if (e.detail === 2) showApplianceProps(chip);
            else toggleAppliance(chip);
        });
        const aPos = getNextAppliancePosition(container);
        chip.style.left = aPos.left + 'px';
        chip.style.top = aPos.top + 'px';
        container.appendChild(chip);
        makeApplianceChipDraggable(chip);
        if (deviceEl) {
            renderDeviceRoomTable(deviceEl);
            initDeviceChart(deviceEl);
        }
        updateRoomPanelIfSelected(roomEl);
        scheduleUpdateConnectingLines();
    }

    function toggleAppliance(chip) {
        const wasOn = chip.classList.contains('status-on');
        const deviceEl = chip.closest('.canvas-device');
        const roomEl = chip.closest('.canvas-room');
        const roomName = roomEl ? (roomEl.getAttribute('data-room-name') || 'Room') : 'Room';
        const name = chip.getAttribute('data-appliance-name') || 'Appliance';
        const applianceId = chip.getAttribute('data-appliance-id') || '-';
        const deviceIp = deviceEl ? (deviceEl.getAttribute('data-device-ip') || '-') : '-';
        let nextStatus = 'OFF';
        if (wasOn) {
            chip.classList.add('animate-off');
            chip.classList.remove('status-on');
            chip.setAttribute('data-status', 'OFF');
            nextStatus = 'OFF';
            const onAnimationEnd = () => {
                chip.classList.remove('animate-off');
                chip.removeEventListener('animationend', onAnimationEnd);
            };
            chip.addEventListener('animationend', onAnimationEnd);
        } else {
            chip.classList.remove('animate-off');
            chip.classList.add('status-on');
            chip.setAttribute('data-status', 'ON');
            nextStatus = 'ON';
        }
        showApplianceStatusAlert(
            'ID: ' + applianceId + ' | ' + name + ' | Room: ' + roomName + ' | IP: ' + deviceIp + ' | Status: ' + nextStatus,
            nextStatus
        );
        if (deviceEl) {
            initDeviceChart(deviceEl);
        }
        if (roomEl) {
            updateRoomPanelIfSelected(roomEl);
        }
        scheduleUpdateConnectingLines();
        fetchData(deviceIp, getApplianceSwitchNumber(chip), nextStatus);
    }

    function selectRoom(roomEl) {
        if (state.selectedRoomEl) state.selectedRoomEl.style.outline = '';
        state.selectedRoomEl = roomEl;
        roomEl.style.outline = '2px solid var(--accent)';
        updateRoomPanel(roomEl);
        updateAppliancePanel(roomEl);
    }

    function updateRoomPanel(roomEl) {
        if (!DOM.roomPanelContent) return;
        const name = roomEl.getAttribute('data-room-name') || 'Room';
        const bldg = roomEl.getAttribute('data-room-bldg') || '-';
        const allChips = roomEl.querySelectorAll('.appliance-chip');
        const airconCount = Array.from(allChips).filter(c => c.getAttribute('data-appliance-type') === 'aircon').length;
        DOM.roomPanelContent.innerHTML = `
            <div class="detail-row"><span>Room No</span><span>${escapeHtml(name)}</span></div>
            <div class="detail-row"><span>Building No</span><span>${escapeHtml(bldg)}</span></div>
            <div class="detail-row"><span>Aircon Units</span><span>${airconCount}</span></div>
        `;
    }

    function updateAppliancePanel(roomEl) {
        if (!DOM.appliancePanelContent) return;
        const chips = roomEl.querySelectorAll('.appliance-chip');
        if (chips.length === 0) {
            DOM.appliancePanelContent.innerHTML = '<p class="no-selection">No appliances in this room.</p>';
            return;
        }
        DOM.appliancePanelContent.innerHTML = Array.from(chips).map(chip => {
            const name = chip.getAttribute('data-appliance-name') || 'Appliance';
            const status = chip.classList.contains('status-on') ? 'ON' : 'OFF';
            return `<div class="appliance-list-item" data-chip-id="${escapeHtml(chip.getAttribute('data-appliance-id'))}">
                <span>${escapeHtml(name)}</span>
                <span class="status-${status.toLowerCase()}">${status}</span>
            </div>`;
        }).join('');
    }

    function updateRoomPanelIfSelected(roomEl) {
        if (state.selectedRoomEl === roomEl) {
            updateRoomPanel(roomEl);
            updateAppliancePanel(roomEl);
        }
    }

    function showApplianceProps(chip) {
        const deviceEl = chip.closest('.canvas-device');
        const roomEl = chip.closest('.canvas-room');
        DOM.appliancePropsContent.innerHTML = `
            <div class="prop-row"><span>Appliance ID</span><span>${escapeHtml(chip.getAttribute('data-appliance-id'))}</span></div>
            <div class="prop-row"><span>Appliance Name</span><span>${escapeHtml(chip.getAttribute('data-appliance-name'))}</span></div>
            <div class="prop-row"><span>Power (W)</span><span>${chip.getAttribute('data-power') || '0'}</span></div>
            <div class="prop-row"><span>HP</span><span>${chip.getAttribute('data-hp') || '0'}</span></div>
            <div class="prop-row"><span>Current (A)</span><span>${chip.getAttribute('data-current') || '0'}</span></div>
            <div class="prop-row"><span>Status</span><span>${chip.classList.contains('status-on') ? 'ON' : 'OFF'}</span></div>
            <div class="prop-row"><span>IP (device)</span><span>${escapeHtml(deviceEl ? deviceEl.getAttribute('data-device-ip') : '-')}</span></div>
        `;
        DOM.appliancePropsModal.classList.add('is-open');
    }

    function persistDeploymentForDevice(deviceEl) {
        const payload = getCanvasDeviceData(deviceEl);
        const body = {
            deviceId: payload.deviceId,
            deviceIp: payload.deviceIp,
            rooms: payload.rooms.map(r => ({
                roomId: /^\d+$/.test(String(r.roomId)) ? parseInt(r.roomId, 10) : 0,
                roomnoname: r.roomnoname,
                bldgno: r.bldgno,
                appliances: r.appliances.map((a, i) => ({
                    appliance_id: parseInt(a.appliance_id, 10) || (i + 1),
                    appliance_name: a.appliance_name,
                    power: a.power,
                    hp: a.hp,
                    current: a.current,
                    status: a.status,
                })),
            })),
        };
        return fetch('save_deployment.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        })
            .then(r => r.json())
            .then(res => {
                // Update client room IDs so next save does UPDATE not INSERT (avoids duplicate rooms)
                if (res.success && res.roomIds && Array.isArray(res.roomIds)) {
                    const roomEls = deviceEl.querySelectorAll('.canvas-room');
                    res.roomIds.forEach((id, i) => {
                        if (roomEls[i]) {
                            roomEls[i].setAttribute('data-room-id', id);
                            /* Keep existing data-room-name and room title (roomnoname) - do not overwrite with ROOMNO. 1 */
                        }
                    });
                }
                return res;
            })
            .catch(() => ({ success: false, error: 'Network error calling save_deployment.php' }));
    }

    // --- Add Device modal ---
    function openAddDeviceModal() {
        DOM.addDeviceModal.classList.add('is-open');
        DOM.addDeviceModal.setAttribute('aria-hidden', 'false');
    }

    function closeAddDeviceModal() {
        DOM.addDeviceModal.classList.remove('is-open');
        DOM.addDeviceModal.setAttribute('aria-hidden', 'true');
    }

    function handleAddDeviceSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const fd = new FormData(form);
        fetch('add_device.php', { method: 'POST', body: fd })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    closeAddDeviceModal();
                    fetchDevices();
                } else {
                    alert(data.error || 'Failed to add device');
                }
            })
            .catch(() => alert('Request failed'));
    }

    // --- Save: persist all deployed devices (rooms + appliances) to DB ---
    function saveLayout() {
        if (!DOM.canvas) return;
        const devices = DOM.canvas.querySelectorAll('.canvas-device');
        if (devices.length === 0) {
            alert('Nothing to save. Deploy at least one device on the canvas.');
            return;
        }
        const btn = DOM.btnSave;
        if (btn) btn.textContent = 'Saving…';
        const promises = Array.from(devices).map(deviceEl => persistDeploymentForDevice(deviceEl));
        Promise.all(promises).then(results => {
            const hasError = results.some(res => !res || res.success === false);
            if (btn) {
                if (hasError) {
                    btn.textContent = 'Error';
                    setTimeout(() => { btn.textContent = 'Save'; }, 2000);
                } else {
                    try {
                        const layout = getCanvasLayoutFromDOM();
                        localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
                    } catch (e) { /* ignore */ }
                    btn.remove();
                    DOM.btnSave = null;
                    const loadBtn = DOM.btnLoad;
                    if (loadBtn) {
                        loadBtn.remove();
                        DOM.btnLoad = null;
                    }
                }
            }
            if (hasError) {
                const first = results.find(r => r && r.success === false && r.error);
                if (first && first.error) alert('Save failed: ' + first.error);
            }
        }).catch(() => {
            if (btn) btn.textContent = 'Save';
            alert('Save request failed');
        });
    }

    // --- Load: fetch devices and deployments from DB, clear canvas, then restore layout ---
    function loadLayout() {
        const btn = DOM.btnLoad;
        if (btn) btn.textContent = 'Loading…';
        Promise.all([fetchDevices(), fetchRooms(), fetchDeployments()]).then(() => {
            if (!DOM.canvas) return;
            DOM.canvas.innerHTML = '';
            if (DOM.canvasHint) {
                DOM.canvasHint.style.display = '';
                DOM.canvas.appendChild(DOM.canvasHint);
            }
            renderDeviceList();
            restoreLayoutFromState();
            scheduleUpdateConnectingLines();
            if (btn) btn.textContent = 'Load';
        }).catch(() => {
            if (btn) btn.textContent = 'Load';
            alert('Load failed');
        });
    }

    // --- Clear All: TRUNCATE PLCdeployment, roomdeployment, PLCdevices; then clear canvas and refresh device list ---
    function clearAllCanvas() {
        if (!DOM.canvas) return;
        if (!confirm('Clear all devices, rooms, and appliances from the system? This cannot be undone.')) return;
        fetch('clear_all.php', { method: 'POST' })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    try { localStorage.removeItem(LAYOUT_STORAGE_KEY); } catch (e) { /* ignore */ }
                    DOM.canvas.innerHTML = '';
                    if (DOM.canvasHint) {
                        DOM.canvasHint.style.display = '';
                        DOM.canvas.appendChild(DOM.canvasHint);
                    }
                    state.devices = [];
                    if (DOM.deviceList) {
                        DOM.deviceList.innerHTML = '';
                        const p = document.createElement('p');
                        p.className = 'loading';
                        p.textContent = 'No devices. Add a device to get started.';
                        DOM.deviceList.appendChild(p);
                    }
                    fetchDevices();
                    scheduleUpdateConnectingLines();
                } else if (data.error) {
                    alert('Clear All failed: ' + data.error);
                }
            })
            .catch(() => alert('Clear All request failed'));
    }

    // --- Init ---
    function init() {
        // On initial load, just fetch devices/rooms and show an empty canvas.
        // Saved layouts are only restored when the user explicitly presses Load.
        Promise.all([fetchDevices(), fetchRooms()]).then(() => {
            initToolbarDrag();
            initCanvasDrops();
            initSidebarDeviceRemoval();
        });

        DOM.btnAddDevice.addEventListener('click', openAddDeviceModal);
        DOM.btnCancelAdd.addEventListener('click', closeAddDeviceModal);
        DOM.addDeviceForm.addEventListener('submit', handleAddDeviceSubmit);
        DOM.btnCloseProps.addEventListener('click', () => {
            DOM.appliancePropsModal.classList.remove('is-open');
        });
        if (DOM.btnCloseDeviceDetails) DOM.btnCloseDeviceDetails.addEventListener('click', closeDeviceDetailsModal);
        if (DOM.btnSave) DOM.btnSave.addEventListener('click', saveLayout);
        if (DOM.btnLoad) DOM.btnLoad.addEventListener('click', loadLayout);
        if (DOM.addRoomForm) DOM.addRoomForm.addEventListener('submit', handleAddRoomSubmit);
        if (DOM.btnCancelAddRoom) DOM.btnCancelAddRoom.addEventListener('click', closeAddRoomForm);
        if (DOM.addApplianceForm) DOM.addApplianceForm.addEventListener('submit', handleAddApplianceSubmit);
        if (DOM.btnCancelAddAppliance) DOM.btnCancelAddAppliance.addEventListener('click', closeAddApplianceForm);
        if (DOM.btnClearAll) DOM.btnClearAll.addEventListener('click', clearAllCanvas);
        if (DOM.btnCloseRoomDetails && DOM.roomDetailsModal) {
            DOM.btnCloseRoomDetails.addEventListener('click', () => {
                DOM.roomDetailsModal.classList.remove('is-open');
                DOM.roomDetailsModal.setAttribute('aria-hidden', 'true');
            });
        }
        window.addEventListener('resize', scheduleUpdateConnectingLines);
        window.addEventListener('scroll', scheduleUpdateConnectingLines, true);
        if (DOM.canvasWrapper) DOM.canvasWrapper.addEventListener('scroll', scheduleUpdateConnectingLines);
    }

    function handleAddRoomSubmit(e) {
        e.preventDefault();
        if (!state.pendingRoomDevice) return;
        const form = e.target;
        const roomnoname = (form.roomnoname && form.roomnoname.value) ? form.roomnoname.value.trim() : '';
        const bldgno = (form.bldgno && form.bldgno.value) ? form.bldgno.value.trim() : '';
        addRoomToDevice(state.pendingRoomDevice, {
            roomnoname: roomnoname || ('ROOMNO. ' + (state.pendingRoomDevice.querySelectorAll('.canvas-room').length + 1)),
            bldgno: bldgno,
        });
        closeAddRoomForm();
    }

    function handleAddApplianceSubmit(e) {
        e.preventDefault();
        if (!state.pendingAppliance) return;
        const form = e.target;
        const roomEl = state.pendingAppliance.roomEl;
        const type = state.pendingAppliance.type;
        const appliance_name = (form.appliance_name && form.appliance_name.value) ? form.appliance_name.value.trim() : '';
        const power = (form.power && form.power.value !== '') ? form.power.value.trim() : '';
        const hp = (form.hp && form.hp.value !== '') ? form.hp.value.trim() : '';
        const current = (form.current && form.current.value !== '') ? form.current.value.trim() : '';
        if (!appliance_name) {
            alert('Please enter Appliance Name.');
            return;
        }
        if (power === '') {
            alert('Please enter Power (W).');
            return;
        }
        if (hp === '') {
            alert('Please enter HP.');
            return;
        }
        if (current === '') {
            alert('Please enter Current (A).');
            return;
        }
        addApplianceToRoom(roomEl, type, {
            appliance_name: appliance_name || (applianceLabels[type] || type),
            power: power,
            hp: hp,
            current: current,
        });
        closeAddApplianceForm();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
