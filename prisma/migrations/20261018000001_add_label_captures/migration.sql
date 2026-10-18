-- Captura de etiquetas Safetti (solo negocios en LABEL_CAPTURE_BUSINESS_IDS). Tabla nueva: sin tocar tablas existentes.
-- CreateTable
CREATE TABLE `label_captures` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `business_id` INTEGER NOT NULL,
    `ean` VARCHAR(13) NOT NULL,
    `ref` VARCHAR(10) NOT NULL,
    `model_name` VARCHAR(120) NOT NULL,
    `label_color` VARCHAR(40) NOT NULL,
    `garment` VARCHAR(60) NOT NULL,
    `size` VARCHAR(20) NOT NULL,
    `gender` VARCHAR(10) NOT NULL,
    `units` INTEGER NOT NULL DEFAULT 1,
    `color_actual` VARCHAR(60) NULL,
    `status` VARCHAR(10) NOT NULL DEFAULT 'review',
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `label_captures_business_id_ean_key`(`business_id`, `ean`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
