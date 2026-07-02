# AUDITORÍA DE CONECTIVIDAD — Sprint 44.5
# Fecha: 2026-07-02 | CLI-C
# Método: lectura de código real (route handlers + frontend fetch), sin ejecución Playwright

---

## FLUJO 1: Registro → Dashboard

**Estado: ✅ CONECTADO**

- `POST /api/onboarding/setup` (`src/app/api/onboarding/setup/route.ts`) valida con Zod, crea `Business`+`User` en `$transaction`, hashea password con bcrypt, y llama `signToken()` + `setSessionCookie()` — el JWT se emite y la cookie `httpOnly` queda seteada en la misma respuesta 201.
- `src/app/registro/page.tsx` (`handleGoDashboard`) hace `router.push('/escritorio')` tras éxito — la sesión ya está activa vía cookie, no requiere un segundo login.
- Rate limiting: `onboardingLimiter` (3/hora) para el `POST` final, y `slugCheckLimiter` (20/hora, **separado**) para las verificaciones en vivo de `Step3Slug.tsx` — confirmado en `src/lib/rate-limit.ts` y `src/app/api/onboarding/check-slug/route.ts:4,10`. Este era un P0 de una auditoría previa (limiter compartido bloqueaba el registro real) — **ya corregido** (commit `6526896`).
- Email: `User` ahora tiene `@@unique([email])` global además del compuesto `@@unique([business_id, email])` (`prisma/schema.prisma:220`) — corrige el gap de unicidad de email detectado en auditoría previa.

Sin gaps.

---

## FLUJO 2: Producto → Catálogo

**Estado: ✅ CONECTADO**

- `POST /api/products` crea el producto con `show_in_catalog` (default `false` en schema — opt-in explícito, no un bug) y `catalog_visibility` (default `'visible'`).
- `GET /api/catalog/[slug]/route.ts:56-61` filtra `active:true, show_in_catalog:true, available_in_pos:true` + `CATALOG_WHERE_FILTER` (`src/lib/catalog.ts:19`: `catalog_visibility: { not: 'hidden' }`) — un producto con `catalog_visibility='visible'` pasa el filtro correctamente.
- Stock real: `route.ts:84-97` hace `prisma.inventoryEntry.groupBy` por `product_id` (suma `quantity - waste`) y lo usa para `stockQty`/`outOfStock`/`availability` (`computeAvailability` en `catalog.ts`) — el stock mostrado en el catálogo público refleja `InventoryEntry` real, no un campo cacheado.

Gap menor (no bloqueante): un producto recién creado no aparece en el catálogo hasta que un admin active `show_in_catalog` manualmente desde Configuración/Productos — comportamiento esperado, no un bug de conectividad.

---

## FLUJO 3: Catálogo → Pedido → POS

**Estado: ✅ CONECTADO**

- `POST /api/catalog/[slug]/order` (`src/app/api/catalog/[slug]/order/route.ts`) resuelve precios y nombres **desde la DB**, nunca del cliente (comentario explícito línea 9), crea/actualiza `Client` por teléfono, y crea `Order` con `origin:'catalog'` y `status:'received'` dentro de un `$transaction`.
- `src/app/(dashboard)/pedidos/page.tsx:302` hace `fetch('/api/orders?limit=100')` — el pedido aparece en el dashboard.
- Botón "Cobrar" (`pedidos/page.tsx:405`) llama `POST /api/orders/[id]/cobrar`, que: valida el método de pago (tenant-scoped), re-resuelve precios desde `Product` (no del snapshot del pedido — comentario `SEC-01`), crea la `Sale` con `status:'paid'`, descuenta stock vía `inventoryEntry.createMany` (cantidades negativas), y marca el `Order` como `sale_id` + `status:'delivered'`.

**Gap (ver DT-01 en SYSTEM_MAP):** el `inventoryEntry.createMany` de `orders/[id]/cobrar/route.ts:119-129` no setea `entry_type` → cae al default `'adjustment'`. Semánticamente debería ser `'sale'`.

---

## FLUJO 4: Compra Proveedor → Stock

**Estado: ✅ CONECTADO**

- `POST /api/purchases` crea `Purchase`+`PurchaseItem[]`+`InventoryEntry[]` en un único `prisma.$transaction`, con `entry_type: 'purchase'` (agregado este sprint, commit `792b7cf`).
- El stock del producto (`GET /api/products/[id]` y el catálogo, ambos vía `InventoryEntry.groupBy`) refleja el incremento inmediatamente tras el commit de la transacción — no hay caché intermedio ni campo `stock` denormalizado que pueda desincronizarse.
- `business_id`/`supplier_id`/`product_id` validados contra el tenant antes de abrir la transacción (ver auditoría de Proveedores, sprint anterior).

Sin gaps nuevos.

---

## FLUJO 5: Venta → Finanzas

**Estado: ⚠️ PARCIAL (aclaración de diseño, no bug)**

- El checklist original asumía "venta `paid` → aparece en `finanzas/cxc`" — **esto es incorrecto por diseño**: `GET /api/finanzas/cxc/route.ts:32` filtra `status: 'credit'` (Cuentas por Cobrar = deuda pendiente). Una venta `paid` correctamente **no** aparece ahí — ya fue cobrada, no hay nada que cobrar.
- Lo que sí está confirmado: venta `paid` → descuenta stock (`sales/route.ts:439`, `inventoryEntry.createMany`) y aparece en `reports/day/route.ts` (filtro `status:'paid'` en líneas 42, 57, 70, 94).
- Venta `credit` → sí aparece correctamente en `finanzas/cxc` (mismo filtro `status:'credit'`).

**Gap (ver DT-01):** igual que el Flujo 3, `sales/route.ts:439`, `sales/[id]/pay/route.ts:157` y `sales/[id]/void/route.ts:52` crean `InventoryEntry` sin `entry_type` → caen a `'adjustment'` en vez de `'sale'`/`'return'`.

---

## FLUJO 6: Plan → Enforcement

**Estado: ⚠️ PARCIAL**

- `GET /api/plan` (`src/app/api/plan/route.ts`) devuelve `plan`, `status` derivado, `usage.products`/`usage.users` (conteos reales vía `db.product.count`/`db.user.count`, tenant-scoped) y `days_remaining`. Conectado correctamente.
- `checkPlanLimit()` (`src/lib/plan-guard.ts`) define 5 `PlanAction`: `create_product`, `create_user`, `access_catalog`, `access_ai`, `create_supplier`.
- Grep de `checkPlanLimit` en todo `src/` confirma que **solo 2 de 5** están invocadas en un endpoint real:
  - ✅ `POST /api/products` → `checkPlanLimit('create_product')` → 403 con `reason` si se alcanza el límite.
  - ✅ `POST /api/users` → `checkPlanLimit('create_user')` → mismo patrón.
  - ❌ `access_catalog` — no se llama en ningún endpoint (ni en `config/catalog`, ni en middleware). Un tenant en plan `trial`/`inicio` (`catalog:false` en `PLAN_LIMITS`) puede igualmente activar y usar el catálogo digital sin bloqueo.
  - ❌ `access_ai` — no se llama en `POST /api/ai/chat`. Un tenant fuera del plan `business` (`ai:true` solo ahí) puede usar el chat de IA sin límite.
  - ❌ `create_supplier` — no se llama en `POST /api/suppliers`. Un tenant en `trial` (`suppliers:false` en `PLAN_LIMITS`) puede crear proveedores libremente.
  - Existe `POST /api/plan/check` como endpoint genérico que sí acepta cualquier `action` y delega a `checkPlanLimit(data.action)` — pero es un endpoint de **consulta** (el frontend lo llamaría para saber si mostrar/ocultar un botón); no reemplaza la validación server-side dentro de los propios endpoints de escritura.

---

## GAPS ENCONTRADOS

**P0:** ninguno — no se encontró ningún flujo completamente roto (❌) que impida una operación de negocio.

**P1:**
- `entry_type` no se setea en las 4 rutas que descuentan/revierten stock por venta (`sales/route.ts`, `sales/[id]/pay`, `sales/[id]/void`, `orders/[id]/cobrar`) — reduce el valor del campo agregado este sprint para reportes futuros de "origen del movimiento de inventario". Archivos: `src/app/api/sales/route.ts:439`, `src/app/api/sales/[id]/pay/route.ts:157`, `src/app/api/sales/[id]/void/route.ts:52-58`, `src/app/api/orders/[id]/cobrar/route.ts:119-129`.
- Enforcement de plan incompleto: `access_catalog`, `access_ai`, `create_supplier` definidos pero no aplicados en ningún endpoint de escritura real. Un tenant puede usar catálogo, IA y proveedores fuera de los límites de su plan sin ningún bloqueo server-side. Falta la llamada en `src/app/api/suppliers/route.ts` (POST), `src/app/api/ai/chat/route.ts`, y el endpoint que activa el catálogo (`src/app/api/config/catalog/route.ts`, no auditado en detalle).

**P2:**
- `Proveedores` no tiene `moduleKey` en el Sidebar (`src/components/layout/Sidebar.tsx:119`) — no participa del sistema de toggle de módulos, inconsistente con el resto de módulos de negocio.
- `products/import` y `products/import-excel` crean `InventoryEntry` sin `entry_type` explícito (heredan `'adjustment'` por default) — razonable pero no confirmado como decisión intencional.
- El checklist de esta tarea asumía que ventas `paid` deberían aparecer en `finanzas/cxc` — aclarado que es diseño correcto (CxC = solo `status:'credit'`), documentado aquí para evitar confusión futura.
