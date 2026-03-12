<?php
require_once 'db_connect.php';


$sql = "SELECT device_id, name, IP_address, fw, switch, voltage, power, status, created_at
        FROM PLCdevices
        ORDER BY device_id ASC";

$result = $mysqli->query($sql);

if (!$result) {
    die('Query error: ' . $mysqli->error);
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>PLC Devices List</title>
    <link rel="stylesheet" href="css/styles.css">
</head>
<body>
<div class="container">
    <div class="top-bar">
        <h1>PLC Devices</h1>
        <!-- Button handled by JS in js/app.js -->
        <a href="#" class="button" id="add-plc-btn">
            + Add PLC Device
        </a>
    </div>

    <?php if ($result->num_rows > 0): ?>
        <table>
            <thead>
            <tr>
                <th>ID</th>
                <th>Device Name</th>
                <th>IP Address</th>
                <th>Firmware</th>
                <th>Switch</th>
                <th>Voltage</th>
                <th>Power (W)</th>
                <th>Status</th>
                <th>Created At</th>
                <th>Actions</th>
            </tr>
            </thead>
            <tbody>
            <?php while ($row = $result->fetch_assoc()): ?>
                <tr>
                    <td><?php echo htmlspecialchars($row['device_id']); ?></td>
                    <td><?php echo htmlspecialchars($row['name']); ?></td>
                    <td><?php echo htmlspecialchars($row['IP_address']); ?></td>
                    <td><?php echo htmlspecialchars($row['fw']); ?></td>
                    <td><?php echo htmlspecialchars($row['switch']); ?></td>
                    <td><?php echo htmlspecialchars($row['voltage']); ?></td>
                    <td><?php echo htmlspecialchars($row['power']); ?></td>
                    <td>
                        <?php
                        $status = strtoupper(trim($row['status']));
                        $class = ($status === 'ON') ? 'status-on' : 'status-off';
                        ?>
                        <span class="<?php echo $class; ?>">
                            <?php echo htmlspecialchars($status); ?>
                        </span>
                    </td>
                    <td><?php echo htmlspecialchars($row['created_at']); ?></td>
                    <td class="actions">
                        <a href="device_rooms.php?device_id=<?php echo urlencode($row['device_id']); ?>">
                            View Rooms
                        </a>
                    </td>
                </tr>
            <?php endwhile; ?>
            </tbody>
        </table>
    <?php else: ?>
        <p class="empty">No PLC devices found in the database.</p>
    <?php endif; ?>

</div>
<script src="js/app.js"></script>
</body>
</html>
<?php
$result->free();
$mysqli->close();
?>