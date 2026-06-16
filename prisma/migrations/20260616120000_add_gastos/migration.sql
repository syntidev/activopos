-- CreateTable
CREATE TABLE `gastos` (
    `id`          INT NOT NULL AUTO_INCREMENT,
    `business_id` INT NOT NULL,
    `concepto`    VARCHAR(150) NOT NULL,
    `monto_usd`   DECIMAL(10, 2) NOT NULL,
    `categoria`   VARCHAR(50) NOT NULL DEFAULT 'otro',
    `fecha`       DATE NOT NULL,
    `notas`       TEXT NULL,
    `is_paid`     BOOLEAN NOT NULL DEFAULT true,
    `paid_at`     DATETIME(3) NULL,
    `created_by`  INT NOT NULL,
    `created_at`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `gastos` ADD CONSTRAINT `gastos_business_id_fkey`
  FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `gastos` ADD CONSTRAINT `gastos_created_by_fkey`
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
