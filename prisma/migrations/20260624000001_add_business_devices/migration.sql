CREATE TABLE `business_devices` (
  `id`                 INT          NOT NULL AUTO_INCREMENT,
  `business_id`        INT          NOT NULL,
  `type`               VARCHAR(40)  NOT NULL,
  `bank_name`          VARCHAR(80)  NOT NULL,
  `serial`             VARCHAR(60)  NULL,
  `commercial_number`  VARCHAR(40)  NULL,
  `is_active`          BOOLEAN      NOT NULL DEFAULT TRUE,
  `created_at`         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`         DATETIME(3)  NOT NULL,

  INDEX `business_devices_business_id_idx` (`business_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `business_devices_business_id_fkey`
    FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
