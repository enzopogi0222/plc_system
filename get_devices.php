<?php
/**
 * API: Fetch all PLC devices for the device panel.
 */
define('PLC_SYSTEM', true);
require_once __DIR__ . '/config.php';

header('Content-Type: application/json');

try {
    $pdo = getDbConnection();
    $stmt = $pdo->query("
        SELECT device_id, name, IP_address, fw, switch, power
        FROM PLCdevices
        ORDER BY device_id
    ");
    $devices = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode(['success' => true, 'devices' => $devices]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
