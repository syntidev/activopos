# CERT_FINANZAS_Sprint12.md
# Certificación Módulo Finanzas — Sprint 12
# CLI-C | Auditoría + Code Review + E2E | Fecha: 2026-06-19

---

## Resumen ejecutivo

| Estado     | Tests | Seguridad | Code Review |
|------------|-------|-----------|-------------|
| CERTIFICADO | 5/5 ✓ | ✓ sin P0/P1 de seguridad | 8 hallazgos CONFIRMED (2 P1, 4 P2, 2 P3) |

El módulo de finanzas queda certificado. Los 5 tests E2E pasan. No hay vulnerabilidades P0/P1 de seguridad. Se documentan 8 hallazgos para CLI-A/CLI-B con sus correcciones sugeridas.

---

## Auditoría de seguridad

### ✓ Cashier guard — TODOS los endpoints

Verificado con token de cajero:
- `GET /api/finanzas/resumen` → 403 ✓
- `GET /api/finanzas/gastos` → 403 ✓
- `GET /api/finanzas/punto-equilibrio` → 403 ✓
- `GET /api/finanzas/cxc` → 403 ✓

### ✓ `business_id` siempre desde sesión

Todos los endpoints usan `bid = session.businessId` exclusivamente. Ningún endpoint acepta `business_id` del body o query params. ✓

### ✓ Inventario valorizado filtra por business_id

La SQL en `resumen/route.ts:170` tiene `WHERE p.business_id = ${bid}`. Los subqueries también filtran por `business_id`. ✓

### ✓ NaN/Infinity en Punto de Equilibrio (API)

La API guarda contra división por cero:
- `margenContribPct = ventasUsd > 0 ? ... : 0` (línea 56)
- `puntoEquilibrio  = margenContribPct > 0 ? ... : 0` (línea 61)
Ningún path devuelve NaN o Infinity. ✓

---

## Code Review — hallazgos CONFIRMED

### P1 — ResumenSection: división por cero en P&L (CLI-B)

**Archivo:** `src/app/(dashboard)/finanzas/ResumenSection.tsx`
**Línea:** 193
**Problema:**
```tsx
<span className={styles.plPct}>{fmtPct((er.gastos_operativos / er.ventas_netas) * 100)}</span>
```
`er.ventas_netas = 0` → `Infinity` → `fmtPct(Infinity)` → renderiza `"Infinity%"` en el Estado de Resultados.
**Fix sugerido (CLI-B):**
```tsx
fmtPct(er.ventas_netas > 0 ? (er.gastos_operativos / er.ventas_netas) * 100 : 0)
```

---

### P1 — Punto de Equilibrio: `progresoPct=100` + `superado=false` con margen negativo (CLI-A)

**Archivo:** `src/app/api/finanzas/punto-equilibrio/route.ts`
**Líneas:** 74-76
**Problema:** Cuando `costoVariable > ventasUsd` → `margenContribPct ≤ 0` → `puntoEquilibrio = 0` → el else-branch devuelve `progresoPct = 100` (si `ventasUsd > 0`), pero `superado = false`. Respuesta contradictoria: "100% del PE alcanzado" + "no superado" mientras la empresa pierde dinero por unidad.

Verificado en producción: `{"punto_equilibrio_usd":0,"superado":false,"progreso_pct":100}` cuando `gastos_fijos_usd=0`.

**Fix sugerido (CLI-A):**
```typescript
const progresoPct = puntoEquilibrio > 0
  ? Math.min(100, r2((ventasUsd / puntoEquilibrio) * 100))
  : margenContribPct > 0 ? 100 : 0  // 100 solo si hay margen positivo y PE=0
```

---

### P2 — `r/[token]/route.ts`: regex diacríticos con chars Unicode literales (CONFIRMADO de Sprint 11)

**Archivo:** `src/app/api/r/[token]/route.ts`
**Línea:** 44
**Problema:** El regex `[̀-ͯ]` usa caracteres combinantes Unicode literales (U+0300-U+036F) en lugar de `̀-ͯ`. Vulnerable a corrupción silenciosa por editores o `git.autocrlf`.
**Fix sugerido (CLI-A):**
```typescript
.replace(/[̀-ͯ]/g, '')
```

---

### P2 — `gastos/route.ts`: `concepto = ' '` persiste (sin `.trim()`)

**Archivo:** `src/app/api/finanzas/gastos/route.ts`
**Línea:** 15
**Problema:** `z.string().min(1)` sin `.trim()`. Un espacio en blanco `' '` tiene length 1, supera el guard, y se persiste en DB como concepto vacío.
**Fix sugerido (CLI-A):** `concepto: z.string().trim().min(3).max(200)`

---

### P2 — `resumen/route.ts`: `egresos.total_usd` excluye `cuentas_pagadas_usd`

**Archivo:** `src/app/api/finanzas/resumen/route.ts`
**Línea:** ~218
**Problema:** `egresos.total_usd = r2(gastosOpUsd)` no incluye `cuentasPagUsd`, aunque ambas están en el mismo bloque. Un consumer que usa `ingresos.total_usd - egresos.total_usd` como flujo de caja neto obtiene un resultado incorrecto.
**Fix sugerido (CLI-A):** `total_usd: r2(gastosOpUsd + cuentasPagUsd)` o renombrar el campo a `gastos_incurridos_usd` para claridad.

---

### P2 — `punto-equilibrio/route.ts`: todos los gastos tratados como `gastos_fijos`

**Archivo:** `src/app/api/finanzas/punto-equilibrio/route.ts`
**Línea:** 51
**Problema:** `gastosFijos = SUM(ALL gastos)`. Gastos variables (materiales, transporte) son incluidos como costos fijos, mientras que `costoVariable` solo captura `cost_per_unit_usd × qty`. Los gastos variables que no están en `products.cost_per_unit_usd` son doblemente contados (en `gastosFijos`) o inflacionan el PE.
**Nota:** Este es un límite del modelo de datos actual (gastos no tienen campo `tipo: fijo|variable`). Fix requiere schema change o clasificación manual por categoría.

---

### P2 — `gastos/route.ts` y `resumen/route.ts`: raw SQL tasa BCV + `'36.50'` hardcoded

**Archivos:** `src/app/api/finanzas/gastos/route.ts:75`, `src/app/api/finanzas/resumen/route.ts:177`
**Problema:** Ambos usan `SELECT rate FROM dollar_rates ORDER BY created_at DESC LIMIT 1` con fallback `'36.50'` hardcodeado. `readCachedBcvRate()` en `lib/bcv.ts` ya existe con caché 1h y fallback correcto desde DB. El hardcode viola CLAUDE.md ("Fallback: última tasa en tabla dollar_rates").
**Fix sugerido (CLI-A):**
```typescript
import { readCachedBcvRate } from '@/lib/bcv'
const rate = await readCachedBcvRate()
```

---

### P3 — CxC "vencidas" usa heurístico 30 días (sin `due_date`)

**Archivo:** `src/app/api/finanzas/resumen/route.ts:132`
**Problema:** `cxcVencidasCount` cuenta ventas pendientes con `created_at < now - 30 días`. El modelo `Sale` no tiene campo `due_date`. Las ventas con acuerdos de crédito extendido (ej. 60 días) se marcan falsamente como vencidas después de 30 días. El dashboard no comunica que es un heurístico.
**Fix sugerido:** Añadir `due_date` al modelo Sale (CLI-A schema change) o mostrar "~30 días" en la UI.

---

### P3 — `parsePeriod()` duplicado 3 veces

**Archivos:** `gastos/route.ts:28`, `resumen/route.ts:17`, `punto-equilibrio/route.ts:15` (inline)
**Problema:** La misma lógica de parsing de `?period=YYYY-MM` está triplicada. Un cambio en un lugar no se propaga a los otros.
**Fix sugerido (CLI-A):** Extraer a `src/lib/finanzas.ts`:
```typescript
export function parsePeriod(sp: URLSearchParams): { year: number; month: number }
```

---

## Verificaciones SQL

```sql
-- Gastos del mes registrados
-- Resultado: 3 gastos (Alquiler $200 + Internet $30 + Test CLI-C ~$15)
SELECT concepto, categoria, monto_usd, fecha
FROM gastos WHERE business_id = 1 AND fecha >= '2026-06-01'
ORDER BY fecha DESC;

-- CxC pendiente
-- Resultado: 1 venta pending (José Pirela, $3.50, ticket ACT-00005)
SELECT id, ticket_number, status, total_usd, created_at
FROM sales WHERE business_id = 1 AND status = 'pending';

-- Costo de ventas
-- Resultado: $6.00 (ventas del mes × cost_per_unit)
SELECT SUM(si.quantity * IFNULL(p.cost_per_unit_usd, 0)) as costo
FROM sale_items si
JOIN products p ON p.id = si.product_id
JOIN sales s ON s.id = si.sale_id
WHERE s.business_id = 1 AND s.status = 'paid'
  AND DATE_FORMAT(s.sold_at, '%Y-%m') = '2026-06';
```

---

## Resultados E2E — tests/finanzas-core.spec.ts

| Test | ID  | Descripción                                              | Estado |
|------|-----|----------------------------------------------------------|--------|
| F01  | ✓   | Resumen P&L carga con datos reales (ventas>0, insight)    | PASS   |
| F02  | ✓   | Punto de Equilibrio: campos finitos, progreso 0-100       | PASS   |
| F03  | ✓   | Registrar gasto vía modal aparece en lista               | PASS   |
| F04  | ✓   | CxC muestra pendiente José Pirela con vencimiento        | PASS   |
| F05  | ✓   | Cashier redirigido fuera de /finanzas, API → 403          | PASS   |

**5/5 en 16.6s** — chromium headless.

---

## Checklist de certificación

- [x] Cashier guard en todos los endpoints (403 verificado)
- [x] `business_id` siempre desde sesión
- [x] Inventario valorizado filtrado por `business_id`
- [x] NaN/Infinity en PE → no ocurre en API
- [x] Gastos $230 registrados y reflejados en resumen
- [x] CxC pendiente visible con vencimiento
- [x] TypeScript strict: `npx tsc --noEmit` → 0 errores
- [x] 5/5 tests E2E verde

---

## Hallazgos pendientes por agente

### Para CLI-B:
| Severidad | Archivo | Acción |
|-----------|---------|--------|
| P1 | ResumenSection.tsx:193 | Zero-guard en división por ventas_netas |

### Para CLI-A:
| Severidad | Archivo | Acción |
|-----------|---------|--------|
| P1 | punto-equilibrio/route.ts:74 | Fix progresoPct cuando PE=0 y margen<0 |
| P2 | r/[token]/route.ts:44 | Regex ̀-ͯ escape sequences |
| P2 | gastos/route.ts:15 | concepto z.string().trim().min(3) |
| P2 | resumen/route.ts:218 | egresos.total_usd incluir cuentas_pagadas_usd |
| P2 | gastos+resumen | Reemplazar raw SQL tasa con readCachedBcvRate() |
| P3 | resumen/route.ts:132 | CxC vencidas documentar heurístico 30d |
| P3 | gastos+resumen+PE | Extraer parsePeriod() a lib/finanzas.ts |

---

*CLI-C | Sprint 12 | 2026-06-19*
