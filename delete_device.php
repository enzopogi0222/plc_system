<?php
/**
 * API: Delete a single PLC device entirely.
 * Removes:
 * - All roomdeployment rows for this device's IP
 * - All PLCdeployment rows for this device's IP
 * - The PLCdevices row itself
 *
 * Expects POST JSON or form data with either:
 * - deviceId
 * - deviceIp
 */
define('PLC_SYSTEM', true);
require_once __DIR__ . '/config.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$deviceId = 0;
$deviceIp = '';

if (strpos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== false) {
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);
    if (is_array($data)) {
        $deviceId = isset($data['deviceId']) ? (int) $data['deviceId'] : 0;
        $deviceIp = isset($data['deviceIp']) ? trim((string) $data['deviceIp']) : '';
    }
} else {
    if (isset($_POST['deviceId'])) {
        $deviceId = (int) $_POST['deviceId'];
    }
    if (isset($_POST['deviceIp'])) {
        $deviceIp = trim((string) $_POST['deviceIp']);
    }
}

try {
    $pdo = getDbConnection();

    if ($deviceId <= 0 && $deviceIp === '') {
        echo json_encode(['success' => false, 'error' => 'deviceId or deviceIp required']);
        exit;
    }

    // If we only have deviceId, resolve IP from PLCdevices
    if ($deviceIp === '' && $deviceId > 0) {
        $stmt = $pdo->prepare("SELECT IP_address FROM PLCdevices WHERE device_id = ?");
        $stmt->execute([$deviceId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row) {
            $deviceIp = $row['IP_address'];
        }
    }

    $pdo->beginTransaction();

    if ($deviceIp !== '') {
        // Delete rooms and deployments tied to this IP
        $stmt = $pdo->prepare("DELETE FROM roomdeployment WHERE ipaddress = ?");
        $stmt->execute([$deviceIp]);

        $stmt = $pdo->prepare("DELETE FROM PLCdeployment WHERE ipaddress = ?");
        $stmt->execute([$deviceIp]);
    }

    if ($deviceId > 0) {
        $stmt = $pdo->prepare("DELETE FROM PLCdevices WHERE device_id = ?");
        $stmt->execute([$deviceId]);
    } elseif ($deviceIp !== '') {
        $stmt = $pdo->prepare("DELETE FROM PLCdevices WHERE IP_address = ?");
        $stmt->execute([$deviceIp]);
    }

    $pdo->commit();

    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

