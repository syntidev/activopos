CREATE TABLE `social_style_presets` (
  `id`            INT          NOT NULL AUTO_INCREMENT,
  `business_id`   INT          NOT NULL,
  `name`          VARCHAR(120) NOT NULL,
  `design_rules`  TEXT         NOT NULL,
  `example_html`  TEXT         NULL,
  `created_at`    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `social_style_presets_business_id_idx` (`business_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `social_style_presets_business_id_fkey`
    FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
