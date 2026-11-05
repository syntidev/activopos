# Carta C1 — estado (2026-11-05)

## Qué entra en C1 (sin cambio de esquema)
- Ruta `/catalogo-carta/[slug]` con `catalog_template='carta'`; con otra plantilla responde 404 y el catálogo premium no sirve ese negocio.
- Reutilizado, sin duplicar: `CartContext` (ahora con nota por plato y `removeFromCart`, compatible con el premium), `PrecioDual` (variante `carta`: un precio grande en $ y el Bs pequeño debajo, sin chips), `POST /api/catalog/[slug]/order` y su mensaje de WhatsApp.
- Presets como tokens en `src/styles/tokens.css`: **Brasa** (casual, claro) y **Noche** (fine dining, oscuro), más una paleta cerrada de 5 acentos. `node scripts/check-carta-contrast.mjs` verifica AA (4.5:1) en cada preset y cada acento.
- Hero: el `event_slider` de `landing_sections` del negocio (2 a 8 slides). Sin configurar: "Los favoritos de la casa" (top 30 días por `sale_items` de ventas pagadas, solo lectura en `src/lib/carta/favoritos.ts`) y, sin ventas, los destacados rotulados "Recomendados". El plato del hero no se repite en "De la casa".
- Lista con pestañas fijas y scroll-spy, buscador por plato o ingrediente, tarjeta con foto 4:5 o tarjeta tipográfica, plato con tamaños = una tarjeta ("Desde $X · N tamaños"), "Cómo pagas" una sola vez según el panel de cobro.
- Ficha con tamaños como botones grandes, cantidad, nota para la cocina; carrito con editar, quitar con confirmación, tamaño y nota visibles; barra fija "Ver mi pedido" con total en $ y Bs.
- SEO: título, descripción y og:image (hero); fotos con `next/image`.
- Seed idempotente `scripts/seed-carta-demo.ts` con `scripts/data/cafeconbike.json` (38 platos, 14 tamaños, 10 categorías). Negocio demo: slug `cafeconbike-carta`.

## Cómo probar
1. `npx ts-node --project tests/tsconfig.json scripts/seed-carta-demo.ts`
2. `npm run dev` y abrir `/catalogo-carta/cafeconbike-carta`.
3. `E2E_BASE_URL=http://localhost:3000 npx playwright test tests/carta-c1.spec.ts` (restaura todo al terminar).

## Decisiones
- **Noche es oscuro** (fondo carbón, acento oro) aunque el mockup de fine dining era sobre papel claro: así el nombre del preset coincide con lo que se ve.
- Las notas por plato se concatenan en `notes` (máx. 500, con aviso al recortar) y el servidor las lista en el WhatsApp. La nota por línea real es de C2 (migración pendiente).
- Los tamaños se guardan como variantes con precio propio (`price_usd`), el mismo camino que ya usa el servidor.
- Stock simbólico de 999 en los platos del seed: el catálogo y el pedido validan stock y un plato de cocina no lleva inventario. El "agotado del día" real es de C2.

## Fuera de C1 (queda abierto)
- **Guardado de `settings.carta_*`** (preset, acento, estilo, horario, pausa): lo agrega el panel "Cobro y precios" de CLI-A; mientras tanto se leen con valores por defecto y el seed los escribe. No hay endpoints de escritura nuevos.
- **Rama `origin/test/carta-e2e` (CLI-D): no existe todavía.** La puerta de C1 es `tests/carta-c1.spec.ts`; la suite de CLI-D se integra con `git merge origin/test/carta-e2e` cuando exista y debe quedar en verde antes del merge a main.
- **Cédula obligatoria en `POST /order`**: el servidor la exige siempre (V/E/J/G). En un restaurante es fricción; pedir a CLI-A que sea opcional para platos.
- Presets Café, Mar y Verde (C2 si sobra tiempo). Combos, "Para compartir", agotado del día, etiquetas dietéticas, alérgenos y tiempo de preparación (C2, requieren migración que se decide con el plan de C2).
- Bandas de ambiente entre secciones del mockup: no hay una fuente de imágenes de ambiente en los datos.
- Pedido directo a cocina y modo mesa por QR (C3).
- Cashea en el carrito: se ofrece solo si el negocio tiene un método financiador activo y la elegibilidad la valida el servidor; no se probó con un negocio con financiamiento.
