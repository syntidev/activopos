-- Financiamiento (Cashea) declarado en el ticket (venta y pedido) y método declarado en el checkout del catálogo.
-- Solo columnas NULL nuevas: aditivo, sin pérdida de datos, sin tocar filas existentes ni otras apps de la base compartida.
ALTER TABLE `sales` ADD COLUMN `financing_status` VARCHAR(12) NULL,
    ADD COLUMN `financing_provider` VARCHAR(40) NULL,
    ADD COLUMN `financing_phrase` VARCHAR(80) NULL;

ALTER TABLE `orders` ADD COLUMN `financing_status` VARCHAR(12) NULL,
    ADD COLUMN `financing_provider` VARCHAR(40) NULL,
    ADD COLUMN `financing_phrase` VARCHAR(80) NULL,
    ADD COLUMN `payment_kind` VARCHAR(10) NULL;
