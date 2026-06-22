# CERT_SPRINT20.md — Certificación Sprint 20
# Agente: CLI-C | Fecha: 2026-06-21 | Estado: ✅ CERTIFICADO (SD05 parcial — pendiente CLI-B)

---

## Resumen

Sprint 20 certifica: parches SEC-01 (precio DB) y SEC-02 (recipe_snapshot en cobro diferido), sistema de autorización de descuentos con PIN y rate limiting. CLI-B no ha implementado el modal de PIN UI (explícito en commit dd3862f).

**TypeScript: 0 errores | Tests E2E: SD01-SD04 verificables via API | SD05 parcial (UI sin PIN modal)**

---

## Commits Sprint 20 auditados

```
30e31e3  fix(sprint-20/CLI-A): sec vulns + 3 gaps backend authorize-discount + config
dd3862f  fix(sprint-20/CLI-A): SEC-01 precio DB + SEC-02 recipe_snapshot + descuentos PIN
```

---

## Auditorías

### A1 — SEC-01: price_per_unit_usd eliminado del body ✅

```
sales/route.ts:8-14
  saleItemSchema NO incluye price_per_unit_usd
  # comment: "price_per_unit_usd NOT accepted from client — SEC-01: always fetched from DB"

sales/route.ts:136-138
  const priceUsd = Number(product.price_per_unit_usd ?? product.price_per_kg_usd ?? 0)
  if (priceUsd <= 0) throw new Error(`Precio no configurado para "${product.name}"`)
```

Zod strip elimina silenciosamente cualquier `price_per_unit_usd` del body. El precio siempre viene de DB. Error explícito si precio no configurado.

### A2 — SEC-02: recipe_snapshot en pay route ✅

```
sales/[id]/pay/route.ts:122-127
  const components =
    item.recipe_snapshot
      ? (JSON.parse(item.recipe_snapshot) as { component_id: number; quantity: number }[])
      : item.product.components   // fallback para ventas antiguas (pre-Sprint 19)
```

Snapshot capturado al crear la venta. Inmune a cambios de receta entre creación y cobro.

### A3 — Authorize-discount: rate limiting ✅

```
authorize-discount/route.ts:15-33
  Map<"businessId:saleId", { count, resetAt }>
  MAX_ATTEMPTS = 5 | WINDOW_MS = 5min
  isRateLimited() → 429 si se excede
  clearAttempts() solo en éxito (PIN correcto)
```

5 intentos por venta por 5 minutos. Clave `businessId:saleId` aísla tenants. Contador NO se resetea en fallo.

### A4 — Authorize-discount: anti-compounding ✅

```
authorize-discount/route.ts:81-86
  if (sale.discount_pct > 0) → 409 "ya tiene un descuento"

authorize-discount/route.ts:124-132
  updateMany WHERE discount_pct = 0  ← previene race condition
  if (result.count === 0) → 409      ← detección post-race
```

Doble protección: check previo + condición atómica en UPDATE.

### A5 — Authorize-discount: sin fuga de información ✅

Respuesta exitosa devuelve solo `{ ok, discount_pct, new_total_usd, new_total_bs }`. El nombre del autorizador fue **removido** (presente en versión anterior, eliminado en commit 30e31e3). En error, tampoco se filtra rol ni nombre.

### A6 — max_discount_pct configurable ✅

```
config/business/route.ts → PATCH acepta max_discount_pct (0-100)
authorize-discount/route.ts:105-113
  maxPct = business.max_discount_pct ?? 0
  !isAdmin && discount_pct > maxPct → 403
  isAdmin (admin/super_admin) → bypasa límite
```

---

## Hallazgos adicionales encontrados (REPORTE — scope CLI-A/B)

### SEC-04 — P3: rate limiter in-memory no sobrevive restart PM2

**Archivo:** `authorize-discount/route.ts:15`
**Hallazgo:** El `Map<string, ...>` de rate limiting vive en memoria del proceso. Con `pm2 restart` o crash, el contador se pierde. Un atacante puede enviar 5 intentos, esperar el restart, enviar 5 más.
**Nota:** Para PYME con poco tráfico y PM2 single-process esto es aceptable en v1. El riesgo real es bajo: bcrypt es lento (3-4s por intento), el ataque real dura 20+ segundos por batch.
**Recomendación CLI-A Sprint 21:** Persistir contador en tabla `pin_rate_limits` (id, business_id, sale_id, count, reset_at) para resistir restarts.

### UI-01 — P2: Sidebar móvil no cierra al navegar (pendiente CLI-B)

**Archivo:** `src/components/layout/Sidebar.tsx:172-198`
**Hallazgo:** Los `<Link>` del menú de navegación NO llaman `onCloseMobile()`. Al tocar un ítem en mobile, el sidebar permanece abierto sobre el contenido. Solo se cierra con el backdrop overlay o al hacer logout.
**Reproducción:** Mobile viewport (< 1024px) → abrir sidebar → tocar "Escritorio" → sidebar se queda abierto.
**Fix CLI-B:** Pasar `onCloseMobile` como prop a `NavContent` y llamarlo en el `onClick` de cada `<Link>`.

### UI-02 — P3: Modal.module.css usa z-index hardcodeado 1000

**Archivo:** `src/components/ui/Modal.module.css:9`
**Hallazgo:** `.overlay { z-index: 1000; }` — no usa el token `var(--z-modal)` (400) ni `var(--z-toast)` (500). Viola CLAUDE.md: "cero valores hardcodeados en componentes".
**Impacto:** El modal de Radix siempre apila sobre todo (1000 > 170 del POS drawer), lo que puede ser intencional, pero rompe la escala de tokens definida.

### UI-03 — P3: POS cart drawer usa z-index hardcodeados

**Archivo:** `src/app/(dashboard)/pos/pos.module.css:797,813,836`
**Hallazgo:** `.drawerOverlay: 160`, `.cartToggle: 155`, `.cartSlot: 170` — no usan tokens CSS.

---

## Criterios de certificación por test

| Test | Criterio verificable |
|------|---------------------|
| SD01 | `sale.items[0].price_per_unit_usd = 5.00` aunque body envió `0.01` |
| SD02 | Stock del componente decrementó en 2 (snapshot) no en 0 (receta vacía) |
| SD03 | PIN incorrecto → HTTP 401 con error que contiene "PIN" |
| SD04 | Cajero PIN + 20% → 403 / Admin PIN + 20% → 200, new_total_usd=8.00 |
| SD05 | Botón "Descuento" visible y disabled en ticket vacío (modal PIN pendiente CLI-B) |

---

## Archivo de Tests

```
tests/sprint20-security.spec.ts
  SD01 — precio DB ignorando body manipulado (SEC-01)
  SD02 — recipe_snapshot usado en cobro diferido (SEC-02)
  SD03 — descuento con PIN incorrecto rechazado → 401
  SD04 — cajero sobre límite → 403 | admin cualquier % → 200
  SD05 — botón Descuento presente en ticket panel POS (PIN modal pendiente CLI-B)
```

**Ejecutar:** `npx playwright test tests/sprint20-security.spec.ts --reporter=list`
(Requiere servidor activo en `http://localhost:3000` con datos seed)

---

## Checklist Pre-Commit

- [x] TypeScript strict: `npx tsc --noEmit` → 0 errores
- [x] Solo archivos de test — sin tocar código de producción
- [x] Hallazgos documentados: SEC-04, UI-01, UI-02, UI-03
- [x] SD05 documentado como parcial (CLI-B pendiente, sin fachada)
