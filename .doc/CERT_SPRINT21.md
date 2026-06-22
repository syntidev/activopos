# CERT_SPRINT21.md — Certificación Sprint 21
# Agente: CLI-C | Fecha: 2026-06-22 | Estado: ✅ CERTIFICADO (UI-04 parcial — pendiente CLI-B)

---

## Resumen

Sprint 21 certifica: SEC-04 rate limiter DB para PIN de descuentos, importación Excel de productos, variantes de producto en backend (GET/POST), y soporte de `variant_id` en la ruta de ventas. `PinDescuentoModal` está implementado pero sin disparador en la UI (UI-04 P2, pendiente CLI-B).

**TypeScript: 0 errores | Tests E2E: IM01-IM03, VA01-VA03, PI01-PI02 verificables via API**

---

## Commits Sprint 21 auditados

```
8a42e62  feat(sprint-21/CLI-A): SEC-04 rate limit DB + import Excel + variantes backend
f5119a6  feat(sprint-21/CLI-B): import Excel UI + variantes UI en ProductModal + modal PIN descuento
```

---

## Auditorías

### A1 — SEC-04: Rate limiter DB para PIN (pin-rate-limit.ts) ✅

```
src/lib/pin-rate-limit.ts:11-46
  checkAndIncrementPinAttempts(businessId, saleId): Promise<boolean>
  → MAX_ATTEMPTS = 5, WINDOW_MS = 5min (300_000ms)
  → prisma.$transaction: findUnique → upsert/update atómico
  → expired entries: lazy cleanup non-blocking (void deleteMany.catch())
  → retorna true (bloqueado) si existing.attempts >= 5

src/lib/pin-rate-limit.ts:49-56
  clearPinAttempts(businessId, saleId): void
  → deleteMany WHERE business_id + sale_id
  → llamado en authorize-discount tras PIN correcto

src/app/api/sales/[id]/authorize-discount/route.ts
  → reemplaza Map en memoria por checkAndIncrementPinAttempts/clearPinAttempts
  → contador sobrevive pm2 restart y crash de proceso
```

Doble protección mantenida: rate limit DB + anti-compounding check + atomic updateMany.

### A2 — Import Excel: POST /api/products/import-excel ✅

```
src/app/api/products/import-excel/route.ts:73-187
  → Auth: session requerida; cashier → 403
  → business_id siempre de session.businessId (NUNCA del body)
  → multipart/form-data, campo "file"
  → Límites: 5MB, 1000 filas
  → dry_run=true → valida todas las filas, retorna {ok,dry_run,valid,errors} sin crear
  → validateRow(): nombre requerido, precio_usd≥0, costo_usd≥0, stock≥0
  → product_type: simple|combo|fabricable (default: simple)
  → auto-crea categorías via categoryCache (Map<string,id> evita duplicados)
  → crea producto + inventoryEntry en prisma.$transaction por fila
```

Columnas del template: `nombre, precio_usd, costo_usd, stock, categoria, product_type, unit_label`

### A3 — Import Excel: GET template ✅

```
src/app/api/products/import-excel/template/route.ts
  → cashier → 403
  → Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
  → 3 filas de ejemplo: Café Americano (simple), Azúcar kg (simple), Combo Desayuno (combo)
```

### A4 — Variantes backend: GET/POST /api/products/[id]/variants ✅

```
src/app/api/products/[id]/variants/route.ts
  → GET: devuelve variants ordenados por sort_order, valor
  → POST: cashier → 403
  → Zod schema: tipo (talla|color|personalizado), valor, sku, precio_extra, stock,
                color_hex (#RRGGBB regex), sort_order, price_usd, cost_usd
  → Verifica que el producto pertenece al business_id del session
  → Usa .issues en ZodError (correcto, Zod v4)
```

### A5 — variant_id en sales/route.ts ✅

```
src/app/api/sales/route.ts:8-15
  saleItemSchema: variant_id z.number().int().positive().optional()

sales/route.ts:121-130
  Fetch variants WHERE id IN variantIds AND is_active=true
  variantMap = Map<variantId, variant>

sales/route.ts:149-160
  Validate: variant.product_id === product.id (o throw error)
  Price: variant.price_usd ?? product.price_per_unit_usd ?? product.price_per_kg_usd

sales/route.ts:263-268
  Stock: si variant_id → ProductVariant.update({stock: {decrement: qty}})
         si no → InventoryEntry (comportamiento original)
```

Cadena completa: variante recibida → validada por pertenencia → precio override → stock deducido en variante.

### A6 — PinDescuentoModal ✅ (componente) / ⚠️ (UI no disparada)

```
src/components/pos/PinDescuentoModal.tsx
  → 4 PIN inputs con auto-advance (handlePinChange)
  → Backspace navega al input anterior (handlePinKeyDown)
  → shake + clear en error (triggerShake, 600ms)
  → 429 → setRateLimited(true), inputs disabled
  → onApply(pct, pin) llama authorize-discount desde usePOS

src/app/(dashboard)/pos/page.tsx:151-157
  <PinDescuentoModal open={pos.showPinDescuento} ...>
  ✅ montado y correctamente configurado

pos/page.tsx:109
  onDescuento={() => pos.setShowDescuento(true)   ← abre DescuentoModal (sin PIN)
  ⚠️ NUNCA llama setShowPinDescuento(true)
```

**UI-04 P2 — ver hallazgos adicionales.**

---

## Hallazgos adicionales (REPORTE — scope otros agentes)

### UI-04 — P2: PinDescuentoModal nunca se abre desde UI (pendiente CLI-B)

**Archivo:** `src/app/(dashboard)/pos/page.tsx:109`
**Hallazgo:** El callback `onDescuento` llama `pos.setShowDescuento(true)` (abre `DescuentoModal` legacy, sin PIN). El estado `showPinDescuento` existe pero nunca se pone en `true` desde ningún botón.
**Resultado:** Toda la implementación del modal de PIN (PinDescuentoModal, authorize-discount con PIN, SEC-04 DB rate limit) es funcional vía API pero inaccesible vía UI.
**Fix CLI-B:** En el `TicketPanel` → botón Descuento → `onClick={() => pos.setShowPinDescuento(true)}` (o condicional: si `business.max_discount_pct > 0` → PinDescuentoModal, si no → DescuentoModal).

### VA-FIND — P3: error "Variante no corresponde" retorna 500 en lugar de 400

**Archivo:** `src/app/api/sales/route.ts:314-328`
**Hallazgo:** El error `'Variante no corresponde al producto "${product.name}"'` es un error de validación de negocio con mensaje legible, pero no está en la lista `knownErrors`, por lo que retorna 500 en lugar de 400.
**Fix CLI-A:** Agregar `'Variante no corresponde'` a la lista `knownErrors` en el catch block.

---

## Criterios de certificación por test

| Test | Criterio verificable |
|------|---------------------|
| IM01 | `dry_run:true`, `valid:1`, `errors.length≥1`, sin campo `created` en respuesta |
| IM02 | `created:1`, `errors:[]`, `dry_run:false` |
| IM03 | HTTP 400, `body.error` contiene "vacío" |
| VA01 | HTTP 201, `variant.id>0`, `variant.product_id===productId`, `price_usd≈7.50` |
| VA02 | `item.price_per_unit_usd≈5.00` aunque producto vale $10, `sale.total_usd≈5.00` |
| VA03 | HTTP ≠ 201 (actualmente 500, pendiente CLI-A para → 400) |
| PI01 | 5 intentos → 401 × 5; 6.º intento → 429 |
| PI02 | 4 × 401, luego PIN correcto → 200; nueva venta → siguiente intento → 401 (no 429) |

---

## Archivo de Tests

```
tests/sprint21-import-variantes.spec.ts
  IM01 — dry_run valida sin crear productos
  IM02 — import real crea producto + inventory entry
  IM03 — xlsx vacío → 400
  VA01 — POST variante → 201 + objeto variant
  VA02 — price_usd variante overrides precio producto en venta
  VA03 — variant_id de otro producto → sale rechazado (non-201)
  PI01 — SEC-04: rate limiter DB bloquea tras 5 intentos fallidos
  PI02 — PIN correcto limpia contador; intento posterior no bloqueado
```

**Ejecutar:** `npx playwright test tests/sprint21-import-variantes.spec.ts --reporter=list`
(Requiere servidor activo en `http://localhost:3000` con datos seed)

---

## Checklist Pre-Commit

- [x] TypeScript strict: `npx tsc --noEmit` → 0 errores
- [x] Solo archivos de test/cert — sin tocar código de producción
- [x] Hallazgo UI-04 documentado: PinDescuentoModal sin disparador en UI (pendiente CLI-B)
- [x] Hallazgo VA-FIND documentado: error de variante retorna 500 → pendiente CLI-A → 400
- [x] PI01/PI02 cubren SEC-04 vía API (modal unreachable desde UI)
