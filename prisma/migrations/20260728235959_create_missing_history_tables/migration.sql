-- Estas 10 tablas se crearon fuera del historial de Prisma Migrate en algún
-- momento (via `db push` o SQL manual) y nunca tuvieron un CREATE TABLE propio
-- en `prisma/migrations/`. Replay del historial desde cero (shadow DB de
-- `migrate dev`, `migrate diff --from-migrations`, o un `migrate deploy` en un
-- entorno nuevo) rompe con "Table '<x>' doesn't exist" apenas la primera
-- migración que las referencia intenta correr. DDL extraído literal de la DB
-- real (`prisma migrate diff --from-empty --to-config-datasource --script`)
-- para que el historial reconstruido coincida exactamente con el estado real.
--
-- `social_assets` se crea aquí SIN background_url/device_variant/layer_override/
-- updated_at a propósito: esas 4 columnas las agrega
-- 20260729000001_add_social_asset_persistence (ya aplicada en todos los
-- entornos existentes) vía ALTER TABLE justo después de esta migración.
-- Agregarlas también acá duplicaría la columna en un entorno nuevo.

-- CreateTable
CREATE TABLE `blog_posts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
    `excerpt` TEXT NULL,
    `content` LONGTEXT NOT NULL,
    `featured_image` VARCHAR(500) NULL,
    `category` VARCHAR(80) NULL,
    `tags` JSON NULL,
    `author` VARCHAR(100) NOT NULL DEFAULT 'Equipo ActivoPOS',
    `status` VARCHAR(20) NOT NULL DEFAULT 'draft',
    `published_at` DATETIME(3) NULL,
    `read_time` VARCHAR(20) NULL,
    `views` INTEGER NOT NULL DEFAULT 0,
    `is_featured` BOOLEAN NOT NULL DEFAULT false,
    `meta_title` VARCHAR(255) NULL,
    `meta_description` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `blog_posts_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `plans` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `price_usd` DOUBLE NOT NULL,
    `description` VARCHAR(191) NULL,
    `features` JSON NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `plans_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `purchase_id` INTEGER NOT NULL,
    `product_id` INTEGER NOT NULL,
    `qty` DECIMAL(10, 3) NOT NULL,
    `cost_usd` DECIMAL(12, 4) NOT NULL,

    INDEX `purchase_items_product_id_idx`(`product_id`),
    INDEX `purchase_items_purchase_id_idx`(`purchase_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchases` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `business_id` INTEGER NOT NULL,
    `supplier_id` INTEGER NOT NULL,
    `reference` VARCHAR(50) NULL,
    `notes` TEXT NULL,
    `status` ENUM('received', 'pending', 'cancelled') NOT NULL DEFAULT 'received',
    `total_usd` DECIMAL(12, 2) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `purchases_business_id_idx`(`business_id`),
    INDEX `purchases_supplier_id_idx`(`supplier_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `segment_faqs` (
    `id` VARCHAR(191) NOT NULL,
    `segment_id` VARCHAR(191) NOT NULL,
    `question` VARCHAR(191) NOT NULL,
    `answer` TEXT NOT NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,

    INDEX `segment_faqs_segment_id_idx`(`segment_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `segments` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `mode` VARCHAR(191) NOT NULL DEFAULT 'product',
    `theme_key` VARCHAR(191) NOT NULL,
    `headline` VARCHAR(191) NOT NULL,
    `subheadline` VARCHAR(191) NOT NULL,
    `meta_title` VARCHAR(191) NOT NULL,
    `meta_description` VARCHAR(191) NOT NULL,
    `hero_image` VARCHAR(191) NULL,
    `pain_1` VARCHAR(191) NOT NULL,
    `pain_2` VARCHAR(191) NOT NULL,
    `pain_3` VARCHAR(191) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT false,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `tag_line` VARCHAR(191) NOT NULL DEFAULT '',
    `icon` VARCHAR(50) NULL,

    UNIQUE INDEX `segments_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable (base state -- ver nota arriba sobre las 4 columnas que faltan a propósito)
CREATE TABLE `social_assets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `post_id` INTEGER NOT NULL,
    `orden` INTEGER NOT NULL DEFAULT 0,
    `imagen_url` VARCHAR(500) NOT NULL,
    `titulo` VARCHAR(200) NULL,
    `subtitulo` VARCHAR(200) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `social_assets_post_id_idx`(`post_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `social_calendar_entries` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `dia` DATE NOT NULL,
    `tipo` VARCHAR(191) NOT NULL,
    `segmento` VARCHAR(191) NOT NULL,
    `objetivo` VARCHAR(191) NOT NULL,
    `titulo` VARCHAR(191) NOT NULL,
    `subtitulo` TEXT NULL,
    `caption` TEXT NULL,
    `hashtags` TEXT NULL,
    `estado` VARCHAR(191) NOT NULL DEFAULT 'pendiente',
    `content_engine` VARCHAR(191) NOT NULL,
    `buffer_post_id` VARCHAR(191) NULL,
    `notas` TEXT NULL,
    `social_post_id` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `social_calendar_entries_dia_idx`(`dia`),
    INDEX `social_calendar_entries_social_post_id_fkey`(`social_post_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `social_posts` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tipo` ENUM('post', 'story', 'carrusel', 'reel') NOT NULL DEFAULT 'post',
    `nicho` VARCHAR(80) NULL,
    `titulo` VARCHAR(200) NOT NULL,
    `descripcion` TEXT NULL,
    `caption` TEXT NULL,
    `hashtags` JSON NULL,
    `estado` ENUM('pendiente', 'generado', 'publicado', 'error') NOT NULL DEFAULT 'pendiente',
    `imagen_url` VARCHAR(500) NULL,
    `error_msg` VARCHAR(500) NULL,
    `buffer_id` VARCHAR(80) NULL,
    `fecha_programada` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `buffer_post_id` VARCHAR(80) NULL,
    `buffer_status` VARCHAR(20) NOT NULL DEFAULT 'draft',
    `content_engine` VARCHAR(40) NULL,
    `aspect` VARCHAR(10) NULL DEFAULT '4:5',

    INDEX `social_posts_estado_idx`(`estado`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `suppliers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `business_id` INTEGER NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `rif` VARCHAR(20) NULL,
    `phone` VARCHAR(20) NULL,
    `email` VARCHAR(100) NULL,
    `address` VARCHAR(255) NULL,
    `notes` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `suppliers_business_id_idx`(`business_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `purchase_items` ADD CONSTRAINT `purchase_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_items` ADD CONSTRAINT `purchase_items_purchase_id_fkey` FOREIGN KEY (`purchase_id`) REFERENCES `purchases`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchases` ADD CONSTRAINT `purchases_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchases` ADD CONSTRAINT `purchases_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `segment_faqs` ADD CONSTRAINT `segment_faqs_segment_id_fkey` FOREIGN KEY (`segment_id`) REFERENCES `segments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_assets` ADD CONSTRAINT `social_assets_post_id_fkey` FOREIGN KEY (`post_id`) REFERENCES `social_posts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_calendar_entries` ADD CONSTRAINT `social_calendar_entries_social_post_id_fkey` FOREIGN KEY (`social_post_id`) REFERENCES `social_posts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `suppliers` ADD CONSTRAINT `suppliers_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
