<?php
/**
 * API: Fetch all rooms from roomdeployment for dropdown/selection.
 */
define('PLC_SYSTEM', true);
require_once __DIR__ . '/config.php';

header('Content-Type: application/json');

try {
    $pdo = getDbConnection();
    $stmt = $pdo->query("
        SELECT room_id, roomnoname, bldgno, appliances, ipaddress
        FROM roomdeployment
        ORDER BY room_id
    ");
    $rooms = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode(['success' => true, 'rooms' => $rooms]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
