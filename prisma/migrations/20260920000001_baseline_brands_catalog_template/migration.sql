-- BASELINE de drift (mismo patrón que 20260917000002_baseline_column_drift y
-- 20260918000001_baseline_variant_group_drift).
--
-- Estos objetos YA EXISTEN en producción: el deploy usó `prisma db push`, así que
-- se crearon sin dejar migración (commits a892fd2 "modelo Brand" y 13bbb72
-- "campo catalog_template"). Esta migración solo pone el historial al día para que
-- una base NUEVA (staging, dev, restore) llegue al mismo estado con `migrate deploy`.
--
-- EN UNA BASE QUE YA LOS TIENE (producción) NO se ejecuta: se marca aplicada con
--   npx prisma migrate resolve --applied 20260920000001_baseline_brands_catalog_template
-- Ejecutarla ahí fallaría por columna/tabla duplicada.

-- AlterTable
ALTER TABLE `businesses` ADD COLUMN `catalog_template` VARCHAR(20) NULL DEFAULT 'generic';

-- CreateTable
CREATE TABLE `brands` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `business_id` INTEGER NOT NULL,
    `name` VARCHAR(60) NOT NULL,
    `image_url` VARCHAR(500) NULL,
    `search_term` VARCHAR(60) NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `visible` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `brands_business_id_order_idx`(`business_id`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `brands` ADD CONSTRAINT `brands_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
