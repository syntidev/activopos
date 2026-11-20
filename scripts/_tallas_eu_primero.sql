-- Tallas EU primero (negocio 33): 'US X · EU Y'  ->  'EU Y · US X'.
-- Solo reescribe el texto de product_variants.valor. NO toca sku, barcode, stock ni precios.
-- NO ejecutado: lo corre Carlos. Requiere MariaDB >= 10.0.5 (REGEXP_REPLACE).
-- La búsqueda por talla (lib/product-search.ts) compara tokens exactos, así que el orden no la afecta:
-- esto solo cambia lo que se VE primero en el selector de tallas.
--
-- Orden de uso:
--   1) Vista previa (solo lectura)
--   2) Respaldo
--   3) UPDATE
--   4) Verificación
--   El REVERSO está al final.

-- 1) VISTA PREVIA: cuántas se reescriben y cómo quedan (no modifica nada)
SELECT COUNT(*) AS por_reescribir
FROM product_variants v JOIN products p ON p.id = v.product_id
WHERE p.business_id = 33 AND v.valor REGEXP '^US [0-9.]+ · EU .+$';

SELECT v.id, v.valor AS antes,
       REGEXP_REPLACE(v.valor, '^US ([0-9.]+) · EU (.+)$', 'EU \\2 · US \\1') AS despues
FROM product_variants v JOIN products p ON p.id = v.product_id
WHERE p.business_id = 33 AND v.valor REGEXP '^US [0-9.]+ · EU .+$'
ORDER BY v.id LIMIT 50;

-- 2) RESPALDO (tabla de ids y valores originales; es lo que usa el reverso exacto)
CREATE TABLE IF NOT EXISTS _bak_variant_valor_33 AS
SELECT v.id, v.valor
FROM product_variants v JOIN products p ON p.id = v.product_id
WHERE p.business_id = 33 AND v.valor REGEXP '^US [0-9.]+ · EU .+$';

-- 3) UPDATE
UPDATE product_variants v JOIN products p ON p.id = v.product_id
SET v.valor = REGEXP_REPLACE(v.valor, '^US ([0-9.]+) · EU (.+)$', 'EU \\2 · US \\1')
WHERE p.business_id = 33 AND v.valor REGEXP '^US [0-9.]+ · EU .+$';

-- 4) VERIFICACIÓN: no debe quedar ninguna con US primero, y las reescritas deben empezar con EU
SELECT COUNT(*) AS aun_con_us_primero
FROM product_variants v JOIN products p ON p.id = v.product_id
WHERE p.business_id = 33 AND v.valor REGEXP '^US [0-9.]+ · EU .+$';

SELECT COUNT(*) AS ahora_eu_primero
FROM product_variants v JOIN products p ON p.id = v.product_id
WHERE p.business_id = 33 AND v.valor REGEXP '^EU .+ · US [0-9.]+$';

-- ================= REVERSO =================
-- Opción A (exacto, desde el respaldo del paso 2):
-- UPDATE product_variants v JOIN _bak_variant_valor_33 b ON b.id = v.id SET v.valor = b.valor;
--
-- Opción B (por patrón, si no hay respaldo): 'EU Y · US X' -> 'US X · EU Y'
-- UPDATE product_variants v JOIN products p ON p.id = v.product_id
-- SET v.valor = REGEXP_REPLACE(v.valor, '^EU (.+) · US ([0-9.]+)$', 'US \\2 · EU \\1')
-- WHERE p.business_id = 33 AND v.valor REGEXP '^EU .+ · US [0-9.]+$';
--
-- Cuando todo esté confirmado: DROP TABLE _bak_variant_valor_33;
