# PRD — Módulo Restaurante (mesas, cuentas, estaciones y KDS)

Versión R0.1 | 2026-11-04 | Estado: PROPUESTA, mockups pendientes de aprobación de Carlos (no se empieza R1 sin ella)
Rama: `feat/restaurante` | Sin código de producto en esta fase.

---

## 1. Objetivo y alcance

Llevar ActivoPOS del mostrador al salón: un negocio de comida atiende **mesas**, abre **cuentas**,
manda lo pedido a la **estación** que lo prepara (Cocina, Barra, Fría, Sándwich…), la estación lo ve
en su **KDS**, y al final se **cobra con el POS actual** (pago mixto, Divisa/Bs, Cashea).

Dentro de alcance: áreas y mesas con plano, cuenta de mesa, notas/modificadores/cursos, ruteo a estaciones,
KDS por estación, pedir cuenta, cobro, dividir/juntar/transferir mesas, propina, estados de mesa, búsqueda global.

Fuera de alcance de R1-R5 (se declara, no se improvisa): reservas de mesa con calendario, impresión de comandas
en impresora térmica por estación (queda el campo, no el driver), reparto de propinas con nómina,
inventario por receta de insumos (se usa el descuento actual de stock al pagar), delivery propio con repartidores.

Principios sellados que aplican (CLAUDE.md): `business_id` siempre de `getSession()`; paradigma `qty × price`;
USD y Bs siempre juntos (`$15.00` / `Bs. 8,951.73`); el stock baja SOLO cuando la venta pasa a `paid`;
precios siempre del servidor; búsqueda híbrida de un solo input; módulo por negocio con flag propio apagado por defecto.

---

## 2. Roles

| Rol | Quién es | Puede | No puede |
|---|---|---|---|
| **mesonero** (`waiter`) | Atiende mesas | Ver plano, abrir cuenta, agregar/enviar ítems, anular ítem NO enviado, pedir cuenta, marcar ítem `servido`, transferir SU mesa | Cobrar, ver costos/utilidad, configurar, anular ítem ya enviado sin autorización de admin, ver ventas del día |
| **cocinero** (`kitchen`) | Trabaja en una estación | Ver el KDS de SUS estaciones, pasar ítem a `en preparación` / `listo`, marcar `no disponible` | Ver precios, cuentas, mesas, nada fuera del KDS |
| **cajero** (`cashier`, ya existe) | Caja | Todo lo del mesonero + cobrar, dividir, juntar, aplicar propina, liberar mesa | Configurar áreas/mesas/estaciones, ver costos |
| **admin** (ya existe) | Dueño/gerente | Todo; configura plano, estaciones, ruteo, modificadores; autoriza anulaciones y descuentos | — |

`mesonero` y `cocinero` son **roles restringidos con denegación por defecto**, mismo patrón que `operador_reservas`
(lista blanca en `middleware.ts`, shell mínimo propio). Un negocio pequeño puede usar solo `cashier` + `admin`
y nada se rompe: el mesonero es un rol opcional.

Un usuario `cocinero` queda ligado a una o varias estaciones (`UserStation`). Sin estación asignada ve un aviso, no el KDS.

---

## 3. Glosario de estados

### 3.1 Mesa

| Estado | Color (mockup) | Significado | Cómo entra |
|---|---|---|---|
| `libre` | verde | Sin cuenta, lista para sentar | Mesa limpia / liberar |
| `ocupada` | azul | Tiene cuenta abierta | Abrir cuenta |
| `por_cobrar` | ámbar | Cuenta con "pedir cuenta" hecho | Pedir cuenta |
| `reservada` | morado | Apartada a mano (nombre + hora), sin cuenta | Marcar reservada |
| `por_limpiar` | gris | Cobrada, falta limpiar | Cobro completo |

Regla: `ocupada` y `por_cobrar` **no se guardan, se derivan** de la cuenta abierta (`Order.account_status`).
Solo `reservada` y `por_limpiar` son marcas manuales sobre la mesa. Así el plano nunca contradice a la cuenta.

### 3.2 Cuenta (`Order` con `origin = 'table'`, campo `account_status`)

`open` → `bill_requested` → `closed` (cobrada) | `void` (anulada). De `bill_requested` se vuelve a `open` si el cliente pide algo más.

### 3.3 Ítem (`OrderItem.kds_status`)

`draft` (en la cuenta, sin enviar) → `sent` → `preparing` → `ready` → `served`.
Cualquier estado → `void` (con motivo y quién). Un ítem `void` no suma al total; en el KDS queda tachado hasta que cocina confirma "Visto".

---

## 4. Flujos

### F1. Abrir cuenta
**Actor:** mesonero o cajero.
1. Plano de áreas → toca una mesa `libre` (o `reservada`).
2. Modal: **comensales** (obligatorio, 1..capacidad+4), **mesonero** (por defecto el usuario; el cajero puede escoger otro), cliente opcional (búsqueda en clientes).
3. Se crea `Order` (`origin=table`, `account_status=open`, `table_id`, `guests`, `waiter_id`, `opened_at`). La mesa pasa a `ocupada`.

Excepciones:
- Mesa ya ocupada (dos dispositivos a la vez) → `409` con el id de la cuenta existente; el segundo abre esa.
- Mesa `por_limpiar` → permite abrir con confirmación "¿Ya está limpia?".
- Sin tasa BCV del día → se abre igual con la última tasa guardada (nunca se bloquea).

**Aceptación:** abrir cuenta en mesa 5 con 3 comensales → `GET /api/restaurante/mesas` devuelve mesa 5 `ocupada`, `guests=3`, `waiter_id` correcto; abrirla otra vez devuelve `409`.

### F2. Agregar ítems
1. Buscador único (nombre, SKU, código de barras, categoría) + chips de categoría. Toca producto → cantidad (entero para `unit`, decimal para `weight`) → opcionales: **modificadores** (sin cebolla, término medio, extra queso +$1.00), **nota** (≤120), **curso** (1 Entrada, 2 Fondo, 3 Postre; por defecto 1), asiento (para dividir luego).
2. Cada ítem queda `draft`. El precio lo calcula el servidor (producto + variante + modificadores); el cliente NUNCA manda precio.
3. El total muestra USD y Bs simultáneos.

Excepciones: producto sin stock (si lleva control de stock) → aviso, continúa solo con autorización de admin; producto inactivo → no aparece; grupo de modificador obligatorio sin elegir → no deja agregar.

**Aceptación:** agregar 2 × "Pasta" con "extra queso" → la línea trae `price_per_unit_usd = base + extra` calculado en servidor; un body con `price_per_unit_usd` se ignora (test).

### F3. Enviar a estaciones
1. Botón **Enviar** (por defecto los `draft` del curso 1; "Enviar curso 2" luego; o "Enviar todo").
2. En una transacción: por cada ítem `draft` resuelve estación (F4), pasa a `sent`, fija `sent_at` y congela `station_id`.
3. Ítems cuya categoría no requiere preparación (`Category.requires_preparation = false`) y sin estación explícita nacen `ready` (no pasan por KDS); el mesonero los marca `served`.

Excepciones: cuenta `bill_requested` → al enviar vuelve a `open`; estación inactiva → cae a la estación por defecto; sin estación por defecto → `422` "Configura una estación por defecto".

**Aceptación:** cuenta con 1 plato (Cocina) y 1 cerveza (Barra): al enviar, `GET /api/restaurante/kds?station=<Cocina>` trae solo el plato y `station=<Barra>` solo la cerveza, ambos con `sent_at`.

### F4. Ruteo ítem → estación
Resolución con snapshot al enviar: `Product.station_id` (override) → `Category.station_id` (default) → estación `is_default` del negocio. Cambiar el ruteo después NO mueve ítems ya enviados.

### F5. KDS por estación
Pantalla horizontal (tablet) por estación: `/kds?station=<id>`. Columnas **Pendiente / En preparación / Listo**; tarjeta por **comanda** (mesa, mesonero, hora de envío) con los ítems de ESA estación, notas y modificadores destacados. Sin precios.
- Acciones por ítem o por comanda: `Iniciar` (sent→preparing), `Listo` (preparing→ready). `Deshacer` el último paso (30 s).
- **Tiempos:** cronómetro desde `sent_at`. Umbrales por estación: ámbar (`warn_min`, defecto 10) y rojo (`critical_min`, defecto 20). Sonido al entrar ítem nuevo y al pasar a rojo (una vez); la alerta nunca depende solo del sonido.
- **Cursos:** ítems de curso 2+ aparecen atenuados "Espera curso 1" hasta que los de curso anterior de esa mesa estén `ready`/`served`, o el mesonero use **Disparar**.
- **Anulado:** ítem ya enviado y anulado aparece tachado en rojo con motivo; cocina confirma "Visto".
- **Listo:** notifica al mesonero de la mesa (badge en su plano y aviso en móvil). El mesonero lo marca `served`.
- Refresco: sondeo cada 3 s con cursor `since` (el KDS actual sondea cada 30 s).
- Una comanda se toma por un cocinero (`started_by`); otro puede quitársela con confirmación.

Excepciones: sin red → banner "Sin conexión, reintentando" y acciones encoladas (máx 20); al volver, si el ítem ya cambió (409) se refresca sin duplicar. Estación sin ítems → estado vacío con hora de última actualización.

**Aceptación:** pasar un ítem a `preparing` y `ready` fija `started_at`/`ready_at`; el mesonero ve el badge "listo" en ≤ 5 s sin recargar.

### F6. Pedir cuenta
Mesonero o cajero → **Pedir cuenta**: `account_status=bill_requested`, mesa `por_cobrar`, aviso a caja. Muestra la pre-cuenta (imprimir/compartir) con USD y Bs y propina sugerida. Si hay ítems `draft` → "¿Enviarlos o descartarlos?". Si hay ítems sin servir → advertencia, no bloqueo.

### F7. Cobrar con el POS actual
Solo `cashier`/`admin`. **Cobrar** crea la(s) `Sale` a partir de los ítems no anulados (precios del servidor) y abre el cobro existente del POS:
- **Pago mixto** (varias formas de pago en una venta, **máximo 10 pagos por venta**), **Divisa/Bs** (`price_mode`), **Cashea** (financiamiento), cédula cuando aplica: mismas reglas y validaciones de hoy, porque el cobro llama a `/api/sales/[id]/cargo` y `/api/sales/[id]/pay` actuales. El total lo fija el servidor al crear la venta; la pantalla nunca lo envía.
- La venta queda vinculada a la cuenta y a la mesa; el stock baja solo al quedar `paid`.
- Con toda la cuenta pagada: `account_status=closed`, `Order.status=delivered`, mesa `por_limpiar`.
- La propina (F9) se registra aparte de la venta.

Excepciones: cuenta dividida → la mesa sigue `por_cobrar` hasta pagar todas las ventas hijas; venta anulada después → la cuenta se reabre solo con rol admin; Cashea `requested` sin aprobar → mismas reglas de hoy; sin caja abierta → mismo bloqueo del POS.

**Aceptación:** cuenta de $30.00 pagada con $10.00 en efectivo + el equivalente en Bs de $20.00 por pago móvil → una `Sale` `paid` con 2 `SalePayment`; stock descontado; cuenta `closed`; mesa `por_limpiar`; ventas netas del día suben exactamente $30.00 (`npm run test:consistency` en verde).

### F8. Dividir cuenta
Tres modos al cobrar:
1. **Por ítems:** se asignan ítems (o fracciones de cantidad, ej. 0.5 de una pizza) a "Cuenta A/B/C". Genera **una Venta por subcuenta**.
2. **Partes iguales (N):** UNA venta con N pagos (cada comensal con su método). No parte líneas de producto.
3. **Por monto:** como (2) con montos libres que deben sumar el total.
Desglose siempre en USD y Bs.

**Aceptación:** cuenta de 4 ítems dividida por ítems en 2 subcuentas → 2 `Sale` cuyos totales suman el total de la cuenta; cobrar solo A deja la mesa `por_cobrar`; cobrar B la cierra.

### F9. Propina
- Sugeridas 0 / 10 / 15 / 20 % + monto libre, en USD con Bs al lado. Puede pagarse con método distinto al de la venta (consumo con tarjeta, propina en efectivo).
- **La propina NO es venta**: no entra en ventas netas, COGS ni márgenes. Tabla propia (`SaleTip`) con mesonero; reporte por día y mesonero.
- Propina en efectivo SÍ afecta el efectivo esperado de la caja (mismo criterio que el reembolso en efectivo del estándar contable).

### F10. Juntar mesas
Cajero/admin selecciona 2+ mesas → **Juntar** → una sola cuenta (la de la mesa destino) con los ítems de ambas; mesas unidas en el plano con el mismo estado. Al cobrar, todas pasan a `por_limpiar`. **Separar** solo si la cuenta no tiene pagos.

### F11. Transferir
- **Mesa → otra mesa libre:** mueve la cuenta; la origen queda `por_limpiar` o `libre` según se indique.
- **Mesonero → otro mesonero:** cambia `waiter_id`.
- **Ítems entre cuentas:** mover ítems `draft` o `sent` a otra cuenta abierta.
Todo queda en `TableEvent` (quién, desde, hacia, cuándo).

### F12. Liberar mesa
`por_limpiar` → **Mesa limpia** → `libre`; lo hace cualquier rol de salón. Una mesa con cuenta abierta no se libera: se **anula** la cuenta (admin; cajero solo si no tiene ítems enviados).

### F13. Anulaciones
- Ítem `draft`: lo quita cualquiera de salón, sin rastro.
- Ítem `sent`/`preparing`/`ready`/`served`: exige **motivo** y **autorización de admin** (mismo mecanismo de `authorize-discount`); queda `void` con quién y por qué; el KDS lo marca.
- Cuenta completa: solo sin ventas pagadas; admin.

---

## 5. Estados de mesa y relación con `/reservas`

**Hallazgo:** el módulo `/reservas` existente (modelo `Reserva`) es de **apartado de kits con tallas** (caso OnBike, flag `reservas_enabled`), NO de mesas. No se reutiliza ni se toca.

Para el estado `reservada`:
- **R1-R5:** marca manual sobre la mesa (`reserved_for` nombre, `reserved_at` hora, `reserved_phone` opcional); la pone y quita cajero/admin. Cero dependencia de `/reservas`.
- **Fase posterior (no incluida):** modelo propio `TableReservation` con calendario, si Carlos lo aprueba; separado de `Reserva` para no cruzar dominios.
- Un negocio con `reservas_enabled` y `restaurante_enabled` ve ambos módulos sin interferencia.

---

## 6. Búsqueda en todo (convención híbrida, obligatoria)

Un solo input por pantalla; varias palabras = AND entre palabras, OR entre campos; parcial, sin distinguir mayúsculas ni acentos; texto como parámetro Prisma (`contains`); ≤60 caracteres y ≤5 palabras; doble capa (filtro instantáneo en cliente + `?q=` en servidor).

| Pantalla | Campos |
|---|---|
| Plano / mesas | etiqueta de mesa, área, cliente de la cuenta, mesonero, nº de cuenta |
| Cuentas abiertas / historial | nº de cuenta, mesa, mesonero, cliente (nombre/teléfono normalizado), producto dentro de la cuenta |
| Productos (al agregar) | nombre, SKU, código de barras, categoría |
| KDS | mesa, nº de comanda, producto, mesonero |
| Configuración | nombre de área / mesa / estación / producto en el ruteo |

Referencia: `src/lib/reservas.ts` (`parseSearchParam`) y `matchesSearch`.
**Aceptación:** `"juan 5"` encuentra la cuenta de la mesa 5 a nombre de Juan; `"cocina pasta"` en el KDS encuentra comandas con pasta en Cocina; `"0414-555"` encuentra al cliente `04145551234`.

---

## 7. Requisitos transversales

- **Dual moneda:** toda cifra monetaria = USD y Bs juntos (pre-cuenta, cobro, reportes). El KDS no muestra precios.
- **Tiempo real:** sondeo de 3 s con `since`; el plano refleja un cambio de otro dispositivo en ≤ 5 s.
- **Móvil primero para el mesonero** (375 px, sin scroll horizontal, targets ≥ 44 px); **tablet horizontal para KDS**; **escritorio para plano y configuración**.
- **Accesibilidad:** el estado de mesa nunca va solo por color (ícono + texto); KDS con contraste alto.
- **Auditoría:** cambios de mesa, anulaciones, transferencias y reaperturas en `TableEvent`.
- **Aislamiento:** modelos nuevos con `business_id` (el tenant layer los toma solo); `OrderItem` se consulta siempre vía su `Order` o su estación validada del negocio.
- **Módulo por negocio:** `Business.restaurante_enabled` (apagado por defecto), gateado en sidebar, páginas, TODOS los endpoints y creación de roles (`requireRestauranteAccess`).

---

## 8. Reportes y contabilidad (estándar sellado 2026-10-06)

- Las ventas de mesa son `Sale` normales y entran por `src/lib/sales-returns.ts`. **Ningún endpoint nuevo replica filtros de `status`.**
- Devoluciones sobre venta de mesa: igual que hoy (`/api/returns`).
- Reportes nuevos (R5): ventas por mesonero y por área, rotación de mesa (abierta→cobrada), tiempos por estación (`sent→ready` promedio y p90), propinas por mesonero. Todos leen `Sale`/`OrderItem`/`SaleTip`.
- Todo lo que toque dinero pasa `npm run test:consistency`, extendido con un escenario de mesa dividida + propina.

---

## 9. Decisiones de negocio (cerradas)

Respondidas por Carlos el 2026-11-04 (si cambia alguna, avisa y se actualiza este documento):

1. **Propina: SÍ.** Se registra aparte, no cuenta como venta ni ingreso del negocio, y se reporta por mesonero.
2. **Cargo por servicio propio: NO.** El módulo no agrega una línea de servicio. Solo propina libre. (El `cargo_pct` global que ya tiene el POS sigue existiendo y el cajero puede usarlo; el módulo no lo preselecciona.)
3. **Reserva de mesa: SÍ, solo marca manual** (nombre + hora), sin calendario ni cliente.
4. **Mesonero cobra: NO.** Solo pide la cuenta; cobra el `cashier`/`admin`.
5. **KDS actual: SÍ sigue igual** para pedidos de WhatsApp/catálogo, conviviendo con las estaciones de mesa; en R5 esos pedidos también pueden rutearse a estaciones.

**Dependencia técnica resuelta:** `PATCH /api/sales/[id]/pay` quedó corregido en `main` (`e288f22`, `d9c7f65`): total y montos solo del servidor, una sola tasa, máximo 10 pagos por venta, el cajero solo cobra sus ventas. El cobro de mesa usa `/cargo` y `/pay` tal como están (ver ADR §5).

---

## 10. Criterios de aceptación globales

| # | Flujo | Verificación |
|---|---|---|
| A1 | Abrir cuenta | mesa `ocupada`, `guests`, `waiter_id`; doble apertura → 409 |
| A2 | Agregar | precio del servidor; precio en el body se ignora |
| A3 | Enviar | ítems llegan solo a su estación; `sent_at` fijado |
| A4 | KDS | `preparing`/`ready` con tiempos; mesonero ve badge ≤ 5 s |
| A5 | Cobro | `Sale paid` con N pagos; stock baja; cuenta `closed`; mesa `por_limpiar` |
| A6 | Dividir | suma de ventas hijas = total de la cuenta; mesa cierra al pagar la última |
| A7 | Propina | no altera ventas netas; efectivo esperado sube solo si fue en efectivo |
| A8 | Juntar/transferir | una sola cuenta; `TableEvent` registra el movimiento |
| A9 | Roles | `mesonero` y `cocinero` reciben 403 fuera de su lista blanca; negocio sin flag → 404 |
| A10 | Búsqueda | los 3 ejemplos de §6 pasan |
| A11 | No regresión | negocios sin `restaurante_enabled`: POS, pedidos, catálogo y KDS actual sin cambios (E2E existentes en verde) |
