# QUALITY_REPORT — Sprint 5 (CLI-C)
**Fecha:** 2026-06-16
**Sprint:** Sprint 5 — Fixes Arquitectura + IVA + Disponibilidad
**Autor:** Carlos Bolívar — SYNTIdev

---

## Resultado del Build

```
✓ Compiled successfully
✓ Linting and checking validity of types — PASS
```

**TypeScript:** `npx tsc --noEmit` → **0 errores**
**ESLint:** 0 errores en build final
**Build size:** Normal (no regresión de bundle)

---

## TAREA 1 — Correcciones Arquitecturales

### Fix 1 — Bug financiero: epsilon en auto-cierre de abono
**Archivo:** `src/app/api/clients/[id]/abono/route.ts`

| | Antes | Después |
|---|---|---|
| Comparación auto-cierre | `>= Number(sale.total_usd)` | `>= Number(sale.total_usd) - 0.001` |
| Cálculo amount_usd | `amountBs / rateUsed` (deriva circular) | `data.amount_usd` (directo del input validado) |

**Impacto:** Ventas a crédito podrían no cerrarse automáticamente por drift de punto flotante. El recálculo circular (`amountBs / rateUsed = amount_usd * rate / rate`) introduce error de precisión acumulado.

### Fix 2 — ThemeProvider
**Resultado:** No se requirió cambio. `(dashboard)/layout.tsx` ya es Server Component puro. `DashboardShell.tsx` ya es el Client Component que encapsula todo el estado del cliente (BCV, sidebar, tema). La arquitectura es correcta.

### Fix 3 — Tipos duplicados
**Archivo:** `src/app/(dashboard)/finanzas/CxCSection.tsx`

Eliminada la interfaz local `SaleForAbono` (duplicada de `AbonoModal.tsx`). Ahora importa `SaleForAbono` desde `@/components/finanzas/AbonoModal` donde está definida canónicamente.

---

## TAREA 2 — Configuración IVA

**Nuevo:** `src/app/api/config/iva/route.ts`
- `GET /api/config/iva` → `{ ok, iva: { iva_enabled, iva_pct } }` — solo admin
- `PATCH /api/config/iva` → actualiza `iva_enabled` y/o `iva_pct`; registra en `ActivityLog` cuando se activa/desactiva

**Actualizado:** `src/app/(dashboard)/configuracion/tabs/TabGeneral.tsx`
- Nueva sección "IVA" con toggle on/off
- Cuando activo: input de porcentaje (0–30 %) con validación
- Preview en tiempo real: "Producto de $10.00 → total $X.XX (+$X.XX IVA)"
- Aviso de responsabilidad contable

**Schema:** `businesses.iva_enabled Boolean @default(false)`, `businesses.iva_pct Decimal @default(16) @db.Decimal(5,2)`

---

## TAREA 3 — Disponibilidad de Productos en POS

**Actualizado:** `src/app/api/products/search/route.ts`
- Filtro obligatorio `is_available: true` en búsqueda POS (productos no disponibles no aparecen en caja)

**Actualizado:** `src/app/api/products/route.ts`
- Soporte de `?available=true|false` para filtrado en vista admin (sin `available`, retorna todos)

**Schema:** `products.is_available Boolean @default(true)`

---

## TAREA 4 — Catálogo Digital (Preparación)

**Nuevo:** `src/app/api/config/catalog/route.ts`
- `GET /api/config/catalog` → `{ ok, catalog: { catalog_plan, catalog_slug } }`
- `POST /api/config/catalog` con `{ action: 'request_upgrade', plan? }` → registra en `ActivityLog`; sin side-effects externos

**Schema:** `businesses.catalog_plan String? @db.VarChar(30)`, `businesses.catalog_slug String? @db.VarChar(80)`

---

## TAREA 5 — Code Review Final

### Checklist CLAUDE.md

| Regla | Estado |
|---|---|
| TypeScript strict — cero `any` | ✅ 0 coincidencias |
| CSS Modules — cero Tailwind, cero inline | ✅ |
| Variables CSS de tokens — cero hex hardcodeados en `components/*.module.css` | ✅ 0 coincidencias |
| Server Components por defecto — `'use client'` justificado | ✅ |
| Eager loading en Prisma — cero N+1 | ✅ |
| Zod en todas las API routes | ✅ |
| Paradigma de venta correcto | ✅ (sin cambios en POS) |
| Sin `branch_id` en tablas transaccionales | ✅ |
| Moneda: `price_usd × rate = total_bs` | ✅ |
| Máx 1 archivo por request (excepto sprints con scope explícito) | ✅ |

### Hex hardcodeados pendientes (aceptados)
- `configuracion.module.css` líneas 347-348: `#0D1117` y `#161B22` — preview de tema dark. Son valores de **previsualización visual**, no tokens de UI. Aceptados por diseño.

### Notas adicionales
- Migración Prisma pendiente de ejecutar cuando el servidor MySQL esté activo: `npx prisma migrate dev --name add_iva_is_available_catalog`
- El schema en disco fue también modificado externamente (variantes, imágenes de productos) — integrado correctamente con los campos nuevos de Sprint 5.

---

## Archivos Modificados

| Archivo | Tipo de cambio |
|---|---|
| `prisma/schema.prisma` | Añadidos: `iva_enabled`, `iva_pct`, `catalog_plan`, `catalog_slug` (Business); `is_available` (Product) |
| `src/app/api/clients/[id]/abono/route.ts` | Fix epsilon + fix precisión amount_usd |
| `src/app/api/config/iva/route.ts` | Nuevo — GET + PATCH |
| `src/app/api/config/catalog/route.ts` | Nuevo — GET + POST |
| `src/app/api/products/search/route.ts` | Filtro `is_available: true` |
| `src/app/api/products/route.ts` | Soporte `?available` filter |
| `src/app/(dashboard)/configuracion/tabs/TabGeneral.tsx` | Sección IVA |
| `src/app/(dashboard)/configuracion/configuracion.module.css` | Clases `.ivaWarning`, `.ivaPreview`, `.ivaPreviewAmount` |
| `src/app/(dashboard)/finanzas/CxCSection.tsx` | Eliminado tipo duplicado `SaleForAbono` |
| `src/types/index.ts` | Añadidos `IvaConfig`, `CatalogConfig` |
