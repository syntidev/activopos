# CERT_REPORTES_Sprint11.md
# Certificación Módulo Reportes — Sprint 11
# CLI-C | Auditoría + E2E | Fecha: 2026-06-19

---

## Resumen ejecutivo

| Estado     | Tests | Seguridad | Integración |
|------------|-------|-----------|-------------|
| CERTIFICADO | 5/5 ✓ | P0 corregido | 1 P0 corregido, 4 hallazgos para CLI-A |

El módulo de reportes queda certificado con condiciones. Los 5 tests E2E pasan. Se corrigió un P0 de middleware y un P0 de integración CLI-A/CLI-B. Se documentan 4 hallazgos pendientes para CLI-A.

---

## Auditoría de seguridad

### P0 — Middleware: `/api/r/` bloqueado por auth (CORREGIDO)

**Archivo:** `src/middleware.ts`
**Problema:** `/api/r/` no estaba en `PUBLIC_PREFIXES`. Todo request a la descarga pública era redirigido a `/login` con 307.
**Fix:** Añadidos `/api/r/`, `/api/reports/monthly/pending` y `/api/reports/monthly/mark-pending` a `PUBLIC_PREFIXES`.
**Verificado:** `mark-pending` con key incorrecta devuelve `{"error":"No autorizado"}` (antes: 307).

---

### P1 — `mark-pending/route.ts`: downgrade incondicional de status (CLI-A)

**Archivo:** `src/app/api/reports/monthly/mark-pending/route.ts`
**Línea:** ~40
**Problema:** `update: { status: 'pending' }` aplica a TODOS los reportes incluyendo `'ready'` y `'generating'`. El comentario `// No sobreescribir si ya está ready o generating` es incorrecto — sí sobreescribe.
**Impacto:** n8n puede degradar reportes listos a `pending`, causando regeneración innecesaria o pérdida del PDF downloadable.
**Fix sugerido (CLI-A):** Añadir `where: { status: { notIn: ['ready', 'generating'] } }` al `updateMany`.

---

### P1 — `r/[token]/route.ts`: header injection via Content-Disposition (CLI-A)

**Archivo:** `src/app/api/r/[token]/route.ts`
**Línea:** 42
**Problema:** `filename="${report.business.name.replace(/\s+/g, '-')}.pdf"` — si `business.name` contiene `"` o CRLF, permite HTTP header injection.
**Fix sugerido (CLI-A):**
```typescript
const safeName = report.business.name.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')
```

---

### P2 — `daily/route.ts`: tasa BCV desde raw SQL sin `is_active` (CLI-A)

**Archivo:** `src/app/api/reports/daily/route.ts`
**Línea:** 159
**Problema:** `SELECT rate FROM dollar_rates ORDER BY created_at DESC LIMIT 1` — sin filtro `is_active`; puede retornar una tasa inactiva. Bypassa `readCachedBcvRate()`. Fallback hardcodeado `36.50` viola CLAUDE.md.
**Fix sugerido (CLI-A):** Reemplazar con `readCachedBcvRate()` del módulo `lib/bcv.ts`.

---

### P2 — `generate/route.ts`: race condition sin guard de concurrencia (CLI-A)

**Archivo:** `src/app/api/reports/monthly/generate/route.ts`
**Problema:** Dos requests simultáneos para el mismo `(business_id, period)` crean dos filas y generan dos PDFs; el segundo upsert huerfana el primer archivo. El `catch` hace `prisma.monthlyReport.update({ status: 'failed' })` sin guard — si la DB falla aquí, el reporte queda en `'generating'` permanentemente.
**Fix sugerido (CLI-A):** Upsert con `upsert + skipDuplicates`, o transacción con lock optimista.

---

### P2 — `r/[token]/route.ts`: path traversal potencial en `file_path` (CLI-A)

**Archivo:** `src/app/api/r/[token]/route.ts`
**Línea:** 41
**Problema:** `readFile(report.file_path)` usa el valor directo de DB sin validar que empiece con `REPORTS_DIR`. Si DB es comprometida, path traversal posible.
**Fix sugerido (CLI-A):**
```typescript
import path from 'path'
const REPORTS_DIR = path.join(process.cwd(), 'storage', 'reports')
if (!report.file_path.startsWith(REPORTS_DIR)) {
  return NextResponse.json({ error: 'Archivo no disponible' }, { status: 404 })
}
```

---

### P3 — `pending/route.ts`: sin paginación (CLI-A)

**Archivo:** `src/app/api/reports/monthly/pending/route.ts`
**Problema:** `findMany({ where: { status: 'pending' } })` sin `take` — en escala podría retornar miles de registros y causar OOM.
**Fix sugerido (CLI-A):** Añadir `take: 100` y cursor-based pagination.

---

### P3 — `lib/reports.ts`: `file_path` absoluto en DB (CLI-A)

**Archivo:** `src/lib/reports.ts`
**Línea:** 133
**Problema:** `filePath = path.join(REPORTS_DIR, filename)` almacena la ruta absoluta en DB. Después de un redeploy con diferente `cwd`, todos los tokens existentes apuntarán a rutas inválidas.
**Fix sugerido (CLI-A):** Guardar solo `filename` en DB y reconstruir la ruta en runtime con `REPORTS_DIR`.

---

## P0 de integración CLI-A/CLI-B (CORREGIDO en esta sesión)

**Archivo:** `src/app/(dashboard)/reportes/page.tsx`
**Línea original:** 130 (`setData(json)`)
**Problema:** La API devuelve snake_case (`sales_count`, `by_payment_method`, `top_products`) pero `DailyData` espera camelCase. `setData(json)` asignaba el JSON crudo, dejando todos los campos de la interfaz como `undefined`. Al renderizar, `data?.byPaymentMethod.reduce(...)` crasheaba con `TypeError: Cannot read properties of undefined (reading 'reduce')`.
**Fix:** `fetchDaily` ahora mapea explícitamente snake_case → camelCase.

---

## Resultados E2E — tests/reportes-core.spec.ts

| Test | ID  | Descripción                                          | Estado |
|------|-----|------------------------------------------------------|--------|
| R01  | ✓   | API daily devuelve datos reales (≥2 ventas, total>$0) | PASS   |
| R02  | ✓   | top_products estructura y dual-moneda correcta        | PASS   |
| R03  | ✓   | Botón "Exportar PDF" dispara descarga jsPDF           | PASS   |
| R04  | ✓   | Generate mensual → ready con token 30 días            | PASS   |
| R05  | ✓   | /api/r/[token] descarga PDF sin auth                  | PASS   |

**5/5 en 7.1s** — chromium headless.

---

## Checklist de certificación

- [x] Auth en todos los endpoints protegidos (`getSession()`, cashier → 403)
- [x] `business_id` siempre desde sesión, nunca del body
- [x] Token público validado con Zod (UUID) antes de query
- [x] Expiración de token verificada antes de servir PDF
- [x] Middleware corregido — endpoints públicos accesibles sin auth
- [x] Dual-moneda validada (R02: `|total_bs - total_usd × rate| / expected < 5%`)
- [x] TypeScript strict: `npx tsc --noEmit` — 0 errores
- [x] 5/5 tests E2E verde

---

## Hallazgos pendientes para CLI-A

| Severidad | Endpoint / Archivo           | Acción requerida                              |
|-----------|------------------------------|-----------------------------------------------|
| P1        | mark-pending/route.ts        | Filtrar `status NOT IN ('ready','generating')` |
| P1        | r/[token]/route.ts L42       | Sanitizar business.name en Content-Disposition |
| P2        | daily/route.ts L159          | Reemplazar raw SQL tasa con `readCachedBcvRate()` |
| P2        | generate/route.ts            | Guard de concurrencia + catch seguro           |
| P2        | r/[token]/route.ts L41       | Validar `file_path.startsWith(REPORTS_DIR)`    |
| P3        | pending/route.ts             | Añadir `take: 100` + paginación                |
| P3        | lib/reports.ts L133          | Guardar solo `filename` en DB, no ruta absoluta |

---

*CLI-C | Sprint 11 | 2026-06-19*
