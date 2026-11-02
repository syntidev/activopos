-- Precio Divisa propio por variante (hotfix variantes/divisa). Solo columna nueva, NULL por defecto:
-- las variantes existentes no cambian de comportamiento y otras apps de la base compartida siguen igual.
ALTER TABLE `product_variants` ADD COLUMN `divisa_price_usd` DOUBLE NULL;
