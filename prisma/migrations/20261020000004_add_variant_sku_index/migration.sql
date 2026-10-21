-- Búsqueda por SKU de variante (lookup exacto de Alta rápida y escaneo de SKU). Solo un índice: aditivo, sin pérdida de datos.
-- CreateIndex
CREATE INDEX `product_variants_sku_idx` ON `product_variants`(`sku`);
