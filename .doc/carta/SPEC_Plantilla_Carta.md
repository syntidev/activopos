# SPEC — Plantilla "Carta" (tercera plantilla del catálogo)

Fase C0 · solo diseño · 2026-11-04 · CLI-B. Mockups en `.doc/carta/mockups/` (**a1 casual/parrilla** y **a2 fine dining** para elegir; b ficha de plato, c carrito y confirmación, d QR de mesa, en la dirección por defecto = casual; capturas 375 y 1280 en `mockups/capturas/`). Las fotos de los mockups son escenas SVG de marcador: el producto usa fotos reales. **El §12 (addendum) prevalece sobre §3 y §4 donde difieran.**

## 1. Qué es y cuándo se usa
`catalog_template` pasa de `'generic' | 'premium'` a `'generic' | 'premium' | 'carta'` (columna `VarChar(20)`, sin migración). La Carta es la cara pública de un restaurante, panadería o cafetería: platos, no inventario de tallas. Ruta propia, como el premium: `/catalogo-carta/[slug]`, con `notFound()` si el negocio no es `carta`.

## 2. Qué reutiliza del premium y qué es nuevo
| Reutiliza (sin copiar) | Nuevo |
|---|---|
| `PrecioDual` (regla única Divisa/Cashea) | Portada con estado Abierto/Cerrado y horario |
| `CartContext` + `CartDrawer` (carrito persistente) | Barra pegajosa de categorías + buscador ampliado |
| `ImgWithFallback`, `AdaptiveGrid`, `catalogUtils` | `PlatoCard` (extiende el patrón de `ProductCard`) |
| `divisaPriceOf` | Etiquetas y alérgenos |
| Endpoint `POST /api/catalog/[slug]/order` (origin `catalog`) | Modificadores, combos, agotado del día |
| Tokens y fuentes del sistema | Modo mesa por QR |

No se reutiliza: `ProductoDetalle` (pensado para tallas y selector de pago), filtros de marca/deporte, `LandingSections`.

## 3. Dirección visual
Cálida y apetitosa, no genérica. Tipografía de la dirección del restaurante: **Instrument Sans** (UI y títulos) + **IBM Plex Mono** (precios, cantidades, Bs). "El color es atención": el fondo es crema; el color intenso solo marca lo que pide acción.
- Fondo `crema #FBF5EC`, tarjetas blancas con sombra (sin borde), tinta cálida `#2A1D14`.
- **Brasa `#B8381A`**: botón "+", barra del carrito, selección. Verde solo para Abierto, Vegetariano y listo; ají rojo solo para Picante; oro para Nuevo.
- Portada: degradado brasa a carbón con el nombre grande, no una foto pesada. Foto del plato cuadrada con inset, "+" circular de 44 px sobre la foto.
- Botón principal de 52 px de alto, objetivos táctiles ≥ 44 px, texto ≥ 13 px.
- Los hex de los mockups pasan a `tokens.css` como `--carta-*` antes de consumirse (regla de tokens). Sin emojis, íconos Lucide.

## 4. Secciones (en orden de pantalla)
1. **Portada.** Logo, nombre, tipo de cocina y zona; píldora **Abierto · cierra a las 10:00 pm** o **Cerrado · abre mañana 11:00 am**; horario; chips Para llevar / Delivery / Comer aquí según configuración. Cerrado: la carta se ve y el carrito deja armar el pedido, pero el envío se bloquea con un aviso claro y un botón "Avísame por WhatsApp".
2. **Categorías fijas.** Barra pegajosa bajo la portada: chips con conteo; al tocar hace scroll a la sección y el chip activo sigue el scroll (IntersectionObserver). Carril con scroll horizontal interno, sin scroll de página.
3. **Buscador.** Un solo input (convención de búsqueda híbrida del proyecto): AND entre palabras, OR entre campos, sin acentos ni mayúsculas; busca nombre, descripción, ingredientes, etiquetas y alérgenos. Filtro instantáneo en cliente.
4. **Platos.** Tarjeta: nombre, descripción (2 líneas), etiquetas, `PrecioDual`, foto, "+". Móvil 1 columna; ≥1024 px 2 columnas.
5. **Etiquetas** (cada una con texto, no solo color): Picante, Vegetariano, Vegano, Sin gluten, Nuevo, Popular. Nuevo y Popular reutilizan `badge`.
6. **Ficha de plato** (`/p/[id]`): foto grande, etiquetas, `PrecioDual`, descripción, **alérgenos** en un bloque propio con aviso, grupos de modificadores, combo, nota para la cocina, cantidad y botón "Agregar · $total".
7. **Carrito** (CartDrawer): líneas con modificadores en texto, cantidad editable, total USD y Bs, modalidad (Comer aquí / Para llevar / Delivery), nombre, teléfono, forma de pago ($ Divisa o Bs/Cashea) y "Enviar pedido por WhatsApp".
8. **Confirmación:** número de pedido (`CT-0142`), resumen y vista del mensaje enviado.
9. **Agotado del día:** el plato sigue visible, atenuado, con "Agotado hoy" y sin "+"; se reabre solo al día siguiente.

## 5. Precio
`PrecioDual` sin cambios: línea 1 Divisa en $ (si `0 < divisa < precio`), línea 2 chip [Bs] + Cashea + monto. Sin Divisa válida: `$precio` y debajo [Bs] + Cashea + monto en Bs. Con modificadores el total de la línea suma los extras y se muestra igual. Los precios los calcula el servidor; el cliente nunca manda un precio. Tasa BCV dinámica; sin tasa no se bloquea el pedido (regla sellada).

## 6. Datos nuevos (requieren migración: CLI-A y aprobación de Carlos; no se hace en C0)
- **Etiquetas y alérgenos:** JSON en `Product` (`carta_tags`, `allergens`). Vocabulario cerrado en `src/lib/carta-tags.ts`.
- **Modificadores:** `modifier_groups` (negocio, nombre, tipo `single|multi`, obligatorio, mín, máx), `modifier_options` (grupo, nombre, extra en USD, disponible), `product_modifier_groups` (producto, grupo, orden). La línea del pedido guarda un **snapshot** (`order_items.modifiers`: nombre y extra) para que editar el menú no altere pedidos viejos.
- **Combos:** un plato normal con grupos obligatorios ("Elige tu bebida", "Elige tu acompañante"); sin tabla aparte.
- **Agotado del día:** `products.sold_out_date` (fecha); está agotado si es hoy en `America/Caracas`.
- **Horario:** `settings.carta_hours` (JSON por día con tramos `["11:00","22:00"]`) y `settings.carta_paused`. `catalog_hours` (texto libre) se mantiene como respaldo de lectura. Sin migración: es JSON en `settings`.

## 7. Pedido por WhatsApp (C1)
Carrito → "Enviar" → `POST /api/catalog/[slug]/order` (registra el Order con `origin:'catalog'`; hoy no acepta modificadores: eso es C2) → se abre `wa.me` con el mensaje armado: líneas con modificadores, total USD y Bs, modalidad, forma de pago, nombre y teléfono, código `CT-xxxx`. Si el registro falla, se envía igual el mensaje (respaldo, como ordena.menu) y se avisa. Campos que el endpoint exige hoy: `customer_name`, `customer_phone`, `customer_reference`, `payment_method`; en la Carta `customer_reference` se completa con la modalidad.

## 8. Pedido directo a cocina (C3, cuando exista el módulo Restaurante)
Mismo endpoint, `origin:'catalog'` y `send_to_kds:true` cuando el negocio tiene KDS (el endpoint ya calcula `needsKds`). El pedido aparece en la cola de la cocina sin pasar por WhatsApp.

## 9. Pedir desde la mesa por QR (C3)
URL `/catalogo-carta/[slug]?mesa=7&t=<firma>`. La firma (HMAC con el secreto del servidor) impide inventar mesas; sin firma válida se muestra la carta normal. En modo mesa: cabecera fija "Mesa 7 · Terraza" con "Llamar al mesonero"; banner "Pides desde tu mesa…"; el botón dice **Enviar a cocina** (sin pago y sin teléfono obligatorio); seguimiento Recibido → En cocina → Listo; **cuenta de la mesa** acumulada (varios envíos) con USD y Bs; el pago se hace al final con el mesonero. Rate limiting por IP y mesa. Cada mesa tiene su QR imprimible desde Configuración.

## 10. Criterios de aceptación (verificables)
**Carta general (C1)**
- A1. Un negocio con `catalog_template='carta'` abre `/catalogo-carta/[slug]`; con otra plantilla responde 404.
- A2. La portada muestra Abierto/Cerrado correcto para un horario dado (probado con hora simulada) y el horario completo.
- A3. Tocar un chip de categoría lleva a su sección y lo deja activo; el chip activo cambia al hacer scroll.
- A4. Buscar "pollo", "aguacate" y "picante" devuelve los platos correctos; sin acentos ni mayúsculas.
- A5. Cada plato muestra `PrecioDual`: con Divisa válida muestra Divisa y debajo `[Bs][Cashea] $precio`; con Divisa ≥ precio muestra un solo precio y debajo el monto en Bs.
- A6. "+" en un plato sin modificadores obligatorios agrega al carrito y sube el contador; con modificadores obligatorios abre la ficha.
- A7. Ninguna página de la Carta contiene el texto "Full".
- A8. 375 px y 1280 px sin scroll horizontal ni texto cortado en portada, lista, ficha y carrito.
- A9. El mensaje de WhatsApp lista cada línea con sus modificadores y el total en USD y Bs; el Order queda con `origin='catalog'`.

**Platos completos (C2)**
- B1. Un grupo obligatorio sin elegir deshabilita "Agregar"; se respetan mín y máx.
- B2. Los extras suman al total mostrado y al del servidor; un precio manipulado desde el cliente se ignora.
- B3. Un plato agotado hoy no se puede agregar (UI, y el servidor responde 409) y se reabre al día siguiente.
- B4. Los alérgenos del plato aparecen en la ficha y se encuentran con el buscador.

**Mesa por QR (C3)**
- D1. Una URL con firma inválida o mesa inexistente muestra la carta normal.
- D2. Un pedido de mesa crea un Order `catalog` con `send_to_kds` y mesa, visible en cocina.
- D3. Un segundo envío de la misma mesa suma a la cuenta; el total muestra USD y Bs.
- D4. Una mesa de otro negocio se rechaza.
- D5. El seguimiento pasa de Recibido a En cocina y a Listo al avanzar la cocina.

## 11. Fuera de alcance de C0
Sin código de producto, sin migraciones, sin tocar `synticorex`. Los mockups son HTML estático de referencia.

## 12. ADENDUM — la Carta es comida, no un catálogo (nivel carta de autor / app de delivery top)

### 12.1 Hero: "Los favoritos de la casa"
- Slider a sangre completa. Contenido: top platos por **ventas reales** del negocio (`sale_items` de ventas pagadas, últimos 30 días, agrupado por producto, máx. 6, solo platos visibles y no agotados). Si no hay ventas suficientes, usa los marcados como destacados y el rótulo pasa a **"Recomendados"**. La consulta vive en el servidor (CLI-A), nunca se calcula en el cliente.
- Cada slide: foto 16:9 con degradado para leer, "N.º 1 de la casa", nombre grande en serif, descripción (desde 1024 px), `PrecioDual` y botón **Agregar** (mismo handler del "+": con modificadores obligatorios abre la ficha).
- Autoplay suave (5 s), **pausa al tocar, pasar el mouse o enfocar**, y se reanuda tras 6 s; swipe nativo en móvil (scroll-snap); puntos de posición. **`prefers-reduced-motion`: sin autoplay y sin animación de desplazamiento.** Accesible: `aria-roledescription="carrusel"`.
- Decisión de proporción: 16:9 en todos los anchos (a 375 px son ~211 px de alto, con título, precio y botón superpuestos sobre el degradado); en escritorio se limita a 540 px de alto y la foto se recorta centrada.

### 12.2 Fotografía primero
- La foto es el producto. Proporciones fijas: **4:5 en la lista**, **16:9 en el hero y en los combos**, 4:5 en la ficha (móvil).
- Recorte que centra el plato (`object-fit: cover` con foco centrado; si el plato queda descentrado, un foco `x,y` opcional por producto, dato opcional en §12.6). Degradado sutil donde hay texto encima. Mientras carga: color cálido de marcador (nunca blanco de catálogo). Sin fondos blancos.
- **Plato sin foto = tarjeta tipográfica**: fondo cálido, nombre en serif grande, inicial como marca de agua; no un ícono genérico (ver "Cachapa con queso" en a1 y a2).

### 12.3 Paleta y tipografía
- Fondo crema/papel; acento **configurable por negocio** (`--acento`; por defecto brasa `#B8381A` en casual, oro viejo `#8A6A2F` en fine dining). Prohibido lavanda y azul de panel: el chip [Bs] pasa a marrón oscuro (`--bsc`); Cashea conserva su amarillo de marca.
- Nombres de platos en **serif de display cargada con `next/font`**: casual = **Fraunces** (la display del proyecto); fine dining = **Cormorant Garamond** (cursiva en títulos). Descripciones y UI en **Instrument Sans**. Precios en sans con cifras tabulares (en fine dining, en serif).
- Dos direcciones, a elección de Carlos (se guarda como `settings.carta_style: 'casual' | 'fine'`):
  - **A1 casual/parrilla**: tarjetas elevadas, foto 4:5 a la izquierda, píldoras redondeadas, botón "+" circular.
  - **A2 fine dining**: sin tarjetas, filas con filete, foto 4:5 pequeña a la derecha, categorías centradas en cursiva con filete dorado, tabs en versalitas con subrayado, botón cuadrado de contorno, formas rectas.
- Los hex de los mockups pasan a `tokens.css` (`--carta-*`) antes de consumirse.

### 12.4 Apetito en el texto
- Descripción corta que antoja: ingredientes clave, máx. 2 líneas en lista, completa en la ficha.
- Etiquetas visuales con texto: Picante, Vegetariano, Vegano, Sin gluten, Nuevo, **De la casa**.
- **Alérgenos discretos pero claros**: línea "Contiene huevo, lácteos" con ícono de información (≥ 12 px, contraste AA) en la lista; bloque propio con aviso en la ficha.
- **Tiempo de preparación** ("12 min") cuando el plato lo tiene; si no, no se muestra.

### 12.5 Navegación de restaurante
- Tabs fijas con **scroll-spy** (IntersectionObserver): la pestaña activa sigue la sección visible.
- **Combos** y **Para compartir** son secciones propias, arriba de las categorías normales. Un combo es una tarjeta ancha 16:9 con sello "Ahorras $X.XX".
- Búsqueda por plato **o ingrediente** (un solo input, convención híbrida del proyecto); sobre 1024 px el placeholder da ejemplos.
- **Botón flotante del pedido** siempre visible (móvil y escritorio): cantidad, "Ver mi pedido" y total **USD + Bs**. En modo mesa dice "Enviar a cocina".

### 12.6 Datos adicionales (se suman a §6; misma migración de C2, aprobación de Carlos)
- `products.prep_minutes` (int, opcional) · `products.carta_section` (`'combo' | 'compartir' | null`) · foco de recorte opcional por imagen · `settings.carta_style` y `settings.carta_accent` (JSON en `settings`, sin migración).
- Favoritos: sin tabla nueva; consulta agregada sobre `sale_items` filtrada por `business_id`, cacheada (p. ej. 10 min).

### 12.7 Microinteracciones (con gusto, sin exceso)
- Agregar: el botón pasa a verde con ✓ ~1 s ("Agregado" en el hero) y el contador del botón flotante hace un rebote corto; los totales se actualizan al instante.
- Pulsar: escala 0,9–0,96. Hero: desplazamiento suave. Todo se desactiva con `prefers-reduced-motion` (queda solo el cambio de color/estado).

### 12.8 Criterios de aceptación adicionales
- E1. El hero muestra los platos con más unidades vendidas en 30 días (probado con ventas ZZ); sin ventas muestra "Recomendados" con los destacados.
- E2. El hero avanza solo cada 5 s, se detiene al tocar o pasar el mouse, y **no avanza** con `prefers-reduced-motion`; el swipe cambia de slide.
- E3. La foto de lista es 4:5 y la del hero y del combo 16:9 (medido con `boundingBox`); un plato sin foto muestra la tarjeta tipográfica, sin ícono genérico.
- E4. Los nombres de platos usan la serif cargada (`document.fonts` lo confirma) y no hay fondo blanco de catálogo detrás de las fotos.
- E5. "Combos" y "Para compartir" aparecen como secciones y como tabs, antes de las demás; el scroll-spy cambia la pestaña activa al desplazarse.
- E6. Buscar un ingrediente ("aguacate") encuentra el plato aunque no esté en el nombre.
- E7. El botón flotante muestra cantidad y total en USD y Bs, y sube al agregar desde el hero, la lista y un combo.
- E8. Se ve el tiempo de preparación y la línea de alérgenos cuando existen.
- E9. Las dos direcciones (`carta_style`) renderizan sin overflow a 375 y 1280.

### 12.9 Decisiones de Carlos (2026-11-04)
- **Dirección visual:** A1 casual/parrilla es la dirección por defecto; A2 fine dining es opción por negocio (`settings.carta_style`). **Decidido.**
- **Acento:** paleta acotada (`settings.carta_accent`), no color libre. Cada color de la paleta se valida con contraste AA sobre crema y sobre blanco (texto del botón y chips). La lista cerrada de acentos la define C1 y se muestra como selector de muestras en Configuración. **Decidido.**
- **Migración de C2:** se decide junto con el plan de C2 (no se aprueba ahora). Hasta entonces C1 no depende de ella.
