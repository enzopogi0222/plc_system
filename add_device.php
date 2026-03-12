<?php
/**
 * API: Add a new PLC device to PLCdevices table.
 * Expects POST: name, IP_address, fw, switch, power
 */
define('PLC_SYSTEM', true);
require_once __DIR__ . '/config.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$name       = trim($_POST['name'] ?? '');
$ip         = trim($_POST['IP_address'] ?? '');
$fw         = trim($_POST['fw'] ?? '');
$switch     = (int) ($_POST['switch'] ?? 1);
$power      = (float) ($_POST['power'] ?? 0);

// Validate switch: 1, 2, 4, 8, 16
$allowedSwitch = [1, 2, 4, 8, 16];
if (!in_array($switch, $allowedSwitch)) {
    $switch = 1;
}

if ($name === '' || $ip === '') {
    echo json_encode(['success' => false, 'error' => 'Name and IP address are required']);
    exit;
}

try {
    $pdo = getDbConnection();
    $stmt = $pdo->prepare("
        INSERT INTO PLCdevices (name, IP_address, fw, switch, power)
        VALUES (:name, :ip, :fw, :switch, :power)
    ");
    $stmt->execute([
        ':name'   => $name,
        ':ip'     => $ip,
        ':fw'     => $fw,
        ':switch' => $switch,
        ':power'  => $power,
    ]);
    $deviceId = (int) $pdo->lastInsertId();
    echo json_encode(['success' => true, 'device_id' => $deviceId]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
