-- Data migration: normalize product_type to new enum values
-- 'physical' and any other non-enum value → 'simple'
-- 'service' is identified by sale_mode='service' going forward
UPDATE `products` SET `product_type` = 'simple'
WHERE `product_type` NOT IN ('simple', 'combo', 'fabricable');

-- AlterTable
ALTER TABLE `products`
    ADD COLUMN `unit_label` VARCHAR(20) NOT NULL DEFAULT 'und',
    ADD COLUMN `unit_step` DOUBLE NOT NULL DEFAULT 1,
    ADD COLUMN `unit_type` ENUM('unit', 'weight', 'volume', 'length') NOT NULL DEFAULT 'unit',
    MODIFY `product_type` ENUM('simple', 'combo', 'fabricable') NOT NULL DEFAULT 'simple';

-- AlterTable
ALTER TABLE `sale_items` ADD COLUMN `recipe_snapshot` TEXT NULL;

-- CreateTable
CREATE TABLE `product_components` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `business_id` INTEGER NOT NULL,
    `parent_id` INTEGER NOT NULL,
    `component_id` INTEGER NOT NULL,
    `quantity` DOUBLE NOT NULL,
    `unit_label` VARCHAR(20) NOT NULL DEFAULT 'und',

    INDEX `product_components_business_id_idx`(`business_id`),
    INDEX `product_components_parent_id_idx`(`parent_id`),
    INDEX `product_components_component_id_idx`(`component_id`),
    UNIQUE INDEX `product_components_parent_id_component_id_key`(`parent_id`, `component_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `product_components` ADD CONSTRAINT `product_components_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_components` ADD CONSTRAINT `product_components_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_components` ADD CONSTRAINT `product_components_component_id_fkey` FOREIGN KEY (`component_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `businesses` RENAME INDEX `catalog_slug` TO `businesses_catalog_slug_key`;
