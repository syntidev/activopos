# HANDOFF — Sprint 14 → Sprint 15
# ActivoPOS | 2026-06-19
# Entregado por: CLI-A + CLI-B + CLI-C + CLI-D (Sprint 14 completo)

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
npm run dev
# Esperar "Ready on http://localhost:3000"
curl http://localhost:3000/api/rates/bcv
# Esperado: {"rate":607.xx,"source":"bcv","ok":true}
```

Verificar tests antes de tocar código:
```bash
npx playwright test --reporter=list
# Esperado: 38/38 pasando
```

---

## QUÉ SE COMPLETÓ EN SPRINT 14

### Analytics — Pulso del Negocio (AN01-AN05 ✅)
- **Ruta:** `/analytics` — admin/super_admin only (middleware ADMIN_ONLY)
- **KPI grid:** Ventas USD+Bs, Tickets, Ticket promedio, Items vendidos, vs período anterior
- **Trends chart:** Recharts LineChart — 12 períodos (week/month/quarter)
- **Top productos:** tabla con qty_sold DESC + tendencia up/down/stable
- **Por método de pago:** breakdown con barra de progreso + porcentajes
- **Insights:** mejor día y mejor hora del período
- **Tabs:** Semana / Mes / Trimestre — recarga automática al cambiar

### DT-004 PWA completado
- `public/sw.js` — Service Worker Network First + cache estático + offline fallback
- `public/offline.html` — página offline con brand colors
- `public/manifest.json` + `public/icons/*` — creados por CLI-B (8 íconos)
- `src/app/layout.tsx` — registro SW via inline script en `<body>`
- `src/app/layout.tsx` — metadata: `manifest`, `appleWebApp`, `icons`

### DTs resueltas Sprint 14
| ID     | Sev | Descripción                                                     |
|--------|-----|-----------------------------------------------------------------|
| DT-032 | P1  | quickToggle catálogo sin try/catch                              |
| DT-033 | P1  | bulkUpdate catálogo sin await load() post-update               |
| DT-034 | P2  | metrics ?? 'visible' — valor default incorrecto                 |
| DT-035 | P2  | ingresos double-count incluía abonos                            |
| DT-036 | P3  | catalog_url hardcodeada → usa NEXT_PUBLIC_APP_URL               |
| DT-004 | P2  | Service Worker / PWA — implementado                             |

### Fixes de test infrastructure (CLI-D)
- ✅ `finanzas-core.spec.ts` F05 → usa `playwright.request.newContext()` (rate limit fix)
- ✅ `analytics-core.spec.ts` AN05 → API login + cookie transfer al browser context
- ✅ `analytics-core.spec.ts` AN05 → evita misma trampa de rate limit que F05
- ✅ 38/38 tests pasando — cero regresiones

### Tests anteriores — cero regresiones
- pos-core: 6/6 ✅
- caja-core: 5/5 ✅
- reportes-core: 5/5 ✅
- finanzas-core: 5/5 ✅
- services-and-catalog: 7/7 ✅
- catalogo-admin: 5/5 ✅
- analytics-core: 5/5 ✅

---

## ESTADO DEL CORE — COMPLETADO

```
Productos ✅ → POS ✅ → Caja ✅ → Reportes ✅ →
Finanzas ✅ → Catálogo ✅ → Analytics ✅
```

**Todos los módulos del roadmap v1 están certificados con E2E.**

---

## SPRINT 15 — PREPARACIÓN PARA PRIMER CLIENTE

### Prioridad 1: DT-023 — Expense Categories

El módulo de finanzas usa `category` como texto libre → normalización imposible.
**Schema documentado en `.doc/DT-023-EXPENSE-CATEGORIES.md`.**

**Scope:**
- Migración Prisma: tabla `expense_categories` + FK en `gastos`
- Seed de 6 categorías de sistema
- API: GET/POST `/api/finanzas/categorias`, PATCH `/api/finanzas/categorias/[id]`
- UI: modal de gastos → select (no input libre)
- Certificación: EX01-EX04

### Prioridad 2: Onboarding sin tocar código

Hoy el primer negocio activa via `npx prisma db seed` — no apto para clientes.

**Scope:**
- `/onboarding` completo: nombre negocio → categorías → primer producto → cajero
- `POST /api/onboarding/setup` — crea negocio + admin en transaction
- Sin acceso a DB, sin terminal, sin `.env`

### Prioridad 3: DTs pendientes

| ID     | Sev | Descripción                          | CLI   |
|--------|-----|--------------------------------------|-------|
| DT-020 | P3  | Export Excel en reportes             | CLI-B |
| DT-021 | P2  | Export Excel en finanzas             | CLI-B |
| DT-014 | P2  | lib/bcv.ts cache no cluster-safe     | CLI-A |
| DT-026 | P3  | regex diacríticos en r/[token]       | CLI-A |
| DT-019 | P3  | WhatsApp automático Meta API         | Backlog|

### Prioridad 4: Admin multitenant

- `admin.activopos.com` — panel para Carlos
- Territorio exclusivo de Opus, sesión completamente aislada
- Ver tenants, plans, activar/desactivar negocios

---

## DATOS DE PRUEBA — DB LOCAL

| Entidad           | Datos seed                                                  |
|-------------------|-------------------------------------------------------------|
| Business          | "Tienda Demo" — slug: demo — catalog: activo               |
| Admin user        | admin@activopos.com / admin123                              |
| Cashier user      | cajero@activopos.com / cajero123                           |
| Producto servicio | id=18 "Corte de Cabello" — sale_mode=service               |
| Producto con stock| id=10 "Arepa con Pollo" — stock calculado de inventory      |
| Ventas totales    | > 7 ventas pagadas (cada run de T05 agrega 1)              |
| Órdenes catálogo  | ≥ 1 orden creada por CA05 (Test CA05 CLI-D)                |

---

## NOTAS TÉCNICAS PARA SPRINT 15

### Rate limiter en tests
El rate limiter tiene 5 intentos/IP/15min en memoria. Tests que necesiten login de
cajero deben usar `playwright.request.newContext()` + `apiCtx.storageState()` para
transferir cookie al browser context — NO formulario de login.
Ver F05 y AN05 como patrón de referencia.

### workers: 1 en playwright.config.ts
Tests tienen dependencias de estado (caja open/closed). No cambiar sin analizar.

### Auth token
El token de `tests/.auth-state.json` expira en ~8h. Refrescar con:
```bash
curl -s -c /tmp/cookies.txt -b /tmp/cookies.txt \
  -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@activopos.com","password":"admin123"}'
```

### PWA en producción
El SW se registra en el primer load. En dev (Next.js), el SW puede interferir con
hot reload. Si hay issues en dev, desregistrar en DevTools → Application → SW.
En producción (PM2 + Nginx) no hay conflicto.

---

## ARCHIVOS CRÍTICOS PARA SPRINT 15

```
src/app/(dashboard)/onboarding/page.tsx     ← completar flujo onboarding
src/app/api/onboarding/                     ← setup route + complete
src/app/api/finanzas/categorias/            ← crear routes (CLI-A)
prisma/migrations/                          ← DT-023 migration
tests/onboarding.spec.ts                    ← certificación onboarding (CLI-D)
.doc/SYSTEM_MAP.md                          ← actualizar a v15 al cerrar sprint
```

---

*Generado: 2026-06-19 | HEAD: post Sprint 14 | Entregado por: CLI-D Sprint 14*
*Regla del Policía: CORE COMPLETADO — siguiente fase: producción con primer cliente*
