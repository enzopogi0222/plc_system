<?php
require_once 'db_connect.php';

// Get device_id from query string
if (!isset($_GET['device_id'])) {
    die('device_id is required.');
}

$device_id = (int) $_GET['device_id'];

// Fetch PLC device info
$deviceStmt = $mysqli->prepare(
    "SELECT device_id, name, IP_address, fw, switch, voltage, power, status, created_at
     FROM PLCdevices
     WHERE device_id = ?"
);
$deviceStmt->bind_param('i', $device_id);
$deviceStmt->execute();
$deviceResult = $deviceStmt->get_result();

if ($deviceResult->num_rows === 0) {
    die('PLC device not found.');
}

$device = $deviceResult->fetch_assoc();

// Fetch rooms for this device
$roomStmt = $mysqli->prepare(
    "SELECT room_id, roomnoname, bldgno, appliances, ipaddress, created_at
     FROM roomdeployment
     WHERE device_id = ?
     ORDER BY room_id ASC"
);
$roomStmt->bind_param('i', $device_id);
$roomStmt->execute();
$roomsResult = $roomStmt->get_result();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Rooms for PLC Device <?php echo htmlspecialchars($device['name']); ?></title>
    <link rel="stylesheet" href="css/styles.css">
</head>
<body>
<div class="container">
    <div class="top-bar">
        <h1>Rooms for PLC: <?php echo htmlspecialchars($device['name']); ?></h1>
        <a href="devices_list.php" class="button">&laquo; Back to Devices</a>
    </div>

    <h3>PLC Device Details</h3>
    <table>
        <tbody>
        <tr>
            <th>ID</th>
            <td><?php echo htmlspecialchars($device['device_id']); ?></td>
        </tr>
        <tr>
            <th>Name</th>
            <td><?php echo htmlspecialchars($device['name']); ?></td>
        </tr>
        <tr>
            <th>IP Address</th>
            <td><?php echo htmlspecialchars($device['IP_address']); ?></td>
        </tr>
        <tr>
            <th>Firmware</th>
            <td><?php echo htmlspecialchars($device['fw']); ?></td>
        </tr>
        <tr>
            <th>Switch</th>
            <td><?php echo htmlspecialchars($device['switch']); ?></td>
        </tr>
        <tr>
            <th>Voltage</th>
            <td><?php echo htmlspecialchars($device['voltage']); ?></td>
        </tr>
        <tr>
            <th>Power (W)</th>
            <td><?php echo htmlspecialchars($device['power']); ?></td>
        </tr>
        <tr>
            <th>Status</th>
            <td>
                <?php
                $status = strtoupper(trim($device['status']));
                $class = ($status === 'ON') ? 'status-on' : 'status-off';
                ?>
                <span class="<?php echo $class; ?>">
                    <?php echo htmlspecialchars($status); ?>
                </span>
            </td>
        </tr>
        <tr>
            <th>Created At</th>
            <td><?php echo htmlspecialchars($device['created_at']); ?></td>
        </tr>
        </tbody>
    </table>

    <h3 style="margin-top: 25px;">Rooms Deployed on this PLC</h3>

    <?php if ($roomsResult->num_rows > 0): ?>
        <table>
            <thead>
            <tr>
                <th>Room ID</th>
                <th>Room No.</th>
                <th>Building</th>
                <th># of Appliances</th>
                <th>Room IP Address</th>
                <th>Created At</th>
                <th>Actions</th>
            </tr>
            </thead>
            <tbody>
            <?php while ($room = $roomsResult->fetch_assoc()): ?>
                <tr>
                    <td><?php echo htmlspecialchars($room['room_id']); ?></td>
                    <td><?php echo htmlspecialchars($room['roomnoname']); ?></td>
                    <td><?php echo htmlspecialchars($room['bldgno']); ?></td>
                    <td><?php echo htmlspecialchars($room['appliances']); ?></td>
                    <td><?php echo htmlspecialchars($room['ipaddress']); ?></td>
                    <td><?php echo htmlspecialchars($room['created_at']); ?></td>
                    <td class="actions">
                        <a href="room_appliances.php?room_id=<?php echo urlencode($room['room_id']); ?>">
                            View Appliances
                        </a>
                    </td>
                </tr>
            <?php endwhile; ?>
            </tbody>
        </table>
    <?php else: ?>
        <p class="empty">No rooms found for this PLC device.</p>
    <?php endif; ?>

</div>
<script src="js/app.js"></script>
</body>
</html>
<?php
$roomsResult->free();
$deviceResult->free();
$roomStmt->close();
$deviceStmt->close();
$mysqli->close();
?>