
-- AlterTable
ALTER TABLE `products` ADD COLUMN `allergens` JSON NULL,
    ADD COLUMN `carta_tags` JSON NULL,
    ADD COLUMN `sold_out_date` DATE NULL;

-- AlterTable
ALTER TABLE `order_items` ADD COLUMN `modifiers` JSON NULL,
    ADD COLUMN `note` VARCHAR(200) NULL;

-- CreateTable
CREATE TABLE `product_option_groups` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `product_id` INTEGER NOT NULL,
    `name` VARCHAR(60) NOT NULL,
    `required` BOOLEAN NOT NULL DEFAULT false,
    `multiple` BOOLEAN NOT NULL DEFAULT false,
    `max_select` INTEGER NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,

    INDEX `product_option_groups_product_id_idx`(`product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_options` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `group_id` INTEGER NOT NULL,
    `name` VARCHAR(60) NOT NULL,
    `price_extra_usd` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,

    INDEX `product_options_group_id_idx`(`group_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `product_option_groups` ADD CONSTRAINT `product_option_groups_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_options` ADD CONSTRAINT `product_options_group_id_fkey` FOREIGN KEY (`group_id`) REFERENCES `product_option_groups`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
