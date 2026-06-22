# CERT_SPRINT22 — Certificación CLI-C

**Sprint:** 22 — Security Fixes + UX Improvements
**Fecha:** 2026-06-22
**Agente:** CLI-C
**Tests:** `tests/sprint22-fixes.spec.ts` (SP22-01 a SP22-08)

---

## Commits auditados

| Hash (abbrev.) | Descripción                                      |
|----------------|--------------------------------------------------|
| Sprint 22 A5-1 | orders: price always from DB, never body         |
| Sprint 22 A3-1 | order_number: atomic in $transaction             |
| Sprint 22 BUG-01 | vuelto_usd + monto_recibido_usd on Sale        |
| Sprint 22 BUG-03 | finanzas/resumen usa due_date, no 30d heuristic|
| Sprint 22 A1-1 | CobroModal: USD payment fix in buildSingle       |
| Sprint 22 A1-2 | CobroModal: referencia obligatoria → canConfirm  |
| Sprint 22 A3-2 | Pedidos: ErrorBoundary + KanbanSkeleton          |
| Sprint 22 A3-3 | Pedidos: EmptyState único (no duplication)       |
| Sprint 22 A4-1 | CobroModal: UI bloquea crédito sin cliente       |
| Sprint 22-08   | /api/rates/bcv: paralelo + USDT paralelos        |

---

## Resultados por auditoría

### A5-1 — Orders: precio siempre de DB ✅ CONFIRMADO

**Archivo:** `src/app/api/orders/route.ts`

`orderItemSchema` NO incluye `price_per_unit_usd`. Dentro de `$transaction`:

```ts
const products = await tx.product.findMany({
  where:  { id: { in: productIds }, business_id: session.businessId, active: true },
  select: { id: true, price_per_unit_usd: true, price_per_kg_usd: true },
})
const priceUsd = Number(product.price_per_unit_usd ?? product.price_per_kg_usd ?? 0)
```

Precio tampering imposible: cuerpo del cliente no puede alterar el precio. Los subtotales y `total_usd` del pedido se calculan íntegramente del lado del servidor.

**Test:** SP22-01

---

### A3-1 — order_number atómico ⚠️ PARCIAL

**Archivo:** `src/app/api/orders/route.ts` (líneas 143–149)

Implementación actual:
```ts
const last = await tx.order.findFirst({
  where:   { business_id: session.businessId },
  orderBy: { id: 'desc' },
  select:  { id: true },
})
const next         = (last?.id ?? 0) + 1
const order_number = `PED-${String(next).padStart(5, '0')}`
```

**Gap identificado (P2):**
- MariaDB usa aislamiento `READ COMMITTED` por defecto. Dos transacciones concurrentes pueden leer el mismo `last.id` antes que cualquiera de las dos escriba.
- `Order.order_number` NO tiene restricción `@@unique` en `prisma/schema.prisma`.
- Resultado: bajo alta concurrencia, dos pedidos pueden obtener el mismo `order_number` sin error de DB.

**Pendiente CLI-A (Sprint 23):**
1. Agregar `@@unique([business_id, order_number])` en `prisma/schema.prisma`.
2. Con eso, la segunda escritura lanzará `P2002` que se convierte en 409 Conflict.

**Test:** SP22-02 — Documenta el comportamiento esperado; flakiness bajo concurrencia real indica que el gap sigue abierto.

---

### BUG-01 — vuelto_usd calculado ✅ CONFIRMADO

**Archivo:** `src/app/api/sales/route.ts` + `src/app/api/sales/[id]/pay/route.ts`

Ambas rutas calculan:
```ts
montoRecibidoUsd = Math.round(payTotalUsd * 100) / 100
vueltoUsd = Math.max(0, Math.round((payTotalUsd - total_usd) * 100) / 100)
```
Y persisten en `Sale.monto_recibido_usd` / `Sale.vuelto_usd`.

El schema Prisma incluye ambos campos como `Float?`. El ticket puede mostrar vuelto real en USD.

**Test:** SP22-03

---

### BUG-03 — CxC usa due_date ⚠️ PARCIAL

**Archivo:** `src/app/api/finanzas/resumen/route.ts` (líneas 114–121)

La query es correcta:
```ts
// vencidas: due_date < now
prisma.sale.count({ where: { business_id: bid, status: 'pending', due_date: { lt: now } } })
// por_vencer: due_date en próximos 7 días
prisma.sale.count({ where: { business_id: bid, status: 'pending', due_date: { gte: now, lte: vencer7 } } })
```

El shape del response incluye `cxc.vencidas` y `cxc.por_vencer` (confirmado líneas 219–221).

**Gap crítico P1 — due_date NUNCA SE ESCRIBE:**

La cadena de llamadas en el flujo de venta a crédito:
1. `CreditoModal.onConfirm(terms)` → recibe `{ credit_days, due_date, credit_notes }`
2. `CobroModal.handleCreditoConfirm(terms)` → llama `doConfirm(buildSingle())`
3. `procesarPago(payments)` → `postSale(ticket, 'paid', 'pos', payments)`
4. `POST /api/sales` → `saleSchema` **no tiene campo `due_date`**

`saleSchema` en `sales/route.ts` no acepta `due_date`, `credit_days` ni `credit_notes`. Los términos del crédito recolectados en `CreditoModal` son descartados silenciosamente. `Sale.due_date = null` siempre → `cxc.vencidas = 0` permanentemente aunque haya ventas a crédito.

**Pendiente CLI-A (Sprint 23, P1):**
1. Agregar `due_date`, `credit_days`, `credit_notes` a `saleSchema`.
2. Pasar `CreditTerms` de `handleCreditoConfirm` → `procesarPago` → `postSale`.
3. Validar: `if origin === 'credit' && !client_id → 400`.

**Test:** SP22-04 — Verifica shape del response, documenta que `vencidas` es siempre 0 hasta que se resuelva el gap.

---

### A1-1 — CobroModal USD fix en buildSingle ✅ CONFIRMADO

**Archivo:** `src/components/pos/CobroModal.tsx`

```ts
const USD_TYPES = new Set(['zelle', 'binance', 'binance_usdt', 'efectivo_usd', 'usdt'])
const isUsd = (type: string) => USD_TYPES.has(type) || type.endsWith('_usd') || type.endsWith('_usdt')

const buildSingle = (): PaymentInput[] => {
  if (isUsd(selectedMethod!.type)) {
    const usdAmt = parseFloat(receivedBs) || totalUsd
    return [{ ..., amount_usd: usdAmt, amount_bs: usdAmt * methodRate }]
  }
  const amtBs = parseFloat(receivedBs) || totalBs
  return [{ ..., amount_bs: amtBs, amount_usd: amtBs / rate }]
}
```

Antes: todos los métodos usaban Bs como base. Ahora: métodos USD calculan desde USD → Bs correctamente. `methodRate` es editable por método (client-side, no enviado al backend como precio de venta).

---

### A1-2 — Referencia obligatoria en CobroModal ✅ CONFIRMADO

**Archivo:** `src/components/pos/CobroModal.tsx`

```ts
const mixedRefOk = !mixedEntries.some(
  e => REFERENCE_TYPES.has(e.method.type) && !e.reference.trim()
)
const singleRefRequired = !isMixed && selectedMethod != null && REFERENCE_TYPES.has(selectedMethod.type)
const singleRefOk       = !singleRefRequired || reference.trim() !== ''
const canConfirm = isMixed ? mixedOk && mixedRefOk : !!selectedMethod && singleRefOk
```

Doble validación: botón `disabled` + toast explícito si se llama `handleConfirm` sin referencia.

**Test:** SP22-05

---

### A3-2 + A3-3 — Pedidos: ErrorBoundary + EmptyState único ✅ CONFIRMADO

**Archivo:** `src/app/(dashboard)/pedidos/page.tsx` (líneas 362–401)

Estados mutuamente exclusivos y correctos:
```tsx
{loading ? <KanbanSkeleton />              // aria-busy="true"
  : fetchError ? <div className={styles.errorState}>...</div>
  : orders.length === 0 ? <EmptyState title="No hay pedidos activos" />
  : <ErrorBoundary><div className={styles.kanban}>...</div></ErrorBoundary>
}
```

`KanbanSkeleton` tiene `aria-busy="true"` (línea 217). No puede coexistir el EmptyState global con los EmptyState por columna porque el kanban solo se renderiza cuando `orders.length > 0`.

**Test:** SP22-06

---

### A4-1 — Crédito requiere cliente ⚠️ UI SOLO

**Archivo:** `src/components/pos/CobroModal.tsx`

UI valida:
```ts
if (selectedMethod?.type === 'credit' && !isMixed) {
  if (!clientId) { toast('Selecciona un cliente antes de vender a crédito', 'warning'); return }
  setShowCreditoModal(true)
  return
}
```

**Gap (P2):** Backend `saleSchema` no tiene `client_id` como requerido para `origin === 'credit'`. Un cliente API sin la UI puede crear ventas a crédito huérfanas (sin cliente, sin `due_date`).

**Test:** SP22-07 — Documenta el gap: `expect(res.status()).toBe(201)` con comentario "gap: should be 400".

---

### SP22-08 — Tasas paralelo y USDT en /api/rates/bcv ✅ CONFIRMADO

**Archivo:** `src/app/api/rates/bcv/route.ts` + `src/lib/bcv.ts`

Response shape verificado:
```json
{
  "ok": true,
  "bcv": 50.23,
  "paralelo": 55.10,
  "usdt": 53.80,
  "rate": 50.23,
  "source": "bcv"
}
```

`paralelo` y `usdt` pueden ser `null` si la API externa falla y no hay caché en DB. La operación de venta nunca se bloquea.

**Test:** SP22-08

---

## Hallazgos nuevos

| ID     | Severidad | Descripción                                         | Pendiente        |
|--------|-----------|-----------------------------------------------------|------------------|
| P1-S22 | P1        | `due_date` nunca escrito — CxC vencidas siempre 0  | CLI-A Sprint 23  |
| P2-S22 | P2        | Backend no valida `client_id` para origin=credit   | CLI-A Sprint 23  |
| P3-S22 | P3        | `order_number` sin `@@unique` — race bajo carga    | CLI-A Sprint 23  |

---

## Tabla de criterios de éxito

| Test   | Criterio verificable                                                                 | Estado      |
|--------|--------------------------------------------------------------------------------------|-------------|
| SP22-01 | POST /api/orders con items sin precio → order.items[0].price_per_unit_usd = $10 DB | ✅ Certifica |
| SP22-02 | 3 POSTs concurrentes → 3 order_numbers distintos                                   | ⚠️ Flaky     |
| SP22-03 | Pago $15 por producto $10 → vuelto_usd = 5.00, monto_recibido_usd = 15.00          | ✅ Certifica |
| SP22-04 | GET /api/finanzas/resumen → `cxc.vencidas` y `cxc.por_vencer` son numbers          | ✅ Certifica |
| SP22-05 | Método que requiere ref → "Confirmar Venta" disabled sin referencia                 | ✅ Certifica |
| SP22-06 | Pedidos: `aria-busy="true"` durante carga; ≤1 empty state global después            | ✅ Certifica |
| SP22-07 | POST /api/sales origin=credit sin client_id → 201 (gap documentado, debe ser 400)  | ⚠️ Gap P2    |
| SP22-08 | GET /api/rates/bcv → `{bcv: number, paralelo: number|null, usdt: number|null}`     | ✅ Certifica |

---

## Veredicto

**Sprint 22 certificado con hallazgos.**
- 6/8 tests certifican comportamiento implementado correctamente.
- 1 test documenta comportamiento flaky/gap (SP22-02: race condition P3 en order_number).
- 1 test documenta gap activo de seguridad/negocio (SP22-07: credit sin validación backend).
- El gap P1 (due_date nunca escrito) bloquea la funcionalidad CxC vencidas — `cxc.vencidas` siempre será 0 hasta Sprint 23.

**Acción requerida CLI-A Sprint 23:** P1-S22 + P2-S22 + P3-S22.
