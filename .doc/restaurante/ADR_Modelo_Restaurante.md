# ADR — Modelo de datos del módulo Restaurante

Versión R0 | 2026-11-04 | Estado: PROPUESTO | Complementa `PRD_Restaurante.md`
Base verificada contra `prisma/schema.prisma` de esta rama (`Order` L911, `OrderItem` L1008, `Category` L336, `Role` L11, `Business.reservas_enabled` L214).

## 1. Decisión

El salón se modela **extendiendo `Order` / `OrderItem`**, no con tablas paralelas de "comandas". Una cuenta de mesa ES un `Order` con `origin = 'table'`; cada línea ES un `OrderItem` con estado y estación. Se agregan **tablas nuevas solo para lo que no existe**: áreas, mesas, estaciones, modificadores, propinas, eventos de mesa. Todo **aditivo** (columnas nullable o con default, tablas nuevas, valores de enum añadidos), con `business_id` y activado por negocio.

Por qué extender: el cobro (`/api/orders/[id]/cobrar`), `Order → Sale`, estados, notas, cliente, `price_mode` y financiamiento Cashea ya viven en `Order`. Una tabla paralela duplicaría esa lógica y obligaría a mantener dos caminos de cobro.

## 2. Modelos nuevos

```prisma
model ServiceArea {                 // "Salón", "Terraza", "Barra"
  id          Int     @id @default(autoincrement())
  business_id Int
  name        String  @db.VarChar(60)
  sort_order  Int     @default(0)
  active      Boolean @default(true)
  business    Business      @relation(fields: [business_id], references: [id])
  tables      DiningTable[]
  @@unique([business_id, name])
  @@map("service_areas")
}

model DiningTable {
  id           Int     @id @default(autoincrement())
  business_id  Int
  area_id      Int
  label        String  @db.VarChar(20)          // "5", "T-2"
  capacity     Int     @default(4)
  shape        String  @default("rect") @db.VarChar(10)  // rect | round | bar
  // Posición en el plano: unidades de cuadrícula (1 = 1 celda), no píxeles.
  pos_x        Int     @default(0)
  pos_y        Int     @default(0)
  width        Int     @default(2)
  height       Int     @default(2)
  rotation     Int     @default(0)              // 0 | 90 | 180 | 270
  active       Boolean @default(true)
  // Marcas manuales (ocupada y por_cobrar se derivan de la cuenta abierta).
  cleaning_pending Boolean   @default(false)    // por_limpiar
  reserved_for     String?   @db.VarChar(80)
  reserved_phone   String?   @db.VarChar(30)
  reserved_at      DateTime?
  business Business    @relation(fields: [business_id], references: [id])
  area     ServiceArea @relation(fields: [area_id], references: [id])
  orders   Order[]
  @@unique([business_id, area_id, label])
  @@index([business_id, area_id])
  @@map("dining_tables")
}

model PrepStation {                 // Cocina, Barra, Fría, Sándwich…
  id            Int     @id @default(autoincrement())
  business_id   Int
  name          String  @db.VarChar(60)
  color         String? @db.VarChar(20)
  printer_name  String? @db.VarChar(80)   // reservado; el driver NO está en R1-R5
  warn_min      Int     @default(10)      // ámbar en el KDS
  critical_min  Int     @default(20)      // rojo
  is_default    Boolean @default(false)   // destino si nada rutea
  sort_order    Int     @default(0)
  active        Boolean @default(true)
  business   Business      @relation(fields: [business_id], references: [id])
  categories Category[]
  products   Product[]
  items      OrderItem[]
  users      UserStation[]
  @@unique([business_id, name])
  @@map("prep_stations")
}

model UserStation {                 // rol cocinero <-> estaciones
  user_id    Int
  station_id Int
  @@id([user_id, station_id])
  @@map("user_stations")
}

model ProductModifier {             // "Sin cebolla", "Extra queso +$1.00"
  id          Int     @id @default(autoincrement())
  business_id Int
  product_id  Int?                       // null = aplica a todo el negocio
  category_id Int?                       // null = no limitado por categoría
  group_name  String? @db.VarChar(60)    // "Término", "Extras" (null = suelto)
  name        String  @db.VarChar(60)
  price_usd   Decimal @default(0) @db.Decimal(10, 2)
  required    Boolean @default(false)    // grupo obligatorio
  active      Boolean @default(true)
  sort_order  Int     @default(0)
  @@index([business_id, product_id])
  @@map("product_modifiers")
}

model SaleTip {                     // La propina NO es venta
  id                Int      @id @default(autoincrement())
  business_id       Int
  sale_id           Int
  order_id          Int?
  waiter_id         Int?
  payment_method_id Int
  amount_usd        Decimal  @db.Decimal(10, 2)
  amount_bs         Decimal  @db.Decimal(12, 2)
  rate_used         Decimal  @db.Decimal(10, 4)
  created_at        DateTime @default(now())
  @@index([business_id, created_at])
  @@index([sale_id])
  @@map("sale_tips")
}

model TableEvent {                  // auditoría de mesa/cuenta
  id          Int      @id @default(autoincrement())
  business_id Int
  order_id    Int?
  table_id    Int?
  type        String   @db.VarChar(24) // open | transfer_table | transfer_waiter | merge | split | void_item | void_order | reopen | clean
  from_value  String?  @db.VarChar(60)
  to_value    String?  @db.VarChar(60)
  reason      String?  @db.VarChar(255)
  user_id     Int
  created_at  DateTime @default(now())
  @@index([business_id, order_id])
  @@map("table_events")
}

model OrderTable {                  // mesas juntadas en una sola cuenta
  order_id Int
  table_id Int
  @@id([order_id, table_id])
  @@map("order_tables")
}
```

Las FKs y relaciones inversas completas se escriben en R1; aquí va la forma.

## 3. Campos nuevos en modelos existentes

### `Order`
| Campo | Tipo | Nota |
|---|---|---|
| `table_id` | `Int?` | mesa principal; null en pedidos normales |
| `guests` | `Int?` | comensales |
| `waiter_id` | `Int?` | mesonero (FK `User`) |
| `account_status` | `String? @db.VarChar(16)` | `open` \| `bill_requested` \| `closed` \| `void`; null fuera de mesa |
| `opened_at`, `bill_requested_at`, `closed_at` | `DateTime?` | tiempos de rotación |
| `origin` | enum `OrderOrigin` + valor `table` | `ALTER` aditivo |
| `@@index([business_id, table_id, account_status])` | | plano en vivo |

**`Order.status` NO se amplía.** Una cuenta de mesa usa `received` mientras está abierta y `delivered`/`cancelled` al cerrarse; `account_status` lleva el ciclo propio. Así las consultas existentes (pedidos, reportes, cobrar) siguen entendiendo el enum.

### `OrderItem`
| Campo | Tipo | Nota |
|---|---|---|
| `station_id` | `Int?` | snapshot al enviar (no se recalcula) |
| `kds_status` | `String? @db.VarChar(12)` | `draft\|sent\|preparing\|ready\|served\|void`; null en pedidos normales |
| `course` | `Int @default(1)` | 1 entrada, 2 fondo, 3 postre |
| `seat` | `Int?` | asiento, para dividir |
| `notes` | `String? @db.VarChar(120)` | nota libre |
| `modifiers` | `Json?` | snapshot `[{id,name,price_usd}]` (precio calculado en servidor) |
| `sent_at`, `started_at`, `ready_at`, `served_at` | `DateTime?` | tiempos por estación |
| `kds_updated_at` | `DateTime?` | cursor del sondeo `since` |
| `started_by`, `void_by` | `Int?` | quién |
| `void_reason` | `String? @db.VarChar(255)` | |
| `@@index([station_id, kds_status, sent_at])`, `@@index([station_id, kds_updated_at])` | | consulta del KDS |

`OrderItem` no tiene `business_id` (hoy tampoco). El KDS consulta por `station_id` de una estación ya validada contra el `business_id` de la sesión, y el resto por `order: { business_id }`. No se agrega la columna para no tocar las filas históricas.

### Otros
- `Category.station_id Int?` (default de ruteo) y `Product.station_id Int?` (override). `Category.requires_preparation` **ya existe** y se reutiliza: `false` + sin estación = no pasa por KDS.
- `Role` + `waiter`, `kitchen` (enum aditivo; `middleware.ts` los trata como restringidos, igual que `operador_reservas`).
- `Business.restaurante_enabled Boolean @default(false)` — NO usa `modules_enabled` (la reescribe el tenant).
- `Sale.table_order_id Int?` (+ índice): enlace Sale → cuenta de mesa. Ver §5.

## 4. Ruteo producto → estación

`resolveStation(item) = product.station_id ?? category.station_id ?? station(is_default) ?? ERROR 422`
Se ejecuta al **enviar** y se guarda en `OrderItem.station_id`. Cambiar el ruteo después no mueve ítems en vuelo. Regla extra: `category.requires_preparation = false` y sin estación explícita → el ítem nace `ready` sin KDS.
Integridad: un solo `is_default` activo por negocio, validado en API (MariaDB no tiene índice único parcial).

## 5. Cobro y relación Order ↔ Sale (la decisión delicada)

Hoy `Order.sale_id` es `@unique` (1 pedido → 1 venta). Una cuenta dividida necesita N ventas.

| Opción | Pro | Contra |
|---|---|---|
| A. Quitar `@unique` de `Order.sale_id` | cambio mínimo | rompe la garantía que `cobrar` usa (`ALREADY_COBRADO`) |
| **B. `Sale.table_order_id` (N ventas → 1 cuenta)**; `Order.sale_id` queda null en cuentas de mesa | aditivo, no toca el flujo de pedidos actual | reportes que unan por `orders.sale_id` no ven mesas (hoy solo `cobrar` y `price-mode` lo usan; se re-verifica en R1) |

**Se elige B.** El cobro de mesa NO reutiliza `/api/orders/[id]/cobrar` (1 solo pago, origen catálogo, recalcula desde el producto e ignoraría modificadores). Camino nuevo en una transacción: (1) con la cuenta bloqueada `FOR UPDATE`, crea la `Sale` con `SaleItem` armados **desde `OrderItem` con precios del servidor** (base + variante + modificadores); (2) la paga con la misma lógica de `PATCH /api/sales/[id]/pay` (`payments[]`, `assertPaymentMatchesFinancing`, `checkCedula`, descuento de stock al pasar a `paid`). Esa lógica se extrae a una función compartida en R4 en vez de duplicarla.

- **Partes iguales / por monto:** 1 `Sale`, N `SalePayment`.
- **Por ítems:** N `Sale`, cada una con su subconjunto (cantidades fraccionarias válidas: `quantity` es `Decimal(10,3)`).
- **Propina:** `SaleTip`, fuera de `total_usd`, por lo que **`netSales` no cambia**. Se agrega `cashTipTotals` a `src/lib/sales-returns.ts` (fuente única) para el efectivo esperado de caja. Ningún endpoint nuevo replica filtros de `status`.
- `Order.status = delivered` y `account_status = closed` cuando lo pagado cubre las líneas no anuladas.

## 6. Activación por negocio (convención "módulo por negocio")

`Business.restaurante_enabled` apagado por defecto, gateado en **cuatro** sitios: (1) link del sidebar (`featureFlag`), (2) `layout.tsx` de servidor con `notFound()`, (3) todos los endpoints vía `requireRestauranteAccess`, (4) creación de roles `waiter`/`kitchen`. Ninguna API de tenant escribe el flag; se activa por SQL/script con autorización: `UPDATE businesses SET restaurante_enabled = 1 WHERE id = N`.

## 7. Tiempo real

Sondeo corto con cursor: `GET …?since=<kds_updated_at ISO>` devuelve solo cambios, cada 3 s. Razones: el VPS corre un proceso PM2 que se reinicia en cada deploy; SSE/WebSocket añade estado en memoria. Costo: una consulta indexada por estación cada 3 s por pantalla. Si un negocio supera ~10 pantallas, se pasa a SSE sin cambiar el modelo de datos.

## 8. Riesgos y mitigación (fusión con `main` sin romper tiendas)

| # | Riesgo | Mitigación |
|---|---|---|
| 1 | Migración choca con otras de `main` | Todo aditivo; una migración versionada por fase; rebase sobre `origin/main` antes de cada push; `migrate deploy` en VPS (nunca `db push`) |
| 2 | Enums `OrderOrigin`/`Role` con valores nuevos rompen `switch` exhaustivos | Grep de usos en R1 y `tsc --noEmit`; el valor nuevo solo se emite a negocios con el flag |
| 3 | Pedidos de mesa contaminan `/pedidos`, el KDS actual y reportes | `send_to_kds=false` en cuentas de mesa; filtro `origin != 'table'` en listado de pedidos y KDS legacy; E2E de no regresión |
| 4 | `Order.sale_id` unique vs. cuentas divididas | Opción B (§5); auditoría de joins en R1 |
| 5 | `repriceOrderTx` y `cobrar` recalculan desde el producto e ignoran modificadores | Camino de cobro propio (§5); no se toca el existente |
| 6 | **Preexistente:** `PATCH /api/sales/[id]/pay` confía en precios/montos del cliente (hallazgo de la sesión de captura, origen commit `1ffb851`) | El cobro de mesa arma los totales en el servidor; **R4 queda bloqueada hasta que Carlos decida cerrar o encapsular ese hallazgo** |
| 7 | Concurrencia: dos dispositivos abren la misma mesa o editan la cuenta | `SELECT … FOR UPDATE` sobre mesa/cuenta (patrón de `cobrar`); `409` con id de la cuenta existente |
| 8 | Carga del KDS (sondeo cada 3 s) | Índices del §3 y `since`; tope de 100 comandas activas por estación |
| 9 | Aislamiento entre negocios | Modelos con `business_id` entran solos al tenant layer; `OrderItem` por `order.business_id` o estación validada; E2E de acceso cruzado |
| 10 | Drift de esquema en el VPS | Nada de `db push` en VPS (regla de CLAUDE.md) |
| 11 | Dinero: propina o devolución mal imputadas | Propina fuera de `total_usd`; `sales-returns.ts` único; escenario nuevo en `test:consistency` |

## 9. Alternativas descartadas

- **Tabla `Comanda` propia:** duplica Order, cobro y estados.
- **Ampliar `OrderStatus` con estados de salón:** toca todos los `switch` y reportes de pedidos.
- **Guardar `ocupada`/`por_cobrar` en la mesa:** puede contradecir la cuenta; se derivan.
- **WebSocket/SSE desde R1:** complejidad prematura; el sondeo con cursor alcanza.
- **Reutilizar `Reserva`:** es de kits con tallas, otro dominio.

## 10. Migraciones previstas (una por fase, todas aditivas)

| Fase | Migración |
|---|---|
| R1 | `…_restaurante_base`: `restaurante_enabled`, `ServiceArea`, `DiningTable`, `OrderOrigin.table`, `Role.waiter/kitchen` |
| R2 | `…_restaurante_cuenta`: campos de `Order`/`OrderItem`, `PrepStation`, `UserStation`, `ProductModifier`, `Category/Product.station_id`, `TableEvent` |
| R4 | `…_restaurante_cobro`: `Sale.table_order_id`, `SaleTip`, `OrderTable` |

Cada una se prueba primero contra `activopos_kds` y se versiona con `prisma migrate dev`.
