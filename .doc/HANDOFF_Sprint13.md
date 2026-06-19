# HANDOFF — Sprint 12 → Sprint 13
# ActivoPOS | 2026-06-19
# Entregado por: CLI-B + CLI-C (Sprint 12)

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
```

Verificar tests antes de tocar código:
```bash
npx playwright test --reporter=list
# Esperado: 28/28 pasando
```

---

## QUÉ SE COMPLETÓ EN SPRINT 12

### Certificación E2E (28 tests totales)
- ✅ **Finanzas** — F01-F05: P&L resumen, Punto de Equilibrio, gastos CRUD, CxC pendientes, role guard cashier→403

### Módulo Finanzas — lo que se construyó
- **UI rediseñada** — P&L con tarjetas de resumen, tabla período, gráfico tendencia
- **Punto de Equilibrio** — cálculo dinámico con proyección a fin de mes
- **CxC** — clientes con saldo pendiente + días restantes para cobro
- **CxP** — pagos programados con estado (pendiente/pagado/vencido)
- **Gastos** — CRUD con categorías, modal de alta, filtros por fecha
- **Role guard** — cashier recibe 403 en todos los endpoints de `/api/finanzas/*`

### DT resueltas Sprint 12
- DT-P1-B: Content-Disposition injection sanitizado en descarga de PDFs
- DT-P1-A: mark-pending downgrade verificado — no regresiona reportes existentes

### Tests anteriores — cero regresiones
- pos-core: 6/6 ✅
- services-and-catalog: 7/7 ✅
- caja-core: 5/5 ✅
- reportes-core: 5/5 ✅
- finanzas-core: 5/5 ✅

---

## SPRINT 13 — PRIORIDAD 1: Catálogo admin

**Regla del Policía: Finanzas ✅ → Catálogo ⏳ → Analytics**

El catálogo público (`/catalogo/[slug]`) ya está construido y certificado.
Lo que falta es el **panel admin** con visibilidad de métricas y gestión masiva.

### Qué construir

**Vista admin del catálogo** (dentro de `/productos` o nueva ruta `/catalogo/admin`):
```
Métricas:
  - Vistas del catálogo (contador por slug)
  - Pedidos recibidos este mes (desde tabla orders)
  - Producto más visto / más pedido

Gestión:
  - QR descargable por negocio (link a /catalogo/[slug])
  - Toggle publicar/despublicar productos masivo (multi-select + PATCH)
  - Preview del catálogo desde el admin
```

### Flujo de certificación (CLI-D Sprint 13)
```
CA01 — Vista admin carga con métricas reales (≥ 1 pedido registrado)
CA02 — QR se puede descargar como imagen
CA03 — Toggle masivo: 3 productos → publish=false → desaparecen del catálogo público
CA04 — Preview abre /catalogo/[slug] en nueva pestaña con slug correcto
CA05 — Métricas: pedidos del mes > 0 tras crear orden en catálogo
```

### Archivos a crear / modificar
```
src/app/(dashboard)/catalogo/admin/page.tsx    ← Nueva vista (CLI-B)
src/app/api/catalogo/metrics/route.ts          ← GET métricas (CLI-A)
src/app/api/products/bulk-visibility/route.ts  ← PATCH masivo (CLI-A)
tests/catalogo-admin.spec.ts                   ← E2E (CLI-D Sprint 13)
```

---

## SPRINT 13 — PRIORIDAD 2: DT pendientes

| ID     | Sev | Descripción                                     | CLI   |
|--------|-----|-------------------------------------------------|-------|
| DT-020 | P3  | Export Excel reportes                           | CLI-B |
| DT-021 | P2  | Export Excel finanzas                           | CLI-B |
| DT-019 | P3  | WhatsApp automático — Meta API (ver n8n doc)    | CLI-A |
| DT-004 | P2  | Service Worker PWA                              | CLI-D |
| DT-014 | P2  | lib/bcv.ts cache no cluster-safe                | CLI-A |

---

## SPRINT 13 — PRIORIDAD 3: Features

- **Onboarding completo** — primer negocio activa sin tocar código
- **Admin multitenant** — `admin.activopos.com` — Opus, sesión aislada
- **Gastos recurrentes** — DT-022 backlog, evaluar en Sprint 14

---

## REGLA DEL POLICÍA — ESTADO ACTUAL

```
Productos ✅ → POS ✅ → Caja ✅ → Reportes ✅ → Finanzas ✅ → Catálogo ⏳ → Analytics
```

Catálogo (admin) es el próximo. Sin bloqueantes conocidos.

---

## DATOS DE PRUEBA — DB LOCAL

| Entidad           | Datos seed                                             |
|-------------------|--------------------------------------------------------|
| Business          | "Tienda Demo" — slug: demo — catalog: activo          |
| Admin user        | admin@activopos.com / admin123                        |
| Cashier user      | cajero@activopos.com / cajero123 (ver seed.ts)        |
| Producto servicio | id=18 "Corte de Cabello" — sale_mode=service           |
| Producto con stock| id=10 "Arepa con Pollo" — ~47 unidades                 |
| Ventas del día    | 3+ ventas pagadas — KPIs dashboard muestran > $17     |

---

## ARCHIVOS CRÍTICOS PARA SPRINT 13

```
src/app/(dashboard)/catalogo/         ← crear directorio admin
src/app/api/catalogo/metrics/         ← nueva route
src/app/api/products/bulk-visibility/ ← nueva route
src/app/(dashboard)/productos/page.tsx ← posible punto de entrada toggle masivo
src/app/catalogo/[slug]/page.tsx       ← ya certificado, no tocar sin necesidad
tests/catalogo-admin.spec.ts           ← crear
```

---

*Generado: 2026-06-19 | HEAD: 9bbf473 | Entregado por: CLI-D*
