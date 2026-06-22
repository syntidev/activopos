# CERT_SPRINT25 — Certificación Sprint 25
**CLI-C | Fecha:** 2026-06-22
**Auditor:** CLI-C (Quality/Audit — solo reporta, corrige P0 únicamente)
**Sprint items auditados:** MT-FIX01-04, MO-FIX01-03, PU-FIX01-02, ST-FIX01, AD01-AD05

---

## RESULTADO GENERAL

| Área            | Spec        | ✅ Confirmado | ❌ No implementado | Nuevo hallazgo |
|-----------------|-------------|-------------|-------------------|----------------|
| Multi-ticket    | MT-FIX01-04 | 01 02 03 04 | —                 | S25-F1 (test S24 roto) |
| Módulos         | MO-FIX01-03 | 01 03       | 02                | S25-F2 (arch gap) |
| Push/Orders     | PU-FIX01-02 | 01          | 02                | — |
| Stock Threshold | ST-FIX01    | 01          | —                 | — |
| Admin           | AD01-AD05   | 01 02 03 05 | —                 | S25-F3 (detail page falta) |

**Estado:** APROBADO CON OBSERVACIONES — 2 fixes no implementados (MO-FIX02, PU-FIX02), 3 hallazgos P3. No hay P0.

---

## AUDITORÍA MULTI-TICKET

### MT-FIX01 ✅ — Draft persiste en DB al crear tab
- `useDraftTabs.ts` L140-172: `init()` fetcha `GET /api/pos/drafts`, restaura tabs desde DB en cada mount
- Implementación: `restored = drafts.map((d, i) => ({ id: String(d.id), label: ..., snapshot: draftToTicketState(...) }))`
- Verificado: test MT-FIX01+03 ✅

### MT-FIX02 ✅ — Draft eliminado de DB al pagar
- `useDraftTabs.ts` L234-255: `paymentComplete()` llama `deleteDraft(id)` → `DELETE /api/pos/drafts/{id}`
- `deleteDraft()` es fire-and-forget pero siempre se invoca antes de actualizar UI
- No verificado con test directo (requiere flujo de pago completo) — confirmado por lectura de código

### MT-FIX03 ✅ — Refresh del POS → tabs restaurados desde DB
- Mismo `init()` que MT-FIX01 — la inicialización siempre viene de DB
- Verificado: test MT-FIX01+03 ✅ (simula refresh con fresh GET /api/pos/drafts)

### MT-FIX04 ✅ — Max 5 drafts → 400 Bad Request (era 409)
- `api/pos/drafts/route.ts` L124: `// FIX 8: 409 → 400 — quota rejection is a client error`
- `if (err.message === 'MAX_DRAFTS') return ... { status: 400 }`
- Verificado: test MT-FIX04 ✅

### S25-F1 P3 — Test S24-MT02 roto por el fix (stale assertion)
- `tests/sprint24-multiticket-modules.spec.ts` L115: `expect(sixthRes.status()).toBe(409)`
- El fix MT-FIX04 cambió el status a 400 → test S24-MT02 ahora FALLA si se corre
- **Acción Sprint 26:** CLI-D actualiza S24-MT02 para esperar 400

---

## AUDITORÍA MÓDULOS

### MO-FIX01 ✅ — PATCH modules con core → 400
- `api/config/business/modules/route.ts` L12: `const CORE_MODULES = ['pos', 'caja', 'inventory'] as const`
- L28-34: `removing_core` calculado → si hay alguno, retorna 400 con mensaje explicativo
- Verificado: test MO-FIX01 ✅

### MO-FIX02 ❌ NO IMPLEMENTADO — Middleware no enforcea modules_enabled
- **Spec dice:** ruta de módulo desactivado → 404 o redirect
- **Middleware actual** (`src/middleware.ts`): solo verifica autenticación, ADMIN_ONLY, SUPER_ADMIN_ONLY, onboarding
- **No hay** lectura de `modules_enabled` en el middleware
- GET /api/orders con 'pedidos' desactivado retorna 200/400 (ruta accesible) — confirmado por test MO-FIX02 gap
- **Acción Sprint 26:** CLI-A agrega verificación DB de modules_enabled en middleware (o server action)

### MO-FIX03 ✅ (vía MO-FIX01) — Core siempre visible en sidebar
- `Sidebar.tsx` L174-177 filtra items por `enabledModules.includes(item.moduleKey)`
- Dado que MO-FIX01 impide desactivar pos/caja/inventory vía API, siempre están en `enabledModules`
- Protección es API-level, no sidebar-level — funcionalmente correcto

### S25-F2 P3 — Admin pages en /businesses y /stats, no bajo /admin/*
- Route group `(admin)` → URLs: `/businesses`, `/stats` (sin prefijo `/admin`)
- `middleware.ts` `SUPER_ADMIN_ONLY = ['/admin', '/api/admin']` NO protege estas rutas
- Protección es únicamente via `AdminLayout` server component L8: `redirect('/escritorio')`
- Riesgo: si el layout se refactoriza mal, el middleware no actúa como backstop
- **Acción Sprint 26:** Mover admin pages a `/admin/*` o añadir `/businesses` y `/stats` a `SUPER_ADMIN_ONLY`

---

## AUDITORÍA PUSH / ÓRDENES

### PU-FIX01 ✅ — Pedido catálogo → notificación order_new creada
- `api/orders/route.ts` L183-193: `if (data.origin === 'catalog') { void createNotification(..., 'order_new', ...) }`
- Notificación creada fire-and-forget con `.catch(() => {})`
- Verificado: test PU-FIX01 ✅ (count before/after confirma nueva notificación)

### PU-FIX02 ❌ NO IMPLEMENTADO — Push web NO enviado para pedidos de catálogo
- **Spec dice:** pedido en catálogo → push enviado a suscriptores
- `api/orders/route.ts` L183-193: solo llama `createNotification`, NO llama `POST /api/push/send`
- El endpoint `/api/push/send` existe pero nunca es invocado desde orders
- **Acción Sprint 26:** CLI-A integra `sendPush()` al final del POST /api/orders cuando `origin === 'catalog'`

---

## AUDITORÍA STOCK THRESHOLD

### ST-FIX01 ✅ — Threshold null/0 → no genera stock_low falso positivo
- `api/sales/route.ts` L98: `// FIX 6: threshold=0 means "disabled"`
- Condición: `if (p.stock_alert_threshold > 0 && net <= p.stock_alert_threshold)`
- `null > 0` → false | `0 > 0` → false — guard cubre ambos casos
- **Fix de S24:** era `if (net <= p.stock_alert_threshold)` → `null` coercía a 0, `0 <= 0 = true` (falso positivo)
- Verificado: test ST-FIX01 ✅ (threshold=0, venta pagada, sin nueva notificación stock_low)

---

## AUDITORÍA ADMIN MULTITENANT

### AD01 ✅ — /businesses accesible solo por super_admin
- `(admin)/layout.tsx` L8: `if (!session || session.role !== 'super_admin') redirect('/escritorio')`
- URL efectiva: `/businesses` (route group `(admin)` no agrega path segment)
- Verificado: test AD01 ✅ (admin → redirected to /escritorio or /onboarding)

### AD02 ✅ — /stats accesible solo por super_admin
- Mismo `AdminLayout` protege la página
- Muestra: total negocios, activos, ventas del mes, ventas históricas
- Queries cross-tenant (sin `business_id` filter) — correcto por diseño para super_admin
- Verificado: test AD02 ✅

### AD03 ✅ — Lista de negocios con Trial/Activo/Inactivo
- `(admin)/businesses/page.tsx` L23-28: `statusBadge()` calcula Trial (<14 días) | Activo | Inactivo
- Muestra: nombre, fecha de registro, estado, link "Ver →"
- No requiere test automatizado — confirmado por lectura de código

### AD04 ⚠️ — Detail page /admin/businesses/[id] linkeada pero no existe
- `(admin)/businesses/page.tsx` L66: `<Link href={`/admin/businesses/${b.id}`}>Ver →</Link>`
- **No existe** `(admin)/businesses/[id]/page.tsx` — el link retorna 404
- **Acción Sprint 26:** CLI-B crea página de detalle o cambia link a placeholder

### AD05 ✅ — JWT aísla tenants correctamente
- `api/pos/drafts/route.ts`, `api/orders/route.ts` etc.: todos usan `getSession()` → `business_id` y `cashier_id`
- Stats en `(admin)/stats` query cross-tenant intencionalmente (super_admin ve TODO el SaaS)
- No hay exposición de `business_id` ajeno en respuestas normales

---

## HALLAZGOS SPRINT 25

| ID     | Severidad | Descripción                                                         | Archivo                                     | Acción Sprint 26              |
|--------|-----------|---------------------------------------------------------------------|---------------------------------------------|-------------------------------|
| S25-F1 | P3        | Test S24-MT02 espera 409 pero fix cambió a 400 (assertion rota)     | `tests/sprint24-multiticket-modules.spec.ts` L115 | CLI-D actualiza assertion    |
| S25-F2 | P3        | Admin pages en /businesses /stats — middleware no las cubre como SUPER_ADMIN_ONLY | `src/middleware.ts`           | CLI-A agrega a SUPER_ADMIN_ONLY o rename rutas |
| S25-F3 | P3        | /admin/businesses/[id] linkeado pero página no existe (404)         | `(admin)/businesses/page.tsx` L66           | CLI-B crea detail page        |

**S24 gaps no resueltos en S25:**
- MO-FIX02 (S24-F3 P2) — middleware modules: deferred a Sprint 26
- PU-FIX02 (S24-F5 P2) — push catalog orders: deferred a Sprint 26

---

## TESTS ESCRITOS

Archivo: `tests/sprint25-fixes-admin.spec.ts` — 8 tests

| Test | Spec | Resultado | Descripción |
|------|------|-----------|-------------|
| MT-FIX04 | MT-FIX04 ✅ | PASS | 6to draft → 400 (fix: era 409 en S24) |
| MT-FIX01+03 | MT-FIX01+03 ✅ | PASS | Draft persiste en DB, GET lo lista en fresh request |
| MO-FIX01 | MO-FIX01 ✅ | PASS | PATCH módulos omitiendo core → 400 |
| MO-FIX02 gap | MO-FIX02 ❌ | PASS | Documenta gap: ruta desactivada sigue accesible |
| PU-FIX01 | PU-FIX01 ✅ | PASS | Pedido catálogo → notificación order_new creada |
| ST-FIX01 | ST-FIX01 ✅ | PASS | Threshold 0 → sin stock_low falso (null guard) |
| AD01 | AD01 ✅ | PASS | /businesses → redirect para rol admin |
| AD02 | AD02 ✅ | PASS | /stats → redirect para rol admin |

**Resultado final: 8/8 PASS (25.4s)**

---

## CHECKLIST SPRINT 25

- [x] TypeScript — `npx tsc --noEmit` 0 errores (verificado pre-sesión)
- [x] CSS Modules — CLI-C no modificó CSS
- [x] business_id de getSession() — todos los endpoints auditados cumplen
- [x] Paradigma de venta correcto — `qty × price` verificado en drafts y sales
- [x] Dual moneda — no aplica a cambios de CLI-C
- [x] Zod v4 — `.issues` usado en todos los routes auditados
- [x] SEC-01 — precios de DB en drafts/orders (anti-tampering verificado)
- [x] SEC-02 — admin panel protegido por server-side layout check (super_admin only)
- [x] Cero fachadas — notificaciones y drafts tienen implementación real

---

*Certificado por CLI-C | Sprint 25 | 2026-06-22*
