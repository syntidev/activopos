# HANDOFF — Sprint 18 → Sprint 19
# ActivoPOS | 2026-06-21
# Entregado por: CLI-A + CLI-B + CLI-C + CLI-D (Sprint 18 completo)

---

## ANTES DE HACER CUALQUIER COSA

Lee estos archivos en este orden:
```
1. CLAUDE.md (raíz)
2. .doc/SYSTEM_MAP.md          ← v18, actualizado hoy
3. .doc/ACTIVOPOS_MASTER_V2.md
4. .doc/AGENTS.md
```

## INICIO DE SESIÓN — SIEMPRE

```powershell
.\r.ps1
# Esperar "Ready on http://localhost:3000"
curl http://localhost:3000/api/rates/bcv
# Esperado: {"rate":607.xx,"source":"bcv","ok":true}
```

Verificar tests antes de tocar código:
```bash
npx playwright test --reporter=list
# Esperado: 62/62 pasando
```

**CRÍTICO — auth token expira en 8h:**
Si los tests fallan en masa con HTML en lugar de JSON, el JWT expiró.
Ver sección de refresh en HANDOFF_Sprint17.md.

---

## QUÉ SE COMPLETÓ EN SPRINT 18

### Mobile POS (CLI-B ✅)
- **Drawer lateral:** `cartToggle` FAB visible en mobile (viewport ≤768px)
- **Sin overflow:** productos ocupan toda la pantalla en mobile, drawer en `translateX(100%)` por defecto
- **FAB badge:** `cartBadge` muestra count cuando hay ítems en el ticket
- **MO03:** `cartSlotOpen` class aplicada al abrir drawer → `translateX(0)`
- **Escritorio responsive:** sin overflow horizontal en 390px (MO04)

### Export Excel (CLI-A + CLI-B ✅)
- **DT-020:** `GET /api/reports/export-excel?date=YYYY-MM-DD` → xlsx con ventas del día
- **DT-021:** `GET /api/finanzas/export-excel` → xlsx con gastos/CxP
- **UI:** botón "Exportar Excel" visible en `/reportes` y `/finanzas`
- **Content-Type:** `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- **Librería:** `xlsx` (SheetJS Community Edition) — ya en `package.json`

### DT-014 BCV cluster-safe (CLI-A ✅)
- `lib/bcv.ts` refactorizado: cache en memoria → lookup DB via tabla `dollar_rates`
- PM2 multi-worker safe: todos los procesos leen/escriben la misma DB
- TTL de 5 minutos implementado con `updatedAt` timestamp

### DT-038 slug @unique (CLI-A ✅)
- `businesses.catalog_slug` tiene constraint `@unique` en schema
- Migración: `20260621000001_add_unique_catalog_slug_business`
- Previene TOCTOU race condition en onboarding concurrent setup

### Tests — 62/62 sin regresiones
- `sprint18-mobile.spec.ts` — MO01-MO05 todos verdes
- `sprint17-visual.spec.ts` ES02 — selector corregido: `"Ítems vendidos"` → `"Utilidad neta"` (commit 15b2a04)

---

## ESTADO DEL CORE — COMPLETADO + SPRINT 18

```
Productos ✅ → POS ✅ → Caja ✅ → Reportes ✅ →
Finanzas ✅ → Catálogo ✅ → Analytics ✅ →
Cotizaciones ✅ → Devoluciones ✅ → Usuarios ✅ →
Expense Categories ✅ → Onboarding ✅ →
Tokens v3.0 ✅ → Escritorio v3.0 ✅ →
Mobile POS ✅ → Export Excel ✅
```

**62/62 tests E2E certificados.**

---

## SPRINT 19 — PRIORIDADES

### Prioridad 1: Módulo Fábrica

Productos compuestos con receta (ingredientes → producto terminado).
- Producto `product_type = 'fabricable'`
- Tabla `recipes` con ingredientes y cantidades
- Al vender: descontar stock de ingredientes, no del fabricable
- UI: botón "Fabricar" en /productos para producción manual

### Prioridad 2: Venta por peso/gramaje en POS

- `sale_mode = 'weight'` ya existe en enum
- POS actualmente solo maneja `unit` en el input de cantidad
- Sprint 19: input decimal para weight, teclado numérico con coma

### Prioridad 3: Import masivo productos Excel

| ID     | Sev | Descripción                              | CLI   |
|--------|-----|------------------------------------------|-------|
| DT-042 | P3  | Import Excel /productos — bulk create    | CLI-A |

- Endpoint `POST /api/products/import-excel` (xlsx → products)
- Template descargable con columnas requeridas
- CLI-A expone endpoint, CLI-B UI con drag-drop

### Prioridad 4: Admin multitenant

- `admin.activopos.com` — panel para Carlos
- Ver tenants, plans, activar/desactivar negocios
- **Territorio exclusivo de Opus (sesión aislada)**
- CLI-A solo crea API `/api/admin/tenants/...`; CLI-B la UI

### Prioridad 5: Tu Día — narrativa inteligente

- `/tu-dia` actualmente placeholder
- Narrativa IA del cierre de jornada: ventas destacadas, productos top, comparativa vs ayer
- Requiere endpoint `/api/tu-dia/summary` (CLI-A) + UI conversacional (CLI-B)

---

## NOTAS TÉCNICAS PARA SPRINT 19

### bcv.ts — nuevo comportamiento (DT-014)
`lib/bcv.ts` ya no usa cache en memoria. Lee de `dollar_rates` tabla con TTL de 5min.
Si hay tests que mockeen bcv.ts, revisar que el mock sea compatible con el nuevo contrato.

### xlsx / SheetJS — ya instalado
`package.json` incluye `xlsx`. Para nuevos exports, usar el helper en `src/lib/excel.ts` (si existe).
Verificar que CLI-A creó este helper — si no, cada export tiene su propio `XLSX.utils.aoa_to_sheet`.

### Mobile POS — clases CSS relevantes
- `cartToggle` — FAB botón (visible en ≤768px)
- `cartBadge` — badge contador sobre FAB
- `cartSlotOpen` — clase que indica drawer abierto (translateX(0))
- No usar estas clases en otros contextos — son específicas del POS mobile

### sprint17-visual ES02 — historial
CLI-C renombró el KPI 4 de "Ítems vendidos" a "Utilidad neta" en commits post-badbab7.
Test ES02 fue corregido en commit 15b2a04. Si CLI-B vuelve a renombrarlo, actualizar el selector.

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
| Ventas totales    | > 30 ventas pagadas (cada run de T05 agrega 1)               |

---

## ARCHIVOS CRÍTICOS PARA SPRINT 19

```
src/app/(dashboard)/productos/page.tsx     ← botón Fabricar + import masivo
src/app/api/products/import-excel/route.ts ← nuevo endpoint CLI-A
src/lib/excel.ts                           ← helper xlsx (si no existe, crearlo)
src/lib/bcv.ts                             ← BCV cluster-safe (no tocar)
prisma/schema.prisma                       ← añadir Recipe + RecipeItem si Fábrica
.doc/SYSTEM_MAP.md                         ← actualizar a v19 al cerrar sprint
```

---

## COMMITS SPRINT 18 (referencia)

```
c5743a8 docs(sprint-17/CLI-D): HANDOFF_Sprint18 — nota ES02 selector corregido
41e99b1 feat+test(sprint-18/CLI-C): Export Excel endpoints + certificación mobile MO01-MO05
15b2a04 test(sprint-17/CLI-D): corregir selector ES02 — aria-label real del KPI teal secundario
4b9f76c fix(sprint-17/CLI-C): profundidad visual REAL en TODO el sistema
ea7f454 fix(sprint-17/CLI-C): escala 5 colores semánticos aplicada en TODO el sistema
bb9d751 feat(sprint-18): POS drawer móvil + responsive escritorio + export Excel UI
39620ac fix+feat(sprint-18/CLI-A): DT-014 BCV cluster-safe + DT-038 slug unique + utilidad KPI
```

---

*Generado: 2026-06-21 | HEAD: post Sprint 18 | Entregado por: CLI-D Sprint 18*
*62/62 tests E2E — CORE + Sprint 15-18 certificado*
