-- AlterTable
ALTER TABLE `sale_abonos` ADD COLUMN `cash_register_id` INTEGER NULL;

-- AddForeignKey
ALTER TABLE `sale_abonos` ADD CONSTRAINT `sale_abonos_cash_register_id_fkey` FOREIGN KEY (`cash_register_id`) REFERENCES `cash_registers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
