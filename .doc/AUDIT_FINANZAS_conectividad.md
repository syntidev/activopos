# AUDIT_FINANZAS — Conectividad real del módulo
# CLI-C | Opus | Fecha: 2026-07-05
# Modo: auditoría de solo lectura. Cero modificaciones a producción.
# Criterio de verdad: el código fuente, no la documentación.

Base de evidencia: lectura completa de 7 componentes UI, 12 route handlers de API,
6 archivos de `src/lib`, y `prisma/schema.prisma`. Toda referencia es `archivo:línea`
verificada en el código, no inferida.

---

## 1. MAPA DE FLUJO POR SECCIÓN

### Resumen
- **UI:** `ResumenSection.tsx` llama → `GET /api/finanzas/resumen?month=` (L213) y `GET /api/finanzas/daily?month=` (L97).
- **Endpoint `resumen` lee:** `Sale` (aggregate), `SaleAbono` (aggregate), `Gasto` (aggregate ×3 + count), y 2× `$queryRaw` sobre `sale_items`/`sales`/`products`/`inventory_entries`. Tasa vía `readCachedBcvRate()`.
- **UI muestra:** KPIs Ventas / Gastos / Utilidad / Margen; Estado de Resultados (ventas brutas, costo ventas, utilidad bruta, gastos op., utilidad neta); Punto de Equilibrio; gráfico diario.
- **Campos conectados correctamente (DB→endpoint→UI):** `ventas_netas`, `costo_ventas`, `utilidad_bruta`, `gastos_operativos`, `utilidad_neta`, `margen_neto_pct`, `margen_bruto_pct`, `insight` — todos pasan directo del response (a).
- **GAPS:**
  - **Punto de Equilibrio** en Resumen se calcula 100% en el frontend (`ResumenSection.tsx:46-72`) desde `estado_resultados` + el reloj del navegador (`new Date()`), **ignorando el endpoint real `/api/finanzas/punto-equilibrio` que sí existe**. La proyección "Día X de Y" cambia según la fecha local del que mira, no según el mes seleccionado.
  - Fila "Ventas brutas" muestra `100%` hardcodeado (`ResumenSection.tsx:335,338`).
  - Comentarios `CLI-A: implementar` en L202-203 sobre `/api/finanzas/daily`, que **sí existe y funciona** — comentario obsoleto.

### Gastos
- **UI:** `GastosSection.tsx` llama → `GET /api/gastos?month=` (L77), `GET /api/finanzas/categorias` (L68), `DELETE /api/gastos/:id` (L97); crea/edita vía `GastoModal` → `POST/PATCH /api/gastos`.
- **Endpoint lee:** `Gasto` (findMany), `ExpenseCategory` (findFirst en POST). Tasa vía `readCachedBcvRate()`.
- **UI muestra:** KPIs Total / Fijo / Variable; tabla (fecha, categoría, descripción, tipo, monto, badge vencimiento).
- **Campos conectados:** `fecha`, `concepto`, `monto_usd`, `category_id` — directos.
- **GAPS:**
  - Clasificación **Fijo/Variable derivada de `due_date !== null`** en el frontend (`GastosSection.tsx:114-115,236`), no de un campo real. `ExpenseCategory` **no tiene campo `type` (COGS/OPEX/fijo/variable)** en el schema — la clasificación es una convención implícita frágil.
  - `Gasto.supplier` existe en la interfaz UI (L22) pero **nunca se renderiza** en la tabla — campo muerto aquí.
  - **`/api/finanzas/gastos` NO EXISTE.** Solo existe `/api/gastos`. La UI llama al correcto; la confusión es de nomenclatura (gastos vive fuera del namespace `finanzas`).

### CxC (Por Cobrar)
- **UI:** `CxCSection.tsx` llama → `GET /api/finanzas/cxc?limit=100` (L54); abonos vía `AbonoModal` → `POST /api/finanzas/cxc/:id/abono`.
- **Endpoint lee:** `Sale` where `status='credit'` + include `Client` + include `abonos (SaleAbono)`. Sin tasa (USD puro).
- **UI muestra:** totales vencido/por vencer/vigente, conteo de facturas, tabla (cliente, ticket, saldo, vence, estado).
- **Campos conectados:** `saldo_usd` viene calculado en vivo del servidor (`cxc/route.ts:43-45` = `total - Σabonos`), UI lo lee directo (`CxCSection.tsx:188`). **Diseño correcto — CxC no usa campo estático `amount_paid`, suma la tabla `SaleAbono`.**
- **GAPS:**
  - **Totales vs conteos divergen.** Los totales (`vencido_usd`, etc.) vienen del servidor sobre TODAS las ventas crédito; los conteos "N facturas" se calculan sobre el array `items` truncado a `limit=100` (`CxCSection.tsx:80-82` vs L60-62). Con >100 cuentas abiertas, el monto y el conteo no cuadran.

### CxP (Por Pagar)
- **UI:** `CxPSection.tsx` llama → `GET /api/finanzas/cxp` (L43), `PATCH /api/finanzas/cxp/:id` (marcar pagado, L57); crea vía `GastoModal mode="cxp"` → `POST /api/finanzas/cxp`.
- **Endpoint lee:** `Gasto` where `is_paid=false` (`cxp/route.ts:28-35`). **CxP NO lee una tabla `Purchase` ni `Sale` — lee `Gasto`.**
- **UI muestra:** KPI total por pagar, tabla (concepto, categoría, monto, fecha, badge urgente).
- **Campos conectados:** `total_usd`, `concepto`, `categoria`, `monto_usd`, `fecha` — directos.
- **GAPS:**
  - **"Proveedor" es una fachada de etiqueta.** El placeholder del buscador dice "Proveedor o descripción…" (`CxPSection.tsx:102`) pero la interfaz CxP **no tiene campo supplier** (L10-19) y el filtro solo busca en `concepto`/`categoria`. Al crear una CxP, `GastoModal mode="cxp"` **no tiene ningún input de proveedor** (ni texto libre, ni autocompletar, ni crear nuevo) — el único lugar donde cabe un proveedor es el texto libre de `concepto`.
  - CxP no muestra Bs aunque `rate` existe en la página (recibe solo `month`).
  - Badge "Urgente" usa `item.fecha` (fecha de registro), **no `due_date`** — semánticamente incorrecto para "urgencia de pago".

### P&L (Estado de Resultados)
- **UI:** `PylSection.tsx` llama → `GET /api/finanzas/pyl?period=` (L46). Tiene sus propios tabs `hoy|7dias|mes|anio` e **ignora el selector global `month`**.
- **Endpoint lee:** `$queryRaw` sobre `sale_items` JOIN `sales` (ingresos + COGS vía `si.cost_per_unit_usd`), `Gasto` (aggregate → OPEX). USD puro, sin tasa.
- **UI muestra:** ingresos, COGS, OPEX, utilidad bruta, utilidad neta, margen bruto — todos passthrough directo (a).
- **GAPS:**
  - Captions de fórmula ("Ingresos − COGS", "Utilidad bruta − OPEX") son **texto estático** (`PylSection.tsx:123,133`), no validados contra los números del response.
  - **Doble conteo en OPEX** (ver GAP-2). El endpoint agrega TODOS los gastos del período sin filtrar `categoria` ni `is_paid` (`pyl/route.ts:74-77`).

### Punto de Equilibrio (endpoint real)
- **UI:** ningún componente lo consume. `/api/finanzas/punto-equilibrio` **existe y está completo** pero está huérfano — Resumen calcula su propio break-even client-side en vez de llamarlo.
- **Endpoint lee:** `Sale` (aggregate), `$queryRaw` COGS, `Gasto` (aggregate → costos fijos). USD puro.
- **GAPS:**
  - Mismo **doble conteo** que P&L: trata TODOS los gastos del mes como costo fijo (`punto-equilibrio/route.ts:35`, sin filtro `categoria`), incluyendo `categoria='proveedor'`, que además ya cuenta como costo variable vía COGS. El mismo dinero cuenta en ambos lados del break-even.
  - Además, desalineación de fechas: el COGS filtra por `sold_at`, el gasto agrega por `fecha` — ventanas temporales distintas.

---

## 2. CABLES SUELTOS ENCONTRADOS

### GAP-1: Compra → CxP sin FK de retorno (deuda huérfana)
- **Tipo:** FLUJO_INEXISTENTE / TABLA_HUERFANA
- **UI afectada:** CxPSection — muestra la deuda pero no puede trazarla a su compra.
- **Endpoint afectado:** `purchases/route.ts:130-144` (crea el `Gasto`), `finanzas/cxp/route.ts:28-35` (lo lee).
- **Schema afectado:** `Gasto` (`schema.prisma:542-563`) **no tiene `purchase_id`**. Guarda solo `supplier` como string libre (L554).
- **Impacto:** El usuario ve la deuda en CxP pero no puede saber qué compra la originó. Si se anula la compra, la deuda queda huérfana. Pagar la CxP (`cxp/[id]` PATCH → `is_paid=true`) **no cambia `Purchase.status`**, que queda `pending` para siempre.
- **Fix requerido:** agregar `purchase_id Int?` FK en `Gasto` → `Purchase`; poblarlo al crear la CxP en la compra a crédito; sincronizar estado al pagar. (Sin código — decisión de Carlos.)

### GAP-2: P&L y Break-even doble-cuentan las compras a proveedor
- **Tipo:** CALCULO_FRONTEND (backend) / FLUJO_INEXISTENTE
- **UI afectada:** PylSection (OPEX, utilidad neta), ResumenSection (Punto de Equilibrio).
- **Endpoint afectado:** `pyl/route.ts:74-77`, `resumen/route.ts:92-95`, `punto-equilibrio/route.ts:35`.
- **Schema afectado:** `Gasto.categoria='proveedor'` (creado en `purchases/route.ts:136`) se trata igual que `alquiler`/`nomina`/`servicios`.
- **Impacto:** Una compra a crédito de mercancía entra al OPEX el día de la compra (como `Gasto` categoría proveedor) **y** vuelve a entrar como COGS el día que se vende (vía `SaleItem.cost_per_unit_usd`). El mismo dólar de costo se resta dos veces de la utilidad. La utilidad neta que ve el emprendedor está subestimada en proporción al % de inventario financiado por proveedores. Compra de contado (`status='received'`) NO crea Gasto → cuenta una sola vez (correcto); solo la compra a crédito produce el doble conteo. Asimetría confirmada.
- **Fix requerido:** las 3 agregaciones de OPEX/costos-fijos deben excluir `categoria:'proveedor'` (ese costo pertenece a COGS, no a gasto operativo), o reclasificar el flujo compra→gasto. Requiere decidir el modelo contable (ver sección 4).

### GAP-3: Compra a crédito genera deuda pero NO suma stock
- **Tipo:** FLUJO_INEXISTENTE
- **UI afectada:** ninguna directa — el emprendedor ve la deuda en CxP pero el inventario no sube.
- **Endpoint afectado:** `purchases/route.ts` — `InventoryEntry` solo se crea si `status==='received'` (L113-127); el `Gasto` CxP solo si `status==='pending'` (L130-144). **Rutas mutuamente excluyentes.**
- **Schema afectado:** `Purchase.status` enum `received|pending|cancelled` (`schema.prisma:42`); no hay transición `pending→received`.
- **Impacto:** Una compra a crédito registra la deuda pero **nunca incrementa el stock**, contradiciendo el comentario del propio código ("mercancía recibida sin pagar", L129). No existe ningún path que transicione `pending→received` para sumar el stock después. El emprendedor debe al proveedor por mercancía que el sistema dice que no tiene.
- **Fix requerido:** decidir si `pending` debe sumar stock (recibida-sin-pagar) o no (pedida-no-recibida), y agregar el path de transición. Decisión de negocio.

### GAP-4: Export "éxito" es un timer hardcodeado (fachada)
- **Tipo:** FACHADA
- **UI afectada:** `finanzas/page.tsx:48-52`.
- **Endpoint afectado:** `GET /api/finanzas/export` (navegación de browser).
- **Impacto:** El estado "¡Listo!" se dispara por un `setTimeout` de 2s, **nunca confirma que la descarga funcionó**. Si el export falla, el usuario ve "¡Listo!" igual.
- **Fix requerido:** atar el feedback al resultado real de la descarga (o al menos a un error handler). Cosmético pero viola cero-fachadas.

### GAP-5: CxC conteos vs totales divergen por `limit=100`
- **Tipo:** CALCULO_FRONTEND
- **UI afectada:** `CxCSection.tsx:80-82` (conteos) vs L60-62 (totales del servidor).
- **Endpoint afectado:** `finanzas/cxc/route.ts` — totales sobre todo, items paginados a 100.
- **Impacto:** Con más de 100 cuentas por cobrar abiertas, el monto total (correcto) y el conteo "N facturas" (truncado a 100) no cuadran. Confunde a quien concilia.
- **Fix requerido:** que el endpoint devuelva los conteos por bucket junto a los totales, y que la UI use esos, no `items.length`.

### GAP-6: Punto de Equilibrio endpoint huérfano + break-even client-side dependiente del reloj
- **Tipo:** TABLA_HUERFANA (endpoint huérfano) / CALCULO_FRONTEND
- **UI afectada:** `ResumenSection.tsx:46-72,387-445`.
- **Endpoint afectado:** `/api/finanzas/punto-equilibrio` existe completo pero nadie lo llama.
- **Impacto:** Dos implementaciones de break-even divergentes. La que se muestra (client-side) proyecta desde `new Date()` del navegador — el número cambia según el día en que se mira, no según el mes real. El endpoint correcto (con proyección server-side sobre el período) está sin conectar.
- **Fix requerido:** conectar Resumen al endpoint existente y borrar el cálculo client-side. (Nota: el endpoint también arrastra GAP-2.)

---

## 3. DEUDA TÉCNICA CONFIRMADA EN CÓDIGO

- **DT-1** — `schema.prisma:542-563` — `Gasto` sin `purchase_id`; `supplier` es string libre. Compras, gastos e inventario son tres islas desconectadas (`Purchase.supplier_id` sí es FK, pero `Gasto.supplier` e `InventoryEntry.supplier` son texto). **P1**
- **DT-2** — `pyl/route.ts:74-77` + `resumen/route.ts:92-95` + `punto-equilibrio/route.ts:35` — agregación de OPEX/costos-fijos sin filtro `categoria` → doble conteo con COGS. **P1**
- **DT-3** — `purchases/route.ts:113` vs `:130` — `received` suma stock sin CxP; `pending` crea CxP sin stock; sin transición entre ambos. **P1**
- **DT-4** — `schema.prisma` `ExpenseCategory:526-533` — sin campo `type` (COGS/OPEX/fijo/variable); la UI deriva fijo/variable de `due_date !== null` (`GastosSection.tsx:114-115`), convención implícita. **P2**
- **DT-5** — `finanzas/page.tsx:48-52` — "éxito" de export por `setTimeout`, no por resultado real. **P2**
- **DT-6** — `ResumenSection.tsx:46-72` — break-even calculado client-side desde el reloj del navegador; endpoint `/api/finanzas/punto-equilibrio` existe pero huérfano. **P2**
- **DT-7** — `CxCSection.tsx:80-82` — conteos por bucket sobre array truncado a `limit=100`, divergen de los totales server-side. **P2**
- **DT-8** — `CxPSection.tsx:102` — buscador "Proveedor o descripción…" sin campo supplier detrás; `GastoModal mode="cxp"` no captura proveedor. **P2**
- **DT-9** — `CxPSection.tsx:24-28` — badge "Urgente" usa `fecha` (registro) en vez de `due_date` (vencimiento). **P2**
- **DT-10** — Duplicación de parseo de período: `parseLocalDate`/lógica de rango duplicada 3× en `pyl/route.ts:11`, `daily/route.ts:26`, `export-excel/route.ts:6-18`, cada una con semántica distinta (local vs UTC, vocabularios `hoy/7dias/mes/anio` vs `?month=`). El helper compartido `parsePeriodFromParams` (`lib/finanzas.ts:19`) existe pero solo lo adoptan 4 de 7 rutas. **P2**
- **DT-11** — `pdf-report.ts` (cliente, azul `#2563EB`) y `pdf-reports.ts` (servidor, teal `#0EA5A4`) reimplementan las mismas primitivas de dibujo (`fmtUsd`, header, KPI, tabla). No son copia exacta pero duplican intención. **P2**
- **DT-12** — Comentarios obsoletos `CLI-A: implementar` sobre endpoints ya implementados: `ResumenSection.tsx:202-203`, `PylSection.tsx:16-18`. Engañan al próximo agente. **P2**
- **DT-13** — `schema.prisma` `InventoryEntry:294-306` — no guarda `rate_id` ni FK a `DollarRate`; el costo se captura solo como USD. Bloquea el módulo de Devaluación (auditado por separado). **P1 para ese módulo**
- **DT-14** — `bcv.ts:8` — `FALLBACK_RATE` literal `'617.00'` (env-overridable vía `BCV_FALLBACK_RATE`). No es un `36.5` crudo en un route, es un fallback centralizado y configurable — aceptable, se anota por completitud. **P2 (informativo)**

**Seguridad (verificado por los readers):** ninguna query sin `business_id`. Todo pasa por `getAuthenticatedTenant()`/tenant extension o filtra `business_id` a mano en `$queryRaw`/`$transaction`. `DollarRate` excluido a propósito del scoping (tasa global, `business_id` nullable). Escrituras keyed-by-id dentro de `$transaction` (abono `sale.update`/`saleAbono.create`, `purchaseItem.create`) van sin filtro `business_id` pero están protegidas por un `findFirst` scopeado previo en la misma tx — no explotable, sí frágil. Export-excel prefija caracteres de fórmula (anti CSV-injection). **Cero P0 de seguridad.**

---

## 4. PREGUNTAS SIN RESPUESTA EN EL CÓDIGO

Decisiones de diseño que el código no puede resolver — requieren a Carlos:

1. **Modelo contable: ¿devengo o caja?** El P&L actual mete el gasto al período de su `fecha` sin importar `is_paid` (devengo). El flujo que describiste ("CxP **pagada** = egreso") es base caja. Son incompatibles y afectan qué mes muestra qué utilidad. ¿Cuál es el correcto para una PYME venezolana?

2. **Compra a proveedor: ¿es gasto o es inventario?** Hoy una compra a crédito se registra como `Gasto` (OPEX) — pero comprar mercancía para revender no es un gasto operativo, es inventario que se convierte en COGS al vender. Resolver GAP-2 depende de esta decisión: ¿la compra deja de ser Gasto y solo cuenta como COGS? ¿O se mantiene como CxP pero excluida del OPEX?

3. **`pending` en compras: ¿mercancía recibida o pedido pendiente?** El código y el comentario se contradicen (GAP-3). ¿`pending` significa "ya la tengo, no la he pagado" (debe sumar stock) o "la pedí, no ha llegado" (no suma stock)?

4. **Proveedor en CxP: ¿texto libre o FK a `Supplier`?** Existe la tabla `Supplier` con FK real desde `Purchase`, pero las CxP creadas a mano vía `GastoModal` no capturan proveedor. ¿Se debe forzar selección de `Supplier` al registrar una CxP?

5. **Clasificación de gastos: ¿agregar `type` a `ExpenseCategory`?** Hoy fijo/variable se infiere de `due_date`. ¿Quieres un campo explícito COGS/OPEX/fijo/variable en las categorías para que P&L y break-even clasifiquen bien?

---

## 5. VEREDICTO EJECUTIVO

El módulo Finanzas está **sólido en su capa de datos y seguridad**: cero fachadas de datos mock, cero queries sin aislamiento de tenant, tasa BCV siempre desde el helper cacheado (sin `36.5` cruzados), y CxC implementado correctamente con abonos live-sumados desde `SaleAbono`. Lo que se muestra viene mayoritariamente del servidor. Pero está **hueco en la integración contable entre módulos**: compras, gastos e inventario son tres islas sin FK que las una (DT-1), y esa desconexión produce un **doble conteo real de costos** en P&L y break-even cuando hay compras a crédito (GAP-2) más una **compra a crédito que genera deuda sin sumar stock** (GAP-3) — los dos hallazgos que un contador detectaría en la primera revisión. A una contadora se le puede mostrar mañana **CxC, Gastos y el Resumen de ventas** con confianza. **No** se le debe mostrar el P&L ni el Punto de Equilibrio como cifras finales hasta resolver el doble conteo y decidir el modelo contable (devengo vs caja), porque la utilidad neta que reportan está sistemáticamente sesgada a la baja para cualquier negocio que compre a crédito. Ninguno de estos gaps es un bug de código aislado: los tres P1 nacen de decisiones de modelo de negocio que el código no puede tomar solo (sección 4).
