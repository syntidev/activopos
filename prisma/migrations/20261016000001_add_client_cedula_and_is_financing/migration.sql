-- Cédula como snapshot por pedido/venta + marca de financiadora en métodos de pago.
-- Solo ADD COLUMN: sin pérdida de datos.
ALTER TABLE `orders` ADD COLUMN `client_cedula` VARCHAR(20) NULL;
ALTER TABLE `payment_methods` ADD COLUMN `is_financing` BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE `sales` ADD COLUMN `client_cedula` VARCHAR(20) NULL;
