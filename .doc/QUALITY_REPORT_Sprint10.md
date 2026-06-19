# Quality Report — Sprint 10
# Fecha: 2026-06-19 | CLI-C | ActivoPOS

---

## Resumen ejecutivo

| Métrica | Valor |
|---------|-------|
| Routes totales en src/app/api/ | 56 |
| Archivos auditados directamente | 35 |
| Patrones buscados en los 56 routes | 4 búsquedas grep globales |
| P0 detectados | **0** |
| P1 detectados | 5 |
| P2 detectados | 4 |
| P3 detectados | 4 |

**No se encontró ningún P0 (data leak entre tenants ni auth bypass sobre operaciones financieras).** La aislación por `business_id` desde `getSession()` es sólida en todos los endpoints auditados. El JWT es fail-closed (HS256, sin fallback secret, `algorithms: ['HS256']`). Rate limiting en login (doble capa IP + email) y catálogo público está implementado.

---

## P1 — Alto

### Cashiers pueden acceder a todos los endpoints de finanzas (role bypass)

**Archivos afectados:**
- `src/app/api/finanzas/resumen/route.ts` — Estado de resultados completo (margen bruto, utilidad neta, gastos)
- `src/app/api/finanzas/gastos/route.ts` GET — Lista de gastos operativos
- `src/app/api/finanzas/cxp/route.ts` GET — Cuentas por pagar
- `src/app/api/reports/daily/route.ts` GET — Reporte diario con totales y métodos de pago

**Descripción:** El CLAUDE.md define explícitamente que cashiers tienen acceso a "POS, Caja, Clientes — Sin finanzas, sin configuración". Sin embargo, los 4 endpoints listados no tienen `if (session.role === 'cashier') return 401`. Un cashier con token válido puede llamar estos endpoints directamente sin pasar por el sidebar del dashboard.

**Patrón en cada archivo:**
```typescript
// Solo tienen esto:
if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
// Falta:
if (session.role === 'cashier') return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
```

**Recomendación:** Agregar el guard de rol inmediatamente después del check de sesión en los 4 endpoints.

---

### products/import sin validación de tamaño del archivo Excel

- **Archivo:** `src/app/api/products/import/route.ts`
- **Línea:** 41-43

**Descripción:** El archivo Excel se lee completo en memoria con `Buffer.from(await file.arrayBuffer())` antes de ninguna validación de tamaño. Un archivo XLSX de 100MB+ puede causar OOM (Out of Memory) en el proceso Node.js y derribar el servidor. El endpoint sí restringe el rol (no cashier), pero no hay límite de tamaño en el `formData`.

```typescript
// Línea 41 — buffer sin límite de tamaño previo
const buffer = Buffer.from(await file.arrayBuffer())
const workbook = XLSX.read(buffer)  // XLSX parsea sin guardia
```

**Recomendación:** Agregar validación de tamaño antes del `arrayBuffer()`:
```typescript
const file = formData.get('file')
if (!(file instanceof File)) { ... }
if (file.size > 5 * 1024 * 1024) {  // 5 MB
  return NextResponse.json({ error: 'Archivo demasiado grande (máx 5 MB)' }, { status: 413 })
}
```

---

## P2 — Medio

### `rates/bcv/route.ts` — Endpoint GET sin autenticación requerida

- **Archivo:** `src/app/api/rates/bcv/route.ts`
- **Líneas:** 5-16

**Descripción:** `getSession()` se llama pero su resultado solo se usa como parámetro opcional. El endpoint responde con la tasa BCV a cualquier actor sin credenciales. La información en sí (tasa BCV) es pública y no compromete datos de negocios. Sin embargo:
1. Crea superficie de ataque innecesaria (fingerprinting del servidor, confirmar que la instancia está viva)
2. Cuando el cache expira, cada llamada escribe un registro en `dollar_rates` con `business_id: null`

```typescript
export async function GET() {
  try {
    const session = await getSession()        // null para requests sin auth
    const rate = await getBcvRate(session?.businessId)  // llama DB sin business_id
    return NextResponse.json({ rate, source: 'bcv', ok: true })
  } catch { ... }
}
```

**Recomendación:** Evaluar si algún componente frontend realmente necesita este endpoint público. Si no (el catálogo obtiene la tasa server-side), agregar el check de sesión estándar.

---

### `ventas/[id]/abono/route.ts` — `amount_bs` aceptado del cliente sin recalcular

- **Archivo:** `src/app/api/ventas/[id]/abono/route.ts`
- **Líneas:** 55-65

**Descripción:** El endpoint acepta `amount_bs` del body del cliente y lo almacena directamente en `saleAbono`. La tasa BCV sí se obtiene del servidor (`rate = await getBcvRate()`), pero el `amount_bs` almacenado puede no corresponder a `amount_usd × rate`.

```typescript
// Líneas 55-65 — amount_bs del cliente, no recalculado
const newAbono = await tx.saleAbono.create({
  data: {
    amount_usd: body.amount_usd,
    amount_bs:  body.amount_bs,   // ← client-supplied, puede ser cualquier valor
    rate_used:  rate,             // ← correcto, del servidor
  },
})
```

**Inconsistencia crítica:** El endpoint equivalente `clients/[id]/abono/route.ts` SÍ calcula server-side:
```typescript
// clients/[id]/abono/route.ts línea 62 — correcto
const amountBs = data.amount_usd * rateUsed
```

**Impacto:** Reportes de caja con totales en Bs distorsionados. `cash/route.ts` y `cash/status/route.ts` suman `amount_bs` de los pagos para calcular el efectivo esperado en turno.

**Recomendación:** En `ventas/[id]/abono/route.ts`, eliminar `amount_bs` del schema y calcularlo server-side: `amount_bs: body.amount_usd * rate`.

---

### `cash/close/route.ts` — Race condition TOCTOU en cierre de caja

- **Archivo:** `src/app/api/cash/close/route.ts`
- **Líneas:** 19-28 (findFirst fuera de TX) vs 27-54 (update dentro de TX)

**Descripción:** El `findFirst` que obtiene la caja abierta está **fuera** de la transacción. Dos requests de cierre simultáneos pueden pasar el check de existencia y luego ambos ejecutar el update, produciendo dos cierres de caja sobre el mismo registro.

```typescript
// Fuera de TX — vulnerable a race
const register = await prisma.cashRegister.findFirst({
  where: { business_id: session.businessId, closed_at: null },
})
if (!register) { ... }

// Dentro de TX — pero el registro ya fue confirmado "abierto" por ambos requests
const closed = await prisma.$transaction(async (tx) => {
  const reg = await tx.cashRegister.update({
    where: { id: register.id },
    data: { closed_at: new Date(), ... }
  })
})
```

**Recomendación:** Mover el `findFirst` dentro de la transacción, o usar `updateMany` con `closed_at: null` en el where y verificar `count > 0`.

---

### `lib/bcv.ts` — Cache in-memory no es cluster-safe (confirmación técnica)

- **Archivo:** `src/lib/bcv.ts`
- **Líneas:** 7, 39

**Descripción:** El cache de tasa BCV usa una variable de módulo (`let cache: { rate: number; fetchedAt: number } | null`). Con PM2 en modo cluster (producción en VPS), cada proceso worker tiene su propio espacio de memoria. Cuando el cache expira (1 hora), todos los workers pueden hacer fetch simultáneo a la BCV API y crear múltiples registros en `dollar_rates`. El comentario en `rate-limit.ts` línea 3 ya documenta el problema para el rate limiter.

**Impacto actual:** Múltiples registros `dollarRate` por hora (uno por worker). No es un security issue sino un reliability/data-quality concern.

**Recomendación:** Usar Redis (o `next/cache` con revalidate) para el cache en lugar de in-memory. Hasta entonces, el impacto está controlado por el TTL de 1 hora.

---

## P3 — Bajo

### Patrón TOCTOU en updates sin `business_id` en la cláusula `where`

**Archivos:**
- `src/app/api/clients/[id]/route.ts` líneas 94, 128
- `src/app/api/products/[id]/route.ts` línea 142
- `src/app/api/categories/[id]/route.ts` líneas 36, 70
- `src/app/api/products/[id]/variants/[variantId]/route.ts` línea 80

**Descripción:** Todos siguen el patrón: `findFirst({ where: { id, business_id: session.businessId } })` para verificar ownership, seguido de `update({ where: { id } })` sin `business_id`. Existe una ventana TOCTOU teórica entre el check y el update.

**Por qué es P3 y no P0:** Los recursos (clientes, productos, categorías) pertenecen a exactamente un negocio y no se transfieren entre tenants. Un atacante necesitaría controlar dos sesiones concurrentes de dos negocios distintos apuntando al mismo ID de recurso — improbable en el modelo de amenaza de este sistema.

**Recomendación:** Incluir `business_id: session.businessId` en el `where` del update como defensa en profundidad:
```typescript
await prisma.client.update({
  where: { id, business_id: session.businessId },
  data,
})
```

---

### `upload/image/route.ts` — Validación de tipo basada en `file.type` del cliente

- **Archivo:** `src/app/api/upload/image/route.ts`
- **Líneas:** 22-24

**Descripción:** `ALLOWED_TYPES.includes(file.type)` verifica el MIME type declarado por el cliente en el multipart, que puede ser falsificado. Un archivo `.exe` con header `Content-Type: image/jpeg` pasará el check y llegará a Sharp. Sharp rechaza datos no-imagen, por lo que el riesgo real es bajo.

**Recomendación:** Validar adicionalmente los "magic bytes" del buffer:
```typescript
const header = buffer.slice(0, 4)
const isJpeg = header[0] === 0xFF && header[1] === 0xD8
const isPng = header.toString('hex').startsWith('89504e47')
const isWebp = header.toString('ascii', 0, 4) === 'RIFF'
```

---

### `clients/[id]/abono/route.ts` — Usa `$queryRaw` para tasa en lugar de `getBcvRate()`

- **Archivo:** `src/app/api/clients/[id]/abono/route.ts`
- **Líneas:** 57-61

**Descripción:** Obtiene la tasa con SQL raw y fallback hardcodeado `36.50`, en lugar del patrón estándar del proyecto (`getBcvRate()`). Si la tabla `dollar_rates` está vacía, este endpoint usa el fallback directo sin intentar fetch a la BCV API (como sí haría `getBcvRate()`).

```typescript
// Inconsistente con el resto del codebase
const rateRows = await prisma.$queryRaw<RateRow[]>`
  SELECT rate FROM dollar_rates ORDER BY created_at DESC LIMIT 1
`
const rateUsed = parseFloat(String(rateRows[0]?.rate ?? '36.50')) || 36.50
```

**Recomendación:** Reemplazar con `const rateUsed = await getBcvRate()`.

---

### `orders/route.ts` POST — `price_per_unit_usd` aceptado del cliente (órdenes internas)

- **Archivo:** `src/app/api/orders/route.ts`
- **Líneas:** 20-25, 110-114

**Descripción:** Para órdenes creadas por staff autenticado (dashboard/WhatsApp), el precio por unidad es client-supplied y no se valida contra el precio DB del producto. Esto permite crear órdenes con precio `$0.00`. Diferente al catálogo público que fetches precios server-side.

**Contexto:** Puede ser intencional — el operador puede necesitar fijar precios customizados para pedidos. Pero sin un precio mínimo (`z.number().nonnegative()` en el schema lo permite a `$0`), el riesgo es órdenes con totales incorrectos.

**Recomendación:** Si se permite precio custom, cambiar a `z.number().positive()` en el schema (`nonnegative` permite `0`), o agregar validación de que el precio no es inferior al costo del producto.

---

## Verificación TypeScript

```
Búsqueda de `: any` y `as any` en src/app/api/**/*.ts → 0 coincidencias ✅
Búsqueda de `console.log(` en src/app/api/**/*.ts → 0 coincidencias ✅
Todos los console.error() encontrados son de errores del servidor, sin datos sensibles ✅
```

---

## Estado de seguridad por módulo auditado

| Módulo | Auth | business_id | Validación Zod | Rol cashier | Resultado |
|--------|------|-------------|----------------|-------------|-----------|
| `auth/login` | N/A | N/A | ✅ | N/A | ✅ PASS |
| `sales/` | ✅ | ✅ | ✅ | N/A (todos) | ✅ PASS |
| `sales/[id]/pay` | ✅ | ✅ | ✅ | N/A | ✅ PASS |
| `sales/[id]/void` | ✅ | ✅ | ✅ | ✅ admin only | ✅ PASS |
| `cash/` GET | ✅ | ✅ | N/A | N/A | ✅ PASS |
| `cash/open` | ✅ | ✅ | ✅ | N/A | ✅ PASS |
| `cash/close` | ✅ | ✅ (findFirst) | ✅ | N/A (¿intencional?) | ⚠️ P2 TOCTOU |
| `cash/status` | ✅ | ✅ | N/A | N/A | ✅ PASS |
| `cash/history` | ✅ | ✅ | N/A | ✅ admin only | ✅ PASS |
| `cash/movement` | ✅ | ✅ | ✅ | N/A | ✅ PASS |
| `rates/bcv` | ⚠️ opcional | N/A | N/A | N/A | ⚠️ P2 sin auth |
| `catalog/[slug]` | N/A (público) | Por slug | ✅ | N/A | ✅ + rate limit |
| `catalog/[slug]/order` | N/A (público) | Por slug | ✅ | N/A | ✅ + rate limit + server prices |
| `clients/` | ✅ | ✅ | ✅ | N/A | ✅ PASS |
| `clients/[id]` | ✅ | ✅ (check) | ✅ | ✅ DELETE admin | ⚠️ P3 TOCTOU update |
| `clients/[id]/abono` | ✅ | ✅ | ✅ | N/A | ⚠️ P3 raw rate |
| `ventas/[id]/abono` | ✅ | ✅ | ✅ | N/A | ⚠️ P2 amount_bs |
| `products/` | ✅ | ✅ | ✅ | ✅ POST/PATCH | ✅ PASS |
| `products/import` | ✅ | ✅ | N/A | ✅ | ⚠️ P1 sin size limit |
| `upload/image` | ✅ | ✅ (por dir) | N/A | ✅ | ⚠️ P3 MIME spoofing |
| `config/business` | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| `config/pin` | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| `config/iva` | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| `config/payment-methods` | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| `users/` | ✅ | ✅ | ✅ | ✅ | ✅ PASS |
| `users/[id]` | ✅ | ✅ (check) | ✅ | ✅ | ⚠️ P3 TOCTOU update |
| `inventory/` | ✅ | ✅ | ✅ | ✅ POST | ✅ PASS |
| `orders/` | ✅ | ✅ | ✅ | N/A | ⚠️ P3 client prices |
| `finanzas/resumen` | ✅ | ✅ | N/A | ❌ falta check | ⚠️ P1 role bypass |
| `finanzas/gastos` GET | ✅ | ✅ | ✅ | ❌ GET sin check | ⚠️ P1 role bypass |
| `finanzas/cxp` GET | ✅ | ✅ | ✅ | ❌ GET sin check | ⚠️ P1 role bypass |
| `finanzas/cxc` | ✅ | ✅ | N/A | ❌ sin check | ⚠️ P1 role bypass |
| `reports/daily` | ✅ | ✅ | ✅ | ❌ sin check | ⚠️ P1 role bypass |
| `onboarding/complete` | ✅ | ✅ | N/A | ✅ admin only | ✅ PASS |
| `categories/[id]` | ✅ | ✅ (check) | ✅ | ✅ | ⚠️ P3 TOCTOU update |

---

## Hallazgos de sprints anteriores

No existe un QUALITY_REPORT de sprints anteriores — esta es la primera auditoría formal de seguridad del proyecto.

---

## Acciones requeridas por severidad

| Prioridad | Hallazgo | Responsable | Sprint |
|-----------|----------|-------------|--------|
| P1 | Role bypass en finanzas/* y reports/daily | CLI-A | Sprint 10 |
| P1 | products/import sin size limit | CLI-A | Sprint 10 |
| P2 | ventas/[id]/abono: amount_bs client-supplied | CLI-A | Sprint 10 |
| P2 | cash/close: TOCTOU race condition | CLI-A | Sprint 11 |
| P2 | rates/bcv sin auth | CLI-A | Sprint 11 |
| P2 | lib/bcv.ts cache no cluster-safe | CLI-A | Sprint 11 (Redis) |
| P3 | TOCTOU en updates sin business_id | CLI-A | Backlog |
| P3 | upload: MIME spoofing | CLI-A | Backlog |
| P3 | clients/[id]/abono: raw rate query | CLI-A | Backlog |
| P3 | orders: precio $0 posible | CLI-A | Backlog |

---

## Auditoría de Integración — Visibility System (CLI-C)
Fecha: 2026-06-19

### Supuestos verificados
- Migration `add_product_visibility`: ✅ Applied (11 migrations, DB up to date)
- Enums en schema.prisma: ✅ `Availability` (línea 69) y `CatalogVisibility` (línea 76)
- TypeScript baseline: ✅ 0 errores antes y después de correcciones

### Matriz de coherencia

| Campo | Schema DB | Write API POST | Write API PATCH | Read API catálogo | Read API POS | ProductModal UI | CatalogoGrid |
|---|---|---|---|---|---|---|---|
| `availability` | ✅ enum correcto | ✅ [CORREGIDO] | ✅ + servicio forzado | ✅ raw DB | ✅ computeAvailability | ✅ toggle servicio / badge físico | ⚠️ discontinued no renderizado |
| `catalog_visibility` | ✅ enum correcto | ✅ [CORREGIDO] | ✅ | ✅ filtro `not hidden` | ✅ incluido | ✅ selector 3 opciones | ✅ on_request WhatsApp |

### Críticos corregidos — [CORREGIDO]

#### [CORREGIDO] POST `/api/products` ignoraba `catalog_visibility` y `availability`
- **Archivo:** `src/app/api/products/route.ts`
- **Líneas modificadas:** 22-23 (schema), 166-167 (create data), 163-165 (service override)
- **Bug:** El `productSchema` Zod no incluía los campos. Zod los strippeaba del body. Prisma usaba los defaults DB (`visible`, `in_stock`). Un producto creado como `on_request` quedaba guardado como `visible` — botón de compra en lugar de link WhatsApp.
- **Fix aplicado:** Añadidos al schema con defaults `'hidden'` y `'in_stock'`. Añadidos al `prisma.product.create`. Service override ampliado para incluir `availability = 'in_stock'` en POST.

#### [CORREGIDO] `catalogo/[slug]/page.tsx` no filtraba productos `hidden`
- **Archivo:** `src/app/catalogo/[slug]/page.tsx`
- **Línea modificada:** 79
- **Bug:** La query SSR del catálogo (que es el path de renderizado real para los usuarios) no tenía `catalog_visibility: { not: 'hidden' }`. La API route SÍ lo tenía, pero el SSR page no. Productos marcados como "hidden — solo visible en POS" aparecían en el catálogo público.
- **Fix aplicado:** Añadido `catalog_visibility: { not: 'hidden' }` al `where` de `prisma.product.findMany` en el page.tsx.

### Inconsistencias menores documentadas

#### ⚠️ `discontinued` no tiene badge visual en CatalogoGrid
- **Archivo:** `src/app/catalogo/[slug]/CatalogoGrid.tsx`
- **Descripción:** La condición de renderizado de botones no cubre `availability === 'discontinued'`. Un producto (servicio descontinuado) que tenga `show_in_catalog = true` y `catalog_visibility != 'hidden'` mostrará el botón "Agregar al pedido" normal, aunque el ProductModal lo describe como "no aparece en catálogo ni POS".
- **Probabilidad de ocurrencia:** Baja (requiere estado DB inconsistente — `discontinued` + `show_in_catalog: true`)
- **Recomendación:** Añadir al filtro del catálogo: `availability: { not: 'discontinued' }` en page.tsx, o añadir manejo en CatalogoGrid para `discontinued`.

#### ⚠️ Catalog API route vs SSR page — doble fuente de verdad para filtros
- **Archivos:** `src/app/api/catalog/[slug]/route.ts` y `src/app/catalogo/[slug]/page.tsx`
- **Descripción:** Existen dos paths que sirven datos de catálogo con filtros potencialmente diferentes. El SSR page es el path real; el API route es llamado por el frontend para el order POST. Mantener ambos sincronizados es propenso a divergencia.
- **Recomendación:** Centralizar los filtros de catálogo en una función `getCatalogProducts(businessId)` compartida entre ambos.

#### ⚠️ Catalog API route no llama `computeAvailability`
- **Archivo:** `src/app/api/catalog/[slug]/route.ts`
- **Descripción:** Este API devuelve `p.availability` raw desde DB. La lógica de stock-to-availability solo se aplica en el panel interno. Para el catálogo, si el `min_stock` es 5 y el stock real es 3, el catalogo mostrará la `availability` guardada en DB (posiblemente `in_stock` del default inicial) en lugar de `low_stock`. El SSR page sí tiene el `stockMap` y calcula `outOfStock` correctamente, pero el campo `availability` que se pasa a CatalogoGrid viene sin computar.
- **Aclaración:** `outOfStock` en el SSR page SÍ se calcula correctamente desde stock real (`netQty <= 0`). El problema es solo `low_stock` que no se computa en el catálogo.

### Verificación TypeScript post-correcciones
```
npx tsc --noEmit → 0 errores ✅
```

### Veredicto
**✅ Sistema integrado correctamente** — con 2 correcciones críticas aplicadas por CLI-C.

Los flujos principales (nuevo producto `on_request` → WhatsApp en catálogo; producto `hidden` → no aparece en catálogo) funcionan correctamente después de las correcciones. Las inconsistencias menores documentadas no bloquean el release.
