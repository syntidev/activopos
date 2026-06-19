# SYSTEM_MAP — ActivoPOS
# Generado desde código real — 2026-06-19
# Fuente: find, grep, prisma/schema.prisma, git log
# NO editar a mano — regenerar con el prompt CLI-C

---

## 0. ESTADO GENERAL

| Campo              | Valor                                                       |
|--------------------|-------------------------------------------------------------|
| Último sprint      | Sprint 10                                                   |
| Último commit      | 26efc1a — audit(sprint-10/CLI-C): integración visibility    |
| TypeScript         | ✅ 0 errores — `npx tsc --noEmit`                           |
| Build              | ✅ Limpio — verificar con `npm run build`                   |
| Tests E2E          | ✅ 13/13 pasando (pos-core 6 + services-and-catalog 7)      |

### Certificación de módulos (Regla del Policía)

```
Productos ✅ → POS ✅ → Caja ⏳ → Reportes → Finanzas → Catálogo → Analytics
```

| Módulo        | Estado               | Sprint | Evidencia                                     |
|---------------|----------------------|--------|-----------------------------------------------|
| Productos     | ✅ CERTIFICADO        | 10     | TypeScript 0 errores, visibility system E2E   |
| POS           | ✅ CERTIFICADO        | 10     | 6/6 Playwright: apertura → venta → cobro      |
| Servicios POS | ✅ CERTIFICADO        | 10     | S01-S03: service siempre enabled en POS       |
| Catálogo      | ✅ CERTIFICADO        | 10     | C01-C04: stock + badges + on_request + hidden |
| Caja          | ⏳ PENDIENTE          | 11     | Bloqueado por DT-011 y DT-012                 |
| Reportes      | ❌ NO INICIADO        | —      |                                               |
| Finanzas      | ❌ NO INICIADO        | —      |                                               |
| Analytics     | ❌ NO INICIADO        | —      |                                               |

---

## 1. RUTAS DE PÁGINA

| Ruta URL              | Archivo                                          | Auth     | Notas                          |
|-----------------------|--------------------------------------------------|----------|--------------------------------|
| `/`                   | `src/app/page.tsx`                               | pública  | Redirige al dashboard o login  |
| `/login`              | `src/app/(auth)/login/page.tsx`                  | pública  |                                |
| `/escritorio`         | `src/app/(dashboard)/escritorio/page.tsx`        | JWT      | Dashboard principal            |
| `/pos`                | `src/app/(dashboard)/pos/page.tsx`               | JWT      | Punto de venta — certificado ✅ |
| `/pedidos`            | `src/app/(dashboard)/pedidos/page.tsx`           | JWT      | Órdenes del catálogo           |
| `/cotizaciones`       | `src/app/(dashboard)/cotizaciones/page.tsx`      | JWT      |                                |
| `/clientes`           | `src/app/(dashboard)/clientes/page.tsx`          | JWT      |                                |
| `/productos`          | `src/app/(dashboard)/productos/page.tsx`         | JWT      | Inventario + catálogo unificado|
| `/caja`               | `src/app/(dashboard)/caja/page.tsx`              | JWT      | ⏳ Pendiente certificación     |
| `/caja/historial`     | `src/app/(dashboard)/caja/historial/page.tsx`    | JWT      |                                |
| `/reportes`           | `src/app/(dashboard)/reportes/page.tsx`          | JWT      |                                |
| `/finanzas`           | `src/app/(dashboard)/finanzas/page.tsx`          | JWT      | CxC, CxP, Gastos, Resumen      |
| `/configuracion`      | `src/app/(dashboard)/configuracion/page.tsx`     | JWT      |                                |
| `/devoluciones`       | `src/app/(dashboard)/devoluciones/page.tsx`      | JWT      |                                |
| `/tu-dia`             | `src/app/(dashboard)/tu-dia/page.tsx`            | JWT      |                                |
| `/usuarios`           | `src/app/(dashboard)/usuarios/page.tsx`          | JWT      |                                |
| `/ayuda`              | `src/app/(dashboard)/ayuda/page.tsx`             | JWT      |                                |
| `/onboarding`         | `src/app/(dashboard)/onboarding/page.tsx`        | JWT      |                                |
| `/catalogo/[slug]`    | `src/app/catalogo/[slug]/page.tsx`               | pública  | SSR + CatalogoGrid client      |

**Middleware público** (`src/middleware.ts`):
```
PUBLIC_PREFIXES = ['/login', '/api/auth/', '/catalogo/', '/api/catalog/']
```

---

## 2. ENDPOINTS API

### Auth
| Método | Endpoint            | Auth     |
|--------|---------------------|----------|
| POST   | `/api/auth/login`   | pública  |
| POST   | `/api/auth/logout`  | pública  |
| GET    | `/api/auth/me`      | JWT      |

### Caja
| Método   | Endpoint                 | Notas                              |
|----------|--------------------------|------------------------------------|
| GET      | `/api/cash`              | Estado general                     |
| POST     | `/api/cash/open`         | Apertura — findFirst en transaction|
| POST     | `/api/cash/close`        | Cierre de turno ⚠️ DT-012 TOCTOU  |
| GET      | `/api/cash/status`       | Stats del turno activo             |
| GET\|POST| `/api/cash/movement`     | Entradas/salidas de efectivo       |
| GET      | `/api/cash/history`      | Historial de registros             |

### Catálogo (público, sin JWT)
| Método | Endpoint                       | Notas                                     |
|--------|--------------------------------|-------------------------------------------|
| GET    | `/api/catalog/[slug]`          | Productos del catálogo público            |
| POST   | `/api/catalog/[slug]/order`    | Crear pedido — precios siempre del DB     |

### Categorías
| Método        | Endpoint                 |
|---------------|--------------------------|
| GET\|POST     | `/api/categories`        |
| PATCH\|DELETE | `/api/categories/[id]`   |

### Clientes
| Método           | Endpoint                       |
|------------------|--------------------------------|
| GET\|POST        | `/api/clients`                 |
| GET\|PATCH\|DELETE| `/api/clients/[id]`           |
| GET              | `/api/clients/[id]/history`    |
| POST             | `/api/clients/[id]/abono`      |

### Configuración
| Método        | Endpoint                             |
|---------------|--------------------------------------|
| GET\|PATCH    | `/api/config/business`               |
| GET\|POST     | `/api/config/catalog`                |
| GET\|PATCH    | `/api/config/delivery`               |
| GET\|PATCH    | `/api/config/iva`                    |
| GET\|POST\|PATCH| `/api/config/payment-methods`      |
| PATCH         | `/api/config/payment-methods/[id]`   |
| PATCH         | `/api/config/pin`                    |
| PATCH         | `/api/config/theme`                  |
| GET\|PATCH    | `/api/config/ticket`                 |

### Dashboard
| Método | Endpoint                    | Notas                              |
|--------|-----------------------------|------------------------------------|
| GET    | `/api/dashboard/kpis`       |                                    |
| GET    | `/api/dashboard/charts`     | ✅ BUG-001 resuelto — DATE_FORMAT  |

### Finanzas
| Método    | Endpoint                    | Notas                     |
|-----------|-----------------------------|---------------------------|
| GET       | `/api/finanzas/cxc`         | ✅ role guard cashier→403 |
| GET\|POST | `/api/finanzas/cxp`         | ✅ role guard cashier→403 |
| PATCH     | `/api/finanzas/cxp/[id]`    | ✅ role guard cashier→403 |
| GET\|POST | `/api/finanzas/gastos`      | ✅ role guard cashier→403 |
| GET       | `/api/finanzas/resumen`     | ✅ role guard cashier→403 |

### Inventario
| Método    | Endpoint          |
|-----------|-------------------|
| GET\|POST | `/api/inventory`  |

### Órdenes
| Método    | Endpoint                       | Notas                |
|-----------|--------------------------------|----------------------|
| GET\|POST | `/api/orders`                  |                      |
| GET\|PATCH| `/api/orders/[id]`             |                      |
| GET       | `/api/orders/[id]/whatsapp`    | Genera URL WA        |

### Métodos de pago
| Método | Endpoint                  |
|--------|---------------------------|
| GET    | `/api/payment-methods`    |

### Productos
| Método           | Endpoint                                    | Notas                             |
|------------------|---------------------------------------------|-----------------------------------|
| GET\|POST        | `/api/products`                             | availability calculado dinámico   |
| GET\|PATCH\|DELETE| `/api/products/[id]`                       | coerción service→sale_mode        |
| GET\|POST        | `/api/products/[id]/variants`               |                                   |
| PATCH\|DELETE    | `/api/products/[id]/variants/[variantId]`   |                                   |
| GET              | `/api/products/recent`                      | normaliza sale_mode en lectura    |
| GET              | `/api/products/search`                      | normaliza sale_mode en lectura    |
| POST             | `/api/products/import`                      | ✅ size limit 5MB aplicado        |
| —                | `/api/products/categories`                  |                                   |

### Tasas
| Método | Endpoint         | Notas                              |
|--------|------------------|------------------------------------|
| GET    | `/api/rates/bcv` | ⚠️ DT-013 sin auth — Sprint 11    |

### Reportes
| Método | Endpoint              |
|--------|-----------------------|
| GET    | `/api/reports/daily`  |
| GET    | `/api/reports/sales`  |

### Ventas
| Método    | Endpoint                | Notas                            |
|-----------|-------------------------|----------------------------------|
| GET\|POST | `/api/sales`            |                                  |
| PATCH     | `/api/sales/[id]/pay`   |                                  |
| PATCH     | `/api/sales/[id]/void`  |                                  |
| POST      | `/api/ventas/[id]/abono`| ⚠️ DT-011 amount_bs client-side |

### Usuarios
| Método        | Endpoint          |
|---------------|-------------------|
| GET\|POST     | `/api/users`      |
| PATCH\|DELETE | `/api/users/[id]` |

### Misc
| Método        | Endpoint                   | Notas                            |
|---------------|----------------------------|----------------------------------|
| POST          | `/api/upload/image`        | ⚠️ DT-016 MIME spoofing backlog  |
| PATCH\|DELETE | `/api/onboarding/complete` |                                  |

---

## 3. MODELOS PRISMA

**19 modelos** · **19 tablas** · **233+ campos** en total

| Modelo          | Tabla                | Descripción                                  |
|-----------------|----------------------|----------------------------------------------|
| Business        | businesses           | Tenant principal                             |
| User            | users                | Usuarios del sistema (roles)                 |
| Category        | categories           | Categorías de productos                      |
| Product         | products             | Productos con visibilidad y disponibilidad   |
| ProductVariant  | product_variants     | Variantes (talla, color, etc.)               |
| InventoryEntry  | inventory_entries    | Entradas de inventario                       |
| Client          | clients              | Clientes del negocio                         |
| PaymentMethod   | payment_methods      | Métodos de pago configurables                |
| Sale            | sales                | Ventas (quote/pending/paid/cancelled)        |
| SaleItem        | sale_items           | Líneas de cada venta                         |
| SalePayment     | sale_payments        | Pagos de una venta                           |
| SaleAbono       | sale_abonos          | Abonos — con cash_register_id ✅ DT-003      |
| CashRegister    | cash_registers       | Turnos de caja                               |
| CashMovement    | cash_movements       | Movimientos — con business_id ✅ DT-005      |
| DollarRate      | dollar_rates         | Tasas BCV — con business_id ✅ DT-001        |
| ActivityLog     | activity_logs        | Auditoría de acciones críticas               |
| Gasto           | gastos               | Gastos / CxP del negocio                     |
| Order           | orders               | Pedidos del catálogo público                 |
| OrderItem       | order_items          | Líneas de cada pedido                        |

### Enums

| Enum              | Valores                                                      |
|-------------------|--------------------------------------------------------------|
| Role              | super_admin, admin, cashier                                  |
| SaleMode          | unit, weight, service, length, volume, package               |
| SaleStatus        | quote, pending, paid, cancelled                              |
| SaleOrigin        | pos, quote, credit                                           |
| OrderStatus       | received, preparing, ready, dispatched, delivered, cancelled |
| OrderOrigin       | whatsapp, catalog, phone, pos                                |
| MoveType          | in, out                                                      |
| PmType            | cash, transfer, zelle, binance, card, other                  |
| Availability      | in_stock, low_stock, out_of_stock, discontinued              |
| CatalogVisibility | visible, hidden, on_request                                  |

### Campos clave de Product (actualizados Sprint 10)
```
badge               String?           @default("none")   // none|popular|nuevo|promo|recomendado
subcategory         String?
is_featured         Boolean           @default(false)
availability        Availability      @default(in_stock) // calculado dinámico en GET /api/products
catalog_visibility  CatalogVisibility @default(visible)  // controla SSR del catálogo + API
```

### Invariantes de Product type → sale_mode
```
product_type = 'service'  →  sale_mode forzado a 'service' (write: POST/PATCH)
                           →  sale_mode normalizado en lectura (search, recent)
                           →  availability siempre in_stock
                           →  stock ignorado en POS y catálogo
```

---

## 4. MIGRACIONES APLICADAS

| #  | Nombre                                                  | Fecha       |
|----|---------------------------------------------------------|-------------|
| 1  | 20260616023908_init                                     | 2026-06-16  |
| 2  | 20260616120000_add_gastos                               | 2026-06-16  |
| 3  | 20260616140000_add_variants_iva                         | 2026-06-16  |
| 4  | 20260616183852_add_orders_delivery                      | 2026-06-16  |
| 5  | 20260617031955_add_catalog_fields                       | 2026-06-17  |
| 6  | 20260617072511_add_business_segment_cobro_data          | 2026-06-17  |
| 7  | 20260617223638_add_product_badge_subcategory_featured   | 2026-06-17  |
| 8  | 20260617235959_fix_categories_unique_index              | 2026-06-17  |
| 9  | 20260619051022_add_business_id_to_dollar_rates          | 2026-06-19  |
| 10 | 20260619051109_add_cash_register_id_to_sale_abonos      | 2026-06-19  |
| 11 | 20260619055722_add_product_visibility                   | 2026-06-19  |

---

## 5. ÚLTIMOS 15 COMMITS

```
26efc1a  audit(sprint-10/CLI-C): integración visibility system verificada
6e916c2  feat(sprint-10/CLI-B): DT-006+DT-007+BLOQUE-2 — visibilidad catálogo, tokens RGB, badges
e46c9ce  fix+feat(sprint-10/CLI-A): BUG-001 + P1 security + product visibility
8a9e536  fix(sprint-10/CLI-B): DT-007 cerrado — 7 tokens RGB + sweep en 7 módulos CSS
899bdd8  audit(sprint-10/CLI-C): security audit completo — 56 endpoints
d1d745c  fix(sprint-10/CLI-A): security — 3 issues post-review en DT-001
5a40e8e  fix(sprint-10/CLI-A): DT-001 DT-003 DT-005 — deuda técnica backend
43e00f1  feat(sprint-10/CLI-D): servicios siempre disponibles + stock visible en catálogo
3e62cf3  fix(sprint-10/CLI-B): DT-006 — emojis reemplazados por Lucide Star en CatalogoGrid
7d31edc  test(sprint-10/CLI-D): certificación núcleo POS E2E — 6/6 tests
9063a84  docs: SYSTEM_MAP generado desde código real
1000f40  fix: tema del cliente solo aplica dentro del dashboard
31dacc2  fix: categorías sincronizadas entre productos y catálogo
aea130d  feat(sprint-9/CLI-B): auditoría estética completa — sistema visual premium
4b25744  feat(sprint-9/CLI-D): hero banner catálogo — gradiente + logo circular
```

---

## 6. DEUDA TÉCNICA

| ID     | Sev | Estado           | Descripción                                             | Sprint   |
|--------|-----|------------------|---------------------------------------------------------|----------|
| DT-001 | P1  | ✅ RESUELTO       | dollarRate sin business_id — datos cross-tenant         | 10       |
| DT-002 | P1  | ✅ CONFIRMADO     | sold_at correcto en todos los paths                     | 10       |
| DT-003 | P1  | ✅ RESUELTO       | SaleAbono sin cash_register_id                          | 10       |
| DT-004 | P2  | ❌ PENDIENTE      | Service Worker / PWA ausente                            | 11       |
| DT-005 | P1  | ✅ RESUELTO       | CashMovement sin business_id — filtro cross-tenant      | 10       |
| DT-006 | P2  | ✅ RESUELTO       | Emojis en UI → Lucide icons en CatalogoGrid             | 10       |
| DT-007 | P2  | ✅ RESUELTO       | 7 tokens RGB faltantes + sweep 9 módulos CSS            | 10       |
| DT-008 | P2  | ❌ PENDIENTE      | Dos fuentes de filtro catálogo → función compartida     | 11       |
| DT-009 | P2  | ❌ PENDIENTE      | computeAvailability no alimenta SSR catálogo            | 11       |
| DT-010 | P3  | ❌ PENDIENTE      | discontinued sin badge visual en CatalogoGrid           | 11       |
| DT-011 | P2  | ❌ PENDIENTE      | ventas/[id]/abono — amount_bs client-supplied           | 11       |
| DT-012 | P2  | ❌ PENDIENTE      | cash/close — TOCTOU race condition (doble cierre)       | 11       |
| DT-013 | P2  | ❌ PENDIENTE      | rates/bcv sin auth requerida                            | 11       |
| DT-014 | P2  | ❌ PENDIENTE      | lib/bcv.ts cache no cluster-safe (PM2 multi-process)    | 12       |
| DT-015 | P3  | ❌ BACKLOG        | TOCTOU updates sin business_id doble filtro             | Backlog  |
| DT-016 | P3  | ❌ BACKLOG        | upload MIME spoofing — magic bytes sin validar          | Backlog  |
| DT-017 | P3  | ❌ BACKLOG        | clients/[id]/abono raw rate query sin caché             | Backlog  |
| DT-018 | P3  | ❌ BACKLOG        | orders precio $0 posible (sin validación min)           | Backlog  |

---

## 7. INVARIANTES DE SEGURIDAD

| Invariante                               | Implementación                                              | Estado        |
|------------------------------------------|-------------------------------------------------------------|---------------|
| `business_id` siempre de `getSession()`  | `src/lib/auth.ts` — nunca del body                          | ✅            |
| Precios en catálogo solo del DB          | `catalog/[slug]/order/route.ts` — ItemSchema sin price      | ✅            |
| Apertura de caja atómica                 | `cash/open/route.ts` — findFirst dentro de $transaction     | ✅            |
| Abonos acotados al turno activo          | `cash/status/route.ts` — created_at >= opened_at            | ✅            |
| Rate limiting en endpoints públicos      | `src/lib/rate-limit.ts` — catalogLimiter, loginLimiter      | ✅            |
| JWT fail-closed                          | `src/lib/auth.ts` — algorithms: ['HS256'], sin fallback     | ✅            |
| Slug validado con regex                  | `/^[a-z0-9-]{3,50}$/` antes de cualquier query             | ✅            |
| Stock descuenta solo en paid             | `sales/route.ts` — status check explícito                   | ✅            |
| Role guard cashier en finanzas           | 5 endpoints — 403 si role === 'cashier'                     | ✅ Sprint 10  |
| Import limit 5MB                         | `products/import/route.ts` — Content-Length check           | ✅ Sprint 10  |
| dollarRate con business_id               | migration 20260619051022                                    | ✅ Sprint 10  |
| SaleAbono con cash_register_id           | migration 20260619051109                                    | ✅ Sprint 10  |
| rates/bcv sin auth                       | ⚠️ DT-013 — expone tasa sin auth                            | Pendiente     |
| cash/close TOCTOU                        | ⚠️ DT-012 — doble cierre posible                            | Pendiente     |
| amount_bs client-supplied                | ⚠️ DT-011 — ventas/[id]/abono                               | Pendiente     |

---

## 8. ESTRUCTURA DE ARCHIVOS CLAVE

```
src/
├── app/
│   ├── (auth)/login/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx                    ← AppLayout, sidebar, header
│   │   ├── escritorio/page.tsx
│   │   ├── pos/page.tsx                  ← certificado ✅
│   │   ├── pedidos/page.tsx
│   │   ├── clientes/page.tsx
│   │   ├── productos/page.tsx
│   │   ├── caja/page.tsx + historial/    ← pendiente certificación
│   │   ├── reportes/page.tsx
│   │   ├── finanzas/page.tsx
│   │   ├── configuracion/page.tsx
│   │   ├── devoluciones/page.tsx
│   │   ├── tu-dia/page.tsx
│   │   ├── usuarios/page.tsx
│   │   └── onboarding/page.tsx
│   ├── catalogo/[slug]/
│   │   ├── page.tsx                      ← SSR: filtro hidden+on_request, outOfStock fix
│   │   ├── CatalogoGrid.tsx              ← badges: disponible/stock/sinstock/onrequest
│   │   └── catalogo.module.css
│   └── api/                              ← 57+ route handlers
├── components/
│   ├── ui/                               ← Button, Input, Badge, Modal, Toast, KpiCard
│   ├── pos/                              ← ProductCard, ProductListRow (service fix ✅)
│   └── layout/                           ← Sidebar, Header, AppLayout
├── lib/
│   ├── prisma.ts                         ← Singleton con PrismaMariaDb adapter
│   ├── auth.ts                           ← JWT HS256 fail-closed
│   ├── bcv.ts                            ← BCV rate service + 1h cache + fallback
│   ├── pos.ts                            ← Motor de cálculo POS
│   └── rate-limit.ts                     ← IP rate limiting
├── styles/
│   ├── tokens.css                        ← Design tokens + 10 temas por segmento
│   └── globals.css
├── types/
└── tests/
    ├── pos-core.spec.ts                  ← 6/6 E2E POS certificado ✅
    ├── services-and-catalog.spec.ts      ← 7/7 E2E services + stock ✅
    ├── auth.setup.ts
    └── playwright.config.ts
```

---

*Generado: 2026-06-19 | HEAD: 26efc1a | Sprint 10 cierre | CLI-D modo EJECUCIÓN*
