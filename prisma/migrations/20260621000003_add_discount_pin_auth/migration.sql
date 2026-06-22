-- AlterTable
ALTER TABLE `businesses` ADD COLUMN `max_discount_pct` DOUBLE NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `sales` ADD COLUMN `discount_auth_by` INTEGER NULL,
    ADD COLUMN `discount_pct` DOUBLE NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE `sales` ADD CONSTRAINT `sales_discount_auth_by_fkey` FOREIGN KEY (`discount_auth_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
