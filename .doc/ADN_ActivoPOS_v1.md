# ADN Funcional — ActivoPOS
> Extracción completa de capacidades, módulos, flujos y segmentos
> Fuente: SYSTEM_MAP Sprint 113 · HANDOFF 85-113 · MASTER · ROADMAP v2
> Fecha: 2026-07-11 | Versión 1.0 — generado por Claude Web

---

## 1. IDENTIDAD DEL SISTEMA

**ActivoPOS** es un SaaS de punto de venta (POS) multi-tenant para PYMES venezolanas.

- **Posicionamiento:** "Tu sistema de control de ventas e inventario. No reemplaza tu facturación SENIAT — la complementa."
- **Dominio:** activopos.com
- **Modelo de negocio:** Suscripción mensual en USD · 3 planes · Tenant por negocio
- **Stack:** Next.js 14 · TypeScript strict · CSS Modules · Prisma 7 · MariaDB
- **Infraestructura:** VPS propio (187.124.241.213) · PM2 · Nginx · Let's Encrypt

---

## 2. SEGMENTOS OBJETIVO (10)

| Segmento | Key | Color brand | Ejemplos reales |
|---|---|---|---|
| Retail & Comercio general | `default` | #2563EB azul | Abastos, bodegas, tiendas |
| Premium Operativo | `premium` | #2563EB azul dark | Negocios de mayor ticket |
| Calle Premium | `calle` | #EA580C naranja | Carnicerías, pollerías |
| Tech & Digital | `tropical` | #14B8A6 teal | Tiendas de tecnología |
| Clínica & Salud | `clinica` | #10B981 verde menta | Farmacias, botiquines |
| Ferretería | `ferreteria` | #D97706 amarillo | Ferreterías, materiales |
| Servicios & Oficina | `oficina` | #6366F1 índigo | Oficinas, servicios profesionales |
| Gastronomía | `restaurante` | #DC2626 rojo | Restaurantes, cafés, panaderías |
| Moda & Joyería | `joyeria` | #B45309 dorado | Boutiques, joyerías, ropa |
| Farmacia | `farmacia` | #059669 verde | Farmacias, bienestar |

Implementación: `businesses.theme` → `data-theme` en layout → variables CSS por segmento en `tokens.css`

---

## 3. PLANES Y LÍMITES

| Plan | Precio aprox. | Límites clave |
|---|---|---|
| Inicio (Mostrador) | Free / bajo | Productos limitados, sin catálogo, sin usuarios extra |
| Pro | Mid | Catálogo digital, más productos, más usuarios |
| Business (Negocio) | Full | Sin límites, analytics, todas las features |

Enforcement: `plan-guard.ts` lee de DB (nunca JWT ni body). `checkPlanLimit()` activo en: `create_product`, `create_user`, `create_supplier`. Pendiente conectar: `access_catalog`, `access_ai`.

---

## 4. MÓDULOS — CATÁLOGO FUNCIONAL COMPLETO

### 4.1 AUTENTICACIÓN Y SESIÓN
- Login dark navy (fachada ActivoPOS, no del cliente)
- JWT HS256, fail-closed, cookie httpOnly
- Middleware de gating por rol: `admin`, `cashier`, `super_admin`
- Rate limiting por feature (`PinRateLimit`)
- Cambio de contraseña, reset de PIN

### 4.2 ONBOARDING
- Wizard de registro `/registro` — 7 pasos
- Tracker de progreso `(dashboard)/onboarding`
- Verificación de slug único del negocio
- Activación automática de plan seleccionado
- Cuentas demo disponibles en VPS: `boutique-demo`, `demo-negocio`, `demo-mostrador`

### 4.3 DASHBOARD / ESCRITORIO
- KPIs en tiempo real: ventas cobradas, créditos, tickets, utilidad
- Gráficos de rendimiento por período (diario, semanal, mensual)
- Resumen de créditos pendientes (CxC)
- Alertas de gastos
- Fondo `#EEEDF4`, cards elevadas con box-shadow

### 4.4 PUNTO DE VENTA (POS)
- Búsqueda por nombre, SKU y código de barras (escáner `html5-qrcode`)
- Selector de variantes (talla, color, etc.) con stock por variante
- Descuento con PIN de autorización
- Venta a crédito (requiere `client_id`)
- Multi-ticket paralelo con persistencia (drafts en DB)
- Modo KDS (Kitchen Display System) para cocina
- Factura de servicio, cotización previa
- Stock descuenta SOLO cuando `status='paid'` o `status='credit'`
- Precio siempre: qty × price (NUNCA monto → qty)
- Pago Móvil, Zelle, Binance, USDT, Zinli, PayPal — ciudadanos de primera clase

### 4.5 INVENTARIO Y PRODUCTOS
- CRUD completo con imágenes (compresión Canvas antes de subir)
- Variantes de producto: cada `ProductVariant` tiene `stock: Int` propio e independiente
- Categorías con imagen propia (visible en catálogo)
- Stock inicial por variante al crear producto
- Movimientos de inventario (entradas, salidas, uso interno)
- Importación masiva desde Excel
- Bulk visibility (activar/desactivar múltiples productos)
- Búsqueda y paginación
- Historial de movimientos por producto

### 4.6 CAJA
- Apertura de caja con monto inicial
- Cierre con cuadre (declarado vs calculado)
- Historial de cajas anteriores
- Movimientos de caja (entradas/salidas manuales)

### 4.7 PEDIDOS (KANBAN)
- 4 estados: Pendiente → En preparación → Listo → Entregado
- Vista Kanban con drag & drop
- Cobro de pedido (genera venta)
- Cancelación
- Notificación por WhatsApp al cliente (link `wa.me/...`)

### 4.8 CLIENTES Y CxC
- CRUD de clientes
- Historial de compras por cliente
- Saldo de deuda (Cuentas por Cobrar)
- Registro de abonos
- Balance por cliente
- Frecuencia y ticket promedio

### 4.9 PROVEEDORES Y COMPRAS
- CRUD de proveedores
- Compras con transacción atómica (mercancía recibida)
- Estado `pending` = mercancía recibida físicamente
- Compras a crédito: `status='credit'` con `client_id` obligatorio
- Historial de compras por proveedor

### 4.10 FINANZAS
- **CxC (Cuentas por Cobrar):** saldo, abonos, resumen
- **CxP (Cuentas por Pagar):** deudas con proveedores
- **Gastos:** registro por categoría, alertas
- **Categorías de gastos:** CRUD
- **P&L (Estado de Resultados):** ingresos, COGS, gastos, utilidad
- **Punto de equilibrio:** cálculo automático
- **Export Excel** de toda la data financiera
- Deuda en USD permanente; Bs calculado dinámicamente, nunca almacenado

### 4.11 REPORTES
- Reporte del día (ventas, pagos, métodos)
- Reporte por rango de fechas
- Export Excel
- Export PDF (implementado, pendiente conectar UI — DT-11)
- Reporte mensual automático (cron)
- Reportes pendientes de revisión

### 4.12 ANALYTICS
- Top productos más vendidos
- Tendencias de venta
- Período: diario, semanal, mensual

### 4.13 CATÁLOGO DIGITAL (PÚBLICO)
3 páginas públicas completas, accesibles en `/catalogo/[slug]`:

**HOME (`/catalogo/[slug]`):**
- Slider hero: 3 banners configurables (con fade automático 5s)
- Categorías circulares con imagen propia
- Sección de productos destacados
- Shelves horizontales por categoría (scroll rail)
- Footer del negocio: logo, nombre, RIF, dirección, teléfono, Instagram, horario
- Nav: Inicio + Catálogo

**GRID (`/catalogo/[slug]/productos`):**
- Sidebar de categorías en desktop
- Chips de categoría en mobile
- Buscador en tiempo real
- Contador de resultados
- Grid 4 columnas desktop, 2 mobile
- Botón "Agregar" por card

**DETALLE (`/catalogo/[slug]/p/[id]`):**
- Galería con thumbnails navegables
- Selector de variantes (agotadas tachadas)
- Precio dual USD + Bs
- Nota BCV verde
- "Pedir ahora" → WhatsApp con producto/variante/qty
- Productos relacionados (4 col desktop)
- Descripción del producto
- Header mini del negocio sticky

**CHECKOUT (3 pasos integrado):**
- Paso 1: Contacto (nombre, teléfono)
- Paso 2: Entrega (pickup o delivery + dirección)
- Paso 3: Pago (selección de método)
- FAB WhatsApp (visible solo con items en carrito)

**Configuración desde admin:**
- 3 uploaders de banner/slider en Configuración → Tema
- Imagen por categoría en modal de categoría
- Descripción del producto en formulario crear/editar
- Slug personalizable del negocio

### 4.14 COTIZACIONES
- CRUD completo
- Conversión a venta
- PDF profesional
- Transacciones reales

### 4.15 DEVOLUCIONES
- Registro de devolución
- Aprobación / Rechazo
- Ajuste de stock automático al aprobar
- `$transaction` atómica

### 4.16 USUARIOS Y PERMISOS
- CRUD de usuarios por negocio
- Roles: `admin`, `cashier`
- Reset de PIN por admin
- Cambio de contraseña
- Gating por rol en middleware

### 4.17 CONFIGURACIÓN DEL NEGOCIO
- **Datos del negocio:** nombre, RIF, dirección, teléfono, logo, horario, Instagram
- **Tema visual:** selección de segmento (10 temas), banners del catálogo
- **Métodos de pago:** activar/desactivar, agregar personalizados
- **IVA:** configuración del porcentaje
- **PIN de gerente:** configuración y cambio
- **Catálogo:** slug, modo delivery, configuración de envío
- **Dispositivos:** gestión de dispositivos autorizados
- **Suscripción:** plan activo y estado
- **Ticket/factura:** configuración del formato impreso

### 4.18 NOTIFICACIONES
- CRUD de notificaciones
- Web Push real (`PushSubscription`)
- Contadores no leídos
- Historial
- Mark all as read

### 4.19 SUPER ADMIN / PANEL ADMIN
- Route group separado `(admin)`, acceso exclusivo `super_admin`
- Estadísticas globales del sistema
- Gestión de tenants (negocios)
- Cambio de plan por tenant
- Impersonación de tenant (para soporte)
- Invoices y tickets de soporte

### 4.20 LANDING PAGE / MARKETING
- Hero con animaciones
- Segmentos SEO por industria (10 segmentos)
- Planes con precios
- FAQ por segmento
- Testimonios (placeholder → real cuando haya clientes)
- CTA directo a registro
- Schema.org SoftwareApplication

---

## 5. INTEGRACIONES Y CONEXIONES EXTERNAS

| Integración | Estado | Detalle |
|---|---|---|
| BCV (tasa oficial USD/Bs) | ✅ Live | Fallback dual: dolarapi → brecha-cambiaria. Cache DB 1h. Timeout 5s. |
| WhatsApp | ⚠️ Parcial (por diseño) | Genera link `wa.me/...`. Sin API Meta. N8N para reportes mensuales. |
| Métodos de pago venezolanos | ✅ Completo | Pago Móvil, Zelle, Binance, USDT, Zinli, PayPal — configurables por negocio |
| Web Push | ✅ Completo | PushSubscription real en DB |
| Scanner de código de barras | ✅ Completo | `html5-qrcode` con `useBarCodeDetectorIfSupported` |

---

## 6. REGLAS DE NEGOCIO SELLADAS

### Financiero
- Deuda anclada en USD permanentemente; Bs calculado dinámico en display, NUNCA almacenado
- COGS reconocido al momento de la venta desde `SaleItem.cost_per_unit_usd`
- Stock solo se decrementa cuando `status='paid'` O `status='credit'`
- Venta: `qty × price` — NUNCA `monto → qty`
- Fórmula de precio: `costo + margen%` (modelo Venko)
- Compras a crédito con `status='credit'` y `client_id` obligatorio

### Seguridad y arquitectura
- `business_id` siempre desde `getAuthenticatedTenant()` / `getSession()` — NUNCA del body
- Multi-tenant: Prisma Client Extension inyecta `business_id` automáticamente en todas las queries
- Tenant isolation: fail-closed (si falla, bloquea — no expone datos de otro tenant)
- Soft delete en todos los registros financieros (NUNCA `deleteMany`)
- `$transaction` con el cliente base de Prisma (no el extendido)
- Precios siempre del servidor (anti price-tampering)
- `business_id` en todas las tablas — 37 modelos Prisma

### Catálogo
- Siempre light mode (`--biz-color` del tenant)
- Precios siempre USD Y Bs simultáneamente (sin toggle)
- Variable CSS del color del tenant: `--biz-color` (nunca `--tenant-color`)

---

## 7. FLUJOS E2E PRINCIPALES

### Flujo de venta normal
```
Abrir caja → Buscar producto (nombre/SKU/barcode) → Seleccionar variante → 
Agregar al ticket → Aplicar descuento (PIN) → Seleccionar método de pago → 
Procesar pago → Emitir ticket/factura → Stock decrementa
```

### Flujo de venta a crédito
```
Buscar cliente → Asociar al ticket → Procesar como crédito → 
Stock decrementa → CxC actualiza → Abono posterior
```

### Flujo de pedido (Kanban → POS)
```
Pedido entra (catálogo/manual) → Estado Pendiente → Preparación → 
Listo → Cobrar → Genera venta real → Entregado
```

### Flujo del catálogo público
```
Cliente navega /catalogo/[slug] → Explora por categoría → 
Selecciona producto → Elige variante → Agrega al carrito → 
Checkout 3 pasos → Pedido notificado al negocio vía WhatsApp
```

### Flujo de compra a proveedor
```
Registrar proveedor → Crear compra → Items + costos → 
Mercancía recibida (status=pending) → Stock incrementa → 
Si crédito: CxP actualiza
```

---

## 8. DATOS DUALES (USD + Bs) — ESTÁNDAR VENEZOLANO

Todos los precios y montos se muestran SIMULTÁNEAMENTE en ambas monedas, sin toggle.

- Tasa BCV: obtenida vía API externa, cache en DB 1 hora
- Tasa manual: configurable por tenant (override de BCV para operaciones internas)
- "Paralelo" nunca aparece en la UI (cumplimiento legal)
- Bs calculado dinámicamente en display, nunca almacenado en DB como dato primario
- Context global `RateContext` — 29 call-sites pendientes de conectar al override manual del tenant

---

## 9. ENDPOINTS API — RESUMEN EJECUTIVO

**Total: 146+ route.ts**

| Dominio | Endpoints clave |
|---|---|
| Auth | login, logout, me |
| Onboarding | setup, check-slug, complete, steps |
| Productos | CRUD, variantes, categorías, importación, búsqueda, bulk |
| Inventario | movimientos, export |
| Proveedores | CRUD + compras |
| Ventas | CRUD, pay, void, descuento, ticket, factura, abono |
| Caja | open, close, status, history |
| Pedidos | CRUD, cobrar, cancelar, whatsapp, KDS |
| Catálogo público | catalog/[slug], order, producto/[id] |
| Clientes | CRUD, abono, historial |
| Finanzas | CxC, CxP, gastos, P&L, punto equilibrio, export |
| Reportes | daily, range, monthly, export-pdf*, export-excel |
| Analytics | top-products, trends |
| Dashboard | kpis, charts, credit-summary |
| Config | business, catalog, payments, theme, ticket, iva, pin, devices |
| Usuarios | CRUD, reset-pin, change-password |
| Notificaciones | CRUD, push, read |
| Rates | BCV, manual |
| Admin | stats, tenants, impersonate, invoices, tickets |
| Plan | check, admin-override |

`*export-pdf`: implementado y funcional pero sin UI que lo invoque (DT-11)

---

## 10. MODELOS DE DATOS (37 Prisma Models)

**Tenant root:** `Business`

**Operativos:** `User` · `Product` · `ProductVariant` · `Category` · `Sale` · `SaleItem` · `SalePayment` · `SaleAbono` · `Order` · `OrderItem` · `Client` · `Supplier` · `Purchase` · `PurchaseItem` · `InventoryEntry` · `PaymentMethod` · `CashRegister` · `CashMovement` · `Gasto` · `ExpenseCategory` · `Quotation` · `QuotationItem` · `Return` · `ReturnItem`

**Sistema:** `Notification` · `BusinessDevice` · `PushSubscription` · `DollarRate` · `MonthlyReport` · `ProductComponent` · `ActivityLog` · `Invoice` · `SupportTicket` · `PinRateLimit`

**Globales (sin business_id):** `Plan` · `Segment` · `SegmentFaq`

**Campos nuevos Sprint 85-113:**
- `Business`: `catalog_cover_path_2`, `catalog_cover_path_3`
- `Category`: `image_url`
- `Order`: `delivery_type`, `delivery_address`, `recipient_name`

---

## 11. DEUDA TÉCNICA ACTIVA

| ID | Severidad | Descripción | Estado |
|---|---|---|---|
| DT-02 | P1 | `access_catalog`/`access_ai` sin enforce en endpoints | Abierto |
| DT-03 | P2 | Proveedores sin `moduleKey` en toggle de módulos | Abierto |
| DT-05 | P2 | RateLimiterMemory no cluster-safe | Histórico |
| DT-09 | P1 | InventoryEntry no resincroniza tras venta de variante | Abierto |
| DT-10 | P2 | Formulario no oculta "Stock Inicial" con hasVariants=true | Abierto |
| DT-11 | P2 | export-pdf huérfano — ninguna UI lo invoca | Abierto |
| DT-13 | P3 | .doc/CLAUDE.md v3.0 contradice CLAUDE.md raíz v3.1 | Abierto |
| DT-14 | P0 | variant_id descartado en catalog/order/route — precio_extra no suma | Abierto |
| DT-15 | P2 | Modal producto en CatalogoGrid es código muerto | Post-demo |
| DT-16 | P2 | Landing con mezcla de estilos viejos/nuevos | P0 next sprint |

---

## 12. VENTAJAS COMPETITIVAS vs COMPETENCIA

| Feature | Fina | Negotiale | Venko | SOFI | ActivoPOS |
|---|---|---|---|---|---|
| POS completo | ✅ | ✅ | ✅ | ✅ | ✅ |
| Catálogo público 3 páginas | ❌ | ❌ | ❌ | ❌ | ✅ |
| WhatsApp pedidos | ❌ | ❌ | ❌ | ❌ | ✅ |
| Dual USD+Bs sin toggle | Parcial | ✅ | ✅ | ✅ | ✅ |
| Temas por segmento (10) | ❌ | ❌ | ❌ | ❌ | ✅ |
| Variantes por producto | ? | ? | ✅ | ✅ | ✅ |
| Multi-ticket paralelo | ? | ? | ? | ? | ✅ |
| Pago Móvil/Zelle/Binance 1st-class | Parcial | ? | ? | ? | ✅ |
| Web Push nativo | ❌ | ❌ | ❌ | ? | ✅ |
| KDS (cocina) | ❌ | ❌ | ❌ | ❌ | ✅ |
| Catálogo con checkout propio | ❌ | ❌ | ❌ | ❌ | ✅ |
| Slider hero configurable | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 13. ROADMAP — PENDIENTE (post-demo / futuro)

### P0 (esta semana)
- Fix DT-14: variant_id en catalog order
- Homologar landing marketing (SPRINT_LANDING_REDISENO.md)

### P1 (próximos sprints)
- Conectar 29 call-sites al override manual de tasa (aprobación Carlos)
- Módulo banco / métodos de pago compartibles (con cliente, sin copiar-pegar)
- Export PDF conectado a UI de Reportes

### P2 (mediano plazo)
- Wildcard DNS `*.activopos.com` → catálogos por subdominio
- Módulo suscripción en dashboard (plan activo + alerta vencimiento)
- Dual brand header catálogo ("Powered by ActivoPOS" + logo del cliente)
- Listas de precio detal/mayor por cliente
- `inputMode="numeric"` en todos los campos numéricos del sistema
- Login split-screen desktop

### Futuro
- Sitef / UbiiPagos (integración pagos electronicos con descuento en caja)
- Landing SEO por segmento (`/para-carniceria`, `/para-ferreterias`, etc.)
- API WhatsApp oficial (Meta Business API)
- Admin panel en Filament v5 (admin.activopos.com)
- CRM completo con frecuencia, ticket promedio, campaña por WhatsApp

---

## 14. INFRAESTRUCTURA Y OPERACIÓN

### Stack completo
- **Frontend + Backend:** Next.js 14 App Router (full-stack)
- **ORM:** Prisma 7 con MariaDB adapter
- **DB:** MariaDB (VPS) / MySQL via Laragon (local)
- **Proceso:** PM2 cluster mode (proceso `activopos`, puerto 3003)
- **Proxy:** Nginx con SSL Certbot
- **Storage:** `/var/www/activopos/storage/tenants/{business_id}/`
- **Imágenes:** Compresión Canvas API antes de subir + thumbnail 400px server-side

### Deploy workflow (VPS)
```bash
cd /var/www/activopos
git fetch origin
git reset --hard origin/main
npm install --legacy-peer-deps
npx prisma generate
npx prisma db push
rm -rf .next
npm run build && pm2 restart activopos
```

---

*ActivoPOS · SYNTIdev · Carlos Bolívar*
*Documento generado: 2026-07-11 | Sprint 113*
*Claude Web — Coordinador y Árbitro de Contexto*
