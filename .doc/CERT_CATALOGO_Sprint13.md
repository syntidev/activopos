# CERT_CATALOGO_Sprint13.md
# Certificación Módulo Catálogo Admin — Sprint 13
# CLI-C | Auditoría + Code Review + E2E | Fecha: 2026-06-19

---

## Resumen ejecutivo

| Estado     | Tests | Seguridad | Code Review |
|------------|-------|-----------|-------------|
| CERTIFICADO | 5/5 ✓ | ✓ sin P0/P1 de seguridad | 10 hallazgos (3 P1, 4 P2, 3 P3) |

El módulo de Catálogo Admin queda certificado. Los 5 tests E2E pasan. No hay vulnerabilidades P0/P1 de seguridad activas. Se documentan 10 hallazgos para CLI-A/CLI-B.

---

## ESPERA CRÍTICA — Estado previo verificado

```
git log --oneline -3:
  9a359f6 feat(sprint-13/CLI-B): UI catálogo digital admin — métricas + QR + visibilidad bulk
  ed83ba7 fix+feat(sprint-13/CLI-A): DT-025/027/028/029/031 + catálogo admin API
  48de9cb fix(sprint-13/CLI-B): DT-024 — Infinity% en ResumenSection (P1)
```

- ✓ TypeScript strict: `npx tsc --noEmit` → 0 errores
- ✓ Ruta admin: `/catalogo-digital` (CLI-B movió de `/catalogo/admin`)
- ✓ T02 flake pre-existente: pasa en aislamiento, falla por dependencia de orden en suite completa
- ✓ S01 flake pre-existente: ídem — confirmado pre-Sprint 13

---

## Auditoría de seguridad

### ✓ `bulk-visibility` — business_id guard (anti-IDOR)

Verificado en `src/app/api/products/bulk-visibility/route.ts`:
```typescript
// updateMany con business_id garantiza que solo se actualizan productos del tenant
const result = await prisma.product.updateMany({
  where: {
    id:          { in: body.product_ids },
    business_id: session.businessId,   // ← siempre desde getSession()
  },
  data: { catalog_visibility: body.catalog_visibility },
})
```
Un atacante que envíe IDs de otro negocio recibe `updated: 0` — no hay modificación cross-tenant. ✓

### ✓ Cashier guard — `/api/catalogo/metrics`

```
GET /api/catalogo/metrics con token de cajero → 403 ✓
```
Verificado en código: `if (session.role === 'cashier') return 403`

### ✓ `/catalogo-digital` en Sidebar — adminOnly: true

El grupo CATÁLOGO en `Sidebar.tsx` tiene `adminOnly: true`. Los cajeros no ven el ítem. ✓

### ✓ Catálogo público `/catalogo/demo` intacto

HTTP 200 sin auth. El middleware permite el prefijo `/catalogo/`. ✓

### ✓ Infinity% eliminado (DT-024)

`ResumenSection.tsx:202` corregido:
```
ANTES: {fmtPct((er.gastos_operativos / er.ventas_netas) * 100)}  → "Infinity%"
AHORA: {safePct(er.gastos_operativos, er.ventas_netas)}           → "—" cuando base=0
```
`safePct()` guarda contra `!base` y `!isFinite(pct)`. Verificado en código y en diff. ✓

---

## Code Review — hallazgos CONFIRMED

### P1 — `metrics/route.ts:108`: catalog_visibility `?? 'visible'` promueve productos eliminados (CLI-A)

**Archivo:** `src/app/api/catalogo/metrics/route.ts`
**Línea:** 108
**Problema:** El LEFT JOIN en la query de `top_products` puede devolver `p.catalog_visibility = NULL` cuando el producto fue eliminado (producto existe en order_items pero no en products). El fallback `?? 'visible'` lo marca como visible. Cuando el admin hace clic en "Ocultar", el PATCH ejecuta `updateMany` que actualiza 0 filas pero devuelve `ok: true` con `updated: 0`. El toast muestra "Visibilidad actualizada" — éxito falso.
**Fix sugerido (CLI-A):**
```typescript
// Filtrar productos huérfanos antes de devolver
.filter(p => p.catalog_visibility !== null)
// Y en el map, usar la visibilidad real sin fallback de 'visible'
catalog_visibility: (p.catalog_visibility ?? 'hidden') as CatalogVisibility
```

---

### P1 — `page.tsx:83`: quickToggle() sin guard de in-flight + sin try/catch (CLI-B)

**Archivo:** `src/app/(dashboard)/catalogo-digital/page.tsx`
**Línea:** 83
**Problema A:** No hay disabled state en el botón de acción durante la llamada PATCH. Double-click envía dos PATCHes consecutivos leyendo el mismo valor `current` estale → comportamiento imprevisible.
**Problema B:** `callBulkVisibility()` no tiene try/catch. Si la red falla, TypeError propaga por `quickToggle()` sin capturar → uncaught promise rejection, sin toast de error.
**Fix sugerido (CLI-B):**
```typescript
async function quickToggle(productId: number, current: CatalogVisibility) {
  const next: CatalogVisibility = current === 'visible' ? 'hidden' : 'visible'
  try {
    const ok = await callBulkVisibility([productId], next)
    if (ok) { toast('Visibilidad actualizada', 'success'); load() }
    else toast('Error al actualizar', 'error')
  } catch {
    toast('Error de conexión', 'error')
  }
}
// Y en el JSX: deshabilitar el botón durante la operación con un estado local
```

---

### P1 — `page.tsx:91`: bulkUpdate() llama load() sin await — botones re-habilitados con estado estale (CLI-B)

**Archivo:** `src/app/(dashboard)/catalogo-digital/page.tsx`
**Línea:** 91
**Problema:** `load()` es fire-and-forget dentro del try block. El finally ejecuta `setUpdating(false)` inmediatamente, re-habilitando los botones mientras la recarga está pendiente. El usuario puede lanzar un segundo bulk action con la selección estale (setSelected([]) no ha corrido aún).
**Fix sugerido (CLI-B):**
```typescript
async function bulkUpdate(visibility: CatalogVisibility) {
  if (selected.length === 0) return
  setUpdating(true)
  try {
    const ok = await callBulkVisibility(selected, visibility)
    if (ok) {
      toast(`${selected.length} productos actualizados`, 'success')
      await load()  // await: selected se limpia ANTES de que setUpdating(false) corra
    } else {
      toast('Error al actualizar', 'error')
    }
  } catch {
    toast('Error de conexión', 'error')
  } finally {
    setUpdating(false)
  }
}
```

---

### P2 — `metrics/route.ts:61`: productsSummary excluye show_in_catalog=false (CLI-A)

**Archivo:** `src/app/api/catalogo/metrics/route.ts`
**Línea:** 61
**Problema:** `prisma.product.groupBy` filtra `show_in_catalog: true`. Productos con `catalog_visibility='hidden'` pero `show_in_catalog=false` son excluidos del conteo. El admin ve "Ocultos: 0" aunque tenga productos con visibilidad explícitamente asignada.
**Fix sugerido (CLI-A):** Quitar `show_in_catalog: true` del filtro del groupBy si el propósito es contar por `catalog_visibility`.

---

### P2 — `resumen/route.ts`: ingresos.total_usd double-counts abonos (CLI-A) — heredado Sprint 12

**Archivo:** `src/app/api/finanzas/resumen/route.ts`
**Línea:** ~194 (confirmado en Sprint 12, no corregido en Sprint 13)
**Problema:** `ingresos.total_usd = ventasUsd + abonosUsd`. Si una venta pending recibe un abono y luego se marca paid en el mismo período, el abono se cuenta dos veces.
**Nota:** El campo `estado_resultados.ventas_netas` (usado en la UI) usa solo `ventasUsd` y NO está afectado. Solo `ingresos.total_usd` en el nuevo shape de Sprint 12 presenta el bug.

---

### P2 — `page.tsx:241`: "Seleccionar todos" solo selecciona los 5 productos del top_products (CLI-B)

**Archivo:** `src/app/(dashboard)/catalogo-digital/page.tsx`
**Línea:** 241 (checkbox "Seleccionar todos")
**Problema:** La query `$queryRaw` de top_products tiene `LIMIT 5`. `toggleAll()` selecciona `data.top_products` (máximo 5). El aria-label dice "Seleccionar todos" pero para un catálogo de 200 productos solo selecciona los 5 visibles en pantalla. El toast posterior dice "5 productos actualizados" — técnicamente correcto pero semánticamente engañoso.
**Fix sugerido (CLI-B):** Cambiar el label a "Seleccionar todos los mostrados" o mostrar un count: "Seleccionar los 5 del top".

---

### P2 — `catalogo-admin.module.css:61`: `color: #fff` hardcodeado (CLI-B) — CLAUDE.md violation

**Archivo:** `src/app/(dashboard)/catalogo-digital/catalogo-admin.module.css`
**Línea:** 61
**Problema:** `color: #fff;` en `.viewLink`. Violación explícita de CLAUDE.md: _"NUNCA colores hexadecimales directos en componentes (solo en tokens.css)"_.
**Fix sugerido (CLI-B):** Reemplazar con `var(--color-text-on-brand)` o el token equivalente de tokens.css.

---

### P3 — `metrics/route.ts:26`: findUniqueOrThrow en Promise.all → 500 no controlado (CLI-A)

**Archivo:** `src/app/api/catalogo/metrics/route.ts`
**Línea:** 26
**Problema:** `prisma.business.findUniqueOrThrow` lanza `P2025 NotFoundError` si el `businessId` del JWT no tiene negocio en DB (tenant eliminado, JWT no invalidado). Sin try/catch en el handler, esto produce un 500 no controlado. La UI muestra "Sin datos disponibles" sin explicación.
**Fix sugerido (CLI-A):**
```typescript
const business = await prisma.business.findUnique({ where: { id: bid }, select: { catalog_slug: true } })
if (!business) return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
```

---

### P3 — `page.tsx:12-27`: interfaces inline en componente — CLAUDE.md violation (CLI-B)

**Archivo:** `src/app/(dashboard)/catalogo-digital/page.tsx`
**Líneas:** 12-27
**Problema:** `TopProduct` y `MetricsData` están declaradas inline en `page.tsx`. CLAUDE.md: _"Interfaces en `src/types/` — nunca tipos inline en componentes"_.
**Fix sugerido (CLI-B):** Mover a `src/types/catalogo.ts` e importar.

---

### P3 — `metrics/route.ts:68`: catalog_url hardcodeada a dominio de producción (CLI-A)

**Archivo:** `src/app/api/catalogo/metrics/route.ts`
**Línea:** 68
**Problema:** `const catalogUrl = \`https://activopos.com/catalogo/${slug}\`` — dominio de producción hardcodeado en el código. En local dev y staging, el QR generado apunta a producción, no al entorno local.
**Fix sugerido (CLI-A):** Usar `process.env.NEXT_PUBLIC_APP_URL ?? 'https://activopos.com'` o una variable de config compartida.

---

## Verificaciones de seguridad

```sql
-- Cross-tenant guard: bulk-visibility con IDs de otro negocio
-- Resultado esperado: updated=0 (no se modifican productos de otro tenant)
-- Verificado estructuralmente: WHERE business_id = session.businessId en updateMany

-- Productos visibles en catálogo demo
SELECT id, name, catalog_visibility FROM products
WHERE business_id = 1 AND show_in_catalog = true
ORDER BY id LIMIT 5;
```

---

## Resultados E2E — tests/catalogo-admin.spec.ts

| Test | ID  | Descripción                                                | Estado |
|------|-----|------------------------------------------------------------|--------|
| CA01 | ✓   | Vista admin carga con métricas reales (KPI + period)       | PASS   |
| CA02 | ✓   | QR visible y botón de descarga presente                    | PASS   |
| CA03 | ✓   | Bulk visibility: productos ocultos desaparecen del catálogo | PASS   |
| CA04 | ✓   | Link "Ver catálogo" apunta al slug correcto (/demo)        | PASS   |
| CA05 | ✓   | Métricas se actualizan tras crear orden de catálogo        | PASS   |

**5/5 en 9.3s** — chromium headless.

**Nota CA05-DT024:** La eliminación del Infinity% (DT-024) fue verificada por:
1. Inspección del diff: `fmtPct(...)` → `safePct(...)` en ResumenSection.tsx:202
2. `safePct()` guarda: `if (!base || base === 0) return '—'` + `if (!isFinite(pct)) return '—'`
3. grep `Infinity|NaN` en ResumenSection.tsx → 0 resultados de texto visible

**Suite completa:** 32/33 (1 flake pre-existente por orden de ejecución — S01 pasa en aislamiento)

---

## Checklist de certificación

- [x] `business_id` en bulk-visibility siempre desde sesión (anti-IDOR verificado)
- [x] Cashier 403 en `/api/catalogo/metrics`
- [x] `/catalogo-digital` en Sidebar gateado con `adminOnly: true`
- [x] Catálogo público `/catalogo/demo` → HTTP 200 sin auth
- [x] Infinity% eliminado de ResumenSection.tsx (DT-024 cerrado)
- [x] TypeScript strict: `npx tsc --noEmit` → 0 errores
- [x] 5/5 tests E2E verde

---

## Hallazgos pendientes por agente

### Para CLI-B:
| Severidad | Archivo | Acción |
|-----------|---------|--------|
| P1 | catalogo-digital/page.tsx:83 | quickToggle(): try/catch + disabled state |
| P1 | catalogo-digital/page.tsx:91 | bulkUpdate(): await load() antes de finally |
| P2 | catalogo-digital/page.tsx:241 | "Seleccionar todos" label engañoso con LIMIT 5 |
| P2 | catalogo-admin.module.css:61 | color: #fff → var(--color-text-on-brand) |
| P3 | catalogo-digital/page.tsx:12 | Mover TopProduct + MetricsData a src/types/catalogo.ts |

### Para CLI-A:
| Severidad | Archivo | Acción |
|-----------|---------|--------|
| P1 | catalogo/metrics/route.ts:108 | Filtrar productos huérfanos (NULL catalog_visibility) |
| P2 | catalogo/metrics/route.ts:61 | groupBy sin filtro show_in_catalog para contar ocultos |
| P2 | finanzas/resumen/route.ts:194 | ingresos.total_usd double-count abonos (heredado Sprint 12) |
| P3 | catalogo/metrics/route.ts:26 | findUniqueOrThrow → findUnique + 404 explícito |
| P3 | catalogo/metrics/route.ts:68 | catalog_url hardcoded activopos.com → env var |

---

*CLI-C | Sprint 13 | 2026-06-19*
