CREATE TABLE `invoices` (
  `id`              INT           NOT NULL AUTO_INCREMENT,
  `business_id`     INT           NOT NULL,
  `invoice_number`  VARCHAR(30)   NOT NULL,
  `amount_usd`      DECIMAL(10,2) NOT NULL,
  `channel`         VARCHAR(60)   NOT NULL,
  `reference`       VARCHAR(120)  NULL,
  `period`          VARCHAR(60)   NULL,
  `status`          VARCHAR(20)   NOT NULL DEFAULT 'pending',
  `admin_notes`     TEXT          NULL,
  `reviewed_by`     INT           NULL,
  `reviewed_at`     DATETIME(3)   NULL,
  `created_at`      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `invoices_invoice_number_key` (`invoice_number`),
  INDEX `invoices_business_id_idx` (`business_id`),
  INDEX `invoices_status_idx` (`status`),
  PRIMARY KEY (`id`),
  CONSTRAINT `invoices_business_id_fkey`
    FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `support_tickets` (
  `id`            INT          NOT NULL AUTO_INCREMENT,
  `business_id`   INT          NOT NULL,
  `subject`       VARCHAR(200) NOT NULL,
  `message`       TEXT         NOT NULL,
  `category`      VARCHAR(20)  NOT NULL DEFAULT 'general',
  `status`        VARCHAR(20)  NOT NULL DEFAULT 'open',
  `admin_reply`   TEXT         NULL,
  `created_at`    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `support_tickets_business_id_idx` (`business_id`),
  INDEX `support_tickets_status_idx` (`status`),
  PRIMARY KEY (`id`),
  CONSTRAINT `support_tickets_business_id_fkey`
    FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
