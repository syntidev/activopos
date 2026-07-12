-- ============================================================
-- ActivoPOS — Fix 5 imágenes rotas (404 confirmado) boutique-demo
-- Sprint Demo-3 | 2026-07-12
--
-- Las 5 URLs de Unsplash sembradas en Demo-1 murieron (404 confirmado
-- por curl antes de este fix). Recomendación de CLI-C aplicada:
-- en vez de otro hotlink frágil a un CDN externo, se descargaron las
-- imágenes reales y se subieron a storage/tenants/80/products/
-- (convención real del proyecto para imágenes de producto, la misma
-- que usa /api/upload/image — NO /uploads/ legacy, que es solo para
-- logos históricos).
--
-- Las 5 URLs finales fueron verificadas con curl contra
-- http://activopos.test/storage/tenants/80/products/*.webp -> 200
-- antes de este UPDATE.
-- ============================================================

SET NAMES utf8mb4;

UPDATE products SET images = '["/storage/tenants/80/products/ab8703b4-9ff4-4073-83d1-db85cb4e0b78.webp"]'
WHERE business_id = 80 AND name = 'Falda Plisada';

UPDATE products SET images = '["/storage/tenants/80/products/f0e60bf7-8098-4069-beef-7781a37f1043.webp"]'
WHERE business_id = 80 AND name = 'Sandalias Planas';

UPDATE products SET images = '["/storage/tenants/80/products/c2c6a36c-3491-4b68-8c95-53524c1e4bf9.webp"]'
WHERE business_id = 80 AND name = 'Botas Altas';

UPDATE products SET images = '["/storage/tenants/80/products/34e70fae-0793-4c5b-8848-0ee28022685b.webp"]'
WHERE business_id = 80 AND name = 'Paraguas Plegable';

UPDATE products SET images = '["/storage/tenants/80/products/583c10c0-38e9-4134-9b61-096973ecc895.webp"]'
WHERE business_id = 80 AND name = 'Guantes de Invierno';
