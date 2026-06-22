-- AlterTable
ALTER TABLE `product_variants` ADD COLUMN `cost_usd` DOUBLE NULL,
    ADD COLUMN `price_usd` DOUBLE NULL;

-- AlterTable
ALTER TABLE `sale_items` ADD COLUMN `variant_id` INTEGER NULL;

-- CreateTable
CREATE TABLE `pin_rate_limits` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `business_id` INTEGER NOT NULL,
    `sale_id` INTEGER NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 1,
    `reset_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `pin_rate_limits_reset_at_idx`(`reset_at`),
    UNIQUE INDEX `pin_rate_limits_business_id_sale_id_key`(`business_id`, `sale_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `sale_items` ADD CONSTRAINT `sale_items_variant_id_fkey` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
