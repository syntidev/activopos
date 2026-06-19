# CERT_SPRINT15.md
# Certificación Sprint 15 — Cotizaciones + Devoluciones + Usuarios
# CLI-C | Auditoría + Code Review + E2E | Fecha: 2026-06-19

---

## Resumen ejecutivo

| Estado         | Tests  | Seguridad                        | Code Review |
|----------------|--------|----------------------------------|-------------|
| ✅ CERTIFICADO | 5/5 ✓  | P1 resueltos — commit 82ef219    | 6 hallazgos (0 P1, 2 P2, 2 P3) |

---

## ESTADO VERIFICADO (re-cert 2026-06-19)

```
git log --oneline -5:
  82ef219 fix(sprint-15/CLI-A): P1 security — returns cashier guard + users IDOR + middleware
  9b12bf2 redesign(sprint-15/CLI-B): catálogo público rediseñado mobile-first 2026
  8336d1d test(sprint-15/CLI-C): certificación Sprint 15 — cotizaciones + devoluciones + usuarios
  f0e32a6 feat(sprint-15/CLI-A): cotizaciones + devoluciones + usuarios backend
  7aa55be feat(sprint-15/CLI-B): layout sweep + UI Usuarios completa
```

- ✓ TypeScript strict: `npx tsc --noEmit` → 0 errores
- ✓ P1-1 resuelto: `returns/route.ts:71` cashier 403 en POST — commit 82ef219
- ✓ P1-2 resuelto: `users/[id]/route.ts:57+79` business_id en where del update y delete — commit 82ef219
- ✓ P2 resuelto: middleware ADMIN_ONLY con 5 rutas nuevas — commit 82ef219
- ✓ P2 resuelto: `usuarios/page.tsx` page-container en raíz — commit 82ef219

---

## Auditoría de seguridad

### ✗ P1 — `returns/route.ts:68`: POST sin cashier guard (CLI-A)

**Archivo:** `src/app/api/returns/route.ts`
**Línea:** 68
**Problema:** El handler GET (línea 23) tiene `if (session.role === 'cashier') return 403`. El handler POST (línea 68) solo verifica sesión, NO el rol:
```typescript
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  // ← SIN: if (session.role === 'cashier') return 403
```
Un cajero autenticado puede crear devoluciones directamente via API sin que el middleware o el handler lo bloqueen. El middleware no incluye `/api/returns` en `ADMIN_ONLY`.

**Fix (CLI-A):** Añadir el guard inmediatamente después de la verificación de sesión:
```typescript
if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
```

---

### ✗ P1 — `users/[id]/route.ts:56`: IDOR check-then-act en PATCH (CLI-A)

**Archivo:** `src/app/api/users/[id]/route.ts`
**Líneas:** 53-60
**Problema:** El check usa `business_id`, pero el update no:
```typescript
const target = await resolveUser(id, session.businessId)  // ← verifica tenant
if (!target) return 404

const user = await prisma.user.update({
  where: { id },                          // ← sin business_id — TOCTOU
  data,
})
```
Patrón TOCTOU (Time-of-Check Time-of-Use): el check y la acción son operaciones separadas sin transacción. El fix seguro es consolidar el `business_id` en el UPDATE.

**Fix (CLI-A):**
```typescript
const user = await prisma.user.update({
  where: { id, business_id: session.businessId },  // ← business_id en el WHERE del update
  data,
  select: USER_SELECT,
})
```
Nota: mismo patrón correcto está en DELETE de la misma ruta: `resolveUser` + update sin business_id en where. Verificar también.

---

### ✓ Cotizaciones — business_id en todos los endpoints

Verificado en `quotations/route.ts` y `quotations/[id]/route.ts`:
- GET: `where: { business_id: bid }` ✓
- POST: `business_id: bid` en create ✓
- PATCH: `findFirst({ where: { id, business_id: bid } })` antes de actualizar ✓
- DELETE: `findFirst({ where: { id, business_id: session.businessId } })` ✓
- PDF: `findFirst({ where: { id, business_id: session.businessId } })` ✓
- Cashier 403 en todos los handlers: GET, POST, PATCH, DELETE, PDF ✓
- Client foreign-key check: `findFirst({ where: { id: client_id, business_id: bid } })` antes de escribir ✓

### ✓ Devoluciones — validación qty no supera vendido

`returns/route.ts:85-111` implementa la validación en 3 capas:
1. `soldMap` — cantidad vendida por producto en la venta
2. `returnedMap` — cantidad YA devuelta (aprobada) para esa venta
3. `if (item.qty > sold - returned)` → 422 con detalle de vendido/devuelto/solicitado ✓

### ✓ Devoluciones — solo admin aprueba/rechaza

`returns/[id]/approve/route.ts:10`: `if (session.role === 'cashier') return 403` ✓
`returns/[id]/reject/route.ts:10`: `if (session.role === 'cashier') return 403` ✓

### ✓ Devoluciones — stock restaurado via inventoryEntry (consistente)

El módulo de ventas descuenta stock via `inventoryEntry.quantity = -qty`. La aprobación de devolución crea `inventoryEntry.quantity = +qty`. Mecanismo simétrico y consistente con el resto del sistema. ✓

### ✓ Usuarios — PIN/password hasheado con bcrypt

`users/route.ts:70`: `const hashed = await bcrypt.hash(credential, 10)` — bcryptjs con saltRounds=10. El campo `password` almacena el hash, nunca el PIN plano. ✓

`users/[id]/reset-pin/route.ts:39`: `const hashed = await bcrypt.hash(pin, 10)` ✓

### ✓ Usuarios — límite 5 cajeros activos

`users/route.ts:54-60`:
```typescript
if (data.role === 'cashier') {
  const cashierCount = await prisma.user.count({
    where: { business_id: session.businessId, role: 'cashier', is_active: true },
  })
  if (cashierCount >= 5) return 422
}
```
✓ El count filtra `is_active: true` — cajeros desactivados no ocupan cupo.

### ✓ Usuarios — anti-escalada de privilegios en reset-pin

`users/[id]/reset-pin/route.ts:32-37`:
```typescript
if (target.role === 'super_admin' && session.role !== 'super_admin') → 403
if (target.role === 'admin' && session.role !== 'super_admin') → 403
```
Admin no puede resetear PIN de otro admin ni de super_admin. ✓

### ✓ Usuarios — self-protection en PATCH

`users/[id]/route.ts:48-51`:
```typescript
if (session.userId === id) {
  if (data.role !== undefined) → 409  // No puedes cambiar tu propio rol
  if (data.is_active === false) → 409  // No puedes desactivarte a ti mismo
}
```
✓

---

## Code Review — Hallazgos CONFIRMED

### P1 — `returns/route.ts:68`: POST sin cashier guard (CLI-A) → ver auditoría

### P1 — `users/[id]/route.ts:56`: IDOR check-then-act en PATCH (CLI-A) → ver auditoría

---

### P2 — Middleware: `/cotizaciones`, `/devoluciones`, `/usuarios` sin ADMIN_ONLY (CLI-A)

**Archivo:** `src/middleware.ts:21`
**Problema:** `ADMIN_ONLY` no incluye las rutas UI de los 3 módulos nuevos. Cajeros pueden navegar directamente a estas URLs:
- `/cotizaciones` → muestra placeholder "En desarrollo" (sin datos)
- `/devoluciones` → muestra placeholder "En desarrollo" (sin datos)
- `/usuarios` → muestra UI completa, pero la API `/api/users` devuelve 403 → lista vacía "No hay usuarios"

No hay fuga de datos, pero la defense-in-depth es incompleta.

**Fix (CLI-A):**
```typescript
const ADMIN_ONLY = [
  '/configuracion', '/finanzas', '/api/reports',
  '/analytics', '/api/analytics',
  '/api/quotations',
  '/cotizaciones', '/devoluciones', '/usuarios',
  '/api/returns', '/api/users',
]
```

---

### P2 — `usuarios/page.tsx:171`: falta `page-container` (CLI-B)

**Archivo:** `src/app/(dashboard)/usuarios/page.tsx`
**Línea:** 171
**Problema:** La raíz del contenido es `<div className={styles.page}>` sin la clase `page-container`. Cotizaciones y devoluciones la tienen: `className={\`${styles.page} page-container\`}`. Inconsistencia de layout.
**Fix (CLI-B):**
```tsx
<div className={`${styles.page} page-container`}>
```

---

### P3 — `quotations/route.ts:108`: race condition en número de cotización (CLI-A)

**Archivo:** `src/app/api/quotations/route.ts`
**Líneas:** 108-109
**Problema:**
```typescript
const count  = await tx.quotation.count({ where: { business_id: bid } })
const number = `QUO-${year}-${String(count + 1).padStart(4, '0')}`
```
Dos POSTs concurrentes obtienen el mismo `count` dentro de la misma transacción serializable. Si `quotation.number` tiene constraint `unique`, uno fallará con P2002. Si no, habrá duplicados.
**Fix sugerido (CLI-A):** Usar `AUTO_INCREMENT` en DB para número secuencial o un índice `UNIQUE` en `(business_id, number)` para detectar colisiones.

---

### P3 — `quotations/route.ts:22`: expireStale() en cada GET (CLI-A)

**Archivo:** `src/app/api/quotations/route.ts`
**Líneas:** 22-31
**Problema:** `expireStale()` ejecuta un `updateMany` en CADA petición GET de listado. Con muchas cotizaciones activas y alto tráfico, esto agrega latencia a cada list request. Idealmente es un job periódico o lazy-expiry por ID.
**Nota:** En v1 con volumen bajo es aceptable. Documentado para Sprint 16.

---

## Resultados E2E — tests/sprint15-core.spec.ts

| Test | ID  | Descripción                                              | Estado |
|------|-----|----------------------------------------------------------|--------|
| Q01  | ✓   | Cotizaciones placeholder carga sin errores              | PASS   |
| Q02  | ✓   | POST /api/quotations → 201 con número QUO-YYYY-NNNN     | PASS   |
| R01  | ✓   | Devoluciones placeholder carga sin errores              | PASS   |
| R02  | ✓   | POST /api/returns sale_id=99999 → 404                   | PASS   |
| U01  | ✓   | Usuarios page carga con 'admin' en contenido            | PASS   |

**5/5 en 4.7s** — chromium headless.

---

## Checklist de certificación

- [x] business_id desde sesión en todos los endpoints de cotizaciones
- [x] Cashier 403 en cotizaciones (GET, POST, PATCH, DELETE, PDF)
- [x] Devolución valida qty ≤ vendido - ya_devuelto
- [x] Solo admin aprueba/rechaza devoluciones
- [x] Stock restaurado via inventoryEntry (consistente con sales)
- [x] PIN/password hasheado con bcrypt(10)
- [x] Límite 5 cajeros activos
- [x] Anti-escalada en reset-pin (admin no puede resetear a admin)
- [x] TypeScript strict: 0 errores
- [x] 5/5 tests E2E verde
- [x] **P1 — `returns/route.ts:71` cashier guard en POST** — resuelto 82ef219
- [x] **P1 — `users/[id]/route.ts:57+79` business_id en update/delete** — resuelto 82ef219

---

## Hallazgos pendientes por agente

### Para CLI-A — RESUELTOS (commit 82ef219):
| Severidad | Archivo | Estado |
|-----------|---------|--------|
| ~~P1~~ | returns/route.ts:71 | ✅ Cashier 403 en POST añadido |
| ~~P1~~ | users/[id]/route.ts:57+79 | ✅ business_id en where de update y delete |
| ~~P2~~ | middleware.ts:21 | ✅ 5 rutas nuevas en ADMIN_ONLY |
| ~~P2~~ | usuarios/page.tsx:171 | ✅ page-container en raíz |

### Para CLI-A — Pendientes (no bloqueantes):
| Severidad | Archivo | Acción |
|-----------|---------|--------|
| P3 | quotations/route.ts:108 | Añadir UNIQUE constraint en `(business_id, number)` para evitar duplicados race condition |
| P3 | quotations/route.ts:22 | `expireStale()` debería ser lazy o job periódico |

---

*CLI-C | Sprint 15 | 2026-06-19*
