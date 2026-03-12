<?php

$DB_HOST = 'localhost';
$DB_USER = 'root';
$DB_PASS = '';          
$DB_NAME = 'sia_plc';


$mysqli = new mysqli($DB_HOST, $DB_USER, $DB_PASS, $DB_NAME);


if ($mysqli->connect_errno) {
    die('Failed to connect to MySQL: (' . $mysqli->connect_errno . ') ' . $mysqli->connect_error);
}

if (!$mysqli->set_charset('utf8mb4')) {
    
    error_log('Error loading character set utf8mb4: ' . $mysqli->error);
}
?>