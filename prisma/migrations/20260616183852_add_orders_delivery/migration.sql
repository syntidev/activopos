/*
  Warnings:

  - You are about to alter the column `catalog_plan` on the `businesses` table. The data in that column could be lost. The data in that column will be cast from `TinyInt` to `VarChar(30)`.

*/
-- AlterTable
ALTER TABLE `businesses` MODIFY `catalog_plan` VARCHAR(30) NULL;

-- AlterTable
ALTER TABLE `products` MODIFY `sale_mode` ENUM('unit', 'weight', 'service', 'length', 'volume', 'package') NOT NULL DEFAULT 'unit',
    MODIFY `base_unit_label` VARCHAR(20) NOT NULL DEFAULT 'und';

-- AlterTable
ALTER TABLE `sale_items` MODIFY `unit_label` VARCHAR(20) NOT NULL;

-- CreateTable
CREATE TABLE `orders` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `business_id` INTEGER NOT NULL,
    `order_number` VARCHAR(20) NOT NULL,
    `status` ENUM('received', 'preparing', 'ready', 'dispatched', 'delivered', 'cancelled') NOT NULL DEFAULT 'received',
    `origin` ENUM('whatsapp', 'catalog', 'phone', 'pos') NOT NULL DEFAULT 'whatsapp',
    `client_id` INTEGER NULL,
    `client_name` VARCHAR(120) NULL,
    `client_phone` VARCHAR(20) NULL,
    `client_address` TEXT NULL,
    `notes` TEXT NULL,
    `delivery_fee` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `total_usd` DECIMAL(10, 2) NOT NULL,
    `total_bs` DECIMAL(12, 2) NOT NULL,
    `rate_used` DECIMAL(10, 4) NOT NULL,
    `estimated_time` INTEGER NULL,
    `sale_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `order_id` INTEGER NOT NULL,
    `product_id` INTEGER NOT NULL,
    `product_name` VARCHAR(120) NOT NULL,
    `variant_label` VARCHAR(100) NULL,
    `quantity` DECIMAL(10, 3) NOT NULL,
    `price_per_unit_usd` DECIMAL(10, 4) NOT NULL,
    `subtotal_usd` DECIMAL(10, 2) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
