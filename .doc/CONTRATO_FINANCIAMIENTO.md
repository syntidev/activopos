# Contrato backend para CLI-B — financiamiento, borrado de productos y búsqueda por código

Fecha: 2026-10-20 · Autor: CLI-A · Estado: backend listo y probado en el negocio 87 local (sin push, sin deploy).
Tests: `tests/financiamiento.spec.ts` (7), `tests/producto-borrado.spec.ts` (6), `tests/busqueda-codigos.spec.ts` (14 + 1 skip), `tests/catalogo-precios.spec.ts` (4).

---

## 1. Financiamiento

### 1.1 Regla de elegibilidad
`elegible = settings.financing.enabled  Y  NOT product.financing_excluded`
- Por defecto TODOS los productos entran (`products.financing_excluded BOOLEAN NOT NULL DEFAULT false`).
- `product.financing_eligible` (columna vieja, default false) ya NO decide nada; queda sin uso hasta limpiarla.
- Fuente única en servidor: `src/lib/financing.ts` (`isFinancingEffective`, `readFinancingConfig`, `buildFinancingConfig`, `toPublicFinancing`).

### 1.2 Configuración por negocio (`business.settings.financing`)
```json
{ "enabled": true, "mode": "cashea|other|own", "provider_name": "Krece", "phrase": "Paga en cuotas con Krece", "logo_url": "/storage/tenants/87/financing/<uuid>.webp" }
```
| modo | nombre | frase | logo |
|---|---|---|---|
| `cashea` (preset) | forzado "Cashea" | editable (default "Paga en cuotas con Cashea") | forzado `/brand/cashea.png` |
| `other` | OBLIGATORIO si `enabled` | editable (default "Paga en cuotas con {nombre}") | opcional, solo subido por este negocio |
| `own` | no aplica (`null`) | OBLIGATORIA si `enabled` | nunca (`null`) |

Con `enabled:false` no se exige ningún campo. Cashea no está cableado en ningún sitio: es solo el preset.

### 1.3 Endpoints
- `GET /api/config/catalog` → `{ ok, catalog: { catalog_plan, catalog_slug, catalog_financing_badge, financing: FinancingConfig, catalog_stock_display } }`
- `PATCH /api/config/catalog` body `{ financing: { enabled, mode, provider_name?, phrase?, logo_url? } }` (zod strict) → 200 `{ ok, financing }`.
  - 422 `{ error: "<texto en español>", field: "provider_name" | "phrase" | "logo_url" }` — mostrar `error` tal cual junto al campo `field`.
  - `logo_url` solo se acepta si es `/brand/cashea.png` o `/storage/tenants/<businessId>/financing/<uuid>.webp` (ruta de ESTE negocio); URL externa o de otro tenant → 422 `logo_url`.
  - Compatibilidad: el interruptor viejo `{ catalog_financing_badge: 'cashea' | null }` sigue funcionando (equivale a Cashea activado/desactivado) mientras la pantalla de Tema no migre.
- Subir logo: `POST /api/upload/image` multipart `type=financing` + `file` → 201 `{ ok, url, thumb, ... }`; guardar `url` en `logo_url`.
- Público: `GET /api/catalog/[slug]` → `business.financing = { mode, name, phrase, logo_url } | null` y por producto `financing_available: boolean`.
- Producto: `POST /api/products` y `PATCH /api/products/[id]` aceptan `financing_excluded: boolean`.

### 1.4 Qué debe cablear CLI-B (archivo:línea)
- `TabTema.tsx:22,57-59,116-128,278-289`: reemplazar el interruptor Cashea por pantalla de modo (Cashea / Otra empresa / Propio), nombre, frase y logo; guardar con `PATCH /api/config/catalog {financing}`, logo con `type=financing`.
- Formulario de producto: `useProductForm.ts:150,293,589,616,653` y `ProductFormLayout.tsx:408-421` — casilla "Disponible con Cashea" (`financing_eligible`) pasa a "Excluir de financiamiento" (`financing_excluded`, default desmarcada). También `productos/nuevo/page.tsx:94`, `productos/[id]/editar/page.tsx:50,95,241`, `ProductModal.tsx:58,104`.
- Fichas públicas: `catalogo/[slug]/ProductoDetalle.tsx:245-254` y la premium — pintar `financing` público (logo si hay, `phrase`) en vez de `FINANCING_BADGES`. Hoy las páginas `p/[id]/page.tsx` siguen pasando `financingBadge` ('cashea' | null) vía `legacyBadgeKey`, así que solo el modo Cashea se ve hasta que se cablee esto.

### 1.5 Migración sin sorpresas (NO ejecutada en producción)
- Migración `20261020000003_add_product_financing_excluded` es aditiva (ALTER TABLE ... ADD COLUMN ... DEFAULT false). Todo producto queda elegible; nada se desactiva solo.
- Conteos (local): negocio 87 → 47 productos, `financing_eligible`=1: 0, =0: 47. Respaldo del 33 (sin Safetti) → 133 productos, =1: 54, =0: 79.
- Si un negocio ya curó su selección (mezcla de 1 y 0), ANTES de activar el financiamiento en su configuración, con dry-run y autorización de Carlos:
  `UPDATE products SET financing_excluded = 1 WHERE business_id = X AND financing_eligible = 0;`
- El negocio 33 hoy tiene `catalog_financing_badge='cashea'`: al leerlo, queda como Cashea activado (compatibilidad), con todos los productos elegibles hasta decidir el `UPDATE` anterior.

---

## 2. Borrar producto — `DELETE /api/products/[id]`
Siempre JSON; el modal debe mostrar `message` tal cual.
| caso | HTTP | cuerpo |
|---|---|---|
| sin historial | 200 | `{ ok:true, action:'deleted', code:'DELETED', message }` |
| con historial (ventas, pedidos, cotizaciones, devoluciones, compras, kits de reservas, componentes, movimientos que no son ajustes) | 200 | `{ ok:true, action:'deactivated', code:'HAS_HISTORY', message, history:[...] }` — NO se borra, se desactiva |
| no existe / otro negocio | 404 | `{ ok:false, code:'NOT_FOUND', error, message }` |
| cajero | 403 | `code:'FORBIDDEN'` |
| id inválido | 400 | `code:'INVALID_ID'` |
| referencia que no se previó (FK) | 409 | `code:'IN_USE'` |
| error interno | 500 | `code:'SERVER_ERROR'` (con JSON, nunca vacío) |

`?force=true` se ignora: nunca se borra físicamente un producto con historial.
UI actual `productos/page.tsx:364-421` solo maneja ok/409 y manda `force`; debe leer `action` (`deactivated` → "se desactivó") y mostrar `message` en los errores.
Causa raíz del bug original: `src/app/api/products/[id]/route.ts` (DELETE) no capturaba FKs RESTRICT (`inventory_entries`, `product_variants`, `product_collections`, `product_components`, `purchase_items`, `reservas.kit_id`) → 500 mudo, y la UI ignoraba el 500.

---

## 3. Búsqueda por código — `src/lib/product-search.ts` (única lógica)
Campos: nombre, barcode y sku del producto, descripción ("Ref: X", la palabra suelta "Ref" se ignora), sku y barcode de variante. Barcode = coincidencia exacta; sku y texto = contiene; varias palabras = AND entre palabras, OR entre campos; q ≤ 60 caracteres y ≤ 5 palabras; espacios al pegar se toleran.

| buscador | endpoint | respuesta |
|---|---|---|
| Productos | `GET /api/products?search=` | cada producto con `matched_variant_id`, `matched_variant_value`, `matched_by` |
| POS | `GET /api/products/search?q=` | idem; el barcode exacto va primero. Enter toma el primero y, si trae `matched_variant_id` con stock, agrega esa talla (`usePOS.ts:157-171`) |
| Catálogo público (normal y premium) | `GET /api/catalog/[slug]/search?q=` (público, con rate limit) | `{ ok, q, results:[{ id, matched_variant_id, matched_variant_value, matched_by }] }`; solo productos visibles; no expone barcodes |
| Alta rápida | `GET /api/quick-add/lookup?code=` | barcode o SKU (acepta espacios); `existing` incluye `matched_variant_value` |

Pendiente CLI-B: la fila del ticket del POS no pinta la talla (`TicketPanel.tsx`, solo `ScannerModal.tsx:274` la muestra); `variant_label` ya viaja en el ítem.

---

## 4. Precios del catálogo público
El catálogo muestra SIEMPRE `price_per_unit_usd`, sin tachado. Causa raíz: `catalogo-premium/[slug]/page.tsx`, `productos/page.tsx` y `p/[id]/page.tsx` mapeaban `precio_divisa` a `priceDivisa` y el componente pintaba `priceDivisa ?? priceUsd` con el normal tachado. Ahora `priceDivisa` es `null` fijo en las tres páginas. Código muerto del tachado a limpiar por CLI-B: `catalogo-premium/[slug]/CatalogoGrid.tsx:549,809-818,897,1669,1850` y `ProductoDetalle.tsx:153-160,509`.
