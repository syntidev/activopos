# SYSTEM_MAP — ActivoPOS
# Actualizado: 2026-07-05 | Sprint 63 (CLI-C)
# Sprints cubiertos: 1-63
# Fuente: código real — NO editar a mano (regenerar con el prompt CLI-C)

---

## 0. ESTADO GENERAL

| Campo              | Valor                                                                          |
|--------------------|----------------------------------------------------------------------------------|
| Último sprint      | Sprint 53-63 (páginas dedicadas producto nuevo/editar, dashboard + sidebar rediseñados, P&L, tasa manual/paralela + `RateContext` global, inventario `internal_use`, admin invoices/tickets backend real, fix costos/opex del seed demo) |
| Último commit      | `da09392` feat(config): manual pre-cargado con tasa paralela — sin etiqueta visible |
| TypeScript         | ✅ 0 errores — `npx tsc --noEmit` (verificado 2026-07-05)                          |
| Build              | ✅ Limpio — `npm run build` (verificado 2026-07-05)                                |
| VPS                | ✅ online — puerto 3001 (PM2, `activopos` proceso id 9), sincronizado a `da09392` (verificado 2026-07-05), `GET /api/rates/bcv` responde |
| Multi-tenant       | Prisma Client Extension (`src/lib/prisma-tenant.ts`) — scope automático por `business_id`, derivado del DMMF en runtime, fail-closed |
| Módulos nuevos     | `/productos/nuevo` y `/productos/[id]/editar` (páginas dedicadas, `useProductForm()`), dashboard + sidebar rediseñados (grupos colapsables), P&L (`/api/finanzas/pyl`), tasa manual/paralela + `RateContext`, inventario `entry_type='internal_use'` (consumo interno), admin invoices/tickets backend real |

---

## 1. MÓDULOS CERTIFICADOS (heredados, sin cambios este sprint)

| Módulo         | Estado | Evidencia                                                    |
|----------------|--------|---------------------------------------------------------------|
| POS            | ✅     | `src/app/(dashboard)/pos/`, `src/lib/pos.ts` — sin cambios recientes en git log |
| Caja           | ✅     | `src/app/(dashboard)/caja/`, `/api/cash/*`                    |
| Ventas/Reportes| ✅     | `/api/sales/*`, `/api/reports/*` — filtro `status:'paid'` confirmado en `reports/day/route.ts` |
| Inventario     | ✅     | `/api/inventory/*`, `InventoryEntry` — ahora con `entry_type` (ver §7) |
| Finanzas       | ✅     | `/api/finanzas/*` — CxC filtra `status:'credit'`, CxP separado |
| Catálogo digital | ✅   | `/catalogo/[slug]`, `/api/catalog/[slug]` — stock en vivo vía `InventoryEntry.groupBy` |
| KDS            | ✅     | `/api/kds/orders`, `src/app/(dashboard)/kds/`                 |
| Devoluciones   | ✅     | `/api/returns/*`                                               |
| Cotizaciones   | ✅     | `/api/quotations/*`                                            |

*Nota: esta sección no fue re-auditada exhaustivamente en este sprint — se mantiene del SYSTEM_MAP previo (Sprint 33) salvo lo verificado explícitamente arriba. Para re-certificar, correr `/code-review` dedicado por módulo.*

---

## 2. MÓDULOS NUEVOS (Sprints 35-44.5)

| Módulo                    | Descripción                                                              | Archivos clave |
|----------------------------|--------------------------------------------------------------------------|----------------|
| `/registro` (onboarding)   | Wizard de 7 pasos self-service para crear tenant nuevo. Rate limit de slug separado del de registro (fix P0 Sprint 44). Email único global (`@@unique([email])` en `User`). | `src/app/registro/`, `src/app/api/onboarding/setup/route.ts`, `src/lib/rate-limit.ts` |
| Proveedores + Compras      | CRUD de proveedores (soft delete) + registro de compras con `$transaction` atómica (compra + items + `InventoryEntry`). Aislamiento multi-tenant vía `getAuthenticatedTenant()`. | `src/app/api/suppliers/`, `src/app/api/purchases/`, `src/app/(dashboard)/proveedores/` |
| `entry_type` en InventoryEntry | Distingue `purchase`/`adjustment`/`sale`/`return` en el origen de cada movimiento de stock. Solo `purchases` y `products/[id]/stock` lo setean explícitamente — ver gap en §7. | `prisma/schema.prisma`, `src/app/api/purchases/route.ts`, `src/app/api/products/[id]/stock/route.ts` |
| Planes (límites + enforcement parcial) | `PLAN_LIMITS` (trial/inicio/pro/business) + `checkPlanLimit()` centralizado. Solo enforced en `create_product` y `create_user` — ver gap en §7. | `src/lib/plan-limits.ts`, `src/lib/plan-guard.ts`, `src/app/api/plan/`, `src/app/api/admin/tenants/[id]/plan/` |
| Admin Panel expandido      | Tenants + stats + detalle, panel `super_admin`-only | `src/app/api/admin/`, área `(admin)` (no auditada en este sprint) |
| `pos_mode` + factura de servicio | `Business.pos_mode` (ticket térmico 58mm / factura A4) — toggle en Configuración, `SuccessTicketPanel` abre `sales/[id]/ticket` o `sales/[id]/invoice` según corresponda. Cierra el gap "sin punto de decisión de documento" reportado en sesión anterior. | `src/app/api/sales/[id]/invoice/route.ts`, `src/components/pos/SuccessTicketPanel.tsx`, `src/app/(dashboard)/configuracion/tabs/TabEmpresa.tsx` |
| Cotización PDF profesional | RIF, dirección, correo y `quotation_footer` (condiciones) del negocio ahora en el PDF de cotización — cierra gap reportado en sesión anterior. Encoding de tildes **no confirmado** como corregido. | `src/app/api/quotations/[id]/pdf/route.ts` |
| Billing cycles | `BILLING_CYCLES` (mensual/trimestral/semestral/anual con descuentos) en `plan-limits.ts`, selector en `TabPlan` | `src/lib/plan-limits.ts`, `src/app/(dashboard)/configuracion/tabs/TabPlan.tsx` |

---

## 2.1 MÓDULOS NUEVOS (Sprints 53-63)

| Módulo                    | Descripción                                                              | Archivos clave |
|----------------------------|--------------------------------------------------------------------------|----------------|
| Producto — páginas dedicadas | `/productos/nuevo` y `/productos/[id]/editar` reemplazan el modal; lógica de formulario extraída a `useProductForm()`. Grid 50/50, layout compartido. | `src/hooks/useProductForm.ts`, `src/components/products/ProductFormLayout.tsx`, `src/app/(dashboard)/productos/nuevo/page.tsx`, `src/app/(dashboard)/productos/[id]/editar/page.tsx` |
| Dashboard + Sidebar rediseño | Grid asimétrico con elevación real (`escritorio.module.css`), componentes huérfanos `DashboardCharts`/`DashboardOperativo` eliminados. Sidebar reorganizado en grupos colapsables, Inventario linkado. | `src/app/(dashboard)/escritorio/`, `src/components/layout/Sidebar.tsx` |
| Finanzas — Estado de Resultados (P&L) | `GET /api/finanzas/pyl?period=hoy\|7dias\|mes\|anio` (o `from`/`to`) — `ingresos`/`cogs`/`opex`/`utilidad_bruta`/`utilidad_neta`/`margen_bruto` desde `sale_items.cost_per_unit_usd` (nuevo campo, migración `20260705000001_add_sale_item_cost`) y `gastos`. Bloqueado para `cashier`. | `src/app/api/finanzas/pyl/route.ts` |
| Tasa manual/paralela + `RateContext` | `POST /api/rates/manual` guarda tasa manual scopeada por `business_id` (fix HIGH de leak cross-tenant, `e94d1f0`). `GET /api/rates/bcv` ahora expone `manual_active`, `bcv_rate`, `parallel_rate`. `RateContext` global sustituye el polling manual por refetch inmediato (`CustomEvent`) + polling 30s + refetch en focus — sin F5. | `src/app/api/rates/manual/route.ts`, `src/app/api/rates/bcv/route.ts`, `src/context/RateContext.tsx` |
| Inventario — consumo interno | `POST /api/inventory` acepta `entry_type: 'adjustment' \| 'internal_use'`; Zod exige `quantity` negativa cuando es `internal_use`. Modal de consumo interno conectado en `/inventario`. `GET /api/inventory/product/[id]/movements` paginado. | `src/app/api/inventory/route.ts`, `src/app/(dashboard)/inventario/` |
| Admin — invoices/tickets backend real | Elimina la fachada de mock data del Sprint 54: `admin/invoices` y `admin/tickets` ahora sirven datos reales. Impersonación de tenant vía cookie firmada `jose` (`admin/impersonate/[businessId]`). | `src/app/api/admin/invoices/route.ts`, `src/app/api/admin/tickets/route.ts`, `src/app/api/admin/impersonate/[businessId]/route.ts` |
| Historial — utilidad por venta | Columna de utilidad (`price - cost`) en historial de ventas, visible solo para `admin` (oculta a `cashier`, ver §7 seguridad). | `src/app/(dashboard)/ventas/VentasPage.tsx` |
| Seed demo — costos/opex corregidos | Costos de catálogo demo recalculados a ~35% margen (antes 45-75%, no era el problema real); gastos operativos mensuales reducidos 775→300 USD y sin clamp de fecha (un gasto con día futuro ya no se cuenta antes de tiempo en el P&L "mes"). | `prisma/seed.ts` |

---

## 3. ENDPOINTS API — MAPA COMPLETO

### Auth
`auth/login` · `auth/logout` · `auth/me`

### Onboarding / Registro
`onboarding/setup` · `onboarding/check-slug` · `onboarding/complete` · `onboarding/steps`
*(todo el prefijo `/api/onboarding/` es público en middleware — `complete`/`steps` re-validan sesión internamente)*

### Productos / Inventario
`products` · `products/[id]` · `products/[id]/stock` · `products/[id]/components` · `products/[id]/components/[componentId]` · `products/[id]/variants` · `products/[id]/variants/[variantId]` · `products/bulk-visibility` · `products/categories` · `products/import` · `products/import-excel` · `products/import-excel/template` · `products/recent` · `products/search` · `categories` · `categories/[id]` · `inventory` · `inventory/export` · `inventory/product/[id]/movements`

### Proveedores / Compras
`suppliers` · `suppliers/[id]` · `purchases` · `purchases/[id]`

### Ventas / Caja / Pedidos
`sales` · `sales/[id]` · `sales/[id]/pay` · `sales/[id]/void` · `sales/[id]/authorize-discount` · `sales/[id]/ticket` · `sales/[id]/invoice` (PDF carta, Sprint 51) · `sales/items/price-override` · `cash` · `cash/open` · `cash/close` · `cash/status` · `cash/history` · `cash/movement` · `orders` · `orders/[id]` · `orders/[id]/cobrar` · `orders/[id]/cancelar` · `orders/[id]/whatsapp` · `pos/drafts` · `pos/drafts/[id]` · `kds/orders` · `ventas/[id]/abono`

### Catálogo público
`catalog/[slug]` · `catalog/[slug]/order` · `catalogo/metrics`

### Clientes / Devoluciones / Cotizaciones
`clients` · `clients/[id]` · `clients/[id]/abono` · `clients/[id]/history` · `returns` · `returns/[id]/approve` · `returns/[id]/reject` · `quotations` · `quotations/[id]` · `quotations/[id]/convert` · `quotations/[id]/pdf`

### Finanzas
`finanzas/resumen` · `finanzas/daily` · `finanzas/cxc` · `finanzas/cxc/[id]/abono` · `finanzas/cxc/summary` · `finanzas/cxp` · `finanzas/cxp/[id]` · `finanzas/cxp/summary` · `finanzas/categorias` · `finanzas/categorias/[id]` · `finanzas/punto-equilibrio` · `finanzas/pyl` (Estado de Resultados, Sprint 63) · `finanzas/export` · `finanzas/export-excel` · `gastos` · `gastos/[id]` · `gastos/alerts`

### Reportes / Analytics
`reports/daily` · `reports/day` · `reports/range` · `reports/sales` · `reports/export-excel` · `reports/export-pdf` · `reports/monthly` · `reports/monthly/generate` · `reports/monthly/pending` · `reports/monthly/mark-pending` · `analytics/summary` · `analytics/top-products` · `analytics/trends` · `dashboard/kpis` · `dashboard/charts`

### Planes
`plan` · `plan/check` · `admin/tenants/[id]/plan`

### Admin
`admin/stats` · `admin/tenants` · `admin/tenants/[id]` · `admin/tenants/[id]/plan` · `admin/invoices` (backend real, Sprint 63) · `admin/tickets` (backend real, Sprint 63) · `admin/impersonate` · `admin/impersonate/[businessId]`

### Configuración
`config/business` · `config/business/modules` · `config/catalog` · `config/cobros/data` · `config/delivery` · `config/devices` · `config/devices/[id]` · `config/iva` · `config/payment-methods` · `config/payment-methods/[id]` · `config/pin` · `config/subscription` · `config/theme` · `config/ticket` · `payment-methods`

### Usuarios / Sistema
`users` · `users/[id]` · `users/[id]/reset-pin` · `users/change-password` · `notifications` · `notifications/[id]/read` · `notifications/counts` · `notifications/history` · `notifications/push` · `notifications/read-all` · `push/send` · `push/subscribe` · `rates/bcv` (expone `manual_active`/`bcv_rate`/`parallel_rate`, Sprint 63) · `rates/manual` (Sprint 63) · `upload/image` · `r/[token]` · `ai/chat`

---

## 4. MODELOS PRISMA (32)

`Business` (raíz tenant) → `User`, `Product`, `Category`, `Sale`, `Order`, `Client`, `Supplier`, `Purchase`, `InventoryEntry`, `PaymentMethod`, `CashRegister`, `Gasto`, `Quotation`, `Return`, `Notification`, `BusinessDevice`, `PushSubscription`, `DollarRate` (nullable business_id — global compartido), `MonthlyReport`, `ExpenseCategory`, `ProductComponent`, `ActivityLog`

Relaciones clave nuevas/relevantes:
- `Supplier 1─N Purchase 1─N PurchaseItem N─1 Product`
- `InventoryEntry N─1 Product`, `N─1 User (created_by)` — ahora con `entry_type: purchase|adjustment|sale|return` (default `adjustment`)
- `Order N─1 Client?`, `Order 1─1 Sale?` (vía `orders/[id]/cobrar`) — `Order.items` con precios resueltos server-side
- `Sale 1─N SaleItem`, `1─N SalePayment`, `1─N SaleAbono`
- `User` — `@@unique([business_id, email])` **y** `@@unique([email])` (fix Sprint 44 P0: unicidad global de email)
- `SaleItem.cost_per_unit_usd` (nuevo, Sprint 63) — snapshot del costo al momento de la venta, insumo de `finanzas/pyl`

**Migraciones recientes** (`prisma/migrations/`, más nuevas primero): `20260705000001_add_sale_item_cost` · `20260704000001_add_invoice_ticket_models` · `20260624000002_add_subscription_expires_at` · `20260624000001_add_returned_sale_status` · `20260624000001_add_business_devices`. Ver DT-08 — los deploys de este sprint (63) aplicaron el schema en VPS vía `db push`, no `migrate deploy`.

---

## 5. PÁGINAS Y RUTAS

**Dashboard** (`(dashboard)/`, requiere sesión): `analytics` · `ayuda` · `caja` · `catalogo-digital` · `clientes` · `configuracion` · `cotizaciones` · `devoluciones` · `escritorio` · `finanzas` · `inventario` · `kds` · `onboarding` · `pedidos` · `pos` · `productos` · `proveedores` (+`/compras`) · `reportes` · `tu-dia` · `usuarios` · `ventas`

**Públicas** (sin auth): `(auth)/login` · `(marketing)/*` · `catalogo/[slug]` · `registro` (wizard 7 pasos)

**Admin** (`super_admin`-only, no auditado en este sprint): panel de tenants

**Sidebar** (`src/components/layout/Sidebar.tsx`) — 16 links activos; `Proveedores` es el único módulo de negocio **sin** `moduleKey` (no participa del toggle de módulos por plan/config — ver gap §7).

---

## 6. LIBRERÍAS CRÍTICAS (`src/lib/`)

| Archivo | Rol |
|---|---|
| `auth.ts` | JWT (jose, HS256, fail-closed) + cookie httpOnly de sesión |
| `tenant.ts` | `getAuthenticatedTenant()` — sesión + Prisma scoped, patrón estándar de todos los endpoints protegidos |
| `prisma-tenant.ts` | Extension de Prisma Client — inyecta `business_id` automáticamente en todos los modelos que tienen esa columna (derivado del DMMF, fail-closed) |
| `rate-limit.ts` | `RateLimiterMemory` por feature: login (IP+email), onboarding, slug-check (separado de onboarding, fix Sprint 44), catálogo, AI chat, rates, upload |
| `plan-limits.ts` / `plan-guard.ts` | Límites por plan (trial/inicio/pro/business) + `checkPlanLimit()` — enforcement parcial, ver §7 |
| `bcv.ts` | Tasa de cambio USD→Bs (dólar BCV) |
| `catalog.ts` | Filtro de visibilidad de catálogo + cálculo de disponibilidad (`computeAvailability`) |
| `pos.ts` | Motor de cálculo del punto de venta |
| `ticket.ts` | Generación de números de ticket |
| `finanzas.ts`, `reports.ts`, `dashboard.ts` | Agregaciones de reportes/KPIs |
| `cobros.ts`, `clients.ts` | Lógica de cobros y clientes |
| `notifications.ts`, `push-notify.ts` | Notificaciones in-app y push |
| `pdf-report.ts`, `pdf-reports.ts` | Generación de PDFs (posible duplicación de nombre — no auditado) |
| `monthly-report-cron.ts` | Job de reportes mensuales |
| `pin-rate-limit.ts` | Rate limit específico de PIN de caja |
| `units.ts`, `audio.ts`, `draft-schema.ts` | Utilidades varias (unidades, sonido, borradores POS) |
| `prisma.ts` | Cliente Prisma base (sin scope de tenant) |

---

## 7. DEUDA TÉCNICA ACTIVA

| ID  | Severidad | Descripción | Sprint |
|-----|-----------|--------------|--------|
| ~~DT-01~~ | ~~P1~~ | ✅ **CERRADO Sprint 50** (`b797989`) — `entry_type='sale'` ahora se setea en `sales/route.ts`, `sales/[id]/pay`, `sales/[id]/void` y `orders/[id]/cobrar`. | 44.5→50 |
| DT-02 | P1 | `checkPlanLimit()` define 5 acciones. `create_supplier` cerrado Sprint 50 (`cb672c7`, `POST /api/suppliers`). **`access_catalog` y `access_ai` siguen sin invocarse en ningún endpoint real** — un tenant `trial` puede usar catálogo digital e IA sin bloqueo. | 44.5, parcial 50 |
| DT-03 | P2 | `Proveedores` es el único módulo de negocio en el Sidebar sin `moduleKey` — no participa del sistema de toggle de módulos por plan/config, a diferencia de POS/Inventario/Caja/Catálogo/Finanzas/Analytics/KDS. | 44.5 |
| DT-04 | P2 | `products/import` e `products/import-excel` crean `InventoryEntry` sin `entry_type` explícito (heredan el default `'adjustment'`) — razonable, pero no confirmado como intencional. | 44.5 |
| DT-05 | P2 | `RateLimiterMemory` (todos los limiters) no es cluster-safe — pendiente Redis en producción (comentario propio del código, `rate-limit.ts:3`). | histórico |
| DT-06 | P2 | `pdf-report.ts` y `pdf-reports.ts` coexisten en `src/lib/` — nombre casi idéntico, no auditado si hay duplicación real. | histórico |
| ~~DT-07~~ | ~~HIGH~~ | ✅ **CERRADO Sprint 63** (`e94d1f0`) — tasa manual (`POST /api/rates/manual`) no estaba scopeada por `business_id`, permitía leak cross-tenant. | 63 |
| DT-08 | P2 | El deploy VPS de este sprint usó `npx prisma db push` en vez de `migrate deploy` para aplicar `20260705000001_add_sale_item_cost` (y migraciones previas) — `db push` no escribe en `_prisma_migrations`. Riesgo: un futuro `migrate deploy` podría intentar re-aplicar esa migración y fallar por drift. Verificar `npx prisma migrate status` en VPS antes del próximo deploy con `migrate deploy`. | 63 |

*Ver `.doc/CONNECTIVITY_AUDIT_Jul2026.md` para el detalle y evidencia de cada gap.*

---

## 8. FLUJOS E2E VERIFICADOS (este sprint, evidencia por lectura de código — no Playwright)

- ✅ Registro (`/registro`) → `POST /api/onboarding/setup` → sesión JWT + cookie httpOnly → redirect a `/escritorio`.
- ✅ Producto con `show_in_catalog=true` + `catalog_visibility≠hidden` → aparece en `GET /api/catalog/[slug]` con stock real (`InventoryEntry.groupBy`).
- ✅ Pedido de catálogo (`POST /api/catalog/[slug]/order`) → `Order` → visible en `/pedidos` (`GET /api/orders`) → botón Cobrar → `POST /api/orders/[id]/cobrar` → crea `Sale` + descuenta stock.
- ✅ Compra a proveedor (`POST /api/purchases`) → `$transaction` atómica → `InventoryEntry` con `entry_type='purchase'` → stock del producto aumenta.
- ✅ Venta pagada (`status='paid'`) → descuenta stock, aparece en `reports/day` (filtro `status:'paid'` confirmado). Venta a crédito (`status='credit'`) → aparece en `finanzas/cxc` (no las pagadas — comportamiento correcto, CxC = solo deuda pendiente).
- ⚠️ `GET /api/plan` devuelve uso real; enforcement de plan cubre creación de productos/usuarios/proveedores (ver DT-02 — catálogo e IA aún sin bloqueo).
- ✅ **Registro E2E en producción (Sprint 52)**: flujo completo verificado con Playwright contra `activopos.com` — 7 pasos → `POST /api/onboarding/setup` (201) → redirect `/escritorio` con sesión activa, sin errores 4xx/5xx propios del flujo. Ver `.doc/HANDOFF_Sprint52_Sesion_2Jul2026.md`.
- ✅ **Cobro → documento correcto según `pos_mode` (Sprint 51)**: venta con `pos_mode='invoice'` abre `GET /api/sales/[id]/invoice` (PDF carta); con `pos_mode='ticket'` (default) abre `GET /api/sales/[id]/ticket` (térmico 58mm).

- ✅ **P&L (Sprint 63)**: `GET /api/finanzas/pyl?period=mes` verificado contra datos reales de producción — `ingresos - cogs = utilidad_bruta`, `utilidad_bruta - opex = utilidad_neta` (query directa a `sale_items`/`gastos`, resultado positivo tras fix de costos/opex del seed).
- ✅ **Tasa manual scopeada por tenant (Sprint 63)**: `POST /api/rates/manual` confirmado con `business_id` de `getSession()`, no del body — cierra el leak cross-tenant de DT-07.

Para verificación E2E real en navegador (Playwright), ver skill `webapp-testing` / agente `e2e-runner` — ejecutado en Sprint 52 solo para `/registro` (ver arriba); el resto de flujos sigue verificado por lectura de código.
