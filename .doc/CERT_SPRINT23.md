# CERT_SPRINT23 — Certificación CLI-C

**Sprint:** 23 — CxC Abonos + Notificaciones + PDF + DueDate (Sprint 22 P1 fix)
**Fecha:** 2026-06-22
**Agente:** CLI-C
**Tests:** `tests/sprint23-cxc-notif.spec.ts` (CX01-CX03 + NO01-NO02 + DU01-DU02 + PD01)

---

## TypeScript

`npx tsc --noEmit` → **0 errores** ✅

---

## Commits auditados

| Área              | Descripción                                                |
|-------------------|------------------------------------------------------------|
| CxC               | GET /api/finanzas/cxc — clasificación vencido/vigente/por_vencer |
| CxC Abonos        | POST /api/finanzas/cxc/[id]/abono — parcial y total        |
| Notificaciones    | GET/PATCH /api/notifications + useNotifications + Sidebar  |
| PDF               | POST /api/reports/monthly/generate + GET /api/r/[token]    |
| DueDate (P1 fix)  | saleSchema + postSale + venderACredito + backend validation |

---

## AUDITORÍA CxC

### CX01 — GET /api/finanzas/cxc?status=vencido ✅ CONFIRMADO

**Archivo:** `src/app/api/finanzas/cxc/route.ts`

`classifySale()` usa `due_date` cuando está disponible; fallback `created_at + 30d` para compatibilidad con ventas sin `due_date`. Filtro por bucket correcto:

```ts
function classifySale(due_date: Date | null, created_at: Date, now: Date) {
  const deadline = due_date ?? new Date(created_at.getTime() + 30 * 86_400_000)
  if (deadline < now)                          return 'vencido'
  if (deadline >= now && deadline <= vencer7)  return 'por_vencer'
  return 'vigente'
}
```

- `?status=vencido` filtra solo items con `bucket === 'vencido'` ✅
- `business_id: session.businessId` — tenant isolation ✅
- Totales `vencido_usd`, `por_vencer_usd`, `vigente_usd` calculados antes de paginar ✅

**Test:** CX01

---

### CX02 — Abono parcial actualiza saldo ✅ CONFIRMADO

**Archivo:** `src/app/api/finanzas/cxc/[id]/abono/route.ts`

- `saldoPrev` = `total_usd - sum(abonos)` calculado correctamente
- `saldoNew = saldoPrev - body.amount_usd`
- Response: `{ abono, saldo_usd: saldoNew, paid: false }`
- Verifica `payment_method_id` pertenece al negocio ✅

**Test:** CX02

---

### CX03 — Abono total salda la deuda ✅ CONFIRMADO

**Archivo:** `src/app/api/finanzas/cxc/[id]/abono/route.ts`

```ts
const nowPaid = saldoNew <= 0.01   // tolerancia centavo
const [abono] = await prisma.$transaction([
  prisma.saleAbono.create({...}),
  ...(nowPaid
    ? [prisma.sale.update({ where: { id: saleId }, data: { status: 'paid', sold_at: new Date() } })]
    : []),
])
```

`sale.status = 'paid'` + `sold_at = now()` en la misma transacción cuando saldo ≤ 0.01 ✅

Notificación `credit_paid` disparada (fire-and-forget) ✅

**Test:** CX03

---

### CX04 — Abono mayor al saldo → 400 ✅ CONFIRMADO

```ts
if (body.amount_usd > saldoPrev + 0.01) {
  return NextResponse.json({ error: `El abono supera el saldo pendiente` }, { status: 400 })
}
```

Protección contra sobrepago ✅

**Hallazgo CX-RACE (P2):**
El check `saldoPrev` ocurre FUERA de la transacción. Dos abonos concurrentes del monto completo pueden ambos pasar la validación y ambos crear abonos. La venta terminaría con abonos que suman más que `total_usd`.

**Pendiente CLI-A (Sprint 24):** Mover `findFirst` + check + `saleAbono.create` a una sola `$transaction` con re-lectura de abonos dentro.

---

### CX05 — business_id siempre de sesión ✅ CONFIRMADO

- CxC GET: `where: { business_id: session.businessId }` ✅
- Abono POST: `findFirst({ where: { id: saleId, business_id: session.businessId } })` ✅
- Payment method verify: `findFirst({ where: { id, business_id: session.businessId } })` ✅

---

## AUDITORÍA NOTIFICACIONES

### NO01 — createNotification() inserta en DB ✅ CONFIRMADO

**Archivos:** `src/lib/notifications.ts`, `src/app/api/orders/route.ts`

`createNotification()` hace `prisma.notification.create()` directamente. Sin mocks, sin fallback.

Trigger para pedidos `origin='catalog'`:
```ts
if (data.origin === 'catalog') {
  void createNotification(
    session.businessId, 'order_new', 'Nuevo pedido desde catálogo',
    `Pedido ${order.order_number}...`, 'order', order.id
  ).catch(() => {})
}
```

También se dispara en abono que salda deuda (`type: 'credit_paid'`) ✅

**Test:** NO01 (crea pedido catalog, verifica notification creada con `type='order_new'`)

---

### NO02 — GET /api/notifications filtra por business_id ✅ CONFIRMADO

**Archivo:** `src/app/api/notifications/route.ts`

```ts
await prisma.notification.findMany({
  where: { business_id: session.businessId },
  orderBy: { created_at: 'desc' },
  take: 20,
})
```

Tenant isolation correcto ✅

**Hallazgo NO-F1 (P2) — Field mismatch API vs useNotifications:**

API devuelve campos del modelo Prisma:
```json
{ "id": 1, "body": "Texto...", "read_at": null, "status": "pending" }
```

`NotificationItem` en `useNotifications.ts` espera:
```ts
{ description: string, read: boolean }
```

Consecuencias:
- `n.description` → `undefined` → descripción en blanco en UI
- `!n.read` → `!undefined` → `true` → todas las notificaciones aparecen como no leídas
- `unread` count = total de notificaciones (nunca decrece)

**Hallazgo NO-F2 (P2) — HTTP method mismatch en markAllRead:**

```ts
// useNotifications.ts:
await fetch('/api/notifications/read-all', { method: 'POST' })  // ← POST

// read-all/route.ts:
export async function PATCH() { ... }                            // ← PATCH
```

POST → 405 Method Not Allowed → "Marcar todas como leídas" nunca funciona.

**Pendiente CLI-B Sprint 24:**
1. Transformar respuesta API en `useNotifications.fetchNotifications`: mapear `body → description`, `read_at !== null → read: true`
2. Cambiar `method: 'POST'` → `method: 'PATCH'` en `markAllRead`

**Test:** NO02 (documenta ambos hallazgos, verifica que POST→405 y PATCH→200)

---

### NO03 — PATCH /api/notifications/[id]/read → read_at actualizado ✅ CONFIRMADO

**Archivo:** `src/app/api/notifications/[id]/read/route.ts`

```ts
const notification = await prisma.notification.findFirst({
  where: { id, business_id: session.businessId },  // tenant check ✅
})
const updated = await prisma.notification.update({
  where: { id },
  data:  { read_at: new Date(), status: 'read' },
})
```

Idempotente: `if (notification.read_at) return { ok: true, already_read: true }` ✅

---

### NO04 — Badge sidebar muestra unread count ⚠️ BROKEN por NO-F1

`useNotifications` expone `unread = items.filter(n => !n.read).length`. Dado que `n.read` es siempre `undefined` (la API devuelve `read_at`), `unread` = `items.length` siempre. Badge muestra count de todas las notificaciones, no solo las no leídas.

Será corregido al resolver NO-F1.

---

### NO05 — Panel notificaciones cierra al navegar ⚠️ NO IMPLEMENTADO

**Archivo:** `src/components/layout/Sidebar.tsx`

`showNotif` es estado local. No existe `useEffect` que observe `pathname` para cerrar el panel. El panel solo cierra con: backdrop click, tecla Escape, o botón X.

**Pendiente CLI-B Sprint 24:**
```ts
const pathname = usePathname()
useEffect(() => { setShowNotif(false) }, [pathname])
```

---

## AUDITORÍA DUE_DATE (Sprint 22 P1 resuelto)

### DU01 — due_date persistido en venta a crédito ✅ CONFIRMADO

**Archivos:** `src/hooks/usePOS.ts`, `src/app/api/sales/route.ts`

Sprint 23 añadió `venderACredito(terms)` en `usePOS`:
```ts
const venderACredito = async (terms: CreditTerms): Promise<SaleResult> => {
  const result = await postSale(ticket, 'pending', 'credit', undefined, undefined, terms)
  ...
}
```

`postSale` con 6° parámetro `creditTerms`:
```ts
due_date:     creditTerms?.due_date?.toISOString(),
credit_days:  creditTerms?.credit_days,
credit_notes: creditTerms?.credit_notes || undefined,
```

Backend `saleSchema` ahora acepta `due_date`:
```ts
due_date:     z.string().datetime().optional(),
credit_days:  z.number().int().positive().optional(),
credit_notes: z.string().max(500).optional(),
```

Y lo persiste: `due_date: body.due_date ? new Date(body.due_date) : null` ✅

Sprint 22 P1 RESUELTO ✅

**Test:** DU01 (verifica `sale.due_date` != null, `credit_days=14`, sale aparece como 'vigente' en CxC)

---

### DU02 — Crédito sin client_id → 400 ✅ CONFIRMADO

**Archivo:** `src/app/api/sales/route.ts` (línea 95-99)

```ts
if (body.origin === 'credit' && !body.client_id) {
  return NextResponse.json(
    { error: 'Se requiere un cliente para registrar una venta a crédito' },
    { status: 400 }
  )
}
```

Sprint 22 P2 RESUELTO ✅

**Test:** DU02 (verifica 400 con mensaje que contiene 'cliente')

---

### DU03 — CxC vencidas usa due_date real ✅ CONFIRMADO

Con DU01 resuelto, `Sale.due_date` ahora se escribe. `classifySale()` usa `due_date` directamente. `finanzas/resumen` cuenta `vencidas` via `due_date: { lt: now }`. Las cuentas por cobrar vencidas reflejarán saldos reales a partir de Sprint 23.

---

## AUDITORÍA PDF

### PD01 — PDF generado con datos reales ✅ CONFIRMADO

**Flujo real (corregido respecto a spec):**
- Endpoint: **POST** `/api/reports/monthly/generate` (no GET) — retorna JSON con `download_url`
- Descarga: **GET** `/api/r/{token}` → `Content-Type: application/pdf`

**Archivo:** `src/lib/reports.ts`

- Consulta DB: ventas del período, negocio, tasa BCV ✅
- jsPDF: encabezado "Reporte Mensual de Ventas" + business.name + KPIs + detalle diario ✅
- Guarda en `storage/reports/` con nombre `{businessId}-{period}-{token[:8]}.pdf` ✅
- Token UUID de 30 días de vigencia ✅
- `GET /api/r/{token}` verifica: token válido + no expirado + archivo en disco ✅
- Sanitiza `business.name` para `Content-Disposition` filename ✅

**PD02** — El PDF usa `jsPDF` con fuente helvetica estándar. No hay "header teal" (sin `setFillColor`). La spec visual difiere de la implementación. La certificación valida contenido real (KPIs de DB), no el color del header.

**PD03** — `@media print` aplicable solo en UI (browser). No cubierto por test API.

**Test:** PD01 (POST → 200, `download_url ~ /api/r/{UUID}`, GET → 200, `Content-Type: application/pdf`, magic bytes `%PDF-`)

---

## Hallazgos nuevos

| ID      | Severidad | Descripción                                                   | Pendiente          |
|---------|-----------|---------------------------------------------------------------|--------------------|
| NO-F1   | P2        | API retorna `body`+`read_at`, useNotifications espera `description`+`read` | CLI-B Sprint 24 |
| NO-F2   | P2        | markAllRead() usa POST, route exporta PATCH → 405              | CLI-B Sprint 24    |
| NO-F3   | P2        | Panel notificaciones no cierra al navegar                     | CLI-B Sprint 24    |
| CX-RACE | P2        | Abono saldoPrev check fuera de $transaction → overpay race    | CLI-A Sprint 24    |

---

## Tabla de criterios de éxito

| Test  | Criterio verificable                                                              | Estado       |
|-------|-----------------------------------------------------------------------------------|--------------|
| CX01  | GET ?status=vencido → todos los items con bucket='vencido'                        | ✅ Certifica  |
| CX02  | POST abono $5 en venta $20 → saldo_usd ≈ 15.00, paid=false                       | ✅ Certifica  |
| CX03  | POST abono $12 en venta $12 → paid=true, saldo=0, venta no en CxC pending        | ✅ Certifica  |
| NO01  | POST order origin=catalog → notification type='order_new' en DB tras 800ms        | ✅ Certifica  |
| NO02  | API retorna `body`+`read_at`; POST read-all → 405; PATCH read-all → 200           | ✅ Certifica (documenta gaps) |
| DU01  | POST credit con due_date=+14d → sale.due_date≠null, credit_days=14, en CxC vigente | ✅ Certifica |
| DU02  | POST credit sin client_id → 400 con mensaje "cliente"                             | ✅ Certifica  |
| PD01  | POST generate → download_url~UUID; GET /api/r/{token} → 200, Content-Type: pdf, %PDF- | ✅ Certifica |

---

## Veredicto

**Sprint 23 certificado con hallazgos.**

- 8/8 tests certifican sus respectivos comportamientos
- Sprint 22 P1 (due_date) y P2 (credit sin cliente) **resueltos** ✅
- Sprint 22 P3 (order_number race) **pendiente** desde Sprint 22
- 4 hallazgos nuevos P2 para Sprint 24 (todos CLI-B o CLI-A)

**Acción requerida CLI-B Sprint 24:** NO-F1 (field mismatch), NO-F2 (método HTTP), NO-F3 (panel no cierra)
**Acción requerida CLI-A Sprint 24:** CX-RACE (abono fuera de transacción)
