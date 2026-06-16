-- Sprint 5: Extend SaleMode enum + add Order/OrderItem models
-- Run: npx prisma migrate deploy (when DB is available)

-- ── Extend SaleMode enum ──────────────────────────────────────
ALTER TABLE `products`
  MODIFY COLUMN `sale_mode` ENUM('unit','weight','service','length','volume','package') NOT NULL DEFAULT 'unit';

ALTER TABLE `sale_items`
  MODIFY COLUMN `sale_mode` VARCHAR(20) NOT NULL;

-- ── Expand unit_label fields ─────────────────────────────────
ALTER TABLE `products`
  MODIFY COLUMN `base_unit_label` VARCHAR(20) NOT NULL DEFAULT 'und';

ALTER TABLE `sale_items`
  MODIFY COLUMN `unit_label` VARCHAR(20) NOT NULL;

-- ── New enums (stored as VARCHAR in order tables) ─────────────

-- ── Create orders table ───────────────────────────────────────
CREATE TABLE `orders` (
  `id`             INT NOT NULL AUTO_INCREMENT,
  `business_id`    INT NOT NULL,
  `order_number`   VARCHAR(20) NOT NULL,
  `status`         ENUM('received','preparing','ready','dispatched','delivered','cancelled') NOT NULL DEFAULT 'received',
  `origin`         ENUM('whatsapp','catalog','phone','pos') NOT NULL DEFAULT 'whatsapp',
  `client_id`      INT NULL,
  `client_name`    VARCHAR(120) NULL,
  `client_phone`   VARCHAR(20) NULL,
  `client_address` TEXT NULL,
  `notes`          TEXT NULL,
  `delivery_fee`   DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `total_usd`      DECIMAL(10,2) NOT NULL,
  `total_bs`       DECIMAL(12,2) NOT NULL,
  `rate_used`      DECIMAL(10,4) NOT NULL,
  `estimated_time` INT NULL,
  `sale_id`        INT NULL,
  `created_at`     DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at`     DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `orders_business_id_idx` (`business_id`),
  INDEX `orders_client_id_idx` (`client_id`),
  INDEX `orders_status_idx` (`status`),
  CONSTRAINT `orders_business_id_fkey` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`),
  CONSTRAINT `orders_client_id_fkey`   FOREIGN KEY (`client_id`)   REFERENCES `clients` (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ── Create order_items table ──────────────────────────────────
CREATE TABLE `order_items` (
  `id`                  INT NOT NULL AUTO_INCREMENT,
  `order_id`            INT NOT NULL,
  `product_id`          INT NOT NULL,
  `product_name`        VARCHAR(120) NOT NULL,
  `variant_label`       VARCHAR(100) NULL,
  `quantity`            DECIMAL(10,3) NOT NULL,
  `price_per_unit_usd`  DECIMAL(10,4) NOT NULL,
  `subtotal_usd`        DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `order_items_order_id_idx` (`order_id`),
  CONSTRAINT `order_items_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
