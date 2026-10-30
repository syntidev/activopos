-- Pulso: analítica propia del catálogo público (ver .doc/CONTRATO_PULSO.md).
-- Tabla NUEVA y aditiva: no toca tablas existentes ni otras apps de la base compartida.
-- Sin FK a businesses a propósito: alto volumen de escritura y una FK tomaría el lock compartido sobre la fila del negocio.
-- CreateTable
CREATE TABLE `catalog_events` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `business_id` INTEGER NOT NULL,
    `session_id` VARCHAR(36) NOT NULL,
    `type` VARCHAR(24) NOT NULL,
    `path` VARCHAR(255) NOT NULL,
    `product_id` INTEGER NULL,
    `brand_id` INTEGER NULL,
    `deporte` VARCHAR(40) NULL,
    `query` VARCHAR(100) NULL,
    `results_count` INTEGER NULL,
    `order_id` INTEGER NULL,
    `value_usd` DECIMAL(10, 2) NULL,
    `utm_source` VARCHAR(80) NULL,
    `utm_medium` VARCHAR(80) NULL,
    `utm_campaign` VARCHAR(80) NULL,
    `utm_content` VARCHAR(80) NULL,
    `utm_term` VARCHAR(100) NULL,
    `referrer_host` VARCHAR(120) NULL,
    `device` VARCHAR(10) NULL,
    `os` VARCHAR(24) NULL,
    `browser` VARCHAR(24) NULL,
    `country` VARCHAR(2) NULL,
    `city` VARCHAR(80) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `catalog_events_business_id_created_at_idx`(`business_id`, `created_at`),
    INDEX `catalog_events_business_id_type_created_at_idx`(`business_id`, `type`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
