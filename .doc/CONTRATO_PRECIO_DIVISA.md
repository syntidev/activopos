# Contrato backend para CLI-B — modo de precio del ticket (BCV / Divisa)

Fecha: 2026-10-21 · Autor: CLI-A · Estado: IMPLEMENTADO en la rama main local y probado en el negocio 87 local (tests/precio-divisa.spec.ts, 9 PASS). Sin push, sin deploy; la migración `20261021000001_add_price_mode` NO está aplicada en el VPS.

## 1. Idea
El precio que se cobra lo decide un **modo del ticket**, no el tipo de cliente:
- `bcv` (por defecto): precio de venta (`price_per_unit_usd` / `price_per_kg_usd`), se paga en Bs a tasa BCV.
- `divisa`: precio en dólar directo = `wholesale_price_usd` (o `wholesale_price_per_kg_usd` en productos por peso). La UI lo llama "Divisa"; NO se renombran columnas ni endpoints.

El modo se puede cambiar en cualquier momento mientras el ticket o pedido NO esté cobrado; todo el ticket (líneas y total) se recalcula en el servidor. El tier Mayorista del cliente sigue existiendo: solo aplica cuando el POS NO manda `price_mode` (compatibilidad); un `price_mode` explícito siempre gana.

`products.precio_divisa` y `precio_cashea` NO participan (usos previos distintos; ver sección 7).

## 2. Campos nuevos (migración aditiva `20261021000001_add_price_mode`)
| tabla | columna | tipo | default |
|---|---|---|---|
| `sales` | `price_mode` | VARCHAR(10) NOT NULL | `'bcv'` |
| `orders` | `price_mode` | VARCHAR(10) NOT NULL | `'bcv'` |
| `sale_items` | `price_source` | VARCHAR(15) NULL | NULL (= `'bcv'` en filas viejas) |
| `order_items` | `price_source` | VARCHAR(15) NULL | NULL (= `'bcv'` en filas viejas) |

`price_source` por línea indica el ORIGEN del `price_per_unit_usd` realmente aplicado:
`'bcv'` · `'divisa'` · `'manual'` (precio puesto a mano con PIN de admin, se respeta siempre) · `'fallback_bcv'` (se pidió divisa pero la línea no tiene precio Divisa → se cobra BCV; la UI debería marcarla).

## 3. Reglas de cálculo (una sola función en servidor: `resolveLinePrice` en `src/lib/pricing.ts`)
1. Línea con precio manual (`unit_price_override` en ventas / `price_source='manual'` en pedidos) → ese precio, origen `manual`, en cualquier modo.
2. Modo `bcv` → regla de siempre (precio de venta; variante con `price_usd` propio gana; + `precio_extra`), origen `bcv`.
3. Modo `divisa`:
   - producto por peso (`sale_mode='weight'`) usa `wholesale_price_per_kg_usd`; el resto `wholesale_price_usd`;
   - si es > 0 → ese precio (+ `precio_extra` de la variante), origen `divisa`;
   - si no existe o es 0 → precio BCV, origen `fallback_bcv`;
   - variante con `price_usd` propio (override absoluto) → NO tiene equivalente Divisa → precio de la variante, origen `fallback_bcv`.
4. Venta o pedido cobrado NO acepta cambio de modo: **409** con mensaje en español (mostrar `error` tal cual).
5. El servidor recalcula desde la base de datos; nunca confía en precios del cliente (salvo líneas `manual` ya autorizadas). `business_id` siempre de la sesión.
6. Stock descuenta SOLO cuando la venta pasa a `paid` (o `credit`, como siempre). Cambiar el modo nunca mueve stock.
7. **Permisos y bitácora:** un cajero solo cambia el modo de SUS tickets (draft, pending, quote); si el ticket es de otro cajero responde **404** (el admin sí puede con cualquiera). Todo cambio REAL de modo (venta o pedido, también el que llega por `price_mode` en `cobrar`) queda en `activity_logs` con `action='price_mode_changed'`, quién (`user_id`), `old_values.price_mode`, `new_values.price_mode` y el id de la venta/pedido. NO hay PIN ni rol especial para cambiar el modo (pendiente de decisión de Carlos).
8. **Concurrencia:** cambiar el modo y cobrar se serializan con un cerrojo de fila: si el cobro gana, el cambio responde 409; si el cambio gana, el cobro revalida el total nuevo y puede responder 400 "Pago insuficiente" (el cliente debe volver a pedir el total y cobrar de nuevo).
9. Los descuentos (`discount_usd` por línea) son montos absolutos y se conservan tal cual al recalcular (nunca dejan una línea en negativo). El cliente recalcula su descuento global con los precios del modo y lo envía.

## 4. Endpoints

### 4.1 Cambiar el modo de una venta abierta
`PATCH /api/sales/{id}/price-mode` — body `{ "price_mode": "divisa" }`
Aplica a ventas en estado `draft` (pestaña abierta del POS), `pending` y `quote`.
- 200 → `{ ok:true, ticket }` (ver 4.3)
- 400 `{ error:"Modo de precio inválido" }` · 404 `{ error:"Venta no encontrada" }`
- 409 `{ error:"Esta venta ya fue cobrada; no se puede cambiar el modo de precio." }` (`paid`; otros estados cerrados dicen su estado).

### 4.2 Cambiar el modo de un pedido (incluye los del catálogo web)
`PATCH /api/orders/{id}/price-mode` — body `{ "price_mode": "divisa" }`
- 200 → `{ ok:true, ticket }` · 404 `Pedido no encontrado`
- 409 `{ error:"Este pedido ya fue cobrado; no se puede cambiar el modo de precio." }` (también pedidos cancelados o entregados).
Actualiza líneas, `total_usd`, `total_bs`, `rate_used` y `price_mode` del pedido.

### 4.3 Respuesta `ticket` (ambos endpoints)
```json
{
  "ok": true,
  "ticket": {
    "kind": "order",
    "id": 412,
    "number": "PED-00412",
    "status": "received",
    "price_mode": "divisa",
    "rate": 881.88,
    "total_usd": 440,
    "total_bs": 388027.2,
    "fallback_lines": 1,
    "items": [
      { "id": 9001, "product_id": 55, "variant_id": null, "product_name": "Casco Kask", "quantity": 1,
        "price_per_unit_usd": 400, "price_source": "divisa", "discount_usd": 0, "subtotal_usd": 400, "subtotal_bs": 352752 },
      { "id": 9002, "product_id": 61, "variant_id": 77, "product_name": "Guantes", "quantity": 2,
        "price_per_unit_usd": 20, "price_source": "fallback_bcv", "discount_usd": 0, "subtotal_usd": 40, "subtotal_bs": 35275.2 }
    ]
  }
}
```
Sin costos (apto para cajero). En pedidos, `total_usd` incluye `delivery_fee`.

### 4.4 Crear / cobrar con modo
- `POST /api/sales` — body acepta `price_mode?: 'bcv'|'divisa'`. Si falta: se deriva del tier del cliente (mayorista → `divisa`, resto `bcv`). La venta guarda el modo EFECTIVO y cada línea su `price_source`. El POS debe enviarlo siempre.
- `POST /api/pos/drafts` y `PATCH /api/pos/drafts/{id}` — aceptan `price_mode?`; en PATCH, si falta, se conserva el de la venta.
- `POST /api/orders` — acepta `price_mode?` (default `bcv`).
- `POST /api/orders/{id}/cobrar` — acepta `price_mode?` (si viene, se aplica y se persiste en el pedido antes de cobrar); si no, usa el del pedido. La venta resultante hereda `price_mode` y `price_source`.
- Todas las respuestas que ya devuelven la venta/pedido incluyen ahora `price_mode` y `items[].price_source`.
- `GET /api/sales` y `GET /api/reports/sales` aceptan `?price_mode=bcv|divisa` para segmentar. Caja y reportes siguen sumando lo realmente cobrado (`sale_payments` / totales de la venta): no cambian.

## 5. Qué debe cablear CLI-B
- Interruptor "BCV / Divisa" en el ticket del POS y en el detalle del pedido (nombre en UI: "Divisa"; el tier Mayorista del cliente deja de decidir el precio en pantalla).
- Al cambiar: `PATCH .../price-mode` y pintar `ticket` devuelto (no recalcular precios en el cliente para ventas guardadas). En el ticket aún no guardado del POS, calcular con `wholesale_price_usd` / `wholesale_price_per_kg_usd` que ya trae `/api/products/search`.
- Marcar las líneas `fallback_bcv` ("sin precio Divisa") y mostrar USD y Bs juntos como siempre.
- Deshabilitar el interruptor si el servidor responde 409 y mostrar `error`.

## 6. Mapa de dónde se elige el precio hoy
Archivos clave: `src/lib/pricing.ts` (regla única), `src/lib/pos.ts:119-125,173,205` (precio en el carrito del cliente), `src/app/api/sales/route.ts:353-408`, `src/app/api/pos/drafts/route.ts:107`, `src/app/api/pos/drafts/[id]/route.ts:109`, `src/app/api/orders/route.ts:~140`, `src/app/api/orders/[id]/items/route.ts:~58`, `src/app/api/orders/[id]/cobrar/route.ts:~114`, `src/app/api/catalog/[slug]/order/route.ts:354`.

## 7. Pendientes conocidos (no incluidos)
- `precio_divisa` y `wholesale_price_usd` NO se superponen en los datos reales: en el respaldo del negocio 33 (19-oct, 160 productos) hay 44 con `precio_divisa` y 86 con `wholesale_price_usd`, y NINGUNO con ambos (son dos conjuntos disjuntos). Consecuencia: los 44 productos que solo tienen `precio_divisa` caen a `fallback_bcv` en modo Divisa. Si Carlos quiere que ese valor sea su precio Divisa, es una decisión de datos (copiar `precio_divisa` a `wholesale_price_usd` donde esté vacío, con dry-run y autorización); no se hace automático.
- Los descuentos globales/IVA/cargo del POS los calcula el cliente y llegan como `discount_usd` por línea; un ticket guardado que cambia de modo conserva esos montos (el cliente debe re-enviar el descuento calculado con los precios nuevos si usa descuento global).
- Conversión de cotización a venta (`quotations/[id]/convert`) conserva los precios de la cotización.
- `PATCH /api/orders/{id}/items` recrea las líneas sin `variant_id` (defecto previo); no se toca aquí.
