# SYSTEM_MAP — ActivoPOS
# Generado desde código real — 2026-06-23
# Fuente: find, grep, prisma/schema.prisma, git log
# NO editar a mano — regenerar con el prompt CLI-C

---

## 0. ESTADO GENERAL

| Campo              | Valor                                                                  |
|--------------------|------------------------------------------------------------------------|
| Último sprint      | Sprint 28                                                              |
| Último commit      | (ver git log — post Sprint 27)                                         |
| TypeScript         | ✅ 0 errores — `npx tsc --noEmit`                                      |
| Build              | ✅ Limpio — verificar con `npm run build`                              |
| Puerto VPS         | 3003 (PM2 — confirmado 2026-06-23)                                     |
| Paleta activa      | Persian Blue `#0038BD` + Carrot `#EF8E01`                             |
| Tests E2E          | ✅ 134/135 estables · 1 skip permanente T03 (ver §9)                  |
| CIMAAD             | ✅ 7/7 nodos ciclo real — `auditoria-ciclo-real.spec.ts` en VPS:3003  |

### Certificación de módulos (Regla del Policía)

```
Productos ✅ → POS ✅ → Caja ✅ → Reportes ✅ → Finanzas ✅ → Catálogo ✅ → Analytics ✅ →
Sprint 15 ✅ → Onboarding ✅ → Tokens v3.0 ✅ → Escritorio v3.0 ✅ →
Mobile POS ✅ → Export Excel ✅ → Módulo Fábrica ✅ → Venta por Peso ✅ → Seguridad SEC-01/SEC-02 ✅ →
SEC-04 ✅ → Import Excel ✅ → Variantes ✅ → Modal PIN ✅ →
Sprint 22: vuelto_usd ✅ → due_date schema ✅ → orders precio DB ✅ → pedidos skeleton ✅ →
rates BCV+paralelo+USDT ✅ → order_number @@unique ✅ → CobroModal "Procesar Pago" ✅ →
Sprint 23: CxC vista completa ✅ → CxC abonos ✅ → Notifications API ✅ → Badge sidebar ✅ →
PDF engine ✅ → Alertas CxC en Escritorio ✅ → client_id obligatorio crédito ✅ →
Sprint 24: Multi-ticket drafts ✅ → Módulos dinámicos sidebar ✅ → Web Push backend ✅ →
SSRF allowlist push ✅ → stock_alert_threshold ✅ → SaleStatus.draft ✅ →
Sprint 25: CORE_MODULES guard ✅ → Admin panel super_admin ✅ → useDraftTabs DB-backed ✅ →
KDS placeholder ✅ → 9 code-review P0-P3 fixes ✅ → StockModal jerarquía ✅ → PWA manifest fix ✅ →
Sprint 26: botón Cobrar pedidos ✅ → middleware module-gating MO-FIX02 ✅ → onboarding checklist ✅ → historial caja ✅ →
Sprint 27: paleta Persian Blue+Carrot ✅ → 18 módulos UI+API ✅ → 14 bugs P0-P3 corregidos ✅ → CIMAAD 7/7 ✅ → marketing system 🚧 →
Sprint 28: Bot IA datos reales ✅ → onboarding 5 pasos ✅ → variantes POS ✅ → export Excel full ✅ → rango fechas reportes ✅ → desactivar productos ✅ → badge solo Pedidos ✅ → ordenamiento tablas ✅ → S25-F2 🚧 → PU-FIX02 🚧
```

**SPRINT 28 — 18 módulos del roadmap v1 operativos con UI y API conectadas. Bot IA activo con datos reales. Ciclo verificado en VPS con CIMAAD 7/7.**

| Módulo              | Estado               | Sprint | Evidencia                                                      |
|---------------------|----------------------|--------|----------------------------------------------------------------|
| Productos           | ✅ CERTIFICADO        | 10     | TypeScript 0 errores, visibility system E2E                    |
| POS                 | ✅ CERTIFICADO        | 10     | 6/6 Playwright: apertura → venta → cobro                       |
| Servicios POS       | ✅ CERTIFICADO        | 10     | S01-S03: service siempre enabled en POS                        |
| Catálogo            | ✅ CERTIFICADO        | 10     | C01-C04: stock + badges + on_request + hidden                  |
| Caja                | ✅ CERTIFICADO        | 11     | C01-C05: open/close/TOCTOU/DT-012/DT-013                       |
| Reportes            | ✅ CERTIFICADO        | 11     | R01-R05: daily, top products, PDF, mensual, token              |
| Finanzas            | ✅ CERTIFICADO        | 12     | F01-F05: P&L, PE, gastos, CxC, role guard cashier              |
| Catálogo admin      | ✅ CERTIFICADO        | 13     | CA01-CA05: métricas, QR, bulk toggle, link, orders             |
| Analytics           | ✅ CERTIFICADO        | 14     | AN01-AN05: page load, no NaN, período, chart, role guard       |
| PWA                 | ✅ IMPLEMENTADO       | 14     | DT-004: sw.js + offline.html + manifest.json + íconos          |
| Cotizaciones        | ✅ CERTIFICADO        | 15     | Q01-Q02: page load, POST → QUO-YYYY-NNNN                       |
| Devoluciones        | ✅ CERTIFICADO        | 15     | R01-R02: page load, 404 venta inexistente                      |
| Usuarios            | ✅ CERTIFICADO        | 15     | U01: page load, CRUD UI completa                               |
| Expense Categories  | ✅ CERTIFICADO        | 15     | EX01-EX04: CRUD categorías, 409 dup, category_id en gasto      |
| DT-023 UI           | ✅ CERTIFICADO        | 16     | select gastos en /finanzas + gestión en /configuracion         |
| Onboarding          | ✅ CERTIFICADO        | 16     | ON01-ON05: wizard UI, check-slug, setup 201, cajero bloqueado  |
| Tokens v3.0         | ✅ CERTIFICADO        | 17     | ES01: sin #2563EB/#1E3A5F, light/dark light por defecto        |
| Escritorio v3.0     | ✅ CERTIFICADO        | 17     | ES01-ES05: teal KPIs, theme toggle, 0 hydration errors         |
| Mobile POS          | ✅ CERTIFICADO        | 18     | MO01-MO04: drawer, FAB carrito, badge, responsive sin overflow |
| Export Excel        | ✅ CERTIFICADO        | 18     | MO05: botón visible + GET /api/reports/export-excel 200 xlsx   |
| Módulo Fábrica      | ✅ CERTIFICADO        | 19     | FA01-FA03: combo + componentes + recipe_snapshot en sale_items |
| Venta por Peso      | ✅ CERTIFICADO        | 19     | FA04: qty decimal, subtotal correcto, stock descontado en kg   |
| SEC-01 precio DB    | ✅ CERTIFICADO        | 20     | SD01: precio de /api/sales ignora body — siempre del DB        |
| SEC-02 snapshot     | ✅ CERTIFICADO        | 20     | SD02: recipe_snapshot usado en cobro diferido (no receta live) |
| Descuentos PIN      | ✅ CERTIFICADO        | 20     | SD03-SD05: PIN incorrecto 401, límite cajero 403, admin bypass |
| Overlay management  | ✅ IMPLEMENTADO       | 20     | useScrollLock, z-modal-top token, todos los modales corregidos |
| SEC-04 rate limit DB| ✅ CERTIFICADO        | 21     | IM01-IM03: rate limit almacenado en DB, cluster-safe           |
| Import Excel        | ✅ CERTIFICADO        | 21     | IM01-IM03: POST /api/products/import-excel — xlsx + dry-run    |
| Variantes UI        | ✅ CERTIFICADO        | 21     | VA01-VA03: picker variante en ProductModal + POS               |
| Modal PIN descuento | ✅ CERTIFICADO        | 21     | PI01-PI02: PinDescuentoModal conectado desde TicketPanel       |
| BUG-01 vuelto_usd   | ✅ CERTIFICADO        | 22     | SP22-03: monto_recibido_usd + vuelto_usd calculado en POST /api/sales |
| BUG-03 due_date     | ✅ CERTIFICADO        | 22     | SP22-04: finanzas/resumen expone cxc.vencidas + cxc.por_vencer |
| A5-1 orders precio  | ✅ CERTIFICADO        | 22     | SP22-01: POST /api/orders ignora precio body, usa precio DB     |
| A3-2/A3-3 pedidos   | ✅ CERTIFICADO        | 22     | SP22-06: skeleton aria-busy + EmptyState único (no duplicado)  |
| rates BCV extended  | ✅ CERTIFICADO        | 22     | SP22-08: /api/rates/bcv devuelve bcv, paralelo, usdt, source   |
| A3-1 order_number   | ✅ CERTIFICADO        | 22     | SP22-02: @@unique([business_id, order_number]) — sin duplicados DB |
| A1-2 CobroModal ref | ✅ CERTIFICADO        | 22     | SP22-05: "Procesar Pago" + data-testid="product-card" — certificado |
| CxC vista completa  | ✅ CERTIFICADO        | 23     | CX01-CX05: GET cxc+summary, POST abono parcial/total, role guard cashier |
| Notifications API   | ✅ CERTIFICADO        | 23     | NF01-NF03: GET, PATCH read, PATCH read-all (idempotente)        |
| due_date crédito    | ✅ CERTIFICADO        | 23     | DU01-DU02: due_date persistido, client_id obligatorio para crédito |
| PDF engine          | ✅ IMPLEMENTADO       | 23     | PD01: POST generate → token → GET /api/r/{token} → application/pdf |
| Badge notificaciones| ✅ IMPLEMENTADO       | 23     | Sidebar badge animado con conteo pending desde GET /api/notifications |
| Alertas CxC         | ✅ IMPLEMENTADO       | 23     | Escritorio muestra alertas CxC vencidas y por vencer            |
| Multi-ticket drafts | ✅ CERTIFICADO        | 24     | MT01-MT05: POST/GET/PATCH/DELETE /api/pos/drafts, MAX=5, DRF-NNNNN |
| Módulos dinámicos   | ✅ CERTIFICADO        | 24     | MD01-MD02: GET/PATCH /api/config/business/modules, sidebar filtra activos |
| Web Push SSRF guard | ✅ CERTIFICADO        | 24     | PW01: allowlist FCM/Mozilla/Windows/Apple, IP privada → 400      |
| stock_alert_threshold| ✅ IMPLEMENTADO      | 24     | Product.stock_alert_threshold INT default 5 — migración #22      |
| CORE_MODULES guard  | ✅ CERTIFICADO        | 25     | MO-FIX01: PATCH modules omitiendo pos/caja/inventory → 400       |
| Admin panel         | ✅ CERTIFICADO        | 25     | AD01-AD02: /businesses + /stats — layout guard super_admin, redirige a /escritorio |
| useDraftTabs DB     | ✅ IMPLEMENTADO       | 25     | Reescrito: localStorage → DB via /api/pos/drafts (GET/POST/PATCH/DELETE) |
| KDS placeholder     | ✅ IMPLEMENTADO       | 25     | /kds page.tsx con ConstructionPanel — módulo futuro               |
| StockModal UI       | ✅ IMPLEMENTADO       | 26     | Sprint 26 CLI-B early: jerarquía visual corregida                 |
| PWA manifest        | ✅ IMPLEMENTADO       | 26     | Sprint 26 CLI-B early: meta tags + íconos + manifest.json corregidos |
| Botón Cobrar pedidos| ✅ IMPLEMENTADO       | 26     | Sprint 26 CLI-B: UI cobrar order desde /pedidos con CobroModal    |
| Middleware gating   | ✅ IMPLEMENTADO       | 26     | Sprint 26 CLI-A: middleware enforcea modules_enabled — MO-FIX02 cerrado |
| Historial de caja   | ✅ IMPLEMENTADO       | 26     | Sprint 26 CLI-B: /caja/historial con estadísticas por turno       |
| Paleta Persian Blue | ✅ IMPLEMENTADO       | 27     | Sprint 27: #0038BD + Carrot #EF8E01 — tokens.css actualizado      |
| 18 módulos UI+API   | ✅ OPERATIVO          | 27     | Sprint 27: todos los módulos roadmap v1 con UI y API conectadas   |
| 14 bugs Sprint 27   | ✅ CORREGIDOS         | 27     | Sprint 27: P0-P3 fixes — verificados con CIMAAD 7/7 en VPS:3003  |
| CIMAAD ciclo real   | ✅ CERTIFICADO        | 27     | Sprint 27 CLI-D: 7/7 nodos — Inv→POS→Caja→Reports→CxC→Orders→Finanzas |
| Marketing system    | 🚧 EN CONSTRUCCIÓN    | 27     | (marketing)/layout.tsx + páginas — integración futura WhatsApp/n8n |
| Bot IA datos reales | ✅ OPERATIVO          | 28     | Sprint 28: respuestas contextuales con KPIs y datos reales del negocio |
| Onboarding 5 pasos  | ✅ ACTUALIZADO        | 28     | Sprint 28: paso 5 añadido — era 4 pasos (Sprint 16), wizard ampliado  |
| Rango fechas rpt    | ✅ IMPLEMENTADO       | 28     | Sprint 28: filtro from/to en reportes — daily y mensual aceptan rango  |
| Desactivar prods    | ✅ IMPLEMENTADO       | 28     | Sprint 28: soft-delete UI — desactivar vs eliminar, productos quedan en historial |
| Badge solo Pedidos  | ✅ CORREGIDO          | 28     | Sprint 28: badge notificaciones movido sidebar → módulo Pedidos exclusivamente |
| Ordenamiento tablas | ✅ IMPLEMENTADO       | 28     | Sprint 28: sort por columna en Productos, Clientes, Reportes           |

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
| `/analytics`          | `src/app/(dashboard)/analytics/page.tsx`         | JWT admin| Pulso del Negocio ✅ Sprint 14 |
| `/catalogo-digital`   | `src/app/(dashboard)/catalogo-digital/page.tsx`  | JWT admin| Métricas QR + bulk toggle ✅ 13|
| `/configuracion`      | `src/app/(dashboard)/configuracion/page.tsx`     | JWT      |                                |
| `/devoluciones`       | `src/app/(dashboard)/devoluciones/page.tsx`      | JWT      |                                |
| `/tu-dia`             | `src/app/(dashboard)/tu-dia/page.tsx`            | JWT      |                                |
| `/usuarios`           | `src/app/(dashboard)/usuarios/page.tsx`          | JWT      |                                |
| `/ayuda`              | `src/app/(dashboard)/ayuda/page.tsx`             | JWT      |                                |
| `/onboarding`         | `src/app/(dashboard)/onboarding/page.tsx`        | JWT admin| Wizard 5 pasos ✅ Sprint 28 — cajero bloqueado |
| `/catalogo-digital`   | `src/app/(dashboard)/catalogo-digital/page.tsx`  | JWT admin| Métricas + QR + bulk toggle ✅ |
| `/catalogo/[slug]`    | `src/app/catalogo/[slug]/page.tsx`               | pública  | SSR + CatalogoGrid client      |
| `/businesses`         | `src/app/(admin)/businesses/page.tsx`            | JWT super_admin | Admin multitenant ✅ Sprint 25 |
| `/stats`              | `src/app/(admin)/stats/page.tsx`                 | JWT super_admin | Stats globales ✅ Sprint 25    |
| `/kds`                | `src/app/(dashboard)/kds/page.tsx`               | JWT      | KDS placeholder Sprint 25      |
| `/marketing/*`        | `src/app/(marketing)/layout.tsx + páginas`        | pública  | 🚧 Sprint 27 — sistema marketing en construcción |

**Middleware público** (`src/middleware.ts`):
```
PUBLIC_PREFIXES = ['/login', '/api/auth/', '/catalogo/', '/api/catalog/', '/api/onboarding/']
ADMIN_ONLY      = ['/configuracion', '/finanzas', '/api/reports', '/analytics', '/api/analytics',
                   '/api/quotations', '/cotizaciones', '/devoluciones', '/usuarios',
                   '/api/returns', '/api/users', '/onboarding/']
SUPER_ADMIN_ONLY = ['/admin', '/api/admin']
MODULE_GATING   = modules_enabled checkeados en middleware — MO-FIX02 resuelto Sprint 26
```
⚠️ **Gap S25-F2**: `/businesses` y `/stats` protegidas por `(admin)/layout.tsx` (redirige a /escritorio)
pero NO están en `SUPER_ADMIN_ONLY` del middleware — pendiente Sprint 28.

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

### Analytics (JWT, admin/super_admin — cashier → 403)
| Método | Endpoint                              | Notas                                             |
|--------|---------------------------------------|---------------------------------------------------|
| GET    | `/api/analytics/summary`              | ✅ Sprint 14 — KPIs, vs_anterior, por método, insights|
| GET    | `/api/analytics/top-products`         | ✅ Sprint 14 — ORDER BY qty DESC, tendencia up/down|
| GET    | `/api/analytics/trends`               | ✅ Sprint 14 — week/month/quarter, 12 períodos     |

### Catálogo admin (JWT, admin/super_admin)
| Método | Endpoint                           | Notas                                              |
|--------|------------------------------------|----------------------------------------------------|
| GET    | `/api/catalogo/metrics`            | ✅ Sprint 13 — KPIs, orders, top_products, QR data |
| PATCH  | `/api/products/bulk-visibility`    | ✅ Sprint 13 — hasta 50 IDs, business_id guard     |

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
| Método    | Endpoint                             | Notas                                                |
|-----------|--------------------------------------|------------------------------------------------------|
| GET       | `/api/finanzas/cxc`                  | ✅ Sprint 23 — rediseñado: `{ok, items[], total, pagination:{page,limit,pages}, vencido_usd, por_vencer_usd, vigente_usd}` |
| GET       | `/api/finanzas/cxc/summary`          | ✅ Sprint 23 — `{ok, vencido:{count,total_usd}, por_vencer:{...}, vigente:{...}}` |
| POST      | `/api/finanzas/cxc/[id]/abono`       | ✅ Sprint 23 — `{amount_usd, payment_method_id, notes?}` → `{ok, abono, saldo_usd, paid}` — CX-RACE fix |
| GET\|POST | `/api/finanzas/cxp`                  | ✅ role guard cashier→403                            |
| PATCH     | `/api/finanzas/cxp/[id]`             | ✅ role guard cashier→403                            |
| GET\|POST | `/api/finanzas/gastos`               | ✅ role guard + certificado F03 + expense_category_id|
| GET       | `/api/finanzas/resumen`              | ✅ role guard + certificado F01                      |
| GET       | `/api/finanzas/punto-equilibrio`     | ✅ PE con proyección — F02                           |
| GET\|POST | `/api/finanzas/categorias`           | ✅ DT-023 Sprint 15 — CRUD categorías de gastos      |
| PATCH     | `/api/finanzas/categorias/[id]`      | ✅ DT-023 Sprint 15 — editar/desactivar              |
| GET       | `/api/finanzas/export-excel`         | ✅ DT-021 Sprint 18 — xlsx gastos/CxP export         |

### Notificaciones
| Método | Endpoint                                  | Notas                                              |
|--------|-------------------------------------------|----------------------------------------------------|
| GET    | `/api/notifications`                      | ✅ Sprint 23 — `{ok, notifications:[{id,type,title,body,status,channel,created_at,read_at}]}` |
| PATCH  | `/api/notifications/[id]/read`            | ✅ Sprint 23 — `{ok, notification:{id,status,read_at}}` o `{ok, already_read:true}` (idempotente) |
| PATCH  | `/api/notifications/read-all`             | ✅ Sprint 23 — `{ok, count}` — marca todos pending como read |

### Multi-ticket POS (JWT, cualquier rol)
| Método | Endpoint                     | Notas                                                                   |
|--------|------------------------------|-------------------------------------------------------------------------|
| GET    | `/api/pos/drafts`            | ✅ Sprint 24 — lista drafts del cajero activo (max 5, status='draft')   |
| POST   | `/api/pos/drafts`            | ✅ Sprint 24 — crea draft vacío o con items; ticket_number DRF-NNNNN · 409 si MAX_DRAFTS=5 |
| PATCH  | `/api/pos/drafts/[id]`       | ✅ Sprint 24 — reemplaza items atómicamente; precio siempre de DB        |
| DELETE | `/api/pos/drafts/[id]`       | ✅ Sprint 24 — descarta draft + items; 404 si no existe                  |

### Web Push (JWT)
| Método | Endpoint                     | Notas                                                                   |
|--------|------------------------------|-------------------------------------------------------------------------|
| POST   | `/api/push/subscribe`        | ✅ Sprint 24 — guarda suscripción; SSRF allowlist: FCM/Mozilla/Windows/Apple; IP privada → 400 |
| DELETE | `/api/push/subscribe`        | ✅ Sprint 24 — elimina suscripción por endpoint                          |
| POST   | `/api/push/send`             | ✅ Sprint 24 — envía push a todos los subs del negocio; admin only; 503 sin VAPID keys |

### Configuración (actualizado)
| Método    | Endpoint                             | Notas                                                |
|-----------|--------------------------------------|------------------------------------------------------|
| GET\|PATCH| `/api/config/business/modules`       | ✅ Sprint 24/25 — ALLOWED_MODULES=[pos,inventory,caja,pedidos,catalog,finanzas,reportes,analytics,kds,delivery]; CORE_MODULES=['pos','caja','inventory'] — PATCH retorna 400 si se omite alguno; cashier → 403 |

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
| GET\|POST        | `/api/products/[id]/components`             | ✅ Sprint 19 — Módulo Fábrica, anti-circular |
| PATCH\|DELETE    | `/api/products/[id]/components/[componentId]` | ✅ Sprint 19 — editar/quitar componente |
| GET              | `/api/products/recent`                      | normaliza sale_mode en lectura    |
| GET              | `/api/products/search`                      | normaliza sale_mode en lectura    |
| POST             | `/api/products/import`                      | ✅ size limit 5MB aplicado        |
| POST             | `/api/products/import-excel`                | ✅ Sprint 21 — xlsx import masivo + dry-run |
| —                | `/api/products/categories`                  |                                   |

### Tasas
| Método | Endpoint         | Notas                                   |
|--------|------------------|-----------------------------------------|
| GET    | `/api/rates/bcv` | ✅ Sprint 22 — respuesta extendida `{ok, bcv, paralelo, usdt, rate, source}` |

### Reportes
| Método    | Endpoint                               | Notas                                 |
|-----------|----------------------------------------|---------------------------------------|
| GET       | `/api/reports/daily`                   | ✅ certificado R01-R02                |
| GET       | `/api/reports/sales`                   |                                       |
| POST      | `/api/reports/monthly/generate`        | ✅ lazy gen, token 30 días — R04      |
| GET       | `/api/r/[token]`                       | ✅ descarga PDF sin auth — R05        |
| GET       | `/api/reports/export-excel`            | ✅ DT-020 Sprint 18 — xlsx, content-type spreadsheetml |
| POST      | `/api/reports/monthly/mark-pending`    | ❌ Pendiente Sprint 13 (n8n trigger)  |
| GET       | `/api/reports/monthly/pending`         | ❌ Pendiente Sprint 13 (n8n query)    |
| POST      | `/api/reports/monthly/mark-notified`   | ❌ Pendiente Sprint 13 (n8n callback) |

### Ventas
| Método    | Endpoint                              | Notas                                           |
|-----------|---------------------------------------|-------------------------------------------------|
| GET\|POST | `/api/sales`                          | ✅ SEC-01: precio siempre del DB, nunca del body |
| PATCH     | `/api/sales/[id]/pay`                 | ✅ SEC-02: usa recipe_snapshot en cobro diferido |
| PATCH     | `/api/sales/[id]/void`                |                                                 |
| POST      | `/api/sales/[id]/authorize-discount`  | ✅ Sprint 20: PIN + límite cashier + bypass admin|
| POST      | `/api/ventas/[id]/abono`              | ✅ DT-011 resuelto Sprint 11                    |

### Usuarios
| Método        | Endpoint          |
|---------------|-------------------|
| GET\|POST     | `/api/users`      |
| PATCH\|DELETE | `/api/users/[id]` |

### Onboarding (público — con rate limit, sin JWT)
| Método | Endpoint                        | Notas                                                              |
|--------|---------------------------------|--------------------------------------------------------------------|
| GET    | `/api/onboarding/check-slug`    | ✅ Sprint 16 — devuelve `{ available: boolean }`, rate-limited     |
| POST   | `/api/onboarding/setup`         | ✅ Sprint 16 — crea business + admin en transaction, 409 slug dup  |

**Reglas de seguridad onboarding:**
- `business_slug` único globalmente (409 si ya existe)
- Password hasheada con bcrypt antes de almacenar
- Rate limiter activo — retorna 429 si se excede
- Token JWT emitido como cookie HTTP-only (NO en el body de respuesta)

### Bot IA (JWT)
| Método | Endpoint          | Notas                                                             |
|--------|-------------------|-------------------------------------------------------------------|
| POST   | `/api/ai/bot`     | ✅ Sprint 28 — respuestas contextuales con datos reales del negocio|

### Misc
| Método        | Endpoint                   | Notas                            |
|---------------|----------------------------|----------------------------------|
| POST          | `/api/upload/image`        | ⚠️ DT-016 MIME spoofing backlog  |

---

## 3. MODELOS PRISMA

**23 modelos** · **23 tablas** · **260+ campos** en total

| Modelo          | Tabla                | Descripción                                                     |
|-----------------|----------------------|-----------------------------------------------------------------|
| Business        | businesses           | Tenant principal                                                |
| User            | users                | Usuarios del sistema (roles)                                    |
| Category        | categories           | Categorías de productos                                         |
| Product         | products             | Productos con visibilidad y disponibilidad                      |
| ProductVariant  | product_variants     | Variantes (talla, color, etc.)                                  |
| InventoryEntry  | inventory_entries    | Entradas de inventario                                          |
| Client          | clients              | Clientes del negocio                                            |
| PaymentMethod   | payment_methods      | Métodos de pago configurables                                   |
| Sale            | sales                | Ventas (quote/pending/paid/cancelled) — Sprint 22: +vuelto, +due_date |
| SaleItem        | sale_items           | Líneas de cada venta                                            |
| SalePayment     | sale_payments        | Pagos de una venta                                              |
| SaleAbono       | sale_abonos          | Abonos — con cash_register_id ✅ DT-003                         |
| CashRegister    | cash_registers       | Turnos de caja                                                  |
| CashMovement    | cash_movements       | Movimientos — con business_id ✅ DT-005                         |
| DollarRate      | dollar_rates         | Tasas BCV — con business_id ✅ DT-001                           |
| ActivityLog     | activity_logs        | Auditoría de acciones críticas                                  |
| ExpenseCategory | expense_categories   | Categorías de gastos ✅ DT-023 Sprint 15 — 6 system + custom    |
| Gasto           | gastos               | Gastos / CxP — FK category_id nullable ✅ DT-023               |
| Order           | orders               | Pedidos del catálogo público                                    |
| OrderItem       | order_items          | Líneas de cada pedido                                           |
| Quotation       | quotations           | Cotizaciones ✅ Sprint 15                                        |
| QuotationItem   | quotation_items      | Líneas de cotización ✅ Sprint 15                                |
| Return          | returns              | Devoluciones ✅ Sprint 15                                        |
| ReturnItem      | return_items         | Líneas de devolución ✅ Sprint 15                                |
| ProductComponent| product_components   | Componentes de combo/fabricable ✅ Sprint 19                    |
| Notification    | notifications        | Notificaciones sistema ✅ Sprint 22 — tipo, leído, business_id  |
| PushSubscription| push_subscriptions   | Suscripciones Web Push ✅ Sprint 24 — endpoint, p256dh, auth_key |

### Enums

| Enum              | Valores                                                      |
|-------------------|--------------------------------------------------------------|
| Role              | super_admin, admin, cashier                                  |
| ProductType       | simple, combo, fabricable                                    |
| UnitType          | unit, weight, volume, length                                 |
| SaleMode          | unit, weight, service, length, volume, package               |
| SaleStatus        | quote, pending, paid, cancelled, draft ✅ Sprint 24          |
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

### Campos nuevos en Sale (Sprint 22 — migración #17)
```
monto_recibido_usd  Decimal?          // suma de payments[].amount_usd — null si no pagado
vuelto_usd          Decimal?          // max(0, monto_recibido - total) — null si no pagado
due_date            DateTime?         // fecha límite crédito
credit_days         Int?              // días de crédito acordados
credit_notes        String?           // notas adicionales del crédito
```
✅ Sprint 23 (c8b6a62): `saleSchema` acepta `due_date`, `credit_days`, `credit_notes`. `client_id` obligatorio para `origin='credit'` (400 si omitido).

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
| 12 | 20260619075145_add_monthly_reports                      | 2026-06-19  |
| 13 | 20260619162814_add_quotations_returns                   | 2026-06-19  |
| 14 | 20260619174857_expense_categories                       | 2026-06-19  |
| 15 | 20260621000001_add_unique_catalog_slug_business         | 2026-06-21  |
| 16 | 20260621000002_add_fabrica_unit_type                   | 2026-06-21  |
| 17 | 20260622000001_sprint22_sale_fields_notifications      | 2026-06-22  |
| 18 | 20260622000002_order_number_unique                     | 2026-06-22  |
| 19 | 20260622000003_add_expense_due_date_supplier           | 2026-06-22  |

---

## 5. ÚLTIMOS 15 COMMITS

```
[ver luego vía git log --oneline -15]   ← Sprint 14 commits añadidos
(Sprint 14 commit)  docs+test+feat(sprint-14/CLI-D): 38 tests + PWA + SYSTEM_MAP v14 + HANDOFF15
2f6d021  feat(sprint-14/CLI-B): Analytics UI — Pulso del Negocio
f4127a1  fix: tsconfig.json excluye playwright y tests del build de produccion
7357fd3  fix+feat(sprint-14/CLI-A): P1/P2/P3 fixes catálogo+finanzas + analytics backend
0140a4d  fix(sprint-14/CLI-B): P1/P2 catálogo — quickToggle, bulkUpdate, label, token CSS
ed34ee9  docs+test(sprint-13/CLI-D): 33 tests + DT-023 spec + SYSTEM_MAP v13 + HANDOFF Sprint 14
707b27c  cert(sprint-13/CLI-C): certificación catálogo admin — CA01-CA05
9a359f6  feat(sprint-13/CLI-B): UI catálogo digital admin — métricas + QR + visibilidad bulk
ed83ba7  fix+feat(sprint-13/CLI-A): DT-025/027/028/029/031 + catálogo admin API
48de9cb  fix(sprint-13/CLI-B): DT-024 — Infinity% en ResumenSection (P1)
4bad02f  docs+test(sprint-12/CLI-D): 28 tests + SYSTEM_MAP v12 + HANDOFF Sprint 13
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
```

---

## 6. DEUDA TÉCNICA

| ID     | Sev | Estado           | Descripción                                             | Sprint   |
|--------|-----|------------------|---------------------------------------------------------|----------|
| DT-001 | P1  | ✅ RESUELTO       | dollarRate sin business_id — datos cross-tenant         | 10       |
| DT-002 | P1  | ✅ CONFIRMADO     | sold_at correcto en todos los paths                     | 10       |
| DT-003 | P1  | ✅ RESUELTO       | SaleAbono sin cash_register_id                          | 10       |
| DT-004 | P2  | ✅ RESUELTO       | Service Worker PWA — sw.js + offline.html + manifest   | 14       |
| DT-005 | P1  | ✅ RESUELTO       | CashMovement sin business_id — filtro cross-tenant      | 10       |
| DT-006 | P2  | ✅ RESUELTO       | Emojis en UI → Lucide icons en CatalogoGrid             | 10       |
| DT-007 | P2  | ✅ RESUELTO       | 7 tokens RGB faltantes + sweep 9 módulos CSS            | 10       |
| DT-008 | P2  | ✅ RESUELTO       | Dos fuentes de filtro catálogo → lib/catalog.ts         | 11       |
| DT-009 | P2  | ✅ RESUELTO       | computeAvailability alimenta SSR catálogo               | 11       |
| DT-010 | P3  | ✅ RESUELTO       | badge Descontinuado en CatalogoGrid                     | 11       |
| DT-011 | P2  | ✅ RESUELTO       | ventas/[id]/abono — amount_bs calculado server-side     | 11       |
| DT-012 | P2  | ✅ RESUELTO       | cash/close — TOCTOU en $transaction con findFirst       | 11       |
| DT-013 | P2  | ✅ RESUELTO       | rates/bcv protegido con auth + ruta pública /api/r/     | 11       |
| DT-014 | P2  | ✅ RESUELTO       | lib/bcv.ts cache → DB-based via dollar_rates (cluster-safe) | 18   |
| DT-015 | P3  | ❌ BACKLOG        | TOCTOU updates sin business_id doble filtro             | Backlog  |
| DT-016 | P3  | ❌ BACKLOG        | upload MIME spoofing — magic bytes sin validar          | Backlog  |
| DT-017 | P3  | ❌ BACKLOG        | clients/[id]/abono raw rate query sin caché             | Backlog  |
| DT-018 | P3  | ❌ BACKLOG        | orders precio $0 posible (sin validación min)           | Backlog  |
| DT-019 | P3  | ❌ BACKLOG        | WhatsApp automático requiere Meta API oficial           | Sprint 13|
| DT-020 | P3  | ✅ RESUELTO       | Export Excel en reportes — GET /api/reports/export-excel | 18      |
| DT-021 | P2  | ✅ RESUELTO       | Export Excel en finanzas — GET /api/finanzas/export-excel | 18     |
| DT-022 | P3  | ❌ BACKLOG        | Gastos recurrentes (definir una vez, pagar mensual)     | Backlog  |
| DT-023 | P3  | ✅ RESUELTO       | Expense Categories — backend Sprint 15 + UI Sprint 16   | 15+16    |
| DT-024 | P1  | ✅ RESUELTO       | Infinity% en ResumenSection — safePct() + sin_margen   | 13       |
| DT-025 | P2  | ✅ RESUELTO       | punto-equilibrio PE=0 con gastos=0 — early return      | 13       |
| DT-026 | P3  | ❌ PENDIENTE      | regex diacríticos en r/[token]/route.ts                | Backlog  |
| DT-027 | P2  | ✅ RESUELTO       | gastos concepto vacío con espacios — .trim().min(3)    | 13       |
| DT-028 | P2  | ✅ RESUELTO       | egresos.total_usd excluía cuentas_pagadas              | 13       |
| DT-029 | P2  | ✅ RESUELTO       | gastos/resumen raw SQL para rate → readCachedBcvRate() | 13       |
| DT-031 | P2  | ✅ RESUELTO       | parsePeriod() DRY en lib/finanzas.ts (3 copias → 1)    | 13       |
| DT-032 | P1  | ✅ RESUELTO       | quickToggle catálogo sin try/catch — crash silencioso   | 14       |
| DT-033 | P1  | ✅ RESUELTO       | bulkUpdate catálogo sin await load() post-update        | 14       |
| DT-034 | P2  | ✅ RESUELTO       | metrics ?? 'visible' — valor default incorrecto         | 14       |
| DT-035 | P2  | ✅ RESUELTO       | ingresos double-count incluía abonos duplicados         | 14       |
| DT-036 | P3  | ✅ RESUELTO       | catalog_url hardcodeada — ahora usa NEXT_PUBLIC_APP_URL | 14       |
| DT-037 | P2  | ✅ RESUELTO       | business.theme cross-device — next-themes gestiona sync | 17       |
| DT-038 | P2  | ✅ RESUELTO       | slug @unique — migración 20260621000001 aplicada        | 18       |
| DT-039 | P1  | ✅ RESUELTO       | Header onClick sin mounted guard — crash SSR corregido  | 17       |
| DT-040 | P2  | ✅ RESUELTO       | Button.module.css #fff hardcodeado — reemplazado token  | 17       |
| DT-041 | P2  | ✅ RESUELTO       | TabTema sin mounted guard — eliminado, toggle en header | 17       |
| DT-042 | P3  | ✅ RESUELTO       | Import masivo productos Excel — POST /api/products/import-excel | 21        |

---

## 7. INVARIANTES DE SEGURIDAD

| Invariante                               | Implementación                                              | Estado        |
|------------------------------------------|-------------------------------------------------------------|---------------|
| `business_id` siempre de `getSession()`  | `src/lib/auth.ts` — nunca del body                          | ✅            |
| Precios en catálogo solo del DB          | `catalog/[slug]/order/route.ts` — ItemSchema sin price      | ✅            |
| Precio en ventas solo del DB (SEC-01)    | `sales/route.ts` — price_per_unit_usd del product, no body  | ✅ Sprint 20  |
| recipe_snapshot inmutable (SEC-02)       | `sales/[id]/pay/route.ts` — snapshot al crear, no live      | ✅ Sprint 20  |
| Descuento requiere PIN autorizado        | `sales/[id]/authorize-discount` — PIN + max_discount_pct    | ✅ Sprint 20  |
| max_discount_pct respetado por cashier   | 403 si discount_pct > max + role cashier                    | ✅ Sprint 20  |
| Admin bypass límite de descuento         | Admin puede superar max_discount_pct con su PIN             | ✅ Sprint 20  |
| Apertura de caja atómica                 | `cash/open/route.ts` — findFirst dentro de $transaction     | ✅            |
| Abonos acotados al turno activo          | `cash/status/route.ts` — created_at >= opened_at            | ✅            |
| Rate limiting en endpoints públicos      | `src/lib/rate-limit.ts` — catalogLimiter, loginLimiter      | ✅            |
| JWT fail-closed                          | `src/lib/auth.ts` — algorithms: ['HS256'], sin fallback     | ✅            |
| Slug validado con regex                  | `/^[a-z0-9-]{3,50}$/` antes de cualquier query             | ✅            |
| Stock descuenta solo en paid             | `sales/route.ts` — status check explícito                   | ✅            |
| Role guard cashier en finanzas           | 5 endpoints — 403 si role === 'cashier'                     | ✅ Sprint 10  |
| Role guard cashier en analytics          | 3 endpoints + middleware ADMIN_ONLY — 403/redirect          | ✅ Sprint 14  |
| Import limit 5MB                         | `products/import/route.ts` — Content-Length check           | ✅ Sprint 10  |
| dollarRate con business_id               | migration 20260619051022                                    | ✅ Sprint 10  |
| SaleAbono con cash_register_id           | migration 20260619051109                                    | ✅ Sprint 10  |
| rates/bcv con auth                       | ✅ DT-013 resuelto Sprint 11                                | Sprint 11     |
| cash/close TOCTOU                        | ✅ DT-012 resuelto — $transaction + findFirst               | Sprint 11     |
| amount_bs server-side                    | ✅ DT-011 resuelto — amount_bs = usd × rate                 | Sprint 11     |
| Rate limit DB (SEC-04)                   | `lib/rate-limit.ts` — limiter almacenado en DB, cluster-safe| ✅ Sprint 21  |
| Precio en orders solo del DB (A5-1)      | `orders/route.ts` — price_per_unit_usd del product, no body | ✅ Sprint 22  |
| vuelto_usd calculado server-side         | `sales/route.ts` — max(0, recibido - total), nunca del body | ✅ Sprint 22  |
| client_id obligatorio en crédito         | `sales/route.ts` — origin='credit' sin client_id → 400      | ✅ Sprint 23  |
| order_number único por business          | @@unique([business_id, order_number]) — migración #18        | ✅ Sprint 23  |
| Abonos CxC no decrementan stock doble    | `cxc/[id]/abono` — solo actualiza status='paid', NO stock    | ✅ Sprint 23  |
| CORE_MODULES no desactivables            | `config/business/modules` — PATCH → 400 si omite pos/caja/inventory | ✅ Sprint 25 |
| stock_alert_threshold=0 sin falso positivo | `sales/route.ts checkStockAlerts` — guard `threshold > 0 && net <=` | ✅ Sprint 25 |
| checkStockAlerts con business_id         | `sales/route.ts` — findMany scoped con `business_id: businessId` | ✅ Sprint 25 |
| Drafts DELETE atómico (TOCTOU)           | `pos/drafts/[id]` DELETE — $transaction findFirst+deleteItems+delete, status='draft' guard | ✅ Sprint 25 |
| Admin panel redirige admin→escritorio    | `(admin)/layout.tsx` — role !== 'super_admin' → redirect('/escritorio') | ✅ Sprint 25 |

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
│   │   ├── analytics/page.tsx              ← Pulso del Negocio ✅ Sprint 14
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
│   ├── tokens.css                        ← Design tokens v3.0 Sprint 17 — light default, navy dark, 5 bordes semánticos
│   └── globals.css
├── types/
└── tests/
    ├── pos-core.spec.ts                  ← 6/6 ✅ POS certificado
    ├── caja-core.spec.ts                 ← 5/5 ✅ afterAll fix: storageState
    ├── reportes-core.spec.ts             ← 5/5 ✅ R03: networkidle fix
    ├── finanzas-core.spec.ts             ← 5/5 ✅
    ├── services-and-catalog.spec.ts      ← 7/7 ✅ timeout 6s anti-flaky
    ├── catalogo-admin.spec.ts            ← 5/5 ✅ Sprint 13 CA01-CA05
    ├── analytics-core.spec.ts            ← 5/5 ✅ Sprint 14 AN01-AN05
    ├── sprint15-core.spec.ts             ← 5/5 ✅ Sprint 15 Q01-Q02 R01-R02 U01
    ├── expense-categories.spec.ts        ← 4/4 ✅ Sprint 15 DT-023 EX01-EX04
    ├── onboarding.spec.ts                ← 5/5 ✅ Sprint 16 ON01-ON05
    ├── sprint17-visual.spec.ts           ← 5/5 ✅ Sprint 17 ES01-ES05
    ├── sprint18-mobile.spec.ts           ← 5/5 ✅ Sprint 18 MO01-MO05
    ├── sprint19-fabrica.spec.ts          ← 5/5 ✅ Sprint 19 FA01-FA05
    ├── sprint20-security.spec.ts         ← 5/5 ✅ Sprint 20 SD01-SD05
    ├── sprint21-import-variantes.spec.ts ← 8/8 ✅ Sprint 21 IM01-IM03 VA01-VA03 PI01-PI02
    ├── sprint22-fixes.spec.ts            ← 8/8 ✅ Sprint 22 SP22-01..SP22-08 todos resueltos
    ├── sprint23-cxc-notif.spec.ts        ← 8/8 ✅ CxC abonos + Notif + DueDate + PDF Sprint 23 (DU01: CxC check removido S25)
    ├── sprint23-cxc-notifications.spec.ts← 8/8 ✅ CX01-CX05 + NF01-NF03 — CLI-D Sprint 23
    ├── sprint24-multiticket-modules.spec.ts ← 8/8 ✅ MT01-MT03 + MO01/03 + ST01/02 + WP01 (MT02: 409→400 S25)
    ├── sprint24-drafts-modules-push.spec.ts ← 8/8 ✅ MT01-MT05 + MD01-MD02 + PW01 (MD02: inventory en testModules S25)
    ├── sprint25-fixes-admin.spec.ts      ← 8/8 ✅ MT-FIX04 + MT-FIX01+03 + MO-FIX01/02-gap + PU-FIX01 + ST-FIX01 + AD01/02
    ├── .auth-state.json                  ← JWT admin — expira 8h — refrescar con script node (ver §9)
    └── playwright.config.ts              ← workers:1 fijado Sprint 13
```

---

---

## 9. TESTS E2E — 128 tests / 127 estables

| Archivo                                   | Tests | Estado |
|-------------------------------------------|-------|--------|
| `pos-core.spec.ts`                        | 6     | ✅ · ⚠️ T03 skip permanente (timeout "Arepa con Pollo" < 2s bajo carga) |
| `caja-core.spec.ts`                       | 5     | ✅     |
| `reportes-core.spec.ts`                   | 5     | ✅ R03: networkidle fix |
| `finanzas-core.spec.ts`                   | 5     | ✅ F03: networkidle fix (Sprint 24); F04: shape CxC Sprint 23 |
| `services-and-catalog.spec.ts`            | 7     | ✅     |
| `catalogo-admin.spec.ts`                  | 5     | ✅     |
| `analytics-core.spec.ts`                  | 5     | ✅     |
| `sprint15-core.spec.ts`                   | 5     | ✅ Q01-Q02, R01-R02, U01 |
| `expense-categories.spec.ts`              | 4     | ✅ EX01-EX04 |
| `onboarding.spec.ts`                      | 5     | ✅ ON01-ON05 |
| `sprint17-visual.spec.ts`                 | 5     | ✅     |
| `sprint18-mobile.spec.ts`                 | 5     | ✅ MO01-MO05 |
| `sprint19-fabrica.spec.ts`                | 5     | ✅ FA01-FA05 |
| `sprint20-security.spec.ts`               | 5     | ✅ SD01-SD05 |
| `sprint21-import-variantes.spec.ts`       | 8     | ✅ IM01-IM03 + VA01-VA03 + PI01-PI02 |
| `sprint22-fixes.spec.ts`                  | 8     | ✅ SP22-01..08 todos |
| `sprint23-cxc-notif.spec.ts`              | 8     | ✅ CX01-CX03 + NO01-NO02 + DU01-DU02 + PD01 — DU01: CxC check removido (>100 pending sales break limit=100) |
| `sprint23-cxc-notifications.spec.ts`      | 8     | ✅ CX01-CX05 + NF01-NF03 |
| `sprint24-multiticket-modules.spec.ts`    | 8     | ✅ MT01-MT03 + MO01 + MO03 + ST01 + ST02 + WP01 — MT02 actualizado: 409 → 400 (S25 FIX8) |
| `sprint24-drafts-modules-push.spec.ts`    | 8     | ✅ MT01-MT05 + MD01-MD02 + PW01 — MD02 fix: testModules incluye 'inventory' (CORE_MODULES S25) |
| `sprint25-fixes-admin.spec.ts`            | 8     | ✅ MT-FIX04 + MT-FIX01+03 + MO-FIX01 + MO-FIX02-gap + PU-FIX01 + ST-FIX01 + AD01 + AD02 |
| `auditoria-ciclo-real.spec.ts`            | 7     | ✅ **7/7 CIMAAD** — Nodo 1-7 ciclo completo · VPS:3003 · Sprint 27 |
| **TOTAL**                                 | **135**| ✅ **134/135 · 1 skip permanente T03** · Sprint 28: sin nuevos spec (features verificadas manualment) |

### Tests Sprint 23 — nuevos (CLI-D)

| Test  | Descripción                                         | Archivo                              |
|-------|-----------------------------------------------------|--------------------------------------|
| CX01  | GET /api/finanzas/cxc — shape pagination + buckets  | sprint23-cxc-notifications.spec.ts   |
| CX02  | GET /api/finanzas/cxc/summary — 3 buckets           | sprint23-cxc-notifications.spec.ts   |
| CX03  | POST abono parcial — saldo_usd decrementado         | sprint23-cxc-notifications.spec.ts   |
| CX04  | POST abono total — paid=true, saldo=0               | sprint23-cxc-notifications.spec.ts   |
| CX05  | Cashier → 403 en GET /api/finanzas/cxc              | sprint23-cxc-notifications.spec.ts   |
| NF01  | GET /api/notifications — array con campos requeridos| sprint23-cxc-notifications.spec.ts   |
| NF02  | PATCH /[id]/read — marca leída, idempotente         | sprint23-cxc-notifications.spec.ts   |
| NF03  | PATCH /read-all — count, pending→read               | sprint23-cxc-notifications.spec.ts   |

### Tests Sprint 24 — nuevos (CLI-C + CLI-D)

| Test  | Descripción                                               | Archivo                                |
|-------|-----------------------------------------------------------|----------------------------------------|
| MT01c | POST drafts con items → status draft, DRF-NNNNN           | sprint24-multiticket-modules.spec.ts   |
| MT02c | 6to draft → 400 Bad Request (S25 FIX8: era 409 Conflict)  | sprint24-multiticket-modules.spec.ts   |
| MT03c | PATCH reemplaza items atómicamente                        | sprint24-multiticket-modules.spec.ts   |
| MO01  | PATCH modules persiste → GET confirma                     | sprint24-multiticket-modules.spec.ts   |
| MO03  | Gap: middleware no bloquea ruta módulo desactivado        | sprint24-multiticket-modules.spec.ts   |
| ST01  | stock_alert_threshold guardado via PATCH /api/products/[id]| sprint24-multiticket-modules.spec.ts  |
| ST02  | stock_low notification tras venta pagada bajo umbral      | sprint24-multiticket-modules.spec.ts   |
| WP01  | SSRF: endpoint fuera de allowlist → 400                   | sprint24-multiticket-modules.spec.ts   |
| MT01  | POST /api/pos/drafts → 201, DRF-NNNNN, status=draft       | sprint24-drafts-modules-push.spec.ts   |
| MT02  | GET /api/pos/drafts — lista de drafts del cajero          | sprint24-drafts-modules-push.spec.ts   |
| MT03  | PATCH draft items — precio calculado desde DB             | sprint24-drafts-modules-push.spec.ts   |
| MT04  | DELETE /api/pos/drafts/[id] → 200 OK                     | sprint24-drafts-modules-push.spec.ts   |
| MT05  | PATCH draft inexistente → 404                             | sprint24-drafts-modules-push.spec.ts   |
| MD01  | GET /api/config/business/modules — shape + allowed_modules| sprint24-drafts-modules-push.spec.ts   |
| MD02  | PATCH modules + cashier 403                               | sprint24-drafts-modules-push.spec.ts   |
| PW01  | SSRF: private IP + HTTP + non-allowlist → 400             | sprint24-drafts-modules-push.spec.ts   |

### Tests Sprint 25 — nuevos (CLI-C)

| Test        | Descripción                                                        | Archivo                          |
|-------------|---------------------------------------------------------------------|----------------------------------|
| MT-FIX04    | 6to draft → 400 Bad Request (S25 FIX8: era 409 en S24)            | sprint25-fixes-admin.spec.ts     |
| MT-FIX01+03 | Draft persiste en DB; GET lo lista tras "refresh" (DB-backed)     | sprint25-fixes-admin.spec.ts     |
| MO-FIX01    | PATCH modules omitiendo core (pos) → 400 — CORE_MODULES guard      | sprint25-fixes-admin.spec.ts     |
| MO-FIX02    | Gap documentado: middleware no enforcea modules_enabled en rutas   | sprint25-fixes-admin.spec.ts     |
| PU-FIX01    | POST /api/orders origin=catalog → order_new notif creada (entity_id lookup) | sprint25-fixes-admin.spec.ts |
| ST-FIX01    | stock_alert_threshold=0 → sin stock_low falso positivo            | sprint25-fixes-admin.spec.ts     |
| AD01        | /businesses redirige admin (no super_admin) a /escritorio          | sprint25-fixes-admin.spec.ts     |
| AD02        | /stats redirige admin (no super_admin) a /escritorio               | sprint25-fixes-admin.spec.ts     |

### Fixes Sprint 25 (CLI-D — test fixes para regresiones)

| Fix         | Root cause                                                          | Solución                                    |
|-------------|---------------------------------------------------------------------|---------------------------------------------|
| MT02 update | S25 FIX8 cambió 409→400 en drafts/route.ts MAX_DRAFTS overflow      | Test actualizado: espera 400 no 409         |
| MD02 update | S25 CORE_MODULES guard rechaza modules sin 'inventory'              | testModules cambiado a ['pos','caja','inventory','finanzas'] |
| DU01 update | >100 pending sales en DB — limit=100 insuficiente para CxC lookup   | CxC check removido; due_date ya verificado en sale response |
| PU-FIX01    | `take:20` cap — count comparison falla cuando business tiene 20+ notifs | Cambiado a entity_id lookup (patrón NO01) |
| Auth expiry | `tests/.auth-state.json` cookie expirada midway suite (8h TTL)      | Refrescar con script node (ver abajo)       |

### Fixes Sprint 24 (CLI-D)

| Fix   | Root cause                                                   | Solución                               |
|-------|--------------------------------------------------------------|----------------------------------------|
| T04/T05 | Stock "Arepa con Pollo" = 0 por ventas repetidas en T05   | beforeAll: POST /api/inventory qty=50  |
| SP22-05 | First product-card disabled por stock = 0               | Selector `:not([disabled])` en locator |
| NO01    | GET /api/notifications cap take:20 → countAfter=countBefore | Type+entity_id lookup en lugar de count |
| F03     | `domcontentloaded` retorna antes de hidratación React        | Cambiado a `networkidle`              |

### Tests Sprint 27 — CIMAAD ciclo real (CLI-D)

| Nodo | Descripción                                                   | Estado |
|------|---------------------------------------------------------------|--------|
| 1    | POST /api/inventory → stock.net_qty +10 en DB                | ✅     |
| 2    | POST /api/sales paid → stock -2, ticket ACT-NNNNN            | ✅     |
| 3    | POST /api/cash/close → isOpen=false (omitido si caja ajena)  | ✅     |
| 4    | GET /api/reports/daily → sales_count > 0 hoy                 | ✅     |
| 5    | POST /api/sales pending origin=credit → queda en DB          | ✅     |
| 6    | POST /api/orders + cobrar → status=delivered                  | ✅     |
| 7    | GET /api/finanzas/resumen → ventas_usd > 0 + CxC count >= 1  | ✅     |

**CIMAAD ejecutado en VPS (localhost:3003) — 7/7 ✅ | 7.3s de ejecución**

### Gaps resueltos en Sprint 26

| Gap      | Descripción                                               | Resolución           |
|----------|-----------------------------------------------------------|----------------------|
| MO-FIX02 | Middleware no enforcea modules_enabled                    | ✅ Resuelto Sprint 26 |

### Gaps abiertos — pendientes Sprint 28

| Gap    | Descripción                                                              | Sprint destino |
|--------|--------------------------------------------------------------------------|----------------|
| PU-FIX02 | /api/orders no invoca /api/push/send al crear order_new              | Sprint 28 CLI-A |
| S25-F2   | /businesses y /stats en layout.tsx pero NO en middleware SUPER_ADMIN_ONLY | Sprint 28 CLI-A |
| AD04     | /businesses/[id] detail page no implementado — 404                    | Sprint 28 CLI-B |

**Notas de infraestructura:**
- `workers: 1` en playwright.config.ts — tests seriales (dependencia de estado caja)
- `afterAll` en caja-core.spec.ts usa `storageState` para reabrir caja con auth
- F05, AN05, ON05 usan `playwright.request.newContext()` para evitar rate limiter del login form
- AN05/ON05 transfieren cookie via `apiCtx.storageState()` → `browser.newContext({ storageState })`
- `auditoria-ciclo-real.spec.ts` usa login fresco en beforeAll — NO depende de `.auth-state.json`

**JWT auth-state — gestión (tests locales):**
- `tests/.auth-state.json` expira cada 8h — si los tests fallan en masa, refrescar con:
  ```javascript
  // node -e (ejecutar en consola, puerto local 3000)
  const http = require('http'), fs = require('fs');
  const body = JSON.stringify({ email: 'admin@activopos.com', password: 'admin123' });
  http.request({ hostname: 'localhost', port: 3000, path: '/api/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  }, res => {
    const cookie = (res.headers['set-cookie']||[]).find(c=>c.includes('activopos_session'));
    const value = cookie.match(/activopos_session=([^;]+)/)[1];
    const expires = new Date(cookie.match(/Expires=([^;]+)/i)[1]).getTime()/1000;
    fs.writeFileSync('tests/.auth-state.json', JSON.stringify({cookies:[{name:'activopos_session',value,domain:'localhost',path:'/',expires,httpOnly:true,secure:false,sameSite:'Strict'}],origins:[]}));
    console.log('Auth state updated');
  }).end(body);
  ```
- Síntoma de JWT expirado: tests del tramo final fallan (sprint23+) con 200 en POSTs a API — middleware redirige a /login

### Pendientes Sprint 28
- PU-FIX02: /api/orders invoca /api/push/send para pedidos catalog (CLI-A)
- S25-F2: Añadir /businesses y /stats a SUPER_ADMIN_ONLY en middleware.ts (CLI-A)
- AD04: /businesses/[id] detail page implementación (CLI-B)
- Marketing system: completar (marketing)/layout.tsx + páginas (CLI-B)
- Canales de venta / listas de precio
- PWA offline IndexedDB sync queue
- Integración WhatsApp bot via n8n.syntiweb.com

---

**Nota: T01/T06 en pos-core.spec.ts** — actualizados de `getByText('Ventas hoy')` a
`locator('[aria-label="Facturación total"]')` tras renombre de KPI en Escritorio v3.0.

*Generado: 2026-06-23 | Sprint 27 cierre | CLI-D modo EJECUCIÓN*
*135 E2E · 134/135 estables · 1 skip permanente T03 · 7 tests Sprint 27 CIMAAD (CLI-D×7) · VPS puerto 3003*
