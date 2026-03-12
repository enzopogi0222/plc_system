<?php
/**
 * API: Clear (one device) - Remove rooms and appliances for one device only.
 * Expects POST JSON: { deviceIp } or POST form: deviceIp
 * DELETE FROM roomdeployment WHERE ipaddress = ?; PLCdeployment rows removed by CASCADE.
 * Does not touch PLCdevices.
 */
define('PLC_SYSTEM', true);
require_once __DIR__ . '/config.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$deviceIp = '';
if (strpos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== false) {
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    $deviceIp = trim((string) ($data['deviceIp'] ?? ''));
} else {
    $deviceIp = trim((string) ($_POST['deviceIp'] ?? ''));
}

if ($deviceIp === '') {
    echo json_encode(['success' => false, 'error' => 'deviceIp required']);
    exit;
}

try {
    $pdo = getDbConnection();
    // Delete rooms for this device IP; CASCADE removes PLCdeployment rows
    $stmt = $pdo->prepare("DELETE FROM roomdeployment WHERE ipaddress = ?");
    $stmt->execute([$deviceIp]);
    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
