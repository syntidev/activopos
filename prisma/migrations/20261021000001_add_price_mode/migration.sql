-- Modo de precio del ticket (bcv | divisa) y origen del precio por línea. Solo columnas nuevas:
-- NOT NULL con DEFAULT 'bcv' (filas existentes y otras apps de la base compartida siguen igual) o NULL.
ALTER TABLE `sales` ADD COLUMN `price_mode` VARCHAR(10) NOT NULL DEFAULT 'bcv';
ALTER TABLE `orders` ADD COLUMN `price_mode` VARCHAR(10) NOT NULL DEFAULT 'bcv';
ALTER TABLE `sale_items` ADD COLUMN `price_source` VARCHAR(15) NULL;
ALTER TABLE `order_items` ADD COLUMN `price_source` VARCHAR(15) NULL;
