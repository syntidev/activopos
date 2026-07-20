-- Vincula el ticket con la cotización que lo originó.
-- Nullable: la enorme mayoría de las ventas nace en el POS, sin cotización.
-- ON DELETE SET NULL: si se borra una cotización, la venta sobrevive sin origen
-- (nunca al revés — una venta cobrada no puede desaparecer por borrar un papel).
ALTER TABLE `sales` ADD COLUMN `quotation_id` INT NULL;

CREATE INDEX `sales_quotation_id_idx` ON `sales`(`quotation_id`);

ALTER TABLE `sales`
  ADD CONSTRAINT `sales_quotation_id_fkey`
  FOREIGN KEY (`quotation_id`) REFERENCES `quotations`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 'converted' (Cobrada) nunca existió en el enum: la UI mostraba el rótulo
-- para un valor que la DB no podía guardar. Agregarlo al final del ENUM es
-- aditivo — no reescribe ni invalida ninguna fila existente.
ALTER TABLE `quotations`
  MODIFY `status` ENUM('draft','sent','accepted','rejected','expired','converted')
  NOT NULL DEFAULT 'draft';
