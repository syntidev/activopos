# QUALITY_REPORT_Sprint8.md
# Agente: CLI-C | Sprint: 8 | Fecha: 2026-06-17

---

## Resumen ejecutivo

Se auditaron los tres archivos con deuda técnica P1 del Sprint 7, `CajaToggle.tsx`
y `GET /api/products/recent` (entregados por CLI-A en esta sesión), las rutas API
de caja y configuración, y los cambios de Sprint 7 (commits HEAD~10..HEAD).

**Fixes aplicados en este sprint:**
- `ResumenSection.tsx` — AbortController + error state (race condition + silencio de errores)
- `TabEmpresa.tsx` — logoPreview revierte en todos los paths de fallo
- `CajaToggle.tsx` — setOpening(false) siempre se llama (finally); validación monto > 0

**Hallazgos nuevos críticos (no corregidos en este sprint, requieren decisión):**
- 2 P0 de seguridad en `/api/config/business`
- 1 regresión funcional completa en el feature de segmentos (TabTema)

---

## TAREA 1 — CajaToggle.tsx

**Estado:** Auditado y corregido (1 bug P1 + 1 P3). Entregado por CLI-A.

**Archivo:** `src/components/layout/CajaToggle.tsx`

### Criterio: no expone business_id en body
✅ Línea 90: `JSON.stringify({ opening_amount_bs, opening_amount_usd: 0 })` — sin `business_id`. El servidor usa `session.businessId` del JWT.

### Criterio: maneja estado de error sin crash
❌ **P1 — Corregido.** Línea 92 original: `if (!res.ok) return` ejecutaba un `return` dentro del try que saltaba sobre `setOpening(false)` (línea 96, fuera del try/catch). La UI quedaba bloqueada en spinner indefinidamente ante cualquier error (409, 500, red).

Fix: reestructurar con `if (res.ok)` + bloque `finally { setOpening(false) }`:
```tsx
// Antes (bug):
if (!res.ok) return          // setOpening(false) línea 96 nunca se llama
setModalOpen(false)
await fetchStatus()
} catch { }
setOpening(false)            // ← inalcanzable tras el return

// Después (fix):
if (res.ok) {
  setModalOpen(false)
  await fetchStatus()
}
} catch { }
finally { setOpening(false) }  // siempre se llama
```

### Criterio: modal valida monto > 0
⚠️ **P3 — Corregido.** Línea 84 original: `bs < 0` permitía `bs === 0`. Cambiado a `bs <= 0`. Input `min="0.01"` actualizado para coherencia de UI.

---

## TAREA 2 — GET /api/products/recent

**Estado:** Auditado. Sin hallazgos de seguridad. Entregado por CLI-A.

**Archivo:** `src/app/api/products/recent/route.ts`

### Criterio: requiere sesión activa
✅ Línea 8: `if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })`

### Criterio: filtra por business_id de la sesión
✅ Línea 11: `cashRegister.findFirst({ where: { business_id: session.businessId } })` — el turno activo se acota al tenant.
✅ Líneas 20–25: `saleItem.groupBy` filtra `sale.business_id: session.businessId` — los product_ids provienen solo de ventas del tenant.
✅ Líneas 42–50: `product.findMany({ where: { id: { in: productIds } } })` — los IDs ya están acotados por la query anterior.

### Criterio: no expone datos sensibles
✅ El `select` no incluye `cost_price`, `purchase_price` ni campos financieros internos. Solo campos POS-facing: nombre, modo de venta, precios de venta, imágenes.

**Observación (no bloqueante):** El `product.findMany` no incluye `business_id: session.businessId` redundantemente. Seguro en la arquitectura actual, pero defense-in-depth lo recomendaría.

---

## TAREA 3 — Fixes P1 deuda técnica Sprint 7

### Fix 1: ResumenSection.tsx — Race condition (AbortController) ✅

**Archivo:** `src/app/(dashboard)/finanzas/ResumenSection.tsx`
**Líneas afectadas:** 33–41

**Problema:**
- Sin `AbortController`, cambios rápidos de mes provocaban que respuestas tardías
  de un mes anterior sobreescribieran los datos del mes actual.
- `.catch(() => {})` silenciaba todos los errores (red, 401, 500).
- `r.json()` sin comprobar `r.ok` hacía que una respuesta HTML (Next.js error page)
  lanzara `SyntaxError` capturado silenciosamente.
- Sin `error` state, la UI mostraba el mismo mensaje para "sin datos" y "error de red".

**Fix aplicado:**
```tsx
const [error, setError] = useState(false)

useEffect(() => {
  const ctrl = new AbortController()
  setLoading(true)
  setData(null)
  setError(false)
  fetch(`/api/finanzas/resumen?month=${month}`, { signal: ctrl.signal })
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json()
    })
    .then((j: { ok: boolean } & ResumenData) => {
      if (j.ok) setData(j)
      else setError(true)
    })
    .catch((e: unknown) => {
      if (e instanceof Error && e.name === 'AbortError') return
      setError(true)
    })
    .finally(() => setLoading(false))
  return () => ctrl.abort()
}, [month])
```

Mensajes diferenciados:
- `error === true` → "Error al cargar el resumen financiero. Intente de nuevo."
- `!data && !error` → "No hay datos financieros para este período."

---

### Fix 2: TabEmpresa.tsx — logoPreview no revertía en fallo ✅

**Archivo:** `src/app/(dashboard)/configuracion/tabs/TabEmpresa.tsx`
**Líneas afectadas:** 97–126

**Problema:**
`FileReader.onload` establecía `logoPreview` con la nueva imagen (data URL) antes
de completar el upload. Si el upload o el PATCH fallaban, ninguno de los tres paths
de error (líneas 110, 118, 122) llamaba `setLogoPreview` para revertir, dejando
visible una imagen que no fue guardada en el servidor.

**Fix aplicado:**
```tsx
const prevPreview = logoPreview  // captura antes de que FileReader dispare

// En todos los paths de fallo:
if (!uploadRes.ok) { toast('...', 'error'); setLogoPreview(prevPreview); return }
if (!patchRes.ok)  { toast('...', 'error'); setLogoPreview(prevPreview); return }
// catch:
setLogoPreview(prevPreview)
```

---

## TAREA 4 — Hallazgos nuevos de la auditoría Sprint 8

### P0 — Seguridad

#### [SEC-001] logo_path acepta cualquier string — vector SSRF/XSS
**Archivo:** `src/app/api/config/business/route.ts` línea 15
**Severidad:** P0 (seguridad)

```ts
logo_path: z.string().nullable().optional(),  // sin validación de URL ni path
```

Un admin autenticado puede PATCH `logo_path` a:
- `javascript:alert(1)` → XSS almacenado en cualquier UI que renderice `<img src>`
- `https://evil.com/tracker.png` → tracking pixel externo en cada ticket impreso
- URL interna del servidor → SSRF si `sharp` procesa la URL para resize

**Solución:** Validar con `z.string().url()` y restringir al path de uploads del tenant:
```ts
logo_path: z.string()
  .refine(v => v.startsWith('/uploads/'), 'Path de imagen invalido')
  .nullable()
  .optional(),
```

---

#### [SEC-002] dollarRate.create sin business_id — tasa manual es global
**Archivo:** `src/app/api/config/business/route.ts` líneas 72–81
**Severidad:** P0 (aislamiento multi-tenant)

```ts
await prisma.dollarRate.create({
  data: { rate, source: 'manual', is_active: true, fetched_at: new Date() },
  // SIN business_id
})
```

El modelo `DollarRate` no tiene `business_id`. Cualquier tenant que establezca
una tasa manual la sobreescribe para TODOS los tenants (el `findFirst` de
`GET /api/config/business` y `getBcvRate()` usan `orderBy: { created_at: 'desc' }`
sin filtro de negocio).

**Opciones de solución:**
1. Agregar `business_id` al modelo `DollarRate` y filtrar en todas las queries
2. Prohibir tasas manuales desde `config/business` y usar el endpoint `/api/rates/bcv`

---

### P1 — Regresión funcional

#### [FUNC-001] Segmento nunca se persiste en DB — feature completamente roto
**Archivos:** `TabTema.tsx` (línea 92), `config/theme/route.ts`, `config/business/route.ts`
**Severidad:** P1 (feature regression Sprint 7)

Tres problemas combinados que hacen el feature de segmentos no-funcional:

1. **`handleSave` no envía `segment`** (TabTema.tsx L89-92):
   `JSON.stringify({ theme })` — segment no está en el payload.

2. **`/api/config/theme` solo acepta `theme`** (config/theme/route.ts L6-8):
   `PatchSchema = z.object({ theme: z.enum(['dark', 'light']) })` — segment rechazado.

3. **GET `/api/config/business` no devuelve `segment`** (config/business/route.ts L26-40):
   El `select` no incluye `segment` a pesar de que el campo existe en el schema de Prisma
   (`businesses.segment String? @default("retail")`).

**Resultado:** La selección del segmento se escribe únicamente en `localStorage`
(TabTema L83), que es por-dispositivo. En cualquier otro dispositivo o tras limpiar
el navegador, el segmento vuelve al valor por defecto visual. La UI muestra
"Tema guardado correctamente" cuando en realidad el segmento nunca fue guardado.

**Solución:**
1. Agregar `segment` al `select` del GET en `/api/config/business`
2. Agregar `segment: z.enum([...PALETTES]).optional()` al schema de `/api/config/theme`
3. Incluir `segment: selectedPalette || undefined` en `handleSave`

---

### P2 — Race condition / correctness

#### [RACE-001] TOCTOU en apertura de caja — doble apertura posible
**Archivo:** `src/app/api/cash/open/route.ts` líneas 20–26
**Severidad:** P2

El `findFirst` que verifica caja abierta se ejecuta FUERA de la transacción.
Dos requests concurrentes pueden pasar el guard antes de que ninguno cree el registro.

**Solución:** Mover el `findFirst` dentro de `prisma.$transaction` o agregar
un índice único parcial en la migración.

#### [RACE-002] saleAbono en cash/status no acotado a cash_register_id
**Archivo:** `src/app/api/cash/status/route.ts` líneas 32–39
**Severidad:** P2

El agregado de abonos usa `created_at >= register.opened_at` sin `cash_register_id`.
Un abono de una venta de turno anterior, cobrado durante el turno actual, se suma
en las estadísticas del turno incorrecto.

---

### P3 — Input validation

#### [VAL-001] opening_amount_usd hardcodeado a 0 en CajaToggle
**Archivo:** `src/components/layout/CajaToggle.tsx` línea 90
**Severidad:** P3

`opening_amount_usd: 0` hardcodeado — no hay forma de registrar fondo inicial en USD.
Aceptable si el negocio opera solo en Bs, pero limita la reconciliación si se abre
con dólares físicos en caja.

---

## Resumen de hallazgos y estado

| ID         | Archivo                              | Línea | Severidad | Estado          |
|------------|--------------------------------------|-------|-----------|-----------------|
| P1-FIX-1   | ResumenSection.tsx                   | 33-41 | P1        | ✅ Corregido    |
| P1-FIX-2   | TabEmpresa.tsx                       | 97-126| P1        | ✅ Corregido    |
| CAJA-P1    | CajaToggle.tsx                       | 92-96 | P1        | ✅ Corregido    |
| CAJA-P3    | CajaToggle.tsx                       | 84    | P3        | ✅ Corregido    |
| SEC-001    | api/config/business/route.ts         | 15    | P0        | ⚠️ Pendiente   |
| SEC-002    | api/config/business/route.ts         | 72-81 | P0        | ⚠️ Pendiente   |
| FUNC-001   | TabTema.tsx + config/theme + business | 92   | P1        | ⚠️ Pendiente   |
| RACE-001   | api/cash/open/route.ts               | 20-26 | P2        | ⚠️ Pendiente   |
| RACE-002   | api/cash/status/route.ts             | 32-39 | P2        | ⚠️ Pendiente   |
| VAL-001    | CajaToggle.tsx                       | 90    | P3        | ⚠️ Pendiente   |

---

## TypeScript
`npx tsc --noEmit` — ✅ Sin errores tras aplicar los fixes.
