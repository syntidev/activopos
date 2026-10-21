-- Financiamiento configurable: elegibilidad efectiva = financiamiento activado en Configuración Y producto no excluido.
-- Por defecto todos los productos entran (financing_excluded = false). Solo cambio aditivo: sin pérdida de datos y sin tocar financing_eligible.
-- AlterTable
ALTER TABLE `products` ADD COLUMN `financing_excluded` BOOLEAN NOT NULL DEFAULT false;
