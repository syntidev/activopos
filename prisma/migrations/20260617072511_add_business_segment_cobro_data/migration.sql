-- AlterTable
ALTER TABLE `businesses` ADD COLUMN `cobro_data` JSON NULL,
    ADD COLUMN `segment` VARCHAR(40) NULL DEFAULT 'retail';
