<?php
/**
 * API: Clear All - Remove every row from PLCdeployment, roomdeployment, and PLCdevices.
 * Uses DB from config (e.g. plc_system or sia_plc). Disables foreign key checks,
 * TRUNCATEs in order: PLCdeployment → roomdeployment → PLCdevices, then re-enables FK checks.
 */
define('PLC_SYSTEM', true);
require_once __DIR__ . '/config.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

try {
    $pdo = getDbConnection();

    $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');

    $pdo->exec('TRUNCATE TABLE PLCdeployment');
    $pdo->exec('TRUNCATE TABLE roomdeployment');
    $pdo->exec('TRUNCATE TABLE PLCdevices');

    $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');

    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    if (isset($pdo)) {
        $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
    }
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
