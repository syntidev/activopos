-- ============================================================
-- ActivoPOS — Ampliación catálogo boutique-demo
-- Sprint Demo-1 | 2026-07-12
-- Corregido Sprint Demo-4: business_id/category_id ya NO van
-- hardcodeados -- se resuelven dinámicamente por catalog_slug/name.
-- El script original fallaba en producción (products_business_id_fkey)
-- porque business_id=80 y category_id=13/14/15/16 eran los IDs de MI
-- DB local -- en el VPS boutique-demo tiene otro id. Portable ahora
-- entre cualquier entorno.
--
-- Estado ANTES de correr este script en LOCAL (verificado, no asumido):
--   4 categorías reales: Ropa, Calzado, Accesorios, Otros
--   6 productos existentes
--   NO existe categoría "Farmacia" para este tenant -- premisa del
--   prompt original sobre "Farmacia sin ícono" no aplica a boutique-demo,
--   no se crea esa categoría (no tiene sentido en una boutique de ropa).
--
-- Backup previo (fuera de este repo, en scratchpad de sesión local):
--   boutique-demo-products-backup-20260712.sql
--   boutique-demo-inventory-backup-20260712.sql
--
-- Resultado esperado: 44 productos nuevos (+ los existentes al momento
-- de correr). Distribución: Ropa 18(15 nuevos), Calzado 12(11 nuevos),
-- Accesorios 12(10 nuevos), Otros 8(8 nuevos).
-- Un producto ("Camiseta Básica Algodón") queda con variantes de talla
-- (S/M/L/XL) visibles en el sistema vía ProductVariant.
--
-- created_by en inventory_entries: admin del tenant boutique-demo
-- (primer admin activo encontrado, no un ID fijo).
-- ============================================================

SET NAMES utf8mb4;

-- ── Resolución dinámica de IDs — portable entre local y VPS ──
SET @bid          = (SELECT id FROM businesses WHERE catalog_slug = 'boutique-demo');
SET @cat_ropa       = (SELECT id FROM categories WHERE business_id = @bid AND name = 'Ropa');
SET @cat_calzado    = (SELECT id FROM categories WHERE business_id = @bid AND name = 'Calzado');
SET @cat_accesorios = (SELECT id FROM categories WHERE business_id = @bid AND name = 'Accesorios');
SET @cat_otros      = (SELECT id FROM categories WHERE business_id = @bid AND name = 'Otros');
SET @admin_id       = (SELECT id FROM users WHERE business_id = @bid AND role IN ('admin','super_admin') AND is_active = 1 ORDER BY id ASC LIMIT 1);

-- Diagnóstico visible ANTES de insertar — si algo sale NULL acá, el
-- script va a fallar en el primer INSERT (business_id/category_id NOT
-- resuelto). Revisar esta fila antes de asumir que corrió bien.
SELECT @bid AS business_id, @cat_ropa AS cat_ropa, @cat_calzado AS cat_calzado,
       @cat_accesorios AS cat_accesorios, @cat_otros AS cat_otros, @admin_id AS admin_id;

-- ── ROPA — 15 nuevos ────────────────────────────────────────
INSERT INTO products (business_id, category_id, name, description, price_per_unit_usd, cost_per_unit_usd, images, show_in_catalog, catalog_visibility, min_stock, stock_alert_threshold, active, created_at, updated_at) VALUES
(@bid, @cat_ropa, 'Blusa Manga Larga', 'Blusa de manga larga en tela liviana, ideal para uso diario.', 22.00, 11.0000, '["https://images.unsplash.com/photo-1564257631407-4deb1f99d992?w=600"]', 1, 'visible', 3, 5, 1, NOW(), NOW()),
(@bid, @cat_ropa, 'Camisa Denim', 'Camisa de mezclilla clásica, corte relajado.', 28.00, 14.0000, '["https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=600"]', 1, 'visible', 3, 5, 1, NOW(), NOW()),
(@bid, @cat_ropa, 'Falda Plisada', 'Falda plisada midi, tela con caída elegante.', 26.00, 13.0000, '["https://images.unsplash.com/photo-1551163943-3f6a855d1153?w=600"]', 1, 'visible', 3, 5, 1, NOW(), NOW()),
(@bid, @cat_ropa, 'Short Casual', 'Short de algodón para uso casual y diario.', 18.00, 9.0000, '["https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=600"]', 1, 'visible', 4, 5, 1, NOW(), NOW()),
(@bid, @cat_ropa, 'Suéter Cuello Alto', 'Suéter tejido de cuello alto, ideal para temporada fría.', 32.00, 16.0000, '["https://images.unsplash.com/photo-1576871337622-98d48d1cf531?w=600"]', 1, 'visible', 3, 5, 1, NOW(), NOW()),
(@bid, @cat_ropa, 'Chaqueta de Mezclilla', 'Chaqueta de mezclilla clásica, unisex.', 48.00, 24.0000, '["https://images.unsplash.com/photo-1495105787522-5334e3ffa0ef?w=600"]', 1, 'visible', 2, 5, 1, NOW(), NOW()),
(@bid, @cat_ropa, 'Vestido de Noche', 'Vestido largo para ocasiones formales.', 65.00, 33.0000, '["https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600"]', 1, 'visible', 2, 5, 1, NOW(), NOW()),
(@bid, @cat_ropa, 'Pantalón de Vestir', 'Pantalón de vestir corte recto, tela con elastano.', 38.00, 19.0000, '["https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=600"]', 1, 'visible', 3, 5, 1, NOW(), NOW()),
(@bid, @cat_ropa, 'Leggings Deportivos', 'Leggings de compresión, tela transpirable.', 16.00, 8.0000, '["https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=600"]', 1, 'visible', 5, 5, 1, NOW(), NOW()),
(@bid, @cat_ropa, 'Blazer Formal', 'Blazer entallado, ideal para oficina.', 55.00, 28.0000, '["https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600"]', 1, 'visible', 2, 5, 1, NOW(), NOW()),
(@bid, @cat_ropa, 'Camisa a Cuadros', 'Camisa de franela a cuadros, corte regular.', 24.00, 12.0000, '["https://images.unsplash.com/photo-1589310243389-96a5483213a8?w=600"]', 1, 'visible', 4, 5, 1, NOW(), NOW()),
(@bid, @cat_ropa, 'Vestido Casual Verano', 'Vestido ligero de tirantes, estampado floral.', 30.00, 15.0000, '["https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=600"]', 1, 'visible', 3, 5, 1, NOW(), NOW()),
(@bid, @cat_ropa, 'Jeans Skinny', 'Jeans corte skinny, tela stretch.', 34.00, 17.0000, '["https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=600"]', 1, 'visible', 4, 5, 1, NOW(), NOW()),
(@bid, @cat_ropa, 'Cárdigan Tejido', 'Cárdigan de punto abierto, largo hasta cadera.', 27.00, 13.5000, '["https://images.unsplash.com/photo-1591369822096-ffd140ec948f?w=600"]', 1, 'visible', 3, 5, 1, NOW(), NOW()),
(@bid, @cat_ropa, 'Camiseta Básica Algodón', 'Camiseta 100% algodón, disponible en varias tallas.', 12.00, 6.0000, '["https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600"]', 1, 'visible', 0, 5, 1, NOW(), NOW());

-- ── CALZADO — 11 nuevos ─────────────────────────────────────
INSERT INTO products (business_id, category_id, name, description, price_per_unit_usd, cost_per_unit_usd, images, show_in_catalog, catalog_visibility, min_stock, stock_alert_threshold, active, created_at, updated_at) VALUES
(@bid, @cat_calzado, 'Sandalias de Tacón', 'Sandalias de tacón medio, correa al tobillo.', 32.00, 16.0000, '["https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=600"]', 1, 'visible', 3, 5, 1, NOW(), NOW()),
(@bid, @cat_calzado, 'Botines de Cuero', 'Botines de cuero genuino, suela antideslizante.', 48.00, 24.0000, '["https://images.unsplash.com/photo-1608256246200-53e635b5b65f?w=600"]', 1, 'visible', 2, 5, 1, NOW(), NOW()),
(@bid, @cat_calzado, 'Tenis Deportivos', 'Tenis con amortiguación, para uso diario o deporte.', 40.00, 20.0000, '["https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=600"]', 1, 'visible', 4, 5, 1, NOW(), NOW()),
(@bid, @cat_calzado, 'Zapatos de Vestir', 'Zapatos formales de cuero, punta redonda.', 52.00, 26.0000, '["https://images.unsplash.com/photo-1614252369475-531eba835eb1?w=600"]', 1, 'visible', 2, 5, 1, NOW(), NOW()),
(@bid, @cat_calzado, 'Sandalias Planas', 'Sandalias planas de cuero sintético.', 20.00, 10.0000, '["https://images.unsplash.com/photo-1603487742131-4160ec999306?w=600"]', 1, 'visible', 5, 5, 1, NOW(), NOW()),
(@bid, @cat_calzado, 'Botas Altas', 'Botas altas hasta la rodilla, tacón bajo.', 58.00, 30.0000, '["https://images.unsplash.com/photo-1520639888713-7851133b1ed0?w=600"]', 1, 'visible', 2, 5, 1, NOW(), NOW()),
(@bid, @cat_calzado, 'Mocasines', 'Mocasines de cuero, forro acolchado.', 42.00, 21.0000, '["https://images.unsplash.com/photo-1533867617858-e7b97e060509?w=600"]', 1, 'visible', 3, 5, 1, NOW(), NOW()),
(@bid, @cat_calzado, 'Zapatillas de Casa', 'Pantuflas suaves, suela de goma.', 14.00, 7.0000, '["https://images.unsplash.com/photo-1622188149756-a2298a2c5527?w=600"]', 1, 'visible', 6, 5, 1, NOW(), NOW()),
(@bid, @cat_calzado, 'Tacones Stiletto', 'Tacón fino alto, ideal para eventos.', 45.00, 23.0000, '["https://images.unsplash.com/photo-1596703263926-eb0762ee17e4?w=600"]', 1, 'visible', 2, 5, 1, NOW(), NOW()),
(@bid, @cat_calzado, 'Alpargatas', 'Alpargatas de lona con suela de yute.', 18.00, 9.0000, '["https://images.unsplash.com/photo-1560343090-f0409e92791a?w=600"]', 1, 'visible', 5, 5, 1, NOW(), NOW()),
(@bid, @cat_calzado, 'Sandalias Deportivas', 'Sandalias deportivas con velcro ajustable.', 22.00, 11.0000, '["https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=600"]', 1, 'visible', 4, 5, 1, NOW(), NOW());

-- ── ACCESORIOS — 10 nuevos ──────────────────────────────────
INSERT INTO products (business_id, category_id, name, description, price_per_unit_usd, cost_per_unit_usd, images, show_in_catalog, catalog_visibility, min_stock, stock_alert_threshold, active, created_at, updated_at) VALUES
(@bid, @cat_accesorios, 'Cinturón de Cuero', 'Cinturón de cuero genuino, hebilla metálica.', 18.00, 9.0000, '["https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600"]', 1, 'visible', 5, 5, 1, NOW(), NOW()),
(@bid, @cat_accesorios, 'Reloj de Pulsera', 'Reloj análogo, correa de cuero.', 45.00, 22.0000, '["https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=600"]', 1, 'visible', 3, 5, 1, NOW(), NOW()),
(@bid, @cat_accesorios, 'Collar Dorado', 'Collar chapado en oro, diseño minimalista.', 15.00, 7.0000, '["https://images.unsplash.com/photo-1611085583191-a3b181a88401?w=600"]', 1, 'visible', 6, 5, 1, NOW(), NOW()),
(@bid, @cat_accesorios, 'Aretes de Perla', 'Aretes con perla sintética, cierre a presión.', 12.00, 6.0000, '["https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=600"]', 1, 'visible', 6, 5, 1, NOW(), NOW()),
(@bid, @cat_accesorios, 'Pulsera de Plata', 'Pulsera de plata 925, diseño cadena fina.', 14.00, 7.0000, '["https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=600"]', 1, 'visible', 5, 5, 1, NOW(), NOW()),
(@bid, @cat_accesorios, 'Bufanda de Lana', 'Bufanda tejida de lana, varios colores.', 16.00, 8.0000, '["https://images.unsplash.com/photo-1520903920243-00d872a2d1c9?w=600"]', 1, 'visible', 5, 5, 1, NOW(), NOW()),
(@bid, @cat_accesorios, 'Cartera Pequeña', 'Cartera pequeña de mano, cierre cremallera.', 28.00, 14.0000, '["https://images.unsplash.com/photo-1591561954557-26941169b49e?w=600"]', 1, 'visible', 3, 5, 1, NOW(), NOW()),
(@bid, @cat_accesorios, 'Mochila Casual', 'Mochila urbana con compartimento para laptop.', 38.00, 19.0000, '["https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600"]', 1, 'visible', 3, 5, 1, NOW(), NOW()),
(@bid, @cat_accesorios, 'Lentes de Sol', 'Lentes de sol con protección UV400.', 22.00, 11.0000, '["https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=600"]', 1, 'visible', 5, 5, 1, NOW(), NOW()),
(@bid, @cat_accesorios, 'Pañuelo de Seda', 'Pañuelo de seda estampado, 90x90cm.', 13.00, 6.5000, '["https://images.unsplash.com/photo-1601924994987-69e26d50dc26?w=600"]', 1, 'visible', 5, 5, 1, NOW(), NOW());

-- ── OTROS — 8 nuevos ────────────────────────────────────────
INSERT INTO products (business_id, category_id, name, description, price_per_unit_usd, cost_per_unit_usd, images, show_in_catalog, catalog_visibility, min_stock, stock_alert_threshold, active, created_at, updated_at) VALUES
(@bid, @cat_otros, 'Perfume Floral 50ml', 'Fragancia floral de larga duración, frasco 50ml.', 35.00, 17.0000, '["https://images.unsplash.com/photo-1541643600914-78b084683601?w=600"]', 1, 'visible', 3, 5, 1, NOW(), NOW()),
(@bid, @cat_otros, 'Paraguas Plegable', 'Paraguas compacto, resistente al viento.', 12.00, 6.0000, '["https://images.unsplash.com/photo-1519692933481-e162a57d6721?w=600"]', 1, 'visible', 6, 5, 1, NOW(), NOW()),
(@bid, @cat_otros, 'Billetera de Cuero', 'Billetera de cuero con múltiples compartimentos.', 20.00, 10.0000, '["https://images.unsplash.com/photo-1627123424574-724758594e93?w=600"]', 1, 'visible', 5, 5, 1, NOW(), NOW()),
(@bid, @cat_otros, 'Kit de Cuidado de Calzado', 'Set de limpieza y cuidado para zapatos de cuero.', 15.00, 7.0000, '["https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=600"]', 1, 'visible', 4, 5, 1, NOW(), NOW()),
(@bid, @cat_otros, 'Estuche para Lentes', 'Estuche rígido para lentes de sol o graduados.', 8.00, 4.0000, '["https://images.unsplash.com/photo-1591076482161-42ce6da69f67?w=600"]', 1, 'visible', 8, 5, 1, NOW(), NOW()),
(@bid, @cat_otros, 'Set de Accesorios para Cabello', 'Set de ganchos y bandas para el cabello.', 10.00, 5.0000, '["https://images.unsplash.com/photo-1522336572468-97b06e8ef143?w=600"]', 1, 'visible', 8, 5, 1, NOW(), NOW()),
(@bid, @cat_otros, 'Bolsa Reutilizable de Tela', 'Bolsa ecológica de tela resistente.', 6.00, 3.0000, '["https://images.unsplash.com/photo-1544816155-12df9643f363?w=600"]', 1, 'visible', 10, 5, 1, NOW(), NOW()),
(@bid, @cat_otros, 'Guantes de Invierno', 'Guantes de lana térmicos, talla única.', 14.00, 7.0000, '["https://images.unsplash.com/photo-1483721310020-03333e577078?w=600"]', 1, 'visible', 5, 5, 1, NOW(), NOW());

-- ============================================================
-- Stock inicial (InventoryEntry) para todos los productos NUEVOS
-- que NO tienen variantes.
-- ============================================================

INSERT INTO inventory_entries (business_id, product_id, quantity, waste, entry_type, cost_per_unit_usd, notes, created_by, entered_at, created_at)
SELECT @bid, p.id, stock_map.qty, 0, 'adjustment', p.cost_per_unit_usd, 'Seed inicial catálogo demo boutique', @admin_id, NOW(), NOW()
FROM products p
JOIN (
  SELECT 'Blusa Manga Larga' AS name, 18 AS qty UNION ALL
  SELECT 'Camisa Denim', 14 UNION ALL
  SELECT 'Falda Plisada', 16 UNION ALL
  SELECT 'Short Casual', 22 UNION ALL
  SELECT 'Suéter Cuello Alto', 12 UNION ALL
  SELECT 'Chaqueta de Mezclilla', 8 UNION ALL
  SELECT 'Vestido de Noche', 6 UNION ALL
  SELECT 'Pantalón de Vestir', 15 UNION ALL
  SELECT 'Leggings Deportivos', 25 UNION ALL
  SELECT 'Blazer Formal', 7 UNION ALL
  SELECT 'Camisa a Cuadros', 18 UNION ALL
  SELECT 'Vestido Casual Verano', 14 UNION ALL
  SELECT 'Jeans Skinny', 20 UNION ALL
  SELECT 'Cárdigan Tejido', 13 UNION ALL
  SELECT 'Sandalias de Tacón', 12 UNION ALL
  SELECT 'Botines de Cuero', 9 UNION ALL
  SELECT 'Tenis Deportivos', 20 UNION ALL
  SELECT 'Zapatos de Vestir', 10 UNION ALL
  SELECT 'Sandalias Planas', 22 UNION ALL
  SELECT 'Botas Altas', 8 UNION ALL
  SELECT 'Mocasines', 14 UNION ALL
  SELECT 'Zapatillas de Casa', 28 UNION ALL
  SELECT 'Tacones Stiletto', 9 UNION ALL
  SELECT 'Alpargatas', 24 UNION ALL
  SELECT 'Sandalias Deportivas', 18 UNION ALL
  SELECT 'Cinturón de Cuero', 20 UNION ALL
  SELECT 'Reloj de Pulsera', 11 UNION ALL
  SELECT 'Collar Dorado', 26 UNION ALL
  SELECT 'Aretes de Perla', 30 UNION ALL
  SELECT 'Pulsera de Plata', 22 UNION ALL
  SELECT 'Bufanda de Lana', 19 UNION ALL
  SELECT 'Cartera Pequeña', 13 UNION ALL
  SELECT 'Mochila Casual', 15 UNION ALL
  SELECT 'Lentes de Sol', 21 UNION ALL
  SELECT 'Pañuelo de Seda', 17 UNION ALL
  SELECT 'Perfume Floral 50ml', 14 UNION ALL
  SELECT 'Paraguas Plegable', 25 UNION ALL
  SELECT 'Billetera de Cuero', 18 UNION ALL
  SELECT 'Kit de Cuidado de Calzado', 16 UNION ALL
  SELECT 'Estuche para Lentes', 32 UNION ALL
  SELECT 'Set de Accesorios para Cabello', 28 UNION ALL
  SELECT 'Bolsa Reutilizable de Tela', 40 UNION ALL
  SELECT 'Guantes de Invierno', 20
) AS stock_map ON stock_map.name = p.name
WHERE p.business_id = @bid;

-- ============================================================
-- Variantes de talla para el producto flagship (visible en sistema)
-- ============================================================

UPDATE products SET has_variants = 1
WHERE business_id = @bid AND name = 'Camiseta Básica Algodón';

INSERT INTO product_variants (product_id, tipo, valor, precio_extra, stock, is_active, sort_order, created_at)
SELECT p.id, 'talla', v.valor, 0, v.stock, 1, v.sort_order, NOW()
FROM products p
JOIN (
  SELECT 'S' AS valor, 8 AS stock, 0 AS sort_order UNION ALL
  SELECT 'M', 15, 1 UNION ALL
  SELECT 'L', 12, 2 UNION ALL
  SELECT 'XL', 6, 3
) AS v ON 1=1
WHERE p.business_id = @bid AND p.name = 'Camiseta Básica Algodón';
