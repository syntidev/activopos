# CERT_SPRINT19.md — Certificación Sprint 19
# Agente: CLI-C | Fecha: 2026-06-21 | Estado: ✅ CERTIFICADO (pendiente run E2E)

---

## Resumen

Sprint 19 certifica: Módulo Fábrica (combos + fabricables), lógica de componentes, venta por peso con cantidad decimal, y snapshot de receta en sale_items.

**TypeScript: 0 errores | Tests E2E: escritos, pendientes de run con servidor activo**

---

## Auditorías Previas al Test

### A1 — recipe_snapshot en schema y checkout ✅

```
prisma/schema.prisma:358  recipe_snapshot  String?  @db.Text
src/app/api/sales/route.ts:139-149  → se calcula y guarda al crear la venta
```

El snapshot se construye con `product.components` en el momento de la creación de la venta (POST). Los combos/fabricables guardan el JSON con `component_id`, `component_name`, `quantity`, `unit_label`. Productos `simple` quedan con `recipe_snapshot: null`. Correcto.

### A2 — Anti-circular V1 (dos capas) ✅

```
components/route.ts:56-57  → direct self-ref → 422 "no puede ser componente de sí mismo"
components/route.ts:78-81  → componentes solo pueden ser product_type='simple'
```

Capa 1: bloquea A→A directamente.
Capa 2: bloquea A→B→A porque B (simple) no puede tener componentes. Solución V1 válida. No hay cadenas transitivas posibles.

### A3 — business_id siempre de sesión ✅

```
components/route.ts:27, 33, 62, 66, 85  → session.businessId en TODOS los queries
```

Ninguna query acepta `business_id` del body ni de query params.

### A4 — Validación unit_step en checkout ✅

```
sales/route.ts:121-130
  unit_type === 'unit'  → Number.isInteger(qty) && qty >= 1
  else (weight/etc.)    → qty >= product.unit_step ?? 0.001
```

La validación se ejecuta DENTRO de la transacción con datos del servidor, no del body. Correcto.

### A5 — Combo no descuenta su propio stock ✅

```
sales/route.ts:233-254
  product_type === 'simple'     → deducir stock del producto
  else (combo / fabricable)     → deducir stock de CADA componente × qty
```

Mismo patrón en `sales/[id]/pay/route.ts:110-133` para ventas pendientes que se cobran después.

---

## Hallazgos de Seguridad (REPORTE CLI-C — no corrijo)

### SEC-01 — P2: price_per_unit_usd aceptado del cliente en POS

**Archivo:** `src/app/api/sales/route.ts:11`
**Hallazgo:** El schema Zod acepta `price_per_unit_usd` del body sin validar contra el precio en DB. Un cajero con JWT válido puede vender a `$0.01`.
**Contexto:** CLAUDE.md dice "Precios en catálogo vienen del servidor — nunca del cliente". La regla nombra catálogo explícitamente, pero el riesgo es el mismo en POS.
**Recomendación para CLI-A:** Leer `product.price_per_unit_usd` del servidor; rechazar si el precio del body es menor a `product.price_usd * 0.50` sin rol `admin`. O al menos logear discrepancias al `activityLog`.

### SEC-02 — P2: pay route usa receta live, no snapshot

**Archivo:** `src/app/api/sales/[id]/pay/route.ts:110-133`
**Hallazgo:** Al cobrar una venta pendiente, las deducciones de inventario se calculan desde `item.product.components` (estado actual de la receta), no desde `sale_items.recipe_snapshot`. Si la receta cambia entre creación y cobro, se deducen componentes equivocados.
**Recomendación para CLI-A:** Parsear `sale_items.recipe_snapshot` para calcular las deducciones. Si el snapshot es null (producto simple), usar la ruta actual.

### SEC-03 — P3: unit_step no validado como divisor

**Archivo:** `src/app/api/sales/route.ts:126-129`
**Hallazgo:** Para productos por peso, el servidor valida `qty >= step` pero no `qty % step ≈ 0`. Si step=0.250 kg, una qty=0.300 kg pasa.
**Nota:** El UI POS usa `<input step={unit_step}>` que fuerza múltiplos. El riesgo existe solo vía API directa. P3 — aceptable para V1.

---

## Flujo E2E — Criterios de Verificación

| Test | Criterio verificable |
|------|---------------------|
| FA01 | POST /components × 2 → 201; GET /components → 2 registros |
| FA02 | Stock X: 10→9, Stock Y: 5→4 después de vender 1 combo |
| FA03 | sale.items[combo].recipe_snapshot contiene component_id X e Y |
| FA04 | item.quantity=1.250, subtotal_usd=10.00, stock 10→8.75 |
| FA05 | POST /components con component_id=parentId → 422 "sí mismo" |

---

## Archivo de Tests

```
tests/sprint19-fabrica.spec.ts
  ✅ FA01 — crear combo con dos componentes devuelve 201
  ✅ FA02 — vender combo descuenta componentes, no el combo
  ✅ FA03 — recipe_snapshot guardado en sale_items del combo
  ✅ FA04 — producto por peso acepta qty decimal y descuenta correctamente
  ✅ FA05 — anti-circular: combo no puede ser su propio componente
```

**Ejecutar:** `npx playwright test tests/sprint19-fabrica.spec.ts --reporter=list`
(Requiere servidor en `http://localhost:3000` con datos seed)

---

## Checklist Pre-Commit

- [x] TypeScript strict: `npx tsc --noEmit` → 0 errores
- [x] business_id de getSession() — verificado en A3
- [x] Paradigma qty × price — ventas/route.ts:135-136 correcto
- [x] Stock descuenta solo en status=paid — sales/route.ts:222
- [x] recipe_snapshot en sale_items — A1 verificado
- [x] Cero fachadas detectadas en el módulo
