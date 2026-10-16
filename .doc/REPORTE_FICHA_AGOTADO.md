REPORTE - FICHA DE PRODUCTO Y ESTADO AGOTADO (catalogo clasico y premium)
Fecha: 2026-10-16 | Sin cambio de esquema, sin deploy
(Cubre tambien el addendum "Parte A: existencias ocultas y agotado con consulta por WhatsApp"; es el mismo alcance.)

PASO 0 - LECTURA
a) Numeros de existencias visibles al publico hoy (solo en modo "exact"):
   - Tarjeta del grid: "Ultimas N" / "N uds." (CatalogoGrid.tsx clasico ~526, premium ~751).
   - Modal del grid: "N disponibles" cuando quedan 10 o menos (clasico ~1376, premium ~1810).
   - La ficha (ProductoDetalle) NO muestra numeros; los usa solo como tope de cantidad.
   - Selector de variantes: solo marca "Agotado" (usaba stock <= 0). Carrito: no maneja stock.
b) settings.catalog_stock_display: 'exact' (default, muestra cantidad) | 'status' (el servidor no envia la cantidad).
   Negocio 87: sin valor (= exact). Se cambia en Configuracion > Tema visual (TabTema.tsx, interruptor guardado via /api/config/catalog).
   Reutiliza computeAvailability / isOutOfStock / effectiveStock de lib/catalog.ts; no se duplico logica.
c) Los numeros viajan en props y en el payload RSC solo en modo exact. Se usan para: mostrar, tope de cantidad y marcar variante agotada. No hay validacion en cliente: la API de pedido
   (api/catalog/[slug]/order, ~l.253) SI valida existencias (409 STOCK_INSUFICIENTE), por eso quitar el numero del navegador es seguro.
d) Paginas dinamicas (ƒ en el build, sin revalidate/unstable_cache): las existencias se recalculan en cada carga; un cambio se ve en la siguiente visita. Barra fija de compra en movil: no existe.
   Campos de configuracion con texto de envio/retiro: no existen (solo la eleccion en el checkout).
e) Subcategoria en la ficha: ya aplicada (aa83370, 1a34d01, 32de567/243f860, 23925a6).

COMMITS
Punto 1  2f3437e  Modo status: la variante lleva soldOut (booleano) y stock solo en exact (null en status; antes mandaba un 10 fijo). Se quita maskVariantStock (sin usos).
Punto 2  a6dbf4c  Agotado (producto o variante elegida): sin cantidad ni compra; boton "Consultar disponibilidad por WhatsApp" a todo el ancho (wa.me, mensaje con producto, variante y URL, encodeURIComponent). Sin telefono: solo "Agotado". Variantes agotadas seleccionables. Nuevo src/lib/availability-message.ts.
Punto 3  4df9af5  Columna derecha: etiqueta (subcategoria con enlace; si no, categoria) > titulo > precio > linea compacta BCV + sello Cashea (cada uno solo si esta activo) > variantes > Disponible/Agotado > cantidad + Agregar > Comprar ahora (ancho completo) > "Dudas? Escribenos por WhatsApp" > descripcion. Sin boton compartir en la fila, sin emoji, sin recuadro verde. Botones de cantidad de 44px.
Punto 4  b8a19ad  Relacionados: misma subcategoria (clave normalizada) primero, luego la categoria; maximo 4.
Extra    (commit del reporte)  Etiqueta enlazada con area tactil de 44px (::after, sin cambiar el espaciado).

DECISIONES / LO QUE NO SE CAMBIO
- "Nunca numeros": se uso el modo existente 'status'. El default del sistema sigue siendo 'exact', asi que el negocio 87 y cualquiera sin configurar siguen viendo numeros hasta que se active "ocultar existencias" en Configuracion > Tema visual. Hacer 'status' el default seria un cambio de comportamiento para todos los negocios: decision tuya.
- La tarjeta agotada ya era clicable hacia la ficha (no hubo que cambiarla).
- Excluido sale_mode='service': nunca se marca agotado (isOutOfStock ya lo garantizaba).
- Textos fijos pedidos en el prompt ("Recibimos bolivares a tasa BCV", "Disponible", "Agotado", boton de consulta, "Dudas?"): se escribieron tal cual. La visibilidad si sale de la configuracion (moneda del catalogo, sello Cashea, telefono).

VERIFICACION LOCAL (negocio 87, app :3019, navegador Playwright)
Datos temporales: telefono del 87 = +58 414-555-1234 (original NULL), subcategoria SRAM en 925/935/936 (original NULL), catalog_stock_display=status un momento. Todo restaurado y confirmado con SELECT (telefono NULL, 0 subcategorias, sin catalog_stock_display).
- Producto agotado existente: id 906 (Kask Protone Icon, sin movimientos de inventario creados por mi). No hay variantes agotadas en productos visibles del 87.
- Clasico y premium, ficha 906: columna = etiqueta, titulo, precio, linea BCV, "Agotado", boton de consulta; no aparece Agregar/Comprar. URL generada (decodificada):
  https://wa.me/584145551234?text=Hola, quiero saber cuando vuelve a estar disponible: Kask Protone Icon. http://localhost:3019/catalogo[-premium]/onbike/p/906
  El href va con encodeURIComponent. Boton 48px de alto, 337px de ancho a 375.
- Ficha con existencias, clasico 884 (375px): orden = CALZADO, titulo, precio, linea BCV, Disponible, [cantidad | Agregar], Comprar ahora, enlace Dudas. Botones: cantidad 44x44, Agregar 175x52, Comprar 337x52, Dudas 44 de alto; sin desborde horizontal; sin boton compartir ni emoji.
- Premium 903 (con tallas), 375px: captura revisada, mismo orden y sin desborde.
- Relacionados de 925 (sub SRAM): 935 y 936 (SRAM) primero, luego el resto de la categoria.
- Payload (curl): modo status -> ninguna existencia numerica en HTML/RSC (stock y stockQty en null) en /p/903 de ambos catalogos y en /productos. Modo exact -> numeros presentes (por configuracion).

GATE
npx tsc --noEmit 0 | npm run test:consistency 78/78 OK | npm run build EXIT=0, Compiled successfully (avisos de /api/reservas por cookies son previos)

NO PROBADO EN NAVEGADOR
- Variante agotada seleccionada y mensaje con variante ("- S-Azul"): no hay variantes agotadas en 87; cubierto solo por tsc y lectura del codigo.
- Producto sin telefono (solo "Agotado", sin boton): no abierto en navegador tras restaurar; la rama es un `&&` sobre la URL vacia.
- Sello Cashea junto a la linea BCV: no hay producto con Cashea activo en 87.
- Ficha premium agotada a 375px y desktop 1280px: no revisados visualmente; falta tu aprobacion visual.
- Boton "Consultar" y enlace "Dudas?" no se abrieron en WhatsApp real (solo se leyo la URL).
