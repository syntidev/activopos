# HANDOFF — Sprint 20 → Sprint 21
# ActivoPOS | 2026-06-21
# Entregado por: CLI-A + CLI-B + CLI-C + CLI-D (Sprint 20 completo)

---

## ANTES DE HACER CUALQUIER COSA

Lee estos archivos en este orden:
```
1. CLAUDE.md (raíz)
2. .doc/SYSTEM_MAP.md          ← v20, actualizado hoy
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
# Esperado: 72/72 pasando
```

**CRÍTICO — auth token expira en 8h:**
Si los tests fallan con HTML en lugar de JSON, el JWT expiró. Regenerar:
```powershell
# Método directo (no requiere rate limiter):
$loginResponse = Invoke-WebRequest -Uri "http://localhost:3000/api/auth/login" `
  -Method POST -ContentType "application/json" `
  -Body '{"email":"admin@activopos.com","password":"admin123"}' `
  -UseBasicParsing
# Luego ejecutar tests/auth.setup.ts via Playwright, o actualizar manualmente:
# Extraer JWT de Set-Cookie header y actualizar tests/.auth-state.json
```

---

## QUÉ SE COMPLETÓ EN SPRINT 20

### Seguridad Backend (CLI-A ✅)

**SEC-01 — Precio del DB, no del body:**
- `/api/sales` (POST): el campo `price_per_unit_usd` del body es ignorado
- El precio siempre se lee del `Product` en DB usando el `product_id`
- Test SD01: POST con `price_per_unit_usd: 0.01` → servidor usa $5.00 del DB

**SEC-02 — recipe_snapshot inmutable en cobro diferido:**
- Al crear una venta `pending` con combo, el snapshot de la receta se guarda en `sale_items.recipe_snapshot`
- Al pagar (`PATCH /api/sales/[id]/pay`), el sistema usa el snapshot, NO la receta live
- Si se borra un componente del combo DESPUÉS de crear la venta, el cobro sigue descontando según el snapshot
- Test SD02: crea pending sale → borra componente → paga → stock descontado según snapshot

**Descuentos con PIN (authorize-discount):**
- Nuevo endpoint: `POST /api/sales/[id]/authorize-discount`
- Payload: `{ pin: string, discount_pct: number }`
- PIN incorrecto → 401 con error que contiene 'PIN'
- Cashier PIN + descuento > max_discount_pct → 403 con error que contiene 'máximo'
- Admin PIN + cualquier descuento → 200 con `{ ok, discount_pct, new_total_usd }`
- `max_discount_pct` configurable via `PATCH /api/config/business`

**Configuración:**
- `PATCH /api/config/business` ahora acepta y guarda `max_discount_pct` (Float, default 0)

### Overlay Management (CLI-B ✅)

- Nuevo hook: `src/hooks/useScrollLock.ts` — bloquea scroll del body al abrir modales
- Token `--z-modal-top: 410` en tokens.css
- Sidebar.tsx, CajaToggle.tsx, QtyInput.tsx refactorizados con gestión de z-index correcta
- Todos los modales de productos (ProductModal, StockModal, CategoryModal, etc.) usan useScrollLock
- `CatalogUpgradeModal`, `ImportModal`, `VariantSelector` corregidos

### POS — Botón Descuento (CLI-B ✅)
- Botón "Descuento" presente en TicketPanel footer
- Deshabilitado cuando el carrito está vacío (comportamiento correcto)
- Modal de PIN pendiente de implementación completa (documentado como pendiente en SD05 test)

### Tests E2E (CLI-C + CLI-D ✅)

**Nuevos tests SD01-SD05 (`tests/sprint20-security.spec.ts`):**
- SD01: SEC-01 precio DB ignorando body manipulado
- SD02: SEC-02 recipe_snapshot usado en cobro diferido
- SD03: descuento con PIN incorrecto rechazado → 401
- SD04: cajero sobre límite → 403 | admin cualquier % → 200
- SD05: botón Descuento presente en ticket panel POS

**Fixes de infraestructura de tests (CLI-D):**
- Eliminados todos los `browser.newContext()` en `beforeAll` de:
  - `finanzas-core.spec.ts` (fix principal — crash exit code 255)
  - `pos-core.spec.ts`
  - `reportes-core.spec.ts`
  - `catalogo-admin.spec.ts`
- Refactorizado `caja-core.spec.ts` beforeAll/afterAll: `{ browser }` → `{ request }` fixture
  (preserva lógica de setup/restore de caja register)
- Añadidos `--disable-dev-shm-usage`, `--no-sandbox` a `launchOptions` en `playwright.config.ts`

---

## ESTADO DEL CORE — COMPLETADO + SPRINT 20

```
Productos ✅ → POS ✅ → Caja ✅ → Reportes ✅ →
Finanzas ✅ → Catálogo ✅ → Analytics ✅ →
Cotizaciones ✅ → Devoluciones ✅ → Usuarios ✅ →
Expense Categories ✅ → Onboarding ✅ →
Tokens v3.0 ✅ → Escritorio v3.0 ✅ →
Mobile POS ✅ → Export Excel ✅ →
Módulo Fábrica ✅ → Venta por Peso ✅ →
Seguridad SEC-01/SEC-02 ✅ → Descuentos PIN ✅
```

**72/72 tests E2E certificados.**

---

## SPRINT 21 — PRIORIDADES

### Prioridad 1: Modal PIN completo para Descuentos

El botón "Descuento" existe en POS pero el modal de PIN está pendiente:
- CLI-B: modal que solicita PIN → llama a `POST /api/sales/[id]/authorize-discount`
- Feedback visual: success (muestra nuevo total) o error (PIN incorrecto / límite excedido)
- Animación "shake" en modal cuando el PIN es incorrecto

### Prioridad 2: Import masivo productos Excel (DT-042)

- Endpoint `POST /api/products/import-excel` (xlsx → products)
- Template descargable con columnas: nombre, precio_usd, stock, categoría, product_type
- CLI-A: endpoint + validación + dry-run mode
- CLI-B: UI drag-drop + progress bar + resultado por fila

### Prioridad 3: Variantes de producto (talla/color/serial)

El modelo `ProductVariant` ya existe. Falta:
- UI para crear variantes desde /productos
- POS: picker de variante al agregar al ticket
- Stock por variante (InventoryEntry ligado a variant_id)

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

## NOTAS TÉCNICAS PARA SPRINT 21

### Endpoint authorize-discount — detalles de implementación

```typescript
// POST /api/sales/[id]/authorize-discount
// Body: { pin: string, discount_pct: number }
// Flujo:
// 1. Busca users con role admin/cashier del mismo business_id
// 2. Verifica PIN hasheado con bcrypt
// 3. Si role === 'cashier' y discount_pct > max_discount_pct → 403
// 4. Calcula new_total_usd = original_total × (1 - discount_pct/100)
// 5. Actualiza sale con discount_pct y new total
// 6. Devuelve { ok, discount_pct, new_total_usd }
```

### max_discount_pct — campo en Business model

```prisma
max_discount_pct  Float  @default(0)
```

Si no existe en el schema, `30e31e3` lo añadió. Verificar en `prisma/schema.prisma`.

### Recipe snapshot — consideraciones para Sprint 21

Si se implementan más tipos de descuento o precios especiales, el `recipe_snapshot` debe seguir siendo inmutable. NO modificar la lógica de `sales/[id]/pay/route.ts` sin entender SEC-02.

### JWT auth-state — renovación en CI

El archivo `tests/.auth-state.json` expira en 8h. Si se configura CI/CD:
- Añadir step de `npx playwright test tests/auth.setup.ts` antes de la suite
- O crear un setup project en `playwright.config.ts` (actualmente no existe)

Para añadir setup project al config:
```typescript
projects: [
  {
    name: 'setup',
    testMatch: /.*\.setup\.ts/,
  },
  {
    name: 'chromium',
    use: {
      ...devices['Desktop Chrome'],
      storageState: AUTH_FILE,
    },
    dependencies: ['setup'],
  },
],
```

### browser.newContext() — patrón eliminado

Todos los `beforeAll`/`afterAll` que usaban `browser.newContext()` fueron refactorizados.
**NUNCA** usar `browser.newContext()` en `beforeAll` sin storageState — causa crash acumulativo
(exit code 255) al correr 20+ tests en suite completa. Usar `{ request }` fixture en su lugar.

---

## DATOS DE PRUEBA — DB LOCAL (post Sprint 20)

| Entidad           | Datos seed                                                    |
|-------------------|---------------------------------------------------------------|
| Business          | "Mi Negocio Demo" — slug: demo — catalog: activo             |
| Admin user        | admin@activopos.com / admin123                                |
| Cashier user      | cajero@activopos.com / cajero123                             |
| max_discount_pct  | 10 (establecido por SD04)                                     |
| Productos test    | CLI-C19_* (fabrica), CLIC20_* (security tests — múltiples)  |
| Ventas pagadas    | > 50 ventas pagadas (cada run de tests agrega más)            |

---

## ARCHIVOS CRÍTICOS PARA SPRINT 21

```
src/app/api/sales/[id]/authorize-discount/route.ts  ← Nuevo Sprint 20
src/app/api/sales/route.ts                          ← SEC-01 precio DB
src/app/api/sales/[id]/pay/route.ts                 ← SEC-02 recipe_snapshot
src/app/api/config/business/route.ts                ← max_discount_pct
src/app/(dashboard)/pos/                            ← Botón Descuento + modal PIN pendiente
src/hooks/useScrollLock.ts                          ← Nuevo Sprint 20
tests/playwright.config.ts                          ← launchOptions Chromium estabilidad
tests/.auth-state.json                              ← JWT — renovar si expira (8h TTL)
.doc/SYSTEM_MAP.md                                  ← actualizar a v21 al cerrar sprint
```

---

## COMMITS SPRINT 20 (referencia)

```
9910e3e  fix(sprint-20/CLI-B): overlay management completo
dd90834  test(sprint-20/CLI-C): certificación seguridad SD01-SD05
30e31e3  fix(sprint-20/CLI-A): sec vulns + 3 gaps backend authorize-discount + config
dd3862f  fix(sprint-20/CLI-A): SEC-01 precio DB + SEC-02 recipe_snapshot + descuentos PIN
```

---

*Generado: 2026-06-21 | HEAD: post Sprint 20 | Entregado por: CLI-D Sprint 20*
*72/72 tests E2E — CORE + Sprint 15-20 certificado*
