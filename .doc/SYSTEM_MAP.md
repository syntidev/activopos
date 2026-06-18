# SYSTEM_MAP — ActivoPOS
# Generado desde código real — 2026-06-18
# Fuente: find, grep, prisma/schema.prisma, git log
# NO editar a mano — regenerar con el prompt CLI-C

---

## 1. RUTAS DE PÁGINA

| Ruta URL              | Archivo                                          | Auth     | Notas                         |
|-----------------------|--------------------------------------------------|----------|-------------------------------|
| `/`                   | `src/app/page.tsx`                               | pública  | Redirige al dashboard o login |
| `/login`              | `src/app/(auth)/login/page.tsx`                  | pública  |                               |
| `/escritorio`         | `src/app/(dashboard)/escritorio/page.tsx`        | JWT      | Dashboard principal           |
| `/pos`                | `src/app/(dashboard)/pos/page.tsx`               | JWT      | Punto de venta                |
| `/pedidos`            | `src/app/(dashboard)/pedidos/page.tsx`           | JWT      | Órdenes del catálogo          |
| `/cotizaciones`       | `src/app/(dashboard)/cotizaciones/page.tsx`      | JWT      |                               |
| `/clientes`           | `src/app/(dashboard)/clientes/page.tsx`          | JWT      |                               |
| `/productos`          | `src/app/(dashboard)/productos/page.tsx`         | JWT      | Inventario + catálogo unificado|
| `/caja`               | `src/app/(dashboard)/caja/page.tsx`              | JWT      |                               |
| `/caja/historial`     | `src/app/(dashboard)/caja/historial/page.tsx`    | JWT      |                               |
| `/reportes`           | `src/app/(dashboard)/reportes/page.tsx`          | JWT      |                               |
| `/finanzas`           | `src/app/(dashboard)/finanzas/page.tsx`          | JWT      | CxC, CxP, Gastos, Resumen     |
| `/configuracion`      | `src/app/(dashboard)/configuracion/page.tsx`     | JWT      |                               |
| `/devoluciones`       | `src/app/(dashboard)/devoluciones/page.tsx`      | JWT      |                               |
| `/tu-dia`             | `src/app/(dashboard)/tu-dia/page.tsx`            | JWT      |                               |
| `/usuarios`           | `src/app/(dashboard)/usuarios/page.tsx`          | JWT      |                               |
| `/ayuda`              | `src/app/(dashboard)/ayuda/page.tsx`             | JWT      |                               |
| `/onboarding`         | `src/app/(dashboard)/onboarding/page.tsx`        | JWT      |                               |
| `/catalogo/[slug]`    | `src/app/catalogo/[slug]/page.tsx`               | pública  | Server Component + CatalogoGrid|

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
| POST     | `/api/cash/close`        | Cierre de turno                    |
| GET      | `/api/cash/status`       | Stats del turno activo             |
| GET\|POST| `/api/cash/movement`     | Entradas/salidas de efectivo       |
| GET      | `/api/cash/history`      | Historial de registros             |

### Catálogo (público, sin JWT)
| Método | Endpoint                       | Notas                                  |
|--------|--------------------------------|----------------------------------------|
| GET    | `/api/catalog/[slug]`          | Productos del catálogo público         |
| POST   | `/api/catalog/[slug]/order`    | Crear pedido — precios siempre del DB  |

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
| Método | Endpoint                    |
|--------|-----------------------------|
| GET    | `/api/dashboard/kpis`       |
| GET    | `/api/dashboard/charts`     |

### Finanzas
| Método    | Endpoint                    |
|-----------|-----------------------------|
| GET       | `/api/finanzas/cxc`         |
| GET\|POST | `/api/finanzas/cxp`         |
| PATCH     | `/api/finanzas/cxp/[id]`    |
| GET\|POST | `/api/finanzas/gastos`      |
| GET       | `/api/finanzas/resumen`     |

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
| Método           | Endpoint                                    |
|------------------|---------------------------------------------|
| GET\|POST        | `/api/products`                             |
| GET\|PATCH\|DELETE| `/api/products/[id]`                       |
| GET\|POST        | `/api/products/[id]/variants`               |
| PATCH\|DELETE    | `/api/products/[id]/variants/[variantId]`   |
| GET              | `/api/products/recent`                      |
| GET              | `/api/products/search`                      |
| POST             | `/api/products/import`                      |
| —                | `/api/products/categories`                  |

### Tasas
| Método | Endpoint         | Notas                     |
|--------|------------------|---------------------------|
| GET    | `/api/rates/bcv` | ve.dolarapi.com — fallback DB|

### Reportes
| Método | Endpoint              |
|--------|-----------------------|
| GET    | `/api/reports/daily`  |
| GET    | `/api/reports/sales`  |

### Ventas
| Método    | Endpoint               |
|-----------|------------------------|
| GET\|POST | `/api/sales`           |
| PATCH     | `/api/sales/[id]/pay`  |
| PATCH     | `/api/sales/[id]/void` |
| POST      | `/api/ventas/[id]/abono`|

### Usuarios
| Método        | Endpoint          |
|---------------|-------------------|
| GET\|POST     | `/api/users`      |
| PATCH\|DELETE | `/api/users/[id]` |

### Misc
| Método        | Endpoint                   |
|---------------|----------------------------|
| POST          | `/api/upload/image`        |
| PATCH\|DELETE | `/api/onboarding/complete` |

---

## 3. MODELOS PRISMA

**19 modelos** · **19 tablas** · **229 campos** en total

| Modelo          | Tabla                | Descripción                          |
|-----------------|----------------------|--------------------------------------|
| Business        | businesses           | Tenant principal                     |
| User            | users                | Usuarios del sistema (roles)         |
| Category        | categories           | Categorías de productos              |
| Product         | products             | Productos con badge/subcategory/featured |
| ProductVariant  | product_variants     | Variantes (talla, color, etc.)       |
| InventoryEntry  | inventory_entries    | Entradas de inventario               |
| Client          | clients              | Clientes del negocio                 |
| PaymentMethod   | payment_methods      | Métodos de pago configurables        |
| Sale            | sales                | Ventas (quote/pending/paid/cancelled)|
| SaleItem        | sale_items           | Líneas de cada venta                 |
| SalePayment     | sale_payments        | Pagos de una venta                   |
| SaleAbono       | sale_abonos          | Abonos a ventas a crédito            |
| CashRegister    | cash_registers       | Turnos de caja                       |
| CashMovement    | cash_movements       | Movimientos de efectivo              |
| DollarRate      | dollar_rates         | Tasas BCV históricas                 |
| ActivityLog     | activity_logs        | Auditoría de acciones críticas       |
| Gasto           | gastos               | Gastos / CxP del negocio             |
| Order           | orders               | Pedidos del catálogo público         |
| OrderItem       | order_items          | Líneas de cada pedido                |

### Enums

| Enum        | Valores                                                   |
|-------------|-----------------------------------------------------------|
| Role        | super_admin, admin, cashier                               |
| SaleMode    | unit, weight, service, length, volume, package            |
| SaleStatus  | quote, pending, paid, cancelled                           |
| SaleOrigin  | pos, quote, credit                                        |
| OrderStatus | received, preparing, ready, dispatched, delivered, cancelled|
| OrderOrigin | whatsapp, catalog, phone, pos                             |
| MoveType    | in, out                                                   |
| PmType      | cash, transfer, zelle, binance, card, other               |

### Campos clave de Product (sprint-8 añadidos)
```
badge        String?  @default("none")   // none|popular|nuevo|promo|recomendado
subcategory  String?
is_featured  Boolean  @default(false)
```

---

## 4. MIGRACIONES APLICADAS

| # | Nombre                                          | Fecha       |
|---|-------------------------------------------------|-------------|
| 1 | 20260616023908_init                             | 2026-06-16  |
| 2 | 20260616120000_add_gastos                       | 2026-06-16  |
| 3 | 20260616140000_add_variants_iva                 | 2026-06-16  |
| 4 | 20260616183852_add_orders_delivery              | 2026-06-16  |
| 5 | 20260617031955_add_catalog_fields               | 2026-06-17  |
| 6 | 20260617072511_add_business_segment_cobro_data  | 2026-06-17  |
| 7 | 20260617223638_add_product_badge_subcategory_featured | 2026-06-17 |

---

## 5. ÚLTIMOS 15 COMMITS

```
1000f40  fix: tema del cliente solo aplica dentro del dashboard
31dacc2  fix: categorías sincronizadas entre productos y catálogo
aea130d  feat(sprint-9/CLI-B): auditoría estética completa
4b25744  feat(sprint-9/CLI-D): hero banner catálogo
4dfea1b  feat(sprint-9/CLI-A): dual moneda en todos los endpoints
44afa1d  revert: sistema temas simplificado a solo dark/light
af184f2  fix(sprint-9/CLI-C): RACE-001 y RACE-002 caja
39c721c  feat(sprint-8/CLI-D): badges + subcategorías + destacados en UI
1e3af11  fix(sprint-8/CLI-B): logo texto + bordes KpiCard dinámicos
8205402  feat(sprint-8/CLI-A): badge + subcategoría + destacado en productos
9ea7288  feat(sprint-8/CLI-A): 10 temas con nombres aprobados
811f9f6  feat(sprint-8/CLI-A): sistema 4 temas globales desde DB
55c76a0  feat(sprint-8/CLI-D): carrito + checkout + buscador en catálogo
bfc9e35  fix(sprint-8/CLI-A): P0 security — precios desde DB, no del cliente
367d5a0  feat(sprint-8/CLI-A): POST /api/catalog/[slug]/order
```

---

## 6. INVARIANTES DE SEGURIDAD

| Invariante                               | Implementación                                        |
|------------------------------------------|-------------------------------------------------------|
| `business_id` siempre de `getSession()`  | `src/lib/auth.ts` — nunca del body                    |
| Precios en catálogo solo del DB          | `catalog/[slug]/order/route.ts` — ItemSchema sin price|
| Apertura de caja atómica                 | `cash/open/route.ts` — findFirst dentro de $transaction|
| Abonos acotados al turno activo          | `cash/status/route.ts` — created_at >= opened_at      |
| Rate limiting en endpoints públicos      | `src/lib/rate-limit.ts` — catalogLimiter, loginLimiter|
| JWT fail-closed                          | `src/lib/auth.ts` — algorithms: ['HS256'], sin fallback|
| Slug validado con regex                  | `/^[a-z0-9-]{3,50}$/` antes de cualquier query        |
| Stock descuenta solo en paid             | Lógica en `sales/route.ts` — status check explícito   |

---

## 7. ESTRUCTURA DE ARCHIVOS CLAVE

```
src/
├── app/
│   ├── (auth)/login/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx                    ← AppLayout, sidebar, header
│   │   ├── escritorio/page.tsx
│   │   ├── pos/page.tsx
│   │   ├── pedidos/page.tsx
│   │   ├── clientes/page.tsx
│   │   ├── productos/page.tsx
│   │   ├── caja/page.tsx + historial/
│   │   ├── reportes/page.tsx
│   │   ├── finanzas/page.tsx
│   │   ├── configuracion/page.tsx
│   │   ├── devoluciones/page.tsx
│   │   ├── tu-dia/page.tsx
│   │   ├── usuarios/page.tsx
│   │   └── onboarding/page.tsx
│   ├── catalogo/[slug]/
│   │   ├── page.tsx                      ← Server Component
│   │   ├── CatalogoGrid.tsx              ← Client Component
│   │   └── catalogo.module.css
│   └── api/                              ← 57 route handlers
├── components/
│   ├── ui/                               ← Button, Input, Badge, Modal, Toast, KpiCard
│   └── layout/                           ← Sidebar, Header, AppLayout
├── lib/
│   ├── prisma.ts                         ← Singleton con PrismaMariaDb adapter
│   ├── auth.ts                           ← JWT HS256 fail-closed
│   ├── bcv.ts                            ← BCV rate service + 1h cache + fallback
│   └── rate-limit.ts                     ← IP rate limiting
├── styles/
│   ├── tokens.css                        ← Design tokens + 10 temas por segmento
│   └── globals.css
└── types/
```

---

*Generado: 2026-06-18 | HEAD: 1000f40 | CLI-C modo REVISIÓN*
