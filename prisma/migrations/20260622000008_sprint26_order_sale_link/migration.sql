-- Sprint 26 BLOQUE 1: order→sale link + catalog SaleOrigin
-- Add catalog value to SaleOrigin enum
ALTER TABLE `sales` MODIFY `origin` ENUM('pos', 'quote', 'credit', 'catalog') NOT NULL DEFAULT 'pos';

-- Add unique constraint + FK from orders.sale_id → sales.id
CREATE UNIQUE INDEX `orders_sale_id_key` ON `orders`(`sale_id`);
ALTER TABLE `orders` ADD CONSTRAINT `orders_sale_id_fkey` FOREIGN KEY (`sale_id`) REFERENCES `sales`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
