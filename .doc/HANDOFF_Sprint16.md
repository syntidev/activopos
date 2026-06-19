# HANDOFF — Sprint 15 → Sprint 16
# ActivoPOS | 2026-06-19
# Entregado por: CLI-A + CLI-B + CLI-C + CLI-D (Sprint 15 completo)

---

## ANTES DE HACER CUALQUIER COSA

Lee estos archivos en este orden:
```
1. CLAUDE.md (raíz)
2. .doc/SYSTEM_MAP.md
3. .doc/ACTIVOPOS_MASTER_V2.md
4. .doc/AGENTS.md
```

## INICIO DE SESIÓN — SIEMPRE

```powershell
Remove-Item -Recurse -Force .next
npx prisma generate   # CRÍTICO — hay nuevos modelos en Sprint 15
npm run dev
# Esperar "Ready on http://localhost:3000"
curl http://localhost:3000/api/rates/bcv
# Esperado: {"rate":607.xx,"source":"bcv","ok":true}
```

Verificar tests antes de tocar código:
```bash
npx playwright test --reporter=list
# Esperado: 47/47 pasando
```

**IMPORTANTE — auth token expira en 8h:**
Si los tests fallan en masa (33+ failing), el JWT expiró. Refrescarlo:
```powershell
$r = Invoke-WebRequest -Uri "http://localhost:3000/api/auth/login" -Method POST -ContentType "application/json" -Body '{"email":"admin@activopos.com","password":"admin123"}' -UseBasicParsing
# Copiar el nuevo token del header Set-Cookie → actualizar tests/.auth-state.json
```
O usar el script de refresh del HANDOFF_Sprint15.md (curl bash).

---

## QUÉ SE COMPLETÓ EN SPRINT 15

### Cotizaciones (Q01-Q02 ✅)
- **Ruta:** `/cotizaciones` — admin/super_admin only (middleware ADMIN_ONLY)
- **API:** `GET/POST /api/quotations`, `GET/PATCH /api/quotations/[id]`, `GET /api/quotations/[id]/pdf`
- **Número:** formato `QUO-YYYY-NNNN` (ej: QUO-2026-0001)
- **Catálogo digital:** modal de cotización integrado en POS (CLI-B Sprint 15)

### Devoluciones (R01-R02 ✅)
- **Ruta:** `/devoluciones` — admin/super_admin only
- **API:** `POST /api/returns` — valida qty vendida vs ya devuelta, restaura stock
- **Seguridad P1:** cashier guard en returns (82ef219)
- **Seguridad P1:** users/[id] IDOR fix (82ef219)

### Usuarios (U01 ✅)
- **Ruta:** `/usuarios` — admin/super_admin only
- **API:** `GET/POST /api/users`, `PATCH/DELETE /api/users/[id]`
- **UI completa:** lista con avatares, modal crear cajero, modal editar, eliminar con confirm()
- **Restricción:** max 5 cajeros, password min 6 chars, anti-escalada reset-pin

### DT-023 — Expense Categories (EX01-EX04 ✅)
- **Migración:** `expense_categories` table + `category_id` FK nullable en `gastos`
- **Seed:** 6 categorías de sistema (Alquiler, Servicios públicos, Nómina, Insumos, Marketing, Otros)
- **API:** `GET/POST /api/finanzas/categorias`, `PATCH /api/finanzas/categorias/[id]`
- **Gastos POST:** acepta `expense_category_id` opcional
- **Pendiente CLI-B:** modal de gastos → `<select>` (actualmente sigue siendo `<input text>`)

### Layout sweep (CLI-B Sprint 15)
- `src/styles/globals.css` → `.page-container` (max-width:1200px)
- cotizaciones + devoluciones page-container aplicado
- Usuarios UI completamente reescrita

### Catálogo público rediseñado (CLI-B Sprint 15)
- Mobile-first 2026, hero banner + gradiente
- C02 test actualizado: badge ahora muestra "N uds." para stock > 5

### Seguridad Sprint 15 (CLI-A)
- P1: `/api/returns` → cashier guard
- P1: `users/[id]` PATCH/DELETE → business_id en WHERE (anti-IDOR)
- P2: ADMIN_ONLY ampliado → cotizaciones, devoluciones, usuarios, api/returns, api/users
- P2: `onboardingCompleted` en JWT payload (SessionPayload)

### Tests anteriores — cero regresiones
- pos-core: 6/6 ✅
- caja-core: 5/5 ✅
- reportes-core: 5/5 ✅
- finanzas-core: 5/5 ✅
- services-and-catalog: 7/7 ✅ (C02 regex actualizado: `/disponibles|Últimas|\d+ uds\./i`)
- catalogo-admin: 5/5 ✅
- analytics-core: 5/5 ✅
- sprint15-core: 5/5 ✅
- expense-categories: 4/4 ✅

---

## ESTADO DEL CORE — COMPLETADO + SPRINT 15

```
Productos ✅ → POS ✅ → Caja ✅ → Reportes ✅ →
Finanzas ✅ → Catálogo ✅ → Analytics ✅ →
Cotizaciones ✅ → Devoluciones ✅ → Usuarios ✅ → Expense Categories ✅
```

**47/47 tests E2E certificados.**

---

## SPRINT 16 — PRIORIDADES

### Prioridad 1: Onboarding sin tocar código

Hoy el primer negocio activa via `npx prisma db seed` — no apto para clientes reales.

**Scope:**
- `/onboarding` flujo completo: nombre negocio → categorías → primer producto → cajero
- `POST /api/onboarding/setup` — crea negocio + admin en transaction
- Sin acceso a DB, sin terminal, sin `.env`
- Certificación: ON01-ON04

**Estado actual:** Existe `/onboarding` route placeholder, sin implementación.

### Prioridad 2: UI de Expense Categories (DT-023 pendiente CLI-B)

El backend de DT-023 está completo (EX01-EX04 certificados).
Falta el frontend:
- Modal de gastos en `/finanzas` → cambiar `<input text>` por `<select>` que cargue `/api/finanzas/categorias`
- Pantalla de gestión en `/configuracion` o `/finanzas` → listado + crear + editar + desactivar
- Certificación: EX05-EX06 (UI tests)

### Prioridad 3: DTs pendientes

| ID     | Sev | Descripción                          | CLI   |
|--------|-----|--------------------------------------|-------|
| DT-020 | P3  | Export Excel en reportes             | CLI-B |
| DT-021 | P2  | Export Excel en finanzas             | CLI-B |
| DT-014 | P2  | lib/bcv.ts cache no cluster-safe     | CLI-A |
| DT-026 | P3  | regex diacríticos en r/[token]       | CLI-A |

### Prioridad 4: Admin multitenant

- `admin.activopos.com` — panel para Carlos
- Ver tenants, plans, activar/desactivar negocios
- Territorio exclusivo de Opus, sesión completamente aislada

---

## NOTAS TÉCNICAS PARA SPRINT 16

### Prisma generate obligatorio
Sprint 15 añadió modelos `ExpenseCategory`, `Quotation`, `QuotationItem`, `Return`, `ReturnItem`.
Al iniciar Sprint 16 en un entorno fresco: `npx prisma generate` ANTES de `npm run dev`.

### Auth token — refresh workflow
El JWT en `tests/.auth-state.json` expira en 8h.
Token actual expira: `2026-06-20T02:03:08 UTC`.
Si los tests fallan en masa al iniciar Sprint 16, refrescar el token (ver sección INICIO).

### Expense Categories — constraint "Otros"
`PATCH /api/finanzas/categorias/[id]` con `active: false` en categoría `Otros` → 409.
Protección en el servidor: `if (body.active === false && existing.is_system && existing.name === 'Otros')`.

### Rate limiter en tests de cashier
Tests F05 y AN05 usan `playwright.request.newContext()` para evitar rate limit.
Ver F05 y AN05 como patrón de referencia para cualquier test de cashier nuevo.

---

## DATOS DE PRUEBA — DB LOCAL

| Entidad           | Datos seed                                                    |
|-------------------|---------------------------------------------------------------|
| Business          | "Mi Negocio Demo" — slug: demo — catalog: activo             |
| Admin user        | admin@activopos.com / admin123                                |
| Cashier user      | cajero@activopos.com / cajero123                             |
| Expense Categories| 6 de sistema: Alquiler, Servicios públicos, Nómina, Insumos, Marketing, Otros |
| Producto servicio | id=18 "Corte de Cabello" — sale_mode=service                 |
| Producto con stock| id=10 "Arepa con Pollo" — stock ~30+                         |
| Ventas totales    | > 8 ventas pagadas (cada run de T05 agrega 1)                |

---

## ARCHIVOS CRÍTICOS PARA SPRINT 16

```
src/app/(dashboard)/onboarding/page.tsx     ← completar flujo onboarding
src/app/api/onboarding/                     ← setup route
src/app/(dashboard)/finanzas/               ← modal gastos → select (CLI-B)
tests/onboarding.spec.ts                    ← certificación ON01-ON04 (CLI-D)
.doc/SYSTEM_MAP.md                          ← actualizar a v16 al cerrar sprint
```

---

*Generado: 2026-06-19 | HEAD: post Sprint 15 | Entregado por: CLI-D Sprint 15*
*47/47 tests E2E — CORE + Sprint 15 certificado*
