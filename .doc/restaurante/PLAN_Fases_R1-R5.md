# PLAN — Fases R1 a R5 del módulo Restaurante

Versión R0.1 | 2026-11-04 | Estado: PROPUESTA — **no se empieza R1 hasta que Carlos apruebe los mockups** | Depende de `PRD_Restaurante.md` y `ADR_Modelo_Restaurante.md`
Rama sincronizada con `origin/main` (incluye `/pay` corregido y `/cargo`).
Nota: `PLAN_Fase_Upgrade_10Nov2026.md` (F4/F5) no existe en este worktree ni en `origin/main`; este plan se apoya solo en el repo.

## Reglas comunes a todas las fases

- **Rama:** `feat/restaurante`; rebase sobre `origin/main` antes de cada push; conflicto = PARAR. Sin merge a `main` sin orden de Carlos.
- **Migración versionada por fase** (`prisma migrate dev`), aditiva, probada en `activopos_kds`. Nada de `db push`.
- **DoD común (CLAUDE.md):** `npx tsc --noEmit` = 0 · `npm run build` con EXIT_REAL numérico · E2E de la fase en verde · suite E2E existente sin regresión · `npm run test:consistency` si toca dinero · el reporte abre con `git rev-parse --short HEAD` y `origin/main` · función cableada en todas sus capas (DB → API → UI → recibos → reportes) o se declara qué falta · cero fachadas (botón sin acción, mock, valor hardcodeado) · UI con CSS Modules + tokens, USD y Bs juntos, targets ≥ 44 px.
- **Aprobación visual:** solo cuando Carlos lo ve en 1280 px y 375 px. Un commit no es aprobación.
- **Scope por CLI:** backend = CLI-A, UI = CLI-B, E2E = CLI-D, auditoría = CLI-C (`security-reviewer` en cada fase que toque auth o dinero).
- Cada endpoint: Zod v4 (`.issues`), `business_id` de `getSession()`, `requireRestauranteAccess`, rate limit donde aplique.

---

## R1 — Base: activación, áreas, mesas y plano

**Objetivo:** el negocio con el flag ve **Restaurante → Plano**, crea áreas y mesas y las acomoda; sin cuentas todavía.

**Crear**
- `prisma/migrations/<ts>_restaurante_base/migration.sql` (flag, `ServiceArea`, `DiningTable`, `OrderOrigin.table`, `Role.waiter/kitchen`)
- `src/lib/restaurante.ts` (`requireRestauranteAccess`, `tableStatus()` derivado, `matchesTableSearch`)
- `src/types/restaurante.ts`
- `src/app/api/restaurante/areas/route.ts` y `[id]/route.ts`
- `src/app/api/restaurante/mesas/route.ts` y `[id]/route.ts` (CRUD + `PATCH` de posición y estado manual)
- `src/app/(dashboard)/restaurante/layout.tsx` (gate de servidor con `notFound()`)
- `src/app/(dashboard)/restaurante/mesas/page.tsx` + `PlanoSalon.tsx` + `EditorPlano.tsx` + `*.module.css`
- `src/app/(dashboard)/configuracion/restaurante/` (áreas y mesas)
- `tests/restaurante-plano.spec.ts`

**Tocar (mínimo)**
- `prisma/schema.prisma` · `src/components/layout/Sidebar.tsx` (`featureFlag: 'restaurante'`) · `src/components/layout/DashboardShell.tsx` (leer el flag) · `src/app/api/config/business/modules/route.ts` (exponer `restaurante_enabled` de solo lectura) · `src/middleware.ts` (lista blanca `waiter`/`kitchen`, aún sin pantallas) · `src/styles/tokens.css` (tokens de estado de mesa, **antes** de consumirlos)

**Auditoría previa obligatoria:** grep de todos los usos de `OrderOrigin` y `Role` para confirmar que el valor nuevo no rompe `switch`; grep de `orders.sale_id`.

**E2E (Playwright)**
1. Negocio sin flag: `/restaurante/mesas` → 404, el link no aparece y `/api/restaurante/mesas` → 404.
2. Con flag: admin crea área "Salón" y 3 mesas; arrastra una mesa y al recargar conserva `pos_x/pos_y`.
3. Búsqueda `"salon 2"` filtra la mesa 2 del área Salón.
4. Cajero no puede crear mesas (403). Negocio B no ve las mesas del negocio A.
5. Viewports 1280 y 375 sin overflow horizontal.

**DoD específico:** el estado de mesa se deriva (no hay columna `ocupada`); plano editable solo por admin; el texto de búsqueda es siempre parámetro Prisma.

---

## R2 — Cuenta de mesa del mesonero

**Objetivo:** abrir cuenta, agregar ítems con notas/modificadores/curso, y ver el total en USD y Bs. Todavía no se envía a estaciones.

**Crear**
- Migración `<ts>_restaurante_cuenta` (campos de `Order`/`OrderItem`, `PrepStation`, `UserStation`, `ProductModifier`, `station_id` en `Category`/`Product`, `TableEvent`)
- `src/lib/restaurante-cuenta.ts` (abrir, agregar, calcular precio en servidor con modificadores, anular ítem `draft`)
- `src/app/api/restaurante/cuentas/route.ts` (`POST` abrir, `GET` con `?q=` y `?status=`)
- `src/app/api/restaurante/cuentas/[id]/route.ts` y `[id]/items/route.ts` (+ `[itemId]`)
- `src/app/api/restaurante/modificadores/route.ts`
- `src/app/(dashboard)/restaurante/cuenta/[id]/page.tsx` + `CuentaMesero.tsx` + `SelectorProducto.tsx` + css (móvil primero)
- `MeseroShell` mínimo para el rol `waiter` (sin el sidebar del negocio)
- `tests/restaurante-cuenta.spec.ts`

**Tocar:** `schema.prisma` · `src/middleware.ts` (rutas de `waiter`) · `src/lib/product-search.ts` solo para reutilizar, nunca duplicar · `src/app/(dashboard)/configuracion/restaurante/` (modificadores)

**E2E**
1. Abrir mesa 5 con 3 comensales → plano la muestra `ocupada`; segunda apertura → 409 y abre la existente.
2. Agregar 2 × producto con modificador `+$1.00`: la línea trae `base + 1.00`; un body con `price_per_unit_usd` falso se ignora.
3. Producto `weight` acepta decimal; `unit` rechaza decimal.
4. Mesonero recibe 403 en `/pos`, `/finanzas` y `/api/sales`; no ve costos.
5. Total visible en USD y Bs; 375 px sin overflow; la búsqueda `"juan 5"` encuentra la cuenta.

**DoD específico:** el cliente nunca envía precios; el mesonero no accede fuera de su lista blanca (test de `middleware`).

---

## R3 — Estaciones, ruteo y KDS

**Objetivo:** enviar a estaciones y que cada cocinero trabaje su pantalla.

**Crear**
- `src/lib/restaurante-kds.ts` (`resolveStation`, transiciones permitidas de `kds_status`, umbrales)
- `src/app/api/restaurante/estaciones/route.ts` y `[id]/route.ts` (CRUD + usuarios)
- `src/app/api/restaurante/cuentas/[id]/enviar/route.ts` (draft → sent, en transacción)
- `src/app/api/restaurante/kds/route.ts` (`GET ?station&since`) y `kds/items/[id]/route.ts` (`PATCH` de estado)
- `src/app/(dashboard)/kds/EstacionKDS.tsx` + css; `KDSShell` para el rol `kitchen`
- `src/app/(dashboard)/configuracion/restaurante/ruteo` (categoría → estación, override por producto)
- `tests/restaurante-kds.spec.ts`

**Tocar:** `src/app/(dashboard)/kds/page.tsx` (con flag y `?station` renderiza `EstacionKDS`; **sin flag, el KDS actual queda idéntico**) · `src/app/api/orders/route.ts` (filtro `origin != 'table'` en listados) · `src/middleware.ts` (`kitchen` solo `/kds` y `/api/restaurante/kds*`) · `src/lib/audio.ts` solo si hace falta otro tono

**E2E**
1. Plato (Cocina) + cerveza (Barra): cada estación recibe solo lo suyo.
2. El override por producto gana sobre la categoría; cambiar el ruteo no mueve ítems ya enviados.
3. `preparing` → `ready` fija tiempos; el mesonero ve el badge en ≤ 5 s sin recargar.
4. El curso 2 aparece atenuado hasta cerrar el curso 1 o usar Disparar.
5. Ítem enviado y anulado aparece tachado en el KDS; sin autorización de admin no se anula.
6. `kitchen` recibe 403 en cuentas y precios; ve solo sus estaciones.
7. Tablet 1024×768 horizontal sin scroll horizontal; los umbrales ámbar/rojo cambian con el tiempo.

**DoD específico:** sondeo con `since` (verificar en red que no baja todo cada vez); el KDS no muestra precios; negocio sin flag con el KDS actual idéntico (E2E existentes de KDS/pedidos en verde).

---

## R4 — Pedir cuenta, cobro, dividir, propina

**Objetivo:** cerrar la cuenta con el POS actual. **Desbloqueada:** `/pay` quedó corregido en `main` (`e288f22` pay-seguro, `d9c7f65` pay-integridad). El cobro de mesa crea la `Sale` pendiente en servidor, usa `PATCH /api/sales/[id]/cargo` si el cajero lo aplica y `PATCH /api/sales/[id]/pay` tal cual (ADR §5). No se copia ni se modifica la lógica de `/pay`.

**Crear**
- Migración `<ts>_restaurante_cobro` (`Sale.table_order_id`, `SaleTip`, `OrderTable`)
- `src/lib/restaurante-cobro.ts` (armar la `Sale` `pending` desde `OrderItem` con `pendingSaleTotals`, dividir, cerrar cuenta cuando todas las ventas hijas están `paid`). **No** se extrae ni se duplica la lógica de `/pay`
- `src/app/api/restaurante/cuentas/[id]/{pedir-cuenta,cobrar,dividir,juntar,transferir}/route.ts`
- `src/app/api/restaurante/propinas/route.ts`
- UI: `PreCuenta.tsx`, `DividirCuenta.tsx`, `Propina.tsx`; reutilizar el cobro del POS (no reescribirlo)
- `tests/restaurante-cobro.spec.ts`; escenario nuevo en `test:consistency` (mesa dividida + propina)

**Tocar:** `src/lib/sales-returns.ts` (`cashTipTotals`) · **`/pay` y `/cargo` NO se tocan** (ya corregidos en `main`) · recibo y ticket (`src/lib/ticket.ts`, `thermal-print.ts`: mesa, mesonero, propina) · caja (efectivo esperado)

**E2E**
1. Pago mixto $10 efectivo + Bs por $20 → 1 `Sale paid`, 2 `SalePayment`, stock descontado, cuenta `closed`, mesa `por_limpiar`.
2. División por ítems en 2 subcuentas: suma = total; la mesa cierra al pagar la última.
3. Partes iguales entre 3: 1 venta, 3 pagos.
4. Propina en efectivo: no cambia ventas netas y sube el efectivo esperado; propina en tarjeta no lo sube.
5. Cashea: no se cobra con financiador hasta `approved`; cédula exigida.
6. Juntar 2 mesas → 1 cuenta; transferir mesa y mesonero dejan `TableEvent`.
7. Devolución posterior sobre una venta de mesa: reportes y `test:consistency` en verde.
8. Cancelar una venta reabre la cuenta solo con admin. Sin caja abierta: mismo bloqueo del POS.
9. Integridad con el `/pay` actual: un body con `cargo_pct` o `discount_pct` se descarta; un pago cuyo `amount_bs` no cuadra con la tasa → 400; más de 10 pagos → 400; un `cashier` ajeno a la venta → 403; si la tasa cambia entre crear y pagar, `total_bs` y `rate_used` salen de la misma tasa y coinciden con la suma de pagos.
10. `/cargo` sobre la venta de mesa recalcula el total en servidor; con Cashea vivo exige aprobar de nuevo.
11. El `waiter` recibe 403 en `/pay`, `/cargo` y `/api/sales`.

**DoD específico:** `security-reviewer` aprueba (dinero + auth); `npm run test:consistency` en 0; ningún endpoint replica filtros de `status` (todo por `sales-returns.ts`).

---

## R5 — Reportes, pulido y operación

**Objetivo:** que el dueño vea qué pasa en el salón y que el módulo sea operable.

**Crear**
- `src/app/api/restaurante/reportes/route.ts` (ventas por mesonero y área, rotación, tiempos por estación p50/p90, propinas por mesonero)
- `src/app/(dashboard)/restaurante/reportes/page.tsx` + css
- Ruteo de pedidos de WhatsApp/catálogo a estaciones (aprobado: el KDS actual sigue igual para esos pedidos y conviven con las estaciones)
- `tests/restaurante-reportes.spec.ts`; `tests/restaurante-flujo-completo.spec.ts` (abrir → enviar → cocinar → servir → pedir cuenta → dividir → cobrar → liberar)

**Tocar:** `src/lib/sales-returns.ts` (agrupaciones por mesonero/área si hacen falta, sin tocar las reglas) · exportaciones (CSV/PDF) · `src/lib/help-content.ts` (ayuda) · `.doc/SYSTEM_MAP.md`, `.doc/DB_SCHEMA.md`

**E2E:** flujo completo en 375 y 1280; reportes concuerdan con `test:consistency`; la exportación incluye propinas por separado; negocio sin flag sin cambios.

**DoD específico:** documentación actualizada, guía de activación por SQL, checklist de deploy en VPS (`migrate deploy`, lock del healthcheck, `pm2 stop` antes del build) y reporte de "qué quedó fuera" (impresión térmica por estación, reservas de mesa con calendario, cargo por servicio propio del módulo).

---

## Resumen

| Fase | Entrega | Migración | Riesgo principal |
|---|---|---|---|
| R1 | Plano + áreas + mesas | `restaurante_base` | enums nuevos |
| R2 | Cuenta del mesonero | `restaurante_cuenta` | precio solo en servidor |
| R3 | Estaciones + KDS | — | convivencia con el KDS actual |
| R4 | Cobro, dividir, propina | `restaurante_cobro` | dinero; límite de 10 pagos por venta |
| R5 | Reportes + flujo completo | — | consistencia contable |

Orden estricto R1→R5: cada fase se aprueba visualmente por Carlos antes de empezar la siguiente.
