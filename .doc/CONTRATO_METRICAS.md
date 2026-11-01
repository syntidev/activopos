# CONTRATO — Métricas (ventas por producto/grupo y metas mensuales)
Versión 1.1 · 2026-10-31 · CLI-A · rama `feat/metricas`

Módulo **global** (todos los negocios, sin feature flag): unidades y monto vendidos por producto, por categoría / subcategoría /
marca, comparativo contra el período anterior y **metas mensuales** con avance. Caso real: el café de OnBike cuenta hamburguesas
por mes y fija metas. Venta simple: sin impuestos, sin IGTF.

> CLI-B construye contra este archivo. Cualquier cambio posterior se anota como **v2** al final y se avisa.

> **v1.1 (2026-10-31, decisión de Carlos):** cambian SOLO las cifras (prorrateo del descuento/cargo global, §0.4, D1, D2). **La forma de todas las respuestas es idéntica a v1.**

## 0. Reglas de cálculo (no negociables)

1. **Qué ventas cuentan**: las mismas de los reportes — estándar contable `src/lib/sales-returns.ts` (`REALIZED_SALE_STATUSES` =
   `paid` + `partial_return`; `returned` excluido). **Netas = brutas − devoluciones aprobadas**, imputadas a la **fecha de la venta**
   (`sales.sold_at`), aunque la devolución se procese después. El cálculo vive en `sales-returns.ts` (`netProductLines`), junto a
   `netByProduct`: misma fuente, mismo filtro, mismo patrón de resta de devoluciones.
2. **Día/mes de negocio** (America/Caracas, UTC−4): `src/lib/business-day.ts` (`businessRange`, `businessMonthRange`, `businessDateKey`).
   `from`/`to` son claves `YYYY-MM-DD` **inclusivas**.
3. **Unidades** = Σ `sale_items.quantity` (Decimal; hay ventas por peso → pueden traer hasta 3 decimales) − Σ `return_items.qty`.
4. **Monto (v1.1, prorrateo global)**. El descuento por ítem ya viene dentro de `sale_items.subtotal_*`; el descuento y el cargo
   **globales** de la venta no (`sales.total_*` ≠ Σ ítems). Cada venta reparte su total entre sus líneas en proporción a
   `subtotal_usd` / `subtotal_bs`:
   `monto_línea_usd = subtotal_usd × (sales.total_usd / Σ subtotal_usd de la venta)` y lo mismo en Bs con `total_bs` y `subtotal_bs`
   (tasa histórica guardada en la venta, nunca la de hoy). Las **unidades NO se prorratean**.
   Devoluciones aprobadas: `returns.total_usd/bs` se reparte entre las líneas de la devolución en proporción a `return_items.total_usd`.
   **Monto neto = Σ prorrateado de ventas − Σ prorrateado de devoluciones.** Con esto la suma de `totals` de `/api/metrics/products`
   y `/groups` coincide al centavo con `total_usd`/`total_bs` de `/api/reports/range` (que usa `netSales`) para el mismo rango.
   Los montos por producto se calculan con 4 decimales y `totals` se suma **antes** de redondear (la suma de las filas ya redondeadas
   a 2 decimales puede diferir de `totals` por centavos de redondeo).
5. **Agrupar por `product_id`**: las variantes suman a su producto. Nombre = el actual del producto (fallback `sale_items.product_name`).
6. **Comparativo**: cada fila trae el período anterior de **igual duración** inmediatamente previo (`prev_qty`, `prev_usd`).
7. **Sin N+1**: una consulta agregada de ventas netas por producto (actual) + una del período anterior + una de metadatos de producto.
8. `business_id` **siempre de `getSession()`**, nunca del query/body.

## 1. Acceso

Mismo guard que `/api/reports`: **`ADMIN_ONLY`** en `src/middleware.ts` (`/api/metrics` se agrega a la lista) y verificación de rol en
cada handler (`admin` | `super_admin`). En la práctica el **middleware** corta antes, igual que en `/api/reports`: sin sesión → **307 a `/login`**, `cashier` → **307 a `/pos`**, `operador_reservas` → denegado por defecto. Si una petición llegara al handler: sin sesión → **401**, rol sin permiso → **403**.
La exportación (`/api/metrics/export`) además pasa el plan gate `access_export`, igual que `/api/reports/export-excel`.

## 2. Tipos (`src/types/metrics.ts`)

```ts
export interface MetricsRange { from: string; to: string; days: number }          // YYYY-MM-DD inclusivos

export interface MetricsTotals {
  qty: number; usd: number; bs: number; prev_qty: number; prev_usd: number
}

export interface ProductMetricRow {
  product_id: number
  name: string
  category: string | null        // null = sin categoría
  subcategory: string | null     // texto libre del producto; null = sin subcategoría
  brand: string | null           // null = sin marca
  qty: number; usd: number; bs: number
  prev_qty: number; prev_usd: number
}
export interface ProductsMetricsResponse {
  range: MetricsRange
  prev_range: MetricsRange
  rows: ProductMetricRow[]       // orden: usd desc, luego name asc
  totals: MetricsTotals          // suma de rows
}

export type MetricsGroupBy = 'category' | 'subcategory' | 'brand'
export interface GroupMetricRow {
  key_id: number | null          // category.id / brand.id; null en "Sin …" y SIEMPRE null en subcategory
  label: string                  // nombre; "Sin categoría" | "Sin subcategoría" | "Sin marca"
  qty: number; usd: number; bs: number
  prev_qty: number; prev_usd: number
  products_count: number         // productos distintos con actividad (período actual o anterior)
}
export interface GroupsMetricsResponse {
  by: MetricsGroupBy
  range: MetricsRange            // añadido a lo pedido: simetría con /products
  prev_range: MetricsRange
  rows: GroupMetricRow[]         // orden: usd desc, luego label asc
  totals: MetricsTotals
}

export interface MetricsCashier { id: number; name: string }

export type GoalScope = 'product' | 'category' | 'brand'
export type GoalMetric = 'units' | 'usd'
export interface SalesGoalItem {
  id: number
  scope: GoalScope
  ref_id: number
  label: string                  // nombre del producto/categoría/marca; `#<ref_id>` si ya no existe
  period: string                 // YYYY-MM
  metric: GoalMetric
  target: number
  actual: number                 // mismas reglas de ventas (netas), mes completo de negocio
  pct: number                    // actual/target×100, 1 decimal, puede pasar de 100
  remaining: number              // max(0, target − actual), 2 decimales
  days_left: number              // días de negocio que quedan en el mes (hora Caracas), incluye hoy
  per_day_needed: number | null  // remaining / days_left (2 dec); null si el período ya cerró
}
```

Una fila de `rows` aparece si tuvo actividad (`qty ≠ 0` o `usd ≠ 0`) en el período actual **o** en el anterior (así se ve lo que cayó a cero).

## 3. Endpoints

Todos `GET` salvo las metas de escritura. Respuestas JSON; errores: `{ "error": string, "details"?: ZodIssue[] }`.

### 3.1 `GET /api/metrics/products`
Query: `from`, `to` (`YYYY-MM-DD`; por defecto **mes en curso hasta hoy**, hora Caracas), `category_id?`, `brand_id?`, `cashier_id?`, `q?`.
- `q`: ≤ 60 caracteres, ≤ 5 palabras, **AND** entre palabras sobre nombre/SKU/código de barras/categoría/marca, sin tildes ni mayúsculas.
- `from ≤ to`, rango máximo **366 días**.
- 200 → `ProductsMetricsResponse`.

### 3.2 `GET /api/metrics/groups`
Query: `by` (`category|subcategory|brand`, **requerido**), `from`, `to`, `cashier_id?` (mismas reglas de fechas que 3.1).
- 200 → `GroupsMetricsResponse`. "Sin categoría" / "Sin subcategoría" / "Sin marca" son fila propia con `key_id: null`.

### 3.3 `GET /api/metrics/cashiers`
200 → `MetricsCashier[]` (todos los usuarios del negocio, también inactivos: tienen ventas pasadas), orden `name` asc.

### 3.4 Metas
Modelo `SalesGoal` (tabla `sales_goals`, aditiva, **sin FK** a products/categories/brands):
`id` · `business_id` · `scope` enum(`product`,`category`,`brand`) · `ref_id` Int · `period` VarChar(7) `YYYY-MM` · `metric` enum(`units`,`usd`) ·
`target` Decimal(12,2) · `created_by` Int · `created_at` · `updated_at`.
`@@unique([business_id, scope, ref_id, period, metric])` · `@@index([business_id, period])`.

- `GET /api/metrics/goals?period=YYYY-MM` (por defecto el mes en curso) → **`SalesGoalItem[]`** (arreglo, orden `label` asc).
- `POST /api/metrics/goals` body `{ scope, ref_id, period, metric, target }` (zod `.strict()`, `target > 0`, `period` mes 01–12) → **201** `{ goal: SalesGoalItem }`.
  `ref_id` se valida contra el negocio de la sesión: producto/categoría/marca ajena o inexistente → **404**. Duplicado (misma clave única) → **409**.
- `PATCH /api/metrics/goals/[id]` body `{ target }` (`.strict()`, `target > 0`) → 200 `{ goal: SalesGoalItem }`. Otra meta o de otro negocio → **404**.
- `DELETE /api/metrics/goals/[id]` → 200 `{ ok: true }`. Otra meta o de otro negocio → **404**.

Reglas de `days_left` / `per_day_needed` (hoy = `businessDateKey()`):
- mes en curso: `days_left = último_día − hoy + 1` (el último día del mes da 1); `per_day_needed = remaining / days_left`.
- mes ya cerrado: `days_left = 0`, `per_day_needed = null`.
- mes futuro: `days_left = días del mes` (todo el mes por delante).
- meta ya cumplida (`remaining = 0`): `per_day_needed = 0` (si el mes sigue abierto).

### 3.5 `GET /api/metrics/export`
Query: `view` (`products|groups`, requerido), `by` (requerido si `view=groups`), `from`, `to`, y los mismos filtros de 3.1/3.2.
200 → `.xlsx` (`xlsx`, mismo helper que `/api/reports/export-excel`), hoja única; columnas USD y Bs juntas; archivo
`metricas-<view>-<from>_a_<to>.xlsx`. Plan sin exportación → 403 `{ error, code: "PLAN_LIMIT" }`.

## 4. Códigos de error

| código | cuándo |
|---|---|
| 400 | zod inválido (fechas, `from > to`, rango > 366 días, `by`/`view` faltante o inválido, campo desconocido, `target ≤ 0`, `q` largo) |
| 307 | middleware: sin sesión (→ `/login`) o `cashier` (→ `/pos`); el handler no llega a ejecutarse |
| 401 | sin sesión (solo si se llega al handler) |
| 403 | rol sin permiso (solo si se llega al handler), o plan sin exportación (`code: "PLAN_LIMIT"`) |
| 404 | meta inexistente/ajena; `ref_id` de producto/categoría/marca ajeno o inexistente |
| 409 | meta duplicada (misma clave única) |
| 500 | `{ "error": "Error del servidor" }` (el detalle va al log, nunca al cliente) |

## 5. Esquema y despliegue

Solo **aditivo**: modelo `SalesGoal` + enums `SalesGoalScope`, `SalesGoalMetric`. Migración versionada
`prisma/migrations/20261031000001_add_sales_goals/migration.sql` (tabla nueva). En el VPS se aplica con `db push` (regla sellada)
y se marca con `migrate resolve --applied`. La tabla debe existir **antes** del código nuevo.

## 6. DECISIONES

- **D1 — descuento y cargo global (v1.1, decisión de Carlos).** El pedido original decía "monto = `subtotal_usd` − `discount_usd`", pero
  `sale_items.subtotal_usd/bs` ya vienen netos del descuento por ítem (`POST /api/sales`: `subtotal = qty × price − discount_usd`), así que
  restarlo otra vez descontaría dos veces. Además `sales.total_*` incluye el descuento global (`authorize-discount` solo toca `sales.total_*`;
  el POS lo prorratea en `discount_usd` de los ítems) y el cargo global. Para que Métricas cuadre al centavo con `/api/reports` se **prorratea**
  el total de cada venta entre sus líneas en proporción a `subtotal_usd`/`subtotal_bs` (§0.4). `discount_usd` no se resta. Unidades sin prorratear.
- **D2 — Bs de las devoluciones (v1.1).** `ReturnItem` no guarda Bs: se reparte `returns.total_bs` entre sus líneas en proporción a `return_items.total_usd`
  (tasa del día de la devolución, igual que `netSales().net.bs`). Así el neto en Bs coincide con `/api/reports/range`.
- **D3 — subcategoría.** No es una entidad: es el texto `products.subcategory`. Se agrupa por ese texto (sin tildes ni mayúsculas para
  decidir igualdad, la etiqueta es la primera variante vista); `key_id` siempre `null`. Dos categorías con la misma subcategoría se juntan.
- **D4 — metas por categoría/marca** suman las ventas netas de los productos cuya `category_id` / `brand_id` actual es `ref_id`
  (si el producto cambia de categoría, su historial se mueve con él, igual que en los reportes).
- **D5 — sin paginación** en `/products`: un negocio tiene del orden de cientos a pocos miles de productos con venta; el rango máximo
  (366 días) acota el resultado. Se pagina si algún negocio lo pide.
- **D6 — `PATCH` solo cambia `target`**: `scope`, `ref_id`, `period` y `metric` forman la clave única; cambiarlos es borrar y crear.
- **D7 — `cashier_id` ajeno** no se valida contra el negocio: la consulta ya está limitada a `business_id` de la sesión, así que un id
  de otro negocio devuelve vacío sin filtrar datos.
- **D8 — rango por defecto** (sin `from`/`to`): mes en curso hasta hoy en hora Caracas.
- **D9 — ventas sin líneas (límite conocido, pendiente de decisión).** Hay ventas realizadas con `sale_items` vacío (datos legados / cobros sin detalle de producto: en la base local, negocio 1: 22 ventas, $185.00; negocio 87: 6 ventas, $150.00). No se pueden atribuir a ningún producto, así que **no entran** en `/products` ni `/groups` y `totals` queda por debajo de `/api/reports/range` en ese monto. Con ventas que sí traen líneas, el cuadre es exacto (probado: $160.00 / Bs 16,000.00 con descuento y cargo global y una devolución). **Propuesta v1.2 (solo aditiva, no aplicada):** campo extra `without_detail: { sales: number; usd: number; bs: number }` en `ProductsMetricsResponse` y `GroupsMetricsResponse`, para que `totals + without_detail` = reportes. Requiere OK de Carlos antes de tocar la forma.
