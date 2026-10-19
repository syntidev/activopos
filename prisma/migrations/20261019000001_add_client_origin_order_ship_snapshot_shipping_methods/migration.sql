-- Checkout web con envío: Client.origin/verified/address + índice NORMAL (business_id, cedula) (NO único: hay cédulas duplicadas en producción),
-- snapshot de envío en orders (ship_*, cedula_alert) y tabla nueva business_shipping_methods. Solo cambios aditivos: sin pérdida de datos.
-- AlterTable
ALTER TABLE `clients` ADD COLUMN `address` TEXT NULL,
    ADD COLUMN `origin` VARCHAR(10) NULL DEFAULT 'pos',
    ADD COLUMN `verified` BOOLEAN NULL DEFAULT false;
-- AlterTable
ALTER TABLE `orders` ADD COLUMN `cedula_alert` BOOLEAN NULL DEFAULT false,
    ADD COLUMN `ship_cedula` VARCHAR(20) NULL,
    ADD COLUMN `ship_direccion` TEXT NULL,
    ADD COLUMN `ship_metodo_id` INTEGER NULL,
    ADD COLUMN `ship_nombre` VARCHAR(120) NULL,
    ADD COLUMN `ship_telefono` VARCHAR(20) NULL;
-- CreateTable
CREATE TABLE `business_shipping_methods` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `business_id` INTEGER NOT NULL,
    `code` VARCHAR(40) NOT NULL,
    `label` VARCHAR(120) NOT NULL,
    `kind` VARCHAR(20) NOT NULL,
    `requires_branch` BOOLEAN NOT NULL DEFAULT false,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `instructions` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    INDEX `business_shipping_methods_business_id_active_sort_order_idx`(`business_id`, `active`, `sort_order`),
    UNIQUE INDEX `business_shipping_methods_business_id_code_key`(`business_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- CreateIndex
CREATE INDEX `clients_business_id_cedula_idx` ON `clients`(`business_id`, `cedula`);
-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_ship_metodo_id_fkey` FOREIGN KEY (`ship_metodo_id`) REFERENCES `business_shipping_methods`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE `business_shipping_methods` ADD CONSTRAINT `business_shipping_methods_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
