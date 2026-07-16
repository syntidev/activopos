-- ============================================================
-- ActivoPOS — Seed FAQs únicas COMPLETO para VPS
-- IDs tomados directamente de producción
-- 25 segmentos × 12 FAQs = 300 registros
-- Ejecutar: Get-Content seed_faqs_vps_completo.sql | ssh root@187.124.241.213 "mysql -u root activopos"
-- ============================================================

DELETE FROM segment_faqs WHERE segment_id IN (
  'cmr9zg72b00038ckx7by9iu0w',
  'cmr9zg74200078ckx54sndlm9',
  'cmr9zg75i000b8ckxyud1xpu2',
  'cmr9zg76t000f8ckx0f63jm3s',
  'cmr9zg77o000j8ckxnupx6s25',
  'cmr9zg78b000n8ckx58cmemx4',
  'cmr9zg797000r8ckxkrm2k26b',
  'cmr9zg7a5000v8ckxpwopp1nj',
  'cmr9zg7at000z8ckxyevlltg5',
  'cmr9zg7bh00138ckxsznn09ou',
  'cmr9zg7by00178ckx9pdf6vxu',
  'cmr9zg7ck001b8ckx7wry4x6o',
  '169c32e07b6c11f19e4ffce8d4bc4433',
  '169c4f0a7b6c11f19e4ffce8d4bc4433',
  '169c56857b6c11f19e4ffce8d4bc4433',
  '169c5cf77b6c11f19e4ffce8d4bc4433',
  '169c5eac7b6c11f19e4ffce8d4bc4433',
  '169c60ab7b6c11f19e4ffce8d4bc4433',
  '169c62617b6c11f19e4ffce8d4bc4433',
  '169c784b7b6c11f19e4ffce8d4bc4433',
  '169c819b7b6c11f19e4ffce8d4bc4433',
  '169c82c87b6c11f19e4ffce8d4bc4433',
  '169c83c67b6c11f19e4ffce8d4bc4433',
  '169c8a7c7b6c11f19e4ffce8d4bc4433',
  '169cb2427b6c11f19e4ffce8d4bc4433'
);

INSERT INTO segment_faqs (id, segment_id, question, answer, sort_order) VALUES

-- ============================================================
-- CARNICERÍA (cmr9zg72b00038ckx7by9iu0w)
-- ============================================================
('vps_car_01','cmr9zg72b00038ckx7by9iu0w','¿Puedo vender por kilo y por pieza en el mismo sistema?','Sí. ActivoPOS maneja unidades de medida por producto — configuras res, cerdo y pollo por kilo, y las morcillas o chorizos por pieza. El sistema calcula el precio automáticamente según el peso o la unidad que ingreses en cada venta.',1),
('vps_car_02','cmr9zg72b00038ckx7by9iu0w','¿Cómo maneja ActivoPOS la tasa del dólar en la carnicería?','La tasa BCV se actualiza automáticamente varias veces al día. Tú defines el precio de cada corte en dólares una sola vez — el sistema convierte a bolívares en tiempo real en cada cobro. Cuando el dólar sube, no tienes que cambiar nada.',2),
('vps_car_03','cmr9zg72b00038ckx7by9iu0w','¿Puedo saber cuánto de cada corte me queda?','Sí. Cada venta descuenta el inventario en tiempo real. Puedes ver el stock de res, cerdo, pollo y cualquier otro corte desde el panel sin tener que ir al cuarto frío a contar. También recibes alertas cuando un corte baja del mínimo que tú definas.',3),
('vps_car_04','cmr9zg72b00038ckx7by9iu0w','¿ActivoPOS reemplaza mi facturación del SENIAT?','No. ActivoPOS es tu sistema de control de ventas e inventario — no reemplaza tu facturación SENIAT, la complementa. Usas ActivoPOS para el control diario de tu carnicería y tu sistema fiscal por separado para las obligaciones tributarias.',4),
('vps_car_05','cmr9zg72b00038ckx7by9iu0w','¿Necesito instalar algo en mi carnicería?','No. ActivoPOS corre en el navegador — Chrome, Safari o cualquier browser moderno. Funciona desde el teléfono en el mostrador, desde una tablet en la caja, o desde una computadora en la trastienda. Sin instalación, sin técnico.',5),
('vps_car_06','cmr9zg72b00038ckx7by9iu0w','¿Cómo se actualiza la tasa del dólar en mis precios?','Automáticamente. ActivoPOS consulta la tasa BCV varias veces al día. En cada cobro, el sistema muestra el precio en dólares y el equivalente en bolívares calculado en ese momento — sin que tú toques nada.',6),
('vps_car_07','cmr9zg72b00038ckx7by9iu0w','¿Qué métodos de pago acepta ActivoPOS en mi carnicería?','Todos los que usa Venezuela: Pago Móvil, Zelle, efectivo en dólares, efectivo en bolívares, transferencia bancaria y USDT. En una carnicería donde el cliente paga rápido, un mismo cobro puede combinar varios métodos sin rehacer el ticket.',7),
('vps_car_08','cmr9zg72b00038ckx7by9iu0w','¿Cuánto cuesta ActivoPOS para una carnicería?','El plan Mostrador arranca en $15/mes — cubre POS, inventario de cortes y cierre de caja para hasta 3 usuarios. El plan Negocio a $25/mes agrega catálogo digital y ventas por WhatsApp. El plan Pro a $40/mes es para carnicerías con mayor volumen.',8),
('vps_car_09','cmr9zg72b00038ckx7by9iu0w','¿Puedo cancelar si no me convence?','Sí, en cualquier momento. No hay contrato anual ni penalización. Cancelas y tu carnicería sigue con acceso hasta el final del período que pagaste. Sin llamadas, sin trámites.',9),
('vps_car_10','cmr9zg72b00038ckx7by9iu0w','¿Funciona desde el teléfono en el mostrador?','Sí. ActivoPOS está diseñado para funcionar desde el teléfono que ya tienes. El cajero de tu carnicería puede registrar ventas, ver precios y cobrar desde cualquier Android o iPhone sin necesidad de una caja registradora especial.',10),
('vps_car_11','cmr9zg72b00038ckx7by9iu0w','¿Puedo tener varios cajeros con permisos diferentes?','Sí. Puedes crear usuarios con rol de cajero — solo ven el POS y la caja — o de administrador con acceso completo. Cada empleado de tu carnicería entra con su propio usuario. Sabes quién vendió qué y cuándo.',11),
('vps_car_12','cmr9zg72b00038ckx7by9iu0w','¿Qué pasa si se va la luz o el internet en la carnicería?','Las ventas ya registradas quedan guardadas. Para nuevas ventas necesitas conexión. En una carnicería recomendamos tener el hotspot del teléfono como respaldo para los momentos de corte de servicio.',12),

-- ============================================================
-- RESTAURANTE (cmr9zg74200078ckx54sndlm9)
-- ============================================================
('vps_res_01','cmr9zg74200078ckx54sndlm9','¿ActivoPOS maneja mesas y comandas?','Sí. Puedes abrir una comanda por mesa, agregar platos durante el servicio y cerrar el ticket cuando el cliente pida la cuenta. La cocina recibe el pedido en tiempo real sin que el mesonero tenga que ir corriendo.',1),
('vps_res_02','cmr9zg74200078ckx54sndlm9','¿Funciona con pantalla de cocina (KDS)?','Sí, en el plan Pro. El KDS muestra cada pedido en la cocina en el momento en que el mesonero lo registra — sin comandas en papel que se pierden o se mojan. Disponible en cualquier tablet o monitor que tengas en la cocina.',2),
('vps_res_03','cmr9zg74200078ckx54sndlm9','¿Puedo tener varios mesoneros trabajando al mismo tiempo?','Sí. Cada mesonero entra con su propio usuario y maneja sus mesas. El administrador ve todas las mesas activas, los pedidos y lo que ha ingresado en el día desde una sola pantalla.',3),
('vps_res_04','cmr9zg74200078ckx54sndlm9','¿ActivoPOS reemplaza mi facturación del SENIAT?','No. ActivoPOS controla tus ventas, comandas e inventario — no reemplaza tu facturación SENIAT, la complementa. Tu restaurante usa ActivoPOS para la operación diaria y tu sistema fiscal para las obligaciones tributarias.',4),
('vps_res_05','cmr9zg74200078ckx54sndlm9','¿Necesito instalar algo en mi restaurante?','No. ActivoPOS corre en el navegador de cualquier dispositivo. Los mesoneros usan su teléfono, la caja funciona desde una tablet, y la cocina ve los pedidos en cualquier monitor con internet. Sin instalación, sin técnico.',5),
('vps_res_06','cmr9zg74200078ckx54sndlm9','¿Cómo se actualiza la tasa del dólar en el menú?','Automáticamente. Tú defines los precios del menú en dólares una sola vez. En cada cobro, el sistema calcula el equivalente en bolívares con la tasa BCV del momento. Cuando el dólar sube, no tienes que actualizar nada.',6),
('vps_res_07','cmr9zg74200078ckx54sndlm9','¿Qué métodos de pago acepta ActivoPOS en mi restaurante?','Todos los que usa Venezuela: Pago Móvil, Zelle, efectivo en dólares, efectivo en bolívares, transferencia y USDT. Una mesa puede pagar con métodos mezclados en un solo ticket sin anular la venta.',7),
('vps_res_08','cmr9zg74200078ckx54sndlm9','¿Cuánto cuesta ActivoPOS para un restaurante?','El plan Negocio a $25/mes cubre comandas, inventario y catálogo digital. El plan Pro a $40/mes agrega KDS para la cocina, analytics avanzado y usuarios ilimitados — ideal para restaurantes con mayor movimiento.',8),
('vps_res_09','cmr9zg74200078ckx54sndlm9','¿Puedo cancelar si no me convence?','Sí. No hay contrato anual ni permanencia mínima. Cancelas cuando quieras y tu restaurante mantiene el acceso hasta el final del período pagado.',9),
('vps_res_10','cmr9zg74200078ckx54sndlm9','¿Los mesoneros pueden usar su teléfono para tomar pedidos?','Sí. ActivoPOS funciona desde cualquier teléfono Android o iPhone. El mesonero toma el pedido en la mesa, la cocina lo ve al instante y el cajero cierra el ticket — todo conectado sin hardware especial.',10),
('vps_res_11','cmr9zg74200078ckx54sndlm9','¿Puedo ver el reporte de ventas por plato?','Sí. Los reportes muestran qué platos vendiste más, en qué horario y cuál es tu margen real. Sabes cuál es tu plato estrella y cuál no te está dejando ganancia.',11),
('vps_res_12','cmr9zg74200078ckx54sndlm9','¿Qué pasa si se va el internet durante el servicio?','Las ventas ya registradas quedan guardadas. Para nuevas comandas necesitas conexión. Recomendamos el hotspot de un teléfono como respaldo — en hora pico, un corte no puede paralizar la operación.',12),

-- ============================================================
-- FERRETERÍAS (cmr9zg75i000b8ckxyud1xpu2)
-- ============================================================
('vps_fer_01','cmr9zg75i000b8ckxyud1xpu2','¿Puedo buscar productos por código o referencia?','Sí. La búsqueda del POS funciona por nombre, SKU y código de barras. En una ferretería con miles de referencias, escribes el código y el sistema lo encuentra en segundos sin revisar listas en papel.',1),
('vps_fer_02','cmr9zg75i000b8ckxyud1xpu2','¿ActivoPOS maneja precios al mayor y al detal?','Sí. Configuras listas de precio por tipo de cliente. Los contratistas que compran al mayor tienen su precio y los clientes de mostrador el suyo. El cajero selecciona el tipo de cliente y el sistema aplica la lista correcta.',2),
('vps_fer_03','cmr9zg75i000b8ckxyud1xpu2','¿Puedo actualizar precios masivamente cuando sube el dólar?','Sí. Actualizas precios por categoría o aplicas un porcentaje de ajuste a todo el inventario desde el panel. En una ferretería donde el dólar mueve todo el catálogo, eso te ahorra horas de trabajo manual.',3),
('vps_fer_04','cmr9zg75i000b8ckxyud1xpu2','¿ActivoPOS reemplaza mi facturación del SENIAT?','No. ActivoPOS controla tu inventario, ventas y caja — no reemplaza tu facturación SENIAT, la complementa. Tu ferretería usa ActivoPOS para el control operativo y tu sistema fiscal para el cumplimiento tributario.',4),
('vps_fer_05','cmr9zg75i000b8ckxyud1xpu2','¿Necesito instalar algo en mi ferretería?','No. ActivoPOS corre en el navegador de cualquier dispositivo. La caja funciona desde una computadora, tablet o teléfono. Sin instalación, sin licencias por equipo, sin técnico cada vez que se actualiza.',5),
('vps_fer_06','cmr9zg75i000b8ckxyud1xpu2','¿Cómo se actualiza la tasa del dólar en mis precios?','Automáticamente. ActivoPOS consulta la tasa BCV varias veces al día. Los precios en bolívares de tu ferretería se recalculan solos en cada cobro — tú defines el precio en dólares una sola vez.',6),
('vps_fer_07','cmr9zg75i000b8ckxyud1xpu2','¿Qué métodos de pago acepta ActivoPOS en mi ferretería?','Todos los que usa Venezuela: Pago Móvil, Zelle, efectivo en dólares, efectivo en bolívares, transferencia y USDT. Para ventas al mayor donde el contratista paga en partes, registras pagos mixtos en un solo ticket.',7),
('vps_fer_08','cmr9zg75i000b8ckxyud1xpu2','¿Cuánto cuesta ActivoPOS para una ferretería?','El plan Negocio a $25/mes cubre hasta 500 productos, hasta 10 usuarios y catálogo digital. El plan Pro a $40/mes es para ferreterías con catálogo masivo y usuarios ilimitados.',8),
('vps_fer_09','cmr9zg75i000b8ckxyud1xpu2','¿Puedo cancelar si no me convence?','Sí. Sin contrato anual ni cláusula de permanencia. Tu ferretería mantiene el acceso hasta el final del período pagado.',9),
('vps_fer_10','cmr9zg75i000b8ckxyud1xpu2','¿Funciona desde el teléfono en el mostrador?','Sí. El cajero registra ventas desde cualquier teléfono Android o iPhone. No necesitas hardware especial ni caja registradora dedicada.',10),
('vps_fer_11','cmr9zg75i000b8ckxyud1xpu2','¿Puedo saber qué productos se están agotando?','Sí. ActivoPOS te alerta cuando cualquier producto baja del stock mínimo que definas. Nunca te quedas sin cemento, cabilla o pintura en temporada alta sin saberlo.',11),
('vps_fer_12','cmr9zg75i000b8ckxyud1xpu2','¿Qué pasa si se va el internet en la ferretería?','Las ventas ya registradas quedan guardadas. Para nuevas ventas necesitas conexión. Recomendamos el hotspot del teléfono como respaldo en hora pico.',12),

-- ============================================================
-- FARMACIAS (cmr9zg76t000f8ckx0f63jm3s)
-- ============================================================
('vps_far_01','cmr9zg76t000f8ckx0f63jm3s','¿ActivoPOS maneja fechas de vencimiento de medicamentos?','Sí. Registras la fecha de vencimiento de cada lote al ingresar el inventario. El sistema te alerta cuando un medicamento está próximo a vencer para retirarlo antes de que sea una pérdida.',1),
('vps_far_02','cmr9zg76t000f8ckx0f63jm3s','¿Cómo manejo los precios regulados en mi farmacia?','Puedes mantener dos precios por producto: el precio regulado oficial y el precio libre. El cajero selecciona cuál aplica en cada venta. Los reportes muestran cuánto vendiste a cada precio.',2),
('vps_far_03','cmr9zg76t000f8ckx0f63jm3s','¿Puedo cobrar con Pago Móvil y efectivo en el mismo ticket?','Sí. En una farmacia donde el cliente paga parte en Pago Móvil y completa en efectivo, ActivoPOS registra el pago mixto en un solo ticket sin anular ni hacer dos transacciones.',3),
('vps_far_04','cmr9zg76t000f8ckx0f63jm3s','¿ActivoPOS reemplaza mi facturación del SENIAT?','No. ActivoPOS es tu sistema de control de ventas e inventario — no reemplaza tu facturación SENIAT, la complementa. Tu farmacia usa ActivoPOS para el control diario y tu sistema fiscal para las obligaciones tributarias.',4),
('vps_far_05','cmr9zg76t000f8ckx0f63jm3s','¿Necesito instalar algo en mi farmacia?','No. ActivoPOS corre en el navegador. El cajero trabaja desde la computadora, desde una tablet en el mostrador o desde su teléfono. Sin instalación, sin técnico.',5),
('vps_far_06','cmr9zg76t000f8ckx0f63jm3s','¿Cómo se actualiza la tasa del dólar para medicamentos importados?','Automáticamente. Para medicamentos con precio en dólares, el equivalente en bolívares se recalcula solo en cada cobro. Para los de precio regulado en bolívares, el precio no cambia hasta que tú lo actualices.',6),
('vps_far_07','cmr9zg76t000f8ckx0f63jm3s','¿Qué métodos de pago acepta ActivoPOS en mi farmacia?','Todos los que usa Venezuela: Pago Móvil, Zelle, efectivo en dólares, efectivo en bolívares, transferencia y USDT. Para clientes frecuentes que mezclan métodos, el sistema los registra todos en un solo ticket.',7),
('vps_far_08','cmr9zg76t000f8ckx0f63jm3s','¿Cuánto cuesta ActivoPOS para una farmacia?','El plan Mostrador a $15/mes es suficiente para farmacias pequeñas. El plan Negocio a $25/mes agrega catálogo digital. El plan Pro a $40/mes para farmacias con catálogo completo y personal amplio.',8),
('vps_far_09','cmr9zg76t000f8ckx0f63jm3s','¿Puedo cancelar si no me convence?','Sí. Sin contrato anual ni penalización. Tu farmacia mantiene el acceso hasta el final del período pagado.',9),
('vps_far_10','cmr9zg76t000f8ckx0f63jm3s','¿Funciona desde el teléfono en el mostrador?','Sí. El cajero registra ventas desde cualquier teléfono Android o iPhone. Ideal para farmacias donde el espacio en el mostrador es limitado.',10),
('vps_far_11','cmr9zg76t000f8ckx0f63jm3s','¿Puedo saber qué medicamentos se están agotando?','Sí. ActivoPOS te alerta cuando cualquier producto baja del stock mínimo que definas. Nunca más te quedas sin el medicamento que más rotan tus clientes.',11),
('vps_far_12','cmr9zg76t000f8ckx0f63jm3s','¿Qué pasa si se va el internet en la farmacia?','Las ventas ya registradas quedan guardadas. Para nuevas ventas necesitas conexión. Recomendamos el hotspot del teléfono como respaldo — en una farmacia no puede haber momentos sin registrar ventas.',12),

-- ============================================================
-- TIENDAS DE ROPA (cmr9zg77o000j8ckxnupx6s25)
-- ============================================================
('vps_ropa_01','cmr9zg77o000j8ckxnupx6s25','¿ActivoPOS maneja tallas, colores y variantes de ropa?','Sí. Cada prenda se configura con sus variantes — talla S, M, L, XL y colores — y el sistema lleva el inventario por variante. Sabes exactamente cuántas unidades tienes de cada combinación sin ir al depósito.',1),
('vps_ropa_02','cmr9zg77o000j8ckxnupx6s25','¿Puedo mostrar el catálogo a clientes que preguntan por WhatsApp?','Sí. Con el catálogo digital tus clientes ven las prendas disponibles con fotos, tallas y precios desde un link. Hacen su pedido por WhatsApp con el detalle exacto — sin que vayas a buscar si hay stock.',2),
('vps_ropa_03','cmr9zg77o000j8ckxnupx6s25','¿Puedo manejar apartados y ventas a crédito?','Sí. ActivoPOS registra ventas a crédito con el cliente asignado y lleva el saldo pendiente. Para apartados, registras el adelanto y el sistema muestra cuánto queda por cobrar antes de entregar la prenda.',3),
('vps_ropa_04','cmr9zg77o000j8ckxnupx6s25','¿ActivoPOS reemplaza mi facturación del SENIAT?','No. ActivoPOS es tu sistema de control de ventas e inventario — no reemplaza tu facturación SENIAT, la complementa. Tu tienda usa ActivoPOS para el control diario y tu sistema fiscal para las obligaciones tributarias.',4),
('vps_ropa_05','cmr9zg77o000j8ckxnupx6s25','¿Necesito instalar algo en mi tienda de ropa?','No. ActivoPOS corre en el navegador. La cajera trabaja desde el teléfono, una tablet en el mostrador o la computadora del local. Sin instalación, sin actualizaciones manuales.',5),
('vps_ropa_06','cmr9zg77o000j8ckxnupx6s25','¿Cómo se actualiza la tasa del dólar en los precios de ropa?','Defines el precio de cada prenda en dólares una sola vez. En cada cobro el sistema muestra el equivalente en bolívares con la tasa BCV del momento — sin recalcular ni cambiar etiquetas.',6),
('vps_ropa_07','cmr9zg77o000j8ckxnupx6s25','¿Qué métodos de pago acepta ActivoPOS en mi tienda de ropa?','Todos los que usa Venezuela: Pago Móvil, Zelle, efectivo en dólares, efectivo en bolívares, transferencia y USDT. Una clienta puede pagar su apartado en Pago Móvil y completar en efectivo en un solo movimiento.',7),
('vps_ropa_08','cmr9zg77o000j8ckxnupx6s25','¿Cuánto cuesta ActivoPOS para una tienda de ropa?','El plan Negocio a $25/mes incluye catálogo digital para vender por WhatsApp, inventario por variante y hasta 10 usuarios. El plan Pro a $40/mes agrega analytics y usuarios ilimitados.',8),
('vps_ropa_09','cmr9zg77o000j8ckxnupx6s25','¿Puedo cancelar si no me convence?','Sí. Sin contrato anual ni penalización. Tu tienda mantiene el acceso hasta el final del período pagado.',9),
('vps_ropa_10','cmr9zg77o000j8ckxnupx6s25','¿La cajera puede usar el teléfono para registrar ventas?','Sí. ActivoPOS está diseñado mobile-first. La cajera registra ventas, revisa inventario por talla y cobra desde cualquier teléfono Android o iPhone.',10),
('vps_ropa_11','cmr9zg77o000j8ckxnupx6s25','¿Puedo saber qué tallas y colores se venden más?','Sí. Los reportes muestran los productos más vendidos incluyendo variantes. Sabes qué talla rota más, qué color no se mueve y cuándo reponer el más pedido.',11),
('vps_ropa_12','cmr9zg77o000j8ckxnupx6s25','¿Qué pasa si se va el internet en la tienda?','Las ventas ya registradas quedan guardadas. Para nuevas ventas necesitas conexión. Recomendamos el hotspot del teléfono como respaldo.',12),

-- ============================================================
-- ABASTOS (cmr9zg78b000n8ckx58cmemx4)
-- ============================================================
('vps_abs_01','cmr9zg78b000n8ckx58cmemx4','¿Puedo controlar los fiaditos y ventas a crédito en la bodega?','Sí. ActivoPOS registra ventas a crédito con el cliente asignado y lleva el saldo pendiente de cada uno. Se acabó la libreta de fiaditos — sabes quién te debe, cuánto y desde cuándo.',1),
('vps_abs_02','cmr9zg78b000n8ckx58cmemx4','¿ActivoPOS me avisa cuando se está acabando un producto?','Sí. Defines el stock mínimo de cada producto y el sistema te alerta cuando baja de ese nivel. Nunca más te quedas sin harina, aceite o azúcar sin saberlo con tiempo de reponer.',2),
('vps_abs_03','cmr9zg78b000n8ckx58cmemx4','¿Puedo saber cuánto entró al final del día sin contar a mano?','Sí. El cierre de caja muestra exactamente cuánto vendiste, en qué método de pago y cuánto debería haber en caja. Sabes si cuadra o si hay diferencia en segundos.',3),
('vps_abs_04','cmr9zg78b000n8ckx58cmemx4','¿ActivoPOS reemplaza mi facturación del SENIAT?','No. ActivoPOS es tu sistema de control de ventas e inventario — no reemplaza tu facturación SENIAT, la complementa. Tu bodega usa ActivoPOS para el control diario y tu sistema fiscal para las obligaciones tributarias.',4),
('vps_abs_05','cmr9zg78b000n8ckx58cmemx4','¿Necesito instalar algo en la bodega?','No. ActivoPOS corre en el navegador. Funciona desde el teléfono en el mostrador, una tablet en la caja o una computadora. Sin instalación, sin técnico, sin actualizaciones manuales.',5),
('vps_abs_06','cmr9zg78b000n8ckx58cmemx4','¿Cómo se actualiza la tasa del dólar en los precios de la bodega?','Defines los precios en dólares una sola vez y el sistema calcula el equivalente en bolívares en cada cobro con la tasa BCV del momento. Cuando sube el dólar, no tienes que cambiar nada.',6),
('vps_abs_07','cmr9zg78b000n8ckx58cmemx4','¿Qué métodos de pago acepta ActivoPOS en la bodega?','Todos los que usa Venezuela: Pago Móvil, Zelle, efectivo en dólares, efectivo en bolívares, transferencia y USDT. En una bodega donde el cliente paga en dos partes, el sistema registra el pago mixto en un solo ticket.',7),
('vps_abs_08','cmr9zg78b000n8ckx58cmemx4','¿Cuánto cuesta ActivoPOS para una bodega o abasto?','El plan Mostrador a $15/mes cubre POS, inventario y cierre de caja para hasta 3 usuarios y 100 productos. El plan Negocio a $25/mes agrega catálogo digital para abastos con mayor surtido.',8),
('vps_abs_09','cmr9zg78b000n8ckx58cmemx4','¿Puedo cancelar si no me convence?','Sí. Sin contrato anual ni penalización. Tu bodega mantiene el acceso hasta el final del período pagado.',9),
('vps_abs_10','cmr9zg78b000n8ckx58cmemx4','¿Funciona desde el teléfono en el mostrador de la bodega?','Sí. El cajero registra ventas desde cualquier teléfono Android o iPhone. El teléfono se convierte en la caja registradora — perfecto para bodegas sin espacio para computadora.',10),
('vps_abs_11','cmr9zg78b000n8ckx58cmemx4','¿Puedo ver qué productos se venden más en mi bodega?','Sí. Los reportes muestran los productos más vendidos por día, semana o mes. Sabes qué rotan más, qué está quieto y cuándo necesitas reponer.',11),
('vps_abs_12','cmr9zg78b000n8ckx58cmemx4','¿Qué pasa si se va la luz o el internet en la bodega?','Las ventas ya registradas quedan guardadas. Para nuevas ventas necesitas conexión. Recomendamos el hotspot del teléfono — los clientes no esperan y la venta no puede parar.',12),

-- ============================================================
-- TECNOLOGÍA (cmr9zg797000r8ckxkrm2k26b)
-- ============================================================
('vps_tec_01','cmr9zg797000r8ckxkrm2k26b','¿ActivoPOS lleva control de seriales y garantías?','Sí. Registras el serial de cada equipo vendido y lo asignas al cliente. Cuando alguien llega con un reclamo de garantía, buscas el serial y sabes exactamente a quién le vendiste, cuándo y a qué precio.',1),
('vps_tec_02','cmr9zg797000r8ckxkrm2k26b','¿Puedo manejar órdenes de reparación y servicio técnico?','Sí. Registras una orden de servicio con el equipo, el problema reportado, el costo de la reparación y el estado. Tienes el historial completo de cada reparación registrado.',2),
('vps_tec_03','cmr9zg797000r8ckxkrm2k26b','¿Cómo manejo los precios de equipos que cambian con el dólar?','Define el precio en dólares una sola vez. ActivoPOS calcula el equivalente en bolívares automáticamente con la tasa BCV del momento de la venta. Cuando el dólar sube no tienes que actualizar nada.',3),
('vps_tec_04','cmr9zg797000r8ckxkrm2k26b','¿ActivoPOS reemplaza mi facturación del SENIAT?','No. ActivoPOS controla ventas, inventario de equipos y órdenes de servicio — no reemplaza tu facturación SENIAT, la complementa.',4),
('vps_tec_05','cmr9zg797000r8ckxkrm2k26b','¿Necesito instalar algo en mi tienda de tecnología?','No. ActivoPOS corre en el navegador. Funciona desde la computadora del mostrador, una tablet en la vitrina o el teléfono del técnico. Sin instalación ni licencias adicionales.',5),
('vps_tec_06','cmr9zg797000r8ckxkrm2k26b','¿Cómo se actualiza la tasa del dólar en los precios de equipos?','Automáticamente. Los precios en bolívares de todos tus equipos y accesorios se recalculan solos en cada cobro — sin tocar el catálogo cada vez que el dólar se mueve.',6),
('vps_tec_07','cmr9zg797000r8ckxkrm2k26b','¿Qué métodos de pago acepta ActivoPOS en mi tienda de tecnología?','Todos los que usa Venezuela: Pago Móvil, Zelle, efectivo en dólares, efectivo en bolívares, transferencia y USDT. Para equipos de alto valor donde el cliente paga en partes, el sistema registra el pago mixto en un solo ticket.',7),
('vps_tec_08','cmr9zg797000r8ckxkrm2k26b','¿Cuánto cuesta ActivoPOS para una tienda de tecnología?','El plan Negocio a $25/mes cubre ventas, inventario de equipos y catálogo digital. El plan Pro a $40/mes agrega analytics avanzado y usuarios ilimitados para tiendas con taller y equipo de ventas.',8),
('vps_tec_09','cmr9zg797000r8ckxkrm2k26b','¿Puedo cancelar si no me convence?','Sí. Sin contrato anual ni penalización. Tu tienda mantiene el acceso hasta el final del período pagado.',9),
('vps_tec_10','cmr9zg797000r8ckxkrm2k26b','¿Funciona desde el teléfono en el mostrador?','Sí. El vendedor registra ventas y consulta inventario desde cualquier teléfono. El técnico actualiza el estado de una reparación desde su teléfono sin ir a la computadora del mostrador.',10),
('vps_tec_11','cmr9zg797000r8ckxkrm2k26b','¿Puedo ver qué equipos y accesorios se venden más?','Sí. Los reportes muestran productos más vendidos, margen real por equipo y cuáles están sin movimiento. Información para decidir qué reponer, qué liquidar y qué accesorios te dejan más.',11),
('vps_tec_12','cmr9zg797000r8ckxkrm2k26b','¿Qué pasa si se va el internet en la tienda?','Las ventas ya registradas quedan guardadas. Recomendamos el hotspot del teléfono como respaldo — en una tienda de tecnología, no tener internet no puede parar las ventas.',12),

-- ============================================================
-- REPUESTOS (cmr9zg7a5000v8ckxpwopp1nj)
-- ============================================================
('vps_rep_01','cmr9zg7a5000v8ckxpwopp1nj','¿Puedo buscar repuestos por código o referencia del fabricante?','Sí. La búsqueda funciona por nombre, SKU y código de barras. En una repuestera con miles de referencias, escribes el código o nombre de la pieza y el sistema la encuentra en segundos.',1),
('vps_rep_02','cmr9zg7a5000v8ckxpwopp1nj','¿ActivoPOS maneja precios al mayor y al detal para talleres?','Sí. Configuras listas de precio por tipo de cliente. Los talleres mecánicos que compran al mayor tienen su precio y los clientes de mostrador el suyo. El sistema aplica la lista correcta automáticamente.',2),
('vps_rep_03','cmr9zg7a5000v8ckxpwopp1nj','¿Puedo ver qué referencias se mueven y cuáles llevan meses sin venderse?','Sí. Los reportes muestran productos más vendidos y los sin movimiento por período. Sabes qué repuestos reponer y cuáles liquidar antes de que se conviertan en inventario muerto.',3),
('vps_rep_04','cmr9zg7a5000v8ckxpwopp1nj','¿ActivoPOS reemplaza mi facturación del SENIAT?','No. ActivoPOS controla inventario de repuestos, ventas y caja — no reemplaza tu facturación SENIAT, la complementa.',4),
('vps_rep_05','cmr9zg7a5000v8ckxpwopp1nj','¿Necesito instalar algo en mi repuestera?','No. ActivoPOS corre en el navegador. La caja funciona desde computadora, tablet o teléfono. Sin instalación ni técnico de sistemas.',5),
('vps_rep_06','cmr9zg7a5000v8ckxpwopp1nj','¿Cómo se actualiza la tasa del dólar en los precios de repuestos?','Defines el precio de cada repuesto en dólares una sola vez. En cada venta el sistema calcula el equivalente en bolívares con la tasa BCV del momento.',6),
('vps_rep_07','cmr9zg7a5000v8ckxpwopp1nj','¿Qué métodos de pago acepta ActivoPOS en mi repuestera?','Todos los que usa Venezuela: Pago Móvil, Zelle, efectivo en dólares, efectivo en bolívares, transferencia y USDT. Para talleres que mezclan métodos, el sistema registra el pago mixto en un solo ticket.',7),
('vps_rep_08','cmr9zg7a5000v8ckxpwopp1nj','¿Cuánto cuesta ActivoPOS para una repuestera?','El plan Negocio a $25/mes cubre hasta 500 referencias, hasta 10 usuarios y catálogo digital para talleres. El plan Pro a $40/mes para repuesteras con catálogo masivo.',8),
('vps_rep_09','cmr9zg7a5000v8ckxpwopp1nj','¿Puedo cancelar si no me convence?','Sí. Sin contrato anual ni penalización. Tu repuestera mantiene el acceso hasta el final del período pagado.',9),
('vps_rep_10','cmr9zg7a5000v8ckxpwopp1nj','¿Funciona desde el teléfono en el mostrador?','Sí. El cajero registra ventas y busca referencias desde cualquier teléfono Android o iPhone. No necesitas computadora especial.',10),
('vps_rep_11','cmr9zg7a5000v8ckxpwopp1nj','¿Puedo saber qué repuestos se están agotando?','Sí. ActivoPOS te alerta cuando cualquier referencia baja del stock mínimo. Nunca te quedas sin las piezas que más rotan sin saberlo.',11),
('vps_rep_12','cmr9zg7a5000v8ckxpwopp1nj','¿Qué pasa si se va el internet en la repuestera?','Las ventas ya registradas quedan guardadas. Recomendamos el hotspot del teléfono como respaldo en hora pico.',12),

-- ============================================================
-- SERVICIOS (cmr9zg7bh00138ckxsznn09ou)
-- ============================================================
('vps_ser_01','cmr9zg7bh00138ckxsznn09ou','¿ActivoPOS maneja cotizaciones para servicios profesionales?','Sí. Creas cotizaciones con el detalle de cada servicio, las envías al cliente en PDF y registras cuáles se aprobaron. Tienes el historial completo de cada propuesta — se acabó hacer cotizaciones en Word sin saber en qué quedaron.',1),
('vps_ser_02','cmr9zg7bh00138ckxsznn09ou','¿Cómo llevo el control de clientes que me deben?','Con el módulo de cuentas por cobrar. Registras cada servicio, el pago recibido y el saldo pendiente por cliente. Sabes exactamente quién te debe, cuánto y desde cuándo — sin libreta ni Excel.',2),
('vps_ser_03','cmr9zg7bh00138ckxsznn09ou','¿Puedo saber cuánto facturé y cuál es mi rentabilidad al mes?','Sí. Los reportes financieros muestran tus ingresos por período, el detalle por tipo de servicio y tu utilidad real. Al cierre del mes sabes cuánto entraste, cuánto gastaste y cuánto te quedó.',3),
('vps_ser_04','cmr9zg7bh00138ckxsznn09ou','¿ActivoPOS reemplaza mi facturación del SENIAT?','No. ActivoPOS es tu sistema de control de cobros y clientes — no reemplaza tu facturación SENIAT, la complementa.',4),
('vps_ser_05','cmr9zg7bh00138ckxsznn09ou','¿Necesito instalar algo en mi oficina?','No. ActivoPOS corre en el navegador. Funciona desde la computadora de la oficina, la tablet en reuniones con clientes o el teléfono en campo. Sin instalación ni técnico.',5),
('vps_ser_06','cmr9zg7bh00138ckxsznn09ou','¿Cómo se actualiza la tasa del dólar en mis tarifas de servicios?','Defines tus tarifas en dólares una sola vez. En cada cobro ActivoPOS calcula el equivalente en bolívares con la tasa BCV del momento.',6),
('vps_ser_07','cmr9zg7bh00138ckxsznn09ou','¿Qué métodos de pago acepta ActivoPOS para cobros de servicios?','Todos los que usa Venezuela: Pago Móvil, Zelle, efectivo en dólares, efectivo en bolívares, transferencia y USDT. Para clientes que pagan en cuotas, el sistema registra cada pago contra la factura correspondiente.',7),
('vps_ser_08','cmr9zg7bh00138ckxsznn09ou','¿Cuánto cuesta ActivoPOS para una empresa de servicios?','El plan Negocio a $25/mes cubre cotizaciones, cobros, cuentas por cobrar y hasta 10 usuarios. El plan Pro a $40/mes agrega analytics avanzado y usuarios ilimitados.',8),
('vps_ser_09','cmr9zg7bh00138ckxsznn09ou','¿Puedo cancelar si no me convence?','Sí. Sin contrato anual ni penalización. Tu empresa mantiene el acceso hasta el final del período pagado.',9),
('vps_ser_10','cmr9zg7bh00138ckxsznn09ou','¿Funciona desde el teléfono cuando estoy fuera de la oficina?','Sí. Puedes registrar un cobro, revisar cuentas por cobrar o consultar el estado de una cotización desde cualquier teléfono Android o iPhone.',10),
('vps_ser_11','cmr9zg7bh00138ckxsznn09ou','¿Puedo ver qué servicios me generan más ingresos?','Sí. Los reportes muestran servicios más vendidos, ingreso por tipo de servicio y tu margen real. Información para decidir en qué especializarte y qué servicios subir de precio.',11),
('vps_ser_12','cmr9zg7bh00138ckxsznn09ou','¿Qué pasa si se va el internet estando con un cliente?','Las operaciones ya registradas quedan guardadas. Con el hotspot del teléfono como respaldo, nunca te quedas sin poder registrar un cobro en medio de una reunión.',12),

-- ============================================================
-- PANADERÍA (169c32e07b6c11f19e4ffce8d4bc4433)
-- ============================================================
('vps_pan_01','169c32e07b6c11f19e4ffce8d4bc4433','¿Puedo vender pan por unidad, por kilo y por bandeja?','Sí. Cada producto tiene su unidad de medida — el pan de sandwich se vende por unidad, los bollos por docena y el pan de jamón por kilo. El sistema calcula el precio según la unidad que configures para cada producto.',1),
('vps_pan_02','169c32e07b6c11f19e4ffce8d4bc4433','¿Cómo manejo los productos que cambian de precio con el dólar?','Defines el precio en dólares una sola vez y ActivoPOS convierte a bolívares automáticamente con la tasa BCV en cada cobro. La mantequilla, el queso y los rellenos importados se actualizan solos cuando el dólar sube.',2),
('vps_pan_03','169c32e07b6c11f19e4ffce8d4bc4433','¿Puedo saber qué productos se agotan primero en el día?','Sí. El inventario descuenta en tiempo real con cada venta. Ves qué panes quedan en vitrina sin necesidad de ir a contar. Cuando un producto baja del mínimo que defines, el sistema te avisa para producir o reponer.',3),
('vps_pan_04','169c32e07b6c11f19e4ffce8d4bc4433','¿ActivoPOS reemplaza mi facturación del SENIAT?','No. ActivoPOS es tu sistema de control de ventas e inventario — no reemplaza tu facturación SENIAT, la complementa. Tu panadería usa ActivoPOS para el control diario y tu sistema fiscal para las obligaciones tributarias.',4),
('vps_pan_05','169c32e07b6c11f19e4ffce8d4bc4433','¿Necesito instalar algo en mi panadería?','No. ActivoPOS corre en el navegador de cualquier dispositivo. La cajera trabaja desde el teléfono en el mostrador o desde una tablet en la caja. Sin instalación, sin técnico de sistemas.',5),
('vps_pan_06','169c32e07b6c11f19e4ffce8d4bc4433','¿Cómo se actualiza la tasa del dólar en los precios de la panadería?','Automáticamente. ActivoPOS consulta la tasa BCV varias veces al día. Los precios en bolívares de todos tus productos se recalculan solos en cada cobro — sin que toques nada cuando el dólar se mueve.',6),
('vps_pan_07','169c32e07b6c11f19e4ffce8d4bc4433','¿Qué métodos de pago acepta ActivoPOS en mi panadería?','Todos los que usa Venezuela: Pago Móvil, Zelle, efectivo en dólares, efectivo en bolívares, transferencia y USDT. En una panadería donde el cliente paga rápido, el sistema registra pagos mixtos sin rehacer el ticket.',7),
('vps_pan_08','169c32e07b6c11f19e4ffce8d4bc4433','¿Cuánto cuesta ActivoPOS para una panadería?','El plan Mostrador a $15/mes es perfecto para panaderías pequeñas — cubre POS, inventario y cierre de caja. El plan Negocio a $25/mes agrega catálogo digital para pedidos por WhatsApp y delivery.',8),
('vps_pan_09','169c32e07b6c11f19e4ffce8d4bc4433','¿Puedo cancelar si no me convence?','Sí. Sin contrato anual ni penalización. Tu panadería mantiene el acceso hasta el final del período pagado y cancelas cuando quieras.',9),
('vps_pan_10','169c32e07b6c11f19e4ffce8d4bc4433','¿Funciona desde el teléfono en el mostrador?','Sí. La cajera registra ventas desde cualquier teléfono Android o iPhone. En una panadería donde el mostrador es pequeño, el teléfono es la caja perfecta.',10),
('vps_pan_11','169c32e07b6c11f19e4ffce8d4bc4433','¿Puedo ver qué panes y pastelería se venden más cada día?','Sí. Los reportes muestran los productos más vendidos por período. Sabes qué prepara más la producción, qué sobra cada tarde y cuándo hacer más de lo que más rota.',11),
('vps_pan_12','169c32e07b6c11f19e4ffce8d4bc4433','¿Qué pasa si se va el internet en la panadería?','Las ventas ya registradas quedan guardadas. Para nuevas ventas necesitas conexión. Recomendamos el hotspot del teléfono como respaldo — en la hora pico de la mañana, la caja no puede parar.',12),

-- ============================================================
-- FRUTERÍA (169c4f0a7b6c11f19e4ffce8d4bc4433)
-- ============================================================
('vps_fru_01','169c4f0a7b6c11f19e4ffce8d4bc4433','¿Puedo vender frutas y verduras por kilo y por unidad?','Sí. Cada producto tiene su unidad de medida — el tomate se vende por kilo, los limones por unidad o por docena, y el lechón por pieza. El sistema calcula el precio automáticamente según la unidad configurada.',1),
('vps_fru_02','169c4f0a7b6c11f19e4ffce8d4bc4433','¿Cómo manejo los precios que cambian todos los días en la frutería?','Actualizas el precio en dólares cuando cambia y ActivoPOS recalcula los bolívares automáticamente con la tasa BCV. Para productos con precio volátil como tomate o pimentón, cambias el precio en segundos desde el teléfono.',2),
('vps_fru_03','169c4f0a7b6c11f19e4ffce8d4bc4433','¿Puedo saber qué mercancía me queda antes de que se dañe?','Sí. El inventario descuenta en tiempo real con cada venta. Configuras el stock mínimo y el sistema te avisa cuando queda poco de algún producto — especialmente importante en frutas y verduras donde el tiempo de vida es corto.',3),
('vps_fru_04','169c4f0a7b6c11f19e4ffce8d4bc4433','¿ActivoPOS reemplaza mi facturación del SENIAT?','No. ActivoPOS es tu sistema de control de ventas e inventario — no reemplaza tu facturación SENIAT, la complementa.',4),
('vps_fru_05','169c4f0a7b6c11f19e4ffce8d4bc4433','¿Necesito instalar algo en mi frutería?','No. ActivoPOS corre en el navegador. Funciona desde el teléfono en el mostrador o desde una tablet en la caja. Sin instalación ni técnico.',5),
('vps_fru_06','169c4f0a7b6c11f19e4ffce8d4bc4433','¿Cómo se actualiza la tasa del dólar en los precios de frutas y verduras?','Automáticamente. ActivoPOS consulta la tasa BCV varias veces al día. Los precios en bolívares se recalculan solos en cada cobro.',6),
('vps_fru_07','169c4f0a7b6c11f19e4ffce8d4bc4433','¿Qué métodos de pago acepta ActivoPOS en mi frutería?','Todos los que usa Venezuela: Pago Móvil, Zelle, efectivo en dólares, efectivo en bolívares, transferencia y USDT. El cliente que paga en dos partes no te complica — el sistema lo registra todo en un ticket.',7),
('vps_fru_08','169c4f0a7b6c11f19e4ffce8d4bc4433','¿Cuánto cuesta ActivoPOS para una frutería?','El plan Mostrador a $15/mes es suficiente para fruterías — cubre POS, inventario y cierre de caja. El plan Negocio a $25/mes agrega catálogo digital para pedidos por WhatsApp.',8),
('vps_fru_09','169c4f0a7b6c11f19e4ffce8d4bc4433','¿Puedo cancelar si no me convence?','Sí. Sin contrato anual ni penalización. Cancelas cuando quieras y tu frutería mantiene el acceso hasta el final del período pagado.',9),
('vps_fru_10','169c4f0a7b6c11f19e4ffce8d4bc4433','¿Funciona desde el teléfono en el puesto?','Sí. ActivoPOS funciona desde cualquier teléfono Android o iPhone. Perfecto para fruterías donde el puesto no tiene espacio para una computadora.',10),
('vps_fru_11','169c4f0a7b6c11f19e4ffce8d4bc4433','¿Puedo ver qué frutas y verduras se venden más?','Sí. Los reportes muestran los productos más vendidos por período. Sabes qué comprar más en el mercado mayorista y qué producto se queda sin vender.',11),
('vps_fru_12','169c4f0a7b6c11f19e4ffce8d4bc4433','¿Qué pasa si se va el internet en la frutería?','Las ventas ya registradas quedan guardadas. Para nuevas ventas necesitas conexión. El hotspot del teléfono funciona como respaldo.',12),

-- ============================================================
-- MASCOTAS (169c56857b6c11f19e4ffce8d4bc4433)
-- ============================================================
('vps_mas_01','169c56857b6c11f19e4ffce8d4bc4433','¿Puedo manejar ventas de productos y servicios veterinarios en el mismo sistema?','Sí. ActivoPOS maneja productos físicos (alimentos, accesorios, medicamentos) y servicios (baño, corte, consulta) en el mismo POS. Cierras un ticket con una bolsa de croquetas y el baño del perro en una sola venta.',1),
('vps_mas_02','169c56857b6c11f19e4ffce8d4bc4433','¿Cómo manejo los medicamentos veterinarios con precio en dólares?','Defines el precio en dólares y ActivoPOS convierte a bolívares automáticamente con la tasa BCV en cada cobro. Cuando el dólar sube, no tienes que actualizar el catálogo — el precio en bolívares se ajusta solo.',2),
('vps_mas_03','169c56857b6c11f19e4ffce8d4bc4433','¿Puedo saber qué alimentos y accesorios se están agotando?','Sí. El inventario descuenta en tiempo real y te alerta cuando cualquier producto baja del mínimo que definas. Nunca más te quedas sin la marca de croquetas que más rota sin saberlo con tiempo de pedir.',3),
('vps_mas_04','169c56857b6c11f19e4ffce8d4bc4433','¿ActivoPOS reemplaza mi facturación del SENIAT?','No. ActivoPOS es tu sistema de control de ventas e inventario — no reemplaza tu facturación SENIAT, la complementa.',4),
('vps_mas_05','169c56857b6c11f19e4ffce8d4bc4433','¿Necesito instalar algo en mi pet shop o veterinaria?','No. ActivoPOS corre en el navegador de cualquier dispositivo. Sin instalación, sin técnico, sin licencias adicionales.',5),
('vps_mas_06','169c56857b6c11f19e4ffce8d4bc4433','¿Cómo se actualiza la tasa del dólar en mis precios?','Automáticamente. ActivoPOS consulta la tasa BCV varias veces al día y recalcula los precios en bolívares en cada cobro.',6),
('vps_mas_07','169c56857b6c11f19e4ffce8d4bc4433','¿Qué métodos de pago acepta ActivoPOS en mi tienda de mascotas?','Todos los que usa Venezuela: Pago Móvil, Zelle, efectivo en dólares, efectivo en bolívares, transferencia y USDT. Un mismo ticket puede mezclar varios métodos.',7),
('vps_mas_08','169c56857b6c11f19e4ffce8d4bc4433','¿Cuánto cuesta ActivoPOS para una tienda de mascotas?','El plan Negocio a $25/mes cubre inventario, ventas, catálogo digital y hasta 10 usuarios. El plan Pro a $40/mes agrega analytics y usuarios ilimitados.',8),
('vps_mas_09','169c56857b6c11f19e4ffce8d4bc4433','¿Puedo cancelar si no me convence?','Sí. Sin contrato anual ni penalización. Cancelas cuando quieras.',9),
('vps_mas_10','169c56857b6c11f19e4ffce8d4bc4433','¿Funciona desde el teléfono?','Sí. Registras ventas y consultas inventario desde cualquier teléfono Android o iPhone.',10),
('vps_mas_11','169c56857b6c11f19e4ffce8d4bc4433','¿Puedo ver qué productos y servicios generan más ingresos?','Sí. Los reportes muestran los más vendidos, el margen por producto y los servicios con mayor demanda. Información para decidir qué ofrecer más y qué liquidar.',11),
('vps_mas_12','169c56857b6c11f19e4ffce8d4bc4433','¿Qué pasa si se va el internet?','Las ventas ya registradas quedan guardadas. Para nuevas ventas necesitas conexión. El hotspot del teléfono funciona como respaldo.',12),

-- ============================================================
-- PAPELERÍA (169c5cf77b6c11f19e4ffce8d4bc4433)
-- ============================================================
('vps_pap_01','169c5cf77b6c11f19e4ffce8d4bc4433','¿Puedo manejar útiles escolares, servicios de impresión y fotocopiado en el mismo sistema?','Sí. ActivoPOS maneja productos físicos (cuadernos, lápices, cartuchos) y servicios (impresión, plastificado, encuadernado) en el mismo POS. Cierras un ticket con productos y servicios en una sola venta.',1),
('vps_pap_02','169c5cf77b6c11f19e4ffce8d4bc4433','¿Cómo manejo los precios de insumos que cambian con el dólar?','Defines el precio en dólares y ActivoPOS convierte a bolívares automáticamente. Los cartuchos de tinta, el papel bond y los insumos importados se actualizan solos en cada cobro cuando el dólar sube.',2),
('vps_pap_03','169c5cf77b6c11f19e4ffce8d4bc4433','¿Puedo saber qué útiles se están agotando antes de la temporada escolar?','Sí. El inventario descuenta en tiempo real y te alerta cuando cualquier producto baja del mínimo. En temporada escolar, nunca más te quedas sin cuadernos o lápices en el momento de mayor demanda.',3),
('vps_pap_04','169c5cf77b6c11f19e4ffce8d4bc4433','¿ActivoPOS reemplaza mi facturación del SENIAT?','No. ActivoPOS es tu sistema de control de ventas e inventario — no reemplaza tu facturación SENIAT, la complementa.',4),
('vps_pap_05','169c5cf77b6c11f19e4ffce8d4bc4433','¿Necesito instalar algo en mi papelería?','No. ActivoPOS corre en el navegador. Funciona desde el teléfono, una tablet o la computadora del local. Sin instalación ni técnico.',5),
('vps_pap_06','169c5cf77b6c11f19e4ffce8d4bc4433','¿Cómo se actualiza la tasa del dólar en mis precios?','Automáticamente. ActivoPOS consulta la tasa BCV varias veces al día y recalcula los precios en bolívares en cada cobro.',6),
('vps_pap_07','169c5cf77b6c11f19e4ffce8d4bc4433','¿Qué métodos de pago acepta ActivoPOS en mi papelería?','Todos los que usa Venezuela: Pago Móvil, Zelle, efectivo en dólares, efectivo en bolívares, transferencia y USDT.',7),
('vps_pap_08','169c5cf77b6c11f19e4ffce8d4bc4433','¿Cuánto cuesta ActivoPOS para una papelería?','El plan Mostrador a $15/mes cubre POS, inventario y cierre de caja. El plan Negocio a $25/mes agrega catálogo digital para pedidos por WhatsApp y más capacidad de productos.',8),
('vps_pap_09','169c5cf77b6c11f19e4ffce8d4bc4433','¿Puedo cancelar si no me convence?','Sí. Sin contrato anual ni penalización. Cancelas cuando quieras.',9),
('vps_pap_10','169c5cf77b6c11f19e4ffce8d4bc4433','¿Funciona desde el teléfono en el mostrador?','Sí. La cajera registra ventas desde cualquier teléfono Android o iPhone.',10),
('vps_pap_11','169c5cf77b6c11f19e4ffce8d4bc4433','¿Puedo ver qué productos y servicios generan más ventas?','Sí. Los reportes muestran los más vendidos por período. Sabes qué útiles reponer antes de temporada y qué servicios son los más solicitados.',11),
('vps_pap_12','169c5cf77b6c11f19e4ffce8d4bc4433','¿Qué pasa si se va el internet en la papelería?','Las ventas ya registradas quedan guardadas. Para nuevas ventas necesitas conexión. El hotspot del teléfono funciona como respaldo.',12),

-- ============================================================
-- BELLEZA (169c5eac7b6c11f19e4ffce8d4bc4433)
-- ============================================================
('vps_bel_01','169c5eac7b6c11f19e4ffce8d4bc4433','¿Puedo manejar servicios de peluquería, manicure y estética en el mismo sistema?','Sí. ActivoPOS maneja servicios (corte, tinte, tratamiento, uñas) y productos (tintes, cremas, accesorios) en el mismo POS. Cierras un ticket con el corte más los productos que la clienta se lleva en una sola venta.',1),
('vps_bel_02','169c5eac7b6c11f19e4ffce8d4bc4433','¿Cómo manejo los precios de productos importados que cambian con el dólar?','Defines el precio en dólares y ActivoPOS convierte a bolívares automáticamente con la tasa BCV. Los tintes, tratamientos y productos importados se actualizan solos en cada cobro.',2),
('vps_bel_03','169c5eac7b6c11f19e4ffce8d4bc4433','¿Puedo llevar el control de cuánto producto uso por servicio?','Sí. Registras los productos como insumos de cada servicio y el sistema descuenta del inventario automáticamente. Sabes cuánto tinte o producto de tratamiento te queda sin tener que contar.',3),
('vps_bel_04','169c5eac7b6c11f19e4ffce8d4bc4433','¿ActivoPOS reemplaza mi facturación del SENIAT?','No. ActivoPOS es tu sistema de control de ventas e inventario — no reemplaza tu facturación SENIAT, la complementa.',4),
('vps_bel_05','169c5eac7b6c11f19e4ffce8d4bc4433','¿Necesito instalar algo en mi salón de belleza?','No. ActivoPOS corre en el navegador de cualquier dispositivo. Funciona desde el teléfono, una tablet en la recepción o la computadora del salón. Sin instalación ni técnico.',5),
('vps_bel_06','169c5eac7b6c11f19e4ffce8d4bc4433','¿Cómo se actualiza la tasa del dólar en mis precios?','Automáticamente. ActivoPOS consulta la tasa BCV varias veces al día y recalcula los precios en bolívares en cada cobro.',6),
('vps_bel_07','169c5eac7b6c11f19e4ffce8d4bc4433','¿Qué métodos de pago acepta ActivoPOS en mi salón de belleza?','Todos los que usa Venezuela: Pago Móvil, Zelle, efectivo en dólares, efectivo en bolívares, transferencia y USDT. La clienta que paga el servicio en Pago Móvil y los productos en efectivo — un solo ticket.',7),
('vps_bel_08','169c5eac7b6c11f19e4ffce8d4bc4433','¿Cuánto cuesta ActivoPOS para un salón de belleza?','El plan Negocio a $25/mes cubre ventas de servicios y productos, catálogo digital y hasta 10 usuarios. Ideal para salones con varios estilistas.',8),
('vps_bel_09','169c5eac7b6c11f19e4ffce8d4bc4433','¿Puedo cancelar si no me convence?','Sí. Sin contrato anual ni penalización. Cancelas cuando quieras.',9),
('vps_bel_10','169c5eac7b6c11f19e4ffce8d4bc4433','¿Funciona desde el teléfono en la recepción?','Sí. La recepcionista registra el servicio y cobra desde cualquier teléfono Android o iPhone.',10),
('vps_bel_11','169c5eac7b6c11f19e4ffce8d4bc4433','¿Puedo ver qué servicios y estilistas generan más ingresos?','Sí. Los reportes muestran los servicios más vendidos y el ingreso por período. Sabes cuál es el servicio estrella de tu salón y en qué días hay más demanda.',11),
('vps_bel_12','169c5eac7b6c11f19e4ffce8d4bc4433','¿Qué pasa si se va el internet en el salón?','Las ventas ya registradas quedan guardadas. Para nuevas ventas necesitas conexión. El hotspot del teléfono funciona como respaldo.',12),

-- ============================================================
-- MUEBLERÍA (169c60ab7b6c11f19e4ffce8d4bc4433)
-- ============================================================
('vps_mue_01','169c60ab7b6c11f19e4ffce8d4bc4433','¿Puedo manejar pedidos a medida y ventas de showroom en el mismo sistema?','Sí. ActivoPOS registra ventas de productos en inventario y pedidos especiales con anticipo y saldo pendiente. El cliente que paga un adelanto por el sofá a medida queda registrado con el saldo que debe antes de la entrega.',1),
('vps_mue_02','169c60ab7b6c11f19e4ffce8d4bc4433','¿Cómo manejo los precios de muebles importados que cambian con el dólar?','Defines el precio en dólares y ActivoPOS convierte a bolívares automáticamente. Cuando el dólar sube, no tienes que actualizar el catálogo — el precio en bolívares se ajusta solo en cada cobro.',2),
('vps_mue_03','169c60ab7b6c11f19e4ffce8d4bc4433','¿Puedo llevar el control de pedidos pendientes de entrega?','Sí. Registras las ventas a crédito con el cliente asignado y el saldo pendiente. Sabes exactamente qué pedidos están por entregar, quién debe cuánto y desde cuándo.',3),
('vps_mue_04','169c60ab7b6c11f19e4ffce8d4bc4433','¿ActivoPOS reemplaza mi facturación del SENIAT?','No. ActivoPOS es tu sistema de control de ventas e inventario — no reemplaza tu facturación SENIAT, la complementa.',4),
('vps_mue_05','169c60ab7b6c11f19e4ffce8d4bc4433','¿Necesito instalar algo en mi mueblería?','No. ActivoPOS corre en el navegador. Funciona desde la computadora del showroom, la tablet del vendedor o el teléfono. Sin instalación ni técnico.',5),
('vps_mue_06','169c60ab7b6c11f19e4ffce8d4bc4433','¿Cómo se actualiza la tasa del dólar en los precios de muebles?','Automáticamente. ActivoPOS consulta la tasa BCV y recalcula los precios en bolívares en cada cobro.',6),
('vps_mue_07','169c60ab7b6c11f19e4ffce8d4bc4433','¿Qué métodos de pago acepta ActivoPOS en mi mueblería?','Todos los que usa Venezuela: Pago Móvil, Zelle, efectivo en dólares, efectivo en bolívares, transferencia y USDT. Para ventas de alto valor donde el cliente paga en partes, registras cada abono contra el pedido.',7),
('vps_mue_08','169c60ab7b6c11f19e4ffce8d4bc4433','¿Cuánto cuesta ActivoPOS para una mueblería?','El plan Negocio a $25/mes cubre ventas, inventario, cuentas por cobrar y catálogo digital. El plan Pro a $40/mes agrega analytics y usuarios ilimitados para mueblerías con mayor equipo de ventas.',8),
('vps_mue_09','169c60ab7b6c11f19e4ffce8d4bc4433','¿Puedo cancelar si no me convence?','Sí. Sin contrato anual ni penalización. Cancelas cuando quieras.',9),
('vps_mue_10','169c60ab7b6c11f19e4ffce8d4bc4433','¿El vendedor puede usar el teléfono para registrar ventas en el showroom?','Sí. El vendedor registra la venta, el anticipo y el saldo desde cualquier teléfono Android o iPhone — sin necesidad de ir a la computadora.',10),
('vps_mue_11','169c60ab7b6c11f19e4ffce8d4bc4433','¿Puedo ver qué muebles y colecciones generan más ventas?','Sí. Los reportes muestran los productos más vendidos, el margen real y los pedidos pendientes de entrega.',11),
('vps_mue_12','169c60ab7b6c11f19e4ffce8d4bc4433','¿Qué pasa si se va el internet en la mueblería?','Las ventas ya registradas quedan guardadas. Para nuevas ventas necesitas conexión. El hotspot del teléfono funciona como respaldo.',12),

-- ============================================================
-- LAVANDERÍA (169c62617b6c11f19e4ffce8d4bc4433)
-- ============================================================
('vps_lav_01','169c62617b6c11f19e4ffce8d4bc4433','¿Puedo registrar servicios de lavado, planchado y entrega en el mismo sistema?','Sí. ActivoPOS maneja cada servicio por separado — lavado por kilo, planchado por pieza, servicio express — y los combina en un solo ticket. El cliente que trae ropa para lavar y planchar paga todo de una vez.',1),
('vps_lav_02','169c62617b6c11f19e4ffce8d4bc4433','¿Cómo manejo los precios de servicios que cambian con el dólar?','Defines el precio de cada servicio en dólares y ActivoPOS convierte a bolívares automáticamente con la tasa BCV en cada cobro. Cuando el dólar sube, no tienes que actualizar la lista de precios.',2),
('vps_lav_03','169c62617b6c11f19e4ffce8d4bc4433','¿Puedo llevar el control de prendas pendientes de entrega?','Sí. Registras cada orden con el cliente asignado, el estado (recibido, en proceso, listo) y el saldo pendiente. Sabes exactamente qué está listo para entregar y qué cliente falta por pagar.',3),
('vps_lav_04','169c62617b6c11f19e4ffce8d4bc4433','¿ActivoPOS reemplaza mi facturación del SENIAT?','No. ActivoPOS es tu sistema de control de ventas e inventario — no reemplaza tu facturación SENIAT, la complementa.',4),
('vps_lav_05','169c62617b6c11f19e4ffce8d4bc4433','¿Necesito instalar algo en mi lavandería?','No. ActivoPOS corre en el navegador de cualquier dispositivo. Sin instalación ni técnico.',5),
('vps_lav_06','169c62617b6c11f19e4ffce8d4bc4433','¿Cómo se actualiza la tasa del dólar en los precios de lavandería?','Automáticamente. ActivoPOS consulta la tasa BCV y recalcula los precios en bolívares en cada cobro.',6),
('vps_lav_07','169c62617b6c11f19e4ffce8d4bc4433','¿Qué métodos de pago acepta ActivoPOS en mi lavandería?','Todos los que usa Venezuela: Pago Móvil, Zelle, efectivo en dólares, efectivo en bolívares, transferencia y USDT.',7),
('vps_lav_08','169c62617b6c11f19e4ffce8d4bc4433','¿Cuánto cuesta ActivoPOS para una lavandería?','El plan Mostrador a $15/mes cubre registro de servicios, inventario básico y cierre de caja. El plan Negocio a $25/mes agrega cuentas por cobrar y catálogo digital.',8),
('vps_lav_09','169c62617b6c11f19e4ffce8d4bc4433','¿Puedo cancelar si no me convence?','Sí. Sin contrato anual ni penalización. Cancelas cuando quieras.',9),
('vps_lav_10','169c62617b6c11f19e4ffce8d4bc4433','¿Funciona desde el teléfono en el mostrador?','Sí. Registras la orden de lavado y cobras desde cualquier teléfono Android o iPhone.',10),
('vps_lav_11','169c62617b6c11f19e4ffce8d4bc4433','¿Puedo ver cuánto factura mi lavandería por semana?','Sí. Los reportes muestran el ingreso por período, los servicios más solicitados y los clientes más frecuentes.',11),
('vps_lav_12','169c62617b6c11f19e4ffce8d4bc4433','¿Qué pasa si se va el internet en la lavandería?','Las órdenes ya registradas quedan guardadas. Para nuevas órdenes necesitas conexión. El hotspot del teléfono funciona como respaldo.',12),

-- ============================================================
-- DEPORTES (169c784b7b6c11f19e4ffce8d4bc4433)
-- ============================================================
('vps_dep_01','169c784b7b6c11f19e4ffce8d4bc4433','¿Puedo manejar ropa deportiva, equipos y accesorios en el mismo sistema?','Sí. ActivoPOS maneja todo el catálogo deportivo en un solo inventario — franelas por talla y color, equipos por referencia, accesorios por unidad. Un solo sistema para toda la tienda.',1),
('vps_dep_02','169c784b7b6c11f19e4ffce8d4bc4433','¿Cómo manejo los precios de equipos importados que cambian con el dólar?','Defines el precio en dólares y ActivoPOS convierte a bolívares automáticamente. Balones, guayos, raquetas y cualquier equipo importado se actualiza solo en cada cobro cuando el dólar sube.',2),
('vps_dep_03','169c784b7b6c11f19e4ffce8d4bc4433','¿Puedo controlar el inventario por talla en la ropa deportiva?','Sí. Cada prenda se configura con sus variantes de talla y color. Sabes exactamente cuántas franelas XL azules te quedan sin ir al depósito a contar.',3),
('vps_dep_04','169c784b7b6c11f19e4ffce8d4bc4433','¿ActivoPOS reemplaza mi facturación del SENIAT?','No. ActivoPOS es tu sistema de control de ventas e inventario — no reemplaza tu facturación SENIAT, la complementa.',4),
('vps_dep_05','169c784b7b6c11f19e4ffce8d4bc4433','¿Necesito instalar algo en mi tienda deportiva?','No. ActivoPOS corre en el navegador de cualquier dispositivo. Sin instalación ni técnico.',5),
('vps_dep_06','169c784b7b6c11f19e4ffce8d4bc4433','¿Cómo se actualiza la tasa del dólar en los precios deportivos?','Automáticamente. ActivoPOS consulta la tasa BCV y recalcula los precios en bolívares en cada cobro.',6),
('vps_dep_07','169c784b7b6c11f19e4ffce8d4bc4433','¿Qué métodos de pago acepta ActivoPOS en mi tienda de deportes?','Todos los que usa Venezuela: Pago Móvil, Zelle, efectivo en dólares, efectivo en bolívares, transferencia y USDT.',7),
('vps_dep_08','169c784b7b6c11f19e4ffce8d4bc4433','¿Cuánto cuesta ActivoPOS para una tienda de deportes?','El plan Negocio a $25/mes cubre inventario por variante, catálogo digital y hasta 10 usuarios. El plan Pro a $40/mes para tiendas con mayor volumen y equipo.',8),
('vps_dep_09','169c784b7b6c11f19e4ffce8d4bc4433','¿Puedo cancelar si no me convence?','Sí. Sin contrato anual ni penalización. Cancelas cuando quieras.',9),
('vps_dep_10','169c784b7b6c11f19e4ffce8d4bc4433','¿Funciona desde el teléfono en el mostrador?','Sí. El cajero registra ventas desde cualquier teléfono Android o iPhone.',10),
('vps_dep_11','169c784b7b6c11f19e4ffce8d4bc4433','¿Puedo ver qué productos deportivos se venden más?','Sí. Los reportes muestran los más vendidos por período. Sabes qué reponer antes de temporada de fútbol, béisbol o inicio escolar.',11),
('vps_dep_12','169c784b7b6c11f19e4ffce8d4bc4433','¿Qué pasa si se va el internet en la tienda?','Las ventas ya registradas quedan guardadas. El hotspot del teléfono funciona como respaldo.',12),

-- ============================================================
-- MAYORISTA / DISTRIBUIDORA (169c819b7b6c11f19e4ffce8d4bc4433)
-- ============================================================
('vps_may_01','169c819b7b6c11f19e4ffce8d4bc4433','¿ActivoPOS maneja precios diferenciados por tipo de cliente mayorista?','Sí. Configuras listas de precio por cliente — el distribuidor A tiene sus precios, el distribuidor B los suyos, y el cliente de mostrador los precios de detal. El sistema aplica la lista correcta automáticamente en cada venta.',1),
('vps_may_02','169c819b7b6c11f19e4ffce8d4bc4433','¿Puedo manejar ventas a crédito a clientes frecuentes?','Sí. ActivoPOS registra ventas a crédito con el cliente asignado y lleva el saldo pendiente de cada uno. Sabes exactamente quién te debe, cuánto y desde cuándo — sin libreta ni Excel.',2),
('vps_may_03','169c819b7b6c11f19e4ffce8d4bc4433','¿Puedo controlar el inventario de un almacén o depósito grande?','Sí. El inventario descuenta en tiempo real con cada venta. Configuras el stock mínimo por producto y el sistema te alerta cuando hay que reponer. Para distribuidoras con cientos de referencias, la búsqueda por código es instantánea.',3),
('vps_may_04','169c819b7b6c11f19e4ffce8d4bc4433','¿ActivoPOS reemplaza mi facturación del SENIAT?','No. ActivoPOS es tu sistema de control de ventas e inventario — no reemplaza tu facturación SENIAT, la complementa.',4),
('vps_may_05','169c819b7b6c11f19e4ffce8d4bc4433','¿Necesito instalar algo en mi distribuidora?','No. ActivoPOS corre en el navegador. Funciona desde la computadora de la oficina, la tablet del almacén o el teléfono del vendedor en ruta. Sin instalación ni técnico.',5),
('vps_may_06','169c819b7b6c11f19e4ffce8d4bc4433','¿Cómo se actualiza la tasa del dólar en los precios al mayor?','Automáticamente. ActivoPOS consulta la tasa BCV y recalcula los precios en bolívares en cada cobro.',6),
('vps_may_07','169c819b7b6c11f19e4ffce8d4bc4433','¿Qué métodos de pago acepta ActivoPOS en mi distribuidora?','Todos los que usa Venezuela: Pago Móvil, Zelle, efectivo en dólares, efectivo en bolívares, transferencia y USDT. Para clientes que pagan con cheque diferido o en partes, registras cada abono contra la venta.',7),
('vps_may_08','169c819b7b6c11f19e4ffce8d4bc4433','¿Cuánto cuesta ActivoPOS para una distribuidora?','El plan Negocio a $25/mes cubre hasta 500 productos, hasta 10 usuarios y cuentas por cobrar. El plan Pro a $40/mes es para distribuidoras con catálogo masivo y usuarios ilimitados.',8),
('vps_may_09','169c819b7b6c11f19e4ffce8d4bc4433','¿Puedo cancelar si no me convence?','Sí. Sin contrato anual ni penalización. Cancelas cuando quieras.',9),
('vps_may_10','169c819b7b6c11f19e4ffce8d4bc4433','¿El vendedor en ruta puede registrar pedidos desde el teléfono?','Sí. El vendedor registra la venta desde cualquier teléfono Android o iPhone. El inventario se actualiza en tiempo real para que en la oficina sepan qué despachar.',10),
('vps_may_11','169c819b7b6c11f19e4ffce8d4bc4433','¿Puedo ver el reporte de ventas por cliente y por producto?','Sí. Los reportes muestran los clientes con mayor volumen, los productos que más rotan y el saldo pendiente por cobrar. Información para gestionar el crédito y priorizar el cobro.',11),
('vps_may_12','169c819b7b6c11f19e4ffce8d4bc4433','¿Qué pasa si se va el internet en la distribuidora?','Las ventas ya registradas quedan guardadas. Para nuevas ventas necesitas conexión. El hotspot del teléfono funciona como respaldo.',12),

-- ============================================================
-- LICORERÍA (169c82c87b6c11f19e4ffce8d4bc4433)
-- ============================================================
('vps_lic_01','169c82c87b6c11f19e4ffce8d4bc4433','¿Puedo manejar ventas por unidad, por caja y por botella en el mismo sistema?','Sí. Cada producto tiene su unidad de medida — el whisky se vende por botella, la cerveza por unidad o por six-pack, y el ron por caja al mayor. El sistema calcula el precio automáticamente.',1),
('vps_lic_02','169c82c87b6c11f19e4ffce8d4bc4433','¿Cómo manejo los precios de licores importados que cambian con el dólar?','Defines el precio en dólares y ActivoPOS convierte a bolívares automáticamente con la tasa BCV. Cuando el dólar sube, los precios en bolívares se ajustan solos en cada cobro.',2),
('vps_lic_03','169c82c87b6c11f19e4ffce8d4bc4433','¿Puedo saber qué referencias se están agotando?','Sí. El inventario descuenta en tiempo real y te alerta cuando cualquier producto baja del mínimo. Nunca más te quedas sin la marca que más rota sin saberlo con tiempo de reponer.',3),
('vps_lic_04','169c82c87b6c11f19e4ffce8d4bc4433','¿ActivoPOS reemplaza mi facturación del SENIAT?','No. ActivoPOS es tu sistema de control de ventas e inventario — no reemplaza tu facturación SENIAT, la complementa.',4),
('vps_lic_05','169c82c87b6c11f19e4ffce8d4bc4433','¿Necesito instalar algo en mi licorería?','No. ActivoPOS corre en el navegador. Funciona desde la computadora en la caja, una tablet o el teléfono. Sin instalación ni técnico.',5),
('vps_lic_06','169c82c87b6c11f19e4ffce8d4bc4433','¿Cómo se actualiza la tasa del dólar en los precios de licores?','Automáticamente. ActivoPOS consulta la tasa BCV y recalcula los precios en bolívares en cada cobro.',6),
('vps_lic_07','169c82c87b6c11f19e4ffce8d4bc4433','¿Qué métodos de pago acepta ActivoPOS en mi licorería?','Todos los que usa Venezuela: Pago Móvil, Zelle, efectivo en dólares, efectivo en bolívares, transferencia y USDT. Para ventas de alto volumen donde el cliente paga en partes, el sistema lo registra todo.',7),
('vps_lic_08','169c82c87b6c11f19e4ffce8d4bc4433','¿Cuánto cuesta ActivoPOS para una licorería?','El plan Mostrador a $15/mes cubre POS, inventario y cierre de caja. El plan Negocio a $25/mes agrega catálogo digital y ventas por WhatsApp para pedidos de eventos.',8),
('vps_lic_09','169c82c87b6c11f19e4ffce8d4bc4433','¿Puedo cancelar si no me convence?','Sí. Sin contrato anual ni penalización. Cancelas cuando quieras.',9),
('vps_lic_10','169c82c87b6c11f19e4ffce8d4bc4433','¿Funciona desde el teléfono en el mostrador?','Sí. El cajero registra ventas desde cualquier teléfono Android o iPhone.',10),
('vps_lic_11','169c82c87b6c11f19e4ffce8d4bc4433','¿Puedo ver qué licores y marcas se venden más?','Sí. Los reportes muestran los productos más vendidos por período. Sabes qué reponer antes de temporada de fiestas y qué marcas no están rotando.',11),
('vps_lic_12','169c82c87b6c11f19e4ffce8d4bc4433','¿Qué pasa si se va el internet en la licorería?','Las ventas ya registradas quedan guardadas. El hotspot del teléfono funciona como respaldo.',12),

-- ============================================================
-- ÓPTICA (169c83c67b6c11f19e4ffce8d4bc4433)
-- ============================================================
('vps_opt_01','169c83c67b6c11f19e4ffce8d4bc4433','¿Puedo manejar ventas de lentes, monturas y servicios de optometría en el mismo sistema?','Sí. ActivoPOS maneja productos (monturas, lentes de contacto, accesorios) y servicios (examen visual, adaptación) en el mismo POS. El cliente que compra las monturas y paga el examen visual paga todo en un solo ticket.',1),
('vps_opt_02','169c83c67b6c11f19e4ffce8d4bc4433','¿Cómo manejo los precios de lentes importados que cambian con el dólar?','Defines el precio en dólares y ActivoPOS convierte a bolívares automáticamente. Las monturas importadas, los lentes de contacto y los accesorios se actualizan solos en cada cobro.',2),
('vps_opt_03','169c83c67b6c11f19e4ffce8d4bc4433','¿Puedo llevar el control de pedidos de lentes en proceso?','Sí. Registras el pedido con el anticipo pagado, el saldo pendiente y el estado. Sabes exactamente qué pedidos están listos para entregar y cuál cliente falta por completar el pago.',3),
('vps_opt_04','169c83c67b6c11f19e4ffce8d4bc4433','¿ActivoPOS reemplaza mi facturación del SENIAT?','No. ActivoPOS es tu sistema de control de ventas e inventario — no reemplaza tu facturación SENIAT, la complementa.',4),
('vps_opt_05','169c83c67b6c11f19e4ffce8d4bc4433','¿Necesito instalar algo en mi óptica?','No. ActivoPOS corre en el navegador. Funciona desde la computadora de la óptica, una tablet en la sala de espera o el teléfono. Sin instalación ni técnico.',5),
('vps_opt_06','169c83c67b6c11f19e4ffce8d4bc4433','¿Cómo se actualiza la tasa del dólar en los precios de la óptica?','Automáticamente. ActivoPOS consulta la tasa BCV y recalcula los precios en bolívares en cada cobro.',6),
('vps_opt_07','169c83c67b6c11f19e4ffce8d4bc4433','¿Qué métodos de pago acepta ActivoPOS en mi óptica?','Todos los que usa Venezuela: Pago Móvil, Zelle, efectivo en dólares, efectivo en bolívares, transferencia y USDT. El cliente que paga el anticipo en Pago Móvil y el saldo al retirar en efectivo — un solo registro.',7),
('vps_opt_08','169c83c67b6c11f19e4ffce8d4bc4433','¿Cuánto cuesta ActivoPOS para una óptica?','El plan Negocio a $25/mes cubre ventas, inventario, cuentas por cobrar y catálogo digital. El plan Pro a $40/mes para ópticas con mayor catálogo y equipo.',8),
('vps_opt_09','169c83c67b6c11f19e4ffce8d4bc4433','¿Puedo cancelar si no me convence?','Sí. Sin contrato anual ni penalización. Cancelas cuando quieras.',9),
('vps_opt_10','169c83c67b6c11f19e4ffce8d4bc4433','¿Funciona desde el teléfono en la óptica?','Sí. El personal registra ventas y consulta pedidos desde cualquier teléfono Android o iPhone.',10),
('vps_opt_11','169c83c67b6c11f19e4ffce8d4bc4433','¿Puedo ver qué monturas y servicios generan más ingresos?','Sí. Los reportes muestran los productos más vendidos y el ingreso por servicio. Sabes qué marcas de monturas rotan más y cuál es el servicio con mayor demanda.',11),
('vps_opt_12','169c83c67b6c11f19e4ffce8d4bc4433','¿Qué pasa si se va el internet en la óptica?','Las ventas ya registradas quedan guardadas. El hotspot del teléfono funciona como respaldo.',12),

-- ============================================================
-- JUGUETERÍA (169c8a7c7b6c11f19e4ffce8d4bc4433)
-- ============================================================
('vps_jug_01','169c8a7c7b6c11f19e4ffce8d4bc4433','¿Puedo manejar juguetes por edad, categoría y temporada en el mismo sistema?','Sí. Organizas tu catálogo por categoría — bebés, niños, adolescentes, juegos de mesa — y el sistema lleva el inventario de cada referencia. En temporada de Navidad o Día del Niño, sabes exactamente qué tienes sin contar.',1),
('vps_jug_02','169c8a7c7b6c11f19e4ffce8d4bc4433','¿Cómo manejo los precios de juguetes importados que cambian con el dólar?','Defines el precio en dólares y ActivoPOS convierte a bolívares automáticamente. Cuando el dólar sube antes de Navidad, los precios en bolívares se ajustan solos en cada cobro.',2),
('vps_jug_03','169c8a7c7b6c11f19e4ffce8d4bc4433','¿Puedo saber qué juguetes se están agotando antes de temporada?','Sí. El inventario descuenta en tiempo real y te alerta cuando cualquier producto baja del mínimo. Nunca más te quedas sin los juguetes más pedidos en Navidad sin saberlo con tiempo de reponer.',3),
('vps_jug_04','169c8a7c7b6c11f19e4ffce8d4bc4433','¿ActivoPOS reemplaza mi facturación del SENIAT?','No. ActivoPOS es tu sistema de control de ventas e inventario — no reemplaza tu facturación SENIAT, la complementa.',4),
('vps_jug_05','169c8a7c7b6c11f19e4ffce8d4bc4433','¿Necesito instalar algo en mi juguetería?','No. ActivoPOS corre en el navegador de cualquier dispositivo. Sin instalación ni técnico.',5),
('vps_jug_06','169c8a7c7b6c11f19e4ffce8d4bc4433','¿Cómo se actualiza la tasa del dólar en los precios de juguetes?','Automáticamente. ActivoPOS consulta la tasa BCV y recalcula los precios en bolívares en cada cobro.',6),
('vps_jug_07','169c8a7c7b6c11f19e4ffce8d4bc4433','¿Qué métodos de pago acepta ActivoPOS en mi juguetería?','Todos los que usa Venezuela: Pago Móvil, Zelle, efectivo en dólares, efectivo en bolívares, transferencia y USDT.',7),
('vps_jug_08','169c8a7c7b6c11f19e4ffce8d4bc4433','¿Cuánto cuesta ActivoPOS para una juguetería?','El plan Negocio a $25/mes cubre inventario, ventas, catálogo digital para pedidos por WhatsApp y hasta 10 usuarios. Ideal para temporadas de alto volumen.',8),
('vps_jug_09','169c8a7c7b6c11f19e4ffce8d4bc4433','¿Puedo cancelar si no me convence?','Sí. Sin contrato anual ni penalización. Cancelas cuando quieras.',9),
('vps_jug_10','169c8a7c7b6c11f19e4ffce8d4bc4433','¿Funciona desde el teléfono en el mostrador?','Sí. El cajero registra ventas desde cualquier teléfono Android o iPhone — especialmente útil en temporada alta cuando el mostrador está lleno.',10),
('vps_jug_11','169c8a7c7b6c11f19e4ffce8d4bc4433','¿Puedo ver qué juguetes se venden más por temporada?','Sí. Los reportes muestran los más vendidos por período. Sabes qué importar más antes de Navidad y Día del Niño, y qué liquidar después de temporada.',11),
('vps_jug_12','169c8a7c7b6c11f19e4ffce8d4bc4433','¿Qué pasa si se va el internet en la juguetería?','Las ventas ya registradas quedan guardadas. El hotspot del teléfono funciona como respaldo — en temporada alta la caja no puede parar.',12),

-- ============================================================
-- ELECTRÓNICA (169cb2427b6c11f19e4ffce8d4bc4433)
-- ============================================================
('vps_ele_01','169cb2427b6c11f19e4ffce8d4bc4433','¿ActivoPOS lleva control de seriales de celulares y equipos electrónicos?','Sí. Registras el serial de cada equipo vendido y lo asignas al cliente. Cuando alguien regresa con un reclamo, buscas el serial y sabes exactamente a quién le vendiste, cuándo y a qué precio — sin buscar en facturas en papel.',1),
('vps_ele_02','169cb2427b6c11f19e4ffce8d4bc4433','¿Cómo manejo los precios de celulares y accesorios que cambian con el dólar?','Defines el precio en dólares y ActivoPOS convierte a bolívares automáticamente. Cuando el dólar sube, los precios en bolívares de todos tus equipos y accesorios se ajustan solos en cada cobro.',2),
('vps_ele_03','169cb2427b6c11f19e4ffce8d4bc4433','¿Puedo saber qué equipos y accesorios se están agotando?','Sí. El inventario descuenta en tiempo real y te alerta cuando cualquier referencia baja del mínimo. Nunca más te quedas sin los accesorios que más rotan sin saberlo.',3),
('vps_ele_04','169cb2427b6c11f19e4ffce8d4bc4433','¿ActivoPOS reemplaza mi facturación del SENIAT?','No. ActivoPOS es tu sistema de control de ventas e inventario — no reemplaza tu facturación SENIAT, la complementa.',4),
('vps_ele_05','169cb2427b6c11f19e4ffce8d4bc4433','¿Necesito instalar algo en mi tienda de electrónica?','No. ActivoPOS corre en el navegador. Funciona desde la computadora del mostrador, una tablet en la vitrina o el teléfono. Sin instalación ni técnico.',5),
('vps_ele_06','169cb2427b6c11f19e4ffce8d4bc4433','¿Cómo se actualiza la tasa del dólar en los precios de electrónica?','Automáticamente. ActivoPOS consulta la tasa BCV y recalcula los precios en bolívares en cada cobro — sin que tengas que actualizar el catálogo cuando el dólar se mueve.',6),
('vps_ele_07','169cb2427b6c11f19e4ffce8d4bc4433','¿Qué métodos de pago acepta ActivoPOS en mi tienda de electrónica?','Todos los que usa Venezuela: Pago Móvil, Zelle, efectivo en dólares, efectivo en bolívares, transferencia y USDT. Para equipos de alto valor donde el cliente paga en partes, el sistema registra el pago mixto en un solo ticket.',7),
('vps_ele_08','169cb2427b6c11f19e4ffce8d4bc4433','¿Cuánto cuesta ActivoPOS para una tienda de electrónica?','El plan Negocio a $25/mes cubre ventas con serial, inventario y catálogo digital. El plan Pro a $40/mes agrega analytics avanzado y usuarios ilimitados.',8),
('vps_ele_09','169cb2427b6c11f19e4ffce8d4bc4433','¿Puedo cancelar si no me convence?','Sí. Sin contrato anual ni penalización. Cancelas cuando quieras.',9),
('vps_ele_10','169cb2427b6c11f19e4ffce8d4bc4433','¿Funciona desde el teléfono en el mostrador?','Sí. El vendedor registra ventas y consulta inventario desde cualquier teléfono Android o iPhone.',10),
('vps_ele_11','169cb2427b6c11f19e4ffce8d4bc4433','¿Puedo ver qué equipos y accesorios generan más ingresos?','Sí. Los reportes muestran los más vendidos, el margen real por equipo y cuáles están sin movimiento. Información para decidir qué reponer y qué liquidar.',11),
('vps_ele_12','169cb2427b6c11f19e4ffce8d4bc4433','¿Qué pasa si se va el internet en la tienda de electrónica?','Las ventas ya registradas quedan guardadas. Recomendamos el hotspot del teléfono como respaldo — en una tienda de electrónica, no tener internet no puede parar las ventas.',12),

-- ============================================================
-- JOYERÍAS (inactivo - 3 FAQs básicas)
-- ============================================================
('vps_joy_01','cmr9zg7at000z8ckxyevlltg5','¿ActivoPOS maneja precios de joyas en dólares y bolívares?','Sí. Defines el precio de cada pieza en dólares y el sistema calcula el equivalente en bolívares automáticamente con la tasa BCV en cada cobro.',1),
('vps_joy_02','cmr9zg7at000z8ckxyevlltg5','¿Puedo llevar control de inventario de joyas por referencia?','Sí. Cada joya tiene su referencia en el sistema. El inventario descuenta automáticamente con cada venta y puedes ver qué piezas te quedan.',2),
('vps_joy_03','cmr9zg7at000z8ckxyevlltg5','¿ActivoPOS reemplaza mi facturación del SENIAT?','No. ActivoPOS es tu sistema de control de ventas e inventario — no reemplaza tu facturación SENIAT, la complementa.',3),

-- ============================================================
-- CLÍNICAS (inactivo - 3 FAQs básicas)
-- ============================================================
('vps_cli_01','cmr9zg7by00178ckx9pdf6vxu','¿ActivoPOS maneja cobros de consultas y servicios médicos?','Sí. Registras cada consulta o procedimiento como un servicio y el sistema lleva el control de cobros, métodos de pago y saldo pendiente por paciente.',1),
('vps_cli_02','cmr9zg7by00178ckx9pdf6vxu','¿Puedo manejar precios en dólares y bolívares para consultas?','Sí. Defines el precio en dólares y ActivoPOS convierte a bolívares automáticamente con la tasa BCV en cada cobro.',2),
('vps_cli_03','cmr9zg7by00178ckx9pdf6vxu','¿ActivoPOS reemplaza mi facturación del SENIAT?','No. ActivoPOS es tu sistema de control de cobros — no reemplaza tu facturación SENIAT, la complementa.',3),

-- ============================================================
-- GESTORÍA (inactivo - 3 FAQs básicas)
-- ============================================================
('vps_ges_01','cmr9zg7ck001b8ckx7wry4x6o','¿ActivoPOS maneja cobros por gestiones y trámites?','Sí. Registras cada gestión como un servicio, emites la cotización al cliente y llevas el control de pagos y saldo pendiente.',1),
('vps_ges_02','cmr9zg7ck001b8ckx7wry4x6o','¿Puedo llevar control de clientes que me deben?','Sí. El módulo de cuentas por cobrar registra cada servicio prestado con el cliente asignado y el saldo pendiente. Sabes quién te debe cuánto y desde cuándo.',2),
('vps_ges_03','cmr9zg7ck001b8ckx7wry4x6o','¿ActivoPOS reemplaza mi facturación del SENIAT?','No. ActivoPOS es tu sistema de control de cobros — no reemplaza tu facturación SENIAT, la complementa.',3);
