CREATE TABLE `landing_sections` (
  `id`          INT          NOT NULL AUTO_INCREMENT,
  `business_id` INT          NOT NULL,
  `type`        VARCHAR(30)  NOT NULL,
  `order`       INT          NOT NULL DEFAULT 0,
  `visible`     BOOLEAN      NOT NULL DEFAULT TRUE,
  `config`      JSON         NOT NULL,
  `created_at`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`  DATETIME(3)  NOT NULL,

  INDEX `landing_sections_business_id_order_idx` (`business_id`, `order`),
  PRIMARY KEY (`id`),
  CONSTRAINT `landing_sections_business_id_fkey`
    FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
