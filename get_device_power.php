<?php
/**
 * API: Power (W) per time slot for a device — for MTUT chart.
 * GET: device_id (required)
 * Returns: { success, labels: ["00:00", ...], values: [120, 90, ...] }
 */
define('PLC_SYSTEM', true);
require_once __DIR__ . '/config.php';

header('Content-Type: application/json');

$device_id = isset($_GET['device_id']) ? (int) $_GET['device_id'] : 0;
if ($device_id <= 0) {
    echo json_encode(['success' => false, 'error' => 'Missing or invalid device_id']);
    exit;
}

try {
    $pdo = getDbConnection();

    $stmt = $pdo->prepare("SELECT device_id, IP_address, power FROM PLCdevices WHERE device_id = ?");
    $stmt->execute([$device_id]);
    $device = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$device) {
        echo json_encode(['success' => false, 'error' => 'Device not found']);
        exit;
    }

    $ip = $device['IP_address'];
    $devicePower = (float) $device['power'];

    $stmt = $pdo->prepare("
        SELECT COALESCE(SUM(d.power), 0) AS total
        FROM PLCdeployment d
        JOIN roomdeployment r ON r.room_id = d.room_id
        WHERE r.ipaddress = ? AND UPPER(TRIM(d.status)) = 'ON'
    ");
    $stmt->execute([$ip]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    $totalPower = (float) ($row['total'] ?? 0);
    if ($totalPower <= 0) {
        $totalPower = $devicePower;
    }

    $labels = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'];
    $values = array_fill(0, count($labels), round($totalPower, 2));

    echo json_encode([
        'success' => true,
        'labels'  => $labels,
        'values'  => $values,
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
