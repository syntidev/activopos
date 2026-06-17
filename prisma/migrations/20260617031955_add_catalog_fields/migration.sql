-- AlterTable
ALTER TABLE `businesses` ADD COLUMN `catalog_active` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `catalog_desc` TEXT NULL,
    ADD COLUMN `catalog_title` VARCHAR(150) NULL;

-- AlterTable
ALTER TABLE `products` ADD COLUMN `available_in_pos` BOOLEAN NOT NULL DEFAULT true;
