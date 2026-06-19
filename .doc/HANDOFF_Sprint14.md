# HANDOFF — Sprint 13 → Sprint 14
# ActivoPOS | 2026-06-19
# Entregado por: CLI-A + CLI-B + CLI-C + CLI-D (Sprint 13 completo)

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
# Esperado: 33/33 pasando
```

---

## QUÉ SE COMPLETÓ EN SPRINT 13

### Certificación E2E (33 tests totales)
- ✅ **Catálogo admin** — CA01-CA05: métricas, QR, bulk toggle, link preview, orders

### Módulo Catálogo Digital (admin)
- **Ruta:** `/catalogo-digital` — (CLI-B nombró así para evitar conflicto con `/catalogo/[slug]`)
- **KPI row:** pedidos mes, visibles, ocultos, consultar — datos reales de la DB
- **QR card:** imagen via Google Charts API + botón "Descargar QR" (download real)
- **Top productos:** tabla con checkbox, badge de visibilidad, toggle rápido por fila
- **Bulk bar:** aparece al seleccionar → botones Publicar / Ocultar / Consultar
- **Link "Ver catálogo":** abre `/catalogo/[slug]` en nueva pestaña
- **Sidebar:** entrada "Catálogo Digital" con icono Store (adminOnly)

### Endpoints creados Sprint 13
- ✅ `GET /api/catalogo/metrics` — views: null (sin fachada, no hay tabla de tracking)
- ✅ `PATCH /api/products/bulk-visibility` — max 50 IDs, business_id guard anti-IDOR

### DTs resueltas Sprint 13
| ID     | Sev | Descripción                                                     |
|--------|-----|-----------------------------------------------------------------|
| DT-024 | P1  | Infinity% en ResumenSection — safePct() + sin_margen detectado |
| DT-025 | P2  | punto-equilibrio PE=0 con gastos=0 — early return correcto      |
| DT-027 | P2  | gastos concepto vacío con espacios — .trim().min(3)             |
| DT-028 | P2  | egresos.total_usd excluía cuentas_pagadas                       |
| DT-029 | P2  | rate de gastos/resumen → readCachedBcvRate() (no raw SQL)       |
| DT-031 | P2  | parsePeriod() DRY en lib/finanzas.ts — 3 copias inline → 1     |

### Fixes de test infrastructure (CLI-D)
- ✅ `playwright.config.ts` → `workers: 1` — eliminada race condition entre archivos
- ✅ `caja-core.spec.ts` afterAll → usa `storageState: 'tests/.auth-state.json'`
- ✅ `services-and-catalog.spec.ts` S01 → timeout 6s (estable en suite completa)
- ✅ `DT-023-EXPENSE-CATEGORIES.md` — schema diseñado, implementación Sprint 15

### Tests anteriores — cero regresiones
- pos-core: 6/6 ✅
- caja-core: 5/5 ✅
- reportes-core: 5/5 ✅
- finanzas-core: 5/5 ✅
- services-and-catalog: 7/7 ✅
- catalogo-admin: 5/5 ✅

---

## SPRINT 14 — PRIORIDAD 1: Analytics

**Regla del Policía: Catálogo ✅ → Analytics ⏳**

Analytics es el módulo que sigue. No hay bloqueantes conocidos.

### Qué construir

```
Dashboard Analytics (/analytics o dentro de /escritorio):
  KPIs de largo plazo:
    - Ventas por período (semana / mes / trimestre)
    - Productos más vendidos (histórico, no solo órdenes catálogo)
    - Comparativo vs período anterior
    - Tendencia de crecimiento (línea temporal)
    - Ticket promedio (sale_items / sale_count)
    - Mejor día/hora de ventas

  Filtros:
    - Rango de fechas (picker)
    - Categoría de producto
    - Método de pago
```

### Flujo de certificación (CLI-D Sprint 14)
```
AN01 — KPIs de ventas cargan con datos reales (> $0 en períodos pasados)
AN02 — Top productos ordenados por qty correctamente
AN03 — Comparativo período anterior muestra variación correcta
AN04 — Filtro por fecha restringe los datos mostrados
AN05 — Role guard: cashier no accede a /analytics
```

### Archivos a crear / modificar
```
src/app/(dashboard)/analytics/page.tsx       ← Nueva vista (CLI-B)
src/app/api/analytics/summary/route.ts       ← KPIs históricos (CLI-A)
src/app/api/analytics/top-products/route.ts  ← Top por qty (CLI-A)
src/app/api/analytics/trends/route.ts        ← Tendencia temporal (CLI-A)
tests/analytics-core.spec.ts                 ← E2E (CLI-D Sprint 14)
```

---

## SPRINT 14 — PRIORIDAD 2: DT pendientes

| ID     | Sev | Descripción                                     | CLI   |
|--------|-----|-------------------------------------------------|-------|
| DT-020 | P3  | Export Excel en reportes                        | CLI-B |
| DT-021 | P2  | Export Excel en finanzas                        | CLI-B |
| DT-014 | P2  | lib/bcv.ts cache no cluster-safe                | CLI-A |
| DT-004 | P2  | Service Worker / PWA ausente                    | CLI-D |
| DT-026 | P3  | regex diacríticos en r/[token]/route.ts         | CLI-A |

---

## SPRINT 14 — PRIORIDAD 3: Features y backlog

- **DT-023** — Expense Categories: evaluar al final del sprint, implementar en 15
- **n8n endpoints** — mark-pending, pending, mark-notified (ver N8N_MONTHLY_REPORT_WORKFLOW.md)
- **Onboarding completo** — primer negocio activa sin tocar código
- **Admin multitenant** — `admin.activopos.com` — Opus, sesión completamente aislada

---

## REGLA DEL POLICÍA — ESTADO ACTUAL

```
Productos ✅ → POS ✅ → Caja ✅ → Reportes ✅ → Finanzas ✅ → Catálogo ✅ → Analytics ⏳
```

**Analytics es el próximo. Sin bloqueantes.**

---

## DATOS DE PRUEBA — DB LOCAL

| Entidad           | Datos seed                                                  |
|-------------------|-------------------------------------------------------------|
| Business          | "Tienda Demo" — slug: demo — catalog: activo               |
| Admin user        | admin@activopos.com / admin123                              |
| Cashier user      | cajero@activopos.com / cajero123                           |
| Producto servicio | id=18 "Corte de Cabello" — sale_mode=service               |
| Producto con stock| id=10 "Arepa con Pollo" — stock calculado de inventory      |
| Órdenes catálogo  | ≥ 1 orden creada por CA05 (Test CA05 CLI-D)                |
| Ventas totales    | > 5 ventas pagadas — KPIs reflejan > $38.50                |

---

## NOTAS TÉCNICAS PARA SPRINT 14

### Catalogo admin — cosas que NO existen aún
- Sin tabla de tracking de vistas (`views: null` en metrics) — DT-030 backlog
- `/api/reports/monthly/mark-pending`, `/pending`, `/mark-notified` — pendientes n8n Sprint 13

### workers: 1 en playwright.config.ts
Los tests tienen dependencias de estado (caja open/closed entre suites). `workers: 1` garantiza ejecución serial y reproducibilidad. No cambiar sin analizar las dependencias de estado.

### Auth token refresh
El token de `tests/.auth-state.json` expira en ~8h. Refrescar con:
```bash
curl -s -c /tmp/cookies.txt -b /tmp/cookies.txt \
  -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@activopos.com","password":"admin123"}'
# Luego actualizar tests/.auth-state.json con el nuevo cookie activopos_session
```

---

## ARCHIVOS CRÍTICOS PARA SPRINT 14

```
src/app/(dashboard)/analytics/      ← crear directorio y page.tsx
src/app/api/analytics/              ← crear routes summary, top-products, trends
tests/analytics-core.spec.ts        ← crear certificación AN01-AN05
.doc/SYSTEM_MAP.md                  ← actualizar a v14 al cerrar sprint
```

---

*Generado: 2026-06-19 | HEAD: por confirmar post-commit | Entregado por: CLI-D Sprint 13*
