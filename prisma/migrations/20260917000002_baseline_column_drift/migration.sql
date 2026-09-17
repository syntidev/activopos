-- Segunda capa del mismo drift de la migración 20260728235959: estas 13 tablas
-- SÍ tenían su CREATE TABLE en el historial, pero acumularon columnas/índices/FKs
-- agregados directo en la DB real (probablemente `db push` iterativo) sin que
-- nadie generara la migración correspondiente. schema.prisma ya reflejaba este
-- estado real -- solo el historial de migraciones estaba atrasado. Confirmado
-- columna por columna contra la DB real antes de escribir esto (ver auditoría
-- CLI-C 2026-09-17); todo lo de abajo ya es verdad en cualquier entorno que
-- corra la app hoy, por eso esta migración se marca `--applied` en vez de
-- ejecutarse -- ejecutarla de verdad fallaría con "Duplicate column".
ALTER TABLE `push_subscriptions` DROP FOREIGN KEY `push_subscriptions_business_id_fkey`;

ALTER TABLE `push_subscriptions` DROP FOREIGN KEY `push_subscriptions_user_id_fkey`;

DROP INDEX `push_subscriptions_user_id_idx` ON `push_subscriptions`;

ALTER TABLE `businesses` ADD COLUMN `ai_tokens_limit_month` INTEGER NOT NULL DEFAULT 100,
    ADD COLUMN `ai_tokens_used_month` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `allow_cashier_price_override` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `caja_mode` VARCHAR(10) NOT NULL DEFAULT 'cash',
    ADD COLUMN `catalog_cover_path` VARCHAR(191) NULL,
    ADD COLUMN `catalog_cover_path_2` VARCHAR(500) NULL,
    ADD COLUMN `catalog_cover_path_3` VARCHAR(500) NULL,
    ADD COLUMN `catalog_hours` TEXT NULL,
    ADD COLUMN `catalog_instagram` VARCHAR(80) NULL,
    ADD COLUMN `notifications_last_read` DATETIME(3) NULL,
    ADD COLUMN `pos_mode` VARCHAR(191) NOT NULL DEFAULT 'ticket',
    ADD COLUMN `quotation_footer` TEXT NULL,
    MODIFY `modules_enabled` VARCHAR(500) NOT NULL DEFAULT 'pos,inventory,caja,pedidos,catalog,finanzas,reportes,analytics,suppliers';

ALTER TABLE `categories` ADD COLUMN `image_url` VARCHAR(500) NULL,
    ADD COLUMN `requires_preparation` BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE `clients` ADD COLUMN `price_tier` ENUM('detal', 'mayorista') NOT NULL DEFAULT 'detal';

ALTER TABLE `gastos` ADD COLUMN `cancelled_at` DATETIME(3) NULL,
    ADD COLUMN `cancelled_by` INTEGER NULL,
    ADD COLUMN `cancelled_reason` VARCHAR(150) NULL,
    ADD COLUMN `purchase_id` INTEGER NULL,
    ADD COLUMN `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
    ADD COLUMN `supplier_id` INTEGER NULL;

ALTER TABLE `inventory_entries` ADD COLUMN `entry_type` VARCHAR(191) NOT NULL DEFAULT 'adjustment';

ALTER TABLE `monthly_reports` ADD COLUMN `seen_at` DATETIME(3) NULL,
    ADD COLUMN `wa_url` TEXT NULL;

ALTER TABLE `orders` ADD COLUMN `delivery_address` TEXT NULL,
    ADD COLUMN `delivery_type` VARCHAR(20) NULL DEFAULT 'pickup',
    ADD COLUMN `recipient_name` VARCHAR(120) NULL,
    ADD COLUMN `send_to_kds` BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE `product_variants` ADD COLUMN `combination_key` VARCHAR(255) NULL;

ALTER TABLE `products` ADD COLUMN `location` VARCHAR(120) NULL,
    ADD COLUMN `notes` TEXT NULL,
    ADD COLUMN `wholesale_price_per_kg_usd` DECIMAL(10, 2) NULL,
    ADD COLUMN `wholesale_price_usd` DECIMAL(10, 2) NULL;

ALTER TABLE `sale_items` ADD COLUMN `override_reason` VARCHAR(255) NULL,
    ADD COLUMN `unit_price_override` DECIMAL(10, 4) NULL;

ALTER TABLE `sales` MODIFY `status` ENUM('draft', 'quote', 'pending', 'paid', 'cancelled', 'returned', 'partial_return', 'credit') NOT NULL DEFAULT 'pending';

CREATE INDEX `gastos_supplier_id_idx` ON `gastos`(`supplier_id`);

CREATE INDEX `gastos_purchase_id_idx` ON `gastos`(`purchase_id`);

CREATE UNIQUE INDEX `users_email_key` ON `users`(`email`);

ALTER TABLE `gastos` ADD CONSTRAINT `gastos_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `gastos` ADD CONSTRAINT `gastos_purchase_id_fkey` FOREIGN KEY (`purchase_id`) REFERENCES `purchases`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `push_subscriptions` ADD CONSTRAINT `push_subscriptions_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `push_subscriptions` ADD CONSTRAINT `push_subscriptions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
