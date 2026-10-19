-- Sprint Safetti: barcode por variante (product_variants.barcode, índice normal; unicidad por negocio en código)
-- y marca del producto (products.brand_id -> brands, ON DELETE SET NULL). Solo cambios aditivos: sin pérdida de datos.
-- AlterTable
ALTER TABLE `products` ADD COLUMN `brand_id` INTEGER NULL;
-- AlterTable
ALTER TABLE `product_variants` ADD COLUMN `barcode` VARCHAR(50) NULL;
-- CreateIndex
CREATE INDEX `products_brand_id_idx` ON `products`(`brand_id`);
-- CreateIndex
CREATE INDEX `product_variants_barcode_idx` ON `product_variants`(`barcode`);
-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_brand_id_fkey` FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
