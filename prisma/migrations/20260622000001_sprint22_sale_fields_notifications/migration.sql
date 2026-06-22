-- AlterTable: Sale — vuelto + due_date + credit fields
ALTER TABLE `sales`
    ADD COLUMN `monto_recibido_usd` DOUBLE NULL,
    ADD COLUMN `vuelto_usd`         DOUBLE NULL,
    ADD COLUMN `due_date`           DATETIME(3) NULL,
    ADD COLUMN `credit_days`        INTEGER NULL,
    ADD COLUMN `credit_notes`       TEXT NULL;

-- CreateTable: notifications
CREATE TABLE `notifications` (
    `id`          INTEGER NOT NULL AUTO_INCREMENT,
    `business_id` INTEGER NOT NULL,
    `type`        VARCHAR(60) NOT NULL,
    `title`       VARCHAR(150) NOT NULL,
    `body`        TEXT NOT NULL,
    `entity_type` VARCHAR(60) NULL,
    `entity_id`   INTEGER NULL,
    `channel`     VARCHAR(20) NOT NULL DEFAULT 'in_app',
    `status`      VARCHAR(20) NOT NULL DEFAULT 'pending',
    `created_at`  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `read_at`     DATETIME(3) NULL,

    INDEX `notifications_business_id_status_idx`(`business_id`, `status`),
    INDEX `notifications_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `notifications`
    ADD CONSTRAINT `notifications_business_id_fkey`
    FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
