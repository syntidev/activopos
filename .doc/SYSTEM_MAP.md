# SYSTEM_MAP — ActivoPOS
# Generado desde código real — 2026-06-19
# Fuente: find, grep, prisma/schema.prisma, git log
# NO editar a mano — regenerar con el prompt CLI-C

---

## 0. ESTADO GENERAL

| Campo              | Valor                                                             |
|--------------------|-------------------------------------------------------------------|
| Último sprint      | Sprint 12                                                         |
| Último commit      | 9bbf473 — cert(sprint-12/CLI-C): certificación módulo Finanzas   |
| TypeScript         | ✅ 0 errores — `npx tsc --noEmit`                                 |
| Build              | ✅ Limpio — verificar con `npm run build`                         |
| Tests E2E          | ✅ 28/28 pasando — no regresiones                                 |

### Certificación de módulos (Regla del Policía)

```
Productos ✅ → POS ✅ → Caja ✅ → Reportes ✅ → Finanzas ✅ → Catálogo ⏳ → Analytics
```

| Módulo        | Estado               | Sprint | Evidencia                                          |
|---------------|----------------------|--------|----------------------------------------------------|
| Productos     | ✅ CERTIFICADO        | 10     | TypeScript 0 errores, visibility system E2E        |
| POS           | ✅ CERTIFICADO        | 10     | 6/6 Playwright: apertura → venta → cobro           |
| Servicios POS | ✅ CERTIFICADO        | 10     | S01-S03: service siempre enabled en POS            |
| Catálogo      | ✅ CERTIFICADO        | 10     | C01-C04: stock + badges + on_request + hidden      |
| Caja          | ✅ CERTIFICADO        | 11     | C01-C05: open/close/TOCTOU/DT-012/DT-013           |
| Reportes      | ✅ CERTIFICADO        | 11     | R01-R05: daily, top products, PDF, mensual, token  |
| Finanzas      | ✅ CERTIFICADO        | 12     | F01-F05: P&L, PE, gastos, CxC, role guard cashier  |
| Catálogo admin | ⏳ PENDIENTE         | 13     | Métricas, QR, toggle masivo                        |
| Analytics     | ❌ NO INICIADO        | —      |                                                    |

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
| `/caja`               | `src/app/(dashboard)/caja/page.tsx`              | JWT      | Certificado ✅ Sprint 11       |
| `/caja/historial`     | `src/app/(dashboard)/caja/historial/page.tsx`    | JWT      |                                |
| `/reportes`           | `src/app/(dashboard)/reportes/page.tsx`          | JWT      | Certificado ✅ Sprint 11       |
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
| Método    | Endpoint                             | Notas                            |
|-----------|--------------------------------------|----------------------------------|
| GET       | `/api/finanzas/cxc`                  | ✅ role guard + certificado F04  |
| GET\|POST | `/api/finanzas/cxp`                  | ✅ role guard cashier→403        |
| PATCH     | `/api/finanzas/cxp/[id]`             | ✅ role guard cashier→403        |
| GET\|POST | `/api/finanzas/gastos`               | ✅ role guard + certificado F03  |
| GET       | `/api/finanzas/resumen`              | ✅ role guard + certificado F01  |
| GET       | `/api/finanzas/punto-equilibrio`     | ✅ PE con proyección — F02       |

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
| Método | Endpoint         | Notas                                   |
|--------|------------------|-----------------------------------------|
| GET    | `/api/rates/bcv` | ✅ DT-013 resuelto Sprint 11 — con auth |

### Reportes
| Método    | Endpoint                               | Notas                                 |
|-----------|----------------------------------------|---------------------------------------|
| GET       | `/api/reports/daily`                   | ✅ certificado R01-R02                |
| GET       | `/api/reports/sales`                   |                                       |
| POST      | `/api/reports/monthly/generate`        | ✅ lazy gen, token 30 días — R04      |
| GET       | `/api/r/[token]`                       | ✅ descarga PDF sin auth — R05        |
| POST      | `/api/reports/monthly/mark-pending`    | ❌ Pendiente Sprint 13 (n8n trigger)  |
| GET       | `/api/reports/monthly/pending`         | ❌ Pendiente Sprint 13 (n8n query)    |
| POST      | `/api/reports/monthly/mark-notified`   | ❌ Pendiente Sprint 13 (n8n callback) |

### Ventas
| Método    | Endpoint                | Notas                                 |
|-----------|-------------------------|---------------------------------------|
| GET\|POST | `/api/sales`            |                                       |
| PATCH     | `/api/sales/[id]/pay`   |                                       |
| PATCH     | `/api/sales/[id]/void`  |                                       |
| POST      | `/api/ventas/[id]/abono`| ✅ DT-011 resuelto Sprint 11          |

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
9bbf473  cert(sprint-12/CLI-C): certificación módulo Finanzas — 5/5 E2E verde
3243cde  feat(sprint-12/CLI-B): rediseño completo /finanzas — P&L + PE + tablas
c665f08  docs+test(sprint-11/CLI-D): suite 23 tests + n8n workflow + SYSTEM_MAP
52188de  fix(security/CLI-C): middleware n8n routes → PUBLIC_EXACT
b069bdb  cert(sprint-11/CLI-C): certificación módulo Reportes — 5/5 E2E verde
42d01f6  feat(sprint-11/CLI-A): backend completo módulo Reportes
39ca5db  feat(sprint-11/CLI-B): UI reportes rediseñada + MonthlyReportBanner + PDF
fac1f29  cert(sprint-11/CLI-C): certificación módulo Caja — DT-011 DT-012 DT-013
2ccc4b9  fix(sprint-11/CLI-A): DT-011 DT-012 DT-013
c4d7f4d  fix+feat(sprint-11/CLI-B): DT-008 DT-009 DT-010 — lib/catalog + badge
6acea5e  docs(sprint-10/cierre): SYSTEM_MAP v10 + HANDOFF Sprint 11
26efc1a  audit(sprint-10/CLI-C): integración visibility system verificada
6e916c2  feat(sprint-10/CLI-B): DT-006+DT-007+BLOQUE-2 — visibilidad catálogo
e46c9ce  fix+feat(sprint-10/CLI-A): BUG-001 + P1 security + product visibility
5a40e8e  fix(sprint-10/CLI-A): DT-001 DT-003 DT-005 — deuda técnica backend
```

---

## 6. DEUDA TÉCNICA

| ID     | Sev | Estado           | Descripción                                             | Sprint   |
|--------|-----|------------------|---------------------------------------------------------|----------|
| DT-001 | P1  | ✅ RESUELTO       | dollarRate sin business_id — datos cross-tenant         | 10       |
| DT-002 | P1  | ✅ CONFIRMADO     | sold_at correcto en todos los paths                     | 10       |
| DT-003 | P1  | ✅ RESUELTO       | SaleAbono sin cash_register_id                          | 10       |
| DT-004 | P2  | ❌ PENDIENTE      | Service Worker / PWA ausente                            | 12       |
| DT-005 | P1  | ✅ RESUELTO       | CashMovement sin business_id — filtro cross-tenant      | 10       |
| DT-006 | P2  | ✅ RESUELTO       | Emojis en UI → Lucide icons en CatalogoGrid             | 10       |
| DT-007 | P2  | ✅ RESUELTO       | 7 tokens RGB faltantes + sweep 9 módulos CSS            | 10       |
| DT-008 | P2  | ✅ RESUELTO       | Dos fuentes de filtro catálogo → lib/catalog.ts         | 11       |
| DT-009 | P2  | ✅ RESUELTO       | computeAvailability alimenta SSR catálogo               | 11       |
| DT-010 | P3  | ✅ RESUELTO       | badge Descontinuado en CatalogoGrid                     | 11       |
| DT-011 | P2  | ✅ RESUELTO       | ventas/[id]/abono — amount_bs calculado server-side     | 11       |
| DT-012 | P2  | ✅ RESUELTO       | cash/close — TOCTOU en $transaction con findFirst       | 11       |
| DT-013 | P2  | ✅ RESUELTO       | rates/bcv protegido con auth + ruta pública /api/r/     | 11       |
| DT-014 | P2  | ❌ PENDIENTE      | lib/bcv.ts cache no cluster-safe (PM2 multi-process)    | 12       |
| DT-015 | P3  | ❌ BACKLOG        | TOCTOU updates sin business_id doble filtro             | Backlog  |
| DT-016 | P3  | ❌ BACKLOG        | upload MIME spoofing — magic bytes sin validar          | Backlog  |
| DT-017 | P3  | ❌ BACKLOG        | clients/[id]/abono raw rate query sin caché             | Backlog  |
| DT-018 | P3  | ❌ BACKLOG        | orders precio $0 posible (sin validación min)           | Backlog  |
| DT-019 | P3  | ❌ BACKLOG        | WhatsApp automático requiere Meta API oficial           | Sprint 13|
| DT-020 | P3  | ❌ PENDIENTE      | Export Excel en reportes                                | 13       |
| DT-021 | P2  | ❌ PENDIENTE      | Export Excel en finanzas                                | 13       |
| DT-022 | P3  | ❌ BACKLOG        | Gastos recurrentes (definir una vez, pagar mensual)     | Backlog  |

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
| rates/bcv con auth                       | ✅ DT-013 resuelto Sprint 11                                | Sprint 11     |
| cash/close TOCTOU                        | ✅ DT-012 resuelto — $transaction + findFirst               | Sprint 11     |
| amount_bs server-side                    | ✅ DT-011 resuelto — amount_bs = usd × rate                 | Sprint 11     |

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

*Generado: 2026-06-19 | HEAD: 9bbf473 | Sprint 12 cierre | CLI-D modo EJECUCIÓN*
