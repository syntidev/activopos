# Contrato de API — checkout público con cédula, dirección guardada y métodos de envío

Autor: CLI-A · Para: CLI-B (carrito público, Pedidos y Configuración) · Estado: implementado y probado en LOCAL (negocio 87). Sin push ni deploy.
Versión: incluye las correcciones de la auditoría de CLI-C (lock por cliente, `branch_office`, 503, límites nuevos, método congelado).
Reglas generales: errores siempre `{ "error": string, "field"?: string }`. `business_id` sale del slug (rutas públicas) o de la sesión
(rutas autenticadas); nunca del body. JSON inválido en cualquier endpoint de este contrato → `400 { "error": "JSON inválido" }` (o `Datos inválidos`).

## 1. `POST /api/catalog/[slug]/order` (público) — crear pedido

| Campo | Regla |
|---|---|
| `customer_cedula` | **obligatoria SIEMPRE** (retiro y envío). `V`/`E`/`J`/`G`, 5-10 dígitos, con o sin guion/puntos/minúsculas; se rechaza vacío, formato inválido y solo ceros. Se guarda normalizada `V-12345678`. |
| `customer_phone` | ≥ 7 dígitos. Se guarda normalizado a 11 dígitos nacionales (`04141234567`). |
| `use_saved_address` | `boolean` opcional (solo cuenta si `delivery_type = "delivery"`). Ver §1.1. |
| `shipping_method_id` | `number \| null`. Obligatorio en envío SOLO si el negocio tiene métodos activos (§3). |
| `branch_office` | **nuevo**. `string` (3-120). **Obligatorio solo si el método elegido tiene `requires_branch = true`**; en otro caso se ignora. El servidor lo antepone a la dirección: `"Oficina: <branch_office> \| <dirección>"`. La UI manda la dirección SIN la oficina. |

Request (envío con método que pide oficina):
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
  "delivery_address": "Estado Nueva Esparta, Porlamar, Av. 4 de Mayo, frente a la plaza",
  "shipping_method_id": 5,
  "branch_office": "MRW Porlamar"
}
```
El pedido queda con `ship_direccion = "Oficina: MRW Porlamar | Estado Nueva Esparta, Porlamar, Av. 4 de Mayo, frente a la plaza"`.
El cliente guardado conserva la dirección SIN la oficina (para reutilizarla con otro método).

### 1.1 "Misma dirección" (`use_saved_address: true`)
El `delivery_address` del body **se ignora**: el servidor copia la guardada del cliente identificado por cédula. Solo se honra si
se cumplen **todas**: la cédula tiene cliente; el **teléfono** del pedido es el del MISMO cliente (en cualquier formato); el
`customer_name` coincide con el del cliente en **al menos 2 palabras** (sin acentos ni mayúsculas); el cliente tiene dirección válida.
Si falla cualquiera → `422` con el **mismo cuerpo exacto** (no es un oráculo):
`{ "error": "No pudimos usar una dirección guardada. Escribe la dirección de envío.", "field": "delivery_address" }`.
La UI debe mostrar entonces el campo de dirección normal. Con `requires_branch`, `branch_office` sigue siendo obligatorio.
El texto de WhatsApp dice "Misma dirección de pedidos anteriores": la dirección guardada nunca viaja al público.

### 1.2 Respuesta `201` (no cambia)
```json
{ "ok": true, "order_id": 185, "ticket_number": "ACT-00006", "whatsapp_url": "https://wa.me/58...?text=..." }
```
El mensaje de WhatsApp al negocio ahora incluye la línea `Método de envío: <etiqueta>` (y la oficina dentro de `Dirección`).
El **ticket de envío** (`/api/shipping-data`, "Copiar datos", etiqueta 58 mm) NO cambia: sigue con nombre, cédula, teléfono y dirección.

### 1.3 Errores

| Status | Cuándo | `field` |
|---|---|---|
| 400 | JSON inválido / slug inválido | — |
| 422 | cédula vacía / inválida / solo ceros | `customer_cedula` |
| 422 | teléfono inválido | `customer_phone` |
| 422 | faltan nombre y apellido / dirección corta (envío) | `delivery` |
| 422 | negocio con métodos activos y `shipping_method_id` ausente o ajeno | `shipping_method_id` |
| 422 | el método elegido es de tipo `pickup` (retiro en tienda) y el pedido es de envío | `shipping_method_id` |
| 422 | método con `requires_branch` y `branch_office` ausente o de menos de 3 caracteres | `branch_office` |
| 422 | `use_saved_address` sin dirección utilizable (ver §1.1) | `delivery_address` |
| 409 | stock insuficiente | — |
| 429 | demasiados intentos: por IP (10 pedidos/15 min), por teléfono (6/h), **por cédula (6/h, llave `slug:cédula`)**, o ya hay **3 pedidos `received`** de esa cédula o teléfono | — |
| **503** | **el cliente ya tiene otro pedido en curso que no terminó a tiempo (espera máx. 5 s por su lock), deadlock o transacción vencida.** Cuerpo `{ "error": "Estamos recibiendo muchos pedidos. Reintenta en unos segundos." }` + cabecera `Retry-After: 2`. **No se creó nada: la UI debe ofrecer "Reintentar" con los mismos datos.** | — |
| 500 | error inesperado (siempre JSON) | — |

Comportamiento que la UI NO verá (a propósito):
- Si la cédula ya existe con **otro nombre**, el pedido se crea igual con el nombre tecleado; el cliente registrado conserva el suyo
  y el pedido queda con `cedula_alert = true` para el negocio. La respuesta es idéntica a la normal.
- Un pedido público nunca modifica nombre ni dirección de un cliente existente.
- Los pedidos del MISMO cliente (misma cédula o mismo teléfono) se serializan; los de clientes distintos no se esperan entre sí
  ni bloquean las ventas del POS.

## 2. `POST /api/catalog/[slug]/saved-address` (público) — ¿ofrecer "misma dirección"?

Request: `{ "customer_cedula": "V-12345678", "customer_phone": "0414-1234567" }` — **ambos obligatorios** → Response `200` **siempre** `{ "has_saved_address": true | false }`.
Solo da `true` si cédula **y** teléfono corresponden al MISMO cliente y este tiene dirección guardada. Conocer solo la cédula no revela nada.
Cédula o teléfono inválidos o ausentes, body inválido, negocio inexistente, cédula desconocida, teléfono que no coincide o cliente sin dirección →
`false` (misma forma y tiempo mínimo 150 ms). `true` solo significa "vale la pena mostrar la opción": el POST del pedido decide (§1.1). **No muestres la dirección.**
Límites → `429 { "error": "Demasiados intentos..." }`: 10 consultas/15 min por IP, 5/h por `slug+cédula` y **5/h por `slug+teléfono`**.
La UI debe llamarlo cuando ya tenga cédula y teléfono tecleados (p. ej. al salir del segundo campo).

## 3. Métodos de envío

Lectura pública — `GET /api/catalog/[slug]/shipping-methods`:
```json
{ "ok": true, "methods": [
  { "id": 5, "code": "mrw", "label": "MRW", "kind": "carrier_branch", "requires_branch": true,
    "instructions": "Indica la oficina MRW de destino: estado, ciudad y nombre de la oficina." } ] }
```
Solo métodos activos, ordenados por `sort_order`. `kind`: `pickup | delivery | carrier | carrier_branch`.
- `requires_branch = true` → la UI muestra un campo aparte **"Oficina de destino"** y lo manda como `branch_office` (§1). Ya no va dentro de `delivery_address`.
- `kind = "pickup"` es "retiro en tienda": **no ofrecerlo como método de un envío** (el servidor lo rechaza con 422 si el pedido es de envío).
- Si `methods` viene vacío el negocio no configuró métodos: el envío funciona como antes (sin `shipping_method_id` ni `branch_office`).

CRUD autenticado (Configuración) — lectura: cualquier rol; **escritura: solo rol `admin`** (lista blanca; `cashier`, `super_admin` y cualquier otro → `403`):
- `GET /api/shipping-methods` → `{ ok, methods: [{ id, code, label, kind, requires_branch, instructions, active, sort_order, created_at, updated_at }] }`
- `POST /api/shipping-methods` `{ code, label, kind, requires_branch?, active?, sort_order?, instructions? }` → `201 { ok, method }`.
  `code`: `a-z 0-9 _ -`, 2-40, único por negocio (`409` si se repite). No se puede editar después.
- `PATCH /api/shipping-methods/[id]` (campos opcionales, sin `code`) → `200 { ok, method }`
- `DELETE /api/shipping-methods/[id]` → `200 { ok: true }`, o `409` si tiene pedidos (desactívalo con `active: false`).

## 4. Edición del envío

- Dirección guardada del cliente: `PATCH /api/clients/[id]` acepta `address` (`string | null`; ≥ 15 caracteres; `null`/vacío la borra) y
  `verified` (`boolean`, solo admin). **Si el cliente está `verified`, cambiar su `address` es solo de `admin` (`403` al cashier);** el
  cashier sí puede editar sus demás campos. `POST /api/clients` también acepta `address`. Cédula repetida en el negocio → `409`.
- Pedido, antes de imprimir: `PATCH /api/orders/[id]/shipping` con cualquiera de
  `{ ship_nombre, ship_cedula, ship_telefono, ship_direccion, ship_metodo_id }` (campos extra → `400`).
  Solo pedidos de envío en `received | preparing | ready` (`409` si ya salió). `422` con `field` si un dato no valida.
  Cambiar `ship_metodo_id` vuelve a congelar `ship_metodo_label` y `ship_metodo_kind` (con `null` quedan en `null`).
  `200 { ok, order: { id, order_number, ship_nombre, ship_cedula, ship_telefono, ship_direccion, ship_metodo_id, ship_metodo_label, ship_metodo_kind } }`.
  Cada edición queda en `activity_logs` (`action = "order_shipping_edited"`, quién y cuándo, y SOLO los nombres de los campos cambiados, nunca sus valores).
- `GET /api/shipping-data?order_id=` (etiqueta/"Copiar datos"): usa `ship_*` y cae a los campos viejos si no existen. No incluye el método.

## 5. Campos nuevos que verá la UI de Pedidos (`GET /api/orders`, `GET /api/orders/[id]`)

`ship_nombre`, `ship_cedula`, `ship_telefono`, `ship_direccion`, `ship_metodo_id`, **`ship_metodo_label`, `ship_metodo_kind`**, `cedula_alert`.
- `ship_metodo_label` / `ship_metodo_kind` son el método **tal como se eligió al crear el pedido**: no cambian si el negocio renombra, desactiva o borra el método. Mostrar ESTOS, no el método vivo.
- `cedula_alert = true` → la cédula del pedido ya pertenece a un cliente registrado con **otro nombre**: mostrar aviso al operador.
- `ship_direccion` puede empezar con `Oficina: <oficina> | ` cuando el método pidió oficina.
- El `client` embebido sigue siendo `{ id, name, phone }`.

## 6. Catálogo público: marca por producto

`GET /api/catalog/[slug]` → cada producto de `products[]` trae ahora **`brand_id: number | null`** y **`brand_name: string | null`** (nombre de la tabla `brands`).
Para filtrar "Comprá por marca" usa `brand_id` (no el texto del nombre). `brand_name` es solo para mostrar.
Pendiente de CLI-B: la página `catalogo/[slug]/page.tsx` (render del servidor) arma sus propios `CatalogProduct` y todavía no incluye la marca;
`p.brand_id` ya viene en su consulta (`include`), solo falta añadir `brand: { select: { name: true } }` y los campos al tipo `CatalogProduct`.

## 7. Notas de despliegue (no ejecutadas)

- Migración nueva `20261020000002_checkout_order_indexes_shipping_snapshot_locks` (aditiva): índices de `orders`, `ship_metodo_label/kind` y la tabla `web_order_locks`.
- `getClientIp` ya no usa `x-forwarded-for`: toma `cf-connecting-ip` y, sin él, `x-real-ip`. **A verificar en el VPS antes de desplegar (no revisado desde aquí):**
  que Nginx fije `proxy_set_header X-Real-IP $remote_addr;`. Sin esa cabecera todo el tráfico caería en un solo contador de IP.
- Los limitadores siguen siendo en memoria (por proceso PM2); la defensa consistente entre procesos es la de DB (tope de 3 pedidos abiertos + lock por cliente).
