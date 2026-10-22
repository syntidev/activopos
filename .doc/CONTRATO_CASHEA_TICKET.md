# Contrato backend para CLI-B — Cashea (financiamiento) como método declarado en el ticket

Fecha: 2026-10-22 · Autor: CLI-A · Rama: `work-a-cashea` · Estado: IMPLEMENTADO en la rama `work-a-cashea` y probado en el negocio 87 local (`tests/cashea-ticket.spec.ts`, 10 PASS). Sin push, sin deploy; la migración `20261022000001_add_ticket_financing` NO está aplicada en el VPS.
Detalles confirmados al implementar: el pedido del catálogo con Cashea se crea en BCV y queda `requested`; un `payment_kind` `bs`/`divisa` solo se guarda como declaración (el pedido sigue en BCV); el 409 del checkout trae `field:"payment_kind"` y `blocked_products`; `PATCH .../financing` solo admite ventas `draft`/`pending` (una `quote` responde 409) y pedidos sin cobrar; la elegibilidad se revalida también al aprobar.
Relacionados: `CONTRATO_FINANCIAMIENTO.md` (config del negocio y sello), `CONTRATO_PRECIO_DIVISA.md` (modo bcv/divisa).

## 0. Qué es "Cashea" aquí y qué ya existía (no se duplica)
- Cashea es financiamiento de un TERCERO: es TODO o NADA por compra y se cobra al **precio BCV completo** (nunca Divisa). `products.precio_cashea` NO se usa.
- "El proveedor" es el configurado por el negocio (`business.settings.financing`: `cashea` | `other` | `own`, ver `src/lib/financing.ts`). En este documento "Cashea" = ese financiamiento; la UI usa el nombre del proveedor del snapshot.
- Ya existía y se REUTILIZA tal cual:
  - `PaymentMethod.is_financing` (marca el admin en Configuración > Cobros): es la "financiadora" al momento de COBRAR. Hoy solo exige cédula de persona natural (`checkCedula`, `src/lib/cedula.ts`).
  - La elegibilidad: financiamiento activo en el negocio (`settings.financing.enabled`) y producto con `financing_excluded = false` (`isFinancingEffective`, `src/lib/financing.ts`).
- Lo NUEVO es la **declaración y aprobación en el ticket** (venta u pedido), antes de cobrar.

## 1. Campos nuevos (migración aditiva `20261022000001_add_ticket_financing`)
| tabla | columna | tipo | default |
|---|---|---|---|
| `sales` | `financing_status` | VARCHAR(12) NULL | NULL = el ticket NO usa financiamiento |
| `sales` | `financing_provider` | VARCHAR(40) NULL | snapshot del nombre del proveedor |
| `sales` | `financing_phrase` | VARCHAR(80) NULL | snapshot de la frase |
| `orders` | `financing_status`, `financing_provider`, `financing_phrase` | igual | igual |
| `orders` | `payment_kind` | VARCHAR(10) NULL | lo que el cliente declaró en el checkout: `cashea` \| `bs` \| `divisa` |

`financing_status`: `requested` (solicitado) · `approved` (aprobado) · `rejected` (rechazado). Etiquetas para la UI: Solicitado / Aprobado / Rechazado.
Quién y cuándo cambió el estado: `activity_logs` (`action='financing_requested' | 'financing_status_changed' | 'financing_cleared'`, `user_id`, `created_at`, `old_values`/`new_values.financing_status`, `model_type` Sale|Order, `model_id`).

## 2. Reglas (una sola fuente: `src/lib/ticket-financing.ts`, usada por POS, pedidos y checkout)
1. **Elegibilidad** para declarar (`request` o checkout `cashea`): (a) el financiamiento está ACTIVO en el negocio y (b) NINGÚN producto del ticket tiene `financing_excluded`. Si no → **409** en español; el mensaje dice cuál producto lo impide (`"X" no está disponible con financiamiento…`) o que el negocio no tiene financiamiento activo. La lista de productos que lo impiden viaja en `blocked_products: [{ id, name }]`.
2. **Exclusión mutua con Divisa — UNA sola regla: se RECHAZA con 409, siempre, en los dos sentidos; nada se cambia solo.**
   - Pedir financiamiento en un ticket con `price_mode='divisa'` → 409 ("El financiamiento se cobra al precio BCV completo. Cambia el ticket a BCV antes de pedirlo.").
   - Pasar a `divisa` (PATCH `price-mode`, `POST /api/sales` con `price_mode:'divisa'`) un ticket con `financing_status` `requested` o `approved` → 409 ("…Retira el financiamiento para cobrar en Divisa.").
   - `rejected` NO bloquea: un ticket rechazado puede pasar a Divisa o a cualquier otro método.
   - Un ticket con financiamiento siempre se calcula con `price_mode='bcv'`.
3. **Estados** (solo mientras el ticket NO esté cobrado; si está cobrado → 409):
   `null → requested` (`request`) · `requested → approved | rejected` · `approved → rejected` · `rejected → requested` (`reopen`) · cualquiera `→ null` (`clear`, retira el financiamiento).
   Repetir el mismo estado no falla y no escribe bitácora. Cualquier otra transición → 409.
4. **Cobro** (`POST /api/sales` con status paid, `PATCH /api/sales/{id}/pay`, `POST /api/orders/{id}/cobrar`), validado DENTRO de la transacción con el estado bloqueado:
   | `financing_status` del ticket | pago con método `is_financing` | pago con método normal |
   |---|---|---|
   | `null` | 409 "Declara el financiamiento en el ticket y espera su aprobación" | OK |
   | `requested` | 409 "Falta la aprobación" | 409 "El ticket pide financiamiento: apruébalo, recházalo o retíralo" |
   | `approved` | OK — **todos** los pagos deben ser financiadora (todo o nada, no se mezcla) | 409 |
   | `rejected` | 409 | OK |
   La venta resultante hereda `financing_status/provider/phrase` y `price_mode='bcv'`. El stock descuenta SOLO al pasar a `paid` (nunca por aprobar).
5. Seguridad: `business_id` de `getSession()` en las rutas internas; en el checkout público, del slug. Un cajero solo opera SUS tickets de venta (igual que price-mode: 404 si es de otro cajero; el admin puede con cualquiera). Pedidos: sin guard de rol (como el resto de `/api/orders`).
6. **Aviso de despliegue:** hoy un cajero puede cobrar con un método `is_financing` sin declarar nada. Con esta regla ese cobro responde 409 hasta que la UI use el flujo declarar → aprobar → cobrar. CLI-B debe publicar la UI junto con (o antes que) este backend.

## 3. Endpoints

### 3.1 Declarar / aprobar / rechazar / retirar
`PATCH /api/sales/{id}/financing` y `PATCH /api/orders/{id}/financing` — body `{ "action": "request" | "approve" | "reject" | "reopen" | "clear" }`.
- Venta: estados `draft` | `pending` (un ticket `quote` no se cobra: 409). Pedido: sin cobrar y no cancelado/entregado.
- 200 → `{ ok: true, ticket }`:
```json
{ "ok": true, "ticket": { "kind": "order", "id": 412, "number": "PED-00412", "status": "received", "price_mode": "bcv",
  "total_usd": 120, "total_bs": 105825.6,
  "financing": { "status": "requested", "status_label": "Solicitado", "provider": "Cashea", "phrase": "Paga en cuotas con Cashea" } } }
```
  `financing` es `null` si el ticket no usa financiamiento.
- 400 `{ error:"Acción inválida" }` · 404 `Venta no encontrada` / `Pedido no encontrado`
- 409 `{ error, code?, blocked_products? }` — elegibilidad, exclusión mutua, transición inválida, ticket cobrado.

### 3.2 Checkout público — `POST /api/catalog/{slug}/order`
Campo nuevo opcional `payment_kind: "cashea" | "bs" | "divisa"` (el `payment_method` en texto sigue igual). Si falta y el método elegido es `is_financing` (compatibilidad) se toma como `cashea`.
- `cashea`: valida la regla 1 y la cédula natural (V/E); guarda `financing_status='requested'` + snapshot proveedor/frase; el pedido queda a precio BCV. Falla → **409** `{ error, field:"payment_kind", blocked_products? }`.
- `bs` / `divisa`: solo se guarda `orders.payment_kind` (declaración del cliente). **El pedido se crea a precio BCV en ambos casos** (el catálogo público muestra precio BCV; el personal pasa el pedido a Divisa con `PATCH /api/orders/{id}/price-mode` si corresponde).
- Respuesta del checkout sin cambios.

### 3.3 POS — `POST /api/sales`
Campo nuevo opcional `financing: "cashea"`: solo con `status:"pending"` (declara al crear, mismo efecto que `request`; reglas 1 y 2). Con `status:"paid"` y un método `is_financing` → regla 4 (409); el flujo POS con Cashea es: crear pendiente (con `financing`) → `approve` → `PATCH /api/sales/{id}/pay` con el método financiador.

### 3.4 Lectura
`GET /api/orders`, `GET /api/sales`, `GET /api/pos/drafts` ya devuelven los campos nuevos (`financing_status`, `financing_provider`, `financing_phrase`, y `payment_kind` en pedidos).

## 4. Reportes y caja (el monto de financiamiento no se mezcla con Bs/Divisa)
- `GET /api/sales?financing=cashea` y `GET /api/reports/sales?financing=cashea`: solo ventas con financiamiento (`financing_status` no nulo) — valor `none` = solo las que no.
- `GET /api/reports/day`: `payment_methods[]` ahora incluye `is_financing`, y `summary_financing: { usd, count }` con lo cobrado por métodos financiadores (aparte; sigue incluido en `cobrado_usd`).
- `GET /api/cash/status`: `turnoStats.financiamiento: { usd, bs }` (cobros del turno con métodos financiadores). El efectivo esperado NO cambia: ya contaba solo métodos de tipo efectivo.

## 5. Qué debe cablear CLI-B
- POS y detalle de pedido: selector "Cashea" declarado en el ticket (pedir, aprobar/rechazar, retirar), con el estado visible (Solicitado / Aprobado / Rechazado) y el proveedor del snapshot. Con Cashea pedido/aprobado, el modo Divisa se deshabilita; con Divisa activo, "Cashea" muestra el motivo (409).
- Cobro: con `approved` ofrecer SOLO métodos `is_financing` (todo o nada); con otro estado ofrecer solo los normales. Mostrar `error` del 409 tal cual.
- Checkout del catálogo: enviar `payment_kind`; en 409 mostrar `error` y marcar los `blocked_products`.
- Reportes: leer `summary_financing` y `is_financing` para mostrar Cashea aparte.
