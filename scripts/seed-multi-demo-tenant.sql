-- ============================================================
-- ActivoPOS — Crear tenant demo "Abasto Multi Demo" (multi-demo)
-- Sprint Demo-6 | 2026-07-12
--
-- Contexto: el prompt original pedía agregar 10 rubros no relacionados
-- (Farmacia, Ferretería, Licorería, Frutería, etc.) a boutique-demo,
-- que es una tienda de ropa -- incoherente para un demo creíble.
-- Decisión (confirmada por Carlos): crear un tenant NUEVO que sí
-- representa un negocio real venezolano donde esta variedad tiene
-- sentido -- un abasto/bodega grande. boutique-demo queda intacto,
-- sin tocar (56 productos, 4 categorías, ya cerrado).
--
-- El "sprint anterior" de Panadería/Repuestos/Juguetería/Embutidos
-- nunca llegó a la DB (confirmado, no existía) -- se define de cero
-- acá junto con las 10 categorías de este mensaje. Total: 14 categorías,
-- 56 productos (4 por categoría).
--
-- Nada de esto existía antes de correr este script -- no aplica backup
-- (no hay datos previos del tenant que perder).
--
-- IDs 100% dinámicos: business_id vía LAST_INSERT_ID() tras crear el
-- negocio (nunca un literal), category_id vía subquery por nombre tras
-- crear las categorías. Portable a cualquier entorno, no repite el bug
-- de Demo-1/Demo-4.
--
-- Las 70 URLs de imagen (14 categorías + 56 productos) fueron
-- verificadas con curl -> 200 antes de escribir esta línea.
-- ============================================================

SET NAMES utf8mb4;

-- ── Negocio ──────────────────────────────────────────────────
INSERT INTO businesses (
  name, catalog_slug, catalog_active, catalog_plan, catalog_title, catalog_desc,
  subscription_active, active, segment, theme_color, updated_at
) VALUES (
  'Abasto Multi Demo', 'multi-demo', 1, 'business', 'Abasto Multi Demo',
  'Encuentra de todo en un solo lugar: farmacia, ferretería, licorería, frutería, mascotas y más.',
  1, 1, 'abastos', '#16A34A', NOW()
);
SET @bid = LAST_INSERT_ID();

-- ── Usuario admin del tenant ─────────────────────────────────
-- Password: MultiDemo2026! (hash bcrypt real generado con bcryptjs, cost 10)
INSERT INTO users (business_id, name, email, password, role, is_active, updated_at)
VALUES (@bid, 'Admin Multi Demo', 'admin@multi-demo.activopos.com',
  '$2b$10$XE7jMcSInNxsBjmLgEdiw.rfnLa5UNrX0Co.wpcho1FgfkZxyfh8.', 'admin', 1, NOW());
SET @admin_id = LAST_INSERT_ID();

-- ── 14 categorías ────────────────────────────────────────────
INSERT INTO categories (business_id, name, color, image_url, sort_order, active) VALUES
(@bid, 'Farmacia',    '#EF4444', 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400', 1,  1),
(@bid, 'Ferretería',  '#78716C', 'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=400', 2,  1),
(@bid, 'Licorería',   '#B45309', 'https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=400', 3,  1),
(@bid, 'Papelería',   '#2563EB', 'https://images.unsplash.com/photo-1568205612837-017257d2310a?w=400', 4,  1),
(@bid, 'Mascotas',    '#D97706', 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=400', 5,  1),
(@bid, 'Frutería',    '#16A34A', 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=400', 6,  1),
(@bid, 'Óptica',      '#0891B2', 'https://images.unsplash.com/photo-1577803645773-f96470509666?w=400', 7,  1),
(@bid, 'Belleza',     '#EC4899', 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=400', 8,  1),
(@bid, 'Electrónica', '#6366F1', 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=400', 9,  1),
(@bid, 'Deportes',    '#F97316', 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=400', 10, 1),
(@bid, 'Panadería',   '#CA8A04', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400', 11, 1),
(@bid, 'Repuestos',   '#475569', 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=400', 12, 1),
(@bid, 'Juguetería',  '#DB2777', 'https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=400', 13, 1),
(@bid, 'Embutidos',   '#DC2626', 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=400', 14, 1);

-- Resolución dinámica por nombre — NUNCA IDs literales
SET @cat_farmacia    = (SELECT id FROM categories WHERE business_id = @bid AND name = 'Farmacia');
SET @cat_ferreteria   = (SELECT id FROM categories WHERE business_id = @bid AND name = 'Ferretería');
SET @cat_licoreria    = (SELECT id FROM categories WHERE business_id = @bid AND name = 'Licorería');
SET @cat_papeleria    = (SELECT id FROM categories WHERE business_id = @bid AND name = 'Papelería');
SET @cat_mascotas     = (SELECT id FROM categories WHERE business_id = @bid AND name = 'Mascotas');
SET @cat_fruteria     = (SELECT id FROM categories WHERE business_id = @bid AND name = 'Frutería');
SET @cat_optica       = (SELECT id FROM categories WHERE business_id = @bid AND name = 'Óptica');
SET @cat_belleza      = (SELECT id FROM categories WHERE business_id = @bid AND name = 'Belleza');
SET @cat_electronica  = (SELECT id FROM categories WHERE business_id = @bid AND name = 'Electrónica');
SET @cat_deportes     = (SELECT id FROM categories WHERE business_id = @bid AND name = 'Deportes');
SET @cat_panaderia    = (SELECT id FROM categories WHERE business_id = @bid AND name = 'Panadería');
SET @cat_repuestos    = (SELECT id FROM categories WHERE business_id = @bid AND name = 'Repuestos');
SET @cat_jugueteria   = (SELECT id FROM categories WHERE business_id = @bid AND name = 'Juguetería');
SET @cat_embutidos    = (SELECT id FROM categories WHERE business_id = @bid AND name = 'Embutidos');

-- Diagnóstico visible ANTES de insertar productos — revisar que nada
-- salga NULL antes de asumir que el resto va a correr bien.
SELECT @bid AS business_id, @admin_id AS admin_id,
       @cat_farmacia AS farmacia, @cat_ferreteria AS ferreteria, @cat_licoreria AS licoreria,
       @cat_papeleria AS papeleria, @cat_mascotas AS mascotas, @cat_fruteria AS fruteria,
       @cat_optica AS optica, @cat_belleza AS belleza, @cat_electronica AS electronica,
       @cat_deportes AS deportes, @cat_panaderia AS panaderia, @cat_repuestos AS repuestos,
       @cat_jugueteria AS jugueteria, @cat_embutidos AS embutidos;

-- ── Productos: unit_type/sale_mode 'unit' por defecto ─────────
INSERT INTO products (business_id, category_id, name, description, price_per_unit_usd, cost_per_unit_usd, images, show_in_catalog, catalog_visibility, min_stock, stock_alert_threshold, active, created_at, updated_at) VALUES
-- Farmacia
(@bid, @cat_farmacia, 'Acetaminofén 500mg', 'Caja x20 tabletas, analgésico y antipirético.', 3.50, 1.5000, '["https://images.unsplash.com/photo-1584362917165-526a968579e8?w=600"]', 1, 'visible', 10, 8, 1, NOW(), NOW()),
(@bid, @cat_farmacia, 'Alcohol Antiséptico 250ml', 'Alcohol isopropílico 70%, uso tópico.', 2.80, 1.2000, '["https://images.unsplash.com/photo-1584362917165-526a968579e8?w=600"]', 1, 'visible', 12, 8, 1, NOW(), NOW()),
(@bid, @cat_farmacia, 'Curitas Caja x20', 'Curitas adhesivas hipoalergénicas.', 2.20, 0.9000, '["https://images.unsplash.com/photo-1603398938378-e54eab446dde?w=600"]', 1, 'visible', 15, 8, 1, NOW(), NOW()),
(@bid, @cat_farmacia, 'Vitamina C Efervescente', 'Tubo x10 tabletas efervescentes, sabor naranja.', 4.50, 2.0000, '["https://images.unsplash.com/photo-1550572017-edd951b55104?w=600"]', 1, 'visible', 10, 8, 1, NOW(), NOW()),
-- Ferretería
(@bid, @cat_ferreteria, 'Taladro Eléctrico', 'Taladro percutor 1/2", 650W.', 45.00, 24.0000, '["https://images.unsplash.com/photo-1504148455328-c376907d081c?w=600"]', 1, 'visible', 3, 5, 1, NOW(), NOW()),
(@bid, @cat_ferreteria, 'Cinta Métrica 5m', 'Cinta métrica retráctil con freno.', 4.50, 2.0000, '["https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=600"]', 1, 'visible', 10, 5, 1, NOW(), NOW()),
(@bid, @cat_ferreteria, 'Caja de Tornillos Surtidos', 'Set de 200 tornillos varias medidas.', 6.00, 2.8000, '["https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=600"]', 1, 'visible', 8, 5, 1, NOW(), NOW()),
(@bid, @cat_ferreteria, 'Martillo de Carpintero', 'Martillo con mango de fibra de vidrio.', 8.50, 4.0000, '["https://images.unsplash.com/photo-1426927308491-6380b6a9936f?w=600"]', 1, 'visible', 6, 5, 1, NOW(), NOW()),
-- Licorería
(@bid, @cat_licoreria, 'Ron Añejo 750ml', 'Ron añejo nacional, botella 750ml.', 18.00, 10.0000, '["https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=600"]', 1, 'visible', 6, 5, 1, NOW(), NOW()),
(@bid, @cat_licoreria, 'Cerveza Nacional Six Pack', 'Six pack de cerveza nacional, lata 355ml.', 6.50, 3.5000, '["https://images.unsplash.com/photo-1608270586620-248524c67de9?w=600"]', 1, 'visible', 15, 8, 1, NOW(), NOW()),
(@bid, @cat_licoreria, 'Whisky Escocés 750ml', 'Whisky escocés importado, botella 750ml.', 32.00, 18.0000, '["https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=600"]', 1, 'visible', 4, 5, 1, NOW(), NOW()),
(@bid, @cat_licoreria, 'Vino Tinto Reserva', 'Vino tinto reserva, botella 750ml.', 14.00, 7.5000, '["https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?w=600"]', 1, 'visible', 6, 5, 1, NOW(), NOW()),
-- Papelería
(@bid, @cat_papeleria, 'Cuaderno 100 Hojas', 'Cuaderno universitario cuadriculado.', 2.50, 1.1000, '["https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=600"]', 1, 'visible', 20, 10, 1, NOW(), NOW()),
(@bid, @cat_papeleria, 'Set de Marcadores x12', 'Marcadores de colores, punta fina.', 5.50, 2.5000, '["https://images.unsplash.com/photo-1560421683-6856ea585c78?w=600"]', 1, 'visible', 12, 8, 1, NOW(), NOW()),
(@bid, @cat_papeleria, 'Resma de Papel Carta', 'Resma 500 hojas tamaño carta, 75gr.', 6.00, 3.2000, '["https://images.unsplash.com/photo-1568205612837-017257d2310a?w=600"]', 1, 'visible', 10, 5, 1, NOW(), NOW()),
(@bid, @cat_papeleria, 'Calculadora Científica', 'Calculadora científica 240 funciones.', 12.00, 6.0000, '["https://images.unsplash.com/photo-1587145820266-a5951ee6f620?w=600"]', 1, 'visible', 6, 5, 1, NOW(), NOW()),
-- Mascotas
(@bid, @cat_mascotas, 'Alimento para Perro 10kg', 'Alimento balanceado adulto, saco 10kg.', 28.00, 16.0000, '["https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=600"]', 1, 'visible', 5, 5, 1, NOW(), NOW()),
(@bid, @cat_mascotas, 'Arena para Gato 5kg', 'Arena sanitaria aglomerante, bolsa 5kg.', 8.00, 4.0000, '["https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=600"]', 1, 'visible', 8, 5, 1, NOW(), NOW()),
(@bid, @cat_mascotas, 'Correa Ajustable', 'Correa de nylon ajustable, hasta 25kg.', 6.50, 3.0000, '["https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=600"]', 1, 'visible', 10, 5, 1, NOW(), NOW()),
(@bid, @cat_mascotas, 'Shampoo para Mascotas', 'Shampoo hipoalergénico, 500ml.', 5.00, 2.3000, '["https://images.unsplash.com/photo-1591946614720-90a587da4a36?w=600"]', 1, 'visible', 10, 5, 1, NOW(), NOW()),
-- Óptica
(@bid, @cat_optica, 'Lentes de Sol', 'Lentes de sol con protección UV400.', 25.00, 12.0000, '["https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=600"]', 1, 'visible', 6, 5, 1, NOW(), NOW()),
(@bid, @cat_optica, 'Estuche para Lentes', 'Estuche rígido protector.', 6.00, 2.8000, '["https://images.unsplash.com/photo-1591076482161-42ce6da69f67?w=600"]', 1, 'visible', 12, 8, 1, NOW(), NOW()),
(@bid, @cat_optica, 'Líquido Limpiador de Lentes', 'Spray limpiador antiempañante, 60ml.', 4.00, 1.8000, '["https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=600"]', 1, 'visible', 12, 8, 1, NOW(), NOW()),
(@bid, @cat_optica, 'Monturas Clásicas', 'Montura para lentes graduados, unisex.', 22.00, 11.0000, '["https://images.unsplash.com/photo-1591076482161-42ce6da69f67?w=600"]', 1, 'visible', 6, 5, 1, NOW(), NOW()),
-- Belleza
(@bid, @cat_belleza, 'Shampoo Profesional', 'Shampoo reparador sin sal, 500ml.', 9.50, 4.5000, '["https://images.unsplash.com/photo-1526947425960-945c6e72858f?w=600"]', 1, 'visible', 10, 5, 1, NOW(), NOW()),
(@bid, @cat_belleza, 'Secador de Cabello', 'Secador 1800W, 2 velocidades.', 22.00, 11.0000, '["https://images.unsplash.com/photo-1522338242992-e1a54906a8da?w=600"]', 1, 'visible', 5, 5, 1, NOW(), NOW()),
(@bid, @cat_belleza, 'Esmalte de Uñas', 'Esmalte de larga duración, varios tonos.', 3.50, 1.5000, '["https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=600"]', 1, 'visible', 15, 8, 1, NOW(), NOW()),
(@bid, @cat_belleza, 'Crema Facial Hidratante', 'Crema hidratante con ácido hialurónico, 50ml.', 14.00, 6.5000, '["https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600"]', 1, 'visible', 8, 5, 1, NOW(), NOW()),
-- Electrónica
(@bid, @cat_electronica, 'Cargador USB-C', 'Cargador rápido 20W, cable incluido.', 8.00, 3.8000, '["https://images.unsplash.com/photo-1583863788434-e58a36330cf0?w=600"]', 1, 'visible', 15, 8, 1, NOW(), NOW()),
(@bid, @cat_electronica, 'Audífonos Bluetooth', 'Audífonos inalámbricos con estuche de carga.', 18.00, 9.0000, '["https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600"]', 1, 'visible', 8, 5, 1, NOW(), NOW()),
(@bid, @cat_electronica, 'Power Bank 10000mAh', 'Batería portátil 10000mAh, 2 puertos USB.', 22.00, 11.0000, '["https://images.unsplash.com/photo-1609091839311-d5365f9ff1c5?w=600"]', 1, 'visible', 8, 5, 1, NOW(), NOW()),
(@bid, @cat_electronica, 'Cable HDMI', 'Cable HDMI 2.0, 2 metros.', 6.50, 3.0000, '["https://images.unsplash.com/photo-1591370874773-6702e8f12fd8?w=600"]', 1, 'visible', 12, 8, 1, NOW(), NOW()),
-- Deportes
(@bid, @cat_deportes, 'Balón de Fútbol', 'Balón oficial talla 5.', 15.00, 7.5000, '["https://images.unsplash.com/photo-1614632537197-38a17061c2bd?w=600"]', 1, 'visible', 8, 5, 1, NOW(), NOW()),
(@bid, @cat_deportes, 'Pesas 5kg Par', 'Par de mancuernas de 5kg c/u.', 20.00, 10.0000, '["https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600"]', 1, 'visible', 6, 5, 1, NOW(), NOW()),
(@bid, @cat_deportes, 'Colchoneta de Yoga', 'Colchoneta antideslizante 6mm.', 12.00, 5.5000, '["https://images.unsplash.com/photo-1592432678016-e910b452f9a2?w=600"]', 1, 'visible', 8, 5, 1, NOW(), NOW()),
(@bid, @cat_deportes, 'Botella Deportiva', 'Botella deportiva 750ml, libre de BPA.', 5.00, 2.2000, '["https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600"]', 1, 'visible', 15, 8, 1, NOW(), NOW()),
-- Panadería
(@bid, @cat_panaderia, 'Pan Canilla', 'Pan canilla tradicional, unidad.', 0.80, 0.3500, '["https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600"]', 1, 'visible', 20, 15, 1, NOW(), NOW()),
(@bid, @cat_panaderia, 'Pan de Jamón', 'Pan de jamón navideño, unidad.', 6.00, 3.0000, '["https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600"]', 1, 'visible', 8, 5, 1, NOW(), NOW()),
(@bid, @cat_panaderia, 'Torta de Chocolate', 'Torta de chocolate entera, porción familiar.', 18.00, 9.0000, '["https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=600"]', 1, 'visible', 4, 5, 1, NOW(), NOW()),
(@bid, @cat_panaderia, 'Pan Integral', 'Pan integral en barra, unidad.', 1.50, 0.7000, '["https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=600"]', 1, 'visible', 15, 8, 1, NOW(), NOW()),
-- Repuestos
(@bid, @cat_repuestos, 'Filtro de Aceite', 'Filtro de aceite universal, motores 1.6-2.0.', 8.00, 4.0000, '["https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=600"]', 1, 'visible', 10, 5, 1, NOW(), NOW()),
(@bid, @cat_repuestos, 'Bombillo Halógeno H4', 'Bombillo halógeno H4 12V 60/55W.', 5.50, 2.5000, '["https://images.unsplash.com/photo-1550985616-10810253b84d?w=600"]', 1, 'visible', 12, 8, 1, NOW(), NOW()),
(@bid, @cat_repuestos, 'Batería 12V', 'Batería automotriz 12V 60Ah.', 65.00, 38.0000, '["https://images.unsplash.com/photo-1620714223084-8fcacc6dfd8d?w=600"]', 1, 'visible', 3, 5, 1, NOW(), NOW()),
(@bid, @cat_repuestos, 'Pastillas de Freno', 'Juego de pastillas de freno delanteras.', 22.00, 12.0000, '["https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=600"]', 1, 'visible', 6, 5, 1, NOW(), NOW()),
-- Juguetería
(@bid, @cat_jugueteria, 'Muñeca Articulada', 'Muñeca articulada con accesorios.', 12.00, 6.0000, '["https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=600"]', 1, 'visible', 8, 5, 1, NOW(), NOW()),
(@bid, @cat_jugueteria, 'Carro de Control Remoto', 'Carro RC escala 1:18, recargable.', 25.00, 13.0000, '["https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=600"]', 1, 'visible', 5, 5, 1, NOW(), NOW()),
(@bid, @cat_jugueteria, 'Set de Bloques de Construcción', 'Set de bloques 150 piezas.', 15.00, 7.5000, '["https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=600"]', 1, 'visible', 6, 5, 1, NOW(), NOW()),
(@bid, @cat_jugueteria, 'Pelota de Playa', 'Pelota inflable de playa, 40cm.', 4.00, 1.8000, '["https://images.unsplash.com/photo-1614632537197-38a17061c2bd?w=600"]', 1, 'visible', 15, 8, 1, NOW(), NOW());

-- ── Productos por peso (kg) — Frutería + Embutidos ────────────
INSERT INTO products (business_id, category_id, name, description, sale_mode, unit_type, unit_label, unit_step, base_unit_label, price_per_kg_usd, cost_per_unit_usd, images, show_in_catalog, catalog_visibility, min_stock, stock_alert_threshold, active, created_at, updated_at) VALUES
(@bid, @cat_fruteria, 'Cambur (kg)', 'Cambur criollo, vendido por peso.', 'weight', 'weight', 'kg', 0.1, 'kg', 1.20, 0.6000, '["https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600"]', 1, 'visible', 5, 5, 1, NOW(), NOW()),
(@bid, @cat_fruteria, 'Tomate (kg)', 'Tomate fresco, vendido por peso.', 'weight', 'weight', 'kg', 0.1, 'kg', 1.50, 0.7000, '["https://images.unsplash.com/photo-1546094096-0df4bcaaa337?w=600"]', 1, 'visible', 5, 5, 1, NOW(), NOW()),
(@bid, @cat_fruteria, 'Naranja (kg)', 'Naranja jugosa, vendida por peso.', 'weight', 'weight', 'kg', 0.1, 'kg', 1.00, 0.5000, '["https://images.unsplash.com/photo-1547514701-42782101795e?w=600"]', 1, 'visible', 5, 5, 1, NOW(), NOW()),
(@bid, @cat_embutidos, 'Jamón de Pierna (kg)', 'Jamón de pierna, vendido por peso.', 'weight', 'weight', 'kg', 0.1, 'kg', 8.50, 4.5000, '["https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=600"]', 1, 'visible', 3, 5, 1, NOW(), NOW()),
(@bid, @cat_embutidos, 'Mortadela (kg)', 'Mortadela clásica, vendida por peso.', 'weight', 'weight', 'kg', 0.1, 'kg', 5.00, 2.6000, '["https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=600"]', 1, 'visible', 3, 5, 1, NOW(), NOW()),
(@bid, @cat_embutidos, 'Salchichón (kg)', 'Salchichón ahumado, vendido por peso.', 'weight', 'weight', 'kg', 0.1, 'kg', 6.50, 3.4000, '["https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=600"]', 1, 'visible', 3, 5, 1, NOW(), NOW()),
(@bid, @cat_embutidos, 'Queso Amarillo (kg)', 'Queso amarillo tipo sandwich, vendido por peso.', 'weight', 'weight', 'kg', 0.1, 'kg', 7.00, 3.8000, '["https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d?w=600"]', 1, 'visible', 3, 5, 1, NOW(), NOW());

-- ── Aguacate — unidad, no peso ─────────────────────────────────
INSERT INTO products (business_id, category_id, name, description, price_per_unit_usd, cost_per_unit_usd, images, show_in_catalog, catalog_visibility, min_stock, stock_alert_threshold, active, created_at, updated_at) VALUES
(@bid, @cat_fruteria, 'Aguacate (unidad)', 'Aguacate criollo, vendido por unidad.', 0.80, 0.4000, '["https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=600"]', 1, 'visible', 10, 8, 1, NOW(), NOW());

-- ============================================================
-- Stock inicial (InventoryEntry) para TODOS los 56 productos
-- ============================================================

INSERT INTO inventory_entries (business_id, product_id, quantity, waste, entry_type, cost_per_unit_usd, notes, created_by, entered_at, created_at)
SELECT @bid, p.id, stock_map.qty, 0, 'adjustment', COALESCE(p.cost_per_unit_usd, 0), 'Seed inicial tenant multi-demo', @admin_id, NOW(), NOW()
FROM products p
JOIN (
  SELECT 'Acetaminofén 500mg' AS name, 40 AS qty UNION ALL
  SELECT 'Alcohol Antiséptico 250ml', 35 UNION ALL
  SELECT 'Curitas Caja x20', 50 UNION ALL
  SELECT 'Vitamina C Efervescente', 30 UNION ALL
  SELECT 'Taladro Eléctrico', 8 UNION ALL
  SELECT 'Cinta Métrica 5m', 25 UNION ALL
  SELECT 'Caja de Tornillos Surtidos', 20 UNION ALL
  SELECT 'Martillo de Carpintero', 15 UNION ALL
  SELECT 'Ron Añejo 750ml', 14 UNION ALL
  SELECT 'Cerveza Nacional Six Pack', 40 UNION ALL
  SELECT 'Whisky Escocés 750ml', 8 UNION ALL
  SELECT 'Vino Tinto Reserva', 12 UNION ALL
  SELECT 'Cuaderno 100 Hojas', 60 UNION ALL
  SELECT 'Set de Marcadores x12', 25 UNION ALL
  SELECT 'Resma de Papel Carta', 20 UNION ALL
  SELECT 'Calculadora Científica', 12 UNION ALL
  SELECT 'Alimento para Perro 10kg', 10 UNION ALL
  SELECT 'Arena para Gato 5kg', 18 UNION ALL
  SELECT 'Correa Ajustable', 20 UNION ALL
  SELECT 'Shampoo para Mascotas', 22 UNION ALL
  SELECT 'Lentes de Sol', 15 UNION ALL
  SELECT 'Estuche para Lentes', 25 UNION ALL
  SELECT 'Líquido Limpiador de Lentes', 20 UNION ALL
  SELECT 'Monturas Clásicas', 12 UNION ALL
  SELECT 'Shampoo Profesional', 18 UNION ALL
  SELECT 'Secador de Cabello', 10 UNION ALL
  SELECT 'Esmalte de Uñas', 35 UNION ALL
  SELECT 'Crema Facial Hidratante', 16 UNION ALL
  SELECT 'Cargador USB-C', 30 UNION ALL
  SELECT 'Audífonos Bluetooth', 15 UNION ALL
  SELECT 'Power Bank 10000mAh', 14 UNION ALL
  SELECT 'Cable HDMI', 25 UNION ALL
  SELECT 'Balón de Fútbol', 15 UNION ALL
  SELECT 'Pesas 5kg Par', 10 UNION ALL
  SELECT 'Colchoneta de Yoga', 14 UNION ALL
  SELECT 'Botella Deportiva', 28 UNION ALL
  SELECT 'Pan Canilla', 40 UNION ALL
  SELECT 'Pan de Jamón', 12 UNION ALL
  SELECT 'Torta de Chocolate', 6 UNION ALL
  SELECT 'Pan Integral', 25 UNION ALL
  SELECT 'Filtro de Aceite', 16 UNION ALL
  SELECT 'Bombillo Halógeno H4', 20 UNION ALL
  SELECT 'Batería 12V', 6 UNION ALL
  SELECT 'Pastillas de Freno', 10 UNION ALL
  SELECT 'Muñeca Articulada', 14 UNION ALL
  SELECT 'Carro de Control Remoto', 9 UNION ALL
  SELECT 'Set de Bloques de Construcción', 10 UNION ALL
  SELECT 'Pelota de Playa', 22 UNION ALL
  SELECT 'Cambur (kg)', 35 UNION ALL
  SELECT 'Tomate (kg)', 28 UNION ALL
  SELECT 'Naranja (kg)', 30 UNION ALL
  SELECT 'Aguacate (unidad)', 45 UNION ALL
  SELECT 'Jamón de Pierna (kg)', 12 UNION ALL
  SELECT 'Mortadela (kg)', 15 UNION ALL
  SELECT 'Salchichón (kg)', 13 UNION ALL
  SELECT 'Queso Amarillo (kg)', 14
) AS stock_map ON stock_map.name = p.name
WHERE p.business_id = @bid;
