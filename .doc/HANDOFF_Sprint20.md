# HANDOFF — Sprint 19 → Sprint 20
# ActivoPOS | 2026-06-21
# Entregado por: CLI-A + CLI-B + CLI-C + CLI-D (Sprint 19 completo)

---

## ANTES DE HACER CUALQUIER COSA

Lee estos archivos en este orden:
```
1. CLAUDE.md (raíz)
2. .doc/SYSTEM_MAP.md          ← v19, actualizado hoy
3. .doc/ACTIVOPOS_MASTER_V2.md
4. .doc/AGENTS.md
```

## INICIO DE SESIÓN — SIEMPRE

```powershell
.\r.ps1
# Esperar "Ready on http://localhost:3000"
curl http://localhost:3000/api/rates/bcv
# Esperado: {"rate":607.xx,"source":"bcv","ok":true}
```

Verificar tests antes de tocar código:
```bash
npx playwright test --reporter=list
# Esperado: 67/67 pasando
```

**CRÍTICO — auth token expira en 8h:**
Si los tests fallan en masa con HTML en lugar de JSON, el JWT expiró.
Ver sección de refresh en HANDOFF_Sprint17.md.

---

## QUÉ SE COMPLETÓ EN SPRINT 19

### Módulo Fábrica (CLI-A + CLI-B ✅)
- **ProductType enum:** `simple | combo | fabricable`
- **UnitType enum:** `unit | weight | volume | length`
- **ProductComponent tabla:** `product_id (combo) + component_id + quantity + unit_label`
- **Endpoints:**
  - `GET /api/products/[id]/components` — lista componentes de un combo
  - `POST /api/products/[id]/components` — añadir componente (valida anti-circular)
  - `PATCH /api/products/[id]/components/[componentId]` — actualizar cantidad
  - `DELETE /api/products/[id]/components/[componentId]` — quitar componente
- **Anti-circular:** `422` si `component_id === product_id` — "producto no puede ser su propio componente"
- **Venta combo → descontar componentes:** al pagar un combo, el stock se descuenta de cada componente, NO del combo
- **recipe_snapshot:** JSON guardado en `sale_items.recipe_snapshot` al momento de la venta (snapshot inmutable de la receta)

### Venta por Peso (CLI-A + CLI-B ✅)
- **unit_type = 'weight':** `unit_step = 0.001`, `base_unit_label = 'kg'`
- **POS:** input decimal habilitado para productos `sale_mode = 'weight'`
- **Stock descontado en fracción:** vender 1.250 kg descuenta 1.250 de inventario
- **Subtotal correcto:** `qty × price_per_unit_usd` con precisión decimal

### Campos nuevos en Product (Sprint 19)
```
product_type      ProductType  @default(simple)   // simple | combo | fabricable
unit_type         UnitType     @default(unit)      // unit | weight | volume | length
unit_step         Float        @default(1)         // 1 para unit, 0.001 para kg
base_unit_label   String       @default("und")     // "und", "kg", "L", "m"
```

### recipe_snapshot en sale_items
- Columna `recipe_snapshot String? @db.Text` en `sale_items`
- Al vender un combo, se guarda JSON con `[{component_id, quantity, unit_label}]`
- Inmutable: no cambia aunque se modifique la receta del producto después de la venta

### Migración
- `20260621000002_add_fabrica_unit_type` — añade enums ProductType + UnitType, campos en products + sale_items, tabla product_components

### Tests — 67/67 sin regresiones
- `sprint19-fabrica.spec.ts` — FA01-FA05 todos verdes
- `analytics-core.spec.ts` AN01 — corregido: acepta "Sin datos disponibles" en cold-start (FA01-FA05 beforeAll no pre-crea ventas en el período de analytics)

---

## ESTADO DEL CORE — COMPLETADO + SPRINT 19

```
Productos ✅ → POS ✅ → Caja ✅ → Reportes ✅ →
Finanzas ✅ → Catálogo ✅ → Analytics ✅ →
Cotizaciones ✅ → Devoluciones ✅ → Usuarios ✅ →
Expense Categories ✅ → Onboarding ✅ →
Tokens v3.0 ✅ → Escritorio v3.0 ✅ →
Mobile POS ✅ → Export Excel ✅ →
Módulo Fábrica ✅ → Venta por Peso ✅
```

**67/67 tests E2E certificados.**

---

## SPRINT 20 — PRIORIDADES

### Prioridad 1: Import masivo productos Excel

| ID     | Sev | Descripción                              | CLI   |
|--------|-----|------------------------------------------|-------|
| DT-042 | P3  | Import Excel /productos — bulk create    | CLI-A |

- Endpoint `POST /api/products/import-excel` (xlsx → products)
- Template descargable con columnas: nombre, precio_usd, stock, categoría, product_type
- CLI-A: endpoint + validación + dry-run mode
- CLI-B: UI drag-drop + progress bar + resultado por fila

### Prioridad 2: Variantes de producto (talla/color/serial)

El modelo `ProductVariant` ya existe. Falta:
- UI para crear variantes desde /productos
- POS: picker de variante al agregar al ticket
- Stock por variante (InventoryEntry ligado a variant_id)

### Prioridad 3: Canales de venta / listas de precio

- Diferente precio para catálogo público vs POS vs mayorista
- Modelo: `PriceList { id, name, type: pos|catalog|wholesale }`
- Sin impacto en paradigma `qty × price` — solo cambia qué `price_per_unit_usd` se usa

### Prioridad 4: Admin multitenant admin.activopos.com

- Panel para Carlos: ver tenants, planes, activar/desactivar negocios
- **Territorio exclusivo de Opus (sesión aislada)**
- CLI-A: API `/api/admin/tenants/...` con `role = super_admin`
- CLI-B: UI tabla de tenants + toggle activo/inactivo

### Prioridad 5: Tu Día — narrativa inteligente del cierre

- `/tu-dia` actualmente placeholder
- Narrativa del cierre de jornada: ventas destacadas, productos top, comparativa vs ayer
- Endpoint `/api/tu-dia/summary` (CLI-A) + UI conversacional (CLI-B)

---

## NOTAS TÉCNICAS PARA SPRINT 20

### Módulo Fábrica — comportamiento de stock

**Regla crítica:** Al pagar una venta con items de tipo `combo` o `fabricable`:
- El stock del combo/fabricable NO se descuenta
- El stock de CADA COMPONENTE se descuenta en `(qty_vendida × component.quantity)`
- Esta lógica está en la API de ventas (`/api/sales`) — no tocar sin entender este invariante

**Ejemplo:**
- Combo "Desayuno" (id=X) tiene: ComponenteA × 1 + ComponenteB × 1
- Venta de 2 "Desayunos" → descuenta ComponenteA -2, ComponenteB -2, NO descuenta X

### recipe_snapshot — formato JSON
```json
[
  { "component_id": 10, "quantity": 1, "unit_label": "und" },
  { "component_id": 12, "quantity": 0.5, "unit_label": "kg" }
]
```
Guardado al momento del pago, inmutable. Sirve para auditoría y reimpresión de tickets.

### AN01 analytics — cold-start fix
AN01 ya no requiere que el `h1` esté visible; acepta tanto datos cargados como estado vacío.
El check de datos reales sigue siendo responsabilidad de AN02-AN04 (que corren después del warm-up).

### ProductType vs product_type en Prisma
- El campo DB es `product_type` (snake_case)
- El enum Prisma es `ProductType { simple, combo, fabricable }`
- En TypeScript: `product.product_type === 'combo'` (string, no enum object)

### unit_step para productos de peso
- `unit_type = 'weight'` debe tener `unit_step = 0.001` (mínimo 1g)
- POS usa `unit_step` para el tick del input decimal (step HTML attribute)
- Inventario almacena Float — MariaDB maneja decimales correctamente

---

## DATOS DE PRUEBA — DB LOCAL (post Sprint 19)

| Entidad           | Datos seed                                                    |
|-------------------|---------------------------------------------------------------|
| Business          | "Mi Negocio Demo" — slug: demo — catalog: activo             |
| Admin user        | admin@activopos.com / admin123                                |
| Cashier user      | cajero@activopos.com / cajero123                             |
| Productos test    | CLI-C19_ComponenteX, CLI-C19_ComponenteY, CLI-C19_Combo_Desayuno, CLI-C19_Queso_Peso |
| Expense Categories| 6 de sistema: Alquiler, Servicios públicos, Nómina, Insumos, Marketing, Otros |
| Producto servicio | id=18 "Corte de Cabello" — sale_mode=service                 |
| Producto con stock| id=10 "Arepa con Pollo" — stock ~30+                         |
| Ventas totales    | > 35 ventas pagadas (cada run de T05+FA02+FA04 agrega ventas)|

---

## ARCHIVOS CRÍTICOS PARA SPRINT 20

```
src/app/api/products/route.ts             ← POST ahora acepta product_type, unit_type, unit_step
src/app/api/products/[id]/components/     ← CRUD componentes de combo
src/app/api/sales/route.ts                ← lógica descuento componentes en combos
src/app/(dashboard)/productos/page.tsx    ← UI selector product_type + editor componentes
src/lib/excel.ts                          ← helper xlsx (ya existe — extender para import)
prisma/schema.prisma                      ← ProductComponent, ProductType, UnitType
.doc/SYSTEM_MAP.md                        ← actualizar a v20 al cerrar sprint
```

---

## COMMITS SPRINT 19 (referencia)

```
(ver git log -- post Sprint 18)
```

---

*Generado: 2026-06-21 | HEAD: post Sprint 19 | Entregado por: CLI-D Sprint 19*
*67/67 tests E2E — CORE + Sprint 15-19 certificado*
