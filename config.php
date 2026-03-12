<?php
/**
 * PLC Device Deployment System - Database Configuration
 * Handles MySQL connection and table setup for XAMPP.
 */

// Prevent direct access
if (!defined('PLC_SYSTEM')) {
    define('PLC_SYSTEM', true);
}

// Database credentials (XAMPP default)
define('DB_HOST', 'localhost');
define('DB_NAME', 'plc_system');
define('DB_USER', 'root');
define('DB_PASS', '');
define('DB_CHARSET', 'utf8mb4');

/**
 * Get PDO database connection
 * @return PDO
 */
function getDbConnection() {
    static $pdo = null;
    if ($pdo === null) {
        try {
            $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;
            $options = [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ];
            $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        } catch (PDOException $e) {
            die('Database connection failed: ' . $e->getMessage());
        }
    }
    return $pdo;
}

/**
 * Create database and tables if they don't exist (run once)
 */
function initDatabase() {
    $pdo = new PDO('mysql:host=' . DB_HOST . ';charset=' . DB_CHARSET, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);
    $pdo->exec("CREATE DATABASE IF NOT EXISTS " . DB_NAME . " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $pdo->exec("USE " . DB_NAME);

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS PLCdevices (
            device_id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(50) NOT NULL,
            IP_address VARCHAR(15) NOT NULL,
            fw VARCHAR(20) DEFAULT NULL,
            switch INT(2) NOT NULL DEFAULT 1,
            power FLOAT(6,2) DEFAULT 0.00
        )
    ");
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS roomdeployment (
            room_id INT AUTO_INCREMENT PRIMARY KEY,
            roomnoname VARCHAR(20) NOT NULL,
            bldgno VARCHAR(20) NOT NULL,
            appliances INT(2) DEFAULT 0,
            ipaddress VARCHAR(15) DEFAULT NULL
        )
    ");
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS PLCdeployment (
            deployment_id INT AUTO_INCREMENT PRIMARY KEY,
            room_id INT NOT NULL,
            appliance_name VARCHAR(50) NOT NULL,
            appliance_id INT NOT NULL,
            ipaddress VARCHAR(15) DEFAULT NULL,
            power FLOAT(10,2) DEFAULT 0.00,
            hp FLOAT(10,2) DEFAULT 0.00,
            current FLOAT(10,2) DEFAULT 0.00,
            status VARCHAR(2) DEFAULT 'OFF',
            FOREIGN KEY (room_id) REFERENCES roomdeployment(room_id) ON DELETE CASCADE
        )
    ");
}
