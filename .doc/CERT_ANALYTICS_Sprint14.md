# CERT_ANALYTICS_Sprint14.md
# Certificación Módulo Analytics — Sprint 14
# CLI-C | Auditoría + Code Review + E2E | Fecha: 2026-06-19

---

## Resumen ejecutivo

| Estado      | Tests  | Seguridad   | Code Review |
|-------------|--------|-------------|-------------|
| CERTIFICADO | 5/5 ✓  | ✓ sin P0/P1 | 5 hallazgos (0 P0, 1 P2-seg-resuelto, 1 P2-css, 1 P2-style, 2 P3) |

Módulo Analytics certificado tras fix de middleware (CLI-A commit `dfac146`). AN05 pasa. Los 5 tests en verde. Sin vulnerabilidades P0/P1 activas.

---

## ESTADO PREVIO VERIFICADO

```
git log --oneline -5:
  2f6d021 feat(sprint-14/CLI-B): Analytics UI — Pulso del Negocio
  f4127a1 fix: tsconfig.json excluye playwright y tests del build de produccion
  7357fd3 fix+feat(sprint-14/CLI-A): P1/P2/P3 fixes catálogo+finanzas + analytics backend
  0140a4d fix(sprint-14/CLI-B): P1/P2 catálogo — quickToggle, bulkUpdate, label, token CSS
  ed34ee9 docs+test(sprint-13/CLI-D): 33 tests + DT-023 spec + SYSTEM_MAP v13 + HANDOFF Sprint 14
```

- ✓ TypeScript strict: `npx tsc --noEmit` → 0 errores
- ✓ Ruta módulo: `/analytics`
- ✓ APIs: `/api/analytics/summary` · `/api/analytics/top-products` · `/api/analytics/trends`

---

## Fixes Sprint 13 verificados (CLI-A + CLI-B)

### ✓ CLI-B — quickToggle P1 corregido

`src/app/(dashboard)/catalogo-digital/page.tsx:81`
```typescript
async function quickToggle(productId: number, current: CatalogVisibility) {
  setTogglingId(productId)      // ← guard in-flight: botón deshabilitado
  try {
    const next: CatalogVisibility = current === 'visible' ? 'hidden' : 'visible'
    const ok = await callBulkVisibility([productId], next)
    if (ok) { toast('Visibilidad actualizada', 'success'); await load() }
    else toast('Error al actualizar', 'error')
  } catch {
    toast('Error de conexión', 'error')   // ← network TypeError capturado
  } finally {
    setTogglingId(null)
  }
}
```
✓ try/catch ✓ guard in-flight ✓ await load()

### ✓ CLI-B — bulkUpdate P1 corregido

```typescript
const ok = await callBulkVisibility(selected, visibility)
if (ok) {
  toast(`${selected.length} productos actualizados`, 'success')
  await load()        // ← await: estado limpio antes de setUpdating(false)
  setSelected([])
}
```
✓ `await load()` antes del finally

### ✓ CLI-B — color token P2 corregido

`catalogo-admin.module.css:61`: `color: var(--color-text-on-brand)` (era `#fff`) ✓

### ✓ CLI-B — label "Seleccionar todos" P2 corregido

`page.tsx:258`: `aria-label="Seleccionar los ${products.length} mostrados"` ✓

### ✓ CLI-A — metrics groupBy P2 corregido

`metrics/route.ts:61`: eliminado `show_in_catalog: true` del filtro → cuenta todos los productos por visibilidad ✓

### ✓ CLI-A — catalog_url P3 corregido

`metrics/route.ts:68`: `process.env.NEXT_PUBLIC_APP_URL ?? 'https://activopos.com'` ✓

---

## Auditoría de seguridad — Analytics

### ✓ business_id siempre desde sesión — 3 endpoints

Verificado en `summary/route.ts`, `top-products/route.ts`, `trends/route.ts`:
```typescript
const bid = session.businessId   // ← siempre de getSession(), nunca del body
```
Todos los WHERE incluyen `business_id = ${bid}` o `business_id: bid`. ✓

### ✓ Cashier 403 en los 3 endpoints API

```
GET /api/analytics/summary     con token cajero → 403 ✓
GET /api/analytics/top-products con token cajero → 403 ✓
GET /api/analytics/trends      con token cajero → 403 ✓
```
Verificado en código: `if (session.role === 'cashier') return 403` en las 3 rutas. ✓

### ✓ Sidebar gateado con adminOnly: true

`Sidebar.tsx`: `/analytics` está en el grupo FINANZAS con `adminOnly: true`. Los cajeros no ven el ítem. ✓

### ✓ MIDDLEWARE — /analytics y /api/analytics en ADMIN_ONLY (resuelto dfac146)

`src/middleware.ts:21` (post-fix CLI-A):
```typescript
const ADMIN_ONLY = ['/configuracion', '/finanzas', '/api/reports', '/analytics', '/api/analytics']
```
Cajero que navega a `/analytics` es redirigido a `/pos` por middleware. Defense-in-depth de doble capa: middleware redirige la UI + API devuelve 403. ✓

### ✓ Sin Infinity% ni NaN en analytics

- `variacion_pct`: guarda `prevUsd > 0` antes de dividir (línea 90, summary/route.ts) ✓
- `avg_ticket_usd`: guarda `count > 0` (línea 136) ✓
- `pct_of_total`: guarda `totalUsd > 0` (línea 99, top-products/route.ts) ✓
- `pct` en por_metodo: guarda `totalPorMetodo > 0` (línea 116, summary/route.ts) ✓
- `avg_ticket_usd` en trends: guarda `count > 0` (línea 95, trends/route.ts) ✓
- `growthPct`: guarda `firstUsd > 0` (línea 102, trends/route.ts) ✓
- UI: Tooltip formatter guarda `isFinite(n)` (línea 222, page.tsx) ✓

---

## Code Review — Hallazgos CONFIRMED

### ✓ P2 RESUELTO — `middleware.ts:21`: /analytics y /api/analytics en ADMIN_ONLY (CLI-A, dfac146)

**Archivo:** `src/middleware.ts`
**Problema original:** `/analytics` ausente de `ADMIN_ONLY` → cajero podía cargar la página. Fix aplicado: ambas rutas añadidas, middleware redirige a `/pos`. AN05 pasa. ✓

---

### P2 — `catalogo/metrics/route.ts:108`: null catalog_visibility sigue llegando a la UI (CLI-A)

**Archivo:** `src/app/api/catalogo/metrics/route.ts`
**Línea:** 108
**Problema:** Sprint 13 eliminó el `?? 'visible'` fallback. Ahora `p.catalog_visibility` puede ser `null` para productos eliminados (LEFT JOIN). El null llega al JSON de respuesta. En `page.tsx`, `VIS_BADGE_CLASS[null]` → `undefined`, badge sin texto; `VIS_LABEL[null]` → `undefined`, etiqueta vacía; botón muestra "Publicar" (condición `=== 'visible'` es falsa). TypeScript no detecta esto porque el flujo es JSON.
**Fix sugerido (CLI-A):**
```typescript
top_products: topProductsRaw
  .filter(p => p.catalog_visibility !== null)  // excluir productos eliminados
  .map(p => ({
    ...
    catalog_visibility: p.catalog_visibility as CatalogVisibility,
  })),
```

---

### P2 — `analytics.module.css:68`: rgba raw en box-shadow (CLI-B) — CLAUDE.md violation

**Archivo:** `src/app/(dashboard)/analytics/analytics.module.css`
**Línea:** 68
**Problema:** `.periodTabActive { box-shadow: 0 1px 4px rgba(0,0,0,0.08); }` — valor rgba hardcodeado sin variable CSS. CLAUDE.md: _"Variables CSS — cero valores `rgba(` crudos fuera de `tokens.css`"_.
**Fix sugerido (CLI-B):** `box-shadow: 0 1px 4px rgba(var(--color-shadow-rgb, 0,0,0), 0.08)` o añadir `--shadow-xs` en `tokens.css`.

---

### P2 — `page.tsx:290`: inline style en payBarFill (CLI-B) — CLAUDE.md violation

**Archivo:** `src/app/(dashboard)/analytics/page.tsx`
**Línea:** 290
**Problema:** `<div ... style={{ width: \`${m.pct}%\` }} />` — inline style para la barra de progreso. CLAUDE.md: _"cero inline styles"_.
**Fix sugerido (CLI-B):**
```tsx
<div className={styles.payBarFill} style={{ '--bar-pct': `${m.pct}%` } as React.CSSProperties} />
```
Y en CSS:
```css
.payBarFill { width: var(--bar-pct, 0%); }
```

---

### P3 — `parseDate()` duplicada en summary + top-products (CLI-A)

**Archivos:** `summary/route.ts:8-12`, `top-products/route.ts:19-23`
**Problema:** Función `parseDate` idéntica en ambas rutas. Con `@/lib/finanzas` ya consolidando utilidades compartidas, esta función debería ir allí o en un nuevo `@/lib/analytics.ts`.

---

### P3 — `MONTH_SHORT` inline en trends (CLI-A)

**Archivo:** `src/app/api/analytics/trends/route.ts:5`
**Problema:** `const MONTH_SHORT = ['Ene','Feb',...]` definida inline. Similar a `MONTH_NAMES` ya extraído en Sprint 13 a `@/lib/finanzas.ts`. Candidato para consolidar en el mismo lib.

---

## Resultados E2E — tests/analytics-core.spec.ts

| Test | ID  | Descripción                                              | Estado |
|------|-----|----------------------------------------------------------|--------|
| AN01 | ✓   | Página carga sin errores, h1 "Pulso del Negocio" visible  | PASS   |
| AN02 | ✓   | Sin NaN ni Infinity en el contenido renderizado          | PASS   |
| AN03 | ✓   | Selector período: clic en tab, sin crash                 | PASS   |
| AN04 | ✓   | LineChart (Recharts SVG) visible en el DOM               | PASS   |
| AN05 | ✓   | Cashier redirigido de /analytics → /pos por middleware   | PASS   |

**5/5 en 9.6s** — chromium headless.

---

## Checklist de certificación

- [x] `business_id` siempre desde sesión en los 3 endpoints analytics
- [x] Cashier 403 en `/api/analytics/summary`, `/top-products`, `/trends`
- [x] Sin Infinity% ni NaN en ningún cálculo de analytics
- [x] TypeScript strict: `npx tsc --noEmit` → 0 errores
- [x] AN01-AN04 pasan
- [x] AN05 pasa — `/analytics` y `/api/analytics` en `ADMIN_ONLY` (dfac146)
- [x] Sidebar gateado: adminOnly: true en grupo FINANZAS
- [x] Sprint 13 P1/P2 fixes confirmados: quickToggle, bulkUpdate, color token, label

---

## Hallazgos pendientes por agente

### Para CLI-A (P2 + P3):
| Severidad | Archivo | Acción |
|-----------|---------|--------|
| P2 | catalogo/metrics/route.ts:108 | Filtrar null catalog_visibility antes de map |
| P3 | analytics/summary/route.ts:8 | Extraer parseDate a @/lib/analytics |
| P3 | analytics/trends/route.ts:5 | Mover MONTH_SHORT a @/lib/finanzas |

### Para CLI-B (P2 + P2):
| Severidad | Archivo | Acción |
|-----------|---------|--------|
| P2 | analytics.module.css:68 | rgba(0,0,0,0.08) → token CSS |
| P2 | analytics/page.tsx:290 | inline style → CSS custom property |

---

*CLI-C | Sprint 14 | 2026-06-19*
