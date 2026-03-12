<?php
/**
 * One-time migration: Remove the status column from PLCdevices.
 * Run this once if your database was created before status was removed (e.g. open in browser or: php migrate_drop_device_status.php).
 */
define('PLC_SYSTEM', true);
require_once __DIR__ . '/config.php';

header('Content-Type: application/json');

try {
    $pdo = getDbConnection();
    $pdo->exec("ALTER TABLE PLCdevices DROP COLUMN status");
    echo json_encode(['success' => true, 'message' => 'Column status dropped from PLCdevices.']);
} catch (PDOException $e) {
    if (strpos($e->getMessage(), 'Unknown column') !== false) {
        echo json_encode(['success' => true, 'message' => 'Column status was already removed or did not exist.']);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}
