-- AlterTable
ALTER TABLE `categories` ADD COLUMN `station_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `products` ADD COLUMN `station_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `orders` ADD COLUMN `account_status` VARCHAR(16) NULL,
    ADD COLUMN `bill_requested_at` DATETIME(3) NULL,
    ADD COLUMN `closed_at` DATETIME(3) NULL,
    ADD COLUMN `guests` INTEGER NULL,
    ADD COLUMN `opened_at` DATETIME(3) NULL,
    ADD COLUMN `table_id` INTEGER NULL,
    ADD COLUMN `waiter_id` INTEGER NULL;

-- AlterTable
ALTER TABLE `order_items` ADD COLUMN `course` INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN `kds_status` VARCHAR(12) NULL,
    ADD COLUMN `kds_updated_at` DATETIME(3) NULL,
    ADD COLUMN `ready_at` DATETIME(3) NULL,
    ADD COLUMN `seat` INTEGER NULL,
    ADD COLUMN `sent_at` DATETIME(3) NULL,
    ADD COLUMN `served_at` DATETIME(3) NULL,
    ADD COLUMN `started_at` DATETIME(3) NULL,
    ADD COLUMN `started_by` INTEGER NULL,
    ADD COLUMN `station_id` INTEGER NULL,
    ADD COLUMN `void_by` INTEGER NULL,
    ADD COLUMN `void_reason` VARCHAR(255) NULL;

-- CreateTable
CREATE TABLE `prep_stations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `business_id` INTEGER NOT NULL,
    `name` VARCHAR(60) NOT NULL,
    `color` VARCHAR(20) NULL,
    `printer_name` VARCHAR(80) NULL,
    `warn_min` INTEGER NOT NULL DEFAULT 10,
    `critical_min` INTEGER NOT NULL DEFAULT 20,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `prep_stations_business_id_name_key`(`business_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_stations` (
    `user_id` INTEGER NOT NULL,
    `station_id` INTEGER NOT NULL,

    PRIMARY KEY (`user_id`, `station_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_modifiers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `business_id` INTEGER NOT NULL,
    `product_id` INTEGER NULL,
    `category_id` INTEGER NULL,
    `group_name` VARCHAR(60) NULL,
    `name` VARCHAR(60) NOT NULL,
    `price_usd` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    `required` BOOLEAN NOT NULL DEFAULT false,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,

    INDEX `product_modifiers_business_id_product_id_idx`(`business_id`, `product_id`),
    INDEX `product_modifiers_business_id_category_id_idx`(`business_id`, `category_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `table_events` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `business_id` INTEGER NOT NULL,
    `order_id` INTEGER NULL,
    `table_id` INTEGER NULL,
    `type` VARCHAR(24) NOT NULL,
    `from_value` VARCHAR(60) NULL,
    `to_value` VARCHAR(60) NULL,
    `reason` VARCHAR(255) NULL,
    `user_id` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `table_events_business_id_order_id_idx`(`business_id`, `order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `categories_station_id_idx` ON `categories`(`station_id`);

-- CreateIndex
CREATE INDEX `products_station_id_idx` ON `products`(`station_id`);

-- CreateIndex
CREATE INDEX `orders_business_id_table_id_account_status_idx` ON `orders`(`business_id`, `table_id`, `account_status`);

-- CreateIndex
CREATE INDEX `order_items_station_id_kds_status_sent_at_idx` ON `order_items`(`station_id`, `kds_status`, `sent_at`);

-- CreateIndex
CREATE INDEX `order_items_station_id_kds_updated_at_idx` ON `order_items`(`station_id`, `kds_updated_at`);

-- AddForeignKey
ALTER TABLE `prep_stations` ADD CONSTRAINT `prep_stations_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_stations` ADD CONSTRAINT `user_stations_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_stations` ADD CONSTRAINT `user_stations_station_id_fkey` FOREIGN KEY (`station_id`) REFERENCES `prep_stations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_modifiers` ADD CONSTRAINT `product_modifiers_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `table_events` ADD CONSTRAINT `table_events_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `categories` ADD CONSTRAINT `categories_station_id_fkey` FOREIGN KEY (`station_id`) REFERENCES `prep_stations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_station_id_fkey` FOREIGN KEY (`station_id`) REFERENCES `prep_stations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_table_id_fkey` FOREIGN KEY (`table_id`) REFERENCES `dining_tables`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_waiter_id_fkey` FOREIGN KEY (`waiter_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_station_id_fkey` FOREIGN KEY (`station_id`) REFERENCES `prep_stations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

