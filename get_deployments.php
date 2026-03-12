<?php
/**
 * API: Fetch deployment mapping (device -> rooms -> appliances).
 */
define('PLC_SYSTEM', true);
require_once __DIR__ . '/config.php';

header('Content-Type: application/json');

try {
    $pdo = getDbConnection();
    // Get all deployments with room and appliance info
    $stmt = $pdo->query("
        SELECT d.deployment_id, d.room_id, d.appliance_name, d.appliance_id, d.ipaddress,
               d.power, d.hp, d.current, d.status,
               r.roomnoname, r.bldgno, r.appliances AS room_appliances, r.ipaddress AS room_ip
        FROM PLCdeployment d
        JOIN roomdeployment r ON r.room_id = d.room_id
        ORDER BY d.room_id, d.deployment_id
    ");
    $deployments = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode(['success' => true, 'deployments' => $deployments]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
