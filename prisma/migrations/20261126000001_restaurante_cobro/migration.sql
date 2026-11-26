-- AlterTable
ALTER TABLE `sale_items` ADD COLUMN `order_item_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `sales` ADD COLUMN `table_order_id` INTEGER NULL;

-- CreateTable
CREATE TABLE `sale_tips` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `business_id` INTEGER NOT NULL,
    `sale_id` INTEGER NOT NULL,
    `waiter_id` INTEGER NULL,
    `payment_method_id` INTEGER NOT NULL,
    `is_cash` BOOLEAN NOT NULL,
    `amount_usd` DECIMAL(10, 2) NOT NULL,
    `amount_bs` DECIMAL(12, 2) NOT NULL,
    `rate_used` DECIMAL(10, 4) NOT NULL,
    `created_by` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `sale_tips_business_id_created_at_idx`(`business_id`, `created_at`),
    INDEX `sale_tips_sale_id_idx`(`sale_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_tables` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `order_id` INTEGER NOT NULL,
    `table_id` INTEGER NOT NULL,

    INDEX `order_tables_table_id_idx`(`table_id`),
    UNIQUE INDEX `order_tables_order_id_table_id_key`(`order_id`, `table_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `sale_items_order_item_id_idx` ON `sale_items`(`order_item_id`);

-- CreateIndex
CREATE INDEX `sales_table_order_id_idx` ON `sales`(`table_order_id`);

-- AddForeignKey
ALTER TABLE `sales` ADD CONSTRAINT `sales_table_order_id_fkey` FOREIGN KEY (`table_order_id`) REFERENCES `orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_tips` ADD CONSTRAINT `sale_tips_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sale_tips` ADD CONSTRAINT `sale_tips_sale_id_fkey` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_tables` ADD CONSTRAINT `order_tables_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_tables` ADD CONSTRAINT `order_tables_table_id_fkey` FOREIGN KEY (`table_id`) REFERENCES `dining_tables`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

