-- AlterTable
ALTER TABLE `products` ADD COLUMN `availability` ENUM('in_stock', 'low_stock', 'out_of_stock', 'discontinued') NOT NULL DEFAULT 'in_stock',
    ADD COLUMN `catalog_visibility` ENUM('visible', 'hidden', 'on_request') NOT NULL DEFAULT 'visible';
