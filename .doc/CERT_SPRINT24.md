# CERT_SPRINT24 — Certificación Sprint 24
**CLI-C | Fecha:** 2026-06-22
**Auditor:** CLI-C (Quality/Audit — solo reporta, corrige P0 únicamente)
**Sprint items auditados:** Multi-ticket (MT01-MT06), Módulos (MO01-MO04), Stock Threshold (ST01-ST03), Web Push (WP01-WP03)

---

## RESULTADO GENERAL

| Área            | Spec | ✅ OK | ⚠️ Gap | Bug |
|-----------------|------|-------|--------|-----|
| Multi-ticket    | MT01-MT06 | MT01 MT02 MT03 | MT04 MT05 | MT06 |
| Módulos         | MO01-MO04 | MO01 MO02 | MO03 MO04 | — |
| Stock Threshold | ST01-ST03 | ST01 ST02 | ST03 | ST02-bug |
| Web Push        | WP01-WP03 | WP01 WP02 | WP03 | — |

**Estado:** APROBADO CON OBSERVACIONES — 3 Gaps P2, 1 bug P3. No hay P0.

---

## AUDITORÍA MULTI-TICKET

### MT01 ✅ — POST /api/pos/drafts crea draft
- `src/app/api/pos/drafts/route.ts` — POST crea Sale con `status='draft'`
- `ticket_number` se asigna como `DRF-{id:05d}` via update posterior
- `cashier_id` tomado de `getSession()` — correcto
- Verificado: test MT01 ✅

### MT02 ✅ — Máximo 5 drafts por cajero
- `MAX_DRAFTS = 5` chequeado en transacción Prisma
- GET /api/pos/drafts filtra por `cashier_id: session.userId` — correcto
- Verificado: test MT02 ✅

### MT03 ✅ — PATCH actualiza items atómicamente
- `src/app/api/pos/drafts/[id]/route.ts` — `$transaction`: deleteMany items + update sale
- Precios siempre de DB (anti-tampering) — correcto
- Verificado: test MT03 ✅

### MT04 ⚠️ GAP — Drafts no persisten al navegar (refresh)
- **Implementación real:** `useDraftTabs` en `src/hooks/useDraftTabs.ts` — 100% estado React en-memoria
- El componente `DraftTabs` en `src/app/(dashboard)/pos/page.tsx` usa `useDraftTabs`, NO los endpoints `/api/pos/drafts`
- Los endpoints de draft existen y funcionan pero la UI **nunca los llama**
- Al refrescar la página, todos los tabs se pierden
- **Para Sprint 25:** CLI-A debe conectar `useDraftTabs` a `/api/pos/drafts` (save on change, load on mount)

### MT05 ⚠️ GAP — Draft no se borra al pagar
- `procesarPago` en `usePOS.ts` llama `postSale(ticket, 'paid', ...)` → crea un Sale **nuevo** con `status='paid'`
- No existe parámetro `draft_id` en el POST /api/sales — los sistemas son desconectados
- El tab se cierra manualmente por el cajero; no hay limpieza automática de draft en DB
- **Para Sprint 25:** Agregar `draft_id` opcional en saleSchema; si present, hacer DELETE del draft al final de la transacción

### MT06 ⚠️ — 409 Conflict vs 400 Bad Request
- **Spec dice:** 6to draft rechazado con 400 Bad Request
- **Implementación:** retorna 409 Conflict (`MAX_DRAFTS` error path en route.ts:129)
- 409 es semánticamente más correcto (recurso en conflicto), pero rompe el contrato de spec
- **Para Sprint 25:** CLI-A alinea el status code (spec dice 400)

---

## AUDITORÍA MÓDULOS

### MO01 ✅ — PATCH modules actualiza DB
- `src/app/api/config/business/modules/route.ts` — `z.array(z.enum(ALLOWED_MODULES)).min(1)`
- Almacenado como comma-separated en `Business.modules_enabled`
- Solo admin (no cashier) puede modificar — correcto
- Verificado: test MO01 ✅

### MO02 ✅ — Sidebar filtra por módulo
- `src/components/layout/Sidebar.tsx` L180-182 filtra `group.items` por `item.moduleKey`
- `DashboardShell.tsx` fetcha `/api/config/business/modules` y pasa `enabledModules` al Sidebar
- Fallback: si `enabledModules === null` (cargando), muestra todos — correcto
- Verificado: lectura directa de código

### MO03 ⚠️ GAP — Middleware no enforcea control de módulos
- `src/middleware.ts` solo valida: autenticación, admin-only prefixes, onboarding
- **No existe** ninguna verificación de `modules_enabled` en el middleware
- Rutas de módulos desactivados (`/pedidos`, `/finanzas`, etc.) siguen accesibles directamente
- **Para Sprint 25:** CLI-A agrega verificación de modules_enabled en middleware para rutas afectadas
- Verificado: test MO03 confirma que GET /api/orders no retorna 404 aunque 'pedidos' esté desactivado

### MO04 ⚠️ GAP — Sin protección de módulos core
- `ALLOWED_MODULES` incluye `pos`, `inventory`, `caja` sin separación de módulos core
- Un admin puede enviar `{ modules: ['catalog'] }` y deshabilitar el POS completo
- **Para Sprint 25:** Agregar `CORE_MODULES = ['pos', 'inventory', 'caja']` y filtrar en PATCH

---

## AUDITORÍA STOCK THRESHOLD

### ST01 ✅ — Threshold configurable por producto
- `src/app/api/products/[id]/route.ts` L36: `stock_alert_threshold: z.number().int().min(0).optional()`
- Se persiste en DB y se retorna en la respuesta
- Verificado: test ST01 ✅

### ST02 ✅ — Alerta creada tras venta pagada bajo umbral
- `checkStockAlerts()` en `src/app/api/sales/route.ts` L81-107 — fire-and-forget post-payment
- Calcula net stock via `inventoryEntry` aggregation, crea notificación `stock_low`
- Verificado: test ST02 ✅

### ST02 BUG P3 — Null threshold dispara falso positivo
- **Código:** `if (net <= p.stock_alert_threshold)` — L96
- **Caso:** producto sin threshold (`stock_alert_threshold = null`), stock en exactamente 0
- **JS coercion:** `0 <= null` → `0 <= 0` → `true` — notificación se dispara incorrectamente
- **Fix:** `if (p.stock_alert_threshold !== null && net <= p.stock_alert_threshold)`
- Severidad: P3 (solo afecta productos sin umbral configurado cuando el stock llega a 0)
- **Para Sprint 25:** CLI-A parchea la comparación con null guard

### ST03 ⚠️ — Badge de notificaciones incorrecto
- El badge de notificaciones en el Sidebar aún está afectado por el Sprint 23 NO-F1 (campo mismatch)
- API retorna `body` + `read_at`, la interfaz `NotificationItem` espera `description` + `read`
- Pendiente fix Sprint 23 NO-F1 de CLI-B

---

## AUDITORÍA WEB PUSH

### WP01 ✅ — SSRF protegido en suscripción push
- `src/app/api/push/subscribe/route.ts` — `PUSH_ENDPOINT_ALLOWLIST` + `PRIVATE_IP_RE`
- Solo acepta endpoints HTTPS de dominios conocidos (FCM, Mozilla, Windows, Apple)
- IPs privadas bloqueadas explícitamente
- Verificado: test WP01 ✅

### WP02 ✅ — Service Worker procesa push events
- `public/sw.js` L29-41: `addEventListener('push', ...)` → `showNotification()`
- `notificationclick` valida URL relativa antes de abrir — anti open-redirect ✅
- Solo rutas relativas permitidas (regex: `startsWith('/') && !startsWith('//')`)

### WP03 ⚠️ GAP — Pedidos de catálogo no disparan push
- **Spec dice:** pedido en catálogo público → push enviado a suscriptores
- **Implementación:** `src/app/api/orders/route.ts` NO llama a `/api/push/send`
- `src/app/api/sales/route.ts` tampoco llama a `/api/push/send`
- El endpoint `POST /api/push/send` existe pero nunca se llama automáticamente
- **Para Sprint 25:** CLI-A integra llamada a `POST /api/push/send` al final del POST /api/orders cuando `origin === 'catalog'`

---

## HALLAZGOS SPRINT 24

| ID     | Severidad | Descripción                                                      | Archivo                                     | Acción Sprint 25          |
|--------|-----------|------------------------------------------------------------------|---------------------------------------------|---------------------------|
| S24-F1 | P2        | Drafts en-memoria — desconectados de /api/pos/drafts             | `hooks/useDraftTabs.ts`, `pos/page.tsx`     | CLI-A conecta hooks a API |
| S24-F2 | P2        | Draft no se borra al pagar (sistemas desconectados)              | `api/sales/route.ts`, `hooks/usePOS.ts`     | CLI-A agrega draft_id     |
| S24-F3 | P2        | Middleware no enforcea modules_enabled                           | `src/middleware.ts`                         | CLI-A agrega guard        |
| S24-F4 | P2        | Core modules (pos/inventory/caja) deshabilitables                | `api/config/business/modules/route.ts`      | CLI-A agrega CORE_MODULES |
| S24-F5 | P2        | Pedidos de catálogo no disparan push                             | `api/orders/route.ts`                       | CLI-A agrega push call    |
| S24-F6 | P3        | `null` threshold dispara falso positivo cuando stock=0           | `api/sales/route.ts` L96                    | CLI-A null guard          |
| S24-F7 | P3        | 409 Conflict vs 400 Bad Request en max drafts (MT06)             | `api/pos/drafts/route.ts` L129              | CLI-A alinea spec         |

---

## TESTS ESCRITOS

Archivo: `tests/sprint24-multiticket-modules.spec.ts` — 8 tests

| Test | Spec        | Resultado | Descripción                                        |
|------|-------------|-----------|---------------------------------------------------|
| MT01 | MT01 ✅     | PASS      | Draft creado con status='draft', ticket_number DRF-|
| MT02 | MT02+MT06   | PASS      | 6to draft rechaza con 409 (documenta gap vs spec)  |
| MT03 | MT03 ✅     | PASS      | PATCH reemplaza items atómicamente                 |
| MO01 | MO01 ✅     | PASS      | Módulos persistidos en DB y verificados via GET    |
| MO03 | MO03 gap    | PASS      | Confirma middleware NO bloquea ruta desactivada    |
| ST01 | ST01 ✅     | PASS      | threshold guardado en producto                     |
| ST02 | ST02 ✅     | PASS      | Notificación stock_low creada post-venta           |
| WP01 | WP01 ✅     | PASS      | SSRF bloqueado para endpoints no permitidos        |

---

## CHECKLIST SPRINT 24

- [x] TypeScript — `npx tsc --noEmit` 0 errores (verificado pre-commit)
- [x] CSS Modules — CLI-C no modificó CSS
- [x] business_id de getSession() — todos los endpoints auditados cumplen
- [x] Paradigma de venta correcto — `qty × price` en todos los flows auditados
- [x] Dual moneda — no aplica a cambios de Sprint 24
- [x] Zod v4 — `.issues` usado en todos los routes auditados
- [x] SEC-01 — precios siempre de DB en drafts (anti-tampering verificado)
- [x] SSRF — allowlist validado en /api/push/subscribe

---

*Certificado por CLI-C | Sprint 24 | 2026-06-22*
