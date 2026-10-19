# Contrato de API — checkout público con cédula, dirección guardada y métodos de envío

Autor: CLI-A · Para: CLI-B (carrito público y Configuración) · Estado: implementado y probado en LOCAL, sin commit.
Reglas generales: errores siempre `{ "error": string, "field"?: string }`. `business_id` sale del slug (rutas públicas)
o de la sesión (rutas autenticadas); nunca del body.

## 1. `POST /api/catalog/[slug]/order` (público) — crear pedido

Cambios respecto al contrato anterior:

| Campo | Antes | Ahora |
|---|---|---|
| `customer_cedula` | opcional (obligatoria solo en envío/financiadora) | **obligatoria SIEMPRE** (retiro y envío). `V`/`E`/`J`/`G`, 5-10 dígitos, se acepta con o sin guion/puntos/minúsculas; se rechaza vacío, formato inválido y solo ceros. El servidor la guarda normalizada `V-12345678`. |
| `customer_phone` | 7-20 caracteres | igual, y debe tener ≥ 7 dígitos. Se guarda normalizado a 11 dígitos nacionales (`04141234567`). |
| `use_saved_address` | — | **nuevo**, `boolean` opcional (solo cuenta si `delivery_type = "delivery"`). |
| `shipping_method_id` | — | **nuevo**, `number \| null`. Obligatorio en envío SOLO si el negocio tiene métodos activos (ver §3). |

Request (envío, dirección nueva):
```json
{
  "items": [{ "product_id": 1305, "qty": 1, "variant_id": 4410 }],
  "customer_name": "María Pérez",
  "customer_phone": "0414-1234567",
  "customer_cedula": "v-12.345.678",
  "customer_reference": "Porlamar",
  "payment_method": "Pago Móvil",
  "delivery_type": "delivery",
  "recipient_name": "María Pérez",
  "delivery_address": "Estado Nueva Esparta, Porlamar, oficina MRW Av. 4 de Mayo",
  "shipping_method_id": 5
}
```
Request ("misma dirección"): igual, pero con `"use_saved_address": true`. El `delivery_address` del body **se ignora**:
el servidor copia la guardada del cliente identificado por cédula.

Respuesta `201` (igual que antes; no cambia):
```json
{ "ok": true, "order_id": 185, "ticket_number": "ACT-00006", "whatsapp_url": "https://wa.me/58...?text=..." }
```
Con `use_saved_address` el texto de WhatsApp dice "Misma dirección de pedidos anteriores" (la dirección guardada nunca viaja al público).

Errores:

| Status | Cuándo | `field` |
|---|---|---|
| 422 | cédula vacía/ inválida / solo ceros | `customer_cedula` |
| 422 | teléfono inválido | `customer_phone` |
| 422 | faltan nombre y apellido / dirección corta (envío) | `delivery` |
| 422 | negocio con métodos activos y `shipping_method_id` ausente o ajeno | `shipping_method_id` |
| 422 | `use_saved_address` sin dirección utilizable | `delivery_address` — **mensaje único**: `"No pudimos usar una dirección guardada. Escribe la dirección de envío."` Idéntico si la cédula no existe, no tiene dirección o el nombre no coincide. La UI debe mostrar el campo de dirección normal. |
| 409 | stock insuficiente | — |
| 429 | demasiados intentos (IP: 10 pedidos/15 min; teléfono: 6/h) o ya hay **3 pedidos `received`** de esa cédula o teléfono | — |
| 500 | error inesperado (ya no es HTML: siempre JSON) | — |

Comportamiento que la UI NO verá (a propósito):
- Si la cédula ya existe con **otro nombre**, el pedido se crea igual con el nombre tecleado; el cliente registrado conserva el suyo
  y el pedido queda con `cedula_alert = true` para el negocio. La respuesta es idéntica a la normal: no hay pista del nombre registrado.
- Un pedido público nunca modifica nombre ni dirección de un cliente existente.

## 2. `POST /api/catalog/[slug]/saved-address` (público) — ¿ofrecer "misma dirección"?

Request: `{ "customer_cedula": "V-12345678", "customer_phone": "0414-1234567" }` — **ambos obligatorios** → Response `200` **siempre** `{ "has_saved_address": true | false }`.
Solo da `true` si cédula **y** teléfono corresponden al MISMO cliente y este tiene dirección guardada (el teléfono se compara en cualquier formato:
`0414-1234567`, `04141234567`, `+58 414 1234567`). Conocer solo la cédula no revela nada.
Cédula o teléfono inválidos o ausentes, body inválido, negocio inexistente, cédula desconocida, teléfono que no coincide o cliente sin dirección → `false` (misma forma y tiempo mínimo 150 ms).
La UI debe llamarlo cuando ya tenga cédula y teléfono tecleados (p. ej. al salir del segundo campo), no solo con la cédula.
Límites: 10 consultas/15 min por IP y 5/h por slug+cédula → `429 { "error": "Demasiados intentos..." }`.
`true` solo significa "vale la pena mostrar la opción"; el POST del pedido decide (también compara el nombre). **No muestres la dirección.**

## 3. Métodos de envío

Lectura pública — `GET /api/catalog/[slug]/shipping-methods`:
```json
{ "ok": true, "methods": [
  { "id": 5, "code": "mrw", "label": "MRW", "kind": "carrier_branch", "requires_branch": true,
    "instructions": "Indica la oficina MRW de destino: estado, ciudad y nombre de la oficina." } ] }
```
Solo métodos activos, ordenados por `sort_order`. `kind`: `pickup | delivery | carrier | carrier_branch`.
`requires_branch = true` → pide la oficina de destino dentro de `delivery_address` (no hay campo aparte).
Si `methods` viene vacío el negocio no configuró métodos: el envío funciona como antes (sin `shipping_method_id`).

CRUD autenticado (Configuración) — lectura: cualquier rol; escritura: solo admin/super_admin (`403` al cajero):
- `GET /api/shipping-methods` → `{ ok, methods: [{ id, code, label, kind, requires_branch, instructions, active, sort_order, created_at, updated_at }] }`
- `POST /api/shipping-methods` `{ code, label, kind, requires_branch?, active?, sort_order?, instructions? }` → `201 { ok, method }`.
  `code`: `a-z 0-9 _ -`, 2-40, único por negocio (`409` si se repite). No se puede editar después.
- `PATCH /api/shipping-methods/[id]` (campos opcionales, sin `code`) → `200 { ok, method }`
- `DELETE /api/shipping-methods/[id]` → `200 { ok: true }`, o `409` si tiene pedidos (desactívalo con `active: false`).

## 4. Edición del envío

- Dirección guardada del cliente: `PATCH /api/clients/[id]` acepta `address` (`string | null`; ≥ 15 caracteres; `null`/vacío la borra) y
  `verified` (`boolean`, solo admin). `POST /api/clients` también acepta `address`. Cédula repetida en el negocio → `409`.
- Pedido, antes de imprimir: `PATCH /api/orders/[id]/shipping` con cualquiera de
  `{ ship_nombre, ship_cedula, ship_telefono, ship_direccion, ship_metodo_id }` (campos extra → `400`).
  Solo pedidos de envío en `received | preparing | ready` (`409` si ya salió). `422` con `field` si un dato no valida.
  `200 { ok, order: { id, order_number, ship_nombre, ship_cedula, ship_telefono, ship_direccion, ship_metodo_id } }`.
- `GET /api/shipping-data?order_id=` (etiqueta/“Copiar datos”): usa `ship_*` y cae a los campos viejos si no existen.

## 5. Campos nuevos que verá la UI de Pedidos (`GET /api/orders`, `GET /api/orders/[id]`)

`ship_nombre`, `ship_cedula`, `ship_telefono`, `ship_direccion`, `ship_metodo_id`, `cedula_alert` (`true` = la cédula del pedido coincide
con un cliente registrado con otro nombre: mostrar aviso al operador). El `client` embebido sigue siendo `{ id, name, phone }`.
