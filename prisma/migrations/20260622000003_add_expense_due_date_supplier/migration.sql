-- AlterTable
ALTER TABLE `gastos` ADD COLUMN `due_date` DATETIME(3) NULL,
    ADD COLUMN `supplier` VARCHAR(150) NULL;
