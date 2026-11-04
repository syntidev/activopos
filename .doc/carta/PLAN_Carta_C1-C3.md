# PLAN Carta C1–C3

Cada fase = rama propia desde `origin/main`, un commit por entregable. Gates de toda fase: `tsc` 0 · `build` EXIT_REAL 0 · E2E de la fase · regresión `catalogo-precio-unico`, `catalogo-card-carrito` y `precio-divisa-*` · datos ZZ con limpieza · sin deploy sin Carlos. CLI-B no toca APIs ni Prisma (CLAUDE.md): lo de backend va marcado CLI-A.

## C1 — Carta navegable (lectura + pedido por WhatsApp) · CLI-B, con un mínimo de CLI-A
Objetivo: un negocio con `catalog_template='carta'` muestra la Carta y el pedido sale por WhatsApp registrado como `catalog`.

**Crear (CLI-B)**
- `src/app/catalogo-carta/[slug]/layout.tsx`: `CartProvider` y fuentes Instrument Sans + IBM Plex Mono con `next/font`.
- `.../page.tsx` (servidor: negocio, categorías, platos, tasa, estado abierto/cerrado), `CartaPortada.tsx`, `CartaCategorias.tsx` (barra pegajosa), `CartaBuscador.tsx`, `PlatoCard.tsx`, `CartaGrid.tsx`, `carta.module.css`.
- `.../p/[id]/page.tsx` y `PlatoFicha.tsx` (ficha sin modificadores todavía).
- `src/lib/carta-hours.ts`: abierto/cerrado desde `settings.carta_hours`, zona `America/Caracas`, con "pausar pedidos".
- Tokens `--carta-*` en `src/styles/tokens.css` antes de usarlos (regla de tokens).

**Reutilizar, no copiar:** `PrecioDual`, `CartContext`, `CartDrawer`, `ImgWithFallback`, `AdaptiveGrid`, `catalogUtils`, `divisaPriceOf`, `ProductCard` (la tarjeta de plato extiende su patrón).

**Tocar (CLI-B):** `TabEmpresa.tsx` (opción `carta` y horario estructurado), `src/app/api/catalogo/metrics/route.ts:70` (la URL pública hoy solo distingue `premium`).

**Pedir a CLI-A (sin migración):** aceptar `carta` como valor de `catalog_template` (columna `VarChar(20)`) y guardar `settings.carta_hours` y `settings.carta_paused` (JSON dentro de `settings`).

**E2E `tests/carta-c1.spec.ts`:** portada Abierto/Cerrado según horario; tab de categoría hace scroll y queda activa; buscador por nombre, ingrediente y etiqueta; PrecioDual con y sin Divisa (`0 < divisa < full`); "+" agrega al carrito y sube el contador; mensaje de WhatsApp con total USD y Bs; 375 y 1280 sin scroll horizontal; ninguna página contiene "Full".

**DoD:** criterios A1–A9 del SPEC §10 en verde, capturas 375/1280, cero cambios de esquema.

## C2 — Platos completos: etiquetas, alérgenos, modificadores, combos, agotado · CLI-A + CLI-B
Requiere migración: se aprueba con Carlos antes (SPEC §6).

**CLI-A:** migración versionada con etiquetas y alérgenos en `Product`, `modifier_groups`, `modifier_options`, `product_modifier_groups`, `products.sold_out_date` y `order_items.modifiers` (snapshot). Endpoints admin para grupos. `POST /api/catalog/[slug]/order` pasa a aceptar `modifiers[]` por línea, **recalcula el precio en el servidor** (nunca del cliente), valida obligatorios y mín/máx, y rechaza platos agotados con 409. Si toca totales: `npm run test:consistency`.

**CLI-B:** editor de platos en `productos/` (etiquetas, alérgenos, grupos, agotado hoy); `PlatoFicha` con grupos (radio o casillas, obligatorios, precio extra); líneas del carrito con modificadores. Referencia visual: mockups (b) y (c).

**E2E `carta-c2.spec.ts`:** un grupo obligatorio sin elegir bloquea "Agregar"; los extras suman al precio y al Bs; un combo es un plato con grupos obligatorios; el agotado se ve atenuado y no se agrega; el servidor rechaza un modificador inválido y un precio manipulado; el mensaje de WhatsApp lista los modificadores.

**DoD:** `test:consistency` en verde, `tsc` 0, `build` 0, migración probada en la BD de pruebas, ningún precio viene del cliente.

## C3 — Pedido directo a cocina y pedir desde la mesa (QR) · depende del módulo Restaurante
Condición de entrada: existe el módulo Restaurante (mesas y KDS). Si no existe, C3 se pospone; C1 y C2 no dependen de él.

**CLI-A:** validar el token firmado de mesa (`mesa` + HMAC, sin datos personales); `POST /api/catalog/[slug]/order` con `origin:'catalog'`, `send_to_kds:true` y la mesa (hoy el endpoint ya fija `origin:'catalog'` y calcula `send_to_kds` en `needsKds`, línea ~482: se revisa su regla); estado del pedido para el seguimiento (Recibido / En cocina / Listo) y acumulado de la cuenta de la mesa; "llamar al mesonero" crea una alerta; rate limiting por IP y mesa.

**CLI-B:** `?mesa=7&t=…` activa el modo mesa (cabecera Mesa, banner, "Enviar a cocina", seguimiento, cuenta); sin pago ni datos del cliente obligatorios; generador e imprimible de QR por mesa en Configuración.

**E2E `carta-c3.spec.ts`:** URL sin firma o con mesa inexistente cae a la carta normal; un pedido de mesa crea Order `catalog` con `send_to_kds` y aparece en la cola de cocina; un segundo envío suma a la cuenta; mesa de otro negocio rechazada; 375 y 1280.

**DoD:** criterios D1–D5 del SPEC §10, prueba manual de Carlos con un QR real, sin deploy automático.
