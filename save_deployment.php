<?php
/**
 * API: Save deployment layout and appliance assignments.
 * Expects POST JSON: { deviceId, rooms: [ { roomId, appliances: [ { applianceType, name, ... } ] } ] }
 * Creates/updates roomdeployment and PLCdeployment records linked by device IP.
 */
define('PLC_SYSTEM', true);
require_once __DIR__ . '/config.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed']);
    exit;
}

$input = file_get_contents('php://input');
$data = json_decode($input, true);
if (!$data) {
    echo json_encode(['success' => false, 'error' => 'Invalid JSON']);
    exit;
}

$deviceId = (int) ($data['deviceId'] ?? 0);
$deviceIp = trim((string) ($data['deviceIp'] ?? ''));
$rooms = $data['rooms'] ?? [];

if (!$deviceId || !$deviceIp) {
    echo json_encode(['success' => false, 'error' => 'deviceId and deviceIp required']);
    exit;
}

try {
    $pdo = getDbConnection();
    $savedRoomIds = [];

    foreach ($rooms as $roomData) {
        $roomId = (int) ($roomData['roomId'] ?? 0);
        $roomNoName = trim((string) ($roomData['roomnoname'] ?? 'Room'));
        $bldgNo = trim((string) ($roomData['bldgno'] ?? ''));
        $appliancesData = $roomData['appliances'] ?? [];

        if ($roomId <= 0) {
            // Insert new room
            $stmt = $pdo->prepare("
                INSERT INTO roomdeployment (roomnoname, bldgno, appliances, ipaddress)
                VALUES (:roomnoname, :bldgno, :appliances, :ipaddress)
            ");
            $stmt->execute([
                ':roomnoname' => $roomNoName,
                ':bldgno'    => $bldgNo,
                ':appliances' => count($appliancesData),
                ':ipaddress' => $deviceIp,
            ]);
            $roomId = (int) $pdo->lastInsertId();
        } else {
            $stmt = $pdo->prepare("
                UPDATE roomdeployment SET roomnoname = ?, bldgno = ?, appliances = ?, ipaddress = ?
                WHERE room_id = ?
            ");
            $stmt->execute([$roomNoName, $bldgNo, count($appliancesData), $deviceIp, $roomId]);
        }
        $savedRoomIds[] = $roomId;

        // Remove old appliance deployments for this room (we replace with current state)
        $pdo->prepare("DELETE FROM PLCdeployment WHERE room_id = ?")->execute([$roomId]);

        foreach ($appliancesData as $app) {
            $appName = trim((string) ($app['appliance_name'] ?? $app['name'] ?? 'Appliance'));
            $appId = (int) ($app['appliance_id'] ?? 0);
            if ($appId <= 0) {
                $appId = $roomId * 10 + count($appliancesData); // simple synthetic ID
            }
            $power = (float) ($app['power'] ?? 0);
            $hp = (float) ($app['hp'] ?? 0);
            $current = (float) ($app['current'] ?? 0);
            $status = strtoupper(trim((string) ($app['status'] ?? 'OFF')));
            if ($status !== 'ON' && $status !== 'OFF') {
                $status = 'OFF';
            }

            $stmt = $pdo->prepare("
                INSERT INTO PLCdeployment (room_id, appliance_name, appliance_id, ipaddress, power, hp, current, status)
                VALUES (:room_id, :appliance_name, :appliance_id, :ipaddress, :power, :hp, :current, :status)
            ");
            $stmt->execute([
                ':room_id'       => $roomId,
                ':appliance_name'=> $appName,
                ':appliance_id'  => $appId,
                ':ipaddress'     => $deviceIp,
                ':power'         => $power,
                ':hp'            => $hp,
                ':current'       => $current,
                ':status'        => $status,
            ]);
        }
    }

    echo json_encode(['success' => true, 'roomIds' => $savedRoomIds]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
