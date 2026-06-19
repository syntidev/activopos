# HANDOFF — Sprint 10 → Sprint 11
# ActivoPOS | 2026-06-19
# Entregado por: CLI-A + CLI-B + CLI-C + CLI-D (Sprint 10 completo)

---

## ANTES DE HACER CUALQUIER COSA

Lee estos archivos en este orden:
```
1. CLAUDE.md (raíz)
2. .doc/SYSTEM_MAP.md
3. .doc/ACTIVOPOS_MASTER_V2.md
4. .doc/AGENTS.md
```
Si no leíste los 4 → cualquier acción que tomes es potencialmente destructiva.

---

## INICIO DE SESIÓN — SIEMPRE

```powershell
Remove-Item -Recurse -Force .next
npm run dev
# Esperar "Ready on http://localhost:3000"
curl http://localhost:3000/api/rates/bcv
# Esperado: {"rate":607.xx,"source":"bcv","ok":true}
```

Verificar tests antes de tocar código:
```bash
npx playwright test --reporter=list
# Esperado: 13/13 pasando
```

---

## QUÉ SE COMPLETÓ EN SPRINT 10

### Certificaciones E2E (13 tests totales)
- ✅ **POS núcleo** — 6/6: apertura caja → búsqueda → agregar → cobro → cierre → reporte
- ✅ **Servicios en POS** — S01-S03: sale_mode=service siempre enabled, físico sin stock bloqueado
- ✅ **Stock en catálogo** — C01-C04: badges dinamicos (disponible / N disponibles / sin stock / on_request)

### Deuda técnica resuelta
| ID     | Descripción                            | Solución                                         |
|--------|----------------------------------------|--------------------------------------------------|
| DT-001 | dollarRate sin business_id             | migration + query con business_id               |
| DT-002 | sold_at incorrecto                     | confirmado correcto, no requirió cambio          |
| DT-003 | SaleAbono sin cash_register_id         | migration + campo en POST /api/ventas/[id]/abono |
| DT-005 | CashMovement filtro cross-tenant       | business_id en query de cash/movement            |
| DT-006 | Emojis en UI                           | Lucide Star en CatalogoGrid                     |
| DT-007 | 7 tokens RGB faltantes                 | sweep completo en 9 módulos CSS                  |

### Seguridad
- ✅ Role guard cashier→403 en 5 endpoints de `/api/finanzas/*` (P1 resuelto)
- ✅ Import limit 5MB en `products/import` (P1 resuelto)
- ✅ Primera auditoría formal: QUALITY_REPORT_Sprint10.md — 56 endpoints revisados
- ✅ BUG-001 resuelto: `/api/dashboard/charts` HTTP 500 — DATE_FORMAT fix MariaDB

### Features nuevas
- ✅ **Availability enum**: in_stock / low_stock / out_of_stock / discontinued — calculado dinámico
- ✅ **CatalogVisibility enum**: visible / hidden / on_request — filtro SSR + API
- ✅ **ProductModal**: controles de visibilidad + CatalogUpgradeModal paywall
- ✅ **CatalogoGrid**: badges de estado + on_request → precio oculto + CTA WhatsApp
- ✅ **Herencia service**: product_type=service → sale_mode=service (write + read path)
- ✅ **outOfStock fix**: productos sin inventory_entries son agotados (undefined → 0)
- ✅ CLI-C encontró y corrigió 2 bugs de integración:
  - POST schema sin catalog_visibility → on_request se guardaba como visible
  - SSR page.tsx sin filtro hidden → productos ocultos aparecían en catálogo público

---

## SPRINT 11 — PRIORIDAD 1: Certificar módulo Caja

**Bloqueado hasta resolver DT-011 y DT-012 primero.**

El cuadre de caja depende de `amount_bs` correcto — si el cliente puede manipularlo, el cuadre es inválido. El TOCTOU permite doble cierre — cualquier test de cuadre sería falso.

### DT-011 (P2) — amount_bs client-supplied
**Archivo:** `src/app/api/ventas/[id]/abono/route.ts`
**Problema:** El cliente envía `amount_bs` en el body. Debe calcularse del server: `amount_usd × rate`.
**Fix CLI-A:** Ignorar `amount_bs` del body, calcular `amount_bs = amount_usd × getBcvRate()`.

### DT-012 (P2) — cash/close TOCTOU
**Archivo:** `src/app/api/cash/close/route.ts`
**Problema:** Dos requests simultáneos pueden cerrar el mismo turno dos veces.
**Fix CLI-A:** Envolver en `$transaction` con `findFirst` para verificar que el registro aún esté abierto antes de cerrar.

### Flujo completo de certificación de Caja (post DT-011 + DT-012)
```
1. Abrir turno con monto inicial en USD → verificar en DB
2. Ejecutar 3 ventas en métodos distintos (efectivo + pago móvil + Zelle)
3. Registrar movimiento de caja (entrada manual)
4. Cerrar turno → cuadre exacto (expected vs real)
5. Historial de turnos con detalle de movimientos
```

---

## SPRINT 11 — PRIORIDAD 2: Deuda técnica pendiente

| ID     | Sev | Descripción                                          | CLI   | Bloqueante  |
|--------|-----|------------------------------------------------------|-------|-------------|
| DT-011 | P2  | ventas/[id]/abono — amount_bs client-supplied        | CLI-A | Caja P1     |
| DT-012 | P2  | cash/close — TOCTOU race condition                   | CLI-A | Caja P1     |
| DT-013 | P2  | rates/bcv sin auth requerida                         | CLI-A | No          |
| DT-008 | P2  | Dos fuentes de filtro catálogo — función compartida  | CLI-A | No          |
| DT-009 | P2  | computeAvailability no alimenta SSR catálogo         | CLI-A | No          |
| DT-004 | P2  | Service Worker PWA ausente                           | CLI-D | No          |
| DT-010 | P3  | discontinued sin badge visual en CatalogoGrid        | CLI-B | No          |

---

## SPRINT 11 — PRIORIDAD 3: Features

- **Onboarding completo**: primer negocio activa sin tocar código — flujo end-to-end
- **Export Excel** en módulo de reportes
- **Badge discontinued** en CatalogoGrid (DT-010)
- **Admin multitenant** — `admin.activopos.com` — Opus, sesión completamente aislada

---

## REGLA DEL POLICÍA — ESTADO ACTUAL

```
Productos ✅ → POS ✅ → Caja ⏳ → Reportes → Finanzas → Catálogo → Analytics
```

**Caja no puede certificarse hasta resolver DT-011 y DT-012.**

El orden importa: cada módulo depende del anterior. No saltar la cola.

---

## DECISIONES SELLADAS — NO REABRIR

Las siguientes decisiones están cerradas. No proponer alternativas sin autorización explícita de Carlos.

- `qty × price_usd × rate = total_bs` — nunca `bs → qty`
- Dual moneda USD + Bs simultáneo — sin toggle
- CSS Modules — sin Tailwind, sin inline styles
- `business_id` de `getSession()` — nunca del body
- Sistema de visibilidad: 3 propiedades ortogonales (`product_type`, `availability`, `catalog_visibility`)
- `on_request` muestra precio oculto + CTA WhatsApp — no cambiar UX
- Badges de disponibilidad: colores y textos aprobados en Sprint 10
- Sidebar siempre oscuro, independiente del tema

---

## DATOS DE PRUEBA — DB LOCAL

| Entidad           | Datos seed                                             |
|-------------------|--------------------------------------------------------|
| Business          | "Tienda Demo" — slug: demo — catalog: activo          |
| Admin user        | admin@activopos.com / admin123                        |
| Cashier user      | cajero@activopos.com / cajero123 (ver seed.ts)        |
| Producto servicio | id=18 "Corte de Cabello" — sale_mode=service           |
| Producto con stock| id=10 "Arepa con Pollo" — ~47 unidades                 |
| Sin inventario    | id=14 "Audífonos Bluetooth" — stock=0 (sin entries)   |

---

## ARCHIVOS CRÍTICOS PARA SPRINT 11

```
src/app/api/ventas/[id]/abono/route.ts   ← DT-011 — fix amount_bs
src/app/api/cash/close/route.ts          ← DT-012 — fix TOCTOU
src/app/api/rates/bcv/route.ts           ← DT-013 — agregar auth
src/app/api/catalog/[slug]/route.ts      ← DT-008 — función compartida con page.tsx
src/app/catalogo/[slug]/page.tsx         ← DT-009 — computeAvailability en SSR
tests/caja-core.spec.ts                  ← CREAR — certificación Caja
```

---

*Generado: 2026-06-19 | HEAD: 26efc1a | Entregado por: CLI-D*
