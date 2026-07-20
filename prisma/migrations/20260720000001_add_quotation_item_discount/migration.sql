-- AlterTable: descuento porcentual opcional por ítem de cotización.
-- Aditiva y nullable: las filas existentes quedan en NULL (sin descuento).
ALTER TABLE `quotation_items` ADD COLUMN `discount_pct` DECIMAL(5,2) NULL;
