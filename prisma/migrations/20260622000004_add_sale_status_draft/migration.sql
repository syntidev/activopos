-- Add 'draft' value to SaleStatus enum
-- draft = ticket abierto en POS, no confirmado, sin descuento de inventario
ALTER TABLE `sales` MODIFY COLUMN `status` ENUM('draft','quote','pending','paid','cancelled') NOT NULL DEFAULT 'pending';
