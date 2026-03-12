<?php
require_once 'db_connect.php';


if (!isset($_GET['room_id'])) {
    die('room_id is required.');
}

$room_id = (int) $_GET['room_id'];

// Fetch room info together with its PLC device
$roomStmt = $mysqli->prepare(
    "SELECT r.room_id, r.device_id, r.roomnoname, r.bldgno, r.appliances,
            r.ipaddress, r.created_at AS room_created_at,
            d.name AS device_name, d.IP_address AS device_ip
     FROM roomdeployment r
     INNER JOIN PLCdevices d ON r.device_id = d.device_id
     WHERE r.room_id = ?"
);
$roomStmt->bind_param('i', $room_id);
$roomStmt->execute();
$roomResult = $roomStmt->get_result();

if ($roomResult->num_rows === 0) {
    die('Room not found.');
}

$room = $roomResult->fetch_assoc();

// Fetch appliances in this room
$applianceStmt = $mysqli->prepare(
    "SELECT deployment_id, appliance_name, appliance_id, voltage,
            ipaddress, power, hp, current_amps, status, created_at
     FROM PLCdeployment
     WHERE room_id = ?
     ORDER BY deployment_id ASC"
);
$applianceStmt->bind_param('i', $room_id);
$applianceStmt->execute();
$appliancesResult = $applianceStmt->get_result();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Appliances for Room <?php echo htmlspecialchars($room['roomnoname']); ?></title>
    <link rel="stylesheet" href="css/styles.css">
</head>
<body>
<div class="container">
    <div class="top-bar">
        <h1>Room Appliances</h1>
        <a href="device_rooms.php?device_id=<?php echo urlencode($room['device_id']); ?>" class="button">
            &laquo; Back to Rooms (<?php echo htmlspecialchars($room['device_name']); ?>)
        </a>
    </div>

    <h3>Room &amp; PLC Details</h3>
    <table>
        <tbody>
        <tr>
            <th>Room ID</th>
            <td><?php echo htmlspecialchars($room['room_id']); ?></td>
        </tr>
        <tr>
            <th>Room No.</th>
            <td><?php echo htmlspecialchars($room['roomnoname']); ?></td>
        </tr>
        <tr>
            <th>Building</th>
            <td><?php echo htmlspecialchars($room['bldgno']); ?></td>
        </tr>
        <tr>
            <th>Room IP Address</th>
            <td><?php echo htmlspecialchars($room['ipaddress']); ?></td>
        </tr>
        <tr>
            <th>Total Appliances (stored)</th>
            <td><?php echo htmlspecialchars($room['appliances']); ?></td>
        </tr>
        <tr>
            <th>PLC Device</th>
            <td><?php echo htmlspecialchars($room['device_name']); ?></td>
        </tr>
        <tr>
            <th>PLC IP</th>
            <td><?php echo htmlspecialchars($room['device_ip']); ?></td>
        </tr>
        <tr>
            <th>Room Created At</th>
            <td><?php echo htmlspecialchars($room['room_created_at']); ?></td>
        </tr>
        </tbody>
    </table>

    <h3 style="margin-top: 25px;">Appliances in this Room</h3>

    <?php if ($appliancesResult->num_rows > 0): ?>
        <table>
            <thead>
            <tr>
                <th>Deployment ID</th>
                <th>Appliance Name</th>
                <th>Appliance ID</th>
                <th>Voltage</th>
                <th>IP Address</th>
                <th>Power (W)</th>
                <th>HP</th>
                <th>Current (A)</th>
                <th>Status</th>
                <th>Created At</th>
            </tr>
            </thead>
            <tbody>
            <?php while ($appliance = $appliancesResult->fetch_assoc()): ?>
                <tr>
                    <td><?php echo htmlspecialchars($appliance['deployment_id']); ?></td>
                    <td><?php echo htmlspecialchars($appliance['appliance_name']); ?></td>
                    <td><?php echo htmlspecialchars($appliance['appliance_id']); ?></td>
                    <td><?php echo htmlspecialchars($appliance['voltage']); ?></td>
                    <td><?php echo htmlspecialchars($appliance['ipaddress']); ?></td>
                    <td><?php echo htmlspecialchars($appliance['power']); ?></td>
                    <td><?php echo htmlspecialchars($appliance['hp']); ?></td>
                    <td><?php echo htmlspecialchars($appliance['current_amps']); ?></td>
                    <td>
                        <?php
                        $status = strtoupper(trim($appliance['status']));
                        $class = ($status === 'ON') ? 'status-on' : 'status-off';
                        ?>
                        <span class="<?php echo $class; ?>">
                            <?php echo htmlspecialchars($status); ?>
                        </span>
                    </td>
                    <td><?php echo htmlspecialchars($appliance['created_at']); ?></td>
                </tr>
            <?php endwhile; ?>
            </tbody>
        </table>
    <?php else: ?>
        <p class="empty">No appliances found in this room.</p>
    <?php endif; ?>

</div>
<script src="js/app.js"></script>
</body>
</html>
<?php
$appliancesResult->free();
$roomResult->free();
$applianceStmt->close();
$roomStmt->close();
$mysqli->close();
?>