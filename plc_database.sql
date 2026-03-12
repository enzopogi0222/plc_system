
CREATE DATABASE IF NOT EXISTS `sia_plc`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `sia_plc`;


SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `PLCdeployment`;
DROP TABLE IF EXISTS `roomdeployment`;
DROP TABLE IF EXISTS `PLCdevices`;
SET FOREIGN_KEY_CHECKS = 1;


CREATE TABLE `PLCdevices` (
  `device_id`   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`        VARCHAR(50) NOT NULL DEFAULT 'test',
  `IP_address`  VARCHAR(15) NOT NULL,
  `fw`          VARCHAR(20),
  `switch`      INT,
  `voltage`     VARCHAR(20),
  `power`       FLOAT(6,2),
  `status`      VARCHAR(2),
  `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`device_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE `roomdeployment` (
  `room_id`     INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `device_id`   INT UNSIGNED NOT NULL,
  `roomnoname`  VARCHAR(20) NOT NULL,
  `bldgno`      VARCHAR(20),
  `appliances`  INT DEFAULT 0,
  `ipaddress`   VARCHAR(15),
  `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`room_id`),
  CONSTRAINT `fk_room_device`
    FOREIGN KEY (`device_id`)
    REFERENCES `PLCdevices`(`device_id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE `PLCdeployment` (
  `deployment_id`  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `room_id`        INT UNSIGNED NOT NULL,
  `appliance_name` VARCHAR(50) NOT NULL,
  `appliance_id`   VARCHAR(30) NOT NULL,
  `voltage`        VARCHAR(20) DEFAULT '220',
  `ipaddress`      VARCHAR(15),
  `power`          FLOAT(10,2),
  `hp`             FLOAT(10,2),
  `current_amps`   FLOAT(10,2),
  `status`         VARCHAR(2),
  `created_at`     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`deployment_id`),
  CONSTRAINT `fk_deployment_room`
    FOREIGN KEY (`room_id`)
    REFERENCES `roomdeployment`(`room_id`)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;



INSERT INTO `PLCdevices`
  (`name`, `IP_address`, `fw`, `switch`, `voltage`, `power`, `status`)
VALUES
  ('41KL21670', '192.168.1.100', 'v1.0.0', 1, '220', 500.00, 'ON');

-- Assume this PLC got device_id = 1
INSERT INTO `roomdeployment`
  (`device_id`, `roomnoname`, `bldgno`, `appliances`, `ipaddress`)
VALUES
  (1, '1', 'CTE', 2, '192.168.1.101');

-- Assume this room got room_id = 1
INSERT INTO `PLCdeployment`
  (`room_id`, `appliance_name`, `appliance_id`, `voltage`, `ipaddress`,
   `power`, `hp`, `current_amps`, `status`)
VALUES
  (1, 'Aircon Unit 1', 'AC-CTE-001', '220', '192.168.1.201', 2000.00, 2.50, 9.10, 'ON'),
  (1, 'Aircon Unit 2', 'AC-CTE-002', '220', '192.168.1.202', 2000.00, 2.50, 9.10, 'ON');