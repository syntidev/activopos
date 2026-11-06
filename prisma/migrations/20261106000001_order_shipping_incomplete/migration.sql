-- Aditiva: pedido de envío con datos por completar (checkout sin fricción).
ALTER TABLE `orders` ADD COLUMN `shipping_incomplete` BOOLEAN NOT NULL DEFAULT false;
