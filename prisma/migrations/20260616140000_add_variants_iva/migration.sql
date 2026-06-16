-- Sprint 5: variantes, IVA, imágenes múltiples
-- Cubre todos los cambios al schema desde la última migración (add_gastos)

-- ── businesses: add IVA + catalog fields ──────────────────────────────────────
ALTER TABLE `businesses`
    ADD COLUMN `iva_enabled`  BOOLEAN        NOT NULL DEFAULT false  AFTER `active`,
    ADD COLUMN `iva_pct`      DECIMAL(5,2)   NOT NULL DEFAULT 16     AFTER `iva_enabled`,
    ADD COLUMN `catalog_plan` BOOLEAN        NOT NULL DEFAULT false  AFTER `iva_pct`,
    ADD COLUMN `catalog_slug` VARCHAR(80)    NULL                    AFTER `catalog_plan`;

-- ── products: rename image_path → images (TEXT) + new columns ─────────────────
ALTER TABLE `products`
    CHANGE `image_path`  `images`          TEXT         NULL,
    ADD COLUMN `has_variants`    BOOLEAN NOT NULL DEFAULT false AFTER `images`,
    ADD COLUMN `show_in_catalog` BOOLEAN NOT NULL DEFAULT false AFTER `has_variants`,
    ADD COLUMN `is_available`    BOOLEAN NOT NULL DEFAULT true  AFTER `show_in_catalog`;

-- ── product_variants table ────────────────────────────────────────────────────
CREATE TABLE `product_variants` (
    `id`           INT            NOT NULL AUTO_INCREMENT,
    `product_id`   INT            NOT NULL,
    `tipo`         VARCHAR(30)    NOT NULL,
    `valor`        VARCHAR(50)    NOT NULL,
    `sku`          VARCHAR(50)    NULL,
    `precio_extra` DECIMAL(10,2)  NOT NULL DEFAULT 0,
    `stock`        INT            NOT NULL DEFAULT 0,
    `color_hex`    VARCHAR(7)     NULL,
    `is_active`    BOOLEAN        NOT NULL DEFAULT true,
    `sort_order`   INT            NOT NULL DEFAULT 0,
    `created_at`   DATETIME(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `product_variants`
    ADD CONSTRAINT `product_variants_product_id_fkey`
    FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
