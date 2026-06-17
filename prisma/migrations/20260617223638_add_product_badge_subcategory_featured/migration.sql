-- AlterTable
ALTER TABLE `products` ADD COLUMN `badge` VARCHAR(191) NULL DEFAULT 'none',
    ADD COLUMN `is_featured` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `subcategory` VARCHAR(191) NULL;
