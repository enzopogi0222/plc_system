<?php
/**
 * One-time database setup script.
 * Run this once via browser or CLI to create database and tables.
 */
define('PLC_SYSTEM', true);
require_once __DIR__ . '/config.php';
initDatabase();
echo "Database and tables created successfully. You can delete this file after first run.\n";
