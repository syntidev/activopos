ALTER TABLE `sale_items`
  ADD COLUMN `cost_per_unit_usd` DECIMAL(10,4) NULL AFTER `price_per_unit_usd`;

-- Backfill best-effort: usa el costo ACTUAL del producto (no hay costo histórico
-- capturado antes de esta migración). Ventas nuevas capturan el costo real al momento de venta.
UPDATE `sale_items` si
JOIN `products` p ON p.id = si.product_id
SET si.cost_per_unit_usd = p.cost_per_unit_usd
WHERE si.cost_per_unit_usd IS NULL;
