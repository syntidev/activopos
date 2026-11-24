-- AlterTable
ALTER TABLE `businesses` ADD COLUMN `restaurante_enabled` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `users` MODIFY `role` ENUM('super_admin', 'admin', 'cashier', 'operador_reservas', 'waiter', 'kitchen') NOT NULL DEFAULT 'cashier';

-- AlterTable
ALTER TABLE `orders` MODIFY `origin` ENUM('whatsapp', 'catalog', 'phone', 'pos', 'table') NOT NULL DEFAULT 'whatsapp';

-- CreateTable
CREATE TABLE `service_areas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `business_id` INTEGER NOT NULL,
    `name` VARCHAR(60) NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `service_areas_business_id_name_key`(`business_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dining_tables` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `business_id` INTEGER NOT NULL,
    `area_id` INTEGER NOT NULL,
    `label` VARCHAR(20) NOT NULL,
    `capacity` INTEGER NOT NULL DEFAULT 4,
    `shape` VARCHAR(10) NOT NULL DEFAULT 'rect',
    `pos_x` INTEGER NOT NULL DEFAULT 0,
    `pos_y` INTEGER NOT NULL DEFAULT 0,
    `width` INTEGER NOT NULL DEFAULT 2,
    `height` INTEGER NOT NULL DEFAULT 2,
    `rotation` INTEGER NOT NULL DEFAULT 0,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `cleaning_pending` BOOLEAN NOT NULL DEFAULT false,
    `reserved_for` VARCHAR(80) NULL,
    `reserved_phone` VARCHAR(30) NULL,
    `reserved_at` DATETIME(3) NULL,

    INDEX `dining_tables_business_id_area_id_idx`(`business_id`, `area_id`),
    UNIQUE INDEX `dining_tables_business_id_area_id_label_key`(`business_id`, `area_id`, `label`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `floor_elements` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `business_id` INTEGER NOT NULL,
    `area_id` INTEGER NOT NULL,
    `kind` VARCHAR(12) NOT NULL,
    `label` VARCHAR(40) NULL,
    `pos_x` INTEGER NOT NULL,
    `pos_y` INTEGER NOT NULL,
    `width` INTEGER NOT NULL,
    `height` INTEGER NOT NULL,
    `rotation` INTEGER NOT NULL DEFAULT 0,

    INDEX `floor_elements_business_id_area_id_idx`(`business_id`, `area_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `service_areas` ADD CONSTRAINT `service_areas_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dining_tables` ADD CONSTRAINT `dining_tables_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `dining_tables` ADD CONSTRAINT `dining_tables_area_id_fkey` FOREIGN KEY (`area_id`) REFERENCES `service_areas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `floor_elements` ADD CONSTRAINT `floor_elements_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `floor_elements` ADD CONSTRAINT `floor_elements_area_id_fkey` FOREIGN KEY (`area_id`) REFERENCES `service_areas`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

