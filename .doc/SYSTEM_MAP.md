# SYSTEM_MAP — ActivoPOS
# Actualizado: 2026-07-02 | Sprint 44.5 (CLI-C)
# Sprints cubiertos: 1-44
# Fuente: código real — NO editar a mano (regenerar con el prompt CLI-C)

---

## 0. ESTADO GENERAL

| Campo              | Valor                                                                          |
|--------------------|----------------------------------------------------------------------------------|
| Último sprint      | Sprint 44.5 (Proveedores, Planes, entry_type, SYSTEM_MAP)                        |
| Último commit      | `792b7cf` fix(inventory/CLI-A): agregar entry_type a InventoryEntry              |
| TypeScript         | ✅ 0 errores — `npx tsc --noEmit` (verificado 2026-07-02)                        |
| Build              | ✅ Limpio — `npm run build` (verificado 2026-07-02)                              |
| Puerto VPS         | 3003 (PM2 — según SYSTEM_MAP previo Sprint 33, no re-verificado en este sprint)  |
| Multi-tenant       | Prisma Client Extension (`src/lib/prisma-tenant.ts`) — scope automático por `business_id`, derivado del DMMF en runtime, fail-closed |
| Módulos nuevos     | `/registro` (onboarding self-service), Proveedores/Compras, Planes (límites + enforcement parcial) |

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
`sales` · `sales/[id]` · `sales/[id]/pay` · `sales/[id]/void` · `sales/[id]/authorize-discount` · `sales/[id]/ticket` · `sales/items/price-override` · `cash` · `cash/open` · `cash/close` · `cash/status` · `cash/history` · `cash/movement` · `orders` · `orders/[id]` · `orders/[id]/cobrar` · `orders/[id]/cancelar` · `orders/[id]/whatsapp` · `pos/drafts` · `pos/drafts/[id]` · `kds/orders` · `ventas/[id]/abono`

### Catálogo público
`catalog/[slug]` · `catalog/[slug]/order` · `catalogo/metrics`

### Clientes / Devoluciones / Cotizaciones
`clients` · `clients/[id]` · `clients/[id]/abono` · `clients/[id]/history` · `returns` · `returns/[id]/approve` · `returns/[id]/reject` · `quotations` · `quotations/[id]` · `quotations/[id]/convert` · `quotations/[id]/pdf`

### Finanzas
`finanzas/resumen` · `finanzas/daily` · `finanzas/cxc` · `finanzas/cxc/[id]/abono` · `finanzas/cxc/summary` · `finanzas/cxp` · `finanzas/cxp/[id]` · `finanzas/cxp/summary` · `finanzas/categorias` · `finanzas/categorias/[id]` · `finanzas/punto-equilibrio` · `finanzas/export` · `finanzas/export-excel` · `gastos` · `gastos/[id]` · `gastos/alerts`

### Reportes / Analytics
`reports/daily` · `reports/day` · `reports/range` · `reports/sales` · `reports/export-excel` · `reports/export-pdf` · `reports/monthly` · `reports/monthly/generate` · `reports/monthly/pending` · `reports/monthly/mark-pending` · `analytics/summary` · `analytics/top-products` · `analytics/trends` · `dashboard/kpis` · `dashboard/charts`

### Planes
`plan` · `plan/check` · `admin/tenants/[id]/plan`

### Admin
`admin/stats` · `admin/tenants` · `admin/tenants/[id]`

### Configuración
`config/business` · `config/business/modules` · `config/catalog` · `config/cobros/data` · `config/delivery` · `config/devices` · `config/devices/[id]` · `config/iva` · `config/payment-methods` · `config/payment-methods/[id]` · `config/pin` · `config/subscription` · `config/theme` · `config/ticket` · `payment-methods`

### Usuarios / Sistema
`users` · `users/[id]` · `users/[id]/reset-pin` · `users/change-password` · `notifications` · `notifications/[id]/read` · `notifications/counts` · `notifications/history` · `notifications/push` · `notifications/read-all` · `push/send` · `push/subscribe` · `rates/bcv` · `upload/image` · `r/[token]` · `ai/chat`

---

## 4. MODELOS PRISMA (32)

`Business` (raíz tenant) → `User`, `Product`, `Category`, `Sale`, `Order`, `Client`, `Supplier`, `Purchase`, `InventoryEntry`, `PaymentMethod`, `CashRegister`, `Gasto`, `Quotation`, `Return`, `Notification`, `BusinessDevice`, `PushSubscription`, `DollarRate` (nullable business_id — global compartido), `MonthlyReport`, `ExpenseCategory`, `ProductComponent`, `ActivityLog`

Relaciones clave nuevas/relevantes:
- `Supplier 1─N Purchase 1─N PurchaseItem N─1 Product`
- `InventoryEntry N─1 Product`, `N─1 User (created_by)` — ahora con `entry_type: purchase|adjustment|sale|return` (default `adjustment`)
- `Order N─1 Client?`, `Order 1─1 Sale?` (vía `orders/[id]/cobrar`) — `Order.items` con precios resueltos server-side
- `Sale 1─N SaleItem`, `1─N SalePayment`, `1─N SaleAbono`
- `User` — `@@unique([business_id, email])` **y** `@@unique([email])` (fix Sprint 44 P0: unicidad global de email)

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
| DT-01 | P1 | `entry_type` de `InventoryEntry` solo se setea en `purchases` (`'purchase'`) y `products/[id]/stock` (`'adjustment'`). `sales/route.ts`, `sales/[id]/pay`, `sales/[id]/void`, `orders/[id]/cobrar` crean `InventoryEntry` de venta/reversa sin `entry_type` → caen al default `'adjustment'`, indistinguibles de un ajuste manual real. | 44.5 |
| DT-02 | P1 | `checkPlanLimit()` define 5 acciones (`create_product`, `create_user`, `access_catalog`, `access_ai`, `create_supplier`) pero solo `create_product` y `create_user` están invocadas en un endpoint real. `access_catalog`, `access_ai` y `create_supplier` (incl. `POST /api/suppliers`) no aplican ningún límite pese a estar definidos en `PLAN_LIMITS`. | 44.5 |
| DT-03 | P2 | `Proveedores` es el único módulo de negocio en el Sidebar sin `moduleKey` — no participa del sistema de toggle de módulos por plan/config, a diferencia de POS/Inventario/Caja/Catálogo/Finanzas/Analytics/KDS. | 44.5 |
| DT-04 | P2 | `products/import` e `products/import-excel` crean `InventoryEntry` sin `entry_type` explícito (heredan el default `'adjustment'`) — razonable, pero no confirmado como intencional. | 44.5 |
| DT-05 | P2 | `RateLimiterMemory` (todos los limiters) no es cluster-safe — pendiente Redis en producción (comentario propio del código, `rate-limit.ts:3`). | histórico |
| DT-06 | P2 | `pdf-report.ts` y `pdf-reports.ts` coexisten en `src/lib/` — nombre casi idéntico, no auditado si hay duplicación real. | histórico |

*Ver `.doc/CONNECTIVITY_AUDIT_Jul2026.md` para el detalle y evidencia de cada gap.*

---

## 8. FLUJOS E2E VERIFICADOS (este sprint, evidencia por lectura de código — no Playwright)

- ✅ Registro (`/registro`) → `POST /api/onboarding/setup` → sesión JWT + cookie httpOnly → redirect a `/escritorio`.
- ✅ Producto con `show_in_catalog=true` + `catalog_visibility≠hidden` → aparece en `GET /api/catalog/[slug]` con stock real (`InventoryEntry.groupBy`).
- ✅ Pedido de catálogo (`POST /api/catalog/[slug]/order`) → `Order` → visible en `/pedidos` (`GET /api/orders`) → botón Cobrar → `POST /api/orders/[id]/cobrar` → crea `Sale` + descuenta stock.
- ✅ Compra a proveedor (`POST /api/purchases`) → `$transaction` atómica → `InventoryEntry` con `entry_type='purchase'` → stock del producto aumenta.
- ✅ Venta pagada (`status='paid'`) → descuenta stock, aparece en `reports/day` (filtro `status:'paid'` confirmado). Venta a crédito (`status='credit'`) → aparece en `finanzas/cxc` (no las pagadas — comportamiento correcto, CxC = solo deuda pendiente).
- ⚠️ `GET /api/plan` devuelve uso real; enforcement de plan solo cubre creación de productos/usuarios (ver DT-02).

Para verificación E2E real en navegador (Playwright), ver skill `webapp-testing` / agente `e2e-runner` — no ejecutado en esta auditoría (solo lectura de código).
