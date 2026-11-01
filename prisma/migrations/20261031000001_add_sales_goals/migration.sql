-- Métricas: metas mensuales de venta (ver .doc/CONTRATO_METRICAS.md).
-- Tabla NUEVA y aditiva: no toca tablas existentes ni otras apps de la base compartida.
-- Sin FK a products/categories/brands: ref_id se valida contra el negocio en la API.
-- CreateTable
CREATE TABLE `sales_goals` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `business_id` INTEGER NOT NULL,
    `scope` ENUM('product', 'category', 'brand') NOT NULL,
    `ref_id` INTEGER NOT NULL,
    `period` VARCHAR(7) NOT NULL,
    `metric` ENUM('units', 'usd') NOT NULL,
    `target` DECIMAL(12, 2) NOT NULL,
    `created_by` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `sales_goals_business_id_period_idx`(`business_id`, `period`),
    UNIQUE INDEX `sales_goals_business_id_scope_ref_id_period_metric_key`(`business_id`, `scope`, `ref_id`, `period`, `metric`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
